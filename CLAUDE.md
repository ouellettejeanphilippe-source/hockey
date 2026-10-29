# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs. Plusieurs modes : **le 82-0** (juste le repêchage ; la saison se simule d'un coup, les séries se regardent match par match, aucune carte), **le Rogue** (le jour à jour, le duel joué au plan que ton adjoint propose, ton personnel, la boutique, la run), **Sur table** et l'exhibition.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Où on travaille

Le Rogue, tout le temps, sauf si JP demande expressément un autre mode. Le 82-0, Sur table et l'exhibition sont faits : les stats, un peu de hasard, rien de plus. Une mesure, un équilibrage, un correctif se jugent d'abord en Rogue (`scripts/lib/rogue_sim.mjs`, `check_rogue`, `essai_rogue`).

## Avant de coder

Lis `LIVRAISON.md` — c'est le plan de travail courant vers la 1.0 : les jalons, chaque item avec son fichier, sa valeur et le script qui le prouve. Coche les cases au fur et à mesure et ajoute une ligne à son journal.

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `MOTEUR.md` — c'est la spécification de la refonte de la simulation par événements, avec les mesures qui appuient chaque choix. Si tu touches à `js/sim.js`, lis-le avant, et `docs/moteur-recalibrer.md` pour la recalibration.

`PLAN.md` garde l'état court et les décisions prises. L'histoire de chaque décision (pourquoi, ce qui a été essayé et écarté, mesuré) est dans `docs/decisions.md` ; le journal sprint par sprint dans `docs/journal/`. Avant de défaire une règle ci-dessous, lis sa décision.

## Structure

```
index.html            la page unique : l'en-tête du club, les sections, roulette, vestiaire, alignement, modales
style.css             tous les styles, une seule feuille écrite dans l'ordre des écrans (docs/refonte-ui.md), mobile d'abord (390 px), le rail dès 1000 px
sw.js                 travailleur de service : la coquille hors ligne (FICHIERS), les visages en cache
site.webmanifest, favicon.svg, icon-*.png   installation et icônes
fonts/                Barlow Condensed, Manrope, Noto Emoji et les polices des séries de cartes (OFL, fonts/POLICES.txt), hébergées ici
data/                 shards par saison (seasons/), index, seed, portraits.json, salaires, trophées, réputations
img/logos, img/mugs   écussons des 44 franchises et visages recadrés (scripts/logos.mjs, scripts/portraits.mjs)
img/actions           photos de match recadrées en 5:7, la face au centre (≈ 145 Mo, versionnées depuis oct. 2026 ; scripts/actions.mjs refait celles de la LNH, scripts/actions_commons.mjs les photos libres de Commons et d'Openverse, créditées au dos, scripts/actions_saisons.mjs une photo par saison, {id}-{saison}.webp ; scripts/actions_couchees.mjs les photos couchées, de la LNH comme de Commons, couchees/{clé}.webp, pour les cartes horizontales ; data/actions.json les liste)

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
js/saison.js          l'écran de saison et des séries : le Bureau (À faire, où les choix se règlent ; hier soir ; ton plan ; le journal), Ligue › Classement (un club s'y ouvre) et Calendrier
js/gerant.js          les choix, le dépistage, l'écran du duel (`ouvrirDuel`, ce que ton adjoint propose)
js/bilan.js           le bilan de saison : onglets, palmarès, calendrier, séries
js/coquille.js        la coquille fixe : l'écran de saison inscrit ses volets auprès des sections
js/pile.js            le retour, un niveau à la fois : Échap, bouton B, retour Android, « ‹ Retour »
js/manette.js         la manette et le clavier : le focus au voisin, l'anneau lumineux, les invites
js/direct.js          un match en direct, rejoué depuis sa feuille
js/glace.js           la patinoire où les tirs apparaissent : la position d'un tir (illustrative) lue de la feuille — le danger, les icônes du tireur, l'accord de son trio, le texte du sommaire — `check_glace`
js/commentaire.js     le commentateur du direct
js/recit.js           les mots du sommaire d'un match
js/scenes.js          les scènes des choix du Rogue : qui demande, le fait déjà joué, sa réplique sans chiffre — `check_clarte` § 5
js/causes.js          ce qui a fait le match : les causes qui ont décidé d'un lancer, dites à ton club (sommaire, direct, bilan)
js/entracte.js        le rapport d'entracte en cartons
js/pronostic.js       le dépistage d'avant-match
js/impact.js          l'impact en chiffres de match : ce que le moteur joue, dit pour ton club (« ≈ +1,2 tir par match »), jamais en « % » ; partagé navigateur + Node
js/equipes.js         l'écran des équipes et leurs vraies statistiques
js/combat.js          la main de l'adversaire d'un gros match qui n'est pas un duel (le 82-0) ; ta main est partie (V13-2)
js/personnel.js       le personnel (V10 ; V16, seule carte bonus) : un poste par rôle, chacun son moment, le protégé, le feu
js/dossiers.js        les dossiers de la semaine (V10) : ce qui arrive à ton club, dit par sa voix, un lundi sur deux — `check_dossiers`
js/cartes.js          le gabarit des cartes (recto, verso, finitions)
js/rarete.js          les variantes de carte et leur bonus
js/lexique.js         le lexique : un mot par idée (coach, entraîneur, adjoint, vestiaire, classeur…) et les icônes réservées — `check_lexique`
js/galons.js          les galons d'une saison de Rogue (40 buts, 50 passes…), lus dans le journal du club
js/banque.js          la banque de cartes (le personnel et dix cartes rares qui montent), le build : la couleur et le compte de chaque coach
js/echelons.js        le personnel qui monte (V14) : la force et le défaut, les échelons achetés en jetons, les doublons qui en paient un
js/chiffre.js         le chiffre à tenir du coach (V19) : une vraie stat par coach (huit), un point de confiance si le bloc de dix matchs est tenu, un seul — `check_chiffre`
js/coachs.js          les coachs (v2) : neuf philosophies, la couleur d'une carte lue sur ses canaux, la confiance à 3, 7 et 15 points de son personnel
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
js/sauvegardes.js     les parties sauvegardées, et leur export en fichier transférable, importé au menu — `check_sauvegardes`
js/mouvement.js       les chiffres qui se comptent
js/exhibition.js      l'exhibition
js/table.js           Sur table : le moteur du plateau et reglesDuPlateau()
js/plateau.js         Sur table : l'écran du plateau
js/tournoi.js         Sur table : le tournoi de six clubs
js/sons.js            les effets sonores synthétisés (Web Audio)

scripts/              build des données (build_shards.py, rate.mjs, rerate.mjs, portraits.mjs, actions.mjs, recrues.mjs → data/recrues.json
                      la vraie saison recrue…), vérifications (check_*.mjs, smoke*.mjs, tout.mjs qui enchaîne les rapides),
                      calibration (calibrate_sim, mock_*), verdict.mjs (le juge partagé), lib/mort.mjs (la mesure du code mort)
mobile/, desktop/     l'APK (Capacitor) et l'exe (Electron) ; seul leur code est versionné
mobile/assembler-www.mjs  www/ de l'APK : sans data/salaries ni data/seed.json, JS regroupé en lots et minifié,
                      CSS minifié (esbuild, devDependency de mobile/ seulement ; --brut pour s'en passer),
                      cartes de sources à côté dans www-cartes/ ; la liste hors ligne de sw.js est réécrite
docs/                 l'historique et la référence (voir docs/README.md)
```

