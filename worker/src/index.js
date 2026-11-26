import { buildPrompt, DEFAULT_MODES, RESPONSE_STYLES, RESPONSE_LANGUAGES, SAFETY_CORE, SCENE_RULES } from './prompts.js';
export { SOSRoom } from './sos-room.js';
export { SOSDirectory } from './sos-directory.js';
export { RFIDDirectory } from './rfid-directory.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const USER_KEY_HEADER = 'x-user-gemini-api-key';
// Prefer Flash models for the free-tier demo. 3.6 Flash is deliberately
// de-prioritised after the reported mid-answer truncation; Pro is not an
// automatic fallback because it may not be available on a free key.
const VISION_MODEL_PRIORITY = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
];
const TRANSCRIPTION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];
const STATIC_VISION_FALLBACKS = VISION_MODEL_PRIORITY.slice(1);
const LOW_COST_TRANSCRIPTION_MODELS = TRANSCRIPTION_MODELS;
let visionRotation = 0;
let transcriptionRotation = 0;
let modelCache = { tag: '', expiresAt: 0, models: [] };

function hasPersonalKey(request) {
  return Boolean(String(request.headers.get(USER_KEY_HEADER) || '').trim());
}

function supabasePublishableKey(env) {
  return String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
}
function supabaseSecretKey(env) {
  return String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}
