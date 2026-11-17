import { clearSessionGeminiApiKey } from '/shared/api.js?v=20261117-release1';

const $=selector=>document.querySelector(selector);
const authPanel=$('#auth-panel'),accountPanel=$('#account-panel');
let currentUser=null;
let sessionCheckedAt=0;
let sessionRefreshPromise=null;

async function ensureSessionFresh(){
 if(Date.now()-sessionCheckedAt<4*60*1000)return;
 if(!sessionRefreshPromise){
  sessionRefreshPromise=fetch('/api/account/session',{credentials:'same-origin',cache:'no-store'})
   .catch(()=>null)
   .finally(()=>{sessionCheckedAt=Date.now();sessionRefreshPromise=null;});
 }
 await sessionRefreshPromise;
}
let historyOffset=0;

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
function showSignedIn(user) {
 currentUser=user;
 authPanel.hidden=true;accountPanel.hidden=false;
 $('#account-email').textContent=user.email||'Signed in';
}
function showSignedOut() {
 currentUser=null;
 authPanel.hidden=false;accountPanel.hidden=true;
}
function formatDate(value) {
 const date=new Date(value);
 return Number.isNaN(date.getTime())?String(value||''):date.toLocaleString();
}
function make(tag,className,text) {
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
}

async function refreshSession() {
 try{
  const state=await api('/api/account/session');
  if(!state.authenticated){
   showSignedOut();
   $('#account-status').textContent='Account service is ready. Sign in or create an account.';
   return;
  }
  showSignedIn(state.user);
  $('#account-status').textContent='Signed in. Your account data is private to this account.';
  await Promise.all([loadKeyState(),loadHistory(),loadUsage()]);
 }catch(error){
  showSignedOut();
  $('#account-status').textContent=error.message;
 }
}

$('#login-form').addEventListener('submit',async event=>{
 event.preventDefault();
 $('#login-status').textContent='Signing in…';
 try{
  const result=await api('/api/account/login',{method:'POST',body:{
   email:$('#login-email').value.trim(),password:$('#login-password').value
  }});
  $('#login-password').value='';
  sessionCheckedAt=Date.now();
  showSignedIn(result.user);
  $('#account-status').textContent='Signed in successfully.';
  $('#login-status').textContent='';
  await Promise.all([loadKeyState(),loadHistory(),loadUsage()]);
 }catch(error){$('#login-status').textContent=error.message;}
});

$('#signup-form').addEventListener('submit',async event=>{
 event.preventDefault();
 $('#signup-status').textContent='Creating account…';
 try{
  const result=await api('/api/account/signup',{method:'POST',body:{
   email:$('#signup-email').value.trim(),password:$('#signup-password').value
  }});
  $('#signup-password').value='';
  if(result.authenticated)sessionCheckedAt=Date.now();
  $('#signup-status').textContent=result.message||'Account created. Check your email if confirmation is required.';
  if(result.authenticated)await refreshSession();
 }catch(error){$('#signup-status').textContent=error.message;}
});

$('#logout-button').addEventListener('click',async()=>{
 try{await api('/api/account/logout',{method:'POST'});}catch{}
 clearSessionGeminiApiKey();
 showSignedOut();
 $('#account-status').textContent='You have signed out.';
});

async function loadKeyState(){
 try{
  const data=await api('/api/account/api-key');
  $('#key-state').textContent=data.configured
   ? 'A personal Gemini key is saved securely for this account ('+data.masked+').'
   : 'No personal key is saved. The project key will be used if configured.';
 }catch(error){$('#key-state').textContent=error.message;}
}
$('#save-api-key').addEventListener('click',async()=>{
 const key=$('#api-key').value.trim();
 if(!key){$('#key-state').textContent='Paste your Gemini API key first.';return;}
 $('#save-api-key').disabled=true;
 $('#key-state').textContent='Encrypting and saving…';
 try{
  await api('/api/account/api-key',{method:'PUT',body:{apiKey:key}});
  $('#api-key').value='';
  clearSessionGeminiApiKey();
  $('#key-state').textContent='Your Gemini key is encrypted and saved to this account. It will be used when you are signed in.';
  await loadKeyState();
 }catch(error){$('#key-state').textContent=error.message;}
 finally{$('#save-api-key').disabled=false;}
});
$('#remove-api-key').addEventListener('click',async()=>{
 $('#remove-api-key').disabled=true;
 try{
  await api('/api/account/api-key',{method:'DELETE'});
  $('#key-state').textContent='Saved Gemini key deleted. The project key will be used if configured.';
 }catch(error){$('#key-state').textContent=error.message;}
 finally{$('#remove-api-key').disabled=false;}
});