La version longue, fichier par fichier, est dans `docs/structure-detaillee.md`.

## Règles fermes

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md`.

**Les cotes et les données**
- Une cote peut s'afficher (JP, 27 oct. 2026 : *enlever la règle « aucune cote à l'écran »* ; la règle d'avant était « aucune cote dans le DOM, jamais » et son smoke `sansCote`, partis). Mais une cote affichée est une cote que le moteur JOUE, jamais un chiffre qu'il ignore : *une OV, c'est « telle carte est meilleure dans l'absolu », et en afficher une que le moteur ne joue pas serait mentir* (docs/refonte-v9.md). Des cotes sur 20, une par chose qu'on fait (Tir, Passes, Défense, Robustesse ; Arrêts pour un gardien), jamais une cote générale (JP, 28 oct.) : docs/cotes-sur-20.md, `lesCotes`. Sans jouer le jeu aux cotes (JP : *on veut éviter quelque chose de trop basé sur les cotes*) : le niveau, les icônes, les vraies stats se lisent d'abord, la cote est un appui.
- Une seule implémentation des cotes (`js/ratings.js`, partagée par le build et le navigateur) ; toucher une formule, c'est incrémenter `RATINGS_VERSION`.
- La valeur est relative à la saison par construction ; la force d'équipe suit le vrai classement — `check_ratings` (corrélation autour de 0,8).
- Un joueur-saison ne peut habiller qu'une équipe.
- Pas de scraping de hockey-reference ni hockeydb ; les salaires réels arrivent par `data/salaries/sources/`.

**Le moteur**
- Tout le hasard du moteur passe par `hasard()` ; la même graine et les mêmes dés du jour rejouent la même saison, et chaque journée tire ses dés quand elle arrive (`deDuJour`) — `check_graine` ; un tirage pur (un dilemme, une situation, une offre) lit la graine par `entierDeGraine`, jamais par `Number(graine)` — `check_verite`.
- La ligue se joue au jour le jour : rien n'est simulé d'avance, une décision s'applique au jour dit, et les journées d'avant ne bougent pas — `check_graine`, `check_ballottage`.
- Une saison en cours se REJOUE plutôt qu'elle ne se relit ; les séries aussi. L'entracte d'un duel, lui, se rembobine au matin retenu de son match, sans rejouer la saison (JP : *rend instantané, c'est la base*) — `check_instantane`.
- Les égalités de la feuille de match tiennent — `check_feuilles` (sur table : `check_table`). Un match nul après soixante minutes va en prolongation de cinq minutes, où un sur deux se règle ; l'autre va aux tirs de barrage, dont le but fait gagner sans être marqué par personne (`fusillade`, ni aux buts de l'équipe ni à ceux contre son gardien). En séries, la mort subite se joue en périodes de vingt minutes, autant qu'il en faut (`otLongue`) — `check_prolongation`.
- Ce qui a fait le match se dit cause par cause : une carte, un badge, l'affinité, le gardien n'est dit que si, retiré seul, il changeait le lancer, avec le même dé — `check_causes`.
- La production se répartit comme la vraie saison l'a répartie — `check_parts`.
- Le direct, le sommaire et le bilan disent les mêmes buts, au caractère près — smoke.
- Aucune cote neuve, aucune mécanique neuve : une carte, un trait, un effet passent par les canaux existants — `check_combat` (chaque carte que l'adversaire peut jouer est lue par le moteur), `check_traits`. Les systèmes de ligne, la glace de chaque trio, l'appariement et la consigne du match sont partis (V18, docs/refonte-v18.md ; JP : *enlever partout*) ; la chimie d'une ligne vient de l'affinité de ses joueurs — les badges qui s'accordent (`AFFINITES`, `accordsDeLigne`), un accord au plus petit des deux —, par les canaux de la chimie (son bonus, l'action spéciale), partout, et rien ne se règle — `check_affinite`.
- On mesure une carte EN PAIRES, sinon on ne mesure rien — `check_cartes`.
- Un adjoint joue chaque match (V19, JP : *pas de moments pour les adjoints*) : son effet est un style — plus de tirs et moins de précision, jamais plus de force —, net à zéro en buts au premier échelon (`check_places`). Une carte — une réponse de dossier, une route de la semaine — peut ne jouer que dans son moment (`si` : un des `MOMENTS_SI` de js/sim.js — le lieu, les séries, le dos-à-dos, les jambes, le rival ou la bête noire, la forme, l'infirmerie, l'intention annoncée d'un duel ou sa 3e période) : elle frappe alors plus fort ses soirs-là, rien hors d'eux, et sa face dit son moment en premier. Un moment se lit sur ce qui est déjà joué, jamais d'avance, et revient assez pour qu'une carte ne soit pas morte — `check_moments_si`, `check_places`.
- Une carte change la FORME du match, pas sa force : le net en victoires est borné par la rareté (commune ±1, peu commune ±1,5, rare ±2,5, légendaire ±4 : un maximum, jamais une cible), chaque effet se VOIT dans la feuille d'un soir où il joue, commune comprise (JP : *0,4 pt, ça va fuck all faire* ; *recheck tous les effets*) : ±2 tirs, ±0,3 but des deux clubs, ±0,5 punition, ±4 mises en échec, ±3 blessures par saison ou ±3 de jambes ; sur un joueur nommé, ±0,3 point, ±0,15 but ou ±1 tir à sa ligne — `check_effets` (le personnel, les routes, les dossiers, les dilemmes, la presse, les arcs, les fils), `check_places`, et le style ne se paie pas en force : au plus 0,5 V par seuil franchi — `check_cartes`.
- Les gros matchs portent leur plan, leur contre et leur pointage après deux périodes — `check_gros`. En Rogue (V9), ce sont des duels de trois périodes, une intention chacune, et les périodes vues ne bougent pas — `check_gros`, `check_duel`.
- Deux clubs égaux, le duel bien joué (la meilleure proposition de l'adjoint à chaque période) contre « Garder » tout le long : un avantage net, mais sous 60 % en face à face — `check_duel` (semé).
- Au duel, ta réponse est ton plan de la période (V17, docs/refonte-v17.md ; JP : *mon adjoint propose des ajustements à chaque période, j'en choisis un*) : leur intention est LEUR plan, sans contre ni porte ; avant chaque période, ton adjoint (une voix d'`EXPEDITEURS`) propose deux ou trois plans de `PLANS`, chacun en vraies stats de la période (`propositionsDuDuel`, js/impact.js), et « Garder » ; leur plan et le tien y jouent à `FORCE_DUEL` — `check_duel`.
- Le gros match se règle le jour où il se joue, en un seul arrêt (JP : *juste le jour du gros match, pas avant*) : la route le montre la veille (`ANNONCE_GROS`), son écran n'arrête l'avance que son matin ; commencé, il se vit en direct jusqu'au bout, sans ✕ ni détour par le Bureau (JP : *on vit le match, rien d'autre*) — `essai_rogue`.
- Le robot « premier Signer » ne gagne pas la Coupe — `check_robot`.
- Une carte seule reste sous la borne de sa rareté et la première run reste dure ; une run qui a duré, ou un build qui s'emboîte, a le droit de casser le jeu — c'est la récompense du Rogue (docs/refonte-v3.md, principe 5).
- Après sa première Coupe, le gérant attentif la regagne sans la gagner d'office : il monte les exigences (V9, tranche 8) — `check_profondeur`.

**L'économie (Rogue et boutique)**
- Revendre un pack de cartes rapporte au plus 40 % de son prix — `check_packs`.
- L'achat s'enregistre avant le butin ; la prime de série est versée — `check_rogue`.
- Le ballottage offre un dépanneur (niveau Régulier au plus), pas une vedette — `check_ballottage`.
- Une carte ne se prend qu'une fois, et un palier n'arrête l'avance qu'une fois.
- Aucun joueur ne te suit au choix (JP : *garder des joueurs de run en run devrait être fait dans une loto, pas genre tu peux prendre qui tu veux*) : le classeur, les lotos du cartable et ceux qui restent sont des lotos par niveau (`lotoDeCase`) — `check_rogue`.
- Une carte trouve son coach sur ce qu'elle fait (ses canaux), jamais sur une étiquette collée ; la confiance d'un coach est une décision `coach` qui porte ses chiffres, et un seul coach est en poste à la fois — `check_coachs`.
- L'adversaire ne pige pas les cartes de match de la v2 (`horsAdverse`) : sa main est calibrée, la difficulté ne bouge pas — `check_gros`, `check_robot`. Au duel, il n'a pas de main : ses intentions, son plan de chaque période, en tiennent lieu.
- Le personnel est la seule carte bonus (V16, JP : *les assistants coachs remplacent toutes les autres cartes de bonus*) : les places, l'équipement, les clauses et le feu de l'atelier sont partis ; reste une seule petite famille de dix cartes rares qui montent (V16, tranche 6 ; JP : *ramener le jeu à son essence de cartes*) — les quatre retouches d'édition, le stage du coach, la formation d'un adjoint, trois soins, l'échange d'un doublon —, la deuxième carte d'un pack de joueurs une fois sur quatre (`RARE_DU_PACK`), jamais le gros d'un pack. La masse salariale et le congédiement sont des dossiers du proprio (`laMasse`, `laTete`, js/dossiers.js) ; le rappel du club-école, un remède de la blessure. Chaque coach a au moins cinq adjoints, sur trois postes au moins, et un **combo** (V19, `COMBOS`, js/personnel.js) : deux de ses adjoints, de deux postes, en poste avec lui, ajoutent un effet ses soirs (force et prix, sur les canaux qui existent ; l'Aigle a en plus le feu) — `check_combos`, `check_coachs`, `check_places`, `check_packs`, `check_dossiers`.
- La confiance d'un coach se compte par un seul chemin (V20, docs/refonte-v20.md ; JP : *oui à tout*) : son **chiffre à tenir** (js/chiffre.js : les tirs du Frelon, les tirs contre de la Tortue, la précision de l'Aigle, les punitions de l'Abbé, les blessures du Doc, les buts des 3e et 4e trios du Contremaître, les mises en échec du Rhino contre ce que son alignement donne seul, la glace du premier trio du Showman), tenu dix matchs de suite : un bloc tenu, un point (`POINTS_PAR_BLOC`), sans plafond, depuis son entrée en poste ; ses adjoints, leurs échelons, leurs matchs à ton service et les cartes jouées ne comptent plus — ils poussent sa stat — `check_coachs`, `check_chiffre`.

**Sur table**
- Les règles du plateau sont ÉCRITES DANS LE CODE (`reglesDuPlateau()`) et affichées de là ; le moteur ne les viole jamais — `check_regles`.
- La rondelle ne se téléporte pas : chaque déplacement est une étape bornée — `check_regles`.

**L'interface**
- Mobile d'abord : rien ne déborde à 390 px, tout ce qu'on touche est atteignable et fait 44 × 44 — smoke `sansDebordement`, `toutEstAtteignable`, `cibles44`. Rien ne colle au bord : un mot, une icône ou une carte tient à 8 px au moins des deux bords (JP : *un petit padding, mieux que pas de padding du tout*) — `essai_rogue` 20n (scripts/lib/bords.mjs).
- Une carte de jeu a le format d'une carte de hockey (JP : *j'aime vraiment le format carte de hockey, pas les autres*) : un carton 5:7 de la série de la glace, aux couleurs de son genre (`carteHtml`, `.cs-jeu`) ; ce qu'elle fait se lit à son verso (JP : *mettre les stats derrière la carte*) : la toucher la retourne, « Prendre » dessous la prend. Au téléphone, les cartes se balaient en grand, une à la fois ; jamais trois étroites côte à côte.
- Une maison par sujet (V12, docs/refonte-v12.md ; JP : *everything coaching should be at same place* ; *that philosophy should be for everything*) : ce qu'un sujet garde toujours — son état et ses cartes — vit à sa maison, et nulle part ailleurs ; ses choix se règlent dans la Boîte, rangés sous elle (V18-5, docs/ecrans-rogue.md ; JP : *good*). Le coaching chez le coach (sa philosophie, sa confiance, le personnel, ses cartes, l'adjoint d'un palier), la santé au filtre 🩹 de Joueurs, le proprio, l'argent et le congédiement au proprio ; une retouche et l'échange d'un doublon à l'effectif.
- Jamais une longue page : chaque onglet tient en un écran, la page elle-même ne défile jamais ; hors du Rogue, quatre sections (Bureau, Joueurs, Lignes, Ligue), dans le même ordre, aucune carte (ni au 82-0, ni sur table, ni au repêchage) ; en Rogue, cinq sections rangées comme un jeu de gestion (JP : *organise plus comme EHM, avec moins de trucs qui servent pas* ; *tu peux avoir cinq menus icons dans le bas*) — Bureau (Boîte, Proprio, Coach, Vestiaire), Joueurs, Lignes, Marché (Boutique, Album), Ligue (Classement, Calendrier, Meneurs, Palmarès) : la carte de docs/ecrans-rogue.md, V18-5, sans l'Avant-match (JP : *je vais jamais sur cette page*) —, sans écran par match : le Bureau garde le match en une ligne, qui ouvre les Lignes, et ton plan d'avant-match plié dessous ; après « Jour suivant », rien ne s'ouvre (Hier soir le dit ; le résumé de la semaine reste), et la première ouverture d'une visite montre le journal, une une courte ; et une carte rare se joue dans la maison de ce qu'elle monte (Marché › Tes cartes est parti) ; un club s'ouvre du Classement, le Palmarès est celui du club (sa vitrine, son panthéon, tes runs) ; chacune répond à UNE intention de gérant et chaque info a UNE maison (docs/refonte-v8.md) — smoke, `essai_rogue`.
- Un seul retour, un niveau à la fois (js/pile.js) ; rien de sélectionnable, aucun lien souligné ; l'anneau du focus en mode clavier ou manette seulement — smoke.
- À faire ne contient que ce qui se règle, et ça s'y règle, comme un message d'EHM (V18-5, docs/ecrans-rogue.md ; la V12 renvoyait au sous-onglet) : une ligne par choix — la voix, le sujet, son état —, rangée sous sa maison (le proprio, l'entraîneur, la presse, le vestiaire, l'infirmerie ; le gros match et la signature ouvrent leur écran). Toucher une ligne l'ouvre sur place, une à la fois — au matin, celle qui attend —, sous la même forme : la voix, le fait, ses options (`optionHtml`). Chaque sous-onglet montre toujours sa part, sans choix (le mandat au proprio ; ton coach, ton personnel et les deux semaines chez l'entraîneur ; ton histoire au vestiaire : `PERMANENT` ; la une à Hier soir, les blessés au filtre 🩹, la route de la saison au Calendrier), et le Bureau ne la redit pas. Toucher une option l'envoie, sur une tuile à coins vifs (JP : *j'aime pas les arrondis, le fait que ça reste*) ; les rivaux se cochent un à un et partent au dernier ; une option › ouvre son écran (le combat, le paquet, une liste). Le jour par jour : en semaine, seul ce qui presse bloque « Jour suivant » (un gros match, un pack à signer, un blessé à remplacer, une case vide) ; le reste attend le lundi, au même endroit. Ce qui ne demande rien est une nouvelle d'Hier soir, jamais un « Compris » (docs/refonte-v9.md) — `essai_rogue`.
- Signer, c'est l'échange (JP : *alignement simple, et un comparatif en haut entre les deux joueurs, style Yahoo Fantasy*) : l'alignement en lignes simples, la sortie proposée touchée d'avance ; toucher un joueur le met face à l'arrivant, stat par stat, avec sa case et la masse ; « Signer » décide (`choisirQuiSort`, js/repechage.js) — smoke, `essai_rogue`.
- Toute commande visible doit fonctionner.
- Une surface de base se change À LA SOURCE, jamais en fin de fichier.
- Le noir est le décor ; la couleur vient des équipes, aux vraies couleurs, jamais délavées ; les écussons des disparues sont dessinés (`js/logos.js`), jamais empruntés.
- Moins de mots, et surtout pas les évidents : une ligne à l'écran, le détail chiffré dans la page des règles, dont chaque chiffre vient d'une constante — `check_clarte`.
- Un choix se dit en vraies stats de match : tirs, % au tir, tirs contre, % d'arrêts (`statsDe`, `motsDeStats`, js/impact.js) ; jamais en victoires ni en but net, jamais en note. Sur une carte, chaque stat est une barre qui diverge du match ordinaire, le chiffre dessous (`pucesDeFace`).
- Ton équipe commence en NHL Stars (noir, blanc, orange, l'étoile) ; son club (un nom et SON écusson, vendus ensemble) et ses couleurs s'achètent en jetons à la boutique, comme les packs, et se portent aux déblocages (`js/club.js`), tous inventés et dessinés, jamais empruntés à un vrai club — `essai_rogue`.
- On ne décerne que ce que les colonnes décident, jamais ce qu'un vote déciderait.
- Ce qu'un texte affirme d'un match (un rythme, une disette, trois punitions en deux matchs) est arrivé dans les feuilles déjà jouées, et il dit les vrais chiffres — `check_fils`, `check_vie`.
- Un choix qui promet pour plus tard (l'objectif du proprio, le fil suivi) se suit : son état, en vrais chiffres, se lit chaque matin à sa maison, Hier soir dit son pas, et son verdict arrive comme un message ; un joueur parti fait tomber sa promesse, et ça se dit — `check_suivis`.
- Un dilemme ne sort que si son fait est vrai (`FAITS`, js/sim.js : un joueur parti, l'infirmerie, le gardien qui joue tout…), lu sur ce qui est déjà joué ; il n'a pas de récit : ce qu'il affirme est ce fait (sa scène, qui nomme les joueurs) ou ce que ses options font ensuite au moteur, et chaque mot de stat dit un canal que l'effet bouge, dans son sens ; une promesse sur des joueurs (« ton quatrième trio joue plus », « {aux} prend le filet ») se recompte dans les feuilles d'après — `check_dilemmes`.
- Un choix du Rogue dit qui le demande (une voix d'`EXPEDITEURS`), pourquoi maintenant (le fait, en vrais chiffres) et ce qu'elle en pense (une réplique sans chiffre) : une scène de `js/scenes.js` — `check_clarte` § 5, `essai_rogue`.
- Les mots d'une réponse disent ses lignes (JP : *le texte fitte pas avec les stats des choix*) : son `bon` nomme les lignes vertes que le moteur montre pour un vrai club (tirs, tirs contre, précision, arrêts, punitions, jambes, blessures), son `prix` les rouges, rien n'est promis sans ligne, et une carte de route se voit ; l'étiquette (Cadeau, Échange, Moindre mal) suit les lignes affichées ; une ligne sous le bruit (un tir, un demi-point, un tiers de punition) ne se dit pas — `check_mots`.

**Le code et les tests**
- Modules ES natifs, pas de build step, aucune dépendance npm.
- `sw.js` liste tout ce que la page charge — `check_coquille`.
- Zéro code inutile : aucune déclaration morte, aucun `export` ni import de trop, aucune classe CSS sans élément — `check_mort`. Un petit outil qui sert à plusieurs modules va dans `js/util.js`, pas dans une copie de plus.
- Un chiffre qu'on imprime sans le juger est un chiffre que personne ne relit : chaque script passe par `scripts/verdict.mjs`, qui pose le code de sortie.
- Un test de fumée qui dépend du tirage n'est pas un test, c'est une loterie.
- Français québécois, partout.

## Le vocabulaire

Un mot par idée, le même à l'écran, dans le code neuf et dans les docs.

- **jambes** : la fatigue d'un joueur, sur 100 (jamais « % », jamais « énergie »).
- **Sur la glace** : dans la fiche, en mots, ce que le moteur fera du joueur — l'effet de chacun de ses badges à son palier, ce qu'un coup lui coûte (js/fiche.js). Pas une cote, pas une statistique de plus ; le profil en crans a été essayé et retiré.
- **niveau** : ce que le joueur valait dans sa saison, à son poste — Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène (`js/niveaux.js`) : à ses points par match ou à sa défense (le +/- relatif au club, le désavantage, les minutes), le meilleur des deux rangs ; gagné à la défense, la pastille dit « déf. » (`niveauParDefense`). Le badge a ses propres mots (Bronze, Argent, Or, Platine), qui ne s'appellent pas « niveau ».
- **rôle** : ce que le joueur fait (sniper, passeur, checker…), une icône et un mot ; deux rôles s'accordent dans une ligne.
- **famille** : Tir, Jeu, Défense, Robustesse — ce qu'un joueur apporte à ses points égaux, lu sur ses rôles (`famillesDe`, js/sim.js) ; à l'écran en mots (rare, fort, ordinaire, faible), jamais en chiffre ; elle range les packs et le profil. **L'affinité** (V18) : ce qui fait jouer une ligne ensemble — ses **accords**, deux badges qui marchent ensemble (🎯 sniper et 🅰 passeur, 🔧 checker et 🪠 plombier, 🏒 manieur et 🛑 défensif…, `AFFINITES`), chacun au plus petit des deux ; ses accords font la chimie de la ligne. Les systèmes (🌧 Volume de tirs…) sont partis : rien ne se règle sous ce nom.
- **badge** : son rôle à un palier — Bronze, Argent, Or, Platine (`badgesDe`, js/sim.js) ; un premier et, au plus, un second qui rend la moitié. Le palier se voit en couleur (`pal-1` à `pal-4`), jamais en médaille : 🥉🥈🥇💎 nomment les packs. Sur une carte et dans une liste, le badge est son icône seule, à la couleur de son palier (JP, oct. : *juste mettre les icônes, pas le texte*) ; le mot (« Sniper Or ») vit à l'infobulle et dans la fiche. « Palier » reste un mot du code.
- **zone** : où le joueur rend (T1-2, P1…) ; une case porte les zones qui y sont chez elles.
- **carrure** : 🪨 costaud ou 🪶 léger ; elle fait l'agressivité de sa ligne, qui ne se règle pas (`agressiviteDeLigne`).
- **coach** : une des neuf philosophies de `js/coachs.js` (🐝 le Frelon, 🐢 la Tortue…) ; chaque carte a la couleur d'un coach. Pas « école », pas « build » à l'écran.
- **couleur** : le coach d'une carte, ou d'un joueur (celui de son meilleur rôle maîtrisé) ; « Joueur du Frelon ». Une carte sans couleur est **neutre**.
- **confiance** : I, II, III — un seul coach en poste, choisi au début de la saison à la confiance I ; son chiffre tenu le monte à II (7 points, quatre blocs) et III (15, douze blocs) — un point par bloc de dix matchs tenu (V20 ; avant : ses adjoints, leurs échelons et leurs matchs à ton service) ; un bloc atteint s'allume au matin, et au lundi du robot ; le report d'une saison garde ses blocs. « Le congédiement » en installe un autre, à I, et l'ancien part avec son bonus (V5).
- **prestige** : le rang du club d'une run à l'autre (`js/rogue.js`, du Club de garage à la Dynastie) — médailles 🏅 gagnées à vie et un exploit par rang ; il ajoute des Étoiles et des Phénomènes aux packs, sans qu'aucun rang n'en ferme un (V10). **Les packs qui montent** : la boutique d'une première run vend le Bronze et l'Époque ; un pack de plus s'ouvre à son jalon (`packsOuverts`), et chaque pack monte de deux **crans** en médailles, un joueur de plus puis le métal du dessus (`CRANS_DE_PACK`, `monteeDesPacks`, js/rogue.js ; `tierDuPack`, js/packs.js) — `check_packs`.
- **exigences** 🔺 : en Rogue, après ta première Coupe, les crans que tu montes au départ d'une run, comme l'Ascension de Slay the Spire (`EXIGENCES`, `exigencesDe`, js/rogue.js). Chaque **cran** ajoute la sienne à celles d'avant, par un canal qui existe (le plafond, le prix des packs, le classeur, le quota de Soutien, le barème, le mandat, les gardés), et paie plus de médailles ; la Coupe gagnée au plus haut cran ouvre le suivant. Pas « difficulté », pas « ascension » à l'écran — `check_rogue`, `check_profondeur`.
- **le personnel** (V14 ; V16, la seule carte bonus) : des cartes, une par poste, nommées par leur style (« Le gardien du fort »), sans nom de personne. Sa **force** (ses canaux qui aident, en vert) et son **défaut** (ceux qui coûtent, en rouge), en vraies stats. Au premier échelon, une carte change le **style**, pas la force (V14b, `check_places`), mais un style qui se voit (oct., JP : *les adjoints doivent impacter de façon visible le style de l'équipe*) : ses canaux d'équipe s'écartent de 1 d'`AMPLEUR_STYLE` fois plus (js/personnel.js), la force et le défaut ensemble. Un **échelon**, de 1 à 3 (V19 ; cinq avant), s'achète en jetons quand on veut, de plus en plus cher (`PRIX_ECHELON` ; V20 : plus de matchs à ton service) ; à chaque échelon, tu choisis : pousser sa force ou corriger son défaut ; dès le premier, le défaut est déjà à demi corrigé (`CORRECTION_DE_DEPART` : l'adjoint sert tout de suite). Il y a **cinq postes** (chef, attaque, défense et gardiens, physique et soins, dépistage ; V19, huit avant — `posteDe` lit le poste d'alors d'une vieille partie). Un **doublon** tiré d'un pack paie un échelon, deux au plus, d'une run à l'autre ; les échelons se regagnent à chaque run (`echelonsGratuits`, `etatDuPersonnel`, js/echelons.js). **La couleur** (V20) : un adjoint de la couleur du coach en poste joue un échelon plus haut (`assortiPour`, js/sim.js) ; un autre joue tel quel (la pénalité cachée `MAL_ASSORTI` est partie) — `check_personnel`, `check_banc`. Un adjoint peut travailler un **protégé**, un joueur plutôt que l'équipe (`PROTEGES`) ; ceux du **feu** (☄ l'allumeur, 🪔 le gardien de la braise, 💫 le semeur de poudre) visent la lancée de leur 1re ligne, et des deux premières après deux poussées de leur force (`LIGNES_DU_FEU`). « L'adjoint » qui joue une série pour toi est un entraîneur adjoint ; les adjoints du coach à chaises (V13-3) sont partis.
- **duel** : le gros match du Rogue, en trois périodes (V9). **Intention** : ce que l'adversaire annonce avant une période, et qui vise tes joueurs par leur nom (🥷 l'ombre, 🦈 la chasse, ⛔ fermer le centre, 🐗 l'assaut, 🦂 les punitions). C'est leur plan de la période, qui frappe sa période avec son prix ; elle ne se « contre » plus. **Ton adjoint** (V17) : à chaque entracte, il lit la période qui vient et propose deux ou trois plans, en vraies stats de la période ; tu en prends un, ou tu gardes le tien. Le tableau, la porte, le geste et la contrée (V13) sont partis. **La mise doublée** : avant la 3e d'un duel de saison, le butin ou les sonnés doublent. Le duel n'a plus de main de cartes (V13-2) : mesurée, l'adjoint la jouait presque aussi bien sans rien lire.
- **places** : parties à la V16 (docs/refonte-v16.md), avec la carte de trop et l'onglet « Tes places » ; leurs idées sont devenues des adjoints. Les paliers des 9e, 18e et 26e matchs, le verdict du proprio et le butin d'un gros match gagné offrent un adjoint parmi trois, dont un de la couleur du coach en poste (`cartesDuPalier`, `adjointsDeCouleur`, js/inventaire.js, js/packs.js — `check_coachs`) ; les cartes des routes de la semaine vivent avec elles (`CARTES_DE_ROUTE`, js/noeuds.js). Une partie d'avant la V16 se relit : ce que la banque ne connaît plus s'ignore — `check_sauvegardes`.
- **plombier** : le rôle 🪠 d'un attaquant de quatrième trio qui lance et frappe en peu de minutes ; l'accord « Les plombiers » (🪠 et 👊). Les joueurs faibles du départ d'une run sont des **bouche-trous**, pas des plombiers.
- **vestiaire** : la pièce, et l'équipe qui y vit (« le vestiaire est galvanisé ») ; au repêchage, le vestiaire d'une vraie équipe où l'on pige. Ce que les médailles achètent, ce sont **les déblocages** ; l'équipe d'une run, c'est **ton effectif**.
- **cartable** : tes cartes de joueur, d'une partie à l'autre. **classeur** : le tirage de ton cartable au départ d'une run (« Le départ du classeur ») : des **cases**, chacune d'un niveau (une Régulier sans rien, Pilier et ★ Étoile aux pages), un loto de trois cartes de ce niveau (cinq au tri) dont tu gardes une ; un niveau absent, la case prend celui d'en dessous (`departDuClasseur`, `lotoDeCase`, js/rogue.js). Les lotos du cartable entre deux saisons, ceux qui restent (un Pilier et un Régulier de ton équipe finie, `gardesDeLaRun`) et ceux qui te suivent de ta dernière run (Pilier, Pilier, ★ Étoile, un par déblocage « Garder », `gardesDeLaDerniere`) se tirent pareil. La **banque** : toutes les cartes de jeu. Un **doublon** est un joueur déjà à ton cartable ; trois doublons montent sa carte d'une édition, jusqu'à l'Or (`monterLesDoublons`).
- **édition** : la carte d'un joueur, de 1 à 5 — Base, Cadre, Hors-cadre, Or, Holo (`EDITIONS`, js/rarete.js) ; chacune change la carte entière et monte ses badges. Ce que l'écran montre, c'est la plus haute décidée sur lui, le jour même (`rareteJoueur`, js/repechage.js) ; le moteur, lui, ne la joue qu'au matin de sa journée (`varianteJoueur`) — `essai_rogue` 12a'. Elle se monte par les doublons, par un doublon plus fort tiré d'un pack, et par les cartes de l'atelier (🖌 🪟 🔆 ✨). La **rareté** (commune → légendaire, en diamants) est aux cartes de jeu seulement ; « édition » n'est plus le nom d'une carte de l'atelier, qui est une **retouche**.
- **médailles** 🏅 : la monnaie des déblocages ; **jetons** 🪙 : celle de la boutique. L'**écusson** est un logo, jamais une monnaie.
- **coach** : seulement la philosophie, et sa maison au Bureau ; la personne derrière le banc est **l'entraîneur** (« L'entraîneur des gardiens », la voix qui parle de la glace) ; une carte de personnel est un **adjoint**, celle du poste `chef` « l'adjoint en chef » (jamais « entraîneur-chef », jamais « le coach de… ») — `check_lexique`.
- **relance** : seulement le dé qu'on relance (la roulette, la relance d'équipe sur table) ; la sortie de zone se dit « sortie », la passe du gardien « remise ».
- **rejouer** : les mêmes clubs, d'autres dés (« Rejouer la saison ») ; l'historique « reprend l'alignement », une décision « reprend la saison ».
- **rival** : un club à deux rangs ou moins ; la **bête noire** 😤 : celui qui t'a battu deux fois ; **ta rivalité** : le club le plus croisé en gros match.
- **dossier** : en Rogue (V10), ce qui arrive à ton club un lundi sur deux, s'il arrive vraiment — trois soirs sur la route, l'infirmerie qui déborde, un rival dans la semaine, la caisse à sec (`DOSSIERS`, js/dossiers.js) ; une voix le dit, et ses réponses passent par la porte des dilemmes. Les **événements** ne sont plus des cartes. Pas « situation », qui est au vestiaire (`SITUATIONS`, js/sim.js).
- **fil** : une histoire de ta saison lue dans les feuilles jouées (la course, le Cheechoo, la disette, le duo…, `filsDeSaison`, js/recit.js) ; **la une** : le fil le plus lourd d'hier soir, au bureau. En Rogue (V9), un fil fort (le Cheechoo, la disette, le duo, la recrue) ouvre un choix dans À faire (`CHOIX_DES_FILS`, js/vie-gm.js) ; son **retour** se relit dans les feuilles quelques matchs plus tard, à la une, avec ses vrais chiffres (`retoursDuMatin`, js/sim.js) — `check_retours`.
- **jouer blessé** : en Rogue, un blessé (ni commotion, ni fracture, ni ligaments ; 8 matchs ou moins à faire) joue diminué — « Il joue amoché » — le temps qu'il lui restait ; blessé encore, il manque aussi ce temps-là (`jouerBlesse`, js/sim.js). Le physio peut aussi ramener plus tôt un blessé à mi-chemin. Une commotion se garde : la suivante s'allonge, d'une saison à l'autre de la run.
- **scène** : la mise en scène d'un choix du Rogue — la voix qui le demande, sa réplique entre guillemets, le fait sous elle (`sceneDeLaMise`, `sceneDuPalier`… js/scenes.js) ; le prix et le gain restent aux options.
- **voix** : qui écrit dans la boîte (le proprio, l'entraîneur, l'analyste à la télé, les partisans, le capitaine, le physio, le joueur lui-même…) — une seule distribution, `EXPEDITEURS` (js/vie-gm.js). Une voix dit le fait d'un fil et y ajoute une opinion, jamais un chiffre — `check_fils`. En Rogue, le soir où un fil rare naît (le Cheechoo, la recrue, 40 buts, un rythme de 50), sa voix paie une **prime** en jetons (`primesDesFils`, js/rogue.js).
- **moment** : ce qu'une carte attend pour jouer (`si`, `MOMENTS_SI`, js/sim.js) — « Un soir de dos-à-dos », « Quand ils annoncent l'ombre », « Contre ta bête noire » ; courant (au moins trois soirs par saison) ou rare (les séries, la bête noire, le duel), et qui vaut plus par soir (docs/refonte-v10.md).
- **lancée** : en Rogue, un joueur qui vient de marquer beaucoup finit mieux tant que ça dure ; le **doute**, le vrai marqueur en panne qui finit moins bien (`lanceeDe`, js/sim.js — `check_lancee`). Pas « confiance », qui est aux coachs ; jamais dans le 82-0. La lancée **vive** est celle de ☄ l'allumeur ; le gardien de la braise, le semeur de poudre et le vendeur de chandails l'entretiennent (le premier combo du Rogue, quatre adjoints depuis la V16, `check_combo`).
- **trait** : ce qu'un vote ou une réputation donne au joueur (🛡️ Selke, ⚡ vitesse) ; un **trophée** se décerne au bilan, sur les colonnes.
- **défi** : en Rogue (oct.), ce qu'un arc de joueur lui demande, dans SA stat, sur ses prochains matchs — des buts, des points, des tirs, des mises en échec, des bagarres gagnées, le différentiel, un % d'arrêts (`DEFIS`, js/arcs.js) ; il se suit chaque matin au Vestiaire (« Ce qui court »), recompté dans les feuilles. Relevé, sa retouche 🏵 se grave au verso de la carte, pour de bon (`source: 'defi'`, gardée au cartable) ; raté, rien de permanent — `check_arcs`.
- **galon** 🏵 : en Rogue, ce qu'un joueur a fait chez toi dans une saison (40 buts, 50 passes, 30 victoires, 5 points dans des gros matchs gagnés, 40 points d'une recrue), gravé avec son match et son adversaire (`GALONS`, js/galons.js) ; son badge monte d'un métal pour le reste de la run, deux au plus, et sa carte en garde une copie de plus. **Son histoire chez toi** : ses saisons de run, sur sa carte (`graverLaSaison`, js/cartable.js). **Le panthéon** : les records, les trophées et les chandails retirés du club, d'une run à l'autre (`graverAuPantheon`, js/rogue.js) — `check_galons`.
- **unités spéciales** : AN 1 et AN 2 (l'avantage numérique), DN 1 et DN 2 (le désavantage) ; le moteur les range, l'onglet AN · DN des Lignes les change (`speciales`, `check_speciales`).
- **agressivité** : 🕊️ Prudente, ⚖️ Moyenne, 💥 Musclée, 🪓 Rentre-dedans — celle de la carrure de la ligne. La consigne du match est partie (V18).
- **le banc ouvert** (V20, JP : *au lieu de trois fenêtres, possibilité en tout temps de remplacer, mais prix pour embauche sauf début de saison*) : plus de contrat d'adjoint ; un adjoint reste à sa chaise tant qu'on ne le remplace pas. L'engager est gratuit au camp (avant le premier match de ton club), puis coûte `PRIX_EMBAUCHE` (7, 12, 20 🪙 selon sa rareté, `prixDEmbauche`, js/personnel.js) — `check_banc`. Le contrat d'un joueur, lui, reste son salaire au plafond.
- **contrat** : le salaire d'un joueur au plafond ; la masse salariale se manipule au dossier du proprio (💵 « La masse salariale » : un rachat, un contrat lourd), plus par des cartes (V16, tranche 6).
- **carte rare** : une des dix cartes qui montent un joueur, un coach ou un adjoint, ou qui soignent (V16, tranche 6) ; elle se joue chez ce qu'elle monte. Pas « outil », pas « consommable » à l'écran.
- **usure des jambes** : ce qu'un match coûte aux jambes (la puce « Usure des jambes +12 % »).
- « énergie » n'est plus un mot de l'écran (il voulait dire cinq choses) — `check_clarte`. Les clés du code (`energie`, `ENERGIE_MAIN`) restent, pour ne pas casser les sauvegardes.
- **Une icône = un sens** dans les étiquettes qu'on voit en jouant : rôles, trophées, archétypes, styles de gardien, carrure, agressivité, coachs, mesures d'équipe ; 🛡 est le trait Selke, rien d'autre — `check_lexique` (`ICONES`, js/lexique.js). Avant d'ajouter une icône, cherche-la dans `js/`, et passe-la à `scripts/emojis.mjs` (la police au trait).

## Les PR et la fusion

JP (11 oct. 2026) : Claude fusionne quand le CI est vert. Après avoir ouvert une PR, Claude y active l'**auto-merge** (squash ou merge, selon ce que le dépôt permet) : GitHub la fusionne seul dès que la vérification `verifier` passe au vert sur main. Il n'attend pas de relecture humaine, sauf si JP dit « attends-moi » pour une PR précise. Si le CI est rouge, la PR reste ouverte et Claude la répare. Une PR qui ne doit pas partir (un brouillon, une expérience) s'ouvre en brouillon, sans auto-merge.

## Tester

Sert la page — `python3 -m http.server 8000`, ou sans Python `node <un petit serveur statique> . 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft conscient du budget : à chaque tour il lit le plafond restant, calcule ce qu'il peut mettre sur ce choix sans passer sous le plancher pour les cases suivantes, et signe, parmi les cartes qui tiennent dans ce budget, celle dont la destination ne porte aucun avertissement et dont le chiffre clé est le plus grand (voir S64 : prendre la première rendait une équipe de .500 et faisait du passage des séries une loterie). Sinon il relance (passer, autre équipe, autre année) ; en dernier recours il clique `#freeCapBtn`, le bouton de la bande de secours qui retire le plus gros contrat
3. `#mainBtn` devient actif
4. Cliquer : le 82-0 va droit au bilan (aucun `#hubModal .hub-jour`), `.result .score` affiche une fiche et `.rrow` en compte 23. Les séries : « Match suivant », le tableau en cours (`.bk-serie`), un match en direct, la fin, puis l'onglet Séries du bilan — sans les Lignes du match ni deck (le jour à jour s'éprouve en Rogue : `essai_rogue.mjs`)
5. « Rejouer la saison » (`#replayBtn`) rejoue le même alignement contre les mêmes clubs, puis l'historique (`.lb-replay`) relit un alignement et repart une saison — droit au bilan à chaque fois
6. Le même parcours en tirage Loto (`#rrL` relance quand rien ne tient dans le budget)
7. Zéro erreur console (les portraits refusés ne sont demandés qu'une fois : `PORTRAITS_ABSENTS`)

`node scripts/smoke_table.mjs http://localhost:8000` fait le même parcours en mode bonus : l'option « Sur table » dans les options, le même auto-draft, le tournoi (`#hubModal`), le plateau (`#tableModal`, 247 cases, deux filets d'une case) où il joue un match geste par geste — il touche une pièce, lit les cases allumées, choisit des modes, dégage, tire, saute des verdicts en touchant la glace, dépense des relances d'équipe, change de trio — puis le reste du tournoi et le bilan. Il échoue si moins de quinze gestes ont pu être joués : c'est ce qui attrape une interface qui se fige.

