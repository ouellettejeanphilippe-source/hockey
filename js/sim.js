/**
 * Structure de l'alignement et simulation de la saison.
 *
 * Calibration vérifiée avec 23 joueurs de cote uniforme (12 essais par palier),
 * voir le tableau dans CLAUDE.md et `node scripts/calibrate_sim.mjs`.
 * Toute modification des constantes doit être revalidée (voir PLAN.md, S3).
 */

import { getLineZone, seasonGames, seasonLancers, getSecondaryPosition, LINE_ZONES, ZONE_THRESHOLDS,
         POIDS_TRIO, POIDS_PAIRE, RAPPEL_PASSES, passesRelatives, creationAutour } from './ratings.js';
import { facteurDefensifEquipe, facteurTraitGardien, facteurSeriesEquipe,
         facteurAttaqueEquipe, facteurLancersJoueur, facteurFinitionJoueur,
         bonusMeneurEquipe, facteurPresenceUnite, bonusRobustesseEquipe, getTraits } from './traits.js';

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
  if (!MODES[mode]?.renfort) return SLOTS;
  return SLOTS.filter(s => !s.scratch && s.unit === 0 && (s.group === 'F' || s.group === 'D' || s.group === 'G'));
}

/** L'unité d'une case : un trio, une paire, les deux gardiens, les trois réservistes. */
export const uniteDeCase = s => !s ? '' : s.scratch ? 'R' : s.group === 'G' ? 'G' : `${s.group}${s.unit}`;

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
export const ZONE_PEN_SOUS = 0.40;   // fraction de l'excédent de cote, par joueur mal placé
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
export const ZONE_ECHELLE = lireListe('ZONE_ECHELLE', [0, 0.45, 1.30, 1.90]);
export const ZONE_PUISSANCE = Number(ENV_MESURE.ZONE_PUISSANCE ?? 2);
export const ZONE_NOMBRE = lireListe('ZONE_NOMBRE', [1, 1, 1.6, 2.2]);
/*
 * Au-delà de ce malus, l'écran ne dit plus « mal assorti » mais « hors de ses
 * lignes » (voir `zoneEtat` plus bas). Douze points de synergie, c'est ce que
 * coûte un joueur à deux crans de sa zone : le seuil marque donc exactement la
 * frontière que JP a demandée, et l'étiquette la rend visible.
 */
export const ZONE_DUR = 12;

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
export function malusZoneJoueur(group, unit, v, ideal, opts = {}) {
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
  let somme = 0, mal = 0;
  for (const e of entrees) {
    const pen = malusZoneJoueur(group, unit, e.v, e.ideal, opts);
    if (pen > 0 || Math.min(...e.ideal.map(u => Math.abs(u - unit))) > 0) mal++;
    somme += pen;
  }
  const nombre = opts.nombre ?? ZONE_NOMBRE;
  const mult = opts.lineaire ? 1 : nombre[Math.min(mal, nombre.length - 1)];
  return { pen: Math.min(opts.plafond ?? ZONE_PEN_MAX, somme * mult), mal };
}

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

  // Les cotes ne servent plus qu'à la ZONE d'efficacité — le calibre d'un
  // joueur, c'est-à-dire la ligne où il rend. La chimie, elle, se calcule
  // plus bas sur les vraies statistiques.
  const hidden = ps.map(x => getHiddenRatings(x.player));

  // Zone d'efficacité : chaque joueur a un calibre (1er trio, 2e trio…) et
  // des trios où il rend à 100 %. Tout le monde à sa place -> bonus ;
  // joueur hors de sa zone -> pénalité selon l'écart, ASYMÉTRIQUE.
  const entrees = ps.map((x, i) => ({
    v: hidden[i].v, ideal: getLineZone(x.player, hidden[i].v).idealUnits,
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

  const ch = group === 'F' ? chimieTrio(ps.map(x => x.player)) : chimiePaire(ps.map(x => x.player));
  return withZone(ch.off, ch.def, ch.name, ch.desc);
}

/* ---------- la chimie, calculée sur les vraies statistiques ---------- */
/*
 * L'ancienne chimie lisait l'ARCHÉTYPE, qui est lui-même dérivé des cotes
 * cachées. C'était le dernier endroit du moteur qui raisonnait sur une cote
 * plutôt que sur ce que le joueur a vraiment fait, et ça se voyait : un trio
 * pouvait basculer en « conflit de rôles » parce que trois cotes offensives
 * franchissaient ensemble une frontière d'archétype, sans qu'aucun de ces
 * joueurs n'ait le même profil de production.
 *
 * Le PENCHANT d'un attaquant est maintenant lu directement dans sa fiche :
 * la part de sa production qui vient de ses buts, en écart au régulier moyen
 * de sa saison. Un franc-tireur est au-dessus, un fabricant de jeu en dessous.
 * Aucune cote n'entre là-dedans.
 *
 * Deux nombres décident du trio, et ils disent la même chose que le hockey :
 *
 *   ÉCART    entre le plus tireur et le plus passeur. Un trio a besoin de
 *            quelqu'un qui finit ET de quelqu'un qui sert. Deux francs-tireurs
 *            et un fabricant, c'est excellent ; trois fabricants, personne ne
 *            tire.
 *   EXCÈS    à quel point tout le trio penche du même bord. Trois francs-
 *            tireurs se disputent la même rondelle.
 *
 * La mesure est SANS ÉCHELLE — elle ne regarde que l'équilibre, jamais le
 * niveau. C'est délibéré : le moteur modélise déjà le volume de tirs et la
 * finition de chacun, donc récompenser un trio parce qu'il produit beaucoup
 * le compterait deux fois. Seule la POIDS de l'effet suit la production, parce
 * qu'organiser les rôles compte davantage quand il y a de l'offensive à
 * organiser.
 */
export const CHIMIE_ECART = 14;    // ce que vaut la complémentarité des rôles
export const CHIMIE_EXCES = 12;    // ce que coûte un trio qui penche du même bord
export const CHIMIE_PAIRE = 3.0;   // complémentarité d'une paire de défenseurs
export const PAIRE_RISQUE = 2.6;   // ce qu'une paire offensive concède en repli

/** Production offensive d'un joueur, en écart au régulier moyen de sa saison. */
function production(p) {
  if (!p) return 0.6;
  const est_D = p.p === 'D' || p.p === 'LD' || p.p === 'RD';
  const ref = seasonLancers(p.s)[est_D ? 5 : 4];
  const perso = (p.pt || 0) / Math.max(1, p.gp || 1);
  if (!ref) return 1;
  return borne(perso / ref, 0.2, 3.0);
}

/**
 * Le penchant d'un attaquant : positif = il finit, négatif = il sert.
 *
 * C'est la part de ses points qui vient de ses buts, moins celle du régulier
 * moyen de sa saison — mesurée, pas codée en dur, parce qu'une époque à forte
 * production de passes ferait autrement passer tout le monde pour des
 * fabricants de jeu. Sous 15 points le rapport ne veut rien dire.
 */
function penchant(p) {
  if (!p || (p.pt || 0) < 15) return 0;
  const ligue = seasonLancers(p.s)[6] || 0.40;
  return borne((p.g || 0) / Math.max(1, p.pt) - ligue, -0.30, 0.35);
}

function chimieTrio(joueurs) {
  const pen = joueurs.map(penchant);
  const ecart = Math.max(...pen) - Math.min(...pen);
  const exces = Math.abs(pen.reduce((s, x) => s + x, 0) / pen.length);
  const poids = borne(joueurs.reduce((s, p) => s + production(p), 0) / joueurs.length, 0.45, 1.35);

  const off = poids * (CHIMIE_ECART * ecart - CHIMIE_EXCES * exces);
  const moy = pen.reduce((s, x) => s + x, 0) / pen.length;

  let name, desc;
  if (off >= 3) {
    name = 'Chimie parfaite 🌟';
    desc = 'Quelqu\'un pour finir, quelqu\'un pour servir';
  } else if (off >= 1.2) {
    name = 'Tandem moteur 🎯';
    desc = 'Les rôles se complètent';
  } else if (off <= -1.2) {
    name = 'Conflit de rôles ⚠️';
    desc = moy > 0 ? 'Trois tireurs pour une rondelle' : 'Personne pour finir le jeu';
  } else {
    name = 'Chimie standard 👍';
    desc = 'Complémentarité correcte';
  }
  // La chimie de trio ne touche QUE l'attaque : la défensive passe par la cote
  // `d` et par les traits, où elle est mesurée. La faire agir ici aussi
  // reviendrait à la compter deux fois.
  return { off: Math.round(off * 10) / 10, def: 0, name, desc };
}

/**
 * Une paire de défenseurs. Le même principe, sur l'axe qui compte pour eux :
 * ce que chacun produit en attaque. Une paire dont les deux montent laisse
 * plus de retours — mesuré sur les vraies équipes, c'est le seul effet de
 * composition qui se voit chez les défenseurs.
 */
function chimiePaire(joueurs) {
  const prod = joueurs.map(production);
  const ecart = Math.abs(prod[0] - prod[1]);
  const moy = (prod[0] + prod[1]) / 2;

  const off = CHIMIE_PAIRE * Math.min(1, ecart) + 1.5 * (moy - 1);
  const def = -PAIRE_RISQUE * Math.max(0, moy - 1.2) + 2.2 * Math.max(0, 0.85 - moy);

  let name, desc;
  if (moy > 1.35 && ecart < 0.5) {
    name = 'Paire hyper-offensive 🚀';
    desc = 'Les deux montent : grave risque en repli';
  } else if (moy < 0.75) {
    name = 'Paire hermétique 🔒';
    desc = 'Peu d\'attaque, beaucoup de sécurité';
  } else if (ecart >= 0.45) {
    name = 'Paire équilibrée ⚖️';
    desc = 'Un qui monte, un qui couvre';
  } else {
    name = 'Paire standard 👍';
    desc = 'Complémentarité fluide';
  }
  return { off: Math.round(off * 10) / 10, def: Math.round(def * 10) / 10, name, desc };
}

/* ---------- pondérations ---------- */
const effStat = (player, slot, key) => {
  const r = getHiddenRatings(player);
  return Math.max(25, r[key] - getPositionPenalty(player, slot));
};

/* ======================================================================
   Le hasard du moteur
   ======================================================================
   TOUT le hasard de la simulation passe par `hasard()`, jamais par
   `Math.random` directement : c'est ce qui rend une saison REJOUABLE. Une
   graine (`grainerHasard`) remplace le générateur par un sfc32 déterministe,
   donc la même graine, les mêmes équipes et le même ordre d'appels redonnent
   les 1312 mêmes matchs — le défi du jour, « rejouer la saison » et un test
   reproductible en dépendent. `simulateLeague` tire une graine s'il n'en
   reçoit pas et la rend, pour qu'aucune saison ne soit perdue.
   ====================================================================== */

let hasard = Math.random;

/** Hache un texte ou un nombre en 32 bits (cyrb53 tronqué, suffit ici). */
export function graineDe(x) {
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
export const PART_LANCERS_D = 0.25;

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
export const ALPHA_POSSESSION = 0.150;

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
export const VOLUME_UNITE_MAX = 2.0;
export const PRESSION_MAX = 1.35;

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
export const FINITION_MAX = 1.20;

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
export const VOLUME_RANG = {
  F: [1.57, 1.22, 0.99, 0.80],
  D: [1.43, 1.06, 0.86],
};
/* Molette de mesure : 0 éteint le centrage sur le rang, pour la comparaison. */
export const VOLUME_CENTRE = Number(ENV_MESURE.VOLUME_CENTRE ?? 1);

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
 * CE QU'UNE CARTE DOIT FAIRE : changer la FORME de ta saison, pas sa force.
 * Chacune vise moins d'une victoire d'écart net ; ce qui bouge, ce sont les
 * buts marqués et alloués, l'infirmerie, et ce qui reste en séries. Les six
 * forment TROIS PAIRES OPPOSÉES — finition contre défensive, volume contre
 * blessures, volume contre robustesse — pour qu'aucune n'en double une autre.
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
    finition: 1.08, defense: 1.07,
  },
  // l'inverse : 6 % de buts alloués (+1,44) payés par 5,5 % de finition.
  cadenas: {
    nom: 'Le cadenas', ico: '🔒',
    bon: 'Tu alloues moins de buts', prix: 'Ton attaque finit moins bien',
    defense: 0.94, finition: 0.935,
  },
  // volume contre blessures : 5 % de lancers (+0,90) payés par des blessures
  // DOUBLÉES (−0,90). Il fallait les doubler : à ×1,45 la carte était gratuite.
  roulement: {
    nom: 'Roulement court', ico: '🔁',
    bon: 'Tes meilleurs jouent plus : plus de lancers', prix: 'Ils se blessent deux fois plus',
    volume: 1.035, blessure: 2.00,
  },
  // l'assurance. Le bonus ne vaut rien en victoires et tout en tranquillité ;
  // le prix est donc d'un pour cent de lancers, et pas davantage.
  infirmerie: {
    nom: "L'infirmerie", ico: '🏥',
    bon: 'Deux fois moins de blessures : ta saison ne déraille pas', prix: 'Un peu moins de lancers',
    blessure: 0.45, volume: 0.99,
  },
  // volume contre robustesse. Ce que les vétérans achètent se paie surtout en
  // AVRIL, et la mesure de saison ne le voit pas : la carte est donc réglée
  // un cheveu sous zéro en saison (+0,50 contre −0,65), et les séries sont le
  // reste.
  veterans: {
    nom: 'Les vétérans', ico: '🧭',
    bon: 'Plus robuste : les soirs éreintants et les séries', prix: 'Un peu moins de lancers',
    robustesse: 1.0, volume: 0.965,
  },
  // l'inverse, et le même déséquilibre à l'envers : un départ canon payé en
  // avril (+0,90 contre −0,80, plus ce que les séries prendront).
  jeunesse: {
    nom: 'La jeunesse', ico: '⚡',
    bon: 'Des jambes fraîches : plus de lancers', prix: 'Moins robuste quand ça brasse',
    volume: 1.04, robustesse: -1.0,
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
    bon: 'Tu prends moins de punitions', prix: 'Un peu moins de lancers',
    discipline: 0.85, volume: 0.965,
  },
  vague: {
    nom: 'La vague', ico: '🌊',
    bon: "L'attaque s'emballe : ça rentre plus souvent", prix: 'Le rythme se paie à l\'infirmerie',
    finition: 1.03, volume: 1.005, blessure: 2.20,
  },
  grandjeu: {
    nom: 'Le grand jeu', ico: '🎲',
    bon: 'Des matchs fous : tu marques beaucoup', prix: 'Et tu encaisses beaucoup',
    finition: 1.10, defense: 1.10,
  },
  chasse: {
    nom: 'La chasse', ico: '🏒',
    bon: 'Tu lances de partout', prix: 'De moins bonnes occasions',
    volume: 1.07, finition: 0.965,
  },
};

/* =====================================================================
   LE PLAN DE MATCH ET LE ROULEMENT — deux décisions qu'on porte toute
   la saison, et qu'on change quand on veut derrière le banc

   JP : *plus d'opportunités pour jouer avec les lignes, joueurs,
   stratégie*. Les cartes de saison (S54) sont des curseurs qu'on PIGE à
   trois paliers ; les situations (S56) ARRIVENT. Il manquait ce qu'un
   entraîneur DÉCIDE et assume tous les soirs : un style de jeu, et
   comment il distribue ses minutes.

   AUCUNE MÉCANIQUE NEUVE, la règle des cartes : chaque plan n'est qu'un
   facteur sur une quantité que `profilMatch` porte déjà — le volume de
   lancers, la finition, la défensive, la robustesse, l'indiscipline et
   le risque de blessure. Le ROULEMENT, lui, touche la seule quantité que
   rien d'autre ne touchait : LA PART DE GLACE DE CHAQUE UNITÉ. C'est ce
   qui fait du quatrième trio une décision au lieu d'un remplissage.

   ET LES DEUX SE REJOUENT. Ce sont des décisions (`{ jour, plan }`,
   `{ jour, roulement }`), elles vivent dans la sauvegarde avec le reste
   et la saison se rejoue de la graine avec elles — `check_graine.mjs`
   l'exige. La décision 0 les porte aussi, sinon un plan choisi au jour 40
   vaudrait pour les 40 journées d'avant à la reprise.
   ===================================================================== */
/*
 * LES CINQ PLANS, et le prix de chacun est mesuré EN PAIRES par
 * `scripts/check_plans.mjs` (la même ligue deux fois sous la même graine, le
 * plan aux équipes de rang pair puis aux impaires) : voir CLAUDE.md pour le
 * tableau. Aucun ne doit valoir plus d'une victoire et demie — un plan est un
 * STYLE, pas un cadeau, et le jeu se gagne avec l'alignement.
 */
export const PLANS = {
  equilibre: {
    nom: 'Équilibré', ico: '⚖️',
    bon: 'Rien à payer', prix: 'Rien à gagner',
  },
  echec: {
    nom: 'Échec avant', ico: '🔥',
    bon: 'Tu récupères haut : plus de lancers', prix: 'Plus de punitions et plus de blessures',
    volume: 1.06, discipline: 1.15, blessure: 1.20,
    apt: 'echec', gain: ['volume'],
  },
  trappe: {
    nom: 'La trappe', ico: '🧊',
    bon: 'Tu alloues moins de buts', prix: 'Tu tires moins',
    defense: 0.955, volume: 0.955,
    apt: 'trappe', gain: ['defense'],
  },
  surnombre: {
    nom: 'Tout en attaque', ico: '🎯',
    bon: 'Ton attaque finit mieux', prix: 'Tu laisses le champ libre',
    finition: 1.05, defense: 1.055,
    apt: 'surnombre', gain: ['finition'],
  },
  corps: {
    nom: 'Jouer le corps', ico: '🧱',
    bon: 'Plus robuste : les soirs éreintants et les séries', prix: 'Des punitions, et moins de finesse',
    robustesse: 1.2, discipline: 1.10, finition: 0.985,
    apt: 'corps', gain: ['robustesse'],
  },
};

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
    nom: 'Banc profond', ico: '🛡️',
    bon: 'Des jambes fraîches, et moins de blessures', prix: 'Tes meilleurs jouent moins',
    F: [0.92, 0.97, 1.05, 1.16], D: [0.94, 1.00, 1.11],
    robustesse: 0.9, blessure: 0.82,
  },
};

