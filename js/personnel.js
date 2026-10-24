/*
 * LE PERSONNEL NEUF (V10, tranche 4 — docs/refonte-v10.md § 4). Des patrons, un poste par rôle (`ROLES`, js/banque.js),
 * engagés pour la saison et les séries. Chacun travaille un MOMENT de la saison (`si`, `MOMENTS_SI`, js/sim.js) : les
 * soirs à l'étranger, les dos-à-dos, après une défaite, contre un rival ou ta bête noire, en séries. Les cartes de
 * saison d'avant (`CARTES`, un bonus payé par un malus) s'y fondent : un poste dit son prix par son moment, plutôt
 * que par un malus.
 *
 * Deux postes par coach, sur son canal (`coachDesCanaux`, js/coachs.js) ; le Comptable, lui, travaille l'argent toute
 * l'année. Trois postes neutres, des communes de trois rôles différents : ce sont eux que le départ d'une run impose
 * (`patronsDeDepart`). Les contrats lourds sont partis (V16, tranche 6) : le contrat de télé est une réponse du dossier
 * de la masse salariale (js/dossiers.js `laMasse`).
 */
/*
 * V14b (JP : *les cartes de base influencent le style de l'équipe sans la rendre vraiment plus forte, et c'est cher
 * upgrader*) : au premier échelon, ce qu'une carte donne, son défaut le reprend — ses soirs, son net en buts tient près
 * de zéro (`check_places`, ±0,5 V). La force, elle, s'achète aux échelons (js/echelons.js `PRIX_ECHELON`).
 */