L'Action `verifier.yml` fait tout ça à chaque PR, plus `check_graine.mjs` et `check_feuilles.mjs` sur une ligue, plus `check_fiches.mjs`, `check_table.mjs`, `check_regles.mjs` et `smoke_table.mjs`. Les scripts de calibration (monotonie, plafond, tireurs) restent à lancer à la main.

**Avant de pousser** (JP, 13 oct. : *c'est nécessaire de tester ici et en CI ?*) : ne relance pas ici ce que `verifier` refait. Ici, seulement `node scripts/tout.mjs` et `check_mort` (quelques secondes, un rouge en CI coûte une demi-heure), plus ce que le CI ne fait pas, quand le changement touche leur terrain : `essai_rogue`, `essai_packs`, `essai_achat` pour la signature, la boutique ou le jour à jour du Rogue ; `check_rogue`, `check_banque`, `check_cartes` quand on touche au moteur ou aux cartes. Le smoke, smoke_table, `check_gros`, `check_graine`, `check_feuilles` : le CI.

`node scripts/tout.mjs` enchaîne les vérifications rapides (moins de quinze secondes chacune) ; `node scripts/tout.mjs check_deck check_packs` n'en lance que quelques-unes. `check_packs`, `check_gardiens`, `check_combat` (une demi-minute chacun), `check_jambes` (une minute) et `check_banque` (une demi-heure et plus ; `FAMILLES=patrons PART=1/4` n'en mesure qu'un quart, pour le partager entre quatre processus) se lancent à part.

Depuis la v2 : `node scripts/check_coachs.mjs` (dix minutes : la couleur des cartes, la confiance, et chaque coach mesuré en paires à six ligues ; `LIGUES=0` en CI).

Depuis la V2.3 : `node scripts/check_voies.mjs` (quarante minutes ; `VOIES=tortue,essaim` en partage le travail entre processus ; `LIGUES=0` en CI) — chaque coach à sa III, sur une équipe bâtie pour lui, vaut +6 à +8 V, à ±1 V des autres, plus que sur une équipe mélangée ; la composition (le prix des rôles à salaire égal) se dit à côté.

L'impact des choix en chiffres de match (`docs/impact-des-choix.md`) : `node scripts/check_chiffres.mjs` (une minute : ce que l'écran annonce égale ce que le moteur joue, en paires) et `node scripts/check_impact.mjs` (douze secondes : la base de la ligue, le témoin à zéro ; `COMPLET=1` le tableau de chaque choix).

