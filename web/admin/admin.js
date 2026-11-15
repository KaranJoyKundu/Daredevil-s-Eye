import {getSettings,saveSettings} from '/shared/settings.js';
const form=document.querySelector('#settings-form'),s=getSettings();
document.querySelector('#camera').value=s.cameraBaseUrl;
document.querySelector('#contact-name').value=s.emergencyName;
document.querySelector('#contact-phone').value=s.emergencyPhone;
document.querySelector('#language').value=s.speechLanguage;
document.querySelector('#rate').value=s.speechRate;
document.querySelector('#prompt').value=s.customPrompt;
form.addEventListener('submit',e=>{e.preventDefault();const cameraBaseUrl=document.querySelector('#camera').value.trim().replace(/\/+$/,'');if(!/^https?:\/\//i.test(cameraBaseUrl)){document.querySelector('#message').textContent='Enter a valid http:// or https:// camera address.';return;}saveSettings({cameraBaseUrl,emergencyName:document.querySelector('#contact-name').value.trim(),emergencyPhone:document.querySelector('#contact-phone').value.trim(),speechLanguage:document.querySelector('#language').value,speechRate:Number(document.querySelector('#rate').value),customPrompt:document.querySelector('#prompt').value.trim()});document.querySelector('#message').textContent='Settings saved on this device.';});