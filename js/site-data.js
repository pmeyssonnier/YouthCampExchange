// site-data.js — dates, enrichissement des camps (CAMPS), stats de la saison
// Chargé par index.html ; scripts classiques partageant la portée globale.
function parseDate(s){
  if(!s) return null;
  const p=s.toString().replace(/\//g,'-').split('-');
  if(p.length<3) return null;
  let d,m,y;
  if(p[0].length===4){[y,m,d]=p;}else{[d,m,y]=p;}
  const dt=new Date(+y,+m-1,+d);
  // date réelle du calendrier uniquement : "31-02-2026" est refusée au lieu de devenir le 3 mars
  if(isNaN(dt)||dt.getFullYear()!==+y||dt.getMonth()!==+m-1||dt.getDate()!==+d)return null;
  return dt;
}
function fmtDate(s){const d=parseDate(s);if(!d)return'—';return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
function fmtDate2(d){if(!d)return'—';return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});}
function fmtFull(d){if(!d)return'—';return d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'long',year:'numeric'});}
function parseAge(s){
  if(!s)return{min:14,max:30};
  const nums=s.match(/\d+/g);
  if(!nums)return{min:14,max:30};
  if(nums.length===1)return{min:+nums[0],max:+nums[0]};
  const vals=nums.map(Number).sort((a,b)=>a-b);
  return{min:vals[0],max:vals[vals.length-1]};
}

