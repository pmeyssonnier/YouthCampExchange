// admin.js — page d'administration du site (saison, districts, camps, accueil, documents)
// Chargé par yce_admin.html après js/admin-core.js ; scripts classiques partageant la portée globale.
"use strict";
let NEW_CAMPS=null; // liste de camps en attente d'enregistrement (upload JSON)
let GAL=[];         // galerie en cours d'édition (copie de GALLERY, enregistrée avec Save)

// -------------------- formulaire --------------------
function fillForm(){
  document.getElementById("in-season").value=SEASON;
  document.getElementById("in-year").value=YEAR;
  const b=document.getElementById("dist-body");
  b.innerHTML=Object.keys(DISTRICTS).map(function(d){
    const c=DISTRICTS[d];
    return '<div class="fld w1" style="justify-content:center"><span class="badge">'+MD+' '+d+'</span></div>'
      +'<div class="fld w2"><label class="flbl">Name (as on the form)</label><input id="d-'+d+'-name" value="'+esc(c.name)+'"></div>'
      +'<div class="fld w3"><label class="flbl">Lions club</label><input id="d-'+d+'-club" value="'+esc(c.club||"")+'"></div>'
      +'<div class="fld w1"></div>'
      +'<div class="fld w2"><label class="flbl">E-mail</label><input id="d-'+d+'-email" value="'+esc(c.email)+'"></div>'
      +'<div class="fld w3"><label class="flbl">Mobile</label><input id="d-'+d+'-mobile" value="'+esc(c.mobile)+'"></div>';
  }).join("");
  document.getElementById("camps-note").textContent=RAW.length+" camps currently on the site (season "+SEASON+")";
  document.getElementById("in-announce").value=(typeof SITE!=="undefined"&&SITE.announce)||"";
  GAL=(typeof GALLERY!=="undefined")?GALLERY.slice():[];
  galShow();
  updPaths();
}
function updPaths(){
  const y=document.getElementById("in-year").value||YEAR;
  document.getElementById("p-af").textContent="Application_form_"+y+"_MD"+MD+".xlsx";
  document.getElementById("p-letter").textContent="Letter_to_Host_Family_"+y+".docx";
}

function campsPick(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=function(){
    try{
      let d=JSON.parse(r.result);
      if(d&&d.camps)d=d.camps;
      if(!Array.isArray(d)||!d.length||!d[0].camp_name||!d[0].country)throw new Error("expected an array of camps with country/camp_name");
      NEW_CAMPS=d;
      const cf=document.getElementById("camps-fname");
      cf.textContent="\u2714 "+f.name+" \u2014 "+d.length+" camps staged";cf.style.color="var(--accent)";
      document.getElementById("camps-note").innerHTML='<span style="color:var(--orange)">'+d.length+" camps staged from "+esc(f.name)+" — press “Save the data”</span>";
      log(d.length+" camps loaded from "+esc(f.name)+" (staged)","ok");
    }catch(e){
      const cf=document.getElementById("camps-fname");
      cf.textContent="\u2716 "+f.name+" rejected";cf.style.color="var(--red)";
      log("Camp file rejected: "+esc(e.message),"err");
    }
  };
  r.readAsText(f);
  inp.value="";
}

// -------------------- galerie de la page d'accueil --------------------
function galShow(){
  const l=document.getElementById("gal-list");
  if(!l)return;
  l.innerHTML=GAL.length?GAL.map(function(g,i){
    return '<div class="upl" style="padding:7px 12px;"><img src="'+esc(g.src)+'" alt="" style="height:36px;width:54px;object-fit:cover;border-radius:5px;">'
      +'<input value="'+esc(g.caption||"")+'" placeholder="Caption…" style="flex:1;min-width:120px;" onchange="GAL['+i+'].caption=this.value">'
      +'<button type="button" class="btn2" onclick="GAL.splice('+i+',1);galShow()">✕</button></div>';
  }).join(""):'<span class="hint">No photos yet — the gallery section stays hidden on the site.</span>';
}
function galPick(inp){
  const f=inp.files[0];if(!f)return;
  const fn=document.getElementById("gal-fname");
  const r=new FileReader();
  r.onload=function(){
    const img=new Image();
    img.onload=async function(){
      const MAX=1200,k=Math.min(1,MAX/Math.max(img.width,img.height));
      const cv=document.createElement("canvas");
      cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);
      cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
      const b64=cv.toDataURL("image/jpeg",0.85).split(",")[1];
      const name=f.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\.[^.]+$/,"").replace(/[^A-Za-z0-9_-]+/g,"_").toLowerCase()||"photo";
      const path="assets/gallery/"+name+".jpg";
      try{
        fn.textContent="\u23f3 "+f.name+"\u2026";
        const cur=await getFile(path);
        await putFile(path,b64,cur?cur.sha:null,"Admin: gallery photo "+path);
        if(!GAL.some(function(g){return g.src===path;}))GAL.push({src:path,caption:""}); // même nom = photo remplacée, pas une 2e entrée
        galShow();
        fn.textContent="\u2714 "+f.name+" uploaded — add a caption, then Save the data";
        log("Gallery photo committed: "+esc(path),"ok");
      }catch(e){fn.textContent="\u2716 "+f.name+" failed";log("Gallery upload failed: "+esc(e.message),"err");}
    };
    img.src=r.result;
  };
  r.readAsDataURL(f);
  inp.value="";
}