function supabaseConfigured(env) {
  return Boolean(env.SUPABASE_URL && supabasePublishableKey(env) && supabaseSecretKey(env));
}
function supabaseServiceHeaders(env, extra = {}) {
  const secretKey = supabaseSecretKey(env);
  return {
    apikey: secretKey,
    // New sb_secret keys must only be sent via apikey; they are not JWTs.
    // Keep the Authorization header only for legacy JWT service_role keys.
    ...(!env.SUPABASE_SECRET_KEY ? { Authorization: 'Bearer ' + secretKey } : {}),
    ...extra
  };
}
function supabaseBase(env) {
  return String(env.SUPABASE_URL || '').replace(/\/+$/, '');
}
function readCookies(request) {
  const out = {};
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0,index).trim();
    try { out[key] = decodeURIComponent(part.slice(index+1).trim()); } catch {}
  }
  return out;
}
function randomGuestToken() {
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function guestSessionHash(request) {
  const token=String(readCookies(request).de_guest||'');
  if(!/^[a-f0-9]{64}$/i.test(token))return null;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function sessionCookie(name,value,maxAge) {
  return name+'='+encodeURIComponent(value||'')+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
}
function withCookies(response,cookies=[]) {
  for (const cookie of cookies) response.headers.append('Set-Cookie',cookie);
  return response;
}
function accountJson(data,status=200,cookies=[]) {
  return withCookies(json(data,status),cookies);
}
function supabaseHeaders(env,token,extra={}) {
  return {
    apikey:supabasePublishableKey(env),
    ...(token?{Authorization:'Bearer '+token}:{}),
    ...extra
  };
}
async function supabaseAuthFetch(env,path,{method='GET',body,token}={}) {
  const headers=supabaseHeaders(env,token,{'content-type':'application/json'});
  return fetch(supabaseBase(env)+'/auth/v1/'+path,{
    method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
}
async function supabaseRest(env,path,{method='GET',body,prefer='return=minimal'}={}) {
  const headers=supabaseServiceHeaders(env,{
    'content-type':'application/json',
    Prefer:prefer
  });
  return fetch(supabaseBase(env)+'/rest/v1/'+path,{
    method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
}
async function getAuthenticatedUser(request,env) {
  if(!supabaseConfigured(env))return null;
  const access=readCookies(request).de_access;
  if(!access)return null;
  try{
    const response=await supabaseAuthFetch(env,'user',{token:access});
    if(!response.ok)return null;
    const user=await response.json();
    return user?.id?user:null;
  }catch{return null;}
}
function bytesToBase64(bytes) {
  let binary='';
  for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary=atob(String(value||''));
  return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
}
async function encryptionKey(env) {
  if(!env.API_KEY_ENCRYPTION_KEY)throw new Error('API-key encryption is not configured on the Worker.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(env.API_KEY_ENCRYPTION_KEY)));
  return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptUserApiKey(apiKey,env) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(env),new TextEncoder().encode(apiKey));
  return {key_ciphertext:bytesToBase64(encrypted),key_iv:bytesToBase64(iv),key_version:1};
}
async function decryptUserApiKey(row,env) {
  const clear=await crypto.subtle.decrypt(
    {name:'AES-GCM',iv:base64ToBytes(row.key_iv)},
    await encryptionKey(env),
    base64ToBytes(row.key_ciphertext)
  );
  return new TextDecoder().decode(clear);
}
async function getStoredUserApiKey(user,env) {
  if(!user||!supabaseConfigured(env)||!env.API_KEY_ENCRYPTION_KEY)return '';
  try{
    const response=await supabaseRest(env,'user_api_keys?select=key_ciphertext,key_iv,key_version&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
    if(!response.ok)return '';
    const rows=await response.json();
    if(!rows[0])return '';
    return await decryptUserApiKey(rows[0],env);
  }catch{return '';}
}
async function providerKey(request,env) {
  const personal=String(request.headers.get(USER_KEY_HEADER)||'').trim();
  if(personal)return personal.slice(0,256);
  const user=await getAuthenticatedUser(request,env);
  const saved=await getStoredUserApiKey(user,env);
  return saved||String(env.GEMINI_API_KEY||'').trim();
}
async function keyedIpFingerprint(request,env) {
  const ip=String(request.headers.get('cf-connecting-ip')||'').trim();
  if(!ip||!env.IP_HASH_SECRET)return null;
  try{
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(env.IP_HASH_SECRET)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip));
    return Array.from(new Uint8Array(signature).slice(0,12),b=>b.toString(16).padStart(2,'0')).join('');
  }catch{return null;}
}
async function storePrivatePhoto(env,ownerFolder,imageDataUrl) {
  const match=/^data:(image\/jpeg);base64,([A-Za-z0-9+/=]+)$/i.exec(String(imageDataUrl||''));
  if(!match)throw new Error('The selected photo could not be stored as a supported image.');
  const bytes=base64ToBytes(match[2]);
  if(bytes.byteLength>3_800_000)throw new Error('The compressed photo exceeds the private history limit.');
  const safeFolder=String(ownerFolder||'').replace(/[^a-zA-Z0-9_-]/g,'');
  if(!safeFolder)throw new Error('A valid private photo owner is required.');
  const path=safeFolder+'/'+crypto.randomUUID()+'.jpg';
  const response=await fetch(supabaseBase(env)+'/storage/v1/object/daredevil-history/'+path,{
    method:'POST',
    headers:supabaseServiceHeaders(env,{
      'content-type':'image/jpeg',
      'x-upsert':'false'
    }),
    body:bytes
  });
  if(!response.ok)throw new Error('Private photo storage failed (HTTP '+response.status+').');
  return {path,size:bytes.byteLength,mime:match[1].toLowerCase()};
}
async function storeAccountUsage(env,user,request,{model,requestType,usage,imageSizeBytes}) {
  if(!user||!supabaseConfigured(env))return;
  const record={
    user_id:user.id,request_type:requestType,model:String(model||'unknown'),
    prompt_tokens:Number.isFinite(usage?.promptTokenCount)?usage.promptTokenCount:null,
    output_tokens:Number.isFinite(usage?.candidatesTokenCount)?usage.candidatesTokenCount:null,
    total_tokens:Number.isFinite(usage?.totalTokenCount)?usage.totalTokenCount:null,
    image_size_bytes:Number.isFinite(imageSizeBytes)?imageSizeBytes:null,
    ip_fingerprint:await keyedIpFingerprint(request,env)
  };
  try{
    await supabaseRest(env,'api_usage',{method:'POST',body:record});
    const expiry=new Date().toISOString();
    await supabaseRest(env,'api_usage?expires_at=lt.'+encodeURIComponent(expiry),{method:'DELETE'});
  }catch{}
}
async function createPhotoHistoryDraft(env,user,request,body,fullPrompt,selectedModel,action) {
  if(body.saveToHistory===false)return {saved:false,message:'Photo history is switched off.'};
  if(!supabaseConfigured(env))return {saved:false,message:'Photo history is not configured on the Worker yet.'};
  const guestHash=user?null:await guestSessionHash(request);
  if(!user&&!guestHash)return {saved:false,message:'A private guest-history session could not be created. Refresh the page and try again.'};
  let storedPhoto=null;
  try{
    const ownerFolder=user?user.id:'guest-'+guestHash;
    storedPhoto=await storePrivatePhoto(env,ownerFolder,body.image);
    const id=crypto.randomUUID();
    const record={
      id,user_id:user?.id||null,guest_session_hash:guestHash,
      request_type:action,question:String(body.question||''),
      system_prompt:String(fullPrompt||body.customPrompt||''),
      response_text:'',model:String(selectedModel||'unknown'),
      attempted_models:[],finish_reason:null,
      response_language:String(body.responseLanguage||'bn-BD'),
      prompt_tokens:null,output_tokens:null,total_tokens:null,
      photo_path:storedPhoto.path,photo_mime:storedPhoto.mime,
      photo_size_bytes:storedPhoto.size,analysis_status:'pending',analysis_error:null,
      ip_fingerprint:await keyedIpFingerprint(request,env),
      user_agent:user?String(request.headers.get('user-agent')||'').slice(0,500):null
    };
    const response=await supabaseRest(env,'ai_history',{method:'POST',body:record});
    if(!response.ok)throw new Error('Private history metadata insert failed (HTTP '+response.status+').');
    return {
      saved:true,id,ownerId:user?.id||null,guestHash,
      message:user?'Photo saved to your account history.':'Photo saved to private guest history in this browser.'
    };
  }catch(error){
    if(storedPhoto?.path){
      try{await fetch(supabaseBase(env)+'/storage/v1/object/daredevil-history/'+storedPhoto.path,{method:'DELETE',headers:supabaseServiceHeaders(env)});}catch{}
    }
    return {saved:false,message:error.message||'Photo could not be saved.'};
  }
}
async function completePhotoHistory(env,draft,result,error) {
  if(!draft?.saved)return draft||{saved:false,message:'No history record was created.'};
  const usage=result?.usage||{};
  const patch={
    response_text:error
      ?'AI analysis did not complete. The photo itself is saved; you can keep it in history or delete it.'
      :String(result?.answer||''),
    model:String(result?.model||'unknown'),
    attempted_models:Array.isArray(result?.attempted)?result.attempted:[],
    finish_reason:result?.finishReason|| (error?'ERROR':null),
    prompt_tokens:Number.isFinite(usage.promptTokenCount)?usage.promptTokenCount:null,
    output_tokens:Number.isFinite(usage.candidatesTokenCount)?usage.candidatesTokenCount:null,
    total_tokens:Number.isFinite(usage.totalTokenCount)?usage.totalTokenCount:null,
    analysis_status:error?'failed':'completed',
    analysis_error:error?String(error.message||'AI analysis failed.').replace(/[\r\n]+/g,' ').slice(0,240):null
  };
  const ownerFilter=draft.ownerId
    ?'user_id=eq.'+encodeURIComponent(draft.ownerId)
    :'guest_session_hash=eq.'+encodeURIComponent(draft.guestHash);
  try{
    const response=await supabaseRest(env,'ai_history?id=eq.'+encodeURIComponent(draft.id)+'&'+ownerFilter,{method:'PATCH',body:patch});
    if(!response.ok)return {...draft,saved:true,message:'Photo is saved, but its AI result status could not be updated.'};
    return {...draft,saved:true,message:error
      ?'Photo saved to history. AI analysis did not complete.'
      :draft.message.replace('Photo saved','Photo and answer saved')};
  }catch{return {...draft,saved:true,message:'Photo is saved, but its AI result status could not be updated.'};}
}

async function handleAccountApi(request,env,url) {
  if(['POST','PUT','PATCH','DELETE'].includes(request.method)){
    const origin=request.headers.get('origin');
    if(!origin)return json({error:'A same-origin request is required for account changes.'},403);
    try{if(new URL(origin).origin!==url.origin)return json({error:'Cross-origin account changes are not allowed.'},403);}
    catch{return json({error:'Invalid request origin.'},403);}
  }
  const path=url.pathname;
  if(!supabaseConfigured(env))return json({ok:false,error:'Account and photo-history services are not configured yet. Connect Supabase and add the Worker secrets described in the setup guide.'},503);
  if(path==='/api/guest/session'&&request.method==='GET'){
    const existing=readCookies(request).de_guest||'';
    if(/^[a-f0-9]{64}$/i.test(existing))return json({ok:true,ready:true,expiresInDays:30});
    const token=randomGuestToken();
    return accountJson({ok:true,ready:true,expiresInDays:30},200,[sessionCookie('de_guest',token,30*24*60*60)]);
  }
  if(path==='/api/account/signup'&&request.method==='POST'){
    let body;try{body=await request.json();}catch{return json({error:'Invalid sign-up form.'},400);}
    const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>256)return json({error:'Enter a valid email and a password of at least 12 characters.'},400);
    try{
      const response=await supabaseAuthFetch(env,'signup',{method:'POST',body:{email,password}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)return json({error:response.status===429?'Too many sign-up attempts. Try later.':'Could not create the account. Check the email and password, then try again.'},400);
      const cookies=data.access_token&&data.refresh_token?[
        sessionCookie('de_access',data.access_token,Number(data.expires_in)||3600),
        sessionCookie('de_refresh',data.refresh_token,30*24*60*60)
      ]:[];
      return accountJson({ok:true,created:true,authenticated:Boolean(data.access_token),user:data.user?{id:data.user.id,email:data.user.email}:null,email,confirmationRequired:!data.access_token,message:data.access_token?'Account created and signed in.':'Check your email to confirm your account, then sign in.'},200,cookies);
    }catch{return json({error:'Account service is temporarily unavailable.'},503);}
  }
  if(path==='/api/account/login'&&request.method==='POST'){
    let body;try{body=await request.json();}catch{return json({error:'Invalid login form.'},400);}
    const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
    if(!email||!password)return json({error:'Email and password are required.'},400);
    try{
      const response=await supabaseAuthFetch(env,'token?grant_type=password',{method:'POST',body:{email,password}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.access_token)return json({error:'Email or password is incorrect, or the email is not confirmed.'},401);
      return accountJson({ok:true,authenticated:true,user:{id:data.user.id,email:data.user.email}},200,[
        sessionCookie('de_access',data.access_token,Number(data.expires_in)||3600),
        sessionCookie('de_refresh',data.refresh_token,30*24*60*60)
      ]);
    }catch{return json({error:'Account service is temporarily unavailable.'},503);}
  }
  if(path==='/api/account/session'&&request.method==='GET'){
    const cookies=readCookies(request),access=cookies.de_access,refresh=cookies.de_refresh;
    if(access){
      try{
        const response=await supabaseAuthFetch(env,'user',{token:access});
        if(response.ok){
          const user=await response.json();
          return json({ok:true,authenticated:true,user:{id:user.id,email:user.email}});
        }
      }catch{}
    }
    if(refresh){
      try{
        const response=await supabaseAuthFetch(env,'token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh}});
        const data=await response.json().catch(()=>({}));
        if(response.ok&&data.access_token){
          return accountJson({ok:true,authenticated:true,user:{id:data.user.id,email:data.user.email}},200,[
            sessionCookie('de_access',data.access_token,Number(data.expires_in)||3600),
            sessionCookie('de_refresh',data.refresh_token,30*24*60*60)
          ]);
        }
      }catch{}
    }
    return accountJson({ok:true,authenticated:false},200,[
      sessionCookie('de_access','',0),sessionCookie('de_refresh','',0)
    ]);
  }
  if(path==='/api/account/logout'&&request.method==='POST'){
    const cookies=readCookies(request);
    if(cookies.de_access){
      try{await supabaseAuthFetch(env,'logout',{method:'POST',token:cookies.de_access});}catch{}
    }
    return accountJson({ok:true},200,[sessionCookie('de_access','',0),sessionCookie('de_refresh','',0)]);
  }
  if(path==='/api/guest/history'||path.startsWith('/api/guest/history/')){
    const guestHash=await guestSessionHash(request);
    if(!guestHash)return json({error:'Guest history session expired. Refresh this page to create a new private session.'},401);
    const guestFilter='guest_session_hash=eq.'+encodeURIComponent(guestHash);
    const guestItemId=path.startsWith('/api/guest/history/')?path.slice('/api/guest/history/'.length):'';
    if(guestItemId&&request.method==='DELETE'&&/^[0-9a-f-]{36}$/i.test(guestItemId)){
      const filter='id=eq.'+encodeURIComponent(guestItemId)+'&'+guestFilter;
      const selected=await supabaseRest(env,'ai_history?select=photo_path&'+filter);
      if(!selected.ok)return json({error:'Could not find that guest-history record.'},404);
      const rows=await selected.json().catch(()=>[]);
      if(!rows.length)return json({error:'That record is not in this browser’s guest history.'},404);
      for(const row of rows){
        if(row.photo_path){
          try{
            const removed=await fetch(supabaseBase(env)+'/storage/v1/object/daredevil-history/'+row.photo_path,{method:'DELETE',headers:supabaseServiceHeaders(env)});
            if(!removed.ok&&removed.status!==404)return json({error:'Could not remove the private photo file. The history record was kept; retry deletion.'},502);
          }catch{return json({error:'Private photo storage is unreachable. The history record was kept; retry deletion.'},502);}
        }
      }
      const deleted=await supabaseRest(env,'ai_history?'+filter,{method:'DELETE'});
      if(!deleted.ok)return json({error:'Could not delete this guest-history record.'},502);
      return json({ok:true,deleted:true});
    }
    if(path==='/api/guest/history'&&request.method==='GET'){
      const requestedLimit=Number(url.searchParams.get('limit'));
      const limit=Number.isInteger(requestedLimit)?Math.max(1,Math.min(100,requestedLimit)):30;
      const requestedOffset=Number(url.searchParams.get('offset'));
      const offset=Number.isInteger(requestedOffset)?Math.max(0,Math.min(100000,requestedOffset)):0;
      const query='ai_history?select=id,request_type,question,response_text,model,attempted_models,response_language,total_tokens,photo_path,photo_size_bytes,analysis_status,analysis_error,created_at&'+guestFilter+'&order=created_at.desc&limit='+(limit+1)+'&offset='+offset;
      const response=await supabaseRest(env,query);
      if(!response.ok)return json({error:'Could not load guest photo history.'},502);
      const rows=await response.json();
      const hasMore=rows.length>limit,history=[];
      for(const row of rows.slice(0,limit)){
        let photoUrl=null;
        if(row.photo_path){
          try{
            const signed=await fetch(supabaseBase(env)+'/storage/v1/object/sign/daredevil-history/'+row.photo_path,{
              method:'POST',headers:supabaseServiceHeaders(env,{'content-type':'application/json'}),
              body:JSON.stringify({expiresIn:600})
            });
            const signedData=await signed.json().catch(()=>({}));
            if(signed.ok&&signedData.signedURL)photoUrl=signedData.signedURL.startsWith('http')?signedData.signedURL:supabaseBase(env)+'/storage/v1'+signedData.signedURL;
          }catch{}
        }
        history.push({...row,photoUrl});
      }
      return json({ok:true,scope:'guest-browser',retentionDays:30,history,hasMore,nextOffset:offset+history.length});
    }
    if(path==='/api/guest/history'&&request.method==='DELETE'){
      let offset=0;
      while(true){
        const selected=await supabaseRest(env,'ai_history?select=id,photo_path&'+guestFilter+'&order=created_at.asc&limit=200&offset='+offset);
        if(!selected.ok)return json({error:'Could not list guest photos for deletion.'},502);
        const rows=await selected.json().catch(()=>[]);
        for(const row of rows){
          if(row.photo_path){
            try{
              const removed=await fetch(supabaseBase(env)+'/storage/v1/object/daredevil-history/'+row.photo_path,{method:'DELETE',headers:supabaseServiceHeaders(env)});
              if(!removed.ok&&removed.status!==404)return json({error:'Could not remove a private photo. Guest history was kept; retry deletion.'},502);
            }catch{return json({error:'Private photo storage is unreachable. Guest history was kept; retry deletion.'},502);}
          }
        }
        offset+=rows.length;
        if(rows.length<200)break;
      }
      const deleted=await supabaseRest(env,'ai_history?'+guestFilter,{method:'DELETE'});
      if(!deleted.ok)return json({error:'Could not delete guest photo history.'},502);
      return json({ok:true,deleted:true});
    }
  }

  const user=await getAuthenticatedUser(request,env);
  if(!user)return json({error:'Sign in to manage your account data.'},401);

  if(path==='/api/account/api-key'&&request.method==='GET'){
    const response=await supabaseRest(env,'user_api_keys?select=user_id&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
    const rows=response.ok?await response.json().catch(()=>[]):[];
    return json({ok:true,configured:Boolean(rows[0]),masked:rows[0]?'••••••••':'Not configured'});
  }
  if(path==='/api/account/api-key'&&request.method==='PUT'){
    let body;try{body=await request.json();}catch{return json({error:'Invalid API key form.'},400);}
    const key=String(body.apiKey||'').trim();
    if(key.length<20||key.length>256)return json({error:'Enter a valid Gemini API key.'},400);
    if(!env.API_KEY_ENCRYPTION_KEY)return json({error:'Worker API_KEY_ENCRYPTION_KEY secret is not configured.'},503);
    try{
      const encrypted=await encryptUserApiKey(key,env);
      const response=await supabaseRest(env,'user_api_keys?on_conflict=user_id',{method:'POST',body:{user_id:user.id,...encrypted,updated_at:new Date().toISOString()},prefer:'resolution=merge-duplicates,return=minimal'});
      if(!response.ok)return json({error:'The API key could not be saved securely.'},502);
      return json({ok:true,configured:true,masked:'••••••••'});
    }catch{return json({error:'The API key could not be encrypted or saved.'},503);}
  }
  if(path==='/api/account/api-key'&&request.method==='DELETE'){
    const response=await supabaseRest(env,'user_api_keys?user_id=eq.'+encodeURIComponent(user.id),{method:'DELETE'});
    if(!response.ok)return json({error:'Could not delete the saved API key.'},502);
    return json({ok:true,configured:false});
  }
  const historyItemId=path.startsWith('/api/account/history/')?path.slice('/api/account/history/'.length):'';
  if(historyItemId&&request.method==='DELETE'&&/^[0-9a-f-]{36}$/i.test(historyItemId)){
    const id=historyItemId;
    const selected=await supabaseRest(env,'ai_history?select=photo_path&id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(user.id));
    if(!selected.ok)return json({error:'Could not find that history record.'},404);
    const rows=await selected.json().catch(()=>[]);
    if(!rows.length)return json({error:'That history record was not found in your account.'},404);
    for(const row of rows){
      if(row.photo_path){
        try{
          const removed=await fetch(supabaseBase(env)+'/storage/v1/object/daredevil-history/'+row.photo_path,{method:'DELETE',headers:supabaseServiceHeaders(env)});
          if(!removed.ok&&removed.status!==404)return json({error:'Could not remove one of your private photo files. History records were kept; please retry.'},502);
        }catch{return json({error:'Private photo storage is unreachable. History records were kept; please retry.'},502);}
      }
    }
    const deleted=await supabaseRest(env,'ai_history?id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(user.id),{method:'DELETE'});
    if(!deleted.ok)return json({error:'Could not delete that history record.'},502);
    return json({ok:true,deleted:true});
  }
  if(path==='/api/account/history'&&request.method==='GET'){
    const requestedLimit=Number(url.searchParams.get('limit'));
    const limit=Number.isInteger(requestedLimit)?Math.max(1,Math.min(100,requestedLimit)):50;
    const requestedOffset=Number(url.searchParams.get('offset'));
    const offset=Number.isInteger(requestedOffset)?Math.max(0,Math.min(100000,requestedOffset)):0;
    const query='ai_history?select=id,request_type,question,response_text,model,attempted_models,response_language,total_tokens,photo_path,photo_size_bytes,analysis_status,analysis_error,ip_fingerprint,user_agent,created_at&user_id=eq.'+encodeURIComponent(user.id)+'&order=created_at.desc&limit='+(limit+1)+'&offset='+offset;
    const response=await supabaseRest(env,query);
    if(!response.ok)return json({error:'Could not load history from Supabase.'},502);
    const rows=await response.json();
    const hasMore=rows.length>limit;
    const pageRows=rows.slice(0,limit);
    const history=[];
    for(const row of pageRows){
      let photoUrl=null;
      if(row.photo_path){
        try{
          const signed=await fetch(supabaseBase(env)+'/storage/v1/object/sign/daredevil-history/'+row.photo_path,{
            method:'POST',headers:supabaseServiceHeaders(env,{'content-type':'application/json'}),
            body:JSON.stringify({expiresIn:600})
          });
          const signedData=await signed.json().catch(()=>({}));
          if(signed.ok&&signedData.signedURL)photoUrl=signedData.signedURL.startsWith('http')?signedData.signedURL:supabaseBase(env)+'/storage/v1'+signedData.signedURL;
        }catch{}
      }
      history.push({...row,photoUrl});
    }
    return json({ok:true,history,hasMore,nextOffset:offset+history.length});
  }
  if(path==='/api/account/history'&&request.method==='DELETE'){
    const userFilter='user_id=eq.'+encodeURIComponent(user.id);
    let offset=0;
    while(true){
      const selected=await supabaseRest(env,'ai_history?select=photo_path&'+userFilter+'&limit=500&offset='+offset);
      if(!selected.ok)return json({error:'Could not list all saved photos for deletion.'},502);
      const page=await selected.json().catch(()=>[]);
      for(const row of page){
        if(row.photo_path){
          try{
            const removed=await fetch(supabaseBase(env)+'/storage/v1/object/daredevil-history/'+row.photo_path,{method:'DELETE',headers:supabaseServiceHeaders(env)});
            if(!removed.ok&&removed.status!==404)return json({error:'Could not remove one of your private photo files. History records were kept; please retry.'},502);
          }catch{return json({error:'Private photo storage is unreachable. History records were kept; please retry.'},502);}
        }
      }
      offset+=page.length;
      if(page.length<500)break;
    }
    const deleted=await supabaseRest(env,'ai_history?'+userFilter,{method:'DELETE'});
    if(!deleted.ok)return json({error:'Could not delete your saved history.'},502);
    const usageDeleted=await supabaseRest(env,'api_usage?'+userFilter,{method:'DELETE'});
    if(!usageDeleted.ok)return json({error:'History photos and answers were deleted, but usage records could not be deleted. Please retry the usage deletion.'},502);
    return json({ok:true,deleted:true});
  }
  if(path==='/api/account/usage'&&request.method==='GET'){
    const liveExpiry=new Date().toISOString();
    await supabaseRest(env,'api_usage?user_id=eq.'+encodeURIComponent(user.id)+'&expires_at=lt.'+encodeURIComponent(liveExpiry),{method:'DELETE'});
    const response=await supabaseRest(env,'api_usage?select=request_type,model,prompt_tokens,output_tokens,total_tokens,ip_fingerprint,created_at&user_id=eq.'+encodeURIComponent(user.id)+'&expires_at=gt.'+encodeURIComponent(liveExpiry)+'&order=created_at.desc&limit=1000');
    if(!response.ok)return json({error:'Could not load usage history.'},502);
    return json({ok:true,usage:await response.json()});
  }
  return json({error:'Account route not found.'},404);
}

function validPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Expected a JSON object.';
  if (body.image && typeof body.image !== 'string') return 'Image must be a base64 data URL string.';
  if (body.image && !/^data:image\/(jpeg|png|webp);base64,/i.test(body.image)) return 'Only JPEG, PNG, or WebP images are accepted.';
  if (body.image && body.image.length > 5_500_000) return 'Image is too large (maximum about 4 MB encoded).';
  if (body.question && (typeof body.question !== 'string' || body.question.length > 1000)) return 'Question must be text up to 1,000 characters.';
  if (body.customPrompt && (typeof body.customPrompt !== 'string' || body.customPrompt.length > 4000)) return 'Custom prompt must be text up to 4,000 characters.';
  if (body.systemPrompt && (typeof body.systemPrompt !== 'string' || body.systemPrompt.length > 4000)) return 'System prompt must be text up to 4,000 characters.';
  if (body.model && (typeof body.model !== 'string' || !/^[a-zA-Z0-9._-]{3,100}$/.test(body.model.replace(/^models\//, '')))) return 'Invalid model identifier.';
  if (body.responseStyle && !Object.hasOwn(RESPONSE_STYLES, body.responseStyle)) return 'Unsupported response style.';
  if (body.waitSeconds !== undefined && (!Number.isInteger(body.waitSeconds) || body.waitSeconds < 15 || body.waitSeconds > 180)) return 'Wait time must be between 15 and 180 seconds.';
  if (body.responseLanguage && !Object.hasOwn(RESPONSE_LANGUAGES, body.responseLanguage)) return 'Unsupported response language.';
  if (body.saveToHistory !== undefined && typeof body.saveToHistory !== 'boolean') return 'saveToHistory must be true or false.';
  return null;
}

function dataUrlByteLength(dataUrl) {
  const encoded=String(dataUrl||'').split(',')[1]||'';
  const padding=encoded.endsWith('==')?2:encoded.endsWith('=')?1:0;
  return Math.max(0,Math.floor(encoded.length*3/4)-padding);
}

function imageParts(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Invalid image data.');
  return { mime_type: match[1].toLowerCase(), data: match[2] };
}

function audioParts(dataUrl) {
  const match = /^data:(audio\/(?:webm|ogg|mp4|mpeg|mp3|wav|aac|opus|m4a|flac|aiff))(?:;codecs=[a-z0-9.]+)?;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Unsupported audio format. Please use a browser that records WebM, OGG or MP4 audio.');
  return { mime_type: match[1].toLowerCase(), data: match[2] };
}

function getMode(env) {
  const raw = String(env.AI_MODE ?? 'gemini').trim().toLowerCase();
  return raw || 'gemini';
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fingerprint(value) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest).slice(0, 10), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return String(value.length) + ':' + value.slice(-8);
  }
}

function modelPriority(id) {
  const index = VISION_MODEL_PRIORITY.indexOf(id);
  if (index >= 0) return index;
  if (/-pro(?:-|$)/i.test(id)) return 120;
  if (/3\.6-flash/i.test(id)) return 90;
  if (/flash-lite/i.test(id)) return 80;
  if (/flash/i.test(id)) return 50;
  return 100;
}

export function rankVisionModels(models) {
  return (Array.isArray(models) ? models : [])
    .filter(model => model && model.id && /^gemini-/i.test(model.id) && !/-pro(?:-|$)/i.test(model.id))
    .slice()
    .sort((a, b) => modelPriority(a.id) - modelPriority(b.id) || a.name.localeCompare(b.name))
    .map((model, index) => ({
      ...model,
      rank: index + 1,
      tierLabel: index === 0 ? 'Highest capability' :
        /flash-lite/i.test(model.id) ? 'Economy / low-latency' :
          /pro/i.test(model.id) ? 'Advanced reasoning' : 'Balanced multimodal'
    }));
}

export function getTranscriptionModelOrder() {
  const first = LOW_COST_TRANSCRIPTION_MODELS[transcriptionRotation % LOW_COST_TRANSCRIPTION_MODELS.length];
  transcriptionRotation = (transcriptionRotation + 1) % LOW_COST_TRANSCRIPTION_MODELS.length;
  return [first, ...LOW_COST_TRANSCRIPTION_MODELS.filter(model => model !== first)];
}

let ttsModelCache = null;
// TTS model ids change between releases, so use the key's own list (Flash first) with a known fallback.
async function ttsModelOrder(apiKey) {
  if (ttsModelCache) return ttsModelCache;
  let ids = [];
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': apiKey } });
    const data = await response.json().catch(() => ({}));
    ids = (data.models || []).map(m => String(m.name || '').replace(/^models\//, '')).filter(id => /tts/i.test(id));
  } catch {}
  ids.sort((a, b) => /pro/i.test(a) - /pro/i.test(b) || b.localeCompare(a));
  return (ttsModelCache = [...new Set([...ids, 'gemini-2.5-flash-preview-tts'])].slice(0, 3));
}

// Gemini TTS returns raw 16-bit mono PCM; wrap it in a WAV header so <audio> can play it.
export function pcmToWav(pcm, rate = 24000) {
  const wav = new Uint8Array(44 + pcm.length), v = new DataView(wav.buffer);
  const tag = (o, s) => { for (let i = 0; i < 4; i++) wav[o + i] = s.charCodeAt(i); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, 'data'); v.setUint32(40, pcm.length, true);
  wav.set(pcm, 44); return wav;
}

async function speakGemini(text, voice, prompt, apiKey) {
  let lastFailure = 'no TTS model answered';
  for (const model of await ttsModelOrder(apiKey)) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } })
    });
    const data = await response.json().catch(() => ({}));
    const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!response.ok || !part) { lastFailure = model + ': ' + (data?.error?.message || 'no audio returned'); continue; }
    const raw = atob(part.inlineData.data), pcm = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) pcm[i] = raw.charCodeAt(i);
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
    return new Response(pcmToWav(pcm, rate), { headers: { 'content-type': 'audio/wav', 'cache-control': 'no-store', 'x-tts-model': model } });
  }
  throw new Error('Gemini voice failed. ' + lastFailure);
}

export async function listGeminiModels(apiKey) {
  if (!apiKey) throw new Error('Gemini API key is not configured. Add a key in Admin or configure the Worker secret.');
  const tag = await fingerprint(apiKey);
  if (modelCache.tag === tag && modelCache.expiresAt > Date.now() && modelCache.models.length) return modelCache.models;
  const models = [];
  let pageToken = '';
  for (let page = 0; page < 3; page += 1) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { 'x-goog-api-key': apiKey } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Could not retrieve Gemini models.');
    models.push(...(data.models || []));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  const ranked = rankVisionModels(models
    .filter(model => model.name && model.supportedGenerationMethods?.includes('generateContent'))
    // This application analyses camera photos. Image-output, TTS, audio-only,
    // video, embedding and robotics models are not compatible with that task.
    .filter(model => !/(embedding|tts|live|image|imagen|veo|lyria|transcrib|audio|robotics|pro)/i.test(model.name) && !/gemini-3\.6-flash/i.test(model.name))
    .map(model => ({
      id: String(model.name).replace(/^models\//, ''),
      name: model.displayName || String(model.name).replace(/^models\//, ''),
      description: model.description || '',
      inputTokenLimit: model.inputTokenLimit || null,
      outputTokenLimit: model.outputTokenLimit || null,
      supportsThinking: Boolean(model.thinking)
    })));
  modelCache = { tag, expiresAt: Date.now() + 5 * 60 * 1000, models: ranked };
  return ranked;
}

async function modelCandidates(apiKey, selectedModel) {
  let available = [];
  try { available = await listGeminiModels(apiKey); } catch { /* Use known fallbacks if catalogue lookup is unavailable. */ }
  // Automatic fallbacks stay on Flash models; Pro remains a deliberate manual choice.
  const availableIds = available.map(model => model.id).filter(id => !/-pro(?:-|$)/i.test(id));
  const base = availableIds.length ? availableIds : [selectedModel, ...STATIC_VISION_FALLBACKS];
  const unique = [...new Set([selectedModel, ...base].filter(Boolean))];
  const selectedIndex = Math.max(0, unique.indexOf(selectedModel));
  const startIndex = (selectedIndex + visionRotation) % unique.length;
  visionRotation = (visionRotation + 1) % Math.max(1, unique.length);
  return unique.slice(startIndex).concat(unique.slice(0, startIndex));
}

async function askGemini({ image, prompt, model, waitSeconds }, apiKey) {
  if (!apiKey) throw new Error('Gemini is selected but no API key is available. Add your own key in Admin or configure the Worker secret.');
  const requestedModel = String(model || 'gemini-3.8-flash').replace(/^models\//, '');
  const selectedModel = /^gemini-3\.6-flash$/i.test(requestedModel) || /-pro(?:-|$)/i.test(requestedModel) ? 'gemini-3.8-flash' : requestedModel;
  const timeoutSeconds = Math.max(15, Math.min(180, Number(waitSeconds) || 120));
  const candidates = (await modelCandidates(apiKey, selectedModel)).slice(0, 6);
  const attempted = [];
  let lastFailure = '';
  for (const candidate of candidates) {
    attempted.push(candidate);
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(candidate) + ':generateContent';
    const requestBody = {
      system_instruction: { parts: [{ text: SAFETY_CORE }] },
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: imageParts(image) }] }],
      generationConfig: {
        // The old 260-token ceiling was too small for detailed answers and
        // also counted internal thinking tokens on Gemini 3.x.
        maxOutputTokens: 4096,
        temperature: 0.2,
        ...(candidate.startsWith('gemini-3.') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {})
      }
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt === 1) requestBody.generationConfig.maxOutputTokens = 8192;
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(Math.min(timeoutSeconds, 60) * 1000)
        });
      } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          lastFailure = 'Model ' + candidate + ' timed out.';
          break;
        }
        lastFailure = 'Could not reach Gemini: ' + (error.message || 'network error');
        break;
      }
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const candidateData = data?.candidates?.[0] || {};
        const answer = (candidateData?.content?.parts || []).map(part => part.text || '').join('').trim();
        const finishReason = String(candidateData.finishReason || '');
        if (finishReason === 'MAX_TOKENS') {
          lastFailure = candidate + ' hit MAX_TOKENS at ' + requestBody.generationConfig.maxOutputTokens + '.';
          if (attempt === 0) continue;
          break;
        }
        if (!answer) {
          lastFailure = 'Gemini model ' + candidate + ' returned no readable answer (' + (finishReason || 'unknown finish reason') + ').';
          break;
        }
        if (finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(finishReason)) {
          lastFailure = candidate + ' ended with ' + finishReason + '.';
          break;
        }
        return { answer, model: candidate, attempted, finishReason: finishReason || 'unspecified', usage: data.usageMetadata || null };
      }
      const message = data?.error?.message || 'Gemini request failed.';
      if (response.status === 503 && attempt === 0) {
        await wait(900);
        continue;
      }
      if ([400, 403, 404, 429, 503, 504].includes(response.status)) {
        lastFailure = candidate + ': ' + message;
        break;
      }
      if (response.status === 401) throw new Error('Gemini rejected this API key. Check that the key is valid and its API access is enabled.');
      throw new Error(message.slice(0, 300));
    }
  }
  throw new Error('No complete answer was returned. Automatic model fallback tried ' + attempted.join(', ') + '. ' +
    (lastFailure || 'No compatible model completed the request.') +
    ' A project-wide Google quota limit cannot be bypassed by switching models. Try a different available Flash model or wait for the quota reset.');
}

