/**
 * Calcul des cotes cachées à partir des stats brutes d'une saison.
 *
 * Toute modification de formule ici DOIT incrémenter RATINGS_VERSION,
 * sinon des cotes calculées avec deux formules différentes se retrouvent
 * mélangées dans le cache IndexedDB.
 *
 * Utilisé par le navigateur (API en direct), par scripts/rate.mjs (build
 * des shards depuis l'API) ET par scripts/rerate.mjs (recalcul hors ligne
 * de la cote globale, du salaire, de l'archétype et de la zone de trio à
 * partir des sous-cotes déjà dans les shards). Une seule implémentation,
 * un seul endroit à corriger.
 *
 * Deux étages :
 *   1. rateSkaters / rateGoalies — sous-cotes o, d, r, c, sp en z-score
 *      contre les contemporains de la saison. Exige les stats brutes.
 *   2. finalizeSeason — cote globale (v), salaire ($), archétype (ak) et
 *      zone de trio (lz). N'exige que les sous-cotes et les stats du
 *      shard, donc rejouable hors ligne.
 */

export const RATINGS_VERSION = 15;

/** Plafond de référence du jeu (2025-26), en dollars. */
export const CAP_REF = 95_500_000;

/* ---------- Plafond (ou plus gros budget d'équipe) par saison ----------
 *
 * 2005-06 et après : plafond officiel de la LNH.
 * 1989-90 à 2003-04 : pas de plafond. On prend la masse salariale de
 *   l'équipe la plus dépensière de l'année comme « plafond » de référence,
 *   pour que le prorata vers 2026 reflète ce que payait vraiment le marché.
 * Avant 1989-90 : estimation, les salaires n'étaient pas publiés.
 */
export const SEASON_ERA_CAP = {
  '1970-71': 850_000,   '1971-72': 950_000,   '1972-73': 1_050_000, '1973-74': 1_150_000,
  '1974-75': 1_300_000, '1975-76': 1_450_000, '1976-77': 1_600_000, '1977-78': 1_750_000,
  '1978-79': 1_900_000, '1979-80': 2_100_000, '1980-81': 2_400_000, '1981-82': 2_700_000,
  '1982-83': 3_000_000, '1983-84': 3_400_000, '1984-85': 3_800_000, '1985-86': 4_200_000,
  '1986-87': 4_700_000, '1987-88': 5_200_000, '1988-89': 5_800_000,
  // plus gros budget d'équipe de la saison (pas de plafond), mesuré sur les
  // salaires publiés de MarkerZone (scripts/fetch_markerzone.py) ; 1994-95
  // est proraté sur les 48 matchs du lock-out, comme les salaires eux-mêmes
  '1989-90': 8_500_000, '1990-91': 10_100_000,'1991-92': 13_000_000,'1992-93': 16_200_000,
  '1993-94': 22_200_000,'1994-95': 16_100_000,'1995-96': 37_700_000,'1996-97': 41_900_000,
  '1997-98': 45_700_000,'1998-99': 57_400_000,'1999-00': 61_300_000,'2000-01': 60_700_000,
  '2001-02': 74_600_000,'2002-03': 72_100_000,'2003-04': 83_900_000,
  // plafond officiel
  '2005-06': 39_000_000,'2006-07': 44_000_000,'2007-08': 50_300_000,'2008-09': 56_700_000,
  '2009-10': 56_800_000,'2010-11': 59_400_000,'2011-12': 64_300_000,'2012-13': 60_000_000,
  '2013-14': 64_300_000,'2014-15': 69_000_000,'2015-16': 71_400_000,'2016-17': 73_000_000,
  '2017-18': 75_000_000,'2018-19': 79_500_000,'2019-20': 81_500_000,'2020-21': 81_500_000,
  '2021-22': 81_500_000,'2022-23': 82_500_000,'2023-24': 83_500_000,'2024-25': 88_000_000,
  '2025-26': 95_500_000,
};

/** Vrai si des salaires publiés existent pour la saison (1989-90 et après). */
export function isRealEra(season) {
  if (!season) return false;
  const year = parseInt(season.slice(0, 4), 10);
  return year >= 1989;
}

export function eraCapFor(season) {
  return SEASON_ERA_CAP[season] || CAP_REF;
}

/** Salaire 2026 -> salaire de l'époque, au prorata du plafond de l'année. */
export function getEraSalary(salary2026, season, refCap = null) {
  const eraCap = refCap || eraCapFor(season);
  const ratio = eraCap / CAP_REF;
  return Math.max(35_000, Math.round((salary2026 * ratio) / 10_000) * 10_000);
}

