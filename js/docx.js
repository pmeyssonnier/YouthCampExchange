// docx.js — Commitment to Reciprocity : texte, validation, génération du document Word signé
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
const COMMIT_TEXT_DEFAULT=[
"We, the undersigned, undertake to host one young foreign person, boy or girl, for a one-week period. If our candidate takes part in a program outside Europe and there are not enough host families available, we undertake to host two young people for one week each. If the young person comes from Japan, hosting may last up to three weeks.",
"This commitment will be implemented in the following year, or in a year to be determined by the YCE committee.",
"Hosting takes place between 1 and 31 July, except for young people coming from Japan, for whom it takes place in August.",
"If, for serious and exceptional reasons, we are unable to honor our commitment for a given period, we undertake to arrange for another family to take over our task. If no solution is found even so, the Lions club concerned will honor this commitment and find a host family to take over our commitment.",
"As a host family, we also undertake to welcome these young people in a responsible and respectful manner and to treat them as members of our family. This implies that we take care of board and lodging, the cost of excursions, restaurant meals, visits and possibly transport, free of charge. If the young person wishes to make personal purchases or take part in extra visits or excursions, this will be at his/her own expense.",
"This contract, dated and signed, and drawn up in three copies, forms an integral part of the application file for participation in the Youth Camp and Exchange (YCE) Program. The Application Form (AF) will only be processed after this document has been signed by both parties and one copy attached to the AF.",
];
let COMMIT_TEXT=COMMIT_TEXT_DEFAULT;
try{
  const ct=JSON.parse(localStorage.getItem("yce_commit_text")||"null");
  if(Array.isArray(ct)&&ct.length)COMMIT_TEXT=ct;
}catch(e){}
const COMMIT={agreed:false,date:null};

// -------------------- Commitment to Reciprocity --------------------
function commitShow(){
  const b=document.getElementById("commit-btn");
  if(b){
    if(COMMIT.agreed){
      b.classList.add("agreed");
      b.textContent="✔ Validated on "+COMMIT.date+" — signed Commitment will be added to the file (click to cancel)";
    }else{
      b.classList.remove("agreed");
      b.textContent="✍ We, the undersigned, agree — validate with our signatures";
    }
  }
  const c=document.getElementById("commit-card");
  if(c){
    if(COMMIT.agreed){
      c.classList.remove("pending");c.classList.add("done");
      c.innerHTML="✔ Signed &amp; validated on "+COMMIT.date+"<br>Click to download the Word document";
    }else{
      c.classList.add("pending");c.classList.remove("done");
      c.innerHTML="✍ Not validated yet<br>Click to read &amp; sign it at the bottom of the form";
    }
  }
}
async function commitCardClick(){
  if(!COMMIT.agreed){
    const secs=document.querySelectorAll(".section");
    for(const d of secs){
      if(d.querySelector(".sec-title").textContent==="Commitment to Reciprocity"){
        d.classList.remove("closed");
        d.scrollIntoView({behavior:"smooth",block:"start"});
        break;
      }
    }
    return;
  }
  const fam=(document.getElementById("f-F16").value||"Candidate").trim();
  const fir=(document.getElementById("f-S16").value||"").trim();
  const safe=function(x){return x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"_");};
  try{
    const cb=await buildCommitmentDoc(fam,fir);
    const cn="Commitment_to_Reciprocity_"+YEAR+"_"+MD+currentDistrict+"_"+safe(fam)+(fir?"_"+safe(fir):"")+".docx";
    const ca=document.createElement("a");
    ca.href=URL.createObjectURL(cb);ca.download=cn;
    document.body.appendChild(ca);ca.click();ca.remove();
    setTimeout(function(){URL.revokeObjectURL(ca.href);},5000);
    setStatus("✔ "+cn,false);
  }catch(e){setStatus("⚠ Error: "+e.message,true);}
}
function commitToggle(){
  if(COMMIT.agreed){COMMIT.agreed=false;COMMIT.date=null;commitShow();upd();return;}
  if(!SIGS.applicant||!SIGS.applicant.ink||!SIGS.parent||!SIGS.parent.ink){
    setStatus("⚠ Commitment to Reciprocity: please draw the applicant and parent/guardian signatures in section XII first.",true);
    return;
  }
  const now=new Date();
  COMMIT.date=String(now.getDate()).padStart(2,"0")+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+now.getFullYear();
  COMMIT.agreed=true;
  setStatus("✔ Commitment validated — it will be generated and signed with the application file.",false);
  commitShow();upd();
}
// texte du commitment modifiable par l'administrateur via un .docx
function commitTextShow(){
  const d=document.getElementById("commit-text");
  if(d)d.innerHTML=COMMIT_TEXT.map(function(x){return "<p>"+esc(x)+"</p>";}).join("");
}
async function commitTextUpload(inp){
  const file=inp.files[0];if(!file)return;
  try{
    zipCheckSize(file);
    const entries=await unzip(await file.arrayBuffer());
    const docE=entries.find(function(e){return e.name==="word/document.xml";});
    if(!docE)throw new Error("not a Word document");
    const xml=new TextDecoder().decode(docE.data);
    const paras=[];
    const re=/<w:p[ >][\s\S]*?<\/w:p>/g;let m;
    while((m=re.exec(xml))){
      let txt="";
      const tre=/<w:t[^>]*>([\s\S]*?)<\/w:t>/g;let tm;
      while((tm=tre.exec(m[0])))txt+=tm[1];
      txt=decodeEnt(txt).replace(/\s+/g," ").trim();
      if(!txt)continue;
      if(/^commitment to reciprocity$/i.test(txt))continue;
      if(/^name of the candidate/i.test(txt))continue;
      if(/^date\s*:/i.test(txt))continue;
      if(/^signature/i.test(txt))continue;
      if(/^\.+$/.test(txt))continue;
      paras.push(txt);
    }
    if(!paras.length)throw new Error("no usable paragraphs found");
    COMMIT_TEXT=paras;
    try{localStorage.setItem("yce_commit_text",JSON.stringify(paras));}catch(e){}
    commitTextShow();
    setStatus("✔ Commitment text updated from "+file.name+" ("+paras.length+" paragraphs). Applies to this browser.",false);
  }catch(e){setStatus("⚠ Commitment text: "+e.message,true);}
  inp.value="";
}
function commitTextReset(){
  COMMIT_TEXT=COMMIT_TEXT_DEFAULT;
  try{localStorage.removeItem("yce_commit_text");}catch(e){}
  commitTextShow();
  setStatus("✔ Commitment text reset to the official default.",false);
}

