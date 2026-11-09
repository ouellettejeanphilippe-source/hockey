/*
 * LES SCÈNES (Jalon M, docs/mise-en-scene-et-mobile.md). JP, 17 oct. : *on n'explique pas pourquoi faire un choix
 * plutôt qu'un autre ; pas de mise en scène, pas de contexte narratif*. Le modèle, ce sont les fils (`messageDuFil`,
 * js/vie-gm.js) : une voix, un enjeu, un suivi.
 *
 * Une scène dit QUI demande (une voix d'`EXPEDITEURS`), POURQUOI MAINTENANT (le fait, lu dans ce qui est déjà joué,
 * avec ses vrais chiffres) et ce qu'elle en pense (le mot : une phrase, une opinion, AUCUN chiffre — check_fils). Ce
 * que le choix coûte et rapporte reste à ses options. Chaque scène est une fonction pure de ses faits, partagée avec
 * Node : `scripts/check_clarte.mjs` (§ 5) les éprouve toutes, sur toutes leurs répliques.
 *
 *   { de, mot, fait }   de : la voix ; mot : sa réplique ; fait : la ligne de chiffres sous la citation
 */
import { EXPEDITEURS } from './vie-gm.js';
import { hache } from './util.js';

/** La réplique d'une scène, pigée sur la graine du jeu et son moment : la même partie redit la même phrase. */
const piger = (mots, ...cle) => mots[Math.floor(hache(...cle.map(String)) * mots.length) % mots.length];

/*
 * Les répliques, par scène et par situation. Une voix tutoie, sauf le proprio, qui vouvoie (EXPEDITEURS).
 */
export const MOTS_DES_SCENES = {
  // LA BLESSURE (A4) : le médecin, selon la longueur de l'absence.
  blessure: {
    court: ['Rien de grave. Il sera de retour avant que tu t\'ennuies de lui.',
      'Une petite absence. Je le garde sur ma table, et je te le rends.'],
    long: ['Ça va être long. Il faut quelqu\'un pour sa case, et vite.',
      'Je n\'aime pas ce que je vois. Prépare-toi à jouer sans lui un bon bout.'],
  },
  // LE BUTIN D'UN GROS MATCH GAGNÉ (A6) : l'entraîneur veut une page de plus, ton adjoint trouve le cahier épais.
  butin: {
    serre: ['On l\'a arraché. Prends quelqu\'un pour les prochains soirs, on en aura besoin.',
      'Ça s\'est joué à rien. Un adjoint de plus, et le prochain sera moins serré.'],
    large: ['On les a déclassés. Prends celui qui garde la machine en marche.',
      'Une soirée de même, ça se récompense. Choisis qui vient m\'aider derrière le banc.'],
  },
};

/*
 * A4 · LA BLESSURE. Le médecin. Le fait : le blessé, ses matchs d'absence, sa case, le prochain adversaire.
 *   joueur   son nom ; n : les matchs qui restent ; total : la blessure entière ; ou : sa case, ou '' ; adv : le prochain club, ou ''
 */
export function sceneDeLaBlessure({ joueur, n, total = n, ou = '', adv = '', graine = '' }) {
  return {
    de: EXPEDITEURS.me,
    mot: piger(MOTS_DES_SCENES.blessure[n >= 8 ? 'long' : 'court'], graine, 'blessure', joueur, total),
    fait: `${joueur} : ${n} match${n > 1 ? 's' : ''} d'absence${total > n ? ` (${total} en tout)` : ''}${ou ? ` · ${ou}` : ''}${adv ? ` · prochain match contre ${adv}` : ''}`,
  };
}

/*
 * A6 · LE BUTIN D'UN GROS MATCH GAGNÉ. L'entraîneur. Le fait : le pointage de la feuille (un adjoint parmi trois, V16).
 *   pour, contre   le pointage ; adv : le club battu
 */
export function sceneDuButin({ pour, contre, adv, graine = '' }) {
  return {
    de: EXPEDITEURS.en,
    mot: piger(MOTS_DES_SCENES.butin[pour - contre >= 3 ? 'large' : 'serre'], graine, 'butin', adv),
    fait: `${pour}–${contre} contre ${adv}`,
  };
}
