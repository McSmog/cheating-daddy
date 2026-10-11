const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(overrides = {}, completion = null) {
    const calls = [];
    const events = [];
    const transcriptions = [];
    const prefs = {
        localResponseBackend: 'openai',
        openaiBaseUrl: 'https://example.org/v1',
        openaiModel: 'custom',
        whisperLanguage: 'ru',
        ...overrides,
    };
    const runtime = {
        ensureNativeBinary: async name => {
            calls.push(name);
            return '/mock/' + name;
        },
        ensureWhisperModel: async name => {
            calls.push(name);
            return '/mock/model';
        },
        ensureLlamaModel: async () => {
            throw new Error('Must not download a local LLM');
        },
        getAvailablePort: async () => 8080,
        getModelsDirectory: () => '/mock/cache',
        startNativeServer: opts => {
            calls.push(opts.name);
            return {};
        },
        stopNativeServer: () => {},
        waitForServer: async () => {},
    };
    const module = { exports: {} };
    const sandbox = {
        fetch: async (_, options) => {
            transcriptions.push(options.body);
            return { ok: true, json: async () => ({ text: 'Расскажи о проекте' }) };
        },
        module,
        Buffer,
        AbortController,
        AbortSignal,
        TextDecoder,
        Blob,
        FormData,
        setTimeout,
        console: { log() {}, error() {} },
        require(name) {
            if (name === 'fs') return { existsSync: p => !p.startsWith('/mock/cache') };
            if (name === 'path') return path;
            if (name === '../storage') return { getPreferences: () => prefs, getCredentials: () => ({ openaiKey: 'test' }) };
            if (name === './prompts') return { getSystemPrompt: (_, context) => context };
            if (name === './gemini') return { sendToRenderer: (...args) => events.push(args), initializeNewSession() {}, saveConversationTurn() {} };
            if (name === './native-ai-runtime') return runtime;
            if (name === './openai-compatible')
                return {
                    normalizeEndpoint: require('../src/utils/openai-compatible').normalizeEndpoint,
                    requestCompletion:
                        completion ||
                        (async (config, messages, callback) => {
                            calls.push({ config, messages });
                            callback('Answer');
                            return 'Answer';
                        }),
                };
            throw new Error(name);
        },
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/utils/localai'), 'utf8'), sandbox);
    return { api: module.exports, calls, events, transcriptions };
}

test('Whisper + API starts without downloading or starting llama and sends resume/history', async () => {
    const { api, calls } = fixture();
    assert.equal(await api.initializeLocalSession('unused', 'base', 'interview', 'My resume'), true);
    assert.deepEqual(calls, ['whisper', 'base', 'Whisper']);
    assert.equal((await api.sendLocalText('First question')).success, true);
    assert.equal((await api.sendLocalText('Follow up')).success, true);
    const requests = calls.filter(c => typeof c === 'object');
    assert.equal(requests[0].config.endpoint, 'https://example.org/v1/chat/completions');
    assert.equal(requests[1].messages[0].content, 'My resume');
    assert.equal(requests[1].messages[2].role, 'assistant');
    api.closeLocalSession();
    assert.equal((await api.sendLocalText('Stopped')).success, false);
});

test('invalid API settings and English-only model reject before any download', async () => {
    for (const overrides of [{ openaiModel: '' }, { openaiBaseUrl: 'file:///tmp' }]) {
        const { api, calls } = fixture(overrides);
        assert.equal(await api.initializeLocalSession('unused', 'base', 'interview', ''), false);
        assert.equal(calls.length, 0);
    }
    const { api, calls } = fixture();
    assert.equal(await api.initializeLocalSession('unused', 'base.en', 'interview', ''), false);
    assert.equal(calls.length, 0);
});

test('stopped session cannot publish a late completion into a new session', async () => {
    let finish;
    let started;
    const ready = new Promise(resolve => {
        started = resolve;
    });
    const { api, events } = fixture({}, async (_, __, callback) => {
        started();
        await new Promise(resolve => {
            finish = resolve;
        });
        callback('Stale answer');
        return 'Stale answer';
    });
    await api.initializeLocalSession('unused', 'base', 'interview', '');
    const pending = api.sendLocalText('Old question');
    await ready;
    api.closeLocalSession();
    await api.initializeLocalSession('unused', 'base', 'interview', '');
    finish();
    assert.equal((await pending).success, false);
    assert.equal(
        events.some(([name, text]) => name === 'new-response' && text === 'Stale answer'),
        false
    );
    api.closeLocalSession();
});

test('speech is resampled into a WAV and transcribed in Russian before the API request', async () => {
    const { api, calls, transcriptions } = fixture();
    await api.initializeLocalSession('unused', 'base', 'interview', 'Resume');
    const voice = Buffer.alloc(4800);
    for (let i = 0; i < voice.length; i += 2) voice.writeInt16LE(5000, i);
    for (let i = 0; i < 12; i++) api.processLocalAudio(voice);
    for (let i = 0; i < 16; i++) api.processLocalAudio(Buffer.alloc(4800));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(transcriptions.length, 1);
    assert.equal(transcriptions[0].get('language'), 'ru');
    assert.equal(transcriptions[0].get('translate'), 'false');
    const wav = Buffer.from(await transcriptions[0].get('file').arrayBuffer());
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(24), 16000);
    assert.equal(calls.filter(c => typeof c === 'object')[0].messages[1].content, 'Расскажи о проекте');
    api.closeLocalSession();
});
