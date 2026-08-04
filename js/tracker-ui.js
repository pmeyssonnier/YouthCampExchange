// tracker-ui.js — rendu du tableau, filtres, tri, journal — à charger en dernier
// Chargé par yce_tracker.html ; scripts classiques partageant la portée globale.
"use strict";
let distFilter="ALL", sortKey="name", sortDir=1;
function log(msg,cls){const l=document.getElementById("log");l.innerHTML='<div class="'+(cls||"")+'">'+msg+"</div>"+l.innerHTML;}
// ---------------- rendering ----------------
function isComplete(r){return r.pct===100&&r.sigA&&r.sigP&&r.sigC&&r.commit&&r.commitClub&&r.photo&&r.pay;}
function setDist(d,btn){distFilter=d;document.querySelectorAll(".pill").forEach(function(p){p.classList.remove("on");});btn.classList.add("on");render();}
function setSort(k){if(sortKey===k)sortDir=-sortDir;else{sortKey=k;sortDir=1;}render();}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function render(){
  const q=norm(document.getElementById("q").value||"");
  const fs=document.getElementById("f-status").value;
  let rows=Object.keys(ROWS).map(function(k){const r=ROWS[k];r._k=k;return r;});
  if(distFilter!=="ALL")rows=rows.filter(function(r){return r.dist===distFilter;});
  if(fs)rows=rows.filter(function(r){return r.status===fs;});
  if(q)rows=rows.filter(function(r){return norm(r.fam+r.fir+r.club+r.pref1+r.pref2+r.pref3).indexOf(q)>=0;});
  const kf={dist:function(r){return r.dist;},name:function(r){return norm(r.fam+r.fir);},age:function(r){return +r.age||0;},
    club:function(r){return norm(r.club);},pref:function(r){return norm(r.pref1);},pct:function(r){return r.pct;},status:function(r){return STATUSES.indexOf(r.status);}};
  rows.sort(function(a,b){const f=kf[sortKey]||kf.name;const x=f(a),y=f(b);return (x<y?-1:x>y?1:0)*sortDir;});
  document.querySelectorAll("th").forEach(function(t){t.classList.remove("asc","desc");});
  const th=document.getElementById("h-"+sortKey);if(th)th.classList.add(sortDir>0?"asc":"desc");
  const tb=document.getElementById("tbody");
  tb.innerHTML=rows.map(function(r){
    const sig=function(v){return '<span class="sig '+(v?"ok":"ko")+'">'+(v?"✔":"✖")+"</span>";};
    const att=function(v,ch){return '<span class="sig '+(v?"ok":"ko")+'">'+(v?ch:"✖")+"</span>";};
    const pctCls=r.pct===100?"good":(r.pct>=80?"mid":"bad");
    const miss=r.missing&&r.missing.length?' <span class="hint-miss" title="Missing: '+esc(r.missing.join(", "))+'">('+r.missing.length+' missing)</span>':"";
    const prefTitle=esc(["1. "+r.pref1,"2. "+r.pref2,"3. "+r.pref3].join("\n"));
    return "<tr>"
      +'<td><span class="b-dist b-'+r.dist+'">112 '+r.dist+"</span></td>"
      +'<td><div class="cand">'+esc(r.fam)+" "+esc(r.fir)+(isComplete(r)?' <span class="ok" title="File complete">●</span>':"")+'</div><div class="sub">'+esc(r.sex)+" · "+esc(r.dob)+"</div></td>"
      +"<td>"+(r.age||"—")+"</td>"
      +"<td>"+esc(r.club||"—")+"</td>"
      +'<td class="sub">'+esc(r.email||"")+"<br>"+esc(r.mobile||"")+"</td>"
      +'<td title="'+prefTitle+'">'+esc(r.pref1||"—")+"</td>"
      +"<td>"+sig(r.sigA)+sig(r.sigP)+sig(r.sigC)+"</td>"
      +"<td>"+att(r.commit,r.commitClub?"✎":"✔")+att(r.photo,"✔")+att(r.pay,"✔")+"</td>"
      +'<td><span class="pct '+pctCls+'">'+r.pct+"%</span>"+miss+"</td>"
      +'<td><select class="status-sel" onchange="ROWS[\''+r._k+'\'].status=this.value;save();render();">'
        +STATUSES.map(function(st){return '<option'+(st===r.status?" selected":"")+">"+st+"</option>";}).join("")+"</select></td>"
      +'<td><input class="notes-in" value="'+esc(r.notes)+'" onchange="ROWS[\''+r._k+'\'].notes=this.value;save();"></td>'
      +'<td><button class="del-btn" title="Remove this row" onclick="if(confirm(\'Remove '+esc(r.fam)+" "+esc(r.fir)+'?\')){delete ROWS[\''+r._k+'\'];save();render();}">✕</button></td>'
      +"</tr>";
  }).join("");
  document.getElementById("empty").style.display=rows.length?"none":"";
  const all=Object.keys(ROWS).map(function(k){return ROWS[k];});
  document.getElementById("st-total").textContent=all.length;
  document.getElementById("st-complete").textContent=all.filter(isComplete).length;
  document.getElementById("st-clubsigned").textContent=all.filter(function(r){return r.sigC;}).length;
}

// drag & drop
const dz=document.getElementById("dropzone");
["dragenter","dragover"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add("drag");});});
["dragleave","drop"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove("drag");});});
dz.addEventListener("drop",function(e){handleFiles(e.dataTransfer.files);});
// status filter options
document.getElementById("f-status").innerHTML='<option value="">All statuses</option>'+STATUSES.map(function(s){return "<option>"+s+"</option>";}).join("");
render();

