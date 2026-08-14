// xlsx.js — bibliothèque ZIP sans dépendance + lecture/écriture des cellules du classeur
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- mini-bibliothèque ZIP (aucune dépendance) --------------------
// Lecture : le modèle embarqué est archivé sans compression (STORE) ; un modèle
// chargé par l'utilisateur peut être compressé (DEFLATE) et est alors décompressé
// via l'API native DecompressionStream du navigateur.
const CRC_TABLE=(function(){const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;
  for(let i=0;i<u8.length;i++)c=CRC_TABLE[(c^u8[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;}
async function inflateRaw(u8){
  const ds=new DecompressionStream("deflate-raw");
  const ab=await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(ab);}
async function deflateRaw(u8){
  if(typeof CompressionStream==="undefined")return null;
  const cs=new CompressionStream("deflate-raw");
  const ab=await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(ab);}
async function unzip(buf){ // -> [{name, data:Uint8Array}]
  const u8=new Uint8Array(buf), dv=new DataView(buf);
  let eocd=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-22-65536);i--){
    if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error("invalid .xlsx file (EOCD not found)");
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
    else if(method!==0)throw new Error("unsupported compression method: "+method);
    entries.push({name:name,data:data});
    off+=46+nameLen+extraLen+cmtLen;
  }
  return entries;
}
async function buildZip(entries,mime){ // -> Blob (xlsx par défaut)
  const te=new TextEncoder();
  const parts=[];const central=[];let offset=0;
  for(const e of entries){
    const nameB=te.encode(e.name);
    const crc=crc32(e.data);
    let packed=await deflateRaw(e.data);
    let method=8;
    if(!packed||packed.length>=e.data.length){packed=e.data;method=0;}
    const lh=new Uint8Array(30+nameB.length);
    const ldv=new DataView(lh.buffer);
    ldv.setUint32(0,0x04034b50,true);ldv.setUint16(4,20,true);ldv.setUint16(6,0,true);
    ldv.setUint16(8,method,true);ldv.setUint16(10,0,true);ldv.setUint16(12,0x5821,true);
    ldv.setUint32(14,crc,true);ldv.setUint32(18,packed.length,true);ldv.setUint32(22,e.data.length,true);
    ldv.setUint16(26,nameB.length,true);ldv.setUint16(28,0,true);
    lh.set(nameB,30);
    parts.push(lh,packed);
    const ch=new Uint8Array(46+nameB.length);
    const cdv=new DataView(ch.buffer);
    cdv.setUint32(0,0x02014b50,true);cdv.setUint16(4,20,true);cdv.setUint16(6,20,true);
    cdv.setUint16(8,0,true);cdv.setUint16(10,method,true);cdv.setUint16(12,0,true);cdv.setUint16(14,0x5821,true);
    cdv.setUint32(16,crc,true);cdv.setUint32(20,packed.length,true);cdv.setUint32(24,e.data.length,true);
    cdv.setUint16(28,nameB.length,true);
    cdv.setUint32(42,offset,true);
    ch.set(nameB,46);
    central.push(ch);
    offset+=lh.length+packed.length;
  }
  let cdSize=0;central.forEach(function(c){cdSize+=c.length;});
  const eocd=new Uint8Array(22);
  const edv=new DataView(eocd.buffer);
  edv.setUint32(0,0x06054b50,true);
  edv.setUint16(8,central.length,true);edv.setUint16(10,central.length,true);
  edv.setUint32(12,cdSize,true);edv.setUint32(16,offset,true);
  return new Blob(parts.concat(central,[eocd]),
    {type:mime||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

// -------------------- lecture de valeurs du modèle --------------------
function decodeEnt(s){return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#(\d+);/g,function(m,d){return String.fromCharCode(+d);}).replace(/&amp;/g,"&");}
function textOf(inner){ // concatène les <t> d'un <si> ou <is> (texte riche inclus)
  let out="";const re=/<t[^>]*>([\s\S]*?)<\/t>/g;let m;
  while((m=re.exec(inner)))out+=m[1];
  return decodeEnt(out);}
function parseShared(entries){
  const e=entries.find(function(x){return x.name==="xl/sharedStrings.xml";});
  if(!e)return [];
  const xml=new TextDecoder().decode(e.data);
  const out=[];const re=/<si>([\s\S]*?)<\/si>/g;let m;
  while((m=re.exec(xml)))out.push(textOf(m[1]));
  return out;}
function getCellValue(sheetXml,sst,ref){
  const m=sheetXml.match(new RegExp('<c r="'+ref+'"([^>]*?)(/>|>([\\s\\S]*?)</c>)'));
  if(!m||!m[3])return "";
  const attrs=m[1],inner=m[3];
  if(/ t="inlineStr"/.test(attrs))return textOf(inner).trim();
  const v=inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
  if(!v)return "";
  if(/ t="s"/.test(attrs)){const s=sst[+v[1]];return (s===undefined?"":s).trim();}
  return decodeEnt(v[1]).trim();}

// Pré-remplit les champs du formulaire avec les valeurs présentes dans le modèle.
// N'écrase jamais une valeur saisie par l'utilisateur (seulement vide ou
// provenant d'une synchronisation précédente).
let currentDistrict="C";
async function syncFromTemplate(buf){
  try{
    const entries=await unzip(buf);
    const sheet=entries.find(function(e){return e.name==="xl/worksheets/sheet1.xml";});
    if(!sheet)return;
    const xml=new TextDecoder().decode(sheet.data);
    const sst=parseShared(entries);
    const d=getCellValue(xml,sst,"AF1");
    if(/^[A-D]$/i.test(d))currentDistrict=d.toUpperCase();
    SECTIONS.forEach(function(sec){sec.fields.forEach(function(f){
      if(f.xgroup){
        f.opts.forEach(function(o){
          const xv=getCellValue(xml,sst,o.ref);
          if(/^x$/i.test(xv)){
            XSTATE[f.xgroup]=o.ref;
            const lab=document.querySelector('.xopt[data-grp="'+f.xgroup+'"][data-ref="'+o.ref+'"]');
            if(lab){
              document.querySelectorAll('#xg-'+f.xgroup+' .xopt').forEach(function(l){l.classList.remove("on");});
              lab.classList.add("on");
              const inp=lab.querySelector("input");if(inp)inp.checked=true;
              depShow(f.xgroup,lab.textContent.trim()==="Yes");
            }
          }
        });
        return;
      }
      const el=document.getElementById("f-"+f.ref);if(!el)return;
      let v=getCellValue(xml,sst,f.ref);
      if(f.type==="date"){
        const dm=v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        v=dm?dm[3]+"-"+dm[2]+"-"+dm[1]:"";
      }
      if(el.value===""||el.value===(el.dataset.tpl||"")){
        el.value=v;el.classList.toggle("prefilled",!!v);
      }
      el.dataset.tpl=v;
    });});
    if(typeof sigsFromWorkbook==="function")await sigsFromWorkbook(entries);
    upd();
  }catch(e){console.warn("template sync:",e);}
}

// -------------------- écriture dans le xlsx --------------------
let templateBuf=null; // ArrayBuffer du modèle

function b64ToBuf(b64){
  const bin=atob(b64);const buf=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
  return buf.buffer;
}
function loadTemplate(inp){
  const file=inp.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=function(){templateBuf=r.result;setStatus("Template loaded: "+file.name,false);syncFromTemplate(templateBuf);};
  r.readAsArrayBuffer(file);
}
function setStatus(msg,err){
  const s=document.getElementById("status");
  s.textContent=msg;s.className=err?"err":"";
}
// Échappe pour XML et retire les caractères interdits par XML 1.0 (contrôles C0,
// substituts isolés, U+FFFE/FFFF) qu'un copier-coller depuis Word/WhatsApp peut
// introduire — Excel refuse alors d'ouvrir le fichier ("problème dans le contenu").
function escXml(s){return String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,"")
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g,"")
  .replace(/([^\uD800-\uDBFF])[\uDC00-\uDFFF]|^[\uDC00-\uDFFF]/g,"$1")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function fmtDate(iso){ // yyyy-mm-dd -> dd-mm-yyyy (format du formulaire)
  const p=iso.split("-");return p[2]+"-"+p[1]+"-"+p[0];
}

// Remplace le contenu d'une cellule dans sheet1.xml en conservant son style.
// value vide => cellule vidée. numeric => valeur numérique native.
function setCell(xml,ref,value,numeric){
  const re=new RegExp('<c r="'+ref+'"([^>]*?)(/>|>[\\s\\S]*?</c>)');
  let found=false;
  xml=xml.replace(re,function(m0,attrs){
    found=true;
    const sm=attrs.match(/ s="\d+"/);
    const s=sm?sm[0]:"";
    if(value===null||value===undefined||value===""){return '<c r="'+ref+'"'+s+'/>';}
    if(numeric&&/^-?\d+([.,]\d+)?$/.test(value)){return '<c r="'+ref+'"'+s+'><v>'+String(value).replace(",",".")+'</v></c>';}
    return '<c r="'+ref+'"'+s+' t="inlineStr"><is><t xml:space="preserve">'+escXml(value)+'</t></is></c>';
  });
  if(!found)console.warn("Cell missing from template:",ref);
  return xml;
}

function collectValues(){
  const out=[]; // {ref, value, numeric}
  out.badPhones=[];
  SECTIONS.forEach(function(sec){sec.fields.forEach(function(f){
    if(f.xgroup){
      f.opts.forEach(function(o){out.push({ref:o.ref,value:XSTATE[f.xgroup]===o.ref?"X":"",numeric:false});});
    }else{
      const el=document.getElementById("f-"+f.ref);
      if(!el)return; // champ absent de ce mode : la cellule du fichier chargé reste intacte
      let v=el.value.trim();
      if(v&&f.type==="date")v=fmtDate(v);
      if(v&&f.type==="tel"){
        v=normPhone(v);
        if(el)el.value=v;
        if(!validPhone(v))out.badPhones.push(f.label);
      }
      out.push({ref:f.ref,value:v,numeric:!!f.numeric});
    }
  });});
  return out;
}

// Incruste les signatures dessinées comme images PNG ancrées sur les lignes
// signature (I127 / I129) du classeur, via le drawing existant.
