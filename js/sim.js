/**
 * Structure de l'alignement et simulation de la saison.
 *
 * Calibration vérifiée avec 23 joueurs de cote uniforme (12 essais par palier),
 * voir le tableau dans CLAUDE.md et `node scripts/calibrate_sim.mjs`.
 * Toute modification des constantes doit être revalidée (voir PLAN.md, S3).
 */

import { getArchetype, getLineZone, getEraFactor, seasonGames, getSecondaryPosition } from './ratings.js';

export const CAP = 95_500_000;
export const REROLLS = { season: 6, team: 6, pass: 4 };

/* ---------- 23 joueurs : 4 trios, 3 paires, 2 gardiens, 3 réservistes ---------- */

export const SLOTS = [];
['Top 6', 'Top 6', 'Middle 6', 'Bottom 6'].forEach((label, unit) => {
  ['AG', 'C', 'AD'].forEach(role => SLOTS.push({ group: 'F', unit, role, label }));
});
['Top 4', 'Top 4', 'Bottom 4'].forEach((label, unit) => {
  ['DG', 'DD'].forEach(role => SLOTS.push({ group: 'D', unit, role, label }));
});
// Le partant et l'auxiliaire portent des unités différentes pour que la zone
// d'efficacité d'un gardien (partant numéro un / partant / auxiliaire) sache
// les distinguer. Le moteur, lui, ne filtre les gardiens que par groupe.
SLOTS.push({ group: 'G', unit: 0, role: 'Partant', label: 'Gardiens' });
SLOTS.push({ group: 'G', unit: 1, role: 'Auxiliaire', label: 'Gardiens' });
[['F', 'Réserve F'], ['D', 'Réserve D'], ['ANY', 'Réserve']].forEach(([group, role]) => {
  SLOTS.push({ group, unit: 0, role, label: 'Réservistes', scratch: true });
});
SLOTS.forEach((s, i) => { s.i = i; });

const RATINGS_VAULT = new Map();

export function getPlayerKey(p) {
  if (p._rk) return p._rk;
  if (p.id) return `${p.s}_${p.t}_${p.id}`;
  return `${p.s}_${p.t}_${p.n}_${p.p}`;
}

export function registerHiddenRatings(p) {
  if (!p) return;
  const key = getPlayerKey(p);
  p._rk = key;
  if (p.o !== undefined) {
    RATINGS_VAULT.set(key, {
      o: p.o, d: p.d, r: p.r, c: p.c, v: p.v, sp: p.sp
    });
    delete p.o;
    delete p.d;
    delete p.r;
    delete p.c;
    delete p.v;
    delete p.sp;
  }
}

export function getHiddenRatings(p) {
  if (!p) return { o: 50, d: 50, r: 50, c: 50, v: 50, sp: 50 };
  const key = getPlayerKey(p);
  if (RATINGS_VAULT.has(key)) return RATINGS_VAULT.get(key);
  return {
    o: p.o ?? 50,
    d: p.d ?? 50,
    r: p.r ?? 50,
    c: p.c ?? 50,
    v: p.v ?? 50,
    sp: p.sp ?? 50,
  };
}

export function getPositionPenalty(player, slot) {
  if (!slot || slot.scratch || slot.group === 'ANY') return 0;
  if (player.p === 'G') return slot.group === 'G' ? 0 : 999;

  const sec = getSecondaryPosition(player);

  if (player.p === 'D' || player.p === 'LD' || player.p === 'RD') {
    if (slot.group !== 'D' && slot.group !== 'LD' && slot.group !== 'RD') return 999;
    const np = (player.np === 'RD' || player.np === 'R' || player.p === 'RD') ? 'RD' : 'LD';
    const role = slot.role; // 'DG' (LD) or 'DD' (RD)
    const targetSide = role === 'DG' ? 'LD' : 'RD';
    if (np === targetSide || sec === targetSide) return 0;
    return 2; // Off-side D (-2)
  }
  if (slot.group !== 'F') return 999;

  const np = player.np || 'C';
  const role = slot.role; // 'AG', 'C', 'AD'

  const isPrimaryMatch = (role === 'C' && np === 'C') ||
    (role === 'AG' && (np === 'L' || np === 'AG')) ||
    (role === 'AD' && (np === 'R' || np === 'AD'));

  const isSecMatch = sec && (
    (role === 'C' && sec === 'C') ||
    (role === 'AG' && (sec === 'L' || sec === 'AG')) ||
    (role === 'AD' && (sec === 'R' || sec === 'AD'))
  );

  if (isPrimaryMatch || isSecMatch) return 0;

  if (np === 'C' || sec === 'C') {
    return 3; // Center playing wing (-3)
  }
  if (role === 'C') {
    return 5; // Winger playing center (-5)
  }
  return 2; // Opposite wing (-2)
}

