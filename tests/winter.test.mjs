// Camps d'hiver : champ winter, puce du filtre, repère sur la fiche, case de l'administration.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('winter camps');
const RAW = new Function(fs.readFileSync('../camps_data.js', 'utf8') + ';return RAW;')();
const flagged = RAW.filter(c => c.winter);
t.ok(flagged.length >= 1 && flagged.every(c => c.winter === true), 'camps_data.js has camps flagged winter: true (' + flagged.length + ')');

const srv = await serve(8889);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8889/index.html', { waitUntil: 'load' });
await pg.waitForTimeout(600);
const rows = () => pg.$$eval('#tbody tr', r => r.length);
const all = await rows();
t.ok(/Winter camps/.test(await pg.textContent('#winter-pills')), 'winter pill is shown');
await pg.click('#winter-pills .pill');
t.ok((await rows()) === flagged.length, 'only the winter camps remain: ' + (await rows()) + ' = ' + flagged.length);
t.ok(/Winter/.test(await pg.textContent('#f-chips')), 'active filter shown as a chip');
await pg.click('#incl-pills .pill'); // hiver + inclusion : aucun camp ne cumule les deux
t.ok(/No camps match/.test(await pg.textContent('#tbody')), 'winter + inclusion combine (no camp has both)');
await pg.click('.reset-btn');
t.ok((await rows()) === all, 'reset restores every camp');
const sheet = await pg.evaluate(i => { showCampDetail(i); return document.getElementById('md-country').innerText; }, RAW.findIndex(c => c.winter));
t.ok(/❄ Winter camp/.test(sheet), 'winter camp sheet shows the ❄ Winter camp tag');
const other = await pg.evaluate(i => { showCampDetail(i); return document.getElementById('md-country').innerText; }, RAW.findIndex(c => !c.winter && !c.inclusive));
t.ok(!/Winter/.test(other), 'other camps show no winter tag');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));

const pa = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pa.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pa.goto('http://localhost:8889/yce_admin.html', { waitUntil: 'load' });
const res = await pa.evaluate(() => {
  const i = CAMPS_W.findIndex(c => c.winter), j = CAMPS_W.findIndex(c => !c.winter);
  [i, j].forEach(k => { if (CAMPS_W[k].detail) delete CAMPS_W[k].detail.website; });
  openEdit(i); const shown = document.getElementById('e-winter').value;
  document.getElementById('e-winter').value = 'No'; saveEdit(); const off = CAMPS_W[i].winter;
  openEdit(i); document.getElementById('e-winter').value = 'Yes'; saveEdit(); const on = CAMPS_W[i].winter;
  openEdit(j); const other = document.getElementById('e-winter').value; closeEdit();
  return { shown, off, on, other };
});
t.ok(res.shown === 'Yes', 'edit card shows Yes for a winter camp');
t.ok(res.off === undefined, 'No removes the flag');
t.ok(res.on === true, 'Yes sets winter: true');
t.ok(res.other === 'No', 'a normal camp shows No');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
