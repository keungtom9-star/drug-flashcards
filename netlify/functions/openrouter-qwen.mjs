const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const QWEN_MODEL = 'qwen/qwen3.8-27b:free';
const MAX_BODY_BYTES = 96_000;
const MAX_MESSAGES = 24;
const MAX_PROMPT_CHARS = 60_000;

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

function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) return null;

  let totalChars = 0;
  const cleaned = [];
  for (const message of messages) {
    const role = message?.role;
    const content = message?.content;
    if (!['system', 'user', 'assistant'].includes(role) || typeof content !== 'string') return null;
    totalChars += content.length;
    if (totalChars > MAX_PROMPT_CHARS) return null;
    cleaned.push({ role, content });
  }
  return cleaned;
}

export default async function handler(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!isAllowedOrigin(request)) return jsonResponse({ error: 'Origin not allowed.' }, 403);

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return jsonResponse({ error: 'Qwen is not configured on the server.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return jsonResponse({ error: 'Request is too large.' }, 413);

  let input;
  try {
    input = await request.json();
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON request.' }, 400);
  }

  const messages = sanitizeMessages(input?.messages);
  if (!messages) return jsonResponse({ error: 'Invalid or oversized messages.' }, 400);

  const temperature = Number.isFinite(Number(input.temperature))
    ? Math.min(1, Math.max(0, Number(input.temperature)))
    : 0.4;
  const requestedTokens = Number(input.max_tokens);
  const maxTokens = Number.isInteger(requestedTokens)
    ? Math.min(900, Math.max(64, requestedTokens))
    : 700;

  let upstream;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.URL || new URL(request.url).origin,
        'X-Title': 'AI Drug Tutor',
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: input.stream === true,
      }),
    });
  } catch (_) {
    return jsonResponse({ error: 'The AI provider could not be reached.' }, 502);
  }

  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const config = {
  path: '/.netlify/functions/openrouter-qwen',
};
