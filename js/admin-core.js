// admin-core.js — tronc commun des pages d'administration (yce_admin.html, yce_camps.html) :
// chiffrement du jeton par PIN, API GitHub du dépôt, connexion/déconnexion.
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
const TOKEN_KEY="yce_admin_token";          // ancien stockage en clair : n'est plus lu, seulement effacé
const ENC_KEY="yce_admin_token_enc";        // jeton chiffré par phrase secrète (PBKDF2 + AES-GCM)
const PASS_MIN=8;                           // longueur minimale de la phrase secrète
const KDF_ITER=600000;                      // PBKDF2-SHA256, niveau recommandé OWASP ; 310000 pour les anciens blocs
let ADMIN_TOKEN="";                          // jeton déverrouillé : en mémoire uniquement, jamais remis dans la page
let UPGRADE=false;                           // déverrouillé avec un ancien PIN court : nouvelle phrase secrète attendue

// -------------------- chiffrement local du jeton par phrase secrète --------------------
function b64e(a){let s="";for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s);}
function b64d(s){const b=atob(s);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
async function pinKey(pin,salt,iter){
  const km=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:iter||KDF_ITER,hash:"SHA-256"},km,
    {name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encryptToken(tok,pin){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:iv},await pinKey(pin,salt,KDF_ITER),new TextEncoder().encode(tok)));
  return "v2."+b64e(salt)+"."+b64e(iv)+"."+b64e(ct);
}
async function decryptToken(blob,pin){
  try{
    let p=blob.split("."),iter=310000;          // ancien format : salt.iv.ct (310k itérations)
    if(p[0]==="v2"){p=p.slice(1);iter=KDF_ITER;}
    const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64d(p[1])},await pinKey(pin,b64d(p[0]),iter),b64d(p[2]));
    return new TextDecoder().decode(pt);
  }catch(e){return null;} // mauvaise phrase secrète (ou bloc corrompu)
}
function hasEnc(){try{return !!localStorage.getItem(ENC_KEY);}catch(e){return false;}}
function accessMode(mode){ // "token" = première connexion ; "pin" = déverrouillage ; "upgrade" = remplacer un ancien PIN court
  document.getElementById("f-token").style.display=mode==="token"?"":"none";
  document.getElementById("pin-lbl").textContent=mode==="pin"?"Passphrase":(mode==="upgrade"?"New passphrase":"Passphrase")+" ("+PASS_MIN+"+ characters)";
  if(mode==="upgrade"){document.getElementById("access-hint").innerHTML="Your old PIN is too short to protect the token. <b>Choose a new passphrase of at least "+PASS_MIN+" characters</b> and press Connect: the token is re-encrypted on this device, no need to paste it again.";return;}
  document.getElementById("access-hint").innerHTML=mode==="pin"
    ?"Enter the passphrase chosen on this device to unlock the encrypted token. <a href=\"#\" onclick=\"logout();return false\" style=\"color:var(--blue)\">Use another token instead\u2026</a>"
    :"First time: paste the token and choose a passphrase of at least "+PASS_MIN+" characters \u2014 the token is then stored <b>encrypted with your passphrase</b> on this device, and next visits only ask for the passphrase. Without a passphrase the token is not remembered.";
}
function log(msg,cls){
  const l=document.getElementById("log");
  l.innerHTML='<div class="'+(cls||"info")+'">'+new Date().toLocaleTimeString()+" — "+msg+"</div>"+l.innerHTML;
}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

