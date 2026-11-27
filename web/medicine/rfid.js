import {speak} from '../shared/speech.js?v=20261126-rfid2';
import {getSettings} from '../shared/settings.js?v=20261117-release5';
import {apiFetch} from '../shared/api.js?v=20261128-rfid-session-fix';
import {setRFIDListenerEnabled,isRFIDListenerEnabled} from '../shared/rfid-listener.js?v=20261126-bg2';

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
$('scan-napa').addEventListener('click',()=>announceSavedMedicine('A1618C04','Napa One'));
$('scan-monus').addEventListener('click',()=>announceSavedMedicine('1474D505','Monus 10'));
const toggle=$('listener-enabled');
toggle.checked=isRFIDListenerEnabled();
status('listener-status',toggle.checked?'Automatic announcements are on by default. Keep the app open and signed in.':'Medicine announcements are paused.');
toggle.addEventListener('change',()=>{
 setRFIDListenerEnabled(toggle.checked);
 status('listener-status',toggle.checked?'Medicine announcements enabled across app pages.':'Medicine announcements paused.');
});
$('test-speech').addEventListener('click',()=>announceSavedMedicine('A1618C04','Napa One'));

const provisionButton=$('provision-device');
const tokenOutput=$('device-token');
const copyButton=$('copy-device-token');
let issuedToken='';
provisionButton.addEventListener('click',async()=>{
 provisionButton.disabled=true;
 status('provision-status','Authorizing this browser account…');
 try{
  const response=await apiFetch('/api/rfid/devices/provision',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok||!/^[a-f0-9]{64}$/i.test(data.deviceToken||''))throw new Error(data.error||'Could not authorize the ESP32. Sign in and try again.');
  issuedToken=data.deviceToken;
  tokenOutput.textContent=issuedToken;
  copyButton.disabled=false;
  status('provision-status','ESP32 authorized for this account. Copy the token into Serial Monitor. This token is shown only once.');
 }catch(error){status('provision-status',error.message);}
 finally{provisionButton.disabled=false;}
});
copyButton.addEventListener('click',async()=>{
 if(!issuedToken)return;
 try{await navigator.clipboard.writeText(issuedToken);status('provision-status','Device token copied. Paste it into the ESP32 Serial Monitor.');}
 catch{status('provision-status','Clipboard unavailable. Select and copy the token above manually.');}
});

