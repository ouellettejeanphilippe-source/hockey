/*
 * LA VIE D'UN DG-COACH, EN MESSAGES. Trois banques, un ton : celui d'un vrai
 * communiqué, appliqué à des riens de hockey. L'humour vient du sérieux, jamais
 * d'un clin d'œil. Personne n'est réel : les expéditeurs, le chroniqueur et le
 * maire sont inventés, et les équipes se disent par variable ({eq}, {autre}).
 *
 *   COURRIELS  la boîte de réception (js/saison.js, `messagesCourants`) : des
 *              messages qui ne bloquent rien, étiquetés par MOMENT de la saison
 *              et, au besoin, par ÉTAT de l'équipe. Un courriel d'état (en
 *              séquence, en panne…) ne se dit que quand l'état est vrai.
 *              Chacun (et chaque échange) offre des RÉPONSES qui jouent sur le
 *              match, payées d'un prix : `REPONSES_VIE`, plus bas.
 *   DILEMMES   des choix forcés dans le MÊME format que `MOMENTS` (js/sim.js) :
 *              une option porte ses canaux (finition, volume, defense,
 *              discipline, blessure, energie, F, D), sa durée en matchs, ou un
 *              `pari`, un `ensuite`, une `action` — rien de neuf, et dans les
 *              amplitudes des dilemmes voisins. Chacun naît d'un fait vrai
 *              (`fait`), nomme ses joueurs, et son texte dit ce que l'effet fait.
 *   ECHANGES   le point de presse d'après-match : la question d'un journaliste,
 *              et les réponses de l'entraîneur à CETTE question.
 *
 * Tout est PUR : le même contexte et la même graine redonnent le même tirage
 * (comme js/recit.js), sans `hasard()` — le moteur ne consomme pas un dé de plus.
 *
 * contexte : { moment, etat: [], eq, autre, deja: [] }
 *   moment  camp · octobre · decembre · echeance · mars · series · elimination · coupe
 *   etat    sequence (victoires de suite) · panne (défaites de suite)
 *           · plafond (la marge est mince) · blesses (l'infirmerie est pleine)
 */

import { nomCourt, deNom } from './recit.js';

