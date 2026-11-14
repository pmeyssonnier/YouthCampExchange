// camps-import.js — import du répertoire YCE officiel (xlsx) dans l'onglet Camps : lecture de la feuille, revue des changements
// (mises à jour, nouveaux camps, camps renommés, anciens camps à archiver) et application. La revue sert aussi aux coordonnées (camps-geo.js).
// Chargé par yce_admin.html après js/camps-manager.js et js/camps-match.js ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- import du répertoire officiel (xlsx) --------------------
function decodeXml(s){return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#(\d+);/g,function(m,d){return String.fromCodePoint(+d);}).replace(/&amp;/g,"&");}
function colIdx(ref){let c=0;const m=ref.match(/^[A-Z]+/)[0];
  for(let i=0;i<m.length;i++)c=c*26+m.charCodeAt(i)-64;return c-1;}
function serialToDmy(n){ // numéro de série Excel -> dd-mm-yyyy
  const d=new Date(Date.UTC(1899,11,30)+n*86400000);
  return String(d.getUTCDate()).padStart(2,"0")+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+d.getUTCFullYear();}
function mdyToDmy(v){ // MM-DD-YYYY (ou MM/DD/YYYY) -> dd-mm-yyyy ; série Excel acceptée ; date impossible -> null
  if(v==null||v==="")return null;
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if(m){const r=m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0")+"-"+m[3];return validDmy(r)?r:null;}
  if(/^\d+(\.\d+)?$/.test(s)&&+s>20000&&+s<70000)return serialToDmy(+s);
  return null;
}
async function parseDirectory(buf){
  const entries=await unzip(buf);
  const td=new TextDecoder();
  const part=function(n){const e=entries.find(function(x){return x.name===n;});return e?td.decode(e.data):null;};
  // feuille "Approved Camps" via workbook + rels (repli : première feuille)
  const wb=part("xl/workbook.xml")||"", rels=part("xl/_rels/workbook.xml.rels")||"";
  let target=null, first=null;
  wb.replace(/<sheet [^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"/g,function(m0,nm,rid){
    const mm=rels.match(new RegExp('Id="'+rid+'"[^>]*Target="([^"]*)"'));
    if(mm){const t="xl/"+mm[1].replace(/^\/?(xl\/)?/,"");
      if(!first)first=t;
      if(/approved\s*camps/i.test(nm))target=t;}
    return m0;});
  target=target||first;
  if(!target)throw new Error("no worksheet found");
  const sst=[];
  const ss=part("xl/sharedStrings.xml");
  if(ss)ss.replace(/<si>([\s\S]*?)<\/si>/g,function(m0,inner){
    sst.push(decodeXml((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[]).map(function(x){return x.replace(/<[^>]+>/g,"");}).join("")));return m0;});
  const sx=part(target);
  const rows=[];
  sx.replace(/<row[^>]*>([\s\S]*?)<\/row>/g,function(m0,inner){
    const cells=[];
    inner.replace(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,function(c0,ref,attrs,body){
      body=body||"";let v=null;
      if(/t="inlineStr"/.test(attrs)){v=decodeXml((body.match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[]).map(function(x){return x.replace(/<[^>]+>/g,"");}).join(""));}
      else{const vm=body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        if(vm)v=/t="s"/.test(attrs)?sst[+vm[1]]:decodeXml(vm[1]);}
      if(v!=null&&String(v).trim()!=="")cells[colIdx(ref)]=String(v).trim();
      return c0;});
    if(cells.length)rows.push(cells);
    return m0;});
  return rows;
}
function feeOf(fee,cur){
  if(!fee)return null;
  cur=(cur||"").trim();
  if(/^euros?$/i.test(cur))cur="EURO";
  if(/[a-z]/i.test(fee))return fee;      // le montant contient déjà sa devise
  return cur?fee+" "+cur:fee;
}
async function dirPick(inp){
  const f=inp.files[0];if(!f)return;
  try{
    zipCheckSize(f);
    const rows=await parseDirectory(await f.arrayBuffer());
    if(rows.length<2)throw new Error("empty sheet");
    const hdr=rows[0].map(function(h){return String(h||"").toLowerCase();});
    const col=function(part){for(let i=0;i<hdr.length;i++)if(hdr[i]&&hdr[i].indexOf(part)>=0)return i;return -1;};
    const C={country:col("country"),name:col("camp name"),first:col("first name"),last:col("last name"),
      email:col("email"),phone:col("phone"),deadline:col("deadline"),ages:col("age"),
      participants:col("participants"),langs:col("language"),fee:col("fees"),cur:col("currency"),
      fs:col("family stay dates (month/day/year) start"),fe:col("family stay dates (month/day/year) end"),
      hfa:col("host family activities"),web:col("website"),loc:col("location"),
      cs:col("camp start"),ce:col("camp end"),act:col("activities will include")};
    if(C.name<0||C.country<0||C.cs<0)throw new Error("not a YCE directory (missing columns)");
    const items=[];
    for(const r of rows.slice(1)){
      const g=function(i){return i>=0&&r[i]!=null?String(r[i]).trim():null;};
      const name=g(C.name);if(!name)continue;
      const cs=mdyToDmy(g(C.cs));if(!cs)continue;
      const langs=(g(C.langs)||"").split(/[,;\/]| and /).map(function(x){return x.trim();}).filter(Boolean);
      items.push({country:g(C.country),name:name,cs:cs,ce:mdyToDmy(g(C.ce)),
        fs:mdyToDmy(g(C.fs)),fe:mdyToDmy(g(C.fe)),deadline:mdyToDmy(g(C.deadline)),
        ages:g(C.ages),participants:g(C.participants),fee:feeOf(g(C.fee),g(C.cur)),
        hfa:g(C.hfa),website:g(C.web),location:g(C.loc),activities:g(C.act),langs:langs,
        cname:[g(C.first),g(C.last)].filter(Boolean).join(" ")||null,cemail:g(C.email),cphone:g(C.phone)});
    }
    buildReview(f.name,items);
  }catch(e){log("Directory import failed: "+esc(e.message),"err");}
  finally{inp.value="";}
}
function changesFor(c,t){ // champs à mettre à jour (une valeur vide du répertoire n'écrase jamais)
  const det=c.detail||{};
  const out=[];
  const chk=function(scope,field,val,label){
    if(val==null)return;
    const old=scope==="top"?c[field]:det[field];
    const ov=Array.isArray(old)?old.join(", "):old;
    const nv=Array.isArray(val)?val.join(", "):val;
    if(String(ov==null?"":ov)!==String(nv))out.push({scope:scope,field:field,val:val,label:label,old:ov==null?"":ov});
  };
  chk("top","camp_starts",t.cs,"camp start");chk("top","camp_ends",t.ce,"camp end");
  chk("top","family_stay_starts",t.fs,"family start");chk("top","family_stay_ends",t.fe,"family end");
  chk("top","age_requirements",t.ages,"ages");chk("top","fee",t.fee,"fee");
  chk("det","application_deadline",t.deadline,"deadline");chk("det","participants",t.participants,"capacity");
  chk("det","host_family_activities",t.hfa,"host family");chk("det","website",t.website,"website");
  chk("det","location",t.location,"location");chk("det","description",t.activities,"activities");
  chk("det","languages",t.langs&&t.langs.length?t.langs:null,"languages");
  chk("det","contact_name",t.cname,"contact");chk("det","contact_email",t.cemail,"contact e-mail");
  chk("det","contact_phone",t.cphone,"contact phone");
  return out;
}
// nouveau camp du répertoire : ancien camp actif qu'il pourrait remplacer (même pays, saison précédente),
// repéré par le même contact, un lieu ou un nom proche, ou parce que c'est le seul du pays.
// Simple proposition : l'archivage reste une case à cocher.
function replacesFor(t){
  const ns=seasonOf({camp_starts:t.cs});if(!ns)return null;
  const olds=[];
  CAMPS_W.forEach(function(c,i){const s=seasonOf(c);if(simple(c.country)===simple(t.country)&&s&&s<ns)olds.push(i);});
  let best=-1,bs=0,why="";
  olds.forEach(function(i){
    const c=CAMPS_W[i],d=c.detail||{};
    let sc,w;
    if(t.cemail&&d.contact_email&&simple(t.cemail)===simple(d.contact_email)){sc=2;w="same contact";}
    else{
      const l=t.location&&d.location?sim(stripNoise(d.location),stripNoise(t.location)):0;
      const n=sim(stripNoise(c.camp_name),stripNoise(t.name));
      sc=Math.max(l,n);w=l>=n?"similar location":"similar name";
    }
    if(sc>bs){bs=sc;best=i;why=w;}
  });
  if(best>=0&&bs>=0.5)return {camp:CAMPS_W[best],why:why};
  if(olds.length===1)return {camp:CAMPS_W[olds[0]],why:"only earlier camp in "+t.country};
  return null;
}
function buildReview(fname,items){
  const rev=[];let unchanged=0,archived=0;
  for(const t of items){
    const m=matchCamp(CAMPS_W,t);
    const hit=m?m.idx:-1,how=m?m.how:"";
    // camp archivé : ni proposé, ni affiché (« Restore » dans l'onglet Archived pour le reprendre)
    if(hit<0&&matchCamp(ARCH,t)){archived++;continue;}
    if(hit>=0){
      const chg=changesFor(CAMPS_W[hit],t);
      // camp reconnu sous un autre nom (pas une simple différence de casse ou de ponctuation) : le nouveau nom est proposé
      const rename=simple(CAMPS_W[hit].camp_name)!==simple(t.name);
      if(!chg.length&&!rename){unchanged++;continue;}
      rev.push({kind:"update",camp:CAMPS_W[hit],how:how,t:t,chg:chg,rename:rename,on:how==="exact",pct:how==="exact"?100:likeness(factsOf(CAMPS_W[hit]),factsOfT(t))});
    }else rev.push({kind:"new",t:t,on:true,rep:replacesFor(t)});
  }
  REVIEW=rev;
  document.getElementById("rev-note").textContent=fname+" — "
    +rev.filter(function(r){return r.kind==="update";}).length+" update(s), "
    +rev.filter(function(r){return r.kind==="new";}).length+" new camp(s), "+unchanged+" unchanged"
    +(archived?", "+archived+" archived (left out — restore them from the Archived tab if needed)":"");
  document.getElementById("rev-body").innerHTML=rev.length?rev.map(function(r,i){
    const tag=r.kind==="new"?'<span class="rev-tag t-new">NEW</span>'
      :(r.how==="exact"?'<span class="rev-tag t-upd">UPDATE</span>':'<span class="rev-tag t-fuz">UPDATE? '+r.pct+" % · "+esc(r.how)+"</span>");
    const what=r.kind==="new"
      ?"<b>"+esc(r.t.country)+" — "+esc(r.t.name)+"</b><div class='chg'>camp "+esc(r.t.cs)+" → "+esc(r.t.ce||"?")+" · "+esc(r.t.ages||"")+" · "+esc(r.t.fee||"")+"</div>"
        +(r.rep?'<label class="rev-rep"><input type="checkbox" id="rva-'+i+'"> may replace <b>'+esc(r.rep.camp.camp_name)+"</b> ("
          +esc(seasonOf(r.rep.camp))+", "+esc(r.rep.why)+") — archive the old camp</label>":"")
      :"<b>"+esc(r.camp.camp_name)+"</b> ⇐ "+esc(r.t.name)
        +"<div class='chg'>"+r.chg.map(function(x){return esc(x.label)+": "+esc(String(x.old).slice(0,30)||"∅")+" → "+esc(String(Array.isArray(x.val)?x.val.join(", "):x.val).slice(0,40));}).join(" · ")+"</div>"
        +(r.rename?'<label class="rev-rep"><input type="checkbox" id="rvn-'+i+'" checked> rename the camp to <b>'+esc(r.t.name)+"</b> (untick to keep the current name)</label>":"");
    return '<div class="rev-row"><input type="checkbox" id="rv-'+i+'"'+(r.on?" checked":"")+"> "+tag+'<div class="rev-what">'+what+"</div></div>";
  }).join(""):'<span class="hint">Everything already matches the directory — nothing to apply.</span>';
  document.getElementById("review").style.display="";
  document.getElementById("review").scrollIntoView({behavior:"smooth",block:"start"});
  log("Directory parsed: "+items.length+" dated entr"+(items.length>1?"ies":"y")+" examined.","ok");
}
function applyReview(){
  if(!REVIEW)return;
  let up=0,nw=0,gp=0,gone=0,rn_count=0;const old=[];
  REVIEW.forEach(function(r,i){
    if(!document.getElementById("rv-"+i).checked)return;
    if(r.kind!=="new"&&CAMPS_W.indexOf(r.camp)<0){gone++;return;} // camp archivé ou supprimé depuis la lecture du fichier
    if(r.kind==="geo"){
      const c=r.camp;c.detail=c.detail||{};c.detail.lat=r.q.lat;c.detail.lon=r.q.lon;
      const det={};DET_KEYS.forEach(function(k){if(k in c.detail)det[k]=c.detail[k];});c.detail=det;
      gp++;
    }else if(r.kind==="update"){
      const c=r.camp;
      r.chg.forEach(function(x){
        if(x.scope==="top")c[x.field]=x.val;
        else{c.detail=c.detail||{};c.detail[x.field]=x.val;}
      });
      if(c.detail){const det={};DET_KEYS.forEach(function(k){if(k in c.detail)det[k]=c.detail[k];});c.detail=det;}
      const rn=document.getElementById("rvn-"+i);
      if(r.rename&&rn&&rn.checked){c.camp_name=r.t.name;rn_count++;}
      up++;
    }else{
      const t=r.t,det={};
      [["location",t.location],["description",t.activities],["host_family_activities",t.hfa],
       ["languages",t.langs&&t.langs.length?t.langs:null],["website",t.website],
       ["application_deadline",t.deadline],["participants",t.participants],
       ["contact_name",t.cname],["contact_email",t.cemail],["contact_phone",t.cphone]]
        .forEach(function(p){if(p[1])det[p[0]]=p[1];});
      const known={Denmark:"Europe",Hungary:"Europe",Malaysia:"Asia","Sri Lanka":"Asia",Mexico:"Middle America"};
      const ex=CAMPS_W.find(function(c){return c.country===t.country;});
      const ra=document.getElementById("rva-"+i);
      if(r.rep&&ra&&ra.checked&&old.indexOf(r.rep.camp)<0)old.push(r.rep.camp);
      CAMPS_W.push({continent:(ex&&ex.continent)||known[t.country]||"Europe",country:t.country,
        camp_name:t.name,age_requirements:t.ages||"",fee:t.fee,
        camp_starts:t.cs,camp_ends:t.ce,family_stay_starts:t.fs,family_stay_ends:t.fe,
        detail:det});
      nw++;
    }
  });
  // anciens camps remplacés : archivés comme avec le bouton 🗄 Archive (ils quittent le site public)
  old.forEach(function(c){const k=CAMPS_W.indexOf(c);if(k<0)return;CAMPS_W.splice(k,1);c.archived_on=today();ARCH.push(c);});
  cancelReview();
  if(gone)log(gone+" ticked line(s) skipped: the camp was archived or deleted after the file was read.","warn");
  if(gp&&!up&&!nw){log("Coordinates applied to "+gp+" camp(s). Review, then “Save to the site”.","ok");markDirty();render();return;}
  log("Directory applied: "+up+" camp(s) updated"+(rn_count?" ("+rn_count+" renamed)":"")+", "+nw+" created"+(old.length?", "+old.length+" replaced camp(s) archived":"")+". Review, then “Save to the site”.","ok");
  markDirty();render();
}
function cancelReview(){REVIEW=null;document.getElementById("review").style.display="none";}
