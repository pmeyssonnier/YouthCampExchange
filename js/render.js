// render.js — rendu des sections et widgets (groupes X, boutons Yes/No, champs conditionnels), compteur
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function render(){
  const root=document.getElementById("form-root");
  let h="";
  SECTIONS.forEach(function(sec,si){
    if(sec.adm&&!IS_ADMIN)return; // section réservée à l'admin : les cellules du modèle passent telles quelles
    h+='<div class="section'+(sec.closed?' closed':'')+'" id="sec'+si+'"><div class="sec-head" onclick="this.parentNode.classList.toggle(\'closed\')">';
    h+='<span class="sec-title">'+esc(sec.title)+'</span>';
    if(sec.note)h+='<span class="sec-note">'+esc(sec.note)+'</span>';
    h+='<span class="sec-toggle">▼</span></div><div class="sec-body">';
    // liste de contrôle des pièces à joindre (✔ verte / ✖ rouge, mise à jour en direct)
    if(sec.check)h+='<div class="fld w6" style="grid-column:span 6"><div id="att-check" style="display:flex;gap:6px 18px;flex-wrap:wrap;font-size:13px;padding:9px 12px;border:1px solid var(--border);border-radius:8px;"></div></div>';
    if(sec.commitBlock){
      h+='<div class="fld w6"><div class="commit-text" id="commit-text">'
        +COMMIT_TEXT.map(function(x){return '<p>'+esc(x)+'</p>';}).join("")
        +'</div>';
      if(IS_ADMIN){
        h+='<div style="display:flex;gap:8px;margin-top:8px;">'
          +'<label class="tpl-btn" style="flex:1;text-align:center;">📄 Update text from a Word document…'
          +'<input type="file" accept=".docx" style="display:none" onchange="commitTextUpload(this)"></label>'
          +'<button type="button" class="tpl-btn" id="commit-reset" onclick="commitTextReset()">↺ Default text</button>'
          +'</div>';
      }
      h+='<button type="button" class="commit-btn" id="commit-btn" onclick="commitToggle()">✍ We, the undersigned, agree — validate with our signatures</button>'
        +'<span class="hint">Requires the applicant and parent/guardian signatures from section XII; the Lions Club chairman signs later (on screen in admin mode, or on the printed document). A signed Commitment to Reciprocity (Word document) is added to the downloaded application file.</span></div>';
      h+='</div></div>';
      return;
    }
    sec.fields.forEach(function(f){
      if(f.adm&&!IS_ADMIN&&!(SIGN_CLUB&&f.clubSign)&&!(SIGN_DISTRICT&&f.distSign))return;
      const w=f.w||2;
      if(f.sig){
        h+='<div class="fld w'+w+'"><label class="flbl">'+esc(f.label)+'<span class="ref">I'+(f.row+1)+'</span></label>'
          +'<div class="sigpad"><canvas id="sig-'+f.sig+'" width="440" height="110"></canvas>'
          +'<div class="sig-line"></div>'
          +'<button type="button" class="sig-clear" onclick="sigClear(\''+f.sig+'\')">✕ clear</button>'
          +'<label class="sig-clear" style="right:auto;left:5px;">📁 image'
          +'<input type="file" accept="image/*" style="display:none" onchange="sigUpload(\''+f.sig+'\',this)"></label></div>'
          +'<span class="hint">Draw with mouse or finger — pasted into the Excel file at row '+(f.row+1)+'.</span></div>';
        return;
      }
      if(f.photo){
        h+='<div class="fld w'+w+'"><label class="flbl">'+esc(f.label)+'</label>'
          +'<div class="photobox" onclick="document.getElementById(\'photo-file\').click()">'
          +'<img id="photo-img" style="display:none" alt="pass photo">'
          +'<span class="ph-hint" id="photo-hint">📷 Click to add the pass photo<br>(JPG/PNG — downloaded as a separate file with the Excel)</span>'
          +'<button type="button" class="sig-clear" id="photo-clear" style="display:none" onclick="photoClear(event)">✕ remove</button>'
          +'<input type="file" id="photo-file" accept="image/*" style="display:none" onchange="photoPick(this)">'
          +'</div><span class="hint">Saved as its own JPG file next to the Excel file — required attachment of the application.</span></div>';
        return;
      }
      if(f.payproof){
        h+='<div class="fld w'+w+'"><label class="flbl">'+esc(f.label)+'</label>'
          +'<div class="photobox" onclick="document.getElementById(\'pay-file\').click()">'
          +'<img id="pay-img" style="display:none" alt="payment proof">'
          +'<span class="ph-hint" id="pay-hint">🧾 Click to add the payment proof<br>(PDF, JPG or PNG — downloaded with the file)</span>'
          +'<button type="button" class="sig-clear" id="pay-clear" style="display:none" onclick="payClear(event)">✕ remove</button>'
          +'<input type="file" id="pay-file" accept="application/pdf,image/*" style="display:none" onchange="payPick(this)">'
          +'</div><span class="hint">Bank transfer confirmation of the administrative fees — saved as its own file next to the Excel file.</span></div>';
        return;
      }
      if(f.commitCard){
        h+='<div class="fld w'+w+'"><label class="flbl">'+esc(f.label)+'</label>'
          +'<div class="dl-card pending" id="commit-card" onclick="commitCardClick()">…</div>'
          +'<span class="hint" id="commit-card-hint">Validated at the bottom of the form, then added to the downloaded file.</span></div>';
        return;
      }
      if(f.download){
        h+='<div class="fld w'+w+'"><label class="flbl">'+esc(f.label)+'</label>'
          +'<a class="dl-card" download href="Letter_to_Host_Family_'+YEAR+'.docx" style="margin-bottom:6px">📄 Download the Word template<br>“Dear Host Family…”</a>'
          +'<div class="photobox" onclick="document.getElementById(\'letter-file\').click()">'
          +'<span class="ph-hint" id="letter-hint">💌 Click to add your completed letter<br>(Word or PDF — included in the application file)</span>'
          +'<button type="button" class="sig-clear" id="letter-clear" style="display:none" onclick="letterClear(event)">✕ remove</button>'
          +'<input type="file" id="letter-file" accept=".docx,.pdf,application/pdf" style="display:none" onchange="letterPick(this)">'
          +'</div><span class="hint">Write it in English (about one page), then load it here — added to the application ZIP.</span></div>';
        return;
      }
      if(f.xgroup){
        h+='<div class="fld'+(f.card?' yn':'')+' w'+w+'"><label class="flbl">'+esc(f.label)+'<span class="ref">'+f.opts.map(function(o){return o.ref;}).join("/")+'</span></label><div class="xgroup" id="xg-'+f.xgroup+'">';
        f.opts.forEach(function(o){
          h+='<label class="xopt" data-grp="'+f.xgroup+'" data-ref="'+o.ref+'"><input type="radio" name="xg'+f.xgroup+'" onclick="xsel(this,\''+f.xgroup+'\')">'+esc(o.lbl)+'</label>';
        });
        h+='</div></div>';
      }else{
        h+='<div class="fld'+((f.type==="ynbtn")?" yn":"")+(f.half?" half":"")+' w'+w+'"'+(f.dep?' id="fld-'+f.ref+'" style="display:none"':'')+'><label class="flbl" for="f-'+f.ref+'">'+esc(f.label);
        if(f.req)h+=' <span class="req">*</span>';
        h+='<span class="ref">'+f.ref+'</span></label>';
        if(f.type==="ynbtn"||f.type==="pills"){
          const vals=f.type==="pills"?f.opts:(f.yn||["yes","no"]);
          const lbls=f.type==="pills"?f.opts:["Yes","No"];
          h+='<div class="xgroup" id="yn-'+f.ref+'">'
            +vals.map(function(v,i){return '<label class="xopt" data-val="'+v+'" onclick="ynClick(\''+f.ref+'\',\''+v+'\')">'+lbls[i]+'</label>';}).join("")
            +'</div><input type="hidden" id="f-'+f.ref+'">';
          h+='</div>';
          return;
        }
        if(f.type==="select"){
          h+='<select id="f-'+f.ref+'" onchange="upd()">';
          f.opts.forEach(function(o){h+='<option value="'+esc(o)+'"'+(o===(f.val||"")?" selected":"")+'>'+(o===""?"—":esc(o))+'</option>';});
          h+='</select>';
        }else{
          h+='<input type="'+f.type+'" id="f-'+f.ref+'"'+(f.id?' data-role="'+f.id+'"':'')
            +(f.val?' value="'+esc(f.val)+'" class="prefilled"':'')
            +(f.req?' required':'')
            +(f.list?' list="'+f.list+'"':'')
            +(f.ph?' placeholder="'+esc(f.ph)+'"':'')
            +(f.dep?' data-dep="'+f.dep+'" disabled':'')
            +' oninput="upd()'+(f.oninput?';'+f.oninput:'')+'">';
        }
        if(f.hint)h+='<span class="hint">'+esc(f.hint)+'</span>';
        h+='</div>';
      }
    });
    h+='</div></div>';
  });
  root.innerHTML=h;
}

