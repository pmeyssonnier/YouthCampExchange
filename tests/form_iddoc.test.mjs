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
const pdf = { name: 'my-passport.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n% test passport\n'), Buffer.alloc(30000, 32), Buffer.from('\n%%EOF')]) };

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
// étape suivante : déposer le ZIP dans le coffre (plus d'e-mail avec le dossier en pièce jointe)
t.ok(await pg.isVisible('#vault-btn') && !(await pg.$('#mail-btn')) && !(await pg.$('#coord-btn')), 'after generating: vault button, no e-mail buttons');
t.ok(/Next step: upload this ZIP .* application vault/.test(await pg.textContent('#status')), 'status tells to upload the ZIP to the vault');
const [vp] = await Promise.all([pg.context().waitForEvent('page'), pg.click('#vault-btn')]);
t.ok(/\/yce_vault\.html$/.test(vp.url()), 'vault button opens the vault in a new tab: ' + vp.url()); await vp.close();

// brouillon : jamais la pièce d'identité
await pg.waitForTimeout(500);
const draft = await pg.evaluate(() => localStorage.getItem(DRAFT_KEY) || '');
t.ok(draft.includes('Doe') && !draft.includes('test passport') && !/"id"\s*:/.test(draft), 'ID scan not stored in the localStorage draft (kept apart, in IndexedDB)');
await pg.reload(); await pg.waitForTimeout(800);
t.ok((await pg.inputValue('#f-F16')) === 'Doe', 'draft restored after reload');
t.ok(/✔ Passport or ID card scan/.test(await pg.textContent('#att-check')), 'ID scan is kept (browser storage, 30 days) after reload');

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

// bouton « Check missing fields » : liste cliquable de ce qui manque
{
  const m = await ctx.newPage(); const me = []; m.on('pageerror', e => me.push(e.message));
  await m.goto(B + 'yce_form_filler.html'); await m.evaluate(() => localStorage.clear());
  await m.goto(B + 'yce_form_filler.html'); await m.waitForTimeout(700);
  t.ok(await m.isVisible('#miss-btn') && /Check missing fields/.test(await m.textContent('#miss-btn')), 'Check missing fields button next to Clear form');
  await m.click('#miss-btn');
  const txt = await m.textContent('#miss-dlg');
  t.ok(await m.evaluate(() => document.getElementById('miss-dlg').open), 'dialog opens');
  t.ok(/Family Name/.test(txt) && /Date of birth/.test(txt) && /pass photo/i.test(txt) && /Proof of payment/.test(txt), 'lists key fields and attachments');
  t.ok(!/Nickname/.test(await m.evaluate(() => document.querySelector('.miss-dlg').innerText.split('other empty')[0])), 'optional fields are kept out of the required list');
  const n1 = await m.$$eval('.miss-item', e => e.length);
  const total = await m.evaluate(() => formItems().length), done = await m.evaluate(() => formItems().filter(x => x.done).length);
  t.ok((await m.textContent('#p-count')) === done + '/' + total, 'counter and list use the same items: ' + (await m.textContent('#p-count')));
  await m.evaluate(() => missingClose());
  await m.fill('#f-F16', 'Doe'); await m.dispatchEvent('#f-F16', 'input');
  await m.click('#miss-btn');
  t.ok(!/Family Name/.test(await m.evaluate(() => document.querySelector('.miss-dlg').innerText.split('other empty')[0])), 'a filled field leaves the list');
  await m.click('.miss-item'); await m.waitForTimeout(700);
  t.ok(!(await m.evaluate(() => document.getElementById('miss-dlg').open)), 'tapping an item closes the dialog and goes to the field');
  t.ok(!me.length, 'no page error ' + me.join(' | '));
  await m.close();
}

