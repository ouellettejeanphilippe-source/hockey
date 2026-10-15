/**
 * « UNE SAISON DANS LA VIE D'UN DG-COACH » — les cartes neuves de la banque.
 *
 * Quatre tables, dans les MÊMES formats que celles qu'elles rejoignent. Aucun
 * canal neuf, aucune mécanique neuve : chaque carte passe par les champs que
 * le moteur lit déjà, dans les amplitudes de ses voisines de même rareté. La
 * couleur d'une carte (son coach) n'est écrite nulle part : `coachDesCanaux`
 * (js/coachs.js) la lit sur ce que la carte fait ; une carte qui ne bouge
 * presque rien est neutre.
 *
 *   MODIFS_VIE          au format de MUTATIONS (js/sim.js), sources `style` et `contrat`
 *   RARETE_MODIFS_VIE   leur rareté, au format de RARETE_MOD (js/banque.js)
 *   CONSOMMABLES_VIE    au format de CONSOMMABLES (js/banque.js)
 *   CONTRATS_VIE        au format de CONTRATS (js/banque.js)
 *   CARTES_MATCH_VIE    au format de CARTES_MATCH (js/combat.js), toutes `horsAdverse`
 *
 * Ce fichier n'importe rien : il est de la donnée, et sim.js, banque.js et
 * combat.js peuvent l'importer sans cycle.
 */