// affiche/masque et (des)active les champs "If yes: specify" lies a un groupe
function depShow(grp,yes){
  document.querySelectorAll('input[data-dep="'+grp+'"]').forEach(function(i){
    i.disabled=!yes;
    if(!yes)i.value="";
    const fd=i.closest(".fld");
    if(fd)fd.style.display=yes?"":"none";
  });
}

// sélection dans un groupe de cases X (re-cliquer pour désélectionner)
const XSTATE={};
function xsel(input,grp){
  const lab=input.parentNode;
  const was=lab.classList.contains("on");
  document.querySelectorAll('#xg-'+grp+' .xopt').forEach(function(l){l.classList.remove("on");});
  if(was){input.checked=false;XSTATE[grp]=null;}
  else{lab.classList.add("on");XSTATE[grp]=lab.getAttribute("data-ref");}
  depShow(grp,!!XSTATE[grp]&&lab.textContent.trim()==="Yes"&&!was);
  upd();
}

// listes déroulantes pays / camps
function initLists(){
  const dlc=document.getElementById("dl-countries");
  const countries=[];
  CAMPS.forEach(function(c){if(countries.indexOf(c.c)<0)countries.push(c.c);});
  countries.sort();
  dlc.innerHTML=countries.map(function(c){return '<option value="'+esc(c)+'">';}).join("");
  for(let i=1;i<=3;i++)syncCamps(i);
}
function syncCamps(i){
  const ctry=(document.querySelector('input[data-role="ctry'+i+'"]')||{}).value||"";
  const dl=document.getElementById("dl-camp"+i);
  const list=CAMPS.filter(function(c){return !ctry||c.c.toLowerCase().indexOf(ctry.toLowerCase())>=0;});
  dl.innerHTML=list.map(function(c){return '<option value="'+esc(c.n)+'">'+esc(c.c)+'</option>';}).join("");
}

