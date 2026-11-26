import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../worker/src/index.js';

test('private recording API creates, uploads, completes, plays and deletes an owner-scoped R2 recording', async t => {
  const originalFetch = globalThis.fetch;
  const rows = [];
  const objects = new Map();
  t.after(() => { globalThis.fetch = originalFetch; });
  const bucket = {
    async put(key, value) { objects.set(key, new Uint8Array(value).slice()); },
    async head(key) { return objects.has(key) ? { key } : null; },
    async get(key) {
      const value = objects.get(key);
      return value ? { arrayBuffer: async () => value.slice().buffer } : null;
    },
    async list({ prefix }) { return { objects: [...objects.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })), truncated: false }; },
    async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); }
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.origin === 'https://supabase.example.test' && url.pathname === '/auth/v1/user') {
      return new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }), { status: 200 });
    }
    if (url.origin === 'https://supabase.example.test' && url.pathname === '/rest/v1/emergency_recordings') {
      const method = init.method || 'GET';
      if (method === 'POST') {
        rows.push(JSON.parse(init.body));
        return new Response(null, { status: 201 });
      }
      if (method === 'PATCH') {
        const id = url.searchParams.get('id')?.replace('eq.', '');
        const row = rows.find(item => item.id === id);
        if (row) Object.assign(row, JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.replace('eq.', '');
        const index = rows.findIndex(item => item.id === id);
        if (index >= 0) rows.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error('Unexpected recording test fetch: ' + url.href);
  };
  const env = {
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-public-key',
    SUPABASE_SECRET_KEY: 'sb_secret_test-server-key',
    INCIDENT_RECORDINGS: bucket
  };
  const headers = { Origin: 'https://local.test', Cookie: 'de_access=test-access-token' };
  const deviceId = 'a'.repeat(32);
  const create = await handleApi(new Request('https://local.test/api/recordings', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId, cameraSource: 'phone', mimeType: 'video/webm;codecs=vp8,opus' })
  }), env);
  assert.equal(create.status, 200);
  const created = await create.json();
  assert.ok(created.recordingId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(rows[0].guest_session_hash, null);

  const chunk = await handleApi(new Request('https://local.test/api/recordings/' + created.recordingId + '/chunks/0', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/octet-stream' }, body: new Uint8Array([1, 2, 3, 4])
  }), env);
  assert.equal(chunk.status, 200);
  assert.equal((await chunk.json()).chunkCount, 1);
  assert.equal(objects.size, 1);

  const complete = await handleApi(new Request('https://local.test/api/recordings/' + created.recordingId + '/complete', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ durationSeconds: 5 })
  }), env);
  assert.equal(complete.status, 200);

  const list = await handleApi(new Request('https://local.test/api/recordings', { headers }), env);
  assert.equal((await list.json()).recordings.length, 1);

  const playback = await handleApi(new Request('https://local.test/api/recordings/' + created.recordingId, { headers }), env);
  assert.equal(playback.status, 200);
  assert.equal(playback.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual([...new Uint8Array(await playback.arrayBuffer())], [1, 2, 3, 4]);

  const deleted = await handleApi(new Request('https://local.test/api/recordings/' + created.recordingId, { method: 'DELETE', headers }), env);
  assert.equal(deleted.status, 200);
  assert.equal(rows.length, 0);
  assert.equal(objects.size, 0);
});

test('private recording API rejects cross-origin writes and missing R2 storage', async () => {
  const noBucketEnv = {
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-public-key',
    SUPABASE_SECRET_KEY: 'sb_secret_test-server-key'
  };
  const crossOrigin = await handleApi(new Request('https://local.test/api/recordings', {
    method: 'POST', headers: { Origin: 'https://attacker.test', 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'a'.repeat(32), cameraSource: 'phone', mimeType: 'video/webm' })
  }), noBucketEnv);
  assert.equal(crossOrigin.status, 403);
});
