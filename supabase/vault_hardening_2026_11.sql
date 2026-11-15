-- ============================================================================
-- Lions YCE — coffre : durcissement de novembre 2026 (version 1.39.0 du site)
-- ----------------------------------------------------------------------------
-- Pour un projet Supabase DÉJÀ installé avec une version antérieure de vault_schema.sql :
-- Supabase → SQL Editor → coller ce fichier → Run. Une nouvelle installation n'en a pas besoin
-- (vault_schema.sql contient déjà ces règles). Peut être relancé sans risque.
-- Ensuite, relancer supabase/security_check.sql : toutes les lignes doivent être « true ».
--
-- 1. journal des changements d'intervenants (qui a donné ou retiré quel rôle) ;
--    un administrateur ne peut plus se donner un rôle à lui-même
-- 2. saison d'un dossier : réelle et proche de l'année en cours (l'échéance de purge en dépend)
-- 3. signature : un jeton sans heure de connexion est refusé
-- 4. journal des téléchargements : seul le nom du fichier est gardé, borné
-- 5. droits TRUNCATE / REFERENCES / TRIGGER retirés aux comptes connectés ; commentaires bornés à 5000 caractères
-- ============================================================================
begin;

-- 1 ---------------------------------------------------------------------------
create table if not exists public.staff_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_email text not null,
  action      text not null check (action in ('add', 'remove')),
  email       text not null,
  role        public.staff_role not null,
  district    text
);
create or replace function public.staff_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r staff := case when tg_op = 'DELETE' then old else new end;
begin
  insert into staff_log (actor_email, action, email, role, district)
  values (coalesce(nullif(my_email(), ''), 'database owner (SQL editor)'), case when tg_op = 'DELETE' then 'remove' else 'add' end, r.email, r.role, r.district);
  return r;
end $$;
drop trigger if exists staff_after_change on public.staff;
create trigger staff_after_change after insert or delete on public.staff
  for each row execute function public.staff_after_change();
alter table public.staff_log enable row level security;
revoke all on public.staff_log from anon;
revoke insert, update, delete on public.staff_log from authenticated;
grant select on public.staff_log to authenticated;
drop policy if exists staff_log_read on public.staff_log;
create policy staff_log_read on public.staff_log for select to authenticated
  using (public.is_staff('national') or public.is_staff('admin'));
revoke update on public.staff from authenticated;
drop policy if exists staff_admin_insert on public.staff;
create policy staff_admin_insert on public.staff for insert to authenticated
  with check (public.is_staff('admin') and email <> public.my_email());

-- 2 ---------------------------------------------------------------------------
create or replace function public.dossiers_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if split_part(new.season, '-', 2)::int <> split_part(new.season, '-', 1)::int + 1
       or split_part(new.season, '-', 1)::int not between extract(year from current_date)::int - 1
                                                      and extract(year from current_date)::int + 1 then
      raise exception 'Season % is not open for applications', new.season;
    end if;
    new.purge_after := public.season_end(new.season) + interval '2 years';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- 4 ---------------------------------------------------------------------------
