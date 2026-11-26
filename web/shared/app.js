import { captureImage, blobToDataUrl, compressImageToJpeg, primeShutterAudio } from './camera.js?v=20261117-release5';
import { startPhoneCamera, capturePhoneFrame, stopPhoneCamera, captureEsp32Photo, getPhoneTorchState, setPhoneTorch, getEsp32Endpoints, stopEsp32Stream } from './camera-manager.js?v=20261126-camera4';
import { requestAI } from './api.js?v=20261117-release5';
import { speak, speakResponse, stopSpeaking, listenOnce, detectSpokenLanguage, vibrate } from './speech.js?v=20261117-release5';
import { getSettings, saveSettings } from './settings.js?v=20261117-release5';
import { hasCurrentConsent } from './consent.js?v=20261126-open-access1';
import { createShakeSequenceTracker, getShakeMagnitude, matchSosVoiceCommand } from './sos-triggers.js?v=20261117-release1';
import { mountLanguageSwitch, toBangla } from './language.js?v=20261117-release5';
import { startRFIDListener } from './rfid-listener.js?v=20261126-dedup1';
const $=selector=>document.querySelector(selector),status=$('#status');
mountLanguageSwitch($('.blind-utility'));
startRFIDListener();
let activeRecognition=null,voiceStarting=false,phonePhoto=null,phonePhotoUrl=null,revealRun=0,lastAnswer='';
let sosArmedUntil=0,sosArmTimer=null,deepLinkHandled=false;
const requestedAction=new URLSearchParams(location.search).get('action');
const isBlindMode=location.pathname.replace(/\/+$/,'')==='/blind';
const blindFeedback=$('#blind-feedback');
if(isBlindMode&&status&&blindFeedback&&'MutationObserver' in window){
 new MutationObserver(()=>{
  const message=status.textContent.trim();
  blindFeedback.textContent=message;
  blindFeedback.hidden=!message||message.startsWith('Ready. Four main actions');
 }).observe(status,{subtree:true,childList:true,characterData:true});
}
const shakeTracker=createShakeSequenceTracker();
let motionListenerAttached=false,sosVoiceRecognition=null,sosVoiceRestartTimer=null;
let sosVoiceMode='wake',sosVoiceModeTimer=null,sosVoiceBlocked=false,sosVoiceFailures=0;
let sosCountdownTimer=null,sosCountdownWakeLock=null,sosDispatching=false;