/**
 * Un joueur peut-il occuper cette case ?
 *
 * Strict entre les groupes : un défenseur ne joue pas à l'aile et un
 * attaquant ne joue pas en défense. Les cases de réserviste `ANY` prennent
 * tout le monde. Les pénalités de `getPositionPenalty` servent aux
 * mauvaises ailes et au centre à l'aile — pas à mélanger les groupes, qui
 * donnait une pénalité de 999 et un joueur ramené à la cote plancher.
 */
export function fits(player, slot) {
  if (slot.group === 'ANY') return true;
  if (slot.group === 'G') return player.p === 'G';
  if (player.p === 'G') return false;
  const skaterIsD = player.p === 'D' || player.p === 'LD' || player.p === 'RD';
  if (slot.group === 'D' || slot.group === 'LD' || slot.group === 'RD') return skaterIsD;
  if (slot.group === 'F') return !skaterIsD;
  return false;
}

/* ---------- calcul de synergie des trios / paires ---------- */

export function getUnitSynergy(roster, group, unit) {
  const ps = SLOTS
    .filter(s => s.group === group && s.unit === unit && !s.scratch)
    .map(s => ({ slot: s, player: roster[s.i] }))
    .filter(x => x.player);

  const full = (group === 'F' && ps.length === 3) || (group === 'D' && ps.length === 2);
  if (!full) return { bonusOff: 0, bonusDef: 0, name: 'Neutre', desc: '', zone: null };

  // Les cotes sont hors de l'objet joueur (coffre) : on les passe explicitement
  const hidden = ps.map(x => getHiddenRatings(x.player));
  const archs = ps.map((x, i) => getArchetype(x.player, hidden[i]).key);

  // Zone d'efficacité : chaque joueur a un calibre (1er trio, 2e trio…) et
  // des trios où il rend à 100 %. Tout le monde à sa place -> bonus ;
  // au moins deux joueurs hors de leur zone -> malus.
  const inZone = ps.map((x, i) => getLineZone(x.player, hidden[i].v).idealUnits.includes(unit));
  const miscast = inZone.filter(ok => !ok).length;
  const unitWord = group === 'F' ? 'Trio' : 'Paire';
  let zone = null;
  if (miscast === 0) zone = { off: 2, def: 2, tag: group === 'F' ? '✨ Trio optimal' : '✨ Paire optimale' };
  else if (miscast >= 2) zone = { off: -2, def: -2, tag: group === 'F' ? '⚠️ Trio mal assorti' : '⚠️ Paire mal assortie' };

  const withZone = (bonusOff, bonusDef, name, desc) => ({
    bonusOff: bonusOff + (zone ? zone.off : 0),
    bonusDef: bonusDef + (zone ? zone.def : 0),
    name: zone ? `${name} · ${zone.tag}` : name,
    desc,
    zone: zone ? zone.tag : null,
    chem: name,
  });

  if (group === 'F') {
    const hasPM = archs.some(a => a === 'PLAYMAKER' || a === 'OFF_PLAYMAKER');
    const hasSniper = archs.some(a => a === 'SNIPER');
    const hasPower = archs.some(a => a === 'POWER_FWD' || a === 'ENERGY');
    const hasTwoWay = archs.some(a => a === 'TWO_WAY_FWD');

    if (hasPM && hasSniper && (hasPower || hasTwoWay)) {
      return withZone(4, 2, 'Chimie parfaite 🌟', 'Fabricant + Marqueur + Puissance/Complet');
    }
    if (hasPM && hasSniper) {
      return withZone(3, 0, 'Tandem moteur 🎯', 'Fabricant de jeu et marqueur combinés');
    }
    if (archs.filter(a => a === 'TWO_WAY_FWD' || a === 'ENERGY' || a === 'CHECKER' || a === 'POWER_FWD').length >= 2) {
      return withZone(0, 4, "Trio d'étouffement 🧱", 'Haute responsabilité défensive');
    }
    if (archs.filter(a => a === 'SNIPER').length === 3 || archs.filter(a => a === 'OFF_PLAYMAKER').length === 3) {
      return withZone(-2, -2, 'Conflit de rôles ⚠️', 'Même profil sur le même trio');
    }
    return withZone(1, 1, 'Chimie standard 👍', 'Complémentarité correcte');
  }

  // Paires de défenseurs
  const hasOffD = archs.some(a => a === 'OFF_D');
  const hasDefD = archs.some(a => a === 'DEF_D' || a === 'STAY_D');

  if (hasOffD && hasDefD) {
    return withZone(3, 3, 'Paire équilibrée ⚖️', 'Offensif + Défensif');
  }
  if (archs.filter(a => a === 'OFF_D').length === 2) {
    return withZone(3, -3, 'Paire hyper-offensive 🚀', 'Grave risque en repli');
  }
  if (archs.filter(a => a === 'DEF_D' || a === 'STAY_D').length === 2) {
    return withZone(-1, 4, 'Paire hermétique 🔒', 'Excellente sécurité');
  }
  return withZone(1, 1, `${unitWord} standard 👍`, 'Complémentarité fluide');
}

