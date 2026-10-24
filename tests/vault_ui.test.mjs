// Coffre (yce_vault.html) de bout en bout : l'interface tourne dans Chromium et la couche d'accès
// (js/vault-api.js) est remplacée par une version qui exécute les mêmes opérations en SQL sur
// PostgreSQL (PGlite) avec le vrai schéma — droits, double authentification (aal) comprises.
import { chromium } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { ROOT, FIX, launchOpts, serve, checker } from './helpers.mjs';

const t = checker('vault UI');
const ok = t.ok;

// ---------- base ----------
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, delete on storage.objects to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(fs.readFileSync(ROOT + '/supabase/vault_schema.sql', 'utf8'));
await db.exec(`insert into staff (email, role, district, full_name) values
  ('admin@x.be','admin',null,'Admin'), ('nat@x.be','national',null,'National'),
  ('coorda@x.be','district','A','Coord A'), ('coordb@x.be','district','B','Coord B')`);
const BLOBS = {};   // contenu des fichiers déposés (stockage simulé)

let chain = Promise.resolve();
function runAs(email, aal, sql, params) {
  const job = chain.then(async () => {
    try {
      await db.exec('reset role');
      await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, aal })}', false)`);
      return { rows: (await db.query(sql, params)).rows };
    } catch (e) { return { error: e.message }; }
    finally { await db.exec('reset role'); }
  });
  chain = job.catch(() => {});
  return job;
}

// ---------- fausse couche d'accès : même interface que js/vault-api.js ----------
const FAKE_API = `
function makeVaultApi(){
  const me=()=>localStorage.getItem('fake-me')||'';
  const aal=()=>localStorage.getItem('fake-aal-'+me())||'aal1';
  const run=(sql,p)=>window.__sql(me(),aal(),sql,p||[]).then(function(r){if(r.error)throw new Error(r.error);return r.rows;});
  return {
    session: async()=> me()?{user:{email:me()}}:null,
    onAuth(){},
    sendLink: async(e,r)=>{window.__LINK={e:e,r:r};},
    signOut: async()=>{localStorage.removeItem('fake-me');},
    myRoles: ()=>run('select * from my_roles()'),
    listDossiers: ()=>run('select * from dossiers order by updated_at desc'),
    getDossier: async id=>(await run('select * from dossiers where id=$1',[id]))[0]||null,
    createDossier: async d=>{const k=Object.keys(d);return (await run('insert into dossiers ('+k.join(',')+') values ('+k.map((_,i)=>'$'+(i+1)).join(',')+') returning *',k.map(x=>d[x])))[0];},
    updateDossier: async(id,p)=>{const k=Object.keys(p);return (await run('update dossiers set '+k.map((x,i)=>x+'=$'+(i+2)).join(',')+' where id=$1 returning *',[id].concat(k.map(x=>p[x]))))[0];},
    deleteDossier: async(id,paths)=>{for(const p of paths||[])await run('delete from storage.objects where name=$1',[p]);await run('delete from dossiers where id=$1',[id]);},
    files: id=>run('select * from dossier_files where dossier_id=$1 order by uploaded_at desc',[id]),
    upload: async(id,file,sha,contents,kind,src)=>{kind=kind||'zip';const p=id+'/'+(kind==='zip'?'full':'club')+'/'+Date.now()+Math.random().toString(36).slice(2,6)+'_'+file.name;
      await run("insert into storage.objects (bucket_id,name) values ('dossiers',$1)",[p]);
      const b=new Uint8Array(await file.arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode.apply(null,b.subarray(i,i+8192));
      await window.__blob(p,btoa(s));
      return (await run("insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes,contents,source_sha) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",[id,kind,p,file.name,sha,file.size,contents,src||null]))[0];},
    downloadUrl: async f=>{const r=await run('select id from storage.objects where name=$1',[f.path]);if(!r.length)throw new Error('not allowed');
      await run('select dossier_log($1,$2,$3)',[f.dossier_id,'download',JSON.stringify({file:f.file_name})]);window.__DL=f.path;return '#dl';},
    transition: (id,t,n,s)=>run('select dossier_transition($1,$2,$3,$4)',[id,t,n,s]),
    comments: id=>run('select * from comments where dossier_id=$1 order by created_at',[id]),
    addComment: (id,b)=>run('insert into comments (dossier_id,body) values ($1,$2)',[id,b]),
    events: id=>run('select * from events where dossier_id=$1 order by at',[id]),
    signatures: id=>run('select * from signatures where dossier_id=$1 order by signed_at',[id]),
    mfaStatus: async()=>({current:aal(),verified:localStorage.getItem('fake-mfa-'+me())?[{id:'f-'+me()}]:[],pending:[]}),
    mfaEnroll: async()=>{window.__ENROLLED=(window.__ENROLLED||0)+1;return {factorId:'f-'+me(),qr:'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',secret:'JBSWY3DPEHPK3PXP'};},
    mfaVerify: async(f,code)=>{if(code!=='123456')throw new Error('Invalid TOTP code entered');localStorage.setItem('fake-mfa-'+me(),'1');localStorage.setItem('fake-aal-'+me(),'aal2');},
    staffList: ()=>run('select * from staff order by role, district'),
    staffAdd: r=>run('insert into staff (email,role,district,full_name) values ($1,$2,$3,$4)',[r.email,r.role,r.district,r.full_name]),
    staffDelete: id=>run('delete from staff where id=$1',[id]),
    purgeCandidates: ()=>run('select * from purge_candidates()'),
    purge: async c=>{for(const p of c.paths||[])await run('delete from storage.objects where name=$1',[p]);await run('select dossier_purge($1)',[c.id]);}
  };
}`;

