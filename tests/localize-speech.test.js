import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Runs the real localizeSpeech from app.js (a browser module) with a stubbed getSettings.
const app=readFileSync(new URL('../web/shared/app.js',import.meta.url),'utf8');
const src=app.slice(app.indexOf('function localizeSpeech('),app.indexOf('function speakSosStatus('));
const load=lang=>new Function('getSettings',src+'\nreturn localizeSpeech;')(()=>({speechLanguage:lang}));

test('Bangla status text is spoken as-is, not replaced by the generic failure line',()=>{
 const localize=load('bn-BD');
 const ready='ছবিটি প্রস্তুত। পাঠানোর আগে ছবিটি দেখে এআই-কে জিজ্ঞাসা বোতাম চাপুন।';
 assert.equal(localize(ready),ready);
 assert.equal(localize('শর্তাবলি গ্রহণ করা হয়েছে। আপনি এখন অ্যাপ ব্যবহার করতে পারেন।'),'শর্তাবলি গ্রহণ করা হয়েছে। আপনি এখন অ্যাপ ব্যবহার করতে পারেন।');
});

test('English status text is still translated, and unknown text still gets the generic line',()=>{
 const localize=load('bn-BD');
 assert.equal(localize('SOS confirmation expired. No alert was sent.'),'এসওএস নিশ্চিত করার সময় শেষ হয়েছে। কোনো সতর্কবার্তা পাঠানো হয়নি।');
 assert.equal(localize('something unexpected'),'দুঃখিত, কাজটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
 assert.equal(load('en-US')('Photo ready.'),'Photo ready.');
});
