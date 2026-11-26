import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync(new URL('../web/shared/camera-manager.js', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../web/shared/settings.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/shared/app.js', import.meta.url), 'utf8');
const action = readFileSync(new URL('../web/action/index.html', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../web/admin/index.html', import.meta.url), 'utf8');

test('camera settings default to the current user-supplied ESP32 IP and remain per-device', () => {
  assert.match(settings, /cameraBaseUrl: 'http:\/\/192\.168\.0\.100'/);
  assert.match(settings, /cameraSource: 'upload'/);
  assert.match(settings, /cameraSetupComplete: false/);
});

test('phone camera uses a persistent getUserMedia stream and canvas frame capture', () => {
  assert.match(manager, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(manager, /videoElement\.srcObject = stream/);
  assert.match(manager, /context\.drawImage\(phoneVideo/);
  assert.match(manager, /export function stopPhoneCamera/);
});

test('ESP32 endpoints are generated from configured address and LED is bounded', () => {
  assert.match(manager, /export function getEsp32Endpoints/);
  assert.match(manager, /Math\.max\(0, Math\.min\(255/);
  assert.match(manager, /led_intensity/);
  assert.match(manager, /capture-flash/);
  assert.match(manager, /stream\.port = .*81/);
});

test('Action page offers first-time camera setup and visible phone preview', () => {
  assert.match(action, /id="camera-setup-panel"/);
  assert.match(action, /data-camera-source="phone"/);
  assert.match(action, /data-camera-source="esp32"/);
  assert.match(action, /id="phone-camera-preview"/);
  assert.match(app, /cameraSettings\.cameraSource==='phone'/);
  assert.match(app, /capturePhoneFrame\(\)/);
});

test('Admin exposes ESP32 connection, LED brightness and stream controls', () => {
  assert.match(admin, /id="esp32-test"/);
  assert.match(admin, /id="esp32-brightness"/);
  assert.match(admin, /id="esp32-stream-start"/);
  assert.match(admin, /id="esp32-stream-stop"/);
});

test('Action camera setup is wired to the camera manager and persists device choice', () => {
  assert.match(app, /function showCameraSetup\(\)/);
  assert.match(app, /data-camera-source/);
  assert.match(app, /saveSettings\(\{cameraSource:source,cameraSetupComplete:true\}\)/);
  assert.match(app, /startPhoneCamera\(phoneCameraPreview/);
  assert.match(app, /window\.addEventListener\('pagehide',\(\)=>stopPhoneCamera\(\)\)/);
  assert.match(app, /document\.addEventListener\('visibilitychange'/);
});
