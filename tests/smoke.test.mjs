// Chaque page se charge sans erreur de script ni violation de la politique de sécurité (CSP),
// et sans aucune requête vers un autre site : bibliothèques, polices et carte sont servies par le site.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('smoke');
const srv = await serve(8877);
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
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
