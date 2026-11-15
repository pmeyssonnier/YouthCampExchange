// Pages d'outils (suivi, administration, coffre) : une donnée reçue de l'extérieur — formulaire d'un candidat, répertoire YCE,
// fichier GeoJSON, sauvegarde JSON, lignes de la base — ne doit jamais devenir du code ni du HTML actif.
// Chaque champ reçoit une charge qui tente de sortir d'un attribut HTML, d'une balise et d'une chaîne JavaScript d'un onclick ;
// on affiche tout, on clique sur tout ce qui est cliquable, et rien ne doit s'être exécuté.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('tool pages XSS');
const srv = await serve(8894);
const br = await chromium.launch(launchOpts);
const B = 'http://localhost:8894/';
const SETUP = () => {
  window.confirm = () => false; window.alert = () => {}; window.prompt = () => null;
  // sort d'une chaîne JS entre apostrophes ou guillemets, d'un attribut, puis ouvre une balise active
  window.P = n => "x')){};window.__xss=(window.__xss||[]).concat('js1:" + n + "');//\\');window.__xss=(window.__xss||[]).concat('js2:" + n + "');//"
    + '");window.__xss=(window.__xss||[]).concat("js3:' + n + '");//'
    + '"><img src=x onerror="window.__xss=(window.__xss||[]).concat(\'html:' + n + '\')"><b class="xss-probe">' + n + '</b>';
  // clique sur tout ce qui porte un gestionnaire dans les zones données, sans quitter la page
  window.clickAll = sel => { let n = 0; document.querySelectorAll(sel).forEach(root => root.querySelectorAll('[onclick],[onchange],button,select,input').forEach(el => {
    try { if (el.tagName === 'A') return; n++; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* un gestionnaire peut refuser la valeur */ } })); return n; };
  window.verdict = () => ({ ran: window.__xss || [], probes: document.querySelectorAll('.xss-probe').length, imgs: document.querySelectorAll('img[src="x"]').length,
    where: [...document.querySelectorAll('.xss-probe')].map(e => e.textContent + '@' + ((e.closest('[id]') || {}).id || '?')) });
};
const clean = v => !v.ran.length && v.probes === 0 && v.imgs === 0;
const open = async (page) => { const pg = await br.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.goto(B + page, { waitUntil: 'load' }); await pg.waitForTimeout(600); await pg.evaluate(SETUP); return { pg, errs }; };

// ---------- suivi : lignes issues des formulaires reçus des candidats ----------
{
  const { pg } = await open('yce_tracker.html');
  const v = await pg.evaluate(async () => {
    const r = k => ({ dist: P('dist'), fam: P('fam'), fir: P('fir'), sex: P('sex'), dob: P('dob'), age: P('age'), club: P('club'), email: P('email'), mobile: P('mobile'),
      pref1: P('pref1'), pref2: P('pref2'), pref3: P('pref3'), pct: P('pct'), status: P('status'), notes: P('notes'), missing: [P('missing')], _k: k });
    ROWS = { 'C_doe_jane': r('C_doe_jane') }; ROWS[P('key')] = r(P('key'));
    render(); log(P('log'), P('cls'));
    const clicks = clickAll('#tbody');
    await new Promise(r => setTimeout(r, 400));
    return Object.assign(verdict(), { clicks, rows: document.querySelectorAll('#tbody tr').length, shown: document.getElementById('tbody').textContent.indexOf('xss-probe') >= 0 });
  });
  t.ok(v.rows === 2 && v.clicks >= 6 && v.shown, 'tracker: hostile rows are displayed as text and their controls were exercised (' + v.clicks + ')');
  t.ok(clean(v), 'tracker: nothing executes from a candidate file (names, club, notes, row key): ' + JSON.stringify(v));
  // la suppression fonctionne toujours, avec un nom ordinaire comme avec un nom piégé
  const del = await pg.evaluate(() => { window.confirm = () => true; const n = Object.keys(ROWS).length; document.querySelector('.del-btn').click(); return n - Object.keys(ROWS).length; });
  t.ok(del === 1, 'tracker: the remove button still removes its row');
  await pg.close();
}

