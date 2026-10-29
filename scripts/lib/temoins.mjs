/*
 * DES EFFETS TÉMOINS POUR LES JUGES (V10, tranche 6 ; V21). L'ancien jeu est parti — les cartes de saison, le personnel
 * — et plusieurs juges avaient besoin d'un effet de toute la saison, au chiffre connu, pour éprouver le moteur (les
 * totaux, le profil du soir, l'impact, les causes, la graine). Ce sont des effets de décision qui portent leurs chiffres
 * (`appliquerDecision`, js/sim.js) : aucune carte du jeu, aucun moment, aucun pouvoir.
 */
const T = {
  bloc: { nom: 'Bloc de départ', ico: '🚀', finition: 1.12, defense: 1.10 },
  fougue: { nom: 'La fougue', ico: '🔥', finition: 1.05, volume: 1.05, discipline: 1.30 },
  chasse: { nom: 'La chasse', ico: '🏒', volume: 1.11, finition: 0.915 },
  ecole: { nom: 'L\'école de tir', ico: '🎯', finition: 1.10, volume: 0.89 },
  attaque: { nom: 'L\'adjoint à l\'attaque', ico: '🏒', volume: 1.07, defense: 1.021 },
  defense: { nom: 'L\'adjoint à la défensive', ico: '🧱', defense: 0.944, volume: 0.986 },
};
export const TEMOINS_DE_SAISON = Object.keys(T);
/** La décision d'un témoin, toute la saison : `{ effet: { nom, ico, duree, ...canaux } }`. */
export const temoin = cle => ({ effet: { ...T[cle], duree: 200 } });
/** Le même témoin posé tel quel sur une équipe (`team.effets`), du premier soir au dernier. */
export const effetTemoin = cle => ({ debut: 0, fin: Infinity, source: 'decision', ...T[cle] });
