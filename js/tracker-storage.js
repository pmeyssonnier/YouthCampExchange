// tracker-storage.js — persistance locale des lignes du tableau
// Chargé par yce_tracker.html ; scripts classiques partageant la portée globale.
"use strict";
const KEY="yce_tracker_"+YEAR;
const STATUSES=["Received","Under review","Incomplete","Complete — sent to MD","Placed","Withdrawn"];
let ROWS={};
// lignes des saisons plus anciennes que la précédente (noms, dates de naissance, e-mails des candidats) :
// effacées de ce navigateur ; la saison précédente reste consultable en revenant à son année
try{
  Object.keys(localStorage).forEach(function(k){
    const m=/^yce_tracker_(\d{4})$/.exec(k);
    if(m&&+m[1]<+YEAR-1)localStorage.removeItem(k);
  });
}catch(e){}
try{ROWS=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){ROWS={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(ROWS));}catch(e){}}
function clearAll(){
  if(!confirm("Remove ALL rows from the tracker? (the received files themselves are not affected)"))return;
  ROWS={};save();render();
}

