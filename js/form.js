// form.js — définition du formulaire, rendu, compteur, génération et initialisation — à charger en dernier
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// Liste (pays, camp) dérivée de camps_data.js (RAW) — plus de duplication des données
const CAMPS=(typeof RAW!=="undefined")?(function(){
  const seen={},out=[];
  RAW.forEach(function(c){const k=c.country+"|"+c.camp_name;if(seen[k])return;seen[k]=1;out.push({c:c.country,n:c.camp_name});});
  out.sort(function(a,b){return a.c===b.c?(a.n<b.n?-1:1):(a.c<b.c?-1:1);});
  return out;
})():[];

const IS_ADMIN=new URLSearchParams(location.search).has("admin");
const SIGN_CLUB=(new URLSearchParams(location.search).get("sign")||"").toLowerCase()==="club";

// ---------------------------------------------------------------
// Définition des sections et champs (ref = cellule cible du xlsx)
// ---------------------------------------------------------------
const SECTIONS = [
 {title:"File header", note:"row 1 — automatically copied to the footer", fields:[
   {ref:"Q1",label:"Year",type:"number",w:1,numeric:true},
   {ref:"V1",label:"Country",type:"text",w:1},
   {ref:"AB1",label:"MD",type:"text",w:1,numeric:true},
   {ref:"AF1",label:"District",type:"text",w:1},
   {ref:"AI1",label:"Nr. (file number)",type:"text",w:2},
 ]},
 {title:"I. Preferred Youth Camp and Exchange Alternatives", fields:[
   {ref:"Q9",label:"Possible dates — From",type:"date",w:3},
   {ref:"AC9",label:"Possible dates — To",type:"date",w:3},
   {ref:"N10",label:"1st Country preference",type:"text",list:"dl-countries",w:2,oninput:"syncCamps(1)",id:"ctry1",ph:"e.g. Turkey - Istanbul"},
   {ref:"AC10",label:"1st Camp preference",type:"text",list:"dl-camp1",w:4},
   {ref:"N11",label:"2nd Country preference",type:"text",list:"dl-countries",w:2,oninput:"syncCamps(2)",id:"ctry2"},
   {ref:"AC11",label:"2nd Camp preference",type:"text",list:"dl-camp2",w:4},
   {ref:"N12",label:"3rd Country preference",type:"text",list:"dl-countries",w:2,oninput:"syncCamps(3)",id:"ctry3"},
   {ref:"AC12",label:"3rd Camp preference",type:"text",list:"dl-camp3",w:4},
   {ref:"N13",label:"Final destination (only for YCEC!)",type:"text",w:3},
   {xgroup:"dest",label:"Stay type",w:3,none:true,opts:[{lbl:"Family & camp",ref:"AC13"},{lbl:"Family only",ref:"AJ13"}]},
 ]},
 {title:"II. Applicant's Basic Data", note:"if not available yet, write “in request”", fields:[
   {ref:"F16",label:"Family Name",type:"text",req:true,w:2},
   {ref:"S16",label:"First Name",type:"text",req:true,w:2},
   {ref:"AD16",label:"Nickname",type:"text",w:2},
   {ref:"J17",label:"Male / Female / Other",type:"select",opts:["","M","F","X"],w:2},
   {ref:"X17",label:"Date of birth",type:"date",w:2},
   {ref:"G22",label:"Nationality",type:"text",w:2},
   {ref:"G18",label:"Street address",type:"text",w:6},
   {ref:"G19",label:"Postal code",type:"text",w:1,half:true},
   {ref:"S19",label:"Town",type:"text",w:2,half:true},
   {ref:"AF19",label:"State / Province",type:"text",w:1},
   {ref:"G20",label:"Country",type:"text",w:2},
   {ref:"S20",label:"Email",type:"email",w:3,ph:"first.last@example.be"},
   {ref:"G21",label:"Phone (home)",type:"tel",w:3},
   {ref:"S21",label:"Mobile",type:"tel",w:3},
   {ref:"X22",label:"Passport / ID / CNI number",type:"text",w:3},
   {ref:"G23",label:"Valid until",type:"date",w:3},
   {ref:"X23",label:"Place of issue",type:"text",w:3},
   {xgroup:"prev",card:true,label:"Previously participated in a Lions Youth Exchange?",w:3,opts:[{lbl:"Yes",ref:"AD24"},{lbl:"No",ref:"AI24"}]},
   {ref:"J25",label:"If yes, where and when?",type:"text",w:3,dep:"prev"},
   {ref:"J26",label:"Hobbies & other interests",type:"text",w:6},
   {xgroup:"engl",label:"Knowledge of English",w:3,opts:[{lbl:"Good",ref:"L27"},{lbl:"Fair",ref:"P27"},{lbl:"None",ref:"T27"}]},

   {ref:"AF27",label:"T-shirt size",type:"pills",opts:["S","M","L","XL","XXL"],w:3},
   {ref:"J28",label:"Other languages spoken",type:"text",w:6},
   {ref:"J29",label:"Field of study",type:"text",w:2},
   {ref:"J30",label:"Career objective",type:"text",w:2},
   {ref:"J31",label:"Religion",type:"text",w:2},
   {xgroup:"leo",card:true,label:"Are you a LEO?",w:6,opts:[{lbl:"Yes",ref:"AA31"},{lbl:"No",ref:"AG31"}]},
 ]},
 {title:"Attachments", note:"compulsory with the application", fields:[
   {photo:true,label:"Applicant's pass photo (JPG)",w:3},
   {payproof:true,label:"Proof of payment of the administrative fees",w:3},
   {download:true,label:"Letter to your (still unknown) host family",w:3},
   {commitCard:true,label:"Commitment to Reciprocity (signed)",w:3},
 ]},
 {title:"III. Health, Medical, Dietary & Insurance Data", fields:[
   {ref:"K42",label:"State of health, in general",type:"select",opts:["","Excellent","Very good","Good","Fair","Poor"],w:4},
   {ref:"AH44",label:"Height (cm)",type:"number",w:2,numeric:true},
   {ref:"S43",label:"Sport activities?",type:"ynbtn",w:2},
   {ref:"AG43",label:"Can you swim?",type:"ynbtn",w:2},
   {ref:"G44",label:"Do you smoke?",type:"ynbtn",w:2},
   {ref:"O44",label:"Vegetarian?",type:"ynbtn",w:2},
   {ref:"Z44",label:"Vegan?",type:"ynbtn",w:2},
   {xgroup:"med1",card:true,label:"Medical / mental condition(s)",w:3,opts:[{lbl:"No",ref:"M45"},{lbl:"Yes",ref:"Q45"}],specify:"X45"},
   {ref:"X45",label:"If yes: specify",type:"text",w:3,dep:"med1"},
   {xgroup:"med2",card:true,label:"Special medication",w:3,opts:[{lbl:"No",ref:"M46"},{lbl:"Yes",ref:"Q46"}],specify:"X46"},
   {ref:"X46",label:"If yes: specify",type:"text",w:3,dep:"med2"},
   {xgroup:"med3",card:true,label:"Medical / religious / other dietary requirements",w:3,opts:[{lbl:"No",ref:"M47"},{lbl:"Yes",ref:"Q47"}],specify:"X47"},
   {ref:"X47",label:"If yes: specify",type:"text",w:3,dep:"med3"},
   {xgroup:"med4",card:true,label:"Allergies (animal, insect, food…)",w:3,opts:[{lbl:"No",ref:"M48"},{lbl:"Yes",ref:"Q48"}],specify:"X48"},
   {ref:"X48",label:"If yes: specify",type:"text",w:3,dep:"med4"},
   {ref:"K49",label:"Health insurance company",type:"text",w:3},
   {ref:"AB49",label:"Policy no",type:"text",w:3},
   {ref:"K50",label:"Liability insurance company",type:"text",w:3},
   {ref:"AB50",label:"Policy no",type:"text",w:3},
   {ref:"K51",label:"Any other point to be noticed",type:"text",w:6},
   {ref:"Q53",label:"Family doctor — name",type:"text",w:2},
   {ref:"E54",label:"Doctor — e-mail",type:"email",w:2},
   {ref:"AB54",label:"Doctor — mobile",type:"tel",w:2},
 ]},
 {title:"IV. Applicant's Family Data", note:"family contact information", fields:[
   {ref:"M57",label:"Parent / guardian signing this form",type:"text",w:3},
   {ref:"AI57",label:"Lion?",type:"ynbtn",w:1},
   {ref:"J61",label:"Age on 01/07/2026",type:"text",w:2},
   {ref:"H62",label:"Contact address",type:"text",w:6},
   {ref:"K63",label:"Contact phone",type:"tel",w:3},
   {ref:"AD63",label:"Contact mobile",type:"tel",w:3},
   {ref:"P64",label:"Emergency e-mail",type:"email",w:3},
   {ref:"AF64",label:"Emergency mobile",type:"tel",w:3},
 ]},
 {title:"V. Responsible Lions Club Data", fields:[
   {ref:"F67",label:"Lions Club",type:"text",w:3},
   {ref:"AE67",label:"District",type:"text",w:1},
   {ref:"H68",label:"Club chairperson",type:"text",w:2},
   {ref:"AE68",label:"Chairperson mobile",type:"tel",w:3},
   {ref:"E69",label:"Club e-mail",type:"email",w:3},
   {xgroup:"fin",label:"Basis of financing of the exchange",w:6,none:true,opts:[{lbl:"By applicant",ref:"S72"},{lbl:"By family",ref:"Y72"},{lbl:"By sponsor club",ref:"AG72"},{lbl:"Others",ref:"AK72"}]},
 ]},
 {title:"VI. Lions Multi District or District Data", note:"prefilled from the loaded district template", fields:[
   {ref:"I78",label:"District YCE chairperson",type:"text",w:3},
   {ref:"AH78",label:"District: D or MD Nr.",type:"text",w:3},
   {ref:"E79",label:"E-mail",type:"email",w:3},
   {ref:"E80",label:"Mobile",type:"tel",w:3},
 ]},
 {title:"VII. Authorized YCE Chairperson & Controller", closed:true, noCount:true, note:"prefilled from the loaded district template", fields:[
   {ref:"E85",label:"Name",type:"text",w:3},
   {ref:"AH85",label:"District: D or MD Nr.",type:"text",w:3},
   {ref:"E86",label:"E-mail",type:"email",w:3},
   {ref:"E87",label:"Mobile",type:"tel",w:3},
 ]},
 {title:"X. GDPR Information & Consent", closed:true, noCount:true, note:"European countries only — prefilled when present in the template", fields:[
   {ref:"L100",label:"Are you from a country of Europe?",type:"ynbtn",yn:["YES","NO"],w:2},
   {ref:"F104",label:"D/MD Name",type:"text",w:4},
   {ref:"A108",label:"Controller — name",type:"text",w:2},
   {ref:"F109",label:"Controller — mobile",type:"tel",w:2},
   {ref:"R109",label:"Controller — e-mail",type:"email",w:2},
   {ref:"F112",label:"Data protection officer — name",type:"text",w:2},
   {ref:"R112",label:"DPO — address",type:"text",w:4},
   {ref:"F113",label:"DPO — mobile",type:"tel",w:2},
   {ref:"R113",label:"DPO — e-mail",type:"email",w:4},
 ]},
 {title:"XI. DPA Information", closed:true, noCount:true, note:"D/MD data protection authority", fields:[
   {ref:"F119",label:"Name",type:"text",w:3},
   {ref:"F120",label:"URL",type:"text",w:3},
   {ref:"F121",label:"Phone",type:"tel",w:2},
   {ref:"F122",label:"Address",type:"text",w:4},
   {ref:"F123",label:"E-mail",type:"email",w:6},
 ]},
 {title:"XII. Signatures", note:"names are computed automatically in Excel — sign on screen, the date fills in automatically"+(IS_ADMIN?" (officials\u2019 signatures unlocked)":""), fields:[
   {sig:"applicant",label:"Applicant signature",dateRef:"AB126",row:126,w:3},
   {sig:"parent",label:"Parent / guardian signature",dateRef:"AB128",row:128,w:3},
   {ref:"AB126",label:"Applicant — date",type:"date",w:3},
   {ref:"AB128",label:"Parent / guardian — date",type:"date",w:3},
   {sig:"club",label:"Club representative signature",dateRef:"AB130",row:130,w:2,adm:true,clubSign:true},
   {sig:"mdyce",label:"MD or D YCE signature",dateRef:"AB132",row:132,w:2,adm:true},
   {sig:"authycec",label:"Auth. YCE chairperson signature",dateRef:"AB134",row:134,w:2,adm:true},
   {ref:"AB130",label:"Club representative — date",type:"date",w:2,adm:true,clubSign:true},
   {ref:"AB132",label:"MD or D YCE — date",type:"date",w:2,adm:true},
   {ref:"AB134",label:"Auth. YCE chairperson — date",type:"date",w:2,adm:true},
 ]},
];
SECTIONS.push({title:"Commitment to Reciprocity", note:"read and validate — replaces the printed & signed copy", commitBlock:true, fields:[]});

