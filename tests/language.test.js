import test from 'node:test';
import assert from 'node:assert/strict';

const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const {applyPageLanguage}=await import('../web/shared/language.js');
const {saveSettings}=await import('../web/shared/settings.js?v=20261117-release5');

const node=(text,dataset={},attrs={})=>({textContent:text,dataset,getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{attrs[k]=v;},attrs});
function page(){
 const title=node('Describe',{bn:'বর্ণনা'}),tile=node('',{bnLabel:'চারপাশ বর্ণনা করুন'},{'aria-label':'Describe the camera view'});
 const en=node('English',{lang:'en-US'}),bn=node('বাংলা',{lang:'bn-BD'});
 const root={documentElement:{setAttribute(k,v){this[k]=v;}},querySelectorAll:s=>s==='[data-bn]'?[title]:s==='[data-bn-label]'?[tile]:[en,bn]};
 return {root,title,tile,en,bn};
}

test('Bangla (the default) swaps labels, aria-labels and the page lang; English restores the originals',()=>{
 const p=page();
 applyPageLanguage(p.root);
 assert.equal(p.root.documentElement.lang,'bn');
 assert.equal(p.title.textContent,'বর্ণনা');
 assert.equal(p.tile.attrs['aria-label'],'চারপাশ বর্ণনা করুন');
 assert.equal(p.bn.attrs['aria-pressed'],'true');
 saveSettings({speechLanguage:'en-US'});
 applyPageLanguage(p.root);
 assert.equal(p.root.documentElement.lang,'en');
 assert.equal(p.title.textContent,'Describe');
 assert.equal(p.tile.attrs['aria-label'],'Describe the camera view');
 assert.equal(p.en.attrs['aria-pressed'],'true');
 assert.equal(p.bn.attrs['aria-pressed'],'false');
});

