/*
 * « UNE SAISON DANS LA VIE D'UN DG-COACH » : soixante-dix événements d'équipe de plus,
 * au format de EVENEMENTS (js/banque.js) : `duree` en journées, `effet` et `gestes`
 * sur les canaux existants, dans les amplitudes des entrées voisines de même rareté.
 * Les communes donnent un peu et prennent un peu ; les maudites coûtent ; les rares paient.
 */
export const EVENEMENTS_VIE = {
  // ---- Le vestiaire ----
  chaiseCapitaine: { nom: 'La chaise du capitaine', ico: '💺', rarete: 'commune', duree: 6, texte: 'Personne ne s\'y assoit, même quand il est absent.', effet: { discipline: 0.95, volume: 0.99 } },
  tableauBlanc: { nom: 'Le tableau blanc du vestiaire', ico: '🖍️', rarete: 'peu', duree: 7, texte: 'Un schéma effacé trois fois, puis finalement compris.', effet: { defense: 0.98, finition: 0.99 } },
  chansonVictoire: { nom: 'La chanson de la victoire', ico: '🪕', rarete: 'peu', duree: 6, texte: 'Le même refrain depuis octobre, par superstition et par habitude.', effet: { finition: 1.02, discipline: 1.03 } },
  casierVoisin: { nom: 'Le casier du voisin', ico: '🧦', rarete: 'commune', duree: 5, texte: 'Un litige mineur sur l\'odeur d\'un équipement.', effet: { discipline: 1.04, defense: 0.99 } },
  tournoiCartes: { nom: 'Le tournoi de cartes', ico: '♠️', rarete: 'commune', duree: 7, texte: 'Les mises sont modestes ; la fierté ne l\'est pas.', effet: { energie: 0.96, finition: 0.99 } },
  silenceCorridor: { nom: 'Le silence dans le corridor', ico: '🤫', rarete: 'peu', duree: 5, texte: 'Aucun cri, aucune musique. Le personnel d\'entretien s\'inquiète.', effet: { defense: 0.97, volume: 0.98 } },
  jeuxVideo: { nom: 'Le tournoi de jeux vidéo', ico: '🕹️', rarete: 'peu', duree: 6, texte: 'Les défenseurs ont gagné, ce qui ne s\'explique pas.', effet: { volume: 1.02, energie: 1.04 } },
  chandailEnvers: { nom: 'Le chandail à l\'envers', ico: '🧥', rarete: 'peu', duree: 6, texte: 'Un rituel d\'avant-match, adopté par le vestiaire après deux victoires.', effet: { finition: 1.03, discipline: 1.06 } },
  barbier: { nom: 'Le barbier de la maison', ico: '💈', rarete: 'commune', duree: 5, texte: 'Une coupe à l\'équipe, et dix minutes de silence respectueux.', effet: { discipline: 0.93, volume: 0.99 } },
  tempsMort: { nom: 'Le temps mort inutile', ico: '⏲️', rarete: 'commune', duree: 4, texte: 'Le coach a parlé quarante secondes. Le message n\'est pas parvenu.', effet: { volume: 0.98, finition: 1.01 } },
  recrueSeau: { nom: 'La recrue et le seau', ico: '🥄', rarete: 'commune', duree: 5, texte: 'Elle porte le sac de rondelles, et elle ne s\'en plaint pas.', effet: { energie: 1.03, discipline: 0.96 } },
  rondeJoueurs: { nom: 'La réunion des joueurs', ico: '🫂', rarete: 'peu', duree: 6, texte: 'Sans le personnel d\'entraîneurs. Le compte rendu fait six lignes.', effet: { finition: 1.03, defense: 0.98, blessure: 1.05 } },

  // ---- Les médias ----
  conferenceTrop: { nom: 'La conférence de presse trop longue', ico: '🔊', rarete: 'commune', duree: 4, texte: 'Quarante minutes pour confirmer que tout est à l\'étude.', effet: { energie: 1.04, discipline: 0.97 } },
  chroniqueur: { nom: 'Le chroniqueur du matin', ico: '✒️', rarete: 'peu', duree: 8, texte: 'Il déclare que le momentum est une réalité scientifique.', effet: { finition: 1.02, discipline: 1.05 } },
  lignesOuvertes: { nom: 'La ligne ouverte', ico: '☎️', rarete: 'peu', duree: 7, texte: 'Un auditeur de Laval réclame un nouveau gardien, avec méthode.', effet: { finition: 0.98, volume: 1.03 } },
  entrevueCouloir: { nom: 'L\'entrevue de corridor', ico: '📹', rarete: 'commune', duree: 4, texte: 'Trois clichés de suite, tous livrés avec le plus grand calme.', effet: { discipline: 0.96, finition: 0.99 } },
  documentaire: { nom: 'Le documentaire de la saison', ico: '🎥', rarete: 'peu', duree: 8, texte: 'Une caméra dans le vestiaire. Les joueurs se tiennent soudain très droit.', effet: { discipline: 0.92, finition: 1.02, volume: 0.99 } },
  titreMalheureux: { nom: 'Le titre malheureux', ico: '🗒️', rarete: 'maudite', duree: 7, texte: 'Un quotidien résume la saison en un seul adjectif. Il n\'est pas flatteur.', effet: { finition: 0.97, discipline: 1.08 } },
  baladoAdverse: { nom: 'Le balado de l\'adversaire', ico: '🔈', rarete: 'peu', duree: 5, texte: 'Il parle de nous pendant trois quarts d\'heure, sans un compliment.', effet: { finition: 1.02, discipline: 1.04 } },
  photographe: { nom: 'Le photographe de la ligue', ico: '📷', rarete: 'commune', duree: 3, texte: 'Une journée entière de poses. Un seul sourire a été retenu.', effet: { energie: 1.03, discipline: 0.97 } },
  analysteInvite: { nom: 'L\'analyste invité', ico: '🖥️', rarete: 'peu', duree: 7, texte: 'Il explique tout au tableau, y compris ce qui n\'est pas arrivé.', effet: { defense: 0.98, finition: 0.99 } },

  // ---- Le propriétaire ----
  loge: { nom: 'La loge du propriétaire', ico: '🥃', rarete: 'commune', duree: 6, texte: 'Il regarde le match de haut, comme il se doit.', effet: { discipline: 0.96, finition: 0.99 } },
  courrielSieste: { nom: 'Le courriel du dimanche', ico: '💌', rarete: 'peu', duree: 6, texte: 'Rédigé « comme discuté lors de ma sieste ». Aucune consigne n\'y figure.', effet: { discipline: 0.94, volume: 0.98 } },
  budgetCafe: { nom: 'Le budget du café', ico: '🫖', rarete: 'maudite', duree: 8, texte: 'Une coupure à l\'infirmerie, annoncée entre deux dossiers de comptabilité.', effet: { blessure: 1.15, energie: 1.06 } },
  nouveauLogo: { nom: 'Le nouveau logo', ico: '🔷', rarete: 'peu', duree: 5, texte: 'Un comité de douze personnes a changé la teinte du bleu.', effet: { finition: 1.02, discipline: 1.03 } },
  jetPrive: { nom: 'Le jet privé', ico: '🛩️', rarete: 'peu', duree: 6, texte: 'Les voyages sont plus courts. Personne ne pose de question sur la facture.', effet: { energie: 0.93, discipline: 1.03 } },
  visiteVestiaire: { nom: 'La visite surprise du propriétaire', ico: '🧐', rarete: 'peu', duree: 5, texte: 'Il serre toutes les mains, y compris celles du soigneur, deux fois.', effet: { finition: 1.04, discipline: 1.04, energie: 1.03 } },
  banquetBienfaisance: { nom: 'Le banquet de bienfaisance', ico: '🥘', rarete: 'commune', duree: 4, texte: 'Mille deux cents convives, et un discours de dix-sept minutes.', effet: { energie: 1.05, finition: 1.01 } },
  naming: { nom: 'Le nom de l\'aréna vendu', ico: '🪪', rarete: 'rare', duree: 12, texte: 'Un généreux commanditaire s\'est offert. Le vestiaire a été repeint.', effet: { finition: 1.03, defense: 0.98, volume: 1.02 }, gain: 20 },
  droitsTele: { nom: 'Les nouveaux droits télé', ico: '📽️', rarete: 'rare', duree: 10, texte: 'Le contrat est signé. Le propriétaire dit « en toute humilité ».', effet: { finition: 1.02, defense: 0.98, energie: 0.96 }, gain: 25 },

  // ---- Les agents ----
  agentLobby: { nom: 'L\'agent dans le lobby', ico: '🤵', rarete: 'peu', duree: 5, texte: 'Il attend depuis midi, avec une chemise et un cartable.', effet: { discipline: 1.03, finition: 1.01 } },
  appelTard: { nom: 'L\'appel de onze heures du soir', ico: '🌙', rarete: 'commune', duree: 4, texte: 'Il voulait seulement « prendre des nouvelles du dossier ».', effet: { energie: 1.04, finition: 1.01 } },
  prolongationRefusee: { nom: 'La prolongation refusée', ico: '🙅', rarete: 'maudite', duree: 8, texte: 'Un joueur de premier plan préfère « voir ce qui se présente ».', effet: { finition: 0.97, discipline: 1.08, volume: 0.98 } },
  contreOffre: { nom: 'La contre-offre', ico: '📎', rarete: 'peu', duree: 6, texte: 'Quatre pages, deux annexes, et un pourcentage du prix des hot-dogs.', effet: { finition: 1.03, discipline: 1.05 } },
  clauseCachee: { nom: 'La clause cachée', ico: '🪬', rarete: 'peu', duree: 7, texte: 'Découverte à la page onze, sous un astérisque.', effet: { discipline: 0.95, finition: 0.98 } },
  agentRire: { nom: 'L\'agent qui rit', ico: '🤣', rarete: 'commune', duree: 4, texte: 'Il a trouvé notre première offre très drôle.', effet: { finition: 0.99, energie: 1.03 } },
  jeuneProdige: { nom: 'Le jeune prodige sous contrat', ico: '🧒', rarete: 'rare', duree: 12, texte: 'Dix-huit ans, aucun agent, et une cote qui n\'a pas encore été inventée.', effet: { finition: 1.03, volume: 1.03, discipline: 0.96 } },

  // ---- Les partisans ----
  chantsGradins: { nom: 'Le chant des gradins', ico: '🪗', rarete: 'peu', duree: 6, texte: 'Quatre mille voix, une seule mélodie et peu de justesse.', effet: { volume: 1.025, discipline: 1.02 } },
  banderole: { nom: 'La banderole de la section 112', ico: '🚩', rarete: 'peu', duree: 5, texte: 'Quarante mètres de toile, et une faute d\'orthographe.', effet: { finition: 1.02, defense: 1.01 } },
  clubDesAmis: { nom: 'Le club des partisans de longue date', ico: '🧣', rarete: 'peu', duree: 8, texte: 'Ils n\'ont pas manqué un match depuis la présidence précédente.', effet: { discipline: 0.95, volume: 1.02 } },
  partisanAvion: { nom: 'Le partisan de l\'avion', ico: '🧑‍✈️', rarete: 'commune', duree: 4, texte: 'Il a voyagé neuf heures pour s\'asseoir derrière le banc adverse.', effet: { energie: 0.97, discipline: 1.02 } },
  petitionFiltre: { nom: 'La pétition du filtre', ico: '📃', rarete: 'commune', duree: 6, texte: 'Dix mille signatures pour demander un nouveau système de ventilation.', effet: { energie: 0.96, volume: 0.99 } },
  tifo: { nom: 'Le tifo géant', ico: '🏳️', rarete: 'peu', duree: 4, texte: 'Déployé avant la mise au jeu. Il couvre une section entière.', effet: { finition: 1.04, defense: 0.98 } },
  loterieMoitie: { nom: 'Le tirage moitié-moitié', ico: '🎠', rarete: 'commune', duree: 4, texte: 'Le gagnant a donné sa part au club de pétanque.', effet: { finition: 1.01, energie: 0.97 } },

  // ---- Les voyages ----
  autobusPanne: { nom: 'L\'autobus en panne', ico: '🛞', rarete: 'commune', duree: 4, texte: 'Trois heures au bord de l\'autoroute, à regarder passer des camions.', effet: { energie: 1.07, discipline: 0.97 } },
  volRetarde: { nom: 'Le vol retardé', ico: '🛬', rarete: 'commune', duree: 3, texte: 'Atterri à l\'aube, entraîné à midi, couché à midi et quart.', effet: { energie: 1.08, volume: 0.98 } },
  tournoiNeige: { nom: 'La route enneigée', ico: '🛣️', rarete: 'commune', duree: 4, texte: 'Le chauffeur a dit « ça va bien aller » pendant deux cents kilomètres.', effet: { energie: 1.05, discipline: 0.97 } },
  frontiere: { nom: 'La fouille à la frontière', ico: '🛂', rarete: 'commune', duree: 3, texte: 'Un douanier compte les bâtons, un par un, avec application.', effet: { energie: 1.04, finition: 1.01 } },
  hotelPiscine: { nom: 'L\'hôtel avec piscine', ico: '🏊', rarete: 'peu', duree: 5, texte: 'Quarante-cinq minutes de longueurs, le matin du match.', effet: { energie: 0.94, blessure: 0.95 } },
  fuseaux: { nom: 'Les fuseaux horaires', ico: '🌐', rarete: 'peu', duree: 6, texte: 'La collation de dix heures se prend à sept heures, selon le coach.', effet: { energie: 1.06, finition: 1.02 } },

  // ---- La météo ----
  verglas: { nom: 'La pluie verglaçante', ico: '🚗', rarete: 'commune', duree: 3, texte: 'Le stationnement est une patinoire. Les joueurs y glissent avec aisance.', effet: { energie: 1.05, discipline: 0.97 } },
  brouillardGlace: { nom: 'Le brouillard sur la glace', ico: '🌫️', rarete: 'commune', duree: 3, texte: 'On voit mal la rondelle, mais on la sent.', effet: { volume: 0.97, defense: 0.98 } },
  panneCourant: { nom: 'La panne de courant', ico: '🔌', rarete: 'commune', duree: 3, texte: 'Une demi-heure de pénombre, puis le match reprend comme si de rien n\'était.', effet: { discipline: 0.96, finition: 0.99 } },
  poudrerie: { nom: 'La poudrerie', ico: '🌬️', rarete: 'peu', duree: 4, texte: 'Les estrades sont à moitié vides ; les présents sont d\'une loyauté exemplaire.', effet: { energie: 1.04, volume: 1.02 } },
  douxMatin: { nom: 'Le doux matin de février', ico: '🌤️', rarete: 'peu', duree: 5, texte: 'Quinze degrés. Le coach laisse le chandail à la maison.', effet: { energie: 0.95, finition: 1.01 } },

  // ---- Les blessures et le soigneur ----
  physioNouveau: { nom: 'Le physio recruté', ico: '🧑‍⚕️', rarete: 'peu', duree: 8, texte: 'Une moyenne de retour au jeu de dix-neuf jours, selon son propre rapport.', effet: { blessure: 0.92, energie: 0.98 } },
  piscineThera: { nom: 'La piscine thérapeutique', ico: '🦭', rarete: 'peu', duree: 6, texte: 'Les blessés y marchent en rond avec un sérieux total.', effet: { blessure: 0.95, volume: 0.99 }, gestes: { soin: 2, tousLesBlesses: true } },
  bandageSerre: { nom: 'Le bandage trop serré', ico: '🧵', rarete: 'maudite', duree: 5, texte: 'Un joueur revient trop vite. Le soigneur répond d\'un haussement d\'épaules.', effet: { blessure: 1.2, finition: 1.01 } },
  testSang: { nom: 'La prise de sang de routine', ico: '🔬', rarete: 'commune', duree: 3, texte: 'Les résultats sont corrects, sauf les vôtres.', effet: { blessure: 0.97, energie: 1.02 } },
  imagerie: { nom: 'La résonance magnétique', ico: '🩻', rarete: 'commune', duree: 4, texte: 'Un joueur y reste quarante minutes et sort en parfaite santé.', effet: { blessure: 0.96, volume: 0.99 }, gestes: { soin: 1, tousLesBlesses: true } },
  retourPrecoce: { nom: 'Le retour prématuré', ico: '🦿', rarete: 'peu', duree: 5, texte: 'Le blessé a dit « je me sens bien » trois fois. Il n\'a pas été cru.', effet: { finition: 1.02, blessure: 1.1 }, gestes: { soin: 3, tousLesBlesses: true } },

  // ---- Le repêchage, l'échéance, le camp, la fin ----
  tableRepechage: { nom: 'La table de repêchage', ico: '🔖', rarete: 'commune', duree: 5, texte: 'Le recruteur en chef a quatre listes, et trois sont à jour.', effet: { discipline: 0.97, finition: 0.99 } },
  loterieRepechage: { nom: 'La loterie du repêchage', ico: '🎱', rarete: 'peu', duree: 4, texte: 'Un tirage de boules de ping-pong, supervisé par un comptable.', effet: { finition: 1.02, volume: 1.02, energie: 1.03 } },
  veilleEcheance: { nom: 'La veille de l\'échéance', ico: '🫣', rarete: 'peu', duree: 5, texte: 'Tout le monde fixe son téléphone, même pendant la pratique.', effet: { finition: 0.98, volume: 1.03 } },
  silenceEcheance: { nom: 'Le silence de l\'échéance', ico: '🔕', rarete: 'commune', duree: 3, texte: 'Le téléphone n\'a pas sonné. C\'est une nouvelle en soi.', effet: { discipline: 0.96, energie: 1.02 } },
  campEntrainement: { nom: 'La journée des tests physiques', ico: '⛰️', rarete: 'peu', duree: 6, texte: 'Chaque joueur est mesuré, pesé et classé sur une feuille de calcul.', effet: { robustesse: 0.3, energie: 1.04 } },
  campFlechettes: { nom: 'Le camp de la relève', ico: '🌲', rarete: 'peu', duree: 8, texte: 'Quarante espoirs, un seul filet, et une patience de moine.', effet: { volume: 1.03, energie: 1.04, finition: 0.99 } },
  dernierSprint: { nom: 'Le dernier droit', ico: '🚦', rarete: 'rare', duree: 10, texte: 'Douze matchs, une seule consigne, et un tableau qui ne ment pas.', effet: { finition: 1.03, defense: 0.97, volume: 1.03, energie: 1.05 } },
  bilanFinSaison: { nom: 'Le bilan de fin de saison', ico: '🪫', rarete: 'peu', duree: 5, texte: 'Trente minutes de diapositives. Une seule était lisible.', effet: { discipline: 0.95, finition: 0.99 } },
  cercleVertueux: { nom: 'Le cercle vertueux', ico: '🎡', rarete: 'commune', duree: 5, texte: 'Les vétérans montrent aux jeunes où se trouve le chemin du retour.', effet: { discipline: 0.96, defense: 0.99 } },
};