// « Check missing fields » : format des e-mails et des téléphones
{
  const m = await ctx.newPage(); const me = []; m.on('pageerror', e => me.push(e.message));
  await m.goto(B + 'yce_form_filler.html'); await m.evaluate(() => localStorage.clear());
  await m.goto(B + 'yce_form_filler.html'); await m.waitForTimeout(700);
  await m.evaluate(() => { const set = (r, v) => { document.getElementById('f-' + r).value = v; };
    set('S20', 'jane.doe@gmail'); set('E69', 'jane doe@x.be'); set('P64', 'ok@example.be'); set('S21', '12'); set('AE68', '+32 470 12 34 56'); set('G21', '0470123456'); });
  const f = await m.evaluate(() => formProblems().map(x => x.label + ': ' + x.why));
  t.ok(f.length === 3, 'three wrong formats found: ' + JSON.stringify(f));
  t.ok(f.some(x => /^Email: .*incomplete/.test(x)) && f.some(x => /^Club e-mail: remove the spaces/.test(x)) && f.some(x => /^Mobile: a number in Belgium has 8 to 9 digits after \+32 \(you typed 2\)/.test(x)), 'each problem is explained');
  t.ok(!f.some(x => /Emergency e-mail|Chairperson mobile|Phone \(home\)/.test(x)), 'correct e-mails and numbers (also a local number that gets the country code) are accepted');
  await m.click('#miss-btn');
  t.ok(/Wrong format \(3\)/i.test(await m.textContent('#miss-dlg')), 'dialog lists the wrong formats');
  await m.click('.miss-badi'); await m.waitForTimeout(600);
  t.ok(await m.evaluate(() => document.activeElement && document.activeElement.id) === 'f-S20', 'tapping a wrong format goes to that field');
  await m.evaluate(() => missingClose());
  await m.fill('#f-F16', 'Doe'); await m.fill('#f-S16', 'Jane'); await m.evaluate(() => { document.getElementById('f-S21').value = '+32 470 12 34 56'; });
  await m.evaluate(() => generate()); await m.waitForTimeout(500);
  const stt = await m.textContent('#status');
  t.ok(/Invalid e-mail address: Email \(/.test(stt) && /Club e-mail \(remove the spaces\)/.test(stt), 'generation is blocked by invalid e-mails: ' + stt.slice(0, 120));
  t.ok(await m.evaluate(() => !document.getElementById('btn-gen').disabled), 'generate button usable again after the refusal');
  await m.evaluate(() => { ['S20', 'E69', 'S21'].forEach(r => { const e = document.getElementById('f-' + r); e.value = ''; }); });
  t.ok(await m.evaluate(() => formProblems().length) === 0, 'no problem once the fields are cleared');
  t.ok(!me.length, 'no page error ' + me.join(' | '));
  await m.close();
}

// téléphones : indicatif pays <-> nombre de chiffres, tous les indicatifs reconnus, 0 des fixes italiens conservé
{
  const m = await ctx.newPage(); const me = []; m.on('pageerror', e => me.push(e.message));
  await m.goto(B + 'yce_form_filler.html'); await m.waitForTimeout(500);
  const r = await m.evaluate(() => Object.fromEntries(['0470123456', '+32 470 12 34 56', '+32 470 12 34', '+32 470 12 34 56 78 90', '+33 6 12 34', '+39 02 1234567', '+1 650 296 2870',
    '+971 50 123 4567', '+7 912 345 67 89', '+44 7911 123456', '+358 50 3575965', '+47 123 45'].map(x => { const n = normPhone(x); return [x, [n, phoneProblem(n)]]; })));
  t.ok(r['0470123456'][0] === '+32 470 123 456' && r['0470123456'][1] === '' && r['+32 470 12 34 56'][1] === '', 'Belgian mobile accepted');
  t.ok(/Belgium has 8 to 9 digits after \+32 \(you typed 7\)/.test(r['+32 470 12 34'][1]), 'too short for Belgium: ' + r['+32 470 12 34'][1]);
  t.ok(/Belgium has 8 to 9 digits after \+32 \(you typed 13\)/.test(r['+32 470 12 34 56 78 90'][1]), 'too long for Belgium');
  t.ok(/France has 9 digits after \+33 \(you typed 5\)/.test(r['+33 6 12 34'][1]), 'too short for France (below the old 8-digit floor): ' + r['+33 6 12 34'][1]);
  t.ok(r['+39 02 1234567'][0] === '+39 021 234 567' && r['+39 02 1234567'][1] === '', 'Italian landline keeps its 0');
  t.ok(r['+1 650 296 2870'][0] === '+1 650 296 2870' && r['+971 50 123 4567'][0] === '+971 501 234 567' && r['+7 912 345 67 89'][0] === '+7 912 345 6789', 'codes +1, +971, +7 recognised');
  t.ok(r['+44 7911 123456'][1] === '' && r['+358 50 3575965'][1] === '', 'UK and Finnish mobiles accepted');
  t.ok(r['+47 123 45'][1] !== '', 'too short for Norway is refused');
  t.ok(!me.length, 'no page error ' + me.join(' | '));
  await m.close();
}
t.ok(!errs.length, 'no page error ' + errs.join(' | '));

await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
