// admin-people.js — onglet Site & season de l'administration : coordinateurs de district, numéro du district multiple, équipe nationale.
// Listes modifiées ici (DIST_W, TEAM_W, MD_W, déclarés dans js/admin.js), puis enregistrées avec « Save the data ».
// Chargé par yce_admin.html avant js/admin.js ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- districts et coordinateurs --------------------
// Code = 1 à 4 caractères, une lettre puis lettres ou chiffres : A, CC, A1 (estampillé dans le formulaire, cellule AF1, et exigée par le coffre).
// Liste avec bouton d'édition ; ajout, modification et retrait se font ici puis partent avec "Save the data".
const DIST_FIELDS=[["name","Name (as on the form)","w3"],["club","Lions club","w3"],["email","E-mail","w3"],["mobile","Mobile","w3"]];
function distShow(){
  let form="";
  if(DIST_EDIT!==null){
    const isNew=DIST_EDIT==="",c=isNew?{}:DIST_W[DIST_EDIT];
    form='<div class="dist-form"><div class="dist-form-title">'+(isNew?"New district":"District "+esc(MD_W+" "+DIST_EDIT))+'</div>'
      +'<div class="dist-grid">'
      +(isNew?'<div class="fld w1"><label class="flbl">Code</label><input id="de-code" maxlength="4" placeholder="E, CC…" style="text-transform:uppercase"></div>':"")
      +DIST_FIELDS.map(function(f){return '<div class="fld '+f[2]+'"><label class="flbl">'+f[1]+'</label><input id="de-'+f[0]+'" value="'+esc(c[f[0]]||"")+'"></div>';}).join("")
      +'</div><div class="dist-actions"><button class="btn" onclick="distApply()">✔ Apply</button>'
      +'<button class="btn2" onclick="distCancel()">Cancel</button>'
      +(isNew?"":'<button class="btn2 danger" style="margin-left:auto" onclick="distRemove(\''+DIST_EDIT+'\')">🗑 Remove district</button>')
      +'</div><span class="hint">Applied changes are published with “Save the data” below.</span></div>';
  }
  // le panneau d'édition s'ouvre sous la ligne du district ; un nouveau district en tête de liste
  const rows=Object.keys(DIST_W).sort().map(function(k){
    const c=DIST_W[k];
    return '<div class="dist-item'+(DIST_EDIT===k?" editing":"")+'"><span class="badge">'+esc(MD_W+" "+k)+'</span>'
      +'<div class="dist-who"><b>'+esc(c.name||"—")+'</b><span>'+esc(c.club||"")+'</span>'
      +'<span>'+esc(c.email||"")+'</span>'+(c.mobile?'<span>'+esc(c.mobile)+'</span>':"")+'</div>'
      +'<button class="btn2" onclick="distEdit(\''+k+'\')">✏️ Edit</button></div>'
      +(DIST_EDIT===k?form:"");
  }).join("");
  document.getElementById("dist-body").innerHTML='<div class="fld w6"><div class="dist-list">'
    +(DIST_EDIT===""?form:"")+rows+'</div>'
    +(DIST_EDIT===null?'<button class="btn2" style="margin-top:10px;align-self:flex-start" onclick="distNew()">➕ Add a district</button>':"")
    +'</div>';
  const first=document.querySelector("#dist-body .dist-form input");if(first)first.focus();
}
function distEdit(k){DIST_EDIT=k;distShow();}
function distNew(){DIST_EDIT="";distShow();}
function distCancel(){DIST_EDIT=null;distShow();}
function distApply(){
  const isNew=DIST_EDIT==="";
  const k=isNew?document.getElementById("de-code").value.trim().toUpperCase():DIST_EDIT;
  const v={};DIST_FIELDS.forEach(function(f){v[f[0]]=document.getElementById("de-"+f[0]).value.trim();});
  if(!/^[A-Z][A-Z0-9]{0,3}$/.test(k)){log("The district code is 1 to 4 characters: a letter, then letters or digits (A, CC, A1).","err");return;}
  if(isNew&&DIST_W[k]){log("District "+esc(MD_W+" "+k)+" already exists — use its Edit button.","err");return;}
  if(!v.name){log("The coordinator name is required.","err");return;}
  if(!/^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/.test(v.email)){log("Invalid e-mail address: "+esc(v.email),"err");return;}
  DIST_W[k]=v;DIST_EDIT=null;distShow();
  log((isNew?"District "+esc(MD_W+" "+k)+" added":"District "+esc(MD_W+" "+k)+" updated")+" — press “Save the data” to publish.","info");
}
function distRemove(k){
  if(Object.keys(DIST_W).length<=1){log("At least one district is needed.","err");return;}
  if(!confirm("Remove district "+MD_W+" "+k+" ("+(DIST_W[k].name||"")+")? Its form links and site card disappear once saved."))return;
  delete DIST_W[k];DIST_EDIT=null;distShow();
  log("District "+esc(MD_W+" "+k)+" removed — press “Save the data” to publish.","info");
}
// -------------------- district multiple (numéro) --------------------
// Le numéro (112) figure dans le titre de la section, les puces des districts ("112 A"), les intitulés
// de l'équipe nationale, le formulaire (cellule AB1) et les noms de fichiers générés.
function mdShow(){
  document.getElementById("md-title").textContent=MD_W;
}
function mdInput(el){
  MD_W=el.value.trim();mdShow();distShow();teamShow();
}
// -------------------- équipe nationale (commission, secrétaires outgoing) --------------------
// Même principe que les districts : liste avec Edit, ajout, retrait, ordre d'affichage (▲ ▼), publié avec "Save the data".
const TEAM_GROUPS=[["national","National Commission"],["outgoing","Outgoing Secretaries"]];
const TEAM_FIELDS=[["name","Name","w3"],["role","Role (e.g. Treasurer, Outgoing · Europe)","w3"],["club","Lions club","w3"],["email","E-mail","w3"],["mobile","Mobile (optional)","w3"]];
function teamForm(g,i){
  const isNew=i<0,m=isNew?{}:TEAM_W[g][i];
  return '<div class="dist-form"><div class="dist-form-title">'+(isNew?"New member":esc(m.name||"Member"))+'</div><div class="dist-grid">'
    +TEAM_FIELDS.map(function(f){return '<div class="fld '+f[2]+'"><label class="flbl">'+f[1]+'</label><input id="te-'+f[0]+'" value="'+esc(m[f[0]]||"")+'"></div>';}).join("")
    +'</div><div class="dist-actions"><button class="btn" onclick="teamApply()">✔ Apply</button><button class="btn2" onclick="teamCancel()">Cancel</button>'
    +(isNew?"":'<button class="btn2 danger" style="margin-left:auto" onclick="teamRemove()">🗑 Remove</button>')
    +'</div><span class="hint">Applied changes are published with “Save the data” below.</span></div>';
}
function teamShow(){
  const E=TEAM_EDIT;
  document.getElementById("team-body").innerHTML=TEAM_GROUPS.map(function(gr){
    const g=gr[0],list=TEAM_W[g];
    const rows=list.map(function(m,i){
      return '<div class="dist-item'+(E&&E.g===g&&E.i===i?" editing":"")+'"><div class="dist-who"><b>'+esc(m.name||"—")+'</b>'
        +(m.role?'<span>'+esc(m.role)+'</span>':"")+(m.club?'<span>'+esc(m.club)+'</span>':"")+(m.email?'<span>'+esc(m.email)+'</span>':"")+(m.mobile?'<span>'+esc(m.mobile)+'</span>':"")+'</div>'
        +'<span class="team-move"><button class="btn2" title="Move up" aria-label="Move up" onclick="teamMove(\''+g+'\','+i+',-1)"'+(i===0?" disabled":"")+'>▲</button>'
        +'<button class="btn2" title="Move down" aria-label="Move down" onclick="teamMove(\''+g+'\','+i+',1)"'+(i===list.length-1?" disabled":"")+'>▼</button></span>'
        +'<button class="btn2" onclick="teamEdit(\''+g+'\','+i+')">✏️ Edit</button></div>'
        +(E&&E.g===g&&E.i===i?teamForm(g,i):"");
    }).join("");
    return '<div class="fld w6"><label class="flbl">'+gr[1]+" MD "+esc(MD_W)+'</label><div class="dist-list">'+rows
      +(E&&E.g===g&&E.i<0?teamForm(g,-1):"")+'</div>'
      +(E===null?'<button class="btn2" style="margin-top:8px;align-self:flex-start" onclick="teamEdit(\''+g+'\',-1)">➕ Add a member</button>':"")+'</div>';
  }).join("");
  const first=document.querySelector("#team-body .dist-form input");if(first)first.focus();
}
function teamEdit(g,i){TEAM_EDIT={g:g,i:i};teamShow();}
function teamCancel(){TEAM_EDIT=null;teamShow();}
function teamApply(){
  const E=TEAM_EDIT,v={};
  TEAM_FIELDS.forEach(function(f){v[f[0]]=document.getElementById("te-"+f[0]).value.trim();});
  if(!v.name){log("The member's name is required.","err");return;}
  if(v.email&&!/^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/.test(v.email)){log("Invalid e-mail address: "+esc(v.email),"err");return;}
  if(E.i<0)TEAM_W[E.g].push(v);else TEAM_W[E.g][E.i]=v;
  TEAM_EDIT=null;teamShow();
  log(esc(v.name)+(E.i<0?" added":" updated")+" — press “Save the data” to publish.","info");
}
function teamRemove(){
  const E=TEAM_EDIT,m=TEAM_W[E.g][E.i];
  if(!confirm("Remove "+(m.name||"this member")+" from the team?"))return;
  TEAM_W[E.g].splice(E.i,1);TEAM_EDIT=null;teamShow();
  log(esc(m.name||"Member")+" removed — press “Save the data” to publish.","info");
}
function teamMove(g,i,dir){
  const l=TEAM_W[g],j=i+dir;if(j<0||j>=l.length)return;
  const x=l[i];l[i]=l[j];l[j]=x;TEAM_EDIT=null;teamShow();
}
