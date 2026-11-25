import {speak} from '../shared/speech.js?v=20261126-rfid1';
import {getSettings} from '../shared/settings.js?v=20261117-release5';
import {setRFIDListenerEnabled,isRFIDListenerEnabled} from '../shared/rfid-listener.js?v=20261126-rfid1';

const $=id=>document.getElementById(id);
const status=(id,message)=>{const el=$(id);if(el)el.textContent=message;};
async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Request failed ('+response.status+').');
 return data;
}
async function loadDevices(){
 try{
  const session=await api('/api/account/session');
  if(!session.authenticated){$('device-list').innerHTML='<p class="medicine-muted">You are not signed in. <a href="/account/">Sign in or create an account</a> first.</p>';status('pair-status','Sign in to generate a pairing code.');return;}
  const data=await api('/api/rfid/devices');
  const list=$('device-list');list.replaceChildren();
  if(!data.devices?.length){const p=document.createElement('p');p.className='medicine-muted';p.textContent='No RFID reader is paired yet.';list.append(p);return;}
  for(const device of data.devices){
   const row=document.createElement('div');row.className='medicine-device';
   const info=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small'),button=document.createElement('button');
   strong.textContent='RFID reader · '+device.deviceId.slice(0,8);
   small.textContent=device.lastSeenAt?'Last scan: '+new Date(device.lastSeenAt).toLocaleString():'Paired '+new Date(device.createdAt).toLocaleString();
   button.type='button';button.textContent='Revoke';
   button.addEventListener('click',async()=>{if(!confirm('Revoke this RFID reader? Its saved token will stop working.'))return;try{await api('/api/rfid/devices/'+device.deviceId,{method:'DELETE'});status('device-status','Device revoked.');loadDevices();}catch(e){status('device-status',e.message);}});
   info.append(strong,small);row.append(info,button);list.append(row);
  }
 }catch(error){$('device-list').textContent=error.message;status('device-status',error.message);}
}
$('generate-code').addEventListener('click',async()=>{
 const button=$('generate-code');button.disabled=true;status('pair-status','Generating a secure one-time code…');
 try{const data=await api('/api/rfid/pair/start',{method:'POST',body:'{}'});$('pair-code').textContent=data.code;status('pair-status','Code expires in 10 minutes. Enter it into the ESP32 serial monitor.');}
 catch(error){$('pair-code').textContent='------';status('pair-status',error.message);}
 finally{button.disabled=false;}
});
const toggle=$('listener-enabled');toggle.checked=isRFIDListenerEnabled();
toggle.addEventListener('change',()=>{
 setRFIDListenerEnabled(toggle.checked);
 status('listener-status',toggle.checked?'Medicine announcements enabled across app pages.':'Medicine announcements paused.');
});
$('test-speech').addEventListener('click',()=>{
 const settings=getSettings();
 speak('Medicine: Napa One',{lang:settings.speechLanguage||'bn-BD',onError:error=>status('listener-status',error),onEnd:()=>status('listener-status','Test announcement finished.')});
 status('listener-status','Playing test announcement…');
});
$('refresh-devices').addEventListener('click',loadDevices);
loadDevices();
