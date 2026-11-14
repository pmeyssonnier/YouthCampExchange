// admin.js — onglets Site & season et Documents de yce_admin.html : état en cours d'édition, formulaire, frais et coordonnées bancaires,
// enregistrement en un commit, documents officiels, lecture des données actuelles à la connexion, démarrage.
// Chargé après js/admin-core.js et ses deux compagnons (appelés dès le démarrage par fillForm) :
//   js/admin-people.js  — coordinateurs de district, numéro du district multiple, équipe nationale
//   js/admin-gallery.js — galerie de photos de la page d'accueil
// Scripts classiques partageant la portée globale. La liste des camps se gère dans l'onglet Camps (js/camps-manager.js).
"use strict";
let GAL=[];         // galerie en cours d'édition (copie de GALLERY, enregistrée avec Save)
let DIST_W={};      // districts en cours d'édition {A:{name,club,email,mobile}}, enregistrés avec Save
let DIST_EDIT=null; // code du district ouvert dans le panneau d'édition ("" = nouveau district)
let TEAM_W={national:[],outgoing:[]}; // équipe nationale en cours d'édition (copie de TEAM)
let TEAM_EDIT=null;  // {g:"national"|"outgoing", i:index, -1 = nouveau membre}
let MD_W=MD;         // numéro du district multiple en cours d'édition (const MD de districts_data.js)
const PAY_KEYS=["amount","iban","bic","beneficiary","communication"];
// seuils des pièces jointes : [groupe, clé, libellé, unité]
const LIM_FIELDS=[
  ["photo","minSidePx","Photo — minimum shorter side","px"],["photo","minKb","Photo — minimum weight","KB"],
  ["photo","maxKb","Photo — maximum weight (reduced above)","KB"],["photo","maxPx","Photo — maximum size after reduction","px"],
  ["id","minLongPx","ID / passport scan — minimum longer side","px"],["id","minKb","ID / passport scan — minimum weight","KB"],
  ["id","maxKb","ID / passport scan — maximum weight (reduced above)","KB"],["id","maxPx","ID / passport scan — maximum size after reduction","px"],
  ["pdf","minKb","PDF — minimum weight","KB"],["pdf","maxKb","PDF — maximum weight (refused above)","KB"]];
function limShow(u){
  const base=uploadLimits(),src=u||{};
  const cols=["minPx","minKb","maxKb","maxPx"],heads=["Min px","Min KB","Max KB","Reduce to px"];
  const rows=[["photo","Photo",{minPx:"minSidePx"}],["id","ID scan",{minPx:"minLongPx"}],["pdf","PDF",{}]];
  let h='<span></span>'+heads.map(function(t){return '<span class="lh">'+t+'</span>';}).join("");
  rows.forEach(function(r){
    h+='<span class="lr">'+r[1]+'</span>';
    cols.forEach(function(c){
      const key=r[2][c]||c;
      if(!LIM_FIELDS.some(function(f){return f[0]===r[0]&&f[1]===key;})){h+='<span></span>';return;}
      const v=(src[r[0]]&&+src[r[0]][key]>0)?+src[r[0]][key]:base[r[0]][key];
      const f=LIM_FIELDS.filter(function(f){return f[0]===r[0]&&f[1]===key;})[0];
      h+='<input type="number" min="1" inputmode="numeric" id="lim-'+r[0]+'-'+key+'" value="'+v+'" aria-label="'+f[2]+' ('+f[3]+')" title="'+f[2]+' ('+f[3]+')">';
    });
  });
  document.getElementById("lim-body").innerHTML=h;
}
function limValues(){
  const o={photo:{},id:{},pdf:{}};
  LIM_FIELDS.forEach(function(f){
    const v=Math.round(+document.getElementById("lim-"+f[0]+"-"+f[1]).value);
    if(!(v>0))throw new Error("attachment limits: “"+f[2]+"” must be a positive number");
    o[f[0]][f[1]]=v;
  });
  if(o.photo.minKb>=o.photo.maxKb||o.id.minKb>=o.id.maxKb||o.pdf.minKb>=o.pdf.maxKb)throw new Error("attachment limits: a minimum weight must be lower than the maximum weight");
  if(o.photo.minSidePx>o.photo.maxPx)throw new Error("attachment limits: the photo minimum side is larger than its maximum size");
  if(o.id.minLongPx>o.id.maxPx)throw new Error("attachment limits: the scan minimum size is larger than its maximum size");
  return o;
}

