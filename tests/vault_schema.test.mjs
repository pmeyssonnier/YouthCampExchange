import { ROOT } from './helpers.mjs';
// Teste supabase/vault_schema.sql sur PostgreSQL 16 (PGlite) avec les rôles et
// helpers de Supabase reproduits : anon/authenticated, auth.jwt(), storage.*.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const db = new PGlite();
const SQL = fs.readFileSync(ROOT + '/supabase/vault_schema.sql', 'utf8');

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
await db.exec(SQL);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } };
async function as(email) {
  await db.exec('reset role');
  if (email === null) { await db.exec(`set role anon; select set_config('request.jwt.claims','',false)`); return; }
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false)`);
}
async function q(sql, params) { return (await db.query(sql, params)).rows; }
async function err(sql, params) { try { await db.query(sql, params); return null; } catch (e) { return e.message; } }
const asAdminDb = async () => { await db.exec('reset role'); };

// --- intervenants (créés par l'administrateur via l'éditeur SQL) ---
await asAdminDb();
await db.exec(`insert into staff (email, role, district) values
  ('admin@x.be','admin',null), ('nat@x.be','national',null),
  ('coorda@x.be','district','A'), ('coordb@x.be','district','B')`);

const SHA1 = 'a'.repeat(64), SHA2 = 'b'.repeat(64);

// --- création du dossier par le candidat ---
await as('cand@x.be');
const [d] = await q(`insert into dossiers (season, candidate_name, president_email, parent_email, district, club, consent_at, consent_version)
  values ('2026-2027','Jane Doe','pres@x.be','parent@x.be','A','Lions Club Test', now(), 'v1') returning *`);
ok(d.candidate_email === 'cand@x.be', 'candidate_email forced from JWT');
ok(String(d.purge_after.toISOString()).startsWith('2029-08-3'), 'purge 2 years after season end: ' + d.purge_after.toISOString());
ok(d.status === 'draft', 'starts as draft');
const DID = d.id;

ok((await err(`insert into dossiers (season, candidate_name, district, consent_at, consent_version, status)
  values ('2026-2027','X Y','A', now(), 'v1','submitted')`)) !== null, 'cannot insert with a status');
ok((await err(`insert into dossiers (season, candidate_name, district, consent_at, consent_version, candidate_email)
  values ('2026-2027','X Y','A', now(), 'v1','victim@x.be')`)) !== null, 'cannot insert for another e-mail');
ok((await err(`update dossiers set status='accepted' where id=$1`, [DID])) !== null, 'cannot update status directly');
ok((await err(`update dossiers set purge_after='2099-01-01' where id=$1`, [DID])) !== null, 'cannot change retention');
await q(`update dossiers set club='Lions Club Brussels' where id=$1`, [DID]);
ok((await q(`select club from dossiers where id=$1`, [DID]))[0].club === 'Lions Club Brussels', 'candidate edits draft');

// brouillon invisible pour les autres
for (const who of ['pres@x.be', 'coorda@x.be', 'nat@x.be', 'other@x.be', 'admin@x.be']) {
  await as(who); ok((await q(`select id from dossiers`)).length === 0, who + ' cannot see a draft');
}
await as('parent@x.be'); ok((await q(`select id from dossiers`)).length === 1, 'parent sees the draft');

// envoi sans ZIP refusé
await as('cand@x.be');
ok(/ZIP/.test(await err(`select dossier_transition($1,'submitted')`, [DID]) || ''), 'submit requires a ZIP');

// dépôt de fichier : autorisé au candidat, refusé aux autres
await as('other@x.be');
ok((await err(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [DID + '/x.zip'])) !== null, 'stranger cannot upload to storage');
ok((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'x.zip',$3,10)`, [DID, DID + '/x.zip', SHA1])) !== null, 'stranger cannot register a file');
await as('cand@x.be');
await q(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [DID + '/v1.zip']);
await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'v1.zip',$3,1000)`, [DID, DID + '/v1.zip', SHA1]);
ok((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'bad.zip',$3,1)`, [DID, 'ffffffff-0000-0000-0000-000000000000/bad.zip', SHA1])) !== null, 'file path must live in its dossier folder');
ok((await q(`select action from events where dossier_id=$1`, [DID])).some(e => e.action === 'upload'), 'upload logged automatically');
ok((await err(`insert into events (dossier_id, action) values ($1,'fake')`, [DID])) !== null, 'cannot forge audit events');

// envoi
ok((await q(`select dossier_transition($1,'submitted') s`, [DID]))[0].s === 'submitted', 'candidate submits');