// ---------- administration : camps, répertoire importé, coordonnées, coordinateurs, équipe, galerie ----------
{
  const { pg } = await open('yce_admin.html#camps');
  const v = await pg.evaluate(async () => {
    const camp = n => ({ continent: 'Europe', country: P('country' + n), state: P('state'), district: P('district'), camp_name: P('camp' + n), age_requirements: P('ages'), fee: P('fee'),
      camp_starts: '01-07-2027', camp_ends: P('ends'), family_stay_starts: P('fs'), family_stay_ends: P('fe'), archived_on: P('arch'),
      detail: { location: P('loc'), description: P('desc'), host_family_activities: P('hfa'), languages: [P('lang')], website: P('web'), flyer_url: P('flyer'),
        application_deadline: P('dl'), participants: P('part'), contact_name: P('cn'), contact_email: 'same@x.example', contact_phone: P('cp'), lat: P('lat'), lon: P('lon') } });
    CAMPS_W = [camp(''), camp('')]; ARCH = [camp('a')];
    render(); const camps = document.querySelectorAll('#tbody tr').length; openEdit(0); closeEdit(); showDuplicates(); setView('archived'); setView('active');
    // répertoire importé : lignes à revoir, rejetées, remarques, puis rapport final
    const item = n => ({ row: P('row'), name: P('item' + n), country: P('country'), cs: '02-07-2027', ce: P('ce'), ages: P('ages'), fee: P('fee'), location: P('loc'), langs: [P('lang')], cemail: P('mail') });
    buildReview(P('file'), [item(1), Object.assign(item(2), { country: 'Nowhereland' + P('c') })], { read: 3, rejected: [{ row: P('r'), name: P('rn'), country: P('rc'), why: P('why') }], remarks: [{ row: 1, name: P('mn'), country: P('mc'), why: P('mw') }] });
    const rep = JSON.parse(JSON.stringify(IMPORT)); let clicks = clickAll('#rev-body');
    showReport(rep, { up: 0, rn: 0, nw: 1, arch: 0, unticked: 0, late: [{ name: P('late'), country: P('lc'), why: P('lw') }] });
    cancelReview();
    // coordonnées (GeoJSON)
    buildGeoReview(P('geo'), { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [4.3, 50.8] }, properties: { Country: CAMPS_W[0].country, 'Camp name': CAMPS_W[0].camp_name, Location: P('gl') } }] });
    clicks += clickAll('#rev-body'); cancelReview();
    // onglet Site : coordinateurs, équipe nationale, galerie
    DIST_W = {}; DIST_W[P('dk')] = { name: P('dn'), club: P('dc'), email: P('de'), mobile: P('dm') }; DIST_W.C = { name: P('n'), club: P('c'), email: P('e'), mobile: P('m') };
    DIST_EDIT = P('dk'); distShow(); DIST_EDIT = null; distShow();
    TEAM_W = { national: [{ name: P('tn'), role: P('tr'), club: P('tc'), email: P('te'), mobile: P('tm') }], outgoing: [{ name: P('on') }] }; teamShow();
    GAL = [{ src: P('gs'), caption: P('gc') }]; galShow();
    clicks += clickAll('#tbody, #dups-body, #dist-body, #team-body, #imp-report');
    log(esc(P('log')), 'ok'); // le journal de l'administration reçoit du HTML écrit par le code : toute donnée y passe par esc()
    await new Promise(r => setTimeout(r, 400)); // laisse à une image injectée le temps de déclencher son onerror
    return Object.assign(verdict(), { clicks, camps });
  });
  t.ok(v.camps === 2 && v.clicks >= 12, 'administration: hostile camps, directory, coordinates, coordinators, team and gallery were displayed and exercised (' + v.clicks + ' controls)');
  t.ok(clean(v), 'administration: nothing executes from imported or saved data: ' + JSON.stringify(v));
  await pg.close();
}