// -------------------- formulaire --------------------
// d = données à afficher ; par défaut celles chargées avec la page (peut-être une copie en cache :
// à la connexion, ON_CONNECT recharge les fichiers actuels depuis GitHub)
function fillForm(d){
  d=d||{season:SEASON,year:YEAR,districts:DISTRICTS,camps:RAW.length,
    announce:(typeof SITE!=="undefined"&&SITE.announce)||"",gallery:(typeof GALLERY!=="undefined")?GALLERY:[],
    team:(typeof TEAM!=="undefined")?TEAM:null,payment:(typeof PAYMENT!=="undefined")?PAYMENT:null,upload:(typeof UPLOAD_LIMITS!=="undefined")?UPLOAD_LIMITS:null,md:MD};
  document.getElementById("in-season").value=d.season;
  document.getElementById("in-year").value=d.year;
  MD_W=d.md||MD;document.getElementById("in-md").value=MD_W;mdShow();
  DIST_W=JSON.parse(JSON.stringify(d.districts));DIST_EDIT=null;
  distShow();
  const t=d.team||{};
  TEAM_W={national:(t.national||[]).map(function(m){return Object.assign({},m);}),outgoing:(t.outgoing||[]).map(function(m){return Object.assign({},m);})};
  TEAM_EDIT=null;teamShow();
  PAY_KEYS.forEach(function(k){document.getElementById("pay-"+k).value=(d.payment&&d.payment[k])||"";});
  limShow(d.upload);
  document.getElementById("camps-note").textContent=d.camps+" camps currently on the site (season "+d.season+")";
  document.getElementById("in-announce").value=d.announce||"";
  GAL=d.gallery.slice();
  galShow();
  updPaths();
}
// -------------------- frais de dossier et coordonnées bancaires --------------------
// IBAN contrôlé par sa clé (modulo 97) : une faute de frappe dans un numéro de compte publié serait grave.
function ibanOk(s){
  const t=String(s).replace(/\s+/g,"").toUpperCase();
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(t))return false;
  const r=(t.slice(4)+t.slice(0,4)).replace(/[A-Z]/g,function(c){return String(c.charCodeAt(0)-55);});
  let m=0;for(let i=0;i<r.length;i++)m=(m*10+(+r[i]))%97;
  return m===1;
}
function paymentValues(){
  const p={};PAY_KEYS.forEach(function(k){p[k]=document.getElementById("pay-"+k).value.trim();});
  if(!p.amount)throw new Error("the administration fee amount is required");
  if(!ibanOk(p.iban))throw new Error("the IBAN "+p.iban+" is not valid (check digits)");
  if(p.bic&&!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(p.bic.toUpperCase()))throw new Error("the BIC "+p.bic+" is not valid");
  p.bic=p.bic.toUpperCase();
  return p;
}
// remplace la ligne "const NOM = …;" de districts_data.js, ou l'ajoute avant la galerie si elle n'existe pas encore
function upsertConst(src,name,value,comment){
  const line="const "+name+" = "+JSON.stringify(value)+";";
  const re=new RegExp("^const "+name+" = .*;$","m");
  if(re.test(src))return src.replace(re,function(){return line;});
  const at=src.indexOf("\n// Galerie photos");
  const block="\n// "+comment+"\n"+line+"\n";
  return at>=0?src.slice(0,at)+block+src.slice(at):src+block;
}

function updPaths(){
  const y=document.getElementById("in-year").value||YEAR;
  document.getElementById("p-af").textContent="documents/Application_form_"+y+"_MD"+MD+".xlsx";
  document.getElementById("p-letter").textContent="documents/Letter_to_Host_Family.docx";
}

