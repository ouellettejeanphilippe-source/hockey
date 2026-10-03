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

export const PANEL = [
  { id: 'anim', nom: 'Yvan Lépine-Tessier', titre: 'Animateur', voix: 'posé, formel, remercie tout le monde, annonce la suite comme une loi' },
  { id: 'def', nom: 'Gaétan Brisebois', titre: 'Analyste, ancien défenseur', voix: 'laconique, concret, parle de portes à fermer et de rondelles à sortir' },
  { id: 'chron', nom: 'Lucien Maltais-Dupré', titre: 'Chroniqueur', voix: 'pessimiste, voit la fin dans tout, rappelle qu\'il l\'avait écrit' },
  { id: 'stat', nom: 'Stéphane Quirion', titre: 'Statisticien-conseil', voix: 'précis jusqu\'à l\'excès, compte des journées, ne conclut jamais' },
  { id: 'gardien', nom: 'Médéric Landry-Cloutier', titre: 'Analyste, ancien gardien', voix: 'calme, philosophe, parle du filet comme d\'une question' },
  { id: 'enquete', nom: 'Sylvie Archambault', titre: 'Journaliste d\'enquête', voix: 'grave, enquête sur des riens avec les moyens d\'un scandale' },
  { id: 'momentum', nom: 'Maxime Ouimet-Racicot', titre: 'Spécialiste du momentum', voix: 'catégorique, tient le momentum pour une grandeur physique' },
  { id: 'partisan', nom: 'Marcel Plourde', titre: 'Partisan en direct, ligne ouverte', voix: 'fidèle, ému, appelle toujours de quelque part' },
];

/* ---------- les répliques : personnage → étiquette → une phrase ou plusieurs ---------- */

