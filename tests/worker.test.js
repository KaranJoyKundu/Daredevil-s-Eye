import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi,rankVisionModels,getTranscriptionModelOrder} from '../worker/src/index.js';
import {detectSpokenLanguage} from '../web/shared/speech.js';

const req=(path,body,headers={})=>new Request('https://local.test'+path,{
 method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)
});
const get=(path,headers={})=>new Request('https://local.test'+path,{headers});
const health=()=>new Request('https://local.test/api/health');
const image='data:image/jpeg;base64,AAAA';

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

test('voice transcription rotates its two low-cost first-choice models before higher-cost fallbacks',()=>{
 const first=getTranscriptionModelOrder();
 const second=getTranscriptionModelOrder();
 assert.equal(first[0],'gemini-3.1-flash-lite');
 assert.equal(second[0],'gemini-3.5-flash-lite');
 assert.equal(first[1],'gemini-3.5-flash-lite');
 assert.equal(second[1],'gemini-3.1-flash-lite');
 assert.equal(first[2],'gemini-3.8-flash');
 assert.equal(first[3],'gemini-3.5-transcribe');
});
