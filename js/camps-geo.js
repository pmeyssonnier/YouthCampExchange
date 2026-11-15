// camps-geo.js — coordonnées des camps pour la carte publique : import d'un export GeoJSON de la couche NextGIS, revue, puis application
// par applyReview (camps-import.js). Seules latitude et longitude sont reprises.
// Chargé par yce_admin.html après js/camps-manager.js et js/camps-match.js ; scripts classiques partageant la portée globale.
"use strict";
// -------------------- coordonnées (carte NextGIS, GeoJSON) --------------------
// Seules les coordonnées sont reprises : ni nom, ni e-mail, ni autre donnée personnelle de la couche.
function mercToLonLat(x,y){ // EPSG:3857 -> [lon, lat]
  const R=6378137;
  return [x/R*180/Math.PI,(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI];
}
function geoPick(inp){
  const f=inp.files[0];if(!f)return;
  if(f.size>5*1048576){log("Coordinates file too large (maximum 5 MB).","err");inp.value="";return;}
  const r=new FileReader();
  r.onload=function(){
    try{buildGeoReview(f.name,JSON.parse(r.result));}
    catch(e){log("Coordinates import failed: "+esc(e.message),"err");}
    finally{inp.value="";}
  };
  r.readAsText(f);
}
function geoPoints(gj){
  if(!gj||gj.type!=="FeatureCollection"||!Array.isArray(gj.features))throw new Error("not a GeoJSON FeatureCollection");
  const merc=/3857|900913/.test(JSON.stringify(gj.crs||""));
  const pts=[];
  gj.features.slice(0,5000).forEach(function(ft){
    const g=ft&&ft.geometry,p=(ft&&ft.properties)||{};
    if(!g||g.type!=="Point"||!Array.isArray(g.coordinates))return;
    let x=+g.coordinates[0],y=+g.coordinates[1];if(!isFinite(x)||!isFinite(y))return;
    if(merc||Math.abs(x)>180||Math.abs(y)>90){const q=mercToLonLat(x,y);x=q[0];y=q[1];}
    if(Math.abs(y)>90||Math.abs(x)>180)return;
    const pick=function(part){for(const k in p)if(k.toLowerCase().indexOf(part)>=0&&p[k]!=null)return String(p[k]);return "";};
    const country=String(p.Country||p.country||pick("country")),name=pick("camp name")||String(p.name||"");
    if(!country||!name)return;
    pts.push({country:country,name:name,loc:pick("location"),lat:Math.round(y*10000)/10000,lon:Math.round(x*10000)/10000});
  });
  return pts;
}
function buildGeoReview(fname,gj){
  const pts=geoPoints(gj);
  if(!pts.length)throw new Error("no camp with a country, a name and a point in this file");
  const best={}; // camp -> meilleure source
  CAMPS_W.forEach(function(c,i){
    let b=null;
    pts.forEach(function(q,qi){
      if(simple(q.country)!==simple(c.country))return;
      const d=c.detail||{};
      const qa=stripNoise(q.name).replace(/^lionscamp/,""),ca=stripNoise(c.camp_name).replace(/^lionscamp/,"");
      let nm=simple(q.name)===simple(c.camp_name)?1:sim(qa,ca);
      if(qa.length>=6&&ca.length>=6&&(qa.indexOf(ca)>=0||ca.indexOf(qa)>=0))nm=Math.max(nm,0.9); // un nom contenu dans l'autre
      const lc=q.loc&&d.location?sim(stripNoise(q.loc),stripNoise(d.location)):0;
      const sc=Math.max(nm,lc);
      if(sc>=0.7&&(!b||sc>b.sc))b={sc:sc,q:q,qi:qi};
    });
    if(b)best[i]=b;
  });
  const used={};Object.keys(best).forEach(function(i){used[best[i].qi]=(used[best[i].qi]||0)+1;});
  const rev=[];let same=0;
  Object.keys(best).map(Number).sort(function(a,b){return best[b].sc-best[a].sc;}).forEach(function(i){
    const c=CAMPS_W[i],b=best[i],d=c.detail||{};
    if(d.lat===b.q.lat&&d.lon===b.q.lon){same++;return;}
    const had=d.lat!=null&&d.lon!=null;
    rev.push({kind:"geo",camp:c,q:b.q,pct:Math.round(b.sc*100),had:had,on:b.sc>=0.9&&!had&&used[b.qi]===1});
  });
  REVIEW=rev;IMPORT=null;hideReport(); // revue de coordonnées : pas de rapport de répertoire
  document.getElementById("rev-note").textContent=fname+" — "+pts.length+" point(s) read, "+rev.length+" camp(s) can get coordinates, "
    +same+" already up to date, "+(CAMPS_W.length-rev.length-same)+" without a match";
  document.getElementById("rev-body").innerHTML=rev.length?rev.map(function(r,i){
    return '<div class="rev-row"><input type="checkbox" id="rv-'+i+'"'+(r.on?" checked":"")+'> <span class="rev-tag '+(r.pct>=90?"t-upd":"t-fuz")+'">📍 '+r.pct+" %</span>"
      +'<div class="rev-what"><b>'+esc(r.camp.camp_name)+"</b> ⇐ "+esc(r.q.name)
      +"<div class='chg'>"+r.q.lat+", "+r.q.lon+(r.had?" (replaces the coordinates already saved)":"")+"</div></div></div>";
  }).join(""):'<span class="hint">No camp to place from this file.</span>';
  document.getElementById("review").style.display="";
  document.getElementById("review").scrollIntoView({behavior:"smooth",block:"start"});
  log("Coordinates file read: "+pts.length+" point(s). Tick the camps to place, then Apply.","ok");
}
