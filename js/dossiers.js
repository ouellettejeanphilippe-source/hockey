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
 *   options  deux ou trois réponses aux CONSÉQUENCES CONCRÈTES (V21, docs/refonte-v21.md § 3 ; JP : *le système actuel
 *            marche pas*) : des jetons (`gain`, un prix s'il est négatif), de l'expérience au coach (`xp`, en plus ou en
 *            moins), un adjoint pour le staff (`adjoint`, nommé à l'écran) ou le dernier entré qui part (`perdAdjoint`),
 *            des jambes (`action` : `energie` au joueur nommé, `energieTous` à tous), une suspension (`action.absents`),
 *            un soin (`soin`, au blessé nommé), l'auxiliaire au filet, la masse salariale (`plafond`), ou rien ; et,
 *            quand il nomme un joueur, ce qui lui arrive à LUI (`lui`, ou le dé de l'audace, `pari`). Jamais plus un
 *            pourcentage de l'équipe pour quelques soirs.
 * Elles passent par la même porte que les dilemmes (`familleDeMoment`, `appliquerGestes`).
 *
 *   faits : { n, jambes, pire: { n, cle, j }, blesses: [{ n, m }], soirs, dos, visiteur, domicile, rival, bete,
 *             caisse, masse: { espace, libre, lourd: { n, cle, sal } }, defaites, coach: { cle, nom, ico, niveau, adjoints }, dernier: { pour, contre, adv }, rang, equipes,
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
    mots: ['Les valises sont faites, les jambes, pas encore. Un vol nolisé, et je te les rends frais.',
      'L\'autobus, l\'avion, l\'hôtel. Si on ne fait rien, on va arriver au troisième soir sur les genoux.'],
    options: [
      { cle: 'nolise', nom: 'Le vol nolisé', bon: 'Les jambes de tous reviennent', prix: 'Le vol se paie', gain: -15, action: { energieTous: 10 } },
      { cle: 'autobus', nom: 'L\'autobus de nuit', bon: 'Des jetons d\'économie', prix: 'Les jambes de tous paient', gain: 10, action: { energieTous: -8 } },
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
      { cle: 'famille', nom: 'La soirée familiale', bon: 'La caisse se remplit', prix: 'Il signe des autographes toute la soirée : ses jambes', gain: 15, action: { energie: -12 } },
      { cle: 'huis', nom: 'Les pratiques à huis clos', bon: 'Ton coach installe son système', xp: 3 },
    ],
  },
  lInfirmerie: {
    de: 'me', ico: '🚑', titre: 'L\'infirmerie déborde', maison: 'infirmerie',
    quand: f => f.blesses.length >= 2,
    joueur: f => f.blesses[0],
    fait: f => `🚑 ${f.blesses.slice(0, 3).map(b => `${b.n} ${b.m} m.`).join(', ')}${f.blesses.length > 3 ? ` et ${f.blesses.length - 3} autre${f.blesses.length > 4 ? 's' : ''}` : ''}`,
    mots: ['Ma table est pleine. Il y a un spécialiste à Toronto, mais il ne travaille pas gratuitement.',
      'Je manque de lits. Ou on paie le spécialiste, ou ton coach apprend à faire sans eux.'],
    options: [
      { cle: 'specialiste', nom: 'Le spécialiste de Toronto', bon: 'Il revient plus tôt', prix: 'Le spécialiste se paie', gain: -15, soin: 4 },
      { cle: 'patience', nom: 'Faire sans lui', bon: 'Ton coach apprend à faire sans lui', xp: 3 },
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
      { cle: 'repos', nom: 'Un congé pour lui', bon: 'Ses jambes reviennent', prix: 'Le massothérapeute se paie', gain: -5, action: { energie: 25 } },
      { cle: 'conge', nom: 'Annuler la pratique', bon: 'Les jambes de tous reviennent', prix: 'Le système rouille : ton coach recule', action: { energieTous: 10 }, xp: -3 },
    ],
  },
  /*
   * LES DOSSIERS D'UN JOUEUR (V11, tranche 4 — docs/refonte-v11.md). JP : *les bonus et malus plus importants touchent
   * des joueurs et non l'équipe*. Le fait vient de SES feuilles (js/saison.js `faitsDuLundi`) ; la réponse le touche, lui.
   */
  ilBoude: {
    de: 'en', ico: '😒', titre: 'Il boude',
    quand: f => !!f.boude,
    joueur: f => f.boude,
    fait: f => `${f.boude.n} : ${f.boude.zone}, au ${f.boude.ou} · ${f.boude.pts} point${f.boude.pts > 1 ? 's' : ''} en ${f.boude.m} matchs`,
    mots: ['Il ne dit plus bonjour en arrivant à l\'aréna. Il pense qu\'il mérite mieux que le bas de l\'alignement.',
      'Il boude dans son coin du vestiaire. Moi, je lui parlerais ; ou on lui donne sa chance, et on verra.'],
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
      { cle: 'suspendre', nom: 'Le suspendre deux matchs', bon: 'Ton coach montre qui mène', prix: 'Il manque deux matchs', action: { absents: 2 }, xp: 4 },
      { cle: 'amende', nom: 'Une amende', bon: 'L\'amende va à la caisse', gain: 8 },
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
      { cle: 'soiree', nom: 'La soirée des commanditaires', bon: 'La caisse respire', prix: 'Les jambes de tous, le lendemain', gain: 20, action: { energieTous: -8 } },
      { cle: 'non', nom: 'Refuser', bon: 'Rien ne change', rien: true },
    ],
  },
  /*
   * LA MASSE SALARIALE (V16, tranche 6 — docs/refonte-v16.md § 4d). Quand l'espace est mince, le proprio met deux portes
   * sur la table, chacune une décision `plafond` (js/banque.js `plafondDe`) : le rachat d'une part du contrat le plus
   * lourd, payé en jetons, ou le contrat de télé, de l'espace contre les jambes de tous.
   */
  laMasse: {
    de: 'pr', ico: '💵', titre: 'La masse salariale', maison: 'proprio',
    quand: f => !!f.masse && f.masse.espace < ESPACE_MINCE && !!f.masse.lourd,
    fait: f => `${f.masse.libre} sous le plafond · ${f.masse.lourd.n} : ${f.masse.lourd.sal}`,
    joueur: f => f.masse.lourd,
    mots: ['Le plafond nous étouffe. Je peux racheter une part d\'un contrat, ou vendre des soirées à la télé.',
      'Il n\'y a plus d\'air sous le plafond. Choisis ce que tu sacrifies : des jetons, ou des jambes.'],
    options: [
      { cle: 'rachat', nom: 'Racheter une part du contrat de {nom}', bon: 'Il compte {apres} au plafond, plus {sal}', gain: -10, plafond: { facteur: 0.833 } },
      { cle: 'tele', nom: 'Signer le contrat de télé', bon: '+2,5 M$ sous le plafond', prix: 'Les jambes de tous : la tournée des studios', action: { energieTous: -10 }, plafond: { espace: 2_500_000 } },
      { cle: 'non', nom: 'Ne rien signer', bon: 'Rien ne change', rien: true },
    ],
  },
  /*
   * LA TÊTE DU COACH (V16, tranche 6 ; V21). Quatre défaites de suite, et le proprio veut une tête. Le coach est celui de
   * la run (js/pouvoirs.js) : il ne part pas, mais quelque chose de concret paie la défaite — un de ses adjoints (le
   * dernier engagé), des jetons, ou son expérience.
   */
  laTete: {
    de: 'pr', ico: '📋', titre: 'Le proprio veut une tête', maison: 'proprio',
    quand: f => f.defaites >= DEFAITES_TETE && !!f.coach,
    fait: f => `${f.defaites} défaites de suite · ${f.coach.ico} ${f.coach.nom}, niveau ${f.coach.niveau}`,
    mots: ['Je ne paie pas un coach pour perdre. Quelqu\'un paie, et ce n\'est pas moi.',
      'La patience a des limites. La mienne est atteinte, la tienne, je ne sais pas.'],
    options: [
      { cle: 'adjoint', nom: 'Congédier un adjoint', bon: 'Le proprio se calme', prix: 'Ton dernier adjoint part', perdAdjoint: true },
      { cle: 'payer', nom: 'Calmer le proprio', bon: 'Le proprio se calme', prix: 'Un chèque pour les partisans', gain: -20 },
      { cle: 'tenir', nom: 'Tenir tête', bon: 'Personne ne part', prix: 'Ton coach perd la face', xp: -6 },
    ],
  },
  laCaisseDeborde: {
    de: 'fi', ico: '💰', titre: 'La caisse déborde',
    quand: f => f.caisse !== null && f.caisse >= 90,
    fait: f => `${f.caisse} 🪙 en caisse`,
    mots: ['Pour une fois, il reste de l\'argent. Le coach veut un stage ; il a aussi un adjoint en vue.',
      'L\'argent dort dans le compte. Investis-le, ou garde-le pour la boutique.'],
    options: [
      { cle: 'stage', nom: 'Le stage du coach', bon: 'Ton coach revient avec un cahier neuf', prix: 'Le stage se paie', gain: -25, xp: 8 },
      { cle: 'adjoint', nom: 'L\'adjoint qu\'il a en vue', bon: 'Un adjoint pour ton staff', prix: 'Son salaire', gain: -35, adjoint: true },
      { cle: 'garder', nom: 'Garder l\'argent', bon: 'La caisse reste pleine', rien: true },
    ],
  },
  leBlanchi: {
    de: 'an', ico: '🥅', titre: 'Blanchis',
    quand: f => !!f.dernier && f.dernier.pour === 0,
    joueur: f => f.vedette,
    fait: f => `0–${f.dernier.contre} contre ${f.dernier.adv}${avec(f.vedette)}`,
    mots: ['Pas un but. Moi, je dirais qu\'ils ont oublié où était le filet, mais je ne suis qu\'à la télé.',
      'Un blanchissage, ça laisse des traces. On va voir si le coach trouve la solution, ou si la vedette se réveille.'],
    options: [
      { cle: 'video', nom: 'La vidéo, toute la nuit', bon: 'Ton coach trouve la faille', xp: 3 },
      { cle: 'vedette', nom: 'Tout sur la vedette', bon: 'Si ça passe : il se réveille, plus de tirs et de précision', prix: 'Sinon : il s\'enfonce, moins de précision',
        pari: { chance: 3 / 6, gagne: { duree: 6, lui: { lancers: 1.4, finition: 1.3 } }, perd: { duree: 6, lui: { finition: 0.6 } } } },
    ],
  },
  laRaclee: {
    de: 'pr', ico: '🧯', titre: 'Une raclée',
    quand: f => !!f.dernier && f.dernier.contre - f.dernier.pour >= 4,
    joueur: f => f.gardien,
    fait: f => `${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv}${avec(f.gardien)}`,
    mots: ['Je ne veux plus jamais voir ça. Faites-les courir, ou renvoyez-le devant le filet.',
      'J\'ai eu honte dans ma loge. Vous allez me dire ce que vous comptez faire.'],
    options: [
      { cle: 'courir', nom: 'Les faire courir', bon: 'Ton coach reprend le vestiaire en main', prix: 'Les jambes de tous', action: { energieTous: -10 }, xp: 4 },
      { cle: 'renvoyer', nom: 'Le renvoyer devant le filet', bon: 'Si ça passe : il se venge, moins de buts accordés', prix: 'Sinon : il coule encore, plus de buts accordés',
        pari: { chance: 3 / 6, gagne: { duree: 6, lui: { arrets: 0.85 } }, perd: { duree: 6, lui: { arrets: 1.15 } } } },
    ],
  },
  leFond: {
    de: 'ca', ico: '🪫', titre: 'Le fond du classement',
    quand: f => f.n >= 20 && f.rang > (3 * f.equipes) / 4,
    joueur: f => f.vedette,
    fait: f => `${f.rang}e sur ${f.equipes} après ${f.n} matchs${avec(f.vedette)}`,
    mots: ['Le vestiaire est à plat. Le proprio parle d\'envoyer de l\'aide, et ce n\'est pas gratuit.',
      'On joue comme une équipe qui a déjà fait ses valises. Il faut faire quelque chose.'],
    options: [
      { cle: 'aide', nom: 'L\'aide du proprio', bon: 'Un adjoint pour ton staff', prix: 'Le proprio se rembourse', gain: -15, adjoint: true },
      { cle: 'joueurs', nom: 'La réunion des joueurs', bon: 'Les jambes de tous reviennent : une journée de congé', action: { energieTous: 10 } },
    ],
  },
  leSommet: {
    de: 'an', ico: '📸', titre: 'En haut du classement',
    quand: f => f.n >= 20 && f.rang <= 3,
    joueur: f => f.vedette,
    fait: f => `${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes} après ${f.n} matchs${avec(f.vedette)}`,
    mots: ['Tout le monde vous regarde. Je me demande si votre vedette va aimer les caméras.',
      'Les projecteurs sont sur vous. On verra si ça monte à la tête.'],
    options: [
      { cle: 'show', nom: 'La tournée des médias', bon: 'Les commanditaires paient', prix: 'Ses jambes : il court les studios', gain: 20, action: { energie: -15 } },
      { cle: 'humble', nom: 'Rester humble', bon: 'Ton coach garde le cap', xp: 3 },
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
      { cle: 'cle', nom: 'La cérémonie', bon: 'Un chèque de la ville', prix: 'Les jambes de tous : un après-midi debout', gain: 15, action: { energieTous: -6 } },
      { cle: 'non', nom: 'Poliment refuser', bon: 'Rien ne change', rien: true },
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
      { cle: 'tout', nom: 'Ton partant, tous les soirs', bon: 'Le meilleur devant le filet', prix: 'Ses jambes paient', action: { energie: -15 } },
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
      { cle: 'camp', nom: 'Le mini-camp', bon: 'Ton coach installe son système', prix: 'Les jambes de tous', action: { energieTous: -6 }, xp: 4 },
      { cle: 'chalet', nom: 'Tout le monde au chalet', bon: 'Les jambes de tous reviennent', action: { energieTous: 12 } },
    ],
  },
  laPratique: {
    de: 'en', ico: '📋', titre: 'La pratique du mardi',
    quand: () => true,
    fait: f => `${f.soirs} match${f.soirs > 1 ? 's' : ''} cette semaine · jambes ${f.jambes}`,
    mots: ['Une semaine ordinaire. Dis-moi sur quoi on travaille mardi.',
      'Rien qui brûle. Le système, ou le repos : à toi de choisir.'],
    options: [
      { cle: 'systeme', nom: 'Le système', bon: 'Ton coach installe son système', xp: 2 },
      { cle: 'repos', nom: 'Le repos', bon: 'Les jambes de tous reviennent', action: { energieTous: 6 } },
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
