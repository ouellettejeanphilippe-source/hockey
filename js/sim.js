/**
 * Structure de l'alignement et simulation de la saison.
 *
 * Calibration vérifiée avec 23 joueurs de cote uniforme (12 essais par palier) :
 *   cote 50 -> 24-53-5 | 60 -> 47-31-5 | 70 -> 67-13-1
 *   cote 80 -> 76-6-0  | 90 -> 80-2-0  | 99 -> 81-1-0
 * Toute modification des constantes doit être revalidée (voir PLAN.md, S3).
 */

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

export function fits(player, slot) {
  if (slot.group === 'ANY') return true;
  if (slot.group === 'G') return player.p === 'G';
  if (player.p === 'G') return false;
  return player.p === slot.group;
}

/* ---------- pondérations ---------- */

const POIDS_TRIO  = [0.34, 0.28, 0.22, 0.16];  // le 4e trio compte pour vrai
const POIDS_PAIRE = [0.40, 0.34, 0.26];

function unitAvg(roster, group, unit, key) {
  const ps = SLOTS
    .filter(s => s.group === group && s.unit === unit && !s.scratch)
    .map(s => roster[s.i])
    .filter(Boolean);
  if (!ps.length) return 50;
  return ps.reduce((a, p) => a + p[key], 0) / ps.length;
}

const weighted = (roster, group, weights, key) =>
  weights.reduce((sum, w, i) => sum + w * unitAvg(roster, group, i, key), 0);

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
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
