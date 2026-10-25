-- ============================================================================
-- Lions YCE — contrôle de sécurité du coffre, à lancer sur le VRAI projet Supabase
-- ----------------------------------------------------------------------------
-- Supabase → SQL Editor → coller ce fichier → Run. Après vault_schema.sql, puis après
-- toute modification du projet (politiques, stockage, rôles).
--
-- Tout se passe dans une transaction ANNULÉE à la fin (rollback) : les comptes, dossiers
-- et fichiers de test n'existent que le temps du contrôle, rien n'est enregistré.
-- Le contrôle se met dans la peau de chaque intervenant (comme le fait l'API) et tente
-- de lire et de modifier un dossier du district C par toutes les voies : tables,
-- stockage, fonctions appelables par l'API.
--
-- Résultat : un tableau « check / ok ». Toutes les lignes doivent être « true ».
-- Une seule ligne « false » = faille à corriger avant d'ouvrir le coffre aux candidats.
-- Les tests automatiques du dépôt jouent ce même fichier (tests/vault_isolation.test.mjs).
-- ============================================================================
begin;

create temp table yce_results (n serial, check_name text, ok boolean);
create temp table yce_ids (k text primary key, id uuid);
grant select, insert on yce_results to anon, authenticated;
grant usage on sequence yce_results_n_seq to anon, authenticated;
grant select on yce_ids to anon, authenticated;
-- le schéma temporaire de cette session doit être accessible aux rôles simulés
do $$ begin execute format('grant usage on schema %s to anon, authenticated', pg_my_temp_schema()::regnamespace); end $$;

-- se mettre dans la peau d'un compte : rôle de l'API + jeton (e-mail, double authentification)
create function pg_temp.yce_as(email text, aal text default 'aal1', confirmed boolean default true) returns void
language plpgsql as $$
declare uid uuid := md5(case when confirmed then '' else 'u:' end || coalesce(email, ''))::uuid;
begin
  perform set_config('role', 'postgres', true);
  if email is null then
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'anon', true);
    return;
  end if;
  -- compte non confirmé : son jeton annonce l'adresse d'un autre, mais auth.users ne la lui a jamais
  -- confirmée (une adresse n'existe qu'une fois dans auth.users : le compte garde la sienne)
  insert into auth.users (id, email, email_confirmed_at)
    values (uid, case when confirmed then email else 'unconfirmed.' || email end, case when confirmed then now() end)
    on conflict (id) do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'aal', aal, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.yce_ok(name text, cond boolean) returns void
language sql as $$ insert into yce_results (check_name, ok) values (name, coalesce(cond, false)) $$;

-- une écriture est « bloquée » si elle échoue ou ne touche aucune ligne
create function pg_temp.yce_blocked(stmt text) returns boolean
language plpgsql as $$
declare c int;
begin
  execute stmt;
  get diagnostics c = row_count;
  return c = 0;
exception when others then
  return true;
end $$;

-- nombre de lignes visibles (0 si la lecture est refusée)
create function pg_temp.yce_count(stmt text) returns int
language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || stmt || ') x' into c;
  return c;
exception when others then
  return 0;
end $$;

-- une fonction de l'API renvoie-t-elle quelque chose d'un dossier ?
create function pg_temp.yce_fn_leaks(stmt text) returns boolean
language plpgsql as $$
declare v text;
begin
  execute stmt into v;
  return v is not null and v not in ('{}', 'false', 'f');
exception when others then
  return false;
end $$;

-- ---------- jeu d'essai : deux districts, dossiers envoyés, signature du président C ----------
select pg_temp.yce_as(null);
reset role;
insert into staff (email, role, district) values
  ('check-nat@yce.invalid', 'national', null), ('check-admin@yce.invalid', 'admin', null),
  ('check-coord-a@yce.invalid', 'district', 'A'), ('check-coord-c@yce.invalid', 'district', 'C');