create or replace function public.dossier_log(did uuid, what text, info jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_see_dossier(did) then raise exception 'Dossier not found'; end if;
  if what not in ('download', 'export') then raise exception 'Unknown action'; end if;
  insert into events (dossier_id, actor_email, action, detail)
  values (did, my_email(), what, jsonb_build_object('file', left(coalesce(info ->> 'file', ''), 200)));
end $$;

-- 5 ---------------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter table public.comments drop constraint if exists comments_body_max;
alter table public.comments add constraint comments_body_max check (length(body) <= 5000) not valid;

-- 3 ---------------------------------------------------------------------------
-- (copie exacte de la fonction de vault_schema.sql : seule la règle « heure de connexion obligatoire » a changé)
create or replace function public.dossier_transition(did uuid, target public.dossier_status,
                                          note text default null, doc_sha256 text default null)
returns public.dossier_status
language plpgsql security definer set search_path = public as $$
declare
  d    dossiers;
  me   text := my_email();
  who  text;
  z    dossier_files;
  c    dossier_files;
  missing text[];
  claims jsonb := auth.jwt();
  last_auth bigint;
begin
  select * into d from dossiers where id = did for update;
  if not found or not can_see_dossier(did) then
    raise exception 'Dossier not found';
  end if;

  if target in ('parent_review', 'submitted') and d.status = 'draft' and d.candidate_email = me then
    if latest_file(did, 'zip') is null or (latest_file(did, 'zip')).id is null then
      raise exception 'Upload the application ZIP before sending';
    end if;
    missing := missing_documents(did);
    if cardinality(missing) > 0 then
      raise exception 'Missing documents: %', array_to_string(missing, ', ');
    end if;
    if d.president_email is null then
      raise exception 'The club president e-mail is required';
    end if;
    if is_minor(d.candidate_birth_date) then
      if target <> 'parent_review' then
        raise exception 'The candidate is under 18: a parent or guardian must approve the file first';
      end if;
      if d.parent_email is null then
        raise exception 'The parent or guardian e-mail is required for a candidate under 18';
      end if;
    elsif target <> 'submitted' then
      raise exception 'Parental approval is only needed for a candidate under 18';
    end if;
    who := 'candidate';
  elsif target = 'submitted' and d.status = 'parent_review' and d.parent_email = me then
    who := 'parent';
  elsif target = 'club_signed' and d.status = 'submitted' and d.president_email = me then
    who := 'president';
  elsif target = 'district_validated' and d.status = 'club_signed' and is_staff('district', d.district) then
    who := 'district';
  elsif target = 'national_validated' and d.status = 'district_validated' and is_staff('national') then
    who := 'national';
  elsif target = 'sent_host' and d.status = 'national_validated' and is_staff('national') then
    if id_pending(did) then
      raise exception 'The passport scan is still to follow: the candidate must upload it before the file goes to the host country';
    end if;
    who := 'national';
  elsif target in ('accepted', 'refused') and d.status = 'sent_host' and is_staff('national') then
    who := 'national';
  elsif target = 'archived' and d.status in ('accepted', 'refused') and is_staff('national') then
    who := 'national';
  elsif target = 'draft' and d.status in ('parent_review', 'submitted') and d.candidate_email = me then
    who := 'candidate';  -- le candidat reprend son dossier avant toute approbation
  elsif target = 'draft' and (
         (d.status = 'parent_review' and d.parent_email = me)
      or (d.status = 'submitted'   and d.president_email = me)
      or (d.status = 'club_signed' and is_staff('district', d.district))
      or (d.status in ('district_validated', 'national_validated') and is_staff('national'))) then
    if coalesce(trim(note), '') = '' then
      raise exception 'A comment is required to send the file back for correction';
    end if;
    who := case when d.status = 'parent_review' then 'parent'
                when d.status = 'submitted' then 'president'
                when d.status = 'club_signed' then 'district' else 'national' end;
  else
    raise exception 'Step % → % is not allowed for this account', d.status, target;
  end if;

  if who in ('parent', 'president', 'district', 'national') and target <> 'draft'
     and target in ('submitted', 'club_signed', 'district_validated', 'national_validated') then
    z := latest_file(did, 'zip');
    if who = 'president' then
      c := latest_file(did, 'club');
      if c.id is null or c.source_sha is distinct from z.sha256 then
        raise exception 'The club copy is not up to date with the latest file — ask the candidate to upload it again';
      end if;
      if doc_sha256 is null or doc_sha256 is distinct from c.sha256 then
        raise exception 'The signed document does not match the latest club copy — reload the file';
      end if;
    elsif doc_sha256 is null or doc_sha256 is distinct from z.sha256 then
      raise exception 'The signed document does not match the latest ZIP — reload the file';
    end if;
    -- signer, c'est avoir prouvé récemment le contrôle de sa boîte e-mail (et du code TOTP pour les
    -- intervenants) : une session ouverte il y a plus de 24 h sur un appareil oublié ne suffit pas
    select max((m ->> 'timestamp')::bigint) into last_auth
      from jsonb_array_elements(case when jsonb_typeof(claims -> 'amr') = 'array' then claims -> 'amr' else '[]' end) m;
    -- (un jeton sans heure de connexion ne prouve rien : il est refusé comme un jeton trop ancien)
    if last_auth is null or last_auth < extract(epoch from now()) - 24 * 3600 then
      raise exception 'To sign, sign in again with a new e-mail link: your last sign-in is more than 24 hours old';
    end if;
    insert into signatures (dossier_id, step, signer_email, signer_role, doc_sha256, aal, auth_methods, session_id, statement)
    values (did, target, me, who, doc_sha256, coalesce(claims ->> 'aal', 'aal1'),
            case when jsonb_typeof(claims -> 'amr') = 'array' then claims -> 'amr' else '[]' end, claims ->> 'session_id',
            format('%s (%s) approves the application file of %s (season %s, district %s): %s, SHA-256 %s.',
                   me, who, d.candidate_name, d.season, d.district,
                   case when who = 'president' then 'club copy' else 'full file' end, doc_sha256));
  end if;

  update dossiers set
    status = target,
    first_submitted_at = coalesce(first_submitted_at, case when target = 'submitted' then now() end),
    purge_after = case when target = 'refused' then current_date + 90 else purge_after end
  where id = did;

  if coalesce(trim(note), '') <> '' then
    insert into comments (dossier_id, author_email, body) values (did, me, trim(note));
  end if;
  insert into events (dossier_id, actor_email, action, detail)
  values (did, me, 'status', jsonb_build_object('from', d.status, 'to', target, 'role', who));
  return target;
end $$;

commit;
