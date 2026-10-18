/*
 * LES PLACES NEUVES (V10, tranche 3 — docs/refonte-v10.md § 4). Les cartes qui se jouent hors du combat, quand tu
 * veux, trois au plus (`PLACES`, js/inventaire.js). Chacune répond à un MOMENT de la semaine (`si`, `MOMENTS_SI`,
 * js/sim.js) : jouée, elle tient ses `duree` prochains matchs, mais ne joue que ceux de son moment — un soir de
 * dos-à-dos, après une défaite, contre un rival. On la joue donc en lisant la route de la semaine. Le Comptable,
 * lui, paie tout de suite : ses places sont de l'argent, et l'argent n'attend pas de moment.
 *
 * Chaque place joue sur le canal de son coach, qui lui donne sa couleur (`coachDesCanaux`, js/coachs.js) : le Frelon
 * les tirs, l'Aigle la précision, la Tortue la défense, le Rhino la robustesse, le Doc les jambes et les blessures,
 * l'Abbé les punitions, le Contremaître et le Showman les minutes des trios, le Comptable les jetons. Trois sont
 * neutres, partagées entre deux canaux. Les soins d'un blessé, le congédiement, les rappels du cartable,
 * l'exorciste et le camp express restent ceux d'avant (js/banque.js `CONSOMMABLES`).
 */
