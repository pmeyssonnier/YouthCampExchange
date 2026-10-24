// Les pages suivent la liste des districts de districts_data.js : un district ajouté (E) apparaît partout.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { ROOT, CDN, launchOpts, serve, checker } from './helpers.mjs';

const t = checker('districts everywhere');
const srv = await serve(8881);
const br = await chromium.launch(launchOpts);
const B = 'http://localhost:8881/';
const data = fs.readFileSync(ROOT + '/districts_data.js', 'utf8')
  .replace(/(const DISTRICTS = \{[\s\S]*?)\n\};/, '$1,\n  E: {name: "Eve Example", club: "LC Test", email: "eve@example.org", mobile: "+32 470 00 00 00"}\n};');
const ctx = await br.newContext();
await ctx.route('**/districts_data.js', r => r.fulfill({ body: data, contentType: 'text/javascript' }));
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
t.ok(!errs.length, 'no page error ' + errs.join(' | '));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
