/*
 * Les égalités de la feuille de match tiennent-elles ?
 *
 * Avec le lancer comme primitive, elles se ferment PAR CONSTRUCTION plutôt
 * que par un ajustement après coup — mais « par construction » est une
 * affirmation, et ce script en fait une mesure. Sur une ligue complète de
 * 1312 matchs :
 *
 *   1. buts d'une équipe        = somme des buts de ses joueurs
 *   2. lancers d'un gardien     = ses arrêts + les buts qu'il a alloués
 *   3. passes                  <= 2 par but
 *   4. lancers de la ligue      = lancers contre de la ligue
 *
 * La quatrième est l'identité qui a démasqué trois pièges de mesure en
 * bâtissant la maquette (MOTEUR.md 8.3) : dans une ligue fermée, tout lancer
 * tiré est un lancer reçu.
 *
 * Il sort aussi les repères d'époque du moteur, qui doivent retomber sur le
 * réel : ~28,5 lancers et ~3,1 buts par équipe par match.
 *
 *   node scripts/check_feuilles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague,
  LANCERS_BASE, CIBLE_PCT_TIR,
} from '../js/sim.js';
import { seasonLancers as seasonLancersDe } from '../js/ratings.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const saisons = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();

const equipes = [];
const vus = new Set();
while (equipes.length < 32) {
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
  const pool = unites.flat().map(p => ({ ...p }));
  pool.forEach(registerHiddenRatings);
  equipes.push(createTeam(`${tag} ${shard.season}`, tag, autoRoster(pool), { season: shard.season }));
}

simulateLeague(equipes);

const joueursDe = t => SLOTS.map(s => t.roster[s.i]).filter(Boolean);
let ecartsButs = 0, ecartsGardien = 0, tropDePasses = 0;
let lancersPour = 0, lancersContre = 0, buts = 0, matchs = 0;

for (const t of equipes) {
  const js = joueursDe(t);
  const patineurs = js.filter(p => p.p !== 'G');
  const gardiens = js.filter(p => p.p === 'G');

  const bJoueurs = patineurs.reduce((s, p) => s + (p.simG || 0), 0);
  if (bJoueurs !== t.GF) ecartsButs++;

  const pJoueurs = patineurs.reduce((s, p) => s + (p.simA || 0), 0);
  if (pJoueurs > 2 * t.GF) tropDePasses++;

  for (const g of gardiens) {
    if ((g.simSA || 0) !== (g.simSV || 0) + (g.simGA || 0)) ecartsGardien++;
    lancersContre += g.simSA || 0;
  }
  lancersPour += patineurs.reduce((s, p) => s + (p.simSH || 0), 0);
  buts += t.GF;
  matchs += t.games;
}

const butsSimules = buts, lancersSimules = lancersPour;
const ok = x => (x === 0 ? '✓' : `✗ ${x}`);
console.log(`\n32 équipes, ${matchs / 2} matchs\n`);
console.log(`  1. buts d'équipe = somme des joueurs        ${ok(ecartsButs)}`);
console.log(`  2. lancers du gardien = arrêts + buts       ${ok(ecartsGardien)}`);
console.log(`  3. passes <= 2 par but                      ${ok(tropDePasses)}`);
console.log(`  4. lancers pour = lancers contre            `
  + `${lancersPour === lancersContre ? '✓' : `✗ ${lancersPour} vs ${lancersContre}`}`);

/* ---------- les joueurs se reconnaissent-ils ? ---------- */
/*
 * Le moteur ne distribue plus les buts d'un total d'équipe : il les fait
 * émerger des lancers de chaque joueur. Un marqueur de 50 buts doit donc en
 * ressortir avec ~50, corrigé de son époque — sinon la primitive est juste,
 * mais les pondérations qui la nourrissent ne le sont pas.
 *
 * La comparaison se fait PAR MATCH et à l'échelle de la ligue simulée : un
 * joueur de 1981 marquait dans une ligue à 4 buts par match et joue ici dans
 * une ligue à 3,1, donc son total doit baisser d'autant. C'est le rapport à
 * sa propre ligue qui doit tenir, jamais le chiffre brut.
 */
const ecarts = [];
for (const t of equipes) {
  for (const p of joueursDe(t).filter(x => x.p !== 'G' && x.simGP >= 40 && (x.gp || 0) >= 40)) {
    const reelParMatch = (p.g || 0) / p.gp;
    // le joueur est replacé dans la ligue simulée : son % de tir de l'époque
    // s'applique au rythme d'aujourd'hui
    const attendu = reelParMatch * (butsSimules / lancersSimules)
      / (seasonLancersDe(p.s)[1] / 100);
    const simule = p.simG / p.simGP;
    if (attendu > 0.05) ecarts.push({ p, simule, attendu });
  }
}
const biais = ecarts.reduce((s2, e) => s2 + (e.simule - e.attendu), 0) / (ecarts.length || 1);
const attMoy = ecarts.reduce((s2, e) => s2 + e.attendu, 0) / (ecarts.length || 1);
const erreur = ecarts.reduce((s2, e) => s2 + Math.abs(e.simule - e.attendu) / e.attendu, 0) / (ecarts.length || 1);
console.log(`\n  LES JOUEURS SE RECONNAISSENT-ILS ? (${ecarts.length} patineurs à 40 matchs et plus)\n`);
console.log(`    biais sur les buts par match   ${(biais >= 0 ? '+' : '')}${(100 * biais / attMoy).toFixed(1)} %`);
console.log(`    erreur moyenne par joueur      ${(100 * erreur).toFixed(1)} %`);
// Une saison de 82 matchs est un tirage : un marqueur de 30 buts a un
// écart-type d'environ sqrt(30), soit 18 %, même si le moteur est parfait.
// Sans ce repère, l'erreur par joueur ne veut rien dire.
const bruit = ecarts.reduce((s2, e) => s2 + Math.sqrt(e.attendu * e.p.simGP) / (e.attendu * e.p.simGP), 0) / (ecarts.length || 1);
console.log(`    dont bruit de tirage irréductible ${(100 * bruit).toFixed(1)} %`);
console.log(`    reste systématique             ${(100 * Math.sqrt(Math.max(0, erreur * erreur - bruit * bruit))).toFixed(1)} %`);
const pires = ecarts.slice().sort((a, b) => Math.abs(b.simule - b.attendu) - Math.abs(a.simule - a.attendu)).slice(0, 3);
for (const e of pires) {
  console.log(`      ${e.p.n} ${e.p.s} : ${(e.simule * 82).toFixed(0)} buts simulés contre ${(e.attendu * 82).toFixed(0)} attendus`);
}

console.log(`\n  REPÈRES D'ÉPOQUE (cible ${LANCERS_BASE} lancers, `
  + `${(LANCERS_BASE * CIBLE_PCT_TIR).toFixed(2)} buts par équipe par match)\n`);
console.log(`    lancers par équipe par match   ${(lancersPour / matchs).toFixed(2)}`);
console.log(`    buts par équipe par match      ${(buts / matchs).toFixed(2)}`);
console.log(`    % de tir de la ligue           ${(100 * buts / lancersPour).toFixed(2)} %\n`);
