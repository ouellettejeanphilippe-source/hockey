/**
 * LE COMMENTATEUR DU DIRECT (S70).
 *
 * JP : *ajouter pour chaque événement une grosse database de phrases que le
 * commentateur peut dire, voire mix and match pour variété max*.
 *
 * Une phrase n'est pas tirée d'une liste : elle se MONTE, pièce par pièce —
 * un cri, une action, une issue, une touche de couleur — et chaque pièce vient
 * de sa propre banque. Trente cris, quarante actions, quarante issues et
 * trente chutes font déjà des dizaines de milliers d'arrêts différents. La
 * couleur lit la soirée : le pointage (égalité, prise des devants, but
 * d'assurance, raclée), l'heure (fin de match serrée, prolongation), le
 * joueur (doublé, tour du chapeau), le gardien (trente arrêts, blanchissage).
 *
 * LES BANQUES SE TIRENT EN PAQUET : une pièce ne revient pas avant que toute
 * sa banque soit passée, donc un match ne radote pas. Le paquet est brassé
 * par la graine du match : revoir le même match redit les mêmes phrases — et
 * le direct qui reprend au deuxième entracte redit mot pour mot les deux
 * premières périodes.
 *
 * Les gabarits : {t} le tireur, {g} le gardien, {m} le marqueur, {att}
 * l'équipe qui attaque, {def} celle qui défend, {eq} celle dont on parle,
 * {autre} l'autre, {s} le pointage, {n} un nombre, {r} le temps qui reste,
 * {j} le joueur puni, {inf} l'infraction, {per} la période.
 */
import { GESTES, SOLO, SEQUENCE, FIN, profil, nomCourt } from './recit.js';

/* ---------- les arrêts dangereux ---------- */
export const CRI_ARRET = [
  'Oh !', 'Quel arrêt !', 'Attention !', 'Danger !', 'Ouf !', 'Wow !', 'Mais quel arrêt !', 'Sauvé !',
  'Incroyable !', 'Pas cette fois !', 'Oh la la !', 'Tout un arrêt !', 'Grosse occasion !', 'Ça passe proche !',
  'Quelle chance ratée !', 'Spectaculaire !', 'On a eu chaud !', 'Pas de but !', 'Il dit non !',
  'Ça brasse devant le filet !', 'Presque !', 'Tout le monde debout !', 'Quelle séquence !', 'Aïe aïe aïe !',
  'Mais comment ?', 'Du grand art !', 'Menace !', 'Chaude alerte !', 'Oh, le beau jeu !', 'Et non !',
  'Holà !', 'Regardez-moi ça !',
];
/*
 * LES ACTIONS DU TIREUR COLLENT AU JOUEUR ET AU SYSTÈME (S71). JP : *les
 * phrases doivent fitter avec stats des joueurs et stratégies et cie*. Chaque
 * action porte des ÉTIQUETTES : le poste qu'elle exige (D, F) et ses
 * affinités — le style du tireur (canon, rapide, tireur, fab), la tactique
 * de sa ligne (bleue, contre, derriere, courtes, echec, defensive) et la
 * situation (AN, DN). Un défenseur ne file plus en échappée, et une ligne en
 * Ligne bleue se raconte à la pointe.
 */
