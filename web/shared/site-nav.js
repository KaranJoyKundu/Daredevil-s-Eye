import {hasCurrentConsent,acceptConsent,rejectConsent} from './consent.js?v=20261117-release5';
import {saveSettings} from './settings.js?v=20261117-release5';
import {mountLanguageSwitch} from './language.js?v=20261117-release5';
import {startRFIDListener} from './rfid-listener.js?v=20261126-dedup1';

const links = [
  ['Home','/action/'],['Medicine RFID','/medicine/'],['Blind mode','/blind/'],['Admin / Settings','/admin/'],
  ['Diagnostics','/diagnostics/'],['Account & History','/account/'],['Help','/help/'],['SOS Receiver','/sos-receiver/'],
  ['Contact','/contact/'],['Support','/support/'],['Terms & Conditions','/terms/'],['Privacy','/privacy/']
];
const bar=document.createElement('div');
bar.className='site-nav';
bar.innerHTML='<details class="site-menu"><summary aria-label="Open site menu"><span aria-hidden="true">☰</span><span class="menu-label">Menu</span></summary><nav aria-label="Main navigation"></nav></details><a class="site-brand" href="/action/" aria-label="Daredevil’s Eye — return to home">Daredevil’s Eye</a>';
const menu=bar.querySelector('nav');
for(const [label,href] of links){
  const link=document.createElement('a');
  link.href=href;link.textContent=label;
  if(location.pathname.replace(/\/?$/,'/')===href)link.setAttribute('aria-current','page');
  menu.append(link);
}
document.body.prepend(bar);
mountLanguageSwitch(bar);
startRFIDListener();

// Require the same explicit consent before any app surface can be used,
// including direct visits to Admin, Diagnostics, Account and the SOS receiver.
const protectedPaths=new Set(['/','/action/','/blind/','/admin/','/diagnostics/','/account/','/help/','/sos-receiver/','/medicine/']);
const currentPath=location.pathname.replace(/\/?$/,'/');
if(protectedPaths.has(currentPath)&&!hasCurrentConsent()&&!document.querySelector('#consent-panel')){
 const gate=document.createElement('section');
 gate.id='consent-panel';gate.className='consent-gate';gate.setAttribute('role','dialog');gate.setAttribute('aria-modal','true');
 gate.setAttribute('aria-labelledby','shared-consent-title');
 gate.innerHTML=`<div class="consent-card">
  <p class="eyebrow">WELCOME</p><h2 id="shared-consent-title">Before you begin</h2>
  <p>Photos and voice requests may be processed by this app, Cloudflare and Google Gemini. After you accept, each photo submitted for AI analysis is saved automatically: signed-in users get private account history, while guests get private history tied to this browser for 30 days. You can turn photo saving off in Admin.</p>
  <p>The Terms &amp; Conditions and Privacy pages contain the complete safety and data details.</p>
  <p>Read the <a href="/terms/">Terms &amp; Conditions</a> and <a href="/privacy/">Privacy details</a>. You can also <a href="/account/">sign in or create an account</a>.</p>
  <label class="consent-check"><input id="shared-consent-check" type="checkbox"> I have read and agree to the Terms &amp; Conditions and Privacy notice.</label>
  <p id="shared-consent-status" class="hint" role="status" aria-live="polite"></p>
  <div class="consent-actions"><button id="shared-consent-accept" type="button" disabled>Accept &amp; continue</button><button id="shared-consent-reject" type="button" class="secondary">Reject</button></div>
 </div>`;
 document.body.append(gate);
 const check=gate.querySelector('#shared-consent-check'),accept=gate.querySelector('#shared-consent-accept'),status=gate.querySelector('#shared-consent-status');
 check.addEventListener('change',()=>{accept.disabled=!check.checked;});
 accept.addEventListener('click',()=>{
  if(!check.checked){status.textContent='Please tick the box to accept the terms.';return;}
  if(!acceptConsent()){status.textContent='Could not save acceptance in this browser. Enable site storage and try again.';return;}
  saveSettings({savePhotoHistory:true,consentAccepted:true});
  gate.remove();
 });
 gate.querySelector('#shared-consent-reject').addEventListener('click',()=>{
  rejectConsent();check.checked=false;accept.disabled=true;
  status.textContent='You declined the Terms & Conditions. This app page remains locked. Close this page, or return and accept if you change your mind.';
 });
}
const details=bar.querySelector('details');
document.addEventListener('pointerdown',event=>{
  if(details?.open&&!bar.querySelector('.site-menu')?.contains(event.target))details.removeAttribute('open');
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')details?.removeAttribute('open');
});
bar.querySelectorAll('.site-menu nav a').forEach(link=>link.addEventListener('click',()=>details?.removeAttribute('open')));
