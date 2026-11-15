import { captureImage, blobToDataUrl } from './camera.js';
import { requestMockAI } from './api.js';
import { speak, stopSpeaking, listenOnce } from './speech.js';
import { getSettings, saveSettings } from './settings.js';
const $=s=>document.querySelector(s), status=$('#status');
function announce(t){status.textContent=t;speak(t);}
async function run(mode,question=''){if(!getSettings().consentAccepted){announce('Accept the privacy notice first.');return;}try{announce('Taking a photo. Hold still.');const image=await blobToDataUrl(await captureImage());announce('Sending to mock backend.');const r=await requestMockAI(mode==='ask'?'/api/ask':'/api/describe',{image,question});$('#result').textContent=r.disclaimer+'\n\n'+r.answer;announce(r.answer);}catch(e){announce(e.message);}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return; if(b.dataset.action==='describe')run('describe');if(b.dataset.action==='ask'){speak('What would you like to know?',{onEnd:()=>{const rec=listenOnce({onResult:q=>run('ask',q),onError:announce});if(!rec)$('#question').focus();}});}if(b.dataset.action==='sos'){const s=getSettings();if(!s.emergencyPhone){announce('No emergency number configured.');return;}if(confirm('Open dialler for '+(s.emergencyName||'emergency contact')+'?'))location.href='tel:'+s.emergencyPhone.replace(/[^+0-9]/g,'');}if(b.dataset.action==='repeat')speak($('#result').textContent);if(b.dataset.action==='stop'){stopSpeaking();announce('Speech stopped.');}});
$('#question-form').addEventListener('submit',e=>{e.preventDefault();run('ask',$('#question').value);});
$('#consent-accept').addEventListener('click',()=>{saveSettings({consentAccepted:true});$('#consent-panel').remove();announce('Consent saved on this device.');});
