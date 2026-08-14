// site-map.js — carte du monde D3 : bulles continents/pays, zooms, panneau pays
// Chargé par index.html ; scripts classiques partageant la portée globale.
// ── MAP ──────────────────────────────────────────────
let mapInited=false,mapView='world',mapProjection,mapSvg,mapG;
let currentContinent=null,currentContProj=null,currentCountry=null;

const CONT_COORDS={'Africa':[20,0],'Asia':[90,30],'Europe':[15,52],'North America':[-100,46],'South America':[-55,-15],'Middle America':[-90,17],'Oceania':[140,-27]};
const CONT_ZOOM={'Africa':{scale:380,center:[20,0]},'Asia':{scale:350,center:[90,30]},'Europe':{scale:700,center:[15,52]},'North America':{scale:250,center:[-100,46]},'South America':{scale:280,center:[-55,-15]},'Middle America':{scale:600,center:[-90,17]},'Oceania':{scale:400,center:[145,-28]}};
const COUNTRY_COORDS={'Namibia':[18.5,-22.0],'Bangladesh':[90.3,23.7],'India':[78.9,20.6],'Indonesia':[113.9,-0.8],'Japan':[138.3,36.2],'Sri Lanka':[80.7,7.9],'Taiwan':[121.0,23.7],'Austria':[14.5,47.5],'Belgium':[4.5,50.5],'Bulgaria':[25.5,42.7],'Croatia':[15.5,45.2],'Czech rep. and Slovakia':[17.0,49.5],'Denmark':[10.0,56.0],'Estonia':[25.0,58.6],'Finland':[26.0,64.0],'France':[2.3,46.2],'Germany':[10.5,51.2],'Hungary':[19.5,47.2],'Ireland':[-8.0,53.4],'Italy':[12.6,42.5],'Lithuania':[23.9,55.2],'Netherlands':[5.3,52.1],'Poland':[19.1,51.9],'Romania':[25.0,45.9],'Serbia':[21.0,44.0],'Slovakia':[19.7,48.7],'Slovenia':[14.8,46.1],'Spain':[-3.7,40.4],'Sweden':[18.6,60.1],'Switzerland':[8.2,46.8],'Turkey':[35.2,38.9],'United Kingdom':[-2.0,54.0],'Mexico':[-102.6,23.6],'Canada':[-96.8,56.1],'United States':[-98.6,39.5],'Brazil':[-51.9,-14.2],
// pays sans camp cette saison, pré-cartographiés pour les saisons futures :
'Portugal':[-8.2,39.6],'Norway':[8.5,61.5],'Greece':[22.0,39.0],'Iceland':[-18.6,64.9],'Latvia':[24.6,56.9],'Luxembourg':[6.1,49.8],'Malta':[14.4,35.9],'Cyprus':[33.2,35.1],'North Macedonia':[21.7,41.6],'Montenegro':[19.3,42.7],'South Korea':[127.8,36.5],'Thailand':[101.0,15.8],'Malaysia':[102.0,4.2],'Philippines':[122.0,12.9],'Hong Kong':[114.1,22.4],'Israel':[34.9,31.4],'Mongolia':[103.8,46.9],'South Africa':[24.7,-29.0],'Kenya':[37.9,0.0],'Australia':[134.0,-25.7],'New Zealand':[172.5,-41.0],'Argentina':[-64.0,-34.0],'Chile':[-71.5,-35.7],'Peru':[-75.0,-9.2],'Colombia':[-74.3,4.6],'Ecuador':[-78.2,-1.8],'Costa Rica':[-84.2,9.7],'Guatemala':[-90.4,15.6],'Panama':[-80.1,8.5]};
const COUNTRY_ZOOM={'Namibia':{scale:900,center:[18.5,-22.0]},'Bangladesh':{scale:2800,center:[90.3,23.7]},'India':{scale:550,center:[82,22]},'Indonesia':{scale:600,center:[116,-1]},'Japan':{scale:1400,center:[138,36]},'Sri Lanka':{scale:3500,center:[80.7,7.9]},'Taiwan':{scale:3500,center:[121,23.7]},'Austria':{scale:4500,center:[14.5,47.5]},'Belgium':{scale:5000,center:[4.5,50.5]},'Bulgaria':{scale:3000,center:[25.5,42.7]},'Croatia':{scale:3800,center:[15.5,45.0]},'Czech rep. and Slovakia':{scale:2800,center:[18,49.2]},'Denmark':{scale:2500,center:[10,56]},'Estonia':{scale:3500,center:[25,58.6]},'Finland':{scale:1300,center:[26,64]},'France':{scale:2000,center:[2.3,46.2]},'Germany':{scale:2000,center:[10.5,51.2]},'Hungary':{scale:3800,center:[19.5,47.2]},'Ireland':{scale:3500,center:[-8,53.4]},'Italy':{scale:1800,center:[12.6,42.5]},'Lithuania':{scale:3800,center:[23.9,55.2]},'Netherlands':{scale:4500,center:[5.3,52.1]},'Poland':{scale:2200,center:[19.1,51.9]},'Romania':{scale:2500,center:[25,45.9]},'Serbia':{scale:4000,center:[21,44]},'Slovakia':{scale:4500,center:[19.7,48.7]},'Slovenia':{scale:6000,center:[14.8,46.1]},'Spain':{scale:2000,center:[-3.7,40.4]},'Sweden':{scale:1300,center:[18.6,60.1]},'Switzerland':{scale:5000,center:[8.2,46.8]},'Turkey':{scale:1600,center:[35.2,38.9]},'United Kingdom':{scale:2000,center:[-2,54]},'Mexico':{scale:1100,center:[-102.6,23.6]},'Canada':{scale:500,center:[-96.8,56.1]},'United States':{scale:600,center:[-98.6,39.5]},'Brazil':{scale:600,center:[-51.9,-14.2]},
// pays sans camp cette saison, pré-cartographiés pour les saisons futures :
'Portugal':{scale:2400,center:[-8.2,39.6]},'Norway':{scale:1000,center:[10,64.5]},'Greece':{scale:2400,center:[23.5,38.5]},'Iceland':{scale:2800,center:[-18.6,64.9]},'Latvia':{scale:3800,center:[24.6,56.9]},'Luxembourg':{scale:9000,center:[6.1,49.8]},'Malta':{scale:9000,center:[14.4,35.9]},'Cyprus':{scale:6000,center:[33.2,35.1]},'North Macedonia':{scale:5000,center:[21.7,41.6]},'Montenegro':{scale:5500,center:[19.3,42.7]},'South Korea':{scale:2400,center:[127.8,36.5]},'Thailand':{scale:1300,center:[101.0,15.8]},'Malaysia':{scale:1500,center:[105.0,3.5]},'Philippines':{scale:1200,center:[122.0,12.9]},'Hong Kong':{scale:9000,center:[114.1,22.4]},'Israel':{scale:3500,center:[34.9,31.4]},'Mongolia':{scale:900,center:[103.8,46.9]},'South Africa':{scale:1100,center:[24.7,-29.0]},'Kenya':{scale:1800,center:[37.9,0.0]},'Australia':{scale:650,center:[134.0,-25.7]},'New Zealand':{scale:1500,center:[172.5,-41.0]},'Argentina':{scale:650,center:[-64.0,-37.0]},'Chile':{scale:700,center:[-71.5,-38.0]},'Peru':{scale:1100,center:[-75.0,-9.2]},'Colombia':{scale:1400,center:[-74.3,4.6]},'Ecuador':{scale:2400,center:[-78.2,-1.8]},'Costa Rica':{scale:4500,center:[-84.2,9.7]},'Guatemala':{scale:4000,center:[-90.4,15.6]},'Panama':{scale:4500,center:[-80.1,8.5]}};

