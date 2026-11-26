import {getSettings,saveSettings} from '/shared/settings.js?v=20261117-release5';
import {requestAI,apiFetch,getSessionGeminiApiKey,setSessionGeminiApiKey,clearSessionGeminiApiKey} from '/shared/api.js?v=20261117-release5';
import {captureImage} from '/shared/camera.js?v=20261117-release1';
import { getEsp32Endpoints, setEsp32LedBrightness, testEsp32Connection, stopEsp32Stream, captureEsp32Photo } from '/shared/camera-manager.js?v=20261126-camera1';
import {speak,speakResponse,getAvailableVoices,isBengaliVoice,refreshAvailableVoices,VOICE_PRESETS,GEMINI_TTS_VOICES,stopSpeaking} from '/shared/speech.js?v=20261117-release5';

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
  requirePhotoConfirmation:$('#require-photo-confirmation').checked,
  savePhotoHistory:$('#save-photo-history').checked,
  sceneMemoryEnabled:$('#scene-memory-enabled').checked,
  emergencyName:$('#contact-name').value.trim(),
  emergencyPhone:$('#contact-phone').value.trim(),
  speechLanguage:$('#language').value,
  speechInputMode:$('#speech-input-mode').value,
  speechInputLanguage:$('#input-language').value,
  sosShakeEnabled:$('#sos-shake-enabled').checked,
  sosVoiceEnabled:$('#sos-voice-enabled').checked,
  sosVoiceLanguage:$('#sos-voice-language').value,
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
  systemPrompt:systemPromptValue(),
  customPrompt:$('#prompt').value.trim()
 };
}
const esp32Status=$('#esp32-status'),esp32Preview=$('#esp32-stream-preview');
$('#esp32-brightness')?.addEventListener('input',event=>{$('#esp32-brightness-value').textContent=event.target.value;});
$('#esp32-test')?.addEventListener('click',async()=>{
 const button=$('#esp32-test');button.disabled=true;if(esp32Status)esp32Status.textContent='Testing ESP32 /capture…';
 try{const result=await testEsp32Connection();if(esp32Status)esp32Status.textContent='Connected to '+result.address+'. /capture returned an image'+(result.bytes?' ('+result.bytes+' bytes).':'.');}
 catch(error){if(esp32Status)esp32Status.textContent=error.message;}
 finally{button.disabled=false;}
});
$('#esp32-set-brightness')?.addEventListener('click',async()=>{
 const button=$('#esp32-set-brightness');button.disabled=true;
 try{const value=await setEsp32LedBrightness($('#esp32-brightness').value);if(esp32Status)esp32Status.textContent='ESP32 LED brightness set to '+value+'.';}
 catch(error){if(esp32Status)esp32Status.textContent=error.message;}
 finally{button.disabled=false;}
});
$('#esp32-stream-start')?.addEventListener('click',()=>{
 try{const url=getEsp32Endpoints().stream;esp32Preview.src=url;esp32Preview.hidden=false;esp32Preview.style.display='block';if(esp32Status)esp32Status.textContent='Connecting to '+url+'.';}
 catch(error){if(esp32Status)esp32Status.textContent=error.message;}
});
$('#esp32-stream-stop')?.addEventListener('click',()=>{stopEsp32Stream(esp32Preview);esp32Preview.hidden=true;esp32Preview.style.display='none';if(esp32Status)esp32Status.textContent='Stream connection closed. The ESP32 firmware has no separate stream-off endpoint.';});
window.addEventListener('pagehide',()=>stopEsp32Stream(esp32Preview));