async function transcribeGemini(audio, apiKey, outputLanguage = 'en-US') {
  if (!apiKey) throw new Error('No Gemini API key is available for voice transcription. Add one in Admin.');
  if (typeof audio !== 'string' || audio.length > 2_800_000) throw new Error('Voice recording is too large. Please speak a shorter question.');
  const part = audioParts(audio);
  const prompt = outputLanguage === 'bn-BD' ? [
    'Transcribe the spoken question into natural Bangladeshi Bengali, using Bengali script.',
    'For Bangla-English mixed speech, keep the meaning intact and preserve only unavoidable product names, model numbers and standard technical terms in their usual form.',
    'Do not translate the whole question into English. Do not write Bengali using Latin letters.',
    'Recognise Bangladeshi Bengali; do not mistake it for Hindi or Urdu.',
    'Return only one clean question in Bengali. No labels, explanations, quotation marks or commentary. Omit unclear words rather than inventing them.'
  ].join(' ') : [
    'Transcribe the spoken question and return only the final question in natural English.',
    'The speaker may use Bangladeshi Bengali (Bangla), English, or natural Bangla-English code-switching in the same sentence.',
    'Recognise Bengali spoken in Bangladesh; do not mistake Bengali for Hindi or Urdu, and do not write Bengali words in Latin transliteration.',
    'Detect language from the words that were spoken, not the speaker’s accent or pronunciation of English.',
    'If the words are Bengali, translate their meaning faithfully into clear everyday English without adding details.',
    'If the words are English, including English spoken with a Bangladeshi accent, preserve the English meaning and do not translate it.',
    'For mixed Bangla and English, translate only the Bangla portions and preserve English technical words, names, units and model numbers.',
    'Return one clear English question. Do not add explanations, labels, quotation marks, guesses or commentary. Omit unclear words rather than inventing them.'
  ].join(' ');
  const candidates = getTranscriptionModelOrder();
  const attempted = [];
  let lastFailure = '';
  for (const candidate of candidates) {
    attempted.push(candidate);
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(candidate) + ':generateContent';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: part }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0, ...(candidate.includes('flash') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}) }
        }),
        signal: AbortSignal.timeout(35_000)
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const resultCandidate=data?.candidates?.[0]||{};
        const transcript = (resultCandidate?.content?.parts || []).map(item => item.text || '').join('').trim();
        const finishReason=String(resultCandidate.finishReason||'');
        if(finishReason==='MAX_TOKENS'){
          lastFailure=candidate+' reached MAX_TOKENS during transcription; trying another model.';
          continue;
        }
        if(finishReason&&!['STOP','FINISH_REASON_UNSPECIFIED'].includes(finishReason)){
          lastFailure=candidate+' ended transcription with '+finishReason+'.';
          continue;
        }
        if (transcript) return { transcript, model: candidate, attempted, finishReason:finishReason||'unspecified', usage: data.usageMetadata || null };
        lastFailure = candidate + ' returned an empty transcript.';
        continue;
      }
      const message = data?.error?.message || 'Transcription failed.';
      if ([400, 403, 404, 429, 503, 504].includes(response.status)) {
        lastFailure = candidate + ': ' + message;
        continue;
      }
      throw new Error(message.slice(0, 300));
    } catch (error) {
      lastFailure = error.message || 'Audio transcription failed.';
      if (/API key|fetch failed|network/i.test(lastFailure)) throw error;
    }
  }
  throw new Error('Gemini could not transcribe this recording using the low-cost speech model and fallbacks. ' + lastFailure);
}