// -------------------- rendu du formulaire --------------------
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function render(){
  const root=document.getElementById("form-root");
  let h="";
  SECTIONS.forEach(function(sec,si){
    h+='<div class="section'+(sec.closed?' closed':'')+'" id="sec'+si+'"><div class="sec-head" onclick="this.parentNode.classList.toggle(\'closed\')">';
    h+='<span class="sec-title">'+esc(sec.title)+'</span>';
    if(sec.note)h+='<span class="sec-note">'+esc(sec.note)+'</span>';
    h+='<span class="sec-toggle">▼</span></div><div class="sec-body">';
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
      if(f.adm&&!IS_ADMIN&&!(SIGN_CLUB&&f.clubSign))return;
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
          +'<a class="dl-card" download href="Letter_to_Host_Family_2026.docx">📄 Download the Word template<br>“Dear Host Family…”</a>'
          +'<span class="hint">Write it in English (about one page) and attach it to your application.</span></div>';
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
    if(f.download)return;
    if(f.sig){if(!SIGS[f.sig])return;total++;if(SIGS[f.sig].ink)n++;return;}
    if(f.xgroup){total++;if(XSTATE[f.xgroup])n++;}
    else{const el=document.getElementById("f-"+f.ref);
      if(!el||el.disabled)return; // "If yes: specify" fields are excluded while No / unanswered
      total++;if(el.value)n++;}
  });});

  document.getElementById("p-count").textContent=n+"/"+total;
  refreshYn();
  clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,300);
}