export const ACTIONS_TIREUR = [
  ['{t} s\'amène seul devant le filet', 'F'], ['{t} reçoit une passe parfaite dans l\'enclave', 'F courtes'],
  ['{t} décoche un boulet de la pointe', 'D canon bleue'], ['{t} tente sa chance du revers', 'F fab'],
  ['{t} surgit au deuxième poteau', 'F courtes'], ['{t} fait dévier le tir de la pointe', 'F bleue'],
  ['{t} file en échappée', 'F rapide contre'], ['{t} récupère le retour', 'F'],
  ['{t} coupe au filet en vitesse', 'F rapide'], ['{t} lance sur réception', 'tireur canon courtes'],
  ['{t} se faufile entre les deux défenseurs', 'F rapide'], ['{t} arme son lancer frappé', 'canon bleue'],
  ['{t} vise la lucarne du poignet', 'tireur'], ['{t} contourne le filet et tente le tour du poteau', 'F rapide derriere'],
  ['{t} pivote dans l\'enclave et décoche', 'F tireur'], ['{t} hérite d\'une rondelle libre devant le filet', 'F'],
  ['{t} déborde son couvreur sur l\'aile', 'F rapide'], ['{t} tente une feinte du revers', 'F fab'],
  ['{t} vole la rondelle et s\'échappe', 'F rapide echec'], ['{t} décoche du haut du cercle', 'F tireur canon'],
  ['{t} lance à travers un écran', 'D bleue'], ['{t} tente de faire dévier la rondelle', 'F bleue'],
  ['{t} a tout le filet devant lui', 'F'], ['{t} reçoit seul au deuxième poteau', 'F courtes AN'],
  ['{t} tente sa chance en pleine course', 'F rapide contre'], ['{t} profite d\'un revirement en zone neutre', 'F contre defensive'],
  ['{t} lance sur un deux contre un', 'F contre'], ['{t} se retrouve seul dans l\'enclave', 'F'],
  ['{t} fonce au filet avec la rondelle', 'F'], ['{t} ramasse la rondelle dans la mêlée', 'F echec'],
  ['{t} tente un tir bas vers la jambière', 'tireur'], ['{t} essaie de le surprendre de l\'angle', 'F'],
  ['{t} décoche sans ralentir', 'rapide canon contre'], ['{t} tente le tir en fente', 'canon AN'],
  ['{t} reçoit la passe du fond de la zone', 'F derriere'], ['{t} fait une feinte de tir et contourne le défenseur', 'F fab'],
  ['{t} redirige la passe en plein vol', 'F courtes'], ['{t} saute sur une rondelle bondissante', 'F'],
  // Les défenseurs.
  ['{t} s\'avance de la ligne bleue et lance', 'D'], ['{t} pince à la ligne bleue et décoche', 'D bleue'],
  ['{t} monte en quatrième homme et tire', 'D rapide contre'], ['{t} lance sur réception à la pointe', 'D canon bleue AN'],
  ['{t} tente un tir des poignets de la ligne bleue', 'D tireur'], ['{t} se glisse jusqu\'au cercle et lance', 'D rapide'],
  // Les systèmes.
  ['{t} surgit de derrière le filet', 'F derriere'], ['{t} reçoit une remise de derrière la ligne des buts', 'F derriere'],
  ['{t} conclut un jeu de passes en triangle', 'F courtes'], ['{t} vole la rondelle en échec avant et lance', 'F echec'],
  ['{t} récupère la rondelle sur la bande grâce à l\'échec avant', 'F echec'], ['{t} jaillit en contre-attaque', 'F rapide contre defensive'],
  ['{t} relance en contre après un revirement', 'F defensive'],
  // Les unités spéciales.
  ['{t} décoche sur l\'avantage numérique', 'AN'], ['La rondelle circule sur le jeu de puissance, {t} lance du cercle', 'F AN'],
  ['{t} s\'échappe en désavantage numérique', 'F DN'], ['{t} intercepte une passe en désavantage et fonce', 'F DN'],
];
/* Le texte seul, pour qui compte les pièces. */
export const ACTION_TIREUR = ACTIONS_TIREUR.map(([t]) => t);
export const LIEN_ARRET = [', mais ', '… ', ' : ', ', et ', ', '];
export const ISSUE_GARDIEN = [
  '{g} ferme la mitaine', '{g} fait l\'arrêt de la jambière', '{g} s\'étire de tout son long', '{g} dit non',
  '{g} garde la porte fermée', '{g} fait le grand écart', '{g} sort de nulle part', '{g} plonge et le lui vole',
  '{g} l\'arrête du bloqueur', '{g} couvre la rondelle', '{g} reste solide comme un roc', '{g} gagne le duel',
  '{g} se jette et bloque tout', '{g} détourne en coin de patinoire', '{g} fait l\'arrêt de l\'épaule',
  '{g} referme la jambière juste à temps', '{g} repousse le tir de la jambière gauche', '{g} le frustre d\'un arrêt du masque',
  '{g} réussit un arrêt acrobatique', '{g} traverse le demi-cercle et bloque', '{g} garde les jambières collées',
  '{g} reste debout et absorbe le tir', '{g} fait l\'arrêt en papillon', '{g} détourne la rondelle au-dessus du filet',
  '{g} dévie avec la palette de son bâton', '{g} se jette sur le dos et bloque', '{g} ne donne rien', '{g} fige le jeu',
  '{g} a suivi la rondelle jusqu\'au bout', '{g} voit tout', '{g} règle le cas', '{g} s\'interpose',
  '{g} reste de glace', '{g} saisit la rondelle en pleine extension', '{g} étouffe le tir sur son plastron',
  '{g} lève la jambière au dernier moment', '{g} fait un arrêt de la main droite', '{g} bloque avec la tête de son bâton',
  '{g} ferme le cinq trous', '{g} se déplace latéralement et bloque',
];
export const CHUTE_ARRET = [
  'Quel arrêt !', 'Il vole un but certain.', 'La foule n\'en revient pas.', 'Tout un arrêt !', 'Il fallait le faire.',
  'Ça, c\'est un arrêt de gardien numéro un.', 'Il garde les siens dans le match.', 'Les partisans se lèvent pour l\'applaudir.',
  'Le tireur n\'en revient pas.', 'Il lève les bras au ciel, découragé.', 'On va le revoir au ralenti, celui-là.',
  'C\'est peut-être l\'arrêt du match.', 'Il a eu le dernier mot.', 'Quelle concentration !', 'Il est dans sa bulle.',
  'Le banc tape des bâtons sur la bande.', 'Le tireur ne comprend pas.', 'Du travail de pro.',
  'Un arrêt digne des faits saillants.', 'Les dépisteurs dans les gradins prennent des notes.', 'La rondelle ne veut pas rentrer.',
  'Il fait des miracles.', 'Les coéquipiers tapent sur ses jambières.', 'Le tireur regarde le plafond.',
  'Ça, ça va passer aux nouvelles du sport.', 'Une vraie muraille.', 'Il ne s\'énerve jamais.', 'Rien de facile ce soir.',
  'Le public retient son souffle.', 'Il fallait être là.',
];
export const CHUTE_ARRETS_NOMBREUX = [
  '{g} en est à {n} arrêts ce soir.', '{n} arrêts pour {g}, et ce n\'est pas fini.', 'Une soirée occupée pour {g} : {n} arrêts.',
  '{g} porte son équipe sur ses épaules : {n} arrêts.', '{n} arrêts ! {g} est le meilleur joueur sur la glace.',
];
export const CHUTE_ARRET_SERRE = [
  'Arrêt crucial dans les circonstances !', 'Il reste {r} : quel moment pour un arrêt !', 'Le genre d\'arrêt qui fait gagner des matchs.',
  'Un arrêt en or à ce stade-ci !', 'Pas le temps de trembler : il reste {r}.',
];
export const CHUTE_ARRET_POUSSE = [
  '{att} pousse pour revenir.', '{att} cherche désespérément le but.', '{att} frappe à la porte.',
  '{att} met de la pression.', '{att} sent que ça s\'en vient.', 'La pression monte sur {def}.',
];
/* LES STATS DU TIREUR (S71) : une vedette qui rate se le fait rappeler. */
export const CHUTE_VEDETTE = [
  '{t} n\'a pas l\'habitude de rater ça : {n} buts cette saison.', 'Même avec {n} buts cette saison, {t} ne trouve pas la faille.',
  '{n} buts cette saison pour {t}, mais pas celui-là.', 'Le meilleur marqueur de l\'équipe est frustré.',
];
export const CHUTE_BLANCHISSAGE = [
  'Le blanchissage tient toujours pour {g}.', '{g} flirte avec le blanchissage.', 'Toujours rien derrière {g}.',
  '{g} n\'a encore rien donné ce soir.',
];

