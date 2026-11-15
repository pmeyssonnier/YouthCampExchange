// camps-import.js — import du répertoire YCE officiel (xlsx) dans l'onglet Camps : lecture de la feuille, revue des changements
// (mises à jour, nouveaux camps, camps renommés, anciens camps à archiver) et application. La revue sert aussi aux coordonnées (camps-geo.js).
// Chargé par yce_admin.html après js/camps-manager.js et js/camps-match.js ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- import du répertoire officiel (xlsx) --------------------
function colIdx(ref){let c=0;const m=ref.match(/^[A-Z]+/)[0];
  for(let i=0;i<m.length;i++)c=c*26+m.charCodeAt(i)-64;return c-1;}
function serialToDmy(n){ // numéro de série Excel -> dd-mm-yyyy
  const d=new Date(Date.UTC(1899,11,30)+n*86400000);
  return String(d.getUTCDate()).padStart(2,"0")+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+d.getUTCFullYear();}
function mdyToDmy(v){ // MM-DD-YYYY (ou MM/DD/YYYY) -> dd-mm-yyyy ; série Excel acceptée ; date impossible -> null
  if(v==null||v==="")return null;
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if(m){const r=m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0")+"-"+m[3];return validDmy(r)?r:null;}
  if(/^\d+(\.\d+)?$/.test(s)&&+s>20000&&+s<70000)return serialToDmy(+s);
  return null;
}
// Le classeur est lu avec l'analyseur XML du navigateur (DOMParser), pas avec des expressions régulières :
// attributs dans n'importe quel ordre, préfixes d'espace de noms, entités et sections CDATA sont donc gérés par l'analyseur.
function xmlDoc(text,what){
  const d=new DOMParser().parseFromString(text,"application/xml");
  if(d.getElementsByTagName("parsererror").length)throw new Error(what+" is damaged (not valid XML)");
  return d;
}
function xmlEls(node,name){return Array.prototype.slice.call(node.getElementsByTagNameNS("*",name));}
// texte d'une cellule ou d'une chaîne partagée : tous les <t>, sauf ceux des guides phonétiques (<rPh>)
function xmlText(node){
  return xmlEls(node,"t").filter(function(t){return !(t.parentNode&&t.parentNode.localName==="rPh");}).map(function(t){return t.textContent;}).join("");
}
async function parseDirectory(buf){
  const entries=await unzip(buf);
  const td=new TextDecoder();
  const part=function(n){const e=entries.find(function(x){return x.name===n;});return e?td.decode(e.data):null;};
  const wbX=part("xl/workbook.xml");
  if(!wbX)throw new Error("not an Excel workbook (.xlsx): the workbook part is missing");
  // feuille "Approved Camps" via workbook + rels (repli : première feuille)
  const relsX=part("xl/_rels/workbook.xml.rels");
  const targets={};
  if(relsX)xmlEls(xmlDoc(relsX,"the workbook relations"),"Relationship").forEach(function(r){
    const t=r.getAttribute("Target")||"";
    targets[r.getAttribute("Id")]=t.charAt(0)==="/"?t.slice(1):"xl/"+t.replace(/^xl\//,"");});
  const sheets=xmlEls(xmlDoc(wbX,"the workbook"),"sheet").map(function(sh){
    const rid=sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id")||sh.getAttribute("r:id");
    return {name:sh.getAttribute("name")||"",path:targets[rid]||null};});
  if(!sheets.length)throw new Error("no worksheet found in the workbook");
  const sheet=sheets.find(function(x){return /approved\s*camps/i.test(x.name);})||sheets[0];
  const sx=sheet.path?part(sheet.path):null;
  if(sx==null)throw new Error("the sheet “"+sheet.name+"” is listed in the workbook but its content is missing from the file"
    +(sheet.path?" ("+sheet.path+")":"")+" — open the file in Excel and save it again as .xlsx");
  const ss=part("xl/sharedStrings.xml");
  const sst=ss?xmlEls(xmlDoc(ss,"the text table of the workbook"),"si").map(xmlText):[];
  const rows=[];let seq=0; // chaque ligne garde son vrai numéro Excel (rowNum) : les lignes vides ne décalent pas le rapport
  xmlEls(xmlDoc(sx,"the sheet “"+sheet.name+"”"),"row").forEach(function(row){
    const cells=[];let next=0;
    seq=+row.getAttribute("r")||seq+1;cells.rowNum=seq;
    xmlEls(row,"c").forEach(function(c){
      const ref=c.getAttribute("r"),type=c.getAttribute("t");
      const idx=ref&&/^[A-Z]+/.test(ref)?colIdx(ref):next; // cellule sans référence : colonne suivante
      next=idx+1;
      let v=null;
      if(type==="inlineStr")v=xmlText(c);
      else{const ve=xmlEls(c,"v")[0];
        if(ve)v=type==="s"?sst[+ve.textContent]:ve.textContent;}
      if(v!=null&&String(v).trim()!=="")cells[idx]=String(v).trim();
    });
    if(cells.length)rows.push(cells);
  });
  return rows;
}
// -------------------- continent d'un pays --------------------
// Un nouveau camp reprend le continent d'un camp déjà connu du même pays (actif ou archivé), sinon celui de cette table
// (découpage YCE : « Middle America » = Mexique, Amérique centrale et Caraïbes). Pays inconnu : "" — la revue demande alors le continent.
const COUNTRY_CONTINENT=(function(){
  const t={
    "Africa":"Algeria,Angola,Benin,Botswana,Burkina Faso,Cameroon,Congo,Egypt,Ethiopia,Gabon,Ghana,Ivory Coast,Cote d'Ivoire,Kenya,Madagascar,Malawi,Mali,Mauritius,Morocco,Mozambique,Namibia,Nigeria,Rwanda,Senegal,South Africa,Tanzania,Togo,Tunisia,Uganda,Zambia,Zimbabwe",
    "Asia":"Bangladesh,Cambodia,China,Hong Kong,India,Indonesia,Israel,Japan,Jordan,Kazakhstan,Korea,South Korea,Republic of Korea,Lebanon,Macau,Malaysia,Mongolia,Nepal,Pakistan,Philippines,Singapore,Sri Lanka,Taiwan,Thailand,United Arab Emirates,Vietnam",
    "Europe":"Albania,Armenia,Austria,Azerbaijan,Belarus,Belgium,Bosnia and Herzegovina,Bulgaria,Croatia,Cyprus,Czech Republic,Czechia,Czech rep. and Slovakia,Denmark,Estonia,Faroe Islands,Finland,France,Georgia,Germany,Greece,Hungary,Iceland,Ireland,Italy,Kosovo,Latvia,Liechtenstein,Lithuania,Luxembourg,Malta,Moldova,Monaco,Montenegro,Netherlands,North Macedonia,Norway,Poland,Portugal,Romania,Russia,San Marino,Serbia,Slovakia,Slovenia,Spain,Sweden,Switzerland,Turkey,Türkiye,Ukraine,United Kingdom,UK,England,Scotland,Wales",
    "Middle America":"Bahamas,Barbados,Belize,Costa Rica,Cuba,Dominican Republic,El Salvador,Guatemala,Haiti,Honduras,Jamaica,Mexico,Nicaragua,Panama,Puerto Rico,Trinidad and Tobago",
    "North America":"Canada,United States,USA,United States of America",
    "Oceania":"Australia,Fiji,New Zealand,Papua New Guinea",
    "South America":"Argentina,Bolivia,Brazil,Chile,Colombia,Ecuador,Paraguay,Peru,Suriname,Uruguay,Venezuela"};
  const out={};
  Object.keys(t).forEach(function(k){t[k].split(",").forEach(function(c){out[simple(c)]=k;});});
  return out;
})();
function continentFor(country){
  const key=simple(country);if(!key)return "";
  const ex=CAMPS_W.concat(ARCH).find(function(c){return simple(c.country)===key&&CONTINENTS.indexOf(c.continent)>=0;});
  return ex?ex.continent:(COUNTRY_CONTINENT[key]||"");
}
function feeOf(fee,cur){
  if(!fee)return null;
  cur=(cur||"").trim();
  if(/^euros?$/i.test(cur))cur="EURO";
  if(/[a-z]/i.test(fee))return fee;      // le montant contient déjà sa devise
  return cur?fee+" "+cur:fee;
}
async function dirPick(inp){
  const f=inp.files[0];if(!f)return;
  try{
    zipCheckSize(f);
    const rows=await parseDirectory(await f.arrayBuffer());
    if(rows.length<2)throw new Error("empty sheet");
    const hdr=rows[0].map(function(h){return String(h||"").toLowerCase();});
    const col=function(part){for(let i=0;i<hdr.length;i++)if(hdr[i]&&hdr[i].indexOf(part)>=0)return i;return -1;};
    const C={country:col("country"),name:col("camp name"),first:col("first name"),last:col("last name"),
      email:col("email"),phone:col("phone"),deadline:col("deadline"),ages:col("age"),
      participants:col("participants"),langs:col("language"),fee:col("fees"),cur:col("currency"),
      fs:col("family stay dates (month/day/year) start"),fe:col("family stay dates (month/day/year) end"),
      hfa:col("host family activities"),web:col("website"),loc:col("location"),
      cs:col("camp start"),ce:col("camp end"),act:col("activities will include")};
    if(C.name<0||C.country<0||C.cs<0)throw new Error("not a YCE directory (missing columns)");
    // Rapport de lecture : chaque ligne non vide est comptée (read) puis acceptée, ou rejetée avec sa raison — jamais écartée en silence.
    const items=[],rep={file:f.name,read:0,rejected:[],remarks:[]},seen={};
    rows.slice(1).forEach(function(r,ri){
      const g=function(i){return i>=0&&r[i]!=null?String(r[i]).trim():null;};
      const row=r.rowNum||ri+2,name=g(C.name),country=g(C.country),rawCs=g(C.cs);
      if(!name&&!country&&!rawCs)return; // ligne vide (ou note en bas de feuille)
      rep.read++;
      const reject=function(why){rep.rejected.push({row:row,name:name||"(no camp name)",country:country,why:why});};
      if(!name)return reject("the camp name is empty");
      if(!country)return reject("the country is empty");
      const cs=mdyToDmy(rawCs);
      if(!cs)return reject(rawCs?"camp start “"+rawCs+"” is not a date (expected month/day/year, e.g. 07/15/2027)":"no camp start date");
      // date facultative illisible : la ligne reste acceptée, la valeur n'est pas reprise (remarque dans le rapport)
      const opt=function(i,label){const raw=g(i),v=mdyToDmy(raw);
        if(raw&&!v)rep.remarks.push({row:row,name:name,country:country,why:label+" “"+raw+"” is not a date: not imported"});return v;};
      const ce=opt(C.ce,"camp end"),fs=opt(C.fs,"family stay start"),fe=opt(C.fe,"family stay end"),deadline=opt(C.deadline,"deadline");
      if(ce&&dmyKey(ce)<dmyKey(cs))return reject("camp end "+ce+" is before camp start "+cs);
      if(fs&&fe&&dmyKey(fe)<dmyKey(fs))return reject("family stay end "+fe+" is before its start "+fs);
      const key=simple(country)+"|"+simple(name)+"|"+cs;
      if(seen[key])return reject("same camp as row "+seen[key]+" (same country, name and start date)");
      seen[key]=row;
      const langs=(g(C.langs)||"").split(/[,;\/]| and /).map(function(x){return x.trim();}).filter(Boolean);
      items.push({row:row,country:country,name:name,cs:cs,ce:ce,fs:fs,fe:fe,deadline:deadline,
        ages:g(C.ages),participants:g(C.participants),fee:feeOf(g(C.fee),g(C.cur)),
        hfa:g(C.hfa),website:g(C.web),location:g(C.loc),activities:g(C.act),langs:langs,
        cname:[g(C.first),g(C.last)].filter(Boolean).join(" ")||null,cemail:g(C.email),cphone:g(C.phone)});
    });
    buildReview(f.name,items,rep);
  }catch(e){log("Directory import failed: "+esc(e.message),"err");}
  finally{inp.value="";}
}
function changesFor(c,t){ // champs à mettre à jour (une valeur vide du répertoire n'écrase jamais)
  const det=c.detail||{};
  const out=[];
  const chk=function(scope,field,val,label){
    if(val==null)return;
    const old=scope==="top"?c[field]:det[field];
    const ov=Array.isArray(old)?old.join(", "):old;
    const nv=Array.isArray(val)?val.join(", "):val;
    if(String(ov==null?"":ov)!==String(nv))out.push({scope:scope,field:field,val:val,label:label,old:ov==null?"":ov});
  };
  chk("top","camp_starts",t.cs,"camp start");chk("top","camp_ends",t.ce,"camp end");
  chk("top","family_stay_starts",t.fs,"family start");chk("top","family_stay_ends",t.fe,"family end");
  chk("top","age_requirements",t.ages,"ages");chk("top","fee",t.fee,"fee");
  chk("det","application_deadline",t.deadline,"deadline");chk("det","participants",t.participants,"capacity");
  chk("det","host_family_activities",t.hfa,"host family");chk("det","website",t.website,"website");
  chk("det","location",t.location,"location");chk("det","description",t.activities,"activities");
  chk("det","languages",t.langs&&t.langs.length?t.langs:null,"languages");
  chk("det","contact_name",t.cname,"contact");chk("det","contact_email",t.cemail,"contact e-mail");
  chk("det","contact_phone",t.cphone,"contact phone");
  return out;
}
// nouveau camp du répertoire : ancien camp actif qu'il pourrait remplacer (même pays, saison précédente),
// repéré par le même contact, un lieu ou un nom proche, ou parce que c'est le seul du pays.
// Simple proposition : l'archivage reste une case à cocher.
function replacesFor(t){
  const ns=seasonOf({camp_starts:t.cs});if(!ns)return null;
  const olds=[];
  CAMPS_W.forEach(function(c,i){const s=seasonOf(c);if(simple(c.country)===simple(t.country)&&s&&s<ns)olds.push(i);});
  let best=-1,bs=0,why="";
  olds.forEach(function(i){
    const c=CAMPS_W[i],d=c.detail||{};
    let sc,w;
    if(t.cemail&&d.contact_email&&simple(t.cemail)===simple(d.contact_email)){sc=2;w="same contact";}
    else{
      const l=t.location&&d.location?sim(stripNoise(d.location),stripNoise(t.location)):0;
      const n=sim(stripNoise(c.camp_name),stripNoise(t.name));
      sc=Math.max(l,n);w=l>=n?"similar location":"similar name";
    }
    if(sc>bs){bs=sc;best=i;why=w;}
  });
  if(best>=0&&bs>=0.5)return {camp:CAMPS_W[best],why:why};
  if(olds.length===1)return {camp:CAMPS_W[olds[0]],why:"only earlier camp in "+t.country};
  return null;
}
// -------------------- rapport d'import --------------------
// IMPORT : rapport du répertoire en cours de revue {file, read, rejected[], remarks[], updates, news, unchanged, archived} ; null pour les coordonnées.
let IMPORT=null;
function reportLines(list){return list.map(function(x){return (x.row?"row "+x.row+" \u00b7 ":"")+esc(x.country||"?")+" \u2014 "+esc(x.name)+": "+esc(x.why);}).join("<br>");}
function hideReport(){const b=document.getElementById("imp-report");if(b)b.style.display="none";}
// rep : rapport de lecture de dirPick ; absent quand la revue est construite directement (tests) : toutes les lignes sont alors « lues »
function buildReview(fname,items,rep){
  if(!rep||Array.isArray(rep))rep={read:items.length+(rep?rep.length:0),rejected:rep||[],remarks:[]};
  rep.file=fname;hideReport();
  const rev=[];let unchanged=0,archived=0;
  for(const t of items){
    const m=matchCamp(CAMPS_W,t);
    const hit=m?m.idx:-1,how=m?m.how:"";
    // camp archivé : ni proposé, ni affiché (« Restore » dans l'onglet Archived pour le reprendre)
    if(hit<0&&matchCamp(ARCH,t)){archived++;continue;}
    if(hit>=0){
      const chg=changesFor(CAMPS_W[hit],t);
      // camp reconnu sous un autre nom (pas une simple différence de casse ou de ponctuation) : le nouveau nom est proposé
      const rename=simple(CAMPS_W[hit].camp_name)!==simple(t.name);
      if(!chg.length&&!rename){unchanged++;continue;}
      rev.push({kind:"update",camp:CAMPS_W[hit],how:how,t:t,chg:chg,rename:rename,on:how==="exact",pct:how==="exact"?100:likeness(factsOf(CAMPS_W[hit]),factsOfT(t))});
    }else rev.push({kind:"new",t:t,on:true,rep:replacesFor(t),cont:continentFor(t.country)});
  }
  REVIEW=rev;
  rep.updates=rev.filter(function(r){return r.kind==="update";}).length;rep.news=rev.length-rep.updates;
  rep.unchanged=unchanged;rep.archived=archived;IMPORT=rep;
  document.getElementById("rev-note").textContent=fname+" — "
    +rev.filter(function(r){return r.kind==="update";}).length+" update(s), "
    +rev.filter(function(r){return r.kind==="new";}).length+" new camp(s), "+unchanged+" unchanged"
    +(archived?", "+archived+" archived (left out — restore them from the Archived tab if needed)":"");
  document.getElementById("rev-body").innerHTML=rev.length?rev.map(function(r,i){
    const tag=r.kind==="new"?'<span class="rev-tag t-new">NEW</span>'
      :(r.how==="exact"?'<span class="rev-tag t-upd">UPDATE</span>':'<span class="rev-tag t-fuz">UPDATE? '+r.pct+" % · "+esc(r.how)+"</span>");
    const what=r.kind==="new"
      ?"<b>"+esc(r.t.country)+" — "+esc(r.t.name)+"</b><div class='chg'>camp "+esc(r.t.cs)+" → "+esc(r.t.ce||"?")+" · "+esc(r.t.ages||"")+" · "+esc(r.t.fee||"")+"</div>"
        +(r.rep?'<label class="rev-rep"><input type="checkbox" id="rva-'+i+'"> may replace <b>'+esc(r.rep.camp.camp_name)+"</b> ("
          +esc(seasonOf(r.rep.camp))+", "+esc(r.rep.why)+") — archive the old camp</label>":"")
        +(r.cont?"":'<label class="rev-rep rev-cont">⚠ Country not known to the site — continent: <select id="rvc-'+i+'"><option value="">— choose —</option>'
          +CONTINENTS.map(function(x){return "<option>"+x+"</option>";}).join("")+"</select></label>")
      :"<b>"+esc(r.camp.camp_name)+"</b> ⇐ "+esc(r.t.name)
        +"<div class='chg'>"+r.chg.map(function(x){return esc(x.label)+": "+esc(String(x.old).slice(0,30)||"∅")+" → "+esc(String(Array.isArray(x.val)?x.val.join(", "):x.val).slice(0,40));}).join(" · ")+"</div>"
        +(r.rename?'<label class="rev-rep"><input type="checkbox" id="rvn-'+i+'" checked> rename the camp to <b>'+esc(r.t.name)+"</b> (untick to keep the current name)</label>":"");
    return '<div class="rev-row"><input type="checkbox" id="rv-'+i+'"'+(r.on?" checked":"")+"> "+tag+'<div class="rev-what">'+what+"</div></div>";
  }).join(""):'<span class="hint">Everything already matches the directory — nothing to apply.</span>';
  // bilan de lecture en tête de revue : lus = à revoir + ignorés + rejetés
  const ign=unchanged+archived,rj=rep.rejected.length;
  if(rj)document.getElementById("rev-note").textContent+=" — ⚠ "+rj+" rejected";
  document.getElementById("rev-body").insertAdjacentHTML("afterbegin",'<div class="rev-sum'+(rj||rep.remarks.length?" rev-skip":"")+'"><div class="rev-what"><b>'
    +rep.read+" line(s) read</b> — "+rev.length+" to review below ("+rep.updates+" update(s), "+rep.news+" new), "
    +ign+" ignored ("+unchanged+" unchanged, "+archived+" already archived), <b>"+rj+" rejected</b>"
    +(rj?"<div class='chg'><b>Rejected</b> — correct them in the file and import it again, or add these camps by hand:<br>"+reportLines(rep.rejected)+"</div>":"")
    +(rep.remarks.length?"<div class='chg'><b>Accepted with a remark:</b><br>"+reportLines(rep.remarks)+"</div>":"")
    +"</div></div>");
  if(rj)log(rj+" line(s) of the directory rejected: "+rep.rejected.map(function(x){return esc(x.name)+" ("+esc(x.why)+")";}).join("; "),"warn");
  document.getElementById("review").style.display="";
  document.getElementById("review").scrollIntoView({behavior:"smooth",block:"start"});
  log("Directory read: "+rep.read+" line(s) \u2014 "+rev.length+" to review, "+ign+" ignored, "+rj+" rejected. Nothing is changed until \u201cApply selected\u201d.","ok");
}
function applyReview(){
  if(!REVIEW)return;
  // nouveau camp d'un pays inconnu du site : le continent doit être choisi (plus de classement en Europe par défaut)
  const noCont=REVIEW.filter(function(r,i){const sel=document.getElementById("rvc-"+i);
    return r.kind==="new"&&!r.cont&&document.getElementById("rv-"+i).checked&&!(sel&&sel.value);});
  if(noCont.length){log("Choose the continent of: "+noCont.map(function(r){return esc(r.t.country)+" — "+esc(r.t.name);}).join("; ")+" (or untick these lines). Nothing was applied.","err");return;}
  // Transaction : tout ce qui est coché est appliqué, ou rien. En cas d'erreur en cours de route, la liste et l'archive
  // reprennent exactement leur état d'avant (mêmes objets, donc la fiche ouverte et la revue restent valables).
  const snap=snapshotCamps();
  let up=0,nw=0,gp=0,rn_count=0,unticked=0;const old=[],late=[];
  try{
    REVIEW.forEach(function(r,i){
      if(!document.getElementById("rv-"+i).checked){unticked++;return;}
      if(r.kind!=="new"&&CAMPS_W.indexOf(r.camp)<0){ // camp archivé ou supprimé depuis la lecture du fichier
        late.push({row:r.t&&r.t.row,name:r.camp.camp_name,country:r.camp.country,why:"the camp was archived or deleted after the file was read"});return;}
      if(r.kind==="geo"){
        const c=r.camp;c.detail=c.detail||{};c.detail.lat=r.q.lat;c.detail.lon=r.q.lon;
        const det={};DET_KEYS.forEach(function(k){if(k in c.detail)det[k]=c.detail[k];});c.detail=det;
        gp++;
      }else if(r.kind==="update"){
        const c=r.camp;
        r.chg.forEach(function(x){
          if(x.scope==="top")c[x.field]=x.val;
          else{c.detail=c.detail||{};c.detail[x.field]=x.val;}
        });
        if(c.detail){const det={};DET_KEYS.forEach(function(k){if(k in c.detail)det[k]=c.detail[k];});c.detail=det;}
        const rn=document.getElementById("rvn-"+i);
        if(r.rename&&rn&&rn.checked){c.camp_name=r.t.name;rn_count++;}
        checkCamp(c,false);
        up++;
      }else{
        const t=r.t,det={};
        [["location",t.location],["description",t.activities],["host_family_activities",t.hfa],
         ["languages",t.langs&&t.langs.length?t.langs:null],["website",t.website],
         ["application_deadline",t.deadline],["participants",t.participants],
         ["contact_name",t.cname],["contact_email",t.cemail],["contact_phone",t.cphone]]
          .forEach(function(p){if(p[1])det[p[0]]=p[1];});
        const sel=document.getElementById("rvc-"+i);
        const ra=document.getElementById("rva-"+i);
        if(r.rep&&ra&&ra.checked&&old.indexOf(r.rep.camp)<0)old.push(r.rep.camp);
        const nc={continent:r.cont||(sel&&sel.value)||continentFor(t.country),country:t.country,
          camp_name:t.name,age_requirements:t.ages||"",fee:t.fee,
          camp_starts:t.cs,camp_ends:t.ce,family_stay_starts:t.fs,family_stay_ends:t.fe,
          detail:det};
        checkCamp(nc,true);
        CAMPS_W.push(nc);
        nw++;
      }
    });
    // anciens camps remplacés : archivés comme avec le bouton 🗄 Archive (ils quittent le site public)
    old.forEach(function(c){const k=CAMPS_W.indexOf(c);if(k<0)return;CAMPS_W.splice(k,1);c.archived_on=today();ARCH.push(c);});
  }catch(e){
    restoreCamps(snap);render();
    log("Import cancelled — nothing was applied, the camp list is exactly as before: "+esc(e.message),"err");
    return;
  }
  const rep=IMPORT;
  cancelReview();
  if(late.length)log(late.length+" ticked line(s) rejected: the camp was archived or deleted after the file was read.","warn");
  if(gp&&!up&&!nw){log("Coordinates applied to "+gp+" camp(s). Review, then “Save to the site”.","ok");markDirty();render();return;}
  log("Directory applied: "+up+" camp(s) updated"+(rn_count?" ("+rn_count+" renamed)":"")+", "+nw+" created"+(old.length?", "+old.length+" replaced camp(s) archived":"")+". Review, then “Save to the site”.","ok");
  if(rep)showReport(rep,{up:up,rn:rn_count,nw:nw,arch:old.length,unticked:unticked,late:late});
  markDirty();render();
}
// état des camps avant une application : les objets eux-mêmes et leur contenu
function snapshotCamps(){
  const ser=function(l){return l.map(function(c){return JSON.stringify(c);});};
  return {list:CAMPS_W.slice(),data:ser(CAMPS_W),arch:ARCH.slice(),archData:ser(ARCH)};
}
function restoreCamps(s){
  const put=function(list,data){list.forEach(function(c,i){Object.keys(c).forEach(function(k){delete c[k];});Object.assign(c,JSON.parse(data[i]));});};
  put(s.list,s.data);put(s.arch,s.archData);
  CAMPS_W.length=0;s.list.forEach(function(c){CAMPS_W.push(c);});
  ARCH.length=0;s.arch.forEach(function(c){ARCH.push(c);});
}
// dernier contrôle d'un camp créé ou mis à jour par l'import : une anomalie annule toute l'application
function checkCamp(c,isNew){ // isNew : le continent n'est exigé que d'un camp créé (une fiche existante garde le sien, tel quel)
  const who="“"+(c.camp_name||"?")+"”";
  if(!c.camp_name||!c.country)throw new Error("a camp has no name or no country ("+who+")");
  if(isNew&&CONTINENTS.indexOf(c.continent)<0)throw new Error(who+" has no valid continent");
  [["camp_starts","camp start"],["camp_ends","camp end"],["family_stay_starts","family stay start"],["family_stay_ends","family stay end"]].forEach(function(p){
    if(c[p[0]]&&!validDmy(c[p[0]]))throw new Error(who+": "+p[1]+" “"+c[p[0]]+"” is not a valid date");});
  if(c.camp_starts&&c.camp_ends&&dmyKey(c.camp_ends)<dmyKey(c.camp_starts))throw new Error(who+": camp end is before camp start");
}
// rapport final, gardé à l'écran après l'application : lus = appliqués + ignorés + rejetés
function showReport(rep,res){
  const box=document.getElementById("imp-report");if(!box)return;
  const rej=rep.rejected.concat(res.late),applied=res.up+res.nw,ignored=rep.unchanged+rep.archived+res.unticked;
  document.getElementById("imp-report-note").textContent=rep.file;
  document.getElementById("imp-report-body").innerHTML='<div class="imp-nums">'
    +[["Read",rep.read,"lines of the directory"],["Applied",applied,res.up+" updated"+(res.rn?" ("+res.rn+" renamed)":"")+", "+res.nw+" created"],
      ["Ignored",ignored,rep.unchanged+" unchanged, "+rep.archived+" already archived, "+res.unticked+" not ticked"],["Rejected",rej.length,rej.length?"reasons below":"none"]]
      .map(function(x){return '<div class="imp-num'+(x[0]==="Rejected"&&x[1]?" bad":"")+'"><b>'+x[1]+"</b><span>"+x[0]+"</span><small>"+esc(x[2])+"</small></div>";}).join("")+"</div>"
    +(res.arch?'<p class="hint">'+res.arch+" earlier camp(s) replaced by a new one were moved to the archive.</p>":"")
    +(rej.length?'<div class="rev-row rev-skip"><div class="rev-what"><b>Rejected ('+rej.length+")</b><div class='chg'>"+reportLines(rej)+"</div></div></div>":"")
    +(rep.remarks.length?'<div class="rev-row"><div class="rev-what"><b>Accepted with a remark ('+rep.remarks.length+")</b><div class='chg'>"+reportLines(rep.remarks)+"</div></div></div>":"")
    +'<p class="hint">All ticked lines were applied together. Nothing is published until “Save to the site”.</p>';
  box.style.display="";
}
function cancelReview(){REVIEW=null;IMPORT=null;document.getElementById("review").style.display="none";}
