// site-ui.js — interactions du site (thème, nav mobile, révélations, carte Belgique) + démarrage
// Chargé par index.html ; scripts classiques partageant la portée globale.
// ── SITE INTERACTIONS ────────────────────────────────
// Belgium teaser card fed from real camp data
(function(){
  const b=CAMPS.find(c=>c.country==='Belgium');
  if(!b)return;
  document.getElementById('brx-name').textContent=b.camp_name;
  if(b.detail&&b.detail.description)document.getElementById('brx-desc').textContent=b.detail.description.length>170?b.detail.description.slice(0,167)+'…':b.detail.description;
  const chips=[];
  chips.push(`👤 ${b.age_requirements} y/o`);
  if(b.fee)chips.push(b.fee.startsWith('0')?'💰 FREE':`💰 ${b.fee}`);
  if(b.cs&&b.ce)chips.push(`🏕 ${fmtDate2(b.cs)} → ${fmtDate2(b.ce)}`);
  document.getElementById('brx-meta').innerHTML=chips.map(c=>`<span class="brx-chip">${c}</span>`).join('');
})();

// light / dark theme toggle (persisted)
function toggleTheme(){
  const h=document.documentElement;
  const t=h.getAttribute('data-theme')==='light'?'dark':'light';
  if(t==='light')h.setAttribute('data-theme','light');else h.removeAttribute('data-theme');
  try{localStorage.setItem('yce-theme',t);}catch(e){}
  document.getElementById('theme-btn').textContent=t==='light'?'🌙':'☀️';
}
document.getElementById('theme-btn').textContent=document.documentElement.getAttribute('data-theme')==='light'?'🌙':'☀️';

// close mobile nav after click
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>document.getElementById('nav-links').classList.remove('open')));

// scroll-reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:0.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// ── INIT ─────────────────────────────────────────────
initContinentPills();
renderCountryList();
renderStateList();
renderTable();
document.querySelector('th[data-c="continent"]').classList.add('asc');
