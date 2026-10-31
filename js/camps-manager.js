// camps-manager.js — gestionnaire de la liste des camps : import du répertoire YCE officiel (xlsx),
// édition des fiches, export/import JSON de sauvegarde, archivage, enregistrement vers le site.
// Onglet Camps de yce_admin.html ; chargé après camps_data.js, js/zip.js, js/xlsx.js et js/admin-core.js.
"use strict";
let CAMPS_W=RAW.map(function(c){return JSON.parse(JSON.stringify(c));}); // copie de travail
let ARCH=[];              // camps archivés (camps_archive.json)
let DIRTY=false, CONNECTED=false, VIEW="active", EDIT_I=-1, EDIT_NEW=false, REVIEW=null;
let SORT_K="country", SORT_D=1; // tri du tableau (clic sur les en-têtes)

const TOP_KEYS=["continent","country","state","district","camp_name","age_requirements","fee",
  "camp_starts","camp_ends","family_stay_starts","family_stay_ends","detail"];
const DET_KEYS=["location","description","host_family_activities","languages","website","yce_url",
  "application_deadline","participants","contact_name","contact_email","contact_phone"];
const CONTINENTS=["Africa","Asia","Europe","Middle America","North America","Oceania","South America"];

function markDirty(){DIRTY=true;document.getElementById("dirty").style.display="";updSave();}
function updSave(){document.getElementById("save-site").disabled=!(CONNECTED&&DIRTY);
  document.getElementById("save-site").title=CONNECTED?(DIRTY?"":"No changes to save"):"Connect first";}
function simple(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"");}
function seasonOf(c){const m=/(\d{4})$/.exec(c.camp_starts||"");if(!m)return "";
  const y=+m[1],mm=+(c.camp_starts||"").slice(3,5);return (mm>=9)?(y+"-"+(y+1)):((y-1)+"-"+y);}

// -------------------- liste --------------------
function dmyKey(s){ // dd-mm-yyyy -> clé triable yyyymmdd (vide en dernier)
  const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(s||"");
  return m?m[3]+m[2]+m[1]:"99999999";}
function setSort(k){
  if(SORT_K===k)SORT_D=-SORT_D;else{SORT_K=k;SORT_D=1;}
  render();}
function setView(v){VIEW=v;
  document.getElementById("tab-active").classList.toggle("on",v==="active");
  document.getElementById("tab-archived").classList.toggle("on",v==="archived");
  render();}
function render(){
  const q=simple(document.getElementById("q").value);
  const list=(VIEW==="active"?CAMPS_W:ARCH);
  const rows=list.map(function(c,i){c._i=i;return c;})
    .filter(function(c){return !q||simple(c.camp_name+c.country).indexOf(q)>=0;})
    .sort(function(a,b){
      const kf={
        country:function(c){return c.continent+"|"+c.country+"|"+simple(c.camp_name);},
        name:function(c){return simple(c.camp_name);},
        cs:function(c){return dmyKey(c.camp_starts);},
        fs:function(c){return dmyKey(c.family_stay_starts);},
        ages:function(c){const m=/\d+/.exec(c.age_requirements||"");return m?String(+m[0]).padStart(3,"0"):"999";},
        fee:function(c){const m=/[\d.]+/.exec(c.fee||"");return String(m?Math.round(+m[0]):999999).padStart(7,"0");},
        season:function(c){return seasonOf(c)||"zzz";}
      }[SORT_K]||function(c){return simple(c.camp_name);};
      const x=kf(a),y=kf(b);
      return (x<y?-1:x>y?1:0)*SORT_D;
    });
  const tb=document.getElementById("tbody");
  tb.innerHTML=rows.map(function(c){
    const sn=seasonOf(c), cur=sn==="2026-2027";
    const act=VIEW==="active"
      ?'<button class="btn2" onclick="openEdit('+c._i+')">✏ Edit</button> <button class="btn2" onclick="archiveCamp('+c._i+')">🗄 Archive</button>'
      :'<button class="btn2" onclick="restoreCamp('+c._i+')">↩ Restore</button> <button class="btn2 danger" onclick="deleteCamp('+c._i+')">✕ Delete</button>';
    return "<tr><td>"+esc(c.country)+"</td>"
      +'<td><span class="camp-nm">'+esc(c.camp_name)+"</span>"
      +(VIEW==="archived"&&c.archived_on?'<div class="sub">archived '+esc(c.archived_on)+"</div>":"")+"</td>"
      +'<td class="dt">'+esc(c.camp_starts||"—")+" → "+esc(c.camp_ends||"—")+"</td>"
      +'<td class="dt">'+esc(c.family_stay_starts||"—")+" → "+esc(c.family_stay_ends||"—")+"</td>"
      +"<td>"+esc(c.age_requirements||"—")+"</td><td>"+esc(c.fee||"—")+"</td>"
      +'<td><span class="season-b '+(cur?"s-new":"s-old")+'">'+(sn||"?")+"</span></td>"
      +'<td style="white-space:nowrap">'+act+"</td></tr>";
  }).join("");
  document.getElementById("empty").style.display=rows.length?"none":"";
  document.getElementById("tab-active").textContent="Active camps ("+CAMPS_W.length+")";
  document.getElementById("tab-archived").textContent="Archived ("+ARCH.length+")";
  document.getElementById("count").textContent=rows.length+" shown";
  document.querySelectorAll("th").forEach(function(t){t.classList.remove("asc","desc");});
  const th=document.getElementById("h-"+SORT_K);
  if(th)th.classList.add(SORT_D>0?"asc":"desc");
  updSave();
}

