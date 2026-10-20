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
 * neutres, partagées entre deux canaux. Le Rhino, l'Abbé et le Contremaître n'ont pas de canal de joueur, donc pas
 * d'équipement (js/equipement.js) : ils ont six places au lieu de trois (V13-2, docs/refonte-v13.md), faites des
 * cartes de duel qu'ils avaient avant que la main parte. Les soins d'un blessé, le congédiement et les rappels du
 * cartable restent ceux d'avant (js/banque.js `CONSOMMABLES`).
 */
const usage = { vie: 'usage', cible: 'aucune' };
/*
 * LE GROS SUR UN JOUEUR (V11, tranche 3b — docs/refonte-v11.md). JP : *c'est vraiment plus facile de balancer le jeu
 * et créer des histoires, si les bonus et malus plus importants touchent des joueurs et non l'équipe*. Une place
 * `surUn` se joue sur un de tes joueurs, que tu nommes : `joueur` porte ses canaux à lui (`CANAUX_MUT`, js/sim.js —
 * ses tirs, sa précision, ses passes, sa défense, ses blessures), le temps de ses matchs et ses soirs seulement. Ce
 * qui reste à l'équipe (`effet`) est petit, ou rien.
 */
const surUn = { vie: 'usage', cible: 'joueur' };
export const PLACES_NEUVES = {
  // ---- neutres ----
  semaineChargee: { nom: 'La semaine chargée', ico: '🗓', rarete: 'commune', ...usage, si: 'dosADos', duree: 8, effet: { energie: 0.85, finition: 1.05, volume: 0.96 },
    texte: 'Le calendrier sur le babillard, surligné en jaune.' },
  vestiaireUni: { nom: 'Le vestiaire uni', ico: '🫂', rarete: 'commune', ...usage, si: 'apresDefaite', duree: 6, effet: { finition: 1.06, defense: 0.94, volume: 0.95 },
    texte: 'Personne ne sort avant que tout le monde ait parlé.' },
  soireeDesAnciens: { nom: 'La soirée des anciens', ico: '🎩', rarete: 'peu', ...usage, si: 'domicile', duree: 6, effet: { volume: 1.08, defense: 0.94, finition: 0.97 },
    texte: 'Les anciens au premier rang. Personne ne veut avoir l\'air fou devant eux.' },

  // ---- 🐝 le Frelon : les tirs ----
  centTirs: { nom: 'Cent tirs après la pratique', ico: '🏹', rarete: 'commune', ...surUn, si: 'jambesFraiches', duree: 8, joueur: { lancers: 1.6, finition: 0.95 },
    texte: 'Il reste sur la glace quand les autres sont partis, et il vide le seau.' },
  retourFoule: { nom: 'Le retour devant la foule', ico: '🎺', rarete: 'peu', ...usage, si: 'domicile', duree: 4, effet: { volume: 1.15, discipline: 1.06 },
    texte: 'La fanfare joue à chaque tir au but. Alors on tire.' },
  sprintDeMars: { nom: 'Le sprint de mars', ico: '🏃', rarete: 'rare', ...usage, si: 'enFeu', duree: 8, effet: { volume: 1.22, energie: 1.06 },
    texte: 'Trois de suite : personne ne veut lever le pied.' },

  // ---- 🦅 l'Aigle : la précision ----
  videoGardien: { nom: 'La vidéo de leur gardien', ico: '📽', rarete: 'rare', ...surUn, si: 'rival', duree: 10, effet: { volume: 0.95 }, joueur: { finition: 2.1, lancers: 1.4 },
    texte: 'Il laisse toujours le haut du côté de la mitaine. Ton tireur a regardé la cassette dix fois.' },
  coinPeint: { nom: 'Le coin du haut, peint', ico: '🪧', rarete: 'commune', ...usage, si: 'visiteur', duree: 6, effet: { finition: 1.12, volume: 0.94 },
    texte: 'Un carré orange dans le coin du filet de pratique, à chaque arrêt du voyage.' },
  batonsNeufs: { nom: 'Les bâtons neufs', ico: '🪵', rarete: 'peu', ...surUn, si: 'apresDefaite', duree: 6, joueur: { finition: 1.6, lancers: 0.92 },
    texte: 'Une boîte de bâtons frais pour celui qui ne marque plus. Il choisit ses tirs.' },

  // ---- 🐢 la Tortue : la défense ----
  systemeDeRoute: { nom: 'Le système de route', ico: '🗺', rarete: 'commune', ...usage, si: 'visiteur', duree: 6, effet: { defense: 0.88, volume: 0.93 },
    texte: 'Loin de chez soi, on joue simple : la bande, le centre, la bande.' },
  reunionDefenseurs: { nom: 'La réunion des défenseurs', ico: '🧷', rarete: 'peu', ...surUn, si: 'apresDefaite', duree: 6, joueur: { defense: 0.7, lancers: 0.9 },
    texte: 'Lui, un tableau, et l\'entraîneur des défenseurs. Il ne monte plus : il ferme.' },
  murDuDimanche: { nom: 'Le mur du dimanche', ico: '⛓', rarete: 'peu', ...usage, si: 'dosADos', duree: 8, effet: { defense: 0.88, volume: 0.93 },
    texte: 'Le deuxième soir, les jambes partent ; la structure, elle, reste.' },

  // ---- 🦏 le Rhino : la robustesse ----
  gymSousSol: { nom: 'Le gym du sous-sol', ico: '🏋', rarete: 'commune', ...usage, si: 'jambesFraiches', duree: 8, effet: { robustesse: 1, energie: 1.05 },
    texte: 'Des poids rouillés et une radio qui ne capte qu\'une station.' },
  soupeAuxPois: { nom: 'La soupe aux pois', ico: '🍲', rarete: 'peu', ...usage, si: 'rival', duree: 10, effet: { robustesse: 1.2, discipline: 1.1 },
    texte: 'La recette de la mère du capitaine. Ça colle aux côtes.' },
  pacteVestiaire: { nom: 'Le pacte du vestiaire', ico: '🦴', rarete: 'rare', ...usage, si: 'beteNoire', duree: 20, effet: { robustesse: 1.6, discipline: 1.25 },
    texte: 'Ils nous ont battus deux fois. Chacun a signé la feuille sur le mur, et personne ne recule.' },
  doubleEchec: { nom: 'Le double échec', ico: '👁', rarete: 'commune', ...usage, si: 'apresDefaite', duree: 6, effet: { robustesse: 0.9, discipline: 1.08 },
    texte: 'Ils nous ont battus ? Deux de tes gars vont chercher le premier qui bouge.' },
  dansLeTas: { nom: 'On rentre dans le tas', ico: '🪖', rarete: 'peu', ...usage, si: 'visiteur', duree: 6, effet: { robustesse: 1.1, discipline: 1.1 },
    texte: 'Dans leur aréna, le centre est fermé. On l\'ouvre à l\'épaule.' },
  murDeChair: { nom: 'Le mur de chair', ico: '🏛', rarete: 'rare', ...usage, si: 'series', duree: 10, effet: { robustesse: 1.4, discipline: 1.12 },
    texte: 'Au printemps, plus personne ne passe devant le filet sans payer.' },

  // ---- 🫁 le Doc : les jambes et les blessures ----
  tableMassage: { nom: 'La table de massage', ico: '🛏', rarete: 'commune', ...usage, si: 'dosADos', duree: 8, effet: { energie: 0.8, robustesse: -0.3 },
    texte: 'Vingt minutes chacun, entre les deux matchs.' },
  infirmiereDeGarde: { nom: 'L\'infirmière de garde', ico: '💉', rarete: 'peu', ...usage, si: 'infirmerie', duree: 8, effet: { blessure: 0.5, energie: 0.9, robustesse: -0.3 },
    texte: 'Elle dort à l\'aréna tant que l\'infirmerie déborde.' },
  rideauxOpaques: { nom: 'Les rideaux opaques', ico: '😴', rarete: 'rare', ...usage, si: 'jambesLourdes', duree: 8, effet: { energie: 0.65, volume: 1.12, finition: 0.97 },
    texte: 'Douze heures de sommeil à l\'hôtel, et le téléphone dans le corridor.' },

  // ---- 😇 l'Abbé : les punitions ----
  retraiteFermee: { nom: 'La retraite fermée', ico: '⛪', rarete: 'commune', ...usage, si: 'apresDefaite', duree: 6, effet: { discipline: 0.75, robustesse: -0.4 },
    texte: 'Une fin de semaine au monastère. On revient les mains calmes.' },
  voeuSilence: { nom: 'Le vœu de silence', ico: '🤐', rarete: 'peu', ...usage, si: 'visiteur', duree: 6, effet: { discipline: 0.75, finition: 1.02, robustesse: -0.4 },
    texte: 'Pas un mot à leur banc, pas un mot à l\'arbitre.' },
  arbitreASouper: { nom: 'L\'arbitre invité à souper', ico: '🍽', rarete: 'rare', ...usage, si: 'rival', duree: 10, effet: { discipline: 0.65, robustesse: -0.5 },
    texte: 'Rien d\'illégal : un souper, des souvenirs, et un rival qui se fait siffler.' },
  autreJoue: { nom: 'Tendre l\'autre joue', ico: '🌷', rarete: 'commune', ...usage, si: 'domicile', duree: 6, effet: { discipline: 0.78, robustesse: -0.35 },
    texte: 'Devant les familles, le coup de bâton arrive ; tu souris à l\'arbitre.' },
  chapelet: { nom: 'Le chapelet', ico: '📿', rarete: 'peu', ...usage, si: 'jambesLourdes', duree: 8, effet: { discipline: 0.75, finition: 1.02, robustesse: -0.4 },
    texte: 'Les jambes lourdes, les bâtons partent tout seuls. Un grain à chaque présence.' },
  messeDeMinuit: { nom: 'La messe de minuit', ico: '🪽', rarete: 'rare', ...usage, si: 'series', duree: 10, effet: { discipline: 0.65, volume: 0.96, robustesse: -0.45 },
    texte: 'En séries, on ne répond pas : on attend qu\'ils craquent.' },

  // ---- 🪜 le Contremaître : les minutes vers le bas ----
  boucheTrousDuMardi: { nom: 'Les bouche-trous du mardi', ico: '🔧', rarete: 'peu', ...usage, si: 'dosADos', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.3], energie: 0.9 },
    texte: 'Le deuxième soir, le quatrième trio a les clés du camion.' },
  pratiqueDuBas: { nom: 'La pratique du bas', ico: '🪚', rarete: 'commune', ...usage, si: 'jambesLourdes', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.3] },
    texte: 'Les vedettes s\'assoient. Les autres apprennent à porter le match.' },
  chantier: { nom: 'Le chantier', ico: '🏗', rarete: 'peu', ...usage, si: 'infirmerie', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.35], blessure: 0.85 },
    texte: 'Des blessés partout : on rebâtit avec ce qui reste.' },
  quatriemeTrio: { nom: 'Le quatrième trio', ico: '🔀', rarete: 'commune', ...usage, si: 'domicile', duree: 6, effet: { F: [0.88, 0.95, 1.08, 1.25] },
    texte: 'Chez toi, tu as le dernier changement : ton quatrième trio, personne ne le suit.' },
  toutLeMonde: { nom: 'Tout le monde joue', ico: '👷', rarete: 'peu', ...usage, si: 'apresDefaite', duree: 6, effet: { F: [0.88, 0.96, 1.06, 1.22], energie: 0.93 },
    texte: 'Après une défaite, quatre trios, et personne ne regarde le tableau des minutes.' },
  usine: { nom: 'L\'usine', ico: '🏭', rarete: 'rare', ...usage, si: 'series', duree: 10, effet: { F: [0.75, 0.88, 1.12, 1.55], energie: 0.88, volume: 1.15 },
    texte: 'Au printemps, les vedettes sont brûlées ; la profondeur, elle, a dormi.' },

  // ---- 🌠 le Showman : les minutes vers le haut ----
  microDuBanc: { nom: 'Le micro du banc', ico: '🎙', rarete: 'peu', ...usage, si: 'domicile', duree: 4, effet: { F: [1.25, 1.05, 0.9, 0.8], finition: 1.03, energie: 1.03 },
    texte: 'La télé a branché le premier trio. Il joue pour la caméra.' },
  couvertureMagazine: { nom: 'La couverture du magazine', ico: '📸', rarete: 'commune', ...surUn, si: 'enFeu', duree: 6, effet: { F: [1.15, 1.02, 0.95, 0.88] }, joueur: { creation: 1.35, lancers: 1.15 },
    texte: 'Trois de suite, et il fait la une. Il veut rester là.' },
  grandeScene: { nom: 'La grande scène', ico: '🎭', rarete: 'rare', ...usage, si: 'rival', duree: 10, effet: { F: [1.45, 1.05, 0.8, 0.6], finition: 1.06, energie: 1.05 },
    texte: 'Contre un rival, les vedettes jouent la moitié du match.' },

  // ---- 🏦 le Comptable : les jetons, tout de suite ----
  ristourne: { nom: 'La ristourne', ico: '🧾', rarete: 'commune', ...usage, gain: 12, texte: 'Le fournisseur de bâtons s\'est trompé dans la facture. En ta faveur.' },
  billetsSaison: { nom: 'Les billets de saison', ico: '🎫', rarete: 'peu', ...usage, gain: 18, texte: 'Les abonnés renouvellent. La caisse respire.' },
  paris: { nom: 'Le pool du bureau', ico: '🎰', rarete: 'rare', ...usage, pari: { chance: 0.4, gain: 45 }, texte: 'Deux chances sur cinq de rafler la cagnotte.' },
};
