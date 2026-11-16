import { buildPrompt, DEFAULT_MODES, RESPONSE_STYLES, RESPONSE_LANGUAGES, SAFETY_CORE, SCENE_RULES } from './prompts.js';
import { enforceRateLimit } from './rate-limit.js';
export { SOSRoom } from './sos-room.js';
export { SOSDirectory } from './sos-directory.js';

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
  if (body.customPrompt && (typeof body.customPrompt !== 'string' || body.customPrompt.length > 1000)) return 'Custom prompt must be text up to 1,000 characters.';
  if (body.model && (typeof body.model !== 'string' || !/^[a-zA-Z0-9._-]{3,100}$/.test(body.model.replace(/^models\//, '')))) return 'Invalid model identifier.';
  if (body.responseStyle && !Object.hasOwn(RESPONSE_STYLES, body.responseStyle)) return 'Unsupported response style.';
  if (body.waitSeconds !== undefined && (!Number.isInteger(body.waitSeconds) || body.waitSeconds < 15 || body.waitSeconds > 180)) return 'Wait time must be between 15 and 180 seconds.';
  if (body.responseLanguage && !Object.hasOwn(RESPONSE_LANGUAGES, body.responseLanguage)) return 'Unsupported response language.';
  return null;
}

function imageParts(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Invalid image data.');
  return { mime_type: match[1].toLowerCase(), data: match[2] };
}

function getMode(env) {
  const raw = String(env.AI_MODE ?? 'gemini').trim().toLowerCase();
  return raw || 'gemini';
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function getAllowedGeminiModels(env) {
  const configured = String(env.GEMINI_ALLOWED_MODELS || env.GEMINI_MODEL || 'gemini-3.8-flash');
  return new Set(configured.split(',').map(value => value.trim().replace(/^models\//, '')).filter(value => /^[a-zA-Z0-9._-]{3,100}$/.test(value)));
}

async function listGeminiModels(env) {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini API key is not configured.');
  const models = [];
  let pageToken = '';
  for (let page = 0; page < 3; page += 1) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Could not retrieve Gemini models.');
    models.push(...(data.models || []));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return models
    .filter(model => model.name && model.supportedGenerationMethods?.includes('generateContent'))
    .filter(model => getAllowedGeminiModels(env).has(String(model.name).replace(/^models\//, '')))
    .filter(model => !/(embedding|tts|live|imagen|veo|lyria|transcrib|audio|robotics)/i.test(model.name))
    .map(model => ({
      id: String(model.name).replace(/^models\//, ''),
      name: model.displayName || String(model.name).replace(/^models\//, ''),
      description: model.description || '',
      inputTokenLimit: model.inputTokenLimit || null,
      outputTokenLimit: model.outputTokenLimit || null,
      supportsThinking: Boolean(model.thinking)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function askGemini({ image, prompt, model, waitSeconds }, env) {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini is selected but GEMINI_API_KEY is not configured in .dev.vars.');
  const selectedModel = String(model || env.GEMINI_MODEL || 'gemini-3.8-flash').replace(/^models\//, '');
  const timeoutSeconds = Math.max(15, Math.min(180, Number(waitSeconds) || 120));
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`;
  const requestBody = {
    system_instruction: { parts: [{ text: SAFETY_CORE }] },
    contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: imageParts(image) }] }],
    generationConfig: { maxOutputTokens: 260 }
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutSeconds * 1000)
      });
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new Error(`Gemini did not respond within ${timeoutSeconds} seconds. The image was captured, but the model took too long. Try a faster Flash-Lite model or increase the wait setting.`);
      }
      throw new Error('Could not reach Gemini: ' + (error.message || 'network error'));
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      const answer = (data?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
      if (!answer) throw new Error('Gemini returned no readable answer. Please try another photo.');
      return answer;
    }
    const message = data?.error?.message || 'Gemini request failed.';
    if (response.status === 429) throw new Error('Gemini rate limit or quota reached. Check AI Studio usage and billing.');
    if (response.status === 401 || response.status === 403) throw new Error('Gemini rejected the API key. Check the local GEMINI_API_KEY setting.');
    if (response.status === 404) throw new Error(`Gemini model "${selectedModel}" was not found or is unavailable for this API key.`);
    if (response.status === 503 && attempt === 0) {
      await wait(1500);
      continue;
    }
    if (response.status === 503 || response.status === 504) throw new Error(`Gemini is temporarily overloaded (HTTP ${response.status}). Please retry shortly.`);
    throw new Error(message.slice(0, 300));
  }
  throw new Error('Gemini request failed after retry.');
}

async function forwardSos(request, env, action) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid SOS request.' }, 400); }
  const ip = request.headers.get('cf-connecting-ip') || 'local-development';
  if (!env.SOS_ROOM || !env.SOS_DIRECTORY) return json({ ok: false, error: 'SOS relay is not configured.' }, 503);

  const directory = env.SOS_DIRECTORY.get(env.SOS_DIRECTORY.idFromName('invitation-directory'));
  if (action === 'invite' || action === 'pair') {
    return directory.fetch(new Request('https://sos-directory.internal/' + action, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, clientIp: ip })
    }));
  }

  const deviceId = String(body.deviceId || '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(deviceId)) return json({ ok: false, error: 'Invalid sender device identity.' }, 400);
  const room = env.SOS_ROOM.get(env.SOS_ROOM.idFromName(deviceId));
  return room.fetch(new Request('https://sos-room.internal/' + action, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }));
}

export async function handleApi(request, env = {}) {
  const url = new URL(request.url);
  const mode = getMode(env);
  const model = String(env.GEMINI_MODEL || 'gemini-3.8-flash');

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const supportedMode = mode === 'gemini' || mode === 'mock';
    return json({
      ok: supportedMode,
      mode,
      model: mode === 'gemini' ? model : null,
      apiKeyConfigured: Boolean(env.GEMINI_API_KEY),
      // Configuration is observable; actual provider reachability is only established by a real request.
      providerConfigured: mode === 'gemini' && Boolean(env.GEMINI_API_KEY),
      rateLimitsConfigured: Boolean(env.APP_AI_LIMIT && env.APP_SOS_LIMIT),
      sosRelayConfigured: Boolean(env.SOS_ROOM && env.SOS_DIRECTORY),
      mockModeExplicitlyEnabled: mode === 'mock',
      message: !supportedMode
        ? `Unsupported AI_MODE "${mode}". Use "gemini" or explicitly "mock".`
        : mode === 'gemini'
          ? (env.GEMINI_API_KEY ? 'Gemini mode selected; provider key is loaded.' : 'Gemini mode selected, but GEMINI_API_KEY is missing.')
          : 'Mock mode explicitly enabled; no live image analysis.'
    }, supportedMode ? 200 : 503);
  }

  if (!url.pathname.startsWith('/api/')) return null;

  const origin = request.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).origin !== url.origin) return json({ error: 'Cross-origin API requests are not allowed.' }, 403); }
    catch { return json({ error: 'Invalid request origin.' }, 403); }
  }

  // Receiver endpoints are public by design, but each action is protected by
  // a short-lived invitation or a 256-bit receiver token.
  const receiverActions = {
    '/api/sos/pair': 'pair',
    '/api/sos/poll': 'poll',
    '/api/sos/ack': 'ack'
  };
  if (request.method === 'POST' && receiverActions[url.pathname]) {
    const limitResult = await enforceRateLimit(env.APP_SOS_LIMIT, request, 'sos-receiver');
    if (!limitResult.configured) return json({ error: 'SOS rate limiting is not configured.' }, 503);
    if (!limitResult.success) return json({ error: 'SOS receiver request limit reached. Please wait before trying again.' }, 429);
    return forwardSos(request, env, receiverActions[url.pathname]);
  }

  // The browser app is public: expensive routes are protected by per-IP,
  // weighted Cloudflare limits instead of an owner login token.
  const isVisionRoute = request.method === 'POST' && ['/api/describe', '/api/ask'].includes(url.pathname);
  const isSpeechRoute = request.method === 'POST' && url.pathname === '/api/speech';
  const isModelsRoute = request.method === 'GET' && url.pathname === '/api/models';
  if (isVisionRoute || isSpeechRoute || isModelsRoute) {
    const delta = isVisionRoute ? 4 : isSpeechRoute ? 2 : 1;
    const limitResult = await enforceRateLimit(env.APP_AI_LIMIT, request, 'ai', delta);
    if (!limitResult.configured) return json({ error: 'AI rate limiting is not configured. Please try again later.' }, 503);
    if (!limitResult.success) return json({ error: 'Public AI usage limit reached for this network. Please wait a minute and try again.' }, 429);
  }

  const isSenderSosRoute = request.method === 'POST' && ['/api/sos/invite', '/api/sos/trigger'].includes(url.pathname);
  if (isSenderSosRoute) {
    const limitResult = await enforceRateLimit(env.APP_SOS_LIMIT, request, 'sos-sender');
    if (!limitResult.configured) return json({ error: 'SOS rate limiting is not configured.' }, 503);
    if (!limitResult.success) return json({ error: 'SOS request limit reached. Please wait before trying again.' }, 429);
  }

  const sosActions = {
    '/api/sos/invite': 'invite',
    '/api/sos/trigger': 'trigger'
  };
  if (request.method === 'POST' && sosActions[url.pathname]) {
    return forwardSos(request, env, sosActions[url.pathname]);
  }

  if (request.method === 'GET' && url.pathname === '/api/models') {
    try {
      return json({ ok: true, models: await listGeminiModels(env), configuredModel: model });
    } catch (error) {
      return json({ ok: false, error: error.message || 'Could not load models.' }, 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/config') {
    return json({
      aiMode: mode, liveAIEnabled: mode === 'gemini',
      model, responseStyles: Object.keys(RESPONSE_STYLES),
      basePrompt: SCENE_RULES,
      availableModes: Object.entries(DEFAULT_MODES).map(([id, m]) => ({ id, label: m.label, usesCamera: m.usesCamera }))
    });
  }

  if (request.method === 'POST' && ['/api/describe', '/api/ask'].includes(url.pathname)) {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const invalid = validPayload(body);
    if (invalid) return json({ error: invalid }, 400);
    const action = url.pathname.endsWith('/ask') ? 'ask' : 'describe';
    if (!body.image) return json({ error: 'A camera image is required for this endpoint.' }, 400);
    if (action === 'ask' && !body.question?.trim()) return json({ error: 'Please provide a question.' }, 400);
    if (mode !== 'gemini' && mode !== 'mock') return json({ error: `Unsupported AI_MODE "${mode}".` }, 503);
    const selectedModel = String(body.model || model).replace(/^models\//, '');
    if (!getAllowedGeminiModels(env).has(selectedModel)) {
      return json({ error: 'This public demo currently allows only its configured Gemini model. The model was not enabled for public API use.' }, 400);
    }
    const waitSeconds = body.waitSeconds || 120;
    const prompt = buildPrompt({
      mode: action,
      question: body.question || '',
      customPrompt: body.customPrompt || '',
      responseStyle: body.responseStyle || 'concise',
      responseLanguage: body.responseLanguage || 'en-US'
    });
    if (mode === 'gemini') {
      try {
        const answer = await askGemini({ image: body.image, prompt, model: selectedModel, waitSeconds }, env);
        return json({
          ok: true, mock: false, provider: 'Gemini',
          model: selectedModel, answer,
          disclaimer: 'AI can miss objects and hazards. Do not rely on this description alone for mobility or safety decisions.'
        });
      } catch (error) {
        return json({ error: error.message || 'Gemini request failed.' }, 502);
      }
    }
    return json({
      ok: true, mock: true,
      answer: action === 'ask'
        ? `Mock mode: I received your question: “${body.question.trim()}”. No image analysis was performed.`
        : 'Mock mode is explicitly enabled. No objects or hazards were identified.',
      receivedImage: Boolean(body.image),
      disclaimer: 'SIMULATED RESPONSE — do not use this output to make mobility or safety decisions.'
    });
  }
  if (url.pathname.startsWith('/api/')) return json({ error: 'API route not found.' }, 404);
  return null;
}

export default {
  async fetch(request, env) {
    const api = await handleApi(request, env);
    if (api) return api;
    return env.ASSETS.fetch(request);
  }
};
