// Données de camps et de personnalisation piégées : aucune charge ne doit s'exécuter,
// et le site doit rester fonctionnel (tableau, filtres, carte, fiche) sous la CSP.
import { chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';

import { ROOT, FIX, CDN, launchOpts } from './helpers.mjs';
const P = n => `<img src=x onerror="window.__xss=(window.__xss||[]).concat('${n}')">`;
const S = n => `<script>window.__xss=(window.__xss||[]).concat('${n}')</script>`;

const campsSrc = fs.readFileSync(ROOT + '/camps_data.js', 'utf8');
const RAW = new Function(campsSrc + ';return RAW;')();
const evil = JSON.parse(JSON.stringify(RAW[0]));
Object.assign(evil, {
  continent: 'Europe', country: `Evil"land' ${P('country')}`, state: P('state'),
  camp_name: `Camp ${P('name')}`, age_requirements: `16-21 ${P('age')}`, fee: `100 ${P('fee')}`,
  camp_starts: '01-07-2027', camp_ends: '10-07-2027', family_stay_starts: '24-06-2027', family_stay_ends: '01-07-2027'
});
evil.detail = Object.assign({}, evil.detail || {}, {
  location: P('location'), description: P('desc') + S('desc-script'), host_family_activities: P('hfa'),
  languages: [P('lang')], website: 'javascript:window.__xss=(window.__xss||[]).concat("website")',
  yce_url: 'javascript:alert(1)', contact_name: P('cname'), contact_email: `x@y.be"><img src=x onerror="window.__xss=['email']">`,
  contact_phone: P('phone'), participants: P('participants')
});
const goodWeb = JSON.parse(JSON.stringify(RAW.find(c => c.detail && c.detail.website === 'yce.lions.dk') || RAW[1]));
const evilCamps = campsSrc.replace(/const RAW = (\[[\s\S]*?\]);/, () => 'const RAW = ' + JSON.stringify([evil].concat(RAW)) + ';');

const distSrc = fs.readFileSync(ROOT + '/districts_data.js', 'utf8')
  .replace(/\n  announce: "(?:[^"\\]|\\.)*",/, () => '\n  announce: ' + JSON.stringify('<strong>Closed</strong> ' + P('announce') + S('announce-script') + '<a href="javascript:window.__xss=[1]">x</a><a href="https://ok.example">ok</a>') + ',')
  .replace(/const GALLERY = \[[\s\S]*?\];/, () => 'const GALLERY = ' + JSON.stringify([{ src: 'javascript:alert(1)', caption: P('caption') }, { src: 'assets/favicon.png', caption: 'ok' }]) + ';');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/camps_data.js' && process.env.EVIL !== '0') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(evilCamps); }
  if (u === '/districts_data.js' && process.env.EVIL !== '0') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(distSrc); }
  const p = path.join(ROOT, u.replace(/\/$/, '/index.html'));
  let data; try { data = fs.readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  res.end(data);
});
await new Promise(r => srv.listen(8872, r));

const br = await chromium.launch(launchOpts);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [], csp = [];
pg.on('pageerror', e => errs.push(e.message));
pg.on('console', m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
pg.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));

await pg.goto('http://localhost:8872/index.html', { waitUntil: 'load' });
await pg.waitForTimeout(700);
ok((await pg.$$eval('#tbody tr', r => r.length)) === RAW.length + 1, 'table renders all camps incl. the evil one');
ok(/Evil"land/.test(await pg.textContent('#tbody')), 'evil text shown as text');
ok(/<img src=x/.test(await pg.textContent('#tbody')), 'markup displayed literally');
// filtres : un pays contenant guillemets et apostrophe reste cliquable
await pg.evaluate(() => { [...document.querySelectorAll('#c-list .mitem')].find(m => m.textContent.includes('Evil')).click(); });
await pg.waitForTimeout(200);
ok((await pg.textContent('#s-shown')) === '1', 'country filter with quotes works');
await pg.evaluate(() => resetFilters());
// fiche détaillée
await pg.evaluate(() => showCampDetail(0));
await pg.waitForTimeout(300);
const links = await pg.$$eval('#md-body a', a => a.map(x => x.getAttribute('href')));
ok(!links.some(h => /^javascript:/i.test(h || '')), 'no javascript: link in the modal: ' + links.join(' | '));
ok(!(await pg.$('#md-body a[href^="mailto:"]')), 'invalid contact e-mail not turned into a link');
ok(/onerror/.test(await pg.textContent('#md-body')), 'description shown as text');
// lien sans schéma complété en https
const dkIdx = await pg.evaluate(() => CAMPS.findIndex(c => c.detail && c.detail.website === 'yce.lions.dk'));
if (dkIdx >= 0) {
  await pg.evaluate(i => showCampDetail(i), dkIdx); await pg.waitForTimeout(200);
  ok((await pg.$$eval('#md-body a', a => a.map(x => x.getAttribute('href')))).includes('https://yce.lions.dk/'), 'bare domain website completed to https');
}
await pg.evaluate(() => closeModal());
// carte mondiale : panneau pays et encart continent
await pg.evaluate(() => switchTab('map', document.querySelectorAll('.tab-btn')[1]));
await pg.waitForTimeout(1500);
await pg.evaluate(() => { zoomContinent('Europe'); });
await pg.waitForTimeout(1200);
await pg.evaluate(c => showCountryCamps(c), evil.country);
await pg.waitForTimeout(300);
ok(/Evil"land/.test(await pg.textContent('#cp-country')), 'map country panel shows the evil country as text');
ok((await pg.$$eval('#mi-rows .mi-row', r => r.length)) > 5, 'continent info rows rendered');
// personnalisation
ok(/Closed/.test(await pg.textContent('#announce')) && (await pg.$('#announce strong')) !== null, 'allowed <strong> kept in the announcement');
ok(!(await pg.$('#announce img')) && !(await pg.$('#announce script')), 'img/script removed from the announcement');
const annLinks = await pg.$$eval('#announce a', a => a.map(x => x.getAttribute('href') || ''));
ok(!annLinks.some(h => /^javascript:/i.test(h)) && annLinks.includes('https://ok.example/'), 'announcement links filtered: ' + annLinks.join(' | '));
ok((await pg.$$eval('#gal-track img', i => i.map(x => x.getAttribute('src')))).every(s => s === 'assets/favicon.png'), 'gallery keeps only safe image sources');

ok(!(await pg.evaluate(() => window.__xss)), 'NO payload executed: ' + JSON.stringify(await pg.evaluate(() => window.__xss)));
ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
ok(csp.length === 0, 'no CSP violation on the normal site: ' + csp.slice(0, 3).join(' | '));
await pg.screenshot({ path: FIX + '/xss_modal.png' });

console.log(`\n${pass} passed, ${fail} failed`);
await br.close(); srv.close();
process.exit(fail ? 1 : 0);