/* ---------- les séquences arrêtées (une action spéciale réussie, mais sauvée) ---------- */
export const ACTION_SEQUENCE = [
  '{att} déroule son système, {t} au bout de la séquence', 'Passe transversale parfaite de {att}, {t} reçoit',
  '{att} fait tourner la rondelle en zone offensive, {t} trouve l\'ouverture', 'Jeu de passes à une touche de {att} : {t} a le filet ouvert',
  'Le jeu pratiqué à l\'entraînement : {t} se présente seul', '{att} surcharge un côté de la patinoire et {t} surgit de l\'autre',
  'Montée à trois de {att}, {t} décoche au bout', 'Échange rapide entre les avants de {att}, {t} lance',
  '{att} gagne la mise au jeu, rondelle à {t} en retrait', 'Le trio de {att} fait courir la défensive : {t} tire',
  '{att} fait circuler la rondelle d\'un côté à l\'autre, {t} dans l\'enclave', 'Passe dans l\'enclave de derrière le filet : {t}',
  'Une remise en retrait parfaite pour {t}', '{att} force la défensive à se commettre, {t} arrive en trombe',
  'Le système de {att} crée une ouverture pour {t}',
];

/* ---------- les beaux jeux défensifs ---------- */
export const CRI_DEFENSE = [
  'Bien joué !', 'Superbe lecture !', 'Quelle défense !', 'Intelligent !', 'Beau travail !', 'Solide !', 'Rien à faire !',
  'Fermé à clé !', 'Personne ne passe !', 'Du hockey défensif de haut niveau !', 'Propre !', 'Très bien lu !',
  'Quel repli !', 'Discipline exemplaire !', 'Le mur tient !',
];
export const ACTION_DEFENSE = [
  '{def} lit le jeu et coupe la passe', '{def} étouffe le système de {att} avant le tir', 'Le repli de {def} est parfait',
  'Un défenseur de {def} ferme l\'enclave', '{def} bloque la ligne de passe', '{def} force {att} à tirer de loin',
  '{def} gagne la bataille le long de la bande', '{def} referme la porte en zone neutre', '{def} contient {att} à la ligne bleue',
  'Un avant de {def} revient en repli et vole la rondelle', '{def} neutralise l\'entrée de zone', '{def} bouche le centre',
  'Un défenseur de {def} dégage la zone avec autorité', '{def} garde un bâton actif dans la ligne de passe',
  '{def} coupe la transversale au dernier moment', '{def} double le porteur de la rondelle', '{def} ferme les couloirs',
  'Le centre de {def} redescend au bon moment', '{def} lit la montée et intercepte', '{def} tient sa ligne bleue',
];
export const CHUTE_DEFENSE = [
  'Le système de {att} tombe à plat.', '{att} doit tout recommencer.', 'Pas une chance de marquer.', 'Tout le monde fait son travail.',
  'L\'entraîneur de {def} doit être content.', 'C\'est ça, jouer en équipe.', 'Aucune ouverture.', '{att} ne trouve pas la faille.',
  'Le plan de match est respecté à la lettre.', 'Pas de cadeau ce soir.', 'On a déjà vu {att} plus inspiré.',
  '{att} se casse les dents.', 'Le jeu ne se rend même pas au filet.', 'Du travail qui ne paraît pas sur la feuille de match.',
];
export const ACTION_BLOQUE = [
  'Un joueur de {def} se jette devant le tir de {att}', '{def} bloque le lancer de la pointe', 'Le désavantage de {def} tient bon : {att} tire de loin',
  '{def} dégage la zone', 'Un défenseur de {def} ramasse la rondelle et l\'envoie à l\'autre bout', '{def} tue le temps le long de la bande',
  '{def} garde sa boîte serrée', 'Un attaquant de {def} bloque le tir avec son patin', '{def} gagne la mise au jeu en désavantage et dégage',
  '{def} fait circuler {att} sans lui laisser d\'ouverture',
];
export const CHUTE_BLOQUE = [
  'Du courage à revendre.', 'Ça va laisser une marque.', 'Les unités de désavantage font le travail.',
  'Deux minutes, c\'est long quand on joue à quatre.', 'Le banc applaudit le sacrifice.', 'Des secondes précieuses de passées.',
  'Le jeu de puissance de {att} tourne à vide.', 'L\'avantage numérique de {att} ne trouve rien.',
];

