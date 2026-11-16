import { captureImage, blobToDataUrl } from './camera.js?v=20261116-controls1';
import { requestAI } from './api.js';
import { speak, stopSpeaking, listenOnce } from './speech.js?v=20261116-admin-controls1';
import { getSettings, saveSettings } from './settings.js?v=20261116-admin-controls1';

const $ = selector => document.querySelector(selector);
const status = $('#status');
let activeRecognition = null;
function announce(message) {
  status.textContent = message;
  speak(message);
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
      image,
      question,
      customPrompt: settings.customPrompt,
      model: settings.aiModel,
      waitSeconds: settings.waitSeconds,
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
    announce(result.answer);
  } catch (error) {
    $('#result').textContent = error.message || 'Something went wrong.';
    announce(error.message || 'Something went wrong.');
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'describe') run('describe');
  if (button.dataset.action === 'ask') {
    speak('What would you like to know?', {
      onEnd: () => {
        activeRecognition = listenOnce({
          lang: getSettings().speechLanguage,
          onInterim: text => { status.textContent = 'I heard: ' + text; },
          onResult: question => run('ask', question),
          onError: announce
        });
        if (!activeRecognition) $('#question').focus();
      }
    });
  }
  if (button.dataset.action === 'sos') {
    const settings = getSettings();
    if (!settings.emergencyPhone) {
      announce('No emergency number configured. Open Settings to add a trusted contact.');
      return;
    }
    if (confirm('Open the phone dialler for ' + (settings.emergencyName || 'your trusted contact') + '?')) {
      location.href = 'tel:' + settings.emergencyPhone.replace(/[^+0-9]/g, '');
    }
  }
  if (button.dataset.action === 'repeat') speak($('#result').textContent);
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
