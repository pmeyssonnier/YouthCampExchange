// Contacts des camps : ni nom, ni e-mail, ni téléphone dans les fichiers du site, l'administration ou la fiche publique ; seule une empreinte de l'e-mail est gardée.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('contact e-mails');
const srv = await serve(8884);
const br = await chromium.launch(launchOpts);
const pa = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pa.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pa.goto('http://localhost:8884/yce_admin.html', { waitUntil: 'load' });
// administration : aucune coordonnée en mémoire ni dans la fiche ; seule l'empreinte de l'e-mail sert au rapprochement
const res = await pa.evaluate(async () => {
  const leak = l => l.filter(c => c.detail && Object.keys(c.detail).some(k => /^contact/.test(k) && k !== 'contact_key')).length;
  const j = CAMPS_W.findIndex(c => c.detail && c.detail.contact_key);
  const key = CAMPS_W[j].detail.contact_key;
  openEdit(j); const fields = document.querySelectorAll('#edit-grid [id^="e-contact"]').length; document.getElementById('e-fee').value = '321 EURO'; saveEdit();
  // ancienne sauvegarde ou anciennes données : les coordonnées sont retirées, l'empreinte est calculée
  const old = stripContacts([{ camp_name: 'Old', detail: { contact_name: 'Jane Doe', contact_email: 'Jane.Doe@Example.org', contact_phone: '+32 470 12 34 56', contact_email_camp: 'x@y.be',
    description: 'Send applications to Jane: jane.doe@example.org or +32 470 12 34 56. Camp from 01-07-2027 to 15-07-2027, fee 300 EUR, ages 16-21.' } }])[0].detail;
  return { leak: leak(CAMPS_W) + leak(ARCH), fields, kept: CAMPS_W[j].detail.contact_key === key && CAMPS_W[j].fee === '321 EURO', keyOk: /^[0-9a-f]{8}$/.test(key),
    old, sameKey: old.contact_key === contactKey('jane.doe@example.org') && contactKey('a@x.be') !== contactKey('b@x.be') && contactKey('') === '' };
});
t.ok(res.leak === 0 && res.fields === 0, 'administration: no contact name, e-mail or phone in the working list or in the camp sheet');
t.ok(res.keyOk && res.kept, 'the contact fingerprint is kept when a camp sheet is saved');
t.ok(JSON.stringify(Object.keys(res.old).sort()) === '["contact_key","description"]' && res.sameKey, 'old data: contact fields removed, fingerprint computed (case-insensitive): ' + JSON.stringify(Object.keys(res.old)));
t.ok(!/@|470/.test(res.old.description) && /01-07-2027 to 15-07-2027, fee 300 EUR, ages 16-21/.test(res.old.description), 'old data: e-mail and phone written in a description are replaced, dates and prices untouched: ' + res.old.description);
// fichiers publiés : aucune coordonnée
{
  const fs = await import('fs');
  for (const f of ['camps_data.js', 'camps.json', 'camps_archive.json']) {
    const s = fs.readFileSync('../' + f, 'utf8');
    t.ok(!/"contact_(?!key")/.test(s) && !/[^\s"@]+@[^\s"@]+\.[a-z]{2,}/i.test(s), f + ': no contact field and no e-mail address');
  }
}

const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await pg.goto('http://localhost:8884/index.html', { waitUntil: 'load' });
// fiche publique : le contact (nom, e-mails, téléphone) est réservé au coordinateur Lions, jamais affiché ; la date limite reste visible
const pub = await pg.evaluate(() => {
  const i = RAW.findIndex(c => c.detail && c.detail.contact_key && c.detail.application_deadline);
  showCampDetail(i);
  const html = document.getElementById('md-body').innerHTML;
  return { leaks: [RAW[i].detail.contact_key].filter(x => html.includes(x)), mailto: document.querySelectorAll('#md-body a[href^="mailto:"], #md-body a[href*="wa.me"]').length, contactTitle: /📬|Contact/.test(document.getElementById('md-body').innerText), deadline: /Deadline/i.test(document.getElementById('md-body').innerText) };
});
t.ok(pub.leaks.length === 0 && pub.mailto === 0 && !pub.contactTitle, 'public camp sheet: no contact name, e-mail or phone' + (pub.leaks.length ? ' — leaked: ' + pub.leaks.join(', ') : ''));
t.ok(pub.deadline, 'public camp sheet: the application deadline is still shown');
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
