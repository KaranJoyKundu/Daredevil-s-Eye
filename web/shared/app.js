import { captureImage, blobToDataUrl } from './camera.js?v=20261116-urlfix4';
import { requestAI } from './api.js';
import { speak, stopSpeaking, listenOnce } from './speech.js';
import { getSettings, saveSettings } from './settings.js?v=20261116-urlfix4';
const $ = s => document.querySelector(s), status = $('#status');
function announce(message) { status.textContent = message; speak(message); }
async function run(mode, question = '') {
  const settings = getSettings();
  if (!settings.consentAccepted) { announce('Please accept the privacy notice before using the camera.'); return; }
  try {
    announce('Taking a photo. Hold still.');
    const image = await blobToDataUrl(await captureImage());
    announce('Analysing the photo. Please wait.');
    const result = await requestAI(mode === 'ask' ? '/api/ask' : '/api/describe', { image, question, customPrompt: settings.customPrompt });
    if (result.mock) {
      const warning = 'AI is still in MOCK mode. No image was analysed. Stop Wrangler, remove any AI_MODE=mock setting, and restart with --var AI_MODE:gemini.';
      $('#result').textContent = warning;
      announce(warning);
      return;
    }
    if (result.provider !== 'Gemini' || !result.answer) throw new Error('The AI backend did not return a verified Gemini answer.');
    $('#result').textContent = result.disclaimer + '\n\n' + result.answer;
    announce(result.answer);
  } catch (error) { announce(error.message || 'Something went wrong.'); }
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'describe') run('describe');
  if (button.dataset.action === 'ask') {
    speak('What would you like to know?', { onEnd: () => {
      const recognition = listenOnce({ onResult: question => run('ask', question), onError: announce });
      if (!recognition) $('#question').focus();
    } });
  }
  if (button.dataset.action === 'sos') {
    const settings = getSettings();
    if (!settings.emergencyPhone) { announce('No emergency number configured. Open Settings to add a trusted contact.'); return; }
    if (confirm('Open the phone dialler for ' + (settings.emergencyName || 'your trusted contact') + '?')) location.href = 'tel:' + settings.emergencyPhone.replace(/[^+0-9]/g, '');
  }
  if (button.dataset.action === 'repeat') speak($('#result').textContent);
  if (button.dataset.action === 'stop') { stopSpeaking(); status.textContent = 'Speech stopped.'; }
});
$('#question-form').addEventListener('submit', event => { event.preventDefault(); run('ask', $('#question').value.trim()); });
$('#consent-accept').addEventListener('click', () => { saveSettings({ consentAccepted: true }); $('#consent-panel').remove(); announce('Privacy notice accepted on this device.'); });
