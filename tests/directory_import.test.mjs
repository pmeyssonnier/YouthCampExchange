// Import du répertoire YCE (xlsx) : lecture du classeur par l'analyseur XML, feuille manquante, lignes sans date valide,
// continent d'un pays inconnu. Classeurs fictifs fabriqués dans la page avec buildZip.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('directory import');
const srv = await serve(8893);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pg.goto('http://localhost:8893/yce_admin.html#camps', { waitUntil: 'load' }); await pg.waitForTimeout(600);

// fabrique un .xlsx : sheets = [{name, file, xml|null}] ; xml null = feuille déclarée mais absente du fichier
await pg.evaluate(() => {
  window.mkXlsx = async (sheets, sst) => {
    const enc = s => new TextEncoder().encode(s), NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const entries = [
      { name: '[Content_Types].xml', data: enc('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>') },
      { name: 'xl/workbook.xml', data: enc('<?xml version="1.0"?><workbook ' + NS + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + sheets.map((s, i) => '<sheet r:id="rId' + (i + 1) + '" sheetId="' + (i + 1) + '" name="' + s.name + '"/>').join('') + '</sheets></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: enc('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + sheets.map((s, i) => '<Relationship Target="worksheets/' + s.file + '" Type="x" Id="rId' + (i + 1) + '"/>').join('') + '</Relationships>') }];
    if (sst) entries.push({ name: 'xl/sharedStrings.xml', data: enc('<?xml version="1.0"?><sst ' + NS + '>' + sst.map(x => '<si>' + x + '</si>').join('') + '</sst>') });
    sheets.forEach(s => { if (s.xml != null) entries.push({ name: 'xl/worksheets/' + s.file, data: enc(s.xml) }); });
    return new File([await buildZip(entries)], 'directory.xlsx');
  };
  // feuille simple en chaînes en ligne : rows = tableaux de valeurs
  window.mkSheet = rows => '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + rows.map((r, i) => '<row r="' + (i + 1) + '">' + r.map((v, j) => v == null ? '' : '<c r="' + String.fromCharCode(65 + j) + (i + 1) + '" t="inlineStr"><is><t>' + String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</t></is></c>').join('') + '</row>').join('')
    + '</sheetData></worksheet>';
  window.HDR = ['Country', 'Camp Name', 'Camp Start', 'Camp End', 'Location', 'Age', 'Fees', 'Currency'];
  window.pick = async f => { document.getElementById('log').innerHTML = ''; await dirPick({ files: [f], value: '' }); return document.getElementById('log').textContent; };
});

// 1. classeur « difficile » pour des expressions régulières : attributs dans un autre ordre, préfixe d'espace de noms, entités,
//    CDATA, guide phonétique, chaînes partagées et en ligne, cellule sans référence, feuille voulue en deuxième position
const hard = await pg.evaluate(async () => {
  const sheet = '<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>'
    + '<x:row r="1"><x:c t="s" r="A1"><x:v>0</x:v></x:c><x:c s="3" t="s" r="B1"><x:v>1</x:v></x:c><x:c t="s"><x:v>2</x:v></x:c></x:row>'
    + '<x:row r="2"><x:c r="A2" t="inlineStr"><x:is><x:t>C&#244;te d&apos;Azur &amp; Monaco</x:t></x:is></x:c>'
    + '<x:c t="s" r="B2"><x:v>3</x:v></x:c><x:c r="C2"><x:v>46583</x:v></x:c></x:row>'
    + '<x:row r="3"><x:c r="A3" t="inlineStr"><x:is><x:t><![CDATA[Fish & <Chips>]]></x:t></x:is></x:c><x:c r="C3" t="str"><x:f>1+1</x:f><x:v>07/15/2027</x:v></x:c></x:row>'
    + '</x:sheetData></x:worksheet>';
  const f = await mkXlsx([{ name: 'Read me', file: 'sheet1.xml', xml: mkSheet([['not this one']]) }, { name: 'Approved  Camps', file: 'sheet2.xml', xml: sheet }],
    ['<t>Country</t>', '<r><t>Camp </t></r><r><t>Name</t></r>', '<t>Camp Start</t>', '<t>Camp</t><rPh><t>PHONETIC</t></rPh><t xml:space="preserve"> Azur</t>']);
  return parseDirectory(await f.arrayBuffer());
});
t.ok(JSON.stringify(hard[0]) === '["Country","Camp Name","Camp Start"]', 'header read whatever the attribute order, with a namespace prefix and a cell without reference: ' + JSON.stringify(hard[0]));
t.ok(hard[1][0] === "Côte d'Azur & Monaco" && hard[1][1] === 'Camp Azur' && hard[1][2] === '46583', 'entities decoded, rich text joined, phonetic guide left out: ' + JSON.stringify(hard[1]));
t.ok(hard[2][0] === 'Fish & <Chips>' && hard[2][1] === undefined && hard[2][2] === '07/15/2027', 'CDATA and formula result read; the right sheet is used though it is second: ' + JSON.stringify(hard[2]));

