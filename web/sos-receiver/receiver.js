import {requestPublic} from '/shared/api.js?v=20261116-auth1';

const $=selector=>document.querySelector(selector);
const DEVICE_KEY='daredevils-eye.receiver.device.v2';
const TOKEN_KEY='daredevils-eye.receiver.token.v3';
const LEGACY_TOKEN_KEY='daredevils-eye.receiver.token.v2';
const LEGACY_DEVICE_KEY='daredevils-eye.receiver.device.v2';
let deviceId=localStorage.getItem(DEVICE_KEY)||localStorage.getItem(LEGACY_DEVICE_KEY)||'';
let receiverToken=localStorage.getItem(TOKEN_KEY)||sessionStorage.getItem(LEGACY_TOKEN_KEY)||'';
if(deviceId)localStorage.setItem(DEVICE_KEY,deviceId);
if(receiverToken)localStorage.setItem(TOKEN_KEY,receiverToken);
let pollTimer=null,speechTimer=null,lastEventId='',audioContext=null,oscillator=null,gainNode=null,alarmLoop=null,wakeLock=null,isConnected=false,polling=false;

function updateStatus(message){$('#receiver-status').textContent=message;}
function base64UrlToBytes(value){
 const base64=String(value).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(value).length+3)%4);
 const binary=atob(base64);
 return Uint8Array.from(binary,character=>character.charCodeAt(0));
}
async function registerPushNotifications(){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){
  throw new Error('This browser does not support background push notifications. Foreground polling will still work.');
 }
 if(Notification.permission==='denied')throw new Error('Notifications are blocked for this site. Allow notifications in Android site settings.');
 if(Notification.permission!=='granted'){
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Notification permission was not granted. Foreground polling will still work.');
 }
 const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
 const keyData=await requestPublic('/api/sos/push-key',{deviceId});
 if(!keyData.applicationServerKey)throw new Error('The server did not provide a push application key.');
 const applicationServerKey=base64UrlToBytes(keyData.applicationServerKey);
 let subscription=await registration.pushManager.getSubscription();
 if(subscription){
  const savedKey=subscription.options?.applicationServerKey;
  const savedBytes=savedKey?Array.from(new Uint8Array(savedKey)):null;
  const expectedBytes=Array.from(applicationServerKey);
  if(!savedBytes||savedBytes.length!==expectedBytes.length||savedBytes.some((byte,index)=>byte!==expectedBytes[index])){
   await subscription.unsubscribe();
   subscription=null;
  }
 }
 if(!subscription){
  subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
 }
 const saved=await requestPublic('/api/sos/subscribe',{deviceId,receiverToken,subscription:subscription.toJSON()});
 if(!saved.pushSubscribed)throw new Error('The server could not save this receiver subscription.');
 return true;
}
function setConnected(connected){
 $('#pairing-panel').hidden=connected;
 $('#connected-panel').hidden=!connected;
}
async function unlockAudio(){
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass)throw new Error('This browser does not support the alarm audio engine.');
 if(!audioContext)audioContext=new AudioContextClass();
 await audioContext.resume();
 const buffer=audioContext.createBuffer(1,1,audioContext.sampleRate);
 const source=audioContext.createBufferSource();source.buffer=buffer;source.connect(audioContext.destination);source.start();
}
async function keepScreenAwake(){try{if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
function speakAlarm(){
 if(!('speechSynthesis'in window)||document.hidden)return;
 if(window.speechSynthesis.speaking)return;
 const utterance=new SpeechSynthesisUtterance('Emergency alert. Someone may be in danger. Please check immediately.');
 utterance.rate=0.9;utterance.volume=1;window.speechSynthesis.speak(utterance);
}
function startAlarm(){
 if(!audioContext||oscillator)return;
 oscillator=audioContext.createOscillator();gainNode=audioContext.createGain();
 oscillator.type='sawtooth';gainNode.gain.value=0.14;
 oscillator.connect(gainNode);gainNode.connect(audioContext.destination);oscillator.start();
 const sweep=()=>{if(!oscillator)return;const now=audioContext.currentTime;oscillator.frequency.cancelScheduledValues(now);oscillator.frequency.setValueAtTime(620,now);oscillator.frequency.linearRampToValueAtTime(1250,now+0.55);oscillator.frequency.linearRampToValueAtTime(620,now+1.1);};
 sweep();alarmLoop=setInterval(sweep,1150);
 speakAlarm();speechTimer=setInterval(speakAlarm,18000);
}
function stopAlarm(){
 if(alarmLoop){clearInterval(alarmLoop);alarmLoop=null;}
 if(speechTimer){clearInterval(speechTimer);speechTimer=null;}
 if(oscillator){try{oscillator.stop();}catch{}oscillator.disconnect();oscillator=null;}
 if(gainNode){gainNode.disconnect();gainNode=null;}
 window.speechSynthesis?.cancel();
}
function showAlert(event){
 if(!event||event.id===lastEventId)return;
 lastEventId=event.id;
 $('#emergency-alert').hidden=false;
 $('#emergency-alert').scrollIntoView({behavior:'smooth',block:'center'});
 $('#alert-message').textContent=event.message||'Someone may be in danger. Please check immediately.';
 $('#alert-time').textContent='Alert received: '+new Date(event.createdAt).toLocaleString();
 $('#receiver-detail').textContent='Active SOS alert. Acknowledge only after checking on the sender.';
 startAlarm();
}
function clearReceiverSession(message){
 stopAlarm();isConnected=false;
 localStorage.removeItem(DEVICE_KEY);localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(LEGACY_TOKEN_KEY);
 deviceId='';receiverToken='';
 if(pollTimer)clearTimeout(pollTimer);pollTimer=null;
 setConnected(false);$('#emergency-alert').hidden=true;
 updateStatus(message);
}
async function poll(){
 if(!isConnected||polling)return;
 polling=true;
 try{
  const data=await requestPublic('/api/sos/poll',{deviceId,receiverToken});
  if(data.active&&data.event)showAlert(data.event);
  else if($('#emergency-alert').hidden)$('#receiver-detail').textContent='Connected. No active SOS alert.';
  updateStatus('Connected · listening for emergency alerts.');
 }catch(error){
  if(/replaced|revoked|receiver session/i.test(error.message)){clearReceiverSession('This receiver has been replaced. Ask the sender for a new six-character code.');return;}
  updateStatus('Connection interrupted: '+error.message+'. Retrying…');
 }finally{polling=false;}
 if(isConnected)pollTimer=setTimeout(poll,2200);
}
$('#pair-receiver').addEventListener('click',async()=>{
 const button=$('#pair-receiver');button.disabled=true;
 const code=$('#pairing-code').value.trim().toUpperCase();
 if(!/^[A-Z0-9]{6}$/.test(code)){updateStatus('Enter exactly six letters or numbers.');button.disabled=false;return;}
 updateStatus('Checking invitation…');
 try{
  const result=await requestPublic('/api/sos/pair',{code});
  deviceId=result.deviceId;receiverToken=result.receiverToken;
  localStorage.setItem(DEVICE_KEY,deviceId);localStorage.setItem(TOKEN_KEY,receiverToken);
  // Refresh so the receiver opens directly into its paired state.
  location.replace('/sos-receiver/?paired=1');
 }catch(error){updateStatus('Pairing failed: '+error.message);}
 finally{button.disabled=false;}
});
$('#enable-alarm').addEventListener('click',async()=>{
 const button=$('#enable-alarm');button.disabled=true;
 try{
  if(!deviceId||!receiverToken)throw new Error('This tab has no valid receiver session.');
  await unlockAudio();await keepScreenAwake();
  let pushReady=false,pushError='';
  try{pushReady=await registerPushNotifications();}catch(error){pushError=error.message||'Push registration failed.';}
  isConnected=true;
  updateStatus(pushReady
   ? 'Receiver connected. Screen-off notifications are enabled; keep notifications allowed.'
   : 'Receiver connected with foreground polling only. '+pushError);
  $('#receiver-detail').textContent=pushReady
   ? 'Push notifications are registered. Android may show an alert while the screen is off; notification permission, connectivity and battery settings still apply.'
   : 'Foreground polling is active, but this receiver may miss alerts while the screen is off or the browser is suspended.';
  if(pollTimer)clearTimeout(pollTimer);pollTimer=null;
  poll();
 }catch(error){updateStatus('Could not enable the receiver: '+error.message);}
 finally{button.disabled=false;}
});
$('#acknowledge-alert').addEventListener('click',async()=>{
 if(!deviceId||!receiverToken)return;
 const button=$('#acknowledge-alert');button.disabled=true;
 try{
  await requestPublic('/api/sos/ack',{deviceId,receiverToken,eventId:lastEventId});
  stopAlarm();$('#emergency-alert').hidden=true;
  $('#receiver-detail').textContent='Alert acknowledged. The sender can send another alert if needed.';
  updateStatus('Alert acknowledged. Still connected.');
  lastEventId='';
 }catch(error){updateStatus('Could not acknowledge alert: '+error.message);}
 finally{button.disabled=false;}
});
document.addEventListener('visibilitychange',async()=>{
 if(document.visibilityState==='visible'&&isConnected){
  await keepScreenAwake();
  if(!pollTimer&&!polling)poll();
 }
});
if(deviceId&&receiverToken){
 setConnected(true);
 isConnected=true;
 updateStatus('Receiver pairing is saved on this device. Checking for SOS alerts. Tap Enable alarm to unlock sound and enable screen-off notifications.');
 poll();
} else {
 setConnected(false);
 updateStatus('Enter the six-character invitation code from the sender phone.');
}

if('serviceWorker'in navigator){
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type==='DAREDEVILS_EYE_SOS_PUSH'){
   if(deviceId&&receiverToken){isConnected=true;setConnected(true);if(pollTimer)clearTimeout(pollTimer);pollTimer=null;poll();}
  }
 });
}
