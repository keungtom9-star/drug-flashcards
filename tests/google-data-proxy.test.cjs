const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const functionUrl = pathToFileURL(path.resolve(__dirname, '../netlify/functions/google-data.mjs')).href;
const originalFetch = global.fetch;
const originalEnv = {
  URL: process.env.URL,
  GOOGLE_DRUG_SHEET_CSV_URL: process.env.GOOGLE_DRUG_SHEET_CSV_URL,
  GOOGLE_QUIZ_SHEET_CSV_URL: process.env.GOOGLE_QUIZ_SHEET_CSV_URL,
  GOOGLE_SCRIPT_WEB_APP_URL: process.env.GOOGLE_SCRIPT_WEB_APP_URL,
};

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function loadHandler() {
  return (await import(`${functionUrl}?test=${Date.now()}-${Math.random()}`)).default;
}

function proxyRequest(source, options = {}, origin = 'https://drug-tutor.example') {
  return new Request(`https://drug-tutor.example/.netlify/functions/google-data?source=${source}`, {
    headers: { Origin: origin, ...(options.headers || {}) },
    ...options,
  });
}

test('Google data proxy keeps Sheet URLs server-side and caches CSV responses', async () => {
  process.env.URL = 'https://drug-tutor.example';
  process.env.GOOGLE_DRUG_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/server-drugs/pub?output=csv';
  let requestedUrl = '';
  global.fetch = async url => {
    requestedUrl = String(url);
    return new Response('name,class\nMetformin,Biguanide', {
      status: 200,
      headers: { 'Content-Type': 'text/csv' },
    });
  };

  const response = await (await loadHandler())(proxyRequest('drugs'));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'name,class\nMetformin,Biguanide');
  assert.equal(requestedUrl, process.env.GOOGLE_DRUG_SHEET_CSV_URL);
  assert.match(response.headers.get('Netlify-CDN-Cache-Control'), /s-maxage=300/);
});

test('Google data proxy forwards an approved save without exposing its Apps Script URL', async () => {
  process.env.URL = 'https://drug-tutor.example';
  process.env.GOOGLE_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/server-app/exec';
  let forwarded;
  global.fetch = async (url, options) => {
    forwarded = { url: String(url), options };
    return new Response('ok', { status: 200 });
  };

  const payload = JSON.stringify({ name: 'Metformin', indication: 'Diabetes' });
  const response = await (await loadHandler())(proxyRequest('save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }));
  assert.equal(response.status, 200);
  assert.equal(forwarded.url, process.env.GOOGLE_SCRIPT_WEB_APP_URL);
  assert.equal(forwarded.options.body, payload);
});

test('Google data proxy rejects missing config, foreign origins and unapproved hosts', async () => {
  process.env.URL = 'https://drug-tutor.example';
  delete process.env.GOOGLE_DRUG_SHEET_CSV_URL;
  let handler = await loadHandler();
  assert.equal((await handler(proxyRequest('drugs'))).status, 503);

  process.env.GOOGLE_DRUG_SHEET_CSV_URL = 'https://attacker.example/private.csv';
  handler = await loadHandler();
  assert.equal((await handler(proxyRequest('drugs'))).status, 503);

  process.env.GOOGLE_DRUG_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/safe/pub?output=csv';
  handler = await loadHandler();
  assert.equal((await handler(proxyRequest('drugs', {}, 'https://attacker.example'))).status, 403);
});
