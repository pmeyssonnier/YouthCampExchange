// storage.js — brouillon persistant (localStorage)
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- brouillon persistant (localStorage) --------------------
const DRAFT_KEY="yce_form_draft_"+YEAR;
// le brouillon contient des données personnelles (santé, pièce d'identité, signatures) :
// il est effacé après 30 jours sans modification
const DRAFT_MAX_DAYS=30;
let DRAFT_INFO="";
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
    localStorage.setItem(DRAFT_KEY,JSON.stringify({ts:Date.now(),v:v,x:XSTATE,t:t,s:sg,a:au,p:PHOTO.dataUrl?{d:PHOTO.dataUrl,w:PHOTO.w,h:PHOTO.h}:null,cm:COMMIT.agreed?{d:COMMIT.date}:null,pay:(PAY.dataUrl&&PAY.dataUrl.length<2500000)?{d:PAY.dataUrl,n:PAY.name,e:PAY.ext}:null,idl:IDLATER}));
  }catch(e){}
  saveFile("id",IDDOC);saveFile("letter",LETTER);
}
// pièces jointes volumineuses (scan du passeport, lettre) : IndexedDB, car localStorage est limité à ~5 Mo.
// Même durée de vie que le brouillon (30 jours) ; 🗑 Clear form les efface.
const FILE_KEYS={id:DRAFT_KEY+":id",letter:DRAFT_KEY+":letter"};
let FILES_READY=false;
const FILES_SAVED={id:null,letter:null};
function filesOp(mode,fn){
  return new Promise(function(resolve,reject){
    if(typeof indexedDB==="undefined"){reject(new Error("no indexedDB"));return;}
    const rq=indexedDB.open("yce_form_files",1);
    rq.onupgradeneeded=function(){rq.result.createObjectStore("files");};
    rq.onerror=function(){reject(rq.error);};
    rq.onsuccess=function(){
      const db=rq.result,tx=db.transaction("files",mode),out=fn(tx.objectStore("files"));
      tx.oncomplete=function(){db.close();resolve(out&&out.result);};
      tx.onerror=tx.onabort=function(){db.close();reject(tx.error);};
    };
  });
}
function saveFile(kind,obj){
  if(!FILES_READY||SIGN_MODE)return;
  const sig=obj.dataUrl?obj.name+"|"+obj.dataUrl.length:"";
  if(FILES_SAVED[kind]===sig)return;
  FILES_SAVED[kind]=sig;
  filesOp("readwrite",function(st){
    if(obj.dataUrl)st.put({ts:Date.now(),d:obj.dataUrl,n:obj.name,e:obj.ext},FILE_KEYS[kind]);
    else st.delete(FILE_KEYS[kind]);
  }).catch(function(){FILES_SAVED[kind]=null;});
}
function restoreFiles(hasDraft){
  const done=function(){FILES_READY=true;};
  if(SIGN_MODE||typeof indexedDB==="undefined"){done();return;}
  filesOp("readwrite",function(st){
    // pièces des autres saisons, ou sans brouillon valide : effacées
    const rq=st.openCursor();
    rq.onsuccess=function(){
      const c=rq.result;if(!c)return;
      if(!hasDraft||(typeof c.key==="string"&&c.key.indexOf(DRAFT_KEY+":")!==0))c.delete();
      c.continue();
    };
    const g={id:st.get(FILE_KEYS.id),letter:st.get(FILE_KEYS.letter)};
    return {get result(){return g;}};
  }).then(function(g){
    if(!hasDraft)return;
    [["id",IDDOC,idShow],["letter",LETTER,letterShow]].forEach(function(a){
      const r=g[a[0]].result;
      if(!r||!r.d||(r.ts&&Date.now()-r.ts>DRAFT_MAX_DAYS*86400000))return;
      a[1].dataUrl=r.d;a[1].name=r.n;a[1].ext=r.e;
      FILES_SAVED[a[0]]=r.n+"|"+r.d.length;
      a[2]();
    });
    upd();
  }).catch(function(){}).then(done);
}
function restoreDraft(){
  const had=restoreDraftText();
  restoreFiles(had);
}
function restoreDraftText(){
  // brouillons des autres saisons (clé yce_form_draft_<année>) : jamais relus, donc jamais expirés —
  // ils resteraient indéfiniment sur un ordinateur partagé, scan de passeport compris
  try{
    Object.keys(localStorage).forEach(function(k){
      if(/^yce_form_draft_\d{4}$/.test(k)&&k!==DRAFT_KEY)localStorage.removeItem(k);
    });
  }catch(e){}
  try{
    const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");
    if(!d)return false;
    if(d.ts&&Date.now()-d.ts>DRAFT_MAX_DAYS*86400000){
      localStorage.removeItem(DRAFT_KEY);
      DRAFT_INFO="Your previous draft was older than "+DRAFT_MAX_DAYS+" days and has been erased from this browser.";
      return false;
    }
    DRAFT_INFO="Draft restored from this browser"+(d.ts?" (last saved "+new Date(d.ts).toLocaleDateString("en-GB")+")":"")
      +". On a shared computer, click 🗑 Clear form when you have finished.";
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
    if(d.idl){IDLATER=true;idShow();}
    Object.keys(d.s||{}).forEach(function(k){
      const st=SIGS[k];if(!st||!d.s[k])return;
      const img=new Image();
      img.onload=function(){st.ctx.drawImage(img,0,0);st.ink=true;upd();};
      img.src=d.s[k];
    });
    return true;
  }catch(e){}
  return false;
}
function clearForm(){
  if(!confirm("Erase all entered data and restart with a blank form?"))return;
  try{localStorage.removeItem(DRAFT_KEY);}catch(e){}
  FILES_READY=false;
  const go=function(){location.reload();};
  filesOp("readwrite",function(st){st.clear();}).then(go,go);
}

// boutons Yes/No (valeur stockée dans un input caché : draft, sync et export inchangés)