// affichage uniforme des noms de camps : chaque mot avec capitale initiale.
// Les mots contenant un chiffre (29th, 118K, 2026) sont gardés tels quels,
// les sigles connus restent en capitales. Les données ne sont pas modifiées.
const NAME_ACRONYMS={yce:'YCE',md:'MD',lci:'LCI',usa:'USA',uk:'UK'};
function titleCase(s){
  if(!s)return s;
  return s.split(' ').map(w=>{
    if(/\d/.test(w))return w;
    const key=w.toLowerCase().replace(/[^a-z]/g,'');
    if(NAME_ACRONYMS[key])return w.replace(/[A-Za-z]+/,NAME_ACRONYMS[key]);
    return w.toLowerCase().replace(/(^|[-'’(/])(\p{L})/gu,(m,p,ch)=>p+ch.toUpperCase());
  }).join(' ');
}

// prix servant au tri : le montant en euros ("370 Euro Or 420 USD" → 370). « No camp fee » ou 0 → 0 ; sans prix → null (en dernier).
// Camps sans prix en euros : conversion indicative (USD 0,92 · CAD 0,67 · CHF 1,05 · GBP 1,15), uniquement pour l'ordre du tri.
const FEE_RATES={usd:0.92,cad:0.67,chf:1.05,gbp:1.15};
function feeEuro(f){
  if(!f)return null;
  const s=String(f);
  if(/\b(no camp fee|free|no fee)\b/i.test(s))return 0;
  const num=x=>parseFloat(String(x).replace(',','.'));
  let m=s.match(/(\d+(?:[.,]\d+)?)\s*(?:eur|euro|euros|€)/i)||s.match(/€\s*(\d+(?:[.,]\d+)?)/);
  if(m)return num(m[1]);
  m=s.match(/(\d+(?:[.,]\d+)?)\s*(usd|cad|chf|gbp)\b/i);
  if(m)return Math.round(num(m[1])*FEE_RATES[m[2].toLowerCase()]*100)/100;
  m=s.match(/\d+(?:[.,]\d+)?/);
  return m?num(m[0]):null;
}
const CAMPS=RAW.map((c,i)=>{
  const cs=parseDate(c.camp_starts),ce=parseDate(c.camp_ends);
  const fs=parseDate(c.family_stay_starts),fe=parseDate(c.family_stay_ends);
  const fs2=parseDate(c.family_stay2_starts),fe2=parseDate(c.family_stay2_ends); // deuxième séjour en famille (facultatif)
  const starts=[fs,cs,fs2].filter(Boolean),ends=[fe,ce,fe2].filter(Boolean);
  const arrival=starts.length?new Date(Math.min.apply(null,starts)):null;
  const departure=ends.length?new Date(Math.max.apply(null,ends)):null;
  const age=parseAge(c.age_requirements);
  const feeNum=feeEuro(c.fee);
  // saison YCE : septembre à août — un camp de juillet 2026 appartient à 2025-2026
  const season=cs?((cs.getMonth()+1>=9)?cs.getFullYear()+'-'+(cs.getFullYear()+1):(cs.getFullYear()-1)+'-'+cs.getFullYear()):'';
  return{...c,_idx:i,cs,ce,fs,fe,fs2,fe2,arrival,departure,age_min:age.min,age_max:age.max,fee_num:feeNum,season};
});
// drapeau d'un pays (émoji à partir du code ISO) ; « Czech rep. and Slovakia » donne les deux drapeaux ; '' si le pays est inconnu
const COUNTRY_ISO={'Argentina':['AR'],'Australia':['AU'],'Austria':['AT'],'Bangladesh':['BD'],'Belgium':['BE'],'Brazil':['BR'],'Bulgaria':['BG'],'Canada':['CA'],'Croatia':['HR'],'Cyprus':['CY'],'Czech rep. and Slovakia':['CZ','SK'],'Czech Republic':['CZ'],'Denmark':['DK'],'Estonia':['EE'],'Finland':['FI'],'France':['FR'],'Germany':['DE'],'Greece':['GR'],'Hungary':['HU'],'Iceland':['IS'],'India':['IN'],'Indonesia':['ID'],'Ireland':['IE'],'Israel':['IL'],'Italy':['IT'],'Japan':['JP'],'Lithuania':['LT'],'Malaysia':['MY'],'Mexico':['MX'],'Namibia':['NA'],'Netherlands':['NL'],'North Macedonia':['MK'],'Norway':['NO'],'Poland':['PL'],'Portugal':['PT'],'Romania':['RO'],'Serbia':['RS'],'Slovakia':['SK'],'Slovenia':['SI'],'Spain':['ES'],'Sri Lanka':['LK'],'Sweden':['SE'],'Switzerland':['CH'],'Taiwan':['TW'],'Tunisia':['TN'],'Turkey':['TR'],'Ukraine':['UA'],'United Kingdom':['GB'],'United States':['US'],'USA':['US']};
function countryFlag(country){const cc=COUNTRY_ISO[country];return cc?cc.map(function(c){return String.fromCodePoint(0x1F1E6+c.charCodeAt(0)-65,0x1F1E6+c.charCodeAt(1)-65);}).join(''):'';}
// espace insécable entre le drapeau et le nom : le drapeau ne reste pas seul en bout de ligne
function flagged(country){const f=countryFlag(country);return (f?f+'\u00A0':'')+esc(country);}
// puces « type de camp » des listes : ♿ Inclusion et ❄ Winter (champs inclusive et winter)
function typeChips(c){return (c.inclusive?'<span class="cc-chip cc-incl">♿ Inclusion</span>':'')+(c.winter?'<span class="cc-chip cc-winter">❄ Winter</span>':'');}
// la puce / le filtre « saison » n'ont de sens que si plusieurs saisons coexistent (camps de la saison précédente encore actifs)
const MULTI_SEASON=new Set(CAMPS.map(c=>c.season).filter(Boolean)).size>1;
// périodes d'un camp (accueil en famille, 2e accueil, camp), en lignes de dates classées par date de début
function periodRows(c){
  const rows=[];
  if(c.fs)rows.push({t:c.fs,o:0,l:'🏠 Family Stay',a:c.fs,b:c.fe});
  if(c.fs2)rows.push({t:c.fs2,o:1,l:'🏠 2nd Family Stay',a:c.fs2,b:c.fe2});
  if(c.cs)rows.push({t:c.cs,o:2,l:'🏕️ Camp',a:c.cs,b:c.ce});
  rows.sort((x,y)=>(x.t-y.t)||(x.o-y.o));
  return rows.map(r=>`<div class="cc-date-row"><span class="cc-date-lbl">${r.l}</span><span class="cc-date-val">${fmtDate2(r.a)} → ${fmtDate2(r.b)}</span></div>`).join('');
}
// ── échappement : toute donnée de camp ou de configuration insérée en HTML passe par ici ──
// (les camps viennent en partie du répertoire international importé : contenu externe)
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// argument texte d'un gestionnaire onclick="f(…)" : littéral JSON, puis échappement HTML de l'attribut
function jsArg(s){return esc(JSON.stringify(String(s)));}
function safeMail(m){const s=String(m==null?'':m).trim();return /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(s)?s:null;}
// HTML de personnalisation (SITE.*) : quelques balises de mise en forme, sans attributs ;
// dynamic stats — computed from data so they can never drift
(function(){
  const nC=CAMPS.length,nK=new Set(CAMPS.map(c=>c.country)).size,nT=new Set(CAMPS.map(c=>c.continent)).size;
  [['h-camps',nC],['h-countries',nK],['h-continents',nT],['s-total',nC],['f-camps',nC],['f-countries',nK]]
    .forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
  if(typeof SEASON!=='undefined')document.querySelectorAll('.season-lbl').forEach(el=>el.textContent=SEASON);
})();

const CONT_CAMP_COUNTS={},COUNTRY_CAMP_COUNTS={};
CAMPS.forEach(c=>{CONT_CAMP_COUNTS[c.continent]=(CONT_CAMP_COUNTS[c.continent]||0)+1;COUNTRY_CAMP_COUNTS[c.country]=(COUNTRY_CAMP_COUNTS[c.country]||0)+1;});
