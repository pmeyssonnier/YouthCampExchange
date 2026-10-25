// noframe.js — les pages sensibles (administration, coffre, tracker, formulaire) ne s'affichent
// pas dans un cadre (iframe) d'un autre site : protection contre le « clickjacking », où une page
// piégée superpose des boutons invisibles pour faire signer, valider ou enregistrer à l'insu de
// l'utilisateur. GitHub Pages ne permet pas d'envoyer l'en-tête frame-ancestors / X-Frame-Options,
// et la balise CSP <meta> l'ignore : la page reste masquée (style #noframe) tant qu'elle est encadrée.
// Chargé dans le <head> de yce_admin.html, yce_vault.html, yce_tracker.html, yce_form_filler.html.
"use strict";
(function(){
  let framed = true;
  try{ framed = window.top !== window.self; }catch(e){ framed = true; }
  if(!framed){
    const s = document.getElementById("noframe");
    if(s) s.remove();
    return;
  }
  // encadrée : la page reste invisible ; on tente d'en sortir pour l'ouvrir en pleine fenêtre
  try{ window.top.location = window.location.href; }catch(e){}
})();