function stopSosVoiceListener(){
 if(sosVoiceRestartTimer){clearTimeout(sosVoiceRestartTimer);sosVoiceRestartTimer=null;}
 const recognition=sosVoiceRecognition;sosVoiceRecognition=null;
 if(recognition){recognition.onend=null;recognition.onerror=null;try{recognition.stop();}catch{}}
}
function shouldRunSosVoiceListener(){
 const settings=getSettings();
 return isBlindMode&&settings.sosVoiceEnabled&&hasCurrentConsent()&&!document.hidden&&!sosVoiceBlocked&&!sosDispatching&&!sosVoiceRecognition&&!sosVoiceRestartTimer;
}
function startSosVoiceListener(){
 if(!shouldRunSosVoiceListener())return;
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){sosVoiceBlocked=true;if(status)status.textContent='Voice SOS is enabled, but this browser does not support continuous speech recognition.';return;}
 let recognition;
 try{
  recognition=new Recognition();recognition.lang=getSettings().sosVoiceLanguage||'bn-BD';
  recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=1;
  sosVoiceRecognition=recognition;
  recognition.onresult=event=>{
   for(let i=event.resultIndex;i<event.results.length;i++){
    const result=event.results[i];
    if(result?.isFinal&&result[0]?.transcript){sosVoiceFailures=0;handleSosVoiceCommand(result[0].transcript);}
   }
  };
  recognition.onerror=event=>{
   if(['not-allowed','service-not-allowed','audio-capture'].includes(event.error)){
    sosVoiceBlocked=true;
    if(status)status.textContent='Voice SOS monitoring stopped. Check microphone permission and re-enable it in Admin.';
   }else if(event.error==='network'){
    sosVoiceFailures++;
    if(sosVoiceFailures>=3){sosVoiceBlocked=true;if(status)status.textContent='Voice SOS could not maintain a recognition connection. Re-enable it in Admin when the connection is stable.';}
   }
  };
  recognition.onend=()=>{
   if(sosVoiceRecognition===recognition)sosVoiceRecognition=null;
   if(isBlindMode&&getSettings().sosVoiceEnabled&&hasCurrentConsent()&&!document.hidden&&!sosVoiceBlocked&&!sosDispatching&&!sosVoiceRestartTimer){
    sosVoiceRestartTimer=setTimeout(()=>{sosVoiceRestartTimer=null;startSosVoiceListener();},1200);
   }
  };
  recognition.start();
 }catch{
  if(sosVoiceRecognition===recognition)sosVoiceRecognition=null;
  if(!sosVoiceBlocked&&!sosVoiceRestartTimer)sosVoiceRestartTimer=setTimeout(()=>{sosVoiceRestartTimer=null;startSosVoiceListener();},1800);
 }
}
function localizeSpeech(message){
 const settings=getSettings();
 if(settings.speechLanguage!=='bn-BD')return String(message||'');
 // Callers may pass already-Bangla text; without this it fell through to the generic failure line.
 if(/[\u0980-\u09FF]/.test(String(message||'')))return String(message);
 const exact={
  'SOS countdown cancelled. No alert was sent.':'এসওএস বাতিল করা হয়েছে। কোনো সতর্কবার্তা পাঠানো হয়নি।',
  'SOS cancelled. No alert was sent.':'এসওএস বাতিল করা হয়েছে। কোনো সতর্কবার্তা পাঠানো হয়নি।',
  'Three deliberate shakes detected. The SOS alert will be sent in eight seconds. Say cancel SOS or tap Cancel SOS now to stop it.':'তিনবার ইচ্ছাকৃতভাবে ফোন নাড়ানো হয়েছে। আট সেকেন্ড পর এসওএস যাবে। বাতিল করতে “এসওএস বাতিল” বলুন অথবা বাতিল বোতাম চাপুন।',
  'Voice SOS confirmed. The alert will be sent in five seconds. Say cancel SOS or tap Cancel SOS now to stop it.':'ভয়েস এসওএস নিশ্চিত হয়েছে। পাঁচ সেকেন্ড পর সতর্কবার্তা যাবে। বাতিল করতে “এসওএস বাতিল” বলুন অথবা বাতিল বোতাম চাপুন।',
  'SOS request cancelled. No alert was sent.':'এসওএস অনুরোধ বাতিল হয়েছে। কোনো সতর্কবার্তা পাঠানো হয়নি।',
  'Voice SOS confirmation timed out. No alert was sent.':'ভয়েস এসওএস নিশ্চিত করার সময় শেষ হয়েছে। কোনো সতর্কবার্তা পাঠানো হয়নি।',
  'SOS wake phrase heard. To send an alert, say confirm SOS within twelve seconds. Say cancel SOS to cancel.':'এসওএস সংকেত শোনা গেছে। সতর্কবার্তা পাঠাতে বারো সেকেন্ডের মধ্যে “নিশ্চিত করুন” বলুন। বাতিল করতে “এসওএস বাতিল” বলুন।',
  'There is no answer to repeat yet.':'পুনরায় শোনানোর মতো কোনো উত্তর এখনো নেই।',
  'Taking several photos. Hold still.':'তিনটি ছবি তোলা হচ্ছে। অনুগ্রহ করে ক্যামেরা স্থির রাখুন।',
  'Sending the clearest photo for analysis. Selecting the sharpest of up to three frames.':'সবচেয়ে পরিষ্কার ছবিটি বিশ্লেষণের জন্য পাঠানো হচ্ছে। সর্বোচ্চ তিনটি ছবির মধ্যে সবচেয়ে স্পষ্ট ছবিটি বেছে নেওয়া হচ্ছে।',
  'Speaking the answer. The written response is appearing as I speak…':'উত্তরটি বলা হচ্ছে। বলার সঙ্গে সঙ্গে লেখাটিও দেখানো হচ্ছে।',
  'What would you like to know? Speak Bangla, English or both, then pause.':'আপনি কী জানতে চান? বাংলায় প্রশ্ন করুন, তারপর একটু থামুন।',
  'No speech was recognised. Please try again.':'আপনার কথা বোঝা যায়নি। অনুগ্রহ করে আবার বলুন।',
  'Emergency alert sent to the paired receiver. This does not call emergency services.':'জোড়া লাগানো ফোনে জরুরি সতর্কবার্তা পাঠানোর অনুরোধ করা হয়েছে। এটি জরুরি সেবায় ফোন করে না।',
  'SOS is stored. The push service accepted the notification request, but delivery is not confirmed.':'এসওএস সংরক্ষণ করা হয়েছে। নোটিফিকেশন সেবা বার্তাটি গ্রহণ করেছে, তবে ফোনে পৌঁছেছে কি না নিশ্চিত করা যায়নি।',
  'SOS is stored, but no push notification was accepted. Keep the receiver connected to the internet and notifications enabled.':'এসওএস সংরক্ষণ করা হয়েছে, কিন্তু পুশ নোটিফিকেশন গ্রহণ করা হয়নি। রিসিভার ফোনে ইন্টারনেট ও নোটিফিকেশন চালু রাখুন।',
  'SOS confirmed. Sending the alert now.':'এসওএস নিশ্চিত হয়েছে। এখন সতর্কবার্তা পাঠানো হচ্ছে।',
  'SOS shortcut opened. Tap the SOS button once within thirty seconds to confirm sending the alert.':'এসওএস শর্টকাট চালু হয়েছে। সতর্কবার্তা পাঠাতে ত্রিশ সেকেন্ডের মধ্যে এসওএস বোতাম চাপুন।',
  'SOS is armed. Tap SOS again within five seconds to confirm and send the alert. No alert has been sent yet.':'এসওএস প্রস্তুত। সতর্কবার্তা পাঠাতে পাঁচ সেকেন্ডের মধ্যে আবার এসওএস বোতাম চাপুন। এখনো কোনো সতর্কবার্তা পাঠানো হয়নি।',
  'SOS confirmation expired. No alert was sent.':'এসওএস নিশ্চিত করার সময় শেষ হয়েছে। কোনো সতর্কবার্তা পাঠানো হয়নি।',
  'Privacy notice accepted on this device.':'এই ফোনে গোপনীয়তার বিজ্ঞপ্তি গ্রহণ করা হয়েছে।',
  'Please review and accept the privacy notice before using the camera.':'ক্যামেরা ব্যবহারের আগে অনুগ্রহ করে গোপনীয়তার বিজ্ঞপ্তিটি পড়ে সম্মতি দিন।',
  'I could not complete that action.':'দুঃখিত, কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।',
  'No speech was recognised. Please try again.':'আপনার কথা বোঝা যায়নি। অনুগ্রহ করে আবার বলুন।',
  'Please review and accept the privacy notice before using the camera.':'ক্যামেরা ব্যবহারের আগে অনুগ্রহ করে গোপনীয়তার বিজ্ঞপ্তিটি পড়ে সম্মতি দিন।',
  'Photo and answer saved to your account history.':'ছবি ও উত্তর আপনার অ্যাকাউন্টের ব্যক্তিগত ইতিহাসে সংরক্ষণ করা হয়েছে।',
  'Sign in to save this photo and answer to your private history.':'এই ছবি ও উত্তর ব্যক্তিগত ইতিহাসে সংরক্ষণ করতে আপনার অ্যাকাউন্টে প্রবেশ করুন।',
  'Account history is not configured on the Worker yet.':'অ্যাকাউন্টের ইতিহাস সংরক্ষণের ব্যবস্থা সার্ভারে এখনো চালু হয়নি।',
  'History saving is switched off.':'ছবি ও উত্তর সংরক্ষণের ব্যবস্থা বন্ধ আছে।',
  'Requesting microphone permission…':'মাইক্রোফোনের অনুমতি চাওয়া হচ্ছে…',
  'Microphone permission granted. Listening…':'মাইক্রোফোনের অনুমতি পাওয়া গেছে। শুনছি…',
  'Playing spoken help.':'কথ্য সহায়তা শোনানো হচ্ছে।',
  'Speech stopped.':'কথা বলা বন্ধ করা হয়েছে।',
  'Photo ready. Review it, then press Ask AI to send it.':'ছবিটি প্রস্তুত। দেখে নিয়ে পাঠাতে “এআই-কে জিজ্ঞাসা” বোতাম চাপুন।'
 };
 if(exact[message])return exact[message];
 const known=toBangla(message);if(known)return known;
 if(/^Completed with /i.test(message))return 'ছবির বিশ্লেষণ সম্পন্ন হয়েছে।';
 if(/^Sending the compressed photo/i.test(message))return 'সংকুচিত ছবিটি বিশ্লেষণের জন্য পাঠানো হচ্ছে।';
 if(/^Speaking the answer/i.test(message))return 'উত্তরটি বলা হচ্ছে।';
 if(/no bengali speech voice|no bengali speech voices/i.test(message))return 'এই ফোনে বাংলা বলার কণ্ঠস্বর পাওয়া যায়নি। অ্যান্ড্রয়েডের টেক্সট-টু-স্পিচ সেটিংসে বাংলা ভয়েস ডেটা ইনস্টল করুন।';
 if(/quota|429|resource.exhausted/i.test(message))return 'এআই সেবার ব্যবহারের সীমা আপাতত পূর্ণ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন অথবা অ্যাডমিন সেটিংসে নিজের জেমিনি এপিআই কী ব্যবহার করুন।';
 if(/camera|capture|cors|network isolation/i.test(message))return 'ক্যামেরার সঙ্গে সংযোগ করা যায়নি। ক্যামেরা চালু আছে কি না এবং একই ওয়াই-ফাই নেটওয়ার্কে আছে কি না পরীক্ষা করুন।';
 if(/timed? ?out|timeout|abort/i.test(message))return 'অনুরোধটি সম্পন্ন হতে বেশি সময় লেগেছে। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
 if(/microphone|speech input|record|permission/i.test(message))return 'মাইক্রোফোন ব্যবহার করা যায়নি। ব্রাউজারের মাইক্রোফোন অনুমতি পরীক্ষা করে আবার চেষ্টা করুন।';
 if(/internet|fetch failed|network|could not reach gemini/i.test(message))return 'ইন্টারনেট সংযোগে সমস্যা হয়েছে। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
 if(/blur|dark|unclear|image quality/i.test(message))return 'ছবিটি যথেষ্ট পরিষ্কার নয়। ক্যামেরা স্থির রাখুন এবং ভালো আলোতে আবার ছবি তুলুন।';
 return 'দুঃখিত, কাজটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
}
// Status line in the chosen answer language (only for messages localizeSpeech knows; others fall back to its generic error).
function updateBlindFeedback(message){
 if(!isBlindMode||!blindFeedback)return;
 const text=getSettings().speechLanguage==='bn-BD'?localizeSpeech(String(message||'')):String(message||'');
 blindFeedback.textContent=text;
 blindFeedback.hidden=!text;
}
function show(message){
 const text=getSettings().speechLanguage==='bn-BD'?localizeSpeech(message):message;
 if(status)status.textContent=text;
 updateBlindFeedback(text);
}
function speakSosStatus(message){
 const settings=getSettings();
 const resume=()=>{if(isBlindMode&&settings.sosVoiceEnabled&&!document.hidden&&!sosVoiceBlocked&&!sosDispatching)startSosVoiceListener();};
 stopSosVoiceListener();
 const utterance=speak(localizeSpeech(message),{lang:settings.speechLanguage||'en-US',onEnd:resume,onError:()=>{
  // Keep the action's visible confirmation/error text in place if device TTS fails.
  // Speech-engine errors must not erase SOS, Repeat or other action feedback.
  resume();
 }});
 if(!utterance)resume();
}
function setSosCancelVisibility(visible){
 const cancel=$('#sos-trigger-cancel'),help=$('#spoken-help-button');
 if(cancel)cancel.hidden=!visible;
 if(help)help.hidden=!!visible;
}
async function cancelSosCountdown(){
 if(!sosCountdownTimer)return false;
 clearTimeout(sosCountdownTimer);sosCountdownTimer=null;setSosCancelVisibility(false);sosVoiceMode='wake';
 if(sosVoiceModeTimer){clearTimeout(sosVoiceModeTimer);sosVoiceModeTimer=null;}
 const lock=sosCountdownWakeLock;sosCountdownWakeLock=null;await releaseWakeLock(lock);
 show('SOS countdown cancelled. No alert was sent.');
 speakSosStatus('SOS cancelled. No alert was sent.');return true;
}
async function finishSosCountdown(){
 if(!sosCountdownTimer||sosDispatching)return;
 clearTimeout(sosCountdownTimer);sosCountdownTimer=null;setSosCancelVisibility(false);sosVoiceMode='wake';
 if(sosVoiceModeTimer){clearTimeout(sosVoiceModeTimer);sosVoiceModeTimer=null;}
 const lock=sosCountdownWakeLock;sosCountdownWakeLock=null;await releaseWakeLock(lock);
 await deliverSos();
}
async function startSosCountdown(source){
 if(sosCountdownTimer||sosDispatching)return;
 const seconds=source==='shake'?8:5;
 sosVoiceMode='cancel';setSosCancelVisibility(true);
 sosCountdownTimer=setTimeout(()=>{finishSosCountdown();},seconds*1000);
 acquireWakeLock().then(lock=>{if(sosCountdownTimer)sosCountdownWakeLock=lock;else releaseWakeLock(lock);});
 const message=source==='shake'
  ?'Three deliberate shakes detected. The SOS alert will be sent in eight seconds. Say cancel SOS or tap Cancel SOS now to stop it.'
  :'Voice SOS confirmed. The alert will be sent in five seconds. Say cancel SOS or tap Cancel SOS now to stop it.';
 if(status)status.textContent=message;speakSosStatus(message);
}
function handleSosVoiceCommand(transcript){
 const phase=sosCountdownTimer?'cancel':sosVoiceMode;
 const command=matchSosVoiceCommand(transcript,phase);
 if(command==='cancel'){
  if(sosCountdownTimer)cancelSosCountdown();
  else if(sosVoiceMode==='confirm'){
   sosVoiceMode='wake';if(sosVoiceModeTimer){clearTimeout(sosVoiceModeTimer);sosVoiceModeTimer=null;}
   speakSosStatus('SOS request cancelled. No alert was sent.');
  }
  return;
 }
 if(sosCountdownTimer)return;
 if(sosVoiceMode==='confirm'&&command==='confirm'){
  if(sosVoiceModeTimer){clearTimeout(sosVoiceModeTimer);sosVoiceModeTimer=null;}
  sosVoiceMode='cancel';startSosCountdown('voice');return;
 }
 if(sosVoiceMode==='wake'&&command==='wake'){
  sosVoiceMode='confirm';
  if(sosVoiceModeTimer)clearTimeout(sosVoiceModeTimer);
  sosVoiceModeTimer=setTimeout(()=>{
   sosVoiceModeTimer=null;
   if(sosVoiceMode==='confirm'){sosVoiceMode='wake';speakSosStatus('Voice SOS confirmation timed out. No alert was sent.');}
  },12000);
  speakSosStatus('SOS wake phrase heard. To send an alert, say confirm SOS within twelve seconds. Say cancel SOS to cancel.');
 }
}
function handleDeviceMotion(event){
 if(!isBlindMode||document.hidden||!getSettings().sosShakeEnabled||sosCountdownTimer||sosDispatching)return;
 if(shakeTracker.push(getShakeMagnitude(event),Date.now())){shakeTracker.reset();startSosCountdown('shake');}
}
function syncSosAutomation(){
 if(!isBlindMode||!hasCurrentConsent())return;
 const settings=getSettings();
 if(settings.sosShakeEnabled&&!document.hidden&&!motionListenerAttached&&'DeviceMotionEvent'in window){
  window.addEventListener('devicemotion',handleDeviceMotion,{passive:true});motionListenerAttached=true;
 }else if((!settings.sosShakeEnabled||document.hidden)&&motionListenerAttached){
  window.removeEventListener('devicemotion',handleDeviceMotion);motionListenerAttached=false;shakeTracker.reset();
 }
 if(settings.sosVoiceEnabled)startSosVoiceListener();
 else{stopSosVoiceListener();sosVoiceBlocked=false;}
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  stopSosVoiceListener();
  if(motionListenerAttached){window.removeEventListener('devicemotion',handleDeviceMotion);motionListenerAttached=false;}
  shakeTracker.reset();
 }else syncSosAutomation();
});
function setSosFeedback(message,state='info'){
 const feedback=$('#sos-feedback');if(!feedback)return;
 const settings=getSettings();feedback.textContent=settings.speechLanguage==='bn-BD'?localizeSpeech(message):message;
 feedback.dataset.state=state;feedback.hidden=!message;
}
function resetSosButton(){const button=document.querySelector('[data-action="sos"]');if(button)button.setAttribute('aria-pressed','false');}
function announce(message){const settings=getSettings(),spoken=localizeSpeech(message),visible=settings.speechLanguage==='bn-BD'?spoken:message;if(status)status.textContent=visible;updateBlindFeedback(visible);speakSosStatus(message);}
function actionVibration(action){const patterns={describe:[65],ask:[55,90,55],sos:[260],repeat:[45,65,45,65,45],help:[35,65,35]};vibrate(patterns[action]||60);}
async function acquireWakeLock(){if(!navigator.wakeLock?.request)return null;try{return await navigator.wakeLock.request('screen');}catch{return null;}}
async function releaseWakeLock(lock){try{if(lock&&!lock.released)await lock.release();}catch{}}
function spokenError(error){
 const settings=getSettings(),message=String(error?.message||error||'');
 if(settings.speechLanguage==='bn-BD')return localizeSpeech(message);
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
 stopSosVoiceListener();
 const answer=String(message||'').trim();if(!answer){announce('There is no answer to repeat yet.');return;}lastAnswer=answer;
 show('Speaking the answer. The written response is appearing as I speak…');
 const settings=getSettings(),spokenLanguage=settings.speechLanguage==='bn-BD'?'bn-BD':detectSpokenLanguage(answer),output=$('#result'),runId=++revealRun;
 if(output)output.textContent=disclaimer?disclaimer+'\n\n':'';
 const displayPromise=revealWords(output,answer,runId);
 const speechText=[disclaimer,answer].filter(Boolean).join(' ');
 const speechPromise=speakResponse(speechText,{lang:spokenLanguage,engine:settings.speechEngine==='gemini'?'device':settings.speechEngine,onFallback:error=>{if(status)status.textContent=settings.speechLanguage==='bn-BD'?'নির্বাচিত ভয়েস চালু হয়নি। ফোনের ভয়েস ব্যবহার করা হচ্ছে।':'Using the device voice because the selected speech service failed: '+error.message;},onError:error=>{if(status)status.textContent=settings.speechLanguage==='bn-BD'?localizeSpeech(error):String(error);startSosVoiceListener();},onEnd:()=>startSosVoiceListener()});
 await Promise.allSettled([displayPromise,speechPromise]);
}
async function run(mode,question='',imageOverride=null){
 
 actionVibration(mode==='ask'?'ask':'describe');
 if(!imageOverride&&!phonePhoto)primeShutterAudio();
 const cameraSettings=getSettings();
 let wakeLock=null;
 try{
  wakeLock=await acquireWakeLock();
  if(!imageOverride&&!phonePhoto)announce('Taking several photos. Hold still.');
  if(!imageOverride&&!phonePhoto&&cameraSettings.cameraSetupComplete&&cameraSettings.cameraSource==='upload'){$('#phone-photo-upload')?.click();return;}
  const sourceBlob=imageOverride||phonePhoto||(cameraSettings.cameraSetupComplete&&cameraSettings.cameraSource==='phone'?await capturePhoneFrame():cameraSettings.cameraSetupComplete&&cameraSettings.cameraSource==='esp32'?await captureEsp32Photo():await captureImage());
  const imageBlob=sourceBlob.type==='image/jpeg'&&sourceBlob.size<3_800_000?sourceBlob:await compressImageToJpeg(sourceBlob);
  const image=await blobToDataUrl(imageBlob);
  const settings=getSettings();
  show('Sending the compressed photo for analysis.');
  const result=await requestAI(mode==='ask'&&question.trim()?'/api/ask':'/api/describe',{image,question:question.trim(),systemPrompt:settings.systemPrompt||'',customPrompt:settings.customPrompt,model:settings.aiModel,waitSeconds:settings.waitSeconds,responseStyle:settings.responseStyle,responseLanguage:settings.speechLanguage,saveToHistory:settings.savePhotoHistory===true});
  if(result.mock)throw new Error('AI is in MOCK mode. No image was analysed.');
  if(result.provider!=='Gemini'||!result.answer)throw new Error('The AI backend did not return a verified Gemini answer.');
  await announceAnswer(result.answer);
  if(status){
   const completed=settings.speechLanguage==='bn-BD'
    ?'ছবির বিশ্লেষণ সম্পন্ন হয়েছে। ব্যবহৃত মডেল: '+(result.model||'Gemini')
    :'Completed with '+(result.model||'Gemini')+'.';
   const message=settings.savePhotoHistory&&result.historyMessage
    ?result.historyMessage
    :completed;
   status.textContent=settings.speechLanguage==='bn-BD'?localizeSpeech(message):message;
   updateBlindFeedback(status.textContent);
  }
 }catch(error){
  const message=error.message||'Something went wrong.';revealRun++;if($('#result'))$('#result').textContent=message;if(status)status.textContent=message;
  updateBlindFeedback(message);
  speak(spokenError(error),{lang:getSettings().speechLanguage||'en-US'});
 }finally{await releaseWakeLock(wakeLock);startSosVoiceListener();}
}
async function startVoiceQuestion(){
 if(voiceStarting)return;
 voiceStarting=true;actionVibration('ask');stopSosVoiceListener();
 let resultHandled=false,resumed=false;
 const resume=()=>{if(resumed)return;resumed=true;startSosVoiceListener();};
 try{
  try{activeRecognition?.stop();}catch{}activeRecognition=null;show('Requesting microphone permission…');
  const settings=getSettings();
  activeRecognition=await listenOnce({lang:settings.speechInputLanguage||'bn-BD',outputLanguage:settings.speechLanguage||'en-US',preferGemini:settings.speechInputMode!=='browser',
   onPermission:()=>show('Microphone permission granted. Listening…'),
   onStart:()=>{if(status)status.textContent=settings.speechLanguage==='bn-BD'?'শুনছি। বাংলা, ইংরেজি বা দুটো মিশিয়ে বলুন।':'Browser recognition connected. Speak Bangla, English or mixed speech.';},
   onInterim:text=>{if(status)status.textContent=(getSettings().speechLanguage==='bn-BD'?'শুনেছি: ':'I heard: ')+text;},
   onFallback:message=>{if(status)status.textContent=message;},onStatus:message=>{if(status)status.textContent=message;},
   onResult:question=>{resultHandled=true;run('ask',question).finally(resume);},
   onError:message=>{show(message);speakSosStatus(spokenError(message));},
   onEnd:()=>{if(!resultHandled){if(status?.textContent.startsWith('Listening')||status?.textContent.startsWith('The browser'))announce('No speech was recognised. Please try again.');resume();}}
  });
  if(!activeRecognition&&!resultHandled)resume();
 }finally{voiceStarting=false;}
}
function speakHelp(){
 actionVibration('help');
 const settings=getSettings();let message=settings.speechLanguage==='bn-BD'?'ডেয়ারডেভিলস আই-এর সহায়িকা। প্রধান চারটি বোতাম হলো বর্ণনা, এআই-কে জিজ্ঞাসা, এসওএস এবং আবার শোনান। বর্ণনা চাপলে ক্যামেরায় যা দেখা যায় তা বলা হবে। এআই-কে জিজ্ঞাসা চাপুন, বাংলায় প্রশ্ন করুন এবং কথা শেষ হলে একটু থামুন। এসওএস পাঠাতে এসওএস বোতাম দুইবার চাপুন। আবার শোনান চাপলে শেষ উত্তরটি শোনা যাবে। অ্যাডমিনে ঐচ্ছিক স্বয়ংক্রিয় এসওএস চালু করলে তিনবার ফোন নাড়ালে আট সেকেন্ডের সতর্কীকরণ সময় শুরু হবে। ভয়েস এসওএস চালু থাকলে “ডেয়ারডেভিল এসওএস” বলুন, তারপর “নিশ্চিত করুন” বলুন। বাতিল করতে “এসওএস বাতিল” বলুন। এটি পরীক্ষামূলক সহায়ক, সাদা ছড়ি বা গাইড কুকুরের বিকল্প নয়। স্বাভাবিক চলাচলের সহায়তা ব্যবহার করতে থাকুন।':'Spoken help for Daredevil’s Eye. The four main buttons are Describe, Ask AI, SOS and Repeat. Tap Describe to hear what the camera can see. Tap Ask AI, ask a question in Bangla, English or a mixture, then pause. Tap SOS once to arm it. Tap SOS again within five seconds to confirm and send an alert to your paired receiver. Tap Repeat to hear the last answer again. Spoken Help is the separate button below the four main actions. If you enable the optional SOS triggers in Admin, three deliberate shakes start an eight-second SOS countdown. The optional voice trigger listens only while Blind mode is visible: say Daredevil SOS, then say Confirm SOS; say Cancel SOS to stop a pending alert. This is an experimental tool, not a cane or guide dog. Continue using your normal mobility aid. To leave Blind mode, edit the browser address and remove the word blind between the slashes.';
 if(window.Capacitor?.isNativePlatform?.()){
  message += settings.speechLanguage==='bn-BD'
   ? ' অ্যান্ড্রয়েড অ্যাপে ভলিউম আপ একবার চাপলে বর্ণনা, ভলিউম ডাউন একবার চাপলে এআই-কে জিজ্ঞাসা, ভলিউম আপ দুবার চাপলে আবার শোনান। দুটি ভলিউম বোতাম একসাথে ধরে রাখলে এসওএস নিশ্চিত করার পর্দা খুলবে। অন্য অ্যাপ ব্যবহার করার সময় শর্টকাট চালাতে অ্যাক্সেসিবিলিটি সেটিংস চালু করতে হবে। স্ক্রিন বন্ধ থাকলে ক্যামেরা বা মাইক্রোফোন চালু নাও হতে পারে।'
   : ' In the Android app, press Volume Up once for Describe, Volume Down once for Ask AI, and double-press Volume Up for Repeat. Hold both volume buttons to open SOS confirmation. Global shortcuts require the optional Accessibility setting. Android may restrict camera and microphone actions while the screen is off.';
 }
 show('Playing spoken help.');speakSosStatus(message);
}
async function deliverSos(){
 if(sosDispatching)return;
 sosDispatching=true;stopSosVoiceListener();setSosFeedback('Sending SOS alert to the paired phone…','sending');
 const settings=getSettings(),button=document.querySelector('[data-action="sos"]');if(button)button.disabled=true;let wakeLock=null;
 try{
  wakeLock=await acquireWakeLock();actionVibration('sos');
  const result=await requestAI('/api/sos/trigger',{deviceId:settings.deviceId});
  const message=result.message||(result.notificationAccepted?'SOS alert accepted by the push service. Delivery is not yet confirmed.':'SOS alert stored. The receiver must be online and notifications enabled.');
  setSosFeedback(message,result.notificationAccepted?'success':'warning');announce(message);
  const callLink=$('#sos-call-link');if(settings.emergencyPhone&&callLink){callLink.href='tel:'+settings.emergencyPhone.replace(/[^+0-9]/g,'');callLink.hidden=false;callLink.style.display='block';callLink.textContent='Call '+(settings.emergencyName||'trusted contact')+' now';}
 }catch(error){
  const message=error.message||'SOS alert could not be sent. Pair a receiver in Admin first.';
  setSosFeedback(message,'error');if(status)status.textContent=message;
  speak(spokenError(error),{lang:getSettings().speechLanguage||'en-US'});
 }finally{
  if(button)button.disabled=false;resetSosButton();await releaseWakeLock(wakeLock);sosDispatching=false;startSosVoiceListener();
 }
}
function armSos({shortcut=false}={}){
 const now=Date.now(),button=document.querySelector('[data-action="sos"]');
 if(sosArmedUntil>now){
  clearTimeout(sosArmTimer);sosArmedUntil=0;
  if(button)button.setAttribute('aria-pressed','false');
  setSosFeedback('SOS confirmed. Sending the alert to the paired phone…','sending');
  announce('SOS confirmed. Sending the alert now.');deliverSos();return;
 }
 const windowMs=shortcut?30000:5000;sosArmedUntil=now+windowMs;actionVibration('sos');
 if(button)button.setAttribute('aria-pressed','true');
 const message=shortcut?'SOS shortcut opened. Tap the SOS button once within thirty seconds to confirm sending the alert.':'SOS is armed. Tap SOS again within five seconds to confirm and send the alert. No alert has been sent yet.';
 setSosFeedback(message,'armed');announce(message);
 clearTimeout(sosArmTimer);sosArmTimer=setTimeout(()=>{
  sosArmedUntil=0;resetSosButton();
  const expired='SOS confirmation expired. No alert was sent. Tap SOS again to start.';
  setSosFeedback(expired,'info');announce('SOS confirmation expired. No alert was sent.');
 },windowMs);
}
function repeatAnswer(){actionVibration('repeat');if(lastAnswer)announceAnswer(lastAnswer);else announce('There is no answer to repeat yet.');}
function handleDeepLinkAction(){
 
 if(deepLinkHandled){syncSosAutomation();return;}
 if(!['describe','ask','sos','repeat','help'].includes(requestedAction)){syncSosAutomation();return;}
 deepLinkHandled=true;
 if(requestedAction==='describe')run('describe');
 else if(requestedAction==='ask')startVoiceQuestion();
 else if(requestedAction==='sos')armSos({shortcut:true});
 else if(requestedAction==='repeat')repeatAnswer();else speakHelp();
 syncSosAutomation();
}
// Consent UI was removed. Do not call showCameraSetup here: its panel bindings
// are initialized later in this module. Camera panels are rendered after setup below.
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 if(button.dataset.action==='describe')run('describe');
 if(button.dataset.action==='ask'){stopSosVoiceListener();const settings=getSettings();const prompt=settings.speechLanguage==='bn-BD'?'আপনি কী জানতে চান? বাংলায় আপনার প্রশ্ন বলুন, তারপর একটু থামুন।':'What would you like to know? Speak your question, then pause.';const utterance=speak(prompt,{lang:settings.speechLanguage||'en-US',onEnd:startVoiceQuestion,onError:startVoiceQuestion});if(!utterance)startVoiceQuestion();}
 if(button.dataset.action==='sos')armSos();if(button.dataset.action==='repeat')repeatAnswer();if(button.dataset.action==='help')speakHelp();
 if(button.dataset.action==='cancel-sos-trigger')cancelSosCountdown();
 if(button.dataset.action==='stop'){stopSpeaking();try{activeRecognition?.stop();}catch{}revealRun++;show('Speech stopped.');}
});
async function preparePhonePhoto(file,source){
 if(!file)return;
 const settings=getSettings(),panel=$('#photo-preview-panel'),askButton=$('#photo-ask-ai'),cancelButton=$('#photo-cancel'),preview=$('#photo-preview');
 try{
  if(status)status.textContent=settings.speechLanguage==='bn-BD'?'ছবি প্রস্তুত করা হচ্ছে।':'Preparing your photo…';
  const compressed=await compressImageToJpeg(file);
  phonePhoto=compressed;
  if(phonePhotoUrl)URL.revokeObjectURL(phonePhotoUrl);
  phonePhotoUrl=URL.createObjectURL(compressed);
  if(preview){preview.src=phonePhotoUrl;preview.hidden=false;preview.style.display='block';}
  if(panel)panel.hidden=false;
  const details=source+' · '+(file.size/1024/1024).toFixed(2)+' MB → '+(compressed.size/1024/1024).toFixed(2)+' MB · JPEG';
  if($('#photo-details'))$('#photo-details').textContent=details+' · '+(settings.requirePhotoConfirmation===false?'Auto-send is enabled.':'Review this exact compressed photo before sending.');
  if(askButton)askButton.disabled=false;
  if(cancelButton)cancelButton.hidden=false;
  if($('#photo-save'))$('#photo-save').hidden=false;
  if(settings.requirePhotoConfirmation===false){
   const question=$('#question')?.value.trim()||'';
   await run(question?'ask':'describe',question,compressed);
  }else{
   announce(settings.speechLanguage==='bn-BD'?'ছবিটি প্রস্তুত। পাঠানোর আগে ছবিটি দেখে এআই-কে জিজ্ঞাসা বোতাম চাপুন।':'Photo ready. Review it, then press Ask AI to send it.');
  }
 }catch(error){
  phonePhoto=null;
  if(askButton)askButton.disabled=true;
  if($('#photo-details'))$('#photo-details').textContent=error.message;
  if(status)status.textContent=error.message;
  speak(spokenError(error),{lang:getSettings().speechLanguage||'en-US'});
 }
}
$('#phone-photo-camera')?.addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';preparePhonePhoto(file,'Phone camera');});
$('#phone-photo-upload')?.addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';preparePhonePhoto(file,'Uploaded photo');});
async function savePreparedPhoto(){
 if(!phonePhoto)return;const button=$('#photo-save');if(button)button.disabled=true;
 try{const native=window.DaredevilVolumeControls;
  if(window.Capacitor?.isNativePlatform?.()&&native?.saveImage){
   const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not read photo.'));reader.readAsDataURL(phonePhoto);});
   const result=await native.saveImage({dataUrl,filename:'daredevils-eye-'+Date.now()+'.jpg'});const message=result?.message||'Photo saved in Pictures/Daredevils Eye.';if(status)status.textContent=message;announce(message);
  }else{const url=URL.createObjectURL(phonePhoto),a=document.createElement('a');a.href=url;a.download='daredevils-eye-photo.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);if(status)status.textContent='Photo download started.';}
 }catch(error){if(status)status.textContent='Could not save photo: '+error.message;announce('Could not save photo. '+error.message);}finally{if(button)button.disabled=false;}
}
$('#photo-save')?.addEventListener('click',savePreparedPhoto);
$('#photo-ask-ai')?.addEventListener('click',()=>{
 if(!phonePhoto)return;
 const question=$('#question')?.value.trim()||'';
 run(question?'ask':'describe',question,phonePhoto);
});
$('#photo-cancel')?.addEventListener('click',()=>{
 phonePhoto=null;
 if(phonePhotoUrl){URL.revokeObjectURL(phonePhotoUrl);phonePhotoUrl=null;}
 if($('#photo-preview')){$('#photo-preview').src='';$('#photo-preview').hidden=true;$('#photo-preview').style.display='none';}
 if($('#photo-preview-panel'))$('#photo-preview-panel').hidden=true;
 if($('#photo-ask-ai'))$('#photo-ask-ai').disabled=true;
 if($('#photo-cancel'))$('#photo-cancel').hidden=true;
 if($('#photo-save'))$('#photo-save').hidden=true;
 if(status)status.textContent='Photo removed. Nothing was sent.';
});
$('#question-form')?.addEventListener('submit',event=>{
 event.preventDefault();
 const question=$('#question')?.value.trim()||'';
 if(phonePhoto){run(question?'ask':'describe',question,phonePhoto);return;}
 if(question){run('ask',question);return;}
 run('describe');
});
const cameraSetupPanel=$('#camera-setup-panel');
const phoneCameraPanel=$('#phone-camera-panel');
const esp32CameraPanel=$('#esp32-camera-panel');
const esp32StreamPreview=$('#action-esp32-stream-preview');
const esp32CameraStatus=$('#esp32-camera-status');
const phoneCameraPreview=$('#phone-camera-preview');
const cameraSetupStatus=$('#camera-setup-status');
const phoneCameraStatus=$('#phone-camera-status');
const phoneCameraTorch=$('#phone-camera-torch');
function syncPhoneTorchControl(){
 const state=getPhoneTorchState();
 if(!phoneCameraTorch)return;
 phoneCameraTorch.hidden=!state.available;
 phoneCameraTorch.textContent=state.enabled?'Turn phone light off':'Turn phone light on';
 phoneCameraTorch.setAttribute('aria-pressed',String(state.enabled));
}
function renderCameraPanels(){
 const settings=getSettings();
 if(cameraSetupPanel)cameraSetupPanel.hidden=settings.cameraSetupComplete;
 if(phoneCameraPanel)phoneCameraPanel.hidden=!settings.cameraSetupComplete||settings.cameraSource!=='phone';
 if(esp32CameraPanel)esp32CameraPanel.hidden=!settings.cameraSetupComplete||settings.cameraSource!=='esp32';
}
function showCameraSetup(){
 if(!hasCurrentConsent())return;
 renderCameraPanels();
 if(cameraSetupPanel&&!getSettings().cameraSetupComplete){
  cameraSetupPanel.hidden=false;
  cameraSetupPanel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 }
}
async function chooseCameraSource(source){
 if(!['phone','esp32','upload'].includes(source))return;
 stopPhoneCamera();
 stopEsp32Stream(esp32StreamPreview);
 if(esp32StreamPreview){esp32StreamPreview.hidden=true;}
 saveSettings({cameraSource:source,cameraSetupComplete:true});
 renderCameraPanels();
 if(source==='phone'){
  if(cameraSetupStatus)cameraSetupStatus.textContent='Phone camera selected.';
  if(phoneCameraStatus)phoneCameraStatus.textContent='Phone camera selected. Press Enable phone camera to grant permission and start the preview.';
  if(phoneCameraPanel)phoneCameraPanel.hidden=false;
  if(phoneCameraPreview)phoneCameraPreview.srcObject=null;
 }else if(cameraSetupStatus){
  cameraSetupStatus.textContent=source==='esp32'?'ESP32-CAM selected. Start its live preview below; Describe captures a still image from the same camera. Confirm the address in Admin if needed.':'Upload-only selected. You can choose a photo whenever you describe a scene.';
 }
 if(source==='esp32'&&esp32CameraStatus)esp32CameraStatus.textContent='ESP32-CAM selected. Start live preview when ready. Describe will capture a separate JPEG still.';
}
document.querySelectorAll('[data-camera-source]').forEach(button=>button.addEventListener('click',()=>chooseCameraSource(button.dataset.cameraSource)));
$('#enable-phone-camera')?.addEventListener('click',async()=>{
 const button=$('#enable-phone-camera');button.disabled=true;
 try{
  await startPhoneCamera(phoneCameraPreview,{facingMode:getSettings().phoneCameraFacingMode||'environment'});
  if(cameraSetupStatus)cameraSetupStatus.textContent='Phone camera is active.';
  if(phoneCameraStatus)phoneCameraStatus.textContent='Phone camera is active. Keep this page visible; press Describe to capture a frame.';
  show('Phone camera is active.');
 }catch(error){if(cameraSetupStatus)cameraSetupStatus.textContent=error.message;if(phoneCameraStatus)phoneCameraStatus.textContent=error.message;show(error.message);}
 finally{button.disabled=false;}
});
const resetCameraSource=()=>{
 stopPhoneCamera();stopEsp32Stream(esp32StreamPreview);if(esp32StreamPreview)esp32StreamPreview.hidden=true;
 saveSettings({cameraSetupComplete:false});showCameraSetup();
};
$('#change-camera-source')?.addEventListener('click',resetCameraSource);
$('#esp32-change-camera-source')?.addEventListener('click',resetCameraSource);
let nativeEsp32PreviewTimer=null;
let nativeEsp32PreviewBusy=false;
function stopNativeEsp32Preview(){
 if(nativeEsp32PreviewTimer!==null)clearInterval(nativeEsp32PreviewTimer);
 nativeEsp32PreviewTimer=null;
 nativeEsp32PreviewBusy=false;
}
window.__deeStopNativeEsp32Preview=stopNativeEsp32Preview;
async function refreshNativeEsp32Preview(){
 if(nativeEsp32PreviewBusy||document.hidden||!esp32StreamPreview)return;
 const plugin=window.DaredevilVolumeControls;
 if(!plugin?.fetchEsp32Snapshot)return;
 nativeEsp32PreviewBusy=true;
 try{
  const result=await plugin.fetchEsp32Snapshot({url:getEsp32Endpoints().capture()});
  if(result?.base64){
   esp32StreamPreview.src='data:'+(result.contentType||'image/jpeg')+';base64,'+result.base64;
   if(esp32CameraStatus)esp32CameraStatus.textContent='ESP32 helper preview is active (native local-network snapshots).';
  }
 }catch(error){
  stopNativeEsp32Preview();
  if(esp32CameraStatus)esp32CameraStatus.textContent=error?.message||'ESP32 preview could not connect. Check the camera IP and Wi-Fi.';
 }finally{nativeEsp32PreviewBusy=false;}
}
$('#esp32-action-stream-start')?.addEventListener('click',async()=>{
 try{
  if(esp32StreamPreview)esp32StreamPreview.hidden=false;
  if(window.Capacitor?.isNativePlatform?.()){
   stopNativeEsp32Preview();
   if(esp32CameraStatus)esp32CameraStatus.textContent='Connecting to ESP32 using native local-network snapshots…';
   await refreshNativeEsp32Preview();
   if(nativeEsp32PreviewTimer===null)nativeEsp32PreviewTimer=setInterval(refreshNativeEsp32Preview,400);
  }else{
   const url=getEsp32Endpoints().stream;
   if(esp32StreamPreview)esp32StreamPreview.src=url;
   if(esp32CameraStatus)esp32CameraStatus.textContent='Connecting to ESP32 live stream. Keep both devices on the same Wi-Fi.';
  }
 }catch(error){if(esp32CameraStatus)esp32CameraStatus.textContent=error.message;}
});
$('#esp32-action-stream-stop')?.addEventListener('click',()=>{
 stopNativeEsp32Preview();stopEsp32Stream(esp32StreamPreview);if(esp32StreamPreview)esp32StreamPreview.hidden=true;
 if(esp32CameraStatus)esp32CameraStatus.textContent='Preview stopped. Describe still captures remain available.';
});
if(esp32StreamPreview){
 esp32StreamPreview.addEventListener('load',()=>{if(esp32CameraStatus)esp32CameraStatus.textContent='ESP32 live preview is active. Press Describe to capture a still image for AI analysis.';});
 esp32StreamPreview.addEventListener('error',()=>{if(!esp32StreamPreview.getAttribute('src'))return;if(esp32CameraStatus)esp32CameraStatus.textContent='Live preview could not connect. Check the ESP32 IP, Wi-Fi and Chrome Local Network Access. Still-photo capture can be tested separately.';});
}
renderCameraPanels();
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){stopPhoneCamera();stopEsp32Stream(esp32StreamPreview);if(esp32StreamPreview)esp32StreamPreview.hidden=true;}
});
window.addEventListener('pagehide',()=>{stopPhoneCamera();stopEsp32Stream(esp32StreamPreview);syncPhoneTorchControl();});



