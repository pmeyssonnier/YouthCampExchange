// E-mails automatiques du coffre (supabase/functions/vault-notify) : bon destinataire à chaque étape,
// lien sans pièce jointe, appel refusé sans le secret du webhook, rien envoyé si le dossier a déjà avancé.
import { checker } from './helpers.mjs';
import { handle, recipients, message } from '../supabase/functions/vault-notify/index.ts';

const t = checker('vault notify');
const D = { id: 'd-1', candidate_name: 'Jane Doe', candidate_email: 'kid@x.be', parent_email: 'mum@x.be', president_email: 'pres@x.be', district: 'C', status: 'submitted' };
const STAFF = [{ email: 'coordc@x.be', role: 'district', district: 'C' }, { email: 'coorda@x.be', role: 'district', district: 'A' },
  { email: 'nat@x.be', role: 'national', district: null }, { email: 'nat@x.be', role: 'admin', district: null }];

t.ok(recipients('parent_review', D, STAFF).join() === 'mum@x.be', 'awaiting parent → the parent');
t.ok(recipients('submitted', D, STAFF).join() === 'pres@x.be', 'sent → the club president');
t.ok(recipients('club_signed', D, STAFF).join() === 'coordc@x.be', 'club signed → the coordinator of the file\'s district only');
t.ok(recipients('district_validated', D, STAFF).join() === 'nat@x.be', 'district validated → the national team, once per address');
t.ok(recipients('draft', D, STAFF).join() === 'kid@x.be', 'sent back → the candidate');
t.ok(!recipients('national_validated', D, STAFF).length, 'national validated → nobody (the national team acts next itself)');
t.ok(!recipients('submitted', { ...D, president_email: null }, STAFF).length, 'no address → no e-mail');

const m = message('submitted', D, 'pres@x.be', 'https://site.example/yce_vault.html');
t.ok(/Jane Doe/.test(m.subject) && /club signature/.test(m.subject), 'subject names the candidate and the step: ' + m.subject);
t.ok(m.text.includes('https://site.example/yce_vault.html?d=d-1') && /not attached/.test(m.text) && /pres@x\.be/.test(m.text), 'body: vault link, no attachment, address to sign in with');
t.ok(!/2009|health|passport/i.test(m.text), 'body carries no personal data beyond the name');

// appel complet du webhook, base et Brevo simulés
const ENV = { NOTIFY_SECRET: 's3cret', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'brevo', SENDER_EMAIL: 'yce@x.be', VAULT_URL: 'https://site.example/yce_vault.html' };
function fakeFetch(dossier) {
  const calls = [];
  const fn = async (url, opt = {}) => {
    calls.push({ url, opt });
    if (url.includes('/rest/v1/dossiers')) return new Response(JSON.stringify(dossier ? [dossier] : []));
    if (url.includes('/rest/v1/staff')) return new Response(JSON.stringify(STAFF));
    return new Response('{}', { status: 201 });
  };
  return { fn, calls };
}
const hook = (body, secret = 's3cret') => new Request('https://fn', { method: 'POST', headers: { 'x-notify-secret': secret, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ev = (to, action = 'status') => ({ type: 'INSERT', table: 'events', record: { dossier_id: 'd-1', action, detail: { from: 'x', to } } });

{
  const f = fakeFetch(D);
  const r = await handle(hook(ev('submitted'), 'wrong'), ENV, f.fn);
  t.ok(r.status === 403 && !f.calls.length, 'call without the webhook secret refused, nothing read or sent');
}
{
  const f = fakeFetch(D);
  const r = await handle(hook(ev('submitted')), ENV, f.fn);
  const brevo = f.calls.filter(c => c.url.includes('api.brevo.com'));
  const body = JSON.parse(brevo[0].opt.body);
  t.ok(r.status === 200 && brevo.length === 1 && body.to[0].email === 'pres@x.be' && brevo[0].opt.headers['api-key'] === 'brevo', 'president e-mailed through Brevo');
  t.ok(!body.attachment && !body.htmlContent && /\?d=d-1/.test(body.textContent), 'plain-text e-mail with the link, no attachment');
  const logged = f.calls.find(c => c.url.endsWith('/rest/v1/events'));
  t.ok(logged && JSON.parse(logged.opt.body).action === 'email' && JSON.parse(logged.opt.body).detail.to === 'president', 'e-mail recorded in the file history');
  t.ok(f.calls.every(c => !c.url.includes('/rest/v1/') || c.opt.headers.Authorization === 'Bearer srv'), 'database read with the service key held by the function');
}
{
  const f = fakeFetch({ ...D, status: 'club_signed' });
  await handle(hook(ev('submitted')), ENV, f.fn);
  t.ok(!f.calls.some(c => c.url.includes('brevo')), 'file already moved on: no outdated e-mail');
}
{
  const f = fakeFetch(D);
  await handle(hook(ev(null, 'upload')), ENV, f.fn);
  await handle(hook(ev(null, 'email')), ENV, f.fn);
  t.ok(!f.calls.length, 'uploads and the function\'s own history entries are ignored (no loop)');
}
process.exit(t.done() ? 1 : 0);
