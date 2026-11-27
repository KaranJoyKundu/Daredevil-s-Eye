import {requestPublic} from '/shared/api.js?v=20261128-rfid-sosfix';
import {getSettings} from '/shared/settings.js?v=20261128-rfid-sosfix';
const $=id=>document.getElementById(id);
const sender=$('sos-sender-panel'),receiver=$('sos-receiver-panel');
function showMode(mode){
 const isSender=mode==='sender';
 sender.hidden=!isSender;receiver.hidden=isSender;
 $('sos-mode-sender').setAttribute('aria-selected',String(isSender));
 $('sos-mode-receiver').setAttribute('aria-selected',String(!isSender));
 $('sos-mode-sender').classList.toggle('secondary-button',!isSender);
 $('sos-mode-receiver').classList.toggle('secondary-button',isSender);
}
$('sos-mode-sender').addEventListener('click',()=>showMode('sender'));
$('sos-mode-receiver').addEventListener('click',()=>showMode('receiver'));
$('sos-generate-code').addEventListener('click',async()=>{
 const button=$('sos-generate-code');button.disabled=true;
 $('sos-sender-status').textContent='Generating a secure one-time invitation…';
 try{
  const settings=getSettings();
  const result=await requestPublic('/api/sos/invite',{deviceId:settings.deviceId});
  $('sos-invite-code').value=String(result.code||'').toUpperCase();
  $('sos-sender-status').textContent='Invitation generated. It expires in 10 minutes and disconnects any previously paired receiver. Share the code privately.';
 }catch(error){$('sos-sender-status').textContent='Could not generate invitation: '+error.message;}
 finally{button.disabled=false;}
});
showMode('sender');
