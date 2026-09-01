/**
 * Structure de l'alignement et simulation de la saison.
 *
 * Calibration vérifiée avec 23 joueurs de cote uniforme (12 essais par palier) :
 *   cote 50 -> 24-53-5 | 60 -> 47-31-5 | 70 -> 67-13-1
 *   cote 80 -> 76-6-0  | 90 -> 80-2-0  | 99 -> 81-1-0
 * Toute modification des constantes doit être revalidée (voir PLAN.md, S3).
 */

import { getArchetype } from './ratings.js';

export const CAP = 95_500_000;
export const REROLLS = { season: 6, team: 6, pass: 4 };

/* ---------- 23 joueurs : 4 trios, 3 paires, 2 gardiens, 3 réservistes ---------- */

export const SLOTS = [];
['Premier trio', 'Deuxième trio', 'Troisième trio', 'Quatrième trio'].forEach((label, unit) => {
  ['AG', 'C', 'AD'].forEach(role => SLOTS.push({ group: 'F', unit, role, label }));
});
['Première paire', 'Deuxième paire', 'Troisième paire'].forEach((label, unit) => {
  ['DG', 'DD'].forEach(role => SLOTS.push({ group: 'D', unit, role, label }));
});
SLOTS.push({ group: 'G', unit: 0, role: 'Partant', label: 'Gardiens' });
SLOTS.push({ group: 'G', unit: 0, role: 'Auxiliaire', label: 'Gardiens' });
[['F', 'Réserve F'], ['D', 'Réserve D'], ['ANY', 'Réserve']].forEach(([group, role]) => {
  SLOTS.push({ group, unit: 0, role, label: 'Réservistes', scratch: true });
});
SLOTS.forEach((s, i) => { s.i = i; });

export function getPositionPenalty(player, slot) {
  if (!slot || slot.scratch || slot.group === 'ANY') return 0;
  if (player.p === 'G') return slot.group === 'G' ? 0 : 999;
  if (player.p === 'D') return slot.group === 'D' ? 0 : 999;
  if (slot.group !== 'F') return 999;

  const np = player.np || 'C';
  const role = slot.role; // 'AG', 'C', 'AD'

  if (np === 'C') {
    if (role === 'C') return 0;
    return 3; // Center playing wing (-3)
  }
  if (np === 'L') {
    if (role === 'AG') return 0;
    if (role === 'AD') return 2; // Opposite wing (-2)
    if (role === 'C') return 5;  // Winger at center (-5)
  }
  if (np === 'R') {
    if (role === 'AD') return 0;
    if (role === 'AG') return 2; // Opposite wing (-2)
    if (role === 'C') return 5;  // Winger at center (-5)
  }
  return 0;
}

export function fits(player, slot) {
  if (slot.group === 'ANY') return true;
  if (slot.group === 'G') return player.p === 'G';
  if (player.p === 'G') return false;
  return player.p === slot.group;
}

/* ---------- calcul de synergie des trios / paires ---------- */

export function getUnitSynergy(roster, group, unit) {
  const ps = SLOTS
    .filter(s => s.group === group && s.unit === unit && !s.scratch)
    .map(s => ({ slot: s, player: roster[s.i] }))
    .filter(x => x.player);

  if (group === 'F' && ps.length === 3) {
    const archs = ps.map(x => getArchetype(x.player).key);
    const hasPM = archs.some(a => a === 'PLAYMAKER' || a === 'OFF_PLAYMAKER');
    const hasSniper = archs.some(a => a === 'SNIPER');
    const hasPower = archs.some(a => a === 'POWER_FWD' || a === 'ENFORCER');
    const hasTwoWay = archs.some(a => a === 'TWO_WAY_FWD');

    if (hasPM && hasSniper && (hasPower || hasTwoWay)) {
      return { bonusOff: 4, bonusDef: 2, name: 'Chimie Parfaite 🌟', desc: 'Fabriqueur + Buteur + Power/Défensif' };
    }
    if (hasPM && hasSniper) {
      return { bonusOff: 3, bonusDef: 0, name: 'Tandem Moteur 🎯', desc: 'Passeur et Buteur combinés' };
    }
    if (archs.filter(a => a === 'TWO_WAY_FWD' || a === 'ENFORCER' || a === 'CHECKER').length >= 2) {
      return { bonusOff: 0, bonusDef: 4, name: 'Trio d\'Étouffement 🧱', desc: 'Haute responsabilité défensive' };
    }
    if (archs.filter(a => a === 'SNIPER').length === 3 || archs.filter(a => a === 'OFF_PLAYMAKER').length === 3) {
      return { bonusOff: -2, bonusDef: -2, name: 'Conflit de Rôles ⚠️', desc: 'Même profil sur le même trio' };
    }
    return { bonusOff: 1, bonusDef: 1, name: 'Chimie Standard 👍', desc: 'Complémentarité correcte' };
  }

  if (group === 'D' && ps.length === 2) {
    const archs = ps.map(x => getArchetype(x.player).key);
    const hasOffD = archs.some(a => a === 'OFF_D');
    const hasDefD = archs.some(a => a === 'DEF_D' || a === 'STAY_D');

    if (hasOffD && hasDefD) {
      return { bonusOff: 3, bonusDef: 3, name: 'Paire Équilibrée ⚖️', desc: 'Offensif + Défensif' };
    }
    if (archs.filter(a => a === 'OFF_D').length === 2) {
      return { bonusOff: 3, bonusDef: -3, name: 'Paire Hyper-Offensive 🚀', desc: 'Grave risque en repli' };
    }
    if (archs.filter(a => a === 'DEF_D' || a === 'STAY_D').length === 2) {
      return { bonusOff: -1, bonusDef: 4, name: 'Paire Hermétique 🔒', desc: 'Excellente sécurité' };
    }
    return { bonusOff: 1, bonusDef: 1, name: 'Paire Standard 👍', desc: 'Complémentarité fluide' };
  }

  return { bonusOff: 0, bonusDef: 0, name: 'Neutre', desc: '' };
}

