/*
 * Les deux empilements que la VALEUR ne voit pas, et le vrai plafond du jeu.
 *
 * `check_plafond.mjs` mesure le meilleur alignement légal choisi sur la
 * valeur. Mais le moteur ne lit pas la valeur : chez un patineur il lit ses
 * lancers par match, sa finition et, depuis les bornes, la création de ses
 * coéquipiers, tous relatifs à sa saison. Deux alignements en profitent :
 *
 *   TIREURS   glouton sur lancers × finition par dollar, zones ignorées.
 *             Le malus de zone écrase ses trios 2 à 4 ; il doit finir SOUS
 *             l'empilement par valeur. Avant les bornes de possession il
 *             faisait 70,8 victoires en solo et la Coupe trois fois sur trois.
 *   PARFAIT   chaque joueur dans sa zone, chaque trio avec deux tireurs et un
 *             passeur en chimie parfaite, chaque paire équilibrée, sous le
 *             plafond. C'est le VRAI plafond du jeu : le joueur qui monte ça
 *             a tout compris, et il doit battre la meilleure équipe de
 *             l'histoire de quelques matchs, pas la doubler. Avant
 *             FINITION_MAX il faisait 74 victoires et 469 buts (78 et 628
 *             avant les bornes de volume).
 *
 * Repères : TIREURS autour de 52, PARFAIT autour de 68-70, le Canadien de
 * 1976-77 (`check_plafond.mjs`) autour de 61-63, tout ça en solo.
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

const penchant = p => (p.pt || 0) < 15 ? 0 : Math.max(-0.3, Math.min(0.35, p.g / p.pt - (seasonLancers(p.s)[6] || 0.4)));
const production = p => (p.pt / p.gp) / seasonLancers(p.s)[p.p === 'D' ? 5 : 4];
const zoneOK = (p, unit) => getLineZone(p, p.v).idealUnits.includes(unit);
const naturel = (p, role) => getPositionPenalty(p, SLOTS.find(s => s.role === role && s.group === (p.p === 'D' ? 'D' : 'F'))) === 0;

/**
 * L'alignement PARFAIT : unité par unité, dans la zone, le meilleur
 * (tireur, tireur, passeur) aux positions naturelles selon le vrai
 * `getUnitSynergy`, puis les paires « un qui monte, un qui couvre », les
 * deux meilleurs gardiens relatifs, et des réservistes qui tirent.
 */