/* ---------- les tirs ordinaires (« Voir tous les tirs ») ---------- */
export const ACTIONS_TIR = [
  ['Tir de {t}', ''], ['Lancer faible de {t}', ''], ['{t} tente sa chance de loin', ''], ['Tir de la pointe de {t}', 'D bleue'],
  ['Lancer frappé de {t}', 'canon bleue'], ['{t} lance du revers', 'F fab'], ['Tir des poignets de {t}', 'tireur'],
  ['{t} décoche de la ligne bleue', 'D bleue'], ['Tir sans danger de {t}', ''], ['{t} lance de l\'angle', 'F derriere'],
  ['Tir dans la circulation de {t}', 'bleue'], ['{t} essaie de le surprendre', ''], ['Tir voilé de {t}', 'bleue'],
  ['{t} lance en entrée de zone', 'F rapide contre'], ['Tir précipité de {t}', 'echec'], ['{t} tente un tir en rotation', 'F'],
  ['{t} lance sur l\'avantage numérique', 'AN'], ['Tir de loin de {t} pour dégager la pression', 'DN'],
];
export const ACTION_TIR = ACTIONS_TIR.map(([t]) => t);
export const ISSUE_TIR = [
  'arrêt de {g}', '{g} immobilise', '{g} bloque sans problème', 'facile pour {g}', '{g} fait dévier dans le coin',
  '{g} contrôle le retour', '{g} était bien placé', '{g} le voit venir', '{g} met la mitaine dessus', '{g} fige le jeu',
  'aucun problème pour {g}', '{g} fait l\'arrêt', '{g} absorbe le tir', '{g} envoie en coin', 'routine pour {g}',
];

/* ---------- les buts ---------- */
export const CRI_BUT = [
  'Et le but !', 'Il compte !', 'Dans le fond du filet !', 'La lumière rouge s\'allume !', 'Et ça rentre !', 'Il lance et compte !',
  'Et c\'est le but !', 'Le filet a tremblé !', 'Quel but !', 'Oh, le beau but !', 'Il marque !', 'C\'est dedans !',
  'Et la rondelle est dans le but !', 'Il ne pardonne pas !', 'Il fait bouger les cordages !', 'Et voilà !', 'Ça y est !',
  'Magnifique !', 'Tout un but !', 'Et vlan !', 'Et ça passe !', 'Il le fait !', 'Oh que oui !', 'Bingo !', 'Et compte !',
  'La foule explose !', 'Wow !', 'Quel tir !', 'Il ne rate pas sa chance !', 'Ça, c\'est du hockey !',
];
export const APPUI_SOLO = [...SOLO, 'tout seul comme un grand', 'après avoir tout fait lui-même', 'sur un effort individuel'];
export const APPUI_SEQUENCE = [...SEQUENCE, 'après une passe dans l\'enclave', 'au bout d\'un jeu de passes à une touche',
  'sur une remise parfaite', 'après un long échange en zone adverse'];
