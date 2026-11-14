// camps-manager.js — onglet Camps de l'administration : liste, fiche d'un camp, archivage, sauvegarde JSON, enregistrement vers le site.
// Chargé par yce_admin.html après camps_data.js, js/zip.js, js/xlsx.js et js/admin-core.js. Fichiers compagnons (chargés ensuite) :
//   js/camps-match.js  — deux fiches décrivent-elles le même camp ? doublons
//   js/camps-import.js — import du répertoire YCE officiel (xlsx) : lecture, revue, application
//   js/camps-geo.js    — coordonnées de la carte (GeoJSON NextGIS)
// Tous partagent la portée globale (CAMPS_W, ARCH, REVIEW…).
"use strict";
let CAMPS_W=RAW.map(function(c){return JSON.parse(JSON.stringify(c));}); // copie de travail
let ARCH=[];              // camps archivés (camps_archive.json)
let CONT="",DIRTY=false, CONNECTED=false, VIEW="active", EDIT_I=-1, EDIT_C=null, EDIT_NEW=false, REVIEW=null;
let SORT_K="country", SORT_D=1; // tri du tableau (clic sur les en-têtes)

const TOP_KEYS=["continent","country","state","district","camp_name","inclusive","winter","age_requirements","fee",
  "camp_starts","camp_ends","family_stay_starts","family_stay_ends","family_stay2_starts","family_stay2_ends","detail"];
const DET_KEYS=["location","description","host_family_activities","languages","website","flyer_url",
  "application_deadline","participants","contact_name","contact_email","contact_phone","lat","lon"];
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
function setContinent(v){CONT=v;render();}
function setView(v){VIEW=v;
  document.getElementById("tab-active").classList.toggle("on",v==="active");
  document.getElementById("tab-archived").classList.toggle("on",v==="archived");
  render();}
