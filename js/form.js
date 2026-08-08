// form.js — orchestration : generate() et init() — à charger en dernier
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
async function generate(){
  const fam=document.getElementById("f-F16").value.trim();
  const fir=document.getElementById("f-S16").value.trim();
  if(!fam||!fir){setStatus("⚠ Family Name and First Name are required (section II).",true);
    document.getElementById("f-F16").focus();return;}
  if(SIGN_CLUB&&(!SIGS.club||!SIGS.club.ink)){
    setStatus("⚠ Please sign the club representative box (section XII) before generating.",true);
    return;
  }
  const btn=document.getElementById("btn-gen");btn.disabled=true;
  setStatus("Generating…",false);
  try{
    const buf=templateBuf||b64ToBuf(TEMPLATE_B64);
    const entries=await unzip(buf);
    const sheet=entries.find(function(e){return e.name==="xl/worksheets/sheet1.xml";});
    if(!sheet)throw new Error("worksheet not found in template");
    let xml=new TextDecoder().decode(sheet.data);
    const cells=collectValues();
    if(cells.badPhones.length){
      setStatus("⚠ Invalid phone number (use international format, e.g. "+countryCfg().dial+" 470 12 34 56): "+cells.badPhones.join(", "),true);
      btn.disabled=false;return;
    }
    cells.forEach(function(c){xml=setCell(xml,c.ref,c.value,c.numeric);});
    sheet.data=new TextEncoder().encode(xml);
    // force le recalcul complet à l'ouverture (âge, noms de signatures, pied de page)
    const wbe=entries.find(function(e){return e.name==="xl/workbook.xml";});
    if(wbe){
      let wbx=new TextDecoder().decode(wbe.data);
      if(wbx.indexOf("fullCalcOnLoad")<0){
        if(/<calcPr[^/>]*\/>/.test(wbx))wbx=wbx.replace(/<calcPr([^/>]*)\/>/,'<calcPr$1 fullCalcOnLoad="1"/>');
        else wbx=wbx.replace("</workbook>",'<calcPr fullCalcOnLoad="1"/></workbook>');
        wbe.data=new TextEncoder().encode(wbx);
      }
    }
    addSignatures(entries);
    const blob=await buildZip(entries);
    const safe=function(x){return x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"_");};
    const name="Application_form_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".xlsx";
    // assemble le dossier complet dans une seule archive : une seule pièce jointe à envoyer
    const files=[{name:name,data:new Uint8Array(await blob.arrayBuffer())}];
    if(SIGN_CLUB&&COMMIT_FILE.buf){
      const scb=await signCommitmentFile();
      files.push({name:COMMIT_FILE.name.replace(/\.docx$/i,"")+"_club-signed.docx",data:new Uint8Array(await scb.arrayBuffer())});
    }
    if(COMMIT.agreed){
      const cb=await buildCommitmentDoc(fam,fir);
      files.push({name:"Commitment_to_Reciprocity_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".docx",data:new Uint8Array(await cb.arrayBuffer())});
    }
    if(PHOTO.dataUrl)files.push({name:"Pass_photo_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".jpg",data:dataUrlToBytes(PHOTO.dataUrl)});
    if(PAY.dataUrl)files.push({name:"Payment_proof_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+"."+PAY.ext,data:dataUrlToBytes(PAY.dataUrl)});
    if(typeof SIGN_EXTRAS!=="undefined")SIGN_EXTRAS.forEach(function(x){files.push({name:x.name,data:x.data});});
    const zipName="Dossier_YCE_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".zip";
    const zblob=await buildZip(files,"application/zip");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(zblob);a.download=zipName;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
    setStatus("✔ Dossier generated: "+zipName+" — "+files.length+" file(s): "+files.map(function(f){return f.name;}).join(", "),false);
    if(!SIGN_CLUB){
      MAIL_INFO.fam=fam;MAIL_INFO.fir=fir;
      MAIL_INFO.files=[zipName];
      MAIL_INFO.contents=files.map(function(f){return f.name;});
      document.getElementById("mail-btn").style.display="";
      document.getElementById("coord-btn").style.display="";
    }
  }catch(e){
    console.error(e);setStatus("⚠ Error: "+e.message,true);
  }finally{btn.disabled=false;}
}

// -------------------- initialisation --------------------
async function init(){
  render();initLists();sigInit();upd();
  const bs=document.getElementById("build");
  if(bs&&typeof BUILD!=="undefined")bs.textContent=BUILD;
  if(!SIGN_CLUB)restoreDraft();
  const params=new URLSearchParams(location.search);
  if(SIGN_CLUB){
    document.getElementById("sign-banner").style.display="";
    document.querySelectorAll(".section").forEach(function(d){
      const t=d.querySelector(".sec-title").textContent;
      if(!t.startsWith("XII."))d.classList.add("closed");
    });
    const cb=document.getElementById("commit-btn");
    if(cb)cb.style.display="none";
  }
  if(IS_ADMIN){
    document.getElementById("tpl-btn").style.display="";
    document.getElementById("ctry-btn").style.display="";
    document.getElementById("tracker-btn").style.display="";
    document.getElementById("codemap-btn").style.display="";
    const sel=document.getElementById("ctry-sel");
    sel.innerHTML=COUNTRIES.map(function(c){return '<option value="'+c.code+'"'+(c.code===CTRY?' selected':'')+'>'+c.name+' ('+c.dial+')</option>';}).join("");
  }
  wirePhones();
  // une saisie manuelle dans Nationality/Country annule le marquage "valeur auto"
  ["G20","G22"].forEach(function(r){
    const el=document.getElementById("f-"+r);
    if(el)el.addEventListener("input",function(){el.dataset.auto="";});
  });
  const d=(params.get("district")||"").toUpperCase();
  if(/^[A-D]$/.test(d)&&location.protocol.indexOf("http")===0){
    // ouvert depuis le site : on charge le formulaire officiel du district
    try{
      const url="Application%20form%202026%20Distr%20"+d+"%201.xlsx";
      const resp=await fetch(url);
      if(!resp.ok)throw new Error("HTTP "+resp.status);
      templateBuf=await resp.arrayBuffer();
      setStatus("Template loaded: official District 112 "+d+" form",false);
    }catch(e){
      setStatus("⚠ District "+d+" form not found ("+e.message+") — using the embedded template (District C).",true);
    }
  }
  await syncFromTemplate(templateBuf||b64ToBuf(TEMPLATE_B64));
  applyCountry();
  commitShow();
}
init();