// -------------------- édition --------------------
function fldHtml(id,label,val,span,tag){
  span=span||"g2";
  if(tag==="textarea")return '<div class="fld '+span+'"><label class="flbl">'+label+'</label><textarea id="'+id+'">'+esc(val||"")+"</textarea></div>";
  if(tag==="continent"){return '<div class="fld '+span+'"><label class="flbl">'+label+'</label><select id="'+id+'">'
    +CONTINENTS.map(function(x){return '<option'+(x===val?" selected":"")+">"+x+"</option>";}).join("")+"</select></div>";}
  return '<div class="fld '+span+'"><label class="flbl">'+label+'</label><input id="'+id+'" value="'+esc(val||"")+'"></div>';
}
function openEdit(i){
  EDIT_I=i;EDIT_NEW=false;
  const c=CAMPS_W[i],d=c.detail||{};
  document.getElementById("edit-title").textContent="Edit — "+c.camp_name;
  document.getElementById("edit-grid").innerHTML=
    fldHtml("e-continent","Continent",c.continent,"g1","continent")
    +fldHtml("e-country","Country",c.country,"g1")
    +fldHtml("e-camp_name","Official camp name",c.camp_name,"g2")
    +fldHtml("e-state","State/Prov. (US/CA)",c.state,"g1")
    +fldHtml("e-age_requirements","Ages (ex. 17-21)",c.age_requirements,"g1")
    +fldHtml("e-fee","Fee (ex. 300 EURO, 0 = free)",c.fee,"g2")
    +fldHtml("e-camp_starts","Camp start (dd-mm-yyyy)",c.camp_starts,"g1")
    +fldHtml("e-camp_ends","Camp end",c.camp_ends,"g1")
    +fldHtml("e-family_stay_starts","Family stay start",c.family_stay_starts,"g1")
    +fldHtml("e-family_stay_ends","Family stay end",c.family_stay_ends,"g1")
    +fldHtml("e-location","Location",d.location,"g3")
    +fldHtml("e-application_deadline","Application deadline",d.application_deadline,"g1")
    +fldHtml("e-participants","Capacity",d.participants,"g1")
    +fldHtml("e-languages","Languages (comma-separated)",(d.languages||[]).join(", "),"g1")
    +fldHtml("e-description","Camp activities / description",d.description,"g6","textarea")
    +fldHtml("e-host_family_activities","Host family activities",d.host_family_activities,"g6","textarea")
    +fldHtml("e-website","Official website",d.website,"g2")
    +fldHtml("e-yce_url","lions-yce-belgium.be page",d.yce_url,"g2")
    +fldHtml("e-contact_name","Contact name",d.contact_name,"g2")
    +fldHtml("e-contact_email","Contact e-mail",d.contact_email,"g2")
    +fldHtml("e-contact_phone","Contact phone",d.contact_phone,"g2");
  document.getElementById("edit-box").style.display="block";
  document.getElementById("edit-box").scrollIntoView({behavior:"smooth",block:"start"});
}
function newCamp(){
  CAMPS_W.push({continent:"Europe",country:"",camp_name:"",age_requirements:"",fee:null,
    camp_starts:null,camp_ends:null,family_stay_starts:null,family_stay_ends:null,detail:{}});
  openEdit(CAMPS_W.length-1);EDIT_NEW=true;
  document.getElementById("edit-title").textContent="New camp";
}
function closeEdit(){
  if(EDIT_NEW)CAMPS_W.splice(EDIT_I,1); // nouveau camp annulé
  EDIT_I=-1;EDIT_NEW=false;
  document.getElementById("edit-box").style.display="none";render();
}
function gv(id){const v=document.getElementById(id).value.trim();return v||null;}
function saveEdit(){
  const c=CAMPS_W[EDIT_I];
  const name=gv("e-camp_name"),ctry=gv("e-country");
  if(!name||!ctry){log("Camp name and country are required.","err");return;}
  for(const f of ["e-camp_starts","e-camp_ends","e-family_stay_starts","e-family_stay_ends","e-application_deadline"]){
    const v=gv(f);
    if(v&&!validDmy(v)){log("Not a valid date (dd-mm-yyyy): "+f.slice(2).replace(/_/g," ")+" = "+esc(v),"err");return;}
  }
  for(const p of [["e-camp_starts","e-camp_ends","Camp"],["e-family_stay_starts","e-family_stay_ends","Family stay"]]){
    const a=gv(p[0]),b=gv(p[1]);
    if(a&&b&&dmyKey(a)>dmyKey(b)){log(p[2]+": the start date is after the end date.","err");return;}
  }
  const ages=(gv("e-age_requirements")||"").match(/\d+/g);
  if(ages&&ages.length>=2&&+ages[0]>+ages[1]){log("Ages: the minimum is above the maximum.","err");return;}
  if(gv("e-website")&&!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(gv("e-website"))){log("Website must be a web address (https://…).","err");return;}
  if(gv("e-contact_email")&&!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(gv("e-contact_email"))){log("Contact e-mail is not valid.","err");return;}
  const nc={};
  nc.continent=gv("e-continent")||"Europe";nc.country=ctry;
  if(gv("e-state"))nc.state=gv("e-state");
  if(c.district)nc.district=c.district;
  nc.camp_name=name;nc.age_requirements=gv("e-age_requirements")||"";nc.fee=gv("e-fee");
  nc.camp_starts=gv("e-camp_starts");nc.camp_ends=gv("e-camp_ends");
  nc.family_stay_starts=gv("e-family_stay_starts");nc.family_stay_ends=gv("e-family_stay_ends");
  const d={};
  [["location","e-location"],["description","e-description"],["host_family_activities","e-host_family_activities"],
   ["website","e-website"],["yce_url","e-yce_url"],["application_deadline","e-application_deadline"],
   ["participants","e-participants"],["contact_name","e-contact_name"],["contact_email","e-contact_email"],
   ["contact_phone","e-contact_phone"]].forEach(function(p){const v=gv(p[1]);if(v)d[p[0]]=v;});
  const langs=gv("e-languages");
  if(langs)d.languages=langs.split(",").map(function(x){return x.trim();}).filter(Boolean);
  // ordre des clés identique aux fiches existantes
  const det={};DET_KEYS.forEach(function(k){if(k in d)det[k]=d[k];});
  if(Object.keys(det).length)nc.detail=det;
  const ordered={};TOP_KEYS.forEach(function(k){if(k in nc)ordered[k]=nc[k];});
  CAMPS_W[EDIT_I]=ordered;
  log((EDIT_NEW?"Camp created: ":"Camp updated: ")+esc(name),"ok");
  EDIT_NEW=false;closeEdit();markDirty();
}