// 2. feuille déclarée mais absente, XML abîmé, fichier qui n'est pas un classeur : message explicite, pas d'erreur de script
const bad = await pg.evaluate(async () => ({
  missing: await pick(await mkXlsx([{ name: 'Approved Camps', file: 'sheet1.xml', xml: null }])),
  damaged: await pick(await mkXlsx([{ name: 'Approved Camps', file: 'sheet1.xml', xml: '<worksheet><sheetData><row><c></row></sheetData></worksheet>' }])),
  notWb: await pick(new File([await buildZip([{ name: 'word/document.xml', data: new TextEncoder().encode('<a/>') }])], 'letter.docx')),
  review: document.getElementById('review').style.display
}));
t.ok(/Directory import failed: the sheet .Approved Camps. is listed in the workbook but its content is missing/.test(bad.missing) && !/null|undefined|replace/.test(bad.missing), 'missing sheet: explicit message: ' + bad.missing);
t.ok(/is damaged \(not valid XML\)/.test(bad.damaged), 'damaged sheet: explicit message: ' + bad.damaged);
t.ok(/not an Excel workbook/.test(bad.notWb) && bad.review === 'none', 'not a workbook: explicit message, no review opened: ' + bad.notWb);

// 3. rapport de lecture : lus = à revoir + ignorés + rejetés, avec la raison de chaque rejet ; rien n'est écarté en silence
const sk = await pg.evaluate(async () => {
  const keepC = CAMPS_W, keepA = ARCH;
  CAMPS_W = [{ continent: 'South America', country: 'Chile', camp_name: 'Fictional Same Camp', camp_starts: '01-07-2027', camp_ends: '10-07-2027', age_requirements: '', fee: null, family_stay_starts: null, family_stay_ends: null, detail: {} }];
  ARCH = [{ continent: 'South America', country: 'Peru', camp_name: 'Fictional Archived Camp', camp_starts: '02-07-2027', detail: {} }];
  const logTxt = await pick(await mkXlsx([{ name: 'Approved Camps', file: 'sheet1.xml', xml: mkSheet([HDR,
    ['Chile', 'Fictional Andes Camp', '07/10/2027', '07/20/2027', 'Santiago', '17-21', '300', 'USD'],
    ['Chile', 'Fictional Day-First Camp', '25/07/2027', '30/07/2027', 'Valparaiso'],
    ['Peru', 'Fictional No Date Camp', null, null, 'Cusco'],
    ['Peru', 'Fictional Text Date Camp', 'mid July', null, 'Lima'],
    ['Peru', null, '07/12/2027', null, 'Arequipa'],
    [null, null, null, null, null],
    ['Chile', 'Fictional Same Camp', '07/01/2027', '07/10/2027'],
    ['Peru', 'Fictional Archived Camp', '07/02/2027'],
    ['Chile', 'Fictional Backwards Camp', '07/20/2027', '07/10/2027'],
    ['Chile', 'Fictional Andes Camp', '07/10/2027', '07/21/2027'],
    [null, 'Fictional Stateless Camp', '07/15/2027'],
    ['Chile', 'Fictional Odd End Camp', '07/16/2027', 'end of July']])}]));
  const body = document.getElementById('rev-body').innerText, note = document.getElementById('rev-note').textContent, names = REVIEW.map(r => r.t.name), rep = JSON.parse(JSON.stringify(IMPORT));
  const rows = document.querySelectorAll('#rev-body .rev-row').length;
  cancelReview(); CAMPS_W = keepC; ARCH = keepA; render();
  return { logTxt, body, note, names, rep, rows };
});
t.ok(sk.rep.read === 11 && sk.names.join() === 'Fictional Andes Camp,Fictional Odd End Camp' && sk.rows === 2, 'read report: 11 lines read (the empty one is not counted), 2 offered: ' + sk.names);
t.ok(sk.rep.unchanged === 1 && sk.rep.archived === 1 && sk.rep.rejected.length === 7 && sk.rep.read === sk.names.length + 2 + 7, 'read = to review + ignored + rejected (' + sk.rep.read + ' = ' + sk.names.length + ' + 2 + ' + sk.rep.rejected.length + ')');
t.ok(/11 line\(s\) read — 2 to review below \(0 update\(s\), 2 new\), 2 ignored \(1 unchanged, 1 already archived\), 7 rejected/.test(sk.body) && /7 rejected/.test(sk.note), 'the review opens with the counts: ' + sk.body.slice(0, 140));
t.ok(/row 3 · Chile — Fictional Day-First Camp: camp start .25\/07\/2027. is not a date/.test(sk.body) && /row 4 · Peru — Fictional No Date Camp: no camp start date/.test(sk.body)
  && /Fictional Text Date Camp/.test(sk.body) && /row 6 · Peru — \(no camp name\): the camp name is empty/.test(sk.body), 'rejected lines: row, camp and reason (date missing or unreadable, no name)');