handleDeepLinkAction();




// Native Android hardware controls dispatch a DOM event through Capacitor's native bridge.
let lastNativeVolumeEventId='';
let nativeVolumePlugin=null;
function acknowledgeNativeVolumeEvent(eventId){
 if(!eventId||!nativeVolumePlugin?.ackPendingAction)return;
 nativeVolumePlugin.ackPendingAction({eventId}).catch(()=>{});
}
function handleNativeVolumeAction(event){
 const detail=event?.detail||{};
 const eventId=String(detail.eventId||'');
 if(eventId&&eventId===lastNativeVolumeEventId){acknowledgeNativeVolumeEvent(eventId);return;}
 if(eventId)lastNativeVolumeEventId=eventId;
 const action=String(detail.action||'');
 if(action==='describe')run('describe');
 else if(action==='ask')document.querySelector('[data-action="ask"]')?.click();
 else if(action==='repeat')repeatAnswer();
 else if(action==='sos')armSos({shortcut:true});
 else if(action==='help')speakHelp();
 acknowledgeNativeVolumeEvent(eventId);
}
window.addEventListener('deeVolumeAction',handleNativeVolumeAction);
window.__deeVolumeBridgeReady=true;

async function loadNativeVolumePlugin(){
 if(!window.Capacitor?.isNativePlatform?.())return;
 try{
  const core=await import('https://cdn.jsdelivr.net/npm/@capacitor/core@7.4.3/dist/index.js');
  nativeVolumePlugin=core.registerPlugin('VolumeControls');
  window.DaredevilVolumeControls=nativeVolumePlugin;
  const pending=await nativeVolumePlugin.getPendingAction();
  if(pending?.action){
   if(pending.eventId===lastNativeVolumeEventId)acknowledgeNativeVolumeEvent(pending.eventId);
   else handleNativeVolumeAction({detail:pending});
  }
 }catch(error){console.warn('Native volume controls bridge unavailable',error);}
}
loadNativeVolumePlugin();
