import {getSettings,saveSettings} from '/shared/settings.js';
import {requestAI} from '/shared/api.js';
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
$('#test-image').addEventListener('change',()=>{
 selectedFile=$('#test-image').files?.[0]||null;
 $('#test-result').textContent='';
 $('#test-status').textContent='';
 $('#test-image-button').disabled=!selectedFile;
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 const preview=$('#test-preview');
 if(!selectedFile){preview.removeAttribute('src');preview.hidden=true;preview.style.display='none';$('#image-details').textContent='No image selected.';return;}
 if(!['image/jpeg','image/png','image/webp'].includes(selectedFile.type)){selectedFile=null;$('#test-image-button').disabled=true;$('#image-details').textContent='Please choose a JPEG, PNG, or WebP image.';return;}
 if(selectedFile.size>4*1024*1024){selectedFile=null;$('#test-image-button').disabled=true;$('#image-details').textContent='Image is too large. Choose an image under 4 MB.';return;}
 previewUrl=URL.createObjectURL(selectedFile);preview.src=previewUrl;preview.hidden=false;preview.style.display='block';
 $('#image-details').textContent=selectedFile.name+' · '+(selectedFile.size/1024).toFixed(1)+' KB · '+selectedFile.type+' — this is the image that will be sent.';
});
$('#test-image-button').addEventListener('click',async()=>{
 if(!selectedFile)return;
 const button=$('#test-image-button');button.disabled=true;$('#test-status').textContent='Sending selected image to AI…';$('#test-result').textContent='';
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read selected image.'));reader.readAsDataURL(selectedFile);});
  const question=$('#test-question').value.trim();
  const result=await requestAI(question?'/api/ask':'/api/describe',{image:dataUrl,question,customPrompt:getSettings().customPrompt});
  $('#test-result').textContent=(result.disclaimer||'')+'\n\n'+result.answer;
  $('#test-status').textContent='AI request completed. Review the response below.';
 }catch(error){$('#test-status').textContent='AI test failed: '+(error.message||'Unknown error');}
 finally{button.disabled=!selectedFile;}
});