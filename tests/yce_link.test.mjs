// Fiche publique : la ligne « YCE Page » (lions-yce-belgium.be) n'existe que pour le camp belge ; « Website » reste.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('YCE page link only for Belgium');
const RAW = new Function(fs.readFileSync('../camps_data.js', 'utf8') + ';return RAW;')();
const srv = await serve(8899);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pg.goto('http://localhost:8899/index.html', { waitUntil: 'load' });
const withYce = RAW.findIndex(c => c.country !== 'Belgium' && c.detail && c.detail.yce_url && c.detail.website);
t.ok(withYce >= 0, 'a non-Belgian camp with both a YCE page address and a website exists in the data');
const r = await pg.evaluate(i => { showCampDetail(i); const b = document.getElementById('md-body'); return { yce: /YCE Page/.test(b.innerText), host: !!b.querySelector('a[href*="lions-yce-belgium.be"]'), web: /Website/.test(b.innerText) }; }, withYce);
t.ok(!r.yce && !r.host, 'non-Belgian camp: no YCE Page line, no link to lions-yce-belgium.be');
t.ok(r.web, 'non-Belgian camp: the Website line stays');
// camp belge : la ligne reste (adresse injectée dans la page pour le test)
const be = await pg.evaluate(() => { const i = CAMPS.findIndex(c => c.country === 'Belgium'); CAMPS[i].detail = Object.assign({}, CAMPS[i].detail, { yce_url: 'https://www.lions-yce-belgium.be/destinations/belgium' }); showCampDetail(i); const b = document.getElementById('md-body'); return { yce: /YCE Page/.test(b.innerText), web: /Website/.test(b.innerText) }; });
t.ok(be.yce && be.web, 'Belgian camp: the YCE Page line and the Website line are both shown');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
