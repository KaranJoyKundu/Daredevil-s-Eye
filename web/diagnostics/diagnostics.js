import {getSettings} from '/shared/settings.js?v=20261116-admin-controls1';
import {captureImage} from '/shared/camera.js?v=20261116-admin-controls1';
import {blobToDataUrl} from '/shared/camera.js?v=20261116-admin-controls1';
import {requestAI} from '/shared/api.js';
import {listenOnce,speak,stopSpeaking} from '/shared/speech.js?v=20261116-admin-controls1';

const $=s=>document.querySelector(s);
let latestCameraBlob=null;
let selectedAiFile=null;
let micRecognition=null;

$('#run-camera').addEventListener('click',async()=>{
 const button=$('#run-camera');button.disabled=true;
 $('#camera-status').textContent='Capturing from '+getSettings().cameraBaseUrl+'…';
 $('#camera-output').textContent='';
 try{
  latestCameraBlob=await captureImage();
  const preview=$('#camera-preview');
  preview.src=URL.createObjectURL(latestCameraBlob);
  preview.hidden=false;preview.style.display='block';
  $('#camera-status').textContent='Camera capture successful.';
  $('#camera-output').textContent='Endpoint: '+getSettings().cameraBaseUrl+'/capture\nImage size: '+latestCameraBlob.size.toLocaleString()+' bytes\nContent type: '+(latestCameraBlob.type||'image/jpeg');
  $('#ai-status').textContent='A camera image is ready for the AI tester.';
 }catch(error){
  latestCameraBlob=null;
  $('#camera-status').textContent='Camera test failed: '+error.message;
  $('#camera-output').textContent='Check the camera address in Admin and confirm /capture opens directly in your browser.';
 }finally{button.disabled=false;}
});

$('#run-mic').addEventListener('click',()=>{
 $('#mic-transcript').value='';
 $('#mic-status').textContent='Listening… speak now.';
 $('#run-mic').disabled=true;$('#stop-mic').disabled=false;
 micRecognition=listenOnce({
  lang:getSettings().speechLanguage,
  onInterim:text=>{$('#mic-transcript').value=text;},
  onResult:text=>{$('#mic-transcript').value=text;$('#mic-status').textContent='Speech recognised.';},
  onError:error=>{$('#mic-status').textContent=error;},
  onEnd:()=>{$('#run-mic').disabled=false;$('#stop-mic').disabled=true;if($('#mic-status').textContent==='Listening… speak now.')$('#mic-status').textContent='Listening ended. Try again if no words appeared.';}
 });
 if(!micRecognition){$('#run-mic').disabled=false;$('#stop-mic').disabled=true;}
});
$('#stop-mic').addEventListener('click',()=>{
 try{micRecognition?.stop();}catch{}
 micRecognition=null;$('#run-mic').disabled=false;$('#stop-mic').disabled=true;$('#mic-status').textContent='Microphone test stopped.';
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
$('#run-ai-test').addEventListener('click',async()=>{
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
 }catch(error){
  $('#ai-status').textContent='AI test failed: '+error.message;
  $('#ai-output').textContent='No verified AI result was returned.';
 }finally{button.disabled=false;}
});

$('#run-speaker').addEventListener('click',()=>{
 const settings=getSettings();
 const result=speak('Hello. This is a voice test for Daredevil’s Eye. I will speak clearly and calmly.',{
  lang:settings.speechLanguage,rate:settings.speechRate,pitch:settings.speechPitch
 });
 $('#speaker-status').textContent=result?'Playing the saved device voice and style.':'Speech synthesis is unavailable in this browser.';
});
$('#stop-speaker').addEventListener('click',()=>{stopSpeaking();$('#speaker-status').textContent='Speech stopped.';});

async function systemCheck(){
 const output=$('#system-output');output.textContent='Checking…';
 try{
  const [healthResponse,modelsResponse]=await Promise.all([
   fetch('/api/health',{cache:'no-store'}),
   fetch('/api/models',{cache:'no-store'})
  ]);
  const health=await healthResponse.json();
  const models=await modelsResponse.json().catch(()=>({}));
  const lines=[
   'Backend: '+(healthResponse.ok?'online':'HTTP '+healthResponse.status),
   'AI mode: '+(health.mode||'unknown'),
   'Model: '+(getSettings().aiModel||health.model||'not selected'),
   'API key loaded: '+(health.apiKeyConfigured?'yes':'no'),
   'Provider ready: '+(health.providerConnected?'yes':'no'),
   'Mock mode: '+(health.mockModeExplicitlyEnabled?'enabled':'disabled'),
   'Available generateContent models: '+(models.models?.length??'could not load')
  ];
  if(models.error)lines.push('Model list error: '+models.error);
  output.textContent=lines.join('\n');
 }catch(error){output.textContent='System check failed: '+error.message;}
}
$('#run-system').addEventListener('click',systemCheck);
systemCheck();
