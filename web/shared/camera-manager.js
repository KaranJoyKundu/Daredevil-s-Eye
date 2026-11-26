import { getSettings, normalizeCameraAddress } from './settings.js';

let phoneStream = null;
let phoneVideo = null;

const waitForVideo = video => new Promise((resolve, reject) => {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth) return resolve();
  const timeout = setTimeout(() => reject(new Error('The phone camera started but did not provide a video frame.')), 10000);
  video.addEventListener('loadeddata', () => { clearTimeout(timeout); resolve(); }, { once: true });
  video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('The phone camera preview failed.')); }, { once: true });
});

/** Starts one persistent rear-camera stream. Must be called from a user gesture on HTTPS. */
export async function startPhoneCamera(videoElement, { facingMode = 'environment' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is unavailable. Open Daredevil’s Eye in a supported browser over HTTPS.');
  }
  if (!videoElement) throw new Error('The camera preview element is missing.');
  if (phoneStream?.getVideoTracks().some(track => track.readyState === 'live')) {
    videoElement.srcObject = phoneStream;
    phoneVideo = videoElement;
    await videoElement.play();
    return phoneStream;
  }
  stopPhoneCamera();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    phoneStream = stream;
    phoneVideo = videoElement;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.srcObject = stream;
    await videoElement.play();
    await waitForVideo(videoElement);
    return stream;
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    phoneStream = null;
    phoneVideo = null;
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
      throw new Error('Camera permission was denied. Allow camera access in your browser settings, then try again.');
    }
    if (error?.name === 'NotFoundError') throw new Error('No usable camera was found on this device.');
    if (error?.name === 'NotReadableError') throw new Error('The camera is busy in another app. Close that app and try again.');
    throw error instanceof Error ? error : new Error('Could not start the phone camera.');
  }
}

/** Capture the current frame from the already-running stream without opening the native camera app. */
export async function capturePhoneFrame({ type = 'image/jpeg', quality = 0.88 } = {}) {
  if (!phoneStream || !phoneVideo || !phoneStream.getVideoTracks().some(track => track.readyState === 'live')) {
    throw new Error('The phone camera is not running. Enable it first.');
  }
  await waitForVideo(phoneVideo);
  const canvas = document.createElement('canvas');
  canvas.width = phoneVideo.videoWidth;
  canvas.height = phoneVideo.videoHeight;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Could not prepare a frame from the phone camera.');
  context.drawImage(phoneVideo, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Could not capture a frame from the phone camera.')),
    type,
    quality
  ));
}

export function getPhoneCameraState() {
  const track = phoneStream?.getVideoTracks()[0];
  return { active: Boolean(track && track.readyState === 'live'), label: track?.label || '', settings: track?.getSettings?.() || {} };
}

/** Report whether the active phone camera exposes a controllable torch. */
export function getPhoneTorchState() {
  const track = phoneStream?.getVideoTracks().find(item => item.readyState === 'live');
  if (!track) return { available: false, enabled: false };
  let capabilities = {};
  try { capabilities = track.getCapabilities?.() || {}; } catch {}
  return {
    available: Object.prototype.hasOwnProperty.call(capabilities, 'torch'),
    enabled: track.getSettings?.().torch === true
  };
}

/** Toggle the phone camera torch only when the active track advertises support. */
export async function setPhoneTorch(enabled) {
  const track = phoneStream?.getVideoTracks().find(item => item.readyState === 'live');
  if (!track) throw new Error('Enable the phone camera before using its light.');
  let capabilities = {};
  try { capabilities = track.getCapabilities?.() || {}; } catch {}
  if (!Object.prototype.hasOwnProperty.call(capabilities, 'torch')) {
    throw new Error('This phone camera or browser does not support a controllable torch.');
  }
  try {
    await track.applyConstraints({ advanced: [{ torch: Boolean(enabled) }] });
  } catch {
    throw new Error('The phone camera could not change its light. Try turning it off and on again.');
  }
  return getPhoneTorchState();
}

export function stopPhoneCamera() {
  phoneStream?.getTracks().forEach(track => track.stop());
  if (phoneVideo) phoneVideo.srcObject = null;
  phoneStream = null;
  phoneVideo = null;
}

/** Build all ESP32 URLs from one per-device setting; no IP literals are duplicated in callers. */
export function getEsp32Endpoints() {
  const base = normalizeCameraAddress(getSettings().cameraBaseUrl);
  let parsed;
  try { parsed = new URL(base); } catch { throw new Error('Enter a valid ESP32 camera address in Admin.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('Enter a valid ESP32 camera address in Admin.');
  const origin = parsed.origin;
  const stream = new URL('/stream', origin);
  stream.port = parsed.port === '81' ? '81' : '81';
  return Object.freeze({
    base: origin,
    capture: () => origin + '/capture?t=' + Date.now(),
    captureFlash: () => origin + '/capture-flash?t=' + Date.now(),
    led: value => {
      const brightness = Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
      return origin + '/control?var=led_intensity&val=' + brightness;
    },
    stream: stream.toString()
  });
}

async function esp32Request(url, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal, mode: 'cors' });
    if (!response.ok) throw new Error('ESP32 returned HTTP ' + response.status + '.');
    return response;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('ESP32 did not respond before the connection timed out.');
    if (error instanceof TypeError) throw new Error('The browser could not reach the ESP32. Check that both devices are on the same Wi-Fi and grant Local Network Access if Chrome asks.');
    throw error;
  } finally { clearTimeout(timer); }
}

export async function setEsp32LedBrightness(value) {
  const endpoints = getEsp32Endpoints();
  await esp32Request(endpoints.led(value));
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

export async function captureEsp32Photo({ flash = false } = {}) {
  const endpoints = getEsp32Endpoints();
  if (!flash) await setEsp32LedBrightness(0);
  const response = await esp32Request(flash ? endpoints.captureFlash() : endpoints.capture(), { timeoutMs: 20000 });
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('image/')) throw new Error('ESP32 capture endpoint did not return an image. Check the camera firmware.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('ESP32 returned an empty photo.');
  return blob;
}

export async function testEsp32Connection() {
  const endpoints = getEsp32Endpoints();
  const response = await esp32Request(endpoints.capture(), { timeoutMs: 12000 });
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('image/')) throw new Error('ESP32 responded, but /capture did not return an image.');
  return { ok: true, address: endpoints.base, bytes: Number(response.headers.get('content-length') || 0) };
}

/** An MJPEG stream is stopped by releasing its browser connection; firmware has no stream-off URL. */
export function stopEsp32Stream(imageElement) {
  if (imageElement) imageElement.removeAttribute('src');
}
