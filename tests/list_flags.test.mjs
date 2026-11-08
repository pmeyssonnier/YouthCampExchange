// Listes : drapeau devant le pays (tableau et cartes), seconde ligne pour le 2e séjour en famille seulement s'il existe.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('list flags + second family stay line');
const RAW = new Function(fs.readFileSync('../camps_data.js', 'utf8') + ';return RAW;')();
const srv = await serve(8893);
const br = await chromium.launch(launchOpts);
const errs = [];
const open = async (w, h) => { const pg = await br.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.goto('http://localhost:8893/index.html', { waitUntil: 'load' }); await pg.waitForTimeout(600); return pg; };

const pg = await open(1280, 900);
t.ok(await pg.evaluate(() => countryFlag('Italy') === '🇮🇹' && countryFlag('United States') === '🇺🇸' && countryFlag('Czech rep. and Slovakia') === '🇨🇿🇸🇰' && countryFlag('Atlantis') === ''), 'countryFlag: Italy, United States, two flags for Czech/Slovakia, empty when unknown');
t.ok(await pg.evaluate(() => CAMPS.every(c => countryFlag(c.country))), 'every country of the data has a flag');
const first = await pg.$$eval('#tbody tr td:nth-child(2)', e => e.map(x => x.textContent.trim()));
t.ok(first.length === RAW.length && first.every(x => /^\p{Regional_Indicator}{2,4}[ \u00A0]/u.test(x)), 'table: flag before the country on every row');
const rowsTxt = await pg.evaluate(() => [...document.querySelectorAll('#tbody tr')].map(r => ({ i: +r.dataset.idx, fam: r.children[7].innerText })));
const withTwo = rowsTxt.filter(r => RAW[r.i].family_stay2_starts), withOne = rowsTxt.filter(r => !RAW[r.i].family_stay2_starts && RAW[r.i].family_stay_starts);
t.ok(withTwo.length >= 1 && withTwo.every(r => r.fam.trim().split('\n').filter(Boolean).length === 4), 'table: 4 date lines (two periods) when there is a second family stay');
t.ok(withOne.every(r => r.fam.trim().split('\n').filter(Boolean).length === 2), 'table: 2 date lines otherwise');
await pg.close();

const pm = await open(390, 844);
const cards = await pm.evaluate(() => [...document.querySelectorAll('#m-cards .camp-card')].map(c => ({ idx: +c.getAttribute('onclick').match(/\((\d+)\)/)[1], ctry: c.querySelector('.mc-ctry').textContent, two: !!(c.innerText.match(/2nd Family Stay/i)) })));
t.ok(cards.every(c => /^\p{Regional_Indicator}{2,4}[ \u00A0]/u.test(c.ctry)), 'cards: flag before the country');
t.ok(cards.every(c => c.two === !!RAW[c.idx].family_stay2_starts), 'cards: "2nd Family Stay" line only for camps with a second stay (' + cards.filter(c => c.two).length + ')');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
