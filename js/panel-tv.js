/**
 * LE PANEL — l'univers médiatique de la saison.
 *
 * Une vraie télé sportive a des visages qui reviennent : le même animateur,
 * le même chroniqueur qui a toujours raison de s'inquiéter, le même
 * statisticien. Ce module les invente (aucun vrai nom) et leur donne des
 * répliques, des manchettes de bandeau et des bulletins de série. Le format
 * est celui d'une émission sérieuse ; ce qui fait rire, c'est le sérieux.
 *
 * LA RÈGLE DE CE FICHIER (la même que js/recit.js) : il ne décide de RIEN et
 * n'affirme rien qui ne soit dans la `situation` reçue. Chaque pièce porte une
 * étiquette (`si`) et se dit seulement quand l'étiquette est vraie ; une pièce
 * qui nomme une variable absente de la situation (`{autre}`, `{pts}`…) est
 * écartée. Le tirage est DÉTERMINISTE : même situation, même graine, mêmes
 * pièces. Aucun `Math.random`.
 *
 * LA SITUATION (`sit`, tous les champs sont facultatifs ; ce qui manque
 * n'ouvre simplement aucune étiquette) :
 *
 *   eq        nom court de ton club (ctx.teamShort(you) / tagCourt)
 *   autre     nom court de l'adversaire (match ou série en cours, ou qui t'élimine)
 *   jour      numéro de la journée (`jour` de js/saison.js) ; nbJours : leur total
 *   sequence  'V5' / 'D3' — le format de sequenceDe(you) de js/saison.js ; opère dès 3
 *   course    { dedans: bool, ecart: n } — points d'écart avec la dernière place en
 *             séries : dedans = tu en occupes une, ecart = ton avance (ou ton retard)
 *             en points ; n'ouvre rien au-delà de 4 points
 *   dateLimite 'proche' (quelques matchs avant) | 'passee' (la date limite des échanges,
 *             DATE_LIMITE_MATCH de js/rogue-jeu.js)
 *   vedetteBlessee  true quand le meilleur joueur est blessé (≥ 15 matchs, you.injuriesLog) ;
 *             vedette : son nom (facultatif)
 *   rang, rangPrevu, nbEquipes   ton rang au classement (rangDe(you)), celui d'avant-saison
 *             et la taille de la ligue : l'écart d'un cinquième de la ligue ouvre « surprend »
 *             ou « decoit »
 *   match     numéro (1 à 7) du match de série de ton club (tags m1 à m7)
 *   elimine   true quand ton club est sorti des séries ; coupe : true quand il l'a gagnée
 *   serie     { meneur, retard, wM, wR, joues, ot, fini, remonte31 } pour un BULLETIN, lu
 *             dans bilan.js (s.wA, s.wB, s.feuilles.length, f.ot du dernier match) :
 *             meneur/retard = noms courts (le vainqueur et le perdant quand `fini`),
 *             wM/wR = leurs victoires, remonte31 = le vainqueur a été mené 3-1
 *
 * Variables des gabarits : {eq} {autre} {n} (la longueur de la séquence) {jour} {rest}
 * (journées restantes) {rang} (« 5e », « 1er ») {pts} (« 1 point », « 3 points ») {m} (le
 * numéro du match) {vedette} {lead} {tard} {pointage} (« 3-1 », meneur en premier).
 */

