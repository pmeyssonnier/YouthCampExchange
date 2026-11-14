// admin-gallery.js — onglet Site & season de l'administration : galerie de photos de la page d'accueil (ajout, ordre, aperçu, retrait).
// La galerie en cours d'édition (GAL) est déclarée dans js/admin.js et enregistrée avec « Save the data ».
// Chargé par yce_admin.html avant js/admin.js ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- galerie de la page d'accueil --------------------
// aperçus des photos tout juste envoyées : visibles avant que le site soit republié (2-3 min)
const GAL_PREVIEW={};
function galShow(){
  const l=document.getElementById("gal-list");
  if(!l)return;
  l.innerHTML=GAL.length?GAL.map(function(g,i){
    const src=GAL_PREVIEW[g.src]||g.src;
    return '<figure class="gal-card">'
      +'<img src="'+esc(src)+'" alt="'+esc(g.caption||"")+'" title="Click to enlarge" onclick="galZoom('+i+')">'
      +'<figcaption><input value="'+esc(g.caption||"")+'" placeholder="Caption…" onchange="GAL['+i+'].caption=this.value">'
      +'<div class="gal-tools"><span class="gal-name">'+esc(g.src.split("/").pop())+'</span>'
      +'<button type="button" class="btn2" title="Move left" onclick="galMove('+i+',-1)"'+(i?'':' disabled')+'>◀</button>'
      +'<button type="button" class="btn2" title="Move right" onclick="galMove('+i+',1)"'+(i<GAL.length-1?'':' disabled')+'>▶</button>'
      +'<button type="button" class="btn2" title="Remove from the gallery" onclick="GAL.splice('+i+',1);galShow()">✕</button></div>'
      +'</figcaption></figure>';
  }).join(""):'<span class="hint">No photos yet — the gallery section stays hidden on the site.</span>';
}
function galMove(i,d){
  const j=i+d;if(j<0||j>=GAL.length)return;
  const t=GAL[i];GAL[i]=GAL[j];GAL[j]=t;galShow();
}
// photo en grand (clic, flèches du clavier, Échap pour fermer)
function galZoom(i){
  let z=document.getElementById("gal-zoom");
  if(!z){
    z=document.createElement("div");z.id="gal-zoom";
    z.innerHTML='<img alt=""><div class="gz-cap"></div><button type="button" class="gz-prev" aria-label="Previous">‹</button><button type="button" class="gz-next" aria-label="Next">›</button>';
    z.addEventListener("click",function(e){
      if(e.target.classList.contains("gz-prev"))galZoom((+z.dataset.i-1+GAL.length)%GAL.length);
      else if(e.target.classList.contains("gz-next"))galZoom((+z.dataset.i+1)%GAL.length);
      else z.remove();
    });
    document.body.appendChild(z);
  }
  const g=GAL[i];z.dataset.i=i;
  z.querySelector("img").src=GAL_PREVIEW[g.src]||g.src;
  z.querySelector(".gz-cap").textContent=(i+1)+" / "+GAL.length+(g.caption?" — "+g.caption:"");
}
document.addEventListener("keydown",function(e){
  const z=document.getElementById("gal-zoom");if(!z)return;
  if(e.key==="Escape")z.remove();
  else if(e.key==="ArrowLeft")galZoom((+z.dataset.i-1+GAL.length)%GAL.length);
  else if(e.key==="ArrowRight")galZoom((+z.dataset.i+1)%GAL.length);
});
function galPick(inp){
  const f=inp.files[0];if(!f)return;
  const fn=document.getElementById("gal-fname");
  const r=new FileReader();
  r.onload=function(){
    const img=new Image();
    img.onload=async function(){
      const MAX=1200,k=Math.min(1,MAX/Math.max(img.width,img.height));
      const cv=document.createElement("canvas");
      cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);
      cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
      const b64=cv.toDataURL("image/jpeg",0.85).split(",")[1];
      const name=f.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\.[^.]+$/,"").replace(/[^A-Za-z0-9_-]+/g,"_").toLowerCase()||"photo";
      const path="assets/gallery/"+name+".jpg";
      try{
        fn.textContent="\u23f3 "+f.name+"\u2026";
        const cur=await getFile(path);
        await putFile(path,b64,cur?cur.sha:null,"Admin: gallery photo "+path);
        GAL_PREVIEW[path]="data:image/jpeg;base64,"+b64;
        if(!GAL.some(function(g){return g.src===path;}))GAL.push({src:path,caption:""}); // même nom = photo remplacée, pas une 2e entrée
        galShow();
        fn.textContent="\u2714 "+f.name+" uploaded — add a caption, then Save the data";
        log("Gallery photo committed: "+esc(path),"ok");
      }catch(e){fn.textContent="\u2716 "+f.name+" failed";log("Gallery upload failed: "+esc(e.message),"err");}
    };
    img.src=r.result;
  };
  r.readAsDataURL(f);
  inp.value="";
}