async function loadHistory(append=false){
 if(!append){historyOffset=0;$('#history-list').replaceChildren();}
 $('#history-status').textContent=append?'Loading older history…':'Loading private history…';
 try{
  const data=await api('/api/account/history?limit=50&offset='+historyOffset);
  if(!data.history?.length&&!append){
   $('#history-status').textContent='No saved photos or answers yet. Enable the history option in Admin before a future photo analysis.';
   $('#load-more-history').hidden=true;
   return;
  }
  historyOffset=Number(data.nextOffset)||historyOffset;
  $('#load-more-history').hidden=!data.hasMore;
  $('#history-status').textContent=append?'Loaded '+data.history.length+' older records.':'Showing the newest saved records.';
  for(const item of (data.history||[])){
   const card=make('article','history-card');
   const title=make('h3','',item.question||'Scene description');
   const meta=make('p','hint',formatDate(item.created_at)+' · '+item.model+' · '+(item.total_tokens??'Token count unavailable')+' tokens');
   card.append(title,meta);
   if(item.photoUrl){
    const image=document.createElement('img');image.src=item.photoUrl;image.alt='Private photo saved with this AI response';image.loading='lazy';image.className='history-photo';card.append(image);
   }
   const answer=make('p','history-answer',item.response_text||'No saved answer.');
   card.append(answer);
   if(item.ip_fingerprint)card.append(make('small','hint','Network IP fingerprint (not the raw IP): '+item.ip_fingerprint));
   if(item.user_agent)card.append(make('small','hint','Browser: '+item.user_agent));
   if(item.attempted_models?.length)card.append(make('small','hint','Models tried: '+item.attempted_models.join(' → ')));
   const deleteButton=make('button','secondary','Delete this record');
   deleteButton.type='button';
   deleteButton.addEventListener('click',async()=>{
    if(!window.confirm('Delete this photo and answer from your account?'))return;
    deleteButton.disabled=true;
    try{await api('/api/account/history/'+encodeURIComponent(item.id),{method:'DELETE'});await loadHistory();}
    catch(error){$('#history-status').textContent=error.message;deleteButton.disabled=false;}
   });
   card.append(deleteButton);
   $('#history-list').append(card);
  }
 }catch(error){$('#history-status').textContent=error.message;}
}
$('#refresh-history').addEventListener('click',()=>loadHistory(false));
$('#load-more-history').addEventListener('click',()=>loadHistory(true));

async function loadUsage(){
 $('#usage-list').replaceChildren();
 $('#usage-summary').textContent='Loading usage…';
 try{
  const data=await api('/api/account/usage');
  const usage=data.usage||[];
  const total=usage.reduce((sum,row)=>sum+(Number(row.total_tokens)||0),0);
  $('#usage-summary').textContent=usage.length+' logged requests · '+total.toLocaleString()+' reported tokens · rolling 90-day window.';
  for(const item of usage){
   const meta=make('p','hint',formatDate(item.created_at)+' · '+item.request_type+' · '+item.model+
    ' · '+(item.total_tokens??'unknown')+' tokens'+
    (item.ip_fingerprint?' · IP fingerprint '+item.ip_fingerprint:''));
   $('#usage-list').append(meta);
  }
  if(!usage.length)$('#usage-list').append(make('p','hint','No usage records yet. Turn on photo history in Admin and use the AI while signed in.'));
 }catch(error){$('#usage-summary').textContent=error.message;}
}
$('#refresh-usage').addEventListener('click',loadUsage);

$('#delete-history').addEventListener('click',async()=>{
 const accepted=window.confirm('Delete all photos, answers and usage records in this account? This cannot be undone.');
 if(!accepted)return;
 $('#history-status').textContent='Deleting…';
 try{
  await api('/api/account/history',{method:'DELETE'});
  $('#history-status').textContent='All saved history and usage records were deleted.';
  $('#history-list').replaceChildren();$('#load-more-history').hidden=true;$('#usage-list').replaceChildren();$('#usage-summary').textContent='No usage records.';
 }catch(error){$('#history-status').textContent=error.message;}
});

refreshSession();
