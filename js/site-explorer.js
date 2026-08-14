// site-explorer.js — annuaire des camps : filtres, tri, table, onglets
// Chargé par index.html ; scripts classiques partageant la portée globale.
let sortCol='continent',sortDir=1;
let selContinents=new Set(),selCountries=new Set();
let filterAge=null,periodType='none',periodRange=null;
const CONT_ORDER=['Africa','Asia','Europe','Middle America','North America','Oceania','South America'];
const CONT_COLORS={'Africa':'b-Africa','Asia':'b-Asia','Europe':'b-Europe','North America':'b-NorthAmerica','Middle America':'b-MiddleAmerica','Oceania':'b-Oceania','South America':'b-SouthAmerica'};

let selStates=new Set();

function renderStateList(){
  const stateCtries=['United States','Canada'];
  const base=selCountries.size>0
    ?CAMPS.filter(c=>selCountries.has(c.country)&&stateCtries.includes(c.country))
    :CAMPS.filter(c=>stateCtries.includes(c.country));
  const hasCtx=selCountries.size>0
    ?[...selCountries].some(c=>stateCtries.includes(c))
    :selContinents.size===0||[...selContinents].some(c=>c==='North America');
  const section=document.getElementById('state-section');
  const hr=document.getElementById('state-hr');
  if(!hasCtx||base.length===0){section.style.display='none';hr.style.display='none';selStates.clear();return;}
  const counts={};
  base.forEach(c=>{if(c.state)counts[c.state]=(counts[c.state]||0)+1;});
  const states=Object.keys(counts).sort();
  if(!states.length){section.style.display='none';hr.style.display='none';selStates.clear();return;}
  section.style.display='';hr.style.display='';
  document.getElementById('s-list').innerHTML=states.map(s=>
    `<div class="mitem ${selStates.has(s)?'on':''}" onclick="toggleState('${escQ(s)}')">
      <div class="chk ${selStates.has(s)?'on':''}">✓</div>
      <span>${s}</span><span class="mcount">${counts[s]}</span>
    </div>`
  ).join('');
}

function toggleState(s){
  if(selStates.has(s))selStates.delete(s);else selStates.add(s);
  renderStateList();applyFilters();
}

function getFiltered(){
  return CAMPS.filter(c=>{
    if(selContinents.size>0&&!selContinents.has(c.continent))return false;
    if(selCountries.size>0&&!selCountries.has(c.country))return false;
    if(selStates.size>0&&c.state&&!selStates.has(c.state))return false;
    if(filterAge!==null&&(filterAge<c.age_min||filterAge>c.age_max))return false;
    if(periodRange){const{start,end}=periodRange;if(!c.arrival||!c.departure||c.departure<start||c.arrival>end)return false;}
    return true;
  });
}

function getSorted(arr){
  return[...arr].sort((a,b)=>{
    const col=sortCol;let va=a[col],vb=b[col];
    if(col==='continent'){
      const ci=v=>CONT_ORDER.indexOf(v);
      if(ci(va)!==ci(vb))return(ci(va)-ci(vb))*sortDir;
      if(a.country!==b.country)return a.country.localeCompare(b.country)*sortDir;
      return a.camp_name.localeCompare(b.camp_name)*sortDir;
    }
    if(col==='country'){if(va!==vb)return va.localeCompare(vb)*sortDir;return a.camp_name.localeCompare(b.camp_name)*sortDir;}
    if(col==='fee_num'){va=a.fee_num;vb=b.fee_num;}
    else if(va instanceof Date&&vb instanceof Date){va=va?va.getTime():0;vb=vb?vb.getTime():0;}
    else if(typeof va==='string'&&typeof vb==='string')return va.localeCompare(vb)*sortDir;
    if(va==null)va=0;if(vb==null)vb=0;
    return(va-vb)*sortDir;
  });
}

function sortBy(col){
  if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=1;}
  document.querySelectorAll('th').forEach(th=>{th.classList.remove('asc','desc');if(th.dataset.c===col)th.classList.add(sortDir===1?'asc':'desc');});
  renderTable();
}

