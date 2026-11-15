export async function requestAI(path, payload = {}) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
  let data;
  try { data = await response.json(); } catch { throw new Error('Backend returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error || ('Backend error ' + response.status + '.'));
  return data;
}