t.ok(/row 10 · Chile — Fictional Backwards Camp: camp end 10-07-2027 is before camp start 20-07-2027/.test(sk.body) && /row 11 · Chile — Fictional Andes Camp: same camp as row 2/.test(sk.body)
  && /row 12 · \? — Fictional Stateless Camp: the country is empty/.test(sk.body), 'rejected lines: end before start, duplicate line, no country');
t.ok(sk.rep.remarks.length === 1 && /Accepted with a remark:[\s\S]*row 13 · Chile — Fictional Odd End Camp: camp end .end of July. is not a date: not imported/.test(sk.body), 'an unreadable optional date is a remark, the camp stays accepted');
t.ok(/7 line\(s\) of the directory rejected/.test(sk.logTxt) && /Directory read: 11 line\(s\) — 2 to review, 2 ignored, 7 rejected/.test(sk.logTxt), 'counts and rejections also written in the journal');

// 3 bis. application transactionnelle : une anomalie en cours de route annule tout ; sinon tout est appliqué et le rapport final est affiché
const tx = await pg.evaluate(async () => {
  const keepC = CAMPS_W, keepA = ARCH, keepD = DIRTY;
  const base = () => [{ continent: 'South America', country: 'Chile', camp_name: 'Fictional Old Chile Camp', camp_starts: '01-07-2026', camp_ends: '10-07-2026', age_requirements: '16-20', fee: '100 USD', family_stay_starts: null, family_stay_ends: null, detail: { location: 'Santiago' } },
    { continent: 'South America', country: 'Peru', camp_name: 'Fictional Lima Camp', camp_starts: '05-07-2027', camp_ends: '15-07-2027', age_requirements: '17-21', fee: '200 USD', family_stay_starts: null, family_stay_ends: null, detail: {} }];
  CAMPS_W = base(); ARCH = [];
  const file = () => mkXlsx([{ name: 'Approved Camps', file: 'sheet1.xml', xml: mkSheet([HDR,
    ['Peru', 'Fictional Lima Camp', '07/05/2027', '07/16/2027', 'Lima', '18-22', '250', 'USD'],
    ['Chile', 'Patagonia Glacier Trek', '07/10/2027', '07/20/2027', 'Punta Arenas'],
    ['Peru', 'Fictional Cusco Camp', '07/11/2027', '07/21/2027', 'Cusco'],
    ['Peru', 'Fictional Arequipa Camp', '07/12/2027', '07/22/2027', 'Arequipa'],
    ['Peru', 'Fictional Broken Camp', null]])}]);
  await pick(await file());
  const snapTxt = () => JSON.stringify([CAMPS_W, ARCH], (k, v) => k === '_i' ? undefined : v); const before = snapTxt(), objs = CAMPS_W.slice();
  // anomalie simulée sur la 3e ligne cochée (le 2e nouveau camp) : deux lignes sont déjà appliquées à ce moment-là
  REVIEW[2].t.cs = '31-02-2027';
  document.querySelectorAll('#rev-body [id^="rva-"]').forEach(x => { x.checked = true; });
  document.getElementById('log').innerHTML = ''; applyReview();
  const cancelled = { log: document.getElementById('log').textContent, same: snapTxt() === before, identity: CAMPS_W.length === 2 && CAMPS_W.every((c, i) => c === objs[i]),
    reviewOpen: !!REVIEW && document.getElementById('review').style.display !== 'none', report: document.getElementById('imp-report').style.display };
  // même fichier, sans anomalie : une ligne décochée, l'ancien camp chilien archivé
  cancelReview(); CAMPS_W = base(); ARCH = [];
  await pick(await file());
  const iUn = REVIEW.findIndex(r => r.t.name === 'Fictional Arequipa Camp'); document.getElementById('rv-' + iUn).checked = false;
  document.querySelectorAll('#rev-body [id^="rva-"]').forEach(x => { x.checked = true; });
  document.getElementById('log').innerHTML = ''; applyReview();
  const rpt = document.getElementById('imp-report'), done = { shown: rpt.style.display !== 'none', text: rpt.innerText, names: CAMPS_W.map(c => c.camp_name).sort(), arch: ARCH.map(c => c.camp_name),
    lima: CAMPS_W.find(c => c.camp_name === 'Fictional Lima Camp').camp_ends, reviewClosed: !REVIEW };
  hideReport(); const closed = rpt.style.display === 'none';
  CAMPS_W = keepC; ARCH = keepA; DIRTY = keepD; document.getElementById('dirty').style.display = keepD ? '' : 'none'; render();
  return { cancelled, done, closed };
});
t.ok(/Import cancelled — nothing was applied/.test(tx.cancelled.log) && /Fictional Cusco Camp.*camp start .31-02-2027. is not a valid date/.test(tx.cancelled.log), 'transaction: an anomaly cancels the import with its reason: ' + tx.cancelled.log);
t.ok(tx.cancelled.same && tx.cancelled.identity, 'transaction: the list and the archive are exactly as before (the update and the camp already created are undone)');
t.ok(tx.cancelled.reviewOpen && tx.cancelled.report === 'none', 'transaction: the review stays open, no report of a cancelled import');
t.ok(tx.done.names.join() === 'Fictional Cusco Camp,Fictional Lima Camp,Patagonia Glacier Trek' && tx.done.arch.join() === 'Fictional Old Chile Camp' && tx.done.lima === '16-07-2027' && tx.done.reviewClosed, 'without anomaly everything ticked is applied: ' + tx.done.names + ' / archived ' + tx.done.arch);
t.ok(tx.done.shown && /5\s*Read/i.test(tx.done.text) && /3\s*Applied\s*1 updated, 2 created/i.test(tx.done.text) && /1\s*Ignored\s*0 unchanged, 0 already archived, 1 not ticked/i.test(tx.done.text) && /1\s*Rejected/i.test(tx.done.text), 'final report: read, applied, ignored, rejected: ' + tx.done.text.replace(/\s+/g, ' ').slice(0, 260));
t.ok(/Rejected \(1\)[\s\S]*row 6 · Peru — Fictional Broken Camp: no camp start date/.test(tx.done.text) && /1 earlier camp\(s\) replaced/.test(tx.done.text) && tx.closed, 'final report: reason of each rejection, archived camp mentioned, Close hides it');