/** Salaire de l'époque -> salaire 2026, au prorata du plafond de l'année. */
export function getModernSalary(eraSalary, season, refCap = null) {
  const eraCap = refCap || eraCapFor(season);
  return Math.max(775_000, Math.round((eraSalary * CAP_REF / eraCap) / 25_000) * 25_000);
}

/* ---------- Lissage des salaires réels d'avant le plafond ----------
 *
 * Avant 2005-06, la référence du prorata est l'équipe la plus dépensière,
 * et une équipe médiane de l'époque revient à ~50 M$ 2026 : le plafond ne
 * mord presque plus. On garde les écarts individuels (aubaines, contrats
 * trop chers) mais on rapproche le niveau de celui d'aujourd'hui : le
 * salaire du jeu est un mélange entre le prorata et la valeur qu'occupe le
 * même rang centile dans les cap hits réels de 2023-24 à 2025-26.
 *
 *   $ = (1 - LISSAGE_AVANT_PLAFOND) * prorata + LISSAGE_AVANT_PLAFOND * centile
 *
 * 0 = prorata pur (équipe médiane ~50 M$), 1 = rang pur (~80 M$, écarts
 * individuels effacés). À 0,5 l'équipe médiane des années 1990 revient à
 * 64-68 M$ et Brett Hull 1989-90 reste une aubaine.
 */
export const LISSAGE_AVANT_PLAFOND = 0.5;

/** Cap hits réels 2023-24 à 2025-26 au prorata de 95,5 M$, centiles 0 à 100. */
export const SALAIRE_REF_CENTILES = [
  775_000, 775_000, 775_000, 800_000, 825_000, 850_000, 850_000, 850_000,
  850_000, 850_000, 875_000, 875_000, 875_000, 875_000, 875_000, 875_000,
  875_000, 900_000, 900_000, 925_000, 925_000, 925_000, 925_000, 950_000,
  950_000, 950_000, 975_000, 975_000, 975_000, 975_000, 1_000_000, 1_000_000,
  1_025_000, 1_025_000, 1_050_000, 1_050_000, 1_075_000, 1_125_000, 1_150_000, 1_250_000,
  1_250_000, 1_350_000, 1_450_000, 1_525_000, 1_625_000, 1_725_000, 1_850_000, 2_000_000,
  2_050_000, 2_175_000, 2_275_000, 2_450_000, 2_525_000, 2_725_000, 2_825_000, 2_925_000,
  3_000_000, 3_150_000, 3_250_000, 3_325_000, 3_425_000, 3_525_000, 3_700_000, 3_775_000,
  3_900_000, 4_000_000, 4_175_000, 4_350_000, 4_400_000, 4_550_000, 4_600_000, 4_825_000,
  4_975_000, 5_075_000, 5_150_000, 5_400_000, 5_425_000, 5_550_000, 5_725_000, 5_850_000,
  6_000_000, 6_250_000, 6_300_000, 6_500_000, 6_700_000, 6_850_000, 7_050_000, 7_150_000,
  7_450_000, 7_750_000, 8_000_000, 8_250_000, 8_525_000, 8_825_000, 9_050_000, 9_300_000,
  9_725_000, 10_300_000, 10_875_000, 11_950_000, 14_400_000,
];

