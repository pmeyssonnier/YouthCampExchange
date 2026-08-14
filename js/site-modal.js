// site-modal.js — fiche détaillée d'un camp : chronologie, sections, ouverture/fermeture
// Chargé par index.html ; scripts classiques partageant la portée globale.
// ── MODAL ────────────────────────────────────────────
function buildTimeline(c,campDays){
  const events=[];
  if(c.fs)events.push({date:c.fs,key:'fs',dot:'orange',lbl:'🏠 Family stay begins'});
  if(c.fe)events.push({date:c.fe,key:'fe',dot:'green',lbl:'🏠 Family stay ends'});
  if(c.cs)events.push({date:c.cs,key:'cs',dot:'blue',lbl:'🏕 Camp starts',extra:campDays?` <span style="color:var(--muted);font-size:10px">(${campDays} days)</span>`:''});
  if(c.ce)events.push({date:c.ce,key:'ce',dot:'blue',lbl:'🏕 Camp ends'});
  const keyOrder={fs:0,fe:1,cs:2,ce:3};
  events.sort((a,b)=>(a.date-b.date)||(keyOrder[a.key]-keyOrder[b.key]));
  if(!events.length)return'<div style="color:var(--muted);font-size:11px">No date information</div>';
  events[0].arrival=true;events[events.length-1].departure=true;
  return events.map((ev,i)=>{
    const isLast=i===events.length-1;let lbl=ev.lbl,dot=ev.dot;
    if(ev.arrival){lbl=`✈ Arrival in country — ${ev.lbl}`;dot='orange';}
    if(ev.departure){lbl=`✈ Departure from country — ${ev.lbl}`;dot='orange';}
    return`<div class="tl-item"><div><div class="tl-dot tl-dot-${dot}"></div>${!isLast?'<div class="tl-line"></div>':''}</div><div><div class="tl-lbl">${lbl}</div><div class="tl-val">${fmtFull(ev.date)}${ev.extra||''}</div></div></div>`;
  }).join('');
}

