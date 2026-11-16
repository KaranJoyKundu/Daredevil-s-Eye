import {getSettings} from '/shared/settings.js?v=20261116-public1';
import {captureImage,blobToDataUrl} from '/shared/camera.js?v=20261116-public1';
import {requestAI,apiFetch} from '/shared/api.js?v=20261116-public1';
import {listenOnce,speak,speakResponse,stopSpeaking} from '/shared/speech.js?v=20261116-public1';

const $=selector=>document.querySelector(selector);
let latestCameraBlob=null,latestCameraUrl=null,selectedAiFile=null,micController=null;
let micState={hardware:false,permission:false,recognition:false,transcript:'',error:''};


function getPhoneProfile(){
 const ua=navigator.userAgent||'';
 const androidMatch=ua.match(/Android\s([0-9.]+)/i);
 const modelMatch=ua.match(/\b(SM-[A-Z0-9]+)\b/i);
 const browser=/SamsungBrowser\//i.test(ua)?'Samsung Internet':
  /EdgA\//i.test(ua)?'Microsoft Edge for Android':
  /CriOS\//i.test(ua)?'Chrome for iOS':
  /Chrome\//i.test(ua)?'Chrome':
  /Firefox\//i.test(ua)?'Firefox':'Other / not identified';
 const voices=window.speechSynthesis?.getVoices?.()||[];
 const banglaVoices=voices.filter(voice=>/^bn(?:-|$)/i.test(voice.lang||''));
 const mimeTypes=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus']
  .filter(type=>window.MediaRecorder?.isTypeSupported?.(type));
 return [
  'Device model: '+(modelMatch?.[1]||'Not exposed by browser'),
  'Android version (browser report): '+(androidMatch?.[1]||'Not exposed / not Android UA'),
  'Browser: '+browser,
  'Browser version / user agent: '+ua,
  'Secure HTTPS context: '+(window.isSecureContext?'yes':'no'),
  'Microphone API: '+(navigator.mediaDevices?.getUserMedia?'available':'unavailable'),
  'MediaRecorder: '+('MediaRecorder'in window?'available':'unavailable'),
  'Supported recording formats: '+(mimeTypes.join(', ')||'browser default only / none detected'),
  'Speech recognition API: '+(window.SpeechRecognition||window.webkitSpeechRecognition?'available':'not exposed'),
  'Speech synthesis API: '+('speechSynthesis'in window?'available':'unavailable'),
  'Installed Bengali device voices: '+(banglaVoices.length?banglaVoices.map(v=>v.name+' ('+v.lang+')').join('; '):'none currently reported'),
  'Wake Lock API: '+(navigator.wakeLock?.request?'available':'unavailable'),
  'Vibration API: '+(navigator.vibrate?'available':'unavailable'),
  'Device motion API: '+('DeviceMotionEvent'in window?'available':'unavailable'),
  'Service worker: '+('serviceWorker'in navigator?'available':'unavailable'),
  'Installed / standalone display: '+(window.matchMedia?.('(display-mode: standalone)').matches?'yes':'no'),
  'Screen: '+screen.width+' × '+screen.height+' CSS pixels; DPR '+(window.devicePixelRatio||1),
  'Memory hint: '+(navigator.deviceMemory?navigator.deviceMemory+' GB (browser estimate)':'not exposed'),
  'Logical CPU cores: '+(navigator.hardwareConcurrency||'not exposed'),
  '',
  'Target profile: Android 16 Samsung Galaxy (first reference device: Galaxy A55).',
  'Note: browsers may hide or reduce device details. Confirm the exact model in Android Settings → About phone.'
 ].join('\n');
}
$('#run-phone-check').addEventListener('click',()=>{
 $('#phone-output').textContent=getPhoneProfile();
 $('#phone-status').textContent='Phone and browser capability report generated. Review any unavailable APIs below.';
});
$('#test-motion-sensor').addEventListener('click',async()=>{
 const button=$('#test-motion-sensor');button.disabled=true;
 $('#phone-status').textContent='Requesting motion access if this browser requires it. Move the phone gently for five seconds.';
 let permission='not required / browser does not expose a permission prompt',count=0,lastMagnitude=null;
 try{
  if(typeof DeviceMotionEvent==='undefined')throw new Error('DeviceMotionEvent is not available in this browser.');
  if(typeof DeviceMotionEvent.requestPermission==='function'){
   permission=await DeviceMotionEvent.requestPermission();
   if(permission!=='granted')throw new Error('Motion permission was not granted.');
  }
  const listener=event=>{
   count++;
   const v=event.accelerationIncludingGravity||event.acceleration;
   if(v&&[v.x,v.y,v.z].every(Number.isFinite))lastMagnitude=Math.hypot(v.x,v.y,v.z).toFixed(2);
  };
  window.addEventListener('devicemotion',listener,{passive:true});
  await new Promise(resolve=>setTimeout(resolve,5000));
  window.removeEventListener('devicemotion',listener);
  $('#phone-output').textContent=getPhoneProfile()+'\n\nMotion permission: '+permission+'\nMotion events received in 5 seconds: '+count+'\nLast sensor magnitude: '+(lastMagnitude??'no usable reading')+'\n\nThis only confirms that readings reached the browser. It does not validate SOS sensitivity or false-trigger safety.';
  $('#phone-status').textContent=count?'Motion sensor delivered readings. Do not use this result as a safety guarantee.':'No motion readings received. Check browser permissions and device sensor availability.';
 }catch(error){
  $('#phone-output').textContent=getPhoneProfile()+'\n\nMotion test failed: '+error.message;
  $('#phone-status').textContent='Motion test could not complete: '+error.message;
 }finally{button.disabled=false;}
});