/** Salaire moderne qu'occupe le rang centile q (0..1) parmi les salaires réels d'aujourd'hui. */
export function salaryAtQuantile(q) {
  const x = clamp(q, 0, 1) * 100;
  const i = Math.min(99, Math.floor(x));
  const t = x - i;
  return SALAIRE_REF_CENTILES[i] * (1 - t) + SALAIRE_REF_CENTILES[i + 1] * t;
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

/* ---------- Archétypes classiques ---------- */

export const ARCHETYPES = {
  // Attaquants
  OFF_PLAYMAKER: { label: "Fabricant de jeu d'élite", short: 'Fabricant élite', icon: '🪄', desc: 'Vision du jeu et passes magistrales' },
  SNIPER:        { label: 'Franc-tireur / Marqueur',   short: 'Franc-tireur',    icon: '🎯', desc: 'Lancer foudroyant et finition d\'élite' },
  PLAYMAKER:     { label: 'Fabricant de jeu',          short: 'Fabricant',       icon: '🎨', desc: 'Distribue la rondelle avec précision' },
  POWER_FWD:     { label: 'Attaquant de puissance',    short: 'Puissance',       icon: '💥', desc: 'Marque dans le trafic et frappe fort' },
  TWO_WAY_FWD:   { label: 'Attaquant complet',         short: 'Complet',         icon: '⚖️', desc: 'Responsable dans les deux sens de la patinoire' },
  ENERGY:        { label: "Joueur d'énergie",          short: 'Énergie',         icon: '🔋', desc: 'Intensité, échec avant et mises en échec' },
  SKILLED_FWD:   { label: 'Attaquant offensif',        short: 'Offensif',        icon: '✨', desc: 'Aisance offensive naturelle' },
  CHECKER:       { label: 'Attaquant de profondeur',   short: 'Profondeur',      icon: '🏃', desc: 'Profondeur et ardeur au travail' },
  // Défenseurs
  OFF_D:         { label: 'Défenseur offensif',        short: 'Offensif',        icon: '🚀', desc: 'Relance, tir frappé et avantage numérique' },
  DEF_D:         { label: 'Défenseur physique',        short: 'Physique',        icon: '🛡️', desc: 'Jeu physique et protection du territoire' },
  STAY_D:        { label: 'Défenseur défensif',        short: 'Défensif',        icon: '🔒', desc: 'Sécurité et désavantage numérique' },
  TWO_WAY_D:     { label: 'Défenseur polyvalent',      short: 'Polyvalent',      icon: '🔄', desc: 'Efficace dans toutes les situations' },
  CHECKER_D:     { label: 'Défenseur de profondeur',   short: 'Profondeur',      icon: '🧱', desc: 'Fiabilité et minutes tranquilles' },
  // Gardiens
  WALL:          { label: "Gardien d'élite",           short: 'Élite',           icon: '🧱', desc: '% d\'arrêts et moyenne d\'élite' },
  ACROBAT:       { label: 'Gardien acrobatique',       short: 'Acrobate',        icon: '⚡', desc: 'Réflexes et arrêts spectaculaires' },
  WORKHORSE:     { label: 'Gardien de fer',            short: 'De fer',          icon: '🔋', desc: 'Grosse charge de travail' },
  HYBRID_G:      { label: 'Gardien régulier',          short: 'Régulier',        icon: '🥅', desc: 'Style fiable et constant' },
  UNKNOWN:       { label: 'Inconnu',                   short: 'Inconnu',         icon: '❓', desc: '' },
};

/**
 * Clé d'archétype à partir des sous-cotes et des stats.
 * `r` = objet de cotes { o, d, r, c, sp } ; `p` = fiche (p, g, a, pt).
 */
export function archetypeKey(p, r) {
  if (!p || !r) return 'UNKNOWN';
  if (p.p === 'G') {
    if (r.o >= 66 && r.d >= 66) return 'WALL';
    if ((r.sp ?? 0) >= 62) return 'ACROBAT';
    if (r.r >= 60) return 'WORKHORSE';
    return 'HYBRID_G';
  }

  if (p.p === 'D') {
    if (r.o >= 64 || r.o > r.d + 8) return 'OFF_D';
    if (r.d >= 62 && r.r >= 57) return 'DEF_D';
    if (r.d >= 61) return 'STAY_D';
    if (r.o >= 48 && r.d >= 54) return 'TWO_WAY_D';
    return 'CHECKER_D';
  }

  // Attaquants
  const pts = Math.max(1, p.pt || ((p.g || 0) + (p.a || 0)));
  const gRatio = (p.g || 0) / pts;
  const aRatio = (p.a || 0) / pts;

  // Vedettes : passeur ou marqueur, selon la part de buts
  if (r.o >= 76) return aRatio >= 0.55 ? 'OFF_PLAYMAKER' : 'SNIPER';
  if (r.o >= 60) {
    if (gRatio >= 0.47) return 'SNIPER';
    if (aRatio >= 0.60) return 'PLAYMAKER';
    if (r.r >= 58) return 'POWER_FWD';
    if (r.d >= 60) return 'TWO_WAY_FWD';
    return 'SKILLED_FWD';
  }
  if (r.r >= 58 && r.o >= 52) return 'POWER_FWD';
  if (r.d >= 57) return 'TWO_WAY_FWD';
  if (r.r >= 58) return 'ENERGY';
  if (r.o >= 52) return 'SKILLED_FWD';
  return 'CHECKER';
}

/**
 * Archétype d'un joueur. Lit p.ak (posé par finalizeSeason, présent dans
 * les shards) et retombe sur un calcul à partir de `ratings` sinon — les
 * cotes sont retirées de l'objet joueur dans le navigateur, il faut donc
 * passer getHiddenRatings(p) quand p.ak manque.
 */
export function getArchetype(p, ratings = null) {
  if (!p) return { key: 'UNKNOWN', ...ARCHETYPES.UNKNOWN };
  const key = p.ak || archetypeKey(p, ratings || (p.o !== undefined ? p : null));
  return { key, ...(ARCHETYPES[key] || ARCHETYPES.UNKNOWN) };
}

/* ---------- Zones de trio (calibre) ---------- */

/*
 * Calibre déduit de la cote globale. Seuils calés sur la distribution de
 * toutes les saisons (voir PLAN.md) :
 *   attaquants — 1er trio ≈ 13 % du haut, 2e ≈ 22 % suivants, 3e ≈ 30 %, 4e le reste
 *   défenseurs — 1re paire ≈ 20 %, 2e ≈ 25 %, 3e ≈ 30 %, profondeur le reste
 */
export const ZONE_THRESHOLDS = {
  F: [65, 56, 48],   // >= 65 : 1er trio, >= 56 : 2e, >= 48 : 3e, sinon 4e
  D: [71, 63, 56],   // >= 71 : 1re paire, >= 63 : 2e, >= 56 : 3e, sinon profondeur
  G: [80, 68],       // >= 80 : partant d'élite, >= 68 : partant, sinon auxiliaire
};

/*
 * Les noms suivent le vocabulaire du hockey plutôt que des numéros : un
 * joueur « top 6 » rend sur les deux premiers trios, un « top 9 » tient
 * aussi le troisième, un « bottom 6 » appartient au bas de l'alignement.
 * `short` est ce qui s'affiche sur les cartes, `label` la version longue
 * de la fiche.
 */
export const LINE_ZONES = {
  F: [
    { level: 1, label: 'Top 6',        short: 'Top 6',      idealUnits: [0, 1] },
    { level: 2, label: 'Middle 6',     short: 'Middle 6',   idealUnits: [1, 2] },
    { level: 3, label: 'Bottom 6',     short: 'Bottom 6',   idealUnits: [2, 3] },
    { level: 4, label: 'Profondeur',   short: 'Profondeur', idealUnits: [3] },
  ],
  D: [
    { level: 1, label: 'Top 4',        short: 'Top 4',      idealUnits: [0, 1] },
    { level: 2, label: 'Middle 4',     short: 'Middle 4',   idealUnits: [1, 2] },
    { level: 3, label: 'Bottom 4',     short: 'Bottom 4',   idealUnits: [1, 2] },
    { level: 4, label: 'Profondeur',   short: 'Profondeur', idealUnits: [2] },
  ],
  G: [
    { level: 1, label: "Partant numéro un", short: 'Partant no 1', idealUnits: [0] },
    { level: 2, label: 'Partant',           short: 'Partant',      idealUnits: [0, 1] },
    { level: 3, label: 'Auxiliaire',        short: 'Auxiliaire',   idealUnits: [1] },
  ],
};

export function zoneLevelFor(pos, v) {
  const t = ZONE_THRESHOLDS[pos] || ZONE_THRESHOLDS.F;
  for (let i = 0; i < t.length; i++) if (v >= t[i]) return i + 1;
  return t.length + 1;
}

/**
 * Zone de trio d'un joueur. Lit p.lz (posé par finalizeSeason) ; sinon
 * déduit de la cote globale passée en `v` (getHiddenRatings(p).v).
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Position secondaire (polyvalence) d'un joueur. */
export function getSecondaryPosition(p) {
  if (!p || p.p === 'G') return null;
  if (p.secP !== undefined) return p.secP;
  const num = p.id || hashString(p.n || '');
  if (p.p === 'D') {
    // Défenseurs : ~40 % peuvent jouer des deux côtés
    if (num % 5 < 2) {
      const primary = (p.np === 'RD' || p.np === 'R' || p.p === 'RD') ? 'RD' : 'LD';
      return primary === 'RD' ? 'LD' : 'RD';
    }
    return null;
  }
  // Attaquants
  const np = p.np || 'C';
  if (np === 'C') {
    if (num % 5 < 2) return (num % 2 === 0) ? 'AG' : 'AD';
  } else if (np === 'L' || np === 'AG') {
    if (p.fo != null && p.fo >= 0.45) return 'C';
    if (num % 5 < 2) return 'AD';
  } else if (np === 'R' || np === 'AD') {
    if (p.fo != null && p.fo >= 0.45) return 'C';
    if (num % 5 < 2) return 'AG';
  }
  return null;
}

export function getLineZone(p, v = null) {
  const pos = !p ? 'F' : p.p === 'G' ? 'G' : p.p === 'D' ? 'D' : 'F';
  const zones = LINE_ZONES[pos];
  let level = p && p.lz;
  if (!level) {
    const ovr = v ?? (p && p.v);
    level = ovr != null ? zoneLevelFor(pos, ovr) : zones.length;
  }
  return zones[Math.min(zones.length, Math.max(1, level)) - 1];
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

/** Interpolation linéaire par morceaux sur une table [[x, y], ...] triée par x. */
function lerpTable(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* ---------- salaire ---------- */

/**
 * Barème salarial 2026 par cote globale (interpolation en log entre ancres).
 *   50 -> 0,78 M$ | 70 -> 2,3 M$ | 80 -> 5,6 M$ | 85 -> 8,8 M$
 *   88 -> 11,5 M$ | 92 -> 14,5 M$ | 96 -> 17,5 M$ | 99 -> 19,5 M$
 * Un 100+ points (cote 88-99) coûte donc 12 à 19 M$, un défenseur de
 * première paire 9 à 14 M$, et il faut remplir le reste avec du 3e-4e trio.
 */
const SALARY_ANCHORS = [
  [50, 775_000], [60, 1_050_000], [70, 2_300_000], [75, 3_600_000], [80, 5_600_000],
  [85, 8_800_000], [88, 11_500_000], [92, 13_750_000], [96, 16_250_000], [99, 18_500_000],
];
const LOG_ANCHORS = SALARY_ANCHORS.map(([v, s]) => [v, Math.log(s)]);

/**
 * Barème pré-1990 (salaires estimées) : échelle plus tassée vers le haut
 * pour éviter les explosions irréalistes sur les saisons à haut pointage,
 * tout en conservant les joueurs aubaines dans le bas/milieu du barème.
 */
const PRE_1990_SALARY_ANCHORS = [
  [50, 775_000], [60, 1_050_000], [70, 2_000_000], [75, 2_800_000], [80, 4_000_000],
  [85, 5_800_000], [88, 7_200_000], [92, 8_800_000], [96, 10_200_000], [99, 11_500_000],
];
const PRE_1990_LOG_ANCHORS = PRE_1990_SALARY_ANCHORS.map(([v, s]) => [v, Math.log(s)]);

/*
 * Contrats d'entrée, selon les façons de faire de l'époque :
 *
 *  - avant 1995-96 : aucun système. Les recrues négociaient librement
 *    (Lindros 1992, Daigle 1993 : des contrats de vedette dès l'entrée),
 *    c'est justement ce qui a mené au plafond des recrues. Pas de rabais.
 *  - 1995-96 à 2003-04 (convention de 1995) : salaire de recrue plafonné
 *    (850 k$ en 1995, ~1,3 M$ en 2004, soit ~2,7 % du plus gros budget
 *    d'équipe), mais bonis de rendement sans vrai plafond — les jeunes
 *    vedettes gagnaient 3 à 4 M$ avec les bonis.
 *  - 2005-06 et après : base plafonnée (850 k$, 925 k$ dès 2011, 950 k$ dès
 *    2020, ~1 % du plafond) et bonis plafonnés à 2,85 M$ (~3 %).
 *
 *  Le contrat d'entrée s'applique au premier contrat d'un joueur signé à
 *  24 ans ou moins : 3 saisons s'il a 18-21 ans, 2 à 22-23, 1 à 24, aucun
 *  à 25 ans et plus. Il « glisse » tant que le joueur ne joue pas 10
 *  matchs, donc compter à partir de la première saison à 10+ matchs dans
 *  la base est fidèle. L'âge vient de `bd` (date de naissance, API bios)
 *  quand le shard l'a, sinon de la cohorte d'identifiant LNH
 *  (opts.entryYear, voir scripts/rerate.mjs). Sans aucune de ces deux
 *  informations, pas de contrat d'entrée : on ne devine pas.
 */
/** Âge du joueur au 1er octobre de la saison, depuis sa date de naissance `bd` (AAAA-MM-JJ). */
export function ageAtSeason(bd, season) {
  if (!bd || !season) return null;
  const by = parseInt(String(bd).slice(0, 4), 10);
  if (!by) return null;
  const year = parseInt(season.slice(0, 4), 10);
  const md = String(bd).slice(5, 10);
  return year - by - (md > '10-01' ? 1 : 0);
}

export function elcEra(season) {
  const year = parseInt(season.slice(0, 4), 10);
  if (year < 1995) return null;
  if (year < 2005) return { basePct: 0.027, bonusPct: 0.030 };
  return { basePct: 0.010, bonusPct: 0.030 };
}

/** Nombre de saisons de contrat d'entrée selon l'âge à la première saison. */
export function elcYearsForAge(age) {
  if (age == null || Number.isNaN(age)) return 0;
  if (age <= 21) return 3;
  if (age <= 23) return 2;
  if (age === 24) return 1;
  return 0;
}

export function elcSalaryFor(ovr, season) {
  const era = elcEra(season) || { basePct: 0.010, bonusPct: 0.030 };
  const base = era.basePct * CAP_REF;
  const bonus = era.bonusPct * CAP_REF * clamp((ovr - 70) / 29, 0, 1);
  return Math.round((base + bonus) / 25_000) * 25_000;
}

export function salaryFor(ovr, pos, elc = false, season = '2025-26') {
  const anchors = !isRealEra(season) ? PRE_1990_LOG_ANCHORS : LOG_ANCHORS;
  let base = Math.exp(lerpTable(ovr, anchors));
  if (pos === 'G') base *= 0.90;
  base = Math.round(base / 25_000) * 25_000;
  if (elc) base = Math.min(base, elcSalaryFor(ovr, season));
  return Math.max(775_000, base);
}

export function capPctFor(salary) {
  return Math.round((salary / CAP_REF) * 1000) / 10;
}

/* ---------- patineurs : sous-cotes ---------- */

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

    const htPerGame = extra && extra.hits != null ? Math.round((extra.hits / gp) * 10) / 10 : null;
    const foPct = r.faceoffWinPct != null ? Math.round(r.faceoffWinPct * 1000) / 1000 : null;

    return {
      id: r.playerId || null,
      n: r.skaterFullName,
      p: isD ? 'D' : 'F',
      np: natural,
      ...(r.birthDate ? { bd: String(r.birthDate).slice(0, 10) } : {}),
      gp,
      g: r.goals || 0,
      a: r.assists || 0,
      pt: r.points || 0,
      pm: r.plusMinus || 0,
      pim: r.penaltyMinutes || 0,
      ht: htPerGame,
      fo: foPct,
      toi: Math.round(toiMin * 10) / 10,
      o: scale(zOff),
      d: scale(zDef),
      r: scale(zRob, 50, 12),
      c: scale(zClu, 50, 12),
      sp: scale(zSp, 52, 12),
      teams: (r.teamAbbrevs || '???').split(',').map(s => s.trim()),
    };
  }).filter(Boolean);
}

