const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('API settings persist the key separately and select the Whisper backend', async () => {
    const preferences = {};
    const credentials = { unrelatedKey: 'preserve' };
    const source = fs
        .readFileSync('src/components/views/CustomizeView.js', 'utf8')
        .replace(/^import .*;\n/gm, '')
        .replace('export class CustomizeView', 'class CustomizeView');
    let View;
    vm.runInNewContext(source, {
        LitElement: class {},
        unifiedPageStyles: {},
        css: () => '',
        customElements: {
            define: (_, value) => {
                View = value;
            },
        },
        cheatingDaddy: {
            storage: {
                updatePreference: async (key, value) => {
                    preferences[key] = value;
                },
                setCredentials: async value => {
                    Object.assign(credentials, value);
                },
            },
        },
    });
    const view = Object.create(View.prototype);
    await view._saveApiField('_apiBaseUrl', 'openaiBaseUrl', 'http://localhost:1234/v1');
    await view._saveApiField('_apiModel', 'openaiModel', 'test-model');
    await view._saveApiField('_apiKey', 'openaiKey', 'test-key');
    await view._useWhisperApi();
    assert.equal(preferences.openaiBaseUrl, 'http://localhost:1234/v1');
    assert.equal(preferences.openaiModel, 'test-model');
    assert.equal(preferences.openaiKey, undefined);
    assert.equal(credentials.openaiKey, 'test-key');
    assert.equal(credentials.unrelatedKey, 'preserve');
    assert.equal(preferences.providerMode, 'local');
    assert.equal(preferences.localResponseBackend, 'openai');
});