export const CONTEXTE_BUT = {
  premier: ['{eq} brise la glace.', 'Premier but de la rencontre.', 'La marque est ouverte.', '{eq} ouvre la marque.',
    '{eq} frappe le premier.', 'Le premier but, et il compte double dans un match comme celui-là.'],
  egalite: ['C\'est à égalité, {s} !', 'Tout est à recommencer !', '{eq} revient de l\'arrière !', 'Les chiffres sont égaux, {s} !',
    '{eq} efface son retard !', 'On a un nouveau match : {s} !', '{eq} n\'a pas dit son dernier mot : {s}.'],
  devant: ['{eq} prend les devants !', '{eq} passe en avant, {s} !', 'Et {eq} mène maintenant {s} !', 'Revirement de situation : {eq} en avant !',
    '{eq} prend l\'avance, {s}.', 'Le vent tourne : {eq} mène {s} !'],
  creuse: ['{eq} creuse l\'écart, {s}.', 'Une avance de {n} buts pour {eq}.', '{eq} se donne de l\'air.', '{eq} prend le contrôle du match.',
    'La marque est maintenant {s}.', '{eq} enfonce le clou.', 'Ça commence à peser lourd pour {autre}.'],
  raclee: ['Ça ressemble à une raclée : {s}.', 'La soirée tourne au cauchemar pour {autre}.', '{eq} ne lève pas le pied : {s}.',
    'Les partisans de {autre} commencent à quitter.', '{s} ! {autre} est dépassé.'],
  reduit: ['{eq} se rapproche, {s}.', 'L\'écart n\'est plus que de {n}.', '{eq} refuse d\'abdiquer !', '{eq} donne signe de vie.',
    'Le match n\'est pas fini !', '{eq} revient dans le match : {s}.'],
  doublé: ['Son deuxième du match !', 'Il récidive !', 'Un doublé ce soir.', 'Et de deux pour lui !', 'Il en a deux !'],
  chapeau: ['TOUR DU CHAPEAU ! Les casquettes pleuvent sur la glace !', 'Et c\'est le tour du chapeau ! Les casquettes volent !',
    'Trois buts ce soir ! La foule lance ses casquettes !', 'Le tour du chapeau ! Quelle soirée !'],
  festival: ['{n} buts ce soir ! Une soirée historique !', 'Il en est à {n} ! On n\'a jamais vu ça !', '{n} buts ! Il est intouchable ce soir !'],
  an: ['L\'avantage numérique fait mal.', 'Le jeu de puissance livre la marchandise.', 'L\'unité d\'avantage numérique a fait le travail.',
    'La punition coûte cher.', 'Ils avaient un joueur de plus, et ça paraît.'],
  dn: ['En désavantage numérique ! Quelle gifle !', 'Un but en infériorité numérique, ça fait mal au moral.', 'Ils étaient à quatre et ils marquent !',
    'Un but en désavantage : le vent vient de tourner.'],
  special: ['Le système de {eq} fonctionne à merveille.', 'Exactement ce qu\'ils ont pratiqué.', 'Le jeu parfait, tel que dessiné au tableau.',
    'La chimie de ce trio fait des ravages.', 'On voit le travail de l\'entraîneur.'],
  // Le système de la ligne qui marque, quand il a fait le travail (S71).
  bleue: ['La ligne bleue frappe encore.', 'Les tirs de la pointe finissent par payer.', 'Tout part de la ligne bleue ce soir.'],
  contre: ['La contre-attaque a fait mal.', 'Ils attendaient l\'ouverture, ils l\'ont eue.', 'Frappés en transition !'],
  derriere: ['Le jeu derrière le filet fonctionne.', 'Tout passe par derrière la ligne des buts.', 'Le gardien ne savait plus où regarder.'],
  courtes: ['Les passes courtes ont mystifié la défense.', 'Un jeu de passes à une touche, du grand art.', 'Ils font tourner la défense en bourrique.'],
  echec: ['L\'échec avant a forcé le revirement.', 'Ils les ont étouffés dans leur zone.', 'La pression a payé.'],
  defensive: ['Patients, ils ont frappé en contre.', 'Ils ferment le jeu et piquent au bon moment.', 'Le plan défensif paie.'],
  tard: ['À {r} de la fin !', 'Dans les dernières minutes !', 'Un but crucial !', 'Au pire moment pour {autre} !', 'Avec {r} à jouer !'],
  prolongation: ['C\'est terminé en prolongation !', 'La prolongation n\'aura pas duré longtemps !', '{eq} l\'emporte en prolongation !',
    'Mort subite, et c\'est {eq} qui survit !', 'Tout le banc saute sur la glace !'],
};