/* Le feu d'un adjoint (`portee`) prend sa deuxième ligne après deux poussées de sa force : à son troisième échelon. */
export const LIGNES_DU_FEU = { poussees: 2 };
export const PERSONNEL = {
  // ---- neutres : le départ en impose deux ----
  per_gerantEquipement: { role: 'soins', nom: 'Le gérant d\'équipement', ico: '🧺', rarete: 'commune', si: 'dosADos', effet: { energie: 0.95, finition: 1.02, volume: 0.98 },
    texte: 'Les chandails secs, les lacets neufs, le café prêt avant le deuxième match.' },
  per_adjointPolyvalent: { role: 'attaque', nom: 'L\'adjoint polyvalent', ico: '🧩', rarete: 'commune', si: 'apresDefaite', effet: { finition: 1.03, defense: 0.97, volume: 0.97 },
    texte: 'Il a déjà tout fait, et après une défaite, il sait quoi dire.' },
  per_depisteurQuartier: { role: 'depistage', nom: 'Le dépisteur de quartier', ico: '🔦', rarete: 'commune', si: 'domicile', effet: { volume: 1.03, defense: 0.98, finition: 0.99 },
    texte: 'Il connaît chaque planche de la patinoire, et chaque partisan par son nom.' },

  // ---- 🐝 le Frelon ----
  per_crieurDuBanc: { role: 'attaque', nom: 'Le crieur du banc', ico: '📢', rarete: 'commune', si: 'domicile', effet: { volume: 1.08, finition: 0.97 },
    texte: 'Chez nous, on l\'entend crier « Lance ! » de la passerelle de presse.' },
  per_coachDeSprint: { role: 'physique', nom: 'Le coach de sprint', ico: '🏁', rarete: 'peu', si: 'jambesFraiches', effet: { volume: 1.14, finition: 0.97, energie: 1.06 },
    texte: 'Des départs arrêtés, encore et encore. Les jambes fraîches, ça fonce au filet.' },

  // ---- 🦅 l'Aigle ----
  per_tirsDeRoute: { role: 'attaque', nom: 'Le maître des tirs de route', ico: '🧳', rarete: 'commune', si: 'visiteur', effet: { finition: 1.06, volume: 0.95 },
    texte: 'Il emporte son filet de pratique dans l\'autobus.' },
  per_depisteurGardiens: { role: 'depistage', nom: 'Le dépisteur des gardiens', ico: '🔎', rarete: 'rare', si: 'rival', effet: { finition: 1.6, volume: 0.88 },
    texte: 'Il a vu chaque match de leur gardien depuis le junior.' },

  // ---- 🐢 la Tortue ----
  per_gardienDuFort: { role: 'defense', nom: 'Le gardien du fort', ico: '🏯', rarete: 'peu', si: 'apresDefaite', effet: { defense: 0.9, volume: 0.93, finition: 0.95 },
    texte: 'Après une défaite, il reprend le système depuis le début.' },
  per_gardiensDeRoute: { role: 'gardiens', nom: 'L\'entraîneur des gardiens de route', ico: '🧭', rarete: 'commune', si: 'visiteur', effet: { defense: 0.96, volume: 0.95 },
    texte: 'Il arrive à l\'aréna deux heures avant tout le monde, et il mesure les filets.' },

  // ---- 🦏 le Rhino ----
  per_preparateurCombat: { role: 'physique', nom: 'Le préparateur de combat', ico: '🥋', rarete: 'peu', si: 'rival', effet: { robustesse: 1, discipline: 1.1 },
    texte: 'Contre un rival, il veut voir des chandails froissés.' },
  per_sergent: { role: 'chef', nom: 'Le sergent', ico: '🎖', rarete: 'rare', si: 'beteNoire', effet: { robustesse: 1.4, discipline: 1.3 },
    texte: 'Contre ta bête noire, personne ne recule. Pas même devant l\'arbitre.' },

  // ---- 🫁 le Doc ----
  per_physioDeRoute: { role: 'soins', nom: 'Le physio de route', ico: '🩻', rarete: 'commune', si: 'visiteur', effet: { blessure: 0.7, energie: 0.92, robustesse: -0.3 },
    texte: 'Sa table pliante voyage en soute, avec les bâtons.' },
  per_nutritionniste: { role: 'physique', nom: 'Le nutritionniste', ico: '🥗', rarete: 'peu', si: 'dosADos', effet: { energie: 0.82, robustesse: -0.2 },
    texte: 'Entre les deux matchs, des pâtes et pas de frites. Personne ne le remercie.' },

  // ---- 😇 l'Abbé ----
  per_aumonier: { role: 'chef', nom: 'L\'aumônier', ico: '🕍', rarete: 'peu', si: 'apresDefaite', effet: { discipline: 0.75, finition: 0.96, robustesse: -0.4 },
    texte: 'Après une défaite, il parle de patience. Les bâtons restent en bas.' },
  per_ancienArbitre: { role: 'direction', nom: 'L\'ancien arbitre', ico: '🦓', rarete: 'rare', si: 'rival', effet: { discipline: 0.65, robustesse: -0.5 },
    texte: 'Il connaît chaque arbitre de la ligue, et ce qui les fait siffler.' },

  // ---- 🪜 le Contremaître ----
  per_chefDAtelier: { role: 'chef', nom: 'Le chef d\'atelier', ico: '🛠', rarete: 'commune', si: 'jambesLourdes', effet: { F: [0.85, 0.95, 1.1, 1.3], energie: 0.95 },
    texte: 'Les jambes sont lourdes ? Le quatrième trio a toujours des jambes.' },
  per_contremaitreDosADos: { role: 'physique', nom: 'Le répartiteur', ico: '🗂', rarete: 'peu', si: 'dosADos', effet: { F: [0.85, 0.95, 1.1, 1.3], energie: 0.9 },
    texte: 'Il découpe le deuxième soir en quatre parts égales.' },

  // ---- 🌠 le Showman ----
  per_agentDesVedettes: { role: 'direction', nom: 'L\'agent des vedettes', ico: '💼', rarete: 'peu', si: 'domicile', effet: { F: [1.12, 1.04, 0.96, 0.88], defense: 1.04, energie: 1.08 },
    texte: 'Chez nous, ses clients jouent. Les caméras sont là.' },
  per_metteurEnScene: { role: 'chef', nom: 'Le metteur en scène', ico: '🎬', rarete: 'rare', si: 'series', effet: { F: [1.45, 1.05, 0.8, 0.6], defense: 1.06, energie: 1.12 },
    texte: 'En séries, il écrit le match pour ses vedettes.' },

  // ---- 🏦 le Comptable : l'argent, toute l'année ----
  per_caissier: { role: 'direction', nom: 'Le gestionnaire de la caisse', ico: '🗄', rarete: 'commune', econ: { jetonsVictoire: 2 },
    texte: 'Chaque victoire remplit l\'aréna. Il compte les billets.' },
  per_negociateur: { role: 'depistage', nom: 'Le négociateur', ico: '🤝', rarete: 'peu', econ: { rabais: 0.9 },
    texte: 'Il obtient un prix de groupe sur tout ce qui se vend.' },

  /*
   * V16 — LES ADJOINTS NEUFS (docs/refonte-v16.md § 2). JP : *les assistants coachs remplacent toutes les autres cartes
   * de bonus ; inspire-toi des cartes qui partent*. Trois par coach, trois neutres ; chacun reprend une place, un
   * équipement ou une clause. Un adjoint à `protege` travaille aussi un joueur : ses canaux à lui (`CANAUX_MUT`,
   * js/sim.js), ses soirs seulement, posés à l'engagement sur celui que tu nommes, ou que le moteur désigne (`vise`).
   */
  // ---- neutres ----
  // reprend la casquette de la victoire
  per_superstitieux: { role: 'chef', nom: 'Le superstitieux', ico: '🍀', rarete: 'commune', si: 'apresDefaite', effet: { defense: 1.03 },
    protege: { lancers: 1.15, finition: 1.12 }, texte: 'Après une défaite, il choisit qui portera la casquette. Personne ne discute.' },
  // reprend la semaine chargée
  per_maitreCalendrier: { role: 'physique', nom: 'Le maître du calendrier', ico: '🗒', rarete: 'commune', si: 'dosADos', effet: { energie: 0.85, finition: 1.05, volume: 0.96 },
    texte: 'Le calendrier sur le babillard, surligné en jaune. Le deuxième soir, il avait tout prévu.' },
  // reprend la soirée des anciens
  per_ancienCapitaine: { role: 'defense', nom: 'L\'ancien capitaine', ico: '🧥', rarete: 'peu', si: 'domicile', effet: { volume: 1.04, defense: 0.97, finition: 0.96 },
    texte: 'Son chandail est au plafond. Chez nous, il parle aux jeunes avant la période.' },

  // ---- 🐝 le Frelon ----
  // reprend les patins aiguisés
  per_aiguiseur: { role: 'soins', nom: 'L\'aiguiseur', ico: '🪒', rarete: 'commune', si: 'jambesFraiches', effet: { energie: 1.04 }, vise: 'rapide',
    protege: { lancers: 1.3, finition: 1.1 }, texte: 'Une lame neuve les soirs de jambes fraîches : son patineur le plus vite fonce au filet.' },
  // reprend le sprint de mars
  per_maniaqueVolume: { role: 'chef', nom: 'Le maniaque du volume', ico: '🔊', rarete: 'rare', si: 'enFeu', effet: { volume: 1.2, finition: 0.92, energie: 1.04 },
    texte: 'Trois victoires de suite ? Il veut quarante tirs. Pas un de moins.' },
  // reprend le retour devant la foule
  per_animateurFoule: { role: 'direction', nom: 'L\'animateur de foule', ico: '🥁', rarete: 'peu', si: 'domicile', effet: { volume: 1.1, discipline: 1.06, finition: 0.98 },
    texte: 'Le tambour dans la section 300. Chez nous, on lance de partout, et on s\'énerve un peu.' },

  // ---- 🦅 l'Aigle ----
  // reprend la vidéo de leur gardien
  per_monteurVideo: { role: 'depistage', nom: 'Le monteur vidéo', ico: '📹', rarete: 'rare', si: 'rival', effet: { volume: 0.95 }, vise: 'franc',
    protege: { finition: 2, lancers: 1.4 }, texte: 'Chaque but que leur gardien a accordé, monté en dix minutes pour ta meilleure gâchette.' },
  // reprend le coin du haut, peint
  per_peintreDesCoins: { role: 'chef', nom: 'Le géomètre du tir', ico: '📐', rarete: 'commune', si: 'apresDefaite', effet: { finition: 1.07, volume: 0.95 },
    texte: 'Après une défaite, il trace les angles au ruban sur la bande. On tire moins, on vise mieux.' },
  // reprend le ruban blanc et les bâtons neufs
  per_maitreRuban: { role: 'soins', nom: 'Le maître du ruban', ico: '🪢', rarete: 'peu', si: 'domicile', effet: { volume: 0.97 }, vise: 'franc',
    protege: { finition: 1.25, lancers: 1.08 }, texte: 'Le même ruban depuis le junior, refait à chaque match chez nous.' },
  /*
   * LE FEU QUI S'ENTRETIENT (V3.6, le premier combo : `LANCEE`, js/sim.js ; `check_combo`) : trois adjoints de l'Aigle
   * et le vendeur de chandails. Chacun pose son feu sur une ligne (`portee`) : le meilleur marqueur de la ligne, ou ses
   * compagnons. Au troisième échelon, le feu gagne la deuxième ligne, et la poudre tous les patineurs de ses deux lignes
   * (`lignesDuFeu`, js/echelons.js ; `porteeDuFeu`, js/sim.js).
   */
  // reprend l'étincelle
  per_allumeur: { role: 'attaque', nom: 'L\'allumeur', ico: '☄', rarete: 'rare', protege: { feu: 'etincelle', portee: 'tete' },
    texte: 'Il repère celui qui a la main chaude, et il lui donne la rondelle. Trois buts, et ça s\'allume.' },
  // reprend la braise
  per_gardienBraise: { role: 'physique', nom: 'Le gardien de la braise', ico: '🪔', rarete: 'rare', protege: { feu: 'braise', portee: 'tete' },
    texte: 'Quand un joueur est en feu, il ne change rien : la même routine, le même siège dans l\'autobus.' },
  // reprend la traînée de poudre
  per_semeurPoudre: { role: 'chef', nom: 'Le semeur de poudre', ico: '💫', rarete: 'rare', protege: { feu: 'poudre', portee: 'compagnons' },
    texte: 'Il met ses compagnons de ligne dans la même chambre que celui qui marque. Ça se propage.' },

  // ---- 🐢 la Tortue ----
  // reprend le mur du dimanche
  per_macon: { role: 'physique', nom: 'Le maçon', ico: '🪣', rarete: 'peu', si: 'dosADos', effet: { defense: 0.92, volume: 0.9 },
    texte: 'Le deuxième soir, il monte le mur une brique à la fois. On ne sort plus de la zone.' },
  // reprend le casque grillagé et la réunion des défenseurs
  per_professeurBlocage: { role: 'chef', nom: 'Le professeur de blocage', ico: '🤲', rarete: 'commune', si: 'rival', effet: { volume: 0.97 }, vise: 'mou',
    protege: { defense: 0.8 }, texte: 'Contre un rival, il prend son défenseur le plus mou et lui apprend à se coucher devant les tirs.' },
  // reprend le masque peint et les jambières du chalet
  per_artisteMasque: { role: 'gardiens', nom: 'L\'artiste du masque', ico: '🫥', rarete: 'rare', si: 'series', effet: { volume: 0.96 }, gardien: true,
    protege: { arrets: 0.88 }, texte: 'Un masque neuf pour le printemps, peint à la main. Le partant ne voit plus que la rondelle.' },

  // ---- 🦏 le Rhino ----
  // reprend la soupe aux pois
  per_cuisinier: { role: 'soins', nom: 'Le cuisinier du rival', ico: '🥘', rarete: 'peu', si: 'rival', effet: { robustesse: 1.2, discipline: 1.1 },
    texte: 'La soupe aux pois de sa mère, le midi d\'un match contre le rival. Ça frappe fort, le soir.' },
  // reprend le mur de chair
  per_sergentTranchees: { role: 'defense', nom: 'Le sergent des tranchées', ico: '⛏', rarete: 'rare', si: 'series', effet: { robustesse: 1.6, discipline: 1.18 },
    texte: 'En séries, chaque centimètre de glace se gagne à l\'épaule.' },
  // reprend on rentre dans le tas
  per_videur: { role: 'attaque', nom: 'Le videur', ico: '🫸', rarete: 'commune', si: 'visiteur', effet: { robustesse: 0.8, discipline: 1.2 },
    texte: 'Chez les autres, il veut voir le gardien sur le dos au moins une fois.' },

  // ---- 🫁 le Doc ----
  // reprend la table de massage
  per_masseur: { role: 'soins', nom: 'Le masseur', ico: '🧖', rarete: 'commune', si: 'dosADos', effet: { energie: 0.85, robustesse: -0.3 },
    texte: 'Entre les deux soirs, une heure sur la table pour chacun. Les gars repartent mous, et frais.' },
  // reprend l'infirmière de garde
  per_infirmiere: { role: 'physique', nom: 'L\'infirmière de garde', ico: '💊', rarete: 'peu', si: 'infirmerie', effet: { blessure: 0.6, energie: 0.92, robustesse: -0.3 },
    texte: 'Quand l\'infirmerie déborde, elle dort à l\'aréna. Personne ne se blesse bêtement.' },
  // reprend les rideaux opaques
  per_hotelier: { role: 'direction', nom: 'Le réservateur d\'hôtels', ico: '🏨', rarete: 'rare', si: 'jambesLourdes', effet: { energie: 0.65, volume: 1.12, finition: 0.95 },
    texte: 'Les rideaux opaques, le dernier étage, pas de réveil. Les jambes lourdes repartent.' },

  // ---- 😇 l'Abbé ----
  // reprend le vœu de silence
  per_moine: { role: 'soins', nom: 'Le moine du vestiaire', ico: '🙏', rarete: 'peu', si: 'visiteur', effet: { discipline: 0.8, robustesse: -0.5 },
    texte: 'Sur la route, il impose le silence dans l\'autobus. Sur la glace, personne ne répond aux provocations.' },
  // reprend tendre l'autre joue
  per_pacifiste: { role: 'defense', nom: 'Le pacifiste', ico: '☮', rarete: 'commune', si: 'domicile', effet: { discipline: 0.85, finition: 0.98, robustesse: -0.45 },
    texte: 'Chez nous, devant les enfants, on ne se bat pas. On recule, et on joue.' },
  // reprend la messe de minuit
  per_organiste: { role: 'chef', nom: 'L\'organiste de minuit', ico: '🎹', rarete: 'rare', si: 'series', effet: { discipline: 0.65, volume: 0.96, robustesse: -0.45 },
    texte: 'En séries, il joue de l\'orgue au vestiaire avant le match. Les têtes chaudes refroidissent.' },

  // ---- 🪜 le Contremaître ----
  // reprend la pratique du bas
  per_entraineurDuBas: { role: 'attaque', nom: 'L\'entraîneur du bas', ico: '🔩', rarete: 'commune', si: 'jambesLourdes', effet: { F: [0.88, 0.95, 1.08, 1.25] },
    texte: 'Les jambes lourdes ? Il a fait patiner le quatrième trio toute la semaine.' },
  // reprend le chantier
  per_chefDeChantier: { role: 'soins', nom: 'Le chef de chantier', ico: '🦺', rarete: 'peu', si: 'infirmerie', effet: { F: [0.85, 0.95, 1.1, 1.35], blessure: 0.88 },
    texte: 'Quand l\'infirmerie déborde, il bâtit avec ce qui reste. Et ceux qui restent jouent.' },
  // reprend l'usine
  per_directeurUsine: { role: 'direction', nom: 'Le directeur de l\'usine', ico: '⚙', rarete: 'rare', si: 'series', effet: { F: [0.75, 0.88, 1.12, 1.55], energie: 0.88, volume: 1.16 },
    texte: 'En séries, quatre trios, quatre quarts de travail. L\'usine ne s\'arrête jamais.' },

  // ---- 🌠 le Showman ----
  // reprend la couverture du magazine
  per_photographe: { role: 'attaque', nom: 'Le photographe des magazines', ico: '🎦', rarete: 'commune', si: 'enFeu', effet: { F: [1.1, 1.02, 0.96, 0.9], defense: 1.04 },
    protege: { creation: 1.25, lancers: 1.1 }, texte: 'Trois victoires de suite, et son centre fait la couverture. Il passe, il tire, il pose.' },
  // reprend le micro du banc
  per_animateurMicro: { role: 'chef', nom: 'L\'animateur du micro', ico: '📯', rarete: 'peu', si: 'rival', effet: { F: [1.2, 1.04, 0.92, 0.82], finition: 1.02, energie: 1.04 },
    texte: 'Contre le rival, il branche un micro sur le banc. Les vedettes jouent pour la télé.' },
  // reprend les plumes du paon et les gants lumineux
  per_costumier: { role: 'soins', nom: 'Le costumier', ico: '👘', rarete: 'rare', si: 'series', effet: { F: [1.1, 1.02, 0.96, 0.9] },
    protege: { creation: 1.8, finition: 1.2, lancers: 1.1 }, texte: 'En séries, il habille son centre en paon. Et ça marche.' },

  // ---- 🏦 le Comptable ----
  // reprend les clauses de contrat
  per_fiscaliste: { role: 'direction', nom: 'Le fiscaliste', ico: '📑', rarete: 'peu', econ: { plafond: 0.03 },
    texte: 'Il relit chaque contrat à la loupe, et il trouve toujours un peu d\'espace.' },
  // reprend les billets de saison
  per_boutiqueSouvenirs: { role: 'soins', nom: 'Le gérant de la boutique', ico: '🧸', rarete: 'commune', econ: { jetonsVictoire: 1 },
    texte: 'Une victoire, et les tuques partent. Il tient la caisse de la boutique.' },
  // reprend la ristourne
  per_chasseurAubaines: { role: 'depistage', nom: 'Le chasseur d\'aubaines', ico: '💳', rarete: 'commune', econ: { rabais: 0.95 },
    texte: 'Il connaît le fournisseur de bâtons, et le cousin du fournisseur.' },
};

/*
 * LES PROTÉGÉS (V16) : la mutation qu'un adjoint à `protege` pose sur un joueur, pour la saison (`saison`, jamais sur sa
 * carte), et seulement ses soirs. Le moteur les range avec les autres (`MUTATIONS`, js/sim.js) ; un adjoint remplacé
 * à son poste emporte la sienne (`retirerProtege`).
 */
export const PROTEGES = Object.fromEntries(Object.entries(PERSONNEL).filter(([, P]) => P.protege).map(([cle, P]) => [cle, {
  nom: P.nom, ico: P.ico, cible: P.vise || 'libre', source: 'personnel', si: P.si, quoi: P.texte, ...(P.gardien ? { gardien: true } : {}), ...P.protege,
}]));

