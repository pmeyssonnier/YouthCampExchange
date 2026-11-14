// camps-match.js — rapprochement des fiches de camp : similarité des noms et des lieux, même camp sous un autre nom, doublons.
// Utilisé par l'import du répertoire (camps-import.js), les coordonnées (camps-geo.js) et le bouton « Check duplicates ».
// Chargé par yce_admin.html après js/camps-manager.js ; scripts classiques partageant la portée globale.
"use strict";
function sim(a,b){ // similarité par bigrammes (Dice)
  if(a===b)return 1;if(a.length<2||b.length<2)return 0;
  const big=function(s){const m={};for(let i=0;i<s.length-1;i++){const g=s.substr(i,2);m[g]=(m[g]||0)+1;}return m;};
  const A=big(a),B=big(b);let inter=0,tot=0,g;
  for(g in A){tot+=A[g];if(B[g])inter+=Math.min(A[g],B[g]);}
  for(g in B)tot+=B[g];
  return 2*inter/tot;
}
function stripNoise(s){return simple(String(s||"").replace(/\b(20\d\d|lions?|camp|yce|youth|international|the)\b/gi," "));}
// Deux fiches décrivent-elles le même camp ? Les noms changent d'une année à l'autre (« Brussels Lions Youth Camp »
// devient « Belgium Lions YCE Camp 2027 »), donc on recoupe aussi les dates, le lieu et le contact.
// Renvoie une raison (texte) ou null. a, b : {name,country,start,loc,email}
function factsOf(c){const d=c.detail||{};return {name:c.camp_name,country:c.country,start:c.camp_starts,loc:d.location,email:d.contact_email};}
function factsOfT(t){return {name:t.name,country:t.country,start:t.cs,loc:t.location,email:t.cemail};}
function alike(a,b){
  if(simple(a.country)!==simple(b.country))return null;
  if(simple(a.name)===simple(b.name))return "exact";
  const nm=sim(stripNoise(a.name),stripNoise(b.name));
  const lc=a.loc&&b.loc?sim(stripNoise(a.loc),stripNoise(b.loc)):0;
  const sameStart=!!a.start&&a.start===b.start;
  const sameMail=!!a.email&&simple(a.email)===simple(b.email);
  if(sameStart&&lc>=0.7)return "same dates and place";
  if(sameStart&&sameMail&&(lc>=0.4||nm>=0.4||!a.loc||!b.loc))return "same dates and contact";
  if(nm>=0.72)return "close name "+nm.toFixed(2);
  return null;
}
// pourcentage de ressemblance entre deux fiches : nom 30 %, lieu 30 %, date de début 25 %, e-mail du contact 15 %
function likeness(a,b){
  const nm=sim(stripNoise(a.name),stripNoise(b.name));
  const lc=a.loc&&b.loc?sim(stripNoise(a.loc),stripNoise(b.loc)):0;
  const st=a.start&&a.start===b.start?1:0;
  const ml=a.email&&simple(a.email)===simple(b.email)?1:0;
  return Math.round(100*(0.30*nm+0.30*lc+0.25*st+0.15*ml));
}
// camp du répertoire retrouvé dans une liste : même nom, sinon camp reconnu par ses dates, son lieu ou son contact
function matchCamp(list,t){
  const key=simple(t.name),ft=factsOfT(t);
  for(let i=0;i<list.length;i++)if(simple(list[i].camp_name)===key)return {idx:i,how:"exact"};
  let best=-1,bw="",bs=-1;
  const rank={"same dates and place":3,"same dates and contact":2};
  for(let i=0;i<list.length;i++){
    const w=alike(factsOf(list[i]),ft);if(!w)continue;
    const sc=rank[w]||1;
    if(sc>bs){bs=sc;best=i;bw=w;}
  }
  return best>=0?{idx:best,how:bw}:null;
}
// doublons possibles dans la liste des camps actifs (après un import, ou une saisie à la main)
function findDuplicates(){
  const out=[];
  for(let i=0;i<CAMPS_W.length;i++)for(let j=i+1;j<CAMPS_W.length;j++){
    const w=alike(factsOf(CAMPS_W[i]),factsOf(CAMPS_W[j]));
    if(w)out.push({a:CAMPS_W[i],b:CAMPS_W[j],why:w,pct:likeness(factsOf(CAMPS_W[i]),factsOf(CAMPS_W[j]))});
  }
  return out.sort(function(x,y){return y.pct-x.pct;});
}
function showDuplicates(){
  const d=findDuplicates(),box=document.getElementById("dups");
  document.getElementById("dups-note").textContent=d.length?d.length+" pair(s) to check":"";
  document.getElementById("dups-body").innerHTML=d.length?d.map(function(x){
    const row=function(c){return "<b>"+esc(c.camp_name)+"</b> <span class='sub'>"+esc(c.camp_starts||"—")+" · "+esc((c.detail||{}).location||"—")
      +" · "+esc((c.detail||{}).contact_email||"—")+'</span> <button class="btn2" onclick="openEdit('+CAMPS_W.indexOf(c)+')">✏ Edit</button>';};
    return '<div class="rev-row"><div class="rev-what">'+row(x.a)+"<br>"+row(x.b)+'<div class="chg"><b>'+x.pct+' % similar</b> — '+esc(x.why)+"</div></div></div>";
  }).join(""):'<span class="hint">No duplicate found among the active camps.</span>';
  box.style.display="";
}