// -------------------- enregistrement des données --------------------
function buildDistrictsLiteral(){
  const rows=Object.keys(DISTRICTS).map(function(d){
    const g=function(k){return document.getElementById("d-"+d+"-"+k).value.trim();}; // JSON.stringify échappe guillemets et barres obliques inverses
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
    // camps_data.js : données communes (saison, année, camps)
    const cur=await getFile("camps_data.js");
    if(!cur)throw new Error("camps_data.js not found on main");
    let src=b64ToUtf8(cur.content);
    src=src.replace(/const SEASON = "[^"]*";/,'const SEASON = "'+season.replace(/"/g,"'")+'";');
    src=src.replace(/const YEAR = "[^"]*";/,'const YEAR = "'+year+'";');
    if(NEW_CAMPS){
      if(!/const RAW = \[[\s\S]*?\];/.test(src))throw new Error("RAW block not found");
      src=src.replace(/const RAW = \[[\s\S]*?\];/,function(){return "const RAW = "+JSON.stringify(NEW_CAMPS)+";";});
    }
    // districts_data.js : données propres à ce déploiement (coordinateurs) — SITE_REPO préservé
    const curD=await getFile("districts_data.js");
    if(!curD)throw new Error("districts_data.js not found on main");
    let srcD=b64ToUtf8(curD.content);
    if(!/const DISTRICTS = \{[\s\S]*?\n\};/.test(srcD))throw new Error("DISTRICTS block not found");
    srcD=srcD.replace(/const DISTRICTS = \{[\s\S]*?\n\};/,function(){return buildDistrictsLiteral();});
    const ann=document.getElementById("in-announce").value.trim();
    if(/\n  announce: /.test(srcD))srcD=srcD.replace(/\n  announce: "(?:[^"\\]|\\.)*",/,function(){return "\n  announce: "+JSON.stringify(ann)+",";});
    const galU=GAL.filter(function(g,i){return GAL.findIndex(function(x){return x.src===g.src;})===i;}); // jamais deux fois la même photo
    if(/const GALLERY = \[[\s\S]*?\];/.test(srcD))srcD=srcD.replace(/const GALLERY = \[[\s\S]*?\];/,function(){return "const GALLERY = "+JSON.stringify(galU)+";";});
    const changes=[];
    if(src!==b64ToUtf8(cur.content))changes.push({path:"camps_data.js",b64:utf8ToB64(src),sha:cur.sha});
    if(srcD!==b64ToUtf8(curD.content))changes.push({path:"districts_data.js",b64:utf8ToB64(srcD),sha:curD.sha});
    if(!changes.length){log("Nothing changed — no commit made.","info");btn.disabled=false;return;}
    const sha=await commitFiles(changes,"Admin: update "+changes.map(function(c){return c.path;}).join(" + ")
      +" (season "+season+(NEW_CAMPS?", "+NEW_CAMPS.length+" camps":"")+")");
    log("Data saved in one commit <b>"+sha.slice(0,7)+"</b> ("+changes.map(function(c){return esc(c.path);}).join(", ")+"). The site republishes in ~2 minutes.","ok");
    if(NEW_CAMPS){
      const cf=document.getElementById("camps-fname");
      cf.textContent="\u2714 "+NEW_CAMPS.length+" camps saved into camps_data.js";cf.style.color="var(--accent)";
      document.getElementById("camps-note").textContent=NEW_CAMPS.length+" camps on the site (season "+season+")";
    }
    NEW_CAMPS=null;
  }catch(e){log("Save failed: "+esc(e.message),"err");}
  finally{btn.disabled=false;}
}

// -------------------- documents officiels --------------------
function uploadPick(inp,kind){
  const f=inp.files[0];if(!f)return;
  const y=document.getElementById("in-year").value||YEAR;
  const path={af:"Application_form_"+y+"_MD"+MD+".xlsx",
              commit:"Commitment to Reciprocity.docx",
              letter:"Letter_to_Host_Family_"+y+".docx",
              tpl:"tools/commit_template.docx"}[kind];
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

// -------------------- démarrage --------------------
(function(){
  fillForm();
  document.getElementById("in-year").addEventListener("input",updPaths);
  initAccess();
})();