// -------------------- pays par défaut & téléphones --------------------

function ynClick(ref,val){
  const el=document.getElementById("f-"+ref);if(!el)return;
  el.value=(el.value===val?"":val);
  upd();
}
function refreshYn(){
  document.querySelectorAll('.xgroup[id^="yn-"]').forEach(function(g){
    const el=document.getElementById("f-"+g.id.slice(3));if(!el)return;
    const v=(el.value||"").toLowerCase();
    g.querySelectorAll(".xopt").forEach(function(o){
      o.classList.toggle("on",!!v&&o.getAttribute("data-val").toLowerCase()===v);
    });
  });
}

// le champ State (AF19) n'est utile que pour les pays a etats/provinces
function updState(){
  const g20=document.getElementById("f-G20"),st=document.getElementById("f-AF19");
  if(!g20||!st)return;
  const need=/(united states|usa|u\.s|canada|australia|brazil|mexico|india)/i.test(g20.value||"");
  const fd=st.closest(".fld");
  if(fd)fd.style.display=need?"":"none";
  st.disabled=!need;
  if(!need&&st.value)st.value="";
}

// liste de contrôle des pièces à joindre (section Attachments)
function attChecklist(){
  const el=document.getElementById("att-check");if(!el)return;
  const it=function(ok,lbl){return '<span>'+(ok?'<b style="color:var(--accent)">✔</b>':'<b style="color:var(--red)">✖</b>')+' '+lbl+'</span>';};
  el.innerHTML='<span style="color:var(--muted)">Checklist:</span>'
    +it(!!PHOTO.dataUrl,"Pass photo")
    +it(!!PAY.dataUrl,"Payment proof")
    +it(!!LETTER.dataUrl,"Host-family letter")
    +it(COMMIT.agreed,"Commitment signed");
}

// compteur de champs remplis
function upd(){
  updState();
  let n=0,total=0;
  SECTIONS.forEach(function(sec){
    if(sec.noCount)return;
    if(sec.commitBlock){total++;if(COMMIT.agreed)n++;return;}
    sec.fields.forEach(function(f){
    if(f.photo){total++;if(PHOTO.dataUrl)n++;return;}
    if(f.payproof){total++;if(PAY.dataUrl)n++;return;}
    if(f.download){total++;if(LETTER.dataUrl)n++;return;}
    if(f.sig){if(!SIGS[f.sig])return;total++;if(SIGS[f.sig].ink)n++;return;}
    if(f.xgroup){total++;if(XSTATE[f.xgroup])n++;}
    else{const el=document.getElementById("f-"+f.ref);
      if(!el||el.disabled)return; // "If yes: specify" fields are excluded while No / unanswered
      total++;if(el.value)n++;}
  });});

  document.getElementById("p-count").textContent=n+"/"+total;
  refreshYn();attChecklist();
  if(typeof signSummary==="function")signSummary();
  clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,300);
}
