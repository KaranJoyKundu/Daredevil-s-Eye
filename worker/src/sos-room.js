const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function validCode(value) {
  return typeof value === 'string' && /^[A-Z0-9]{8,20}$/.test(value.trim().toUpperCase());
}

/**
 * Small paired SOS room shared by the sender app and /sos-receiver/.
 * Events expire after ten minutes and contain no camera images or personal data.
 * The first receiver to pair claims the room code; later clients must match it.
 */
export class SOSRoom {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== 'POST') return json({ ok: false, error: 'POST required.' }, 405);
    const action = new URL(request.url).pathname.replace(/^\//, '');
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const code = String(body.code || '').trim().toUpperCase();
    if (!validCode(code)) return json({ ok: false, error: 'Pairing code must be 8–20 letters or numbers.' }, 400);

    const existingCode = await this.state.storage.get('pairingCode');
    if (action === 'pair') {
      if (existingCode && existingCode !== code) return json({ ok: false, error: 'This SOS room is already paired with a different code. Use the original code or reset the local SOS room.' }, 403);
      if (!existingCode) await this.state.storage.put('pairingCode', code);
      return json({ ok: true, paired: true, message: 'Receiver paired. Keep this page open and the phone awake.' });
    }

    if (!existingCode || existingCode !== code) return json({ ok: false, error: 'SOS receiver is not paired with this code. Open /sos-receiver/ and pair it first.' }, 403);

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

    if (action === 'poll') {
      const event = await this.state.storage.get('activeEvent');
      if (!event || !event.active || event.expiresAt < Date.now()) {
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
