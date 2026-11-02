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

js/game.js            le contrôleur : l'état G, render(), le démarrage, la sauvegarde, les sections et l'en-tête, l'historique
js/repechage.js       la roulette, le vestiaire et le loto, la signature, la barre du plafond, le bassin de cartes
js/joueurs.js         l'onglet Joueurs : l'effectif en tableau triable (jambes, saison à ce jour ou vraie saison, salaire) ; en Rogue, son filtre 🩹 est l'infirmerie
js/alignement.js      les cases, les trios et les paires, leur affinité, le filet du soir, le résumé d'équipe
js/fiche.js           la fiche d'un joueur : recto verso, ses rôles, l'impact, le profil mesuré
js/banc.js            derrière le banc : les décisions en saison, le ballottage, l'écran de saison
js/partie.js          l'écran « Nouvelle partie » (le brouillon)
js/rogue-jeu.js       le Rogue à l'écran : jetons, boutique, packs, inventaire, départ, la run
js/modes-table.js     le tournoi Sur table, ses règles, son bilan, le match d'exhibition au plateau
js/charge-table.js    charge le mode Sur table à la demande (table, tournoi, plateau) : MT.nom, chargerTable()
js/sim.js             l'alignement, le moteur de match, la ligue au jour le jour, les séries ; tout son hasard passe par hasard()
js/ratings.js         les cotes (partagé navigateur + build) : sous-cotes, valeur, salaire, rôles, zones
js/data.js            le chargeur trois niveaux (shard, API, seed) et le cache IndexedDB
js/util.js            les petits outils partagés (un seul exemplaire de chaque : `esc`, `money`, `virgule`, `ordF`…)
js/saison.js          l'écran de saison et des séries : le Bureau (À faire, où les choix se règlent ; hier soir ; ton plan ; le journal), Ligue › Classement (un club s'y ouvre) et Calendrier
js/gerant.js          les choix, le dépistage, l'écran du duel (`ouvrirDuel`, ce que ton adjoint propose)
js/bilan.js           le bilan de saison : onglets, palmarès, calendrier, séries
js/coquille.js        la coquille fixe : l'écran de saison inscrit ses volets auprès des sections
js/pile.js            le retour, un niveau à la fois : Échap, bouton B, retour Android, « ‹ Retour »
js/glisser.js         les gestes du doigt : balayer d'un onglet à l'autre (l'onglet où l'on va sort du bord), tirer une fenêtre vers le bas pour la fermer
js/manette.js         la manette et le clavier : le focus au voisin, l'anneau lumineux, les invites
js/direct.js          un match en direct, rejoué depuis sa feuille
js/glace.js           la patinoire où les tirs apparaissent : la position d'un tir (illustrative) lue de la feuille — le danger, les icônes du tireur, l'accord de son trio, le texte du sommaire — `check_glace`
js/commentaire.js     le commentateur du direct
js/recit.js           les mots du sommaire d'un match
js/apres-match.js     le récit d'après-match, comme à la télé : le fil du match, sobre et précis
js/panel-tv.js        le panel : l'univers médiatique de la saison, les mêmes visages qui reviennent
js/scenes.js          les scènes des choix du Rogue : qui demande, le fait déjà joué, sa réplique sans chiffre — `check_clarte` § 5
js/vie-gm.js          les voix (`EXPEDITEURS`), le joueur du fait, les fils dits par quelqu'un, les choix des fils (`CHOIX_DES_FILS`, récrits à la V22 : deux réponses, un suivi) — `check_vie`
js/arcs.js            les arcs d'un joueur et ses défis (`DEFIS`) : nés d'un fait du journal du club, suivis au Vestiaire ; la table `ARCS` est vide depuis la V22, le système reste — `check_arcs`
js/verdicts.js        ta semaine : le verdict d'un choix à effet daté, le lundi d'après, en vraies stats — `check_verdicts`
js/profil-style.js    le profil de style : la preuve que ton build joue, lue dans les feuilles — `check_profil`
js/causes.js          ce qui a fait le match : les causes qui ont décidé d'un lancer, dites à ton club (sommaire, direct, bilan)
js/entracte.js        le rapport d'entracte en cartons
js/pronostic.js       le dépistage d'avant-match
js/impact.js          l'impact en chiffres de match : ce que le moteur joue, dit pour ton club (« ≈ +1,2 tir par match »), jamais en « % » ; partagé navigateur + Node
js/equipes.js         l'écran des équipes et leurs vraies statistiques
js/combat.js          la main de l'adversaire d'un gros match qui n'est pas un duel (le 82-0) ; ta main est partie (V13-2)
js/pouvoirs.js        le coach, un personnage (V21) : son niveau, ses trois pouvoirs par période, ses talents — `check_pouvoirs`
js/coachs-reels.js    l'entraîneur, une vraie carte de coach-saison (V21) : data/coachs.json, sa philosophie lue des vraies stats de son club, sa maîtrise, le loto du départ (ton cartable d'abord)
js/adjoints.js        sa main d'adjoints (V22) : des cartes, un style chacune (un gain, un prix), postées pour un séjour de 12 matchs puis au repos ; une main de quatre, les cases en poste au niveau du coach ; un parmi trois aux moments forts — `check_pouvoirs`
js/deposer.js         le glisser-déposer, souris et doigt (l'appui tenu) : une carte d'adjoint sur une case au Bureau › Coach, les cartes des Lignes (`permuter`)
js/dossiers.js        les histoires de la semaine (V10 ; récrites à la V22, docs/refonte-v22.md) : ce qui arrive à ton club, dit par sa voix, un lundi sur deux, deux réponses concrètes — `check_dossiers`
js/cartes.js          le gabarit des cartes (recto, verso, finitions)
js/rarete.js          les variantes de carte et leur bonus
js/lexique.js         le lexique : un mot par idée (coach, entraîneur, adjoint, vestiaire, classeur…) et les icônes réservées — `check_lexique`
js/galons.js          les galons d'une saison de Rogue (40 buts, 50 passes…), lus dans le journal du club
js/banque.js          la banque de cartes : les retouches et les cartes rares qui montent ou soignent
js/coachs.js          les coachs : huit philosophies, leur identité, la couleur d'un joueur lue sur ses rôles
js/packs.js           les packs de joueurs et de cartes, leurs taux
js/niveaux.js         le niveau d'un joueur dans sa saison : Soutien → Phénomène
js/inventaire.js      l'inventaire : les cartes de la partie, les paliers de la saison et la revente
js/magasin.js         la boutique
js/rogue.js           le mode Rogue : jetons, mandat, déblocages, jalons
js/club.js            ton club : les noms, les couleurs et les écussons qui se débloquent, le choix porté
js/depart.js          le départ d'une run (le classeur)
js/cartable.js        le cartable des joueurs gagnés
js/ballottage.js      le ballottage, en fonction pure (Node et navigateur)
js/visages.js         l'application Android : télécharge et recadre les visages sur l'appareil
js/recadrage.js       le recadrage d'un portrait (partagé par scripts/portraits.mjs et js/visages.js)
js/actions.js         les photos d'action : actionSrc(id, saison, club) pour une carte, celle de sa saison d'abord ; l'appareil Android les télécharge et les recadre
js/recadrage-action.js le recadrage 5:7 d'une photo de match (partagé par scripts/actions.mjs et js/actions.js)
js/identites.js       l'identité de départ
js/traits.js          les traits, tirés des votes de data/trophees.js
js/roles_ref.js       la référence des rôles
js/franchises.js      les franchises et leurs relocalisations
js/logos.js, js/logos_locaux.js   couleurs et écussons des 44 franchises
js/menu.js            l'écran titre, et le même écran en menu pause en pleine partie
js/mise-a-jour.js     la mise à jour : la version Web (GitHub Pages) suit toute seule ce qu'on publie (`surveillerLaVersion` : le sw.js du serveur relu au démarrage, au retour dans l'application et toutes les 10 min ; plus récent, la coquille neuve et un rechargement au titre ou au retour), le stockage (les parties) jamais touché ; dans l'APK et l'exe, la dernière release GitHub (.github/workflows/publier.yml) offre son fichier — `check_maj`
js/version.js         la version du code qui tourne, la même que `VERSION` de sw.js : les deux montent ensemble — `check_maj`
js/sauvegardes.js     les parties sauvegardées, et leur export en fichier transférable, importé au menu — `check_sauvegardes`
js/mouvement.js       les chiffres qui se comptent
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
                      verdict.mjs (le juge partagé), lib/ (mort.mjs la mesure du code mort, rogue_sim.mjs la run jouée par un robot…) ;
                      la liste complète : docs/structure-detaillee.md
mobile/, desktop/     l'APK (Capacitor) et l'exe (Electron) ; seul leur code est versionné ; leur version est celle de sw.js (build.gradle la lit), et .github/workflows/publier.yml les fabrique et les publie en release à chaque version neuve sur main (l'APK signé par les secrets CAP82_KEYSTORE_B64 et CAP82_KEYPASS)
mobile/assembler-www.mjs  www/ de l'APK : sans data/salaries ni data/seed.json, JS regroupé en lots et minifié,
                      CSS minifié (esbuild, devDependency de mobile/ seulement ; --brut pour s'en passer),
                      cartes de sources à côté dans www-cartes/ ; la liste hors ligne de sw.js est réécrite
docs/                 l'historique et la référence (voir docs/README.md)
```
