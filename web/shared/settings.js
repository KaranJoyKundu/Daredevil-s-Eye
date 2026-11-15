const KEY = 'daredevils-eye.device-settings.v1';
const DEFAULTS = Object.freeze({ cameraBaseUrl: 'http://192.168.0.104', captureCount: 3, speechLanguage: 'en-US', speechRate: 1, emergencyName: '', emergencyPhone: '', customPrompt: '', consentAccepted: false });
function normalizeCameraAddress(value) {
  let address = String(value || '').trim();
  if (address && !/^https?:\/\//i.test(address)) address = 'http://' + address;
  return address.replace(/\/+$/, '');
}
export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved.cameraBaseUrl === 'http://192.168.4.1' || saved.cameraBaseUrl === '192.168.0.104') saved.cameraBaseUrl = DEFAULTS.cameraBaseUrl;
    return { ...DEFAULTS, ...saved, cameraBaseUrl: normalizeCameraAddress(saved.cameraBaseUrl || DEFAULTS.cameraBaseUrl) };
  } catch { return { ...DEFAULTS }; }
}
export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  if ('cameraBaseUrl' in patch) next.cameraBaseUrl = normalizeCameraAddress(patch.cameraBaseUrl);
  localStorage.setItem(KEY, JSON.stringify(next)); return next;
}
export function clearSettings() { localStorage.removeItem(KEY); }
export { DEFAULTS };