const dist = fs.readFileSync(ROOT + '/districts_data.js', 'utf8')
  .replace('const SUPABASE_URL = "";', 'const SUPABASE_URL = "https://test.supabase.co";')
  .replace('const SUPABASE_ANON_KEY = "";', 'const SUPABASE_ANON_KEY = "test-key";');
const srv = await serve(8870, { '/js/vault-api.js': FAKE_API, '/districts_data.js': dist });
const BASE = 'http://localhost:8870/yce_vault.html';
const br = await chromium.launch(launchOpts);
const ctx = await br.newContext({ viewport: { width: 1100, height: 900 } });
await ctx.exposeFunction('__sql', (e, a, sql, p) => runAs(e, a, sql, p));
await ctx.exposeFunction('__blob', (p, b64) => { BLOBS[p] = Buffer.from(b64, 'base64'); });
await ctx.route('**/@supabase/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.supabase={createClient:function(){return {};}};' }));

const pg = await ctx.newPage();
pg.on('pageerror', e => ok(false, 'PAGEERROR ' + e.message));
let promptAnswer = '';
pg.on('dialog', d => d.accept(promptAnswer));
const settle = () => pg.waitForTimeout(400);
const msgText = () => pg.textContent('#msg');
async function login(email, q = '') {
  await pg.goto(BASE + q);
  await pg.evaluate(e => { if (e) localStorage.setItem('fake-me', e); else localStorage.removeItem('fake-me'); }, email);
  await pg.goto(BASE + q); await pg.waitForTimeout(600);
}
const minorBirth = new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10);