async function runCamera(){
 const button=$('#run-camera');button.disabled=true;
 $('#camera-status').textContent='Capturing from '+getSettings().cameraBaseUrl+'…';
 $('#camera-output').textContent='';
 try{
  latestCameraBlob=await captureImage();
  const preview=$('#camera-preview');
  if(latestCameraUrl)URL.revokeObjectURL(latestCameraUrl);
  latestCameraUrl=URL.createObjectURL(latestCameraBlob);
  preview.src=latestCameraUrl;preview.hidden=false;preview.style.display='block';
  $('#download-camera-image').disabled=false;
  $('#camera-status').textContent='Camera capture successful.';
  $('#camera-output').textContent='Endpoint: '+getSettings().cameraBaseUrl+'/capture\nImage size: '+latestCameraBlob.size.toLocaleString()+' bytes\nContent type: '+(latestCameraBlob.type||'image/jpeg');
  $('#ai-status').textContent='A camera image is ready for the AI tester.';
  return true;
 }catch(error){
  latestCameraBlob=null;$('#download-camera-image').disabled=true;
  $('#camera-status').textContent='Camera test failed: '+error.message;
  $('#camera-output').textContent='Check the camera address in Admin and confirm /capture opens directly in your browser.';
  return false;
 }finally{button.disabled=false;}
}
$('#run-camera').addEventListener('click',runCamera);
$('#download-camera-image').addEventListener('click',()=>{
 if(!latestCameraBlob||!latestCameraUrl)return;
 const anchor=document.createElement('a');
 anchor.href=latestCameraUrl;anchor.download='daredevils-eye-camera-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jpg';
 document.body.append(anchor);anchor.click();anchor.remove();
});

async function startMic(){
 micState={hardware:false,permission:false,recognition:false,transcript:'',error:''};
 $('#mic-transcript').value='';
 $('#mic-status').textContent='Requesting microphone permission…';
 $('#run-mic').disabled=true;$('#stop-mic').disabled=false;
 micController=await listenOnce({
  lang:getSettings().speechLanguage,
  onPermission:()=>{micState.hardware=true;micState.permission=true;$('#mic-status').textContent='Microphone found and permission granted. Starting recognition…';},
  onStart:()=>{micState.recognition=true;$('#mic-status').textContent='Speech recognition started. Say a sentence…';},
  onFallback:message=>{$('#mic-status').textContent=message;},
  onStatus:message=>{$('#mic-status').textContent=message;},
  onInterim:text=>{$('#mic-transcript').value=text;$('#mic-status').textContent='Listening: '+text;},
  onResult:text=>{micState.transcript=text;$('#mic-transcript').value=text;$('#mic-status').textContent='Speech recognised.';},
  onError:error=>{micState.error=error;$('#mic-status').textContent=error;},
  onEnd:()=>{
   $('#run-mic').disabled=false;$('#stop-mic').disabled=true;
   if(!micState.transcript&&!micState.error){micState.error='No speech was recognised. Speak clearly and try again.';$('#mic-status').textContent=micState.error;}
  }
 });
 if(!micController){$('#run-mic').disabled=false;$('#stop-mic').disabled=true;return null;}
 $('#mic-status').textContent='Microphone permission granted. Listening now — say a short sentence.';
 return micController;
}
$('#run-mic').addEventListener('click',startMic);
$('#stop-mic').addEventListener('click',()=>{
 try{micController?.stop();}catch{}
 micController=null;$('#run-mic').disabled=false;$('#stop-mic').disabled=true;$('#mic-status').textContent='Microphone test stopped.';
});

