// Administration : bascule Édition / Aperçu du bandeau d'annonce (même nettoyage que le site public).
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('announcement banner preview');
const srv = await serve(8899);
const br = await chromium.launch(launchOpts);
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8899/yce_admin.html', { waitUntil: 'load' });
await pg.evaluate(() => { document.getElementById('panel').style.display = ''; showTab('site'); }); // le panneau n'apparaît qu'après connexion : on l'affiche pour le test
const evil = '📢 <strong>Registrations for 2027 open on 1 December.</strong> <script>window.__x=1</script><img src=x onerror="window.__x=2"><a href="javascript:window.__x=3">bad</a> <a href="https://example.org/inscr">ok</a>';
await pg.fill('#in-announce', evil);
t.ok(await pg.isVisible('#in-announce') && await pg.isHidden('#ann-prev'), 'edit mode: the text field is shown, not the preview');
await pg.click('#ann-b-prev');
t.ok(await pg.isHidden('#in-announce') && await pg.isVisible('#ann-prev'), 'preview mode: the preview is shown, the text field hidden');
const html = await pg.$eval('#ann-prev', e => e.innerHTML);
t.ok(/<strong>Registrations for 2027 open on 1 December\.<\/strong>/.test(html), 'preview renders the bold text');
t.ok(!/<script|<img|onerror|javascript:/i.test(html) && /href="https:\/\/example\.org\/inscr"/.test(html), 'preview applies the same cleaning as the site (script, image, javascript: link removed; https link kept)');
t.ok((await pg.evaluate(() => window.__x)) === undefined, 'nothing from the typed HTML ran');
t.ok(await pg.$eval('#ann-b-prev', e => e.classList.contains('on')) && !(await pg.$eval('#ann-b-edit', e => e.classList.contains('on'))), 'the active button is highlighted');
await pg.click('#ann-b-edit');
t.ok(await pg.isVisible('#in-announce') && await pg.isHidden('#ann-prev'), 'back to edit mode');
t.ok((await pg.inputValue('#in-announce')) === evil, 'switching does not change the typed text');
// texte vide : note
await pg.fill('#in-announce', '   ');
await pg.click('#ann-b-prev');
t.ok(/default text/.test(await pg.textContent('#ann-prev')), 'empty banner: preview explains the site keeps its default text');
// le texte enregistré est celui du champ même quand l'aperçu est affiché
t.ok(await pg.evaluate(() => document.getElementById('in-announce').value.trim() === ''), 'the field value is still readable in preview mode (what Save the data uses)');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