/* ---------- pondérations ---------- */
const effStat = (player, slot, key) => {
  const r = getHiddenRatings(player);
  return Math.max(25, r[key] - getPositionPenalty(player, slot));
};

function unitAvg(roster, group, unit, key) {
  const ps = SLOTS
    .filter(s => s.group === group && s.unit === unit && !s.scratch)
    .map(s => ({ slot: s, player: roster[s.i] }))
    .filter(x => x.player);
  if (!ps.length) return 50;

  const syn = getUnitSynergy(roster, group, unit);
  let bonus = 0;
  if (key === 'o') bonus = syn.bonusOff || 0;
  if (key === 'd') bonus = syn.bonusDef || 0;

  const base = ps.reduce((a, x) => a + effStat(x.player, x.slot, key), 0) / ps.length;
  return Math.max(20, Math.min(99, base + bonus));
}

const POIDS_TRIO  = [0.34, 0.28, 0.22, 0.16];  // le 4e trio compte pour vrai
const POIDS_PAIRE = [0.40, 0.34, 0.26];

const weighted = (roster, group, weights, key) =>
  weights.reduce((sum, w, i) => sum + w * unitAvg(roster, group, i, key), 0);

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

/* ---------- simulation de match unique entre 2 équipes ---------- */

export function simulateMatch(rosterA, rosterB, isHeavy = false) {
  const fOffA = weighted(rosterA, 'F', POIDS_TRIO, 'o');
  const fDefA = weighted(rosterA, 'F', POIDS_TRIO, 'd');
  const dOffA = weighted(rosterA, 'D', POIDS_PAIRE, 'o');
  const dDefA = weighted(rosterA, 'D', POIDS_PAIRE, 'd');
  const robA  = 0.6 * weighted(rosterA, 'F', POIDS_TRIO, 'r') + 0.4 * weighted(rosterA, 'D', POIDS_PAIRE, 'r');
  const cluA  = 0.6 * weighted(rosterA, 'F', POIDS_TRIO, 'c') + 0.4 * weighted(rosterA, 'D', POIDS_PAIRE, 'c');
  const goaliesA = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => rosterA[s.i]);
  const goalieA = goaliesA[0] || {};
  const rGA = getHiddenRatings(goalieA);

  const fOffB = weighted(rosterB, 'F', POIDS_TRIO, 'o');
  const fDefB = weighted(rosterB, 'F', POIDS_TRIO, 'd');
  const dOffB = weighted(rosterB, 'D', POIDS_PAIRE, 'o');
  const dDefB = weighted(rosterB, 'D', POIDS_PAIRE, 'd');
  const robB  = 0.6 * weighted(rosterB, 'F', POIDS_TRIO, 'r') + 0.4 * weighted(rosterB, 'D', POIDS_PAIRE, 'r');
  const cluB  = 0.6 * weighted(rosterB, 'F', POIDS_TRIO, 'c') + 0.4 * weighted(rosterB, 'D', POIDS_PAIRE, 'c');
  const goaliesB = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => rosterB[s.i]);
  const goalieB = goaliesB[0] || {};
  const rGB = getHiddenRatings(goalieB);

  const attA = 0.72 * fOffA + 0.28 * dOffA;
  const defA = 0.58 * dDefA + 0.42 * fDefA;
  const gA = 0.6 * rGA.o + 0.4 * rGA.d;

  const attB = 0.72 * fOffB + 0.28 * dOffB;
  const defB = 0.58 * dDefB + 0.42 * fDefB;
  const gB = 0.6 * rGB.o + 0.4 * rGB.d;

  const defenseA = 0.62 * defA + 0.38 * gA + (isHeavy ? (robA - 52) * 0.22 : 0);
  const defenseB = 0.62 * defB + 0.38 * gB + (isHeavy ? (robB - 52) * 0.22 : 0);

  const xGFA = Math.max(1.1, Math.min(7.5, 3.05 * Math.pow(attA / Math.max(20, defenseB), 1.55)));
  const xGFB = Math.max(1.1, Math.min(7.5, 3.05 * Math.pow(attB / Math.max(20, defenseA), 1.55)));

  let gfA = poisson(xGFA), gfB = poisson(xGFB);
  let ot = false;

  if (gfA === gfB) {
    ot = true;
    const diffClutch = cluA - cluB;
    const pClutch = 1 / (1 + Math.exp(-diffClutch / 9));
    if (Math.random() < pClutch) gfA++; else gfB++;
  }

  return { gfA, gfB, ot, winner: gfA > gfB ? 'A' : 'B' };
}

