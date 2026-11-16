import { buildPrompt, DEFAULT_MODES, RESPONSE_STYLES, RESPONSE_LANGUAGES, SAFETY_CORE, SCENE_RULES } from './prompts.js';
export { SOSRoom } from './sos-room.js';
export { SOSDirectory } from './sos-directory.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const USER_KEY_HEADER = 'x-user-gemini-api-key';
const VISION_MODEL_PRIORITY = [
  'gemini-3.1-pro-preview',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
];
const TRANSCRIPTION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-transcribe'
];
const STATIC_VISION_FALLBACKS = VISION_MODEL_PRIORITY.slice(1);
const LOW_COST_TRANSCRIPTION_MODELS = TRANSCRIPTION_MODELS.slice(0, 2);
const HIGHER_COST_TRANSCRIPTION_FALLBACKS = TRANSCRIPTION_MODELS.slice(2);
let visionRotation = 0;
let transcriptionRotation = 0;
let modelCache = { tag: '', expiresAt: 0, models: [] };

function providerKey(request, env) {
  const personal = String(request.headers.get(USER_KEY_HEADER) || '').trim();
  if (personal) return personal.slice(0, 256);
  return String(env.GEMINI_API_KEY || '').trim();
}

function hasPersonalKey(request) {
  return Boolean(String(request.headers.get(USER_KEY_HEADER) || '').trim());
}

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

function audioParts(dataUrl) {
  const match = /^data:(audio\/(?:webm|ogg|mp4|mpeg|mp3|wav|aac|opus|m4a|flac|aiff))(?:;codecs=[a-z0-9.]+)?;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Unsupported audio format. Please use a browser that records WebM, OGG or MP4 audio.');
  return { mime_type: match[1].toLowerCase(), data: match[2] };
}

function getMode(env) {
  const raw = String(env.AI_MODE ?? 'gemini').trim().toLowerCase();
  return raw || 'gemini';
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fingerprint(value) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest).slice(0, 10), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return String(value.length) + ':' + value.slice(-8);
  }
}

function modelPriority(id) {
  const index = VISION_MODEL_PRIORITY.indexOf(id);
  if (index >= 0) return index;
  if (/-pro(?:-|$)/i.test(id)) return 20;
  if (/flash-lite/i.test(id)) return 80;
  if (/flash/i.test(id)) return 50;
  return 100;
}

export function rankVisionModels(models) {
  return (Array.isArray(models) ? models : [])
    .filter(model => model && model.id && /^gemini-/i.test(model.id))
    .slice()
    .sort((a, b) => modelPriority(a.id) - modelPriority(b.id) || a.name.localeCompare(b.name))
    .map((model, index) => ({
      ...model,
      rank: index + 1,
      tierLabel: index === 0 ? 'Highest capability' :
        /flash-lite/i.test(model.id) ? 'Economy / low-latency' :
          /pro/i.test(model.id) ? 'Advanced reasoning' : 'Balanced multimodal'
    }));
}

export function getTranscriptionModelOrder() {
  const first = LOW_COST_TRANSCRIPTION_MODELS[transcriptionRotation % LOW_COST_TRANSCRIPTION_MODELS.length];
  transcriptionRotation = (transcriptionRotation + 1) % LOW_COST_TRANSCRIPTION_MODELS.length;
  return [first, ...LOW_COST_TRANSCRIPTION_MODELS.filter(model => model !== first), ...HIGHER_COST_TRANSCRIPTION_FALLBACKS];
}

