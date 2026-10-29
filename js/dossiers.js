/*
 * LES DOSSIERS DE LA SEMAINE (V10, tranche 5 — docs/refonte-v10.md § 4). Les événements quittent la banque : ce
 * ne sont plus des cartes qu'on tire, ce sont des choix d'À faire, dits par une voix (les scènes du Jalon M,
 * js/scenes.js). Au bureau d'un lundi tiré de la graine (`semaineAHistoire`, V20), un dossier s'ouvre s'il est VRAI : trois
 * soirs sur la route, l'infirmerie qui déborde, un rival dans la semaine, la caisse à sec. V20 : c'est la seule source.
 *
 * Chaque dossier :
 *   de       la voix qui la demande (`EXPEDITEURS`, js/vie-gm.js)
 *   quand    ce qu'elle lit dans les faits du lundi (`faits`, posés par js/saison.js sur ce qui est déjà joué et la
 *            cédule déjà connue — rien d'avance) ; vrai, il peut s'ouvrir
 *   fait     la ligne de chiffres sous la citation, en vrais chiffres
 *   mots     les répliques de la voix : une opinion, aucun chiffre (check_clarte § 5)
 *   joueur   (V11, tranche 4) le joueur que le dossier nomme, lu dans les faits (`{ n, cle }`) : sa disette, ses
 *            punitions, ses jambes, son contrat, sa place sous sa zone — un fait de SES feuilles
 *   maison   (oct.) le sous-onglet où il se règle quand son sujet a sa maison (V12-3 : l'argent et le congédiement au
 *            proprio, les blessés à l'infirmerie) ; sans elle, au vestiaire
 *   options  deux ou trois réponses, sur les canaux qui existent ; leur `bon` nomme les lignes vertes que le moteur montre
 *            (tirs, tirs contre, précision, arrêts, punitions, jambes, blessures), leur `prix` les rouges — `check_mots` — un effet (souvent d'un moment, `si`, js/sim.js
 *            `MOMENTS_SI`, qui ne joue que ses soirs), des gestes (`action` ; `energie` va au joueur nommé), des
 *            jetons (`gain`, un prix s'il est négatif), ou rien ; et, quand il nomme un joueur, ce qui lui arrive à
 *            LUI (`lui` : ses tirs, sa précision, ses passes, sa défense, ses blessures — `surJoueur`, js/sim.js)
 * Elles passent par la même porte que les dilemmes (`familleDeMoment`, `effetDeMoment`, `appliquerGestes`) : aucune
 * mécanique neuve. `check_places` mesure chaque réponse en paires, sous la borne d'une commune (1 V).
 *
 *   faits : { n, jambes, pire: { n, cle, j }, blesses: [{ n, m }], soirs, dos, visiteur, domicile, rival, bete,
 *             caisse, masse: { espace, libre, lourd: { n, cle, sal } }, defaites, coach, coachs: [{ cle, nom }], dernier: { pour, contre, adv }, rang, equipes,
 *             boude: { n, cle, zone, ou, pts, m }, puni: { n, cle, pun, m }, muet: { n, cle, sal, pts, m },
 *             vedette: { n, cle, fait }, gardien: { n, cle, fait } }
 *   (un joueur absent des faits : null)
 *
 * TOUJOURS UN JOUEUR (V19, tranche 5 ; JP : *les incidents, toujours liés à des joueurs*). Un dossier d'équipe s'accroche
 * à celui qui le porte dans les feuilles : ton meilleur pointeur des dix derniers matchs (`vedette`), le gardien du dernier
 * soir (`gardien`), le plus bas en jambes (`pire`), le plus gros contrat. Seuls trois dossiers n'en nomment pas (la liste blanche
 * de `check_incidents`) : la caisse qui déborde, la tête du coach et la pratique du mardi. Nommer ne change aucune
 * réponse : l'effet d'un dossier va au joueur que ses réponses visent (`lui`, `action.energie`), et elles ne visent que ceux d'avant.
 */
import { hache } from './util.js';

