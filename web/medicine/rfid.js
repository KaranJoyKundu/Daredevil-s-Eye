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
