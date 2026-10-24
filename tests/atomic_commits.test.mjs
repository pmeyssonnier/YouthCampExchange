import { chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ROOT, FIX, CDN, launchOpts } from './helpers.mjs';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  let data; try { data = fs.readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
});
await new Promise(r => srv.listen(8876, r));
const br = await chromium.launch(launchOpts);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const TOK = 'github_pat_X';
const sha = s => crypto.createHash('sha1').update(s).digest('hex');

// ---- faux dépôt GitHub ----
function makeRepo() {
  const st = { head: 'c0', files: {}, blobs: {}, trees: {}, commits: { c0: { tree: 't0' } }, refUpdates: 0, n: 0, failBlob: false, failRef: false };
  for (const f of ['camps_data.js', 'districts_data.js']) st.files[f] = fs.readFileSync(ROOT + '/' + f, 'utf8');
  st.files['camps_archive.json'] = JSON.stringify({ updated: '2026-01-01', count: 0, archive: [] });
  return st;
}
async function handle(st, route) {
  const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname.replace('/repos/pmeyssonnier/YouthCampExchange/', '');
  const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
  if (req.headers()['authorization'] !== 'Bearer ' + TOK) return json({ message: 'Bad credentials' }, 401);
  if (u.pathname === '/user') return json({ login: 'pm' });
  if (m === 'GET' && p.startsWith('contents/')) {
    const f = decodeURIComponent(p.slice(9)); const c = st.files[f];
    return c == null ? json({ message: 'Not Found' }, 404) : json({ sha: sha(c), content: Buffer.from(c).toString('base64') });
  }
  if (m === 'GET' && p === 'git/ref/heads/main') {
    if (st.mutateOnRef) { st.mutateOnRef = false; st.files['camps_data.js'] += '\n// edited elsewhere'; }
    return json({ object: { sha: st.head } });
  }
  if (m === 'GET' && p.startsWith('git/commits/')) return json({ tree: { sha: st.commits[p.slice(12)].tree } });
  const body = req.postDataJSON();
  if (m === 'POST' && p === 'git/blobs') {
    if (st.failBlob && Object.keys(st.blobs).length >= 1) return json({ message: 'Server Error' }, 500);
    const id = 'b' + (++st.n); st.blobs[id] = Buffer.from(body.content, 'base64').toString(); return json({ sha: id });
  }
  if (m === 'POST' && p === 'git/trees') { const id = 't' + (++st.n); st.trees[id] = body; return json({ sha: id }); }
  if (m === 'POST' && p === 'git/commits') { const id = 'c' + (++st.n); st.commits[id] = { tree: body.tree, parents: body.parents, message: body.message }; return json({ sha: id }); }
  if (m === 'PATCH' && p === 'git/refs/heads/main') {
    if (st.failRef || st.commits[body.sha].parents[0] !== st.head) return json({ message: 'Update is not a fast forward' }, 422);
    st.refUpdates++; st.head = body.sha;
    for (const e of st.trees[st.commits[body.sha].tree].tree) st.files[e.path] = st.blobs[e.sha];
    st.lastMessage = st.commits[body.sha].message;
    return json({ object: { sha: body.sha } });
  }
  return json({ message: 'unexpected ' + m + ' ' + p }, 400);
}

async function openPage(pageName, st) {
  const ctx = await br.newContext();
  await ctx.route('https://api.github.com/**', r => handle(st, r));
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.accept());
  await pg.goto('http://localhost:8876/' + pageName); await pg.waitForTimeout(400);
  await pg.fill('#token', TOK); await pg.fill('#pin', 'correct horse'); await pg.click('#connect'); await pg.waitForTimeout(2500);
  return { pg, ctx, errs };
}
const lastLog = pg => pg.evaluate(() => document.querySelector('#log div').textContent);

