// Le numéro de version est cohérent (js/version.js = première entrée de CHANGELOG.md) et visible sur chaque page.
import { chromium } from '@playwright/test';
import fs from 'fs';
import crypto from 'crypto';
import { CDN, launchOpts, serve, checker } from './helpers.mjs';

const t = checker('version');
const src = fs.readFileSync('../js/version.js', 'utf8');
const v = (src.match(/const VERSION = "([^"]*)"/) || [])[1];
t.ok(/^\d+\.\d+\.\d+$/.test(v || ''), 'VERSION is MAJOR.MINOR.PATCH: ' + v);
const top = (fs.readFileSync('../CHANGELOG.md', 'utf8').match(/^## (\d+\.\d+\.\d+)/m) || [])[1];
t.ok(top === v, 'CHANGELOG.md top entry (' + top + ') matches js/version.js (' + v + ')');

// Scripts et feuilles de style locaux portent ?v=VERSION (tools/stamp_version.py) : une nouvelle page
// ne se mélange jamais avec d'anciens scripts restés dans le cache du navigateur.
// L'empreinte du contenu suit la version : un fichier modifié (même des données enregistrées par
// l'administration, sans nouvelle version) change d'adresse, donc n'est jamais servi depuis le cache.
const stampOf = p => { try { return v + '.' + crypto.createHash('sha256').update(fs.readFileSync('../' + p)).digest('hex').slice(0, 8); } catch { return v; } };
for (const f of fs.readdirSync('..').filter(f => f.endsWith('.html'))) {
  const refs = [...fs.readFileSync('../' + f, 'utf8').matchAll(/(?:src|href)="((?![a-z]+:|\/)[^"#]+?\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m => m[1]);
  // js/assets.js est régénéré par la CI et par le robot (date et commit du build) : son empreinte change
  // à chaque génération, le robot la tamponne après coup ; on vérifie seulement la forme
  const GENERATED = ['js/assets.js'];
  const bad = refs.filter(r => { const [p, q] = r.split('?');
    return GENERATED.includes(p) ? !new RegExp('^v=' + v.replace(/\./g, '\\.') + '\\.[0-9a-f]{8}$').test(q || '') : q !== 'v=' + stampOf(p); });
  t.ok(!bad.length, f + ': ' + refs.length + ' local scripts/styles stamped with v' + v + ' and their content fingerprint' + (bad.length ? ' — out of date: ' + bad.join(', ') + ' (run python3 tools/stamp_version.py)' : ''));
}

const srv = await serve(8879);
const br = await chromium.launch(launchOpts);
for (const p of ['index.html', 'yce_form_filler.html', 'yce_tracker.html', 'yce_admin.html', 'yce_vault.html']) {
  const pg = await br.newPage();
  await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.goto('http://localhost:8879/' + p, { waitUntil: 'load' });
  const shown = await pg.$$eval('.app-ver', s => s.filter(e => e.offsetParent !== null).map(e => e.textContent));
  t.ok(shown.length >= 1 && shown.every(x => x === 'v' + v), p + ': shows v' + v + ' (' + shown.join(',') + ')');
  await pg.close();
}
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
