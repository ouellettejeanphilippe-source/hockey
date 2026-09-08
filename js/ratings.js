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

export const RATINGS_VERSION = 24;

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

/**
 * Part de la moyenne du vestiaire retranchée du +/- d'un joueur, pour
 * séparer sa contribution de celle de son club sans effacer un club qui
 * était vraiment bon. Voir le commentaire dans `rateSkaters`.
 */
export const LISSAGE_EQUIPE = 0.5;

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

/* ---------- Repères de lancers par saison ---------- */
/*
 * Le moteur par événements prend le LANCER comme primitive, et la
 * normalisation par époque se réduit alors à quelques nombres par saison
 * plutôt qu'à un facteur bricolé sur le pointage. Mesuré sur 55 saisons : le
 * rythme va de 26,7 à 31,0 lancers par équipe par match (17 % d'amplitude)
 * pendant que les buts varient de 55 %. C'est la finition qui a changé, pas
 * le tempo — voir MOTEUR.md section 1.
 *
 *   [0] lancers par équipe par match
 *   [1] % de tir de la ligue
 *   [2] lancers par match d'un attaquant régulier (20 PJ et plus)
 *   [3] lancers par match d'un défenseur régulier
 *   [4] points par match d'un attaquant régulier
 *   [5] points par match d'un défenseur régulier
 *   [6] part des points d'un attaquant régulier qui vient de ses buts
 *   [7] minutes de punition par match d'un attaquant régulier
 *   [8] part des points d'un défenseur régulier qui vient de ses buts
 *
 * Les cinq derniers expriment le volume de tirs et la production d'un joueur
 * en écart à sa ligue, pour qu'un ailier de 1981 et un ailier de 2015 se
 * comparent. La production sert à la chimie de trio (`js/sim.js`), qui se
 * calcule sur les vraies statistiques et non sur une cote.
 *
 * NE PAS ÉDITER À LA MAIN — `node scripts/build_lancers.mjs` la régénère
 * depuis les shards, et `--check` dit si elle est périmée.
 */