/* ---------- gardiens : sous-cotes ---------- */

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

    const zGaa = r.goalsAgainstAverage != null ? -z.gaa(r.goalsAgainstAverage) : 0;
    const o = scale(z.svp(r.savePct));                                    // Technique
    const d = scale(zGaa);                                                // Blindage
    const rb = scale(z.gp(gp), 50, 12);                                   // Charge de travail
    const c = scale(0.6 * z.so((r.shutouts || 0) / gp)
                  + 0.4 * z.wpct((r.wins || 0) / gp), 50, 12);            // Clutch
    const rf = scale(0.7 * z.svp(r.savePct) + 0.3 * zGaa, 52, 12);       // Réflexes

    return {
      id: r.playerId || null,
      n: r.goalieFullName,
      p: 'G',
      np: 'G',
      ...(r.birthDate ? { bd: String(r.birthDate).slice(0, 10) } : {}),
      gp,
      w: r.wins || 0,
      l: r.losses || 0,
      sv: r.savePct != null ? Math.round(r.savePct * 1000) / 1000 : null,
      ga: r.goalsAgainstAverage != null ? Math.round(r.goalsAgainstAverage * 100) / 100 : null,
      so: r.shutouts || 0,
      o, d, r: rb, c, sp: rf,
      teams: (r.teamAbbrevs || '???').split(',').map(s => s.trim()),
    };
  }).filter(Boolean);
}

