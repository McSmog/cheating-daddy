const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { normalizeEndpoint, readCompletion, requestCompletion } = require('../src/utils/openai-compatible');

test('normalizes base and full completion URLs and rejects credentials', () => {
    assert.equal(normalizeEndpoint(' https://example.org/v1/ '), 'https://example.org/v1/chat/completions');
    assert.equal(normalizeEndpoint('http://localhost:8080/v1/chat/completions'), 'http://localhost:8080/v1/chat/completions');
    assert.throws(() => normalizeEndpoint('https://key:secret@example.org/v1'));
    assert.throws(() => normalizeEndpoint('file:///tmp/model'));
});

test('stream parser preserves split UTF-8, CRLF and final unterminated event', async () => {
    const bytes = Buffer.from('data:{"choices":[{"delta":{"content":"Привет"}}]}\r\n\ndata: {"choices":[{"delta":{"content":"!"}}]}');
    const response = new Response(
        new ReadableStream({
            start(controller) {
                for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
                controller.close();
            },
        })
    );
    const updates = [];
    assert.equal(await readCompletion(response, t => updates.push(t)), 'Привет!');
    assert.deepEqual(updates, ['Привет', 'Привет!']);
});

test('real HTTP request sends model, context and bearer key; accepts JSON fallback', async t => {
    let received;
    const server = http.createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        received = { url: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'Answer' } }] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
        server.closeAllConnections();
        server.close();
    });
    const endpoint = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
    const messages = [
        { role: 'system', content: 'Resume context' },
        { role: 'user', content: 'Question' },
    ];
    assert.equal(
        await requestCompletion({ endpoint, apiKey: 'test-key', model: 'custom-model' }, messages, () => {}, new AbortController().signal),
        'Answer'
    );
    assert.equal(received.auth, 'Bearer test-key');
    assert.deepEqual(received.body, { model: 'custom-model', messages, stream: true });
});

test('stopping a session cancels HTTP work and errors do not echo credentials', async t => {
    const server = http.createServer((req, res) => {
        if (req.url === '/error') {
            res.writeHead(401);
            res.end('secret-key');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
        server.closeAllConnections();
        server.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const ctrl = new AbortController();
    const pending = requestCompletion({ endpoint: base, model: 'x' }, [], () => {}, ctrl.signal);
    ctrl.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    await assert.rejects(
        requestCompletion({ endpoint: base + '/error', model: 'x' }, [], () => {}, new AbortController().signal),
        e => e.message.includes('401') && !e.message.includes('secret-key')
    );
});