/* ---------- pondérations ---------- */
const effStat = (player, slot, key) => Math.max(25, player[key] - getPositionPenalty(player, slot));

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
  const goalieA = goaliesA[0] || { o: 50, d: 50 };

  const fOffB = weighted(rosterB, 'F', POIDS_TRIO, 'o');
  const fDefB = weighted(rosterB, 'F', POIDS_TRIO, 'd');
  const dOffB = weighted(rosterB, 'D', POIDS_PAIRE, 'o');
  const dDefB = weighted(rosterB, 'D', POIDS_PAIRE, 'd');
  const robB  = 0.6 * weighted(rosterB, 'F', POIDS_TRIO, 'r') + 0.4 * weighted(rosterB, 'D', POIDS_PAIRE, 'r');
  const cluB  = 0.6 * weighted(rosterB, 'F', POIDS_TRIO, 'c') + 0.4 * weighted(rosterB, 'D', POIDS_PAIRE, 'c');
  const goaliesB = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => rosterB[s.i]);
  const goalieB = goaliesB[0] || { o: 50, d: 50 };

  const attA = 0.72 * fOffA + 0.28 * dOffA;
  const defA = 0.58 * dDefA + 0.42 * fDefA;
  const gA = 0.6 * goalieA.o + 0.4 * goalieA.d;

  const attB = 0.72 * fOffB + 0.28 * dOffB;
  const defB = 0.58 * dDefB + 0.42 * fDefB;
  const gB = 0.6 * goalieB.o + 0.4 * goalieB.d;

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

  const goalies = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => roster[s.i]);
  const [starter, backup] = goalies;

  const attaque = 0.72 * fOff + 0.28 * dOff;
  const brigade = 0.58 * dDef + 0.42 * fDef;

  let W = 0, L = 0, OTL = 0, GF = 0, GA = 0;

  for (let g = 0; g < 82; g++) {
    const goalie = (g % 6 === 5) ? backup : starter;   // ~14 départs pour l'auxiliaire
    const heavy  = (g % 4 === 3);                      // matchs éreintants

    const defense = 0.62 * brigade
                  + 0.38 * (0.6 * goalie.o + 0.4 * goalie.d)
                  + (heavy ? (rob - 52) * 0.22 : 0);

    const xGF = Math.max(1.1, Math.min(7.5, 3.05 * Math.pow(attaque / 58, 1.55)));
    const xGA = Math.max(1.1, Math.min(7.5, 3.05 * Math.pow(58 / Math.max(20, defense), 1.55)));

    let gf = poisson(xGF), ga = poisson(xGA);

    if (gf === ga) {
      // prolongation tranchée par le clutch
      const pClutch = 1 / (1 + Math.exp(-(clu - 52) / 9));
      if (Math.random() < pClutch) { gf++; W++; } else { ga++; OTL++; }
    } else if (gf > ga) { W++; } else { L++; }

    GF += gf; GA += ga;
  }

  return {
    W, L, OTL, GF, GA,
    points: W * 2 + OTL,
    attaque, brigade, rob, clu,
    gRating: 0.6 * starter.o + 0.4 * starter.d,
  };
}
