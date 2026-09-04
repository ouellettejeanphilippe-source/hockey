/*
 * Améliorer son équipe la rend-elle meilleure ?
 *
 * `calibrate_sim.mjs` répond à cette question avec 23 joueurs de cote
 * UNIFORME. C'est un cas dégénéré : douze attaquants identiques franchissent
 * tous en même temps les seuils de zone et les frontières d'archétype, ce qui
 * fabrique des marches artificielles dans la table — notamment à o = 76, où
 * un trio de trois francs-tireurs identiques passe en « conflit de rôles ».
 *
 * Ce script pose la même question sur de VRAIES équipes, alignées par
 * `autoRoster` et simulées par le vrai moteur. Les 1395 équipes-saisons sont
 * rangées par force moyenne puis groupées en déciles. Les victoires simulées
 * doivent monter d'un décile au suivant, sans exception.
 *
 * C'est le test de monotonie qui fait autorité : si celui-ci monte et que la
 * table de `calibrate_sim.mjs` a une marche, la marche est un artefact du
 * banc uniforme, pas un défaut du jeu.
 *
 *   node scripts/check_monotonie.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, simulate, registerHiddenRatings } from '../js/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const ESSAIS = Number(process.env.ESSAIS ?? 4);

const rows = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);

  for (const [t, ps] of Object.entries(parEquipe)) {
    if (ps.length < 20) continue;
    const G = ps.filter(p => p.p === 'G');
    const gw = G.reduce((s, g) => s + (g.w || 0), 0);
    const gl = G.reduce((s, g) => s + (g.l || 0), 0);
    if (gw + gl < 20) continue;                    // fiche réelle trop mince

    // copie : registerHiddenRatings déplace les cotes hors de l'objet joueur
    const pool = ps.map(p => ({ ...p }));
    const force = pool.reduce((s, p) => s + p.v, 0) / pool.length;
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    if (Object.keys(roster).length < 20) continue;

    let W = 0;
    for (let i = 0; i < ESSAIS; i++) W += simulate(roster).W;
    rows.push({ saison: shard.season, t, force, W: W / ESSAIS, vrai: gw / (gw + gl) });
  }
}

rows.sort((a, b) => a.force - b.force);
const n = Math.floor(rows.length / 10);
console.log(`\n${rows.length} vraies équipes-saisons, ${ESSAIS} essais chacune\n`);
console.log('  décile de force   victoires simulées   vraies victoires (sur 82)');

let precedent = -Infinity, monotone = true;
for (let d = 0; d < 10; d++) {
  const tranche = rows.slice(d * n, (d + 1) * n);
  const w = tranche.reduce((a, x) => a + x.W, 0) / tranche.length;
  const v = tranche.reduce((a, x) => a + x.vrai, 0) / tranche.length * 82;
  if (w < precedent) monotone = false;
  precedent = w;
  console.log(`  ${String(d + 1).padStart(8)}          ${w.toFixed(1).padStart(6)}              ${v.toFixed(1).padStart(6)}`);
}
console.log(monotone
  ? '\n  ✓ monotone : chaque décile gagne plus que le précédent.\n'
  : '\n  ✗ NON MONOTONE : un décile plus fort gagne moins. Une constante de zone est en cause.\n');