function initMap(){
  mapInited=true;
  const w=document.getElementById('map-svg').clientWidth||900;
  const h=document.getElementById('map-svg').clientHeight||500;
  mapProjection=d3.geoNaturalEarth1().scale(w/6.5).translate([w/2,h/2]);
  mapSvg=d3.select('#map-svg').attr('viewBox',`0 0 ${w} ${h}`).attr('preserveAspectRatio','xMidYMid meet');
  mapSvg.append('rect').attr('width',w).attr('height',h).attr('fill','#0a1525');
  mapSvg.append('path').datum(d3.geoGraticule()()).attr('d',d3.geoPath().projection(mapProjection)).attr('fill','none').attr('stroke','#1a3050').attr('stroke-width',0.4);
  mapG=mapSvg.append('g');
  fetch('https://unpkg.com/world-atlas@2/countries-110m.json').then(r=>r.json()).then(world=>{
    mapG.append('path').datum(topojson.feature(world,world.objects.land)).attr('d',d3.geoPath().projection(mapProjection)).attr('fill','#0e2040');
    mapG.selectAll('.country').data(topojson.feature(world,world.objects.countries).features).join('path')
      .attr('class','country').attr('d',d3.geoPath().projection(mapProjection)).attr('fill','#112840').attr('stroke','#1e3a5a').attr('stroke-width',0.3);
    renderWorldBubbles();renderLegend();
  }).catch(()=>{renderWorldBubbles();renderLegend();});
}

