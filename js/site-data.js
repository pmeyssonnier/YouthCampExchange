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
function fmtDate(s){const d=parseDate(s);if(!d)return'—';return d.toLocaleDateString('fr-BE',{day:'2-digit',month:'short',year:'numeric'});}
function fmtDate2(d){if(!d)return'—';return d.toLocaleDateString('fr-BE',{day:'2-digit',month:'short'});}
function fmtFull(d){if(!d)return'—';return d.toLocaleDateString('fr-BE',{weekday:'short',day:'2-digit',month:'long',year:'numeric'});}
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

const CAMPS=RAW.map((c,i)=>{
  const cs=parseDate(c.camp_starts),ce=parseDate(c.camp_ends);
  const fs=parseDate(c.family_stay_starts),fe=parseDate(c.family_stay_ends);
  const fs2=parseDate(c.family_stay2_starts),fe2=parseDate(c.family_stay2_ends); // deuxième séjour en famille (facultatif)
  const starts=[fs,cs,fs2].filter(Boolean),ends=[fe,ce,fe2].filter(Boolean);
  const arrival=starts.length?new Date(Math.min.apply(null,starts)):null;
  const departure=ends.length?new Date(Math.max.apply(null,ends)):null;
  const age=parseAge(c.age_requirements);
  const feeNum=c.fee?(parseFloat(c.fee.replace(/[^0-9.]/g,''))||0):0;
  // saison YCE : septembre à août — un camp de juillet 2026 appartient à 2025-2026
  const season=cs?((cs.getMonth()+1>=9)?cs.getFullYear()+'-'+(cs.getFullYear()+1):(cs.getFullYear()-1)+'-'+cs.getFullYear()):'';
  return{...c,_idx:i,cs,ce,fs,fe,fs2,fe2,arrival,departure,age_min:age.min,age_max:age.max,fee_num:feeNum,season};
});
// drapeau d'un pays (émoji à partir du code ISO) ; « Czech rep. and Slovakia » donne les deux drapeaux ; '' si le pays est inconnu
const COUNTRY_ISO={'Argentina':['AR'],'Australia':['AU'],'Austria':['AT'],'Bangladesh':['BD'],'Belgium':['BE'],'Brazil':['BR'],'Bulgaria':['BG'],'Canada':['CA'],'Croatia':['HR'],'Cyprus':['CY'],'Czech rep. and Slovakia':['CZ','SK'],'Czech Republic':['CZ'],'Denmark':['DK'],'Estonia':['EE'],'Finland':['FI'],'France':['FR'],'Germany':['DE'],'Greece':['GR'],'Hungary':['HU'],'Iceland':['IS'],'India':['IN'],'Indonesia':['ID'],'Ireland':['IE'],'Israel':['IL'],'Italy':['IT'],'Japan':['JP'],'Lithuania':['LT'],'Malaysia':['MY'],'Mexico':['MX'],'Namibia':['NA'],'Netherlands':['NL'],'North Macedonia':['MK'],'Norway':['NO'],'Poland':['PL'],'Portugal':['PT'],'Romania':['RO'],'Serbia':['RS'],'Slovakia':['SK'],'Slovenia':['SI'],'Spain':['ES'],'Sri Lanka':['LK'],'Sweden':['SE'],'Switzerland':['CH'],'Taiwan':['TW'],'Tunisia':['TN'],'Turkey':['TR'],'Ukraine':['UA'],'United Kingdom':['GB'],'United States':['US'],'USA':['US']};
function countryFlag(country){const cc=COUNTRY_ISO[country];return cc?cc.map(function(c){return String.fromCodePoint(0x1F1E6+c.charCodeAt(0)-65,0x1F1E6+c.charCodeAt(1)-65);}).join(''):'';}
function flagged(country){const f=countryFlag(country);return (f?f+'\u00A0':'')+esc(country); // espace insécable : le drapeau ne reste pas seul en bout de ligne}
// puces « type de camp » des listes : ♿ Inclusion et ❄ Winter (champs inclusive et winter)
function typeChips(c){return (c.inclusive?'<span class="cc-chip cc-incl">♿ Inclusion</span>':'')+(c.winter?'<span class="cc-chip cc-winter">❄ Winter</span>':'');}
// ── échappement : toute donnée de camp ou de configuration insérée en HTML passe par ici ──
// (les camps viennent en partie du répertoire international importé : contenu externe)
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// argument texte d'un gestionnaire onclick="f(…)" : littéral JSON, puis échappement HTML de l'attribut
function jsArg(s){return esc(JSON.stringify(String(s)));}
// lien cliquable : http(s) uniquement ; un domaine nu ("yce.lions.dk") est complété en https
function safeUrl(u){
  let s=String(u==null?'':u).trim();
  if(!s)return null;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(s)&&/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s))s='https://'+s;
  try{const x=new URL(s);return /^https?:$/.test(x.protocol)?x.href:null;}catch(e){return null;}
}
function safeMail(m){const s=String(m==null?'':m).trim();return /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(s)?s:null;}
// Numéro de téléphone : espacé selon le pays (indicatif international) + lien WhatsApp.
// Seuls les numéros avec indicatif (+CC… ou 00CC…) sont traités : sans indicatif, le pays est inconnu
// et le numéro reste tel qu'écrit, sans lien. Renvoie {text, wa} (wa = chiffres pour wa.me, ou null).
const PHONE_CC=[1,7,20,27,30,31,32,33,34,36,39,40,41,43,44,45,46,47,48,49,51,52,53,54,55,56,57,58,60,61,62,63,64,65,66,81,82,84,86,90,91,92,93,94,95,98,
  212,213,216,218,351,352,353,354,355,356,357,358,359,370,371,372,373,374,375,376,377,378,380,381,382,383,385,386,387,389,420,421,423,852,886,961,962,966,971,972,974];
