const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const functionUrl = pathToFileURL(path.resolve(__dirname, '../netlify/functions/openrouter-qwen.mjs')).href;
const originalFetch = global.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;
const originalSiteUrl = process.env.URL;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
  if (originalSiteUrl === undefined) delete process.env.URL;
  else process.env.URL = originalSiteUrl;
});

async function loadHandler() {
  return (await import(`${functionUrl}?test=${Date.now()}-${Math.random()}`)).default;
}

function qwenRequest(body, origin = 'https://drug-tutor.example') {
  return new Request('https://drug-tutor.example/.netlify/functions/openrouter-qwen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}

test('Qwen proxy keeps the key server-side and pins the free model', async () => {
  process.env.OPENROUTER_API_KEY = 'server-only-test-key';
  process.env.URL = 'https://drug-tutor.example';
  let forwarded;
  global.fetch = async (url, options) => {
    forwarded = { url, options };
    return new Response('data: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };

  const handler = await loadHandler();
  const response = await handler(qwenRequest({
    model: 'untrusted/model',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true,
  }));

  assert.equal(response.status, 200);
  assert.equal(forwarded.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(forwarded.options.headers.Authorization, 'Bearer server-only-test-key');
  const payload = JSON.parse(forwarded.options.body);
  assert.equal(payload.model, 'qwen/qwen3.8-27b:free');
  assert.equal(payload.stream, true);
});

test('Qwen proxy rejects missing configuration, foreign origins and oversized prompts', async () => {
  const handler = await loadHandler();
  delete process.env.OPENROUTER_API_KEY;
  assert.equal((await handler(qwenRequest({ messages: [{ role: 'user', content: 'Hello' }] }))).status, 503);

  process.env.OPENROUTER_API_KEY = 'server-only-test-key';
  assert.equal((await handler(qwenRequest({ messages: [{ role: 'user', content: 'Hello' }] }, 'https://attacker.example'))).status, 403);
  assert.equal((await handler(qwenRequest({ messages: [{ role: 'user', content: 'x'.repeat(60_001) }] }))).status, 400);
});
