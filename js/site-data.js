// site-data.js — dates, enrichissement des camps (CAMPS), stats de la saison
// Chargé par index.html ; scripts classiques partageant la portée globale.
function parseDate(s){
  if(!s) return null;
  const p=s.toString().replace(/\//g,'-').split('-');
  if(p.length<3) return null;
  let d,m,y;
  if(p[0].length===4){[y,m,d]=p;}else{[d,m,y]=p;}
  const dt=new Date(+y,+m-1,+d);
  return isNaN(dt)?null:dt;
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
const escQ=s=>s.replace(/'/g,"\\'");

// dynamic stats — computed from data so they can never drift
(function(){
  const nC=CAMPS.length,nK=new Set(CAMPS.map(c=>c.country)).size,nT=new Set(CAMPS.map(c=>c.continent)).size;
  [['h-camps',nC],['h-countries',nK],['h-continents',nT],['s-total',nC],['f-camps',nC],['f-countries',nK]]
    .forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
  if(typeof SEASON!=='undefined')document.querySelectorAll('.season-lbl').forEach(el=>el.textContent=SEASON);
})();

const CONT_CAMP_COUNTS={},COUNTRY_CAMP_COUNTS={};
CAMPS.forEach(c=>{CONT_CAMP_COUNTS[c.continent]=(CONT_CAMP_COUNTS[c.continent]||0)+1;COUNTRY_CAMP_COUNTS[c.country]=(COUNTRY_CAMP_COUNTS[c.country]||0)+1;});