/* ---------- LES MODIFS DE JOUEURS (au verso, pour la saison) ---------- */
export const MODIFS_VIE = {
  // commune : un canal, deux ou trois pour cent
  style_roulette: { nom: 'Style : la roulette', ico: '🚏', cible: 'libre', source: 'style', quoi: 'Il change d\'aile à chaque présence. Ses ailiers ne savent jamais où il sera, l\'adversaire non plus.', profils: { passeur: 6, energie: 6 }, creation: 1.07 },
  style_replie: { nom: 'Style : le replié', ico: '🪃', cible: 'libre', source: 'style', quoi: 'Il rentre en zone avant la rondelle, chaque fois, et il le rappelle en revenant au banc.', profils: { checker: 8 }, defense: 0.979 },
  baton_hache: { nom: 'Le bâton de hache', ico: '🪓', cible: 'libre', source: 'style', quoi: 'Un bâton de bois de 1983, déniché dans un sous-sol de Chicoutimi. Il refuse d\'en changer.', profils: { sniper: 5 }, finition: 1.028, lancers: 0.972 },
  style_discret: { nom: 'Style : le discret', ico: '🕶', cible: 'libre', source: 'style', quoi: 'On le remarque à peine sur la glace : ni les adversaires, ni les arbitres, ni le soigneur.', profils: { deuxsens: 5 }, blessure: 0.902 },
  masque_citrouille: { nom: 'Le masque citrouille', ico: '🎃', cible: 'libre', source: 'style', gardien: true, quoi: 'Un masque orange, peint par son neveu sur la table de la cuisine. La ligue a fini par l\'accepter.', arrets: 0.979 },
  contrat_proximite: { nom: 'Clause de proximité', ico: '🏘', cible: 'libre', source: 'contrat', quoi: 'Il a exigé une maison à dix minutes de chez sa mère. Il y soupe tous les dimanches, sans exception.', finition: 1.07, blessure: 1.14 },
  contrat_cafetiere: { nom: 'Clause de la cafetière', ico: '🫗', cible: 'libre', source: 'contrat', quoi: 'Une cafetière dans son casier, aux frais du club. Il en vide une pleine avant chaque match.', lancers: 1.105, blessure: 1.14 },
  // peu commune : un canal à cinq pour cent, ou deux plus petits
  style_garagiste: { nom: 'Style : le garagiste', ico: '🪚', cible: 'libre', source: 'style', quoi: 'Il lance comme il répare son camion : vite, fort, sans ouvrir le manuel.', profils: { power: 8 }, lancers: 1.123, finition: 0.969 },
  style_chirurgien: { nom: 'Style : le chirurgien', ico: '🧫', cible: 'libre', source: 'style', quoi: 'Un seul lancer par présence, mais choisi : il attend que le gardien bouge le premier.', profils: { sniper: 10 }, finition: 1.123, lancers: 0.938 },
  style_pare_chocs: { nom: 'Style : le pare-chocs', ico: '🚙', cible: 'libre', source: 'style', quoi: 'Il se jette devant chaque lancer, de face, par principe.', profils: { defensif: 10 }, defense: 0.929 },
  style_bon_voisin: { nom: 'Style : le bon voisin', ico: '🏡', cible: 'libre', source: 'style', quoi: 'Le premier à aider un coéquipier à déménager, le premier à lui remettre la rondelle dans l\'enclave.', profils: { passeur: 8, deuxsens: 6 }, creation: 1.123 },
  style_taverne: { nom: 'Style : le pilier de taverne', ico: '🍻', cible: 'libre', source: 'style', quoi: 'Il distribue les mises en échec le long de la bande comme on paie des tournées.', profils: { power: 12 }, finition: 0.969 },
  style_veilleur: { nom: 'Style : le veilleur de nuit', ico: '🔦', cible: 'libre', source: 'style', quoi: 'Le dernier couché, le premier sur la glace. Il n\'a jamais raté un couvre-feu.', profils: { energie: 10 }, lancers: 1.092, blessure: 0.776 },
  style_violoniste: { nom: 'Style : le violoniste', ico: '🎻', cible: 'libre', source: 'style', quoi: 'Tout en finesse, la rondelle au bout de la palette. Les défenseurs reculent sans savoir pourquoi.', profils: { passeur: 12, manieur: 10 }, creation: 1.154, lancers: 0.938 },
  masque_pompier: { nom: 'Le casque de pompier', ico: '🧯', cible: 'libre', source: 'style', gardien: true, quoi: 'Un casque rouge pompier, grille noire. Il plonge sur tout ce qui traîne devant son filet.', arrets: 0.937, blessure: 1.14 },
  contrat_assiduite: { nom: 'Clause d\'assiduité', ico: '📆', cible: 'libre', source: 'contrat', quoi: 'Un boni par match joué. Il jouerait grippé, et il l\'a déjà fait.', lancers: 1.092, blessure: 1.336 },
  contrat_deplacement: { nom: 'Clause de non-déplacement', ico: '📄', cible: 'libre', source: 'contrat', quoi: 'Il refuse de prendre l\'avion. Il voyage en autobus, seul à l\'avant, et descend raide comme un piquet.', defense: 0.952, finition: 0.969 },
  // rare : un vrai bonus, et son prix
  style_harponneur: { nom: 'Style : le harponneur', ico: '🔱', cible: 'libre', source: 'style', quoi: 'Il lance peu. Quand il le fait, la rondelle cherche le haut du filet.', profils: { sniper: 15 }, finition: 1.176, lancers: 0.874 },
  style_metronome: { nom: 'Style : le métronome', ico: '⌛', cible: 'libre', source: 'style', quoi: 'Des présences d\'une minute, pas une seconde de plus. L\'adjoint le chronomètre et n\'a jamais eu à crier.', profils: { energie: 12, deuxsens: 8 }, lancers: 1.126, blessure: 1.28 },
  style_douanier: { nom: 'Style : le douanier', ico: '🛃', cible: 'libre', source: 'style', quoi: 'À sa ligne bleue, rien ne passe sans montrer ses papiers. L\'attaquant adverse doit s\'arrêter.', profils: { defensif: 15, deuxsens: 10 }, defense: 0.895, lancers: 0.924 },
  style_marionnettiste: { nom: 'Style : le marionnettiste', ico: '🪆', cible: 'libre', source: 'style', quoi: 'Il tire les ficelles de son trio : un geste du bâton, et ses ailiers changent de couloir.', profils: { passeur: 15, manieur: 12 }, creation: 1.176, finition: 0.95 },
  style_forgeron: { nom: 'Style : le forgeron', ico: '⚒', cible: 'libre', source: 'style', quoi: 'Chaque mise en échec est appuyée jusqu\'au bout, puis il retourne en chercher une autre.', profils: { power: 15, physique: 12 }, lancers: 1.076, finition: 0.95, blessure: 1.28 },
  masque_oracle: { nom: 'Le masque de l\'oracle', ico: '🧙', cible: 'libre', source: 'style', gardien: true, quoi: 'Il se place avant même que le tireur ait choisi son coin. Il refuse d\'expliquer comment.', arrets: 0.916, blessure: 1.28 },
  contrat_profits: { nom: 'Clause de participation aux profits', ico: '🏧', cible: 'libre', source: 'contrat', quoi: 'Il touche une part des ventes du bar de l\'aréna. Il salue la foule à chaque arrêt de jeu.', finition: 1.101, lancers: 1.076, blessure: 1.42 },
  contrat_avril: { nom: 'Clause de fin de saison', ico: '🗓', cible: 'libre', source: 'contrat', quoi: 'Il garde ses forces pour avril. En octobre, on le cherche encore sur la glace.', defense: 0.937, lancers: 0.924, blessure: 0.664 },
  // légendaire : le plus gros bonus du lot, un prix qui se sent
  style_heros_quartier: { nom: 'Style : le héros du quartier', ico: '🌆', cible: 'libre', source: 'style', quoi: 'Il a grandi à trois rues de l\'aréna. Chaque soir, le quartier est dans les gradins, et il le sait.', profils: { sniper: 15, passeur: 12 }, finition: 1.157, creation: 1.09, blessure: 1.56 },
  style_dernier_rempart: { nom: 'Style : le dernier rempart', ico: '🗼', cible: 'libre', source: 'style', quoi: 'Il tient la ligne bleue comme un phare tient le rocher. Personne ne le contourne.', profils: { defensif: 20, deuxsens: 12 }, defense: 0.863, lancers: 0.888, creation: 0.933 },
  masque_cuir: { nom: 'Le masque de cuir', ico: '🥽', cible: 'libre', source: 'style', gardien: true, quoi: 'Il a quarante ans et un vieux masque de cuir. Les jeunes tireurs le trouvent plus grand qu\'il ne l\'est.', arrets: 0.887, blessure: 1.42 },

  // Nouveaux styles et contrats (ajouts)
  style_jongleur: { nom: 'Style : le jongleur', ico: '🤹', cible: 'libre', source: 'style', quoi: 'Il soulève la rondelle sur sa palette en entrant en zone. La foule retient son souffle, le défenseur aussi.', profils: { manieur: 12 }, creation: 1.14, lancers: 0.94 },
  style_demolisseur: { nom: 'Style : le démolisseur', ico: '🏗', cible: 'libre', source: 'style', quoi: 'S\'il n\'a pas la rondelle, il s\'assure que personne d\'autre ne la garde longtemps.', profils: { power: 15, physique: 12 }, lancers: 1.1, finition: 0.92, blessure: 1.25 },
  style_opportuniste: { nom: 'Style : l\'opportuniste', ico: '🦅', cible: 'libre', source: 'style', quoi: 'Il rôde près de la ligne bleue, à l\'affût d\'un revirement, prêt à partir seul.', profils: { sniper: 12, passeur: 8 }, finition: 1.12, defense: 0.92 },
  baton_carbone: { nom: 'Le bâton ultra-léger', ico: '🪶', cible: 'libre', source: 'style', quoi: 'Son bâton pèse moins d\'une livre. Le préposé en garde trois de rechange au bout du banc.', profils: { sniper: 10 }, lancers: 1.15, finition: 1.05, blessure: 0.88 },
  masque_miroir: { nom: 'Le masque miroir', ico: '🪞', cible: 'libre', source: 'style', gardien: true, quoi: 'Une visière chromée où le tireur voit son reflet en s\'approchant. Certains hésitent.', arrets: 0.965 },
  contrat_glace: { nom: 'Clause de glace à l\'année', ico: '🧊', cible: 'libre', source: 'contrat', quoi: 'Il a fait écrire à son contrat une patinoire dans sa cour. Il y patine chaque matin avant l\'entraînement.', lancers: 1.05, blessure: 1.05 },
  contrat_animaux: { nom: 'Clause des mascottes', ico: '🐕', cible: 'libre', source: 'contrat', quoi: 'Son contrat lui permet d\'amener ses trois huskies au vestiaire le mardi. Le soigneur les promène.', finition: 1.04, lancers: 1.04, blessure: 1.15 },

};
export const RARETE_MODIFS_VIE = {
  style_roulette: 'commune', style_replie: 'commune', baton_hache: 'commune', style_discret: 'commune', masque_citrouille: 'commune', contrat_proximite: 'commune', contrat_cafetiere: 'commune',
  style_garagiste: 'peu', style_chirurgien: 'peu', style_pare_chocs: 'peu', style_bon_voisin: 'peu', style_taverne: 'peu', style_veilleur: 'peu', style_violoniste: 'peu', masque_pompier: 'peu', contrat_assiduite: 'peu', contrat_deplacement: 'peu',
  style_harponneur: 'rare', style_metronome: 'rare', style_douanier: 'rare', style_marionnettiste: 'rare', style_forgeron: 'rare', masque_oracle: 'rare', contrat_profits: 'rare', contrat_avril: 'rare',
  style_heros_quartier: 'legendaire', style_dernier_rempart: 'legendaire', masque_cuir: 'legendaire',

  style_jongleur: 'rare', style_demolisseur: 'rare', style_opportuniste: 'peu', baton_carbone: 'rare', masque_miroir: 'peu', contrat_glace: 'commune', contrat_animaux: 'commune',
};

