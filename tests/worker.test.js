import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/src/index.js';

const req=(path,body)=>new Request('https://local.test'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const get=path=>new Request('https://local.test'+path);
const image='data:image/jpeg;base64,AAAA';

test('health defaults to Gemini, never silently to mock',async()=>{
 const r=await handleApi(get('/api/health'),{});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.ok,true);
 assert.equal(d.apiKeyConfigured,false);
 assert.equal(d.providerConnected,false);
});
test('health identifies explicit mock mode',async()=>{
 const r=await handleApi(get('/api/health'),{AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(d.ok,true);
 assert.equal(d.mode,'mock');
 assert.equal(d.providerConnected,false);
 assert.equal(d.mockModeExplicitlyEnabled,true);
});
test('config exposes base prompt and response styles',async()=>{
 const r=await handleApi(get('/api/config'),{});
 const d=await r.json();
 assert.ok(d.basePrompt.length>30);
 assert.ok(d.responseStyles.includes('concise'));
 assert.equal(d.model,'gemini-3.8-flash');
});
test('model list fails clearly if API key is missing',async()=>{
 const r=await handleApi(get('/api/models'),{});
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/API key is missing/);
});
test('describe with missing Gemini key never produces a fake mock description',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{});
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/GEMINI_API_KEY/);
});
test('explicit mock response is clearly simulated',async()=>{
 const r=await handleApi(req('/api/describe',{image}),{AI_MODE:'mock'});
 const d=await r.json();
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
test('rejects invalid wait limits',async()=>{
 const r=await handleApi(req('/api/describe',{image,waitSeconds:181}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('rejects unsupported response styles',async()=>{
 const r=await handleApi(req('/api/describe',{image,responseStyle:'ramble'}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
test('camera routes require an image',async()=>{
 const r=await handleApi(req('/api/describe',{}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
