// admin.js — administration du site : édite le dépôt GitHub via son API (aucun serveur dédié)
// Chargé par yce_admin.html ; le jeton reste dans le navigateur de l'administrateur.
"use strict";
const REPO="pmeyssonnier/YouthCampExchange";
const API="https://api.github.com/repos/"+REPO+"/contents/";
const TOKEN_KEY="yce_admin_token";
let NEW_CAMPS=null; // liste de camps en attente d'enregistrement (upload JSON)

function log(msg,cls){
  const l=document.getElementById("log");
  l.innerHTML='<div class="'+(cls||"info")+'">'+new Date().toLocaleTimeString()+" — "+msg+"</div>"+l.innerHTML;
}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

// -------------------- API GitHub --------------------
function token(){return document.getElementById("token").value.trim();}
async function gh(path,opts){
  opts=opts||{};
  opts.headers=Object.assign({
    "Authorization":"Bearer "+token(),
    "Accept":"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28"
  },opts.headers||{});
  const r=await fetch("https://api.github.com/"+path,opts);
  if(!r.ok&&r.status!==404){
    let m="HTTP "+r.status;
    try{m+=" — "+(await r.json()).message;}catch(e){}
    throw new Error(m);
  }
  return r;
}
async function getFile(path){
  const r=await gh("repos/"+REPO+"/contents/"+encodeURIComponent(path).replace(/%2F/g,"/")+"?ref=main");
  if(r.status===404)return null;
  return await r.json(); // {sha, content(base64), …}
}
async function putFile(path,b64,sha,msg){
  const body={message:msg,content:b64,branch:"main"};
  if(sha)body.sha=sha;
  const r=await gh("repos/"+REPO+"/contents/"+encodeURIComponent(path).replace(/%2F/g,"/"),{
    method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(r.status===404)throw new Error("HTTP 404 — check the token's repository access");
  return await r.json();
}
function b64ToUtf8(b){const bin=atob(b.replace(/\n/g,""));const a=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new TextDecoder().decode(a);}
function utf8ToB64(s){const a=new TextEncoder().encode(s);let bin="";
  for(let i=0;i<a.length;i+=8192)bin+=String.fromCharCode.apply(null,a.subarray(i,i+8192));return btoa(bin);}
function bufToB64(buf){const a=new Uint8Array(buf);let bin="";
  for(let i=0;i<a.length;i+=8192)bin+=String.fromCharCode.apply(null,a.subarray(i,i+8192));return btoa(bin);}

// -------------------- connexion --------------------
async function connect(){
  const btn=document.getElementById("connect");btn.disabled=true;
  try{
    const r=await gh("user");
    if(r.status===404)throw new Error("invalid token");
    const u=await r.json();
    const probe=await getFile("camps_data.js");
    if(!probe)throw new Error("token cannot read this repository (grant Contents on "+REPO+")");
    try{localStorage.setItem(TOKEN_KEY,token());}catch(e){}
    const who=document.getElementById("who");
    who.textContent="✔ "+u.login;who.style.display="";
    document.getElementById("panel").style.display="";
    log("Connected as <b>"+esc(u.login)+"</b>","ok");
  }catch(e){log("Connection failed: "+esc(e.message),"err");}
  finally{btn.disabled=false;}
}
function logout(){
  try{localStorage.removeItem(TOKEN_KEY);}catch(e){}
  document.getElementById("token").value="";
  document.getElementById("panel").style.display="none";
  document.getElementById("who").style.display="none";
  log("Token forgotten on this device.");
}

// -------------------- formulaire --------------------
function fillForm(){
  document.getElementById("in-season").value=SEASON;
  document.getElementById("in-year").value=YEAR;
  const b=document.getElementById("dist-body");
  b.innerHTML=Object.keys(DISTRICTS).map(function(d){
    const c=DISTRICTS[d];
    return '<div class="fld w1" style="justify-content:center"><span class="badge">112 '+d+'</span></div>'
      +'<div class="fld w2"><label class="flbl">Name (as on the form)</label><input id="d-'+d+'-name" value="'+esc(c.name)+'"></div>'
      +'<div class="fld w3"><label class="flbl">Lions club</label><input id="d-'+d+'-club" value="'+esc(c.club||"")+'"></div>'
      +'<div class="fld w1"></div>'
      +'<div class="fld w2"><label class="flbl">E-mail</label><input id="d-'+d+'-email" value="'+esc(c.email)+'"></div>'
      +'<div class="fld w3"><label class="flbl">Mobile</label><input id="d-'+d+'-mobile" value="'+esc(c.mobile)+'"></div>';
  }).join("");
  document.getElementById("camps-note").textContent=RAW.length+" camps currently on the site (season "+SEASON+")";
  updPaths();
}
function updPaths(){
  const y=document.getElementById("in-year").value||YEAR;
  document.getElementById("p-af").textContent="Application_form_"+y+"_MD112.xlsx";
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
      document.getElementById("camps-fname").textContent="\u2714 "+f.name+" \u2014 "+d.length+" camps staged";
      document.getElementById("camps-note").innerHTML='<span style="color:var(--orange)">'+d.length+" camps staged from "+esc(f.name)+" — press “Save the data”</span>";
      log(d.length+" camps loaded from "+esc(f.name)+" (staged)","ok");
    }catch(e){
      document.getElementById("camps-fname").textContent="\u2716 "+f.name+" rejected";
      log("Camp file rejected: "+esc(e.message),"err");
    }
  };
  r.readAsText(f);
  inp.value="";
}

