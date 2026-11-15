import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrompt,SAFETY_CORE,SCENE_RULES,DEFAULT_MODES} from '../worker/src/prompts.js';
test('safety core is always included in every mode',()=>{for(const mode of Object.keys(DEFAULT_MODES))assert.ok(buildPrompt({mode}).includes(SAFETY_CORE));});
test('camera scene rules are included only for camera modes',()=>{assert.ok(buildPrompt({mode:'describe'}).includes(SCENE_RULES));assert.ok(buildPrompt({mode:'ask'}).includes(SCENE_RULES));assert.ok(!buildPrompt({mode:'homework'}).includes(SCENE_RULES));});
test('unknown modes safely fall back to describe',()=>assert.equal(buildPrompt({mode:'unknown'}),buildPrompt({mode:'describe'})));
test('immutable safety core is appended after user-controlled text',()=>{const p=buildPrompt({customPrompt:'custom text'});assert.ok(p.indexOf('custom text')<p.indexOf(SAFETY_CORE));});
