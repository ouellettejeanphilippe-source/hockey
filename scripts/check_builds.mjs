/*
 * Combien de FAÇONS de bâtir mènent quelque part ?
 *
 * JP : *je veux que les joueurs défensifs et/ou robustes aient plus d'impact,
 * pour augmenter les builds possibles*. Ce script mesure exactement ça : cinq
 * alignements légaux sous le plafond, chacun bâti en glouton (le meilleur gain
 * par dollar, case par case) sur un OBJECTIF différent, puis joués par le vrai
 * moteur. Les gardiens se choisissent toujours sur la valeur, pour que seul le
 * choix des patineurs sépare les bâtis.
 *
 *   VALEUR      la valeur `v` — l'empilement de référence (check_plafond)
 *   OFFENSIF    la cote offensive `o`
 *   DÉFENSIF    la cote défensive `d`
 *   ROBUSTE     la robustesse `r`
 *   ÉQUILIBRÉ   (o + d + r) / 3
 *
 * Ce qu'on veut lire : un écart RAISONNABLE entre les bâtis. Si DÉFENSIF et
 * ROBUSTE finissent trente matchs sous VALEUR, il n'y a qu'une façon de jouer ;
 * s'ils finissent à quelques matchs, avec des saisons d'un autre style (moins
 * de buts des deux côtés, plus de séries gagnées), il y en a plusieurs.
 *
 *   node scripts/check_builds.mjs
 *   ESSAIS=12 LIGUES=4 node scripts/check_builds.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, CAP, simulate, registerHiddenRatings, getHiddenRatings, createTeam,
  simulateLeague, playSeries, autoRoster, teamStrength, generateur, grainerHasard,
} from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const ESSAIS = Number(process.env.ESSAIS ?? 8);
const LIGUES = Number(process.env.LIGUES ?? 0);
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* ---------- tous les joueurs-saisons à 60 matchs et plus ---------- */
const tous = [];
const saisons = fs.readdirSync(DIR).filter(x => x.endsWith('.json')).map(x => x.replace('.json', '')).sort();
for (const s of saisons) {
  for (const p of JSON.parse(fs.readFileSync(path.join(DIR, `${s}.json`), 'utf8')).players) {
    if ((p.gp || 0) < (p.p === 'G' ? 40 : 60)) continue;
    tous.push(p);
  }
}

/**
 * Glouton : on part des joueurs les moins chers, puis on remplace, tant que le
 * plafond le permet, celui dont le remplacement rapporte le plus de NOTE par
 * dollar. Même mécanique que `meilleurAlignementLegal`, la note en paramètre.
 */
function batir(note) {
  const BESOIN = { F: 12, D: 6, G: 2 };
  const roster = {};
  const n = p => (p.p === 'G' ? p.v : note(p));
  for (const [pos, k] of Object.entries(BESOIN)) {
    roster[pos] = tous.filter(p => p.p === pos).sort((a, b) => a.$ - b.$).slice(0, k);
  }
  let masse = Object.values(roster).flat().reduce((s, p) => s + p.$, 0);
  const cle = p => `${p.id}|${p.s}`;
  for (let tour = 0; tour < 4000; tour++) {
    let meilleur = null;
    for (const pos of Object.keys(BESOIN)) {
      const cur = roster[pos];
      const pire = cur.reduce((a, b) => (n(a) <= n(b) ? a : b));
      const ids = new Set(cur.map(cle));
      for (const c of tous) {
        if (c.p !== pos || ids.has(cle(c)) || n(c) <= n(pire)) continue;
        const cout = c.$ - pire.$;
        if (masse + cout > CAP) continue;
        const r = cout > 0 ? (n(c) - n(pire)) / cout : Infinity;
        if (!meilleur || r > meilleur.r) meilleur = { r, pos, pire, c, cout };
      }
    }
    if (!meilleur) break;
    roster[meilleur.pos] = roster[meilleur.pos].filter(p => p !== meilleur.pire).concat(meilleur.c);
    masse += meilleur.cout;
  }
  const pool = Object.values(roster).flat().map(p => ({ ...p }));
  pool.forEach(registerHiddenRatings);
  return { roster: autoRoster(pool), masse };
}

