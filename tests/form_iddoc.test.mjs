// Scan de la pièce d'identité : ajouté au dossier ZIP, jamais gardé dans le brouillon, reconnu par le tracker.
import { chromium } from '@playwright/test';
import fs from 'fs';
import { FIX, launchOpts, serve, checker } from './helpers.mjs';

const t = checker('form ID document');
const srv = await serve(8880);
const br = await chromium.launch(launchOpts);
const ctx = await br.newContext({ acceptDownloads: true });
const pg = await ctx.newPage(); const errs = [];
pg.on('pageerror', e => errs.push(e.message));
const B = 'http://localhost:8880/';
const pdf = { name: 'my-passport.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% test passport\n%%EOF') };

await pg.goto(B + 'yce_form_filler.html'); await pg.evaluate(() => localStorage.clear());
await pg.goto(B + 'yce_form_filler.html'); await pg.waitForTimeout(700);
t.ok(await pg.isVisible('#id-hint'), 'ID document box shown in the attachments');
t.ok(/✖ Passport or ID card scan/.test(await pg.textContent('#att-check')), 'checklist shows the ID scan as missing');
await pg.setInputFiles('#id-file', pdf); await pg.waitForTimeout(300);
t.ok(/my-passport\.pdf/.test(await pg.textContent('#id-hint')), 'PDF accepted and named');
t.ok(/✔ Passport or ID card scan/.test(await pg.textContent('#att-check')), 'checklist ticks the ID scan');

// génération : le ZIP contient la pièce
await pg.fill('#f-F16', 'Doe'); await pg.fill('#f-S16', 'Jane'); await pg.dispatchEvent('#f-S16', 'input');
const dl = pg.waitForEvent('download', { timeout: 15000 });
await pg.click('#btn-gen');
const d = await dl; const buf = fs.readFileSync(await d.path());
const names = await pg.evaluate(b64 => { const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return zipNames(b.buffer); }, buf.toString('base64'));
t.ok(names.some(n => /^ID_document_\d{4}_\d+[A-Z]_Doe_Jane\.pdf$/.test(n)), 'dossier ZIP contains ID_document_…pdf: ' + names.join(', '));

// brouillon : jamais la pièce d'identité
await pg.waitForTimeout(500);
const draft = await pg.evaluate(() => localStorage.getItem(DRAFT_KEY) || '');
t.ok(draft.includes('Doe') && !draft.includes('test passport') && !/"id"\s*:/.test(draft), 'ID scan not stored in the browser draft');
await pg.reload(); await pg.waitForTimeout(800);
t.ok((await pg.inputValue('#f-F16')) === 'Doe', 'draft restored after reload');
t.ok(/✖ Passport or ID card scan/.test(await pg.textContent('#att-check')), 'ID scan must be added again after reload');

// tracker : la pièce est reconnue et compte pour un dossier complet
fs.writeFileSync(FIX + '/dossier_with_id.zip', buf);
await pg.goto(B + 'yce_tracker.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
await pg.setInputFiles('input[type=file]', FIX + '/dossier_with_id.zip'); await pg.waitForTimeout(1500);
t.ok(/passport \/ ID scan for Doe Jane/.test(await pg.textContent('#log')), 'tracker matches the ID scan to the candidate');
t.ok(await pg.evaluate(() => Object.values(ROWS)[0].iddoc === true), 'tracker row has iddoc = true');
// exigence selon la destination
const req = async (...c) => { await pg.evaluate(v => { ['N10','N11','N12'].forEach((r, i) => { const el = document.getElementById('f-' + r); el.value = v[i] || ''; el.dispatchEvent(new Event('input', { bubbles: true })); }); }, c); await pg.waitForTimeout(150); return pg.textContent('#id-req'); };
await pg.goto(B + 'yce_form_filler.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(700);
t.ok(/Passport if one of your camp choices/.test(await req()), 'no choice yet: rule explained');
t.ok(/Belgian ID card/.test(await req('France', 'Italy')) && /ID card/.test(await pg.textContent('#att-check')), 'Europe only: ID card is enough');
t.ok(/Passport required/.test(await req('France', 'Japan')), 'one choice outside Europe: passport required');
t.ok(/Passport required/.test(await req('United Kingdom')), 'United Kingdom: passport required');
t.ok(/Passport scan/.test(await pg.textContent('#att-check')), 'checklist names the passport');

// passeport en renouvellement : le scan suivra
await pg.check('#id-later'); await pg.waitForTimeout(200);
t.ok(/⏳ Passport scan — to follow/.test(await pg.textContent('#att-check')), 'checklist shows "to follow"');
await pg.fill('#f-F16', 'Roe'); await pg.fill('#f-S16', 'Ann'); await pg.dispatchEvent('#f-S16', 'input');
const dl2 = pg.waitForEvent('download', { timeout: 15000 });
await pg.click('#btn-gen');
const buf2 = fs.readFileSync(await (await dl2).path());
const n2 = await pg.evaluate(b64 => { const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return zipNames(b.buffer); }, buf2.toString('base64'));
t.ok(n2.some(n => /^ID_document_TO_FOLLOW_.*_Roe_Ann\.txt$/.test(n)) && !n2.some(n => /^ID_document_\d/.test(n)), 'ZIP carries a "to follow" note instead of the scan: ' + n2.join(', '));
await pg.waitForTimeout(500); await pg.reload(); await pg.waitForTimeout(800);
t.ok(await pg.isChecked('#id-later'), '"to follow" choice kept in the draft');
fs.writeFileSync(FIX + '/dossier_id_later.zip', buf2);
await pg.goto(B + 'yce_tracker.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
await pg.setInputFiles('input[type=file]', FIX + '/dossier_id_later.zip'); await pg.waitForTimeout(1500);
t.ok(await pg.evaluate(() => Object.values(ROWS)[0].iddoc === 'later'), 'tracker marks the scan as to follow');
t.ok(/⏳/.test(await pg.textContent('#tbody')), 'tracker shows ⏳');
t.ok(await pg.evaluate(() => !isComplete(Object.values(ROWS)[0])), 'file not counted complete while the scan is missing');
t.ok(!errs.length, 'no page error ' + errs.join(' | '));

await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
