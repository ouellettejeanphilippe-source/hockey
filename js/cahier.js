/*
 * LE CAHIER NEUF (V10, tranche 2 — docs/refonte-v10.md). JP, 17 oct. : *jeter toutes les cartes et créer de zéro avec
 * la nouvelle philosophie en tête* ; *variées, impactantes et liées aux coachs*. Les cartes de match se jouent au
 * duel, deux élans par période, une main pour les trois périodes. Chacune attend son MOMENT (`si`, `MOMENTS_SI`,
 * js/sim.js) et le dit en premier :
 *
 *   une RÉPONSE   attend une intention annoncée (l'ombre, la chasse, fermer le centre, l'assaut, les punitions) :
 *                 jouée la période où elle est annoncée, elle la contre — l'intention se retourne contre eux — et son
 *                 effet joue le temps de cette période ;
 *   un COUP       attend la 3e période d'un duel, selon le pointage après deux (en avance, à égalité, en retard) ;
 *   une SOIRÉE    attend un moment du match entier (à domicile, à l'étranger, un dos-à-dos, les jambes lourdes, un
 *                 rival, ta bête noire, les séries).
 *
 * Hors de son moment, une carte ne fait rien : on la garde pour plus tard (la main dure les trois périodes). Chaque
 * carte joue sur le canal de son coach, et c'est ce canal qui lui donne sa couleur (`coachDesCanaux`, js/coachs.js) :
 * le Frelon les tirs, l'Aigle la précision, la Tortue la précision adverse, le Rhino la robustesse, le Doc les jambes
 * et les blessures, l'Abbé les punitions, le Contremaître et le Showman les minutes des trios, le Comptable les paris.
 * Les chiffres sont ceux d'avant `FRANCHISE_MATCH` (js/combat.js), comme toute carte de match.
 *
 * `DEPART_DU_CAHIER` : le deck de départ d'une run — une réponse neutre par intention, deux coups, trois cartes de
 * tous les soirs. Les cartes du départ ne montent pas la confiance d'un coach.
 */
