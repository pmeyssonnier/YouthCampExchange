// upload-limits.js — seuils de poids/taille des pièces jointes du formulaire
// Chargé par yce_form_filler.html et yce_admin.html ; scripts classiques partageant la portée globale.
"use strict";
// seuils réglables depuis l'administration (UPLOAD_LIMITS dans districts_data.js) ; valeurs par défaut ci-dessous
const UPLOAD_DEFAULTS={
  photo:{minSidePx:400,minKb:20,maxKb:1024,maxPx:800},   // photo d'identité : petit côté mini, poids mini/maxi, taille maxi après réduction
  id:{minLongPx:1000,minKb:60,maxKb:1536,maxPx:1600},    // scan du passeport / de la carte d'identité (et preuve de paiement : sans minimum)
  pdf:{minKb:20,maxKb:5120}                              // PDF : refusé en dehors de ces poids (non réductible dans le navigateur)
};
function uploadLimits(){
  const u=(typeof UPLOAD_LIMITS!=="undefined"&&UPLOAD_LIMITS)||{},o={};
  Object.keys(UPLOAD_DEFAULTS).forEach(function(g){
    o[g]={};Object.keys(UPLOAD_DEFAULTS[g]).forEach(function(k){
      const v=u[g]&&+u[g][k];o[g][k]=(v>0)?v:UPLOAD_DEFAULTS[g][k];
    });
  });
  return o;
}