/* Les faits d'un joueur se lisent sur ses FENETRE_JOUEUR derniers matchs ; la chicane, à PUNITIONS_CHICANE punitions. */
export const FENETRE_JOUEUR = 10, PUNITIONS_CHICANE = 4;
/* La masse salariale s'ouvre sous `ESPACE_MINCE` d'espace ; la tête du coach, à `DEFAITES_TETE` défaites de suite. */
const ESPACE_MINCE = 1_500_000, DEFAITES_TETE = 4;

/* Le fait d'un joueur, à la suite de la ligne d'un dossier d'équipe (`vedette`, `gardien` : js/saison.js `faitsDuLundi`). */
const avec = x => (x ? ` · ${x.fait}` : '');
export const DOSSIERS = {
  laRoute: {
    de: 'ph', ico: '🧳', titre: 'La semaine sur la route',
    quand: f => f.visiteur >= 3,
    joueur: f => f.pire,
    fait: f => `${f.visiteur} matchs à l'étranger cette semaine · jambes ${f.jambes}${f.pire ? ` · ${f.pire.n} : ${f.pire.j}` : ''}`,
    mots: ['Les valises sont faites, les jambes, pas encore. Je veux des bas de compression dans chaque sac.',
      'L\'autobus, l\'avion, l\'hôtel. Si on ne fait rien, on va arriver au troisième soir sur les genoux.'],
    options: [
      { cle: 'compression', nom: 'Les bas de compression', bon: 'Les jambes tiennent sur la route', si: 'visiteur', duree: 6, energie: 0.52, action: { energie: 12 } },
      { cle: 'pratique', nom: 'Pratiquer à chaque arrêt', bon: 'Plus de précision : les mains restent chaudes', prix: 'Les jambes paient', si: 'visiteur', duree: 6, finition: 1.4, energie: 1.31 },
    ],
  },
  laSemaineChezNous: {
    de: 'co', ico: '🏟', titre: 'La semaine à la maison',
    quand: f => f.domicile >= 3,
    joueur: f => f.vedette,
    fait: f => `${f.domicile} matchs à domicile cette semaine${avec(f.vedette)}`,
    mots: ['Toute la semaine chez nous : les commanditaires veulent voir les gars, et la foule veut du spectacle.',
      'On a la glace à nous pour une semaine. Dis-moi si on vend des billets ou si on ferme les portes.'],
    options: [
      { cle: 'famille', nom: 'La soirée familiale', bon: 'La caisse se remplit', prix: 'Moins de précision : les gars signent des autographes', gain: 12, si: 'domicile', duree: 6, finition: 0.93 },
      { cle: 'huis', nom: 'Les pratiques à huis clos', bon: 'Plus de précision : le plan de match, répété', si: 'domicile', duree: 6, finition: 1.44 },
    ],
  },
  leDosADos: {
    de: 'en', ico: '🔁', titre: 'Deux soirs de suite',
    quand: f => f.dos >= 1,
    joueur: f => f.pire,
    fait: f => `${f.dos} dos-à-dos cette semaine · jambes ${f.jambes}${f.pire ? ` · ${f.pire.n} : ${f.pire.j}` : ''}`,
    mots: ['Le deuxième soir, c\'est là qu\'on perd des matchs. Je veux savoir qui joue avant de monter dans l\'autobus.',
      'Deux soirs de suite. Moi, je partagerais la glace ; les vedettes vont chialer.'],
    options: [
      { cle: 'partager', nom: 'Partager la glace', bon: 'Le quatrième trio porte le deuxième soir, les jambes tiennent', prix: 'Tes vedettes jouent moins', si: 'dosADos', duree: 10, F: [0.88, 0.97, 1.08, 1.25], energie: 0.51, action: { energie: 15 } },
      { cle: 'vedettes', nom: 'Les vedettes, les deux soirs', bon: 'Le premier trio ne sort pas', prix: 'Les jambes lâchent le deuxième soir', si: 'dosADos', duree: 10, F: [1.2, 1.05, 0.9, 0.8], energie: 1.3 },
    ],
  },
  lInfirmerie: {
    de: 'me', ico: '🚑', titre: 'L\'infirmerie déborde', maison: 'infirmerie',
    quand: f => f.blesses.length >= 2,
    joueur: f => f.blesses[0],
    fait: f => `🚑 ${f.blesses.slice(0, 3).map(b => `${b.n} ${b.m} m.`).join(', ')}${f.blesses.length > 3 ? ` et ${f.blesses.length - 3} autre${f.blesses.length > 4 ? 's' : ''}` : ''}`,
    mots: ['Ma table est pleine. Il y a un spécialiste à Toronto, mais il ne travaille pas gratuitement.',
      'Je manque de lits. Ou on paie le spécialiste, ou on joue plus prudent le temps qu\'ils reviennent.'],
    options: [
      { cle: 'specialiste', nom: 'Le spécialiste de Toronto', bon: 'Moins de blessures', gain: -15, si: 'infirmerie', duree: 10, blessure: 0.55 },
      { cle: 'prudent', nom: 'Jouer prudent', bon: 'Moins de tirs contre, plus d\'arrêts : on ferme le jeu sans eux', prix: 'Moins de tirs : l\'attaque s\'éteint', si: 'infirmerie', duree: 10, defense: 0.92, volume: 0.94 },
    ],
  },
  leRival: {
    de: 'pt', ico: '⚔', titre: 'Le rival s\'en vient',
    quand: f => !!f.rival,
    joueur: f => f.vedette,
    fait: f => `Contre ${f.rival} cette semaine${avec(f.vedette)}`,
    mots: ['Contre eux, on veut voir du sang sur la glace. Pas une partie de cartes.',
      'On a nos billets depuis un mois. Faites-leur mal, ou au moins faites-les tirer de loin.'],
    options: [
      { cle: 'chauffer', nom: 'Chauffer la foule', bon: 'Plus de tirs : on les bombarde', prix: 'Plus de punitions : les têtes chaudes au cachot', si: 'rival', duree: 12, volume: 1.15, discipline: 1.3 },
      { cle: 'froid', nom: 'Garder la tête froide', bon: 'Moins de punitions : personne ne mord à l\'hameçon', si: 'rival', duree: 12, discipline: 0.7 },
    ],
  },
  laBeteNoire: {
    de: 'ca', ico: '😤', titre: 'Ta bête noire',
    quand: f => !!f.bete,
    joueur: f => f.vedette,
    fait: f => `Contre ${f.bete} cette semaine : ils t'ont battu deux fois${avec(f.vedette)}`,
    mots: ['Ils nous ont battus deux fois. Le vestiaire ne veut pas d\'une troisième.',
      'Je n\'ai pas oublié, et les gars non plus. Dis-moi comment on les règle.'],
    options: [
      { cle: 'comptes', nom: 'Régler nos comptes', bon: 'Plus de tirs et de mises en échec : on rentre dedans', prix: 'Plus de punitions : l\'arbitre le voit', si: 'beteNoire', duree: 30, volume: 1.12, robustesse: 1.6, discipline: 1.3 },
      { cle: 'tableau', nom: 'Les battre au tableau', bon: 'Plus de précision : leur gardien, on l\'a étudié', si: 'beteNoire', duree: 30, finition: 1.48 },
    ],
  },
  lesJambesLourdes: {
    de: 'ph', ico: '🦵', titre: 'Les jambes lourdes',
    quand: f => !!f.pire && f.pire.j < 80,
    joueur: f => f.pire,
    fait: f => `${f.pire.n} : jambes ${f.pire.j} · l'équipe : ${f.jambes}`,
    mots: ['Il y en a un qui patine dans le ciment. Une journée de congé, et je te le rends.',
      'Les jambes ne suivent plus. Moi, j\'annulerais la pratique ; l\'entraîneur ne sera pas content.'],
    options: [
      { cle: 'repos', nom: 'Un congé pour lui', bon: 'Ses jambes reviennent', prix: 'Il manque la pratique', action: { energie: 20 }, duree: 4, lui: { finition: 0.57 } },
      { cle: 'conge', nom: 'Annuler la pratique', bon: 'Les jambes reviennent', prix: 'Moins de précision : la structure rouille', action: { energieTous: 10 }, duree: 4, finition: 0.93 },
      { cle: 'bas', nom: 'La glace au bas de l\'alignement', bon: 'Les fatigués s\'assoient : le quatrième trio joue plus', prix: 'Tes vedettes jouent moins', si: 'jambesLourdes', duree: 12, F: [0.88, 0.97, 1.08, 1.2] },
    ],
  },
  lesJambesFraiches: {
    de: 'en', ico: '🌬', titre: 'Tout le monde est frais',
    quand: f => f.jambes >= 93,
    joueur: f => f.pire,
    fait: f => `Jambes ${f.jambes} · ${f.pire ? `le plus bas : ${f.pire.n}, ${f.pire.j}` : 'personne en bas'}`,
    mots: ['Les gars volent. C\'est le temps de pousser, ou de travailler la structure pendant qu\'ils ont du jus.',
      'Je n\'ai jamais vu le vestiaire aussi frais. On en profite comment ?'],
    options: [
      { cle: 'pousser', nom: 'On pousse', bon: 'Plus de tirs, de partout, les soirs frais', si: 'jambesFraiches', duree: 12, volume: 1.15 },
      { cle: 'systemes', nom: 'La structure', bon: 'Moins de tirs contre, plus d\'arrêts', prix: 'Moins de tirs, nous aussi', si: 'jambesFraiches', duree: 12, defense: 0.9 },
    ],
  },
  /*
   * LES DOSSIERS D'UN JOUEUR (V11, tranche 4 — docs/refonte-v11.md). JP : *les bonus et malus plus importants touchent
   * des joueurs et non l'équipe*. Le fait vient de SES feuilles (js/saison.js `faitsDuLundi`) ; le gros de chaque
   * réponse va à lui (`lui`), l'équipe n'en garde qu'un peu.
   */
  ilBoude: {
    de: 'en', ico: '😒', titre: 'Il boude',
    quand: f => !!f.boude,
    joueur: f => f.boude,
    fait: f => `${f.boude.n} : ${f.boude.zone}, au ${f.boude.ou} · ${f.boude.pts} point${f.boude.pts > 1 ? 's' : ''} en ${f.boude.m} matchs`,
    mots: ['Il ne dit plus bonjour en arrivant à l\'aréna. Il pense qu\'il mérite mieux que le bas de l\'alignement.',
      'Il boude dans son coin du vestiaire. Moi, je lui parlerais ; ou on le laisse mijoter, et il comprendra.'],
    options: [
      { cle: 'parler', nom: 'Lui parler', bon: 'Il se remet au travail', prix: 'Un souper au restaurant, sur le bras du club', gain: -6, duree: 8, lui: { lancers: 1.43, finition: 1.17 } },
      // L'AUDACE (V20) : un dé, le joueur nommé gagne ou perd gros ; l'équipe n'en reçoit rien.
      { cle: 'premier', nom: 'Lui donner le premier trio', bon: 'Si ça passe : il tire plus, et plus juste', prix: 'Sinon : il s\'écrase, moins de tirs et de précision',
        pari: { chance: 3 / 6, gagne: { duree: 8, lui: { lancers: 1.45, finition: 1.3 } }, perd: { duree: 8, lui: { lancers: 0.6, finition: 0.75 } } } },
    ],
  },
  laChicane: {
    de: 'ca', ico: '🥊', titre: 'La chicane au vestiaire',
    quand: f => !!f.puni,
    joueur: f => f.puni,
    fait: f => `${f.puni.n} : ${f.puni.pun} punitions en ${f.puni.m} matchs`,
    mots: ['Il nous coûte des avantages numériques, et les gars commencent à le lui dire en face.',
      'Ça a brassé dans le vestiaire après le match. Il faut que quelqu\'un tranche, et ce n\'est pas moi.'],
    options: [
      { cle: 'calmer', nom: 'Lui mettre la laisse', bon: 'Moins de punitions : les bâtons restent en bas', prix: 'Il joue sur des œufs', duree: 8, discipline: 0.85, lui: { lancers: 0.85, defense: 1.06 } },
      { cle: 'laisser', nom: 'Le laisser jouer à sa façon', bon: 'Plus de mises en échec : il fait peur à leurs gars', prix: 'Plus de punitions : il retourne au cachot', duree: 8, robustesse: 0.7, discipline: 1.15, lui: { lancers: 1.15 } },
    ],
  },
  lAgent: {
    de: 'ag', ico: '📞', titre: 'L\'agent appelle',
    quand: f => !!f.muet,
    joueur: f => f.muet,
    fait: f => `${f.muet.n} : ${f.muet.sal} · ${f.muet.pts} point${f.muet.pts > 1 ? 's' : ''} en ${f.muet.m} matchs`,
    mots: ['Mon client est payé pour marquer, et vous le faites jouer comme un plombier. Je veux une explication.',
      'Je reçois des appels d\'autres clubs à son sujet. Vous voulez le garder heureux, oui ou non ?'],
    options: [
      { cle: 'defendre', nom: 'Le défendre en public', bon: 'Il retrouve sa confiance', prix: 'Un souper avec l\'agent, sur le bras du club', gain: -10, duree: 8, lui: { finition: 1.58, lancers: 1.19 } },
      { cle: 'defi', nom: 'Le mettre au défi devant les journalistes', bon: 'Si ça passe : il répond, plus de tirs et de précision', prix: 'Sinon : il force ses tirs, moins de précision',
        pari: { chance: 3 / 6, gagne: { duree: 8, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 8, lui: { lancers: 1.5, finition: 0.5 } } } },
    ],
  },
  laCaisseVide: {
    de: 'fi', ico: '🧾', titre: 'La caisse à sec',
    quand: f => f.caisse !== null && f.caisse < 25,
    joueur: f => f.masse && f.masse.lourd,
    fait: f => `${f.caisse} 🪙 en caisse${f.masse && f.masse.lourd ? ` · ${f.masse.lourd.n} : ${f.masse.lourd.sal}` : ''}`,
    mots: ['On roule sur la réserve. Un commanditaire offre de l\'argent pour une soirée avec les gars.',
      'Les comptes ne balancent pas. Je peux vendre une soirée aux commanditaires, mais les gars vont se coucher tard.'],
    options: [
      { cle: 'soiree', nom: 'La soirée des commanditaires', bon: 'La caisse respire', prix: 'Les jambes, le lendemain', gain: 20, duree: 3, energie: 1.4 },
      { cle: 'autobus', nom: 'L\'autobus au lieu de l\'avion', bon: 'Quelques jetons d\'économie', prix: 'Les jambes : les voyages fatiguent', gain: 10, si: 'visiteur', duree: 8, energie: 1.4 },
      { cle: 'non', nom: 'Refuser', bon: 'Rien ne change', rien: true },
    ],
  },
  /*
   * LA MASSE SALARIALE (V16, tranche 6 — docs/refonte-v16.md § 4d). Les cartes du plafond sont parties ; quand l'espace
   * est mince, le proprio met deux portes sur la table, chacune une décision `plafond` (js/banque.js `plafondDe`) : le
   * rachat d'une part du contrat le plus lourd, payé en jetons, ou un contrat lourd qui donne de l'espace et coûte ses
   * soirs, toute la saison.
   */
  laMasse: {
    de: 'pr', ico: '💵', titre: 'La masse salariale', maison: 'proprio',
    quand: f => !!f.masse && f.masse.espace < ESPACE_MINCE && !!f.masse.lourd,
    fait: f => `${f.masse.libre} sous le plafond · ${f.masse.lourd.n} : ${f.masse.lourd.sal}`,
    joueur: f => f.masse.lourd,
    mots: ['Le plafond nous étouffe. Je peux racheter une part d\'un contrat, ou vendre une soirée à la télé.',
      'Il n\'y a plus d\'air sous le plafond. Choisis ce que tu sacrifies : des jetons, ou des soirs.'],
    options: [
      { cle: 'rachat', nom: 'Racheter une part du contrat de {nom}', bon: 'Il compte {apres} au plafond, plus {sal}', gain: -10, plafond: { facteur: 0.833 } },
      { cle: 'tele', nom: 'Signer le contrat de télé', bon: '+2,5 M$ sous le plafond', prix: 'Moins de précision et des jambes lourdes, les dos-à-dos', si: 'dosADos', duree: 82, energie: 1.3, finition: 0.94, plafond: { espace: 2_500_000 } },
      { cle: 'non', nom: 'Ne rien signer', bon: 'Rien ne change', rien: true },
    ],
  },
  /*
   * LA TÊTE DE L'ENTRAÎNEUR (V16, tranche 6). Le congédiement n'est plus une carte : quatre défaites de suite, et le
   * proprio veut une tête. Un coach neuf, à la confiance I (`coachNeuf`, js/banque.js), parmi deux qu'il nomme ; ou
   * personne ne part.
   */
  laTete: {
    de: 'pr', ico: '📋', titre: 'La tête du coach', maison: 'proprio',
    quand: f => f.defaites >= DEFAITES_TETE && !!f.coach && (f.coachs || []).length >= 2,
    fait: f => `${f.defaites} défaites de suite · ${f.coach} en poste`,
    mots: ['Je ne paie pas un coach pour perdre. Dis-moi si on change, et pour qui.',
      'La patience a des limites. La mienne est atteinte, la tienne, je ne sais pas.'],
    options: [
      { cle: 'premier', nom: 'Congédier : place à {coach0}', bon: 'Un coach neuf, à la confiance I', prix: 'Le coach en poste part avec sa confiance', coachNeuf: 0 },
      { cle: 'second', nom: 'Congédier : place à {coach1}', bon: 'Un coach neuf, à la confiance I', prix: 'Le coach en poste part avec sa confiance', coachNeuf: 1 },
      { cle: 'garder', nom: 'Le garder', bon: 'Rien ne change', rien: true },
    ],
  },
  laCaisseDeborde: {
    de: 'fi', ico: '💰', titre: 'La caisse déborde',
    quand: f => f.caisse !== null && f.caisse >= 90,
    fait: f => `${f.caisse} 🪙 en caisse`,
    mots: ['Pour une fois, il reste de l\'argent. L\'entraîneur veut une salle de vidéo, le physio un bain froid.',
      'L\'argent dort dans le compte. Investis-le, ou garde-le pour la boutique.'],
    options: [
      { cle: 'video', nom: 'La salle de vidéo', bon: 'Plus de précision : on connaît leurs gardiens', gain: -25, duree: 12, finition: 1.56 },
      { cle: 'bain', nom: 'Le bain froid', bon: 'Les jambes lourdes récupèrent', gain: -20, si: 'jambesLourdes', duree: 20, energie: 0.51 },
      { cle: 'garder', nom: 'Garder l\'argent', bon: 'La caisse reste pleine', rien: true },
    ],
  },
  leBlanchi: {
    de: 'an', ico: '🥅', titre: 'Blanchis',
    quand: f => !!f.dernier && f.dernier.pour === 0,
    joueur: f => f.vedette,
    fait: f => `0–${f.dernier.contre} contre ${f.dernier.adv}${avec(f.vedette)}`,
    mots: ['Pas un but. Moi, je dirais qu\'ils ont oublié où était le filet, mais je ne suis qu\'à la télé.',
      'Un blanchissage, ça laisse des traces. On va voir s\'ils tirent plus, ou s\'ils visent mieux.'],
    options: [
      { cle: 'partout', nom: 'Tirer de partout', bon: 'Plus de tirs, de partout', prix: 'Moins de précision, de loin', duree: 5, volume: 1.12, finition: 0.95 },
      { cle: 'devant', nom: 'Le travail devant le filet', bon: 'Plus de précision : des chances de près', prix: 'Moins de tirs', duree: 5, finition: 1.21, volume: 0.89 },
    ],
  },
  laRaclee: {
    de: 'pr', ico: '🧯', titre: 'Une raclée',
    quand: f => !!f.dernier && f.dernier.contre - f.dernier.pour >= 4,
    joueur: f => f.gardien,
    fait: f => `${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv}${avec(f.gardien)}`,
    mots: ['Je ne veux plus jamais voir ça. Fermez la porte du vestiaire, ou fermez votre zone.',
      'J\'ai eu honte dans ma loge. Vous allez me dire ce que vous comptez faire.'],
    options: [
      { cle: 'porte', nom: 'La porte fermée', bon: 'Moins de tirs contre, plus d\'arrêts : on ferme le jeu', prix: 'Moins de tirs, nous aussi', si: 'apresDefaite', duree: 10, defense: 0.88 },
      { cle: 'renvoyer', nom: 'Le renvoyer devant le filet', bon: 'Si ça passe : il se venge, moins de buts accordés', prix: 'Sinon : il coule encore, plus de buts accordés',
        pari: { chance: 3 / 6, gagne: { duree: 6, lui: { arrets: 0.85 } }, perd: { duree: 6, lui: { arrets: 1.15 } } } },
    ],
  },
  leFond: {
    de: 'ca', ico: '🪫', titre: 'Le fond du classement',
    quand: f => f.n >= 20 && f.rang > (3 * f.equipes) / 4,
    joueur: f => f.vedette,
    fait: f => `${f.rang}e sur ${f.equipes} après ${f.n} matchs${avec(f.vedette)}`,
    mots: ['Le vestiaire est à plat. Laisse-moi leur parler, ou parle-leur toi-même.',
      'On joue comme une équipe qui a déjà fait ses valises. Il faut faire quelque chose.'],
    options: [
      { cle: 'joueurs', nom: 'La réunion des joueurs', bon: 'Moins de punitions : les bâtons restent en bas', duree: 8, discipline: 0.75 },
      { cle: 'capitaine', nom: 'Le capitaine prend la parole', bon: 'Plus de précision : on se relève', si: 'apresDefaite', duree: 12, finition: 1.23 },
    ],
  },
  leSommet: {
    de: 'an', ico: '📸', titre: 'En haut du classement',
    quand: f => f.n >= 20 && f.rang <= 3,
    joueur: f => f.vedette,
    fait: f => `${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes} après ${f.n} matchs${avec(f.vedette)}`,
    mots: ['Tout le monde vous regarde. Je me demande si vos vedettes vont aimer les caméras.',
      'Les projecteurs sont sur vous. On verra si ça monte à la tête.'],
    options: [
      { cle: 'show', nom: 'Le spectacle', bon: 'Les vedettes jouent', prix: 'Le bas de l\'alignement rouille', si: 'domicile', duree: 10, F: [1.25, 1.05, 0.9, 0.78] },
      { cle: 'humble', nom: 'Rester humble', bon: 'Moins de tirs contre, plus d\'arrêts : rien ne se relâche derrière', duree: 8, defense: 0.93 },
    ],
  },
  leMaire: {
    de: 'ma', ico: '🗝', titre: 'La clé de la ville',
    quand: f => f.n >= 20 && f.rang <= f.equipes / 4 && f.domicile >= 2,
    joueur: f => f.vedette,
    fait: f => `${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes} · ${f.domicile} matchs à domicile cette semaine${avec(f.vedette)}`,
    mots: ['La ville est fière de vous. J\'aimerais remettre la clé au capitaine, devant les caméras.',
      'Une cérémonie à l\'hôtel de ville, une photo, un chèque. Ça ne prend qu\'un après-midi.'],
    options: [
      { cle: 'cle', nom: 'La cérémonie', bon: 'Un chèque de la ville', prix: 'Les jambes : un après-midi debout', gain: 15, duree: 3, energie: 1.32 },
      { cle: 'non', nom: 'Poliment refuser', bon: 'Les gars se reposent', rien: true },
    ],
  },
  leCalendrierCharge: {
    de: 'li', ico: '📆', titre: 'Le calendrier chargé',
    quand: f => f.soirs >= 4,
    joueur: f => f.gardien,
    fait: f => `${f.soirs} matchs cette semaine${f.dos ? `, dont ${f.dos} dos-à-dos` : ''}${avec(f.gardien)}`,
    mots: ['La cédule est ce qu\'elle est. Votre gardien partant ne peut pas tous les jouer.',
      'Une semaine chargée, comme pour tout le monde. On attend votre feuille de match.'],
    options: [
      { cle: 'auxiliaire', nom: 'L\'auxiliaire devant le filet', bon: 'Ton partant souffle', prix: 'Un soir avec l\'auxiliaire', action: { gardienAux: 1 } },
      { cle: 'tout', nom: 'Ton partant, tous les soirs', bon: 'Le meilleur devant le filet', prix: 'Les jambes de devant paient', duree: 4, energie: 1.4 },
    ],
  },
  laSemaineTranquille: {
    de: 'en', ico: '🛋', titre: 'Une semaine tranquille',
    quand: f => f.soirs <= 2,
    joueur: f => f.pire,
    fait: f => `${f.soirs} match${f.soirs > 1 ? 's' : ''} cette semaine · jambes ${f.jambes}${f.pire ? ` · le plus bas : ${f.pire.n}, ${f.pire.j}` : ''}`,
    mots: ['Une semaine creuse. On peut faire un mini-camp, ou tout le monde au chalet.',
      'Du temps libre, enfin. Moi, je les ferais travailler ; ils te diront le contraire.'],
    options: [
      { cle: 'camp', nom: 'Le mini-camp', bon: 'Plus de tirs, plus de précision', prix: 'Les jambes', duree: 6, volume: 1.08, finition: 1.05, energie: 1.08 },
      { cle: 'chalet', nom: 'Tout le monde au chalet', bon: 'Les jambes reviennent', action: { energieTous: 12 } },
    ],
  },
  lesHuees: {
    de: 'pa', ico: '🧣', titre: 'Les huées',
    quand: f => f.n >= 6 && f.dernier && f.dernier.contre > f.dernier.pour && f.domicile >= 2,
    joueur: f => f.gardien,
    fait: f => `${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv} · ${f.domicile} matchs à domicile cette semaine${avec(f.gardien)}`,
    mots: ['Ça fait trente ans que j\'ai mes billets. Ce soir, j\'ai hué. Je n\'en suis pas fier.',
      'On a hué, oui. Montrez-nous qu\'on a eu tort, chez nous.'],
    options: [
      { cle: 'parler', nom: 'Leur parler', bon: 'Moins de punitions : on garde son calme', si: 'domicile', duree: 10, discipline: 0.75 },
      { cle: 'jouer', nom: 'Jouer pour eux', bon: 'Plus de tirs : on attaque', prix: 'Plus de tirs contre : la porte s\'ouvre derrière', si: 'domicile', duree: 10, volume: 1.1, defense: 1.04 },
    ],
  },
  laPratique: {
    de: 'en', ico: '📋', titre: 'La pratique du mardi',
    quand: () => true,
    fait: f => `${f.soirs} match${f.soirs > 1 ? 's' : ''} cette semaine · jambes ${f.jambes}`,
    mots: ['Une semaine ordinaire. Dis-moi sur quoi on travaille mardi.',
      'Rien qui brûle. Les tirs, ou la zone : à toi de choisir.'],
    options: [
      { cle: 'tirs', nom: 'Les tirs', bon: 'Plus de tirs au filet', duree: 5, volume: 1.11 },
      { cle: 'zone', nom: 'La zone', bon: 'Moins de tirs contre, plus d\'arrêts', prix: 'Moins de tirs, nous aussi', duree: 5, defense: 0.89 },
    ],
  },
};
/*
 * LA SEMAINE D'UNE HISTOIRE (V20, docs/refonte-v20.md § 3 ; JP : *oui à tout* ; le 27 oct. : *les événements devraient
 * être plus « randoms »*). Le dossier était la semaine paire, la route l'impaire, un dilemme aux journées fixes, un courriel
 * aux huit matchs : cinq horloges qu'un joueur apprenait vite. Il reste une source, le dossier, un lundi tiré de la graine
 * et de la semaine (`hache`), `CHANCE_HISTOIRE` en moyenne, dès la première ; la même graine rejoue les mêmes lundis.
 */
const CHANCE_HISTOIRE = 0.55;
export const semaineAHistoire = (graine, w) => w >= 1 && hache(String(graine), 'histoire', String(w)) < CHANCE_HISTOIRE;
/* La pratique du mardi ne s'ouvre que si rien d'autre n'est vrai : elle ne prend jamais la place d'un vrai dossier. */
const DE_RESERVE = 'laPratique';
const tirer = (graine, w, cle) => hache(String(graine), 'dossier', String(w), cle);
/*
 * LE DOSSIER D'UNE SEMAINE : PUR, la graine, la semaine et les faits du lundi. Parmi les vrais qui ne se sont pas
 * encore ouverts cette saison (`deja`), le plus haut de son tirage ; aucun, la pratique du mardi.
 */
export function dossierDeLaSemaine(graine, w, faits, deja = []) {
  const vraies = Object.keys(DOSSIERS).filter(k => k !== DE_RESERVE && !deja.includes(k) && DOSSIERS[k].quand(faits));
  if (!vraies.length) return deja.includes(DE_RESERVE) ? null : DE_RESERVE;
  return vraies.reduce((b, k) => (tirer(graine, w, k) > tirer(graine, w, b) ? k : b));
}