function render(){
  const q=simple(document.getElementById("q").value);
  const list=(VIEW==="active"?CAMPS_W:ARCH);
  const rows=list.map(function(c,i){c._i=i;return c;})
    .filter(function(c){return !q||simple(c.camp_name+c.country).indexOf(q)>=0;})
    .filter(function(c){return !CONT||c.continent===CONT;})
    .sort(function(a,b){
      const kf={
        country:function(c){return simple(c.country)+"|"+simple(c.camp_name);},
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
    const sn=seasonOf(c), cur=sn===String(SEASON).replace(/\D+/g,"-");
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
  if(tag==="yesno"){return '<div class="fld '+span+'"><label class="flbl">'+label+'</label><select id="'+id+'"><option>No</option><option'+(val?" selected":"")+">Yes</option></select></div>";}
  if(tag==="continent"){return '<div class="fld '+span+'"><label class="flbl">'+label+'</label><select id="'+id+'">'
    +CONTINENTS.map(function(x){return '<option'+(x===val?" selected":"")+">"+x+"</option>";}).join("")+"</select></div>";}
  return '<div class="fld '+span+'"><label class="flbl">'+label+'</label><input id="'+id+'" value="'+esc(val||"")+'"></div>';
}
// La fiche ouverte est suivie par l'objet (EDIT_C), pas par sa position : archiver, supprimer ou importer
// pendant qu'une fiche est ouverte décale les positions, et l'enregistrement écraserait un autre camp.
function editIndex(){EDIT_I=EDIT_C?CAMPS_W.indexOf(EDIT_C):-1;return EDIT_I;}
function openEdit(i){
  if(EDIT_NEW&&EDIT_C&&CAMPS_W.indexOf(EDIT_C)>=0&&CAMPS_W.indexOf(EDIT_C)!==i){CAMPS_W.splice(CAMPS_W.indexOf(EDIT_C),1);if(CAMPS_W.length<=i)i=CAMPS_W.length-1;} // nouveau camp abandonné
  EDIT_I=i;EDIT_C=CAMPS_W[i];EDIT_NEW=false;
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
    +fldHtml("e-family_stay2_starts","2nd family stay start (if any)",c.family_stay2_starts,"g1")
    +fldHtml("e-family_stay2_ends","2nd family stay end",c.family_stay2_ends,"g1")
    +fldHtml("e-location","Location",d.location,"g3")
    +fldHtml("e-lat","Latitude (ex. 50.9307)",d.lat,"g1")
    +fldHtml("e-lon","Longitude (ex. 5.332)",d.lon,"g1")
    +fldHtml("e-application_deadline","Application deadline",d.application_deadline,"g1")
    +fldHtml("e-participants","Capacity",d.participants,"g1")
    +fldHtml("e-languages","Languages (comma-separated)",(d.languages||[]).join(", "),"g1")
    +fldHtml("e-inclusive","♿ Inclusion / special camp (disability, special needs)",c.inclusive,"g2","yesno")
    +fldHtml("e-winter","❄ Winter camp",c.winter,"g2","yesno")
    +fldHtml("e-description","Camp activities / description",d.description,"g6","textarea")
    +fldHtml("e-host_family_activities","Host family activities",d.host_family_activities,"g6","textarea")
    +fldHtml("e-website","Official website",d.website,"g2")
    +fldHtml("e-flyer_url","Camp flyer (link to the image)",d.flyer_url,"g2")
    +fldHtml("e-contact_name","Contact name",d.contact_name,"g2")
    +fldHtml("e-contact_email","Contact e-mail (several: separate with ;)",d.contact_email,"g2")
    +fldHtml("e-contact_phone","Contact phone",d.contact_phone,"g2");
  document.getElementById("edit-del").style.display="";
  document.getElementById("edit-box").style.display="block";
  document.getElementById("edit-box").scrollIntoView({behavior:"smooth",block:"start"});
}
function newCamp(){
  CAMPS_W.push({continent:"Europe",country:"",camp_name:"",age_requirements:"",fee:null,
    camp_starts:null,camp_ends:null,family_stay_starts:null,family_stay_ends:null,detail:{}});
  openEdit(CAMPS_W.length-1);EDIT_NEW=true;
  document.getElementById("edit-title").textContent="New camp";
  document.getElementById("edit-del").style.display="none";
}
// supprime définitivement le camp en cours d'édition (doublon, saisie erronée) ; l'archivage est réservé aux camps des saisons passées
function deleteEditing(){
  if(EDIT_NEW||editIndex()<0)return;
  const c=CAMPS_W[EDIT_I];
  if(!confirm("Delete «"+c.camp_name+"» permanently? (it stays in git history)\nUse Archive instead for a camp of a past season."))return;
  CAMPS_W.splice(EDIT_I,1);
  log("Deleted: "+esc(c.camp_name),"warn");
  EDIT_NEW=false;closeEdit();markDirty();
}
function closeEdit(){
  if(EDIT_NEW&&editIndex()>=0)CAMPS_W.splice(EDIT_I,1); // nouveau camp annulé
  EDIT_I=-1;EDIT_C=null;EDIT_NEW=false;
  document.getElementById("edit-box").style.display="none";render();
  if(document.getElementById("dups").style.display!=="none")showDuplicates();
}
function gv(id){const v=document.getElementById(id).value.trim();return v||null;}
function saveEdit(){
  if(editIndex()<0){log("This camp is no longer in the active list (archived, deleted or replaced by an import) — nothing saved.","err");EDIT_NEW=false;closeEdit();return;}
  const c=CAMPS_W[EDIT_I];
  const name=gv("e-camp_name"),ctry=gv("e-country");
  if(!name||!ctry){log("Camp name and country are required.","err");return;}
  for(const f of ["e-camp_starts","e-camp_ends","e-family_stay_starts","e-family_stay_ends","e-family_stay2_starts","e-family_stay2_ends","e-application_deadline"]){
    const v=gv(f);
    if(v&&!validDmy(v)){log("Not a valid date (dd-mm-yyyy): "+f.slice(2).replace(/_/g," ")+" = "+esc(v),"err");return;}
  }
  for(const p of [["e-camp_starts","e-camp_ends","Camp"],["e-family_stay_starts","e-family_stay_ends","Family stay"],["e-family_stay2_starts","e-family_stay2_ends","Second family stay"]]){
    const a=gv(p[0]),b=gv(p[1]);
    if(a&&b&&dmyKey(a)>dmyKey(b)){log(p[2]+": the start date is after the end date.","err");return;}
  }
  const ages=(gv("e-age_requirements")||"").match(/\d+/g);
  if(ages&&ages.length>=2&&+ages[0]>+ages[1]){log("Ages: the minimum is above the maximum.","err");return;}
  if(gv("e-flyer_url")&&!/^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(gv("e-flyer_url"))){log("Flyer must be a web address (https://…).","err");return;}
  if(gv("e-website")&&!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(gv("e-website"))){log("Website must be a web address (https://…).","err");return;}
  if(gv("e-contact_email")&&!gv("e-contact_email").split(/\s*[;,]\s*/).every(function(m){return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(m);})){log("Contact e-mail is not valid (several addresses: separate them with a semicolon).","err");return;}
  const lat=gv("e-lat"),lon=gv("e-lon");
  if(lat||lon){
    if(!lat||!lon||!isFinite(+lat)||!isFinite(+lon)||Math.abs(+lat)>90||Math.abs(+lon)>180){log("Coordinates: give both latitude (-90 to 90) and longitude (-180 to 180) as numbers, e.g. 50.9307 and 5.332.","err");return;}
  }
  const nc={};
  nc.continent=gv("e-continent")||"Europe";nc.country=ctry;
  if(gv("e-state"))nc.state=gv("e-state");
  if(c.district)nc.district=c.district;
  if(gv("e-inclusive")==="Yes")nc.inclusive=true;
  if(gv("e-winter")==="Yes")nc.winter=true;
  nc.camp_name=name;nc.age_requirements=gv("e-age_requirements")||"";nc.fee=gv("e-fee");
  nc.camp_starts=gv("e-camp_starts");nc.camp_ends=gv("e-camp_ends");
  nc.family_stay_starts=gv("e-family_stay_starts");nc.family_stay_ends=gv("e-family_stay_ends");
  if(gv("e-family_stay2_starts")||gv("e-family_stay2_ends")){nc.family_stay2_starts=gv("e-family_stay2_starts");nc.family_stay2_ends=gv("e-family_stay2_ends");}
  const d={};
  [["location","e-location"],["description","e-description"],["host_family_activities","e-host_family_activities"],
   ["website","e-website"],["flyer_url","e-flyer_url"],["application_deadline","e-application_deadline"],
   ["participants","e-participants"],["contact_name","e-contact_name"],["contact_email","e-contact_email"],
   ["contact_phone","e-contact_phone"]].forEach(function(p){const v=gv(p[1]);if(v)d[p[0]]=v;});
  if(lat&&lon){d.lat=Math.round(+lat*10000)/10000;d.lon=Math.round(+lon*10000)/10000;}
  const langs=gv("e-languages");
  if(langs)d.languages=langs.split(",").map(function(x){return x.trim();}).filter(Boolean);
  // ordre des clés identique aux fiches existantes
  const det={};DET_KEYS.forEach(function(k){if(k in d)det[k]=d[k];});
  if(Object.keys(det).length)nc.detail=det;
  const ordered={};TOP_KEYS.forEach(function(k){if(k in nc)ordered[k]=nc[k];});
  CAMPS_W[EDIT_I]=ordered;
  if(REVIEW)REVIEW.forEach(function(r){if(r.camp===c)r.camp=ordered;}); // un import en attente de validation suit la fiche modifiée
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
      // champ supprimé (adresse « YCE page ») : une ancienne sauvegarde ne le ramène pas
      camps.concat(Array.isArray(d.archive)?d.archive:[]).forEach(function(c){if(c&&c.detail&&typeof c.detail==='object')delete c.detail.yce_url;});
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

// "dd-mm-yyyy" correspondant à une vraie date du calendrier (pas de 31-02, pas de mois 13)
function validDmy(s){
  const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(s||"");if(!m)return false;
  const d=new Date(+m[3],+m[2]-1,+m[1]);
  return d.getFullYear()===+m[3]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[1];
}

// -------------------- enregistrement vers le site --------------------
async function saveSite(){
  const btn=document.getElementById("save-site");btn.disabled=true;
  try{
    const clean=CAMPS_W.map(function(c){const o={};TOP_KEYS.forEach(function(k){if(k in c)o[k]=c[k];});return o;});
    const cur=await getFile("camps_data.js");
    if(!cur)throw new Error("camps_data.js not found on main");
    let src=b64ToUtf8(cur.content);
    const span=rawSpan(src);
    if(!span)throw new Error("RAW block not found");
    src=src.slice(0,span[0])+JSON.stringify(clean)+src.slice(span[1]);
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
      const src=b64ToUtf8(cur.content),span=rawSpan(src);
      if(span){CAMPS_W=JSON.parse(src.slice(span[0],span[1]));if(EDIT_C&&!EDIT_NEW)closeEdit();}
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