/* ---------- simulation ---------- */

export function simulate(roster) {
  const fOff = weighted(roster, 'F', POIDS_TRIO, 'o');
  const fDef = weighted(roster, 'F', POIDS_TRIO, 'd');
  const dOff = weighted(roster, 'D', POIDS_PAIRE, 'o');
  const dDef = weighted(roster, 'D', POIDS_PAIRE, 'd');
  const rob  = 0.6 * weighted(roster, 'F', POIDS_TRIO, 'r') + 0.4 * weighted(roster, 'D', POIDS_PAIRE, 'r');
  const clu  = 0.6 * weighted(roster, 'F', POIDS_TRIO, 'c') + 0.4 * weighted(roster, 'D', POIDS_PAIRE, 'c');

  const goalies = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => roster[s.i]).filter(Boolean);
  const starter = goalies[0] || { p: 'G' };
  const backup = goalies[1] || starter;

  // Initialiser les statistiques simulées individuelles
  for (const s of SLOTS) {
    const p = roster[s.i];
    if (p) {
      p.simGP = 0; p.simG = 0; p.simA = 0; p.simPTS = 0; p.simPM = 0;
      if (p.p === 'G') {
        p.simW = 0; p.simL = 0; p.simOTL = 0; p.simGA = 0; p.simSO = 0;
      }
    }
  }

  const activeSkaters = SLOTS
    .filter(s => s.group !== 'G' && !s.scratch && roster[s.i])
    .map(s => ({ slot: s, player: roster[s.i] }));

  const attaque = 0.72 * fOff + 0.28 * dOff;
  const brigade = 0.58 * dDef + 0.42 * fDef;

  let W = 0, L = 0, OTL = 0, GF = 0, GA = 0;

  for (let g = 0; g < 82; g++) {
    const goalie = (g % 6 === 5) ? backup : starter;   // ~14 départs pour l'auxiliaire
    const heavy  = (g % 4 === 3);                      // matchs éreintants

    goalie.simGP = (goalie.simGP || 0) + 1;
    for (const item of activeSkaters) item.player.simGP = (item.player.simGP || 0) + 1;

    const rG = getHiddenRatings(goalie);
    const defense = 0.62 * brigade
                  + 0.38 * (0.6 * rG.o + 0.4 * rG.d)
                  + (heavy ? (rob - 52) * 0.22 : 0);

    const xGF = Math.max(1.1, Math.min(7.5, 3.05 * Math.pow(attaque / 58, 1.55)));
    const xGA = Math.max(1.1, Math.min(7.5, 3.05 * Math.pow(58 / Math.max(20, defense), 1.55)));

    let gf = poisson(xGF), ga = poisson(xGA);
    let win = false, otl = false;

    if (gf === ga) {
      const pClutch = 1 / (1 + Math.exp(-(clu - 52) / 9));
      if (Math.random() < pClutch) { gf++; W++; win = true; } else { ga++; OTL++; otl = true; }
    } else if (gf > ga) { W++; win = true; } else { L++; }

    goalie.simGA += ga;
    if (win) goalie.simW++;
    else if (otl) goalie.simOTL++;
    else goalie.simL++;
    if (ga === 0) goalie.simSO++;

    // Distribuer les buts et passes de l'équipe
    for (let i = 0; i < gf; i++) {
      const unitRoll = Math.random();
      const unit = unitRoll < 0.34 ? 0 : unitRoll < 0.62 ? 1 : unitRoll < 0.84 ? 2 : 3;
      const unitPlayers = activeSkaters.filter(x => x.slot.unit === unit || x.slot.group === 'D');

      if (unitPlayers.length) {
        // Scorer
        const weights = unitPlayers.map(x => Math.pow(getHiddenRatings(x.player).o, 1.8));
        const totalW = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalW;
        let scorerIdx = 0;
        for (let j = 0; j < weights.length; j++) {
          r -= weights[j];
          if (r <= 0) { scorerIdx = j; break; }
        }
        const scorer = unitPlayers[scorerIdx].player;
        scorer.simG++;
        scorer.simPTS++;

        // Passers
        const passers = unitPlayers.filter((_, idx) => idx !== scorerIdx);
        if (passers.length && Math.random() < 0.88) {
          const p1 = passers[Math.floor(Math.random() * passers.length)].player;
          p1.simA++; p1.simPTS++;
          if (passers.length > 1 && Math.random() < 0.65) {
            const p2 = passers.find(x => x.player !== p1)?.player;
            if (p2) { p2.simA++; p2.simPTS++; }
          }
        }

        // +/- sur but marqué
        for (const item of unitPlayers) item.player.simPM++;
      }
    }

    // +/- sur but alloué
    for (let i = 0; i < ga; i++) {
      const unitRoll = Math.random();
      const unit = unitRoll < 0.34 ? 0 : unitRoll < 0.62 ? 1 : unitRoll < 0.84 ? 2 : 3;
      const unitPlayers = activeSkaters.filter(x => x.slot.unit === unit || x.slot.group === 'D');
      for (const item of unitPlayers) item.player.simPM--;
    }

    GF += gf; GA += ga;
  }

  return {
    W, L, OTL, GF, GA,
    points: W * 2 + OTL,
    attaque, brigade, rob, clu,
    gRating: 0.6 * getHiddenRatings(starter).o + 0.4 * getHiddenRatings(starter).d,
  };
}

