/**
 * Calcul des cotes cachées à partir des stats brutes d'une saison.
 *
 * Toute modification de formule ici DOIT incrémenter RATINGS_VERSION,
 * sinon des cotes calculées avec deux formules différentes se retrouvent
 * mélangées dans le cache IndexedDB.
 *
 * Utilisé par le navigateur (API en direct) ET par scripts/rate.mjs (build
 * des shards). Une seule implémentation, un seul endroit à corriger.
 */

export const RATINGS_VERSION = 11;

/* ---------- Plafonds / Masses salariales par époque (pour conversion en $ réel) ---------- */
export const SEASON_ERA_CAP = {
  '1970-71': 850_000,   '1971-72': 950_000,   '1972-73': 1_050_000, '1973-74': 1_150_000,
  '1974-75': 1_300_000, '1975-76': 1_450_000, '1976-77': 1_600_000, '1977-78': 1_750_000,
  '1978-79': 1_900_000, '1979-80': 2_100_000, '1980-81': 2_400_000, '1981-82': 2_700_000,
  '1982-83': 3_000_000, '1983-84': 3_400_000, '1984-85': 3_800_000, '1985-86': 4_200_000,
  '1986-87': 4_700_000, '1987-88': 5_200_000, '1988-89': 5_800_000, '1989-90': 6_500_000,
  '1990-91': 7_500_000, '1991-92': 8_800_000, '1992-93': 10_200_000,'1993-94': 12_000_000,
  '1994-95': 14_000_000,'1995-96': 16_000_000,'1996-97': 18_500_000,'1997-98': 21_000_000,
  '1998-99': 23_500_000,'1999-00': 26_000_000,'2000-01': 28_500_000,'2001-02': 31_000_000,
  '2002-03': 33_500_000,'2003-04': 36_000_000,'2005-06': 39_000_000,'2006-07': 44_000_000,
  '2007-08': 50_300_000,'2008-09': 56_700_000,'2009-10': 56_800_000,'2010-11': 59_400_000,
  '2011-12': 64_300_000,'2012-13': 60_000_000,'2013-14': 64_300_000,'2014-15': 69_000_000,
  '2015-16': 71_400_000,'2016-17': 73_000_000,'2017-18': 75_000_000,'2018-19': 79_500_000,
  '2019-20': 81_500_000,'2020-21': 81_500_000,'2021-22': 81_500_000,'2022-23': 82_500_000,
  '2023-24': 83_500_000,'2024-25': 88_000_000,'2025-26': 95_500_000,
};

export function getEraSalary(salary2026, season) {
  const eraCap = SEASON_ERA_CAP[season] || 95_500_000;
  const ratio = eraCap / 95_500_000;
  return Math.max(35_000, Math.round((salary2026 * ratio) / 10_000) * 10_000);
}

/* ---------- Moyennes de buts par saison (pour ajustement par époque) ---------- */
// Objectif moderne : ~3.15 buts par équipe par match (~6.30 buts/match au total)
export const SEASON_GOAL_AVG = {
  '1970-71': 3.12, '1971-72': 3.06, '1972-73': 3.28, '1973-74': 3.20, '1974-75': 3.43,
  '1975-76': 3.42, '1976-77': 3.32, '1977-78': 3.30, '1978-79': 3.50, '1979-80': 3.51,
  '1980-81': 3.84, '1981-82': 4.01, '1982-83': 3.86, '1983-84': 3.94, '1984-85': 3.89,
  '1985-86': 3.97, '1986-87': 3.67, '1987-88': 3.71, '1988-89': 3.74, '1989-90': 3.68,
  '1990-91': 3.46, '1991-92': 3.48, '1992-93': 3.63, '1993-94': 3.24, '1994-95': 2.99,
  '1995-96': 3.14, '1996-97': 2.92, '1997-98': 2.64, '1998-99': 2.63, '1999-00': 2.75,
  '2000-01': 2.76, '2001-02': 2.62, '2002-03': 2.65, '2003-04': 2.57, '2005-06': 3.08,
  '2006-07': 2.95, '2007-08': 2.78, '2008-09': 2.91, '2009-10': 2.84, '2010-11': 2.79,
  '2011-12': 2.73, '2012-13': 2.72, '2013-14': 2.74, '2014-15': 2.66, '2015-16': 2.71,
  '2016-17': 2.77, '2017-18': 2.97, '2018-19': 3.01, '2019-20': 3.02, '2020-21': 2.94,
  '2021-22': 3.14, '2022-23': 3.18, '2023-24': 3.11, '2024-25': 3.15,
};