/** Hachage stable d'une chaîne (le même que js/recit.js), pour tirer sans hasard vivant. */
function graine(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const MOMENTS_DE_SAISON = ['camp', 'octobre', 'decembre', 'echeance', 'mars', 'series', 'elimination', 'coupe'];

/**
 * QUI ÉCRIT : l'icône et le nom que la boîte affiche (`m.de`). Une seule distribution pour toute la boîte
 * (V3, JP : *les messages sont des trucs du proprio, coach, joueurs, partisans, analystes*) : les courriels,
 * les choix forcés (js/saison.js) et les fils de la saison (`messageDuFil`) parlent par ces voix-là.
 */
export const EXPEDITEURS = {
  pr: { ico: '🏢', nom: 'Le proprio' },
  en: { ico: '🧑‍🏫', nom: 'L\'entraîneur' },
  an: { ico: '📺', nom: 'L\'analyste à la télé' },
  pt: { ico: '📣', nom: 'Les partisans' },
  ca: { ico: '🎖', nom: 'Le capitaine' },
  fi: { ico: '🧾', nom: 'Le directeur des finances' },
  ad: { ico: '🎯', nom: 'Ton adjoint' },
  ag: { ico: '🤝', nom: 'Un agent de joueur' },
  ph: { ico: '🩺', nom: 'Le physio' },
  eq: { ico: '🧦', nom: 'Le préposé à l\'équipement' },
  co: { ico: '📢', nom: 'Le service des communications' },
  li: { ico: '🪪', nom: 'La ligue' },
  pa: { ico: '🧣', nom: 'Un partisan fidèle' },
  ma: { ico: '🗳', nom: 'Le maire' },
  // Les voix d'À faire (Jalon M) : elles vivaient à part dans js/saison.js (`DE`) ; une seule distribution.
  me: { ico: '🩺', nom: 'Le médecin' },
  dg: { ico: '📋', nom: 'Le DG' },
  dp: { ico: '🔎', nom: 'Le dépisteur' },
};

const TOUS = MOMENTS_DE_SAISON.join(' ');
const mots = s => (s === 'tous' ? TOUS : s).split(' ').filter(Boolean);

/** Remplit les gabarits {eq} et {autre} ; un gabarit sans valeur reste vide. */
function remplir(texte, c = {}) {
  return String(texte).replace(/\{(\w+)\}/g, (_, k) => (c[k] != null ? c[k] : ''));
}


/* ======================================================================
   LES COURRIELS
   [expéditeur, moments, états, objet, corps]
   ====================================================================== */
const COURRIELS_BRUTS = [
  // ---- Le propriétaire (il vouvoie) ----
  ['pr', 'camp', '', 'Ce que j\'attends de la saison',
    'J\'ai signé les chèques cet été sans discuter. En retour, je veux voir {eq} jouer des matchs qui comptent au printemps. Comment, ce n\'est pas mon affaire : c\'est pour ça que je vous paie.'],
  ['pr', 'camp', '', 'Ma loge',
    'On a refait ma loge pendant l\'été et la vue sur la glace n\'a jamais été aussi belle. Je compte m\'en servir jusqu\'en juin. Organisez-vous pour qu\'il y ait quelque chose à regarder.'],
  ['pr', 'camp', '', 'La banderole',
    'Les communications ont fait imprimer trois mots au-dessus de la porte du vestiaire : rigueur, audace, prudence. On m\'a fait remarquer que le troisième annule le deuxième. Choisissez celui que vos joueurs liront en sortant.'],
  ['pr', 'octobre', '', 'Mes premières impressions',
    'J\'ai regardé les premiers matchs depuis ma loge, un crayon à la main. Je ne suis pas un homme de hockey, mais je reconnais une équipe qui sait où elle s\'en va. Montrez-moi que c\'est la nôtre.'],
  ['pr', 'octobre decembre', '', 'Le café de la galerie de presse',
    'Les journalistes se plaignent du café de la galerie de presse. Un chroniqueur mal servi écrit des chroniques amères ; je l\'ai appris à mes dépens. J\'ai fait changer la machine. Le reste vous regarde.'],
  ['pr', 'decembre', '', 'À mi-chemin',
    'On arrive à la moitié du calendrier et mes partenaires me posent tous la même question : est-ce que ça vaut la peine de renouveler leur loge ? Je leur ai répondu oui. Faites en sorte que je n\'aie pas menti.'],
  ['pr', 'decembre', '', 'La carte des Fêtes',
    'La carte des Fêtes est partie chez tous nos commanditaires. L\'imprimeur a placé votre photo au-dessus du mot « mascotte ». Corriger ferait plus de bruit que l\'erreur ; j\'ai laissé aller.'],
  ['pr', 'echeance', '', 'La date limite',
    'La date limite approche et je n\'ai rien reçu de vous. Je comprends qu\'on ne négocie pas sur la place publique. J\'aimerais seulement apprendre la nouvelle de votre bouche plutôt qu\'à la radio.'],
  ['pr', 'mars', '', 'Le dernier droit',
    'C\'est en mars qu\'on voit qui a de la colonne. Mes partenaires consultent le classement plus souvent que leurs propres ventes. Je ne veux pas d\'un printemps tranquille.'],
  ['pr', 'series', '', 'Mes habitudes de séries',
    'En séries, je ne regarde plus les matchs : je les écoute à la radio, dans mon garage. Ça a marché une fois, il y a longtemps, et je n\'ai jamais osé changer. Je fais ma part ; faites la vôtre.'],
  ['pr', 'elimination', '', 'Mot du propriétaire',
    'C\'est fini plus tôt que je l\'espérais. Je ne ferai pas de déclaration à chaud : ce n\'est jamais là qu\'on dit les choses justes. Passez à mon bureau la semaine prochaine, on aura une vraie conversation.'],
  ['pr', 'coupe', '', 'Merci',
    'La Coupe a passé la nuit dans mon salon, à la place d\'une plante que j\'avais depuis mon mariage. La plante est sur le balcon. Je ne regrette rien. Merci.'],
  ['pr', 'decembre echeance mars', 'sequence', 'La séquence',
    'Trois personnes m\'ont parlé de la séquence aujourd\'hui, dont le concierge. Je ne change rien à mes habitudes et je vous demande d\'en faire autant. Je ne descends pas au vestiaire tant que ça dure.'],
  ['pr', 'octobre decembre echeance mars', 'panne', 'Ma sœur a appelé',
    'Ma sœur m\'a appelé après la dernière défaite pour savoir si le club était entre bonnes mains. Je lui ai répondu que oui. Je n\'aime pas avoir tort devant ma sœur.'],
  ['pr', 'octobre decembre echeance mars', 'plafond', 'La marge salariale',
    'On m\'informe que la marge sous le plafond est mince. Je ne demande pas de miracle. Je demande qu\'on ne me fasse pas signer un contrat que la ligue refusera.'],
  ['pr', 'octobre decembre echeance mars', 'blesses', 'L\'infirmerie',
    'On me dit que l\'infirmerie ne désemplit pas. J\'y ai fait livrer une plante ; ma femme jure que ça aide à guérir. Pour le reste, je fais confiance au physio, et à vous.'],

  // ---- Le directeur des finances (il vouvoie) ----
  ['fi', 'camp', '', 'Le budget de la saison',
    'Le budget de la saison est déposé. Les postes « déplacements » et « rondelles » montent plus vite que les revenus, ce qui n\'est jamais bon signe en septembre. J\'aimerais vos commentaires avant que la tendance devienne une habitude.'],
  ['fi', 'camp octobre', '', 'L\'inventaire des rondelles',
    'L\'inventaire d\'avant-saison ne balance pas : il nous manque des rondelles. Je sais qu\'une rondelle finit souvent dans les gradins. J\'aimerais tout de même savoir lesquelles, et dans quels gradins.'],
  ['fi', 'octobre', '', 'Une facture de pizzas',
    'Le personnel d\'entraîneurs m\'a remis une facture de pizzas intitulée « motivation ». Je n\'ai aucun poste budgétaire à ce nom. Dites-moi qui a été motivé, et si ça a fonctionné.'],
  ['fi', 'decembre', '', 'Prévisions de fin d\'exercice',
    'Mes prévisions tiennent en une phrase : si on fait les séries, l\'exercice finit dans le noir ; sinon, dans le rouge. J\'ai joint trois scénarios, mais c\'est la phrase qui compte.'],
  ['fi', 'decembre', '', 'La facture de la glace',
    'La facture d\'entretien de la glace contient une ligne « lissage supplémentaire » que personne ne se souvient d\'avoir commandée. Le responsable me répond que la glace est lisse. Je garde le dossier ouvert.'],
  ['fi', 'echeance', '', 'Avant tout échange',
    'Toute transaction de dernière minute devra m\'arriver avec une note d\'une page et un tableau. Le tableau peut être simple, mais il doit exister. Je reste à mon bureau jusqu\'à la fermeture du marché.'],
  ['fi', 'echeance mars', 'plafond', 'La marge, encore',
    'J\'ai calculé la marge sous le plafond deux fois, pour être certain. Elle est mince. Pas un contrat de plus sans qu\'un autre parte, de valeur égale ou plus grande.'],
  ['fi', 'octobre decembre', 'plafond', 'Rappel de prudence',
    'La ligue me rappelle chaque trimestre que le plafond est une limite, pas une cible. Notre marge ne laisse aucune place à l\'improvisation. Si vous avez une idée, mettez-la par écrit avant de la mettre sous contrat.'],
  ['fi', 'mars', '', 'Le diffuseur',
    'Le diffuseur veut renégocier nos droits. Il ne dit pas encore dans quel sens, ce qui m\'inquiète un peu. Je vous reviens dès que j\'aurai lu le contrat jusqu\'à la dernière page.'],
  ['fi', 'series', '', 'Les revenus de séries',
    'Chaque match de séries à domicile rapporte ; je le note sans m\'emballer. J\'ai aussi prévu un budget de nettoyage pour les serviettes, les confettis et tout ce que les partisans lancent sur la glace quand ils sont contents.'],
  ['fi', 'elimination', '', 'Le bilan financier',
    'Le bilan de la saison est presque fermé. Les revenus de séries sont sous ce que j\'espérais, mais au-dessus de ce que je craignais. Dans mon métier, on appelle ça une année ordinaire.'],
  ['fi', 'coupe', '', 'Le coût d\'une Coupe',
    'Une Coupe, ça coûte : un défilé, des bagues, une réception, des chandails commémoratifs. J\'ai ouvert une ligne « célébration » avec un montant raisonnable. Elle sera dépassée, et je l\'ai déjà accepté.'],
  ['fi', 'decembre echeance mars', 'blesses', 'Les primes d\'assurance',
    'L\'assureur suit notre infirmerie de près et qualifie notre dossier de « sensible ». Je lui ai demandé ce que ce mot voulait dire en dollars. J\'attends sa réponse, sans impatience.'],

  // ---- L'adjoint (il tutoie) ----
  ['ad', 'camp', '', 'Le plan de match',
    'J\'ai mis le plan de la saison sur une feuille recto verso. Le recto, c\'est la structure ; le verso, surtout un dessin de patinoire avec des flèches. Dis-moi quand tu veux qu\'on le passe ensemble.'],
  ['ad', 'camp octobre', '', 'Les trios',
    'J\'ai passé la nuit à brasser les trios sur le tableau magnétique. J\'ai une combinaison qui me plaît à deux heures du matin ; reste à voir si elle me plaira à midi. On s\'en parle avant la pratique.'],
  ['ad', 'octobre', '', 'Notre avantage numérique',
    'J\'ai revu nos avantages numériques. Je trouve qu\'on fait le tour de la zone plus souvent qu\'on va au filet. Je veux un gars dans l\'enclave et un tir de la pointe ; le reste suivra.'],
  ['ad', 'octobre decembre', '', 'La vidéo de mardi',
    'J\'ai monté une séance sur notre échec-avant. À la fin, on voit le concierge traverser le local avec sa vadrouille ; je l\'ai laissé, les gars vont aimer. Le reste est sérieux, promis.'],
  ['ad', 'decembre', '', 'Le point à mi-saison',
    'J\'ai fait le bilan de la première moitié, match par match. Deux colonnes : ce qu\'on garde, ce qu\'on corrige. Les deux sont pleines, ce qui veut dire qu\'on a du travail et de quoi travailler.'],
  ['ad', 'echeance', '', 'Ce qui nous manque',
    'J\'ai dressé la liste de nos besoins avant la date limite : un défenseur qui joue dur, un attaquant qui gagne ses mises en jeu, et quelques heures de sommeil. Je sais que la dernière ne s\'échange pas.'],
  ['ad', 'mars', '', 'Le temps de glace',
    'À ce temps-ci de l\'année, je surveille les minutes de nos premiers trios à la seconde près. J\'ai un tableau en trois couleurs : vert, ça va ; jaune, on surveille ; rouge, je viens te voir. Si je cogne à ta porte, tu sauras pourquoi.'],
  ['ad', 'series', '', 'L\'adversaire',
    'J\'ai regardé l\'adversaire sous tous les angles. Ce que je vois : une équipe patiente, qui bloque des tirs et attend nos erreurs. Je propose qu\'on ne lui en donne pas.'],
  ['ad', 'elimination', '', 'Ce qui n\'a pas marché',
    'J\'ai écrit une quarantaine de pages sur ce qui n\'a pas fonctionné. J\'en ai gardé deux. Elles sont sur ton bureau, pour le jour où tu auras le cœur de les lire.'],
  ['ad', 'coupe', '', 'Le verso',
    'Je t\'écris tout bas, la maison dort encore. Le dessin du verso, celui avec les flèches, je pense qu\'il a fini par servir. Je n\'avais jamais osé y croire.'],
  ['ad', 'octobre decembre echeance mars series', 'sequence', 'Ne touche à rien',
    'On gagne, et je ne suis pas certain de savoir pourquoi. Alors on ne change rien, pas même l\'ordre dans lequel on entre au vestiaire. J\'ai déjà averti le préposé à l\'équipement.'],
  ['ad', 'octobre decembre echeance mars series', 'panne', 'La glissade',
    'J\'ai revu les dernières défaites en boucle. J\'ai trois explications, et deux se contredisent. Je garde la troisième et je continue de chercher ; la salle vidéo est réservée pour la soirée.'],
  ['ad', 'octobre decembre echeance mars series', 'blesses', 'Avec ce qui reste',
    'La liste des blessés se lit maintenant à voix haute, et ça prend du temps. J\'ai monté des trios avec ce qui reste. Ils tiennent debout, à des conditions que je préfère t\'expliquer en personne.'],

  ['ad', 'octobre decembre echeance mars', 'plafond', 'Un défenseur de plus ?',
    'Je sais que la marge est mince, mais il nous manque un défenseur. J\'ai fait le calcul sur une serviette de table, puis avec le directeur des finances, qui m\'a regardé longtemps sans rien dire. Je te laisse trancher.'],
  ['eq', 'octobre decembre echeance mars', 'plafond', 'Le ruban adhésif',
    'On m\'a demandé de couper dans mes dépenses. Les bâtons durent plus longtemps et le ruban adhésif fait le reste. Ne regarde pas le talon des patins, c\'est tout ce que je te demande.'],
  ['co', 'decembre echeance mars', 'plafond', 'La masse salariale',
    'Les journalistes nous questionnent sur la marge de {eq} sous le plafond. Notre réponse : elle est « adéquate ». Nous vous prions de ne pas préciser davantage.'],

  // ---- Un agent de joueur (il vouvoie) ----
  ['ag', 'camp', '', 'Mon client',
    'Mon client tient à vous rappeler qu\'il s\'est présenté au camp dans la meilleure forme de sa carrière. Il a renoncé aux chaussons aux pommes dès juillet, ce qu\'il considère comme un sacrifice. Une photo suit, qu\'il juge éloquente.'],
  ['ag', 'octobre', '', 'Le temps de glace de mon client',
    'Mon client trouve que son temps de glace ne reflète pas ce qu\'il apporte à l\'équipe. Il m\'a demandé de vous le dire poliment ; je vous le dis poliment. Il espère une réponse dans le même esprit, et sur la glace.'],
  ['ag', 'octobre decembre', '', 'Son côté fort',
    'Mon client aimerait jouer sur son côté fort. Il ne m\'a jamais précisé lequel, mais il tient beaucoup au principe. Je vous suggère de lui poser la question vous-même, avec tact.'],
  ['ag', 'decembre', '', 'Une prolongation',
    'Mon client serait ouvert à une prolongation de contrat, à des conditions qui lui conviennent. Il aime la ville, ses restaurants et une place de stationnement en particulier. Je vous transmets le tout sans rien retrancher.'],
  ['ag', 'decembre', '', 'Son casier',
    'Mon client estime que l\'emplacement de son casier ne reflète pas son rang dans le vestiaire. Il le voudrait plus près de la porte, ou plus loin, selon les jours. Je vous demande d\'y penser avant le prochain voyage.'],
  ['ag', 'echeance', '', 'Les rumeurs',
    'Mon client a lu son nom dans une rumeur d\'échange et il aimerait savoir à quoi s\'en tenir. Il n\'exige aucune destination, sauf une ville avec une bonne boulangerie. Je vous remercie d\'avance de votre franchise.'],
  ['ag', 'echeance mars', 'plafond', 'Sa valeur',
    'Votre marge est mince, je le comprends, mais ça ne change rien à la valeur de mon client. Il suggère de faire de la place en déplaçant un autre contrat, de préférence celui d\'un joueur que je ne représente pas.'],
  ['ag', 'mars', '', 'Sa fin de saison',
    'Mon client affirme qu\'il atteint son sommet en fin de saison. Il le dit chaque printemps depuis le début de sa carrière. Je vous laisse en tirer vos propres conclusions.'],
  ['ag', 'series', '', 'En séries',
    'Mon client vit pour cette période de l\'année. Il m\'a demandé de ne pas le déranger pendant les séries, moi compris. Je vous écris donc maintenant, pendant qu\'il est encore permis de le faire.'],
  ['ag', 'elimination', '', 'Le bilan de mon client',
    'Mon client part en vacances avec le sentiment du devoir accompli, un sentiment qu\'il est à peu près seul à éprouver. Il souhaite une rencontre pour faire le point. Il propose un restaurant où il a ses habitudes.'],
  ['ag', 'coupe', '', 'Mon client et la Coupe',
    'Mon client a passé la nuit avec la Coupe et voudrait que ce soit noté à son dossier. Il me prie aussi de vous dire qu\'elle n\'a rien, ou presque. Il est disponible pour discuter de sa nouvelle valeur.'],
  ['ag', 'decembre echeance mars series', 'sequence', 'La part de mon client',
    'Les victoires s\'empilent, et mon client voudrait qu\'on reconnaisse sa part dans la séquence. Il l\'a évaluée, mais il garde son estimation pour la table de négociation. Je vous propose d\'en parler avant qu\'il la sorte.'],
  ['ag', 'octobre decembre echeance mars', 'panne', 'Mon client s\'inquiète',
    'Mon client s\'inquiète de la séquence et tient à ce que vous sachiez qu\'il n\'y est pour rien. Il offre néanmoins son aide, sans préciser laquelle. Il compte sur votre confiance.'],

  // ---- Le physio (il tutoie) ----
  ['ph', 'camp', '', 'Les tests d\'avant-saison',
    'Les évaluations d\'avant-saison sont faites. La plupart des gars sont arrivés en forme ; les autres se reconnaîtront dans mon rapport. Il me faudrait un plus grand local pour les étirements : à vingt-trois sur des tapis, on se donne des coups de pied.'],
  ['ph', 'camp octobre', '', 'Le protocole d\'étirements',
    'J\'ai rédigé un nouveau protocole d\'étirements en neuf points. Les vétérans en font trois, les recrues les font tous, et tout le monde se plaint du septième. Ton appui m\'aiderait.'],
  ['ph', 'octobre', '', 'L\'hydratation',
    'Les gars boivent, mais pas au bon moment : rien pendant la période, une bouteille complète à l\'entracte. J\'affiche un horaire au vestiaire. Fais-le respecter sans le lire à voix haute, ils détestent ça.'],
  ['ph', 'decembre', '', 'La saison des rhumes',
    'Décembre, c\'est le mois où tout se transmet dans un vestiaire : les rhumes, les superstitions et les chansons de l\'autobus. Je m\'occupe du premier. Pour les deux autres, je compte sur toi.'],
  ['ph', 'decembre echeance', '', 'Les jambes',
    'Les jambes de l\'équipe dépendent maintenant des voyages, des sièges d\'avion et des nuits à l\'hôtel. J\'ai fait un schéma. Il explique à peu près tout, sauf pourquoi les gars dorment mieux dans l\'autobus que dans un lit.'],
  ['ph', 'echeance', '', 'Les appels des autres clubs',
    'Pendant les discussions d\'échange, les autres clubs m\'appellent pour connaître l\'état de nos joueurs. Je m\'en tiens aux faits, avec le moins d\'adjectifs possible. Tu peux compter sur ma discrétion.'],
  ['ph', 'mars', '', 'La fatigue de mars',
    'La fatigue de fin de saison, c\'est comme la neige sur un stationnement : on ne la voit pas tomber, puis on ne peut plus sortir. J\'ai préparé un plan de récupération. Il contient du repos, ce qui n\'a rien de secret, mais on s\'en sert trop peu.'],
  ['ph', 'series', '', 'Les petits bobos',
    'En séries, les gars jouent avec ce qu\'ils appellent des « petits bobos ». Moi, je les classe en trois catégories, et la troisième n\'a rien de petit. Ne me demande pas qui est dans laquelle : je ne le dirai pas, même à toi.'],
  ['ph', 'elimination', '', 'Les examens de fin de saison',
    'Les examens de fin de saison commencent lundi. Rappelle aux gars que l\'été n\'est pas une excuse pour ne pas se présenter. Ceux qui ont mal depuis octobre vont enfin me le dire, j\'imagine.'],
  ['ph', 'coupe', '', 'Après la Coupe',
    'Tout le monde a soulevé la Coupe, certains plusieurs fois au-dessus de leur tête. J\'ai ajouté une section « épaules » à mon bilan. Je recommande une semaine de repos complet ; ils la trouveront trop longue.'],
  ['ph', 'octobre decembre echeance mars series', 'blesses', 'L\'infirmerie',
    'L\'infirmerie est pleine. J\'ai remplacé la deuxième table de traitement par une chaise, et personne ne s\'est plaint. Je te tiens au courant des retours, un par un.'],
  ['ph', 'octobre decembre echeance mars series', 'blesses', 'Les retours au jeu',
    'Un joueur blessé qui se dit prêt ne l\'est pas toujours. Je les évalue un à un : un test de sauts, un test de patin, et je les regarde dans les yeux. Merci de patienter.'],
  ['ph', 'decembre echeance mars series', 'sequence', 'La séquence et les corps',
    'La séquence fait plaisir à tout le monde, sauf peut-être à mon horaire. Quand on gagne, les gars jouent plus dur, et les corps finissent par le payer. Je les surveille, content, mais pas trop.'],

  // ---- Le préposé à l'équipement (il tutoie) ----
  ['eq', 'camp', '', 'Les bâtons',
    'La commande de bâtons est arrivée, avec trois courbes que personne n\'a commandées. J\'ai laissé les boîtes devant mon local ; ceux qui s\'y reconnaissent viendront. Passe me voir quand tu peux.'],
  ['eq', 'camp octobre', '', 'Les chandails neufs',
    'Les chandails de la saison sont livrés, dans un tissu plus léger que le fabricant appelle une « innovation ». Moi, ce que je remarque, c\'est qu\'ils sèchent plus vite. C\'est déjà ça.'],
  ['eq', 'octobre', '', 'Les lacets',
    'Je passe des lacets comme jamais depuis le début du mois. Je n\'accuse personne, mais un lacet ne se coupe pas tout seul. J\'en commande une caisse et j\'ouvre l\'œil.'],
  ['eq', 'octobre decembre', '', 'L\'aiguisage',
    'J\'ai aiguisé les patins de tout le monde, dans l\'ordre. Un gars m\'a dit qu\'il ne sentait aucune différence. Dans mon métier, c\'est un compliment.'],
  ['eq', 'decembre', '', 'La sécheuse',
    'La sécheuse du vestiaire a rendu l\'âme mardi matin, après onze saisons sans un jour de congé. J\'en ai commandé une neuve. Ce ne sera pas la même.'],
  ['eq', 'decembre echeance', '', 'Un gant perdu',
    'Un gant gauche manque depuis le dernier voyage. Je l\'ai cherché dans l\'autobus, dans l\'avion et à l\'hôtel. Celui qui le retrouve le dépose sur la table du fond, et on n\'en parle plus.'],
  ['eq', 'echeance', '', 'Un numéro pour le nouveau',
    'Si un joueur arrive avant la date limite, il va falloir lui trouver un numéro. Les beaux sont pris et deux sont retirés. Je vais lui proposer ce qui reste, et il va faire semblant d\'aimer ça.'],
  ['eq', 'mars', '', 'Le matériel',
    'En mars, le matériel a l\'air de ce qu\'il est : il a joué tout l\'hiver. Je répare ce que je peux au ruban adhésif. Il me reste deux rouleaux ; je les garde pour les séries.'],
  ['eq', 'series', '', 'Les superstitions',
    'J\'ai fait l\'inventaire des superstitions du vestiaire pour les séries. Il y en a une quinzaine, et quelques-unes se contredisent. Je les respecte toutes, par ordre d\'arrivée.'],
  ['eq', 'elimination', '', 'Le ménage',
    'J\'ai commencé à vider les casiers. Derrière l\'un d\'eux, un sandwich qui date d\'avant Noël ; je ne dirai pas à qui il appartenait. Tout sera rangé d\'ici vendredi.'],
  ['eq', 'coupe', '', 'La Coupe dans mon local',
    'La Coupe est passée par mon local, et je l\'ai polie moi-même, la porte fermée. Je n\'ai jamais été aussi calme de ma vie. Ne me demande rien aujourd\'hui.'],
  ['eq', 'decembre echeance mars series', 'sequence', 'On ne lave pas',
    'Tout le monde le sait : on ne lave pas ce qu\'on porte pendant une séquence. J\'ai suspendu certains lavages, par prudence. Je te laisse l\'expliquer aux voisins de casier.'],
  ['eq', 'octobre decembre echeance mars', 'panne', 'Les chandails de la malchance',
    'On m\'a demandé de sortir des chandails neufs pour « changer la chance ». C\'est fait. Les anciens sont pendus dans un coin, en observation.'],
  ['eq', 'octobre decembre echeance mars series', 'blesses', 'Les casiers vides',
    'Il y a tellement de casiers vides que le vestiaire fait de l\'écho. J\'ai gardé l\'équipement de chaque blessé propre, son nom bien en vue. J\'ai hâte de les voir revenir.'],

  // ---- Le service des communications (il vouvoie) ----
  ['co', 'camp', '', 'La ligne de la saison',
    'Le service des communications a arrêté la ligne de la saison : sobriété, clarté, enthousiasme contenu. Nous demandons à toute l\'équipe de s\'y tenir, au micro comme sur la glace. Un aide-mémoire suit.'],
  ['co', 'camp octobre', '', 'Les réponses types',
    'Vous trouverez ci-joint une douzaine de réponses types pour les entrevues : « un match à la fois », « on y va avec ce qu\'on a », et les autres. Nous recommandons de ne pas en enchaîner deux dans la même phrase.'],
  ['co', 'octobre', '', 'La photo d\'équipe',
    'La photo d\'équipe se prendra sur la glace, à neuf heures. Demandez aux joueurs de sourire, sans excès : la photo servira jusqu\'en avril, quoi qu\'il arrive.'],
  ['co', 'octobre decembre', '', 'L\'infolettre',
    'L\'infolettre des partisans est partie à des dizaines de milliers d\'abonnés. Trois ont répondu, tous polis. Nous parlons d\'un succès d\'estime.'],
  ['co', 'decembre', '', 'La vidéo des Fêtes',
    'La vidéo des Fêtes montrera l\'équipe autour d\'un sapin décoré par nos soins. Le sapin ne survivra pas à une deuxième prise. Merci de le rappeler au vestiaire avant le tournage.'],
  ['co', 'decembre echeance', '', 'La mascotte',
    'Pendant l\'entracte, la mascotte a mimé notre avantage numérique devant les caméras. Aucune plainte n\'a été reçue. Nous préférons tout de même encadrer la chose avant qu\'elle devienne un numéro régulier.'],
  ['co', 'echeance', '', 'Le jour de la date limite',
    'Le jour de la date limite, aucune déclaration avant la fermeture du marché. Après non plus, à moins qu\'elle ait été préparée avec nous. Nous restons disponibles pour toute reformulation.'],
  ['co', 'mars', '', 'La revue de presse',
    'On parle beaucoup de {eq} ces temps-ci, selon notre outil de veille, qui produit aussi des graphiques. Les graphiques suivront dans notre rapport. Ils sont en couleur, pour la plupart.'],
  ['co', 'series', '', 'Les points de presse',
    'En séries, les points de presse se tiennent à heure fixe, dans la salle prévue à cette fin. Les joueurs répondent brièvement et sans métaphore. Les métaphores font la plupart de nos manchettes.'],
  ['co', 'elimination', '', 'Le communiqué de fin de saison',
    'Le communiqué de fin de saison de {eq} partira demain matin. Il remercie les partisans, le personnel et la ville, dans cet ordre. Le propriétaire a fait retirer le mot « malheureusement ».'],
  ['co', 'coupe', '', 'Le plan de la victoire',
    'Notre plan de communication pour la Coupe compte neuf étapes. La quatrième, « savourer », est prévue pour demain matin. Nous vous prions de ne pas la devancer, tout en sachant que c\'est déjà fait.'],
  ['co', 'decembre echeance mars series', 'sequence', 'Gérer le succès',
    'La séquence de {eq} attire les caméras. Nous recommandons une attitude mesurée, ni triomphe ni fausse modestie. Souriez, mais pas comme une équipe qui a déjà gagné quelque chose.'],
  ['co', 'octobre decembre echeance mars series', 'panne', 'La période difficile',
    'La séquence de défaites de {eq} est suivie de près. Répondez aux questions, jamais aux conclusions. Nous offrons une formation de dix minutes sur la différence.'],

  // ---- La ligue (elle vouvoie, ton de circulaire) ----
  ['li', 'camp', '', 'Circulaire : le calendrier',
    'Le calendrier de la saison est publié. Il comprend tous les matchs prévus, à l\'exception de ceux qui seront reportés. La ligue remercie les équipes de leur collaboration habituelle.'],
  ['li', 'camp octobre', '', 'Rappel : la longueur des bâtons',
    'La ligue rappelle que la longueur maximale d\'un bâton est celle du règlement, qui n\'a pas changé depuis la dernière circulaire. Les officiels mesureront sur demande. Les équipes sont invitées à mesurer avant.'],
  ['li', 'octobre', '', 'Avis : la tenue d\'arrivée',
    'Les joueurs sont priés d\'arriver à l\'amphithéâtre en tenue de ville convenable. Les caméras du couloir filment chaque arrivée. La ligue compte sur le bon goût de chacun.'],
  ['li', 'octobre decembre', '', 'Précision sur l\'obstruction',
    'Plusieurs équipes ont demandé des précisions sur la règle de l\'obstruction. La ligue précise que la règle s\'applique telle qu\'elle est écrite. Un document explicatif suivra ; il sera plus long que la règle.'],
  ['li', 'decembre', '', 'La pause des Fêtes',
    'La pause des Fêtes aura lieu aux dates prévues au calendrier. Aucun entraînement n\'est permis pendant la pause. La ligue souhaite à tous de joyeuses Fêtes, dans le respect du règlement.'],
  ['li', 'decembre echeance', '', 'Un comité sur la vitesse du jeu',
    'Un comité étudiera la vitesse du jeu. Il se réunira à une date qui sera fixée ultérieurement. D\'ici là, les équipes sont invitées à jouer à la vitesse habituelle.'],
  ['li', 'echeance', '', 'Rappel : la date limite',
    'Toute transaction doit être enregistrée avant l\'heure limite, selon l\'horloge du siège social. Une transaction reçue après l\'heure sera réputée reçue après l\'heure. Aucune autre horloge ne fait foi.'],
  ['li', 'echeance mars', 'plafond', 'Le plafond salarial',
    'La ligue rappelle aux équipes dont la marge est mince que le plafond s\'applique à tous. Un formulaire de conformité doit accompagner toute transaction. Il compte quatre pages et exige la signature d\'un dirigeant.'],
  ['li', 'mars', '', 'Le calendrier du dernier droit',
    'Le calendrier des dernières semaines entre en vigueur. La ligue rappelle que les matchs de mars comptent au classement autant que ceux d\'octobre. Plusieurs équipes ont demandé cette précision.'],
  ['li', 'series', '', 'Avis aux équipes qualifiées',
    'Les équipes qualifiées doivent respecter l\'horaire des matchs, des entrevues et des déplacements. La lenteur des ascenseurs de certains amphithéâtres ne constitue pas une excuse recevable. La ligue souhaite de bonnes séries à tous.'],
  ['li', 'elimination', '', 'Le calendrier de l\'été',
    'La ligue rappelle que la saison est terminée pour les équipes éliminées. Le repêchage aura lieu comme prévu, et le marché des joueurs autonomes ouvrira à la date fixée. Merci de votre participation.'],
  ['li', 'coupe', '', 'La gravure de la Coupe',
    'La ligue procédera à la gravure des noms sur la Coupe, dans le délai que fixera l\'orfèvre. Une faute d\'orthographe, une fois gravée, est permanente. Merci de vérifier la liste trois fois, et de la faire relire par quelqu\'un d\'autre.'],
  ['li', 'octobre decembre echeance mars', 'blesses', 'Le protocole des blessures',
    'La ligue rappelle que la liste des blessés doit être transmise avant chaque match, dans le formulaire prévu. Le formulaire est joint. Il est volontairement court ; les explications devront l\'être aussi.'],

  // ---- Un partisan fidèle (il vouvoie, poli et un peu long) ----
  ['pa', 'camp', '', 'Vingt-deux ans au même siège',
    'Je suis abonné depuis vingt-deux ans, au même siège, derrière le même poteau. Ma confiance dans l\'équipe est entière. Je vous demanderais seulement, si c\'est possible, de déplacer le poteau.'],
  ['pa', 'camp octobre', '', 'Un gâteau pour les joueurs',
    'Ma femme a fait un gâteau pour les joueurs ; je le laisserai à l\'entrée des joueurs avant la pratique. Il est à la vanille, sans noix. Elle insiste pour que je précise qu\'il est aussi sans arrière-pensée.'],
  ['pa', 'octobre', '', 'Vu du haut des gradins',
    'Je regarde les matchs du haut des gradins, d\'où l\'on voit toute la patinoire sauf le coin gauche. Dans ce que je vois, j\'aime ce que l\'équipe essaie de faire. Pour le coin, je vous fais confiance.'],
  ['pa', 'octobre decembre', '', 'Une chanson',
    'Pourrait-on jouer une chanson plus entraînante pendant les arrêts de jeu ? J\'en ai une en tête dont j\'ignore le titre, mais je me souviens très bien de l\'air. Je peux vous la fredonner au téléphone.'],
  ['pa', 'decembre', '', 'Avec mon neveu',
    'J\'ai emmené mon neveu au dernier match. Il a six ans et l\'œil sûr : il a trouvé que l\'équipe travaillait fort et que la mascotte avait l\'air fatiguée. Je vous transmets les deux remarques.'],
  ['pa', 'echeance', '', 'Pas d\'échange, s\'il vous plaît',
    'À l\'approche de la date limite, je vous demande de ne pas faire d\'échange avant que j\'aie appris les noms. Je viens tout juste de retenir ceux de tous les défenseurs, et ma femme n\'en est pas encore là. Merci de votre compréhension.'],
  ['pa', 'mars', '', 'Je garde espoir',
    'Quoi qu\'il arrive d\'ici avril, je renouvelle mon abonnement. Le chèque est déjà encaissé, ce qui crée entre nous un lien que je qualifierais de durable. J\'aime croire qu\'il est réciproque.'],
  ['pa', 'series', '', 'Le foulard',
    'Ma femme porte le même foulard depuis le début des séries et ne le lavera pas avant la fin. Je vous le dis en toute confidence : je ne voudrais pas que les autres équipes l\'apprennent et s\'en procurent un.'],
  ['pa', 'elimination', '', 'Merci quand même',
    'Je vous écris pour vous remercier de la saison, qui a été belle jusqu\'au bout, même si le bout est arrivé trop tôt. Saluez de ma part les joueurs, le personnel et le gardien du stationnement. On se revoit en octobre.'],
  ['pa', 'coupe', '', 'Je n\'ai pas dormi',
    'Je n\'ai pas fermé l\'œil depuis le dernier match et je ne le regrette pas. J\'ai appelé mon frère en Gaspésie pour tout lui raconter, pendant quarante minutes. Il avait vu le match, mais il m\'a laissé finir.'],
  ['pa', 'octobre decembre echeance mars series', 'sequence', 'Je ne change rien',
    'Depuis le début de la séquence, je m\'assois au même siège, avec les mêmes gens, et je mange mon hot-dog au même moment. Ma femme a accepté de ne plus se lever pendant la deuxième période. Nous faisons notre part.'],
  ['pa', 'octobre decembre echeance mars', 'panne', 'Un mot d\'encouragement',
    'Je vous écris au lendemain de la dernière défaite. Je ne suis pas fâché. J\'ai regardé jusqu\'à la sirène, j\'ai applaudi, et je suis parti un peu plus vite que d\'habitude. Je crois encore en vous.'],

  // ---- Le maire (il vouvoie, protocolaire) ----
  ['ma', 'camp', '', 'Invitation : l\'ouverture de la saison',
    'J\'ai l\'honneur de vous inviter à la cérémonie d\'ouverture de la saison, où je prononcerai quelques mots qui restent à écrire. Votre présence au premier rang serait appréciée. Une place de stationnement vous est réservée, avec votre nom sur un carton.'],
  ['ma', 'octobre', '', 'Une rue à votre nom',
    'Le conseil a décidé de nommer une rue en l\'honneur de l\'équipe. C\'est une rue courte ; je l\'ai choisie moi-même. L\'inauguration prendra trois minutes, discours compris.'],
  ['ma', 'octobre decembre', '', 'Une affiche géante',
    'La Ville veut installer une affiche géante de l\'équipe à l\'entrée de la ville. Les dimensions restent à discuter, mais le principe fait l\'unanimité. Elle sera visible de l\'autoroute, ce qui en est tout l\'intérêt.'],
  ['ma', 'decembre', '', 'Les clés de la ville',
    'La Ville souhaite remettre une clé symbolique à votre capitaine lors d\'une courte cérémonie. La clé n\'ouvre aucune porte. Elle dit simplement la fierté des citoyens, dont plusieurs seront présents pour la photo.'],
  ['ma', 'decembre echeance', '', 'Le déneigement',
    'Le stationnement de l\'aréna sera déneigé en priorité les soirs de match. Je tiens à ce qu\'on y voie un appui à l\'équipe, et non un passe-droit. Les autres rues suivront, dans l\'ordre habituel.'],
  ['ma', 'echeance', '', 'Une rumeur',
    'Des citoyens m\'ont abordé à l\'épicerie au sujet d\'une rumeur d\'échange. Je leur ai répondu que je n\'en savais rien, ce qui était vrai. J\'aimerais tout de même l\'apprendre avant les journaux.'],
  ['ma', 'mars', '', 'Le pont aux couleurs du club',
    'La Ville illuminera le pont aux couleurs de l\'équipe jusqu\'à la fin de la saison, si les ampoules tiennent. Nous espérons que le geste sera reçu comme un encouragement. Il le sera : je l\'ai annoncé en conférence de presse.'],
  ['ma', 'series', '', 'Un règlement temporaire',
    'Le conseil a adopté un règlement temporaire qui tolère le bruit tard en soirée les soirs de match. Il sera levé à la fin des séries, ou plus tôt si les voisins s\'organisent. Je vous le transmets par courtoisie.'],
  ['ma', 'elimination', '', 'Les remerciements de la Ville',
    'Le conseil a adopté une résolution pour remercier l\'équipe d\'une saison écourtée, mais vécue avec dignité. Elle est passée à l\'unanimité moins une abstention : celle d\'un conseiller qui regardait les faits saillants sur son téléphone.'],
  ['ma', 'coupe', '', 'Le défilé',
    'La Ville organisera le défilé de la Coupe, de l\'hôtel de ville au dépanneur du coin, en passant par la boulangerie. J\'y prononcerai quelques mots. Ils seront courts : la foule sera là pour vous.'],
  ['ma', 'decembre echeance mars series', 'sequence', 'La séquence',
    'La Ville suit la séquence avec fierté. Un conseiller a proposé de proclamer une « semaine de la constance », et j\'ai dit oui. Elle aura lieu dès que le calendrier municipal le permettra, peut-être après la séquence.'],
  ['ma', 'octobre decembre echeance mars', 'blesses', 'Pour les blessés',
    'La Ville fera livrer à l\'aréna une corbeille de fruits pour les joueurs blessés, avec une carte signée par moi et deux conseillers. Nous leur souhaitons un prompt rétablissement. Les fruits sont de saison, dans la mesure du possible.'],
];

const parDe = {};
/** Les courriels : { id, de, quand: [moments], etat: [états] | [], sujet, corps }. */
const COURRIELS = COURRIELS_BRUTS.map(([de, quand, etat, sujet, corps]) => {
  parDe[de] = (parDe[de] || 0) + 1;
  return { id: `${de}${parDe[de]}`, de, quand: mots(quand), etat: etat ? etat.split(' ') : [], sujet, corps };
});

/* ======================================================================
   LES DILEMMES
   Même forme que `MOMENTS` (js/sim.js) : { ico, titre, fait, de, options }.
   `fait`, ce qui est vraiment arrivé et le rend vrai (`FAITS`, js/sim.js),
   lu sur tes matchs d'avant ; `quand`, les moments de la saison où il peut
   se dire, en plus du fait ; `de`, la voix qui le demande (`EXPEDITEURS`).
   Pas de récit : la scène dit le fait (js/scenes.js), et une option ne dit
   que son geste et ce que le moteur en fait (JP : *tous ces éléments
   doivent être liés à quelque chose qui arrive avant ou que ça cause dans la
   simulation*). Une option : [cle, nom, bon, prix, effet]. L'effet n'utilise
   que les canaux déjà lus par `effetDeMoment` : finition, volume, defense,
   discipline, blessure, energie (un chiffre sous 1 = moins d'usure des
   jambes), F et D (les minutes), `duree` en matchs, `pari`, `ensuite`,
   `action` ; ce qui vise le joueur nommé passe par ses canaux à lui
   (`lui`). Ses mots disent ces canaux, et eux seuls
   (`scripts/check_dilemmes.mjs`).
   ====================================================================== */
const o = (cle, nom, bon, prix, fx = {}) => ({ cle, nom, ...(bon ? { bon } : {}), ...(prix ? { prix } : {}), ...fx });

const DILEMMES_BRUTS = {
  echeance_depart: { ico: '👋', titre: 'Le départ', fait: 'parti', de: 'ca',
    options: [
      o('fete', 'Souligner son départ devant le groupe', 'Moins de punitions', null, { discipline: 0.84, duree: 5 }),
      o('silence', 'Tourner la page tout de suite', 'Moins de buts contre', 'Moins de précision', { defense: 0.94, finition: 0.94, duree: 5 }),
    ] },
  gardien_panne: { ico: '🥅', titre: 'Le gardien dans la glissade', fait: 'panneGardien', de: 'en',
    options: [
      o('soutenir', 'Garder {nom} devant le filet', 'Une chance sur deux : moins de buts contre', 'Sinon : plus de buts contre',
        { pari: { chance: 3 / 6, gagne: { defense: 0.898, duree: 5 }, perd: { defense: 1.103, duree: 5 } } }),
      o('repos', 'Trois matchs de repos : {aux} au filet', '{aux} prend le filet ; ensuite, moins de buts contre', 'Trois matchs sans {nom}', { action: { gardienAux: 3 }, ensuite: { apres: 3, duree: 8, defense: 0.92 } }),
    ] },
  dur_sermon: { ico: '🗨', titre: 'La mise au point', fait: 'punitions', de: 'li',
    options: [
      o('galerie', 'Un match à la galerie de presse pour {nom}', 'Moins de punitions', '{nom} manque un match', { action: { absents: 1 }, discipline: 0.825, duree: 6 }),
      o('confiance', 'Le laisser jouer à sa façon', '{nom} : plus de précision', 'Plus de punitions', { discipline: 1.19, duree: 5, lui: { finition: 1.15 } }),
    ] },
  infirmerie_pleine: { ico: '🩹', titre: 'L\'infirmerie déborde', fait: 'blesses', de: 'ph',
    options: [
      o('reduire', 'Alléger les entraînements', 'Moins de blessures, moins d\'usure des jambes', 'Moins de tirs', { blessure: 0.76, energie: 0.888, volume: 0.913, duree: 7 }),
      o('maintenir', 'Garder la charge d\'entraînement', 'Plus de tirs', 'Plus de blessures', { volume: 1.088, blessure: 1.32, duree: 6 }),
    ] },
  mars_tournee: { ico: '🗺', titre: 'Sur la route', fait: 'route', de: 'ad',
    options: [
      o('repos', 'Ajouter une journée de repos', 'Moins d\'usure des jambes, moins de blessures', 'Moins de tirs', { energie: 0.84, blessure: 0.84, volume: 0.913, duree: 6 }),
      o('serre', 'Garder l\'horaire serré', null, 'Plus d\'usure des jambes', { energie: 1.16, duree: 6 }),
    ] },
  vedette_repos: { ico: '🛌', titre: 'Des jambes vides', fait: 'jambes', de: 'ph',
    options: [
      o('repos', 'Un match de repos pour {nom}', '{nom} : plus de jambes', '{nom} manque un match', { action: { absents: 1, energie: 15 } }),
      o('garder', 'Le garder dans l\'alignement', 'Rien ne change', null, { rien: true }),
    ] },
  sieste: { ico: '😴', titre: 'Les jambes du groupe', fait: 'jambesEquipe', de: 'ph',
    options: [
      o('imposer', 'Imposer une sieste avant les matchs', 'Moins d\'usure des jambes, moins de blessures', 'Moins de tirs', { energie: 0.84, blessure: 0.84, volume: 0.913, duree: 6 }),
      o('libre', 'Pousser le rythme des pratiques', 'Plus de tirs', 'Plus de buts contre', { volume: 1.08, defense: 1.06, duree: 6 }),
    ] },
  vedette_photo: { ico: '🔥', titre: 'Le joueur en feu', fait: 'chaud', de: 'an',
    options: [
      o('accepter', 'Le laisser tirer à volonté', '{nom} : plus de tirs', '{nom} : moins de précision', { duree: 6, lui: { lancers: 1.75, finition: 0.73 } }),
      o('refuser', 'Lui demander de faire jouer ses ailiers', '{nom} : plus de passes', '{nom} : moins de tirs', { duree: 6, lui: { creation: 2.22, lancers: 0.39 } }),
    ] },
  echeance_jeune: { ico: '🌱', titre: 'La recrue', quand: 'echeance mars', fait: 'recrue', de: 'ag',
    options: [
      o('donner', 'Donner plus de glace au bas de l\'alignement', 'Tes deuxième, troisième et quatrième trios jouent plus ; plus de tirs', 'Ton premier trio joue moins', { F: [0.9, 1.05, 1.08, 1.05], volume: 1.088, duree: 10 }),
      o('attendre', 'Garder les minutes comme elles sont', 'Rien ne change', null, { rien: true }),
    ] },
  dossards: { ico: '🎽', titre: 'Le quatrième trio', fait: 'quatrieme', de: 'ad',
    options: [
      o('donner', 'Donner plus de glace à {noms}', 'Ton quatrième trio joue plus', 'Ton premier trio joue moins', { F: [0.92, 1, 1.04, 1.25], duree: 6 }),
      o('garder', 'Garder les minutes comme elles sont', 'Rien ne change', null, { rien: true }),
    ] },
};

/** Les dilemmes, entrées de `MOMENTS` (js/sim.js) : { vie_cle: { ico, titre, irl, fait, quand?, de, options } }. */
export const MOMENTS_VIE = Object.fromEntries(Object.entries(DILEMMES_BRUTS).map(([cle, d]) => {
  const { quand, ...reste } = d;
  return [`vie_${cle}`, { irl: null, ...reste, ...(quand ? { quand: mots(quand) } : {}) }];
}));

/* ======================================================================
   LE POINT DE PRESSE : la question d'un journaliste, et TES réponses à elle
   (oct. 2026). JP : *les entrevues sont pas pareilles* — la question parlait
   de la vidéo du lendemain ou de la rondelle du match, et les réponses
   offertes venaient d'un paquet commun à toute l'occasion (« Tourner la
   page », « Féliciter {nom} ») : on répondait à côté. Chaque question porte
   maintenant ses deux ou trois réponses, ce que l'entraîneur dit au micro,
   dans la forme des options des dilemmes (`o`, plus haut) : les mêmes
   canaux, les mêmes amplitudes, un `pari`, un `ensuite`, une `action`.
   Trois occasions, celles que la saison tire (js/saison.js, `vieOuverte`) :
   raclee (une défaite sans appel) · serieDefaites (trois de suite) ·
   blanchissage (ton gardien n'a rien accordé : il est nommé, {nom}).
   L'id (`e29`…) est celui d'avant : une saison sauvegardée retrouve sa question.
   ====================================================================== */
/* Les effets qui reviennent, dans les amplitudes des dilemmes voisins (js/sim.js, MOMENTS). */
const CALME = { discipline: 0.86, finition: 0.96, duree: 5 };
const FEU = { volume: 1.08, discipline: 1.18, duree: 5 };
const SERIEUX = { defense: 0.93, finition: 0.95, duree: 5 };
const OUBLI = { finition: 1.05, defense: 1.06, duree: 5 };
const DETENTE = { volume: 1.06, defense: 1.06, duree: 5 };
const ABRI = { discipline: 0.85, volume: 0.94, duree: 5 };
const DUR = { defense: 0.92, discipline: 1.15, duree: 5 };
const REPOS = { energie: 0.88, finition: 0.95, duree: 5 };
const PRATIQUE = { defense: 0.92, action: { energieTous: -10 }, duree: 5 };
const CHOC = { F: [0.92, 1.04, 1.06, 1.03], volume: 1.06, duree: 5 };
const BAS = { F: [0.9, 0.97, 1.05, 1.2], blessure: 0.8, duree: 5 };
const PROMESSE = { pari: { chance: 3 / 6, gagne: { finition: 1.16, duree: 5 }, perd: { finition: 0.94, duree: 5 } } };
const LUI = { defense: 0.93, discipline: 1.12, duree: 5 };
const BLEUS = { defense: 0.94, blessure: 1.2, duree: 5 };
const SOBRE = { defense: 0.95, finition: 0.96, duree: 5 };
const CONGE = { action: { gardienAux: 1 }, ensuite: { apres: 1, duree: 5, defense: 0.94 } };
const ECHANGES_BRUTS = [
  // ---- Après une raclée ----
  [29, 'raclee', 'Une soirée comme celle-là, on l\'oublie avec un sourire ou on la regarde en face ?', { cible: 'gardien', options: [
    o('sourire', '« Avec un sourire. On joue après-demain. »', 'Un vestiaire qui oublie vite : plus de précision', 'Une défensive qui reste laxiste', OUBLI),
    o('face', '« En face. Mais pas ce soir. »', 'On revoit tout : la défense se resserre', 'Des joueurs crispés devant le but', SERIEUX),
  ] }],
  [30, 'raclee', 'Qu\'est-ce que vous allez dire à vos joueurs en entrant dans le vestiaire ?', { cible: 'gardien', options: [
    o('rien', '« Pas grand-chose. Ils ont vu le tableau comme moi. »', 'Un silence qui calme les têtes : moins de punitions', 'Moins de mordant devant le but', CALME),
    o('fort', '« Ce que je pense. Porte fermée, et fort. »', 'Ils réagissent : plus de lancers', 'Les têtes chauffent : plus de punitions', FEU),
  ] }],
  [31, 'raclee', 'À quel moment avez-vous compris que la soirée était perdue ?', { cible: 'gardien', options: [
    o('tot', '« Trop tôt. Bien trop tôt. »', 'Un aveu qui pique : la défense se resserre', 'Un vestiaire vexé : plus de punitions', DUR),
    o('jamais', '« Jamais. On a joué jusqu\'à la sirène. »', 'Un vestiaire qui y croit encore : plus de lancers', 'Rien de corrigé derrière', DETENTE),
  ] }],
  [32, 'raclee', 'Demain matin, c\'est congé, vidéo, ou une pratique dont ils vont se souvenir ?', { cible: 'gardien', options: [
    o('conge', '« Congé. Ils en ont besoin. »', 'Des jambes reposées', 'Une soirée qui se digère mal : moins de précision', REPOS),
    o('video', '« Vidéo. Tout le match, sans en sauter. »', 'On voit les erreurs : la défense se resserre', 'Des heures assis : l\'usure des jambes grimpe', { defense: 0.93, energie: 1.08, duree: 5 }),
    o('pratique', '« Une pratique. Ils vont s\'en souvenir. »', 'La défense se resserre', 'Toute l\'équipe arrive sur les jambes', PRATIQUE),
  ] }],
  [33, 'raclee', 'Peut-on encore rire dans un vestiaire après une soirée pareille ?', { cible: 'gardien', options: [
    o('rire', '« Il le faut. Sinon, personne ne dort. »', 'Un vestiaire détendu : plus de lancers', 'Un peu de relâchement derrière', DETENTE),
    o('pas', '« Pas cette semaine. »', 'Un groupe sérieux : la défense se resserre', 'Des joueurs crispés devant le but', SERIEUX),
  ] }],
  [34, 'raclee', 'Faut-il tourner la page vite, ou laisser la soirée faire mal ?', { cible: 'gardien', options: [
    o('vite', '« Vite. Il y a un match après-demain. »', 'Un vestiaire qui oublie vite : plus de précision', 'Une défensive qui reste laxiste', OUBLI),
    o('mal', '« Qu\'elle fasse mal une nuit. Pas plus. »', 'Un groupe piqué qui se tient : moins de punitions', 'Moins de mordant devant le but', CALME),
  ] }],
  [35, 'raclee', 'Vous allez quand même la revoir, sur vidéo ?', { cible: 'gardien', options: [
    o('accelere', '« Oui. En accéléré. »', 'Les erreurs se corrigent : la défense se resserre', 'Un vestiaire qui rumine devant le but', SERIEUX),
    o('non', '« Non. Elle ne mérite pas qu\'on la revoie. »', 'Une soirée de repos : des jambes ménagées', 'Les mêmes erreurs derrière', { energie: 0.9, defense: 1.06, duree: 5 }),
  ] }],
  [36, 'raclee', 'Êtes-vous en colère ?', { cible: 'gardien', options: [
    o('oui', '« Oui. Ça va se voir demain. »', 'Ils réagissent : plus de lancers', 'Les têtes chauffent : plus de punitions', FEU),
    o('decu', '« Déçu. La colère ne règle rien. »', 'Un vestiaire calme : moins de punitions', 'Moins d\'urgence : moins de lancers', ABRI),
  ] }],
  [37, 'raclee', 'Trouvez-vous quelque chose de positif à retenir de ce soir ?', { cible: 'gardien', options: [
    o('autobus', '« L\'autobus part à l\'heure. »', 'Une blague qui détend : plus de précision', 'Un relâchement derrière', OUBLI),
    o('battus', '« Ceux qui se sont battus jusqu\'à la fin. »', 'Ils se jettent devant les tirs : la défense se resserre', 'Ils s\'usent : plus de blessures', BLEUS),
  ] }],
  [38, 'raclee', 'Vos joueurs méritent-ils une journée de congé après ça ?', { cible: 'gardien', options: [
    o('pratique', '« Ils méritent une pratique. Ils vont l\'avoir. »', 'La défense se resserre', 'Toute l\'équipe arrive sur les jambes', PRATIQUE),
    o('conge', '« Oui. Des jambes neuves, une tête neuve. »', 'Des jambes reposées', 'Une journée sans rythme : moins de lancers', { energie: 0.88, volume: 0.95, duree: 5 }),
  ] }],
  [39, 'raclee', 'Vous avez l\'air étrangement calme pour un soir comme celui-là.', { cible: 'gardien', options: [
    o('calme', '« Le calme, c\'est ce qui me reste. »', 'Un vestiaire qui suit : moins de punitions', 'Moins de mordant devant le but', CALME),
    o('dedans', '« Je le garde pour le vestiaire. Il ne le sera pas. »', 'Ils réagissent : plus de lancers', 'Les têtes chauffent : plus de punitions', FEU),
  ] }],
  [40, 'raclee', 'Qu\'est-ce qui attend vos joueurs demain matin ?', { cible: 'gardien', options: [
    o('glace', '« De la glace. Beaucoup de glace. »', 'Du rythme : plus de lancers', 'L\'usure des jambes grimpe', { volume: 1.08, energie: 1.1, duree: 5 }),
    o('dormir', '« Une grasse matinée. »', 'Des jambes reposées', 'Une défensive qui s\'endort', { energie: 0.88, defense: 1.05, duree: 5 }),
  ] }],
  [41, 'raclee', 'Faut-il prendre une soirée pareille au sérieux, ou la mettre sur le compte d\'un mauvais soir ?', { cible: 'gardien', options: [
    o('serieux', '« Au sérieux. Un mauvais soir, ça se répète. »', 'Un groupe sérieux : la défense se resserre', 'Des joueurs crispés devant le but', SERIEUX),
    o('mauvais', '« Un mauvais soir. Tout le monde en a. »', 'Un vestiaire qui ne doute pas : plus de précision', 'Rien ne change derrière', OUBLI),
  ] }],
  [42, 'raclee', 'Et la suite, vous la commentez ?', { cible: 'gardien', options: [
    o('pratique', '« La suite commence demain, à la pratique. »', 'On corrige : la défense se resserre', 'L\'usure des jambes grimpe', { defense: 0.94, energie: 1.08, duree: 5 }),
    o('promesse', '« On gagne le prochain. Notez-le. »', 'Si la promesse tient, ça tire avec aplomb', 'Sinon, elle pèse sur les épaules', PROMESSE),
  ] }],

  // ---- Après trois défaites de suite ----
  [43, 'serieDefaites', 'Les défaites s\'empilent. Avez-vous encore confiance en ce groupe ?', { cible: 'vedette', options: [
    o('oui', '« Oui. Mais la confiance, ça se mérite aussi. »', 'La confiance revient au tir', 'Les trous derrière ne se bouchent pas', { finition: 1.07, defense: 1.06, duree: 5 }),
    o('travail', '« En ceux qui travaillent, oui. »', 'Chacun défend sa place : la défense se resserre', 'Un vestiaire tendu : plus de punitions', DUR),
  ] }],
  [44, 'serieDefaites', 'Allez-vous brasser l\'alignement avant le prochain match ?', { cible: 'vedette', options: [
    o('table', '« Tout est sur la table. »', 'Le bas de l\'alignement joue plus : le choc', 'Ton premier trio joue moins', CHOC),
    o('memes', '« Non. Les mêmes, qui vont faire mieux. »', 'Des joueurs soutenus : moins de punitions', 'Moins de pression : moins de lancers', ABRI),
  ] }],
  [45, 'serieDefaites', 'À partir de quand est-ce qu\'on panique, alors ?', { cible: 'vedette', options: [
    o('pas', '« Pas ce soir. »', 'Un vestiaire calme : moins de punitions', 'Moins de mordant devant le but', CALME),
    o('eux', '« Moi, jamais. Eux devraient s\'inquiéter. »', 'Ils réagissent : plus de lancers', 'Les têtes chauffent : plus de punitions', FEU),
  ] }],
  [46, 'serieDefaites', 'Certains joueurs jouent-ils pour leur poste ? Allez-vous les protéger ?', { cible: 'vedette', options: [
    o('proteger', '« Je protège ceux qui travaillent. »', 'Chacun défend sa place : la défense se resserre', 'Un vestiaire sur les nerfs : plus de punitions', { defense: 0.93, discipline: 1.12, duree: 5 }),
    o('tous', '« Tout le monde joue pour son poste. Moi aussi. »', 'Tout le monde pousse : plus de lancers', 'On joue sur les nerfs : l\'usure des jambes grimpe', { volume: 1.07, energie: 1.1, duree: 5 }),
  ] }],
  [47, 'serieDefaites', 'Avez-vous dit à vos joueurs ce que vous pensez vraiment de ce qu\'on voit ?', { cible: 'vedette', options: [
    o('prive', '« Pas en public. »', 'Un vestiaire protégé : moins de punitions', 'Moins d\'urgence : moins de lancers', { discipline: 0.86, volume: 0.95, duree: 5 }),
    o('assez', '« Oui. Et je vous le dis : ce n\'est pas assez. »', 'Ils réagissent : plus de lancers', 'Les têtes chauffent : plus de punitions', FEU),
  ] }],
  [48, 'serieDefaites', 'Les partisans réclament des changements. Les entendez-vous ?', { cible: 'vedette', options: [
    o('decide', '« Je les entends. C\'est moi qui décide. »', 'Un banc qui garde son plan : la défense se resserre', 'Des joueurs crispés devant le but', SERIEUX),
    o('bouger', '« Ils ont raison. Ça va bouger. »', 'Plus de glace au bas de l\'alignement : plus de précision et de lancers', 'Ton premier trio joue moins', { F: [0.95, 1.02, 1.05, 1.06], finition: 1.16, volume: 1.04, duree: 5 }),
  ] }],
  [49, 'serieDefaites', '« Confiance », c\'est le mot que vous répétez depuis le début de la glissade. Y croyez-vous encore ?', { cible: 'vedette', options: [
    o('jamais', '« Plus que jamais. Sinon, je changerais de mot. »', 'Un vestiaire qui ne doute pas : plus de précision', 'Rien ne change derrière', { finition: 1.06, defense: 1.06, duree: 5 }),
    o('travail', '« J\'ai changé de mot : travail. »', 'Des pratiques dures : la défense se resserre', 'L\'usure des jambes grimpe', { defense: 0.92, energie: 1.1, duree: 5 }),
  ] }],
  [50, 'serieDefaites', 'Est-ce le vestiaire qu\'il faut protéger, ou l\'alignement qu\'il faut brasser ?', { cible: 'vedette', options: [
    o('vestiaire', '« Le vestiaire. Il va se relever. »', 'Des joueurs soutenus : moins de punitions', 'Moins de pression : moins de lancers', ABRI),
    o('alignement', '« L\'alignement. Dès demain. »', 'Le bas de l\'alignement joue plus : le choc', 'Ton premier trio joue moins', CHOC),
  ] }],
  [51, 'serieDefaites', 'Si ce n\'est pas le talent, qu\'est-ce qui manque ?', { cible: 'vedette', options: [
    o('rebond', '« Un rebond qui roule pour nous. »', 'Si la chance tourne, ça rentre', 'Sinon, on l\'attend encore', PROMESSE),
    o('lancers', '« Des lancers. On ne tire pas assez. »', 'On lance de partout', 'Des trous derrière', { volume: 1.08, defense: 1.06, duree: 5 }),
  ] }],
  [52, 'serieDefaites', 'Des joueurs ont-ils perdu leur place ce soir ?', { cible: 'vedette', options: [
    o('moi', '« Ils l\'apprendront de moi avant de l\'apprendre de vous. »', 'Un vestiaire protégé : moins de punitions', 'Moins de mordant devant le but', CALME),
    o('quatrieme', '« Oui. Le quatrième trio va jouer. »', 'Le quatrième trio saute sur la glace : du rythme', 'Tes vedettes jouent moins', { F: [0.92, 1, 1.04, 1.15], volume: 1.05, duree: 5 }),
  ] }],
  [53, 'serieDefaites', 'Le propriétaire vous a-t-il appelé ?', { cible: 'vedette', options: [
    o('soeur', '« Ma sœur m\'a appelé. Le propriétaire, pas encore. »', 'Une blague qui détend : plus de précision', 'Un relâchement derrière', OUBLI),
    o('raison', '« Oui. Et il a raison. »', 'Le message passe : la défense se resserre', 'Un vestiaire tendu : plus de punitions', DUR),
  ] }],
  [54, 'serieDefaites', 'Avez-vous réuni le vestiaire ce soir ?', { cible: 'vedette', options: [
    o('porte', '« Porte fermée. Ce qui s\'est dit y reste. »', 'Un vestiaire uni : moins de punitions', 'Moins d\'urgence : moins de lancers', ABRI),
    o('dormir', '« Non. Ce soir, ils dorment. »', 'Des jambes reposées', 'Une glissade qui se digère mal : moins de précision', REPOS),
  ] }],
  [55, 'serieDefaites', 'Qu\'est-ce qu\'on dit à un vestiaire qui ne gagne plus ?', { cible: 'vedette', options: [
    o('verite', '« La vérité. Elle tient en une phrase. »', 'Le message passe : la défense se resserre', 'Un vestiaire tendu : plus de punitions', DUR),
    o('classement', '« Qu\'il vaut mieux que son classement. »', 'La confiance revient au tir', 'Les trous derrière ne se bouchent pas', { finition: 1.07, defense: 1.06, duree: 5 }),
  ] }],
  [56, 'serieDefaites', 'Le moment est-il venu de donner sa chance au bas de l\'alignement ?', { cible: 'vedette', options: [
    o('venu', '« Il est venu. Les plombiers vont jouer. »', 'Plus de glace au bas de l\'alignement, des corps reposés', 'Tes vedettes jouent moins', BAS),
    o('meilleurs', '« Pas encore. Mes meilleurs vont nous sortir de là. »', 'Tes meilleurs jouent plus', 'Ils s\'usent : plus de blessures', { F: [1.15, 1.03, 0.97, 0.82], blessure: 1.25, duree: 5 }),
  ] }],

  // ---- Après un blanchissage : le gardien est nommé ----
  [57, 'blanchissage', 'Après un blanchissage, vous renvoyez le même gardien devant le filet ou vous lui accordez un soir de repos ?', { cible: 'gardien', options: [
    o('meme', '« Le même. On ne touche pas à ça. »', '{nom} se sent invincible', 'Les défenseurs se reposent sur lui : plus de punitions', LUI),
    o('repos', '« Un soir de repos pour {nom}. Il l\'a mérité. »', '{nom} revient reposé et motivé', 'Un match avec ton auxiliaire', CONGE),
  ] }],
  [58, 'blanchissage', 'Le zéro revient au gardien, ou à ceux qui se sont jetés devant les tirs ?', { cible: 'gardien', options: [
    o('gardien', '« À {nom}. Les autres ont leur part. »', '{nom} se sent invincible', 'Les défenseurs se reposent sur lui : plus de punitions', LUI),
    o('bleus', '« À ceux qui ont des bleus. »', 'Ils se jettent devant chaque tir', 'Ils s\'usent et se blessent', BLEUS),
  ] }],
  [59, 'blanchissage', 'Un blanchissage, c\'est un exploit ou juste une bonne soirée ?', { cible: 'gardien', options: [
    o('soiree', '« Une bonne soirée. Les exploits, on les compte au printemps. »', 'Aucune pression sur le filet', 'Moins d\'élan devant le but', SOBRE),
    o('exploit', '« Un exploit. {nom} a été parfait. »', 'Un vestiaire gonflé à bloc : plus de précision', 'On se croit à l\'abri derrière', { finition: 1.06, defense: 1.05, duree: 5 }),
  ] }],
  [60, 'blanchissage', 'Qui a fait le travail le plus ingrat ce soir ?', { cible: 'gardien', options: [
    o('bleus', '« Ceux qui ont mangé des rondelles. »', 'Ils se jettent devant chaque tir', 'Ils s\'usent et se blessent', BLEUS),
    o('quatrieme', '« Le quatrième trio. Personne ne l\'a vu, et c\'est voulu. »', 'Plus de glace au quatrième trio, qui ferme le jeu', 'Ton premier trio joue moins', { F: [0.94, 1, 1.03, 1.12], defense: 0.96, duree: 5 }),
  ] }],
  [61, 'blanchissage', 'Votre gardien n\'a rien laissé passer. Mérite-t-il un soir de congé ?', { cible: 'gardien', options: [
    o('repos', '« Oui. {nom} prend congé demain. »', '{nom} revient reposé et motivé', 'Un match avec ton auxiliaire', CONGE),
    o('proteger', '« Il mérite surtout qu\'on continue de le protéger. »', 'On protège le filet : la défense se resserre', 'Moins de monde à l\'attaque : moins de lancers', { defense: 0.93, volume: 0.95, duree: 5 }),
  ] }],
  [62, 'blanchissage', 'Vous allez féliciter le gardien en premier, ou les défenseurs ?', { cible: 'gardien', options: [
    o('gardien', '« {nom} d\'abord. C\'est la tradition. »', '{nom} se sent invincible', 'Les défenseurs se reposent sur lui : plus de punitions', LUI),
    o('defenseurs', '« Les défenseurs. Lui, il le sait. »', 'Ils se jettent devant chaque tir', 'Ils s\'usent et se blessent', BLEUS),
  ] }],
  [63, 'blanchissage', 'Vous allez en faire tout un plat, ou rester sobre ?', { cible: 'gardien', options: [
    o('sobre', '« Sobre. Un zéro, ça se range comme le reste. »', 'Aucune pression sur le filet', 'Moins d\'élan devant le but', SOBRE),
    o('plat', '« Tout un plat. Ça n\'arrive pas tous les soirs. »', 'Un vestiaire fier : plus de précision', 'Un peu trop fier : plus de punitions', { finition: 1.06, discipline: 1.12, duree: 5 }),
  ] }],
  [64, 'blanchissage', 'Votre gardien est-il en train de devenir l\'homme de la situation ?', { cible: 'gardien', options: [
    o('deja', '« Il l\'était déjà. Ce soir, ça s\'est vu. »', '{nom} se sent invincible', 'Les défenseurs se reposent sur lui : plus de punitions', LUI),
    o('saison', '« Un match ne fait pas une saison. »', 'Aucune pression sur le filet', 'Moins d\'élan devant le but', SOBRE),
  ] }],
  [65, 'blanchissage', 'Un blanchissage met de la pression sur le prochain départ. Vous y pensez ?', { cible: 'gardien', options: [
    o('autre', '« Aucune pression. {nom} va en faire un autre. »', 'S\'il tient, il ferme encore la porte', 'Sinon, la pression le rattrape',
      { pari: { chance: 3 / 6, gagne: { defense: 0.9, duree: 5 }, perd: { defense: 1.1, duree: 5 } } }),
    o('repos', '« Il prendra le prochain sur le banc. »', 'Un soir à l\'abri : {nom} revient reposé', 'Un match avec ton auxiliaire', CONGE),
  ] }],
  [66, 'blanchissage', 'Qui allez-vous remercier en premier dans le vestiaire ?', { cible: 'gardien', options: [
    o('gardien', '« {nom}. Ensuite, ceux qui ont des bleus. »', '{nom} se sent invincible', 'Les défenseurs se reposent sur lui : plus de punitions', LUI),
    o('groupe', '« Le groupe au complet, d\'un seul coup. »', 'Personne n\'est oublié : moins de punitions', 'Moins d\'élan devant le but', CALME),
  ] }],
  [67, 'blanchissage', 'Un blanchissage, ça change quelque chose pour un gardien, ou c\'est un match comme un autre ?', { cible: 'gardien', options: [
    o('rien', '« Pour lui, rien. Pour moi, un peu. »', 'Aucune pression sur le filet', 'Moins d\'élan devant le but', SOBRE),
    o('bulle', '« Ça change tout. {nom} est dans sa bulle. »', 'On protège sa bulle : la défense se resserre', 'On joue serré : l\'usure des jambes grimpe', { defense: 0.92, energie: 1.08, duree: 5 }),
  ] }],
  [68, 'blanchissage', 'Un zéro, c\'est le travail d\'un homme ou de toute l\'équipe ?', { cible: 'gardien', options: [
    o('equipe', '« De toute l\'équipe. Le gardien compte double. »', 'Ils se jettent devant chaque tir', 'Ils s\'usent et se blessent', BLEUS),
    o('lui', '« De {nom}. Les autres le savent. »', '{nom} se sent invincible', 'Les défenseurs se reposent sur lui : plus de punitions', LUI),
  ] }],
  [69, 'blanchissage', 'Vous ne semblez pas très ému par ce blanchissage. C\'est voulu ?', { cible: 'gardien', options: [
    o('voulu', '« C\'est voulu. Il y a un autre match qui s\'en vient. »', 'Aucune pression sur le filet', 'Moins d\'élan devant le but', SOBRE),
    o('dedans', '« Je suis ému en dedans. Ça ne paraît pas. »', 'Le vestiaire le sent : plus de précision', 'Un peu de laisser-aller : plus de punitions', { finition: 1.05, discipline: 1.1, duree: 5 }),
  ] }],
  [70, 'blanchissage', 'Votre gardien va-t-il garder la rondelle du match ?', { cible: 'gardien', options: [
    o('sac', '« Elle est déjà dans son sac. »', '{nom} se sent invincible', 'Les défenseurs se reposent sur lui : plus de punitions', LUI),
    o('conge', '« Avec un soir de congé en prime. »', '{nom} revient reposé et motivé', 'Un match avec ton auxiliaire', CONGE),
  ] }],
];

/** Les échanges : { id, quand, question, cible?, options } — `quand` est l'une des trois occasions. */
const ECHANGES = ECHANGES_BRUTS.map(([n, quand, question, reponses]) => ({ id: `e${n}`, quand, question, ...reponses }));

/* ======================================================================
   LES RÉPONSES : un courriel et un point de presse ne sont plus de la couleur.
   Chacun offre deux ou trois façons de répondre, dans la forme des options des
   dilemmes (`o`, plus haut) : les mêmes canaux, la même durée en matchs, un
   `pari`, un `ensuite`, une `action`, une `mutation` sur un joueur NOMMÉ
   (`cible`, {nom} dans le texte). Rien de neuf pour le moteur : une réponse
   prise est une décision `{ moment: { famille: 'vie', cle, choix } }` que
   `effetDeMoment`, `appliquerGestes` et `pariDeDecision` (js/sim.js) lisent
   comme celle d'un dilemme. « Archiver » ne fait rien. Chaque réponse paie
   son effet d'un prix, et l'effet suit le métier de l'expéditeur : le
   propriétaire (finition, discipline), les finances (rythme et jambes, jamais
   de jetons ni de plafond), l'adjoint (les minutes), l'agent (UN joueur), le
   physio (blessures, jambes), le préposé (jambes, discipline), les
   communications et la ligue (discipline), le partisan et le maire (lancers).
   Les amplitudes sont celles des dilemmes voisins (js/sim.js, MOMENTS).
   Deux paquets par expéditeur ; l'un ou l'autre selon le numéro du courriel.
   ====================================================================== */
const PAQUETS_COURRIEL = {
  pr: [
    { options: [
      o('raison', 'Lui donner raison', 'Il se sent écouté : le vestiaire joue pour lui', 'Il s\'ingère : les punitions suivent', { finition: 1.08, discipline: 1.19, duree: 5 }),
      o('plan', 'Lui remettre un plan en trois points', 'Un vestiaire en ordre, moins de punitions', 'Un plan trop pensé : moins de lancers', { discipline: 0.84, volume: 0.93, duree: 5 }),
    ] },
    { options: [
      o('rassurer', 'Le rassurer par écrit', 'Une défensive qui ne prend aucun risque', 'Un vestiaire qui se retient devant le but', { defense: 0.93, finition: 0.95, duree: 5 }),
      o('audace', 'Lui répondre qu\'on joue à l\'audace', 'Des lancers et des buts', 'Des trous derrière', { volume: 1.07, finition: 1.04, defense: 1.08, duree: 5 }),
    ] },
  ],
  fi: [
    { options: [
      o('couper', 'Couper dans les dépenses', 'Un vestiaire sobre : moins de punitions', 'Moins de rondelles à l\'entraînement : moins de lancers', { discipline: 0.86, volume: 0.93, duree: 5 }),
      o('approuver', 'Approuver la dépense', 'Du matériel neuf : plus de lancers', 'Les voyages coûtent des jambes', { volume: 1.08, energie: 1.1, duree: 5 }),
    ] },
    { options: [
      o('reviser', 'Réviser le budget des voyages', 'Des vols plus doux : les jambes sont préservées', 'Des cabines serrées : les têtes chauffent', { energie: 0.88, discipline: 1.12, duree: 5 }),
      o('garder', 'Garder le budget tel quel', 'Une défensive qui compte chaque sou', 'Moins de lancers', { defense: 0.94, volume: 0.95, duree: 5 }),
    ] },
  ],
  ad: [
    { options: [
      o('premier', 'Charger le premier trio', 'Ton premier trio joue davantage', 'Il s\'use, et le 4e rouille', { F: [1.12, 1.02, 0.97, 0.85], blessure: 1.2, duree: 5 }),
      o('quatre', 'Faire rouler les quatre trios', 'Les corps se reposent et le 4e trio goûte à la glace', 'Tes vedettes jouent moins', { F: [0.92, 1, 1.03, 1.12], blessure: 0.8, duree: 5 }),
    ] },
    { options: [
      o('paire', 'Allonger la première paire', 'Ta première paire joue davantage', 'Elle finit à plat', { D: [1.15, 1, 0.82], energie: 1.15, duree: 5 }),
      o('troisieme', 'Donner du temps à la 3e paire', 'La première paire retrouve ses jambes', 'Moins de talent sur la glace : moins de lancers', { D: [0.92, 1, 1.15], energie: 0.92, volume: 0.96, duree: 5 }),
    ] },
  ],
  ag: [
    { cible: 'vedette', options: [
      o('annee', 'Lui dire que c\'est son année', '{nom} joue pour son prochain contrat', 'Il force, et il se blesse plus souvent', { mutation: 'contrat_annee' }),
      o('conge', 'Lui donner un soir de congé', '{nom} revient frais et content', 'Un match sans lui : un réserviste joue', { action: { absents: 1 }, ensuite: { apres: 1, duree: 4, finition: 1.12 } }),
    ] },
    { cible: 'vedette', options: [
      o('prolonge', 'Lui parler de prolongation', '{nom} est rassuré pour des années : il se ménage', 'Un peu moins fougueux devant le but', { mutation: 'contrat_prolonge' }),
      o('capitaine', 'Lui promettre le « C »', '{nom} porte l\'équipe sur son dos', 'Les vétérans bougonnent : plus de punitions', { mutation: 'contrat_leader', discipline: 1.12, duree: 5 }),
    ] },
  ],
  ph: [
    { options: [
      o('etirements', 'Imposer ses étirements', 'Moins de blessures', 'Des échauffements longs : moins de lancers', { blessure: 0.78, volume: 0.95, duree: 6 }),
      o('conge', 'Accorder une journée de congé à tout le monde', 'Toute l\'équipe retrouve ses jambes', 'Un entraînement perdu : moins de précision', { action: { energieTous: 12 }, finition: 0.94, duree: 4 }),
    ] },
    { options: [
      o('hydrater', 'Hydrater tout le monde', 'Des jambes fraîches', 'Des pauses à répétition : le rythme tombe', { energie: 0.88, volume: 0.95, duree: 5 }),
      o('laisser', 'Laisser chacun gérer son corps', 'Un jeu libre : plus de lancers', 'Des corps mal préparés : plus de blessures', { volume: 1.07, blessure: 1.25, duree: 5 }),
    ] },
  ],
  eq: [
    { options: [
      o('commander', 'Commander ce qu\'il demande', 'Du matériel neuf : moins d\'usure des jambes', 'Un vestiaire qui se croit tout permis : plus de punitions', { energie: 0.9, discipline: 1.12, duree: 5 }),
      o('enqueter', 'Faire enquêter le vestiaire', 'Un vestiaire à l\'ordre : moins de punitions', 'Des joueurs soupçonnés : moins de précision', { discipline: 0.88, finition: 0.96, duree: 3 }),
    ] },
    { options: [
      o('racheter', 'Tout racheter neuf', 'Des patins et des gants frais : les jambes sont préservées', 'Le temps de tout roder : moins de lancers', { energie: 0.88, volume: 0.95, duree: 5 }),
      o('rafistoler', 'Rafistoler avec ce qu\'on a', 'Le vestiaire se serre les coudes : moins de punitions', 'Du vieux matériel : les jambes paient', { discipline: 0.88, energie: 1.1, duree: 5 }),
    ] },
  ],
  co: [
    { options: [
      o('parler', 'Laisser parler les joueurs', 'La confiance se voit au tir', 'Un mot de trop et les punitions montent', { finition: 1.07, discipline: 1.18, duree: 5 }),
      o('verrouiller', 'Tout passer par les communications', 'Un vestiaire muet : moins de punitions', 'Des joueurs sur la défensive : moins de lancers', { discipline: 0.84, volume: 0.94, duree: 5 }),
    ] },
    { options: [
      o('sobre', 'Un message sobre', 'Un vestiaire calme : moins de punitions', 'Un vestiaire qui se retient : moins de précision', { discipline: 0.88, finition: 0.96, duree: 5 }),
      o('bruit', 'Un message qui fait du bruit', 'La foule s\'enflamme : plus de lancers', 'Les adversaires s\'énervent, nous aussi : plus de punitions', { volume: 1.07, discipline: 1.15, duree: 5 }),
    ] },
  ],
  li: [
    { options: [
      o('lettre', 'Se conformer à la lettre', 'Rien à reprocher aux joueurs : moins de punitions', 'Tout est mesuré : moins de lancers', { discipline: 0.84, volume: 0.94, duree: 5 }),
      o('contester', 'Contester par écrit', 'Le vestiaire se sent défendu', 'Les arbitres nous ont à l\'œil : plus de punitions', { finition: 1.06, discipline: 1.2, duree: 5 }),
    ] },
    { options: [
      o('briefer', 'Revoir le règlement avec les joueurs', 'Des joueurs au courant : moins de punitions', 'Ils y pensent trop : des trous derrière', { discipline: 0.86, defense: 1.05, duree: 5 }),
      o('fermer', 'Fermer les yeux', 'Un jeu sans complexe : plus de lancers', 'Les arbitres sifflent plus', { volume: 1.06, discipline: 1.15, duree: 5 }),
    ] },
  ],
  pa: [
    { options: [
      o('repondre', 'Lui répondre en personne', 'La foule le sait : ça lance', 'Une distraction : des trous derrière', { volume: 1.07, defense: 1.05, duree: 5 }),
      o('billets', 'Lui envoyer deux billets', 'Un partisan heureux, un vestiaire confiant', 'Ça se sait : le vestiaire jalouse', { finition: 1.06, discipline: 1.12, duree: 5 }),
    ] },
    { options: [
      o('victoire', 'Lui promettre une victoire', 'S\'il y croit, ça rentre', 'Sinon, la pression se paie derrière',
        { pari: { chance: 3 / 6, gagne: { finition: 1.15, duree: 5 }, perd: { defense: 1.09, duree: 5 } } }),
      o('merci', 'Le remercier sobrement', 'Une défensive concentrée', 'Moins de panache devant le but', { defense: 0.94, volume: 0.95, duree: 5 }),
    ] },
  ],
  ma: [
    { options: [
      o('ceremonie', 'Y aller en grande pompe', 'La ville pousse : plus de lancers', 'Des jambes lourdes de protocole', { volume: 1.07, energie: 1.1, duree: 5 }),
      o('excuser', 'S\'excuser poliment', 'Des jambes au repos', 'Une foule déçue : moins de précision', { energie: 0.85, finition: 0.94, duree: 5 }),
    ] },
    { options: [
      o('accepter', 'Accepter le geste', 'La ville est derrière nous : plus de lancers', 'Le vestiaire se disperse : plus de punitions', { volume: 1.06, discipline: 1.12, duree: 5 }),
      o('decliner', 'Décliner : on a un match', 'Une concentration totale', 'Un maire vexé et une foule plus froide', { defense: 0.94, volume: 0.95, duree: 5 }),
    ] },
  ],
};

/* Des courriels qui appellent leur propre réponse : le paquet leur est écrit, ou l'autre paquet de l'expéditeur est forcé. */
const REPONSES_SUR_MESURE = {
  ph7: { options: [
    o('plan', 'Suivre son plan de récupération', 'Toute l\'équipe retrouve ses jambes', 'Des entraînements allégés : moins de précision', { action: { energieTous: 15 }, finition: 0.95, duree: 4 }),
    o('serrer', 'Serrer les dents jusqu\'aux séries', 'Un vestiaire qui s\'endurcit', 'Les corps paient : plus de blessures', { finition: 1.06, blessure: 1.25, energie: 1.08, duree: 5 }),
  ] },
  ad7: { options: [
    o('tableau', 'Suivre son tableau vert', 'Les premiers trios se ménagent', 'Moins de talent sur la glace : moins de lancers', { F: [0.93, 1.02, 1.04, 1.04], blessure: 0.82, volume: 0.96, duree: 5 }),
    o('serrer', 'Serrer la vis aux premiers trios', 'Tes meilleurs jouent plus', 'Ils s\'usent', { F: [1.12, 1.02, 0.97, 0.88], energie: 1.14, duree: 5 }),
  ] },
  ag2: { cible: 'vedette', options: [
    o('glace', 'Lui donner plus de glace', '{nom} joue plus et il le sait', 'Les autres trios jouent moins', { F: [1.1, 1.02, 0.96, 0.9], energie: 1.15, duree: 5 }),
    o('patience', 'Lui demander de la patience', '{nom} veut le prouver : plus de précision', 'Il force les mises en échec : plus de punitions', { finition: 1.05, discipline: 1.15, duree: 5 }),
  ] },
};
const PAQUET_FORCE = { ag4: 1 };

/** Toutes les réponses, par id de courriel (`eq4`) ou d'échange (`e17`) : { ico, titre, cible?, options } — la forme d'un dilemme. */
export const REPONSES_VIE = Object.fromEntries([
  ...COURRIELS.map(x => {
    const paquets = PAQUETS_COURRIEL[x.de];
    const p = REPONSES_SUR_MESURE[x.id] || paquets[PAQUET_FORCE[x.id] ?? Number(x.id.replace(/\D/g, '')) % 2];
    return [x.id, { ico: EXPEDITEURS[x.de].ico, titre: remplir(x.sujet), ...p }];
  }),
  ...ECHANGES.map(e => [e.id, { ico: '🎤', titre: 'Le point de presse', ...(e.cible ? { cible: e.cible } : {}), options: e.options }]),
]);

/*
 * LE FAIT QU'UN DILEMME AFFIRME (V3). JP : *faudrait que ça soit vrai qu'il a eu trois pénalités en deux
 * matchs*. Les dilemmes sont des entrées de `MOMENTS` (js/sim.js) : chacun porte son `fait` (`FAITS`, js/sim.js),
 * et `momentDuJour` ne tire que ceux dont le fait est vrai.
 */
export const PUNITIONS_SERMON = 3;
/*
 * LE JOUEUR DU FAIT (V11, tranche 5 — docs/refonte-v11.md). JP : *l'interview vise un joueur quand le fait vient de
 * lui*. La question vise celui dont le fait vient, lu dans les feuilles qu'elle raconte (`feuilles` : [{ f, cote }],
 * dans l'ordre) : le gardien qui a reçu les tirs du dernier soir, le meilleur pointeur, celui qui a pris le plus de
 * punitions — parmi `habilles` (un Set). Personne dans les feuilles : null, et la question garde sa cible d'avant
 * (`ciblesDe`, js/sim.js). Rend { p, fait }, le fait en vrais chiffres. Pur.
 */
export function joueurDuFait(sorte, feuilles, habilles) {
  const compter = (liste, f) => { const n = new Map(); for (const x of liste) { const p = f(x); if (p && habilles.has(p)) n.set(p, (n.get(p) || 0) + 1); } return [...n].sort((a, b) => b[1] - a[1])[0] || null; };
  if (sorte === 'gardien') {
    const der = feuilles[feuilles.length - 1];
    const g = der && compter((der.f.lancers || []).filter(l => l.cote !== der.cote), l => l.gardien);
    if (!g) return null;
    const buts = (der.f.buts || []).filter(b => b.cote !== der.cote && b.gardien === g[0]).length;
    return { p: g[0], fait: `${g[0].n} : ${buts} but${buts > 1 ? 's' : ''} sur ${g[1]} tirs ce soir-là` };
  }
  if (sorte === 'vedette') {
    const v = compter(feuilles.flatMap(({ f, cote }) => (f.buts || []).filter(b => b.cote === cote).flatMap(b => [b.marqueur, ...(b.passeurs || [])])), p => (p && p.p !== 'G' ? p : null));
    return v ? { p: v[0], fait: `${v[0].n} : ${v[1]} point${v[1] > 1 ? 's' : ''} en ${feuilles.length} matchs` } : null;
  }
  if (sorte === 'dur') {
    const d = compter(feuilles.flatMap(({ f, cote }) => (f.punitions || []).filter(x => x.cote === cote)), x => x.joueur);
    return d ? { p: d[0], fait: `${d[0].n} : ${d[1]} punition${d[1] > 1 ? 's' : ''} en ${feuilles.length} matchs` } : null;
  }
  return null;
}

/*
 * LES FILS DE LA SAISON, DITS PAR QUELQU'UN (V3.3). Le fil qui a fait la une hier soir (`filsDeSaison`,
 * js/recit.js) arrive dans la boîte d'une voix qui a une raison d'en parler : la course et le duo, l'analyste ;
 * le Cheechoo et la séquence, les partisans ; le jalon, le proprio ; la disette, l'entraîneur, puis le joueur
 * lui-même quand elle finit ; la recrue, le capitaine ; le retour, le physio. Le FAIT est celui du fil, au
 * caractère près (check_fils le recompte) ; la voix ajoute une opinion, jamais un chiffre.
 */
const VOIX_DES_FILS = {
  course: { de: 'an', mots: ['À ce rythme-là, on va parler de {nom} jusqu\'au printemps.', 'Les gardiens de la ligue commencent à voir {nom} dans leur soupe.', 'Je l\'ai dit en ondes et je le répète : surveillez {nom}.', '{nom} joue avec l\'aplomb d\'un gars qui sait où est le filet.'] },
  feu: { de: 'pt', mots: ['On scande son nom dans les gradins. Personne n\'avait vu ça venir.', 'Les gradins se lèvent dès qu\'il saute sur la glace.', 'Un joueur de soutien qui fait lever la foule : on ne s\'en lasse pas.'] },
  jalon: { de: 'pr', mots: ['Mes félicitations à {nom}. Ce genre de soirée fait vendre des billets.', 'Transmettez mes félicitations au vestiaire, et à {nom} en premier.', 'On se souviendra de cette soirée. Je fais encadrer la feuille de match.'] },
  sequence: { de: 'pt', mots: ['Les gradins attendent {nom} à chaque présence.', 'Chaque soir, on se demande si ce sera le bon. Et chaque soir, il répond.'], fin: { de: 'an', mots: ['Toutes les séquences finissent un jour. Ce qui compte, c\'est la suivante.', 'Belle séquence. Reste à voir s\'il repart tout de suite.'] } },
  disette: { de: 'en', mots: ['Je le garde où il est. Les rondelles vont finir par rentrer.', 'Il travaille. Je ne change rien pour l\'instant, mais je regarde.', 'Ce n\'est pas la volonté qui manque. C\'est la rondelle qui ne veut pas.'], fin: { de: 'joueur', mots: ['Enfin. Je dormais mal.', 'Ça fait du bien. Merci aux gars de m\'avoir attendu.', 'Je ne comptais plus. Les journalistes, eux, comptaient.'] } },
  duo: { de: 'an', mots: ['Ces deux-là se trouvent les yeux fermés.', '{passeur} lui dépose la rondelle sur la palette ; il n\'a qu\'à finir.', 'Séparer {nom} et {passeur} ? Je ne m\'y risquerais pas.'] },
  recrue: { de: 'ca', mots: ['Le petit n\'a peur de rien. On l\'aime bien dans le vestiaire.', 'Il pose des questions et il écoute les réponses. Ça paraît.', 'Il joue comme s\'il avait dix ans dans la ligue.'] },
  retour: { de: 'ph', mots: ['Le corps a tenu. On le surveille encore quelques jours.', 'Il a fait tout ce qu\'on lui demandait pendant son absence. Ça paie.'] },
};

/*
 * LES FILS QUI REVIENNENT (V9, tranche 6 — docs/refonte-v9.md § 6.7). En Rogue, un fil fort ouvre un choix dans
 * À faire, dit par sa voix (`VOIX_DES_FILS`) : le Cheechoo, la disette, le duo, la recrue. Chaque option passe par les
 * canaux qui existent (une `action` sur le joueur nommé, un déplacement de cases, `monte`) et, souvent, engage un
 * SUIVI : `apres` matchs plus tard, le moteur relit les feuilles (`mesure` : ses buts, ses points, les buts du duo) et
 * pose ce que le seuil décide — `gagne` ou `perd`, des effets de quelques matchs sur le joueur nommé (`sur`), jamais
 * un dé (js/sim.js `retoursDuMatin`). Le retour se lit à la une, avec ses vrais chiffres (`texteDuRetour`).
 * Les mots : `{nom}` le joueur du fil, `{deplace}` celui qu'il déloge, `{passeur}` son passeur, `{vieux}` le vétéran mentor.
 */
export const CHOIX_DES_FILS = {
  feu: { ico: '🔥', titre: 'Le Cheechoo', question: 'Le monter au 1er trio ?',
    options: [
      { cle: 'monter', nom: 'Le monter au 1er trio', bon: 'Plus de glace au gars en feu', prix: '{deplace} descend à sa place', monte: true,
        suivi: { apres: 10, mesure: 'buts', seuil: 4, depuis: 'qu\'il est monté',
          gagne: { mot: 'il garde le feu', duree: 10, effets: [{ sur: 'joueur', finition: 1.4 }] },
          perd: { mot: '{deplace} demande à jouer', duree: 8, effets: [{ sur: 'deplace', finition: 0.6 }] } } },
      { cle: 'laisser', nom: 'Ne rien changer', bon: 'On ne brise pas ce qui marche', rien: true },
    ] },
  disette: { ico: '🥶', titre: 'La disette', question: 'Que faire de lui ?',
    options: [
      { cle: 'reposer', nom: 'Le reposer deux matchs', bon: 'Il revient la tête vidée', prix: 'Deux matchs sans lui', action: { absents: 2 },
        suivi: { apres: 8, mesure: 'buts', seuil: 2, depuis: 'son repos',
          gagne: { mot: 'la lancée revient', duree: 8, effets: [{ sur: 'joueur', finition: 1.4 }] } } },
      { cle: 'parler', nom: 'Lui parler', bon: 'Il sait que tu crois en lui', prix: 'S\'il ne marque pas, il doute',
        suivi: { apres: 8, mesure: 'buts', seuil: 2, depuis: 'votre discussion',
          gagne: { mot: 'il respire', duree: 8, effets: [{ sur: 'joueur', finition: 1.4 }] },
          perd: { mot: 'le doute s\'installe', duree: 8, effets: [{ sur: 'joueur', finition: 0.6 }] } } },
      { cle: 'laisser', nom: 'Le laisser jouer', bon: 'Les rondelles vont finir par rentrer', rien: true },
    ] },
  duo: { ico: '🤝', titre: 'Le duo', question: 'Les garder ensemble ?',
    options: [
      { cle: 'souder', nom: 'Les garder ensemble', bon: 'Un duo qu\'on nomme', prix: 'S\'il s\'essouffle, ils se tapent sur les nerfs',
        suivi: { apres: 10, mesure: 'duo', seuil: 3, depuis: 'qu\'on les garde ensemble',
          gagne: { mot: 'leur lien est nommé, pour la saison', duree: 82, effets: [{ sur: 'joueur', finition: 1.45 }, { sur: 'passeur', creation: 1.15 }] },
          perd: { mot: 'ils se lassent l\'un de l\'autre', duree: 6, effets: [{ sur: 'joueur', finition: 0.57 }, { sur: 'passeur', creation: 0.8 }] } } },
      { cle: 'laisser', nom: 'Ne rien promettre', bon: 'Chacun son jeu', rien: true },
    ] },
  recrue: { ico: '🐣', titre: 'La recrue', question: 'Lui faire confiance, ou le protéger ?',
    options: [
      { cle: 'confiance', nom: 'Lui faire confiance', bon: 'S\'il produit, il s\'impose pour la saison', prix: 'S\'il cale, un trou de mémoire',
        suivi: { apres: 10, mesure: 'points', seuil: 6, depuis: 'qu\'on lui fait confiance',
          gagne: { mot: 'il s\'impose pour de bon', duree: 82, effets: [{ sur: 'joueur', finition: 1.25, creation: 1.25 }] },
          perd: { mot: 'un trou de mémoire', duree: 6, effets: [{ sur: 'joueur', finition: 0.6, creation: 0.6 }] } } },
      { cle: 'proteger', nom: 'Le protéger', bon: 'Des jambes neuves', prix: 'Il apprend moins vite', action: { energie: 20 } },
      // V9 (tranche 7) : le vétéran mentor (`mentorTrio`, js/sim.js), le temps de la saison, sur la ligne de la recrue.
      { cle: 'mentor', nom: 'Le confier à {vieux}', bon: 'Sur la ligne du vétéran, son badge monte d\'un métal', prix: 'Il change de ligne', mentor: true },
    ] },
};
const UNITES_DU_SUIVI = { buts: 'but', points: 'point', duo: 'but' };
export const avecNoms = (t, x) => String(t || '').replace(/\{nom\}/g, x.nom || '').replace(/\{deplace\}/g, x.deplace || 'son remplaçant').replace(/\{passeur\}/g, x.passeur || 'son passeur').replace(/\{vieux\}/g, x.vieux || 'un vétéran');
/** L'engagement d'une option, en mots : « Dans 10 matchs, 4 buts : il garde le feu ; sinon, X demande à jouer. » */
export function motDuSuivi(s, x = {}) {
  if (!s) return '';
  const u = UNITES_DU_SUIVI[s.mesure], quoi = `${s.seuil} ${u}${s.seuil > 1 ? 's' : ''}${s.mesure === 'duo' ? ' sur ses passes' : ''}`;
  return avecNoms(`Dans ${s.apres} matchs, ${quoi} : ${s.gagne ? s.gagne.mot : 'rien de plus'}${s.perd ? ` ; sinon, ${s.perd.mot}` : ''}`, x);
}
/** Le retour, dit avec ses vrais chiffres, lus dans les feuilles : « Kudelski : 5 buts en 10 matchs depuis qu'il est monté. Il garde le feu. » */
export function texteDuRetour(s, gagne, n, x = {}) {
  const u = UNITES_DU_SUIVI[s.mesure], b = gagne ? s.gagne : s.perd;
  const quoi = `${n} ${u}${n > 1 ? 's' : ''}${s.mesure === 'duo' ? ` sur des passes ${x.passeur ? deNom(x.passeur) : 'de son passeur'}` : ''}`;
  const mot = b ? avecNoms(b.mot, x) : '';
  return `${x.nom} : ${quoi} en ${s.apres} matchs depuis ${s.depuis}.${mot ? ` ${mot[0].toUpperCase()}${mot.slice(1)}.` : ''}`;
}
/** Un suivi en cours, en une ligne de vrais chiffres : « 🐣 La recrue · Demitra : 3 / 6 points · 4/10 matchs ». */
export function motDuSuiviEnCours(x) {
  const u = UNITES_DU_SUIVI[x.suivi.mesure];
  return `${x.ico} ${x.titre} · ${nomCourt(x.joueur.n)} : ${x.n} / ${x.suivi.seuil} ${u}${x.suivi.seuil > 1 ? 's' : ''} · ${x.joues}/${x.suivi.apres} matchs`;
}
/** La voix qui raconte le retour d'un fil : celle du fil. */
export const voixDuFil = sorte => (VOIX_DES_FILS[sorte] || {}).de || 'an';

/** Le message d'un fil : { de, sujet, mot } — `sujet` est le fait du fil, `mot` ce qu'en dit sa voix. */
export function messageDuFil(a) {
  const v0 = VOIX_DES_FILS[a.sorte];
  const v = a.fini && v0.fin ? v0.fin : v0;
  const de = v.de === 'joueur' ? { ico: '🏒', nom: a.joueur.n } : EXPEDITEURS[v.de];
  const mot = v.mots[Math.floor(graine(`${a.texte}|${a.jour}`) * v.mots.length) % v.mots.length]
    .replace(/\{nom\}/g, nomCourt(a.joueur.n)).replace(/\{passeur\}/g, a.passeur ? nomCourt(a.passeur.n) : '');
  return { de, sujet: a.texte, mot };
}
