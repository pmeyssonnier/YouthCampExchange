// Deuxième séjour en famille d'accueil : section de la fiche seulement s'il existe (plus de chronologie), champs de l'administration, puce « Inclusion ».
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('second family stay + inclusion tag');
const RAW = new Function(fs.readFileSync('../camps_data.js', 'utf8') + ';return RAW;')();
const two = RAW.filter(c => c.family_stay2_starts);
t.ok(two.length >= 1 && two.every(c => c.family_stay2_ends && c.family_stay_starts), 'camps with a second stay have both dates and a first stay (' + two.length + ')');

const srv = await serve(8885);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8885/index.html', { waitUntil: 'load' });
const sheet = idx => pg.evaluate(i => { showCampDetail(i); const b = document.getElementById('md-body').innerText; return { b, tag: document.getElementById('md-country').innerText }; }, idx);
const i2 = RAW.findIndex(c => c.family_stay2_starts), i1 = RAW.findIndex(c => !c.family_stay2_starts && c.family_stay_starts && !c.inclusive);
const withTwo = await sheet(i2), withOne = await sheet(i1);
t.ok(/Second Family Stay/i.test(withTwo.b), 'second-stay section shown when the camp has one');
t.ok(!/Second Family Stay/i.test(withOne.b), 'no second-stay section otherwise');
t.ok(!/Complete Timeline/i.test(withTwo.b), 'the Complete Timeline section is gone');
const c2 = await pg.evaluate(i => CAMPS[i].departure >= CAMPS[i].fe2 && CAMPS[i].departure >= CAMPS[i].ce, i2);
t.ok(c2, 'departure takes the second stay into account');
// durée sous les dates du séjour en famille (jours de début et de fin compris)
const dur = await pg.evaluate(i => { const c = CAMPS[i]; showCampDetail(i);
  const sec = [...document.querySelectorAll('.modal-section')].find(s => /Family Stay/.test(s.querySelector('.ms-title').textContent) && !/Second/.test(s.querySelector('.ms-title').textContent));
  const sec2 = [...document.querySelectorAll('.modal-section')].find(s => /Second Family Stay/.test(s.querySelector('.ms-title').textContent));
  return { txt: sec.innerText, txt2: sec2.innerText, n: Math.round((c.fe - c.fs) / 86400000) + 1, n2: Math.round((c.fe2 - c.fs2) / 86400000) + 1 }; }, i2);
t.ok(new RegExp('Duration\\s+' + dur.n + ' days?').test(dur.txt), 'family stay shows its duration (' + dur.n + ' days)');
t.ok(new RegExp('Duration\\s+' + dur.n2 + ' days?').test(dur.txt2), 'second family stay shows its duration (' + dur.n2 + ' days)');
const iInc = RAW.findIndex(c => c.inclusive);
t.ok(/♿ Inclusion/.test((await sheet(iInc)).tag), 'inclusive camp sheet shows the ♿ Inclusion tag');
t.ok(!/Inclusion/.test(withOne.tag), 'other camps show no Inclusion tag');
t.ok(RAW.filter(c => c.inclusive).some(c => /diabetes/i.test(c.camp_name)), 'the Type 1 diabetes camp is flagged as inclusive / special');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));

const pa = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pa.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pa.goto('http://localhost:8885/yce_admin.html', { waitUntil: 'load' });
const res = await pa.evaluate(() => {
  const i = CAMPS_W.findIndex(c => c.family_stay2_starts);
  CAMPS_W[i].detail && delete CAMPS_W[i].detail.website;
  openEdit(i); const shown = document.getElementById('e-family_stay2_starts').value;
  document.getElementById('e-family_stay2_starts').value = '31-12-2027'; saveEdit(); const bad = CAMPS_W[i].family_stay2_starts; // fin avant début : refusé
  openEdit(i); document.getElementById('e-family_stay2_starts').value = ''; document.getElementById('e-family_stay2_ends').value = ''; saveEdit();
  const cleared = 'family_stay2_starts' in CAMPS_W[i];
  return { shown, bad, cleared };
});
t.ok(/^\d\d-\d\d-\d{4}$/.test(res.shown), 'edit card shows the second stay start: ' + res.shown);
t.ok(res.bad !== '31-12-2027', 'a second stay that ends before it starts is refused');
t.ok(res.cleared === false, 'emptying both fields removes the second stay');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
