import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/src/index.js';

const req=(path,body)=>new Request('https://local.test'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const health=()=>new Request('https://local.test/api/health');

test('health defaults to Gemini, never silently to mock',async()=>{
 const r=await handleApi(health(),{});
 const d=await r.json();
 assert.equal(d.mode,'gemini');
 assert.equal(d.ok,true);
 assert.equal(d.apiKeyConfigured,false);
 assert.equal(d.providerConnected,false);
});
test('health identifies explicit mock mode',async()=>{
 const r=await handleApi(health(),{AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(d.ok,true);
 assert.equal(d.mode,'mock');
 assert.equal(d.providerConnected,false);
 assert.equal(d.mockModeExplicitlyEnabled,true);
});
test('describe with no mode does not produce a fake mock description',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/jpeg;base64,AAAA'}),{});
 const d=await r.json();
 assert.equal(r.status,502);
 assert.match(d.error,/GEMINI_API_KEY/);
});
test('explicit mock response is clearly simulated',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/jpeg;base64,AAAA'}),{AI_MODE:'mock'});
 const d=await r.json();
 assert.equal(d.mock,true);
 assert.match(d.disclaimer,/SIMULATED/);
 assert.match(d.answer,/No objects or hazards were identified/);
});
test('unknown AI mode fails closed',async()=>{
 const r=await handleApi(req('/api/describe',{image:'data:image/jpeg;base64,AAAA'}),{AI_MODE:'local'});
 assert.equal(r.status,503);
});
test('ask requires a question',async()=>{
 const r=await handleApi(req('/api/ask',{image:'data:image/jpeg;base64,AAAA'}),{AI_MODE:'mock'});
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
test('camera routes require an image',async()=>{
 const r=await handleApi(req('/api/describe',{}),{AI_MODE:'mock'});
 assert.equal(r.status,400);
});
