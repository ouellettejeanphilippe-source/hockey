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
  style_roulette: { nom: 'Style : la roulette', ico: '🚏', cible: 'libre', source: 'style', quoi: 'Il change d\'aile à chaque présence, pour que personne ne le devine, lui compris.', profils: { passeur: 6, energie: 6 }, creation: 1.07 },
  style_replie: { nom: 'Style : le replié', ico: '🪃', cible: 'libre', source: 'style', quoi: 'Il revient en zone avant la rondelle, et il le mentionne en rentrant au banc.', profils: { checker: 8 }, defense: 0.979 },
  baton_hache: { nom: 'Le bâton de hache', ico: '🪓', cible: 'libre', source: 'style', quoi: 'Un modèle de 1983, trouvé dans un sous-sol de Chicoutimi. Il y tient.', profils: { sniper: 5 }, finition: 1.028, lancers: 0.972 },
  style_discret: { nom: 'Style : le discret', ico: '🕶️', cible: 'libre', source: 'style', quoi: 'On ne le remarque jamais, ni les adversaires, ni les médecins.', profils: { deuxsens: 5 }, blessure: 0.902 },
  masque_citrouille: { nom: 'Le masque citrouille', ico: '🎃', cible: 'libre', source: 'style', gardien: true, quoi: 'Peint par son neveu. La ligue l\'a interdit deux fois.', arrets: 0.979 },
  contrat_proximite: { nom: 'Clause de proximité', ico: '🏘️', cible: 'libre', source: 'contrat', quoi: 'Il joue mieux à dix minutes de chez sa mère, et nulle part ailleurs.', finition: 1.07, blessure: 1.14 },
  contrat_cafetiere: { nom: 'Clause de la cafetière', ico: '🫗', cible: 'libre', source: 'contrat', quoi: 'Une cafetière dans son casier, aux frais du club. Il ne dort plus.', lancers: 1.105, blessure: 1.14 },
  // peu commune : un canal à cinq pour cent, ou deux plus petits
  style_garagiste: { nom: 'Style : le garagiste', ico: '🪚', cible: 'libre', source: 'style', quoi: 'Il lance comme il répare : sans lire le manuel.', profils: { power: 8 }, lancers: 1.123, finition: 0.969 },
  style_chirurgien: { nom: 'Style : le chirurgien', ico: '🧫', cible: 'libre', source: 'style', quoi: 'Un seul lancer par présence, tiré avec des gants de latex.', profils: { sniper: 10 }, finition: 1.123, lancers: 0.938 },
  style_pare_chocs: { nom: 'Style : le pare-chocs', ico: '🚙', cible: 'libre', source: 'style', quoi: 'Il se place devant le tir, par principe et par assurance.', profils: { defensif: 10 }, defense: 0.929 },
  style_bon_voisin: { nom: 'Style : le bon voisin', ico: '🏡', cible: 'libre', source: 'style', quoi: 'Il aide tout le monde à déménager, sauf les adversaires.', profils: { passeur: 8, deuxsens: 6 }, creation: 1.123 },
  style_taverne: { nom: 'Style : le pilier de taverne', ico: '🍻', cible: 'libre', source: 'style', quoi: 'Il frappe tout ce qui bouge, et quelques cadres au mur.', profils: { power: 12 }, finition: 0.969 },
  style_veilleur: { nom: 'Style : le veilleur de nuit', ico: '🔦', cible: 'libre', source: 'style', quoi: 'Il ne dort pas, ne glisse pas, et rentre toujours avant le couvre-feu.', profils: { energie: 10 }, lancers: 1.092, blessure: 0.776 },
  style_violoniste: { nom: 'Style : le violoniste', ico: '🎻', cible: 'libre', source: 'style', quoi: 'Il joue tout en finesse, et les défenseurs finissent par pleurer.', profils: { passeur: 12, manieur: 10 }, creation: 1.154, lancers: 0.938 },
  masque_pompier: { nom: 'Le casque de pompier', ico: '🧯', cible: 'libre', source: 'style', gardien: true, quoi: 'Il éteint tout, et il a la tenue pour ça.', arrets: 0.937, blessure: 1.14 },
  contrat_assiduite: { nom: 'Clause d\'assiduité', ico: '📆', cible: 'libre', source: 'contrat', quoi: 'Un boni par match joué. Il joue grippé, ce qui est contractuel.', lancers: 1.092, blessure: 1.336 },
  contrat_deplacement: { nom: 'Clause de non-déplacement', ico: '📄', cible: 'libre', source: 'contrat', quoi: 'Il refuse de prendre l\'avion. Il se sent chez lui partout, sauf chez l\'adversaire.', defense: 0.952, finition: 0.969 },
  // rare : un vrai bonus, et son prix
  style_harponneur: { nom: 'Style : le harponneur', ico: '🔱', cible: 'libre', source: 'style', quoi: 'Il lance peu. Mais alors.', profils: { sniper: 15 }, finition: 1.176, lancers: 0.874 },
  style_metronome: { nom: 'Style : le métronome', ico: '⌛', cible: 'libre', source: 'style', quoi: 'Une présence d\'une minute, pas une seconde de plus, pas une de moins.', profils: { energie: 12, deuxsens: 8 }, lancers: 1.126, blessure: 1.28 },
  style_douanier: { nom: 'Style : le douanier', ico: '🛃', cible: 'libre', source: 'style', quoi: 'Rien ne passe sans papiers, et il en demande beaucoup.', profils: { defensif: 15, deuxsens: 10 }, defense: 0.895, lancers: 0.924 },
  style_marionnettiste: { nom: 'Style : le marionnettiste', ico: '🪆', cible: 'libre', source: 'style', quoi: 'Il tire les ficelles de son trio, et un peu celles de l\'arbitre.', profils: { passeur: 15, manieur: 12 }, creation: 1.176, finition: 0.95 },
  style_forgeron: { nom: 'Style : le forgeron', ico: '⚒️', cible: 'libre', source: 'style', quoi: 'Chaque mise en échec est martelée, refroidie, puis recommencée.', profils: { power: 15, physique: 12 }, lancers: 1.076, finition: 0.95, blessure: 1.28 },
  masque_oracle: { nom: 'Le masque de l\'oracle', ico: '🧙', cible: 'libre', source: 'style', gardien: true, quoi: 'Il sait où va le tir avant le tireur. Il refuse de dire comment.', arrets: 0.916, blessure: 1.28 },
  contrat_profits: { nom: 'Clause de participation aux profits', ico: '🏧', cible: 'libre', source: 'contrat', quoi: 'Il touche un pourcentage du bar. Il ne rate plus un match, ni un verre.', finition: 1.101, lancers: 1.076, blessure: 1.42 },
  contrat_avril: { nom: 'Clause de fin de saison', ico: '🗓️', cible: 'libre', source: 'contrat', quoi: 'Il garde ses forces pour avril. Octobre le déçoit.', defense: 0.937, lancers: 0.924, blessure: 0.664 },
  // légendaire : le plus gros bonus du lot, un prix qui se sent
  style_heros_quartier: { nom: 'Style : le héros du quartier', ico: '🌆', cible: 'libre', source: 'style', quoi: 'Il sait que le quartier le regarde. Le quartier le sait aussi.', profils: { sniper: 15, passeur: 12 }, finition: 1.157, creation: 1.09, blessure: 1.56 },
  style_dernier_rempart: { nom: 'Style : le dernier rempart', ico: '🗼', cible: 'libre', source: 'style', quoi: 'Il tient la ligne bleue comme un phare tient le rocher.', profils: { defensif: 20, deuxsens: 12 }, defense: 0.863, lancers: 0.888, creation: 0.933 },
  masque_cuir: { nom: 'Le masque de cuir', ico: '🥽', cible: 'libre', source: 'style', gardien: true, quoi: 'Un gardien de quarante ans, un jeu blanc par mois, aucune explication.', arrets: 0.887, blessure: 1.42 },

  // Nouveaux styles et contrats (ajouts)
  style_jongleur: { nom: 'Style : le jongleur', ico: '🤹', cible: 'libre', source: 'style', quoi: 'Il manie la rondelle dans les airs, la foule retient son souffle.', profils: { manieur: 12 }, creation: 1.14, lancers: 0.94 },
  style_demolisseur: { nom: 'Style : le démolisseur', ico: '🏗️', cible: 'libre', source: 'style', quoi: 'S\'il n\'a pas la rondelle, il s\'assure que personne d\'autre ne l\'ait non plus.', profils: { power: 15, physique: 12 }, lancers: 1.1, finition: 0.92, blessure: 1.25 },
  style_opportuniste: { nom: 'Style : l\'opportuniste', ico: '🦅', cible: 'libre', source: 'style', quoi: 'Il traîne près de la ligne bleue et attend les revirements.', profils: { sniper: 12, passeur: 8 }, finition: 1.12, defense: 0.92 },
  baton_carbone: { nom: 'Le bâton ultra-léger', ico: '🪶', cible: 'libre', source: 'style', quoi: 'Il pèse moins d\'une livre. Il casse sur les tirs frappés.', profils: { sniper: 10 }, lancers: 1.15, finition: 1.05, blessure: 0.88 },
  masque_miroir: { nom: 'Le masque miroir', ico: '🪞', cible: 'libre', source: 'style', gardien: true, quoi: 'Les tireurs voient leur propre peur en s\'approchant.', arrets: 0.965 },
  contrat_glace: { nom: 'Clause de glace à l\'année', ico: '🧊', cible: 'libre', source: 'contrat', quoi: 'Il exige une patinoire dans son jardin l\'hiver.', lancers: 1.05, blessure: 1.05 },
  contrat_animaux: { nom: 'Clause des mascottes', ico: '🐕', cible: 'libre', source: 'contrat', quoi: 'Il amène ses trois huskies dans le vestiaire les mardis.', finition: 1.04, lancers: 1.04, blessure: 1.15 },

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
  sandwich: { nom: 'Le sandwich du dépanneur', ico: '🥪', rarete: 'commune', vie: 'usage', cible: 'joueur', gestes: { energie: 18 }, texte: 'Jambon, moutarde, et une confiance aveugle dans la date de péremption.' },
  baume: { nom: 'Le baume de grand-maman', ico: '🪻', rarete: 'commune', vie: 'usage', cible: 'blesse', gestes: { soin: 2 }, effet: { energie: 1.14 }, duree: 3, texte: 'Il sent la menthe, et personne ne sait ce qu\'elle y met d\'autre.' },
  thermos: { nom: 'Le thermos de soupe', ico: '🍲', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 4 }, effet: { blessure: 0.895 }, duree: 4, texte: 'Pois cassés, recette de la quatrième génération.' },
  venteGarage: { nom: 'La vente de garage', ico: '🪑', rarete: 'commune', vie: 'usage', cible: 'aucune', gain: 10, texte: 'On vend les vieilles chaises du vestiaire. Elles valaient plus que prévu.' },
  gomme: { nom: 'La gomme à mâcher', ico: '🍬', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { finition: 1.07, discipline: 1.14 }, duree: 3, texte: 'Menthe, mâchée en rafale, collée sous le banc.' },
  bas: { nom: 'Les bas de laine', ico: '🧶', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { energie: 0.86 }, duree: 4, texte: 'Offerts par une tante, tricotés à la main, trop chauds pour l\'aréna.' },
  tableauMagnetique: { nom: 'Le tableau magnétique', ico: '🖇️', rarete: 'commune', vie: 'usage', cible: 'tactique', maitrise: 0.15, texte: 'Des aimants en forme de rondelle, et trois couleurs de feutre.' },
  patinsNeufs: { nom: 'Les patins neufs', ico: '⛸️', rarete: 'commune', vie: 'usage', cible: 'joueur', gestes: { energie: 20 }, effet: { blessure: 1.175 }, duree: 3, texte: 'Aiguisés jeudi, étrennés ce soir. Les pieds protestent.' },
  tisane: { nom: 'La tisane de minuit', ico: '🍵', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { energieTous: 8 }, effet: { blessure: 0.825 }, duree: 4, texte: 'Camomille, miel, et un entraîneur qui monte la garde.' },
  deuxiemeAvis: { nom: 'Le deuxième avis', ico: '🥼', rarete: 'peu', vie: 'usage', cible: 'blesse', gestes: { soin: 6 }, effet: { energie: 1.14 }, duree: 3, texte: 'Le diagnostic est le même. Le médecin, lui, est plus aimable.' },
  chandailChance: { nom: 'Le chandail porte-bonheur', ico: '👘', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { finition: 1.105, discipline: 1.14 }, duree: 3, texte: 'Lavé une seule fois depuis 2019. Personne ne s\'en approche.' },
  suppleant: { nom: 'La soirée du suppléant', ico: '🪁', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { gardienAux: 2 }, effet: { energie: 0.895 }, duree: 3, texte: 'Le suppléant a prévenu sa famille. Les billets sont déjà vendus.' },
  tirageFondation: { nom: 'Le tirage de la fondation', ico: '🎪', rarete: 'peu', vie: 'usage', cible: 'aucune', pari: { chance: 0.4, gain: 40 }, texte: 'Les profits vont aux œuvres, le gros lot à un certain Gilles.' },
  commandite: { nom: 'La commandite du garagiste', ico: '🛻', rarete: 'peu', vie: 'usage', cible: 'aucune', gain: 18, texte: 'Le logo sur la bande, et un chèque qui ne rebondit qu\'à peine.' },
  cahierAnnote: { nom: 'Le cahier annoté', ico: '📓', rarete: 'peu', vie: 'usage', cible: 'tactique', maitrise: 0.25, texte: 'Les marges sont plus riches que les jeux.' },
  mainBaladeuse: { nom: 'La main baladeuse', ico: '✋', rarete: 'peu', vie: 'usage', cible: 'aucune', regle: true, effet: { volume: 1.105, discipline: 1.35 }, duree: 3, texte: 'Une main sur le chandail adverse, l\'autre sur la bonne conscience.' },
  chirurgienLundi: { nom: 'Le chirurgien du lundi', ico: '🩼', rarete: 'rare', vie: 'permanent', cible: 'blesse', gestes: { soin: 9 }, effet: { energie: 1.28 }, duree: 6, texte: 'Une plage libre, une table propre, un genou à refaire avant le souper.' },
  bainJouvence: { nom: 'Le bain de jouvence', ico: '⛲', rarete: 'rare', vie: 'permanent', cible: 'aucune', gestes: { energieTous: 25 }, effet: { finition: 0.916, blessure: 1.28 }, duree: 3, texte: 'Tout le monde en ressort revigoré, et un peu mou.' },
  caisseNoire: { nom: 'La caisse noire', ico: '🏴', rarete: 'rare', vie: 'permanent', cible: 'aucune', gain: 38, effet: { discipline: 1.28 }, duree: 5, texte: 'Les livres ont été égarés pendant un déménagement très convenable.' },
  seminaire: { nom: 'Le séminaire de leadership', ico: '🏫', rarete: 'rare', vie: 'permanent', cible: 'tactique', maitrise: 0.4, effet: { finition: 0.944, volume: 0.944 }, duree: 3, texte: 'Trois jours de diapositives. Les jambes ont eu congé, le cerveau non.' },
  derniereChance: { nom: 'La saison de la dernière chance', ico: '🌅', rarete: 'rare', vie: 'usage', cible: 'aucune', effet: { finition: 1.14, defense: 0.916, blessure: 1.56 }, duree: 4, texte: 'Le dernier contrat de la moitié du vestiaire, et personne n\'en parle.' },
  minuteSilence: { nom: 'La minute de silence', ico: '🤐', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { discipline: 0.58, finition: 0.965 }, duree: 4, texte: 'Soixante secondes sans commentaire, une première cette saison.' },
  brunchArbitre: { nom: 'Le brunch avec l\'arbitre', ico: '🥐', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { discipline: 0.58, finition: 0.965 }, duree: 4, texte: 'Œufs, café, et un échange cordial sur l\'interprétation du livre.' },
  listeReservistes: { nom: 'La liste des réservistes', ico: '🗄️', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { F: [0.88, 1, 1.08, 1.2], energie: 0.895 }, duree: 4, texte: 'Ils sont dix-huit à croire qu\'ils jouent ce soir. Quatre ont raison.' },
  chandailQuatre: { nom: 'Le chandail du quatrième trio', ico: '🎀', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { F: [0.92, 1, 1.06, 1.2], finition: 0.965 }, duree: 4, texte: 'Cousu à la main, avec le nom mal épelé.' },
  sacSable: { nom: 'Le sac de sable du sous-sol', ico: '🏜️', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { robustesse: 1.6, energie: 1.14 }, duree: 4, texte: 'Il le frappe depuis 1998 et refuse d\'en discuter.' },
  filmButs: { nom: 'Le film des buts accordés', ico: '🎬', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { defense: 0.895, finition: 0.965 }, duree: 3, texte: 'Douze minutes, sans musique, sans commentaire, sans maïs soufflé.' },
  cibleCarton: { nom: 'La cible en carton', ico: '🪀', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { volume: 1.14, energie: 1.14 }, duree: 3, texte: 'Clouée au mur du garage, percée à chaque coin.' },

  // Nouveaux consommables
  gourde_secrete: { nom: 'La gourde mystère', ico: '🧪', rarete: 'peu', vie: 'usage', cible: 'joueur', gestes: { energie: 35 }, effet: { blessure: 1.3 }, duree: 4, texte: 'Le préparateur jure que c\'est légal. Les yeux du joueur brillent.' },
  reunion_crise: { nom: 'La réunion de crise', ico: '⚠️', rarete: 'rare', vie: 'usage', cible: 'aucune', effet: { finition: 1.15, defense: 0.85, discipline: 1.2 }, duree: 5, texte: 'Le DG a verrouillé les portes. Tout le monde a compris le message.' },
  seance_yoga: { nom: 'La séance de yoga', ico: '🧘', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 15 }, effet: { robustesse: 0.7 }, duree: 4, texte: 'Respirations profondes. Personne ne veut frapper personne.' },
  diner_equipe: { nom: 'Le dîner payé', ico: '🍔', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 10 }, effet: { discipline: 0.8 }, duree: 3, texte: 'L\'entraîneur paie le fast-food. La bonne humeur règne.' },
  video_motivation: { nom: 'La vidéo virale', ico: '📱', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { volume: 1.1, energie: 1.15 }, duree: 4, texte: 'Trois minutes de musique intense et de gros arrêts.' },
  entrainement_sable: { nom: 'L\'entraînement dans le sable', ico: '🏖️', rarete: 'rare', vie: 'permanent', cible: 'aucune', effet: { energie: 1.4, finition: 0.9 }, duree: 6, texte: 'Les mollets brûlent, mais les jambes sont légères après.' },
  visite_chiens: { nom: 'La visite des chiens guides', ico: '🦮', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { discipline: 0.75, blessure: 0.85 }, duree: 4, texte: 'La tension fond comme neige au soleil.' },

};

