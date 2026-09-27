/**
 * LE CALAGE DES RÔLES (S79) : le décalage de chaque rôle (`DECALAGE_ROLES`,
 * js/sim.js) pour que les rôles PREMIERS des réguliers (40 matchs et plus,
 * toutes saisons) tombent sur des parts de ligue plausibles.
 *
 *   node scripts/roles_calibre.mjs      → imprime les décalages à recopier
 *
 * Itératif : un rôle trop fréquent recule, un rôle trop rare avance, jusqu'à
 * ce que chaque part soit à un point de sa cible.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolesBruts } from '../js/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CIBLES = {
  F: { sniper: 0.17, passeur: 0.17, deuxsens: 0.15, power: 0.13, checker: 0.14, energie: 0.14, bagarreur: 0.10 },
  D: { defensif: 0.24, offensif: 0.19, manieur: 0.20, physique: 0.20, deuxsens: 0.17 },
};
const bruts = { F: [], D: [] };
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  for (const p of d.players) {
    if (p.p === 'G' || (p.gp || 0) < 40) continue;
    const g = (p.p === 'D' || p.p === 'LD' || p.p === 'RD') ? 'D' : 'F';
    bruts[g].push(rolesBruts(p));
  }
}
const parts = (g, dec) => {
  const n = {};
  for (const b of bruts[g]) {
    let best = null, v = -Infinity;
    for (const [k, x] of Object.entries(b)) if (x + dec[k] > v) { v = x + dec[k]; best = k; }
    n[best] = (n[best] || 0) + 1;
  }
  return Object.fromEntries(Object.keys(CIBLES[g]).map(k => [k, (n[k] || 0) / bruts[g].length]));
};
const out = {};
for (const g of ['F', 'D']) {
  const dec = Object.fromEntries(Object.keys(CIBLES[g]).map(k => [k, 0]));
  for (let it = 0; it < 400; it++) {
    const p = parts(g, dec);
    let fini = true;
    for (const k of Object.keys(dec)) {
      const e = CIBLES[g][k] - p[k];
      if (Math.abs(e) > 0.01) fini = false;
      dec[k] += 0.8 * e;
    }
    if (fini) break;
  }
  out[g] = Object.fromEntries(Object.entries(dec).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  const p = parts(g, dec);
  console.log(g, bruts[g].length, 'réguliers ·', Object.entries(p).map(([k, v]) => `${k} ${(v * 100).toFixed(0)} %`).join(' · '));
}
console.log(`\nexport const DECALAGE_ROLES = ${JSON.stringify(out).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ')};`);