// visibilité après envoi
await as('pres@x.be'); ok((await q(`select id from dossiers`)).length === 1, 'president sees submitted file');
await as('coorda@x.be'); ok((await q(`select id from dossiers`)).length === 1, 'district A coordinator sees it');
await as('coordb@x.be'); ok((await q(`select id from dossiers`)).length === 0, 'district B coordinator does not');
await as('nat@x.be'); ok((await q(`select id from dossiers`)).length === 1, 'national sees it');
await as('admin@x.be'); ok((await q(`select id from dossiers`)).length === 0, 'admin does not see content');
await as('other@x.be'); ok((await q(`select id from dossiers`)).length === 0, 'stranger does not');
await as(null); ok((await err(`select id from dossiers`)) !== null || (await q(`select id from dossiers`)).length === 0, 'anonymous sees nothing');
await as('other@x.be'); ok((await q(`select id from storage.objects`)).length === 0, 'stranger cannot list stored files');
await as('coorda@x.be'); ok((await q(`select id from storage.objects`)).length === 1, 'coordinator can read stored file');

// ordre des étapes imposé
await as('coorda@x.be');
ok(/not allowed/.test(await err(`select dossier_transition($1,'district_validated',null,$2)`, [DID, SHA1]) || ''), 'district cannot validate before club');
await as('pres@x.be');
ok(/latest ZIP/.test(await err(`select dossier_transition($1,'club_signed',null,$2)`, [DID, SHA2]) || ''), 'signature must match latest ZIP');
ok((await q(`select dossier_transition($1,'club_signed',null,$2) s`, [DID, SHA1]))[0].s === 'club_signed', 'president signs');
ok((await q(`select * from signatures where dossier_id=$1`, [DID])).length === 1, 'signature recorded');
ok((await err(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [DID + '/late.zip'])) !== null, 'president cannot upload after signing');

// renvoi pour correction
await as('coorda@x.be');
ok(/comment is required/.test(await err(`select dossier_transition($1,'draft')`, [DID]) || ''), 'send back requires a comment');
await q(`select dossier_transition($1,'draft','Photo is blurry, please replace it')`, [DID]);
await as('cand@x.be');
ok((await q(`select status from dossiers where id=$1`, [DID]))[0].status === 'draft', 'back to draft');
ok((await q(`select body from comments where dossier_id=$1`, [DID]))[0].body.includes('blurry'), 'candidate sees the comment');
await as('pres@x.be'); ok((await q(`select id from dossiers`)).length === 1, 'president keeps sight of a returned file');

// nouvelle version, nouveau circuit complet
await as('cand@x.be');
await q(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [DID + '/v2.zip']);
await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'v2.zip',$3,1200)`, [DID, DID + '/v2.zip', SHA2]);
await q(`select dossier_transition($1,'submitted')`, [DID]);
await as('pres@x.be');
ok(/latest ZIP/.test(await err(`select dossier_transition($1,'club_signed',null,$2)`, [DID, SHA1]) || ''), 'old version can no longer be signed');
await q(`select dossier_transition($1,'club_signed',null,$2)`, [DID, SHA2]);
await as('coorda@x.be'); await q(`select dossier_transition($1,'district_validated',null,$2)`, [DID, SHA2]);
await as('coordb@x.be');
ok((await err(`select dossier_transition($1,'national_validated',null,$2)`, [DID, SHA2])) !== null, 'other coordinator cannot act');
await as('nat@x.be');
await q(`select dossier_transition($1,'national_validated',null,$2)`, [DID, SHA2]);
await q(`select dossier_transition($1,'sent_host')`, [DID]);
await q(`select dossier_transition($1,'accepted')`, [DID]);
let row = (await q(`select status, purge_after from dossiers where id=$1`, [DID]))[0];
ok(row.status === 'accepted' && row.purge_after.toISOString().startsWith('2029-08-3'), 'accepted keeps 2-year retention');
ok((await q(`select step from signatures where dossier_id=$1 order by signed_at`, [DID])).length === 4, '4 signatures in history');
ok((await q(`select count(*)::int n from events where dossier_id=$1 and action='status'`, [DID]))[0].n === 9, 'every step in the audit log');

// refus → 90 jours
await as('cand2@x.be');
const [d2] = await q(`insert into dossiers (season, candidate_name, president_email, district, consent_at, consent_version)
  values ('2026-2027','John Roe','pres@x.be','B', now(), 'v1') returning id`);
await q(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [d2.id + '/a.zip']);
await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'a.zip',$3,5)`, [d2.id, d2.id + '/a.zip', SHA1]);
await q(`select dossier_transition($1,'submitted')`, [d2.id]);
await as('pres@x.be'); ok((await q(`select id from dossiers`)).length === 2, 'president sees both of his candidates');
await q(`select dossier_transition($1,'club_signed',null,$2)`, [d2.id, SHA1]);
await as('coordb@x.be'); await q(`select dossier_transition($1,'district_validated',null,$2)`, [d2.id, SHA1]);
await as('nat@x.be');
await q(`select dossier_transition($1,'national_validated',null,$2)`, [d2.id, SHA1]);
await q(`select dossier_transition($1,'sent_host')`, [d2.id]);
await q(`select dossier_transition($1,'refused','No place left in the camp')`, [d2.id]);
row = (await q(`select purge_after from dossiers where id=$1`, [d2.id]))[0];
const days = Math.round((row.purge_after - new Date(new Date().toDateString())) / 864e5);
ok(days >= 89 && days <= 91, 'refused → purge in 90 days (' + days + ')');

