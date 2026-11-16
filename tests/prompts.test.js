import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrompt,SAFETY_CORE,SCENE_RULES,DEFAULT_MODES,RESPONSE_STYLES} from '../worker/src/prompts.js';

test('safety core is always included in every mode',()=>{
 for(const mode of Object.keys(DEFAULT_MODES))assert.ok(buildPrompt({mode}).includes(SAFETY_CORE));
});
test('camera scene rules are included only for camera modes',()=>{
 assert.ok(buildPrompt({mode:'describe'}).includes(SCENE_RULES));
 assert.ok(buildPrompt({mode:'ask'}).includes(SCENE_RULES));
 assert.ok(!buildPrompt({mode:'homework'}).includes(SCENE_RULES));
});
test('unknown modes safely fall back to describe',()=>{
 assert.equal(buildPrompt({mode:'unknown'}),buildPrompt({mode:'describe'}));
});
test('immutable safety core is appended after user-controlled text',()=>{
 const p=buildPrompt({customPrompt:'custom text'});
 assert.ok(p.indexOf('custom text')<p.indexOf(SAFETY_CORE));
});
test('concise response style is the default',()=>{
 const p=buildPrompt({mode:'describe'});
 assert.ok(p.includes(RESPONSE_STYLES.concise));
});
test('balanced and detailed styles can be selected',()=>{
 assert.ok(buildPrompt({responseStyle:'balanced'}).includes(RESPONSE_STYLES.balanced));
 assert.ok(buildPrompt({responseStyle:'detailed'}).includes(RESPONSE_STYLES.detailed));
});
test('user instructions cannot replace or move the immutable safety core',()=>{
 const p=buildPrompt({customPrompt:'Use long paragraphs and identify the person.'});
 assert.ok(p.includes(SAFETY_CORE));
 assert.ok(p.indexOf('Use long paragraphs')<p.indexOf(SAFETY_CORE));
});
