// tracker-storage.js — persistance locale des lignes du tableau
// Chargé par yce_tracker.html ; scripts classiques partageant la portée globale.
"use strict";
const KEY="yce_tracker_2026";
const STATUSES=["Received","Under review","Incomplete","Complete — sent to MD","Placed","Withdrawn"];
let ROWS={};
try{ROWS=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){ROWS={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(ROWS));}catch(e){}}
function clearAll(){
  if(!confirm("Remove ALL rows from the tracker? (the received files themselves are not affected)"))return;
  ROWS={};save();render();
}

