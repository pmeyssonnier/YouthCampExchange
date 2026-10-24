// Règles d'accès et circuit du coffre (supabase/vault_schema.sql) sur PostgreSQL 16 (PGlite),
// avec les rôles et fonctions de Supabase reproduits : anon/authenticated, auth.jwt() (dont « aal »), storage.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { ROOT, checker } from './helpers.mjs';

const t = checker('vault schema');
const ok = t.ok;
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

// session : email + niveau d'authentification (aal2 = double authentification vérifiée)
async function as(email, aal = 'aal1') {
  await db.exec('reset role');
  if (email === null) { await db.exec(`set role anon; select set_config('request.jwt.claims','',false)`); return; }
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, aal, role: 'authenticated' })}', false)`);
}
const asStaff = e => as(e, 'aal2');
const q = async (sql, p) => (await db.query(sql, p)).rows;
const err = async (sql, p) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };
const root = async () => db.exec('reset role');

await root();
await db.exec(`insert into staff (email, role, district) values
  ('admin@x.be','admin',null), ('nat@x.be','national',null),
  ('coorda@x.be','district','A'), ('coordb@x.be','district','B')`);

const FULL = ['Application_form_2027_112A_Doe_Jane.xlsx', 'Commitment_to_Reciprocity_2027_112A_Doe_Jane.docx', 'Pass_photo_2027.jpg',
  'Payment_proof_2027.pdf', 'ID_document_2027.pdf', 'Letter_to_Host_Family_2027.pdf'];
const h = c => c.repeat(64);
let n = 0;
async function upFull(did, sha, contents = FULL) {
  const p = `${did}/full/${++n}.zip`;
  await q(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [p]);
  await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes,contents) values ($1,'zip',$2,'d.zip',$3,10,$4)`, [did, p, sha, contents]);
}
async function upClub(did, sha, source) {
  const p = `${did}/club/${++n}.zip`;
  await q(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [p]);
  await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes,source_sha) values ($1,'club',$2,'club.zip',$3,5,$4)`, [did, p, sha, source]);
}
const adultBirth = '2000-05-01';
const minorBirth = new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10);

// ================= candidat majeur =================
await as('cand@x.be');
ok(/candidate_birth_date/.test(await err(`insert into dossiers (season,candidate_name,district,consent_at,consent_version) values ('2026-2027','Jane Doe','A',now(),'v2')`) || ''), 'birth date required');
ok((await err(`insert into dossiers (season,candidate_name,candidate_birth_date,district,parent_email,consent_at,consent_version) values ('2026-2027','Jane Doe',$1,'A','cand@x.be',now(),'v2')`, [adultBirth])) !== null, 'candidate cannot be their own parent');
ok((await err(`insert into dossiers (season,candidate_name,candidate_birth_date,district,president_email,consent_at,consent_version) values ('2026-2027','Jane Doe',$1,'A','cand@x.be',now(),'v2')`, [adultBirth])) !== null, 'candidate cannot be their own president');
const [d] = await q(`insert into dossiers (season,candidate_name,candidate_birth_date,president_email,district,consent_at,consent_version)
  values ('2026-2027','Jane Doe',$1,'pres@x.be','A',now(),'v2') returning *`, [adultBirth]);
const DID = d.id;
ok(d.purge_after.toISOString().startsWith('2029-08-3'), 'retention: 2 years after the season');
ok((await err(`update dossiers set status='accepted' where id=$1`, [DID])) !== null, 'status cannot be changed directly');
ok(/ZIP/.test(await err(`select dossier_transition($1,'submitted')`, [DID]) || ''), 'submit needs a ZIP');