/* ---------- étage 2 : cote globale, salaire, archétype, zone ---------- */

/*
 * Bonus de vedette, par rang dans la saison. Le rang est divisé par le
 * nombre d'équipes de la ligue cette année-là (q = rang / équipes) pour
 * qu'un top-10 dans une ligue à 14 équipes ne vaille pas un top-10 à 32.
 * Un second terme en z-score garde une trace de l'écart réel avec le
 * peloton (Gretzky 1982 n'est pas juste « premier »).
 */
const STAR_F_RANK = [[0.10, 14], [0.30, 12], [0.60, 9], [1.00, 4], [1.50, 0]];
const STAR_F_Z    = [[1.50, 0], [2.50, 8], [3.20, 12], [4.00, 14]];
const STAR_D_RANK = [[0.10, 17], [0.40, 17], [0.80, 17], [1.20, 13], [1.80, 5], [2.50, 0]];
const STAR_D_Z    = [[1.00, 0], [2.00, 12], [3.00, 16], [4.00, 17]];
const STAR_G_RANK = [[0.10, 12], [0.30, 9], [0.60, 5], [1.00, 0]];

/** Nombre de matchs d'une saison écourtée, sinon 82 (80 avant 1992-93, sans effet ici). */
export function seasonGames(season) {
  if (season === '1994-95' || season === '2012-13') return 48;
  if (season === '2020-21') return 56;
  if (season === '2019-20') return 70;
  return 82;
}

