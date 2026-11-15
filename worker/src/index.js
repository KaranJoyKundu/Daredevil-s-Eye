import { buildPrompt, DEFAULT_MODES, SAFETY_CORE } from './prompts.js';

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
  if (body.customPrompt && (typeof body.customPrompt !== 'string' || body.customPrompt.length > 4000)) return 'Custom prompt must be text up to 4,000 characters.';
  return null;
}

function imageParts(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Invalid image data.');
  return { mime_type: match[1].toLowerCase(), data: match[2] };
}

async function askGemini({ image, prompt }, env) {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini is selected but GEMINI_API_KEY is not configured in the local Worker secrets.');
  const model = String(env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SAFETY_CORE }] },
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: imageParts(image) }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 220 }
    }),
    signal: AbortSignal.timeout(45000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || 'Gemini request failed.';
    if (response.status === 429) throw new Error('Gemini rate limit or quota reached. Check AI Studio usage and billing.');
    if (response.status === 401 || response.status === 403) throw new Error('Gemini rejected the API key. Check the local GEMINI_API_KEY setting.');
    throw new Error(message.slice(0, 300));
  }
  const answer = (data?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
  if (!answer) throw new Error('Gemini returned no readable answer. Please try another photo.');
  return answer;
}

export async function handleApi(request, env = {}) {
  const url = new URL(request.url);
  const mode = env.AI_MODE || 'mock';
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, mode, providerConnected: mode === 'gemini' && Boolean(env.GEMINI_API_KEY), message: mode === 'gemini' ? 'Gemini mode selected.' : 'Mock mode active; no live image analysis.' });
  }
  if (request.method === 'GET' && url.pathname === '/api/config') {
    return json({ aiMode: mode, liveAIEnabled: mode === 'gemini', availableModes: Object.entries(DEFAULT_MODES).map(([id, m]) => ({ id, label: m.label, usesCamera: m.usesCamera })) });
  }
  if (request.method === 'POST' && ['/api/describe', '/api/ask'].includes(url.pathname)) {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const invalid = validPayload(body);
    if (invalid) return json({ error: invalid }, 400);
    const action = url.pathname.endsWith('/ask') ? 'ask' : 'describe';
    if (!body.image) return json({ error: 'A camera image is required for this endpoint.' }, 400);
    if (action === 'ask' && !body.question?.trim()) return json({ error: 'Please provide a question.' }, 400);
    const prompt = buildPrompt({ mode: action, question: body.question || '', customPrompt: body.customPrompt || '' });
    if (mode === 'gemini') {
      try {
        const answer = await askGemini({ image: body.image, prompt }, env);
        return json({ ok: true, mock: false, provider: 'Gemini', answer, disclaimer: 'AI can miss objects and hazards. Do not rely on this description alone for mobility or safety decisions.' });
      } catch (error) {
        return json({ error: error.name === 'TimeoutError' ? 'Gemini timed out. Please try again.' : error.message || 'Gemini request failed.' }, 502);
      }
    }
    return json({
      ok: true, mock: true,
      answer: action === 'ask'
        ? `Mock mode: I received your question: “${body.question.trim()}”. Real image analysis is not connected yet.`
        : 'Mock mode: the camera request was received, but image analysis is not connected.',
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