/* ======================================================================
 *  Simulation de ligue complète
 *
 *  Toutes les équipes jouent leurs 82 matchs, une contre l'autre. Chaque
 *  match reprend le moteur Poisson ci-dessus, plus :
 *   - chance : bruit par match (log-normal sur λ) et « PDO » d'équipe pour
 *     la saison, tiré une fois ;
 *   - chimie : synergies d'archétypes + zones (getUnitSynergy) et
 *     continuité — un trio qui reste intact gagne jusqu'à +2 ;
 *   - blessures : probabilité par match d'après la part de matchs que le
 *     joueur a vraiment joués cette saison-là (un joueur à 40 PJ sur 82
 *     se blesse plus souvent), remplacé par un réserviste, sinon par un
 *     rappel de la ligue mineure (cote 40) ;
 *   - buts et passes distribués selon les vrais B/PJ et A/PJ du joueur
 *     cette année-là, ajustés à l'époque.
 * ====================================================================== */

const LUCK_GAME = 0.10;     // écart-type du bruit par match
const LUCK_SEASON = 0.035;  // écart-type du PDO d'équipe pour la saison
const REPLACEMENT = 40;     // cote d'un rappel de la ligue mineure
const CONTINUITY_MAX = 2;   // bonus max de continuité par unité
const CONTINUITY_GAMES = 25;

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Part des matchs joués par le joueur dans sa vraie saison (0-1). */
export function gpShare(p) {
  return Math.max(0, Math.min(1, (p.gp || 0) / seasonGames(p.s)));
}

/** Probabilité de blessure à un match donné. */
export function injuryChance(p, heavy = false) {
  const frail = 1 - gpShare(p);
  let pr = 0.0015 + 0.015 * frail * frail;
  if (p.p === 'G') pr *= 0.5;
  if (heavy) pr *= 1.5;
  return pr;
}

