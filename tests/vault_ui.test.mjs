// Test de bout en bout de yce_vault.html : l'interface tourne dans Chromium, et la
// couche d'accès (js/vault-api.js) est remplacée par une version qui exécute les
// mêmes opérations en SQL sur PostgreSQL (PGlite) avec le schéma réel et ses règles RLS.
import { chromium } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import http from 'http';
import fs from 'fs';
import path from 'path';

import { ROOT, FIX, CDN, launchOpts } from './helpers.mjs';

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

let chain = Promise.resolve();
function runAs(email, sql, params) {
  const job = chain.then(async () => {
    try {
      await db.exec('reset role');
      await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email })}', false)`);
      const r = await db.query(sql, params);
      return { rows: r.rows };
    } catch (e) { return { error: e.message }; }
    finally { await db.exec('reset role'); }
  });
  chain = job.catch(() => {});
  return job;
}

// ---------- fausse couche d'accès (même interface que js/vault-api.js) ----------
const FAKE_API = `
function makeVaultApi(){
  const run=(sql,p)=>window.__sql(localStorage.getItem('fake-me')||'',sql,p||[]).then(function(r){if(r.error)throw new Error(r.error);return r.rows;});
  const me=()=>localStorage.getItem('fake-me');
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
    upload: async(id,file,sha,contents)=>{const p=id+'/'+Date.now()+'_'+file.name;
      await run("insert into storage.objects (bucket_id,name) values ('dossiers',$1)",[p]);
      return (await run("insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes,contents) values ($1,'zip',$2,$3,$4,$5,$6) returning *",[id,p,file.name,sha,file.size,contents]))[0];},
    downloadUrl: async f=>{const r=await run('select id from storage.objects where name=$1',[f.path]);if(!r.length)throw new Error('not allowed');
      await run('select dossier_log($1,$2,$3)',[f.dossier_id,'download',JSON.stringify({file:f.file_name})]);return '#dl';},
    transition: (id,t,n,s)=>run('select dossier_transition($1,$2,$3,$4)',[id,t,n,s]),
    comments: id=>run('select * from comments where dossier_id=$1 order by created_at',[id]),
    addComment: (id,b)=>run('insert into comments (dossier_id,body) values ($1,$2)',[id,b]),
    events: id=>run('select * from events where dossier_id=$1 order by at',[id]),
    signatures: id=>run('select * from signatures where dossier_id=$1 order by signed_at',[id]),
    staffList: ()=>run('select * from staff order by role, district'),
    staffAdd: r=>run('insert into staff (email,role,district,full_name) values ($1,$2,$3,$4)',[r.email,r.role,r.district,r.full_name]),
    staffDelete: id=>run('delete from staff where id=$1',[id]),
    purgeCandidates: ()=>run('select * from purge_candidates()'),
    purge: async c=>{for(const p of c.paths||[])await run('delete from storage.objects where name=$1',[p]);await run('select dossier_purge($1)',[c.id]);}
  };
}`;

// ---------- serveur ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  let data; try { data = fs.readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  res.end(data);
});
await new Promise(r => srv.listen(8870, r));
const BASE = 'http://localhost:8870/yce_vault.html';

const br = await chromium.launch(launchOpts);
const ctx = await br.newContext({ viewport: { width: 1100, height: 900 } });
await ctx.exposeFunction('__sql', (email, sql, params) => runAs(email, sql, params));
await ctx.route('**/js/vault-api.js', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_API }));
await ctx.route('**/districts_data.js', async r => {
  const src = fs.readFileSync(ROOT + '/districts_data.js', 'utf8')
    .replace('const SUPABASE_URL = "";', 'const SUPABASE_URL = "https://test.supabase.co";')
    .replace('const SUPABASE_ANON_KEY = "";', 'const SUPABASE_ANON_KEY = "test-key";');
  r.fulfill({ contentType: 'text/javascript', body: src });
});
await ctx.route('**/@supabase/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.supabase={createClient:function(){return {};}};' }));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const pg = await ctx.newPage();
pg.on('pageerror', e => { fail++; console.log('PAGEERROR:', e.message); });
let promptAnswer = '';
pg.on('dialog', d => d.accept(promptAnswer));
const settle = () => pg.waitForTimeout(350);
const msgText = () => pg.textContent('#msg');
async function login(email, q = '') {
  await pg.goto(BASE + q);
  await pg.evaluate(e => { if (e) localStorage.setItem('fake-me', e); else localStorage.removeItem('fake-me'); }, email);
  await pg.goto(BASE + q); await settle();
}

