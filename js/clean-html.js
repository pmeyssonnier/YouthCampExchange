// clean-html.js — nettoyage du HTML saisi par les coordinateurs (bandeau d'annonce, listes) et adresses web sûres.
// Chargé par index.html (avant site-data.js) et par yce_admin.html (l'aperçu du bandeau affiche exactement ce que montrera le site).
"use strict";
// lien cliquable : http(s) uniquement ; un domaine nu ("yce.lions.dk") est complété en https
function safeUrl(u){
  let s=String(u==null?'':u).trim();
  if(!s)return null;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(s)&&/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s))s='https://'+s;
  try{const x=new URL(s);return /^https?:$/.test(x.protocol)?x.href:null;}catch(e){return null;}
}
// liens limités à http(s)/mailto/tel/#ancre ; tout le reste devient du texte ou disparaît
const CLEAN_TAGS={STRONG:1,B:1,EM:1,I:1,U:1,BR:1,SPAN:1,SMALL:1,P:1,UL:1,OL:1,LI:1,A:1};
const DROP_TAGS={SCRIPT:1,STYLE:1,IFRAME:1,OBJECT:1,EMBED:1,TEMPLATE:1,SVG:1,MATH:1,NOSCRIPT:1,TEXTAREA:1,SELECT:1};
function cleanHtml(s){
  const t=document.createElement('template');t.innerHTML=String(s==null?'':s);
  (function walk(n){
    Array.from(n.childNodes).forEach(ch=>{
      if(ch.nodeType===3)return;
      if(ch.nodeType!==1||DROP_TAGS[ch.tagName]){ch.remove();return;}
      if(!CLEAN_TAGS[ch.tagName]){walk(ch);ch.replaceWith(...ch.childNodes);return;}
      const href=ch.tagName==='A'?(ch.getAttribute('href')||'').trim():'';
      Array.from(ch.attributes).forEach(a=>ch.removeAttribute(a.name));
      if(ch.tagName==='A'){
        const ok=safeUrl(href)||(/^(mailto:|tel:)[^\s"'<>]+$|^#[\w-]*$/i.test(href)?href:null);
        if(ok){ch.setAttribute('href',ok);if(/^https?:/i.test(ok)){ch.setAttribute('target','_blank');ch.setAttribute('rel','noopener');}}
      }
      walk(ch);
    });
  })(t.content);
  return t.innerHTML;
}
