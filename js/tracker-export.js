// tracker-export.js — export CSV pour Excel
// Chargé par yce_tracker.html ; scripts classiques partageant la portée globale.
"use strict";
// Une cellule commençant par = + - @ (ou tabulation / retour) serait exécutée comme formule
// par Excel, LibreOffice ou Google Sheets : préfixée d'une apostrophe. Le test se fait aussi après
// les espaces de tête (y compris insécables et retours à la ligne, que certains tableurs retirent)
// et sur les variantes pleine chasse ＝ ＋ － ＠. Les valeurs purement numériques
// (« +32 470 12 34 56 ») ne peuvent appeler aucune fonction et restent intactes.
function csvSafe(v){
  const s=String(v==null?"":v),t=s.replace(/^\s+/,"");
  return /^[=+\-@\t\r\uFF1D\uFF0B\uFF0D\uFF20]/.test(t)&&!/^[+-]?[\d\s().\/-]+$/.test(t)?"'"+s:s;
}
function exportCsv(){
  const cols=["District","Family name","First name","Sex","Date of birth","Age 01/07/"+YEAR,"Club","E-mail","Mobile",
    "1st choice","2nd choice","3rd choice","Sig applicant","Sig parent","Sig club","Commitment","Commitment club-signed",
    "Photo","Payment proof","Passport/ID scan","Host-family letter","Fields %","Missing fields","Status","Notes","Updated"];
  const lines=[cols.join(";")];
  Object.keys(ROWS).forEach(function(k){const r=ROWS[k];
    const c=function(v){return '"'+csvSafe(v).replace(/"/g,'""')+'"';};
    lines.push([MD+" "+r.dist,r.fam,r.fir,r.sex,r.dob,r.age,r.club,r.email,r.mobile,r.pref1,r.pref2,r.pref3,
      r.sigA?"yes":"no",r.sigP?"yes":"no",r.sigC?"yes":"no",r.commit?"yes":"no",r.commitClub?"yes":"no",
      r.photo?"yes":"no",r.pay?"yes":"no",r.iddoc===true?"yes":(r.iddoc==="later"?"to follow":"no"),r.letter?"yes":"no",r.pct,(r.missing||[]).join(", "),r.status,r.notes,r.updated].map(c).join(";"));
  });
  const blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="YCE_"+YEAR+"_applications.csv";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
}