// -------------------- archivage --------------------
function today(){const n=new Date();return String(n.getDate()).padStart(2,"0")+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+n.getFullYear();}
function archiveCamp(i){
  const c=CAMPS_W.splice(i,1)[0];
  c.archived_on=today();
  ARCH.push(c);
  log("Archived: "+esc(c.camp_name)+" — it will disappear from the site at the next save.","ok");
  markDirty();render();
}
function restoreCamp(i){
  const c=ARCH.splice(i,1)[0];
  delete c.archived_on;
  CAMPS_W.push(c);
  log("Restored: "+esc(c.camp_name),"ok");
  markDirty();render();
}
function deleteCamp(i){
  if(!confirm("Delete «"+ARCH[i].camp_name+"» permanently? (it stays in git history)"))return;
  const c=ARCH.splice(i,1)[0];
  log("Deleted from archive: "+esc(c.camp_name),"warn");
  markDirty();render();
}

// -------------------- export / import JSON --------------------
function exportJson(){
  const data={exported:new Date().toISOString(),season:SEASON,camps:CAMPS_W,archive:ARCH};
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:"application/json"}));
  a.download="yce_camps_backup_"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
  log("Backup exported — "+CAMPS_W.length+" active + "+ARCH.length+" archived camps.","ok");
}
function jsonPick(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=function(){
    try{
      let d=JSON.parse(r.result);
      let camps=Array.isArray(d)?d:d.camps;
      if(!Array.isArray(camps)||!camps.length||!camps[0].camp_name)throw new Error("expected {camps:[…]} or an array of camps");
      if(!confirm("Replace the working list with "+camps.length+" camps"
        +(d.archive?" + "+d.archive.length+" archived":"")+" from "+f.name+" ?"))return;
      CAMPS_W=camps;ARCH=Array.isArray(d.archive)?d.archive:ARCH;
      log("Backup imported from "+esc(f.name)+" — review, then “Save to the site”.","ok");
      markDirty();render();
    }catch(e){log("Import rejected: "+esc(e.message),"err");}
    finally{inp.value="";}
  };
  r.readAsText(f);
}

