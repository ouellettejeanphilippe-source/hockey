/*
 * Le +/- va-t-il à ceux qui étaient sur la glace ?
 *
 * JP, devant une table d'équipe : *this distribution doesn't make any sense,
 * I feel the +/- is not really linked to who is on ice when the goals are
 * scored* — un quatrième trio entier à −28, −28, −26 sur une équipe de 50
 * victoires, une première paire à +32 et +32, des coéquipiers de trio au
 * même chiffre au but près.
 *
 * Ce script aligne de vraies équipes (`autoRoster`) en ligues de 32, les fait
 * jouer, et compare, PAR RANG D'UNITÉ (1er trio…
 * 4e trio, 1re paire… 3e paire), le +/- simulé au vrai +/- des mêmes
 * joueurs dans leur vraie saison. Puis deux choses que le vrai hockey
 * fait et que le moteur peut ne pas faire :
 *
 *   l'ÉCART DU HAUT AU BAS   moyenne du 1er trio moins moyenne du 4e ; si le
 *                            moteur double le réel, le bas de l'alignement
 *                            paie trop et le haut encaisse trop
 *   les JUMEAUX              l'écart absolu moyen entre deux coéquipiers de
 *                            la même unité : dans la vraie ligue les
 *                            changements à la volée et les blessures les
 *                            séparent de plusieurs buts ; s'ils sont à zéro,
 *                            le moteur crédite toujours les cinq de la case
 *
 *   node scripts/check_pm.mjs
 *   LIGUES=4 node scripts/check_pm.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, createTeam, simulateLeague, autoRoster, registerHiddenRatings, generateur } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const LIGUES = Number(process.env.LIGUES ?? 2);
const moy = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const saisons = fs.readdirSync(DIR).filter(x => x.endsWith('.json')).map(x => x.replace('.json', '')).sort();

const alea = generateur('check_pm');
const rangs = {};   // 'F1'.. 'D3' -> { sim: [], reel: [] }
const jumeaux = { sim: [], reel: [] };
let corr = [];      // [sim, reel] par joueur
let n = 0;
const vus = new Set();
// EN LIGUE, pas en solo : l'adversaire neutre du solo n'a pas de joueurs,
// donc personne n'y reçoit de −1. Le +/- ne se mesure que dans le jeu réel.
for (let l = 0; l < LIGUES; l++) {
  const equipes = [];
  while (equipes.length < 32) {
    const s = saisons[Math.floor(alea() * saisons.length)];
    const shard = JSON.parse(fs.readFileSync(path.join(DIR, s + '.json'), 'utf8'));
    const tags = [...new Set(shard.players.map(p => p.t))];
    const tag = tags[Math.floor(alea() * tags.length)];
    if (vus.has(s + tag)) continue;
    let u;
    try { u = equipeReelle(s, tag); } catch { continue; }
    if (u[0].length < 12 || u[1].length < 6 || !u[2].length) continue;
    vus.add(s + tag);
    const pool = u.flat().map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    equipes.push(createTeam(`${tag} ${s}`, tag, autoRoster(pool), { season: s }));
  }
  simulateLeague(equipes, 82, { graine: `check_pm-${l}` });
  n += equipes.length;
  for (const t of equipes) {
    const roster = t.roster;
    for (const sl of SLOTS) {
      const p = roster[sl.i];
      if (!p || p.p === 'G' || sl.scratch || (p.gp || 0) < 40 || (p.simGP || 0) < 40) continue;
      const cle = `${sl.group}${sl.unit + 1}`;
      (rangs[cle] = rangs[cle] || { sim: [], reel: [] });
      // Le vrai +/- ramené à 82 matchs, pour comparer à une saison simulée entière.
      rangs[cle].sim.push(p.simPM);
      rangs[cle].reel.push(p.pm * 82 / p.gp);
      corr.push([p.simPM, p.pm * 82 / p.gp]);
    }
    // Les jumeaux : chaque paire de coéquipiers d'une même unité.
    for (const g of ['F', 'D']) for (let unit = 0; unit < (g === 'F' ? 4 : 3); unit++) {
      const ps = SLOTS.filter(x => x.group === g && x.unit === unit && !x.scratch).map(x => roster[x.i]).filter(p => p && (p.gp || 0) >= 40 && (p.simGP || 0) >= 40);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        jumeaux.sim.push(Math.abs(ps[i].simPM - ps[j].simPM));
        jumeaux.reel.push(Math.abs(ps[i].pm * 82 / ps[i].gp - ps[j].pm * 82 / ps[j].gp));
      }
    }
  }
}

console.log(`\n${n} vraies équipes alignées en ${LIGUES} ligue(s), joueurs à 40 matchs et plus\n`);
console.log('  unité    +/- simulé   +/- réel (par 82)   joueurs');
for (const cle of ['F1', 'F2', 'F3', 'F4', 'D1', 'D2', 'D3']) {
  const r = rangs[cle]; if (!r) continue;
  console.log(`  ${cle.padEnd(6)}  ${moy(r.sim).toFixed(1).padStart(8)}   ${moy(r.reel).toFixed(1).padStart(10)}          ${r.sim.length}`);
}
const ecart = (k) => moy(rangs.F1[k]) - moy(rangs.F4[k]);
console.log(`\n  écart du 1er au 4e trio : simulé ${ecart('sim').toFixed(1)}, réel ${ecart('reel').toFixed(1)}`);
console.log(`  jumeaux (écart absolu entre coéquipiers d'unité) : simulé ${moy(jumeaux.sim).toFixed(1)}, réel ${moy(jumeaux.reel).toFixed(1)}`);
const mx = moy(corr.map(c => c[0])), my = moy(corr.map(c => c[1]));
const cov = moy(corr.map(c => (c[0] - mx) * (c[1] - my)));
const sx = Math.sqrt(moy(corr.map(c => (c[0] - mx) ** 2))), sy = Math.sqrt(moy(corr.map(c => (c[1] - my) ** 2)));
console.log(`  corrélation joueur par joueur, simulé / réel : ${(cov / (sx * sy)).toFixed(2)} ; écart-type simulé ${sx.toFixed(1)}, réel ${sy.toFixed(1)}\n`);