/** Le plan et le roulement d'une équipe, avec leur valeur par défaut. */
export const planDe = t => PLANS[(t && t.plan) || 'equilibre'] ? ((t && t.plan) || 'equilibre') : 'equilibre';
export const roulementDe = t => ROULEMENTS[(t && t.roulement) || 'quatre'] ? ((t && t.roulement) || 'quatre') : 'quatre';

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
  const sources = [...((team && team.cartes) || []).map(c => CARTES[c]),
    ROULEMENTS[roulementDe(team)], ...actifs,
    // Les factions aux extrêmes pèsent tant qu'elles y restent (voir JAUGES).
    ...(team && team.jourCourant !== Infinity ? effetsDeJauges(team.jauges) : [])];
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
export function partsDuRoulement(base, group, team) {
  const r = ROULEMENTS[roulementDe(team)];
  const mult = ((r && r[group]) || base.map(() => 1)).slice();
  // Un moment peut aussi déplacer les minutes (doubler le trio en feu,
  // brasser les trios) : ses multiplicateurs s'ajoutent à ceux du roulement,
  // et la renormalisation tient toujours la somme.
  for (const x of effetsActifs(team)) if (x[group]) x[group].forEach((m, i) => { mult[i] = (mult[i] ?? 1) * m; });
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

/* ---------- les profils ---------- */
export const PROFILS = {
  F: {
    fabricant: { nom: 'Fabricant de jeu', ico: '🪄', mot: 'ses passes par match' },
    franc: { nom: 'Franc-tireur', ico: '🎯', mot: 'son % de tir et ses lancers' },
    puissant: { nom: 'Puissant', ico: '🦍', mot: 'sa robustesse mesurée et son gabarit' },
    rapide: { nom: 'Rapide', ico: '⚡', mot: 'son volume de lancers, son petit gabarit, ⚡ Vitesse' },
    createur: { nom: 'Créatif', ico: '🎨', mot: 'ses passes ET sa finition' },
    defensif: { nom: 'Défensif', ico: '🧊', mot: 'sa défensive mesurée, 🛡️ Selke, 🔁' },
  },
  D: {
    pur: { nom: 'Défenseur pur', ico: '🧱', mot: 'sa défensive et sa robustesse mesurées, 🧱 Norris' },
    offensif: { nom: 'Offensif', ico: '🚀', mot: 'ses passes et ses lancers' },
    createur: { nom: 'Créatif', ico: '🎨', mot: 'ses passes par match' },
    bleue: { nom: 'Ligne bleue', ico: '💣', mot: 'son volume de lancers et sa finition, 💣 Lancer' },
    rapide: { nom: 'Rapide', ico: '⚡', mot: 'son petit gabarit, ses lancers, ⚡ Vitesse' },
  },
};
const estD = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');
/* Les trois colonnes brutes, SANS situation ni trait ni énergie : un profil
   est une propriété du joueur-saison, il ne bouge pas en cours de saison. */
function lancersBrut(p) {
  const base = seasonLancers(p.s)[estD(p) ? 3 : 2];
  const perso = (p.sh || 0) / Math.max(1, p.gp || 1);
  return perso && base ? borne(perso / base, 0.25, 2.6) : 1;
}
function tirBrut(p) {
  const ligue = seasonLancers(p.s)[1];
  return (p.sh || 0) >= 20 && ligue ? borne(100 * (p.g || 0) / p.sh / ligue, 0.35, 2.2) : 1;
}
/*
 * CENTRÉ PAR GROUPE, MESURÉ (`scripts/sonde_aptitudes.mjs`, sur les joueurs
 * de vraies équipes alignées) : [moyenne, écart type] de chaque colonne.
 */
export const PROFIL_REF = {
  F: { L: [1.14, 0.43], T: [1.17, 0.35], P: [1.19, 0.58] },
  D: { L: [1.10, 0.49], T: [0.58, 0.24], P: [1.16, 0.60] },
};
const cz = x => (x == null ? 0 : (x - 0.5) / 0.29);
const PROFILS_CACHE = new WeakMap();
/** Le % d'aptitude d'un patineur à chaque profil de son groupe (0-100). */
/*
 * Les profils d'un joueur, MUTATIONS comprises (S68) : un changement de carte
 * (le plombier qui apprend à tirer, la vedette forcée à défendre) déplace ses
 * profils pour le reste de la saison — donc le fit de sa ligne, donc sa chimie.
 */
export function profilsDe(p) {
  const base = profilsBase(p);
  if (!base || !p._mutProfils) return base;
  const out = { ...base };
  for (const [k, d] of Object.entries(p._mutProfils)) if (k in out) out[k] = Math.max(1, Math.min(99, out[k] + d));
  return out;
}
function profilsBase(p) {
  if (!p || p.p === 'G') return null;
  if (PROFILS_CACHE.has(p)) return PROFILS_CACHE.get(p);
  const g = estD(p) ? 'D' : 'F';
  const R = PROFIL_REF[g];
  const zL = (lancersBrut(p) - R.L[0]) / R.L[1];
  const zT = (tirBrut(p) - R.T[0]) / R.T[1];
  const zP = (passesRelatives(p) - R.P[0]) / R.P[1];
  const gb = p.gb == null ? 1 : Number(p.gb);
  const tr = new Set(getTraits(p).map(t => t.cle));
  const t = (...k) => (k.some(x => tr.has(x)) ? 1 : 0);
  const brut = g === 'F' ? {
    fabricant: zP + t('CREATEUR'),
    franc: 0.6 * zT + 0.4 * zL + t('TIR'),
    puissant: 0.7 * cz(p.mr) + 0.5 * (gb - 1) + t('COLOSSE'),
    rapide: 0.5 * zL + 0.5 * (1 - gb) + 1.2 * t('VITESSE'),
    createur: 0.5 * zP + 0.5 * zT,
    defensif: cz(p.md) + t('SELKE', 'BIDIR'),
  } : {
    pur: cz(p.md) + 0.3 * cz(p.mr) + t('NORRIS', 'BIDIR'),
    offensif: 0.5 * zP + 0.5 * zL,
    createur: zP,
    bleue: 0.6 * zL + 0.4 * zT + t('TIR'),
    rapide: 0.5 * (1 - gb) + 0.4 * zL + 1.2 * t('VITESSE'),
  };
  const out = {};
  for (const [k, s] of Object.entries(brut)) out[k] = Math.round(100 / (1 + Math.exp(-1.4 * borne(s, -3, 3))));
  PROFILS_CACHE.set(p, out);
  return out;
}
/* Le meilleur profil d'un joueur : ce que la carte affiche. */
export function profilPrincipal(p) {
  const pr = profilsDe(p);
  if (!pr) return null;
  const [cle, fit] = Object.entries(pr).sort((a, b) => b[1] - a[1])[0];
  return { cle, fit, ...(PROFILS[estD(p) ? 'D' : 'F'][cle]) };
}

/* ---------- les tactiques de ligne ---------- */
/*
 * SEPT TACTIQUES, et chacune en CONTRE une autre (`bat`) : jouée en défense,
 * elle étouffe les actions spéciales de celle-là. Le cycle est fermé, donc
 * aucune n'est la meilleure en soi — c'est le fit et la lecture de
 * l'adversaire qui décident. Les petites couleurs (`volume`, `finition`,
 * `defense`, `discipline`, `energie`) disent comment la ligne joue quand elle
 * ne réussit PAS son système ; elles sont petites exprès.
 */
export const TACTIQUES = {
  hourra: {
    nom: 'Hourra', ico: '🎲', bat: null, slots: null,
    mot: 'Pas de système : chacun joue d\'instinct. Rien à assortir, mais jamais de chimie ni d\'action spéciale.',
  },
  contre: {
    nom: 'Contre-attaques', ico: '⚡', bat: 'echec',
    slots: { AG: 'rapide', C: 'rapide', AD: 'franc', DG: 'pur', DD: 'pur' },
    mot: 'On laisse venir, on repart vite.', volume: 0.95, finition: 1.03,
  },
  echec: {
    nom: 'Échec avant', ico: '🔥', bat: 'bleue',
    slots: { AG: 'puissant', C: 'puissant', AD: 'rapide', DG: 'pur', DD: 'rapide' },
    mot: 'On va chercher la rondelle dans leur zone.', volume: 1.05, discipline: 1.1, energie: 1.05,
  },
  courtes: {
    nom: 'Passes courtes', ico: '🔁', bat: 'derriere',
    slots: { AG: 'createur', C: 'fabricant', AD: 'createur', DG: 'createur', DD: 'pur' },
    mot: 'On garde la rondelle et on fait tourner.', finition: 1.03, volume: 0.97,
  },
  defensive: {
    nom: 'Défensive', ico: '🧱', bat: 'courtes',
    slots: { AG: 'defensif', C: 'defensif', AD: 'puissant', DG: 'pur', DD: 'pur' },
    mot: 'D\'abord ne rien donner.', defense: 0.95, volume: 0.95,
  },
  bleue: {
    nom: 'Ligne bleue', ico: '💣', bat: 'defensive',
    slots: { AG: 'puissant', C: 'fabricant', AD: 'puissant', DG: 'bleue', DD: 'offensif' },
    mot: 'Les défenseurs tirent, les avants font écran et vont au rebond.', volume: 1.03, finition: 0.98,
  },
  derriere: {
    nom: 'Derrière le filet', ico: '🔄', bat: 'contre',
    slots: { AG: 'franc', C: 'fabricant', AD: 'franc', DG: 'offensif', DD: 'pur' },
    mot: 'On s\'installe derrière le but et on remet dans l\'enclave.', finition: 1.02,
  },
};
/* Qui contre qui : la tactique qui étouffe CELLE-CI. */
export const contreDe = cle => Object.keys(TACTIQUES).find(k => TACTIQUES[k].bat === cle) || null;

export const AGRESSIVITES = [
  { nom: 'Basse', ico: '🕊️', energie: 0.98, physique: 0.0, punitions: 0.75 },
  { nom: 'Moyenne', ico: '⚖️', energie: 1.00, physique: 0.4, punitions: 1.0 },
  { nom: 'Haute', ico: '💥', energie: 1.04, physique: 0.7, punitions: 1.3 },
  { nom: 'Rentre-dedans', ico: '🪓', energie: 1.09, physique: 0.9, punitions: 1.65 },
];
export const SEC_DEFAUT = 60, SEC_MIN = 30, SEC_MAX = 90;

/*
 * L'IMPORTANCE DU MATCH (S68), comme HockeyArena : un gros match fait jouer
 * plus fort, et ça se paie au moral du vestiaire et à l'infirmerie ; un match
 * pris à la légère repose les jambes et le moral, et se joue un cran en
 * dessous.
 */
export const IMPORTANCES = {
  basse: { nom: 'Basse', ico: '😌', mot: 'on se ménage', finition: 0.97, defense: 1.02, energie: 0.8, jauges: { vestiaire: 1 } },
  normale: { nom: 'Normale', ico: '🏒', mot: 'un match comme un autre' },
  haute: { nom: 'Haute', ico: '🔥', mot: 'on joue ça comme un match des séries', finition: 1.03, defense: 0.97, blessure: 1.25, energie: 1.12, jauges: { vestiaire: -1 } },
};

/* La ligne u : son trio, et sa paire (la quatrième ligne n'en a pas). */
export const pairDeLigne = u => (u < 3 ? u : null);
export function joueursDeLigne(lineup, u) {
  const out = {};
  for (const s of SLOTS) {
    if (s.scratch) continue;
    if ((s.group === 'F' && s.unit === u) || (s.group === 'D' && s.unit === pairDeLigne(u))) out[s.role] = lineup[s.i] || null;
  }
  return out;
}
/* Le fit d'une ligne à une tactique : la moyenne des % de profil demandés, poste par poste. */
export function fitLigne(lineup, u, tac) {
  const T = TACTIQUES[tac];
  if (!T || !T.slots) return 0;
  const js = joueursDeLigne(lineup, u);
  const fits = [];
  for (const [role, prof] of Object.entries(T.slots)) {
    const p = js[role];
    if (p === undefined) continue;          // la 4e ligne n'a pas de paire
    const pr = p && profilsDe(p);
    fits.push(pr && pr[prof] != null ? pr[prof] : 0);
  }
  return fits.length ? Math.round(fits.reduce((a, x) => a + x, 0) / fits.length) : 0;
}
/* La tactique où une ligne a le meilleur fit : ce que joue un club de l'IA. */
export function meilleureTactique(lineup, u) {
  let best = 'hourra', f = -1;
  for (const k of Object.keys(TACTIQUES)) {
    if (k === 'hourra') continue;
    const v = fitLigne(lineup, u, k);
    if (v > f) { f = v; best = k; }
  }
  return best;
}
/*
 * LES LIGNES D'UNE ÉQUIPE : { tac, agr, sec } × 4. Un club de l'IA joue la
 * tactique où chaque ligne a le meilleur fit, agressivité moyenne, glace par
 * défaut ; la tienne part pareil, et tu la changes quand tu veux.
 */
export function lignesDe(team, lineup) {
  const L = (team && team.lignes) || [];
  return [0, 1, 2, 3].map(u => {
    const l = L[u] || {};
    return {
      tac: TACTIQUES[l.tac] ? l.tac : (lineup ? meilleureTactique(lineup, u) : 'hourra'),
      agr: Number.isInteger(l.agr) && AGRESSIVITES[l.agr] ? l.agr : 1,
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
export const CHIMIE_PAS = 0.10, CHIMIE_CHANGE = 0.15, CHIMIE_DECLIN = 0.03;
/*
 * LE PLAFOND DE CHIMIE SUIT LE FIT, et il est RAIDE exprès : sous 35 % de fit
 * une ligne ne bâtit presque rien, à 60 % elle monte à 40, à 80 % à 72.
 * Plafonner au fit tel quel (38 % contre 65 %) ne valait que 0,6 victoire
 * d'écart entre mal et bien assortir : les profils ne se sentaient pas.
 */
export const chimieMax = fit => borne(1.6 * (fit - 35), 0, 100);
function sigLigne(lineup, u) {
  return Object.values(joueursDeLigne(lineup, u)).map(p => (p ? getPlayerKey(p) : '-'));
}
export function majChimie(team, lineup) {
  const lignes = lignesDe(team, lineup);
  team.chimie = team.chimie || [0, 0, 0, 0];
  team.chimieSig = team.chimieSig || [null, null, null, null];
  team.chimieTac = team.chimieTac || [null, null, null, null];
  for (let u = 0; u < 4; u++) {
    const sig = sigLigne(lineup, u);
    const avant = team.chimieSig[u];
    if (avant) {
      const changes = sig.filter((k, i) => k !== avant[i]).length;
      team.chimie[u] *= Math.max(0, 1 - CHIMIE_CHANGE * changes);
    }
    // Changer de système, c'est tout réapprendre à moitié.
    if (team.chimieTac[u] && team.chimieTac[u] !== lignes[u].tac) team.chimie[u] *= 0.5;
    const max = lignes[u].tac === 'hourra' ? 0 : chimieMax(fitLigne(lineup, u, lignes[u].tac));
    const c = team.chimie[u];
    team.chimie[u] = c > max ? Math.max(max, c * (1 - CHIMIE_DECLIN)) : c + (max - c) * CHIMIE_PAS;
    team.chimieSig[u] = sig;
    team.chimieTac[u] = lignes[u].tac;
  }
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
export const SPEC_BASE = 0.45, SPEC_MULT = 1.8, SPEC_NORME = 0.88;

/* ---------- l'énergie ---------- */
/*
 * Par joueur, de 0 à 100, sur toute la saison. Un match coûte `ENERGIE_R` ×
 * l'usure de sa ligne (ses secondes de présence, son agressivité, sa
 * tactique) ; chaque journée rend `ENERGIE_R` × (2 − énergie/100), donc à
 * usure normale on reste à 100, et à usure 1,2 on se stabilise vers 80. Un
 * joueur usé rend moins (la moitié de ce qui lui manque) et, sous 60, se
 * blesse plus.
 */
export const ENERGIE_R = 18, ENERGIE_EFFET = 0.5, ENERGIE_BLESSURE = 60;
export const energieDe = p => (p && Number.isFinite(p.energie) ? p.energie : 100);
export const facteurEnergie = p => 1 - ENERGIE_EFFET * (1 - energieDe(p) / 100);
/* L'usure d'une ligne par match : 1 à la glace et à l'agressivité par défaut. */
export function usureLigne(l, sParts) {
  const T = TACTIQUES[l.tac] || {};
  return (l.sec / sParts) * AGRESSIVITES[l.agr].energie * (T.energie || 1);
}
export function depenserEnergie(team, lineup) {
  const lignes = lignesDe(team, lineup);
  const moy = lignes.reduce((a, l) => a + l.sec, 0) / 4 || SEC_DEFAUT;
  // L'importance du match (et tout effet qui porte `energie`) module l'usure.
  const k = effetsActifs(team).reduce((a, x) => a * (x.energie || 1), 1);
  for (let u = 0; u < 4; u++) {
    const us = usureLigne(lignes[u], moy) * k;
    for (const p of Object.values(joueursDeLigne(lineup, u))) if (p) p.energie = Math.max(0, energieDe(p) - ENERGIE_R * us);
  }
}
export function recupererEnergie(team) {
  for (const s of SLOTS) {
    const p = team.roster[s.i];
    if (p) p.energie = Math.min(100, energieDe(p) + ENERGIE_R * (2 - energieDe(p) / 100));
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
  if (j === undefined || j === null || !team.effets || !team.effets.length) return [];
  return team.effets.filter(x => j >= x.debut && j < x.fin);
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
/* La lecture parfaite : le bon contre-plan, ce soir-là. */
export const CONTRE_PLAN = { finition: 1.04, defense: 0.96 };
const STYLE_SEUIL = 0.35;

export function poserStyles(teams) {
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
export const DUREE_MOMENT = 10;
export const MOMENTS = {
  pieuvre: {
    ico: '🐙', titre: 'Une pieuvre sur la glace', irl: 'Detroit, 1952',
    recit: 'Un partisan lance une pieuvre sur la glace après ton but. L\'aréna devient fou.',
    options: [
      { cle: 'tradition', nom: 'En faire une tradition', bon: 'La foule pousse : plus de lancers', prix: 'Les arbitres s\'impatientent', volume: 1.07, discipline: 1.25, jauges: {partisans:2,medias:1,proprio:-1} },
      { cle: 'calme', nom: 'Demander le calme', bon: 'Moins de punitions', prix: 'L\'élan retombe', discipline: 0.88, volume: 0.96, jauges: {proprio:1,partisans:-2} },
    ],
  },
  rats: {
    ico: '🐀', titre: 'Le rat du vestiaire', irl: 'Floride, 1996',
    recit: 'Ton ailier écrase un rat dans le vestiaire avant le match, puis marque deux buts. Les partisans lancent des rats en plastique.',
    options: [
      { cle: 'mascotte', nom: 'Adopter la mascotte', bon: 'Ça rentre de partout', prix: 'La glace est jonchée de rats : punitions pour retard', finition: 1.1, discipline: 1.3, jauges: {partisans:2,vestiaire:1,medias:-1} },
      { cle: 'serieux', nom: 'Rester sérieux', bon: 'Défensive concentrée', prix: 'On s\'ennuie un peu', defense: 0.94, finition: 0.95, jauges: {proprio:1,partisans:-1} },
    ],
  },
  dernier: {
    ico: '🧳', titre: '« C\'est mon dernier match ici »', irl: 'Montréal, 1995',
    recit: 'Laissé devant le filet pour neuf buts, ton gardien partant passe devant le banc et lance au président qu\'il a joué son dernier match ici.',
    options: [
      { cle: 'soutenir', nom: 'Le soutenir publiquement', bon: 'Il se calme : la défensive tient', prix: 'Le vestiaire trouve que tu plies', defense: 0.93, volume: 0.95, jauges: {vestiaire:-2,medias:1} },
      { cle: 'mijoter', nom: 'Le laisser mijoter', bon: 'Les patineurs se serrent les coudes', prix: 'Derrière eux, ça coule', finition: 1.08, defense: 1.08, jauges: {vestiaire:2,medias:-2,proprio:-1} },
    ],
  },
  tropdejoueurs: {
    ico: '🧢', titre: 'Trop de joueurs sur la glace', irl: 'Boston, 1979',
    recit: 'Ton banc s\'emmêle dans un changement et six patineurs sautent sur la glace dans les dernières minutes.',
    options: [
      { cle: 'simplifier', nom: 'Simplifier les changements', bon: 'Plus de fautes bêtes', prix: 'Des présences plus longues, moins de jus', discipline: 0.85, volume: 0.95, jauges: {medias:1,vestiaire:-1} },
      { cle: 'rythme', nom: 'Garder le rythme rapide', bon: 'Des jambes fraîches, plus de lancers', prix: 'Ça va se reproduire', volume: 1.06, discipline: 1.15, jauges: {vestiaire:1,medias:-1} },
    ],
  },
  zamboni: {
    ico: '🚜', titre: 'Le conducteur de surfaceuse', irl: 'Toronto, 2020',
    recit: 'Tes deux gardiens se blessent le même soir. Le gardien d\'urgence est le conducteur de la surfaceuse, 42 ans.',
    options: [
      { cle: 'legende', nom: 'Le faire jouer, pour la légende', bon: 'L\'euphorie : tout le monde attaque', prix: 'Derrière, c\'est la loterie', finition: 1.08, defense: 1.1, duree: 5, jauges: {partisans:2,medias:2,proprio:-1} },
      { cle: 'serrer', nom: 'Jouer serré devant lui', bon: 'Personne ne tire sur ton filet', prix: 'Ton attaque s\'éteint', defense: 0.94, volume: 0.92, duree: 5, jauges: {proprio:1,partisans:-1} },
    ],
  },
  richard: {
    ico: '🔥', titre: 'La ville gronde', irl: 'Montréal, 1955',
    recit: 'Ta vedette écope d\'une suspension que la ville juge injuste. Des partisans promettent de descendre dans la rue.',
    options: [
      { cle: 'defendre', nom: 'Défendre ton joueur', bon: 'Le vestiaire joue pour lui : plus robuste', prix: 'Plus de punitions', robustesse: 1.5, discipline: 1.25, jauges: {vestiaire:2,partisans:2,medias:-2,proprio:-1} },
      { cle: 'calme', nom: 'Appeler au calme', bon: 'Discipline de fer', prix: 'Le feu s\'éteint', discipline: 0.88, volume: 0.95, jauges: {proprio:2,partisans:-2} },
    ],
  },
  malarchuk: {
    ico: '🕯️', titre: 'Un accident terrible', irl: 'Buffalo, 1989',
    recit: 'Un patin tranche la gorge d\'un gardien pendant le match. Il survit grâce au soigneur, mais les deux vestiaires sont sous le choc.',
    options: [
      { cle: 'temps', nom: 'Prendre le temps', bon: 'On se ménage : moins de blessures', prix: 'Les têtes sont ailleurs', blessure: 0.5, volume: 0.94, jauges: {vestiaire:2,proprio:-1} },
      { cle: 'pourlui', nom: 'Retourner au jeu, pour lui', bon: 'Le vestiaire se soude', prix: 'On joue sur les nerfs', finition: 1.06, blessure: 1.5, discipline: 1.15, jauges: {partisans:2,vestiaire:1,medias:1} },
    ],
  },
  lemieux: {
    ico: '💪', titre: 'Le traitement du matin', irl: 'Pittsburgh, 1993',
    recit: 'Ta vedette termine sa dernière séance de radiothérapie ce matin. Il veut jouer ce soir.',
    options: [
      { cle: 'jouer', nom: 'Le laisser jouer', bon: 'Une ovation, et ça rentre', prix: 'Il n\'est pas à 100 %', finition: 1.1, blessure: 1.8, jauges: {partisans:2,medias:1} },
      { cle: 'menager', nom: 'Le ménager', bon: 'Tout le monde en santé', prix: 'On attend son retour', blessure: 0.6, finition: 0.94, jauges: {vestiaire:1,medias:-1} },
    ],
  },
  echange: {
    ico: '📞', titre: 'Les rumeurs d\'échange', irl: 'Edmonton, 1988',
    recit: 'Un journaliste annonce que ta vedette va être échangée à Los Angeles. Il n\'en sait rien.',
    options: [
      { cle: 'dementir', nom: 'Démentir en conférence', bon: 'Le vestiaire respire', prix: 'Personne ne te croit vraiment', defense: 0.95, volume: 0.96, jauges: {vestiaire:1,medias:-2} },
      { cle: 'planer', nom: 'Laisser planer', bon: 'Tout le monde joue pour son poste', prix: 'La chimie en prend un coup', volume: 1.08, finition: 0.94, jauges: {proprio:1,vestiaire:-2,medias:2} },
    ],
  },
  hextall: {
    ico: '🥅', titre: 'Le gardien veut marquer', irl: 'Philadelphie, 1987',
    recit: 'Ton gardien est convaincu qu\'il peut marquer dans le filet désert. Il sort jouer la rondelle à chaque occasion.',
    options: [
      { cle: 'laisser', nom: 'Le laisser faire', bon: 'Des relances éclair', prix: 'Des rondelles perdues derrière le filet', finition: 1.06, defense: 1.07, jauges: {partisans:2,proprio:-1} },
      { cle: 'filet', nom: 'Qu\'il reste dans son filet', bon: 'Il se concentre', prix: 'Les relances ralentissent', defense: 0.95, volume: 0.96, jauges: {proprio:1,vestiaire:-1} },
    ],
  },
  avery: {
    ico: '🎭', titre: 'L\'agitateur', irl: 'New York, 2008',
    recit: 'Ton agitateur se plante devant le gardien adverse, dos au jeu, et agite son bâton devant son masque. La ligue écrit une règle le lendemain.',
    options: [
      { cle: 'laisser', nom: 'Le laisser faire', bon: 'Le gardien adverse perd la tête', prix: 'L\'arbitre aussi', finition: 1.08, discipline: 1.35, jauges: {partisans:1,medias:2,proprio:-2} },
      { cle: 'rappeler', nom: 'Le rappeler à l\'ordre', bon: 'On reste propre', prix: 'On perd un peu de mordant', discipline: 0.88, finition: 0.96, jauges: {proprio:1,vestiaire:-1} },
    ],
  },
  commotion: {
    ico: '🤕', titre: 'Un coup à la tête', irl: 'Pittsburgh, 2011',
    recit: 'Ta vedette a pris deux coups à la tête en quatre jours. Il dit qu\'il se sent bien.',
    options: [
      { cle: 'menager', nom: 'Protocole complet', bon: 'Personne ne joue blessé', prix: 'L\'attaque perd sa bougie', blessure: 0.55, finition: 0.94, jauges: {vestiaire:1,medias:1,partisans:-1} },
      { cle: 'jouer', nom: 'Il veut jouer', bon: 'Il garde le rythme', prix: 'Le risque est réel', finition: 1.05, blessure: 1.9, jauges: {partisans:1,medias:-2} },
    ],
  },
  tortorella: {
    ico: '🎙️', titre: 'Le coach pète une coche', irl: 'Inspiré de plusieurs points de presse',
    recit: 'Ton entraîneur insulte un journaliste en direct et promet que « ça va changer ». La vidéo fait le tour du continent.',
    options: [
      { cle: 'appuyer', nom: 'L\'appuyer', bon: 'Les gars sortent en feu', prix: 'Et en punition', volume: 1.07, discipline: 1.25, jauges: {vestiaire:1,medias:-2,partisans:1} },
      { cle: 'recadrer', nom: 'Le recadrer', bon: 'On revient à la structure', prix: 'Le vestiaire est tiède', defense: 0.95, volume: 0.95, jauges: {proprio:1,medias:1,vestiaire:-1} },
    ],
  },
  tempete: {
    ico: '🌨️', titre: 'La tempête de neige', irl: 'Buffalo, 2014',
    recit: 'Deux mètres de neige. L\'avion ne décolle pas, et le match est dans deux jours à l\'autre bout du continent.',
    options: [
      { cle: 'autobus', nom: 'Seize heures d\'autobus', bon: 'On se forge le caractère', prix: 'Les jambes sont lourdes', robustesse: 1.4, volume: 0.93, jauges: {vestiaire:2,proprio:1} },
      { cle: 'attendre', nom: 'Attendre l\'avion', bon: 'On arrive reposés', prix: 'À la dernière minute, sans réchauffement', blessure: 1.4, defense: 0.96, jauges: {proprio:-1,medias:1} },
    ],
  },
  barbe: {
    ico: '🧔', titre: 'La barbe porte-bonheur', irl: null,
    recit: 'Les vétérans refusent de se raser tant que la séquence dure. Le capitaine a l\'air d\'un trappeur.',
    options: [
      { cle: 'pousser', nom: 'Laisser pousser', bon: 'On se sent invincibles', prix: 'On se croit plus beaux qu\'on l\'est', robustesse: 1.3, finition: 0.96, jauges: {vestiaire:2,medias:1} },
      { cle: 'raser', nom: 'Rasage obligatoire', bon: 'Frais et rapides', prix: 'Les vétérans boudent', finition: 1.04, robustesse: -1.0, jauges: {proprio:1,vestiaire:-2} },
    ],
  },
  film: {
    ico: '🎬', titre: 'Un film dans ton aréna', irl: null,
    recit: 'Un studio veut tourner une comédie de hockey dans ton aréna. Les caméras suivraient l\'équipe pendant dix jours.',
    options: [
      { cle: 'accepter', nom: 'Accepter', bon: 'Les gars jouent pour la caméra : ça attaque', prix: 'Ça oublie de revenir', volume: 1.06, defense: 1.06, jauges: {proprio:2,medias:2,vestiaire:-1} },
      { cle: 'refuser', nom: 'Refuser', bon: 'Un vestiaire tranquille', prix: 'Le proprio est déçu', defense: 0.96, finition: 0.97, jauges: {vestiaire:1,proprio:-2} },
    ],
  },
  baton: {
    ico: '🏒', titre: 'Le bâton maudit', irl: null,
    recit: 'Ton franc-tireur jure que son nouveau modèle de bâton lui porte malheur. Il a trois buts en vingt matchs.',
    options: [
      { cle: 'ancien', nom: 'Ressortir les vieux bâtons', bon: 'La confiance revient', prix: 'Des bâtons qui cassent : blessures', finition: 1.07, blessure: 1.4, jauges: {vestiaire:1,proprio:-1} },
      { cle: 'travail', nom: 'Le travail, pas la magie', bon: 'On lance plus', prix: 'Ça ne rentre pas plus', volume: 1.05, finition: 0.96, jauges: {proprio:1,medias:-1} },
    ],
  },
  poutine: {
    ico: '🍟', titre: 'La poutine d\'après-match', irl: null,
    recit: 'Un restaurateur offre la poutine à vie à l\'équipe. Les gars y vont tous les soirs.',
    options: [
      { cle: 'fete', nom: 'Laisser faire', bon: 'Le moral est au plafond', prix: 'Les jambes, moins', finition: 1.05, volume: 0.94, jauges: {vestiaire:2,partisans:1,proprio:-1} },
      { cle: 'diete', nom: 'Diète de séries', bon: 'Des jambes neuves', prix: 'Le moral en prend un coup', volume: 1.05, finition: 0.95, jauges: {proprio:1,vestiaire:-2} },
    ],
  },
  /*
   * LES DILEMMES QUI CHANGENT UNE CARTE (S68). Le joueur visé est nommé avant
   * le choix (`{nom}` dans le texte, résolu par `cibleMutation`), et l'option
   * qui porte `mutation` le change pour le reste de la saison.
   */
  camp: {
    ico: '🏕️', titre: 'Le camp de mi-saison', irl: null,
    recit: 'La pause du Match des étoiles : trois jours d\'entraînement. Qui travaille quoi?',
    options: [
      { cle: 'gun', nom: 'Envoyer {nom} tirer du gun', mutation: 'tir_gun', bon: 'Ton plombier apprend à viser', prix: 'Trois jours sans repos pour les autres', blessure: 1.15, jauges: { vestiaire: 1 } },
      { cle: 'repos', nom: 'Repos pour tout le monde', bon: 'Des jambes neuves', prix: 'Rien de neuf dans le jeu', blessure: 0.6, jauges: { vestiaire: 1, proprio: -1 } },
    ],
  },
  lame: {
    ico: '🏒', titre: 'La lame qui ne se fait plus', irl: null,
    recit: 'Le fabricant arrête le modèle de lame de {nom}. Rien d\'autre ne lui convient : il ne sent plus sa rondelle.',
    options: [
      { cle: 'defensif', nom: 'En faire un joueur défensif', mutation: 'lame', bon: 'Il devient fiable sans la rondelle', prix: 'Ton meilleur tireur ne marquera plus', jauges: { medias: -1 } },
      { cle: 'marche', nom: 'Chercher la lame au marché noir', bon: 'Il reste lui-même', prix: 'Des lames refaites à la main : ça casse', finition: 0.95, jauges: { proprio: -2 } },
    ],
  },
  patinage: {
    ico: '⛸️', titre: 'L\'entraîneur de patinage', irl: null,
    recit: 'Une ancienne patineuse olympique offre ses services pour la saison. Elle ne prend qu\'un élève : {nom}.',
    options: [
      { cle: 'oui', nom: 'Oui, pour {nom}', mutation: 'patin', bon: 'Il arrivera avant la rondelle', prix: 'Ça coûte cher au proprio', jauges: { proprio: -1, medias: 1 } },
      { cle: 'non', nom: 'Non merci', bon: 'Le proprio garde son argent', prix: 'Rien ne change', jauges: { proprio: 1 } },
    ],
  },
  cassettes: {
    ico: '📼', titre: 'Les cassettes de Gretzky', irl: null,
    recit: '{nom} a trouvé une boîte de vieilles cassettes dans le sous-sol de l\'aréna. Il veut passer ses soirées à les étudier.',
    options: [
      { cle: 'etudier', nom: 'Qu\'il étudie', mutation: 'video', bon: 'Il verra le jeu une passe d\'avance', prix: 'Il tirera moins lui-même', jauges: { vestiaire: 1 } },
      { cle: 'dormir', nom: 'Qu\'il dorme', bon: 'Frais pour le prochain match', prix: 'Le vestiaire le trouve paresseux', volume: 1.03, jauges: { vestiaire: -1 } },
    ],
  },
  pointe: {
    ico: '💣', titre: 'La pointe de l\'avantage', irl: null,
    recit: '{nom} demande sa chance à la ligne bleue en avantage numérique. Il jure qu\'il a un canon.',
    options: [
      { cle: 'chance', nom: 'Lui donner la pointe', mutation: 'pointe', bon: 'Un défenseur qui décoche', prix: 'Un autre perd sa place et boude', jauges: { vestiaire: -1, medias: 1 } },
      { cle: 'attendre', nom: 'Qu\'il attende son tour', bon: 'La hiérarchie tient', prix: 'Il ronge son frein', jauges: { vestiaire: 1 } },
    ],
  },
  ecole: {
    ico: '🧓', titre: 'L\'école du vétéran', irl: null,
    recit: 'Ton vieux défenseur prend sa retraite dans deux ans. Il propose de prendre {nom} sous son aile.',
    options: [
      { cle: 'oui', nom: 'Qu\'il lui apprenne à défendre', mutation: 'dur', bon: '{nom} ne montera plus, il bloquera', prix: 'Moins de relance', jauges: { vestiaire: 2 } },
      { cle: 'non', nom: '{nom} garde son style', bon: 'La relance reste', prix: 'Le vétéran se sent inutile', jauges: { vestiaire: -1 } },
    ],
  },
};
export const JOURS_MOMENTS = [14, 25, 33, 51, 60, 70];
/* Le dilemme d'une journée : PUR, graine et jour, jamais deux fois le même. */
export function momentDuJour(graine, jour, deja = []) {
  const cles = Object.keys(MOMENTS).filter(c => !deja.includes(c));
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
      { cle: 'brasser', nom: 'Brasser les trios', bon: 'Le choc : tout le monde se réveille', prix: 'Les automatismes disparaissent', F: [0.9, 1.05, 1.08, 1.05], volume: 1.06, finition: 0.97, jauges: {medias:1,vestiaire:-1} },
      { cle: 'cap', nom: 'Garder le cap', bon: 'La structure revient', prix: 'Rien ne change en attaque', defense: 0.95, volume: 0.97, jauges: {vestiaire:1,medias:-1,partisans:-1} },
      { cle: 'huis', nom: 'Pratique à huis clos', bon: 'Les jambes, les jambes, les jambes', prix: 'Des corps fatigués', robustesse: 1.3, blessure: 1.35, jauges: {proprio:1,vestiaire:-1} },
    ],
  },
  victoires: {
    ico: '🔥', titre: 'Quatre victoires de suite', seuil: 4,
    recit: 'Tout roule. Ton premier trio ne rate plus rien.',
    options: [
      { cle: 'doubler', nom: 'Doubler le trio en feu', bon: 'Ton premier trio joue encore plus', prix: 'Il s\'use, et le 4e rouille', F: [1.25, 1.02, 0.95, 0.72], blessure: 1.3, jauges: {partisans:1,vestiaire:-1} },
      { cle: 'humble', nom: 'Rester humble', bon: 'On ne relâche rien derrière', prix: 'On lève un peu le pied devant', defense: 0.95, volume: 0.97, jauges: {medias:1,proprio:1} },
      { cle: 'tous', nom: 'Tout le monde joue', bon: 'Le 4e trio goûte au succès', prix: 'Tes vedettes jouent moins', F: [0.9, 0.97, 1.05, 1.2], D: [0.95, 1, 1.08], blessure: 0.8, jauges: {vestiaire:2,partisans:-1} },
    ],
  },
};
export const DUREE_SEQUENCE = 8;
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
export const OBJECTIFS = {
  victoires: { ico: '🏆', nom: 'Gagne 11 de tes 20 prochains matchs', court: '11 victoires sur 20',
    mesure: m => m.filter(x => x.v).length, cible: 11, sens: 1, unite: 'victoires' },
  brigade: { ico: '🧱', nom: 'Accorde 58 buts ou moins en 20 matchs', court: '58 BC ou moins',
    mesure: m => m.reduce((a, x) => a + x.contre, 0), cible: 58, sens: -1, unite: 'buts contre' },
  attaque: { ico: '🎯', nom: 'Marque 64 buts ou plus en 20 matchs', court: '64 BP ou plus',
    mesure: m => m.reduce((a, x) => a + x.pour, 0), cible: 64, sens: 1, unite: 'buts pour' },
  sequence: { ico: '🔥', nom: 'Aligne 4 victoires de suite', court: '4 victoires de suite',
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

/*
 * LES JAUGES (S66). JP : *pense à des jeux comme New Star GP, New Star Soccer,
 * Slay the Spire, les jeux de politique*. Quatre factions qu'on ne peut pas
 * toutes contenter : le proprio, le vestiaire, les partisans, les médias.
 * Chaque choix les bouge ; tout en haut ou tout en bas, une faction pèse sur
 * le jeu tant qu'elle y reste. Elles ne bougent QUE par des décisions (les
 * options des dilemmes et des séquences, le verdict d'un objectif), donc elles
 * se rejouent de la graine comme le reste — l'écran et le moteur les
 * calculent de la même liste.
 */
export const JAUGE_DEPART = 5, JAUGE_MAX = 10, JAUGE_HAUT = 8, JAUGE_BAS = 2;
export const JAUGES = {
  proprio: {
    nom: 'Proprio', ico: '🏢',
    haut: { nom: 'Le proprio sourit', mot: 'Les meilleurs soins : moins de blessures', blessure: 0.8 },
    bas: { nom: 'Siège éjectable', mot: 'Tout le monde joue crispé', finition: 0.975, discipline: 1.06 },
  },
  vestiaire: {
    nom: 'Vestiaire', ico: '🧑‍🤝‍🧑',
    haut: { nom: 'Vestiaire soudé', mot: 'Les passes arrivent : ça rentre', finition: 1.04 },
    bas: { nom: 'Vestiaire divisé', mot: 'Chacun pour soi derrière', defense: 1.05 },
  },
  partisans: {
    nom: 'Partisans', ico: '📣',
    haut: { nom: 'L\'aréna en feu', mot: 'La foule pousse : plus de lancers', volume: 1.04 },
    bas: { nom: 'Les huées', mot: 'On joue petit', volume: 0.96 },
  },
  medias: {
    nom: 'Médias', ico: '🎙️',
    haut: { nom: 'Lune de miel', mot: 'La pression tombe : moins de punitions', discipline: 0.88 },
    bas: { nom: 'Sous la loupe', mot: 'Chaque geste est jugé : plus robuste, plus puni', robustesse: 0.8, discipline: 1.12 },
  },
};
export const jaugesNeuves = () => Object.fromEntries(Object.keys(JAUGES).map(k => [k, JAUGE_DEPART]));
/* Les deltas qu'une décision porte : ceux de l'option choisie, et ceux qu'elle écrit. */
export function jaugesDeDecision(d) {
  const out = {};
  const add = j => { for (const [k, v] of Object.entries(j || {})) if (JAUGES[k]) out[k] = (out[k] || 0) + v; };
  if (d.moment) {
    const fam = d.moment.famille === 'sequence' ? SEQUENCES[d.moment.cle] : MOMENTS[d.moment.cle];
    const o = fam && fam.options.find(x => x.cle === d.moment.choix);
    if (o) add(o.jauges);
  }
  add(d.jauges);
  if (d.match && IMPORTANCES[d.match.importance]) add(IMPORTANCES[d.match.importance].jauges);
  return out;
}
export function bougerJauges(j, deltas) {
  for (const [k, v] of Object.entries(deltas)) j[k] = Math.max(0, Math.min(JAUGE_MAX, (j[k] ?? JAUGE_DEPART) + v));
  return j;
}
/* Les jauges après une liste de décisions, jusqu'au jour `jour` compris. */
export function jaugesApres(decisions, jour = Infinity) {
  const j = jaugesNeuves();
  for (const d of decisions || []) if ((d.equipe || 0) === 0 && d.jour <= jour) bougerJauges(j, jaugesDeDecision(d));
  return j;
}
/* Ce que les jauges font au jeu, en ce moment : une entrée par faction aux extrêmes. */
export function effetsDeJauges(j) {
  if (!j) return [];
  const out = [];
  for (const [k, def] of Object.entries(JAUGES)) {
    const v = j[k] ?? JAUGE_DEPART;
    if (v >= JAUGE_HAUT) out.push({ faction: k, sens: 'haut', ...def.haut });
    else if (v <= JAUGE_BAS) out.push({ faction: k, sens: 'bas', ...def.bas });
  }
  return out;
}

/*
 * LA DÉCISION D'UN MOMENT → l'effet posé sur l'équipe. Un seul endroit
 * traduit, pour que le moteur, l'écran et la mesure lisent la même chose.
 */
export function effetDeMoment(d) {
  // LA CONSIGNE DU MATCH (S68) : l'importance et la répartition attaque /
  // défense, pour UN match.
  if (d.match) {
    const I = IMPORTANCES[d.match.importance] || IMPORTANCES.normale;
    const ad = borne(Number(d.match.ad) || 0, -2, 2);
    return { debut: d.jour, fin: d.jour + 1, source: 'match', match: true,
      finition: (I.finition || 1) * (1 + 0.025 * ad), defense: (I.defense || 1) * (1 + 0.02 * ad),
      blessure: I.blessure || 1, energie: I.energie || 1 };
  }
  const m = d.moment;
  if (!m) return null;
  const fam = m.famille === 'sequence' ? SEQUENCES[m.cle] : MOMENTS[m.cle];
  const o = fam && fam.options.find(x => x.cle === m.choix);
  if (!o) return null;
  const duree = o.duree || (m.famille === 'sequence' ? DUREE_SEQUENCE : DUREE_MOMENT);
  const { cle, nom, bon, prix, duree: _d, jauges: _j, mutation: _m, ...canaux } = o;
  void cle; void nom; void bon; void prix; void _d; void _j; void _m;
  return { debut: d.jour, fin: d.jour + duree, source: m.famille || 'moment', ...canaux };
}

/*
 * LES TROIS CARTES OFFERTES À UN PALIER. Tirées de la GRAINE et du jour, sans
 * toucher à `hasard()` : le moteur ne doit pas consommer une seule valeur de
 * plus à cause de l'écran, sinon la même graine ne rejouerait plus la même
 * saison. Deux paliers d'une même partie n'offrent donc pas la même main, et
 * la même partie rejouée offre exactement la même.
 */
export const PALIERS_CARTES = [20, 40, 60];
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
export const ECHELLE_PORTE = Number(ENV_MESURE.ECHELLE_PORTE ?? 1);
export const ECHELLE_PESE = Number(ENV_MESURE.ECHELLE_PESE ?? 1);

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
function poserSituations(team, graine, jour, equipe) {
  const paire = situationsDuJour(team, graine, jour, equipe);
  if (!paire) return;
  for (const s of SLOTS) { const p = team.roster[s.i]; if (p) delete p._situ; }
  for (const bout of [paire.porte, paire.pese]) {
    const c = SITUATIONS[bout.cle];
    const k = c.sens > 0 ? ECHELLE_PORTE : ECHELLE_PESE;
    const ech = f => 1 + ((f ?? 1) - 1) * k;
    bout.p._situ = {
      lancers: ech(c.lancers), finition: ech(c.finition),
      creation: ech(c.creation), gardien: ech(c.gardien), blessure: ech(c.blessure),
    };
  }
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
export const BETA_CREATION = 0.5;

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
export const K_DEFENSE = 0.050;   // le haut de l'intervalle mesuré : voir ROBUSTESSE ci-dessous, et check_builds.mjs

/*
 * LA DÉFENSIVE AGIT AUSSI, UN PEU, SUR LE VOLUME. `check_suppression.mjs` a
 * mesuré −0,17 de corrélation entre la cote défensive d'un alignement et les
 * lancers concédés : faible, mais pas nulle, et on l'avait arrondie à zéro.
 * L'écart-type des lancers contre entre équipes est d'environ 7 % ; −0,17 ×
 * 7 % donne 1,2 % de lancers en moins par écart-type de brigade. C'est ce que
 * la mesure autorise, pas plus : la qualité reste le canal principal.
 */
export const K_VOLUME_DEF = 0.012;

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
 */
export const K_ROB = 0.07;
export const ROB_SERIES = 0.15;
export const ROB_BLESSURE = 0.35;
export const MOY_ROB_EQUIPE = 48.1;
export const ECART_ROB_EQUIPE = 2.4;
// Les colosses (js/traits.js) ajoutent leur poids, en écarts-types, dans leurs grosses saisons.
const robZ = t => (t && t.rob != null ? borne((t.rob - MOY_ROB_EQUIPE) / ECART_ROB_EQUIPE + (t.traitRob || 0), -3, 3) : 0);

/** Cote défensive d'équipe : moyenne et écart-type des 1392 équipes-saisons. */
export const MOY_DEF_EQUIPE = 57.6;
export const ECART_DEF_EQUIPE = 4.3;

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
export const SYN_ECHELLE = 42;

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
export const PCT_TIR_NEUTRE = 0.965;

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
export const PCT_TIR_MAX = 0.35;

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
export const AVANTAGES_EPOQUE = [
  [1970, 3.8], [1977, 4.0], [1980, 4.25], [1985, 4.63], [1990, 4.57], [1995, 5.04],
  [2000, 4.59], [2005, 5.85], [2010, 3.54], [2015, 3.11], [2020, 2.89], [2026, 2.88],
];
/**
 * Les occasions d'avantage d'un joueur-saison : mesurées dans sa saison
 * (colonne [9] de SEASON_LANCERS, posée par build_lancers.mjs depuis le bloc
 * `an` des shards) quand elles existent, sinon le repère d'époque.
 */
export function occasionsDe(p) {
  const mesure = seasonLancers(p && p.s)[9];
  if (mesure > 0) return mesure;
  return occasionsEpoque(parseInt((p && p.s || '').slice(0, 4), 10) || null);
}
export function occasionsEpoque(annee) {
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
export const AN_MINUTES = 2;          // une mineure
export const AN_TIRS_MIN = 0.60;      // lancers par minute de l'équipe en avantage (fenêtre de deux minutes, coupée par le but)
export const DN_TIRS_MIN = 0.09;      // lancers par minute de l'équipe en désavantage
export const AN_QUALITE = 1.35;       // réglé sur la mesure : part des buts d'avantage simulée = réelle (26,5 %) chez les mêmes joueurs (check_feuilles)
export const DN_QUALITE = 1.00;       // finition en désavantage
export const FE_TIRS = 1.20;          // le cinq contre cinq, réglé sur la sortie
export const FE_QUALITE = 1.03;       // idem, sur la finition
/*
 * La part des lancers d'un joueur d'avantage numérique qui vient de
 * l'avantage. Son volume réel (`sh` par match) la contient déjà : à forces
 * égales il ne doit garder que le reste, sinon il tire deux fois — mesuré,
 * Bondra 2001-02 faisait 93 buts au lieu de 46. Repère public : un joueur
 * de première unité prend le quart à la moitié de ses tirs en avantage.
 */
export const PART_AN_TIRS = [0.35, 0.15];   // première unité, deuxième unité
export const POIDS_AN = [0.65, 0.35];        // part du temps d'avantage de chaque unité
export const POIDS_DN = [0.60, 0.40];
export const PART_LANCERS_D_AN = 0.38;       // en avantage, la pointe tire plus (Lidström) — repère public
export const DISCIPLINE_MIN = 0.5;    // bornes de l'indiscipline d'un alignement
export const DISCIPLINE_MAX = 1.8;

/** Période d'un instant du match : 1, 2, 3, puis la prolongation. */
export const periodeDe = t => (t < 20 ? 1 : t < 40 ? 2 : t < 60 ? 3 : 4);

/** Un but reçoit une passe principale, puis parfois une secondaire. */
export const P_PASSE_1 = 0.95;   // réel : 1,66 passe par but sur 55 saisons (0,95 + 0,95 × 0,75 = 1,66)
export const P_PASSE_2 = 0.75;
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

const borne = (x, min, max) => Math.max(min, Math.min(max, x));

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
  return borne((1 - sv) / Math.max(0.02, 1 - svLigue), 0.55, 1.60);
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
 * traîne le malus de zone de l'unité.
 */
export function profilMatch(team, lineup, adv = null) {
  const habilles = SLOTS.filter(s => !s.scratch).map(s => lineup[s.i]).filter(Boolean);
  const speciales = unitesSpeciales(habilles);
  const membresAN = speciales.avantage.partAN;
  const unites = { F: [], D: [] };
  // LE ROULEMENT décide de la glace, et il touche les DEUX parts : l'offensive
  // (qui tire) et la présence (qui défend, et qui reçoit le +/-).
  const parts = { F: partsDuRoulement(PART_UNITE.F, 'F', team), D: partsDuRoulement(PART_UNITE.D, 'D', team) };
  const presences = { F: partsDuRoulement(POIDS_TRIO, 'F', team), D: partsDuRoulement(POIDS_PAIRE, 'D', team) };
  for (const [group, poids] of [['F', presences.F], ['D', presences.D]]) {
    for (let u = 0; u < poids.length; u++) {
      const slots = SLOTS.filter(s => s.group === group && s.unit === u && !s.scratch);
      const syn = getUnitSynergy(lineup, group, u);
      const tog = team ? Math.min(CONTINUITY_MAX, (team.together.get(`${group}${u}`) || 0) / CONTINUITY_GAMES) : 0;
      const mod = Math.sqrt(Math.exp(((syn.bonusOff || 0) + tog) / SYN_ECHELLE));
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
  let discTac = 0, robTac = 0, sP = 0;
  for (const g of ['F', 'D']) unites[g].forEach((x, u) => {
    const l = lignes[u], T = TACTIQUES[l.tac] || {}, A = AGRESSIVITES[l.agr];
    x.ligne = u; x.tactique = l.tac;
    x.chimie = (team && team.chimie && team.chimie[u]) || 0;
    x.poids *= T.volume || 1;
    x.qualite *= T.finition || 1;
    // Plus physique, on donne moins — CENTRÉ sur l'agressivité moyenne, pour
    // que le réglage par défaut ne déplace pas la ligue.
    x.defTac = (T.defense || 1) * (1 - 0.10 * (A.physique - 0.4));
    discTac += x.presence * (T.discipline || 1) * A.punitions;
    robTac += x.presence * 1.5 * (A.physique - 0.4);
    sP += x.presence;
  });
  discTac = sP ? discTac / sP : 1; robTac = sP ? robTac / sP : 0;

  // Le trio de fermeture de cet alignement : désigné, ou le 3e trio
  // (voir FERMETURE_DEFAUT).
  const ferm = team && team.fermeture !== 'auto' && team.fermeture !== undefined ? team.fermeture : fermetureAuto(unites.F);
  for (const u of unites.F) u.fermeture = ferm != null && u.rang === ferm;

  const somme = (g) => unites[g].reduce((a, x) => a + x.poids, 0);
  const pression = (1 - PART_LANCERS_D) * somme('F') + PART_LANCERS_D * somme('D');

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

  return {
    unites,
    ...speciales,
    patineurs,
    // L'indiscipline : combien cet alignement prend de punitions, relativement
    // à un alignement de réguliers moyens de la même époque. 1 = la moyenne.
    // L'indiscipline : combien cet alignement prend de punitions. Le plan de
    // match entre ICI — un échec avant lourd se paie à l'arbitre.
    discipline: patineurs.length
      ? borne(cartes.discipline * discTac * patineurs.reduce((a, p) => a + punitionsRel(p), 0) / patineurs.length,
        DISCIPLINE_MIN, DISCIPLINE_MAX)
      : cartes.discipline,
    annee: anneeDe(habilles),
    // Les occasions d'avantage de cet alignement : mesurées par saison quand
    // les shards les portent, repère d'époque sinon (voir occasionsDe).
    occasions: patineurs.length ? patineurs.reduce((a, p) => a + occasionsDe(p), 0) / patineurs.length : null,
    // LES CARTES DE SAISON entrent ici, et NULLE PART AILLEURS : ce sont des
    // facteurs sur des quantités que le profil porte déjà. `pression` reste
    // sous sa borne, `finitionFacteur` sous la sienne (le plafond du jeu ne
    // se contourne pas avec une carte).
    pression: borne(pression * cartes.volume, 0.40, REF.pression * PRESSION_MAX),
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
export const APPARIEMENT = 2.5;
export const APPARIEMENT_PROPRE = 5.0;
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
export const FERMETURE_DEFAUT = 2;   // le 3e trio
export const APPARIEMENT_VISITEUR = Number(ENV_MESURE.APPARIEMENT_VISITEUR ?? 1.0);
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
export const PLAN_FERMETURE = Number(ENV_MESURE.PLAN_FERMETURE ?? 0.40);
export const P_MELANGE = Number(ENV_MESURE.P_MELANGE ?? 0.40);
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
export const RYTHME_CREDIT = Number(ENV_MESURE.RYTHME_CREDIT ?? 0.75);
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
export const RYTHME_BASE = ENV_MESURE.RYTHME_BASE || 'rythme';
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
export const RYTHME_PLANCHER = Number(ENV_MESURE.RYTHME_PLANCHER ?? 1);

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

/** Tire une unité au prorata de son poids de présence. */
function choisirUnite(unites) {
  let r = hasard() * unites.reduce((a, x) => a + x.poids, 0);
  for (const x of unites) { r -= x.poids; if (r <= 0) return x; }
  return unites[unites.length - 1];
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
  const attenduBase = LANCERS_BASE
    * (off.pression / REF.pression)
    * Math.pow(Math.max(0.3, def.pression / REF.pression), -ALPHA_POSSESSION)
    * (1 - K_VOLUME_DEF * ((def.zDef ?? REF.zDef) - REF.zDef));
  const attendu = st?.lancers != null ? st.lancers : attenduBase * (st?.part ?? 1) * (st ? FE_TIRS : 1);
  const lancers = st?.lancers != null ? poisson(attendu) : Math.max(6, poisson(attendu));
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
    instants = Array.from({ length: lancers }, () => instantForcesEgales(st?.fenetres, journal?.prolongation));
  }

  // La robustesse : les soirs éreintants et tous les matchs de séries, où
  // l'usure s'accumule de ronde en ronde (voir K_ROB).
  const intensite = series ? 1 + ROB_SERIES * ronde : heavy ? 1 : 0;
  const facteurRob = intensite ? Math.exp(K_ROB * intensite * (robZ(off) - robZ(def))) : 1;
  const fg = (gardien ? facteurGardien(gardien) : (def.fgDefaut ?? 1.20))
    * facteurTraitGardien(gardien, series) * situDe(gardien, 'gardien');
  // Les traits de l'équipe qui défend, et ceux de celle qui attaque en séries.
  const traits = (def.traitDef ?? 1) * (off.traitAtt ?? 1)
    * (series ? (off.traitSeries ?? 1) : 1);

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
      const membres = mode === 'FE' && off.avantage ? off.avantage.partAN : null;
      // En avantage la rondelle circule : le tireur se tire sur la RACINE de
      // son volume, sinon le canonnier de l'unité prenait un tir sur trois
      // et doublait sa saison (Larmer 1992-93 : 61 buts au lieu de 29).
      tireur = weightedPick(unite.joueurs.length ? unite.joueurs : glace,
        mode === 'AN' ? p => Math.sqrt(lancersRel(p)) : p => lancersFE(p, membres));
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
      defGlace = [...dTrio.joueurs, ...dPaire.joueurs];
      const z = borne((0.5 * (dTrio.coteDef + dPaire.coteDef) - MOY_DEF_EQUIPE) / ECART_DEF_EQUIPE, -5, 3);
      // Le bidirectionnel (et le Selke) étouffe PENDANT SES PRÉSENCES : c'est
      // le seul trait qui passe par ici, voir EFFET dans js/traits.js.
      facteurDef = Math.max(0.55, 1 - K_DEFENSE * (z - REF.zDef)) * facteurPresenceUnite(defGlace)
        // Un changement de carte défensif (S68) joue pendant SES présences.
        * defGlace.reduce((a, q) => a * mutDe(q, 'defense'), 1)
        // La consigne des deux unités qui défendent (S68) : la trappe étouffe,
        // tout en attaque laisse le champ libre — chacune pour sa moitié.
        * Math.sqrt((dTrio.defTac ?? 1) * (dPaire.defTac ?? 1));
    } else {
      facteurDef = Math.max(0.55, 1 - K_DEFENSE * (def.zDef - REF.zDef));
    }

    // Les passes causent les buts : la création des coéquipiers sur la glace
    // change la probabilité que CE lancer entre.
    // En avantage numérique la création ne compte qu'à moitié : le % de tir
    // réel d'un joueur d'avantage contient déjà son vrai avantage, et cinq
    // élites autour de lui la comptaient deux fois (mesuré : Zetterberg
    // 2006-07 à 110 buts au lieu de 48).
    const crea = glace ? (mode === 'AN' ? Math.sqrt(facteurCreation(glace, tireur)) : facteurCreation(glace, tireur)) : 1;

    /*
     * L'ACTION SPÉCIALE (S68) : à forces égales, la ligne qui a un système a
     * une chance, selon sa chimie, de jouer SON jeu — et ce lancer entre plus.
     * Si le trio qui défend joue la tactique qui la contre, elle est étouffée.
     */
    let special = null;
    if (mode === 'FE' && trioOff && trioOff.tactique && trioOff.tactique !== 'hourra'
      && hasard() < SPEC_BASE * (trioOff.chimie || 0) / 100) {
      const T = dTrio && dTrio.tactique && TACTIQUES[dTrio.tactique];
      special = T && T.bat === trioOff.tactique ? 'etouffee' : 'reussie';
    }
    const p = borne(
      CIBLE_PCT_TIR
        * (tireur ? pctTirRel(tireur) : (off.pctTirDefaut ?? RAPPEL_PCT_TIR)) / REF.pctTir * crea
        * (fg / REF.fg) * facteurDef * facteurRob * traits * (unite ? unite.qualite : 1) * chance
        * (off.finitionFacteur ?? 1) * qualite * (mode === 'FE' && st ? FE_QUALITE : 1)
        * (mode === 'FE' ? SPEC_NORME : 1) * (special === 'reussie' ? SPEC_MULT : 1),
      0.005, PCT_TIR_MAX);

    if (feuille && tireur) tireur.simSH = (tireur.simSH || 0) + 1;
    if (journal) journal.tirs[cote][periodeDe(instant)]++;
    // Chaque lancer entre au journal avec son tireur et son gardien : c'est
    // ce que le direct des séries rejoue, tir par tir. Le sommaire, lui, ne
    // lit que les buts.
    const lancer = journal ? { cote, instant, tireur, gardien, but: false, mode, special, ligne: trioOff ? trioOff.rang : null } : null;
    if (lancer) journal.lancers.push(lancer);

    if (hasard() < p) {
      buts++;
      if (lancer) lancer.but = true;
      if (journal && tireur) {
        journal.buts.push({ cote, instant, marqueur: tireur, passeurs: [], gardien, an: mode === 'AN', dn: mode === 'DN', special, ligne: trioOff ? trioOff.rang : null });
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
const CONTINUITY_MAX = 2;   // bonus max de continuité par unité
const CONTINUITY_GAMES = 25;

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
export function gpShare(p) {
  return Math.max(0, Math.min(1, (p.gp || 0) / seasonGames(p.s)));
}

/** Probabilité de blessure à un match donné. */
export function injuryChance(p, heavy = false) {
  const frail = 1 - gpShare(p);
  let pr = 0.0015 + 0.015 * frail * frail;
  if (p.p === 'G') pr *= 0.5;
  if (heavy) pr *= 1.5;
  // Un joueur robuste se blesse moins (r est à 50 ± 12 par joueur).
  pr *= Math.exp(-ROB_BLESSURE * (getHiddenRatings(p).r - 50) / 12);
  return pr;
}

function injuryLength() {   // moyenne ~8 matchs, plafond 40
  let n = 1;
  while (n < 40 && hasard() < 0.875) n++;
  return n;
}

export function initSimStats(p) {
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
    plan: opts.plan || 'equilibre',        // le plan de match (voir PLANS)
    roulement: opts.roulement || 'quatre', // la distribution des minutes (voir ROULEMENTS)
    injured: new Map(),      // joueur -> matchs restants
    together: new Map(),     // unité -> matchs consécutifs intacts
    togetherSig: new Map(),
    injuriesLog: [],         // { player, games, at }
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

export function partAuxiliaire(starter, backup) {
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

function pickGoalie(lineup, gameIdx, team = null) {
  const gs = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => lineup[s.i]);
  const [starter, backup] = gs;
  // Sans auxiliaire — tu l'as signé, il est blessé — le club rappelle, et le
  // rappel prend la part d'un auxiliaire ordinaire : le partant retombe sous
  // les 70 départs, là où la vraie ligue le tient.
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

function pickUnit(weights) {
  let r = hasard() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
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

function applyInjuries(team, lineup, heavy) {
  for (const [p, n] of team.injured) {
    if (n <= 1) team.injured.delete(p); else team.injured.set(p, n - 1);
  }
  for (const p of Object.values(lineup)) {
    if (!p || team.injured.has(p)) continue;
    // Le risque suit la carte, le plan et le roulement : « Roulement court » et
    // « Trois trios » usent, « L'infirmerie » et « Banc profond » protègent.
    // Et la situation du joueur : « Il joue amoché » finit par payer.
    // L'ÉNERGIE (S68) : sous 60, le risque monte — jusqu'au double à 30.
    const usee = 1 + Math.max(0, ENERGIE_BLESSURE - energieDe(p)) / 30;
    if (hasard() < injuryChance(p, heavy) * effetsDeSaison(team).blessure * situDe(p, 'blessure') * usee * mutDe(p, 'blessure')) {
      const n = injuryLength();
      team.injured.set(p, n);
      p.simInj = (p.simInj || 0) + n;
      team.injuriesLog.push({ player: p, games: n, at: team.games + 1 });
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
/** Un match sur quatre est éreintant : la robustesse y pèse (voir K_ROB). L'écran de saison le dit d'avance. */
export const soirEreintant = gameIdx => gameIdx % 4 === 3;

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

export function playGame(A, B, gameIdx, track = true, series = false, journal = null, ronde = 0) {
  const heavy = soirEreintant(gameIdx);
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
  const gA = pickGoalie(LA, A.games, A), gB = pickGoalie(LB, B.games, B);

  const pA = profilMatch(A, LA, B), pB = profilMatch(B, LB, A);
  pA.rob = sA.rob; pB.rob = sB.rob;
  // A est à domicile : le dernier changement est à lui (voir FERMETURE_DEFAUT).
  pA.domicile = true; pB.domicile = false;

  // La chance est du PDO : elle porte sur la finition, pas sur le volume.
  const chanceA = Math.exp(gauss() * LUCK_GAME + A.luck - B.luck);
  const chanceB = Math.exp(gauss() * LUCK_GAME + B.luck - A.luck);

  let { gfA, gfB } = jouerSoixanteMinutes(pA, pB, gA, gB, chanceA, chanceB, heavy, track, series, journal, LA, LB, ronde);
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
    // Le journal de la saison : ce qu'il faut pour raconter une séquence,
    // un début de saison, une raclée. Le moteur n'y lit jamais rien.
    if (A.journal) A.journal.push({ n: A.games + 1, adv: B, gf: gfA, ga: gfB, ot, win: winA, gardien: gA, feuille: journal });
    if (B.journal) B.journal.push({ n: B.games + 1, adv: A, gf: gfB, ga: gfA, ot, win: !winA, gardien: gB, feuille: journal });
  }
  applyInjuries(A, LA, heavy); applyInjuries(B, LB, heavy);
  if (track) { A.games++; B.games++; }
  return { gfA, gfB, ot, winner: winA ? A : B };
}

/** Le but de la prolongation : un tireur, une passe, du +/-, comme les autres. */
/** Un instant à forces égales : n'importe où dans le match, hors des avantages. */
function instantForcesEgales(fenetres, prolongation) {
  for (let k = 0; k < 12; k++) {
    const t = prolongation ? 60 + hasard() * 5 : hasard() * 60;
    if (!fenetres || !fenetres.some(([a, b]) => t >= a && t < b)) return t;
  }
  return hasard() * 60;
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
function jouerSoixanteMinutes(pA, pB, gA, gB, chanceA, chanceB, heavy, track, series, journal, LA = null, LB = null, ronde = 0) {
  const occasions = pA.occasions && pB.occasions ? (pA.occasions + pB.occasions) / 2
    : (pA.occasions || pB.occasions || occasionsEpoque(pA.annee || pB.annee));
  let gfA = 0, gfB = 0;
  const fenetres = [];
  let minutesAN = 0;

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
    const n = poisson(occasions * (puni ? puni.discipline : 1));
    for (let k = 0; k < n; k++) mineures.push({ cote, puni });
  };
  tirerMineures('A', pB);   // `cote` = l'équipe qui PROFITE ; `puni` = l'alignement qui écope
  tirerMineures('B', pA);
  // Les départs : n fenêtres de deux minutes dans 60, dans un ordre mêlé,
  // séparées par des écarts tirés au hasard (partition uniforme du temps libre).
  shuffle(mineures);
  const libre = Math.max(0, 60 - mineures.length * AN_MINUTES);
  const coupures = Array.from({ length: mineures.length }, () => hasard() * libre).sort((a, b) => a - b);
  mineures.forEach((m, k) => { m.t0 = coupures[k] + k * AN_MINUTES; });

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

  const part = Math.max(0.5, (60 - minutesAN) / 60);
  gfA += jouerCote(pA, pB, gB, chanceA, heavy, track, series, journal, 'A', { mode: 'FE', part, fenetres }, ronde);
  gfB += jouerCote(pB, pA, gA, chanceB, heavy, track, series, journal, 'B', { mode: 'FE', part, fenetres }, ronde);
  return { gfA, gfB };
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
    applyInjuries(team, lineup, heavy);
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
function appliquerDecision(team, d) {
  // UNE CARTE EST UNE DÉCISION comme une autre : elle s'applique au jour où
  // elle a été prise et vaut pour le reste de la saison.
  if (d.carte && CARTES[d.carte]) (team.cartes = team.cartes || []).push(d.carte);
  if ('fermeture' in d) team.fermeture = d.fermeture;
  if ('plan' in d && PLANS[d.plan]) team.plan = d.plan;
  if ('roulement' in d && ROULEMENTS[d.roulement]) team.roulement = d.roulement;
  // UN CHANGEMENT DE CARTE PAR CHOIX (S68) : direct, ou porté par l'option
  // d'un dilemme. Le joueur visé est nommé dans la décision.
  const mut = d.mutation || (d.moment && d.moment.joueur && (() => {
    const fam = d.moment.famille === 'sequence' ? SEQUENCES[d.moment.cle] : MOMENTS[d.moment.cle];
    const o = fam && fam.options.find(x => x.cle === d.moment.choix);
    return o && o.mutation ? { cle: o.mutation, joueur: d.moment.joueur } : null;
  })());
  if (mut && MUTATIONS[mut.cle]) {
    const p = Object.values(team.roster).find(x => x && getPlayerKey(x) === mut.joueur) || CONNUS.get(mut.joueur);
    if (p) appliquerMutation(team, p, mut.cle, d.jour, 'choix');
  }
  // LES LIGNES À LA HOCKEYARENA (S68) : [{ tac, agr, sec }] × 4.
  if (Array.isArray(d.lignes)) team.lignes = d.lignes.map(l => ({ ...l }));
  // UN MOMENT (S66) : un effet temporaire, du jour de la décision à sa fin.
  const eff = effetDeMoment(d);
  if (eff) (team.effets = team.effets || []).push(eff);
  const dj = jaugesDeDecision(d);
  if (Object.keys(dj).length) bougerJauges(team.jauges = team.jauges || jaugesNeuves(), dj);
  /*
   * LE BALLOTTAGE (S66) : un joueur réclamé prend une case de réserve, et
   * celui qui l'occupait est libéré. C'est la SEULE décision qui fait entrer
   * un joueur neuf ; il doit donc être connu du moteur (`connaitre`) avant la
   * saison, et ses fiches partent de zéro le jour où il arrive.
   */
  if (d.ballottage) {
    const b = d.ballottage;
    const p = CONNUS.get(b.entre);
    if (p && SLOTS[b.i] && SLOTS[b.i].scratch && fits(p, SLOTS[b.i])) {
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
    if (p) team.roster[i] = p;
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
export function simulateLeague(teams, games = 82, { graine = null, decisions = [], situations = true } = {}) {
  const vitDesSituations = typeof situations === 'function' ? situations : () => !!situations;
  // La saison porte sa graine : donnée, elle rejoue la même ; absente, on en
  // tire une et on la rend, pour que « Rejouer » et l'historique la gardent.
  // Le générateur reste en place après : les séries, jouées ensuite par
  // l'interface, continuent la même suite.
  if (graine === null || graine === undefined) graine = nouvelleGraine();
  grainerHasard(graine);
  for (const t of teams) {
    for (const s of SLOTS) if (t.roster[s.i]) { initSimStats(t.roster[s.i]); connaitre(t.roster[s.i]); }
    t.strength = teamStrength(t);   // à pleine santé, pour les barres du résultat
    // La chance de saison est tirée ICI, sous la graine, et non à
    // `createTeam` : sinon deux saisons de même graine différaient déjà
    // avant le premier lancer (check_graine.mjs l'a attrapé).
    t.luck = gauss() * LUCK_SEASON;
    // LES CARTES SE REMETTENT À ZÉRO ICI. Sans ça, rejouer la saison — ce que
    // fait CHAQUE décision — empilerait les cartes des passages précédents,
    // et une équipe finirait la partie avec quinze fois la même.
    t.cartes = [];
    // LES SITUATIONS AUSSI. Elles ne sont pas une décision, mais elles vivent
    // sur les objets joueurs (`_situ`) et sur l'équipe : sans cette remise à
    // zéro, rejouer la saison — ce que fait CHAQUE décision — laisserait la
    // paire du passage précédent collée sur ses deux hommes.
    t.situations = [];
    t.trous = []; t.trouEnCours = false;
    // LES MOMENTS aussi (S66) : ce sont des décisions, rejouées à chaque passage.
    t.effets = []; t.jourCourant = 0; t.jauges = jaugesNeuves();
    // LA CHIMIE ET L'ÉNERGIE (S68) repartent de zéro et de cent à chaque passage.
    t.chimie = [0, 0, 0, 0]; t.chimieSig = [null, null, null, null]; t.chimieTac = [null, null, null, null];
    for (const s of SLOTS) if (t.roster[s.i]) { const p = t.roster[s.i]; p.energie = 100; delete p._mut; delete p._mutProfils; delete p._mutCles; }
    t.mutations = []; t.jourLignes = [];
    for (const s of SLOTS) if (t.roster[s.i]) delete t.roster[s.i]._situ;
  }
  // Le calendrier : une journée par ronde, ses seize matchs avec leur
  // pointage. C'est ce que l'écran rejoue jour après jour, et ce qu'on peut
  // consulter après pour vérifier la saison de n'importe quelle équipe.
  const calendrier = [];
  // Ce qu'il reste à jouer à chaque équipe. Une journée apparie tout le monde
  // quand l'effectif est pair ; sinon celle qui a le moins de matchs à jouer
  // est en congé, ce qui garde les restes à un match les uns des autres et
  // fait retomber tout le monde sur `games` à la fin.
  // LE STYLE DE CHAQUE CLUB, posé une fois, sans hasard (voir STYLES).
  poserStyles(teams);
  const restant = new Map(teams.map(t => [t, games]));
  for (let r = 0; restant.size; r++) {
    // LES SITUATIONS DU JOUR, avant les décisions et avant le brassage. Comme
    // elles, elles ne consomment AUCUN hasard : elles se tirent de la graine,
    // de la journée et du rang de l'équipe. Une journée qui n'ouvre pas de
    // fenêtre ne fait rien.
    for (const t of teams) { t.jourCourant = r; if (r > 0) recupererEnergie(t); }
    /*
     * L'INSTANTANÉ DU JOUR (S68) : la chimie de chaque ligne et l'énergie de
     * chaque joueur AU DÉBUT de la journée. Le moteur joue toute la saison
     * d'avance ; sans ça, l'écran ne pourrait montrer que l'état de la FIN.
     */
    for (const t of teams) {
      (t.jourLignes = t.jourLignes || [])[r] = {
        chimie: (t.chimie || [0, 0, 0, 0]).slice(),
        energie: Object.fromEntries(SLOTS.map(s => t.roster[s.i]).filter(Boolean).map(p => [getPlayerKey(p), Math.round(energieDe(p))])),
      };
    }
    for (let i = 0; i < teams.length; i++) if (vitDesSituations(i)) poserSituations(teams[i], graine, r, i);
    // LES ACCIDENTS DE CARTE (S68), comme les situations : de la graine.
    for (let i = 0; i < teams.length; i++) if (vitDesSituations(i)) poserAccident(teams[i], graine, r, i);
    // Les décisions du jour s'appliquent AVANT le brassage : elles ne
    // consomment aucun hasard, donc une décision au jour k ne touche pas
    // aux appariements ni aux journées d'avant.
    let sel = null;
    for (const d of decisions) {
      if (d.jour !== r) continue;
      const t = teams[d.equipe || 0];
      if (t) appliquerDecision(t, d);
      if (d.sel) sel = `${sel || ''}${d.sel}`;
    }
    /*
     * DES DÉS NEUFS APRÈS CHAQUE DÉCISION (S68). JP : *ça devrait jamais être
     * identique si on simule deux fois un match*. Une décision porte son SEL,
     * tiré au vrai hasard quand on la prend : à partir de sa journée, la
     * saison se joue sur une suite neuve. Ce qui est déjà révélé ne bouge pas
     * (les journées d'avant se rejouent sur l'ancienne suite), reprendre la
     * même décision redonne d'AUTRES matchs, et un rechargement redonne les
     * mêmes — le sel est dans la sauvegarde avec la décision.
     */
    if (sel) grainerHasard(`${graine}:${r}:${sel}`);
    const order = shuffle(teams.filter(t => restant.get(t) > 0));
    if (order.length < 2) break;
    // Tri stable : l'ordre du brassage départage les équipes à égalité.
    order.sort((a, b) => restant.get(b) - restant.get(a));
    if (order.length % 2) order.pop();
    const jour = [];
    for (let i = 0; i < order.length; i += 2) {
      // CHAQUE MATCH DE SAISON GARDE SA FEUILLE, comme un match de séries :
      // ses buts avec leurs passeurs, ses gardiens, ses tirs par période.
      // C'est ce qui permet de lire les statistiques de la ligue à n'importe
      // quelle journée, d'ouvrir le sommaire d'un match du calendrier, et
      // de dire « son 12e but » quand il compte.
      const feuille = feuilleVierge();
      const res = playGame(order[i], order[i + 1], r, true, false, feuille);
      jour.push({ A: order[i], B: order[i + 1], gfA: res.gfA, gfB: res.gfB, ot: res.ot, feuille });
      restant.set(order[i], restant.get(order[i]) - 1);
      restant.set(order[i + 1], restant.get(order[i + 1]) - 1);
    }
    calendrier.push(jour);
    for (const [t, n] of restant) if (n <= 0) restant.delete(t);
  }
  // Les séries ne lisent aucun effet temporaire : la fenêtre est close.
  for (const t of teams) t.jourCourant = Infinity;
  const standings = teams.slice().sort((a, b) =>
    b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF);
  const skaters = [];
  for (const t of teams) for (const s of SLOTS) {
    const p = t.roster[s.i];
    if (p && p.p !== 'G') skaters.push({ player: p, team: t });
  }
  const leaders = skaters.sort((a, b) => b.player.simPTS - a.player.simPTS || b.player.simG - a.player.simG).slice(0, 10);
  return { standings, leaders, calendrier, graine };
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
export function photoStats(teams) {
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

export function separerSeries(teams, photo) {
  for (const t of teams) {
    const e = photo.get(t);
    if (!e) continue;
    t.po = Object.fromEntries(CHAMPS_EQUIPE.map(k => [k, (t[k] || 0) - (e[k] || 0)]));
    t.poJournal = t.journal ? t.journal.slice(e.journal) : [];
    t.poBlessures = t.injuriesLog ? t.injuriesLog.slice(e.blessures) : [];
    if (t.journal) t.journal.length = e.journal;
    if (t.injuriesLog) t.injuriesLog.length = e.blessures;
    for (const k of CHAMPS_EQUIPE) t[k] = e[k];
    for (const s of SLOTS) {
      const p = t.roster[s.i];
      const q = p && photo.get(p);
      if (!q) continue;
      p.po = {};
      for (const k of CHAMPS_SIM) {
        if (p[k] === undefined && q[k] === undefined) continue;
        p.po[k.slice(3)] = (p[k] || 0) - (q[k] || 0);
        p[k] = q[k];
      }
    }
  }
}

/** Une feuille de match vierge, prête à recevoir le journal d'un match. */
export function feuilleVierge() {
  return {
    buts: [],
    lancers: [],                                          // chaque tir, daté, avec tireur, gardien et mode (FE, AN, DN)
    punitions: [],                                        // { cote (l'équipe punie), instant, joueur, minutes }
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
const ORDRE_AUTO = [...SLOTS].sort((a, b) => cleAuto(a) - cleAuto(b));
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

/* Ce qu'une MUTATION de carte multiplie chez ce joueur (S68, voir MUTATIONS). */
function mutDe(p, champ) {
  const m = p && p._mut;
  return (m && m[champ]) || 1;
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
  // ---- par choix ----
  tir_gun: { nom: 'Précision au gun', ico: '🎯', cible: 'plombier', source: 'choix',
    quoi: 'Il a passé ses soirées à tirer du gun : il vise, maintenant.',
    profils: { franc: 25, puissant: -5 }, finition: 1.10, lancers: 1.04 },
  lame: { nom: 'Converti en défensif', ico: '🧊', cible: 'franc', source: 'choix',
    quoi: 'Sa lame ne se fabrique plus : il ne sent plus sa rondelle, et on en fait un joueur défensif.',
    profils: { defensif: 30, franc: -20 }, finition: 0.88, defense: 0.95 },
  gym: { nom: 'Dix livres de muscle', ico: '🦍', cible: 'rapide', source: 'choix',
    quoi: 'Un été au gym : plus lourd, plus solide, un peu moins vif.',
    profils: { puissant: 25, rapide: -15 }, blessure: 0.85, lancers: 0.97 },
  patin: { nom: 'École de patinage', ico: '⚡', cible: 'lent', source: 'choix',
    quoi: 'Un entraîneur de patinage l\'a pris en main : il arrive avant la rondelle.',
    profils: { rapide: 25 }, lancers: 1.06 },
  video: { nom: 'Les cassettes de Gretzky', ico: '🪄', cible: 'passeur', source: 'choix',
    quoi: 'Il étudie les vieilles cassettes : il voit le jeu une passe d\'avance.',
    profils: { fabricant: 25, createur: 10 }, creation: 1.10, finition: 0.97 },
  pointe: { nom: 'La pointe de l\'avantage', ico: '💣', cible: 'pointe', source: 'choix',
    quoi: 'On lui donne la ligne bleue : il décoche à la moindre ouverture.',
    profils: { bleue: 25 }, lancers: 1.08 },
  dur: { nom: 'L\'école du vétéran', ico: '🧱', cible: 'mou', source: 'choix',
    quoi: 'Un vétéran lui apprend à défendre : il ne monte plus, il bloque.',
    profils: { pur: 25, offensif: -10 }, defense: 0.94, creation: 0.95 },
  // ---- par accident ----
  prudent: { nom: 'Joue prudent', ico: '🤕', cible: 'hasard', source: 'accident',
    quoi: 'Depuis sa commotion, il évite les contacts.',
    profils: { puissant: -20, pur: -15 }, blessure: 1.2, defense: 1.03 },
  declic: { nom: 'Le déclic', ico: '🔥', cible: 'hasard', source: 'accident',
    quoi: 'Un but en bourrée, et depuis, tout rentre.',
    profils: { franc: 15, bleue: 10 }, finition: 1.08 },
  mentor: { nom: 'Pris sous l\'aile', ico: '🧓', cible: 'hasard', source: 'accident',
    quoi: 'Le capitaine l\'a pris sous son aile : il fait les petites choses.',
    profils: { createur: 12, defensif: 10, pur: 10 }, creation: 1.05, defense: 0.97 },
  genou: { nom: 'Un genou qui grince', ico: '🦵', cible: 'hasard', source: 'accident',
    quoi: 'Il joue avec un genou qui grince : il n\'a plus sa première enjambée.',
    profils: { rapide: -20 }, lancers: 0.93, blessure: 1.25 },
  baton: { nom: 'Nouveau bâton, nouveau lancer', ico: '🏒', cible: 'hasard', source: 'accident',
    quoi: 'Un nouveau modèle de bâton, et son lancer a pris dix kilomètres-heure.',
    profils: { franc: 10, bleue: 15 }, finition: 1.05 },
  doute: { nom: 'Confiance ébranlée', ico: '🌧️', cible: 'hasard', source: 'accident',
    quoi: 'Hué dans son propre aréna : il ne tente plus rien.',
    profils: { franc: -15, createur: -10 }, finition: 0.93 },
  pere: { nom: 'Il joue pour son père', ico: '🕊️', cible: 'hasard', source: 'accident',
    quoi: 'Son père est au plus mal : il joue chaque présence comme la dernière.',
    profils: { puissant: 10, createur: 10 }, lancers: 1.05, finition: 1.03 },
};
const CANAUX_MUT = ['lancers', 'finition', 'creation', 'defense', 'blessure'];

/*
 * QUI UNE MUTATION VISE, tiré des PROFILS de l'alignement — jamais d'une cote.
 * Le plombier est l'attaquant le plus puissant et le moins franc-tireur ;
 * « franc » la meilleure gâchette ; « lent » le moins rapide ; etc. Les ex
 * æquo se départagent sur l'identité, comme les situations.
 */
const CIBLES = {
  plombier: { g: 'F', s: pr => pr.puissant - pr.franc },
  franc: { g: 'F', s: pr => pr.franc },
  rapide: { g: 'F', s: pr => pr.rapide },
  lent: { g: 'F', s: pr => -pr.rapide },
  passeur: { g: 'F', s: pr => pr.franc - pr.fabricant },
  pointe: { g: 'D', s: pr => pr.offensif - pr.bleue },
  mou: { g: 'D', s: pr => -pr.pur },
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

/* Poser une mutation sur un joueur : ses facteurs se multiplient, ses profils s'additionnent. */
export function appliquerMutation(team, p, cle, jour, source) {
  const M = MUTATIONS[cle];
  if (!M || !p) return;
  p._mut = p._mut || {};
  for (const c of CANAUX_MUT) if (M[c]) p._mut[c] = (p._mut[c] || 1) * M[c];
  p._mutProfils = p._mutProfils || {};
  for (const [k, d] of Object.entries(M.profils || {})) p._mutProfils[k] = (p._mutProfils[k] || 0) + d;
  (p._mutCles = p._mutCles || []).push(cle);
  (team.mutations = team.mutations || []).push({ jour, cle, joueur: getPlayerKey(p), p, source });
}

/* Les accidents : cinq fenêtres, une chance sur deux par club, tirés de la graine. */
export const JOURS_ACCIDENTS = [7, 22, 37, 55, 74];
export const CHANCE_ACCIDENT = 0.5;
function poserAccident(team, graine, jour, equipe) {
  if (!JOURS_ACCIDENTS.includes(jour)) return;
  const rnd = melangeurSitu(graine, jour + 5000, equipe);
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
  const pct = (x, mot, bon) => ({ txt: `${mot} ${x > 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)} %`, bon: bon ? x > 1 : x < 1 });
  const out = [];
  if (M.finition) out.push(pct(M.finition, 'Finition', true));
  if (M.lancers) out.push(pct(M.lancers, 'Lancers', true));
  if (M.creation) out.push(pct(M.creation, 'Création', true));
  if (M.defense) out.push({ txt: `Buts contre quand il est là ${M.defense < 1 ? '−' : '+'}${Math.round(Math.abs(M.defense - 1) * 100)} %`, bon: M.defense < 1 });
  if (M.blessure) out.push({ txt: `Blessures ${M.blessure < 1 ? '−' : '+'}${Math.round(Math.abs(M.blessure - 1) * 100)} %`, bon: M.blessure < 1 });
  for (const [k, d] of Object.entries(M.profils || {})) {
    const P = PROFILS.F[k] || PROFILS.D[k];
    if (P) out.push({ txt: `${P.ico} ${P.nom} ${d > 0 ? '+' : '−'}${Math.abs(d)}`, bon: d > 0 });
  }
  return out;
}

/*
 * CE QU'UN EFFET FAIT, EN MOTS (S68). JP : *c'est pas clair l'impact des
 * trucs*. Toutes les options — dilemmes, séquences, cartes, factions,
 * importance du match, tactiques — passent par ici : un seul endroit qui dit
 * « Finition +8 % », « Buts alloués −6 % », « 1er trio +25 % de glace »,
 * pour que l'écran ne recopie jamais un chiffre qui finirait par mentir.
 * Chaque mot dit s'il AIDE (`bon`) ; l'écran le colore.
 */
export function motsDEffet(e, duree = null) {
  if (!e) return [];
  const out = [];
  const pct = x => `${x > 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)} %`;
  if (e.finition && e.finition !== 1) out.push({ txt: `Finition ${pct(e.finition)}`, bon: e.finition > 1 });
  if (e.volume && e.volume !== 1) out.push({ txt: `Lancers ${pct(e.volume)}`, bon: e.volume > 1 });
  if (e.defense && e.defense !== 1) out.push({ txt: `Buts alloués ${pct(e.defense)}`, bon: e.defense < 1 });
  if (e.discipline && e.discipline !== 1) out.push({ txt: `Punitions ${pct(e.discipline)}`, bon: e.discipline < 1 });
  if (e.blessure && e.blessure !== 1) out.push({ txt: `Blessures ${pct(e.blessure)}`, bon: e.blessure < 1 });
  if (e.energie && e.energie !== 1) out.push({ txt: `Fatigue ${pct(e.energie)}`, bon: e.energie < 1 });
  if (e.robustesse) out.push({ txt: `Robustesse ${e.robustesse > 0 ? '+' : '−'}${Math.abs(e.robustesse).toFixed(1).replace('.', ',')}`, bon: e.robustesse > 0 });
  const rangF = ['1er trio', '2e trio', '3e trio', '4e trio'], rangD = ['1re paire', '2e paire', '3e paire'];
  for (const [g, noms] of [['F', rangF], ['D', rangD]]) if (Array.isArray(e[g])) e[g].forEach((m, i) => {
    if (m !== 1) out.push({ txt: `${noms[i]} ${pct(m)} de glace`, bon: null });
  });
  if (e.mutation && MUTATIONS[e.mutation]) out.push({ txt: `Change sa carte : ${MUTATIONS[e.mutation].ico} ${MUTATIONS[e.mutation].nom}`, bon: null });
  if (duree) out.push({ txt: `${duree} match${duree > 1 ? 's' : ''}`, bon: null, duree: true });
  return out;
}
/* La durée d'une option de dilemme ou de séquence, en journées. */
export const dureeOption = (o, famille) => (o && o.duree) || (famille === 'sequence' ? DUREE_SEQUENCE : DUREE_MOMENT);