// -------------------- import du répertoire officiel (xlsx) --------------------
function decodeXml(s){return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#(\d+);/g,function(m,d){return String.fromCodePoint(+d);}).replace(/&amp;/g,"&");}
function colIdx(ref){let c=0;const m=ref.match(/^[A-Z]+/)[0];
  for(let i=0;i<m.length;i++)c=c*26+m.charCodeAt(i)-64;return c-1;}
function serialToDmy(n){ // numéro de série Excel -> dd-mm-yyyy
  const d=new Date(Date.UTC(1899,11,30)+n*86400000);
  return String(d.getUTCDate()).padStart(2,"0")+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+d.getUTCFullYear();}
// "dd-mm-yyyy" correspondant à une vraie date du calendrier (pas de 31-02, pas de mois 13)
function validDmy(s){
  const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(s||"");if(!m)return false;
  const d=new Date(+m[3],+m[2]-1,+m[1]);
  return d.getFullYear()===+m[3]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[1];
}
function mdyToDmy(v){ // MM-DD-YYYY (ou MM/DD/YYYY) -> dd-mm-yyyy ; série Excel acceptée ; date impossible -> null
  if(v==null||v==="")return null;
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if(m){const r=m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0")+"-"+m[3];return validDmy(r)?r:null;}
  if(/^\d+(\.\d+)?$/.test(s)&&+s>20000&&+s<70000)return serialToDmy(+s);
  return null;
}
async function parseDirectory(buf){
  const entries=await unzip(buf);
  const td=new TextDecoder();
  const part=function(n){const e=entries.find(function(x){return x.name===n;});return e?td.decode(e.data):null;};
  // feuille "Approved Camps" via workbook + rels (repli : première feuille)
  const wb=part("xl/workbook.xml")||"", rels=part("xl/_rels/workbook.xml.rels")||"";
  let target=null, first=null;
  wb.replace(/<sheet [^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"/g,function(m0,nm,rid){
    const mm=rels.match(new RegExp('Id="'+rid+'"[^>]*Target="([^"]*)"'));
    if(mm){const t="xl/"+mm[1].replace(/^\/?(xl\/)?/,"");
      if(!first)first=t;
      if(/approved\s*camps/i.test(nm))target=t;}
    return m0;});
  target=target||first;
  if(!target)throw new Error("no worksheet found");
  const sst=[];
  const ss=part("xl/sharedStrings.xml");
  if(ss)ss.replace(/<si>([\s\S]*?)<\/si>/g,function(m0,inner){
    sst.push(decodeXml((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[]).map(function(x){return x.replace(/<[^>]+>/g,"");}).join("")));return m0;});
  const sx=part(target);
  const rows=[];
  sx.replace(/<row[^>]*>([\s\S]*?)<\/row>/g,function(m0,inner){
    const cells=[];
    inner.replace(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,function(c0,ref,attrs,body){
      body=body||"";let v=null;
      if(/t="inlineStr"/.test(attrs)){v=decodeXml((body.match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[]).map(function(x){return x.replace(/<[^>]+>/g,"");}).join(""));}
      else{const vm=body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        if(vm)v=/t="s"/.test(attrs)?sst[+vm[1]]:decodeXml(vm[1]);}
      if(v!=null&&String(v).trim()!=="")cells[colIdx(ref)]=String(v).trim();
      return c0;});
    if(cells.length)rows.push(cells);
    return m0;});
  return rows;
}
function feeOf(fee,cur){
  if(!fee)return null;
  cur=(cur||"").trim();
  if(/^euros?$/i.test(cur))cur="EURO";
  if(/[a-z]/i.test(fee))return fee;      // le montant contient déjà sa devise
  return cur?fee+" "+cur:fee;
}
function sim(a,b){ // similarité par bigrammes (Dice)
  if(a===b)return 1;if(a.length<2||b.length<2)return 0;
  const big=function(s){const m={};for(let i=0;i<s.length-1;i++){const g=s.substr(i,2);m[g]=(m[g]||0)+1;}return m;};
  const A=big(a),B=big(b);let inter=0,tot=0,g;
  for(g in A){tot+=A[g];if(B[g])inter+=Math.min(A[g],B[g]);}
  for(g in B)tot+=B[g];
  return 2*inter/tot;
}
function stripNoise(s){return simple(String(s||"").replace(/\b(20\d\d|lions?|camp|yce|youth|international|the)\b/gi," "));}
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
    const items=[];
    for(const r of rows.slice(1)){
      const g=function(i){return i>=0&&r[i]!=null?String(r[i]).trim():null;};
      const name=g(C.name);if(!name)continue;
      const cs=mdyToDmy(g(C.cs));if(!cs)continue;
      const langs=(g(C.langs)||"").split(/[,;\/]| and /).map(function(x){return x.trim();}).filter(Boolean);
      items.push({country:g(C.country),name:name,cs:cs,ce:mdyToDmy(g(C.ce)),
        fs:mdyToDmy(g(C.fs)),fe:mdyToDmy(g(C.fe)),deadline:mdyToDmy(g(C.deadline)),
        ages:g(C.ages),participants:g(C.participants),fee:feeOf(g(C.fee),g(C.cur)),
        hfa:g(C.hfa),website:g(C.web),location:g(C.loc),activities:g(C.act),langs:langs,
        cname:[g(C.first),g(C.last)].filter(Boolean).join(" ")||null,cemail:g(C.email),cphone:g(C.phone)});
    }
    buildReview(f.name,items);
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
// Deux fiches décrivent-elles le même camp ? Les noms changent d'une année à l'autre (« Brussels Lions Youth Camp »
// devient « Belgium Lions YCE Camp 2027 »), donc on recoupe aussi les dates, le lieu et le contact.
// Renvoie une raison (texte) ou null. a, b : {name,country,start,loc,email}
function factsOf(c){const d=c.detail||{};return {name:c.camp_name,country:c.country,start:c.camp_starts,loc:d.location,email:d.contact_email};}
function factsOfT(t){return {name:t.name,country:t.country,start:t.cs,loc:t.location,email:t.cemail};}
function alike(a,b){
  if(simple(a.country)!==simple(b.country))return null;
  if(simple(a.name)===simple(b.name))return "exact";
  const nm=sim(stripNoise(a.name),stripNoise(b.name));
  const lc=a.loc&&b.loc?sim(stripNoise(a.loc),stripNoise(b.loc)):0;
  const sameStart=!!a.start&&a.start===b.start;
  const sameMail=!!a.email&&simple(a.email)===simple(b.email);
  if(sameStart&&lc>=0.7)return "same dates and place";
  if(sameStart&&sameMail&&(lc>=0.4||nm>=0.4||!a.loc||!b.loc))return "same dates and contact";
  if(nm>=0.72)return "close name "+nm.toFixed(2);
  return null;
}
// camp du répertoire retrouvé dans une liste : même nom, sinon camp reconnu par ses dates, son lieu ou son contact
function matchCamp(list,t){
  const key=simple(t.name),ft=factsOfT(t);
  for(let i=0;i<list.length;i++)if(simple(list[i].camp_name)===key)return {idx:i,how:"exact"};
  let best=-1,bw="",bs=-1;
  const rank={"same dates and place":3,"same dates and contact":2};
  for(let i=0;i<list.length;i++){
    const w=alike(factsOf(list[i]),ft);if(!w)continue;
    const sc=rank[w]||1;
    if(sc>bs){bs=sc;best=i;bw=w;}
  }
  return best>=0?{idx:best,how:bw}:null;
}
// doublons possibles dans la liste des camps actifs (après un import, ou une saisie à la main)
function findDuplicates(){
  const out=[];
  for(let i=0;i<CAMPS_W.length;i++)for(let j=i+1;j<CAMPS_W.length;j++){
    const w=alike(factsOf(CAMPS_W[i]),factsOf(CAMPS_W[j]));
    if(w)out.push({a:CAMPS_W[i],b:CAMPS_W[j],why:w});
  }
  return out;
}
function showDuplicates(){
  const d=findDuplicates(),box=document.getElementById("dups");
  document.getElementById("dups-note").textContent=d.length?d.length+" pair(s) to check":"";
  document.getElementById("dups-body").innerHTML=d.length?d.map(function(x){
    const row=function(c){return "<b>"+esc(c.camp_name)+"</b> <span class='sub'>"+esc(c.camp_starts||"—")+" · "+esc((c.detail||{}).location||"—")
      +" · "+esc((c.detail||{}).contact_email||"—")+'</span> <button class="btn2" onclick="archiveDup('+CAMPS_W.indexOf(c)+')">🗄 Archive</button>';};
    return '<div class="rev-row"><div class="rev-what">'+row(x.a)+"<br>"+row(x.b)+'<div class="chg">'+esc(x.why)+"</div></div></div>";
  }).join(""):'<span class="hint">No duplicate found among the active camps.</span>';
  box.style.display="";
}
function archiveDup(i){archiveCamp(i);showDuplicates();}
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
function buildReview(fname,items){
  const rev=[];let unchanged=0,archived=0;
  for(const t of items){
    const m=matchCamp(CAMPS_W,t);
    const hit=m?m.idx:-1,how=m?m.how:"";
    // camp archivé : ni proposé, ni affiché (« Restore » dans l'onglet Archived pour le reprendre)
    if(hit<0&&matchCamp(ARCH,t)){archived++;continue;}
    if(hit>=0){
      const chg=changesFor(CAMPS_W[hit],t);
      if(!chg.length){unchanged++;continue;}
      rev.push({kind:"update",idx:hit,how:how,t:t,chg:chg,on:how==="exact"});
    }else rev.push({kind:"new",t:t,on:true,rep:replacesFor(t)});
  }
  REVIEW=rev;
  document.getElementById("rev-note").textContent=fname+" — "
    +rev.filter(function(r){return r.kind==="update";}).length+" update(s), "
    +rev.filter(function(r){return r.kind==="new";}).length+" new camp(s), "+unchanged+" unchanged"
    +(archived?", "+archived+" archived (left out — restore them from the Archived tab if needed)":"");
  document.getElementById("rev-body").innerHTML=rev.length?rev.map(function(r,i){
    const tag=r.kind==="new"?'<span class="rev-tag t-new">NEW</span>'
      :(r.how==="exact"?'<span class="rev-tag t-upd">UPDATE</span>':'<span class="rev-tag t-fuz">UPDATE? '+esc(r.how)+"</span>");
    const what=r.kind==="new"
      ?"<b>"+esc(r.t.country)+" — "+esc(r.t.name)+"</b><div class='chg'>camp "+esc(r.t.cs)+" → "+esc(r.t.ce||"?")+" · "+esc(r.t.ages||"")+" · "+esc(r.t.fee||"")+"</div>"
        +(r.rep?'<label class="rev-rep"><input type="checkbox" id="rva-'+i+'"> may replace <b>'+esc(r.rep.camp.camp_name)+"</b> ("
          +esc(seasonOf(r.rep.camp))+", "+esc(r.rep.why)+") — archive the old camp</label>":"")
      :"<b>"+esc(CAMPS_W[r.idx].camp_name)+"</b> ⇐ "+esc(r.t.name)
        +"<div class='chg'>"+r.chg.map(function(x){return esc(x.label)+": "+esc(String(x.old).slice(0,30)||"∅")+" → "+esc(String(Array.isArray(x.val)?x.val.join(", "):x.val).slice(0,40));}).join(" · ")+"</div>";
    return '<div class="rev-row"><input type="checkbox" id="rv-'+i+'"'+(r.on?" checked":"")+"> "+tag+'<div class="rev-what">'+what+"</div></div>";
  }).join(""):'<span class="hint">Everything already matches the directory — nothing to apply.</span>';
  document.getElementById("review").style.display="";
  document.getElementById("review").scrollIntoView({behavior:"smooth",block:"start"});
  log("Directory parsed: "+items.length+" dated entr"+(items.length>1?"ies":"y")+" examined.","ok");
}
function applyReview(){
  if(!REVIEW)return;
  let up=0,nw=0;const old=[];
  REVIEW.forEach(function(r,i){
    if(!document.getElementById("rv-"+i).checked)return;
    if(r.kind==="update"){
      const c=CAMPS_W[r.idx];
      r.chg.forEach(function(x){
        if(x.scope==="top")c[x.field]=x.val;
        else{c.detail=c.detail||{};c.detail[x.field]=x.val;}
      });
      if(c.detail){const det={};DET_KEYS.forEach(function(k){if(k in c.detail)det[k]=c.detail[k];});c.detail=det;}
      up++;
    }else{
      const t=r.t,det={};
      [["location",t.location],["description",t.activities],["host_family_activities",t.hfa],
       ["languages",t.langs&&t.langs.length?t.langs:null],["website",t.website],
       ["application_deadline",t.deadline],["participants",t.participants],
       ["contact_name",t.cname],["contact_email",t.cemail],["contact_phone",t.cphone]]
        .forEach(function(p){if(p[1])det[p[0]]=p[1];});
      const known={Denmark:"Europe",Hungary:"Europe",Malaysia:"Asia","Sri Lanka":"Asia",Mexico:"Middle America"};
      const ex=CAMPS_W.find(function(c){return c.country===t.country;});
      const ra=document.getElementById("rva-"+i);
      if(r.rep&&ra&&ra.checked&&old.indexOf(r.rep.camp)<0)old.push(r.rep.camp);
      CAMPS_W.push({continent:(ex&&ex.continent)||known[t.country]||"Europe",country:t.country,
        camp_name:t.name,age_requirements:t.ages||"",fee:t.fee,
        camp_starts:t.cs,camp_ends:t.ce,family_stay_starts:t.fs,family_stay_ends:t.fe,
        detail:det});
      nw++;
    }
  });
  // anciens camps remplacés : archivés comme avec le bouton 🗄 Archive (ils quittent le site public)
  old.forEach(function(c){const k=CAMPS_W.indexOf(c);if(k<0)return;CAMPS_W.splice(k,1);c.archived_on=today();ARCH.push(c);});
  cancelReview();
  log("Directory applied: "+up+" camp(s) updated, "+nw+" created"+(old.length?", "+old.length+" replaced camp(s) archived":"")+". Review, then “Save to the site”.","ok");
  markDirty();render();
}
function cancelReview(){REVIEW=null;document.getElementById("review").style.display="none";}

// -------------------- enregistrement vers le site --------------------
async function saveSite(){
  const btn=document.getElementById("save-site");btn.disabled=true;
  try{
    const clean=CAMPS_W.map(function(c){const o={};TOP_KEYS.forEach(function(k){if(k in c)o[k]=c[k];});return o;});
    const cur=await getFile("camps_data.js");
    if(!cur)throw new Error("camps_data.js not found on main");
    let src=b64ToUtf8(cur.content);
    if(!/const RAW = \[[\s\S]*?\];/.test(src))throw new Error("RAW block not found");
    src=src.replace(/const RAW = \[[\s\S]*?\];/,function(){return "const RAW = "+JSON.stringify(clean)+";";});
    const changes=[];
    if(src!==b64ToUtf8(cur.content))changes.push({path:"camps_data.js",b64:utf8ToB64(src),sha:cur.sha});
    const body=JSON.stringify({updated:new Date().toISOString().slice(0,10),count:ARCH.length,archive:ARCH},null,1)+"\n";
    const curA=await getFile("camps_archive.json");
    // l'archive ne change que si son contenu change (la date seule ne déclenche pas de commit)
    let sameArch=false;
    try{sameArch=!!curA&&JSON.stringify(JSON.parse(b64ToUtf8(curA.content)).archive)===JSON.stringify(ARCH);}catch(e){}
    if(!sameArch)changes.push({path:"camps_archive.json",b64:utf8ToB64(body),sha:curA?curA.sha:null});
    if(!changes.length){log("Nothing changed on the repository.","info");}
    else{
      const sha=await commitFiles(changes,"Camp manager: "+clean.length+" active camps, "+ARCH.length+" archived");
      log("Saved in one commit <b>"+sha.slice(0,7)+"</b> ("+changes.map(function(c){return esc(c.path);}).join(", ")+"). The site republishes in ~2 minutes.","ok");
    }
    DIRTY=false;document.getElementById("dirty").style.display="none";
  }catch(e){log("Save failed: "+esc(e.message),"err");}
  finally{updSave();}
}

// -------------------- connexion : recharge l'état du dépôt --------------------
ON_CONNECT.push(async function(){
  CONNECTED=true;
  try{
    if(!DIRTY){
      const cur=await getFile("camps_data.js");
      const m=b64ToUtf8(cur.content).match(/const RAW = (\[[\s\S]*?\]);/);
      if(m)CAMPS_W=JSON.parse(m[1]);
      const curA=await getFile("camps_archive.json");
      if(curA){const a=JSON.parse(b64ToUtf8(curA.content));if(Array.isArray(a.archive))ARCH=a.archive;}
      log("Latest repository state loaded ("+CAMPS_W.length+" active, "+ARCH.length+" archived).","info");
    }else log("Connected — local unsaved changes kept.","warn");
  }catch(e){log("Could not refresh from the repository: "+esc(e.message),"warn");}
  render();
});
ON_LOGOUT.push(function(){CONNECTED=false;updSave();});

// -------------------- démarrage --------------------
(function(){
  fetch("camps_archive.json").then(function(r){return r.ok?r.json():null;})
    .then(function(a){if(a&&Array.isArray(a.archive)){ARCH=a.archive;render();}})
    .catch(function(){});
  render();
  initAccess();
  window.addEventListener("beforeunload",function(e){if(DIRTY){e.preventDefault();e.returnValue="";}});
})();
