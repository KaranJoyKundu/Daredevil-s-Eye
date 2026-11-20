import {getSettings,saveSettings} from './settings.js?v=20261117-release5';
import {speak} from './speech.js?v=20261117-release5';
import {BN as BN_TEXT,BN_PREFIX} from './bn-text.js?v=20261120-bn';
// every app page loads this module, so it also registers the service worker that makes the app installable
globalThis.navigator?.serviceWorker?.register('/sw.js',{scope:'/'}).catch(()=>{});

// One switch for the answer and speech language. Speech input stays automatic (Bangla, English or mixed).
const BN='bn-BD',EN='en-US';
export const isBangla=()=>getSettings().speechLanguage===BN;

// Everything without data-bn is translated from the shared dictionary: text nodes plus user-facing attributes.
// The pair is remembered so English comes back exactly, and a MutationObserver catches text scripts write later.
const ATTRS=['placeholder','aria-label','title','alt'],SKIP='script,style,textarea,code,[data-bn],.lang-switch,[translate=no]';
const pairs=new WeakMap();let enTitle=null,observer=null;
const key=s=>s.replace(/\s+/g,' ').trim();
// Exact text first, then a known fixed start ("Completed with " + model name).
export function toBangla(text){
 const k=key(String(text||''));if(!k)return null;
 if(BN_TEXT[k])return BN_TEXT[k];
 const hit=BN_PREFIX.find(([en])=>k.startsWith(en));
 return hit?hit[1]+k.slice(hit[0].length):null;
}
function swapNode(node,bn){
 const raw=node.nodeValue,seen=pairs.get(node);
 if(!bn){if(seen&&raw===seen.bn)node.nodeValue=seen.en;return;}
 if(seen&&raw===seen.bn)return;
 const t=toBangla(raw);if(!t)return;
 const out=raw.match(/^\s*/)[0]+t+raw.match(/\s*$/)[0];
 pairs.set(node,{en:raw,bn:out});node.nodeValue=out;
}
function swapAttrs(el,bn){
 const seen=pairs.get(el)||{};
 for(const a of ATTRS){
  if(a==='aria-label'&&el.hasAttribute('data-bn-label'))continue;
  const v=el.getAttribute(a);if(v==null)continue;
  if(!bn){if(seen[a]&&v===seen[a].bn)el.setAttribute(a,seen[a].en);continue;}
  if(seen[a]&&v===seen[a].bn)continue;
  const t=toBangla(v);if(!t)continue;
  seen[a]={en:v,bn:t};pairs.set(el,seen);el.setAttribute(a,t);
 }
}
function translateTree(root,bn){
 if(root?.nodeType===3){if(!root.parentElement?.closest(SKIP))swapNode(root,bn);return;}
 if(root?.nodeType!==1||root.closest(SKIP))return;
 swapAttrs(root,bn);
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:n=>n.nodeType===1&&n.matches(SKIP)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
 for(let n=walk.nextNode();n;n=walk.nextNode())n.nodeType===3?swapNode(n,bn):swapAttrs(n,bn);
}
function translatePage(bn){
 translateTree(document.body,bn);
 enTitle??=document.title;document.title=bn&&toBangla(enTitle)||enTitle;
 if(observer||!document.body)return;
 observer=new MutationObserver(records=>{
  if(!isBangla())return;
  for(const r of records)r.type==='childList'?r.addedNodes.forEach(n=>translateTree(n,true)):translateTree(r.target,true);
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
}

// Swaps every [data-bn] text and [data-bn-label] aria-label; the English original is kept in data-en*.
export function applyPageLanguage(root=document){
 const bn=isBangla();
 root.documentElement?.setAttribute('lang',bn?'bn':'en');
 for(const el of root.querySelectorAll('[data-bn]')){
  if(el.dataset.en===undefined)el.dataset.en=el.textContent;
  el.textContent=bn?el.dataset.bn:el.dataset.en;
 }
 for(const el of root.querySelectorAll('[data-bn-label]')){
  if(el.dataset.enLabel===undefined)el.dataset.enLabel=el.getAttribute('aria-label')||'';
  el.setAttribute('aria-label',bn?el.dataset.bnLabel:el.dataset.enLabel);
 }
 for(const button of root.querySelectorAll('.lang-switch button'))button.setAttribute('aria-pressed',String(button.dataset.lang===(bn?BN:EN)));
 if(root===globalThis.document)translatePage(bn);
}

export function setLanguage(lang,{announce=true}={}){
 const next=lang===BN?BN:EN;
 saveSettings({speechLanguage:next});
 applyPageLanguage();
 const select=document.querySelector('#language');if(select)select.value=next;
 if(announce)speak(next===BN?'বাংলা চালু হয়েছে। উত্তর বাংলায় শোনানো হবে।':'English is on. Answers will be spoken in English.',{lang:next});
}

export function mountLanguageSwitch(container){
 if(!container||document.querySelector('.lang-switch'))return;
 const group=document.createElement('div');
 group.className='lang-switch';group.setAttribute('role','group');group.setAttribute('aria-label','Answer language / উত্তরের ভাষা');
 group.innerHTML='<button type="button" data-lang="en-US" lang="en">English</button><button type="button" data-lang="bn-BD" lang="bn">বাংলা</button>';
 group.addEventListener('click',event=>{const button=event.target.closest('button[data-lang]');if(button)setLanguage(button.dataset.lang);});
 container.append(group);
 applyPageLanguage();
}
