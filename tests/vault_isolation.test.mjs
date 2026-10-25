// Isolement des dossiers du coffre (supabase/vault_schema.sql) sur PostgreSQL 16 : un dossier du
// district C n'est visible ni modifiable par personne d'autre que son candidat, son parent, son
// président (copie club seulement), le coordinateur du district C et le national (avec double
// authentification). Chaque accès est tenté par toutes les voies : tables, stockage, fonctions.
import { makeVaultDb, setSession } from './vault_db.mjs';
import fs from 'fs';
import { ROOT, checker } from './helpers.mjs';

const t = checker('vault isolation');
const ok = t.ok;
const db = await makeVaultDb();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const err = async (sql, p) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };
const h = c => c.repeat(64);
const adult = '2000-05-01';
const FULL = ['Application_form.xlsx', 'Commitment_to_Reciprocity.docx', 'Pass_photo.jpg', 'Payment_proof.pdf', 'ID_document.pdf', 'Letter_to_Host_Family.pdf'];

await db.exec('reset role');
await db.exec(`insert into staff (email, role, district) values ('admin@x.be','admin',null), ('nat@x.be','national',null),
  ('coorda@x.be','district','A'), ('coordc@x.be','district','C')`);

// un dossier envoyé par district, avec dossier complet + copie club
let n = 0;
async function dossier(cand, district, pres, parent = null) {
  await setSession(db, cand);
  const [d] = await q(`insert into dossiers (season,candidate_name,candidate_birth_date,president_email,parent_email,district,consent_at,consent_version)
    values ('2026-2027','Test Person',$1,$2,$3,$4,now(),'v2') returning id`, [adult, pres, parent, district]);
  const full = `${d.id}/full/${++n}.zip`, club = `${d.id}/club/${++n}.zip`;
  await q(`insert into storage.objects (bucket_id,name) values ('dossiers',$1),('dossiers',$2)`, [full, club]);
  await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes,contents) values ($1,'zip',$2,'Dossier_Secret_Name.zip',$3,10,$4)`, [d.id, full, h(String(n % 10)), FULL]);
  await q(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes,source_sha) values ($1,'club',$2,'club.zip',$3,5,$4)`, [d.id, club, h('c'), h(String(n % 10))]);
  await q(`select dossier_transition($1,'submitted')`, [d.id]);
  await q(`insert into comments (dossier_id, body) values ($1, 'private note')`, [d.id]);
  return d.id;
}
const DA = await dossier('canda@x.be', 'A', 'presa@x.be');
const DC = await dossier('candc@x.be', 'C', 'presc@x.be');
await setSession(db, 'presc@x.be'); await q(`select dossier_transition($1,'club_signed',null,$2)`, [DC, h('c')]);

// ---- contrôles positifs : les bonnes personnes voient bien le dossier C (sinon le test ne prouverait rien) ----
const sees = async () => (await q(`select id from dossiers where id=$1`, [DC])).length === 1;
await setSession(db, 'candc@x.be'); ok(await sees(), 'control: candidate C sees their own file');
await setSession(db, 'presc@x.be'); ok(await sees() && (await q(`select kind from dossier_files where dossier_id=$1`, [DC])).every(f => f.kind === 'club'), 'control: president C sees the club copy only');
await setSession(db, 'coordc@x.be', 'aal2'); ok(await sees() && (await q(`select id from dossier_files where dossier_id=$1`, [DC])).length === 2, 'control: coordinator C (with MFA) sees the full file');
await setSession(db, 'nat@x.be', 'aal2'); ok(await sees(), 'control: national team (with MFA) sees the file');

