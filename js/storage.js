// storage.js — brouillon persistant (localStorage)
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- brouillon persistant (localStorage) --------------------
const DRAFT_KEY="yce_form_draft_2026";
let saveTimer=null;
function saveDraft(){
  if(SIGN_MODE)return;
  try{
    const v={},t={};
    SECTIONS.forEach(function(sec){sec.fields.forEach(function(f){
      if(f.xgroup)return;
      const el=document.getElementById("f-"+f.ref);if(!el)return;
      v[f.ref]=el.value;t[f.ref]=el.dataset.tpl||"";
    });});
    const sg={};
    Object.keys(SIGS).forEach(function(k){if(SIGS[k].ink)sg[k]=SIGS[k].cv.toDataURL("image/png");});
    const au={};
    ["G20","G22"].forEach(function(r){const el=document.getElementById("f-"+r);
      if(el&&el.dataset.auto==="1")au[r]=1;});
    localStorage.setItem(DRAFT_KEY,JSON.stringify({v:v,x:XSTATE,t:t,s:sg,a:au,p:PHOTO.dataUrl?{d:PHOTO.dataUrl,w:PHOTO.w,h:PHOTO.h}:null,cm:COMMIT.agreed?{d:COMMIT.date}:null,pay:(PAY.dataUrl&&PAY.dataUrl.length<2500000)?{d:PAY.dataUrl,n:PAY.name,e:PAY.ext}:null,lt:(LETTER.dataUrl&&LETTER.dataUrl.length<2500000)?{d:LETTER.dataUrl,n:LETTER.name,e:LETTER.ext}:null}));
  }catch(e){}
}
function restoreDraft(){
  try{
    const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");
    if(!d)return;
    Object.keys(d.v||{}).forEach(function(ref){
      const el=document.getElementById("f-"+ref);if(!el)return;
      el.value=d.v[ref];
      if(d.t&&d.t[ref]!==undefined)el.dataset.tpl=d.t[ref];
      el.classList.toggle("prefilled",!!el.value&&el.value===(el.dataset.tpl||null));
    });
    Object.keys(d.x||{}).forEach(function(grp){
      const ref=d.x[grp];if(!ref)return;
      const lab=document.querySelector('.xopt[data-grp="'+grp+'"][data-ref="'+ref+'"]');
      if(!lab)return;
      lab.classList.add("on");lab.querySelector("input").checked=true;XSTATE[grp]=ref;
      depShow(grp,lab.textContent.trim()==="Yes");
    });
    Object.keys(d.a||{}).forEach(function(r){
      const el=document.getElementById("f-"+r);if(el)el.dataset.auto="1";
    });
    if(d.p&&d.p.d){PHOTO.dataUrl=d.p.d;PHOTO.w=d.p.w;PHOTO.h=d.p.h;photoShow();}
    if(d.cm&&d.cm.d){COMMIT.agreed=true;COMMIT.date=d.cm.d;commitShow();}
    if(d.pay&&d.pay.d){PAY.dataUrl=d.pay.d;PAY.name=d.pay.n;PAY.ext=d.pay.e;payShow();}
    if(d.lt&&d.lt.d){LETTER.dataUrl=d.lt.d;LETTER.name=d.lt.n;LETTER.ext=d.lt.e;letterShow();}
    Object.keys(d.s||{}).forEach(function(k){
      const st=SIGS[k];if(!st||!d.s[k])return;
      const img=new Image();
      img.onload=function(){st.ctx.drawImage(img,0,0);st.ink=true;upd();};
      img.src=d.s[k];
    });
  }catch(e){}
}
function clearForm(){
  if(!confirm("Erase all entered data and restart with a blank form?"))return;
  try{localStorage.removeItem(DRAFT_KEY);}catch(e){}
  location.reload();
}

// boutons Yes/No (valeur stockée dans un input caché : draft, sync et export inchangés)