// ===== candidat mineur =====
await login(null);
ok(await pg.isVisible('#login'), 'login form when signed out');
await login('kid@x.be');
ok(await pg.isVisible('#create'), 'candidate sees "Start my application"');
await pg.fill('#n-name', 'Jane Doe'); await pg.selectOption('#n-district', 'A');
await pg.fill('#n-president', 'pres@x.be'); await pg.check('#n-consent');
await pg.click('#create .btn'); await settle();
ok(/date of birth/.test(await msgText()), 'birth date required');
await pg.fill('#n-birth', minorBirth);
await pg.click('#create .btn'); await settle();
ok(/under 18/.test(await msgText()), 'minor must give a parent e-mail');
await pg.fill('#n-parent', 'mum@x.be');
ok(/Transfer abroad/.test(await pg.textContent('#create .notice')) && /Health data/.test(await pg.textContent('#create .notice')), 'notice covers health data and transfers abroad');
await pg.click('#create .btn'); await settle();
ok(await pg.isVisible('#dossier'), 'file created and opened');
const DID = await pg.evaluate(() => CUR.id);
ok(/under 18/.test(await pg.textContent('#d-info')) === false, 'own draft is editable (no info block)');

// v1 incomplet : la base refuse l'envoi en listant les pièces manquantes
await pg.setInputFiles('#d-upload input[type=file]', FIX + '/vaultzip/Dossier_v1.zip'); await pg.waitForTimeout(1500);
ok(/club copy for the president/.test(await msgText()), 'upload also creates the club copy: ' + await msgText());
ok((await pg.$$eval('#d-files li', l => l.map(x => x.textContent))).some(x => /club copy/.test(x)), 'club copy listed');
ok(/parent \/ guardian for approval/.test(await pg.textContent('#d-actions')), 'minor sends to the parent first');
await pg.click('#d-actions .btn'); await settle();
const m1 = await msgText();
ok(/Missing documents/.test(m1) && /Passport \/ ID scan/.test(m1) && /Letter/.test(m1), 'database refuses an incomplete file: ' + m1);
await pg.setInputFiles('#d-upload input[type=file]', FIX + '/vaultzip/Dossier_v2.zip'); await pg.waitForTimeout(1500);
ok((await pg.$$eval('#d-check li.yes', l => l.length)) === 6, 'checklist complete (6 documents incl. ID scan)');
await pg.click('#d-actions .btn'); await settle();
ok(/Awaiting parent/.test(await pg.textContent('#d-status')), 'file sent to the parent');
ok(/mailto:mum%40x\.be/.test(await pg.innerHTML('#notify')), 'notify e-mail goes to the parent');

// ===== copie club : contenu vérifié =====
const clubPath = (await runAs('kid@x.be', 'aal1', "select path from dossier_files where dossier_id=$1 and kind='club' order by uploaded_at desc limit 1", [DID])).rows[0].path;
const club = await pg.evaluate(async b64 => {
  const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return (await unzip(b.buffer)).map(e => e.name);
}, BLOBS[clubPath].toString('base64'));
ok(club.length === 2 && club.some(n => /_CLUB-COPY\.xlsx$/.test(n)) && club.some(n => /^Commitment/.test(n)), 'club copy = reduced AF + Commitment only: ' + club.join(', '));
ok(!club.some(n => /ID_document|Pass_photo|Payment|Letter/.test(n)), 'club copy has no ID scan, photo, payment or letter');

// ===== le président ne voit rien avant l'approbation parentale =====
await login('pres@x.be', '?d=' + DID);
ok(/do not have access/.test(await msgText()), 'president cannot open a file awaiting the parent');

// ===== parent =====
await login('mum@x.be', '?d=' + DID);
ok(await pg.isVisible('#dossier'), 'parent opens the file from the e-mail link');
ok(!(await pg.isVisible('#create')), 'parent does not see "Start my application"');
ok(/Approve as parent/.test(await pg.textContent('#d-actions')), 'parent can approve');
await pg.click('#d-actions .btn'); await settle();
ok(/review the current version/.test(await msgText()), 'parent must tick "reviewed"');
await pg.check('#a-reviewed'); await pg.click('#d-actions .btn'); await settle();
ok(/Awaiting club president/.test(await pg.textContent('#d-status')), 'parent approved → club president');
ok(/Parent \/ guardian/.test(await pg.textContent('#d-sigs')), 'parent approval listed as a signature');

