const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const DEVICE_ID = /^[a-f0-9]{32}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols; excludes confusing I, O, 0 and 1.
const encoder = new TextEncoder();

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function randomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => CODE_ALPHABET[byte & 31]).join('');
}

export class SOSDirectory {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.serial = Promise.resolve();
  }

  fetch(request) {
    const task = this.serial.then(() => this.handle(request), () => this.handle(request));
    this.serial = task.catch(() => {});
    return task;
  }

  async room(deviceId, action, body = {}) {
    const id = this.env.SOS_ROOM.idFromName(deviceId);
    return this.env.SOS_ROOM.get(id).fetch(new Request('https://sos-room.internal/' + action, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    }));
  }

  async handle(request) {
    if (request.method !== 'POST') return json({ ok: false, error: 'POST required.' }, 405);
    const action = new URL(request.url).pathname.replace(/^\/+/, '');
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

    if (action === 'invite') {
      const deviceId = String(body.deviceId || '').toLowerCase();
      if (!DEVICE_ID.test(deviceId)) return json({ ok: false, error: 'Invalid sender device identity.' }, 400);
      const previousHash = await this.state.storage.get('current:' + deviceId);
      if (previousHash) await this.state.storage.delete('invite:' + previousHash);
      // A new invite immediately revokes the previously paired receiver.
      await this.room(deviceId, 'revoke');
      const code = randomCode();
      const codeHash = await hash(code);
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await this.state.storage.put('invite:' + codeHash, { deviceId, expiresAt, attempts: 0 });
      await this.state.storage.put('current:' + deviceId, codeHash);
      return json({ ok: true, code, expiresAt, expiresInSeconds: 600, message: 'New six-character invitation created. Any previous receiver has been disconnected.' });
    }

    if (action === 'pair') {
      const code = String(body.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) return json({ ok: false, error: 'Enter the six-character SOS code.' }, 400);
      const ip = request.headers.get('cf-connecting-ip') || 'local-development';
      const ipHash = await hash(ip);
      const minuteBucket = Math.floor(Date.now() / 60000);
      const attemptsKey = 'attempts:' + ipHash + ':' + minuteBucket;
      const attempts = (await this.state.storage.get(attemptsKey)) || 0;
      if (attempts >= 8) return json({ ok: false, error: 'Too many pairing attempts. Wait one minute and try again.' }, 429);
      await this.state.storage.put(attemptsKey, attempts + 1, { expirationTtl: 120 });

      const codeHash = await hash(code);
      const inviteKey = 'invite:' + codeHash;
      const invite = await this.state.storage.get(inviteKey);
      if (!invite || invite.expiresAt <= Date.now()) {
        if (invite) await this.state.storage.delete(inviteKey);
        return json({ ok: false, error: 'Invitation is invalid, expired, or already used. Ask the sender to generate a new code.' }, 404);
      }

      // Consume the invitation before issuing a receiver token: codes are single-use.
      await this.state.storage.delete(inviteKey);
      await this.state.storage.delete('current:' + invite.deviceId);
      const response = await this.room(invite.deviceId, 'pair');
      const result = await response.json();
      if (!response.ok || !result.receiverToken) return json({ ok: false, error: result.error || 'Could not pair receiver.' }, response.status || 502);
      return json({
        ok: true, paired: true,
        deviceId: invite.deviceId,
        receiverToken: result.receiverToken,
        message: 'Receiver paired. The previous receiver session is invalidated.'
      });
    }

    return json({ ok: false, error: 'Unknown SOS directory action.' }, 404);
  }
}