/* ---------- LES CONSOMMABLES (une utilisation) ---------- */
export const CONSOMMABLES_VIE = {
  sandwich: { nom: 'Le sandwich du dépanneur', ico: '🥪', rarete: 'commune', vie: 'usage', cible: 'joueur', gestes: { energie: 18 }, texte: 'Un jambon-moutarde acheté au dépanneur du coin, avalé dans l\'autobus. Personne n\'a regardé la date.' },
  baume: { nom: 'Le baume de grand-maman', ico: '🪻', rarete: 'commune', vie: 'usage', cible: 'blesse', gestes: { soin: 2 }, effet: { energie: 1.14 }, duree: 3, texte: 'Le pot de baume de sa grand-mère sort du sac après la pratique. Tout le vestiaire sent la menthe.' },
  thermos: { nom: 'Le thermos de soupe', ico: '🍲', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 4 }, effet: { blessure: 0.895 }, duree: 4, texte: 'Un thermos de soupe aux pois passe de main en main dans l\'autobus. La recette a quatre générations.' },
  venteGarage: { nom: 'La vente de garage', ico: '🪑', rarete: 'commune', vie: 'usage', cible: 'aucune', gain: 10, texte: 'On vend les vieilles chaises du vestiaire devant l\'aréna, un samedi matin. Elles partent plus cher que prévu.' },
  gomme: { nom: 'La gomme à mâcher', ico: '🍬', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { finition: 1.07, discipline: 1.14 }, duree: 3, texte: 'Un paquet de gomme à la menthe fait le tour du banc. À la fin du match, il y en a sous chaque siège.' },
  bas: { nom: 'Les bas de laine', ico: '🧶', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { energie: 0.86 }, duree: 4, texte: 'Des bas de laine tricotés par une tante, une paire par joueur. Trop chauds pour l\'aréna, et tout le monde les porte.' },
  patinsNeufs: { nom: 'Les patins neufs', ico: '⛸', rarete: 'commune', vie: 'usage', cible: 'joueur', gestes: { energie: 20 }, effet: { blessure: 1.175 }, duree: 3, texte: 'Des patins aiguisés jeudi, étrennés ce soir. Il grimace en les laçant.' },
  tisane: { nom: 'La tisane de minuit', ico: '🍵', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { energieTous: 8 }, effet: { blessure: 0.825 }, duree: 4, texte: 'Camomille et miel pour tout le monde à minuit, et l\'entraîneur qui monte la garde dans le corridor de l\'hôtel.' },
  deuxiemeAvis: { nom: 'Le deuxième avis', ico: '🥼', rarete: 'peu', vie: 'usage', cible: 'blesse', gestes: { soin: 6 }, effet: { energie: 1.14 }, duree: 3, texte: 'Un deuxième médecin examine le blessé. Le diagnostic ne change pas, mais le ton est plus doux.' },
  chandailChance: { nom: 'Le chandail porte-bonheur', ico: '👘', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { finition: 1.105, discipline: 1.14 }, duree: 3, texte: 'Le chandail porte-bonheur n\'a pas été lavé depuis 2019. Il pend dans un casier dont personne ne s\'approche.' },
  suppleant: { nom: 'La soirée du suppléant', ico: '🪁', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { gardienAux: 2 }, effet: { energie: 0.895 }, duree: 3, texte: 'Ce soir, le substitut garde le filet. Sa famille a pris des billets dans la section derrière lui.' },
  tirageFondation: { nom: 'Le tirage de la fondation', ico: '🎪', rarete: 'peu', vie: 'usage', cible: 'aucune', pari: { chance: 0.4, gain: 40 }, texte: 'Les profits du tirage vont aux œuvres de la fondation. Le gros lot, à un certain Gilles de la section 114.' },
  commandite: { nom: 'La commandite du garagiste', ico: '🛻', rarete: 'peu', vie: 'usage', cible: 'aucune', gain: 18, texte: 'Le garagiste du coin met son logo sur la bande. Son chèque passe, de justesse.' },
  mainBaladeuse: { nom: 'La main baladeuse', ico: '✋', rarete: 'peu', vie: 'usage', cible: 'aucune', regle: true, effet: { volume: 1.105, discipline: 1.35 }, duree: 3, texte: 'Une main qui accroche le chandail adverse, discrètement, quand l\'arbitre regarde ailleurs.' },
  chirurgienLundi: { nom: 'Le chirurgien du lundi', ico: '🩼', rarete: 'rare', vie: 'permanent', cible: 'blesse', gestes: { soin: 9 }, effet: { energie: 1.28 }, duree: 6, texte: 'Le chirurgien a une plage libre lundi matin. Le genou est réparé avant le souper.' },
  bainJouvence: { nom: 'Le bain de jouvence', ico: '⛲', rarete: 'rare', vie: 'permanent', cible: 'aucune', gestes: { energieTous: 25 }, effet: { finition: 0.916, blessure: 1.28 }, duree: 3, texte: 'Bain glacé, sauna, bain glacé. Tout le monde en sort reposé, et un peu ramolli.' },
  caisseNoire: { nom: 'La caisse noire', ico: '🏴', rarete: 'rare', vie: 'permanent', cible: 'aucune', gain: 38, effet: { discipline: 1.28 }, duree: 5, texte: 'Des fonds retrouvés dans une boîte après un déménagement de bureau. Personne ne pose trop de questions.' },
  derniereChance: { nom: 'La saison de la dernière chance', ico: '🌅', rarete: 'rare', vie: 'usage', cible: 'aucune', effet: { finition: 1.14, defense: 0.916, blessure: 1.56 }, duree: 4, texte: 'Pour la moitié du vestiaire, c\'est le dernier contrat. Personne n\'en parle, tout le monde y pense.' },
  minuteSilence: { nom: 'La minute de silence', ico: '🤐', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { discipline: 0.58, finition: 0.965 }, duree: 4, texte: 'Une minute de silence avant la mise au jeu. Même le banc adverse se tait.' },
  brunchArbitre: { nom: 'Le brunch avec l\'arbitre', ico: '🥐', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { discipline: 0.58, finition: 0.965 }, duree: 4, texte: 'Un brunch avec l\'arbitre en chef : œufs, café, et une discussion polie sur le livre des règlements.' },
  listeReservistes: { nom: 'La liste des réservistes', ico: '🗄', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { F: [0.88, 1, 1.08, 1.2], energie: 0.895 }, duree: 4, texte: 'Dix-huit noms sur la liste des réservistes, quatre places à prendre ce soir. Tout le monde arrive en avance.' },
  chandailQuatre: { nom: 'Le chandail du quatrième trio', ico: '🎀', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { F: [0.92, 1, 1.06, 1.2], finition: 0.965 }, duree: 4, texte: 'Le quatrième trio a ses propres chandails, cousus à la main. Un des noms est mal épelé.' },
  sacSable: { nom: 'Le sac de sable du sous-sol', ico: '🏜', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { robustesse: 1.6, energie: 1.14 }, duree: 4, texte: 'Un sac de sable pend au sous-sol de l\'aréna. Le vétéran le frappe depuis 1998 et n\'en parle à personne.' },
  filmButs: { nom: 'Le film des buts accordés', ico: '🎬', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { defense: 0.895, finition: 0.965 }, duree: 3, texte: 'Douze minutes de buts accordés à la salle vidéo, sans son ni commentaire. Les lumières se rallument en silence.' },
  cibleCarton: { nom: 'La cible en carton', ico: '🪀', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { volume: 1.14, energie: 1.14 }, duree: 3, texte: 'Une cible en carton clouée au mur du garage, percée aux quatre coins. Les avants y passent l\'après-midi.' },

  // Nouveaux consommables
  gourde_secrete: { nom: 'La gourde mystère', ico: '🧪', rarete: 'peu', vie: 'usage', cible: 'joueur', gestes: { energie: 35 }, effet: { blessure: 1.3 }, duree: 4, texte: 'Le préparateur tend une gourde sans étiquette. Il jure que c\'est permis ; le joueur la vide d\'un trait.' },
  reunion_crise: { nom: 'La réunion de crise', ico: '⚠', rarete: 'rare', vie: 'usage', cible: 'aucune', effet: { finition: 1.15, defense: 0.85, discipline: 1.2 }, duree: 5, texte: 'Le DG verrouille la porte du vestiaire et parle dix minutes. En sortant, personne ne rit.' },
  seance_yoga: { nom: 'La séance de yoga', ico: '🧘', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 15 }, effet: { robustesse: 0.7 }, duree: 4, texte: 'Une séance de yoga dans la salle d\'entraînement, lumières tamisées. Plus personne n\'a envie de frapper qui que ce soit.' },
  diner_equipe: { nom: 'Le dîner payé', ico: '🍔', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 10 }, effet: { discipline: 0.8 }, duree: 3, texte: 'L\'entraîneur paie le dîner au casse-croûte du coin. Le retour à l\'aréna se fait en chantant.' },
  video_motivation: { nom: 'La vidéo virale', ico: '📱', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { volume: 1.1, energie: 1.15 }, duree: 4, texte: 'Trois minutes de gros arrêts et de musique forte, projetées au vestiaire juste avant la sortie.' },
  entrainement_sable: { nom: 'L\'entraînement dans le sable', ico: '🏖', rarete: 'rare', vie: 'permanent', cible: 'aucune', effet: { energie: 1.4, finition: 0.9 }, duree: 6, texte: 'Une semaine d\'entraînement dans le sable. Les mollets brûlent, et les jambes en ressortent légères.' },
  visite_chiens: { nom: 'La visite des chiens guides', ico: '🦮', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { discipline: 0.75, blessure: 0.85 }, duree: 4, texte: 'Des chiens-guides visitent le vestiaire l\'après-midi du match. La tension tombe d\'un cran.' },

};