// insère une image inline docx à la place du run contenant le marqueur
function docxReplaceRun(doc,marker,xml){
  const i=doc.indexOf(marker);
  if(i<0)return doc;
  const start=doc.lastIndexOf("<w:r>",i);
  const end=doc.indexOf("</w:r>",i)+6;
  return doc.slice(0,start)+xml+doc.slice(end);
}
function docxSigRun(rid,idn){
  return '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>'
    +'<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
    +'<wp:extent cx="1600000" cy="400000"/><wp:docPr id="'+idn+'" name="signature'+idn+'"/>'
    +'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    +'<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    +'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    +'<pic:nvPicPr><pic:cNvPr id="'+idn+'" name="signature'+idn+'"/><pic:cNvPicPr/></pic:nvPicPr>'
    +'<pic:blipFill><a:blip r:embed="'+rid+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
    +'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1600000" cy="400000"/></a:xfrm>'
    +'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>'
    +'</wp:inline></w:drawing></w:r>';
}
async function buildCommitmentDoc(fam,fir){
  const entries=await unzip(b64ToBuf(COMMIT_B64));
  const td=new TextDecoder(),te=new TextEncoder();
  const docE=entries.find(function(e){return e.name==="word/document.xml";});
  const relE=entries.find(function(e){return e.name==="word/_rels/document.xml.rels";});
  let doc=td.decode(docE.data),rx=td.decode(relE.data);
  doc=doc.replace("§CAND§",escXml(fam+" "+fir)).replace("§DATE§",COMMIT.date);
  const bi=doc.indexOf("[BODY]");
  if(bi>=0){
    const ps=Math.max(doc.lastIndexOf("<w:p ",bi),doc.lastIndexOf("<w:p>",bi));
    const pe=doc.indexOf("</w:p>",bi)+6;
    const body=COMMIT_TEXT.map(function(x){
      return '<w:p><w:pPr><w:spacing w:after="140"/><w:jc w:val="both"/></w:pPr><w:r><w:t xml:space="preserve">'+escXml(x)+'</w:t></w:r></w:p>';
    }).join("");
    doc=doc.slice(0,ps)+body+doc.slice(pe);
  }
  const sigs=[["parent","[SIG1]","rIdSigP",101],["applicant","[SIG2]","rIdSigA",102],["club","[SIG3]","rIdSigC",103]];
  sigs.forEach(function(sd){
    const key=sd[0],marker=sd[1],rid=sd[2],idn=sd[3];
    if(SIGS[key]&&SIGS[key].ink){
      entries.push({name:"word/media/"+rid+".png",data:dataUrlToBytes(SIGS[key].cv.toDataURL("image/png"))});
      rx=rx.replace("</Relationships>",'<Relationship Id="'+rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+rid+'.png"/></Relationships>');
      doc=docxReplaceRun(doc,marker,docxSigRun(rid,idn));
    }else{
      doc=docxReplaceRun(doc,marker,'<w:bookmarkStart w:id="'+(900+idn%10)+'" w:name="SIGSLOT_'+key.toUpperCase()+'"/><w:bookmarkEnd w:id="'+(900+idn%10)+'"/>');
    }
  });
  docE.data=te.encode(doc);relE.data=te.encode(rx);
  return await buildZip(entries,"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
