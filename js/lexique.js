/*
 * LE LEXIQUE — un mot par idée, le même à l'écran, dans le code neuf et dans
 * les docs (CLAUDE.md, « Le vocabulaire »). JP, 27 oct. 2026 : *mots à
 * plusieurs sens : « coach », « vestiaire », « classeur », « plombier »,
 * « contrat », « écusson », l'icône 🛡️, « rejouer »*.
 *
 * Chaque mot réservé garde UN sens ; ce que l'écran dit d'autre sous ce mot
 * est un accroc. `fautif` attrape la tournure qui le réemploierait ; `faux` et
 * `bon` sont ses deux témoins (la contre-épreuve : le motif attrape ce qu'il
 * vise, rien de plus). On renomme l'AFFICHAGE, jamais une clé : `coach`,
 * `vestiaire`, `classeur`, `ecussons`, `chef` restent des clés de sauvegarde.
 *
 * Lu par scripts/check_lexique.mjs, qui lit chaque chaîne visible de js/ et
 * d'index.html (scripts/lib/chaines.mjs).
 */

export const LEXIQUE = {
  coach: {
    sens: 'la philosophie (une des neuf de js/coachs.js), un seul en poste ; la personne derrière le banc est l\'entraîneur ; une carte de personnel est un adjoint, celui du poste chef « l\'adjoint en chef »',
    fautif: /\b(le|un|du|sans le|invite le) coach (des gardiens|de sprint|élève|pète|sort|dans leur|paie|a parlé|laisse|qui promet|concentré)|cris du coach|selon le coach|Ton coach paie|Entraîneur-chef|tête de l'entraîneur|paie pas un entraîneur/i,
    faux: 'Le coach des gardiens', bon: 'Le coach de sa couleur',
  },
  entraineur: {
    sens: 'la personne derrière le banc, et la voix qui parle de la glace ; pas la maison du coach, pas le coach lui-même',
    fautif: /onglet Entraîneur|chez l'entraîneur\b|L'entraîneur-chef/i,
    faux: 'Le stage se joue chez l\'entraîneur', bon: 'L\'entraîneur des gardiens',
  },
  adjoint: {
    sens: 'une carte de personnel, un poste par rôle ; « ton adjoint » du duel est l\'adjoint en chef',
    fautif: /adjoints? du coach à chaises|les chaises de ton coach/i,
    faux: 'Les adjoints du coach à chaises', bon: 'Un adjoint parmi trois',
  },
  vestiaire: {
    sens: 'la pièce et l\'équipe qui y vit ; au repêchage, le vestiaire d\'une vraie équipe où l\'on pige ; pas les déblocages ni l\'effectif d\'une run',
    fautif: /vestiaire des déblocages|\bTon vestiaire\b|vestiaire croit (à|au)|dépense-les au vestiaire|onglet Vestiaire|vestiaire mince/i,
    faux: 'Le vestiaire des déblocages', bon: 'Le vestiaire est galvanisé',
  },
  classeur: {
    sens: 'le tirage du cartable au départ d\'une run ; pas la banque des cartes de jeu, pas les lotos de fin de saison',
    fautif: /^Le classeur$|vont à ton classeur|vestiaire tiré de ton classeur|🎰 Budget du classeur/,
    faux: 'Le classeur', bon: 'Le départ du classeur',
  },
  plombier: {
    sens: 'le rôle 🪠 ; les faibles du départ d\'une run sont des bouche-trous',
    fautif: /(équipe|bande|rassemble tes|place pour tes) (de )?plombiers|plombiers? (de la ligue|de départ|sont là|moins pires)|rejoin(t|dent) tes plombiers|avec des plombiers/i,
    faux: 'Une équipe de plombiers, 🪙 40', bon: 'Tirs +2 % par plombier 🪠 habillé',
  },
  contrat: {
    sens: 'le salaire d\'un joueur au plafond (son année de contrat, son contrat d\'entrée) ; une carte de jeu n\'est pas un contrat',
    fautif: /Un style, un contrat|une modif de contrat|Pack Contrats/i,
    faux: 'Un style, un contrat, une amélioration', bon: 'Son contrat pèse 8,5 M$',
  },
  ecusson: {
    sens: 'le logo du club, dessiné ; la monnaie des déblocages, ce sont les médailles 🏅',
    fautif: /\d+ écussons|écussons (à dépenser|pour ta saison|pour tes séries|de découverte|gagnés)|Tes écussons/i,
    faux: '🏅 +12 écussons pour ta saison', bon: 'Le nom, les couleurs et l\'écusson',
  },
  rejouer: {
    sens: 'les mêmes clubs, d\'autres dés (« Rejouer la saison », la revanche d\'une exhibition) ; l\'historique reprend un alignement, une décision reprend la saison',
    fautif: /On rejoue (la saison|les séries)|mêmes 31 clubs|^Rejouer$/,
    faux: 'On rejoue la saison avec ton choix…', bon: 'Rejouer la saison',
  },
  relance: {
    sens: 'le dé qu\'on relance ; la sortie de zone se dit « sortie », la passe du gardien « remise »',
    fautif: /Paire de relance|Relance rapide|Moins de relance|relance (la rondelle|en contre|du gardien|à un coéquipier)|qui relancent|gardien relance|la relance ou la gèle|pour la relance/i,
    faux: '💨 Relance rapide', bon: 'Tu peux relancer (2 relances)',
  },
  rivalite: {
    sens: 'ta rivalité est le club le plus croisé en gros match ; un rival, un club à deux rangs ; ta bête noire, celui qui t\'a battu deux fois',
    fautif: /^Rivalité$|ta némésis|ta rivale\b/i,
    faux: 'La défaite contre ta rivale', bon: 'Ta rivalité : MTL',
  },
  trophee: {
    sens: 'ce que le bilan décerne, sur les colonnes ; ce que le joueur porte est un trait',
    fautif: /Un trophée<\/strong>, rarement/i,
    faux: '<strong>Un trophée</strong>, rarement', bon: 'Les trophées de la saison',
  },
  agressivite: {
    sens: '🕊 Prudente, ⚖ Moyenne, 💥 Musclée, 🪓 Rentre-dedans ; jamais « basse »',
    fautif: /agressivité (🕊 )?basse|🕊 basse/i,
    faux: '(🕊 basse, ⚖ moyenne)', bon: 'une agressivité 🕊 Prudente',
  },
  // LE JARGON (Jalon M, B10) : le % d'arrêts et les matchs se disent en mots ; la route dit « chez », pas « @ » ni « DP ».
  arrets: {
    sens: 'le % d\'arrêts se dit en mots, pas « arr. » ni « (ligue ,904) »',
    fautif: /\d arr\.|\} arr\.|\(ligue (,\d|\$\{)/,
    faux: 'Badges +,005 arr.', bon: '+,005 au % d\'arrêts',
  },
  matchs: {
    sens: 'un match se dit en entier, pas « m. » ; les adjoints offerts le sont aux 9e, 18e et 26e MATCHS, une carte dure N matchs, jamais N journées',
    fautif: /\d m\.($|<)|\} m\.($|<)|\d+ journées? (de plus|encore|restantes?)|\} journées? (de plus|encore)/,
    faux: '${x.reste} m.</small>', bon: '5 matchs',
  },
  route: {
    sens: 'chez eux se dit « chez », une défaite en prolongation en mots',
    fautif: /^@ $|\bDP \d/,
    faux: '@ ', bon: 'chez PHI \'13',
  },
};

/*
 * UNE ICÔNE = UN SENS, dans ce qu'on voit en jouant. Les familles d'étiquettes
 * sont lues dans le code par check_lexique ; celles-ci sont les icônes qu'un
 * seul sens a le droit de porter, parce que le jeu en parle en mots.
 */
export const ICONES = {
  '🛡': 'le trait Selke',
  '🏅': 'les médailles, la monnaie des déblocages',
  '🪙': 'les jetons, la monnaie de la boutique',
  '🪠': 'le rôle plombier',
  '🏵': 'un galon',
  '🩹': 'l\'infirmerie',
};
