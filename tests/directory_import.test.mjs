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

// 3. lignes sans date de début valide : signalées dans la revue et le journal, les autres camps sont importés
const sk = await pg.evaluate(async () => {
  const keepC = CAMPS_W, keepA = ARCH; CAMPS_W = []; ARCH = [];
  const logTxt = await pick(await mkXlsx([{ name: 'Approved Camps', file: 'sheet1.xml', xml: mkSheet([HDR,
    ['Chile', 'Fictional Andes Camp', '07/10/2027', '07/20/2027', 'Santiago', '17-21', '300', 'USD'],
    ['Chile', 'Fictional Day-First Camp', '25/07/2027', '30/07/2027', 'Valparaiso'],
    ['Peru', 'Fictional No Date Camp', null, null, 'Cusco'],
    ['Peru', 'Fictional Text Date Camp', 'mid July', null, 'Lima'],
    ['Peru', null, '07/12/2027', null, 'Arequipa'],
    [null, null, null, null, null]])}]));
  const body = document.getElementById('rev-body').innerText, note = document.getElementById('rev-note').textContent, n = REVIEW.length, names = REVIEW.map(r => r.t.name);
  cancelReview(); CAMPS_W = keepC; ARCH = keepA; render();
  return { logTxt, body, note, n, names };
});
t.ok(sk.n === 1 && sk.names[0] === 'Fictional Andes Camp', 'the camp with a valid date is offered: ' + sk.names);
t.ok(/4 line\(s\) of the directory were left out/.test(sk.body) && /4 line\(s\) left out/.test(sk.note), 'left-out lines are counted in the review: ' + sk.note);
t.ok(/row 3 · Chile — Fictional Day-First Camp: camp start .25\/07\/2027. is not a date/.test(sk.body) && /row 4 · Peru — Fictional No Date Camp: no camp start date/.test(sk.body)
  && /Fictional Text Date Camp/.test(sk.body) && /row 6 · Peru — \(no camp name\)/.test(sk.body), 'each left-out line gives its row, its camp and the reason: ' + sk.body.slice(0, 400));
t.ok(/4 line\(s\) of the directory left out/.test(sk.logTxt), 'left-out lines also written in the journal');

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
