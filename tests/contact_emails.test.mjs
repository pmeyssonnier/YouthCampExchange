// Plusieurs adresses e-mail de contact : acceptées (séparées par « ; ») par l'administration, un lien par adresse sur la fiche publique.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('contact e-mails');
const srv = await serve(8884);
const br = await chromium.launch(launchOpts);
const pa = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pa.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pa.goto('http://localhost:8884/yce_admin.html', { waitUntil: 'load' });
const res = await pa.evaluate(() => {
  const i = CAMPS_W.findIndex(c => c.detail && /;/.test(c.detail.contact_email || ''));
  const j = CAMPS_W.findIndex(c => c.detail && c.detail.contact_email && !/;/.test(c.detail.contact_email));
  CAMPS_W[j].detail.website && delete CAMPS_W[j].detail.website;
  openEdit(j); document.getElementById('e-contact_email').value = 'a@x.be; b@y.be'; saveEdit();
  const two = CAMPS_W[j].detail.contact_email;
  openEdit(j); document.getElementById('e-contact_email').value = 'a@x.be; not-an-address'; saveEdit();
  const kept = CAMPS_W[j].detail.contact_email; closeEdit();
  return { multi: i >= 0, two, kept };
});
t.ok(res.multi, 'a camp of the data holds several contact e-mails');
t.ok(res.two === 'a@x.be; b@y.be', 'two addresses are accepted and saved: ' + res.two);
t.ok(res.kept === 'a@x.be; b@y.be', 'an invalid address is refused, the previous value stays');

const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pg.goto('http://localhost:8884/index.html', { waitUntil: 'load' });
// fiche publique : le contact (nom, e-mails, téléphone) est réservé au coordinateur Lions, jamais affiché ; la date limite reste visible
const pub = await pg.evaluate(() => {
  const i = RAW.findIndex(c => c.detail && /;/.test(c.detail.contact_email || '') && c.detail.application_deadline);
  const d = RAW[i].detail; showCampDetail(i);
  const html = document.getElementById('md-body').innerHTML;
  return { leaks: [d.contact_name, d.contact_phone, ...String(d.contact_email).split(/\s*;\s*/)].filter(x => x && html.includes(x)), mailto: document.querySelectorAll('#md-body a[href^="mailto:"], #md-body a[href*="wa.me"]').length, contactTitle: /📬|Contact/.test(document.getElementById('md-body').innerText), deadline: /Deadline/i.test(document.getElementById('md-body').innerText) };
});
t.ok(pub.leaks.length === 0 && pub.mailto === 0 && !pub.contactTitle, 'public camp sheet: no contact name, e-mail or phone' + (pub.leaks.length ? ' — leaked: ' + pub.leaks.join(', ') : ''));
t.ok(pub.deadline, 'public camp sheet: the application deadline is still shown');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
