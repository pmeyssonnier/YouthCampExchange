// attachments.js — photo d'identité, preuve de paiement, pièce d'identité, lettre
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- contrôles de taille des pièces jointes --------------------
// seuils : voir js/upload-limits.js (réglables depuis l'administration)
function fmtSize(b){return b>=1048576?(b/1048576).toFixed(1)+" MB":Math.max(1,Math.round(b/1024))+" KB";}
function dataUrlBytes(u){const i=u.indexOf(",");return Math.round((u.length-i-1)*3/4);}
// réduit l'image (dimensions puis qualité JPEG) jusqu'à passer sous maxKb ; -> {dataUrl,w,h}
function shrinkImage(img,maxPx,maxKb){
  let k=Math.min(1,maxPx/Math.max(img.width,img.height));
  for(let pass=0;pass<8;pass++){
    const w=Math.max(1,Math.round(img.width*k)),h=Math.max(1,Math.round(img.height*k));
    const cv=document.createElement("canvas");cv.width=w;cv.height=h;
    cv.getContext("2d").drawImage(img,0,0,w,h);
    let q=0.85,url=cv.toDataURL("image/jpeg",q);
    while(dataUrlBytes(url)>maxKb*1024&&q>0.45){q-=0.1;url=cv.toDataURL("image/jpeg",q);}
    if(dataUrlBytes(url)<=maxKb*1024||pass===7)return {dataUrl:url,w:w,h:h};
    k*=0.8;
  }
}
// message de refus, ou "" si le fichier convient
function tooSmallMsg(file,img,lim,label,kind){
  const kb=file.size/1024;
  if(kind==="photo"&&Math.min(img.width,img.height)<lim.minSidePx)
    return label+" too small ("+img.width+"×"+img.height+" px): the shorter side must be at least "+lim.minSidePx+" px.";
  if(kind==="id"&&Math.max(img.width,img.height)<lim.minLongPx)
    return label+" too small ("+img.width+"×"+img.height+" px): the longer side must be at least "+lim.minLongPx+" px — please scan or photograph it again at a higher quality.";
  if(lim.minKb&&kb<lim.minKb)return label+" too light ("+fmtSize(file.size)+"): at least "+lim.minKb+" KB expected — the file looks too compressed or incomplete.";
  return "";
}
function reducedNote(label,before,after){return before>after*1.15?"ℹ "+label+" reduced from "+fmtSize(before)+" to "+fmtSize(after)+".":"";}

// -------------------- photo d'identité --------------------
const PHOTO={dataUrl:null,w:0,h:0};
function photoPick(inp){
  const file=inp.files[0];if(!file)return;
  const lim=uploadLimits().photo;
  const r=new FileReader();
  r.onload=function(){
    const img=new Image();
    img.onerror=function(){setStatus("⚠ Photo: this file is not a readable image.",true);};
    img.onload=function(){
      const bad=tooSmallMsg(file,img,lim,"Photo","photo");
      if(bad){setStatus("⚠ "+bad,true);return;}
      const o=shrinkImage(img,lim.maxPx,lim.maxKb);
      PHOTO.dataUrl=o.dataUrl;PHOTO.w=o.w;PHOTO.h=o.h;
      photoShow();upd();
      const n=reducedNote("Photo",file.size,dataUrlBytes(o.dataUrl));if(n)setStatus(n,false);
    };
    img.src=r.result;
  };
  r.readAsDataURL(file);
  inp.value="";
}
function photoShow(){
  const im=document.getElementById("photo-img");if(!im)return;
  const hint=document.getElementById("photo-hint"),clr=document.getElementById("photo-clear");
  if(PHOTO.dataUrl){im.src=PHOTO.dataUrl;im.style.display="";hint.style.display="none";clr.style.display="";}
  else{im.style.display="none";hint.style.display="";clr.style.display="none";}
}
function photoClear(e){e.stopPropagation();PHOTO.dataUrl=null;PHOTO.w=PHOTO.h=0;photoShow();upd();}

// -------------------- pièces PDF ou image (paiement, pièce d'identité) --------------------
// PDF tel quel (poids borné) ; image réduite en JPEG selon UPLOAD_LIMITS
function readDoc(inp,obj,showFn,label,kind){ // kind "id" : contrôle de résolution minimale ; sinon seulement la réduction
  const file=inp.files[0];if(!file)return;
  const L=uploadLimits(),lim=L.id,pl=L.pdf;
  const finish=function(dataUrl,ext,note){
    obj.dataUrl=dataUrl;obj.name=file.name;obj.ext=ext;
    showFn();upd();
    if(note)setStatus(note,false);
  };
  const isPdf=file.type==="application/pdf"||/\.pdf$/i.test(file.name);
  if(isPdf){
    if(file.size<pl.minKb*1024){setStatus("⚠ "+label+" too light ("+fmtSize(file.size)+"): a PDF of at least "+pl.minKb+" KB is expected.",true);inp.value="";return;}
    if(file.size>pl.maxKb*1024){setStatus("⚠ "+label+" too big ("+fmtSize(file.size)+"): the maximum for a PDF is "+fmtSize(pl.maxKb*1024)+". Scan it again at a lower resolution, or as a JPG (the site reduces images automatically).",true);inp.value="";return;}
    const r=new FileReader();
    r.onload=function(){finish(r.result,"pdf");};
    r.readAsDataURL(file);
  }else if(/^image\//.test(file.type)){
    const r=new FileReader();
    r.onload=function(){
      const img=new Image();
      img.onerror=function(){setStatus("⚠ "+label+": this file is not a readable image.",true);};
      img.onload=function(){
        const bad=kind==="id"?tooSmallMsg(file,img,lim,label,"id"):"";
        if(bad){setStatus("⚠ "+bad,true);return;}
        const o=shrinkImage(img,lim.maxPx,lim.maxKb);
        finish(o.dataUrl,"jpg",reducedNote(label,file.size,dataUrlBytes(o.dataUrl)));
      };
      img.src=r.result;
    };
    r.readAsDataURL(file);
  }else{
    setStatus("⚠ "+label+": please provide a PDF or an image.",true);
  }
  inp.value="";
}
function docShow(id,obj,emptyHint){
  const im=document.getElementById(id+"-img");if(!im)return;
  const hint=document.getElementById(id+"-hint"),clr=document.getElementById(id+"-clear");
  if(obj.dataUrl){
    if(obj.ext==="jpg"){im.src=obj.dataUrl;im.style.display="";hint.style.display="none";}
    else{im.style.display="none";hint.style.display="";hint.innerHTML="📎 "+esc(obj.name)+"<br>(PDF ready — click to replace)";}
    clr.style.display="";
  }else{
    im.style.display="none";clr.style.display="none";
    hint.style.display="";hint.innerHTML=emptyHint;
  }
}