/* ---------- les punitions ---------- */
export const INFRACTIONS = [
  'accrochage', 'obstruction', 'bâton élevé', 'cinglage', 'rudesse', 'avoir fait trébucher', 'avoir retenu', 'double-échec',
  'obstruction sur le gardien', 'avoir retardé le match', 'coup de coude', 'avoir donné de la bande', 'charge', 'avoir retenu le bâton',
  'rudesse après le sifflet', 'avoir dardé',
];
export const PHRASE_PUNITION = [
  '{j} écope de deux minutes pour {inf}.', '{j} s\'en va au banc des punitions pour {inf}.', 'L\'arbitre lève le bras : {j}, deux minutes pour {inf}.',
  'Deux minutes à {j} pour {inf}.', '{j} est chassé pour {inf}.', 'Punition à {j} : {inf}.', '{j} prend le chemin du cachot pour {inf}.',
  'Le sifflet retentit : {j}, {inf}.', '{j} va réfléchir deux minutes : {inf}.',
];
export const PHRASE_PUNITION_EQUIPE = ['Punition à {autre} pour {inf}.', '{autre} écope de deux minutes pour {inf}.'];
export const PHRASE_AVANTAGE = [
  'Avantage numérique pour {eq}.', '{eq} va jouer à cinq contre quatre.', 'Le jeu de puissance de {eq} entre en scène.',
  '{eq} aura deux minutes pour en profiter.', 'L\'unité d\'avantage numérique de {eq} saute sur la glace.',
];
export const COULEUR_PUNITION = [
  'Punition inutile.', 'L\'entraîneur n\'est pas content.', 'La foule hue l\'arbitre.', 'Il conteste, mais rien à faire.',
  'Il ne semble pas d\'accord.', 'C\'était évident.', 'Pas une décision populaire dans l\'amphithéâtre.', 'Il frappe la bande en entrant au banc.',
  'Il n\'avait pas le choix, il était battu.', 'Une punition de paresse.',
];
export const COULEUR_PUNITION_TARD = ['Mauvais moment pour une punition !', 'Une punition coûteuse à ce stade du match !',
  'Il n\'y a pas pire moment.', 'Son entraîneur n\'en revient pas.'];
export const RETOUR_PUNITION = [
  '{j} revient au jeu.', '{j} sort du cachot.', '{j} est libéré.', 'Fin de la punition de {j}.', '{j} saute sur la glace.',
];
export const RETOUR_EQUIPE = ['Fin de la punition.', 'Le puni revient au jeu.'];
export const COULEUR_RETOUR = [
  'Retour à cinq contre cinq.', 'Les deux équipes à forces égales.', 'Le désavantage de {eq} a tenu bon.',
  'Les unités de désavantage de {eq} ont fait le travail.', '{autre} n\'a pas profité de l\'avantage.', 'Mission accomplie pour {eq}.',
];

/* ---------- les périodes, le début, la fin ---------- */
export const FIN_PERIODE = [
  'Fin de la {per}.', 'La sirène retentit : fin de la {per}.', 'C\'est la fin de la {per}.', 'Voilà qui met fin à la {per}.',
  'Les joueurs rentrent au vestiaire : fin de la {per}.', 'La {per} est terminée.',
];
export const COULEUR_PERIODE = {
  egal: ['Tout est à égalité.', 'Rien n\'est décidé.', 'Personne ne se détache.', 'Un match chaudement disputé.'],
  mene: ['{eq} mène {s}.', '{eq} a l\'avantage au tableau.', '{eq} garde les commandes.', 'Avantage {eq}.'],
  tirs: ['{eq} domine au chapitre des tirs.', 'Le gardien de {autre} a été occupé.', '{eq} lance tout ce qui bouge.'],
  prolongation: ['On s\'en va en prolongation !', 'Il faudra du temps supplémentaire !', 'Mort subite en vue !'],
};
export const DEBUT = [
  'Mise au jeu !', 'C\'est parti !', 'La rondelle est mise en jeu.', 'L\'arbitre laisse tomber la rondelle.', 'Et c\'est commencé !',
  'Le match est lancé.',
];
export const COULEUR_DEBUT = [
  'L\'amphithéâtre est plein à craquer.', 'Les deux formations sont prêtes.', 'Bienvenue à ce duel.', 'L\'ambiance est électrique.',
  'Les partisans sont debout.', 'On annonce un grand match.', 'Les gardiens sont en place.',
];
export const FIN_MATCH = ['C\'est terminé !', 'La sirène finale retentit !', 'Fin du match !', 'Et c\'est fini !', 'Le match est terminé.'];
export const COULEUR_FIN = {
  blanchissage: ['Blanchissage pour {g} !', 'Un jeu blanc pour {g} !', '{g} n\'a rien donné de la soirée.'],
  raclee: ['Une soirée à oublier pour {autre}.', 'Une démonstration de {eq}.', '{eq} n\'a laissé aucune chance.'],
  serre: ['Un match serré jusqu\'à la fin.', 'Ça s\'est joué à un but.', 'Du hockey haletant.'],
  prolongation: ['Il aura fallu la prolongation.', 'La mort subite a tranché.'],
};

/* ---------- la mécanique ---------- */
function hacher(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
function suite(seed) {
  let a = hacher(String(seed)) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const remplir = (gabarit, v) => gabarit.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : ''));
const majuscule = s => s.replace(/^(<[^>]+>)*([a-zà-ÿ])/, (m, tag, c) => `${tag || ''}${c.toUpperCase()}`);
const joindre = (...p) => p.filter(Boolean).join(' ');

/**
 * Le commentateur d'UN match. `graine` : celle du direct. Chaque méthode
 * rend une phrase en HTML (les noms arrivent déjà échappés ou liés).
 */
