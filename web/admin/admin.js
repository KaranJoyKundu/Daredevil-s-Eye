import {getSettings,saveSettings} from '/shared/settings.js?v=20261116-sosmictts1';
import {requestAI} from '/shared/api.js';
import {captureImage} from '/shared/camera.js?v=20261116-sosmictts1';
import {speak,speakResponse,getAvailableVoices,VOICE_PRESETS,GEMINI_TTS_VOICES,stopSpeaking} from '/shared/speech.js?v=20261116-sosmictts1';

const $=s=>document.querySelector(s);
const form=$('#settings-form');
const saved=getSettings();
const presetValues=VOICE_PRESETS;

function normalizeCameraAddress(value){
 let address=String(value||'').trim();
 if(address&&!/^https?:\/\//i.test(address))address='http://'+address;
 address=address.replace(/\/+$/,'');
 let parsed;try{parsed=new URL(address);}catch{throw new Error('Enter a valid camera IP or URL, for example 192.168.0.104');}
 if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname)throw new Error('Enter a valid camera IP or URL, for example 192.168.0.104');
 return address;
}
function formSettings(){
 return {
  cameraBaseUrl:normalizeCameraAddress($('#camera').value),
  emergencyName:$('#contact-name').value.trim(),
  emergencyPhone:$('#contact-phone').value.trim(),
  sosPairingCode:$('#sos-code').value.trim().toUpperCase(),
  speechLanguage:$('#language').value,
  speechPreset:$('#voice-preset').value,
  speechVoiceURI:$('#voice-select').value,
  speechEngine:$('#speech-engine').value,
  geminiTtsVoice:$('#gemini-voice').value||'Kore',
  geminiTtsStyle:$('#gemini-voice-style').value.trim()||'Warm, gentle, friendly and clear adult feminine-presenting voice.',
  speechRate:Number($('#speech-rate').value),
  speechPitch:Number($('#speech-pitch').value),
  aiModel:$('#model').value||'gemini-3.8-flash',
  waitSeconds:Number($('#wait-seconds').value),
  responseStyle:$('#response-style').value,
  customPrompt:$('#prompt').value.trim()
 };
}
$('#camera').value=saved.cameraBaseUrl;
$('#contact-name').value=saved.emergencyName;
$('#contact-phone').value=saved.emergencyPhone;
$('#sos-code').value=saved.sosPairingCode;
$('#language').value=saved.speechLanguage;
$('#voice-preset').value=saved.speechPreset;
$('#speech-engine').value=saved.speechEngine;
$('#gemini-voice-style').value=saved.geminiTtsStyle;
$('#speech-rate').value=saved.speechRate;
$('#speech-pitch').value=saved.speechPitch;
$('#rate-value').textContent=Number(saved.speechRate).toFixed(2);
$('#pitch-value').textContent=Number(saved.speechPitch).toFixed(2);
$('#wait-seconds').value=String(saved.waitSeconds);
$('#response-style').value=saved.responseStyle;
$('#prompt').value=saved.customPrompt;

function populateGeminiVoices(){
 const select=$('#gemini-voice');
 select.replaceChildren();
 const female=document.createElement('optgroup');female.label='Female voices';
 const others=document.createElement('optgroup');others.label='Other voices';
 for(const voice of GEMINI_TTS_VOICES){
  const option=document.createElement('option');
  option.value=voice.id;
  option.textContent=voice.id+' · '+voice.style;
  (voice.gender==='Female'?female:others).append(option);
 }
 select.append(female,others);
 select.value=saved.geminiTtsVoice||'Kore';
}
populateGeminiVoices();

$('#generate-sos-code').addEventListener('click',()=>{
 const bytes=new Uint8Array(8);
 crypto.getRandomValues(bytes);
 $('#sos-code').value=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
 $('#message').textContent='New SOS pairing code generated. Save settings, then enter this code on the receiver phone.';
});