const PHONE_GRP={1:[3,3,4],31:[1,4,4],32:[3,2,2,2],33:[1,2,2,2,2],34:[3,3,3],39:[3,3,4],41:[2,3,2,2],44:[4,6],45:[2,2,2,2],52:[3,3,4],55:[2,5,4],
  81:[2,4,4],90:[3,3,2,2],91:[5,5],94:[2,3,4],358:[2,3,4],421:[3,3,3]};
function phoneInfo(raw){
  const r=String(raw==null?'':raw).trim();
  let d=r.replace(/\(0\)/g,'').replace(/[^\d+]/g,'');
  if(d.indexOf('00')===0)d='+'+d.slice(2);
  if(d.charAt(0)!=='+'||!/^\+\d{8,15}$/.test(d))return{text:r,wa:null};
  d=d.slice(1);
  let cc=null;
  for(let n=1;n<=3&&!cc;n++){const c=+d.slice(0,n);if(d.slice(0,n).charAt(0)!=='0'&&PHONE_CC.indexOf(c)>=0)cc=String(c);}
  if(!cc)return{text:'+'+d,wa:d};
  const nat=d.slice(cc.length);
  let g=PHONE_GRP[cc];
  if(!g||g.reduce(function(a,b){return a+b;},0)!==nat.length){g=[];let left=nat.length;while(left>4){g.push(3);left-=3;}if(left)g.push(left);}
  const parts=[];let pos=0;g.forEach(function(n){parts.push(nat.substr(pos,n));pos+=n;});
  return{text:'+'+cc+' '+parts.join(' '),wa:d};
}
// HTML de personnalisation (SITE.*) : quelques balises de mise en forme, sans attributs ;
// liens limités à http(s)/mailto/tel/#ancre ; tout le reste devient du texte ou disparaît
const CLEAN_TAGS={STRONG:1,B:1,EM:1,I:1,U:1,BR:1,SPAN:1,SMALL:1,P:1,UL:1,OL:1,LI:1,A:1};
const DROP_TAGS={SCRIPT:1,STYLE:1,IFRAME:1,OBJECT:1,EMBED:1,TEMPLATE:1,SVG:1,MATH:1,NOSCRIPT:1,TEXTAREA:1,SELECT:1};
function cleanHtml(s){
  const t=document.createElement('template');t.innerHTML=String(s==null?'':s);
  (function walk(n){
    Array.from(n.childNodes).forEach(ch=>{
      if(ch.nodeType===3)return;
      if(ch.nodeType!==1||DROP_TAGS[ch.tagName]){ch.remove();return;}
      if(!CLEAN_TAGS[ch.tagName]){walk(ch);ch.replaceWith(...ch.childNodes);return;}
      const href=ch.tagName==='A'?(ch.getAttribute('href')||'').trim():'';
      Array.from(ch.attributes).forEach(a=>ch.removeAttribute(a.name));
      if(ch.tagName==='A'){
        const ok=safeUrl(href)||(/^(mailto:|tel:)[^\s"'<>]+$|^#[\w-]*$/i.test(href)?href:null);
        if(ok){ch.setAttribute('href',ok);if(/^https?:/i.test(ok)){ch.setAttribute('target','_blank');ch.setAttribute('rel','noopener');}}
      }
      walk(ch);
    });
  })(t.content);
  return t.innerHTML;
}

// dynamic stats — computed from data so they can never drift
(function(){
  const nC=CAMPS.length,nK=new Set(CAMPS.map(c=>c.country)).size,nT=new Set(CAMPS.map(c=>c.continent)).size;
  [['h-camps',nC],['h-countries',nK],['h-continents',nT],['s-total',nC],['f-camps',nC],['f-countries',nK]]
    .forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
  if(typeof SEASON!=='undefined')document.querySelectorAll('.season-lbl').forEach(el=>el.textContent=SEASON);
})();

const CONT_CAMP_COUNTS={},COUNTRY_CAMP_COUNTS={};
CAMPS.forEach(c=>{CONT_CAMP_COUNTS[c.continent]=(CONT_CAMP_COUNTS[c.continent]||0)+1;COUNTRY_CAMP_COUNTS[c.country]=(COUNTRY_CAMP_COUNTS[c.country]||0)+1;});