export function commentateur(graine) {
  const alea = suite(`com:${graine}`);
  const paquets = new Map();
  // Une pièce de la banque, sans remise : la banque se rebrasse quand elle est vide.
  const pige = (cle, liste) => {
    let p = paquets.get(cle);
    if (!p || !p.length) {
      p = liste.map((_, i) => i);
      for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
      paquets.set(cle, p);
    }
    return liste[p.pop()];
  };
  const oui = x => alea() < x;
  const fin = () => (oui(0.45) ? ' !' : '.');
  /*
   * UNE PIÈCE QUI COLLE (S71). `liste` : [texte, 'étiquettes']. Le poste
   * (D, F) est exigé ; les autres étiquettes sont des affinités. Quand des
   * pièces collent au style, à la tactique ou à la situation, on les prend
   * deux fois sur trois ; sinon, les pièces sans affinité.
   */
  const pigeColle = (cle, liste, c) => {
    const poste = c.poste || 'F';
    const aff = new Set([c.style, c.tac, c.mode].filter(Boolean));
    const ok = liste.filter(([, t]) => { const e = t.split(' ').filter(Boolean); return !e.some(x => (x === 'D' || x === 'F') && x !== poste); });
    const colle = ok.filter(([, t]) => t.split(' ').some(x => aff.has(x)));
    const neutres = ok.filter(([, t]) => !t.split(' ').some(x => x !== 'D' && x !== 'F' && x));
    const pool = colle.length && (oui(0.67) || !neutres.length) ? colle : (neutres.length ? neutres : ok);
    const sig = `${cle}:${pool === colle ? [...aff].sort().join('+') : 'neutre'}:${poste}`;
    return pige(sig, pool.map(([t]) => t));
  };

  return {
    /* Un arrêt dangereux. c : { t, g, att, def, nArrets, serre, r, pousse, blanchissage } */
    arret(c) {
      const action = remplir(pigeColle('act', ACTIONS_TIREUR, c), c);
      const issue = remplir(pige('iss', ISSUE_GARDIEN), c);
      const corps = majuscule(`${action}${pige('lien', LIEN_ARRET)}${issue}${fin()}`);
      const cri = oui(0.6) ? pige('cri', CRI_ARRET) : '';
      return joindre(cri, corps, this.couleurArret(c));
    },
    /* Une séquence qui se rend au filet et que le gardien arrête. */
    sequence(c) {
      const corps = majuscule(`${remplir(pige('seq', ACTION_SEQUENCE), c)}${pige('lien', LIEN_ARRET)}${remplir(pige('iss', ISSUE_GARDIEN), c)}${fin()}`);
      return joindre(oui(0.5) ? pige('cri', CRI_ARRET) : '', corps, this.couleurArret(c));
    },
    couleurArret(c) {
      const choix = [];
      if (c.nArrets >= 25 && c.nArrets % 5 === 0) choix.push(['nb', CHUTE_ARRETS_NOMBREUX]);
      if (c.serre) choix.push(['serre', CHUTE_ARRET_SERRE]);
      if (c.pousse) choix.push(['pousse', CHUTE_ARRET_POUSSE]);
      if (c.blanchissage) choix.push(['blanc', CHUTE_BLANCHISSAGE]);
      if (c.butsSaison >= 20) choix.push(['vedette', CHUTE_VEDETTE]);
      if (choix.length && oui(0.6)) { const [k, l] = choix[Math.floor(alea() * choix.length)]; return remplir(pige(k, l), { ...c, n: k === 'vedette' ? c.butsSaison : c.nArrets }); }
      return oui(0.55) ? remplir(pige('chute', CHUTE_ARRET), c) : '';
    },
    /* Un beau jeu défensif : une action étouffée. c : { att, def } */
    defense(c) {
      const corps = majuscule(`${remplir(pige('def', ACTION_DEFENSE), c)}${fin()}`);
      return joindre(oui(0.55) ? pige('crid', CRI_DEFENSE) : '', corps, oui(0.6) ? remplir(pige('chd', CHUTE_DEFENSE), c) : '');
    },
    /* Un tir de loin en désavantage, sans danger. */
    bloque(c) {
      const corps = majuscule(`${remplir(pige('blq', ACTION_BLOQUE), c)}${fin()}`);
      return joindre(corps, oui(0.55) ? remplir(pige('chb', CHUTE_BLOQUE), c) : '');
    },
    /* Un tir ordinaire. c : { t, g } */
    tir(c) {
      return majuscule(`${remplir(pigeColle('tir', ACTIONS_TIR, c), c)}, ${remplir(pige('itir', ISSUE_TIR), c)}.`);
    },
    /*
     * Un but. c : { but, m (le nom court, échappé), g, eq, autre, pour, contre,
     * nMatch (ses buts ce soir), r, tard, ot }. `pour` et `contre` : le
     * pointage APRÈS le but, du côté de l'équipe qui marque.
     */
    but(c) {
      const b = c.but;
      const s = `${c.pour}-${c.contre}`;
      const v = { ...c, s, n: Math.abs(c.pour - c.contre) };
      let corps;
      if (c.ot || b.gagnant) corps = `${c.m} ${pige('finot', FIN)} face à ${c.g}.`;
      else {
        const geste = remplir(pige(`g:${profil(b.marqueur)}`, GESTES[profil(b.marqueur)]).replace('{G}', '{g}'), v);
        const appui = b.passeurs && b.passeurs.length >= 2 ? `, ${pige('seqb', APPUI_SEQUENCE)}` : b.passeurs && !b.passeurs.length ? `, ${pige('solo', APPUI_SOLO)}` : '';
        corps = `${c.m} ${geste}${appui}.`;
      }
      const ctx = [];
      if (c.nMatch >= 4) ctx.push(remplir(pige('fest', CONTEXTE_BUT.festival), { ...v, n: c.nMatch }));
      else if (c.nMatch === 3) ctx.push(pige('chap', CONTEXTE_BUT.chapeau));
      else if (c.nMatch === 2 && oui(0.7)) ctx.push(pige('dbl', CONTEXTE_BUT.doublé));
      if (c.ot) ctx.push(remplir(pige('ot', CONTEXTE_BUT.prolongation), v));
      else {
        // « devant » : c'était égal avant ce but ; « creuse » : on menait déjà.
        const ecart = c.pour - c.contre;
        const cle = c.pour + c.contre === 1 ? 'premier' : ecart === 0 ? 'egalite'
          : ecart === 1 ? 'devant' : ecart >= 4 ? 'raclee' : ecart > 1 ? 'creuse' : 'reduit';
        if (c.tard && (cle === 'egalite' || cle === 'devant')) ctx.push(remplir(pige('tard', CONTEXTE_BUT.tard), v));
        ctx.push(remplir(pige(cle, CONTEXTE_BUT[cle]), v));
      }
      if (b.an && oui(0.6)) ctx.push(pige('an', CONTEXTE_BUT.an));
      else if (b.dn) ctx.push(pige('dn', CONTEXTE_BUT.dn));
      else if (b.tac && CONTEXTE_BUT[b.tac] && (b.special === 'reussie' ? oui(0.8) : oui(0.25))) ctx.push(remplir(pige(`tac:${b.tac}`, CONTEXTE_BUT[b.tac]), v));
      else if (b.special === 'reussie' && oui(0.6)) ctx.push(remplir(pige('spec', CONTEXTE_BUT.special), v));
      return joindre(pige('crib', CRI_BUT), corps, ...ctx);
    },
    /* Une punition. c : { j (nom, ou vide), eq (qui profite), autre (le puni), tard } */
    punition(c) {
      const v = { ...c, inf: pige('inf', INFRACTIONS) };
      const tete = c.j ? remplir(pige('pun', PHRASE_PUNITION), v) : remplir(pige('pune', PHRASE_PUNITION_EQUIPE), v);
      const coul = c.tard && oui(0.7) ? pige('punt', COULEUR_PUNITION_TARD) : oui(0.35) ? pige('punc', COULEUR_PUNITION) : '';
      return joindre(majuscule(tete), remplir(pige('av', PHRASE_AVANTAGE), v), coul);
    },
    /* Le puni revient. c : { j, eq (qui était puni), autre } */
    retour(c) {
      const tete = c.j ? remplir(pige('ret', RETOUR_PUNITION), c) : pige('rete', RETOUR_EQUIPE);
      return joindre(majuscule(tete), remplir(pige('retc', COULEUR_RETOUR), c));
    },
    /* La fin d'une période. c : { per, eq (qui mène ou null), autre, s, eqTirs, autreTirs, ot } */
    periode(c) {
      const tete = majuscule(remplir(pige('per', FIN_PERIODE), c));
      let coul;
      if (c.ot) coul = pige('perot', COULEUR_PERIODE.prolongation);
      else if (!c.eq) coul = pige('pereg', COULEUR_PERIODE.egal);
      else coul = remplir(pige('perm', COULEUR_PERIODE.mene), c);
      const tirs = c.eqTirs && oui(0.5) ? remplir(pige('pert', COULEUR_PERIODE.tirs), { eq: c.eqTirs, autre: c.autreTirs }) : '';
      return { tete, couleur: joindre(coul, tirs) };
    },
    debut() {
      return joindre(pige('deb', DEBUT), oui(0.7) ? pige('debc', COULEUR_DEBUT) : '');
    },
    /* La fin. c : { eq (le vainqueur), autre, g (le gardien du vainqueur), blanchissage, ecart, ot } */
    fin(c) {
      let coul = '';
      if (c.blanchissage) coul = remplir(pige('fb', COULEUR_FIN.blanchissage), c);
      else if (c.ot) coul = pige('fot', COULEUR_FIN.prolongation);
      else if (c.ecart >= 4) coul = remplir(pige('fr', COULEUR_FIN.raclee), c);
      else if (c.ecart === 1) coul = pige('fs', COULEUR_FIN.serre);
      return { tete: pige('fin', FIN_MATCH), couleur: coul };
    },
  };
}

/* Le nom court d'un joueur, échappé : ce que le commentateur dit au micro. */
export const nomDeMicro = (p, esc) => esc(nomCourt(p && p.n ? p.n : ''));
