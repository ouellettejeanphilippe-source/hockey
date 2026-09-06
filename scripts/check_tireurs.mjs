/*
 * L'empilement de TIREURS : la brèche que le malus de zone ne voit pas.
 *
 * `check_plafond.mjs` mesure le meilleur alignement légal choisi sur la
 * VALEUR. Mais le moteur ne lit pas la valeur : chez un patineur il lit ses
 * lancers par match et sa finition, relatifs à sa saison — les passes sont
 * distribuées après le but et ne créent rien. Un joueur qui le sait choisit
 * donc des tireurs, ignore les zones, et bâtit un alignement que la valeur
 * ne reconnaît pas comme empilé.
 *
 * Ce script bâtit cet alignement-là (glouton sur lancers × finition par
 * dollar, sous le plafond, positions naturelles seulement), montre ce que
 * chaque unité en fait — le malus de zone, la part des lancers — et le fait
 * jouer. Le repère : il doit retomber au même niveau que l'empilement par
 * valeur et que le Canadien de 1976-77, autour de 62-65 victoires en solo.
 * Avant les plafonds de possession (`VOLUME_UNITE_MAX`, `PRESSION_MAX` dans
 * `js/sim.js`) il faisait 70,8, et la Coupe trois fois sur trois.
 *
 *   node scripts/check_tireurs.mjs
 *   ESSAIS=20 LIGUES=3 node scripts/check_tireurs.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, CAP, REF, simulate, registerHiddenRatings, getHiddenRatings, fits,
  getPositionPenalty, getUnitSynergy, profilMatch, createTeam, activeLineup,
  simulateLeague, playSeries, autoRoster,
} from '../js/sim.js';
import { seasonLancers, getLineZone } from '../js/ratings.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const ESSAIS = Number(process.env.ESSAIS ?? 8);
const LIGUES = Number(process.env.LIGUES ?? 0);
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const rnd = a => a[Math.floor(Math.random() * a.length)];

/* ---------- tous les joueurs-saisons à 60 matchs et plus ---------- */
const tous = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json'))) {
  for (const p of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).players) {
    if ((p.gp || 0) < 60) continue;
    if (p.p === 'D' && (!p.np || p.np === 'D')) p.np = (p.shootsCatches === 'R' || p.shoots === 'R') ? 'RD' : 'LD';
    tous.push(p);
  }
}

/** Ce que le moteur lit : buts attendus relatifs, bornés comme lui. */
function scoreMoteur(p) {
  const L = seasonLancers(p.s);
  if (p.p === 'G') {
    const svL = 1 - L[1] / 100;
    return (1 - svL) / Math.max(0.02, 1 - (p.sv ?? svL));
  }
  const estD = p.p === 'D';
  const vol = Math.min(2.6, (p.sh / p.gp) / L[estD ? 3 : 2]);
  const fin = p.sh >= 20 ? Math.min(2.2, (100 * p.g / p.sh) / L[1]) : 1;
  return vol * fin;
}

/** Glouton par score par dollar, case par case, premier trio d'abord. */
function alignementDeTireurs(lambda = 0.05) {
  const cands = tous.slice().sort((a, b) =>
    (scoreMoteur(b) - lambda * b.$ / 1e6) - (scoreMoteur(a) - lambda * a.$ / 1e6));
  const roster = {}, used = new Set();
  let masse = 0;
  for (const s of SLOTS) {
    const left = 23 - Object.keys(roster).length - 1;
    for (const p of cands) {
      if (used.has(p) || !fits(p, s) || getPositionPenalty(p, s) > 0) continue;
      if (masse + p.$ + left * 775_000 > CAP) continue;
      const c = { ...p };
      registerHiddenRatings(c);
      roster[s.i] = c; used.add(p); masse += p.$;
      break;
    }
  }
  return { roster, masse };
}

const { roster, masse } = alignementDeTireurs();
console.log(`\nAlignement de tireurs : ${(masse / 1e6).toFixed(1)} M$, valeur moyenne ${moy(Object.values(roster).map(p => getHiddenRatings(p).v)).toFixed(0)}\n`);

