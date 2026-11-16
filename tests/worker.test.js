import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/src/index.js';

const TOKEN='test-only-app-access-token-32-characters-minimum';
const AUTH={authorization:'Bearer '+TOKEN};
const ENV={APP_ACCESS_TOKEN:TOKEN};
const req=(path,body,headers={})=>new Request('https://local.test'+path,{
  method:'POST',
  headers:{'content-type':'application/json',...AUTH,...headers},
  body:JSON.stringify(body)
});
const get=(path,headers={})=>new Request('https://local.test'+path,{headers:{...AUTH,...headers}});
const health=()=>new Request('https://local.test/api/health');
const image='data:image/jpeg;base64,AAAA';

test('public health reports safe readiness fields without exposing secrets',async()=>{
 const r=await handleApi(health(),{...ENV,GEMINI_API_KEY:'test-secret',SOS_ROOM:{},SOS_DIRECTORY:{}});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.appAccessConfigured,true);
 assert.equal(d.apiKeyConfigured,true);
 assert.equal(d.sosRelayConfigured,true);
 assert.equal(JSON.stringify(d).includes('test-secret'),false);
});
test('health defaults to Gemini and never silently to mock',async()=>{
 const r=await handleApi(health(),{});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.ok,true);
 assert.equal(d.apiKeyConfigured,false);
 assert.equal(d.providerConnected,false);
 assert.equal(d.appAccessConfigured,false);
});
test('health identifies explicit mock mode',async()=>{
 const r=await handleApi(health(),{AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(d.ok,true);
 assert.equal(d.mode,'mock');
 assert.equal(d.providerConnected,false);
 assert.equal(d.mockModeExplicitlyEnabled,true);
});
test('private APIs reject requests without a bearer token',async()=>{
 const r=await handleApi(new Request('https://local.test/api/config'),ENV);
 assert.equal(r.status,401);
});
test('private APIs fail closed when APP_ACCESS_TOKEN is not configured',async()=>{
 const r=await handleApi(new Request('https://local.test/api/config'),{});
 assert.equal(r.status,503);
});
test('session verification accepts the configured app token',async()=>{
 const r=await handleApi(get('/api/session'),ENV);
 assert.equal(r.status,200);
 assert.equal((await r.json()).authenticated,true);
});
test('session verification rejects an invalid app token',async()=>{
 const r=await handleApi(get('/api/session',{authorization:'Bearer wrong-token'}),ENV);
 assert.equal(r.status,401);
});
test('cross-origin API requests are rejected even with a token',async()=>{
 const r=await handleApi(get('/api/config',{origin:'https://evil.example'}),ENV);
 assert.equal(r.status,403);
});
test('config exposes base prompt and response styles',async()=>{
 const r=await handleApi(get('/api/config'),ENV);
 const d=await r.json();
 assert.ok(d.basePrompt.length>30);
 assert.ok(d.responseStyles.includes('concise'));
 assert.equal(d.model,'gemini-3.8-flash');
});
test('model list fails clearly if API key is missing',async()=>{
 const r=await handleApi(get('/api/models'),ENV);
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/API key is missing/);
});
test('describe with missing Gemini key never produces a fake mock description',async()=>{
 const r=await handleApi(req('/api/describe',{image}),ENV);
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/GEMINI_API_KEY/);
});
test('explicit mock response is clearly simulated',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{...ENV,AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(d.mock,true);
 assert.match(d.disclaimer,/SIMULATED/);
 assert.match(d.answer,/No objects or hazards were identified/);
});
test('unknown AI mode fails closed',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{...ENV,AI_MODE:'local'});
 assert.equal(r.status,503);
});
test('ask requires a question',async()=>{
 const r=await handleApi(req('/api/ask',{image}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported image data URLs',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/gif;base64,AAAA'}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects oversized encoded images',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/jpeg;base64,'+'A'.repeat(5500001)}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects invalid model identifiers',async()=>{
 const r=await handleApi(req('/api/describe',{image,model:'../../admin'}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects invalid wait limits',async()=>{
 const r=await handleApi(req('/api/describe',{image,waitSeconds:181}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported response styles',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseStyle:'ramble'}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported response languages',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseLanguage:'xx-XX'}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('Bangla response language is accepted by the Worker validation',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseLanguage:'bn-BD'}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,200);
});
test('camera routes require an image',async()=>{
 const r=await handleApi(req('/api/describe',{}),{...ENV,AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('SOS endpoints fail clearly when Durable Object bindings are missing',async()=>{
 const r=await handleApi(req('/api/sos/invite',{deviceId:'0123456789abcdef0123456789abcdef'}),ENV);
 const d=await r.json();
 assert.equal(r.status,503);
 assert.match(d.error,/SOS relay is not configured/);
});
test('approximate rate limit binding rejects excess AI requests',async()=>{
 const limitedEnv={...ENV,APP_AI_LIMIT:{limit:async()=>({success:false})}};
 const r=await handleApi(req('/api/describe',{image}),{...limitedEnv,AI_MODE:'mock'});
 assert.equal(r.status,429);
});

test('receiver pairing endpoint is separate from owner app-token authentication',async()=>{
 const r=await handleApi(req('/api/sos/pair',{code:'ABC234'}),{});
 assert.equal(r.status,503);
 const d=await r.json();
 assert.match(d.error,/SOS relay is not configured/);
});
test('sender SOS invitation endpoint still requires owner authentication',async()=>{
 const noToken=new Request('https://local.test/api/sos/invite',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceId:'0123456789abcdef0123456789abcdef'})});
 const r=await handleApi(noToken,{APP_ACCESS_TOKEN:TOKEN});
 assert.equal(r.status,401);
});