// -------------------- enregistrement des données --------------------
function buildDistrictsLiteral(){
  const rows=Object.keys(DIST_W).sort().filter(function(d){return /^[A-Z][A-Z0-9]{0,3}$/.test(d);}).map(function(d){
    const c=DIST_W[d],g=function(k){return String(c[k]||"");}; // JSON.stringify échappe guillemets et barres obliques inverses
    return "  "+d+": {name: "+JSON.stringify(g("name"))+", club: "+JSON.stringify(g("club"))+", email: "+JSON.stringify(g("email"))+", mobile: "+JSON.stringify(g("mobile"))+"}";
  });
  return "const DISTRICTS = {\n"+rows.join(",\n")+"\n};";
}
async function saveData(){
  const btn=document.getElementById("save");btn.disabled=true;
  try{
    const season=document.getElementById("in-season").value.trim();
    const year=document.getElementById("in-year").value.trim();
    if(!/^20\d\d$/.test(year))throw new Error("the camp year must look like 2027");
    if(!season)throw new Error("season label is required");
    if(!/^\d{1,4}$/.test(MD_W))throw new Error("the multiple district number must be digits, e.g. 112");
    // camps_data.js : données communes (saison, année, camps)
    const cur=await getFile("camps_data.js");
    if(!cur)throw new Error("camps_data.js not found on main");
    let src=b64ToUtf8(cur.content);
    src=src.replace(/const SEASON = "[^"]*";/,'const SEASON = "'+season.replace(/"/g,"'")+'";');
    src=src.replace(/const YEAR = "[^"]*";/,'const YEAR = "'+year+'";');
    // districts_data.js : données propres à ce déploiement (coordinateurs) — SITE_REPO préservé
    const curD=await getFile("districts_data.js");
    if(!curD)throw new Error("districts_data.js not found on main");
    let srcD=b64ToUtf8(curD.content);
    if(!/const DISTRICTS = \{[\s\S]*?\n\};/.test(srcD))throw new Error("DISTRICTS block not found");
    srcD=srcD.replace(/const DISTRICTS = \{[\s\S]*?\n\};/,function(){return buildDistrictsLiteral();});
    srcD=srcD.replace(/^const MD = "[^"]*";$/m,function(){return 'const MD = "'+MD_W+'";';});
    const ann=document.getElementById("in-announce").value.trim();
    if(/\n  announce: /.test(srcD))srcD=srcD.replace(/\n  announce: "(?:[^"\\]|\\.)*",/,function(){return "\n  announce: "+JSON.stringify(ann)+",";});
    const galU=GAL.filter(function(g,i){return GAL.findIndex(function(x){return x.src===g.src;})===i;}); // jamais deux fois la même photo
    if(/const GALLERY = \[[\s\S]*?\];/.test(srcD))srcD=srcD.replace(/const GALLERY = \[[\s\S]*?\];/,function(){return "const GALLERY = "+JSON.stringify(galU)+";";});
    srcD=upsertConst(srcD,"TEAM",TEAM_W,"Équipe nationale affichée sur la page d'accueil — gérée depuis la page d'administration.");
    srcD=upsertConst(srcD,"UPLOAD_LIMITS",limValues(),"Contrôles de poids/taille des pièces jointes du formulaire (scan, photo, PDF) — gérés depuis la page d'administration.");
    srcD=upsertConst(srcD,"PAYMENT",paymentValues(),"Frais de dossier et coordonnées bancaires — gérés depuis la page d'administration.");
    const changes=[];
    if(src!==b64ToUtf8(cur.content))changes.push({path:"camps_data.js",b64:utf8ToB64(src),sha:cur.sha});
    if(srcD!==b64ToUtf8(curD.content))changes.push({path:"districts_data.js",b64:utf8ToB64(srcD),sha:curD.sha});
    if(!changes.length){log("Nothing changed — no commit made.","info");btn.disabled=false;return;}
    const sha=await commitFiles(changes,"Admin: update "+changes.map(function(c){return c.path;}).join(" + ")
      +" (season "+season+")");
    log("Data saved in one commit <b>"+sha.slice(0,7)+"</b> ("+changes.map(function(c){return esc(c.path);}).join(", ")+"). The site republishes in ~2 minutes.","ok");
  }catch(e){log("Save failed: "+esc(e.message),"err");}
  finally{btn.disabled=false;}
}

