// country.js — pays par défaut, indicatifs, normalisation et validation des téléphones
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
const COUNTRIES=[
 {code:"BE",name:"Belgium",dial:"+32",nat:"Belgian"},
 {code:"FR",name:"France",dial:"+33",nat:"French"},
 {code:"IT",name:"Italy",dial:"+39",nat:"Italian"},
 {code:"DE",name:"Germany",dial:"+49",nat:"German"},
 {code:"NL",name:"Netherlands",dial:"+31",nat:"Dutch"},
 {code:"LU",name:"Luxembourg",dial:"+352",nat:"Luxembourgish"},
 {code:"ES",name:"Spain",dial:"+34",nat:"Spanish"},
 {code:"PT",name:"Portugal",dial:"+351",nat:"Portuguese"},
 {code:"CH",name:"Switzerland",dial:"+41",nat:"Swiss"},
 {code:"AT",name:"Austria",dial:"+43",nat:"Austrian"},
 {code:"GB",name:"United Kingdom",dial:"+44",nat:"British"},
 {code:"IE",name:"Ireland",dial:"+353",nat:"Irish"},
 {code:"DK",name:"Denmark",dial:"+45",nat:"Danish"},
 {code:"SE",name:"Sweden",dial:"+46",nat:"Swedish"},
 {code:"NO",name:"Norway",dial:"+47",nat:"Norwegian"},
 {code:"FI",name:"Finland",dial:"+358",nat:"Finnish"},
 {code:"PL",name:"Poland",dial:"+48",nat:"Polish"},
 {code:"CZ",name:"Czech Republic",dial:"+420",nat:"Czech"},
 {code:"GR",name:"Greece",dial:"+30",nat:"Greek"},
 {code:"TR",name:"Türkiye",dial:"+90",nat:"Turkish"},
];
let CTRY=(function(){
  const p=(new URLSearchParams(location.search).get("country")||"").toUpperCase();
  if(COUNTRIES.some(function(c){return c.code===p;}))return p;
  try{const l=localStorage.getItem("yce_country");
    if(l&&COUNTRIES.some(function(c){return c.code===l;}))return l;}catch(e){}
  return "BE";
})();
function countryCfg(){return COUNTRIES.find(function(c){return c.code===CTRY;})||COUNTRIES[0];}

// Normalise un numéro au format international : "0477/20.08.88" -> "+32 477 200 888".
// Gère aussi les saisies après le préfixe auto : "+32 0477…", "+32 0033…", "+32 +39…".
function normPhone(v){
  const c=countryCfg();
  let s=String(v).replace(/[^\d+]/g,"");
  if(!s)return "";
  if(s.lastIndexOf("+")>0)s="+"+s.split("+").pop(); // un "+" tapé plus loin = nouveau numéro complet
  if(s.slice(0,2)==="00")s="+"+s.slice(2);
  else if(s[0]==="0")s=c.dial+s.slice(1);
  else if(s[0]!=="+")s=c.dial+s;
  let dial=null;
  COUNTRIES.map(function(x){return x.dial;}).sort(function(a,b){return b.length-a.length;})
    .some(function(d){if(s.slice(0,d.length)===d){dial=d;return true;}return false;});
  if(!dial)dial=s.slice(0,3); // "+NN" par défaut
  let rest=s.slice(dial.length);
  if(rest.slice(0,2)==="00")return normPhone("+"+rest.slice(2)); // international tapé après le préfixe
  if(rest[0]==="0")rest=rest.slice(1); // numéro national tapé après le préfixe
  const groups=rest.match(/\d{1,3}/g)||[];
  return dial+(groups.length?" "+groups.join(" "):"");
}
function validPhone(s){
  const digits=s.replace(/\D/g,"").length;
  return /^\+\d{1,3}( \d{1,3})+$/.test(s)&&digits>=8&&digits<=15;
}
function wirePhones(){
  const c=countryCfg();
  document.querySelectorAll('input[type=tel]').forEach(function(el){
    el.placeholder=c.dial+" …";
    el.addEventListener("focus",function(){if(!el.value)el.value=c.dial+" ";});
    el.addEventListener("blur",function(){
      const v=el.value.trim();
      if(!v||v===c.dial){el.value="";el.classList.remove("tel-bad");upd();return;}
      el.value=normPhone(v);
      el.classList.toggle("tel-bad",!validPhone(el.value));
      upd();
    });
  });
}
function applyCountry(){
  const c=countryCfg();
  document.querySelectorAll('input[type=tel]').forEach(function(el){el.placeholder=c.dial+" …";});
  const nat=document.getElementById("f-G22");
  if(nat&&(!nat.value||nat.dataset.auto==="1")){nat.value=c.nat;nat.dataset.auto="1";nat.classList.add("prefilled");}
  const ctry=document.getElementById("f-G20");
  if(ctry&&(!ctry.value||ctry.dataset.auto==="1")){ctry.value=c.name;ctry.dataset.auto="1";ctry.classList.add("prefilled");}
  upd();
}
function setCountry(code){
  CTRY=code;
  try{localStorage.setItem("yce_country",code);}catch(e){}
  applyCountry();
}
