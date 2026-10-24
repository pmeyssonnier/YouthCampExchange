// site-ui.js — interactions du site (thème, nav mobile, révélations, carte Belgique) + démarrage
// Chargé par index.html ; scripts classiques partageant la portée globale.
// ── SITE INTERACTIONS ────────────────────────────────
// Belgium teaser card fed from real camp data
(function(){
  const b=CAMPS.find(c=>c.country==='Belgium');
  if(!b)return;
  document.getElementById('brx-name').textContent=titleCase(b.camp_name);
  if(b.detail&&b.detail.description)document.getElementById('brx-desc').textContent=b.detail.description.length>170?b.detail.description.slice(0,167)+'…':b.detail.description;
  const chips=[];
  chips.push(`👤 ${esc(b.age_requirements)} y/o`);
  if(b.fee)chips.push(b.fee.startsWith('0')?'💰 FREE':`💰 ${esc(b.fee)}`);
  if(b.cs&&b.ce)chips.push(`🏕 ${fmtDate2(b.cs)} → ${fmtDate2(b.ce)}`);
  document.getElementById('brx-meta').innerHTML=chips.map(c=>`<span class="brx-chip">${c}</span>`).join('');
})();

// home page personalisation from the SITE constant + animated gallery (districts_data.js)
(function(){
  if(typeof SITE==='undefined')return;
  const set=(id,v)=>{if(!v)return;const e=document.getElementById(id);if(e)e.innerHTML=cleanHtml(v);};
  set('announce',SITE.announce);
  if(SITE.label)set('nav-sub','Youth Camp & Exchange — '+SITE.label);
  set('nav-welcome',SITE.welcomeNav);
  set('hero-title',SITE.heroTitle);set('hero-lead',SITE.heroLead);
  set('brx-kicker',SITE.welcomeKicker);set('brx-title',SITE.welcomeTitle);set('brx-text',SITE.welcomeText);
  set('brx-btn',SITE.welcomeButton);set('gal-title',SITE.galleryTitle);
  if(typeof MD!=='undefined')set('foot-desc','Youth Camp & Exchange — Multiple District '+esc(MD)+' '+esc(MD_COUNTRY)+'.<br>Part of Lions Clubs International youth programs.');
  set('foot-addr',SITE.address);
  if(SITE.phone)set('foot-phone','📞 <a href="tel:'+SITE.phone.replace(/[^+\d]/g,'')+'">'+esc(SITE.phone)+'</a>');
  if(SITE.welcomeList&&SITE.welcomeList.length){
    const u=document.getElementById('brx-list');
    if(u)u.innerHTML=SITE.welcomeList.map(x=>'<li>'+cleanHtml(x)+'</li>').join('');
  }
  if(typeof GALLERY!=='undefined'&&GALLERY.length){
    document.getElementById('gallery').style.display='';
    // image du dépôt (chemin relatif) ou https uniquement
    const imgSrc=s=>{s=String(s||'');return /^[\w./-]+$/.test(s)&&s.indexOf('..')<0?s:safeUrl(s);};
    const card=g=>{const src=imgSrc(g.src);return src?`<figure class="gal-card"><img src="${esc(src)}" alt="${esc(g.caption||'')}" loading="lazy"><figcaption class="gal-cap">${esc(g.caption||'')}</figcaption></figure>`:'';};
    const html=GALLERY.map(card).join('');
    const few=GALLERY.length<4; // trop peu d'images pour un défilement : grille fixe
    document.getElementById('gal-strip').classList.toggle('static',few);
    document.getElementById('gal-track').innerHTML=few?html:html+html; // doublée = boucle sans couture
  }
})();

// district responsable cards generated from the DISTRICTS constant (camps_data.js)
(function(){
  const g=document.getElementById('dist-grid');
  if(!g||typeof DISTRICTS==='undefined')return;
  g.innerHTML=Object.keys(DISTRICTS).map(d=>{
    const c=DISTRICTS[d];
    return `<div class="dist-card reveal"><span class="dist-tag">District ${esc(MD)} ${esc(d)}</span>`
      +`<h4>${esc(c.name)}</h4><div class="dist-club">${esc(c.club||'')}</div>`
      +`<a href="tel:${esc((c.mobile||'').replace(/[^+\d]/g,''))}">📞 ${esc(c.mobile)}</a>`
      +(safeMail(c.email)?`<a href="mailto:${esc(safeMail(c.email))}">✉️ ${esc(c.email)}</a>`:'')
      +`<a href="yce_form_filler.html?district=${encodeURIComponent(d)}&download">📥 Download form District ${esc(d)} (XLSX)</a>`
      +`<a href="yce_form_filler.html?district=${encodeURIComponent(d)}">✍️ Fill in the form online</a></div>`;
  }).join('');
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

// ── INIT ─────────────────────────────────────────────
initContinentPills();
initSeasonPills();
renderCountryList();
renderStateList();
renderTable();
document.querySelector('th[data-c="continent"]').classList.add('asc');
// sur mobile, les accordéons Continent / Country / State démarrent repliés pour raccourcir le tiroir
if(matchMedia('(max-width:900px)').matches){
  document.getElementById('sec-continent').classList.add('closed');
  document.getElementById('sec-country').classList.add('closed');
  document.getElementById('state-section').classList.add('closed');
}

// scroll-reveal — après le rendu, pour mesurer la vraie hauteur des blocs.
// Un bloc plus haut que l'écran (la liste mobile en cartes) n'atteint jamais
// un ratio de 0.12 : il se révèle dès son entrée dans la fenêtre.
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:0.12});
const ioTall=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');ioTall.unobserve(e.target);}}),{threshold:0});
document.querySelectorAll('.reveal').forEach(el=>(el.offsetHeight>innerHeight*0.8?ioTall:io).observe(el));