function renderWorldBubbles(){
  mapG.selectAll('.cont-bubble').remove();
  const maxC=Math.max(...Object.values(CONT_CAMP_COUNTS));
  const rScale=d3.scaleSqrt().domain([0,maxC]).range([0,60]);
  const tt=document.getElementById('tt'),ttT=document.getElementById('tt-t'),ttC=document.getElementById('tt-c'),ttH=document.getElementById('tt-h');
  Object.entries(CONT_CAMP_COUNTS).forEach(([cont,cnt])=>{
    const coords=CONT_COORDS[cont];if(!coords)return;
    const[x,y]=mapProjection(coords),r=rScale(cnt);
    const g=mapG.append('g').attr('class','cont-bubble').attr('cursor','pointer');
    g.append('circle').attr('cx',x).attr('cy',y).attr('r',r+6).attr('fill','none').attr('stroke','#e8a020').attr('stroke-width',1).attr('opacity',0.15);
    g.append('circle').attr('cx',x).attr('cy',y).attr('r',r).attr('fill','#e8a020').attr('opacity',0.65).attr('stroke','#ffd166').attr('stroke-width',1.5)
      .on('mousemove',ev=>{tt.classList.add('vis');tt.style.left=(ev.clientX+14)+'px';tt.style.top=(ev.clientY-10)+'px';ttT.textContent=cont;ttC.textContent=`${cnt} camp${cnt>1?'s':''}`;ttH.textContent='Click to see by country';})
      .on('mouseleave',()=>tt.classList.remove('vis'))
      .on('click',()=>{tt.classList.remove('vis');zoomContinent(cont);});
    g.append('text').attr('x',x).attr('y',y+1).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('fill','#0d1827').attr('font-weight','700').attr('font-size',Math.max(10,r*0.55)).attr('font-family','IBM Plex Mono,monospace').attr('pointer-events','none').text(cnt);
    g.append('text').attr('x',x).attr('y',y+r+14).attr('text-anchor','middle').attr('fill','#e8c060').attr('font-size',10).attr('font-family','IBM Plex Sans,sans-serif').attr('pointer-events','none').text(cont);
  });
}

function zoomContinent(cont){
  mapView='continent';currentContinent=cont;
  document.getElementById('back-btn').style.display='block';document.getElementById('back-btn').textContent='← World';
  document.getElementById('crumb-c').style.display='';document.getElementById('crumb-cn').textContent=cont;
  document.getElementById('crumb-k').style.display='none';
  const countries=[...new Set(CAMPS.filter(c=>c.continent===cont).map(c=>c.country))].sort();
  const mi=document.getElementById('map-info');mi.classList.add('vis');
  document.getElementById('mi-title').textContent=cont;
  document.getElementById('mi-rows').innerHTML=countries.map(c=>
    `<div class="mi-row" onclick="zoomCountry('${escQ(c)}')"><span>${c}</span><span class="mi-val">${COUNTRY_CAMP_COUNTS[c]} camp${COUNTRY_CAMP_COUNTS[c]>1?'s':''} ›</span></div>`
  ).join('');
  document.getElementById('map-hint').textContent='Click a country bubble or name to see camps';
  const zoom=CONT_ZOOM[cont];const vb=mapSvg.attr('viewBox').split(' ');const w=+vb[2],h=+vb[3];
  const newProj=d3.geoNaturalEarth1().scale(zoom?zoom.scale:w/6.5).center(zoom?zoom.center:[0,0]).translate([w/2,h/2]);
  currentContProj=newProj;
  mapG.selectAll('.country').transition().duration(650).attr('d',d3.geoPath().projection(newProj));
  mapG.selectAll('.cont-bubble').remove();
  setTimeout(()=>renderCountryBubbles(cont,newProj),700);
}

