const KEY = 'daredevils-eye.device-settings.v1';
const DEFAULTS = Object.freeze({ cameraBaseUrl: 'http://192.168.0.104', captureCount: 3, speechLanguage: 'en-US', speechRate: 1, emergencyName: '', emergencyPhone: '', customPrompt: '', consentAccepted: false });
export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Migrate the original ESP32-CAM default to the user's confirmed LAN address.
    if (saved.cameraBaseUrl === 'http://192.168.4.1') saved.cameraBaseUrl = DEFAULTS.cameraBaseUrl;
    return { ...DEFAULTS, ...saved };
  } catch { return { ...DEFAULTS }; }
}
export function saveSettings(patch) { const next = { ...getSettings(), ...patch }; localStorage.setItem(KEY, JSON.stringify(next)); return next; }
export function clearSettings() { localStorage.removeItem(KEY); }
export { DEFAULTS };