// -------------------- documents officiels --------------------
function uploadPick(inp,kind){
  const f=inp.files[0];if(!f)return;
  const y=document.getElementById("in-year").value||YEAR;
  const path="documents/"+{af:"Application_form_"+y+"_MD"+MD+".xlsx",
              commit:"Commitment to Reciprocity.docx",
              letter:"Letter_to_Host_Family.docx",
              tpl:"commit_template.docx"}[kind];
  if(!confirm("Replace "+path+" on the site with "+f.name+" ?")){inp.value="";return;}
  const fn=document.getElementById("u-"+kind);
  if(fn)fn.textContent="\u23f3 "+f.name+"\u2026";
  const r=new FileReader();
  r.onload=async function(){
    try{
      const cur=await getFile(path);
      const res=await putFile(path,bufToB64(r.result),cur?cur.sha:null,"Admin: upload "+path);
      if(fn)fn.textContent="\u2714 "+f.name+" \u2014 committed";
      log((cur?"Replaced ":"Created ")+"<b>"+esc(path)+"</b> — commit "+res.commit.sha.slice(0,7)+(kind==="af"||kind==="tpl"?" (embedded template rebuilt by the Action)":""),"ok");
    }catch(e){
      if(fn)fn.textContent="\u2716 "+f.name+" \u2014 failed";
      log("Upload of "+esc(path)+" failed: "+esc(e.message),"err");
    }
  };
  r.readAsArrayBuffer(f);
  inp.value="";
}

// -------------------- connexion : données actuelles lues sur GitHub --------------------
// Lues comme du texte (la politique de sécurité de la page interdit d'exécuter du code reçu) :
// constantes simples, tableaux JSON et lignes DISTRICTS écrites par buildDistrictsLiteral().
function parseSiteData(campsSrc,distSrc){
  const str=function(src,name){const m=new RegExp("const "+name+' = "([^"]*)";').exec(src);return m?m[1]:null;};
  const json=function(src,re){const m=re.exec(src);return m?JSON.parse(m[1]):null;};
  const span=rawSpan(campsSrc),raw=span?JSON.parse(campsSrc.slice(span[0],span[1])):null;
  const gallery=json(distSrc,/const GALLERY = (\[[\s\S]*?\]);/);
  const ann=/\n  announce: ("(?:[^"\\]|\\.)*"),/.exec(distSrc);
  const block=/const DISTRICTS = \{([\s\S]*?)\n\};/.exec(distSrc);
  const districts={};
  if(block)block[1].split("\n").forEach(function(line){
    const m=/^\s*([A-Z][A-Z0-9]{0,3}): \{name: ("(?:[^"\\]|\\.)*"), club: ("(?:[^"\\]|\\.)*"), email: ("(?:[^"\\]|\\.)*"), mobile: ("(?:[^"\\]|\\.)*")\}/.exec(line);
    if(m)districts[m[1]]={name:JSON.parse(m[2]),club:JSON.parse(m[3]),email:JSON.parse(m[4]),mobile:JSON.parse(m[5])};
  });
  if(!raw||!gallery||!Object.keys(districts).length||str(campsSrc,"SEASON")===null)throw new Error("unexpected file format");
  const line=function(name){const m=new RegExp("^const "+name+" = (.*);$","m").exec(distSrc);return m?JSON.parse(m[1]):null;};
  return {season:str(campsSrc,"SEASON"),year:str(campsSrc,"YEAR"),camps:raw.length,
    districts:districts,md:str(distSrc,"MD"),announce:ann?JSON.parse(ann[1]):"",gallery:gallery,team:line("TEAM"),payment:line("PAYMENT"),upload:line("UPLOAD_LIMITS")};
}
ON_CONNECT.push(async function(){
  try{
    const c=await getFile("camps_data.js"),d=await getFile("districts_data.js");
    if(!c||!d)throw new Error("data files not found on main");
    fillForm(parseSiteData(b64ToUtf8(c.content),b64ToUtf8(d.content)));
    log("Current data loaded from GitHub (not from the browser cache).","ok");
  }catch(e){
    log("Could not reload the current data from GitHub ("+esc(e.message)+"). The form may show an older cached copy: reload the page before saving.","err");
  }
});

// -------------------- démarrage --------------------
(function(){
  fillForm();
  document.getElementById("in-year").addEventListener("input",updPaths);
  initAccess();
})();

// bandeau d'annonce : bascule Édition / Aperçu (l'aperçu passe par le même nettoyage que le site public)
function annMode(m){
  const ta=document.getElementById("in-announce"),pv=document.getElementById("ann-prev");
  const prev=m==="prev";
  if(prev){
    const v=ta.value.trim();
    pv.innerHTML=v?cleanHtml(v):'<em class="ann-empty">Empty: the site keeps its default text.</em>';
  }
  pv.hidden=!prev;ta.hidden=prev;
  document.getElementById("ann-b-edit").classList.toggle("on",!prev);
  document.getElementById("ann-b-prev").classList.toggle("on",prev);
}