// -------------------- API GitHub --------------------
function token(){return ADMIN_TOKEN||document.getElementById("token").value.trim();}
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
async function getFile(path,ref){
  const r=await gh("repos/"+REPO+"/contents/"+encodeURIComponent(path).replace(/%2F/g,"/")+"?ref="+encodeURIComponent(ref||"main"));
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
// Commit atomique de plusieurs fichiers sur main (API Git Data) : tout est publié ou rien.
// changes = [{path, b64, sha}] où sha est l'empreinte du fichier lue avant modification
// (null pour un nouveau fichier) : si quelqu'un l'a changé entre-temps, rien n'est écrit.
async function commitFiles(changes,message){
  const post=async function(path,body,method){
    const r=await gh("repos/"+REPO+"/"+path,{method:method||"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(r.status===404)throw new Error("HTTP 404 — check the token's repository access");
    return r.json();
  };
  const ref=await (await gh("repos/"+REPO+"/git/ref/heads/main")).json();
  const head=ref.object.sha;
  const base=await (await gh("repos/"+REPO+"/git/commits/"+head)).json();
  for(const c of changes){
    const cur=await getFile(c.path,head);
    if((cur?cur.sha:null)!==(c.sha||null))
      throw new Error(c.path+" was changed on GitHub in the meantime — reload the page and redo your changes");
  }
  const tree=[];
  for(const c of changes){
    const blob=await post("git/blobs",{content:c.b64,encoding:"base64"});
    tree.push({path:c.path,mode:"100644",type:"blob",sha:blob.sha});
  }
  const t=await post("git/trees",{base_tree:base.tree.sha,tree:tree});
  const commit=await post("git/commits",{message:message,tree:t.sha,parents:[head]});
  try{await post("git/refs/heads/main",{sha:commit.sha,force:false},"PATCH");}
  catch(e){throw new Error("main moved while saving — nothing was published, please save again ("+e.message+")");}
  return commit.sha;
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
    const pin=document.getElementById("pin").value;
    if(UPGRADE&&ADMIN_TOKEN){ // remplacement de l'ancien PIN : le jeton est déjà déverrouillé en mémoire
      if(pin.length<PASS_MIN)throw new Error("the passphrase needs at least "+PASS_MIN+" characters");
      localStorage.setItem(ENC_KEY,await encryptToken(ADMIN_TOKEN,pin));
      UPGRADE=false;document.getElementById("pin").value="";accessMode("pin");
      log("Passphrase saved: the token is now protected by your new passphrase.","ok");
      return;
    }
    let unlocked=false;
    if(hasEnc()&&!token()){ // mode déverrouillage : la phrase secrète déchiffre le jeton mémorisé
      if(!pin)throw new Error("enter your passphrase");
      const tok=await decryptToken(localStorage.getItem(ENC_KEY),pin);
      if(!tok)throw new Error("wrong passphrase");
      ADMIN_TOKEN=tok;unlocked=true;
    }else{
      if(pin&&pin.length<PASS_MIN)throw new Error("the passphrase needs at least "+PASS_MIN+" characters");
      ADMIN_TOKEN=document.getElementById("token").value.trim();
    }
    document.getElementById("token").value=""; // le jeton ne reste pas lisible dans la page
    const r=await gh("user");
    if(r.status===404)throw new Error("invalid token");
    const u=await r.json();
    const probe=await getFile("camps_data.js");
    if(!probe)throw new Error("token cannot read this repository (grant Contents on "+REPO+")");
    try{
      localStorage.removeItem(TOKEN_KEY);
      if(pin.length>=PASS_MIN){ // mémorisation chiffrée uniquement (re-chiffré au format actuel)
        localStorage.setItem(ENC_KEY,await encryptToken(ADMIN_TOKEN,pin));
      }else if(unlocked){ // ancien PIN court : on demande tout de suite une phrase secrète plus forte
        UPGRADE=true;accessMode("upgrade");
        log("Your PIN is too short to keep protecting the token: choose a new passphrase of at least "+PASS_MIN+" characters above.","warn");
      }
    }catch(e){}
    document.getElementById("pin").value="";
    const who=document.getElementById("who");
    who.textContent="✔ "+u.login;who.style.display="";
    document.getElementById("panel").style.display="";
    log("Connected as <b>"+esc(u.login)+"</b>","ok");
    if(typeof onConnected==="function")onConnected();
  }catch(e){if(!UPGRADE)ADMIN_TOKEN="";log("Connection failed: "+esc(e.message),"err");}
  finally{btn.disabled=false;}
}
function logout(){
  try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(ENC_KEY);}catch(e){}
  ADMIN_TOKEN="";UPGRADE=false;
  document.getElementById("token").value="";
  document.getElementById("pin").value="";
  accessMode("token");
  document.getElementById("panel").style.display="none";
  document.getElementById("who").style.display="none";
  log("Token forgotten on this device.");
  if(typeof onLoggedOut==="function")onLoggedOut();
}

// démarrage commun : phrase secrète si un jeton chiffré existe, sinon champ jeton.
// Un ancien jeton stocké en clair n'est jamais réutilisé : il est effacé.
function initAccess(){
  try{if(localStorage.getItem(TOKEN_KEY)){localStorage.removeItem(TOKEN_KEY);
    log("An old unencrypted token was found on this device and deleted. Paste your token again and choose a passphrase.","warn");}}catch(e){}
  if(hasEnc()){accessMode("pin");document.getElementById("pin").focus();return;}
  accessMode("token");
}

