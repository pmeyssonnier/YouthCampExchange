// form.js — orchestration : generate() et init() — à charger en dernier
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// champs cles controles pour la completude (aligne sur le tracker du coordinateur)
const REQUIRED_FIELDS=[["F16","Family name"],["S16","First name"],["J17","Sex"],["X17","Date of birth"],
["G18","Street"],["G19","Postal code"],["S19","Town"],["G20","Country"],["S20","E-mail"],["S21","Mobile"],
["G22","Nationality"],["X22","Passport/ID no"],["G23","Passport valid until"],["X23","Place of issue"],
["N10","1st country choice"],["AC10","1st camp choice"],["K42","State of health"],
["K49","Health insurance"],["AB49","Policy no"],["M57","Parent name"],["K63","Parent phone"],
["P64","Emergency e-mail"],["F67","Lions club"],["H68","Club chairperson"],["E69","Club e-mail"],
["AB126","Applicant sig date"],["AB128","Parent sig date"]];

// fiche resume du mode signature (president / coordinateur)
function signSummary(){
  const el=document.getElementById("sign-summary");
  if(!el)return;
  const v=function(r){const i=document.getElementById("f-"+r);return i&&i.value?i.value:"\u2014";};
  const sig=function(k){return ((SIGS[k]&&SIGS[k].ink)||(typeof FILE_SIGS!=="undefined"&&FILE_SIGS[k]))?'<span style="color:var(--accent)">\u2714</span>':'<span style="color:var(--red)">\u2716</span>';};
  el.innerHTML='<div class="w6" style="grid-column:span 6">'
    +'<b style="font-size:16px;color:var(--gold2)">'+esc(v("F16"))+' '+esc(v("S16"))+'</b>'
    +' &nbsp;\u00b7&nbsp; born '+esc(v("X17"))+' &nbsp;\u00b7&nbsp; District 112'+currentDistrict+'<br>'
    +'Club: <b>'+esc(v("F67"))+'</b> &nbsp;\u00b7&nbsp; e-mail: '+esc(v("S20"))+' &nbsp;\u00b7&nbsp; mobile: '+esc(v("S21"))+'<br>'
    +'1st camp choice: <b>'+esc(v("N10"))+'</b> \u2014 '+esc(v("AC10"))+'<br>'
    +(function(){
      if(!SIGN_DISTRICT)return""; // le président signe même un dossier encore incomplet
      const missing=[];
      REQUIRED_FIELDS.forEach(function(rq){
        const i=document.getElementById("f-"+rq[0]);
        if(!i||!i.value)missing.push(rq[1]);
      });
      const pct=Math.round(100*(REQUIRED_FIELDS.length-missing.length)/REQUIRED_FIELDS.length);
      const col=pct===100?"var(--accent)":(pct>=80?"var(--orange)":"var(--red)");
      let out='File completeness: <b style="color:'+col+'">'+pct+"%</b> ("+(REQUIRED_FIELDS.length-missing.length)+"/"+REQUIRED_FIELDS.length+" key fields)";
      if(missing.length)out+='<br><span style="color:var(--orange)">\u26a0 Missing: '+missing.map(esc).join(", ")+"</span>";
      // pi\u00e8ces pr\u00e9sentes dans le ZIP charg\u00e9 (transmises telles quelles)
      const has=function(re){return typeof SIGN_EXTRAS!=="undefined"&&SIGN_EXTRAS.some(function(x){return re.test(x.name);});};
      const it=function(ok,lbl){return (ok?'<b style="color:var(--accent)">\u2714</b>':'<b style="color:var(--red)">\u2716</b>')+' '+lbl;};
      out+='<br>Attachments in the dossier: '
        +[it(has(/commit/i),"Commitment"),it(has(/photo/i),"pass photo"),
          it(has(/payment|proof|paiement/i),"payment proof"),it(has(/letter|host|famil/i),"host-family letter")].join(" \u00b7 ");
      return out+"<br>";
    })()
    +'Signatures already in the file: applicant '+sig("applicant")+' &nbsp;parent '+sig("parent")+' &nbsp;club '+sig("club")
    +(SIGN_CLUB?(' &nbsp;\u00b7&nbsp; Commitment: '+(COMMIT_FILE.buf?'<span style="color:var(--accent)">loaded \u2014 your signature will be inserted</span>':'<span style="color:var(--orange)">not loaded</span>')):'')
    +'</div>';
}