// fichiers : chemins full/ et club/ obligatoires
ok((await err(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [DID + '/x.zip'])) !== null, 'storage path must be full/ or club/');
ok((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'x',$3,1)`, [DID, DID + '/club/x.zip', h('a')])) !== null, 'file kind must match its folder');
ok((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'club',$2,'x',$3,1)`, [DID, DID + '/club/x.zip', h('a')])) !== null, 'club copy must name its source');
ok((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'x',$3,1)`, [DID, 'not-a-uuid/full/x.zip', h('a')])) !== null, 'malformed dossier id in path refused');
ok((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'x',$3,1)`, [DID, DID + '/other/x.zip', h('a')])) !== null, 'unknown folder in path refused');
ok((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$2,'x',$3,1)`, [DID, DID + '/full/x.zip', 'nothex'])) !== null, 'invalid fingerprint refused');

await upFull(DID, h('a'), FULL.filter(f => !/ID_document|Letter/.test(f)));
let m = await err(`select dossier_transition($1,'submitted')`, [DID]) || '';
ok(/Passport \/ ID scan/.test(m) && /Letter to the host family/.test(m) && /Club copy/.test(m), 'submit lists missing documents: ' + m);
await upFull(DID, h('b'));
m = await err(`select dossier_transition($1,'submitted')`, [DID]) || '';
ok(/Club copy/.test(m) && !/Passport/.test(m), 'complete file still needs its club copy: ' + m);
await upClub(DID, h('c'), h('a'));
ok(/Club copy/.test(await err(`select dossier_transition($1,'submitted')`, [DID]) || ''), 'club copy of an older version is refused');
await upClub(DID, h('d'), h('b'));
ok(/only needed for a candidate under 18/.test(await err(`select dossier_transition($1,'parent_review')`, [DID]) || ''), 'adult does not go through the parent');
ok((await q(`select dossier_transition($1,'submitted') s`, [DID]))[0].s === 'submitted', 'adult candidate submits');

// président : la copie club uniquement
await as('pres@x.be');
ok((await q(`select id from dossiers`)).length === 1, 'president sees the file');
const pf = await q(`select kind from dossier_files where dossier_id=$1`, [DID]);
ok(pf.length === 2 && pf.every(f => f.kind === 'club'), 'president lists only club copies');
const po = await q(`select name from storage.objects`);
ok(po.length === 2 && po.every(o => o.name.includes('/club/')), 'president can read only club copies in storage');
ok((await err(`insert into storage.objects (bucket_id,name) values ('dossiers',$1)`, [DID + '/full/p.zip'])) !== null, 'president cannot upload');
ok(/latest club copy/.test(await err(`select dossier_transition($1,'club_signed',null,$2)`, [DID, h('b')]) || ''), 'president signs the club copy, not the full file');
ok((await q(`select dossier_transition($1,'club_signed',null,$2) s`, [DID, h('d')]))[0].s === 'club_signed', 'president signs the current club copy');

// double authentification
await as('coorda@x.be', 'aal1');
ok((await q(`select id from dossiers`)).length === 0, 'coordinator without MFA sees nothing');
ok((await err(`select dossier_transition($1,'district_validated',null,$2)`, [DID, h('b')])) !== null, 'coordinator without MFA cannot validate');
ok((await q(`select * from my_roles()`)).length === 1, 'my_roles() still tells the UI to ask for MFA');
await asStaff('coorda@x.be');
ok((await q(`select kind from dossier_files where dossier_id=$1`, [DID])).length === 4, 'coordinator with MFA sees the full file');
ok((await q(`select dossier_transition($1,'district_validated',null,$2) s`, [DID, h('b')]))[0].s === 'district_validated', 'coordinator with MFA validates the full file');
await asStaff('coordb@x.be');
ok((await q(`select id from dossiers`)).length === 0, 'other district sees nothing');
await asStaff('nat@x.be');
await q(`select dossier_transition($1,'national_validated',null,$2)`, [DID, h('b')]);
await q(`select dossier_transition($1,'sent_host')`, [DID]);
await q(`select dossier_transition($1,'accepted')`, [DID]);
ok((await q(`select signer_role from signatures where dossier_id=$1 order by signed_at`, [DID])).map(r => r.signer_role).join() === 'president,district,national', 'signature chain recorded');
ok((await q(`select count(*)::int n from events where dossier_id=$1 and action='status'`, [DID]))[0].n === 6, 'every step in the audit log');
await as('admin@x.be', 'aal1');
ok((await err(`insert into staff (email,role,district) values ('x@x.be','district','C')`)) !== null, 'admin without MFA cannot change the team');
await asStaff('admin@x.be');
await q(`insert into staff (email,role,district) values ('coordc@x.be','district','C')`);
ok((await q(`select * from staff`)).length === 5, 'admin with MFA manages the team');
ok((await q(`select id from dossiers`)).length === 0, 'admin does not see application content');
await as(null);
ok((await err(`select id from dossiers`)) !== null || (await q(`select id from dossiers`)).length === 0, 'anonymous sees nothing');

// ================= candidat mineur : approbation parentale =================
await as('kid@x.be');
const [k] = await q(`insert into dossiers (season,candidate_name,candidate_birth_date,president_email,district,consent_at,consent_version)
  values ('2026-2027','Kid Roe',$1,'pres@x.be','B',now(),'v2') returning id`, [minorBirth]);
const KID = k.id;
await upFull(KID, h('1')); await upClub(KID, h('2'), h('1'));
ok(/under 18/.test(await err(`select dossier_transition($1,'submitted')`, [KID]) || ''), 'minor cannot skip the parent');
ok(/parent or guardian e-mail is required/.test(await err(`select dossier_transition($1,'parent_review')`, [KID]) || ''), 'minor needs a parent e-mail');
await q(`update dossiers set parent_email='mum@x.be' where id=$1`, [KID]);
await q(`select dossier_transition($1,'parent_review')`, [KID]);
await as('pres@x.be');
ok(!(await q(`select id from dossiers`)).some(r => r.id === KID), 'president does not see a file awaiting the parent');
await as('mum@x.be');
ok((await q(`select kind from dossier_files where dossier_id=$1`, [KID])).length === 2, 'parent sees the full file');
ok(/comment is required/.test(await err(`select dossier_transition($1,'draft')`, [KID]) || ''), 'parent must explain a send-back');
await q(`select dossier_transition($1,'draft','Please fix the phone number')`, [KID]);
await as('kid@x.be');
ok((await q(`select status from dossiers where id=$1`, [KID]))[0].status === 'draft', 'parent sent the file back');
await upFull(KID, h('3')); await upClub(KID, h('4'), h('3'));
await q(`select dossier_transition($1,'parent_review')`, [KID]);
await as('mum@x.be');
ok(/latest ZIP/.test(await err(`select dossier_transition($1,'submitted',null,$2)`, [KID, h('1')]) || ''), 'parent must approve the current version');
await q(`select dossier_transition($1,'submitted',null,$2)`, [KID, h('3')]);
ok((await q(`select signer_role,doc_sha256 from signatures where dossier_id=$1`, [KID]))[0].signer_role === 'parent', 'parent approval recorded as a signature');
await as('pres@x.be');
ok((await q(`select id from dossiers`)).some(r => r.id === KID), 'president sees it after parental approval');

// refus → 90 jours ; purge
await asStaff('nat@x.be');
await as('pres@x.be'); await q(`select dossier_transition($1,'club_signed',null,$2)`, [KID, h('4')]);
await asStaff('coordb@x.be'); await q(`select dossier_transition($1,'district_validated',null,$2)`, [KID, h('3')]);
await asStaff('nat@x.be');
await q(`select dossier_transition($1,'national_validated',null,$2)`, [KID, h('3')]);
await q(`select dossier_transition($1,'sent_host')`, [KID]);
await q(`select dossier_transition($1,'refused','No place left')`, [KID]);
const days = Math.round(((await q(`select purge_after from dossiers where id=$1`, [KID]))[0].purge_after - new Date(new Date().toDateString())) / 864e5);
ok(days >= 89 && days <= 91, 'refused → purge in 90 days (' + days + ')');
await root(); await db.query(`update dossiers set purge_after=current_date-1 where id=$1`, [DID]);
await asStaff('coorda@x.be'); ok((await err(`select dossier_purge($1)`, [DID])) !== null, 'coordinator cannot purge');
await as('nat@x.be', 'aal1'); ok((await q(`select * from purge_candidates()`)).length === 0, 'national without MFA cannot purge');
await asStaff('nat@x.be');
const pc = await q(`select * from purge_candidates()`);
ok(pc.length === 1 && pc[0].paths.length === 4, 'expired file listed with its full and club copies');
await q(`delete from storage.objects where name like $1`, [DID + '/%']);
await q(`select dossier_purge($1)`, [DID]);
await root();
ok((await q(`select count(*)::int n from dossiers where id=$1`, [DID]))[0].n === 0, 'purged');
ok((await q(`select count(*)::int n from purge_log where dossier_id=$1`, [DID]))[0].n === 1, 'purge traced without personal data');

// brouillon jamais envoyé : le candidat peut le supprimer
await as('cand3@x.be');
const [d3] = await q(`insert into dossiers (season,candidate_name,candidate_birth_date,district,consent_at,consent_version) values ('2026-2027','Ann Lee',$1,'C',now(),'v2') returning id`, [adultBirth]);
await q(`delete from dossiers where id=$1`, [d3.id]);
ok((await q(`select id from dossiers where id=$1`, [d3.id])).length === 0, 'candidate can withdraw an unsent draft');

process.exit(t.done() ? 1 : 0);
