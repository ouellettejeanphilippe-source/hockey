/*
 * Le plafond du jeu, mesuré en VICTOIRES plutôt qu'en indice.
 *
 * `mock_zones.mjs` demande ce que vaut le meilleur alignement légal sur
 * l'indice de cotes. Ce script pose la seule question qui compte vraiment :
 * combien de matchs gagne-t-il, et à quelle fréquence soulève-t-il la Coupe ?
 *
 * Trois mesures, sur le vrai moteur :
 *
 *   1. la SAISON de l'alignement empilé et de quatre vraies équipes témoins
 *   2. la LIGUE : l'empilé contre 31 vraies équipes historiques
 *   3. la COUPE : à quelle fréquence l'empilé la gagne
 *
 * Le repère du jeu : une équipe parfaite doit perdre quelques matchs, et le
 * 82-0 doit rester rare. Mais l'objectif déclaré est la COUPE — si elle se
 * gagne à tout coup, le jeu n'a pas d'enjeu, quelle que soit la fiche.
 *
 *   node scripts/check_plafond.mjs
 *   ESSAIS=10 node scripts/check_plafond.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, simulate, autoRoster, registerHiddenRatings, createTeam,
  simulateLeague, playSeries,
} from '../js/sim.js';
import { meilleurAlignementLegal, equipesTemoins, equipeReelle, TEMOINS } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const ESSAIS = Number(process.env.ESSAIS ?? 6);

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/** Un vestiaire (F, D, G) devient un alignement prêt à jouer. */
function alignement(unites) {
  const pool = unites.flat().map(p => ({ ...p }));
  pool.forEach(registerHiddenRatings);
  return autoRoster(pool);
}

/* ---------- 1. la saison ---------- */
const { unites: EMPILE, masse } = meilleurAlignementLegal();
const sujets = [['EMPILÉ (plafond)', EMPILE], ...equipesTemoins()];

console.log(`\nMeilleur alignement légal : ${(masse / 1e6).toFixed(1)} M$, ${ESSAIS} saisons par sujet\n`);
console.log('  sujet                  V     D    DP     BP     BC');
for (const [nom, unites] of sujets) {
  const roster = alignement(unites);
  const rs = [];
  for (let i = 0; i < ESSAIS; i++) rs.push(simulate(roster));
  console.log(`  ${nom.padEnd(20)} ${moy(rs.map(r => r.W)).toFixed(1).padStart(4)}`
    + `  ${moy(rs.map(r => r.L)).toFixed(1).padStart(4)}`
    + `  ${moy(rs.map(r => r.OTL)).toFixed(1).padStart(4)}`
    + `  ${moy(rs.map(r => r.GF)).toFixed(0).padStart(5)}`
    + `  ${moy(rs.map(r => r.GA)).toFixed(0).padStart(5)}`);
}

/* ---------- 2 et 3. la ligue et la Coupe ---------- */
/* 31 adversaires : de vraies équipes tirées au hasard dans les 55 saisons,
 * comme le jeu les construit. */
const saisons = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();
function adversaires(n) {
  const out = [];
  const vus = new Set();
  while (out.length < n) {
    const f = saisons[Math.floor(Math.random() * saisons.length)];
    const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
    const tags = [...new Set(shard.players.map(p => p.t))];
    const tag = tags[Math.floor(Math.random() * tags.length)];
    const cle = `${shard.season}|${tag}`;
    if (vus.has(cle)) continue;
    let unites;
    try { unites = equipeReelle(shard.season, tag); } catch { continue; }
    if (unites[0].length < 12 || unites[1].length < 6 || !unites[2].length) continue;
    vus.add(cle);
    out.push(createTeam(`${tag} ${shard.season}`, tag, alignement(unites), { season: shard.season }));
  }
  return out;
}

const LIGUES = Number(process.env.LIGUES ?? Math.max(3, Math.round(ESSAIS / 2)));
// SUJETS=2 pour ne mesurer que l'empilé et le sommet historique quand on veut
// beaucoup de ligues sans y passer la demi-heure.
const sujetsLigue = sujets.slice(0, Number(process.env.SUJETS ?? sujets.length));
console.log(`\n  CONTRE 31 VRAIES ÉQUIPES — ${LIGUES} ligues de 1312 matchs par sujet\n`);
console.log('  sujet                  fiche        rang    finales   COUPES');
for (const [nom, unites] of sujetsLigue) {
  const rangs = [], fiches = [];
  let coupes = 0, finales = 0;
  for (let i = 0; i < LIGUES; i++) {
    const vous = createTeam(nom, 'YOU', alignement(unites), { isPlayer: true });
    const { standings } = simulateLeague([vous, ...adversaires(31)]);
    rangs.push(standings.findIndex(t => t.isPlayer) + 1);
    fiches.push({ W: vous.W, L: vous.L, OTL: vous.OTL });

    let ronde = standings.slice(0, 16);
    while (ronde.length > 1) {
      if (ronde.length === 2 && ronde.some(t => t.isPlayer)) finales++;
      const suivant = [];
      for (let j = 0; j < ronde.length / 2; j++) {
        suivant.push(playSeries(ronde[j], ronde[ronde.length - 1 - j]).winner);
      }
      ronde = suivant;
    }
    if (ronde[0].isPlayer) coupes++;
  }
  const f = `${moy(fiches.map(x => x.W)).toFixed(1)}-${moy(fiches.map(x => x.L)).toFixed(1)}-${moy(fiches.map(x => x.OTL)).toFixed(1)}`;
  console.log(`  ${nom.padEnd(20)} ${f.padStart(12)}   ${moy(rangs).toFixed(1).padStart(5)}`
    + `   ${String(finales).padStart(3)}/${LIGUES}`
    + `   ${String(coupes).padStart(3)}/${LIGUES}  (${(100 * coupes / LIGUES).toFixed(0)} %)`);
}
console.log('');
