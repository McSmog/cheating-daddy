function normalizeEndpoint(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Enter an API base URL');
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Use an HTTP(S) API URL without credentials, query parameters or fragments');
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
    return url.toString();
}

async function readCompletion(response, onText) {
    if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        const text = result.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error('API returned no text answer');
        onText(text);
        return text;
    }
    const decoder = new TextDecoder();
    let pending = '';
    let text = '';
    let done = false;
    const consume = line => {
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data) return;
        if (data === '[DONE]') {
            done = true;
            return;
        }
        const event = JSON.parse(data);
        if (event.error) throw new Error('API reported a streaming error');
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') {
            text += delta;
            onText(text);
        }
    };
    for await (const chunk of response.body) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) {
            consume(line.replace(/\r$/, ''));
            if (done) break;
        }
        if (done) break;
    }
    if (!done) consume((pending + decoder.decode()).replace(/\r$/, ''));
    if (!text.trim()) throw new Error('API returned no text answer');
    return text;
}

async function requestCompletion(config, messages, onText, signal) {
    const response = await fetch(config.endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: config.model, messages, stream: true }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    });
    if (!response.ok) {
        // Do not echo provider bodies: they may include submitted context or credentials.
        const hint = { 401: 'check API key', 403: 'access denied', 404: 'check base URL and model', 429: 'provider quota or rate limit' }[
            response.status
        ];
        throw new Error(`API HTTP ${response.status}${hint ? ': ' + hint : ''}`);
    }
    if (!response.body) throw new Error('API returned an empty response');
    return readCompletion(response, onText);
}

module.exports = { normalizeEndpoint, readCompletion, requestCompletion };