/** Production par match, avec plancher de 30 matchs pour éviter les petits échantillons. */
const prodPerGame = p => (p.pt || 0) / Math.max(p.gp || 1, 30);

function rankMap(list, score) {
  const sorted = [...list].sort((a, b) => score(b) - score(a));
  const m = new Map();
  sorted.forEach((p, i) => m.set(p, i));
  return m;
}

/**
 * Cote globale, salaire, archétype et zone pour une saison complète.
 *
 * `players` : une entrée unique par joueur (avec `teams`, avant duplication
 *   par équipe), portant o, d, r, c, sp et les stats du shard.
 * `opts.salaries` : { cap, players: { [id]: salaireÉpoque } } ou null —
 *   salaires réels publiés, convertis au prorata du plafond de l'année.
 * `opts.firstSeason` : { [id]: annéeDeDébut } ou null — première saison
 *   à 10+ matchs dans la base, pour les contrats d'entrée.
 * `opts.entryYear` : { [id]: annéeD'entréeEstimée } ou null — cohorte
 *   d'identifiant LNH (≈ année de repêchage ou de signature), sert d'âge
 *   approximatif (18 ans à l'entrée) quand `by` manque.
 *
 * Mute et retourne `players`.
 */
export function finalizeSeason(players, season, opts = {}) {
  const year = parseInt(season.slice(0, 4), 10);
  const teams = new Set();
  for (const p of players) for (const t of (p.teams || [])) if (t && t !== '???') teams.add(t);
  const nTeams = Math.max(6, opts.nTeams || teams.size || 32);

  const F = players.filter(p => p.p === 'F');
  const D = players.filter(p => p.p === 'D');
  const G = players.filter(p => p.p === 'G');

  const zF = zfn(F.map(prodPerGame));
  const zD = zfn(D.map(prodPerGame));
  const rkF = rankMap(F, prodPerGame);
  const rkD = rankMap(D, prodPerGame);

  // Gardiens : seuls ceux qui ont joué au moins 40 % des matchs sont classés
  const games = seasonGames(season);
  const gScore = g => 0.6 * g.o + 0.4 * g.d;
  const qualG = G.filter(g => g.gp >= 0.4 * games);
  const rkG = rankMap(qualG, gScore);

  const salaries = opts.salaries || null;
  const refCap = (salaries && salaries.cap) || eraCapFor(season);

  // Avant le plafond : rang centile de chaque salaire réel dans la saison,
  // pour le lissage (voir LISSAGE_AVANT_PLAFOND)
  const lissage = year < 2005 && salaries ? LISSAGE_AVANT_PLAFOND : 0;
  let realSorted = [];
  if (lissage > 0) {
    realSorted = players.map(p => (p.id != null ? salaries.players?.[p.id] : null))
      .filter(v => v != null && v > 0).sort((a, b) => a - b);
  }
  const quantileOf = v => {
    let lo = 0, hi = realSorted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (realSorted[m] < v) lo = m + 1; else hi = m; }
    let hi2 = lo;
    while (hi2 < realSorted.length && realSorted[hi2] === v) hi2++;
    return (lo + hi2) / 2 / realSorted.length;
  };
  const firstSeason = opts.firstSeason || null;
  const entryYear = opts.entryYear || null;

  for (const p of players) {
    let v;
    if (p.p === 'G') {
      const core = 0.40 * p.o + 0.32 * p.d + 0.14 * p.r + 0.14 * p.c;
      const share = p.gp / games;
      const starter = 10 * clamp((share - 0.25) / 0.50, 0, 1);
      const rank = rkG.has(p) ? lerpTable((rkG.get(p) + 0.5) / nTeams, STAR_G_RANK) : 0;
      v = core + starter + rank;
    } else if (p.p === 'D') {
      const core = 0.42 * p.o + 0.48 * p.d + 0.05 * p.r + 0.05 * p.c + 6;
      const q = (rkD.get(p) + 0.5) / nTeams;
      const star = 0.7 * lerpTable(q, STAR_D_RANK) + 0.3 * lerpTable(zD(prodPerGame(p)), STAR_D_Z);
      v = core + star;
    } else {
      const core = 0.66 * p.o + 0.16 * p.d + 0.05 * p.r + 0.13 * p.c;
      const q = (rkF.get(p) + 0.5) / nTeams;
      const star = 0.7 * lerpTable(q, STAR_F_RANK) + 0.3 * lerpTable(zF(prodPerGame(p)), STAR_F_Z);
      v = core + star;
    }
    p.v = clamp(Math.round(v), 25, 99);

    // Contrat d'entrée : selon l'époque et l'âge à la première saison dans
    // la base (jamais pour la première saison de la base, 1970-71, où tout
    // le monde serait « recrue »).
    const debut = firstSeason && p.id != null ? firstSeason[p.id] : null;
    let ageAtDebut = null;
    if (debut != null) {
      if (p.bd) ageAtDebut = ageAtSeason(p.bd, `${debut}-${String(debut + 1).slice(2)}`);
      else if (entryYear && entryYear[p.id] != null) ageAtDebut = 18 + Math.max(0, debut - entryYear[p.id]);
    }
    const elcYears = elcEra(season) && debut != null && debut > 1970 ? elcYearsForAge(ageAtDebut) : 0;
    p.elc = (year - debut) < elcYears ? 1 : 0;

    // Salaire : réel publié au prorata du plafond si disponible, sinon barème
    const real = salaries && p.id != null ? salaries.players?.[p.id] : null;
    if (real != null && real > 0) {
      let $ = getModernSalary(real, season, refCap);
      if (lissage > 0 && realSorted.length) {
        const cible = salaryAtQuantile(quantileOf(real));
        $ = Math.max(775_000, Math.round(((1 - lissage) * $ + lissage * cible) / 25_000) * 25_000);
      }
      p.$ = $;
      p.realSal = Math.round(real);
      p.isReal = 1;
    } else {
      p.$ = salaryFor(p.v, p.p, p.elc === 1, season);
      p.realSal = getEraSalary(p.$, season, refCap);
      p.isReal = 0;
    }
    p.cp = capPctFor(p.$);

    p.ak = archetypeKey(p, p);
    p.lz = zoneLevelFor(p.p === 'G' ? 'G' : p.p === 'D' ? 'D' : 'F', p.v);
  }
  return players;
}