const usage = { vie: 'usage', cible: 'aucune' };
export const PLACES_NEUVES = {
  // ---- neutres ----
  semaineChargee: { nom: 'La semaine chargée', ico: '🗓', rarete: 'commune', ...usage, si: 'dosADos', duree: 8, effet: { energie: 0.85, finition: 1.05 },
    texte: 'Le calendrier sur le babillard, surligné en jaune.' },
  vestiaireUni: { nom: 'Le vestiaire uni', ico: '🫂', rarete: 'commune', ...usage, si: 'apresDefaite', duree: 6, effet: { finition: 1.06, defense: 0.94 },
    texte: 'Personne ne sort avant que tout le monde ait parlé.' },
  soireeDesAnciens: { nom: 'La soirée des anciens', ico: '🎩', rarete: 'peu', ...usage, si: 'domicile', duree: 6, effet: { volume: 1.08, defense: 0.94 },
    texte: 'Les anciens au premier rang. Personne ne veut avoir l\'air fou devant eux.' },

  // ---- 🐝 le Frelon : les tirs ----
  centTirs: { nom: 'Cent tirs après la pratique', ico: '🏹', rarete: 'commune', ...usage, si: 'jambesFraiches', duree: 8, effet: { volume: 1.12 },
    texte: 'Les jambes sont là : on en profite pour vider le seau.' },
  retourFoule: { nom: 'Le retour devant la foule', ico: '🎺', rarete: 'peu', ...usage, si: 'domicile', duree: 4, effet: { volume: 1.15 },
    texte: 'La fanfare joue à chaque tir au but. Alors on tire.' },
  sprintDeMars: { nom: 'Le sprint de mars', ico: '🏃', rarete: 'rare', ...usage, si: 'enFeu', duree: 8, effet: { volume: 1.22, energie: 1.06 },
    texte: 'Trois de suite : personne ne veut lever le pied.' },

  // ---- 🦅 l'Aigle : la précision ----
  videoGardien: { nom: 'La vidéo de leur gardien', ico: '📽', rarete: 'rare', ...usage, si: 'rival', duree: 10, effet: { finition: 1.45 },
    texte: 'Il laisse toujours le haut du côté de la mitaine. Toujours.' },
  coinPeint: { nom: 'Le coin du haut, peint', ico: '🪧', rarete: 'commune', ...usage, si: 'visiteur', duree: 6, effet: { finition: 1.12 },
    texte: 'Un carré orange dans le coin du filet de pratique, à chaque arrêt du voyage.' },
  batonsNeufs: { nom: 'Les bâtons neufs', ico: '🪵', rarete: 'peu', ...usage, si: 'apresDefaite', duree: 6, effet: { finition: 1.18, volume: 0.95 },
    texte: 'Une boîte de bâtons frais, et un nouveau départ.' },

  // ---- 🐢 la Tortue : la défense ----
  systemeDeRoute: { nom: 'Le système de route', ico: '🗺', rarete: 'commune', ...usage, si: 'visiteur', duree: 6, effet: { defense: 0.88 },
    texte: 'Loin de chez soi, on joue simple : la bande, le centre, la bande.' },
  reunionDefenseurs: { nom: 'La réunion des défenseurs', ico: '🧷', rarete: 'peu', ...usage, si: 'apresDefaite', duree: 6, effet: { defense: 0.9, volume: 0.97 },
    texte: 'Six défenseurs, un tableau, et la porte fermée.' },
  murDuDimanche: { nom: 'Le mur du dimanche', ico: '⛓', rarete: 'peu', ...usage, si: 'dosADos', duree: 8, effet: { defense: 0.88 },
    texte: 'Le deuxième soir, les jambes partent ; la structure, elle, reste.' },

  // ---- 🦏 le Rhino : la robustesse ----
  gymSousSol: { nom: 'Le gym du sous-sol', ico: '🏋', rarete: 'commune', ...usage, si: 'jambesFraiches', duree: 8, effet: { robustesse: 1 },
    texte: 'Des poids rouillés et une radio qui ne capte qu\'une station.' },
  soupeAuxPois: { nom: 'La soupe aux pois', ico: '🍲', rarete: 'peu', ...usage, si: 'rival', duree: 10, effet: { robustesse: 1.2 },
    texte: 'La recette de la mère du capitaine. Ça colle aux côtes.' },
  pacteVestiaire: { nom: 'Le pacte du vestiaire', ico: '🦴', rarete: 'rare', ...usage, si: 'beteNoire', duree: 20, effet: { robustesse: 1.6, discipline: 1.25 },
    texte: 'Ils nous ont battus deux fois. Chacun a signé la feuille sur le mur, et personne ne recule.' },

  // ---- 🫁 le Doc : les jambes et les blessures ----
  tableMassage: { nom: 'La table de massage', ico: '🛏', rarete: 'commune', ...usage, si: 'dosADos', duree: 8, effet: { energie: 0.8 },
    texte: 'Vingt minutes chacun, entre les deux matchs.' },
  infirmiereDeGarde: { nom: 'L\'infirmière de garde', ico: '💉', rarete: 'peu', ...usage, si: 'infirmerie', duree: 8, effet: { blessure: 0.5, energie: 0.9 },
    texte: 'Elle dort à l\'aréna tant que l\'infirmerie déborde.' },
  rideauxOpaques: { nom: 'Les rideaux opaques', ico: '😴', rarete: 'rare', ...usage, si: 'jambesLourdes', duree: 8, effet: { energie: 0.65, volume: 1.12 },
    texte: 'Douze heures de sommeil à l\'hôtel, et le téléphone dans le corridor.' },

  // ---- 😇 l'Abbé : les punitions ----
  retraiteFermee: { nom: 'La retraite fermée', ico: '⛪', rarete: 'commune', ...usage, si: 'apresDefaite', duree: 6, effet: { discipline: 0.75 },
    texte: 'Une fin de semaine au monastère. On revient les mains calmes.' },
  voeuSilence: { nom: 'Le vœu de silence', ico: '🤐', rarete: 'peu', ...usage, si: 'visiteur', duree: 6, effet: { discipline: 0.75, finition: 1.02 },
    texte: 'Pas un mot à leur banc, pas un mot à l\'arbitre.' },
  arbitreASouper: { nom: 'L\'arbitre invité à souper', ico: '🍽', rarete: 'rare', ...usage, si: 'rival', duree: 10, effet: { discipline: 0.65 },
    texte: 'Rien d\'illégal : un souper, des souvenirs, et un rival qui se fait siffler.' },

  // ---- 🪜 le Contremaître : les minutes vers le bas ----
  boucheTrousDuMardi: { nom: 'Les bouche-trous du mardi', ico: '🔧', rarete: 'peu', ...usage, si: 'dosADos', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.3], energie: 0.9 },
    texte: 'Le deuxième soir, le quatrième trio a les clés du camion.' },
  pratiqueDuBas: { nom: 'La pratique du bas', ico: '🪚', rarete: 'commune', ...usage, si: 'jambesLourdes', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.3] },
    texte: 'Les vedettes s\'assoient. Les autres apprennent à porter le match.' },
  chantier: { nom: 'Le chantier', ico: '🏗', rarete: 'peu', ...usage, si: 'infirmerie', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.35], blessure: 0.85 },
    texte: 'Des blessés partout : on rebâtit avec ce qui reste.' },

  // ---- 🌠 le Showman : les minutes vers le haut ----
  microDuBanc: { nom: 'Le micro du banc', ico: '🎙', rarete: 'peu', ...usage, si: 'domicile', duree: 4, effet: { F: [1.25, 1.05, 0.9, 0.8], finition: 1.03 },
    texte: 'La télé a branché le premier trio. Il joue pour la caméra.' },
  couvertureMagazine: { nom: 'La couverture du magazine', ico: '📸', rarete: 'commune', ...usage, si: 'enFeu', duree: 6, effet: { F: [1.3, 1.05, 0.9, 0.75] },
    texte: 'Trois de suite, et ta vedette fait la une. Elle veut rester là.' },
  grandeScene: { nom: 'La grande scène', ico: '🎭', rarete: 'rare', ...usage, si: 'rival', duree: 10, effet: { F: [1.45, 1.05, 0.8, 0.6], finition: 1.06 },
    texte: 'Contre un rival, les vedettes jouent la moitié du match.' },

  // ---- 🏦 le Comptable : les jetons, tout de suite ----
  ristourne: { nom: 'La ristourne', ico: '🧾', rarete: 'commune', ...usage, gain: 12, texte: 'Le fournisseur de bâtons s\'est trompé dans la facture. En ta faveur.' },
  billetsSaison: { nom: 'Les billets de saison', ico: '🎫', rarete: 'peu', ...usage, gain: 18, texte: 'Les abonnés renouvellent. La caisse respire.' },
  paris: { nom: 'Le pool du bureau', ico: '🎰', rarete: 'rare', ...usage, pari: { chance: 0.4, gain: 45 }, texte: 'Deux chances sur cinq de rafler la cagnotte.' },
};
