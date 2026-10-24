// admin.js — onglets Site (saison, coordinateurs, page d'accueil, galerie) et Documents de yce_admin.html
// Chargé après js/admin-core.js ; scripts classiques partageant la portée globale.
// La liste des camps se gère dans l'onglet Camps (js/camps-manager.js).
"use strict";
let GAL=[];         // galerie en cours d'édition (copie de GALLERY, enregistrée avec Save)

// -------------------- formulaire --------------------
// d = données à afficher ; par défaut celles chargées avec la page (peut-être une copie en cache :
// à la connexion, ON_CONNECT recharge les fichiers actuels depuis GitHub)
function fillForm(d){
  d=d||{season:SEASON,year:YEAR,districts:DISTRICTS,camps:RAW.length,
    announce:(typeof SITE!=="undefined"&&SITE.announce)||"",gallery:(typeof GALLERY!=="undefined")?GALLERY:[]};
  document.getElementById("in-season").value=d.season;
  document.getElementById("in-year").value=d.year;
  const b=document.getElementById("dist-body");
  b.innerHTML=Object.keys(d.districts).map(function(k){
    const c=d.districts[k];
    return '<div class="fld w1" style="justify-content:center"><span class="badge">'+MD+' '+k+'</span></div>'
      +'<div class="fld w2"><label class="flbl">Name (as on the form)</label><input id="d-'+k+'-name" value="'+esc(c.name)+'"></div>'
      +'<div class="fld w3"><label class="flbl">Lions club</label><input id="d-'+k+'-club" value="'+esc(c.club||"")+'"></div>'
      +'<div class="fld w1"></div>'
      +'<div class="fld w2"><label class="flbl">E-mail</label><input id="d-'+k+'-email" value="'+esc(c.email)+'"></div>'
      +'<div class="fld w3"><label class="flbl">Mobile</label><input id="d-'+k+'-mobile" value="'+esc(c.mobile)+'"></div>';
  }).join("");
  document.getElementById("camps-note").textContent=d.camps+" camps currently on the site (season "+d.season+")";
  document.getElementById("in-announce").value=d.announce||"";
  GAL=d.gallery.slice();
  galShow();
  updPaths();
}
function updPaths(){
  const y=document.getElementById("in-year").value||YEAR;
  document.getElementById("p-af").textContent="documents/Application_form_"+y+"_MD"+MD+".xlsx";
  document.getElementById("p-letter").textContent="documents/Letter_to_Host_Family_"+y+".docx";
}

// -------------------- galerie de la page d'accueil --------------------
// aperçus des photos tout juste envoyées : visibles avant que le site soit republié (2-3 min)
const GAL_PREVIEW={};
function galShow(){
  const l=document.getElementById("gal-list");
  if(!l)return;
  l.innerHTML=GAL.length?GAL.map(function(g,i){
    const src=GAL_PREVIEW[g.src]||g.src;
    return '<figure class="gal-card">'
      +'<img src="'+esc(src)+'" alt="'+esc(g.caption||"")+'" title="Click to enlarge" onclick="galZoom('+i+')">'
      +'<figcaption><input value="'+esc(g.caption||"")+'" placeholder="Caption…" onchange="GAL['+i+'].caption=this.value">'
      +'<div class="gal-tools"><span class="gal-name">'+esc(g.src.split("/").pop())+'</span>'
      +'<button type="button" class="btn2" title="Move left" onclick="galMove('+i+',-1)"'+(i?'':' disabled')+'>◀</button>'
      +'<button type="button" class="btn2" title="Move right" onclick="galMove('+i+',1)"'+(i<GAL.length-1?'':' disabled')+'>▶</button>'
      +'<button type="button" class="btn2" title="Remove from the gallery" onclick="GAL.splice('+i+',1);galShow()">✕</button></div>'
      +'</figcaption></figure>';
  }).join(""):'<span class="hint">No photos yet — the gallery section stays hidden on the site.</span>';
}
function galMove(i,d){
  const j=i+d;if(j<0||j>=GAL.length)return;
  const t=GAL[i];GAL[i]=GAL[j];GAL[j]=t;galShow();
}
// photo en grand (clic, flèches du clavier, Échap pour fermer)
function galZoom(i){
  let z=document.getElementById("gal-zoom");
  if(!z){
    z=document.createElement("div");z.id="gal-zoom";
    z.innerHTML='<img alt=""><div class="gz-cap"></div><button type="button" class="gz-prev" aria-label="Previous">‹</button><button type="button" class="gz-next" aria-label="Next">›</button>';
    z.addEventListener("click",function(e){
      if(e.target.classList.contains("gz-prev"))galZoom((+z.dataset.i-1+GAL.length)%GAL.length);
      else if(e.target.classList.contains("gz-next"))galZoom((+z.dataset.i+1)%GAL.length);
      else z.remove();
    });
    document.body.appendChild(z);
  }
  const g=GAL[i];z.dataset.i=i;
  z.querySelector("img").src=GAL_PREVIEW[g.src]||g.src;
  z.querySelector(".gz-cap").textContent=(i+1)+" / "+GAL.length+(g.caption?" — "+g.caption:"");
}
document.addEventListener("keydown",function(e){
  const z=document.getElementById("gal-zoom");if(!z)return;
  if(e.key==="Escape")z.remove();
  else if(e.key==="ArrowLeft")galZoom((+z.dataset.i-1+GAL.length)%GAL.length);
  else if(e.key==="ArrowRight")galZoom((+z.dataset.i+1)%GAL.length);
});
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
        GAL_PREVIEW[path]="data:image/jpeg;base64,"+b64;
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
              letter:"Letter_to_Host_Family_"+y+".docx",
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
  const raw=json(campsSrc,/const RAW = (\[[\s\S]*?\]);/);
  const gallery=json(distSrc,/const GALLERY = (\[[\s\S]*?\]);/);
  const ann=/\n  announce: ("(?:[^"\\]|\\.)*"),/.exec(distSrc);
  const block=/const DISTRICTS = \{([\s\S]*?)\n\};/.exec(distSrc);
  const districts={};
  if(block)block[1].split("\n").forEach(function(line){
    const m=/^\s*([A-Z]): \{name: ("(?:[^"\\]|\\.)*"), club: ("(?:[^"\\]|\\.)*"), email: ("(?:[^"\\]|\\.)*"), mobile: ("(?:[^"\\]|\\.)*")\}/.exec(line);
    if(m)districts[m[1]]={name:JSON.parse(m[2]),club:JSON.parse(m[3]),email:JSON.parse(m[4]),mobile:JSON.parse(m[5])};
  });
  if(!raw||!gallery||!Object.keys(districts).length||str(campsSrc,"SEASON")===null)throw new Error("unexpected file format");
  return {season:str(campsSrc,"SEASON"),year:str(campsSrc,"YEAR"),camps:raw.length,
    districts:districts,announce:ann?JSON.parse(ann[1]):"",gallery:gallery};
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