$('#diag-ai-file').addEventListener('change',()=>{
 selectedAiFile=$('#diag-ai-file').files?.[0]||null;
 if(!selectedAiFile){$('#diag-ai-preview').hidden=true;$('#diag-ai-preview').style.display='none';return;}
 if(!['image/jpeg','image/png','image/webp'].includes(selectedAiFile.type)||selectedAiFile.size>4*1024*1024){
  selectedAiFile=null;$('#ai-status').textContent='Choose a JPEG, PNG or WebP image under 4 MB.';return;
 }
 const preview=$('#diag-ai-preview');preview.src=URL.createObjectURL(selectedAiFile);preview.hidden=false;preview.style.display='block';
 $('#ai-status').textContent='Selected '+selectedAiFile.name+'.';
});
async function runAiTest(){
 const button=$('#run-ai-test');button.disabled=true;$('#ai-output').textContent='';
 const settings=getSettings();
 try{
  const imageBlob=selectedAiFile||latestCameraBlob;
  if(!imageBlob)throw new Error('Capture a camera photo or choose an image first.');
  const image=await blobToDataUrl(imageBlob);
  $('#ai-status').textContent='Sending to '+settings.aiModel+' (wait limit '+settings.waitSeconds+' seconds)…';
  const question=$('#diag-ai-question').value.trim();
  const result=await requestAI(question?'/api/ask':'/api/describe',{
   image,question,model:settings.aiModel,waitSeconds:settings.waitSeconds,
   responseStyle:settings.responseStyle,customPrompt:settings.customPrompt,responseLanguage:settings.speechLanguage
  });
  if(result.mock)throw new Error('Mock mode returned no real image analysis.');
  $('#ai-output').textContent=(result.disclaimer||'')+'\n\n'+result.answer;
  $('#ai-status').textContent='AI response completed with '+(result.model||settings.aiModel)+'.';
  return true;
 }catch(error){
  $('#ai-status').textContent='AI test failed: '+error.message;
  $('#ai-output').textContent='No verified AI result was returned.';
  return false;
 }finally{button.disabled=false;}
}
$('#run-ai-test').addEventListener('click',runAiTest);

async function runSpeaker(){
 const settings=getSettings();
 const text=settings.speechLanguage==='bn-BD'
  ? 'হ্যালো। এটি ডেয়ারডেভিলস আই-এর কণ্ঠস্বর পরীক্ষা। আমি পরিষ্কার ও শান্তভাবে কথা বলব।'
  : 'Hello. This is a voice test for Daredevil’s Eye. I will speak clearly and calmly.';
 try{
  if(settings.speechEngine==='gemini'){
   await speakResponse(text,{engine:'gemini',voice:settings.geminiTtsVoice,style:settings.geminiTtsStyle,lang:settings.speechLanguage,fallback:false});
  }else{
   const utterance=speak(text,{lang:settings.speechLanguage,rate:settings.speechRate,pitch:settings.speechPitch,voiceURI:settings.speechVoiceURI});
   if(!utterance)throw new Error('This browser does not provide device speech synthesis.');
  }
  $('#speaker-status').textContent='Speech playback was started. Confirm that you can hear it.';
  return true;
 }catch(error){$('#speaker-status').textContent='Speaker test failed: '+error.message;return false;}
}
$('#run-speaker').addEventListener('click',runSpeaker);
$('#stop-speaker').addEventListener('click',()=>{stopSpeaking();$('#speaker-status').textContent='Speech stopped.';});

