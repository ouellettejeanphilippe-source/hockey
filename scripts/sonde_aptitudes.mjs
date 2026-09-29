/*
 * L'ÉCHELLE DES PROFILS (S68) : sur les joueurs de vraies équipes alignées,
 * la moyenne et l'écart type des trois colonnes d'un profil (lancers par
 * match, finition, passes), par groupe. C'est ce qui règle `PROFIL_REF` :
 * un profil à 50 % doit être un joueur moyen de son groupe. Puis la
 * distribution des profils et du meilleur fit d'une ligne, pour vérifier que
 * les pourcentages s'étalent.
 *
 *   node scripts/sonde_aptitudes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, activeLineup, SLOTS, colonnesProfil, profilsDe, fitLigne, TACTIQUES } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const col = { F: { L: [], T: [], P: [] }, D: { L: [], T: [], P: [] } };
const prof = { F: {}, D: {} };
const fits = {};
let n = 0;
for (const f of SAISONS) {
  const sh = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const tag of [...new Set(sh.players.map(p => p.t))].slice(0, 6)) {
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6) continue;
    const ps = un.flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings);
    const t = createTeam(tag, tag, autoRoster(ps), { season: sh.season });
    const L = activeLineup(t);
    for (const s of SLOTS) {
      const p = L[s.i];
      if (!p || s.scratch || p.p === 'G') continue;
      const g = s.group === 'D' ? 'D' : 'F';
      const c = colonnesProfil(p);
      for (const k of ['L', 'T', 'P']) col[g][k].push(c[k]);
      for (const [k, v] of Object.entries(profilsDe(p) || {})) (prof[g][k] = prof[g][k] || []).push(v);
    }
    for (let u = 0; u < 4; u++) for (const k of Object.keys(TACTIQUES)) if (k !== 'hourra') (fits[k] = fits[k] || []).push(fitLigne(L, u, k));
    n++;
  }
}
const stat = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return [m, Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length)]; };
const f2 = ([m, s]) => `${m.toFixed(2)} ± ${s.toFixed(2)}`;
console.log(`${n} vraies équipes`);
for (const g of ['F', 'D']) console.log(`  ${g}  L ${f2(stat(col[g].L))}   T ${f2(stat(col[g].T))}   P ${f2(stat(col[g].P))}`);
for (const g of ['F', 'D']) for (const [k, v] of Object.entries(prof[g])) console.log(`  profil ${g} ${k.padEnd(10)} ${f2(stat(v))}`);
for (const [k, v] of Object.entries(fits)) console.log(`  fit de ligne ${k.padEnd(10)} ${f2(stat(v))}`);