/*
 * Les bâtis sont la VALEUR INCLINÉE : la valeur `v` plus un penchant. Un
 * glouton pur sur `r` remplissait le vestiaire de bagarreurs à 99 pour 19 M$
 * et gagnait seize matchs — ce n'est pas un bâti, c'est une caricature. Un
 * joueur qui bâtit robuste prend de bons joueurs QUI SONT robustes ; c'est ce
 * que l'inclinaison (PENTE par point de sous-cote au-dessus de 50) exprime.
 * Les deux bâtis purs restent en bas, comme bornes.
 */
const PENTE = 0.6;
const BATIS = [
  ['VALEUR', p => p.v],
  ['OFFENSIF', p => p.v + PENTE * (p.o - 50)],
  ['DÉFENSIF', p => p.v + PENTE * (p.d - 50)],
  ['ROBUSTE', p => p.v + PENTE * (p.r - 50)],
  ['DÉF+ROB', p => p.v + PENTE * ((p.d + p.r) / 2 - 50)],
  ['pur d', p => p.d],
  ['pur r', p => p.r],
];

/* ---------- les adversaires, les mêmes pour tous (graine) ---------- */
function adversaires(n, alea) {
  const out = [], vus = new Set();
  while (out.length < n) {
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
    out.push(createTeam(`${tag} ${s}`, tag, autoRoster(pool), { season: s }));
  }
  return out;
}

/* ---------- la distribution des vraies équipes, pour situer ---------- */
{
  const rob = [], def = [];
  const alea = generateur('builds-reels');
  for (const t of adversaires(120, alea)) { const f = teamStrength(t); rob.push(f.rob); def.push(f.def); }
  const sd = a => { const m = moy(a); return Math.sqrt(moy(a.map(x => (x - m) ** 2))); };
  console.log(`\n120 vraies équipes alignées : robustesse ${moy(rob).toFixed(1)} ± ${sd(rob).toFixed(1)}, défensive ${moy(def).toFixed(1)} ± ${sd(def).toFixed(1)}`);
}

console.log(`\nbâti          M$   val   off   déf   rob  |  SOLO ${ESSAIS} saisons : V-D-DP      BP   BC${LIGUES ? `  |  LIGUE ${LIGUES} : V · rang · Coupes` : ''}`);
for (const [nom, note] of BATIS) {
  const { roster, masse } = batir(note);
  const ps = Object.values(roster);
  const cote = k => moy(ps.filter(p => p.p !== 'G').map(p => getHiddenRatings(p)[k]));
  const rs = [];
  grainerHasard(`builds-${nom}`);
  for (let i = 0; i < ESSAIS; i++) rs.push(simulate(roster));
  let ligue = '';
  if (LIGUES > 0) {
    let coupes = 0;
    const W = [], rangs = [];
    for (let i = 0; i < LIGUES; i++) {
      const copie = {};
      for (const [k, p] of Object.entries(roster)) { const c = { ...p }; registerHiddenRatings(c); copie[k] = c; }
      const vous = createTeam(nom, 'YOU', copie, { isPlayer: true });
      const adv = adversaires(31, generateur(`builds-ligue-${i}`));
      const { standings } = simulateLeague([vous, ...adv], 82, { graine: `builds-${nom}-${i}` });
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
    ligue = `  |  ${moy(W).toFixed(1)} · ${moy(rangs).toFixed(1)} · ${coupes}/${LIGUES}`;
  }
  console.log(`${nom.padEnd(11)} ${(masse / 1e6).toFixed(1).padStart(5)}  ${cote('v').toFixed(0).padStart(4)}  ${cote('o').toFixed(0).padStart(4)}  ${cote('d').toFixed(0).padStart(4)}  ${cote('r').toFixed(0).padStart(4)}  |  `
    + `${moy(rs.map(r => r.W)).toFixed(1)}-${moy(rs.map(r => r.L)).toFixed(1)}-${moy(rs.map(r => r.OTL)).toFixed(1)}`.padEnd(20)
    + `${moy(rs.map(r => r.GF)).toFixed(0).padStart(4)} ${moy(rs.map(r => r.GA)).toFixed(0).padStart(4)}${ligue}`);
}
console.log('');
