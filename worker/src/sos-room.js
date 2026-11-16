const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const DEVICE_ID = /^[a-f0-9]{32}$/;
const encoder = new TextEncoder();

async function hashSecret(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}

export class SOSRoom {
  constructor(state) {
    this.state = state;
    this.serial = Promise.resolve();
  }

  fetch(request) {
    const task = this.serial.then(() => this.handle(request), () => this.handle(request));
    this.serial = task.catch(() => {});
    return task;
  }

  async handle(request) {
    if (request.method !== 'POST') return json({ ok: false, error: 'POST required.' }, 405);
    const action = new URL(request.url).pathname.replace(/^\/+/, '');
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

    if (action === 'revoke') {
      await this.state.storage.delete('receiverTokenHash');
      await this.state.storage.delete('activeEvent');
      await this.state.storage.put('pairedAt', null);
      return json({ ok: true, revoked: true });
    }

    if (action === 'pair') {
      const receiverToken = await randomToken();
      await this.state.storage.put('receiverTokenHash', await hashSecret(receiverToken));
      await this.state.storage.put('pairedAt', Date.now());
      await this.state.storage.delete('activeEvent');
      return json({ ok: true, paired: true, receiverToken, message: 'Receiver paired. The previous receiver session has been replaced.' });
    }

    const token = String(body.receiverToken || '');
    const expectedHash = await this.state.storage.get('receiverTokenHash');
    if (!expectedHash || !safeEqual(await hashSecret(token), expectedHash)) {
      return json({ ok: false, error: 'This receiver session has been replaced or revoked. Pair again using a new invitation.' }, 403);
    }

    if (action === 'poll') {
      const event = await this.state.storage.get('activeEvent');
      if (!event || !event.active || event.expiresAt <= Date.now()) {
        if (event?.active) await this.state.storage.put('activeEvent', { ...event, active: false, expired: true });
        return json({ ok: true, paired: true, active: false, event: null });
      }
      return json({ ok: true, paired: true, active: true, event });
    }

    if (action === 'ack') {
      const event = await this.state.storage.get('activeEvent');
      if (!event || !event.active) return json({ ok: true, acknowledged: false, message: 'There is no active alert.' });
      if (body.eventId && body.eventId !== event.id) return json({ ok: false, error: 'This alert has changed. Refresh the receiver.' }, 409);
      await this.state.storage.put('activeEvent', { ...event, active: false, acknowledgedAt: Date.now() });
      return json({ ok: true, acknowledged: true, message: 'Emergency alert acknowledged.' });
    }

    if (action === 'trigger') {
      const now = Date.now();
      const event = {
        id: crypto.randomUUID(),
        createdAt: now,
        expiresAt: now + 10 * 60 * 1000,
        active: true,
        message: 'Emergency alert. Someone may be in danger. Please check immediately.'
      };
      await this.state.storage.put('activeEvent', event);
      return json({ ok: true, sent: true, eventId: event.id, message: 'Emergency alert sent to the paired receiver.' });
    }

    return json({ ok: false, error: 'Unknown SOS action.' }, 404);
  }
}
