// Page d'administration unique à onglets, ancienne adresse du gestionnaire de camps, menu des outils.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('admin tabs & tool menu');
const srv = await serve(8880);
const br = await chromium.launch(launchOpts);
const B = 'http://localhost:8880/';
const pg = await br.newPage(); const errs = [];
pg.on('pageerror', e => errs.push(e.message));
const vis = sel => pg.isVisible(sel);

// l'ancienne adresse ouvre l'onglet Camps, utilisable sans connexion
await pg.goto(B + 'yce_camps.html'); await pg.waitForURL(/yce_admin\.html#camps$/); await pg.waitForTimeout(500);
t.ok(await vis('#tab-camps.on'), 'yce_camps.html redirects to the Camps tab');
t.ok((await pg.$$eval('#tbody tr', r => r.length)) > 50 && await vis('#tbody'), 'camp table shown without connecting');
t.ok(!(await vis('#need-connect')) && !(await vis('#in-season')), 'Camps tab: no lock message, Site fields hidden');

// onglets Site et Documents : verrouillés tant qu'on n'est pas connecté
await pg.click('#tab-site');
t.ok(await vis('#need-connect') && !(await vis('#tbody')), 'Site tab asks to connect, camps hidden');
t.ok(/#site$/.test(pg.url()), 'tab kept in the address');
await pg.click('#tab-docs');
t.ok(await vis('#need-connect'), 'Documents tab asks to connect');
// une fois connecté (panneau affiché par admin-core), chaque onglet montre sa partie
await pg.evaluate(() => { document.getElementById('panel').style.display = ''; ON_CONNECT.filter((f, i, a) => i === a.length - 1)[0](); });
t.ok(!(await vis('#need-connect')) && await vis('#p-af') && !(await vis('#in-season')), 'connected: Documents tab shows only the documents');
await pg.click('#tab-site');
t.ok(await vis('#in-season') && await vis('#gal-list') && !(await vis('#p-af')), 'connected: Site tab shows season, coordinators, gallery');
t.ok(await pg.evaluate(() => typeof saveData === 'function' && typeof saveSite === 'function'), 'both save functions on the same page');

// menu des outils
const menu = async url => { await pg.goto(B + url); await pg.waitForTimeout(300);
  return pg.$$eval('nav.toolnav a', a => a.map(x => (x.classList.contains('on') ? '*' : '') + x.getAttribute('href'))); };
const tr = await menu('yce_tracker.html');
t.ok(tr.length === 5 && tr.includes('*yce_tracker.html') && tr.includes('yce_admin.html') && tr.includes('index.html'), 'tracker: full tool menu, current page marked ' + tr);
const ad = await menu('yce_admin.html');
t.ok(ad.includes('*yce_admin.html'), 'admin: current page marked');
t.ok((await menu('yce_vault.html')).includes('*yce_vault.html'), 'vault: menu present');
const cand = await menu('yce_form_filler.html?district=A');
t.ok(cand.length === 1 && cand[0] === 'index.html', 'candidate form: only the link back to the site ' + cand);
t.ok((await menu('yce_form_filler.html?sign=club')).length === 1, 'club president signing: only the link back to the site');
t.ok((await menu('yce_form_filler.html?admin')).length === 5, 'form admin mode: full tool menu');
await pg.goto(B + 'index.html'); await pg.waitForTimeout(300);
t.ok(await pg.$eval('footer a[href="yce_tracker.html"]', a => /Staff/.test(a.textContent)), 'site footer links to the staff tools');

// largeur mobile : pas de défilement horizontal
for (const u of ['yce_admin.html#camps', 'yce_tracker.html']) {
  const m = await br.newPage({ viewport: { width: 390, height: 800 } });
  await m.goto(B + u); await m.waitForTimeout(400);
  t.ok(await m.evaluate(() => document.documentElement.scrollWidth <= 390), u + ': no horizontal scroll at 390 px');
  await m.close();
}
t.ok(!errs.length, 'no page error ' + errs.join(' | '));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