// -------------------- preuve de paiement des frais administratifs --------------------
const PAY={dataUrl:null,name:null,ext:null};
function payPick(inp){readDoc(inp,PAY,payShow,"Payment proof");}
function payShow(){docShow("pay",PAY,"🧾 Click to add the payment proof<br>(PDF, JPG or PNG — downloaded with the file)");}
function payClear(e){e.stopPropagation();PAY.dataUrl=null;PAY.name=null;PAY.ext=null;payShow();upd();}

// -------------------- copie du passeport ou de la carte d'identité --------------------
// Pièce sensible : jamais gardée dans le brouillon du navigateur (à rajouter après un rechargement),
// jointe au dossier complet mais pas à la copie destinée au président de club.
const IDDOC={dataUrl:null,name:null,ext:null};
let IDLATER=false; // passeport en cours de renouvellement : le scan suivra (ce choix, lui, est gardé dans le brouillon)
// Pays « Europe » de la liste des camps où la carte d'identité belge ne suffit pas
// (le Royaume-Uni exige le passeport des citoyens de l'UE depuis le 1er octobre 2021).
const PASSPORT_ONLY_IN_EUROPE=["United Kingdom"];
// pièce exigée selon les pays choisis : "passport" si l'un d'eux est hors d'Europe (le jeune peut être placé
// sur n'importe lequel de ses choix), "idcard" si tous sont en Europe, "unknown" si aucun pays reconnu
function idRequirement(){
  const cont={};(typeof RAW!=="undefined"?RAW:[]).forEach(function(c){cont[c.country.toLowerCase()]=c.continent;});
  let known=0,outside=false;
  ["N10","N11","N12"].forEach(function(r){
    const el=document.getElementById("f-"+r);const v=el&&el.value.trim();if(!v)return;
    const k=cont[v.toLowerCase()];if(!k)return;
    known++;
    if(k!=="Europe"||PASSPORT_ONLY_IN_EUROPE.indexOf(v)>=0)outside=true;
  });
  return outside?"passport":(known?"idcard":"unknown");
}
function idLabel(){
  const r=idRequirement();
  return r==="passport"?"Passport scan":r==="idcard"?"ID card (or passport) scan":"Passport or ID card scan";
}
function idPick(inp){readDoc(inp,IDDOC,idShow,"ID document","id");}
function idShow(){
  const r=idRequirement();
  docShow("id",IDDOC,"🛂 Click to add the "+(r==="passport"?"passport scan":r==="idcard"?"ID card or passport scan":"passport or ID card scan")
    +"<br>(PDF, JPG or PNG — kept in this browser for 30 days)");
  const req=document.getElementById("id-req");
  if(req)req.innerHTML=r==="passport"?"<b>Passport required</b>: at least one of your choices is outside Europe"
    +" (or in the United Kingdom, which no longer accepts ID cards)."
    :r==="idcard"?"All your choices are in Europe: your <b>Belgian ID card</b> is enough."
    :"Passport if one of your camp choices is outside Europe, otherwise your Belgian ID card.";
  const lt=document.getElementById("id-later");if(lt)lt.checked=IDLATER;
}
function idClear(e){e.stopPropagation();IDDOC.dataUrl=null;IDDOC.name=null;IDDOC.ext=null;idShow();upd();}
function idLaterToggle(cb){IDLATER=cb.checked;idShow();upd();}

// -------------------- lettre à la future famille d'accueil --------------------
const LETTER={dataUrl:null,name:null,ext:null};
function letterPick(inp){
  const file=inp.files[0];if(!file)return;
  const m=/\.(docx|pdf)$/i.exec(file.name);
  if(!m){setStatus("⚠ Host-family letter: please provide a Word (.docx) or PDF file.",true);inp.value="";return;}
  const r=new FileReader();
  r.onload=function(){
    LETTER.dataUrl=r.result;LETTER.name=file.name;LETTER.ext=m[1].toLowerCase();
    letterShow();upd();
  };
  r.readAsDataURL(file);
  inp.value="";
}
function letterShow(){
  const hint=document.getElementById("letter-hint");if(!hint)return;
  const clr=document.getElementById("letter-clear");
  if(LETTER.dataUrl){hint.innerHTML="📎 "+esc(LETTER.name)+"<br>(ready — click to replace)";clr.style.display="";}
  else{hint.innerHTML="💌 Click to add your completed letter<br>(Word or PDF — included in the application file)";clr.style.display="none";}
}
function letterClear(e){e.stopPropagation();LETTER.dataUrl=null;LETTER.name=null;LETTER.ext=null;letterShow();upd();}