// purge
ok((await q(`select is_purgeable($1) p`, [DID]))[0].p === false, 'not purgeable before term');
ok((await err(`select dossier_purge($1)`, [DID])) !== null, 'purge refused before term');
await asAdminDb(); await db.query(`update dossiers set purge_after = current_date - 1 where id=$1`, [DID]);
await as('coorda@x.be'); ok((await err(`select dossier_purge($1)`, [DID])) !== null, 'coordinator cannot purge');
await as('nat@x.be');
ok((await q(`select is_purgeable($1) p`, [DID]))[0].p === true, 'purgeable after term');
await q(`delete from storage.objects where name like $1`, [DID + '/%']);
await q(`select dossier_purge($1)`, [DID]);
await asAdminDb();
ok((await q(`select count(*)::int n from dossiers where id=$1`, [DID]))[0].n === 0, 'dossier deleted');
ok((await q(`select count(*)::int n from events where dossier_id=$1`, [DID]))[0].n === 0, 'its history deleted too');
ok((await q(`select count(*)::int n from storage.objects where name like $1`, [DID + '/%']))[0].n === 0, 'its files deleted');
ok((await q(`select count(*)::int n from purge_log where dossier_id=$1`, [DID]))[0].n === 1, 'purge traced without personal data');

// brouillon abandonné, jamais envoyé : invisible pour le national, mais purgeable à échéance
await as('cand4@x.be');
const [d4] = await q(`insert into dossiers (season, candidate_name, district, consent_at, consent_version) values ('2026-2027','Old Draft','D', now(), 'v1') returning id`);
await q(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [d4.id + '/z.zip']);
await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes,contents) values ($1,'zip',$2,'z.zip',$3,5,'{a.xlsx,Pass_photo_x.jpg}')`, [d4.id, d4.id + '/z.zip', SHA1]);
ok((await q(`select contents from dossier_files where dossier_id=$1`, [d4.id]))[0].contents.length === 2, 'ZIP contents stored for the checklist');
await as('nat@x.be');
ok((await q(`select * from dossiers where id=$1`, [d4.id])).length === 0, 'national does not see an unsent draft');
ok((await q(`select * from purge_candidates()`)).length === 0, 'nothing to purge before term');
await asAdminDb(); await db.query(`update dossiers set purge_after = current_date - 1 where id=$1`, [d4.id]);
await as('nat@x.be');
const pc = await q(`select * from purge_candidates()`);
ok(pc.length === 1 && pc[0].paths.length === 1, 'expired abandoned draft listed with its files');
ok((await q(`select id from storage.objects where name=$1`, [d4.id + '/z.zip'])).length === 1, 'national can read expired files to delete them');
await q(`delete from storage.objects where name=$1`, [d4.id + '/z.zip']);
await q(`select dossier_purge($1)`, [d4.id]);
await asAdminDb();
ok((await q(`select count(*)::int n from dossiers where id=$1`, [d4.id]))[0].n === 0, 'abandoned draft purged');
await as('coorda@x.be');
ok((await q(`select * from purge_candidates()`)).length === 0, 'only national lists purge candidates');

// gestion des intervenants
await as('coorda@x.be');
ok((await q(`select * from staff`)).length === 1, 'coordinator only sees own staff row');
ok((await err(`insert into staff (email, role, district) values ('hack@x.be','national',null)`)) !== null, 'coordinator cannot grant roles');
ok((await q(`select * from my_roles()`))[0].district === 'A', 'my_roles() works');
await as('admin@x.be');
await q(`insert into staff (email, role, district) values ('coordc@x.be','district','C')`);
ok((await q(`select * from staff`)).length === 5, 'admin manages staff');

// retrait d'un brouillon jamais envoyé
await as('cand3@x.be');
const [d3] = await q(`insert into dossiers (season, candidate_name, district, consent_at, consent_version) values ('2026-2027','Ann Lee','C', now(), 'v1') returning id`);
await q(`delete from dossiers where id=$1`, [d3.id]);
ok((await q(`select id from dossiers where id=$1`, [d3.id])).length === 0, 'candidate can withdraw an unsent draft');
ok((await err(`insert into dossiers (season, candidate_name, district, consent_at, consent_version) values ('2026-2027','Ann Lee','C', now(), 'v1')`)) === null, 'can recreate');
ok((await err(`insert into dossiers (season, candidate_name, district, consent_at, consent_version) values ('2026-2027','Ann Lee','C', now(), 'v1')`)) !== null, 'only one file per candidate and season');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