const medicineForm=$('medicine-form');
const medicineRecords=$('medicine-records');
const medicineCancel=$('medicine-cancel');
let savedMedicines=[];
let editingUid='';
// Simulated scans and the general speech test must use the same generated/custom
// announcement as a real RFID event, not just speak the medicine's short name.
function announceSavedMedicine(uid,fallback){
 const item=savedMedicines.find(medicine=>medicine.uid===uid);
 announceMedicine(item?medicineMessage(item):fallback);
}
const medicineFields=['uid','name','strength','expiryDate','instructions','announcementText','expiredText'];
const fieldId=name=>({uid:'medicine-uid',name:'medicine-name',strength:'medicine-strength',expiryDate:'medicine-expiry',instructions:'medicine-instructions',announcementText:'medicine-announcement',expiredText:'medicine-expired'}[name]);
const field=name=>$(fieldId(name));
const normalizedUid=value=>String(value||'').replace(/[\s:-]/g,'').toUpperCase();
function medicineMessage(item){
 const today=new Date().toISOString().slice(0,10);
 if(item.expiryDate&&item.expiryDate<today.slice(0,7))return item.expiredText||DEFAULT_EXPIRED_TEXT;
 if(item.announcementText)return item.announcementText;
 const medicineName=[item.name,item.strength].filter(Boolean).join(' ');
 const expiry=item.expiryDate?'Expiry date: '+new Date(item.expiryDate+'-01T00:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'}):'';
 const instruction=String(item.instructions||'').trim();
 const prescription=instruction?( /^your registered prescription says\b/i.test(instruction)?instruction:'Your registered prescription says '+instruction):'';
 return [medicineName,expiry,prescription].filter(Boolean).join('. ')||'Add a medicine name to preview the announcement.';
}
function updateMedicinePreview(){
 const item=Object.fromEntries(medicineFields.map(name=>[name,name==='uid'?normalizedUid(field(name)?.value):String(field(name)?.value||'').trim()]));
 $('medicine-preview').textContent=medicineMessage(item);
}
medicineFields.forEach(name=>field(name)?.addEventListener('input',updateMedicinePreview));
const DEFAULT_EXPIRED_TEXT='Warning! This medicine has expired.';
async function medicineApi(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok===false)throw new Error(data.error||'Medicine request failed (HTTP '+response.status+').');
 return data;
}
function renderMedicines(){
 medicineRecords.replaceChildren();
 if(!savedMedicines.length){const empty=document.createElement('p');empty.className='medicine-muted';empty.textContent='No medicine cards yet. Add your first RFID UID above.';medicineRecords.append(empty);return;}
 for(const item of savedMedicines){
  const row=document.createElement('article');row.className='medicine-record';
  const info=document.createElement('div');
  const heading=document.createElement('strong');heading.textContent=item.name+(item.strength?' · '+item.strength:'');
  const uid=document.createElement('small');uid.className='medicine-muted';uid.textContent='UID: '+item.uid+(item.expiryDate?' · Expires: '+item.expiryDate:'');
  const preview=document.createElement('p');preview.textContent=medicineMessage(item);
  info.append(heading,document.createElement('br'),uid,preview);
  const actions=document.createElement('div');actions.className='medicine-record-actions';
  const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';
  edit.addEventListener('click',()=>{editingUid=item.uid;medicineFields.forEach(name=>field(name).value=item[name]||(name==='expiredText'?DEFAULT_EXPIRED_TEXT:''));field('uid').readOnly=false;medicineCancel.hidden=false;$('medicine-save').textContent='Update medicine card';updateMedicinePreview();medicineForm.scrollIntoView({behavior:'smooth',block:'center'});});
  const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Delete';
  remove.addEventListener('click',async()=>{if(!confirm('Delete '+item.name+' (UID '+item.uid+') from your account?'))return;try{await medicineApi('/api/rfid/medicines/'+encodeURIComponent(item.uid),{method:'DELETE'});status('medicine-status','Medicine card deleted.');await loadMedicines();}catch(error){status('medicine-status',error.message);}});
  actions.append(edit,remove);row.append(info,actions);medicineRecords.append(row);
 }
}
async function loadMedicines(){
 try{const data=await medicineApi('/api/rfid/medicines');savedMedicines=Array.isArray(data.medicines)?data.medicines:[];renderMedicines();status('medicine-status',savedMedicines.length+' medicine card(s) saved to your account.');}
 catch(error){medicineRecords.textContent='Sign in to load your medicine cards.';status('medicine-status',error.message);}
}
function resetMedicineForm(){
 medicineForm.reset();field('expiredText').value=DEFAULT_EXPIRED_TEXT;editingUid='';field('uid').readOnly=false;medicineCancel.hidden=true;$('medicine-save').textContent='Save medicine card';updateMedicinePreview();
}
medicineCancel.addEventListener('click',resetMedicineForm);
medicineForm.addEventListener('submit',async event=>{
 event.preventDefault();
 const item=Object.fromEntries(medicineFields.map(name=>[name,String(field(name).value||'').trim()]));
 item.uid=normalizedUid(item.uid);
 if(editingUid)item.originalUid=editingUid;
 if(!item.uid||!item.name){status('medicine-status','RFID UID and medicine name are required.');return;}
 const save=$('medicine-save');save.disabled=true;
 try{
  const data=await medicineApi('/api/rfid/medicines',{method:'POST',body:JSON.stringify(item)});
  status('medicine-status',(editingUid?'Updated ':'Saved ')+(data.medicine?.name||item.name)+'. New instructions will be used on the next scan.');
  resetMedicineForm();await loadMedicines();
 }catch(error){status('medicine-status',error.message);}
 finally{save.disabled=false;}
});
loadMedicines();

$('medicine-preview-speak').addEventListener('click',()=>announceMedicine($('medicine-preview').textContent));