async function generate(){
  const fam=document.getElementById("f-F16").value.trim();
  const fir=document.getElementById("f-S16").value.trim();
  if(!fam||!fir){setStatus("⚠ Family Name and First Name are required (section II).",true);
    document.getElementById("f-F16").focus();return;}
  if(SIGN_CLUB&&(!SIGS.club||!SIGS.club.ink)){
    setStatus("⚠ Please sign the club representative box (section XII) before generating.",true);
    return;
  }
  const btn=document.getElementById("btn-gen");btn.disabled=true;
  setStatus("Generating…",false);
  try{
    const buf=templateBuf||b64ToBuf(TEMPLATE_B64);
    const entries=await unzip(buf);
    const sheet=entries.find(function(e){return e.name==="xl/worksheets/sheet1.xml";});
    if(!sheet)throw new Error("worksheet not found in template");
    let xml=new TextDecoder().decode(sheet.data);
    const cells=collectValues();
    if(cells.badPhones.length){
      setStatus("⚠ Invalid phone number (use international format, e.g. "+countryCfg().dial+" 470 12 34 56): "+cells.badPhones.join(", "),true);
      btn.disabled=false;return;
    }
    cells.forEach(function(c){xml=setCell(xml,c.ref,c.value,c.numeric);});
    sheet.data=new TextEncoder().encode(xml);
    // force le recalcul complet à l'ouverture (âge, noms de signatures, pied de page)
    const wbe=entries.find(function(e){return e.name==="xl/workbook.xml";});
    if(wbe){
      let wbx=new TextDecoder().decode(wbe.data);
      if(wbx.indexOf("fullCalcOnLoad")<0){
        if(/<calcPr[^/>]*\/>/.test(wbx))wbx=wbx.replace(/<calcPr([^/>]*)\/>/,'<calcPr$1 fullCalcOnLoad="1"/>');
        else wbx=wbx.replace("</workbook>",'<calcPr fullCalcOnLoad="1"/></workbook>');
        wbe.data=new TextEncoder().encode(wbx);
      }
    }
    addSignatures(entries);
    const blob=await buildZip(entries);
    const safe=function(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"_");};
    const name="Application_form_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".xlsx";
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
    let msg="✔ File generated: "+name;
    const outFiles=[name];
    if(SIGN_CLUB&&COMMIT_FILE.buf){
      const scb=await signCommitmentFile();
      const scn=COMMIT_FILE.name.replace(/\.docx$/i,"")+"_club-signed.docx";
      const sca=document.createElement("a");
      sca.href=URL.createObjectURL(scb);sca.download=scn;
      document.body.appendChild(sca);sca.click();sca.remove();
      setTimeout(function(){URL.revokeObjectURL(sca.href);},5000);
      outFiles.push(scn);msg+=" + "+scn;
    }
    if(COMMIT.agreed){
      const cb=await buildCommitmentDoc(fam,fir);
      const cn="Commitment_to_Reciprocity_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".docx";
      const ca=document.createElement("a");
      ca.href=URL.createObjectURL(cb);ca.download=cn;
      document.body.appendChild(ca);ca.click();ca.remove();
      setTimeout(function(){URL.revokeObjectURL(ca.href);},5000);
      outFiles.push(cn);msg+=" + "+cn;
    }
    if(PHOTO.dataUrl){
      const pn="Pass_photo_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+".jpg";
      const pa=document.createElement("a");
      pa.href=PHOTO.dataUrl;pa.download=pn;
      document.body.appendChild(pa);pa.click();pa.remove();
      outFiles.push(pn);msg+=" + "+pn;
    }
    if(PAY.dataUrl){
      const yn="Payment_proof_2026_112"+currentDistrict+"_"+safe(fam)+"_"+safe(fir)+"."+PAY.ext;
      const ya=document.createElement("a");
      ya.href=PAY.dataUrl;ya.download=yn;
      document.body.appendChild(ya);ya.click();ya.remove();
      outFiles.push(yn);msg+=" + "+yn;
    }
    setStatus(msg,false);
    if(!SIGN_CLUB){
      MAIL_INFO.fam=fam;MAIL_INFO.fir=fir;MAIL_INFO.files=outFiles;
      document.getElementById("mail-btn").style.display="";
      document.getElementById("coord-btn").style.display="";
    }
  }catch(e){
    console.error(e);setStatus("⚠ Error: "+e.message,true);
  }finally{btn.disabled=false;}
}