// ---------- coffre : dossiers, fichiers, signatures, historique, commentaires, intervenants ----------
{
  const { pg } = await open('yce_vault.html');
  const v = await pg.evaluate(async () => {
    const id = P('id');
    const d = { id, season: P('season'), candidate_email: P('ce'), candidate_name: P('name'), candidate_birth_date: '2000-01-01', parent_email: P('pe'), president_email: P('pr'), district: P('dist'),
      club: P('club'), camp_choice: P('camp'), status: P('status'), first_submitted_at: '2026-11-01T10:00:00Z', purge_after: '2029-08-31', updated_at: '2026-11-01T10:00:00Z' };
    ME = P('me'); ROLES = [{ role: 'national', district: null }]; DOSSIERS = [d, Object.assign({}, d, { status: 'submitted' })];
    renderList(); renderWelcome();
    CUR = Object.assign({}, d, { status: 'district_validated' });
    CUR_FILES = [{ id: P('fid'), dossier_id: id, kind: 'zip', path: P('path'), file_name: P('fname'), sha256: P('sha'), size_bytes: 1048576, contents: [P('content')], uploaded_by: P('up'), uploaded_at: '2026-11-01T10:00:00Z' },
      { id: P('fid2'), dossier_id: id, kind: P('kind'), path: 'p', file_name: P('fname2'), sha256: P('sha2'), size_bytes: 1, contents: [], uploaded_by: P('up2'), uploaded_at: '2026-11-02T10:00:00Z' }];
    renderDossier([{ signer_role: P('role'), signer_email: P('se'), signed_at: '2026-11-01T10:00:00Z', doc_sha256: P('dsha'), statement: P('stmt'), aal: P('aal'), auth_methods: [{ method: P('m') }] }],
      [{ action: P('action'), actor_email: P('actor'), at: '2026-11-01T10:00:00Z', detail: { file: P('ef'), from: P('from'), to: P('to') } },
       { action: 'status', actor_email: P('a2'), at: '2026-11-01T10:01:00Z', detail: { from: P('from'), to: P('to') } },
       { action: 'upload', actor_email: 'a', at: '2026-11-01T10:02:00Z', detail: { file: P('uf') } }, { action: 'download', actor_email: 'a', at: '2026-11-01T10:03:00Z', detail: { file: P('df') } },
       { action: 'email', actor_email: 'a', at: '2026-11-01T10:04:00Z', detail: { to: P('eto') } }],
      [{ author_email: P('ca'), created_at: '2026-11-01T10:05:00Z', body: P('body') }]);
    msg(P('msg'), 'err');
    API = { staffList: async () => [{ id: P('sid'), email: P('semail'), full_name: P('sname'), role: P('srole'), district: P('sdist') }], files: async () => [], getDossier: async () => null,
      rpc: async () => null, signatures: async () => [], events: async () => [], comments: async () => [], log: async () => null, signedUrl: async () => null, staffDelete: async () => null };
    await loadStaff();
    const clicks = clickAll('#list, #d-files, #d-sigs, #d-history, #staff-list');
    await new Promise(r => setTimeout(r, 300));
    return Object.assign(verdict(), { clicks, rows: document.querySelectorAll('#list tr').length, hist: document.querySelectorAll('#d-history li').length, staff: document.querySelectorAll('#staff-list tr').length });
  });
  t.ok(v.rows === 2 && v.hist === 6 && v.staff === 1 && v.clicks >= 4, 'vault: hostile files, signatures, history, comments and staff were displayed and exercised (' + v.clicks + ' controls)');
  t.ok(clean(v), 'vault: nothing executes from the rows of the database: ' + JSON.stringify(v));
  await pg.close();
}

await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
