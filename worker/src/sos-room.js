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
function base64Url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function decodeBase64Url(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(value).length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
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

  async alarm() {
    const event = await this.state.storage.get('activeEvent');
    if (event?.active && event.expiresAt <= Date.now()) await this.state.storage.delete('activeEvent');
  }

  async getVapidKeys() {
    let saved = await this.state.storage.get('vapidKeys');
    if (!saved) {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
      const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
      const publicBytes = new Uint8Array(65);
      publicBytes[0] = 4;
      publicBytes.set(decodeBase64Url(publicJwk.x), 1);
      publicBytes.set(decodeBase64Url(publicJwk.y), 33);
      saved = { publicJwk, privateJwk, publicKey: base64Url(publicBytes) };
      await this.state.storage.put('vapidKeys', saved);
    }
    return saved;
  }

  async sendPush(subscription) {
    if (!subscription?.endpoint) return { attempted: false, success: false, reason: 'no_subscription' };
    try {
      const keys = await this.getVapidKeys();
      const endpoint = new URL(subscription.endpoint);
      const now = Math.floor(Date.now() / 1000);
      const header = base64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
      const payload = base64Url(encoder.encode(JSON.stringify({
        aud: endpoint.origin,
        exp: now + 12 * 60 * 60,
        sub: 'https://daredevils-eye.karanjoykundu.workers.dev'
      })));
      const unsignedToken = header + '.' + payload;
      const privateKey = await crypto.subtle.importKey(
        'jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
      );
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(unsignedToken)
      );
      const authorization = 'vapid t=' + unsignedToken + '.' + base64Url(signature) + ', k=' + keys.publicKey;
      // Empty payloads require no Web Push content encryption. The service
      // worker displays a generic urgent notification, then the receiver
      // page retrieves the event over its authenticated poll endpoint.
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: { Authorization: authorization, TTL: '120', Urgency: 'high' },
        body: ''
      });
      return { attempted: true, success: response.ok, status: response.status };
    } catch {
      return { attempted: true, success: false, reason: 'push_request_failed' };
    }
  }

  async handle(request) {
    if (request.method !== 'POST') return json({ ok: false, error: 'POST required.' }, 405);
    const action = new URL(request.url).pathname.replace(/^\/+/, '');
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

    if (action === 'push-key') {
      const keys = await this.getVapidKeys();
      return json({ ok: true, applicationServerKey: keys.publicKey });
    }

    if (action === 'revoke') {
      await this.state.storage.delete('receiverTokenHash');
      await this.state.storage.delete('activeEvent');
      await this.state.storage.delete('pushSubscription');
      await this.state.storage.put('pairedAt', null);
      return json({ ok: true, revoked: true });
    }

    if (action === 'pair') {
      const receiverToken = await randomToken();
      await this.state.storage.put('receiverTokenHash', await hashSecret(receiverToken));
      await this.state.storage.put('pairedAt', Date.now());
      await this.state.storage.delete('activeEvent');
      await this.state.storage.delete('pushSubscription');
      return json({ ok: true, paired: true, receiverToken, message: 'Receiver paired. The previous receiver session has been replaced.' });
    }

    if (action === 'trigger') {
      const receiverTokenHash = await this.state.storage.get('receiverTokenHash');
      if (!receiverTokenHash) return json({ ok: false, error: 'No receiver is paired. Generate an invitation and pair a phone first.' }, 409);
      const now = Date.now();
      const event = {
        id: crypto.randomUUID(),
        createdAt: now,
        expiresAt: now + 10 * 60 * 1000,
        active: true,
        message: 'Emergency alert. Someone may be in danger. Please check immediately.'
      };
      await this.state.storage.put('activeEvent', event);
      await this.state.storage.setAlarm(event.expiresAt);
      const subscription = await this.state.storage.get('pushSubscription');
      const push = await this.sendPush(subscription);
      return json({
        ok: true, queued: true, eventId: event.id,
        notificationAttempted: push.attempted,
        notificationAccepted: push.success,
        message: push.success
          ? 'SOS is stored and the push service accepted a notification request. This does not confirm that the receiver displayed it.'
          : 'SOS is stored, but no push notification was accepted. The receiver must reconnect and poll to see the alert.'
      });
    }

    const token = String(body.receiverToken || '');
    const expectedHash = await this.state.storage.get('receiverTokenHash');
    if (!expectedHash || !safeEqual(await hashSecret(token), expectedHash)) {
      return json({ ok: false, error: 'This receiver session has been replaced or revoked. Pair again using a new invitation.' }, 403);
    }

    if (action === 'subscribe') {
      const subscription = body.subscription;
      if (!subscription || typeof subscription.endpoint !== 'string' ||
          !subscription.endpoint.startsWith('https://') ||
          typeof subscription.keys?.p256dh !== 'string' ||
          typeof subscription.keys?.auth !== 'string') {
        return json({ ok: false, error: 'A valid browser push subscription is required.' }, 400);
      }
      await this.state.storage.put('pushSubscription', {
        endpoint: subscription.endpoint.slice(0, 2048),
        expirationTime: subscription.expirationTime || null,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
      });
      return json({ ok: true, pushSubscribed: true, message: 'Receiver push subscription saved.' });
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

    return json({ ok: false, error: 'Unknown SOS action.' }, 404);
  }
}