$('#clear-scene-memory')?.addEventListener('click',async()=>{
 if(!window.confirm('Permanently clear the five saved visual observations for this account or browser?'))return;
 const button=$('#clear-scene-memory');button.disabled=true;$('#scene-memory-status').textContent='Clearing visual memory…';
 try{const response=await apiFetch('/api/memory',{method:'DELETE',credentials:'same-origin'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Could not clear visual memory.');$('#scene-memory-status').textContent='Saved visual memory cleared.';}
 catch(error){$('#scene-memory-status').textContent=error.message;}
 finally{button.disabled=false;}
});
$('#personal-api-key').value=getSessionGeminiApiKey();
$('#personal-key-status').textContent=getSessionGeminiApiKey()?'A personal key is active for this tab.':'No personal key is set in this tab.';
$('#save-personal-key').addEventListener('click',()=>{
 try{setSessionGeminiApiKey($('#personal-api-key').value);$('#personal-api-key').value='';$('#personal-key-status').textContent='Personal key active in this tab. Refreshing ranked models…';loadModels();}
 catch(error){$('#personal-key-status').textContent=error.message;}
});
$('#remove-personal-key').addEventListener('click',()=>{clearSessionGeminiApiKey();$('#personal-api-key').value='';$('#personal-key-status').textContent='Personal key removed from this tab. Using the project key if configured.';loadModels();});
$('#camera').value=saved.cameraBaseUrl;
$('#require-photo-confirmation').checked=saved.requirePhotoConfirmation!==false;
$('#save-photo-history').checked=saved.savePhotoHistory!==false;
$('#scene-memory-enabled').checked=saved.sceneMemoryEnabled===true;
$('#scene-memory-status').textContent=saved.sceneMemoryEnabled?'Enabled. The latest five text observations are available to this account/browser.':'Disabled. No new observations will be stored.';
$('#contact-name').value=saved.emergencyName;
$('#contact-phone').value=saved.emergencyPhone;
$('#sos-code').value=saved.sosPairingCode;
$('#language').value=saved.speechLanguage;
$('#speech-input-mode').value=saved.speechInputMode||'auto';
$('#input-language').value=saved.speechInputLanguage||'bn-BD';
$('#sos-shake-enabled').checked=!!saved.sosShakeEnabled;
$('#sos-voice-enabled').checked=!!saved.sosVoiceEnabled;
$('#sos-voice-language').value=saved.sosVoiceLanguage||'bn-BD';
$('#voice-preset').value=saved.speechPreset;
$('#speech-engine').value=saved.speechEngine==='gemini'?'device':saved.speechEngine;
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

$('#enable-shake-sos').addEventListener('click',async()=>{
 const button=$('#enable-shake-sos');button.disabled=true;
 try{
  if(!$('#sos-shake-enabled').checked)throw new Error('Tick “Enable three-shake SOS” first, then press this button.');
  if(!('DeviceMotionEvent'in window))throw new Error('This browser does not expose the phone motion sensor.');
  if(typeof DeviceMotionEvent.requestPermission==='function'){
   const permission=await DeviceMotionEvent.requestPermission();
   if(permission!=='granted')throw new Error('Motion sensor permission was not granted.');
  }
  saveSettings({sosShakeEnabled:true});
  $('#sos-shake-status').textContent='Enabled. In Blind mode, three strong, separate shakes start an eight-second SOS countdown.';
 }catch(error){
  $('#sos-shake-enabled').checked=false;saveSettings({sosShakeEnabled:false});
  $('#sos-shake-status').textContent='Could not enable shake SOS: '+error.message;
 }finally{button.disabled=false;}
});
$('#enable-voice-sos').addEventListener('click',async()=>{
 const button=$('#enable-voice-sos');button.disabled=true;let stream=null;
 try{
  if(!$('#sos-voice-enabled').checked)throw new Error('Tick “Enable voice SOS phrase” first, then press this button.');
  if(!(window.SpeechRecognition||window.webkitSpeechRecognition))throw new Error('This browser does not support continuous speech recognition.');
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone access is unavailable. Open the HTTPS site in a supported browser.');
  stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  stream.getTracks().forEach(track=>track.stop());stream=null;
  const language=$('#sos-voice-language').value;
  saveSettings({sosVoiceEnabled:true,sosVoiceLanguage:language});
  $('#sos-voice-status').textContent='Enabled. In visible Blind mode say “Daredevil SOS”, then “Confirm SOS”. Say “Cancel SOS” during the five-second countdown to stop it.';
 }catch(error){
  if(stream)stream.getTracks().forEach(track=>track.stop());
  $('#sos-voice-enabled').checked=false;saveSettings({sosVoiceEnabled:false});
  $('#sos-voice-status').textContent='Could not enable voice SOS: '+error.message;
 }finally{button.disabled=false;}
});

$('#generate-sos-code').addEventListener('click',async()=>{
 const button=$('#generate-sos-code');button.disabled=true;
 try{
  const result=await requestAI('/api/sos/invite',{deviceId:saved.deviceId});
  $('#sos-code').value=result.code;
  $('#message').textContent='New six-character code generated. It expires in 10 minutes and immediately disconnects the previous receiver. Give it to the receiver phone now.';
 }catch(error){$('#message').textContent='Could not create SOS invitation: '+error.message;}
 finally{button.disabled=false;}
});

async function loadModels(){
 const button=$('#refresh-models');button.disabled=true;
 $('#model-status').textContent='Checking models available to your Gemini API key…';
 try{
  const response=await apiFetch('/api/models');
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Could not load models.');
  const select=$('#model'),savedModel=saved.aiModel==='gemini-3.6-flash'?'gemini-3.8-flash':saved.aiModel,selected=select.value==='gemini-3.6-flash'?'gemini-3.8-flash':(select.value||savedModel||data.configuredModel||'gemini-3.8-flash');
  select.replaceChildren();
  for(const model of data.models){
   const option=document.createElement('option');option.value=model.id;
   option.textContent='#'+(model.rank||select.options.length+1)+' · '+(model.tierLabel||'Vision model')+' · '+model.name+' · '+model.id;option.title=model.description||model.id;select.append(option);
  }
  if(!data.models.some(model=>model.id===selected)){
   const option=document.createElement('option');option.value=selected;option.textContent=selected+' · saved selection (not in current list)';select.append(option);
  }
  select.value=selected;
  $('#model-status').textContent=data.models.length+' ranked vision models available. Automatic fallback is enabled. Selected: '+selected+'.';
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

let defaultSystemPrompt='';
const PROMPT_PRESETS={
 object:'Identify the single main object in front of the camera: the one nearest the centre and most in focus. Say its most likely name first in a few words, then one short sentence with the visible details that support it, such as brand, printed text, colour or shape. If you are not certain, still give the best match and say "possibly". Ignore background objects unless the user asks about them.',
 medicine:'You recognise Bangladeshi medicine names. Use the visible box, strip or bottle label in the photo and any medicine name the user speaks. Account for Bangladeshi pronunciation and accents, local pharmaceutical brands and generic names, phonetically similar medicine names, and mispronunciation, unclear speech and variations in pronunciation. If the exact name is unclear, make your best guess based on similar-sounding medicines commonly available in Bangladesh. Return ONLY the most likely medicine name. No explanations, no confidence scores, no alternative names, no additional text.',
 text:'Read the visible text for a blind user. Start with the most important text, such as a heading, product name, price, date or warning, then read the rest in natural reading order. Read words exactly; do not summarise unless the text is very long. Say when text is cut off, blurry or too small to read.',
 taka:'Identify Bangladeshi taka banknotes and coins in the image. Say the value of each note or coin, then the total amount. If a note is folded, covered or unclear, say which one and give your best guess. Do not describe anything else unless the user asks.',
 colour:'Help a blind user with colours. Name the main colours and any pattern of the main item, usually clothing or fabric, using everyday colour words such as navy blue, light grey or dark red. If several items are visible, say whether their colours go well together. Mention stains or marks only when clearly visible.'
};
// The mode is derived from the saved prompt text, so no extra setting is stored.
function promptMode(value){const v=value.trim();if(!v||v===defaultSystemPrompt.trim())return 'all';return Object.keys(PROMPT_PRESETS).find(key=>PROMPT_PRESETS[key]===v)||'custom';}
// Empty means "use the built-in prompt", so an unchanged default is stored as ''.
function systemPromptValue(){const value=$('#base-prompt').value.trim();return value===defaultSystemPrompt.trim()?'':value;}
async function loadBasePrompt(){
 const box=$('#base-prompt');box.value=saved.systemPrompt||'';
 try{
  const response=await apiFetch('/api/config'),data=await response.json();
  if(response.ok&&data.basePrompt){defaultSystemPrompt=data.basePrompt;if(!box.value)box.value=defaultSystemPrompt;}
 }catch{}
 if(!box.value)box.placeholder='The built-in prompt could not be loaded. Leave this empty to use it.';
 $('#prompt-preset').value=promptMode(box.value);
}
$('#reset-base-prompt').addEventListener('click',()=>{$('#base-prompt').value=defaultSystemPrompt;$('#base-prompt').dispatchEvent(new Event('input',{bubbles:true}));});
$('#prompt-preset').addEventListener('change',event=>{
 const box=$('#base-prompt'),mode=event.target.value;
 if(mode==='custom'){box.focus();return;}
 box.value=mode==='all'?defaultSystemPrompt:PROMPT_PRESETS[mode];box.dispatchEvent(new Event('input',{bubbles:true}));
});
$('#base-prompt').addEventListener('input',()=>{$('#prompt-preset').value=promptMode($('#base-prompt').value);});
loadBasePrompt();

function populateVoices(available=getAvailableVoices()){
 const select=$('#voice-select'),current=select.value||saved.speechVoiceURI||'';
 const voices=(Array.isArray(available)?available:[]).slice().sort((a,b)=>a.lang.localeCompare(b.lang)||a.name.localeCompare(b.name));
 select.replaceChildren();
 const auto=document.createElement('option');auto.value='';auto.textContent='Automatic device voice (let Android choose)';select.append(auto);
 for(const voice of voices){const option=document.createElement('option');option.value=voice.voiceURI;option.textContent=voice.name+' · '+voice.lang+(voice.default?' · system default':'');select.append(option);}
 select.value=[...select.options].some(option=>option.value===current)?current:'';
 const hasBangla=voices.some(isBengaliVoice);
 $('#voice-status').textContent=hasBangla
  ?'Bengali voice found: '+voices.filter(isBengaliVoice).map(voice=>voice.name+' ('+voice.lang+')').join(', ')+'.'
  :voices.length
   ?voices.length+' voices listed, but none is labelled Bengali. Chrome may still route a bn-BD utterance to Android TTS; use Preview selected voice to test it.'
   :'Chrome has not exposed voice names. The app will still request Bengali directly from Android using bn-BD; use Preview selected voice to test.';
}
if('speechSynthesis' in window){
 populateVoices();
 window.speechSynthesis.addEventListener?.('voiceschanged',()=>populateVoices());
 refreshAvailableVoices(5000).then(voices=>populateVoices(voices));
}
$('#refresh-voices')?.addEventListener('click',async()=>{
 const button=$('#refresh-voices');button.disabled=true;$('#voice-status').textContent='Waiting for Android / Chrome to refresh speech voices…';
 try{const voices=await refreshAvailableVoices(6000);populateVoices(voices);$('#voice-status').textContent=voices.some(isBengaliVoice)?'Bengali voice is now listed. Select it and press Preview selected voice.':'No Bengali voice name was exposed after waiting. The app will still ask Android TTS for bn-BD; press Preview selected voice to test playback.';}
 catch(error){$('#voice-status').textContent='Voice refresh failed: '+error.message;}
 finally{button.disabled=false;}
});
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
   const previewText=options.speechLanguage==='bn-BD'?'হ্যালো। আমি ডেয়ারডেভিলস আই। আমি যা দেখতে পাচ্ছি, তা স্পষ্টভাবে বর্ণনা করব।':'Hello. I am your Daredevil’s Eye assistant. I will describe what is visible clearly and calmly.';
   speak(previewText,{lang:options.speechLanguage,rate:options.speechRate,pitch:options.speechPitch,voiceURI:options.speechVoiceURI,onError:error=>{$('#voice-status').textContent=options.speechLanguage==='bn-BD'?'এই ফোনে বাংলা বলার কণ্ঠস্বর পাওয়া যায়নি। অ্যান্ড্রয়েডের টেক্সট-টু-স্পিচ সেটিংসে বাংলা ভয়েস ডেটা ইনস্টল করুন।':error;}});
  }
  $('#voice-status').textContent='Voice preview playing.';
 }catch(error){$('#voice-status').textContent='Voice preview failed: '+error.message;}
});

form.addEventListener('submit',async event=>{
 event.preventDefault();
 // The Save button sits outside <form> (form="settings-form"); form.elements includes it, querySelector does not.
 const submitButton=[...form.elements].find(el=>el.type==='submit');
 if(submitButton)submitButton.disabled=true;
 try{
  const next=formSettings();
  saveSettings(next);
  $('#camera').value=next.cameraBaseUrl;
  $('#message').textContent='All settings saved on this device. Generate a fresh SOS invitation whenever you want to pair or replace the receiver.';
 }catch(error){$('#message').textContent=error.message;}
 finally{if(submitButton)submitButton.disabled=false;}
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
$('#capture-flash-camera-button')?.addEventListener('click',async()=>{
 const button=$('#capture-flash-camera-button');button.disabled=true;$('#test-status').textContent='Capturing a still photo with ESP32 flash…';
 try{
  const blob=await captureEsp32Photo({flash:true});
  showSelectedImage(new File([blob],'esp32-camera-flash.jpg',{type:blob.type||'image/jpeg'}),'Captured from ESP32-CAM with flash');
  $('#test-status').textContent='Flash photo captured. Check the preview before sending.';
 }catch(error){$('#test-status').textContent='Flash capture failed: '+error.message;}
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
 const selected={aiModel:$('#model').value||'gemini-3.8-flash',waitSeconds:Number($('#wait-seconds').value),responseStyle:$('#response-style').value,systemPrompt:systemPromptValue(),customPrompt:$('#prompt').value.trim()};
 $('#test-status').textContent='Sending to '+selected.aiModel+'. Waiting up to '+selected.waitSeconds+' seconds…';$('#test-result').textContent='';
 try{
  const dataUrl=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read selected image.'));reader.readAsDataURL(selectedFile);
  });
  const question=$('#test-question').value.trim();
  const result=await requestAI(question?'/api/ask':'/api/describe',{
   image:dataUrl,question,systemPrompt:selected.systemPrompt,customPrompt:selected.customPrompt,model:selected.aiModel,
   waitSeconds:selected.waitSeconds,responseStyle:selected.responseStyle,responseLanguage:getSettings().speechLanguage
  });
  if(result.mock)throw new Error('Mock mode is enabled. No image analysis was performed.');
  $('#test-result').textContent=(result.disclaimer||'')+'\n\n'+result.answer;
  $('#test-status').textContent='Completed using '+(result.model||selected.aiModel)+'.';
 }catch(error){$('#test-status').textContent='AI test failed: '+(error.message||'Unknown error');}
 finally{button.disabled=!selectedFile;}
});