/* ---------- LES CONTRATS (le plafond se manipule) ---------- */
export const CONTRATS_VIE = {
  fidelite: { nom: 'Le rabais de fidélité', ico: '🐕', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.944, texte: 'Il reste pour le prix de l\'épicerie et un abonnement au gym.' },
  billetsSaison: { nom: 'Le boni en billets de saison', ico: '🎫', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.958, texte: 'Quarante places derrière le banc visiteur. Il n\'a pas de famille.' },
  indexation: { nom: 'L\'indexation oubliée', ico: '📈', rarete: 'commune', vie: 'usage', cible: 'aucune', espace: 1_000_000, texte: 'Une clause que personne n\'avait lue, sauf Bernard, à la comptabilité.' },
  creditVille: { nom: 'Le crédit de la ville', ico: '🌉', rarete: 'commune', vie: 'usage', cible: 'aucune', espace: 1_800_000, texte: 'La mairie rembourse l\'asphalte du stationnement. Ça compte, paraît-il.' },
  serviette: { nom: 'Le contrat sur une serviette', ico: '🍽️', rarete: 'commune', vie: 'usage', cible: 'recrue', facteur: 0.755, texte: 'Signé au restaurant, jugé valide à la quatrième lecture.' },
  nonEchange: { nom: 'Clause de non-échange, sauf en cas de tempête', ico: '🌩️', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.874, texte: 'Il accepte moins d\'argent contre la sécurité. La météo reste une exception.' },
  preteEte: { nom: 'Le prêt à la ligue d\'été', ico: '🚐', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.839, cout: 6, texte: 'Trois semaines à Rimouski, chez un oncle. Les papiers suivent.' },
  fondation: { nom: 'Le chèque de la fondation', ico: '🎢', rarete: 'peu', vie: 'usage', cible: 'aucune', espace: 2_500_000, texte: 'Une fondation qui s\'intéresse beaucoup aux gardiens.' },
  copropriete: { nom: 'La retenue en copropriété', ico: '🛎️', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.72, texte: 'Trois clubs se partagent son salaire, et son camion.' },
  etale: { nom: 'Le rachat étalé sur quatre ans', ico: '⏩', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.804, cout: 7, texte: 'Le comptable a utilisé une calculatrice avec beaucoup de touches.' },
  rallonge: { nom: 'La rallonge du plafond', ico: '🗜️', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 4_000_000, texte: 'Votée à main levée un jeudi, à une heure creuse.' },
  stabilisation: { nom: 'Le fonds de stabilisation', ico: '⚖️', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 3_500_000, cout: 10, texte: 'Personne ne sait de quoi il stabilise quoi, mais il est stable.' },
  deuxVolets: { nom: 'Le contrat à deux volets', ico: '🪞', rarete: 'rare', vie: 'usage', cible: 'joueur', facteur: 0.72, cout: 6, texte: 'Un volet pour la grande ligue, un pour le club-école, un pour son frère.' },
  enveloppeRecrues: { nom: 'L\'enveloppe des recrues', ico: '📲', rarete: 'rare', vie: 'usage', cible: 'recrue', facteur: 0.615, cout: 8, texte: 'Un contrat d\'entrée si mince qu\'il tient dans un texto.' },
  chequeBlanc: { nom: 'Le chèque en blanc du proprio', ico: '🧧', rarete: 'legendaire', vie: 'permanent', cible: 'aucune', espace: 7_000_000, cout: 60, texte: 'Le proprio a signé, puis il est parti en croisière.' },
  depassement: { nom: 'La pénalité de dépassement', ico: '🚨', rarete: 'maudite', vie: 'saison', cible: 'aucune', espace: -2_500_000, texte: 'Un chiffre dépassé de trois dollars, et la ligue veut un chèque certifié.' },

  // Nouveaux contrats
  clause_demenagement: { nom: 'La clause de déménagement', ico: '📦', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.925, cout: 5, texte: 'Il a fallu payer les boîtes, mais le salaire baisse.' },
  fond_urgence: { nom: 'Le fonds d\'urgence de la ligue', ico: '🚑', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 5_000_000, cout: 15, texte: 'Un prêt à taux avantageux pour "causes imprévues".' },
  salaire_differe: { nom: 'Le salaire différé en 2040', ico: '📅', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.75, cout: 12, texte: 'Il touchera le gros magot à soixante ans. Pour l\'instant, on économise.' },

};