// 4. continent : pays connu de la table → son continent ; pays inconnu → à choisir, rien n'est appliqué sans choix (plus d'Europe par défaut)
const ct = await pg.evaluate(async () => {
  const keepC = CAMPS_W, keepA = ARCH, keepD = DIRTY;
  CAMPS_W = [{ continent: 'Asia', country: 'Japan', camp_name: 'Old Fuji Camp', camp_starts: '01-07-2026', detail: {} }]; ARCH = [];
  await pick(await mkXlsx([{ name: 'Approved Camps', file: 'sheet1.xml', xml: mkSheet([HDR,
    ['Chile', 'Fictional Andes Camp', '07/10/2027'], ['Atlantis', 'Fictional Deep Sea Camp', '07/11/2027'], ['japan', 'Fictional Sakura Camp', '07/12/2027'], ['Kenya', 'Fictional Savannah Camp', '07/13/2027']])}]));
  const selects = document.querySelectorAll('#rev-body [id^="rvc-"]').length, row = [...document.querySelectorAll('#rev-body .rev-row')].find(r => /Atlantis/.test(r.textContent)).textContent;
  document.getElementById('log').innerHTML = ''; applyReview();
  const refused = document.getElementById('log').textContent, stillOpen = !!REVIEW, nAfterRefusal = CAMPS_W.length;
  document.querySelector('#rev-body [id^="rvc-"]').value = 'Oceania'; applyReview();
  const by = {}; CAMPS_W.forEach(c => { by[c.camp_name] = c.continent; });
  CAMPS_W = keepC; ARCH = keepA; DIRTY = keepD; document.getElementById('dirty').style.display = keepD ? '' : 'none'; render();
  return { selects, row, refused, stillOpen, nAfterRefusal, by, direct: [continentFor('Türkiye'), continentFor('UNITED STATES'), continentFor('Nowhereland'), continentFor('')] };
});
t.ok(ct.selects === 1 && /Country not known to the site/.test(ct.row), 'only the unknown country asks for its continent: ' + ct.row.slice(0, 160));
t.ok(/Choose the continent of: Atlantis — Fictional Deep Sea Camp/.test(ct.refused) && /Nothing was applied/.test(ct.refused) && ct.stillOpen && ct.nAfterRefusal === 1, 'apply is refused until the continent is chosen, nothing applied: ' + ct.refused);
t.ok(ct.by['Fictional Deep Sea Camp'] === 'Oceania' && ct.by['Fictional Andes Camp'] === 'South America' && ct.by['Fictional Savannah Camp'] === 'Africa', 'chosen continent applied; known countries get theirs: ' + JSON.stringify(ct.by));
t.ok(ct.by['Fictional Sakura Camp'] === 'Asia', 'a country already on the site gives its continent whatever the capitals');
t.ok(ct.direct.join('|') === 'Europe|North America||', 'continentFor: known names, unknown and empty → "": ' + ct.direct.join('|'));
t.ok(!Object.values(ct.by).some(v => !v), 'no camp created without a continent');

t.ok(!errs.length, 'no page error ' + errs.join(' | '));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
