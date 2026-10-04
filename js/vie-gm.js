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
 *   DILEMMES   des choix forcés dans le MÊME format que `MOMENTS` (js/sim.js) :
 *              une option porte ses canaux (finition, volume, defense,
 *              discipline, blessure, energie, F, D), sa durée en matchs, ou un
 *              `pari`, un `ensuite`, une `action` — rien de neuf, et dans les
 *              amplitudes des dilemmes voisins. Le texte dit ce que l'effet fait.
 *   ECHANGES   la causerie ou le point de presse d'après-match : une ouverture
 *              sérieuse, la question d'un journaliste, la réponse laconique.
 *
 * Tout est PUR : le même contexte et la même graine redonnent le même tirage
 * (comme js/recit.js), sans `hasard()` — le moteur ne consomme pas un dé de plus.
 *
 * contexte : { moment, etat: [], eq, autre, deja: [] }
 *   moment  camp · octobre · decembre · echeance · mars · series · elimination · coupe
 *   etat    sequence (victoires de suite) · panne (défaites de suite)
 *           · plafond (la marge est mince) · blesses (l'infirmerie est pleine)
 */

/** Hachage stable d'une chaîne (le même que js/recit.js), pour tirer sans hasard vivant. */
function graine(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const MOMENTS_DE_SAISON = ['camp', 'octobre', 'decembre', 'echeance', 'mars', 'series', 'elimination', 'coupe'];

/** Qui écrit : l'icône et le nom que la boîte affiche (`m.de`). */
const EXPEDITEURS = {
  pr: { ico: '🏢', nom: 'Le propriétaire' },
  fi: { ico: '🧾', nom: 'Le directeur des finances' },
  ad: { ico: '🎯', nom: 'Ton adjoint' },
  ag: { ico: '🤝', nom: 'Un agent de joueur' },
  ph: { ico: '🩺', nom: 'Le physio' },
  eq: { ico: '🧦', nom: 'Le préposé à l\'équipement' },
  co: { ico: '📢', nom: 'Le service des communications' },
  li: { ico: '🪪', nom: 'La ligue' },
  pa: { ico: '🧣', nom: 'Un partisan fidèle' },
  ma: { ico: '🗳️', nom: 'Le maire' },
};

const TOUS = MOMENTS_DE_SAISON.join(' ');
const mots = s => (s === 'tous' ? TOUS : s).split(' ').filter(Boolean);

/** Remplit les gabarits {eq} et {autre} ; un gabarit sans valeur reste vide. */
function remplir(texte, c = {}) {
  return String(texte).replace(/\{(\w+)\}/g, (_, k) => (c[k] != null ? c[k] : ''));
}

/** Tirage déterministe : le rang d'une pièce se lit sur la graine, le contexte et son id. */
const rang = (graineDuJeu, c, id) => graine(`${graineDuJeu}|${c.moment}|${(c.etat || []).join(',')}|${id}`);

/* ======================================================================
   LES COURRIELS
   [expéditeur, moments, états, objet, corps]
   ====================================================================== */
const COURRIELS_BRUTS = [
  // ---- Le propriétaire (il vouvoie) ----
  ['pr', 'camp', '', 'Orientations pour l\'exercice à venir',
    'Comme discuté lors de ma sieste, je souhaite que {eq} adopte cette saison une posture résolument gagnante. Je n\'ai pas défini le terme, mais je le reconnaîtrai en le voyant. Veuillez me revenir avec un échéancier d\'ici la fin de la semaine.'],
  ['pr', 'camp', '', 'Mon fauteuil, loge 4',
    'Mon fauteuil de la loge 4 est incliné de deux degrés vers la gauche depuis l\'été. Je tiens à ce que cette situation n\'ait aucune incidence sur la composition de l\'équipe, sauf si elle en a une. Je vous laisse en juger.'],
  ['pr', 'camp', '', 'Valeurs de l\'organisation',
    'J\'ai fait imprimer nos valeurs sur une banderole : rigueur, audace et prudence. Il m\'a été signalé que ces trois valeurs se contredisent. Je vous invite à les concilier avant le match d\'ouverture.'],
  ['pr', 'octobre', '', 'Début de saison : lecture du propriétaire',
    'J\'ai regardé les premiers matchs avec attention et j\'ai noté que les joueurs patinent dans plusieurs directions à la fois. Je ne remets pas la chose en question ; je souhaite seulement que la direction soit commune. Merci de m\'indiquer laquelle.'],
  ['pr', 'octobre decembre', '', 'Le café de la salle de presse',
    'Le café servi à la salle de presse est, selon mes sources, tiède. Je vous demande de ne voir aucun lien avec notre rendement, tout en gardant l\'œil dessus. Un suivi hebdomadaire de la température serait apprécié.'],
  ['pr', 'decembre', '', 'Bilan à mi-parcours',
    'À mi-parcours, je constate que la saison est à peu près à moitié faite. Cette symétrie me rassure. Je souhaite en discuter à votre convenance, de préférence à mon heure de dîner.'],
  ['pr', 'decembre', '', 'Cartes de souhaits',
    'Le carton des Fêtes est parti à tous nos partenaires. Une erreur d\'impression a placé votre nom sous la mention « mascotte ». J\'ai jugé qu\'une correction ferait plus de bruit que l\'erreur, et j\'ai laissé aller.'],
  ['pr', 'echeance', '', 'Date limite des transactions',
    'La date limite approche et je n\'ai reçu aucune note sur vos intentions. Je comprends que le silence est parfois une stratégie ; je voudrais seulement savoir laquelle. Je serai à mon bureau, ou chez moi, ce qui revient au même.'],
  ['pr', 'mars', '', 'La poussée finale',
    'Les semaines qui viennent sont déterminantes, ou le deviendront. Je vous demande de maintenir un haut niveau d\'exigence et de me signaler le moment où vous le maintiendrez. Je mettrai le signalement au dossier.'],
  ['pr', 'series', '', 'Les séries et moi',
    'Pendant les séries, je cesse de regarder les matchs en direct et je les écoute depuis le garage. Cette procédure a fait ses preuves à une occasion. Je vous remercie de ne rien faire qui la perturbe.'],
  ['pr', 'elimination', '', 'Mot du propriétaire à la suite de l\'élimination',
    'Notre saison se termine plus tôt que prévu, ce qui est, au fond, une façon de la terminer. Je vous remercie de votre engagement. Une rencontre de débreffage aura lieu à une date que ma sieste déterminera.'],
  ['pr', 'coupe', '', 'Félicitations',
    'La Coupe est maintenant dans mon salon, où elle occupe l\'espace d\'une plante que j\'aimais. Je n\'ai aucun regret. Je vous invite à la regarder avec moi, à une distance raisonnable.'],
  ['pr', 'decembre echeance mars', 'sequence', 'Votre séquence',
    'La séquence victorieuse m\'a été signalée par trois personnes, dont le concierge. Je vous demande de ne rien changer à vos habitudes, y compris celles dont vous ignorez l\'existence. Je veillerai moi-même à ne pas m\'en mêler.'],
  ['pr', 'octobre decembre echeance mars', 'panne', 'Quelques préoccupations',
    'La séquence actuelle a suscité des questions dans mon entourage immédiat, soit ma sœur. Je lui ai répondu que vous aviez la situation en main. Je compte sur vous pour que cette réponse demeure exacte.'],
  ['pr', 'octobre decembre echeance mars', 'plafond', 'Rapport sur la marge salariale',
    'On m\'informe que la marge sous le plafond est mince. J\'ai fait mesurer la marge : elle est, en effet, mince. Je ne demande aucun miracle, seulement une gestion exemplaire.'],
  ['pr', 'octobre decembre echeance mars', 'blesses', 'L\'infirmerie',
    'L\'infirmerie semble bien fréquentée. J\'ai demandé qu\'on y installe une plante ; j\'ai lu que cela favorise la guérison. Merci de coordonner la chose avec le physio.'],

  // ---- Le directeur des finances (il vouvoie) ----
  ['fi', 'camp', '', 'Budget de fonctionnement : première version',
    'Le budget de fonctionnement a été déposé en trois exemplaires, dont un a été retrouvé. Les postes « déplacements » et « rondelles » affichent une progression que je qualifierais de franche. Je vous invite à la commenter avant qu\'elle ne devienne une habitude.'],
  ['fi', 'camp octobre', '', 'Rondelles : état des stocks',
    'Nous avons consommé davantage de rondelles que prévu à l\'inventaire d\'avant-saison. La rondelle étant par nature un objet qui sort de la patinoire, la chose n\'est pas anormale. Je souhaite néanmoins une justification, par écrit, de chaque rondelle manquante.'],
  ['fi', 'octobre', '', 'Politique des pièces justificatives',
    'Un reçu de dix-sept dollars, intitulé « motivation », a été soumis par le personnel d\'entraîneurs. Je n\'ai pas de case pour ce poste. Je vous demande de préciser ce que l\'on a motivé et dans quelle mesure.'],
  ['fi', 'decembre', '', 'Prévisions de fin d\'exercice',
    'Mes prévisions de fin d\'exercice reposent sur trois hypothèses, dont deux sont de moi. Si l\'équipe se qualifie pour les séries, les revenus augmentent ; sinon, ils diminuent. Cette analyse est, à ma connaissance, sans précédent.'],
  ['fi', 'decembre', '', 'Frais de glace',
    'La facture d\'entretien de la glace comprend une ligne « lissage » dont personne ne se souvient d\'avoir demandé l\'exécution. J\'ai posé la question au responsable, qui a répondu que la glace est lisse. Je considère le dossier ouvert.'],
  ['fi', 'echeance', '', 'Incidence budgétaire d\'un échange',
    'Tout échange de dernière minute devra être accompagné d\'une note budgétaire d\'une page, comprenant un tableau. Le tableau pourra être sommaire, mais il devra exister. Je me tiens disponible pour valider le gabarit.'],
  ['fi', 'echeance mars', 'plafond', 'Marge sous le plafond : état de la situation',
    'La marge sous le plafond est mince au point que j\'ai dû la mesurer deux fois. Je recommande de ne pas ajouter de contrat sans en retirer un autre de valeur équivalente. À défaut, je préparerai un tableau, qui n\'aidera pas, mais qui sera clair.'],
  ['fi', 'octobre decembre', 'plafond', 'Contrats : rappel de prudence',
    'Le plafond salarial est une limite et non une suggestion, comme me le répète la ligue chaque trimestre. Notre marge actuelle ne laisse place à aucune fantaisie. Les fantaisies, le cas échéant, devront être déposées en trois exemplaires.'],
  ['fi', 'mars', '', 'Droits de diffusion : mise à jour',
    'Les droits de diffusion progressent. Je ne saurais dire dans quelle direction, mais je peux affirmer qu\'ils progressent. Je vous tiendrai informé dès que j\'aurai compris le rapport.'],
  ['fi', 'series', '', 'Revenus de séries : première estimation',
    'Chaque match de séries à domicile génère des revenus supplémentaires, ce que j\'indique sans enthousiasme excessif. Je prévois un budget de nettoyage pour les débris de confettis, de pieuvres et de rancœurs. Merci de ne pas exiger d\'en savoir plus.'],
  ['fi', 'elimination', '', 'Bilan financier de la saison',
    'Le bilan de la saison est terminé, ou presque, ce qui est un état que je trouve apaisant. Les revenus de séries seront inférieurs à ce que j\'avais espéré, mais supérieurs à ce que j\'avais craint. Je recommande de ne pas relire cette phrase.'],
  ['fi', 'coupe', '', 'Le défilé : projection des coûts',
    'La victoire de la Coupe entraîne des dépenses imprévues, dont un défilé, des chandails commémoratifs et une réception. J\'ai ajouté une ligne « euphorie » au budget, que j\'ai fixée à un montant raisonnable. Ce montant sera dépassé.'],
  ['fi', 'decembre echeance mars', 'blesses', 'Primes d\'assurance',
    'Le nombre de blessés a une incidence sur nos primes d\'assurance, que l\'assureur a décrite comme « sensible ». J\'ai demandé à l\'assureur de préciser le sens du mot. Je vous reviendrai avec sa définition.'],

  // ---- L'adjoint (il tutoie) ----
  ['ad', 'camp', '', 'Plan de match, première version',
    'J\'ai préparé un plan de match pour la saison au complet. Il tient en une page recto verso, et le verso est surtout un dessin de patinoire. Dis-moi quand tu veux le passer en revue.'],
  ['ad', 'camp octobre', '', 'Les trios, encore',
    'J\'ai repensé les trios toute la nuit, sans me coucher. Je pense avoir une conclusion, mais elle dépend de ce que je penserai demain. On en parle quand tu veux, de préférence avant.'],
  ['ad', 'octobre', '', 'Observation sur le jeu de puissance',
    'En avantage numérique, nos joueurs se passent la rondelle avec une patience que je trouve admirable. Je note toutefois qu\'elle ne se rend pas au filet. Je propose d\'en discuter calmement, avec un tableau.'],
  ['ad', 'octobre decembre', '', 'Vidéo : la séance du mardi',
    'J\'ai monté dix-neuf minutes de vidéo sur l\'échec-avant. Les trois dernières minutes montrent surtout le concierge qui entre dans le local. Je les ai laissées, par souci d\'authenticité.'],
  ['ad', 'decembre', '', 'Rapport d\'étape',
    'À mi-saison, je constate que nous gagnons des matchs et que nous en perdons, dans des proportions que je juge équilibrées. Je recommande de continuer à gagner davantage que nous ne perdons. C\'est une piste.'],
  ['ad', 'echeance', '', 'Liste des besoins',
    'J\'ai dressé la liste de nos besoins avant la date limite. Elle comprend un défenseur, un attaquant et une certaine paix d\'esprit. Je suis conscient que la troisième n\'est pas disponible à l\'échange.'],
  ['ad', 'mars', '', 'Gestion des minutes',
    'À cette période de la saison, je recommande de surveiller attentivement le temps de glace de nos premiers trios. J\'ai fait un tableau de trois couleurs. La couleur verte signifie que tout va bien ; la rouge, que je dois te parler.'],
  ['ad', 'series', '', 'Préparation de la série',
    'J\'ai visionné cinq matchs de l\'adversaire et je peux affirmer qu\'il joue au hockey. Il le fait avec méthode, ce qui complique les choses. Je propose que nous fassions de même.'],
  ['ad', 'elimination', '', 'Réflexions de fin de saison',
    'J\'ai rédigé quarante pages sur ce qui n\'a pas fonctionné. J\'en ai retiré trente-huit, par délicatesse. Les deux pages restantes sont à ta disposition, quand tu auras le cœur de les lire.'],
  ['ad', 'coupe', '', 'Le plan du verso',
    'Je t\'écris à voix basse parce que ma famille dort encore. Je tenais à te dire que le plan de match du verso, finalement, semble avoir fonctionné. Je n\'avais pas osé le croire.'],
  ['ad', 'octobre decembre echeance mars series', 'sequence', 'Ne touche à rien',
    'Nous gagnons, et je ne sais pas pourquoi. Je te propose donc de ne rien changer, y compris l\'ordre dans lequel nous entrons au vestiaire. J\'ai déjà prévenu le préposé à l\'équipement.'],
  ['ad', 'octobre decembre echeance mars series', 'panne', 'Analyse de la séquence en cours',
    'Nous perdons depuis quelques matchs et j\'ai identifié trois causes, dont deux sont contradictoires. Je te propose de les écarter toutes les trois et de continuer à chercher. J\'ai déjà réservé la salle de réunion.'],
  ['ad', 'octobre decembre echeance mars series', 'blesses', 'Avec ce qui reste',
    'Notre liste de blessés est assez longue pour être lue à voix haute. J\'ai préparé des lignes avec ce qui reste. Elles tiennent debout, sous certaines conditions que je préfère te présenter en personne.'],

  ['ad', 'octobre decembre echeance mars', 'plafond', 'Un joueur de plus ?',
    'Je sais que la marge est mince, mais je te signale qu\'il nous manque un défenseur. J\'ai fait le calcul de tête, puis sur papier, puis avec le directeur des finances, qui m\'a regardé en silence. Je laisse la réponse à ta discrétion.'],
  ['eq', 'octobre decembre echeance mars', 'plafond', 'Économies de ruban adhésif',
    'On m\'a demandé de réduire mes dépenses, ce que j\'ai fait en rallongeant la vie des bâtons. Le ruban adhésif tient désormais ce que le budget ne tient plus. Je te demande seulement de ne pas regarder le talon des patins.'],
  ['co', 'decembre echeance mars', 'plafond', 'Message sur la masse salariale',
    'Nous recevons des questions sur la marge de l\'équipe sous le plafond. Notre position est la suivante : la marge est « adéquate ». Nous vous prions de ne pas préciser le sens de ce mot.'],

  // ---- Un agent de joueur (il vouvoie) ----
  ['ag', 'camp', '', 'À propos de mon client',
    'Mon client souhaite vous rappeler qu\'il a pris la meilleure forme de sa vie cet été, ce qui, selon lui, mérite une considération. Il a notamment cessé de manger des chaussons aux pommes à partir de juillet. Je vous joins une photo qu\'il juge parlante.'],
  ['ag', 'octobre', '', 'Temps de glace',
    'Mon client trouve que son temps de glace ne correspond pas à son niveau d\'implication. Il m\'a demandé de vous le dire poliment, et je m\'exécute poliment. Je reste disponible pour tout échange, y compris un échange de courriels.'],
  ['ag', 'octobre decembre', '', 'Préférence de position',
    'Mon client a une préférence pour jouer sur son côté fort. Il n\'a jamais précisé lequel, mais il est formel sur le principe. Je vous invite à l\'interroger directement, avec prudence.'],
  ['ag', 'decembre', '', 'Prolongation de contrat',
    'Mon client serait ouvert à une prolongation, sous réserve qu\'elle soit à son avantage. Il ajoute qu\'il aime la ville, ses restaurants et un stationnement précis. Je vous transmets ces éléments tels quels.'],
  ['ag', 'decembre', '', 'Un mot sur le vestiaire',
    'Mon client juge que la place de son casier ne reflète pas son apport au club. Il l\'aimerait plus près de la porte, ou plus loin, selon l\'humeur du jour. Je vous demande d\'y réfléchir avant le prochain voyage.'],
  ['ag', 'echeance', '', 'Rumeurs d\'échange',
    'Mon client a lu qu\'il pourrait être échangé et me demande d\'obtenir une précision de votre part. Il précise qu\'il n\'a aucune préférence de destination, sauf une ville où il y a un bon boulanger. Je vous remercie de votre franchise.'],
  ['ag', 'echeance mars', 'plafond', 'Valeur de marché',
    'Je comprends que votre marge salariale est limitée, ce qui ne change rien à la valeur de mon client. Il suggère de l\'équilibrer en déplaçant un autre contrat, de préférence celui de quelqu\'un que je ne représente pas. Il se dit prêt à la discussion.'],
  ['ag', 'mars', '', 'Rendement en fin de saison',
    'Mon client a le sentiment d\'atteindre son sommet à la fin de la saison. Il me demande de vous préciser que ce sentiment est constant depuis trois ans. Je vous laisse en tirer vos conclusions.'],
  ['ag', 'series', '', 'Motivation en séries',
    'Mon client vit pour cette période de l\'année, comme il me le répète chaque matin. Il demande à ne pas être dérangé pendant la série, y compris par moi. Je vous écris donc maintenant, par avance.'],
  ['ag', 'elimination', '', 'Bilan avec mon client',
    'Mon client a quitté sa résidence d\'été avec le sentiment du devoir accompli, ce qui est une impression qu\'il est seul à avoir. Il souhaite une rencontre pour faire le point. Il suggère un restaurant, qu\'il connaît bien.'],
  ['ag', 'coupe', '', 'Mon client et la Coupe',
    'Mon client a passé la nuit avec la Coupe et souhaite que cela figure à son dossier. Il m\'a aussi demandé de vous informer qu\'il n\'a rien brisé, ou presque. Il se tient à votre disposition pour une discussion sur sa valeur nouvelle.'],
  ['ag', 'decembre echeance mars series', 'sequence', 'Les chiffres de mon client',
    'Les victoires de l\'équipe s\'accumulent, et mon client souhaite qu\'on reconnaisse sa part dans la séquence. Il l\'estime à une proportion qu\'il garde pour lui. Je vous suggère d\'engager un dialogue constructif.'],
  ['ag', 'octobre decembre echeance mars', 'panne', 'Un mot de réconfort',
    'Mon client s\'inquiète de la séquence actuelle et souhaite que vous sachiez qu\'il n\'y est pour rien. Il propose néanmoins d\'aider, sans préciser comment. Il compte sur votre confiance.'],

  // ---- Le physio (il tutoie) ----
  ['ph', 'camp', '', 'Bilan de santé de la recrue',
    'J\'ai terminé les évaluations d\'avant-saison. Tout le monde est en forme, sauf ceux qui ne le sont pas, que je ne nommerai pas ici. J\'aimerais un local plus grand pour les étirements, ou un étirement plus court.'],
  ['ph', 'camp octobre', '', 'Étirements : nouvelle consigne',
    'J\'ai rédigé une nouvelle consigne d\'étirements, en neuf points. Le point 7 recommande de s\'étirer avant de s\'étirer. J\'en suis assez fier et je compte sur ton appui.'],
  ['ph', 'octobre', '', 'Hydratation',
    'Plusieurs joueurs boivent de l\'eau, mais pas nécessairement au bon moment. J\'ai établi un horaire de gorgées, qui sera affiché au vestiaire. Merci de le faire respecter, sans le lire à voix haute.'],
  ['ph', 'decembre', '', 'La saison des rhumes',
    'Le vestiaire est rendu à la période où tout se transmet : les rhumes, les superstitions et les chansons. Je ne peux agir que sur les deux premiers. Merci de ne pas encourager la troisième.'],
  ['ph', 'decembre echeance', '', 'Rapport sur les jambes',
    'Les jambes de l\'équipe sont, globalement, au nombre de deux par joueur, et c\'est une bonne nouvelle. Leur état varie selon les voyages et la qualité des sièges d\'avion. Je te transmets un schéma qui explique tout, sauf le plus important.'],
  ['ph', 'echeance', '', 'Ce que je dis au médecin de l\'autre équipe',
    'Lors des discussions d\'échange, je suis parfois appelé à commenter l\'état d\'un joueur. Je m\'en tiens aux faits, que je formule avec le moins d\'adjectifs possible. Tu peux compter sur ma discrétion et sur ma sobriété.'],
  ['ph', 'mars', '', 'Fatigue accumulée',
    'La fatigue de fin de saison s\'accumule comme la neige sur un stationnement : sans bruit, puis tout d\'un coup. J\'ai préparé un plan de récupération. Il comprend du repos, ce qui n\'est pas un secret, mais que j\'estime sous-utilisé.'],
  ['ph', 'series', '', 'Protocole de séries',
    'En séries, les joueurs jouent avec des blessures qu\'ils appellent « de petits bobos » et que je classe en trois catégories. J\'ai affiché les catégories au vestiaire, sans les noms. Merci de ne pas demander lesquels.'],
  ['ph', 'elimination', '', 'Bilan médical de fin de saison',
    'Les examens de fin de saison commenceront lundi. Je vous demande de rappeler aux joueurs que l\'été n\'est pas une raison pour ne pas se présenter. Ceux qui ont des douleurs depuis octobre les mentionneront maintenant, j\'espère.'],
  ['ph', 'coupe', '', 'Après la Coupe',
    'Les joueurs ont soulevé la Coupe à tour de rôle, certains plusieurs fois. J\'ai donc ajouté à mon bilan une rubrique « épaules ». Je recommande une semaine de repos, qu\'ils jugeront trop longue.'],
  ['ph', 'octobre decembre echeance mars series', 'blesses', 'État de l\'infirmerie',
    'L\'infirmerie est pleine, ce que j\'indique sans reproche. J\'ai remplacé la deuxième civière par une chaise, qui a plutôt bien fonctionné. Je te tiens au courant des retours, au fur et à mesure.'],
  ['ph', 'octobre decembre echeance mars series', 'blesses', 'Retours de blessure : consignes',
    'Un joueur blessé qui dit qu\'il est prêt n\'est pas nécessairement prêt, et c\'est un principe auquel je tiens. Je les évalue donc un à un, avec un test de sauts et un test de sincérité. Merci de patienter.'],
  ['ph', 'decembre echeance mars series', 'sequence', 'Ne rien casser',
    'La séquence en cours est une excellente nouvelle pour tout le monde, sauf pour mon horaire. Chaque victoire donne aux joueurs l\'envie de jouer plus fort, ce qui produit des blessures. Je les surveille avec un enthousiasme modéré.'],

  // ---- Le préposé à l'équipement (il tutoie) ----
  ['eq', 'camp', '', 'Commande de bâtons',
    'La commande de bâtons est arrivée, avec trois courbes qui ne correspondent pas à ce qu\'on avait demandé. J\'ai laissé les boîtes devant le local en espérant que quelqu\'un s\'y reconnaisse. Passe voir quand tu peux.'],
  ['eq', 'camp octobre', '', 'Chandails neufs',
    'Les chandails de cette saison ont été livrés et ils sont d\'un tissu plus léger, ce que le fabricant appelle une « innovation ». J\'ai surtout remarqué qu\'ils sèchent plus vite. C\'est déjà quelque chose.'],
  ['eq', 'octobre', '', 'Lacets',
    'Il y a eu une consommation de lacets inhabituelle depuis le début du mois. Je n\'accuse personne, mais les lacets ne se défont pas tout seuls. Je commande une caisse supplémentaire et je garde un œil sur le vestiaire.'],
  ['eq', 'octobre decembre', '', 'Aiguisage des patins',
    'J\'ai aiguisé les patins de tout le monde, dans l\'ordre et sans bruit. Un joueur m\'a dit qu\'il ne sent aucune différence, ce que je prends pour un compliment. Je continue à ce rythme.'],
  ['eq', 'decembre', '', 'La sécheuse',
    'La sécheuse du vestiaire a rendu l\'âme un mardi, vers dix heures. Elle a servi loyalement pendant onze saisons et je souhaite que son départ soit consigné. J\'en ai commandé une autre, qui ne sera pas la même.'],
  ['eq', 'decembre echeance', '', 'Gants perdus',
    'Un gant gauche est introuvable depuis le voyage de la semaine dernière. Je l\'ai cherché dans l\'autobus, dans l\'avion et dans ma mémoire. Si quelqu\'un le retrouve, qu\'il le dépose sur la table du fond, sans commentaire.'],
  ['eq', 'echeance', '', 'Chandails d\'un nouveau venu',
    'Si un nouveau joueur arrive avant la date limite, il faudra lui trouver un numéro. Plusieurs sont déjà portés, et deux sont retirés. Je te propose le 88, sauf s\'il est pris, auquel cas le 89.'],
  ['eq', 'mars', '', 'Usure du matériel',
    'À cette période de l\'année, le matériel a l\'air de ce qu\'il est : un matériel utilisé depuis octobre. Je répare ce que je peux avec du ruban adhésif, qui est notre meilleur allié. Il en reste deux rouleaux.'],
  ['eq', 'series', '', 'Superstitions : inventaire',
    'J\'ai recensé les superstitions de séries du vestiaire. Il y en a quatorze, dont trois qui se contredisent. Je les respecte toutes, dans l\'ordre d\'arrivée.'],
  ['eq', 'elimination', '', 'Rangement de fin d\'année',
    'J\'ai commencé à ranger le vestiaire et j\'ai découvert, derrière un casier, un sandwich datant de décembre. Je l\'ai remis à qui de droit, c\'est-à-dire à personne. Les casiers seront vidés d\'ici vendredi.'],
  ['eq', 'coupe', '', 'La Coupe et le local',
    'La Coupe est passée par le local d\'équipement et j\'ai pu la polir moi-même. Je n\'ai jamais été aussi calme. Je te demande simplement de ne pas me poser de questions pendant une journée.'],
  ['eq', 'decembre echeance mars series', 'sequence', 'On ne lave pas',
    'Il est de notoriété publique qu\'on ne lave pas ce qu\'on portait durant une séquence de victoires. J\'ai donc suspendu certains lavages, par prudence. Je te laisse le soin d\'en informer l\'odorat de chacun.'],
  ['eq', 'octobre decembre echeance mars', 'panne', 'Le chandail de la séquence',
    'On m\'a demandé d\'échanger les chandails du dernier match contre des neufs, pour « changer la chance ». Je l\'ai fait avec sérieux. Les anciens sont suspendus dans un coin, en observation.'],
  ['eq', 'octobre decembre echeance mars series', 'blesses', 'Casiers vides',
    'Plusieurs casiers sont vides depuis quelques semaines, ce qui crée un certain écho. J\'ai conservé l\'équipement de chaque blessé en bon état, avec son nom bien en vue. Il faudra les remplir avant le prochain voyage.'],

  // ---- Le service des communications (il vouvoie) ----
  ['co', 'camp', '', 'Ligne éditoriale de la saison',
    'Le service des communications a adopté une ligne éditoriale pour la saison : sobriété, clarté et un certain enthousiasme contenu. Nous demandons à l\'équipe de respecter cette ligne, y compris dans les gestes. Un gabarit de réponses vous sera transmis sous peu.'],
  ['co', 'camp octobre', '', 'Gabarit de réponses aux médias',
    'Vous trouverez ci-joint douze réponses types à utiliser en entrevue : « un match à la fois », « on y va avec ce qu\'on a », et dix autres. Nous recommandons de ne pas les combiner. Une formation de cinq minutes est offerte à qui le souhaite.'],
  ['co', 'octobre', '', 'Photo d\'équipe',
    'La séance de photo d\'équipe aura lieu à la patinoire, à neuf heures. Veuillez demander aux joueurs de sourire, mais sans exagération. Nous avons convenu d\'un sourire dit « de confiance », que nous mettrons au point ensemble.'],
  ['co', 'octobre decembre', '', 'Infolettre des partisans',
    'L\'infolettre mensuelle a été envoyée à quarante mille abonnés, dont trois ont répondu. Les trois réponses étaient courtoises. Nous y voyons une réussite relative.'],
  ['co', 'decembre', '', 'Campagne des Fêtes',
    'La campagne des Fêtes comprend une vidéo de l\'équipe devant un sapin. Il a été convenu que le sapin ne doit pas être touché. Nous vous remercions de le rappeler au vestiaire.'],
  ['co', 'decembre echeance', '', 'Mascotte : mise au point',
    'La mascotte a effectué une interprétation du jeu en avantage numérique pendant l\'entracte, ce que le service qualifie de « libre ». Aucune plainte n\'a été reçue. Nous souhaitons toutefois encadrer la chose, avant qu\'elle ne devienne un numéro.'],
  ['co', 'echeance', '', 'Date limite : protocole de communication',
    'Le jour de la date limite, aucune déclaration ne doit être faite avant 15 h. Après 15 h, aucune non plus, sauf si elle est préparée. Nous demeurons à votre disposition pour toute reformulation.'],
  ['co', 'mars', '', 'Suivi des médias',
    'La couverture médiatique de {eq} a été jugée « abondante » par notre outil de mesure, qui produit également des graphiques. Les graphiques seront joints à notre rapport. Ils sont, pour la plupart, en couleur.'],
  ['co', 'series', '', 'Point de presse : consignes',
    'Pendant les séries, les points de presse se tiennent à heure fixe, dans la salle prévue à cette fin. Les joueurs sont invités à y répondre brièvement, et sans métaphore. Les métaphores sont à l\'origine de la majorité de nos incidents.'],
  ['co', 'elimination', '', 'Communiqué de fin de saison',
    'Un communiqué soulignant la fin de saison de {eq} sera diffusé demain. Il remercie les partisans, le personnel et la ville, dans cet ordre. Nous avons retiré le mot « malheureusement » à la demande du propriétaire.'],
  ['co', 'coupe', '', 'Plan de communication : la victoire',
    'Nous avons préparé un plan de communication en neuf étapes pour la célébration de la Coupe. L\'étape 4, « se réjouir », est prévue pour le lendemain matin. Nous vous demandons de ne pas la devancer.'],
  ['co', 'decembre echeance mars series', 'sequence', 'Gestion du succès',
    'La séquence de victoires de {eq} suscite un intérêt médiatique accru. Nous recommandons une attitude mesurée, sans excès de confiance ni de modestie. Le juste milieu, selon nos analyses, se situe à environ 40 % de sourire.'],
  ['co', 'octobre decembre echeance mars series', 'panne', 'Gestion de la période difficile',
    'La séquence de défaites de {eq} fait l\'objet d\'un suivi serré. Nous recommandons de répondre aux questions, mais de ne pas répondre aux conclusions. Une formation de dix minutes est offerte sur la différence.'],

  // ---- La ligue (elle vouvoie, ton de circulaire) ----
  ['li', 'camp', '', 'Circulaire 1 : calendrier de la saison',
    'Le calendrier de la saison est maintenant disponible. Il comprend tous les matchs prévus, à l\'exception de ceux qui seront ajoutés. Nous vous remercions de votre collaboration habituelle.'],
  ['li', 'camp octobre', '', 'Rappel : longueur des bâtons',
    'La ligue rappelle que la longueur maximale d\'un bâton est celle qui est inscrite au règlement. Elle précise que cette longueur n\'a pas changé depuis la dernière circulaire. Les équipes sont invitées à la vérifier avec un ruban à mesurer.'],
  ['li', 'octobre', '', 'Avis sur la tenue vestimentaire',
    'Les joueurs sont priés de se présenter au match dans une tenue appropriée, c\'est-à-dire dans un chandail. L\'absence de chandail sera consignée au dossier. Nous nous attendons à ce que cette situation demeure exceptionnelle.'],
  ['li', 'octobre decembre', '', 'Précisions sur l\'interprétation d\'une règle',
    'Nous avons reçu plusieurs demandes d\'éclaircissement concernant la règle 56. Nous précisons que la règle 56 est la règle 56. Un document explicatif suivra, qui sera plus long que la règle.'],
  ['li', 'decembre', '', 'Pause des Fêtes',
    'La pause des Fêtes aura lieu aux dates prévues au calendrier. Les équipes sont invitées à utiliser ce temps pour se reposer, mais pas de façon ostentatoire. La ligue souhaite à tous un temps des Fêtes harmonieux.'],
  ['li', 'decembre echeance', '', 'Comité sur la vitesse des rondelles',
    'Un comité a été mis sur pied pour étudier la vitesse des rondelles. Il se réunira à une date qui sera communiquée une fois la vitesse connue. Les équipes sont invitées à ne rien lancer d\'ici là.'],
  ['li', 'echeance', '', 'Rappel : date limite des transactions',
    'La date limite des transactions est fixée à l\'heure prévue. Toute transaction conclue après l\'heure sera considérée comme conclue après l\'heure. Les équipes sont invitées à consulter l\'horloge officielle, qui est celle du siège social.'],
  ['li', 'echeance mars', 'plafond', 'Respect du plafond salarial',
    'La ligue rappelle aux équipes dont la marge est mince que le plafond s\'applique à tous, y compris à ceux qui n\'y avaient pas pensé. Un formulaire de vérification doit être rempli avant toute transaction. Il comporte quatre pages et une signature.'],
  ['li', 'mars', '', 'Calendrier des dernières semaines',
    'Le calendrier des dernières semaines est maintenant en vigueur. Nous rappelons que les matchs comptent également en mars. Cette précision a été demandée par plusieurs équipes.'],
  ['li', 'series', '', 'Avis aux équipes en séries',
    'Les équipes qualifiées sont invitées à respecter l\'horaire des matchs, des entrevues et des ascenseurs. Les ascenseurs de certains amphithéâtres sont lents, ce qui ne constitue pas un motif d\'excuse. La ligue vous souhaite de bonnes séries.'],
  ['li', 'elimination', '', 'Calendrier de l\'été',
    'La ligue rappelle que la saison est terminée pour les équipes qui ne participent plus aux séries. Le repêchage aura lieu comme prévu, et la période de signature, quand elle commencera. Nous vous remercions de votre participation.'],
  ['li', 'coupe', '', 'Gravure et protocole de la Coupe',
    'La ligue procédera à la gravure du nom de l\'équipe sur la Coupe, dans un délai qui dépend de l\'orfèvre. Elle rappelle que les erreurs d\'orthographe ne sont pas réversibles. Merci de vérifier la liste des noms trois fois.'],
  ['li', 'octobre decembre echeance mars', 'blesses', 'Protocole sur les blessures',
    'La ligue rappelle que toute blessure doit être déclarée à l\'équipe adverse, qui devra la lire sans commentaire. Le formulaire est joint au présent message. Il est volontairement bref.'],

  // ---- Un partisan fidèle (il vouvoie, poli et un peu long) ----
  ['pa', 'camp', '', 'Mon abonnement, vingt-deux ans',
    'Je suis abonné depuis vingt-deux ans, au même siège, derrière le même poteau. Je souhaite vous faire part de ma confiance dans l\'avenir de l\'équipe, qui est entière. Je vous demande seulement de faire déplacer le poteau.'],
  ['pa', 'camp octobre', '', 'Un gâteau pour le vestiaire',
    'Ma conjointe a préparé un gâteau pour les joueurs, qui sera déposé à l\'entrée des artistes. Il est à la vanille, sans noix. Je vous prie de transmettre qu\'il est aussi sans arrière-pensée.'],
  ['pa', 'octobre', '', 'Observations du siège 14',
    'Je regarde les matchs depuis le siège 14, qui offre une vue d\'ensemble sur la patinoire, sauf au centre. Je note que l\'équipe évolue bien dans les zones que je vois. Pour le reste, j\'ai confiance.'],
  ['pa', 'octobre decembre', '', 'Suggestion de chanson',
    'Ne pourrait-on pas jouer une chanson plus entraînante pendant les arrêts de jeu ? J\'en propose une, dont j\'ignore le titre mais dont je me souviens bien de la mélodie. Je peux la fredonner sur demande.'],
  ['pa', 'decembre', '', 'Un mot après le dernier match',
    'J\'ai assisté au dernier match avec mon neveu, qui a six ans et un jugement sûr. Il a trouvé que l\'équipe jouait bien, mais que la mascotte était un peu fatiguée. Je vous le rapporte tel quel.'],
  ['pa', 'echeance', '', 'Pas d\'échange, s\'il vous plaît',
    'Je me permets de vous écrire à l\'approche de la date limite pour demander qu\'aucun échange ne soit fait avant que je n\'aie eu le temps de m\'habituer aux noms. Je viens à peine d\'apprendre celui du nouveau défenseur. Je vous remercie de votre compréhension.'],
  ['pa', 'mars', '', 'Je garde espoir',
    'Je souhaite vous dire que, quelle que soit la suite, je garderai mon abonnement l\'an prochain. J\'ai déjà payé, et le chèque est encaissé, ce qui me donne un lien durable avec l\'équipe. J\'aime à penser que c\'est réciproque.'],
  ['pa', 'series', '', 'Ma porte-bonheur',
    'Ma conjointe porte le même foulard pendant les séries et, jusqu\'ici, l\'équipe gagne dans la proportion que vous savez. Elle ne le lavera pas avant la fin. Je vous demande de ne pas ébruiter la chose, de crainte que les autres équipes n\'imitent.'],
  ['pa', 'elimination', '', 'Merci quand même',
    'Je vous écris pour vous remercier de la saison, qui fut belle jusqu\'à sa fin. Je vous demande de transmettre mes salutations aux joueurs, au personnel et au gardien de stationnement. Nous nous retrouvons en octobre.'],
  ['pa', 'coupe', '', 'Je n\'ai pas dormi',
    'Je n\'ai pas dormi depuis le dernier match et je ne le regrette pas. J\'ai appelé mon frère, qui vit en Gaspésie, pour lui en parler pendant quarante minutes. Il était au courant, mais il m\'a laissé finir.'],
  ['pa', 'octobre decembre echeance mars series', 'sequence', 'Je ne change rien',
    'Depuis le début de la séquence de victoires, je m\'assois dans le même ordre, avec les mêmes gens, au même moment. Ma conjointe a accepté de ne pas aller chercher de la nourriture pendant la deuxième période. Je vous remercie de votre contribution à notre succès commun.'],
  ['pa', 'octobre decembre echeance mars', 'panne', 'Un mot d\'encouragement',
    'Je vous écris à la suite de la dernière défaite. Je ne suis pas fâché ; je suis, comment dire, légèrement présent. Je continue de croire en vous, avec un certain recul.'],

  // ---- Le maire (il vouvoie, protocolaire) ----
  ['ma', 'camp', '', 'Invitation à la cérémonie d\'ouverture',
    'J\'ai l\'honneur de vous inviter à la cérémonie d\'ouverture de la saison, où je prononcerai quelques mots qui n\'ont pas encore été écrits. Votre présence au troisième rang sera très appréciée. Un stationnement vous est réservé, sous réserve d\'une pelle.'],
  ['ma', 'octobre', '', 'Mise en circulation d\'une rue',
    'La Ville a décidé de nommer une rue en l\'honneur de l\'équipe. Il s\'agit d\'une rue très courte, que j\'ai moi-même choisie. Je compte sur vous pour l\'inaugurer, ce qui prendra trois minutes.'],
  ['ma', 'octobre decembre', '', 'Un projet d\'affiche',
    'La Ville souhaite installer une affiche géante de l\'équipe à l\'entrée de la ville. Les dimensions sont en cours de discussion, mais le principe fait consensus. L\'affiche sera visible de l\'autoroute, ce qui est le but.'],
  ['ma', 'decembre', '', 'Remise de clés de la ville',
    'Dans le cadre d\'une courte cérémonie, la Ville souhaite remettre une clé symbolique à votre capitaine. La clé n\'ouvre rien. Elle témoigne simplement de la gratitude des citoyens, que j\'ai réunis à cette fin.'],
  ['ma', 'decembre echeance', '', 'Déneigement du stationnement',
    'Le stationnement de l\'aréna sera déneigé en priorité les soirs de match. Je tiens à ce que cette mesure soit comprise comme un soutien à l\'équipe et non comme un traitement de faveur. Un nombre limité d\'exceptions sera consenti.'],
  ['ma', 'echeance', '', 'Une rumeur d\'échange',
    'Des citoyens m\'ont interpellé au sujet d\'une rumeur d\'échange. Je leur ai répondu que je n\'en savais rien, ce qui était la stricte vérité. Je vous remercie de me tenir informé, discrètement, avant la presse.'],
  ['ma', 'mars', '', 'Éclairage du pont',
    'La Ville allumera le pont aux couleurs de l\'équipe jusqu\'à la fin de la saison, sous réserve de la disponibilité des ampoules. Nous espérons que ce geste sera perçu comme une marque d\'encouragement. Il le sera, car je l\'ai annoncé.'],
  ['ma', 'series', '', 'Arrêté municipal numéro 12',
    'Un arrêté municipal temporaire autorise le bruit après 22 h les soirs de match. Il sera levé à la fin des séries, ou avant, si les voisins l\'exigent. Je vous transmets ce document par courtoisie.'],
  ['ma', 'elimination', '', 'Remerciements de la Ville',
    'La Ville tient à remercier l\'équipe pour une saison qui, bien qu\'écourtée, fut vécue avec dignité. Le conseil a adopté une résolution en ce sens, à l\'unanimité moins une abstention. L\'abstention est celle du conseiller du district 4, qui regardait le match.'],
  ['ma', 'coupe', '', 'Défilé : parcours proposé',
    'Je suis heureux de vous annoncer que la Ville organisera un défilé, dont le parcours est de deux kilomètres. Il passera devant la boulangerie, l\'hôtel de ville et le dépanneur du coin. J\'y prononcerai quelques mots, à voix haute.'],
  ['ma', 'decembre echeance mars series', 'sequence', 'Félicitations pour la séquence',
    'La Ville suit avec fierté la séquence de victoires de l\'équipe. Un conseiller a même proposé de proclamer une semaine « de la constance », ce que j\'ai accepté. Elle aura lieu quand le calendrier le permettra.'],
  ['ma', 'octobre decembre echeance mars', 'blesses', 'Soutien aux blessés',
    'La Ville souhaite offrir un panier de fruits aux joueurs blessés. Le panier sera livré à l\'aréna, avec une carte signée par moi et deux employés. Nous espérons un prompt rétablissement, dans les meilleurs délais.'],
];

const parDe = {};
/** Les courriels : { id, de, quand: [moments], etat: [états] | [], sujet, corps }. */
const COURRIELS = COURRIELS_BRUTS.map(([de, quand, etat, sujet, corps]) => {
  parDe[de] = (parDe[de] || 0) + 1;
  return { id: `${de}${parDe[de]}`, de, quand: mots(quand), etat: etat ? etat.split(' ') : [], sujet, corps };
});

/* ======================================================================
   LES DILEMMES
   Même forme que `MOMENTS` (js/sim.js) : { ico, titre, irl, recit, options }.
   En plus : `quand` (les moments où il se dit) et `etat` (l'état de l'équipe
   qui le rend vrai). Une option : [cle, nom, bon, prix, effet].
   L'effet n'utilise que les canaux déjà lus par `effetDeMoment` : finition,
   volume, defense, discipline, blessure, energie (un chiffre sous 1 = moins
   d'usure des jambes), F et D (les minutes), `duree` en matchs, `pari`,
   `ensuite`, `action`. Un `cible` nomme un joueur ({nom} dans le texte).
   ====================================================================== */
const o = (cle, nom, bon, prix, fx = {}) => ({ cle, nom, ...(bon ? { bon } : {}), ...(prix ? { prix } : {}), ...fx });

const DILEMMES_BRUTS = {
  horaire: { ico: '🕘', titre: 'L\'heure de la pratique', quand: 'camp octobre',
    recit: 'Le préposé à l\'horaire propose de devancer la pratique de quarante minutes pour libérer la glace à une chorale. Le comité des joueurs a demandé un avis écrit.',
    options: [
      o('devancer', 'Devancer la pratique', 'Des corps réveillés et plus de lancers', 'Des jambes plus lourdes le soir', { volume: 1.088, energie: 1.096, duree: 5 }),
      o('maintenir', 'Maintenir l\'heure habituelle', 'Des jambes fraîches', 'Une chorale vexée et un vestiaire distrait', { energie: 0.872, finition: 0.94, duree: 5 }),
    ] },
  tableau: { ico: '🧽', titre: 'Le tableau blanc effacé', quand: 'camp octobre',
    recit: 'Un préposé a effacé le plan de match du tableau blanc pour y inscrire le menu du souper. L\'adjoint affirme qu\'il s\'en souvient « à peu près ».',
    options: [
      o('reconstituer', 'Reconstituer le plan de mémoire', 'Des positions nettes en défensive', 'Moins de lancers : on pense trop', { defense: 0.92, volume: 0.92, duree: 5 }),
      o('improviser', 'Laisser les joueurs improviser', 'Plus de lancers, moins de gêne', 'Des trous derrière', { volume: 1.095, defense: 1.08, duree: 4 }),
    ] },
  dossards: { ico: '🎽', titre: 'Les dossards jaunes', quand: 'camp octobre decembre',
    recit: 'Les défenseurs portent les dossards jaunes depuis six semaines, et trois attaquants soutiennent que la couleur leur revient. Le comité du vestiaire demande un arbitrage.',
    options: [
      o('redistribuer', 'Redistribuer les dossards', 'Le vestiaire retrouve son calme', 'Une pratique perdue à tout réorganiser', { discipline: 0.825, volume: 0.94, duree: 4 }),
      o('tirage', 'Trancher par un tirage au sort', 'Si le tirage plaît, la bonne humeur se voit dans le tir', 'Sinon, quelqu\'un garde rancune et les punitions suivent',
        { pari: { chance: 3 / 6, gagne: { finition: 1.088, duree: 5 }, perd: { discipline: 1.213, duree: 5 } } }),
    ] },
  cabane: { ico: '🍁', titre: 'La cabane à sucre', quand: 'echeance mars',
    recit: 'Le comité social organise une sortie à la cabane à sucre la veille d\'un match. Il a produit un plan de table en trois couleurs.',
    options: [
      o('y_aller', 'Y aller en équipe', 'Un vestiaire soudé, ça se voit au tir', 'Des jambes lourdes de tire', { finition: 1.088, energie: 1.128, duree: 5 }),
      o('apres', 'La reporter après la saison', 'Des jambes légères', 'Un comité social vexé et des têtes chaudes', { energie: 0.872, discipline: 1.175, duree: 5 }),
    ] },
  chanson: { ico: '🎵', titre: 'La chanson de l\'autobus', quand: 'octobre decembre',
    recit: 'Le même joueur choisit la chanson de l\'autobus depuis le début de la saison, et c\'est toujours la même. Deux vétérans réclament un tour de rôle écrit.',
    options: [
      o('tour', 'Instaurer un tour de rôle', 'Un vestiaire apaisé, moins de punitions', 'Des voyages plus longs à négocier, donc plus d\'usure des jambes', { discipline: 0.84, energie: 1.08, duree: 6 }),
      o('laisser', 'Laisser le rituel en place', 'Le rituel tient et la confiance aussi', 'Les vétérans bouillent et les punitions montent', { finition: 1.08, discipline: 1.19, duree: 6 }),
    ] },
  souper: { ico: '🍽️', titre: 'Le souper d\'équipe', quand: 'decembre',
    recit: 'Le souper d\'équipe a lieu dans un restaurant qui exige un code vestimentaire. Quatre joueurs se présentent en survêtement.',
    options: [
      o('veston', 'Exiger le veston', 'Une équipe en ordre, moins de punitions', 'Des joueurs raides qui ne tirent plus', { discipline: 0.825, finition: 0.94, duree: 4 }),
      o('laisser', 'Laisser chacun comme il est', 'Un vestiaire détendu qui lance de partout', 'Des têtes chaudes sur la glace', { volume: 1.088, discipline: 1.19, duree: 4 }),
    ] },
  chaussettes: { ico: '🧦', titre: 'Les chaussettes de {nom}', quand: 'octobre decembre mars', cible: 'gardien',
    recit: '{nom} porte les mêmes chaussettes depuis octobre et refuse qu\'on les lave. Le préposé à l\'équipement a rédigé une note de trois pages.',
    options: [
      o('rituel', 'Respecter le rituel', 'Il se sent invincible', 'Le vestiaire s\'en ressent et les punitions montent', { defense: 0.92, discipline: 1.175, duree: 5 }),
      o('nuit', 'Les laver pendant la nuit', 'S\'il ne remarque rien, tout le monde respire', 'S\'il remarque, il joue contrarié',
        { pari: { chance: 3 / 6, gagne: { discipline: 0.84, duree: 5 }, perd: { defense: 1.095, duree: 4 } } }),
    ] },
  chrono: { ico: '⏲️', titre: 'Le chrono des changements', quand: 'octobre decembre echeance',
    recit: 'L\'adjoint souhaite chronométrer chaque présence à la seconde. Les joueurs demandent si le chronomètre pourra, à son tour, être chronométré.',
    options: [
      o('chronometrer', 'Chronométrer chaque présence', 'Des changements nets, moins de punitions', 'Des présences courtes, moins de lancers', { discipline: 0.825, volume: 0.913, duree: 5 }),
      o('confiance', 'Faire confiance au feeling', 'Le jeu coule', 'Quelques changements à l\'arrache', { volume: 1.08, discipline: 1.175, duree: 5 }),
    ] },
  mascotte: { ico: '🦫', titre: 'Le nouveau numéro de la mascotte', quand: 'octobre decembre mars',
    recit: 'La mascotte propose un numéro d\'avant-match impliquant une rampe et un trampoline. Le service des communications l\'appelle « un moment de proximité ».',
    options: [
      o('autoriser', 'Autoriser le numéro', 'La foule s\'enflamme, ça rentre', 'Les joueurs se déconcentrent derrière', { finition: 1.08, defense: 1.06, duree: 4 }),
      o('annuler', 'Annuler le numéro', 'Une concentration totale', 'Une foule plus tranquille', { defense: 0.94, finition: 0.96, duree: 4 }),
    ] },
  ascenseur: { ico: '🛗', titre: 'L\'ascenseur de l\'hôtel', quand: 'decembre echeance mars',
    recit: 'L\'ascenseur de l\'hôtel est en panne et l\'équipe loge au quatorzième étage. Le gérant parle d\'une réparation « prochainement ».',
    options: [
      o('escaliers', 'Monter à pied', 'Les joueurs arrivent éveillés et lancent plus', 'Les jambes paient quatorze étages', { volume: 1.088, energie: 1.128, duree: 3 }),
      o('hotel', 'Changer d\'hôtel', 'Des jambes préservées', 'Un souper tardif et une nuit courte', { energie: 0.872, finition: 0.92, duree: 3 }),
    ] },
  vol_retarde: { ico: '🛫', titre: 'Le vol retardé', quand: 'decembre echeance mars',
    recit: 'Le vol du retour est retardé de quatre heures pour une cause que la compagnie qualifie de « circonstancielle ». Le groupe n\'a pas mangé depuis midi.',
    options: [
      o('attendre', 'Attendre à l\'aéroport', 'Le groupe reste uni et calme', 'Une arrivée tardive : moins de lancers', { discipline: 0.84, volume: 0.913, duree: 3 }),
      o('voitures', 'Louer des voitures', 'On arrive à l\'heure, avec le temps de se réchauffer', 'Des jambes fatiguées par la route', { volume: 1.08, energie: 1.128, duree: 3 }),
    ] },
  photo: { ico: '📸', titre: 'La séance photo qui s\'étire', quand: 'octobre echeance',
    recit: 'La séance de photos de cartes à échanger dure depuis trois heures. Le photographe veut « une dernière, plus naturelle ».',
    options: [
      o('ecourter', 'Écourter la séance', 'Des jambes reposées', 'Des cartes à moitié réussies et un photographe vexé', { energie: 0.888, finition: 0.94, duree: 4 }),
      o('poursuivre', 'Laisser le photographe finir', 'Un vestiaire fier de sa photo, ça tire mieux', 'Une soirée entière debout', { finition: 1.08, energie: 1.112, duree: 4 }),
    ] },
  sieste: { ico: '😴', titre: 'La sieste obligatoire', quand: 'camp decembre mars',
    recit: 'Un nutritionniste de passage recommande une sieste obligatoire de vingt minutes avant chaque match. Le vétéran du fond du vestiaire dit qu\'il fait déjà cela, sans qu\'on l\'y oblige.',
    options: [
      o('imposer', 'Imposer la sieste', 'Des jambes fraîches et moins de blessures', 'Un départ lent : moins de lancers', { energie: 0.84, blessure: 0.84, volume: 0.913, duree: 6 }),
      o('libre', 'La laisser facultative', 'Chacun joue à son rythme et lance plus', 'Quelques joueurs mal réveillés', { volume: 1.08, defense: 1.06, duree: 6 }),
    ] },
  viande: { ico: '🥩', titre: 'Le menu d\'avant-match', quand: 'octobre mars series',
    recit: 'Le cuisinier propose un menu d\'avant-match sans viande, par souci d\'innovation. Le doyen du vestiaire annonce qu\'il commandera du poulet, sans le dire.',
    options: [
      o('menu', 'Maintenir le menu nouveau', 'Des jambes plus légères', 'Un vestiaire grognon qui frotte', { energie: 0.888, discipline: 1.16, duree: 5 }),
      o('poulet', 'Remettre le poulet', 'La paix au vestiaire et les gars lancent', 'Un peu plus lourds en fin de match', { volume: 1.08, energie: 1.096, duree: 5 }),
    ] },
  casque_bruit: { ico: '🎧', titre: 'Les écouteurs dans le vestiaire', quand: 'octobre decembre mars series',
    recit: 'Huit joueurs sur vingt portent des écouteurs au vestiaire avant le match. L\'adjoint juge qu\'on ne s\'y parle plus ; le doyen répond que c\'est justement pour ça.',
    options: [
      o('interdire', 'Les interdire avant le match', 'Le groupe se parle, la défense suit', 'Quelques gars se renferment et lancent moins', { defense: 0.92, volume: 0.92, duree: 5 }),
      o('tolerer', 'Les tolérer', 'Chacun se concentre à sa façon, ça tire mieux', 'La communication en prend un coup', { finition: 1.08, defense: 1.08, duree: 5 }),
    ] },
  yoga: { ico: '🧘', titre: 'Le cours de yoga', quand: 'camp octobre decembre',
    recit: 'Un instructeur propose un cours de yoga hebdomadaire au vestiaire. Deux défenseurs affirment que les postures « ne sont pas pour eux », sans les avoir essayées.',
    options: [
      o('obligatoire', 'Rendre le cours obligatoire', 'Moins de blessures, des corps souples', 'Un vestiaire sceptique qui perd des minutes de lancers', { blessure: 0.76, volume: 0.92, duree: 8 }),
      o('volontaire', 'Seulement pour les volontaires', 'Les convaincus s\'y mettent et le groupe reste solide', 'Une équipe à deux vitesses', { blessure: 0.904, discipline: 1.12, duree: 8 }),
    ] },
  retard_autobus: { ico: '🚌', titre: 'Le retardataire de l\'autobus', quand: 'octobre decembre echeance',
    recit: 'Un joueur manque l\'autobus pour la deuxième fois du mois. Il explique que son cadran « a une opinion ».',
    options: [
      o('amende', 'L\'amende symbolique', 'Un message clair, une équipe disciplinée', 'Un joueur qui boude un peu', { discipline: 0.825, finition: 0.94, duree: 5 }),
      o('blague', 'En rire et lui offrir un cadran', 'Le vestiaire rit, la pression tombe', 'D\'autres se croiront permis', { finition: 1.08, discipline: 1.175, duree: 5 }),
    ] },
  patins_neufs: { ico: '⛸️', titre: 'Les patins neufs', quand: 'camp octobre',
    recit: 'Le fournisseur offre des patins neufs à toute l\'équipe, à condition qu\'ils soient portés dès demain. Le préposé à l\'équipement rappelle que des patins neufs, ça fait des ampoules.',
    options: [
      o('demain', 'Les porter dès demain', 'Des patins plus vifs, plus de lancers', 'Des ampoules, donc plus de blessures', { volume: 1.088, blessure: 1.24, duree: 6 }),
      o('apprivoiser', 'Les apprivoiser en pratique', 'Moins de bobos, des corps préservés', 'Un départ prudent, moins de tir', { blessure: 0.808, finition: 0.94, duree: 6 }),
    ] },
  radio: { ico: '📻', titre: 'L\'entrevue à la radio', quand: 'decembre mars',
    recit: 'Une radio locale invite le coach à son émission du matin, entre la météo et la circulation. Le service des communications y voit « un rendez-vous naturel ».',
    options: [
      o('accepter', 'Y aller', 'Le vestiaire se sent soutenu et lance plus', 'Un matin entier perdu en préparation', { volume: 1.08, energie: 1.08, duree: 4 }),
      o('decliner', 'Décliner poliment', 'Un coach concentré sur sa semaine, une défense serrée', 'Une radio fâchée qui s\'en souvient', { defense: 0.94, discipline: 1.1, duree: 4 }),
    ] },
  tempete_mars: { ico: '🌨️', titre: 'La dernière tempête', quand: 'mars series',
    recit: 'Une tempête de fin de saison ferme l\'autoroute devant l\'aréna. La pratique est maintenue, à condition que les joueurs arrivent.',
    options: [
      o('maintenir', 'Maintenir la pratique', 'Un groupe qui a fait l\'effort, ça tire', 'Une équipe fatiguée par la route', { finition: 1.08, energie: 1.128, duree: 4 }),
      o('annuler', 'Annuler la pratique', 'Des jambes reposées', 'Une journée de rythme perdue', { energie: 0.84, volume: 0.92, duree: 4 }),
    ] },
  parade: { ico: '🎺', titre: 'La fanfare du quartier', quand: 'octobre mars series',
    recit: 'Une fanfare du quartier offre de jouer pendant l\'échauffement. Elle a répété trois pièces, dont une que personne ne reconnaît.',
    options: [
      o('accepter', 'Accepter la fanfare', 'Un amphithéâtre en feu et du tir', 'Des tuyaux qui couvrent la voix du banc', { finition: 1.088, defense: 1.08, duree: 3 }),
      o('refuser', 'La remercier', 'Une communication claire au banc', 'Une ambiance plus terne', { defense: 0.94, volume: 0.92, duree: 3 }),
    ] },
  gardien_demande: { ico: '🧤', titre: 'Le gardien demande un congé', quand: 'decembre echeance mars', cible: 'gardien',
    recit: '{nom} demande à ne pas jouer demain : son beau-frère se marie, et il a promis un discours. Le préposé à l\'équipement dit que le discours est « plutôt court ».',
    options: [
      o('conge', 'Lui accorder le congé', 'Il revient reposé et motivé', 'Un match avec ton auxiliaire', { action: { gardienAux: 1 }, ensuite: { apres: 1, duree: 6, defense: 0.94 } }),
      o('refuser', 'Refuser poliment', 'Le message est clair : on joue ce soir', 'Un gardien qui répète son discours dans le filet', { defense: 1.06, discipline: 0.84, duree: 4 }),
    ] },
  vedette_photo: { ico: '🎞️', titre: 'Le documentaire sur {nom}', quand: 'octobre decembre echeance', cible: 'vedette',
    recit: 'Une maison de production veut suivre {nom} dans sa routine pour un documentaire de six épisodes. Le premier épisode s\'intitule « Les matins ».',
    options: [
      o('accepter', 'Accepter le tournage', 'Il se sent regardé et se défonce', 'Des soirées écourtées, des jambes qui paient', { finition: 1.088, energie: 1.128, duree: 6 }),
      o('refuser', 'Refuser le tournage', 'Une routine préservée, des jambes fraîches', 'Une vedette un peu boudeuse', { energie: 0.872, finition: 0.94, duree: 6 }),
    ] },
  dur_sermon: { ico: '🗨️', titre: 'La mise au point avec {nom}', quand: 'octobre decembre mars', cible: 'dur',
    recit: '{nom} a reçu trois punitions mineures en deux matchs, dont une pour « enthousiasme ». L\'arbitre lui a demandé de modérer ses gestes, par écrit.',
    options: [
      o('galerie', 'Un match à la galerie de presse', 'Le message passe : moins de punitions', '{nom} regarde de là-haut, un réserviste joue', { action: { absents: 1 }, discipline: 0.825, duree: 6 }),
      o('confiance', 'Lui faire confiance', 'Il joue avec fougue et l\'équipe suit', 'L\'arbitre le guette encore', { finition: 1.08, discipline: 1.19, duree: 5 }),
    ] },
  vedette_repos: { ico: '🛌', titre: 'Les jambes de {nom}', quand: 'mars series', cible: 'vedette',
    recit: '{nom} avoue en riant qu\'il ne sent plus ses jambes depuis une semaine. Le physio répond qu\'il ne riait pas, lui.',
    options: [
      o('repos', 'Un match de repos', '{nom} revient frais', 'Un match sans lui, un réserviste joue', { action: { absents: 1 } }),
      o('jouer', 'Le faire jouer quand même', 'Il joue et il le sait', '{nom} joue épuisé', { action: { energie: -30 }, finition: 1.08, duree: 3 }),
    ] },

  // ---- En séquence de victoires ----
  superstition: { ico: '🔮', titre: 'La superstition qui gagne', quand: 'octobre decembre echeance mars series', etat: 'sequence',
    recit: 'Depuis le début de la séquence, les joueurs entrent au vestiaire dans le même ordre et par la même porte. Un nouveau veut passer par l\'autre, par curiosité.',
    options: [
      o('respecter', 'Ne rien changer', 'La routine tient et la confiance aussi', 'Un nouveau mis à l\'écart', { finition: 1.08, discipline: 1.16, duree: 5 }),
      o('integrer', 'Intégrer le nouveau au rituel', 'Un vestiaire plus uni, moins de punitions', 'Une routine bousculée, moins de lancers', { discipline: 0.84, volume: 0.92, duree: 5 }),
    ] },
  photo_victoire: { ico: '🖼️', titre: 'La photo de la séquence', quand: 'decembre echeance mars series', etat: 'sequence',
    recit: 'Les communications veulent une photo du groupe pour souligner la séquence. Les joueurs craignent de « jouer la poisse » en la prenant avant la fin.',
    options: [
      o('prendre', 'La prendre maintenant', 'Un groupe fier, qui tire avec confiance', 'La poisse, si elle existe, a rendez-vous', { finition: 1.088, defense: 1.08, duree: 4 }),
      o('attendre', 'L\'attendre après la séquence', 'Une équipe sans distraction', 'Un groupe un peu tendu', { defense: 0.92, finition: 0.96, duree: 4 }),
    ] },
  doubler_trio: { ico: '🔥', titre: 'Le trio qui ne se trompe plus', quand: 'octobre decembre echeance mars series', etat: 'sequence',
    recit: 'Le premier trio compte tous les soirs et demande à rester sur la glace plus longtemps. Le quatrième trio, lui, a commencé à regarder les nuages.',
    options: [
      o('allonger', 'Allonger ses présences', 'Il continue de tout faire gagner', 'Il s\'use, et le quatrième trio rouille', { F: [1.25, 1.02, 0.95, 0.72], blessure: 1.48 }),
      o('partager', 'Partager les minutes', 'Tout le monde joue, les corps se reposent', 'Tes vedettes jouent moins', { F: [0.9, 0.97, 1.05, 1.2], D: [0.95, 1, 1.08], blessure: 0.68 }),
    ] },
  chandail_victoire: { ico: '👔', titre: 'Le chandail de la chance', quand: 'decembre echeance mars series', etat: 'sequence',
    recit: 'Un joueur porte le même sous-chandail depuis la séquence et le préposé à l\'équipement n\'ose plus s\'en approcher. Les voisins de casier se plaignent de l\'odeur, poliment.',
    options: [
      o('garder', 'Le garder tel quel', 'La chance reste de son bord', 'Un vestiaire qui s\'en plaint et s\'échauffe', { finition: 1.088, discipline: 1.175, duree: 5 }),
      o('laver', 'Le laver en douce', 'Un vestiaire respirable, moins de punitions', 'Si la chance s\'en va, ça se paie', { discipline: 0.825, finition: 0.92, duree: 5 }),
    ] },

  // ---- En panne ----
  repas_panne: { ico: '🍲', titre: 'Le repas de la dernière chance', quand: 'octobre decembre echeance mars', etat: 'panne',
    recit: 'Après quelques défaites de suite, un vétéran invite tout le monde chez lui pour un ragoût. Sa femme a déjà acheté les carottes.',
    options: [
      o('aller', 'Accepter l\'invitation', 'Un groupe qui se retrouve et lance de partout', 'Une soirée sans repos : l\'usure des jambes grimpe', { volume: 1.088, energie: 1.112, duree: 5 }),
      o('repos', 'Dire non et dormir', 'Des jambes fraîches et une défense reposée', 'Un vétéran blessé dans son orgueil', { energie: 0.872, defense: 0.94, discipline: 1.1, duree: 5 }),
    ] },
  video_panne: { ico: '🎥', titre: 'La séance de vidéo de quatre heures', quand: 'octobre decembre echeance mars', etat: 'panne',
    recit: 'L\'adjoint propose de revoir tous les matchs de la séquence, sans en sauter un seul. Les joueurs demandent s\'il y aura des collations.',
    options: [
      o('tout', 'Tout revoir', 'On comprend ce qui n\'allait pas : la défense se resserre', 'Des jambes lourdes d\'être restés assis', { defense: 0.913, energie: 1.08, duree: 5 }),
      o('courte', 'Dix minutes, pas plus', 'Un message simple, on lance sans se poser de questions', 'Des erreurs qui reviennent', { volume: 1.088, defense: 1.06, duree: 5 }),
    ] },
  reunion_joueurs: { ico: '🪑', titre: 'La réunion des joueurs', quand: 'octobre decembre echeance mars series', etat: 'panne',
    recit: 'Les joueurs se sont réunis sans le coach, dans le local du fond. Ils en sortent avec un document de deux lignes, dont la deuxième est illisible.',
    options: [
      o('ecouter', 'Écouter leur plan', 'Un vestiaire responsable, moins de punitions', 'Un plan que personne ne comprend : moins de lancers', { discipline: 0.825, volume: 0.92, duree: 5 }),
      o('imposer', 'Imposer le tien', 'Le système revient, la défense suit', 'Un vestiaire qui grince un peu', { defense: 0.913, finition: 0.94, duree: 5 }),
    ] },
  gardien_panne: { ico: '🥅', titre: 'Le gardien dans le doute', quand: 'octobre decembre echeance mars', etat: 'panne', cible: 'gardien',
    recit: '{nom} confie que le filet lui paraît plus petit depuis quelques matchs. Le soigneur a mesuré, et le filet n\'a pas bougé.',
    options: [
      o('soutenir', 'Le soutenir et le laisser jouer', 'Il retrouve ses angles, une chance sur deux', 'S\'il continue de douter, ça coule',
        { pari: { chance: 3 / 6, gagne: { defense: 0.898, duree: 5 }, perd: { defense: 1.103, duree: 5 } } }),
      o('repos', 'Lui donner trois matchs de repos', 'Un auxiliaire en confiance, {nom} revient la tête froide', 'Trois matchs sans ton partant', { action: { gardienAux: 3 }, ensuite: { apres: 3, duree: 8, defense: 0.92 } }),
    ] },

  // ---- Plafond serré (aucun bon choix : laquelle moins ?) ----
  vols_economiques: { ico: '💺', titre: 'Les vols économiques', quand: 'octobre decembre echeance mars', etat: 'plafond',
    recit: 'Le directeur des finances propose de voyager en vol régulier pour économiser. Les deux options coûtent : laquelle moins ?',
    options: [
      o('accepter', 'Accepter les vols réguliers', 'Une marge qui rassure : le vestiaire s\'applique et lance plus', 'Les voyages fatiguent', { volume: 1.08, energie: 1.16, duree: 8 }),
      o('refuser', 'Garder les vols nolisés', 'Des jambes reposées en voyage', 'Un directeur des finances qui boude, et une équipe tendue', { energie: 0.872, finition: 0.92, duree: 8 }),
    ] },
  equipement_budget: { ico: '🧰', titre: 'Le budget de l\'équipement', quand: 'octobre decembre echeance mars', etat: 'plafond',
    recit: 'Pour dégager de la marge, le directeur des finances demande de reporter l\'achat d\'équipement neuf. Le préposé à l\'équipement a déjà préparé une liste, et un tableau.',
    options: [
      o('reporter', 'Reporter les achats', 'Les gars font avec ce qu\'ils ont et se serrent les coudes', 'Du vieux matériel, donc plus de blessures', { discipline: 0.84, blessure: 1.24, duree: 7 }),
      o('acheter', 'Acheter malgré tout', 'Du matériel neuf, moins de blessures', 'Un propriétaire qui serre la vis : le groupe en ressent la pression', { blessure: 0.808, finition: 0.92, duree: 7 }),
    ] },
  contrat_conge: { ico: '🧮', titre: 'La ligne de trop', quand: 'echeance mars', etat: 'plafond',
    recit: 'En vérifiant les comptes, le directeur des finances trouve une ligne de dépenses intitulée « divers » qui totalise une saison de collations. Il demande si l\'on garde les collations ou la marge.',
    options: [
      o('collations', 'Garder les collations', 'Un vestiaire content et qui tire plus', 'Une marge qui reste mince : le propriétaire grogne et le groupe s\'en ressent', { finition: 1.08, defense: 1.06, duree: 6 }),
      o('marge', 'Garder la marge', 'Une défense appliquée, rien à reprocher aux comptes', 'Un vestiaire affamé qui lance moins', { defense: 0.92, volume: 0.913, duree: 6 }),
    ] },
  comptes_voyage: { ico: '🧳', titre: 'Les comptes de dépenses', quand: 'octobre decembre echeance mars', etat: 'plafond',
    recit: 'Le directeur des finances exige un reçu pour chaque repas de la dernière tournée. Les joueurs, qui n\'en ont gardé aucun, proposent de refaire le voyage.',
    options: [
      o('exiger', 'Exiger les reçus', 'Un vestiaire discipliné, moins de punitions', 'Des joueurs agacés qui lancent moins', { discipline: 0.84, volume: 0.92, duree: 5 }),
      o('laisser', 'Faire confiance et payer la différence', 'Un vestiaire soulagé qui se lâche', 'Des têtes chaudes et un budget plus serré', { volume: 1.08, discipline: 1.175, duree: 5 }),
    ] },

  // ---- Blessés nombreux ----
  infirmerie_pleine: { ico: '🩹', titre: 'L\'infirmerie déborde', quand: 'octobre decembre echeance mars series', etat: 'blesses',
    recit: 'L\'infirmerie compte plus de joueurs que de chaises. Le physio propose de réduire la charge d\'entraînement ; l\'adjoint propose de ne rien changer.',
    options: [
      o('reduire', 'Réduire la charge', 'Moins de blessures, des jambes ménagées', 'Un rythme plus lent : moins de lancers', { blessure: 0.76, energie: 0.888, volume: 0.913, duree: 7 }),
      o('maintenir', 'Maintenir la charge', 'Le rythme reste vif et ça lance', 'Les corps tiennent moins bien', { volume: 1.088, blessure: 1.32, duree: 6 }),
    ] },
  rappel_clubecole: { ico: '📞', titre: 'Les rappels du club-école', quand: 'octobre decembre echeance mars series', etat: 'blesses',
    recit: 'Le club-école propose d\'envoyer trois jeunes pour combler les absences. L\'un d\'eux, croit-on savoir, a un très bon coup de patin et une mauvaise mémoire du système.',
    options: [
      o('jeunes', 'Faire jouer les jeunes', 'Du rythme et plus de lancers', 'Des erreurs de système derrière', { volume: 1.088, defense: 1.088, duree: 6 }),
      o('vieux', 'Compter sur les vétérans qui restent', 'Un système respecté, la défense tient', 'Des vétérans qui jouent beaucoup, leur usure des jambes grimpe', { defense: 0.913, energie: 1.128, duree: 6 }),
    ] },
  visite_medecin: { ico: '🧑‍⚕️', titre: 'La visite du spécialiste', quand: 'decembre echeance mars series', etat: 'blesses',
    recit: 'Un spécialiste de passage offre d\'examiner tous les blessés en une journée. Il demande, en retour, qu\'on reconnaisse sa méthode devant les médias.',
    options: [
      o('accepter', 'Accepter son offre', 'Un diagnostic net, moins de rechutes', 'Un coach qui promet, devant la presse, plus qu\'il ne sait : le vestiaire est tendu', { blessure: 0.808, discipline: 1.16, duree: 8 }),
      o('refuser', 'Faire confiance au physio', 'Un groupe soudé, moins de punitions', 'Des rechutes possibles', { discipline: 0.84, blessure: 1.16, duree: 8 }),
    ] },
  retour_precipite: { ico: '⏩', titre: 'Le retour précipité', quand: 'mars series', etat: 'blesses', cible: 'vedette',
    recit: '{nom}, blessé depuis trois semaines, dit qu\'il est prêt à rejouer. Le physio dit qu\'il n\'est « probablement pas » prêt, et le mot « probablement » inquiète tout le monde.',
    options: [
      o('attendre', 'Attendre deux matchs de plus', 'Un retour plus sûr, {nom} reviendra en forme', 'Deux matchs sans lui, un réserviste joue', { action: { absents: 2 } }),
      o('jouer', 'Le croire', 'Si le physio exagère, il est de retour en force', 'Sinon, il retombe et manque dix matchs',
        { pari: { chance: 4 / 6, gagne: { finition: 1.088, duree: 5 }, perd: { action: { absents: 10 } } } }),
    ] },

  // ---- Après l'échéance, fin de saison, séries ----
  echeance_jeune: { ico: '🌱', titre: 'Le jeune qui veut jouer', quand: 'echeance mars',
    recit: 'Un jeune venu du club-école demande plus de temps de glace avant la fin de la saison. Il affirme qu\'il « sent les séries ».',
    options: [
      o('donner', 'Lui donner du temps de glace', 'Des jambes neuves au bas de l\'alignement', 'Ton premier trio joue moins', { F: [0.9, 1.05, 1.08, 1.05], volume: 1.088 }),
      o('attendre', 'Lui demander d\'attendre son tour', 'Les vétérans gardent le système en main', 'Un jeune qui bouille un peu', { defense: 0.92, discipline: 1.12, duree: 6 }),
    ] },
  fete_mars: { ico: '🎂', titre: 'Le gâteau du vétéran', quand: 'mars series',
    recit: 'Un vétéran atteint un millier de matchs et le comité social a commandé un gâteau de six étages. Le gâteau doit être mangé avant la fin de la semaine.',
    options: [
      o('fete', 'Fêter à fond', 'Un vestiaire en fête qui lance de partout', 'Une soirée courte, des jambes moins fraîches', { volume: 1.088, energie: 1.112, duree: 4 }),
      o('apres', 'Garder le gâteau pour le lendemain', 'Des jambes reposées et un groupe discipliné', 'Un vétéran qui sourit à moitié', { energie: 0.888, discipline: 0.88, finition: 0.96, duree: 4 }),
    ] },
  coulisses_series: { ico: '🎬', titre: 'Les coulisses des séries', quand: 'series',
    recit: 'Un réseau demande à installer une caméra dans le couloir qui mène à la glace. Le couloir est étroit, et l\'étroit, dit un vétéran, « porte conseil ».',
    options: [
      o('accepter', 'Accepter la caméra', 'Les joueurs se sentent regardés et se défoncent', 'Une pression qui ouvre la porte aux punitions', { finition: 1.08, discipline: 1.19, duree: 3 }),
      o('refuser', 'Refuser la caméra', 'Un couloir calme, une équipe disciplinée', 'Un vestiaire sans éclat qui lance moins', { discipline: 0.825, volume: 0.92, duree: 3 }),
    ] },
  hymne_series: { ico: '🎼', titre: 'L\'hymne en séries', quand: 'series',
    recit: 'Le chanteur d\'hymne annonce une version plus longue, en trois langues, pour souligner la gravité de la série. Le gardien préfère garder sa concentration, quitte à ne pas chanter.',
    options: [
      o('longue', 'Accepter la version longue', 'La foule monte, et l\'équipe aussi', 'Un échauffement écourté, des trous derrière', { finition: 1.08, defense: 1.06, duree: 3 }),
      o('courte', 'Demander la version courte', 'L\'échauffement tient, la défense est en place', 'Une foule un peu déçue', { defense: 0.92, finition: 0.96, duree: 3 }),
    ] },
  conge_series: { ico: '🛋️', titre: 'La journée de congé en série', quand: 'series',
    recit: 'Le calendrier laisse une journée libre entre deux matchs. L\'adjoint veut une pratique à huis clos ; le physio, un congé complet.',
    options: [
      o('pratique', 'Une pratique à huis clos', 'Des lancers précis et du rythme', 'Des jambes moins fraîches', { finition: 1.08, volume: 1.06, energie: 1.096, duree: 3 }),
      o('conge', 'Un congé complet', 'Des jambes fraîches, moins de blessures', 'Un rythme un peu rouillé', { energie: 0.84, blessure: 0.84, finition: 0.94, duree: 3 }),
    ] },
  cravate_series: { ico: '🎩', titre: 'Le code vestimentaire des séries', quand: 'series',
    recit: 'Le comité du vestiaire propose un costume obligatoire pour toutes les arrivées de séries. Deux joueurs ont déjà demandé si un survêtement « bien repassé » compte.',
    options: [
      o('costume', 'Imposer le costume', 'Une image soignée, moins de punitions', 'Des joueurs raides, moins de lancers', { discipline: 0.84, volume: 0.92, duree: 4 }),
      o('libre', 'Laisser chacun choisir', 'Un vestiaire détendu qui lance', 'Des têtes un peu plus chaudes', { volume: 1.08, discipline: 1.175, duree: 4 }),
    ] },
  barbier: { ico: '💈', titre: 'Le barbier du vestiaire', quand: 'series',
    recit: 'Les joueurs se laissent pousser la barbe depuis le début des séries, selon un règlement non écrit. Un barbier local offre de passer pour « finir le travail ».',
    options: [
      o('pousser', 'Interdire les rasoirs', 'La tradition tient et le vestiaire croit', 'Des barbes qui chauffent : les nerfs aussi', { finition: 1.08, discipline: 1.175, duree: 4 }),
      o('raser', 'Inviter le barbier', 'Un groupe propre et concentré', 'Une chance dont on se prive peut-être', { discipline: 0.84, finition: 0.96, duree: 4 }),
    ] },

  // ---- Camp ----
  camp_chambres: { ico: '🛏️', titre: 'Les chambres du camp', quand: 'camp',
    recit: 'Le camp d\'entraînement loge les joueurs à deux par chambre, selon un tirage informatique. Un vétéran se retrouve avec un jeune qui ronfle « par principe ».',
    options: [
      o('changer', 'Refaire le tirage', 'Un vestiaire reposé, des jambes fraîches', 'Une journée de réorganisation et des plaintes', { energie: 0.872, volume: 0.92, duree: 6 }),
      o('garder', 'Garder le tirage', 'Un jeune qui apprend vite, un vétéran qui s\'endurcit', 'Des nuits courtes pour tout le monde', { discipline: 0.84, energie: 1.112, duree: 6 }),
    ] },
  camp_tests: { ico: '📏', titre: 'Les tests physiques du camp', quand: 'camp',
    recit: 'Les tests de conditionnement du camp comprennent trois épreuves et un questionnaire sur les habitudes de sommeil. Le questionnaire compte quarante questions, dont deux sont les mêmes.',
    options: [
      o('complets', 'Tous les tests, sans exception', 'Un groupe en forme, moins de blessures', 'Des jambes lourdes avant même le premier match', { blessure: 0.808, energie: 1.096, duree: 7 }),
      o('allege', 'Un protocole allégé', 'Des jambes préservées pour octobre', 'Des faiblesses qu\'on découvrira en saison', { energie: 0.872, blessure: 1.16, duree: 7 }),
    ] },
  camp_chandail: { ico: '🧵', titre: 'Le chandail du capitaine', quand: 'camp octobre',
    recit: 'Un joueur réclame le « C » de capitaine en faisant valoir qu\'il l\'a porté dans ses équipes de jeunesse. Le doyen, qui l\'a porté dix ans, ne dit rien, très fort.',
    options: [
      o('doyen', 'Garder le doyen', 'Un vestiaire stable, une défense en ordre', 'Un jeune qui bouille', { defense: 0.92, finition: 0.94, duree: 6 }),
      o('jeune', 'Donner sa chance au jeune', 'De l\'élan et de la fierté, ça lance', 'Un doyen blessé dans son orgueil, des têtes chaudes', { volume: 1.088, discipline: 1.175, duree: 6 }),
    ] },
  camp_rookie: { ico: '🎒', titre: 'Le sac de la recrue', quand: 'camp octobre',
    recit: 'Selon la tradition, la recrue transporte le sac de rondelles jusqu\'à la fin du camp. Cette année, la recrue est le meilleur marqueur du groupe.',
    options: [
      o('tradition', 'Maintenir la tradition', 'Un vestiaire solidaire, moins de punitions', 'Une recrue vexée qui tire moins', { discipline: 0.84, finition: 0.94, duree: 5 }),
      o('exception', 'Faire une exception', 'Une recrue en confiance qui tire fort', 'Un vestiaire qui crie à l\'injustice', { finition: 1.088, discipline: 1.19, duree: 5 }),
    ] },
  camp_coup: { ico: '🥤', titre: 'La boisson du camp', quand: 'camp',
    recit: 'Un commanditaire livre trois cents bouteilles d\'une boisson sportive à la couleur indéfinissable. Le physio demande qu\'on la laisse « en observation » un jour ou deux.',
    options: [
      o('servir', 'La servir tout de suite', 'Un vestiaire content, plus de tirs', 'Des estomacs fragiles, donc plus d\'usure des jambes', { volume: 1.08, energie: 1.112, duree: 5 }),
      o('observer', 'Attendre l\'avis du physio', 'Des jambes fraîches et un groupe prudent', 'Un commanditaire déçu', { energie: 0.888, finition: 0.94, duree: 5 }),
    ] },

  // ---- Échéance ----
  echeance_telephone: { ico: '☎️', titre: 'Le téléphone qui sonne', quand: 'echeance',
    recit: 'Depuis ce matin, quatre directeurs généraux t\'ont appelé « pour prendre des nouvelles ». Aucun n\'a parlé d\'échange, ce qui, dans la circonstance, parle beaucoup.',
    options: [
      o('repondre', 'Répondre à tout le monde', 'Un vestiaire qui sent que ça bouge et qui se défonce', 'Des gars qui se demandent s\'ils partent : ça frotte', { volume: 1.088, discipline: 1.175, duree: 5 }),
      o('silence', 'Fermer le téléphone', 'Un vestiaire calme, la défense tient', 'Un doute qui reste, donc moins de tir', { defense: 0.92, finition: 0.94, duree: 5 }),
    ] },
  echeance_fax: { ico: '📠', titre: 'L\'offre arrivée en retard', quand: 'echeance',
    recit: 'Une offre d\'échange est arrivée par télécopieur à 15 h 02, soit deux minutes après la date limite. L\'autre club prétend que son horloge retarde.',
    options: [
      o('accepter', 'Honorer l\'offre', 'Un vestiaire surpris mais sensible au geste', 'Une ligue qui hausse un sourcil et surveille tes punitions', { finition: 1.08, discipline: 1.175, duree: 6 }),
      o('refuser', 'Respecter l\'heure officielle', 'Une équipe rigoureuse, moins de punitions', 'Une occasion manquée, le vestiaire lance moins', { discipline: 0.84, volume: 0.92, duree: 6 }),
    ] },
  echeance_depart: { ico: '👋', titre: 'Les adieux au casier', quand: 'echeance',
    recit: 'Un joueur échangé revient chercher ses gants et reste vingt minutes devant son casier. Ses anciens coéquipiers font semblant d\'être occupés.',
    options: [
      o('fete', 'Organiser un petit au revoir', 'Un vestiaire solidaire et reconnaissant', 'Une soirée écourtée, des jambes plus lourdes', { discipline: 0.84, energie: 1.096, duree: 5 }),
      o('silence', 'Laisser faire discrètement', 'Un vestiaire concentré sur le match', 'Un malaise qui traîne et déconcentre', { defense: 0.94, finition: 0.94, duree: 5 }),
    ] },

  // ---- Décembre et octobre, divers ----
  deco_noel: { ico: '🎄', titre: 'Le sapin du vestiaire', quand: 'decembre',
    recit: 'Un sapin artificiel de trois mètres a été installé au centre du vestiaire. Il masque la porte et deux casiers, dont celui du capitaine.',
    options: [
      o('garder', 'Garder le sapin', 'Un vestiaire joyeux et plus de tirs', 'Un capitaine invisible : les consignes passent mal', { volume: 1.088, defense: 1.08, duree: 5 }),
      o('deplacer', 'Le déplacer dans le couloir', 'Le capitaine retrouve son poste, la défense s\'organise', 'Une ambiance moins festive', { defense: 0.92, volume: 0.92, duree: 5 }),
    ] },
  noel_cadeaux: { ico: '🎁', titre: 'L\'échange de cadeaux', quand: 'decembre',
    recit: 'Le comité social propose un échange de cadeaux avec un plafond de vingt dollars. Un joueur a déjà dépensé quatre-vingts en promettant que « ça paraîtra à peine ».',
    options: [
      o('respecter', 'Faire respecter le plafond', 'Un vestiaire équitable, moins de querelles', 'Un joueur déçu qui tire moins', { discipline: 0.84, finition: 0.94, duree: 5 }),
      o('laisser', 'Laisser le généreux faire', 'Un vestiaire ému et reconnaissant qui lance fort', 'Des jaloux, donc des têtes chaudes', { finition: 1.08, discipline: 1.175, duree: 5 }),
    ] },
  octobre_cible: { ico: '🎯', titre: 'La cible de l\'entrée du vestiaire', quand: 'octobre',
    recit: 'Quelqu\'un a installé une cible de fléchettes à l\'entrée du vestiaire, à hauteur de visage. Le préposé à l\'équipement a laissé une note : « pas de commentaire ».',
    options: [
      o('retirer', 'La retirer', 'Un vestiaire sûr, moins de blessures', 'Des gars qui boudent et tirent moins', { blessure: 0.808, finition: 0.94, duree: 6 }),
      o('garder', 'La garder', 'Un vestiaire qui rit et tire de partout', 'Des risques que personne ne mesure', { volume: 1.08, blessure: 1.24, duree: 6 }),
    ] },
  octobre_jeunesse: { ico: '🧒', titre: 'La visite de l\'équipe mineure', quand: 'octobre mars',
    recit: 'Une équipe de hockey mineur visite le vestiaire à la fin de la pratique, avec des cartes à signer. Elle reste une heure de plus que prévu.',
    options: [
      o('rester', 'Prendre le temps de signer', 'Un vestiaire ému et motivé', 'Des jambes qui piétinent une heure de plus', { finition: 1.08, energie: 1.112, duree: 4 }),
      o('ecourter', 'Écourter la visite', 'Des jambes reposées', 'Des enfants déçus et des joueurs un peu gênés', { energie: 0.888, finition: 0.94, duree: 4 }),
    ] },
  mars_tournee: { ico: '🗺️', titre: 'La dernière tournée', quand: 'mars',
    recit: 'La dernière tournée de la saison comprend quatre villes en cinq jours, dont une pour laquelle personne n\'a de souvenir. Le préposé aux horaires jure que la ville existe.',
    options: [
      o('serre', 'Garder l\'horaire serré', 'Un groupe qui reste dans sa bulle et lance', 'L\'usure des jambes grimpe', { volume: 1.088, energie: 1.16, duree: 6 }),
      o('repos', 'Ajouter une journée de repos', 'Des jambes reposées, moins de blessures', 'Un rythme interrompu, moins de lancers', { energie: 0.84, blessure: 0.84, volume: 0.913, duree: 6 }),
    ] },
};

/** Les dilemmes : { cle: { ico, titre, irl, recit, quand: [moments], etat: [états], cible?, options } }. */
const DILEMMES = Object.fromEntries(Object.entries(DILEMMES_BRUTS).map(([cle, d]) => {
  const { quand, etat, ...reste } = d;
  return [cle, { irl: null, ...reste, quand: mots(quand), etat: etat ? etat.split(' ') : [] }];
}));

/* ======================================================================
   LES ÉCHANGES : la causerie du vestiaire et le point de presse
   [moment, ouverture du coach, question du journaliste, réponse du coach]
   victoire · defaite · raclee (une défaite sans appel) · serieDefaites
   · blanchissage (ton gardien n'a rien accordé) · derniereChance (avant un
   match qu'on ne peut pas perdre : aucune ouverture ne dit le résultat).
   ====================================================================== */
const ECHANGES_BRUTS = [
  // ---- Après une victoire ----
  ['victoire', 'Je tiens d\'abord à remercier les joueurs pour leur effort ce soir.',
    'Peut-on dire que la victoire est une conséquence directe du fait que le match a eu lieu ?',
    'Le match a eu lieu, oui. Je ne ferai pas le lien.'],
  ['victoire', 'On a joué un match complet, de la mise au jeu jusqu\'à la sirène.',
    'Quelle est la place du hasard dans une soirée où la rondelle est ronde ?',
    'La rondelle est plate. Le reste, je ne sais pas.'],
  ['victoire', 'Les gars ont respecté le plan de match, et c\'est ce qu\'on voulait.',
    'Le plan de match était-il, selon vous, le même que celui de {autre} ?',
    'Non. Sinon on aurait fini à égalité.'],
  ['victoire', 'Je suis satisfait du travail accompli par l\'ensemble du groupe.',
    'Satisfait au sens de « content » ou au sens de « suffisamment rempli » ?',
    'Content. Mais suffisamment, aussi.'],
  ['victoire', 'On a bien géré les moments importants, surtout en troisième période.',
    'Qu\'est-ce qui, selon vous, définit un moment important ?',
    'Quand il reste peu de temps et que ça compte.'],
  ['victoire', 'C\'est une victoire d\'équipe, et je le dis sans réserve.',
    'Une équipe, c\'est combien de personnes, exactement ?',
    'Vingt joueurs et quelques autres. Je n\'ai pas le chiffre exact.'],
  ['victoire', 'Nous avons contenu {autre} dans nos trois zones.',
    'Y a-t-il une quatrième zone dont vous voudriez nous parler ?',
    'Non. Pas ce soir.'],
  ['victoire', 'Je suis fier de la façon dont mes joueurs ont répondu à l\'adversité.',
    'Quelle était la nature de l\'adversité, précisément ?',
    'Le pointage, à un moment.'],
  ['victoire', 'Les deux points sont importants, comme tous les points.',
    'Vous parlez de points au classement ou de points d\'honneur ?',
    'Au classement. L\'honneur, on le compte plus tard.'],
  ['victoire', 'On est contents de ce qu\'on a présenté devant nos partisans.',
    'Les partisans ont-ils été informés qu\'ils ont assisté à une victoire ?',
    'Ils ont vu le tableau. Je pense qu\'ils ont compris.'],
  ['victoire', 'Le gardien a fait les arrêts quand il le fallait.',
    'À quel moment, précisément, est-ce qu\'il le fallait ?',
    'Quand ils tiraient.'],
  ['victoire', 'On n\'a pas changé grand-chose, et ça a plutôt bien fonctionné.',
    'Peut-on en conclure que le changement est surévalué ?',
    'Seulement ce soir.'],
  ['victoire', 'On prend la victoire, on la range, et on passe au prochain.',
    'Où range-t-on exactement une victoire ?',
    'Dans le tableau des victoires. Il y a de la place.'],
  ['victoire', 'Un match comme celui-là fait du bien au vestiaire.',
    'Le vestiaire était-il, avant, dans un état de manque ?',
    'Un petit manque, oui. Pas un grand.'],

  // ---- Après une défaite ----
  ['defaite', 'On a perdu ce soir, et il n\'y a pas lieu de l\'enrober.',
    'Peut-on dire que la défaite est le contraire de la victoire ?',
    'On peut le dire, oui.'],
  ['defaite', 'Je tiens à féliciter {autre}, qui a mérité la victoire.',
    'Mérité en vertu de quel critère ?',
    'Le pointage.'],
  ['defaite', 'On n\'a pas su convertir nos occasions, et ça se paie.',
    'Combien coûte une occasion non convertie ?',
    'Un but, en général.'],
  ['defaite', 'Il y a des choses à corriger, et on va s\'y mettre dès demain.',
    'Quelle heure, demain ?',
    'Dix heures. Peut-être dix heures et quart.'],
  ['defaite', 'Les gars ont donné leur maximum, et ce n\'était pas assez.',
    'Y a-t-il un moyen de donner plus que le maximum ?',
    'Si je le connaissais, je le leur aurais dit.'],
  ['defaite', 'On a manqué de constance dans certaines séquences.',
    'Une séquence peut-elle manquer de constance et rester une séquence ?',
    'Moins longtemps, oui.'],
  ['defaite', 'On aurait pu faire mieux, et on le sait.',
    'Au moment où vous le savez, est-ce avant ou après ?',
    'Après. Avant, je ne le savais pas.'],
  ['defaite', 'Je ne chercherai pas d\'excuse, parce que le pointage est le pointage.',
    'Et si le pointage avait été différent ?',
    'Alors ce serait un autre pointage.'],
  ['defaite', 'On a perdu un match serré, et c\'est plus frustrant qu\'un match facile.',
    'Un match facile à perdre existe-t-il ?',
    'Je n\'en ai pas rencontré. Mais je cherche.'],
  ['defaite', 'Le gardien adverse nous a empêchés de marquer à quelques reprises.',
    'Était-ce volontaire de sa part, selon vous ?',
    'Je pense que oui. C\'est son travail.'],
  ['defaite', 'Je suis déçu du résultat, pas du travail.',
    'Peut-on séparer le résultat du travail dans un sport collectif ?',
    'Pas toujours. Ce soir, un peu.'],
  ['defaite', 'Il va falloir être meilleurs dans les détails.',
    'Quel détail, plus précisément ?',
    'Je préfère ne pas le dire. Il se reconnaîtra.'],
  ['defaite', 'On a eu notre chance, et on ne l\'a pas saisie.',
    'Où se trouvait cette chance au moment où elle a été offerte ?',
    'Devant le filet.'],
  ['defaite', 'On ne perd pas de vue ce qu\'on veut accomplir cette saison.',
    'Vous perdez des yeux ce que vous voulez accomplir ?',
    'Non. Seulement des matchs.'],

  // ---- Après une raclée ----
  ['raclee', 'Ce soir, nous avons été dominés, et je le dis clairement.',
    'Quel mot utiliseriez-vous pour décrire l\'ampleur de la défaite, si vous deviez en choisir un seul ?',
    'Un seul ? Ampleur.'],
  ['raclee', 'Je m\'excuse auprès des partisans pour ce qu\'ils ont dû regarder.',
    'Est-ce que ce sont des excuses de principe ou des excuses d\'affaires ?',
    'De principe. Les affaires, c\'est le propriétaire.'],
  ['raclee', 'On n\'a jamais été dans le match, et il ne sert à rien de dire le contraire.',
    'Dans quel match étiez-vous, alors ?',
    'Un autre. Plus court.'],
  ['raclee', 'Les gars sont déçus, et moi le premier.',
    'Peut-on être déçu plus que le premier ?',
    'Je ne crois pas. Je m\'étais mis en tête de la file.'],
  ['raclee', 'On va regarder la bande vidéo et en tirer des leçons.',
    'La bande vidéo est-elle obligatoire ?',
    'Pour moi, oui. Pour les joueurs, c\'est une suggestion.'],
  ['raclee', 'Il y a eu un bris dans notre système, et ce bris a été général.',
    'Un bris peut-il être à la fois local et général ?',
    'Il l\'a été ce soir.'],
  ['raclee', 'Ce n\'est pas le genre de soirée qu\'on souhaite revoir.',
    'La soirée sera-t-elle tout de même revue, dans un cadre professionnel ?',
    'Oui. À regret, et à haute vitesse.'],
  ['raclee', 'On a eu un mauvais match, et je ne cherche pas à le minimiser.',
    'Un mauvais match peut-il être qualifié de « bon » dans un sens précis ?',
    'Non. Pas dans celui-là.'],
  ['raclee', 'Le pointage est sévère, mais il reflète ce qui s\'est passé.',
    'Quelle serait selon vous la sévérité idéale d\'un pointage ?',
    'Moindre. Et dans l\'autre sens.'],
  ['raclee', 'On a été battus à plate couture, et je n\'ai aucune excuse à offrir.',
    'À plate couture, c\'est une expression qui vient de quelle couture exactement ?',
    'Je l\'ignore. Elle m\'a semblé juste.'],
  ['raclee', 'Je suis le responsable, et c\'est à moi de trouver des réponses.',
    'Avez-vous commencé à chercher ?',
    'J\'ai regardé sous quelques papiers. Pas encore sous les gros.'],
  ['raclee', 'Les joueurs vont se remettre à la tâche demain matin.',
    'Y aura-t-il des tâches particulières ?',
    'Patiner. Avec plus de conviction.'],
  ['raclee', 'On a manqué de jambes, de lecture de jeu et de plusieurs autres choses.',
    'Pouvez-vous nous nommer une chose dont vous n\'avez pas manqué ?',
    'De volonté de rentrer chez nous.'],
  ['raclee', 'Je préfère ne pas commenter les détails de la soirée.',
    'Et les généralités ?',
    'Je préfère ne pas non plus.'],

  // ---- Après une série de défaites ----
  ['serieDefaites', 'Nous traversons une période difficile, et il faut le dire.',
    'La période difficile a-t-elle une date de fin prévue ?',
    'Je ne l\'ai pas reçue. Je la demanderai.'],
  ['serieDefaites', 'Les joueurs travaillent fort, et les résultats vont suivre.',
    'Les résultats vous ont-ils fait part de leurs intentions ?',
    'Non. Ils restent discrets.'],
  ['serieDefaites', 'On ne panique pas, on fait ce qu\'on doit faire.',
    'Combien de défaites faut-il pour que la panique devienne appropriée ?',
    'Je n\'ai pas de seuil. J\'ai une tolérance.'],
  ['serieDefaites', 'Je crois en ce groupe, comme au premier jour.',
    'Quel était ce premier jour, au juste ?',
    'Un jour de camp. Il faisait beau.'],
  ['serieDefaites', 'On a changé certaines choses, et on en changera d\'autres.',
    'Comment savez-vous lesquelles changer ?',
    'Je commence par celles qui ne fonctionnent pas.'],
  ['serieDefaites', 'Chaque match est une nouvelle occasion de renverser la vapeur.',
    'La vapeur est-elle réversible, en principe ?',
    'En principe. En pratique, on essaie.'],
  ['serieDefaites', 'Les gars ont encore de la confiance, et c\'est l\'essentiel.',
    'De la confiance en quoi, plus précisément ?',
    'En moi. Et en la rondelle. Dans cet ordre.'],
  ['serieDefaites', 'On regarde ça un match à la fois, parce qu\'on n\'a pas le choix.',
    'Vous aurait-il été possible de regarder deux matchs à la fois ?',
    'Je n\'ai qu\'un écran.'],
  ['serieDefaites', 'Ce n\'est pas une question de talent, c\'est une question d\'exécution.',
    'L\'exécution et le talent sont-ils, selon vous, deux personnes différentes ?',
    'Souvent. Elles ne se parlent pas toujours.'],
  ['serieDefaites', 'On va traverser ça ensemble, et on en sortira plus forts.',
    'Plus forts que quoi ?',
    'Que maintenant.'],
  ['serieDefaites', 'Je n\'ai pas peur pour mon poste, je me concentre sur mon travail.',
    'Quelqu\'un vous a-t-il demandé de ne plus avoir peur ?',
    'Ma sœur. Elle m\'a envoyé un message.'],
  ['serieDefaites', 'Nous avons tenu une rencontre d\'équipe pour clarifier les attentes.',
    'Quelles étaient les attentes, avant la rencontre ?',
    'Floues. Elles sont maintenant claires et inquiétantes.'],
  ['serieDefaites', 'Le plus important, c\'est de garder les pieds sur terre.',
    'Les patins comptent-ils comme des pieds, dans ce cas ?',
    'Seulement quand ils sont bien aiguisés.'],
  ['serieDefaites', 'On va se serrer les coudes et travailler plus intelligemment.',
    'Qu\'est-ce qu\'un travail intelligent, par opposition à un travail dont l\'intelligence est moindre ?',
    'Un travail qui rentre au filet.'],

  // ---- Après un blanchissage ----
  ['blanchissage', 'Je tiens à souligner le travail de notre gardien, qui a été solide toute la soirée.',
    'Peut-on considérer qu\'un zéro est un chiffre plein ?',
    'Dans le cas d\'un blanchissage, oui. C\'est le chiffre le plus plein.'],
  ['blanchissage', 'On a limité leurs chances, et notre gardien a fait le reste.',
    'Quel pourcentage du zéro revient au gardien ?',
    'Tout le zéro. Les défenseurs ont les virgules.'],
  ['blanchissage', 'Personne ne marque contre nous ce soir, et c\'est un bon signe.',
    'Ce soir seulement, ou pour toute éternité ?',
    'Ce soir. L\'éternité, je la prends match par match.'],
  ['blanchissage', 'Notre gardien a été exceptionnel, et le groupe devant lui l\'a bien épaulé.',
    'Un gardien exceptionnel ne risque-t-il pas de rendre les autres ordinaires ?',
    'Il les rend utiles. C\'est mieux.'],
  ['blanchissage', 'Un blanchissage, ça se bâtit à plusieurs.',
    'Y a-t-il un plan de construction ?',
    'Oui. Il comprend un gardien et des briques.'],
  ['blanchissage', 'On a gardé notre filet propre ce soir, et c\'est ce qu\'on voulait.',
    'Le filet était-il sale auparavant ?',
    'Un peu, oui. De buts.'],
  ['blanchissage', 'Ce zéro appartient à tout le monde, mais surtout à notre gardien.',
    'Comment procède-t-on à un partage de zéro ?',
    'Avec délicatesse. Et sans calculatrice.'],
  ['blanchissage', 'On a joué un hockey solide devant notre gardien, et il nous l\'a bien rendu.',
    'Qu\'est-ce qu\'un gardien rend, exactement ?',
    'Des rondelles. Aux autres.'],
  ['blanchissage', 'C\'est notre meilleur match défensif, et on espère qu\'il en viendra d\'autres.',
    'Vous espérez le même match, ou un autre, mais meilleur ?',
    'Le même. Je n\'ai pas d\'ambition dans l\'autre sens.'],
  ['blanchissage', 'On a fermé la porte à {autre} du début à la fin.',
    'La porte a-t-elle été fermée à clé ou simplement tirée ?',
    'À clé. Et jetée dans la rivière.'],
  ['blanchissage', 'Notre gardien ne s\'est pas laissé distraire, même par les moments de calme.',
    'Un moment de calme peut-il être distrayant ?',
    'Pour un gardien, oui. Surtout quand il dure.'],
  ['blanchissage', 'Un zéro, c\'est le plus beau chiffre pour un gardien.',
    'Et pour un attaquant ?',
    'Non.'],
  ['blanchissage', 'Le gardien et les défenseurs ont parlé d\'une seule voix ce soir.',
    'Quelle était cette voix ?',
    'Basse. Et calme.'],
  ['blanchissage', 'On a donné très peu de chances à {autre}, et le gardien s\'est occupé du reste.',
    'Doit-on s\'attendre à ce que le zéro soit encadré ?',
    'Je crois que oui. Il a déjà demandé un cadre.'],

  // ---- Au match de la dernière chance ----
  ['derniereChance', 'Ce soir, il n\'y a pas de lendemain, et tout le monde le sait.',
    'Peut-on tout de même prévoir quelque chose pour demain, par prudence ?',
    'Un déjeuner. Rien de plus.'],
  ['derniereChance', 'On a tout à gagner et rien à perdre, ou l\'inverse.',
    'Lequel des deux, précisément ?',
    'Je confirmerai après le match.'],
  ['derniereChance', 'Nous jouons ce soir le match le plus important de la saison, jusqu\'au prochain.',
    'Et si le prochain n\'existe pas ?',
    'Alors celui-là sera le plus important pour toujours.'],
  ['derniereChance', 'Les joueurs savent ce qu\'il y a en jeu, et ils sont prêts.',
    'Savent-ils aussi ce qu\'il n\'y a pas en jeu ?',
    'Je leur ai demandé de ne pas y penser.'],
  ['derniereChance', 'On joue pour notre saison, et on joue pour nos partisans.',
    'Y a-t-il une saison de rechange, au besoin ?',
    'Non. Je l\'ai demandé. C\'est écrit au calendrier.'],
  ['derniereChance', 'Je demande aux gars de rester simples ce soir.',
    'Qu\'est-ce qui est simple, selon vous, à un moment pareil ?',
    'Patiner. Passer. Ne pas se demander pourquoi.'],
  ['derniereChance', 'Nous n\'avons pas d\'autre choix que de gagner, et nous le ferons de notre mieux.',
    'Y a-t-il un moyen de gagner de son pire ?',
    'Je l\'ai déjà vu. Je préfère le mieux.'],
  ['derniereChance', 'Chaque présence compte, et chaque présence est un match en soi.',
    'Combien de matchs en soi prévoyez-vous ce soir ?',
    'Environ soixante. Et une prolongation, au besoin.'],
  ['derniereChance', 'On a dit aux gars de profiter du moment, parce que ces moments-là sont rares.',
    'Rares comme dans « précieux » ou rares comme dans « mal cuits » ?',
    'Précieux. Mal cuits, on verra.'],
  ['derniereChance', 'On ne change rien à notre routine, sauf ce qu\'on doit changer.',
    'Qu\'est-ce que vous devez changer, au juste ?',
    'La façon dont on perd. En principe, on ne perd plus.'],
  ['derniereChance', 'Le vestiaire est calme, et c\'est ce que je voulais.',
    'Calme comme dans « apaisé » ou calme comme dans « sous une dalle » ?',
    'Dans le premier sens. J\'ai vérifié sous la dalle.'],
  ['derniereChance', 'Ce soir, on joue sans regret, parce qu\'on n\'aura pas le temps d\'en avoir.',
    'Le regret est-il réservé à ceux qui ont du temps ?',
    'Le regret demande du temps. Ce soir, on n\'en a pas.'],
  ['derniereChance', 'Le but, ce soir, c\'est de jouer notre meilleur hockey de l\'année.',
    'Est-il possible de le jouer en avance sur l\'année ?',
    'Je suis ouvert à l\'idée. On y travaille.'],
  ['derniereChance', 'Tout est possible ce soir, et c\'est ce qui rend le sport beau.',
    'Tout, y compris l\'impossible ?',
    'Je n\'ai pas vérifié. Je m\'en tiens au possible.'],
];

/** Les échanges : { id, quand, ouverture, question, reponse } — `quand` est l'une des six occasions. */
const ECHANGES = ECHANGES_BRUTS.map(([quand, ouverture, question, reponse], i) => ({ id: `e${i + 1}`, quand, ouverture, question, reponse }));

/* ======================================================================
   LES TIRAGES — purs, sans `hasard()` : même contexte, même graine, même pièce.
   ====================================================================== */
const sontLa = (pieceEtat, c) => !pieceEtat.length || pieceEtat.some(e => (c.etat || []).includes(e));
const dejaVu = (c, id) => !!c.deja && (Array.isArray(c.deja) ? c.deja.includes(id) : c.deja.has(id));
/* Une pièce qui nomme un état vrai passe devant celles qui n'en disent rien : c'est elle qui est « juste ». */
const priorite = (piece, c) => (piece.etat.length && sontLa(piece.etat, c) ? -1 : 0);

/**
 * Où en est la saison : le moment qu'une journée de la ligue (`jour` sur `N`) habille.
 * Ce n'est qu'un découpage : le camp, les séries, l'élimination et la Coupe
 * viennent de la phase, pas de la journée — le contrôleur les passe tels quels.
 */
export function momentDeSaison(jour, N) {
  const f = N > 0 ? jour / N : 0;
  return f < 0.15 ? 'octobre' : f < 0.55 ? 'decembre' : f < 0.72 ? 'echeance' : 'mars';
}

/**
 * Les courriels du jour, du plus juste au moins juste, d'un expéditeur chacun.
 * contexte : { moment, etat: [], eq, autre, deja: [ids] } — `n` au plus.
 * Chaque courriel sort prêt pour la boîte : { id, de: {ico, nom}, sujet, corps }.
 */
export function courrielsDe(contexte, graineDuJeu, n = 2) {
  const c = contexte || {};
  const pool = COURRIELS.filter(x => x.quand.includes(c.moment) && sontLa(x.etat, c) && !dejaVu(c, x.id))
    .map(x => ({ x, k: rang(graineDuJeu, c, x.id) + priorite(x, c) }))
    .sort((a, b) => a.k - b.k);
  const out = [], vus = new Set();
  for (const { x } of pool) {
    if (out.length >= n) break;
    if (vus.has(x.de)) continue;
    vus.add(x.de);
    out.push({ id: x.id, de: EXPEDITEURS[x.de], sujet: remplir(x.sujet, c), corps: remplir(x.corps, c) });
  }
  return out;
}

/**
 * Les dilemmes sont des entrées de `MOMENTS` (js/sim.js) : `momentDuJour` les tire parmi les autres aux
 * journées des moments, et `faits` ne les laisse sortir que quand leur moment de saison et leur état d'équipe
 * sont vrais. `c` est ce que `faitsAvant` (js/saison.js) lit sur tes matchs : la journée `J` sur `N`, la
 * série de victoires `serieV` et la série de défaites `serieD`. L'état « plafond » et « blessés » ne se lisent
 * pas encore : un dilemme qui ne dit que cela ne sort pas.
 */
const momentsOuverts = f => [f < 0.3 && 'octobre', f >= 0.15 && f < 0.55 && 'decembre', f >= 0.45 && f < 0.72 && 'echeance', f >= 0.6 && 'mars'].filter(Boolean);
const etatVrai = (e, c) => (e === 'sequence' ? c.serieV >= 3 : e === 'panne' ? c.serieD >= 3 : false);
export const MOMENTS_VIE = Object.fromEntries(Object.entries(DILEMMES).map(([cle, d]) => {
  const { quand, etat, ...entree } = d;
  return [`vie_${cle}`, { ...entree, faits: c => (c.N > 0 && momentsOuverts(c.J / c.N).some(m => quand.includes(m)) && (!etat.length || etat.some(e => etatVrai(e, c))) ? {} : null) }];
}));

/**
 * L'échange d'après-match : { id, ouverture, question, reponse } (gabarits remplis), ou null.
 * contexte : { occasion, eq, autre, deja: [ids] } — `occasion` : victoire, defaite, raclee, serieDefaites, blanchissage ou derniereChance.
 */
export function echangeDe(contexte, graineDuJeu) {
  const c = contexte || {};
  const pool = ECHANGES.filter(e => e.quand === c.occasion && !dejaVu(c, e.id))
    .map(e => ({ e, k: graine(`${graineDuJeu}|${c.occasion}|${e.id}`) }))
    .sort((a, b) => a.k - b.k);
  if (!pool.length) return null;
  const e = pool[0].e;
  return { id: e.id, ouverture: remplir(e.ouverture, c), question: remplir(e.question, c), reponse: remplir(e.reponse, c) };
}