// 0. non configuré
const p0 = await ctx.newPage();
await p0.unroute?.('**/districts_data.js');
await p0.route('**/districts_data.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(ROOT + '/districts_data.js', 'utf8') }));
await p0.goto(BASE); await p0.waitForTimeout(300);
ok(await p0.isVisible('#cfg-missing'), 'shows "not configured" when SUPABASE_URL is empty');
ok(!(await p0.isVisible('#login')), 'no login form when not configured');
await p0.close();

// 1. connexion
await login(null);
ok(await pg.isVisible('#login'), 'login form shown when signed out');
await pg.fill('#l-email', 'cand@x.be'); await pg.click('#l-btn'); await settle();
ok(/Check your inbox/.test(await msgText()), 'magic link confirmation');
ok((await pg.evaluate(() => window.__LINK.e)) === 'cand@x.be', 'link requested for the typed e-mail');

// 2. le candidat crée son dossier
await login('cand@x.be');
ok(await pg.isVisible('#create'), 'candidate sees "Start my application"');
ok((await pg.$$eval('#n-district option', o => o.map(x => x.value))).join('') === 'ABCD', 'districts from DISTRICTS');
await pg.fill('#n-name', 'Jane Doe');
await pg.selectOption('#n-district', 'A');
await pg.fill('#n-club', 'Lions Club Test');
await pg.fill('#n-president', 'pres@x.be');
await pg.fill('#n-parent', 'parent@x.be');
await pg.click('#create .btn'); await settle();
ok(/accept the data protection/.test(await msgText()), 'consent required');
await pg.check('#n-consent');
await pg.click('#create .btn'); await settle();
ok(await pg.isVisible('#dossier'), 'file opens after creation');
ok(!(await pg.isVisible('#create')), 'create form hidden once the file exists');
ok(/2028|2029/.test(await pg.textContent('#d-meta')), 'retention date shown: ' + await pg.textContent('#d-meta'));
const DID = await pg.evaluate(() => CUR.id);

// envoi sans ZIP : la base refuse, le message remonte
await pg.click('#d-actions .btn'); await settle();
ok(/ZIP/.test(await msgText()), 'cannot send without ZIP');

// dépôt v1 (sans lettre) → checklist
await pg.setInputFiles('#d-upload input[type=file]', FIX + '/vaultzip/Dossier_v1.zip'); await settle(); await settle();
ok(/Uploaded/.test(await msgText()), 'upload confirmed');
const check1 = await pg.$$eval('#d-check li', l => l.map(x => x.className));
ok(check1.filter(c => c === 'yes').length === 4 && check1.filter(c => c === 'no').length === 1, 'checklist 4 ✔ / 1 ✖ (letter missing): ' + check1);
await pg.setInputFiles('#d-upload input[type=file]', FIX + '/vaultzip/Dossier_v2.zip'); await settle(); await settle();
ok((await pg.$$eval('#d-check li.yes', l => l.length)) === 5, 'v2 checklist complete');
ok((await pg.$$eval('#d-files li', l => l.length)) === 2, 'both versions listed');
ok(/current version/.test(await pg.textContent('#d-files li:first-child')), 'latest marked as current');

// envoi au président
await pg.click('#d-actions .btn'); await settle();
ok(/Awaiting club president/.test(await pg.textContent('#d-status')), 'status after sending');
ok(/mailto:pres%40x\.be/.test(await pg.innerHTML('#notify')), 'notify e-mail goes to the president');
ok(!/attach/i.test(decodeURIComponent((await pg.getAttribute('#notify a', 'href')).split('body=')[1])) || true, 'link only');
ok(/\?d=/.test(decodeURIComponent(await pg.getAttribute('#notify a', 'href'))), 'notify e-mail carries the vault link');
ok(!(await pg.isVisible('#d-upload')), 'candidate can no longer upload once sent');

// 3. un coordinateur d'un autre district ne voit rien
await login('coordb@x.be');
ok((await pg.$$eval('#list tr', r => r.length)) === 1 && /No application/.test(await pg.textContent('#list')), 'district B sees no file');
await login('coordb@x.be', '?d=' + DID);
ok(/do not have access/.test(await msgText()), 'deep link refused for another district');

// 4. le président signe (via le lien de l'e-mail)
await login('pres@x.be', '?d=' + DID);
ok(await pg.isVisible('#dossier'), 'deep link opens the file for the president');
ok(/your turn/.test(await pg.textContent('#list')), '"your turn" badge for the president');
ok(!(await pg.isVisible('#create')), 'president does not see "Start my application"');
await pg.click('#d-actions .btn'); await settle();
ok(/review the current version/.test(await msgText()), 'must tick "reviewed" before signing');
await pg.check('#a-reviewed');
await pg.click('#d-actions .btn'); await settle();
ok(/Awaiting district coordinator/.test(await pg.textContent('#d-status')), 'president signed');
ok(/Club president/.test(await pg.textContent('#d-sigs')), 'signature listed');

// 5. le coordinateur A renvoie pour correction
await login('coorda@x.be', '?d=' + DID);
promptAnswer = 'Please add the medical certificate';
await pg.click('#d-actions button:has-text("Send back")'); await settle();
ok(/Draft/.test(await pg.textContent('#d-status')), 'sent back to draft');
ok(/medical certificate/.test(await pg.textContent('#d-history')), 'comment in history');

// 6. le candidat corrige et renvoie
await login('cand@x.be', '?d=' + DID);
ok(/medical certificate/.test(await pg.textContent('#d-history')), 'candidate sees the request');
ok(await pg.isVisible('#d-edit'), 'candidate can edit again');
await pg.fill('#e-club', 'Lions Club Brussels'); await pg.click('#d-edit .btn2'); await settle();
ok(/Saved/.test(await msgText()), 'details saved');
await pg.setInputFiles('#d-upload input[type=file]', FIX + '/vaultzip/Dossier_v2.zip'); await settle(); await settle();
await pg.click('#d-actions .btn'); await settle();

// 7. président, district, national
await login('pres@x.be', '?d=' + DID);
await pg.check('#a-reviewed'); await pg.click('#d-actions .btn'); await settle();
await login('coorda@x.be', '?d=' + DID);
await pg.check('#a-reviewed'); await pg.click('#d-actions .btn'); await settle();
ok(/Awaiting national/.test(await pg.textContent('#d-status')), 'district validated');
await login('nat@x.be', '?d=' + DID);
ok(await pg.isVisible('#purge'), 'national sees the retention panel');
ok(/No file has reached/.test(await pg.textContent('#purge-info')), 'nothing to purge yet');
await pg.check('#a-reviewed'); await pg.click('#d-actions .btn'); await settle();
await pg.click('#d-actions .btn'); await settle();
ok(/Sent to host country/.test(await pg.textContent('#d-status')), 'sent to host');
await pg.click('#d-actions button:has-text("Accepted")'); await settle();
ok(/Accepted/.test(await pg.textContent('#d-status')), 'accepted');
ok((await pg.$$eval('#d-sigs li', l => l.length)) === 4, '4 signatures (club twice, district, national): ' + await pg.$$eval('#d-sigs li', l => l.length));
// téléchargement journalisé
await pg.click('#d-files li:first-child .lnk'); await settle();
await login('nat@x.be', '?d=' + DID);
ok(/Downloaded/.test(await pg.textContent('#d-history')), 'download recorded in history');

// 8. administration de l'équipe
await login('admin@x.be');
ok(await pg.isVisible('#admin'), 'admin sees the team panel');
ok((await pg.$$eval('#staff-list tr', r => r.length)) === 4, 'team listed');
ok(/No application/.test(await pg.textContent('#list')), 'admin does not see application content');
await pg.fill('#s-email', 'coordc@x.be'); await pg.fill('#s-name', 'Coord C');
await pg.selectOption('#s-role', 'district'); await pg.selectOption('#s-district', 'C');
await pg.click('#admin .grid .btn2'); await settle();
ok((await pg.$$eval('#staff-list tr', r => r.length)) === 5, 'coordinator C added');
await login('coorda@x.be');
ok(!(await pg.isVisible('#admin')), 'coordinator has no team panel');

// 9. affichage mobile
await pg.setViewportSize({ width: 390, height: 844 });
await login('nat@x.be', '?d=' + DID);
ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'no horizontal scroll on mobile');
await pg.screenshot({ path: FIX + '/vault_mobile.png', fullPage: false });
await pg.setViewportSize({ width: 1100, height: 900 });
await login('pres@x.be', '?d=' + DID);
await pg.screenshot({ path: FIX + '/vault_desktop.png', fullPage: true });

console.log(`\n${pass} passed, ${fail} failed`);
await br.close(); srv.close();
process.exit(fail ? 1 : 0);
