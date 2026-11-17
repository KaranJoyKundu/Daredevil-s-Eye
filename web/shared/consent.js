const CONSENT_KEY = 'daredevils-eye.privacy-consent.v2';
const CONSENT_VERSION = 5;
const SETTINGS_KEY = 'daredevils-eye.device-settings.v1';

export function getConsentRecord() {
  try {
    const record = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    return record && record.version === CONSENT_VERSION && record.accepted === true ? record : null;
  } catch { return null; }
}

export function hasCurrentConsent() {
  let raw;
  try { raw = localStorage.getItem(CONSENT_KEY); } catch { return false; }
  // A prior versioned record exists: do not silently migrate an old boolean
  // after the privacy policy version changes. Require fresh acceptance.
  if (raw !== null) return Boolean(getConsentRecord());
  // One-time migration of the first prototype's legacy accepted boolean.
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (settings.consentAccepted === true) return acceptConsent({ migrated: true });
  } catch {}
  return false;
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
