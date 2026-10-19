/*
 * LE PERSONNEL NEUF (V10, tranche 4 — docs/refonte-v10.md § 4). Des patrons, un poste par rôle (`ROLES`, js/banque.js),
 * engagés pour la saison et les séries. Chacun travaille un MOMENT de la saison (`si`, `MOMENTS_SI`, js/sim.js) : les
 * soirs à l'étranger, les dos-à-dos, après une défaite, contre un rival ou ta bête noire, en séries. Les cartes de
 * saison d'avant (`CARTES`, un bonus payé par un malus) s'y fondent : un poste dit son prix par son moment, plutôt
 * que par un malus.
 *
 * Deux postes par coach, sur son canal (`coachDesCanaux`, js/coachs.js) ; le Comptable, lui, travaille l'argent toute
 * l'année. Trois postes neutres, des communes de trois rôles différents : ce sont eux que le départ d'une run impose
 * (`patronsDeDepart`).
 *
 * `CONTRATS_MAUDITS` : des contrats lourds, qu'on prend pour leur argent — de l'espace sous le plafond tout de suite,
 * et un prix qui tombe certains soirs.
 */
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
  per_coachDeSprint: { role: 'physique', nom: 'Le coach de sprint', ico: '🏁', rarete: 'peu', si: 'jambesFraiches', effet: { volume: 1.14, energie: 1.06 },
    texte: 'Des départs arrêtés, encore et encore. Les jambes fraîches, ça fonce au filet.' },

  // ---- 🦅 l'Aigle ----
  per_tirsDeRoute: { role: 'attaque', nom: 'Le maître des tirs de route', ico: '🧳', rarete: 'commune', si: 'visiteur', effet: { finition: 1.06, volume: 0.95 },
    texte: 'Il emporte son filet de pratique dans l\'autobus.' },
  per_depisteurGardiens: { role: 'depistage', nom: 'Le dépisteur des gardiens', ico: '🔎', rarete: 'rare', si: 'rival', effet: { finition: 1.6, volume: 0.88 },
    texte: 'Il a vu chaque match de leur gardien depuis le junior.' },

  // ---- 🐢 la Tortue ----
  per_gardienDuFort: { role: 'defense', nom: 'Le gardien du fort', ico: '🏯', rarete: 'peu', si: 'apresDefaite', effet: { defense: 0.9, volume: 0.93 },
    texte: 'Après une défaite, il reprend le système depuis le début.' },
  per_gardiensDeRoute: { role: 'gardiens', nom: 'L\'entraîneur des gardiens de route', ico: '🧭', rarete: 'commune', si: 'visiteur', effet: { defense: 0.96, volume: 0.97 },
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
  per_aumonier: { role: 'chef', nom: 'L\'aumônier', ico: '🕍', rarete: 'peu', si: 'apresDefaite', effet: { discipline: 0.75, robustesse: -0.4 },
    texte: 'Après une défaite, il parle de patience. Les bâtons restent en bas.' },
  per_ancienArbitre: { role: 'direction', nom: 'L\'ancien arbitre', ico: '🦓', rarete: 'rare', si: 'rival', effet: { discipline: 0.65, robustesse: -0.5 },
    texte: 'Il connaît chaque arbitre de la ligue, et ce qui les fait siffler.' },

  // ---- 🪜 le Contremaître ----
  per_chefDAtelier: { role: 'chef', nom: 'Le chef d\'atelier', ico: '🛠', rarete: 'commune', si: 'jambesLourdes', effet: { F: [0.85, 0.95, 1.1, 1.3], energie: 0.95 },
    texte: 'Les jambes sont lourdes ? Le quatrième trio a toujours des jambes.' },
  per_contremaitreDosADos: { role: 'physique', nom: 'Le répartiteur', ico: '🗂', rarete: 'peu', si: 'dosADos', effet: { F: [0.85, 0.95, 1.1, 1.3], energie: 0.9 },
    texte: 'Il découpe le deuxième soir en quatre parts égales.' },

  // ---- 🌠 le Showman ----
  per_agentDesVedettes: { role: 'direction', nom: 'L\'agent des vedettes', ico: '💼', rarete: 'peu', si: 'domicile', effet: { F: [1.12, 1.04, 0.96, 0.88], finition: 1.01, energie: 1.04 },
    texte: 'Chez nous, ses clients jouent. Les caméras sont là.' },
  per_metteurEnScene: { role: 'chef', nom: 'Le metteur en scène', ico: '🎬', rarete: 'rare', si: 'series', effet: { F: [1.45, 1.05, 0.8, 0.6], finition: 1.12, energie: 1.08 },
    texte: 'En séries, il écrit le match pour ses vedettes.' },

  // ---- 🏦 le Comptable : l'argent, toute l'année ----
  per_caissier: { role: 'direction', nom: 'Le gestionnaire de la caisse', ico: '🗄', rarete: 'commune', econ: { jetonsVictoire: 2 },
    texte: 'Chaque victoire remplit l\'aréna. Il compte les billets.' },
  per_negociateur: { role: 'depistage', nom: 'Le négociateur', ico: '🤝', rarete: 'peu', econ: { rabais: 0.9 },
    texte: 'Il obtient un prix de groupe sur tout ce qui se vend.' },
};

/* Les contrats lourds : l'argent tout de suite, un prix certains soirs, toute la saison. */
const lourd = { rarete: 'maudite', vie: 'saison', cible: 'aucune' };
export const CONTRATS_MAUDITS = {
  clauseDuVieux: { nom: 'La clause du vieux', ico: '👴', ...lourd, espace: 3_000_000, si: 'jambesLourdes', effet: { energie: 1.15, defense: 1.05 },
    texte: 'Trois millions d\'espace, en échange d\'un vétéran qui joue sur une jambe les soirs lourds.' },
  contratTele: { nom: 'Le contrat de télé', ico: '📡', ...lourd, espace: 2_500_000, si: 'dosADos', effet: { energie: 1.12, finition: 0.96 },
    texte: 'La télé paie bien, et elle choisit les heures : les dos-à-dos tombent mal.' },
  commanditeCasino: { nom: 'La commandite du casino', ico: '♠', ...lourd, espace: 3_000_000, si: 'rival', effet: { discipline: 1.4, finition: 0.96 },
    texte: 'Le logo sur l\'épaule, et les rivaux qui en rient. Les têtes chaudes répondent.' },
  bailArena: { nom: 'Le bail de l\'aréna', ico: '🏚', ...lourd, espace: 2_000_000, si: 'domicile', effet: { defense: 1.05 },
    texte: 'Le loyer baisse, la glace aussi : chez nous, les rondelles sautent.' },
};