// ---- page d'administration : saison + coordinateurs dans UN commit ----
{
  const st = makeRepo();
  const { pg, ctx, errs } = await openPage('yce_admin.html', st);
  await pg.evaluate(() => { document.getElementById('in-season').value = '2026–2027'; DIST_W.A.name = 'Jane "Q" Back\\slash'; });
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  ok(st.refUpdates === 1, 'admin: one single commit for two files (' + st.refUpdates + ')');
  ok(/SEASON = "2026–2027"/.test(st.files['camps_data.js']) && /Jane/.test(st.files['districts_data.js']), 'admin: both files updated');
  ok(/one commit/.test(await lastLog(pg)), 'admin: log reports one commit');
  const D = new Function(st.files['districts_data.js'] + ';return DISTRICTS;')();
  ok(D.A.name === 'Jane "Q" Back\\slash', 'admin: quotes/backslash kept and districts_data.js still valid JS: ' + D.A.name);
  ok(/SUPABASE_URL/.test(st.files['districts_data.js']), 'admin: vault settings preserved');
  await pg.evaluate(() => { GAL = [{ src: 'assets/gallery/a.jpg', caption: '' }, { src: 'assets/gallery/a.jpg', caption: '' }, { src: 'assets/gallery/b.jpg', caption: 'x' }]; });
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  const G = new Function(st.files['districts_data.js'] + ';return GALLERY;')();
  ok(G.length === 2 && G[0].src.endsWith('a.jpg') && G[1].src.endsWith('b.jpg'), 'admin: duplicate gallery entries never saved: ' + JSON.stringify(G));

  // conflit : quelqu'un modifie camps_data.js entre la lecture et l'écriture
  const before = st.refUpdates;
  await pg.evaluate(() => { document.getElementById('in-season').value = '2027–2028'; });
  st.mutateOnRef = true;
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  ok(st.refUpdates === before, 'admin: concurrent change detected, nothing written');
  ok(/changed on GitHub in the meantime/.test(await lastLog(pg)), 'admin: user told to reload');

  // panne au milieu (2e blob) : rien n'est publié
  st.failBlob = true; st.blobs = {};
  await pg.reload(); await pg.waitForTimeout(300); await pg.fill('#pin', 'correct horse'); await pg.click('#connect'); await pg.waitForTimeout(2500);
  const snap = JSON.stringify(st.files);
  await pg.evaluate(() => { document.getElementById('in-season').value = '2028–2029'; DIST_W.B.name = 'Other'; });
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  ok(JSON.stringify(st.files) === snap, 'admin: failure half-way leaves the repository untouched');
  ok(/Save failed/.test(await lastLog(pg)), 'admin: failure reported');
  ok(!errs.length, 'admin: no page error ' + errs.join(' | '));
  await ctx.close();
}