async function forwardSos(request, env, action) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid SOS request.' }, 400); }
  const ip = request.headers.get('cf-connecting-ip') || 'local-development';
  if (!env.SOS_ROOM || !env.SOS_DIRECTORY) return json({ ok: false, error: 'SOS relay is not configured.' }, 503);

  const directory = env.SOS_DIRECTORY.get(env.SOS_DIRECTORY.idFromName('invitation-directory'));
  if (action === 'invite' || action === 'pair') {
    return directory.fetch(new Request('https://sos-directory.internal/' + action, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, clientIp: ip })
    }));
  }

  const deviceId = String(body.deviceId || '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(deviceId)) return json({ ok: false, error: 'Invalid sender device identity.' }, 400);
  const room = env.SOS_ROOM.get(env.SOS_ROOM.idFromName(deviceId));
  return room.fetch(new Request('https://sos-room.internal/' + action, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }));
}

export async function handleApi(request, env = {}) {
  const url = new URL(request.url);
  const mode = getMode(env);
  const model = String(env.GEMINI_MODEL || 'gemini-3.8-flash');
  if (!url.pathname.startsWith('/api/')) return null;

  const origin = request.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).origin !== url.origin) return json({ error: 'Cross-origin API requests are not allowed.' }, 403); }
    catch { return json({ error: 'Invalid request origin.' }, 403); }
  }

  if(url.pathname.startsWith('/api/rfid/')){
    if(!env.RFID_DIRECTORY)return json({ok:false,error:'RFID relay is not configured.'},503);
    const directory=env.RFID_DIRECTORY.get(env.RFID_DIRECTORY.idFromName('rfid-directory'));
    const medicineDelete=request.method==='DELETE'&&url.pathname.startsWith('/api/rfid/medicines/');
    const userRequired=url.pathname==='/api/rfid/pair/start'||url.pathname==='/api/rfid/devices/provision'||(url.pathname==='/api/rfid/events'&&request.method==='GET')||url.pathname==='/api/rfid/events/ack'||(url.pathname==='/api/rfid/devices'&&request.method==='GET')||(url.pathname==='/api/rfid/medicines'&&(request.method==='GET'||request.method==='POST'))||medicineDelete||(request.method==='DELETE'&&url.pathname.startsWith('/api/rfid/devices/'));
    const user=userRequired?await getAuthenticatedUser(request,env):null;
    if(userRequired&&!user)return json({ok:false,error:'Sign in to manage RFID devices and medicine cards.'},401);
    if(request.method==='GET'&&url.pathname==='/api/rfid/events'){
      return directory.fetch(new Request('https://rfid.internal/event/poll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id})}));
    }
    if(request.method==='GET'&&url.pathname==='/api/rfid/devices'){
      return directory.fetch(new Request('https://rfid.internal/devices/list',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id})}));
    }
    if(request.method==='GET'&&url.pathname==='/api/rfid/medicines'){
      return directory.fetch(new Request('https://rfid.internal/medicines/list',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id})}));
    }
    if(request.method==='POST'&&url.pathname==='/api/rfid/medicines'){
      const body=await request.json().catch(()=>({}));
      return directory.fetch(new Request('https://rfid.internal/medicines/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id,medicine:body})}));
    }
    if(medicineDelete){
      const uid=decodeURIComponent(url.pathname.split('/').pop()||'');
      return directory.fetch(new Request('https://rfid.internal/medicines/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id,uid})}));
    }
    if(request.method==='POST'&&url.pathname==='/api/rfid/devices/provision'){
      return directory.fetch(new Request('https://rfid.internal/devices/provision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id})}));
    }
    if(request.method==='POST'&&url.pathname==='/api/rfid/pair/start'){
      return directory.fetch(new Request('https://rfid.internal/pair/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id})}));
    }
    if(request.method==='POST'&&url.pathname==='/api/rfid/pair/claim'){
      return directory.fetch(new Request('https://rfid.internal/pair/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(await request.json().catch(()=>({}))) }));
    }
    if(request.method==='POST'&&url.pathname==='/api/rfid/events'){
      return directory.fetch(new Request('https://rfid.internal/event/submit',{method:'POST',headers:{'content-type':'application/json','authorization':request.headers.get('authorization')||''},body:JSON.stringify(await request.json().catch(()=>({}))) }));
    }
    if(request.method==='POST'&&url.pathname==='/api/rfid/events/ack'){
      return directory.fetch(new Request('https://rfid.internal/event/ack',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...await request.json().catch(()=>({})),userId:user.id})}));
    }
    if(request.method==='DELETE'&&url.pathname.startsWith('/api/rfid/devices/')){
      const deviceId=url.pathname.split('/').pop();
      return directory.fetch(new Request('https://rfid.internal/devices/revoke',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id,deviceId})}));
    }
    return json({ok:false,error:'RFID route not found.'},404);
  }
  if(url.pathname.startsWith('/api/account/')||url.pathname.startsWith('/api/guest/')) return handleAccountApi(request,env,url);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const apiKey = await providerKey(request, env);
    const supportedMode = mode === 'gemini' || mode === 'mock';
    return json({
      ok: supportedMode,
      mode,
      model: mode === 'gemini' ? model : null,
      apiKeyConfigured: Boolean(apiKey),
      usingPersonalKey: hasPersonalKey(request),
      providerConfigured: mode === 'gemini' && Boolean(apiKey),
      sosRelayConfigured: Boolean(env.SOS_ROOM && env.SOS_DIRECTORY),
      sosPushAvailable: Boolean(env.SOS_ROOM && env.SOS_DIRECTORY),
      mockModeExplicitlyEnabled: mode === 'mock',
      message: !supportedMode
        ? 'Unsupported AI_MODE "' + mode + '". Use "gemini" or explicitly "mock".'
        : mode === 'gemini'
          ? (apiKey ? 'Gemini mode selected; a provider key is available.' : 'Gemini mode selected, but no API key is available.')
          : 'Mock mode explicitly enabled; no live image analysis.'
    }, supportedMode ? 200 : 503);
  }

  const receiverActions = {
    '/api/sos/pair': 'pair',
    '/api/sos/poll': 'poll',
    '/api/sos/ack': 'ack',
    '/api/sos/subscribe': 'subscribe',
    '/api/sos/revoke': 'revoke'
  };
  if (request.method === 'POST' && receiverActions[url.pathname]) {
    return forwardSos(request, env, receiverActions[url.pathname]);
  }

  const sosActions = {
    '/api/sos/invite': 'invite',
    '/api/sos/trigger': 'trigger',
    '/api/sos/push-key': 'push-key'
  };
  if (request.method === 'POST' && sosActions[url.pathname]) {
    return forwardSos(request, env, sosActions[url.pathname]);
  }

  if (request.method === 'GET' && url.pathname === '/api/models') {
    const apiKey = await providerKey(request, env);
    try {
      return json({
        ok: true,
        models: await listGeminiModels(apiKey),
        configuredModel: model,
        usingPersonalKey: hasPersonalKey(request),
        rotationEnabled: true
      });
    } catch (error) {
      return json({ ok: false, error: error.message || 'Could not load models.' }, 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/config') {
    return json({
      aiMode: mode, liveAIEnabled: mode === 'gemini',
      model, responseStyles: Object.keys(RESPONSE_STYLES),
      basePrompt: SCENE_RULES,
      safetyPrompt: SAFETY_CORE,
      availableModes: Object.entries(DEFAULT_MODES).map(([id, m]) => ({ id, label: m.label, usesCamera: m.usesCamera }))
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/transcribe') {
    const apiKey = await providerKey(request, env);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Recording data must be valid JSON.' }, 400); }
    if (typeof body.audio !== 'string' || !/^data:audio\//i.test(body.audio)) return json({ error: 'A recorded audio data URL is required.' }, 400);
    if (body.audio.length > 2_800_000) return json({ error: 'Voice recording is too long. Please speak a shorter question.' }, 413);
    try {
      const result = await transcribeGemini(body.audio, apiKey, Object.hasOwn(RESPONSE_LANGUAGES, body.responseLanguage) ? body.responseLanguage : 'en-US');
      if(body.saveToHistory===true){
        const user=await getAuthenticatedUser(request,env);
        if(user)await storeAccountUsage(env,user,request,{model:result.model,requestType:'transcribe',usage:result.usage,imageSizeBytes:null});
      }
      return json({ ok: true, transcript: result.transcript, model: result.model, attemptedModels: result.attempted, usageMetadata:result.usage||null, outputLanguage: Object.hasOwn(RESPONSE_LANGUAGES, body.responseLanguage) ? body.responseLanguage : 'en-US' });
    } catch (error) {
      return json({ error: error.message || 'Voice transcription failed.' }, 502);
    }
  }

  // Cloud voice for devices without a Bengali system voice (Windows/desktop Chrome). Gemini TTS speaks Bangla and English.
  if (request.method === 'POST' && url.pathname === '/api/speech') {
    const apiKey = await providerKey(request, env);
    if (!apiKey) return json({ error: 'Gemini API key is not configured.' }, 503);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 3500) : '';
    if (!text) return json({ error: 'Text to speak is required.' }, 400);
    const voice = /^[A-Za-z]{2,24}$/.test(body.voice || '') ? body.voice : 'Kore';
    // Send only the words: style/language instructions in the prompt were sometimes read aloud.
    try { return await speakGemini(text, voice, text, apiKey); }
    catch (error) { return json({ error: error.message || 'Gemini voice request failed.' }, 502); }
  }

  if (request.method === 'POST' && ['/api/describe', '/api/ask'].includes(url.pathname)) {
    const apiKey = await providerKey(request, env);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const invalid = validPayload(body);
    if (invalid) return json({ error: invalid }, 400);
    const action = url.pathname.endsWith('/ask') ? 'ask' : 'describe';
    if (!body.image) return json({ error: 'A camera image is required for this endpoint.' }, 400);
    if (action === 'ask' && !body.question?.trim()) return json({ error: 'Please provide a question.' }, 400);
    if (mode !== 'gemini' && mode !== 'mock') return json({ error: 'Unsupported AI_MODE "' + mode + '".' }, 503);
    const selectedModel = String(body.model || model).replace(/^models\//, '');
    const waitSeconds = body.waitSeconds || 120;
    const prompt = buildPrompt({
      mode: action,
      question: body.question || '',
      systemPrompt: body.systemPrompt || '',
      customPrompt: body.customPrompt || '',
      responseStyle: body.responseStyle || 'concise',
      responseLanguage: body.responseLanguage || 'en-US'
    });
    if (mode === 'gemini') {
      const saveRequested=body.saveToHistory!==false;
      const user=saveRequested?await getAuthenticatedUser(request,env):null;
      const historyDraft=saveRequested
        ?await createPhotoHistoryDraft(env,user,request,body,prompt,selectedModel,action)
        :{saved:false,message:'Photo history is switched off.'};
      try {
        const result = await askGemini({ image: body.image, prompt, model: selectedModel, waitSeconds }, apiKey);
        if(user) await storeAccountUsage(env,user,request,{
          model:result.model,requestType:action,
          usage:result.usage,imageSizeBytes:dataUrlByteLength(body.image)
        });
        const history=await completePhotoHistory(env,historyDraft,result,null);
        return json({
          ok:true,mock:false,provider:'Gemini',
          model:result.model,attemptedModels:result.attempted,
          finishReason:result.finishReason,usageMetadata:result.usage||null,
          historySaved:Boolean(history.saved),historyMessage:saveRequested?history.message:null,
          historyId:history.id||null,answer:result.answer
        });
      } catch(error) {
        const failedHistory=await completePhotoHistory(env,historyDraft,null,error);
        return json({
          error:error.message||'Gemini request failed.',
          historySaved:Boolean(failedHistory.saved),
          historyMessage:saveRequested?failedHistory.message:null,
          historyId:failedHistory.id||null
        },502);
      }
    }
    return json({
      ok: true, mock: true,
      answer: action === 'ask'
        ? 'Mock mode: I received your question: "' + body.question.trim() + '". No image analysis was performed.'
        : 'Mock mode is explicitly enabled. No objects or hazards were identified.',
      receivedImage: Boolean(body.image),
      disclaimer: 'SIMULATED RESPONSE — do not use this output to make mobility or safety decisions.'
    });
  }
  if (url.pathname.startsWith('/api/')) return json({ error: 'API route not found.' }, 404);
  return null;
}

export async function purgeExpiredGuestHistory(env,now=Date.now()) {
  if(!supabaseConfigured(env))return {skipped:true,deleted:0};
  const cutoff=new Date(now-30*24*60*60*1000).toISOString();
  let offset=0,removedRows=0;
  while(true){
    const query='ai_history?select=id,photo_path&guest_session_hash=not.is.null&created_at=lt.'+encodeURIComponent(cutoff)+'&order=created_at.asc&limit=200&offset='+offset;
    const response=await supabaseRest(env,query);
    if(!response.ok)throw new Error('Could not list expired guest-history records.');
    const rows=await response.json().catch(()=>[]);
    for(const row of rows){
      if(row.photo_path){
        const deleted=await fetch(supabaseBase(env)+'/storage/v1/object/daredevil-history/'+row.photo_path,{
          method:'DELETE',headers:supabaseServiceHeaders(env)
        });
        if(!deleted.ok&&deleted.status!==404)throw new Error('Could not remove an expired guest photo; its history row was kept.');
      }
    }
    offset+=rows.length;
    if(rows.length<200)break;
  }
  const deleted=await supabaseRest(env,'ai_history?guest_session_hash=not.is.null&created_at=lt.'+encodeURIComponent(cutoff),{method:'DELETE'});
  if(!deleted.ok)throw new Error('Could not delete expired guest-history metadata.');
  return {skipped:false,deleted:'expired_guest_history'};
}

export default {
  async scheduled(controller,env) {
    await purgeExpiredGuestHistory(env,controller?.scheduledTime||Date.now());
  },
  async fetch(request, env) {
    const api = await handleApi(request, env);
    if (api) return api;

    // Resolve the app entry pages explicitly before the SPA fallback. This keeps
    // /blind/ and /action/ bound to their own HTML and script references.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const url = new URL(request.url);
      const page = url.pathname.replace(/\/+$/, '');
      if (page === '/blind' || page === '/action') {
        url.pathname = page + '/index.html';
        const asset = await env.ASSETS.fetch(new Request(url, request));
        const headers = new Headers(asset.headers);
        headers.set('cache-control', 'no-store');
        return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
