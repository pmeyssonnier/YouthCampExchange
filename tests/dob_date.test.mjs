// Formulaire : plus de champ « Age on 01/07/… » (cellule calculée du modèle) ; la date de naissance est écrite comme une vraie date Excel.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('date of birth as a real date');
const srv = await serve(8902);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8902/yce_form_filler.html', { waitUntil: 'load' });
await pg.waitForTimeout(600);

const refs = await pg.evaluate(() => SECTIONS.flatMap(s => s.fields.map(f => [f.ref, f.label])));
t.ok(!refs.some(r => /^Age on/i.test(r[1])) && !refs.some(r => r[0] === 'J61'), 'the form has no "Age on 01/07/…" field any more');
t.ok(!(await pg.evaluate(() => !!document.getElementById('f-J61'))), 'no J61 input on the page');
t.ok(refs.some(r => r[0] === 'X17'), 'the date of birth field is still there');

const r = await pg.evaluate(async () => {
  const entries = await unzip(b64ToBuf(TEMPLATE_B64));
  const xml = new TextDecoder().decode(entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data);
  const sx = new TextDecoder().decode(entries.find(e => e.name === 'xl/styles.xml').data);
  const baseS = +xml.match(/<c r="X17"[^>]*? s="(\d+)"/)[1];
  const ds = addDateStyle(sx, baseS);
  const x2 = setCellDate(xml, 'X17', dmyToSerial('15-03-2009'), ds.idx);
  const cnt = s => +s.match(/<cellXfs count="(\d+)"/)[1];
  const xfs = ds.xml.match(/<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/)[1].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
  return { serial: dmyToSerial('15-03-2009'), y2k: dmyToSerial('01-01-2000'), back: serialToDmy(36526), back2: serialToDmy('39887'), junk: [serialToDmy('abc'), serialToDmy('15-03-2009'), serialToDmy('7')],
    cell: (x2.match(/<c r="X17"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/) || [''])[0], before: cnt(sx), after: cnt(ds.xml), real: xfs.length, idx: ds.idx,
    fmtDef: /<numFmt numFmtId="(\d+)" formatCode="dd\/mm\/yyyy"\/>/.test(ds.xml), newXf: xfs[ds.idx], baseXf: xfs[baseS], nf: (ds.xml.match(/<numFmts count="(\d+)"/) || [])[1], nfReal: (ds.xml.match(/<numFmt /g) || []).length,
    otherCells: x2.replace(/<c r="X17"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/, '') === xml.replace(/<c r="X17"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/, '') };
});
t.ok(r.serial === 39887 && r.y2k === 36526, 'dd-mm-yyyy → Excel serial number (15-03-2009 = ' + r.serial + ')');
t.ok(r.back === '01-01-2000' && r.back2 === '15-03-2009' && r.junk.every(x => x === ''), 'serial number → dd-mm-yyyy; text and tiny numbers are not dates');
t.ok(/<c r="X17" s="\d+"><v>39887<\/v><\/c>/.test(r.cell), 'X17 is a number cell: ' + r.cell);
t.ok(r.after === r.before + 1 && r.real === r.after && r.idx === r.before, 'one cell style added (' + r.before + ' → ' + r.after + '), cell points to it');
t.ok(r.fmtDef && /numFmtId="16\d"/.test(r.newXf) && !/numFmtId="49"/.test(r.newXf) && /applyNumberFormat="1"/.test(r.newXf), 'the new style has a date number format, not the text format: ' + r.newXf.slice(0, 120));
t.ok(r.baseXf && r.newXf.replace(/numFmtId="\d+"/, '').replace(/applyNumberFormat="\d"/, '') === r.baseXf.replace(/numFmtId="\d+"/, '').replace(/applyNumberFormat="\d"/, ''), 'the new style keeps the look of the original (font, fill, border, alignment)');
t.ok(+r.nf === r.nfReal, 'numFmts count is consistent (' + r.nf + ')');
t.ok(r.otherCells, 'no other cell of the sheet is touched');
// date de référence de l'âge = 1er juillet de l'année de la saison (YEAR), pas celle du modèle 2026
const yr = await pg.evaluate(async () => {
  const entries = await unzip(templateBuf);
  const xml = new TextDecoder().decode(entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data);
  const again = yearizeTemplate(xml);
  // un modèle déjà de l'année YEAR reste tel quel
  const same = yearizeTemplate(xml.replace(/(<c r="Q1"[^>]*><v>)\d{4}/, '$1' + YEAR));
  return { year: YEAR, d61: (xml.match(/<c r="D61"[^>]*><v>(\d+)<\/v>/) || [])[1], ac17: (xml.match(/<c r="AC17"[^>]*>[\s\S]*?<t[^>]*>([^<]*)<\/t>/) || [])[1], q1: (xml.match(/<c r="Q1"[^>]*><v>(\d+)<\/v>/) || [])[1],
    ui: ['f-Q9', 'f-AC9'].map(id => document.getElementById(id).value), idem: again === xml, keeps: same !== undefined && !/Age on 01\/07\/2026/.test(same) };
});
const ser = Math.round((Date.UTC(+yr.year, 6, 1) - Date.UTC(1899, 11, 30)) / 86400000);
t.ok(+yr.d61 === ser, 'reference date D61 = 1 July ' + yr.year + ' (serial ' + yr.d61 + ')');
t.ok(yr.ac17 === 'Age on 01/07/' + yr.year && +yr.q1 === +yr.year, 'label "' + yr.ac17 + '" and header year ' + yr.q1);
t.ok(yr.ui[0] === yr.year + '-07-01' && yr.ui[1] === yr.year + '-08-31', 'the proposed dates start on the season year: ' + yr.ui.join(' / '));
t.ok(yr.idem, 'applying it again changes nothing');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
