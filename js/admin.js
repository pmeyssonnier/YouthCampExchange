// admin.js — administration du site : édite le dépôt GitHub via son API (aucun serveur dédié)
// Chargé par yce_admin.html ; le jeton reste dans le navigateur de l'administrateur.
"use strict";
// Dépôt administré : détecté depuis l'URL sur *.github.io, sinon SITE_REPO (districts_data.js).
// Un fork national fonctionne ainsi sans toucher au code.
const REPO=(function(){
  if(/\.github\.io$/.test(location.hostname)){
    const seg=location.pathname.split("/").filter(Boolean);
    if(seg.length)return location.hostname.split(".")[0]+"/"+seg[0];
  }
  return (typeof SITE_REPO!=="undefined"&&SITE_REPO)||"pmeyssonnier/YouthCampExchange";
})();
const TOKEN_KEY="yce_admin_token";          // héritage : jeton en clair (migré vers le stockage chiffré à la 1re connexion avec PIN)
const ENC_KEY="yce_admin_token_enc";        // jeton chiffré par PIN (PBKDF2 310k + AES-GCM)

// -------------------- chiffrement local du jeton par PIN --------------------
function b64e(a){let s="";for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s);}
function b64d(s){const b=atob(s);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
async function pinKey(pin,salt){
  const km=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:310000,hash:"SHA-256"},km,
    {name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encryptToken(tok,pin){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:iv},await pinKey(pin,salt),new TextEncoder().encode(tok)));
  return b64e(salt)+"."+b64e(iv)+"."+b64e(ct);
}
async function decryptToken(blob,pin){
  try{
    const p=blob.split(".");
    const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64d(p[1])},await pinKey(pin,b64d(p[0])),b64d(p[2]));
    return new TextDecoder().decode(pt);
  }catch(e){return null;} // mauvais PIN (ou blob corrompu)
}
function hasEnc(){try{return !!localStorage.getItem(ENC_KEY);}catch(e){return false;}}
function accessMode(mode){ // "token" = première connexion ; "pin" = déverrouillage
  document.getElementById("f-token").style.display=mode==="pin"?"none":"";
  document.getElementById("pin-lbl").textContent=mode==="pin"?"PIN":"PIN (4+ digits)";
  document.getElementById("access-hint").innerHTML=mode==="pin"
    ?"Enter the PIN chosen on this device to unlock the encrypted token. <a href=\"#\" onclick=\"logout();return false\" style=\"color:var(--blue)\">Use another token instead\u2026</a>"
    :"First time: paste the token and choose a PIN \u2014 the token is then stored <b>encrypted with your PIN</b> on this device, and next visits only ask for the PIN. Without a PIN the token is not remembered.";
}
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
    const pin=document.getElementById("pin").value.trim();
    if(hasEnc()&&!token()){ // mode déverrouillage : le PIN décrypte le jeton mémorisé
      if(!pin)throw new Error("enter your PIN");
      const tok=await decryptToken(localStorage.getItem(ENC_KEY),pin);
      if(!tok)throw new Error("wrong PIN");
      document.getElementById("token").value=tok;
    }
    if(pin&&pin.length<4)throw new Error("the PIN needs at least 4 digits");
    const r=await gh("user");
    if(r.status===404)throw new Error("invalid token");
    const u=await r.json();
    const probe=await getFile("camps_data.js");
    if(!probe)throw new Error("token cannot read this repository (grant Contents on "+REPO+")");
    try{
      const pin=document.getElementById("pin").value.trim();
      if(pin){ // mémorisation chiffrée uniquement — l'ancien stockage en clair est purgé
        localStorage.setItem(ENC_KEY,await encryptToken(token(),pin));
        localStorage.removeItem(TOKEN_KEY);
      }
    }catch(e){}
    const who=document.getElementById("who");
    who.textContent="✔ "+u.login;who.style.display="";
    document.getElementById("panel").style.display="";
    log("Connected as <b>"+esc(u.login)+"</b>","ok");
  }catch(e){log("Connection failed: "+esc(e.message),"err");}
  finally{btn.disabled=false;}
}
function logout(){
  try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(ENC_KEY);}catch(e){}
  document.getElementById("token").value="";
  document.getElementById("pin").value="";
  accessMode("token");
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
    return '<div class="fld w1" style="justify-content:center"><span class="badge">'+MD+' '+d+'</span></div>'
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
    // camps_data.js : données communes (saison, année, camps)
    const cur=await getFile("camps_data.js");
    if(!cur)throw new Error("camps_data.js not found on main");
    let src=b64ToUtf8(cur.content);
    src=src.replace(/const SEASON = "[^"]*";/,'const SEASON = "'+season.replace(/"/g,"'")+'";');
    src=src.replace(/const YEAR = "[^"]*";/,'const YEAR = "'+year+'";');
    if(NEW_CAMPS){
      if(!/const RAW = \[[\s\S]*?\];/.test(src))throw new Error("RAW block not found");
      src=src.replace(/const RAW = \[[\s\S]*?\];/,"const RAW = "+JSON.stringify(NEW_CAMPS)+";");
    }
    // districts_data.js : données propres à ce déploiement (coordinateurs) — SITE_REPO préservé
    const curD=await getFile("districts_data.js");
    if(!curD)throw new Error("districts_data.js not found on main");
    let srcD=b64ToUtf8(curD.content);
    if(!/const DISTRICTS = \{[\s\S]*?\n\};/.test(srcD))throw new Error("DISTRICTS block not found");
    srcD=srcD.replace(/const DISTRICTS = \{[\s\S]*?\n\};/,buildDistrictsLiteral());
    let commits=[];
    if(src!==b64ToUtf8(cur.content)){
      const r1=await putFile("camps_data.js",utf8ToB64(src),cur.sha,
        "Admin: update season data ("+season+(NEW_CAMPS?", "+NEW_CAMPS.length+" camps":"")+")");
      commits.push(r1.commit.sha.slice(0,7));
    }
    if(srcD!==b64ToUtf8(curD.content)){
      const r2=await putFile("districts_data.js",utf8ToB64(srcD),curD.sha,"Admin: update district coordinators");
      commits.push(r2.commit.sha.slice(0,7));
    }
    if(!commits.length){log("Nothing changed — no commit made.","info");btn.disabled=false;return;}
    log("Data saved — commit"+(commits.length>1?"s":"")+" <b>"+commits.join(", ")+"</b>. The site republishes in ~2 minutes.","ok");
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
  if(hasEnc()){accessMode("pin");document.getElementById("pin").focus();return;}
  accessMode("token");
  try{const t=localStorage.getItem(TOKEN_KEY);if(t){document.getElementById("token").value=t;connect();}}catch(e){}
})();