export const SEASON_LANCERS = {
  /* <lancers> */
  '1970-71': [31.01, 10.03, 2.00, 1.50, 0.54, 0.31, 0.428, 0.62, 0.188, 0.00, 0.00],
  '1971-72': [29.57, 10.21, 1.96, 1.50, 0.52, 0.32, 0.431, 0.55, 0.219, 0.00, 0.00],
  '1972-73': [30.84, 10.56, 2.06, 1.43, 0.60, 0.31, 0.423, 0.57, 0.213, 0.00, 0.00],
  '1973-74': [29.44, 10.84, 1.93, 1.42, 0.55, 0.32, 0.426, 0.57, 0.214, 0.00, 0.00],
  '1974-75': [29.73, 11.49, 1.98, 1.45, 0.60, 0.35, 0.421, 0.66, 0.222, 0.00, 0.00],
  '1975-76': [29.40, 11.60, 2.02, 1.42, 0.62, 0.34, 0.423, 0.70, 0.227, 0.00, 0.00],
  '1976-77': [28.98, 11.43, 1.91, 1.43, 0.58, 0.34, 0.431, 0.62, 0.213, 0.00, 0.00],
  '1977-78': [28.24, 11.59, 1.83, 1.44, 0.58, 0.34, 0.429, 0.70, 0.221, 3.18, 21.19],
  '1978-79': [28.69, 12.16, 1.81, 1.39, 0.60, 0.36, 0.430, 0.72, 0.217, 3.39, 22.69],
  '1979-80': [28.62, 12.23, 1.83, 1.41, 0.60, 0.37, 0.433, 0.75, 0.226, 3.50, 21.86],
  '1980-81': [29.46, 12.96, 1.86, 1.48, 0.64, 0.40, 0.432, 1.03, 0.226, 4.25, 22.55],
  '1981-82': [29.74, 13.36, 1.91, 1.47, 0.69, 0.40, 0.426, 1.04, 0.220, 4.00, 22.94],
  '1982-83': [29.50, 13.05, 1.75, 1.43, 0.62, 0.38, 0.428, 0.81, 0.217, 3.87, 22.96],
  '1983-84': [29.47, 13.37, 1.74, 1.44, 0.63, 0.39, 0.426, 0.86, 0.234, 4.20, 21.99],
  '1984-85': [29.85, 12.97, 1.75, 1.42, 0.63, 0.39, 0.424, 0.90, 0.225, 4.03, 22.14],
  '1985-86': [29.95, 13.13, 1.82, 1.39, 0.65, 0.38, 0.419, 1.07, 0.239, 4.63, 22.07],
  '1986-87': [28.88, 12.63, 1.72, 1.34, 0.58, 0.36, 0.423, 1.18, 0.230, 4.31, 20.96],
  '1987-88': [29.51, 12.51, 1.72, 1.42, 0.58, 0.37, 0.423, 1.39, 0.239, 5.46, 20.32],
  '1988-89': [29.52, 12.67, 1.73, 1.36, 0.59, 0.37, 0.425, 1.36, 0.224, 5.03, 21.05],
  '1989-90': [29.16, 12.58, 1.76, 1.35, 0.59, 0.36, 0.425, 1.25, 0.222, 4.58, 20.79],
  '1990-91': [28.56, 12.01, 1.67, 1.38, 0.54, 0.35, 0.422, 1.29, 0.230, 4.57, 19.45],
  '1991-92': [29.47, 11.71, 1.71, 1.38, 0.56, 0.35, 0.416, 1.30, 0.226, 5.02, 19.24],
  '1992-93': [30.55, 11.84, 1.74, 1.43, 0.57, 0.37, 0.419, 1.16, 0.238, 5.28, 19.57],
  '1993-94': [29.40, 10.93, 1.67, 1.41, 0.50, 0.33, 0.427, 1.05, 0.224, 4.85, 18.64],
  '1994-95': [27.69, 10.60, 1.69, 1.43, 0.49, 0.32, 0.420, 1.07, 0.225, 4.36, 17.73],
  '1995-96': [29.55, 10.57, 1.74, 1.34, 0.51, 0.30, 0.419, 1.06, 0.222, 5.04, 17.93],
  '1996-97': [28.88, 10.09, 1.73, 1.30, 0.47, 0.28, 0.420, 0.99, 0.222, 4.10, 16.27],
  '1997-98': [26.74, 9.84, 1.60, 1.18, 0.42, 0.26, 0.421, 1.01, 0.237, 4.64, 15.08],
  '1998-99': [26.90, 9.77, 1.61, 1.21, 0.42, 0.24, 0.411, 0.83, 0.233, 4.38, 15.81],
  '1999-00': [27.23, 10.07, 1.64, 1.20, 0.45, 0.26, 0.413, 0.74, 0.235, 4.03, 16.15],
  '2000-01': [26.91, 10.18, 1.59, 1.21, 0.45, 0.27, 0.409, 0.85, 0.234, 4.59, 16.64],
  '2001-02': [26.66, 9.78, 1.59, 1.19, 0.42, 0.24, 0.410, 0.83, 0.238, 4.13, 15.76],
  '2002-03': [27.40, 9.60, 1.66, 1.22, 0.43, 0.25, 0.406, 0.78, 0.232, 4.42, 16.43],
  '2003-04': [26.87, 9.52, 1.62, 1.25, 0.41, 0.26, 0.411, 0.82, 0.243, 4.24, 16.47],
  '2005-06': [29.13, 10.33, 1.78, 1.21, 0.49, 0.30, 0.412, 0.82, 0.223, 5.85, 17.69],
  '2006-07': [28.71, 9.96, 1.76, 1.18, 0.47, 0.29, 0.412, 0.76, 0.218, 4.85, 17.59],
  '2007-08': [28.09, 9.64, 1.75, 1.18, 0.45, 0.28, 0.412, 0.75, 0.224, 4.28, 17.75],
  '2008-09': [29.36, 9.66, 1.80, 1.22, 0.46, 0.30, 0.413, 0.79, 0.219, 4.16, 18.95],
  '2009-10': [29.64, 9.28, 1.81, 1.23, 0.44, 0.29, 0.420, 0.70, 0.218, 3.71, 18.21],
  '2010-11': [29.81, 9.11, 1.84, 1.25, 0.45, 0.28, 0.420, 0.67, 0.212, 3.54, 18.02],
  '2011-12': [28.64, 9.23, 1.71, 1.27, 0.41, 0.28, 0.421, 0.63, 0.210, 3.31, 17.31],
  '2012-13': [27.74, 9.48, 1.74, 1.29, 0.44, 0.29, 0.411, 0.65, 0.231, 3.32, 18.22],
  '2013-14': [29.18, 9.13, 1.74, 1.35, 0.43, 0.29, 0.416, 0.63, 0.230, 3.27, 17.89],
  '2014-15': [28.86, 9.17, 1.73, 1.34, 0.42, 0.29, 0.416, 0.51, 0.230, 3.06, 18.65],
  '2015-16': [29.00, 9.15, 1.69, 1.35, 0.41, 0.28, 0.422, 0.52, 0.229, 3.11, 18.65],
  '2016-17': [29.22, 9.30, 1.70, 1.39, 0.42, 0.29, 0.426, 0.48, 0.226, 2.99, 19.12],
  '2017-18': [30.95, 9.43, 1.78, 1.50, 0.46, 0.31, 0.420, 0.44, 0.232, 3.04, 20.17],
  '2018-19': [30.54, 9.70, 1.77, 1.44, 0.47, 0.30, 0.424, 0.42, 0.222, 2.92, 19.78],
  '2019-20': [30.39, 9.73, 1.79, 1.49, 0.47, 0.31, 0.425, 0.44, 0.226, 2.97, 20.03],
  '2020-21': [27.90, 10.30, 1.73, 1.45, 0.47, 0.31, 0.427, 0.41, 0.212, 2.89, 19.78],
  '2021-22': [30.03, 10.34, 1.80, 1.43, 0.48, 0.33, 0.427, 0.47, 0.213, 2.89, 20.61],
  '2022-23': [30.02, 10.36, 1.81, 1.38, 0.49, 0.33, 0.424, 0.48, 0.220, 3.07, 21.31],
  '2023-24': [29.12, 10.53, 1.75, 1.27, 0.48, 0.31, 0.428, 0.47, 0.215, 3.02, 20.97],
  '2024-25': [27.16, 10.96, 1.63, 1.24, 0.47, 0.31, 0.423, 0.42, 0.216, 2.71, 21.64],
  '2025-26': [26.94, 11.39, 1.58, 1.22, 0.48, 0.32, 0.422, 0.47, 0.222, 2.88, 21.11],
  /* </lancers> */
};

/** Les quatre repères de lancers d'une saison, avec un repli moderne. */
export function seasonLancers(season) {
  return SEASON_LANCERS[season] || [29.00, 10.50, 1.75, 1.35, 0.62, 0.35, 0.400, 0.90, 0.280, 0, 0];
}

/*
 * Temps de glace des unités, part des présences : ce sont les poids du
 * moteur (`js/sim.js`), et ils servent aussi ici à reconstituer avec qui un
 * joueur a vraiment joué (voir `contexteDeCreation`).
 */
