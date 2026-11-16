import {getSettings} from '/shared/settings.js?v=20261116-sosmictts1';
import {captureImage,blobToDataUrl} from '/shared/camera.js?v=20261116-sosmictts1';
import {requestAI} from '/shared/api.js';
import {listenOnce,speak,speakResponse,stopSpeaking} from '/shared/speech.js?v=20261116-sosmictts1';

const $=selector=>document.querySelector(selector);
let latestCameraBlob=null,latestCameraUrl=null,selectedAiFile=null,micController=null;

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
 $('#mic-transcript').value='';
 $('#mic-status').textContent='Requesting microphone permission…';
 $('#run-mic').disabled=true;$('#stop-mic').disabled=false;
 micController=await listenOnce({
  lang:getSettings().speechLanguage,
  onInterim:text=>{$('#mic-transcript').value=text;$('#mic-status').textContent='Listening: '+text;},
  onResult:text=>{$('#mic-transcript').value=text;$('#mic-status').textContent='Speech recognised.';},
  onError:error=>{$('#mic-status').textContent=error;},
  onEnd:()=>{
   $('#run-mic').disabled=false;$('#stop-mic').disabled=true;
   if($('#mic-status').textContent.startsWith('Listening'))$('#mic-status').textContent='Listening ended. No final transcript was recognised.';
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
   responseStyle:settings.responseStyle,customPrompt:settings.customPrompt
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
 const text='Hello. This is a voice test for Daredevil’s Eye. I will speak clearly and calmly.';
 try{
  if(settings.speechEngine==='gemini'){
   await speakResponse(text,{engine:'gemini',voice:settings.geminiTtsVoice,style:settings.geminiTtsStyle,lang:settings.speechLanguage,fallback:false});
  }else{
   speak(text,{lang:settings.speechLanguage,rate:settings.speechRate,pitch:settings.speechPitch,voiceURI:settings.speechVoiceURI});
  }
  $('#speaker-status').textContent='Playing the selected voice.';
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
   fetch('/api/models',{cache:'no-store'})
  ]);
  const health=await healthResponse.json(),models=await modelsResponse.json().catch(()=>({}));
  const lines=[
   'Backend: '+(healthResponse.ok?'online':'HTTP '+healthResponse.status),
   'AI mode: '+(health.mode||'unknown'),
   'Model: '+(getSettings().aiModel||health.model||'not selected'),
   'API key loaded: '+(health.apiKeyConfigured?'yes':'no'),
   'Provider ready: '+(health.providerConnected?'yes':'no'),
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
 report.push('Microphone: permission request started.');
 const cameraOK=await runCamera();
 report.push('Camera: '+(cameraOK?'PASS':'FAILED'));
 const mic=await micStart;
 if(mic){
  $('#all-tests-status').textContent='Speak now for the microphone test (up to 6 seconds)…';
  await new Promise(resolve=>setTimeout(resolve,6000));
  try{mic.stop();}catch{}
  micController=null;$('#run-mic').disabled=false;$('#stop-mic').disabled=true;
  report.push('Microphone permission: PASS. Transcript: '+($('#mic-transcript').value||'(no speech recognised)'));
 }else{
  report.push('Microphone: '+$('#mic-status').textContent);
 }
 const systemOK=await sysPromise;
 report.push('System/backend: '+(systemOK?'PASS':'CHECK OUTPUT ABOVE'));
 if(cameraOK){
  const aiOK=await runAiTest();
  report.push('Gemini image analysis: '+(aiOK?'PASS':'FAILED'));
 }else report.push('Gemini image analysis: SKIPPED because camera failed.');
 const speakerOK=await runSpeaker();
 report.push('Speaker: '+(speakerOK?'PASS':'FAILED'));
 $('#all-tests-output').textContent=report.join('\n\n');
 $('#all-tests-status').textContent='Combined check finished. Review each individual test and any errors above.';
 button.disabled=false;
});
