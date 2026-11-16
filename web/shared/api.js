const TOKEN_KEY = 'daredevils-eye.api-token.session.v1';

export function getAccessToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function clearAccessToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}
export async function verifyAccessToken(token) {
  const response = await fetch('/api/session', {
    method: 'GET',
    headers: { authorization: 'Bearer ' + String(token || '') },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.authenticated) throw new Error(data.error || 'The app access token was rejected.');
  return true;
}
export async function saveAccessToken(token) {
  const value = String(token || '').trim();
  if (value.length < 32) throw new Error('The app access token must be at least 32 characters.');
  await verifyAccessToken(value);
  try { sessionStorage.setItem(TOKEN_KEY, value); }
  catch { throw new Error('This browser does not allow session storage. Enable site storage and try again.'); }
}
export async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('Unlock this private app first at /access/.');
  const headers = new Headers(options.headers || {});
  headers.set('authorization', 'Bearer ' + token);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  if (response.status === 401) {
    clearAccessToken();
    throw new Error('Your app session is no longer valid. Unlock the app again at /access/.');
  }
  return response;
}
export async function requestAI(path, payload = {}) {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Backend returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error || ('Backend error ' + response.status + '.'));
  return data;
}
