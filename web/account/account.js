import { clearSessionGeminiApiKey } from '/shared/api.js?v=20261117-release5';

const $=selector=>document.querySelector(selector);
const authPanel=$('#auth-panel'),accountPanel=$('#account-panel');
let currentUser=null;
let sessionCheckedAt=0;
let sessionRefreshPromise=null;
let historyOffset=0;
let guestHistoryOffset=0;

async function ensureSessionFresh(){
 if(Date.now()-sessionCheckedAt<4*60*1000)return;
 if(!sessionRefreshPromise){
  sessionRefreshPromise=fetch('/api/account/session',{credentials:'same-origin',cache:'no-store'})
   .catch(()=>null)
   .finally(()=>{sessionCheckedAt=Date.now();sessionRefreshPromise=null;});
 }
 await sessionRefreshPromise;
}
async function api(path,{method='GET',body}={}) {
 if(!['/api/account/session','/api/account/login','/api/account/signup'].includes(path))await ensureSessionFresh();
 if(path==='/api/account/session')sessionCheckedAt=Date.now();
 const response=await fetch(path,{
  method,credentials:'same-origin',cache:'no-store',
  headers:body!==undefined?{'content-type':'application/json'}:{},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||('Request failed ('+response.status+').'));
 return data;
}
async function ensureGuestSession(){
 const response=await fetch('/api/guest/session',{credentials:'same-origin',cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Could not prepare this browser’s private history.');
 return data;
}
async function guestApi(path,{method='GET'}={}){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||('Request failed ('+response.status+').'));
 return data;
}
function showSignedIn(user){
 currentUser=user;
 authPanel.hidden=true;accountPanel.hidden=false;
 $('#account-email').textContent=user.email||'Signed in';
}
function showSignedOut(){
 currentUser=null;
 authPanel.hidden=false;accountPanel.hidden=true;
}
function formatDate(value){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?String(value||''):date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
}
function make(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
}
function createRecordingCard(item){
 const card=make('article','account-history-card');
 const title=make('h3','account-history-title','Emergency video · '+(item.camera_source==='esp32'?'ESP32-CAM':'Phone camera'));
 const meta=make('p','account-history-meta',formatDate(item.created_at)+' · '+Math.max(0,Number(item.duration_seconds)||0)+' seconds · '+(Number(item.total_bytes||0)/1024/1024).toFixed(2)+' MB');
 const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='none';video.src='/api/recordings/'+encodeURIComponent(item.id);video.style.width='100%';video.style.maxHeight='360px';video.style.background='#000';video.style.borderRadius='12px';
 const footer=make('div','account-history-footer');
 const download=document.createElement('a');download.href='/api/recordings/'+encodeURIComponent(item.id)+'?download=1';download.textContent='Download video';download.className='account-button account-button-light';download.setAttribute('download','');
 const remove=make('button','account-button account-button-danger','Delete recording');remove.type='button';
 remove.addEventListener('click',async()=>{
  if(!window.confirm('Permanently delete this emergency video recording?'))return;
  remove.disabled=true;
  try{await api('/api/recordings/'+encodeURIComponent(item.id),{method:'DELETE'});card.remove();$('#recordings-status').textContent='Recording deleted.';}
  catch(error){$('#recordings-status').textContent=error.message;remove.disabled=false;}
 });
 footer.append(download,remove);card.append(title,meta,video,footer);
 const expires=make('p','account-footnote','Automatically expires '+formatDate(item.expires_at)+'.');
 card.append(expires);
 return card;
}
async function loadRecordings(){
 $('#recordings-status').textContent='Loading private emergency recordings…';
 $('#recordings-list').replaceChildren();
 try{
  const data=await api('/api/recordings'),items=(data.recordings||[]).filter(item=>item.status==='complete');
  if(!items.length){$('#recordings-status').textContent='No completed emergency recordings are saved for this account/browser.';return;}
  $('#recordings-status').textContent=items.length+' private recording'+(items.length===1?'':'s')+'.';
  for(const item of items)$('#recordings-list').append(createRecordingCard(item));
 }catch(error){$('#recordings-status').textContent=error.message;}
}
$('#refresh-recordings')?.addEventListener('click',loadRecordings);

function createHistoryCard(item,scope){
 const card=make('article','account-history-card');
 const top=make('div','account-history-top');
 const textBlock=make('div','');
 const title=make('h3','account-history-title',item.question||'Scene description');
 const meta=make('p','account-history-meta',formatDate(item.created_at)+' · '+(item.model||'Gemini model pending'));
 textBlock.append(title,meta);
 const status=item.analysis_status||'completed';
 const stateLabel=status==='failed'?'Analysis failed':status==='pending'?'Analysis pending':'Saved';
 const state=make('span','account-record-state account-state-'+status,stateLabel);
 top.append(textBlock,state);card.append(top);
 if(item.photoUrl){
  const image=document.createElement('img');
  image.src=item.photoUrl;image.alt='Private photo saved with this history record';image.loading='lazy';
  image.className='account-history-photo';card.append(image);
 }
 if(item.response_text){
  card.append(make('p','account-history-answer',item.response_text));
 }else if(status==='pending'){
  card.append(make('p','account-history-placeholder','The photo is saved. Its AI analysis is still being recorded.'));
 }
 if(item.analysis_error)card.append(make('p','account-history-error',item.analysis_error));
 const footer=make('div','account-history-footer');
 const details=[];
 if(Number.isFinite(Number(item.total_tokens)))details.push(Number(item.total_tokens).toLocaleString()+' tokens');
 if(item.photo_size_bytes)details.push((Number(item.photo_size_bytes)/1024/1024).toFixed(2)+' MB');
 if(item.response_language)details.push(item.response_language==='bn-BD'?'বাংলা':'English');
 footer.append(make('span','account-history-details',details.join(' · ')||'Photo record'));
 const del=make('button','account-button account-button-danger account-delete-one','Delete');
 del.type='button';
 del.addEventListener('click',async()=>{
  const prompt=scope==='guest'
   ?'Delete this guest photo and its answer from this browser history?'
   :'Delete this photo and answer from your account?';
  if(!window.confirm(prompt))return;
  del.disabled=true;
  try{
   if(scope==='guest')await guestApi('/api/guest/history/'+encodeURIComponent(item.id),{method:'DELETE'});
   else await api('/api/account/history/'+encodeURIComponent(item.id),{method:'DELETE'});
   if(scope==='guest')await loadGuestHistory(false);else await loadHistory(false);
  }catch(error){
   const statusNode=scope==='guest'?$('#guest-history-status'):$('#history-status');
   statusNode.textContent=error.message;del.disabled=false;
  }
 });
 footer.append(del);card.append(footer);
 return card;
}

async function refreshGuestHistorySession(){
 try{
  await ensureGuestSession();
  await loadGuestHistory(false);
 }catch(error){
  $('#guest-history-status').textContent=error.message;
 }
}
async function loadGuestHistory(append=false){
 if(!append){guestHistoryOffset=0;$('#guest-history-list').replaceChildren();}
 $('#guest-history-status').textContent=append?'Loading older guest photos…':'Loading private guest history…';
 try{
  const data=await guestApi('/api/guest/history?limit=24&offset='+guestHistoryOffset);
  const history=data.history||[];
  if(!history.length&&!append){
   $('#guest-history-status').textContent='No guest photos saved in this browser yet. New photos you submit to AI while signed out will appear here.';
  }else{
   $('#guest-history-status').textContent='Showing '+history.length+' guest record'+(history.length===1?'':'s')+'.';
  }
  guestHistoryOffset=Number(data.nextOffset)||guestHistoryOffset;
  $('#delete-guest-history').disabled=!history.length&&!append;
  for(const item of history)$('#guest-history-list').append(createHistoryCard(item,'guest'));
  if(data.hasMore){
   let button=$('#guest-history-more');
   if(!button){
    button=make('button','account-button account-button-light account-load-more','Load older guest photos');
    button.id='guest-history-more';button.type='button';
    button.addEventListener('click',()=>loadGuestHistory(true));
    $('#guest-history-panel').append(button);
   }
   button.hidden=false;
  }else{
   $('#guest-history-more')?.remove();
  }
 }catch(error){
  $('#guest-history-status').textContent=error.message;
  $('#delete-guest-history').disabled=true;
 }
}
$('#refresh-guest-history').addEventListener('click',()=>refreshGuestHistorySession());
$('#delete-guest-history').addEventListener('click',async()=>{
 if(!window.confirm('Delete every guest photo and answer saved for this browser? This cannot be undone.'))return;
 const button=$('#delete-guest-history');button.disabled=true;
 $('#guest-history-status').textContent='Deleting guest history…';
 try{
  await guestApi('/api/guest/history',{method:'DELETE'});
  $('#guest-history-list').replaceChildren();$('#guest-history-more')?.remove();
  $('#guest-history-status').textContent='All guest photos and answers for this browser were deleted.';
 }catch(error){$('#guest-history-status').textContent=error.message;}
 finally{button.disabled=false;}
});

async function refreshSession(){
 try{
  const state=await api('/api/account/session');
  if(!state.authenticated){
   showSignedOut();
   $('#account-status').textContent='Account service is ready. Sign in or create an account to keep history across devices.';
   await loadRecordings();
   return;
  }
  showSignedIn(state.user);
  $('#account-status').textContent='Signed in. Your account photos and settings are private to this account.';
  await Promise.all([loadKeyState(),loadHistory(),loadUsage(),loadRecordings()]);
 }catch(error){
  showSignedOut();
  $('#account-status').textContent=error.message;
 }
}
$('#login-form').addEventListener('submit',async event=>{
 event.preventDefault();
 $('#login-status').textContent='Signing in…';
 const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;
 try{
  const result=await api('/api/account/login',{method:'POST',body:{
   email:$('#login-email').value.trim(),password:$('#login-password').value
  }});
  $('#login-password').value='';sessionCheckedAt=Date.now();
  showSignedIn(result.user);$('#account-status').textContent='Signed in successfully.';
  $('#login-status').textContent='';
  await Promise.all([loadKeyState(),loadHistory(),loadUsage(),loadRecordings()]);
 }catch(error){$('#login-status').textContent=error.message;}
 finally{button.disabled=false;}
});
$('#signup-form').addEventListener('submit',async event=>{
 event.preventDefault();
 $('#signup-status').textContent='Creating account…';
 const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;
 try{
  const result=await api('/api/account/signup',{method:'POST',body:{
   email:$('#signup-email').value.trim(),password:$('#signup-password').value
  }});
  $('#signup-password').value='';
  if(result.authenticated)sessionCheckedAt=Date.now();
  $('#signup-status').textContent=result.message||'Account created. Check your email if confirmation is required.';
  if(result.authenticated)await refreshSession();
 }catch(error){$('#signup-status').textContent=error.message;}
 finally{button.disabled=false;}
});
$('#logout-button').addEventListener('click',async()=>{
 try{await api('/api/account/logout',{method:'POST'});}catch{}
 clearSessionGeminiApiKey();showSignedOut();
 $('#account-status').textContent='You have signed out. This browser’s guest history remains separate.';
 await loadRecordings();
});
async function loadKeyState(){
 try{
  const data=await api('/api/account/api-key');
  $('#key-state').textContent=data.configured
   ?'A personal Gemini key is saved securely for this account ('+data.masked+').'
   :'No personal key is saved. The project key will be used if configured.';
 }catch(error){$('#key-state').textContent=error.message;}
}
$('#save-api-key').addEventListener('click',async()=>{
 const key=$('#api-key').value.trim();
 if(!key){$('#key-state').textContent='Paste your Gemini API key first.';return;}
 const button=$('#save-api-key');button.disabled=true;$('#key-state').textContent='Encrypting and saving…';
 try{
  await api('/api/account/api-key',{method:'PUT',body:{apiKey:key}});
  $('#api-key').value='';clearSessionGeminiApiKey();
  $('#key-state').textContent='Your Gemini key is encrypted and saved to this account.';
  await loadKeyState();
 }catch(error){$('#key-state').textContent=error.message;}
 finally{button.disabled=false;}
});
$('#remove-api-key').addEventListener('click',async()=>{
 const button=$('#remove-api-key');button.disabled=true;
 try{
  await api('/api/account/api-key',{method:'DELETE'});
  $('#key-state').textContent='Saved Gemini key deleted. The project key will be used if configured.';
 }catch(error){$('#key-state').textContent=error.message;}
 finally{button.disabled=false;}
});
async function loadHistory(append=false){
 if(!append){historyOffset=0;$('#history-list').replaceChildren();}
 $('#history-status').textContent=append?'Loading older account photos…':'Loading account history…';
 try{
  const data=await api('/api/account/history?limit=24&offset='+historyOffset);
  const history=data.history||[];
  if(!history.length&&!append)$('#history-status').textContent='No account photos yet. Photos submitted while signed in will appear here.';
  else $('#history-status').textContent='Showing '+history.length+' account record'+(history.length===1?'':'s')+'.';
  historyOffset=Number(data.nextOffset)||historyOffset;
  $('#load-more-history').hidden=!data.hasMore;
  for(const item of history)$('#history-list').append(createHistoryCard(item,'account'));
 }catch(error){$('#history-status').textContent=error.message;}
}
$('#refresh-history').addEventListener('click',()=>loadHistory(false));
$('#load-more-history').addEventListener('click',()=>loadHistory(true));

async function loadUsage(){
 $('#usage-list').replaceChildren();$('#usage-summary').textContent='Loading usage…';
 try{
  const data=await api('/api/account/usage'),usage=data.usage||[];
  const total=usage.reduce((sum,row)=>sum+(Number(row.total_tokens)||0),0);
  $('#usage-summary').textContent=usage.length+' requests · '+total.toLocaleString()+' reported tokens in the last 90 days.';
  if(!usage.length)$('#usage-list').append(make('p','account-muted','No usage records yet.'));
  for(const item of usage){
   const row=make('div','account-usage-row');
   row.append(make('strong','',item.request_type||'AI request'));
   row.append(make('span','',item.model||'Unknown model'));
   row.append(make('span','',formatDate(item.created_at)));
   row.append(make('span','',Number(item.total_tokens||0).toLocaleString()+' tokens'));
   $('#usage-list').append(row);
  }
 }catch(error){$('#usage-summary').textContent=error.message;}
}
$('#refresh-usage').addEventListener('click',loadUsage);
$('#delete-history').addEventListener('click',async()=>{
 if(!window.confirm('Delete all photos, answers and usage records in this account? This cannot be undone.'))return;
 const button=$('#delete-history');button.disabled=true;$('#history-status').textContent='Deleting account history…';
 try{
  await api('/api/account/history',{method:'DELETE'});
  $('#history-list').replaceChildren();$('#load-more-history').hidden=true;
  $('#usage-list').replaceChildren();$('#usage-summary').textContent='No usage records.';
  $('#history-status').textContent='All account photos, answers and usage records were deleted.';
 }catch(error){$('#history-status').textContent=error.message;}
 finally{button.disabled=false;}
});

refreshGuestHistorySession();
refreshSession();