/* ---------- ce que chaque unité en fait ---------- */
const equipe = createTeam('Tireurs', 'TIR', roster);
const profil = profilMatch(equipe, activeLineup(equipe));
console.log(`  pression d'équipe ${profil.pression.toFixed(2)} (référence ${REF.pression}) → lancers attendus × ${(profil.pression / REF.pression).toFixed(2)}\n`);
for (const g of ['F', 'D']) {
  const total = profil.unites[g].reduce((a, x) => a + x.poids, 0);
  for (let u = 0; u < profil.unites[g].length; u++) {
    const ps = SLOTS.filter(s => s.group === g && s.unit === u && !s.scratch).map(s => roster[s.i]).filter(Boolean);
    const syn = getUnitSynergy(roster, g, u);
    console.log(`  ${g}${u + 1}  ${ps.map(p => `${p.n.split(' ').pop()} ${p.s.slice(2, 4)} ${getLineZone(p, getHiddenRatings(p).v).short}`).join(' | ')}`);
    console.log(`      zone ${String(syn.bonusOff.toFixed(1)).padStart(6)} → × ${Math.exp(syn.bonusOff / 42).toFixed(2)} sur les buts · ${(100 * profil.unites[g][u].poids / total).toFixed(0)} % des lancers du groupe`);
  }
}

/* ---------- la saison solo ---------- */
const rs = [];
for (let i = 0; i < ESSAIS; i++) rs.push(simulate(roster));
const lancers = Object.values(roster).filter(p => p.p !== 'G').reduce((a, p) => a + (p.simSH || 0), 0);
console.log(`\n  SOLO, ${ESSAIS} saisons : ${moy(rs.map(r => r.W)).toFixed(1)}-${moy(rs.map(r => r.L)).toFixed(1)}-${moy(rs.map(r => r.OTL)).toFixed(1)}`
  + `  BP ${moy(rs.map(r => r.GF)).toFixed(0)}  BC ${moy(rs.map(r => r.GA)).toFixed(0)}`
  + `  ${(lancers / 82).toFixed(1)} lancers et ${(rs[rs.length - 1].GF / 82).toFixed(2)} buts par match (dernière saison)`);
console.log('  repère : 62-65 victoires, comme l\'empilement par valeur et le Canadien de 1976-77\n');

/* ---------- la ligue et la Coupe, si demandé ---------- */
if (LIGUES > 0) {
  const saisons = fs.readdirSync(DIR).filter(x => x.endsWith('.json')).map(x => x.replace('.json', ''));
  const adversaires = (n) => {
    const out = [], vus = new Set();
    while (out.length < n) {
      const s = rnd(saisons);
      const shard = JSON.parse(fs.readFileSync(path.join(DIR, s + '.json'), 'utf8'));
      const tag = rnd([...new Set(shard.players.map(p => p.t))]);
      if (vus.has(s + tag)) continue;
      let u;
      try { u = equipeReelle(s, tag); } catch { continue; }
      if (u[0].length < 12 || u[1].length < 6 || !u[2].length) continue;
      vus.add(s + tag);
      const pool = u.flat().map(p => ({ ...p }));
      pool.forEach(registerHiddenRatings);
      out.push(createTeam(`${tag} ${s}`, tag, autoRoster(pool), { season: s }));
    }
    return out;
  };
  let coupes = 0;
  const W = [], rangs = [];
  for (let i = 0; i < LIGUES; i++) {
    const copie = {};
    for (const [k, p] of Object.entries(roster)) { const c = { ...p }; registerHiddenRatings(c); copie[k] = c; }
    const vous = createTeam('Tireurs', 'YOU', copie, { isPlayer: true });
    const { standings } = simulateLeague([vous, ...adversaires(31)]);
    W.push(vous.W);
    rangs.push(standings.findIndex(t => t.isPlayer) + 1);
    let ronde = standings.slice(0, 16);
    while (ronde.length > 1) {
      const suivant = [];
      for (let j = 0; j < ronde.length / 2; j++) suivant.push(playSeries(ronde[j], ronde[ronde.length - 1 - j]).winner);
      ronde = suivant;
    }
    if (ronde[0].isPlayer) coupes++;
  }
  console.log(`  LIGUE, ${LIGUES} ligues : V ${W.join(' ')} · rangs ${rangs.join(' ')} · Coupes ${coupes}/${LIGUES}\n`);
}