async function loadModels(){
 const button=$('#refresh-models');button.disabled=true;
 $('#model-status').textContent='Checking models available to your Gemini API key…';
 try{
  const response=await fetch('/api/models',{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Could not load models.');
  const select=$('#model'),selected=select.value||saved.aiModel||data.configuredModel||'gemini-3.8-flash';
  select.replaceChildren();
  for(const model of data.models){
   const option=document.createElement('option');option.value=model.id;
   option.textContent=model.name+' · '+model.id;option.title=model.description||model.id;select.append(option);
  }
  if(!data.models.some(model=>model.id===selected)){
   const option=document.createElement('option');option.value=selected;option.textContent=selected+' · saved selection (not in current list)';select.append(option);
  }
  select.value=selected;
  $('#model-status').textContent=data.models.length+' models available for generateContent. Selected: '+selected+'.';
 }catch(error){
  $('#model-status').textContent='Model list unavailable: '+error.message+'. The saved model remains selected.';
  const select=$('#model');
  if(![...select.options].some(option=>option.value===(saved.aiModel||'gemini-3.8-flash'))){
   const option=document.createElement('option');option.value=saved.aiModel||'gemini-3.8-flash';option.textContent=option.value;select.append(option);
  }
  select.value=saved.aiModel||'gemini-3.8-flash';
 }finally{button.disabled=false;}
}
$('#refresh-models').addEventListener('click',loadModels);
loadModels();

async function loadBasePrompt(){
 try{
  const response=await fetch('/api/config',{cache:'no-store'}),data=await response.json();
  $('#base-prompt').value=response.ok&&data.basePrompt?data.basePrompt:'The built-in camera scene prompt could not be loaded.';
 }catch{$('#base-prompt').value='The built-in camera scene prompt could not be loaded.';}
}
loadBasePrompt();

function populateVoices(){
 const select=$('#voice-select'),current=select.value||saved.speechVoiceURI||'';
 const voices=getAvailableVoices().slice().sort((a,b)=>a.lang.localeCompare(b.lang)||a.name.localeCompare(b.name));
 select.replaceChildren();
 const auto=document.createElement('option');auto.value='';auto.textContent='Automatic device voice';select.append(auto);
 for(const voice of voices){
  const option=document.createElement('option');option.value=voice.voiceURI;
  option.textContent=voice.name+' · '+voice.lang+(voice.default?' · system default':'');select.append(option);
 }
 select.value=current;
 $('#voice-status').textContent=voices.length
  ? voices.length+' installed voices found on this device.'
  : 'No system voices found. Use the Gemini voice library above or check device speech settings.';
}
if('speechSynthesis' in window){
 populateVoices();
 window.speechSynthesis.addEventListener?.('voiceschanged',populateVoices);
}
$('#voice-preset').addEventListener('change',()=>{
 const preset=presetValues[$('#voice-preset').value]||presetValues.gentle;
 if($('#voice-preset').value!=='custom'){
  $('#speech-rate').value=preset.rate;$('#speech-pitch').value=preset.pitch;
  $('#rate-value').textContent=preset.rate.toFixed(2);$('#pitch-value').textContent=preset.pitch.toFixed(2);
 }
});
$('#speech-rate').addEventListener('input',()=>{
 $('#rate-value').textContent=Number($('#speech-rate').value).toFixed(2);
 if($('#voice-preset').value!=='custom')$('#voice-preset').value='custom';
});
$('#speech-pitch').addEventListener('input',()=>{
 $('#pitch-value').textContent=Number($('#speech-pitch').value).toFixed(2);
 if($('#voice-preset').value!=='custom')$('#voice-preset').value='custom';
});
$('#preview-voice').addEventListener('click',async()=>{
 const options=formSettings();
 $('#voice-status').textContent='Generating voice preview…';
 try{
  if(options.speechEngine==='gemini'){
   await speakResponse('Hello. I am your Daredevil’s Eye assistant. I will describe what is visible clearly and calmly.',{
    engine:'gemini',voice:options.geminiTtsVoice,style:options.geminiTtsStyle,lang:options.speechLanguage,fallback:false
   });
  }else{
   speak('Hello. I am your Daredevil’s Eye assistant. I will describe what is visible clearly and calmly.',{
    lang:options.speechLanguage,rate:options.speechRate,pitch:options.speechPitch,voiceURI:options.speechVoiceURI
   });
  }
  $('#voice-status').textContent='Voice preview playing.';
 }catch(error){$('#voice-status').textContent='Voice preview failed: '+error.message;}
});

form.addEventListener('submit',event=>{
 event.preventDefault();
 try{
  const next=formSettings();
  if(next.sosPairingCode&&!/^[A-Z0-9]{8,20}$/.test(next.sosPairingCode))throw new Error('SOS pairing code must be 8–20 letters or numbers.');
  saveSettings(next);
  $('#camera').value=next.cameraBaseUrl;
  $('#message').textContent='All settings saved on this device. Share the SOS pairing code only with your receiver phone.';
 }catch(error){$('#message').textContent=error.message;}
});

let selectedFile=null,previewUrl=null;
function showSelectedImage(file,origin='Selected file'){
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){selectedFile=null;$('#test-image-button').disabled=true;$('#download-selected-image').disabled=true;$('#image-details').textContent='Please use a JPEG, PNG, or WebP image.';return;}
 if(file.size>4*1024*1024){selectedFile=null;$('#test-image-button').disabled=true;$('#download-selected-image').disabled=true;$('#image-details').textContent='Image is larger than 4 MB. Choose a smaller image.';return;}
 selectedFile=file;
 if(previewUrl)URL.revokeObjectURL(previewUrl);
 previewUrl=URL.createObjectURL(file);
 const preview=$('#test-preview');preview.src=previewUrl;preview.hidden=false;preview.style.display='block';
 $('#image-details').textContent=origin+' · '+file.name+' · '+(file.size/1024).toFixed(1)+' KB · '+file.type+' — this exact image will be sent.';
 $('#test-image-button').disabled=false;$('#download-selected-image').disabled=false;
 $('#test-result').textContent='';$('#test-status').textContent='';
}
$('#test-image').addEventListener('change',()=>showSelectedImage($('#test-image').files?.[0],'Selected from device'));
$('#load-image-url').addEventListener('click',async()=>{
 const button=$('#load-image-url');button.disabled=true;
 try{
  let value=$('#test-image-url').value.trim();if(!value)throw new Error('Paste a direct image URL first.');
  if(!/^https?:\/\//i.test(value))value='http://'+value;
  const url=new URL(value);
  $('#test-status').textContent='Loading image from URL for preview…';
  const response=await fetch(url.href,{cache:'no-store',mode:'cors',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Image URL returned HTTP '+response.status+'.');
  const blob=await response.blob(),type=blob.type.split(';')[0].toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('URL did not return JPEG, PNG or WebP.');
  showSelectedImage(new File([blob],'manual-url-image.'+(type==='image/png'?'png':type==='image/webp'?'webp':'jpg'),{type}),'Loaded from URL '+url.origin);
  $('#test-status').textContent='Image loaded. Check the preview, then send it to AI.';
 }catch(error){$('#test-status').textContent=error.name==='AbortError'?'Image URL timed out.':error instanceof TypeError?'Browser could not read this URL, possibly because its host blocks CORS. Download it and choose the file instead.':error.message;}
 finally{button.disabled=false;}
});
$('#capture-camera-button').addEventListener('click',async()=>{
 const button=$('#capture-camera-button');button.disabled=true;$('#test-status').textContent='Capturing a still photo from ESP32-CAM…';
 try{
  const blob=await captureImage();
  showSelectedImage(new File([blob],'esp32-camera-capture.jpg',{type:blob.type||'image/jpeg'}),'Captured from ESP32-CAM');
  $('#test-status').textContent='Camera photo captured. Check the preview before sending.';
 }catch(error){$('#test-status').textContent='Camera capture failed: '+error.message;}
 finally{button.disabled=false;}
});
$('#download-selected-image').addEventListener('click',()=>{
 if(!selectedFile||!previewUrl)return;
 const anchor=document.createElement('a');
 anchor.href=previewUrl;
 anchor.download=selectedFile.name||'daredevils-eye-camera.jpg';
 document.body.append(anchor);anchor.click();anchor.remove();
});
$('#test-image-button').addEventListener('click',async()=>{
 if(!selectedFile)return;
 const button=$('#test-image-button');button.disabled=true;
 const selected={aiModel:$('#model').value||'gemini-3.8-flash',waitSeconds:Number($('#wait-seconds').value),responseStyle:$('#response-style').value,customPrompt:$('#prompt').value.trim()};
 $('#test-status').textContent='Sending to '+selected.aiModel+'. Waiting up to '+selected.waitSeconds+' seconds…';$('#test-result').textContent='';
 try{
  const dataUrl=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read selected image.'));reader.readAsDataURL(selectedFile);
  });
  const question=$('#test-question').value.trim();
  const result=await requestAI(question?'/api/ask':'/api/describe',{
   image:dataUrl,question,customPrompt:selected.customPrompt,model:selected.aiModel,
   waitSeconds:selected.waitSeconds,responseStyle:selected.responseStyle
  });
  if(result.mock)throw new Error('Mock mode is enabled. No image analysis was performed.');
  $('#test-result').textContent=(result.disclaimer||'')+'\n\n'+result.answer;
  $('#test-status').textContent='Completed using '+(result.model||selected.aiModel)+'.';
 }catch(error){$('#test-status').textContent='AI test failed: '+(error.message||'Unknown error');}
 finally{button.disabled=!selectedFile;}
});
