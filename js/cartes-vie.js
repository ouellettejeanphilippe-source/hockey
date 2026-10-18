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
  contrat_proximite: { nom: 'Clause de proximité', ico: '🏘', cible: 'libre', source: 'contrat', quoi: 'Il a exigé une maison à dix minutes de chez sa mère. Il y soupe tous les dimanches, sans exception.', finition: 1.07, blessure: 1.14 },
  contrat_cafetiere: { nom: 'Clause de la cafetière', ico: '🫗', cible: 'libre', source: 'contrat', quoi: 'Une cafetière dans son casier, aux frais du club. Il en vide une pleine avant chaque match.', lancers: 1.105, blessure: 1.14 },
  // peu commune : un canal à cinq pour cent, ou deux plus petits
  contrat_assiduite: { nom: 'Clause d\'assiduité', ico: '📆', cible: 'libre', source: 'contrat', quoi: 'Un boni par match joué. Il jouerait grippé, et il l\'a déjà fait.', lancers: 1.092, blessure: 1.336 },
  contrat_deplacement: { nom: 'Clause de non-déplacement', ico: '📄', cible: 'libre', source: 'contrat', quoi: 'Il refuse de prendre l\'avion. Il voyage en autobus, seul à l\'avant, et descend raide comme un piquet.', defense: 0.952, finition: 0.969 },
  // rare : un vrai bonus, et son prix
  contrat_profits: { nom: 'Clause de participation aux profits', ico: '🏧', cible: 'libre', source: 'contrat', quoi: 'Il touche une part des ventes du bar de l\'aréna. Il salue la foule à chaque arrêt de jeu.', finition: 1.101, lancers: 1.076, blessure: 1.42 },
  contrat_avril: { nom: 'Clause de fin de saison', ico: '🗓', cible: 'libre', source: 'contrat', quoi: 'Il garde ses forces pour avril. En octobre, on le cherche encore sur la glace.', defense: 0.937, lancers: 0.924, blessure: 0.664 },
  // légendaire : le plus gros bonus du lot, un prix qui se sent

  // Nouveaux styles et contrats (ajouts)
  contrat_glace: { nom: 'Clause de glace à l\'année', ico: '🧊', cible: 'libre', source: 'contrat', quoi: 'Il a fait écrire à son contrat une patinoire dans sa cour. Il y patine chaque matin avant l\'entraînement.', lancers: 1.05, blessure: 1.05 },
  contrat_animaux: { nom: 'Clause des mascottes', ico: '🐕', cible: 'libre', source: 'contrat', quoi: 'Son contrat lui permet d\'amener ses trois huskies au vestiaire le mardi. Le soigneur les promène.', finition: 1.04, lancers: 1.04, blessure: 1.15 },

};
export const RARETE_MODIFS_VIE = {
  contrat_proximite: 'commune', contrat_cafetiere: 'commune',
  contrat_assiduite: 'peu', contrat_deplacement: 'peu',
  contrat_profits: 'rare', contrat_avril: 'rare',
  contrat_glace: 'commune', contrat_animaux: 'commune',
};

/* ---------- LES CONSOMMABLES (une utilisation) ---------- */
export const CONSOMMABLES_VIE = {
  baume: { nom: 'Le baume de grand-maman', ico: '🪻', rarete: 'commune', vie: 'usage', cible: 'blesse', gestes: { soin: 2 }, effet: { energie: 1.14 }, duree: 3, texte: 'Le pot de baume de sa grand-mère sort du sac après la pratique. Tout le vestiaire sent la menthe.' },
  deuxiemeAvis: { nom: 'Le deuxième avis', ico: '🥼', rarete: 'peu', vie: 'usage', cible: 'blesse', gestes: { soin: 6 }, effet: { energie: 1.14 }, duree: 3, texte: 'Un deuxième médecin examine le blessé. Le diagnostic ne change pas, mais le ton est plus doux.' },
  chirurgienLundi: { nom: 'Le chirurgien du lundi', ico: '🩼', rarete: 'rare', vie: 'permanent', cible: 'blesse', gestes: { soin: 9 }, effet: { energie: 1.28 }, duree: 6, texte: 'Le chirurgien a une plage libre lundi matin. Le genou est réparé avant le souper.' },

  // Nouveaux consommables

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
  // l'Aigle : de la précision
  // la Tortue : fermer la porte
  // le Rhino : le contact
  // le Doc : les jambes
  // l'Abbé : la discipline
  // le Contremaître : tout le monde joue
  // le Showman : les vedettes
  // neutres : le dépistage et les rabais

  // Nouvelles cartes de match

};
