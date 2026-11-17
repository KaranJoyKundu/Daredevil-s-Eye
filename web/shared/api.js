const SESSION_KEY = 'daredevils-eye.personal-gemini-key.v1';

export function getSessionGeminiApiKey() {
  try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
}

export function setSessionGeminiApiKey(value) {
  const key = String(value || '').trim();
  if (!key) throw new Error('Paste a Gemini API key first.');
  if (key.length > 256) throw new Error('The API key looks too long.');
  sessionStorage.setItem(SESSION_KEY, key);
  return true;
}

export function clearSessionGeminiApiKey() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

let accountSessionCheckedAt=0;
let accountSessionRefresh=null;

async function refreshSavedAccountSession() {
  const now=Date.now();
  if(now-accountSessionCheckedAt<5*60*1000)return;
  if(!accountSessionRefresh){
    accountSessionRefresh=fetch('/api/account/session',{
      method:'GET',credentials:'same-origin',cache:'no-store'
    }).catch(()=>null).finally(()=>{
      accountSessionCheckedAt=Date.now();
      accountSessionRefresh=null;
    });
  }
  await accountSessionRefresh;
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const target = String(path);
    // Refresh a returning user's HttpOnly session before the Worker resolves
  if(/^\/api\/(health|models|config|describe|ask|transcribe|speech)$/.test(target)){
    await refreshSavedAccountSession();
  }
  // Never send a personal Gemini key to unrelated paths or SOS endpoints.
  if (/^\/api\/(health|models|config|describe|ask|transcribe|speech)$/.test(target)) {
    const key = getSessionGeminiApiKey();
    if (key) headers.set('x-user-gemini-api-key', key);
  }
  return fetch(path, { ...options, headers, cache: 'no-store' });
}

export async function requestPublic(path, payload = {}) {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Backend returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error || ('Backend error ' + response.status + '.'));
  return data;
}

export const requestAI = requestPublic;