function injuryLength() {   // moyenne ~8 matchs, plafond 40
  let n = 1;
  while (n < 40 && Math.random() < 0.875) n++;
  return n;
}

export function initSimStats(p) {
  p.simGP = 0; p.simG = 0; p.simA = 0; p.simPTS = 0; p.simPM = 0; p.simInj = 0;
  if (p.p === 'G') { p.simW = 0; p.simL = 0; p.simOTL = 0; p.simGA = 0; p.simSO = 0; }
}

export function createTeam(name, tag, roster, opts = {}) {
  return {
    name, tag, roster,
    isPlayer: !!opts.isPlayer,
    season: opts.season || null,
    injured: new Map(),      // joueur -> matchs restants
    together: new Map(),     // unité -> matchs consécutifs intacts
    togetherSig: new Map(),
    injuriesLog: [],         // { player, games, at }
    luck: gauss() * LUCK_SEASON,
    W: 0, L: 0, OTL: 0, GF: 0, GA: 0, PTS: 0, games: 0,
    strength: null,
  };
}

/**
 * Alignement du jour : blessés retirés, réservistes promus à la première
 * case compatible, sinon case vide (rappel de cote 40).
 */
export function activeLineup(team) {
  const used = new Set();
  const lineup = {};
  const reserves = SLOTS.filter(s => s.scratch)
    .map(s => team.roster[s.i])
    .filter(p => p && !team.injured.has(p));
  for (const s of SLOTS) {
    if (s.scratch) continue;
    let p = team.roster[s.i];
    if (p && team.injured.has(p)) p = null;
    if (!p) {
      const sub = reserves.find(r => !used.has(r) && fits(r, s));
      if (sub) { p = sub; used.add(sub); }
    }
    lineup[s.i] = p || null;
  }
  return lineup;
}

function unitAvgLineup(team, lineup, group, unit, key) {
  const slots = SLOTS.filter(s => s.group === group && s.unit === unit && !s.scratch);
  let sum = 0;
  for (const s of slots) sum += lineup[s.i] ? effStat(lineup[s.i], s, key) : REPLACEMENT;
  let bonus = 0;
  if (key === 'o' || key === 'd') {
    const syn = getUnitSynergy(lineup, group, unit);
    bonus += key === 'o' ? (syn.bonusOff || 0) : (syn.bonusDef || 0);
    const tog = team.together.get(`${group}${unit}`) || 0;
    bonus += Math.min(CONTINUITY_MAX, tog / CONTINUITY_GAMES);
  }
  return Math.max(20, Math.min(99, sum / slots.length + bonus));
}

export function teamStrength(team, lineup = activeLineup(team)) {
  const w = (group, weights, key) =>
    weights.reduce((s, wt, i) => s + wt * unitAvgLineup(team, lineup, group, i, key), 0);
  const fOff = w('F', POIDS_TRIO, 'o'), fDef = w('F', POIDS_TRIO, 'd');
  const dOff = w('D', POIDS_PAIRE, 'o'), dDef = w('D', POIDS_PAIRE, 'd');
  const gs = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => lineup[s.i]);
  return {
    att: 0.72 * fOff + 0.28 * dOff,
    def: 0.58 * dDef + 0.42 * fDef,
    rob: 0.6 * w('F', POIDS_TRIO, 'r') + 0.4 * w('D', POIDS_PAIRE, 'r'),
    clu: 0.6 * w('F', POIDS_TRIO, 'c') + 0.4 * w('D', POIDS_PAIRE, 'c'),
    g: goalieRating(gs[0] || gs[1]),
  };
}

const goalieRating = g => g ? (0.6 * getHiddenRatings(g).o + 0.4 * getHiddenRatings(g).d) : REPLACEMENT;

function pickGoalie(lineup, gameIdx) {
  const gs = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => lineup[s.i]);
  const [starter, backup] = gs;
  const useBackup = gameIdx % 6 === 5;           // ~14 départs pour l'auxiliaire
  return (useBackup ? (backup || starter) : (starter || backup)) || null;
}

