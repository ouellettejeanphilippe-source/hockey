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
         bonusMeneurEquipe, facteurPresenceUnite, bonusRobustesseEquipe } from './traits.js';

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
    desc: 'Vingt-trois cases, et pour chacune le même joueur de trois équipes : tu choisis. Huit relances.',
  },
  EXPRESS: {
    nom: 'Express', format: 'EXPRESS', tirage: 'VESTIAIRE', cap: 34_000_000, renfort: true, loto: false, relances: 0,
    desc: 'Un trio, une paire, un partant, pris dans le vestiaire d\'une vraie équipe à chaque tour. Le reste vient d\'une autre vraie équipe.',
  },
  LOTO_EXPRESS: {
    nom: 'Loto express', format: 'EXPRESS', tirage: 'LOTO', cap: 34_000_000, renfort: true, loto: true, relances: 2,
    desc: 'Six cases, trois candidats pour chacune, trois relances. Le reste vient d\'une vraie équipe.',
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
 *   aucun malus                83,8       67,7       68,0       58,8       47,3
 *   ancien (forfait 3, max 12) 82,4       69,3       68,6       59,7       44,0
 *   EN VIGUEUR (0,40, max 70)  69,3       66,5       65,9       59,4       47,9
 *
 * L'empilement perd quinze points et se retrouve à 69,3, à peine au-dessus de
 * la meilleure équipe de l'histoire. Les vraies équipes témoins ne bougent
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
export const ZONE_PEN_DESSUS = 3;    // forfait par cran, quand le joueur est surclassé
export const ZONE_PEN_MAX = 70;      // plafond par unité

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
  const zoneDists = ps.map((x, i) => {
    const ideal = getLineZone(x.player, hidden[i].v).idealUnits;
    const ecart = Math.min(...ideal.map(u => Math.abs(u - unit)));
    if (ecart === 0) return { ecart, pen: 0 };
    // Sous sa zone = un top 6 au 4e trio : le malus est PROPORTIONNEL au
    // talent gaspillé, jamais forfaitaire, sinon franchir un seuil de zone
    // vers le haut pourrait rendre l'équipe pire (voir le commentaire des
    // constantes). Au-dessus = il n'a personne de mieux, malus léger.
    const sous = unit > Math.max(...ideal);
    const pen = sous
      ? ZONE_PEN_SOUS * Math.max(0, hidden[i].v - calibreAttendu(group, unit))
      : ZONE_PEN_DESSUS * ecart;
    return { ecart, pen };
  });
  const totalPen = zoneDists.reduce((s, z) => s + z.pen, 0);
  const miscast = zoneDists.filter(z => z.ecart > 0).length;
  let zone = null;
  if (miscast === 0) {
    zone = { off: 2, def: 2, tag: group === 'F' ? '✨ Trio optimal' : '✨ Paire optimale' };
  } else {
    const pen = Math.min(ZONE_PEN_MAX, totalPen);
    zone = { off: -pen, def: -pen, tag: group === 'F' ? '⚠️ Trio mal assorti' : '⚠️ Paire mal assortie' };
  }

  const withZone = (bonusOff, bonusDef, name, desc) => ({
    bonusOff: bonusOff + (zone ? zone.off : 0),
    bonusDef: bonusDef + (zone ? zone.def : 0),
    name: zone ? `${name} · ${zone.tag}` : name,
    desc,
    zone: zone ? zone.tag : null,
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
 * LE POIDS D'UN DÉFENSEUR DANS LE TIRAGE DES PASSEURS. La propension est la
 * part de passes dans les points, RELATIVE — un défenseur en a une haute par
 * nature — et deux des quatre coéquipiers sur la glace sont des défenseurs :
 * à 0,7 ils récoltaient 45 % des passes de la ligue contre 29,7 % réels sur
 * 55 saisons (27 % en 1975-76, 31 % en 2024-25), et Bowen Byram finissait à
 * 94 points. Réglé sur la mesure : 0,3 donne 29,7 %.
 */
export const PASSE_D = 0.3;

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
  return borne(perso / base, 0.25, 2.60) * facteurLancersJoueur(p);
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
  return borne(100 * (p.g || 0) / lancers / ligue, 0.35, 2.20) * facteurFinitionJoueur(p);
}

const passesRel = passesRelatives;

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
export const passesRelDe = passesRel;

/** Propension à la passe : la part de points qu'un joueur récolte en passes. */
const propensionPasse = p =>
  ((p.a || 0) / Math.max(1, p.pt || 1) + 0.05) * (p.p === 'D' ? PASSE_D : 1);

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
export function profilMatch(team, lineup) {
  const habilles = SLOTS.filter(s => !s.scratch).map(s => lineup[s.i]).filter(Boolean);
  const speciales = unitesSpeciales(habilles);
  const membresAN = speciales.avantage.partAN;
  const unites = { F: [], D: [] };
  for (const [group, poids] of [['F', POIDS_TRIO], ['D', POIDS_PAIRE]]) {
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
        // Poids OFFENSIF : temps de glace, volume de tirs et chimie. C'est lui
        // qui décide qui tire.
        poids: poids[u] * volume * mod,
        qualite: mod,
        // Poids DÉFENSIF : le temps de glace seul. Une unité ne défend pas
        // plus souvent parce qu'elle tire plus — elle défend sa part de
        // présences, point.
        presence: poids[u],
        coteDef: unitAvgLineup(team, lineup, group, u, 'd'),
      });
    }
  }

  const somme = (g) => unites[g].reduce((a, x) => a + x.poids, 0);
  const pression = (1 - PART_LANCERS_D) * somme('F') + PART_LANCERS_D * somme('D');

  const coteDef = 0.5 * (
    POIDS_TRIO.reduce((a, w, u) => a + w * unites.F[u].coteDef, 0) +
    POIDS_PAIRE.reduce((a, w, u) => a + w * unites.D[u].coteDef, 0));

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
  const Fbar = moyU('F', POIDS_TRIO), Dbar = moyU('D', POIDS_PAIRE);
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

  return {
    unites,
    ...speciales,
    patineurs,
    // L'indiscipline : combien cet alignement prend de punitions, relativement
    // à un alignement de réguliers moyens de la même époque. 1 = la moyenne.
    discipline: patineurs.length
      ? borne(patineurs.reduce((a, p) => a + punitionsRel(p), 0) / patineurs.length, DISCIPLINE_MIN, DISCIPLINE_MAX)
      : 1,
    annee: anneeDe(habilles),
    // Les occasions d'avantage de cet alignement : mesurées par saison quand
    // les shards les portent, repère d'époque sinon (voir occasionsDe).
    occasions: patineurs.length ? patineurs.reduce((a, p) => a + occasionsDe(p), 0) / patineurs.length : null,
    pression: borne(pression, 0.40, REF.pression * PRESSION_MAX),
    finEquipe, creaEquipe,
    finitionFacteur: Math.min(1, FINITION_MAX / finEquipe),
    zDef: borne((coteDef - MOY_DEF_EQUIPE) / ECART_DEF_EQUIPE, -5, 3),
    traitDef: facteurDefensifEquipe(habilles),
    traitRob: bonusRobustesseEquipe(habilles),
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
 *                 tire donc au POIDS OFFENSIF de l'unité qui défendait (avec
 *                 l'appariement), pas à sa présence seule. Crédit seulement :
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
export const P_MELANGE = 0.40;
export const RYTHME_CREDIT = 0.5;   // 0 : le −1 à la présence seule ; 1 : au poids offensif entier

/**
 * Une unité tirée à la présence, appariée au rang d'une autre : l'unité qui
 * défend contre le trio qui attaque, ET la paire qui accompagne son propre
 * trio (la première paire joue avec le premier trio — c'est ce qui lui
 * donne son +/- dans la vraie ligue, +9 contre −1 sans ça).
 */
function choisirApparie(unites, rangOff, nOff, k = APPARIEMENT, cle = 'presence') {
  if (!unites.length) return unites[0];
  const nDef = unites.length;
  const cible = nOff > 1 ? rangOff / (nOff - 1) : 0;
  // `rythme` : la présence, inclinée vers le poids offensif (voir RYTHME_CREDIT).
  const de = x => (cle === 'rythme' ? x.presence * Math.pow((x.poids || x.presence) / (x.presence || 1), RYTHME_CREDIT) : (x[cle] || x.presence));
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
    * facteurTraitGardien(gardien, series);
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
      dTrio = choisirApparie(unitesDef.F, rangOff, nOff);
      dPaire = choisirApparie(unitesDef.D, rangOff, nOff);
      defGlace = [...dTrio.joueurs, ...dPaire.joueurs];
      const z = borne((0.5 * (dTrio.coteDef + dPaire.coteDef) - MOY_DEF_EQUIPE) / ECART_DEF_EQUIPE, -5, 3);
      // Le bidirectionnel (et le Selke) étouffe PENDANT SES PRÉSENCES : c'est
      // le seul trait qui passe par ici, voir EFFET dans js/traits.js.
      facteurDef = Math.max(0.55, 1 - K_DEFENSE * (z - REF.zDef)) * facteurPresenceUnite(defGlace);
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

    const p = borne(
      CIBLE_PCT_TIR
        * (tireur ? pctTirRel(tireur) : (off.pctTirDefaut ?? RAPPEL_PCT_TIR)) / REF.pctTir * crea
        * (fg / REF.fg) * facteurDef * facteurRob * traits * (unite ? unite.qualite : 1) * chance
        * (off.finitionFacteur ?? 1) * qualite * (mode === 'FE' && st ? FE_QUALITE : 1),
      0.005, PCT_TIR_MAX);

    if (feuille && tireur) tireur.simSH = (tireur.simSH || 0) + 1;
    if (journal) journal.tirs[cote][periodeDe(instant)]++;
    // Chaque lancer entre au journal avec son tireur et son gardien : c'est
    // ce que le direct des séries rejoue, tir par tir. Le sommaire, lui, ne
    // lit que les buts.
    const lancer = journal ? { cote, instant, tireur, gardien, but: false, mode } : null;
    if (lancer) journal.lancers.push(lancer);

    if (hasard() < p) {
      buts++;
      if (lancer) lancer.but = true;
      if (journal && tireur) {
        journal.buts.push({ cote, instant, marqueur: tireur, passeurs: [], gardien, an: mode === 'AN', dn: mode === 'DN' });
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
              const cTrio = choisirApparie(unitesDef.F, rangOff, nOff, APPARIEMENT, 'rythme');
              const cPaire = choisirApparie(unitesDef.D, rangOff, nOff, APPARIEMENT, 'rythme');
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
    if (hasard() < injuryChance(p, heavy)) {
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
export function playGame(A, B, gameIdx, track = true, series = false, journal = null, ronde = 0) {
  const heavy = gameIdx % 4 === 3;
  const LA = activeLineup(A), LB = activeLineup(B);
  const sA = teamStrength(A, LA), sB = teamStrength(B, LB);
  const gA = pickGoalie(LA, A.games, A), gB = pickGoalie(LB, B.games, B);

  const pA = profilMatch(A, LA), pB = profilMatch(B, LB);
  pA.rob = sA.rob; pB.rob = sB.rob;

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
export function simulateLeague(teams, games = 82, { graine = null } = {}) {
  // La saison porte sa graine : donnée, elle rejoue la même ; absente, on en
  // tire une et on la rend, pour que « Rejouer » et l'historique la gardent.
  // Le générateur reste en place après : les séries, jouées ensuite par
  // l'interface, continuent la même suite.
  if (graine === null || graine === undefined) graine = nouvelleGraine();
  grainerHasard(graine);
  for (const t of teams) {
    for (const s of SLOTS) if (t.roster[s.i]) initSimStats(t.roster[s.i]);
    t.strength = teamStrength(t);   // à pleine santé, pour les barres du résultat
    // La chance de saison est tirée ICI, sous la graine, et non à
    // `createTeam` : sinon deux saisons de même graine différaient déjà
    // avant le premier lancer (check_graine.mjs l'a attrapé).
    t.luck = gauss() * LUCK_SEASON;
  }
  // Le calendrier : une journée par ronde, ses seize matchs avec leur
  // pointage. C'est ce que l'écran rejoue jour après jour, et ce qu'on peut
  // consulter après pour vérifier la saison de n'importe quelle équipe.
  const calendrier = [];
  // Ce qu'il reste à jouer à chaque équipe. Une journée apparie tout le monde
  // quand l'effectif est pair ; sinon celle qui a le moins de matchs à jouer
  // est en congé, ce qui garde les restes à un match les uns des autres et
  // fait retomber tout le monde sur `games` à la fin.
  const restant = new Map(teams.map(t => [t, games]));
  for (let r = 0; restant.size; r++) {
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