/* ---------- LES CONTRATS (le plafond se manipule) ---------- */
export const CONTRATS_VIE = {
  fidelite: { nom: 'Le rabais de fidélité', ico: '🐕', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.944, texte: 'Il signe pour le prix de l\'épicerie et un abonnement au gym. Il voulait rester, c\'est tout.' },
  billetsSaison: { nom: 'Le boni en billets de saison', ico: '🎫', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.958, texte: 'Il prend une partie de son salaire en billets : quarante places derrière le banc des visiteurs.' },
  indexation: { nom: 'L\'indexation oubliée', ico: '📈', rarete: 'commune', vie: 'usage', cible: 'aucune', espace: 1_000_000, texte: 'Bernard, à la comptabilité, a lu une clause que personne n\'avait lue. Elle libère de la place sous le plafond.' },
  creditVille: { nom: 'Le crédit de la ville', ico: '🌉', rarete: 'commune', vie: 'usage', cible: 'aucune', espace: 1_800_000, texte: 'La mairie rembourse l\'asphaltage du stationnement. Aux livres de la ligue, ça compte.' },
  serviette: { nom: 'Le contrat sur une serviette', ico: '🍽', rarete: 'commune', vie: 'usage', cible: 'recrue', facteur: 0.755, texte: 'Signé sur une serviette de table au restaurant, avec le serveur comme témoin. La ligue l\'a jugé valide.' },
  nonEchange: { nom: 'Clause de non-échange, sauf en cas de tempête', ico: '🌩', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.874, texte: 'Il accepte moins d\'argent contre une clause de non-échange. Une seule exception écrite : la tempête.' },
  preteEte: { nom: 'Le prêt à la ligue d\'été', ico: '🚐', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.839, cout: 6, texte: 'Trois semaines prêté à la ligue d\'été de Rimouski, logé chez un oncle. Les papiers suivent par la poste.' },
  fondation: { nom: 'Le chèque de la fondation', ico: '🎢', rarete: 'peu', vie: 'usage', cible: 'aucune', espace: 2_500_000, texte: 'Une fondation locale envoie un chèque, avec une lettre qui parle beaucoup des gardiens.' },
  copropriete: { nom: 'La retenue en copropriété', ico: '🛎', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.72, texte: 'Trois clubs se partagent son salaire. Il a trois chandails dans sa garde-robe, et un seul camion.' },
  etale: { nom: 'Le rachat étalé sur quatre ans', ico: '⏩', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.804, cout: 7, texte: 'Le comptable étale le rachat sur quatre ans, à la calculatrice, en trois après-midi.' },
  rallonge: { nom: 'La rallonge du plafond', ico: '🗜', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 4_000_000, texte: 'Les gouverneurs votent la rallonge à main levée, un jeudi après-midi, devant une salle à moitié vide.' },
  stabilisation: { nom: 'Le fonds de stabilisation', ico: '⚖', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 3_500_000, cout: 10, texte: 'Le fonds de stabilisation de la ligue verse sa part. Personne ne sait au juste ce qu\'il stabilise.' },
  deuxVolets: { nom: 'Le contrat à deux volets', ico: '🪞', rarete: 'rare', vie: 'usage', cible: 'joueur', facteur: 0.72, cout: 6, texte: 'Un volet pour la grande ligue, un pour le club-école. Son agent en a demandé un troisième, pour son frère.' },
  enveloppeRecrues: { nom: 'L\'enveloppe des recrues', ico: '📲', rarete: 'rare', vie: 'usage', cible: 'recrue', facteur: 0.615, cout: 8, texte: 'Un contrat d\'entrée si mince qu\'il est parti par texto. La recrue a répondu d\'un pouce levé.' },
  chequeBlanc: { nom: 'Le chèque en blanc du proprio', ico: '🧧', rarete: 'legendaire', vie: 'permanent', cible: 'aucune', espace: 7_000_000, cout: 60, texte: 'Le proprio signe un chèque en blanc, puis part en croisière. Le DG le range dans son tiroir, sous clé.' },
  depassement: { nom: 'La pénalité de dépassement', ico: '🚨', rarete: 'maudite', vie: 'saison', cible: 'aucune', espace: -2_500_000, texte: 'La masse salariale dépasse de trois dollars. La ligue exige un chèque certifié avant vendredi.' },

  // Nouveaux contrats
  clause_demenagement: { nom: 'La clause de déménagement', ico: '📦', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.925, cout: 5, texte: 'Le club paie les boîtes et le camion de déménagement. En retour, son salaire baisse.' },
  fond_urgence: { nom: 'Le fonds d\'urgence de la ligue', ico: '🚑', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 5_000_000, cout: 15, texte: 'La ligue avance des fonds à taux avantageux, pour « causes imprévues ». La lettre ne dit pas lesquelles.' },
  salaire_differe: { nom: 'Le salaire différé en 2040', ico: '📅', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.75, cout: 12, texte: 'Le gros de son salaire lui sera versé en 2040, bien après sa retraite. D\'ici là, le club respire.' },

};

