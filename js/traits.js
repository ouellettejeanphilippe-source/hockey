/**
 * Les traits : ce que la feuille de pointage ne dit pas.
 *
 * LA RÈGLE QUI TIENT CE FICHIER : un trait n'existe que là où le sommaire est
 * AVEUGLE. Le moteur lit déjà les lancers, les buts par lancer, le pourcentage
 * d'arrêts, le +/- et les matchs joués — un trait « franc-tireur » ou « homme
 * de fer » ne ferait que recompter ce que le moteur compte déjà, et il le
 * compterait moins bien. Ce qui manque au sommaire, c'est le jugement : qui
 * défendait vraiment, quel gardien tenait vraiment son équipe, qui se
 * transformait en avril. Ça, seuls les votes le portent.
 *
 * D'où quatre traits, tous tirés de `data/trophees.js`, tous issus de scrutins
 * publics dont la population est complète et vérifiable :
 *
 *   SELKE    le meilleur attaquant défensif      → moins de buts pendant ses présences
 *   NORRIS   le meilleur défenseur               → moins de buts pendant ses présences
 *   VEZINA   le meilleur gardien                 → un facteur sur chaque lancer qu'il voit
 *   SMYTHE   le plus utile des SÉRIES            → en séries seulement
 *
 * Un trait est RARE par construction : environ un pour cent des joueurs-saisons.
 * Ne pas en avoir veut dire « rien de particulier », ce qui est vrai et
 * n'invente rien — contrairement à une cote, qui doit exister pour les 33 141
 * joueurs et ment donc quand elle est inconnue.
 *
 * DEUX LIMITES, ÉCRITES ICI POUR QUE PERSONNE NE LES REDÉCOUVRE :
 *
 *  - Le Selke naît en 1977-78. Sept saisons de nos données n'ont donc aucun
 *    attaquant défensif décoré, et rien ne peut le corriger : le vote n'a pas
 *    eu lieu. C'est une asymétrie d'époque assumée, pas un oubli.
 *  - Le Vezina d'avant 1981-82 n'était PAS un vote. Il allait aux gardiens du
 *    club ayant alloué le moins de buts, ce qui récompense la brigade autant
 *    que le gardien — et le moteur mesure déjà cette brigade. Ces saisons-là
 *    sont donc écartées du trait, même si `data/trophees.js` les porte.
 */

import { SELKE, NORRIS, VEZINA, SMYTHE } from '../data/trophees.js';

/** Première saison où le Vezina est un vote sur le meilleur gardien. */
export const VEZINA_VOTE_DEPUIS = '1981-82';

export const TRAITS = {
  SELKE: {
    label: 'Attaquant défensif d\'élite', short: 'Selke', icon: '🛡️',
    desc: 'Reconnu comme le meilleur attaquant défensif de sa saison',
  },
  NORRIS: {
    label: 'Défenseur d\'élite', short: 'Norris', icon: '🧱',
    desc: 'Reconnu comme le meilleur défenseur de sa saison',
  },
  VEZINA: {
    label: 'Gardien d\'élite', short: 'Vezina', icon: '🥅',
    desc: 'Reconnu comme le meilleur gardien de sa saison',
  },
  SMYTHE: {
    label: 'Héros des séries', short: 'Conn Smythe', icon: '🏆',
    desc: 'Le plus utile des séries éliminatoires — ne rend qu\'en avril',
  },
};

/*
 * Ce que vaut un trait, et pourquoi ces nombres-là.
 *
 * `K_DEFENSE` est MESURÉ à 0,04 par écart-type d'alignement, ce qui veut dire
 * qu'un point de cote défensive vaut moins d'un pour cent de probabilité de
 * but. Faire passer un Selke par la cote `d` lui ferait donc sauver un but par
 * saison — invisible. C'est justement l'aveu du sommaire : le +/- ne voit pas
 * ce que le vote voit. Le trait agit donc en propre, sur la qualité des
 * lancers pendant ses présences.
 *
 * À MESURER, et c'est assumé : 6 % pour un gagnant est un choix prudent. Un
 * lauréat du Selke est typiquement 10 à 20 % meilleur que ses coéquipiers sur
 * les buts alloués à forces égales, mais cette mesure-là n'existe pas avant
 * 2007 dans des données publiques. On prend donc le bas de la fourchette.
 */
export const EFFET = {
  //                       gagnant  finaliste
  SELKE:  { defense:       [0.94,   0.97] },
  NORRIS: { defense:       [0.94,   0.97] },
  VEZINA: { gardien:       [0.96,   0.98] },
  SMYTHE: { series:        [1.08,   1.08], seriesGardien: [0.95, 0.95] },
};

/** Normalise une table de trophée en `saison|nom` -> 0 (gagnant) ou 1 (finaliste). */
function indexer(table, depuis = null) {
  const m = new Map();
  for (const [saison, v] of Object.entries(table)) {
    if (depuis && saison < depuis) continue;
    const gagnants = typeof v === 'string' ? [v] : Array.isArray(v) ? v : [v.gagnant];
    for (const n of gagnants) if (n) m.set(`${saison}|${n}`, 0);
    const finalistes = (v && !Array.isArray(v) && typeof v === 'object' && v.finalistes) || [];
    for (const n of finalistes) if (n && !m.has(`${saison}|${n}`)) m.set(`${saison}|${n}`, 1);
  }
  return m;
}

const INDEX = {
  SELKE: indexer(SELKE),
  NORRIS: indexer(NORRIS),
  VEZINA: indexer(VEZINA, VEZINA_VOTE_DEPUIS),
  SMYTHE: indexer(SMYTHE),
};

const CACHE = new Map();

/**
 * Les traits d'un joueur-saison : `[{ cle, niveau }]`, niveau 0 = gagnant,
 * 1 = finaliste. Tableau vide pour l'immense majorité des joueurs.
 */
export function getTraits(p) {
  if (!p || !p.s || !p.n) return [];
  const cle = `${p.s}|${p.n}`;
  if (CACHE.has(cle)) return CACHE.get(cle);
  const out = [];
  for (const [k, idx] of Object.entries(INDEX)) {
    const niveau = idx.get(cle);
    if (niveau !== undefined) out.push({ cle: k, niveau });
  }
  CACHE.set(cle, out);
  return out;
}

const produit = (p, champ) => {
  let f = 1;
  for (const t of getTraits(p)) {
    const e = EFFET[t.cle]?.[champ];
    if (e) f *= e[t.niveau] ?? 1;
  }
  return f;
};

/**
 * Facteur sur la probabilité qu'un lancer devienne un but, pendant les
 * présences de cette unité défensive. En dessous de 1 = elle étouffe.
 */
export function facteurDefensifUnite(joueurs) {
  let f = 1;
  for (const p of joueurs) f *= produit(p, 'defense');
  return f;
}

/** Facteur sur le gardien : en dessous de 1 = il laisse passer moins. */
export function facteurTraitGardien(gardien, series = false) {
  if (!gardien) return 1;
  let f = produit(gardien, 'gardien');
  if (series) f *= produit(gardien, 'seriesGardien');
  return f;
}

/**
 * Facteur offensif d'une unité EN SÉRIES. Le Conn Smythe ne rend qu'en avril :
 * c'est tout l'intérêt du trait, et le seul du lot qui distingue la saison des
 * séries.
 */
export function facteurSeriesUnite(joueurs) {
  let f = 1;
  for (const p of joueurs) if (p.p !== 'G') f *= produit(p, 'series');
  return f;
}
