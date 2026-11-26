import { apiFetch } from './api.js';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Emergency recording request failed (' + response.status + ').');
  return data;
}

function chooseRecordingMimeType() {
  if (!('MediaRecorder' in window)) throw new Error('This browser does not support video recording.');
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

export async function startIncidentRecording(stream, { deviceId, cameraSource, onStatus = () => {} } = {}) {
  if (!stream?.getVideoTracks?.().some(track => track.readyState === 'live')) {
    throw new Error('A live camera stream is required for incident recording.');
  }
  const mimeType = chooseRecordingMimeType();
  const create = await readJson(await apiFetch('/api/recordings', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId, cameraSource, mimeType: mimeType || 'video/webm' })
  }));
  const recordingId = create.recordingId;
  if (!recordingId) throw new Error('The server did not create a recording ID.');
  let recorder, index = 0, failed = null, uploadQueue = Promise.resolve();
  let stopped = false, timer = null, stopResolve;
  const stoppedEvent = new Promise(resolve => { stopResolve = resolve; });
  const startAt = Date.now();
  const upload = (blob, chunkIndex) => {
    uploadQueue = uploadQueue.then(async () => {
      const response = await apiFetch('/api/recordings/' + recordingId + '/chunks/' + chunkIndex, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/octet-stream' },
        body: blob
      });
      await readJson(response);
    }).catch(error => {
      failed = error;
      onStatus('Recording upload failed: ' + error.message);
    });
  };
  const cleanupRecord = async () => {
    try { await apiFetch('/api/recordings/' + recordingId, { method: 'DELETE', credentials: 'same-origin' }); } catch {}
  };
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    if (recorder && recorder.state !== 'inactive') {
      const waitForStop = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }));
      recorder.stop();
      await waitForStop;
    } else if (recorder?.state === 'inactive') {
      stopResolve();
    }
    await uploadQueue;
    if (failed) {
      await cleanupRecord();
      onStatus('Emergency recording was not saved because a video chunk failed.');
      return;
    }
    const durationSeconds = Math.max(1, Math.min(300, Math.ceil((Date.now() - startAt) / 1000)));
    try {
      await readJson(await apiFetch('/api/recordings/' + recordingId + '/complete', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ durationSeconds })
      }));
      onStatus('Emergency video recording saved privately for 30 days.');
    } catch (error) {
      await cleanupRecord();
      onStatus('Emergency recording could not be completed: ' + error.message);
    }
  };
  try {
    recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 550000
    });
    recorder.addEventListener('dataavailable', event => {
      if (event.data?.size) upload(event.data, index++);
    });
    recorder.addEventListener('stop', () => stopResolve());
    recorder.start(5000);
    timer = setTimeout(() => { void stop(); }, Math.min(300, Number(create.maxDurationSeconds) || 300) * 1000);
    onStatus('Private emergency recording started. It stops automatically after five minutes.');
    return { recordingId, mimeType: recorder.mimeType || mimeType || 'video/webm', stop };
  } catch (error) {
    await cleanupRecord();
    throw error instanceof Error ? error : new Error('Could not start emergency recording.');
  }
}
