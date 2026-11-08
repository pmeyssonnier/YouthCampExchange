// Prix en euros pour le tri, périodes des cartes classées par date, puce / filtre « saison » seulement s'il y a plusieurs saisons.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('list order: price, periods, season');
const src = fs.readFileSync('../camps_data.js', 'utf8');
const RAW = new Function(src + ';return RAW;')();
// variante avec un camp encore actif de la saison précédente (2025-2026)
const old = JSON.parse(JSON.stringify(RAW.find(c => c.camp_starts && c.country === 'Italy')));
Object.assign(old, { camp_name: 'Old season camp', camp_starts: '10-07-2026', camp_ends: '20-07-2026', family_stay_starts: null, family_stay_ends: null });
delete old.family_stay2_starts; delete old.family_stay2_ends;
const withOld = src.replace(/const RAW = (\[[\s\S]*?\]);/, () => 'const RAW = ' + JSON.stringify(RAW.concat([old])) + ';');

const srv = await serve(8895);
const br = await chromium.launch(launchOpts);
const open = async (w, h, evil) => { const pg = await br.newPage({ viewport: { width: w, height: h } });
  if (evil) await pg.route('**/camps_data.js*', r => r.fulfill({ body: withOld, contentType: 'text/javascript' }));
  await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.goto('http://localhost:8895/index.html', { waitUntil: 'load' }); await pg.waitForTimeout(600); return pg; };

const pg = await open(390, 844);
// --- prix en euros
const fe = await pg.evaluate(() => ['370 Euro Or 420 USD', '200 EURO', '0 USD', 'No camp fee', '400 USD', '400 CAD', '0 CHF', '250 EURO (transport & excursion fee)', '', null].map(f => feeEuro(f)));
t.ok(fe[0] === 370 && fe[1] === 200, 'euro price taken ("370 Euro Or 420 USD" → 370, not 370420): ' + fe[0]);
t.ok(fe[2] === 0 && fe[3] === 0 && fe[6] === 0, 'free in any currency counts as 0');
t.ok(fe[4] > 300 && fe[4] < 450 && fe[5] > 200 && fe[5] < 400, 'USD / CAD only: indicative euro value (' + fe[4] + ', ' + fe[5] + ')');
t.ok(fe[7] === 250 && fe[8] === null && fe[9] === null, 'text after the amount ignored; no price → null');
const sri = await pg.evaluate(() => CAMPS.find(c => /Or 420 USD/i.test(c.fee || '')).fee_num);
t.ok(sri === 370, 'the Sri Lanka camp sorts on 370');
await pg.selectOption('#m-sort', 'fee_num'); await pg.click('#m-sortdir'); // décroissant
const first = await pg.evaluate(() => CAMPS[+document.querySelector('#m-cards .camp-card').getAttribute('onclick').match(/\((\d+)\)/)[1]].fee_num);
t.ok(first < 1000, 'descending price: the first camp is not the glued 370420 (' + first + ')');

// --- périodes dans l'ordre des dates
const order = await pg.evaluate(() => { let bad = 0, n = 0; CAMPS.forEach(c => { if (!c.fs || !c.cs) return; const h = document.createElement('div'); h.innerHTML = periodRows(c);
  const lbls = [...h.querySelectorAll('.cc-date-lbl')].map(x => x.textContent); n++;
  const firstIsFamily = c.fs <= c.cs, famIdx = lbls.findIndex(l => /Family Stay/.test(l) && !/2nd/.test(l)), campIdx = lbls.findIndex(l => /Camp/.test(l));
  if ((famIdx < campIdx) !== firstIsFamily) bad++; }); return { bad, n }; });
t.ok(order.n > 20 && order.bad === 0, 'cards: family stay listed before the camp when it starts first (' + order.n + ' camps)');
const noFam = await pg.evaluate(() => { const c = CAMPS.find(c => !c.fs); const h = document.createElement('div'); h.innerHTML = periodRows(c); return h.querySelectorAll('.cc-date-row').length; });
t.ok(noFam === 1, 'a camp without family stay shows only the camp line');
const two = await pg.evaluate(() => { const c = CAMPS.find(c => c.fs2); const h = document.createElement('div'); h.innerHTML = periodRows(c); return [...h.querySelectorAll('.cc-date-lbl')].map(x => x.textContent); });
t.ok(two.length === 3, 'a camp with a second family stay shows three lines in date order: ' + two.join(' | '));

// --- saison : une seule saison dans les données
t.ok((await pg.$$eval('#m-cards .cc-season', e => e.length)) === 0, 'single season: no season chip on the cards');
t.ok(await pg.evaluate(() => document.getElementById('sec-season').hidden), 'single season: the Season filter is hidden');
await pg.close();
// --- deux saisons : la puce et le filtre reviennent
const p2 = await open(390, 844, true);
t.ok((await p2.$$eval('#m-cards .cc-season', e => e.length)) > 0, 'camp of the previous season still active: season chips shown');
t.ok(!(await p2.evaluate(() => document.getElementById('sec-season').hidden)), 'two seasons: the Season filter is shown');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
