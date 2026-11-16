export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
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