export function getEraFactor(season) {
  const avg = SEASON_GOAL_AVG[season] || 3.15;
  return 3.15 / avg;
}

export function getArchetype(p) {
  if (!p) return { key: 'UNKNOWN', label: 'Inconnu', icon: '❓', desc: '' };
  if (p.p === 'G') {
    if (p.o >= 75 && p.d >= 75) return { key: 'WALL', label: 'Mur Hermétique', icon: '🧱', desc: '% d\'arrêts et moyenne d\'élite' };
    if (p.sp >= 72) return { key: 'ACROBAT', label: 'Réflexes Acrobatiques', icon: '⚡', desc: 'Réflexes et arrêts spectaculaires' };
    if (p.r >= 70) return { key: 'WORKHORSE', label: 'Gardien de Fer', icon: '🔋', desc: 'Grosse charge de travail' };
    return { key: 'HYBRID_G', label: 'Gardien Standard', icon: '🥅', desc: 'Style équilibré' };
  }

  if (p.p === 'D') {
    if (p.o >= 68 || (p.o > p.d + 10)) return { key: 'OFF_D', label: 'Défenseur Offensif', icon: '🚀', desc: 'Relance, tir et avantage numérique' };
    if (p.d >= 68 && p.r >= 60) return { key: 'DEF_D', label: 'Défenseur Physique', icon: '🛡️', desc: 'Défense hermétique et mises en échec' };
    if (p.d >= 62) return { key: 'STAY_D', label: 'Défenseur Défensif', icon: '🔒', desc: 'Sécurité et désavantage numérique' };
    return { key: 'TWO_WAY_D', label: 'Défenseur Mobile', icon: '🔄', desc: 'Jeu complet sur 200 pieds' };
  }

  // Forward (F)
  const pt = p.pt || 0;
  const gp = Math.max(1, p.gp || 1);
  const gRatio = pt > 0 ? (p.g / pt) : 0;
  const aRatio = pt > 0 ? (p.a / pt) : 0;

  if (p.o >= 75 && aRatio >= 0.55) return { key: 'OFF_PLAYMAKER', label: "Fabricant d'Élite", icon: '🪄', desc: 'Vision du jeu et passes magistrales' };
  if (p.o >= 55 && (gRatio >= 0.45 || (p.g / gp) >= 0.35)) return { key: 'SNIPER', label: 'Buteur / Sniper', icon: '🎯', desc: 'Finition redoutable et lancer précis' };
  if (p.o >= 55 && aRatio >= 0.54) return { key: 'PLAYMAKER', label: 'Fabricant de Jeu', icon: '🎯', desc: 'Distribue la rondelle avec précision' };
  if (p.r >= 58 && p.o >= 50) return { key: 'POWER_FWD', label: 'Attaquant de Puissance', icon: '💥', desc: 'Marque dans le trafic et frappe fort' };
  if (p.d >= 55) return { key: 'TWO_WAY_FWD', label: 'Attaquant Polyvalent', icon: '⚖️', desc: 'Responsable dans les deux sens de la patinoire' };
  if (p.r >= 60) return { key: 'ENFORCER', label: 'Homme Fort', icon: '🥊', desc: 'Physique intimidant et présence intense' };
  if (p.o >= 50) return { key: 'SKILLED_FWD', label: 'Attaquant Offensif', icon: '✨', desc: 'Aisance offensive naturelle' };

  return { key: 'CHECKER', label: 'Attaquant de Soutien', icon: '🏃', desc: 'Profondeur et ardeur au travail' };
}

/* ---------- outils statistiques ---------- */

function zfn(values) {
  const clean = values.filter(v => v !== null && v !== undefined && !Number.isNaN(v));
  if (clean.length < 2) return () => 0;
  const mu = clean.reduce((a, b) => a + b, 0) / clean.length;
  const varr = clean.reduce((a, b) => a + (b - mu) ** 2, 0) / clean.length;
  const sd = Math.sqrt(varr) || 1e-6;
  return x => (x === null || x === undefined || Number.isNaN(x)) ? 0 : (x - mu) / sd;
}

