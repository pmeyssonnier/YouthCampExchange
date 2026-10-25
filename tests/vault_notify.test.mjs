// E-mails automatiques du coffre (supabase/functions/vault-notify) : bon destinataire à chaque étape,
// lien sans pièce jointe, appel refusé sans le secret du webhook, rien envoyé si le dossier a déjà avancé.
import { checker } from './helpers.mjs';
import { handle, recipients, message, smtpSend } from '../supabase/functions/vault-notify/index.ts';

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

// appel complet du webhook, base et envoi simulés
const ENV = { NOTIFY_SECRET: 's3cret', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', SMTP_USER: 'yce.md112@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop', VAULT_URL: 'https://site.example/yce_vault.html' };
function fakeFetch(dossier) {
  const calls = [], mails = [];
  const fn = async (url, opt = {}) => {
    calls.push({ url, opt });
    if (url.includes('/rest/v1/dossiers')) return new Response(JSON.stringify(dossier ? [dossier] : []));
    if (url.includes('/rest/v1/staff')) return new Response(JSON.stringify(STAFF));
    return new Response('{}', { status: 201 });
  };
  const mail = async (env, to, m) => { if (to === 'fail@x.be') throw new Error('SMTP 550'); mails.push({ to, m }); };
  return { fn, calls, mails, mail };
}
const hook = (body, secret = 's3cret') => new Request('https://fn', { method: 'POST', headers: { 'x-notify-secret': secret, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ev = (to, action = 'status') => ({ type: 'INSERT', table: 'events', record: { dossier_id: 'd-1', action, detail: { from: 'x', to } } });

{
  const f = fakeFetch(D);
  const r = await handle(hook(ev('submitted'), 'wrong'), ENV, f.fn, f.mail);
  t.ok(r.status === 403 && !f.calls.length && !f.mails.length, 'call without the webhook secret refused, nothing read or sent');
}
{
  const f = fakeFetch(D);
  const r = await handle(hook(ev('submitted')), ENV, f.fn, f.mail);
  t.ok(r.status === 200 && f.mails.length === 1 && f.mails[0].to === 'pres@x.be', 'president e-mailed');
  t.ok(/\?d=d-1/.test(f.mails[0].m.text), 'e-mail carries the link to the file');
  const logged = f.calls.find(c => c.url.endsWith('/rest/v1/events'));
  t.ok(logged && JSON.parse(logged.opt.body).action === 'email' && JSON.parse(logged.opt.body).detail.to === 'president', 'e-mail recorded in the file history');
  t.ok(f.calls.every(c => !c.url.includes('/rest/v1/') || c.opt.headers.Authorization === 'Bearer srv'), 'database read with the service key held by the function');
}
{
  const f = fakeFetch({ ...D, status: 'club_signed' });
  await handle(hook(ev('submitted')), ENV, f.fn, f.mail);
  t.ok(!f.mails.length, 'file already moved on: no outdated e-mail');
}
{
  const f = fakeFetch(D);
  await handle(hook(ev(null, 'upload')), ENV, f.fn, f.mail);
  await handle(hook(ev(null, 'email')), ENV, f.fn, f.mail);
  t.ok(!f.calls.length && !f.mails.length, 'uploads and the function\'s own history entries are ignored (no loop)');
}
{
  const f = fakeFetch({ ...D, president_email: 'fail@x.be' });
  const r = await handle(hook(ev('submitted')), ENV, f.fn, f.mail);
  t.ok(r.status === 200 && !f.calls.some(c => c.url.endsWith('/rest/v1/events')), 'failed send: nothing recorded as sent');
}

// dialogue SMTP (Gmail, port 465) avec un faux serveur
function fakeSmtp(authOk = true) {
  const enc = new TextEncoder(), dec = new TextDecoder(), out = [];
  let pending = ['220 smtp.gmail.com ESMTP ready\r\n'], inData = false;
  const conn = {
    async read(b) { const s = pending.shift(); if (s === undefined) return null; const u = enc.encode(s); b.set(u); return u.length; },
    async write(u) {
      const s = dec.decode(u); out.push(s);
      if (inData) { inData = false; pending.push('250 2.0.0 OK queued\r\n'); return; }
      const c = s.slice(0, 4).toUpperCase();
      if (c === 'EHLO') pending.push('250-smtp.gmail.com at your service\r\n250-AUTH LOGIN PLAIN\r\n250 SMTPUTF8\r\n');
      else if (c === 'AUTH') pending.push('334 VXNlcm5hbWU6\r\n');
      else if (out.length === 3) pending.push('334 UGFzc3dvcmQ6\r\n');
      else if (out.length === 4) pending.push(authOk ? '235 2.7.0 Accepted\r\n' : '535-5.7.8 Username and Password not accepted.\r\n535 5.7.8 Learn more\r\n');
      else if (c === 'DATA') { pending.push('354 Go ahead\r\n'); inData = true; }
      else if (c === 'QUIT') pending.push('221 bye\r\n');
      else pending.push('250 OK\r\n');
    },
  };
  return { conn, out };
}
{
  const s1 = fakeSmtp();
  const m2 = message('submitted', { ...D, candidate_name: 'Zoé Dupont-Lefèvre' }, 'pres@x.be', 'https://site.example/yce_vault.html');
  await smtpSend(s1.conn, { user: 'yce.md112@gmail.com', pass: 'abcdefghijklmnop', from: 'yce.md112@gmail.com', fromName: 'Lions YCE MD 112', to: 'pres@x.be', subject: m2.subject, text: m2.text });
  const all = s1.out.join('');
  t.ok(s1.out[2] === Buffer.from('yce.md112@gmail.com').toString('base64') + '\r\n' && s1.out[3] === Buffer.from('abcdefghijklmnop').toString('base64') + '\r\n', 'SMTP: logs in with the Gmail address and app password');
  t.ok(/MAIL FROM:<yce\.md112@gmail\.com>\r\n/.test(all) && /RCPT TO:<pres@x\.be>\r\n/.test(all), 'SMTP: sender and recipient');
  const data = s1.out.find(x => /^From: /.test(x));
  const subj = data.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/);
  t.ok(subj && Buffer.from(subj[1], 'base64').toString('utf8') === m2.subject, 'SMTP: accented subject encoded intact');
  const body = Buffer.from(data.split('\r\n\r\n')[1].replace(/\r\n\.\r\n$/, '').replace(/\r\n/g, ''), 'base64').toString('utf8');
  t.ok(body === m2.text && /\r\n\.\r\n$/.test(data), 'SMTP: body decodes to the message, terminated by a lone dot');
  t.ok(/^QUIT/.test(s1.out[s1.out.length - 1]), 'SMTP: session closed with QUIT');
  const s2 = fakeSmtp(false);
  const err = await smtpSend(s2.conn, { user: 'u', pass: 'bad', from: 'u@x', fromName: 'n', to: 'pres@x.be', subject: 's', text: 't' }).then(() => null, e => e.message);
  t.ok(/535 5\.7\.8/.test(err || '') && !s2.out.some(x => /^MAIL/.test(x)), 'SMTP: wrong app password reported, nothing sent: ' + err);
}
process.exit(t.done() ? 1 : 0);
