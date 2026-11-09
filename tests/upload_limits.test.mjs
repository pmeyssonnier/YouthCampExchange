// Pièces jointes : trop légères/petites = refusées avec un message ; trop grosses = réduites (images) ou refusées (PDF) ; seuils réglés dans l'admin.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('attachment limits');
const srv = await serve(8908);
const br = await chromium.launch(launchOpts);
const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
const pg = await ctx.newPage();
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8908/yce_form_filler.html', { waitUntil: 'load' }); await pg.waitForTimeout(800);

// fictional images: random noise (heavy once encoded) of a given size
const jpg = async (w, h, q = 0.95) => Buffer.from(await pg.evaluate(async ([w, h, q]) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  const d = c.createImageData(w, h); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
  c.putImageData(d, 0, 0);
  const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', q)); const u = new Uint8Array(await b.arrayBuffer());
  let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s);
}, [w, h, q]), 'base64');
const status = () => pg.textContent('#status');

// photo too small (300x300)
await pg.setInputFiles('#photo-file', { name: 'p.jpg', mimeType: 'image/jpeg', buffer: await jpg(300, 300) }); await pg.waitForTimeout(500);
t.ok(!(await pg.evaluate(() => PHOTO.dataUrl)) && /Photo too small \(300×300 px\)/.test(await status()), 'a 300×300 photo is refused with a message: ' + (await status()).slice(0, 70));
// photo too light (500x500 but tiny file: flat colour)
const flat = Buffer.from(await pg.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 500; cv.height = 500; cv.getContext('2d').fillRect(0, 0, 500, 500); const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.1)); const u = new Uint8Array(await b.arrayBuffer()); let s = ''; u.forEach(x => s += String.fromCharCode(x)); return btoa(s); }), 'base64');
await pg.setInputFiles('#photo-file', { name: 'f.jpg', mimeType: 'image/jpeg', buffer: flat }); await pg.waitForTimeout(500);
t.ok(!(await pg.evaluate(() => PHOTO.dataUrl)) && /too light/.test(await status()), 'a 500×500 photo of a few KB is refused as too light (' + flat.length + ' bytes)');
// big photo is reduced to the maximum weight and size
const big = await jpg(3000, 3000, 0.95);
await pg.setInputFiles('#photo-file', { name: 'big.jpg', mimeType: 'image/jpeg', buffer: big }); await pg.waitForTimeout(2500);
const ph = await pg.evaluate(() => ({ ok: !!PHOTO.dataUrl, kb: PHOTO.dataUrl ? dataUrlBytes(PHOTO.dataUrl) / 1024 : 0, w: PHOTO.w, h: PHOTO.h }));
t.ok(ph.ok && ph.kb <= 1024 && Math.max(ph.w, ph.h) <= 800, 'a ' + (big.length >> 20) + ' MB photo is reduced to ' + Math.round(ph.kb) + ' KB, ' + ph.w + '×' + ph.h);
t.ok(/Photo reduced from/.test(await status()), 'the candidate is told: ' + (await status()));

// ID scan: small resolution refused, big reduced
await pg.setInputFiles('#id-file', { name: 's.jpg', mimeType: 'image/jpeg', buffer: await jpg(600, 400) }); await pg.waitForTimeout(500);
t.ok(!(await pg.evaluate(() => IDDOC.dataUrl)) && /too small \(600×400 px\)/.test(await status()), 'a 600×400 scan is refused');
await pg.setInputFiles('#id-file', { name: 'big.jpg', mimeType: 'image/jpeg', buffer: await jpg(4000, 3000, 0.95) }); await pg.waitForTimeout(3500);
const idr = await pg.evaluate(() => ({ ok: !!IDDOC.dataUrl, kb: IDDOC.dataUrl ? dataUrlBytes(IDDOC.dataUrl) / 1024 : 0 }));
t.ok(idr.ok && idr.kb <= 1536, 'a big scan is reduced to ' + Math.round(idr.kb) + ' KB');
await pg.evaluate(() => idClear({ stopPropagation() {} }));
// PDFs
const pdf = n => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n, 32), Buffer.from('\n%%EOF')]);
await pg.setInputFiles('#id-file', { name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf(5000) }); await pg.waitForTimeout(400);
t.ok(!(await pg.evaluate(() => IDDOC.dataUrl)) && /too light/.test(await status()), 'a 5 KB PDF is refused as too light');
await pg.setInputFiles('#id-file', { name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf(6 * 1048576) }); await pg.waitForTimeout(600);
t.ok(!(await pg.evaluate(() => IDDOC.dataUrl)) && /too big/.test(await status()), 'a 6 MB PDF is refused as too big');
await pg.setInputFiles('#id-file', { name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf(100000) }); await pg.waitForTimeout(400);
t.ok(!!(await pg.evaluate(() => IDDOC.dataUrl)), 'a 100 KB PDF is accepted');
// payment proof: no minimum resolution
await pg.setInputFiles('#pay-file', { name: 'pay.jpg', mimeType: 'image/jpeg', buffer: await jpg(500, 300, 0.95) }); await pg.waitForTimeout(500);
t.ok(!!(await pg.evaluate(() => PAY.dataUrl)), 'a small payment screenshot is accepted (no minimum resolution)');

// thresholds come from UPLOAD_LIMITS (admin setting)
const p3 = await ctx.newPage();
await p3.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await p3.route('**/districts_data.js*', async r => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()).replace(/const UPLOAD_LIMITS = .*;/, 'const UPLOAD_LIMITS = {"photo":{"minSidePx":900}};') }); });
await p3.goto('http://localhost:8908/yce_form_filler.html', { waitUntil: 'load' }); await p3.waitForTimeout(600);
const lim = await p3.evaluate(() => uploadLimits().photo); await p3.close();
t.ok(lim.minSidePx === 900 && lim.maxKb === 1024, 'a value set in UPLOAD_LIMITS overrides the default, others keep theirs');
t.ok(/UPLOAD_LIMITS/.test(fs.readFileSync(new URL('../districts_data.js', import.meta.url), 'utf8')), 'districts_data.js carries the limits');

// admin: fields, validation, literal
const ap = await ctx.newPage();
await ap.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
const aerrs = []; ap.on('pageerror', e => aerrs.push(e.message));
await ap.goto('http://localhost:8908/yce_admin.html', { waitUntil: 'load' }); await ap.waitForTimeout(800);
const adm = await ap.evaluate(() => {
  const n = LIM_FIELDS.length, have = LIM_FIELDS.filter(f => document.getElementById('lim-' + f[0] + '-' + f[1])).length;
  const v = limValues(); let err = '';
  document.getElementById('lim-pdf-minKb').value = '9999'; try { limValues(); } catch (e) { err = e.message; }
  document.getElementById('lim-pdf-minKb').value = '20';
  document.getElementById('lim-photo-maxKb').value = '0'; let err2 = ''; try { limValues(); } catch (e) { err2 = e.message; }
  return { n, have, v, err, err2 };
});
t.ok(adm.n === 10 && adm.have === 10, 'the admin page shows the 10 limits');
t.ok(adm.v.photo.minSidePx === 400 && adm.v.id.maxKb === 1536 && adm.v.pdf.maxKb === 5120, 'the admin fields start from the current values');
t.ok(/minimum weight must be lower/.test(adm.err) && /positive number/.test(adm.err2), 'inconsistent or empty values are refused before saving');
t.ok(!errs.length && !aerrs.length, 'no page error' + (errs[0] || aerrs[0] ? ': ' + (errs[0] || aerrs[0]) : ''));
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
