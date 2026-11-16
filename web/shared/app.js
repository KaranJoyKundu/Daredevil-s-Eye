import { captureImage, blobToDataUrl } from './camera.js?v=20261116-access2';
import { requestAI } from './api.js?v=20261116-access2';
import { speak, speakResponse, stopSpeaking, listenOnce, detectSpokenLanguage, vibrate } from './speech.js?v=20261116-access2';
import { getSettings, saveSettings } from './settings.js?v=20261116-access2';
import { hasCurrentConsent, acceptConsent } from './consent.js?v=20261116-access2';
const $=selector=>document.querySelector(selector),status=$('#status');
let activeRecognition=null,voiceStarting=false,phonePhoto=null,revealRun=0,lastAnswer='';
let sosArmedUntil=0,sosArmTimer=null,deepLinkHandled=false;
const requestedAction=new URLSearchParams(location.search).get('action');
function announce(message){if(status)status.textContent=message;speak(message,{lang:'en-US'});}
function actionVibration(action){const patterns={describe:[65],ask:[55,90,55],sos:[260],repeat:[45,65,45,65,45],help:[35,65,35]};vibrate(patterns[action]||60);}
async function acquireWakeLock(){if(!navigator.wakeLock?.request)return null;try{return await navigator.wakeLock.request('screen');}catch{return null;}}
async function releaseWakeLock(lock){try{if(lock&&!lock.released)await lock.release();}catch{}}
function spokenError(error){
 const message=String(error?.message||error||'');
 if(/quota|429|rate.?limit|resource.exhausted/i.test(message))return 'The AI service has reached its request limit. Please wait for the quota to reset or use your own Gemini key in Admin.';
 if(/camera|capture|cors|network isolation/i.test(message))return 'I could not reach the camera. Check that it is powered on and connected to the same Wi-Fi network.';
 if(/timed? ?out|timeout|abort/i.test(message))return 'That request took too long. Please try again when the connection is stable.';
 if(/microphone|speech input|record|permission/i.test(message))return 'I could not access or understand the microphone. Check microphone permission and try again.';
 if(/internet|fetch failed|network|could not reach gemini/i.test(message))return 'The internet connection failed. Check your connection and try again.';
 if(/blur|dark|unclear|image quality/i.test(message))return 'The camera image was not clear enough. Hold the camera steady and try again with more light.';
 return 'Sorry, I could not complete that action. '+message.slice(0,180);
}
function revealWords(element,message,runId){
 if(!element)return Promise.resolve();const words=String(message).split(/(\s+)/).filter(Boolean),rate=getSettings().speechRate||.96;
 const interval=Math.max(105,Math.min(175,150/rate));element.textContent='';
 return new Promise(resolve=>{let index=0;const tick=()=>{if(runId!==revealRun){resolve();return;}if(index>=words.length){resolve();return;}element.textContent+=words[index++];if(index<words.length)setTimeout(tick,interval);else resolve();};tick();});
}
async function announceAnswer(message,disclaimer=''){
 const answer=String(message||'').trim();if(!answer){announce('There is no answer to repeat yet.');return;}lastAnswer=answer;
 if(status)status.textContent='Speaking the answer. The written response is appearing as I speak…';
 const settings=getSettings(),spokenLanguage=detectSpokenLanguage(answer),output=$('#result'),runId=++revealRun;
 if(output)output.textContent=disclaimer?disclaimer+'\n\n':'';
 const displayPromise=revealWords(output,answer,runId);
 const speechPromise=speakResponse(answer,{lang:spokenLanguage,engine:settings.speechEngine==='gemini'?'device':settings.speechEngine,onFallback:error=>{if(status)status.textContent='Using the device voice because the selected speech service failed: '+error.message;}});
 await Promise.allSettled([displayPromise,speechPromise]);
}
async function run(mode,question='',imageOverride=null){
 if(!hasCurrentConsent()){announce('Please review and accept the privacy notice before using the camera.');return;}
 actionVibration(mode==='ask'?'ask':'describe');let wakeLock=null;
 try{
  wakeLock=await acquireWakeLock();announce('Taking several photos. Hold still.');
  const imageBlob=imageOverride||phonePhoto||await captureImage(),image=await blobToDataUrl(imageBlob);
  if(status)status.textContent='Sending the clearest photo for analysis. Selecting the sharpest of up to three frames.';
  const settings=getSettings();
  const result=await requestAI(mode==='ask'?'/api/ask':'/api/describe',{image,question,customPrompt:settings.customPrompt,model:settings.aiModel,waitSeconds:settings.waitSeconds,responseStyle:settings.responseStyle,responseLanguage:settings.speechLanguage});
  if(result.mock)throw new Error('AI is in MOCK mode. No image was analysed.');
  if(result.provider!=='Gemini'||!result.answer)throw new Error('The AI backend did not return a verified Gemini answer.');
  const safetyNote=/\b(safe to walk|safe to cross|clear to walk|path is safe|no danger)\b/i.test(result.answer)?' I cannot confirm that this area is safe. Continue using your cane or guide dog.':'';
  await announceAnswer(result.answer,[result.disclaimer||'',safetyNote].filter(Boolean).join(' '));
  if(status)status.textContent='Completed with '+(result.model||'Gemini')+'.';
 }catch(error){
  const message=error.message||'Something went wrong.';revealRun++;if($('#result'))$('#result').textContent=message;if(status)status.textContent=message;
  speak(spokenError(error),{lang:'en-US'});
 }finally{await releaseWakeLock(wakeLock);}
}
async function startVoiceQuestion(){
 if(voiceStarting)return;voiceStarting=true;actionVibration('ask');
 try{
  try{activeRecognition?.stop();}catch{}activeRecognition=null;if(status)status.textContent='Requesting microphone permission…';
  const settings=getSettings();
  activeRecognition=await listenOnce({lang:settings.speechInputLanguage||'bn-BD',preferGemini:settings.speechInputMode!=='browser',
   onPermission:()=>{if(status)status.textContent='Microphone permission granted. Listening…';},
   onStart:()=>{if(status)status.textContent='Browser recognition connected. Speak Bangla, English or mixed speech.';},
   onInterim:text=>{if(status)status.textContent='I heard: '+text;},
   onFallback:message=>{if(status)status.textContent=message;},onStatus:message=>{if(status)status.textContent=message;},
   onResult:question=>run('ask',question),
   onError:message=>{if(status)status.textContent=message;speak(spokenError(message),{lang:'en-US'});},
   onEnd:()=>{if(status?.textContent.startsWith('Listening')||status?.textContent.startsWith('The browser'))announce('No speech was recognised. Please try again.');}
  });
 }finally{voiceStarting=false;}
}
function speakHelp(){
 actionVibration('help');
 const message='Spoken help for Daredevil’s Eye. The four main buttons are Describe, Ask AI, SOS and Repeat. Tap Describe to hear what the camera can see. Tap Ask AI, ask a question in Bangla, English or a mixture, then pause. Tap SOS once to arm it. Tap SOS again within five seconds to confirm and send an alert to your paired receiver. Tap Repeat to hear the last answer again. Spoken Help is the separate button below the four main actions. This is an experimental tool, not a cane or guide dog. Continue using your normal mobility aid. To leave Blind mode, edit the browser address and remove the word blind between the slashes.';
 if(status)status.textContent='Playing spoken help.';speak(message,{lang:'en-US',rate:.92});
}
async function deliverSos(){
 const settings=getSettings(),button=document.querySelector('[data-action="sos"]');if(button)button.disabled=true;let wakeLock=null;
 try{
  wakeLock=await acquireWakeLock();actionVibration('sos');await requestAI('/api/sos/trigger',{deviceId:settings.deviceId});
  announce('Emergency alert sent to the paired receiver. This does not call emergency services.');
  const callLink=$('#sos-call-link');if(settings.emergencyPhone&&callLink){callLink.href='tel:'+settings.emergencyPhone.replace(/[^+0-9]/g,'');callLink.hidden=false;callLink.style.display='block';callLink.textContent='Call '+(settings.emergencyName||'trusted contact')+' now';}
 }catch(error){const message=error.message||'SOS alert could not be sent. Pair a receiver in Admin first.';if(status)status.textContent=message;speak(spokenError(error),{lang:'en-US'});}
 finally{if(button)button.disabled=false;await releaseWakeLock(wakeLock);}
}
function armSos({shortcut=false}={}){
 const now=Date.now();
 if(sosArmedUntil>now){clearTimeout(sosArmTimer);sosArmedUntil=0;announce('SOS confirmed. Sending the alert now.');deliverSos();return;}
 const windowMs=shortcut?30000:5000;sosArmedUntil=now+windowMs;actionVibration('sos');
 announce(shortcut?'SOS shortcut opened. Tap the SOS button once within thirty seconds to confirm sending the alert.':'SOS is armed. Tap SOS again within five seconds to confirm and send the alert. No alert has been sent yet.');
 clearTimeout(sosArmTimer);sosArmTimer=setTimeout(()=>{sosArmedUntil=0;announce('SOS confirmation expired. No alert was sent.');},windowMs);
}
function repeatAnswer(){actionVibration('repeat');if(lastAnswer)announceAnswer(lastAnswer);else announce('There is no answer to repeat yet.');}
function handleDeepLinkAction(){
 if(deepLinkHandled||!hasCurrentConsent()||!['describe','ask','sos','repeat','help'].includes(requestedAction))return;deepLinkHandled=true;
 if(requestedAction==='describe')run('describe');
 else if(requestedAction==='ask')startVoiceQuestion();
 else if(requestedAction==='sos')armSos({shortcut:true});
 else if(requestedAction==='repeat')repeatAnswer();else speakHelp();
}
function updateConsentPanel(){const panel=$('#consent-panel');if(panel&&hasCurrentConsent())panel.remove();}
updateConsentPanel();
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 if(button.dataset.action==='describe')run('describe');
 if(button.dataset.action==='ask'){const utterance=speak('What would you like to know? Speak Bangla, English or both, then pause.',{lang:'en-US',onEnd:startVoiceQuestion,onError:startVoiceQuestion});if(!utterance)startVoiceQuestion();}
 if(button.dataset.action==='sos')armSos();if(button.dataset.action==='repeat')repeatAnswer();if(button.dataset.action==='help')speakHelp();
 if(button.dataset.action==='phone-photo')$('#phone-photo')?.click();
 if(button.dataset.action==='stop'){stopSpeaking();try{activeRecognition?.stop();}catch{}revealRun++;if(status)status.textContent='Speech stopped.';}
});
$('#phone-photo')?.addEventListener('change',event=>{phonePhoto=event.target.files?.[0]||null;if(phonePhoto)run('describe','',phonePhoto);});
$('#question-form')?.addEventListener('submit',event=>{event.preventDefault();run('ask',$('#question')?.value.trim()||'');});
$('#consent-accept')?.addEventListener('click',()=>{
 if(!acceptConsent()){$('#consent-status').textContent='Could not save your consent in this browser. Enable site storage and try again.';speak('Could not save your consent. Please enable site storage and try again.',{lang:'en-US'});return;}
 $('#consent-panel').remove();const settings=getSettings();
 if(!settings.firstRunDisclaimerSpoken){
  const disclaimer='Before first use: Daredevil’s Eye is experimental. It can make mistakes and miss hazards. It is not a cane or guide dog and cannot confirm that a path or road is safe. Keep using your usual mobility aids and mobility support.';
  if(status)status.textContent='Playing the first-use safety notice.';
  const utterance=speak(disclaimer,{lang:'en-US',onEnd:()=>{saveSettings({firstRunDisclaimerSpoken:true});handleDeepLinkAction();}});
  if(!utterance){saveSettings({firstRunDisclaimerSpoken:true});handleDeepLinkAction();}
 }else{announce('Privacy notice accepted on this device.');handleDeepLinkAction();}
});
handleDeepLinkAction();
