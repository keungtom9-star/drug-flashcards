const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-flash';
const MAX_BODY_BYTES = 96_000;
const MAX_MESSAGES = 24;
const MAX_PROMPT_CHARS = 60_000;

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function allowedOrigins(request) {
  const origins = new Set([new URL(request.url).origin]);
  for (const value of [process.env.URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL]) {
    if (!value) continue;
    try { origins.add(new URL(value).origin); } catch (_) {}
  }
  return origins;
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return allowedOrigins(request).has(origin);
}

function sanitizeMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return null;
  let totalChars = 0;
  const messages = [];
  for (const message of value) {
    const role = String(message?.role || '');
    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!['system', 'user', 'assistant'].includes(role) || !content) return null;
    totalChars += content.length;
    if (totalChars > MAX_PROMPT_CHARS) return null;
    messages.push({ role, content });
  }
  return messages;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export default async function handler(request) {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });
  if (!isAllowedOrigin(request)) return jsonResponse(403, { error: 'Origin not allowed.' });

  const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
  if (!apiKey) return jsonResponse(503, { error: 'DeepSeek is not configured on the server.' });

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return jsonResponse(413, { error: 'Request is too large.' });

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: 'Request is too large.' });
    }

    let input;
    try { input = JSON.parse(rawBody); } catch (_) {
      return jsonResponse(400, { error: 'Invalid JSON body.' });
    }

    const messages = sanitizeMessages(input?.messages);
    if (!messages) return jsonResponse(400, { error: 'Invalid or oversized messages.' });

    const stream = input?.stream === true;
    const upstreamBody = {
      model: DEEPSEEK_MODEL,
      messages,
      temperature: clampNumber(input?.temperature, 0.4, 0, 1),
      max_tokens: Math.round(clampNumber(input?.max_tokens, 700, 64, 4096)),
      stream,
    };
    if (input?.response_format?.type === 'json_object') {
      upstreamBody.response_format = { type: 'json_object' };
    }

    const upstream = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(upstreamBody),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || (stream ? 'text/event-stream' : 'application/json'),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (_) {
    return jsonResponse(502, { error: 'DeepSeek is temporarily unavailable.' });
  }
}

export const config = { path: '/.netlify/functions/deepseek' };
