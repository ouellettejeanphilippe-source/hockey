/*
 * « UNE SAISON DANS LA VIE D'UN DG-COACH » : soixante-dix événements d'équipe de plus,
 * au format de EVENEMENTS (js/banque.js) : `duree` en journées, `effet` et `gestes`
 * sur les canaux existants, dans les amplitudes des entrées voisines de même rareté.
 * Les communes donnent un peu et prennent un peu ; les maudites coûtent ; les rares paient.
 */
export const EVENEMENTS_VIE = {
  // ---- Le vestiaire ----
  chaiseCapitaine: { nom: 'La chaise du capitaine', ico: '💺', rarete: 'commune', duree: 6, texte: 'Personne ne s\'y assoit, même quand il est absent.', effet: { volume: 0.962, discipline: 0.812 } },
  tableauBlanc: { nom: 'Le tableau blanc du vestiaire', ico: '🖍️', rarete: 'peu', duree: 7, texte: 'Un schéma effacé trois fois, puis finalement compris.', effet: { finition: 0.962, defense: 0.925 } },
  chansonVictoire: { nom: 'La chanson de la victoire', ico: '🪕', rarete: 'peu', duree: 6, texte: 'Le même refrain depuis octobre, par superstition et par habitude.', effet: { finition: 1.083, discipline: 1.124 } },
  casierVoisin: { nom: 'Le casier du voisin', ico: '🧦', rarete: 'commune', duree: 5, texte: 'Un litige mineur sur l\'odeur d\'un équipement.', effet: { defense: 0.962, discipline: 1.15 } },
  tournoiCartes: { nom: 'Le tournoi de cartes', ico: '♠️', rarete: 'commune', duree: 7, texte: 'Les mises sont modestes ; la fierté ne l\'est pas.', effet: { finition: 0.94, energie: 0.76 } },
  silenceCorridor: { nom: 'Le silence dans le corridor', ico: '🤫', rarete: 'peu', duree: 5, texte: 'Aucun cri, aucune musique. Le personnel d\'entretien s\'inquiète.', effet: { volume: 0.925, defense: 0.888 } },
  jeuxVideo: { nom: 'Le tournoi de jeux vidéo', ico: '🕹️', rarete: 'peu', duree: 6, texte: 'Les défenseurs ont gagné, ce qui ne s\'explique pas.', effet: { volume: 1.083, energie: 1.165 } },
  chandailEnvers: { nom: 'Le chandail à l\'envers', ico: '🧥', rarete: 'peu', duree: 6, texte: 'Un rituel d\'avant-match, adopté par le vestiaire après deux victoires.', effet: { finition: 1.112, discipline: 1.225 } },
  barbier: { nom: 'Le barbier de la maison', ico: '💈', rarete: 'commune', duree: 5, texte: 'Une coupe à l\'équipe, et dix minutes de silence respectueux.', effet: { volume: 0.962, discipline: 0.737 } },
  tempsMort: { nom: 'Le temps mort inutile', ico: '⏲️', rarete: 'commune', duree: 4, texte: 'Le coach a parlé quarante secondes. Le message n\'est pas parvenu.', effet: { volume: 0.925, finition: 1.037 } },
  recrueSeau: { nom: 'La recrue et le seau', ico: '🥄', rarete: 'commune', duree: 5, texte: 'Elle porte le sac de rondelles, et elle ne s\'en plaint pas.', effet: { discipline: 0.85, energie: 1.112 } },
  rondeJoueurs: { nom: 'La réunion des joueurs', ico: '🫂', rarete: 'peu', duree: 6, texte: 'Sans le personnel d\'entraîneurs. Le compte rendu fait six lignes.', effet: { finition: 1.112, defense: 0.925, blessure: 1.65 } },

  // ---- Les médias ----
  conferenceTrop: { nom: 'La conférence de presse trop longue', ico: '🔊', rarete: 'commune', duree: 4, texte: 'Quarante minutes pour confirmer que tout est à l\'étude.', effet: { discipline: 0.865, energie: 1.18 } },
  chroniqueur: { nom: 'Le chroniqueur du matin', ico: '✒️', rarete: 'peu', duree: 8, texte: 'Il déclare que le momentum est une réalité scientifique.', effet: { finition: 1.075, discipline: 1.188 } },
  lignesOuvertes: { nom: 'La ligne ouverte', ico: '☎️', rarete: 'peu', duree: 7, texte: 'Un auditeur de Laval réclame un nouveau gardien, avec méthode.', effet: { volume: 1.112, finition: 0.925 } },
  entrevueCouloir: { nom: 'L\'entrevue de corridor', ico: '📹', rarete: 'commune', duree: 4, texte: 'Trois clichés de suite, tous livrés avec le plus grand calme.', effet: { finition: 0.962, discipline: 0.85 } },
  documentaire: { nom: 'Le documentaire de la saison', ico: '🎥', rarete: 'peu', duree: 8, texte: 'Une caméra dans le vestiaire. Les joueurs se tiennent soudain très droit.', effet: { volume: 0.962, finition: 1.075, discipline: 0.7 } },
  titreMalheureux: { nom: 'Le titre malheureux', ico: '🗒️', rarete: 'maudite', duree: 7, texte: 'Un quotidien résume la saison en un seul adjectif. Il n\'est pas flatteur.', effet: { finition: 0.888, discipline: 1.3 } },
  baladoAdverse: { nom: 'Le balado de l\'adversaire', ico: '🔈', rarete: 'peu', duree: 5, texte: 'Il parle de nous pendant trois quarts d\'heure, sans un compliment.', effet: { finition: 1.075, discipline: 1.15 } },
  photographe: { nom: 'Le photographe de la ligue', ico: '📷', rarete: 'commune', duree: 3, texte: 'Une journée entière de poses. Un seul sourire a été retenu.', effet: { discipline: 0.865, energie: 1.135 } },
  analysteInvite: { nom: 'L\'analyste invité', ico: '🖥️', rarete: 'peu', duree: 7, texte: 'Il explique tout au tableau, y compris ce qui n\'est pas arrivé.', effet: { finition: 0.962, defense: 0.925 } },

  // ---- Le propriétaire ----
  loge: { nom: 'La loge du propriétaire', ico: '🥃', rarete: 'commune', duree: 6, texte: 'Il regarde le match de haut, comme il se doit.', effet: { finition: 0.962, discipline: 0.85 } },
  courrielSieste: { nom: 'Le courriel du dimanche', ico: '💌', rarete: 'peu', duree: 6, texte: 'Rédigé « comme discuté lors de ma sieste ». Aucune consigne n\'y figure.', effet: { volume: 0.925, discipline: 0.775 } },
  budgetCafe: { nom: 'Le budget du café', ico: '🫖', rarete: 'maudite', duree: 8, texte: 'Une coupure à l\'infirmerie, annoncée entre deux dossiers de comptabilité.', effet: { blessure: 1.562, energie: 1.225 } },
  nouveauLogo: { nom: 'Le nouveau logo', ico: '🔷', rarete: 'peu', duree: 5, texte: 'Un comité de douze personnes a changé la teinte du bleu.', effet: { finition: 1.083, discipline: 1.124 } },
  jetPrive: { nom: 'Le jet privé', ico: '🛩️', rarete: 'peu', duree: 6, texte: 'Les voyages sont plus courts. Personne ne pose de question sur la facture.', effet: { discipline: 1.147, energie: 0.7 } },
  visiteVestiaire: { nom: 'La visite surprise du propriétaire', ico: '🧐', rarete: 'peu', duree: 5, texte: 'Il serre toutes les mains, y compris celles du soigneur, deux fois.', effet: { finition: 1.12, discipline: 1.15, energie: 1.112 } },
  banquetBienfaisance: { nom: 'Le banquet de bienfaisance', ico: '🥘', rarete: 'commune', duree: 4, texte: 'Mille deux cents convives, et un discours de dix-sept minutes.', effet: { finition: 1.06, energie: 1.3 } },
  naming: { nom: 'Le nom de l\'aréna vendu', ico: '🪪', rarete: 'rare', duree: 12, texte: 'Un généreux commanditaire s\'est offert. Le vestiaire a été repeint.', effet: { volume: 1.06, finition: 1.09, defense: 0.94 }, gain: 20 },
  droitsTele: { nom: 'Les nouveaux droits télé', ico: '📽️', rarete: 'rare', duree: 10, texte: 'Le contrat est signé. Le propriétaire dit « en toute humilité ».', effet: { finition: 1.09, defense: 0.91, energie: 0.82 }, gain: 25 },

  // ---- Les agents ----
  agentLobby: { nom: 'L\'agent dans le lobby', ico: '🤵', rarete: 'peu', duree: 5, texte: 'Il attend depuis midi, avec une chemise et un cartable.', effet: { finition: 1.049, discipline: 1.147 } },
  appelTard: { nom: 'L\'appel de onze heures du soir', ico: '🌙', rarete: 'commune', duree: 4, texte: 'Il voulait seulement « prendre des nouvelles du dossier ».', effet: { finition: 1.06, energie: 1.24 } },
  prolongationRefusee: { nom: 'La prolongation refusée', ico: '🙅', rarete: 'maudite', duree: 8, texte: 'Un joueur de premier plan préfère « voir ce qui se présente ».', effet: { volume: 0.925, finition: 0.888, discipline: 1.3 } },
  contreOffre: { nom: 'La contre-offre', ico: '📎', rarete: 'peu', duree: 6, texte: 'Quatre pages, deux annexes, et un pourcentage du prix des hot-dogs.', effet: { finition: 1.112, discipline: 1.188 } },
  clauseCachee: { nom: 'La clause cachée', ico: '🪬', rarete: 'peu', duree: 7, texte: 'Découverte à la page onze, sous un astérisque.', effet: { finition: 0.925, discipline: 0.812 } },
  agentRire: { nom: 'L\'agent qui rit', ico: '🤣', rarete: 'commune', duree: 4, texte: 'Il a trouvé notre première offre très drôle.', effet: { finition: 0.94, energie: 1.18 } },
  jeuneProdige: { nom: 'Le jeune prodige sous contrat', ico: '🧒', rarete: 'rare', duree: 12, texte: 'Dix-huit ans, aucun agent, et une cote qui n\'a pas encore été inventée.', effet: { volume: 1.09, finition: 1.09, discipline: 0.88 } },

  // ---- Les partisans ----
  chantsGradins: { nom: 'Le chant des gradins', ico: '🪗', rarete: 'peu', duree: 6, texte: 'Quatre mille voix, une seule mélodie et peu de justesse.', effet: { volume: 1.093, discipline: 1.075 } },
  banderole: { nom: 'La banderole de la section 112', ico: '🚩', rarete: 'peu', duree: 5, texte: 'Quarante mètres de toile, et une faute d\'orthographe.', effet: { finition: 1.075, defense: 1.037 } },
  clubDesAmis: { nom: 'Le club des partisans de longue date', ico: '🧣', rarete: 'peu', duree: 8, texte: 'Ils n\'ont pas manqué un match depuis la présidence précédente.', effet: { volume: 1.075, discipline: 0.812 } },
  partisanAvion: { nom: 'Le partisan de l\'avion', ico: '🧑‍✈️', rarete: 'commune', duree: 4, texte: 'Il a voyagé neuf heures pour s\'asseoir derrière le banc adverse.', effet: { discipline: 1.12, energie: 0.82 } },
  petitionFiltre: { nom: 'La pétition du filtre', ico: '📃', rarete: 'commune', duree: 6, texte: 'Dix mille signatures pour demander un nouveau système de ventilation.', effet: { volume: 0.94, energie: 0.76 } },
  tifo: { nom: 'Le tifo géant', ico: '🏳️', rarete: 'peu', duree: 4, texte: 'Déployé avant la mise au jeu. Il couvre une section entière.', effet: { finition: 1.12, defense: 0.925 } },
  loterieMoitie: { nom: 'Le tirage moitié-moitié', ico: '🎠', rarete: 'commune', duree: 4, texte: 'Le gagnant a donné sa part au club de pétanque.', effet: { finition: 1.06, energie: 0.82 } },

  // ---- Les voyages ----
  autobusPanne: { nom: 'L\'autobus en panne', ico: '🛞', rarete: 'commune', duree: 4, texte: 'Trois heures au bord de l\'autoroute, à regarder passer des camions.', effet: { discipline: 0.865, energie: 1.315 } },
  volRetarde: { nom: 'Le vol retardé', ico: '🛬', rarete: 'commune', duree: 3, texte: 'Atterri à l\'aube, entraîné à midi, couché à midi et quart.', effet: { volume: 0.925, energie: 1.3 } },
  tournoiNeige: { nom: 'La route enneigée', ico: '🛣️', rarete: 'commune', duree: 4, texte: 'Le chauffeur a dit « ça va bien aller » pendant deux cents kilomètres.', effet: { discipline: 0.865, energie: 1.225 } },
  frontiere: { nom: 'La fouille à la frontière', ico: '🛂', rarete: 'commune', duree: 3, texte: 'Un douanier compte les bâtons, un par un, avec application.', effet: { finition: 1.06, energie: 1.24 } },
  hotelPiscine: { nom: 'L\'hôtel avec piscine', ico: '🏊', rarete: 'peu', duree: 5, texte: 'Quarante-cinq minutes de longueurs, le matin du match.', effet: { blessure: 0.5, energie: 0.775 } },
  fuseaux: { nom: 'Les fuseaux horaires', ico: '🌐', rarete: 'peu', duree: 6, texte: 'La collation de dix heures se prend à sept heures, selon le coach.', effet: { finition: 1.075, energie: 1.225 } },

  // ---- La météo ----
  verglas: { nom: 'La pluie verglaçante', ico: '🚗', rarete: 'commune', duree: 3, texte: 'Le stationnement est une patinoire. Les joueurs y glissent avec aisance.', effet: { discipline: 0.865, energie: 1.225 } },
  brouillardGlace: { nom: 'Le brouillard sur la glace', ico: '🌫️', rarete: 'commune', duree: 3, texte: 'On voit mal la rondelle, mais on la sent.', effet: { volume: 0.888, defense: 0.925 } },
  panneCourant: { nom: 'La panne de courant', ico: '🔌', rarete: 'commune', duree: 3, texte: 'Une demi-heure de pénombre, puis le match reprend comme si de rien n\'était.', effet: { finition: 0.962, discipline: 0.85 } },
  poudrerie: { nom: 'La poudrerie', ico: '🌬️', rarete: 'peu', duree: 4, texte: 'Les estrades sont à moitié vides ; les présents sont d\'une loyauté exemplaire.', effet: { volume: 1.083, energie: 1.165 } },
  douxMatin: { nom: 'Le doux matin de février', ico: '🌤️', rarete: 'peu', duree: 5, texte: 'Quinze degrés. Le coach laisse le chandail à la maison.', effet: { finition: 1.06, energie: 0.7 } },

  // ---- Les blessures et le soigneur ----
  physioNouveau: { nom: 'Le physio recruté', ico: '🧑‍⚕️', rarete: 'peu', duree: 8, texte: 'Une moyenne de retour au jeu de dix-neuf jours, selon son propre rapport.', effet: { blessure: 0.513, energie: 0.925 } },
  piscineThera: { nom: 'La piscine thérapeutique', ico: '🦭', rarete: 'peu', duree: 6, texte: 'Les blessés y marchent en rond avec un sérieux total.', effet: { volume: 0.94, blessure: 0.35 }, gestes: { soin: 2, tousLesBlesses: true } },
  bandageSerre: { nom: 'Le bandage trop serré', ico: '🧵', rarete: 'maudite', duree: 5, texte: 'Un joueur revient trop vite. Le soigneur répond d\'un haussement d\'épaules.', effet: { finition: 1.06, blessure: 1.75 } },
  testSang: { nom: 'La prise de sang de routine', ico: '🔬', rarete: 'commune', duree: 3, texte: 'Les résultats sont corrects, sauf les vôtres.', effet: { blessure: 0.5, energie: 1.075 } },
  imagerie: { nom: 'La résonance magnétique', ico: '🩻', rarete: 'commune', duree: 4, texte: 'Un joueur y reste quarante minutes et sort en parfaite santé.', effet: { volume: 0.94, blessure: 0.5 }, gestes: { soin: 1, tousLesBlesses: true } },
  retourPrecoce: { nom: 'Le retour prématuré', ico: '🦿', rarete: 'peu', duree: 5, texte: 'Le blessé a dit « je me sens bien » trois fois. Il n\'a pas été cru.', effet: { finition: 1.075, blessure: 1.75 }, gestes: { soin: 3, tousLesBlesses: true } },

  // ---- Le repêchage, l'échéance, le camp, la fin ----
  tableRepechage: { nom: 'La table de repêchage', ico: '🔖', rarete: 'commune', duree: 5, texte: 'Le recruteur en chef a quatre listes, et trois sont à jour.', effet: { finition: 0.955, discipline: 0.865 } },
  loterieRepechage: { nom: 'La loterie du repêchage', ico: '🎱', rarete: 'peu', duree: 4, texte: 'Un tirage de boules de ping-pong, supervisé par un comptable.', effet: { volume: 1.075, finition: 1.075, energie: 1.112 } },
  veilleEcheance: { nom: 'La veille de l\'échéance', ico: '🫣', rarete: 'peu', duree: 5, texte: 'Tout le monde fixe son téléphone, même pendant la pratique.', effet: { volume: 1.112, finition: 0.925 } },
  silenceEcheance: { nom: 'Le silence de l\'échéance', ico: '🔕', rarete: 'commune', duree: 3, texte: 'Le téléphone n\'a pas sonné. C\'est une nouvelle en soi.', effet: { discipline: 0.85, energie: 1.075 } },
  campEntrainement: { nom: 'La journée des tests physiques', ico: '⛰️', rarete: 'peu', duree: 6, texte: 'Chaque joueur est mesuré, pesé et classé sur une feuille de calcul.', effet: { energie: 1.24, robustesse: 1.3 } },
  campFlechettes: { nom: 'Le camp de la relève', ico: '🌲', rarete: 'peu', duree: 8, texte: 'Quarante espoirs, un seul filet, et une patience de moine.', effet: { volume: 1.112, finition: 0.962, energie: 1.15 } },
  dernierSprint: { nom: 'Le dernier droit', ico: '🚦', rarete: 'rare', duree: 10, texte: 'Douze matchs, une seule consigne, et un tableau qui ne ment pas.', effet: { volume: 1.09, finition: 1.09, defense: 0.91, energie: 1.15 } },
  bilanFinSaison: { nom: 'Le bilan de fin de saison', ico: '🪫', rarete: 'peu', duree: 5, texte: 'Trente minutes de diapositives. Une seule était lisible.', effet: { finition: 0.962, discipline: 0.812 } },
  cercleVertueux: { nom: 'Le cercle vertueux', ico: '🎡', rarete: 'commune', duree: 5, texte: 'Les vétérans montrent aux jeunes où se trouve le chemin du retour.', effet: { defense: 0.962, discipline: 0.85 } },

  // ---- Nouveaux événements (ajouts pour plus de variété) ----
  zamboniEnFeu: { nom: 'La surfaceuse en feu', ico: '🔥', rarete: 'peu', duree: 5, texte: 'Le conducteur a sauté juste à temps. La glace fond.', effet: { volume: 0.9, defense: 0.9, energie: 0.85 } },
  chienMascotte: { nom: 'Le chien mascotte', ico: '🐶', rarete: 'commune', duree: 6, texte: 'Il court sur la glace pendant la pratique. Tout le monde sourit.', effet: { finition: 1.05, discipline: 0.85 } },
  alarmeIncendie: { nom: 'L\'alarme incendie à l\'hôtel', ico: '🚨', rarete: 'peu', duree: 4, texte: 'Trois heures du matin, dans la neige, en pyjama.', effet: { energie: 1.25, defense: 0.95 } },
  equipementEgare: { nom: 'L\'équipement égaré', ico: '📦', rarete: 'maudite', duree: 5, texte: 'Les sacs sont à Calgary, l\'équipe est à Boston.', effet: { finition: 0.9, energie: 1.2, discipline: 1.3 } },
  commanditaireFuit: { nom: 'Le commanditaire qui fuit', ico: '🏃', rarete: 'maudite', duree: 8, texte: 'Un chèque qui rebondit. Le proprio hurle dans les couloirs.', effet: { finition: 0.92, discipline: 1.2 } },
  recrueRecord: { nom: 'La séquence de la recrue', ico: '🔥', rarete: 'rare', duree: 10, texte: 'Huit matchs de suite avec un point. Les vétérans la vouvoient.', effet: { volume: 1.08, finition: 1.1, energie: 1.15 } },
  gastroLocaux: { nom: 'La gastro des locaux', ico: '🤢', rarete: 'maudite', duree: 5, texte: 'Personne n\'ose toucher les poignées de porte.', effet: { blessure: 1.6, energie: 1.3 } },
  fuiteToit: { nom: 'La fuite dans le toit', ico: '💧', rarete: 'commune', duree: 4, texte: 'Un seau au milieu de la patinoire pendant la pratique.', effet: { volume: 0.95, defense: 0.92 } },
  repasEmpoisonne: { nom: 'L\'intoxication alimentaire', ico: '🦞', rarete: 'maudite', duree: 3, texte: 'Le poulet de l\'avion n\'était pas assez cuit.', effet: { blessure: 1.4, energie: 1.4, finition: 0.85 } },
  nouveauContratTv: { nom: 'Le contrat de diffusion', ico: '📺', rarete: 'peu', duree: 8, texte: 'Des caméras partout, même près du banc. On joue pour la galerie.', effet: { finition: 1.07, discipline: 1.2 } },
  volAnnule: { nom: 'Le vol annulé', ico: '🚫', rarete: 'peu', duree: 4, texte: 'Une nuit sur les chaises de l\'aéroport.', effet: { energie: 1.3, discipline: 0.85 } },
  casseTeteVestiaire: { nom: 'Le casse-tête du vestiaire', ico: '🧩', rarete: 'commune', duree: 10, texte: 'Mille pièces. Ça prend toute l\'attention entre les périodes.', effet: { discipline: 0.75, finition: 0.95 } },
  vieuxRival: { nom: 'Le retour du vieux rival', ico: '🦹', rarete: 'peu', duree: 5, texte: 'Ils ont signé notre ancien bourreau. Le sang bout.', effet: { robustesse: 1.6, discipline: 1.35, finition: 1.05 } },
  microCache: { nom: 'Le micro caché', ico: '🎤', rarete: 'maudite', duree: 7, texte: 'Un journaliste a enregistré les cris du coach.', effet: { finition: 0.88, discipline: 1.25 } },
  soireeRetro: { nom: 'La soirée rétro', ico: '📻', rarete: 'commune', duree: 4, texte: 'Chandails en laine, pantalons longs, on a trop chaud.', effet: { energie: 1.15, defense: 0.95 } },
  erreurHymne: { nom: 'L\'erreur dans l\'hymne', ico: '🎶', rarete: 'commune', duree: 3, texte: 'Le chanteur a oublié les paroles, le public a fini pour lui.', effet: { finition: 1.05, discipline: 0.9 } },
  coupureCourant: { nom: 'La coupure pendant les tirs', ico: '💡', rarete: 'peu', duree: 3, texte: 'Le match s\'est fini à la lueur des téléphones.', effet: { volume: 0.9, defense: 0.9 } },
  entraineurSuspendu: { nom: 'L\'entraîneur suspendu', ico: '⚖️', rarete: 'peu', duree: 5, texte: 'L\'adjoint prend la relève, il bégaie.', effet: { finition: 0.95, defense: 0.9, discipline: 1.1 } },
  visitePolitique: { nom: 'La visite du maire', ico: '🏛️', rarete: 'commune', duree: 4, texte: 'Des discours et des poignées de main moites.', effet: { discipline: 1.1, energie: 1.1 } },
  superstitionEtrange: { nom: 'La superstition du gardien', ico: '👽', rarete: 'peu', duree: 8, texte: 'Il ne parle plus aux poteaux, il leur murmure.', effet: { defense: 0.9, discipline: 1.15 } },
  bagarreBanc: { nom: 'La bagarre au banc', ico: '🥊', rarete: 'maudite', duree: 6, texte: 'Entre nos propres joueurs. L\'ambiance est lourde.', effet: { finition: 0.85, discipline: 1.4, energie: 1.1 } },
  retourLegende: { nom: 'La visite de la légende', ico: '👴', rarete: 'rare', duree: 7, texte: 'Il a passé une heure dans le vestiaire à raconter sa Coupe.', effet: { finition: 1.08, defense: 0.9, discipline: 0.8 } },
  debutantBut: { nom: 'Le premier but du débutant', ico: '🐣', rarete: 'commune', duree: 5, texte: 'La rondelle est dans une vitrine, tout le monde est joyeux.', effet: { finition: 1.06, discipline: 0.9 } },
  greveZamboni: { nom: 'La grève des surfaceuses', ico: '🪧', rarete: 'peu', duree: 6, texte: 'On joue dans deux pouces de neige artificielle.', effet: { volume: 0.85, defense: 0.85, energie: 1.2 } },
  miracleGlace: { nom: 'Le miracle sur glace', ico: '✨', rarete: 'rare', duree: 10, texte: 'On a remonté quatre buts en troisième. L\'équipe y croit.', effet: { finition: 1.15, defense: 0.88, energie: 1.2 } },

};
