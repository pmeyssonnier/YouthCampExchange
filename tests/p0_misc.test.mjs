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
await new Promise(r => srv.listen(8875, r));
const br = await chromium.launch(launchOpts);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const B = 'http://localhost:8875/';
const ctx = await br.newContext();
const pg = await ctx.newPage(); const errs = [];
pg.on('pageerror', e => errs.push(e.message));
pg.on('dialog', d => d.accept());

// SEC-01 : bandeau sur les écrans de signature uniquement
await pg.goto(B + 'yce_form_filler.html?sign=club'); await pg.waitForTimeout(700);
ok(await pg.isVisible('.sign-warn'), 'identity warning shown in club signing mode');
ok(/own e-mail address/.test(await pg.textContent('.sign-warn')), 'warning tells to reply from own address');
await pg.goto(B + 'yce_form_filler.html?sign=district'); await pg.waitForTimeout(700);
ok(await pg.isVisible('.sign-warn'), 'identity warning shown in district signing mode');
await pg.goto(B + 'yce_form_filler.html'); await pg.waitForTimeout(700);
ok(!(await pg.isVisible('.sign-warn')), 'no signing warning for candidates');

// SEC-03 : brouillon horodaté, restauré avec avertissement, effacé après 30 jours
await pg.evaluate(() => localStorage.clear());
await pg.goto(B + 'yce_form_filler.html'); await pg.waitForTimeout(700);
await pg.fill('#f-F16', 'Doe'); await pg.dispatchEvent('#f-F16', 'input'); await pg.waitForTimeout(600);
const key = await pg.evaluate(() => DRAFT_KEY);
const d0 = JSON.parse(await pg.evaluate(k => localStorage.getItem(k), key));
ok(d0 && typeof d0.ts === 'number' && d0.v.F16 === 'Doe', 'draft saved with a timestamp');
await pg.reload(); await pg.waitForTimeout(800);
ok((await pg.inputValue('#f-F16')) === 'Doe', 'fresh draft restored');
ok(/Draft restored.*shared computer/.test(await pg.textContent('#status')), 'restore notice shown: ' + await pg.textContent('#status'));
await pg.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.ts = Date.now() - 31 * 86400000; localStorage.setItem(k, JSON.stringify(d)); }, key);
await pg.reload(); await pg.waitForTimeout(800);
ok((await pg.inputValue('#f-F16')) === '', 'expired draft not restored');
ok(!/Doe/.test(await pg.evaluate(k => localStorage.getItem(k) || '', key)), 'expired draft data erased from the browser');
ok(/older than 30 days/.test(await pg.textContent('#status')), 'expiry notice shown');
await pg.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: { F16: 'Legacy' }, x: {}, t: {}, s: {} })), key);
await pg.reload(); await pg.waitForTimeout(800);
ok((await pg.inputValue('#f-F16')) === 'Legacy', 'legacy draft without timestamp still restored');

// SEC-14 : export CSV neutralisé
await pg.goto(B + 'yce_tracker.html'); await pg.waitForTimeout(500);
const csv = await pg.evaluate(() => ['=HYPERLINK("http://x","y")', '+SUM(A1)', '-2+3+cmd|x', '@SUM(1)', '\t=1', '+32 470 12 34 56', '-12', '2008-05-12', 'Doe', ''].map(csvSafe));
ok(csv[0] === "'=HYPERLINK(\"http://x\",\"y\")" && csv[1] === "'+SUM(A1)" && csv[2] === "'-2+3+cmd|x" && csv[3] === "'@SUM(1)" && csv[4] === "'\t=1", 'formulas neutralised: ' + JSON.stringify(csv.slice(0, 5)));
ok(csv[5] === '+32 470 12 34 56' && csv[6] === '-12' && csv[7] === '2008-05-12' && csv[8] === 'Doe', 'phones, numbers and text untouched');
// variantes : espaces de tête (normaux, insécables, idéographiques, retour à la ligne) et signes pleine chasse
const csv2 = await pg.evaluate(() => [' =HYPERLINK("http://x")', ' =1+1', '\n@SUM(1)', '　+SUM(A1)', '＝HYPERLINK(1)', '＠SUM(1)', ' +32 470 12 34 56', 'Jean-Pierre'].map(csvSafe));
ok(csv2.slice(0, 6).every(s => s[0] === "'"), 'formulas behind leading spaces or full-width signs neutralised: ' + JSON.stringify(csv2.slice(0, 6)));
ok(csv2[6] === ' +32 470 12 34 56' && csv2[7] === 'Jean-Pierre', 'spaced phone and hyphenated name untouched');
// export complet : toutes les colonnes d'une candidature piégée passent par la protection
{
  const evil = '=HYPERLINK("http://evil","x")';
  await pg.evaluate(e => { ROWS['C_evil_x'] = { dist: 'C', fam: e, fir: ' ' + e, sex: '+cmd|x', dob: '@SUM(1)', age: 17, club: '＝1+1', email: '-1+cmd', mobile: '+32 470 12 34 56',
    pref1: e, pref2: '', pref3: '', missing: [e], status: 'Incomplete', notes: '\n' + e, updated: '' }; }, evil);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => exportCsv())]);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  const cells = text.split('\r\n')[1].split(';').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
  const risky = cells.filter(c => /^\s*[=+\-@＝＋－＠]/.test(c) && !/^[+-]?[\d\s().\/-]+$/.test(c.trim()));
  ok(!risky.length && cells.includes('+32 470 12 34 56'), 'CSV export: no cell can start a formula ' + JSON.stringify(risky));
  await pg.evaluate(() => { delete ROWS['C_evil_x']; });
}