function showCampDetail(idx){
  const c=CAMPS[idx];if(!c)return;
  document.querySelectorAll('tr.clickable-row').forEach(r=>r.classList.remove('selected'));
  const row=document.querySelector(`tr[data-idx="${idx}"]`);if(row)row.classList.add('selected');
  const isFree=c.fee&&(c.fee.startsWith('0 ')||c.fee==='0');
  const campDays=c.cs&&c.ce?Math.round((c.ce-c.cs)/86400000)+1:null;
  const totalDays=c.arrival&&c.departure?Math.round((c.departure-c.arrival)/86400000)+1:null;
  const det=c.detail||null;
  document.getElementById('md-continent').textContent=c.continent;
  document.getElementById('md-title').textContent=c.camp_name;
  document.getElementById('md-country').innerHTML=`🗺️ &nbsp;${c.country}${c.state?' <span style="color:var(--muted);font-size:11px">— '+c.state+'</span>':''}`;
  const encLoc=det&&det.location?encodeURIComponent(det.location):'';

  const secLocation=det&&det.location?`
    <div class="modal-section full">
      <div class="ms-title">📍 Location</div>
      <a class="ms-link" href="https://www.google.com/maps/search/?api=1&query=${encLoc}" target="_blank" rel="noopener">📍 ${det.location} ↗</a>
    </div>`:'';

  const secDesc=det&&det.description?`
    <div class="modal-section full">
      <div class="ms-title">🏕 Camp Activities</div>
      <div class="ms-desc">${det.description}</div>
    </div>`:'';

  const secHfa=det&&det.host_family_activities?`
    <div class="modal-section full">
      <div class="ms-title">🏠 Host Family Activities</div>
      <div class="ms-desc">${det.host_family_activities}</div>
    </div>`:'';

  const hasLang=det&&det.languages&&det.languages.length;
  const hasLinks=det&&(det.website||det.yce_url);
  const hasContact=det&&(det.contact_email||det.contact_name||det.contact_phone||det.application_deadline);

  const secLang=hasLang?`
    <div class="modal-section ${!hasLinks&&!hasContact?'full':''}">
      <div class="ms-title">🗣 Languages</div>
      <div style="margin-top:4px">${det.languages.map(l=>`<span class="ms-tag">${l}</span>`).join('')}</div>
    </div>`:'';

  const secLinks=hasLinks?`
    <div class="modal-section ${!hasLang&&!hasContact?'full':''}">
      <div class="ms-title">🔗 Links</div>
      ${det.website?`<div class="ms-row" style="margin-bottom:6px"><span class="ms-lbl">Website</span><a class="ms-link" href="${det.website}" target="_blank" rel="noopener">${det.website.replace(/^https?:\/\//,'')}</a></div>`:''}
      ${det.yce_url?`<div class="ms-row"><span class="ms-lbl">YCE Page</span><a class="ms-link" href="${det.yce_url}" target="_blank" rel="noopener">lions-yce-belgium.be ↗</a></div>`:''}
    </div>`:'';

  const secContact=hasContact?`
    <div class="modal-section full">
      <div class="ms-title">📬 Contact</div>
      ${det.contact_name?`<div class="ms-row"><span class="ms-lbl">Name</span><span class="ms-val">${det.contact_name}</span></div>`:''}
      ${det.contact_email?`<div class="ms-row"><span class="ms-lbl">Email</span><a class="ms-link" href="mailto:${det.contact_email}">${det.contact_email}</a></div>`:''}
      ${det.contact_phone?`<div class="ms-row"><span class="ms-lbl">Phone</span><span class="ms-val">${det.contact_phone}</span></div>`:''}
      ${det.application_deadline?`<div class="ms-row"><span class="ms-lbl">Deadline</span><span class="ms-val orange">${fmtDate(det.application_deadline)}</span></div>`:''}
    </div>`:'';

  const secNoDetail=!det?`<div class="modal-section full"><div class="ms-title">ℹ️ Camp Details</div><div class="ms-no-detail">Detailed information not yet available for this camp.</div></div>`:'';

  document.getElementById('md-body').innerHTML=`
    <div class="modal-section">
      <div class="ms-title">👤 Age Requirements</div>
      <div class="ms-row"><span class="ms-lbl">Eligible ages</span><span class="ms-val big">${c.age_requirements}</span></div>
    </div>
    <div class="modal-section">
      <div class="ms-title">💰 Participation Fee</div>
      <div class="ms-row"><span class="ms-lbl">Amount</span><span class="ms-val big ${isFree?'free':''}">${isFree?'FREE':(c.fee||'—')}</span></div>
    </div>
    ${secLocation}${secDesc}${secHfa}${secLang}${secLinks}${secContact}${secNoDetail}
    <div class="modal-section full">
      <div class="ms-title">📅 Complete Timeline</div>
      <div class="modal-timeline">${buildTimeline(c,campDays)}</div>
    </div>
    <div class="modal-section">
      <div class="ms-title">🏕 Camp Period</div>
      <div class="ms-row"><span class="ms-lbl">Start</span><span class="ms-val blue">${fmtFull(c.cs)}</span></div>
      <div class="ms-row"><span class="ms-lbl">End</span><span class="ms-val blue">${fmtFull(c.ce)}</span></div>
      ${campDays?`<div class="ms-row"><span class="ms-lbl">Duration</span><span class="ms-val">${campDays} days</span></div>`:''}
    </div>
    <div class="modal-section">
      <div class="ms-title">🏠 Family Stay</div>
      ${c.fs?`<div class="ms-row"><span class="ms-lbl">Start</span><span class="ms-val">${fmtFull(c.fs)}</span></div><div class="ms-row"><span class="ms-lbl">End</span><span class="ms-val">${fmtFull(c.fe)}</span></div>`
      :'<div style="color:var(--muted);font-size:11px;font-style:italic">No family stay information</div>'}
    </div>
    <div class="modal-section full" style="background:rgba(255,183,77,0.06);border-color:rgba(255,183,77,0.25);">
      <div class="ms-title" style="color:var(--orange)">✈ Total Presence in Country</div>
      <div class="ms-row"><span class="ms-lbl">Arrival</span><span class="ms-val orange">${fmtFull(c.arrival)}</span></div>
      <div class="ms-row"><span class="ms-lbl">Departure</span><span class="ms-val orange">${fmtFull(c.departure)}</span></div>
      ${totalDays?`<div class="ms-row"><span class="ms-lbl">Total stay</span><span class="ms-val orange">${totalDays} days in country</span></div>`:''}
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
