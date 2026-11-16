const $=selector=>document.querySelector(selector);
const codeField=$('#pairing-code');
let code='',pollTimer=null,lastEventId='',audioContext=null,oscillator=null,gainNode=null,alarmLoop=null,wakeLock=null,isConnected=false;

function updateStatus(text){$('#receiver-status').textContent=text;}
async function post(path,body){
 const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Request failed with HTTP '+response.status);
 return data;
}
async function unlockAudio(){
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass)throw new Error('This browser does not support the alarm audio engine.');
 if(!audioContext)audioContext=new AudioContextClass();
 await audioContext.resume();
 // Play a tiny silent buffer as part of the explicit user gesture.
 const buffer=audioContext.createBuffer(1,1,audioContext.sampleRate);
 const source=audioContext.createBufferSource();source.buffer=buffer;source.connect(audioContext.destination);source.start();
}
async function keepScreenAwake(){
 try{
  if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen');
 }catch{}
}
function startAlarm(){
 if(oscillator||!audioContext)return;
 oscillator=audioContext.createOscillator();
 gainNode=audioContext.createGain();
 oscillator.type='sawtooth';
 gainNode.gain.value=0.12;
 oscillator.connect(gainNode);gainNode.connect(audioContext.destination);
 oscillator.start();
 const sweep=()=>{
  if(!oscillator||!audioContext)return;
  const now=audioContext.currentTime;
  oscillator.frequency.cancelScheduledValues(now);
  oscillator.frequency.setValueAtTime(650,now);
  oscillator.frequency.linearRampToValueAtTime(1180,now+0.65);
  oscillator.frequency.linearRampToValueAtTime(650,now+1.3);
 };
 sweep();
 alarmLoop=setInterval(sweep,1350);
 if('speechSynthesis' in window){
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance('Emergency alert. Someone may be in danger. Please check immediately.');
  utterance.rate=0.92;utterance.volume=1;
  window.speechSynthesis.speak(utterance);
 }
}
function stopAlarm(){
 if(alarmLoop){clearInterval(alarmLoop);alarmLoop=null;}
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
 $('#receiver-detail').textContent='An active SOS alert is waiting for acknowledgement.';
 startAlarm();
}
async function poll(){
 if(!isConnected)return;
 try{
  const data=await post('/api/sos/poll',{code});
  if(data.active&&data.event)showAlert(data.event);
  else if($('#emergency-alert').hidden)$('#receiver-detail').textContent='Connected. No active SOS alert.';
  updateStatus('Connected and listening for SOS alerts.');
 }catch(error){
  updateStatus('Connection interrupted: '+error.message+'. Retrying…');
 }
 pollTimer=setTimeout(poll,2200);
}
$('#connect-receiver').addEventListener('click',async()=>{
 const button=$('#connect-receiver');button.disabled=true;
 code=codeField.value.trim().toUpperCase();
 if(!/^[A-Z0-9]{8,20}$/.test(code)){
  updateStatus('Enter the 8–20 character pairing code from Admin / Settings.');
  button.disabled=false;return;
 }
 try{
  await unlockAudio();
  const result=await post('/api/sos/pair',{code});
  localStorage.setItem('daredevils-eye.receiver-code',code);
  isConnected=true;
  await keepScreenAwake();
  updateStatus(result.message||'Receiver connected.');
  $('#receiver-detail').textContent='Connected. Waiting for the sender phone.';
  if(pollTimer)clearTimeout(pollTimer);
  poll();
 }catch(error){isConnected=false;updateStatus('Could not connect: '+error.message);}
 finally{button.disabled=false;}
});
$('#acknowledge-alert').addEventListener('click',async()=>{
 if(!code)return;
 const button=$('#acknowledge-alert');button.disabled=true;
 try{
  await post('/api/sos/ack',{code,eventId:lastEventId});
  stopAlarm();
  $('#emergency-alert').hidden=true;
  $('#receiver-detail').textContent='Alert acknowledged. The sender can send another alert if needed.';
  updateStatus('Alert acknowledged.');
  lastEventId='';
 }catch(error){updateStatus('Could not acknowledge alert: '+error.message);}
 finally{button.disabled=false;}
});
document.addEventListener('visibilitychange',async()=>{
 if(document.visibilityState==='visible'&&isConnected){
  await keepScreenAwake();
  if(!pollTimer)poll();
 }
});
codeField.value=localStorage.getItem('daredevils-eye.receiver-code')||'';
