# La structure du dépôt, une ligne par fichier

La version courte, sortie de `CLAUDE.md` le 2 novembre 2026 ; la version longue est dans `structure-detaillee.md`. Un fichier neuf y prend sa ligne.

```
index.html            la page unique : l'en-tête du club, les sections, roulette, vestiaire, alignement, modales
style.css             tous les styles, une seule feuille écrite dans l'ordre des écrans (docs/refonte-ui.md), mobile d'abord (390 px), le rail dès 1000 px
sw.js                 travailleur de service : la coquille hors ligne (FICHIERS), les visages en cache
site.webmanifest, favicon.svg, icon-*.png   installation et icônes
fonts/                Barlow Condensed, Manrope, Noto Emoji et les polices des séries de cartes (OFL, fonts/POLICES.txt), hébergées ici
data/                 shards par saison (seasons/), index, seed, portraits.json, salaires, trophées, réputations
img/logos, img/mugs   écussons des 44 franchises et visages recadrés (scripts/logos.mjs, scripts/portraits.mjs)
img/actions           photos de match recadrées en 5:7, la face au centre (≈ 170 Mo, versionnées depuis oct. 2026 ; scripts/actions.mjs refait celles de la LNH, scripts/actions_commons.mjs les photos libres de Commons et d'Openverse, créditées au dos, scripts/actions_saisons.mjs une photo par saison, {id}-{saison}.webp ; scripts/actions_couchees.mjs les photos couchées, de la LNH comme de Commons, couchees/{clé}.webp, pour les cartes horizontales ; data/actions.json les liste)

js/game.js            le contrôleur : l'état G, render(), le démarrage (l'ancien Rogue soldé au passage), la sauvegarde, les sections et l'en-tête, l'historique, les blessés du jour (`blessesAuJour`)
js/repechage.js       la roulette, le vestiaire et le loto, la signature, la barre du plafond, le bassin de cartes
js/joueurs.js         l'onglet Joueurs : l'effectif en tableau triable (jambes, saison à ce jour ou vraie saison, salaire), les blessés marqués 🩹
js/alignement.js      les cases, les trios et les paires, leur affinité, le filet du soir, le résumé d'équipe
js/fiche.js           la fiche d'un joueur : recto verso, ses rôles, l'impact, le profil mesuré
js/banc.js            la saison du 82-0 : la ligue se crée, joue ses 82 matchs d'un coup, le bilan se compose ; une partie reprise se rejoue de sa graine (le jour à jour est parti avec l'ancien Rogue)
js/partie.js          l'écran « Nouvelle partie » (le brouillon)
js/run.js             la run en carte de la V28, son cœur pur : l'état, la carte de l'acte, les portes, le plafond, les matchs isolés, le marché, le vestiaire, les histoires, les séries ; joué tel quel par les robots
js/run-scenes.js      les scènes de la run, des fonctions pures (S, V) → HTML d'un plan de 390 × 844 (docs/maquettes/v28-ecrans.html)
js/run-jeu.js         la coquille de la run : #runModal, l'échelle, la sauvegarde cap82_run, les gestes, les temps forts
js/modes-table.js     le tournoi Sur table, ses règles, son bilan, le match d'exhibition au plateau
js/charge-table.js    charge le mode Sur table à la demande (table, tournoi, plateau) : MT.nom, chargerTable()
js/sim.js             l'alignement, le moteur de match, la ligue au jour le jour, les séries ; tout son hasard passe par hasard() ; il n'importe aucun module du Rogue
js/greffes.js         les greffes du Rogue sur le moteur (V25) : le coach, son banc de cinq pièces et leurs relais, leur coach en séries, le duel en trois périodes, la porte des histoires (`appliquerChoix`) et leurs promesses (`promettre`, `verdictsDuMatin`) — branchées par `brancherGreffes`
js/ratings.js         les cotes (partagé navigateur + build) : sous-cotes, valeur, salaire, rôles, zones
js/data.js            le chargeur trois niveaux (shard, API, seed) et le cache IndexedDB
js/util.js            les petits outils partagés (un seul exemplaire de chaque : `esc`, `money`, `virgule`, `ordF`, `SEMAINE`…) et la seule source du hasard (V25 A2 : `generateur`, `gauss`, `entierDeGraine`, `hache`)
js/saison.js          l'écran des séries du 82-0 (`ouvrirSeries` : ta série, le tableau, la ronde, les meneurs, les équipes ; « Regarder le match ») et la saison lue sur ses feuilles (`saisonDesFeuilles`) ; le Bureau, sa boîte et le jour à jour sont partis avec l'ancien Rogue (V28, tranche 4)
js/gerant.js          une décision en plein écran (`ouvrirChoix` : « Comment on joue », ton identité, « Quitter le match ? »), chaque option une carte de jeu (V25 B2) ; les mots d'un joueur (ses badges, sa carrure, la courbe de ses jambes, le résumé des lignes)
js/bilan.js           le bilan de saison : onglets, palmarès, calendrier, séries
js/coquille.js        la coquille fixe : les écrans de `#hubModal` (les séries, le tournoi) inscrivent leurs volets auprès des sections
js/pile.js            le retour, un niveau à la fois : Échap, bouton B, retour Android, « ‹ Retour »
js/glisser.js         les gestes du doigt : balayer d'un onglet à l'autre (l'onglet où l'on va sort du bord), tirer une fenêtre vers le bas pour la fermer
js/manette.js         la manette et le clavier : le focus au voisin, l'anneau lumineux, les invites
js/direct.js          un match en direct, rejoué depuis sa feuille
js/glace.js           la patinoire où les tirs apparaissent : la position d'un tir (illustrative) lue de la feuille — le danger, les icônes du tireur, l'accord de son trio, le texte du sommaire — `check_glace`
js/commentaire.js     le commentateur du direct
js/recit.js           les mots du sommaire d'un match, d'une série et d'une blessure (V25 A1 : sortis de sim.js), les fils de la saison (`filsDeSaison`)
js/apres-match.js     le récit d'après-match, comme à la télé : le fil du match, sobre et précis
js/panel-tv.js        le panel : l'univers médiatique de la saison, les mêmes visages qui reviennent
js/vie-gm.js          les voix (`EXPEDITEURS`) et le joueur du fait (`joueurDuFait`) — `check_vie`
js/profil-style.js    le profil de style : la preuve que ton build joue, lue dans les feuilles (au bilan) — `check_profil`
js/causes.js          ce qui a fait le match : les causes qui ont décidé d'un lancer, dites à ton club (sommaire, direct, bilan)
js/entracte.js        le rapport d'entracte en cartons
js/pronostic.js       la chance d'un soir isolé (`chanceDUnSoir`) : le match rejoué des dizaines de fois par le vrai moteur, sans rien toucher ; la jauge de la feuille du soir de la run — `check_pronostic`
js/impact.js          l'impact en chiffres de match : ce que le moteur joue, dit pour ton club (« ≈ +1,2 tir par match »), jamais en « % » ; les mots d'un effet, d'une mutation, des totaux et de la pénalité de position (V25 A1 : sortis de sim.js) ; les plans du duel (`plansDuDuel`) et les lignes d'une pièce (`lignesDeLaPiece`) ; partagé navigateur + Node
js/equipes.js         l'écran des équipes et leurs vraies statistiques
js/pieces.js          le banc de cinq (V27, tranche 5) : la famille *PIECES* (les pouvoirs et les adjoints d'avant), la pièce de départ du coach, le banc pur, le jeu d'une période et de la soirée, le relais, les pièces « pour le battre » (`piecesContre`), leur coach en séries (`persoAdverse`) — `check_pouvoirs`, `check_relais`
js/coachs-reels.js    l'entraîneur, une vraie carte de coach-saison (V21) : data/coachs.json, sa philosophie lue des vraies stats de son club, sa maîtrise, le loto du départ (ton cartable d'abord)
js/deposer.js         le glisser-déposer, souris et doigt (l'appui tenu) : les cartes des Lignes (`permuter`, js/alignement.js)
js/histoires.js       la banque des histoires (V25 C1, docs/refonte-v25-c1.md) : quarante, à trois moments (le lundi, le gros match, la ronde), un tirage pur (`tirer`), la scène qui nomme (`sceneDe`), la mémoire de la run (`memoireDeLaRun`) ; la run en carte y tire sa case d'histoire, dans celles du lundi (`histoireDeLaCase`, js/run.js) — `check_histoires`
js/faits.js           les faits (V25 C1) : `faitsDe`, une seule lecture pure des feuilles jouées et du journal du club (avec une ligue, son classement et sa cédule connue ; la run en carte la lit sans ligue, sur tes matchs joués), pour l'écran, le moteur et les robots ; la vraie saison avec ses bornes (`vraie`, `vraieMot`) — `check_vie`
js/cartes.js          le gabarit des cartes (recto, verso, finitions) ; une carte de jeu porte un niveau (V25 B1) ; la carte d'une pièce de banc (`carteDePiece`) ; la pochette scellée (`pochetteHtml`)
js/effets.js          la grammaire d'un effet (V25 B1b) : neuf cases, et `motsDe` qui dérive les lignes d'une carte de ce que le moteur joue
js/rarete.js          les éditions d'une carte de joueur (Base → Holo) et leurs paliers
js/lexique.js         le lexique : un mot par idée (coach, entraîneur, adjoint, vestiaire, classeur…) et les icônes réservées — `check_lexique`
js/banque.js          la banque de cartes d'avant : les retouches de l'atelier et les cartes rares (trois soins, l'échange d'un doublon), que la run en carte ne tire pas ; `plafondDe`, le plafond des vieilles parties
js/coachs.js          les coachs : huit philosophies, leur identité, la règle de chacun (`REGLES_DU_COACH`), la couleur d'un joueur lue sur ses rôles
js/packs.js           les packs de joueurs, leurs niveaux et leurs taux (`TIERS`, `tirerJoueursDuPack`) : huit définis, la run en carte en ouvre deux en pochettes à son marché (le Bronze, l'Époque) — `check_packs`
js/niveaux.js         le niveau d'un joueur dans sa saison : Soutien → Phénomène ; ses cotes sur 20 (`axes20`, `cote20`), lues par la fiche, Sur table et Sur glace
js/rogue.js           le méta du Rogue (`cap82_rogue`) : les médailles 🏅 payées une fois (`payerEcussons`), le prestige (`PRESTIGES`), les tables des déblocages et des exigences (elles attendent la V28, tranche 5), le départ d'une run (les bouche-trous, les jetons), ce que la règle du coach lit dans une feuille (`chiffresDuSoirDe`), la ligue habillée (`habillerLaLigue`), l'ancien Rogue soldé (`solderLAncienRogue`)
js/actes.js           ce que la run lit d'un acte et d'un club, en fonctions pures : les médailles d'un acte (`MEDAILLES_ACTE`), le prix d'une pièce (`PRIX_PIECE`), la récompense d'une élite et ce qu'elle coûte perdue, le jeu d'un club lu dans ses vraies stats (`jeuDuRival`) et son intention dominante (`dominanteDe`) — `check_elites`
js/club.js            ton club : les noms, les couleurs et les écussons, cosmétiques, et le choix porté (`appliquerClub`) ; où ils se gagnent se réécrit avec la méta (V28, tranche 5)
js/cartable.js        le cartable : tes cartes de joueur d'une partie à l'autre, les doublons qui montent une carte (`monterLesDoublons`), tes entraîneurs (`coachAuCartable`)
js/recadrage.js       le recadrage d'un portrait (scripts/portraits.mjs le lit)
js/actions.js         les photos d'action : actionSrc(id, saison, club) pour une carte, celle de sa saison d'abord (img/actions)
js/recadrage-action.js le recadrage 5:7 d'une photo de match (scripts/actions.mjs le lit)
js/identites.js       l'identité de départ
js/traits.js          les traits, tirés des votes de data/trophees.js
js/roles_ref.js       la référence des rôles
js/franchises.js      les franchises et leurs relocalisations
js/logos.js, js/logos_locaux.js   couleurs et écussons des 44 franchises
js/menu.js            l'écran titre (une carte par mode ; celle du Rogue ouvre la run en carte, « Continuer » quand une run est gardée), et le même écran en menu pause en pleine partie
js/mise-a-jour.js     la mise à jour : la version Web (GitHub Pages) suit toute seule ce qu'on publie (`surveillerLaVersion` : le sw.js du serveur relu au démarrage, au retour dans l'application et toutes les 10 min ; plus récent, la coquille neuve et un rechargement au titre ou au retour), le stockage (les parties) jamais touché — `check_maj`
js/version.js         la version du code qui tourne, la même que `VERSION` de sw.js : les deux montent ensemble — `check_maj`
js/sauvegardes.js     les parties sauvegardées (un index, une clé par partie), leur export en fichier transférable, importé au menu ; les runs de l'ancien Rogue retirées de l'index (`retirerLesRuns`) — `check_sauvegardes`
js/mouvement.js       les chiffres qui se comptent, et les paliers du jus (V23 G : `notable`, `pic` — la vibration, la secousse, les particules)
js/exhibition.js      l'exhibition
js/physique.js        Sur glace, la physique et les règles (31 oct. 2026) : la patinoire rapetissée (44,6 × 25,9 m : une zone remplit un écran 16:9), des mètres, des secondes, un pas fixe de 1/120 s, un hasard semé ; la rondelle (frottement, bande, coins, poteaux ; sa hauteur : la gravité, le rebond, la barre, la vitre, la passe soulevée), le patineur (poussée, frein, adhérence, dérive, le prix du virage, les croisés, à reculons, le turbo, l'agilité, les jambes), la lame, la passe à un coéquipier (`receveurDePasse`), le tir et le tir sur réception, la déviation, le bloc, le harpon, la mise en échec (l'élan, la chute, contre la bande ; une punition seulement sur une charge voulue), les deux gardiens (150 ms de retard, ses trous, retiré pour un sixième attaquant) ; le match (`nouveauMatch`) : les trios et les paires qui changent, la mise en jeu, le hors-jeu différé, le dégagement refusé, la punition et son avantage (à retardement, qui tombe au toucher des fautifs), le tir de punition, l'horloge, les côtés qui changent, la prolongation à trois ou à cinq en séries, les tirs de barrage, les passes décisives, les stats et les trois étoiles, deux humains (`humains`, `controles`), la difficulté (`DIFFICULTES`) ; les vrais joueurs en paramètres (`parametresDuPatineur`) ; `reglesDeLaGlace()` dit chaque chiffre — `check_physique`
js/glace-ia.js        Sur glace, l'IA des neuf autres (pure, reçue par le match) : le porteur lance, passe, patine ou fonce, les coéquipiers se placent en deçà de la bleue (des postes par zone, le parapluie en avantage), l'équipe sans rondelle chasse et tient ses postes (le 1-2-2, l'échec avant, la défense de zone à de vrais postes, trois stratégies d'équipe `STRATEGIES`, la boîte en désavantage, les défenseurs à reculons et du bon côté, la charge de face seulement), la mise en jeu, les tirs de barrage — `check_physique`
js/sur-glace.js       Sur glace, l'écran : l'affiche de deux clubs (les mêmes shards que l'exhibition ; les périodes, les règles, les séries, la difficulté, deux joueurs), le canevas vu en légère plongée (debout, on attaque vers le haut en première ; la bande, les baies vitrées, les vrais buts et les gradins se lèvent), la caméra qui suit la rondelle, le radar, les sprites 16 bits rendus par scripts/sprites/rendu.mjs (un joueur en volumes posé image par image, vu de trois quarts, rastérisé en trois tons, son contour et son ombre portée tramée ; huit directions pour le patineur, quatre pour le gardien, sans miroir ; `spriteDe` les teint aux couleurs du club), la foule et les sons de js/sons-glace.js, la glace debout partout, en 16 bits (rendue une fois à la résolution des sprites, `fondDeGlace`), toute sa largeur et une zone entière dans l'écran comme NHL 94, la foule, l'écusson des locaux au centre, le disque de ton joueur, la face à la barre du nom, le nom du porteur à la prise, le tableau et les punis, les pitons des NHL classiques à la manette (une par humain), le clavier et le doigt (les boutons changent avec la rondelle), la pause, la secousse, l'arrêt sur image, la vibration, les sons, les trois étoiles à la fin ; l'entraînement, un seul patineur
js/table.js           Sur table : le moteur du plateau et reglesDuPlateau()
js/plateau.js         Sur table : l'écran du plateau
js/tournoi.js         Sur table : le tournoi de six clubs
js/sons.js            les effets sonores synthétisés (Web Audio) ; ses briques servent js/sons-glace.js
js/sons-glace.js      Sur glace : la foule vivante (cinq couches de bruit, une intensité), le ohhh, la clameur, les huées, le tir, la bande, le poteau, le sifflet, la sirène (les patins ne font aucun son)
js/sprites.js         Sur glace : les sprites en lettres (écrit par scripts/sprites/rendu.mjs, ne pas éditer à la main)

scripts/              build des données (build_shards.py, rate.mjs, rerate.mjs, portraits.mjs, actions.mjs, recrues.mjs → data/recrues.json
                      la vraie saison recrue…), vérifications (check_*.mjs, smoke*.mjs, tout.mjs qui enchaîne les rapides), les essais à la
                      main (essai_*.mjs), calibration (calibrate_sim, mock_*, *_calibre, inferer_glace et inferer_gestes : ce que la ligue ne comptait pas),
                      verdict.mjs (le juge partagé), lib/ (mort.mjs la mesure du code mort, run_robot.mjs les robots de la run en carte…) ;
                      la liste complète : docs/structure-detaillee.md
docs/                 l'historique et la référence (voir docs/README.md)
```