export async function listGeminiModels(apiKey) {
  if (!apiKey) throw new Error('Gemini API key is not configured. Add a key in Admin or configure the Worker secret.');
  const tag = await fingerprint(apiKey);
  if (modelCache.tag === tag && modelCache.expiresAt > Date.now() && modelCache.models.length) return modelCache.models;
  const models = [];
  let pageToken = '';
  for (let page = 0; page < 3; page += 1) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { 'x-goog-api-key': apiKey } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Could not retrieve Gemini models.');
    models.push(...(data.models || []));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  const ranked = rankVisionModels(models
    .filter(model => model.name && model.supportedGenerationMethods?.includes('generateContent'))
    // This application analyses camera photos. Image-output, TTS, audio-only,
    // video, embedding and robotics models are not compatible with that task.
    .filter(model => !/(embedding|tts|live|image|imagen|veo|lyria|transcrib|audio|robotics)/i.test(model.name))
    .map(model => ({
      id: String(model.name).replace(/^models\//, ''),
      name: model.displayName || String(model.name).replace(/^models\//, ''),
      description: model.description || '',
      inputTokenLimit: model.inputTokenLimit || null,
      outputTokenLimit: model.outputTokenLimit || null,
      supportsThinking: Boolean(model.thinking)
    })));
  modelCache = { tag, expiresAt: Date.now() + 5 * 60 * 1000, models: ranked };
  return ranked;
}

async function modelCandidates(apiKey, selectedModel) {
  let available = [];
  try { available = await listGeminiModels(apiKey); } catch { /* Use known fallbacks if catalogue lookup is unavailable. */ }
  const availableIds = available.map(model => model.id);
  const base = availableIds.length ? availableIds : [selectedModel, ...STATIC_VISION_FALLBACKS];
  const unique = [...new Set([selectedModel, ...base].filter(Boolean))];
  const selectedIndex = Math.max(0, unique.indexOf(selectedModel));
  const startIndex = (selectedIndex + visionRotation) % unique.length;
  visionRotation = (visionRotation + 1) % Math.max(1, unique.length);
  return unique.slice(startIndex).concat(unique.slice(0, startIndex));
}

async function askGemini({ image, prompt, model, waitSeconds }, apiKey) {
  if (!apiKey) throw new Error('Gemini is selected but no API key is available. Add your own key in Admin or configure the Worker secret.');
  const selectedModel = String(model || 'gemini-3.8-flash').replace(/^models\//, '');
  const timeoutSeconds = Math.max(15, Math.min(180, Number(waitSeconds) || 120));
  const candidates = (await modelCandidates(apiKey, selectedModel)).slice(0, 5);
  const attempted = [];
  let lastFailure = '';
  for (const candidate of candidates) {
    attempted.push(candidate);
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(candidate) + ':generateContent';
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
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(Math.min(timeoutSeconds, 45) * 1000)
        });
      } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          lastFailure = 'Model ' + candidate + ' timed out.';
          break;
        }
        lastFailure = 'Could not reach Gemini: ' + (error.message || 'network error');
        break;
      }
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const answer = (data?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
        if (!answer) {
          lastFailure = 'Gemini model ' + candidate + ' returned no readable answer.';
          break;
        }
        return { answer, model: candidate, attempted };
      }
      const message = data?.error?.message || 'Gemini request failed.';
      if (response.status === 503 && attempt === 0) {
        await wait(900);
        continue;
      }
      if (response.status === 429 || response.status === 404 || response.status === 503 || response.status === 504) {
        lastFailure = candidate + ': ' + message;
        break;
      }
      if ((response.status === 400 || response.status === 403) && /model|not available|not supported|permission|billing|access/i.test(message)) {
        lastFailure = candidate + ': ' + message;
        break;
      }
      if (response.status === 401 || response.status === 403) throw new Error('Gemini rejected this API key. Check that the key is valid and its API access is enabled.');
      throw new Error(message.slice(0, 300));
    }
  }
  throw new Error('Automatic model fallback tried ' + attempted.join(', ') + '. ' +
    (lastFailure || 'No compatible model completed the request.') +
    ' Google may have exhausted the project-wide quota; changing models cannot bypass a project-wide daily limit. Try your own Gemini key in Admin or wait for Google quota reset.');
}