create function pg_temp.yce_dossier(k text, cand text, district text, pres text) returns void
language plpgsql as $$
declare did uuid; f text; c text; sha text := repeat(substr(md5(k), 1, 1), 64);
begin
  perform pg_temp.yce_as(cand);
  insert into dossiers (season, candidate_name, candidate_birth_date, president_email, district, consent_at, consent_version)
    values ('2098-2099', 'Check Person', '2000-05-01', pres, district, now(), 'check') returning id into did;
  f := did || '/full/check.zip'; c := did || '/club/check.zip';
  insert into storage.objects (bucket_id, name) values ('dossiers', f), ('dossiers', c);
  insert into dossier_files (dossier_id, kind, path, file_name, sha256, size_bytes, contents) values
    (did, 'zip', f, 'check.zip', sha, 1, array['Application_form.xlsx', 'Commitment_to_Reciprocity.docx', 'Pass_photo.jpg',
      'Payment_proof.pdf', 'ID_document.pdf', 'Letter_to_Host_Family.pdf']);
  insert into dossier_files (dossier_id, kind, path, file_name, sha256, size_bytes, source_sha) values
    (did, 'club', c, 'club.zip', repeat('c', 64), 1, sha);
  perform dossier_transition(did, 'submitted');
  insert into comments (dossier_id, body) values (did, 'check');
  perform set_config('role', 'postgres', true);
  insert into yce_ids values (k, did);
end $$;
select pg_temp.yce_dossier('A', 'check-cand-a@yce.invalid', 'A', 'check-pres-a@yce.invalid');
select pg_temp.yce_dossier('C', 'check-cand-c@yce.invalid', 'C', 'check-pres-c@yce.invalid');
select pg_temp.yce_as('check-pres-c@yce.invalid');
select dossier_transition((select id from yce_ids where k = 'C'), 'club_signed', null, repeat('c', 64));

-- ---------- contrôles positifs : sans eux, « ne voit rien » ne prouverait rien ----------
select pg_temp.yce_as('check-cand-c@yce.invalid');
select pg_temp.yce_ok('control: candidate C sees their file', pg_temp.yce_count('select id from dossiers where id = (select id from yce_ids where k = ''C'')') = 1);
select pg_temp.yce_as('check-coord-c@yce.invalid', 'aal2');
select pg_temp.yce_ok('control: coordinator C with MFA sees the full file', pg_temp.yce_count('select id from dossier_files where dossier_id = (select id from yce_ids where k = ''C'')') = 2);
select pg_temp.yce_as('check-pres-c@yce.invalid');
select pg_temp.yce_ok('control: president C sees the club copy only', pg_temp.yce_count('select id from dossier_files where dossier_id = (select id from yce_ids where k = ''C'')') = 1);

-- ---------- tous les autres : lecture et écriture du dossier C ----------
reset role;
create function pg_temp.yce_outsider(label text, email text, aal text, confirmed boolean) returns void
language plpgsql as $$
declare
  dc uuid; leaks text := ''; breaches text := '';
  st record; nf int; no int; ns int; nc int;