export const POIDS_TRIO  = [0.34, 0.28, 0.22, 0.16];  // le 4e trio compte pour vrai
export const POIDS_PAIRE = [0.40, 0.34, 0.26];

/** Création d'un rappel de la ligue mineure, en passes relatives. */
export const RAPPEL_PASSES = 0.70;

/**
 * Création d'un joueur : ses passes par match, en écart au régulier moyen de
 * sa position et de sa saison. C'est ce qu'il apporte aux lancers des AUTRES.
 * Une seule implémentation, lue par le moteur et par l'étage 2 des cotes.
 */
export function passesRelatives(p, season = null) {
  if (!p) return RAPPEL_PASSES;
  const est_D = p.p === 'D' || p.p === 'LD' || p.p === 'RD';
  const L = seasonLancers(p.s || season);
  const base = est_D ? L[5] * (1 - (L[8] ?? 0.28)) : L[4] * (1 - (L[6] ?? 0.40));
  if (!base) return 1;
  return clamp((p.a || 0) / Math.max(1, p.gp || 1) / base, 0.25, 3.0);
}

/**
 * La création autour d'un tireur : ses coéquipiers sur la glace. Une fois
 * le tireur retiré, une présence compte 56 % d'attaquants et 44 % de
 * défenseurs en moyenne ; un attaquant a ses deux compagnons de trio et deux
 * défenseurs, un défenseur a trois attaquants et son partenaire.
 *
 *   `trio`  les passes relatives des coéquipiers de SON unité (2 ou 1)
 *   `autre` la moyenne pondérée par les présences de l'autre groupe
 */
export function creationAutour(est_D, memes, autre) {
  const somme = memes.reduce((s, x) => s + x, 0);
  return est_D ? (3 * autre + somme) / 4 : (somme + 2 * autre) / 4;
}

/**
 * Le CONTEXTE de création d'un joueur : la création qu'il a vraiment eue
 * autour de lui dans sa saison, reconstituée en rangeant les attaquants de
 * son équipe par valeur en trios et ses défenseurs en paires. Le moteur
 * compare la création de ses coéquipiers DU JEU à celle-ci : c'est ce qui
 * fait qu'un joueur rejoué avec ses vrais coéquipiers marque comme dans la
 * vraie vie, et qu'un joueur placé à côté d'un meilleur passeur marque plus.
 *
 * Sans ce contexte, la création s'ajouterait à un pourcentage de tir qui la
 * contient déjà, et les vraies grandes équipes seraient comptées deux fois.
 */
export function contexteDeCreation(players, season = null) {
  // À l'étage 2 les enregistrements sont repliés : `teams` plutôt que `t`,
  // et pas de `s`. Un joueur échangé entre dans le vestiaire de chacune de
  // ses équipes, et son contexte est la moyenne de ceux qu'il y a eus.
  const parEquipe = new Map();
  for (const p of players) {
    if (p.p === 'G') continue;
    for (const t of (p.teams || [p.t]).filter(Boolean)) {
      if (!parEquipe.has(t)) parEquipe.set(t, []);
      parEquipe.get(t).push(p);
    }
  }
  const rel = p => passesRelatives(p, season);
  const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const contextes = new Map();
  for (const ps of parEquipe.values()) {
    const est_D = p => p.p === 'D' || p.p === 'LD' || p.p === 'RD';
    const tri = a => a.slice().sort((x, y) => (y.v ?? 0) - (x.v ?? 0) || (y.gp || 0) - (x.gp || 0));
    const F = tri(ps.filter(p => !est_D(p))), D = tri(ps.filter(est_D));
    const trios = [0, 1, 2, 3].map(u => F.slice(3 * u, 3 * u + 3)).filter(a => a.length);
    const paires = [0, 1, 2].map(v => D.slice(2 * v, 2 * v + 2)).filter(a => a.length);
    const pond = (unites, poids) => {
      let s = 0, w = 0;
      unites.forEach((u, i) => { s += poids[i] * moy(u.map(rel)); w += poids[i]; });
      return w ? s / w : 1;
    };
    const Fbar = trios.length ? pond(trios, POIDS_TRIO) : 1;
    const Dbar = paires.length ? pond(paires, POIDS_PAIRE) : 1;
    // Au-delà des 12 attaquants et 6 défenseurs rangés, un joueur a le
    // contexte de la dernière unité : il était de la profondeur.
    const unite = (p, unites, taille) => {
      const i = unites.findIndex(u => u.includes(p));
      const u = i >= 0 ? unites[i] : unites[unites.length - 1] || [];
      const memes = u.filter(x => x !== p).map(rel);
      while (memes.length < taille - 1) memes.push(RAPPEL_PASSES);
      return memes;
    };
    for (const p of ps) {
      const cx = est_D(p) ? creationAutour(true, unite(p, paires, 2), Fbar) : creationAutour(false, unite(p, trios, 3), Dbar);
      if (!contextes.has(p)) contextes.set(p, []);
      contextes.get(p).push(cx);
    }
  }
  for (const [p, cxs] of contextes) p.cx = Math.round(moy(cxs) * 100) / 100;
  return players;
}

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
/*
 * L'archétype se lit dans la FICHE du joueur, pas dans ses cotes.
 *
 * L'ancienne version comparait `r.o`, `r.d`, `r.r` à des seuils : elle
 * décrivait donc la cote, pas le joueur, et deux joueurs de production
 * identique pouvaient sortir avec des archétypes différents parce qu'un
 * z-score franchissait un seuil. Tout se lit maintenant dans ce que le joueur
 * a vraiment fait, en écart au régulier moyen de SA saison — un ailier de 1981
 * et un ailier de 2015 se comparent donc correctement.
 *
 * Les quatre axes, tous mesurés, tous disponibles depuis 1970-71 :
 *
 *   PRODUCTION  points par match / le régulier moyen de sa saison
 *   PENCHANT    part de ses points venant de ses buts, en écart à sa ligue
 *   VOLUME      lancers par match / le régulier moyen de sa saison
 *   ROBUSTESSE  minutes de punition par match / le régulier moyen
 *
 * Ce qui manque encore et qu'on assume : rien ici ne mesure la défensive d'un
 * attaquant, parce que le sommaire ne la porte pas avant 1998. Un attaquant
 * peu productif et peu puni sort « complet » plutôt que « défensif » — c'est
 * la meilleure lecture possible de ses colonnes, et le trait Selke est là pour
 * les cas où le vote sait ce que le sommaire ignore.
 */
