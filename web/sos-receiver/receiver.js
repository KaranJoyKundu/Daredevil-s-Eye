import {requestPublic} from '/shared/api.js?v=20261117-release1';

const $=selector=>document.querySelector(selector);
const DEVICE_KEY='daredevils-eye.receiver.device.v2';
const TOKEN_KEY='daredevils-eye.receiver.token.v3';
const LEGACY_TOKEN_KEY='daredevils-eye.receiver.token.v2';
const LEGACY_DEVICE_KEY='daredevils-eye.receiver.device.v2';
let deviceId=localStorage.getItem(DEVICE_KEY)||localStorage.getItem(LEGACY_DEVICE_KEY)||'';
let receiverToken=localStorage.getItem(TOKEN_KEY)||sessionStorage.getItem(LEGACY_TOKEN_KEY)||'';
if(deviceId)localStorage.setItem(DEVICE_KEY,deviceId);
if(receiverToken)localStorage.setItem(TOKEN_KEY,receiverToken);
let pollTimer=null,speechTimer=null,lastEventId='',alarmAudio=null,wakeLock=null,isConnected=false,polling=false;
let videoPeer=null,videoSessionId='',videoCandidateCursor=0,videoPendingCandidates=[],videoAnswerCreated=false,videoPolling=false;

function updateStatus(message){$('#receiver-status').textContent=message;}
function base64UrlToBytes(value){
 const base64=String(value).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(value).length+3)%4);
 const binary=atob(base64);
 return Uint8Array.from(binary,character=>character.charCodeAt(0));
}
async function registerPushNotifications(permissionPromise){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){
  throw new Error('This browser does not support background push notifications. Foreground polling will still work.');
 }
 if(Notification.permission==='denied')throw new Error('Notifications are blocked for this site. Allow notifications in Android site settings.');
 if(Notification.permission!=='granted'){
  const permission=permissionPromise?await permissionPromise:await Notification.requestPermission();
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
async function stopRemoteVideo(notify=false){
 const sessionId=videoSessionId,peer=videoPeer;
 videoPeer=null;videoSessionId='';videoCandidateCursor=0;videoPendingCandidates=[];videoAnswerCreated=false;
 if(peer){peer.ontrack=null;peer.onicecandidate=null;peer.close();}
 const video=$('#receiver-video');if(video){video.pause();video.srcObject=null;}
 const panel=$('#receiver-video-panel');if(panel)panel.hidden=true;
 if(notify&&sessionId&&deviceId&&receiverToken){
  try{await requestPublic('/api/sos/video/stop',{deviceId,receiverToken,sessionId});}catch{}
 }
}
async function pollEmergencyVideo(){
 if(!isConnected||!receiverToken||videoPolling)return;
 videoPolling=true;
 try{
  const data=await requestPublic('/api/sos/video/poll',{deviceId,receiverToken,sessionId:videoSessionId,after:videoCandidateCursor});
  if(!data.active||!data.sessionId){
   if(videoPeer)await stopRemoteVideo(false);
   return;
  }
  if(data.sessionId!==videoSessionId){
   await stopRemoteVideo(false);
   videoSessionId=data.sessionId;
   videoPeer=new RTCPeerConnection({iceServers:data.iceServers||[{urls:['stun:stun.l.google.com:19302']}]});
   const peer=videoPeer;
   peer.addEventListener('track',event=>{
    const video=$('#receiver-video');
    if(video){video.srcObject=event.streams?.[0]||new MediaStream([event.track]);video.play().catch(()=>{});}
   });
   peer.addEventListener('icecandidate',event=>{
    if(event.candidate&&videoSessionId===data.sessionId){
     requestPublic('/api/sos/video/ice-receiver',{deviceId,receiverToken,sessionId:data.sessionId,candidate:event.candidate.toJSON()})
      .catch(error=>$('#receiver-video-status').textContent='Could not send video connection data: '+error.message);
    }
   });
   peer.addEventListener('connectionstatechange',()=>{
    if(peer.connectionState==='connected')$('#receiver-video-status').textContent='Live emergency video connected.';
    else if(peer.connectionState==='connecting')$('#receiver-video-status').textContent='Connecting to the sender’s camera…';
    else if(peer.connectionState==='failed')$('#receiver-video-status').textContent='Video could not connect. The SOS alert remains available; a TURN relay may be required.';
    else if(peer.connectionState==='disconnected')$('#receiver-video-status').textContent='Video connection interrupted. Waiting for recovery…';
   });
   $('#receiver-video-panel').hidden=false;
   $('#receiver-video-status').textContent='An authorized emergency video session is starting…';
  }
  if(data.offer&&!videoPeer.remoteDescription){
   await videoPeer.setRemoteDescription(data.offer);
   const answer=await videoPeer.createAnswer();
   await videoPeer.setLocalDescription(answer);
   await requestPublic('/api/sos/video/answer',{deviceId,receiverToken,sessionId:videoSessionId,sdp:videoPeer.localDescription});
   videoAnswerCreated=true;
   for(const candidate of videoPendingCandidates.splice(0)){
    try{await videoPeer.addIceCandidate(candidate);}catch{}
   }
  }
  for(const candidate of data.senderCandidates||[]){
   if(videoPeer.remoteDescription){try{await videoPeer.addIceCandidate(candidate);}catch{}}
   else videoPendingCandidates.push(candidate);
  }
  videoCandidateCursor=Number(data.senderCandidateCount)||videoCandidateCursor;
 }catch(error){
  const status=$('#receiver-video-status');
  if(status)status.textContent='Emergency video connection is waiting: '+error.message;
 }finally{videoPolling=false;}
}
function setConnected(connected){
 $('#pairing-panel').hidden=connected;
 $('#connected-panel').hidden=!connected;
}
function getAlarmAudio(){
 if(!alarmAudio){alarmAudio=new Audio('/shared/emergency-siren.mp3?v=20261126-siren2');alarmAudio.preload='auto';alarmAudio.loop=true;alarmAudio.volume=1;alarmAudio.addEventListener('error',()=>updateStatus('Siren audio file failed to load. Check the deployed /shared/emergency-siren.mp3 asset.'));}
 return alarmAudio;
}
async function unlockAudio(){
 const audio=getAlarmAudio();
 try{await audio.play();audio.pause();audio.currentTime=0;return true;}
 catch{return false;}
}
async function keepScreenAwake(){try{if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
function speakAlarm(){
 if(!('speechSynthesis'in window)||document.hidden)return;
 if(window.speechSynthesis.speaking)return;
 const utterance=new SpeechSynthesisUtterance('Emergency alert. Someone may be in danger. Please check immediately.');
 utterance.rate=0.9;utterance.volume=1;window.speechSynthesis.speak(utterance);
}
function startAlarm(){
 const audio=getAlarmAudio();
 if(audio.paused){audio.currentTime=0;audio.play().catch(()=>updateStatus('Emergency Siren could not start. Keep this page open and tap Enable Emergency Siren again.'));}
 if(!speechTimer){speakAlarm();speechTimer=setInterval(speakAlarm,18000);}
}
function stopAlarm(){
 if(speechTimer){clearInterval(speechTimer);speechTimer=null;}
 if(alarmAudio){alarmAudio.pause();alarmAudio.currentTime=0;}
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
  await pollEmergencyVideo();
 }catch(error){
  if(/replaced|revoked|receiver session/i.test(error.message)){clearReceiverSession('This receiver has been replaced. Ask the sender for a new six-character code.');return;}
  updateStatus('Connection interrupted: '+error.message+'. Retrying…');
 }finally{polling=false;}
 if(isConnected)pollTimer=setTimeout(poll,2200);
}
$('#stop-receiver-video')?.addEventListener('click',async()=>{
 const button=$('#stop-receiver-video');button.disabled=true;
 try{await stopRemoteVideo(true);$('#receiver-video-status').textContent='Live video sharing ended.';updateStatus('Video sharing stopped. The SOS alert remains in the receiver history.');}
 finally{button.disabled=false;}
});
window.addEventListener('pagehide',()=>{void stopRemoteVideo(false);});
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
$('#test-alarm').addEventListener('click',async()=>{
 const button=$('#test-alarm');button.disabled=true;
 const audio=getAlarmAudio();
 try{
  audio.pause();audio.currentTime=0;audio.loop=false;
  await audio.play();
  updateStatus('Siren test is playing. You should hear the emergency siren now.');
  audio.onended=()=>{audio.loop=true;audio.onended=null;button.disabled=false;updateStatus('Siren test finished. Receiver remains connected.');};
 }catch(error){
  audio.loop=true;button.disabled=false;
  updateStatus('Siren test failed: '+(error?.message||'audio playback was blocked')+'. Check media volume and tap Test Emergency Siren again.');
 }
});
$('#enable-alarm').addEventListener('click',async()=>{
 const button=$('#enable-alarm');button.disabled=true;
 try{
  if(!deviceId||!receiverToken)throw new Error('This tab has no valid receiver session.');
  // Start gesture-gated browser permissions and audio unlock before the
  // first await so Android can associate them with this button tap.
  let permissionPromise=Promise.resolve('unsupported');
  if('Notification'in window){
   permissionPromise=Notification.permission==='default'
    ?Notification.requestPermission().catch(()=> 'denied')
    :Promise.resolve(Notification.permission);
  }
  const audioUnlock=unlockAudio();
  const screenWake=keepScreenAwake();
  const sirenReady=await audioUnlock;
  await screenWake;
  let pushReady=false,pushError='';
  try{pushReady=await registerPushNotifications(permissionPromise);}catch(error){pushError=error.message||'Push registration failed.';}
  isConnected=true;
  updateStatus(pushReady
   ? (sirenReady?'Receiver connected. Emergency Siren is ready; screen-off notifications are enabled.':'Receiver connected. Notifications are enabled, but siren audio could not be unlocked. Tap Enable Emergency Siren again.')
   : 'Receiver connected with foreground polling only. '+pushError);
  $('#receiver-detail').textContent=(sirenReady?'Emergency Siren is ready to play while this receiver page is active. ':'Siren audio is not unlocked yet. Tap Enable Emergency Siren again. ')+(pushReady
   ? 'Push notifications are registered. Android may show a system notification while the screen is off; its sound is controlled by Android notification settings.'
   : 'Foreground polling is active, but this receiver may miss alerts while the screen is off or the browser is suspended.');
  if(pollTimer)clearTimeout(pollTimer);pollTimer=null;
  poll();
 }catch(error){updateStatus('Could not enable the receiver: '+error.message);}
 finally{button.disabled=false;}
});
$('#remove-pairing').addEventListener('click',async()=>{
 if(!deviceId||!receiverToken)return;
 if(!window.confirm('Remove this phone as the paired SOS receiver? It will stop receiving SOS alerts until paired again.'))return;
 const button=$('#remove-pairing');button.disabled=true;
 try{
  await requestPublic('/api/sos/revoke',{deviceId,receiverToken});
  try{
   const registration=await navigator.serviceWorker.getRegistration('/');
   const subscription=await registration?.pushManager?.getSubscription();
   if(subscription)await subscription.unsubscribe();
  }catch{}
  clearReceiverSession('This phone has been unpaired. It will no longer receive SOS alerts. Enter a new invitation only if you want to pair it again.');
 }catch(error){
  updateStatus('Could not remove this paired device: '+error.message);
 }finally{button.disabled=false;}
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