begin
  perform set_config('role', 'postgres', true);
  select id into dc from yce_ids where k = 'C';
  perform pg_temp.yce_as(email, aal, confirmed);
  if pg_temp.yce_count(format('select id from dossiers where id = %L', dc)) > 0 then leaks := leaks || ' dossier'; end if;
  if pg_temp.yce_count(format('select id from dossier_files where dossier_id = %L', dc)) > 0 then leaks := leaks || ' file-records'; end if;
  if pg_temp.yce_count(format('select id from storage.objects where name like %L', dc || '/%')) > 0 then leaks := leaks || ' stored-files'; end if;
  if pg_temp.yce_count(format('select id from signatures where dossier_id = %L', dc)) > 0 then leaks := leaks || ' signatures'; end if;
  if pg_temp.yce_count(format('select id from comments where dossier_id = %L', dc)) > 0 then leaks := leaks || ' comments'; end if;
  if pg_temp.yce_count(format('select id from events where dossier_id = %L', dc)) > 0 then leaks := leaks || ' history'; end if;
  if pg_temp.yce_fn_leaks(format('select (latest_file(%L, ''zip'')).path', dc)) then leaks := leaks || ' latest_file()'; end if;
  if pg_temp.yce_fn_leaks(format('select missing_documents(%L)::text', dc)) then leaks := leaks || ' missing_documents()'; end if;
  if pg_temp.yce_fn_leaks(format('select id_pending(%L)::text', dc)) then leaks := leaks || ' id_pending()'; end if;
  perform pg_temp.yce_ok(label || ': reads nothing of the district C file' || case when leaks <> '' then ' — LEAK:' || leaks else '' end, leaks = '');

  if not pg_temp.yce_blocked(format('insert into comments (dossier_id, body) values (%L, ''x'')', dc)) then breaches := breaches || ' comment'; end if;
  if not pg_temp.yce_blocked(format('insert into storage.objects (bucket_id, name) values (''dossiers'', %L)', dc || '/full/evil.zip')) then breaches := breaches || ' upload'; end if;
  if not pg_temp.yce_blocked(format('insert into dossier_files (dossier_id, kind, path, file_name, sha256, size_bytes) values (%L, ''zip'', %L, ''e'', %L, 1)', dc, dc || '/full/e.zip', repeat('e', 64))) then breaches := breaches || ' file-record'; end if;
  if not pg_temp.yce_blocked(format('select dossier_transition(%L, ''district_validated'', ''x'', %L)', dc, repeat('c', 64))) then breaches := breaches || ' validate'; end if;
  if not pg_temp.yce_blocked(format('select dossier_transition(%L, ''draft'', ''x'')', dc)) then breaches := breaches || ' send-back'; end if;
  if not pg_temp.yce_blocked(format('select dossier_log(%L, ''download'')', dc)) then breaches := breaches || ' history-entry'; end if;
  if not pg_temp.yce_blocked(format('update dossiers set district = ''A'' where id = %L', dc)) then breaches := breaches || ' update'; end if;
  if not pg_temp.yce_blocked(format('delete from dossier_files where dossier_id = %L', dc)) then breaches := breaches || ' delete-records'; end if;
  if not pg_temp.yce_blocked(format('delete from storage.objects where name like %L', dc || '/%')) then breaches := breaches || ' delete-stored'; end if;
  if not pg_temp.yce_blocked(format('delete from dossiers where id = %L', dc)) then breaches := breaches || ' delete-dossier'; end if;
  if not pg_temp.yce_blocked(format('insert into signatures (dossier_id, step, signer_email, signer_role, doc_sha256) values (%L, ''district_validated'', ''x'', ''district'', %L)', dc, repeat('c', 64))) then breaches := breaches || ' forged-signature'; end if;
  perform set_config('role', 'postgres', true);
  select district, status into st from dossiers where id = dc;
  select count(*) into nf from dossier_files where dossier_id = dc;
  select count(*) into no from storage.objects where name like dc || '/%';
  select count(*) into ns from signatures where dossier_id = dc;
  select count(*) into nc from comments where dossier_id = dc;
  if st.district is distinct from 'C' or st.status is distinct from 'club_signed' or nf <> 2 or no <> 2 or ns <> 1 or nc <> 1 then
    breaches := breaches || ' data-changed';
  end if;
  perform pg_temp.yce_ok(label || ': changes nothing in the district C file' || case when breaches <> '' then ' — BREACH:' || breaches else '' end, breaches = '');
end $$;

select pg_temp.yce_outsider('candidate of district A', 'check-cand-a@yce.invalid', 'aal1', true);
select pg_temp.yce_outsider('president of district A', 'check-pres-a@yce.invalid', 'aal1', true);
select pg_temp.yce_outsider('coordinator of district A with MFA', 'check-coord-a@yce.invalid', 'aal2', true);
select pg_temp.yce_outsider('coordinator of district C without MFA', 'check-coord-c@yce.invalid', 'aal1', true);
select pg_temp.yce_outsider('administrator with MFA', 'check-admin@yce.invalid', 'aal2', true);
select pg_temp.yce_outsider('unconfirmed account with candidate C''s address', 'check-cand-c@yce.invalid', 'aal1', false);
select pg_temp.yce_outsider('unconfirmed account with coordinator C''s address, MFA', 'check-coord-c@yce.invalid', 'aal2', false);
select pg_temp.yce_outsider('anonymous visitor', null, null, true);

-- ---------- réglages du projet ----------
select set_config('role', 'postgres', true);
select pg_temp.yce_ok('storage bucket "dossiers" is private', (select not public from storage.buckets where id = 'dossiers'));
select pg_temp.yce_ok('row level security enabled on every vault table',
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relname in ('staff', 'dossiers', 'dossier_files', 'signatures', 'comments', 'events', 'purge_log')));
select pg_temp.yce_ok('anonymous visitors have no right on the vault tables',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'
    and table_name in ('staff', 'dossiers', 'dossier_files', 'signatures', 'comments', 'events', 'purge_log')));

select n, ok, check_name from yce_results order by ok, n;
rollback;
