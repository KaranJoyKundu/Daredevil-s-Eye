const GRAVITY = 9.81;
function vectorMagnitude(vector) {
  if (!vector || !Number.isFinite(vector.x) || !Number.isFinite(vector.y) || !Number.isFinite(vector.z)) return null;
  return Math.hypot(vector.x, vector.y, vector.z);
}
export function getShakeMagnitude(event) {
  const linear = vectorMagnitude(event?.acceleration);
  if (linear !== null) return linear;
  const gravity = vectorMagnitude(event?.accelerationIncludingGravity);
  return gravity === null ? 0 : Math.abs(gravity - GRAVITY);
}
export function createShakeSequenceTracker({
  threshold = 12.5, requiredShakes = 3, windowMs = 2600, minIntervalMs = 350
} = {}) {
  let peaks = [], lastPeakAt = -Infinity;
  return {
    push(magnitude, timestamp = Date.now()) {
      if (!Number.isFinite(magnitude) || magnitude < threshold || !Number.isFinite(timestamp)) return false;
      if (timestamp - lastPeakAt < minIntervalMs) return false;
      lastPeakAt = timestamp;
      peaks = peaks.filter(peak => timestamp >= peak && timestamp - peak <= windowMs);
      peaks.push(timestamp);
      if (peaks.length < requiredShakes) return false;
      peaks = [];
      return true;
    },
    reset() { peaks = []; lastPeakAt = -Infinity; },
    get count() { return peaks.length; }
  };
}
function normaliseTranscript(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function matchSosVoiceCommand(transcript, phase = 'wake') {
  const text = normaliseTranscript(transcript);
  if (!text) return null;
  const cancel = ['cancel sos','stop sos','cancel emergency','এসওএস বাতিল','বাতিল করুন'];
  if (cancel.some(phrase => text.includes(phrase))) return 'cancel';
  if (phase === 'cancel') return null;
  if (phase === 'confirm') {
    const confirm = ['confirm sos','send sos','yes send sos','confirm emergency',
      'এসওএস নিশ্চিত করুন','নিশ্চিত করুন','এসওএস পাঠান','হ্যাঁ পাঠান'];
    return confirm.some(phrase => text.includes(phrase)) ? 'confirm' : null;
  }
  const wake = ['daredevil sos','dare devil sos','daredevil s sos','sos sos',
    'ডেয়ারডেভিল এসওএস','ডেয়ার ডেভিল এসওএস','দেয়ারডেভিল এসওএস','ডেয়ারডেভিল সাহায্য'];
  return wake.some(phrase => text.includes(phrase)) ? 'wake' : null;
}
