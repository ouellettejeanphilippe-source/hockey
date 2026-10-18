/*
 * DES EFFETS TÉMOINS POUR LES JUGES (V10, tranche 6). L'ancien jeu est parti — les cartes de saison, le personnel
 * d'avant — et plusieurs juges avaient besoin d'un effet de toute la saison, au chiffre connu, pour éprouver le moteur
 * (les totaux, le profil du soir, l'impact, les causes, la graine). Ce sont des patrons qui portent leurs chiffres, comme
 * toute décision (`appliquerDecision`, js/sim.js) : aucune carte du jeu, aucun moment, un rôle chacun.
 */
const T = {
  bloc: { role: 'chef', nom: 'Bloc de départ', ico: '🚀', finition: 1.12, defense: 1.10 },
  fougue: { role: 'physique', nom: 'La fougue', ico: '🔥', finition: 1.05, volume: 1.05, discipline: 1.30 },
  chasse: { role: 'depistage', nom: 'La chasse', ico: '🏒', volume: 1.11, finition: 0.915 },
  ecole: { role: 'direction', nom: 'L\'école de tir', ico: '🎯', finition: 1.10, volume: 0.89 },
  attaque: { role: 'attaque', nom: 'L\'adjoint à l\'attaque', ico: '🏒', volume: 1.07, defense: 1.021 },
  defense: { role: 'defense', nom: 'L\'adjoint à la défensive', ico: '🧱', defense: 0.944, volume: 0.986 },
};
export const TEMOINS_DE_SAISON = Object.keys(T);
/** La décision d'un témoin : `{ patron: { cle, role, nom, ico, ...canaux } }`. */
export const temoin = cle => ({ patron: { cle: `temoin_${cle}`, ...T[cle] } });
