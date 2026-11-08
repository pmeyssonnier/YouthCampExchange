// site-modal.js — fiche détaillée d'un camp : sections, ouverture/fermeture
// Chargé par index.html ; scripts classiques partageant la portée globale.
// ── MODAL ────────────────────────────────────────────
function showCampDetail(idx){
  const c=CAMPS[idx];if(!c)return;
  document.querySelectorAll('tr.clickable-row').forEach(r=>r.classList.remove('selected'));
  const row=document.querySelector(`tr[data-idx="${idx}"]`);if(row)row.classList.add('selected');
  const isFree=c.fee&&(c.fee.startsWith('0 ')||c.fee==='0');
  // durées en nuits (date de fin − date de début) : le total est ainsi la somme des périodes qui se suivent
  const nights=(a,b)=>a&&b&&b>a?Math.round((b-a)/86400000):null;
  const nightsTxt=n=>n+' night'+(n>1?'s':'');
  const durRow=n=>n?`<div class="ms-row"><span class="ms-lbl">Duration</span><span class="ms-val">${nightsTxt(n)}</span></div>`:'';
  const campNights=nights(c.cs,c.ce);
  const totalNights=nights(c.arrival,c.departure);
  const det=c.detail||null;
  document.getElementById('md-continent').textContent=c.continent;
  document.getElementById('md-title').textContent=titleCase(c.camp_name);
  document.getElementById('md-country').innerHTML=`🗺️ &nbsp;${esc(c.country)}${c.state?' <span style="color:var(--muted);font-size:11px">— '+esc(c.state)+'</span>':''}${c.inclusive?' &nbsp;<span class="ms-tag incl-tag" title="Camp designed for young people with disabilities or special needs">♿ Inclusion</span>':''}`;
  const encLoc=det&&det.location?encodeURIComponent(det.location):'';

  const secLocation=det&&det.location?`
    <div class="modal-section full">
      <div class="ms-title">📍 Location</div>
      <a class="ms-link" href="https://www.google.com/maps/search/?api=1&query=${encLoc}" target="_blank" rel="noopener">📍 ${esc(det.location)} ↗</a>
    </div>`:'';

  const secDesc=det&&det.description?`
    <div class="modal-section full">
      <div class="ms-title">🏕 Camp Activities</div>
      <div class="ms-desc">${esc(det.description)}</div>
    </div>`:'';

  const secHfa=det&&det.host_family_activities?`
    <div class="modal-section full">
      <div class="ms-title">🏠 Host Family Activities</div>
      <div class="ms-desc">${esc(det.host_family_activities)}</div>
    </div>`:'';

  const hasLang=det&&det.languages&&det.languages.length;
  const web=det?safeUrl(det.website):null,yce=det?safeUrl(det.yce_url):null,flyer=det?safeUrl(det.flyer_url):null,mails=det?String(det.contact_email==null?'':det.contact_email).split(/\s*[;,]\s*/).filter(Boolean):[];
  const hasLinks=!!(web||yce||flyer);
  const hasContact=det&&(det.contact_email||det.contact_name||det.contact_phone||det.application_deadline);

  const secLang=hasLang?`
    <div class="modal-section ${!hasLinks&&!hasContact?'full':''}">
      <div class="ms-title">🗣 Languages</div>
      <div style="margin-top:4px">${det.languages.map(l=>`<span class="ms-tag">${esc(l)}</span>`).join('')}</div>
    </div>`:'';

  const secLinks=hasLinks?`
    <div class="modal-section ${!hasLang&&!hasContact?'full':''}">
      <div class="ms-title">🔗 Links</div>
      ${web?`<div class="ms-row" style="margin-bottom:6px"><span class="ms-lbl">Website</span><a class="ms-link" href="${esc(web)}" target="_blank" rel="noopener">${esc(det.website.replace(/^https?:\/\//,''))}</a></div>`:''}
      ${yce?`<div class="ms-row"><span class="ms-lbl">YCE Page</span><a class="ms-link" href="${esc(yce)}" target="_blank" rel="noopener">lions-yce-belgium.be ↗</a></div>`:''}
      ${flyer?`<div class="ms-row"${web||yce?' style="margin-top:6px"':''}><span class="ms-lbl">Flyer</span><a class="ms-link" href="${esc(flyer)}" target="_blank" rel="noopener">View the camp flyer ↗</a></div>`:''}
    </div>`:'';

  const secContact=hasContact?`
    <div class="modal-section full">
      <div class="ms-title">📬 Contact</div>
      ${det.contact_name?`<div class="ms-row"><span class="ms-lbl">Name</span><span class="ms-val">${esc(det.contact_name)}</span></div>`:''}
      ${mails.map((m,k)=>{const ok=safeMail(m);return `<div class="ms-row"><span class="ms-lbl">${k?'':'Email'}</span>${ok?`<a class="ms-link" href="mailto:${esc(ok)}">${esc(ok)}</a>`:`<span class="ms-val">${esc(m)}</span>`}</div>`;}).join('')}
      ${det.contact_phone?(()=>{const ph=phoneInfo(det.contact_phone);return `<div class="ms-row"><span class="ms-lbl">Phone</span>${ph.wa?`<a class="ms-link ms-wa" href="https://wa.me/${esc(ph.wa)}" target="_blank" rel="noopener noreferrer" title="Open in WhatsApp">${esc(ph.text)}</a>`:`<span class="ms-val">${esc(ph.text)}</span>`}</div>`;})():''}
      ${det.application_deadline?`<div class="ms-row"><span class="ms-lbl">Deadline</span><span class="ms-val orange">${fmtDate(det.application_deadline)}</span></div>`:''}
    </div>`:'';

  const secNoDetail=!det?`<div class="modal-section full"><div class="ms-title">ℹ️ Camp Details</div><div class="ms-no-detail">Detailed information not yet available for this camp.</div></div>`:'';

  document.getElementById('md-body').innerHTML=`
    <div class="modal-section">
      <div class="ms-title">👤 Age Requirements</div>
      <div class="ms-row"><span class="ms-lbl">Eligible ages</span><span class="ms-val big">${esc(c.age_requirements)}</span></div>
      ${det&&det.participants?`<div class="ms-row"><span class="ms-lbl">Capacity</span><span class="ms-val">${esc(det.participants)} participants</span></div>`:''}
    </div>
    <div class="modal-section">
      <div class="ms-title">💰 Participation Fee</div>
      <div class="ms-row"><span class="ms-lbl">Amount</span><span class="ms-val big ${isFree?'free':''}">${isFree?'FREE':esc(c.fee||'—')}</span></div>
    </div>
    ${secLocation}${secDesc}${secHfa}${secLang}${secLinks}${secContact}${secNoDetail}
    <div class="modal-section">
      <div class="ms-title">🏕 Camp Period</div>
      <div class="ms-row"><span class="ms-lbl">Start</span><span class="ms-val blue">${fmtFull(c.cs)}</span></div>
      <div class="ms-row"><span class="ms-lbl">End</span><span class="ms-val blue">${fmtFull(c.ce)}</span></div>
      ${durRow(campNights)}
    </div>
    <div class="modal-section">
      <div class="ms-title">🏠 Family Stay</div>
      ${c.fs?`<div class="ms-row"><span class="ms-lbl">Start</span><span class="ms-val">${fmtFull(c.fs)}</span></div><div class="ms-row"><span class="ms-lbl">End</span><span class="ms-val">${fmtFull(c.fe)}</span></div>${durRow(nights(c.fs,c.fe))}`
      :'<div style="color:var(--muted);font-size:11px;font-style:italic">No family stay information</div>'}
    </div>
    ${c.fs2?`<div class="modal-section full">
      <div class="ms-title">🏠 Second Family Stay</div>
      <div class="ms-row"><span class="ms-lbl">Start</span><span class="ms-val">${fmtFull(c.fs2)}</span></div>
      <div class="ms-row"><span class="ms-lbl">End</span><span class="ms-val">${fmtFull(c.fe2)}</span></div>
      ${durRow(nights(c.fs2,c.fe2))}
    </div>`:''}
    <div class="modal-section full" style="background:rgba(255,183,77,0.06);border-color:rgba(255,183,77,0.25);">
      <div class="ms-title" style="color:var(--orange)">✈ Total Presence in Country</div>
      <div class="ms-row"><span class="ms-lbl">Arrival</span><span class="ms-val orange">${fmtFull(c.arrival)}</span></div>
      <div class="ms-row"><span class="ms-lbl">Departure</span><span class="ms-val orange">${fmtFull(c.departure)}</span></div>
      ${totalNights?`<div class="ms-row"><span class="ms-lbl">Total stay</span><span class="ms-val orange">${nightsTxt(totalNights)} in country</span></div>`:''}
    </div>`;

  document.getElementById('modal-backdrop').classList.add('open');
  document.getElementById('modal-box').classList.add('open');
}

function closeModal(){
  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('modal-box').classList.remove('open');
  document.querySelectorAll('tr.clickable-row').forEach(r=>r.classList.remove('selected'));
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
