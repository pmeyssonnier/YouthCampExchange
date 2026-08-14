// tracker-parser.js — lecture des fichiers reçus (zip, formulaire xlsx, commitment docx, pièces)
// Chargé par yce_tracker.html ; scripts classiques partageant la portée globale.
"use strict";
// ---------------- mini zip reader (STORE + DEFLATE via DecompressionStream) ----------------
async function inflateRaw(u8){
  const ds=new DecompressionStream("deflate-raw");
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());}
async function unzip(buf){
  const u8=new Uint8Array(buf), dv=new DataView(buf);
  let eocd=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-22-65536);i--){
    if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error("invalid file (not a zip)");
  const count=dv.getUint16(eocd+10,true);
  let off=dv.getUint32(eocd+16,true);
  const entries=[];const td=new TextDecoder();
  for(let n=0;n<count;n++){
    if(dv.getUint32(off,true)!==0x02014b50)throw new Error("corrupted central directory");
    const method=dv.getUint16(off+10,true);
    const csize=dv.getUint32(off+20,true);
    const nameLen=dv.getUint16(off+28,true);
    const extraLen=dv.getUint16(off+30,true);
    const cmtLen=dv.getUint16(off+32,true);
    const lho=dv.getUint32(off+42,true);
    const name=td.decode(u8.subarray(off+46,off+46+nameLen));
    const lnl=dv.getUint16(lho+26,true), lel=dv.getUint16(lho+28,true);
    const start=lho+30+lnl+lel;
    let data=u8.slice(start,start+csize);
    if(method===8)data=await inflateRaw(data);
    else if(method!==0)throw new Error("unsupported compression: "+method);
    entries.push({name:name,data:data});
    off+=46+nameLen+extraLen+cmtLen;
  }
  return entries;
}
function decodeEnt(s){return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#(\d+);/g,function(m,d){return String.fromCharCode(+d);}).replace(/&amp;/g,"&");}
function textOf(inner){let out="";const re=/<t[^>]*>([\s\S]*?)<\/t>/g;let m;while((m=re.exec(inner)))out+=m[1];return decodeEnt(out);}
function parseShared(entries){
  const e=entries.find(function(x){return x.name==="xl/sharedStrings.xml";});
  if(!e)return [];
  const xml=new TextDecoder().decode(e.data);
  const out=[];const re=/<si>([\s\S]*?)<\/si>/g;let m;
  while((m=re.exec(xml)))out.push(textOf(m[1]));
  return out;}
function getCell(xml,sst,ref){
  const m=xml.match(new RegExp('<c r="'+ref+'"([^>]*?)(/>|>([\\s\\S]*?)</c>)'));
  if(!m||!m[3])return "";
  const attrs=m[1],inner=m[3];
  if(/ t="inlineStr"/.test(attrs))return textOf(inner).trim();
  const v=inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
  if(!v)return "";
  if(/ t="s"/.test(attrs)){const s=sst[+v[1]];return (s===undefined?"":s).trim();}
  return decodeEnt(v[1]).trim();}

const REQUIRED=[["F16","Family name"],["S16","First name"],["J17","Sex"],["X17","Date of birth"],
["G18","Street"],["G19","Postal code"],["S19","Town"],["G20","Country"],["S20","E-mail"],["S21","Mobile"],
["G22","Nationality"],["X22","Passport/ID no"],["G23","Passport valid until"],["X23","Place of issue"],
["N10","1st country choice"],["AC10","1st camp choice"],["K42","State of health"],
["K49","Health insurance"],["AB49","Policy no"],["M57","Parent name"],["K63","Parent phone"],
["P64","Emergency e-mail"],["F67","Lions club"],["H68","Club chairperson"],["E69","Club e-mail"],
["AB126","Applicant sig date"],["AB128","Parent sig date"]];
function norm(s){return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");}
function rowKey(dist,fam,fir){return dist+"_"+norm(fam)+"_"+norm(fir);}
// ---------------- file handling ----------------
async function handleFiles(list){
  const files=Array.from(list); // fige la FileList avant le reset de l'input
  const items=[]; // {name, buf}
  for(const file of files){
    const n=file.name.toLowerCase();
    if(n.endsWith(".zip")){
      try{
        const entries=await unzip(await file.arrayBuffer());
        let found=0;
        for(const e of entries){
          const base=e.name.split("/").pop();
          if(!base||e.name.indexOf("__MACOSX")>=0||base===".DS_Store")continue;
          if(/\.(xlsx|docx|pdf|jpe?g|png)$/i.test(base)){items.push({name:base,buf:e.data.buffer.slice(e.data.byteOffset,e.data.byteOffset+e.data.byteLength)});found++;}
        }
        log("📦 "+file.name+" — "+found+" file(s) extracted","ok");
      }catch(err){log("✖ "+file.name+" — "+err.message,"err");}
    }else{
      items.push({name:file.name,buf:await file.arrayBuffer()});
    }
  }
  // les formulaires d'abord : les pièces se rattachent à des lignes existantes
  items.sort(function(a,b){
    const ax=a.name.toLowerCase().endsWith(".xlsx")?0:1;
    const bx=b.name.toLowerCase().endsWith(".xlsx")?0:1;
    return ax-bx;
  });
  for(const it of items){
    const n=it.name.toLowerCase();
    try{
      if(n.endsWith(".xlsx"))await parseForm(it.name,it.buf);
      else if(n.endsWith(".docx")&&/commit/i.test(n))await matchCommit(it.name,it.buf);
      else await matchAux(it.name); // photo, preuve de paiement, lettre famille d'accueil (docx ou pdf)
    }catch(e){log("✖ "+it.name+" — "+e.message,"err");}
  }
  save();render();
}
async function parseForm(fname,buf){
  const entries=await unzip(buf);
  const sheet=entries.find(function(e){return e.name==="xl/worksheets/sheet1.xml";});
  if(!sheet)throw new Error("no worksheet found (is this an application form?)");
  const xml=new TextDecoder().decode(sheet.data);
  const sst=parseShared(entries);
  const g=function(r){return getCell(xml,sst,r);};
  const fam=g("F16"),fir=g("S16");
  if(!fam&&!fir)throw new Error("no candidate name in F16/S16");
  const dist=(/^[A-D]$/i.test(g("AF1"))?g("AF1").toUpperCase():"?");
  // signatures = images ancrées sur les lignes 127/129/131 (0-indexé 126/128/130)
  const de=entries.find(function(e){return e.name==="xl/drawings/drawing1.xml";});
  const dx=de?new TextDecoder().decode(de.data):"";
  const sigRows=(dx.match(/<xdr:row>(\d+)<\/xdr:row>/g)||[]).map(function(x){return +x.replace(/\D/g,"");});
  const missing=[];
  REQUIRED.forEach(function(rq){if(!g(rq[0]))missing.push(rq[1]);});
  const pct=Math.round(100*(REQUIRED.length-missing.length)/REQUIRED.length);
  let age="";
  const dm=g("X17").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(dm){age=((new Date(+YEAR,6,1)-new Date(+dm[3],+dm[2]-1,+dm[1]))/31557600000).toFixed(1);}
  const key=rowKey(dist,fam,fir);
  const prev=ROWS[key]||{};
  ROWS[key]={
    dist:dist,fam:fam,fir:fir,sex:g("J17"),dob:g("X17"),age:age,
    club:g("F67"),email:g("S20"),mobile:g("S21"),
    pref1:(g("N10")+(g("AC10")?" — "+g("AC10"):"")).trim(),
    pref2:(g("N11")+(g("AC11")?" — "+g("AC11"):"")).trim(),
    pref3:(g("N12")+(g("AC12")?" — "+g("AC12"):"")).trim(),
    sigA:sigRows.indexOf(126)>=0,sigP:sigRows.indexOf(128)>=0,sigC:sigRows.indexOf(130)>=0,
    pct:pct,missing:missing,
    commit:prev.commit||false,commitClub:prev.commitClub||false,
    photo:prev.photo||false,pay:prev.pay||false,letter:prev.letter||false,
    status:prev.status||"Received",notes:prev.notes||"",
    updated:new Date().toISOString().slice(0,10)
  };
  log("✔ "+fname+" → "+fam+" "+fir+" (District 112"+dist+", "+pct+"% fields, sigs "+(ROWS[key].sigA?"A":"–")+(ROWS[key].sigP?"P":"–")+(ROWS[key].sigC?"C":"–")+")","ok");
}
function findRowByName(str){
  const t=norm(str);
  let hit=null;
  Object.keys(ROWS).forEach(function(k){
    const r=ROWS[k];
    if(t.indexOf(norm(r.fam))>=0&&t.indexOf(norm(r.fir))>=0)hit=k;
  });
  return hit;
}
async function matchCommit(fname,buf){
  const entries=await unzip(buf);
  const de=entries.find(function(e){return e.name==="word/document.xml";});
  if(!de)throw new Error("not a Word document");
  const doc=new TextDecoder().decode(de.data);
  const txt=decodeEnt(doc.replace(/<[^>]+>/g," ")).replace(/\s+/g," ");
  let key=findRowByName(fname);
  if(!key){
    const nm=txt.match(/Name of the candidate:\s*([A-Za-zÀ-ÿ'’ -]{3,60})/);
    if(nm)key=findRowByName(nm[1]);
  }
  if(!key)throw new Error("no matching candidate row (load the .xlsx first)");
  const clubSigned=/rIdSigC(lub)?\.png/.test(doc)||entries.some(function(e){return /rIdSigC(lub)?\.png$/.test(e.name);});
  const slotOpen=doc.indexOf("SIGSLOT_CLUB")>=0;
  ROWS[key].commit=true;
  ROWS[key].commitClub=clubSigned&&!slotOpen?true:clubSigned;
  log("✔ "+fname+" → Commitment for "+ROWS[key].fam+" "+ROWS[key].fir+(ROWS[key].commitClub?" (club signed)":" (club signature pending)"),"ok");
}
async function matchAux(fname){
  const key=findRowByName(fname);
  if(!key)throw new Error("no matching candidate row (load the .xlsx first)");
  const n=fname.toLowerCase();
  if(n.indexOf("photo")>=0){ROWS[key].photo=true;log("✔ "+fname+" → pass photo for "+ROWS[key].fam+" "+ROWS[key].fir,"ok");}
  else if(n.indexOf("payment")>=0||n.indexOf("proof")>=0||n.indexOf("paiement")>=0){ROWS[key].pay=true;log("✔ "+fname+" → payment proof for "+ROWS[key].fam+" "+ROWS[key].fir,"ok");}
  else if(n.indexOf("letter")>=0||n.indexOf("host")>=0||n.indexOf("family")>=0||n.indexOf("famille")>=0){ROWS[key].letter=true;log("✔ "+fname+" → host-family letter for "+ROWS[key].fam+" "+ROWS[key].fir,"ok");}
  else{log("⚠ "+fname+" matched "+ROWS[key].fam+" "+ROWS[key].fir+" but type unknown (name it Pass_photo_…, Payment_proof_… or Letter_to_Host_Family_…)","warn");}
}