/* ---------- LES CARTES DE MATCH (v2, l'adversaire ne les pige pas : `horsAdverse`) ---------- */
export const CARTES_MATCH_VIE = {
  // le Frelon : des tirs
  tempeteRondelles: { nom: 'La tempête de rondelles', ico: '⛈️', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Elles tombent de partout, et certaines sont même légales.', effet: { volume: 1.098, discipline: 1.07 } },
  lancerAveugle: { nom: 'Le lancer sans regarder', ico: '🙈', cout: 1, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'On regarde le filet seulement une fois la rondelle partie.', effet: { volume: 1.112, finition: 0.972, defense: 1.028 } },
  marathon: { nom: 'Le marathon de la rondelle', ico: '🚴', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Quarante-cinq lancers au chronomètre, et un gardien qui prie.', effet: { volume: 1.168, energie: 1.14, discipline: 1.07 } },
  // l'Aigle : de la précision
  poignetGauche: { nom: 'Le lancer du poignet gauche', ico: '🤚', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Il est droitier. Personne ne le lui a expliqué.', effet: { finition: 1.07, energie: 1.084 } },
  tirDesaxe: { nom: 'Le tir désaxé', ico: '↗️', cout: 2, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Le gardien regarde à gauche, la rondelle part à droite, tout le monde est surpris.', effet: { finition: 1.112, volume: 0.958 } },
  fauxDepart: { nom: 'Le faux départ', ico: '🏁', cout: 0, rarete: 'peu', genre: 'tactique', horsAdverse: true,
    texte: 'On leur laisse croire qu\'on n\'a rien préparé.', piege: { finition: 1.056, volume: 1.042 } },
  tirDecennie: { nom: 'Le tir de la décennie', ico: '🎇', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Celui qu\'on retrouve sur une affiche, trois semaines plus tard.', effet: { finition: 1.126, defense: 1.042 } },
  // la Tortue : fermer la porte
  degagementGradins: { nom: 'Le dégagement dans les gradins', ico: '🪂', cout: 1, rarete: 'commune', genre: 'defense', horsAdverse: true,
    texte: 'La rondelle atterrit chez un monsieur qui n\'a rien demandé.', effet: { defense: 0.944, volume: 0.958 } },
  tempoMetronome: { nom: 'Le tempo du métronome', ico: '🐌', cout: 2, rarete: 'rare', genre: 'tactique', horsAdverse: true,
    texte: 'On ralentit la partie à la vitesse d\'une conférence de presse.', effet: { energie: 1.056 }, adv: { volume: 0.86, finition: 0.958 } },
  jeuBlanc: { nom: 'La soirée du jeu blanc', ico: '🕳️', cout: 3, rarete: 'legendaire', genre: 'defense', epuise: true, horsAdverse: true,
    texte: 'Le filet est resté fermé, et personne n\'ose le dire à voix haute.', effet: { defense: 0.79, finition: 0.972 } },
  // le Rhino : le contact
  contactSalutaire: { nom: 'Le contact salutaire', ico: '🦾', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Un petit coup d\'épaule, par politesse.', effet: { robustesse: 2, volume: 0.958 } },
  vieuxDur: { nom: 'Le vieux dur reprend du service', ico: '🧔', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Rappelé d\'une retraite qu\'il trouvait pourtant très réussie.', effet: { robustesse: 2.6, discipline: 1.28, finition: 0.958 } },
  // le Doc : les jambes
  sieste: { nom: 'La sieste d\'avant-match', ico: '💤', cout: 0, rarete: 'commune', genre: 'tactique', horsAdverse: true,
    texte: 'Vingt minutes dans le noir, avec un oreiller prêté.', energieTous: 8 },
  presencesCourtes: { nom: 'Les présences de vingt secondes', ico: '⏰', cout: 1, rarete: 'peu', genre: 'tactique', horsAdverse: true,
    texte: 'Un chronomètre au banc, et une consigne : on saute dès que ça tire sur les mollets.', effet: { energie: 0.86, volume: 0.986 } },
  // l'Abbé : la discipline
  mainsPoches: { nom: 'Les mains dans les poches', ico: '👐', cout: 0, rarete: 'commune', genre: 'defense', horsAdverse: true,
    texte: 'Une consigne simple, surtout pour les gars qui ont des mains.', effet: { discipline: 0.804, volume: 0.972 } },
  courrielArbitre: { nom: 'Le courriel à l\'arbitre en chef', ico: '📧', cout: 1, rarete: 'peu', genre: 'tactique', horsAdverse: true,
    texte: 'Poli, détaillé, en copie à la ligue. Ils sifflent tout, ce soir.', adv: { discipline: 1.42, energie: 1.056 } },
  // le Contremaître : tout le monde joue
  troisiemePaire: { nom: 'La troisième paire sort de l\'ombre', ico: '🔂', cout: 0, rarete: 'commune', genre: 'tactique', horsAdverse: true,
    texte: 'Elle n\'avait pas touché la glace depuis le premier tour du calendrier.', effet: { D: [0.95, 1, 1.15], energie: 0.944 } },
  quatriemeTrioAttaque: { nom: 'Le quatrième trio à l\'attaque', ico: '🛗', cout: 1, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Ils ont répété ce jeu une fois, dans le stationnement.', effet: { F: [0.93, 1, 1.05, 1.22], volume: 1.028 } },
  // le Showman : les vedettes
  vedetteReclame: { nom: 'La vedette réclame la rondelle', ico: '🧑‍🎤', cout: 1, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Elle ne s\'assoit pas, et le banc a cessé de s\'en plaindre.', effet: { F: [1.18, 1.02, 0.92, 0.82], energie: 1.056 } },
  matchDeSaVie: { nom: 'Le match de sa vie', ico: '🏅', cout: 3, rarete: 'legendaire', genre: 'attaque', epuise: true, horsAdverse: true,
    texte: 'Il en parlera à ses petits-enfants, qui ne l\'écouteront pas.', effet: { F: [1.45, 1.1, 0.8, 0.6], finition: 1.112, energie: 1.168 } },
  // neutres : le dépistage et les rabais
  cartesPoche: { nom: 'Les cartes de poche', ico: '📇', cout: 1, rarete: 'peu', genre: 'tactique', rabais: 'tactique', horsAdverse: true,
    texte: 'Un jeu par fiche, classé par ordre d\'humeur.', effet: { discipline: 0.916 } },
  rapportDepisteurs: { nom: 'Le rapport des dépisteurs', ico: '🛰️', cout: 2, rarete: 'peu', genre: 'tactique', ecarte: 2, horsAdverse: true,
    texte: 'Quarante pages, dont trois qui disent quelque chose.' },

  // Nouvelles cartes de match
  feinte_fantome: { nom: 'La feinte fantôme', ico: '👻', cout: 2, rarete: 'peu', genre: 'attaque', horsAdverse: true,
    texte: 'Il fait le mouvement, mais la rondelle est déjà passée.', effet: { finition: 1.15, volume: 0.95 } },
  mur_humain: { nom: 'Le mur humain', ico: '🧱', cout: 1, rarete: 'commune', genre: 'defense', horsAdverse: true,
    texte: 'Cinq gars en ligne devant le gardien. L\'arbitre hésite.', effet: { defense: 0.9, discipline: 1.1 } },
  acceleration_subite: { nom: 'L\'accélération subite', ico: '🚀', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'Il patine soudainement deux fois plus vite. Le vent décoiffe le banc.', effet: { volume: 1.12, finition: 1.05 } },
  provocation_banc: { nom: 'La provocation du banc', ico: '🗣️', cout: 1, rarete: 'commune', genre: 'tactique', horsAdverse: true,
    texte: 'Un mot bien placé depuis notre banc. L\'adversaire voit rouge.', adv: { discipline: 1.35, finition: 0.95 } },
  repli_total: { nom: 'Le repli total', ico: '🐢', cout: 2, rarete: 'peu', genre: 'defense', horsAdverse: true,
    texte: 'Même notre ailier le plus offensif bloque des tirs de la cheville.', effet: { defense: 0.85, volume: 0.85 } },
  passe_aveugle: { nom: 'La passe à l\'aveuglette', ico: '🫣', cout: 1, rarete: 'commune', genre: 'attaque', horsAdverse: true,
    texte: 'Dans le dos, sans regarder. Elle arrive par miracle.', effet: { finition: 1.1, energie: 1.05 } },
  echec_et_mat: { nom: 'Échec et mat', ico: '♟️', cout: 3, rarete: 'legendaire', genre: 'tactique', epuise: true, horsAdverse: true,
    texte: 'On anticipe leur jeu sur cinq séquences. Leurs avants pleurent.', adv: { finition: 0.85, volume: 0.85 }, effet: { defense: 0.85 } },
  jeu_puissance: { nom: 'Le jeu de puissance improvisé', ico: '🏋️', cout: 2, rarete: 'rare', genre: 'attaque', horsAdverse: true,
    texte: 'À cinq contre cinq, on s\'installe comme si on était un de plus.', effet: { volume: 1.15, finition: 1.1, defense: 1.1 } },

};
