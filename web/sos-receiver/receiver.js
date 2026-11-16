import {requestAI} from '/shared/api.js?v=20261116-auth1';

const $=selector=>document.querySelector(selector);
const DEVICE_KEY='daredevils-eye.receiver.device.v2';
const TOKEN_KEY='daredevils-eye.receiver.token.v2';
let deviceId=sessionStorage.getItem(DEVICE_KEY)||'';
let receiverToken=sessionStorage.getItem(TOKEN_KEY)||'';
let pollTimer=null,speechTimer=null,lastEventId='',audioContext=null,oscillator=null,gainNode=null,alarmLoop=null,wakeLock=null,isConnected=false,polling=false;

function updateStatus(message){$('#receiver-status').textContent=message;}
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
 sessionStorage.removeItem(DEVICE_KEY);sessionStorage.removeItem(TOKEN_KEY);
 deviceId='';receiverToken='';
 if(pollTimer)clearTimeout(pollTimer);pollTimer=null;
 setConnected(false);$('#emergency-alert').hidden=true;
 updateStatus(message);
}
async function poll(){
 if(!isConnected||polling)return;
 polling=true;
 try{
  const data=await requestAI('/api/sos/poll',{deviceId,receiverToken});
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
  const result=await requestAI('/api/sos/pair',{code});
  deviceId=result.deviceId;receiverToken=result.receiverToken;
  sessionStorage.setItem(DEVICE_KEY,deviceId);sessionStorage.setItem(TOKEN_KEY,receiverToken);
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
  isConnected=true;
  updateStatus('Alarm enabled. Receiver is connected and listening.');
  $('#receiver-detail').textContent='Connected. Keep this page open and the phone awake.';
  poll();
 }catch(error){updateStatus('Could not enable the receiver: '+error.message);}
 finally{button.disabled=false;}
});
$('#acknowledge-alert').addEventListener('click',async()=>{
 if(!deviceId||!receiverToken)return;
 const button=$('#acknowledge-alert');button.disabled=true;
 try{
  await requestAI('/api/sos/ack',{deviceId,receiverToken,eventId:lastEventId});
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
 updateStatus('Pairing saved in this tab. Tap Enable alarm & start listening to resume.');
} else {
 setConnected(false);
 updateStatus('Enter the six-character invitation code from the sender phone.');
}
