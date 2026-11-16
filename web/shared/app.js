import { captureImage, blobToDataUrl } from './camera.js?v=20261116-controls1';
import { requestAI } from './api.js';
import { speak, speakResponse, stopSpeaking, listenOnce } from './speech.js?v=20261116-sosmictts1';
import { getSettings, saveSettings } from './settings.js?v=20261116-sosmictts1';

const $ = selector => document.querySelector(selector);
const status = $('#status');
let activeRecognition = null;

function announce(message) {
  status.textContent = message;
  speak(message);
}
async function announceAnswer(message) {
  status.textContent = message;
  const settings = getSettings();
  try {
    await speakResponse(message, {
      lang: settings.speechLanguage,
      onFallback: error => { status.textContent += ' (Using device voice because Gemini voice failed: ' + error.message + ')'; }
    });
  } catch {
    speak(message);
  }
}

async function run(mode, question = '') {
  const settings = getSettings();
  if (!settings.consentAccepted) {
    announce('Please accept the privacy notice before using the camera.');
    return;
  }
  try {
    announce('Taking a photo. Hold still.');
    const image = await blobToDataUrl(await captureImage());
    status.textContent = 'Sending the image to ' + settings.aiModel + '. This may take up to ' + settings.waitSeconds + ' seconds.';
    const result = await requestAI(mode === 'ask' ? '/api/ask' : '/api/describe', {
      image, question, customPrompt: settings.customPrompt,
      model: settings.aiModel, waitSeconds: settings.waitSeconds,
      responseStyle: settings.responseStyle
    });
    if (result.mock) {
      const warning = 'AI is in MOCK mode. No image was analysed. Check Admin and the Worker AI mode.';
      $('#result').textContent = warning;
      announce(warning);
      return;
    }
    if (result.provider !== 'Gemini' || !result.answer) throw new Error('The AI backend did not return a verified Gemini answer.');
    $('#result').textContent = result.disclaimer + '\n\n' + result.answer;
    await announceAnswer(result.answer);
  } catch (error) {
    $('#result').textContent = error.message || 'Something went wrong.';
    announce(error.message || 'Something went wrong.');
  }
}

async function sendSos() {
  const settings = getSettings();
  const code = String(settings.sosPairingCode || '').trim().toUpperCase();
  if (!code) {
    announce('SOS receiver is not configured. Open Admin Settings, create a pairing code, then pair the other phone at SOS Receiver.');
    return;
  }
  const button = document.querySelector('[data-action="sos"]');
  if (button) button.disabled = true;
  try {
    const result = await requestAI('/api/sos/trigger', { code });
    announce('Emergency alert sent to the paired phone. This does not call emergency services.');
    const callLink = $('#sos-call-link');
    if (settings.emergencyPhone && callLink) {
      callLink.href = 'tel:' + settings.emergencyPhone.replace(/[^+0-9]/g, '');
      callLink.hidden = false;
      callLink.style.display = 'block';
      callLink.textContent = 'Call ' + (settings.emergencyName || 'trusted contact') + ' now';
    }
  } catch (error) {
    announce(error.message || 'SOS alert could not be sent. Check that the receiver is paired and online.');
  } finally {
    if (button) button.disabled = false;
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'describe') run('describe');
  if (button.dataset.action === 'ask') {
    speak('What would you like to know?', {
      onEnd: async () => {
        activeRecognition = await listenOnce({
          lang: getSettings().speechLanguage,
          onInterim: text => { status.textContent = 'I heard: ' + text; },
          onResult: question => run('ask', question),
          onError: announce
        });
        if (!activeRecognition) $('#question').focus();
      }
    });
  }
  if (button.dataset.action === 'sos') sendSos();
  if (button.dataset.action === 'repeat') announceAnswer($('#result').textContent);
  if (button.dataset.action === 'stop') {
    stopSpeaking();
    try { activeRecognition?.stop(); } catch {}
    status.textContent = 'Speech stopped.';
  }
});
$('#question-form').addEventListener('submit', event => {
  event.preventDefault();
  run('ask', $('#question').value.trim());
});
$('#consent-accept').addEventListener('click', () => {
  saveSettings({ consentAccepted: true });
  $('#consent-panel').remove();
  announce('Privacy notice accepted on this device.');
});
