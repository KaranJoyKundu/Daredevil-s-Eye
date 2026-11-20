import {getSettings,saveSettings} from './settings.js?v=20261117-release5';
import {speak} from './speech.js?v=20261117-release5';

// One switch for the answer and speech language. Speech input stays automatic (Bangla, English or mixed).
const BN='bn-BD',EN='en-US';
export const isBangla=()=>getSettings().speechLanguage===BN;

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