export const CAHIER = {
  // ---- le départ : une réponse par intention, deux coups, trois cartes de tous les soirs ----
  changerTrios: { nom: 'Changer les trios', ico: '🔀', cout: 1, rarete: 'commune', genre: 'tactique', si: 'ombre',
    texte: 'Leur ombre suit un numéro : tu changes les numéros.', effet: { F: [0.95, 1.06, 1.04, 0.95] } },
  coudesSerres: { nom: 'Les coudes serrés', ico: '💪', cout: 1, rarete: 'commune', genre: 'defense', si: 'chasse',
    texte: 'Personne ne va dans le coin tout seul.', effet: { robustesse: 0.35 } },
  tirerDeLoin: { nom: 'Tirer de loin', ico: '🏒', cout: 1, rarete: 'commune', genre: 'attaque', si: 'centre',
    texte: 'Le centre est fermé ? La ligne bleue, elle, est grande ouverte.', effet: { finition: 1.06, volume: 1.04 } },
  serrerLesRangs: { nom: 'Serrer les rangs', ico: '🧱', cout: 1, rarete: 'commune', genre: 'defense', si: 'assaut',
    texte: 'Cinq joueurs entre la rondelle et le filet.', effet: { defense: 0.94 } },
  mainsASoi: { nom: 'Les mains à soi', ico: '🧘', cout: 0, rarete: 'commune', genre: 'defense', si: 'cachot',
    texte: 'Ils parlent, tu patines.', effet: { discipline: 0.85 } },
  tenirLeFort: { nom: 'Tenir le fort', ico: '🔒', cout: 1, rarete: 'commune', genre: 'defense', si: 'mene',
    texte: 'Vingt minutes à tenir : on joue la bande.', effet: { defense: 0.95 } },
  dernierEffort: { nom: 'Le dernier effort', ico: '⚡', cout: 1, rarete: 'commune', genre: 'attaque', si: 'derriere',
    texte: 'Tout le monde vide le réservoir.', effet: { volume: 1.1, energie: 1.08 } },
  lancerAuFilet: { nom: 'Lancer au filet', ico: '🥅', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Rien de compliqué : la rondelle au filet.', effet: { volume: 1.04 } },
  presencesEclair: { nom: 'Les présences éclair', ico: '⏱', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Trente secondes, et on change.', effet: { energie: 0.92 } },
  motDuCapitaine: { nom: 'Le mot du capitaine', ico: '🧭', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Il se lève, et le vestiaire se tait.', pioche: 1 },

  // ---- 🐝 le Frelon : les tirs ----
  bourdonnement: { nom: 'Le bourdonnement', ico: '🎯', cout: 1, rarete: 'commune', genre: 'attaque', si: 'cachot',
    texte: 'Ils cherchent à t\'envoyer au banc ? Tu les enterres de rondelles.', effet: { volume: 1.16 } },
  surReception: { nom: 'Lancer sur réception', ico: '🌀', cout: 1, rarete: 'peu', genre: 'attaque', si: 'centre',
    texte: 'La passe arrive, la rondelle part : personne n\'a le temps de fermer quoi que ce soit.', effet: { volume: 1.2, finition: 0.98 } },
  pluieDeRondelles: { nom: 'La pluie de rondelles', ico: '🌧', cout: 2, rarete: 'rare', genre: 'attaque', si: 'derriere',
    texte: 'Vingt minutes, trente lancers : on finira bien par en passer une.', effet: { volume: 1.35, energie: 1.12 } },
  fouleQuiPousse: { nom: 'La foule qui pousse', ico: '📣', cout: 1, rarete: 'peu', genre: 'attaque', si: 'domicile',
    texte: 'Dix-huit mille personnes crient « Lance ! » à chaque présence.', effet: { volume: 1.08 } },

  // ---- 🦅 l'Aigle : la précision ----
  lucarne: { nom: 'Viser la lucarne', ico: '🔭', cout: 1, rarete: 'commune', genre: 'attaque', si: 'centre',
    texte: 'Un seul tir par présence, mais dans le coin du haut.', effet: { finition: 1.1 } },
  vedetteSeLibere: { nom: 'La vedette se libère', ico: '🪽', cout: 1, rarete: 'peu', genre: 'attaque', si: 'ombre',
    texte: 'Son ombre l\'a lâché deux secondes. C\'est assez.', effet: { finition: 1.12 } },
  dernierClou: { nom: 'Le dernier clou', ico: '🔨', cout: 1, rarete: 'peu', genre: 'attaque', si: 'mene',
    texte: 'Le but qui ferme le cercueil.', effet: { finition: 1.12, volume: 0.95 } },
  butEnSeries: { nom: 'Le but du printemps', ico: '🌷', cout: 2, rarete: 'legendaire', genre: 'attaque', si: 'series',
    texte: 'En avril, les vrais marqueurs se montrent.', effet: { finition: 1.15, volume: 1.06 } },

  // ---- 🐢 la Tortue : la précision adverse ----
  leMur: { nom: 'Le mur', ico: '🧊', cout: 1, rarete: 'commune', genre: 'defense', si: 'assaut',
    texte: 'Ils arrivent à cinq ; ils repartent un par un.', effet: { defense: 0.9 } },
  fermerLesLivres: { nom: 'Fermer les livres', ico: '📕', cout: 1, rarete: 'peu', genre: 'defense', si: 'mene',
    texte: 'Ils lancent de loin. Toi aussi, tu ne lances presque plus.', effet: { defense: 0.85, volume: 0.9 } },
  patience: { nom: 'La patience', ico: '🕰', cout: 1, rarete: 'peu', genre: 'defense', si: 'chasse',
    texte: 'Ils veulent la mêlée ; tu leur donnes un mur de bâtons.', effet: { defense: 0.9 } },
  chateau: { nom: 'Le château', ico: '🏰', cout: 1, rarete: 'rare', genre: 'defense', si: 'domicile',
    texte: 'Chez toi, on ne marque pas. C\'est écrit sur la porte du vestiaire.', effet: { defense: 0.93 } },

  // ---- 🦏 le Rhino : la robustesse ----
  doubleEchec: { nom: 'Le double échec', ico: '🥊', cout: 1, rarete: 'commune', genre: 'attaque', si: 'chasse',
    texte: 'Ils chassent tes défenseurs ? Deux de tes gars chassent le chasseur.', effet: { robustesse: 0.6, discipline: 1.08 } },
  dansLeTas: { nom: 'On rentre dans le tas', ico: '🦬', cout: 1, rarete: 'peu', genre: 'attaque', si: 'centre',
    texte: 'Le centre est fermé ? On l\'ouvre à l\'épaule.', effet: { robustesse: 0.65 } },
  murDeChair: { nom: 'Le mur de chair', ico: '🪨', cout: 1, rarete: 'peu', genre: 'defense', si: 'egal',
    texte: 'À égalité en troisième, plus personne ne passe sans payer.', effet: { robustesse: 0.7 } },
  rancune: { nom: 'La rancune', ico: '😤', cout: 1, rarete: 'legendaire', genre: 'attaque', si: 'beteNoire',
    texte: 'Ils t\'ont battu deux fois. Le vestiaire n\'a pas oublié.', effet: { robustesse: 0.9, volume: 1.03, discipline: 1.1 } },

  // ---- 🫁 le Doc : les jambes et les blessures ----
  soigneurAuBanc: { nom: 'Le soigneur au banc', ico: '🩹', cout: 1, rarete: 'commune', genre: 'tactique', si: 'chasse',
    texte: 'Il a la trousse ouverte avant la mise au jeu.', effet: { blessure: 0.6 } },
  jambesDeLa3e: { nom: 'Les jambes de la 3e', ico: '🦵', cout: 1, rarete: 'peu', genre: 'tactique', si: 'egal',
    texte: 'Tu as gardé du jus pour la fin : eux, non.', effet: { energie: 0.75, volume: 1.04 } },
  bainDeGlace: { nom: 'Le bain de glace', ico: '🛁', cout: 0, rarete: 'peu', genre: 'tactique', si: 'dosADos',
    texte: 'Vingt minutes dans l\'eau froide, et les jambes reviennent.', effet: { energie: 0.85 } },
  oxygene: { nom: 'L\'oxygène', ico: '🫧', cout: 1, rarete: 'rare', genre: 'tactique', si: 'visiteur',
    texte: 'Une bouteille au banc, et le voyage ne se sent plus.', effet: { energie: 0.8, blessure: 0.6, volume: 1.09 } },

  // ---- 😇 l'Abbé : les punitions ----
  autreJoue: { nom: 'Tendre l\'autre joue', ico: '🕊', cout: 0, rarete: 'commune', genre: 'defense', si: 'cachot',
    texte: 'Le coup de bâton arrive ; tu souris à l\'arbitre.', effet: { discipline: 0.7 } },
  chapelet: { nom: 'Le chapelet', ico: '📿', cout: 1, rarete: 'peu', genre: 'tactique', si: 'derriere',
    texte: 'Un banc qui prie fait des adversaires nerveux.', adv: { discipline: 1.35 } },
  arbitreAToutVu: { nom: 'L\'arbitre a tout vu', ico: '👁', cout: 1, rarete: 'peu', genre: 'tactique', si: 'chasse',
    texte: 'Leur chasse se fait siffler, une fois sur deux.', adv: { discipline: 1.3 } },
  messeDeMinuit: { nom: 'La messe de minuit', ico: '🕯', cout: 1, rarete: 'rare', genre: 'tactique', si: 'rival',
    texte: 'Contre un rival, on ne répond pas : on attend qu\'il craque.', effet: { discipline: 0.85 }, adv: { discipline: 1.15 } },

  // ---- 🪜 le Contremaître : les minutes vers le bas ----
  quatriemeTrio: { nom: 'Le quatrième trio', ico: '🔋', cout: 0, rarete: 'commune', genre: 'tactique', si: 'ombre',
    texte: 'Ils suivent ta vedette ; ton quatrième trio, personne ne le suit.', effet: { F: [0.9, 0.95, 1.05, 1.3] } },
  plombiersEn3e: { nom: 'Les plombiers en 3e', ico: '🧰', cout: 1, rarete: 'peu', genre: 'tactique', si: 'mene',
    texte: 'Pour fermer un match, tu envoies ceux qui ne perdent jamais la rondelle.', effet: { F: [0.9, 0.95, 1.05, 1.3], defense: 0.96 } },
  toutLeMonde: { nom: 'Tout le monde joue', ico: '👷', cout: 1, rarete: 'peu', genre: 'tactique', si: 'dosADos',
    texte: 'Hier soir ici, ce soir là-bas : quatre trios, quatre fois plus de jambes.', effet: { F: [0.92, 0.98, 1.05, 1.2], energie: 0.9 } },
  usine: { nom: 'L\'usine', ico: '🏭', cout: 1, rarete: 'rare', genre: 'tactique', si: 'jambesLourdes',
    texte: 'Les vedettes sont brûlées ; la profondeur, elle, a dormi.', effet: { F: [0.8, 0.9, 1.1, 1.45], energie: 0.85, volume: 1.07 } },

  // ---- 🌠 le Showman : les minutes vers le haut ----
  vedettesEnAvant: { nom: 'Les vedettes en avant', ico: '⭐', cout: 1, rarete: 'commune', genre: 'attaque', si: 'ombre',
    texte: 'Une ombre ne suit qu\'un joueur : tu en envoies trois.', effet: { F: [1.3, 1.05, 0.9, 0.75] } },
  remontee: { nom: 'La remontée', ico: '📈', cout: 1, rarete: 'peu', genre: 'attaque', si: 'derriere',
    texte: 'Ton premier trio saute un tour sur deux jusqu\'à la fin.', effet: { F: [1.3, 1.05, 0.9, 0.75], volume: 1.08 } },
  uneDuJournal: { nom: 'La une du journal', ico: '📰', cout: 1, rarete: 'peu', genre: 'attaque', si: 'domicile',
    texte: 'Leur photo est en première page : ils jouent pour la manchette.', effet: { F: [1.2, 1.05, 0.95, 0.85] } },
  grandSoirV10: { nom: 'Le grand soir', ico: '🎆', cout: 2, rarete: 'legendaire', genre: 'attaque', si: 'series',
    texte: 'En séries, les vedettes jouent la moitié du match.', effet: { F: [1.35, 1.05, 0.9, 0.7], finition: 1.05 } },

  // ---- 🏦 le Comptable : les paris ----
  quitteOuDouble: { nom: 'Quitte ou double', ico: '🎲', cout: 1, rarete: 'peu', genre: 'tactique', si: 'derriere',
    texte: 'Le gardien au banc dès la mi-période : ça passe ou ça casse.', pari: { chance: 1 / 2, gagne: { finition: 1.2 }, perd: { defense: 1.1 } } },
  placement: { nom: 'Le placement', ico: '💹', cout: 1, rarete: 'rare', genre: 'tactique', si: 'egal',
    texte: 'Un risque calculé, à égalité, quand l\'autre hésite.', pari: { chance: 2 / 3, gagne: { volume: 1.5, finition: 1.06 }, perd: { volume: 0.88 } } },
};

export const DEPART_DU_CAHIER = ['changerTrios', 'coudesSerres', 'tirerDeLoin', 'serrerLesRangs', 'mainsASoi', 'tenirLeFort', 'dernierEffort', 'lancerAuFilet', 'presencesEclair', 'motDuCapitaine'];
