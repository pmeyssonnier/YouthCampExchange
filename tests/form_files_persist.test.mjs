// Formulaire : le scan du passeport et la lettre à la famille d'accueil survivent à un rafraîchissement (IndexedDB, 30 jours, effacés par « Clear form »).
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('form attachments kept after refresh');
const srv = await serve(8907);
const br = await chromium.launch(launchOpts);
const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
const pg = await ctx.newPage();
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
const url = 'http://localhost:8907/yce_form_filler.html';
const open = async () => { await pg.goto(url, { waitUntil: 'load' }); await pg.waitForTimeout(800); };
await open();

// fictional files only
await pg.evaluate(() => {
  IDDOC.dataUrl = 'data:image/png;base64,AAAA'; IDDOC.name = 'fake-scan.png'; IDDOC.ext = 'png'; idShow();
  LETTER.dataUrl = 'data:application/pdf;base64,BBBB'; LETTER.name = 'fake-letter.pdf'; LETTER.ext = 'pdf'; letterShow();
  upd();
});
await pg.waitForTimeout(1200);
await open();
let s = await pg.evaluate(() => ({ id: IDDOC.name, lt: LETTER.name, idHint: document.getElementById('id-hint').textContent, ltHint: document.getElementById('letter-hint').textContent }));
t.ok(s.id === 'fake-scan.png' && /fake-scan/.test(s.idHint), 'the ID scan is back after a refresh: ' + s.idHint.slice(0, 40));
t.ok(s.lt === 'fake-letter.pdf' && /fake-letter/.test(s.ltHint), 'the host-family letter is back after a refresh');
t.ok(!/not kept in the browser/.test(await pg.evaluate(() => document.body.innerHTML)), 'the page no longer says the scan is not kept');
t.ok(!(await pg.evaluate(() => localStorage.getItem(DRAFT_KEY))).includes('BBBB'), 'files are not stored in localStorage');

// removing the letter is remembered
await pg.evaluate(() => { letterClear({ stopPropagation() {} }); });
await pg.waitForTimeout(1000);
await open();
s = await pg.evaluate(() => ({ id: IDDOC.name, lt: LETTER.name }));
t.ok(s.id === 'fake-scan.png' && !s.lt, 'a removed letter stays removed');

// expired draft: attachments are erased too
await pg.evaluate(() => { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); d.ts = Date.now() - 31 * 86400000; localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); });
await open();
s = await pg.evaluate(() => ({ id: IDDOC.name }));
t.ok(!s.id, 'after 30 days the scan is gone');
await pg.waitForTimeout(500);
await open();
t.ok(!(await pg.evaluate(() => IDDOC.name)), 'and it is really erased from the browser');

// Clear form
await pg.evaluate(() => { IDDOC.dataUrl = 'data:image/png;base64,AAAA'; IDDOC.name = 'fake-scan.png'; IDDOC.ext = 'png'; idShow(); upd(); });
await pg.waitForTimeout(1200);
pg.on('dialog', d => d.accept());
await pg.evaluate(() => clearForm());
await pg.waitForTimeout(1500);
t.ok(!(await pg.evaluate(() => IDDOC.name)), 'Clear form erases the scan');
await open();
t.ok(!(await pg.evaluate(() => IDDOC.name)), 'and it does not come back');

// letter template: one file, same name every season
const href = await pg.evaluate(() => document.querySelector('a.dl-card[href*="Letter_to_Host_Family"]').getAttribute('href'));
t.ok(href === 'documents/Letter_to_Host_Family.docx', 'the template link has no year: ' + href);
t.ok(fs.existsSync(new URL('../' + href, import.meta.url)), 'and that file exists');
t.ok(!fs.readdirSync(new URL('../documents/', import.meta.url)).some(f => /^Letter_to_Host_Family_\d{4}/.test(f)), 'no per-year copy is left in documents/');
const idx = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
t.ok(!/Letter_to_Host_Family_\d{4}\.docx/.test(idx) && idx.includes('documents/Letter_to_Host_Family.docx'), 'the home page links to the same file');

// dates of the files inside a generated archive = generation time, not a fixed 2024 date
const zd = await pg.evaluate(async () => {
  const blob = await buildZip([{ name: 'a.txt', data: new TextEncoder().encode('hello hello hello') }]);
  const dv = new DataView(await blob.arrayBuffer());
  const d = dv.getUint16(12, true), tm = dv.getUint16(10, true), n = new Date();
  return { y: (d >> 9) + 1980, m: (d >> 5) & 15, day: d & 31, h: tm >> 11, now: [n.getFullYear(), n.getMonth() + 1, n.getDate()] };
});
t.ok(zd.y === zd.now[0] && zd.m === zd.now[1] && zd.day === zd.now[2], 'files in a generated archive carry today\'s date: ' + zd.y + '-' + zd.m + '-' + zd.day);
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
