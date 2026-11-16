import {getSettings} from '/shared/settings.js?v=20261116-public1';
import {captureImage,blobToDataUrl} from '/shared/camera.js?v=20261116-public1';
import {requestAI,apiFetch} from '/shared/api.js?v=20261116-public1';
import {listenOnce,speak,speakResponse,stopSpeaking} from '/shared/speech.js?v=20261116-public1';

const $=selector=>document.querySelector(selector);
let latestCameraBlob=null,latestCameraUrl=null,selectedAiFile=null,micController=null;
let micState={hardware:false,permission:false,recognition:false,transcript:'',error:''};

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