const R = {
  anim: {
    victoires: ['{eq} a gagné {n} matchs de suite. Je le dis calmement, parce que quelqu\'un doit rester calme.',
      'Bonsoir. {eq} vient d\'aligner {n} victoires, ce que nous qualifierons, par prudence, de séquence.'],
    defaites: ['{eq} a perdu {n} matchs de suite. Nous allons en parler posément, comme des adultes.',
      'Bonsoir. {n} défaites consécutives pour {eq}. Le panel est là, la situation aussi.'],
    debut: 'Nous en sommes à la journée {jour}. Il est trop tôt pour conclure, et nous conclurons quand même, c\'est notre travail.',
    milieu: 'Journée {jour}, {rest} journées à jouer. Nous voici à l\'endroit exact où l\'on cesse de dire « il est trop tôt ».',
    fin: 'Il reste {rest} journées. À ce stade, chaque pointage est un document officiel.',
    'course-dedans': '{eq} occupe une place en séries, avec {pts} d\'avance. Nous allons traiter cette avance avec le sérieux qu\'elle mérite.',
    'course-dehors': '{eq} accuse {pts} de retard sur la dernière place en séries. Le panel va maintenant se pencher sur ce retard.',
    echeance: 'La date limite des échanges approche. Je rappelle aux téléspectateurs que nous ne savons rien, et que nous allons en parler longuement.',
    'echeance-passee': 'La date limite des échanges est passée. Les clubs sont ce qu\'ils sont ; le panel, lui, est toujours ici.',
    blesse: '{eq} perd son meilleur joueur sur blessure. Nous lui souhaitons un prompt rétablissement, et au panel, une analyse à la hauteur.',
    m1: 'Premier match de la série entre {eq} et {autre}. Nous partons de zéro, ce qui est, mathématiquement, l\'état le plus neutre.',
    m2: 'Deuxième match entre {eq} et {autre}. La série a maintenant une histoire, quoique brève.',
    m3: 'Troisième match. La série entre {eq} et {autre} entre dans ce que nous appellerons sa phase sérieuse.',
    m4: 'Quatrième match entre {eq} et {autre}. À ce stade, les cafés ont refroidi dans tout le studio.',
    m5: 'Cinquième match entre {eq} et {autre}. Plus personne, au studio, ne prétend que c\'est tôt.',
    m6: 'Sixième match de la série. Le panel tient à préciser que la fatigue du studio est réelle, mais secondaire.',
    m7: 'Septième match entre {eq} et {autre}. Il n\'y aura pas de huitième. J\'ai vérifié.',
    elimine: '{eq} est éliminé. Nous observons un moment de silence, de durée raisonnable, puis nous passons aux résultats.',
    coupe: '{eq} remporte la Coupe. Je cède la parole au panel, qui n\'avait rien prévu pour cette éventualité.',
    surprend: '{eq} se retrouve au {rang} rang, bien au-delà de ce que nous avions annoncé. Le panel prend acte et réserve son avis sur la suite.',
    decoit: '{eq} est {rang}, très en deçà des attentes. Nous ne rappellerons pas qui avait prédit quoi.',
    general: ['Merci de nous suivre. Le panel est en place, les micros fonctionnent, et le hockey aura lieu.',
      'Bonsoir. Voici l\'essentiel de la situation de {eq}, présentée sans gaieté excessive.',
      'Nous revenons dans un instant avec {eq}, après un message d\'un commanditaire dont le nom ne figure pas au dossier.'],
  },
  def: {
    victoires: ['{n} victoires de suite. Rien de magique : ils ferment les portes en zone et ils sortent la rondelle proprement.',
      'Quand on gagne {n} matchs de suite, c\'est que la sortie de zone est propre. C\'est souvent aussi simple et aussi ennuyeux que ça.'],
    defaites: ['{n} défaites de suite. La rondelle reste trop longtemps dans notre zone, et on la regarde, au lieu de la sortir.',
      'Quand on en perd {n} d\'affilée, on ne cherche pas un coupable : on cherche la porte qu\'on a laissée ouverte.'],
    debut: 'Journée {jour}. On ne joue pas encore le hockey de printemps. Mais la rondelle, elle, est déjà aussi dure.',
    milieu: 'À la journée {jour}, une équipe est ce qu\'elle est. Elle est rarement ce qu\'elle prétend être.',
    fin: 'En fin de saison, on ne joue plus avec le style, on joue avec les jambes. Il reste {rest} journées pour savoir lesquelles tiennent.',
    'course-dedans': 'Avec {pts} d\'avance, {eq} n\'a pas le droit de se désorganiser en zone neutre. C\'est là que ça se perd.',
    'course-dehors': 'À {pts} d\'une place en séries, {eq} n\'a pas besoin de jouer mieux. Elle a besoin de se tromper moins souvent.',
    echeance: 'La date limite des échanges, c\'est un défenseur de plus qu\'on cherche, et on n\'en trouve jamais assez.',
    'echeance-passee': 'La date limite est passée. Avec ce vestiaire-là, on ira jusqu\'au bout. Ce n\'est ni bon ni mauvais, c\'est un fait.',
    blesse: 'Perdre son meilleur joueur, ça se règle en zone défensive : tout le monde joue dix pour cent de plus sans la rondelle.',
    m1: 'Premier match. Celui qui se déplace le plus vite en zone neutre le gagne, en général.',
    m2: 'Deuxième match. Le premier a montré les plans, le deuxième montre qui s\'est ajusté.',
    m3: 'Troisième match. À cette étape, on se connaît. Les surprises viennent des erreurs, plus des plans.',
    m4: 'Quatrième match. Les corridors se rétrécissent. Chaque erreur en zone neutre se paie comptant.',
    m5: 'Cinquième match. On ne joue plus contre l\'autre équipe, on joue contre ses propres habitudes.',
    m6: 'Sixième match. Les jambes parlent plus fort que les plans. Ça se joue aux coins de patinoire.',
    m7: 'Septième match. Je l\'ai joué trois fois, et trois fois ce fut le même match : personne ne veut faire l\'erreur.',
    elimine: 'Une élimination, c\'est une porte qu\'on n\'a pas fermée au bon moment. On ne sait jamais laquelle, avant le visionnement.',
    coupe: 'Une équipe qui gagne la Coupe, c\'est une équipe qui a fait moins d\'erreurs que toutes les autres, soir après soir.',
    surprend: '{eq} au {rang} rang. C\'est ce qui arrive quand une équipe joue simplement, et que les autres jouent compliqué.',
    decoit: '{eq} est {rang}. Sur papier, ça devait marcher. Mais le papier ne ferme pas les portes.',
    general: ['Le hockey, c\'est la rondelle, les portes et les jambes. Le reste, c\'est la télévision.',
      'On a beau tout dire, ça revient aux mêmes affaires : sortir la rondelle, garder sa position, ne pas faire de cadeau.'],
  },
  chron: {
    victoires: ['{n} victoires de suite, et personne ne demande ce que ça nous coûtera. Moi, je me le demande.',
      'Je ne conteste pas les {n} victoires de {eq}. Je dis seulement que toute séquence a une fin, et que j\'en connais la date approximative.'],
    defaites: ['{n} défaites de suite. Je ne dis pas que je l\'avais prédit. Je dis que c\'est dans ma chronique du mois dernier.',
      'On me reproche d\'être pessimiste. Je réponds : {n} défaites de suite.'],
    debut: 'À la journée {jour}, tout le monde est optimiste. C\'est précisément ce qui m\'inquiète.',
    milieu: 'Journée {jour}. À mi-saison, une équipe se révèle. J\'aurais préféré qu\'elle se taise.',
    fin: 'Il reste {rest} journées. C\'est peu pour tout réparer, et c\'est beaucoup pour tout gâcher.',
    'course-dedans': 'Oui, {eq} a {pts} d\'avance. Une avance, c\'est un retard qui n\'a pas encore décidé quand il se présenterait.',
    'course-dehors': 'À {pts} de la dernière place, {eq} peut encore se qualifier. Je précise que « peut » est un verbe, pas une promesse.',
    echeance: 'La date limite des échanges approche, et l\'histoire montre qu\'on la rate toujours de la même façon : en espérant.',
    'echeance-passee': 'La date limite est passée. Ce qui n\'a pas été fait ne le sera pas. Je l\'avais écrit en octobre, dans un passage que personne n\'a lu.',
    blesse: 'Le meilleur joueur est blessé. Une équipe, c\'est un fil, et le fil vient de casser exactement où je l\'avais dit.',
    m1: 'Premier match. Je ne prédis rien. Je rappelle seulement que le premier match n\'a jamais prouvé que la suite irait bien.',
    m2: 'Après deux matchs, tout est possible. C\'est le genre de phrase qu\'on dit juste avant que ça tourne mal.',
    m3: 'Troisième match. À partir d\'ici, les erreurs coûtent plus cher que les bons coups ne rapportent.',
    m4: 'Quatrième match. Je ne prédis aucune issue. Je prédis seulement qu\'on sera déçu, d\'un côté ou de l\'autre.',
    m5: 'Cinquième match. Une série où l\'on dit « tout va bien » au cinquième match est une série qui n\'a pas compris.',
    m6: 'Sixième match. Si ça tourne, ça tourne ce soir. Et si ça ne tourne pas, on dira que ça aurait dû.',
    m7: 'Septième match. Quelqu\'un va perdre. Moi, je perds depuis le début de la série.',
    elimine: '{eq} est éliminé. Je ne veux pas dire « je l\'avais dit ». Je veux seulement que ce soit noté.',
    coupe: '{eq} gagne la Coupe. Je tiens à dire que je suis heureux, et que cela ne durera pas, ce qui est le principe du bonheur.',
    surprend: '{eq} est {rang}, c\'est une surprise. Une surprise, c\'est une déception qui n\'a pas encore eu lieu.',
    decoit: '{eq} est {rang}. C\'est exactement ce que je craignais, et ça ne me fait aucun plaisir. Je le précise.',
    general: ['Je ne suis pas pessimiste. Je suis informé.',
      'Tout va bien pour {eq}. C\'est la phase de la saison qui précède les explications.',
      'Je me réjouis d\'avance de ne pas me réjouir.'],
  },
  stat: {
    victoires: ['{n} victoires consécutives. La séquence est réelle ; son interprétation demande encore une semaine de réflexion.',
      'Pour {eq}, {n} victoires de suite. Je précise que {n} est un nombre, et que le reste est un récit.'],
    defaites: ['{n} défaites consécutives. Je note que le chiffre est exact et que sa cause fait l\'objet d\'un tableau en préparation.',
      'La séquence de {eq} est de {n} défaites. Elle est donc de {n} défaites, et j\'insiste sur la précision.'],
    debut: 'Nous en sommes à la journée {jour}, soit environ {pctSaison} de la saison. Je m\'interdis toute conclusion avant la journée {nbJours}. Je me réserve la suivante.',
    milieu: 'Journée {jour} : il reste {rest} journées. Le travail commence véritablement à ce stade, car les erreurs ont enfin assez de données pour se comparer.',
    fin: 'Il reste {rest} journées sur {nbJours}. Statistiquement, chacune pèse davantage que la précédente, et je suis le seul à m\'en réjouir.',
    'course-dedans': '{eq} a {pts} d\'avance. Je rappelle qu\'un point est un point, et que cette tautologie a longtemps été sous-estimée.',
    'course-dehors': 'Un retard de {pts}. Je dispose d\'un graphique à ce sujet, mais il n\'est pas encore terminé, et il sera très long.',
    echeance: 'À l\'approche de la date limite des échanges, j\'ai établi une liste de ce que nous ignorons. Elle compte plusieurs pages.',
    'echeance-passee': 'La date limite est passée. La banque de données est maintenant fermée aux échanges, et ouverte à mes commentaires.',
    blesse: 'Le meilleur joueur est blessé. Je suis en mesure de confirmer qu\'il ne joue pas, ce qui est la première donnée de la série.',
    m1: 'Premier match de la série. Échantillon : un. Je le trouve insuffisant, et je suis prêt à le répéter.',
    m2: 'Deuxième match. L\'échantillon double. Il reste insuffisant, mais il est désormais deux fois plus insuffisant.',
    m3: 'Troisième match. Nous avons maintenant assez de matchs pour prétendre à une tendance, et pas assez pour la croire.',
    m4: 'Quatrième match. À ce stade, l\'échantillon est de quatre, dont je ne tirerai rien avant le cinquième.',
    m5: 'Cinquième match. Mon échantillon est de cinq. Il me manque toujours deux matchs pour ne rien conclure.',
    m6: 'Sixième match. Un seul match nous sépare de l\'échantillon complet, que je regretterai d\'avoir obtenu.',
    m7: 'Septième match. Je suis ravi : l\'échantillon est complet. J\'en suis le seul, mais je le suis pleinement.',
    elimine: '{eq} est éliminé. Je relis mes notes, qui disaient « ça dépend ». Je les confirme.',
    coupe: '{eq} gagne la Coupe. Je propose de n\'en tirer aucune règle générale. J\'invite chacun à faire de même.',
    surprend: '{eq} est {rang}, et nous avions anticipé un autre rang. J\'ajoute que l\'écart est entièrement dû au hasard, sauf la partie qui est due à autre chose.',
    decoit: '{eq} est {rang}, plus bas qu\'anticipé. Je précise que mon modèle a raison, et que c\'est la saison qui s\'est trompée.',
    general: ['Précisons d\'abord ce que nous ne savons pas. Cela prendra moins de temps que l\'inverse.',
      'Je ne dis pas que {eq} est bon ou mauvais. Je dis qu\'elle a joué {jour} journées, ce qui est vérifiable.',
      'Les chiffres ne mentent pas. Ils disent seulement ce qu\'ils veulent, avec beaucoup de précision.'],
  },
  gardien: {
    victoires: ['Une séquence de {n} victoires n\'est qu\'une rondelle qui a oublié de dévier. Elle s\'en souviendra.',
      '{n} victoires. Le filet ne se plaint pas quand tout va bien. Il attend.'],
    defaites: ['{n} défaites. Le filet ne juge pas. Il reçoit, simplement, et c\'est ce qui le rend si fatigant à regarder.',
      'Quand on perd {n} fois de suite, c\'est que la rondelle a décidé d\'apprendre quelque chose à l\'équipe. Elle est lente, mais elle enseigne.'],
    debut: 'Journée {jour}. Au début d\'une saison, le filet est vide de souvenirs. C\'est sa plus grande qualité.',
    milieu: 'À mi-chemin, le gardien comprend que le tir qu\'il craint est celui qu\'il n\'a pas vu venir. C\'est vrai aussi des saisons.',
    fin: 'Il reste {rest} journées. En fin de saison, on ne se bat plus contre l\'adversaire. On se bat contre ce qu\'on a laissé entrer.',
    'course-dedans': 'Avec {pts} d\'avance, {eq} est dans le filet de la qualification. Reste à savoir qui, des deux, protège l\'autre.',
    'course-dehors': 'À {pts} d\'une place, {eq} regarde la porte de l\'extérieur. Un gardien sait que ce n\'est pas la porte qui est fermée, c\'est le regard.',
    echeance: 'La date limite des échanges approche. Chaque club se demande ce qui lui manque. La plupart pensent à un joueur. Il s\'agit rarement d\'un joueur.',
    'echeance-passee': 'La date limite est passée. On a ce qu\'on a. C\'est la seule vraie sagesse du métier de gardien.',
    blesse: 'Un meilleur joueur blessé, c\'est un espace dans le jeu. Le gardien sait que l\'espace n\'est jamais vide : il se remplit de ce qu\'on craignait.',
    m1: 'Le premier match n\'est pas un match. C\'est une question que les deux clubs posent au filet, sans attendre de réponse.',
    m2: 'Deuxième match. Le filet a déjà reçu deux fois la visite des mêmes rondelles. Il commence à les reconnaître.',
    m3: 'Troisième match. Le gardien sait que le temps ne s\'arrête pas entre deux arrêts, même s\'il en a l\'air.',
    m4: 'Quatrième match. La série s\'installe, comme la neige sur le toit d\'un aréna : sans bruit, mais avec du poids.',
    m5: 'Cinquième match. Le filet n\'a pas de côté. Il ne choisit pas, il reçoit. Les séries aussi.',
    m6: 'Sixième match. À ce stade, le gardien n\'arrête plus des tirs. Il arrête du temps.',
    m7: 'Septième match. Ce soir, le filet est seul avec ce qu\'il est. La rondelle n\'a rien d\'autre à lui apprendre.',
    elimine: '{eq} est éliminé. Un gardien vous le dira : l\'élimination est un but que l\'on voit entrer pendant des semaines.',
    coupe: '{eq} gagne la Coupe. Je ne dirai rien. Un gardien sait que ce silence est le plus grand compliment.',
    surprend: '{eq} est {rang}. Un filet qu\'on croyait ouvert s\'est refermé. Personne ne sait pourquoi, et c\'est très bien ainsi.',
    decoit: '{eq} est {rang}. Une promesse n\'est qu\'une rondelle qui n\'est pas encore entrée dans le filet. Elle a raté.',
    general: ['Un gardien ne cherche pas la réponse. Il se met devant la question.',
      'Il y a des saisons qui laissent entrer. D\'autres qui arrêtent. {eq} est en train de choisir.'],
  },
  enquete: {
    victoires: ['{eq} a gagné {n} matchs de suite. Notre équipe a cherché le changement dans le vestiaire. Elle a trouvé un thermostat.',
      'Après {n} victoires de suite, nous avons voulu savoir ce qui avait changé chez {eq}. Personne n\'a voulu répondre à la question du dîner.'],
    defaites: ['{n} défaites de suite pour {eq}. Selon nos informations, la machine à café du vestiaire aurait été déplacée. Nous n\'établissons aucun lien.',
      'Notre enquête sur les {n} défaites de {eq} se poursuit. Une première piste : l\'horaire des autobus. Nous reviendrons.'],
    debut: 'À la journée {jour}, notre équipe a obtenu les menus du premier voyage. Le contenu des menus sera dévoilé progressivement.',
    milieu: 'Mi-saison, journée {jour} : nous avons consulté le registre de stationnement du centre d\'entraînement. Une voiture bleue y a passé la nuit. Personne ne sait laquelle.',
    fin: 'À {rest} journées de la fin, une question demeure : qui range les rondelles d\'entraînement, et selon quel principe ? Notre enquête approche de la réponse.',
    'course-dedans': 'Pendant que {eq} conserve {pts} d\'avance, nous nous demandons qui, au club, a la clé de la salle de vidéo. Nous n\'avons pas la réponse.',
    'course-dehors': 'À {pts} d\'une place en séries, {eq} fait face à un retard. Nous avons demandé si les lacets étaient en cause. On nous a dit non, trop vite.',
    echeance: 'À l\'approche de la date limite des échanges, nous avons joint un représentant de {eq}. Il a dit qu\'il était dans un souper. Lequel ? Nous creusons.',
    'echeance-passee': 'La date limite est passée. Notre équipe tente d\'établir qui a pris la dernière pointe de pizza du bureau. Aucun lien n\'est établi avec les échanges.',
    blesse: 'Le meilleur joueur de {eq} est blessé. Nous avons demandé le dossier médical. On nous a plutôt remis un horaire de stationnement. Cela mérite réflexion.',
    m1: 'Avant le premier match, nous avons pu obtenir la liste des chandails de rechange. Elle est plus longue que prévu, et nous demandons pourquoi.',
    m2: 'Deuxième match. Notre enquête sur le sel de la patinoire se poursuit. Nous avons maintenant deux échantillons. Ils ne concordent pas.',
    m3: 'Troisième match : la question du thermos orange du banc demeure sans réponse. Il aurait changé de place. Nous avons une photo, et elle n\'aide pas.',
    m4: 'Quatrième match de la série. Selon un document que nous avons consulté, les cintres du vestiaire de {eq} seraient numérotés. Nous cherchons à comprendre.',
    m5: 'Cinquième match. Pendant que tout le monde regarde la glace, nous regardons le tableau des corvées. Il comporte une erreur.',
    m6: 'Sixième match. Notre équipe a retrouvé la trace de la cravate disparue de l\'entraîneur adjoint. Nous préférons ne pas conclure.',
    m7: 'Septième match. Ce soir, plus de questions que de réponses, comme toujours. Nous en avons trente-deux, dont une porte sur le sel.',
    elimine: 'Après l\'élimination de {eq}, nous avons demandé qui avait vidé le réfrigérateur du vestiaire. La réponse nous a été refusée. Nous y reviendrons.',
    coupe: '{eq} gagne la Coupe. Nous cherchons maintenant à savoir qui a décidé de l\'ordre des photos. Le dossier est lourd.',
    surprend: 'Le rang de {eq} ({rang}) étonne. Nous avons cherché une explication dans le menu des collations. Nous en avons trouvé une, que nous ne publierons pas.',
    decoit: 'Le rang de {eq} ({rang}) déçoit. Nous avons examiné la température du vestiaire. Elle est restée stable, ce qui est en soi troublant.',
    general: ['Notre équipe poursuit son enquête sur {eq}. Elle n\'a rien trouvé de suspect. C\'est ce qui l\'inquiète.',
      'Selon nos sources, le bureau du directeur général aurait été repeint. Nous ne savons pas encore en quelle couleur, ni pourquoi cela nous regarde.'],
  },
  momentum: {
    victoires: ['{n} victoires de suite : {eq} a le momentum. Le momentum est une réalité scientifique, et je la mesure à l\'oeil, ce qui est la méthode reconnue.',
      'Avec {n} victoires, le momentum de {eq} est à son maximum. Il ne peut que baisser, ou monter, ce qui est un phénomène classique.'],
    defaites: ['{n} défaites : le momentum a quitté {eq}. Il est parti sans prévenir, ce qui est son comportement habituel.',
      'Après {n} défaites de suite, le momentum de {eq} est à zéro, et même un peu en dessous, ce qui est rare en physique.'],
    debut: 'Journée {jour}. Le momentum n\'est pas encore installé. Il est à l\'étape que j\'appelle « en attente de se manifester ».',
    milieu: 'À la journée {jour}, le momentum se stabilise. Il ne dit pas encore où il va, mais il y va avec détermination.',
    fin: 'À {rest} journées de la fin, le momentum est la seule donnée qui compte, et la seule dont personne ne s\'est jamais servi.',
    'course-dedans': '{eq} a {pts} d\'avance. Le momentum est de son côté, et je le dis parce que le momentum est toujours du côté de celui qui mène.',
    'course-dehors': '{eq} accuse {pts} de retard. Le momentum n\'est pas de son côté, mais il est à portée, ce qui est l\'état préféré des équipes qui y croient.',
    echeance: 'La date limite des échanges approche. Le momentum d\'un club change à chaque échange. Il peut aussi changer sans échange, mais c\'est plus rare.',
    'echeance-passee': 'La date limite est passée. Le momentum de chaque équipe est maintenant figé, et il ne le sera pas longtemps.',
    blesse: 'Le meilleur joueur de {eq} est blessé. Le momentum d\'une équipe ne s\'arrête pas pour une blessure. Il hésite, puis il décide, et ce n\'est pas toujours pareil.',
    m1: 'Premier match. Le momentum est neutre, à zéro, et il reste à voir de quel côté il tombera. Il tombe toujours de quelque côté.',
    m2: 'Deuxième match. Le momentum vient de se manifester. Je ne dirai pas de quel côté : il le dira lui-même.',
    m3: 'Troisième match. Le momentum d\'une série se construit en trois étapes. Nous venons de franchir la troisième, ce qui est inhabituel.',
    m4: 'Quatrième match. Le momentum est là. On ne le voit pas, mais on le sent, comme la pression avant l\'orage.',
    m5: 'Cinquième match. À ce stade, le momentum est un fait, et je ne laisserai personne me dire que c\'est une impression.',
    m6: 'Sixième match. Le momentum ne ment jamais, sauf quand il change. Je l\'ai toujours dit.',
    m7: 'Septième match. Le momentum n\'existe plus : il a été remis à zéro, ce qui est à la fois rare et prévisible.',
    elimine: '{eq} est éliminé. Le momentum, comme prévu, est parti avant le dernier match. Il ne revient jamais pour les derniers.',
    coupe: '{eq} gagne la Coupe. Le momentum a fait son travail, et je précise qu\'il le fait gratuitement.',
    surprend: '{eq} est {rang}. Le momentum a été sous-estimé, comme toujours, par ceux qui ne le mesurent pas.',
    decoit: '{eq} est {rang}. Le momentum n\'a jamais été au rendez-vous, et je ne comprends pas pourquoi il a été invité.',
    general: ['Le momentum est une réalité scientifique. Je n\'accepterai aucune question là-dessus avant la pause.',
      'Chaque club a son momentum. Celui de {eq} est actuellement là où il doit être, ce qui est rassurant et exact.'],
  },
  partisan: {
    victoires: ['Marcel, de Laval, bonsoir. {n} victoires de suite, et je tiens à dire que j\'y ai cru dès le début, même quand ce n\'était pas nécessaire.',
      'Allô, c\'est Marcel de Longueuil. {n} victoires de {eq}, je suis très ému, je vais devoir m\'asseoir sur mon perron.'],
    defaites: ['Marcel, de Laval. {n} défaites de suite, mais je tiens à dire que j\'ai confiance en {eq}. Je suis le dernier, mais je suis là.',
      'Bonsoir, c\'est Marcel. J\'appelle pour dire que {n} défaites, c\'est dur, mais mon chandail n\'est pas à vendre, et ma femme est d\'accord.'],
    debut: 'Marcel, de Brossard. À la journée {jour}, j\'ai déjà mon chandail repassé. Je tiens à ce que ce soit su.',
    milieu: 'Bonsoir, Marcel de Laval. Journée {jour}, et je n\'ai pas changé d\'équipe. Je tiens à ce qu\'on le note au dossier.',
    fin: 'Allô, c\'est Marcel de Saint-Hubert. Il reste {rest} journées. J\'ai pris congé de mon jardin pour les regarder toutes.',
    'course-dedans': 'Marcel, de Laval. {eq} a {pts} d\'avance et je ne touche pas à ma casquette, par superstition. Elle est là depuis octobre.',
    'course-dehors': 'Bonsoir, c\'est Marcel. {eq} a {pts} de retard, et moi, j\'ai encore ma chaise bleue. Je ne la lâche pas.',
    echeance: 'Marcel, de Laval. La date limite des échanges approche. J\'aimerais qu\'on garde tout le monde, y compris ceux dont je ne connais pas le nom.',
    'echeance-passee': 'Bonsoir, Marcel. La date limite est passée. Je reste avec ce qu\'on a. J\'ai toujours aimé ce qu\'on a.',
    blesse: 'Allô, c\'est Marcel. Le meilleur joueur de {eq} est blessé. J\'appelle simplement pour lui dire que je pense à lui, et à sa mère.',
    m1: 'Marcel, de Laval. Premier match de la série contre {autre}. J\'ai sorti les drapeaux, tous, y compris le trop petit.',
    m2: 'Bonsoir, c\'est Marcel. Deuxième match contre {autre}. Je suis fébrile, ma femme aussi, et le chien est parti dans l\'autre pièce.',
    m3: 'Allô, Marcel de Laval. Troisième match. J\'ai pris congé du travail. Mon patron est au courant et il comprend, je crois.',
    m4: 'Marcel, de Laval. Quatrième match contre {autre}. J\'ai refait mon souper pour qu\'il se mange pendant la deuxième période.',
    m5: 'Bonsoir, c\'est Marcel. Cinquième match. J\'ai le coeur qui bat comme un tambour, et je suis assis, rassurez-vous.',
    m6: 'Allô, Marcel. Sixième match. Je suis dans la cour, parce que dans la maison c\'est trop tendu pour moi.',
    m7: 'Marcel, de Laval. Septième match contre {autre}. Je n\'ai pas dormi, et je ne crois pas que je dormirai avant la saison prochaine.',
    elimine: 'Bonsoir, c\'est Marcel. {eq} est éliminé. Je veux juste dire merci aux joueurs, merci à la direction, et merci à ma femme de ne rien dire.',
    coupe: 'Marcel, de Laval. {eq} a gagné la Coupe. Je ne peux pas parler. Je vais rappeler demain, quand je serai redevenu un homme.',
    surprend: 'Allô, c\'est Marcel. {eq} est {rang}, je le savais. Je ne l\'ai dit à personne, mais je le savais.',
    decoit: 'Bonsoir, Marcel. {eq} est {rang}. Ça me fait de la peine, mais je reste. On ne quitte pas une équipe pour un rang.',
    general: ['Marcel, de Laval, bonsoir. J\'appelle simplement pour dire que {eq}, c\'est mon équipe, et que je ne suis pas là pour me plaindre.',
      'Allô, c\'est Marcel. Je n\'ai rien de précis à dire, mais je tenais à le dire à l\'antenne.'],
  },
};