export function archetypeKey(p) {
  if (!p) return 'UNKNOWN';
  const gp = Math.max(1, p.gp || 0);
  const [, pctTirLigue, shF, shD, ptF, ptD, partButs, pimF] = seasonLancers(p.s);

  if (p.p === 'G') {
    const svLigue = 1 - (pctTirLigue || 10.5) / 100;
    const ecart = (p.sv || svLigue) - svLigue;
    const charge = (p.sa || 0) / gp / 28.5;      // rondelles vues, en écart à la ligue
    // Le % d'arrêts d'un gardien à douze départs ne veut rien dire : le mur
    // demande donc un vrai échantillon en plus d'un vrai écart.
    if (gp >= 25 && ecart >= 0.012) return 'WALL';
    if (charge >= 1.10 && ecart >= 0.004) return 'ACROBAT';  // bombardé et il tient
    if (gp >= 55) return 'WORKHORSE';            // il joue tous les soirs
    return 'HYBRID_G';
  }

  const est_D = p.p === 'D' || p.p === 'LD' || p.p === 'RD';
  const prod = (p.pt || 0) / gp / (est_D ? (ptD || 0.35) : (ptF || 0.62));
  const volume = (p.sh || 0) / gp / (est_D ? (shD || 1.35) : (shF || 1.75));
  const dur = (p.pim || 0) / gp / (pimF || 0.90);
  const pen = (p.pt || 0) >= 15 ? (p.g || 0) / p.pt - (partButs || 0.40) : 0;

  if (est_D) {
    if (prod >= 1.55) return 'OFF_D';            // il fait l'attaque de sa brigade
    if (prod >= 0.90) return 'TWO_WAY_D';
    if (dur >= 1.30) return 'DEF_D';             // peu de points, beaucoup de bâton
    if (prod >= 0.45) return 'STAY_D';
    return 'CHECKER_D';
  }

  // Attaquants — vedettes d'abord, puis le milieu, puis le bas.
  // Chez les vedettes on lit la part de PASSES plutôt que le penchant : un
  // marqueur de 90 buts a beaucoup d'aides dans l'absolu sans être un
  // fabricant de jeu, et l'écart à la ligue ne le voit pas.
  if (prod >= 1.85) return (p.a || 0) / Math.max(1, p.pt) >= 0.60 ? 'OFF_PLAYMAKER' : 'SNIPER';
  if (prod >= 1.15) {
    if (pen >= 0.05 || volume >= 1.45) return 'SNIPER';
    if (pen <= -0.06) return 'PLAYMAKER';
    if (dur >= 1.45) return 'POWER_FWD';
    return 'SKILLED_FWD';
  }
  if (prod >= 0.55) {
    if (dur >= 1.60) return 'POWER_FWD';
    return 'TWO_WAY_FWD';
  }
  if (dur >= 1.40) return 'ENERGY';
  return 'CHECKER';
}

/**
 * Archétype d'un joueur. Lit `p.ak` (posé par finalizeSeason, présent dans
 * les shards) et le recalcule sinon. Le second argument n'existe plus : il n'y
 * a plus de cote à passer, l'archétype ne lit que la fiche.
 */
export function getArchetype(p, ratings = null) {
  if (!p) return { key: 'UNKNOWN', ...ARCHETYPES.UNKNOWN };
  const key = p.ak || archetypeKey(p);
  return { key, ...(ARCHETYPES[key] || ARCHETYPES.UNKNOWN) };
}

/* ---------- Zones de trio (calibre) ---------- */

/*
 * Calibre déduit de la cote globale. Seuils calés sur la distribution de
 * toutes les saisons (voir PLAN.md) :
 *   attaquants — 1er trio ≈ 13 % du haut, 2e ≈ 22 % suivants, 3e ≈ 30 %, 4e le reste
 *   défenseurs — 1re paire ≈ 20 %, 2e ≈ 25 %, 3e ≈ 30 %, profondeur le reste
 */
/*
 * Seuils de zone, calibrés sur la distribution réelle de `v`.
 *
 * Une vraie équipe de la LNH aligne exactement 6 attaquants de top 6, 4
 * défenseurs de top 4 et 1 partant. Les seuils précédents (F 65/56/48,
 * D 71/63/56, G 80/68) étaient de 5 à 20 points trop sévères : mesurés sur les
 * 1396 équipes-saisons des shards, ils ne donnaient en moyenne que 2,5
 * attaquants de top 6, 1,7 défenseur de top 4 et 0,29 partant par équipe.
 * 1000 équipes sur 1396 n'avaient aucun partant numéro un, et 8 % aucun
 * attaquant de top 6.
 *
 * Ceux-ci sont pris dans la distribution de `v` : la valeur qui fait atterrir
 * la ligue entière sur 6, 4 et 1 par équipe EN MOYENNE — la moyenne, pas le
 * plancher, pour qu'une équipe dominante puisse en avoir huit et une équipe
 * faible trois. Résultat mesuré : 6,5 / 4,0 / 1,05 par équipe, écart entre
 * bonnes et mauvaises équipes doublé (7,7 contre 4,7 attaquants de top 6 pour
 * les premier et dernier déciles), et stable de 1970 à 2020 parce que `v` est
 * déjà normalisée par époque.
 */
