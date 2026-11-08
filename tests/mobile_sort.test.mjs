// Liste mobile : tri (pays, nom, date, prix) à droite du bouton Filters, masqué pour 0-1 camp, sans « Country » pour un seul pays ; puces Inclusion / Winter.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('mobile sort + type chips');
const RAW = new Function(fs.readFileSync('../camps_data.js', 'utf8') + ';return RAW;')();
const srv = await serve(8891);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8891/index.html', { waitUntil: 'load' });
await pg.waitForTimeout(600);
const opts = () => pg.$$eval('#m-sort option', o => o.map(x => x.textContent));
const names = () => pg.$$eval('#m-cards .cc-name', e => e.map(x => x.textContent));
t.ok(await pg.isVisible('#m-sort'), 'sort selector visible next to Filters');
const bar = await pg.evaluate(() => { const f = document.querySelector('.m-fbtn').getBoundingClientRect(), s = document.getElementById('m-sort-wrap').getBoundingClientRect(), r = document.querySelector('.m-fbar').getBoundingClientRect(); return { sameRow: Math.abs(f.top - s.top) < 20, right: s.right <= r.right + 1 && s.left > f.right }; });
t.ok(bar.sameRow && bar.right, 'on the same row, at the right of the Filters button');
t.ok(JSON.stringify((await opts()).filter(x => x !== 'Sort by…')) === JSON.stringify(['Country', 'Name', 'Date', 'Price']), 'options: Country, Name, Date, Price');
// prix croissant
await pg.selectOption('#m-sort', 'fee_num');
const fees = await pg.evaluate(() => [...document.querySelectorAll('#m-cards .camp-card')].map(c => CAMPS[+c.getAttribute('onclick').match(/\((\d+)\)/)[1]].fee_num));
t.ok(fees.every((v, i) => !i || fees[i - 1] <= v), 'price ascending');
await pg.click('#m-sortdir');
const fees2 = await pg.evaluate(() => [...document.querySelectorAll('#m-cards .camp-card')].map(c => CAMPS[+c.getAttribute('onclick').match(/\((\d+)\)/)[1]].fee_num));
t.ok(fees2.every((v, i) => !i || fees2[i - 1] >= v), 'price descending after the direction button');
await pg.selectOption('#m-sort', 'camp_name');
const nm = await names();
t.ok(nm.every((v, i) => !i || nm[i - 1].localeCompare(v) <= 0), 'name A to Z (ascending after reselecting)');
await pg.selectOption('#m-sort', 'cs');
const dts = await pg.evaluate(() => [...document.querySelectorAll('#m-cards .camp-card')].map(c => CAMPS[+c.getAttribute('onclick').match(/\((\d+)\)/)[1]].cs).map(d => d ? d.getTime() : Infinity));
t.ok(dts.every((v, i) => !i || dts[i - 1] <= v), 'date ascending, camps without date last');
// un seul pays filtré : plus de « Country »
await pg.evaluate(() => { selCountries.add('Italy'); applyFilters(); });
const o1 = await opts();
t.ok(!o1.includes('Country') && o1.includes('Name'), 'one country shown: no Country sort (' + o1.join(',') + ')');
// un seul camp : plus de tri
await pg.evaluate(() => { selCountries.clear(); selCountries.add('Iceland'); applyFilters(); });
t.ok(await pg.isHidden('#m-sort-wrap'), 'one camp: no sort control');
await pg.evaluate(() => { selCountries.clear(); selCountries.add('Atlantis'); applyFilters(); });
t.ok(await pg.isHidden('#m-sort-wrap'), 'no camp: no sort control');
await pg.evaluate(() => resetFilters());
t.ok(await pg.isVisible('#m-sort-wrap'), 'reset: sort control back');
// puces
const inc = RAW.filter(c => c.inclusive).length, win = RAW.filter(c => c.winter).length;
t.ok((await pg.$$eval('#m-cards .cc-incl', e => e.length)) === inc && inc > 0, '♿ Inclusion chips on the cards (' + inc + ')');
t.ok((await pg.$$eval('#m-cards .cc-winter', e => e.length)) === win && win > 0, '❄ Winter chips on the cards (' + win + ')');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
