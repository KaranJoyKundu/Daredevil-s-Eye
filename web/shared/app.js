import { captureImage, blobToDataUrl } from './camera.js?v=20261116-voice1';
import { requestAI } from './api.js?v=20261116-voice1';
import { speak, speakResponse, stopSpeaking, listenOnce, detectSpokenLanguage } from './speech.js?v=20261116-voice1';
import { getSettings } from './settings.js?v=20261116-voice1';
import { hasCurrentConsent, acceptConsent } from './consent.js?v=20261116-voice1';

const $ = selector => document.querySelector(selector);
const status = $('#status');
let activeRecognition = null;
let phonePhoto = null;
let revealRun = 0;

function announce(message) {
  if(status)status.textContent = message;
  speak(message);
}

function revealWords(element, message, runId) {
  if(!element)return Promise.resolve();
  const words=String(message).split(/(\s+)/).filter(Boolean);
  const rate=getSettings().speechRate||0.96;
  const interval=Math.max(105,Math.min(175,150/rate));
  element.textContent='';
  return new Promise(resolve=>{
    let index=0;
    const tick=()=>{
      if(runId!==revealRun){resolve();return;}
      if(index>=words.length){resolve();return;}
      element.textContent+=words[index++];
      if(index<words.length)setTimeout(tick,interval);else resolve();
    };
    tick();
  });
}

async function announceAnswer(message, disclaimer='') {
  if(status)status.textContent='Speaking the answer. The written response is appearing as I speak…';
  const settings = getSettings();
  const spokenLanguage=detectSpokenLanguage(message);
  const output=$('#result');
  const runId=++revealRun;
  if(output)output.textContent=disclaimer ? disclaimer+'\n\n' : '';
  const displayPromise=revealWords(output,message,runId);
  const speechPromise=speakResponse(message,{
    lang:spokenLanguage,
    engine:settings.speechEngine,
    onFallback:error=>{if(status)status.textContent='Using the device voice because the selected speech service failed: '+error.message;}
  });
  await Promise.allSettled([displayPromise,speechPromise]);
}

function updateConsentPanel() {
  const panel=$('#consent-panel');
  if(panel && hasCurrentConsent()) panel.remove();
}
updateConsentPanel();

async function run(mode, question = '', imageOverride = null) {
  const settings = getSettings();
  if (!hasCurrentConsent()) {
    $('#consent-panel')?.scrollIntoView({behavior:'smooth'});
    announce('Please review and accept the privacy notice before using the camera.');
    return;
  }
  try {
    announce('Taking a photo. Hold still.');
    const imageBlob=imageOverride||phonePhoto||await captureImage();
    const image = await blobToDataUrl(imageBlob);
    if(status)status.textContent = 'Sending the image for analysis. The app will rotate through compatible Gemini vision models if one reaches its model quota.';
    const result = await requestAI(mode === 'ask' ? '/api/ask' : '/api/describe', {
      image, question, customPrompt: settings.customPrompt,
      model: settings.aiModel, waitSeconds: settings.waitSeconds,
      responseStyle: settings.responseStyle, responseLanguage: settings.speechLanguage
    });
    if (result.mock) throw new Error('AI is in MOCK mode. No image was analysed.');
    if (result.provider !== 'Gemini' || !result.answer) throw new Error('The AI backend did not return a verified Gemini answer.');
    await announceAnswer(result.answer, result.disclaimer || '');
    if(status)status.textContent='Completed with '+(result.model||'Gemini')+'.';
  } catch (error) {
    const message=error.message || 'Something went wrong.';
    revealRun+=1;
    if($('#result'))$('#result').textContent=message;
    if(!imageOverride&&!phonePhoto&&/camera|capture|fetch/i.test(message)){
      if(status)status.textContent=message+' You can use a photo from this phone instead.';
    }else if(status)status.textContent=message;
  }
}

async function startVoiceQuestion() {
  if(status)status.textContent='Requesting microphone permission…';
  activeRecognition=await listenOnce({
    lang:getSettings().speechLanguage,
    onPermission:()=>{if(status)status.textContent='Microphone permission granted. Listening…';},
    onStart:()=>{if(status)status.textContent='Browser recognition connected. Ask your question.';},
    onInterim:text=>{if(status)status.textContent='I heard: '+text;},
    onFallback:message=>{if(status)status.textContent=message;},
    onStatus:message=>{if(status)status.textContent=message;},
    onResult:question=>run('ask',question),
    onError:message=>{if(status)status.textContent=message;},
    onEnd:()=>{if(status?.textContent.startsWith('Listening')||status?.textContent.startsWith('The browser'))status.textContent='No speech was recognised. You can try again or type your question.';}
  });
  if(!activeRecognition)$('#question')?.focus();
}

async function sendSos() {
  const settings=getSettings();
  const button=document.querySelector('[data-action="sos"]');
  if(button)button.disabled=true;
  try{
    await requestAI('/api/sos/trigger',{deviceId:settings.deviceId});
    announce('Emergency alert sent to the paired receiver. This does not call emergency services.');
    const callLink=$('#sos-call-link');
    if(settings.emergencyPhone&&callLink){
      callLink.href='tel:'+settings.emergencyPhone.replace(/[^+0-9]/g,'');
      callLink.hidden=false;callLink.style.display='block';
      callLink.textContent='Call '+(settings.emergencyName||'trusted contact')+' now';
    }
  }catch(error){announce(error.message||'SOS alert could not be sent. Pair a receiver in Admin first.');}
  finally{if(button)button.disabled=false;}
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
  if(button.dataset.action==='repeat')announceAnswer($('#result')?.textContent||'');
  if(button.dataset.action==='stop'){
    stopSpeaking();
    try{activeRecognition?.stop();}catch{}
    revealRun+=1;
    if(status)status.textContent='Speech stopped.';
  }
});
$('#phone-photo')?.addEventListener('change',event=>{
  phonePhoto=event.target.files?.[0]||null;
  if(phonePhoto)run('describe','',phonePhoto);
});
$('#question-form')?.addEventListener('submit',event=>{
  event.preventDefault();
  run('ask',$('#question')?.value.trim()||'');
});
$('#consent-accept')?.addEventListener('click',()=>{
  if(!acceptConsent()){
    $('#consent-status').textContent='Could not save your consent in this browser. Enable site storage and try again.';
    return;
  }
  $('#consent-panel').remove();
  announce('Privacy notice accepted on this device.');
});