/** Hachage stable d'une chaîne (le même que js/recit.js, qui ne l'exporte pas). */
function graineDe(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
const pige = (liste, g) => liste[Math.floor(g * liste.length) % liste.length];

/* ---------- les huit personnages ---------- */

const PANEL = [
  { id: 'anim', nom: 'Yvan Lépine-Tessier', titre: 'Animateur', voix: 'posé, précis, pose le décor et passe la parole' },
  { id: 'def', nom: 'Gaétan Brisebois', titre: 'Analyste, ancien défenseur', voix: 'laconique, concret, parle de portes à fermer et de rondelles à sortir' },
  { id: 'chron', nom: 'Lucien Maltais-Dupré', titre: 'Chroniqueur', voix: 'inquiet de nature, voit venir la suite, rappelle qu\'il l\'avait écrit' },
  { id: 'stat', nom: 'Stéphane Quirion', titre: 'Statisticien-conseil', voix: 'précis, compte les journées, se méfie des petits échantillons' },
  { id: 'gardien', nom: 'Médéric Landry-Cloutier', titre: 'Analyste, ancien gardien', voix: 'calme, parle du filet et de ce qui se passe dans la tête d\'un gardien' },
  { id: 'enquete', nom: 'Sylvie Archambault', titre: 'Journaliste affectée au club', voix: 'directe, pose la question que personne ne pose au vestiaire' },
  { id: 'momentum', nom: 'Maxime Ouimet-Racicot', titre: 'Spécialiste du momentum', voix: 'catégorique, lit chaque match comme une vague qui monte ou qui descend' },
  { id: 'partisan', nom: 'Marcel Plourde', titre: 'Partisan en direct, ligne ouverte', voix: 'fidèle, ému, appelle toujours de quelque part' },
];

/* ---------- les répliques : personnage → étiquette → une phrase ou plusieurs ---------- */

const R = {
  anim: {
    victoires: ['{eq} a gagné {n} matchs de suite. Le vestiaire ne veut pas en parler ; nous, oui.',
      'Bonsoir. {n} victoires d\'affilée pour {eq}, et une question autour de la table : jusqu\'où ?'],
    defaites: ['{eq} a perdu {n} matchs de suite. Ce soir, on cherche ce qui cloche, sans paniquer.',
      'Bonsoir. {n} défaites consécutives pour {eq}. Le panel a du pain sur la planche.'],
    debut: 'Journée {jour}. Trop tôt pour conclure, assez tôt pour avoir déjà des opinions.',
    milieu: 'Journée {jour}, il en reste {rest}. C\'est ici qu\'on cesse de dire « il est trop tôt ».',
    fin: 'Il reste {rest} journées. À ce stade-ci, chaque point se compte deux fois.',
    'course-dedans': '{eq} occupe une place en séries, avec {pts} d\'avance. Une avance mince, et tout le monde la regarde.',
    'course-dehors': '{eq} accuse {pts} de retard sur la dernière place en séries. Le temps presse.',
    echeance: 'La date limite des échanges approche. Les téléphones sonnent, et personne ne dit rien.',
    'echeance-passee': 'La date limite des échanges est passée. Les clubs sont ce qu\'ils sont, jusqu\'au bout.',
    blesse: '{eq} perd son meilleur joueur sur blessure. Toute la soirée, on se demande qui prendra le relais.',
    m1: 'Premier match de la série entre {eq} et {autre}. Tout le monde part de zéro.',
    m2: 'Deuxième match entre {eq} et {autre}. La série a maintenant une histoire, quoique brève.',
    m3: 'Troisième match. La série entre {eq} et {autre} change de ton.',
    m4: 'Quatrième match entre {eq} et {autre}. Ce soir, la série peut basculer.',
    m5: 'Cinquième match entre {eq} et {autre}. Plus personne, au studio, ne prétend que c\'est tôt.',
    m6: 'Sixième match de la série. Un club joue pour finir, l\'autre pour survivre.',
    m7: 'Septième match entre {eq} et {autre}. Il n\'y aura pas de huitième.',
    elimine: '{eq} est éliminé. La saison s\'arrête là, et le panel fait le bilan.',
    coupe: '{eq} remporte la Coupe. Le studio est debout, et je laisse la parole au panel.',
    surprend: '{eq} se retrouve au {rang} rang, bien au-delà de ce que nous avions annoncé. Le panel prend acte.',
    decoit: '{eq} est {rang}, très en deçà des attentes. Nous ne rappellerons pas qui avait prédit quoi.',
    general: ['Merci de nous suivre. Le panel est en place, et il y a du hockey à décortiquer.',
      'Bonsoir. Voici où en est {eq}, sans enrober.',
      'On revient dans un instant avec {eq}. Restez avec nous.'],
  },
  def: {
    victoires: ['{n} victoires de suite. Rien de magique : ils ferment les portes en zone et ils sortent la rondelle proprement.',
      'Quand on gagne {n} matchs de suite, c\'est que la sortie de zone est propre. Ce n\'est pas plus compliqué que ça.'],
    defaites: ['{n} défaites de suite. La rondelle reste trop longtemps dans notre zone, et on la regarde au lieu de la sortir.',
      'Quand on en perd {n} d\'affilée, on ne cherche pas un coupable : on cherche la porte qu\'on a laissée ouverte.'],
    debut: 'Journée {jour}. On ne joue pas encore le hockey du printemps. Mais les coins de patinoire, eux, font déjà mal.',
    milieu: 'À la journée {jour}, une équipe est ce qu\'elle est. Rarement ce qu\'elle prétend être.',
    fin: 'En fin de saison, on ne joue plus avec le style, on joue avec les jambes. Il reste {rest} journées pour voir lesquelles tiennent.',
    'course-dedans': 'Avec {pts} d\'avance, {eq} n\'a pas le droit de se désorganiser en zone neutre. C\'est là que ça se perd.',
    'course-dehors': 'À {pts} d\'une place en séries, {eq} n\'a pas besoin de jouer mieux. Le club a besoin de se tromper moins souvent.',
    echeance: 'La date limite des échanges, c\'est un défenseur de plus qu\'on cherche. On n\'en trouve jamais assez.',
    'echeance-passee': 'La date limite est passée. Avec ce vestiaire-là, on ira jusqu\'au bout. Ni bon ni mauvais : c\'est un fait.',
    blesse: 'Perdre son meilleur joueur, ça se règle en zone défensive : tout le monde en fait un peu plus sans la rondelle.',
    m1: 'Premier match. Celui qui se déplace le plus vite en zone neutre le gagne, en général.',
    m2: 'Deuxième match. Le premier a montré les plans, le deuxième montre qui s\'est ajusté.',
    m3: 'Troisième match. À cette étape, on se connaît. Les surprises viennent des erreurs, plus des plans.',
    m4: 'Quatrième match. Les corridors se rétrécissent. Chaque erreur en zone neutre se paie comptant.',
    m5: 'Cinquième match. On ne joue plus contre l\'autre équipe, on joue contre ses propres habitudes.',
    m6: 'Sixième match. Les jambes parlent plus fort que les plans. Ça se joue dans les coins de patinoire.',
    m7: 'Septième match. J\'en ai joué trois, et c\'était chaque fois le même : personne ne veut faire l\'erreur.',
    elimine: 'Une élimination, c\'est une porte qu\'on n\'a pas fermée au bon moment. On sait laquelle seulement au visionnement.',
    coupe: 'Une équipe qui gagne la Coupe, c\'est une équipe qui a fait moins d\'erreurs que les autres, soir après soir.',
    surprend: '{eq} au {rang} rang. C\'est ce qui arrive quand une équipe joue simple pendant que les autres jouent compliqué.',
    decoit: '{eq} est {rang}. Sur papier, ça devait marcher. Mais le papier ne bloque pas de tirs.',
    general: ['Le hockey, c\'est la rondelle, les portes et les jambes. Le reste, c\'est de la télévision.',
      'On peut tout dire, ça revient aux mêmes affaires : sortir la rondelle, garder sa position, ne pas faire de cadeau.'],
  },
  chron: {
    victoires: ['{n} victoires de suite, et personne ne demande ce que ça coûtera. Moi, je me le demande.',
      'Je ne conteste pas les {n} victoires. Je dis seulement qu\'une séquence finit toujours un soir.'],
    defaites: ['{n} défaites de suite. Je ne dis pas que je l\'avais prédit. Je dis que c\'est dans ma chronique du mois dernier.',
      'On me reproche d\'être pessimiste. Je réponds : {n} défaites de suite.'],
    debut: 'À la journée {jour}, tout le monde est optimiste. C\'est justement ce qui m\'inquiète.',
    milieu: 'Journée {jour}. À mi-saison, une équipe se révèle. Et ce qu\'on voit ne se cache plus.',
    fin: 'Il reste {rest} journées. C\'est peu pour tout réparer, et c\'est beaucoup pour tout gâcher.',
    'course-dedans': 'Oui, {eq} a {pts} d\'avance. Une avance comme celle-là, ça fond en une semaine.',
    'course-dehors': 'À {pts} de la dernière place, {eq} peut encore se qualifier. « Peut » est un verbe, pas une promesse.',
    echeance: 'La date limite des échanges approche, et on la rate toujours de la même façon : en espérant.',
    'echeance-passee': 'La date limite est passée. Ce qui n\'a pas été fait ne le sera pas. Je l\'avais écrit en octobre.',
    blesse: 'Le meilleur joueur est blessé. Une équipe, c\'est un fil, et le fil vient de casser là où je craignais.',
    m1: 'Premier match. Je ne prédis rien. Je rappelle seulement qu\'un premier match n\'a jamais garanti la suite.',
    m2: 'Après deux matchs, tout est possible. C\'est le genre de phrase qu\'on dit juste avant que ça tourne mal.',
    m3: 'Troisième match. À partir d\'ici, les erreurs coûtent plus cher que les bons coups ne rapportent.',
    m4: 'Quatrième match. Je ne prédis aucune issue. Je prédis seulement qu\'un des deux camps sera déçu.',
    m5: 'Cinquième match. Une série où l\'on dit « tout va bien » au cinquième match est une série qui n\'a pas compris.',
    m6: 'Sixième match. Si ça tourne, ça tourne ce soir. Et si ça ne tourne pas, on dira que ça aurait dû.',
    m7: 'Septième match. Quelqu\'un va perdre. Je n\'ose pas dire qui.',
    elimine: '{eq} est éliminé. Je ne dirai pas « je l\'avais dit ». Je demande seulement qu\'on le note.',
    coupe: '{eq} gagne la Coupe. Je suis heureux. Je commence déjà à m\'inquiéter pour l\'an prochain.',
    surprend: '{eq} est {rang}, c\'est une surprise. Et les surprises ont la mauvaise habitude de ne pas durer.',
    decoit: '{eq} est {rang}. C\'est exactement ce que je craignais, et ça ne me fait aucun plaisir.',
    general: ['Je ne suis pas pessimiste. Je suis informé.',
      'Tout va bien pour {eq}. C\'est la partie de la saison qui précède les explications.',
      'Je ne m\'emballe pas. Quelqu\'un doit garder la tête froide.'],
  },
  stat: {
    victoires: ['{n} victoires consécutives. La séquence est réelle ; ce qu\'elle veut dire, on le saura dans une semaine.',
      'Pour {eq}, {n} victoires de suite. Le chiffre est solide ; le reste, c\'est du récit.'],
    defaites: ['{n} défaites consécutives. Le chiffre est exact. La cause, elle, demande plus qu\'un soir de données.',
      '{eq} en est à {n} défaites de suite. Ce n\'est plus un accident, c\'est une tendance.'],
    debut: 'Nous en sommes à la journée {jour}, environ {pctSaison} de la saison. Un échantillon trop mince pour en tirer quoi que ce soit.',
    milieu: 'Journée {jour} : il reste {rest} journées. C\'est maintenant que les chiffres commencent à dire quelque chose.',
    fin: 'Il reste {rest} journées sur {nbJours}. Chacune pèse plus lourd que la précédente au classement.',
    'course-dedans': '{eq} a {pts} d\'avance. Sur un calendrier qui achève, c\'est mince, mais c\'est réel.',
    'course-dehors': 'Un retard de {pts}. C\'est rattrapable, à la condition de gagner presque tout.',
    echeance: 'À l\'approche de la date limite des échanges, la liste de ce qu\'on ignore est plus longue que celle de ce qu\'on sait.',
    'echeance-passee': 'La date limite est passée. Les effectifs sont figés : les chiffres d\'ici la fin seront ceux de ce groupe-là.',
    blesse: 'Le meilleur joueur est blessé. Une seule chose est sûre : il ne jouera pas. Le reste est à mesurer.',
    m1: 'Premier match de la série. Échantillon : un. C\'est insuffisant, et je le dirai encore demain.',
    m2: 'Deuxième match. L\'échantillon double. Il reste insuffisant, mais deux fois moins.',
    m3: 'Troisième match. Assez de matchs pour parler d\'une tendance, pas assez pour y croire.',
    m4: 'Quatrième match. L\'échantillon est de quatre. Je n\'en tirerai rien avant le cinquième.',
    m5: 'Cinquième match. Cinq matchs, c\'est un début d\'échantillon. Je dis bien : un début.',
    m6: 'Sixième match. Un seul match nous sépare de l\'échantillon complet.',
    m7: 'Septième match. L\'échantillon est complet. Et il se résume à un soir.',
    elimine: '{eq} est éliminé. Mes notes disaient « ça dépend ». Ça dépendait.',
    coupe: '{eq} gagne la Coupe. Je n\'en tirerai aucune règle générale. Je vais quand même relire mes tableaux.',
    surprend: '{eq} est {rang}, et nous avions annoncé un autre rang. Une partie de l\'écart est due au hasard, l\'autre non.',
    decoit: '{eq} est {rang}, plus bas qu\'anticipé. Le modèle n\'avait pas tout vu.',
    general: ['Précisons d\'abord ce que nous ne savons pas. Ça prendra moins de temps que l\'inverse.',
      'Je ne dis pas que {eq} est bon ou mauvais. Je dis que le club a joué {jour} journées, et que c\'est vérifiable.',
      'Les chiffres ne mentent pas. Mais il faut leur poser les bonnes questions.'],
  },
  gardien: {
    victoires: ['{n} victoires de suite. Derrière une séquence comme celle-là, il y a toujours un gardien qui arrête ce qu\'il doit arrêter.',
      '{n} victoires. Quand tout va bien, le gardien ne dit rien. Il attend le soir où on aura besoin de lui.'],
    defaites: ['{n} défaites. Un gardien qui perd autant finit par jouer avec la peur du prochain but. Il faut lui enlever ça.',
      'Quand on perd {n} fois de suite, ce n\'est jamais seulement le gardien. Mais c\'est toujours lui qu\'on regarde.'],
    debut: 'Journée {jour}. Au début d\'une saison, un gardien cherche son rythme. Les premiers buts le lui donnent ou le lui enlèvent.',
    milieu: 'À mi-chemin, un gardien sait déjà quels tirs le dérangent. Les adversaires aussi.',
    fin: 'Il reste {rest} journées. En fin de saison, un gardien chaud vaut un trio complet.',
    'course-dedans': 'Avec {pts} d\'avance, {eq} n\'a pas besoin d\'un miracle devant le filet. Juste d\'arrêts propres.',
    'course-dehors': 'À {pts} d\'une place, {eq} aura besoin de son gardien. Ces courses-là se gagnent souvent devant le filet.',
    echeance: 'La date limite des échanges approche. Chaque club pense à un attaquant. Il manque souvent un gardien.',
    'echeance-passee': 'La date limite est passée. On a ce qu\'on a. Un gardien apprend vite à travailler avec ça.',
    blesse: 'Un meilleur joueur blessé, c\'est moins de tirs de l\'autre bord. Le gardien le sait : il va être occupé.',
    m1: 'Premier match. Le gardien apprend les habitudes des tireurs adverses. Il les connaîtra par cœur au septième.',
    m2: 'Deuxième match. Les tireurs reviennent aux mêmes endroits. Le gardien commence à les attendre.',
    m3: 'Troisième match. Un gardien qui vole un match dans une série, ça change tout un vestiaire.',
    m4: 'Quatrième match. La série s\'installe, et le gardien qui craque le premier la perd souvent.',
    m5: 'Cinquième match. À ce stade, le gardien joue autant contre la fatigue que contre les tireurs.',
    m6: 'Sixième match. Le gardien n\'a plus le droit à un mauvais but. Pas un seul.',
    m7: 'Septième match. Le gardien qui reste calme le gagne. Ça a l\'air simple. Ça ne l\'est pas.',
    elimine: '{eq} est éliminé. Un gardien repasse chaque but pendant des semaines. Je parle d\'expérience.',
    coupe: '{eq} gagne la Coupe. Je ne dirai pas grand-chose. Le gardien, lui, ne l\'oubliera jamais.',
    surprend: '{eq} est {rang}. Quand une équipe surprend comme ça, regardez devant le filet : l\'explication est souvent là.',
    decoit: '{eq} est {rang}. Une équipe peut cacher bien des défauts. Pas devant son filet.',
    general: ['Un gardien ne cherche pas la réponse. Il se place devant la question.',
      'Il y a des saisons où tout entre et d\'autres où rien n\'entre. Pour {eq}, rien n\'est encore décidé.'],
  },
  enquete: {
    victoires: ['{eq} a gagné {n} matchs de suite. La question au vestiaire : qu\'est-ce qui a changé ? Personne ne veut toucher à ce qui marche.',
      'Après {n} victoires de suite, la question que je pose au club : est-ce que ça peut durer ?'],
    defaites: ['{n} défaites de suite pour {eq}. La question que je poserai demain matin : qui prend la parole dans ce vestiaire ?',
      'Après {n} défaites, la direction va devoir répondre à une question simple : on change quoi ?'],
    debut: 'À la journée {jour}, la question qu\'on me pose le plus : ce club-là, il vaut quoi, au juste ? Il est trop tôt pour répondre.',
    milieu: 'Mi-saison, journée {jour}. Le moment où la direction doit choisir : acheter, vendre, ou attendre.',
    fin: 'À {rest} journées de la fin, une question se pose dans les bureaux du club : ce groupe-là, on le garde ?',
    'course-dedans': 'Avec {pts} d\'avance, {eq} a sa place. La question : le club va-t-il jouer pour la garder, ou pour gagner ?',
    'course-dehors': 'À {pts} d\'une place en séries, {eq} n\'a plus beaucoup de marge. La direction le sait. Les joueurs aussi.',
    echeance: 'La date limite des échanges approche. Ma question à la direction : acheteur ou vendeur ?',
    'echeance-passee': 'La date limite est passée, et {eq} n\'a pas bougé. À la direction, maintenant, de l\'expliquer.',
    blesse: 'Le meilleur joueur est blessé. La question que je poserai au club : pour combien de temps ?',
    m1: 'Avant le premier match, une question : qui, chez {eq}, a déjà joué ce genre de série ? La réponse compte plus qu\'on pense.',
    m2: 'Deuxième match. Ma question au vestiaire : qu\'a-t-on appris du premier ?',
    m3: 'Troisième match. Les entraîneurs ont eu deux matchs pour se lire. Ce soir, on verra qui a le mieux étudié.',
    m4: 'Quatrième match de la série. Ma question au vestiaire : qui va se lever ce soir ?',
    m5: 'Cinquième match. Pendant que tout le monde regarde la glace, je regarde le banc. Les visages en disent long.',
    m6: 'Sixième match. Un club va jouer pour sa saison ce soir. Dans les deux vestiaires, on le sait.',
    m7: 'Septième match. Ce soir, une seule question compte : qui sera prêt ?',
    elimine: '{eq} est éliminé. Une seule question compte maintenant : qui sera encore là l\'an prochain ?',
    coupe: 'La Coupe à {eq}. Ce soir, aucune question. Demain, on demandera comment.',
    surprend: '{eq} est {rang}, et ça étonne. Ma question au club : est-ce que ça peut tenir ?',
    decoit: '{eq} est {rang}, et ça déçoit. La question va finir par se rendre au bureau du directeur général.',
    general: ['Je suis {eq} de près. Rien de suspect. Et c\'est justement ce qui m\'intrigue.',
      'La question qu\'on ne pose jamais assez à ce club-là : qui décide, au juste ?'],
  },
  momentum: {
    victoires: ['{n} victoires de suite : {eq} a le momentum. Ça se voit dans les replis, dans les retours au banc, partout.',
      'Avec {n} victoires, {eq} joue avec le vent dans le dos. Il faut en profiter avant qu\'il tourne.'],
    defaites: ['{n} défaites : le momentum a quitté {eq}. Il part sans prévenir, il revient pareil.',
      'Après {n} défaites de suite, {eq} joue à contre-courant. Il faut un but chanceux, un gros arrêt, n\'importe quoi.'],
    debut: 'Journée {jour}. Le momentum n\'est pas encore installé. Il se cherche une équipe.',
    milieu: 'À la journée {jour}, le momentum se stabilise. On commence à voir de quel côté il penche.',
    fin: 'À {rest} journées de la fin, le momentum vaut plus que n\'importe quel talent sur papier.',
    'course-dedans': '{eq} a {pts} d\'avance. Avec le momentum, c\'est confortable. Sans lui, ça fond.',
    'course-dehors': '{eq} accuse {pts} de retard. Il suffit d\'une séquence pour renverser ça. Une seule.',
    echeance: 'La date limite des échanges approche. Un bon échange, ça change le momentum d\'un vestiaire en une soirée.',
    'echeance-passee': 'La date limite est passée. Le momentum, maintenant, il faut le fabriquer avec ce qu\'on a.',
    blesse: 'Le meilleur joueur est blessé. Le momentum en prend un coup. Reste à voir qui le relance.',
    m1: 'Premier match. Celui qui le gagne part avec le momentum. Pas avec la série.',
    m2: 'Deuxième match. Le momentum vient de choisir un camp. Il peut encore changer d\'idée.',
    m3: 'Troisième match. C\'est souvent là que le momentum bascule.',
    m4: 'Quatrième match. Le momentum est là. On ne le voit pas, mais on le sent, comme la pression avant l\'orage.',
    m5: 'Cinquième match. À ce stade, le momentum est un fait. Ne venez pas me dire que c\'est une impression.',
    m6: 'Sixième match. Le momentum ne ment jamais, sauf quand il change. Et il change ce soir.',
    m7: 'Septième match. Le momentum repart à zéro. Le premier but le ramasse.',
    elimine: '{eq} est éliminé. Le momentum était parti bien avant le dernier match.',
    coupe: '{eq} gagne la Coupe. Le momentum était là au bon moment. C\'est tout ce qui compte.',
    surprend: '{eq} est {rang}. Ceux qui ne croient pas au momentum ont un rang à expliquer.',
    decoit: '{eq} est {rang}. Le momentum n\'a jamais été au rendez-vous, et ça paraît au classement.',
    general: ['Le momentum, ça ne se mesure pas. Mais ça se voit, et ça gagne des matchs.',
      'Chaque club a son momentum. Ce soir, {eq} a le sien.'],
  },
  partisan: {
    victoires: ['Marcel, de Laval, bonsoir. {n} victoires de suite ! J\'y ai cru dès le début, et je ne suis pas gêné de le dire.',
      'Allô, c\'est Marcel de Longueuil. {n} victoires d\'affilée, je suis ému. Je vais m\'asseoir sur mon perron.'],
    defaites: ['Marcel, de Laval. {n} défaites de suite, mais j\'ai confiance en {eq}. Je suis peut-être le dernier, mais je suis là.',
      'Bonsoir, c\'est Marcel. {n} défaites, c\'est dur. Mais mon chandail n\'est pas à vendre.'],
    debut: 'Marcel, de Brossard. Journée {jour}, et mon chandail est déjà repassé. Je tenais à le dire.',
    milieu: 'Bonsoir, Marcel de Laval. Journée {jour}, et je n\'ai pas changé d\'équipe. Je ne changerai pas.',
    fin: 'Allô, c\'est Marcel de Saint-Hubert. Il reste {rest} journées. Je les regarde toutes, du début à la fin.',
    'course-dedans': 'Marcel, de Laval. {eq} a {pts} d\'avance, et je ne touche plus à ma casquette. Elle est là depuis octobre.',
    'course-dehors': 'Bonsoir, c\'est Marcel. {eq} a {pts} de retard. J\'y crois encore. Il faut bien que quelqu\'un y croie.',
    echeance: 'Marcel, de Laval. La date limite des échanges approche. Moi, je garderais tout le monde.',
    'echeance-passee': 'Bonsoir, Marcel. La date limite est passée. On reste avec ce qu\'on a, et moi, j\'aime ce qu\'on a.',
    blesse: 'Allô, c\'est Marcel. Notre meilleur joueur est blessé. J\'appelle juste pour lui souhaiter un prompt retour.',
    m1: 'Marcel, de Laval. Premier match de la série contre {autre}. J\'ai sorti les drapeaux, tous, même le petit.',
    m2: 'Bonsoir, c\'est Marcel. Deuxième match contre {autre}. Je suis fébrile, et toute la maison aussi.',
    m3: 'Allô, Marcel de Laval. Troisième match. J\'ai pris congé demain. Mon patron comprend, je pense.',
    m4: 'Marcel, de Laval. Quatrième match contre {autre}. J\'ai avancé le souper pour ne rien manquer.',
    m5: 'Bonsoir, c\'est Marcel. Cinquième match. J\'ai le cœur qui bat comme un tambour.',
    m6: 'Allô, Marcel. Sixième match. Je l\'écoute dans la cour : en dedans, c\'est trop tendu pour moi.',
    m7: 'Marcel, de Laval. Septième match contre {autre}. Je n\'ai pas dormi. Je ne dormirai pas ce soir non plus.',
    elimine: 'Bonsoir, c\'est Marcel. {eq} est éliminé. Je veux juste dire merci aux joueurs. On se revoit en octobre.',
    coupe: 'Marcel, de Laval. {eq} a gagné la Coupe. Je ne peux pas parler. Je vais rappeler demain.',
    surprend: 'Allô, c\'est Marcel. {eq} est {rang}. Je le savais. Je ne l\'ai dit à personne, mais je le savais.',
    decoit: 'Bonsoir, Marcel. {eq} est {rang}. Ça me fait de la peine, mais je reste. On ne lâche pas son équipe pour un rang.',
    general: ['Marcel, de Laval, bonsoir. J\'appelle juste pour dire que {eq}, c\'est mon équipe. Je ne suis pas là pour me plaindre.',
      'Allô, c\'est Marcel. Je n\'ai rien de précis à dire, mais je voulais le dire en ondes.'],
  },
};

/** Les répliques à plat : { p, si, t }. */
const REPLIQUES = Object.entries(R).flatMap(([p, tags]) => Object.entries(tags)
  .flatMap(([si, ts]) => [].concat(ts).map(t => ({ p, si, t }))));

/* ---------- les manchettes du bandeau défilant : { si, t }, une ligne ---------- */

const M = {
  victoires: ['{eq} : {n} victoires de suite, et ça continue', '{n} victoires consécutives pour {eq}',
    '{eq} aligne {n} gains et ne regarde pas en arrière', 'Séquence de {n} victoires : {eq} ne ralentit pas',
    '{eq} : {n} matchs gagnés de suite, la ligue prend note', '{n} victoires de suite : {eq} joue avec le vent dans le dos',
    'Les {n} victoires de {eq} font jaser', '{eq} gagne encore : {n} de suite, le vestiaire reste prudent'],
  defaites: ['{eq} : {n} défaites de suite, l\'heure des questions', '{n} défaites consécutives pour {eq}',
    '{eq} encaisse une {n}e défaite de suite', 'Séquence de {n} défaites : {eq} cherche des réponses',
    '{eq} : {n} matchs perdus de suite, le banc s\'impatiente', '{n} défaites de suite, {eq} parle d\'« ajustements »',
    'Les {n} défaites de {eq} inquiètent', '{eq} : {n} revers d\'affilée, le vestiaire se regarde'],
  debut: ['Journée {jour} : la saison prend son envol', 'Début de saison : {eq} en est à la journée {jour}, rien n\'est joué',
    '{eq} à la journée {jour} : trop tôt pour juger, assez pour discuter', 'Journée {jour} : les premières tendances se dessinent',
    'Début de saison, journée {jour} : le calendrier suit son cours', 'Journée {jour} : l\'échantillon reste mince',
    '{eq} en début de saison : on attend d\'en voir plus', 'Journée {jour} : personne ne s\'emballe encore'],
  milieu: ['Journée {jour} : la saison est à mi-chemin', 'Mi-saison : {eq} à la journée {jour}, {rest} journées à jouer',
    'Journée {jour} : il reste {rest} journées, rien n\'est réglé', '{eq} à mi-parcours, l\'heure du premier bilan',
    'Mi-saison : le portrait se précise', 'Journée {jour} : le milieu de saison est atteint',
    '{rest} journées à jouer pour {eq}', 'À mi-saison, {eq} sait à quoi s\'en tenir'],
  fin: ['Plus que {rest} journées : chaque point compte', 'Fin de saison : {rest} journées, {eq} reste attentif',
    'Dernière ligne droite pour {eq} : {rest} journées', 'Il reste {rest} journées, la pression monte',
    'Fin de saison, journée {jour} : on retient son souffle', '{rest} journées à jouer : {eq} fait ses calculs',
    'La saison tire à sa fin : {rest} journées pour {eq}', 'Journée {jour} : le dernier tiers de la saison est entamé'],
  'course-dedans': ['{eq} garde {pts} d\'avance sur la dernière place en séries', 'Course aux séries : {eq} y est, {pts} d\'avance',
    '{eq} en séries pour l\'instant, avec {pts} de marge', 'Avance de {pts} pour {eq} : le coussin est mince',
    'Place en séries : {eq} y est, de {pts}', '{eq} maintient {pts} d\'avance et ne regarde pas derrière',
    'Course aux séries : {eq} garde sa place, {pts} d\'écart', 'Séries : {eq} conserve {pts} d\'avance'],
  'course-dehors': ['{eq} tire de l\'arrière de {pts} dans la course aux séries', 'Course aux séries : {eq} à {pts} d\'une place',
    '{eq} à {pts} d\'une place en séries : « rien n\'est perdu »', 'Retard de {pts} pour {eq} : il faudra gagner',
    'Séries : {eq} doit combler {pts}', '{eq} garde espoir malgré {pts} de retard',
    'Course aux séries : {pts} séparent {eq} d\'une place', '{eq} à {pts} des séries : le temps presse'],
  echeance: ['La date limite des échanges approche, les téléphones chauffent', 'Date limite des échanges : {eq} refuse de commenter',
    'À l\'approche de la date limite, {eq} dit « être à l\'écoute »', 'Date limite des échanges : plusieurs clubs magasinent',
    'La date limite approche : les directeurs généraux dorment peu', 'Date limite des échanges : {eq} se dit « satisfait de son groupe »'],
  'echeance-passee': ['La date limite des échanges est passée, {eq} n\'a pas bougé', 'Date limite passée : {eq} ira au bout avec son groupe',
    'Les échanges sont clos : {eq} garde son effectif', 'Date limite écoulée : les jeux sont faits',
    'Date limite derrière nous : {eq} regarde vers l\'avant', 'Les échanges sont terminés, place au hockey'],
  blesse: ['{eq} perd son meilleur joueur sur blessure', 'Meilleur joueur de {eq} blessé : le club « suit la situation »',
    'Le meilleur joueur de {eq} est blessé', '{eq} privé de son meilleur joueur',
    'Blessure : {eq} devra se débrouiller sans sa vedette', '{eq} annonce une blessure : « on verra jour après jour »'],
  m1: ['Série : premier match, {eq} contre {autre}', '{eq} et {autre} ouvrent la série',
    'Match 1 : {eq} contre {autre}, la série commence', 'Premier match de la série entre {eq} et {autre}'],
  m2: ['Série : deuxième match, {eq} contre {autre}', 'Match 2 : {eq} et {autre} remettent ça',
    '{eq} contre {autre} : deuxième match de la série', 'Match 2 entre {eq} et {autre}, rien n\'est tranché'],
  m3: ['Série : troisième match, {eq} contre {autre}', 'Match 3 : {eq} et {autre}, la série se resserre',
    '{eq} contre {autre} : troisième match de la série', 'Match 3 entre {eq} et {autre}, un tournant possible'],
  m4: ['Série : quatrième match, {eq} contre {autre}', 'Match 4 : {eq} et {autre}, la série peut basculer',
    '{eq} contre {autre} : quatrième match de la série', 'Quatrième match entre {eq} et {autre}, l\'étau se resserre'],
  m5: ['Série : cinquième match, {eq} contre {autre}', 'Match 5 : {eq} et {autre}, plus de place pour l\'erreur',
    '{eq} contre {autre} : cinquième match de la série', 'Match 5 entre {eq} et {autre}, le ton monte'],
  m6: ['Série : sixième match, {eq} contre {autre}', 'Match 6 : {eq} et {autre}, un club joue sa saison',
    '{eq} contre {autre} : sixième match de la série', 'Match 6 entre {eq} et {autre}, un septième est possible'],
  m7: ['Série : septième match, {eq} contre {autre}', 'Match 7 : {eq} et {autre}, pas de lendemain',
    '{eq} contre {autre} : septième match, tout se joue', 'Septième match entre {eq} et {autre}, personne ne dort'],
  elimine: ['{eq} est éliminé des séries', 'Fin de parcours pour {eq} : la saison est terminée', '{eq} sort des séries et remercie ses partisans',
    'Élimination de {eq} : l\'heure du bilan', '{eq} est éliminé, les séries continuent sans lui', 'La saison de {eq} est terminée'],
  coupe: ['{eq} remporte la Coupe', 'Coupe : {eq} au sommet', '{eq} gagne la Coupe, la ville est en fête',
    'Victoire finale de {eq} : la Coupe change de mains', '{eq} champion : le vestiaire savoure', 'La Coupe revient à {eq}'],
  surprend: ['{eq} au {rang} rang, bien au-delà des attentes', '{eq} {rang} : les spécialistes s\'étaient trompés',
    'Surprise : {eq} est {rang}, personne ne l\'avait annoncé', '{eq} dépasse les attentes et se classe {rang}',
    'Le {rang} rang de {eq} étonne les spécialistes', '{eq} {rang} : la surprise de la saison'],
  decoit: ['{eq} au {rang} rang, en deçà des attentes', '{eq} {rang} : le club promet des « ajustements »',
    'Déception : {eq} est {rang}, loin de ce qui était annoncé', '{eq} sous les attentes, {rang} au classement',
    'Le {rang} rang de {eq} préoccupe les observateurs', '{eq} {rang} : « pas ce qu\'on voulait », admet-on'],
  general: ['{eq} : le panel poursuit son analyse', 'Ailleurs dans la ligue, la soirée suit son cours',
    'Journée {jour} : les résultats suivent', '{eq} : « on y va un match à la fois », répète le club',
    'Le panel décortique la soirée', 'Pas de nouvelles de {eq}, et c\'est tant mieux',
    'Les résultats complets suivent après cette manchette', '{eq} garde le cap, selon une source près du club',
    'Rien à signaler au vestiaire de {eq}', 'Le panel revient après la pause'],
};

/** Les manchettes à plat : { si, t }, une ligne chacune. */
const MANCHETTES = Object.entries(M).flatMap(([si, ts]) => ts.map(t => ({ si, t })));

/* ---------- les bulletins de série : { si, t } ---------- */

const B = {
  'b-m1': ['Bulletin de série : {lead} gagne le premier match, {pointage}. {tard} a le temps de se reprendre.',
    'Premier match réglé : {lead} devant, {pointage}. La série ne fait que commencer.',
    'Bulletin : {lead} ouvre la série en gagnant, {pointage}. {tard} a pris note.',
    'Série {lead}–{tard} : {lead} prend les devants, {pointage}. Il reste beaucoup de hockey.',
    'Ouverture de série : {lead} l\'emporte, {pointage}. {tard} voudra répliquer au deuxième match.',
    'Bulletin de série : un à zéro pour {lead}. Rien n\'est joué.'],
  'b-egal': ['Bulletin de série : {lead} et {tard} sont à égalité, {pointage}. Tout reste à faire.',
    'Série égale entre {lead} et {tard}, {pointage}. Personne n\'a encore pris le dessus.',
    'Bulletin : {lead} et {tard} se tiennent, {pointage}. La série est loin d\'être réglée.',
    'La série {lead}–{tard} est à égalité, {pointage}. Le prochain match prend du poids.',
    '{lead} et {tard} ne se départagent pas : {pointage}. La série s\'étire.',
    'Égalité dans la série : {pointage} entre {lead} et {tard}. Chaque match compte double.'],
  'b-ecart': ['Bulletin de série : {lead} mène {pointage} contre {tard}. L\'avance est réelle, sans être définitive.',
    '{lead} prend deux victoires d\'avance sur {tard} : {pointage}. {tard} n\'a plus de marge.',
    'Série {lead}–{tard} : {pointage} pour {lead}. {tard} a une côte à remonter, et elle est raide.',
    'Bulletin : {lead} garde l\'initiative, {pointage}. {tard} doit réagir.',
    '{lead} mène {pointage} sur {tard}. Deux victoires d\'écart, ce n\'est pas encore la fin.',
    'Avance de {lead} sur {tard}, {pointage} : un club respire, l\'autre serre les dents.'],
  'b-menace': ['Bulletin de série : {lead} mène {pointage} et n\'est plus qu\'à une victoire d\'éliminer {tard}.',
    '{lead} est à un match de la ronde suivante : {pointage} contre {tard}. {tard} refuse de s\'avouer vaincu.',
    'Série {lead}–{tard} : {pointage}. Une seule victoire sépare {lead} de la ronde suivante.',
    'Bulletin : {tard} est dos au mur, {pointage}. Un revers de plus et la saison est finie.',
    '{lead} mène {pointage} et n\'a besoin que d\'un match. {tard} a besoin de tous les autres.',
    'À un match de la fin : {lead} mène {tard} {pointage}. {tard} joue pour sa survie.'],
  'b-m7': ['Bulletin de série : {pointage} entre {lead} et {tard}. Un septième match décidera de tout.',
    'La série {lead}–{tard} est à {pointage} : tout se jouera au septième match.',
    'Septième match à l\'horizon : {lead} et {tard} sont à égalité {pointage}.',
    'Bulletin : {pointage}, {lead} contre {tard}. Un seul match reste, et un seul des deux en sortira.',
    '{lead} et {tard} iront au bout : {pointage} dans la série. Le septième match tranchera.',
    'Le septième match est confirmé entre {lead} et {tard}, {pointage}. Pas de lendemain pour le perdant.'],
  'b-balayage': ['Bulletin de série : {lead} balaie {tard}, {pointage}. La série n\'a jamais été vraiment en jeu.',
    '{lead} élimine {tard} sans perdre un match. Un balayage, net et sans bavure.',
    'Balayage : {lead} écarte {tard}, {pointage}. Le plus court chemin vers la ronde suivante.',
    'Série terminée : {lead} l\'emporte {pointage} contre {tard}. Aucune nuit blanche.',
    '{tard} ne gagne aucun match : {lead} l\'emporte {pointage}. La ronde suivante s\'ouvre pour {lead}.',
    'Bulletin : {lead} a gagné la série {pointage} sans perdre. {tard} n\'a jamais trouvé la réponse.'],
  'b-remontee': ['Bulletin de série : {lead} était mené 3-1 et l\'emporte {pointage} contre {tard}. Une remontée pour l\'histoire.',
    'Remontée complète : {lead} était derrière 3-1 et passe {tard}, {pointage}. Les pronostics sont à refaire.',
    '{lead} sort d\'un déficit de 3-1 pour éliminer {tard}, {pointage}. Il y a des soirs où le calcul cède.',
    'Série terminée : {lead} a gagné {pointage} après avoir été mené 3-1. {tard} se demande encore comment.',
    'Bulletin : {tard} menait 3-1 et a perdu la série, {pointage} pour {lead}. Ça va hanter un vestiaire tout l\'été.',
    'Rareté : {lead} élimine {tard} {pointage} après un retard de 3-1. Trois victoires de suite, dos au mur.'],
  'b-elim7': ['Bulletin de série : {lead} gagne le septième match et élimine {tard}, {pointage}.',
    'Série réglée au septième : {lead} passe {tard}, {pointage}. Les nerfs ont tenu d\'un côté seulement.',
    'Septième match : {lead} l\'emporte et élimine {tard}. La série se termine {pointage}, sans appel.',
    'Bulletin : {lead} survit à un septième match contre {tard}, {pointage}.',
    '{tard} perd le septième match et la série, {pointage} pour {lead}. Le calendrier continue sans lui.',
    'Le septième match donne la série à {lead}, {pointage} contre {tard}. Une série qui a tout donné.'],
  'b-fini': ['Bulletin de série : {lead} élimine {tard}, {pointage}. La série est terminée.',
    '{lead} passe à la ronde suivante en battant {tard}, {pointage}.',
    'Série terminée : {lead} gagne {pointage} contre {tard}. Pour {tard}, l\'été commence.',
    'Bulletin : {tard} est éliminé par {lead}, {pointage}. Il n\'y aura pas d\'autre match.',
    '{lead} vient à bout de {tard}, {pointage}. La suite appartient à ceux qui restent.',
    'La série est réglée : {pointage} pour {lead}. {tard} vide son casier.'],
  'b-prolo': ['Bulletin de série : le dernier match s\'est réglé en prolongation. {lead} et {tard} en sont à {pointage}.',
    'Le dernier match a nécessité une prolongation : la série {lead}–{tard} est à {pointage}.',
    'Bulletin : un match décidé en prolongation. {lead} et {tard}, {pointage}. Les nerfs sont à vif.',
    'Le dernier match est allé en prolongation. La série est à {pointage} entre {lead} et {tard}.',
    'Série {lead}–{tard}, {pointage} : le plus récent match a nécessité du temps supplémentaire.',
    'Prolongation dans la série : {pointage} entre {lead} et {tard}, et un studio qui a perdu la notion de l\'heure.'],
};

/** Les bulletins à plat : { si, t }. */
const BULLETINS = Object.entries(B).flatMap(([si, ts]) => ts.map(t => ({ si, t })));

/* ---------- le tirage ---------- */

/** Le premier fait qui compte d'abord : une élimination avant une séquence, une séquence avant le calendrier. */
const PRIORITE = ['coupe', 'elimine', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'blesse', 'echeance', 'echeance-passee',
  'course-dedans', 'course-dehors', 'surprend', 'decoit', 'victoires', 'defaites', 'fin', 'milieu', 'debut'];
const PRIORITE_BULLETIN = ['b-remontee', 'b-elim7', 'b-balayage', 'b-m7', 'b-menace', 'b-fini', 'b-prolo', 'b-ecart', 'b-egal', 'b-m1'];

const rangMot = r => (r === 1 ? '1er' : `${r}e`);
const points = n => `${n} point${n > 1 ? 's' : ''}`;

/** Les variables qu'une situation permet de dire ; ce qui n'y est pas reste indéfini. */
function variablesDe(s) {
  const v = {};
  if (s.eq) v.eq = s.eq;
  if (s.autre) v.autre = s.autre;
  if (s.jour > 0) v.jour = s.jour;
  if (s.jour > 0 && s.nbJours > 0) {
    v.nbJours = s.nbJours;
    v.rest = Math.max(0, s.nbJours - s.jour);
    v.pctSaison = `${Math.round(100 * s.jour / s.nbJours)} %`;
  }
  const q = /^([VD])(\d+)$/.exec(s.sequence || '');
  if (q && Number(q[2]) >= 3) v.n = Number(q[2]);
  if (s.rang > 0) v.rang = rangMot(s.rang);
  if (s.course && s.course.ecart >= 1 && s.course.ecart <= 4) v.pts = points(s.course.ecart);
  if (s.match >= 1 && s.match <= 7) v.m = s.match;
  if (s.vedette) v.vedette = s.vedette;
  const se = s.serie;
  if (se && se.meneur && se.retard && se.wM >= 0 && se.wR >= 0) {
    v.lead = se.meneur; v.tard = se.retard; v.pointage = `${se.wM}-${se.wR}`;
  }
  return v;
}

/** Les étiquettes vraies pour cette situation, sans l'ordre de priorité. */
function etiquettesDe(s) {
  const t = new Set(['general']);
  const q = /^([VD])(\d+)$/.exec(s.sequence || '');
  if (q && Number(q[2]) >= 3) t.add(q[1] === 'V' ? 'victoires' : 'defaites');
  if (s.jour > 0 && s.nbJours > 0) {
    const f = s.jour / s.nbJours;
    t.add(f <= 0.2 ? 'debut' : f >= 0.75 ? 'fin' : f >= 0.25 && f <= 0.7 ? 'milieu' : 'general');
  }
  if (s.course && s.course.ecart >= 0 && s.course.ecart <= 4) t.add(s.course.dedans ? 'course-dedans' : 'course-dehors');
  if (s.dateLimite === 'proche') t.add('echeance');
  if (s.dateLimite === 'passee') t.add('echeance-passee');
  if (s.vedetteBlessee) t.add('blesse');
  if (s.match >= 1 && s.match <= 7) t.add(`m${s.match}`);
  if (s.elimine) t.add('elimine');
  if (s.coupe) t.add('coupe');
  if (s.rang > 0 && s.rangPrevu > 0 && s.nbEquipes > 0) {
    const seuil = Math.max(2, Math.round(s.nbEquipes / 5));
    if (s.rangPrevu - s.rang >= seuil) t.add('surprend');
    else if (s.rang - s.rangPrevu >= seuil) t.add('decoit');
  }
  return t;
}

/** Les étiquettes d'un bulletin : l'état de la série dit ce qui est vrai, et seulement cela. */
function etiquettesDeSerie(se) {
  const t = new Set();
  if (!se || se.wM == null || se.wR == null || !se.meneur || !se.retard) return t;
  const { wM, wR, joues, ot, fini, remonte31 } = se;
  if (fini) {
    t.add('b-fini');
    if (wR === 0) t.add('b-balayage');
    if (remonte31) t.add('b-remontee');
    if (joues === 7) t.add('b-elim7');
  } else {
    if (wM === wR && joues === 6) t.add('b-m7');
    else if (wM === wR && joues >= 2) t.add('b-egal');
    if (joues === 1) t.add('b-m1');
    if (wM === 3 && wR < 3) t.add('b-menace');
    else if (wM - wR === 2 && wM < 3) t.add('b-ecart');
  }
  if (ot) t.add('b-prolo');
  return t;
}

/** Remplit un gabarit ; null si une variable manque (la pièce ne se dit pas). */
function remplir(t, v) {
  let manque = false;
  const s = t.replace(/\{(\w+)\}/g, (_, k) => { if (v[k] === undefined) { manque = true; return ''; } return v[k]; });
  return manque ? null : s;
}

/**
 * Ce que le panel dit de cette situation, en fonction PURE : mêmes arguments,
 * même résultat.
 *
 *   situation  voir l'en-tête du fichier
 *   graine     une chaîne (ou un nombre) stable : saison + journée, par exemple
 *
 * Retourne `{ repliques, manchettes, bulletin }` :
 *   repliques   jusqu'à 3 `{ id, nom, titre, t }`, de personnages différents, une par étiquette
 *               vraie en ordre de priorité, `general` en dernier recours
 *   manchettes  jusqu'à 4 lignes de bandeau (≤ 80 caractères), deux étiquettes jamais de suite
 *               identiques, `general` pour combler
 *   bulletin    une phrase de bulletin de série, ou null hors série
 */
export function panelDe(situation, graine) {
  const s = situation || {}, v = variablesDe(s), tags = etiquettesDe(s), g = String(graine);
  const ordre = [...PRIORITE.filter(x => tags.has(x)), 'general'];

  const repliques = [], vus = new Set();
  for (let tour = 0; tour < 3 && repliques.length < 3; tour++) {
    for (const si of ordre) {
      if (repliques.length >= 3) break;
      const dispo = REPLIQUES.filter(r => r.si === si && !vus.has(r.p) && remplir(r.t, v) !== null);
      if (!dispo.length) continue;
      const r = pige(dispo, graineDe(`${g}|r|${si}|${tour}`));
      vus.add(r.p);
      const perso = PANEL.find(p => p.id === r.p);
      repliques.push({ id: r.p, nom: perso.nom, titre: perso.titre, t: remplir(r.t, v) });
    }
  }

  const manchettes = [], dits = new Set();
  for (let tour = 0; tour < 3 && manchettes.length < 4; tour++) {
    for (const si of ordre) {
      if (manchettes.length >= 4) break;
      const dispo = MANCHETTES.filter(m => m.si === si).map(m => remplir(m.t, v)).filter(x => x !== null && !dits.has(x));
      if (!dispo.length) continue;
      const x = pige(dispo, graineDe(`${g}|m|${si}|${tour}`));
      dits.add(x);
      manchettes.push(x);
    }
  }

  let bulletin = null;
  const bt = etiquettesDeSerie(s.serie);
  const sb = PRIORITE_BULLETIN.find(x => bt.has(x));
  if (sb) {
    const dispo = BULLETINS.filter(b => b.si === sb).map(b => remplir(b.t, v)).filter(x => x !== null);
    if (dispo.length) bulletin = pige(dispo, graineDe(`${g}|b|${sb}`));
  }
  return { repliques, manchettes, bulletin };
}
