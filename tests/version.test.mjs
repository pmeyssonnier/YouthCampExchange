// Le numéro de version est cohérent (js/version.js = première entrée de CHANGELOG.md) et visible sur chaque page.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { CDN, launchOpts, serve, checker } from './helpers.mjs';

const t = checker('version');
const src = fs.readFileSync('../js/version.js', 'utf8');
const v = (src.match(/const VERSION = "([^"]*)"/) || [])[1];
t.ok(/^\d+\.\d+\.\d+$/.test(v || ''), 'VERSION is MAJOR.MINOR.PATCH: ' + v);
const top = (fs.readFileSync('../CHANGELOG.md', 'utf8').match(/^## (\d+\.\d+\.\d+)/m) || [])[1];
t.ok(top === v, 'CHANGELOG.md top entry (' + top + ') matches js/version.js (' + v + ')');

const srv = await serve(8879);
const br = await chromium.launch(launchOpts);
for (const p of ['index.html', 'yce_form_filler.html', 'yce_tracker.html', 'yce_admin.html', 'yce_camps.html', 'yce_vault.html']) {
  const pg = await br.newPage();
  await pg.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ path: /topojson/.test(r.request().url()) ? CDN.topojson : CDN.d3, contentType: 'text/javascript' }));
  await pg.route('**unpkg.com/world-atlas**', r => r.fulfill({ path: CDN.atlas, contentType: 'application/json' }));
  await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.route('**cdn.jsdelivr.net/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pg.goto('http://localhost:8879/' + p, { waitUntil: 'load' });
  const shown = await pg.$$eval('.app-ver', s => s.filter(e => e.offsetParent !== null).map(e => e.textContent));
  t.ok(shown.length >= 1 && shown.every(x => x === 'v' + v), p + ': shows v' + v + ' (' + shown.join(',') + ')');
  await pg.close();
}
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
