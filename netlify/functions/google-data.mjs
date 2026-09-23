const MAX_SAVE_BYTES = 96_000;
const MAX_CSV_BYTES = 8_000_000;

const SOURCE_CONFIG = {
  drugs: { env: 'GOOGLE_DRUG_SHEET_CSV_URL', hosts: new Set(['docs.google.com']) },
  quiz: { env: 'GOOGLE_QUIZ_SHEET_CSV_URL', hosts: new Set(['docs.google.com']) },
  save: { env: 'GOOGLE_SCRIPT_WEB_APP_URL', hosts: new Set(['script.google.com']) },
};

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const allowed = new Set([new URL(request.url).origin]);
  for (const candidate of [process.env.URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL]) {
    if (!candidate) continue;
    try { allowed.add(new URL(candidate).origin); } catch (_) { /* Ignore malformed platform metadata. */ }
  }
  return allowed.has(origin);
}

function getConfiguredUrl(source) {
  const config = SOURCE_CONFIG[source];
  const raw = config ? process.env[config.env]?.trim() : '';
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !config.hosts.has(url.hostname)) return null;
    return url;
  } catch (_) {
    return null;
  }
}

async function readLimitedText(response, limit) {
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > limit) throw new Error('Response is too large.');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > limit) throw new Error('Response is too large.');
  return text;
}

async function serveCsv(url) {
  let upstream;
  try {
    upstream = await fetch(url, { redirect: 'follow' });
  } catch (_) {
    return jsonResponse({ error: 'The Google Sheet could not be reached.' }, 502);
  }
  if (!upstream.ok) return jsonResponse({ error: 'The Google Sheet request failed.' }, 502);

  try {
    const csv = await readLimitedText(upstream, MAX_CSV_BYTES);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (_) {
    return jsonResponse({ error: 'The Google Sheet response was too large.' }, 502);
  }
}

async function saveDrug(request, url) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_SAVE_BYTES) return jsonResponse({ error: 'Request is too large.' }, 413);

  let body;
  try {
    body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_SAVE_BYTES) {
      return jsonResponse({ error: 'Request is too large.' }, 413);
    }
    JSON.parse(body);
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON request.' }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (_) {
    return jsonResponse({ error: 'The Google Sheet save service could not be reached.' }, 502);
  }

  if (!upstream.ok) return jsonResponse({ error: 'The Google Sheet save failed.' }, 502);
  return jsonResponse({ ok: true });
}

export default async function handler(request) {
  if (!isAllowedOrigin(request)) return jsonResponse({ error: 'Origin not allowed.' }, 403);

  const source = new URL(request.url).searchParams.get('source') || '';
  const url = getConfiguredUrl(source);
  if (!url) return jsonResponse({ error: 'This data source is not configured on the server.' }, 503);

  if ((source === 'drugs' || source === 'quiz') && request.method === 'GET') return serveCsv(url);
  if (source === 'save' && request.method === 'POST') return saveDrug(request, url);
  return jsonResponse({ error: 'Method not allowed.' }, 405);
}

export const config = {
  path: '/.netlify/functions/google-data',
};
