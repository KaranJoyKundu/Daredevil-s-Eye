import {getSettings,saveSettings} from '/shared/settings.js?v=20261116-urlfix4';
import {requestAI} from '/shared/api.js';
import {captureImage} from '/shared/camera.js?v=20261116-urlfix4';
const $=s=>document.querySelector(s);
const form=$('#settings-form'),s=getSettings();
function normalizeCameraAddress(value){
 let address=String(value||'').trim();
 if(address && !/^https?:\/\//i.test(address)) address='http://'+address;
 address=address.replace(/\/+$/,'');
 let parsed;try{parsed=new URL(address);}catch{throw new Error('Enter a valid camera IP or URL, for example 192.168.0.104');}
 if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname) throw new Error('Enter a valid camera IP or URL, for example 192.168.0.104');
 return address;
}
$('#camera').value=s.cameraBaseUrl;
$('#contact-name').value=s.emergencyName;
$('#contact-phone').value=s.emergencyPhone;
$('#language').value=s.speechLanguage;
$('#rate').value=s.speechRate;
$('#prompt').value=s.customPrompt;
form.addEventListener('submit',e=>{
 e.preventDefault();
 try{
  const cameraBaseUrl=normalizeCameraAddress($('#camera').value);
  saveSettings({cameraBaseUrl,emergencyName:$('#contact-name').value.trim(),emergencyPhone:$('#contact-phone').value.trim(),speechLanguage:$('#language').value,speechRate:Number($('#rate').value),customPrompt:$('#prompt').value.trim()});
  $('#camera').value=cameraBaseUrl;
  $('#message').textContent='Settings saved on this device. Camera address: '+cameraBaseUrl;
 }catch(error){$('#message').textContent=error.message;}
});
let selectedFile=null,previewUrl=null;
function showSelectedImage(file,origin='Selected file'){
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){selectedFile=null;$('#test-image-button').disabled=true;$('#image-details').textContent='Please use a JPEG, PNG, or WebP image.';return;}
 if(file.size>4*1024*1024){selectedFile=null;$('#test-image-button').disabled=true;$('#image-details').textContent='Image is larger than 4 MB. Choose a smaller image.';return;}
 selectedFile=file;
 if(previewUrl)URL.revokeObjectURL(previewUrl);
 previewUrl=URL.createObjectURL(file);
 const preview=$('#test-preview');preview.src=previewUrl;preview.hidden=false;preview.style.display='block';
 $('#image-details').textContent=origin+' · '+file.name+' · '+(file.size/1024).toFixed(1)+' KB · '+file.type+' — this exact image will be sent.';
 $('#test-image-button').disabled=false;
 $('#test-result').textContent='';
 $('#test-status').textContent='';
}
$('#test-image').addEventListener('change',()=>showSelectedImage($('#test-image').files?.[0], 'Selected from device'));
$('#load-image-url').addEventListener('click',async()=>{
 const button=$('#load-image-url');button.disabled=true;
 try{
  let value=$('#test-image-url').value.trim();
  if(!value)throw new Error('Paste a direct image URL first.');
  if(!/^https?:\/\//i.test(value))value='http://'+value;
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol))throw new Error('Image URL must use http:// or https://.');
  $('#test-status').textContent='Loading image from URL for preview…';
  const response=await fetch(url.href,{cache:'no-store',mode:'cors',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Image URL returned HTTP '+response.status+'.');
  const blob=await response.blob();
  const type=blob.type.split(';')[0].toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('URL did not return a JPEG, PNG, or WebP image (received '+(type||'unknown content type')+').');
  const file=new File([blob],'manual-url-image.'+(type==='image/png'?'png':type==='image/webp'?'webp':'jpg'),{type});
  showSelectedImage(file,'Loaded from URL '+url.origin);
  $('#test-status').textContent='Image URL loaded. Inspect the preview, then send this exact image to Gemini.';
 }catch(error){
  const detail=error.name==='AbortError'?'Image URL request timed out.':error instanceof TypeError?'Browser could not fetch this URL. The image host may block cross-origin (CORS) requests; try downloading the image and using Choose image file.':(error.message||'Could not load image URL.');
  $('#test-status').textContent='URL image test failed: '+detail;
 }finally{button.disabled=false;}
});
$('#capture-camera-button').addEventListener('click',async()=>{
 const button=$('#capture-camera-button');button.disabled=true;$('#test-status').textContent='Requesting still photo from ESP32-CAM /capture…';
 try{
  const blob=await captureImage();
  const file=new File([blob],'esp32-camera-capture.jpg',{type:blob.type||'image/jpeg'});
  showSelectedImage(file,'Captured from ESP32-CAM');
  $('#test-status').textContent='Camera capture succeeded. Inspect the preview, then send this exact frame to AI.';
 }catch(error){$('#test-status').textContent='Camera capture failed: '+(error.message||'Unknown error');}
 finally{button.disabled=false;}
});
$('#test-image-button').addEventListener('click',async()=>{
 if(!selectedFile)return;
 const button=$('#test-image-button');button.disabled=true;$('#test-status').textContent='Sending the previewed image to AI…';$('#test-result').textContent='';
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read selected image.'));reader.readAsDataURL(selectedFile);});
  const question=$('#test-question').value.trim();
  const result=await requestAI(question?'/api/ask':'/api/describe',{image:dataUrl,question,customPrompt:getSettings().customPrompt});
  $('#test-result').textContent=(result.disclaimer||'')+'\n\n'+result.answer;
  $('#test-status').textContent='AI request completed. Review the response below.';
 }catch(error){$('#test-status').textContent='AI test failed: '+(error.message||'Unknown error');}
 finally{button.disabled=!selectedFile;}
});