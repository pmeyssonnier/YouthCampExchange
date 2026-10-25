// Chaque page se charge sans erreur de script ni violation de la politique de sécurité (CSP),
// et sans aucune requête vers un autre site : bibliothèques, polices et carte sont servies par le site.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('smoke');
// page d'un « autre site » (autre origine : 127.0.0.1 au lieu de localhost) qui encadre une page sensible
const HOST = '<!doctype html><title>host</title><script>document.write(\'<iframe src="http://localhost:8877/\' + location.search.slice(3) + \'" width="800" height="600"></iframe>\')</script>';
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
  if (p === 'yce_vault.html') t.ok(await pg.isVisible('#cfg-missing'), 'vault: "not configured" while SUPABASE_URL is empty');
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
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
