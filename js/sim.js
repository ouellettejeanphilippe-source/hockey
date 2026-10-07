/**
 * Structure de l'alignement et simulation de la saison.
 *
 * Calibration vérifiée avec 23 joueurs de cote uniforme (12 essais par palier),
 * voir le tableau dans CLAUDE.md et `node scripts/calibrate_sim.mjs`.
 * Toute modification des constantes doit être revalidée (voir PLAN.md, S3).
 */

import { CARTES_MATCH, mainAdverse, OPTIONS_COMBAT, energieAdverse, energieDepensee } from './combat.js';
import { effetCarte, poserSoirGrand } from './rarete.js';
import { ROLES_REF } from './roles_ref.js';
import { getLineZone, seasonGames, seasonLancers, LINE_ZONES, ZONES_ETOILE, ZONE_THRESHOLDS,
         POIDS_TRIO, POIDS_PAIRE, RAPPEL_PASSES, passesRelatives, creationAutour, ageAtSeason } from './ratings.js';
import { franchiseDuCode } from './franchises.js';
import { facteurDefensifEquipe, facteurTraitGardien, facteurSeriesEquipe,
         facteurAttaqueEquipe, facteurLancersJoueur, facteurFinitionJoueur,
         bonusMeneurEquipe, facteurPresenceUnite, bonusRobustesseEquipe, getTraits } from './traits.js';
import { estD, borne } from './util.js';
import { coachDesRoles, porteParSesJoueurs } from './coachs.js';
import { MODIFS_VIE } from './cartes-vie.js';
import { MOMENTS_VIE, REPONSES_VIE } from './vie-gm.js';

export const CAP = 95_500_000;
/*
 * LES RELANCES. JP : *limiter les rolls à 2*. C'était six années, six
 * équipes et quatre passes — seize façons de refuser un vestiaire, donc
 * aucune décision difficile avant le huitième tour. À deux chacune, une
 * relance coûte quelque chose : on la garde pour le moment où la roulette
 * sort un club sans gardien, pas pour l'esthétique du premier trio.
 */
export const REROLLS = { season: 2, team: 2, pass: 2 };

/*
 * LES FAÇONS DE JOUER : deux formats, deux tirages, quatre modes. Le moteur
 * ne change pas d'un mode à l'autre — ce sont toujours 23 cases, le même
 * malus de zone et la même ligue de 32 équipes. Ce qui change, c'est ce
 * qu'on te demande de bâtir, et comment la roulette te le propose.
 *
 * Le format dit COMBIEN de cases tu combles :
 *   COMPLET   les 23, sous 95,5 M$. La partie complète.
 *   EXPRESS   six — un trio, une paire, un partant — et le reste t'est fourni
 *             par une vraie équipe. Le plafond suit : 34 M$, la médiane
 *             mesurée de ce qu'une vraie équipe met sur ces six cases-là
 *             (p25 23 M$, p75 43 M$ sur les 1395 équipes-saisons).
 *
 * Le tirage dit D'OÙ viennent les joueurs qu'on te propose :
 *   VESTIAIRE  le jeu d'origine. La roulette sort UNE équipe et tout son
 *              vestiaire ; tu signes un joueur, n'importe lequel, pour
 *              n'importe quelle case libre, et elle tourne. Deux relances
 *              d'année, deux d'équipe, deux passes (REROLLS). C'est la
 *              chasse aux aubaines, et JP y tient : « fallait pas enlever
 *              l'ancien mode de jeu ».
 *   LOTO       la roulette sort TROIS équipes et te montre, de chacune, le
 *              joueur de LA case exacte — l'ailier gauche du premier trio
 *              de trois clubs, alignés par valeur (`autoRoster`). Tu en
 *              choisis un. Les relances relancent les trois d'un coup, et
 *              elles sont comptées.
 */
export const MODES = {
  CLASSIQUE: {
    nom: 'Classique', format: 'COMPLET', tirage: 'VESTIAIRE', cap: CAP, renfort: false, loto: false, relances: 0,
    desc: 'Vingt-trois joueurs, un par tour, dans le vestiaire d\'une vraie équipe. Deux relances d\'année, deux d\'équipe, deux passes.',
  },
  LOTO: {
    nom: 'Loto', format: 'COMPLET', tirage: 'LOTO', cap: CAP, renfort: false, loto: true, relances: 2,
    desc: 'Vingt-trois cases, et pour chacune le même joueur de trois équipes : tu choisis. Deux relances.',
  },
  EXPRESS: {
    nom: 'Express', format: 'EXPRESS', tirage: 'VESTIAIRE', cap: 34_000_000, renfort: true, loto: false, relances: 0,
    desc: 'Un trio, une paire, un partant, pris dans le vestiaire d\'une vraie équipe à chaque tour. Le reste vient d\'une autre vraie équipe.',
  },
  LOTO_EXPRESS: {
    nom: 'Loto express', format: 'EXPRESS', tirage: 'LOTO', cap: 34_000_000, renfort: true, loto: true, relances: 2,
    desc: 'Six cases, trois candidats pour chacune, deux relances. Le reste vient d\'une vraie équipe.',
  },
};

/** La clé de mode pour un format et un tirage donnés. */
export function modeDe(format, tirage) {
  return Object.keys(MODES).find(k => MODES[k].format === format && MODES[k].tirage === tirage) || 'CLASSIQUE';
}

/** Les cases que le joueur comble lui-même dans ce mode. */
export function casesDuMode(mode) {
  if (!MODES[mode]?.renfort) return CASES_DE_BASE;
  return SLOTS.filter(s => !s.scratch && s.unit === 0 && (s.group === 'F' || s.group === 'D' || s.group === 'G'));
}

/**
 * Le joueur que cette équipe met à CETTE case : la main du tirage LOTO.
 *
 * TROIS JOUEURS QUI JOUENT LA POSITION DE LA CASE, et JP l'a dit : *ça me
 * semblait évident*. La première version prenait ce qu'`autoRoster` posait à
 * la case, et le glouton y mettait volontiers un centre à −3 ou un ailier
 * droit à −2 quand ils valaient plus que le vrai ailier gauche. Maintenant,
 * pour une case habillée, on range les joueurs du club qui jouent cette
 * position SANS pénalité (leur poste, ou leur poste secondaire) par valeur,
 * et on prend celui du rang de la case : le deuxième ailier gauche du club
 * pour ton deuxième trio, son deuxième gardien pour ton auxiliaire. Un club
 * qui n'en a pas assez donne son dernier ; un club qui n'en a aucun retombe
 * sur l'alignement automatique. Les cases de réserve n'ont pas de position
 * établie : elles gardent ce qu'`autoRoster` y met. `exclude` retire les
 * joueurs déjà signés, donc un club qui ressort après qu'on lui a pris son
 * ailier montre le suivant.
 */
export function joueurEquivalent(pool, slot, exclude = new Set(), rang = null) {
  if (!slot) return null;
  if (!slot.scratch) {
    // Le rang demandé, sinon celui de la case. L'interface le calcule pour
    // que l'échelle descende toujours (voir `rangDeLaMain`, js/game.js).
    const n = Number.isFinite(rang) ? Math.max(0, rang) : slot.unit;
    const naturels = pool
      .filter(p => !exclude.has(getPersonKey(p)) && fits(p, slot) && getPositionPenalty(p, slot) === 0)
      .sort((a, b) => getHiddenRatings(b).v - getHiddenRatings(a).v);
    const p = naturels[n] ?? naturels[naturels.length - 1];
    if (p) return p;
  }
  return autoRoster(pool, exclude)[slot.i] || null;
}

/*
 * LES MOLETTES DE MESURE. Un script peut poser une constante dans
 * l'environnement pour balayer un réglage ; le navigateur n'a pas de
 * `process` et prend toujours la valeur écrite. Déclaré ICI, en tête, parce
 * que le malus de zone, l'appariement et les situations en lisent.
 */
const ENV_MESURE = (typeof process !== 'undefined' && process.env) || {};

/*
 * Une molette de mesure qui porte une LISTE : « 0,45,1.3,1.9 » dans
 * l'environnement, la valeur écrite sinon. Une seule implémentation pour les
 * quatre listes réglables du fichier (les deux échelles de zone et les deux
 * parts d'unité) — trois copies de la même lecture divergeraient.
 */
const lireListe = (cle, defaut) => {
  const v = ENV_MESURE[cle];
  if (!v) return defaut;
  const t = v.split(',').map(Number);
  return t.length === defaut.length && t.every(Number.isFinite) ? t : defaut;
};

/*
 * Pénalité de zone : ce qu'on perd à placer un joueur ailleurs que dans son
 * calibre. Elle est ASYMÉTRIQUE, et c'est elle qui ferme l'empilement.
 *
 * Empiler, c'est mettre un joueur de top 6 SOUS sa zone — au 3e ou au 4e trio,
 * du talent qu'on paie et qu'on gaspille. C'est un choix, on le punit fort.
 * Une équipe faible place ses joueurs AU-DESSUS de la leur parce qu'elle n'a
 * personne de mieux ; la punir autant reviendrait à la punir deux fois, une
 * fois par ses cotes et une fois par des trios qu'elle ne peut pas éviter.
 *
 * Le malus « sous sa zone » est PROPORTIONNEL au talent gaspillé — l'écart
 * entre la cote du joueur et le calibre attendu de la case. Un forfait par
 * cran, essayé d'abord, crée un piège : les seuils de zone étant absolus,
 * améliorer un défenseur de 70 à 80 lui fait franchir le seuil de la 1re paire
 * (71), ce qui rend d'un coup la 3e paire « sous-employée » et fait PERDRE des
 * matchs à l'équipe. Mesuré : 70 -> 55-25, 80 -> 43-38. Un malus proportionnel
 * ne peut pas s'inverser, puisqu'il retire une fraction de ce qu'on vient de
 * gagner.
 *
 * Mesuré avec `node scripts/mock_zones.mjs`, sur le meilleur alignement légal
 * atteignable sous le plafond (cueillette libre sur 55 saisons), comparé à de
 * vraies équipes :
 *
 *   réglage                  EMPILÉ  MTL 76-77  BOS 70-71  NYI 92-93  DET 76-77
 *   aucun malus                80,3       67,6       68,0       58,7       47,4
 *   linéaire (avant S62)       65,8       65,4       65,7       58,5       48,1
 *   EN VIGUEUR (échelles S62)  66,7       65,7       65,9       58,8       48,4
 *
 * L'empilement perd quatorze points et se retrouve à 66,7, à peine au-dessus
 * de la meilleure équipe de l'histoire. Les vraies équipes témoins ne bougent
 * pas : la chasse aux aubaines reste payante, mais on ne peut plus empiler
 * douze vedettes.
 *
 * Les deux constantes ne tirent pas sur la même chose. Sur un alignement
 * empilé la pénalité sature, donc c'est ZONE_PEN_MAX qui mord ; sur une vraie
 * équipe elle reste sous le plafond, donc c'est ZONE_PEN_SOUS qui mord. Un
 * coefficient bas et un plafond haut épargnent donc les vraies équipes tout en
 * fermant l'empilement — un coefficient élevé punit les deux.
 *
 * La monotonie se vérifie avec `node scripts/check_monotonie.mjs`, sur de
 * vraies équipes. `calibrate_sim.mjs` aligne douze joueurs identiques, ce qui
 * fabrique une marche artificielle à o = 76 (frontière d'archétype) : sa table
 * n'est pas le juge de la monotonie.
 */
const ZONE_PEN_SOUS = 0.40;   // fraction de l'excédent de cote, par joueur mal placé
export const ZONE_PEN_DESSUS = Number(ENV_MESURE.ZONE_PEN_DESSUS ?? 1.5);
export const ZONE_PEN_MAX = 70;      // plafond par unité

/*
 * UN CRAN, ÇA PASSE ; DEUX, ÇA NE PASSE PLUS (S62).
 *
 * JP : *faire que malus d'un joueur sous une ou au dessus de une ligne, soit
 * pas si grand, mais si deux et plus, énorme*. Le coefficient ci-dessus était
 * PLAT : il ne regardait que le talent gaspillé et jamais de combien de lignes
 * le joueur était déplacé. Deux échelles l'escaladent, et elles ne mesurent
 * pas la même chose.
 *
 *   ZONE_ECHELLE   par ÉCART DE LIGNES, indexée par l'écart (0 est inutilisé).
 *                  Un cran coûte 45 % de l'ancien malus, deux 130 %, trois
 *                  190 % : un ailier descendu d'une ligne ne se sent presque
 *                  pas, une vedette parquée au quatrième trio se sent
 *                  énormément. Le malus reste PROPORTIONNEL au talent gaspillé
 *                  — l'échelle ne fait que le multiplier — donc il ne peut
 *                  toujours pas s'inverser (le piège du forfait, ci-dessus).
 *   (1.0 · J1-L) ZONE_NOMBRE ne joue plus que si un joueur de l'unité est à
 *   DEUX crans ou plus ; quand tous sont à un cran au plus, c'est
 *   ZONE_NOMBRE_UN (1 · 1 · 1,25 · 1,8) : deux vedettes au 2e trio passent,
 *   trois non. Un cran coûte 0,55 au lieu de 0,45 pour garder l'empilement
 *   fermé (mock_zones : EMPILÉ 66,8, les témoins à +0,2 du linéaire).
 *   ZONE_NOMBRE    par NOMBRE DE MAL PLACÉS dans l'unité, indexée par le
 *                  compte. Un mal placé coûte ce qu'il coûte, deux coûtent
 *                  1,6 fois la somme, trois 2,2 fois : un joueur hors de sa
 *                  place, les deux autres couvrent ; tout le trio hors de sa
 *                  place, plus rien ne tient.
 *
 * POURQUOI LA SECONDE EXISTE, et c'est la mesure qui l'a exigée : rendre un
 * cran trois fois moins cher rend l'empilement du DEUXIÈME trio trois fois
 * moins cher aussi, et le meilleur alignement légal remontait de 65,8 à 71,2
 * sur l'indice de `mock_zones` — au-dessus de la meilleure vraie équipe de
 * l'histoire. Avec `ZONE_NOMBRE`, il redescend à 66,7 et les quatre équipes
 * témoins ne bougent pas de plus de 0,3.
 *
 * ET POURQUOI L'ESCALADE PAR L'ÉCART NE TOUCHE PAS LE HOCKEY RÉEL : sur les
 * 1392 vraies équipes alignées par `autoRoster`, un écart de DEUX crans se
 * voit dans 2 % des quatrièmes trios et 0 % partout ailleurs. Une vraie équipe
 * vit à zéro ou un cran ; l'alignement empilé, lui, a trois mal placés à deux
 * crans au troisième trio et à trois crans au quatrième. C'est un
 * discriminateur, pas un compromis.
 *
 * `ZONE_PUISSANCE` ne sert qu'au côté AU-DESSUS (`ZONE_PEN_DESSUS × écart²`,
 * soit 1,5 · 6 · 13,5) : un cran y coûte deux fois moins qu'avant et trois
 * crans une fois et demie plus, parce qu'une mauvaise équipe joue au-dessus de
 * sa zone faute de mieux et que la punir deux fois serait la punir de son
 * effectif.
 */
// 1.0 · J1-L : un cran passe de 0,45 à 0,55 — le prix du nombre adouci (ZONE_NOMBRE_UN), mesuré sur mock_zones.
export const ZONE_ECHELLE = lireListe('ZONE_ECHELLE', [0, 0.55, 1.30, 1.90]);
export const ZONE_PUISSANCE = Number(ENV_MESURE.ZONE_PUISSANCE ?? 2);
export const ZONE_NOMBRE = lireListe('ZONE_NOMBRE', [1, 1, 1.6, 2.2]);
// Le nombre ne multiplie que si un joueur de l'unité est à ce nombre de crans ou plus (1.0 · J1-L).
const ZONE_NOMBRE_DES = Number(ENV_MESURE.ZONE_NOMBRE_DES ?? 2);
// En dessous (tous à un cran au plus), un multiplicateur adouci : deux mal placés passent, trois non (1.0 · J1-L).
const ZONE_NOMBRE_UN = lireListe('ZONE_NOMBRE_UN', [1, 1, 1.25, 1.8]);
/*
 * Au-delà de ce malus, l'écran ne dit plus « mal assorti » mais « hors de ses
 * lignes » (voir `zoneEtat` plus bas). Douze points de synergie, c'est ce que
 * coûte un joueur à deux crans de sa zone : le seuil marque donc exactement la
 * frontière que JP a demandée, et l'étiquette la rend visible.
 */
// 1.0 · J1-L : 15. Deux vedettes au 2e trio (5,5 × 2 × 1,25 = 13,8) disent « un joueur mal placé » ;
// trois (29,7) et tout joueur à deux crans de sa zone disent « hors de ses lignes ».
const ZONE_DUR = 15;

/**
 * Calibre attendu d'une case : la cote plancher de la meilleure zone dont
 * cette unité fait partie. Sert de référence au malus proportionnel — un
 * joueur qui vaut ce calibre-là n'est pas gaspillé, il est à sa place.
 */
function calibreAttendu(group, unit) {
  const pos = group === 'D' ? 'D' : 'F';
  const zones = LINE_ZONES[pos];
  for (let i = 0; i < zones.length; i++) {
    if (zones[i].idealUnits.includes(unit)) return ZONE_THRESHOLDS[pos][i] ?? 40;
  }
  return 40;
}

/*
 * LES UNITÉS OÙ UN JOUEUR REND À 100 % : sa zone (`getLineZone`), plus un
 * cran vers le haut par carte « Monte d'un cran » (S78, l'atelier : `_cran`).
 * « Joue en bas » (`_enBas`) n'agrandit PAS cette liste : le 2e et le 3e trio
 * restent punis. Seul le DERNIER rang (4e trio, 3e paire) échappe au malus,
 * et `malusZoneUnite` est le seul endroit qui le sait.
 */
export function unitesIdeales(p, v) {
  const ideal = getLineZone(p, v).idealUnits;
  const cran = (p && p._cran) || 0;
  if (!cran) return ideal;
  const haut = Math.min(...ideal), plus = [];
  for (let k = 1; k <= cran && haut - k >= 0; k++) plus.push(haut - k);
  return [...plus, ...ideal];
}

/** Dernier rang du groupe : le 4e trio, la 3e paire. C'est là que « Joue en bas » ne punit plus. */
function rangDuBas(group) {
  return group === 'D' || group === 'LD' || group === 'RD' ? 2 : 3;
}
/** Vrai si ce joueur, assis au dernier rang, ne paie pas la pénalité de joueur trop bas. */
export function joueEnBas(p, group, unit) {
  return !!(p && p._enBas && unit === rangDuBas(group));
}

/**
 * Le malus d'UN joueur mal placé, en points de cote.
 *
 * `ideal` sont les unités où il rend à 100 % (`getLineZone().idealUnits`).
 * Sous sa zone, le malus est PROPORTIONNEL au talent gaspillé et croît en
 * PUISSANCE de l'écart, mesuré en crans de ligne : un cran passe, deux ne
 * passent plus. Au-dessus, le forfait par cran croît de la même façon.
 *
 * C'est la SEULE implémentation : `getUnitSynergy` et `scripts/mock_zones.mjs`
 * l'appellent tous les deux, sinon la maquette et le moteur divergeraient en
 * silence.
 */
function malusZoneJoueur(group, unit, v, ideal, opts = {}) {
  const ecart = Math.min(...ideal.map(u => Math.abs(u - unit)));
  if (ecart === 0) return 0;
  const puissance = opts.puissance ?? ZONE_PUISSANCE;
  const echelle = opts.echelle ?? ZONE_ECHELLE;
  const rang = Math.min(ecart, echelle.length - 1);
  if (unit > Math.max(...ideal)) {
    const gaspille = Math.max(0, v - calibreAttendu(group, unit));
    return (opts.sous ?? ZONE_PEN_SOUS) * gaspille * (opts.lineaire ? 1 : echelle[rang]);
  }
  return (opts.dessus ?? ZONE_PEN_DESSUS) * (opts.lineaire ? ecart : Math.pow(ecart, puissance));
}

/**
 * Le malus d'une UNITÉ, et c'est la seule implémentation : `getUnitSynergy`
 * et `scripts/mock_zones.mjs` l'appellent tous les deux.
 *
 * `entrees` : un {v, ideal} par joueur de l'unité. Rend le malus en points de
 * cote (jamais négatif), déjà plafonné, et le nombre de mal placés.
 */
export function malusZoneUnite(group, unit, entrees, opts = {}) {
  let somme = 0, mal = 0, ecartMax = 0;
  const bas = rangDuBas(group);
  for (const e of entrees) {
    const ideal = e.ideal;
    const ecartBrut = Math.min(...ideal.map(u => Math.abs(u - unit)));
    // « Joue en bas » : le dernier rang seulement, et seulement s'il était
    // trop bas. Le 2e et le 3e trio gardent leur écart — sinon cacher une
    // vedette un cran sous sa zone ne coûterait plus rien.
    const auFond = !!(e.enBas && unit === bas && unit > Math.max(...ideal));
    const ecart = auFond ? 0 : ecartBrut;
    const pen = auFond ? 0 : malusZoneJoueur(group, unit, e.v, ideal, opts);
    if (pen > 0 || ecart > 0) mal++;
    if (ecart > ecartMax) ecartMax = ecart;
    somme += pen;
  }
  /*
   * UN CRAN PASSE, DEUX NE PASSENT PLUS — MÊME À PLUSIEURS (1.0 · J1-L). Le
   * multiplicateur de nombre s'appliquait quel que soit l'écart : deux vedettes
   * au 2e trio (un cran chacune) coûtaient 2 × 4,5 × 1,6 = 14,4, donc « hors de
   * ses lignes ». Il ne joue plus que si un joueur de l'unité est à deux crans
   * ou plus — c'est là qu'il ferme l'empilement (mesuré : un vrai club n'a
   * presque jamais d'écart de deux, l'alignement empilé en a partout).
   */
  const nombre = opts.nombre ?? ZONE_NOMBRE;
  const seuil = opts.nombreDes ?? ZONE_NOMBRE_DES;
  const table = ecartMax >= seuil ? nombre : (opts.nombreUn ?? ZONE_NOMBRE_UN);
  const mult = opts.lineaire ? 1 : table[Math.min(mal, table.length - 1)];
  return { pen: Math.min(opts.plafond ?? ZONE_PEN_MAX, somme * mult), mal };
}

/* ---------- 23 joueurs : 4 trios, 3 paires, 2 gardiens, 3 réservistes ---------- */

/*
 * L'ÉTIQUETTE D'UNE CASE DIT QUI Y EST CHEZ LUI (1.0 · J1-K). Avant : « Top 6 /
 * Middle 6 / Bottom 6 » et « Top 4 / Bottom 4 », alors que les zones se
 * chevauchent — un Bottom 6 est chez lui au 3e trio (une case « Middle 6 »), et
 * un 78+ n'est chez lui qu'au 1er trio (le 2e, une case « Top 6 », lui coûtait un
 * cran). L'étiquette liste les zones standard et vedette dont les unités idéales
 * comprennent la case : la même table que le moteur (les zones des polyvalents,
 * T1-3 et cie, couvrent plusieurs cases et ne s'écrivent pas sur une case).
 */
const zonesDeLaCase = (group, unit) =>
  [ZONES_ETOILE[group], ...LINE_ZONES[group]].filter(z => z.idealUnits.includes(unit));
const etiquetteDeCase = (group, unit) => zonesDeLaCase(group, unit).map(z => z.mini).join(' · ');
export const SLOTS = [];
[0, 1, 2, 3].forEach(unit => {
  const label = etiquetteDeCase('F', unit);
  ['AG', 'C', 'AD'].forEach(role => SLOTS.push({ group: 'F', unit, role, label }));
});
[0, 1, 2].forEach(unit => {
  const label = etiquetteDeCase('D', unit);
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
/*
 * LES CASES DE RÉSERVE DE PLUS (S80, le mode Rogue). JP : *possible de
 * discard les cartes de remplaçants ou débloquer des slots de remplacement*.
 * Deux cases de réserviste qui prennent n'importe qui, APRÈS les 23 : aucun
 * mode ne les remplit (`casesDuMode` et `autoRoster` les sautent), et une
 * case vide ne coûte rien au moteur. Remplies, `activeLineup` les lit comme
 * les autres réservistes : leur joueur monte quand un habillé se blesse. Le
 * Rogue les ouvre au vestiaire des déblocages (js/rogue.js `reservesDeLaRun`).
 */
export const RESERVES_EN_PLUS = 2;
for (let n = 1; n <= RESERVES_EN_PLUS; n++) SLOTS.push({ group: 'ANY', unit: n, role: `Réserve +${n}`, label: 'Réservistes', scratch: true, extra: n });
SLOTS.forEach((s, i) => { s.i = i; });
/* Les 23 cases de toujours : ce que tous les modes remplissent. */
export const CASES_DE_BASE = SLOTS.filter(s => !s.extra);

const RATINGS_VAULT = new Map();

export function getPlayerKey(p) {
  if (p._rk) return p._rk;
  if (p.id) return `${p.s}_${p.t}_${p.id}`;
  return `${p.s}_${p.t}_${p.n}_${p.p}`;
}

/**
 * Le JOUEUR-SAISON, sans son équipe. Un joueur échangé en cours de saison est
 * dans le vestiaire de CHAQUE équipe où il a passé (marqué `x:1`), avec un
 * objet distinct par équipe : comparer les objets laissait donc signer deux
 * fois le même joueur-saison — Budaj 2015-16 avec le Colorado, puis le même
 * Budaj avec Los Angeles — et aligner le même homme dans deux clubs de la
 * même ligue. `getPlayerKey` porte l'équipe parce qu'elle sert de clé au
 * coffre des cotes ; celle-ci identifie la personne.
 */
export function getPersonKey(p) {
  if (!p) return '';
  return p.id != null ? `${p.s}_${p.id}` : `${p.s}_${p.n}_${p.p}`;
}

export function registerHiddenRatings(p) {
  if (!p) return;
  const key = getPlayerKey(p);
  p._rk = key;
  // `sp` est dans les shards mais aucune formule ne le lit : c'était du temps
  // de glace et du volume de tirs déguisés en vitesse (mesuré, Chára sortait
  // plus « rapide » que Gaudreau). On le retire de l'objet sans le garder.
  if (p.o !== undefined) {
    RATINGS_VAULT.set(key, {
      o: p.o, d: p.d, r: p.r, c: p.c, v: p.v
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
  if (!p) return { o: 50, d: 50, r: 50, c: 50, v: 50 };
  const key = getPlayerKey(p);
  if (RATINGS_VAULT.has(key)) return RATINGS_VAULT.get(key);
  return {
    o: p.o ?? 50,
    d: p.d ?? 50,
    r: p.r ?? 50,
    c: p.c ?? 50,
    v: p.v ?? 50,
  };
}

export function getPositionPenalty(player, slot) {
  if (!slot || slot.scratch || slot.group === 'ANY') return 0;
  if (player.p === 'G') return slot.group === 'G' ? 0 : 999;

  if (player.p === 'D' || player.p === 'LD' || player.p === 'RD') {
    if (slot.group !== 'D' && slot.group !== 'LD' && slot.group !== 'RD') return 999;
    const np = (player.np === 'RD' || player.np === 'R' || player.p === 'RD') ? 'RD' : 'LD';
    const role = slot.role; // 'DG' (LD) or 'DD' (RD)
    const targetSide = role === 'DG' ? 'LD' : 'RD';
    // « Joue partout » (S78, l'atelier) : les deux côtés.
    if (np === targetSide || player._partout) return 0;
    return 2; // Off-side D (-2)
  }
  if (slot.group !== 'F') return 999;

  const np = player.np || 'C';
  const role = slot.role; // 'AG', 'C', 'AD'

  const isPrimaryMatch = (role === 'C' && np === 'C') ||
    (role === 'AG' && (np === 'L' || np === 'AG')) ||
    (role === 'AD' && (np === 'R' || np === 'AD'));

  // « Joue partout » (S78, l'atelier) : centre et ailes.
  if (isPrimaryMatch || player._partout) return 0;

  if (np === 'C') {
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

  // Les cotes ne servent plus qu'à la ZONE d'efficacité — le calibre d'un
  // joueur, c'est-à-dire la ligne où il rend. La chimie, elle, se calcule
  // plus bas sur les vraies statistiques.
  const hidden = ps.map(x => getHiddenRatings(x.player));

  // Zone d'efficacité : chaque joueur a un calibre (1er trio, 2e trio…) et
  // des trios où il rend à 100 %. Tout le monde à sa place -> bonus ;
  // joueur hors de sa zone -> pénalité selon l'écart, ASYMÉTRIQUE.
  const entrees = ps.map((x, i) => ({
    v: hidden[i].v, ideal: unitesIdeales(x.player, hidden[i].v),
    enBas: !!(x.player && x.player._enBas),
  }));
  const { pen, mal } = malusZoneUnite(group, unit, entrees);
  let zone = null;
  if (mal === 0) {
    zone = { off: 2, def: 2, etat: 'optimal', tag: group === 'F' ? '✨ Trio optimal' : '✨ Paire optimale' };
  } else {
    /*
     * UN CRAN PASSE, DEUX NE PASSENT PLUS, et le MOT doit dire lequel des
     * deux : sans ça le joueur lit la même étiquette pour un ailier descendu
     * d'une ligne (qui ne coûte presque rien) et pour une vedette parquée au
     * quatrième trio (qui coûte le tiers de la production de l'unité).
     *
     * `etat` est là pour que l'écran n'ait pas à reconnaître un émoji : le
     * tableau de bord comptait `zone.startsWith('⚠️')`, donc une étiquette
     * de plus lui aurait fait rater EXACTEMENT les pires unités, en silence.
     */
    const dur = pen >= ZONE_DUR;
    zone = {
      off: -pen, def: -pen, etat: dur ? 'hors' : 'mal',
      tag: dur
        ? (group === 'F' ? '🚨 Trio hors de ses lignes' : '🚨 Paire hors de ses lignes')
        : (group === 'F' ? '⚠️ Trio mal assorti' : '⚠️ Paire mal assortie'),
    };
  }

  const withZone = (bonusOff, bonusDef, name, desc) => ({
    bonusOff: bonusOff + (zone ? zone.off : 0),
    bonusDef: bonusDef + (zone ? zone.def : 0),
    name: zone ? `${name} · ${zone.tag}` : name,
    desc,
    zone: zone ? zone.tag : null,
    zoneEtat: zone ? zone.etat : null,
    chem: name,
  });

  /*
   * UNE SEULE CHAÎNE POUR UN TRIO (S72). JP : *les bonus et malus de trios
   * devraient être avec les stratégies, tout devrait être ensemble, pas
   * plusieurs systèmes différents*. Trois « chimies » jugeaient la même
   * unité : l'équilibre marqueur/passeur (`chimieTrio`, « Trio complet »,
   * +1,8 d'attaque en moyenne mais jusqu'à +11,9 pour un seul trio), la
   * continuité (`together`, presque toujours à zéro : les blessures cassent
   * les lignes) et la chimie des lignes de S68. Il n'en reste qu'une : le FIT
   * de la tactique plafonne la CHIMIE de la ligne, et la chimie fait le bonus
   * (`CHIMIE_BONUS`, dans `profilMatch` et `teamStrength`) et les actions
   * spéciales. Ici ne reste que la ZONE — le joueur à sa place ou non —, qui
   * est un placement, pas un assortiment.
   */
  return withZone(0, 0, group === 'F' ? 'Trio' : 'Paire', '');
}

/* La chimie de rôles (S1–S71) est partie en S72 : l'assortiment d'un trio passe par le fit de sa tactique. */

/*
 * S'ADAPTER À SA POSITION (S73). JP : *les joueurs s'adaptent à leur position
 * dans l'alignement*. La pénalité d'un ailier sur sa mauvaise aile ou d'un
 * centre à l'aile fond avec les matchs joués à cette case (`p._adapt`) : les
 * deux tiers en ADAPT_MATCHS matchs. Elle ne revient pas s'il change de case.
 */
export const ADAPT_MATCHS = 15;
export function penaliteAdaptee(player, slot) {
  const base = getPositionPenalty(player, slot);
  if (!base) return 0;
  const g = (player && player._adapt && player._adapt[slot.role]) || 0;
  // Une carte « Polyvalent » (S78, js/rarete.js) fond une part de la pénalité d'entrée de jeu.
  return base * Math.exp(-g / ADAPT_MATCHS) * effetCarte(player, 'horsPosition');
}
/*
 * LA PÉNALITÉ QUE L'ÉCRAN AFFICHE (1.0, J1-J) : celle que le moteur joue
 * AUJOURD'HUI, arrondie au dixième — pas la pénalité de base, qui restait
 * « −3 » au jour 40 d'un centre à l'aile qui jouait à −0,2. `matchs` dit
 * depuis combien de matchs il s'adapte à cette case ; 999 reste la
 * sentinelle d'`autoRoster` (une case interdite).
 */
export function penaliteAffichee(player, slot) {
  const base = getPositionPenalty(player, slot);
  if (!base) return { pen: 0, base: 0, matchs: 0 };
  if (base >= 999) return { pen: 999, base, matchs: 0 };
  const matchs = (player && player._adapt && player._adapt[slot.role]) || 0;
  return { pen: Math.round(penaliteAdaptee(player, slot) * 10) / 10, base, matchs };
}
/* Le mot de la pénalité : « −3 », ou « −1,2 · s'adapte (9 m.) » une fois l'adaptation commencée. */
export const motPenalite = a => (a.pen <= 0 ? '' : a.matchs > 0 ? `−${String(a.pen).replace('.', ',')} · s'adapte (${a.matchs} m.)` : `−${a.base}`);
const effStat = (player, slot, key) => {
  const r = getHiddenRatings(player);
  return Math.max(25, r[key] - penaliteAdaptee(player, slot));
};

/* ======================================================================
   Le hasard du moteur
   ======================================================================
   TOUT le hasard de la simulation passe par `hasard()`, jamais par
   `Math.random` directement : c'est ce qui rend une saison REJOUABLE. Une
   graine (`grainerHasard`) remplace le générateur par un sfc32 déterministe,
   donc la même graine, les mêmes équipes et le même ordre d'appels redonnent
   les 1312 mêmes matchs — une reprise et un test reproductible en dépendent.
   Une ligue du jeu y ajoute les dés de chaque journée (`deDuJour`) : tirés à
   son matin, gardés par la sauvegarde, ils rejouent le passé sans écrire
   l'avenir. `simulateLeague` tire une graine s'il n'en
   reçoit pas et la rend, pour qu'aucune saison ne soit perdue.
   ====================================================================== */

let hasard = Math.random;

/** Hache un texte ou un nombre en 32 bits (cyrb53 tronqué, suffit ici). */
function graineDe(x) {
  const str = String(x);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Un générateur sfc32 sur une graine 32 bits, uniforme dans [0, 1). */
export function generateur(graine) {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = graineDe(graine) | 0;
  const suivant = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) suivant();   // on jette l'échauffement
  return suivant;
}

/** Remplace le hasard du moteur par un générateur graine (ou le rend au vrai hasard). */
export function grainerHasard(graine = null) {
  hasard = graine === null || graine === undefined ? Math.random : generateur(graine);
  return hasard;
}

/*
 * UN HASARD À PART (S78, js/pronostic.js). Le temps de `fn`, le moteur tire
 * d'un générateur neuf ; puis il retrouve LE MÊME générateur qu'avant, à
 * l'état exact où il l'avait laissé — on ne l'a pas appelé une seule fois.
 * La saison déjà jouée et les séries, qui continuent sa suite, ne voient
 * rien passer : c'est ce qui permet de simuler un pronostic sans rien bouger.
 */
export function avecHasardIsole(graine, fn) {
  const avant = hasard;
  hasard = generateur(graine);
  try { return fn(); } finally { hasard = avant; }
}

/** Une graine lisible, tirée du vrai hasard : c'est ce que la saison porte. */
export const nouvelleGraine = () => Math.floor(Math.random() * 0xffffffff).toString(36);

// POIDS_TRIO et POIDS_PAIRE (temps de glace des unités) vivent dans
// js/ratings.js : l'étage 2 des cotes s'en sert pour le contexte de création.

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= hasard(); } while (p > L);
  return k - 1;
}

/* ======================================================================
 *  LE MOTEUR PAR ÉVÉNEMENTS — la primitive est le LANCER
 *
 *  Spécification et mesures : MOTEUR.md. En deux phrases : le rythme du
 *  hockey n'a pas bougé en 55 ans (27 à 31 lancers par équipe par match,
 *  17 % d'amplitude) pendant que les buts variaient de 55 %. Donc si on
 *  tire des LANCERS plutôt que des buts, l'époque se normalise avec deux
 *  nombres mesurés par saison au lieu d'un facteur bricolé sur le pointage.
 *
 *  Un match se joue lancer par lancer. Chaque lancer a un tireur, un
 *  gardien, et deux issues. Les trois égalités de la feuille de match se
 *  ferment donc PAR CONSTRUCTION, jamais par un ajustement après coup :
 *
 *    buts de l'équipe   = somme des buts de ses joueurs
 *    lancers            = arrêts du gardien adverse + buts
 *    passes             <= 2 par but
 *
 *  `scripts/check_feuilles.mjs` les vérifie sur chaque match d'une saison.
 * ====================================================================== */

/*
 * Lancers par équipe par match. Mesuré à 27-31 sur 55 saisons, et stable :
 * c'est une vraie constante, pas un curseur d'époque.
 *
 * La valeur portée ici est légèrement au-dessus de la moyenne mesurée parce
 * qu'elle est l'ENTRÉE du moteur, pas sa sortie : elle est réglée pour que
 * `node scripts/check_feuilles.mjs` retombe sur 28,5 lancers par équipe par
 * match une fois toutes les pondérations passées.
 */
export const LANCERS_BASE = 28.7;

/** Part des lancers d'une équipe prise par les défenseurs. */
const PART_LANCERS_D = 0.25;

/*
 * La suppression de lancers. `scripts/check_suppression.mjs`, sur 1392
 * équipes-saisons : l'alignement n'explique PAS le volume de lancers
 * concédés — la cote défensive y corrèle à −0,17, et le modèle complet ne
 * reproduit que 8 % d'écart entre la meilleure et la pire défensive là où
 * le réel en montre 56 %. Ce qui reste tient à la possession seule.
 *
 * Le reste de l'écart existe, mais il appartient au système et à
 * l'entraîneur, pas aux joueurs signés. On ne le vend donc pas au joueur
 * comme quelque chose qui s'achète.
 */
const ALPHA_POSSESSION = 0.150;

/*
 * LA POSSESSION SE PARTAGE, ELLE NE S'ADDITIONNE PAS. Deux plafonds, mesurés,
 * qui ferment la brèche que le malus de zone ne peut pas atteindre.
 *
 * Le volume d'une unité était la moyenne des lancers par match de ses
 * joueurs, sans borne : un trio de trois tireurs à 2,6 fois le régulier
 * moyen tirait 2,6 fois plus qu'un trio moyen ET faisait tirer l'équipe
 * d'autant. Or au hockey une ligne n'a qu'une rondelle. Mesuré avec
 * `scripts/check_tireurs.mjs` : le meilleur alignement légal choisi sur ce
 * que le moteur lit (lancers × finition) plutôt que sur la valeur faisait
 * 70,8 victoires en solo, 40 lancers et 5,7 buts par match, et gagnait la
 * Coupe trois fois sur trois — au-dessus de tout ce que le jeu documente.
 * Le malus de zone écrasait bien ses trios 2 à 4 au quart, mais son
 * premier trio, trois étoiles à leur place, prenait 52 % des lancers de
 * l'équipe au lieu de 34 % et suffisait à lui seul.
 *
 * VOLUME_UNITE_MAX borne le volume d'une unité au 99e centile des vrais
 * premiers trios (mesuré 2,07 sur 479 équipes-saisons alignées, médiane
 * 1,51) : il ne touche que 1 % des vraies équipes. PRESSION_MAX borne la
 * pression d'équipe au maximum réel, environ 38 lancers par match, soit
 * 1,35 fois la référence.
 *
 * Effet mesuré : l'empilement de tireurs retombe à 63-64 victoires en solo,
 * exactement le niveau de l'empilement par valeur (63,3) et du Canadien de
 * 1976-77 (61,3). Les déciles des vraies équipes ne bougent pas (26,6 /
 * 42,0 / 51,3 contre 26,1 / 41,9 / 51,6), ni les repères de la ligue
 * (27,2 lancers et 2,95 buts par match). Un plafond plus serré, 1,6, fermait
 * davantage mais touchait 37 % des vrais premiers trios et coûtait trois
 * victoires au Canadien : trop.
 *
 * Le malus de zone n'est pas touché. Les deux mécanismes se complètent : le
 * malus punit le talent mal placé, ces plafonds empêchent le talent bien
 * placé de compenser à lui seul.
 */
const VOLUME_UNITE_MAX = 2.0;
const PRESSION_MAX = 1.35;

/*
 * LA FINITION D'UNE ÉQUIPE A UN PLAFOND, ELLE AUSSI. Les deux bornes
 * ci-dessus ferment le volume ; celle-ci ferme la qualité. Mesuré sur 708
 * vraies équipes-saisons alignées : la finition de l'équipe (le % de tir de
 * ses patineurs habillés, pondéré par leurs lancers, relatif à la ligue) va
 * de 0,99 en médiane à 1,21 au 99e centile et 1,28 au maximum. Un
 * alignement PARFAITEMENT monté — chaque joueur dans sa zone, chaque trio
 * avec un passeur et deux tireurs, chaque paire équilibrée — arrive à 1,35
 * en cueillant les meilleurs finisseurs de 55 saisons, et sans borne il
 * faisait 74 victoires, 469 buts et la Coupe trois fois sur trois même avec
 * les bornes de volume (78 victoires et 628 buts avant elles).
 *
 * FINITION_MAX = 1,20, le 99e centile : au-dessus, la finition de tous les
 * tireurs est ramenée d'autant, et la chimie continue de s'appliquer
 * par-dessus — c'est elle qu'on veut récompenser, pas l'addition de douze
 * pourcentages de tir que l'histoire n'a jamais vue ensemble.
 *
 * Effet mesuré (`scripts/check_tireurs.mjs`) : l'alignement parfait retombe
 * à 68-70 victoires, un peu au-dessus du Canadien de 1976-77 (61-63) — c'est
 * le plafond voulu : parfaitement monté, on bat la meilleure équipe de
 * l'histoire de quelques matchs, et la Coupe reste un pari. L'empilement
 * par valeur reste à 59-61 et l'empilement de tireurs sans zones tombe à 52.
 * Les vraies équipes ne bougent pas.
 */
const FINITION_MAX = 1.20;

/*
 * LE TEMPS DE GLACE NE SE COMPTE QU'UNE FOIS.
 *
 * Le poids offensif d'une unité valait `POIDS_TRIO[u] × volume`, où `volume`
 * est la moyenne des lancers PAR MATCH de ses joueurs, relative au régulier
 * moyen de leur saison. Or les lancers par match d'un joueur contiennent
 * DÉJÀ son temps de glace : un ailier de premier trio tire quatre fois par
 * match en partie parce qu'il joue vingt minutes. Multiplier sa part de
 * présence par ce nombre-là comptait donc le temps de glace deux fois, et
 * le premier trio ramassait tout.
 *
 * Mesuré sur les vraies équipes témoins (`_sonde_parts`) — part des lancers
 * du premier trio sur ceux du quatrième :
 *
 *   MTL 76-77   réel 2,6×   moteur 5,6×
 *   BOS 70-71   réel 2,6×   moteur 3,7×
 *   NYI 92-93   réel 2,1×   moteur 3,1×
 *   DET 76-77   réel 2,4×   moteur 3,3×
 *
 * Ce que ça donnait sur la feuille : Jacques Lemaire 1976-77 à 141 points
 * simulés pour 77 réels (et 97 passes pour 42), pendant que Bob Gainey
 * tombait à 8 points pour 34. JP, devant la fiche d'Alexander Semin
 * 2009-10 — 84 points réels, 156 simulés : *grosse déviation versus stats
 * originales, ça devrait pas s'éloigner autant*.
 *
 * Le volume est donc TEMPÉRÉ par cet exposant, puis les poids sont
 * RENORMALISÉS par groupe pour que leur somme — la pression d'équipe, donc
 * le nombre de lancers du club — ne bouge pas d'un centième. Le chantier ne
 * redistribue que la production entre les unités : c'est exactement la
 * chose que la mesure accuse, et rien d'autre.
 */
export const VOLUME_EXPOSANT = Number(ENV_MESURE.VOLUME_EXPOSANT ?? 0.30);

/*
 * LE VOLUME SE COMPARE À CELUI D'UNE UNITÉ DE SON RANG, jamais dans l'absolu
 * (S62).
 *
 * L'exposant ci-dessus tempérait le volume tel quel, or le volume d'un premier
 * trio est deux fois celui d'un quatrième PAR NATURE : à 0,30, le premier trio
 * touchait donc 2^0,30 = 1,23 fois sa part, sur toutes les équipes et pour
 * toujours. Ce n'était pas un signal, c'était un biais.
 *
 * `VOLUME_RANG` est le volume moyen d'une unité de ce rang, mesuré sur les
 * 1392 vraies équipes alignées par `autoRoster`, comme `profilMatch` le
 * calcule. Le volume s'y rapporte, si bien qu'une équipe ordinaire retombe
 * exactement sur `PART_UNITE` et que seul l'ÉCART à la normale de son rang
 * compte encore. Mesuré sur 300 vraies équipes : la pente et la corrélation
 * entre la part du moteur et la part réelle, d'une équipe à l'autre, ne
 * bougent pas d'un centième (0,24 et 0,66 avant comme après) — c'est le même
 * signal sans le biais.
 */
const VOLUME_RANG = {
  F: [1.57, 1.22, 0.99, 0.80],
  D: [1.43, 1.06, 0.86],
};
/* Molette de mesure : 0 éteint le centrage sur le rang, pour la comparaison. */
const VOLUME_CENTRE = Number(ENV_MESURE.VOLUME_CENTRE ?? 1);

/*
 * LA PART OFFENSIVE D'UNE UNITÉ, RÉGLÉE SUR LA SORTIE (S62).
 *
 * `POIDS_TRIO` est le temps de glace, et il le reste : c'est lui qui décide de
 * la PRÉSENCE — qui défend, qui reçoit le +/-, le contexte de création des
 * cotes. Mais la part des LANCERS DE FORCES ÉGALES ne peut pas être le temps
 * de glace, parce que l'avantage numérique s'ajoute PAR-DESSUS et ne suit pas
 * les trios : il fait six lancers par équipe par match (21 % du total) et
 * 56 % vont au premier trio, qui prenait donc 37,9 % des lancers d'une saison
 * simulée contre 33,7 % réels, pendant que le quatrième tombait à 13,4 %
 * contre 17,5 %. C'est ce qui faisait 132 points à Blake Wheeler pour 74
 * réels (JP : *yé pas rare qu'un joueur de 83 points en fasse genre 140*).
 *
 * Ces parts sont donc réglées sur la SORTIE, comme `LANCERS_BASE` et
 * `CIBLE_PCT_TIR` : quatre itérations (multiplier chaque rang par le rapport
 * réel/simulé, renormaliser) jusqu'à ce que la part TOTALE de lancers par rang
 * — toutes situations, comptée sur les feuilles de match — retombe sur celle
 * des mêmes joueurs dans leur vraie saison. Le premier trio y perd quatre
 * points de forces égales et les retrouve en avantage. Le juge est
 * `scripts/check_parts.mjs`, et leur somme vaut 1 pour que la pression
 * d'équipe ne bouge pas.
 */
export const PART_UNITE = {
  F: lireListe('PART_F', [0.300, 0.260, 0.235, 0.205]),
  D: lireListe('PART_D', [0.390, 0.315, 0.295]),
};

/* =====================================================================
   LES CARTES DE SAISON — un bonus payé par un malus

   JP : *plus de moment roguelike dans la saison [...] bonus et malus à
   choisir*. À trois paliers de la saison, on prend une carte parmi trois.
   Chacune achète quelque chose et le PAIE : il n'y en a pas de gratuite, et
   c'est ce qui en fait un choix plutôt qu'un cadeau.

   ELLES NE CRÉENT AUCUNE MÉCANIQUE NEUVE. Chaque carte n'est qu'un facteur
   sur une quantité que le profil de match porte DÉJÀ — le volume de lancers
   (`pression`), la finition d'équipe (`finitionFacteur`), la défensive
   (`traitDef`, le même canal que le Selke), la robustesse (`traitRob`, le
   canal des soirs éreintants et des séries) et le risque de blessure. Rien
   à recalibrer : ce sont les curseurs du moteur, bougés de quelques pour
   cent.

   ET ELLES SE REJOUENT. Une carte est une DÉCISION (`{ jour, carte }`),
   donc elle vit dans la sauvegarde avec les autres et la saison se rejoue
   de la graine avec elle — comme un changement de trio derrière le banc.
   `check_graine.mjs` l'exige.

   Les magnitudes sont petites EXPRÈS. Trois cartes par saison à ±6 % sur un
   seul canal laissent le plafond du jeu où il est ; le plaisir est dans le
   choix, pas dans l'empilement.
   ===================================================================== */
/*
 * LES MAGNITUDES SONT RÉGLÉES SUR LA MESURE, jamais sur l'intuition — et la
 * première lecture en a corrigé deux d'un coup.
 *
 * COMMENT ON MESURE. Une saison à 82 matchs a un écart type de 4,5 victoires
 * autour de son espérance, et une équipe tirée au hasard dans 55 saisons en
 * a bien plus : comparer deux ligues indépendantes demanderait des centaines
 * d'essais pour lire UNE victoire. On joue donc la même ligue deux fois sous
 * la MÊME graine, la carte aux équipes de rang pair au premier passage et
 * aux impaires au second : chaque équipe est mesurée avec et sans, contre le
 * même champ, et la force de l'équipe — la plus grosse source de variance —
 * s'annule. Douze ligues font 384 paires, soit ±0,3 victoire.
 *
 * LE PRIX DE CHAQUE CANAL, mesuré un canal à la fois (les six cartes en
 * bougent deux ou trois, on ne peut rien en déduire sans résoudre un système
 * à l'aveugle sur du bruit) :
 *
 *   canal              +5 % (ou +1)   −5 % (ou −1)
 *   finition            +0,9 V         −1,3 V
 *   défensive           +1,2 V         −1,6 V
 *   volume              +0,9 V         −1,3 V
 *   robustesse          +0,5 V         −0,8 V
 *   blessures  ×0,5 :   −0,2 V     ×2 : −0,9 V
 *
 * TROIS CHOSES QUE CE TABLEAU DIT, et qu'on ne devinait pas.
 *
 * (1) LE MAUVAIS CÔTÉ COÛTE PLUS QUE LE BON NE RAPPORTE, sur les quatre
 * canaux. C'est le rendement décroissant des plafonds : `FINITION_MAX` et
 * `PRESSION_MAX` mangent une partie du bonus, rien n'amortit le malus. Une
 * carte qui a l'air symétrique ne l'est donc pas, et il faut la peser.
 *
 * (2) LA DÉFENSIVE PÈSE PLUS QUE LA FINITION (0,24 contre 0,18 la victoire
 * par pour cent). Un « cadenas » à −7 % de buts alloués valait +8,3 victoires
 * quand un « bloc » à +6 % de finition en valait ZÉRO.
 *
 * (3) LES BLESSURES SONT UN CANAL À SENS UNIQUE : deux fois moins de
 * blessures ne rapporte RIEN de mesurable (−0,2 ± 0,3), deux fois plus coûte
 * 0,9 victoire. Un alignement de 23 avec ses réservistes encaisse sa charge
 * ordinaire sans broncher ; c'est en la doublant qu'on manque de monde.
 * « L'infirmerie » n'est donc pas une carte qui fait gagner : c'est une
 * ASSURANCE, elle coupe la saison où ton premier centre rate vingt matchs.
 * Elle se paie en conséquence — presque rien.
 *
 * CE QU'UNE CARTE DOIT FAIRE : changer la FORME de ton match, pas sa force.
 * Ce qui bouge, ce sont les tirs, les buts marqués et alloués, les punitions,
 * l'infirmerie, et ce qui reste en séries. Les six premières forment TROIS
 * PAIRES OPPOSÉES — finition contre défensive, volume contre blessures,
 * volume contre robustesse — pour qu'aucune n'en double une autre.
 *
 * LES AMPLITUDES D'AUJOURD'HUI (1.0, étape 3 de docs/impact-des-choix.md) sont
 * celles qui se VOIENT. Les anciennes (3 à 5 % du match) gardaient chaque carte
 * sous une victoire et la rendaient invisible dans la feuille : JP, *plus fort,
 * ça veut pas dire plus gagner ; ça doit être clair que le build a un impact
 * pour vrai*. Chaque carte a gardé son prix — le bonus et le malus ont monté
 * ensemble, d'un facteur d'environ 1,5 à 2 — et le net en victoires reste celui
 * du style, pas de la force : `check_cartes.mjs` le borne par la RARETÉ (commune
 * ±1, peu commune ±1,5, rare ±2,5, légendaire ±4, un maximum et jamais une
 * cible), exige qu'une rare se voie dans la feuille (±2 tirs, ±0,3 but des deux
 * clubs, ±0,5 punition, ±3 blessures) et ne laisse pas plus de 0,5 V par seuil
 * franchi. Les chiffres du tableau plus bas sont ceux d'avant : le tableau
 * d'aujourd'hui est la sortie du script.
 *
 * MESURÉ AU RÉGLAGE RETENU (`node scripts/check_cartes.mjs`, 12 ligues) :
 *
 *   carte                ΔV     ΔBP    ΔBC   Δblessures
 *   Bloc de départ      +0,2    +14    +14     −0,3      l'attaque qui saigne
 *   Le cadenas          −0,6    −13     −9     −0,0      le contraire
 *   Roulement court     +0,4     +3     −1     +3,9      du volume payé cher
 *   L'infirmerie        −0,2     −2     +1     −2,2      l'assurance
 *   Les vétérans        +0,4     −1     −4     +0,1      plus les séries
 *   La jeunesse         −0,3     +1     +4     −0,0      moins les séries
 *
 * ET LA VRAIE INCERTITUDE EST PLUS GRANDE QUE L'ÉCART TYPE INTERNE. Celui-ci
 * dit ±0,2 sur 384 paires, mais deux lectures indépendantes de la même carte
 * — douze ligues sous une graine, dix-huit sous une autre — ont donné −0,6 et
 * +0,5 pour « Le cadenas ». Les paires d'une même ligue ne sont pas
 * indépendantes (les victoires d'une ligue sont à somme fixe), donc l'écart
 * type interne ment vers le bas. Compte une DEMI-VICTOIRE d'incertitude par
 * lecture, et c'est exactement pourquoi la borne de `check_cartes.mjs` est à
 * ±1 : elle attrape une carte devenue un cadeau ou un piège, pas un écart de
 * deux dixièmes. Ne retouche jamais une carte sur une seule lecture.
 *
 * UN DIFFÉRENTIEL ÉGAL NE VAUT PAS LE MÊME NOMBRE DE VICTOIRES, et c'est du
 * vrai hockey : le « bloc » et le « cadenas » bougent leurs deux colonnes de
 * la même quantité, en sens inverse, et ne rendent pas la même chose.
 * Pythagore en est la raison — à différentiel égal, une équipe qui joue des
 * 2-1 gagne un plus gros pourcentage qu'une qui joue des 6-5. C'est une
 * propriété exacte du hockey à faible pointage, pas un défaut à corriger.
 */
export const CARTES = {
  // finition contre défensive. 8 % de finition (+1,44) payés par 4,5 % de
  // buts alloués (−1,44).
  bloc: {
    nom: 'Bloc de départ', ico: '🚀',
    bon: 'Ton attaque finit mieux', prix: 'Tu encaisses davantage',
    finition: 1.12, defense: 1.10,
  },
  // l'inverse : 6 % de buts alloués (+1,44) payés par 5,5 % de finition.
  cadenas: {
    nom: 'Le cadenas', ico: '🔒',
    bon: 'Tu alloues moins de buts', prix: 'Ton attaque finit moins bien',
    defense: 0.915, finition: 0.90,
  },
  // volume contre blessures : 5 % de lancers (+0,90) payés par des blessures
  // DOUBLÉES (−0,90). Il fallait les doubler : à ×1,45 la carte était gratuite.
  roulement: {
    nom: 'Roulement court', ico: '🔁',
    bon: 'Tes meilleurs jouent plus : plus de lancers', prix: 'Ils se blessent bien plus souvent',
    volume: 1.10, blessure: 2.60,
  },
  // l'assurance. Le bonus ne vaut rien en victoires et tout en tranquillité ;
  // le prix est donc d'un pour cent de lancers, et pas davantage.
  infirmerie: {
    nom: "L'infirmerie", ico: '🏥',
    bon: 'Plus de trois fois moins de blessures : ta saison ne déraille pas', prix: 'Moins de lancers',
    blessure: 0.28, volume: 0.985,
  },
  // volume contre robustesse. Ce que les vétérans achètent se paie surtout en
  // AVRIL, et la mesure de saison ne le voit pas : la carte est donc réglée
  // un cheveu sous zéro en saison (+0,50 contre −0,65), et les séries sont le
  // reste.
  veterans: {
    nom: 'Les vétérans', ico: '🧭',
    bon: 'Plus robuste, moins de punitions : les soirs éreintants et les séries', prix: 'Moins de lancers',
    // 1.0, le tempo : la lenteur coûte moins (l'adversaire tire moins aussi) — la robustesse redescend (0,6 → 0,3).
    robustesse: 0.3, discipline: 0.80, volume: 0.92,
  },
  // l'inverse, et le même déséquilibre à l'envers : un départ canon payé en
  // avril (+0,90 contre −0,80, plus ce que les séries prendront).
  jeunesse: {
    nom: 'La jeunesse', ico: '⚡',
    bon: 'Des jambes fraîches : plus de lancers, et on s\'use moins', prix: 'Moins robuste quand ça brasse',
    // 1.0, le tempo : la vitesse rapporte moins (l'adversaire tire plus aussi) — le prix en robustesse baisse (−1,5 → −0,9).
    volume: 1.10, robustesse: -0.9, energie: 0.85,
  },
  /*
   * QUATRE CARTES DE PLUS (S62), et la variété était la raison : JP voulait
   * l'aspect roguelike *plus varié*. À six cartes, trois paliers et parfois
   * une case vide, on revoyait toujours les mêmes ; à dix, une partie ne
   * montre plus la moitié du paquet. Chacune reste un bonus payé par un
   * malus, sur les canaux qui existent déjà — dont L'INDISCIPLINE, qui est
   * arrivée avec le plan de match et qui ouvre une famille neuve : une carte
   * qui joue sur l'arbitre plutôt que sur le tir.
   */
  sangfroid: {
    nom: 'Le sang-froid', ico: '🧊',
    bon: 'Tu prends moins de punitions', prix: 'Moins de lancers',
    discipline: 0.75, volume: 0.93,
  },
  vague: {
    nom: 'La vague', ico: '🌊',
    bon: "L'attaque s'emballe : ça rentre plus souvent", prix: 'Le rythme se paie à l\'infirmerie',
    finition: 1.06, volume: 1.01, blessure: 2.60,
  },
  grandjeu: {
    nom: 'Le grand jeu', ico: '🎲',
    bon: 'Des matchs fous : tu marques beaucoup', prix: 'Et tu encaisses beaucoup',
    finition: 1.13, defense: 1.13,
  },
  chasse: {
    nom: 'La chasse', ico: '🏒',
    bon: 'Tu lances de partout', prix: 'De moins bonnes occasions',
    volume: 1.11, finition: 0.915,
  },
  /*
   * HUIT DE PLUS (S74b). À dix, la main du palier (un effet parmi trois
   * sortes) et les objectifs revoyaient vite les mêmes. Même contrat — un
   * bonus payé par un malus, sur des canaux qui existent, réglés près de zéro
   * avec les poids mesurés ici (1 % de finition ou de lancers ≈ 0,18 victoire,
   * 1 % de buts alloués ≈ 0,32) — et même juge : `check_cartes.mjs`.
   */
  newjersey: {
    nom: 'Le système du New Jersey', ico: '🧱',
    bon: 'Presque rien ne passe', prix: 'Tu lances beaucoup moins',
    // S80 : 0,955 et 0,92 se mesuraient à −0,8 victoire (−1,03 sur 12 ligues, hors de ±1) : recentrée.
    defense: 0.92, volume: 0.90,
  },
  ouvert: {
    nom: 'Le jeu ouvert', ico: '🏃',
    bon: 'Tu lances de partout, tout le temps', prix: 'Tu laisses des trous derrière',
    volume: 1.11, defense: 1.07,
  },
  ecole: {
    nom: 'L\'école de tir', ico: '🎯',
    bon: 'Chaque lancer est meilleur', prix: 'Tu en prends moins',
    finition: 1.10, volume: 0.89,
  },
  durs: {
    nom: 'Les durs à cuire', ico: '🦍',
    bon: 'Plus robuste : les soirs éreintants et les séries', prix: 'Des mains moins fines, et des punitions',
    robustesse: 1.8, discipline: 1.25, finition: 0.96,
  },
  physio: {
    nom: 'Le préparateur physique', ico: '🏋️',
    bon: 'Moins de blessures', prix: 'Des pratiques moins intenses : moins de lancers',
    blessure: 0.35, volume: 0.955,
  },
  gardiens: {
    nom: 'L\'entraîneur des gardiens', ico: '🥅',
    bon: 'Tu alloues moins de buts', prix: 'Tout le monde recule : moins de lancers',
    defense: 0.935, volume: 0.92,
  },
  montent: {
    nom: 'Les défenseurs montent', ico: '🚀',
    bon: 'Ton attaque a cinq joueurs', prix: 'Et ta défense en a trois',
    finition: 1.06, volume: 1.03, defense: 1.07,
  },
  fougue: {
    nom: 'La fougue', ico: '🔥',
    bon: 'Ça pousse fort : plus de lancers, et ça rentre', prix: 'Des punitions bêtes',
    finition: 1.05, volume: 1.05, discipline: 1.30,
  },
};

/* =====================================================================
   LE ROULEMENT — une décision qu'on porte toute la saison, et qu'on
   change quand on veut derrière le banc

   JP : *plus d'opportunités pour jouer avec les lignes, joueurs,
   stratégie*. Le ROULEMENT touche la seule quantité que rien d'autre ne
   touchait : LA PART DE GLACE DE CHAQUE UNITÉ. C'est ce qui fait du
   quatrième trio une décision au lieu d'un remplissage. (Le plan de match
   qui l'accompagnait a quitté le moteur en S68 : les systèmes de chaque
   ligne l'ont remplacé ; V2.1 en a retiré le vestige.)

   ET IL SE REJOUE. C'est une décision (`{ jour, roulement }`) qui vit dans
   la sauvegarde avec le reste, et la saison se rejoue de la graine avec
   elle — `check_graine.mjs` l'exige. La décision 0 la porte aussi, sinon
   un roulement choisi au jour 40 vaudrait pour les 40 journées d'avant à
   la reprise.
   ===================================================================== */
/*
 * LE ROULEMENT : où passent les minutes.
 *
 * `parts` multiplie la part de glace de chaque unité, ensuite RENORMALISÉE
 * pour que la somme — donc la pression de l'équipe — ne bouge pas d'un
 * centième : raccourcir le banc ne fait pas tirer l'équipe davantage, ça
 * déplace qui tire. Le prix est la robustesse et les blessures, parce que
 * c'est ce qu'un banc court coûte vraiment : ça tient jusqu'en février.
 */
export const ROULEMENTS = {
  quatre: {
    nom: 'Quatre trios', ico: '🔄',
    bon: 'Tout le monde joue : la saison tient', prix: 'Tes meilleurs jouent moins',
    F: [1, 1, 1, 1], D: [1, 1, 1],
  },
  trois: {
    nom: 'Trois trios', ico: '⏫',
    bon: 'Tes meilleurs jouent plus', prix: 'Moins robuste, et plus de blessures',
    F: [1.12, 1.08, 1.03, 0.62], D: [1.10, 1.04, 0.78],
    robustesse: -0.9, blessure: 1.30,
  },
  profond: {
    nom: 'Banc profond', ico: '🔋',
    bon: 'Des jambes fraîches, et moins de blessures', prix: 'Tes meilleurs jouent moins',
    F: [0.92, 0.97, 1.05, 1.16], D: [0.94, 1.00, 1.11],
    robustesse: 0.9, blessure: 0.82,
  },
};

/** Le roulement d'une équipe, avec sa valeur par défaut. */
export const roulementDe = t => ROULEMENTS[(t && t.roulement) || 'quatre'] ? ((t && t.roulement) || 'quatre') : 'quatre';

/*
 * LES COACHS D'UNE ÉQUIPE, PORTÉS PAR SES JOUEURS (v2, js/coachs.js) : la
 * couleur d'un joueur est le coach de son meilleur rôle maîtrisé
 * (`coachDuJoueur`) ; chaque confiance joue plus fort par joueur de sa couleur
 * habillé ce soir. Un seul endroit la calcule : les effets de la saison, les
 * minutes et l'usure lisent tous `coachsJoues`.
 */
export const coachDuJoueur = p => (!p || p.p === 'G' ? null : coachDesRoles(profilsDe(p), estD(p) ? 'D' : 'F'));
export function joueursDesCoachs(team) {
  const n = {};
  for (const s of SLOTS) {
    if (s.scratch) continue;
    const p = team && team.roster && team.roster[s.i];
    const c = p && !(team.injured && team.injured.has(p)) ? coachDuJoueur(p) : null;
    if (c) n[c] = (n[c] || 0) + 1;
  }
  return n;
}
function coachsJoues(team) {
  const cs = (team && team.coachs) || [];
  if (!cs.length) return cs;
  const n = joueursDesCoachs(team);
  return cs.map(c => porteParSesJoueurs(c, n[c.cle]));
}

/**
 * Ce que la SAISON d'une équipe multiplie : ses cartes, son plan de match et
 * son roulement, sur les mêmes canaux. Un seul endroit les additionne, donc
 * un canal ne peut pas être oublié d'un côté.
 */
export function effetsDeSaison(team, adv = null, lineup = null) {
  const e = { finition: 1, defense: 1, volume: 1, blessure: 1, robustesse: 0, discipline: 1 };
  // Les MOMENTS et la CONSIGNE DU MATCH (S66, S68) vivent dans `team.effets`,
  // lus au jour courant (`team.jourCourant`). Le plan de match, lui, se joue
  // LIGNE PAR LIGNE depuis S68 (`lignesDe`, `profilMatch`).
  void adv; void lineup;
  const actifs = effetsActifs(team);
  // LES PATRONS (S79, js/banque.js) : le personnel engagé, comme une carte de saison — en séries aussi.
  // LES COACHS (v2, js/coachs.js) : la confiance du vestiaire, lue comme un patron.
  const sources = [...((team && team.cartes) || []).map(c => CARTES[c]), ...((team && team.patrons) || []), ...coachsJoues(team),
    ROULEMENTS[roulementDe(team)], ...actifs];
  for (const c of sources) {
    if (!c) continue;
    e.finition *= c.finition ?? 1;
    e.defense *= c.defense ?? 1;
    e.volume *= c.volume ?? 1;
    e.blessure *= c.blessure ?? 1;
    e.discipline *= c.discipline ?? 1;
    e.robustesse += c.robustesse ?? 0;
  }
  return e;
}

/**
 * Les parts de glace d'une équipe, roulement appliqué et RENORMALISÉES.
 * `base` est PART_UNITE (la part offensive) ou POIDS_TRIO/POIDS_PAIRE (la
 * présence) : les deux suivent le même roulement, sinon le quatrième trio
 * tirerait moins tout en défendant autant.
 */
/*
 * LA GLACE À FORCES ÉGALES D'UN SOIR (V2.2, les bons chiffres) : la part de chaque trio et de chaque paire telle
 * que le moteur la joue (`PART_UNITE`, le roulement, les moments, les patrons, les coachs, les secondes de chaque
 * ligne), avec les décisions du soir posées. « Préparer le match » la multiplie par les minutes à forces égales.
 */
export function glaceDesLignes(team, aVenir = []) {
  return avecAVenir(team, aVenir, () => ({ F: partsDuRoulement(PART_UNITE.F, 'F', team), D: partsDuRoulement(PART_UNITE.D, 'D', team) }));
}
export function partsDuRoulement(base, group, team) {
  const r = ROULEMENTS[roulementDe(team)];
  const mult = ((r && r[group]) || base.map(() => 1)).slice();
  // Un moment peut aussi déplacer les minutes (doubler le trio en feu,
  // brasser les trios) : ses multiplicateurs s'ajoutent à ceux du roulement,
  // et la renormalisation tient toujours la somme.
  // v2 : un patron ou la confiance d'un coach (le Contremaître, le Showman) déplacent aussi les minutes, toute la saison.
  for (const x of [...effetsActifs(team), ...((team && team.patrons) || []), ...coachsJoues(team)]) if (x[group]) x[group].forEach((m, i) => { mult[i] = (mult[i] ?? 1) * m; });
  // LES SECONDES DE PRÉSENCE DE CHAQUE LIGNE (S68), à la HockeyArena : 60 est
  // la glace que le moteur a mesurée ; 70 donne un sixième de glace de plus.
  const L = team && team.lignes;
  if (L) for (let i = 0; i < mult.length; i++) mult[i] *= borne((L[i] && L[i].sec) || SEC_DEFAUT, SEC_MIN, SEC_MAX) / SEC_DEFAUT;
  const brut = base.map((x, i) => x * (mult[i] ?? 1));
  const s = brut.reduce((a, b) => a + b, 0);
  const s0 = base.reduce((a, b) => a + b, 0);
  return s > 0 ? brut.map(x => x * s0 / s) : base.slice();
}

/* =====================================================================
   LES LIGNES, À LA HOCKEYARENA (S68)

   JP : *les stratégies devraient être liées aux stats et traits des joueurs
   par trio* ; *chaque ligne peut avoir stratégie différente, qui doit fitter
   avec profils, style hockeyarena.net* ; *pouvoir en tout temps changer les
   trios et cie et ça a un impact* ; puis, sur la portée : *je veux pas le
   moteur HA complet, mais que ça feel similaire pour le joueur*.

   Le moteur ne change pas de nature — il joue toujours lancer par lancer
   sur les VRAIES colonnes. Ce qui vient de HockeyArena, c'est le poste de
   gérant, et chaque morceau y a son équivalent documenté (ha-navod.eu) :

     LE PROFIL     chaque joueur a un % d'aptitude à chaque rôle (fabricant
                   de jeu, franc-tireur, puissant, rapide…), tiré de ses
                   vraies stats et de ses traits — jamais d'une cote cachée
     LA LIGNE      un trio et sa paire ; la quatrième ligne n'a que son trio
     LA TACTIQUE   sept, dont « Hourra » (aucun système) ; chacune demande
                   un profil par position, et le FIT en % plafonne la chimie
     LA CHIMIE     monte avec les matchs joués ensemble, perd le quart de
                   sa valeur par joueur changé, redescend si le fit baisse
     L'ACTION SPÉCIALE   à chaque lancer d'une ligne, une chance (selon sa
                   chimie) de jouer SON système : un lancer qui entre plus ;
                   la tactique adverse qui le CONTRE l'étouffe
     L'AGRESSIVITÉ basse → rentre-dedans : plus physique, plus d'énergie
                   brûlée, plus de punitions (selon le sang-froid)
     LA GLACE      les secondes de présence de chaque ligne
     L'ÉNERGIE     par joueur, sur toute la saison : pousser une ligne l'use,
                   et un joueur usé rend moins et se blesse plus

   ET ÇA SE MESURE, comme tout le reste (`check_tactiques.mjs`) : bien
   assortir rapporte, mal assortir coûte, et rien ne décide la saison.
   ===================================================================== */

/* ---------- les rôles (S79) ---------- */
/*
 * LES RÔLES D'UN JOUEUR, COMME UN AMATEUR LES NOMME. JP : *ce qu'on voit sur
 * la page d'alignement et stratégie, genre les positions du joueur, ses
 * icônes, ça doit aider à savoir d'un coup d'oeil ce que les joueurs peuvent
 * faire pour matcher comme des vraies lignes, avec two way, sniper, checker,
 * passeur, power forward, def def, def offensif, manieur de rondelles,
 * énergie, violence*. Les profils de S68 (franc-tireur, fabricant, puissant,
 * rapide, créatif, défensif…) parlaient la langue du moteur ; les rôles
 * parlent celle du hockey, et le moteur les lit à leur place : ce sont eux
 * que les systèmes de jeu demandent (`TACTIQUES`, `SYSTEMES_D`).
 *
 * TOUT VIENT DES VRAIES STATISTIQUES, jamais d'une cote : chaque statistique
 * se lit en ÉCART à la moyenne des réguliers de SA saison et de son groupe
 * (`ROLES_REF`, js/roles_ref.js, écrit par scripts/roles_ref.mjs) — 40 buts
 * en 1981 et 40 buts en 2003 ne pèsent pas pareil. Une statistique qu'une
 * époque ne tenait pas (les mises en échec, les tirs bloqués avant 2005)
 * cède sa part aux autres. Les mesures défensive et de robustesse (`md`,
 * `mr`, des centiles de la saison) et les traits (🎯 Tir, 🪄 Créateur…)
 * complètent. Chaque rôle vaut 0 à 100 ; le premier est le RÔLE du joueur,
 * le second s'affiche s'il vaut 60 et plus.
 */
/* Une icône par chose : un rôle ne porte ni l'icône d'un trait (🪄 Créateur, 🔁 Bidirectionnel, 🛡️ Selke, ⚡ Vitesse, 🥊 Colosse, 🧱 Norris) ni celle d'un système. */
export const PROFILS = {
  F: {
    sniper: { nom: 'Sniper', ico: '🎯', mot: 'ses buts par match, son % de tir, ses lancers' },
    passeur: { nom: 'Passeur', ico: '🅰️', mot: 'ses passes par match, ses points en avantage' },
    deuxsens: { nom: 'Two-way', ico: '☯️', mot: 'sa défensive mesurée ET sa production, son infériorité' },
    // `court` : le nom qui tient dans une case de l'alignement (cent pixels) ; les autres tiennent déjà.
    power: { nom: 'Power forward', court: 'Power', ico: '🦍', mot: 'ses buts, sa robustesse mesurée, son gabarit' },
    checker: { nom: 'Checker', ico: '🔧', mot: 'ses mises en échec (sa robustesse avant 2005), sa défensive, peu de points' },
    // 1.0 (C1) : « Plombier », pas « Énergie » — l'énergie était aussi la fatigue et la mana des cartes. La clé reste.
    energie: { nom: 'Plombier', ico: '🪠', mot: 'ses lancers et ses mises en échec en peu de minutes' },
    bagarreur: { nom: 'Bagarreur', ico: '👊', mot: 'ses minutes de punition, son gabarit, peu de points' },
  },
  D: {
    defensif: { nom: 'Défensif', ico: '🛑', mot: 'sa défensive mesurée, ses tirs bloqués, peu de points' },
    offensif: { nom: 'Offensif', ico: '🚀', mot: 'ses points, ses buts, ses lancers' },
    manieur: { nom: 'Manieur de rondelle', court: 'Manieur', ico: '🏒', mot: 'ses passes, ses minutes, ses points en avantage' },
    physique: { nom: 'Physique', ico: '💪', mot: 'sa robustesse mesurée, ses mises en échec, son gabarit' },
    deuxsens: { nom: 'Two-way', ico: '☯️', mot: 'sa défensive mesurée ET sa production, ses minutes' },
  },
};
/* Les trois colonnes brutes, SANS situation ni trait ni énergie (sonde_aptitudes.mjs). */
function lancersBrut(p) {
  const base = seasonLancers(p.s)[estD(p) ? 3 : 2];
  const perso = (p.sh || 0) / Math.max(1, p.gp || 1);
  return perso && base ? borne(perso / base, 0.25, 2.6) : 1;
}
function tirBrut(p) {
  const ligue = seasonLancers(p.s)[1];
  return (p.sh || 0) >= 20 && ligue ? borne(100 * (p.g || 0) / p.sh / ligue, 0.35, 2.2) : 1;
}
/* Une mesure (`md`, `mr` : un centile de la saison, 0 à 1) en écart réduit. */
const cz = x => (x == null ? 0 : (x - 0.5) / 0.29);
const PROFILS_CACHE = new WeakMap();
/*
 * Les rôles d'un joueur, MUTATIONS comprises (S68) : un changement de carte
 * (le plombier qui apprend à tirer, la vedette forcée à défendre) déplace ses
 * rôles pour le reste de la saison — donc le fit de sa ligne, donc sa chimie.
 */
export function profilsDe(p) {
  const base = profilsBase(p);
  if (!base || !p._mutProfils) return base;
  const out = { ...base };
  for (const [k, d] of Object.entries(p._mutProfils)) if (k in out) out[k] = Math.max(1, Math.min(99, out[k] + d));
  return out;
}
export const rolesDe = profilsDe;
/* L'écart réduit d'une statistique du joueur dans SA saison (null si l'époque ne la tenait pas). */
function zSaison(p, g, cle, valeur) {
  const R = ROLES_REF[p.s] && ROLES_REF[p.s][g] && ROLES_REF[p.s][g][cle];
  if (!R || valeur == null || !Number.isFinite(valeur)) return null;
  return borne((valeur - R[0]) / R[1], -3.5, 3.5);
}
/* Une somme pondérée d'écarts : une statistique absente cède son poids aux autres. */
function melange(termes) {
  let s = 0, w = 0, wTot = 0;
  for (const [poids, z] of termes) { wTot += Math.abs(poids); if (z == null) continue; s += poids * z; w += Math.abs(poids); }
  return w ? s * (wTot / w) : 0;
}
/* Les écarts bruts de chaque rôle, avant leur décalage (`DECALAGE_ROLES`) : scripts/roles_calibre.mjs les lit. */
export function rolesBruts(p) {
  if (!p || p.p === 'G') return null;
  const g = estD(p) ? 'D' : 'F';
  const gp = Math.max(1, p.gp || 1);
  const z = (cle, v) => zSaison(p, g, cle, v);
  const zG = z('gpg', (p.g || 0) / gp), zA = z('apg', (p.a || 0) / gp);
  const zPT = z('ptpg', (p.pt ?? ((p.g || 0) + (p.a || 0))) / gp);
  const zSH = z('shpg', (p.sh || 0) / gp);
  const zPCT = (p.sh || 0) >= 20 ? z('shpct', (p.g || 0) / p.sh) : null;
  const zPIM = z('pimpg', (p.pim || 0) / gp);
  const zPPP = p.ppp == null ? null : z('ppppg', p.ppp / gp);
  const zSHP = p.shp == null ? null : z('shppg', p.shp / gp);
  const zTOI = p.toi > 0 ? z('toi', p.toi) : null;
  const zHT = p.ht == null ? null : z('ht', p.ht);
  const zBL = p.bl == null ? null : z('bl', p.bl);
  const zGB = p.gb == null ? null : z('gb', Number(p.gb));
  const md = cz(p.md), mr = cz(p.mr);
  const tr = new Set(getTraits(p).map(t => t.cle));
  const t = (...k) => (k.some(x => tr.has(x)) ? 1 : 0);
  const brut = g === 'F' ? {
    sniper: melange([[0.5, zG], [0.3, zPCT], [0.2, zSH]]) + t('TIR'),
    passeur: melange([[0.6, zA], [0.25, zPPP], [0.15, zA == null || zG == null ? null : zA - zG]]) + t('CREATEUR', 'MENEUR'),
    deuxsens: melange([[0.5, md], [0.3, zPT], [0.2, zSHP]]) + t('SELKE', 'BIDIR'),
    power: melange([[0.35, zG], [0.3, mr], [0.2, zGB], [0.15, zHT ?? zPIM]]) + t('COLOSSE'),
    checker: melange([[0.4, zHT ?? mr], [0.35, md], [-0.25, zPT]]) + 0.5 * t('SELKE'),
    energie: melange([[0.35, zSH], [0.25, zHT ?? mr], [-0.4, zTOI ?? zPT]]) + t('VITESSE'),
    bagarreur: melange([[0.8, zPIM], [0.2, zGB]]),
  } : {
    defensif: melange([[0.55, md], [0.2, zBL ?? mr], [-0.25, zPT]]) + t('NORRIS') * 0.5,
    offensif: melange([[0.45, zPT], [0.3, zG], [0.25, zSH]]) + t('TIR'),
    manieur: melange([[0.55, zA], [0.25, zTOI], [0.2, zPPP]]) + t('CREATEUR', 'VITESSE') * 0.6,
    physique: melange([[0.4, mr], [0.3, zHT ?? zPIM], [0.3, zGB]]) + t('COLOSSE'),
    deuxsens: melange([[0.45, md], [0.35, zPT], [0.2, zTOI]]) + t('NORRIS', 'BIDIR'),
  };
  return brut;
}
/* Le talent d'un joueur dans SA saison : l'écart réduit de ses points par match, à son poste (0 sans référence). */
export function talentDe(p) {
  if (!p || p.p === 'G') return 0;
  const gp = Math.max(1, p.gp || 1);
  return zSaison(p, estD(p) ? 'D' : 'F', 'ptpg', (p.pt ?? ((p.g || 0) + (p.a || 0))) / gp) ?? 0;
}
/*
 * LE STYLE, À TALENT ÉGAL (1.0, oct.). JP : *pour les chimies de stratégie, je pense pas que ça doit
 * être plus haut si plus de talent, ça devient un double bonus*. Mesuré : le score d'un rôle offensif
 * suit les points par match (0,83 à 0,90 de corrélation) — un trio de vedettes avait le meilleur fit
 * ET le plus haut plafond de chimie, en plus de ses cotes. Le FIT d'un système se lit maintenant au
 * style : chaque rôle perd la part qui suit le talent (`PENTE_TALENT`, la pente de chaque rôle sur le
 * talent chez les réguliers, scripts/fit_calibre.mjs). Le rôle à l'écran (élite, bon) reste ce qu'il
 * vaut ; seul l'assortiment d'un système (le fit, donc la chimie) se lit à talent égal.
 */
const PENTE_TALENT = {
  F: { sniper: 0.818, passeur: 0.859, deuxsens: 0.612, power: 0.229, checker: -0.156, energie: -0.089, bagarreur: -0.133 },
  D: { defensif: -0.034, offensif: 0.919, manieur: 0.925, physique: -0.17, deuxsens: 0.693 },
};
const STYLES_CACHE = new WeakMap();
function stylesBase(p) {
  if (!p || p.p === 'G') return null;
  if (STYLES_CACHE.has(p)) return STYLES_CACHE.get(p);
  const g = estD(p) ? 'D' : 'F', brut = rolesBruts(p), dec = DECALAGE_ROLES[g], t = talentDe(p);
  const out = {};
  for (const [k, sc] of Object.entries(brut)) out[k] = Math.round(100 / (1 + Math.exp(-1.4 * borne(sc - PENTE_TALENT[g][k] * t + (dec[k] || 0), -3, 3))));
  STYLES_CACHE.set(p, out);
  return out;
}
/* Le style d'un joueur, ses changements de carte compris : ce qu'un système lit pour assortir. */
export function stylesDe(p) {
  const base = stylesBase(p);
  if (!base || !p._mutProfils) return base;
  const out = { ...base };
  for (const [k, d] of Object.entries(p._mutProfils)) if (k in out) out[k] = Math.max(1, Math.min(99, out[k] + d));
  return out;
}
/*
 * LE DÉCALAGE DE CHAQUE RÔLE (scripts/roles_calibre.mjs) : sans lui, les
 * rôles aux formules les plus larges prenaient tout (19 % de bagarreurs, 4 %
 * de power forwards). Calé pour que les rôles premiers des réguliers
 * ressemblent à une vraie ligue : autant de snipers que de passeurs, des
 * bagarreurs rares.
 */
export const DECALAGE_ROLES = {
  F: { sniper: -0.08, passeur: -0.1, deuxsens: 0, power: 0.2, checker: 0.07, energie: 0.06, bagarreur: -0.16 },
  D: { defensif: 0, offensif: 0.09, manieur: 0.11, physique: -0.38, deuxsens: 0.17 },
};
function profilsBase(p) {
  if (!p || p.p === 'G') return null;
  if (PROFILS_CACHE.has(p)) return PROFILS_CACHE.get(p);
  const brut = rolesBruts(p);
  const dec = DECALAGE_ROLES[estD(p) ? 'D' : 'F'];
  const out = {};
  for (const [k, sc] of Object.entries(brut)) out[k] = Math.round(100 / (1 + Math.exp(-1.4 * borne(sc + (dec[k] || 0), -3, 3))));
  PROFILS_CACHE.set(p, out);
  return out;
}
/*
 * QUI EST UNE UNITÉ (S79). JP : *ce qu'on voit sur la page d'alignement …
 * ça doit aider à savoir d'un coup d'oeil ce que les joueurs peuvent faire
 * pour matcher comme des vraies lignes*. Le rôle premier de chacun nomme le
 * trio ou la paire : deux snipers font un « Trio de snipers », un défensif
 * et un offensif la « Paire classique ».
 */
const UNITE_PAR_ROLE = {
  F: { sniper: 'Trio de snipers', passeur: 'Trio de passeurs', deuxsens: 'Trio two-way', power: 'Trio de power forwards', checker: 'Trio de checkers', energie: 'Trio de plombiers', bagarreur: 'Trio de durs' },
  D: { defensif: 'Paire défensive', offensif: 'Paire offensive', manieur: 'Paire de manieurs', physique: 'Paire physique', deuxsens: 'Paire two-way' },
};
export function identiteUnite(lineup, groupe, u) {
  const js = SLOTS.filter(s => s.group === groupe && s.unit === u && !s.scratch).map(s => lineup && lineup[s.i]).filter(Boolean);
  // Une unité incomplète n'a pas de nom (J1-I) : « Trio polyvalent » à 1/3, c'était un jugement sur rien.
  if (js.length < (groupe === 'D' ? 2 : 3)) return null;
  const roles = js.map(profilPrincipal).filter(Boolean);
  if (!roles.length) return null;
  const n = {};
  for (const r of roles) n[r.cle] = (n[r.cle] || 0) + 1;
  const [top, fois] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  const parmi = ks => roles.filter(r => ks.includes(r.cle)).length;
  const nom = fois >= 2 ? UNITE_PAR_ROLE[groupe][top]
    : groupe === 'D' ? (parmi(['defensif', 'physique']) && parmi(['offensif', 'manieur']) ? 'Paire classique' : parmi(['offensif', 'manieur']) ? 'Paire offensive' : 'Paire défensive')
      : parmi(['sniper', 'passeur', 'power']) >= 2 ? 'Trio offensif' : parmi(['checker', 'deuxsens']) >= 2 ? 'Trio défensif'
        : parmi(['energie', 'bagarreur', 'checker', 'power']) >= 2 ? 'Trio robuste' : 'Trio polyvalent';
  return { nom, ico: roles.map(r => r.ico).join(''), roles: roles.map(r => r.nom) };
}
/*
 * LES ORIGINES (1.0). JP : *ajouter des cartes qui activent bonus s'il même
 * équipe, ou autres trucs du genre*. D'où vient un joueur — son club, sa
 * saison, sa franchise, sa décennie, son âge — se lit sur la carte ; aucune
 * cote, aucune stat neuve. `origineUnite` dit ce qu'une unité a en commun
 * (l'alignement le montre en puce), `originesDe` compte ce que la formation
 * habillée a en commun (les cartes d'origine le paient, js/combat.js).
 */
const clubSaison = p => `${p.t}|${p.s}`;
const decennieDe = p => { const a = parseInt(String(p.s || '').slice(0, 4), 10); return Number.isFinite(a) ? Math.floor(a / 10) * 10 : null; };
const franchiseDe = p => franchiseDuCode(p.t) || p.t;
/* Les paires d'un groupe de joueurs qui partagent une même clé : n joueurs d'une clé font n(n−1)/2 paires. */
function pairesDe(js, cle) {
  const n = new Map();
  for (const p of js) { const k = cle(p); if (k != null) n.set(k, (n.get(k) || 0) + 1); }
  let paires = 0;
  for (const c of n.values()) paires += (c * (c - 1)) / 2;
  return paires;
}
export function origineUnite(lineup, groupe, u) {
  const js = SLOTS.filter(s => s.group === groupe && s.unit === u && !s.scratch).map(s => lineup && lineup[s.i]).filter(Boolean);
  if (js.length < (groupe === 'D' ? 2 : 3)) return null;
  const tous = (cle) => new Set(js.map(cle)).size === 1;
  return {
    ligneOrigine: tous(clubSaison),
    coequipiers: pairesDe(js, clubSaison),
    famille: tous(franchiseDe),
    decennie: groupe === 'F' && tous(decennieDe) ? decennieDe(js[0]) : null,
  };
}
export function originesDe(team) {
  const lineup = team && team.roster;
  const habilles = SLOTS.filter(s => !s.scratch).map(s => lineup && lineup[s.i]).filter(Boolean);
  const top = SLOTS.filter(s => !s.scratch && s.unit <= 1 && (s.group === 'F' || s.group === 'D')).map(s => lineup && lineup[s.i]).filter(Boolean);
  const unites = [...[0, 1, 2, 3].map(u => origineUnite(lineup, 'F', u)), ...[0, 1, 2].map(u => origineUnite(lineup, 'D', u))].filter(Boolean);
  const parFranchise = new Map();
  for (const p of habilles) { const k = franchiseDe(p); parFranchise.set(k, (parFranchise.get(k) || 0) + 1); }
  const ages = habilles.map(p => ageAtSeason(p.bd, p.s)).filter(a => a != null);
  return {
    coequipiers: pairesDe(top, clubSaison),
    franchise: Math.max(0, ...parFranchise.values()),
    lignesOrigine: unites.filter(o => o.ligneOrigine).length,
    triosDecennie: unites.filter(o => o.decennie != null).length,
    veterans: ages.filter(a => a >= 31).length,
    jeunes: ages.filter(a => a <= 23).length,
  };
}
/* Le meilleur profil d'un joueur : ce que la carte affiche. */
function profilPrincipal(p) {
  const pr = profilsDe(p);
  if (!pr) return null;
  const [cle, fit] = Object.entries(pr).sort((a, b) => b[1] - a[1])[0];
  return { cle, fit, ...(PROFILS[estD(p) ? 'D' : 'F'][cle]) };
}

/* ---------- les systèmes de jeu (S79) ---------- */
/*
 * UN SYSTÈME POUR LE TRIO, UN AUTRE POUR LA PAIRE. JP : *stratégie des def et
 * attaquants différents?* ; *revoir les stratégies pour que ça fitte plus
 * avec le reste du moteur et ce qu'on a comme infos sur les joueurs*.
 *
 * Chaque trio joue un système d'AVANTS (`TACTIQUES` : les clés d'avant S79
 * restent, pour que les sauvegardes et les plans adverses se relisent),
 * chaque paire un système de DÉFENSEURS (`SYSTEMES_D`, `lignes[u].tacD`).
 * Un système DEMANDE un rôle par poste (`slots`) — le fit de l'unité est la
 * moyenne de ses joueurs dans ces rôles (js/sim.js, « les rôles ») — et fait
 * deux choses, en chiffres :
 *   `gain`  ce qu'il rapporte, À PROPORTION DU FIT (`echelleFit` : rien sous
 *           30 %, tout à 75 %, un quart de plus au-delà) — un système joué
 *           par les mauvais joueurs coûte sans rapporter ;
 *   `prix`  ce qu'il coûte, toujours.
 * Les canaux sont ceux du moteur : `volume` (les lancers de l'unité),
 * `finition` (leur %), `defense` (les buts alloués pendant ses présences),
 * `discipline` (ses punitions), `energie` (son usure), `physique` (ce que
 * le jeu robuste rapporte les soirs éreintants et en séries).
 * Et chacun ÉTOUFFE un système du trio adverse (`bat`) : l'action spéciale
 * de ce trio-là ne passe pas pendant ses présences. Le cycle des trios est
 * fermé (échec avant → cycle → volume → trappe → contre-attaque → échec
 * avant) ; chaque système de paire étouffe aussi un système de trio.
 */
export const TACTIQUES = {
  hourra: {
    nom: 'Hourra', ico: '🎲', bat: null, slots: null,
    mot: 'Pas de système : chacun joue d\'instinct. Rien à assortir, mais ni chimie ni action spéciale.',
  },
  echec: {
    nom: 'Échec avant 2-1-2', ico: '🔥', bat: 'courtes',
    slots: { AG: 'power', C: 'energie', AD: 'checker' },
    mot: 'Deux avants vont chercher la rondelle dans leur zone : on la récupère haut.',
    gain: { volume: 1.141 }, prix: { discipline: 1.183, energie: 1.082 },
  },
  courtes: {
    nom: 'Cycle et possession', ico: '🌀', bat: 'bleue',
    slots: { AG: 'power', C: 'passeur', AD: 'passeur' },
    mot: 'On garde la rondelle le long des bandes et on attend la bonne passe.',
    gain: { finition: 1.089 }, prix: { volume: 0.943 },
  },
  bleue: {
    nom: 'Volume de tirs', ico: '🌧️', bat: 'defensive',
    slots: { AG: 'sniper', C: 'power', AD: 'sniper' },
    mot: 'Tout ce qui passe va au filet : des tirs de partout, des rebonds.',
    gain: { volume: 1.157 }, prix: { finition: 0.954 },
  },
  defensive: {
    nom: 'Trappe 1-3-1', ico: '🪤', bat: 'contre',
    slots: { AG: 'deuxsens', C: 'deuxsens', AD: 'checker' },
    mot: 'On bouche la zone neutre : rien ne passe au centre.',
    gain: { defense: 0.848, discipline: 0.917 }, prix: { volume: 0.939 },
  },
  contre: {
    nom: 'Contre-attaque', ico: '🏹', bat: 'echec',
    slots: { AG: 'sniper', C: 'passeur', AD: 'energie' },
    mot: 'On laisse venir et on repart vite : la longue passe d\'une zone à l\'autre.',
    gain: { finition: 1.104 }, prix: { defense: 1.058 },
  },
  derriere: {
    // 1.0 (C1) : 🥅 est le trophée Vezina ; l'enclave attire les rebonds.
    nom: 'Jeu d\'enclave', ico: '🧲', bat: null,
    slots: { AG: 'power', C: 'passeur', AD: 'power' },
    mot: 'Deux gros devant le filet, un passeur derrière : écrans, rebonds, déviations.',
    gain: { finition: 1.058, volume: 1.058 }, prix: { discipline: 1.104 },
  },
  energie: {
    nom: 'Trio de plombiers', ico: '🧰', bat: null,
    slots: { AG: 'checker', C: 'energie', AD: 'bagarreur' },
    mot: 'On frappe tout ce qui bouge et on use l\'adversaire : ça paie les soirs durs.',
    gain: { defense: 0.92, physique: 1.5 }, prix: { discipline: 1.164, energie: 1.102 },
  },
};
export const SYSTEMES_D = {
  hourra: {
    nom: 'Sans consigne', ico: '🎲', bat: null, slots: null,
    mot: 'La paire joue d\'instinct : rien à assortir, ni chimie.',
  },
  maison: {
    nom: 'Rester à la maison', ico: '🏠', bat: 'contre',
    slots: { DG: 'defensif', DD: 'defensif' },
    mot: 'Les deux défenseurs restent derrière la rondelle : aucune échappée.',
    gain: { defense: 0.885 }, prix: { volume: 0.825 },
  },
  activer: {
    nom: 'Activer les défenseurs', ico: '🛫', bat: 'courtes',
    slots: { DG: 'offensif', DD: 'offensif' },
    mot: 'Les défenseurs montent et se joignent à l\'attaque, de la bleue au cercle.',
    gain: { volume: 1.256, finition: 1.046 }, prix: { defense: 1.078 },
  },
  relance: {
    nom: 'Sortie rapide', ico: '💨', bat: 'echec',
    slots: { DG: 'manieur', DD: 'manieur' },
    mot: 'La première passe sort vite de la zone : l\'échec avant ne mord pas.',
    gain: { volume: 1.143, defense: 0.947 }, prix: { energie: 1.062 },
  },
  rude: {
    nom: 'Nettoyer l\'enclave', ico: '🧹', bat: 'derriere',
    slots: { DG: 'physique', DD: 'physique' },
    mot: 'Personne ne reste devant le filet : on sort les gros de l\'enclave.',
    gain: { defense: 0.911, physique: 1.5 }, prix: { discipline: 1.155 },
  },
  equilibre: {
    nom: 'Jeu à deux sens', ico: '🌗', bat: null,
    slots: { DG: 'deuxsens', DD: 'deuxsens' },
    mot: 'Un pied en attaque, un pied en défense : rien d\'extrême.',
    gain: { defense: 0.959, volume: 1.041 }, prix: {},
  },
};
/* Un système, d'où qu'il vienne (un trio ou une paire), et son groupe. */
export const systemeDe = k => (k && k !== 'hourra' && TACTIQUES[k] ? { ...TACTIQUES[k], cle: k, groupe: 'F' }
  : k && k !== 'hourra' && SYSTEMES_D[k] ? { ...SYSTEMES_D[k], cle: k, groupe: 'D' } : null);
/* Le système de trio qui étouffe CELUI-CI (un trio adverse), et le système de paire qui l'étouffe aussi. */
export const contreDe = cle => Object.keys(TACTIQUES).find(k => TACTIQUES[k].bat === cle) || null;
export const contreDeD = cle => Object.keys(SYSTEMES_D).find(k => SYSTEMES_D[k].bat === cle) || null;
/* Le gain d'un système suit le fit : rien sous 30 %, tout à 75 %, un quart de plus au-delà. */
export const echelleFit = fit => borne((fit - 30) / 45, 0, 1.25);
/* Ce qu'un système fait à un canal, pour une unité de ce fit : son gain au prorata, son prix entier. */
function canalSysteme(S, fit, canal) {
  if (!S) return 1;
  const g = S.gain && S.gain[canal] != null ? 1 + (S.gain[canal] - 1) * echelleFit(fit) : 1;
  const p = S.prix && S.prix[canal] != null ? S.prix[canal] : 1;
  return g * p;
}
/*
 * CE QU'UN SYSTÈME FAIT À UNE UNITÉ, EN CHIFFRES (S79) : son gain au prorata
 * du fit de ses joueurs, son prix entier — `canalSysteme`, le calcul même du
 * moteur. Le jeu robuste est le canal « physique » : ce que la mise en échec
 * rapporte les soirs éreintants et en séries.
 */
const CANAUX_SYSTEME = [['volume', 'Tirs', 1], ['finition', 'Précision', 1], ['defense', 'Buts contre', -1], ['discipline', 'Punitions', -1], ['energie', 'Usure des jambes', -1], ['physique', 'Jeu robuste', 1]];
export function effetsDeSysteme(S, fit) {
  if (!S || !S.slots) return [];
  return CANAUX_SYSTEME.map(([c, nom, sens]) => {
    const v = canalSysteme(S, fit, c);
    const x = Math.round(Math.abs(v - 1) * 100);
    return x < 1 ? null : { canal: c, v, txt: `${nom} ${v >= 1 ? '+' : '−'}${x} %`, bon: sens > 0 ? v > 1 : v < 1 };
  }).filter(Boolean);
}

/*
 * `def` : la part de buts alloués que le jeu physique retire (à une ligne
 * moyenne) ; `pun` : les punitions de trop, en punitions de ligue. RECALÉS
 * EN PAIRES (S71) : avec l'ancien réglage, rentre-dedans coûtait même aux
 * lignes costaudes (−1,4 victoire sur les deux plus costaudes de chaque club)
 * et l'agressivité basse rapportait à tout le monde (+0,7) — un repas
 * gratuit. Le modèle mesuré (victoires ≈ 30 × défense − 8 × punitions) a
 * donné ces valeurs : à la ligne moyenne, rentre-dedans coûte un peu et la
 * basse ne rapporte rien ; costaude, rentre-dedans paie et la basse coûte ;
 * légère, c'est l'inverse.
 */
export const AGRESSIVITES = [
  { nom: 'Prudente', ico: '🕊️', energie: 0.98, physique: 0.0, def: -0.04, pun: -0.15 },
  { nom: 'Moyenne', ico: '⚖️', energie: 1.00, physique: 0.4, def: 0, pun: 0 },
  { nom: 'Musclée', ico: '💥', energie: 1.04, physique: 0.7, def: 0.035, pun: 0.15 },
  { nom: 'Rentre-dedans', ico: '🪓', energie: 1.09, physique: 0.9, def: 0.07, pun: 0.30 },
];
export const SEC_DEFAUT = 60, SEC_MIN = 30, SEC_MAX = 90;

/*
 * LE PHYSIQUE D'UN JOUEUR ET CE QUE L'AGRESSIVITÉ EN TIRE (S71). JP :
 * *s'assurer que c'est plus clair quels joueurs sont avantagés. Un exemple
 * actuel, c'est que tu gagnes probablement plus avec un joueur peu robuste
 * d'avoir une stratégie robuste, car c'est moins grave d'augmenter son % de
 * pénalité pour prendre le bonus.* Il avait raison : le bonus physique était
 * le même pour toutes les lignes, et les punitions de trop MULTIPLIAIENT le
 * taux de chaque joueur — une ligne de joueurs propres jouée rentre-dedans
 * restait sous la moyenne de la ligue et empochait tout le bonus.
 *
 * Maintenant, c'est le joueur qui décide :
 *   - `physiqueDe` : sa robustesse mesurée (🪨), son gabarit, le trait
 *     Colosse, de 0 à 1 (0,5 = la moyenne de son groupe) ;
 *   - le BONUS du jeu physique suit le physique de l'unité sur la glace
 *     (`rendementPhysique`) : une ligne costaude en tire presque le double,
 *     une ligne légère presque rien ;
 *   - les PUNITIONS DE TROP s'ajoutent en punitions de ligue (plus en % du
 *     taux de base du joueur), et une ligne légère en prend plus
 *     (`coutPhysique`) : elle accroche et retient au lieu de frapper.
 * À l'agressivité moyenne, rien ne bouge : la ligue non plus.
 */
const PHYSIQUE_CACHE = new WeakMap();
export function physiqueDe(p) {
  if (!p || p.p === 'G') return 0.5;
  if (PHYSIQUE_CACHE.has(p)) return PHYSIQUE_CACHE.get(p);
  const v = physiqueBrut(p);
  PHYSIQUE_CACHE.set(p, v);
  return v;
}
function physiqueBrut(p) {
  const gb = p.gb == null ? 1 : Number(p.gb);
  const colosse = getTraits(p).some(t => t.cle === 'COLOSSE') ? 1 : 0;
  const x = 0.8 * cz(p.mr) + 0.6 * (gb - 1) + colosse;
  return 1 / (1 + Math.exp(-1.4 * borne(x, -3, 3)));
}
const rendementPhysique = ph => borne(1 + 4 * (ph - 0.5), 0.2, 2);
const coutPhysique = ph => borne(1 - 4 * (ph - 0.5), 0.2, 2);
/* Le physique moyen d'une unité (un trio, une paire) ou d'une ligne entière. */
function physiqueUnite(lineup, group, u) {
  const js = SLOTS.filter(s => s.group === group && s.unit === u && !s.scratch).map(s => lineup && lineup[s.i]).filter(Boolean);
  return js.length ? js.reduce((a, p) => a + physiqueDe(p), 0) / js.length : 0.5;
}
export function physiqueLigne(lineup, u) {
  const js = Object.values(joueursDeLigne(lineup, u)).filter(Boolean);
  return js.length ? js.reduce((a, p) => a + physiqueDe(p), 0) / js.length : 0.5;
}
/*
 * CE QUE RAPPORTE UNE AGRESSIVITÉ À UNE LIGNE, en mots pour l'écran : le
 * bonus défensif, le surplus de punitions, et le net (une punition de trop
 * vaut à peu près 12 % de buts alloués de plus sur l'ensemble du match).
 */
export function bilanAgressivite(agr, ph) {
  const A = AGRESSIVITES[agr] || AGRESSIVITES[1];
  const defense = A.def * rendementPhysique(ph);
  const punitions = A.pun * coutPhysique(ph);
  // Le même rapport que la mesure en paires : 8 victoires pour 30.
  return { defense, punitions, net: defense - 0.27 * punitions };
}

/*
 * LES BADGES À PALIERS (refonte 1, oct. 2026). JP : *simplifier traits,
 * positions et rôles, genre sniper bronze argent or platine, intégrer traits
 * et rôles*. Un joueur porte UN badge (son rôle premier) et au plus un second
 * (le suivant, s'il vaut 60 et plus), chacun à un PALIER : Bronze, Argent, Or,
 * Platine — le rang de son score parmi les rôles premiers des réguliers de son
 * groupe, toutes saisons (`SEUILS_PALIER`, scripts/badges_calibre.mjs : le
 * top 40 % Argent, le top 15 % Or, le top 3 à 5 % Platine). Le score est lu
 * dans SA saison (`rolesBruts`), et un trait le monte déjà (🎯 Tir pousse le
 * Sniper) : le trait devient la raison du palier (« Sniper Or · Tir »).
 *
 * Ce que fait un badge, sur la glace : SON PALIER donne l'effet, PAR JOUEUR,
 * pendant ses présences — un trio de trois checkers Platine étouffe trois fois
 * plus qu'un seul (avant : la moyenne du trio, une maîtrise continue). Le
 * badge en second compte la moitié. Chaque rôle a UN canal, celui que ses
 * stats ne portent pas déjà (les buts d'un sniper sont dans sa finition : les
 * lui compter deux fois gonflerait la ligue) :
 *
 *   checker, two-way (F) · défensif, physique (D) : ÉTOUFFENT — la qualité des
 *     lancers adverses pendant leurs présences (le canal de la défense) ;
 *   bagarreur : INTIMIDE — la finition du trio adverse pendant ses présences ;
 *   power forward : DEVANT LE FILET — la finition de ses coéquipiers de trio ;
 *   plombier : DES JAMBES — son match lui coûte moins ;
 *   sniper : EN AVANTAGE NUMÉRIQUE, c'est lui qui tire ;
 *   défenseur offensif : DE LA POINTE — le volume de sa paire ;
 *   passeur, manieur : LA CHIMIE — leur ligne joue son système plus haut
 *     (`BADGE_CHIMIE`, un canal du jeu que ses passes ne portent pas : la
 *     création, elle, est déjà lue dans ses passes, `passesRel`).
 *
 * CENTRÉ sur le badge moyen de la ligue (`BADGE_LIGUE`, mesuré sur 29 000
 * réguliers) : toute la ligue porte des badges, et ses buts ne bougent pas ;
 * un joueur sans le badge vaut un peu moins que la moyenne, un Platine bien plus.
 *
 * Et les MISES EN ÉCHEC COÛTENT DES JAMBES (JP : *perte d'énergie des joueurs
 * frappés*) : les coups d'une unité (ses `ht` par match, estimés de sa
 * robustesse avant 2005-06, portés par son agressivité) tombent sur les
 * unités adverses qu'elle croise (les mêmes poids que l'appariement), et
 * chaque coup reçu coûte COUP_JAMBES à un joueur moyen — la moitié à un
 * costaud, une fois et demie à un léger (COUP_ABSORBE). Après le match, comme
 * l'usure : les coups d'aujourd'hui pèsent demain, et de match en match en
 * séries. Déterministe : la même graine rejoue la même saison.
 */
export const PALIERS = [null,
  { cle: 'bronze', nom: 'Bronze' }, { cle: 'argent', nom: 'Argent' }, { cle: 'or', nom: 'Or' }, { cle: 'platine', nom: 'Platine' }];
export const SEUILS_PALIER = { F: [78, 92, 98], D: [76, 89, 98] };
const BADGE_SECOND_MIN = 60;
const BADGE_LIGUE = {
  F: { sniper: 0.102, passeur: 0.101, deuxsens: 0.079, power: 0.075, checker: 0.05, energie: 0.042, bagarreur: 0.066 },
  D: { defensif: 0.081, offensif: 0.131, manieur: 0.13, physique: 0.08, deuxsens: 0.089 },
};
/* L'effet d'un badge PLATINE, par joueur ; Or les trois quarts, Argent la moitié, Bronze le quart. */
export const EFFET_ROLE = { checker: 0.08, deuxsens: 0.04, defensif: 0.08, physique: 0.04, bagarreur: 0.06, power: 0.08, energie: 0.4, sniper: 1.0, offensif: 0.16 };
/* Passeur et manieur Platine : leur ligne joue son système comme si son fit valait BADGE_CHIMIE de plus (la chimie). */
export const BADGE_CHIMIE = 12;
export const COUP_JAMBES = Number(ENV_MESURE.COUP_JAMBES ?? 1.2), COUP_ABSORBE = 0.5, COUP_MOYEN = 1.2;
export const palierDe = (g, x) => { const S = SEUILS_PALIER[g]; return x >= S[2] ? 4 : x >= S[1] ? 3 : x >= S[0] ? 2 : 1; };
/*
 * LES BADGES d'un joueur : son rôle premier, et le second s'il vaut
 * BADGE_SECOND_MIN — chacun `{ cle, palier, second, nom, ico, mot, … }`. Les
 * mutations de carte (`_mutProfils`) déplacent le score, donc le palier.
 */
export function badgesDe(p) {
  const pr = profilsDe(p);
  if (!pr) return [];
  const g = estD(p) ? 'D' : 'F';
  const traits = getTraits(p).map(t => t.cle);
  const raison = k => traits.find(t => (TRAITS_DU_BADGE[g][k] || []).includes(t)) || null;
  const [a, b] = Object.entries(pr).sort((x, y) => y[1] - x[1]);
  const out = [{ cle: a[0], palier: palierDe(g, a[1]), second: false, trait: raison(a[0]), ...PROFILS[g][a[0]] }];
  if (b && b[1] >= BADGE_SECOND_MIN) out.push({ cle: b[0], palier: palierDe(g, b[1]), second: true, trait: raison(b[0]), ...PROFILS[g][b[0]] });
  return out;
}
/* Les traits qui MONTENT un badge (ceux que `rolesBruts` ajoute au score) : la raison de son palier, « Sniper Or · Tir ». */
const TRAITS_DU_BADGE = {
  F: { sniper: ['TIR'], passeur: ['CREATEUR', 'MENEUR'], deuxsens: ['SELKE', 'BIDIR'], power: ['COLOSSE'], checker: ['SELKE'], energie: ['VITESSE'] },
  D: { defensif: ['NORRIS'], offensif: ['TIR'], manieur: ['CREATEUR', 'VITESSE'], physique: ['COLOSSE'], deuxsens: ['NORRIS', 'BIDIR'] },
};
/* La valeur d'un joueur dans un badge : palier / 4 en premier, la moitié en second, 0 sans. */
function valeurBadge(p, role) {
  const pr = profilsDe(p);
  if (!pr || pr[role] == null) return 0;
  const tri = Object.entries(pr).sort((x, y) => y[1] - x[1]);
  const g = estD(p) ? 'D' : 'F';
  if (tri[0][0] === role) return palierDe(g, tri[0][1]) / 4;
  if (tri[1] && tri[1][0] === role && tri[1][1] >= BADGE_SECOND_MIN) return palierDe(g, tri[1][1]) / 8;
  return 0;
}
/* Un badge, centré sur la ligue (0 = le badge moyen) : ce que le moteur lit. */
export function maitrise(p, role) {
  if (!p || p.p === 'G' || neutrePour(p, 'badges')) return 0;
  const g = estD(p) ? 'D' : 'F';
  return valeurBadge(p, role) - (BADGE_LIGUE[g][role] || 0);
}
/* Les badges d'une unité s'ADDITIONNENT : chaque joueur rend le sien pendant ses présences. */
const maitriseUnite = (joueurs, role) => joueurs.reduce((a, p) => a + maitrise(p, role), 0);
/* Les mises en échec d'un joueur par match : comptées dès 2005-06, estimées de sa robustesse avant. */
function coupsDe(p) {
  if (!p || p.p === 'G') return 0;
  if (p.ht != null) return p.ht;
  return COUP_MOYEN * Math.exp(0.5 * (getHiddenRatings(p).r - 50) / 12);
}
/* Ce qu'un coup reçu coûte à ce joueur, en jambes : un costaud encaisse, un léger accuse. */
/* Ce qu'un coup reçu coûte aux jambes de CE joueur : continu, de 0,6 (physique 1) à 1,8 (physique 0) ; la fiche dit le sien. */
export const coutDuCoup = p => COUP_JAMBES * (1 + COUP_ABSORBE * (1 - 2 * physiqueDe(p)));
/*
 * Les coups d'un alignement tombent sur l'autre. `frappeur` et `frappe` sont
 * les profils de match (`profilMatch`) : leurs unités portent la présence, le
 * rang et l'agressivité. Une unité frappe au prorata de sa présence et de
 * son agressivité, les coups se répartissent sur les unités adverses par les
 * poids de l'appariement (60 % sur les trios, 40 % sur les paires).
 */
function encaisserCoups(frappeur, frappe) {
  if (!frappeur || !frappe || !frappeur.unites || !frappe.unites) return;
  const cibles = (unites, rang, n) => {
    const w = unites.map(x => (x.presence || 0) * Math.exp(-APPARIEMENT * Math.abs((unites.length > 1 ? (x.rang || 0) / (unites.length - 1) : 0) - (n > 1 ? rang / (n - 1) : 0))));
    const t = w.reduce((a, b) => a + b, 0) || 1;
    return w.map(x => x / t);
  };
  for (const g of ['F', 'D']) for (const u of frappeur.unites[g]) {
    if (!u.joueurs.length) continue;
    const A = AGRESSIVITES[u.agr ?? 1] || AGRESSIVITES[1];
    const coups = u.joueurs.reduce((a, p) => a + coupsDe(p), 0) * (u.presence || 0) / (PART_UNITE[g][u.rang] || u.presence || 1) * (0.6 + A.physique);
    if (!coups) continue;
    for (const [gg, part] of [['F', 0.6], ['D', 0.4]]) {
      const cible = frappe.unites[gg];
      const w = cibles(cible, u.rang || 0, frappeur.unites[g].length);
      cible.forEach((x, i) => {
        if (!x.joueurs.length) return;
        const parJoueur = coups * part * w[i] / x.joueurs.length;
        for (const q of x.joueurs) q.energie = Math.max(0, energieDe(q) - parJoueur * coutDuCoup(q));
      });
    }
  }
}

/*
 * LE JEU PHYSIQUE EN ÉVÉNEMENTS (1.0). JP : *tu devrais pouvoir pilonner ou
 * être pilonné ; je veux des batailles et du chamaillage aussi, tout ce qui
 * arrive dans un vrai match et ajoute du drama*. Trois événements, tirés
 * AVANT les lancers par `hasard()` (la même graine rejoue le même match),
 * écrits sur la feuille (`journal.physique`) pour le direct et le sommaire :
 *
 *   LE COUP MARQUANT : un dur (ses mises en échec, son physique) écrase un
 *     adversaire tiré sur les unités qu'il croise ; le frappé perd des
 *     jambes sur-le-champ (COUP_MARQUANT_JAMBES, donc le reste du match
 *     s'en ressent) et se blesse plus facilement ce soir (BLESSURE_SONNE).
 *   LA BAGARRE : deux joueurs jettent les gants — chaque club envoie son
 *     bagarreur (le score du rôle, au cube) ; le duel se joue au score de
 *     bagarreur, au physique et au gabarit, avec du hasard ; cinq minutes
 *     chacun, hors de leurs unités pendant ce temps (`auCachot`) ; le
 *     vainqueur donne de l'ÉLAN à son club (ELAN_BAGARRE pendant ELAN_DUREE
 *     minutes, la finition), le perdant en coûte (ELAN_BAGARRE_PERDU) et se
 *     blesse plus (BLESSURE_BAGARRE_PERDUE). Combien : BAGARRE_PAR_PIM par
 *     punition de ligue de l'époque (1987 en voit une par match, 2023 une
 *     sur trois), plus quand les deux clubs ont un vrai bagarreur, plus
 *     quand les lignes jouent rentre-dedans.
 *   LA MÊLÉE : le chamaillage après un sifflet — deux minutes qui s'annulent,
 *     à un costaud de chaque bord ; du drama et des punitions, rien de plus.
 *
 * Ce que ça change à la ligue : rien en moyenne (les mineures ne bougent
 * pas, l'élan est symétrique), tout dans le match — un club qui pilonne use
 * l'autre, un bagarreur gagné vaut dix minutes de finition.
 */
const BAGARRE_PAR_PIM = 0.55, MELEE_BASE = 0.5, COUP_MARQUANT_PART = 0.12;
/* Ce qu'une bagarre coûte aux jambes de chaque combattant : le fil du direct et les règles le disent. */
export const BAGARRE_JAMBES = 8;
export const ELAN_BAGARRE = 1.06, ELAN_BAGARRE_PERDU = 0.94, ELAN_DUREE = 10, BAGARRE_MINUTES = 5, MELEE_MINUTES = 2;
export const COUP_MARQUANT_JAMBES = 2, BLESSURE_SONNE = 1.5, BLESSURE_BAGARRE_PERDUE = 3;
/* Les coups qu'un alignement donne par match, attendus (la même formule qu'`encaisserCoups`). */
export function coupsAttendus(profil) {
  let total = 0;
  if (!profil || !profil.unites) return 0;
  for (const g of ['F', 'D']) for (const u of profil.unites[g]) {
    if (!u.joueurs.length) continue;
    const A = AGRESSIVITES[u.agr ?? 1] || AGRESSIVITES[1];
    total += u.joueurs.reduce((a, p) => a + coupsDe(p), 0) * (u.presence || 0) / (PART_UNITE[g][u.rang] || u.presence || 1) * (0.6 + A.physique);
  }
  return total;
}
const scoreBagarreur = p => ((profilsDe(p) || {}).bagarreur || 0) / 100;
/* Est-il au cachot à cet instant ? (les cinq minutes d'une bagarre) */
const auCachot = (profil, p, instant) => !!(profil.cachot && profil.cachot.some(c => c.joueur === p && instant >= c.t0 && instant < c.t1));
/* L'élan d'un club à cet instant : ce qu'une bagarre gagnée (ou perdue) fait à sa finition. */
const elanDe = (profil, instant) => (profil.elan ? profil.elan.reduce((a, e) => (instant >= e.t0 && instant < e.t1 ? a * e.mult : a), 1) : 1);
function tirerPhysique(pA, pB, T0, T1, journal, track) {
  const frac = (T1 - T0) / 60;
  const pats = { A: pA.patineurs || [], B: pB.patineurs || [] };
  if (!pats.A.length || !pats.B.length) return;
  const tous = [...pats.A, ...pats.B];
  // Les punitions de l'époque : la base de `punitionsRel` (par match, par joueur), moyennée sur les deux clubs.
  const pimBase = tous.reduce((a, p) => a + (seasonLancers(p.s)[7] || 0.9), 0) / tous.length;
  const agrDe = profil => {
    const us = [...profil.unites.F, ...profil.unites.D];
    return us.length ? us.reduce((a, u) => a + (0.6 + (AGRESSIVITES[u.agr ?? 1] || AGRESSIVITES[1]).physique), 0) / us.length : 1;
  };
  const agr = (agrDe(pA) + agrDe(pB)) / 2;
  const bag = { A: Math.max(...pats.A.map(scoreBagarreur)), B: Math.max(...pats.B.map(scoreBagarreur)) };
  const instant = () => T0 + hasard() * (T1 - T0);
  const noter = e => { if (journal) journal.physique.push(e); };
  pA.cachot = pA.cachot || []; pB.cachot = pB.cachot || []; pA.elan = pA.elan || []; pB.elan = pB.elan || [];
  const profil = { A: pA, B: pB };
  // Les coups marquants, par club.
  for (const cote of ['A', 'B']) {
    const moi = profil[cote], lui = profil[cote === 'A' ? 'B' : 'A'];
    const n = poisson(COUP_MARQUANT_PART * coupsAttendus(moi) * frac);
    for (let k = 0; k < n; k++) {
      const t = instant();
      const frappeur = weightedPick(pats[cote], p => coupsDe(p) * (0.3 + physiqueDe(p)) + 0.01);
      const cibleUnite = choisirPresence(hasard() < 0.6 ? lui.unites.F : lui.unites.D);
      const cible = cibleUnite && cibleUnite.joueurs.length ? cibleUnite.joueurs[Math.floor(hasard() * cibleUnite.joueurs.length)] : null;
      if (!cible) continue;
      cible.energie = Math.max(0, energieDe(cible) - COUP_MARQUANT_JAMBES);
      cible._sonne = true;
      noter({ type: 'coup', cote, instant: t, joueur: frappeur, cible });
    }
  }
  // Les bagarres.
  const nBag = poisson(BAGARRE_PAR_PIM * pimBase * (0.5 + 0.7 * (bag.A + bag.B)) * agr * frac);
  // Une bagarre par joueur par soir : la deuxième, c'est l'expulsion, donc le club envoie quelqu'un d'autre.
  const dejaBattus = new Set();
  for (let k = 0; k < nBag; k++) {
    const t = instant();
    const libres = c => { const l = pats[c].filter(p => !dejaBattus.has(p)); return l.length ? l : pats[c]; };
    const a = weightedPick(libres('A'), p => Math.pow(scoreBagarreur(p), 3) + 0.02);
    const b = weightedPick(libres('B'), p => Math.pow(scoreBagarreur(p), 3) + 0.02);
    dejaBattus.add(a); dejaBattus.add(b);
    const force = p => scoreBagarreur(p) + 0.6 * physiqueDe(p) + 0.2 * ((p.gb == null ? 1 : Number(p.gb)) - 1) + gauss() * 0.35;
    const fa = force(a), fb = force(b);
    const gagnant = Math.abs(fa - fb) < 0.15 ? null : fa > fb ? 'A' : 'B';
    for (const [cote, p] of [['A', a], ['B', b]]) {
      profil[cote].cachot.push({ joueur: p, t0: t, t1: t + BAGARRE_MINUTES });
      p.energie = Math.max(0, energieDe(p) - BAGARRE_JAMBES);
      if (track) p.simPIM = (p.simPIM || 0) + BAGARRE_MINUTES;
    }
    if (gagnant) {
      profil[gagnant].elan.push({ t0: t, t1: t + ELAN_DUREE, mult: ELAN_BAGARRE });
      profil[gagnant === 'A' ? 'B' : 'A'].elan.push({ t0: t, t1: t + ELAN_DUREE, mult: ELAN_BAGARRE_PERDU });
      (gagnant === 'A' ? b : a)._bagarrePerdue = true;
    }
    noter({ type: 'bagarre', cote: 'A', instant: t, joueur: a, cible: b, gagnant, minutes: BAGARRE_MINUTES });
  }
  // Les mêlées : deux minutes qui s'annulent.
  const nMel = poisson(MELEE_BASE * (pimBase / 0.9) * agr * frac);
  for (let k = 0; k < nMel; k++) {
    const t = instant();
    const a = weightedPick(pats.A, p => 0.5 * scoreBagarreur(p) + physiqueDe(p));
    const b = weightedPick(pats.B, p => 0.5 * scoreBagarreur(p) + physiqueDe(p));
    if (track) { a.simPIM = (a.simPIM || 0) + MELEE_MINUTES; b.simPIM = (b.simPIM || 0) + MELEE_MINUTES; }
    noter({ type: 'melee', cote: hasard() < 0.5 ? 'A' : 'B', instant: t, joueur: a, cible: b, minutes: MELEE_MINUTES });
  }
  if (journal) { journal.coups.A += Math.round(coupsAttendus(pA) * frac); journal.coups.B += Math.round(coupsAttendus(pB) * frac); }
}

/*
 * L'IMPORTANCE DU MATCH (S68), comme HockeyArena : un gros match fait jouer
 * plus fort, et ça se paie au moral du vestiaire et à l'infirmerie ; un match
 * pris à la légère repose les jambes et le moral, et se joue un cran en
 * dessous.
 */
export const IMPORTANCES = {
  basse: { nom: 'Basse', ico: '😌', mot: 'on se ménage', finition: 0.97, defense: 1.02, energie: 0.8 },
  // 1.0 (C1) : une icône par sens — 🏒 est le manieur de rondelle, 🔥 l'échec avant.
  normale: { nom: 'Normale', ico: '🎚️', mot: 'un match comme un autre' },
  haute: { nom: 'Haute', ico: '🌡️', mot: 'on joue ça comme un match des séries', finition: 1.03, defense: 0.97, blessure: 1.25, energie: 1.12 },
};
/*
 * UN SEUL RÉGLAGE (1.0, J2-11) : la consigne porte aussi la répartition
 * attaque / défense (`ad`, −2 à 2) qu'un curseur réglait à part. Basse penche
 * défense, Haute penche attaque. Le moteur lit toujours `match.ad` (la même
 * formule, `effetDeMoment`) : une vieille décision garde son `ad` et rejoue
 * à l'identique.
 */
export const AD_DE_CONSIGNE = { basse: -1, normale: 0, haute: 1 };

/* La ligne u : son trio, et sa paire (la quatrième ligne n'en a pas). */
const pairDeLigne = u => (u < 3 ? u : null);
export function joueursDeLigne(lineup, u) {
  const out = {};
  for (const s of SLOTS) {
    if (s.scratch) continue;
    if ((s.group === 'F' && s.unit === u) || (s.group === 'D' && s.unit === pairDeLigne(u))) out[s.role] = lineup[s.i] || null;
  }
  return out;
}
/*
 * LE FIT D'UNE UNITÉ À UN SYSTÈME (S79) : la moyenne, poste par poste, de ses
 * joueurs dans le rôle que le système demande. Le trio u lit un système
 * d'avants, la paire u un système de défenseurs.
 */
/*
 * LES AILES S'ASSORTISSENT (1.0, oct.). JP : *les stratégies donnent pas la
 * chance de swap AD et AG côté rôles, ce qui est cave*. Un système demande
 * un rôle à chaque aile ; ses ailiers le jouent dans le sens où ils rendent
 * le mieux — le sniper prend l'aile du sniper, qu'elle soit gauche ou droite.
 * Les mêmes règles pour tous les clubs ; rien ne bouge dans l'alignement.
 */
export function rolesDuSysteme(lineup, groupe, u, cle) {
  const S = groupe === 'D' ? SYSTEMES_D[cle] : TACTIQUES[cle];
  if (!S || !S.slots) return null;
  if (groupe === 'D' || !S.slots.AG || !S.slots.AD || S.slots.AG === S.slots.AD || !lineup) return S.slots;
  const miroir = { ...S.slots, AG: S.slots.AD, AD: S.slots.AG };
  return fitRoles(lineup, u, miroir) > fitRoles(lineup, u, S.slots) ? miroir : S.slots;
}
function fitRoles(lineup, u, slots) {
  const js = joueursDeLigne(lineup, u);
  let n = 0;
  for (const [role, prof] of Object.entries(slots)) { const p = js[role]; if (p) n += ((stylesDe(p) || {})[prof] ?? 0); }
  return n;
}
export function fitUnite(lineup, groupe, u, cle) {
  const S = groupe === 'D' ? SYSTEMES_D[cle] : TACTIQUES[cle];
  if (!S || !S.slots || !lineup) return 0;
  const js = joueursDeLigne(lineup, u);
  const fits = [];
  for (const [role, prof] of Object.entries(rolesDuSysteme(lineup, groupe, u, cle))) {
    const p = js[role];
    if (p === undefined) continue;          // la 4e ligne n'a pas de paire
    // UNE CASE VIDE N'A PAS DE FIT (1.0, J1-I) : une unité incomplète ne se
    // juge pas — elle comptait pour 0 et tout trio vide lisait « Mauvais fit ».
    if (p === null) return null;
    const pr = stylesDe(p);
    fits.push(pr && pr[prof] != null ? pr[prof] : 0);
  }
  return fits.length ? Math.round(fits.reduce((a, x) => a + x, 0) / fits.length) : 0;
}
/* Le fit d'une ligne à UN système (trio ou paire, selon sa clé) — ce que lisent l'écran et le stage. */
export function fitLigne(lineup, u, cle) {
  return SYSTEMES_D[cle] && !TACTIQUES[cle] ? fitUnite(lineup, 'D', u, cle) : fitUnite(lineup, 'F', u, cle);
}
/* Le système où une unité a le meilleur fit : ce que joue un club de l'IA. */
export function meilleureTactique(lineup, u) {
  let best = 'hourra', f = -1;
  for (const k of Object.keys(TACTIQUES)) {
    if (k === 'hourra') continue;
    const v = fitUnite(lineup, 'F', u, k);
    if (v == null) return 'hourra';       // unité incomplète : aucun système ne se choisit
    if (v > f) { f = v; best = k; }
  }
  return best;
}
export function meilleurSystemeD(lineup, u) {
  if (pairDeLigne(u) == null) return 'hourra';
  let best = 'hourra', f = -1;
  for (const k of Object.keys(SYSTEMES_D)) {
    if (k === 'hourra') continue;
    const v = fitUnite(lineup, 'D', u, k);
    if (v == null) return 'hourra';
    if (v > f) { f = v; best = k; }
  }
  return best;
}
/*
 * LES LIGNES D'UNE ÉQUIPE : { tac, agr, sec } × 4. Un club de l'IA joue la
 * tactique où chaque ligne a le meilleur fit, agressivité moyenne, glace par
 * défaut ; la tienne part pareil, et tu la changes quand tu veux.
 */
/*
 * TOUTES LES ÉQUIPES JOUENT AVEC LES MÊMES RÈGLES (S72). JP : *faire que
 * toutes les équipes ont les mêmes stratégies, stats, etc.* Une ligne qu'on
 * ne règle pas — celles de chaque club de l'IA, et les tiennes tant que tu
 * n'y touches pas — prend la tactique qui lui va le mieux ET l'agressivité la
 * plus payante pour sa carrure (`meilleureAgressivite`), avec la règle que
 * l'écran montre au joueur. `duSoir` : le réglage d'UN match (le plan d'un
 * adversaire en gros match) passe devant ; la chimie, elle, lit les lignes de
 * la saison, pour qu'un soir de trappe ne lui coûte rien.
 */
export function meilleureAgressivite(lineup, u) {
  const ph = physiqueLigne(lineup, u);
  let best = 1, v = 0.004;
  for (let i = 0; i < AGRESSIVITES.length; i++) {
    if (i === 1) continue;
    const n = bilanAgressivite(i, ph).net;
    if (n > v) { v = n; best = i; }
  }
  return best;
}
/*
 * LA MÉMOIRE D'UN MATCH (S73) : les lignes par défaut (meilleure tactique,
 * meilleure agressivité) se calculaient des dizaines de fois par match — la
 * saison avait pris 50 % de temps. Elles se gardent le temps d'UN match
 * (`MEMO_MATCH` change à chaque `playGame`), donc rien de périmé ne survit à
 * un changement d'alignement.
 */
let MEMO_MATCH = 0;
const MEMO_LIGNES = new WeakMap();
/*
 * LA LECTURE NEUTRE (V2.2, les totaux du soir disent tout). Le temps d'une lecture (`lectureDuMatch`,
 * option `neutre`) — jamais pendant un match joué —, une part de ce que TON alignement apporte est remise
 * au neutre : les badges au badge moyen de la ligue (`maitrise` rend 0), la chimie au pivot (aucun bonus),
 * les jambes à la référence, chaque ligne sans système. L'adversaire reste tel quel. La différence avec la
 * lecture telle quelle dit ce que chacune rapporte ou coûte ce soir (js/impact.js, `alignementDuSoir`).
 */
let NEUTRE = null;
const neutreDe = (team, quoi) => !!(NEUTRE && NEUTRE[quoi] && NEUTRE.team === team);
const neutrePour = (p, quoi) => !!(NEUTRE && NEUTRE[quoi] && NEUTRE.joueurs.has(p));
export function lignesDe(team, lineup, { duSoir = true } = {}) {
  const rendre = out => out.map(l => (neutreDe(team, 'systemes') ? { ...l, tac: 'hourra', tacD: 'hourra' } : { ...l }));
  if (duSoir && team && team._lignesMatch) return rendre(team._lignesMatch);
  const memo = lineup && team ? MEMO_LIGNES.get(lineup) : null;
  if (memo && memo.match === MEMO_MATCH && memo.team === team && memo.lignes === team.lignes) return rendre(memo.out);
  const out = lignesCalculees(team, lineup);
  if (lineup && team && typeof lineup === 'object') MEMO_LIGNES.set(lineup, { match: MEMO_MATCH, team, lignes: team.lignes, out });
  return rendre(out);
}
function lignesCalculees(team, lineup) {
  const L = (team && team.lignes) || [];
  return [0, 1, 2, 3].map(u => {
    const l = L[u] || {};
    return {
      tac: TACTIQUES[l.tac] ? l.tac : (lineup ? meilleureTactique(lineup, u) : 'hourra'),
      tacD: pairDeLigne(u) == null ? 'hourra' : SYSTEMES_D[l.tacD] ? l.tacD : (lineup ? meilleurSystemeD(lineup, u) : 'hourra'),
      agr: Number.isInteger(l.agr) && AGRESSIVITES[l.agr] ? l.agr : (lineup ? meilleureAgressivite(lineup, u) : 1),
      sec: Number.isFinite(l.sec) ? borne(l.sec, SEC_MIN, SEC_MAX) : SEC_DEFAUT,
    };
  });
}

/* ---------- la chimie ---------- */
/*
 * Comme HockeyArena : de 0 à son maximum en une trentaine de matchs, à
 * rendement décroissant ; chaque joueur changé en coupe le quart ; au-dessus
 * du maximum (le fit a baissé) elle redescend de 3 % par match. « Hourra » ne
 * bâtit rien.
 */
/*
 * LA CHIMIE S'APPREND, ELLE NE SE PERD PAS (S73). JP : *l'important est que je
 * puisse m'adapter aux adversaires, mais pas complètement, d'où l'apprentissage
 * de la chimie entre les joueurs et avec les stratégies, mais sans punir les
 * ajustements* ; *comme un deck de deckbuilder, considérant que c'est des
 * cartes de joueurs et d'effets*.
 *
 * Avant, changer de tactique coupait la chimie d'une ligne de MOITIÉ, et
 * chaque joueur changé en retirait 15 % : s'adapter à un adversaire pour un
 * soir coûtait des semaines. La chimie a maintenant deux sources, qui
 * s'apprennent en jouant et ne se perdent pas :
 *   - L'ENTENTE entre les joueurs (`team.entente`) : chaque paire de
 *     coéquipiers d'une même ligne compte ses matchs ensemble ; séparés puis
 *     réunis, ils retrouvent leur entente intacte.
 *   - LA MAÎTRISE d'une tactique (`p._maitrise`) : chaque joueur apprend
 *     chaque système à force de le jouer, et garde ce qu'il a appris.
 * La chimie d'une ligne vaut le plafond de son fit × la moyenne des deux.
 * Jouer un soir un système que la ligne connaît peu, c'est s'adapter — mais
 * pas complètement ; le lendemain, sa tactique habituelle a gardé toute sa
 * maîtrise, et la ligne a appris un peu de l'autre.
 */
/* MAITRISE_FIT : ce qu'une maîtrise complète ajoute au fit — plus une ligne joue un système, mieux elle le joue (S73). */
export const ENTENTE_MATCHS = 8, MAITRISE_PAS = 0.08, MAITRISE_FIT = 15;
/*
 * LE PLAFOND DE CHIMIE SUIT LE FIT, et il est RAIDE exprès : sous 35 % de fit
 * une ligne ne bâtit presque rien, à 60 % elle monte à 40, à 80 % à 72.
 */
export const chimieMax = fit => borne(1.6 * (fit - 35), 0, 100);
const cleDePaire = (a, b) => { const x = getPlayerKey(a), y = getPlayerKey(b); return x < y ? `${x}|${y}` : `${y}|${x}`; };
const joueursLigne = (lineup, u) => Object.values(joueursDeLigne(lineup, u)).filter(Boolean);
/*
 * L'APPRENTISSAGE d'une équipe, vivant (le moteur) ou photographié au début
 * d'une journée (l'écran) : l'entente des paires et la maîtrise de chacun.
 */
export function apprentissageDe(team) {
  return { entente: k => (team && team.entente && team.entente.get(k)) || 0, maitrise: p => (p && p._maitrise) || {} };
}
export function apprentissagePhoto(photo) {
  const e = (photo && photo.entente) || {}, m = (photo && photo.maitrise) || {};
  return { entente: k => e[k] || 0, maitrise: p => (p && m[getPlayerKey(p)]) || {} };
}
export function ententeLigne(app, lineup, u) {
  const js = joueursLigne(lineup, u);
  if (js.length < 2) return 0;
  let som = 0, n = 0;
  for (let i = 0; i < js.length; i++) for (let j = i + 1; j < js.length; j++) { som += 1 - Math.exp(-app.entente(cleDePaire(js[i], js[j])) / ENTENTE_MATCHS); n++; }
  return som / n;
}
/* Une ligne en systèmes : `{ tac, tacD }`, ou la clé seule d'un système de trio (l'écran d'avant S79). */
const systemesLigne = l => (typeof l === 'string' ? { tac: l, tacD: 'hourra' } : { tac: (l && l.tac) || 'hourra', tacD: (l && l.tacD) || 'hourra' });
/* La maîtrise d'une ligne : chaque avant dans le système du trio, chaque défenseur dans celui de la paire. */
export function maitriseLigne(app, lineup, u, l) {
  const { tac, tacD } = systemesLigne(l);
  const js = joueursDeLigne(lineup, u);
  let s = 0, n = 0;
  for (const [role, p] of Object.entries(js)) {
    if (!p) continue;
    const k = role === 'DG' || role === 'DD' ? tacD : tac;
    s += k && k !== 'hourra' ? (app.maitrise(p)[k] || 0) : 0; n++;
  }
  return n ? s / n : 0;
}
/* Le fit d'une ligne entière : son trio (trois postes) et sa paire (deux), chacun dans son système. */
export function fitDeLigne(lineup, u, l) {
  const { tac, tacD } = systemesLigne(l);
  const fF = tac !== 'hourra' ? fitUnite(lineup, 'F', u, tac) : 0;
  if (fF == null) return null;              // trio incomplet (J1-I)
  if (pairDeLigne(u) == null) return fF;
  const fD = tacD !== 'hourra' ? fitUnite(lineup, 'D', u, tacD) : 0;
  if (fD == null) return null;
  return Math.round((3 * fF + 2 * fD) / 5);
}
/* La chimie d'une ligne : le plafond de son fit × (entente + maîtrise) / 2. Sans aucun système, rien. */
export function chimieLigne(app, lineup, u, l) {
  const { tac, tacD } = systemesLigne(l);
  if (tac === 'hourra' && tacD === 'hourra') return 0;
  const fit = fitDeLigne(lineup, u, l);
  if (fit == null) return 0;                // ligne incomplète : pas de chimie à lire
  const m = maitriseLigne(app, lineup, u, l);
  return chimieMax(fit + MAITRISE_FIT * m + chimieDesBadges(lineup, u)) * (ententeLigne(app, lineup, u) + m) / 2;
}
/* Les passeurs et les manieurs d'une ligne (refonte 1) : elle joue son système plus haut — BADGE_CHIMIE de fit par Platine, centré sur la ligue. */
function chimieDesBadges(lineup, u) {
  return BADGE_CHIMIE * joueursLigne(lineup, u).reduce((a, p) => a + maitrise(p, 'passeur') + maitrise(p, 'manieur'), 0);
}
/* Après un match : chaque paire de coéquipiers et chaque joueur apprennent ce qu'ils ont joué ce soir-là. */
function majChimie(team, lineup) {
  team.entente = team.entente || new Map();
  const soir = lignesDe(team, lineup);
  for (let u = 0; u < 4; u++) {
    const js = joueursLigne(lineup, u);
    for (let i = 0; i < js.length; i++) for (let j = i + 1; j < js.length; j++) {
      const k = cleDePaire(js[i], js[j]);
      team.entente.set(k, (team.entente.get(k) || 0) + 1);
    }
    // Chaque avant apprend le système de son trio, chaque défenseur celui de sa paire.
    for (const [role, p] of Object.entries(joueursDeLigne(lineup, u))) {
      if (!p) continue;
      const k = role === 'DG' || role === 'DD' ? soir[u].tacD : soir[u].tac;
      if (!k || k === 'hourra') continue;
      p._maitrise = p._maitrise || {};
      p._maitrise[k] = (p._maitrise[k] || 0) + (1 - (p._maitrise[k] || 0)) * MAITRISE_PAS;
    }
  }
  // CHAQUE JOUEUR S'ADAPTE À SA CASE (S73).
  for (const s of SLOTS) {
    const p = s.scratch ? null : lineup[s.i];
    if (!p) continue;
    p._adapt = p._adapt || {};
    p._adapt[s.role] = (p._adapt[s.role] || 0) + 1;
  }
  // La chimie de la SAISON (les lignes réglées), pour l'écran et la suite.
  const saison = lignesDe(team, lineup, { duSoir: false });
  const app = apprentissageDe(team);
  team.chimie = [0, 1, 2, 3].map(u => chimieLigne(app, lineup, u, saison[u]));
}

/* ---------- l'action spéciale ---------- */
/*
 * À chaque lancer à forces égales d'une ligne qui a un système : une chance,
 * `SPEC_BASE` × sa chimie, que ce soit SON jeu — et ce lancer-là entre
 * `SPEC_MULT` fois plus souvent. Si la ligne qui défend joue la tactique qui
 * la contre, l'action est étouffée. `SPEC_NORME` ramène la ligue à ses buts
 * mesurés : les actions spéciales DÉPLACENT les buts vers les lignes bien
 * bâties, elles n'en créent pas.
 */
// SPEC_BASE recalé en S73 (0,45 → 0,22) : la chimie apprise se concentre sur les
// meilleures lignes, qui lancent le plus ; la part des actions spéciales revient à ~12 %.
// SPEC_NORME recalé en refonte 1 (0,90 → 0,88) : les passeurs et les manieurs montent la chimie (BADGE_CHIMIE),
// et une chimie ne descend pas sous zéro — la ligue gagnait 1,2 % de buts ; 12 ligues semées : 2,958 avant, 2,956 après.
export const SPEC_BASE = 0.22, SPEC_MULT = 1.8, SPEC_NORME = 0.88;

/* ---------- l'énergie : les JAMBES (1.0, C3) ---------- */
/*
 * Par joueur, sur 100, sur toute la saison. JP : *je veux variété de build*.
 * Les jambes sont le levier « profondeur contre vedettes » : pousser son
 * premier trio (plus de glace, une agressivité haute, un système qui use)
 * lui donne plus de lancers ce soir et lui coûte des jambes demain.
 *
 * L'USURE d'une unité par match suit sa PART DE GLACE (`partsDuRoulement` :
 * les secondes de présence, le roulement, les moments qui déplacent les
 * minutes, renormalisées), rapportée à la part moyenne — le 1er trio s'use
 * 1,36 fois la moyenne à 60 s, le 4e 0,64 fois —, multipliée par
 * l'agressivité, le prix du système et les effets qui portent `energie`
 * (l'importance du match, une carte, un patron).
 *
 * UN MATCH COÛTE `ENERGIE_C` × usure² (convexe : pousser coûte de plus en
 * plus) ; CHAQUE JOURNÉE rend la moitié de ce qui manque (`ENERGIE_RECUP`).
 * À l'équilibre, un matin vaut donc 100 − C × usure² : un 1er trio réglé par
 * défaut dort à 93, un 4e à 98 ; un 1er trio à 80 s, rentre-dedans, en
 * échec avant, un soir important, tombe vers 80. Une journée de congé
 * rend la moitié du manque de plus ; un repos (les gestes « énergie +N »)
 * rend des jambes, et ce qui dépasse 100 reste EN RÉSERVE : le prochain
 * match le brûle d'abord (`p._reserve`, au plus `RESERVE_MAX`).
 *
 * CE QUE ÇA COÛTE SUR LA GLACE : voir ENERGIE_REF juste dessous (plus de
 * seuil à 90 depuis 1.0). Sous `ENERGIE_BLESSURE` (60), il se blesse plus.
 */
/*
 * PLUS DE ZONE MORTE (1.0). JP : *faudrait des niveaux de fatigue pis pas de
 * cap à 90*. Le seuil à 90 rendait la fatigue invisible tant qu'on ne poussait
 * pas : trois trios sur quatre ne la sentaient jamais. Les jambes comptent
 * maintenant EN CONTINU, centrées sur `ENERGIE_REF` (94, les jambes d'une
 * ligne ordinaire au matin, `check_jambes`) : chaque point sous 94 coûte
 * `ENERGIE_EFFET` (0,5 %) de lancers, de finition et de création ; chaque
 * point au-dessus en rend autant, jusqu'à +3 % à 100. Centré, la ligue ne
 * bouge pas ; un joueur frais gagne, un joueur usé perd, tout de suite. Et
 * les jambes se LISENT en niveaux (`NIVEAUX_JAMBES`) : Frais, Correct, Lourd,
 * Vidé — le même mot dans la case, au banc et dans le direct.
 */
/* Une saison de la LNH : 82 matchs en 186 jours, environ un match aux 2,3 jours (`ceduleDe`). */
export const JOURS_PAR_MATCH = 186 / 82;
/*
 * LA RÉCUPÉRATION SE COMPTE PAR JOUR (1.0, oct., le vrai calendrier). D'un
 * match à l'autre, il passe en moyenne `JOURS_PAR_MATCH` jours ; chaque jour
 * rend `ENERGIE_RECUP_JOUR` du manque, réglé pour que cette moyenne rende la
 * même moitié qu'avant (`ENERGIE_RECUP`, que les séries gardent : un match
 * par soir de série). Donc l'équilibre ne bouge pas en moyenne, mais un
 * dos-à-dos ne rend qu'un quart du manque, et trois jours de congé les
 * six septièmes.
 */
export const ENERGIE_C = Number(ENV_MESURE.ENERGIE_C ?? 3.8), ENERGIE_RECUP = 0.5, ENERGIE_REF = 94,
  ENERGIE_EFFET = Number(ENV_MESURE.ENERGIE_EFFET ?? 0.5), ENERGIE_BLESSURE = 60, RESERVE_MAX = 30;
export const ENERGIE_RECUP_JOUR = 1 - (1 - ENERGIE_RECUP) ** (1 / JOURS_PAR_MATCH);
export const NIVEAUX_JAMBES = [
  { cle: 'frais', nom: 'Frais', min: 95 },
  { cle: 'correct', nom: 'Correct', min: 85 },
  { cle: 'lourd', nom: 'Lourd', min: 70 },
  { cle: 'vide', nom: 'Vidé', min: 0 },
];
export const niveauJambes = e => NIVEAUX_JAMBES.find(n => e >= n.min) || NIVEAUX_JAMBES[NIVEAUX_JAMBES.length - 1];
export const energieDe = p => (p && Number.isFinite(p.energie) ? p.energie : 100);
export const facteurEnergie = p => (neutrePour(p, 'jambes') ? 1 : 1 - ENERGIE_EFFET * (ENERGIE_REF - energieDe(p)) / 100);
/* Rendre des jambes : jusqu'à 100, et le surplus en réserve pour le prochain match. */
export function rendreJambes(p, n) {
  if (!p || !n) return;
  // Un gardien (C4) : ses jambes se comptent en départs ; un geste les prend ou les rend jusqu'à sa prochaine soirée de congé.
  if (p.p === 'G') { p._aine = Math.max(0, Math.min(100 - GARDIEN_JAMBES_MIN, (p._aine || 0) - n)); return; }
  const e = energieDe(p) + n;
  if (n < 0) { p.energie = Math.max(0, e); return; }
  p.energie = Math.min(100, e);
  if (e > 100) p._reserve = Math.min(RESERVE_MAX, (p._reserve || 0) + (e - 100));
}
/* L'usure par match d'une unité (1 = la part de glace moyenne, défaut). */
function usureLigne(l, part, partMoy, groupe = 'F') {
  const S = groupe === 'D' ? SYSTEMES_D[l.tacD] : TACTIQUES[l.tac];
  const prix = S && S.prix && S.prix.energie ? S.prix.energie : 1;
  return (part / (partMoy || part || 1)) * AGRESSIVITES[l.agr].energie * prix;
}
/* Le multiplicateur d'usure des effets, des cartes de saison et des patrons. */
function kUsure(team) {
  const src = [...effetsActifs(team), ...((team && team.patrons) || []), ...coachsJoues(team), ...((team && team.cartes) || []).map(c => CARTES[c])];
  return src.reduce((a, x) => a * ((x && x.energie) || 1), 1);
}
/* L'usure de chaque ligne ce soir : { F: [4], D: [3] }. */
export function usuresDe(team, lineup) {
  const lignes = lignesDe(team, lineup);
  const pF = partsDuRoulement(POIDS_TRIO, 'F', team), pD = partsDuRoulement(POIDS_PAIRE, 'D', team);
  const mF = pF.reduce((a, b) => a + b, 0) / pF.length, mD = pD.reduce((a, b) => a + b, 0) / pD.length;
  const k = kUsure(team);
  return {
    F: [0, 1, 2, 3].map(u => usureLigne(lignes[u], pF[u], mF, 'F') * k),
    D: [0, 1, 2].map(u => usureLigne(lignes[u], pD[u], mD, 'D') * k),
  };
}
/* Les jambes qu'une ligne aurait au matin, à l'équilibre, jouée ainsi tous les soirs. */
export const jambesEquilibre = us => Math.max(0, Math.min(100, 100 - ENERGIE_C * us * us));
/* L'usure des présences d'un soir, présence par présence (avant la réserve) : la seule formule, que `depenserEnergie` applique. */
function coutsDuSoir(team, lineup) {
  const us = usuresDe(team, lineup), out = [];
  for (let u = 0; u < 4; u++) {
    for (const [role, p] of Object.entries(joueursDeLigne(lineup, u))) {
      if (!p) continue;
      const d = role === 'DG' || role === 'DD';
      let cout = ENERGIE_C * Math.pow(d ? us.D[pairDeLigne(u)] : us.F[u], 2);
      // Le plombier maîtrisé (EFFET_ROLE.energie) : son match lui coûte moins.
      if (!d) cout *= 1 - EFFET_ROLE.energie * maitrise(p, 'energie');
      out.push([p, cout]);
    }
  }
  return out;
}
export function depenserEnergie(team, lineup) {
  for (const [p, c] of coutsDuSoir(team, lineup)) {
    let cout = c;
    if (p._reserve) { const r = Math.min(p._reserve, cout); p._reserve -= r; cout -= r; }
    p.energie = Math.max(0, energieDe(p) - cout);
  }
}
export function recupererEnergie(team, part = ENERGIE_RECUP) {
  for (const s of SLOTS) {
    const p = team.roster[s.i];
    if (p) p.energie = Math.min(100, energieDe(p) + part * (100 - energieDe(p)));
  }
}

/* =====================================================================
   LES MOMENTS (S66) — des choix courts, forcés ou offerts, qui durent
   quelques matchs

   JP : *choix « forcés » à des moments X. Stratégies par match/adversaire,
   jeux de trios selon séquences, etc. Plus de trucs possibles, mais
   simples, et le fun* ; puis *utiliser trucs drôles ou marquants arrivés
   IRL pour les choix, et quelques uns inventés*.

   Quatre familles, une seule mécanique : UN EFFET TEMPORAIRE (`team.effets`,
   `{ debut, fin, ...canaux }`), posé par une décision au jour où on la prend
   et lu par `effetsDeSaison` tant que le jour courant est dans la fenêtre.
   Les canaux sont ceux des cartes (finition, défensive, volume, blessures,
   robustesse, discipline) plus les minutes des unités (`F`, `D`, comme un
   roulement). Aucune mécanique neuve, aucune cote neuve.

     LE PLAN DU SOIR   un plan de match pour UN match, contre un adversaire
                       dont on lit le style ; le bon contre-plan paie
     LES DILEMMES      à quatre journées fixes, une histoire et deux options,
                       et on ne continue pas sans choisir
     LES SÉQUENCES     trois défaites de suite, ou quatre victoires : on
                       touche aux trios, et on ne continue pas sans choisir
     LES OBJECTIFS     le proprio propose trois défis ; réussi, on pige une
                       carte de plus (la mécanique des paliers)

   ET TOUT SE REJOUE. Ce sont des décisions : elles vivent dans la
   sauvegarde et la saison se rejoue de la graine avec elles. Les tirages
   (quel dilemme, quels objectifs) sont PURS — graine et jour, jamais
   `hasard()` — comme la main des cartes.
   ===================================================================== */

/** Les effets temporaires actifs au jour courant de l'équipe. */
export function effetsActifs(team) {
  const j = team && team.jourCourant;
  // En séries, seule la consigne du match qui vient joue (S69).
  const duMatch = (team && team._effetMatch) || [];
  if (j === Infinity) return [...((team && team.effetsSerie) || []), ...duMatch];
  if (j === undefined || j === null || !team.effets || !team.effets.length) return duMatch;
  return [...team.effets.filter(x => j >= x.debut && j < x.fin), ...duMatch];
}

/*
 * LE STYLE D'UNE ÉQUIPE : ce qu'elle a de plus fort par rapport au reste de la
 * ligue — son attaque, sa brigade ou sa robustesse — mesuré en écarts à la
 * moyenne des clubs de la ligue, à pleine santé. Il est posé une fois par
 * saison (`poserStyles`), sans hasard, donc l'écran lit exactement ce que le
 * moteur jouera. Ce n'est pas une cote : c'est un mot, comme l'archétype.
 */
export const STYLES = {
  offensif: { nom: 'Offensif', ico: '🎯', mot: 'Ils marquent beaucoup', contre: 'trappe' },
  defensif: { nom: 'Défensif', ico: '🧱', mot: 'Ils ferment le jeu', contre: 'echec' },
  robuste: { nom: 'Robuste', ico: '🥊', mot: 'Ils frappent tout ce qui bouge', contre: 'surnombre' },
  equilibre: { nom: 'Équilibré', ico: '⚖️', mot: 'Rien ne dépasse', contre: null },
};
const STYLE_SEUIL = 0.35;

function poserStyles(teams) {
  const forces = teams.map(t => t.strength || teamStrength(t));
  const axes = [['offensif', 'att'], ['defensif', 'def'], ['robuste', 'rob']];
  const stats = axes.map(([, k]) => {
    const v = forces.map(f => f[k]);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
    return { m, s };
  });
  teams.forEach((t, i) => {
    let best = 'equilibre', z = STYLE_SEUIL;
    axes.forEach(([nom, k], a) => {
      const zz = (forces[i][k] - stats[a].m) / stats[a].s;
      if (zz > z) { z = zz; best = nom; }
    });
    t.style = best;
  });
}

/*
 * LES DILEMMES. Des histoires vraies de la LNH — drôles, marquantes, parfois
 * tragiques — et quelques-unes inventées. Chaque option achète quelque chose
 * et le paie ; aucune n'est gratuite, et `check_moments.mjs` mesure qu'aucune
 * ne vaut une victoire à elle seule. La durée est en journées.
 */
const DUREE_MOMENT = 10;
/*
 * LES DILEMMES (S66, refaits en S72). JP : *les choix, pas obligé d'être
 * toujours avec un malus et un bonus, varie les « cartes »* ; *mettons que tu
 * rappelles des joueurs du club-école, ou whatever ce genre de cartes, faut
 * le faire pour vrai*. Une option peut être :
 *   - un CADEAU (un bonus seul), ou deux cadeaux — lequel prendre ;
 *   - un MOINDRE MAL (les deux options coûtent) ;
 *   - un PARI (`pari` : une chance, ce qu'on gagne, ce qu'on perd — tiré de la
 *     graine, sans consommer un dé) ;
 *   - un INVESTISSEMENT (`ensuite` : un effet qui arrive plus tard) ;
 *   - un GESTE RÉEL sur un joueur NOMMÉ (`cible` du dilemme, `action` de
 *     l'option) : il reste au vestiaire et un réserviste — ou un rappelé du
 *     club-école — joue à sa place (`absents`), il joue épuisé (`energie`),
 *     ou le gardien auxiliaire prend le filet (`gardienAux`) ;
 *   - un changement de carte (`mutation`, S68) ;
 *   - rien (`rien`), quand refuser est un vrai choix.
 * Plus de factions (S72) : ce qu'une option coûte ou rapporte se joue sur la
 * glace.
 */
export const MOMENTS = {
  pieuvre: {
    ico: '🐙', titre: 'Une pieuvre sur la glace', irl: 'Détroit, 1952',
    recit: 'Un partisan lance une pieuvre sur la glace après ton but. L\'aréna devient fou. Deux bonnes nouvelles : laquelle tu prends ?',
    // S80 : ton dernier match, chez toi, avec au moins un but.
    faits: c => (c.dernier && c.dernier.domicile && c.dernier.pour >= 1 ? {} : null),
    options: [
      { cle: 'tradition', nom: 'En faire une tradition', bon: 'La foule pousse, ça rentre', finition: 1.088, duree: 6 },
      { cle: 'calme', nom: 'Remercier la foule, garder la tête froide', bon: 'Une équipe disciplinée', discipline: 0.81, duree: 6 },
    ],
  },
  rats: {
    ico: '🐀', titre: 'Le rat du vestiaire', irl: 'Floride, 1996',
    recit: '{nom} écrase un rat dans le vestiaire avant le match, puis marque {n} buts. Les partisans lancent des rats en plastique.',
    // S80 : un de tes avants a vraiment marqué deux buts ou plus à ton dernier match.
    faits: c => { const x = c.dernier && c.dernier.buteurs.filter(b => b.avant && b.buts >= 2).sort((a, b) => b.buts - a.buts)[0]; return x ? { joueur: x.p, n: x.buts } : null; },
    options: [
      { cle: 'mascotte', nom: 'Adopter la mascotte', bon: 'Si le rat porte chance, ça rentre de partout', prix: 'Sinon, la glace est jonchée de rats et l\'arbitre perd patience',
        pari: { chance: 0.5, gagne: { finition: 1.125, duree: 6 }, perd: { discipline: 1.288, duree: 6 } } },
      { cle: 'serieux', nom: 'Rester sérieux', bon: 'Une défensive concentrée', defense: 0.92, duree: 6 },
    ],
  },
  dernier: {
    ico: '🧳', titre: '« C\'est mon dernier match ici »', irl: 'Montréal, 1995', cible: 'gardien',
    recit: 'Laissé devant le filet pour {n} buts, {nom} passe devant le banc et lance au président qu\'il a joué son dernier match ici.',
    // S80 : ton gardien a vraiment accordé six buts ou plus à ton dernier match (JP : *après neuf buts encaissés… faut que ça soit arrivé pour vrai*).
    faits: c => (c.dernier && c.dernier.gardien && c.dernier.contre >= 6 ? { joueur: c.dernier.gardien, n: c.dernier.contre } : null),
    options: [
      { cle: 'reposer', nom: 'Le reposer trois matchs', bon: 'Ton auxiliaire prend le filet, {nom} revient la tête froide', prix: 'Trois matchs sans ton partant',
        action: { gardienAux: 3 }, ensuite: { apres: 3, duree: 8, defense: 0.92 } },
      { cle: 'soutenir', nom: 'Le renvoyer dans la mêlée', bon: 'Il veut se venger', prix: 'S\'il craque encore, ça coule',
        pari: { chance: 0.5, gagne: { defense: 0.89, duree: 5 }, perd: { defense: 1.11, duree: 5 } } },
    ],
  },
  tropdejoueurs: {
    ico: '🧢', titre: 'Trop de joueurs sur la glace', irl: 'Boston, 1979',
    recit: 'Ton banc s\'emmêle dans un changement en fin de match : six patineurs sur la glace, et la punition tombe dans les dernières minutes.',
    // S80 : une punition à toi dans les cinq dernières minutes de ton dernier match.
    faits: c => (c.dernier && c.dernier.punitionsTard >= 1 ? {} : null),
    options: [
      { cle: 'simplifier', nom: 'Simplifier les changements', bon: 'Plus de fautes bêtes', prix: 'Des présences plus longues, moins de jus', discipline: 0.788, volume: 0.913 },
      { cle: 'rythme', nom: 'Garder le rythme rapide', bon: 'Des jambes fraîches, plus de lancers', prix: 'Ça va se reproduire', volume: 1.095, discipline: 1.213 },
    ],
  },
  zamboni: {
    ico: '🚜', titre: 'Le conducteur de surfaceuse', irl: 'Toronto, 2020', cible: 'gardien',
    recit: 'Le gardien d\'urgence de l\'aréna, le conducteur de la surfaceuse, 42 ans, a gagné un match dans la LNH. {nom} dit qu\'il pourrait prendre une soirée de congé, lui aussi.',
    options: [
      { cle: 'conge', nom: 'Donner deux matchs de congé à {nom}', bon: 'Il revient reposé', prix: 'Deux matchs avec l\'auxiliaire',
        action: { gardienAux: 2 }, ensuite: { apres: 2, duree: 10, defense: 0.94 } },
      { cle: 'legende', nom: 'Inviter le conducteur au vestiaire', bon: 'Le vestiaire rit, la pression tombe', finition: 1.08, duree: 5 },
    ],
  },
  richard: {
    ico: '🔥', titre: 'La ville gronde', irl: 'Montréal, 1955', cible: 'vedette',
    recit: '{nom} écope d\'une suspension que la ville juge injuste. Des partisans promettent de descendre dans la rue.',
    options: [
      { cle: 'purger', nom: 'Purger la suspension sans faire de vagues', bon: 'La ligue te laisse tranquille', prix: '{nom} manque deux matchs, un réserviste joue',
        action: { absents: 2 }, discipline: 0.825, duree: 6 },
      { cle: 'defendre', nom: 'Contester en public', bon: 'Si la ligue recule, {nom} joue et la ville explose de joie', prix: 'Sinon, il manque quatre matchs',
        pari: { chance: 2 / 6, gagne: { finition: 1.095, duree: 6 }, perd: { action: { absents: 4 } } } },
    ],
  },
  malarchuk: {
    ico: '🕯️', titre: 'Un accident terrible', irl: 'Buffalo, 1989', cible: 'gardien',
    recit: 'Un patin tranche la gorge de {nom} pendant le match. Il survit grâce au soigneur, mais les deux vestiaires sont sous le choc. Aucun bon choix ici.',
    // S80 : ton gardien s\'est vraiment blessé à ton dernier match.
    faits: c => (c.dernier && c.dernier.gardienBlesse ? { joueur: c.dernier.gardienBlesse } : null),
    options: [
      { cle: 'temps', nom: 'Lui donner tout le temps qu\'il faut', bon: 'Il revient quand il est prêt', prix: 'Cinq matchs avec l\'auxiliaire',
        action: { absents: 5 } },
      { cle: 'pourlui', nom: 'Jouer pour lui', bon: 'Tout le monde se donne', prix: 'On joue sur les nerfs : ça fait mal', finition: 1.08, blessure: 1.5, duree: 6 },
    ],
  },
  lemieux: {
    ico: '💪', titre: 'Le traitement du matin', irl: 'Pittsburgh, 1993', cible: 'vedette',
    recit: '{nom} termine sa dernière séance de radiothérapie ce matin. Il veut jouer ce soir.',
    options: [
      { cle: 'jouer', nom: 'Il joue', bon: 'Le vestiaire est galvanisé', prix: '{nom} joue épuisé', action: { energie: -35 }, finition: 1.095, duree: 3 },
      { cle: 'menager', nom: 'Deux matchs de repos', bon: '{nom} revient frais', prix: 'Deux matchs sans lui, un réserviste joue', action: { absents: 2 } },
    ],
  },
  echange: {
    ico: '📞', titre: 'Les rumeurs d\'échange', irl: 'Edmonton, 1988', cible: 'vedette',
    recit: 'Un journaliste annonce que {nom} va être échangé à Los Angeles. Il n\'en sait rien.',
    options: [
      { cle: 'dementir', nom: 'Démentir tout de suite', bon: '{nom} respire', defense: 0.92, duree: 6 },
      { cle: 'planer', nom: 'Laisser planer le doute', bon: 'S\'il se sent menacé, il se défonce', prix: 'S\'il se sent trahi, il boude',
        pari: { chance: 0.5, gagne: { volume: 1.11, duree: 8 }, perd: { finition: 0.905, duree: 8 } } },
    ],
  },
  hextall: {
    ico: '🥅', titre: 'Le gardien veut marquer', irl: 'Philadelphie, 1987', cible: 'gardien',
    recit: '{nom} est convaincu qu\'il peut marquer dans le filet désert. Il sort jouer la rondelle à chaque occasion.',
    options: [
      { cle: 'laisser', nom: 'Le laisser essayer', bon: 'Une chance sur trois : il marque et l\'équipe s\'envole', prix: 'Sinon, il se fait prendre hors de son filet',
        pari: { chance: 2 / 6, gagne: { finition: 1.11, duree: 6 }, perd: { defense: 1.088, duree: 4 } } },
      { cle: 'filet', nom: 'Qu\'il reste dans son filet', bon: 'Un gardien concentré', defense: 0.94, duree: 5 },
    ],
  },
  avery: {
    ico: '🎭', titre: 'L\'agitateur', irl: 'New York, 2008', cible: 'dur',
    recit: '{nom} se plante devant le gardien adverse, dos au jeu, et agite son bâton devant son masque. La ligue écrit une règle le lendemain.',
    options: [
      { cle: 'laisser', nom: 'Le laisser faire', bon: 'Il les rend fous', prix: 'L\'arbitre le guette', finition: 1.095, discipline: 1.3 },
      { cle: 'galerie', nom: 'Deux matchs sur la galerie de presse', bon: 'Le message passe : discipline', prix: '{nom} regarde de là-haut, un réserviste joue',
        action: { absents: 2 }, discipline: 0.788, duree: 6 },
    ],
  },
  commotion: {
    ico: '🤕', titre: 'Un coup à la tête', irl: 'Pittsburgh, 2011', cible: 'vedette',
    recit: '{nom} a pris deux coups à la tête en quatre jours. Il dit qu\'il se sent bien.',
    options: [
      { cle: 'menager', nom: 'Le protocole, quatre matchs', bon: 'Aucun risque', prix: '{nom} manque quatre matchs, un réserviste joue', action: { absents: 4 } },
      { cle: 'jouer', nom: 'Le croire', bon: 'Deux fois sur trois, il a raison', prix: 'Sinon, il manque dix matchs',
        pari: { chance: 4 / 6, gagne: {}, perd: { action: { absents: 10 } } } },
    ],
  },
  tortorella: {
    ico: '🎙️', titre: 'L\'entraîneur pète une coche', irl: 'Inspiré de plusieurs points de presse',
    recit: 'Ton entraîneur insulte un journaliste en direct et promet que « ça va changer ». La vidéo fait le tour du continent.',
    options: [
      { cle: 'appuyer', nom: 'L\'appuyer', bon: 'Si le vestiaire embarque, ça brasse', prix: 'Sinon, ça dégénère en punitions',
        pari: { chance: 0.5, gagne: { volume: 1.11, duree: 8 }, perd: { discipline: 1.288, duree: 8 } } },
      { cle: 'recadrer', nom: 'Le recadrer', bon: 'On revient au système', prix: 'Moins d\'intensité', defense: 0.913, volume: 0.913 },
    ],
  },
  tempete: {
    ico: '🌨️', titre: 'La tempête de neige', irl: 'Buffalo, 2014',
    recit: 'Deux mètres de neige. L\'avion ne décolle pas, et le match est dans deux jours à l\'autre bout du continent. Les deux options font mal : laquelle moins ?',
    options: [
      { cle: 'autobus', nom: 'Vingt heures d\'autobus', prix: 'Toute l\'équipe arrive épuisée', action: { energieTous: -15 } },
      { cle: 'attendre', nom: 'Attendre l\'avion à l\'hôtel', prix: 'On arrive le matin du match, sans réchauffement', finition: 0.913, volume: 0.913, duree: 3 },
    ],
  },
  barbe: {
    ico: '🧔', titre: 'La barbe porte-bonheur', irl: null,
    recit: '{n} victoires de suite. Les vétérans refusent de se raser tant que la séquence dure. Le capitaine a l\'air d\'un trappeur.',
    // S80 : une vraie séquence de trois victoires ou plus.
    faits: c => (c.serieV >= 3 ? { n: c.serieV } : null),
    options: [
      { cle: 'pousser', nom: 'Laisser pousser', bon: 'Dans cinq matchs, la barbe fait peur à tout le monde', ensuite: { apres: 5, duree: 10, finition: 1.08 } },
      { cle: 'raser', nom: 'Raser tout le monde ce soir', bon: 'Un vestiaire propre et motivé', finition: 1.06, duree: 5 },
    ],
  },
  film: {
    ico: '🎬', titre: 'Un film dans ton aréna', irl: null,
    recit: 'Un studio veut tourner une comédie de hockey dans ton aréna. Les caméras suivraient l\'équipe pendant dix jours.',
    options: [
      { cle: 'accepter', nom: 'Accepter', bon: 'Des gars qui se prennent pour des vedettes : ils lancent de partout', prix: 'Des pratiques écourtées', volume: 1.095, energie: 1.192, duree: 8 },
      { cle: 'refuser', nom: 'Refuser', bon: 'Rien ne change', rien: true },
    ],
  },
  baton: {
    ico: '🏒', titre: 'Le bâton maudit', irl: null, cible: 'vedette',
    recit: '{nom} jure que son nouveau modèle de bâton lui porte malheur. Il a {n} en {m} matchs.',
    // S80 : un vrai marqueur (25 buts et plus dans sa vraie saison) qui n'a presque rien marqué chez toi ces derniers matchs.
    faits: c => {
      const x = c.joueurs.filter(j => j.marqueur && c.recents >= 10 && j.butsRecents <= 2).sort((a, b) => (b.p.g || 0) - (a.p.g || 0))[0];
      if (!x) return null;
      return { joueur: x.p, n: x.butsRecents === 0 ? 'aucun but' : x.butsRecents === 1 ? 'un seul but' : `${x.butsRecents} buts`, m: c.recents };
    },
    options: [
      { cle: 'ancien', nom: 'Ressortir ses vieux bâtons', bon: 'Si c\'était bien le bâton, ça rentre', prix: 'Sinon, rien ne change et il le sait',
        pari: { chance: 0.5, gagne: { finition: 1.11, duree: 8 }, perd: { finition: 0.94, duree: 4 } } },
      { cle: 'travail', nom: 'Le travail, pas la magie', bon: 'On lance plus', volume: 1.08, duree: 6 },
    ],
  },
  poutine: {
    ico: '🍟', titre: 'La poutine d\'après-match', irl: null,
    recit: 'Un restaurateur offre la poutine à vie à l\'équipe. Les gars y vont tous les soirs.',
    options: [
      { cle: 'fete', nom: 'Laisser faire', bon: 'Le moral est au plafond', prix: 'Les jambes, moins', finition: 1.088, energie: 1.192, duree: 8 },
      { cle: 'diete', nom: 'Diète de séries dès maintenant', bon: 'Dans cinq matchs, des jambes neuves', prix: 'D\'ici là, ça grogne',
        finition: 0.94, duree: 5, ensuite: { apres: 5, duree: 12, energie: 0.76 } },
    ],
  },
  /*
   * LES DILEMMES QUI CHANGENT UNE CARTE (S68). Le joueur visé est nommé avant
   * le choix (`{nom}` dans le texte, résolu par `cibleMutation`), et l'option
   * qui porte `mutation` le change pour le reste de la saison.
   */
  camp: {
    ico: '🏕️', titre: 'Le camp de mi-saison', irl: null,
    recit: 'La pause du Match des étoiles : trois jours d\'entraînement. Qui travaille quoi ?',
    // S80 : à la mi-saison seulement, quand la pause arrive vraiment.
    faits: c => (c.J >= 38 && c.J <= 55 ? {} : null),
    options: [
      { cle: 'gun', nom: 'Envoyer {nom} tirer du gun', mutation: 'tir_gun', bon: 'Ton plombier apprend à viser', prix: 'Trois jours sans repos pour les autres', blessure: 1.24 },
      { cle: 'repos', nom: 'Repos pour tout le monde', bon: 'Des jambes neuves', blessure: 0.5 },
    ],
  },
  lame: {
    ico: '🏒', titre: 'La lame qui ne se fait plus', irl: null,
    recit: 'Le fabricant arrête le modèle de lame de {nom}. Rien d\'autre ne lui convient : il ne sent plus sa rondelle.',
    options: [
      { cle: 'defensif', nom: 'En faire un joueur défensif', mutation: 'lame', bon: 'Il devient fiable sans la rondelle', prix: 'Ton meilleur tireur ne marquera plus' },
      { cle: 'marche', nom: 'Chercher la lame au marché noir', bon: 'Il reste lui-même', prix: 'Des lames refaites à la main : ça casse', finition: 0.913 },
    ],
  },
  patinage: {
    ico: '⛸️', titre: 'L\'entraîneur de patinage', irl: null,
    recit: 'Une ancienne patineuse olympique offre ses services pour la saison. Elle ne prend qu\'un élève : {nom}.',
    options: [
      { cle: 'oui', nom: 'Oui, pour {nom}', mutation: 'patin', bon: 'Il arrivera avant la rondelle' },
      { cle: 'non', nom: 'Non : l\'argent va à la physio', bon: 'Des jambes neuves pour tout le monde', energie: 0.872, duree: 6 },
    ],
  },
  cassettes: {
    ico: '📼', titre: 'Les cassettes de Gretzky', irl: null,
    recit: '{nom} a trouvé une boîte de vieilles cassettes dans le sous-sol de l\'aréna. Il veut passer ses soirées à les étudier.',
    options: [
      { cle: 'etudier', nom: 'Qu\'il étudie', mutation: 'video', bon: 'Il verra le jeu une passe d\'avance', prix: 'Il tirera moins lui-même' },
      { cle: 'dormir', nom: 'Qu\'il dorme', bon: 'Frais pour le prochain match', volume: 1.06 },
    ],
  },
  pointe: {
    ico: '💣', titre: 'La pointe de l\'avantage', irl: null,
    recit: '{nom} demande sa chance à la ligne bleue en avantage numérique. Il jure qu\'il a un canon.',
    options: [
      { cle: 'chance', nom: 'Lui donner la pointe', mutation: 'pointe', bon: 'Un défenseur qui décoche' },
      { cle: 'attendre', nom: 'Qu\'il attende son tour', bon: 'Il travaille sa défensive en attendant', defense: 0.94, duree: 6 },
    ],
  },
  ecole: {
    ico: '🧓', titre: 'L\'école du vétéran', irl: null,
    recit: '{vieux}, ton vieux défenseur, prend sa retraite dans deux ans. Il propose de prendre {nom} sous son aile.',
    // S80 : tu as vraiment un défenseur de 33 ans ou plus.
    faits: c => (c.veteransD.length ? { vieux: c.veteransD[0].n } : null),
    options: [
      { cle: 'oui', nom: 'Qu\'il lui apprenne à défendre', mutation: 'dur', bon: '{nom} ne montera plus, il bloquera', prix: 'Moins de premières passes' },
      { cle: 'non', nom: '{nom} garde son style', bon: 'Rien ne change', rien: true },
    ],
  },
  /*
   * CONTOURNER LE RÈGLEMENT (JP). Pas un cadeau : chaque trou dans le livre
   * a son prix, sur les canaux qui existent déjà. La courbe, le trapèze,
   * l'embellissement, le filet désert, l'obstruction, les minutes de trop.
   */
  courbe: {
    ico: '📏', titre: 'La courbe illégale', irl: 'La LNH mesure les courbes depuis 1990', regle: true,
    recit: 'Le préposé à l\'équipement te tend un bâton. La courbe dépasse le gabarit, « juste assez pour que le tir tombe ».',
    options: [
      { cle: 'laisser', nom: 'Laisser la courbe', bon: 'Une chance sur deux : le tir trompe', prix: 'Sinon, l\'arbitre sort le gabarit',
        pari: { chance: 0.5, gagne: { finition: 1.095, duree: 6 }, perd: { discipline: 1.265, duree: 6 } }, trou: true },
      { cle: 'mesurer', nom: 'Tout passer au gabarit', bon: 'Moins de punitions bêtes', prix: 'Des lancers plus honnêtes, donc moins dangereux', discipline: 0.825, volume: 0.94, duree: 6 },
    ],
  },
  trapeze: {
    ico: '🥅', titre: 'Hors du trapèze', irl: 'Martin Brodeur, avant la règle de 2005', cible: 'gardien', regle: true,
    recit: '{nom} joue la rondelle partout derrière le filet. La règle qui l\'en empêchera n\'est pas encore écrite — ou tu fais comme si.',
    options: [
      { cle: 'sortir', nom: 'Le laisser sortir', bon: 'Il coupe les jeux avant qu\'ils naissent', prix: 'Il se fait prendre, et l\'arbitre s\'en mêle', defense: 0.92, discipline: 1.19, duree: 6, trou: true },
      { cle: 'filet', nom: 'Le garder dans la peinture', bon: 'Un gardien à sa place', defense: 0.96, duree: 5 },
    ],
  },
  embellir: {
    ico: '🎭', titre: 'L\'embellissement', irl: null, regle: true,
    recit: 'Ton ailier sait tomber. Un mot de trop après le contact, et l\'arbitre lève le bras. La ligue, elle, regarde les reprises.',
    options: [
      { cle: 'plonger', nom: 'Le laisser vendre le contact', bon: 'Sur un 5 ou un 6, la punition tombe de ton côté', prix: 'Le reste du temps, c\'est toi qu\'on siffle',
        pari: { chance: 2 / 6, gagne: { finition: 1.088, duree: 5 }, perd: { discipline: 1.288, duree: 8 } }, trou: true },
      { cle: 'debout', nom: 'Rester debout', bon: 'Une réputation propre', discipline: 0.825, duree: 6 },
    ],
  },
  desert: {
    ico: '🚪', titre: 'Le gardien sort trop tôt', irl: null, regle: true,
    recit: 'Il reste dix minutes. Le banc veut déjà le sixième attaquant. Ce n\'est pas le moment, et tout le monde le sait.',
    options: [
      { cle: 'sortir', nom: 'Le sortir quand même', bon: 'Un attaquant de plus, longtemps', prix: 'Le filet est vide bien trop tôt', volume: 1.095, defense: 1.095, duree: 4, trou: true },
      { cle: 'attendre', nom: 'Attendre la dernière minute', bon: 'On ne donne pas le filet', defense: 0.96, duree: 4 },
    ],
  },
  mort: {
    ico: '🪝', titre: 'Le hockey qu\'on a interdit', irl: 'La règle de l\'obstruction, 2005', regle: true,
    recit: 'Tes vétérans veulent le hockey d\'avant : accrocher dans les coins, retenir le bâton, tuer le jeu au centre. La ligue a écrit une règle contre ça.',
    options: [
      { cle: 'accrocher', nom: 'Jouer comme en 1998', bon: 'Presque rien ne passe', prix: 'Tu ne tires plus, et les punitions s\'accumulent', defense: 0.913, volume: 0.913, discipline: 1.19, duree: 8, trou: true },
      { cle: 'aujourd', nom: 'Jouer le hockey d\'aujourd\'hui', bon: 'De l\'espace, des lancers', prix: 'Des trous derrière', volume: 1.08, defense: 1.06, duree: 6 },
    ],
  },
  minutes: {
    ico: '⏱️', titre: 'La paire qui ne descend plus', irl: null, regle: true,
    recit: 'Le règlement ne limite pas les minutes. Ton adjoint, lui, dit que vingt-huit minutes par défenseur, c\'est déjà trop.',
    options: [
      { cle: 'doubler', nom: 'Les laisser sur la glace', bon: 'Ta première paire joue le gros des soirs', prix: 'Elle finit à plat, et la troisième ne joue plus', D: [1.22, 1, 0.72], blessure: 1.32, energie: 1.128, duree: 6, trou: true },
      { cle: 'roulement', nom: 'Respecter le roulement', bon: 'Les corps tiennent', prix: 'Un peu moins de lancers', blessure: 0.76, volume: 0.96, duree: 6 },
    ],
  },
  ...MOMENTS_VIE,
};

/*
 * LA FAMILLE D'UNE DÉCISION DE MOMENT : un dilemme (`moment`), une séquence, ou la réponse à un courriel ou
 * à un point de presse (`vie`, js/vie-gm.js). Les trois ont la même forme { ico, titre, options } et passent
 * par les mêmes fonctions : `effetDeMoment`, `appliquerGestes`, `pariDeDecision`.
 */
export const familleDeMoment = m => (m.famille === 'sequence' ? SEQUENCES[m.cle] : m.famille === 'vie' ? REPONSES_VIE[m.cle] : MOMENTS[m.cle]);

export const JOURS_MOMENTS = [14, 25, 33, 51, 60, 70];
/* Le dilemme d'une journée : PUR, graine et jour, jamais deux fois le même. */
/*
 * `faits` (S80) : ce qui est VRAIMENT arrivé avant la journée du dilemme (tes matchs, ta
 * séquence, tes joueurs). Un dilemme qui affirme un fait de match ne se tire que si ce fait
 * est vrai (`MOMENTS[c].faits`) ; sans faits (une vérification en Node), il ne se tire pas.
 */
export function momentDuJour(graine, jour, deja = [], faits = null) {
  const cles = Object.keys(MOMENTS).filter(c => !deja.includes(c) && (!MOMENTS[c].faits || (faits && MOMENTS[c].faits(faits))));
  if (!cles.length) return null;
  let x = ((Number(graine) >>> 0) ^ (jour * 0x85ebca6b) ^ 0x5bd1e995) >>> 0;
  x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
  // On tire parmi ce qui reste en retirant les déjà vus AVANT le tirage : deux
  // dilemmes d'une même partie ne se ressemblent jamais.
  return cles[x % cles.length];
}

/*
 * LES SÉQUENCES, et elles touchent aux TRIOS. Trois défaites de suite, ou
 * quatre victoires : le vestiaire attend quelque chose de toi. Les options
 * déplacent les minutes (`F`, `D`) comme un roulement, pour quelques matchs.
 */
export const SEQUENCES = {
  defaites: {
    ico: '📉', titre: 'Trois défaites de suite', seuil: 3,
    recit: 'Le vestiaire est à plat. Les journalistes demandent si ton poste est menacé.',
    options: [
      { cle: 'brasser', nom: 'Donner la glace au bas de l\'alignement', bon: 'Le choc : les 2e, 3e et 4e trios jouent plus', prix: 'Ton premier trio joue moins', F: [0.9, 1.05, 1.08, 1.05], volume: 1.095 },
      { cle: 'cap', nom: 'Garder le cap', bon: 'La structure revient', defense: 0.913 },
      { cle: 'huis', nom: 'Pratique à huis clos', bon: 'Si les jambes suivent, on redevient une équipe physique', prix: 'Sinon, des corps fatigués',
        pari: { chance: 0.5, gagne: { robustesse: 1.95, duree: 8 }, perd: { blessure: 1.5, duree: 8 } } },
      { cle: 'briser', nom: 'Briser le règlement', bon: 'On accroche, on retient, on ferme les espaces', prix: 'Les punitions et les blessures suivent', defense: 0.875, discipline: 1.235, blessure: 1.24, trou: true },
    ],
  },
  victoires: {
    ico: '📈', titre: 'Quatre victoires de suite', seuil: 4,
    recit: 'Tout roule. Ton premier trio ne rate plus rien.',
    options: [
      { cle: 'doubler', nom: 'Doubler le trio en feu', bon: 'Ton premier trio joue encore plus', prix: 'Il s\'use, et le 4e rouille', F: [1.25, 1.02, 0.95, 0.72], blessure: 1.48 },
      { cle: 'humble', nom: 'Rester humble', bon: 'On ne relâche rien derrière', defense: 0.92 },
      { cle: 'tous', nom: 'Tout le monde joue', bon: 'Le 4e trio goûte au succès, les corps se reposent', prix: 'Tes vedettes jouent moins', F: [0.9, 0.97, 1.05, 1.2], D: [0.95, 1, 1.08], blessure: 0.68 },
      { cle: 'forcer', nom: 'La séquence passe avant le repos', bon: 'Le premier trio ne sort plus', prix: 'Les jambes lâchent, et l\'arbitre aussi', F: [1.22, 1, 0.95, 0.8], discipline: 1.19, blessure: 1.32, trou: true },
    ],
  },
};
const DUREE_SEQUENCE = 8;
/* Pas deux séquences l'une sur l'autre : le vestiaire a une mémoire. */
export const RECUL_SEQUENCE = 10;

/*
 * LES OBJECTIFS DU PROPRIO. Aux journées 0 et 41, trois défis pour tes vingt
 * prochains matchs ; on en prend un. Réussi, on pige une carte de plus — la
 * mécanique des paliers, rien de neuf. Raté, rien : le proprio a la mémoire
 * courte. Les seuils sont ceux d'une équipe de milieu de classement ; une
 * grosse équipe les réussit plus souvent, et c'est juste.
 */
export const JOURS_OBJECTIFS = [0, 41];
export const MATCHS_OBJECTIF = 20;
/*
 * UN OBJECTIF RATÉ COÛTE SUR LA GLACE (S72) : le proprio coupe les vols
 * nolisés, les voyages fatiguent pendant dix matchs. Avant, il bougeait une
 * faction — JP : *ça apporte rien*.
 */
export const OBJECTIF_RATE = { nom: 'Le proprio serre la vis', ico: '🏢', energie: 1.12, duree: 10 };
export const OBJECTIFS = {
  victoires: { ico: '🏆', nom: 'Gagne 11 de tes 20 prochains matchs', court: '11 victoires sur 20',
    mesure: m => m.filter(x => x.v).length, cible: 11, sens: 1, unite: 'victoires' },
  brigade: { ico: '🧱', nom: 'Accorde 58 buts ou moins en 20 matchs', court: '58 BC ou moins',
    mesure: m => m.reduce((a, x) => a + x.contre, 0), cible: 58, sens: -1, unite: 'buts contre' },
  attaque: { ico: '🎯', nom: 'Marque 64 buts ou plus en 20 matchs', court: '64 BP ou plus',
    mesure: m => m.reduce((a, x) => a + x.pour, 0), cible: 64, sens: 1, unite: 'buts pour' },
  sequence: { ico: '📈', nom: 'Aligne 4 victoires de suite', court: '4 victoires de suite',
    mesure: m => { let b = 0, c = 0; for (const x of m) { c = x.v ? c + 1 : 0; b = Math.max(b, c); } return b; }, cible: 4, sens: 1, unite: 'de suite' },
  vedette: { ico: '⭐', nom: 'Un de tes joueurs fait 21 points en 20 matchs', court: 'Un joueur à 21 points',
    mesure: m => { const pts = new Map(); for (const x of m) for (const b of x.buts || []) for (const p of [b.marqueur, ...(b.passeurs || [])]) if (p) pts.set(p, (pts.get(p) || 0) + 1); return Math.max(0, ...pts.values()); }, cible: 21, sens: 1, unite: 'points' },
  blanchissages: { ico: '🥅', nom: 'Deux blanchissages en 20 matchs', court: '2 blanchissages',
    mesure: m => m.filter(x => x.contre === 0).length, cible: 2, sens: 1, unite: 'blanchissages' },
  regulier: { ico: '🧭', nom: 'Jamais trois défaites de suite en 20 matchs', court: 'Pas trois défaites de suite',
    mesure: m => { let b = 0, c = 0; for (const x of m) { c = x.v ? 0 : c + 1; b = Math.max(b, c); } return b; }, cible: 2, sens: -1, unite: 'défaites de suite au pire' },
};
/* Les trois défis offerts : PURS, comme la main des cartes. */
export function objectifsOfferts(graine, jour) {
  const cles = Object.keys(OBJECTIFS);
  let x = ((Number(graine) >>> 0) ^ ((jour + 7) * 0xc2b2ae35)) >>> 0;
  const suivant = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
  const reste = cles.slice(), main = [];
  while (main.length < 3 && reste.length) main.push(reste.splice(Math.floor(suivant() * reste.length), 1)[0]);
  return main;
}
/*
 * Où en est un objectif sur une liste de tes matchs `{ v, pour, contre, buts }`.
 * `fini` quand les vingt matchs sont joués ; `reussi` peut tomber avant (une
 * séquence de quatre est acquise dès qu'elle arrive) mais jamais un échec
 * avant la fin, sauf s'il est déjà mathématiquement joué.
 */
export function etatObjectif(cle, matchs) {
  const o = OBJECTIFS[cle];
  if (!o) return null;
  const m = matchs.slice(0, MATCHS_OBJECTIF);
  const val = o.mesure(m);
  const fini = m.length >= MATCHS_OBJECTIF;
  const tient = o.sens > 0 ? val >= o.cible : val <= o.cible;
  // Une mesure qui ne fait que monter (victoires, buts, séquence, points,
  // blanchissages) est acquise dès qu'elle passe la cible ; une qui ne fait
  // que monter vers le MAUVAIS bord (buts contre, défaites de suite) est
  // perdue dès qu'elle la dépasse.
  const reussi = o.sens > 0 ? tient : (fini && tient);
  const rate = o.sens > 0 ? (fini && !tient) : !tient;
  return { val, cible: o.cible, fini: reussi || rate, reussi, rate, joues: m.length };
}

/* Les factions (S66) sont parties en S72 : JP, *les trucs genre partisans et cie, ça apporte rien*. Ce qu'elles faisaient se joue maintenant sur la glace. */

/*
 * LA DÉCISION D'UN MOMENT → l'effet posé sur l'équipe. Un seul endroit
 * traduit, pour que le moteur, l'écran et la mesure lisent la même chose.
 */
export function effetDeMoment(d, team = null) {
  // LA CONSIGNE DU MATCH (S68) : l'importance et la répartition attaque /
  // défense, pour UN match.
  if (d.match) {
    const I = IMPORTANCES[d.match.importance] || IMPORTANCES.normale;
    const ad = borne(Number(d.match.ad) || 0, -2, 2);
    return { debut: d.jour, fin: d.jour + 1, source: 'match', match: true, ad, nom: `Consigne : ${I.nom}`, ico: I.ico,
      finition: (I.finition || 1) * (1 + 0.025 * ad), defense: (I.defense || 1) * (1 + 0.02 * ad),
      blessure: I.blessure || 1, energie: I.energie || 1 };
  }
  const m = d.moment;
  if (!m) return null;
  const fam = familleDeMoment(m);
  const o = fam && fam.options.find(x => x.cle === m.choix);
  if (!o) return null;
  const duree = o.duree || (m.famille === 'sequence' ? DUREE_SEQUENCE : DUREE_MOMENT);
  const { cle, nom, bon, prix, duree: _d, mutation: _m, pari: _p, ensuite: _e, action: _a, rien: _r, enjeu: _n, trou: _t, ...canaux } = o;
  void cle; void bon; void prix; void _d; void _m; void _p; void _e; void _a; void _r; void _n; void _t;
  if (!Object.keys(canaux).length) return null;
  // UNE DURÉE SE DIT EN MATCHS (1.0, oct.) : avec le vrai calendrier, elle finit le lendemain du N-e match du club.
  return { debut: d.jour, fin: apresMatchs(team, d.jour, duree), source: m.famille || 'moment', nom: fam.titre, ico: fam.ico, choix: nom, ...canaux, ...(_t ? { regle: true } : {}) };
}

/*
 * LES TROIS CARTES OFFERTES À UN PALIER. Tirées de la GRAINE et du jour, sans
 * toucher à `hasard()` : le moteur ne doit pas consommer une seule valeur de
 * plus à cause de l'écran, sinon la même graine ne rejouerait plus la même
 * saison. Deux paliers d'une même partie n'offrent donc pas la même main, et
 * la même partie rejouée offre exactement la même.
 */
export const PALIERS_CARTES = [20, 40, 60];
/*
 * LE DECK (S73). JP : *comme un deck de deckbuilder, considérant que c'est des
 * cartes de joueurs et d'effets* ; *possible d'avoir des cartes style
 * événement qui permettent d'aller chercher un joueur au choix loto, ou
 * changer le profil d'un joueur, améliorer ses stats, etc.* Un palier n'offre
 * plus trois cartes d'effet : il offre une main de trois cartes de SORTES
 * différentes — un effet, et deux parmi un joueur au choix (trois vrais
 * joueurs, tu en prends un), une amélioration, un nouveau rôle, un stage de
 * système (la maîtrise d'une tactique, d'un coup). Tirée de la graine, pure.
 */
export const SORTES_DECK = {
  effet: { ico: '🃏', nom: 'Carte d\'effet', mot: 'Un effet pour le reste de la saison' },
  recrue: { ico: '🎟️', nom: 'Joueur au choix', mot: 'Trois vrais joueurs, style loto : tu en prends un' },
  amelioration: { ico: '⬆️', nom: 'Amélioration', mot: 'Une amélioration à poser au verso d\'un de tes joueurs' },
  profil: { ico: '🔄', nom: 'Nouveau rôle', mot: 'Un de tes joueurs change de rôle' },
  strategie: { ico: '📘', nom: 'Stage de système', mot: 'Ta formation apprend un système d\'un coup' },
  // LE MÉNAGE (S74) : une carte de moins dans le deck de match (js/combat.js) — l'autre moitié d'un deckbuilder.
  menage: { ico: '🗑️', nom: 'Le ménage', mot: 'Retire une carte de ton deck de match' },
  // LE CAMP D'ENTRAÎNEMENT (S74) : une carte du deck de match devient sa version « + ».
  camp: { ico: '🏋️', nom: 'Le camp d\'entraînement', mot: 'Améliore une carte de ton deck de match' },
  // L'ATELIER (S78) : éditer un joueur — son poste, ses trios possibles, ses malus, sa carte.
  atelier: { ico: '🛠️', nom: 'L\'atelier', mot: 'Édite un de tes joueurs : poste, trios, malus, carte' },
};
export const GAIN_STAGE = 0.4;
/*
 * LE STAGE SOUDE AUSSI LES LIGNES (S80). JP : *les upgrade de trio aident au
 * début*. Mesuré (scripts/check_rogue.mjs, le même match sur les mêmes dés) :
 * le stage ne donnait que sa maîtrise, +7 de chimie par ligne au troisième
 * soir. Un stage, c'est aussi des pratiques ENSEMBLE : chaque paire de
 * coéquipiers des lignes qui jouent ce système gagne ENTENTE_STAGE matchs
 * d'entente (+16 de chimie par ligne au troisième soir). Fort tout de suite,
 * et ça PLAFONNE tout seul : l'entente d'une paire tend vers 1
 * (`ENTENTE_MATCHS`), la chimie vers son plafond (`chimieMax`) — en février,
 * les lignes se connaissent déjà et le stage n'ajoute rien. La chimie pèse
 * peu en buts (`CHIMIE_BONUS`) : le stage reste une carte de confort, ce que
 * la mesure dit tel quel. Dans une ligue Rogue seulement (`courbe`).
 */
export const ENTENTE_STAGE = 12;
function stageDEntente(team, tac) {
  const S = systemeDe(tac);
  // Une ligue Rogue seulement (`courbe`) : la saison et le tournoi gardent le stage de S73.
  if (!S || !team || !team.courbe) return;
  team.entente = team.entente || new Map();
  const lignes = lignesDe(team, team.roster, { duSoir: false });
  for (let u = 0; u < 4; u++) {
    const l = lignes[u] || {};
    if ((S.groupe === 'D' ? l.tacD : l.tac) !== tac) continue;
    const js = Object.entries(joueursDeLigne(team.roster, u)).filter(([role, p]) => p && ((role === 'DG' || role === 'DD') === (S.groupe === 'D'))).map(([, p]) => p);
    for (let a = 0; a < js.length; a++) for (let b = a + 1; b < js.length; b++) {
      const k = cleDePaire(js[a], js[b]);
      team.entente.set(k, (team.entente.get(k) || 0) + ENTENTE_STAGE);
    }
  }
}
export function mainDuDeck(graine, jour, prises = []) {
  const effet = mainDeCartes(graine, jour, prises)[0];
  const autres = ['recrue', 'amelioration', 'profil', 'strategie', 'menage', 'camp', 'atelier']
    .map(k => [k, hacherMise(graine, 'deck', jour, k)]).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const ameliorations = Object.keys(MUTATIONS).filter(k => MUTATIONS[k].source === 'amelioration');
  const main = [{ sorte: 'effet', cle: effet }];
  for (const k of autres.slice(0, 2)) main.push(k === 'amelioration'
    ? { sorte: k, cle: ameliorations[Math.floor(hacherMise(graine, 'amelioration', jour) * ameliorations.length)] }
    : { sorte: k });
  return main;
}
/* L'atelier : trois éditions tirées de la graine ; le joueur, tu le choisis. */
export function editionsDuJour(graine, jour) {
  return MUTATIONS_ATELIER.map(k => [k, hacherMise(graine, 'atelier', jour, k)]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => k);
}
/* Le nouveau rôle : trois (changement, joueur) possibles dans ton alignement, tirés de la graine. */
export function rolesOfferts(team, graine, jour) {
  const choix = Object.keys(MUTATIONS).filter(k => MUTATIONS[k].source === 'choix')
    .map(k => [k, hacherMise(graine, 'role', jour, k)]).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const out = [], vus = new Set();
  for (const k of choix) {
    const p = cibleMutation(team, k);
    if (!p || vus.has(getPlayerKey(p))) continue;
    vus.add(getPlayerKey(p)); out.push({ cle: k, p });
    if (out.length === 3) break;
  }
  return out;
}
/* Le stage de système : trois tactiques offertes, tirées de la graine. « Hourra » n'en est pas une. */
export function tactiquesDuStage(graine, jour) {
  // Deux systèmes de trio et un de paire (S79) : la formation entière s'entraîne, chacun à sa position.
  const tire = (liste, n, sel) => liste.filter(k => k !== 'hourra')
    .map(k => [k, hacherMise(graine, sel, jour, k)]).sort((a, b) => a[1] - b[1]).slice(0, n).map(([k]) => k);
  return [...tire(Object.keys(TACTIQUES), 2, 'stage'), ...tire(Object.keys(SYSTEMES_D), 1, 'stageD')];
}
export function mainDeCartes(graine, jour, prises = []) {
  // UNE CARTE NE SE PREND QU'UNE FOIS. Sans ça le pire cas est trois fois la
  // même, et c'est ce pire cas qu'il faut équilibrer plutôt que le choix
  // réel — mesuré, trois « cadenas » valaient +8,3 victoires quand un seul
  // en vaut le tiers. Trois cartes DIFFÉRENTES, c'est aussi un meilleur
  // choix : on compose une saison au lieu d'empiler un curseur.
  const cles = Object.keys(CARTES).filter(c => !prises.includes(c));
  // sfc32 n'est pas nécessaire ici : un mélangeur entier suffit, et il doit
  // surtout être PUR — même graine, même jour, même main.
  let x = (Number(graine) >>> 0) ^ (jour * 0x9e3779b1);
  const suivant = () => {
    x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
  const reste = cles.slice(), main = [];
  while (main.length < 3 && reste.length) main.push(reste.splice(Math.floor(suivant() * reste.length), 1)[0]);
  return main;
}

/* =====================================================================
   LES SITUATIONS — le vestiaire vit, et la force du club ne bouge pas

   JP : *x joueur vit telle situation personnelle, bonus ou malus, mais que
   ça s'équilibre, genre, pas que ça boost ou chie l'équipe, juste que ça
   change le vibe et force équipe différente*.

   C'est un moment roguelike d'un TROISIÈME genre, et il ne ressemble ni aux
   blessures ni aux cartes. Une blessure RETIRE un joueur. Une carte est un
   CHOIX d'équipe. Une situation, elle, ARRIVE — à un joueur nommé, sans
   qu'on ait rien à décider sur le coup. Ce qu'elle demande n'est pas un
   clic, c'est de REGARDER SON ALIGNEMENT AUTREMENT.

   ELLES VONT PAR DEUX, ET C'EST CE QUI LES ÉQUILIBRE. À chaque fenêtre, le
   vestiaire tend exactement un joueur PORTÉ et un joueur PESÉ — jamais un
   seul. Le porté se tire du BAS de l'effectif, le pesé du HAUT, parce que
   c'est cet écart-là qui force une équipe différente : ton quatrième trio
   est en feu pendant que ton premier patine dans la mélasse, et la question
   cesse d'être « qui est le meilleur » pour devenir « qui est le meilleur
   CE MOIS-CI ». Une paire qui tirerait deux joueurs du même rang ne
   demanderait rien à personne.

   AUCUNE COTE NEUVE, comme partout ailleurs dans ce dépôt. Une situation
   n'est qu'un facteur sur une quantité que le moteur lit DÉJÀ chez ce
   joueur : son volume de lancers (`lancersRel`, le canal de ⚡ Vitesse), sa
   finition (`pctTirRel`, le canal de 💣 Lancer), sa création (`passesRel`)
   et, pour un gardien, son facteur d'arrêt (le canal de 🥅 Vezina). Ce sont
   les canaux des traits, bougés sur UN joueur au lieu de tous.

   ELLES NE SONT PAS UNE DÉCISION, et c'est exprès. Elles se tirent de la
   GRAINE, de la journée et du rang de l'équipe, PUREMENT — sans toucher à
   `hasard()`, comme `mainDeCartes`. Donc la même partie rejouée vit les
   mêmes situations, la sauvegarde n'a pas une ligne de plus à porter, et
   une décision au jour 40 laisse les 40 journées d'avant intactes. Ce qui
   EST une décision, c'est TA RÉPONSE : remanier derrière le banc, sur le
   rail que les blessures utilisent déjà.

   LE TIRAGE SE FAIT SUR LA VALEUR, JAMAIS SUR LA CASE, et c'est le piège
   qu'il fallait voir venir. Tirer le porté « parmi les cases du bas »
   paraît naturel et se retourne aussitôt : on promeut le joueur en feu,
   la saison se rejoue depuis ce jour-là, la case du bas n'est plus la
   sienne — et le tirage désigne quelqu'un d'autre. Réagir effacerait donc
   la chose à laquelle on réagit. La valeur (`getHiddenRatings(p).v`) est
   une propriété du joueur-saison, pas de l'endroit où on le pose : elle ne
   bouge pas quand on remanie, et la situation reste sur son homme.

   TOUTE LA LIGUE LES VIT. Une paire est neutre par construction, donc ça ne
   coûte rien de plus à équilibrer, et les palmarès bougent : un club
   adverse aussi a son joueur en feu. Tu ne vois que les tiennes.

   LE CONTRAT SE MESURE SUR UNE ÉQUIPE QUI NE RÉAGIT PAS. C'est la seule
   façon honnête de vérifier « ça ne boost ni ne chie l'équipe » : l'IA ne
   remanie jamais son alignement, donc ce qu'une paire vaut chez elle est
   exactement ce qu'elle vaut quand on la SUBIT. Ce chiffre-là doit être
   zéro. Tout ce qu'un joueur humain en tire vient alors de sa réaction, et
   de rien d'autre — c'est la définition d'une mécanique qui change le vibe
   sans changer la force. `check_situations.mjs` le mesure en paires, comme
   `check_cartes.mjs`, et le juge.
   ===================================================================== */
export const JOURS_SITUATIONS = [10, 28, 46, 64];

/*
 * LE PORTÉ EST PLUS FORT QUE LE PESÉ N'EST FAIBLE, et ce n'est pas une
 * faveur : c'est de l'arithmétique. Le pesé se tire du haut de l'effectif,
 * où un joueur porte ~11 % des lancers du club ; le porté se tire du bas,
 * où il en porte ~6 %. À magnitude égale, la paire serait donc franchement
 * négative. Les amplitudes sont réglées pour que la MOYENNE du système lise
 * zéro sur une équipe qui ne réagit pas — le contrat ci-dessus — et c'est
 * `check_situations.mjs` qui l'arbitre, jamais l'intuition.
 */
/*
 * LES DEUX MOLETTES, pour la mesure seulement. Elles multiplient l'ÉCART à 1
 * de chaque facteur, pas le facteur : à 2, un `finition: 1.30` devient 1.60 et
 * un `0.80` devient 0.60. C'est ce qui permet de balayer l'amplitude du
 * système sans réécrire douze nombres à la main, et de la régler sur la
 * mesure plutôt que sur l'intuition.
 */
/*
 * S79 : les systèmes de ligne au prorata du fit (les rôles) ont fait pencher
 * la paire vers le porté — +0,66 ± 0,31 victoire sur 10 ligues, hors du
 * contrat. Balayé sur les mêmes 10 ligues : porté ×0,85 → +0,20 ; porté ×0,8
 * et pesé ×1,15 → +0,04 mais le pesé tombait à −1,7 point ; PESÉ ×1,3 →
 * +0,08, le porté toujours à +3,4 points et le pesé à −2,6. On garde le porté
 * tel quel (c'est lui qu'on VOIT) et le pesé pèse un peu plus.
 */
const ECHELLE_PORTE = Number(ENV_MESURE.ECHELLE_PORTE ?? 1);
const ECHELLE_PESE = Number(ENV_MESURE.ECHELLE_PESE ?? 1.3);

export const SITUATIONS = {
  /* ---------- LES PORTÉS : tirés du bas de l'effectif ---------- */
  feu: {
    nom: 'En feu', ico: '🔥', sens: 1,
    mot: 'Tout ce qu\'il touche entre.',
    quoi: 'Sa finition monte en flèche',
    finition: 2.02, lancers: 1.18,
  },
  declic: {
    nom: 'Le déclic', ico: '🎯', sens: 1,
    mot: 'Quelque chose s\'est débloqué : il ose enfin tirer.',
    quoi: 'Beaucoup plus de lancers',
    lancers: 1.90, finition: 1.18,
  },
  maison: {
    nom: 'De retour chez lui', ico: '🏠', sens: 1,
    mot: 'Il joue devant les siens, et ça paraît.',
    quoi: 'Il finit mieux et voit mieux le jeu',
    finition: 1.60, creation: 1.48,
  },
  papa: {
    nom: 'Un premier enfant', ico: '👶', sens: 1,
    mot: 'Les nuits sont courtes, mais la tête est claire.',
    quoi: 'Sa création monte, son volume baisse un peu',
    creation: 2.02, lancers: 0.85,
  },
  contrat: {
    nom: 'Année de contrat', ico: '📝', sens: 1,
    mot: 'Il sait exactement ce qui se joue pour lui.',
    quoi: 'Il tire davantage et finit mieux',
    lancers: 1.60, finition: 1.42,
  },
  mur: {
    nom: 'Un mur', ico: '🧱', sens: 1, gardiens: true,
    mot: 'Il voit la rondelle grosse comme un ballon.',
    quoi: 'Ton AUXILIAIRE est soudain imbattable',
    gardien: 0.905,
  },

  /* ---------- LES PESÉS : tirés du haut de l'effectif ---------- */
  panne: {
    nom: 'La panne sèche', ico: '🌧️', sens: -1,
    mot: 'Il génère autant, et plus rien ne rentre.',
    quoi: 'Sa finition s\'effondre',
    finition: 0.70,
  },
  creux: {
    nom: 'Le creux de février', ico: '💤', sens: -1,
    mot: 'Les jambes ne suivent plus, et ça se voit sur chaque présence.',
    quoi: 'Moins de lancers, moins de finition',
    lancers: 0.82, finition: 0.88,
  },
  rumeur: {
    nom: 'Son nom circule', ico: '🗞️', sens: -1,
    mot: 'Il lit les mêmes rumeurs que tout le monde.',
    quoi: 'Il joue pour lui : sa création tombe',
    creation: 0.67, finition: 0.925,
  },
  voyages: {
    nom: 'Les voyages s\'accumulent', ico: '🛫', sens: -1,
    mot: 'Trois villes en cinq jours, et la fatigue paraît.',
    quoi: 'Moins de lancers',
    lancers: 0.76,
  },
  amoche: {
    nom: 'Il joue amoché', ico: '🧊', sens: -1,
    mot: 'Rien d\'assez grave pour sortir de l\'alignement. Rien d\'assez sain pour être lui-même.',
    quoi: 'Il tire moins bien et se blesse plus facilement',
    finition: 0.805, lancers: 0.895, blessure: 1.90,
  },
  /*
   * LA PAIRE DE GARDIENS SE PÈSE EN MINUTES, PAS EN POUR CENT, et c'est la
   * mesure qui l'a imposé. Le pesé frappe le PARTANT (environ 65 % des
   * lancers du club), le porté l'AUXILIAIRE (35 %) : à amplitude égale, la
   * passoire l'emporte donc de deux contre un, chaque équipe alloue plus
   * qu'elle n'économise, et comme TOUTE la ligue vit des situations, le
   * total des buts monte. `check_feuilles.mjs` l'a lu net — 3,34 buts par
   * équipe par match au lieu de 3,08, et 11,8 % de tir au lieu de 10,6 —
   * alors que l'écart de VICTOIRES, lui, était à zéro : une ligue est à
   * somme nulle en victoires et ne l'est pas du tout en buts. Le réglage
   * suit donc le partage des départs, pas la symétrie apparente.
   */
  passoire: {
    nom: 'La passoire', ico: '🕳️', sens: -1, gardiens: true,
    mot: 'Le premier lancer entre, et la soirée est longue.',
    quoi: 'Ton PARTANT est plus facile à battre',
    gardien: 1.040,
  },
};

/*
 * Les deux familles se relisent À CHAQUE APPEL plutôt qu'une fois au
 * chargement. Ça ne coûte rien (douze clés, quatre fois par saison et par
 * équipe) et ça permet à `check_situations.mjs` de réduire la table à UNE
 * paire pour la peser isolément — on ne peut pas déduire ce que vaut une
 * situation d'une moyenne où douze se mélangent.
 */
const famille = sens => Object.keys(SITUATIONS).filter(c => (SITUATIONS[c].sens > 0) === (sens > 0));

/** Ce qu'une situation multiplie chez CE joueur. Neutre pour presque tout le monde. */
function situDe(p, champ) {
  const s = p && p._situ;
  return (s && s[champ]) || 1;
}

/*
 * Le mélangeur des situations : PUR, comme celui des cartes. Même graine,
 * même journée, même équipe, mêmes deux joueurs — sinon la reprise d'une
 * saison ne rejouerait pas la même, et `check_graine.mjs` le dirait.
 */
function melangeurSitu(graine, jour, equipe) {
  let x = ((Number(graine) >>> 0) ^ (jour * 0x9e3779b1) ^ (equipe * 0x85ebca6b)) >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

/**
 * La paire du jour pour une équipe : un joueur PORTÉ tiré du bas de
 * l'effectif, un joueur PESÉ tiré du haut. Rend `null` hors d'une fenêtre.
 *
 * Le rang se lit sur la VALEUR, jamais sur la case (voir le bloc ci-dessus) :
 * un joueur qu'on promeut garde sa situation.
 */
export function situationsDuJour(team, graine, jour, equipe = 0) {
  if (!JOURS_SITUATIONS.includes(jour)) return null;
  const tous = SLOTS.map(s => team.roster[s.i]).filter(Boolean);
  const patineurs = tous.filter(p => p.p !== 'G');
  const gardiens = tous.filter(p => p.p === 'G');
  if (patineurs.length < 8) return null;
  const rnd = melangeurSitu(graine, jour, equipe);
  const PORTES = famille(1), PESES = famille(-1);
  if (!PORTES.length || !PESES.length) return null;
  /*
   * LES EX ÆQUO SE DÉPARTAGENT SUR L'IDENTITÉ, et c'est ce qui manquait au
   * premier jet. Dix-huit patineurs n'ont que douze valeurs distinctes — six
   * joueurs de quatrième trio partagent la même — et `sort` est STABLE, donc
   * les ex æquo gardaient l'ordre des CASES. Remanier son alignement les
   * réordonnait, le tirage désignait quelqu'un d'autre, et réagir effaçait ce
   * à quoi on réagissait. `getPlayerKey` est une propriété du joueur-saison :
   * avec elle, l'ordre ne dépend que de QUI est dans l'effectif.
   */
  const parValeur = patineurs.slice().sort((a, b) =>
    getHiddenRatings(b).v - getHiddenRatings(a).v || (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1));
  /*
   * LE HAUT est le tiers supérieur, LE BAS tout le reste. Les deux ensembles
   * sont disjoints par construction, donc un même joueur ne peut pas être
   * porté et pesé le même jour.
   *
   * Le bas déborde volontairement sur le milieu de l'alignement : un joueur
   * de deuxième ou troisième trio qu'on monte est une décision aussi réelle
   * qu'un quatrième trio, et il porte assez de lancers pour que la paire
   * s'équilibre à des amplitudes CRÉDIBLES. Cantonné à la moitié basse, il
   * aurait fallu doubler les facteurs du porté pour compenser son temps de
   * glace, et « En feu » serait devenu une caricature.
   */
  const coupe = Math.max(1, Math.floor(parValeur.length / 3));
  const haut = parValeur.slice(0, coupe);
  const bas = parValeur.slice(coupe);
  /*
   * LES GARDIENS SUIVENT LA MÊME RÈGLE QUE LES PATINEURS, et il a fallu le
   * corriger : le premier jet tirait la situation de gardien dans TOUT le
   * duo, donc « Un mur » pouvait tomber sur le partant — un joueur du haut
   * recevant l'amplitude réservée au bas, qui est trois fois plus grande.
   * Le porté est donc l'AUXILIAIRE (le moins bien coté des deux) et le pesé
   * le PARTANT. Et c'est un bien meilleur moment de hockey : ton auxiliaire
   * est imbattable pendant que ton numéro un coule, et la décision est de
   * changer de partant — ce que « Derrière le banc » permet déjà.
   */
  const parValeurG = gardiens.slice().sort((a, b) =>
    getHiddenRatings(b).v - getHiddenRatings(a).v || (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1));
  /*
   * `duHaut` plutôt que `haut` : le paramètre masquerait la liste du haut.
   *
   * ET UNE SITUATION DE GARDIEN A BESOIN DE DEUX GARDIENS. Sans ce repli,
   * un club qui n'en a qu'un en santé voyait « Un mur » tomber sur un
   * AILIER — où le facteur `gardien` n'est jamais lu, donc la situation ne
   * faisait rien, pendant que l'écran annonçait que l'auxiliaire était
   * imbattable. Une situation qui ne joue pas est pire qu'une situation
   * absente : elle ment. On retire alors les situations de gardien du
   * chapeau et on retire.
   */
  const pige = (liste, cles, duHaut) => {
    let cle = cles[Math.floor(rnd() * cles.length)];
    if (SITUATIONS[cle].gardiens && parValeurG.length < 2) {
      const sansGardien = cles.filter(c => !SITUATIONS[c].gardiens);
      if (!sansGardien.length) return { cle: null, p: null };
      cle = sansGardien[Math.floor(rnd() * sansGardien.length)];
    }
    if (SITUATIONS[cle].gardiens) {
      return { cle, p: duHaut ? parValeurG[0] : parValeurG[parValeurG.length - 1] };
    }
    return { cle, p: liste[Math.floor(rnd() * liste.length)] };
  };
  const porte = pige(bas, PORTES, false);
  const pese = pige(haut, PESES, true);
  if (!porte.cle || !pese.cle) return null;
  if (!porte.p || !pese.p || porte.p === pese.p) return null;
  return { porte, pese };
}

/*
 * Poser la paire du jour. UNE SEULE PAIRE EST ACTIVE À LA FOIS : la fenêtre
 * suivante efface la précédente, sinon une saison finirait avec quatre
 * joueurs portés et quatre pesés, et « une paire est neutre » ne voudrait
 * plus rien dire.
 */
/* Ce qu'une situation multiplie chez son joueur, à l'échelle du porté ou du pesé : le moteur et le verso lisent ceci. */
export function effetDeSituation(cle) {
  const c = SITUATIONS[cle];
  if (!c) return null;
  const k = c.sens > 0 ? ECHELLE_PORTE : ECHELLE_PESE;
  const ech = f => 1 + ((f ?? 1) - 1) * k;
  return { lancers: ech(c.lancers), finition: ech(c.finition), creation: ech(c.creation), gardien: ech(c.gardien), blessure: ech(c.blessure) };
}
/* `tirage` : la journée PRÉVUE, qui donne le tirage — la situation reportée d'un gros match (S79) garde le sien. */
function poserSituations(team, graine, jour, equipe, tirage = jour) {
  const paire = situationsDuJour(team, graine, tirage, equipe);
  if (!paire) return;
  for (const s of SLOTS) { const p = team.roster[s.i]; if (p) delete p._situ; }
  for (const bout of [paire.porte, paire.pese]) bout.p._situ = effetDeSituation(bout.cle);
  // Ce que l'écran lit. Le journal garde TOUTES les fenêtres, pas seulement
  // la courante : c'est l'histoire de la saison, et le bilan la relit.
  (team.situations = team.situations || []).push({
    jour, porte: { cle: paire.porte.cle, p: paire.porte.p }, pese: { cle: paire.pese.cle, p: paire.pese.p },
  });
}

/*
 * LES PASSES CAUSENT LES BUTS. Jusqu'ici la passe était DÉCORATIVE : un but
 * tiré, on l'attribuait après coup aux coéquipiers sur la glace, au prorata
 * de leur propension à la passe. Gretzky 1985-86 et ses 163 passes ne
 * faisaient pas marquer Kurri d'un seul but de plus — le moteur ne lisait
 * chez un patineur que ses lancers et sa finition, et la valeur (donc les
 * zones et le salaire) comptait les points. C'est cet écart qui rendait un
 * tireur de 40 buts toujours préférable à un passeur de 90 points, et qui a
 * produit l'empilement de tireurs que `check_tireurs.mjs` mesure.
 *
 * Maintenant chaque lancer porte la CRÉATION des quatre autres patineurs sur
 * la glace : leurs passes par match, relatives au régulier moyen de leur
 * position et de leur saison (`passesRelatives`, js/ratings.js). Un lancer
 * pris à côté d'un fabricant de jeu entre plus souvent ; à côté de quatre
 * joueurs qui ne servent personne, moins. Le tireur reste celui qui tire —
 * la création agit sur la qualité du lancer, pas sur qui le prend.
 *
 * LE PIÈGE, ET COMMENT ON L'ÉVITE. Le % de tir d'un joueur contient DÉJÀ
 * l'effet de ses vrais coéquipiers : Kurri finissait à 20 % à côté de
 * Gretzky. Ajouter la création par-dessus compterait les grandes équipes
 * deux fois — mesuré : l'erreur systématique par joueur de
 * `check_feuilles.mjs` passait de 19,5 à 24,8 % et le Canadien de 1976-77
 * gagnait deux matchs de plus, sans qu'on ait rien changé à ses joueurs.
 * La création se lit donc en ÉCART AU CONTEXTE que le tireur a vraiment
 * eu (`p.cx`, posé dans le shard par `contexteDeCreation`, étage 2) : rejoué
 * avec ses vrais coéquipiers, un joueur marque comme dans la vraie vie ;
 * placé à côté d'un meilleur passeur, il marque plus ; à côté de moins bons,
 * moins. REF.crea ne sert que de contexte de secours, quand le shard n'en
 * porte pas.
 *
 * BETA_CREATION est la deuxième constante libre du moteur, avec SYN_ECHELLE :
 * les colonnes ne peuvent pas la mesurer, pour la raison ci-dessus. Elle se
 * règle sur l'ordre des plafonds de `check_tireurs.mjs` (PARFAIT > Canadien
 * 1976-77 > empilement par valeur > TIREURS) et sur ce qu'un joueur de
 * quatrième trio gagne à jouer à côté de Gretzky — avec 0,5, un tiers de
 * finition en plus, ce qui est à peu près ce que l'histoire raconte.
 */
const BETA_CREATION = 0.5;

/*
 * La défensive, elle, agit sur la QUALITÉ des lancers. Même mesure : la
 * cote défensive de l'alignement corrèle à +0,45 avec le pourcentage
 * d'arrêts de l'équipe et −0,45 avec ses buts alloués. Une bonne brigade
 * ne réduit pas le nombre de rondelles vers son filet, elle réduit la
 * probabilité que chacune entre.
 *
 * La circularité a été testée : la cote `d` est bâtie sur le +/-, donc un
 * bon gardien gonfle la cote défensive de tout son vestiaire. Le test du
 * MÊME gardien d'une saison à l'autre, contre sa propre moyenne de
 * carrière corrigée de l'époque (312 gardiens), laisse survivre +0,23.
 *
 * D'où un intervalle mesuré plutôt qu'un nombre : 0,029 (test contrôlé par
 * gardien, qui efface au passage l'équipe qui suit son gardien) à 0,050
 * (sans contrôle, donc contaminé par le gardien). On prend le milieu.
 */
const K_DEFENSE = 0.050;   // le haut de l'intervalle mesuré : voir ROBUSTESSE ci-dessous, et check_builds.mjs

/*
 * LA DÉFENSIVE AGIT AUSSI, UN PEU, SUR LE VOLUME. `check_suppression.mjs` a
 * mesuré −0,17 de corrélation entre la cote défensive d'un alignement et les
 * lancers concédés : faible, mais pas nulle, et on l'avait arrondie à zéro.
 * L'écart-type des lancers contre entre équipes est d'environ 7 % ; −0,17 ×
 * 7 % donne 1,2 % de lancers en moins par écart-type de brigade. C'est ce que
 * la mesure autorise, pas plus : la qualité reste le canal principal.
 */
const K_VOLUME_DEF = 0.012;

/*
 * LA ROBUSTESSE — le canal que le moteur n'avait pas.
 *
 * JP : *je veux que les joueurs défensifs et/ou robustes aient plus d'impact,
 * pour augmenter les builds possibles*. Mesuré avant (`check_builds.mjs`) :
 * la robustesse `r` n'entrait que dans l'usure des soirs éreintants, à
 * travers K_DEFENSE — moins d'un demi-pour cent des buts alloués, rien. Un
 * bâti robuste ne menait nulle part.
 *
 * Ce que la robustesse fait maintenant, et c'est du hockey :
 *
 *   1. Les SOIRS ÉREINTANTS (un match sur quatre) et TOUS les matchs de
 *      séries, la finition de chaque équipe suit l'écart de robustesse entre
 *      les deux clubs : exp(K_ROB × intensité × (rob_off − rob_def)), en
 *      écarts-types de robustesse d'alignement. Une équipe qui a des jambes
 *      finit mieux et laisse moins entrer quand le match est dur.
 *   2. L'USURE S'ACCUMULE EN SÉRIES : l'intensité monte de ROB_SERIES par
 *      ronde (1,0 au premier tour, 1,75 en finale). C'est ce que MOTEUR.md
 *      5.5 annonçait — « l'usure s'accumule sur quatre rondes » — et que rien
 *      ne faisait.
 *   3. Les BLESSURES lisent `r` : un joueur robuste se blesse moins, un
 *      joueur fragile plus (ROB_BLESSURE par écart-type de joueur), en plus
 *      des matchs joués réels qui portaient déjà sa fragilité.
 *
 * Ce canal ne se mesure pas dans les shards (pas de séparation saison /
 * séries, pas de matchs éreintants réels), donc K_ROB est une constante
 * LIBRE, la troisième avec SYN_ECHELLE et BETA_CREATION, réglée sur une
 * cible de jeu : un bâti robuste (`check_builds.mjs`) doit rejoindre le bâti
 * de valeur en saison et le dépasser en séries, sans que la monotonie des
 * vraies équipes ni les égalités de la feuille bougent. Une vraie équipe a
 * une robustesse d'alignement de 48,1 ± 2,4 (120 vraies équipes alignées) :
 * à K_ROB = 0,10, la vraie équipe la plus dure de son époque gagne deux ou
 * trois matchs de plus, pas dix.
 *
 * LE DUR DE QUATRIÈME TRIO COMPTE CHAQUE SOIR (1.0). JP : *on ne distingue pas
 * bien les joueurs selon position ; un excellent bagarreur de quatrième trio
 * devrait être impactant*. Mesuré avant : trois soirs sur quatre, la
 * robustesse ne faisait RIEN (intensité 0), et un bagarreur n'était qu'un
 * coût de punitions. Deux ajouts, par les canaux qui existent :
 *
 *   4. Les SOIRS ORDINAIRES, la robustesse pèse à ROB_ORDINAIRE de son poids
 *      d'un soir éreintant : un club à un écart-type au-dessus de l'autre y
 *      finit mieux de deux et demi pour cent, et laisse moins entrer d'autant.
 *      Un soir éreintant vaut toujours 1, les séries davantage à chaque ronde.
 *   5. LA DISSUASION : la robustesse d'alignement (celle des durs habillés,
 *      pondérée par la glace de leur trio) protège les coéquipiers — chaque
 *      écart-type réduit les blessures de l'équipe de 1 − e^(−DISSUASION),
 *      dix-huit pour cent. C'est ce qu'un bagarreur fait de plus visible :
 *      les vedettes jouent leurs 82 matchs.
 */
export const K_ROB = 0.07;
const ROB_SERIES = 0.15;
const ROB_BLESSURE = 0.35;
export const ROB_ORDINAIRE = 0.35;
export const DISSUASION = 0.2;
const MOY_ROB_EQUIPE = 48.1;
const ECART_ROB_EQUIPE = 2.4;
// Les colosses (js/traits.js) ajoutent leur poids, en écarts-types, dans leurs grosses saisons.
const robZ = t => (t && t.rob != null ? borne((t.rob - MOY_ROB_EQUIPE) / ECART_ROB_EQUIPE + (t.traitRob || 0), -3, 3) : 0);

/** Cote défensive d'équipe : moyenne et écart-type des 1392 équipes-saisons. */
const MOY_DEF_EQUIPE = 57.6;
const ECART_DEF_EQUIPE = 4.3;

/*
 * Conversion d'un bonus de chimie ou d'un malus de zone (en points de cote)
 * en facteur multiplicatif sur les buts attendus de l'unité. La moitié de
 * l'effet passe par le volume de lancers, l'autre par leur qualité — le
 * produit vaut donc exactement `exp(bonus / SYN_ECHELLE)`.
 *
 * C'est le seul curseur libre du moteur : tout le reste est mesuré. Il se
 * règle sur `mock_zones.mjs` (l'empilement doit rester près de la meilleure
 * équipe de l'histoire) et `check_monotonie.mjs` (améliorer son équipe ne
 * doit jamais la rendre pire).
 */
const SYN_ECHELLE = 42;

/*
 * L'ÉQUIPE de référence, et non le joueur de référence.
 *
 * Mesuré avec `node scripts/check_neutre.mjs` sur les 1395 équipes-saisons
 * alignées par `autoRoster`. La distinction n'est pas cosmétique : un
 * alignement retient les 18 meilleurs patineurs d'un club et son gardien
 * numéro un, qui tirent 27 % de plus que le régulier moyen de la ligue,
 * finissent 2 % mieux et arrêtent 10 % de plus. Normaliser sur le joueur
 * moyen plutôt que sur l'équipe moyenne donnait une équipe médiane à 60
 * victoires.
 *
 * Tout dans le moteur est exprimé en écart à ces quatre nombres, si bien
 * qu'un match entre deux équipes de référence produit exactement
 * LANCERS_BASE lancers et CIBLE_PCT_TIR de finition.
 */
export const REF = { pression: 1.233, zDef: 0.169, fg: 0.899, pctTir: 1.025, crea: 1.277 };

/*
 * La force offensive de l'adversaire neutre, et la seule valeur de REF qui
 * NE SE LIT PAS dans `check_neutre.mjs` : elle se règle sur la SORTIE, comme
 * LANCERS_BASE et CIBLE_PCT_TIR.
 *
 * La raison est une asymétrie assumée. L'adversaire neutre n'a pas d'unités :
 * il ne porte donc ni création, ni chimie, ni malus de zone, alors qu'il
 * encaisse une attaque qui en porte. Lui donner la finition brute mesurée
 * (REF.pctTir = 1,025) laissait toute vraie équipe alignée gagner une
 * victoire de trop en solo — 44,4 en moyenne sur 465 équipes-saisons contre
 * 43,4 dans la réalité. À 1,045, la moyenne retombe exactement sur le réel,
 * et les dix déciles de `check_monotonie.mjs` avec elle.
 */
// 1.0 · J1-M : 0,965 → 0,945. La chimie relative (bonus négatif sous le pivot) coûte au
// solo, où la chimie part de zéro contre un adversaire qui n'en a pas : les déciles de
// check_monotonie reculaient d'une demi-victoire (50,1 → 49,6 au 10e) ; 0,945 les remet
// à 25,2 / 50,3. Le jeu, lui, joue en ligue (simulateLeague) et ne lit pas ce nombre.
const PCT_TIR_NEUTRE = Number(ENV_MESURE.PCT_TIR_NEUTRE ?? 0.945);

/*
 * Le pourcentage de tir de référence, et donc l'ancrage du pointage : c'est
 * lui qui décide combien la ligue simulée marque, toutes époques confondues.
 * Réglé pour que `check_feuilles.mjs` retombe sur ~3,1 buts par équipe par
 * match, la référence moderne de `SEASON_GOAL_AVG`.
 *
 * Il absorbe l'écart entre le tireur de référence et le tireur MOYEN d'un
 * alignement réel : les gros tireurs prennent plus de lancers que leur part
 * d'effectif, et ils finissent mieux que la moyenne. Le régler à la main sur
 * la sortie mesurée vaut mieux que de propager cette pondération dans quatre
 * formules qui divergeraient ensuite.
 *
 * ET UNE MISE EN GARDE PAYÉE COMPTANT. En passant `data/reputations.js` de 86
 * à 215 entrées, j'ai lu 3,19 buts par équipe par match sur cinq exécutions et
 * conclu que les réputations gonflaient le pointage de 3 %. J'ai donc rabaissé
 * les deux constantes — puis relu 2,99 avec les nouvelles. Ni l'un ni l'autre
 * n'était vrai : `check_feuilles.mjs` tire 32 équipes au hasard dans 55
 * saisons, ce qui fait varier le repère de ±0,15 but d'une exécution à
 * l'autre, et je courais après ce bruit-là. Sur cinq ligues moyennées
 * (`LIGUES=5`), les valeurs d'origine retombent pile sur la cible. Les deux
 * constantes n'ont donc PAS bougé, et c'est ce qu'il fallait conclure.
 *
 * Règle qui en découle : ne jamais régler ces deux nombres sur une seule
 * exécution de `check_feuilles.mjs`.
 */
export const CIBLE_PCT_TIR = 0.0927;
const PCT_TIR_MAX = 0.35;

/* ======================================================================
 *  LES UNITÉS SPÉCIALES — punitions, avantage et désavantage numériques
 *
 *  Un match n'est pas soixante minutes à cinq contre cinq. Chaque punition
 *  mineure donne deux minutes à l'adversaire — ou moins, s'il marque — et
 *  pendant ces deux minutes tout change : l'équipe en avantage tire à peu
 *  près deux fois plus vite et finit mieux, l'équipe en désavantage tire à
 *  peine et défend avec ses quatre meilleurs. Le moteur joue donc chaque
 *  avantage comme un petit match dans le match, avec les mêmes lancers, les
 *  mêmes gardiens et les mêmes égalités de feuille.
 *
 *  CE QUI EST MESURÉ SUR LES JOUEURS : qui prend les punitions (les minutes
 *  de punition par match de chaque patineur habillé, relatives au régulier
 *  moyen de sa saison, colonne [7] de SEASON_LANCERS), qui tire et qui finit
 *  en avantage (les cinq meilleurs à la création et à la finition), qui
 *  défend en désavantage (les quatre meilleures cotes défensives). Les
 *  shards ne portent ni les buts en avantage numérique ni les occasions :
 *  ce sont des colonnes de l'API qui n'ont jamais été aspirées.
 *
 *  CE QUI EST UN REPÈRE D'ÉPOQUE, PAS UNE MESURE DU DÉPÔT : le nombre
 *  d'occasions par équipe par match (`AVANTAGES_EPOQUE`), lu dans les
 *  tables publiques de la ligue — à peu près 4 en 1970, 5,3 au milieu des
 *  années 1980, 5,8 dans la répression de 2005-06, 3 depuis 2015. Ce sont
 *  des valeurs approximatives, à valider quand l'API sera joignable
 *  (colonnes powerPlayGoals et powerPlayOpportunities). Le rapport entre la
 *  finition en avantage et à forces égales (`AN_QUALITE`, ~1,45 : 12,5 %
 *  contre 8,5 % de nos jours) et les cadences de tirs (0,95 par minute en
 *  avantage, 0,28 en désavantage) viennent des mêmes tables.
 *
 *  LES DEUX CONSTANTES RÉGLÉES SUR LA SORTIE, comme LANCERS_BASE et
 *  CIBLE_PCT_TIR : `FE_TIRS` et `FE_QUALITE` ramènent le cinq contre cinq
 *  d'autant que les unités spéciales ajoutent, pour que
 *  `LIGUES=5 node scripts/check_feuilles.mjs` retombe sur 28,5 lancers et
 *  3,1 buts par équipe par match, avec un but sur cinq en avantage numérique.
 * ====================================================================== */

/**
 * Occasions d'avantage numérique par équipe par match, par époque — le REPLI
 * quand une saison n'a pas la mesure (colonne [9] de SEASON_LANCERS, posée
 * depuis les shards de RATINGS_VERSION 24) : les sept saisons d'avant 1977-78,
 * où la ligue ne les comptait pas, et l'adversaire neutre. Mesuré sur les
 * shards : 4,25 en 1980-81, 4,63 en 1985-86, 5,04 en 1995-96, 5,85 en
 * 2005-06, 3,11 en 2015-16, 2,88 en 2025-26 — les repères publics d'avant la
 * mesure disaient 5,3 pour les années 1980, c'était trop.
 */
const AVANTAGES_EPOQUE = [
  [1970, 3.8], [1977, 4.0], [1980, 4.25], [1985, 4.63], [1990, 4.57], [1995, 5.04],
  [2000, 4.59], [2005, 5.85], [2010, 3.54], [2015, 3.11], [2020, 2.89], [2026, 2.88],
];
/**
 * Les occasions d'avantage d'un joueur-saison : mesurées dans sa saison
 * (colonne [9] de SEASON_LANCERS, posée par build_lancers.mjs depuis le bloc
 * `an` des shards) quand elles existent, sinon le repère d'époque.
 */
function occasionsDe(p) {
  const mesure = seasonLancers(p && p.s)[9];
  if (mesure > 0) return mesure;
  return occasionsEpoque(parseInt((p && p.s || '').slice(0, 4), 10) || null);
}
function occasionsEpoque(annee) {
  const t = AVANTAGES_EPOQUE;
  if (!annee || annee <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (annee <= t[i][0]) {
      const [a0, v0] = t[i - 1], [a1, v1] = t[i];
      return v0 + (v1 - v0) * (annee - a0) / (a1 - a0);
    }
  }
  return t[t.length - 1][1];
}
const AN_MINUTES = 2;          // une mineure
const AN_TIRS_MIN = 0.60;      // lancers par minute de l'équipe en avantage (fenêtre de deux minutes, coupée par le but)
const DN_TIRS_MIN = 0.09;      // lancers par minute de l'équipe en désavantage
const AN_QUALITE = 1.35;       // réglé sur la mesure : part des buts d'avantage simulée = réelle (26,5 %) chez les mêmes joueurs (check_feuilles)
const DN_QUALITE = 1.00;       // finition en désavantage
const FE_TIRS = 1.20;          // le cinq contre cinq, réglé sur la sortie
const FE_QUALITE = 1.03;       // idem, sur la finition
/*
 * La part des lancers d'un joueur d'avantage numérique qui vient de
 * l'avantage. Son volume réel (`sh` par match) la contient déjà : à forces
 * égales il ne doit garder que le reste, sinon il tire deux fois — mesuré,
 * Bondra 2001-02 faisait 93 buts au lieu de 46. Repère public : un joueur
 * de première unité prend le quart à la moitié de ses tirs en avantage.
 */
const PART_AN_TIRS = [0.35, 0.15];   // première unité, deuxième unité
const POIDS_AN = [0.65, 0.35];        // part du temps d'avantage de chaque unité
const POIDS_DN = [0.60, 0.40];
const PART_LANCERS_D_AN = 0.38;       // en avantage, la pointe tire plus (Lidström) — repère public
const DISCIPLINE_MIN = 0.5;    // bornes de l'indiscipline d'un alignement
const DISCIPLINE_MAX = 1.8;

/** Période d'un instant du match : 1, 2, 3, puis la prolongation. */
export const periodeDe = t => (t < 20 ? 1 : t < 40 ? 2 : t < 60 ? 3 : 4);

/** Un but reçoit une passe principale, puis parfois une secondaire. */
const P_PASSE_1 = 0.95;   // réel : 1,66 passe par but sur 55 saisons (0,95 + 0,95 × 0,75 = 1,66)
const P_PASSE_2 = 0.75;
/*
 * LE POIDS D'UN DÉFENSEUR DANS LE TIRAGE DES PASSEURS. Deux des quatre
 * coéquipiers sur la glace sont des défenseurs, et sans ce poids ils
 * récoltaient 45 % des passes de la ligue contre 29,7 % réels sur 55 saisons
 * (27 % en 1975-76, 31 % en 2024-25) — Bowen Byram finissait à 94 points.
 * Réglé sur la mesure, et REMESURÉ en S62 quand la propension est devenue le
 * taux de passes du joueur : 0,3 avec l'ancienne formule, 0,38 avec celle-ci,
 * pour la même sortie de 29 à 30 % (`check_parts.mjs` en fait un repère).
 */
export const PASSE_D = 0.38;

/** Volume de tirs et finition d'un rappel de la ligue mineure. */
const RAPPEL_LANCERS = 0.70;
const RAPPEL_PCT_TIR = 0.80;

/**
 * Volume de tirs d'un joueur, en écart à sa ligue. Un ailier de 1981 et un
 * ailier de 2015 se comparent alors correctement : chacun est divisé par le
 * régulier moyen de sa propre saison, à sa propre position.
 */
function lancersRel(p) {
  if (!p) return RAPPEL_LANCERS;
  const est_D = p.p === 'D' || p.p === 'LD' || p.p === 'RD';
  const base = seasonLancers(p.s)[est_D ? 3 : 2];
  const perso = (p.sh || 0) / Math.max(1, p.gp || 1);
  if (!perso || !base) return RAPPEL_LANCERS;
  // La réputation de vitesse agit ici, sur le joueur : elle lui donne plus de
  // rondelles, où qu'on le place dans l'alignement.
  // Une SITUATION agit sur le même canal que la vitesse : c'est son volume
  // de rondelles à lui, où qu'on le place dans l'alignement.
  return borne(perso / base, 0.25, 2.60) * facteurLancersJoueur(p) * situDe(p, 'lancers') * facteurEnergie(p) * mutDe(p, 'lancers');
}

/**
 * Finition d'un joueur, en écart au % de tir de sa ligue. Sous 20 lancers
 * dans sa saison, le rapport ne veut rien dire et on le prend pour moyen.
 */
function pctTirRel(p) {
  if (!p) return RAPPEL_PCT_TIR;
  const lancers = p.sh || 0;
  if (lancers < 20) return 1;
  const ligue = seasonLancers(p.s)[1];
  if (!ligue) return 1;
  // La réputation de lancer agit ici : ce sont SES rondelles qui entrent plus.
  return borne(100 * (p.g || 0) / lancers / ligue, 0.35, 2.20) * facteurFinitionJoueur(p) * situDe(p, 'finition') * facteurEnergie(p) * mutDe(p, 'finition');
}

// La création d'un joueur, sa situation comprise : un joueur qui voit mieux
// le jeu fait marquer ses coéquipiers, et c'est le canal qui porte ça.
const passesRel = p => passesRelatives(p) * situDe(p, 'creation') * facteurEnergie(p) * mutDe(p, 'creation');

/**
 * Le facteur de création d'un lancer : la création des coéquipiers sur la
 * glace, rapportée à celle que le tireur a vraiment eue (`cx`), élevée à
 * BETA_CREATION. Vaut 1 pour un joueur rejoué avec ses vrais coéquipiers.
 */
function facteurCreation(glace, tireur) {
  let s = 0, n = 0;
  for (const p of glace) if (p !== tireur) { s += passesRel(p); n++; }
  if (!n) return 1;
  const contexte = (tireur && tireur.cx) || REF.crea;
  return Math.pow((s / n) / contexte, BETA_CREATION);
}

/**
 * Facteur du gardien : de combien il laisse passer, relativement à la ligue
 * de SA saison. Un gardien à ,920 en 1975 était hors norme, le même chiffre
 * en 2015 est ordinaire — c'est le rapport qui compte, jamais la valeur.
 */
function facteurGardien(g) {
  if (!g) return 1.20;
  const svLigue = 1 - seasonLancers(g.s)[1] / 100;
  const sv = g.sv || svLigue;
  // Une carte « Réflexes » (S78, js/rarete.js) ou le coach des gardiens (l'atelier) : quelques buts accordés de moins.
  // SES JAMBES (1.0, C4) : chaque 5 points de jambes perdus, 1 % de buts accordés de plus.
  return borne((1 - sv) / Math.max(0.02, 1 - svLigue), 0.55, 1.60) * mutDe(g, 'arrets') * usureGardien(g);
}

/*
 * LES JAMBES D'UN GARDIEN (1.0, C4). JP : *je comprends pas la gestion des
 * gardiens*. Un gardien ne s'use pas présence par présence comme un patineur :
 * il s'use de DÉPART EN DÉPART. Trois départs de suite ne coûtent rien ; au
 * quatrième, il perd `GARDIEN_JAMBES_PAS` (5) points de jambes par départ, et
 * chaque 5 points perdus lui coûtent `GARDIEN_USURE` (1 %) de buts accordés
 * de plus — jusqu'à 12 %. Une soirée où il ne part pas lui rend tout.
 * `_suite` compte ses départs consécutifs, `_aine` les jambes qu'un geste lui
 * a prises (« Laisser ses rituels ») jusqu'à sa prochaine soirée de congé.
 * Rien ne tire un dé : la rotation du club est une règle, et ton choix du
 * soir (« Devant le filet ce soir ») une décision qui se rejoue.
 */
export const GARDIEN_SUITE_LIBRE = 3, GARDIEN_JAMBES_PAS = 5, GARDIEN_USURE = 0.01, GARDIEN_JAMBES_MIN = 40;
export function jambesGardien(g) {
  if (!g) return 100;
  const pas = Math.max(0, (g._suite || 0) - (GARDIEN_SUITE_LIBRE - 1));
  return Math.max(GARDIEN_JAMBES_MIN, 100 - GARDIEN_JAMBES_PAS * pas - (g._aine || 0));
}
export const usureGardien = g => 1 + GARDIEN_USURE * (100 - jambesGardien(g)) / GARDIEN_JAMBES_PAS;
/* Après le match : le partant ajoute un départ à sa suite, les autres gardiens du club soufflent. */
function noterDepart(team, g) {
  if (!team || !g) return;
  const autres = [...SLOTS.map(s => team.roster[s.i]).filter(p => p && p.p === 'G'), team.rappelG].filter(Boolean);
  for (const p of autres) if (p !== g) { p._suite = 0; p._aine = 0; }
  g._suite = (g._suite || 0) + 1;
}

/* Exposés pour `scripts/check_neutre.mjs`, qui mesure le profil de l'équipe
 * moyenne — jamais recopiés ailleurs, une seule implémentation par formule. */
export const facteurGardienDe = facteurGardien;
export const pctTirRelDe = pctTirRel;
export const lancersRelDe = lancersRel;
export const passesRelDe = passesRel;

/** Propension à la passe : la part de points qu'un joueur récolte en passes. */
/*
 * LA PROPENSION EST LE TAUX DU JOUEUR, plus la part de ses points (S62).
 *
 * Elle valait `passes / points`, un rapport SANS ÉCHELLE : un ailier récoltait
 * donc la même fraction des passes de son trio quel que soit son propre taux,
 * et Elias Lindholm 2021-22 sortait à 81 passes pour 40 réelles à côté de
 * Gaudreau. C'est maintenant `passesRel` — ses passes par match, relatives au
 * régulier moyen de sa position et de sa saison — la MÊME quantité que le
 * canal de création lit déjà : aucune cote neuve, et un joueur récolte les
 * passes qu'il a vraiment récoltées. Mesuré : la corrélation entre le taux
 * réel et le simulé passe de 0,80 à 0,85 (`check_parts.mjs`).
 *
 * Les deux molettes servent à la PREUVE du garde-fou : `PASSE_TAUX=0` remet
 * l'ancienne formule et fait rougir `check_parts` sur la part des passes aux
 * défenseurs (34,9 %) et sur la corrélation (0,74).
 */
const PASSE_TAUX = Number(ENV_MESURE.PASSE_TAUX ?? 1);
const PASSE_D_MESURE = Number(ENV_MESURE.PASSE_D ?? PASSE_D);
const propensionPasse = p => (PASSE_TAUX
  ? passesRel(p) * (p.p === 'D' ? PASSE_D_MESURE : 1)
  : ((p.a || 0) / Math.max(1, p.pt || 1) + 0.05) * (p.p === 'D' ? PASSE_D : 1));

/** Minutes de punition par match d'un patineur, relatives au régulier moyen de sa saison. */
function punitionsRel(p) {
  if (!p || !p.gp) return 1;
  const base = seasonLancers(p.s)[7];
  if (!base) return 1;
  return borne(((p.pim || 0) / p.gp) / base, 0, 6);
}

/** L'année médiane des joueurs habillés : c'est elle qui fixe l'époque du match. */
function anneeDe(joueurs) {
  const annees = joueurs.map(p => parseInt((p.s || '').slice(0, 4), 10)).filter(Boolean).sort((a, b) => a - b);
  return annees.length ? annees[Math.floor(annees.length / 2)] : 2015;
}

const coteD = p => (p ? getHiddenRatings(p).d : REPLACEMENT);
const est_Def = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');

/**
 * Les unités spéciales d'un alignement, DEUX par situation comme dans la
 * vraie ligue. L'avantage range les attaquants par création et finition,
 * les défenseurs pareil : les trois et deux premiers font la première
 * unité (65 % du temps d'avantage), les suivants la deuxième. Le
 * désavantage range par cote défensive, deux et deux, deux unités (60/40).
 * Une seule unité par situation donnait 2,2 tirs d'avantage par match à
 * chacun de ses cinq joueurs — Datsyuk 2006-07 à 240 tirs d'avantage sur
 * une saison — parce que la vraie ligue les répartit sur dix.
 *
 * Elles ont la forme des unités ordinaires pour que `jouerCote` les joue
 * sans rien savoir : `choisirUnite` tire sur `poids`, `choisirPresence` sur
 * `presence`.
 */
function unitesSpeciales(habilles) {
  const F = habilles.filter(p => p && p.p !== 'G' && !est_Def(p));
  const D = habilles.filter(est_Def);
  const offensif = p => lancersRel(p) * pctTirRel(p) + passesRel(p);
  // QUAND LES SHARDS LE DISENT, ON LE LIT. Les points en avantage disent qui
  // jouait l'avantage, les points en désavantage qui le tuait : deux
  // colonnes de l'API que le build garde depuis RATINGS_VERSION 24. Sans
  // elles (shards plus anciens), on devine par la valeur offensive et la
  // cote défensive. Le classement mêle les deux pour départager les zéros.
  const mesure = habilles.some(p => p && p.ppp != null);
  const parMatch = (p, k) => ((p[k] || 0) / Math.max(1, p.gp || 1));
  const clAN = mesure ? p => parMatch(p, 'ppp') * 10 + offensif(p) : offensif;
  const clDN = mesure ? p => (parMatch(p, 'shp') + parMatch(p, 'shg')) * 200 + coteD(p) : coteD;
  const ranges = (liste, cle) => liste.slice().sort((a, b) => cle(b) - cle(a));
  const unite = (joueurs, poids, rang = 0) => ({
    joueurs, poids, presence: poids, qualite: 1, rang,
    coteDef: joueurs.length ? joueurs.reduce((a, p) => a + coteD(p), 0) / joueurs.length : REPLACEMENT,
  });
  const Fo = ranges(F, clAN), Do = ranges(D, clAN), Fd = ranges(F, clDN), Dd = ranges(D, clDN);
  const anF = [Fo.slice(0, 3), Fo.slice(3, 6)], anD = [Do.slice(0, 2), Do.slice(2, 4)];
  const dnF = [Fd.slice(0, 2), Fd.slice(2, 4)], dnD = [Dd.slice(0, 2), Dd.slice(2, 4)];
  // La part d'avantage d'un joueur : SES buts en avantage sur ses buts quand
  // le shard les porte (dix buts et plus pour que le rapport veuille dire
  // quelque chose), sinon la constante de son unité.
  const partAN = new Map();
  const partDe = (p, u) => (p.ppg != null && (p.g || 0) >= 10) ? borne(p.ppg / p.g, 0, 0.6) : PART_AN_TIRS[u];
  anF.forEach((js, u) => js.forEach(p => partAN.set(p, partDe(p, u))));
  anD.forEach((js, u) => js.forEach(p => partAN.set(p, partDe(p, u))));
  const premiere = [...anF[0], ...anD[0]];
  const volume = premiere.length ? borne(premiere.reduce((a, p) => a + lancersRel(p), 0) / premiere.length, 0.6, 1.6) : 1;
  const garnir = (unites, poids) => unites.map((js, u) => unite(js, poids[u], u)).filter(x => x.joueurs.length);
  return {
    avantage: { F: garnir(anF, POIDS_AN), D: garnir(anD, POIDS_AN), volume, partAN },
    desavantage: { F: garnir(dnF, POIDS_DN), D: garnir(dnD, POIDS_DN) },
  };
}

/** Le trio de fermeture par défaut : le 3e trio, s'il existe (voir FERMETURE_DEFAUT). */
function fermetureAuto(unitesF) {
  return unitesF.length > FERMETURE_DEFAUT ? FERMETURE_DEFAUT : null;
}

/** Pour l'écran : le trio que 'auto' désigne. */
export function trioDeFermetureAuto() {
  return FERMETURE_DEFAUT;
}

/** Le volume d'un joueur à forces égales : ses lancers, moins sa part d'avantage. */
const lancersFE = (p, partAN) => lancersRel(p) * (1 - ((partAN && partAN.get(p)) || 0));


/**
 * Le profil de match d'un alignement : combien il tire, comment il défend,
 * et qui est sur la glace à chaque présence.
 *
 * La chimie d'unité et le malus de zone entrent ici — moitié sur le volume
 * de lancers, moitié sur leur qualité. C'est ce qui rend le placement d'un
 * joueur décisif : une vedette au quatrième trio tire deux fois moins ET
 * traîne le malus de zone de l'unité. « Joue en bas » efface ce malus au
 * dernier rang seulement ; ses minutes, elles, ne bougent pas.
 */
export function profilMatch(team, lineup, adv = null) {
  const habilles = SLOTS.filter(s => !s.scratch).map(s => lineup[s.i]).filter(Boolean);
  const speciales = unitesSpeciales(habilles);
  const membresAN = speciales.avantage.partAN;
  const unites = { F: [], D: [] };
  // LA CHIMIE DE CE SOIR (S73), ligne par ligne, avec les tactiques jouées ce soir.
  const lignesSoir = lignesDe(team, lineup);
  const appSoir = apprentissageDe(team);
  const chimieSoir = [0, 1, 2, 3].map(u => chimieLigne(appSoir, lineup, u, lignesSoir[u]));
  // LE ROULEMENT décide de la glace, et il touche les DEUX parts : l'offensive
  // (qui tire) et la présence (qui défend, et qui reçoit le +/-).
  const parts = { F: partsDuRoulement(PART_UNITE.F, 'F', team), D: partsDuRoulement(PART_UNITE.D, 'D', team) };
  const presences = { F: partsDuRoulement(POIDS_TRIO, 'F', team), D: partsDuRoulement(POIDS_PAIRE, 'D', team) };
  for (const [group, poids] of [['F', presences.F], ['D', presences.D]]) {
    for (let u = 0; u < poids.length; u++) {
      const slots = SLOTS.filter(s => s.group === group && s.unit === u && !s.scratch);
      const syn = getUnitSynergy(lineup, group, u);
      const mod = Math.sqrt(Math.exp(((syn.bonusOff || 0) + bonusChimie(neutreDe(team, 'chimie') ? CHIMIE_PIVOT : CHIMIE_FORCEE != null && team.isPlayer ? CHIMIE_FORCEE : chimieSoir[u])) / SYN_ECHELLE));
      const volume = Math.min(VOLUME_UNITE_MAX,
        slots.reduce((a, s) => a + lancersFE(lineup[s.i], membresAN), 0) / slots.length);
      const joueurs = slots.map(s => lineup[s.i]).filter(Boolean);
      unites[group].push({
        joueurs,
        rang: u,   // le rang de l'unité : l'appariement des trios le lit
        // Poids OFFENSIF : temps de glace, volume de tirs TEMPÉRÉ et chimie.
        // C'est lui qui décide qui tire. Le volume est tempéré parce qu'il
        // contient déjà le temps de glace (voir VOLUME_EXPOSANT), et les
        // poids sont renormalisés juste après pour que leur somme — donc la
        // pression d'équipe — reste celle d'avant.
        poids: parts[group][u] * Math.pow(volume / (VOLUME_CENTRE ? VOLUME_RANG[group][u] : 1), VOLUME_EXPOSANT) * mod,
        brut: parts[group][u] * volume * mod,
        qualite: mod,
        /*
         * Poids DÉFENSIF : le temps de glace seul. Une unité ne défend pas
         * plus souvent parce qu'elle tire plus — elle défend sa part de
         * présences, point.
         *
         * ET C'EST LA PART DE FORCES ÉGALES, pas celle de toutes les
         * situations (S63). `jouerCote` joue le cinq contre cinq : une unité y
         * défend sa part de MINUTES À CINQ CONTRE CINQ, qui n'est pas son
         * temps de glace total — le premier trio passe une part de ses minutes
         * en avantage (34 % de la glace, 30 % du cinq contre cinq) et le
         * quatrième n'en passe aucune (16 % de la glace, 20,5 % du cinq contre
         * cinq). Avec `POIDS_TRIO`, le quatrième trio était sur la glace pour
         * 16 % des buts alloués alors qu'il joue 20,5 % des minutes où ils
         * tombent : il encaissait un cinquième de moins que son dû, et son
         * +/- valait 0,107 du différentiel de l'équipe contre 0,035 en vrai.
         */
        presence: parts[group][u],
        coteDef: unitAvgLineup(team, lineup, group, u, 'd'),
      });
    }
  }

  // LA SOMME NE BOUGE PAS. Tempérer le volume change le rapport entre les
  // unités ; renormaliser par groupe garantit que la pression d'équipe —
  // `somme('F')` et `somme('D')` ci-dessous, donc les lancers du club — est
  // au centième celle d'avant le tempérament. Sans ça, ce chantier aurait
  // déplacé les 28,5 lancers et les 3,1 buts par match que `check_feuilles`
  // tient, et on n'aurait plus su ce qu'on mesurait.
  for (const g of ['F', 'D']) {
    const sb = unites[g].reduce((a, x) => a + x.brut, 0);
    const st = unites[g].reduce((a, x) => a + x.poids, 0);
    if (st > 0 && sb > 0) for (const x of unites[g]) x.poids *= sb / st;
    /*
     * LE RYTHME GARDE LE VOLUME NON TEMPÉRÉ (S65). `brut` était SUPPRIMÉ ici,
     * et c'est ce qui a failli faire mentir la mesure de ce chantier : le
     * tirage du −1 lisait `x.brut`, ne trouvait rien, et retombait
     * silencieusement sur `x.poids` — quatre réglages, quatre lectures
     * identiques. Un champ qu'on lit ailleurs ne se supprime pas ; il se
     * renomme pour ce qu'il sert. Renormalisé sur la présence pour que le
     * rapport `rythme / presence` soit centré sur 1 et que `RYTHME_CREDIT` se
     * lise comme une inclinaison plutôt que comme une échelle.
     */
    const sp = unites[g].reduce((a, x) => a + x.presence, 0);
    for (const x of unites[g]) { x.rythme = sb > 0 && sp > 0 ? x.brut * sp / sb : x.presence; delete x.brut; }
  }

  /*
   * LES CONSIGNES PAR UNITÉ (S68), APRÈS la renormalisation : c'est voulu.
   * Une unité en échec avant tire PLUS quand elle est sur la glace — la
   * pression de l'équipe monte — au lieu de prendre ses lancers aux autres.
   */
  // LES LIGNES À LA HOCKEYARENA (S68) : chaque unité joue la tactique et
  // l'agressivité de SA ligne (le trio u et la paire u forment la ligne u).
  const lignes = lignesDe(team, lineup);
  let discTac = 0, discAgr = 0, robTac = 0, sP = 0, defStyle = 0;
  for (const g of ['F', 'D']) unites[g].forEach((x, u) => {
    // S79 : le trio joue le système d'avants de sa ligne, la paire celui de défenseurs,
    // et chacun en tire ce que son FIT lui permet (`canalSysteme`).
    const l = lignes[u], A = AGRESSIVITES[l.agr];
    const cle = g === 'D' ? l.tacD : l.tac;
    const S = g === 'D' ? SYSTEMES_D[cle] : TACTIQUES[cle];
    const fit = S && S.slots ? (fitUnite(lineup, g, u, cle) ?? 0) : 0;
    const c = canal => canalSysteme(S, fit, canal);
    const ph = physiqueUnite(lineup, g, u);
    const eff = rendementPhysique(ph);
    x.ligne = u; x.tactique = cle; x.fit = fit; x.agr = l.agr;
    x.chimie = chimieSoir[u];
    x.poidsJ = x.poids;   // LE TEMPO : la pression des joueurs seuls, avant le système (voir attenduDeCote)
    x.poids *= c('volume');
    x.qualite *= c('finition');
    // LES BADGES (voir PALIERS) : ce que l'unité étouffe et intimide pendant ses présences, ce qu'elle tire de la pointe — chaque joueur le sien.
    if (g === 'F') {
      x.etouffe = 1 - EFFET_ROLE.checker * maitriseUnite(x.joueurs, 'checker') - EFFET_ROLE.deuxsens * maitriseUnite(x.joueurs, 'deuxsens');
      x.intimide = 1 - EFFET_ROLE.bagarreur * maitriseUnite(x.joueurs, 'bagarreur');
    } else {
      x.etouffe = 1 - EFFET_ROLE.defensif * maitriseUnite(x.joueurs, 'defensif') - EFFET_ROLE.physique * maitriseUnite(x.joueurs, 'physique');
      x.intimide = 1;
      x.poids *= 1 + EFFET_ROLE.offensif * maitriseUnite(x.joueurs, 'offensif');
      x.poidsJ *= 1 + EFFET_ROLE.offensif * maitriseUnite(x.joueurs, 'offensif');
    }
    // Plus physique, on donne moins — CENTRÉ sur l'agressivité moyenne, pour
    // que le réglage par défaut ne déplace pas la ligue.
    x.defTac = c('defense') * (1 - A.def * eff);
    defStyle += x.presence * x.defTac;
    discTac += x.presence * c('discipline');
    discAgr += x.presence * A.pun * coutPhysique(ph);
    robTac += x.presence * (1.5 * (A.physique - 0.4) + 0.3 * (c('physique') - 1)) * eff;
    sP += x.presence;
  });
  defStyle = sP ? defStyle / sP : 1;
  discTac = sP ? discTac / sP : 1; discAgr = sP ? discAgr / sP : 0; robTac = sP ? robTac / sP : 0;

  // Le trio de fermeture de cet alignement : désigné, ou le 3e trio
  // (voir FERMETURE_DEFAUT).
  const ferm = team && team.fermeture !== 'auto' && team.fermeture !== undefined ? team.fermeture : fermetureAuto(unites.F);
  for (const u of unites.F) u.fermeture = ferm != null && u.rang === ferm;

  const somme = (g, k = 'poids') => unites[g].reduce((a, x) => a + x[k], 0);
  const pression = (1 - PART_LANCERS_D) * somme('F') + PART_LANCERS_D * somme('D');
  const pressionJ = (1 - PART_LANCERS_D) * somme('F', 'poidsJ') + PART_LANCERS_D * somme('D', 'poidsJ');
  for (const g of ['F', 'D']) for (const x of unites[g]) delete x.poidsJ;

  const coteDef = 0.5 * (
    presences.F.reduce((a, w, u) => a + w * unites.F[u].coteDef, 0) +
    presences.D.reduce((a, w, u) => a + w * unites.D[u].coteDef, 0));

  // Les traits appartiennent au JOUEUR, pas à sa case : ils rendent partout
  // dans l'alignement, du premier trio au troisième duo. C'est le malus de
  // zone qui punit de mal placer quelqu'un, et il le fait déjà. Seule
  // condition : être habillé — `lineup` ne contient pas les réservistes.

  // La finition de l'équipe : le % de tir de ses patineurs, pondéré par leurs
  // lancers. Au-dessus de FINITION_MAX, tous ses tireurs sont ramenés d'autant.
  let sL = 0;
  for (const p of habilles) if (p.p !== 'G') sL += lancersRel(p);
  // La création dans CET alignement, et ce qu'elle change à chaque tireur par
  // rapport à son contexte réel. Elle entre dans la finition d'équipe, donc
  // sous le même plafond : un passeur de génie ne fait pas dépasser ce que
  // l'histoire a vu. `creaEquipe` sert à `check_neutre.mjs`.
  const moyU = (g, poids) => {
    let s = 0, w = 0;
    poids.forEach((wt, u) => {
      const js = unites[g][u].joueurs;
      if (js.length) { s += wt * js.reduce((a, p) => a + passesRel(p), 0) / js.length; w += wt; }
    });
    return w ? s / w : RAPPEL_PASSES;
  };
  const Fbar = moyU('F', presences.F), Dbar = moyU('D', presences.D);
  const creaEquipe = 0.56 * Fbar + 0.44 * Dbar;
  let sLC = 0;
  for (const [g, taille] of [['F', 3], ['D', 2]]) {
    for (const un of unites[g]) for (const p of un.joueurs) {
      const memes = un.joueurs.filter(x => x !== p).map(passesRel);
      while (memes.length < taille - 1) memes.push(RAPPEL_PASSES);
      const autour = creationAutour(g === 'D', memes, g === 'D' ? Fbar : Dbar);
      sLC += lancersRel(p) * pctTirRel(p) * Math.pow(autour / (p.cx || REF.crea), BETA_CREATION);
    }
  }
  const finEquipe = sL ? sLC / sL : 1;

  const patineurs = habilles.filter(p => p.p !== 'G');
  const cartes = effetsDeSaison(team, adv, lineup);
  // L'indiscipline de l'alignement SANS les effets (C5) : `totauxDuSoir` en tire ce que les effets y changent, bornes comprises.
  const disciplineBase = patineurs.length
    ? discTac * patineurs.reduce((a, p) => a + punitionsRel(p), 0) / patineurs.length + discAgr : 1;

  return {
    unites,
    ...speciales,
    patineurs,
    // L'indiscipline : combien cet alignement prend de punitions, relativement
    // à un alignement de réguliers moyens de la même époque. 1 = la moyenne.
    // L'indiscipline : combien cet alignement prend de punitions. Le plan de
    // match entre ICI — un échec avant lourd se paie à l'arbitre.
    discipline: patineurs.length
      ? borne(cartes.discipline * disciplineBase, DISCIPLINE_MIN, DISCIPLINE_MAX)
      : cartes.discipline,
    disciplineBase, cartes,
    annee: anneeDe(habilles),
    // Les occasions d'avantage de cet alignement : mesurées par saison quand
    // les shards les portent, repère d'époque sinon (voir occasionsDe).
    occasions: patineurs.length ? patineurs.reduce((a, p) => a + occasionsDe(p), 0) / patineurs.length : null,
    // LES CARTES DE SAISON entrent ici, et NULLE PART AILLEURS : ce sont des
    // facteurs sur des quantités que le profil porte déjà. `pression` reste
    // sous sa borne, `finitionFacteur` sous la sienne (le plafond du jeu ne
    // se contourne pas avec une carte).
    pression: borne(pression * cartes.volume, 0.40, REF.pression * PRESSION_MAX),
    pressionBrute: pression,
    // LE TEMPO (voir attenduDeCote) : ce que les joueurs poussent seuls, et le style qui ralentit ou ouvre le jeu.
    pressionJ,
    styleVol: pressionJ > 0 ? pression / pressionJ * cartes.volume / REF_STYLE_VOL : 1,
    styleDef: defStyle * cartes.defense / REF_STYLE_DEF,
    finEquipe, creaEquipe,
    finitionFacteur: Math.min(FINITION_MAX / finEquipe, cartes.finition),
    zDef: borne((coteDef - MOY_DEF_EQUIPE) / ECART_DEF_EQUIPE, -5, 3),
    traitDef: facteurDefensifEquipe(habilles) * cartes.defense,
    traitRob: bonusRobustesseEquipe(habilles) + cartes.robustesse + robTac,
    traitAtt: facteurAttaqueEquipe(habilles),
    traitSeries: facteurSeriesEquipe(habilles),
    meneur: bonusMeneurEquipe(habilles),
  };
}

/*
 * LE +/- VA À CEUX QUI ÉTAIENT SUR LA GLACE — et ce ne sont pas toujours les
 * cinq de la case. JP, devant une table d'équipe : *the +/- is not really
 * linked to who is on ice when the goals are scored* — un quatrième trio
 * entier à −28, −28, −26 sur une équipe de 50 victoires, une première paire
 * à +32 et +32. Mesuré (`check_pm.mjs`, deux ligues de vraies équipes) :
 * l'écart du 1er au 4e trio était de 31,5 buts contre 11,2 dans la vraie
 * ligue, et deux coéquipiers d'une même unité finissaient à 2,6 buts l'un de
 * l'autre contre 11,2. Trois mécaniques du vrai hockey manquaient.
 *
 *   APPARIEMENT   le quatrième trio ne défend pas contre le premier trio
 *                 adverse à sa part de présence : l'entraîneur apparie. À
 *                 chaque lancer, l'unité qui défend se tire à la présence
 *                 PONDÉRÉE par la proximité de rang avec le trio qui
 *                 attaque, exp(−APPARIEMENT × |rang − rang|) sur des rangs
 *                 ramenés à [0, 1]. Ça change ce qui est joué (les meilleurs
 *                 défendent plus contre les meilleurs) — remesuré par
 *                 check_feuilles et check_monotonie.
 *   PROPRE        la première paire joue avec le premier trio, la troisième
 *                 avec le quatrième : la paire qui accompagne le trio qui
 *                 tire (et le trio qui accompagne la paire qui tire) se tire
 *                 de la même façon, avec APPARIEMENT_PROPRE. Sans ça la
 *                 première paire finissait à −1 quand la vraie est à +9.
 *   MÉLANGE       les changements à la volée. Quand un but est marqué, chacun
 *                 des cinq nominaux de chaque côté est, avec la probabilité
 *                 P_MELANGE, remplacé au +/- par un coéquipier d'une autre
 *                 unité du même groupe (tiré à la présence) : il venait de
 *                 sauter sur la glace, ou de la quitter. Ça ne change RIEN à
 *                 ce qui est joué ni aux passes — seulement qui reçoit le
 *                 +1 et le −1, et la somme des +/- reste 5 × le différentiel.
 *   LE RYTHME     JP, après tout ça : *les +/- des joueurs sont toujours
 *                 démesurés*. Sur six vraies équipes dominantes rejouées, la
 *                 distribution triée des +/- d'une équipe faisait une MARCHE
 *                 après cinq joueurs — le premier trio et la première paire à
 *                 +85, puis +40 — là où la vraie descend en pente (Canadien
 *                 1976-77 : 128, 91, 91, 83, 75, 75, 51, 49…). Le premier trio
 *                 était sur la glace pour la moitié des buts pour (il tire,
 *                 c'est son poids offensif) et pour le tiers des buts contre
 *                 (sa présence). Dans la vraie ligue les deux parts se
 *                 tiennent : le premier trio joue contre le premier trio, et
 *                 le rythme monte des deux côtés quand il est là. Le −1 se
 *                 tire donc au VOLUME de l'unité qui défendait (avec
 *                 l'appariement), pas à sa présence seule — et jamais SOUS sa
 *                 présence, voir RYTHME_BASE et RYTHME_PLANCHER, que S65 a dû
 *                 écrire parce que la base `poids` était devenue inerte.
 *                 Crédit seulement :
 *                 la probabilité du but reste calculée sur l'unité tirée à la
 *                 présence, ce qui est joué ne change pas. La marche disparaît
 *                 (Islanders 1977-78 : 45 42 39 39 33 29 26 26 contre 58 55 50
 *                 46 41 39 35 35 réels), et le meilleur +/- d'une équipe à +60
 *                 passe de 0,63 à 0,55 fois son différentiel (réel 0,36 sur
 *                 380 équipes, mais 0,55 pour le Canadien de 1976-77 : une
 *                 équipe à +150 fait des +80, c'est le hockey).
 *
 * Mesuré après, huit ligues (`check_pm.mjs`) : voir CLAUDE.md, le réglage se
 * lit dans ce script.
 */
const APPARIEMENT = 2.5;
const APPARIEMENT_PROPRE = 5.0;
/*
 * LE PLAN D'APPARIEMENT, ET LE TRIO DE FERMETURE. JP : *pouvoir faire des
 * lockdown lines qui bloquent mieux les adversaires, en prenant en compte
 * dans la vraie vie l'impact que ça a* ; puis, devant le premier jet : *le
 * matching des lignes devrait être genre 1 v 3, 2 v 2 et 4 v 4
 * généralement ; aussi, pas des changements égaux de chaque côté, pour
 * avoir plus de confrontations que juste celles-là*.
 *
 * Le moteur appariait par PROXIMITÉ DE RANG — le premier trio défend contre
 * le premier — et c'était faux : dans la vraie ligue, l'entraîneur envoie
 * son trio de fermeture (généralement le 3e) contre le premier trio adverse,
 * le 2e contre le 2e, le 4e contre le 4e, et son propre premier trio se
 * retrouve donc contre le 3e adverse. La CIBLE d'appariement est donc une
 * permutation des rangs : 0 ↔ fermeture, les autres sur eux-mêmes. Autour
 * de cette cible, les changements se dispersent comme avant
 * (exp(−k × |rang − cible|)) : les changements à la volée ne sont jamais
 * synchronisés, et c'est ce qui donne toutes les autres confrontations.
 *
 * ET LES DEUX CÔTÉS NE SONT PAS ÉGAUX : c'est l'équipe à DOMICILE qui a le
 * dernier changement, donc elle obtient son appariement ; le visiteur subit
 * celui de l'autre et le sien est plus lâche (APPARIEMENT_VISITEUR plus
 * petit). `A` est l'équipe à domicile — le brassage du calendrier fait
 * alterner. C'est ce qui fait qu'un premier trio ne voit pas toujours le
 * même trio de fermeture, et que la fermeture n'est pas un mur.
 *
 * Le trio de fermeture n'a AUCUNE cote neuve : son blocage pendant ces
 * présences est la cote `d` de ses trois joueurs (K_DEFENSE, mesuré) et, pour
 * un Selke ou un bidirectionnel, le canal des présences (9 %). Par défaut
 * c'est le 3e trio pour tout le monde (`'auto'`) ; derrière le banc, le 🔒
 * le déplace ou le retire. Désigner un trio ordinaire, c'est l'envoyer se
 * faire marquer dessus — et sa fiche le dit.
 *
 * Les deux forces d'appariement se lisent dans l'environnement POUR LA
 * MESURE (check_pm.mjs) ; le navigateur n'a pas de `process` et prend les
 * valeurs écrites ici.
 */
const FERMETURE_DEFAUT = 2;   // le 3e trio
const APPARIEMENT_VISITEUR = Number(ENV_MESURE.APPARIEMENT_VISITEUR ?? 1.0);
/*
 * LA FORCE DU PLAN. Un plan STRICT (la cible du premier trio adverse est la
 * fermeture, toujours) fait exploser le +/- par rang : premier trio à +21,7
 * (réel +6,1), troisième à −13,8 (réel −1,9), écart du 1er au 4e trio de 27
 * contre 11,4 réel — parce qu'affronter le 3e trio adverse plutôt que le
 * 1er est, dans le moteur, un écart de poids offensif énorme. Mais le plan
 * met l'ORDRE dans le bon sens (F1 > F2 > F3 > F4, le 4e à −5,3 comme le
 * réel), ce que l'appariement par rang n'avait jamais. Une présence sur
 * PLAN_FERMETURE suit donc le plan, les autres le rang — un mélange de
 * TIRAGES, pas une cible interpolée (voir choisirApparie). Mesuré sur
 * check_pm.mjs, quatre ligues, visiteur à 1,0 (réel : F1 +6,1 / F3 −1,9 /
 * F4 −5,3, écart 11,4) :
 *
 *   plan   F1     F3     F4    écart 1er→4e
 *   0      +6,7   −2,9   −2,2   8,9   (le rang seul, l'ordre F3 > F4 faux)
 *   0,25   +11,0  −5,8   −3,5   14,4
 *   0,40   +11,9  −7,0   −2,7   14,6
 *   0,60   +15,2  −7,8   −5,0   20,1
 *   1      +21,7  −13,8  −5,3   27,0  (le plan strict)
 *
 * De 0,25 à 0,40 l'écart ne bouge pas ; au-delà il décolle. À 0,40 le trio
 * de fermeture est, de loin, celui qui voit le plus le premier trio
 * adverse — « généralement 1 v 3 » — pour le même écart qu'à 0,25.
 */
const PLAN_FERMETURE = Number(ENV_MESURE.PLAN_FERMETURE ?? 0.40);
const P_MELANGE = Number(ENV_MESURE.P_MELANGE ?? 0.40);
/*
 * LE −1 SUIT LE RYTHME : 0 le met à la présence seule, plus haut il l'incline
 * vers les unités qui génèrent le plus (voir CREDIT_AU_RYTHME plus haut et
 * `RYTHME_BASE` juste dessous).
 *
 * LE PREMIER TRIO EST PLUS FAIBLE DÉFENSIVEMENT (S65). JP, devant les fiches
 * de S63 : *je veux que le premier trio soit plus faible défensivement i
 * guess?* — c'est sa réponse à la question que S63 avait laissée ouverte, et
 * c'était bien un choix de conception à prendre avec lui. Mesuré en PART DU
 * DIFFÉRENTIEL du club (`check_pm.mjs` le rend maintenant par rang), le
 * premier trio valait 0,397 quand les vraies équipes fortes sans joueur
 * échangé en donnent 0,305 : il était sur la glace pour 34 % des buts POUR et
 * seulement 30 % des buts CONTRE, là où les deux parts se tiennent dans la
 * vraie ligue — un premier trio joue contre ce que l'adversaire a de mieux.
 *
 * ET LE RÉGLAGE SE LIT SUR HUIT LIGUES, PAS SUR QUATRE. À quatre, 1,5 mettait
 * le premier trio pile sur le réel (0,304 contre 0,305) ; à huit il tombe à
 * 0,262 contre 0,322 — le premier trio devenait trop FAIBLE, et le réel
 * lui-même bouge d'un échantillon à l'autre (18 joueurs contre 33). C'est la
 * règle du dépôt, appliquée une fois de plus : un repère se lit sur
 * l'échantillon qui l'a fixé, et `check_pm` fait autorité à `LIGUES=8`.
 *
 * Mesuré à HUIT ligues — part du différentiel du premier et du quatrième trio,
 * écart du premier au quatrième, meilleur +/- d'une équipe à +60 :
 *
 *   avant (0,5 sur `poids`)     0,377 · 0,066 · 8,8 · 0,51
 *   **0,75 sur `rythme`**       **0,304 · 0,078 · 6,6 · 0,49**
 *   1 sur `rythme`              0,314 · 0,121 · 5,8 · 0,48
 *   1,25 sur `rythme`           0,300 · 0,111 · 5,4 · 0,47
 *   1,5 sur `rythme`            0,262 · 0,112 · 4,8 · 0,45
 *   réel                        0,322 · 0,028 · 10,4 · 0,46
 *
 * 0,75 est retenu parce qu'il gagne TROIS colonnes sur quatre : le premier
 * trio à 0,94 du réel (1,0 fait 0,98, à peine mieux), le quatrième trio le
 * moins dégradé de tous les crans, et l'écart du premier au quatrième le mieux
 * conservé. Les lectures ne sont pas monotones d'un cran à l'autre — ±0,02 de
 * bruit — donc on choisit sur l'ensemble des colonnes, jamais sur une seule.
 *
 * Le premier trio passe donc de 17 % AU-DESSUS du réel à 6 % en dessous, et le
 * meilleur +/- d'une grande équipe de 0,51 à 0,49 pour un réel de 0,46 — le
 * chiffre que JP avait nommé deux chantiers plus tôt (*les +/- des joueurs sont
 * toujours démesurés*).
 *
 * CE QUE ÇA COÛTE, ET C'EST ÉCRIT PLUTÔT QUE CACHÉ : la somme des −1 est fixe,
 * donc ce qu'on donne au premier trio se prend ailleurs. Le quatrième trio
 * monte de 0,066 à 0,078 (réel 0,028) et l'écart du premier au quatrième tombe
 * de 8,8 à 6,6 (réel 10,4). Le plancher (voir `RYTHME_PLANCHER`) est ce qui
 * garde ce prix petit : sans lui, à 1 de crédit, le quatrième trio allait à
 * 0,161 et l'écart à 2,8.
 *
 * ET LA CAUSE PROFONDE, trouvée en mesurant et NON corrigée : le +/- réel
 * compte les buts encaissés en DÉSAVANTAGE numérique (la règle de la ligue
 * n'exclut que les buts en avantage), et le moteur n'en crédite aucun. Ce sont
 * les unités de désavantage — les trios défensifs et les deux premières paires
 * — qui encaissent ces buts-là dans la vraie ligue, ce qui explique que les
 * vrais F3, F4, D1 et D2 aient un +/- bien plus bas que le moteur ne leur en
 * donne. C'est une mécanique qui manque, pas un réglage, et elle irait dans
 * le SENS INVERSE de ce que JP demande ici (elle baisse le bas de
 * l'alignement, donc relève le haut à somme fixe) : les deux se prennent
 * ensemble ou pas du tout.
 */
const RYTHME_CREDIT = Number(ENV_MESURE.RYTHME_CREDIT ?? 0.75);
/*
 * SUR QUOI LE RYTHME S'INCLINE, et c'est ce que S62 avait rendu INERTE sans
 * s'en apercevoir (molette de mesure, voir S65).
 *
 * La formule est `presence × (base / presence)^RYTHME_CREDIT`, donc tout se
 * joue dans le RAPPORT. Avec `poids`, ce rapport vaut
 * `(volume / VOLUME_RANG)^VOLUME_EXPOSANT × chimie` — et le volume est CENTRÉ
 * par rang depuis S62, donc il vaut 1 pour TOUTES les unités : la constante ne
 * distinguait plus un premier trio d'un quatrième, elle ne dosait plus que
 * l'écart d'une équipe à l'autre. Mesuré : 0 · 0,5 · 1 donnaient 0,366 ·
 * 0,358 · 0,358 du différentiel au premier trio — trois lectures identiques
 * pour une constante censée tout décider.
 *
 * Avec `rythme` (le volume non tempéré, posé juste après la renormalisation
 * des poids), le rapport est le volume NON centré (1,57 au premier trio,
 * 0,80 au quatrième — `VOLUME_RANG`), donc le gradient par rang revient, et
 * c'est exactement ce que la phrase « le rythme monte des deux côtés quand le
 * premier trio est là » veut dire : un trio qui génère beaucoup de lancers
 * joue dans un match plus ouvert, et il en concède plus.
 */
const RYTHME_BASE = ENV_MESURE.RYTHME_BASE || 'rythme';
/*
 * LE RYTHME NE DESCEND PAS SOUS LA PRÉSENCE (S65), et c'est ce qui rend la
 * demande de JP livrable. La somme des −1 est FIXE (5 × les buts alloués) :
 * donner au premier trio, c'est retirer à quelqu'un, et le quatrième trio est
 * le plus sensible de tous — son +/- est une petite différence entre deux gros
 * nombres, donc réduire son −1 de 11 % DOUBLE son +/-. Mesuré sans plancher :
 * le premier trio tombe pile sur le réel (0,310 contre 0,305 du différentiel)
 * et le quatrième explose dans l'autre sens (0,161 contre 0,021), l'écart du
 * premier au quatrième passant de 9,6 à 2,8 pour un réel de 11,4. On corrigeait
 * le haut en cassant le bas.
 *
 * Avec le plancher, seules les unités qui génèrent PLUS que leur part de
 * présence encaissent davantage ; le tirage normalise, donc les autres perdent
 * chacune un peu au lieu que le quatrième trio perde beaucoup. C'est aussi ce
 * que le hockey dit : un trio offensif est sur la glace pour plus de buts
 * contre que ses minutes n'en contiennent, mais un trio défensif n'est pas
 * sur la glace pour MOINS — il joue contre le meilleur de l'adversaire.
 */
const RYTHME_PLANCHER = Number(ENV_MESURE.RYTHME_PLANCHER ?? 1);

/**
 * Une unité tirée à la présence, appariée au rang d'une autre : l'unité qui
 * défend contre le trio qui attaque, ET la paire qui accompagne son propre
 * trio (la première paire joue avec le premier trio — c'est ce qui lui
 * donne son +/- dans la vraie ligue, +9 contre −1 sans ça).
 */
function choisirApparie(unites, rangOff, nOff, k = APPARIEMENT, cle = 'presence', plan = false) {
  if (!unites.length) return unites[0];
  const nDef = unites.length;
  // Le plan de l'entraîneur (voir FERMETURE_DEFAUT) : le premier trio
  // adverse est visé par la fermeture, la fermeture adverse par le premier,
  // les autres par leur rang. Sans plan (les paires, l'appariement propre,
  // les unités spéciales), la cible est le rang lui-même.
  let rangCible = rangOff;
  if (plan) {
    const ferm = unites.find(x => x.fermeture);
    if (ferm) {
      // Un MÉLANGE DE TIRAGES, jamais une cible interpolée : à mi-chemin entre
      // le 1er et le 3e trio, une cible interpolée tombait sur le 2e, qui
      // mangeait tout le premier trio adverse (F2 à −12 mesuré). Ici, une
      // présence sur PLAN_FERMETURE suit le plan, les autres le rang.
      const duPlan = rangOff === 0 ? ferm.rang : rangOff === ferm.rang ? 0 : rangOff;
      if (hasard() < PLAN_FERMETURE) rangCible = duPlan;
    }
  }
  const cible = nOff > 1 ? rangCible / (nOff - 1) : 0;
  // `rythme` : la présence, inclinée vers le poids offensif (voir RYTHME_CREDIT).
  const de = x => (cle === 'rythme'
    ? x.presence * Math.pow(Math.max(RYTHME_PLANCHER, (x[RYTHME_BASE] || x.poids || x.presence) / (x.presence || 1)), RYTHME_CREDIT)
    : (x[cle] || x.presence));
  const poids = unites.map(x => de(x) * Math.exp(-k * Math.abs((nDef > 1 ? (x.rang || 0) / (nDef - 1) : 0) - cible)));
  let r = hasard() * poids.reduce((a, b) => a + b, 0);
  for (let i = 0; i < unites.length; i++) { r -= poids[i]; if (r <= 0) return unites[i]; }
  return unites[unites.length - 1];
}

/** Les cinq crédités du +/- : les nominaux, dont une part vient de changer. */
function surLaGlace(trio, paire, unites, garde = null) {
  const out = [];
  for (const [u, groupe] of [[trio, unites.F], [paire, unites.D]]) {
    if (!u) continue;
    for (const p of u.joueurs) {
      if (p !== garde && groupe.length > 1 && hasard() < P_MELANGE) {
        const autres = groupe.filter(x => x !== u && x.joueurs.length);
        if (autres.length) {
          const v = choisirPresence(autres);
          out.push(v.joueurs[Math.floor(hasard() * v.joueurs.length)]);
          continue;
        }
      }
      out.push(p);
    }
  }
  return out;
}

/** Tire une unité au prorata de sa part de présences, sans le volume de tirs. */
function choisirPresence(unites) {
  let r = hasard() * unites.reduce((a, x) => a + x.presence, 0);
  for (const x of unites) { r -= x.presence; if (r <= 0) return x; }
  return unites[unites.length - 1];
}

/*
 * L'adversaire de la saison solo : strictement moyen sur les quatre axes.
 * Il faut le dire explicitement, sinon un profil sans joueurs hérite des
 * valeurs de RAPPEL — un tireur de ligue mineure et pas de gardien — et la
 * saison solo devient un tir au but contre un filet désert.
 */
const PROFIL_NEUTRE = {
  unites: null, avantage: null, desavantage: null, patineurs: [],
  discipline: 1, annee: null, occasions: null,
  pression: REF.pression, zDef: REF.zDef,
  pctTirDefaut: PCT_TIR_NEUTRE, fgDefaut: REF.fg,
};

/** Le meilleur joueur offensif de ce côté : celui que « La chasse » colle. Pur, départagé par la clé. */
function vedetteOffensive(patineurs) {
  let best = null, score = -1;
  for (const p of patineurs || []) {
    if (!p || p.p === 'G') continue;
    const s = lancersRel(p) * pctTirRel(p);
    if (!best || s > score || (s === score && getPlayerKey(p) < getPlayerKey(best))) { score = s; best = p; }
  }
  return best;
}

/** Tire une unité au prorata de son poids de présence. */
function choisirUnite(unites) {
  let r = hasard() * unites.reduce((a, x) => a + x.poids, 0);
  for (const x of unites) { r -= x.poids; if (r <= 0) return x; }
  return unites[unites.length - 1];
}

/*
 * LES LANCERS ATTENDUS d'un côté sur tout le match à cinq contre cinq, avant la part de forces égales :
 * le seul endroit qui dit combien un club tire. Le moteur le joue (`jouerCote`) et l'écran le lit
 * (js/impact.js) — c'est ce qui rend le chiffre annoncé égal à celui qui est joué.
 */
export function attenduDeCote(off, def) {
  return LANCERS_BASE
    * (off.pression / REF.pression)
    * Math.pow(Math.max(0.3, def.pression / REF.pression), -ALPHA_POSSESSION)
    * (1 - K_VOLUME_DEF * ((def.zDef ?? REF.zDef) - REF.zDef))
    * tempoDe(def, off);
}

/*
 * LE TEMPO (docs/impact-des-choix.md §4, étape 4). JP : *si je fais juste des choix défensifs, ça doit être un
 * match défensif.* Le moteur ne le faisait pas : une carte lente coupait SES tirs et en donnait un peu à
 * l'adversaire (la possession), une carte défensive changeait la chance d'un but mais pas un tir. Le style d'un
 * club ferme (ou ouvre) maintenant le jeu DES DEUX CÔTÉS : les tirs de `off` suivent le volume de style de `def`
 * (`styleVol`, ce que ses systèmes et ses cartes font de la pression de ses joueurs), sa défensive de style
 * (`styleDef`, les systèmes, l'agressivité, les cartes), et — moins fort, pour que le style reste symétrique —
 * la défensive de style de `off` lui-même (un club qui se replie tire moins). Aucune cote neuve : ce sont des
 * quantités que `profilMatch` calculait déjà. Centrées sur le style moyen d'une ligue de base (`REF_STYLE_VOL`,
 * `REF_STYLE_DEF` : les systèmes automatiques donnent un style à tous), donc à style moyen tout vaut 1 et la
 * ligue ne bouge pas. Les exposants sont des MAXIMUMS DE SYMÉTRIE, pas de force : à 1, le défensif payait deux
 * fois (moins de buts ET moins de tirs, +3 V mesurés) ; à 0,5 un club tout défensif tire ~25 et en prend ~25,
 * un club tout offensif ~33 et ~32, et les victoires restent dans le bruit. Le cinq contre cinq seulement :
 * l'avantage numérique a ses propres lancers.
 */
const TAU = Number(ENV_MESURE.TAU ?? 0.3);
const KAPPA = Number(ENV_MESURE.KAPPA ?? 0.5);
const KAPPA_OWN = Number(ENV_MESURE.KAPPA_OWN ?? 0.5);
const REF_STYLE_VOL = Number(ENV_MESURE.REF_STYLE_VOL ?? 1.03);
const REF_STYLE_DEF = Number(ENV_MESURE.REF_STYLE_DEF ?? 0.962);
const STYLE_BORNES = [0.6, 1.6];
function tempoDe(def, off) {
  const s = x => borne(x ?? 1, STYLE_BORNES[0], STYLE_BORNES[1]);
  return Math.pow(s(def.styleVol), TAU) * Math.pow(s(def.styleDef), KAPPA) * Math.pow(s(off.styleDef), KAPPA_OWN);
}

/**
 * Un côté du match : l'attaque de `off` tire sur le gardien de `def`.
 *
 * Retourne le nombre de buts. Quand `feuille` est fourni, chaque lancer
 * crédite aussi le tireur, les passeurs, le +/- des cinq patineurs sur la
 * glace, et les arrêts du gardien. Rien n'est réparti après coup : la
 * feuille de match EST la suite des lancers.
 */
function jouerCote(off, def, gardien, chance, heavy, feuille, series = false, journal = null, cote = 'A', st = null, ronde = 0) {
  /*
   * `st` décrit une situation spéciale ; sans lui, c'est le cinq contre cinq
   * sur tout le match. Champs :
   *   mode        'FE' (forces égales), 'AN' (avantage), 'DN' (désavantage)
   *   part        part du match jouée à forces égales (les minutes qui
   *               restent une fois les punitions retirées), FE seulement
   *   lancers     lancers attendus, AN et DN (remplace le calcul de pression)
   *   fenetre     [début, fin] en minutes : les instants des tirs y tombent
   *   fenetres    les fenêtres d'avantage à ÉVITER pour les instants du FE
   *   arretAuBut  le premier but termine la situation (un avantage s'arrête
   *               sur le but) ; l'instant est rendu dans st.finBut
   *   unitesOff   unités qui attaquent, à la place de off.unites
   *   unitesDef   unités qui défendent, à la place de def.unites
   *   qualite     facteur sur la finition
   */
  const mode = st?.mode || 'FE';
  const attenduBase = attenduDeCote(off, def);
  const attendu = st?.lancers != null ? st.lancers : attenduBase * (st?.part ?? 1) * (st ? FE_TIRS : 1);
  const lancers = st?.lancers != null ? poisson(attendu) : Math.max(st?.plancher ?? 6, poisson(attendu));
  const unitesOff = st?.unitesOff !== undefined ? st.unitesOff : off.unites;
  const unitesDef = st?.unitesDef !== undefined ? st.unitesDef : def.unites;
  const qualite = st?.qualite ?? 1;
  // Les instants : uniformes dans le match hors des fenêtres d'avantage (FE),
  // ou dans la fenêtre, triés (AN, DN : un avantage se joue dans l'ordre,
  // puisque le premier but le termine).
  // Toujours calculés, journal ou non : l'instant du but qui termine un
  // avantage décide de sa durée, donc du temps qui reste à forces égales.
  // (Sans instant, un avantage coupé finissait à 0:00 et rendait du temps
  // négatif au cinq contre cinq — mesuré : 55 lancers par match.)
  let instants;
  if (st?.fenetre) {
    const [t0, t1] = st.fenetre;
    instants = Array.from({ length: lancers }, () => t0 + hasard() * (t1 - t0)).sort((a, b) => a - b);
  } else {
    instants = Array.from({ length: lancers }, () => instantForcesEgales(st?.fenetres, journal?.prolongation, st?.plage));
  }

  // La robustesse : chaque soir (à ROB_ORDINAIRE), à plein les soirs éreintants,
  // et davantage en séries, où l'usure s'accumule de ronde en ronde (voir K_ROB).
  const intensite = series ? 1 + ROB_SERIES * ronde : heavy ? 1 : ROB_ORDINAIRE;
  const facteurRob = Math.exp(K_ROB * intensite * (robZ(off) - robZ(def)));
  const fg = (gardien ? facteurGardien(gardien) : (def.fgDefaut ?? 1.20))
    * facteurTraitGardien(gardien, series) * situDe(gardien, 'gardien');
  // Les traits de l'équipe qui défend, et ceux de celle qui attaque en séries.
  const traits = (def.traitDef ?? 1) * (off.traitAtt ?? 1)
    * (series ? (off.traitSeries ?? 1) : 1);

  // « La chasse à la vedette » : un habillé colle à LEUR meilleur joueur,
  // même quand son trio n'est pas sur la glace. Un seul effet, le plus fort :
  // deux ombres ne s'additionnent pas. Sans le drapeau, aucun dé de plus.
  let ombre = 1;
  if (def.patineurs) for (const q of def.patineurs) if (q && q._ombre && q._ombre < ombre) ombre = q._ombre;
  const vedette = ombre < 1 ? vedetteOffensive(off.patineurs) : null;

  let buts = 0, tires = 0;
  for (let i = 0; i < lancers; i++) {
    // Le moteur ne modélise pas le temps : quand on tient le journal d'un
    // match, chaque lancer reçoit un instant tiré dans les 60 minutes, et la
    // feuille se lit dans l'ordre une fois les deux côtés fusionnés. Assez
    // pour un sommaire crédible, et ça ne touche à aucune probabilité.
    const instant = instants[i];
    let tireur = null, unite = null, glace = null, trioOff = null, paireOff = null;
    if (unitesOff) {
      // QUI TIRE, ET QUI EST SUR LA GLACE AVEC LUI. L'unité qui tire se tire
      // au poids offensif (présence × volume × chimie) ; l'AUTRE unité, celle
      // qui l'accompagne, se tire à la présence seule. Les deux se tiraient
      // au poids offensif, si bien qu'une première paire qui tire beaucoup
      // était « sur la glace » pour la majorité des buts pour de l'équipe,
      // en récoltait les passes et la création, et ne payait que sa part de
      // présence sur les buts contre : Bourque et Potvin à +144 sur une
      // équipe à +150, et les défenseurs à +22 % de passes (JP : *+140 quand
      // t'as genre 80 points c'est cave en sale*). Une paire ne monte pas
      // avec un trio parce qu'elle tire ; elle est là parce que c'est son tour.
      const tireDef = hasard() < (mode === 'AN' ? PART_LANCERS_D_AN : PART_LANCERS_D);
      const trio = tireDef ? null : choisirUnite(unitesOff.F);
      const paire = tireDef ? choisirUnite(unitesOff.D) : choisirApparie(unitesOff.D, trio.rang || 0, unitesOff.F.length, APPARIEMENT_PROPRE);
      const trioAcc = tireDef ? choisirApparie(unitesOff.F, paire.rang || 0, unitesOff.D.length, APPARIEMENT_PROPRE) : trio;
      unite = tireDef ? paire : trioAcc;
      trioOff = trioAcc; paireOff = paire;
      glace = [...trioAcc.joueurs, ...paire.joueurs];
      // Une unité entièrement blessée ne tire pas : le lancer n'a alors pas
      // lieu du tout, plutôt que de devenir un but sans marqueur — c'est ce
      // qui faisait fuir une poignée de buts et de lancers par saison hors
      // des feuilles de match.
      if (!glace.length) continue;
      // Au cachot (une bagarre) : ni sur la glace, ni tireur pendant ses cinq minutes.
      if (off.cachot && off.cachot.length) { const g = glace.filter(q => !auCachot(off, q, instant)); if (g.length) glace = g; }
      const membres = mode === 'FE' && off.avantage ? off.avantage.partAN : null;
      // En avantage la rondelle circule : le tireur se tire sur la RACINE de
      // son volume, sinon le canonnier de l'unité prenait un tir sur trois
      // et doublait sa saison (Larmer 1992-93 : 61 buts au lieu de 29).
      // En avantage numérique, le sniper maîtrisé est celui qui tire (EFFET_ROLE.sniper).
      const candidats = (unite.joueurs.length ? unite.joueurs : glace).filter(q => !auCachot(off, q, instant));
      tireur = weightedPick(candidats.length ? candidats : glace,
        mode === 'AN' ? p => Math.sqrt(lancersRel(p)) * (1 + EFFET_ROLE.sniper * Math.max(0, maitrise(p, 'sniper'))) : p => lancersFE(p, membres));
    }
    tires++;

    // Qui DÉFEND cette présence-là. Le moteur tirait jusqu'ici sur la cote
    // défensive moyenne de l'équipe, si bien qu'un quatrième trio poreux ne
    // coûtait rien pendant ses propres treize minutes. La défense se joue
    // maintenant présence par présence : c'est ce qui rend la profondeur et
    // les traits mordants au lieu d'être décoratifs.
    let defGlace = null, facteurDef, dTrio = null, dPaire = null;
    const rangOff = trioOff ? (trioOff.rang || 0) : 0, nOff = unitesOff ? unitesOff.F.length : 1;
    if (unitesDef) {
      // Appariée au trio qui attaque : le premier défend contre le premier.
      // Le dernier changement est à l'équipe à domicile : son appariement
      // tient, celui du visiteur est plus lâche (APPARIEMENT_VISITEUR).
      const kApp = def.domicile ? APPARIEMENT : APPARIEMENT_VISITEUR;
      dTrio = choisirApparie(unitesDef.F, rangOff, nOff, kApp, 'presence', true);
      dPaire = choisirApparie(unitesDef.D, rangOff, nOff, kApp);
      defGlace = [...dTrio.joueurs, ...dPaire.joueurs].filter(q => !auCachot(def, q, instant));
      const z = borne((0.5 * (dTrio.coteDef + dPaire.coteDef) - MOY_DEF_EQUIPE) / ECART_DEF_EQUIPE, -5, 3);
      // Le bidirectionnel (et le Selke) étouffe PENDANT SES PRÉSENCES : c'est
      // le seul trait qui passe par ici, voir EFFET dans js/traits.js.
      facteurDef = Math.max(0.55, 1 - K_DEFENSE * (z - REF.zDef)) * facteurPresenceUnite(defGlace)
        // Un changement de carte défensif (S68) joue pendant SES présences.
        * defGlace.reduce((a, q) => a * mutDe(q, 'defense'), 1)
        // La consigne des deux unités qui défendent (S68) : la trappe étouffe,
        // tout en attaque laisse le champ libre — chacune pour sa moitié.
        * Math.sqrt((dTrio.defTac ?? 1) * (dPaire.defTac ?? 1))
        // Les rôles maîtrisés qui défendent : le checker et le défensif étouffent, le bagarreur intimide.
        * (dTrio.etouffe ?? 1) * (dPaire.etouffe ?? 1) * (dTrio.intimide ?? 1);
    } else {
      facteurDef = Math.max(0.55, 1 - K_DEFENSE * (def.zDef - REF.zDef));
    }
    // « Le fantôme » : leur couverture ne le trouve pas. Il ignore une part
    // de l'étouffement de CETTE présence, pas le gardien, pas le volume.
    if (tireur && tireur._abri && facteurDef < 1) facteurDef = 1 - (1 - facteurDef) * (1 - tireur._abri);

    // Les passes causent les buts : la création des coéquipiers sur la glace
    // change la probabilité que CE lancer entre.
    // En avantage numérique la création ne compte qu'à moitié : le % de tir
    // réel d'un joueur d'avantage contient déjà son vrai avantage, et cinq
    // élites autour de lui la comptaient deux fois (mesuré : Zetterberg
    // 2006-07 à 110 buts au lieu de 48).
    const crea = glace ? (mode === 'AN' ? Math.sqrt(facteurCreation(glace, tireur)) : facteurCreation(glace, tireur)) : 1;
    // Le power forward maîtrisé devant le filet : la finition de ses COÉQUIPIERS de trio (EFFET_ROLE.power).
    const devantFilet = trioOff && tireur ? 1 + EFFET_ROLE.power * maitriseUnite(trioOff.joueurs.filter(q => q !== tireur), 'power') : 1;

    /*
     * L'ACTION SPÉCIALE (S68) : à forces égales, la ligne qui a un système a
     * une chance, selon sa chimie, de jouer SON jeu — et ce lancer entre plus.
     * Si le trio qui défend joue la tactique qui la contre, elle est étouffée.
     */
    let special = null, attenteSpec = 1;
    if (mode === 'FE' && trioOff && trioOff.tactique && trioOff.tactique !== 'hourra'
      && (st?.espP || hasard() < SPEC_BASE * (trioOff.chimie || 0) / 100)) {
      // S79 : le trio qui défend OU sa paire peut jouer le système qui l'étouffe.
      const T = dTrio && dTrio.tactique && TACTIQUES[dTrio.tactique];
      const D = dPaire && dPaire.tactique && SYSTEMES_D[dPaire.tactique];
      special = (T && T.bat === trioOff.tactique) || (D && D.bat === trioOff.tactique) ? 'etouffee' : 'reussie';
      // LA LECTURE (js/impact.js) ne tire pas ce dé : elle prend son espérance, la chance de l'action × ce qu'elle rapporte.
      if (st?.espP) { attenteSpec = 1 + SPEC_BASE * (trioOff.chimie || 0) / 100 * (special === 'reussie' ? SPEC_MULT - 1 : 0); special = null; }
    }
    const p = borne(
      CIBLE_PCT_TIR
        * (tireur ? pctTirRel(tireur) : (off.pctTirDefaut ?? RAPPEL_PCT_TIR)) / REF.pctTir * crea
        * (fg / REF.fg) * facteurDef * facteurRob * traits * (unite ? unite.qualite : 1) * chance * devantFilet * elanDe(off, instant)
        * (off.finitionFacteur ?? 1) * qualite * (mode === 'FE' && st ? FE_QUALITE : 1)
        * (mode === 'FE' ? SPEC_NORME : 1) * (special === 'reussie' ? SPEC_MULT : 1) * attenteSpec
        * (vedette && tireur === vedette ? ombre : 1),
      0.005, PCT_TIR_MAX);

    // LA LECTURE (js/impact.js, `pMoyenDuLancer`) : la chance moyenne d'un lancer, sans tirer le but — le tirage ne bouge donc pas avec `p`.
    if (st?.espP) {
      st.espP.s += p; st.espP.n++;
      // Par tireur : ses lancers et ses buts attendus dans la lecture (ce qu'une modif de joueur change À LUI).
      if (st.espP.joueurs && tireur) { const k = getPlayerKey(tireur), j = st.espP.joueurs.get(k) || { t: 0, b: 0 }; j.t++; j.b += p; st.espP.joueurs.set(k, j); }
      continue;
    }
    if (feuille && tireur) tireur.simSH = (tireur.simSH || 0) + 1;
    if (journal) journal.tirs[cote][periodeDe(instant)]++;
    // Chaque lancer entre au journal avec son tireur et son gardien : c'est
    // ce que le direct des séries rejoue, tir par tir. Le sommaire, lui, ne
    // lit que les buts.
    // `p` (S70) : la chance que CE lancer entre. Le direct en tire ses jeux dangereux ; lu, jamais tiré.
    const lancer = journal ? { cote, instant, tireur, gardien, but: false, mode, special, ligne: trioOff ? trioOff.rang : null, tac: trioOff ? trioOff.tactique || null : null, p: Math.round(p * 1000) / 1000 } : null;
    if (lancer) journal.lancers.push(lancer);

    if (hasard() < p) {
      buts++;
      if (lancer) lancer.but = true;
      if (journal && tireur) {
        journal.buts.push({ cote, instant, marqueur: tireur, passeurs: [], gardien, an: mode === 'AN', dn: mode === 'DN', special, ligne: trioOff ? trioOff.rang : null, tac: trioOff ? trioOff.tactique || null : null });
      }
      if (feuille && tireur && mode === 'AN') tireur.simPPG = (tireur.simPPG || 0) + 1;
      // Les passeurs sont tirés dès qu'il y a un but : la feuille de saison
      // les crédite, le journal du match les nomme. En séries on ne tient pas
      // les statistiques, mais le sommaire, lui, doit dire qui a aidé.
      if (tireur && glace) {
        const co = glace.filter(x => x !== tireur);
        const entree = journal ? journal.buts[journal.buts.length - 1] : null;
        const passeurs = [];
        if (co.length && hasard() < P_PASSE_1) {
          const a1 = weightedPick(co, propensionPasse);
          passeurs.push(a1);
          const reste = co.filter(x => x !== a1);
          if (reste.length && hasard() < P_PASSE_2) passeurs.push(weightedPick(reste, propensionPasse));
        }
        if (entree) entree.passeurs = passeurs;
        if (feuille) {
          tireur.simG++; tireur.simPTS++;
          for (const a of passeurs) { a.simA++; a.simPTS++; }
          // Le +/- ne compte pas les buts en avantage numérique — la règle de
          // la ligue — mais il compte ceux en désavantage.
          if (mode !== 'AN') {
            // Les changements à la volée : voir P_MELANGE.
            // `simPlus` et `simMoins` (les buts pour et contre sur la glace)
            // ne servent qu'à check_pm.mjs ; le +/- est leur différence.
            const glacePour = surLaGlace(trioOff, paireOff, unitesOff, tireur);
            for (const x of glacePour) { x.simPM++; x.simPlus = (x.simPlus || 0) + 1; }
            // LE BUT PORTE QUI ÉTAIT SUR LA GLACE. Le +/- est crédité ici, en
            // direct, et la feuille de match n'en gardait rien : impossible
            // de dire le +/- d'un joueur À CE JOUR-LÀ sans le recompter. Les
            // deux listes sont exactement celles qu'on vient de créditer.
            if (entree) entree.pour = glacePour;
            if (defGlace) {
              // LE −1 SUIT LE RYTHME. Voir CREDIT_AU_RYTHME : ceux qui étaient là
              // quand ça rentre se tirent au poids offensif de leur unité, pas à
              // la présence seule — le premier trio est sur la glace pour une
              // part des buts contre proche de sa part des buts pour.
              const kCr = def.domicile ? APPARIEMENT : APPARIEMENT_VISITEUR;
              const cTrio = choisirApparie(unitesDef.F, rangOff, nOff, kCr, 'rythme', true);
              const cPaire = choisirApparie(unitesDef.D, rangOff, nOff, kCr, 'rythme');
              const glaceContre = surLaGlace(cTrio, cPaire, unitesDef);
              for (const x of glaceContre) { x.simPM--; x.simMoins = (x.simMoins || 0) + 1; }
              if (entree) entree.contre = glaceContre;
            }
          }
        }
      }
      // Un avantage numérique s'arrête sur le but.
      if (st?.arretAuBut) { st.finBut = instant; break; }
    } else {
      if (feuille && gardien) gardien.simSV = (gardien.simSV || 0) + 1;
      if (journal) journal.arrets[cote === 'A' ? 'B' : 'A']++;
    }
  }

  if (feuille && gardien) gardien.simSA = (gardien.simSA || 0) + tires;
  return buts;
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
/*
 * LE BONUS DE CHIMIE (S72) : à pleine chimie, une unité gagne CHIMIE_BONUS
 * points d'attaque. Calé sur la ligue : la chimie des lignes de l'IA tourne à
 * 34 % sur une saison, donc +1,8 en moyenne — exactement ce que l'ancienne
 * chimie de rôles donnait, et la ligue marque autant qu'avant. La paire u
 * porte la chimie de la ligne u.
 */
// Recalé en S73 : la chimie apprise tourne à 53 % chez l'IA (la maîtrise relève le plafond), donc 3,4 pour garder +1,8 en moyenne.
/*
 * LA CHIMIE DEVIENT UN LEVIER, SANS GONFLER LA LIGUE (1.0 · J1-M). À 3,4, une
 * ligne soudée ne valait que 6 % de buts de plus qu'une ligne cassée, pour un
 * tiroir entier à l'écran. Le bonus est maintenant RELATIF à un pivot :
 * CHIMIE_BONUS × (c − CHIMIE_PIVOT) / 100. Le pivot est choisi pour que le
 * bonus MOYEN reste celui que check_chimie borne (1,88 pt à 55 % de chimie
 * moyenne : 6,5 × (55,4 − 26) / 100) — la ligue marque autant (3,09 buts par
 * équipe par match, avant comme après). Mesuré EN PAIRES (ta formation à chimie
 * forcée, 40 saisons, 3 280 matchs) : chimie 100 contre 0 = +10,9 % de buts et
 * +3,6 victoires (c'était +6,1 %).
 */
const CHIMIE_BONUS = Number(ENV_MESURE.CHIMIE_BONUS ?? 6.5);
/* Sous le pivot, la chimie COÛTE (un bonus négatif) : l'écran le dit (« naissante, elle coûte », js/gerant.js). */
export const CHIMIE_PIVOT = Number(ENV_MESURE.CHIMIE_PIVOT ?? 26);
// MESURE seulement (check_chimie) : la chimie du bonus de ta formation, forcée. Le navigateur n'a pas de process : null.
export const CHIMIE_FORCEE = ENV_MESURE.CHIMIE_FORCEE == null ? null : Number(ENV_MESURE.CHIMIE_FORCEE);
export const bonusChimie = c => CHIMIE_BONUS * (c - CHIMIE_PIVOT) / 100;
function bonusDeChimie(team, u, lineup = null) {
  let c;
  if (lineup && team) c = chimieLigne(apprentissageDe(team), lineup, u, lignesDe(team, lineup)[u]);
  else c = team && team.chimie ? team.chimie[u] || 0 : 0;
  return bonusChimie(c);
}

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = hasard();
  while (v === 0) v = hasard();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Part des matchs joués par le joueur dans sa vraie saison (0-1). */
function gpShare(p) {
  return Math.max(0, Math.min(1, (p.gp || 0) / seasonGames(p.s)));
}

/** Probabilité de blessure à un match donné. */
/* Un soir éreintant (un dos-à-dos) : chacun se blesse plus. L'écran le dit (le 🥵 du prochain match). */
export const BLESSURE_EREINTANT = 1.5;
function injuryChance(p, heavy = false) {
  const frail = 1 - gpShare(p);
  let pr = 0.0015 + 0.015 * frail * frail;
  if (p.p === 'G') pr *= 0.5;
  if (heavy) pr *= BLESSURE_EREINTANT;
  // Un joueur robuste se blesse moins (r est à 50 ± 12 par joueur).
  pr *= Math.exp(-ROB_BLESSURE * (getHiddenRatings(p).r - 50) / 12);
  return pr;
}

function injuryLength() {   // moyenne ~8 matchs, plafond 40
  let n = 1;
  while (n < 40 && hasard() < 0.875) n++;
  return n;
}

function initSimStats(p) {
  delete p.po;   // les statistiques des séries d'une saison rejouée ne survivent pas
  p.simGP = 0; p.simG = 0; p.simA = 0; p.simPTS = 0; p.simPM = 0; p.simPlus = 0; p.simMoins = 0; p.simInj = 0;
  p.simSH = 0; p.simPIM = 0; p.simPPG = 0;
  if (p.p === 'G') {
    p.simW = 0; p.simL = 0; p.simOTL = 0; p.simGA = 0; p.simSO = 0;
    p.simSA = 0; p.simSV = 0;
  }
}

export function createTeam(name, tag, roster, opts = {}) {
  return {
    name, tag, roster,
    isPlayer: !!opts.isPlayer,
    season: opts.season || null,
    fermeture: 'auto',       // le trio de fermeture : 'auto', null, ou le rang d'un trio (voir FERMETURE_DEFAUT)
    roulement: opts.roulement || 'quatre', // la distribution des minutes (voir ROULEMENTS)
    injured: new Map(),      // joueur -> matchs restants
    together: new Map(),     // unité -> matchs consécutifs intacts
    togetherSig: new Map(),
    injuriesLog: [],         // { player, games, at, jour, avant (la photo des cases ce soir-là) }
    journal: [],             // un match par entrée : { n, adv, gf, ga, ot, win } — de quoi raconter la saison
    luck: gauss() * LUCK_SEASON,   // retirée sous la graine par simulateLeague
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
  // UN ABSENT (S72) — reposé, suspendu, malade, au protocole — reste au
  // vestiaire comme un blessé : un réserviste monte, sinon un rappel du club-école.
  const absent = p => team.absents && (team.absents.get(p) || 0) > (team.jourCourant ?? -1);
  const reserves = SLOTS.filter(s => s.scratch)
    .map(s => team.roster[s.i])
    .filter(p => p && !team.injured.has(p) && !absent(p));
  for (const s of SLOTS) {
    if (s.scratch) continue;
    let p = team.roster[s.i];
    if (p && (team.injured.has(p) || absent(p))) p = null;
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
    bonus += key === 'o' ? (syn.bonusOff || 0) + bonusDeChimie(team, unit, lineup) : (syn.bonusDef || 0);
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

/*
 * LES DÉPARTS SE PARTAGENT COMME DANS LA VRAIE SAISON DES DEUX GARDIENS.
 * L'auxiliaire jouait un match sur six, quel que fût son vrai rôle : un
 * partant qui avait joué 30 matchs dans sa vraie saison en jouait 68 ici, et
 * un tandem 1A-1B ne valait rien de plus qu'un partant et un rappel — la case
 * auxiliaire était de l'argent mort. La part de l'auxiliaire est maintenant
 * sa part réelle des matchs des deux (Dryden 56 sur 78 en 1972-73 laisse 22
 * à son second ; un partant de 65 laisse 17), bornée pour qu'un partant
 * reste le partant : de PART_AUX_MIN à PART_AUX_MAX. Les départs sont posés
 * en rotation régulière, sans hasard, comme avant.
 */
export const PART_AUX_MIN = 0.12;   // au moins ~10 départs : le corps a ses limites
export const PART_AUX_MAX = 0.50;   // un vrai tandem, jamais plus que la moitié

function partAuxiliaire(starter, backup) {
  if (!starter || !backup) return 0;
  const gs = gpShare(starter), gb = gpShare(backup);
  if (gs + gb <= 0) return 1 / 6;
  return Math.max(PART_AUX_MIN, Math.min(PART_AUX_MAX, gb / (gs + gb)));
}

/*
 * AUCUN GARDIEN NE JOUE 82 MATCHS. JP : *pas de gardiens avec 82 matchs lol*.
 * Un club qui perd son auxiliaire — tu l'as signé, ou il est blessé — laissait
 * son partant prendre TOUS les départs : Lindgren 82 matchs le soir où les
 * Capitals t'ont vendu Thompson. Le record réel est de 79 (Luongo 2006-07) et
 * la ligue moderne plafonne à 65 : dans la vraie vie, le club rappelle un
 * gardien. C'est ce que fait le moteur. Le rappel est un vrai objet joueur —
 * il prend des lancers, fait des arrêts, gagne et perd des matchs, donc les
 * égalités de la feuille tiennent — à la cote d'un rappel de la ligue mineure
 * et à un pourcentage d'arrêts sous la moyenne de son époque. Il ne figure
 * dans aucune case de l'alignement : il n'est pas dans ton équipe, il dépanne.
 */
const RAPPEL_SV = 0.015;   // écart au % d'arrêts de la ligue, en points de sv
export const PART_SANS_AUX = 0.20;   // la part du rappel quand la case auxiliaire est vide

function gardienDeRappel(team, modele) {
  if (!team) return null;
  if (!team.rappelG) {
    const saison = (modele && modele.s) || team.season || '2024-25';
    const svLigue = 1 - seasonLancers(saison)[1] / 100;
    const g = { n: 'Gardien de rappel', p: 'G', t: team.tag, s: saison, gp: 0,
                sv: Math.max(0.02, svLigue - RAPPEL_SV), o: REPLACEMENT, d: REPLACEMENT,
                r: 50, c: 50, v: REPLACEMENT, _rappel: 1 };
    initSimStats(g);
    team.rappelG = g;
  }
  return team.rappelG;
}

/*
 * LES DEUX GARDIENS DU SOIR, le partant d'abord. JP : *un gardien suprême avec
 * des boosts, et il est à chier*. Le partant blessé laissait sa case vide ;
 * l'auxiliaire, resté dans la sienne, n'avait plus de partant à qui prendre
 * sa part (`partAuxiliaire` rendait 0) et regardait le rappel du club-école
 * jouer tous les soirs. L'auxiliaire monte au filet, et le rappel prend la
 * part d'un auxiliaire, comme quand la case auxiliaire est vide.
 */
function gardiensDuSoir(lineup) {
  const [starter, backup] = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => lineup[s.i]);
  return starter ? [starter, backup] : [backup, null];
}

/* Qui la rotation du club enverrait ce soir, sans aucun choix imposé (pour l'écran). */
function gardienDeRotation(lineup, gameIdx, team = null) {
  const [starter, backup] = gardiensDuSoir(lineup);
  if (team && ((team.gardienAux || 0) > (team.jourCourant ?? -1))) return backup || starter || null;
  const part = backup ? partAuxiliaire(starter, backup) : (starter ? PART_SANS_AUX : 1);
  const useBackup = Math.floor((gameIdx + 1) * part) > Math.floor(gameIdx * part);
  return (useBackup ? backup : starter) || starter || backup || null;
}

/* Pour l'instantané du matin (ta formation) : qui est partant, qui est auxiliaire, et qui la rotation enverrait. */
export function filetDuSoir(team) {
  const lu = activeLineup(team);
  const [starter, backup] = gardiensDuSoir(lu);
  const rot = gardienDeRotation(lu, team.games || 0, team);
  return { partant: starter ? getPlayerKey(starter) : null, aux: backup ? getPlayerKey(backup) : null,
    rotation: rot && backup && rot === backup ? 'aux' : 'partant', impose: (team.gardienAux || 0) > (team.jourCourant ?? -1) };
}

function pickGoalie(lineup, gameIdx, team = null) {
  const [starter, backup] = gardiensDuSoir(lineup);
  // Sans auxiliaire — tu l'as signé, il est blessé — le club rappelle, et le
  // rappel prend la part d'un auxiliaire ordinaire : le partant retombe sous
  // les 70 départs, là où la vraie ligue le tient.
  // LE GARDIEN AUXILIAIRE IMPOSÉ (S72) : une carte ou un ajustement lui donne le filet.
  // Sans auxiliaire au roster, le club rappelle un gardien du club-école — pour vrai.
  // DEVANT LE FILET CE SOIR (1.0, C4) : ton choix pour CE soir passe avant tout le reste.
  const soir = team && team._filetForce && team._filetForce.jour === team.jourCourant ? team._filetForce.qui : team && team._filetMatch;
  if (soir === 'partant' && starter) return starter;
  if (soir === 'aux') return backup || gardienDeRappel(team, starter) || starter || null;
  if (team && ((team.gardienAux || 0) > (team.jourCourant ?? -1) || team._gardienAuxMatch)) return backup || gardienDeRappel(team, starter) || starter || null;
  const part = backup ? partAuxiliaire(starter, backup) : (starter ? PART_SANS_AUX : 1);
  const useBackup = Math.floor((gameIdx + 1) * part) > Math.floor(gameIdx * part);
  const g = (useBackup ? backup : starter) || null;
  if (g) return g;
  // Personne dans le filet : le rappel. Sans lui les lancers de l'adversaire
  // n'avaient personne à qui être crédités, et la feuille perdait une
  // centaine de lancers par saison — assez pour casser l'identité de ligue
  // « lancers pour = lancers contre » que `check_feuilles.mjs` vérifie. Le
  // club habillait alors un de ses gardiens BLESSÉS, à pleine cote ; il
  // habille maintenant un rappel, qui garde comme un rappel.
  return gardienDeRappel(team, starter || backup) || starter || backup || null;
}

function weightedPick(list, wfn) {
  const ws = list.map(wfn);
  let r = hasard() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}


/**
 * Ce qui ne vient pas des lancers : les présences et la fiche du gardien.
 * Tout le reste — buts, passes, +/- des deux côtés — est crédité dans
 * `jouerCote`, lancer par lancer, aux joueurs qui étaient vraiment sur la
 * glace.
 */
function crediterMatch(lineup, goalie, ga, win, otl) {
  for (const p of Object.values(lineup)) if (p && p.p !== 'G') p.simGP++;
  if (goalie) {
    goalie.simGP++; goalie.simGA += ga;
    if (win) goalie.simW++; else if (otl) goalie.simOTL++; else goalie.simL++;
    if (ga === 0) goalie.simSO++;
  }
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

/*
 * LE MOMENT D'UNE BLESSURE, SUR LA FEUILLE (S80). JP : *blessures aux joueurs
 * adverses et de l'équipe dans les matchs, incluant « oh non » notre équipe*.
 * La blessure se tire après le match (le hasard du moteur n'en sait pas plus) ;
 * le direct la raconte à un moment du soir. Ce moment ne tire AUCUN hasard —
 * une empreinte du joueur et du match — et tombe APRÈS sa dernière action de
 * la soirée (un but, une passe, un tir, une punition purgée) : on ne le voit
 * jamais marquer après s'être blessé.
 */
function empreinte(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h / 4294967296;
}
function instantDeBlessure(feuille, p, team) {
  /*
   * UN GROS MATCH SE COUPE À L'ENTRACTE (1.0, oct.) : la blessure se tire au
   * bout du match, donc sur la troisième période — rejouée par le choix de
   * l'entracte. Datée avant 40:00, elle réécrivait les deux premières, déjà
   * vues (le smoke, graine 5 : « Toffoli se blesse » apparu en 2e). Elle se
   * date donc dans la troisième.
   */
  let dernier = feuille.entracte ? 40 : 2;
  for (const b of feuille.buts) if (b.marqueur === p || (b.passeurs || []).includes(p)) dernier = Math.max(dernier, b.instant);
  for (const l of feuille.lancers || []) if (l.tireur === p || l.gardien === p) dernier = Math.max(dernier, l.instant);
  for (const x of feuille.punitions || []) if (x.joueur === p) dernier = Math.max(dernier, x.fin ?? (x.instant + x.minutes));
  const fin = Math.max(60, ...feuille.buts.map(b => b.instant));
  if (dernier >= fin - 0.4) return Math.max(dernier, fin - 0.3);
  return dernier + (fin - 0.3 - dernier) * (0.1 + 0.8 * empreinte(`${getPlayerKey(p)}|${team.name}|${team.games}`));
}
function applyInjuries(team, lineup, heavy, feuille = null, cote = null, profil = null) {
  for (const [p, n] of team.injured) {
    if (n <= 1) team.injured.delete(p); else team.injured.set(p, n - 1);
  }
  // LA DISSUASION (voir K_ROB) : les durs de l'alignement protègent les autres.
  const dissuasion = profil ? Math.exp(-DISSUASION * robZ(profil)) : 1;
  for (const p of Object.values(lineup)) {
    if (!p || team.injured.has(p)) continue;
    // Le risque suit la carte, le plan et le roulement : « Roulement court » et
    // « Trois trios » usent, « L'infirmerie » et « Banc profond » protègent.
    // Et la situation du joueur : « Il joue amoché » finit par payer.
    // L'ÉNERGIE (S68) : sous 60, le risque monte — jusqu'au double à 30.
    const usee = 1 + Math.max(0, ENERGIE_BLESSURE - energieDe(p)) / 30;
    // Sonné par un coup marquant, ou une bagarre perdue (1.0) : ce soir, il se blesse plus.
    const soiree = (p._sonne ? BLESSURE_SONNE : 1) * (p._bagarrePerdue ? BLESSURE_BAGARRE_PERDUE : 1);
    delete p._sonne; delete p._bagarrePerdue;
    if (hasard() < injuryChance(p, heavy) * dissuasion * soiree * effetsDeSaison(team).blessure * situDe(p, 'blessure') * usee * mutDe(p, 'blessure')) {
      const n = injuryLength();
      team.injured.set(p, n);
      p.simInj = (p.simInj || 0) + n;
      // `avant` : l'alignement du soir où il s'est blessé (sa case d'avant, pour son retour — `retourDuBlesse`, js/ballottage.js). Aucun hasard.
      team.injuriesLog.push({ player: p, games: n, at: team.games + 1, jour: Number.isFinite(team.jourCourant) ? team.jourCourant : null, avant: photoAlignement(team.roster) });
      if (feuille && cote) (feuille.blessures = feuille.blessures || []).push({ cote, joueur: p, matchs: n, instant: instantDeBlessure(feuille, p, team) });
    }
  }
}

/**
 * Un match entre deux équipes, joué lancer par lancer.
 *
 * `track` = false ne sert plus qu'à ne rien inscrire aux fiches : les
 * blessures et l'usure, elles, s'appliquent aussi en séries — c'est
 * exactement ce que l'ancien moteur sautait, et pourquoi une équipe de
 * niveau 80 gagnait la Coupe 99 % du temps (MOTEUR.md 5.5).
 */
/*
 * LE SOIR ÉREINTANT : la robustesse y pèse (voir K_ROB), et l'écran de saison
 * le dit d'avance. C'était un match sur quatre, au numéro de la journée ;
 * avec le vrai calendrier (1.0, oct.), c'est un DOS-À-DOS — un des deux clubs
 * a joué la veille. Sans cédule (les séries), un match sur quatre, comme avant.
 */
export const dosADos = (t, jour) => !!(t && t._jours && t._jours.includes(jour) && t._jours.includes(jour - 1));
export const soirEreintant = (jour, A = null, B = null) => (A && A._jours ? dosADos(A, jour) || dosADos(B, jour) : jour % 4 === 3);

/*
 * Les cases qu'aucun réserviste n'a pu remplir, ce match-ci. On garde la
 * PREMIÈRE de chaque épisode : un trou qui dure douze matchs est un
 * événement, pas douze.
 */
function noterTrous(team, lineup) {
  const vides = SLOTS.filter(s => !s.scratch && !lineup[s.i]).map(s => s.i);
  const dernier = (team.trous || [])[(team.trous || []).length - 1];
  const at = team.games + 1;
  if (!vides.length) { team.trouEnCours = false; return; }
  if (team.trouEnCours && dernier) { dernier.jusqua = at; return; }
  team.trouEnCours = true;
  (team.trous = team.trous || []).push({ at, jusqua: at, cases: vides });
}

/* `cedule` : un match de la SAISON au vrai calendrier (la ligue, le pronostic) — `gameIdx` est alors le jour, et le
   soir éreintant un dos-à-dos. Ailleurs (le tournoi, l'exhibition), un match sur quatre, comme avant. */
export function playGame(A, B, gameIdx, track = true, series = false, journal = null, ronde = 0, cedule = false) {
  MEMO_MATCH++;
  // Le soir d'une carte « Clutch » (S78) : les séries et tes gros matchs.
  poserSoirGrand(series || !!(A._gros || B._gros));
  // L'échelle de la fin de partie (S80) : en saison, la journée ; en séries, la ronde.
  ECHELLE_SOIR = !(A.courbe || B.courbe) ? 1 : series ? echelleTardive({ serie: true, ronde }) : echelleTardive({ jour: gameIdx });
  const heavy = cedule && !series ? soirEreintant(gameIdx, A, B) : soirEreintant(gameIdx);
  // Entre deux matchs de séries, les jambes reviennent (S68) ; en saison, la
  // récupération se fait au début de chaque journée (`simulateLeague`).
  if (series) { recupererEnergie(A); recupererEnergie(B); }
  const LA = activeLineup(A), LB = activeLineup(B);
  // LE JOURNAL DES CASES VIDES. `activeLineup` promeut le premier réserviste
  // compatible ; quand il n'y en a plus, la case reste vide et le moteur y met
  // un joueur de remplacement. C'est l'ÉVÉNEMENT que l'écran de saison
  // attend — mesuré à 1,02 fois par équipe par saison, donc un vrai moment et
  // pas une nuisance — et le gros pourvoyeur est le filet : deux cases
  // seulement, et l'auxiliaire n'est pas toujours remplaçable.
  noterTrous(A, LA); noterTrous(B, LB);
  const sA = teamStrength(A, LA), sB = teamStrength(B, LB);
  let gA = pickGoalie(LA, A.games, A), gB = pickGoalie(LB, B.games, B);
  const partantA = gA, partantB = gB;

  const pA = profilMatch(A, LA, B), pB = profilMatch(B, LB, A);
  pA.rob = sA.rob; pB.rob = sB.rob;
  // A est à domicile : le dernier changement est à lui (voir FERMETURE_DEFAUT).
  pA.domicile = true; pB.domicile = false;

  // La chance est du PDO : elle porte sur la finition, pas sur le volume.
  const chanceA = Math.exp(gauss() * LUCK_GAME + A.luck - B.luck);
  const chanceB = Math.exp(gauss() * LUCK_GAME + B.luck - A.luck);

  let gfA, gfB;
  const gros = A._gros || B._gros;
  if (!gros) ({ gfA, gfB } = jouerSoixanteMinutes(pA, pB, gA, gB, chanceA, chanceB, heavy, track, series, journal, LA, LB, ronde));
  else {
    /*
     * LE GROS MATCH (S70) : deux blocs, et le DEUXIÈME ENTRACTE entre les
     * deux. Le choix de l'entracte ne touche que la troisième période, et les
     * dés neufs de sa décision ne se tirent qu'ici : les deux premières
     * périodes, déjà vues, se rejouent à l'identique.
     */
    const h1 = jouerSoixanteMinutes(pA, pB, gA, gB, chanceA, chanceB, heavy, track, series, journal, LA, LB, ronde, [0, 40]);
    const toiA = !!A._gros, toi = toiA ? A : B;
    gros.apres40 = toiA ? { moi: h1.gfA, lui: h1.gfB } : { moi: h1.gfB, lui: h1.gfA };
    if (journal) journal.entracte = { gfA: h1.gfA, gfB: h1.gfB, plan: gros.plan, contre: gros.contre, toi: toiA ? 'A' : 'B' };
    let qA = pA, qB = pB;
    const e = toi._entracte;
    const eff = e ? effetEntracte(e) : null;
    const adv = toiA ? B : A;
    let refaireToi = false, refaireAdv = false;
    if (eff) {
      toi._effetMatch = [...(toi._effetMatch || []), eff];
      refaireToi = true;
      gros.entracte = { cle: e.cle, incident: e.incident || null };
      if (journal) journal.entracte.choix = e.cle;
    }
    /*
     * LES CARTES QUI LISENT LE POINTAGE (1.0, J1-G, `apres40`) : « L'instinct
     * du tueur » ne joue que si on mène après deux périodes. Ta main, puis la
     * leur (sauf annulée) — l'effet s'ajoute pour la troisième seulement.
     */
    const apres40De = (jouees, equipe, mene) => {
      let ajoute = false;
      for (const c of jouees || []) {
        const C = CARTES_MATCH[c];
        const fx = C && C.apres40 && C.apres40[mene ? 'siMene' : 'sinon'];
        if (!fx || !Object.keys(fx).length) continue;
        equipe._effetMatch = [...(equipe._effetMatch || []), { source: 'carte', nom: C.nom, ico: C.ico, ...fx }];
        ajoute = true;
      }
      return ajoute;
    };
    const cj = gros.cartesJouees || {};
    if (apres40De(cj.jouees, toi, gros.apres40.moi > gros.apres40.lui)) refaireToi = true;
    if (!cj.annulee && apres40De(cj.adverses, adv, gros.apres40.lui > gros.apres40.moi)) refaireAdv = true;
    if (refaireToi) {
      const L = toiA ? LA : LB;
      const q = profilMatch(toi, L, adv);
      q.rob = teamStrength(toi, L).rob;
      q.domicile = toiA;
      if (toiA) qA = q; else qB = q;
    }
    if (refaireAdv) {
      const L = toiA ? LB : LA;
      const q = profilMatch(adv, L, toi);
      q.rob = teamStrength(adv, L).rob;
      q.domicile = !toiA;
      if (toiA) qB = q; else qA = q;
    }
    // CHANGER DE GARDIEN (S72) : l'auxiliaire prend VRAIMENT le filet pour la troisième.
    if (e && ENTRACTES[e.cle] && ENTRACTES[e.cle].changeGardien) {
      const aux = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => (toiA ? LA : LB)[s.i])[1] || gardienDeRappel(toi, toiA ? gA : gB);
      if (aux) { if (toiA) gA = aux; else gB = aux; if (journal) journal.entracte.gardien = aux; }
    }
    if (e && e.graine) grainerHasard(e.graine);
    const h2 = jouerSoixanteMinutes(qA, qB, gA, gB, chanceA, chanceB, heavy, track, series, journal, LA, LB, ronde, [40, 60]);
    gfA = h1.gfA + h2.gfA; gfB = h1.gfB + h2.gfB;
  }
  let ot = false;

  if (gfA === gfB) {
    ot = true;
    if (journal) journal.prolongation = true;
    const p = 1 / (1 + Math.exp(-((sA.clu + pA.meneur) - (sB.clu + pB.meneur)) / 9));
    // Le but gagnant appartient à un joueur, comme tous les autres.
    if (hasard() < p) { gfA++; butProlongation(pA, pB, gB, track, journal, 'A'); }
    else { gfB++; butProlongation(pB, pA, gA, track, journal, 'B'); }
  }
  if (journal) {
    Object.assign(journal, {
      A, B, gfA, gfB, ot, gardienA: gA, gardienB: gB,
      vainqueur: gfA > gfB ? 'A' : 'B',
      // LES PATINEURS HABILLÉS CE SOIR-LÀ : c'est ce qui donne les matchs
      // joués d'un patineur à une date donnée (un blessé n'est pas de la
      // liste). Les gardiens n'en sont pas : leur match se compte au filet.
      alignes: {
        A: Object.values(LA).filter(p => p && p.p !== 'G'),
        B: Object.values(LB).filter(p => p && p.p !== 'G'),
      },
    });
    journal.buts.sort((x, y) => x.instant - y.instant);
  }
  const winA = gfA > gfB;

  if (track) {
    A.GF += gfA; A.GA += gfB; B.GF += gfB; B.GA += gfA;
    if (winA) { A.W++; if (ot) B.OTL++; else B.L++; }
    else { B.W++; if (ot) A.OTL++; else A.L++; }
    A.PTS = A.W * 2 + A.OTL; B.PTS = B.W * 2 + B.OTL;
    crediterMatch(LA, gA, gfB, winA, !winA && ot);
    crediterMatch(LB, gB, gfA, !winA, winA && ot);
    updateTogether(A, LA); updateTogether(B, LB);
    // LA CHIMIE ET L'ÉNERGIE (S68), après le match : la chimie des lignes qui
    // ont joué, et l'usure de ceux qui étaient sur la glace.
    majChimie(A, LA); majChimie(B, LB);
    depenserEnergie(A, LA); depenserEnergie(B, LB);
    // LES MISES EN ÉCHEC COÛTENT DES JAMBES (voir PALIERS) : les coups de chaque club tombent sur l'autre.
    encaisserCoups(pA, pB); encaisserCoups(pB, pA);
    noterDepart(A, partantA); noterDepart(B, partantB);
    // Le journal de la saison : ce qu'il faut pour raconter une séquence,
    // un début de saison, une raclée. Le moteur n'y lit jamais rien.
    if (A.journal) A.journal.push({ n: A.games + 1, adv: B, gf: gfA, ga: gfB, ot, win: winA, gardien: gA, feuille: journal });
    if (B.journal) B.journal.push({ n: B.games + 1, adv: A, gf: gfB, ga: gfA, ot, win: !winA, gardien: gB, feuille: journal });
  }
  applyInjuries(A, LA, heavy, journal, 'A', pA); applyInjuries(B, LB, heavy, journal, 'B', pB);
  if (track) { A.games++; B.games++; }
  return { gfA, gfB, ot, winner: winA ? A : B };
}

/** Le but de la prolongation : un tireur, une passe, du +/-, comme les autres. */
/** Un instant à forces égales : n'importe où dans le match, hors des avantages. */
function instantForcesEgales(fenetres, prolongation, plage = null) {
  const [a0, a1] = plage || [0, 60];
  for (let k = 0; k < 12; k++) {
    const t = prolongation ? 60 + hasard() * 5 : a0 + hasard() * (a1 - a0);
    if (!fenetres || !fenetres.some(([a, b]) => t >= a && t < b)) return t;
  }
  return a0 + hasard() * (a1 - a0);
}

/**
 * Les soixante minutes d'un match : les punitions d'abord, chacune jouée
 * comme un petit match dans le match (l'avantage tire, le désavantage tire
 * un peu, le premier but termine la fenêtre), puis le cinq contre cinq sur
 * les minutes qui restent. Les deux côtés passent par `jouerCote`, donc les
 * égalités de la feuille tiennent par construction.
 *
 * `LA` et `LB` sont les alignements du jour (pour créditer le puni) ; l'un
 * ou l'autre peut manquer (adversaire neutre de la saison solo).
 */
function jouerSoixanteMinutes(pA, pB, gA, gB, chanceA, chanceB, heavy, track, series, journal, LA = null, LB = null, ronde = 0, plage = null) {
  // UNE PLAGE (S70) : le gros match se joue en deux blocs, 0–40 puis 40–60.
  // Les punitions et les lancers s'y répartissent au prorata (la somme de
  // deux Poisson est un Poisson) ; sans plage, le code est celui d'avant.
  const [T0, T1] = plage || [0, 60];
  const frac = (T1 - T0) / 60;
  const occasions = pA.occasions && pB.occasions ? (pA.occasions + pB.occasions) / 2
    : (pA.occasions || pB.occasions || occasionsEpoque(pA.annee || pB.annee));
  let gfA = 0, gfB = 0;
  const fenetres = [];
  let minutesAN = 0;
  // Le jeu physique de la soirée (coups, bagarres, mêlées), avant les lancers : il décide qui est au cachot et qui a l'élan.
  tirerPhysique(pA, pB, T0, T1, journal, track);

  /*
   * UNE SEULE LIGNE DU TEMPS. Chaque équipe prend son nombre de punitions
   * (Poisson sur les occasions de l'époque et son indiscipline), puis TOUTES
   * les mineures du match sont posées sur les soixante minutes sans jamais
   * se chevaucher : une situation à la fois, comme au vrai tableau
   * indicateur. Avant, chaque côté tirait ses instants dans son coin et le
   * direct montrait les deux clubs en avantage en même temps, des fenêtres
   * qui s'enchaînaient sans fin. Ce qui est joué ne change pas — même nombre
   * de fenêtres, mêmes lancers, mêmes probabilités — seul l'INSTANT change,
   * et le temps n'est qu'attribué (MOTEUR.md). Règles portées : deux
   * minutes, le premier but de l'avantage la ferme, un but en désavantage ne
   * la ferme pas, et le puni prend ses deux minutes de punition. Le cinq
   * contre trois et le quatre contre quatre ne sont pas modélisés.
   */
  const mineures = [];
  const tirerMineures = (cote, puni) => {
    const n = poisson(occasions * (puni ? puni.discipline : 1) * frac);
    for (let k = 0; k < n; k++) mineures.push({ cote, puni });
  };
  tirerMineures('A', pB);   // `cote` = l'équipe qui PROFITE ; `puni` = l'alignement qui écope
  tirerMineures('B', pA);
  // Les départs : n fenêtres de deux minutes dans 60, dans un ordre mêlé,
  // séparées par des écarts tirés au hasard (partition uniforme du temps libre).
  shuffle(mineures);
  const libre = Math.max(0, (T1 - T0) - mineures.length * AN_MINUTES);
  const coupures = Array.from({ length: mineures.length }, () => hasard() * libre).sort((a, b) => a - b);
  mineures.forEach((m, k) => { m.t0 = T0 + coupures[k] + k * AN_MINUTES; });

  for (const m of mineures) {
    const cote = m.cote;
    const [off, def, gOff, gDef, chOff, chDef] = cote === 'A'
      ? [pA, pB, gA, gB, chanceA, chanceB] : [pB, pA, gB, gA, chanceB, chanceA];
    const t0 = m.t0;
    const coupable = m.puni && m.puni.patineurs.length ? weightedPick(m.puni.patineurs, p => punitionsRel(p) + 0.05) : null;
    if (coupable && track) coupable.simPIM = (coupable.simPIM || 0) + AN_MINUTES;
    const entree = journal ? { cote: cote === 'A' ? 'B' : 'A', instant: t0, joueur: coupable, minutes: AN_MINUTES, fin: t0 + AN_MINUTES } : null;
    if (entree) journal.punitions.push(entree);
    const st = {
      mode: 'AN', lancers: AN_TIRS_MIN * AN_MINUTES * (off.avantage ? off.avantage.volume : 1),
      fenetre: [t0, t0 + AN_MINUTES], arretAuBut: true,
      unitesOff: off.avantage, unitesDef: def.desavantage, qualite: AN_QUALITE,
    };
    const b = jouerCote(off, def, gDef, chOff, heavy, track, series, journal, cote, st, ronde);
    const fin = st.finBut != null ? st.finBut : t0 + AN_MINUTES;
    if (entree) { entree.fin = fin; entree.butAN = st.finBut != null; }
    fenetres.push([t0, fin]);
    minutesAN += fin - t0;
    // L'équipe en désavantage tire aussi, peu, avec ses quatre.
    const dn = {
      mode: 'DN', lancers: DN_TIRS_MIN * (fin - t0), fenetre: [t0, fin],
      unitesOff: def.desavantage, unitesDef: off.avantage, qualite: DN_QUALITE,
    };
    const bd = jouerCote(def, off, gOff, chDef, heavy, track, series, journal, cote === 'A' ? 'B' : 'A', dn, ronde);
    if (cote === 'A') { gfA += b; gfB += bd; } else { gfB += b; gfA += bd; }
  }

  const part = Math.max(0.5 * frac, ((T1 - T0) - minutesAN) / 60);
  const fe = plage ? { mode: 'FE', part, fenetres, plage, plancher: Math.round(6 * frac) } : { mode: 'FE', part, fenetres };
  gfA += jouerCote(pA, pB, gB, chanceA, heavy, track, series, journal, 'A', { ...fe }, ronde);
  gfB += jouerCote(pB, pA, gA, chanceB, heavy, track, series, journal, 'B', { ...fe }, ronde);
  return { gfA, gfB };
}

/*
 * LA LECTURE DU SOIR (js/impact.js). Ce que le moteur ferait de CE club CE soir, lu sans rien jouer : les
 * deux profils exactement comme `playGame` les pose, et la chance moyenne d'un lancer dans chaque situation
 * (forces égales, avantage, désavantage), des deux côtés. `jouerCote` fait le calcul de chaque lancer — c'est
 * lui qu'on interroge, pas une copie — sous un hasard à part, en sommant `p` au lieu de tirer le but : le
 * tirage ne dépend plus de `p`, donc deux lectures (avec et sans un effet) se comparent sans bruit.
 * Sans adversaire, le soir se lit contre un club moyen (le profil de référence de la ligue).
 * `effets` : des canaux posés le temps de la lecture, comme une consigne de match ; `aVenir` : les décisions du jour.
 */
export const CADRE_DU_MATCH = { AN_MINUTES, AN_TIRS_MIN, DN_TIRS_MIN, FE_TIRS };
export function lectureDuMatch(team, lineup = null, adv = null, { aVenir = [], effets = [], effetsAdv = [], lignes = null, mutation = null, nu = false, neutre = null, series = false, ronde = 0, heavy = false, n = 700 } = {}) {
  return avecAVenir(team, aVenir, () => {
    const avait = '_effetMatch' in team, sauve = team._effetMatch;
    const avaitAdv = !!adv && '_effetMatch' in adv, sauveAdv = adv ? adv._effetMatch : null;
    const lignesAvant = team.lignes, lignesMatch = team._lignesMatch, avaitL = 'lignes' in team, avaitM = '_lignesMatch' in team;
    const echelle = ECHELLE_SOIR;
    let posee = null;
    try {
      if (adv && effetsAdv.length) adv._effetMatch = [...(sauveAdv || []), ...effetsAdv];
      if (effets.length) team._effetMatch = [...(sauve || []), ...effets];
      // `lignes` : les quatre lignes (système, agressivité, glace) à jouer à la place des tiennes — un système ou une agressivité qu'on essaie.
      if (lignes) { team.lignes = lignes.map(l => ({ ...l })); team._lignesMatch = null; }
      // `mutation` : un changement de carte posé le temps de la lecture sur un joueur (`joueur`, ou celui que la carte vise).
      ECHELLE_SOIR = 1;
      // `rien` : la modif n'est pas posée, mais son joueur est lu (le même gardien devant le filet des deux côtés d'une différence).
      posee = mutation && !mutation.rien ? poserMutationLue(team, lineup, mutation) : null;
      // `nu` : le même alignement sans aucun effet (cartes, patrons, coachs, moments, roulement) — ce que le build y change se lit par différence.
      if (nu) { team.cartes = []; team.patrons = []; team.coachs = []; team.effets = []; team.effetsSerie = []; team.roulement = 'quatre'; team._effetMatch = []; }
      const lu = lineup || activeLineup(team);
      // `neutre` : { badges, chimie, jambes, systemes } remis au neutre pour TON club (ses habillés), toute la lecture durant.
      if (neutre) { NEUTRE = { ...neutre, team, joueurs: new Set(Object.values(lu).filter(Boolean)) }; MEMO_MATCH++; }
      const A = profilMatch(team, lu, adv);
      A.rob = teamStrength(team, lu).rob; A.domicile = true;
      let B, gB = null;
      if (adv) {
        const lb = activeLineup(adv);
        B = profilMatch(adv, lb, team);
        B.rob = teamStrength(adv, lb).rob; B.domicile = false;
        gB = pickGoalie(lb, adv.games, adv);
      } else {
        B = { pression: REF.pression, zDef: REF.zDef, fgDefaut: REF.fg, discipline: 1, occasions: null, patineurs: [], rob: MOY_ROB_EQUIPE, traitRob: 0 };
        // Un effet sur eux, posé sur le club de référence comme `profilMatch` le pose (mêmes bornes).
        for (const e of effetsAdv) {
          if (e.volume) B.pression = borne(REF.pression * e.volume, 0.40, REF.pression * PRESSION_MAX);
          if (e.finition) B.finitionFacteur = Math.min(FINITION_MAX, e.finition);
          if (e.defense) B.traitDef = e.defense;
          if (e.discipline) B.discipline = borne(e.discipline, DISCIPLINE_MIN, DISCIPLINE_MAX);
          if (e.robustesse) B.traitRob = e.robustesse;
        }
      }
      // Une carte de gardien se lit avec SON gardien devant le filet ; sa part des départs dit combien de soirs elle joue.
      const gMut = mutation && MUTATIONS[mutation.cle] && MUTATIONS[mutation.cle].gardien ? joueurDeMutation(team, lineup, mutation.cle, mutation.joueur) : null;
      const gA = gMut || pickGoalie(lu, team.games, team);
      let partDuFilet = 1;
      if (gMut) { const [st, bk] = gardiensDuSoir(lu), aux = bk ? partAuxiliaire(st, bk) : 0; partDuFilet = gMut === st ? 1 - aux : aux; }
      const occasions = A.occasions && B.occasions ? (A.occasions + B.occasions) / 2 : (A.occasions || B.occasions || occasionsEpoque(A.annee || B.annee));
      const lire = (off, def, g, mode, joueurs = null) => pMoyenDuLancer(off, def, g, mode, { heavy, series, ronde, n, joueurs });
      const p = { pour: {}, contre: {} }, joueurs = {};
      for (const mode of ['FE', 'AN', 'DN']) {
        joueurs[mode] = new Map();
        p.pour[mode] = lire(A, B, gB, mode, joueurs[mode]);
        p.contre[mode] = lire(B, A, gA, mode);
      }
      // Les blessures attendues ce soir (la formule d'`applyInjuries`, sans les aléas du soir) et l'usure moyenne des jambes par habillé.
      const dissuasion = Math.exp(-DISSUASION * robZ(A));
      const habilles = Object.values(lu).filter(Boolean);
      const blessures = habilles.reduce((a, q) => a + injuryChance(q, heavy) * mutDe(q, 'blessure'), 0) * dissuasion * effetsDeSaison(team).blessure;
      const couts = coutsDuSoir(team, lu);
      const usure = couts.length ? couts.reduce((a, [, c]) => a + c, 0) / couts.length : 0;
      return { A, B, occasions, p, joueurs, partDuFilet, blessures, usure };
    } finally {
      if (avait) team._effetMatch = sauve; else delete team._effetMatch;
      if (adv && effetsAdv.length) { if (avaitAdv) adv._effetMatch = sauveAdv; else delete adv._effetMatch; }
      if (lignes) {
        if (avaitL) team.lignes = lignesAvant; else delete team.lignes;
        if (avaitM) team._lignesMatch = lignesMatch; else delete team._lignesMatch;
      }
      ECHELLE_SOIR = echelle;
      if (NEUTRE) { NEUTRE = null; MEMO_MATCH++; }
      if (posee) { posee(); MEMO_MATCH++; }
    }
  });
}
/*
 * UN CHANGEMENT DE CARTE POSÉ POUR LA LECTURE : le joueur d'abord (celui qu'on donne, sinon celui que la carte vise,
 * sinon le centre du premier trio), puis une photo de ses champs de mutation pour les lui rendre tels quels.
 * Rend la fonction qui les rend ; `null` si personne ne peut le porter.
 */
const CHAMPS_MUTATION = ['_mut', '_amel', '_mutProfils', '_mutCles', '_partout', '_cran', '_enBas', '_ombre', '_abri', '_carte'];
/* Le joueur qu'une modif lue vise : celui qu'on donne, sinon celui que la carte vise, sinon le partant (une carte de gardien) ou le centre du premier trio. */
export function joueurDeMutation(team, lineup, cle, joueur = null) {
  const lu = lineup || activeLineup(team);
  // Une carte de gardien se lit sur le partant : posée sur un patineur, ses arrêts ne changeraient rien (« à peine perceptible »).
  const gardien = !!(MUTATIONS[cle] && MUTATIONS[cle].gardien);
  return joueur || cibleMutation(team, cle) || lu[SLOTS.find(sl => !sl.scratch && (gardien ? sl.group === 'G' && sl.unit === 0 : sl.group === 'F' && sl.unit === 0 && sl.role === 'C')).i] || null;
}
function poserMutationLue(team, lineup, { cle, joueur = null, retirer = false }) {
  const p = joueurDeMutation(team, lineup, cle, joueur);
  if (!p) return null;
  const photo = CHAMPS_MUTATION.map(k => [k, k in p, p[k] && typeof p[k] === 'object' ? (Array.isArray(p[k]) ? [...p[k]] : { ...p[k] }) : p[k]]);
  const mutations = team.mutations, avaitMutations = 'mutations' in team, nb = mutations ? mutations.length : 0;
  if (retirer) {
    // Une modif déjà posée : on la retire le temps de la lecture (ses facteurs se divisent, ses profils se soustraient).
    const M = MUTATIONS[cle];
    if (M) {
      const dans = M.source === 'amelioration' ? p._amel : p._mut;
      for (const c of CANAUX_MUT) if (M[c] && dans && dans[c]) dans[c] /= M[c];
      for (const [k, d] of Object.entries(M.profils || {})) if (p._mutProfils && k in p._mutProfils) p._mutProfils[k] -= d;
      if (M.partout) delete p._partout;
      if (M.enBas) delete p._enBas;
      if (M.cran && p._cran) p._cran = Math.max(0, p._cran - M.cran);
      if (M.ombre) delete p._ombre;
      if (M.abri) delete p._abri;
    }
  } else appliquerMutation(team, p, cle, 0, 'lecture');
  return () => {
    for (const [k, avait, v] of photo) { if (avait) p[k] = v; else delete p[k]; }
    if (avaitMutations) { team.mutations = mutations; mutations.length = nb; } else delete team.mutations;
  };
}
/* La chance moyenne d'un lancer de `off` sur le gardien de `def`, dans une situation. `mode` : FE, AN (off a l'avantage) ou DN (off est puni). */
function pMoyenDuLancer(off, def, gardien, mode, { heavy, series, ronde, n, joueurs = null }) {
  const espP = { s: 0, n: 0, joueurs };
  const st = mode === 'FE' ? { mode, lancers: n, fenetres: [], espP }
    : mode === 'AN' ? { mode, lancers: n, fenetre: [0, AN_MINUTES], unitesOff: off.avantage, unitesDef: def.desavantage, qualite: AN_QUALITE, espP }
      : { mode, lancers: n, fenetre: [0, AN_MINUTES], unitesOff: off.desavantage, unitesDef: def.avantage, qualite: DN_QUALITE, espP };
  avecHasardIsole('lecture', () => jouerCote(off, def, gardien, 1, heavy, null, series, null, 'A', st, ronde));
  // Par tireur, en parts des lancers lus : sa part des tirs, et sa part des buts attendus.
  if (joueurs && espP.n) for (const j of joueurs.values()) { j.t /= espP.n; j.b /= espP.n; }
  return espP.n ? espP.s / espP.n : 0;
}

function butProlongation(off, def, gardien, track = true, journal = null, cote = 'A') {
  if (track && gardien) gardien.simSA = (gardien.simSA || 0) + 1;
  let glaceContre = [];
  if (track && def && def.unites) {
    glaceContre = [...choisirPresence(def.unites.F).joueurs, ...choisirPresence(def.unites.D).joueurs];
    for (const x of glaceContre) { x.simPM--; x.simMoins = (x.simMoins || 0) + 1; }
  }
  if (!off.unites) return;
  // Même règle qu'au cinq contre cinq : l'unité qui tire au poids offensif,
  // l'autre à la présence.
  const tireDef = hasard() < PART_LANCERS_D;
  const trio = tireDef ? choisirPresence(off.unites.F) : choisirUnite(off.unites.F);
  const paire = tireDef ? choisirUnite(off.unites.D) : choisirPresence(off.unites.D);
  const unite = tireDef ? paire : trio;
  const glace = [...trio.joueurs, ...paire.joueurs];
  if (!glace.length) return;
  const tireur = weightedPick(unite.joueurs.length ? unite.joueurs : glace, p => lancersRel(p) * pctTirRel(p));
  const passeurs = [];
  const co = glace.filter(x => x !== tireur);
  let a1 = null;
  if (co.length && hasard() < P_PASSE_1) { a1 = weightedPick(co, propensionPasse); passeurs.push(a1); }
  if (track) {
    tireur.simSH = (tireur.simSH || 0) + 1;
    tireur.simG++; tireur.simPTS++;
    if (a1) { a1.simA++; a1.simPTS++; }
    for (const x of glace) { x.simPM++; x.simPlus = (x.simPlus || 0) + 1; }
  }
  if (journal) {
    const instant = 60 + hasard() * 5;
    journal.tirs[cote][4]++;
    journal.lancers.push({ cote, instant, tireur, gardien, but: true });
    journal.buts.push({ cote, instant, marqueur: tireur, passeurs, gardien, gagnant: true, pour: glace, contre: glaceContre });
  }
}

/**
 * Saison solo : 82 matchs contre un adversaire strictement moyen.
 *
 * Sert de repli quand les 31 vraies équipes n'ont pas pu être chargées, et
 * de banc d'essai à `calibrate_sim.mjs` et `check_monotonie.mjs`. Le moteur
 * est le même que celui d'un vrai match — seul l'adversaire est une
 * abstraction plutôt qu'un vestiaire.
 */
export function simulate(roster, { graine = null } = {}) {
  if (graine === null || graine === undefined) graine = nouvelleGraine();
  grainerHasard(graine);
  const team = createTeam('Solo', 'YOU', roster);
  team.luck = gauss() * LUCK_SEASON;
  for (const s of SLOTS) if (roster[s.i]) initSimStats(roster[s.i]);

  const force = teamStrength(team);
  let W = 0, L = 0, OTL = 0, GF = 0, GA = 0;

  for (let g = 0; g < 82; g++) {
    const heavy = g % 4 === 3;
    const lineup = activeLineup(team);
    const gardien = pickGoalie(lineup, g, team);
    const profil = profilMatch(team, lineup);
    profil.rob = force.rob;

    const chance = Math.exp(gauss() * LUCK_GAME + team.luck);
    let { gfA: gf, gfB: ga } = jouerSoixanteMinutes(profil, PROFIL_NEUTRE, gardien, null, chance, 1, heavy, true, false, null, lineup, null);
    let win = false, otl = false;

    if (gf === ga) {
      const p = 1 / (1 + Math.exp(-(force.clu + profil.meneur - 52) / 9));
      if (hasard() < p) { gf++; W++; win = true; butProlongation(profil, PROFIL_NEUTRE, null); }
      else { ga++; OTL++; otl = true; butProlongation(PROFIL_NEUTRE, profil, gardien); }
    } else if (gf > ga) { W++; win = true; } else { L++; }

    crediterMatch(lineup, gardien, ga, win, otl);
    updateTogether(team, lineup);
    applyInjuries(team, lineup, heavy, null, null, profil);
    team.games++;
    GF += gf; GA += ga;
  }

  return {
    W, L, OTL, GF, GA,
    points: W * 2 + OTL,
    attaque: force.att, brigade: force.def, rob: force.rob, clu: force.clu,
    gRating: force.g,
  };
}

/**
 * Saison complète : chaque journée apparie des équipes au hasard, et chacune
 * joue exactement `games` matchs.
 *
 * LA CÉDULE ACCEPTE UN NOMBRE IMPAIR D'ÉQUIPES. Une ligue d'une saison fixée
 * compte tous ses vrais clubs PLUS le tien — trente-trois en 2024-25 — et
 * c'était jusqu'ici le club le plus faible qui cédait sa place. Il n'a plus
 * à le faire : quand l'effectif est impair, une équipe est en congé chaque
 * journée (celle à qui il reste le moins de matchs à jouer), comme dans la
 * vraie ligue où tout le monde ne joue pas le même soir. Le nombre de
 * journées s'allonge de ce qu'il faut — 85 pour trente-trois clubs — et
 * chaque équipe finit ses 82 matchs, donc le classement se compare toujours
 * à nombre de matchs égal.
 */
/*
 * LES DÉCISIONS EN SAISON. JP : *faire que ya plus de choix à faire pendant
 * la saison*. La saison se jouait d'un coup et l'écran révélait ; l'alignement
 * signé au repêchage était l'alignement des 82 matchs. Le moteur étant
 * déterministe, une décision est une chose simple : au début de la journée
 * `jour`, l'alignement de l'équipe prend la forme `cases` (index de case →
 * clé de joueur, `getPlayerKey`), puis la journée se joue. Les journées
 * d'AVANT rejouent à l'identique — mêmes appels au hasard, dans le même ordre
 * — et tout ce qui suit diverge, ce qui est exactement ce qu'une décision
 * fait. Une permutation des MÊMES 23 objets, jamais un joueur neuf : les
 * fiches (`simG`…) vivent sur l'objet joueur et le suivent de case en case,
 * et `team.injured` aussi.
 *
 * La décision 0 est l'alignement de départ. Sans elle, une reprise partirait
 * de l'alignement COURANT de `G.roster`, c'est-à-dire de la dernière
 * décision, et les premières journées ne se rejoueraient plus. Appliquer
 * l'alignement qu'on a déjà ne change rien (check_graine.mjs le vérifie).
 */
function appliquerDecision(team, d, graine = 0) {
  // UNE CARTE EST UNE DÉCISION comme une autre : elle s'applique au jour où
  // elle a été prise et vaut pour le reste de la saison.
  if (d.carte && CARTES[d.carte]) (team.cartes = team.cartes || []).push(d.carte);
  if ('fermeture' in d) team.fermeture = d.fermeture;
  if ('roulement' in d && ROULEMENTS[d.roulement]) team.roulement = d.roulement;
  // UN CHANGEMENT DE CARTE PAR CHOIX (S68) : direct, ou porté par l'option
  // d'un dilemme. Le joueur visé est nommé dans la décision.
  const mut = d.mutation || (d.moment && d.moment.joueur && (() => {
    const fam = familleDeMoment(d.moment);
    const o = fam && fam.options.find(x => x.cle === d.moment.choix);
    return o && o.mutation ? { cle: o.mutation, joueur: d.moment.joueur } : null;
  })());
  if (mut && MUTATIONS[mut.cle]) {
    const p = Object.values(team.roster).find(x => x && getPlayerKey(x) === mut.joueur) || CONNUS.get(mut.joueur);
    if (p) appliquerMutation(team, p, mut.cle, d.jour, 'choix', mut);
  }
  // LES LIGNES À LA HOCKEYARENA (S68) : [{ tac, agr, sec }] × 4.
  if (Array.isArray(d.lignes)) team.lignes = d.lignes.map(l => ({ ...l }));
  // DEVANT LE FILET CE SOIR (1.0, C4) : 'partant', 'aux' ou 'auto' (la rotation).
  if (d.filet && Number.isFinite(d.jour)) team._filetForce = d.filet === 'auto' ? null : { jour: d.jour, qui: d.filet };
  // UN MOMENT (S66) : un effet temporaire, du jour de la décision à sa fin.
  const eff = effetDeMoment(d, team);
  if (eff) (team.effets = team.effets || []).push(eff);
  /*
   * CE QU'UNE CARTE FAIT EN PLUS D'UN EFFET (S72) : son pari, son
   * investissement, ses gestes réels sur les joueurs nommés. Et l'effet
   * direct d'une décision (le verdict d'un objectif raté).
   */
  if (d.moment) {
    const fam = familleDeMoment(d.moment);
    const o = fam && fam.options.find(x => x.cle === d.moment.choix);
    if (o) appliquerGestes(team, o, d.jour, d.moment.joueurs, graine, cleDuPari(d), fam.titre);
  }
  if (d.avant && AVANT_GROS[d.avant.cle]) {
    const o = AVANT_GROS[d.avant.cle].options.find(x => x.cle === d.avant.choix);
    if (o) appliquerGestes(team, o, d.jour, d.avant.joueurs, graine, cleDuPari(d), AVANT_GROS[d.avant.cle].titre);
  }
  // LE STAGE DE SYSTÈME (S73) : toute la formation apprend une tactique d'un coup.
  if (d.maitrise && systemeDe(d.maitrise.tac)) {
    for (const s of SLOTS) {
      const p = team.roster[s.i];
      if (!p || p.p === 'G') continue;
      // Un système de trio s'apprend aux avants, un système de paire aux défenseurs (S79).
      if ((systemeDe(d.maitrise.tac).groupe === 'D') !== (s.group === 'D')) continue;
      p._maitrise = p._maitrise || {};
      const m = p._maitrise[d.maitrise.tac] || 0;
      p._maitrise[d.maitrise.tac] = m + (1 - m) * (d.maitrise.gain || GAIN_STAGE);
    }
    stageDEntente(team, d.maitrise.tac);
  }
  /*
   * UN PATRON ENGAGÉ (S79, js/banque.js) : la décision porte ses chiffres
   * (`{ cle, role, nom, ico, ...canaux }`) et remplace celui du même rôle —
   * un seul entraîneur-chef à la fois. Il vaut jusqu'à la fin de la saison,
   * séries comprises (`effetsDeSaison`).
   */
  if (d.patron && d.patron.cle) {
    const rempl = new Set([d.patron.cle, ...(d.patron.remplace || [])]);
    team.patrons = (team.patrons || []).filter(x => !rempl.has(x.cle) && !(d.patron.role && x.role === d.patron.role));
    const { remplace: _r, ...pat } = d.patron;
    team.patrons.push(pat);
  }
  // LA CONFIANCE D'UN COACH (v2, js/coachs.js) : la décision porte ses chiffres, et la nouvelle remplace l'ancienne du même coach.
  if (d.coach && d.coach.cle) team.coachs = [...(team.coachs || []).filter(x => x.cle !== d.coach.cle), { ...d.coach }];
  /*
   * LES GESTES D'UNE CARTE (S79) : un soin (des matchs d'infirmerie en
   * moins), de l'énergie, le repos du gardien — sur les joueurs NOMMÉS par la
   * décision. Réels, et rejoués comme tout le reste.
   */
  if (d.gestes) {
    const g = d.gestes;
    const nommes = (g.joueurs || []).map(k => Object.values(team.roster).find(x => x && getPlayerKey(x) === k) || CONNUS.get(k)).filter(Boolean);
    if (g.soin) for (const p of (g.tousLesBlesses ? [...team.injured.keys()] : nommes)) {
      const n = team.injured.get(p);
      if (!n) continue;
      if (n <= g.soin) team.injured.delete(p); else team.injured.set(p, n - g.soin);
    }
    if (g.energie) for (const p of nommes) rendreJambes(p, g.energie);
    if (g.energieTous) for (const s of SLOTS) { const p = team.roster[s.i]; if (p && p.p !== 'G') rendreJambes(p, g.energieTous); }
    if (g.gardienAux) team.gardienAux = Math.max(team.gardienAux || 0, apresMatchs(team, d.jour, g.gardienAux));
  }
  if (d.effet) {
    const { duree, nom, ico, ...canaux } = d.effet;
    (team.effets = team.effets || []).push({ debut: d.jour, fin: apresMatchs(team, d.jour, duree || DUREE_MOMENT), source: 'decision', nom, ico, ...canaux });
  }
  appliquerAlignement(team, d);
}

/*
 * LA PART « ALIGNEMENT » D'UNE DÉCISION : qui entre (le ballottage, un pack
 * signé) et la photo des cases. Elle ne consomme aucun hasard et se rejoue à
 * l'identique : c'est ce qui permet à l'écran de la poser dès la décision
 * prise (`poserAlignementDuJour`), avant que le matin de la journée la refasse.
 */
function appliquerAlignement(team, d) {
  /*
   * LE BALLOTTAGE (S66) : un joueur réclamé prend une case de réserve, et
   * celui qui l'occupait est libéré. C'est la SEULE décision qui fait entrer
   * un joueur neuf ; il doit donc être connu du moteur (`connaitre`) avant la
   * saison, et ses fiches partent de zéro le jour où il arrive.
   */
  if (d.ballottage) {
    const b = d.ballottage;
    const p = CONNUS.get(b.entre);
    // S78 : la case que le joueur CHOISIT de libérer (`choisirQuiSort`), réserve ou pas — pourvu qu'il puisse la jouer.
    if (p && SLOTS[b.i] && fits(p, SLOTS[b.i])) {
      initSimStats(p);
      team.roster[b.i] = p;
    }
  }
  const cases = d.cases;
  if (!cases) return;
  const parCle = new Map();
  for (const p of Object.values(team.roster)) if (p) parCle.set(getPlayerKey(p), p);
  // En place : `team.roster` est l'objet même que l'interface tient (G.roster).
  for (const k of Object.keys(team.roster)) delete team.roster[k];
  for (const [i, cle] of Object.entries(cases)) {
    // Un joueur libéré au ballottage n'est plus dans l'alignement courant,
    // mais la décision 0 le nomme encore : on le retrouve parmi les connus.
    const p = parCle.get(cle) || CONNUS.get(cle);
    // Un connu qui entre en cours de saison (un pack signé) n'a pas encore de matchs : à zéro, comme une reprise le mettrait.
    if (p && !parCle.has(cle) && p.simGP == null) initSimStats(p);
    if (p) team.roster[i] = p;
  }
}

/*
 * L'ALIGNEMENT DE LA JOURNÉE À VENIR, TOUT DE SUITE (S79). JP : *les cartes
 * que j'ouvre des packs s'ajoutent pas dans mon équipe ?*. Depuis que la ligue
 * se joue au jour le jour, une décision d'aujourd'hui ne s'applique qu'au matin
 * de sa journée (`jouerJournee`) : le joueur signé n'apparaissait qu'une fois
 * la journée jouée, et l'écran montrait l'ancien alignement jusque-là. On pose
 * donc dès maintenant la part alignement des décisions de la journée à venir —
 * exactement ce que le matin refera (idempotent, sans hasard). Rien ne se joue
 * d'avance : aucun match, aucun effet, aucune carte.
 */
export function poserAlignementDuJour(L) {
  if (!L || L.fini || !L.teams) return;
  for (const d of L.decisions || []) {
    if (d.jour !== L.jour || !(d.ballottage || d.cases)) continue;
    const t = L.teams[d.equipe || 0];
    if (t) appliquerAlignement(t, d);
  }
}

/*
 * LES JOUEURS QUE LE MOTEUR CONNAÎT, par clé. Une décision ne porte que des
 * clés (elle traverse la sauvegarde) ; le moteur les résout ici. Tout joueur
 * aligné au début d'une saison y entre, et le contrôleur y ajoute ceux du
 * ballottage avant de rejouer.
 */
const CONNUS = new Map();
export function connaitre(p) { if (p) CONNUS.set(getPlayerKey(p), p); }

/** Photographie d'un alignement, telle que les décisions la portent. */
export function photoAlignement(roster) {
  const cases = {};
  for (const [i, p] of Object.entries(roster)) if (p) cases[i] = getPlayerKey(p);
  return cases;
}

/*
 * `situations` ÉTEINT ou CIBLE les situations — pour la mesure seulement.
 * `false` les éteint partout ; une FONCTION `(i) => bool` ne les donne qu'aux
 * équipes choisies.
 *
 * ET IL FAUT LA FONCTION, pas le booléen, pour mesurer quoi que ce soit. Une
 * ligue est à SOMME NULLE : si les trente-deux équipes vivent des situations,
 * la moyenne des victoires gagnées est zéro par identité, et celle des buts
 * pour égale celle des buts contre pour la même raison — les buts d'une
 * équipe sont ceux qu'une autre encaisse. Un « écart net » mesuré ainsi ne
 * peut PAS être autre chose que zéro, quelles que soient les amplitudes : le
 * garde-fou passerait toujours, et il ne garderait rien. C'est la leçon des
 * sélecteurs qui ne matchent rien, appliquée à une mesure.
 *
 * `check_situations.mjs` traite donc la moitié des équipes puis l'autre, comme
 * `check_cartes.mjs`, et compare chaque équipe À ELLE-MÊME contre le même
 * champ. Les situations ne consommant aucun hasard, l'appariement est en
 * prime PARFAIT : à traitement égal, les deux passages sont la même
 * simulation au lancer près.
 */
/*
 * LA LIGUE SE JOUE AU JOUR LE JOUR (S79). JP : *tu devrais jamais simuler
 * d'avance*. La saison se jouait d'un bloc — les 82 journées, dès qu'on
 * lançait — et l'écran les dévoilait ensuite : tout ce qui lisait l'état du
 * moteur (les compteurs `sim*`, les changements de carte, l'énergie) lisait
 * la FIN de l'année, et chaque décision rejouait la saison entière.
 *
 * Maintenant le moteur ne joue QUE ce qui est arrivé :
 *
 *   creerLigue(teams, games, { graine, decisions })  la ligue, prête à jouer
 *                    sa journée 0 : les équipes remises à neuf, la chance de
 *                    saison tirée, les styles posés, la cédule tirée, le matin
 *                    du jour 0 préparé (`preludeDuJour`) ;
 *   jouerJournee(L)  UNE journée : ses décisions (lues dans `L.decisions`, la
 *                    même liste que la sauvegarde), ses matchs, puis le matin
 *                    du lendemain ;
 *   jouerJusqua(L, n) les journées jusqu'à ce que `n` soient jouées ;
 *   bilanLigue(L)    le classement et les meneurs, À CE JOUR.
 *
 * `simulateLeague` reste : créer, jouer tout, rendre le bilan — c'est ce que
 * lisent les scripts de mesure, et c'est EXACTEMENT la même suite que les
 * mêmes journées jouées une à une (`check_graine.mjs` l'exige).
 *
 * LA CÉDULE N'EST PAS UNE SIMULATION. Qui joue contre qui, et quel soir, se
 * tire d'un générateur À PART (`graine:cedule`) avant la première journée :
 * l'affiche du prochain match se connaît sans qu'un seul match soit joué, et
 * les matchs ne consomment plus le hasard de l'affiche. Chaque match est un
 * objet `{ A, B }` posé d'avance, que sa journée complète (`gfA`, `gfB`,
 * `ot`, `feuille`, `joue`) : l'écran garde les mêmes objets du début à la fin.
 *
 * LE HASARD DE LA LIGUE EST À ELLE (`L.rng`). Le temps d'une journée, le
 * moteur tire de son générateur, puis rend le sien à qui l'avait : le
 * pronostic, le plateau ou l'exhibition peuvent tirer entre deux journées
 * sans décaler d'un seul dé la suite de la saison (`avecLigue`).
 */
function avecLigue(L, fn) {
  const avant = hasard;
  hasard = L.rng;
  try { return fn(); } finally { L.rng = hasard; hasard = avant; }
}

/* La cédule : les affiches de toutes les journées, tirées d'un générateur à part. */
function ceduleDe(teams, games, graine) {
  const rng = generateur(`${graine}:cedule`);
  const melanger = a => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // Ce qu'il reste à jouer à chaque équipe. Une journée apparie tout le monde
  // quand l'effectif est pair ; sinon celle qui a le moins de matchs à jouer
  // est en congé, ce qui garde les restes à un match les uns des autres et
  // fait retomber tout le monde sur `games` à la fin.
  const restant = new Map(teams.map(t => [t, games]));
  const cedule = [];
  while (restant.size) {
    const order = melanger(teams.filter(t => restant.get(t) > 0));
    if (order.length < 2) break;
    // Tri stable : l'ordre du brassage départage les équipes à égalité.
    order.sort((a, b) => restant.get(b) - restant.get(a));
    if (order.length % 2) order.pop();
    const jour = [];
    for (let i = 0; i < order.length; i += 2) {
      jour.push({ A: order[i], B: order[i + 1] });
      restant.set(order[i], restant.get(order[i]) - 1);
      restant.set(order[i + 1], restant.get(order[i + 1]) - 1);
    }
    cedule.push(jour);
    for (const [t, n] of restant) if (n <= 0) restant.delete(t);
  }
  /*
   * UN VRAI CALENDRIER (1.0, oct.). JP : *espacer les matchs avec des jours
   * entre, vrai calendrier, ce qui te permettrait de slotter les événements
   * hors des jours de matchs*. Chaque ronde (tout le monde apparié une fois)
   * s'étale sur sa fenêtre de deux ou trois jours, et chaque match y tombe
   * un jour tiré du même générateur : la ligue joue 82 matchs en
   * `JOURS_PAR_MATCH` × 82 jours, comme la LNH (~186), avec des congés, des
   * séquences de deux jours de repos et des dos-à-dos (un match à la fin
   * d'une fenêtre, le suivant au début de l'autre).
   */
  const D = Math.round(cedule.length * JOURS_PAR_MATCH);
  const jours = Array.from({ length: D }, () => []);
  cedule.forEach((ronde, r) => {
    const a = Math.floor(r * D / cedule.length), b = Math.max(a + 1, Math.floor((r + 1) * D / cedule.length));
    for (const m of ronde) jours[a + Math.floor(rng() * (b - a))].push(m);
  });
  return jours;
}

/*
 * LES JOURS OÙ UNE ÉQUIPE JOUE (1.0, oct.), dans l'ordre : `t._jours[k]` est
 * le jour de son (k+1)-e match. Une DURÉE se dit en matchs (« 6 matchs ») et
 * le moteur compte en jours : `apresMatchs` donne le jour où elle finit.
 * Sans cédule (les séries, un test), un jour vaut un match.
 */
function poserJours(L) {
  for (const t of L.teams) t._jours = [];
  L.calendrier.forEach((jour, d) => { for (const m of jour) { m.A._jours.push(d); m.B._jours.push(d); } });
}
/* Le jour qui suit le n-e match de l'équipe à partir du jour `jour` (lui compris). */
function apresMatchs(t, jour, n) {
  const js = t && t._jours;
  if (!js || !Number.isFinite(jour) || !(n > 0)) return jour + (n || 0);
  let i = 0;
  while (i < js.length && js[i] < jour) i++;
  const k = i + n - 1;
  return k < js.length ? js[k] + 1 : (js.length ? js[js.length - 1] : jour) + 1 + (k - js.length + 1);
}
/*
 * LE JOUR D'UN ÉVÉNEMENT (1.0, oct.). Les dates des événements se disent en
 * MATCHS du club (`JOURS_MOMENTS`, `JOURS_SITUATIONS`, les paliers… : « avant
 * son k-e match », k matchs déjà joués). L'événement tombe la VEILLE de ce
 * match quand c'est un congé — JP : *slotter les événements hors des jours de
 * matchs* —, le jour même après un dos-à-dos. Sans cédule, le jour k.
 */
export function jourEvenement(t, k) {
  const js = t && t._jours;
  if (!js || !js.length) return k;
  const i = Math.max(0, Math.min(k, js.length - 1)), j = js[i];
  return j > 0 && !(i > 0 && js[i - 1] === j - 1) ? j - 1 : j;
}
/* Le numéro d'événement (dans `liste`) qui tombe ce jour-là chez ce club, ou undefined. */
const evenementDuJour = (t, liste, jour) => liste.find(k => jourEvenement(t, k) === jour);
/* Les matchs de l'équipe dans les jours [a, b). */
export function matchsEntre(t, a, b) {
  const js = t && t._jours;
  if (!js) return Math.max(0, b - a);
  return js.filter(j => j >= a && j < b).length;
}

export function creerLigue(teams, games = 82, { graine = null, decisions = [], situations = true, accidents = situations, courbe = false, des = null } = {}) {
  // La saison porte sa graine : donnée, elle rejoue la même ; absente, on en
  // tire une et on la rend, pour que « Rejouer » et l'historique la gardent.
  if (graine === null || graine === undefined) graine = nouvelleGraine();
  const L = {
    teams, games, graine, decisions,
    // LES DÉS DE CHAQUE JOURNÉE (1.0, oct.), { matins, soirs }, voir `deDuJour`. Absents (un script de mesure), la graine décide de tout.
    des,
    vit: typeof situations === 'function' ? situations : () => !!situations,
    // Les accidents de carte suivent les situations, sauf demande contraire (une mesure des seules situations).
    vitAcc: typeof accidents === 'function' ? accidents : () => !!accidents,
    rng: generateur(graine),
    // `jour` : les journées JOUÉES. La prochaine à jouer est `L.jour`.
    jour: 0, fini: false,
    calendrier: ceduleDe(teams, games, graine),
    // Le gros match du prochain soir, repéré d'avance sans rien jouer (voir `preludeDuJour`).
    grosAVenir: null, grosAnnonces: {},
  };
  poserJours(L);
  avecLigue(L, () => {
    /*
     * L'ALIGNEMENT DU JOUR 0 D'ABORD (1.0, oct.). Une reprise recrée ton club
     * avec l'alignement d'AUJOURD'HUI (un blessé descendu, un réserviste
     * monté) ; la force des clubs et leur style (mesuré par rapport à la
     * moyenne de la ligue, la tienne comprise) se prenaient sur lui, et un
     * club voisin changeait de style : tout le passé se rejouait autrement
     * (JP : *faut vraiment que le passé soit gelé*). Le jour 0 l'aurait posé
     * de toute façon ; on le pose avant de mesurer.
     */
    // Ceux d'aujourd'hui restent connus : la décision qui les a montés les nommera.
    for (const t of teams) for (const s of SLOTS) if (t.roster[s.i]) connaitre(t.roster[s.i]);
    for (const d of decisions) {
      if (d.jour !== 0 || !d.cases || d.ballottage) continue;
      const t = teams[d.equipe || 0];
      if (t) appliquerAlignement(t, d);
    }
    for (const t of teams) {
      for (const s of SLOTS) if (t.roster[s.i]) { initSimStats(t.roster[s.i]); connaitre(t.roster[s.i]); }
      // La chance de saison est tirée ICI, sous la graine, et non à
      // `createTeam` : sinon deux saisons de même graine différaient déjà
      // avant le premier lancer (check_graine.mjs l'a attrapé).
      t.luck = gauss() * LUCK_SEASON;
      // Une ligue neuve part de zéro : les cartes, les situations, les cases
      // vides, les effets, les gestes réels, la chimie et l'énergie, les
      // changements de carte, les gros matchs.
      t.cartes = []; t.patrons = []; t.coachs = [];
      t.situations = [];
      t.trous = []; t.trouEnCours = false;
      t.effets = []; t.jourCourant = 0;
      t.absents = new Map(); t.gardienAux = 0; t.paris = []; t._gardienAuxMatch = false; t._filetForce = null; t._filetMatch = null;
      t.chimie = [0, 0, 0, 0]; t.entente = new Map();
      // LA COURBE DE LA FIN DE PARTIE (S80, `echelleTardive`) : une ligue Rogue la porte, et ses séries avec elle.
      t.courbe = !!courbe;
      for (const s of SLOTS) if (t.roster[s.i]) { delete t.roster[s.i]._maitrise; delete t.roster[s.i]._adapt; }
      for (const s of SLOTS) if (t.roster[s.i]) { const p = t.roster[s.i]; p.energie = 100; delete p._reserve; delete p._suite; delete p._aine; delete p._mut; delete p._amel; delete p._mutProfils; delete p._mutCles; delete p._partout; delete p._cran; delete p._enBas; delete p._ombre; delete p._abri; }
      t.mutations = []; t.jourLignes = []; t.minisBoss = []; t.defaitesContre = new Map();
      t._gros = null; t._effetMatch = null; t._entracte = null; t._advGros = null; t._dernierGros = null; t._enAttente = []; t._dernierAnnonce = null;
      for (const s of SLOTS) if (t.roster[s.i]) delete t.roster[s.i]._situ;
    }
    /*
     * LES JOUEURS QUI ARRIVENT EN COURS DE SAISON (S74). La remise à zéro
     * ci-dessus ne voit que les alignements du jour 0 : un joueur réclamé au
     * ballottage, une recrue du deck, entre plus tard — et gardait l'énergie,
     * la maîtrise, l'adaptation et les changements de carte de la saison
     * PRÉCÉDENTE jouée dans la même session. Tous les joueurs connus repartent
     * de la même page.
     */
    for (const p of CONNUS.values()) {
      if (!p) continue;
      /*
       * SES MATCHS AUSSI (1.0, oct.). Un joueur sorti de l'alignement (remplacé par une signature)
       * revient par une décision datée d'avant : il gardait les `sim*` de la saison jouée avant la
       * reprise, et `effetCarte` lit `simGP` (la recrue qui progresse après 41 matchs). Deux reprises
       * de la même partie lui donnaient le bonus à des soirs différents — le passé bougeait (smoke, graine 7).
       */
      initSimStats(p);
      p.energie = 100; delete p._reserve; delete p._suite; delete p._aine;
      delete p._maitrise; delete p._adapt; delete p._situ;
      delete p._mut; delete p._amel; delete p._mutProfils; delete p._mutCles; delete p._partout; delete p._cran; delete p._enBas; delete p._ombre; delete p._abri;
    }
    /*
     * LA FORCE APRÈS LA REMISE À ZÉRO (1.0, oct.). Elle se mesurait au début
     * de la boucle, sur des joueurs qui portaient encore les jambes et la
     * maîtrise d'un aperçu du repêchage : la première saison n'avait pas la
     * même force — ni le même style de club — que sa reprise, et le passé
     * changeait au rafraîchissement (le smoke, graine 3).
     */
    for (const t of teams) t.strength = teamStrength(t);   // à pleine santé, pour les barres du résultat
    // LE STYLE DE CHAQUE CLUB, posé une fois, sans hasard (voir STYLES).
    poserStyles(teams);
    if (!L.calendrier.length) L.fini = true;
    else preludeDuJour(L);
  });
  return L;
}

/*
 * LE MATIN D'UNE JOURNÉE : la récupération, l'instantané que l'écran lit
 * (`jourLignes`), les situations et les accidents du jour — rien de tout ça
 * ne tire un dé — et le gros match du soir, repéré sur le classement de la
 * veille. Il se prépare dès la fin de la veille : c'est l'état « à ce jour »
 * que le banc et le hub lisent, sans jouer un seul match du lendemain.
 */
/*
 * LES DÉS DU JOUR (1.0, oct.). JP : *le principe de seed, ça suce* — la graine
 * écrivait toute la saison d'avance : un club rebâti, une saison rejouée
 * redonnaient le même avenir. Une journée tire maintenant SES dés au vrai
 * hasard, chacun quand il sert, et la sauvegarde les garde (`L.des`) : le
 * passé se rejoue à l'identique, l'avenir n'est écrit nulle part.
 *   - le dé du MATIN, à son arrivée : qui et quoi pour les situations et les accidents ;
 *   - le dé du SOIR, rendu aux matchs (JP : *ça devrait pas les tirer rendu
 *     au match ?*) — un matin relu ne sait rien du soir.
 * Sans `L.des` (un script), la graine seule, comme avant.
 */
function deDuJour(L, quand, r) {
  if (!L.des) return null;
  const d = L.des[quand];
  return d[r] || (d[r] = nouvelleGraine());
}
const graineDuMatin = (L, r) => (L.des ? `${L.graine}:${deDuJour(L, 'matins', r)}` : L.graine);

function preludeDuJour(L) {
  const r = L.jour, teams = L.teams;
  deDuJour(L, 'matins', r);   // le dé du matin, à son arrivée : la sauvegarde du matin le garde
  for (const t of teams) { t.jourCourant = r; if (r > 0) recupererEnergie(t, ENERGIE_RECUP_JOUR); }
  /*
   * L'INSTANTANÉ DU JOUR (S68) : la chimie de chaque ligne et l'énergie de
   * chaque joueur AU DÉBUT de la journée.
   */
  for (const t of teams) {
    (t.jourLignes = t.jourLignes || [])[r] = {
      chimie: (t.chimie || [0, 0, 0, 0]).slice(),
      // L'APPRENTISSAGE DU JOUR (S73), pour ta formation seulement : l'écran
      // calcule la chimie qu'aurait une ligne, pour n'importe quelle tactique.
      ...(t.isPlayer ? { apprentissage: {
        entente: Object.fromEntries(t.entente || []),
        maitrise: Object.fromEntries(SLOTS.map(s => t.roster[s.i]).filter(Boolean).map(p => [getPlayerKey(p), { ...(p._maitrise || {}) }])),
      } } : {}),
      energie: Object.fromEntries(SLOTS.map(s => t.roster[s.i]).filter(Boolean).map(p => [getPlayerKey(p), Math.round(p.p === 'G' ? jambesGardien(p) : energieDe(p))])),
      ...(t.isPlayer ? { filet: filetDuSoir(t) } : {}),
    };
  }
  /*
   * LE GROS MATCH S'ANNONCE D'AVANCE (S80). JP, sur « Le virus dans le
   * vestiaire » : *ces events gros matchs, ça devrait pas être le jour même,
   * mais dans les jours avant*. Puis (1.0, oct.) : *les événements pré-match
   * importants devraient avoir lieu le jour même, ou la veille* — deux
   * journées d'avance, c'était trop loin. Il se repère la VEILLE (ANNONCE_GROS),
   * sur le classement et les rivalités de CE jour-là — rien n'est joué
   * d'avance, on lit ce qui est connu — et il ne bouge plus ensuite :
   * l'avant-match (le virus, la conférence de presse…) arrive à l'annonce,
   * son effet joue le soir du match. `grosAVenir` reste le gros match du
   * soir, repéré AVANT les situations et les accidents (S79) : eux attendent
   * un jour sans gros match.
   */
  const toi = teams[0] && teams[0].isPlayer ? teams[0] : null;
  L.grosAnnonces = L.grosAnnonces || {};
  if (toi) for (let j = r; j <= r + ANNONCE_GROS; j++) annoncerGros(L, toi, j);
  L.grosAVenir = (toi && L.grosAnnonces[r]) || null;
  /*
   * LES SITUATIONS ET LES ACCIDENTS DU JOUR, avant les décisions : ils ne
   * consomment AUCUN hasard — de la graine, de la journée et du rang.
   *
   * PAS LE SOIR D'UN GROS MATCH (S79). JP : *souvent, un jour de match
   * important, tu sors un événement genre maladie ou truc du genre, ça
   * devrait pas être synchro*. Chez TA formation, une situation ou un
   * accident prévu un soir de gros match attend le lendemain (les gros
   * matchs sont espacés de ESPACEMENT_GROS journées). Il garde son tirage :
   * la journée PRÉVUE décide qui et quoi, la journée réelle décide quand.
   */
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    const tienne = t === toi;
    if (tienne && L.grosAVenir) {
      const kS = evenementDuJour(t, JOURS_SITUATIONS, r), kA = evenementDuJour(t, JOURS_ACCIDENTS, r);
      if (L.vit(i) && kS !== undefined) (t._enAttente = t._enAttente || []).push(['situation', kS]);
      if (L.vitAcc(i) && kA !== undefined) (t._enAttente = t._enAttente || []).push(['accident', kA]);
      continue;
    }
    // Le tirage est le NUMÉRO de l'événement (son match), le jour est celui où il tombe chez ce club.
    const kS = evenementDuJour(t, JOURS_SITUATIONS, r), kA = evenementDuJour(t, JOURS_ACCIDENTS, r);
    if (L.vit(i) && kS !== undefined) poserSituations(t, graineDuMatin(L, r), r, i, kS);
    if (L.vitAcc(i) && kA !== undefined) poserAccident(t, graineDuMatin(L, r), r, i, kA);
    if (tienne && t._enAttente && t._enAttente.length) {
      for (const [quoi, prevu] of t._enAttente.splice(0)) {
        if (quoi === 'situation') poserSituations(t, graineDuMatin(L, r), r, i, prevu);
        else poserAccident(t, graineDuMatin(L, r), r, i, prevu);
      }
    }
  }
}
/* Le classement à ce jour, par rang (1 = premier) : ce que la veille dit des gros matchs. */
const rangsDe = teams => new Map(teams.slice().sort((a, b) => b.PTS - a.PTS || b.W - a.W).map((t, i) => [t, i + 1]));

/* UNE JOURNÉE : ses décisions, ses matchs, puis le matin du lendemain. */
export function jouerJournee(L) {
  if (L.fini) return;
  const r = L.jour, teams = L.teams, graine = L.graine;
  avecLigue(L, () => {
    // Les décisions du jour s'appliquent AVANT les matchs : elles ne
    // consomment aucun hasard, donc une décision au jour k ne touche pas aux
    // journées d'avant.
    let sel = null, entracteDuJour = null, mainDuJour = null;
    const avantsDuJour = [];
    for (const d of L.decisions) {
      if (d.jour !== r) continue;
      // LE CHOIX DU DEUXIÈME ENTRACTE (S70) se joue à 40:00, pas au matin :
      // ni appliqué ici, ni son sel mêlé aux dés de la journée.
      if (d.entracte) { entracteDuJour = d; continue; }
      if (d.avant) avantsDuJour.push(d);
      // LA MAIN DU GROS MATCH (S74) : les cartes jouées ce soir-là.
      if (d.main) mainDuJour = d;
      const t = teams[d.equipe || 0];
      if (t) appliquerDecision(t, d, graine);
      if (d.sel) sel = `${sel || ''}${d.sel}`;
    }
    /*
     * DES DÉS NEUFS APRÈS CHAQUE DÉCISION (S68). JP : *ça devrait jamais être
     * identique si on simule deux fois un match*. Une décision porte son SEL,
     * tiré au vrai hasard quand on la prend : à partir de sa journée, la
     * saison se joue sur une suite neuve. Un rechargement redonne les mêmes
     * matchs — le sel est dans la sauvegarde avec la décision.
     */
    // Et le dé du soir (`deDuJour`), tiré maintenant, rendu aux matchs.
    const de = deDuJour(L, 'soirs', r);
    if (sel || de) grainerHasard(`${graine}:${r}:${de ? `${de}:` : ''}${sel || ''}`);
    // LES MINI-BOSS DU JOUR (S69) : ceux que le matin d'il y a ANNONCE_GROS
    // journées a annoncés (S80). Seule ta formation (l'équipe 0 quand elle est
    // le joueur) en a.
    const toi = teams[0] && teams[0].isPlayer ? teams[0] : null;
    const annonce = toi && L.grosAnnonces ? L.grosAnnonces[r] : null;
    for (const m of L.calendrier[r]) {
      // CHAQUE MATCH DE SAISON GARDE SA FEUILLE, comme un match de séries :
      // ses buts avec leurs passeurs, ses gardiens, ses tirs par période.
      const feuille = feuilleVierge();
      const avecToi = toi && (m.A === toi || m.B === toi);
      const advToi = avecToi ? (m.A === toi ? m.B : m.A) : null;
      const raison = avecToi && annonce && annonce.adv === advToi ? annonce.raison : null;
      let gros = null;
      if (raison) {
        const depistage = depistageDe(graine, `j${r}`, advToi);
        gros = { jour: r, adv: advToi, raison, depistage, plan: planDuDepistage(graine, `j${r}`, depistage),
          prep: mainDuJour ? mainDuJour.prep || null : null,
          avant: avantsDuJour.length ? avantsDuJour[avantsDuJour.length - 1].avant : null,
          effetsAvant: avantsDuJour.map(effetAvant).filter(Boolean),
          cartes: mainDuJour ? mainDuJour.main : null, cleCartes: `${graine}:j${r}:${mainDuJour ? mainDuJour.sel || '' : ''}`,
          graineMain: graine, cleMain: `j${r}` };
        poserGros(toi, advToi, gros);
        if (entracteDuJour) toi._entracte = { ...entracteDuJour.entracte, graine: `${graine}:${r}:entracte:${entracteDuJour.sel || ''}` };
      }
      const res = playGame(m.A, m.B, r, true, false, feuille, 0, true);
      if (gros && gros.cartesJouees) feuille.cartes = gros.cartesJouees;
      Object.assign(m, { gfA: res.gfA, gfB: res.gfB, ot: res.ot, feuille, joue: true });
      if (avecToi) grosMatchApres(toi, m, r, gros);
      if (gros) leverGros(toi);
    }
    L.jour = r + 1;
    if (L.jour >= L.calendrier.length) {
      L.fini = true;
      L.grosAVenir = null;
      // Les séries ne lisent aucun effet temporaire : la fenêtre est close.
      for (const t of teams) t.jourCourant = Infinity;
    } else preludeDuJour(L);
  });
}

/* Jouer jusqu'à ce que `n` journées soient jouées (ou la saison finie). */
export function jouerJusqua(L, n) {
  while (!L.fini && L.jour < n) jouerJournee(L);
  return L;
}

/* Le classement et les meneurs, à ce jour. */
export function bilanLigue(L) {
  const standings = L.teams.slice().sort((a, b) =>
    b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF);
  const skaters = [];
  for (const t of L.teams) for (const s of SLOTS) {
    const p = t.roster[s.i];
    if (p && p.p !== 'G') skaters.push({ player: p, team: t });
  }
  const leaders = skaters.sort((a, b) => b.player.simPTS - a.player.simPTS || b.player.simG - a.player.simG).slice(0, 10);
  return { standings, leaders, calendrier: L.calendrier, graine: L.graine };
}

/*
 * LA SAISON D'UN BLOC, pour les mesures : créer, jouer tout, rendre le bilan.
 * Le générateur de la ligue reste ensuite en place — les séries jouées par un
 * script de mesure continuent la même suite, comme avant.
 */
export function simulateLeague(teams, games = 82, opts = {}) {
  const L = jouerJusqua(creerLigue(teams, games, opts), Infinity);
  hasard = L.rng;
  return { ...bilanLigue(L), ligue: L };
}

/* Les champs de fiche que la simulation écrit, patineurs et gardiens. */
const CHAMPS_SIM = ['simGP', 'simG', 'simA', 'simPTS', 'simPM', 'simInj', 'simSH', 'simPIM', 'simPPG',
  'simW', 'simL', 'simOTL', 'simGA', 'simSO', 'simSA', 'simSV'];
const CHAMPS_EQUIPE = ['W', 'L', 'OTL', 'GF', 'GA', 'PTS', 'games'];

/**
 * LES SÉRIES ONT LEURS PROPRES STATISTIQUES. Le moteur n'a qu'un jeu de
 * compteurs (`sim*`) ; plutôt que d'en câbler un second dans chaque lancer,
 * on photographie les fiches de saison avant les séries, on laisse les
 * séries s'y inscrire par-dessus, puis `separerSeries` rend à la saison ses
 * chiffres et pose la différence dans `p.po` — les statistiques des séries,
 * à part. Les compteurs d'équipe et le journal reprennent aussi leur état
 * de fin de saison.
 */
function photoStats(teams) {
  const photo = new Map();
  for (const t of teams) {
    photo.set(t, Object.fromEntries(CHAMPS_EQUIPE.map(k => [k, t[k]])));
    photo.get(t).journal = t.journal ? t.journal.length : 0;
    photo.get(t).blessures = t.injuriesLog ? t.injuriesLog.length : 0;
    for (const s of SLOTS) {
      const p = t.roster[s.i];
      if (p) photo.set(p, Object.fromEntries(CHAMPS_SIM.map(k => [k, p[k]])));
    }
  }
  return photo;
}

/** Une feuille de match vierge, prête à recevoir le journal d'un match. */
export function feuilleVierge() {
  return {
    buts: [],
    lancers: [],                                          // chaque tir, daté, avec tireur, gardien et mode (FE, AN, DN)
    punitions: [],                                        // { cote (l'équipe punie), instant, joueur, minutes }
    blessures: [],                                        // { cote, joueur, matchs, instant } : racontées au direct (S80)
    physique: [],                                         // { type: coup | bagarre | melee, cote, instant, joueur, cible, gagnant, minutes } (1.0)
    coups: { A: 0, B: 0 },                                // les mises en échec de chaque club, attendues (1.0)
    tirs: { A: [0, 0, 0, 0, 0], B: [0, 0, 0, 0, 0] },   // index 1-4 : périodes
    arrets: { A: 0, B: 0 },
    prolongation: false,
  };
}

/** Tirs d'un côté, toutes périodes confondues. */
export const tirsTotal = (feuille, cote) => feuille.tirs[cote].reduce((a, b) => a + b, 0);

/**
 * CE QUE DES FEUILLES DE MATCH DISENT DE CHAQUE JOUEUR, cumulé : buts,
 * passes, points des patineurs ; matchs, victoires, tirs reçus, arrêts et
 * buts alloués des gardiens. La clé est l'objet joueur. `compte` se passe
 * d'un appel à l'autre pour cumuler jour après jour, ou match après match,
 * sans tout relire.
 */
export function compterFeuilles(feuilles, compte = new Map()) {
  const de = p => {
    let c = compte.get(p);
    if (!c) { c = { g: 0, a: 0, pts: 0, gp: 0, w: 0, l: 0, sa: 0, sv: 0, ga: 0, bl: 0, pm: 0, sh: 0, pim: 0 }; compte.set(p, c); }
    return c;
  };
  for (const f of feuilles) {
    if (!f) continue;
    // Les matchs joués d'un patineur : les soirs où il était habillé.
    for (const cote of ['A', 'B']) for (const p of (f.alignes?.[cote] || [])) de(p).gp++;
    for (const b of f.buts) {
      if (b.marqueur) { const c = de(b.marqueur); c.g++; c.pts++; }
      for (const a of b.passeurs || []) { const c = de(a); c.a++; c.pts++; }
      // Le +/- va à ceux que le moteur a mis sur la glace pour ce but-là.
      for (const x of b.pour || []) de(x).pm++;
      for (const x of b.contre || []) de(x).pm--;
    }
    for (const l of f.lancers || []) if (l.tireur) de(l.tireur).sh++;
    for (const pu of f.punitions || []) if (pu.joueur) de(pu.joueur).pim += pu.minutes || 2;
    // Les bagarres et les mêlées (1.0) : les minutes vont aux deux.
    for (const e of f.physique || []) if (e.minutes) { if (e.joueur) de(e.joueur).pim += e.minutes; if (e.cible) de(e.cible).pim += e.minutes; }
    for (const cote of ['A', 'B']) {
      const g = cote === 'A' ? f.gardienA : f.gardienB;
      if (!g) continue;
      const c = de(g);
      const contre = cote === 'A' ? 'B' : 'A';
      const alloues = f.buts.filter(b => b.cote === contre && b.gardien === g).length;
      c.gp++; c.ga += alloues; c.sv += f.arrets[cote] || 0; c.sa += (f.arrets[cote] || 0) + alloues;
      if (f.vainqueur === cote) c.w++; else c.l++;
      if (!alloues) c.bl++;
    }
  }
  return compte;
}

/**
 * Série 4 de 7 entre deux équipes. Les blessures et l'usure s'appliquent
 * (c'est ce que l'ancien moteur sautait), les statistiques de saison non.
 * `feuilles` porte le sommaire de chaque match : buts avec leur instant,
 * tirs par période, arrêts. C'est ce que l'écran des séries raconte.
 */
export function playSeries(A, B, track = false, ronde = 0) {
  let wA = 0, wB = 0, g = 0;
  const feuilles = [];
  while (wA < 4 && wB < 4) {
    const feuille = feuilleVierge();
    const r = playGame(A, B, g++, track, true, feuille, ronde);
    if (r.winner === A) wA++; else wB++;
    feuille.numero = g;
    feuille.serie = `${wA}-${wB}`;
    feuilles.push(feuille);
  }
  return { winner: wA === 4 ? A : B, wA, wB, feuilles };
}

/*
 * L'EXHIBITION (S78, js/exhibition.js). JP : *choisir n'importe quelles
 * équipes de toutes ères et les faire jouer contre pour le fun*. Deux clubs
 * neufs (des COPIES de leurs joueurs, voir `copieDeJoueur`), sous leur PROPRE
 * graine : le générateur du moteur est mis de côté puis rendu, donc la saison
 * en cours — ses séries continuent le même fil après `simulateLeague` — ne
 * voit rien passer. Rien de ce que la partie connaît n'est touché : ni
 * `CONNUS`, ni les objets des shards, ni la chance de saison.
 *
 * `clubs` : `[locaux, visiteurs]`, chacun `{ nom, tag, saison, roster }` —
 * les équipes naissent ICI, sous la graine, parce que `createTeam` tire déjà
 * au hasard. Les locaux sont A : ils reçoivent, comme dans `playGame`.
 *
 *   quoi = 'match'  un match de saison (la prolongation tranche)
 *        = 'serie'  un 4 de 7, comme en séries
 *        = 'fois'   `n` matchs, chacun sur des équipes remises à neuf
 */
export function copieDeJoueur(p) {
  const c = { ...p };
  // Ce que la saison pose sur un joueur (carte, adaptation, situations, énergie…) reste à la saison.
  for (const k of Object.keys(c)) if (k.startsWith('_') && k !== '_rk') delete c[k];
  return c;
}
function remettreANeuf(t) {
  for (const s of SLOTS) { const p = t.roster[s.i]; if (p) { initSimStats(p); p.energie = 100; delete p._reserve; delete p._suite; delete p._aine; } }
  t.injured = new Map(); t.together = new Map(); t.togetherSig = new Map(); t.injuriesLog = []; t.journal = [];
  t.W = 0; t.L = 0; t.OTL = 0; t.GF = 0; t.GA = 0; t.PTS = 0; t.games = 0;
  t.strength = teamStrength(t);
  t.luck = 0;   // un soir, pas une saison : la chance est celle du match (LUCK_GAME)
  t.cartes = []; t.patrons = []; t.coachs = []; t.situations = []; t.trous = []; t.trouEnCours = false; t.effets = []; t.jourCourant = 0;
  t.absents = new Map(); t.gardienAux = 0; t.paris = []; t._gardienAuxMatch = false; t._filetForce = null; t._filetMatch = null;
  t.chimie = [0, 0, 0, 0]; t.entente = new Map();
  t.mutations = []; t.jourLignes = []; t.minisBoss = []; t.defaitesContre = new Map();
  t._gros = null; t._effetMatch = null; t._entracte = null; t._advGros = null; t._dernierGros = null; t._enAttente = []; t._dernierAnnonce = null;
}
export function jouerExhibition(clubs, graine, quoi = 'match', n = 100) {
  const avant = hasard;
  hasard = generateur(graine);
  try {
    const [A, B] = clubs.map(c => createTeam(c.nom, c.tag, c.roster, { season: c.saison }));
    if (quoi === 'serie') { remettreANeuf(A); remettreANeuf(B); return { A, B, ...playSeries(A, B, true, 1) }; }
    if (quoi === 'fois') {
      const out = { A, B, wA: 0, wB: 0, prolongations: 0, gfA: 0, gfB: 0, n };
      for (let k = 0; k < n; k++) {
        remettreANeuf(A); remettreANeuf(B);
        const r = playGame(A, B, 0, false, false, null);
        if (r.winner === A) out.wA++; else out.wB++;
        if (r.ot) out.prolongations++;
        out.gfA += r.gfA; out.gfB += r.gfB;
      }
      return out;
    }
    remettreANeuf(A); remettreANeuf(B);
    const feuille = feuilleVierge();
    const r = playGame(A, B, 0, true, false, feuille);
    return { ...r, A, B, feuille };
  } finally {
    hasard = avant;
  }
}

/**
 * Alignement automatique d'un vestiaire : chaque case prend le meilleur
 * joueur restant qui y convient (cote cachée moins pénalité de position),
 * premier trio d'abord. `exclude` = clés de joueurs à ne pas utiliser.
 */
/*
 * LE CENTRE D'ABORD, PUIS LES AILES. Case par case dans l'ordre AG, C, AD,
 * le glouton mettait le meilleur attaquant du club à l'aile gauche du
 * premier trio quel que soit son poste — Yzerman à −3, parce que 3 points
 * de pénalité ne pèsent rien contre 30 de valeur — et le vrai centre
 * n'arrivait qu'après. Le centre de chaque trio se comble donc avant ses
 * ailiers ; un centre de trop passe encore à l'aile, comme dans la vraie
 * ligue, mais plus l'inverse.
 */
// Les cases de réserve de plus (S80) ne se remplissent qu'à la main, en Rogue : jamais par l'alignement automatique.
const ORDRE_AUTO = CASES_DE_BASE.slice().sort((a, b) => cleAuto(a) - cleAuto(b));
function cleAuto(s) { return s.i + (s.group === 'F' && !s.scratch && s.role === 'C' ? -1.5 : 0); }

export function autoRoster(pool, exclude = new Set()) {
  const avail = pool.filter(p => !exclude.has(getPersonKey(p)));
  const roster = {};
  const used = new Set();
  for (const s of ORDRE_AUTO) {
    let best = null, bestScore = -Infinity;
    for (const p of avail) {
      if (used.has(getPersonKey(p)) || !fits(p, s)) continue;
      const score = getHiddenRatings(p).v - getPositionPenalty(p, s);
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if (best) { roster[s.i] = best; used.add(getPersonKey(best)); }
  }
  return roster;
}

/*
 * Ce qu'une MUTATION de carte multiplie chez ce joueur (S68, voir MUTATIONS),
 * et le bonus de sa VARIANTE (S78, js/rarete.js : une parallèle, une holo ou
 * une or de TON alignement ; 1 pour tout autre joueur). S80 : une AMÉLIORATION
 * (`p._amel`) grandit avec le soir — voir `echelleTardive`.
 */
function mutDe(p, champ) {
  const m = p && p._mut;
  const a = p && p._amel && p._amel[champ];
  return ((m && m[champ]) || 1) * (a ? grandir(a, ECHELLE_SOIR) : 1) * effetCarte(p, champ);
}

/*
 * LA FIN DE PARTIE (S80). JP : *je veux que ça prenne plusieurs saisons et
 * upgrades gagner la coupe, pis les upgrade de trio aident au début, mais
 * les downgrade upgrade sont plus forts late game*.
 *
 * DEUX COURBES, dans une ligue Rogue (`creerLigue`, option `courbe`) :
 *   - LES CARTES DE TRIO (un système appris d'un coup, un style qui fait
 *     fitter une ligne, l'atelier qui place un joueur, les synergies du deck)
 *     sont PLEINES TOUT DE SUITE et ne grandissent pas ; celles de la saison
 *     PLAFONNENT : une ligne apprend son système à force de le jouer
 *     (`MAITRISE_PAS`, 92 % après trente matchs), ses paires s'entendent
 *     (`ENTENTE_MATCHS`), la chimie a son plafond (`chimieMax`). Le stage du
 *     premier mois vaut des semaines de pratique ; celui de février ne vaut
 *     presque rien — la ligne sait déjà.
 *   - LES AMÉLIORATIONS D'UN JOUEUR (`source: 'amelioration'`) et les
 *     cartes qui VISENT L'ADVERSAIRE (le `adv` des cartes de match)
 *     GRANDISSENT : leur écart à 1 est multiplié par l'échelle du soir —
 *     ×0,5 au premier match, ×1 à la mi-saison (la valeur écrite sur la
 *     carte), ×1,5 au dernier, puis ×1,6 · ×1,75 · ×1,9 · ×2 aux quatre
 *     rondes des séries. « Le tir affûté » (précision +8 %) vaut +4 % en
 *     octobre, +8 % en janvier, +12 % en avril, +16 % en finale.
 * Mesuré (scripts/check_rogue.mjs, le même match sur les mêmes dés) : au
 * troisième soir, une carte de synergie vaut plus qu'une carte qui vise
 * l'adversaire ; en finale, c'est l'inverse, et une amélioration vaut deux
 * fois plus qu'en octobre. Commencer à ×1 ne suffisait pas : une carte qui
 * vise l'adversaire valait déjà plus que tout le reste au troisième soir, et
 * les cartes de trio n'aidaient jamais « au début ».
 *
 * L'échelle se POSE au début de chaque match (`playGame`), comme le soir
 * « grand » des cartes clutch : le moteur ne lit rien d'autre, et un match
 * joué ailleurs (le pronostic) la repose pour lui-même. Hors du Rogue, elle
 * vaut 1 : la saison et le tournoi ne changent pas.
 */
const ECHELLE_DEBUT = 0.5, ECHELLE_FIN_DE_SAISON = 1.5;
const ECHELLE_SERIES = [1.6, 1.75, 1.9, 2];
export function echelleTardive({ jour = 0, serie = false, ronde = 0, matchs = Math.round(82 * JOURS_PAR_MATCH) } = {}) {
  if (serie) return ECHELLE_SERIES[Math.max(0, Math.min(ECHELLE_SERIES.length - 1, ronde || 0))];
  return ECHELLE_DEBUT + (ECHELLE_FIN_DE_SAISON - ECHELLE_DEBUT) * Math.max(0, Math.min(1, (jour || 0) / Math.max(1, matchs - 1)));
}
/* Un facteur qui grandit : son écart à 1, multiplié par l'échelle. */
const grandir = (x, e) => 1 + (x - 1) * e;
/*
 * Un EFFET de carte qui grandit : chaque canal s'éloigne de 1 à l'échelle ;
 * la robustesse, qui est une somme (« +1,4 »), se multiplie ; les minutes des
 * lignes (`F`, `D`) aussi, poste par poste.
 */
export function grandirEffet(e, ech) {
  if (!e || ech === 1) return e ? { ...e } : e;
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'robustesse' && typeof v === 'number') out[k] = v * ech;
    else if (typeof v === 'number') out[k] = grandir(v, ech);
    else if (Array.isArray(v)) out[k] = v.map(x => grandir(x, ech));
    else out[k] = v;
  }
  return out;
}
let ECHELLE_SOIR = 1;
/*
 * LA COURBE, À L'ÉCRAN (1.0, J2-16 et R6). Une carte qui grandit ne le dit
 * qu'en Rogue — la saison et le tournoi n'ont pas de courbe, et « En Rogue,
 * grandit » sur une carte de saison parlait d'un autre mode. Et elle le dit
 * par une JAUGE à quatre crans (octobre ×0,5, janvier ×1, avril ×1,5, finale
 * ×2), le cran d'aujourd'hui allumé, au lieu d'une phrase coupée au bord.
 * Le contrôleur (js/game.js) branche les deux lectures : le mode, et
 * l'échelle du jour (null avant la saison).
 */
export const AFFICHAGE_COURBE = { actif: () => false, echelle: () => null };
const CRANS_COURBE = [0.5, 1, 1.5, 2];
export function motCourbe() {
  if (!AFFICHAGE_COURBE.actif()) return null;
  const e = AFFICHAGE_COURBE.echelle();
  const fmt = x => String(Math.round(x * 100) / 100).replace('.', ',');
  if (e == null) return { txt: '📈 Grandit : ×0,5 en octobre → ×2 en finale', bon: null };
  let k = 0;
  CRANS_COURBE.forEach((c, i) => { if (Math.abs(e - c) < Math.abs(e - CRANS_COURBE[k])) k = i; });
  const jauge = CRANS_COURBE.map((c, i) => (i === k ? '▰' : '▱')).join('');
  return { txt: `📈 Grandit ${jauge} ×${fmt(e)} ce soir · ×2 en finale`, bon: null };
}

/* Les trois colonnes brutes d'un profil, pour la mesure (`sonde_aptitudes.mjs`). */
export const colonnesProfil = p => ({ L: lancersBrut(p), T: tirBrut(p), P: passesRelatives(p) });

/* =====================================================================
   LES CHANGEMENTS DE CARTE (S68)

   JP : *events bonus et malus et changements de carte (lignes possibles,
   traits, etc) qui arrivent soit par accident, ou dans un choix
   stratégique, genre envoyer un plombier tirer du gun pour précision ou
   forcer un joueur à devenir défensif car sa lame de bâton ne se fait plus
   avec la tech actuelle* ; puis *je veux un max de variété possible*.

   Une MUTATION change un joueur pour le reste de la saison : ses PROFILS
   (donc le fit de sa ligne, donc sa chimie) et ses chiffres de match
   (lancers, finition, création, défense, blessures). Elle se lit sur sa
   carte comme une marque neuve. Elle arrive de deux façons :

     PAR CHOIX     une option de dilemme la porte, et le joueur visé est
                   nommé AVANT qu'on choisisse (`cibleMutation`)
     PAR ACCIDENT  à cinq journées fixes, chaque club a une chance d'en
                   vivre une — tirée de la graine, comme les situations,
                   donc la même partie vit les mêmes accidents

   Aucune cote neuve : tout passe par les canaux que le moteur lit déjà
   (`mutDe`, lu par `lancersRel`, `pctTirRel`, `passesRel`, la défense des
   présences et le risque de blessure) et par les profils.
   ===================================================================== */
export const MUTATIONS = {
  // ---- les améliorations du deck (S73) : un cadeau, au joueur de ton choix ----
  affute: { nom: 'Le tir affûté', ico: '🎯', cible: 'libre', source: 'amelioration',
    quoi: 'Des heures au filet après les pratiques : il marque plus.', profils: { sniper: 12, offensif: 10 }, finition: 1.176 },
  moteur: { nom: 'Le moteur', ico: '⚡', cible: 'libre', source: 'amelioration',
    quoi: 'Un été de cardio : il lance plus, et plus longtemps.', profils: { energie: 10 }, lancers: 1.154 },
  mur: { nom: 'Le mur', ico: '🧱', cible: 'libre', source: 'amelioration',
    quoi: 'Il lit le jeu adverse une seconde plus tôt.', profils: { deuxsens: 12, defensif: 12 }, defense: 0.898 },
  vision: { nom: 'La vision', ico: '🪄', cible: 'libre', source: 'amelioration',
    quoi: 'Il trouve des passes que personne ne voit.', profils: { passeur: 12, manieur: 10 }, creation: 1.176 },
  coach: { nom: 'L\'entraîneur des gardiens', ico: '🧤', cible: 'libre', source: 'amelioration', gardien: true,
    quoi: 'Un été avec l\'entraîneur des gardiens : il place mieux ses jambières.', arrets: 0.925 },
  /*
   * ---- L'ATELIER (S78) : éditer un joueur ----
   * JP : *ajouter cartes pour éditer joueur, genre ajouter position, changer
   * trios possibles, stats, enlever malus, ajouter bonus*. Les stats, c'est
   * l'amélioration (plus haut) ; l'atelier fait le reste, au joueur de ton
   * choix, pour le reste de la saison.
   */
  partout: { nom: 'Joue partout', ico: '🔀', cible: 'libre', source: 'atelier', partout: true,
    quoi: 'Il apprend les autres postes de son groupe : plus aucune pénalité hors position (centre ou ailes ; les deux côtés en défense).' },
  cran: { nom: 'Monte d\'un cran', ico: '⏫', cible: 'libre', source: 'atelier', cran: 1,
    quoi: 'Il rend à 100 % une ligne plus haut : un trio (ou une paire) de plus où il est à sa place.' },
  enBas: { nom: 'Joue en bas', ico: '⏬', cible: 'libre', source: 'atelier', enBas: true, lancers: 0.928,
    quoi: 'Un franc-tireur de premier trio qui rend au quatrième : la pénalité de joueur trop bas ne le touche plus, là seulement. Un cran plus haut, elle mord encore. Il lance un peu moins.' },
  chasse: { nom: 'La chasse à la vedette', ico: '👤', cible: 'libre', source: 'atelier', ombre: 0.86, lancers: 0.946,
    quoi: 'Tant qu\'il est habillé, il colle à leur meilleur joueur, même quand son trio n\'est pas sur la glace. Ce joueur-là marque moins. Lui lance un peu moins.' },
  physio: { nom: 'Le physio', ico: '🩺', cible: 'libre', source: 'atelier', physio: true,
    quoi: 'Le physio et le psy s\'en occupent : tous ses malus de carte disparaissent (un genou qui grince, une confiance ébranlée, un tir perdu).' },
  lustre: { nom: 'Le lustre', ico: '✨', cible: 'libre', source: 'atelier', lustre: true,
    quoi: 'Sa carte monte d\'une variante — base, parallèle, holo, or — et gagne le bonus tiré au hasard qui vient avec.' },
  // ---- par choix ----
  tir_gun: { nom: 'Précision au gun', ico: '🎯', cible: 'plombier', source: 'choix',
    quoi: 'Il a passé ses soirées à tirer du gun : il vise, maintenant.',
    profils: { sniper: 25, power: -5 }, finition: 1.22, lancers: 1.088 },
  lame: { nom: 'Converti en défensif', ico: '🧊', cible: 'franc', source: 'choix',
    quoi: 'Sa lame ne se fabrique plus : il ne sent plus sa rondelle, et on en fait un joueur défensif.',
    profils: { deuxsens: 15, checker: 15, sniper: -20 }, finition: 0.85, defense: 0.915 },
  gym: { nom: 'Dix livres de muscle', ico: '🦍', cible: 'rapide', source: 'choix',
    quoi: 'Un été au gym : plus lourd, plus solide, un peu moins vif.',
    profils: { power: 25, energie: -15 }, blessure: 0.7, lancers: 0.934 },
  patin: { nom: 'École de patinage', ico: '⚡', cible: 'lent', source: 'choix',
    quoi: 'Un entraîneur de patinage l\'a pris en main : il arrive avant la rondelle.',
    profils: { energie: 25 }, lancers: 1.132 },
  video: { nom: 'Les cassettes de Gretzky', ico: '🪄', cible: 'passeur', source: 'choix',
    quoi: 'Il étudie les vieilles cassettes : il voit le jeu une passe d\'avance.',
    profils: { passeur: 25 }, creation: 1.22, finition: 0.934 },
  pointe: { nom: 'La pointe de l\'avantage', ico: '💣', cible: 'pointe', source: 'choix',
    quoi: 'On lui donne la ligne bleue : il décoche à la moindre ouverture.',
    profils: { offensif: 25 }, lancers: 1.176 },
  dur: { nom: 'L\'école du vétéran', ico: '🧱', cible: 'mou', source: 'choix',
    quoi: 'Un vétéran lui apprend à défendre : il ne monte plus, il bloque.',
    profils: { defensif: 25, offensif: -10 }, defense: 0.898, creation: 0.89 },
  // ---- par accident ----
  prudent: { nom: 'Joue prudent', ico: '🤕', cible: 'hasard', source: 'accident',
    quoi: 'Depuis sa commotion, il évite les contacts.',
    profils: { power: -20, physique: -15 }, blessure: 1.2, defense: 1.03 },
  declic: { nom: 'Le déclic', ico: '🔥', cible: 'hasard', source: 'accident',
    quoi: 'Un but en bourrée, et depuis, tout rentre.',
    profils: { sniper: 15, offensif: 10 }, finition: 1.08 },
  mentor: { nom: 'Pris sous l\'aile', ico: '🧓', cible: 'hasard', source: 'accident',
    quoi: 'Le capitaine l\'a pris sous son aile : il fait les petites choses.',
    profils: { passeur: 10, deuxsens: 10, defensif: 10 }, creation: 1.05, defense: 0.97 },
  genou: { nom: 'Un genou qui grince', ico: '🦵', cible: 'hasard', source: 'accident',
    quoi: 'Il joue avec un genou qui grince : il n\'a plus sa première enjambée.',
    profils: { energie: -20 }, lancers: 0.93, blessure: 1.25 },
  baton: { nom: 'Nouveau bâton, nouveau lancer', ico: '🏒', cible: 'hasard', source: 'accident',
    quoi: 'Un nouveau modèle de bâton, et son lancer a pris dix kilomètres-heure.',
    profils: { sniper: 10, offensif: 15 }, finition: 1.05 },
  doute: { nom: 'Confiance ébranlée', ico: '🌧️', cible: 'hasard', source: 'accident',
    quoi: 'Hué dans son propre aréna : il ne tente plus rien.',
    profils: { sniper: -15, passeur: -10 }, finition: 0.93 },
  pere: { nom: 'Il joue pour son père', ico: '🕊️', cible: 'hasard', source: 'accident',
    quoi: 'Son père est au plus mal : il joue chaque présence comme la dernière.',
    profils: { power: 10, passeur: 10 }, lancers: 1.05, finition: 1.03 },
  /*
   * ---- LES STYLES DE JEU ET LES CONTRATS (S79, la banque) ----
   * JP : *une vraie banque de cartes … modifs de joueurs … digne d'un vrai
   * deck builder*. Les « styles » à la FUT : ce qu'un joueur devient pour la
   * saison — son profil (donc le fit de sa ligne) et un canal réel. Les
   * contrats : ce qu'une signature change chez lui, avec son prix. Même
   * contrat que les améliorations : un joueur, quelques pour cent.
   */
  style_sniper: { nom: 'Style : franc-tireur', ico: '🎯', cible: 'libre', source: 'style', quoi: 'Il ne cherche plus la passe : il cherche le coin.', profils: { sniper: 15 }, finition: 1.11 },
  style_faiseur: { nom: 'Style : faiseur de jeu', ico: '🪄', cible: 'libre', source: 'style', quoi: 'Il voit trois jeux d\'avance.', profils: { passeur: 15, manieur: 12 }, creation: 1.132 },
  style_ancre: { nom: 'Style : ancre', ico: '⚓', cible: 'libre', source: 'style', quoi: 'Il ne quitte plus sa zone.', profils: { defensif: 15, checker: 12 }, defense: 0.949 },
  style_locomotive: { nom: 'Style : locomotive', ico: '🚂', cible: 'libre', source: 'style', quoi: 'Il part avant la rondelle et arrive avant tout le monde.', profils: { energie: 12 }, lancers: 1.11 },
  style_chasseur: { nom: 'Style : chasseur', ico: '🐺', cible: 'libre', source: 'style', quoi: 'Il écrase le porteur et repart avec la rondelle.', profils: { power: 10, physique: 10 }, lancers: 1.066, finition: 1.044 },
  style_architecte: { nom: 'Style : architecte', ico: '📐', cible: 'libre', source: 'style', quoi: 'Chaque présence est un plan dessiné au tableau.', profils: { passeur: 12, manieur: 12 }, creation: 1.09, finition: 1.036 },
  style_sentinelle: { nom: 'Style : sentinelle', ico: '🛡️', cible: 'libre', source: 'style', quoi: 'Personne ne passe par son côté.', profils: { defensif: 15, deuxsens: 10 }, defense: 0.94 },
  style_canonnier: { nom: 'Style : canonnier', ico: '💣', cible: 'libre', source: 'style', quoi: 'Il décoche de la ligne bleue à chaque remise.', profils: { offensif: 15 }, lancers: 1.108 },
  style_buteur: { nom: 'Style : buteur né', ico: '👑', cible: 'libre', source: 'style', quoi: 'Il sent le but comme d\'autres sentent la pluie.', profils: { sniper: 20 }, finition: 1.112, lancers: 1.032 },
  style_pieuvre: { nom: 'Style : pieuvre', ico: '🐙', cible: 'libre', source: 'style', gardien: true, quoi: 'Des bras et des jambières partout dans le demi-cercle.', arrets: 0.955, blessure: 0.8 },
  masque_neuf: { nom: 'Le masque neuf', ico: '🎭', cible: 'libre', source: 'style', gardien: true, quoi: 'Un masque peint à ses couleurs : il se sent invincible.', arrets: 0.964 },
  baton_neuf: { nom: 'Le bâton neuf', ico: '🏒', cible: 'libre', source: 'style', quoi: 'La bonne courbe, enfin.', profils: { sniper: 5 }, finition: 1.075 },
  contrat_annee: { nom: 'Année de contrat', ico: '📝', cible: 'libre', source: 'contrat', quoi: 'Il joue pour son prochain contrat : chaque présence compte, quitte à trop en faire.', finition: 1.088, lancers: 1.066, blessure: 1.2 },
  contrat_prolonge: { nom: 'Prolongation signée', ico: '🖋️', cible: 'libre', source: 'contrat', quoi: 'Rassuré pour cinq ans : il se ménage un peu.', blessure: 0.7, finition: 0.975 },
  contrat_bonus: { nom: 'Clause de performance', ico: '💰', cible: 'libre', source: 'contrat', quoi: 'Un boni à trente buts : il force tout, même quand il ne faut pas.', finition: 1.09, creation: 1.054, blessure: 1.3 },
  contrat_leader: { nom: 'Le « C » cousu', ico: '©️', cible: 'libre', source: 'contrat', quoi: 'On lui donne le « C » : il porte l\'équipe sur son dos.', profils: { deuxsens: 8, defensif: 8 }, creation: 1.054, defense: 0.97 },
  style_courbe: { nom: 'Style : la courbe', ico: '📏', cible: 'libre', source: 'style', quoi: 'La courbe que le gabarit n\'aime pas : le lancer trompe, il passe moins.', profils: { sniper: 10, passeur: -6 }, finition: 1.088, creation: 0.956 },
  style_accrocheur: { nom: 'Style : l\'accrocheur', ico: '🪝', cible: 'libre', source: 'style', quoi: 'Il retient le bâton dans les coins, comme avant la règle. Moins de jeux, moins de lancers.', profils: { checker: 10, defensif: 8 }, defense: 0.949, lancers: 0.934 },
  style_fantome: { nom: 'Style : le fantôme', ico: '👻', cible: 'libre', source: 'style', abri: 0.5, creation: 0.928,
    quoi: 'Leur paire ne le trouve pas : la moitié de leur étouffement ne compte pas sur ses lancers. Il joue seul, alors il crée moins.' },
  ...MODIFS_VIE,
};
const CANAUX_MUT = ['lancers', 'finition', 'creation', 'defense', 'blessure', 'arrets'];
/* Un facteur qui NUIT : moins de tirs, de précision, de création ; plus de buts contre, de blessures, de buts accordés. */
const estMalus = (canal, x) => (canal === 'defense' || canal === 'blessure' || canal === 'arrets' ? x > 1 : x < 1);
/* Une mutation qui ne fait que nuire (un accident) : le physio l'efface de la carte. */
const malusSeul = k => {
  const M = MUTATIONS[k];
  return !!M && CANAUX_MUT.some(c => M[c]) && CANAUX_MUT.every(c => !M[c] || estMalus(c, M[c])) && Object.values(M.profils || {}).every(d => d <= 0);
};
/* Une mutation porte-t-elle un malus (même mêlé à un bonus) ? C'est ce que le physio effacerait. */
export const mutationNuit = k => {
  const M = MUTATIONS[k];
  return !!M && (CANAUX_MUT.some(c => M[c] && estMalus(c, M[c])) || Object.values(M.profils || {}).some(d => d < 0));
};
const MUTATIONS_ATELIER = ['partout', 'cran', 'physio', 'lustre', 'enBas', 'chasse'];

/*
 * QUI UNE MUTATION VISE, tiré des PROFILS de l'alignement — jamais d'une cote.
 * Le plombier est l'attaquant le plus puissant et le moins franc-tireur ;
 * « franc » la meilleure gâchette ; « lent » le moins rapide ; etc. Les ex
 * æquo se départagent sur l'identité, comme les situations.
 */
const CIBLES = {
  plombier: { g: 'F', s: pr => pr.power - pr.sniper },
  franc: { g: 'F', s: pr => pr.sniper },
  rapide: { g: 'F', s: pr => pr.energie },
  lent: { g: 'F', s: pr => -pr.energie },
  passeur: { g: 'F', s: pr => pr.sniper - pr.passeur },
  pointe: { g: 'D', s: pr => pr.manieur - pr.offensif },
  mou: { g: 'D', s: pr => -pr.defensif },
};
export function cibleMutation(team, cle) {
  const M = MUTATIONS[cle];
  const C = M && CIBLES[M.cible];
  if (!C) return null;
  const deja = new Set((team.mutations || []).filter(x => x.cle === cle).map(x => x.joueur));
  const js = SLOTS.filter(s => !s.scratch && s.group === C.g).map(s => team.roster[s.i])
    .filter(p => p && p.p !== 'G' && !deja.has(getPlayerKey(p)));
  js.sort((a, b) => C.s(profilsBase(b)) - C.s(profilsBase(a)) || (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1));
  return js[0] || null;
}

/*
 * Poser une mutation sur un joueur : ses facteurs se multiplient, ses profils
 * s'additionnent. L'atelier (S78) pose en plus son geste : jouer partout,
 * monter d'un cran, effacer les malus, lustrer la carte (`extra.carte`, la
 * variante suivante, calculée par le contrôleur — js/rarete.js).
 */
export function appliquerMutation(team, p, cle, jour, source, extra = null) {
  const M = MUTATIONS[cle];
  if (!M || !p) return;
  if (M.partout) p._partout = true;
  if (M.cran) p._cran = (p._cran || 0) + M.cran;
  if (M.enBas) p._enBas = true;
  if (M.ombre) p._ombre = Math.min(p._ombre || 1, M.ombre);
  if (M.abri) p._abri = Math.max(p._abri || 0, M.abri);
  if (M.lustre && extra && extra.carte && extra.carte.rar) p._carte = { ...extra.carte, recrue: !!(p._carte && p._carte.recrue) };
  if (M.physio) {
    for (const c of CANAUX_MUT) if (p._mut && p._mut[c] && estMalus(c, p._mut[c])) p._mut[c] = 1;
    for (const k of Object.keys(p._mutProfils || {})) if (p._mutProfils[k] < 0) p._mutProfils[k] = 0;
    if (p._mutCles) p._mutCles = p._mutCles.filter(k => !malusSeul(k));
  }
  p._mut = p._mut || {};
  // S80 : une AMÉLIORATION grandit avec la saison (`echelleTardive`) ; elle vit à part, et `mutDe` la fait grandir.
  const grandit = M.source === 'amelioration';
  if (grandit) p._amel = p._amel || {};
  for (const c of CANAUX_MUT) if (M[c]) { if (grandit) p._amel[c] = (p._amel[c] || 1) * M[c]; else p._mut[c] = (p._mut[c] || 1) * M[c]; }
  p._mutProfils = p._mutProfils || {};
  for (const [k, d] of Object.entries(M.profils || {})) p._mutProfils[k] = (p._mutProfils[k] || 0) + d;
  (p._mutCles = p._mutCles || []).push(cle);
  (team.mutations = team.mutations || []).push({ jour, cle, joueur: getPlayerKey(p), p, source });
}

/* Les accidents : cinq fenêtres, une chance sur deux par club, tirés de la graine. */
const JOURS_ACCIDENTS = [7, 22, 37, 55, 74];
const CHANCE_ACCIDENT = 0.5;
function poserAccident(team, graine, jour, equipe, tirage = jour) {
  if (!JOURS_ACCIDENTS.includes(tirage)) return;
  const rnd = melangeurSitu(graine, tirage + 5000, equipe);
  if (rnd() >= CHANCE_ACCIDENT) return;
  const js = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => team.roster[s.i]).filter(p => p && p.p !== 'G')
    .sort((a, b) => (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1));
  const cles = Object.keys(MUTATIONS).filter(k => MUTATIONS[k].source === 'accident');
  if (!js.length || !cles.length) return;
  const p = js[Math.floor(rnd() * js.length)];
  appliquerMutation(team, p, cles[Math.floor(rnd() * cles.length)], jour, 'accident');
}

/* Ce qu'une mutation fait, en mots : ce que la carte et le choix affichent. */
export function motsDeMutation(cle) {
  const M = MUTATIONS[cle];
  if (!M) return [];
  // En chiffres, comme les effets (S76).
  const pct = (x, mot, bon) => ({ txt: `${mot} ${flechesDe(x)}`, bon: bon ? x > 1 : x < 1 });
  const out = [];
  if (M.finition) out.push(pct(M.finition, 'Précision', true));
  if (M.lancers) out.push(pct(M.lancers, 'Tirs', true));
  if (M.creation) out.push(pct(M.creation, 'Création', true));
  if (M.defense) out.push({ txt: `Buts contre quand il est là ${flechesDe(M.defense)}`, bon: M.defense < 1 });
  if (M.blessure) out.push({ txt: `Blessures ${flechesDe(M.blessure)}`, bon: M.blessure < 1 });
  if (M.arrets) out.push({ txt: `Buts accordés ${flechesDe(M.arrets)}`, bon: M.arrets < 1 });
  if (M.partout) out.push({ txt: 'Pénalité hors position : aucune', bon: true });
  if (M.cran) out.push({ txt: `Trios possibles : +${M.cran} vers le haut`, bon: true });
  if (M.enBas) out.push({ txt: '4e trio et 3e paire : pénalité de zone 0', bon: true });
  if (M.ombre) out.push({ txt: `Leur meilleur joueur : précision ${flechesDe(M.ombre)}`, bon: true });
  if (M.abri) out.push({ txt: `Il ignore ${Math.round(M.abri * 100)} % de leur étouffement`, bon: true });
  if (M.physio) out.push({ txt: 'Ses malus de carte : effacés', bon: true });
  if (M.lustre) out.push({ txt: 'Sa carte : une variante de plus', bon: true });
  // Ses rôles bougent : le SENS, jamais les points (un « Défensif +25 » ne dit rien). Le badge qu'il y gagne se lit dans `badgesDeMutation`.
  for (const [k, d] of Object.entries(M.profils || {})) {
    const P = PROFILS.F[k] || PROFILS.D[k];
    if (P) out.push({ txt: `${d > 0 ? 'Plus' : 'Moins'} ${P.ico} ${P.nom.toLowerCase()}`, bon: d > 0, cle: 'role' });
  }
  // LES DEUX COURBES (S80, `echelleTardive`) : l'amélioration grandit ; le style et l'atelier font fitter un trio, tout de suite.
  const courbe = M.source === 'amelioration' ? motCourbe() : null;
  if (courbe) out.push(courbe);
  else if (M.source !== 'amelioration' && (M.source === 'style' || M.partout || M.cran || M.enBas)) out.push({ txt: '🔗 Carte de trio : tout de suite, puis elle plafonne', bon: null });
  return out;
}

/*
 * CE QU'UNE MODIF FAIT À SES BADGES : ses badges avant et après, ses rôles déplacés le temps de la lecture. Pur :
 * le joueur est rendu tel quel. `[]` si la modif ne touche aucun rôle, ou si le joueur n'en a pas (un gardien).
 */
export function badgesDeMutation(p, cle, { deja = false } = {}) {
  const M = MUTATIONS[cle];
  if (!p || p.p === 'G' || !M || !M.profils) return [];
  const avait = '_mutProfils' in p, sauve = p._mutProfils;
  // Déjà posée (`deja`) : ses badges d'aujourd'hui contre les mêmes sans elle.
  const deplace = sens => { p._mutProfils = { ...(sauve || {}) }; for (const [k, d] of Object.entries(M.profils)) p._mutProfils[k] = (p._mutProfils[k] || 0) + sens * d; return badgesDe(p); };
  const ici = badgesDe(p), ailleurs = deplace(deja ? -1 : 1);
  if (avait) p._mutProfils = sauve; else delete p._mutProfils;
  const avant = deja ? ailleurs : ici, apres = deja ? ici : ailleurs;
  const nom = b => `${b.ico} ${b.nom} ${PALIERS[b.palier].nom}`;
  const out = [];
  for (const b of apres) {
    const a = avant.find(x => x.cle === b.cle);
    if (!a) out.push({ txt: `Devient ${nom(b)}`, bon: true, cle: 'badge' });
    else if (a.palier !== b.palier) out.push({ txt: `${b.ico} ${b.nom} : ${PALIERS[a.palier].nom} → ${PALIERS[b.palier].nom}`, bon: b.palier > a.palier, cle: 'badge' });
  }
  for (const a of avant) if (!apres.some(b => b.cle === a.cle)) out.push({ txt: `Perd ${nom(a)}`, bon: false, cle: 'badge' });
  return out.length ? out : [{ txt: 'Ses badges ne changent pas', bon: null, cle: 'badge' }];
}

/*
 * CE QU'UN EFFET FAIT, EN MOTS (S68). JP : *c'est pas clair l'impact des
 * trucs*. Toutes les options — dilemmes, séquences, cartes, factions,
 * importance du match, tactiques — passent par ici : un seul endroit qui dit
 * « Finition +8 % », « Buts alloués −6 % », « 1er trio +25 % de glace »,
 * pour que l'écran ne recopie jamais un chiffre qui finirait par mentir.
 * Chaque mot dit s'il AIDE (`bon`) ; l'écran le colore.
 */
/*
 * LES EFFETS SE LISENT EN CHIFFRES (S76). JP : *faudrait des maths plus
 * claires sur les effets, comme dans un vrai deckbuilder* — et *j'aime les
 * mécaniques, mais c'est pas très compréhensible pour le joueur*. Les flèches
 * de S71 (↑, ↑↑, ↑↑↑) disaient « un peu, net, beaucoup » et laissaient
 * deviner le reste : deux cartes à ↑ ne se comparaient pas. Un effet se lit
 * maintenant comme dans Slay the Spire, en nombre entier : « Tirs +6 % »,
 * « Buts contre −5 % ». Le nom est resté (`flechesDe`) pour ne pas toucher
 * tous ses appels ; `seuils` ne sert plus.
 */
function pctDe(x) {
  const d = (x - 1) * 100;
  if (Math.abs(d) < 0.5) return '±0 %';
  const n = Math.abs(d) < 1 ? Math.abs(d).toFixed(1).replace('.', ',') : String(Math.round(Math.abs(d)));
  return `${d > 0 ? '+' : '−'}${n} %`;
}
export function flechesDe(x, seuils = null) {
  void seuils;
  return pctDe(x);
}
export function motsDEffet(e, duree = null) {
  if (!e) return [];
  const out = [];
  const pct = x => flechesDe(x);
  if (e.volume && e.volume !== 1) out.push({ txt: `Tirs ${pct(e.volume)}`, bon: e.volume > 1 });
  if (e.finition && e.finition !== 1) out.push({ txt: `Précision ${pct(e.finition)}`, bon: e.finition > 1 });
  if (e.defense && e.defense !== 1) out.push({ txt: `Buts contre ${pct(e.defense)}`, bon: e.defense < 1 });
  if (e.discipline && e.discipline !== 1) out.push({ txt: `Punitions ${pct(e.discipline)}`, bon: e.discipline < 1 });
  if (e.blessure && e.blessure !== 1) out.push({ txt: `Blessures ${pct(e.blessure)}`, bon: e.blessure < 1 });
  if (e.energie && e.energie !== 1) out.push({ txt: `Usure des jambes ${pct(e.energie)}`, bon: e.energie < 1 });
  if (e.robustesse) out.push({ txt: `Robustesse ${e.robustesse > 0 ? '+' : '−'}${String(Math.abs(Math.round(e.robustesse * 10) / 10)).replace('.', ',')}`, bon: e.robustesse > 0 });
  const rangF = ['1er trio', '2e trio', '3e trio', '4e trio'], rangD = ['1re paire', '2e paire', '3e paire'];
  for (const [g, noms] of [['F', rangF], ['D', rangD]]) if (Array.isArray(e[g])) e[g].forEach((m, i) => {
    if (m !== 1) out.push({ txt: `${noms[i]} : glace ${flechesDe(m, [0.1, 0.25])}`, bon: null });
  });
  if (e.mutation && MUTATIONS[e.mutation]) out.push({ txt: `Change sa carte : ${MUTATIONS[e.mutation].ico} ${MUTATIONS[e.mutation].nom}`, bon: null });
  if (duree) out.push({ txt: `${duree} match${duree > 1 ? 's' : ''}`, bon: null, duree: true });
  return out;
}
/*
 * LES TOTAUX DU SOIR (1.0, C5). JP : *je comprends pas plusieurs mécaniques*.
 * Les cartes, les patrons, le roulement, les moments et la consigne du match se
 * MULTIPLIENT entre eux (`effetsDeSaison`), puis `profilMatch` les passe sous
 * ses bornes : la pression sous PRESSION_MAX, la finition sous FINITION_MAX,
 * l'indiscipline entre DISCIPLINE_MIN et DISCIPLINE_MAX. Ce que l'écran annonce
 * est donc ce que le moteur applique CE SOIR, rapporté au même alignement sans
 * aucun effet : borne(x × effets) / borne(x). Rien n'est recalculé à part — les
 * nombres viennent du profil du match lui-même (`check_totaux.mjs` le prouve).
 * Les systèmes et l'agressivité jouent ligne par ligne : ils vivent dans les
 * lignes, pas dans ce total.
 *
 * `aVenir` : les décisions de CE jour pas encore jouées (la consigne qu'on vient
 * de choisir, une carte prise ce matin). Le moteur ne les applique qu'en jouant
 * la journée ; ce qu'elles ont de PUR (cartes, patrons, effets, roulement,
 * lignes) est posé le temps du calcul, puis l'équipe est remise telle quelle.
 */
export function totauxDuSoir(team, lineup = null, adv = null, aVenir = []) {
  if (!team) return null;
  return avecAVenir(team, aVenir, () => totauxBruts(team, lineup, adv));
}
/*
 * CE QU'UNE DÉCISION À VENIR A DE PUR, POSÉ SUR L'ÉQUIPE : ses cartes, patrons, coachs, effets, roulement,
 * lignes — et, avec `cases`, l'alignement (sur une copie des cases : `appliquerAlignement` les refait en
 * place). Chaque champ est REMPLACÉ, jamais modifié : la valeur d'avant reste intacte, ce qui permet de
 * la remettre (`avecAVenir`) ou de poser sur la copie d'un club (js/pronostic.js, `jambesAVenir`).
 */
export function poserAVenir(team, aVenir, { cases = false } = {}) {
  // En séries, le match qui vient lit `effetsSerie` (S69), pas les effets datés de la saison.
  const serie = team.jourCourant === Infinity;
  const ajouter = x => { if (serie) team.effetsSerie = [...(team.effetsSerie || []), x]; else team.effets = [...(team.effets || []), x]; };
  for (const d of aVenir || []) {
    if (d.carte && CARTES[d.carte]) team.cartes = [...(team.cartes || []), d.carte];
    if ('roulement' in d && ROULEMENTS[d.roulement]) team.roulement = d.roulement;
    if (Array.isArray(d.lignes)) team.lignes = d.lignes.map(l => ({ ...l }));
    const eff = serie ? (d.match ? effetDeMoment({ match: d.match, jour: 0 }) : null) : effetDeMoment(d, team);
    if (eff) ajouter(eff);
    if (d.effet && !serie) {
      const { duree, nom, ico, ...canaux } = d.effet;
      ajouter({ debut: d.jour, fin: apresMatchs(team, d.jour, duree || DUREE_MOMENT), nom, ico, ...canaux });
    }
    if (serie && d.ajustement && AJUSTEMENTS[d.ajustement]) {
      const { ico, nom, bon, prix, si, gardienAux, pari, ...canaux } = AJUSTEMENTS[d.ajustement];
      void bon; void prix; void si; void gardienAux; void pari;
      ajouter({ source: 'ajustement', nom, ico, ...canaux });
    }
    if (d.patron && d.patron.cle) {
      const rempl = new Set([d.patron.cle, ...(d.patron.remplace || [])]);
      const { remplace: _r, ...pat } = d.patron; void _r;
      team.patrons = [...(team.patrons || []).filter(x => !rempl.has(x.cle) && !(d.patron.role && x.role === d.patron.role)), pat];
    }
    if (d.coach && d.coach.cle) team.coachs = [...(team.coachs || []).filter(x => x.cle !== d.coach.cle), { ...d.coach }];
    if (cases && d.cases) { team.roster = { ...team.roster }; appliquerAlignement(team, { cases: d.cases }); }
  }
}
function avecAVenir(team, aVenir, fn, { cases = false } = {}) {
  const champs = ['cartes', 'patrons', 'coachs', 'effets', 'effetsSerie', 'roulement', 'lignes', ...(cases ? ['roster'] : [])];
  const avant = champs.map(k => [k, k in team, team[k]]);
  try {
    poserAVenir(team, aVenir, { cases });
    return fn();
  } finally {
    for (const [k, avait, v] of avant) { if (avait) team[k] = v; else delete team[k]; }
  }
}
/*
 * L'USURE DES JAMBES CE SOIR (1.0, le suivi des jambes) : ce que les présences du match coûteront à
 * chacun (`coutsDuSoir`, la formule de `depenserEnergie`), la réserve déduite, avec les décisions du
 * soir pas encore jouées — les lignes et la consigne qu'on règle dans « Préparer le match ». Les coups
 * reçus s'y ajoutent en jouant ; ils ne se prévoient pas.
 */
export function usureDuSoir(team, aVenir = []) {
  return avecAVenir(team, aVenir, () => {
    const out = {}, reserve = new Map();
    for (const [p, c] of coutsDuSoir(team, activeLineup(team))) {
      const r = Math.min(reserve.has(p) ? reserve.get(p) : (p._reserve || 0), c);
      reserve.set(p, (reserve.has(p) ? reserve.get(p) : (p._reserve || 0)) - r);
      out[getPlayerKey(p)] = (out[getPlayerKey(p)] || 0) + c - r;
    }
    return out;
  }, { cases: true });
}
function totauxBruts(team, lineup, adv) {
  const lu = lineup || activeLineup(team);
  const P = profilMatch(team, lu, adv);
  const c = P.cartes;
  const pMax = REF.pression * PRESSION_MAX;
  const fMax = FINITION_MAX / P.finEquipe;
  const dSans = borne(P.disciplineBase, DISCIPLINE_MIN, DISCIPLINE_MAX);
  return {
    volume: P.pression / borne(P.pressionBrute, 0.40, pMax),
    finition: P.finitionFacteur / Math.min(fMax, 1),
    defense: c.defense,
    discipline: P.patineurs.length ? P.discipline / dSans : c.discipline,
    brut: { volume: c.volume, finition: c.finition, defense: c.defense, discipline: c.discipline },
  };
}
/* Les mots des totaux : les quatre canaux, dans l'ordre, arrondis au pour cent (0 % se tait). */
export function motsDesTotaux(t) {
  if (!t) return [];
  const e = {};
  for (const k of ['volume', 'finition', 'defense', 'discipline']) if (Math.round((t[k] - 1) * 100) !== 0) e[k] = t[k];
  return motsDEffet(e);
}

/* La durée d'une option de dilemme ou de séquence, en journées. */
export const dureeOption = (o, famille) => (o && o.duree) || (famille === 'sequence' ? DUREE_SEQUENCE : DUREE_MOMENT);

/* =====================================================================
   LES SÉRIES, LES COMBATS DE BOSS (S69)

   JP : *oui pour changer pendant les séries, c'est encore plus important* ;
   *la saison, c'est le build check de base, les séries les boss run*.

   UNE RONDE SE JOUE MATCH PAR MATCH, TOUTES SÉRIES ENSEMBLE — le match 1 de
   chaque série, puis le match 2, etc. — exactement dans l'ordre où l'écran
   les révèle. C'est ce qui rend une décision possible ENTRE deux matchs :
   jouées série par série, une décision avant ton match 3 aurait relancé les
   dés des séries jouées après la tienne, matchs déjà révélés compris.

   `avant(k)` est appelé avant le k-ième match de la ronde (0-based) : c'est
   là que le contrôleur applique les décisions de séries (trios, lignes,
   consigne du match) et tire des dés neufs pour la suite.
   ===================================================================== */
export function playRonde(paires, ronde = 0, avant = null, graine = 0) {
  const series = paires.map(([A, B]) => ({ A, B, wA: 0, wB: 0, feuilles: [], plans: [] }));
  for (let k = 0; k < 7; k++) {
    if (avant) avant(k);
    for (const s of series) {
      if (s.wA === 4 || s.wB === 4) continue;
      const feuille = feuilleVierge();
      // TA SÉRIE (S70) : chaque match est mis en scène, et l'adversaire garde
      // le plan qui a gagné ou en change après une défaite.
      const toi = s.A.isPlayer ? s.A : s.B.isPlayer ? s.B : null;
      let gros = null;
      if (toi) {
        const adv = toi === s.A ? s.B : s.A, prec = s.plans[s.plans.length - 1] || null;
        const depistage = depistageDe(graine, `po${ronde}:${k}`, adv, { precedent: prec && prec.plan, ilsOntGagne: prec ? !prec.gagne : false });
        gros = { serie: true, raison: 'serie', adv, depistage, plan: planDuDepistage(graine, `po${ronde}:${k}`, depistage),
          prep: toi._mainSerie ? toi._mainSerie.prep || null : null, effetsAvant: [],
          cartes: toi._mainSerie ? toi._mainSerie.main : null, cleCartes: toi._mainSerie ? toi._mainSerie.cle : '',
          graineMain: graine, cleMain: `po${ronde}:${k}`, ronde };
        toi._mainSerie = null;
        const entracte = toi._entracte;
        poserGros(toi, adv, gros);
        toi._entracte = entracte;
      }
      const r = playGame(s.A, s.B, k, true, true, feuille, ronde);
      if (gros) {
        s.plans.push({ plan: gros.plan, contre: gros.contre, depistage: gros.depistage, preparation: gros.preparation || [], prepJuste: gros.prepJuste ?? null, gagne: r.winner === toi, entracte: gros.entracte || null, apres40: gros.apres40 || null, cartes: gros.cartesJouees || null });
        if (gros.cartesJouees) feuille.cartes = gros.cartesJouees;
        leverGros(toi);
        toi._gardienAuxMatch = false;
      }
      if (toi) toi._filetMatch = null;
      if (r.winner === s.A) s.wA++; else s.wB++;
      feuille.numero = k + 1;
      feuille.serie = `${s.wA}-${s.wB}`;
      s.feuilles.push(feuille);
    }
    if (series.every(s => s.wA === 4 || s.wB === 4)) break;
  }
  for (const s of series) s.winner = s.wA === 4 ? s.A : s.B;
  for (const s of series) for (const t of [s.A, s.B]) t.effetsSerie = [];
  return series;
}

/*
 * LES SÉRIES SE JOUENT MATCH PAR MATCH (S79). Comme la saison : rien d'avance.
 * Le moteur des séries (`creerSeries`) ne joue un match qu'au moment où
 * l'écran veut le montrer (`jouerMatchSeries` : le match k de chaque série
 * encore ouverte de la ronde, ensemble, comme avant) ; la ronde suivante
 * naît quand la dernière série de la ronde est décidée.
 *
 *   S.toutes      les séries nées jusqu'ici, dans l'ordre (leur `i` est leur
 *                 rang, comme dans l'ancien `G.series`) ; chacune
 *                 { A, B, wA, wB, feuilles, plans, ronde, i, winner? }
 *   S.courante    les séries de la ronde en cours
 *   S.ronde, S.k  la ronde en cours et le prochain match à y jouer
 *   S.fini        le champion est connu (`S.champion`)
 *
 * TA SÉRIE A SON PROCHAIN PLAN D'AVANCE, sans que rien soit joué : le plan
 * de l'adversaire et le rapport du dépisteur ne dépendent que de la graine,
 * de la ronde, du match et du plan d'hier (`planDuMatchDeSerie`) ; le moteur le pose
 * en `s.plans[k]` dès que le match d'avant est joué, et le complète en le
 * jouant.
 *
 * LES STATISTIQUES DES SÉRIES À PART, match après match (`cumulerSeries`) :
 * les compteurs de saison ne bougent jamais pendant les séries, et `p.po`,
 * `t.po` cumulent les séries. C'était `separerSeries`, une fois à la fin —
 * mais il n'y a plus de « fin » connue d'avance.
 *
 * Le hasard est celui de la ligue (`S.ligue`) : les séries continuent la
 * même suite que la saison, comme avant. Sans ligue (un script), un
 * générateur à part.
 */
export function creerSeries(qualifies, { ligue = null, graine = 0, decisions = [], equipes = qualifies, des = null } = {}) {
  const S = {
    graine, decisions, ligue, equipes,
    // Les dés de chaque soir de séries, par « ronde:match » (voir `deDuJour`).
    des,
    rng: ligue ? null : generateur(`${graine}:series`),
    nRondes: Math.max(1, Math.round(Math.log2(qualifies.length))),
    ronde: 0, k: 0, courante: [], toutes: [], fini: false, champion: null,
    toi: qualifies.find(t => t.isPlayer) || null,
  };
  for (const t of equipes) {
    t.po = Object.fromEntries(CHAMPS_EQUIPE.map(k => [k, 0]));
    t.poJournal = []; t.poBlessures = [];
    for (const s of SLOTS) { const p = t.roster[s.i]; if (p) p.po = {}; }
  }
  ouvrirRondeSeries(S, qualifies);
  return S;
}
function ouvrirRondeSeries(S, equipes) {
  S.courante = [];
  for (let i = 0; i < equipes.length / 2; i++) {
    const s = { A: equipes[i], B: equipes[equipes.length - 1 - i], wA: 0, wB: 0, feuilles: [], plans: [], ronde: S.ronde, i: S.toutes.length };
    S.courante.push(s);
    S.toutes.push(s);
  }
  S.k = 0;
  poserPlansDeSeries(S);
}
/* Le plan de l'adversaire pour le match k de ta série : pur, de la graine et du plan d'hier. */
function planDuMatchDeSerie(S, s, k) {
  const toi = s.A.isPlayer ? s.A : s.B.isPlayer ? s.B : null;
  if (!toi) return null;
  const adv = toi === s.A ? s.B : s.A, prec = s.plans[k - 1] || null;
  const cle = `po${s.ronde}:${k}`;
  const depistage = depistageDe(S.graine, cle, adv, { precedent: prec && prec.plan, ilsOntGagne: prec ? !prec.gagne : false });
  return { toi, adv, cle, depistage, plan: planDuDepistage(S.graine, cle, depistage) };
}
/* Le prochain plan de ta série, posé d'avance (`aVenir`) : l'écran prépare le match avec. */
function poserPlansDeSeries(S) {
  for (const s of S.courante) {
    if (s.wA === 4 || s.wB === 4) continue;
    const pl = planDuMatchDeSerie(S, s, s.feuilles.length);
    if (pl) s.plans[s.feuilles.length] = { plan: pl.plan, depistage: pl.depistage, aVenir: true };
  }
}
/* Les compteurs d'un match de séries passent aux statistiques des séries ; la saison ne bouge pas. */
function cumulerSeries(teams, photo) {
  for (const t of teams) {
    const e = photo.get(t);
    if (!e) continue;
    t.po = t.po || Object.fromEntries(CHAMPS_EQUIPE.map(k => [k, 0]));
    for (const k of CHAMPS_EQUIPE) t.po[k] = (t.po[k] || 0) + ((t[k] || 0) - (e[k] || 0));
    t.poJournal = [...(t.poJournal || []), ...(t.journal ? t.journal.slice(e.journal) : [])];
    t.poBlessures = [...(t.poBlessures || []), ...(t.injuriesLog ? t.injuriesLog.slice(e.blessures) : [])];
    if (t.journal) t.journal.length = e.journal;
    if (t.injuriesLog) t.injuriesLog.length = e.blessures;
    for (const k of CHAMPS_EQUIPE) t[k] = e[k];
    for (const s of SLOTS) {
      const p = t.roster[s.i];
      const q = p && photo.get(p);
      if (!q) continue;
      p.po = p.po || {};
      for (const k of CHAMPS_SIM) {
        if (p[k] === undefined && q[k] === undefined) continue;
        const cle = k.slice(3);
        p.po[cle] = (p.po[cle] || 0) + ((p[k] || 0) - (q[k] || 0));
        p[k] = q[k];
      }
    }
  }
}
/* UN MATCH DE SÉRIES : le match k de chaque série encore ouverte de la ronde. */
export function jouerMatchSeries(S) {
  if (S.fini) return;
  const jouer = () => {
    const r = S.ronde, k = S.k;
    const photo = photoStats(S.equipes);
    // LES DÉS DU SOIR (1.0, oct.) : un dé par soir, gardé pour la reprise.
    // S90 : chaque série obtient sa propre graine dérivée de `s.i` — l'ordre dans
    // `S.courante` n'influe plus sur les résultats (réparation reprise de séries).
    const seedSoir = S.des
      ? (S.des[`${r}:${k}`] || (S.des[`${r}:${k}`] = nouvelleGraine()))
      : null;
    const toiSeries = S.toi
      ? S.courante.find(s => s.wA < 4 && s.wB < 4 && (s.A === S.toi || s.B === S.toi))
      : null;
    if (S.toi) {
      S.toi.effetsSerie = [];
      // Devant le filet (C4) : le choix vaut pour UN match ; le suivant repart de la rotation.
      S.toi._filetMatch = null;
      if (seedSoir) grainerHasard(`${S.graine}:po:${r}:${k}:${toiSeries ? toiSeries.i : 0}:${seedSoir}`);
      for (const d of S.decisions) if (d.ronde === r && d.match_no === k) appliquerDecisionSerie(S.toi, d, S.graine);
    }
    for (const s of S.courante) {
      if (s.wA === 4 || s.wB === 4) continue;
      if (seedSoir && s !== toiSeries) grainerHasard(`${S.graine}:po:${r}:${k}:${s.i}:${seedSoir}`);
      const feuille = feuilleVierge();
      // TA SÉRIE (S70) : chaque match est mis en scène, et l'adversaire garde
      // le plan qui a gagné ou en change après une défaite.
      const pl = planDuMatchDeSerie(S, s, k);
      let gros = null;
      if (pl) {
        const toi = pl.toi;
        gros = { serie: true, raison: 'serie', adv: pl.adv, depistage: pl.depistage, plan: pl.plan,
          prep: toi._mainSerie ? toi._mainSerie.prep || null : null, effetsAvant: [],
          cartes: toi._mainSerie ? toi._mainSerie.main : null, cleCartes: toi._mainSerie ? toi._mainSerie.cle : '',
          graineMain: S.graine, cleMain: pl.cle, ronde: r };
        toi._mainSerie = null;
        const entracte = toi._entracte;
        poserGros(toi, pl.adv, gros);
        toi._entracte = entracte;
      }
      const res = playGame(s.A, s.B, k, true, true, feuille, r);
      if (gros) {
        const toi = pl.toi;
        s.plans[k] = { plan: gros.plan, contre: gros.contre, depistage: gros.depistage, preparation: gros.preparation || [], prepJuste: gros.prepJuste ?? null, gagne: res.winner === toi, entracte: gros.entracte || null, apres40: gros.apres40 || null, cartes: gros.cartesJouees || null };
        if (gros.cartesJouees) feuille.cartes = gros.cartesJouees;
        leverGros(toi);
        toi._gardienAuxMatch = false;
      }
      if (res.winner === s.A) s.wA++; else s.wB++;
      // Décidée au quatrième gain, pas à la fin de la ronde : ta série gagnée
      // en quatre ne demande pas de cinquième match pendant que les autres jouent.
      if (s.wA === 4 || s.wB === 4) s.winner = s.wA === 4 ? s.A : s.B;
      feuille.numero = k + 1;
      feuille.serie = `${s.wA}-${s.wB}`;
      s.feuilles.push(feuille);
    }
    cumulerSeries(S.equipes, photo);
    S.k = k + 1;
    if (S.courante.every(s => s.wA === 4 || s.wB === 4)) {
      for (const s of S.courante) s.winner = s.wA === 4 ? s.A : s.B;
      for (const s of S.courante) for (const t of [s.A, s.B]) t.effetsSerie = [];
      const gagnants = S.courante.map(s => s.winner);
      if (gagnants.length === 1) { S.fini = true; S.champion = gagnants[0]; S.courante = []; }
      else { S.ronde = r + 1; ouvrirRondeSeries(S, gagnants); }
    } else poserPlansDeSeries(S);
  };
  if (S.ligue) avecLigue(S.ligue, jouer);
  else { const avant = hasard; hasard = S.rng; try { jouer(); } finally { S.rng = hasard; hasard = avant; } }
}
/* Rejouer une reprise : jusqu'à ce que chaque série ait les matchs qu'on en avait vus. */
export function jouerSeriesVues(S, revele = []) {
  for (let garde = 0; !S.fini && garde < 64; garde++) {
    if (!S.toutes.some(s => (revele[s.i] || 0) > s.feuilles.length)) break;
    jouerMatchSeries(S);
  }
  return S;
}

/*
 * UNE DÉCISION DE SÉRIES : les trios, les lignes, la fermeture, une mutation
 * — comme en saison — plus la CONSIGNE du match qui vient (son importance),
 * qui ne vaut que pour ce match-là. Et son sel : la suite se joue sur des dés
 * neufs, les matchs d'avant ne bougent pas.
 */
export function appliquerDecisionSerie(team, d, graine) {
  appliquerDecision(team, d, graine);
  // Les effets du match qui vient s'AJOUTENT : une consigne, un ajustement
  // et des lignes peuvent être pris avant le même round.
  team.effetsSerie = team.effetsSerie || [];
  if (d.match) team.effetsSerie.push(effetDeMoment({ match: d.match, jour: 0 }));
  if (d.filet) team._filetMatch = d.filet === 'auto' ? null : d.filet;
  if (d.ajustement && AJUSTEMENTS[d.ajustement]) {
    const { ico, nom, bon, prix, si, gardienAux, pari, ...canaux } = AJUSTEMENTS[d.ajustement];
    void bon; void prix; void si;
    team.effetsSerie.push({ source: 'ajustement', nom, ico, ...canaux });
    if (gardienAux) team._gardienAuxMatch = true;
    if (pari) {
      const gagne = hacherMise(graine, 'pari-serie', d.ronde, d.match_no, d.sel || '') < pari.chance;
      team.effetsSerie.push({ source: 'pari', nom, ico, ...(gagne ? pari.gagne : pari.perd) });
      (team.paris = team.paris || []).push({ ronde: d.ronde, match_no: d.match_no, titre: nom, gagne });
    }
  }
  // LA MAIN DU MATCH (S74) : posée avec le gros match, juste avant la mise au jeu.
  if (d.main) team._mainSerie = { main: d.main, prep: d.prep || null, cle: `${graine}:po:${d.ronde}:${d.match_no}:${d.sel || ''}` };
  // LE CHOIX DE L'ENTRACTE (S70) : ses dés neufs se tirent à 40:00, pas avant le match.
  if (d.entracte) { team._entracte = { ...d.entracte, graine: `${graine}:po:${d.ronde}:${d.match_no}:entracte:${d.sel || ''}` }; return; }
  if (d.sel) grainerHasard(`${graine}:po:${d.ronde}:${d.match_no}:${d.sel}`);
}

/*
 * ENTRE DEUX ROUNDS (S69). Après chaque match d'une série qui n'est pas finie,
 * trois ajustements s'offrent — tirés de la graine, de la ronde et du match —
 * et on en prend un pour le round qui vient. Certains ne s'offrent que dans
 * une situation : « Rien à perdre » quand on tire de l'arrière, « Le
 * capitaine parle » quand on mène.
 */
export const AJUSTEMENTS = {
  vedette: { ico: '🎯', nom: 'Serrer leur vedette', bon: 'Une ombre sur leur meilleur joueur', prix: 'On attaque moins', defense: 0.93, volume: 0.97 },
  rythme: { ico: '🏃', nom: 'Imposer le rythme', bon: 'On tire de partout', prix: 'Les jambes vont brûler', volume: 1.07, energie: 1.2 },
  rien: { ico: '🎲', nom: 'Rien à perdre', bon: 'On lance tout vers le filet', prix: 'On se découvre', finition: 1.08, defense: 1.07, si: 'derriere' },
  gardien: { ico: '🧤', nom: 'Le gardien en mission', bon: 'Il a revu tous leurs buts', prix: 'On joue petit devant', defense: 0.95, finition: 0.98 },
  repos: { ico: '📼', nom: 'Vidéo et repos', bon: 'Des jambes neuves', prix: 'Moins de mordant', energie: 0.6, volume: 0.98 },
  corps: { ico: '🥊', nom: 'Leur rentrer dedans', bon: 'On les use à la mise en échec', prix: 'L\'arbitre regarde', robustesse: 1.5, discipline: 1.25 },
  discipline: { ico: '🧘', nom: 'Rester discipliné', bon: 'Aucune punition bête', prix: 'Un peu moins d\'engagement', discipline: 0.75, volume: 0.98 },
  capitaine: { ico: '🧭', nom: 'Le capitaine parle', bon: 'On ferme la porte', prix: 'On se repose sur l\'avance', defense: 0.95, finition: 0.98, si: 'devant' },
  auxiliaire: { ico: '🔄', nom: 'Donner le filet à l\'auxiliaire', bon: 'Ton partant souffle un match', prix: 'Ton auxiliaire en séries', gardienAux: true, si: 'devant' },
  coup: { ico: '🎲', nom: 'Un coup de dés', bon: 'Une chance sur deux : une soirée où tout rentre', prix: 'Sinon, une soirée où rien ne tient',
    pari: { chance: 0.5, gagne: { finition: 1.1 }, perd: { defense: 1.08 } } },
  avantage: { ico: '⚡', nom: 'Travailler l\'avantage numérique', bon: 'Les unités spéciales affûtées', prix: 'Moins de temps à cinq contre cinq', finition: 1.04, volume: 0.98 },
};
/* Les trois ajustements offerts avant le k-ième match (0-based) : PURS. `etat` : 'devant', 'derriere' ou 'egal'. */
export function ajustementsOfferts(graine, ronde, k, etat) {
  const cles = Object.keys(AJUSTEMENTS).filter(c => !AJUSTEMENTS[c].si || AJUSTEMENTS[c].si === etat);
  let x = ((Number(graine) >>> 0) ^ Math.imul(ronde + 11, 0x9e3779b1) ^ Math.imul(k + 3, 0x85ebca6b)) >>> 0;
  const suivant = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
  const reste = cles.slice(), main = [];
  while (main.length < 3 && reste.length) main.push(reste.splice(Math.floor(suivant() * reste.length), 1)[0]);
  return main;
}

/* =====================================================================
   LES MINI-BOSS DE LA SAISON (S69). JP : *la saison, c'est les mobs, avec
   mini boss quand rivalité ou équipe avec qui on se bat au classement*.

   Un match est un MINI-BOSS quand l'adversaire est un RIVAL au classement
   (à deux rangs ou moins de toi, à partir de la 10e journée) ou ta NÉMÉSIS
   (un club qui t'a déjà battu deux fois cette saison). Le battre donne
   l'ÉLAN — trois matchs de finition, et les partisans montent — ; perdre
   laisse SONNÉ — trois matchs de finition en moins, et les médias
   s'acharnent. Le moteur le décide lui-même, de ce qui s'est joué : c'est
   déterministe, et l'écran n'a qu'à relire `team.minisBoss`.
   ===================================================================== */

/* =====================================================================
   LES GROS MATCHS MIS EN SCÈNE (S70)

   JP : *les adversaires aussi ont des bonus, malus, stratégies et le jeu est
   de trouver comment contrer, surtout en séries. Sans faire que les matchs
   normaux sont pas importants ou changer la difficulté évidemment, on est
   juste plus granulaire et on présente plus spectaculaire les matchs
   importants, c'est plus de la mise en scène, avec des choix de mi-match
   lors de matchs importants, qui ne sont pas dans les matchs normaux.
   Plus d'événements pour les matchs spéciaux, avant et pendant.*

   Trois morceaux, et AUCUN ne touche un match ordinaire :

   1. LE PLAN DE L'ADVERSAIRE (`PLANS_ADV`). Depuis S72, un vrai réglage de ses
      lignes pour ce match — une tactique, une agressivité, de la glace —
      dans les mêmes menus que les tiens ; le moteur fait le reste. Le
      contrer, c'est jouer la tactique qui étouffe la sienne.
      En séries, l'adversaire CHANGE de plan après une défaite et garde celui
      qui a marché.
   2. AVANT LE MATCH (`AVANT_GROS`) : un événement, un choix, parfois un pari
      (gagné, perdu) sur les factions.
   3. LE DEUXIÈME ENTRACTE (`ENTRACTES`, `INCIDENTS`). Le gros match se joue
      en deux blocs — 40 minutes, puis 20 — et on décide entre les deux,
      pointage en main. Le moteur coupe le match à la même place avec ou sans
      décision, et ne relance les dés qu'À 40:00 : les deux premières
      périodes qu'on a vues ne bougent pas.
   ===================================================================== */

/* Un nombre pur tiré d'une chaîne : les tirages de la mise en scène ne consomment aucun hasard. */
function hacherMise(...parts) {
  let x = 2166136261;
  for (const ch of parts.join('|')) x = Math.imul(x ^ ch.charCodeAt(0), 16777619) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12;
  return (x >>> 0) / 0x100000000;
}

/* Deux gros matchs sont séparés d'au moins autant de journées. */
const ESPACEMENT_GROS = 4;

/*
 * LE PLAN DE L'ADVERSAIRE EST UN VRAI RÉGLAGE DE SES LIGNES (S72). JP : *tout
 * devrait être ensemble, pas plusieurs systèmes différents* ; *que toutes les
 * équipes ont les mêmes stratégies*. Le plan n'est plus un paquet de bonus :
 * pour CE match, l'adversaire règle ses lignes dans les mêmes menus que toi —
 * une tactique, une agressivité, de la glace — et le moteur fait le reste
 * (les tactiques, les actions spéciales, les contres, les punitions). Le
 * contre est celui du cercle des tactiques : la tactique qui étouffe la leur.
 */
export const PLANS_ADV = {
  trappe: { ico: '🪤', nom: 'La trappe', mot: 'Ils bouchent le centre et attendent ton erreur.', tac: 'defensive', lignes: { 0: { tac: 'defensive' }, 1: { tac: 'defensive' } } },
  rapide: { ico: '🚀', nom: 'Le jeu rapide', mot: 'Ils laissent venir et repartent dans ton dos.', tac: 'contre', lignes: { 0: { tac: 'contre' }, 1: { tac: 'contre' } } },
  echec: { ico: '🐺', nom: 'L\'échec avant à outrance', mot: 'Ils chassent la rondelle dans ta zone.', tac: 'echec', lignes: { 0: { tac: 'echec', agr: 2 }, 1: { tac: 'echec', agr: 2 } } },
  possession: { ico: '🔁', nom: 'La possession', mot: 'Ils gardent la rondelle et la font tourner.', tac: 'courtes', lignes: { 0: { tac: 'courtes' }, 1: { tac: 'courtes' } } },
  canons: { ico: '💣', nom: 'Les canons de la pointe', mot: 'Tout part de leurs défenseurs.', tac: 'bleue', lignes: { 0: { tac: 'bleue' }, 1: { tac: 'bleue' } } },
  matraquage: { ico: '🔨', nom: 'Le matraquage', mot: 'Ils vont frapper tout ce qui bouge.', lignes: { 0: { agr: 3 }, 1: { agr: 3 }, 2: { agr: 3 }, 3: { agr: 3 } },
    contre: { agrMax: 0, n: 2 }, pourquoi: 'ne pas répondre : leurs punitions deviennent tes avantages numériques' },
  vedette: { ico: '⭐', nom: 'Tout passe par leur premier trio', mot: 'Leur premier trio va jouer une éternité.', lignes: { 0: { sec: 85 }, 3: { sec: 40 } },
    contre: { ad: -1 }, pourquoi: 'la consigne Basse, qui penche défense, serre leur premier trio' },
};
/* Ce qui contre un plan : la tactique qui étouffe la leur, ou le réglage que le plan dit. */
const contreDuPlan = P => (P.contre ? P.contre : P.tac ? { tac: contreDe(P.tac), n: 2 } : null);
export function commentContrer(cle) {
  const P = PLANS_ADV[cle];
  const c = P && contreDuPlan(P);
  if (!c) return '';
  if (c.tac) return `${c.n} lignes en ${TACTIQUES[c.tac].ico} ${TACTIQUES[c.tac].nom} — leur système est étouffé, plus d'actions spéciales`;
  if (c.agrMax != null) return `${c.n} lignes en agressivité ${AGRESSIVITES[c.agrMax].nom.toLowerCase()} — ${P.pourquoi}`;
  return `la consigne ${IMPORTANCES.basse.ico} ${IMPORTANCES.basse.nom} (Préparer le match) — ${P.pourquoi}`;
}
/* Le plan est-il contré ? Des lignes `{ tac, agr }` × 4 et la consigne du match (`ad`, −2 à 2). */
export function planEstContre(cle, lignes, ad = 0) {
  const P = PLANS_ADV[cle];
  const c = P && contreDuPlan(P);
  if (!c) return false;
  const L = lignes || [];
  if (c.tac) return L.filter(l => l && l.tac === c.tac).length >= c.n;
  if (c.agrMax != null) return L.filter(l => l && (l.agr ?? 1) <= c.agrMax).length >= c.n;
  if (c.ad != null) return (Number(ad) || 0) <= c.ad;
  return false;
}
/* Ce que le plan règle, en mots : « lignes 1 et 2 en Défensive ». */
export function reglageDuPlan(cle) {
  const P = PLANS_ADV[cle];
  if (!P) return '';
  const us = Object.keys(P.lignes).map(Number);
  const noms = us.length === 4 ? 'toutes leurs lignes' : `leurs lignes ${us.map(u => u + 1).join(' et ')}`;
  const l = P.lignes[us[0]];
  if (l.tac) return `${noms} en ${TACTIQUES[l.tac].ico} ${TACTIQUES[l.tac].nom}${l.agr != null ? `, agressivité ${AGRESSIVITES[l.agr].nom.toLowerCase()}` : ''}`;
  if (l.agr != null) return `${noms} en agressivité ${AGRESSIVITES[l.agr].ico} ${AGRESSIVITES[l.agr].nom.toLowerCase()}`;
  if (l.sec != null) return `leur premier trio à ${l.sec} s par présence, le quatrième à peine`;
  return '';
}

/*
 * Le plan de l'adversaire au k-ième match d'une série : il GARDE celui qui a
 * gagné, et en CHANGE après une défaite — jamais pour le même.
 */
export function planDeSerie(graine, ronde, k, precedent = null, aPerdu = false) {
  const cles = Object.keys(PLANS_ADV);
  if (k > 0 && precedent && !aPerdu) return precedent;
  const choix = cles.filter(c => c !== precedent);
  return choix[Math.floor(hacherMise(graine, 'serie', ronde, k) * choix.length)];
}

/*
 * LE DÉPISTAGE (S76). JP : *contrer, ça devrait être un scouting de leur
 * stratégie potentielles avec taux de succès, qui fait que parfois, t'as chié
 * ta préparation*. On ne CONNAÎT plus leur plan : on en a un rapport — trois
 * pistes et leurs chances — et c'est de ce rapport que le moteur TIRE leur
 * plan. Le rapport ne ment donc jamais : « 55 % » veut dire qu'une fois sur
 * deux et quelque, c'est bien ça.
 *
 * Ce qui fait pencher le rapport, c'est ce que le dépisteur a VU : le système
 * que leurs lignes jouent toute la saison (`lignesDe` sans le plan du soir),
 * leur agressivité, et en séries ce qui a marché la veille — un plan gagnant
 * se garde souvent, un plan perdant presque jamais. Un peu de hasard de la
 * graine par-dessus : deux adversaires semblables n'ont pas le même rapport.
 * Aucune cote : des tactiques et des agressivités, comme le banc les montre.
 *
 * Les chances sont le CUBE des poids, ramenées au 5 % : un favori se lit
 * (60 / 25 / 15), sans jamais dépasser 90 % — il reste toujours une chance
 * de s'être trompé. Mesuré (scripts/mesure_prep.mjs) : le favori est leur
 * plan environ six fois sur dix, et chaque chance annoncée sort à sa valeur.
 */
export function depistageDe(graine, cle, adv, { precedent = null, ilsOntGagne = false } = {}) {
  const lignes = adv && adv.roster ? lignesDe(adv, adv.roster, { duSoir: false }) : [];
  const poids = Object.entries(PLANS_ADV).map(([k, P]) => {
    let w = 1 + 1.2 * hacherMise(graine, 'depistage', cle, k);
    if (P.tac) w += 1.6 * lignes.filter(l => l.tac === P.tac).length;
    if (k === 'matraquage') w += 0.8 * lignes.filter(l => (l.agr ?? 1) >= 2).length;
    if (precedent === k) w *= ilsOntGagne ? 3 : 0.15;
    return { plan: k, w };
  }).sort((a, b) => b.w - a.w || (a.plan < b.plan ? -1 : 1)).slice(0, 3);
  const tot = poids.reduce((a, x) => a + x.w ** 3, 0);
  const out = poids.map(x => ({ plan: x.plan, p: Math.min(90, Math.max(5, Math.round(20 * x.w ** 3 / tot) * 5)) }));
  out[0].p += 100 - out.reduce((a, x) => a + x.p, 0);
  return out;
}
/* Le plan le plus PROBABLE du rapport (J1-N) : ce que l'écran peut montrer sans révéler le vrai. */
export const planProbable = dep => (dep && dep.length ? dep.reduce((a, b) => (b.p > a.p ? b : a)).plan : null);
/* Leur VRAI plan, tiré du rapport : pur, de la graine et du match. */
export function planDuDepistage(graine, cle, dep) {
  let r = hacherMise(graine, 'plan-reel', cle) * 100;
  for (const x of dep) { r -= x.p; if (r < 0) return x.plan; }
  return dep[dep.length - 1].plan;
}
/*
 * TA PRÉPARATION (S76). Tu prépares ta formation pour UNE des pistes du
 * rapport (deux avec « Le plan B »). Juste : leur plan tombe — leurs lignes
 * reprennent leur réglage de la saison — et ta formation, qui l'attendait,
 * joue un cran au-dessus. Fausse : tu as répété le mauvais match, et ça se
 * paie (« t'as chié ta préparation »). Ne rien préparer ne coûte rien et ne
 * rapporte rien. Mesuré dans `check_combat`.
 */
export const PREP_JUSTE = { finition: 1.05, defense: 0.95 };
export const PREP_RATEE = { finition: 0.96, defense: 1.04 };

/* Ce que la consigne du match penche (`ad`), lu dans les effets actifs d'une équipe. */
function adDeLEquipe(team) {
  const m = effetsActifs(team).filter(e => e.source === 'match');
  return m.length ? (m[m.length - 1].ad || 0) : 0;
}

/*
 * AVANT LE MATCH. Des histoires vraies du hockey et quelques inventées. Une
 * option peut porter un PARI : ses factions ne bougent qu'au résultat.
 */
export const AVANT_GROS = {
  garantie: { ico: '🎤', titre: 'La garantie',
    irl: 'Mark Messier, 1994 : il garantit une victoire au 6e match contre les Devils, puis marque trois buts en troisième.',
    recit: 'Les journalistes entourent ton capitaine. Ils attendent une phrase pour la une.',
    options: [
      { cle: 'garantir', nom: 'Il garantit la victoire', bon: 'Le vestiaire y croit : gagné, la lancée dure deux fois plus', prix: 'Perdu, on reste sonnés deux fois plus', finition: 1.088, enjeu: true },
      { cle: 'humble', nom: 'Un match à la fois', bon: 'Personne ne s\'emballe', defense: 0.96 },
    ] },
  mots: { ico: '🗣️', titre: 'La guerre des mots',
    irl: 'Patrick Roy à Jeremy Roenick, 1996 : « Je ne l\'entends pas, j\'ai mes deux bagues de la Coupe dans les oreilles. »',
    recit: 'Leur entraîneur a dit en point de presse que ta formation « ne ferait pas les séries dans la Ligue américaine ».',
    options: [
      { cle: 'repliquer', nom: 'Répliquer au micro', bon: 'Les gars sont piqués au vif', prix: 'Ils vont jouer sur les nerfs', finition: 1.06, discipline: 1.213 },
      { cle: 'glace', nom: 'Laisser parler la glace', bon: 'Tête froide', discipline: 0.788 },
    ] },
  virus: { ico: '🦠', titre: 'Le virus dans le vestiaire', cible: 'trois',
    recit: '{noms} ont passé la nuit malades. Le soigneur dit qu\'ils peuvent jouer, « à peu près ». Aucun bon choix : lequel fait le moins mal ?',
    options: [
      { cle: 'jouer', nom: 'Ils jouent quand même', prix: '{noms} jouent épuisés', action: { energie: -35 } },
      { cle: 'rappel', nom: 'Les garder au lit, rappeler du club-école', prix: 'Des réservistes et des rappelés jouent à leur place ce soir', action: { absents: 1 } },
    ] },
  samedi: { ico: '📺', titre: 'Le match du samedi soir',
    recit: 'Le pays au complet regarde. Le réseau veut du spectacle.',
    options: [
      { cle: 'show', nom: 'Donner le show', bon: 'Du spectacle pour la télé', prix: 'On se découvre', volume: 1.088, defense: 1.08 },
      { cle: 'propre', nom: 'Jouer ton hockey', bon: 'Le plan de match, rien d\'autre', defense: 0.96 },
    ] },
  gloria: { ico: '🎶', titre: 'La chanson du vestiaire',
    irl: 'Les Blues de 2019 adoptent « Gloria » dans un bar de Philadelphie, alors derniers de la ligue ; ils gagnent la Coupe.',
    recit: 'Quelques joueurs ont trouvé une vieille chanson dans un bar la veille. Ils veulent la faire jouer après chaque victoire.',
    options: [
      { cle: 'chanson', nom: 'Adopter la chanson', bon: 'Une victoire ce soir lancerait une vraie séquence', prix: 'Une défaite, et elle devient une blague', enjeu: true },
      { cle: 'couvre', nom: 'Couvre-feu à 22 h', bon: 'Tout le monde est reposé', energie: 0.76 },
    ] },
  pieuvre: { ico: '🐙', titre: 'La pieuvre sur la glace',
    irl: 'Détroit, 1952 : les frères Cusimano lancent une pieuvre sur la glace — huit tentacules, huit victoires pour la Coupe.',
    recit: 'Les partisans ont prévu quelque chose. Deux façons d\'en profiter.',
    options: [
      { cle: 'foule', nom: 'Laisser la foule s\'exprimer', bon: 'L\'amphithéâtre pousse', finition: 1.06 },
      { cle: 'calme', nom: 'Garder la tête froide', bon: 'Une équipe disciplinée', discipline: 0.825 },
    ] },
  rat: { ico: '🐀', titre: 'Le rat du vestiaire',
    irl: 'Floride, 1995 : Scott Mellanby tue un rat d\'un coup de bâton dans le vestiaire, marque deux buts — le « rat trick » — et les partisans en lancent des centaines en plastique.',
    recit: 'Un rat a traversé le vestiaire pendant la réunion d\'avant-match. Ton ailier l\'a expédié d\'un tir du poignet.',
    options: [
      { cle: 'folie', nom: 'En faire un porte-bonheur', bon: 'Si le rat porte chance, ça lance de partout', prix: 'Sinon, des rats en plastique partout et un arbitre à bout',
        pari: { chance: 0.5, gagne: { volume: 1.11, duree: 1 }, perd: { discipline: 1.25, duree: 1 } } },
      { cle: 'sobre', nom: 'On passe à autre chose', bon: 'Tête froide', discipline: 0.84 },
    ] },
  poteaux: { ico: '🥅', titre: 'Le gardien parle à ses poteaux', cible: 'gardien',
    irl: 'Patrick Roy parlait à ses poteaux pendant les matchs ; il disait qu\'ils étaient ses amis.',
    recit: '{nom} a ses rituels. Ce soir, le soigneur veut les couper pour son aine.',
    options: [
      { cle: 'rituels', nom: 'Laisser ses rituels', bon: 'Il est dans sa bulle', prix: 'Son aine souffre : jambes −20 jusqu\'à sa prochaine soirée de congé', defense: 0.92, action: { energie: -20 } },
      { cle: 'auxiliaire', nom: 'Le reposer : l\'auxiliaire prend le gros match', bon: '{nom} est frais pour la suite', prix: 'Ton auxiliaire dans un gros match', action: { gardienAux: 1 } },
    ] },
  ancien: { ico: '🧳', titre: 'Le retour de l\'ancien',
    faits: c => c && c.advRoster && c.advRoster.some(k => c.anciensJoueurs && c.anciensJoueurs.has(k)) ? {} : null,
    recit: 'Un joueur que tu as laissé partir joue chez eux. Il a dit qu\'il « avait quelque chose à prouver ».',
    options: [
      { cle: 'cibler', nom: 'Le cibler', bon: 'On lui fait payer son départ', prix: 'L\'arbitre le voit venir', robustesse: 1.5, discipline: 1.175 },
      { cle: 'ignorer', nom: 'L\'ignorer', bon: 'On joue notre match', defense: 0.94 },
    ] },
  gabarit: { ico: '📏', titre: 'Le gabarit dans le vestiaire', regle: true,
    irl: 'Depuis 1990, les arbitres peuvent mesurer la courbe d\'un bâton.',
    recit: 'Quelqu\'un a laissé un gabarit sur le banc. Tes meilleurs bâtons ne passeraient pas.',
    options: [
      { cle: 'garder', nom: 'Garder les courbes', bon: 'Le tir tombe', prix: 'S\'ils mesurent, les punitions tombent aussi', finition: 1.08, discipline: 1.213, trou: true },
      { cle: 'changer', nom: 'Changer les bâtons', bon: 'Rien à mesurer', discipline: 0.84 },
    ] },
  desert: { ico: '🚪', titre: 'Le plan du filet désert', regle: true,
    recit: 'Ton adjoint a écrit un jeu : le gardien sort à la moitié de la troisième, pas à la dernière minute.',
    options: [
      { cle: 'tot', nom: 'Le sortir tôt', bon: 'Un attaquant de plus quand ça compte', prix: 'Le filet est vide longtemps', volume: 1.088, defense: 1.095, trou: true },
      { cle: 'tard', nom: 'À la dernière minute, comme tout le monde', bon: 'On ne donne pas le match', defense: 0.96 },
    ] },
  sifflet: { ico: '🦓', titre: 'Cet arbitre laisse jouer', regle: true,
    recit: 'Le rapport est clair : celui de ce soir a le sifflet dans la poche. Tes vétérans veulent en profiter.',
    options: [
      { cle: 'profiter', nom: 'Accrocher, retenir, bloquer', bon: 'Les jeux meurent dans les coins', prix: 'S\'il change d\'idée, ça coûte cher', defense: 0.913, discipline: 1.19, trou: true },
      { cle: 'propre', nom: 'Jouer propre quand même', bon: 'La tête froide', discipline: 0.825 },
    ] },
};

/* L'événement d'avant un gros match : pur, et jamais deux fois le même dans une partie (`deja`).
 * `contexte` est un objet passé à `faits(c)` pour filtrer les événements dont la condition ne tient pas. */
export function avantDuGros(graine, cle, deja = [], contexte = null) {
  const tous = Object.keys(AVANT_GROS), libres = tous.filter(c => !deja.includes(c));
  const cles = libres.filter(c => !AVANT_GROS[c].faits || (contexte && AVANT_GROS[c].faits(contexte)));
  // Les douze joués (une longue saison de Rogue en annonce plus) : on refait le tour, jamais deux fois le même de suite.
  const pool = cles.length ? cles : libres.length ? libres : tous.filter(c => c !== deja[deja.length - 1]);
  return pool[Math.floor(hacherMise(graine, 'avant', cle) * pool.length)];
}

/* L'effet d'une option d'avant-match, pour la journée du match. */
function effetAvant(d) {
  const A = d && d.avant && AVANT_GROS[d.avant.cle];
  const o = A && A.options.find(x => x.cle === d.avant.choix);
  if (!o) return null;
  const { cle, nom, bon, prix, pari, action, enjeu, ensuite, trou: _t, ...canaux } = o;
  void cle; void bon; void prix; void pari; void action; void enjeu; void ensuite; void _t;
  return { source: 'avant', nom, ...canaux, ...(_t ? { regle: true } : {}) };
}

/*
 * LE DEUXIÈME ENTRACTE. Deux options selon le pointage, une que la soirée
 * apporte (l'incident), et garder le cap. Les effets ne jouent que la
 * troisième période, donc ils sont francs.
 *
 * DIX PAR POINTAGE, DEUX PAR SOIR (1.0, oct.). JP : *les choix entre la deux
 * et la trois, c'est toujours évident laquelle prendre, donc useless, varier
 * plus, genre 10 selon chaque contexte*. Mené, à égalité ou devant, chaque
 * pointage a sa réserve de dix gestes (`si`) ; le soir en tire deux, de la
 * graine et du match. Chacun paie quelque part : en buts contre, en
 * punitions, en blessures, ou en JAMBES pour les matchs qui suivent — le bon
 * choix dépend du soir, de ton club et de ton calendrier, plus du pointage.
 *
 * DEUX FOIS PLUS FRANCS (1.0, le tempo). JP : *les choix à l'entracte ont aucun
 * impact sur le style de jeu*. Une 3e période, c'est neuf tirs par club : à
 * ±10 %, un geste en déplaçait un, et rien ne se voyait. Chaque écart au 1
 * est doublé, prix compris (ce qui garde les prix et les dominances que
 * `check_choix` et `check_gros` exigent) : « Fermer la porte » coupe le
 * jeu des deux côtés, « Tout pour l'attaque » l'ouvre.
 */
export const ENTRACTES = {
  garder: { ico: '🧊', nom: 'Garder le cap', bon: 'On ne change rien', prix: 'Rien de neuf non plus' },
  // Mené.
  attaque: { ico: '🎲', nom: 'Tout pour l\'attaque', si: ['derriere'], bon: 'Tout le monde monte', prix: 'Ton gardien est seul', volume: 1.36, defense: 1.3 },
  gardien: { ico: '🧤', nom: 'Envoyer l\'auxiliaire', si: ['derriere'], bon: 'Ton auxiliaire prend le filet pour la troisième', prix: 'Le partant rentre au vestiaire', changeGardien: true, defense: 0.92 },
  pointe: { ico: '🪜', nom: 'Les défenseurs montent', si: ['derriere'], bon: 'Cinq joueurs en attaque', prix: 'Des échappées contre', volume: 1.24, defense: 1.2 },
  vedettes: { ico: '✌️', nom: 'Deux trios, pas plus', si: ['derriere'], bon: 'Tes meilleurs sur la glace', prix: 'Ils finissent à plat, et demain aussi', F: [1.35, 1.25, 0.7, 0.5], finition: 1.04, energie: 1.24 },
  rage: { ico: '😤', nom: 'Revenir à coups d\'épaule', si: ['derriere'], bon: 'Le jeu robuste tourne pour toi', prix: 'Des punitions', robustesse: 1.6, finition: 1.04, discipline: 1.5 },
  jeunes: { ico: '🪁', nom: 'Laisser jouer le 4e trio', si: ['derriere'], bon: 'Tes vedettes gardent leurs jambes pour demain', prix: 'Tu laisses filer celui-ci', F: [0.8, 0.9, 1.1, 1.5], energie: 0.76, finition: 0.96 },
  // Mené ou à égalité.
  patience: { ico: '🔦', nom: 'Attendre le bon tir', si: ['derriere', 'egal'], bon: 'Des tirs de qualité', prix: 'Moins de tirs', finition: 1.12, volume: 0.84 },
  pluie: { ico: '🪃', nom: 'Une pluie de rondelles', si: ['derriere', 'egal'], bon: 'Tout au filet', prix: 'Des tirs de nulle part', volume: 1.28, finition: 0.9, defense: 1.06 },
  meute: { ico: '🐺', nom: 'Échec-avant à trois', si: ['derriere', 'egal'], bon: 'On vole des rondelles', prix: 'Des surnombres contre, des jambes en moins', volume: 1.3, defense: 1.14, energie: 1.16 },
  discours: { ico: '🗣️', nom: 'L\'entraîneur élève la voix', si: ['derriere', 'egal', 'devant'], bon: 'Le vestiaire se réveille', prix: 'Des têtes chaudes', finition: 1.06, discipline: 1.2 },
  // À égalité.
  prolo: { ico: '⏳', nom: 'Jouer pour la prolongation', si: ['egal'], bon: 'Pas de risque', prix: 'Pas de but non plus', defense: 0.8, volume: 0.8 },
  doubler: { ico: '🔥', nom: 'Doubler le 1er trio', si: ['egal'], bon: 'Ton meilleur trio sur la glace', prix: 'Il va finir à plat', F: [1.4, 1, 0.85, 0.75], energie: 1.2 },
  premier: { ico: '🛸', nom: 'Le premier but gagne', si: ['egal'], bon: 'On attaque en vagues', prix: 'La porte s\'entrouvre', volume: 1.2, finition: 1.04, defense: 1.12 },
  rouler: { ico: '♻️', nom: 'Rouler quatre trios', si: ['egal', 'devant'], bon: 'Des jambes fraîches à chaque présence', prix: 'Ton 4e trio joue les grosses minutes', F: [0.9, 0.95, 1.05, 1.15], energie: 0.8, finition: 0.96 },
  // À égalité ou devant.
  paire: { ico: '🦔', nom: 'La 1re paire tout le temps', si: ['egal', 'devant'], bon: 'Tes meilleurs défenseurs sur la glace', prix: 'Ils vont finir à plat', D: [1.4, 1, 0.6], defense: 0.88, energie: 1.2 },
  bloquer: { ico: '🧯', nom: 'Bloquer tous les tirs', si: ['egal', 'devant'], bon: 'Rien ne se rend au filet', prix: 'Des rondelles dans les chevilles', defense: 0.8, blessure: 1.8 },
  // Devant.
  porte: { ico: '🧱', nom: 'Fermer la porte', si: ['devant'], bon: 'Tout le monde en zone neutre', prix: "On n'attaque plus", defense: 0.7, volume: 0.7 },
  tueur: { ico: '🦬', nom: 'Aller chercher le but qui tue', si: ['devant'], bon: 'Enterrer le match', prix: 'Un contre peut tout renverser', volume: 1.16, finition: 1.06, defense: 1.12 },
  repos: { ico: '🛋️', nom: 'Reposer les vedettes', si: ['devant'], bon: 'Leurs jambes pour demain', prix: 'Les plombiers protègent l\'avance', F: [0.7, 0.9, 1.15, 1.3], energie: 0.76, defense: 1.08 },
  rondelle: { ico: '🪀', nom: 'Garder la rondelle', si: ['devant'], bon: 'Ils ne l\'ont pas, ils ne marquent pas', prix: 'Moins de tirs, des jambes en moins', volume: 0.9, defense: 0.86, energie: 1.1 },
  payer: { ico: '🔨', nom: 'Faire payer chaque mise en échec', si: ['devant'], bon: 'Ils hésitent à venir', prix: 'Des punitions', robustesse: 1.6, defense: 0.94, discipline: 1.5 },
  contre: { ico: '💨', nom: 'Contre-attaquer en vitesse', si: ['devant'], bon: 'Leurs défenseurs montés, des surnombres', prix: 'Ça ouvre des deux côtés', volume: 1.1, finition: 1.08, defense: 1.1 },
};
/* Les gestes d'entracte qu'un pointage peut tirer. */
export const entractesDu = etat => Object.keys(ENTRACTES).filter(c => (ENTRACTES[c].si || []).includes(etat));
export const INCIDENTS = {
  boite: { ico: '🤕', titre: 'Leur vedette boite en retournant au banc',
    option: { cle: 'cibler', ico: '🎯', nom: 'Aller jouer de son côté', bon: 'Il ne suit plus', prix: "L'arbitre voit tout", volume: 1.12, discipline: 1.5 } },
  brasse: { ico: '🥊', titre: 'Ça a brassé à la sirène',
    option: { cle: 'dur', ico: '🥊', nom: 'Envoyer ton dur au premier engagement', bon: 'Le banc se lève', prix: 'Cinq minutes au cachot', robustesse: 3, finition: 1.04, discipline: 1.4 } },
  ebranle: { ico: '😵‍💫', titre: 'Leur gardien a l\'air ébranlé',
    option: { cle: 'lancer', ico: '🏹', nom: 'Lancer de partout', bon: 'Il faut le tester', prix: 'Des tirs de nulle part', volume: 1.24, finition: 0.92 } },
  foule: { ico: '📣', titre: 'La foule est en feu',
    option: { cle: 'foule', ico: '📣', nom: 'Surfer sur la foule', bon: "L'amphithéâtre pousse", prix: "On s'emballe", finition: 1.08, discipline: 1.2 } },
  glace: { ico: '🧊', titre: 'La glace est molle, la rondelle roule',
    option: { cle: 'simple', ico: '🧹', nom: 'Jeu simple : au filet et au rebond', bon: 'La rondelle au filet', prix: 'Rien de joli', volume: 1.1, finition: 0.96 } },
  arbitre: { ico: '🦓', titre: 'L\'arbitre a avalé son sifflet',
    option: { cle: 'accrocher', ico: '🪝', nom: 'En profiter : accrocher, retenir', bon: 'Tout passe', prix: 'Si ça tourne, ça tourne mal', defense: 0.86, discipline: 0.8 } },
  paire: { ico: '🚑', titre: 'Un de tes défenseurs est resté au vestiaire',
    option: { cle: 'cinq', ico: '🔄', nom: 'Doubler la 1re paire', bon: 'Tes meilleurs défenseurs sur la glace', prix: 'Ils vont finir à plat', D: [1.35, 1, 0.65], energie: 1.2 } },
  gabarit: { ico: '📏', titre: 'L\'arbitre a sorti son gabarit',
    option: { cle: 'courbes', ico: '🏒', nom: 'Garder les courbes quand même', bon: 'Le tir reste vicieux', prix: 'Une punition s\'il mesure le bon bâton', finition: 1.08, discipline: 1.44 } },
};
/* L'incident de l'entracte : pur, de la graine et du match. */
function incidentDuMatch(graine, cle) {
  const cles = Object.keys(INCIDENTS);
  return cles[Math.floor(hacherMise(graine, 'incident', cle) * cles.length)];
}
/* Les options de l'entracte, selon le pointage après deux périodes. `etat` : 'devant', 'derriere' ou 'egal'. */
export function entractesOfferts(graine, cle, etat) {
  const inc = incidentDuMatch(graine, cle);
  return {
    incident: inc,
    // Deux de la réserve du pointage, de la graine et du match (le même soir rejoué offre les mêmes).
    options: [
      ...entractesDu(etat).sort((a, b) => hacherMise(graine, 'entracte', cle, a) - hacherMise(graine, 'entracte', cle, b)).slice(0, 2).map(c => ({ cle: c, ...ENTRACTES[c] })),
      { ...INCIDENTS[inc].option, incident: inc },
      { cle: 'garder', ...ENTRACTES.garder },
    ],
  };
}
/* L'effet d'un choix d'entracte : la troisième période seulement. */
export function effetEntracte(e) {
  if (!e) return null;
  const src = ENTRACTES[e.cle] || (e.incident && INCIDENTS[e.incident] && INCIDENTS[e.incident].option.cle === e.cle ? INCIDENTS[e.incident].option : null);
  if (!src) return null;
  const { cle, ico, nom, bon, prix, si, changeGardien, ...canaux } = src;
  void cle; void bon; void prix; void si; void changeGardien;
  return { source: 'entracte', nom, ico, ...canaux };
}

/*
 * LA MISE EN SCÈNE D'UN MATCH, posée sur les deux équipes avant qu'il se
 * joue : le plan de l'adversaire (contré ou non, sur tes lignes du jour) et
 * les effets d'avant-match. `playGame` la lit (`_gros`), coupe le match au
 * deuxième entracte et la retire après.
 */
/* L'échelle de la fin de partie d'un gros match (S80) : sa journée, ou sa ronde de séries. */
const echelleDuGros = (gros, toi) => (!(toi && toi.courbe) ? 1 : echelleTardive(gros && gros.serie ? { serie: true, ronde: gros.ronde || 0 } : { jour: (gros && gros.jour) || 0 }));
/*
 * LES LIGNES DE L'ADVERSAIRE SOUS UN PLAN (1.0, J1-N) : ses lignes de la
 * saison, puis ce que le plan y change. C'est ce que le moteur joue un soir
 * de gros match (`poserGros`), et ce que l'écran lit pour dire « tu
 * étouffes » — avec le plan le plus PROBABLE du dépistage, jamais le vrai,
 * qui reste caché jusqu'au match. Sans plan : les lignes de la saison.
 */
export function lignesDeGros(adv, lineup, plan = null) {
  const P = plan ? PLANS_ADV[plan] : null;
  const base = lignesDe(adv, lineup, { duSoir: false });
  return base.map((l, u) => ({ ...l, ...((P && P.lignes && P.lignes[u]) || {}) }));
}
function poserGros(toi, adv, gros) {
  toi._gros = gros; adv._gros = null;
  // Le plan règle VRAIMENT les lignes de l'adversaire pour ce match (S72).
  adv._lignesMatch = lignesDeGros(adv, adv.roster, gros.plan);
  adv._effetMatch = null;
  toi._effetMatch = [...(gros.effetsAvant || [])];
  toi._advGros = adv;
  // LEUR MAIN SE TIRE D'ABORD (S76) : tes cartes peuvent la lire (« La riposte »).
  if (OPTIONS_COMBAT.adverses && gros.cleMain != null) {
    gros.cartesAdv = mainAdverse(gros.graineMain, gros.cleMain, energieAdverse({ nMatch: matchsEntre(toi, 0, (gros.jour || 0) + 1), serie: !!gros.serie, ronde: gros.ronde || 0 }));
  }
  const fxToi = gros.cartes && Array.isArray(gros.cartes.jouees) ? poserCartes(toi, adv, gros) : null;
  poserPreparation(toi, adv, gros, fxToi);
  gros.contre = !!gros.prepJuste || !!gros.lu || planEstContre(gros.plan, toi._lignesMatch || lignesDe(toi, toi.roster), adDeLEquipe(toi));
  // Plan contré : les réglages de leurs lignes tombent, peu importe la cause.
  if (gros.contre) adv._lignesMatch = null;
  // LEUR MAIN (S74, js/combat.js) : connue d'avance, jouée ici — sauf si ta main l'annule.
  if (gros.cartesAdv) {
    const annulee = !!(gros.cartes && (gros.cartes.jouees || []).some(c => CARTES_MATCH[c] && CARTES_MATCH[c].annule));
    if (!annulee) {
      const fx = effetsDesCartes(adv, { jouees: gros.cartesAdv }, `${gros.graineMain}:${gros.cleMain}:adverse`, { mainAdv: (gros.cartes && gros.cartes.jouees) || [], echelle: echelleDuGros(gros, toi) });
      adv._effetMatch = [...(adv._effetMatch || []), ...fx.effets];
      toi._effetMatch.push(...fx.adv);
      if (fx.energieTous) for (const sl of SLOTS) { const p = adv.roster[sl.i]; if (p && p.p !== 'G') rendreJambes(p, fx.energieTous); }
    }
    gros.cartesJouees = { ...(gros.cartesJouees || { jouees: [] }), plan: gros.plan, adverses: gros.cartesAdv.slice(), annulee };
  }
}

/*
 * LES CARTES DU SOIR (S74, js/combat.js). Tout ce qu'elles font se pose ici,
 * avant la mise au jeu, et se lit comme le reste du gros match : des effets
 * de CE match pour toi (`_effetMatch`) et pour l'adversaire, son plan qui
 * tombe, tes deux premières lignes sur son contre, de l'énergie rendue, un
 * pari tiré de la graine. `gros.cartesJouees` raconte ce qui a été joué — la
 * feuille le garde, le direct et ton histoire le disent.
 */
function poserCartes(toi, adv, gros) {
  const fx = effetsDesCartes(toi, gros.cartes, gros.cleCartes || '', { mainAdv: gros.cartesAdv || [], echelle: echelleDuGros(gros, toi) });
  toi._effetMatch.push(...fx.effets);
  if (fx.adv.length) adv._effetMatch = [...(adv._effetMatch || []), ...fx.adv];
  if (fx.lire) { adv._lignesMatch = null; gros.lu = true; }
  // Leur plan tombé, il n'y a plus rien à contrer : le récit le dit comme une lecture parfaite.
  if (fx.lire) gros.contre = true;
  if (fx.energieTous) for (const sl of SLOTS) {
    const p = toi.roster[sl.i];
    if (p && p.p !== 'G') rendreJambes(p, fx.energieTous);
  }
  gros.cartesJouees = { jouees: gros.cartes.jouees.slice(), paris: fx.paris, lu: !!fx.lire };
  return fx;
}
/* Ta préparation contre leur plan (S76, voir `PREP_JUSTE`) : juste, fausse, ou rien. */
function poserPreparation(toi, adv, gros, fx) {
  let prepa = [].concat(gros.prep || []).filter(k => PLANS_ADV[k]);
  // « La filature » : tu SAIS leur plan. « Le plan B » : deux pistes au lieu d'une.
  if (fx && fx.revele) prepa = [gros.plan];
  prepa = [...new Set(prepa)].slice(0, fx && fx.planB ? 2 : 1);
  gros.preparation = prepa;
  gros.prepJuste = prepa.length ? prepa.includes(gros.plan) : null;
  if (prepa.length || gros.cartesJouees) gros.cartesJouees = { ...(gros.cartesJouees || { jouees: [] }), plan: gros.plan, preparation: prepa, prepJuste: gros.prepJuste };
  if (!prepa.length) return;
  if (gros.prepJuste) {
    adv._lignesMatch = null;
    toi._effetMatch.push({ source: 'preparation', nom: 'Ta préparation vise juste', ico: '🎯', ...PREP_JUSTE });
    if (fx && fx.piege) toi._effetMatch.push({ source: 'carte', nom: 'Le piège tendu', ico: '🕸️', ...fx.piege });
  } else if (fx && fx.improvise) {
    toi._effetMatch.push({ source: 'carte', nom: 'L\'improvisation', ico: '🎷', ...fx.improvise });
  } else {
    toi._effetMatch.push({ source: 'preparation', nom: 'Ta préparation rate', ico: '💥', ...PREP_RATEE });
  }
}

/*
 * CE QUE DES CARTES FONT, EN CANAUX (S74). Exporté : l'écran de la main
 * l'appelle pour dire, AVANT qu'on joue, exactement ce que le moteur jouera —
 * les synergies comprises, qui lisent ta formation (jamais une cote : les
 * profils mesurés et les tactiques de tes lignes). Le pari se tire de
 * `cle` (la graine, le match et le sel de la décision) : pur.
 */
const ORIGINES_SYN = new Set(['coequipiers', 'famille', 'ligneOrigine', 'decennie', 'vieilleGarde', 'releve', 'dynastieClub']);
export function effetsDesCartes(team, cartes, cle = '', { mainAdv = [], echelle = 1 } = {}) {
  const out = { effets: [], adv: [], lire: false, contre: false, annule: false, energieTous: 0, paris: [],
    revele: false, ecarte: 0, planB: false, improvise: null, piege: null };
  const jouees = (cartes && cartes.jouees) || [];
  // Un effet répété n fois : chaque canal s'éloigne n fois de 1 (+3 % par carte, trois cartes : +9 %).
  const fois = (e, n) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, 1 + (v - 1) * n]));
  const genreDe = c => (CARTES_MATCH[c] ? CARTES_MATCH[c].genre : null);
  const fusion = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 1) * v; return o; };
  const dresses = SLOTS.filter(sl => !sl.scratch).map(sl => ({ sl, p: team && team.roster[sl.i] })).filter(x => x.p && x.p.p !== 'G');
  const principal = p => { const pr = profilPrincipal(p); return pr ? pr.cle : null; };
  let origines = null;
  const synergie = k => {
    if (k === 'systeme') {
      const tacs = lignesDe(team, team.roster, { duSoir: false }).map(l => l.tac).filter(t => t && t !== 'hourra');
      return tacs.some(t => tacs.filter(x => x === t).length >= 2) ? { finition: 1.06 } : null;
    }
    if (k === 'gachettes') {
      const n = dresses.filter(x => x.sl.group === 'F' && x.sl.unit <= 1 && principal(x.p) === 'sniper').length;
      return n ? { finition: 1 + Math.min(0.06, 0.02 * n) } : null;
    }
    if (k === 'mur') {
      // Réparé en refonte 1 : il lisait « pur », un rôle disparu en S79, et ne se déclenchait jamais.
      const n = dresses.filter(x => x.sl.group === 'D' && principal(x.p) === 'defensif').length;
      return n ? { defense: 1 - Math.min(0.06, 0.02 * n) } : null;
    }
    if (k === 'jambes') {
      // Réparé en refonte 1 : il lisait « rapide », un rôle disparu en S79 ; ce sont les plombiers qui partent en contre.
      const n = dresses.filter(x => x.sl.group === 'F' && principal(x.p) === 'energie').length;
      return n ? { volume: 1 + Math.min(0.08, 0.02 * n) } : null;
    }
    // LES ORIGINES (1.0) : même club, même franchise, même décennie, même âge. Les chiffres sont ceux de la `regle` (js/combat.js).
    const o = ORIGINES_SYN.has(k) ? (origines = origines || originesDe(team)) : null;
    if (k === 'coequipiers') return o.coequipiers ? { finition: 1 + Math.min(0.06, 0.02 * o.coequipiers) } : null;
    if (k === 'famille') { const n = Math.max(0, o.franchise - 2); return n ? { defense: 1 - Math.min(0.06, 0.02 * n) } : null; }
    if (k === 'ligneOrigine') { const n = Math.min(2, o.lignesOrigine); return n ? { volume: 1 + 0.04 * n, finition: 1 + 0.02 * n } : null; }
    if (k === 'decennie') return o.triosDecennie ? { volume: 1 + Math.min(0.08, 0.02 * o.triosDecennie) } : null;
    if (k === 'vieilleGarde') return o.veterans ? { defense: 1 - Math.min(0.06, 0.01 * o.veterans) } : null;
    if (k === 'releve') return o.jeunes ? { volume: 1 + Math.min(0.08, 0.01 * o.jeunes) } : null;
    if (k === 'dynastieClub') return o.franchise >= 5 ? { finition: 1.06, defense: 0.96 } : null;
    return null;
  };
  jouees.forEach((c, i) => {
    const C = CARTES_MATCH[c];
    if (!C || C.injouable) return;
    if (C.effet) out.effets.push({ source: 'carte', nom: C.nom, ico: C.ico, ...C.effet });
    // S80 : une carte qui VISE L'ADVERSAIRE grandit avec le soir (`echelleTardive`).
    if (C.adv) out.adv.push({ source: 'carte', nom: C.nom, ico: C.ico, ...grandirEffet(C.adv, echelle) });
    if (C.lire) out.lire = true;
    if (C.annule) out.annule = true;
    if (C.energieTous) out.energieTous += C.energieTous;
    if (C.synergie) { const e = synergie(C.synergie); if (e) out.effets.push({ source: 'carte', nom: C.nom, ico: C.ico, ...e }); }
    // S76 : le dépistage et la préparation, les combos, leur main, le réservoir vide.
    if (C.revele) out.revele = true;
    if (C.ecarte) out.ecarte += C.ecarte;
    if (C.planB) out.planB = true;
    if (C.improvise) out.improvise = fusion(out.improvise, C.improvise);
    if (C.piege) out.piege = fusion(out.piege, C.piege);
    if (C.parGenre) {
      const n = jouees.filter(x => genreDe(x) === C.parGenre.genre).length;
      if (n) out.effets.push({ source: 'carte', nom: C.nom, ico: C.ico, ...fois(C.parGenre.effet, n) });
    }
    if (C.selonLeurMain) {
      const n = mainAdv.filter(x => genreDe(x) === C.selonLeurMain.genre).length;
      if (n) out.effets.push({ source: 'carte', nom: C.nom, ico: C.ico, ...fois(C.selonLeurMain.effet, n) });
    }
    if (C.siVide && energieDepensee(jouees) <= 0) out.effets.push({ source: 'carte', nom: C.nom, ico: C.ico, ...C.siVide });
    if (C.pari) {
      const gagne = hacherMise(cle, 'carte', i, c) < C.pari.chance;
      out.effets.push({ source: 'carte', nom: C.nom, ico: C.ico, ...(gagne ? C.pari.gagne : C.pari.perd) });
      out.paris.push({ cle: c, gagne });
    }
  });
  // Une malédiction restée dans la main coûte, elle aussi.
  for (const c of (cartes && cartes.enMain) || []) {
    const C = CARTES_MATCH[c];
    if (C && C.enMain) out.effets.push({ source: 'carte', nom: C.nom, ico: C.ico, ...C.enMain });
  }
  return out;
}
/*
 * UN GROS MATCH ISOLÉ, POUR LA MESURE (S74, scripts/check_combat.mjs). Le
 * calibrage des cartes sur des saisons entières était trop bruité : un gros
 * match n'est « gros » que si le classement de la veille le dit, et chaque
 * décision déplace les suivants — il n'en restait qu'une vingtaine d'appariés.
 * Ici, le même match, sur les mêmes dés, avec ou sans cartes.
 */
export function simulerGrosMatch(toi, adv, { plan = 'trappe', cartes = null, graine = 'mesure', cle = 'j0', prep = null, moment = null } = {}) {
  grainerHasard(`${graine}:${cle}`);
  // Des jambes fraîches des deux côtés : une carte qui rend de l'énergie écrit sur les joueurs, et la mesure d'un match ne doit pas hériter du précédent.
  for (const t of [toi, adv]) for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) { p.energie = 100; delete p._reserve; } }
  // LE MOMENT (S80, scripts/check_rogue.mjs) : le même match au jour N de la saison, ou à une ronde des séries — l'échelle de la fin de partie suit.
  const m = moment || {};
  const gros = { jour: m.serie ? 0 : (m.jour || 0), serie: !!m.serie, ronde: m.ronde || 0, adv, raison: 'rival', plan, prep, avant: null, effetsAvant: [], cartes, cleCartes: `${graine}:${cle}`, graineMain: graine, cleMain: cle };
  poserGros(toi, adv, gros);
  const feuille = feuilleVierge();
  const r = playGame(toi, adv, m.serie ? 0 : (moment ? m.jour || 0 : 1), false, !!m.serie, feuille, m.ronde || 0);
  leverGros(toi);
  return { gagne: r.winner === toi, gf: r.gfA, ga: r.gfB, gros };
}
function leverGros(toi) {
  const adv = toi._advGros;
  if (adv) { adv._effetMatch = null; adv._lignesMatch = null; }
  toi._gros = null; toi._effetMatch = null; toi._advGros = null; toi._entracte = null;
  // Le contre parfait ne vaut que pour CE match (S74).
  toi._lignesMatch = null;
}

/*
 * LES JOUEURS VISÉS PAR UNE CARTE (S72). JP : *mettons que tu rappelles des
 * joueurs du club-école, ou whatever ce genre de cartes, faut le faire pour
 * vrai*. Une carte qui parle d'un joueur le NOMME avant le choix, et ce qu'elle
 * lui fait arrive vraiment. Le tirage est PUR (l'alignement, la graine, le
 * jour) : l'écran et le moteur désignent les mêmes hommes. On lit la vraie
 * saison du joueur (ses points, ses minutes de punition), jamais une cote.
 */
export function ciblesDe(team, sorte, graine = 0, jour = 0) {
  if (!team || !team.roster) return [];
  const habilles = SLOTS.filter(s => !s.scratch).map(s => team.roster[s.i]).filter(Boolean);
  const pats = habilles.filter(p => p.p !== 'G');
  if (sorte === 'gardien') { const g = SLOTS.find(s => s.group === 'G' && !s.scratch); return g && team.roster[g.i] ? [team.roster[g.i]] : []; }
  if (sorte === 'vedette') return pats.slice().sort((a, b) => (b.pt || 0) - (a.pt || 0)).slice(0, 1);
  if (sorte === 'dur') return pats.slice().sort((a, b) => (b.pim || 0) - (a.pim || 0)).slice(0, 1);
  if (sorte === 'trois') {
    return pats.map(p => [p, hacherMise(graine, 'cible', jour, getPlayerKey(p))]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([p]) => p);
  }
  return [];
}

/*
 * CE QU'UNE OPTION FAIT EN PLUS D'UN EFFET (S72), appliqué au jour de la
 * décision : son pari (tiré de la graine), son investissement (`ensuite`) et
 * ses gestes réels sur les joueurs nommés. Le pari est noté sur l'équipe
 * (`team.paris`) pour que l'écran et le récit disent comment il a tourné.
 */
function appliquerGestes(team, o, jour, cles, graine, cleTirage, titre = '') {
  if (!team || !o) return;
  const joueurs = (cles || []).map(k => Object.values(team.roster || {}).find(p => p && getPlayerKey(p) === k)).filter(Boolean);
  const gestes = (a, j0) => {
    if (!a) return;
    if (a.absents) for (const p of joueurs) team.absents.set(p, Math.max(team.absents.get(p) || 0, apresMatchs(team, j0, a.absents)));
    if (a.energie) for (const p of joueurs) rendreJambes(p, a.energie);
    if (a.energieTous) for (const s of SLOTS) { const p = team.roster[s.i]; if (p && p.p !== 'G') rendreJambes(p, a.energieTous); }
    if (a.gardienAux) team.gardienAux = Math.max(team.gardienAux || 0, apresMatchs(team, j0, a.gardienAux));
  };
  const effet = (e, j0, source) => {
    if (!e) return;
    const { duree, apres, action, ...canaux } = e;
    void apres;
    gestes(action, j0);
    if (Object.keys(canaux).length) (team.effets = team.effets || []).push({ debut: j0, fin: apresMatchs(team, j0, duree || DUREE_MOMENT), source, nom: titre, ...canaux, ...(o.trou ? { regle: true } : {}) });
  };
  gestes(o.action, jour);
  if (o.ensuite) effet(o.ensuite, apresMatchs(team, jour, o.ensuite.apres || 0), 'ensuite');
  if (o.pari) {
    const gagne = pariGagne(graine, jour, cleTirage, o.pari.chance);
    (team.paris = team.paris || []).push({ jour, titre, choix: o.nom, gagne });
    effet(gagne ? o.pari.gagne : o.pari.perd, jour, 'pari');
  }
}

/*
 * LE PARI D'UNE DÉCISION, TRANCHÉ D'AVANCE. Le moteur l'applique le jour où
 * la journée se joue ; le tirage ne dépend que de la graine, du jour et du
 * choix — sans toucher au hasard de la saison — donc l'écran le dit dès le
 * choix, et c'est exactement ce que le moteur fera.
 */
/*
 * LE DÉ D'UN PARI (1.0, oct.). JP : *faire modal avec lancé de dé et réponse, pas juste dans boîte*. Un pari
 * se joue sur un dé à six faces : ses faces gagnantes sont les plus hautes (la chance en sixièmes,
 * `facesDuPari`), et la face sort de la même mise qui tranche le pari — la graine, le jour, le choix et
 * le sel tiré à la décision. L'écran ne tire rien : il montre cette face-là. Une chance qui tombe juste
 * en sixièmes (toutes, depuis) tranche exactement comme avant.
 */
export const facesDuPari = chance => Math.max(1, Math.min(5, Math.round(chance * 6)));
function deDuPari(graine, jour, cle, chance) {
  const faces = facesDuPari(chance), face = 6 - Math.floor(hacherMise(graine, 'pari', jour, cle) * 6);
  return { face, faces, gagne: face > 6 - faces };
}
const pariGagne = (graine, jour, cle, chance) => deDuPari(graine, jour, cle, chance).gagne;
// Le sel de la décision (1.0, oct.) : tiré au moment du choix, le pari n'est pas écrit dans la graine d'avance.
const cleDuPari = d => `${d.moment ? `${d.moment.cle}:${d.moment.choix}` : `avant:${d.avant.cle}:${d.avant.choix}`}${d.sel ? `:${d.sel}` : ''}`;
export function pariDeDecision(d, graine, team = null) {
  if (!d || !Number.isFinite(d.jour)) return null;
  const fam = d.moment ? familleDeMoment(d.moment) : d.avant ? AVANT_GROS[d.avant.cle] : null;
  const o = fam && fam.options.find(x => x.cle === (d.moment ? d.moment.choix : d.avant.choix));
  if (!o || !o.pari) return null;
  const { face, faces, gagne } = deDuPari(graine, d.jour, cleDuPari(d), o.pari.chance);
  const effet = gagne ? o.pari.gagne : o.pari.perd;
  return { jour: d.jour, titre: fam.titre, choix: o.nom, gagne, face, faces, effet, fin: apresMatchs(team, d.jour, effet.duree || DUREE_MOMENT) };
}

/*
 * CE QUI JOUE SUR TA FORMATION À UNE JOURNÉE (S72) : tous les effets en cours,
 * d'où qu'ils viennent — les dilemmes, les séquences, la consigne, l'élan,
 * les paris, les investissements, les cartes —, pour qu'ils se lisent au même
 * endroit que les stratégies. Et les absents du jour.
 */
/* Les éditions qui contournent une règle déjà écrite : la zone, l'ombre, l'étouffement. */
export const EDITIONS_REGLEMENT = ['enBas', 'chasse', 'partout', 'cran', 'style_fantome', 'style_courbe', 'style_accrocheur'];
export function effetsEnCours(team, jour) {
  if (!team) return { effets: [], cartes: [], absents: [], trous: [] };
  const effets = (team.effets || []).filter(e => jour >= e.debut && jour < e.fin && e.source !== 'match');
  // CE QUI RESTE SE COMPTE EN MATCHS (1.0, oct.) : les jours de congé ne comptent pas.
  const absents = [...(team.absents || new Map()).entries()].filter(([, j]) => j > jour).map(([p, j]) => ({ p, reste: matchsEntre(team, jour, j) }));
  const aux = team.gardienAux && team.gardienAux > jour ? matchsEntre(team, jour, team.gardienAux) : 0;
  const trous = (team.mutations || []).filter(x => x && EDITIONS_REGLEMENT.includes(x.cle) && x.jour <= jour);
  return { effets: effets.map(e => ({ ...e, reste: matchsEntre(team, jour, e.fin) })), cartes: (team.cartes || []).slice(), absents, gardienAux: aux, trous };
}

export const MINI_BOSS = {
  rival: { ico: '📊', nom: 'Rival au classement', mot: 'à deux rangs ou moins de toi' },
  nemesis: { ico: '😤', nom: 'Bête noire', mot: 'il t\'a déjà battu deux fois' },
};
export const ELAN = { nom: 'La lancée', ico: '⬆️', finition: 1.03, duree: 3 };
export const SONNE = { nom: 'Sonnés', ico: '😵', finition: 0.97, duree: 3 };
/*
 * LE GROS MATCH, repéré AVANT d'être joué (S70) : le moteur doit savoir
 * d'avance qu'il le coupera au deuxième entracte. Une RIVALITÉ naît de deux
 * défaites contre le même club et s'éteint quand on le bat (la revanche) ;
 * deux gros matchs sont séparés d'au moins ESPACEMENT_GROS journées.
 */
/*
 * L'ANNONCE d'un gros match, au matin d'une journée antérieure (S80) : une
 * fois par journée à venir, écrite une fois pour toutes (`null` quand ce n'en
 * est pas un). L'espacement se compte d'annonce en annonce.
 */
export const ANNONCE_GROS = 1;
function annoncerGros(L, toi, j) {
  // Pas avant ton 10e match (1.0, oct. : compté en matchs, le calendrier a des congés).
  if (j in L.grosAnnonces || matchsEntre(toi, 0, j) < 10 || j >= L.calendrier.length) return;
  const m = (L.calendrier[j] || []).find(x => x.A === toi || x.B === toi);
  const adv = m ? (m.A === toi ? m.B : m.A) : null;
  const raison = adv ? grosMatchAvant(toi, adv, j, rangsDe(L.teams)) : null;
  if (!raison) { L.grosAnnonces[j] = null; return; }
  toi._dernierAnnonce = j;
  const depistage = depistageDe(L.graine, `j${j}`, adv);
  L.grosAnnonces[j] = { jour: j, adv, raison, depistage, plan: planDuDepistage(L.graine, `j${j}`, depistage) };
}
function grosMatchAvant(toi, adv, r, rangs) {
  if (!rangs) return null;
  if (toi._dernierAnnonce != null && matchsEntre(toi, toi._dernierAnnonce, r) < ESPACEMENT_GROS) return null;
  toi.defaitesContre = toi.defaitesContre || new Map();
  if ((toi.defaitesContre.get(adv) || 0) >= 2) return 'nemesis';
  if (Math.abs(rangs.get(toi) - rangs.get(adv)) <= 2) return 'rival';
  return null;
}
function grosMatchApres(toi, m, r, gros) {
  const adv = m.A === toi ? m.B : m.A;
  const gagne = (m.A === toi) === (m.gfA > m.gfB);
  toi.defaitesContre = toi.defaitesContre || new Map();
  if (!gagne) toi.defaitesContre.set(adv, (toi.defaitesContre.get(adv) || 0) + 1);
  else toi.defaitesContre.delete(adv);
  if (!gros) return;
  toi._dernierGros = r;
  const E = gagne ? ELAN : SONNE;
  // L'ENJEU d'avant-match (S72) : une garantie, une chanson — l'élan ou le contrecoup dure deux fois plus.
  const A = gros.avant && AVANT_GROS[gros.avant.cle];
  const o = A && A.options.find(x => x.cle === gros.avant.choix);
  const duree = E.duree * (o && o.enjeu ? 2 : 1);
  (toi.effets = toi.effets || []).push({ debut: r + 1, fin: apresMatchs(toi, r + 1, duree), source: 'miniboss', nom: E.nom, ico: E.ico, finition: E.finition });
  (toi.minisBoss = toi.minisBoss || []).push({ jour: r, adv, raison: gros.raison, gagne, duree, plan: gros.plan, contre: gros.contre,
    depistage: gros.depistage || null, preparation: gros.preparation || [], prepJuste: gros.prepJuste ?? null,
    avant: gros.avant, entracte: gros.entracte || null, apres40: gros.apres40 || null, cartes: gros.cartesJouees || null });
}
