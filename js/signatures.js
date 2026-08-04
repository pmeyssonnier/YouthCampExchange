// signatures.js — pads de signature (dessin/upload) et incrustation des signatures dans le classeur
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- pads de signature --------------------
const SIGS={};
function sigInit(){
  SECTIONS.forEach(function(sec){sec.fields.forEach(function(f){
    if(!f.sig)return;
    const cv=document.getElementById("sig-"+f.sig);
    if(!cv)return;
    const ctx=cv.getContext("2d");
    ctx.lineWidth=2.4;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#1b2a7a";
    const st={cv:cv,ctx:ctx,ink:false,drawing:false,dateRef:f.dateRef,row:f.row};
    SIGS[f.sig]=st;
    function pos(e){const r=cv.getBoundingClientRect();
      return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height];}
    cv.addEventListener("pointerdown",function(e){e.preventDefault();cv.setPointerCapture(e.pointerId);
      st.drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+0.1,p[1]+0.1);ctx.stroke();});
    cv.addEventListener("pointermove",function(e){if(!st.drawing)return;const p=pos(e);ctx.lineTo(p[0],p[1]);ctx.stroke();});
    function end(){if(!st.drawing)return;st.drawing=false;st.ink=true;
      const d=document.getElementById("f-"+st.dateRef);
      if(d&&!d.value){const now=new Date();
        d.value=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");}
      upd();}
    cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  });});
}
function sigClear(k){const st=SIGS[k];if(!st)return;
  st.ctx.clearRect(0,0,st.cv.width,st.cv.height);st.ink=false;upd();}
function sigUpload(k,inp){
  const st=SIGS[k],file=inp.files[0];
  if(!st||!file)return;
  const r=new FileReader();
  r.onload=function(){
    const img=new Image();
    img.onload=function(){
      st.ctx.clearRect(0,0,st.cv.width,st.cv.height);
      const kk=Math.min(st.cv.width/img.width,st.cv.height/img.height);
      const w=img.width*kk,h=img.height*kk;
      st.ctx.drawImage(img,(st.cv.width-w)/2,(st.cv.height-h)/2,w,h);
      st.ink=true;
      const d=document.getElementById("f-"+st.dateRef);
      if(d&&!d.value){const now=new Date();
        d.value=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");}
      upd();
    };
    img.src=r.result;
  };
  r.readAsDataURL(file);
  inp.value="";
}

function dataUrlToBytes(u){const b=atob(u.split(",")[1]);const a=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function addSignatures(entries){
  const sigs=Object.keys(SIGS).filter(function(k){return SIGS[k].ink;});
  if(!sigs.length)return;
  const drawing=entries.find(function(e){return e.name==="xl/drawings/drawing1.xml";});
  const rels=entries.find(function(e){return e.name==="xl/drawings/_rels/drawing1.xml.rels";});
  if(!drawing||!rels){console.warn("drawing absent — signatures ignorées");return;}
  const td=new TextDecoder(),te=new TextEncoder();
  let dx=td.decode(drawing.data),rx=td.decode(rels.data);
  sigs.forEach(function(k,i){
    const st=SIGS[k];
    const media="xl/media/imageSig"+(i+1)+".png";
    entries.push({name:media,data:dataUrlToBytes(st.cv.toDataURL("image/png"))});
    const rid="rIdSig"+(i+1);
    rx=rx.replace("</Relationships>",'<Relationship Id="'+rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/imageSig'+(i+1)+'.png"/></Relationships>');
    const anchor='<xdr:oneCellAnchor><xdr:from><xdr:col>8</xdr:col><xdr:colOff>30000</xdr:colOff>'
      +'<xdr:row>'+st.row+'</xdr:row><xdr:rowOff>20000</xdr:rowOff></xdr:from>'
      +'<xdr:ext cx="1600000" cy="400000"/>'
      +'<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="'+(200+i)+'" name="Signature '+k+'"/><xdr:cNvPicPr/></xdr:nvPicPr>'
      +'<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="'+rid+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
      +'<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1600000" cy="400000"/></a:xfrm>'
      +'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>'
      +'<xdr:clientData/></xdr:oneCellAnchor>';
    dx=dx.replace("</xdr:wsDr>",anchor+"</xdr:wsDr>");
  });
  drawing.data=te.encode(dx);rels.data=te.encode(rx);
}
