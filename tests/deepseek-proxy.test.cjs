const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulePromise = import(pathToFileURL(path.resolve(__dirname, '../netlify/functions/deepseek.mjs')).href);

async function runWithServerKey(value, task) {
    const previous = process.env.DEEPSEEK_API_KEY;
    const previousFetch = global.fetch;
    if (value === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = value;
    try {
        return await task();
    } finally {
        global.fetch = previousFetch;
        if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
        else process.env.DEEPSEEK_API_KEY = previous;
    }
}

function request(body, origin = 'https://site.test') {
    return new Request('https://site.test/.netlify/functions/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify(body),
    });
}

test('DeepSeek proxy keeps the key server-side and pins the Flash model', async () => {
    const { default: handler } = await modulePromise;
    await runWithServerKey('server-secret-test-key', async () => {
        let upstream;
        global.fetch = async (url, options) => {
            upstream = { url, options };
            return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };
        const response = await handler(request({
            model: 'attacker-model',
            messages: [{ role: 'user', content: 'Return JSON.' }],
            temperature: .2,
            max_tokens: 900,
            stream: false,
            response_format: { type: 'json_object' },
        }));
        assert.equal(response.status, 200);
        assert.equal(upstream.url, 'https://api.deepseek.com/chat/completions');
        assert.equal(upstream.options.headers.Authorization, 'Bearer server-secret-test-key');
        const body = JSON.parse(upstream.options.body);
        assert.equal(body.model, 'deepseek-flash');
        assert.equal(body.temperature, .2);
        assert.equal(body.max_tokens, 900);
        assert.deepEqual(body.response_format, { type: 'json_object' });
        assert.doesNotMatch(await response.text(), /server-secret-test-key/);
    });
});

test('DeepSeek proxy sanitises options and does not forward arbitrary response formats', async () => {
    const { default: handler } = await modulePromise;
    await runWithServerKey('server-test-key', async () => {
        let forwarded;
        global.fetch = async (_url, options) => {
            forwarded = JSON.parse(options.body);
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        };
        const response = await handler(request({
            messages: [{ role: 'system', content: 'Safe prompt' }, { role: 'user', content: 'Question' }],
            temperature: 99,
            max_tokens: 999999,
            response_format: { type: 'text', extra: 'unsafe' },
        }));
        assert.equal(response.status, 200);
        assert.equal(forwarded.temperature, 1);
        assert.equal(forwarded.max_tokens, 2400);
        assert.equal(forwarded.response_format, undefined);
        assert.deepEqual(forwarded.messages, [
            { role: 'system', content: 'Safe prompt' },
            { role: 'user', content: 'Question' },
        ]);
    });
});

test('DeepSeek proxy fails safely when the server secret is missing', async () => {
    const { default: handler } = await modulePromise;
    await runWithServerKey(undefined, async () => {
        let called = false;
        global.fetch = async () => { called = true; };
        const response = await handler(request({ messages: [{ role: 'user', content: 'Hello' }] }));
        assert.equal(response.status, 503);
        assert.equal(called, false);
        assert.match(await response.text(), /not configured on the server/i);
    });
});

test('DeepSeek proxy rejects foreign origins and oversized prompts before contacting the API', async () => {
    const { default: handler } = await modulePromise;
    await runWithServerKey('server-test-key', async () => {
        let calls = 0;
        global.fetch = async () => { calls++; };
        const foreign = await handler(request({ messages: [{ role: 'user', content: 'Hello' }] }, 'https://evil.test'));
        assert.equal(foreign.status, 403);
        const oversized = await handler(request({ messages: [{ role: 'user', content: 'x'.repeat(60_001) }] }));
        assert.equal(oversized.status, 400);
        assert.equal(calls, 0);
    });
});
