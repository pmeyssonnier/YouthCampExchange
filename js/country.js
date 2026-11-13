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

// Indicatifs internationaux (aucun n'est le début d'un autre) : sert à couper « +CC » du reste du numéro.
const DIAL_CODES=(function(){
  const set={};
  [1,7,20,27,30,31,32,33,34,36,39,40,41,43,44,45,46,47,48,49,51,52,53,54,55,56,57,58,60,61,62,63,64,65,66,81,82,84,86,90,91,92,93,94,95,98,
   211,212,213,216,218,290,291,297,298,299,420,421,423,500,501,502,503,504,505,506,507,508,509,590,591,592,593,594,595,596,597,598,599,
   670,672,673,674,675,676,677,678,679,680,681,682,683,685,686,687,688,689,690,691,692,850,852,853,855,856,880,886,
   960,961,962,963,964,965,966,967,968,970,971,972,973,974,975,976,977,992,993,994,995,996,998
  ].forEach(function(c){set[c]=1;});
  for(let c=220;c<=258;c++)set[c]=1;
  for(let c=260;c<=269;c++)set[c]=1;
  for(let c=350;c<=359;c++)set[c]=1;
  for(let c=370;c<=389;c++)if(c!==384)set[c]=1;
  return set;
})();
// Nombre de chiffres du numéro national (après l'indicatif, sans le 0 d'appel) : [min, max].
// Plages volontairement larges (fixe, mobile…) ; un pays absent de la liste n'est contrôlé que sur 8 à 15 chiffres au total.
const NAT_LEN={"+1":[10,10],"+7":[10,10],"+30":[10,10],"+31":[9,9],"+32":[8,9],"+33":[9,9],"+34":[9,9],"+351":[9,9],"+352":[6,9],"+353":[7,9],
  "+358":[6,12],"+39":[8,11],"+41":[9,9],"+420":[9,9],"+43":[7,13],"+44":[9,10],"+45":[8,8],"+46":[7,9],"+47":[8,8],"+48":[9,9],"+49":[7,13],
  "+52":[10,10],"+55":[10,11],"+61":[9,9],"+81":[9,10],"+86":[10,11],"+90":[10,10],"+91":[10,10]};
const KEEP_ZERO={"+39":1}; // en Italie le 0 des numéros fixes fait partie du numéro
function dialOf(digits){ // "32470123456" -> "+32" ; null si indicatif inconnu
  for(let n=1;n<=3;n++){if(DIAL_CODES[+digits.slice(0,n)]&&digits.charAt(0)!=="0")return "+"+digits.slice(0,n);}
  return null;
}
function phoneGroups(rest){ // groupes de 3 chiffres ; un reste d'un seul chiffre rejoint le groupe précédent (…296 2870)
  const g=rest.match(/\d{1,3}/g)||[];
  if(g.length>1&&g[g.length-1].length===1){const l=g.pop();g[g.length-1]+=l;}
  return g;
}
// Normalise un numéro au format international : "0477/20.08.88" -> "+32 477 200 888".
// Gère aussi les saisies après le préfixe auto : "+32 0477…", "+32 0033…", "+32 +39…".
function normPhone(v){
  const c=countryCfg();
  let s=String(v).replace(/[^\d+]/g,"");
  if(!s)return "";
  if(s.lastIndexOf("+")>0)s="+"+s.split("+").pop(); // un "+" tapé plus loin = nouveau numéro complet
  if(s.slice(0,2)==="00")s="+"+s.slice(2);
  else if(s[0]==="0")s=c.dial+(KEEP_ZERO[c.dial]?s:s.slice(1));
  else if(s[0]!=="+")s=c.dial+s;
  let dial=dialOf(s.slice(1));
  if(!dial)dial=s.slice(0,3); // indicatif inconnu : "+NN" par défaut
  let rest=s.slice(dial.length);
  if(rest.slice(0,2)==="00")return normPhone("+"+rest.slice(2)); // international tapé après le préfixe
  if(rest[0]==="0"&&!KEEP_ZERO[dial])rest=rest.slice(1); // numéro national tapé après le préfixe
  const groups=phoneGroups(rest);
  return dial+(groups.length?" "+groups.join(" "):"");
}
// Raison pour laquelle un numéro normalisé est refusé ("" s'il est correct)
function phoneProblem(s){
  const generic="not a valid number \u2014 use the international format, e.g. "+countryCfg().dial+" 470 12 34 56";
  const digits=s.replace(/\D/g,"");
  if(!/^\+\d{1,4}( \d{1,4})+$/.test(s))return generic;
  const dial=dialOf(digits),r=dial&&NAT_LEN[dial];
  if(r){
    const n=digits.length-(dial.length-1);
    if(n<r[0]||n>r[1]){
      const c=COUNTRIES.find(function(x){return x.dial===dial;});
      return (c?"a number in "+c.name:"a number with the code "+dial)+" has "+(r[0]===r[1]?r[0]:r[0]+" to "+r[1])+" digits after "+dial+" (you typed "+n+")";
    }
  }
  return digits.length<8||digits.length>15?generic:"";
}
function validPhone(s){return phoneProblem(s)==="";}
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
