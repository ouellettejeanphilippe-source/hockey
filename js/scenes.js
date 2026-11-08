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
  // LA MISE DOUBLÉE (A1) : le capitaine, avant la 3e d'un duel de saison.
  mise: {
    mene: [
      'Le vestiaire veut doubler. On mène : on ferme la porte et on encaisse.',
      'Les gars sentent le coup. Si on double, on joue la dernière comme une finale.',
    ],
    egal: [
      'Le vestiaire veut doubler. Une période pour tout prendre ; si on l\'échappe, on va traîner ça longtemps.',
      'Tout se joue maintenant. Moi, je doublerais, mais c\'est toi qui signes.',
    ],
    derriere: [
      'On tire de l\'arrière, et le vestiaire y croit encore. Doubler, c\'est se mettre le couteau sous la gorge.',
      'Les gars veulent la remonter. Si on double et qu\'on la perd, ça va faire mal longtemps.',
    ],
  },
  // L'ENTRACTE DU DUEL (V17) : ton adjoint, avant chaque période ; la réplique suit sa première idée.
  adjoint: {
    ombre: ['Ils vont lui coller un homme aux fesses. Moi, je ferais tirer tout le monde.', 'Leur ombre le suit partout. On peut la noyer sous les tirs.'],
    chasse: ['Ils vont chercher notre défenseur. Restons propres, qu\'ils écopent tout seuls.', 'Ça va brasser sur notre brigade. On garde la tête froide.'],
    centre: ['Le milieu est fermé. Il faut tirer de partout, des pointes, des coins.', 'Ils bouchent le centre. On ne passera pas par là : on lance.'],
    assaut: ['Ils vont débouler. Moi, je fermerais le centre et je les laisserais tirer de loin.', 'Ça va lancer de partout. On resserre devant le filet.'],
    cachot: ['Ils veulent nous envoyer au cachot. Les bâtons en bas, pas de niaiseries.', 'Ils vont nous provoquer toute la période. On ne mord pas.'],
    mene: ['On mène. On ferme la porte et on fait jouer l\'horloge.', 'Une période à tenir. Pas de cadeau au centre.'],
    traine: ['On tire de l\'arrière. Il faut aller les chercher dans leur zone.', 'Vingt minutes pour la remonter. On met de la pression.'],
    jambes: ['Les gars sont brûlés. On joue propre et on ménage les jambes.', 'Ça pèse dans les jambes. Pas question de courir partout.'],
    vedette: ['Leur meilleur, je le ferais suivre de près.', 'Si on éteint leur vedette, le reste suivra.'],
  },
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
 * A1 · DOUBLER LA MISE. Le capitaine, avant la 3e période d'un duel de saison. Le fait : le pointage après deux
 * périodes contre le rival nommé, et ce qui reste à jouer.
 *   moi, lui   le pointage après deux périodes ; rival : le nom court du club ; graine : la partie et le soir
 */
export function sceneDeLaMise({ moi, lui, rival, graine = '' }) {
  const sit = moi > lui ? 'mene' : moi === lui ? 'egal' : 'derriere';
  const pointage = moi > lui ? `${moi}–${lui} pour toi` : moi === lui ? `${moi}–${lui}` : `${moi}–${lui} contre toi`;
  return { de: EXPEDITEURS.ca, mot: piger(MOTS_DES_SCENES.mise[sit], graine, 'mise', moi, lui), fait: `Contre ${rival} : ${pointage}, une période à jouer` };
}

/*
 * L'ENTRACTE DU DUEL (V17). Ton adjoint, avant chaque période. Le fait : leur intention annoncée (et qui elle vise),
 * le pointage, ce qui reste à jouer.
 *   intention : { ico, nom } ; cible : le nom de ton joueur visé, ou '' ; raison : la clé de sa première idée ;
 *   moi, lui : le pointage ; k : la période qui vient (0 à 2) ; rival : le nom court du club ; graine : la partie et le soir
 */
export function sceneDeLAdjoint({ intention, cible = '', raison, moi = 0, lui = 0, k = 0, rival = '', graine = '' }) {
  const mots = MOTS_DES_SCENES.adjoint[raison] || MOTS_DES_SCENES.adjoint.vedette;
  const quand = ['Avant la 1re', 'Avant la 2e', 'Avant la 3e'][k] || '';
  const pointage = k ? ` · ${moi}–${lui}` : '';
  return { de: EXPEDITEURS.ad, mot: piger(mots, graine, 'adjoint', k, raison), fait: `${quand} contre ${rival}${pointage} · ils annoncent ${intention.ico} ${intention.nom}${cible ? ` sur ${cible}` : ''}` };
}

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