/** Les répliques à plat : { p, si, t }. */
export const REPLIQUES = Object.entries(R).flatMap(([p, tags]) => Object.entries(tags)
  .flatMap(([si, ts]) => [].concat(ts).map(t => ({ p, si, t }))));

/* ---------- les manchettes du bandeau défilant : { si, t }, une ligne ---------- */

const M = {
  victoires: ['{eq} : {n} victoires de suite, le calme est recommandé', '{n} victoires consécutives pour {eq}, sans autre précision',
    '{eq} aligne {n} gains et ne commente pas', 'Séquence de {n} victoires : {eq} garde le silence',
    '{eq} : {n} matchs gagnés de suite, les spécialistes réfléchissent', '{n} victoires de suite, {eq} demande qu\'on n\'y voie rien de spécial',
    'Les {n} victoires de {eq} font l\'objet d\'une analyse', '{eq} gagne encore : {n} de suite, le vestiaire dit « bien »'],
  defaites: ['{eq} : {n} défaites de suite, le panel se réunit', '{n} défaites consécutives pour {eq}, une réunion est prévue',
    '{eq} encaisse une {n}e défaite de suite sans élever la voix', 'Séquence de {n} défaites : {eq} promet de « se pencher dessus »',
    '{eq} : {n} matchs perdus de suite, l\'analyse commence demain', '{n} défaites de suite, {eq} évoque « des ajustements »',
    'Les {n} défaites de {eq} sont jugées « préoccupantes mais réelles »', '{eq} : {n} revers d\'affilée, le café est refroidi'],
  debut: ['Journée {jour} : la saison est commencée, confirme-t-on', 'Début de saison : {eq} en est à la journée {jour}, rien n\'est joué',
    '{eq} à la journée {jour} : il est trop tôt, mais on le dit quand même', 'Journée {jour} : les premières conclusions sont déjà prêtes',
    'Début de saison, journée {jour} : le calendrier suit son cours', 'La journée {jour} approche de ce qu\'on appelle un échantillon',
    '{eq} en début de saison : on attend d\'en savoir plus', 'Journée {jour} : le panel se garde d\'avoir raison trop vite'],
  milieu: ['Journée {jour} : la saison est à mi-chemin, nous dit-on', 'Mi-saison : {eq} à la journée {jour}, {rest} journées à jouer',
    'Journée {jour} : il ne reste que {rest} journées, mais elles sont nombreuses', '{eq} à mi-parcours, la patience est de mise',
    'Mi-saison : le panel annonce un « portrait provisoire »', 'Journée {jour} : le milieu de saison est atteint, sans incident',
    '{rest} journées à jouer pour {eq} : le calcul est confirmé', 'À mi-saison, {eq} est exactement là où elle est'],
  fin: ['Plus que {rest} journées : chaque pointage compte, dit-on', 'Fin de saison : {rest} journées, {eq} reste attentif',
    'Dernière ligne droite pour {eq} : {rest} journées', 'Il reste {rest} journées, et le panel s\'en inquiète sincèrement',
    'Fin de saison, journée {jour} : on retient son souffle, par politesse', '{rest} journées à jouer : {eq} fait ses calculs en silence',
    'La saison tire à sa fin : {rest} journées pour {eq}', 'Journée {jour} : le dernier tiers de la saison est ouvert'],
  'course-dedans': ['{eq} garde {pts} d\'avance sur la dernière place en séries', 'Course aux séries : {eq} en tête de peloton, {pts} d\'avance',
    '{eq} en séries pour l\'instant, avec {pts} de marge', 'Avance de {pts} pour {eq} : on parle de « coussin »',
    'Place en séries : {eq} y est, de {pts}', '{eq} maintient {pts} d\'avance et ne regarde pas derrière',
    'Course aux séries : {eq} garde sa place, {pts} d\'écart', 'Séries : {eq} conserve {pts} d\'avance, sans cérémonie'],
  'course-dehors': ['{eq} tire de l\'arrière de {pts} dans la course aux séries', 'Course aux séries : {eq} à {pts} d\'une place',
    '{eq} à {pts} d\'une place en séries : « rien n\'est perdu »', 'Retard de {pts} pour {eq} : le panel se montre prudent',
    'Séries : {eq} doit rattraper {pts}, ce qui est un chiffre', '{eq} garde espoir malgré {pts} de retard',
    'Course aux séries : {pts} séparent {eq} d\'une place', '{eq} à l\'extérieur de {pts} : l\'espoir est confirmé par le club'],
  echeance: ['La date limite des échanges approche, les téléphones sont chargés', 'Date limite des échanges : {eq} refuse de commenter',
    'À l\'approche de la date limite, {eq} dit « être à l\'écoute »', 'Date limite des échanges : plusieurs clubs « examinent des options »',
    'La date limite approche : les directeurs généraux dorment peu', 'Date limite des échanges : {eq} se dit « satisfait de son groupe »'],
  'echeance-passee': ['La date limite des échanges est passée, {eq} reste intact', 'Date limite passée : {eq} jouera avec ce qu\'il a',
    'Les échanges sont clos : {eq} garde son effectif et son opinion', 'Date limite écoulée : le panel s\'estime « informé »',
    'Date limite derrière nous : {eq} regarde vers l\'avant', 'Les échanges sont terminés, les explications commencent'],
  blesse: ['{eq} perd son meilleur joueur sur blessure', 'Meilleur joueur de {eq} blessé : le club « suit la situation »',
    'Le meilleur joueur de {eq} est blessé, le panel prend acte', '{eq} sans son meilleur joueur, blessé : les prières sont reçues',
    'Blessure : {eq} devra jouer sans sa meilleure pièce', '{eq} annonce une blessure : « on verra jour après jour »'],
  m1: ['Série : premier match, {eq} contre {autre}', '{eq} et {autre} ouvrent la série, zéro à zéro de tout',
    'Match 1 : {eq} contre {autre}, la série commence', 'Premier match de la série entre {eq} et {autre}'],
  m2: ['Série : deuxième match, {eq} contre {autre}', 'Match 2 : {eq} et {autre}, la série a un passé',
    '{eq} contre {autre} : deuxième match de la série', 'Match 2 entre {eq} et {autre}, rien n\'est tranché'],
  m3: ['Série : troisième match, {eq} contre {autre}', 'Match 3 : {eq} et {autre} entrent dans le sérieux',
    '{eq} contre {autre} : troisième match de la série', 'Match 3 entre {eq} et {autre}, le panel s\'assoit'],
  m4: ['Série : quatrième match, {eq} contre {autre}', 'Match 4 : {eq} et {autre}, les cafés sont froids',
    '{eq} contre {autre} : quatrième match de la série', 'Quatrième match entre {eq} et {autre}, on resserre'],
  m5: ['Série : cinquième match, {eq} contre {autre}', 'Match 5 : {eq} et {autre}, plus personne ne dit « tôt »',
    '{eq} contre {autre} : cinquième match de la série', 'Match 5 entre {eq} et {autre}, le studio est plein'],
  m6: ['Série : sixième match, {eq} contre {autre}', 'Match 6 : {eq} et {autre}, la fatigue est notée',
    '{eq} contre {autre} : sixième match de la série', 'Match 6 entre {eq} et {autre}, un septième est possible'],
  m7: ['Série : septième match, {eq} contre {autre}', 'Match 7 : {eq} et {autre}, pas de huitième',
    '{eq} contre {autre} : septième match, tout se joue', 'Septième match entre {eq} et {autre}, personne ne dort'],
  elimine: ['{eq} est éliminé des séries', 'Fin de parcours pour {eq} : la saison est terminée', '{eq} sort des séries, le club remercie ses partisans',
    'Élimination de {eq} : le panel observe un silence', '{eq} est éliminé, les résultats se poursuivent', 'La saison de {eq} est terminée, officiellement'],
  coupe: ['{eq} remporte la Coupe', 'Coupe : {eq} au sommet, le panel n\'avait rien prévu', '{eq} gagne la Coupe, la ville en prend note',
    'Victoire finale de {eq} : la Coupe change de mains', '{eq} champion : on cherche encore les mots', 'La Coupe revient à {eq}, confirme-t-on'],
  surprend: ['{eq} au {rang} rang, bien au-delà des attentes', '{eq} {rang} : le panel reconnaît s\'être trompé, avec réserve',
    'Surprise : {eq} est {rang}, personne ne l\'avait annoncé', '{eq} dépasse les attentes et se classe {rang}',
    'Le {rang} rang de {eq} étonne les spécialistes', '{eq} {rang} : « une surprise », convient-on, sans excuse'],
  decoit: ['{eq} au {rang} rang, en deçà des attentes', '{eq} {rang} : le club promet des « ajustements »',
    'Déception : {eq} est {rang}, loin de ce qui était annoncé', '{eq} sous les attentes, {rang} au classement',
    'Le {rang} rang de {eq} préoccupe les observateurs', '{eq} {rang} : « pas ce qu\'on voulait », dit-on'],
  general: ['{eq} : le panel poursuit son analyse', 'Le bandeau continue de défiler, rien n\'est à signaler',
    'Journée {jour} : les résultats suivent, et le panel aussi', '{eq} : « on y va un match à la fois », confirme le club',
    'Le panel rappelle que le hockey se joue sur la glace', 'Pas de nouvelles de {eq} : le club juge cela positif',
    'Les résultats complets suivent après cette manchette', '{eq} garde le cap, selon une source « bien placée »',
    'Rien à signaler au vestiaire de {eq}, nous dit-on', 'Le panel a faim, mais continuera de travailler'],
};

