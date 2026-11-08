// Formulaire : les questions à choix (Yes/No, English, T-shirt…) ont le même cadre que les champs texte, libellé au-dessus, sans débordement sur mobile.
import { chromium } from '@playwright/test';
import { launchOpts, serve, checker } from './helpers.mjs';

const t = checker('same frame around every question');
const srv = await serve(8906);
const br = await chromium.launch(launchOpts);
for (const [w, h] of [[390, 844], [1280, 900]]) {
  const pg = await br.newPage({ viewport: { width: w, height: h } });
  await pg.route('**fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.goto('http://localhost:8906/yce_form_filler.html', { waitUntil: 'load' });
  await pg.waitForTimeout(600);
  const r = await pg.evaluate(() => {
    const cs = e => getComputedStyle(e);
    const txt = document.querySelector('input[type=text]:not([disabled])');
    const frame = e => { const c = cs(e); return [c.backgroundColor, c.borderTopWidth, c.borderTopColor, c.borderTopLeftRadius].join('|'); };
    const groups = [...document.querySelectorAll('.fld .xgroup')].filter(g => g.offsetParent);
    let sameFrame = 0, labelAbove = 0, inside = 0, noCard = 0;
    groups.forEach(g => {
      const f = g.closest('.fld'), lbl = f.querySelector('label.flbl'), gr = g.getBoundingClientRect(), lr = lbl.getBoundingClientRect(), fr = f.getBoundingClientRect();
      if (frame(g) === frame(txt)) sameFrame++;
      if (lr.bottom <= gr.top + 1) labelAbove++;
      if (gr.right <= innerWidth + 0.5 && gr.left >= -0.5) inside++;
      if (cs(f).borderTopWidth === '0px') noCard++; // plus de carte autour de la question entière (le cadre est celui des boutons)
    });
    const lion = document.getElementById('yn-AI57');
    return { n: groups.length, sameFrame, labelAbove, inside, noCard, lionW: lion.getBoundingClientRect().width, vw: innerWidth, scrollW: document.documentElement.scrollWidth,
      ids: ['xg-engl', 'yn-AF27', 'yn-AI57', 'xg-prev'].map(id => !!document.getElementById(id)) };
  });
  t.ok(r.n >= 10 && r.ids.every(Boolean), w + ' px: choice questions found (' + r.n + ')');
  t.ok(r.sameFrame === r.n, w + ' px: every choice question has the same frame as a text field (' + r.sameFrame + '/' + r.n + ')');
  t.ok(r.labelAbove === r.n && r.noCard === r.n, w + ' px: label above the frame, no card around the whole question');
  t.ok(r.inside === r.n && r.scrollW <= r.vw + 1, w + ' px: nothing cut off or overflowing (page ' + r.scrollW + ' / ' + r.vw + ')');
  if (w === 390) t.ok(r.lionW > 250, 'phone: "Lion?" is full width (' + Math.round(r.lionW) + ' px)');
  await pg.close();
}
await br.close(); srv.close();
process.exit(t.done() ? 1 : 0);
