// Outils communs aux tests : racine du dépôt, fixtures, bibliothèques de la carte, serveur local.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const FIX = fileURLToPath(new URL('./.fixtures', import.meta.url));
const NM = fileURLToPath(new URL('./node_modules', import.meta.url));
// copies locales des scripts chargés depuis les CDN par index.html (tests hors ligne)
export const CDN = {
  d3: path.join(NM, 'd3/dist/d3.min.js'),
  topojson: path.join(NM, 'topojson-client/dist/topojson-client.min.js'),
  atlas: path.join(NM, 'world-atlas/countries-110m.json')
};
// navigateur : celui installé par « npx playwright install », ou CHROMIUM_PATH s'il est fourni
export const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.zip': 'application/zip' };
// Sert le dépôt ; overrides = { '/chemin': contenu } remplace un fichier ; '/fixtures/…' sert tests/.fixtures
export async function serve(port, overrides = {}) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u in overrides) { res.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'text/plain' }); return res.end(overrides[u]); }
    const p = u.startsWith('/fixtures/') ? path.join(FIX, u.slice(10)) : path.join(ROOT, u.replace(/\/$/, '/index.html'));
    let data; try { data = fs.readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
  await new Promise(r => srv.listen(port, r));
  return srv;
}

// compteur de vérifications commun
export function checker(name) {
  let pass = 0, fail = 0;
  return {
    ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  FAIL:', msg); } },
    done() { console.log(`${name}: ${pass} passed, ${fail} failed`); return fail; }
  };
}