/** Duplique chaque joueur dans le vestiaire de CHAQUE équipe où il a passé, marqué x:1. */
export function expandByTeam(players, label) {
  const entries = [];
  for (const rec of players) {
    const { teams, ...base } = rec;
    for (const t of teams) {
      entries.push({ ...base, t, s: label, x: teams.length > 1 ? 1 : 0 });
    }
  }
  return entries;
}

/**
 * Regroupe les entrées d'un shard (une par équipe) en joueurs uniques avec
 * leur liste d'équipes — l'inverse d'expandByTeam.
 */
export function collapseByTeam(entries) {
  const byKey = new Map();
  for (const e of entries) {
    const key = e.id != null ? `id:${e.id}` : `n:${e.n}|${e.p}`;
    let rec = byKey.get(key);
    if (!rec) {
      const { t, s, x, ...base } = e;
      rec = { ...base, teams: [] };
      byKey.set(key, rec);
    }
    if (e.t && !rec.teams.includes(e.t)) rec.teams.push(e.t);
  }
  return [...byKey.values()];
}

/**
 * Assemble un shard de saison à partir des stats brutes de l'API.
 */
export function buildSeasonShard(label, skaterRows, goalieRows, realtimeById, minGP, opts = {}) {
  const skaters = skaterRows.filter(r => (r.gamesPlayed || 0) >= minGP);
  const goalies = goalieRows.filter(r => (r.gamesPlayed || 0) >= minGP);
  const players = finalizeSeason([...rateSkaters(skaters, realtimeById), ...rateGoalies(goalies)], label, opts);
  return { season: label, minGP, v: RATINGS_VERSION, players: expandByTeam(players, label) };
}

/**
 * Recalcule l'étage 2 d'un shard existant, sans l'API. Les sous-cotes
 * o, d, r, c, sp restent telles quelles ; v, $, archétype et zone sont
 * refaits avec la formule courante.
 */
export function rerateShard(shard, opts = {}) {
  const players = finalizeSeason(collapseByTeam(shard.players), shard.season, opts);
  return { season: shard.season, minGP: shard.minGP, v: RATINGS_VERSION, players: expandByTeam(players, shard.season) };
}
