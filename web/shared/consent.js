const CONSENT_KEY = 'daredevils-eye.privacy-consent.v2';
const CONSENT_VERSION = 5;
const SETTINGS_KEY = 'daredevils-eye.device-settings.v1';
const LEGACY_ACCESS_KEY = 'daredevils-eye.legacy-returning-access.v1';

// Snapshot this before app startup creates fresh default settings for first-time visitors.
const HAD_PREVIOUS_DEVICE_DATA = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return Boolean(saved && typeof saved === 'object' && Object.keys(saved).length);
  } catch { return false; }
})();

export function getConsentRecord() {
  try {
    const record = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    return record && record.version === CONSENT_VERSION && record.accepted === true ? record : null;
  } catch { return null; }
}

export function isGrandfatheredReturningUser() {
  if (HAD_PREVIOUS_DEVICE_DATA) return true;
  try { return localStorage.getItem(LEGACY_ACCESS_KEY) === 'true'; }
  catch { return false; }
}

export function grantLegacyAccountAccess() {
  try { localStorage.setItem(LEGACY_ACCESS_KEY, 'true'); return true; }
  catch { return false; }
}

export function hasCurrentConsent() {
  // The app is always usable. The privacy notice is informational; history saving is optional.
  return true;
}

export function acceptConsent({ migrated = false } = {}) {
  const record = { version: CONSENT_VERSION, accepted: true, acceptedAt: new Date().toISOString(), migrated };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    return Boolean(getConsentRecord());
  } catch { return false; }
}

export function rejectConsent() {
  const record = { version: CONSENT_VERSION, accepted: false, rejected: true, rejectedAt: new Date().toISOString() };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); return true; }
  catch { return false; }
}

export function resetConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    settings.consentAccepted = false;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch { return false; }
}

export const CURRENT_CONSENT_VERSION = CONSENT_VERSION;