// ===== président : copie club uniquement =====
await login('pres@x.be', '?d=' + DID);
const pfiles = await pg.$$eval('#d-files li', l => l.map(x => x.textContent));
ok(pfiles.length >= 1 && pfiles.every(x => /club copy/.test(x)), 'president sees only club copies: ' + pfiles.length);
ok(/You have the club copy/.test(await pg.textContent('#d-check')), 'president told what the club copy contains');
ok(!(await pg.isVisible('#d-upload')), 'president cannot upload');
ok(/club copy/.test(await pg.textContent('#d-actions .chk')), 'president reviews the club copy');
await pg.click('#d-files li:first-child .lnk'); await settle();
ok(/\/club\//.test(await pg.evaluate(() => window.__DL || '')), 'president downloads the club copy');
await login('pres@x.be', '?d=' + DID);
await pg.check('#a-reviewed'); await pg.click('#d-actions .btn'); await settle();
ok(/Awaiting district coordinator/.test(await pg.textContent('#d-status')), 'president signed the club copy');

// ===== coordinateur : double authentification =====
await login('coorda@x.be', '?d=' + DID);
ok(await pg.isVisible('#mfa'), 'coordinator asked for two-step verification');
ok(!(await pg.isVisible('#work')), 'work hidden until verified');
ok(await pg.isVisible('#mfa-setup') && /^data:image\/svg/.test(await pg.getAttribute('#mfa-qr', 'src')), 'first time: QR code to enrol');
await pg.fill('#mfa-code', '000000'); await pg.click('#mfa .btn'); await settle();
ok(/Wrong or expired code/.test(await msgText()) && !(await pg.isVisible('#work')), 'wrong code refused');
await pg.fill('#mfa-code', '123456'); await pg.click('#mfa .btn'); await pg.waitForTimeout(900);
ok(await pg.isVisible('#work') && !(await pg.isVisible('#mfa')), 'verified: work shown');
ok(await pg.isVisible('#dossier'), 'deep link opens after verification');
ok((await pg.$$eval('#d-files li', l => l.length)) >= 4, 'coordinator sees full files and club copies');
await pg.check('#a-reviewed'); await pg.click('#d-actions .btn'); await settle();
ok(/Awaiting national/.test(await pg.textContent('#d-status')), 'district validated');
// session suivante : code seulement, pas de nouveau QR
await pg.evaluate(() => localStorage.setItem('fake-aal-coorda@x.be', 'aal1'));
const enrolledBefore = await pg.evaluate(() => window.__ENROLLED || 0);
await login('coorda@x.be');
ok(await pg.isVisible('#mfa') && !(await pg.isVisible('#mfa-setup')), 'next sign-in: only the code is asked');

// ===== national =====
await login('nat@x.be', '?d=' + DID);
await pg.fill('#mfa-code', '123456'); await pg.click('#mfa .btn'); await pg.waitForTimeout(900);
await pg.check('#a-reviewed'); await pg.click('#d-actions .btn'); await settle();
await pg.click('#d-actions .btn'); await settle();
await pg.click('#d-actions button:has-text("Accepted")'); await settle();
ok(/Accepted/.test(await pg.textContent('#d-status')), 'accepted by the host country');
const roles = await pg.$$eval('#d-sigs li', l => l.map(x => x.textContent.split('—')[0].replace('✍', '').trim()));
ok(roles.join('|') === 'Parent / guardian|Club president|District coordinator|National YCE team', 'full signature chain: ' + roles.join(' | '));

// ===== administrateur =====
await login('admin@x.be');
ok(await pg.isVisible('#mfa'), 'administrator also needs two-step verification');
await pg.fill('#mfa-code', '123456'); await pg.click('#mfa .btn'); await pg.waitForTimeout(900);
ok(await pg.isVisible('#admin') && (await pg.$$eval('#staff-list tr', r => r.length)) === 4, 'admin sees the team after verification');

// ===== copie club : cellules sensibles effacées (y compris dans les textes partagés d'Excel) =====
await login('kid2@x.be');
const red = await pg.evaluate(async () => {
  const af = await (await fetch('Application_form_2026_MD112.xlsx')).arrayBuffer();
  const e = await unzip(af);
  const sh = e.find(x => x.name === 'xl/worksheets/sheet1.xml');
  let xml = new TextDecoder().decode(sh.data);
  [['F16', 'Doe'], ['S16', 'Jane'], ['X22', 'PASS-123456'], ['G23', '2030-01-01'], ['X45', 'Asthma'], ['K42', 'Good'], ['X47', 'Halal']].forEach(c => { xml = setCell(xml, c[0], c[1]); });
  // religion saisie dans Excel : texte partagé
  const sst = e.find(x => x.name === 'xl/sharedStrings.xml');
  let s = new TextDecoder().decode(sst.data);
  const idx = (s.match(/<si>/g) || []).length;
  s = s.replace('</sst>', '<si><t>SecretReligion</t></si></sst>');
  xml = xml.replace(/<c r="J31"([^>]*?)(\/>|>[\s\S]*?<\/c>)/, (m0, a) => '<c r="J31"' + a.replace(/ t="[^"]*"/, '') + ' t="s"><v>' + idx + '</v></c>');
  const pre = /PASS-123456/.test(xml) && /Asthma/.test(xml) && /Halal/.test(xml) && /<c r="J31"[^>]*t="s"><v>/.test(xml) && /SecretReligion/.test(s);
  sh.data = new TextEncoder().encode(xml); sst.data = new TextEncoder().encode(s);
  const afFilled = new Uint8Array(await (await buildZip(e)).arrayBuffer());
  const dossier = await buildZip([{ name: 'Application_form_2027_112A_Doe_Jane.xlsx', data: afFilled }, { name: 'Commitment_x.docx', data: new Uint8Array([1]) }, { name: 'ID_document_x.pdf', data: new Uint8Array([2]) }], 'application/zip');
  const club = await buildClubCopy(await dossier.arrayBuffer());
  const ce = await unzip(await club.arrayBuffer());
  const caf = ce.find(x => /CLUB-COPY/.test(x.name));
  const ie = await unzip(caf.data.buffer.slice(caf.data.byteOffset, caf.data.byteOffset + caf.data.byteLength));
  const cx = new TextDecoder().decode(ie.find(x => x.name === 'xl/worksheets/sheet1.xml').data);
  const cs = new TextDecoder().decode(ie.find(x => x.name === 'xl/sharedStrings.xml').data);
  const v = r => { const m = cx.match(new RegExp('<c r="' + r + '"[^>]*?(?:/>|>([\\s\\S]*?)</c>)')); return m ? (m[1] || '').replace(/<[^>]+>/g, '') : null; };
  return { pre, names: ce.map(x => x.name), F16: v('F16'), S16: v('S16'), X22: v('X22'), G23: v('G23'), X45: v('X45'), K42: v('K42'), X47: v('X47'), J31: v('J31'),
    sstLeak: /SecretReligion/.test(cs), xmlLeak: /PASS-123456|Asthma|Halal/.test(cx) };
});
ok(red.pre === true, 'test dossier really contained the sensitive values before reduction');
ok(red.F16 === 'Doe' && red.S16 === 'Jane', 'club copy keeps the candidate identity');
ok(!red.X22 && !red.G23 && !red.X45 && !red.K42 && !red.X47 && !red.J31, 'ID, health and religion cells emptied: ' + JSON.stringify(red));
ok(!red.sstLeak && !red.xmlLeak, 'no sensitive text left anywhere in the club copy (incl. Excel shared strings)');
ok(red.names.length === 2 && !red.names.some(n => /ID_document/.test(n)), 'ID scan not in the club copy');

// ===== mobile =====
await pg.setViewportSize({ width: 390, height: 844 });
await login('mum@x.be', '?d=' + DID);
ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'no horizontal scroll on mobile');
await pg.screenshot({ path: FIX + '/vault_mobile.png' });

await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
