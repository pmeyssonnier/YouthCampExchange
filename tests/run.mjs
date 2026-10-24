// Lance tous les tests à la suite ; code de sortie non nul si l'un échoue.
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';

const here = fileURLToPath(new URL('.', import.meta.url));
const fx = spawnSync('python3', ['make_fixtures.py'], { cwd: here, stdio: 'inherit' });
if (fx.status) process.exit(fx.status);
const only = process.argv.slice(2);
const files = fs.readdirSync(here).filter(f => f.endsWith('.test.mjs') && (!only.length || only.some(o => f.includes(o)))).sort();
let failed = [];
for (const f of files) {
  console.log('\n▶ ' + f);
  const r = spawnSync(process.execPath, [f], { cwd: here, stdio: 'inherit', timeout: 600000 });
  if (r.status !== 0) failed.push(f);
}
console.log('\n' + (failed.length ? '✖ failed: ' + failed.join(', ') : '✔ all ' + files.length + ' test files passed'));
process.exit(failed.length ? 1 : 0);