/** Les manchettes à plat : { si, t }, une ligne chacune. */
export const MANCHETTES = Object.entries(M).flatMap(([si, ts]) => ts.map(t => ({ si, t })));

/* ---------- les bulletins de série : { si, t } ---------- */

const B = {
  'b-m1': ['Bulletin de série : {lead} gagne le premier match, {pointage}. {tard} dispose de six matchs pour rectifier le tir.',
    'Premier match réglé : {lead} devant, {pointage}. La série compte encore, à notre connaissance, six matchs possibles.',
    'Bulletin : {lead} ouvre la série en gagnant, {pointage}. {tard} a pris note.',
    'Série {lead}–{tard} : {lead} prend les devants, {pointage}. Il reste beaucoup de hockey, et peu de précisions.',
    'Ouverture de série : {lead} l\'emporte, {pointage}. {tard} sera de retour pour le deuxième match.',
    'Bulletin de série : un à zéro pour {lead}. Tout, dit-on, peut encore arriver.'],
  'b-egal': ['Bulletin de série : {lead} et {tard} sont à égalité, {pointage}. Le sérieux de la situation est confirmé.',
    'Série égale entre {lead} et {tard}, {pointage}. Personne n\'a encore le dessus, ce qui est la définition d\'une égalité.',
    'Bulletin : {lead} et {tard} se tiennent, {pointage}. Les analystes réservent leur jugement.',
    'La série {lead}–{tard} est à égalité, {pointage}. Le prochain match départagera, jusqu\'au suivant.',
    '{lead} et {tard} ne se départagent pas : {pointage}. La nuit sera longue, et la suivante aussi.',
    'Égalité dans la série : {pointage} entre {lead} et {tard}. Le panel tient à dire que cela est exact.'],
  'b-ecart': ['Bulletin de série : {lead} mène {pointage} contre {tard}. L\'avance est réelle, sans être définitive.',
    '{lead} prend deux victoires d\'avance sur {tard} : {pointage}. Il reste à confirmer ce que cela signifie.',
    'Série {lead}–{tard} : {pointage} pour {lead}. {tard} a un chemin devant lui, et il est raide.',
    'Bulletin : {lead} garde l\'initiative, {pointage}. {tard} dit rester « concentré ».',
    '{lead} mène {pointage} sur {tard}. Un écart de deux victoires n\'est jamais un écart de trois, mais presque.',
    'Avance de {lead} sur {tard}, {pointage} : le calme règne du côté du meneur, la fermeté du côté de l\'autre.'],
  'b-menace': ['Bulletin de série : {lead} mène {pointage} et n\'est plus qu\'à une victoire d\'éliminer {tard}.',
    '{lead} est à un match de la ronde suivante : {pointage} contre {tard}. {tard} refuse de s\'avouer vaincu.',
    'Série {lead}–{tard} : {pointage}. Une seule victoire sépare {lead} de la ronde suivante.',
    'Bulletin : {tard} est dos au mur, {pointage}. Un seul match de plus et la série lui échappe.',
    '{lead} prend les devants {pointage} et n\'a besoin que d\'un match. {tard} a besoin de tous les autres.',
    'À un match de la fin : {lead} mène {tard} {pointage}. Le sort est connu, à une victoire près.'],
  'b-m7': ['Bulletin de série : {pointage} entre {lead} et {tard}. Un septième match décidera. Il n\'y en aura pas de huitième.',
    'La série {lead}–{tard} est à {pointage} : tout se jouera au septième match, comme le calendrier l\'avait prévu.',
    'Septième match à l\'horizon : {lead} et {tard} sont à égalité {pointage}. Les analystes ont cessé de dormir.',
    'Bulletin : {pointage}, {lead} contre {tard}. Un seul match reste, et un seul des deux en sortira.',
    '{lead} et {tard} iront au bout : {pointage} dans la série. Le septième match tranchera, rassurons-nous.',
    'Le septième match est confirmé entre {lead} et {tard}, {pointage}. Le studio a commandé des sandwiches.'],
  'b-balayage': ['Bulletin de série : {lead} balaie {tard}, {pointage}. La série n\'a jamais été vraiment en jeu.',
    '{lead} gagne quatre matchs de suite et élimine {tard}. Le panel fait état d\'un balayage, sans commentaire.',
    'Balayage : {lead} passe {tard}, {pointage}. Le plus court chemin entre deux rondes, confirmé.',
    'Série terminée : {lead} l\'emporte en quatre matchs contre {tard}. Aucune nuit blanche n\'est à déclarer.',
    '{tard} ne gagne aucun match : {lead} l\'emporte {pointage}. La ronde suivante s\'ouvre pour {lead}.',
    'Bulletin : {lead} a gagné la série {pointage} sans perdre. {tard} a joué, et c\'est tout ce qu\'on peut dire.'],
  'b-remontee': ['Bulletin de série : {lead} était mené 3-1 et l\'emporte {pointage} contre {tard}. Le panel n\'a pas de mot.',
    'Remontée complète : {lead} était derrière 3-1 et passe {tard}, {pointage}. Les chroniqueurs réviseront leurs notes.',
    '{lead} sort d\'un déficit de 3-1 pour éliminer {tard}, {pointage}. Il y a des soirs où le calcul cède.',
    'Série terminée : {lead} a gagné {pointage} après avoir été mené 3-1. {tard} est incapable de l\'expliquer.',
    'Bulletin : {tard} menait 3-1 et a perdu la série, {pointage} pour {lead}. Une enquête est réclamée par personne.',
    'Rareté du jour : {lead} élimine {tard} {pointage} après un retard de 3-1. Le momentum est invoqué par des spécialistes.'],
  'b-elim7': ['Bulletin de série : {lead} gagne le septième match et élimine {tard}, {pointage}. Il n\'y aura pas de huitième.',
    'Série réglée au septième : {lead} passe {tard}, {pointage}. Les téléspectateurs peuvent se détendre, par ordre.',
    'Septième match : {lead} l\'emporte et élimine {tard}. La série se termine {pointage}, sans appel.',
    'Bulletin : {lead} survit à un septième match contre {tard}, {pointage}. Il s\'agit d\'un résultat définitif.',
    '{tard} perd le septième match et la série, {pointage} pour {lead}. Le calendrier continue sans lui.',
    'Le septième match donne la série à {lead}, {pointage} contre {tard}. Le panel a besoin de s\'asseoir.'],
  'b-fini': ['Bulletin de série : {lead} élimine {tard}, {pointage}. La série est terminée, les comptes sont faits.',
    '{lead} passe à la ronde suivante en battant {tard}, {pointage}. Le panel confirme.',
    'Série terminée : {lead} gagne {pointage} contre {tard}. {tard} remercie ses partisans, brièvement.',
    'Bulletin : {tard} est éliminé par {lead}, {pointage}. Il n\'y aura pas d\'autre match.',
    '{lead} vient à bout de {tard}, {pointage}. La suite appartient à ceux qui restent.',
    'La série est réglée : {pointage} pour {lead}. {tard} laisse la place, sans cérémonie excessive.'],
  'b-prolo': ['Bulletin de série : le dernier match s\'est réglé en prolongation. {lead} et {tard} en sont à {pointage}. Le panel est essoufflé.',
    'Le dernier match a nécessité une prolongation : la série {lead}–{tard} est à {pointage}. Les téléspectateurs sont encore là.',
    'Bulletin : un match décidé en prolongation. {lead} et {tard}, {pointage}. Les nerfs sont mis à l\'épreuve.',
    'Le dernier match est allé en prolongation. La série est à {pointage} entre {lead} et {tard}. Rien d\'autre n\'est à signaler.',
    'Série {lead}–{tard}, {pointage} : le plus récent match a nécessité du temps supplémentaire. Le panel a demandé un verre d\'eau.',
    'Prolongation dans la série : {pointage} entre {lead} et {tard}, et un studio qui a perdu la notion de l\'heure.'],
};

/** Les bulletins à plat : { si, t }. */
export const BULLETINS = Object.entries(B).flatMap(([si, ts]) => ts.map(t => ({ si, t })));

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
