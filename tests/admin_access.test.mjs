import { chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { ROOT, FIX, CDN, launchOpts } from './helpers.mjs';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  let data; try { data = fs.readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
});
await new Promise(r => srv.listen(8874, r));
const br = await chromium.launch(launchOpts);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const TOK = 'github_pat_TESTTOKEN123';

for (const pageName of ['yce_admin.html', 'yce_camps.html']) {
  const ctx = await br.newContext();
  const auth = [];
  await ctx.route('https://api.github.com/**', r => {
    auth.push(r.request().headers()['authorization']);
    const good = r.request().headers()['authorization'] === 'Bearer ' + TOK;
    if (!good) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Bad credentials"}' });
    if (/\/user$/.test(r.request().url())) return r.fulfill({ contentType: 'application/json', body: '{"login":"pmtest"}' });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ sha: 'abc', content: Buffer.from(fs.readFileSync(ROOT + '/camps_data.js')).toString('base64') }) });
  });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  const U = 'http://localhost:8874/' + pageName;
  const logText = () => pg.textContent('#log');
  const connected = () => pg.evaluate(() => document.getElementById('who').style.display !== 'none');

  // 1. ancien jeton en clair : effacé, pas de connexion automatique
  await pg.goto(U); await pg.evaluate(t => { localStorage.clear(); localStorage.setItem('yce_admin_token', t); }, TOK);
  await pg.goto(U); await pg.waitForTimeout(400);
  ok(!(await pg.evaluate(() => localStorage.getItem('yce_admin_token'))), pageName + ': legacy plaintext token deleted');
  ok(!(await connected()), pageName + ': no auto-connect with legacy token');
  ok(/old unencrypted token/.test(await logText()), pageName + ': user told why');

  // 2. phrase trop courte refusée
  await pg.fill('#token', TOK); await pg.fill('#pin', '1234'); await pg.click('#connect'); await pg.waitForTimeout(300);
  ok(/at least 8/.test(await logText()) && !(await connected()), pageName + ': 4-digit PIN refused');

  // 3. première connexion correcte : jeton chiffré v2, champ jeton vidé
  await pg.fill('#token', TOK); await pg.fill('#pin', 'correct horse'); await pg.click('#connect'); await pg.waitForTimeout(2500);
  ok(await connected(), pageName + ': connects with token + passphrase');
  ok((await pg.inputValue('#token')) === '' && (await pg.inputValue('#pin')) === '', pageName + ': token and passphrase cleared from the page');
  const blob = await pg.evaluate(() => localStorage.getItem('yce_admin_token_enc'));
  ok(/^v2\./.test(blob || '') && !(blob || '').includes(TOK), pageName + ': token stored encrypted (v2)');

  // 4. rechargement : déverrouillage par phrase secrète
  await pg.goto(U); await pg.waitForTimeout(300);
  ok(/Passphrase/.test(await pg.textContent('#pin-lbl')), pageName + ': unlock mode asks for the passphrase');
  await pg.fill('#pin', 'wrong passphrase'); await pg.click('#connect'); await pg.waitForTimeout(2500);
  ok(/wrong passphrase/.test(await logText()) && !(await connected()), pageName + ': wrong passphrase refused');
  await pg.fill('#pin', 'correct horse'); await pg.click('#connect'); await pg.waitForTimeout(2500);
  ok(await connected(), pageName + ': unlocks with the right passphrase');
  ok(auth.filter(a => a === 'Bearer ' + TOK).length >= 2, pageName + ': API calls carry the in-memory token');

  // 5. ancien bloc chiffré avec un PIN de 4 chiffres (format v1, 310k) : déverrouillé une fois puis retiré
  const legacy = await pg.evaluate(async t => {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode('4321'), 'PBKDF2', false, ['deriveKey']);
    const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(t)));
    const b = a => btoa(String.fromCharCode(...a));
    return b(salt) + '.' + b(iv) + '.' + b(ct);
  }, TOK);
  await pg.evaluate(b => { localStorage.clear(); localStorage.setItem('yce_admin_token_enc', b); }, legacy);
  await pg.goto(U); await pg.waitForTimeout(300);
  await pg.fill('#pin', '4321'); await pg.click('#connect'); await pg.waitForTimeout(2500);
  ok(await connected(), pageName + ': old 4-digit PIN still unlocks once');
  ok(/New passphrase/.test(await pg.textContent('#pin-lbl')), pageName + ': asked for a new passphrase right away');
  ok(!(await pg.isVisible('#token')), pageName + ': no need to paste the token again');
  await pg.fill('#pin', 'short'); await pg.click('#connect'); await pg.waitForTimeout(300);
  ok(/at least 8/.test(await logText()), pageName + ': new passphrase must be 8+');
  await pg.fill('#pin', 'brand new passphrase'); await pg.click('#connect'); await pg.waitForTimeout(2000);
  ok(/^v2\./.test(await pg.evaluate(() => localStorage.getItem('yce_admin_token_enc')) || ''), pageName + ': token re-encrypted with the new passphrase (v2)');
  await pg.goto(U); await pg.waitForTimeout(300);
  await pg.fill('#pin', '4321'); await pg.click('#connect'); await pg.waitForTimeout(2000);
  ok(!(await connected()), pageName + ': old PIN no longer works');
  await pg.fill('#pin', 'brand new passphrase'); await pg.click('#connect'); await pg.waitForTimeout(2500);
  ok(await connected(), pageName + ': new passphrase unlocks');

  // 6. Forget
  await pg.evaluate(() => logout());
  ok(!(await pg.evaluate(() => localStorage.getItem('yce_admin_token_enc') || localStorage.getItem('yce_admin_token'))), pageName + ': forget clears storage');
  ok(!errs.length, pageName + ': no page error ' + errs.join(' | '));
  await ctx.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await br.close(); srv.close(); process.exit(fail ? 1 : 0);