function scale(z, center = 52, spread = 13, lo = 25, hi = 99) {
  return Math.max(lo, Math.min(hi, Math.round(center + spread * z)));
}

const per = (row, key) => (row[key] || 0) / (row.gamesPlayed || 1);

/**
 * Salaire dérivé de la cote globale, sur l'échelle salariale actuelle.
 * cote 50 -> ~0,78 M$ | cote 75 -> ~4,0 M$ | cote 90 -> ~10,7 M$ | cote 99 -> ~19 M$
 */
export function salaryFor(ovr, pos) {
  let base = 775000 * Math.exp(0.0655 * Math.max(0, ovr - 50));
  if (pos === 'G') base *= 0.88;
  return Math.round(base / 25000) * 25000;
}

export function capPctFor(salary) {
  return Math.round((salary / 95_500_000) * 1000) / 10;
}

/* ---------- patineurs ---------- */

export function rateSkaters(rows, realtimeById = null) {
  const rt = id => (realtimeById && realtimeById[id]) || null;
  const hasRT = realtimeById && Object.keys(realtimeById).length > 0;

  const z = {
    pts:    zfn(rows.map(r => per(r, 'points'))),
    shots:  zfn(rows.map(r => per(r, 'shots'))),
    pp:     zfn(rows.map(r => per(r, 'ppPoints'))),
    pm:     zfn(rows.map(r => per(r, 'plusMinus'))),
    sh:     zfn(rows.map(r => per(r, 'shPoints'))),
    pim:    zfn(rows.map(r => per(r, 'penaltyMinutes'))),
    toi:    zfn(rows.map(r => (r.timeOnIcePerGame || 0) / 60)),
    gwg:    zfn(rows.map(r => ((r.gameWinningGoals || 0) + (r.otGoals || 0)) / (r.gamesPlayed || 1))),
    hits:   hasRT ? zfn(rows.filter(r => rt(r.playerId)).map(r => (rt(r.playerId).hits || 0) / (r.gamesPlayed || 1))) : () => 0,
    blocks: hasRT ? zfn(rows.filter(r => rt(r.playerId)).map(r => (rt(r.playerId).blockedShots || 0) / (r.gamesPlayed || 1))) : () => 0,
  };

  return rows.map(r => {
    const gp = r.gamesPlayed || 0;
    if (gp <= 0) return null;

    const isD = r.positionCode === 'D';
    const natural = isD
      ? (r.shootsCatches === 'R' ? 'RD' : 'LD')
      : (r.positionCode || 'C');
    const extra = rt(r.playerId);
    const toiMin = (r.timeOnIcePerGame || 0) / 60;

    // OFFENSIVE
    const zOff = 0.62 * z.pts(per(r, 'points'))
               + 0.22 * z.shots(per(r, 'shots'))
               + 0.16 * z.pp(per(r, 'ppPoints'));

    // DÉFENSIVE — +/-, buts en désavantage, temps de glace, tirs bloqués
    let zDef = 0.45 * z.pm(per(r, 'plusMinus'))
             + 0.20 * z.sh(per(r, 'shPoints'))
             + 0.35 * z.toi(toiMin);
    if (extra) {
      zDef = 0.70 * zDef + 0.30 * z.blocks((extra.blockedShots || 0) / gp);
    }
    if (isD) zDef += 0.35;  // bonus positionnel

    // ROBUSTESSE
    let zRob = z.pim(per(r, 'penaltyMinutes'));
    if (extra) {
      zRob = 0.45 * zRob + 0.55 * z.hits((extra.hits || 0) / gp);
    }

    // CLUTCH — buts gagnants et en prolongation
    const zClu = 0.75 * z.gwg(((r.gameWinningGoals || 0) + (r.otGoals || 0)) / gp)
               + 0.25 * z.pts(per(r, 'points'));

    const zSp = 0.50 * z.toi(toiMin) + 0.30 * z.shots(per(r, 'shots')) + 0.20 * z.sh(per(r, 'shPoints'));
    const sp = scale(zSp, 52, 12);

    const o = scale(zOff);
    const d = scale(zDef);
    const rb = scale(zRob, 50, 12);
    const c = scale(zClu, 50, 12);

    const v = Math.max(25, Math.min(99, Math.round(
      isD ? 0.32 * o + 0.46 * d + 0.11 * rb + 0.11 * c
          : 0.54 * o + 0.24 * d + 0.10 * rb + 0.12 * c
    )));

    const htPerGame = extra && extra.hits != null ? Math.round((extra.hits / gp) * 10) / 10 : null;
    const foPct = r.faceoffWinPct != null ? Math.round(r.faceoffWinPct * 1000) / 1000 : null;
    const sal = salaryFor(v, natural);

    return {
      id: r.playerId || null,
      n: r.skaterFullName,
      p: isD ? 'D' : 'F',
      np: natural,
      gp,
      g: r.goals || 0,
      a: r.assists || 0,
      pt: r.points || 0,
      pm: r.plusMinus || 0,
      pim: r.penaltyMinutes || 0,
      ht: htPerGame,
      fo: foPct,
      toi: Math.round(toiMin * 10) / 10,
      o, d, r: rb, c, sp, v,
      $: sal,
      cp: capPctFor(sal),
      teams: (r.teamAbbrevs || '???').split(',').map(s => s.trim()),
    };
  }).filter(Boolean);
}