async function transcribeGemini(audio, apiKey) {
  if (!apiKey) throw new Error('No Gemini API key is available for voice transcription. Add one in Admin.');
  if (typeof audio !== 'string' || audio.length > 2_800_000) throw new Error('Voice recording is too large. Please speak a shorter question.');
  const part = audioParts(audio);
  const prompt = [
    'Transcribe the spoken question and return only the final question in English.',
    'Detect the language from the words that were actually spoken, not from the speaker’s accent.',
    'If the speaker uses Bengali/Bangla, translate it faithfully into natural English.',
    'If the speaker uses English, including English spoken with a Bangladeshi accent, preserve the English meaning and do not translate it.',
    'For mixed Bengali and English, translate Bengali portions and return one clear English question.',
    'Do not add explanations, labels, quotation marks, or commentary. Do not invent words that are unclear.'
  ].join(' ');
  const candidates = getTranscriptionModelOrder();
  const attempted = [];
  let lastFailure = '';
  for (const candidate of candidates) {
    attempted.push(candidate);
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(candidate) + ':generateContent';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: part }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0 }
        }),
        signal: AbortSignal.timeout(35_000)
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const transcript = (data?.candidates?.[0]?.content?.parts || []).map(item => item.text || '').join('').trim();
        if (transcript) return { transcript, model: candidate, attempted };
        lastFailure = candidate + ' returned an empty transcript.';
        continue;
      }
      const message = data?.error?.message || 'Transcription failed.';
      if ([400, 403, 404, 429, 503, 504].includes(response.status)) {
        lastFailure = candidate + ': ' + message;
        continue;
      }
      throw new Error(message.slice(0, 300));
    } catch (error) {
      lastFailure = error.message || 'Audio transcription failed.';
      if (/API key|fetch failed|network/i.test(lastFailure)) throw error;
    }
  }
  throw new Error('Gemini could not transcribe this recording using the low-cost speech model and fallbacks. ' + lastFailure);
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
  const apiKey = providerKey(request, env);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const supportedMode = mode === 'gemini' || mode === 'mock';
    return json({
      ok: supportedMode,
      mode,
      model: mode === 'gemini' ? model : null,
      apiKeyConfigured: Boolean(apiKey),
      usingPersonalKey: hasPersonalKey(request),
      providerConfigured: mode === 'gemini' && Boolean(apiKey),
      sosRelayConfigured: Boolean(env.SOS_ROOM && env.SOS_DIRECTORY),
      mockModeExplicitlyEnabled: mode === 'mock',
      message: !supportedMode
        ? 'Unsupported AI_MODE "' + mode + '". Use "gemini" or explicitly "mock".'
        : mode === 'gemini'
          ? (apiKey ? 'Gemini mode selected; a provider key is available.' : 'Gemini mode selected, but no API key is available.')
          : 'Mock mode explicitly enabled; no live image analysis.'
    }, supportedMode ? 200 : 503);
  }

  if (!url.pathname.startsWith('/api/')) return null;

  const origin = request.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).origin !== url.origin) return json({ error: 'Cross-origin API requests are not allowed.' }, 403); }
    catch { return json({ error: 'Invalid request origin.' }, 403); }
  }

  const receiverActions = {
    '/api/sos/pair': 'pair',
    '/api/sos/poll': 'poll',
    '/api/sos/ack': 'ack'
  };
  if (request.method === 'POST' && receiverActions[url.pathname]) {
    return forwardSos(request, env, receiverActions[url.pathname]);
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
      return json({
        ok: true,
        models: await listGeminiModels(apiKey),
        configuredModel: model,
        usingPersonalKey: hasPersonalKey(request),
        rotationEnabled: true
      });
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

  if (request.method === 'POST' && url.pathname === '/api/transcribe') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Recording data must be valid JSON.' }, 400); }
    if (typeof body.audio !== 'string' || !/^data:audio\//i.test(body.audio)) return json({ error: 'A recorded audio data URL is required.' }, 400);
    if (body.audio.length > 2_800_000) return json({ error: 'Voice recording is too long. Please speak a shorter question.' }, 413);
    try {
      const result = await transcribeGemini(body.audio, apiKey);
      return json({ ok: true, transcript: result.transcript, model: result.model, attemptedModels: result.attempted });
    } catch (error) {
      return json({ error: error.message || 'Voice transcription failed.' }, 502);
    }
  }

  if (request.method === 'POST' && ['/api/describe', '/api/ask'].includes(url.pathname)) {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const invalid = validPayload(body);
    if (invalid) return json({ error: invalid }, 400);
    const action = url.pathname.endsWith('/ask') ? 'ask' : 'describe';
    if (!body.image) return json({ error: 'A camera image is required for this endpoint.' }, 400);
    if (action === 'ask' && !body.question?.trim()) return json({ error: 'Please provide a question.' }, 400);
    if (mode !== 'gemini' && mode !== 'mock') return json({ error: 'Unsupported AI_MODE "' + mode + '".' }, 503);
    const selectedModel = String(body.model || model).replace(/^models\//, '');
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
        const result = await askGemini({ image: body.image, prompt, model: selectedModel, waitSeconds }, apiKey);
        return json({
          ok: true, mock: false, provider: 'Gemini',
          model: result.model, attemptedModels: result.attempted,
          answer: result.answer,
          disclaimer: 'AI can miss objects and hazards. Do not rely on this description alone for mobility or safety decisions.'
        });
      } catch (error) {
        return json({ error: error.message || 'Gemini request failed.' }, 502);
      }
    }
    return json({
      ok: true, mock: true,
      answer: action === 'ask'
        ? 'Mock mode: I received your question: "' + body.question.trim() + '". No image analysis was performed.'
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