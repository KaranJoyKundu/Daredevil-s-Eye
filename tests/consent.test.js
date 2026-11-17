import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptConsent, rejectConsent, hasCurrentConsent, getConsentRecord, resetConsent, CURRENT_CONSENT_VERSION } from '../web/shared/consent.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('versioned privacy consent persists across page loads', () => {
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  try {
    assert.equal(hasCurrentConsent(), false);
    assert.equal(acceptConsent(), true);
    assert.equal(hasCurrentConsent(), true);
    assert.equal(getConsentRecord().version, CURRENT_CONSENT_VERSION);
    assert.equal(getConsentRecord().accepted, true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});

test('legacy accepted preference is migrated once', () => {
  const previous = globalThis.localStorage;
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    storage.setItem('daredevils-eye.device-settings.v1', JSON.stringify({ consentAccepted: true }));
    assert.equal(hasCurrentConsent(), true);
    assert.equal(getConsentRecord().migrated, true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});

test('resetting consent makes the notice appear again and disables legacy consent', () => {
  const previous = globalThis.localStorage;
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    acceptConsent();
    assert.equal(hasCurrentConsent(), true);
    assert.equal(resetConsent(), true);
    assert.equal(hasCurrentConsent(), false);
    const settings = JSON.parse(storage.getItem('daredevils-eye.device-settings.v1'));
    assert.equal(settings.consentAccepted, false);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});

test('stale versioned consent is not silently migrated from the legacy flag', () => {
  const previous = globalThis.localStorage;
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    storage.setItem('daredevils-eye.privacy-consent.v2', JSON.stringify({ version: 3, accepted: true }));
    storage.setItem('daredevils-eye.device-settings.v1', JSON.stringify({ consentAccepted: true }));
    assert.equal(hasCurrentConsent(), false);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});

test('rejecting the current terms does not grant access, but later acceptance can', () => {
  const previous = globalThis.localStorage;
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    assert.equal(rejectConsent(), true);
    assert.equal(hasCurrentConsent(), false);
    assert.equal(JSON.parse(storage.getItem('daredevils-eye.privacy-consent.v2')).rejected, true);
    assert.equal(acceptConsent(), true);
    assert.equal(hasCurrentConsent(), true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});