async function systemCheck(){
 const output=$('#system-output');output.textContent='Checking…';
 try{
  const [healthResponse,modelsResponse]=await Promise.all([
   fetch('/api/health',{cache:'no-store'}),
   apiFetch('/api/models')
  ]);
  const health=await healthResponse.json(),models=await modelsResponse.json().catch(()=>({}));
  const lines=[
   'Backend: '+(healthResponse.ok?'online':'HTTP '+healthResponse.status),
   'AI mode: '+(health.mode||'unknown'),
   'Model: '+(getSettings().aiModel||health.model||'not selected'),
   'API key loaded: '+(health.apiKeyConfigured?'yes':'no'),
   'Gemini API key configured: '+(health.providerConfigured?'yes':'no'),
   'Mock mode: '+(health.mockModeExplicitlyEnabled?'enabled':'disabled'),
   'Available generateContent models: '+(models.models?.length??'could not load'),
   'Microphone secure context: '+(window.isSecureContext?'yes':'no'),
   'Browser: '+(/SamsungBrowser\//i.test(navigator.userAgent)?'Samsung Internet':/Chrome\//i.test(navigator.userAgent)?'Chrome':'other / not identified'),
   'Android version (if exposed): '+(navigator.userAgent.match(/Android\s([0-9.]+)/i)?.[1]||'not exposed'),
   'SOS receiver relay: '+(health.sosRelayConfigured?'configured':'check Wrangler Durable Object binding')
  ];
  if(models.error)lines.push('Model list error: '+models.error);
  output.textContent=lines.join('\n');
  return healthResponse.ok;
 }catch(error){output.textContent='System check failed: '+error.message;return false;}
}
$('#run-system').addEventListener('click',systemCheck);
systemCheck();

$('#run-all-tests').addEventListener('click',async()=>{
 const button=$('#run-all-tests');button.disabled=true;
 const report=[];
 $('#all-tests-status').textContent='Starting all checks…';
 $('#all-tests-output').textContent='';
 // Start the microphone permission request immediately within the click action.
 const micStart=startMic();
 const sysPromise=systemCheck();
 const cameraOK=await runCamera();
 report.push('CAMERA HARDWARE / CAPTURE: '+(cameraOK?'PASS':'FAIL — '+$('#camera-status').textContent));
 const mic=await micStart;
 if(mic){
  $('#all-tests-status').textContent='Microphone is listening. Speak a complete sentence now…';
  await new Promise(resolve=>setTimeout(resolve,8000));
  try{mic.stop();}catch{}
  micController=null;$('#run-mic').disabled=false;$('#stop-mic').disabled=true;
 }
 report.push('MICROPHONE HARDWARE: '+(micState.hardware?'PASS':'NOT CONFIRMED'));
 report.push('MICROPHONE PERMISSION: '+(micState.permission?'PASS':'FAIL — '+(micState.error||$('#mic-status').textContent)));
 report.push('SPEECH RECOGNITION START: '+(micState.recognition?'PASS':'FAIL / UNSUPPORTED'));
 report.push('SPEECH TRANSCRIPTION: '+(micState.transcript?'PASS — '+micState.transcript:'FAIL — '+(micState.error||'No final transcript was received.')));
 const systemOK=await sysPromise;
 report.push('BACKEND / MODEL / SOS: '+(systemOK?'PASS':'CHECK — '+$('#system-output').textContent));
 if(cameraOK||selectedAiFile){
  const aiOK=await runAiTest();
  report.push('GEMINI IMAGE ANALYSIS: '+(aiOK?'PASS':'FAIL — '+$('#ai-status').textContent));
 }else report.push('GEMINI IMAGE ANALYSIS: SKIPPED — provide a camera photo or image file.');
 const speakerOK=await runSpeaker();
 report.push('SPEAKER PLAYBACK START: '+(speakerOK?'REQUEST SENT — confirm you heard it':'FAIL — '+$('#speaker-status').textContent));
 $('#all-tests-output').textContent=report.join('\n\n');
 $('#all-tests-status').textContent='Combined check finished. Review each individual test and any errors above.';
 button.disabled=false;
});
