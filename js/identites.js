/**
 * L'IDENTITÉ DE DÉPART (S73) — la carte qu'on pige avant le premier tour.
 *
 * JP : *il pourrait même avoir un choix au début qui influence en mode loto
 * le type de joueurs qu'ils sortent plus souvent*. C'est la bénédiction de
 * Neow dans Slay the Spire : avant la première salle, trois cartes, une à
 * garder, et elle colore toute la course. Ici, elle colore le REPÊCHAGE : la
 * roulette sort plus souvent le type de joueur qu'elle nomme.
 *
 * COMMENT, SANS TRICHER. La roulette ne triche pas sur les joueurs : elle tire
 * DEUX clubs là où elle en tirait un, et garde celui dont le joueur offert
 * colle le mieux à l'identité (en loto : le joueur que le club met à la case
 * de la main ; au vestiaire : le meilleur joueur du club pour une case
 * libre). C'est un « meilleur de deux » : l'identité sort plus souvent, pas
 * toujours, et chaque carte reste un vrai joueur d'un vrai club.
 *
 * LE SCORE D'UN JOUEUR (0 à 1) ne lit AUCUNE cote — c'est une règle du
 * dépôt. Il lit ses profils mesurés (profilsDe, tirés de ses vraies
 * statistiques), son âge cette saison-là, son salaire et sa production.
 */
import { profilsDe } from './sim.js';
import { ageAtSeason } from './ratings.js';

const estD = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');
const borne01 = x => Math.max(0, Math.min(1, x));
/* Un profil, 0 à 1 ; un gardien est neutre (0,5) : l'identité parle des patineurs. */
const profil = (cleF, cleD) => p => {
  if (!p || p.p === 'G') return 0.5;
  const pr = profilsDe(p);
  if (!pr) return 0.5;
  const k = estD(p) ? cleD : cleF;
  return k ? (pr[k] || 0) / 100 : 0.5;
};
const age = p => ageAtSeason(p && p.bd, p && p.s);
/* La production par match : points pour un patineur, % d'arrêts ramené à la même échelle pour un gardien. */
const prod = p => (p.p === 'G' ? borne01(((p.sv || 0.88) - 0.88) / 0.04) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));

export const IDENTITES = {
  francs: { ico: '🎯', nom: 'Les francs-tireurs', rarete: 'commune',
    texte: 'La roulette sort plus souvent des gâchettes : des avants qui marquent, des défenseurs qui décochent de la bleue.',
    score: profil('franc', 'bleue') },
  passeurs: { ico: '🪄', nom: 'Les passeurs', rarete: 'commune',
    texte: 'Plus de fabricants de jeu : des centres qui voient tout, des défenseurs qui relancent.',
    score: profil('fabricant', 'offensif') },
  costauds: { ico: '🦍', nom: 'La grosse équipe', rarete: 'commune',
    texte: 'Plus de joueurs lourds et robustes : ça cogne, ça tient les soirs éreintants et les séries.',
    score: profil('puissant', 'pur') },
  rapides: { ico: '⚡', nom: 'Les patineurs', rarete: 'commune',
    texte: 'Plus de jambes : des petits rapides qui lancent de partout.',
    score: profil('rapide', 'rapide') },
  defensive: { ico: '🧱', nom: 'La brigade défensive', rarete: 'peu',
    texte: 'Plus de joueurs de devoir : des avants défensifs, des défenseurs purs. On gagne 2-1.',
    score: profil('defensif', 'pur') },
  artistes: { ico: '🎨', nom: 'Les artistes', rarete: 'peu',
    texte: 'Plus de créatifs, ceux qui passent ET qui marquent.',
    score: profil('createur', 'createur') },
  jeunesse: { ico: '🐣', nom: 'La jeunesse', rarete: 'peu',
    texte: 'Plus de jeunes de 23 ans et moins, ceux qui éclosaient cette saison-là.',
    score: p => { const a = age(p); return a == null ? 0.3 : borne01((27 - a) / 6); } },
  veterans: { ico: '🧓', nom: 'Les vieux routiers', rarete: 'peu',
    texte: 'Plus de vétérans de 31 ans et plus : ils ont tout vu, et ils coûtent souvent moins cher.',
    score: p => { const a = age(p); return a == null ? 0.3 : borne01((a - 27) / 8); } },
  aubaines: { ico: '💰', nom: 'Les aubaines', rarete: 'rare',
    texte: 'Plus de joueurs qui produisent beaucoup pour leur salaire : le métier de DG, en accéléré.',
    score: p => borne01(prod(p) / Math.max(0.35, (p.$ || 1e6) / 1e6) / (p.p === 'G' ? 1 : 0.9)) },
};

/* Le score d'identité d'un joueur ; sans identité, tout le monde vaut pareil. */
export function scoreIdentite(cle, p) {
  const I = IDENTITES[cle];
  return I && p ? I.score(p) : 0;
}

/* Trois identités à offrir, au hasard (une nouvelle partie n'a pas de graine avant la saison). */
export function identitesOffertes(alea = Math.random) {
  const cles = Object.keys(IDENTITES);
  for (let i = cles.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [cles[i], cles[j]] = [cles[j], cles[i]]; }
  return cles.slice(0, 3);
}
