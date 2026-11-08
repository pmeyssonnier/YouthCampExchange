// Le champ « YCE page » (yce_url) n'existe plus : ni dans les données, ni sur la fiche publique, ni dans l'administration ; une ancienne sauvegarde ne le ramène pas.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('no yce_url');
const RAW = new Function(fs.readFileSync('../camps_data.js', 'utf8') + ';return RAW;')();
const ARCH = JSON.parse(fs.readFileSync('../camps_archive.json', 'utf8')).archive;
t.ok(!RAW.some(c => c.detail && 'yce_url' in c.detail), 'camps_data.js: no yce_url left');
t.ok(!ARCH.some(c => c.detail && 'yce_url' in c.detail), 'camps_archive.json: no yce_url left');

const srv = await serve(8899);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pg.goto('http://localhost:8899/index.html', { waitUntil: 'load' });
const pub = await pg.evaluate(() => { let bad = 0; CAMPS.forEach((c, i) => { c.detail = Object.assign({}, c.detail, { yce_url: 'https://www.lions-yce-belgium.be/x' }); showCampDetail(i); const b = document.getElementById('md-body'); if (/YCE Page/.test(b.innerText) || b.querySelector('a[href*="lions-yce-belgium.be"]')) bad++; }); return bad; });
t.ok(pub === 0, 'public camp sheet never shows a YCE Page line, even if the field were present (' + pub + ' camps)');
await pg.close();

const pa = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pa.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pa.goto('http://localhost:8899/yce_admin.html', { waitUntil: 'load' });
const adm = await pa.evaluate(() => { const i = CAMPS_W.findIndex(c => c.detail && c.detail.website); openEdit(i); const has = !!document.getElementById('e-yce_url'); closeEdit(); return { has, key: DET_KEYS.includes('yce_url') }; });
t.ok(!adm.has && !adm.key, 'administration: no YCE page field, not in the allowed detail keys');
// import d'une ancienne sauvegarde : yce_url retiré
const imp = await pa.evaluate(async () => {
  const camps = JSON.parse(JSON.stringify(CAMPS_W)); camps[0].detail = Object.assign({}, camps[0].detail, { yce_url: 'https://www.lions-yce-belgium.be/old' });
  const archive = [JSON.parse(JSON.stringify(camps[1]))]; archive[0].detail = Object.assign({}, archive[0].detail, { yce_url: 'https://www.lions-yce-belgium.be/old2' });
  const file = new File([JSON.stringify({ camps, archive })], 'old.json', { type: 'application/json' });
  window.confirm = () => true;
  const inp = document.createElement('input'); inp.type = 'file'; const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; jsonPick(inp);
  await new Promise(r => setTimeout(r, 400));
  return { act: CAMPS_W.some(c => c.detail && 'yce_url' in c.detail), arc: ARCH.some(c => c.detail && 'yce_url' in c.detail) };
});
t.ok(!imp.act && !imp.arc, 'importing an old backup drops yce_url (active and archive)');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