// données des saisons passées effacées du navigateur : tracker (au-delà de la saison précédente), brouillons du formulaire
{
  const Y = +(await pg.evaluate(() => YEAR));
  await pg.evaluate(y => { localStorage.setItem('yce_tracker_' + (y - 3), '{"A_old_x":{"fam":"Old"}}'); localStorage.setItem('yce_tracker_' + (y - 1), '{}');
    localStorage.setItem('yce_form_draft_' + (y - 1), '{"ts":1,"v":{"F16":"Old"}}'); localStorage.setItem('yce_form_draft_' + y + '_x', 'keep'); }, Y);
  await pg.goto(B + 'yce_tracker.html'); await pg.waitForTimeout(400);
  const k1 = await pg.evaluate(() => Object.keys(localStorage));
  ok(!k1.includes('yce_tracker_' + (Y - 3)) && k1.includes('yce_tracker_' + (Y - 1)), 'tracker: rows older than the previous season erased, previous season kept');
  await pg.goto(B + 'yce_form_filler.html'); await pg.waitForTimeout(800);
  const k2 = await pg.evaluate(() => Object.keys(localStorage));
  ok(!k2.includes('yce_form_draft_' + (Y - 1)) && k2.includes('yce_form_draft_' + Y + '_x'), 'form: drafts of other seasons erased');
}

// SEC-10 : dates du site et du gestionnaire de camps
await pg.goto(B + 'index.html'); await pg.waitForTimeout(500);
ok(await pg.evaluate(() => parseDate('31-02-2026') === null && parseDate('45-13-2026') === null && parseDate('29-02-2028') !== null && parseDate('28-02-2027') !== null), 'site rejects impossible dates, keeps leap day');
await pg.goto(B + 'yce_admin.html#camps'); await pg.waitForTimeout(700);
const r = await pg.evaluate(() => {
  const res = {};
  const tryIt = (label, f) => { openEdit(0); f(); document.getElementById('log').innerHTML = ''; saveEdit(); res[label] = document.getElementById('log').textContent; };
  const set = (id, v) => { document.getElementById(id).value = v; };
  tryIt('impossible', () => set('e-camp_starts', '31-02-2027'));
  tryIt('inverted', () => { set('e-camp_starts', '20-07-2027'); set('e-camp_ends', '10-07-2027'); });
  tryIt('family inverted', () => { set('e-family_stay_starts', '20-07-2027'); set('e-family_stay_ends', '10-07-2027'); });
  tryIt('ages', () => set('e-age_requirements', '21-17'));
  tryIt('website', () => set('e-website', 'javascript:alert(1)'));
  tryIt('email', () => set('e-contact_email', 'x"><img>'));
  tryIt('valid', () => { set('e-camp_starts', '01-07-2027'); set('e-camp_ends', '10-07-2027'); });
  res.mdy = [mdyToDmy('02-31-2027'), mdyToDmy('07-15-2027'), mdyToDmy('13-01-2027')];
  return res;
});
ok(/Not a valid date/.test(r.impossible), 'camp manager refuses 31-02: ' + r.impossible);
ok(/start date is after/.test(r.inverted), 'camp manager refuses inverted camp dates');
ok(/Family stay: the start date is after/.test(r['family inverted']), 'camp manager refuses inverted family stay');
ok(/minimum is above/.test(r.ages), 'camp manager refuses min age > max age');
ok(/web address/.test(r.website), 'camp manager refuses javascript: website');
ok(/e-mail is not valid/.test(r.email), 'camp manager refuses malformed e-mail');
ok(/Camp updated/.test(r.valid), 'valid edit still accepted: ' + r.valid);
ok(r.mdy[0] === null && r.mdy[1] === '15-07-2027' && r.mdy[2] === null, 'directory import drops impossible dates: ' + JSON.stringify(r.mdy));
// import du répertoire : les camps archivés ne sont ni proposés ni affichés
{
  const rv = await pg.evaluate(() => {
    const keep = ARCH; ARCH = [{ camp_name: 'Fjord Adventure Camp', country: 'Norway' }, { camp_name: 'Desert Stars', country: 'Jordan' }];
    const t = (name, country) => ({ name: name, country: country, cs: '01-07-2027', ce: '10-07-2027', langs: [] });
    buildReview('directory.xlsx', [t('Fjord Adventure Camp', 'Norway'), t('Lions Desert Stars Camp 2027', 'Jordan'), t('Brand New Andes Camp', 'Peru')]);
    const out = { body: document.getElementById('rev-body').textContent, note: document.getElementById('rev-note').textContent, n: document.querySelectorAll('#rev-body input').length };
    ARCH = keep; cancelReview(); return out;
  });
  ok(!/Fjord|Desert/.test(rv.body) && rv.n === 1 && /Brand New Andes Camp/.test(rv.body), 'directory import: archived camps (exact and close names) left out, new camp offered: ' + rv.body);
  ok(/2 archived \(left out/.test(rv.note), 'directory import: note counts the archived camps left out: ' + rv.note);
}
ok(!errs.length, 'no page errors: ' + errs.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await br.close(); srv.close(); process.exit(fail ? 1 : 0);