Depuis la V3 : `node scripts/check_lancee.mjs` (une minute : la lancée et le doute du Rogue, absents du 82-0), `node scripts/check_combo.mjs` (trois minutes et demie : le feu qui s'entretient, chaque adjoint seul sous sa borne, le build complet qui casse le jeu, en paires) et `node scripts/check_fils.mjs` (six secondes, dans `tout.mjs`) — les fils de la saison (la une, « Ton histoire », la section Histoire du bilan) citent des feuilles réelles, chaque chiffre s'y recompte, rien ne lit l'avenir. Le plan de la V3 : `docs/refonte-v3.md`.

Depuis la V10, tranche 1 : `node scripts/check_moments_si.mjs` (une minute, au CI) — un effet d'un moment ne joue que son soir, et dans une vraie ligue la saison diverge exactement au premier soir de son moment ; les moments d'un soir sont ceux d'une ligue jouée jusqu'à lui ; chaque moment courant revient au moins trois fois par saison de run, sans être vrai plus des trois quarts des soirs, et chaque rare au moins une fois. Le plan de la V10, le jeu de cartes neuf : `docs/refonte-v10.md`.

Depuis la V10, tranche 3 (et 4, le personnel et les contrats lourds ; 5, les réponses des dossiers) : `node scripts/check_places.mjs` (six minutes ; `N` matchs par club et par carte, 400 ; `CARTES=a,b` quelques-unes) — chaque adjoint (tous les matchs, net à zéro en buts au premier échelon), chaque contrat lourd, chaque réponse de dossier et chaque carte de route en paires, match par match, son moment posé (`_lireMoment`) : hors de son moment, une réponse ou une route laisse la feuille identique ; dans son moment, sous la borne de sa rareté, sur ses soirs (`parSaison`, `MOMENTS_SI`) ; une rare se voit ; cinq adjoints par coach au moins, sur trois postes.


Depuis la V9, tranche 5 (récrit en V17) : `node scripts/check_duel.mjs` (six minutes ; `N` matchs par club et par bras, 1200) — deux copies d'un même vrai club, l'attentif (la meilleure proposition de l'adjoint) contre « Garder », sur les mêmes dés, semés ; le plan pris est celui que la période joue ; les périodes vues ne bougent pas.

Depuis la V9, tranche 6 : `node scripts/check_retours.mjs` (deux minutes ; `GRAINES=83,85,86`) — le choix d'un fil ne touche pas aux journées d'avant, son retour arrive le matin qui suit son dernier match et se recompte dans ces feuilles-là ; le jouer blessé, l'aggravation, la mémoire des commotions.

Depuis le Jalon P : `node scripts/check_arcs.mjs` (deux minutes) — chaque arc naît d'un fait relu dans le journal du club, joue son effet, se rejoue pareil ; sa valeur se mesure en blocs appariés (ses matchs avec et sans son effet, les mêmes dés), jamais en saisons appariées, qui divergent au moindre écart.

`node scripts/essai_poids.mjs <adresse>` (une demi-minute) mesure le premier écran comme un téléphone le vit, processeur ×4 : les requêtes, les octets compressés, le temps du titre ; sur le www/ de l'APK (`mobile/assembler-www.mjs`, servi à part), les trois tiennent.

`node scripts/essai_packs.mjs http://localhost:8000` (une vingtaine de minutes) signe des packs de joueurs tour après tour, avec « Aligner au mieux » un tour sur deux et « Plus tard » puis la boîte : chaque joueur signé reste dans l'alignement de l'écran, qui est celui du moteur.

Depuis la V18 : `node scripts/check_affinite.mjs` (trois minutes : chaque badge a un accord, un accord est porté par deux joueurs de la ligne à leur plus petit badge, plus d'accords font plus de chimie, la ligue garde son bonus de chimie, le levier de la chimie). Depuis la V9 (docs/refonte-v9.md § 10) : `node scripts/check_profondeur.mjs` (un quart d'heure ; `GRAINES=1 CAMPAGNES=1 RUNS_CAMPAGNE=2` en deux minutes : trois robots sur les mêmes dés, `politique` de scripts/lib/rogue_sim.mjs — le robot d'avant, l'attentif, le distrait ; les deux bouts, la première Coupe des campagnes). Ce n'est pas une vérification de la CI : `check_profondeur` est rouge tant que la première Coupe arrive avant la run 3, ou qu'après elle l'attentif gagne la Coupe d'office (les campagnes montent les exigences ; le point de départ : docs/refonte-v9.md § 14, la tranche 8 : § 21).

Depuis oct. 2026 : `node scripts/check_suivis.mjs` (une demi-minute par ligue ; `GRAINES=83,85`) — chaque fil suivi a son état chaque matin, recompté dans les feuilles, et son retour ; un joueur parti fait tomber la promesse ; l'objectif du proprio se recompte et se lève si son joueur part.

Depuis oct. 2026 : `node scripts/check_effets.mjs` (une vingtaine de minutes ; `N` matchs par club, 200 ; `IDS=q:,a:` quelques familles) — chaque effet du Rogue, en paires, se voit dans la feuille d'un soir où il joue, et sa force reste bornée (un adjoint : le style, pas la force).

Depuis la V19 : `node scripts/check_combos.mjs` (huit minutes ; `N` soirs par club, 300) — le combo de chaque coach, en paires, son moment posé : il se voit dans la feuille d'un soir, reste sous 1 V sur ses soirs d'une saison, ne joue ni sans l'un de ses deux adjoints ni sans son coach ; `node scripts/check_prolongation.mjs` (dans `tout.mjs`) — la prolongation, les tirs de barrage et la mort subite.

Depuis la V14 : `node scripts/check_personnel.mjs` (deux minutes ; `N` matchs par club) — les chiffres de chaque échelon, les doublons, et, en paires, une force qui grandit et un défaut qui fond.

Depuis la 1.0 : `node scripts/check_robot.mjs` (le robot « premier Signer », 40 saisons, avec et sans ballottage ; `BALLOTTAGE=1`, `MODE=rogue`) et `RUNS=40 CAMPAGNES=6 node scripts/check_rogue.mjs` (la courbe des runs). Les photos d'action : `node scripts/actions.mjs` les refait (deux minutes, 700 Mo téléchargés une fois) et `node scripts/check_actions.mjs` les vérifie (avec l'adresse du jeu en argument, il simule aussi l'application Android ; réseau requis). Playwright peut vivre ailleurs que dans le dépôt : `NODE_PATH=<dossier>/node_modules`.

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne montre pas une valeur brute du coffre privé `RATINGS_VAULT` (js/sim.js : `o d r c v sp`) : une cote qui s'affiche vient d'une fonction de `js/ratings.js` qui la dérive (la cote sur 20), la même que le moteur lit, jamais d'un champ interne copié dans un gabarit. (L'ancienne règle « aucune cote dans le DOM » est partie le 27 octobre 2026.)