/* ---------- LES CARTES DE MATCH (v2, l'adversaire ne les pige pas : `horsAdverse`) ---------- */
export const CARTES_MATCH_VIE = {
  // le Frelon : des tirs
  tempeteRondelles: { nom: 'La tempête de rondelles', ico: '⛈', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Tout le monde lance, des pointes comme des coins. Le gardien adverse ne voit plus le jour.', effet: { volume: 1.098, discipline: 1.07 } },
  lancerAveugle: { nom: 'Le lancer sans regarder', ico: '🙈', cout: 1, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Il décoche sans lever la tête, et ne regarde le filet qu\'une fois la rondelle partie.', effet: { volume: 1.112, finition: 0.972, defense: 1.028 } },
  marathon: { nom: 'Le marathon de la rondelle', ico: '🚴', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Les lancers s\'empilent période après période. En troisième, le gardien adverse a les jambes en coton.', effet: { volume: 1.168, energie: 1.14, discipline: 1.07 } },
  // l'Aigle : de la précision
  poignetGauche: { nom: 'Le lancer du poignet gauche', ico: '🤚', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Il est droitier, mais il décoche du mauvais côté. Le gardien n\'a jamais vu ça.', effet: { finition: 1.07, energie: 1.084 } },
  tirDesaxe: { nom: 'Le tir désaxé', ico: '↗', cout: 2, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Le gardien glisse à gauche, la rondelle part à droite. Même le tireur a l\'air surpris.', effet: { finition: 1.112, volume: 0.958 } },
  fauxDepart: { nom: 'Le faux départ', ico: '🏁', cout: 0, rarete: 'peu', genre: 'tactique', horsAdverse: true,
    texte: 'On leur laisse croire qu\'on n\'a rien préparé, jusqu\'au premier coup de sifflet.', piege: { finition: 1.056, volume: 1.042 } },
  tirDecennie: { nom: 'Le tir de la décennie', ico: '🎇', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Le genre de lancer qu\'on retrouve en affiche dans une chambre d\'enfant, trois semaines plus tard.', effet: { finition: 1.126, defense: 1.042 } },
  // la Tortue : fermer la porte
  degagementGradins: { nom: 'Le dégagement dans les gradins', ico: '🪂', cout: 1, rarete: 'commune', genre: 'defense', horsAdverse: true,
    texte: 'Le dégagement monte haut et atterrit dans la section 108, chez un monsieur qui n\'a rien demandé.', effet: { defense: 0.944, volume: 0.958 } },
  tempoMetronome: { nom: 'Le tempo du métronome', ico: '🐌', cout: 2, rarete: 'rare', genre: 'tactique', horsAdverse: true,
    texte: 'Un bâton à changer, un lacet à refaire : à chaque arrêt, on prend son temps. Le match ralentit au pas.', effet: { energie: 1.056 }, adv: { volume: 0.86, finition: 0.958 } },
  jeuBlanc: { nom: 'La soirée du jeu blanc', ico: '🕳', cout: 3, rarete: 'legendaire', genre: 'defense', epuise: true, horsAdverse: true,
    texte: 'Un soir où le filet semble avoir rétréci. Au banc, personne n\'ose prononcer le mot.', effet: { defense: 0.79, finition: 0.972 } },
  // le Rhino : le contact
  contactSalutaire: { nom: 'Le contact salutaire', ico: '🦾', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Un coup d\'épaule le long de la bande, sans méchanceté. Juste pour qu\'ils se souviennent qu\'on est là.', effet: { robustesse: 2, volume: 0.958 } },
  vieuxDur: { nom: 'Le vieux dur reprend du service', ico: '🧔', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Le vieux dur sort de sa retraite pour un soir. Il lace ses patins comme s\'il n\'était jamais parti.', effet: { robustesse: 2.6, discipline: 1.28, finition: 0.958 } },
  // le Doc : les jambes
  sieste: { nom: 'La sieste d\'avant-match', ico: '💤', cout: 0, rarete: 'commune', genre: 'tactique', horsAdverse: true,
    texte: 'Vingt minutes dans le noir à l\'hôtel, un oreiller emprunté sous la tête.', energieTous: 8 },
  presencesCourtes: { nom: 'Les présences de vingt secondes', ico: '⏰', cout: 1, rarete: 'peu', genre: 'tactique', horsAdverse: true,
    texte: 'Un chronomètre au banc, et une seule consigne : on saute dès que ça tire dans les mollets.', effet: { energie: 0.86, volume: 0.986 } },
  // l'Abbé : la discipline
  mainsPoches: { nom: 'Les mains dans les poches', ico: '👐', cout: 0, rarete: 'commune', genre: 'defense', horsAdverse: true,
    texte: 'Consigne au banc : les mains loin des chandails adverses, surtout pour ceux qui les ont lestes.', effet: { discipline: 0.804, volume: 0.972 } },
  courrielArbitre: { nom: 'Le courriel à l\'arbitre en chef', ico: '📧', cout: 1, rarete: 'peu', genre: 'tactique', horsAdverse: true,
    texte: 'Un courriel poli, détaillé, avec la ligue en copie. Ce soir, les arbitres ont le sifflet facile.', adv: { discipline: 1.42, energie: 1.056 } },
  // le Contremaître : tout le monde joue
  troisiemePaire: { nom: 'La troisième paire sort de l\'ombre', ico: '🔂', cout: 0, rarete: 'commune', genre: 'tactique', horsAdverse: true,
    texte: 'La troisième paire n\'avait presque pas vu la glace depuis des semaines. Ce soir, l\'entraîneur l\'envoie tôt.', effet: { D: [0.95, 1, 1.15], energie: 0.944 } },
  quatriemeTrioAttaque: { nom: 'Le quatrième trio à l\'attaque', ico: '🛗', cout: 1, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Le quatrième trio tente le jeu qu\'il a répété une seule fois, dans le stationnement.', effet: { F: [0.93, 1, 1.05, 1.22], volume: 1.028 } },
  // le Showman : les vedettes
  vedetteReclame: { nom: 'La vedette réclame la rondelle', ico: '🧑‍🎤', cout: 1, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'La vedette reste debout au banc et réclame la rondelle à chaque présence. Personne ne la lui refuse.', effet: { F: [1.18, 1.02, 0.92, 0.82], energie: 1.056 } },
  matchDeSaVie: { nom: 'Le match de sa vie', ico: '🏅', cout: 3, rarete: 'legendaire', genre: 'attaque', epuise: true, horsAdverse: true,
    texte: 'Un soir où il se sent capable de tout. Il en parlera encore à ses petits-enfants.', effet: { F: [1.45, 1.1, 0.8, 0.6], finition: 1.112, energie: 1.168 } },
  // neutres : le dépistage et les rabais
  cartesPoche: { nom: 'Les cartes de poche', ico: '📇', cout: 1, rarete: 'peu', genre: 'tactique', rabais: 'tactique', horsAdverse: true,
    texte: 'L\'entraîneur garde ses fiches de jeux dans sa poche, classées par humeur. Il en sort une à chaque arrêt.', effet: { discipline: 0.916 } },
  rapportDepisteurs: { nom: 'Le rapport des dépisteurs', ico: '🛰', cout: 2, rarete: 'peu', genre: 'tactique', ecarte: 2, horsAdverse: true,
    texte: 'Le rapport des dépisteurs fait quarante pages. L\'entraîneur en a souligné trois.' },

  // Nouvelles cartes de match
  feinte_fantome: { nom: 'La feinte fantôme', ico: '👻', cout: 2, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Il fait le geste du lancer, le gardien plonge, et la rondelle est déjà de l\'autre côté.', effet: { finition: 1.15, volume: 0.95 } },
  mur_humain: { nom: 'Le mur humain', ico: '🧱', cout: 1, rarete: 'commune', genre: 'defense', horsAdverse: true,
    texte: 'Cinq joueurs en ligne devant le filet, bâtons sur la glace. L\'arbitre hésite à siffler.', effet: { defense: 0.9, discipline: 1.1 } },
  acceleration_subite: { nom: 'L\'accélération subite', ico: '🚀', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Il change de vitesse à la ligne rouge et laisse son couvreur sur place.', effet: { volume: 1.12, finition: 1.05 } },
  provocation_banc: { nom: 'La provocation du banc', ico: '🗣', cout: 1, rarete: 'commune', genre: 'tactique', horsAdverse: true,
    texte: 'Un mot lancé depuis notre banc, au bon moment, au bon joueur. L\'adversaire voit rouge.', adv: { discipline: 1.35, finition: 0.95 } },
  repli_total: { nom: 'Le repli total', ico: '🐢', cout: 2, rarete: 'peu', genre: 'defense', horsAdverse: true,
    texte: 'Tout le monde recule. Même notre ailier le plus offensif bloque des tirs de la cheville.', effet: { defense: 0.85, volume: 0.85 } },
  passe_aveugle: { nom: 'La passe à l\'aveuglette', ico: '🫣', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Une passe dans le dos, sans regarder. Elle trouve la palette d\'un coéquipier dans l\'enclave.', effet: { finition: 1.1, energie: 1.05 } },
  echec_et_mat: { nom: 'Échec et mat', ico: '♟', cout: 3, rarete: 'legendaire', genre: 'tactique', epuise: true, horsAdverse: true,
    texte: 'On a étudié leurs sorties de zone toute la semaine. Ce soir, on les attend dans chaque couloir.', adv: { finition: 0.85, volume: 0.85 }, effet: { defense: 0.85 } },
  jeu_puissance: { nom: 'Le jeu de puissance improvisé', ico: '🏋', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'À cinq contre cinq, on s\'installe en zone comme en avantage numérique.', effet: { volume: 1.15, finition: 1.1, defense: 1.1 } },

};
