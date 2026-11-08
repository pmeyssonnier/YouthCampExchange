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

// letter template link
const tpl = async (files) => {
  const p2 = await ctx.newPage();
  await p2.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p2.route('**/js/assets.js*', async r => { const resp = await r.fetch(); await r.fulfill({ response: resp, body: (await resp.text()) + (files ? '\nconst LETTER_FILES=' + JSON.stringify(files) + ';' : '') }); });
  await p2.goto(url, { waitUntil: 'load' }); await p2.waitForTimeout(600);
  const href = await p2.evaluate(() => document.querySelector('a.dl-card[href*="Letter_to_Host_Family"]').getAttribute('href'));
  await p2.close(); return href;
};
t.ok(/Letter_to_Host_Family_2027\.docx$/.test(await tpl(['Letter_to_Host_Family_2026.docx', 'Letter_to_Host_Family_2027.docx'])), 'the season template is used when it exists');
t.ok(/Letter_to_Host_Family_2026\.docx$/.test(await tpl(['Letter_to_Host_Family_2026.docx'])), 'otherwise the most recent template is offered (no more 404)');
t.ok(fs.existsSync(new URL('../documents/' + (await tpl(['Letter_to_Host_Family_2026.docx'])).replace('documents/', ''), import.meta.url)), 'and that file exists');
t.ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