function renderTable(){
  const filtered=getSorted(getFiltered());
  const tbody=document.getElementById('tbody');
  document.getElementById('s-shown').textContent=filtered.length;
  document.getElementById('r-info').textContent=`${filtered.length} / ${CAMPS.length} camps`;
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="9" class="no-data">No camps match current filters</td></tr>`;return;}
  const isFreeStr=f=>f&&(f.startsWith('0 ')||f==='0');
  tbody.innerHTML=filtered.map(c=>{
    const bc=CONT_COLORS[c.continent]||'b-Asia';
    const feeHtml=isFreeStr(c.fee)?'<span class="fee-v free">FREE</span>':`<span class="fee-v">${c.fee||'—'}</span>`;
    const campPer=c.cs&&c.ce?`<span class="dt-accent">${fmtDate(c.camp_starts)}</span><br><span class="dt">${fmtDate(c.camp_ends)}</span>`:'—';
    const famPer=c.fs?`<span class="dt-accent">${fmtDate(c.family_stay_starts)}</span><br><span class="dt">${fmtDate(c.family_stay_ends)}</span>`:'<span class="dt">—</span>';
    const presPer=c.arrival&&c.departure?`<span style="color:var(--orange)">${fmtDate2(c.arrival)}</span><br><span class="dt">${fmtDate2(c.departure)}</span>`:'—';
    return`<tr class="clickable-row" data-idx="${c._idx}" onclick="showCampDetail(${c._idx})">
      <td><span class="badge ${bc}">${c.continent}</span></td>
      <td>${c.country}</td><td class="dt" style="font-size:10px;color:var(--blue)">${c.state||''}</td><td class="camp-nm">${c.camp_name}</td>
      <td>${c.age_requirements}</td><td>${feeHtml}</td>
      <td class="dt">${campPer}</td><td class="dt">${famPer}</td><td class="dt">${presPer}</td>
    </tr>`;
  }).join('');
}

function initContinentPills(){
  const counts={};CAMPS.forEach(c=>counts[c.continent]=(counts[c.continent]||0)+1);
  document.getElementById('cont-pills').innerHTML=CONT_ORDER.filter(ct=>counts[ct]).map(ct=>
    `<div class="pill" data-ct="${ct}" onclick="toggleContinent('${ct}')">${ct} <span style="opacity:0.6">${counts[ct]}</span></div>`
  ).join('');
}

function toggleContinent(ct){
  if(selContinents.has(ct))selContinents.delete(ct);else selContinents.add(ct);
  document.querySelectorAll('.pill[data-ct]').forEach(p=>p.classList.toggle('on',selContinents.has(p.dataset.ct)));
  selCountries.clear();renderCountryList();renderStateList();applyFilters();
}

function renderCountryList(){
  const srch=document.getElementById('c-srch').value.toLowerCase();
  const base=selContinents.size>0?CAMPS.filter(c=>selContinents.has(c.continent)):CAMPS;
  const counts={};base.forEach(c=>counts[c.country]=(counts[c.country]||0)+1);
  const countries=Object.keys(counts).sort().filter(c=>c.toLowerCase().includes(srch));
  const el=document.getElementById('c-list');
  if(!countries.length){el.innerHTML=`<div class="mitem" style="color:var(--muted)">No countries found</div>`;return;}
  el.innerHTML=countries.map(c=>
    `<div class="mitem ${selCountries.has(c)?'on':''}" onclick="toggleCountry('${escQ(c)}')">
      <div class="chk ${selCountries.has(c)?'on':''}">✓</div><span>${c}</span><span class="mcount">${counts[c]}</span>
    </div>`
  ).join('');
}

function toggleCountry(c){if(selCountries.has(c))selCountries.delete(c);else selCountries.add(c);renderCountryList();renderStateList();applyFilters();}

function setPeriodType(t){
  periodType=t;
  document.querySelectorAll('.ptab').forEach(p=>p.classList.toggle('on',p.dataset.t===t));
  const sel=document.getElementById('p-sel'),hint=document.getElementById('p-hint');
  if(t==='none'){sel.style.display='none';hint.style.display='none';periodRange=null;applyFilters();return;}
  sel.style.display='block';hint.style.display='block';populatePeriodSelect(t);
}

// bornes de la saison dérivées des données : du 1er mois d'arrivée au dernier mois de départ
const SEASON_RANGE=(function(){
  const arr=CAMPS.map(c=>c.arrival).filter(Boolean),dep=CAMPS.map(c=>c.departure).filter(Boolean);
  if(!arr.length)return{start:new Date(),end:new Date()};
  const min=new Date(Math.min(...arr)),max=new Date(Math.max(...dep));
  return{start:new Date(min.getFullYear(),min.getMonth(),1),end:new Date(max.getFullYear(),max.getMonth()+1,0)};
})();

function populatePeriodSelect(t){
  const MONTHS=[];
  for(let d=new Date(SEASON_RANGE.start);d<=SEASON_RANGE.end;d=new Date(d.getFullYear(),d.getMonth()+1,1)){
    let lbl=d.toLocaleDateString('fr-BE',{month:'long',year:'numeric'});
    lbl=lbl.charAt(0).toUpperCase()+lbl.slice(1);
    MONTHS.push({y:d.getFullYear(),m:d.getMonth(),lbl});
  }
  const sel=document.getElementById('p-sel');let opts=[];
  if(t==='month'){opts=MONTHS.map((m,i)=>({value:i,label:m.lbl,start:new Date(m.y,m.m,1),end:new Date(m.y,m.m+1,0)}));}
  else if(t==='qzn'){MONTHS.forEach(m=>{const d=new Date(m.y,m.m+1,0).getDate();opts.push({value:opts.length,label:`1–15 ${m.lbl}`,start:new Date(m.y,m.m,1),end:new Date(m.y,m.m,15)});opts.push({value:opts.length,label:`16–${d} ${m.lbl}`,start:new Date(m.y,m.m,16),end:new Date(m.y,m.m,d)});});}
  else if(t==='week'){let d=new Date(SEASON_RANGE.start);while(d<=SEASON_RANGE.end){const we=new Date(d);we.setDate(we.getDate()+6);opts.push({value:opts.length,label:`Sem. ${d.toLocaleDateString('fr-BE',{day:'2-digit',month:'short'})} – ${we.toLocaleDateString('fr-BE',{day:'2-digit',month:'short',year:'numeric'})}`,start:new Date(d),end:new Date(we)});d=new Date(d);d.setDate(d.getDate()+7);}}
  sel.innerHTML=opts.map(o=>`<option value="${o.value}">${o.label}</option>`).join('');
  sel._opts=opts;
  const today=new Date();const idx=opts.findIndex(o=>o.start<=today&&today<=o.end);
  sel.selectedIndex=idx>=0?idx:0;applyFilters();
}

function applyFilters(){
  const ageEl=document.getElementById('age-in');filterAge=ageEl.value?+ageEl.value:null;
  if(periodType!=='none'){const sel=document.getElementById('p-sel');const opts=sel._opts;if(opts&&opts.length){const o=opts[+sel.value];periodRange=o?{start:o.start,end:o.end}:null;}}
  else periodRange=null;
  renderTable();
}

function resetFilters(){
  selContinents.clear();selCountries.clear();selStates.clear();filterAge=null;periodType='none';periodRange=null;
  document.getElementById('age-in').value='';document.getElementById('c-srch').value='';
  document.querySelectorAll('.pill').forEach(p=>p.classList.remove('on'));
  setPeriodType('none');renderCountryList();renderStateList();renderTable();
}

function switchTab(id,btn){
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`tab-${id}`).classList.add('active');btn.classList.add('active');
  if(id==='map'&&!mapInited)initMap();
}

// jump from the Belgium section straight to the Belgian camp in the explorer
function focusBelgium(){
  resetFilters();
  selCountries.add('Belgium');renderCountryList();applyFilters();
  const first=CAMPS.find(c=>c.country==='Belgium');
  if(first)showCampDetail(first._idx);
}
