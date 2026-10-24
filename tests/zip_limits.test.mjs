import { chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { ROOT, FIX, CDN, launchOpts } from './helpers.mjs';
const ZT = FIX + '/ziptest';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = u.startsWith('/ziptest/') ? path.join(ZT, u.slice(9)) : path.join(ROOT, u.replace(/\/$/, '/index.html'));
  let data; try { data = fs.readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  res.end(data);
});
await new Promise(r => srv.listen(8873, r));
const br = await chromium.launch(launchOpts);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };

for (const page of ['yce_form_filler.html', 'yce_tracker.html', 'yce_admin.html']) {
  const pg = await br.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8873/' + page, { waitUntil: 'load' }); await pg.waitForTimeout(600);
  ok(!errs.length, page + ' loads without error: ' + errs.join(' | '));
  const r = await pg.evaluate(async () => {
    const out = {};
    for (const f of ['candidate', 'bomb_big', 'bomb_ratio', 'bomb_total', 'traversal', 'many', 'not_a_zip', 'too_big', 'overlap', 'dup', 'bidi', 'encrypted']) {
      const buf = await (await fetch('/ziptest/' + f + '.zip')).arrayBuffer();
      const t0 = performance.now();
      try { const e = await unzip(buf); out[f] = { ok: e.length, names: e.map(x => x.name).slice(0, 3) }; }
      catch (err) { out[f] = { err: err.message }; }
      out[f].ms = Math.round(performance.now() - t0);
    }
    // un vrai .xlsx et un vrai .docx du dépôt se lisent toujours
    for (const f of ['Application_form_2026_MD112.xlsx', 'Commitment to Reciprocity.docx']) {
      const e = await unzip(await (await fetch('/documents/' + encodeURIComponent(f))).arrayBuffer());
      out[f] = { ok: e.length };
    }
    // budget partagé : le même dossier lu deux fois avec un budget trop petit est arrêté
    const cand = await (await fetch('/ziptest/candidate.zip')).arrayBuffer();
    const b = zipBudget(1.5 * 1024 * 1024);
    try { await unzip(cand, b); await unzip(cand, b); await unzip(cand, b); out.budget = { ok: 1, left: b.left }; } catch (err) { out.budget = { err: err.message }; }
    out.sizeCheck = (() => { try { zipCheckSize({ size: 101 * 1048576 }); return 'passed'; } catch (e) { return e.message; } })();
    return out;
  });
  if (page === 'yce_form_filler.html') console.log(JSON.stringify(r, null, 0));
  ok(r.candidate.ok === 3, page + ' realistic candidate ZIP read');
  ok(r['Application_form_2026_MD112.xlsx'].ok > 5 && r['Commitment to Reciprocity.docx'].ok > 3, page + ' real Office files read');
  ok(/too large|ratio/.test(r.bomb_big.err || ''), page + ' 100 MB bomb stopped: ' + JSON.stringify(r.bomb_big));
  ok(/ratio/.test(r.bomb_ratio.err || ''), page + ' compression-ratio bomb stopped: ' + JSON.stringify(r.bomb_ratio));
  ok(/too large/.test(r.bomb_total.err || ''), page + ' cumulative size stopped: ' + JSON.stringify(r.bomb_total));
  ok(/unsafe path/.test(r.traversal.err || ''), page + ' ../ path refused');
  ok(/too many/.test(r.many.err || ''), page + ' 600-file archive refused');
  ok(/not a valid/.test(r.not_a_zip.err || ''), page + ' non-ZIP refused');
  ok(/too large/.test(r.too_big.err || ''), page + ' archive over 100 MB refused: ' + JSON.stringify(r.too_big));
  ok(/overlapping/.test(r.overlap.err || '') && r.overlap.ms < 500, page + ' overlapping-entries bomb refused without unpacking: ' + JSON.stringify(r.overlap));
  ok(/duplicate/.test(r.dup.err || ''), page + ' duplicate file names refused');
  ok(/unsafe path/.test(r.bidi.err || ''), page + ' disguised name (right-to-left override) refused');
  ok(/encrypted/.test(r.encrypted.err || ''), page + ' encrypted entry refused');
  ok(/too much data/.test(r.budget.err || ''), page + ' shared budget stops repeated unpacking: ' + JSON.stringify(r.budget));
  ok(/too large/.test(r.sizeCheck), page + ' file over 100 MB refused before reading');
  await pg.close();
}

// formulaire : le modèle embarqué se charge (unzip) et la génération du dossier fonctionne
{
  const pg = await br.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8873/yce_form_filler.html?district=A', { waitUntil: 'load' }); await pg.waitForTimeout(800);
  await pg.fill('#f-F16', 'Doe'); await pg.fill('#f-S16', 'Jane');
  const dl = pg.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await pg.click('#btn-gen');
  const d = await dl;
  ok(!!d, 'form filler still generates the dossier ZIP');
  if (d) {
    const p = await d.path(); const buf = fs.readFileSync(p);
    const names = await pg.evaluate(async b64 => { const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return zipNames(b.buffer); }, buf.toString('base64'));
    ok(names.some(n => /\.xlsx$/.test(n)), 'generated ZIP contains the form: ' + names.join(', '));
  }
  ok(!errs.length, 'no error during generation: ' + errs.join(' | '));
  await pg.close();
}

// tracker : dépôt du ZIP de candidat par l'interface
{
  const pg = await br.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8873/yce_tracker.html', { waitUntil: 'load' }); await pg.waitForTimeout(400);
  await pg.setInputFiles('input[type=file]', ZT + '/bomb_big.zip'); await pg.waitForTimeout(1500);
  ok(/too large|ratio/.test(await pg.textContent('#log')), 'tracker reports the bomb in its log');
  ok(!errs.length, 'tracker survives the bomb: ' + errs.join(' | '));
  await pg.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await br.close(); srv.close(); process.exit(fail ? 1 : 0);
