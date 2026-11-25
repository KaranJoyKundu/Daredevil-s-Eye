import {speak} from './speech.js?v=20261126-rfid1';
import {getSettings} from './settings.js?v=20261117-release5';

const ENABLED_KEY='de_rfid_listener_enabled_v1';
let timer=null,busy=false,speaking=false,lastErrorAt=0;
const enabled=()=>{try{return localStorage.getItem(ENABLED_KEY)==='1';}catch{return false;}};
async function acknowledge(eventId){
 const response=await fetch('/api/rfid/events/ack',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({eventId})});
 return response.ok;
}
async function poll(){
 if(busy||speaking||!enabled()||document.hidden)return;
 busy=true;
 try{
  const response=await fetch('/api/rfid/events',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401||response.status===503)return;
  if(!response.ok)throw new Error('Could not check medicine events.');
  const data=await response.json();
  const event=Array.isArray(data.events)?data.events[0]:null;
  if(!event?.id||!event?.medicine)return;
  const settings=getSettings();
  const text='Medicine: '+String(event.medicine).slice(0,100);
  speaking=true;
  const finish=()=>{speaking=false;};
  const result=speak(text,{
   lang:settings.speechLanguage||'bn-BD',
   onEnd:()=>{finish();acknowledge(event.id).catch(()=>{});},
   onError:finish
  });
  if(result===false)speaking=false;
  // speech.js callbacks are asynchronous; release the poll lock immediately.
 }catch(error){
  if(Date.now()-lastErrorAt>30000){lastErrorAt=Date.now();console.warn('[RFID listener]',error.message);}
 }finally{busy=false;}
}
export function startRFIDListener(){
 if(timer)return;
 timer=setInterval(poll,3000);
 window.addEventListener('storage',event=>{if(event.key===ENABLED_KEY&&enabled())poll();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
 poll();
}
export function setRFIDListenerEnabled(value){
 try{localStorage.setItem(ENABLED_KEY,value?'1':'0');}catch{}
 if(value)poll();
}
export function isRFIDListenerEnabled(){return enabled();}
