// Les pages suivent la liste des districts de districts_data.js : un district ajouté (E) apparaît partout.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { ROOT, CDN, launchOpts, serve, checker } from './helpers.mjs';

const t = checker('districts everywhere');
const srv = await serve(8881);
const br = await chromium.launch(launchOpts);
const B = 'http://localhost:8881/';
const data = fs.readFileSync(ROOT + '/districts_data.js', 'utf8')
  .replace(/(const DISTRICTS = \{[\s\S]*?)\n\};/, '$1,\n  E: {name: "Eve Example", club: "LC Test", email: "eve@example.org", mobile: "+32 470 00 00 00"}\n};')
  .replace(/^const TEAM = .*;$/m, 'const TEAM = ' + JSON.stringify({ national: [{ name: 'Nina <img src=x onerror=alert(1)> National', role: 'President', club: 'LC N', email: 'nina@example.org', mobile: '+32 470 11 11 11' }], outgoing: [{ name: 'Oscar Out', role: 'Outgoing · Asia', club: 'LC O', email: 'javascript:alert(1)', mobile: '' }] }) + ';')
  .replace(/^const PAYMENT = .*;$/m, 'const PAYMENT = ' + JSON.stringify({ amount: '€150', iban: 'BE71 0961 2345 6769', bic: 'GKCCBEBB', beneficiary: 'Test <b>Beneficiary</b>', communication: 'Name · District' }) + ';');
const ctx = await br.newContext();
await ctx.route('**/districts_data.js?v=*', r => r.fulfill({ body: data, contentType: 'text/javascript' }));
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ path: /topojson/.test(r.request().url()) ? CDN.topojson : CDN.d3, contentType: 'text/javascript' }));
await ctx.route('**unpkg.com/world-atlas**', r => r.fulfill({ path: CDN.atlas, contentType: 'application/json' }));
await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const pg = await ctx.newPage(); const errs = [];
pg.on('pageerror', e => errs.push(e.message));

await pg.goto(B + 'yce_tracker.html'); await pg.waitForTimeout(400);
const pills = await pg.$$eval('#dist-pills .pill', p => p.map(x => x.textContent));
t.ok(JSON.stringify(pills) === JSON.stringify(['112 A', '112 B', '112 C', '112 D', '112 E']), 'tracker: one filter per district ' + pills);

await pg.goto(B + 'yce_form_filler.html?district=E'); await pg.waitForTimeout(1500);
t.ok(/District 112 E form ready — YCE coordinator: Eve Example/.test(await pg.textContent('#status')), 'form: new district E stamped with its coordinator');
t.ok(/A · B · C · D · E/.test(await pg.textContent('#dist-letters')), 'form header lists the districts');
await pg.goto(B + 'yce_form_filler.html?district=Z'); await pg.waitForTimeout(1500);
t.ok(!/District 112 Z/.test(await pg.textContent('#status')), 'form: unknown district not stamped');

await pg.goto(B + 'index.html'); await pg.waitForTimeout(600);
t.ok(/Eve Example/.test(await pg.textContent('#dist-grid')) && await pg.$('a[href="yce_form_filler.html?district=E"]'), 'site: contact card and form link for district E');
const team = await pg.evaluate(() => ({ n: document.getElementById('team-national').textContent, o: document.getElementById('team-outgoing').textContent,
  img: !!document.querySelector('#team img'), js: !!document.querySelector('#team a[href^="mailto:javascript"]'), av: document.querySelector('#team-national .tm-av').textContent }));
t.ok(/Nina <img src=x onerror=alert\(1\)> National/.test(team.n) && !team.img, 'site: national team from TEAM, names shown as text');
t.ok(/Oscar Out/.test(team.o) && !team.js && !/Gautier/.test(team.o), 'site: outgoing secretaries from TEAM, unsafe e-mail not linked');
t.ok(team.av === 'NI' || team.av.length <= 2, 'site: initials avatar ' + team.av);
const pay = await pg.evaluate(() => ({ fees: [...document.querySelectorAll('.fee-amt')].map(e => e.textContent), iban: document.getElementById('pay-iban').textContent,
  ben: document.getElementById('pay-beneficiary').innerHTML }));
t.ok(pay.fees.length === 3 && pay.fees.every(f => f === '€150') && pay.iban === 'BE71 0961 2345 6769', 'site: fee and IBAN from PAYMENT everywhere ' + pay.fees);
t.ok(!/<b>/.test(pay.ben), 'site: bank fields shown as text');
t.ok(!errs.length, 'no page error ' + errs.join(' | '));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
