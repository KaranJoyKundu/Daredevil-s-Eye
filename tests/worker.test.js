import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/src/index.js';

const ALLOW=async()=>({success:true});
const LIMITS={
 APP_AI_LIMIT:{limit:ALLOW},
 APP_SOS_LIMIT:{limit:ALLOW}
};
const req=(path,body,headers={})=>new Request('https://local.test'+path,{
 method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)
});
const get=(path,headers={})=>new Request('https://local.test'+path,{headers});
const health=()=>new Request('https://local.test/api/health');
const image='data:image/jpeg;base64,AAAA';

test('health is public and reports provider and rate-limit configuration without secrets',async()=>{
 const r=await handleApi(health(),{...LIMITS,GEMINI_API_KEY:'test-secret',SOS_ROOM:{},SOS_DIRECTORY:{}});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.apiKeyConfigured,true);
 assert.equal(d.providerConfigured,true);
 assert.equal(d.rateLimitsConfigured,true);
 assert.equal(d.sosRelayConfigured,true);
 assert.equal(JSON.stringify(d).includes('test-secret'),false);
});
test('health defaults to Gemini and does not require an app access token',async()=>{
 const r=await handleApi(health(),{});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.ok,true);
 assert.equal(d.apiKeyConfigured,false);
 assert.equal(d.providerConfigured,false);
 assert.equal('appAccessConfigured' in d,false);
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
 const r=await handleApi(get('/api/models'),LIMITS);
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/API key is not configured/);
});
test('describe with missing Gemini key never produces a fake mock description',async()=>{
 const r=await handleApi(req('/api/describe',{image}),LIMITS);
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/GEMINI_API_KEY/);
});
test('explicit mock response is clearly simulated with public API access',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{...LIMITS,AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(r.status,200);
 assert.equal(d.mock,true);
 assert.match(d.disclaimer,/SIMULATED/);
 assert.match(d.answer,/No objects or hazards were identified/);
});
test('unknown AI mode fails closed',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{...LIMITS,AI_MODE:'local'});
 assert.equal(r.status,503);
});
test('ask requires a question',async()=>{
 const r=await handleApi(req('/api/ask',{image}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported image data URLs',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/gif;base64,AAAA'}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects oversized encoded images',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/jpeg;base64,'+'A'.repeat(5500001)}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects invalid model identifiers',async()=>{
 const r=await handleApi(req('/api/describe',{image,model:'../../admin'}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('public endpoint rejects models outside the server allowlist',async()=>{
 const r=await handleApi(req('/api/describe',{image,model:'gemini-3.8-pro'}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
 assert.match((await r.json()).error,/configured Gemini model/);
});
test('rejects invalid wait limits',async()=>{
 const r=await handleApi(req('/api/describe',{image,waitSeconds:181}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported response styles',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseStyle:'ramble'}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported response languages',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseLanguage:'xx-XX'}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('Bangla response language is accepted by Worker validation',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseLanguage:'bn-BD'}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,200);
});
test('custom prompt is capped at 1000 characters',async()=>{
 const r=await handleApi(req('/api/describe',{image,customPrompt:'x'.repeat(1001)}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('camera routes require an image',async()=>{
 const r=await handleApi(req('/api/describe',{}),{...LIMITS,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('SOS endpoints are public but still require configured relay',async()=>{
 const r=await handleApi(req('/api/sos/invite',{deviceId:'0123456789abcdef0123456789abcdef'}),LIMITS);
 const d=await r.json();
 assert.equal(r.status,503);
 assert.match(d.error,/SOS relay is not configured/);
});
test('AI rate limit is enforced without login and consumes weighted units',async()=>{
 let captured=null;
 const env={...LIMITS,AI_MODE:'mock',APP_AI_LIMIT:{limit:async input=>{captured=input;return {success:false};}}};
 const r=await handleApi(req('/api/describe',{image}),env);
 assert.equal(r.status,429);
 assert.equal(captured.key,'local-development:ai');
 assert.equal(captured.delta,4);
});
test('Gemini speech rate limit uses a lower weighted cost than image vision',async()=>{
 let captured=null;
 const env={...LIMITS,APP_AI_LIMIT:{limit:async input=>{captured=input;return {success:false};}}};
 const r=await handleApi(req('/api/speech',{text:'Hello',voice:'Kore'}),env);
 assert.equal(r.status,429);
 assert.equal(captured.delta,2);
});
test('public AI requests fail closed when rate limiting is missing',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{AI_MODE:'mock'});
 assert.equal(r.status,503);
 assert.match((await r.json()).error,/rate limiting is not configured/);
});
test('public receiver pairing does not require app login but remains rate limited',async()=>{
 const r=await handleApi(req('/api/sos/pair',{code:'ABC234'}),{...LIMITS});
 assert.equal(r.status,503);
 assert.match((await r.json()).error,/SOS relay is not configured/);
});
