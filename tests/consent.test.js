import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCurrentConsent } from '../web/shared/consent.js';

test('the app is always accessible without a consent gate', () => {
  const previous = globalThis.localStorage;
  try {
    delete globalThis.localStorage;
    assert.equal(hasCurrentConsent(), true);
  } finally {
    if (previous !== undefined) Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});