function renderCountryBubbles(cont,proj){
  mapG.selectAll('.ctry-bubble').remove();
  const countries=[...new Set(CAMPS.filter(c=>c.continent===cont).map(c=>c.country))];
  const maxC=Math.max(...countries.map(c=>COUNTRY_CAMP_COUNTS[c]||0));
  const rScale=d3.scaleSqrt().domain([0,maxC]).range([0,40]);
  const tt=document.getElementById('tt'),ttT=document.getElementById('tt-t'),ttC=document.getElementById('tt-c'),ttH=document.getElementById('tt-h');
  countries.forEach((country,idx)=>{
    const coords=COUNTRY_COORDS[country];if(!coords)return;
    const[x,y]=proj(coords);const cnt=COUNTRY_CAMP_COUNTS[country]||0;const r=Math.max(12,rScale(cnt));
    const g=mapG.append('g').attr('class','ctry-bubble').attr('cursor','pointer').attr('opacity',0);
    g.append('circle').attr('cx',x).attr('cy',y).attr('r',r+7).attr('fill','none').attr('stroke','#4fc3f7').attr('stroke-width',1).attr('opacity',0.15);
    g.append('circle').attr('cx',x).attr('cy',y).attr('r',r).attr('fill','#4fc3f7').attr('opacity',0.72).attr('stroke','#80d8ff').attr('stroke-width',1.8)
      .on('mousemove',ev=>{tt.classList.add('vis');tt.style.left=(ev.clientX+14)+'px';tt.style.top=(ev.clientY-10)+'px';ttT.textContent=country;ttC.textContent=`${cnt} camp${cnt>1?'s':''}`;ttH.textContent='Click to see camp list';})
      .on('mouseleave',()=>tt.classList.remove('vis'))
      .on('click',()=>{tt.classList.remove('vis');zoomCountry(country);});
    g.append('text').attr('x',x).attr('y',y+1).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('fill','#0d1827').attr('font-weight','700').attr('font-size',Math.max(9,r*0.55)).attr('font-family','IBM Plex Mono,monospace').attr('pointer-events','none').text(cnt);
    g.append('text').attr('x',x).attr('y',y+r+13).attr('text-anchor','middle').attr('fill','#80d8ff').attr('font-size',9).attr('font-family','IBM Plex Sans,sans-serif').attr('pointer-events','none').text(country);
    g.transition().duration(400).delay(idx*40).attr('opacity',1);
  });
}

function zoomCountry(country){
  currentCountry=country;mapView='country';
  document.getElementById('back-btn').style.display='block';document.getElementById('back-btn').textContent=`← ${currentContinent}`;
  document.getElementById('crumb-k').style.display='';document.getElementById('crumb-kn').textContent=country;
  document.getElementById('map-hint').textContent='Camp list →';
  document.getElementById('tt').classList.remove('vis');
  const zoom=COUNTRY_ZOOM[country];const vb=mapSvg.attr('viewBox').split(' ');const w=+vb[2],h=+vb[3];
  const newProj=d3.geoNaturalEarth1().scale(zoom?zoom.scale:1000).center(zoom?zoom.center:COUNTRY_COORDS[country]||[0,0]).translate([w/2,h/2]);
  const newPath=d3.geoPath().projection(newProj);
  mapG.selectAll('.country').transition().duration(700).attr('d',newPath);
  mapG.selectAll('.ctry-bubble').transition().duration(400).attr('opacity',function(){
    const txt=d3.select(this).selectAll('text').nodes();
    const lbl=txt.length>1?txt[txt.length-1].textContent:'';
    return lbl===country?1:0.25;
  });
  setTimeout(()=>{
    const coords=COUNTRY_COORDS[country];
    if(coords){
      const[nx,ny]=newProj(coords);
      mapG.selectAll('.ctry-bubble').filter(function(){
        const txt=d3.select(this).selectAll('text').nodes();
        return txt.length>1&&txt[txt.length-1].textContent===country;
      }).transition().duration(500).attr('transform',`translate(${nx-(currentContProj?currentContProj(coords)[0]:nx)},${ny-(currentContProj?currentContProj(coords)[1]:ny)})`);
    }
    showCountryCamps(country);
  },750);
}

