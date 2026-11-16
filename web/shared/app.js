import { captureImage, blobToDataUrl } from './camera.js?v=20261116-auth1';
import { requestAI, getAccessToken } from './api.js?v=20261116-auth1';
import { speak, speakResponse, stopSpeaking, listenOnce } from './speech.js?v=20261116-auth1';
import { getSettings, saveSettings } from './settings.js?v=20261116-auth1';
import { hasCurrentConsent, acceptConsent } from './consent.js?v=20261116-auth1';

const $ = selector => document.querySelector(selector);
const status = $('#status');
let activeRecognition = null;
let phonePhoto = null;

function announce(message) {
  status.textContent = message;
  speak(message);
}
async function announceAnswer(message) {
  status.textContent = message;
  const settings = getSettings();
  try {
    await speakResponse(message, { lang: settings.speechLanguage,
      onFallback: error => { status.textContent += ' (Using device voice because Gemini voice failed: ' + error.message + ')'; }
    });
  } catch { speak(message); }
}
function updateConsentPanel() {
  const panel=$('#consent-panel');
  if(panel && hasCurrentConsent()) panel.remove();
}
updateConsentPanel();

async function run(mode, question = '', imageOverride = null) {
  const settings = getSettings();
  if (!getAccessToken()) {
    announce('Unlock the private app at the Access page before using AI.');
    location.href='/access/?next='+encodeURIComponent(location.pathname);
    return;
  }
  if (!hasCurrentConsent()) {
    $('#consent-panel')?.scrollIntoView({behavior:'smooth'});
    announce('Please review and accept the privacy notice before using the camera.');
    return;
  }
  try {
    announce('Taking a photo. Hold still.');
    const imageBlob=imageOverride||phonePhoto||await captureImage();
    const image = await blobToDataUrl(imageBlob);
    status.textContent = 'Sending the image to ' + settings.aiModel + '. This may take up to ' + settings.waitSeconds + ' seconds.';
    const result = await requestAI(mode === 'ask' ? '/api/ask' : '/api/describe', {
      image, question, customPrompt: settings.customPrompt,
      model: settings.aiModel, waitSeconds: settings.waitSeconds,
      responseStyle: settings.responseStyle, responseLanguage: settings.speechLanguage
    });
    if (result.mock) throw new Error('AI is in MOCK mode. No image was analysed.');
    if (result.provider !== 'Gemini' || !result.answer) throw new Error('The AI backend did not return a verified Gemini answer.');
    $('#result').textContent = (result.disclaimer || '') + '\n\n' + result.answer;
    await announceAnswer(result.answer);
  } catch (error) {
    const message=error.message || 'Something went wrong.';
    $('#result').textContent=message;
    if(!imageOverride&&!phonePhoto&&/camera|capture|fetch/i.test(message)){
      status.textContent=message+' You can use a photo from this phone instead.';
    }else announce(message);
  }
}

async function startVoiceQuestion() {
  status.textContent='Requesting microphone permission…';
  activeRecognition=await listenOnce({
    lang:getSettings().speechLanguage,
    onPermission:()=>{status.textContent='Microphone permission granted. Listening…';},
    onInterim:text=>{status.textContent='I heard: '+text;},
    onResult:question=>run('ask',question),
    onError:announce,
    onEnd:()=>{if(status.textContent.startsWith('Listening'))status.textContent='No speech was recognised. You can try again or type your question.';}
  });
  if(!activeRecognition)$('#question').focus();
}

async function sendSos() {
  const settings=getSettings();
  if(!getAccessToken()){
    announce('Unlock the private app before sending SOS.');
    location.href='/access/?next='+encodeURIComponent(location.pathname);
    return;
  }
  const button=document.querySelector('[data-action="sos"]');
  if(button)button.disabled=true;
  try {
    await requestAI('/api/sos/trigger',{deviceId:settings.deviceId});
    announce('Emergency alert sent to the paired receiver. This does not call emergency services.');
    const callLink=$('#sos-call-link');
    if(settings.emergencyPhone&&callLink){
      callLink.href='tel:'+settings.emergencyPhone.replace(/[^+0-9]/g,'');
      callLink.hidden=false;callLink.style.display='block';
      callLink.textContent='Call '+(settings.emergencyName||'trusted contact')+' now';
    }
  } catch(error) { announce(error.message||'SOS alert could not be sent. Pair a receiver in Admin first.'); }
  finally { if(button)button.disabled=false; }
}

document.addEventListener('click', event => {
  const button=event.target.closest('[data-action]');
  if(!button)return;
  if(button.dataset.action==='describe')run('describe');
  if(button.dataset.action==='ask'){
    const fallback=()=>{if(!activeRecognition)startVoiceQuestion();};
    const utterance=speak('What would you like to know?',{onEnd:startVoiceQuestion,onError:fallback});
    if(!utterance)fallback();
  }
  if(button.dataset.action==='sos')sendSos();
  if(button.dataset.action==='phone-photo')$('#phone-photo')?.click();
  if(button.dataset.action==='repeat')announceAnswer($('#result').textContent);
  if(button.dataset.action==='stop'){
    stopSpeaking();
    try{activeRecognition?.stop();}catch{}
    status.textContent='Speech stopped.';
  }
});
$('#phone-photo')?.addEventListener('change',event=>{
  phonePhoto=event.target.files?.[0]||null;
  if(phonePhoto)run('describe','',phonePhoto);
});
$('#question-form').addEventListener('submit',event=>{
  event.preventDefault();
  run('ask',$('#question').value.trim());
});
$('#consent-accept').addEventListener('click',()=>{
  if(!acceptConsent()){
    $('#consent-status').textContent='Could not save your consent in this browser. Enable site storage and try again.';
    return;
  }
  $('#consent-panel').remove();
  announce('Privacy notice accepted on this device.');
});
