import {speak} from '../shared/speech.js?v=20261126-rfid2';
import {getSettings} from '../shared/settings.js?v=20261117-release5';
import {setRFIDListenerEnabled,isRFIDListenerEnabled} from '../shared/rfid-listener.js?v=20261126-rfid2';

const $=id=>document.getElementById(id);
const status=(id,message)=>{const el=$(id);if(el)el.textContent=message;};
function announceMedicine(name){
 const settings=getSettings();
 status('scan-status','Speaking '+name+'…');
 const result=speak(name,{
  lang:settings.speechLanguage||'bn-BD',
  onError:error=>status('scan-status','Speech error: '+error),
  onEnd:()=>status('scan-status','Finished: '+name)
 });
 if(result===false)status('scan-status','Speech could not start. Check browser audio permissions and try again.');
}
$('scan-napa').addEventListener('click',()=>announceMedicine('Napa One'));
$('scan-monus').addEventListener('click',()=>announceMedicine('Monus 10'));
const toggle=$('listener-enabled');
toggle.checked=isRFIDListenerEnabled();
toggle.addEventListener('change',()=>{
 setRFIDListenerEnabled(toggle.checked);
 status('listener-status',toggle.checked?'Medicine announcements enabled across app pages.':'Medicine announcements paused.');
});
$('test-speech').addEventListener('click',()=>announceMedicine('Napa One'));

const provisionButton=$('provision-device');
const tokenOutput=$('device-token');
const copyButton=$('copy-device-token');
let issuedToken='';
provisionButton.addEventListener('click',async()=>{
 provisionButton.disabled=true;
 status('provision-status','Authorizing this browser account…');
 try{
  const response=await fetch('/api/rfid/devices/provision',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok||!/^[a-f0-9]{64}$/i.test(data.deviceToken||''))throw new Error(data.error||'Could not authorize the ESP32. Sign in and try again.');
  issuedToken=data.deviceToken;
  tokenOutput.textContent=issuedToken;
  copyButton.disabled=false;
  status('provision-status','ESP32 authorized for this account. Copy the token into Serial Monitor. This token is shown only once.');
 }catch(error){status('provision-status',error.message);}
 finally{provisionButton.disabled=false;}
});
copyButton.addEventListener('click',async()=>{
 if(!issuedToken)return;
 try{await navigator.clipboard.writeText(issuedToken);status('provision-status','Device token copied. Paste it into the ESP32 Serial Monitor.');}
 catch{status('provision-status','Clipboard unavailable. Select and copy the token above manually.');}
});
