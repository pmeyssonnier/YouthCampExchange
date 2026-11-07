// Filtre « personnes en situation de handicap » : le champ inclusive des camps, la puce du site, et la case de l'administration.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('inclusive filter');
const RAW = new Function(fs.readFileSync('../camps_data.js', 'utf8') + ';return RAW;')();
const flagged = RAW.filter(c => c.inclusive);
t.ok(flagged.length >= 1 && flagged.every(c => c.inclusive === true), 'camps_data.js has camps flagged inclusive: true (' + flagged.length + ')');

const srv = await serve(8881);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8881/index.html', { waitUntil: 'load' });
await pg.waitForTimeout(600);
const rows = () => pg.$$eval('#tbody tr', r => r.length);
const all = await rows();
t.ok(all === RAW.length, 'all camps listed before filtering: ' + all);
t.ok(/Inclusion camps/.test(await pg.textContent('#incl-pills')), 'filter pill is shown');
await pg.click('#incl-pills .pill');
t.ok((await rows()) === flagged.length, 'only the inclusive camps remain: ' + (await rows()) + ' = ' + flagged.length);
t.ok(/Inclusion/.test(await pg.textContent('#f-chips')), 'active filter shown as a chip');
t.ok(await pg.$eval('#incl-pills .pill', e => e.classList.contains('on')), 'pill is on');
// se combine avec un autre filtre : un pays sans camp inclusif donne 0 ligne
await pg.evaluate(() => { selCountries.add('Norway'); applyFilters(); });
t.ok(/No camps match/.test(await pg.textContent('#tbody')), 'combined with a country without inclusive camp: no camp listed');
await pg.click('.reset-btn');
t.ok((await rows()) === all, 'reset restores every camp');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));

// administration : la case est lue et enregistrée
const pa = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pa.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pa.goto('http://localhost:8881/yce_admin.html', { waitUntil: 'load' });
const res = await pa.evaluate(() => {
  const i = CAMPS_W.findIndex(c => c.inclusive), j = CAMPS_W.findIndex(c => !c.inclusive);
  [i, j].forEach(k => { if (CAMPS_W[k].detail) delete CAMPS_W[k].detail.website; }); // adresse déjà invalide dans les données : hors sujet ici
  openEdit(i); const shown = document.getElementById('e-inclusive').value;
  document.getElementById('e-inclusive').value = 'No'; saveEdit(); const off = CAMPS_W[i].inclusive;
  openEdit(i); document.getElementById('e-inclusive').value = 'Yes'; saveEdit(); const on = CAMPS_W[i].inclusive;
  openEdit(j); const other = document.getElementById('e-inclusive').value; closeEdit();
  return { shown, off, on, other };
});
t.ok(res.shown === 'Yes', 'edit card shows Yes for an inclusive camp');
t.ok(res.off === undefined, 'No removes the flag');
t.ok(res.on === true, 'Yes sets inclusive: true');
t.ok(res.other === 'No', 'a normal camp shows No');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
