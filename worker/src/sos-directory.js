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

  async alarm() {
    const now = Date.now();
    const invites = await this.state.storage.list({ prefix: 'invite:' });
    let nextAlarm = null;
    for (const [key, invite] of invites) {
      if (invite.expiresAt <= now) {
        await this.state.storage.delete(key);
        const codeHash = key.slice('invite:'.length);
        const currentKey = 'current:' + invite.deviceId;
        if (await this.state.storage.get(currentKey) === codeHash) await this.state.storage.delete(currentKey);
      } else if (nextAlarm === null || invite.expiresAt < nextAlarm) {
        nextAlarm = invite.expiresAt;
      }
    }
    const attempts = await this.state.storage.list({ prefix: 'attempts:' });
    for (const [key, record] of attempts) {
      if (now - record.windowStartedAt > 120000) await this.state.storage.delete(key);
      else {
        const expiry = record.windowStartedAt + 120000;
        if (nextAlarm === null || expiry < nextAlarm) nextAlarm = expiry;
      }
    }
    if (nextAlarm !== null) await this.state.storage.setAlarm(nextAlarm);
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
      await this.state.storage.setAlarm(expiresAt);
      return json({ ok: true, code, expiresAt, expiresInSeconds: 600, message: 'New six-character invitation created. Any previous receiver has been disconnected.' });
    }

    if (action === 'pair') {
      const code = String(body.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) return json({ ok: false, error: 'Enter the six-character SOS code.' }, 400);
      const ip = request.headers.get('cf-connecting-ip') || 'local-development';
      const ipHash = await hash(ip);
      const now = Date.now();
      const attemptsKey = 'attempts:' + ipHash;
      let attemptRecord = await this.state.storage.get(attemptsKey);
      if (!attemptRecord || now - attemptRecord.windowStartedAt >= 60000) {
        attemptRecord = { windowStartedAt: now, count: 0 };
      }
      if (attemptRecord.count >= 8) return json({ ok: false, error: 'Too many pairing attempts. Wait one minute and try again.' }, 429);
      await this.state.storage.put(attemptsKey, { ...attemptRecord, count: attemptRecord.count + 1 });
      // Keep only recent attempt buckets so the directory does not grow forever.
      if (attemptRecord.count % 4 === 0) {
        const oldAttempts = await this.state.storage.list({ prefix: 'attempts:' });
        for (const [key, value] of oldAttempts) {
          if (now - value.windowStartedAt > 120000) await this.state.storage.delete(key);
        }
      }

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
