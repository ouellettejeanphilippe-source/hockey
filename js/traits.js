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
 * D'où DEUX ÉTAGES, et rien d'autre.
 *
 * LES VOTÉS (`data/trophees.js`) — scrutins publics, population complète et
 * vérifiable, une saison à la fois :
 *
 *   SELKE    le meilleur attaquant défensif      → moins de buts alloués
 *   NORRIS   le meilleur défenseur               → moins de buts alloués
 *   VEZINA   le meilleur gardien                 → un facteur sur chaque lancer qu'il voit
 *   SMYTHE   le plus utile des SÉRIES            → en séries seulement
 *
 * LES RÉPUTATIONS (`data/reputations.js`) — le consensus des amateurs, sur
 * toute une carrière, là où aucune colonne ne parle :
 *
 *   VITESSE   le patinage                        → il obtient plus de lancers
 *   TIR       la puissance du lancer             → SES lancers entrent plus
 *   CREATEUR  la vision                          → son équipe finit mieux
 *   MENEUR    l'ascendant                        → prolongation et séries
 *   COLOSSE   le poids physique                  → l'adversaire finit moins bien
 *   VOLEUR    le gardien qu'on se rappelle       → il laisse passer moins
 *
 * VOLEUR rachète au passage le trou du Vezina : avant 1981-82 ce trophée
 * n'était pas un vote, donc Dryden, Parent, Tony Esposito et Giacomin
 * n'avaient aucun trait alors qu'ils sont exactement les gardiens dont on se
 * souvient.
 *
 * Les deux étages obéissent à la même règle et se complètent : un vote dit ce
 * qu'une SAISON valait, une réputation dit ce qu'un JOUEUR était. Ni l'un ni
 * l'autre n'est dans le sommaire.
 *
 * UN TRAIT APPARTIENT AU JOUEUR, PAS À SA CASE. Il rend partout dans
 * l'alignement : un lauréat du Selke au quatrième trio défend aussi bien
 * qu'au premier. C'est le malus de zone qui punit de mal placer un joueur, et
 * il le fait déjà ; faire porter la punition deux fois reviendrait à dire
 * qu'un Selke oublie comment défendre quand on l'écrit sur la troisième ligne
 * de la feuille. Seule condition : être HABILLÉ. Un trait sur un réserviste ne
 * compte pas — il regarde le match.
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
import { REPUTATIONS, AGE_MAX_VITESSE } from '../data/reputations.js';
import { ageAtSeason } from './ratings.js';

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
  VITESSE: {
    label: 'Patineur foudroyant', short: 'Vitesse', icon: '⚡', reputation: true,
    desc: 'Sa vitesse lui ouvre des occasions que le sommaire ne compte pas',
  },
  TIR: {
    label: 'Lancer redouté', short: 'Lancer', icon: '💣', reputation: true,
    desc: 'La puissance et la précision de son tir, pas son volume',
  },
  MENEUR: {
    label: 'Meneur d\'hommes', short: 'Meneur', icon: '🧭', reputation: true,
    desc: 'Le gars qu\'on veut sur la glace en prolongation et en avril',
  },
  COLOSSE: {
    label: 'Présence physique', short: 'Colosse', icon: '🥊', reputation: true,
    desc: 'Son poids physique pèse sur l\'adversaire toute la soirée',
  },
  CREATEUR: {
    label: 'Créateur de jeu', short: 'Créateur', icon: '🪄', reputation: true,
    desc: 'Sa vision rend toute son équipe plus dangereuse',
  },
  VOLEUR: {
    label: 'Gardien légendaire', short: 'Voleur', icon: '🧤', reputation: true,
    desc: 'Le gardien dont on se rappelle les arrêts, toutes époques',
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
 * lancers que son équipe concède.
 *
 * Les nombres sont petits parce qu'ils s'appliquent à TOUT le match et non
 * aux seules présences du joueur. Deux pour cent sur 230 buts alloués, c'est
 * cinq buts ; une équipe qui en porte trois ou quatre en sauve dix. Le
 * réglage vise cette sortie-là, mesurée par `scripts/check_traits.mjs` : un
 * trait doit se voir dans la colonne des buts alloués sans décider la saison.
 *
 * À MESURER, et c'est assumé : la mesure qui trancherait — les buts alloués à
 * forces égales pendant ses présences — n'existe pas dans des données
 * publiques avant 2007. On prend donc le bas de la fourchette plausible.
 */
export const EFFET = {
  //                        gagnant  finaliste
  SELKE:   { defense:       [0.980,  0.990] },
  NORRIS:  { defense:       [0.980,  0.990] },
  VEZINA:  { gardien:       [0.960,  0.980] },
  SMYTHE:  { series:        [1.030,  1.030], seriesGardien: [0.960, 0.960] },

  /*
   * Les réputations agissent sur des canaux à elles, jamais sur ceux des
   * votes, pour qu'on puisse mesurer les deux étages séparément.
   *
   * VITESSE et TIR portent sur le JOUEUR — son volume de lancers, la
   * probabilité que les siens entrent. Ils le suivent donc partout, y compris
   * au quatrième trio, sans qu'il faille rien de plus.
   *
   * CREATEUR, MENEUR et COLOSSE portent sur l'équipe. COLOSSE est le plus
   * faible du lot parce qu'il est le plus discutable : l'intimidation est
   * réelle, sa taille ne l'est pas.
   *
   * LES MAGNITUDES SUIVENT LA LONGUEUR DE LA LISTE. Passer de 86 à 215
   * entrées a fait grimper l'effet d'une grande équipe de +3,9 à +5,5
   * victoires sans qu'on touche à un seul nombre : une équipe des années
   * Lemieux porte treize traits, pas quatre. Vitesse et lancer sont donc
   * redescendus de 1,060 et 1,050 à 1,035 et 1,030. Allonger `reputations.js`
   * sans refaire tourner `check_traits.mjs` gonflerait les grandes équipes en
   * silence — c'est le piège de ce fichier-ci.
   */
  VITESSE:  { lancers:      [1.035,  1.035] },
  TIR:      { finition:     [1.030,  1.030] },
  CREATEUR: { attaque:      [1.006,  1.006] },
  MENEUR:   { meneur:       [2.000,  2.000], series: [1.010, 1.010] },
  COLOSSE:  { defense:      [0.997,  0.997] },
  VOLEUR:   { gardien:      [0.988,  0.988] },
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

/** Réputations : indexées par NOM, parce qu'elles valent pour la carrière. */
const REPUT = new Map();
for (const [cle, noms] of Object.entries(REPUTATIONS)) {
  for (const n of noms) {
    const l = REPUT.get(n) || [];
    l.push(cle);
    REPUT.set(n, l);
  }
}

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
  for (const k of REPUT.get(p.n) || []) {
    // Une réputation de vitesse ne survit pas aux jambes qui la portaient.
    if (k === 'VITESSE') {
      const age = ageAtSeason(p.bd, p.s);
      if (age && age > AGE_MAX_VITESSE) continue;
    }
    out.push({ cle: k, niveau: 0, reputation: true });
  }
  CACHE.set(cle, out);
  return out;
}

/*
 * SATURATION DES CANAUX D'ÉQUIPE. Mesuré : le meilleur alignement légal sous
 * le plafond ramasse 25 traits, contre 9 au Canadien de 1976-77 — parce que
 * l'optimiseur choisit les joueurs les mieux cotés, qui sont exactement les
 * joueurs marquants. Sans borne, les traits deviennent un deuxième axe
 * d'empilement par-dessus les cotes, et la Coupe de cet alignement passe à
 * 67 %.
 *
 * Le quatrième Norris d'un vestiaire n'apporte pas autant que le premier :
 * on ne défend pas deux fois la même rondelle. Les canaux d'ÉQUIPE sont donc
 * bornés. Les canaux de JOUEUR (vitesse, lancer) ne le sont pas : ils portent
 * sur les lancers de leur porteur, donc ils ne s'additionnent pas.
 */
export const BORNES = {
  defense: 0.94,   // plancher : au mieux 6 % de buts en moins
  attaque: 1.05,   // plafond
  series: 1.06,
  gardien: 0.94,
};

const produit = (p, champ) => {
  let f = 1;
  for (const t of getTraits(p)) {
    const e = EFFET[t.cle]?.[champ];
    if (e) f *= e[t.niveau] ?? 1;
  }
  return f;
};

/**
 * Facteur sur la probabilité qu'un lancer devienne un but, pour toute
 * l'équipe. En dessous de 1 = elle étouffe. `joueurs` est l'alignement
 * HABILLÉ : un trait sur un réserviste ne compte pas.
 */
export function facteurDefensifEquipe(joueurs) {
  let f = 1;
  for (const p of joueurs) if (p && p.p !== 'G') f *= produit(p, 'defense');
  return Math.max(BORNES.defense, f);
}

/** Facteur sur le gardien : en dessous de 1 = il laisse passer moins. */
export function facteurTraitGardien(gardien, series = false) {
  if (!gardien) return 1;
  let f = produit(gardien, 'gardien');
  if (series) f *= produit(gardien, 'seriesGardien');
  return Math.max(BORNES.gardien, f);
}

/** Volume de lancers d'un joueur : sa vitesse lui en donne plus. */
export function facteurLancersJoueur(p) {
  return produit(p, 'lancers');
}

/** Finition d'un joueur : son lancer entre plus souvent. */
export function facteurFinitionJoueur(p) {
  return produit(p, 'finition');
}

/**
 * Points de clutch qu'apportent les meneurs d'un alignement, pour la
 * prolongation. Plafonné : quatre capitaines ne valent pas quatre fois un.
 */
export function bonusMeneurEquipe(joueurs) {
  let n = 0;
  for (const p of joueurs) for (const t of getTraits(p)) if (t.cle === 'MENEUR') n++;
  return Math.min(9, n * (EFFET.MENEUR.meneur[0]));
}

/**
 * Facteur offensif d'équipe : la vision des créateurs, sur tous les lancers.
 * `joueurs` est l'alignement habillé.
 */
export function facteurAttaqueEquipe(joueurs) {
  let f = 1;
  for (const p of joueurs) if (p && p.p !== 'G') f *= produit(p, 'attaque');
  return Math.min(BORNES.attaque, f);
}

/**
 * Facteur offensif d'équipe EN SÉRIES. Le Conn Smythe ne rend qu'en avril :
 * c'est tout l'intérêt du trait, et le seul du lot qui distingue la saison des
 * séries.
 */
export function facteurSeriesEquipe(joueurs) {
  let f = 1;
  for (const p of joueurs) if (p && p.p !== 'G') f *= produit(p, 'series');
  return Math.min(BORNES.series, f);
}
