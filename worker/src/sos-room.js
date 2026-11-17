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
function concatBytes(...chunks) {
  const length=chunks.reduce((sum,chunk)=>sum+chunk.length,0);
  const output=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}
  return output;
}
async function hmacSha256(keyBytes,dataBytes) {
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,dataBytes));
}
async function hkdfExpand(prk,info,length) {
  let previous=new Uint8Array(0),output=new Uint8Array(0),counter=1;
  while(output.length<length){
    previous=await hmacSha256(prk,concatBytes(previous,info,Uint8Array.of(counter)));
    output=concatBytes(output,previous);
    counter+=1;
  }
  return output.slice(0,length);
}
async function encryptWebPushPayload(subscription,payloadText) {
  const uaPublicBytes=decodeBase64Url(subscription.keys?.p256dh||'');
  const authSecret=decodeBase64Url(subscription.keys?.auth||'');
  if(uaPublicBytes.length!==65||uaPublicBytes[0]!==4||authSecret.length!==16){
    throw new Error('Invalid Web Push subscription keys.');
  }
  const uaPublicKey=await crypto.subtle.importKey(
    'raw',uaPublicBytes,{name:'ECDH',namedCurve:'P-256'},false,[]
  );
  const appPair=await crypto.subtle.generateKey(
    {name:'ECDH',namedCurve:'P-256'},true,['deriveBits']
  );
  const appPublicBytes=new Uint8Array(await crypto.subtle.exportKey('raw',appPair.publicKey));
  const sharedSecret=new Uint8Array(await crypto.subtle.deriveBits(
    {name:'ECDH',public:uaPublicKey},appPair.privateKey,256
  ));
  const keyInfo=concatBytes(
    encoder.encode('WebPush: info'),Uint8Array.of(0),uaPublicBytes,appPublicBytes
  );
  const authPrk=await hmacSha256(authSecret,sharedSecret);
  const inputKeyingMaterial=await hkdfExpand(authPrk,keyInfo,32);

  const salt=crypto.getRandomValues(new Uint8Array(16));
  const contentPrk=await hmacSha256(salt,inputKeyingMaterial);
  const cek=await hkdfExpand(
    contentPrk,concatBytes(encoder.encode('Content-Encoding: aes128gcm'),Uint8Array.of(0)),16
  );
  const nonce=await hkdfExpand(
    contentPrk,concatBytes(encoder.encode('Content-Encoding: nonce'),Uint8Array.of(0)),12
  );
  // RFC 8291 final-record delimiter is 0x02; AES-GCM appends the 16-byte tag.
  const plaintext=concatBytes(encoder.encode(payloadText),Uint8Array.of(2));
  const aesKey=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']);
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM',iv:nonce,tagLength:128},aesKey,plaintext
  ));
  const rs=Uint8Array.of(0,0,16,0); // 4096 bytes, network byte order.
  const header=concatBytes(salt,rs,Uint8Array.of(appPublicBytes.length),appPublicBytes);
  return concatBytes(header,ciphertext);
}
function isSupportedPushEndpoint(value) {
  try {
    const endpoint = new URL(String(value || ''));
    const host = endpoint.hostname.toLowerCase();
    const supportedHost =
      host === 'fcm.googleapis.com' ||
      host === 'updates.push.services.mozilla.com' ||
      host.endsWith('.push.services.mozilla.com') ||
      host === 'web.push.apple.com' ||
      host.endsWith('.notify.windows.com');
    return endpoint.protocol === 'https:' &&
      supportedHost &&
      !endpoint.username &&
      !endpoint.password &&
      (!endpoint.port || endpoint.port === '443');
  } catch {
    return false;
  }
}

function isValidSubscriptionKeys(keys) {
  try {
    const publicKey=decodeBase64Url(keys?.p256dh||'');
    const auth=decodeBase64Url(keys?.auth||'');
    return publicKey.length===65&&publicKey[0]===4&&auth.length===16;
  } catch {
    return false;
  }
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
      if (!isSupportedPushEndpoint(subscription.endpoint)) return { attempted: false, success: false, reason: 'unsupported_push_endpoint' };
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
      const encryptedBody=await encryptWebPushPayload(
        subscription,
        'An SOS alert may need your attention. Open Daredevil’s Eye to review it.'
      );
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          Authorization: authorization,
          TTL: '120',
          Urgency: 'high',
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream'
        },
        body: encryptedBody
      });
      if (response.status === 404 || response.status === 410) await this.state.storage.delete('pushSubscription');
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
          ? 'SOS is stored and the push service accepted the notification request. The alert may already have reached the other phone, but this app cannot verify whether it was displayed.'
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
          subscription.endpoint.length>2048 ||
          !isSupportedPushEndpoint(subscription.endpoint) ||
          !isValidSubscriptionKeys(subscription.keys)) {
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
