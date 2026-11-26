import {speak} from './speech.js?v=20261126-rfid3';
import {getSettings} from './settings.js?v=20261117-release5';
import {hasCurrentConsent} from './consent.js?v=20261117-release5';

const ENABLED_KEY='de_rfid_listener_enabled_v1';
let timer=null,busy=false,speaking=false,lastErrorAt=0,speakingWatchdog=null;
const enabled=()=>{try{return localStorage.getItem(ENABLED_KEY)!=='0';}catch{return true;}};
async function acknowledge(eventId){
 const response=await fetch('/api/rfid/events/ack',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({eventId})});
 return response.ok;
}
function unlockSpeech(){
 try{window.speechSynthesis?.resume();}catch{}
}
async function poll(){
 if(busy||speaking||!enabled()||!hasCurrentConsent()||document.hidden)return;
 busy=true;
 try{
  const response=await fetch('/api/rfid/events',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401){await fetch('/api/account/session',{credentials:'same-origin',cache:'no-store'}).catch(()=>{});return;}
  if(response.status===503)return;
  if(!response.ok)throw new Error('Could not check medicine events.');
  const data=await response.json();
  const event=Array.isArray(data.events)?data.events[0]:null;
  if(!event?.id||!event?.medicine)return;
  const settings=getSettings();
  const text=String(event.speechText||event.medicine).slice(0,1200);
  speaking=true;
  clearTimeout(speakingWatchdog);
  speakingWatchdog=setTimeout(()=>{speaking=false;},25000);
  const finish=()=>{clearTimeout(speakingWatchdog);speaking=false;};
  const result=speak(text,{
   lang:settings.speechLanguage||'bn-BD',
   onEnd:()=>{finish();acknowledge(event.id).catch(()=>{});},
   onError:error=>{finish();if(Date.now()-lastErrorAt>30000){lastErrorAt=Date.now();console.warn('[RFID listener]',error);}}
  });
  if(result===false)finish();
 }catch(error){
  if(Date.now()-lastErrorAt>30000){lastErrorAt=Date.now();console.warn('[RFID listener]',error.message);}
 }finally{busy=false;}
}
function onUserActivity(){
 unlockSpeech();
 if(enabled())poll();
}
export function startRFIDListener(){
 if(timer)return;
 timer=setInterval(poll,2500);
 window.addEventListener('storage',event=>{if(event.key===ENABLED_KEY&&enabled())poll();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){unlockSpeech();poll();}});
 // Scrolling, touching or keyboard navigation can unlock speech on browsers
 // that suspend speech output until the user interacts with the page.
 window.addEventListener('scroll',onUserActivity,{passive:true});
 window.addEventListener('pointerdown',onUserActivity,{passive:true});
 window.addEventListener('touchstart',onUserActivity,{passive:true});
 window.addEventListener('keydown',onUserActivity);
 poll();
}
export function setRFIDListenerEnabled(value){
 try{localStorage.setItem(ENABLED_KEY,value?'1':'0');}catch{}
 if(value){unlockSpeech();poll();}
}
export function isRFIDListenerEnabled(){return enabled();}