// ---- page admin : la copie en cache du site ne doit jamais être réécrite sur GitHub ----
{
  const st = makeRepo();
  // GitHub a déjà une version plus récente que celle servie (en cache) par le site
  st.files['districts_data.js'] = st.files['districts_data.js']
    .replace(/const GALLERY = \[[\s\S]*?\];/, 'const GALLERY = [{"src":"assets/gallery/new1.jpg","caption":"New"}];')
    .replace(/(\n  A: \{name: )"[^"]*"/, '$1"Fresh Name"');
  st.files['camps_data.js'] = st.files['camps_data.js'].replace(/const SEASON = "[^"]*";/, 'const SEASON = "2031–2032";');
  const { pg, ctx, errs } = await openPage('yce_admin.html', st);
  const f = await pg.evaluate(() => ({ gal: GAL.map(g => g.src), a: DIST_W.A.name,
    season: document.getElementById('in-season').value, log: document.getElementById('log').textContent }));
  ok(f.gal.length === 1 && f.gal[0] === 'assets/gallery/new1.jpg', 'admin: gallery reloaded from GitHub on connect: ' + f.gal);
  ok(f.a === 'Fresh Name', 'admin: coordinators reloaded from GitHub: ' + f.a);
  ok(f.season === '2031–2032', 'admin: season reloaded from GitHub: ' + f.season);
  ok(/loaded from GitHub/.test(f.log), 'admin: user told the data is current');
  await pg.evaluate(() => { DIST_W.B.name = 'Changed B'; });
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  const D = new Function(st.files['districts_data.js'] + ';return {G:GALLERY,D:DISTRICTS};')();
  ok(D.G.length === 1 && D.G[0].src.endsWith('new1.jpg') && D.D.A.name === 'Fresh Name' && D.D.B.name === 'Changed B',
    'admin: saving keeps GitHub data and only applies the edit');
  ok(/2031–2032/.test(st.files['camps_data.js']), 'admin: season not reverted by the save');
  ok(!errs.length, 'admin (stale cache): no page error ' + errs.join(' | '));
  await ctx.close();
}

// ---- districts : liste, édition, ajout, retrait, puis un seul enregistrement ----
{
  const st = makeRepo();
  // liste fictive A–D, indépendante des districts réellement déclarés sur le site
  st.files['districts_data.js'] = st.files['districts_data.js'].replace(/const DISTRICTS = \{[\s\S]*?\n\};/, 'const DISTRICTS = {\n'
    + ['A', 'B', 'C', 'D'].map(k => '  ' + k + ': {name: "Coord ' + k + '", club: "LC ' + k + '", email: "' + k.toLowerCase() + '@example.org", mobile: ""}').join(',\n') + '\n};');
  const { pg, ctx, errs } = await openPage('yce_admin.html', st);
  const rows = () => pg.$$eval('#dist-body .dist-item .badge', b => b.map(x => x.textContent));
  ok(JSON.stringify(await rows()) === JSON.stringify(['112 A', '112 B', '112 C', '112 D']), 'districts: list with one row per district ' + await rows());
  ok((await pg.$$('#dist-body .dist-item button')).length === 4, 'districts: an Edit button per district');
  // modifier B
  await pg.click('#dist-body .dist-item:nth-child(2) button');
  ok(await pg.inputValue('#de-name') !== '' && !(await pg.$('#de-code')), 'districts: edit form prefilled, code not editable');
  await pg.fill('#de-name', 'New <b>Coordinator</b>'); await pg.fill('#de-email', 'new.coord@example.org');
  await pg.click('.dist-form .btn');
  ok(await pg.evaluate(() => DIST_W.B.name === 'New <b>Coordinator</b>' && DIST_W.B.email === 'new.coord@example.org'), 'districts: edit applied');
  ok(!(await pg.$('#dist-body b b')) && /New <b>Coordinator<\/b>/.test(await pg.textContent('#dist-body')), 'districts: names shown as text, never as HTML');
  // ajouter E (refus d'un code existant, d'un e-mail invalide)
  await pg.click('text=➕ Add a district');
  await pg.fill('#de-code', 'a'); await pg.fill('#de-name', 'Dup'); await pg.fill('#de-email', 'x@example.org'); await pg.click('.dist-form .btn');
  ok(/already exists/.test(await lastLog(pg)), 'districts: existing code refused');
  await pg.fill('#de-code', 'e'); await pg.fill('#de-email', 'not-an-email'); await pg.click('.dist-form .btn');
  ok(/Invalid e-mail/.test(await lastLog(pg)), 'districts: invalid e-mail refused');
  await pg.fill('#de-name', 'Eve Example'); await pg.fill('#de-club', 'LC Test'); await pg.fill('#de-email', 'eve@example.org'); await pg.fill('#de-mobile', '+32 470 00 00 00');
  await pg.click('.dist-form .btn');
  ok((await rows()).includes('112 E'), 'districts: new district E listed');
  // codes de plusieurs caractères : une lettre puis lettres/chiffres, 4 au plus
  for (const bad of ['1A', 'C-C', 'é']) {
    await pg.click('text=➕ Add a district'); await pg.fill('#de-code', bad); await pg.fill('#de-name', 'X'); await pg.fill('#de-email', 'x@example.org');
    await pg.click('.dist-form .btn');
    ok(/1 to 4 characters/.test(await lastLog(pg)), 'districts: code ' + bad + ' refused');
    if (bad === 'é') ok(await pg.getAttribute('#de-code', 'maxlength') === '4', 'districts: code limited to 4 characters');
    await pg.click('.dist-form .btn2');
  }
  await pg.click('text=➕ Add a district');
  await pg.fill('#de-code', 'cc'); await pg.fill('#de-name', 'Cecile Centre'); await pg.fill('#de-email', 'cc@example.org'); await pg.click('.dist-form .btn');
  ok((await rows()).includes('112 CC'), 'districts: multi-letter district CC listed');
  // retirer D
  await pg.click('#dist-body .dist-item:has(.badge:text-is("112 D")) button'); await pg.click('text=🗑 Remove district');
  ok(!(await rows()).includes('112 D'), 'districts: D removed from the list');
  ok(st.refUpdates === 0, 'districts: nothing published before "Save the data"');
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  const D = new Function(st.files['districts_data.js'] + ';return DISTRICTS;')();
  ok(st.refUpdates === 1 && JSON.stringify(Object.keys(D)) === JSON.stringify(['A', 'B', 'C', 'CC', 'E']), 'districts: saved in one commit (A, B, C, CC, E): ' + Object.keys(D));
  ok(D.B.name === 'New <b>Coordinator</b>' && D.CC.name === 'Cecile Centre' && D.E.club === 'LC Test' && D.E.mobile === '+32 470 00 00 00', 'districts: values written exactly');
  // relecture depuis GitHub : la liste revient identique
  await pg.reload(); await pg.waitForTimeout(2500);
  ok(JSON.stringify(await rows()) === JSON.stringify(['112 A', '112 B', '112 C', '112 CC', '112 E']), 'districts: list reloaded from GitHub after the save');
  ok(!errs.length, 'districts: no page error ' + errs.join(' | '));
  await ctx.close();
}

// ---- équipe nationale et coordonnées bancaires ----
{
  const st = makeRepo();
  const { pg, ctx, errs } = await openPage('yce_admin.html', st);
  const names = g => pg.evaluate(g => TEAM_W[g].map(m => m.name), g);
  ok((await names('national')).length === 4 && (await names('outgoing')).length === 3, 'team: both lists loaded from districts_data.js');
  ok(await pg.inputValue('#pay-iban') === 'BE62 3100 7424 1361', 'payment: IBAN loaded');
  // modifier le 2e membre de la commission
  await pg.click('#team-body .fld:nth-child(1) .dist-item:nth-child(2) button:has-text("Edit")');
  await pg.fill('#te-role', 'Camp Organizer & Webmaster'); await pg.click('#team-body .dist-form .btn');
  ok(await pg.evaluate(() => TEAM_W.national[1].role === 'Camp Organizer & Webmaster'), 'team: member edited');
  // ajouter un secrétaire outgoing (nom obligatoire, e-mail valide), puis le monter en tête
  await pg.click('#team-body .fld:nth-child(2) button:has-text("Add a member")');
  await pg.fill('#te-email', 'bad'); await pg.click('#team-body .dist-form .btn');
  ok(/name is required/.test(await lastLog(pg)), 'team: name required');
  await pg.fill('#te-name', 'Olga <i>Out</i>'); await pg.click('#team-body .dist-form .btn');
  ok(/Invalid e-mail/.test(await lastLog(pg)), 'team: invalid e-mail refused');
  await pg.fill('#te-email', 'olga@example.org'); await pg.fill('#te-role', 'Outgoing · Asia'); await pg.click('#team-body .dist-form .btn');
  ok((await names('outgoing')).slice(-1)[0] === 'Olga <i>Out</i>' && !(await pg.$('#team-body i')), 'team: member added, name shown as text');
  for (let k = 0; k < 3; k++) {
    const i = await pg.evaluate(() => TEAM_W.outgoing.findIndex(m => m.name.startsWith('Olga')));
    await pg.click(`#team-body .fld:nth-child(2) .dist-item:nth-child(${i + 1}) button[aria-label="Move up"]`);
  }
  ok((await names('outgoing'))[0] === 'Olga <i>Out</i>', 'team: member moved to the top ' + await names('outgoing'));
  // retirer le dernier membre de la commission
  await pg.click('#team-body .fld:nth-child(1) .dist-item:nth-child(4) button:has-text("Edit")'); await pg.click('#team-body button:has-text("Remove")');
  ok((await names('national')).length === 3, 'team: member removed');
  // IBAN faux : rien n'est publié
  await pg.fill('#pay-iban', 'BE62 3100 7424 1362');
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1200);
  ok(st.refUpdates === 0 && /IBAN .* is not valid/.test(await lastLog(pg)), 'payment: wrong IBAN check digits block the save');
  await pg.fill('#pay-iban', 'BE71 0961 2345 6769'); await pg.fill('#pay-amount', '€150'); await pg.fill('#pay-bic', 'gkccbebb');
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  const X = new Function(st.files['districts_data.js'] + ';return {T:TEAM,P:PAYMENT,D:DISTRICTS};')();
  ok(st.refUpdates === 1, 'team + payment: one commit');
  ok(X.T.national.length === 3 && X.T.national[1].role === 'Camp Organizer & Webmaster' && X.T.outgoing[0].name === 'Olga <i>Out</i>' && X.T.outgoing.length === 4, 'team: written exactly');
  ok(X.P.iban === 'BE71 0961 2345 6769' && X.P.amount === '€150' && X.P.bic === 'GKCCBEBB' && Object.keys(X.D).length === Object.keys(new Function(fs.readFileSync(ROOT + '/districts_data.js', 'utf8') + ';return DISTRICTS;')()).length, 'payment written, BIC upper-cased, districts kept');
  await ctx.close();
  // ancien districts_data.js sans TEAM ni PAYMENT : les lignes sont ajoutées au premier enregistrement
  const st2 = makeRepo();
  st2.files['districts_data.js'] = st2.files['districts_data.js'].replace(/^const (TEAM|PAYMENT) = .*;$/gm, '');
  const o2 = await openPage('yce_admin.html', st2);
  await o2.pg.fill('#pay-amount', '€125'); await o2.pg.fill('#pay-iban', 'BE62 3100 7424 1361');
  await o2.pg.evaluate(() => saveData()); await o2.pg.waitForTimeout(1500);
  const Y = new Function(st2.files['districts_data.js'] + ';return {P:PAYMENT,G:GALLERY,T:TEAM};')();
  ok(Y.P.iban === 'BE62 3100 7424 1361' && Array.isArray(Y.G) && Array.isArray(Y.T.national), 'old data file: TEAM and PAYMENT added, file still valid');
  ok(!errs.length && !o2.errs.length, 'team/payment: no page error ' + errs.concat(o2.errs).join(' | '));
  await o2.ctx.close();
}

