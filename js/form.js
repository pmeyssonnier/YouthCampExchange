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
    const safe=function(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"_");};
    const name="Application_form_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".xlsx";
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
    let msg="✔ File generated: "+name;
    const outFiles=[name];
    if(SIGN_CLUB&&COMMIT_FILE.buf){
      const scb=await signCommitmentFile();
      const scn=COMMIT_FILE.name.replace(/\.docx$/i,"")+"_club-signed.docx";
      const sca=document.createElement("a");
      sca.href=URL.createObjectURL(scb);sca.download=scn;
      document.body.appendChild(sca);sca.click();sca.remove();
      setTimeout(function(){URL.revokeObjectURL(sca.href);},5000);
      outFiles.push(scn);msg+=" + "+scn;
    }
    if(COMMIT.agreed){
      const cb=await buildCommitmentDoc(fam,fir);
      const cn="Commitment_to_Reciprocity_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".docx";
      const ca=document.createElement("a");
      ca.href=URL.createObjectURL(cb);ca.download=cn;
      document.body.appendChild(ca);ca.click();ca.remove();
      setTimeout(function(){URL.revokeObjectURL(ca.href);},5000);
      outFiles.push(cn);msg+=" + "+cn;
    }
    if(PHOTO.dataUrl){
      const pn="Pass_photo_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".jpg";
      const pa=document.createElement("a");
      pa.href=PHOTO.dataUrl;pa.download=pn;
      document.body.appendChild(pa);pa.click();pa.remove();
      outFiles.push(pn);msg+=" + "+pn;
    }
    if(PAY.dataUrl){
      const yn="Payment_proof_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+"."+PAY.ext;
      const ya=document.createElement("a");
      ya.href=PAY.dataUrl;ya.download=yn;
      document.body.appendChild(ya);ya.click();ya.remove();
      outFiles.push(yn);msg+=" + "+yn;
    }
    setStatus(msg,false);
    if(!SIGN_CLUB){
      MAIL_INFO.fam=fam;MAIL_INFO.fir=fir;MAIL_INFO.files=outFiles;
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