function pickUnit(weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

/** Cote offensive moyenne d'une unité telle qu'alignée (rappel = 40). */
function unitOff(lineup, group, unit) {
  const slots = SLOTS.filter(s => s.group === group && s.unit === unit && !s.scratch);
  return slots.reduce((a, s) => a + (lineup[s.i] ? getHiddenRatings(lineup[s.i]).o : REPLACEMENT), 0) / slots.length;
}

/**
 * Poids de présence sur la glace pour un but : temps de glace × qualité
 * offensive au carré — un premier trio dominant marque plus que sa part de
 * minutes, un quatrième trio de cote 45 presque rien.
 */
function scoringWeights(lineup) {
  return {
    F: POIDS_TRIO.map((w, u) => w * Math.pow(unitOff(lineup, 'F', u) / 60, 2)),
    D: POIDS_PAIRE.map((w, u) => w * Math.pow(unitOff(lineup, 'D', u) / 60, 2)),
  };
}

function onIce(lineup, weights = { F: POIDS_TRIO, D: POIDS_PAIRE }) {
  const fu = pickUnit(weights.F), du = pickUnit(weights.D);
  return SLOTS
    .filter(s => !s.scratch && ((s.group === 'F' && s.unit === fu) || (s.group === 'D' && s.unit === du)))
    .map(s => lineup[s.i]).filter(Boolean);
}

function weightedPick(list, wfn) {
  const ws = list.map(wfn);
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

const perGame = (p, k) => (p[k] || 0) / Math.max(1, p.gp || 1);

/** Buts, passes et +/- distribués sur l'alignement d'après la vraie production du joueur. */
function creditGoals(lineup, goalie, gf, ga, win, otl) {
  for (const p of Object.values(lineup)) if (p && p.p !== 'G') p.simGP++;
  if (goalie) {
    goalie.simGP++; goalie.simGA += ga;
    if (win) goalie.simW++; else if (otl) goalie.simOTL++; else goalie.simL++;
    if (ga === 0) goalie.simSO++;
  }
  const sw = scoringWeights(lineup);
  for (let i = 0; i < gf; i++) {
    const ice = onIce(lineup, sw);
    if (!ice.length) continue;
    const scorer = weightedPick(ice, p => perGame(p, 'g') * getEraFactor(p.s) + 0.02);
    scorer.simG++; scorer.simPTS++;
    const others = ice.filter(p => p !== scorer);
    if (others.length && Math.random() < 0.85) {
      const aW = p => (perGame(p, 'a') * getEraFactor(p.s) + 0.04) * (p.p === 'D' ? 0.7 : 1);
      const a1 = weightedPick(others, aW);
      a1.simA++; a1.simPTS++;
      const rest = others.filter(p => p !== a1);
      if (rest.length && Math.random() < 0.60) {
        const a2 = weightedPick(rest, aW);
        a2.simA++; a2.simPTS++;
      }
    }
    for (const p of ice) p.simPM++;
  }
  for (let i = 0; i < ga; i++) for (const p of onIce(lineup)) p.simPM--;
}

function updateTogether(team, lineup) {
  for (const group of ['F', 'D']) {
    for (let u = 0; u < (group === 'F' ? 4 : 3); u++) {
      const key = `${group}${u}`;
      const sig = SLOTS.filter(s => s.group === group && s.unit === u && !s.scratch)
        .map(s => lineup[s.i] ? getPlayerKey(lineup[s.i]) : '-').join('|');
      const intact = team.togetherSig.get(key) === sig && !sig.includes('-');
      team.together.set(key, intact ? (team.together.get(key) || 0) + 1 : 0);
      team.togetherSig.set(key, sig);
    }
  }
}

function applyInjuries(team, lineup, heavy) {
  for (const [p, n] of team.injured) {
    if (n <= 1) team.injured.delete(p); else team.injured.set(p, n - 1);
  }
  for (const p of Object.values(lineup)) {
    if (!p || team.injured.has(p)) continue;
    if (Math.random() < injuryChance(p, heavy)) {
      const n = injuryLength();
      team.injured.set(p, n);
      p.simInj = (p.simInj || 0) + n;
      team.injuriesLog.push({ player: p, games: n, at: team.games + 1 });
    }
  }
}

/**
 * Un match entre deux équipes. `track` = false pour les séries : pas de
 * stats individuelles ni de blessures.
 */
export function playGame(A, B, gameIdx, track = true) {
  const heavy = gameIdx % 4 === 3;
  const LA = activeLineup(A), LB = activeLineup(B);
  const sA = teamStrength(A, LA), sB = teamStrength(B, LB);
  const gA = pickGoalie(LA, A.games), gB = pickGoalie(LB, B.games);

  const defA = 0.62 * sA.def + 0.38 * goalieRating(gA) + (heavy ? (sA.rob - 52) * 0.22 : 0);
  const defB = 0.62 * sB.def + 0.38 * goalieRating(gB) + (heavy ? (sB.rob - 52) * 0.22 : 0);

  let xA = 3.05 * Math.pow(sA.att / Math.max(20, defB), 1.55);
  let xB = 3.05 * Math.pow(sB.att / Math.max(20, defA), 1.55);
  xA *= Math.exp(gauss() * LUCK_GAME + A.luck - B.luck);
  xB *= Math.exp(gauss() * LUCK_GAME + B.luck - A.luck);
  xA = Math.max(1.1, Math.min(7.5, xA));
  xB = Math.max(1.1, Math.min(7.5, xB));

  let gfA = poisson(xA), gfB = poisson(xB), ot = false;
  if (gfA === gfB) {
    ot = true;
    const p = 1 / (1 + Math.exp(-(sA.clu - sB.clu) / 9));
    if (Math.random() < p) gfA++; else gfB++;
  }
  const winA = gfA > gfB;

  if (track) {
    A.GF += gfA; A.GA += gfB; B.GF += gfB; B.GA += gfA;
    if (winA) { A.W++; if (ot) B.OTL++; else B.L++; }
    else { B.W++; if (ot) A.OTL++; else A.L++; }
    A.PTS = A.W * 2 + A.OTL; B.PTS = B.W * 2 + B.OTL;
    creditGoals(LA, gA, gfA, gfB, winA, !winA && ot);
    creditGoals(LB, gB, gfB, gfA, !winA, winA && ot);
    updateTogether(A, LA); updateTogether(B, LB);
    applyInjuries(A, LA, heavy); applyInjuries(B, LB, heavy);
    A.games++; B.games++;
  }
  return { gfA, gfB, ot, winner: winA ? A : B };
}

/**
 * Saison complète : chaque « ronde » apparie toutes les équipes au hasard,
 * 82 rondes -> 82 matchs par équipe. Nombre d'équipes pair requis.
 */
export function simulateLeague(teams, games = 82) {
  if (teams.length % 2) throw new Error("nombre d'équipes pair requis");
  for (const t of teams) {
    for (const s of SLOTS) if (t.roster[s.i]) initSimStats(t.roster[s.i]);
    t.strength = teamStrength(t);   // à pleine santé, pour les barres du résultat
  }
  for (let r = 0; r < games; r++) {
    const order = shuffle(teams.slice());
    for (let i = 0; i < order.length; i += 2) playGame(order[i], order[i + 1], r);
  }
  const standings = teams.slice().sort((a, b) =>
    b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF);
  const skaters = [];
  for (const t of teams) for (const s of SLOTS) {
    const p = t.roster[s.i];
    if (p && p.p !== 'G') skaters.push({ player: p, team: t });
  }
  const leaders = skaters.sort((a, b) => b.player.simPTS - a.player.simPTS || b.player.simG - a.player.simG).slice(0, 10);
  return { standings, leaders };
}

/** Série 4 de 7 entre deux équipes, sans stats ni blessures. */
export function playSeries(A, B) {
  let wA = 0, wB = 0, g = 0;
  while (wA < 4 && wB < 4) {
    const r = playGame(A, B, g++, false);
    if (r.winner === A) wA++; else wB++;
  }
  return { winner: wA === 4 ? A : B, wA, wB };
}

/**
 * Alignement automatique d'un vestiaire : chaque case prend le meilleur
 * joueur restant qui y convient (cote cachée moins pénalité de position),
 * premier trio d'abord. `exclude` = clés de joueurs à ne pas utiliser.
 */
export function autoRoster(pool, exclude = new Set()) {
  const avail = pool.filter(p => !exclude.has(getPlayerKey(p)));
  const roster = {};
  const used = new Set();
  for (const s of SLOTS) {
    let best = null, bestScore = -Infinity;
    for (const p of avail) {
      if (used.has(p) || !fits(p, s)) continue;
      const score = getHiddenRatings(p).v - getPositionPenalty(p, s) - (s.scratch ? 0 : 0);
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if (best) { roster[s.i] = best; used.add(best); }
  }
  return roster;
}