/* ---------- gardiens ---------- */

export function rateGoalies(rows) {
  const z = {
    svp:  zfn(rows.map(r => r.savePct)),
    gaa:  zfn(rows.map(r => r.goalsAgainstAverage)),
    gp:   zfn(rows.map(r => r.gamesPlayed)),
    so:   zfn(rows.map(r => (r.shutouts || 0) / (r.gamesPlayed || 1))),
    wpct: zfn(rows.map(r => (r.wins || 0) / (r.gamesPlayed || 1))),
  };

  return rows.map(r => {
    const gp = r.gamesPlayed || 0;
    if (gp <= 0) return null;

    const o = scale(z.svp(r.savePct));                                    // Technique
    const d = scale(r.goalsAgainstAverage != null ? -z.gaa(r.goalsAgainstAverage) : 0);  // Blindage
    const rb = scale(z.gp(gp), 50, 12);                                   // Charge de travail
    const c = scale(0.6 * z.so((r.shutouts || 0) / gp)
                  + 0.4 * z.wpct((r.wins || 0) / gp), 50, 12);            // Clutch
    const rf = scale(0.7 * z.svp(r.savePct) + 0.3 * (r.goalsAgainstAverage != null ? -z.gaa(r.goalsAgainstAverage) : 0), 52, 12); // Réflexes

    const v = Math.max(25, Math.min(99, Math.round(
      0.42 * o + 0.34 * d + 0.09 * rb + 0.15 * c
    )));
    const sal = salaryFor(v, 'G');

    return {
      id: r.playerId || null,
      n: r.goalieFullName,
      p: 'G',
      np: 'G',
      gp,
      w: r.wins || 0,
      l: r.losses || 0,
      sv: r.savePct != null ? Math.round(r.savePct * 1000) / 1000 : null,
      ga: r.goalsAgainstAverage != null ? Math.round(r.goalsAgainstAverage * 100) / 100 : null,
      so: r.shutouts || 0,
      o, d, r: rb, c, sp: rf, v,
      $: sal,
      cp: capPctFor(sal),
      teams: (r.teamAbbrevs || '???').split(',').map(s => s.trim()),
    };
  }).filter(Boolean);
}

/**
 * Assemble un shard de saison. Un joueur échangé est dupliqué dans le
 * vestiaire de CHAQUE équipe où il a passé, marqué x:1.
 */
export function buildSeasonShard(label, skaterRows, goalieRows, realtimeById, minGP) {
  const skaters = skaterRows.filter(r => (r.gamesPlayed || 0) >= minGP);
  const goalies = goalieRows.filter(r => (r.gamesPlayed || 0) >= minGP);

  const entries = [];
  for (const rec of [...rateSkaters(skaters, realtimeById), ...rateGoalies(goalies)]) {
    const { teams, ...base } = rec;
    for (const t of teams) {
      entries.push({ ...base, t, s: label, x: teams.length > 1 ? 1 : 0 });
    }
  }
  return { season: label, minGP, v: RATINGS_VERSION, players: entries };
}
