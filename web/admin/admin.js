import {getSettings,saveSettings} from '/shared/settings.js';
import {requestAI} from '/shared/api.js';
import {captureImage} from '/shared/camera.js';
const $=s=>document.querySelector(s);
const form=$('#settings-form'),s=getSettings();
function normalizeCameraAddress(value){
 let address=String(value||'').trim();
 if(address && !/^https?:\/\//i.test(address)) address='http://'+address;
 address=address.replace(/\/+$/,'');
 let parsed; try{parsed=new URL(address);}catch{throw new Error('Enter a valid camera IP or URL, for example 192.168.0.104');}
 if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname) throw new Error('Enter a valid http:// or https:// camera address.');
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
 if(file.size>4*1024*1024){selectedFile=null;$('#test-image-button').disabled=true;$('#image-details').textContent='Image is too large. Choose an image under 4 MB.';return;}
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
$('#capture-camera-button').addEventListener('click',async()=>{
 const button=$('#capture-camera-button');button.disabled=true;$('#test-status').textContent='Requesting a still photo from the ESP32-CAM /capture endpoint…';
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
 const button=$('#test-image-button');button.disabled=true;$('#test-status').textContent='Sending the previewed image to Gemini…';$('#test-result').textContent='';
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read selected image.'));reader.readAsDataURL(selectedFile);});
  const question=$('#test-question').value.trim();
  const result=await requestAI(question?'/api/ask':'/api/describe',{image:dataUrl,question,customPrompt:getSettings().customPrompt});
  $('#test-result').textContent=(result.disclaimer||'')+'\n\n'+result.answer;
  $('#test-status').textContent='AI request completed. Review the response below.';
 }catch(error){$('#test-status').textContent='AI test failed: '+(error.message||'Unknown error');}
 finally{button.disabled=!selectedFile;}
});