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
  const arrival=fs&&cs?(fs<cs?fs:cs):(cs||fs);
  const departure=fe&&ce?(fe>ce?fe:ce):(ce||fe);
  const age=parseAge(c.age_requirements);
  const feeNum=c.fee?(parseFloat(c.fee.replace(/[^0-9.]/g,''))||0):0;
  // saison YCE : septembre à août — un camp de juillet 2026 appartient à 2025-2026
  const season=cs?((cs.getMonth()+1>=9)?cs.getFullYear()+'-'+(cs.getFullYear()+1):(cs.getFullYear()-1)+'-'+cs.getFullYear()):'';
  return{...c,_idx:i,cs,ce,fs,fe,arrival,departure,age_min:age.min,age_max:age.max,fee_num:feeNum,season};
});
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
