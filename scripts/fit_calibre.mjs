/**
 * LE STYLE À TALENT ÉGAL (1.0, oct.) : la pente de chaque rôle sur le talent
 * (`PENTE_TALENT`, js/sim.js), mesurée chez les réguliers (40 matchs et plus,
 * toutes saisons). Un rôle offensif suit les points par match ; le fit d'un
 * système retire cette part, pour que le talent ne paie pas deux fois.
 *
 *   node scripts/fit_calibre.mjs      → imprime les pentes à recopier
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolesBruts, talentDe } from '../js/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lus = { F: [], D: [] };
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  for (const p of d.players) {
    if (p.p === 'G' || (p.gp || 0) < 40) continue;
    lus[(p.p === 'D' || p.p === 'LD' || p.p === 'RD') ? 'D' : 'F'].push({ b: rolesBruts(p), t: talentDe(p) });
  }
}
const out = {};
for (const g of ['F', 'D']) {
  const xs = lus[g], n = xs.length, mt = xs.reduce((a, x) => a + x.t, 0) / n;
  const vt = xs.reduce((a, x) => a + (x.t - mt) ** 2, 0) / n;
  out[g] = {};
  for (const k of Object.keys(xs[0].b)) {
    const mk = xs.reduce((a, x) => a + x.b[k], 0) / n;
    const cov = xs.reduce((a, x) => a + (x.t - mt) * (x.b[k] - mk), 0) / n;
    out[g][k] = Math.round((cov / vt) * 1000) / 1000;
  }
}
console.log(JSON.stringify(out).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', '));
