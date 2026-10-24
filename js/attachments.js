// attachments.js — photo d'identité, preuve de paiement, pièce d'identité, lettre
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- photo d'identité --------------------
const PHOTO={dataUrl:null,w:0,h:0};
function photoPick(inp){
  const file=inp.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=function(){
    const img=new Image();
    img.onload=function(){
      const MAX=800;
      let w=img.width,h=img.height;
      const k=Math.min(1,MAX/Math.max(w,h));
      w=Math.round(w*k);h=Math.round(h*k);
      const cv=document.createElement("canvas");cv.width=w;cv.height=h;
      cv.getContext("2d").drawImage(img,0,0,w,h);
      PHOTO.dataUrl=cv.toDataURL("image/jpeg",0.85);PHOTO.w=w;PHOTO.h=h;
      photoShow();upd();
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
// PDF tel quel ; image réduite à 1600 px en JPEG
function readDoc(inp,obj,showFn,label){
  const file=inp.files[0];if(!file)return;
  const finish=function(dataUrl,ext){
    obj.dataUrl=dataUrl;obj.name=file.name;obj.ext=ext;
    showFn();upd();
  };
  if(file.type==="application/pdf"){
    const r=new FileReader();
    r.onload=function(){finish(r.result,"pdf");};
    r.readAsDataURL(file);
  }else if(/^image\//.test(file.type)){
    const r=new FileReader();
    r.onload=function(){
      const img=new Image();
      img.onload=function(){
        const MAX=1600;
        let w=img.width,h=img.height;
        const k=Math.min(1,MAX/Math.max(w,h));
        w=Math.round(w*k);h=Math.round(h*k);
        const cv=document.createElement("canvas");cv.width=w;cv.height=h;
        cv.getContext("2d").drawImage(img,0,0,w,h);
        finish(cv.toDataURL("image/jpeg",0.85),"jpg");
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
function idPick(inp){readDoc(inp,IDDOC,idShow,"ID document");}
function idShow(){
  const r=idRequirement();
  docShow("id",IDDOC,"🛂 Click to add the "+(r==="passport"?"passport scan":r==="idcard"?"ID card or passport scan":"passport or ID card scan")
    +"<br>(PDF, JPG or PNG — not kept in the browser)");
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