// ---- personne d'autre : toutes les voies d'accès au dossier C ----
const OUTSIDERS = [
  ['candidate of district A', 'canda@x.be', 'aal1'],
  ['president of district A', 'presa@x.be', 'aal1'],
  ['coordinator of district A (with MFA)', 'coorda@x.be', 'aal2'],
  ['coordinator of district C without MFA', 'coordc@x.be', 'aal1'],
  ['administrator (with MFA)', 'admin@x.be', 'aal2'],
  ['unconfirmed account using candidate C\'s address', 'candc@x.be', 'aal1', true],
  ['unconfirmed account using coordinator C\'s address, MFA enrolled', 'coordc@x.be', 'aal2', true],
  ['unconfirmed account using president C\'s address', 'presc@x.be', 'aal1', true],
  ['anonymous visitor', null, null],
];
for (const [who, email, aal, unconfirmed] of OUTSIDERS) {
  await setSession(db, email, aal || 'aal1', !!unconfirmed);
  const read = async sql => { const r = await err(sql, [DC]); if (r !== null) return 0; return (await q(sql, [DC])).length; };
  const leaks = [];
  if (await read(`select id from dossiers where id=$1`)) leaks.push('dossier');
  if (await read(`select id from dossier_files where dossier_id=$1`)) leaks.push('file records');
  if (await read(`select id from storage.objects where name like $1::text || '/%'`)) leaks.push('stored files');
  if (await read(`select id from signatures where dossier_id=$1`)) leaks.push('signatures');
  if (await read(`select id from comments where dossier_id=$1`)) leaks.push('comments');
  if (await read(`select id from events where dossier_id=$1`)) leaks.push('history');
  // fonctions appelables par l'API (rpc) : aucune ne doit renvoyer le contenu d'un dossier d'autrui
  for (const fn of [`select (latest_file($1,'zip')).path p`, `select missing_documents($1) m`, `select id_pending($1) p`]) {
    const r = await err(fn, [DC]);
    if (r === null) { const row = (await q(fn, [DC]))[0]; const v = Object.values(row)[0]; if (v !== null && !(Array.isArray(v) && !v.length) && v !== false) leaks.push(/(\w+)\(\$1/.exec(fn)[1] + '()'); }
  }
  ok(!leaks.length, who + ': reads nothing of the district C file' + (leaks.length ? ' — LEAK: ' + leaks.join(', ') : ''));

  const writes = [];
  if ((await err(`insert into comments (dossier_id, body) values ($1, 'x')`, [DC])) === null) writes.push('comment');
  if ((await err(`insert into storage.objects (bucket_id,name) values ('dossiers', $1::text || '/full/evil.zip')`, [DC])) === null) writes.push('storage upload');
  if ((await err(`insert into dossier_files (dossier_id,kind,path,file_name,sha256,size_bytes) values ($1,'zip',$1::text || '/full/e.zip','e',$2,1)`, [DC, h('e')])) === null) writes.push('file record');
  for (const step of ['district_validated', 'national_validated', 'draft', 'refused']) {
    if ((await err(`select dossier_transition($1,$2,'x',$3)`, [DC, step, h('3')])) === null) writes.push('transition ' + step);
  }
  if ((await err(`select dossier_log($1,'download')`, [DC])) === null) writes.push('history entry');
  await err(`update dossiers set district='A', president_email='evil@x.be' where id=$1`, [DC]);
  await err(`delete from dossier_files where dossier_id=$1`, [DC]);
  await err(`delete from storage.objects where name like $1::text || '/%'`, [DC]);
  await err(`delete from dossiers where id=$1`, [DC]);
  await err(`insert into signatures (dossier_id,step,signer_email,signer_role,doc_sha256) values ($1,'district_validated','x','district',$2)`, [DC, h('3')]);
  await db.exec('reset role');
  const st = (await q(`select district, president_email, status from dossiers where id=$1`, [DC]))[0];
  const cnt = (await q(`select (select count(*)::int from dossier_files where dossier_id=$1) f, (select count(*)::int from storage.objects where name like $1::text || '/%') o,
    (select count(*)::int from signatures where dossier_id=$1) s, (select count(*)::int from comments where dossier_id=$1) c`, [DC]))[0];
  if (!st || st.district !== 'C' || st.president_email !== 'presc@x.be' || st.status !== 'club_signed') writes.push('dossier changed or deleted');
  if (cnt.f !== 2 || cnt.o !== 2) writes.push('files deleted or added');
  if (cnt.s !== 1) writes.push('signature forged');
  if (cnt.c !== 1) writes.push('comment added');
  ok(!writes.length, who + ': changes nothing in the district C file' + (writes.length ? ' — BREACH: ' + writes.join(', ') : ''));
}

// ---- créer un dossier au nom de quelqu'un d'autre, ou sans adresse confirmée ----
await setSession(db, 'canda@x.be');
ok((await err(`insert into dossiers (season,candidate_email,candidate_name,candidate_birth_date,district,consent_at,consent_version) values ('2027-2028','candc@x.be','Fake',$1,'C',now(),'v2')`, [adult])) !== null, 'nobody can create a file in someone else\'s name');
await setSession(db, 'ghost@x.be', 'aal1', true);
ok((await err(`insert into dossiers (season,candidate_name,candidate_birth_date,district,consent_at,consent_version) values ('2026-2027','Ghost',$1,'C',now(),'v2')`, [adult])) !== null, 'an unconfirmed account cannot create a file');
// un candidat ne voit pas le dossier d'un autre candidat du même district
await setSession(db, 'canda2@x.be');
ok((await q(`select id from dossiers`)).length === 0, 'a candidate sees no other candidate\'s file');
ok((await q(`select id from staff`)).length === 0, 'a candidate cannot read the staff list');
await db.exec('reset role');
ok(DA !== DC, 'two districts set up');

// ---- le contrôle à lancer sur le vrai projet Supabase (supabase/security_check.sql) passe ici aussi ----
{
  const res = await db.exec(fs.readFileSync(ROOT + '/supabase/security_check.sql', 'utf8'));
  const rows = (res.find(r => r.fields && r.fields.some(f => f.name === 'check_name')) || { rows: [] }).rows;
  const bad = rows.filter(r => !r.ok).map(r => r.check_name);
  ok(rows.length >= 15 && !bad.length, 'security_check.sql: ' + rows.length + ' checks, all true' + (bad.length ? ' — FAILED: ' + bad.join(' | ') : ''));
  ok((await q(`select count(*)::int n from dossiers where season = '2098-2099'`))[0].n === 0, 'security_check.sql leaves nothing behind (rollback)');
}
process.exit(t.done() ? 1 : 0);