// -------------------- enregistrement des données --------------------
function buildDistrictsLiteral(){
  const rows=Object.keys(DISTRICTS).map(function(d){
    const g=function(k){return document.getElementById("d-"+d+"-"+k).value.trim().replace(/"/g,"'");};
    return "  "+d+': {name: "'+g("name")+'", club: "'+g("club")+'", email: "'+g("email")+'", mobile: "'+g("mobile")+'"}';
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
    const cur=await getFile("camps_data.js");
    if(!cur)throw new Error("camps_data.js not found on main");
    let src=b64ToUtf8(cur.content);
    src=src.replace(/const SEASON = "[^"]*";/,'const SEASON = "'+season.replace(/"/g,"'")+'";');
    src=src.replace(/const YEAR = "[^"]*";/,'const YEAR = "'+year+'";');
    if(!/const DISTRICTS = \{[\s\S]*?\n\};/.test(src))throw new Error("DISTRICTS block not found");
    src=src.replace(/const DISTRICTS = \{[\s\S]*?\n\};/,buildDistrictsLiteral());
    if(NEW_CAMPS){
      if(!/const RAW = \[[\s\S]*?\];/.test(src))throw new Error("RAW block not found");
      src=src.replace(/const RAW = \[[\s\S]*?\];/,"const RAW = "+JSON.stringify(NEW_CAMPS)+";");
    }
    const res=await putFile("camps_data.js",utf8ToB64(src),cur.sha,
      "Admin: update season data ("+season+(NEW_CAMPS?", "+NEW_CAMPS.length+" camps":"")+")");
    log("Data saved — commit <b>"+res.commit.sha.slice(0,7)+"</b>. The site republishes in ~2 minutes.","ok");
    NEW_CAMPS=null;
  }catch(e){log("Save failed: "+esc(e.message),"err");}
  finally{btn.disabled=false;}
}

// -------------------- documents officiels --------------------
function uploadPick(inp,kind){
  const f=inp.files[0];if(!f)return;
  const y=document.getElementById("in-year").value||YEAR;
  const path={af:"Application_form_"+y+"_MD112.xlsx",
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
  try{const t=localStorage.getItem(TOKEN_KEY);if(t)document.getElementById("token").value=t;}catch(e){}
  document.getElementById("in-year")&&fillForm();
  document.getElementById("in-year").addEventListener("input",updPaths);
  if(token())connect();
})();
