const KEY = 'daredevils-eye.device-settings.v1';

function createDeviceId() {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random number generation is unavailable in this browser.');
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

const DEFAULTS = Object.freeze({
  cameraBaseUrl: 'http://192.168.0.100',
  cameraSource: 'upload',
  cameraSetupComplete: false,
  phoneCameraFacingMode: 'environment',
  sceneMemoryEnabled: false,
  captureCount: 3,
  requirePhotoConfirmation: true,
  savePhotoHistory: true,
  speechLanguage: 'bn-BD',
  speechInputMode: 'auto',
  speechInputLanguage: 'bn-BD',
  sosShakeEnabled: false,
  sosVoiceEnabled: false,
  sosVoiceLanguage: 'bn-BD',
  speechRate: 0.96,
  speechPitch: 1.08,
  speechPreset: 'gentle',
  speechVoiceURI: '',
  speechEngine: 'device',
  geminiTtsVoice: 'Kore',
  geminiTtsStyle: 'Warm, calm, gentle, clear and friendly.',
  deviceId: '',
  emergencyName: '',
  emergencyPhone: '',
  customPrompt: '',
  aiModel: 'gemini-3.8-flash',
  waitSeconds: 120,
  responseStyle: 'concise',
  consentAccepted: false
});

export function normalizeCameraAddress(value) {
  let address = String(value || '').trim();
  if (!address) address = DEFAULTS.cameraBaseUrl;
  if (!/^https?:\/\//i.test(address)) address = 'http://' + address;
  return address.replace(/\/+$/, '');
}

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const merged = { ...DEFAULTS, ...saved };
    if (merged.aiModel === 'gemini-3.6-flash') merged.aiModel = 'gemini-3.8-flash';
    if (!merged.deviceId) merged.deviceId = createDeviceId();
    if (!merged.cameraBaseUrl || ['http://192.168.4.1', '192.168.0.104', 'http://192.168.0.104'].includes(merged.cameraBaseUrl)) merged.cameraBaseUrl = DEFAULTS.cameraBaseUrl;
    merged.cameraBaseUrl = normalizeCameraAddress(merged.cameraBaseUrl);
    localStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return { ...DEFAULTS, cameraBaseUrl: DEFAULTS.cameraBaseUrl };
  }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  if ('cameraBaseUrl' in patch) next.cameraBaseUrl = normalizeCameraAddress(patch.cameraBaseUrl);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSettings() { localStorage.removeItem(KEY); }
export { DEFAULTS };
