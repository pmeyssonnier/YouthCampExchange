-- ============================================================================
-- Lions YCE — coffre central des dossiers de candidature (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- À exécuter UNE fois dans Supabase → SQL Editor (voir docs/VAULT_SETUP.md).
-- Responsable du traitement : le Multiple District (MD 112 Belgium pour ce
-- déploiement). Conservation : 2 ans après la fin de la saison (réciprocité :
-- la famille du jeune accueille l'année suivante) ; 90 jours après un refus.
--
-- Principe : la base elle-même décide qui voit quoi (Row Level Security).
--   candidat / parent  → son dossier ; le parent approuve si le candidat est mineur
--   président de club  → les dossiers qui le désignent, une fois envoyés, et UNIQUEMENT
--                        la copie « club » (AF sans santé, religion ni n° de pièce
--                        d'identité + Commitment) ; jamais le dossier complet
--   coordinateur       → les dossiers de son district (table staff), une fois envoyés
--   national           → tous les dossiers envoyés
--   admin              → gère la table staff, ne voit pas le contenu des dossiers
-- Coordinateurs, national et admin n'ont leurs droits qu'avec la double
-- authentification (session « aal2 » de Supabase).
-- Les changements de statut et les signatures passent UNIQUEMENT par la
-- fonction dossier_transition() : impossible de sauter une étape.
-- Fichiers : <dossier>/full/… = dossier complet ; <dossier>/club/… = copie du président.
-- ============================================================================

-- ---------- types ----------
create type public.dossier_status as enum (
  'draft',               -- brouillon (candidat)
  'parent_review',       -- candidat mineur : attend l'approbation du parent / tuteur
  'submitted',           -- envoyé, attend la signature du président de club
  'club_signed',         -- signé par le club, attend le coordinateur de district
  'district_validated',  -- validé par le district, attend le national
  'national_validated',  -- validé par le national, prêt à transmettre
  'sent_host',           -- transmis au pays d'accueil
  'accepted',            -- accepté par le pays d'accueil
  'refused',             -- refusé
  'archived'             -- clôturé (conservé jusqu'à purge_after)
);
create type public.staff_role as enum ('district', 'national', 'admin');

-- ---------- intervenants permanents (coordinateurs, national, admin) ----------
create table public.staff (
  id         bigint generated always as identity primary key,
  email      text not null check (email = lower(email)),
  role       public.staff_role not null,
  district   text check (district ~ '^[A-Z]$'),
  full_name  text,
  created_at timestamptz not null default now(),
  check ((role = 'district') = (district is not null))
);
create unique index staff_unique on public.staff (email, role, coalesce(district, ''));

-- ---------- helpers ----------
create function public.my_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- session ouverte avec la double authentification (code TOTP vérifié)
create function public.mfa_ok() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- droits d'un intervenant : seulement avec la double authentification
create function public.is_staff(r public.staff_role, d text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select mfa_ok() and exists (select 1 from staff
                 where email = my_email() and role = r and (d is null or district = d))
$$;

-- fin de saison "2025-2026" → 31 août 2026
create function public.season_end(s text) returns date
language sql immutable as $$
  select make_date(split_part(s, '-', 2)::int, 8, 31)
$$;

-- ---------- dossiers ----------
create table public.dossiers (
  id                 uuid primary key default gen_random_uuid(),
  season             text not null check (season ~ '^\d{4}-\d{4}$'),
  candidate_email    text not null default public.my_email(),
  candidate_name     text not null check (length(trim(candidate_name)) > 1),
  candidate_birth_date date not null check (candidate_birth_date between '1980-01-01' and '2100-01-01'),
  parent_email       text check (parent_email = lower(parent_email)),
  president_email    text check (president_email = lower(president_email)),
  district           text not null check (district ~ '^[A-Z]$'),
  club               text,
  camp_choice        text,
  status             public.dossier_status not null default 'draft',
  consent_at         timestamptz not null,
  consent_version    text not null,
  first_submitted_at timestamptz,
  purge_after        date not null default '2999-12-31',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (candidate_email, season),
  -- personne ne s'approuve soi-même
  check (parent_email is distinct from candidate_email),
  check (president_email is distinct from candidate_email)
);

create function public.dossiers_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.purge_after := public.season_end(new.season) + interval '2 years';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger dossiers_before_write before insert or update on public.dossiers
  for each row execute function public.dossiers_before_write();

-- qui peut voir un dossier
create function public.can_see_dossier(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dossiers d where d.id = did and (
         d.candidate_email = my_email()
      or d.parent_email    = my_email()
      or (d.first_submitted_at is not null and (
              d.president_email = my_email()
           or is_staff('national')
           or is_staff('district', d.district)))))
$$;

-- qui peut lire un fichier : le président n'a accès qu'à la copie « club »
create function public.can_read_file(did uuid, k text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dossiers d where d.id = did and (
         d.candidate_email = my_email()
      or d.parent_email    = my_email()
      or (d.first_submitted_at is not null and (
              is_staff('national')
           or is_staff('district', d.district)
           or (k = 'club' and d.president_email = my_email())))))
$$;

-- candidat mineur au moment de l'envoi : l'approbation d'un parent est requise
create function public.is_minor(birth date) returns boolean
language sql stable as $$
  select birth > (current_date - interval '18 years')::date
$$;

-- qui peut déposer / remplacer un fichier, selon l'étape en cours
-- (le président n'en dépose jamais : il ne reçoit que la copie club)
create function public.can_upload_dossier(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dossiers d where d.id = did and (
         (d.status = 'draft'       and d.candidate_email = my_email())
      or (d.status = 'club_signed' and is_staff('district', d.district))
      or (d.status in ('district_validated', 'national_validated') and is_staff('national'))))
$$;

-- dossier arrivé à échéance de conservation (purge par le national)
create function public.is_purgeable(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff('national') and exists (
    select 1 from dossiers where id = did and purge_after < current_date)
$$;

-- "<uuid>/full/fichier.zip" → uuid (null si le chemin n'a pas cette forme)
create function public.path_dossier(path text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end $$;
-- "<uuid>/full/…" → 'zip' ; "<uuid>/club/…" → 'club' ; autre → null
create function public.path_kind(path text) returns text
language sql immutable as $$
  select case split_part(path, '/', 2) when 'full' then 'zip' when 'club' then 'club' end
$$;

-- ---------- fichiers, signatures, commentaires, journal ----------
create table public.dossier_files (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references public.dossiers on delete cascade,
  kind        text not null check (kind in ('zip', 'club')),   -- dossier complet / copie du président
  path        text not null unique,
  file_name   text not null,
  sha256      text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes  bigint not null,
  contents    text[] not null default '{}',   -- noms des fichiers du ZIP (checklist)
  source_sha  text,                            -- copie club : empreinte du dossier complet d'origine
  uploaded_by text not null default public.my_email(),
  uploaded_at timestamptz not null default now(),
  -- « is not distinct from » : un chemin mal formé (null) doit faire échouer la contrainte
  check (public.path_dossier(path) is not distinct from dossier_id),
  check (public.path_kind(path) is not distinct from kind),
  -- « is not null » explicite : une comparaison avec null ne ferait pas échouer la contrainte
  check ((kind = 'zip' and source_sha is null) or (kind = 'club' and source_sha is not null and source_sha ~ '^[0-9a-f]{64}$'))
);

create table public.signatures (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers on delete cascade,
  step         public.dossier_status not null,
  signer_email text not null,
  signer_role  text not null,
  doc_sha256   text not null,
  signed_at    timestamptz not null default now()
);

create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers on delete cascade,
  author_email text not null default public.my_email(),
  body         text not null check (length(trim(body)) > 0),
  created_at   timestamptz not null default now()
);

create table public.events (
  id          bigint generated always as identity primary key,
  dossier_id  uuid not null references public.dossiers on delete cascade,
  actor_email text not null default public.my_email(),
  action      text not null,
  detail      jsonb not null default '{}',
  at          timestamptz not null default now()
);

-- trace des purges, sans aucune donnée personnelle
create table public.purge_log (
  id         bigint generated always as identity primary key,
  dossier_id uuid not null,
  season     text not null,
  purged_by  text not null,
  purged_at  timestamptz not null default now()
);

-- journal automatique des dépôts de fichiers
create function public.files_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into events (dossier_id, actor_email, action, detail)
  values (new.dossier_id, my_email(), 'upload',
          jsonb_build_object('file', new.file_name, 'sha256', new.sha256, 'size', new.size_bytes));
  return new;
end $$;
create trigger files_after_insert after insert on public.dossier_files
  for each row execute function public.files_after_insert();

-- dernière version déposée d'un type de fichier
create function public.latest_file(did uuid, k text) returns public.dossier_files
language sql stable security definer set search_path = public as $$
  select * from dossier_files where dossier_id = did and kind = k order by uploaded_at desc limit 1
$$;

-- pièces manquantes dans la dernière version du dossier (bloque l'envoi)
create function public.missing_documents(did uuid) returns text[]
language sql stable security definer set search_path = public as $$
  with f as (select latest_file(did, 'zip') z, latest_file(did, 'club') c),
       names as (select regexp_replace(n, '^.*/', '') n from f, unnest(coalesce((f.z).contents, '{}')) n),
       req(label, re) as (values
         ('Application form (Excel)', '\.xlsx$'),
         ('Commitment to Reciprocity', '^Commitment.*\.docx$'),
         ('Pass photo', '^Pass_photo'),
         ('Payment proof', '^Payment_proof'),
         ('Passport / ID scan', '^ID_document'),
         ('Letter to the host family', '^Letter_to_Host_Family'))
  select coalesce(array_agg(label), '{}') from (
    select label from req where not exists (select 1 from names where names.n ~* req.re)
    union all
    select 'Club copy of the current version' from f
     where (f.z).id is not null and ((f.c).id is null or (f.c).source_sha is distinct from (f.z).sha256)
  ) m
$$;

-- ---------- circuit de validation ----------
-- Seule porte d'entrée pour changer un statut. Chaque approbation (parent, club,
-- district, national) exige l'empreinte SHA-256 de la version signée : dernier
-- dossier complet, ou pour le président la copie club tirée de ce dossier.
create function public.dossier_transition(did uuid, target public.dossier_status,
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
    insert into signatures (dossier_id, step, signer_email, signer_role, doc_sha256)
    values (did, target, me, who, doc_sha256);
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

-- trace une consultation / un téléchargement
create function public.dossier_log(did uuid, what text, info jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_see_dossier(did) then raise exception 'Dossier not found'; end if;
  if what not in ('download', 'export') then raise exception 'Unknown action'; end if;
  insert into events (dossier_id, actor_email, action, detail) values (did, my_email(), what, info);
end $$;

-- purge d'un dossier échu (après suppression de ses fichiers dans le stockage)
create function public.dossier_purge(did uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if not is_purgeable(did) then raise exception 'Not purgeable'; end if;
  select season into s from dossiers where id = did;
  delete from dossiers where id = did;
  insert into purge_log (dossier_id, season, purged_by) values (did, s, my_email());
end $$;

-- dossiers échus et leurs fichiers, y compris les brouillons abandonnés jamais envoyés
create function public.purge_candidates() returns table (id uuid, season text, paths text[])
language sql stable security definer set search_path = public as $$
  select d.id, d.season, coalesce(array_agg(f.path) filter (where f.path is not null), '{}')
    from dossiers d left join dossier_files f on f.dossier_id = d.id
   where is_staff('national') and d.purge_after < current_date
   group by d.id, d.season
$$;

-- rôles du compte connecté (pour l'interface)
create function public.my_roles() returns table (role public.staff_role, district text)
language sql stable security definer set search_path = public as $$
  select role, district from staff where email = my_email()
$$;

-- ---------- droits & Row Level Security ----------
alter table public.staff         enable row level security;
alter table public.dossiers      enable row level security;
alter table public.dossier_files enable row level security;
alter table public.signatures    enable row level security;
alter table public.comments      enable row level security;
alter table public.events        enable row level security;
alter table public.purge_log     enable row level security;

-- rien pour les visiteurs non connectés
revoke all on all tables in schema public from anon;

-- colonnes modifiables par l'interface ; statut, échéance et signatures : jamais en direct
revoke insert, update on public.dossiers from authenticated;
grant insert (season, candidate_name, candidate_birth_date, parent_email, president_email, district, club,
              camp_choice, consent_at, consent_version) on public.dossiers to authenticated;
grant update (candidate_name, candidate_birth_date, parent_email, president_email, district, club, camp_choice)
  on public.dossiers to authenticated;
revoke insert, update, delete on public.signatures, public.events, public.purge_log from authenticated;
revoke update on public.dossier_files, public.comments from authenticated;

create policy staff_read on public.staff for select to authenticated
  using (email = public.my_email() or public.is_staff('admin'));
create policy staff_admin_insert on public.staff for insert to authenticated
  with check (public.is_staff('admin'));
create policy staff_admin_delete on public.staff for delete to authenticated
  using (public.is_staff('admin'));

-- même règle que can_see_dossier(), écrite sur les colonnes de la ligne : elle doit
-- aussi valoir pour la ligne qu'on vient d'insérer (insert … returning)
create policy dossiers_read on public.dossiers for select to authenticated
  using (candidate_email = public.my_email()
      or parent_email    = public.my_email()
      or (first_submitted_at is not null and (
              president_email = public.my_email()
           or public.is_staff('national')
           or public.is_staff('district', district))));
create policy dossiers_create on public.dossiers for insert to authenticated
  with check (candidate_email = public.my_email() and status = 'draft');
create policy dossiers_edit_draft on public.dossiers for update to authenticated
  using (candidate_email = public.my_email() and status = 'draft')
  with check (candidate_email = public.my_email() and status = 'draft');
create policy dossiers_withdraw on public.dossiers for delete to authenticated
  using (candidate_email = public.my_email() and status = 'draft' and first_submitted_at is null);

create policy files_read on public.dossier_files for select to authenticated
  using (public.can_read_file(dossier_id, kind));
create policy files_add on public.dossier_files for insert to authenticated
  with check (public.can_upload_dossier(dossier_id) and uploaded_by = public.my_email());
create policy files_remove on public.dossier_files for delete to authenticated
  using (public.can_upload_dossier(dossier_id) and uploaded_by = public.my_email());

create policy signatures_read on public.signatures for select to authenticated
  using (public.can_see_dossier(dossier_id));
create policy comments_read on public.comments for select to authenticated
  using (public.can_see_dossier(dossier_id));
create policy comments_add on public.comments for insert to authenticated
  with check (public.can_see_dossier(dossier_id) and author_email = public.my_email());
create policy events_read on public.events for select to authenticated
  using (public.can_see_dossier(dossier_id));
create policy purge_log_read on public.purge_log for select to authenticated
  using (public.is_staff('national') or public.is_staff('admin'));

-- ---------- stockage des fichiers (bucket privé) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('dossiers', 'dossiers', false, 52428800)
on conflict (id) do nothing;

create policy yce_files_read on storage.objects for select to authenticated
  using (bucket_id = 'dossiers' and (public.can_read_file(public.path_dossier(name), public.path_kind(name))
                                     or public.is_purgeable(public.path_dossier(name))));
create policy yce_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'dossiers' and public.path_kind(name) is not null
              and public.can_upload_dossier(public.path_dossier(name)));
create policy yce_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dossiers' and (public.can_upload_dossier(public.path_dossier(name))
                                     or public.is_purgeable(public.path_dossier(name))));