export const ZONE_THRESHOLDS = {
  F: [55, 46, 40],   // >= 55 : 1er trio, >= 46 : 2e, >= 40 : 3e, sinon 4e
  D: [61, 50, 44],   // >= 61 : 1re paire, >= 50 : 2e, >= 44 : 3e, sinon profondeur
  G: [60, 52],       // >= 60 : partant d'élite, >= 52 : partant, sinon auxiliaire
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
  if (!p) return LINE_ZONES.F[0];
  const isD = p.p === 'D' || p.p === 'LD' || p.p === 'RD';
  const pos = p.p === 'G' ? 'G' : isD ? 'D' : 'F';
  const ovr = v ?? (p && p.v);

  const rating = ovr ?? 50;

  // 1. Étoiles (Stars)
  if (pos === 'G' && rating >= 80) {
    return { level: 1, label: "Partant numéro un", short: 'Partant no 1', idealUnits: [0] };
  }
  if (pos === 'F' && rating >= 78) {
    return { level: 1, label: 'Top 3', short: 'Top 3', idealUnits: [0] };
  }
  if (pos === 'D' && rating >= 78) {
    return { level: 1, label: 'Top 2', short: 'Top 2', idealUnits: [0] };
  }

  // 2. Joueurs hyper versatiles
  const sec = getSecondaryPosition(p);
  if (sec) {
    if (pos === 'F') {
      if (rating >= 56) return { level: 2, label: 'Top 9', short: 'Top 9', idealUnits: [0, 1, 2] };
      return { level: 3, label: 'Bottom 9', short: 'Bottom 9', idealUnits: [1, 2, 3] };
    }
    if (pos === 'D') {
      if (rating >= 63) return { level: 2, label: 'Top 6 D', short: 'Top 6 D', idealUnits: [0, 1, 2] };
      return { level: 3, label: 'Bottom 6 D', short: 'Bottom 6 D', idealUnits: [1, 2] };
    }
  }

  // 3. Zones standard
  const zones = LINE_ZONES[pos];
  const level = zoneLevelFor(pos, rating);
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

/* ---------- composantes à disponibilité variable ----------
 *
 * Toutes les statistiques n'existent pas dans toutes les époques. Ce qui
 * remonte à 1970-71 : points, lancers, points en avantage et en désavantage
 * numérique, +/-, punitions, buts gagnants. Ce qui n'existe qu'à partir de
 * 1997-98 : le temps de glace et le % de mises au jeu. Ce qui n'existe qu'à
 * partir de 2005-06 : les mises en échec et les tirs bloqués.
 *
 * `mix` additionne les composantes présentes et divise par la somme de
 * LEURS poids : une composante absente cède sa place aux autres au lieu de
 * compter comme un zéro. Sans ça, une saison d'avant 1998 perdait 35 % de
 * sa cote défensive et 50 % de sa vitesse, et tout le monde se tassait sur
 * la moyenne — écart-type de la défensive 7,1 avant 1998 contre 9,9 après,
 * la vitesse carrément de moitié (4,7 contre 9,5). Une équipe des années
 * 1970 se retrouvait donc plus uniforme qu'elle ne l'était vraiment.
 *
 * Quand tout est disponible, les poids somment déjà à 1 et `mix` rend
 * exactement le même résultat qu'une somme pondérée ordinaire : les
 * saisons modernes ne bougent pas.
 */
function mix(parts) {
  let num = 0, den = 0;
  for (const [w, z] of parts) {
    if (z === null || z === undefined || Number.isNaN(z)) continue;
    num += w * z;
    den += w;
  }
  return den > 0 ? num / den : 0;
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

/** Équipes d'une ligne de l'API (« MNS,WSH » -> ['MNS', 'WSH']). */
function teamsOf(row) {
  return String(row.teamAbbrevs || '').split(',').map(t => t.trim()).filter(t => t && t !== '???');
}

export function rateSkaters(rows, realtimeById = null) {
  const rt = id => (realtimeById && realtimeById[id]) || null;
  const hasRT = realtimeById && Object.keys(realtimeById).length > 0;
  // Le temps de glace n'est publié qu'à partir de 1997-98 : avant, l'API
  // renvoie 0 pour tout le monde, ce qui n'est pas la même chose que zéro
  // minute jouée. On le traite alors comme absent (voir `mix`).
  const hasTOI = rows.some(r => (r.timeOnIcePerGame || 0) > 0);

  /*
   * +/- partiellement relatif à l'équipe, troisième curseur du même genre
   * que LISSAGE_AVANT_PLAFOND.
   *
   * Le +/- brut mesure autant la qualité du club que celle du joueur : un
   * premier trio sur une équipe de fond de classement sort négatif quoi
   * qu'il fasse. Mais retrancher toute la moyenne du vestiaire corrige
   * trop : la qualité d'une équipe est en partie réelle, et un joueur
   * défensif d'élite se retrouvait puni d'avoir joué sur une bonne équipe.
   * Mesuré à correction complète : corrélation -0,81 entre le pourcentage
   * de victoires d'une équipe et le changement de cote défensive de ses
   * joueurs, soit -6,8 points pour les 10 meilleures équipes et +6,3 pour
   * les 10 pires. Bob Gainey 1978-79, quatre Selke d'affilée, tombait de
   * 56 à 44 pour avoir joué dans le vestiaire du Canadien.
   *
   * On ne retranche donc que LISSAGE_EQUIPE de la moyenne du vestiaire.
   * 0 = +/- brut (le club porte le joueur), 1 = écart pur à ses
   * coéquipiers (le club est effacé, même quand il est mérité).
   */
  const teamPM = new Map();
  for (const r of rows) {
    for (const t of teamsOf(r)) {
      const acc = teamPM.get(t) || { sum: 0, n: 0 };
      acc.sum += per(r, 'plusMinus');
      acc.n += 1;
      teamPM.set(t, acc);
    }
  }
  const relPM = r => {
    const ts = teamsOf(r);
    let base = 0, k = 0;
    for (const t of ts) {
      const acc = teamPM.get(t);
      if (acc && acc.n) { base += acc.sum / acc.n; k += 1; }
    }
    return per(r, 'plusMinus') - LISSAGE_EQUIPE * (k ? base / k : 0);
  };

  const z = {
    pts:    zfn(rows.map(r => per(r, 'points'))),
    shots:  zfn(rows.map(r => per(r, 'shots'))),
    pp:     zfn(rows.map(r => per(r, 'ppPoints'))),
    pm:     zfn(rows.map(relPM)),
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

    // Absentes avant 1997-98 (TG) et avant 2005-06 (mises en échec,
    // tirs bloqués) : `mix` redistribue leur poids sur le reste.
    const zToi = hasTOI ? z.toi(toiMin) : null;
    const zBlocks = extra ? z.blocks((extra.blockedShots || 0) / gp) : null;
    const zHits = extra ? z.hits((extra.hits || 0) / gp) : null;

    // OFFENSIVE — toutes époques
    const zOff = mix([
      [0.62, z.pts(per(r, 'points'))],
      [0.22, z.shots(per(r, 'shots'))],
      [0.16, z.pp(per(r, 'ppPoints'))],
    ]);

    // DÉFENSIVE — +/- relatif à l'équipe et buts en désavantage numérique
    // dans toutes les époques ; temps de glace et tirs bloqués en renfort
    // quand ils existent
    let zDef = mix([
      [0.45, z.pm(relPM(r))],
      [0.20, z.sh(per(r, 'shPoints'))],
      [0.35, zToi],
    ]);
    zDef = mix([[0.70, zDef], [0.30, zBlocks]]);
    if (isD) zDef += 0.35;  // bonus positionnel

    // ROBUSTESSE — punitions dans toutes les époques, mises en échec après
    const zRob = mix([
      [0.45, z.pim(per(r, 'penaltyMinutes'))],
      [0.55, zHits],
    ]);

    // CLUTCH — buts gagnants et en prolongation
    const zClu = 0.75 * z.gwg(((r.gameWinningGoals || 0) + (r.otGoals || 0)) / gp)
               + 0.25 * z.pts(per(r, 'points'));

    // VITESSE — sans TG, le volume de lancers et le désavantage numérique
    // portent la cote à eux seuls plutôt que de la diviser par deux
    const zSp = mix([
      [0.50, zToi],
      [0.30, z.shots(per(r, 'shots'))],
      [0.20, z.sh(per(r, 'shPoints'))],
    ]);

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
      // Lancers : la primitive du moteur par événements (voir MOTEUR.md). Le
      // pourcentage de tir ne se stocke pas, il se déduit — g / sh.
      sh: r.shots || 0,
      // Les unités spéciales : buts et points en avantage, buts et points
      // en désavantage. Absents si l'API ne les donne pas — le moteur sait
      // alors qu'il doit deviner les unités au lieu de les lire.
      ...(r.ppGoals != null ? { ppg: r.ppGoals || 0, ppp: r.ppPoints || 0, shg: r.shGoals || 0, shp: r.shPoints || 0 } : {}),
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
      // Lancers contre : la cible objective de la défensive (voir MOTEUR.md).
      // Les arrêts ne se stockent pas, ils se déduisent — sa × sv.
      sa: r.shotsAgainst || 0,
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

/** Nombre de matchs d'une saison écourtée, sinon 82 (80 avant 1992-93, sans effet ici). */
export function seasonGames(season) {
  if (season === '1994-95' || season === '2012-13') return 48;
  if (season === '2020-21') return 56;
  if (season === '2019-20') return 70;
  return 82;
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
/* ---------- La valeur d'un joueur, lue dans ses statistiques ---------- */
/*
 * LA COTE GLOBALE N'EXISTE PLUS COMME COTE. Elle mélangeait les sous-cotes
 * `o`, `d`, `r`, `c` — donc des z-scores de z-scores — avec un bonus de rang.
 * On ne pouvait ni la lire ni la contester : c'était un chiffre qui tombait
 * du ciel et décidait de la zone, du salaire et de l'alignement automatique.
 *
 * Ce qui la remplace tient en deux temps.
 *
 *  1. UN SCORE, tiré des colonnes du joueur et de rien d'autre. Chaque terme
 *     est divisé par le régulier moyen de SA saison, donc un ailier de 1981 et
 *     un ailier de 2015 se comparent.
 *  2. UNE PROJECTION sur la distribution historique de la valeur, par
 *     position. Le RANG vient des statistiques ; l'ÉCHELLE, elle, est celle
 *     que le jeu utilisait déjà.
 *
 * Le deuxième temps n'est pas un artifice : c'est ce qui garantit que les
 * seuils de zone, la courbe des salaires et l'économie du plafond continuent
 * de valoir ce qu'ils valaient. Changer qui est premier est un choix de
 * conception ; changer combien de joueurs valent 70 en serait un autre, et on
 * n'en veut qu'un à la fois.
 */
export const VALEUR_CENTILES = {
  F: [
    34, 37, 38, 39, 39, 40, 40, 40, 41, 41,
    41, 42, 42, 42, 42, 43, 43, 43, 43, 44,
    44, 44, 44, 45, 45, 45, 45, 46, 46, 46,
    46, 46, 47, 47, 47, 47, 48, 48, 48, 48,
    49, 49, 49, 49, 50, 50, 50, 50, 51, 51,
    51, 51, 52, 52, 52, 53, 53, 53, 54, 54,
    54, 54, 55, 55, 55, 56, 56, 57, 57, 57,
    58, 58, 58, 59, 59, 60, 60, 61, 61, 61,
    62, 63, 63, 64, 64, 65, 66, 66, 67, 68,
    69, 70, 72, 74, 76, 79, 82, 85, 89, 95,
    99,
  ],
  D: [
    36, 44, 46, 47, 48, 49, 49, 50, 50, 50,
    51, 51, 51, 52, 52, 52, 53, 53, 53, 53,
    54, 54, 54, 54, 54, 55, 55, 55, 55, 55,
    56, 56, 56, 56, 56, 57, 57, 57, 57, 57,
    58, 58, 58, 58, 58, 59, 59, 59, 59, 59,
    59, 60, 60, 60, 60, 60, 61, 61, 61, 61,
    62, 62, 62, 62, 63, 63, 63, 64, 64, 64,
    65, 65, 65, 66, 66, 67, 67, 68, 69, 69,
    70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
    81, 82, 83, 84, 86, 87, 89, 90, 93, 96,
    99,
  ],
  G: [
    26, 28, 29, 30, 31, 33, 34, 36, 37, 38,
    39, 40, 40, 41, 41, 42, 43, 44, 44, 45,
    45, 46, 46, 47, 47, 48, 48, 48, 49, 49,
    50, 50, 51, 51, 51, 52, 52, 52, 53, 53,
    54, 54, 55, 55, 55, 56, 56, 57, 57, 58,
    58, 58, 59, 59, 60, 60, 61, 61, 62, 62,
    62, 63, 64, 64, 65, 65, 66, 66, 67, 67,
    68, 68, 69, 69, 70, 71, 71, 72, 73, 74,
    74, 75, 76, 76, 77, 78, 79, 79, 80, 81,
    81, 82, 83, 84, 85, 86, 87, 89, 91, 93,
    99,
  ],
};

/** La valeur du centile q (0..1) parmi les joueurs de cette position. */
function valeurAuCentile(pos, q) {
  const t = VALEUR_CENTILES[pos] || VALEUR_CENTILES.F;
  const x = clamp(q, 0, 1) * 100;
  const i = Math.min(99, Math.floor(x));
  const f = x - i;
  return Math.round(t[i] * (1 - f) + t[i + 1] * f);
}

/*
 * Le score d'un patineur. Quatre termes, tous mesurés, tous disponibles
 * depuis 1970-71 sauf le temps de glace, dont le poids se redistribue quand
 * il manque.
 *
 *   PRODUCTION   points par match, sur le régulier moyen de sa saison
 *   VOLUME       lancers par match, idem — il sépare le joueur utilisé du
 *                joueur chanceux
 *   DIFFÉRENTIEL +/- par match, lissé de la moyenne de son vestiaire, sinon
 *                un premier trio d'équipe faible est puni de l'être
 *   USAGE        temps de glace quand il existe, part des matchs joués sinon
 *
 * Les trois premiers sont des TAUX, et un taux sur huit matchs ne veut rien
 * dire : un rappel à quatre points en huit soirs afficherait la production
 * d'une vedette. Chacun est donc ramené vers la moyenne au prorata de
 * l'échantillon (`gp / (gp + FIABILITE)`) — mesuré, sans ça la ligue tombait à
 * 3,8 attaquants de top 6 par équipe au lieu de 6, les recrues occupant les
 * hauts de classement.
 *
 * Les poids diffèrent par position parce que le métier diffère : un défenseur
 * n'est pas jugé sur ses points au même titre qu'un ailier.
 *
 * LE DIFFÉRENTIEL A ÉTÉ RAMENÉ DE 0,36 À 0,24 CHEZ LES DÉFENSEURS, mesuré.
 * À 0,36 il faisait sortir Jeff Schultz 2009-10 — 23 points, +50 dans un
 * Washington qui écrasait la ligue — à 97, donc « Top 2 », étiquette qui
 * envoie le joueur le mettre en première paire ; rejoué, il vaut exactement
 * une case vide (40,4 victoires contre 40,3 sans personne, 46,9 avec
 * Lidström). Le +/- est en partie un résultat d'équipe, et `LISSAGE_EQUIPE`
 * n'en retire que la moitié. Le poids libéré va à la production et à l'usage,
 * qui sont ce que l'entraîneur, lui, a vraiment décidé.
 *
 * Mesuré sur les 55 saisons : Schultz passe de 97 à 89, Craig Muni 1988-89
 * de 94 à 86, et les défenseurs à valeur 85+ produisant moins de 0,40 point
 * par match tombent de 94 à 38 sur 735. Chris Chelios 1992-93, lui, monte de
 * 88 à 92 — il était sous-évalué. La corrélation entre la force d'une équipe
 * et son vrai classement passe de 0,801 à 0,793, ce qui reste le repère.
 * Descendre le différentiel plus bas (0,16) ferait mieux sur les cas
 * aberrants (8 sur 735) mais coûterait la corrélation (0,783) : c'est le
 * repère qui fait autorité, donc on s'arrête ici. Baisser le différentiel ne
 * crée pas d'aubaine défensive : un alignement glouton sur la cote `d` par
 * dollar ne fait que 40,5 victoires, faute de marquer.
 */
export const POIDS_VALEUR = {
  F: { prod: 0.46, vol: 0.14, pm: 0.20, usage: 0.20 },
  D: { prod: 0.34, vol: 0.10, pm: 0.24, usage: 0.32 },
};

/** Poids d'un échantillon : un taux sur huit matchs pèse le tiers d'un vrai. */
export const FIABILITE = 22;
const fiable = (gp, valeur, moyenne = 1) => {
  const w = gp / (gp + FIABILITE);
  return w * valeur + (1 - w) * moyenne;
};

function scorePatineur(p, ctx) {
  const gp = Math.max(1, p.gp || 0);
  const est_D = p.p === 'D';
  const [, , shF, shD, ptF, ptD] = seasonLancers(p.s || ctx.season);
  const w = POIDS_VALEUR[est_D ? 'D' : 'F'];

  const prod = fiable(gp, (p.pt || 0) / gp / (est_D ? (ptD || 0.35) : (ptF || 0.62)));
  const vol = fiable(gp, (p.sh || 0) / gp / (est_D ? (shD || 1.35) : (shF || 1.75)));
  const pm = fiable(gp, ((p.pm || 0) - LISSAGE_EQUIPE * (ctx.pmEquipe.get(p.t ?? p.teams?.[0]) || 0)) / gp, 0);
  const usage = p.toi ? fiable(gp, p.toi / (est_D ? 21 : 16)) : gp / ctx.games;

  // Racine sur la production : l'écart entre le 1er et le 20e marqueur compte
  // plus que celui entre le 200e et le 220e, mais pas au carré.
  return w.prod * Math.sqrt(Math.max(0, prod))
    + w.vol * Math.sqrt(Math.max(0, vol))
    + w.pm * clamp(pm / 0.35, -1.5, 1.5)
    + w.usage * clamp(usage, 0, 1.6);
}

/*
 * Le score d'un gardien : ce qu'il arrête de plus que sa ligue, et combien de
 * soirs il le fait. Un auxiliaire à ,930 en douze départs n'est pas un numéro
 * un, et la part de matchs le dit.
 */
function scoreGardien(p, ctx) {
  const svLigue = 1 - (seasonLancers(p.s || ctx.season)[1] || 10.5) / 100;
  const ecart = fiable(p.gp || 0, ((p.sv ?? svLigue) - svLigue) / 0.020, 0);
  const charge = clamp((p.gp || 0) / ctx.games / 0.55, 0, 1.4);
  return 0.72 * clamp(ecart, -2.5, 2.5) + 0.28 * charge * 2.5;
}

/** La valeur d'un joueur : son rang statistique, sur l'échelle du jeu. */
export function valeurDeSaison(players, season, games) {
  const pmEquipe = new Map();
  const acc = new Map();
  for (const p of players) {
    if (p.p === 'G') continue;
    for (const t of (p.teams || [p.t]).filter(Boolean)) {
      const a = acc.get(t) || { s: 0, n: 0 };
      a.s += p.pm || 0; a.n += 1;
      acc.set(t, a);
    }
  }
  for (const [t, a] of acc) pmEquipe.set(t, a.n ? a.s / a.n : 0);
  const ctx = { season, games, pmEquipe };

  for (const groupe of ['F', 'D', 'G']) {
    const liste = players.filter(p => p.p === groupe);
    if (!liste.length) continue;
    const notes = liste.map(p => ({
      p, sc: groupe === 'G' ? scoreGardien(p, ctx) : scorePatineur(p, ctx),
    }));
    notes.sort((a, b) => a.sc - b.sc);
    const n = notes.length;
    notes.forEach((x, i) => { x.p.v = valeurAuCentile(groupe, n > 1 ? i / (n - 1) : 0.5); });
  }
}

export function finalizeSeason(players, season, opts = {}) {
  const year = parseInt(season.slice(0, 4), 10);
  const games = seasonGames(season);

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

  // La valeur ne vient plus des sous-cotes : elle est le rang statistique du
  // joueur dans sa saison, projeté sur l'échelle du jeu (voir valeurDeSaison).
  valeurDeSaison(players, season, games);
  // Le contexte de création lit la valeur (pour ranger les trios) : après.
  contexteDeCreation(players, season);

  for (const p of players) {

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

    p.ak = archetypeKey(p);
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
  // `an` : par équipe, matchs, occasions et buts en avantage numérique de la
  // saison (team/powerplay), quand l'API les donne. `build_lancers.mjs` en
  // tire les deux derniers nombres d'époque de SEASON_LANCERS.
  const an = opts.avantages && Object.keys(opts.avantages).length ? { an: opts.avantages } : {};
  return { season: label, minGP, v: RATINGS_VERSION, ...an, players: expandByTeam(players, label) };
}

/**
 * Recalcule l'étage 2 d'un shard existant, sans l'API. Les sous-cotes
 * o, d, r, c, sp restent telles quelles ; v, $, archétype et zone sont
 * refaits avec la formule courante.
 */
export function rerateShard(shard, opts = {}) {
  const players = finalizeSeason(collapseByTeam(shard.players), shard.season, opts);
  return { season: shard.season, minGP: shard.minGP, v: RATINGS_VERSION, ...(shard.an ? { an: shard.an } : {}), players: expandByTeam(players, shard.season) };
}
