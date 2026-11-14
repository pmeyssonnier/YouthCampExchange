// Chaque page se charge sans erreur de script ni violation de la politique de sécurité (CSP),
// et sans aucune requête vers un autre site : bibliothèques, polices et carte sont servies par le site.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { ROOT, launchOpts, serve, checker } from './helpers.mjs';

const t = checker('smoke');
// page d'un « autre site » (autre origine : 127.0.0.1 au lieu de localhost) qui encadre une page sensible
const HOST = '<!doctype html><title>host</title><script>document.write(\'<iframe src="http://localhost:8877/\' + location.search.slice(3) + \'" width="800" height="600"></iframe>\')</script>';
const SUPA = /const SUPABASE_URL = "https:/.test(fs.readFileSync(ROOT + '/districts_data.js', 'utf8'));
const srv = await serve(8877, { '/frame_host.html': HOST });
const br = await chromium.launch(launchOpts);
const PAGES = ['index.html', 'yce_form_filler.html', 'yce_form_filler.html?sign=club', 'yce_form_filler.html?district=B',
  'yce_tracker.html', 'yce_admin.html', 'yce_camps.html', 'yce_vault.html', 'docs/code_map.html'];
for (const p of PAGES) {
  const pg = await br.newPage();
  const errs = [], csp = [], third = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  pg.on('request', r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.hostname !== 'localhost') third.push(u.hostname); });
  await pg.goto('http://localhost:8877/' + p, { waitUntil: 'load' });
  await pg.waitForTimeout(800);
  if (p === 'index.html') {
    await pg.evaluate(() => switchTab('map', document.querySelectorAll('.tab-btn')[1]));
    await pg.waitForTimeout(1200);
    t.ok((await pg.$$eval('#tbody tr', r => r.length)) > 50, 'index: camp table rendered');
    t.ok((await pg.$$eval('.cont-bubble', b => b.length)) > 3, 'index: world map bubbles rendered');
  }
  if (p === 'yce_vault.html') t.ok(await pg.isVisible(SUPA ? '#login' : '#cfg-missing'), SUPA ? 'vault: sign-in form shown (Supabase configured)' : 'vault: "not configured" while SUPABASE_URL is empty');
  t.ok(!errs.length, p + ': no script error ' + errs.join(' | '));
  t.ok(!csp.length, p + ': no CSP violation ' + csp.slice(0, 2).join(' | '));
  t.ok(!third.length, p + ': no request to another site ' + [...new Set(third)].join(', '));
  await pg.close();
}
// pages sensibles : affichées normalement, mais masquées si un autre site les encadre (clickjacking)
for (const p of ['yce_admin.html', 'yce_vault.html', 'yce_tracker.html', 'yce_form_filler.html']) {
  const pg = await br.newPage();
  await pg.goto('http://localhost:8877/' + p, { waitUntil: 'load' });
  t.ok(await pg.evaluate(() => getComputedStyle(document.documentElement).display !== 'none' && !document.getElementById('noframe')), p + ': shown when opened directly');
  await pg.goto('http://127.0.0.1:8877/frame_host.html?p=' + p, { waitUntil: 'load' }).catch(() => {});
  await pg.waitForTimeout(1500);
  const fr = pg.frames().find(f => f.url().startsWith('http://localhost:8877/' + p));
  const hidden = !fr || await fr.evaluate(() => getComputedStyle(document.documentElement).display === 'none').catch(() => true);
  // soit la page encadrée reste invisible, soit elle a remplacé la page hôte (sortie du cadre)
  t.ok(hidden || pg.url().startsWith('http://localhost:8877/' + p), p + ': hidden when framed by another site (' + (hidden ? 'hidden' : 'top page: ' + pg.url()) + ')');
  await pg.close();
}
// carte du code : une ligne s'ouvre sur son détail (rôle, utilise / utilisé par, code lu sur le site) ; barres proportionnelles sur téléphone
{
  const pg = await br.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8877/docs/code_map.html', { waitUntil: 'load' }); await pg.waitForTimeout(500);
  const d = await pg.evaluate(async () => {
    const card = document.getElementById('mod-docx'); card.querySelector('.mod-head').click();
    const rows = [...card.querySelectorAll('.fn')], row = rows.find(r => /commitToggle/.test(r.textContent)); row.click();
    await new Promise(r => setTimeout(r, 600));
    const det = row.nextElementSibling, bars = rows.map(r => [parseInt(r.querySelector('.fn-loc').textContent, 10), r.querySelector('.fn-bar').getBoundingClientRect().width]);
    const big = bars.reduce((a, b) => b[0] > a[0] ? b : a), small = bars.reduce((a, b) => b[0] < a[0] ? b : a);
    const out = { open: det.classList.contains('open'), text: det.innerText, code: det.querySelector('pre').textContent, ratio: big[1] / small[1], locRatio: big[0] / small[0],
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth, role: getComputedStyle(row.querySelector('.fn-role')).flexBasis };
    row.click(); out.closed = !det.classList.contains('open');
    return out;
  });
  t.ok(d.open && /Uses/i.test(d.text) && /commitShow/.test(d.text) && /Used by/i.test(d.text), 'code map: a line opens its details (uses / used by)');
  t.ok(/function commitToggle\(\)/.test(d.code) && !/loading/.test(d.code), 'code map: the details show the code of the function');
  t.ok(d.closed && d.over <= 0 && d.role === '100%', 'code map at 390 px: no overflow, description under the name, a second tap closes the details');
  t.ok(d.ratio > d.locRatio * 0.5 && d.ratio > 3, 'code map at 390 px: bars stay proportional to the length (' + d.ratio.toFixed(1) + ' for ' + d.locRatio.toFixed(1) + ')');
  t.ok(!errs.length, 'code map: no page error ' + errs.join(' | '));
  await pg.close();
}
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
