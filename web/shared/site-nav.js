const links = [
  ['Home','/action/'],['Blind mode','/blind/'],['Admin / Settings','/admin/'],
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
const details=bar.querySelector('details');
document.addEventListener('pointerdown',event=>{
  if(details?.open&&!bar.querySelector('.site-menu')?.contains(event.target))details.removeAttribute('open');
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')details?.removeAttribute('open');
});
bar.querySelectorAll('.site-menu nav a').forEach(link=>link.addEventListener('click',()=>details?.removeAttribute('open')));