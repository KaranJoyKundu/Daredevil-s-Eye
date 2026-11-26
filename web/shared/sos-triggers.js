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
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function matchSosVoiceCommand(transcript, phase = 'wake') {
  const text = normaliseTranscript(transcript);
  if (!text) return null;
  const hasSos = text.includes('sos') || text.includes('এসওএস');
  const hasCancel = text.includes('cancel') || text.includes('stop') || text.includes('বাতিল');
  if (hasCancel && (hasSos || text.includes('emergency') || text.includes('করুন'))) return 'cancel';
  if (phase === 'cancel') return null;
  if (phase === 'confirm') {
    const englishConfirm = text.split(' ').some(word => ['confirm','send','yes'].includes(word)) && (hasSos || text.includes('emergency'));
    const banglaConfirm = text.includes('নিশ্চিত') || (hasSos && (text.includes('পাঠান') || text.includes('হ্যাঁ')));
    return englishConfirm || banglaConfirm ? 'confirm' : null;
  }
  // One SOS utterance is enough to start the spoken cancellation countdown.
  const englishWake = hasSos && (text.includes('daredevil') || text.includes('dare devil') || text.includes('emergency') || text.includes('help'));
  const banglaWake = hasSos || text.includes('সাহায্য') || text.includes('জরুরি');
  return englishWake || banglaWake ? 'wake' : null;
}
