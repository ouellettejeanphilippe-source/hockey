/**
 * LE CALAGE DU PROFIL EN QUATRE FAMILLES (V9, tranche 3) : `PROFIL_FAMILLES`, js/sim.js. Pour chaque groupe (avants,
 * défenseurs) et chaque famille, la droite qui lie la famille brute (`famillesBrutes`) aux points par match, sur les
 * réguliers de 40 matchs et plus de toutes les saisons, et la dispersion de ce qui reste. Une famille se lit alors à
 * niveau égal : 0 chez le joueur typique de ses points, en écarts types.
 *
 *   node scripts/check_familles.mjs      → imprime les constantes à recopier, et juge celles du moteur (dans tout.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { famillesBrutes, famillesDe, FAMILLES, PROFIL_FAMILLES } from '../js/sim.js';
import { niveauDe } from '../js/niveaux.js';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lignes = { F: [], D: [] };
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  for (const p of d.players) {
    if (p.p === 'G' || (p.gp || 0) < 40) continue;
    lignes[['D', 'LD', 'RD'].includes(p.p) ? 'D' : 'F'].push({ p, b: famillesBrutes(p), niveau: niveauDe(p, d.players) });
  }
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const ecart = a => { const m = moy(a); return Math.sqrt(moy(a.map(x => (x - m) ** 2))); };
const r3 = x => Math.round(x * 1000) / 1000;
const out = { F: {}, D: {} };
for (const g of ['F', 'D']) {
  const L = lignes[g], x = L.map(l => l.b.zpt);
  for (const k of Object.keys(FAMILLES)) {
    const y = L.map(l => l.b[k]);
    const mx = moy(x), my = moy(y);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
    const pente = sxy / sxx, ord = my - pente * mx;
    out[g][k] = [r3(ord), r3(pente), r3(ecart(y.map((v, i) => v - ord - pente * x[i])))];
  }
}
console.log(`export const PROFIL_FAMILLES = {\n${['F', 'D'].map(g => `  ${g}: { ${Object.entries(out[g]).map(([k, v]) => `${k}: [${v.join(', ')}]`).join(', ')} },`).join('\n')}\n};`);

/* Le moteur porte-t-il ces constantes, et le profil se lit-il à niveau égal ? */
for (const g of ['F', 'D']) for (const k of Object.keys(FAMILLES)) {
  const [a, b, c] = PROFIL_FAMILLES[g][k], [a2, b2, c2] = out[g][k];
  exiger(`${g} · ${FAMILLES[k].nom} : les constantes du moteur sont celles du calage`, Math.abs(a - a2) < 0.01 && Math.abs(b - b2) < 0.01 && Math.abs(c - c2) < 0.01, `moteur [${a}, ${b}, ${c}] · calage [${out[g][k].join(', ')}]`);
}
for (const g of ['F', 'D']) {
  const fam = lignes[g].map(l => ({ f: famillesDe(l.p), niveau: l.niveau, zpt: l.b.zpt }));
  for (const k of Object.keys(FAMILLES)) {
    const tous = fam.map(x => x.f[k]);
    borne(`${g} · ${FAMILLES[k].nom} : centrée sur le joueur typique`, moy(tous), -0.05, 0.05);
    // À niveau égal, la famille reste dispersée : c'est ce que le plan paie.
    const piliers = fam.filter(x => x.niveau === 2).map(x => x.f[k]);
    borne(`${g} · ${FAMILLES[k].nom} : dispersée chez les Piliers (écart type)`, ecart(piliers), 0.7, 1.6);
  }
  // Les familles ne disent pas les points : leur corrélation avec eux est nulle par construction.
  const r = k => { const x = fam.map(f => f.zpt), y = fam.map(f => f.f[k]); const mx = moy(x), my = moy(y); let s = 0, sx = 0, sy = 0; for (let i = 0; i < x.length; i++) { s += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return s / Math.sqrt(sx * sy); };
  informer(`${g} · corrélation avec les points`, Object.keys(FAMILLES).map(k => `${FAMILLES[k].nom} ${r(k).toFixed(2)}`).join(' · '));
}
verdict('Le profil en quatre familles');