function showCountryCamps(country){
  const camps=CAMPS.filter(c=>c.country===country).sort((a,b)=>a.camp_name.localeCompare(b.camp_name));
  document.getElementById('cp-country').textContent=country;document.getElementById('cp-count').textContent=camps.length;
  const isFree=f=>f&&(f.startsWith('0 ')||f==='0');
  document.getElementById('cp-body').innerHTML=!camps.length?'<div class="cp-empty">No camps found</div>':camps.map(c=>{
    const feeHtml=isFree(c.fee)?'<span class="cc-chip cc-free">FREE</span>':`<span class="cc-chip cc-fee">${c.fee||'—'}</span>`;
    const presHtml=c.arrival&&c.departure?`<div class="cc-presence"><span class="cc-presence-lbl">✈ Arrival → Departure</span><span class="cc-presence-val">${fmtDate2(c.arrival)} → ${fmtDate2(c.departure)}</span></div>`:'';
    const famHtml=c.fs?`<div class="cc-date-row"><span class="cc-date-lbl">🏠 Family Stay</span><span class="cc-date-val">${fmtDate2(c.fs)} → ${fmtDate2(c.fe)}</span></div>`:'';
    return`<div class="camp-card" onclick="showCampDetail(${c._idx})">
      <div class="cc-name">${c.camp_name}</div>
      <div class="cc-row"><span class="cc-chip cc-age">👤 ${c.age_requirements}</span>${feeHtml}</div>
      <div class="cc-dates"><div class="cc-date-row"><span class="cc-date-lbl">🏕️ Camp</span><span class="cc-date-val">${fmtDate2(c.cs)} → ${fmtDate2(c.ce)}</span></div>${famHtml}${presHtml}</div>
    </div>`;
  }).join('');
  document.getElementById('ctry-panel').classList.add('open');
}

function closeCountryPanel(){document.getElementById('ctry-panel').classList.remove('open');}

function goBack(){
  if(mapView==='country'){
    closeCountryPanel();mapView='continent';currentCountry=null;
    document.getElementById('crumb-k').style.display='none';document.getElementById('back-btn').textContent='← World';
    document.getElementById('map-hint').textContent='Click a country bubble or name to see camps';
    const zoom=CONT_ZOOM[currentContinent];const vb=mapSvg.attr('viewBox').split(' ');const w=+vb[2],h=+vb[3];
    const contProj=d3.geoNaturalEarth1().scale(zoom?zoom.scale:w/6.5).center(zoom?zoom.center:[0,0]).translate([w/2,h/2]);
    const contPath=d3.geoPath().projection(contProj);currentContProj=contProj;
    mapG.selectAll('.country').transition().duration(600).attr('d',contPath);
    mapG.selectAll('.ctry-bubble').transition().duration(300).attr('opacity',1).attr('transform','');
  } else {zoomWorld();}
}

function zoomContFromCrumb(){if(mapView==='country'){closeCountryPanel();goBack();}}

function zoomWorld(){
  closeCountryPanel();mapView='world';currentContinent=null;currentCountry=null;currentContProj=null;
  document.getElementById('back-btn').style.display='none';
  document.getElementById('crumb-c').style.display='none';document.getElementById('crumb-k').style.display='none';
  document.getElementById('map-info').classList.remove('vis');document.getElementById('tt').classList.remove('vis');
  document.getElementById('map-hint').textContent='Click a bubble to drill down';
  const vb=mapSvg.attr('viewBox').split(' ');const w=+vb[2],h=+vb[3];
  const baseProj=d3.geoNaturalEarth1().scale(w/6.5).translate([w/2,h/2]);
  mapG.selectAll('.country').transition().duration(650).attr('d',d3.geoPath().projection(baseProj));
  mapG.selectAll('.ctry-bubble').transition().duration(250).attr('opacity',0).remove();
  setTimeout(()=>renderWorldBubbles(),700);
}

function renderLegend(){
  const maxC=Math.max(...Object.values(CONT_CAMP_COUNTS));const rScale=d3.scaleSqrt().domain([0,maxC]).range([0,60]);
  document.getElementById('leg-items').innerHTML=[1,10,30,60].map(s=>{
    const r=rScale(s);
    return`<div class="leg-row"><div class="leg-circle" style="width:${r}px;height:${r}px;min-width:${r}px"></div><span style="color:var(--muted)">${s} camp${s>1?'s':''}</span></div>`;
  }).join('');
}