async function generate(){
  const fam=document.getElementById("f-F16").value.trim();
  const fir=document.getElementById("f-S16").value.trim();
  if(!fam||!fir){setStatus("⚠ Family Name and First Name are required (section II).",true);
    document.getElementById("f-F16").focus();return;}
  if(SIGN_CLUB&&(!SIGS.club||!SIGS.club.ink)){
    setStatus("⚠ Please sign the club representative box before generating.",true);
    return;
  }
  if(SIGN_DISTRICT&&!((SIGS.mdyce&&SIGS.mdyce.ink)||(SIGS.authycec&&SIGS.authycec.ink))){
    setStatus("⚠ Please sign at least one district box (MD/D YCE or authorized chairperson) before generating.",true);
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
    const name="Application_form_"+YEAR+"_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".xlsx";
    // assemble le dossier complet dans une seule archive : une seule pièce jointe à envoyer
    const files=[{name:name,data:new Uint8Array(await blob.arrayBuffer())}];
    if(SIGN_CLUB&&COMMIT_FILE.buf){
      const scb=await signCommitmentFile();
      files.push({name:COMMIT_FILE.name.replace(/\.docx$/i,"")+"_club-signed.docx",data:new Uint8Array(await scb.arrayBuffer())});
    }
    if(COMMIT.agreed){
      const cb=await buildCommitmentDoc(fam,fir);
      files.push({name:"Commitment_to_Reciprocity_"+YEAR+"_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".docx",data:new Uint8Array(await cb.arrayBuffer())});
    }
    if(PHOTO.dataUrl)files.push({name:"Pass_photo_"+YEAR+"_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".jpg",data:dataUrlToBytes(PHOTO.dataUrl)});
    if(PAY.dataUrl)files.push({name:"Payment_proof_"+YEAR+"_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+"."+PAY.ext,data:dataUrlToBytes(PAY.dataUrl)});
    if(LETTER.dataUrl)files.push({name:"Letter_to_Host_Family_"+YEAR+"_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+"."+LETTER.ext,data:dataUrlToBytes(LETTER.dataUrl)});
    if(typeof SIGN_EXTRAS!=="undefined")SIGN_EXTRAS.forEach(function(x){files.push({name:x.name,data:x.data});});
    const zipName="Dossier_YCE_"+YEAR+"_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".zip";
    const zblob=await buildZip(files,"application/zip");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(zblob);a.download=zipName;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
    setStatus("✔ Dossier generated: "+zipName+" — "+files.length+" file(s): "+files.map(function(f){return f.name;}).join(", "),false);
    if(!SIGN_MODE){ // les e-mails pré-rédigés ne concernent que le candidat, pas les écrans de signature
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
  // l'année affichée (titre, en-tête, statut) vient de la constante YEAR (camps_data.js)
  document.querySelectorAll(".yr").forEach(function(s){s.textContent=YEAR;});
  document.title=document.title.replace(/20\d\d/,YEAR);
  const bs=document.getElementById("build");
  if(bs&&typeof BUILD!=="undefined")bs.textContent=BUILD;
  if(!SIGN_MODE)restoreDraft(); // les écrans de signature partent toujours du dossier chargé, jamais d'un brouillon local
  const params=new URLSearchParams(location.search);
  if(SIGN_MODE){
    document.getElementById("sign-banner").style.display="";
    document.getElementById("sign-mode-title").textContent=
      SIGN_CLUB?"Club chairman signing mode.":"District coordinator signing mode.";
    const cb=document.getElementById("commit-btn");
    if(cb)cb.style.display="none";
    document.getElementById("btn-gen").textContent="\u270d Sign & download the countersigned dossier";
    // ecran minimal : fiche resume + cadres de signature ; le formulaire complet reste consultable
    const root=document.getElementById("form-root");
    const card=document.createElement("div");
    card.innerHTML='<div class="section"><div class="sec-head"><span class="sec-title">Candidate summary</span>'
      +'<span class="sec-note">read from the loaded dossier</span></div>'
      +'<div class="sec-body" id="sign-summary" style="display:block;font-size:13px;line-height:2;">Load the candidate&rsquo;s dossier above.</div></div>'
      // le president lit le texte du Commitment qu'il contresigne (comme le candidat dans le formulaire)
      +(SIGN_CLUB?'<div class="section"><div class="sec-head" onclick="this.parentNode.classList.toggle(\'closed\')">'
        +'<span class="sec-title">Commitment to Reciprocity</span>'
        +'<span class="sec-note">please read — your signature is also inserted in this document</span>'
        +'<span class="sec-toggle">▼</span></div>'
        +'<div class="sec-body"><div class="fld w6" style="grid-column:span 6"><div class="commit-text" id="commit-view-text">'
        +'<p>Load the candidate’s dossier above to display the Commitment text.</p></div></div></div></div>':'')
      +'<div class="section"><div class="sec-head"><span class="sec-title">'
      +(SIGN_CLUB?"Your signature \u2014 Lions Club chairman":"Your signatures \u2014 district")
      +'</span></div><div class="sec-body" id="sign-pads"></div></div>'
      +'<div style="text-align:center;margin-bottom:14px;"><button class="tpl-btn" id="reveal-form">\ud83d\udd0d Review the full form</button></div>';
    root.parentNode.insertBefore(card,root);
    document.getElementById("reveal-form").onclick=function(){
      root.style.display=root.style.display==="none"?"":"none";
    };
    const pads=document.getElementById("sign-pads");
    (SIGN_CLUB?["club"]:["mdyce","authycec"]).forEach(function(k){
      const cv=document.getElementById("sig-"+k);
      if(cv)pads.appendChild(cv.closest(".fld"));
      const st=SIGS[k];
      if(st){const d=document.getElementById("f-"+st.dateRef);if(d)pads.appendChild(d.closest(".fld"));}
    });
    root.style.display="none";
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
      const url="Application%20form%20"+YEAR+"%20Distr%20"+d+"%201.xlsx";
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