// -------------------- initialisation --------------------
async function init(){
  render();initLists();sigInit();upd();
  const bs=document.getElementById("build");
  if(bs&&typeof BUILD!=="undefined")bs.textContent=BUILD;
  if(!SIGN_CLUB)restoreDraft();
  const params=new URLSearchParams(location.search);
  if(SIGN_CLUB){
    document.getElementById("sign-banner").style.display="";
    document.querySelectorAll(".section").forEach(function(d){
      const t=d.querySelector(".sec-title").textContent;
      if(!t.startsWith("XII."))d.classList.add("closed");
    });
    const cb=document.getElementById("commit-btn");
    if(cb)cb.style.display="none";
  }
  if(IS_ADMIN){
    document.getElementById("tpl-btn").style.display="";
    document.getElementById("ctry-btn").style.display="";
    document.getElementById("tracker-btn").style.display="";
    const sel=document.getElementById("ctry-sel");
    sel.innerHTML=COUNTRIES.map(function(c){return '<option value="'+c.code+'"'+(c.code===CTRY?' selected':'')+'>'+c.name+' ('+c.dial+')</option>';}).join("");
  }
  wirePhones();
  // une saisie manuelle dans Nationality/Country annule le marquage "valeur auto"
  ["G20","G22"].forEach(function(r){
    const el=document.getElementById("f-"+r);
    if(el)el.addEventListener("input",function(){el.dataset.auto="";});
  });
  const d=(params.get("district")||"").toUpperCase();
  if(/^[A-D]$/.test(d)&&location.protocol.indexOf("http")===0){
    // ouvert depuis le site : on charge le formulaire officiel du district
    try{
      const url="Application%20form%202026%20Distr%20"+d+"%201.xlsx";
      const resp=await fetch(url);
      if(!resp.ok)throw new Error("HTTP "+resp.status);
      templateBuf=await resp.arrayBuffer();
      setStatus("Template loaded: official District 112 "+d+" form",false);
    }catch(e){
      setStatus("⚠ District "+d+" form not found ("+e.message+") — using the embedded template (District C).",true);
    }
  }
  await syncFromTemplate(templateBuf||b64ToBuf(TEMPLATE_B64));
  applyCountry();
  commitShow();
}
init();
