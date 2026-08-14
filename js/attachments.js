// attachments.js — photo d'identité et preuve de paiement
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

// -------------------- preuve de paiement des frais administratifs --------------------
const PAY={dataUrl:null,name:null,ext:null};
function payPick(inp){
  const file=inp.files[0];if(!file)return;
  const finish=function(dataUrl,ext){
    PAY.dataUrl=dataUrl;PAY.name=file.name;PAY.ext=ext;
    payShow();upd();
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
    setStatus("⚠ Payment proof: please provide a PDF or an image.",true);
  }
  inp.value="";
}
function payShow(){
  const im=document.getElementById("pay-img");if(!im)return;
  const hint=document.getElementById("pay-hint"),clr=document.getElementById("pay-clear");
  if(PAY.dataUrl){
    if(PAY.ext==="jpg"){im.src=PAY.dataUrl;im.style.display="";hint.style.display="none";}
    else{im.style.display="none";hint.style.display="";hint.innerHTML="📎 "+esc(PAY.name)+"<br>(PDF ready — click to replace)";}
    clr.style.display="";
  }else{
    im.style.display="none";clr.style.display="none";
    hint.style.display="";hint.innerHTML="🧾 Click to add the payment proof<br>(PDF, JPG or PNG — downloaded with the file)";
  }
}
function payClear(e){e.stopPropagation();PAY.dataUrl=null;PAY.name=null;PAY.ext=null;payShow();upd();}

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