// ---- numéro du district multiple : titre, puces des districts, intitulés de l'équipe, enregistrement ----
{
  const st = makeRepo();
  const { pg, ctx, errs } = await openPage('yce_admin.html', st);
  ok(await pg.inputValue('#in-md') === '112' && await pg.textContent('#md-title') === '112', 'MD: number loaded, section titled Multi District 112');
  ok(/National Commission MD 112/.test(await pg.textContent('#team-body')) && /Outgoing Secretaries MD 112/.test(await pg.textContent('#team-body')), 'MD: team titles carry the number');
  await pg.fill('#in-md', '1x');
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1200);
  ok(st.refUpdates === 0 && /multiple district number/.test(await lastLog(pg)), 'MD: non-numeric value blocks the save');
  await pg.fill('#in-md', '103');
  const badges = await pg.$$eval('#dist-body .dist-item .badge', b => b.map(x => x.textContent));
  ok(badges.length && badges.every(b => /^103 /.test(b)) && await pg.textContent('#md-title') === '103' && /National Commission MD 103/.test(await pg.textContent('#team-body')), 'MD: district badges and titles follow the edit ' + badges);
  await pg.evaluate(() => saveData()); await pg.waitForTimeout(1500);
  ok(st.refUpdates === 1 && /^const MD = "103";$/m.test(st.files['districts_data.js']) && new Function(st.files['districts_data.js'] + ';return MD;')() === '103', 'MD: saved in districts_data.js');
  await pg.reload(); await pg.waitForTimeout(2500);
  ok(await pg.inputValue('#in-md') === '103', 'MD: reloaded from GitHub after the save');
  ok(!errs.length, 'MD: no page error ' + errs.join(' | '));
  await ctx.close();
}

// ---- gestionnaire de camps : camps + archive dans UN commit ----
{
  const st = makeRepo();
  const { pg, ctx, errs } = await openPage('yce_admin.html#camps', st);
  const n0 = await pg.evaluate(() => CAMPS_W.length);
  await pg.evaluate(() => { archiveCamp(0); });
  await pg.evaluate(() => saveSite()); await pg.waitForTimeout(1500);
  ok(st.refUpdates === 1, 'camp manager: one commit for camps + archive (' + st.refUpdates + ')');
  ok(JSON.parse(st.files['camps_archive.json']).archive.length === 1, 'camp manager: archive written');
  ok(new Function(st.files['camps_data.js'] + ';return RAW.length;')() === n0 - 1, 'camp manager: camp removed from the site data');
  // nouvelle sauvegarde sans changement : pas de commit (la date seule ne compte pas)
  await pg.evaluate(() => { DIRTY = true; saveSite(); }); await pg.waitForTimeout(1200);
  ok(st.refUpdates === 1, 'camp manager: no empty commit when nothing changed');
  ok(!errs.length, 'camp manager: no page error ' + errs.join(' | '));
  await ctx.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await br.close(); srv.close(); process.exit(fail ? 1 : 0);
