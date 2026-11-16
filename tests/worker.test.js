import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleApi,rankVisionModels,getTranscriptionModelOrder} from '../worker/src/index.js';
import {detectSpokenLanguage,selectVoiceForText} from '../web/shared/speech.js';
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
test('vision models are ranked with advanced photo understanding first and lite tiers lower',()=>{
 const ranked=rankVisionModels([
  {id:'gemini-3.1-flash-lite',name:'Flash Lite'},
  {id:'gemini-3.8-flash',name:'Flash'},
  {id:'gemini-3.1-pro-preview',name:'Pro Preview'},
  {id:'gemini-3.7-flash',name:'Flash 3.7'}
 ]);
 assert.deepEqual(ranked.map(item=>item.id),[
  'gemini-3.1-pro-preview','gemini-3.8-flash','gemini-3.7-flash','gemini-3.1-flash-lite'
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
 assert.equal(d.model,'gemini-3.1-pro-preview');
 assert.deepEqual(attempts,['gemini-3.8-flash','gemini-3.1-pro-preview']);
});
