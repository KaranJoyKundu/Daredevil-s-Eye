import { requestPublic } from './api.js';

let activeSender = null;

export function createEsp32CanvasStream(imageElement, fps = 6) {
  if (!imageElement || !imageElement.complete || !imageElement.naturalWidth || !imageElement.naturalHeight) {
    throw new Error('Start the ESP32 live preview and wait for a frame before sharing it.');
  }
  if (!('captureStream' in HTMLCanvasElement.prototype)) {
    throw new Error('This browser cannot convert the ESP32 preview into a shareable video stream.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(1280, imageElement.naturalWidth);
  canvas.height = Math.round(canvas.width * imageElement.naturalHeight / imageElement.naturalWidth);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the ESP32 video bridge.');
  const stream = canvas.captureStream(Math.max(1, Math.min(12, Number(fps) || 6)));
  let frame = 0, stopped = false;
  const draw = () => {
    if (stopped) return;
    try {
      context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    } catch {
      stop();
      throw new Error('The browser cannot read ESP32 stream frames. Check firmware CORS and local-network permission.');
    }
    frame = requestAnimationFrame(draw);
  };
  const stop = () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    stream.getTracks().forEach(track => track.stop());
    canvas.width = 1; canvas.height = 1;
  };
  draw();
  return { stream, stop };
}

export async function startEmergencyVideo({ deviceId, eventId, stream, onStatus = () => {}, onEnded = () => {} }) {
  if (!('RTCPeerConnection' in window)) throw new Error('This browser does not support WebRTC live sharing.');
  if (!stream?.getVideoTracks?.().some(track => track.readyState === 'live')) {
    throw new Error('No active camera stream is available. Start the camera preview first.');
  }
  if (activeSender) await activeSender.stop();
  const started = await requestPublic('/api/sos/video/start', { deviceId, eventId });
  const sessionId = started.sessionId;
  if (!sessionId) throw new Error('The emergency video session could not be created.');
  const peer = new RTCPeerConnection({ iceServers: started.iceServers || [{ urls: ['stun:stun.l.google.com:19302'] }] });
  let stopped = false, timer = null, candidateCursor = 0, remoteDescriptionSet = false;
  const pendingCandidates = [];
  const state = { sessionId, peer, stop: null };
  const closeLocal = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    peer.onicecandidate = null;
    peer.onconnectionstatechange = null;
    peer.close();
    if (activeSender === state) activeSender = null;
  };
  state.stop = async () => {
    if (stopped) return;
    closeLocal();
    try { await requestPublic('/api/sos/video/stop-sender', { deviceId, sessionId }); } catch {}
    onStatus('Emergency video sharing stopped.');
  };
  activeSender = state;
  peer.addEventListener('icecandidate', event => {
    if (!event.candidate || stopped) return;
    requestPublic('/api/sos/video/ice-sender', {
      deviceId, sessionId, candidate: event.candidate.toJSON()
    }).catch(error => onStatus('Video connection update failed: ' + error.message));
  });
  peer.addEventListener('connectionstatechange', () => {
    if (stopped) return;
    const status = peer.connectionState;
    if (status === 'connected') onStatus('Live video is connected to the paired receiver.');
    else if (status === 'connecting') onStatus('Connecting securely to the paired receiver…');
    else if (status === 'failed') onStatus('Live video could not connect. The SOS alert remains sent; a TURN relay may be needed on this network.');
    else if (status === 'disconnected') onStatus('Video connection interrupted. Trying to recover…');
  });
  try {
    for (const track of stream.getVideoTracks()) peer.addTrack(track, stream);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await requestPublic('/api/sos/video/offer', { deviceId, sessionId, sdp: peer.localDescription });
  } catch (error) {
    await state.stop();
    throw error;
  }
  const poll = async () => {
    if (stopped) return;
    try {
      const data = await requestPublic('/api/sos/video/sender-poll', {
        deviceId, sessionId, after: candidateCursor
      });
      if (!data.active) {
        closeLocal();
        onStatus('The paired receiver ended or the emergency video session expired.');
        return;
      }
      if (data.answer && !remoteDescriptionSet) {
        await peer.setRemoteDescription(data.answer);
        remoteDescriptionSet = true;
        for (const candidate of pendingCandidates.splice(0)) {
          try { await peer.addIceCandidate(candidate); } catch {}
        }
      }
      for (const candidate of data.receiverCandidates || []) {
        if (remoteDescriptionSet) {
          try { await peer.addIceCandidate(candidate); } catch {}
        } else pendingCandidates.push(candidate);
      }
      candidateCursor = Number(data.receiverCandidateCount) || candidateCursor;
    } catch (error) {
      onStatus('Waiting for the paired receiver: ' + error.message);
    }
    if (!stopped) timer = setTimeout(poll, 900);
  };
  onStatus(started.turnConfigured
    ? 'Emergency video session created. Connecting with relay fallback available…'
    : 'Emergency video session created. Connecting directly; some mobile networks may require TURN relay configuration…');
  poll();
  return state;
}

export async function stopEmergencyVideo() {
  if (activeSender) await activeSender.stop();
}
