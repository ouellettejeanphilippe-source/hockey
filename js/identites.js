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
/* S79 : les rôles (profilsDe) ; une clé peut en nommer plusieurs, ils se moyennent. */
const profil = (cleF, cleD) => p => {
  if (!p || p.p === 'G') return 0.5;
  const pr = profilsDe(p);
  if (!pr) return 0.5;
  const k = estD(p) ? cleD : cleF;
  if (!k) return 0.5;
  const ks = Array.isArray(k) ? k : [k];
  return ks.reduce((a, x) => a + (pr[x] || 0), 0) / ks.length / 100;
};
const age = p => ageAtSeason(p && p.bd, p && p.s);
/* La production par match : points pour un patineur, % d'arrêts ramené à la même échelle pour un gardien. */
const prod = p => (p.p === 'G' ? borne01(((p.sv || 0.88) - 0.88) / 0.04) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));

export const IDENTITES = {
  francs: { ico: '🎯', nom: 'Les francs-tireurs', rarete: 'commune',
    texte: 'La roulette sort plus souvent des gâchettes : des avants qui marquent, des défenseurs qui décochent de la bleue.',
    score: profil('sniper', 'offensif') },
  passeurs: { ico: '🪄', nom: 'Les passeurs', rarete: 'commune',
    texte: 'Plus de fabricants de jeu : des centres qui voient tout, des défenseurs qui relancent.',
    score: profil('passeur', 'manieur') },
  costauds: { ico: '🦍', nom: 'La grosse équipe', rarete: 'commune',
    texte: 'Plus de joueurs lourds et robustes : ça cogne, ça tient les soirs éreintants et les séries.',
    score: profil('power', 'physique') },
  rapides: { ico: '⚡', nom: 'Les patineurs', rarete: 'commune',
    texte: 'Plus de jambes : des petits rapides qui lancent de partout.',
    score: profil('energie', 'manieur') },
  defensive: { ico: '🧱', nom: 'La brigade défensive', rarete: 'peu',
    texte: 'Plus de joueurs de devoir : des avants défensifs, des défenseurs purs. On gagne 2-1.',
    score: profil(['deuxsens', 'checker'], 'defensif') },
  artistes: { ico: '🎨', nom: 'Les artistes', rarete: 'peu',
    texte: 'Plus de créatifs, ceux qui passent ET qui marquent.',
    score: profil(['sniper', 'passeur'], ['offensif', 'manieur']) },
  jeunesse: { ico: '🐣', nom: 'La jeunesse', rarete: 'peu',
    texte: 'Plus de jeunes de 23 ans et moins, ceux qui éclosaient cette saison-là.',
    score: p => { const a = age(p); return a == null ? 0.3 : borne01((27 - a) / 6); } },
  veterans: { ico: '🧓', nom: 'Les vieux routiers', rarete: 'peu',
    texte: 'Plus de vétérans de 31 ans et plus : ils ont tout vu, et ils coûtent souvent moins cher.',
    score: p => { const a = age(p); return a == null ? 0.3 : borne01((a - 27) / 8); } },
  aubaines: { ico: '💰', nom: 'Les aubaines', rarete: 'rare',
    texte: 'Plus de joueurs qui produisent beaucoup pour leur salaire : le métier de directeur général, en accéléré.',
    score: p => borne01(prod(p) / Math.max(0.35, (p.$ || 1e6) / 1e6) / (p.p === 'G' ? 1 : 0.9)) },
  // S74b : trois de plus, de ce que les données disent de chacun (la taille, en pouces ; la production).
  geants: { ico: '🗼', nom: 'Les géants', rarete: 'peu',
    texte: 'Plus de grands gabarits, six pieds trois et plus : ils ferment l\'enclave et prennent les coins.',
    score: p => (p && p.hgt ? borne01((p.hgt - 72) / 4) : 0.3) },
  follets: { ico: '🐇', nom: 'Les feux follets', rarete: 'peu',
    texte: 'Plus de petits joueurs vifs, cinq pieds dix et moins : impossibles à attraper.',
    score: p => (p && p.hgt ? borne01((74 - p.hgt) / 4) : 0.3) },
  vedettes: { ico: '🌟', nom: 'Les vedettes', rarete: 'rare',
    texte: 'Plus de joueurs qui ont fait lever la foule cette saison-là — et qui coûtent en conséquence.',
    score: p => (p.p === 'G' ? prod(p) : borne01(prod(p) / (estD(p) ? 0.75 : 1.1))) },
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
