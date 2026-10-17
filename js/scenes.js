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
  // LE PALIER DE LA SAISON (A2) : le proprio, aux 9e, 18e et 26e matchs.
  palier: {
    fond: [
      'Je vous ai laissé trois enveloppes sur le bureau. Prenez celle qui nous sort du fond.',
      'Trois enveloppes sur votre bureau. Je veux voir ce club remonter, pas des excuses.',
    ],
    milieu: [
      'Trois enveloppes sur votre bureau. Choisissez celle qui nous pousse du bon bord.',
      'On n\'est ni dans le trouble ni dans le portrait. Prenez celle qui fait pencher la saison.',
    ],
    haut: [
      'Trois enveloppes, et une équipe qui gagne. Prenez celle qui garde la machine en marche.',
      'Ça va bien, et je veux que ça dure. Choisissez celle qui nous garde en avant.',
    ],
  },
  // UNE CARTE DE TROP (A7) : le préposé à l'équipement, quand les places débordent.
  trop: {
    calme: [
      'Mes casiers débordent. On en vend une, ou on la sort ce soir ?',
      'Il me manque un casier. Dis-moi laquelle part, ou laquelle sert ce soir.',
    ],
    gros: [
      'Mes casiers débordent, et un gros match s\'en vient. Garde celle qui va servir contre eux.',
      'Il me manque un casier. Avant le gros match, je vendrais celle qui ne servira pas.',
    ],
  },
};

/** Le rang en mots courts du classement : 1er, 2e… */
const rangMot = r => (r === 1 ? '1er' : `${r}e`);

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
 * A2 · LES PALIERS DES 9e, 18e ET 26e MATCHS. Le proprio, qui vouvoie. Le fait : la fiche après n matchs, le rang, et
 * ce que le mandat demande.
 *   n          les matchs joués ; fiche : { V, D, DP } ; rang : la place au classement, sur `equipes` ;
 *   mandat     le mot du mandat (`mandatDe(...).mot`) ; graine : la partie
 */
export function sceneDuPalier({ n, fiche, rang, equipes = 32, mandat = '', graine = '' }) {
  const sit = rang <= equipes / 4 ? 'haut' : rang > (3 * equipes) / 4 ? 'fond' : 'milieu';
  return {
    de: EXPEDITEURS.pr,
    mot: piger(MOTS_DES_SCENES.palier[sit], graine, 'palier', n),
    fait: `${fiche.V}-${fiche.D}-${fiche.DP} après ${n} matchs · ${rangMot(rang)}${mandat ? ` · le mandat : ${mandat}` : ''}`,
  };
}

/*
 * A7 · UNE CARTE DE TROP. Le préposé à l'équipement. Le fait : les cartes et les places, et le prochain gros match
 * s'il vient.
 *   cartes, places   combien tu en as, combien en tiennent ; gros : { adv, dans } — le prochain gros match, ou null
 */
export function sceneDeLaCarteDeTrop({ cartes, places, gros = null, graine = '' }) {
  const vient = gros ? `${gros.dans === 0 ? 'ce soir' : gros.dans === 1 ? 'demain' : `dans ${gros.dans} jours`}` : '';
  return {
    de: EXPEDITEURS.eq,
    mot: piger(MOTS_DES_SCENES.trop[gros ? 'gros' : 'calme'], graine, 'trop', cartes),
    fait: `${cartes} cartes pour ${places} places${gros ? ` · gros match contre ${gros.adv} ${vient}` : ''}`,
  };
}
