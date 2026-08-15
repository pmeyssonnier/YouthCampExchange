// theme.js — bascule thème clair/sombre, préférence partagée entre toutes les pages (clé yce-theme)
// Chargé par yce_form_filler.html, yce_tracker.html et yce_admin.html (index.html a la sienne dans site-ui.js).
"use strict";
function toggleTheme(){
  const h=document.documentElement;
  const t=h.getAttribute("data-theme")==="light"?"dark":"light";
  if(t==="light")h.setAttribute("data-theme","light");else h.removeAttribute("data-theme");
  try{localStorage.setItem("yce-theme",t);}catch(e){}
  const b=document.getElementById("theme-btn");
  if(b)b.textContent=t==="light"?"🌙":"☀️";
}
(function(){
  const b=document.getElementById("theme-btn");
  if(b)b.textContent=document.documentElement.getAttribute("data-theme")==="light"?"🌙":"☀️";
})();