function alignementParfait() {
  const roster = {}, used = new Set();
  let masse = 0;
  const budgetOK = cout => masse + cout + (23 - Object.keys(roster).length - 1) * 775_000 <= CAP;
  const put = (slot, p) => { const c = { ...p }; registerHiddenRatings(c); roster[slot.i] = c; used.add(p); masse += p.$; };
  const essai = (slots, joueurs) => {
    const tmp = {};
    slots.forEach((s, i) => { const c = { ...joueurs[i] }; registerHiddenRatings(c); tmp[s.i] = c; });
    return tmp;
  };
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  for (let u = 0; u < 4; u++) {
    const slots = ['AG', 'C', 'AD'].map(r => SLOTS.find(s => s.group === 'F' && s.unit === u && s.role === r));
    const pool = tous.filter(p => p.p === 'F' && !used.has(p) && zoneOK(p, u));
    const tireurs = pool.filter(p => penchant(p) >= 0.04).sort((a, b) => scoreMoteur(b) - scoreMoteur(a)).slice(0, 40);
    const passeurs = pool.filter(p => penchant(p) <= -0.06)
      .sort((a, b) => production(b) * (0.6 + scoreMoteur(b)) - production(a) * (0.6 + scoreMoteur(a))).slice(0, 25);
    let best = null, bestVal = -Infinity;
    for (const a of tireurs) for (const b of tireurs) for (const c of passeurs) {
      if (a === b || !budgetOK(a.$ + b.$ + c.$ - 2 * 775_000)) continue;
      const trio = [a, b, c];
      const perm = PERMS.find(pm => pm.every((k, i) => naturel(trio[k], slots[i].role)));
      if (!perm) continue;
      const syn = getUnitSynergy(essai(slots, perm.map(k => trio[k])), 'F', u);
      const val = (scoreMoteur(a) + scoreMoteur(b) + scoreMoteur(c)) * Math.exp(syn.bonusOff / 42) - 0.02 * (a.$ + b.$ + c.$) / 1e6;
      if (val > bestVal) { bestVal = val; best = perm.map(k => trio[k]); }
    }
    best.forEach((p, i) => put(slots[i], p));
  }
  for (let u = 0; u < 3; u++) {
    const slots = ['DG', 'DD'].map(r => SLOTS.find(s => s.group === 'D' && s.unit === u && s.role === r));
    const pool = tous.filter(p => p.p === 'D' && !used.has(p) && zoneOK(p, u));
    const monte = pool.filter(p => production(p) >= 1.3).sort((a, b) => scoreMoteur(b) - scoreMoteur(a)).slice(0, 30);
    const couvre = pool.filter(p => production(p) < 1.0).sort((a, b) => b.d - a.d).slice(0, 30);
    let best = null, bestVal = -Infinity;
    for (const a of monte) for (const b of couvre) {
      const cfg = naturel(a, 'DG') && naturel(b, 'DD') ? [a, b] : naturel(b, 'DG') && naturel(a, 'DD') ? [b, a] : null;
      if (!cfg || !budgetOK(a.$ + b.$ - 775_000)) continue;
      const syn = getUnitSynergy(essai(slots, cfg), 'D', u);
      const val = (scoreMoteur(a) + scoreMoteur(b)) * Math.exp(syn.bonusOff / 42) + 0.02 * (a.d + b.d) + 0.15 * syn.bonusDef - 0.02 * (a.$ + b.$) / 1e6;
      if (val > bestVal) { bestVal = val; best = cfg; }
    }
    best.forEach((p, i) => put(slots[i], p));
  }
  const gardiens = tous.filter(p => p.p === 'G' && p.gp >= 40).sort((a, b) => scoreMoteur(b) - scoreMoteur(a));
  for (const s of SLOTS.filter(s => s.group === 'G')) put(s, gardiens.find(p => !used.has(p) && budgetOK(p.$)));
  for (const s of SLOTS.filter(s => s.scratch)) {
    put(s, tous.filter(p => !used.has(p) && fits(p, s) && budgetOK(p.$)).sort((a, b) => scoreMoteur(b) - scoreMoteur(a))[0]);
  }
  return { roster, masse };
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

const saisons = fs.readdirSync(DIR).filter(x => x.endsWith('.json')).map(x => x.replace('.json', ''));
function adversaires(n) {
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
}

const SUJETS = [
  ['TIREURS (zones ignorées)', alignementDeTireurs, '52 : sous l\'empilement par valeur'],
  ['PARFAIT (zones et chimie)', alignementParfait, '68-70 : un peu au-dessus du Canadien de 1976-77'],
];
for (const [nom, bâtir, repère] of SUJETS) {
const { roster, masse } = bâtir();
console.log(`\n${nom} : ${(masse / 1e6).toFixed(1)} M$, valeur moyenne ${moy(Object.values(roster).map(p => getHiddenRatings(p).v)).toFixed(0)}\n`);

/* ---------- ce que chaque unité en fait ---------- */
const equipe = createTeam(nom, 'X', roster);
const profil = profilMatch(equipe, activeLineup(equipe));
console.log(`  pression d'équipe ${profil.pression.toFixed(2)} (référence ${REF.pression}) → lancers attendus × ${(profil.pression / REF.pression).toFixed(2)}`
  + ` · finition d'équipe ${profil.finEquipe.toFixed(2)} → ramenée × ${profil.finitionFacteur.toFixed(2)}\n`);
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
console.log(`  repère : ${repère}\n`);

/* ---------- la ligue et la Coupe, si demandé ---------- */
if (LIGUES > 0) {
  let coupes = 0;
  const W = [], rangs = [];
  for (let i = 0; i < LIGUES; i++) {
    const copie = {};
    for (const [k, p] of Object.entries(roster)) { const c = { ...p }; registerHiddenRatings(c); copie[k] = c; }
    const vous = createTeam(nom, 'YOU', copie, { isPlayer: true });
    const { standings } = simulateLeague([vous, ...adversaires(31)]);
    W.push(vous.W);
    rangs.push(standings.findIndex(t => t.isPlayer) + 1);
    let ronde = standings.slice(0, 16), n = 0;
    while (ronde.length > 1) {
      const suivant = [];
      for (let j = 0; j < ronde.length / 2; j++) suivant.push(playSeries(ronde[j], ronde[ronde.length - 1 - j], false, n).winner);
      ronde = suivant; n++;
    }
    if (ronde[0].isPlayer) coupes++;
  }
  console.log(`  LIGUE, ${LIGUES} ligues : V ${W.join(' ')} · rangs ${rangs.join(' ')} · Coupes ${coupes}/${LIGUES}\n`);
}
}
