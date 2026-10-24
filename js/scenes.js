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
import { DOSSIERS } from './dossiers.js';
import { MOMENTS, FAITS } from './sim.js';
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
  // LES ROUTES DE LA SEMAINE (A3) : l'entraîneur, qui recommande la route qui répond au pire problème du lundi.
  route: {
    jambes: ['Les gars sont brûlés. Moi, je prendrais le repos ; c\'est toi qui décides.',
      'Les jambes ne suivent plus. Une semaine tranquille, et je te les rends.'],
    infirmerie: ['L\'infirmerie déborde. Moi, je prendrais le repos, pour les ramener plus vite.',
      'Trop de gars sur la table du physio. Le repos d\'abord, le reste après.'],
    dos: ['Deux soirs de suite s\'en viennent, et les jambes sont justes. Le repos, si tu m\'écoutes.',
      'Le dos-à-dos va faire mal. Moi, je ménagerais les gars cette semaine.'],
    caisse: ['La caisse est vide. La commandite, et on respire.',
      'On roule sur la réserve. Moi, je prendrais l\'argent cette semaine.'],
    rien: ['Tout le monde tient debout. C\'est la semaine pour travailler : l\'entraînement.',
      'Rien ne brûle. Moi, je les ferais travailler.'],
  },
  // LA BLESSURE (A4) : le médecin, selon la longueur de l'absence.
  blessure: {
    court: ['Rien de grave. Il sera de retour avant que tu t\'ennuies de lui.',
      'Une petite absence. Je le garde sur ma table, et je te le rends.'],
    long: ['Ça va être long. Il faut quelqu\'un pour sa case, et vite.',
      'Je n\'aime pas ce que je vois. Prépare-toi à jouer sans lui un bon bout.'],
  },
  // TES RIVAUX (A5) : le proprio, qui vouvoie, au premier lundi.
  rivaux: {
    tous: ['Choisissez ceux que vous voulez battre devant moi.',
      'Je veux des noms sur mon bureau : ceux qu\'on va battre devant nos partisans.'],
    dernier: ['Il m\'en manque un. Choisissez-le bien.',
      'Un dernier nom, et je fais imprimer les affiches.'],
  },
  // LE MANDAT, À LA FIN DE LA SAISON (A8) : le proprio, qui vouvoie.
  mandat: {
    rate: ['Pas de séries. Je ne vous ai pas payé pour regarder le printemps à la télé.',
      'J\'avais été clair. On reprendra tout à zéro, avec quelqu\'un d\'autre en tête.'],
    rempli: ['C\'est ce que je voulais. L\'an prochain, j\'en demanderai plus.',
      'Mandat rempli. Ne vous habituez pas : la barre monte.'],
    coupe: ['La Coupe. Je n\'ai plus rien à vous demander, sauf de recommencer.',
      'Vous l\'avez ramenée. Je vais m\'en souvenir longtemps.'],
  },
  // LES GALONS DE LA SAISON (A8) : le capitaine, qui les a vus se gagner.
  galons: {
    un: ['On va s\'en souvenir dans le vestiaire.',
      'Celui-là, il l\'a gagné soir après soir.'],
    plusieurs: ['On va s\'en souvenir dans le vestiaire.',
      'Des saisons comme ça, on les raconte aux recrues.'],
  },
  // LE BUTIN D'UN GROS MATCH GAGNÉ (A6) : l'entraîneur veut une page de plus, ton adjoint trouve le cahier épais.
  butin: {
    serre: ['On l\'a arraché. Prends quelqu\'un pour les prochains soirs, on en aura besoin.',
      'Ça s\'est joué à rien. Un adjoint de plus, et le prochain sera moins serré.'],
    large: ['On les a déclassés. Prends celui qui garde la machine en marche.',
      'Une soirée de même, ça se récompense. Choisis qui vient m\'aider derrière le banc.'],
  },
  // LES DILEMMES (oct. 2026) : la voix du dilemme, sur ce que son fait vient de dire. Une opinion, jamais un événement : le fait est sous elle.
  dilemme: {
    punitionTard: ['Une punition en fin de match, ça se paie cher. Moi, je ne la laisserais pas passer.', 'Ça ne doit pas se répéter. À toi de voir comment.'],
    gardienCharge: ['Il joue tout. Un jour, ça va se voir.', 'Je lui donnerais un soir, mais c\'est ton gardien.'],
    gardienBattu: ['On ne peut pas en rester là. Repos ou revanche, il faut choisir.', 'Ce genre de soirée, ça se règle tout de suite.'],
    panneGardien: ['Un gardien qui glisse avec l\'équipe, il faut décider si on y croit.', 'Moi, je le sortirais un peu. Mais c\'est toi qui signes.'],
    punitions: ['On ne peut plus le défendre devant l\'arbitre.', 'Il joue sur la ligne, et la ligne recule.'],
    blesses: ['Mes tables sont pleines. Il faut alléger ou serrer les dents.', 'Je manque de chaises, et de patience.'],
    route: ['Les valises ne se défont plus. Ça use un homme.', 'Il faut trouver comment souffler.'],
    jambes: ['Je l\'aurais assis un soir.', 'Ses jambes parlent plus fort que lui.'],
    jambesEquipe: ['Toute la bande est fatiguée. Ça se voit en troisième.', 'Il faut du repos, ou du courage.'],
    chaud: ['Il est en feu. La question, c\'est comment s\'en servir.', 'Un joueur comme ça, on lui donne la rondelle ou on lui donne des ailiers.'],
    disetteMarqueur: ['Un marqueur qui ne marque plus, ça finit par lui peser.', 'Il faut lui donner une consigne, n\'importe laquelle.'],
    recrue: ['Il est jeune. Il faut lui dire quelle place est la sienne.', 'Moi, je lui donnerais du temps de glace.'],
    parti: ['Un casier vide, ça fait toujours un vide dans le vestiaire.', 'Il faut dire quelque chose au groupe, ou rien du tout.'],
    quatrieme: ['Ils regardent le match du banc. Ça commence à paraître.', 'Ils méritent plus de glace, ou une explication.'],
    passoire: ['Ça rentre de partout. Il faut fermer quelque chose.', 'On donne trop. Il faut décider comment arrêter le sang.'],
    passoirePaire: ['Ta première paire peut en prendre plus, pas pour toujours.', 'Je laisserais mes deux meilleurs sur la glace.'],
    disette: ['Ça ne rentre plus. Il faut trouver un truc.', 'On tire et ça ne rentre pas.'],
    tirsContre: ['Il reçoit tout. On le laisse seul là-bas.', 'Il fait le travail de cinq.'],
    avantagesRares: ['L\'arbitre ne nous voit plus. Il faut le lui rappeler, ou pas.', 'Ils accrochent et personne ne siffle.'],
    defaiteParUn: ['Un but. Il nous a manqué un seul but.', 'Le banc veut prendre plus de risques.'],
    plombier: ['Il travaille fort, mais ça ne rentre pas.', 'Un tir, ça s\'apprend.'],
    veteranD: ['Il a des choses à transmettre.', 'Le vétéran pourrait laisser quelque chose derrière lui.'],
    tirsD: ['Il lance de partout. La ligne bleue de l\'avantage lui irait.', 'Moi, je lui donnerais la pointe.'],
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
 * LES DILEMMES (oct. 2026). La voix du dilemme (`de`), une réplique sur la sorte de son fait, et le fait en vrais
 * chiffres (`FAITS[...].dire`, js/sim.js).
 *   cle   la clé du dilemme dans `MOMENTS` ; faits : ce que son fait a lu ; graine : la partie et la journée
 */
export function sceneDuDilemme(cle, faits, graine = '') {
  const M = MOMENTS[cle];
  return { de: EXPEDITEURS[M.de], mot: piger(MOTS_DES_SCENES.dilemme[M.fait], graine, 'dilemme', cle), fait: FAITS[M.fait].dire(faits) };
}

/*
 * LES DOSSIERS DE LA SEMAINE (V10, tranche 5 — js/dossiers.js). La voix du dossier, une de ses répliques, et le fait
 * lu dans les faits du lundi.
 *   cle   le dossier ; faits : ceux du lundi (js/saison.js `faitsDuLundi`) ; graine : la partie et la semaine
 */
export function sceneDuDossier(cle, faits, graine = '') {
  const D = DOSSIERS[cle];
  return { de: EXPEDITEURS[D.de], mot: piger(D.mots, graine, 'dossier', cle), fait: D.fait(faits) };
}

/*
 * A3 · LES ROUTES DE LA SEMAINE. L'entraîneur nomme le pire problème du lundi et la route qui y répond : les jambes
 * sous 70, l'infirmerie (deux blessés ou plus), un dos-à-dos sur des jambes justes, la caisse sous 20 jetons.
 *   jambes   la moyenne du matin ; blesses : combien ; dos : les dos-à-dos de la semaine ; caisse : les jetons, ou null
 * Rend aussi `route`, celle qu'il recommande.
 */
const ROUTE_DU_PIRE = { jambes: 'repos', infirmerie: 'repos', dos: 'repos', caisse: 'commandite', rien: 'entrainement' };
export function sceneDeLaRoute({ jambes, blesses = 0, dos = 0, caisse = null, graine = '' }) {
  const pire = jambes < 70 ? 'jambes' : blesses >= 2 ? 'infirmerie' : dos && jambes < 85 ? 'dos' : caisse !== null && caisse < 20 ? 'caisse' : 'rien';
  const fait = { jambes: `Jambes ${jambes}`, infirmerie: `${blesses} blessés à l'infirmerie`, dos: `${dos} dos-à-dos cette semaine · jambes ${jambes}`,
    caisse: `${caisse} 🪙 en caisse`, rien: `Jambes ${jambes} · ${blesses ? `${blesses} blessé` : 'personne à l\'infirmerie'}` }[pire];
  return { de: EXPEDITEURS.en, mot: piger(MOTS_DES_SCENES.route[pire], graine, 'route', pire), fait, route: ROUTE_DU_PIRE[pire] };
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
 * A5 · TES RIVAUX. Le proprio, au premier lundi. Le fait : combien en prendre, parmi combien de clubs.
 *   multi   combien il en reste à prendre ; offerts : les clubs offerts
 */
export function sceneDesRivaux({ multi, offerts, graine = '' }) {
  return {
    de: EXPEDITEURS.pr,
    mot: piger(MOTS_DES_SCENES.rivaux[multi > 1 ? 'tous' : 'dernier'], graine, 'rivaux', multi),
    fait: `${multi} à choisir parmi ${offerts} clubs`,
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

/*
 * A8 · LE MANDAT. Le proprio, à la fin de la saison. Le fait : la fiche, le rang, et ce que le mandat demandait.
 *   sort     'rate', 'rempli' ou 'coupe' ; fiche : { V, D, DP } ; rang, equipes : la place au classement ;
 *   mandat   le mot du mandat (`mandatDe(...).mot`)
 */
export function sceneDuMandat({ sort, fiche, rang, equipes = 32, mandat = '', graine = '' }) {
  return {
    de: EXPEDITEURS.pr,
    mot: piger(MOTS_DES_SCENES.mandat[sort], graine, 'mandat', rang),
    fait: `${fiche.V}-${fiche.D}-${fiche.DP} · ${rangMot(rang)} sur ${equipes}${mandat ? ` · ${sort === 'rate' ? 'il fallait' : 'le mandat :'} ${mandat}` : ''}`,
  };
}

/*
 * A8 · LES GALONS DE LA SAISON. Le capitaine. Le fait : combien de galons, et à qui.
 *   noms   les joueurs galonnés, dans l'ordre où leurs galons sont tombés (un nom par galon)
 */
export function sceneDesGalons({ noms, graine = '' }) {
  const n = noms.length, uniques = [...new Set(noms)];
  return {
    de: EXPEDITEURS.ca,
    mot: piger(MOTS_DES_SCENES.galons[n > 1 ? 'plusieurs' : 'un'], graine, 'galons', n),
    fait: `${n} galon${n > 1 ? 's' : ''} cette saison · ${uniques.join(', ')}`,
  };
}
