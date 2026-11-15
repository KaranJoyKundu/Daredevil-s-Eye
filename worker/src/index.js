import { buildPrompt, DEFAULT_MODES } from './prompts.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function validPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Expected a JSON object.';
  if (body.image && typeof body.image !== 'string') return 'Image must be a base64 data URL string.';
  if (body.image && !/^data:image\/(jpeg|png|webp);base64,/i.test(body.image)) return 'Only JPEG, PNG, or WebP images are accepted.';
  if (body.image && body.image.length > 5_500_000) return 'Image is too large (maximum about 4 MB encoded).';
  if (body.question && (typeof body.question !== 'string' || body.question.length > 1000)) return 'Question must be text up to 1,000 characters.';
  return null;
}

export async function handleApi(request, env = {}) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, mode: env.AI_MODE || 'mock', providerConnected: false, message: 'Backend is available. AI recognition is not connected.' });
  }
  if (request.method === 'GET' && url.pathname === '/api/config') {
    return json({ aiMode: env.AI_MODE || 'mock', liveAIEnabled: false, availableModes: Object.entries(DEFAULT_MODES).map(([id, m]) => ({ id, label: m.label, usesCamera: m.usesCamera })) });
  }
  if (request.method === 'POST' && ['/api/describe', '/api/ask'].includes(url.pathname)) {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const invalid = validPayload(body);
    if (invalid) return json({ error: invalid }, 400);
    const mode = url.pathname.endsWith('/ask') ? 'ask' : 'describe';
    if (!body.image) return json({ error: 'A camera image is required for this endpoint.' }, 400);
    if (mode === 'ask' && !body.question?.trim()) return json({ error: 'Please provide a question.' }, 400);
    const prompt = buildPrompt({ mode, question: body.question || '' });
    return json({
      ok: true, mock: true,
      answer: mode === 'ask'
        ? `Mock mode: I received your question: “${body.question.trim()}”. Real image analysis is not connected yet.`
        : 'Mock mode: the camera request was received, but I cannot identify objects or hazards yet. Connect an approved vision provider in a later milestone.',
      receivedImage: Boolean(body.image), promptPreview: prompt,
      disclaimer: 'SIMULATED RESPONSE — do not use this output to make mobility or safety decisions.'
    });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const api = await handleApi(request, env);
    if (api) return api;
    return env.ASSETS.fetch(request);
  }
};
