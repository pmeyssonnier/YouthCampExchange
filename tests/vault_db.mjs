// vault_db.mjs — base PostgreSQL 16 (PGlite) avec ce que Supabase fournit au schéma du coffre :
// rôles anon / authenticated, auth.jwt(), auth.uid(), auth.users (e-mail confirmé ou non), storage.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import crypto from 'crypto';
import { ROOT } from './helpers.mjs';

export async function makeVaultDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create unique index users_email_partial_key on auth.users (email); -- comme Supabase : une adresse = un compte
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
  return db;
}

// identifiant de compte stable pour une adresse (comme l'uuid d'auth.users) ; « unconfirmed » :
// jeton qui annonce cette adresse pour un compte qui ne l'a jamais confirmée (une adresse = un compte)
export function uidFor(email, unconfirmed = false) {
  const h = crypto.createHash('md5').update((unconfirmed ? 'u:' : '') + email).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// ouvre une session : jeton avec e-mail, niveau d'authentification (aal2 = double authentification)
// signedInAgo : ancienneté de la dernière connexion (secondes), relevée par Supabase dans « amr »
export async function setSession(db, email, aal = 'aal1', unconfirmed = false, signedInAgo = 60) {
  await db.exec('reset role');
  if (email === null) { await db.exec(`set role anon; select set_config('request.jwt.claims','',false)`); return; }
  const id = uidFor(email, unconfirmed);
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, ${unconfirmed ? 'null' : 'now()'}) on conflict (id) do nothing`, [id, unconfirmed ? 'unconfirmed.' + email : email]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: id, email, aal, role: 'authenticated', session_id: 'sess-' + id.slice(0, 8),
    amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) - signedInAgo }].concat(aal === 'aal2' ? [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) - signedInAgo }] : []) })}', false)`);
}
