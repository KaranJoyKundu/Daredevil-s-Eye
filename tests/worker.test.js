import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleApi,rankVisionModels,getTranscriptionModelOrder} from '../worker/src/index.js';
import {SOSRoom} from '../worker/src/sos-room.js';
import {detectSpokenLanguage,selectVoiceForText,resolveSpeechLanguage,cleanTextForSpeech,splitSpeechText} from '../web/shared/speech.js';
import {createShakeSequenceTracker,getShakeMagnitude,matchSosVoiceCommand} from '../web/shared/sos-triggers.js';

const req=(path,body,headers={})=>new Request('https://local.test'+path,{
 method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)
});
const get=(path,headers={})=>new Request('https://local.test'+path,{headers});
const health=()=>new Request('https://local.test/api/health');
const image='data:image/jpeg;base64,AAAA';

test('Blind mode keeps Help outside the four main action buttons and declares phone shortcuts',()=>{
 const html=readFileSync(new URL('../web/blind/index.html',import.meta.url),'utf8');
 const mainStart=html.indexOf('<main');
 const mainEnd=html.indexOf('</main>',mainStart);
 assert.ok(mainStart>=0&&mainEnd>mainStart,'Blind mode main action grid exists');
 const main=html.slice(mainStart,mainEnd);
 for(const action of ['describe','ask','sos','repeat']) assert.ok(main.includes('data-action="'+action+'"'));
 assert.ok(!main.includes('data-action="help"'),'Spoken Help is outside the four-action grid');
 const helpAction=html.indexOf('data-action="help"');
 assert.ok(helpAction>mainEnd,'Spoken Help follows the main action grid');
 const manifest=JSON.parse(readFileSync(new URL('../web/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.start_url,'/blind/');
 assert.deepEqual(manifest.shortcuts.map(item=>item.url),[
  '/blind/?action=describe','/blind/?action=ask','/blind/?action=sos'
 ]);
});

test('blind-mode action colours meet 4.5:1 white-text contrast target',()=>{
 const css=readFileSync(new URL('../web/shared/style.css',import.meta.url),'utf8');
 const backgrounds=[['blind-describe','#07509b'],['blind-ask','#00665f'],['blind-sos','#8a3700'],['blind-repeat','#4b3292'],['blind-help-button','#132b45']];
 const linear=value=>{const channel=value/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;};
 const luminance=hex=>.2126*linear(parseInt(hex.slice(1,3),16))+.7152*linear(parseInt(hex.slice(3,5),16))+.0722*linear(parseInt(hex.slice(5,7),16));
 for(const [selector,background] of backgrounds){
  assert.ok(css.includes(background),selector+' background remains defined');
  const ratio=1.05/(luminance(background)+0.05);
  assert.ok(ratio>=4.5,selector+' white-text contrast '+ratio.toFixed(2));
 }
});

test('three-shake SOS requires three strong, separated peaks inside the detection window',()=>{
 const tracker=createShakeSequenceTracker();
 assert.equal(tracker.push(4,1000),false);
 assert.equal(tracker.push(15,1100),false);
 assert.equal(tracker.push(15,1500),false);
 assert.equal(tracker.push(15,1900),true);
 assert.equal(tracker.count,0);
});
test('shake detector rejects closely spaced repeated peaks and stale sequences',()=>{
 const tracker=createShakeSequenceTracker();
 assert.equal(tracker.push(15,1000),false);
 assert.equal(tracker.push(15,1200),false);
 assert.equal(tracker.push(15,1500),false);
 assert.equal(tracker.push(15,5000),false);
 assert.equal(tracker.push(15,5400),false);
 assert.equal(tracker.count,2);
});
test('shake magnitude supports linear acceleration and gravity-inclusive fallback',()=>{
 assert.equal(getShakeMagnitude({acceleration:{x:3,y:4,z:0}}),5);
 assert.ok(Math.abs(getShakeMagnitude({accelerationIncludingGravity:{x:0,y:0,z:22.31}})-12.5)<0.02);
 assert.equal(getShakeMagnitude({}),0);
});
test('voice SOS requires a distinctive wake phrase and a separate confirmation',()=>{
 assert.equal(matchSosVoiceCommand('SOS'),null);
 assert.equal(matchSosVoiceCommand('Daredevil SOS'),'wake');
 assert.equal(matchSosVoiceCommand('ডেয়ারডেভিল এসওএস'),'wake');
 assert.equal(matchSosVoiceCommand('Confirm SOS','confirm'),'confirm');
 assert.equal(matchSosVoiceCommand('এসওএস পাঠান','confirm'),'confirm');
 assert.equal(matchSosVoiceCommand('confirm SOS'),null);
});
test('voice SOS cancellation is recognised in both languages and cannot confirm',()=>{
 assert.equal(matchSosVoiceCommand('Cancel SOS','cancel'),'cancel');
 assert.equal(matchSosVoiceCommand('এসওএস বাতিল','cancel'),'cancel');
 assert.equal(matchSosVoiceCommand('Daredevil SOS','cancel'),null);
});

test('health is public and reports provider configuration without exposing secrets',async()=>{
 const r=await handleApi(health(),{GEMINI_API_KEY:'test-secret',SOS_ROOM:{},SOS_DIRECTORY:{}});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.apiKeyConfigured,true);
 assert.equal(d.providerConfigured,true);
 assert.equal(d.sosRelayConfigured,true);
 assert.equal(JSON.stringify(d).includes('test-secret'),false);
});
test('health defaults to Gemini and does not require an app access token or Cloudflare rate limit bindings',async()=>{
 const r=await handleApi(health(),{});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.ok,true);
 assert.equal(d.apiKeyConfigured,false);
 assert.equal(d.providerConfigured,false);
 assert.equal('appAccessConfigured' in d,false);
 assert.equal('rateLimitsConfigured' in d,false);
});
test('health identifies explicit mock mode',async()=>{
 const r=await handleApi(health(),{AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(d.ok,true);
 assert.equal(d.mode,'mock');
 assert.equal(d.providerConfigured,false);
 assert.equal(d.mockModeExplicitlyEnabled,true);
});
test('config is public and does not require a bearer token',async()=>{
 const r=await handleApi(get('/api/config'),{});
 const d=await r.json();
 assert.equal(r.status,200);
 assert.ok(d.basePrompt.length>30);
 assert.ok(d.responseStyles.includes('concise'));
 assert.equal(d.model,'gemini-3.8-flash');
});
test('cross-origin API requests are rejected',async()=>{
 const r=await handleApi(get('/api/config',{origin:'https://evil.example'}),{});
 assert.equal(r.status,403);
});
test('model list fails clearly if API key is missing',async()=>{
 const r=await handleApi(get('/api/models'),{});
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/API key is not configured/);
});
test('describe with missing Gemini key never produces a fake mock description',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{});
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/no API key is available/i);
});
test('explicit mock response is clearly simulated with public API access',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(r.status,200);
 assert.equal(d.mock,true);
 assert.match(d.disclaimer,/SIMULATED/);
 assert.match(d.answer,/No objects or hazards were identified/);
});
test('unknown AI mode fails closed',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{AI_MODE:'local'});
 assert.equal(r.status,503);
});
test('ask requires a question',async()=>{
 const r=await handleApi(req('/api/ask',{image}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported image data URLs',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/gif;base64,AAAA'}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects oversized encoded images',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/jpeg;base64,'+'A'.repeat(5500001)}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects invalid model identifiers',async()=>{
 const r=await handleApi(req('/api/describe',{image,model:'../../admin'}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('public API does not apply a server model allowlist',async()=>{
 const r=await handleApi(req('/api/describe',{image,model:'gemini-3.8-pro'}),{AI_MODE:'mock'});
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.mock,true);
});
test('rejects invalid wait limits',async()=>{
 const r=await handleApi(req('/api/describe',{image,waitSeconds:181}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported response styles',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseStyle:'ramble'}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported response languages',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseLanguage:'xx-XX'}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('Bangla response language is accepted by Worker validation',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseLanguage:'bn-BD'}),{AI_MODE:'mock'});
 assert.equal(r.status,200);
});
test('custom prompt is capped at 1000 characters',async()=>{
 const r=await handleApi(req('/api/describe',{image,customPrompt:'x'.repeat(1001)}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('camera routes require an image',async()=>{
 const r=await handleApi(req('/api/describe',{}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('SOS endpoints do not require Cloudflare rate-limit bindings but still require the relay',async()=>{
 const r=await handleApi(req('/api/sos/invite',{deviceId:'0123456789abcdef0123456789abcdef'}),{});
 const d=await r.json();
 assert.equal(r.status,503);
 assert.match(d.error,/SOS relay is not configured/);
});

test('personal Gemini key header is recognised but never echoed by health',async()=>{
 const r=await handleApi(get('/api/health',{'x-user-gemini-api-key':'user-secret-key'}),{});
 const d=await r.json();
 assert.equal(d.apiKeyConfigured,true);
 assert.equal(d.usingPersonalKey,true);
 assert.equal(JSON.stringify(d).includes('user-secret-key'),false);
});
test('vision models prefer stable Flash alternatives in the automatic free-tier path',()=>{
 const ranked=rankVisionModels([
  {id:'gemini-3.1-flash-lite',name:'Flash Lite'},
  {id:'gemini-3.8-flash',name:'Flash'},
  {id:'gemini-3.1-pro-preview',name:'Pro Preview'},
  {id:'gemini-3.7-flash',name:'Flash 3.7'}
 ]);
 assert.deepEqual(ranked.map(item=>item.id),[
  'gemini-3.8-flash','gemini-3.7-flash','gemini-3.1-flash-lite','gemini-3.1-pro-preview'
 ]);
 assert.deepEqual(ranked.map(item=>item.rank),[1,2,3,4]);
});
test('transcription endpoint rejects a missing audio data URL',async()=>{
 const r=await handleApi(req('/api/transcribe',{audio:'not-audio'}),{});
 const d=await r.json();
 assert.equal(r.status,400);
 assert.match(d.error,/audio data URL/i);
});
test('Gemini transcription prompt explicitly supports Bangladeshi Bangla and mixed speech',async t=>{
 const originalFetch=globalThis.fetch;let requestBody;
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async (input,options)=>{
  requestBody=JSON.parse(options.body);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Where is my phone?'}]}}]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const r=await handleApi(req('/api/transcribe',{audio:'data:audio/webm;base64,AAAA'}),{GEMINI_API_KEY:'test-transcription-key'});
 const data=await r.json();
 assert.equal(r.status,200);
 assert.equal(data.transcript,'Where is my phone?');
 const prompt=requestBody.contents[0].parts[0].text;
 assert.match(prompt,/Bangladeshi Bengali/);
 assert.match(prompt,/Bangla-English code-switching/);
 assert.match(prompt,/do not mistake Bengali for Hindi or Urdu/);
 assert.match(prompt,/translate only the Bangla portions/);
});

test('transcription endpoint reports missing provider key without storing audio',async()=>{
 const r=await handleApi(req('/api/transcribe',{audio:'data:audio/webm;base64,AAAA'}),{});
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/No Gemini API key is available/i);
});

test('spoken language detection uses script content rather than the speaker accent',()=>{
 assert.equal(detectSpokenLanguage('আমি কোথায় যাব?'),'bn-BD');
 assert.equal(detectSpokenLanguage('Where should I go?'),'en-US');
 assert.equal(detectSpokenLanguage('A Bangladeshi accent speaking English'),'en-US');
});

test('Bengali text selects a Bengali device voice even when an English voice was saved',()=>{
 const voices=[
  {voiceURI:'english-default',lang:'en-US',default:true},
  {voiceURI:'bengali',lang:'bn-BD',default:false}
 ];
 assert.equal(selectVoiceForText(voices,{lang:'en-US',voiceURI:'english-default',text:'আমার ফোন কোথায়?'}).voiceURI,'bengali');
 assert.equal(selectVoiceForText(voices,{lang:'en-US',voiceURI:'english-default',text:'Where is my phone?'}).voiceURI,'english-default');
 assert.equal(selectVoiceForText(voices.slice(0,1),{lang:'bn-BD',text:'বাংলা উত্তর'}),null);
});

test('voice transcription alternates its two low-cost first-choice models before higher-cost fallbacks',()=>{
 const first=getTranscriptionModelOrder();
 const second=getTranscriptionModelOrder();
 const third=getTranscriptionModelOrder();
 const lowCost=new Set(['gemini-3.1-flash-lite','gemini-3.5-flash-lite']);
 assert.ok(lowCost.has(first[0]));
 assert.ok(lowCost.has(second[0]));
 assert.notEqual(first[0],second[0]);
 assert.equal(third[0],first[0]);
 for(const order of [first,second,third]){
  assert.deepEqual(new Set(order.slice(0,2)),lowCost);
  assert.deepEqual(order.slice(2),['gemini-3.8-flash','gemini-3.5-transcribe']);
 }
});

test('vision fallback tries the next ranked model after a model-specific 429',async t=>{
 const originalFetch=globalThis.fetch;
 const attempts=[];
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/v1beta/models')){
   return new Response(JSON.stringify({models:[
    {name:'models/gemini-3.1-pro-preview',displayName:'Gemini Pro Preview',supportedGenerationMethods:['generateContent']},
    {name:'models/gemini-3.8-flash',displayName:'Gemini Flash',supportedGenerationMethods:['generateContent']},
    {name:'models/gemini-3.1-flash-lite',displayName:'Gemini Flash Lite',supportedGenerationMethods:['generateContent']}
   ]}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.pathname.includes(':generateContent')){
   const model=decodeURIComponent(url.pathname.split('/models/')[1].split(':')[0]);
   attempts.push(model);
   if(model==='gemini-3.8-flash'){
    return new Response(JSON.stringify({error:{message:'model-specific quota exceeded'}}),{status:429,headers:{'content-type':'application/json'}});
   }
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'A clear test answer.'}]}}]}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error('Unexpected mocked fetch URL: '+url.href);
 };
 const r=await handleApi(req('/api/describe',{image,model:'gemini-3.8-flash'}),{GEMINI_API_KEY:'test-key-for-vision-fallback'});
 const d=await r.json();
 assert.equal(r.status,200);
 assert.equal(d.answer,'A clear test answer.');
 assert.equal(d.model,'gemini-3.1-flash-lite');
 assert.deepEqual(attempts,['gemini-3.8-flash','gemini-3.1-flash-lite']);
});


test('full Bangla mode keeps app prompts on Bengali even when the prompt contains no Bengali characters',()=>{
 assert.equal(resolveSpeechLanguage('Taking several photos. Hold still.','bn-BD'),'bn-BD');
 assert.equal(resolveSpeechLanguage('Speak Bangla, English or both.','bn-BD'),'bn-BD');
 assert.equal(resolveSpeechLanguage('বাংলায় উত্তর','en-US'),'bn-BD');
 assert.equal(resolveSpeechLanguage('Where is the door?','en-US'),'en-US');
});

test('Action photo flow has separate camera and upload inputs plus a confirmation gate',()=>{
 const html=readFileSync(new URL('../web/action/index.html',import.meta.url),'utf8');
 const admin=readFileSync(new URL('../web/admin/index.html',import.meta.url),'utf8');
 const settings=readFileSync(new URL('../web/shared/settings.js',import.meta.url),'utf8');
 const camera=readFileSync(new URL('../web/shared/camera.js',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../web/shared/site-nav.js',import.meta.url),'utf8');
 assert.match(html,/id="phone-photo-camera"[^>]*capture="environment"/);
 assert.match(html,/id="phone-photo-upload"[^>]*hidden/);
 assert.match(html,/id="photo-preview-panel"/);
 assert.match(html,/id="photo-ask-ai"/);
 assert.match(admin,/id="require-photo-confirmation"[^>]*checked/);
 assert.match(settings,/requirePhotoConfirmation: true/);
 assert.match(camera,/compressImageToJpeg/);
 assert.match(camera,/maxBytes=3_800_000/);
 assert.match(camera,/void playShutterClick\(\)/);
 assert.match(nav,/addEventListener\('pointerdown'/);
});

test('Gemini MAX_TOKENS output is retried with a larger budget and never returned as complete',async t=>{
 const originalFetch=globalThis.fetch;
 const calls=[];
 let firstModel='';
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/v1beta/models')){
   return new Response(JSON.stringify({models:[
    {name:'models/gemini-3.8-flash',displayName:'Gemini Flash',supportedGenerationMethods:['generateContent']},
    {name:'models/gemini-3.7-flash',displayName:'Gemini Flash 3.7',supportedGenerationMethods:['generateContent']},
    {name:'models/gemini-3.6-flash',displayName:'Gemini Flash 3.6',supportedGenerationMethods:['generateContent']},
    {name:'models/gemini-3.1-pro-preview',displayName:'Gemini Pro Preview',supportedGenerationMethods:['generateContent']},
    {name:'models/gemini-3.5-flash',displayName:'Gemini Flash 3.5',supportedGenerationMethods:['generateContent']}
   ]}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.pathname.includes(':generateContent')){
   const model=decodeURIComponent(url.pathname.split('/models/')[1].split(':')[0]);
   const body=JSON.parse(init.body);
   calls.push({model,tokens:body.generationConfig.maxOutputTokens});
   if(!firstModel)firstModel=model;
   if(model===firstModel){
    return new Response(JSON.stringify({candidates:[{
     content:{parts:[{text:'This is a deliberately incomplete sentence…'}]},
     finishReason:'MAX_TOKENS'
    }]}),{status:200,headers:{'content-type':'application/json'}});
   }
   return new Response(JSON.stringify({candidates:[{
    content:{parts:[{text:'The complete answer is from the fallback model.'}]},
    finishReason:'STOP'
   }]}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error('Unexpected mocked fetch URL: '+url.href);
 };
 const r=await handleApi(req('/api/describe',{image,model:'gemini-3.6-flash'}),{GEMINI_API_KEY:'test-key-for-truncation-fallback'});
 const data=await r.json();
 assert.equal(r.status,200);
 assert.equal(data.answer,'The complete answer is from the fallback model.');
 assert.notEqual(data.model,firstModel);
 assert.notEqual(calls[0].model,'gemini-3.6-flash');
 assert.deepEqual(calls.filter(call=>call.model===firstModel).map(call=>call.tokens),[4096,8192]);
 assert.ok(!calls.some(call=>call.model==='gemini-3.6-flash'));
 assert.ok(!calls.some(call=>call.model==='gemini-3.1-pro-preview'),'automatic retries must never switch to Pro');
 assert.equal(data.attemptedModels.includes(firstModel),true);
});

test('Bangla transcription returns Bengali script instead of translating the full question to English',async t=>{
 const originalFetch=globalThis.fetch;
 let prompt='';
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  assert.ok(url.pathname.includes(':generateContent'));
  const body=JSON.parse(init.body);
  prompt=body.contents[0].parts[0].text;
  return new Response(JSON.stringify({candidates:[{
   content:{parts:[{text:'দরজাটি কোথায়?'}]},
   finishReason:'STOP'
  }]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const r=await handleApi(req('/api/transcribe',{
  audio:'data:audio/webm;base64,AAAA',
  responseLanguage:'bn-BD'
 }),{GEMINI_API_KEY:'test-key-for-bangla-transcription'});
 const data=await r.json();
 assert.equal(r.status,200);
 assert.equal(data.transcript,'দরজাটি কোথায়?');
 assert.equal(data.outputLanguage,'bn-BD');
 assert.match(prompt,/natural Bangladeshi Bengali/);
 assert.match(prompt,/Do not translate the whole question into English/);
});


test('SOS receiver gets a persistent VAPID key and subscription, and trigger submits a push notification',async t=>{
 const originalFetch=globalThis.fetch;
 const pushRequests=[];
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(input,init={})=>{
  pushRequests.push({url:String(input),headers:init.headers||{},body:init.body});
  return new Response('',{status:201});
 };
 const receiverPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const publicBytes=new Uint8Array(await crypto.subtle.exportKey('raw',receiverPair.publicKey));
 const authBytes=crypto.getRandomValues(new Uint8Array(16));
 const values=new Map();
 const state={storage:{
  get:async key=>values.get(key),
  put:async(key,value)=>values.set(key,value),
  delete:async key=>values.delete(key),
  setAlarm:async time=>{values.set('alarmAt',time);}
 }};
 const room=new SOSRoom(state);
 const post=async(action,body={})=>room.fetch(new Request('https://sos.internal/'+action,{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
 }));
 const pushKeyResponse=await (await post('push-key')).json();
 assert.equal(pushKeyResponse.ok,true);
 assert.equal(pushKeyResponse.applicationServerKey.length,87);
 const paired=await (await post('pair')).json();
 assert.equal(paired.paired,true);
 const subscription=await (await post('subscribe',{
  receiverToken:paired.receiverToken,
  subscription:{
   endpoint:'https://fcm.googleapis.com/fcm/send/123',
   expirationTime:null,
   keys:{p256dh:Buffer.from(publicBytes).toString('base64url'),auth:Buffer.from(authBytes).toString('base64url')}
  }
 })).json();
 assert.equal(subscription.pushSubscribed,true);
 const triggered=await (await post('trigger')).json();
 assert.equal(triggered.queued,true);
 assert.equal(triggered.notificationAttempted,true);
 assert.equal(triggered.notificationAccepted,true);
 assert.equal(pushRequests.length,1);
 assert.match(pushRequests[0].headers.Authorization,/^vapid t=/);
 assert.equal(pushRequests[0].headers.TTL,'120');
 assert.equal(pushRequests[0].headers['Content-Encoding'],'aes128gcm');
 assert.ok(pushRequests[0].body instanceof Uint8Array);
 const encryptedBody=new Uint8Array(pushRequests[0].body);
 assert.ok(encryptedBody.byteLength>86);
 const salt=encryptedBody.slice(0,16);
 assert.deepEqual(Array.from(encryptedBody.slice(16,20)),[0,0,16,0]);
 const keyLength=encryptedBody[20];
 assert.equal(keyLength,65);
 const senderPublicBytes=encryptedBody.slice(21,21+keyLength);
 const ciphertext=encryptedBody.slice(21+keyLength);
 const senderPublicKey=await crypto.subtle.importKey('raw',senderPublicBytes,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const sharedSecret=await crypto.subtle.deriveBits({name:'ECDH',public:senderPublicKey},receiverPair.privateKey,256);
 const hmac=async(keyBytes,dataBytes)=>{
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,dataBytes));
 };
 const hkdfExpand=async(prk,info,length)=>{
  let previous=new Uint8Array(0),output=new Uint8Array(0),counter=1;
  while(output.length<length){
   previous=await hmac(prk,new Uint8Array([...previous,...info,counter]));
   output=new Uint8Array([...output,...previous]);counter++;
  }
  return output.slice(0,length);
 };
 const encoder=new TextEncoder();
 const keyInfo=new Uint8Array([
  ...encoder.encode('WebPush: info'),0,...publicBytes,...senderPublicBytes
 ]);
 const authPrk=await hmac(authBytes,new Uint8Array(sharedSecret));
 const inputKeyingMaterial=await hkdfExpand(authPrk,keyInfo,32);
 const contentPrk=await hmac(salt,inputKeyingMaterial);
 const contentKey=await hkdfExpand(contentPrk,new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm'),0]),16);
 const nonce=await hkdfExpand(contentPrk,new Uint8Array([...encoder.encode('Content-Encoding: nonce'),0]),12);
 const aesKey=await crypto.subtle.importKey('raw',contentKey,{name:'AES-GCM'},false,['decrypt']);
 const plaintext=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce,tagLength:128},aesKey,ciphertext));
 assert.equal(plaintext[plaintext.length-1],2);
 assert.match(new TextDecoder().decode(plaintext.slice(0,-1)),/SOS alert may need your attention/);
});

test('re-pairing clears the previous receiver push subscription',async()=>{
 const receiverPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const publicBytes=new Uint8Array(await crypto.subtle.exportKey('raw',receiverPair.publicKey));
 const authBytes=crypto.getRandomValues(new Uint8Array(16));
 const values=new Map();
 const state={storage:{
  get:async key=>values.get(key),
  put:async(key,value)=>values.set(key,value),
  delete:async key=>values.delete(key),
  setAlarm:async()=>{}
 }};
 const room=new SOSRoom(state);
 const post=async(action,body={})=>room.fetch(new Request('https://sos.internal/'+action,{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
 }));
 const first=await (await post('pair')).json();
 await post('subscribe',{receiverToken:first.receiverToken,subscription:{
  endpoint:'https://fcm.googleapis.com/fcm/send/old',keys:{p256dh:Buffer.from(publicBytes).toString('base64url'),auth:Buffer.from(authBytes).toString('base64url')}
 }});
 assert.ok(await state.storage.get('pushSubscription'));
 await post('pair');
 assert.equal(await state.storage.get('pushSubscription'),undefined);
});

test('receiver notification service worker requests a visible high-priority SOS notification',()=>{
 const worker=readFileSync(new URL('../web/sw.js',import.meta.url),'utf8');
 const receiver=readFileSync(new URL('../web/sos-receiver/receiver.js',import.meta.url),'utf8');
 assert.match(worker,/showNotification/);
 assert.match(worker,/requireInteraction:true/);
 assert.match(worker,/notificationclick/);
 assert.match(receiver,/pushManager\.subscribe/);
 assert.match(receiver,/localStorage\.setItem\(TOKEN_KEY/);
});


test('speech text cleanup removes markdown links, code and raw URLs before speaking',()=>{
 const cleaned=cleanTextForSpeech('**Door** [entrance](https://example.test/path) and https://example.test/raw `GPIO 18`');
 assert.equal(cleaned,'Door entrance and GPIO 18');
});

test('long AI answers are split into sequential speech-sized chunks without losing words',()=>{
 const sentence=Array.from({length:170},(_,index)=>'word'+index).join(' ');
 const chunks=splitSpeechText(sentence,120);
 assert.ok(chunks.length>1);
 assert.ok(chunks.every(chunk=>chunk.length<=120));
 assert.equal(chunks.join(' '),sentence);
});


test('SOS receiver refuses private, local and untrusted push endpoints',async()=>{
 const values=new Map();
 const state={storage:{
  get:async key=>values.get(key),
  put:async(key,value)=>values.set(key,value),
  delete:async key=>values.delete(key),
  setAlarm:async()=>{}
 }};
 const room=new SOSRoom(state);
 const paired=await (await room.fetch(new Request('https://sos.internal/pair',{
  method:'POST',headers:{'content-type':'application/json'},body:'{}'
 }))).json();
 const request=endpoint=>room.fetch(new Request('https://sos.internal/subscribe',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({receiverToken:paired.receiverToken,subscription:{
   endpoint,keys:{p256dh:'not-a-real-key',auth:'not-a-real-key'}
  }})
 }));
 for(const endpoint of [
  'http://127.0.0.1/admin',
  'https://localhost/internal',
  'https://169.254.169.254/latest/meta-data',
  'https://untrusted.example.test/push'
 ]){
  const response=await request(endpoint);
  assert.equal(response.status,400);
 }
 assert.equal(await state.storage.get('pushSubscription'),undefined);
});


test('account-saved Gemini API keys are encrypted at rest and reused only inside the Worker',async t=>{
 const originalFetch=globalThis.fetch;
 let keyRow=null,providerKeySeen='';
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  if(url.origin==='https://supabase.example.test'&&url.pathname==='/auth/v1/user'){
   return new Response(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.origin==='https://supabase.example.test'&&url.pathname==='/rest/v1/user_api_keys'){
   if(init.method==='POST'){keyRow=JSON.parse(init.body);return new Response(null,{status:201});}
   return new Response(JSON.stringify(keyRow?[keyRow]:[]),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.origin==='https://generativelanguage.googleapis.com'&&url.pathname==='/v1beta/models'){
   return new Response(JSON.stringify({models:[
    {name:'models/gemini-3.8-flash',displayName:'Gemini 3.8 Flash',supportedGenerationMethods:['generateContent']},
    {name:'models/gemini-3.7-flash',displayName:'Gemini 3.7 Flash',supportedGenerationMethods:['generateContent']}
   ]}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.origin==='https://generativelanguage.googleapis.com'&&url.pathname.endsWith(':generateContent')){
   providerKeySeen=init.headers['x-goog-api-key'];
   return new Response(JSON.stringify({candidates:[{
    content:{parts:[{text:'The saved account key worked.'}]},finishReason:'STOP'
   }]}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error('Unexpected test fetch: '+url.href);
 };
 const env={
  SUPABASE_URL:'https://supabase.example.test',
  SUPABASE_ANON_KEY:'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY:'test-service-role-key',
  API_KEY_ENCRYPTION_KEY:'test-encryption-secret-with-more-than-thirty-two-bytes'
 };
 const apiKey='AIzaSy-test-personal-gemini-key-for-account-storage';
 const save=await handleApi(req('/api/account/api-key',{apiKey},{
  Origin:'https://local.test',Cookie:'de_access=valid-access-token'
 }),env);
 const savedData=await save.json();
 assert.equal(save.status,200);
 assert.equal(savedData.configured,true);
 assert.ok(keyRow?.key_ciphertext);
 assert.ok(keyRow?.key_iv);
 assert.notEqual(keyRow.key_ciphertext,apiKey);
 assert.equal(JSON.stringify(keyRow).includes(apiKey),false);
 assert.equal(JSON.stringify(savedData).includes(apiKey),false);

 const analysis=await handleApi(req('/api/describe',{
  image,model:'gemini-3.8-flash',responseStyle:'concise'
 },{
  Origin:'https://local.test',Cookie:'de_access=valid-access-token'
 }),env);
 const answer=await analysis.json();
 assert.equal(analysis.status,200);
 assert.equal(answer.answer,'The saved account key worked.');
 assert.equal(providerKeySeen,apiKey);
});

test('opted-in AI history stores private JPEG, answer, prompt, model, token counts and pseudonymous IP',async t=>{
 const originalFetch=globalThis.fetch;
 const usageRows=[],historyRows=[],uploaded=[];
 let providerKeySeen='';
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  if(url.origin==='https://supabase.example.test'&&url.pathname==='/auth/v1/user'){
   return new Response(JSON.stringify({id:'22222222-2222-4222-8222-222222222222',email:'owner@example.test'}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.origin==='https://supabase.example.test'&&url.pathname.startsWith('/rest/v1/api_usage')){
   if(init.method==='POST')usageRows.push(JSON.parse(init.body));
   return new Response(null,{status:204});
  }
  if(url.origin==='https://supabase.example.test'&&url.pathname.startsWith('/rest/v1/ai_history')){
   if(init.method==='POST')historyRows.push(JSON.parse(init.body));
   return new Response(null,{status:201});
  }
  if(url.origin==='https://supabase.example.test'&&url.pathname.startsWith('/storage/v1/object/daredevil-history/')){
   if(init.method==='POST')uploaded.push({url:url.href,type:init.headers['content-type'],bytes:init.body});
   return new Response(null,{status:200});
  }
  if(url.origin==='https://generativelanguage.googleapis.com'&&url.pathname==='/v1beta/models'){
   return new Response(JSON.stringify({models:[
    {name:'models/gemini-3.8-flash',displayName:'Gemini 3.8 Flash',supportedGenerationMethods:['generateContent']}
   ]}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.origin==='https://generativelanguage.googleapis.com'&&url.pathname.endsWith(':generateContent')){
   providerKeySeen=init.headers['x-goog-api-key'];
   return new Response(JSON.stringify({candidates:[{
    content:{parts:[{text:'A clear doorway is visible.'}]},finishReason:'STOP'
   }],usageMetadata:{promptTokenCount:100,candidatesTokenCount:24,totalTokenCount:124}}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error('Unexpected test fetch: '+url.href);
 };
 const env={
  SUPABASE_URL:'https://supabase.example.test',
  SUPABASE_ANON_KEY:'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY:'test-service-role-key',
  IP_HASH_SECRET:'private-fingerprint-secret'
 };
 const response=await handleApi(req('/api/describe',{
  image,model:'gemini-3.8-flash',responseStyle:'concise',
  responseLanguage:'bn-BD',saveToHistory:true
 },{
  Origin:'https://local.test',
  Cookie:'de_access=valid-access-token',
  'x-user-gemini-api-key':'AIzaSy-test-personal-gemini-key',
  'cf-connecting-ip':'203.0.113.45',
  'user-agent':'DaredevilsEye-Test/1.0'
 }),env);
 const data=await response.json();
 assert.equal(response.status,200);
 assert.equal(data.historySaved,true);
 assert.equal(providerKeySeen,'AIzaSy-test-personal-gemini-key');
 assert.equal(uploaded.length,1);
 assert.equal(uploaded[0].type,'image/jpeg');
 assert.equal(uploaded[0].bytes.byteLength,3);
 assert.equal(historyRows.length,1);
 assert.equal(historyRows[0].user_id,'22222222-2222-4222-8222-222222222222');
 assert.equal(historyRows[0].response_text,'A clear doorway is visible.');
 assert.equal(historyRows[0].model,'gemini-3.8-flash');
 assert.equal(historyRows[0].response_language,'bn-BD');
 assert.ok(historyRows[0].system_prompt.includes('Bangladeshi Bengali'));
 assert.equal(historyRows[0].prompt_tokens,100);
 assert.equal(historyRows[0].output_tokens,24);
 assert.equal(historyRows[0].total_tokens,124);
 assert.ok(historyRows[0].photo_path.startsWith('22222222-2222-4222-8222-222222222222/'));
 assert.match(historyRows[0].ip_fingerprint,/^[a-f0-9]{24}$/);
 assert.notEqual(historyRows[0].ip_fingerprint,'203.0.113.45');
 assert.equal(usageRows.length,1);
 assert.equal(usageRows[0].request_type,'describe');
 assert.equal(usageRows[0].total_tokens,124);
 assert.equal(usageRows[0].image_size_bytes,3);
 assert.match(usageRows[0].ip_fingerprint,/^[a-f0-9]{24}$/);
});


test('voice transcription never accepts an incomplete MAX_TOKENS transcript',async t=>{
 const originalFetch=globalThis.fetch;
 const attempted=[];
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  assert.ok(url.pathname.endsWith(':generateContent'));
  const model=decodeURIComponent(url.pathname.split('/models/')[1].split(':')[0]);
  attempted.push(model);
  if(attempted.length===1){
   return new Response(JSON.stringify({candidates:[{
    content:{parts:[{text:'আমি দরজার কাছে'}]},finishReason:'MAX_TOKENS'
   }]}),{status:200,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify({candidates:[{
   content:{parts:[{text:'আমি দরজার কাছে একটি সাদা দরজা দেখতে পাচ্ছি।'}]},finishReason:'STOP'
  }]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const r=await handleApi(req('/api/transcribe',{
  audio:'data:audio/webm;base64,AAAA',responseLanguage:'bn-BD'
 }),{GEMINI_API_KEY:'test-key-for-truncated-transcription'});
 const data=await r.json();
 assert.equal(r.status,200);
 assert.equal(data.transcript,'আমি দরজার কাছে একটি সাদা দরজা দেখতে পাচ্ছি।');
 assert.equal(data.model,attempted[1]);
 assert.equal(attempted.length,2);
});
