const KEY = 'daredevils-eye.device-settings.v1';
const DEFAULTS = Object.freeze({ cameraBaseUrl: 'http://192.168.4.1', captureCount: 3, speechLanguage: 'en-US', speechRate: 1, emergencyName: '', emergencyPhone: '', consentAccepted: false });
export function getSettings() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } }
export function saveSettings(patch) { const next = { ...getSettings(), ...patch }; localStorage.setItem(KEY, JSON.stringify(next)); return next; }
export function clearSettings() { localStorage.removeItem(KEY); }
export { DEFAULTS };