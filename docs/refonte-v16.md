# V16 · Le personnel, seule carte bonus

JP, 23 oct. 2026 : *les assistants coachs remplacent toutes les autres cartes de bonus ; tu peux t'en inspirer pour inventer des cartes d'assistants supplémentaires qui les remplacent.*

Les deux choix que JP a tranchés :

- **Jusqu'où** : tout bonus de jeu devient du personnel. Les outils de gérant restent.
- **La confiance d'un coach** monte par trois chemins à la fois : ses adjoints en poste, leurs échelons et leurs matchs à ton service.

## 1. Ce qui part, ce qui reste

| Famille | Cartes | Sort |
|---|---|---|
| Places (`PLACES_NEUVES`, js/places.js) | 39 | partent ; leurs idées deviennent des adjoints |
| Équipement (`EQUIPEMENT`, js/equipement.js) | 18 | part ; ses idées deviennent des adjoints à protégé (§ 2) |
| Clauses de joueur (`contrat_*`) | 12 | partent ; l'agent et le négociateur les reprennent |
| Le feu de l'atelier (l'étincelle, la braise, la traînée de poudre) | 3 | partent ; la lancée a ses adjoints (le combo, `check_combo`) |
| Personnel (`PERSONNEL`, js/personnel.js) | 21 | reste, et grandit |
| Masse salariale (`CONTRATS`, dont les contrats lourds) | 37 | reste : un outil du proprio |
| Soins | 8 | restent : l'infirmerie |
| Retouches d'édition (🖌 🪟 🔆 ✨) | 4 | restent : le cartable |
| Congédiement, rappels, échange d'un doublon | 5 | restent : des gestes de gérant |

## 2. Le personnel neuf

Le format ne change pas : un poste (`ROLES`), un moment (`si`, `MOMENTS_SI`), un effet sur les canaux, une force et un défaut, cinq échelons. Un adjoint par poste ; les huit postes sont le build.

**Les adjoints neufs** : trois par coach, plus trois neutres, soit une trentaine. Avec les 21 d'aujourd'hui, environ 50 adjoints. Chacun reprend une carte qui part, nommée dans son commentaire :
- la semaine chargée devient le préparateur du calendrier ;
- les patins aiguisés deviennent l'aiguiseur ;
- le vœu de silence devient le moine du vestiaire.

**Le protégé** : un adjoint peut travailler un joueur plutôt que l'équipe.
- Il porte ses canaux de joueur (`joueur`, `CANAUX_MUT` : ses tirs, sa précision, sa création, sa défense, ses blessures, ses arrêts).
- L'engager, c'est une décision qui porte le patron ET sa mutation (`patron` + `mutation`), deux canaux qui existent.
- Le protégé est celui que tu nommes à l'engagement ; sinon, celui que le moteur désigne (`joueurDeMutation`).
- Il garde le moment et la règle d'une rare : ±0,3 point à sa ligne (`check_places`).
- C'est ce que l'équipement et les places sur un joueur faisaient (V11, JP : *les bonus et malus touchent des joueurs*).

**La borne** : au premier échelon, son net en buts tient sous ±0,5 V, ses soirs (V14b) ; la force s'achète aux échelons.

## 3. D'où vient un adjoint (tranche 3, faite)

Ce qui sort encore d'un pack, d'un butin ou d'un palier : le personnel et les outils de gérant — la masse salariale, les soins, les retouches d'édition (`MUTATIONS_ATELIER`), le congédiement, les rappels et l'échange d'un doublon. Les places, l'équipement, les clauses et le feu n'entraient plus (`sortEncore`, js/banque.js) ; la tranche 4 les a retirés de la banque, et `sortEncore`, qui ne triait plus rien, avec eux.

| Source | Avant | V16 |
|---|---|---|
| Pack Personnel | 3 adjoints | inchangé |
| Packs de cartes (`PACKS_CARTES`) | des cartes de la banque | seulement ce qui sort encore (`tirerCartes`, js/packs.js) ; le Pack Modifs donne des retouches, le Pack Consommables des outils de gérant |
| Packs de joueurs | 1 ou 2 cartes | la 1re est un adjoint, la 2e un outil de gérant, que la taxe de luxe peut prendre (`tirerCartesDuPack`) ; le Pack du coach donne deux adjoints de sa couleur |
| Butin d'un gros match, verdict du proprio, paliers des 9e, 18e et 26e matchs | une carte parmi trois, pour une place | un adjoint parmi trois, tiré comme au Pack Personnel (`cartesDuPalier`, js/inventaire.js) |
| Un doublon | un échelon de plus | inchangé |

Un adjoint pris au palier ou au butin rejoint ton personnel au moment où sa décision est reçue (`recevoirPermanents`, js/banc.js `ajouterDecision`, une fois par palier) ; il ne prend pas de place (`placesDeLaPartie`). Un adjoint neuf pour un poste occupé attend à ta collection : l'engager chez l'entraîneur remplace celui du poste, qui y reste, d'une run à l'autre.

Le robot (scripts/lib/cartes_robot.mjs `engagerDuRobot`) engage ses adjoints comme un gérant :
- l'attentif, le premier de la couleur de son coach à un poste que sa couleur ne tient pas encore ;
- le distrait, une fois sur deux, n'importe lequel ;
- le robot d'avant, aucun.

Il le fait aux paliers et à chaque pack qu'il achète (scripts/lib/rogue_sim.mjs). D'une saison à l'autre de la run, il reporte comme le jeu la base de ses coachs, son coach en poste et son personnel (`reportDeSaison`) ; avant, il repartait chaque saison à la confiance I, avec les deux adjoints du départ.

**Ce que la profondeur en dit** (`check_profondeur`, `GRAINES=1 CAMPAGNES=1 RUNS_CAMPAGNE=2`, contre la tranche 2 sur les mêmes dés) : l'écart attentif − distrait tombe de +15,0 à +11,1 V par saison, et le distrait des bons clubs ne rate plus les séries (0 fois sur 4, contre 3). Ce n'est pas le recompte du lundi (le retirer au distrait ne change rien) : ce sont ses adjoints pris au hasard (s'il n'engage rien, l'écart revient à +15,9 et 1 fois sur 4). Un adjoint mal choisi aide encore, là où une place jouée au hasard coûtait. À régler à la tranche 5 : le défaut d'un adjoint hors de la couleur doit mordre. L'attentif − défaut passe de +5,3 à +4,6 V (± 2,1), dans le bruit. Réglé à la tranche 5a (§ 4c).

## 4. La confiance, par trois chemins

Les points d'un coach (`buildDe`, js/banque.js) :
- **sa base** : le coach choisi au départ, le report d'une saison, un coach neuf (`baseDesCoachs`) ;
- **1 par adjoint de sa couleur en poste** ;
- **1 par échelon** pris par ses adjoints ;
- **1 par tranche de 60 matchs à ton service** de ses adjoints (`MATCHS_CONFIANCE`), doublés à la couleur du coach en poste, comme les échelons.

Les cartes jouées ne comptent plus. La confiance reste une décision `coach` qui porte ses chiffres. Elle se recompte à chaque décision, quelle qu'elle soit (`palierAllume`, js/banc.js `ajouterDecision`), et au lundi du robot : les matchs à ton service montent seuls, entre deux engagements. Avant la tranche 3, seule une décision de personnel la recomptait, et un compte passé à 23 points restait à la I. Seul le coach en poste monte (V5).

**Les seuils : 3, 7 et 15** (`SEUILS`, js/coachs.js). La tranche 2 avait mis 3, 14 et 30, calculés sur un calendrier idéal : un adjoint de sa couleur aux trois paliers, chaque échelon dès qu'il s'ouvre. La tranche 3 les mesure sur le robot attentif, qui engage les adjoints de sa couleur aux paliers et dans ses packs (§ 3), et reporte d'une saison à l'autre. Quatre vrais clubs, deux saisons chacun (une mesure ponctuelle, pas un script de vérification) :

| Club | 1re saison : points au 41e · 82e | 2e saison : points au 20e · 41e · 82e |
|---|---|---|
| Rangers 1995-96 | 8 · 12 | 15 · 18 · 23 |
| Bruins 1985-86 | 4 · 5 | 7 · 9 · 11 |
| Sénateurs 2005-06 | 7 · 9 | 12 · 14 · 18 |
| Blackhawks 1990-91 | 6 · 10 | 12 · 15 · 19 |

À 14 et 30, trois clubs sur quatre n'avaient la II qu'en deuxième saison, et aucun la III. À 7 et 15, la II arrive entre le 41e et le 61e match de la première saison, et la III entre le 20e et le 61e de la deuxième : la cible. Les Bruins, un seul adjoint de leur couleur en un an, n'y arrivent pas. Un gérant qui achète le Pack du coach (deux adjoints de sa couleur) va plus vite.

Adjoints et échelons seuls peuvent maintenant mener à la III : cinq adjoints de sa couleur, à leur 3e échelon, valent 3 + 15 points.

## 4b. Le grand départ (tranche 4, faite)

**Ce qui part** : js/places.js et js/equipement.js, les clauses (`MODIFS_VIE`, js/cartes-vie.js ; `contrat_bonus`), le feu de l'atelier et les trois modifs d'un lieu (le gardien du château, le joueur de route, l'homme des séries) : 75 cartes. Trois adjoints du feu arrivent ; la banque passe de 182 à 110 cartes. Avec elles, `PLACES`, la carte de trop (son choix d'À faire, sa scène `sceneDeLaCarteDeTrop`), l'onglet « Tes places » du Marché, le butin « pour une place », `sortEncore`. Les clés de mutation `contrat_annee`, `contrat_prolonge` et `contrat_leader` restent : ce sont les réponses d'un fil (js/vie-gm.js), pas des cartes.

**Le feu** (`check_combo`, en paires) : trois adjoints rares de l'Aigle, chacun à son poste, hors de la direction du vendeur de chandails.

| Adjoint | Reprend | Poste | Portée | Seul |
|---|---|---|---|---|
| ☄ L'allumeur | l'étincelle | attaque | le meilleur marqueur de la 1re ligne | +0,7 V, 91 soirs de lancée (témoin 72) |
| 🪔 Le gardien de la braise | la braise | physique | le meilleur marqueur de la 1re ligne | +0,4 V, 79 soirs |
| 💫 Le semeur de poudre | la traînée de poudre | chef | un compagnon du meilleur marqueur | +0,4 V, 90 soirs |

Après deux poussées de sa force (`LIGNES_DU_FEU`, js/personnel.js), un feu tient aussi la 2e ligne, et la poudre tous les patineurs des deux premières (`porteeDuFeu`, js/sim.js). Le combo d'une ligne fait 1,46 fois les soirs de lancée de ses pièces ; le build complet (les trois à deux lignes, et le vendeur) 5,8 fois ceux du témoin, +2,7 V, et 418 🪙 par saison au vendeur. La poudre sur les deux compagnons d'une seule ligne passait la borne des soirs (42) et faisait un complet moins fort que l'allumeur seul : un compagnon à une ligne, toute la ligne à deux.

**Les routes de la semaine** : leurs 25 cartes étaient des places. Elles vivent maintenant dans js/noeuds.js (`CARTES_DE_ROUTE`), les mêmes chiffres et les mêmes tirages (aucune différence sur 7 800 routes de 200 graines), et `check_places` les mesure avec les réponses des dossiers. Écarté : en faire des dossiers à une réponse (la route perd sa variété) ou des adjoints (une route dure une semaine, un adjoint un poste).

**`check_si`** mesure trois adjoints d'un moment à la place des modifs d'un lieu : 🧥 l'ancien capitaine à domicile, 🧭 l'entraîneur des gardiens de route à l'étranger, ⚙ le directeur de l'usine en séries (la saison identique au but près).

**Une partie d'avant la V16** se relit : une carte que la banque ne connaît plus ne se montre plus (`cartesDeLaPartie`), ne prend pas de case au verso (`poseesSur`), une mutation inconnue ne joue pas, et un effet déjà joué porte ses chiffres et se rejoue. `check_sauvegardes` le prouve sur une partie fabriquée (une place jouée, un équipement posé, une clause, un feu gardé, une carte de palier, un report).

## 4c. Mal assorti (tranche 5a, faite)

**D'où venait l'avantage du distrait.** Mesuré sur les mêmes dés (`check_profondeur`, le petit, le distrait seul changé) : sans ses échelons achetés au hasard, l'écart défaut − distrait passe de +6,4 à +12,3 V et le distrait rate les séries 2 fois sur 4 ; sans ses engagements au hasard, +11,3 V et 1 fois sur 4 ; sans la confiance, rien ne bouge (+5,8 V). Un échelon pris sans réfléchir valait donc +6 V par saison : il poussait toujours une force, et aucune force ne coûtait hors de sa couleur.

**Le correctif, dans le moteur** (`assortir`, `patronsDuSoir`, js/sim.js) : un adjoint d'une autre couleur que le coach en poste joue à contre-courant. Sa force rend la moitié de ce qu'elle rend chez son coach (un canal à ×1,1 devient ×1,1^0,5), et son défaut mord une fois et demie plus (`MAL_ASSORTI`). Ses échelons suivent : ils poussent une force qui ne rend qu'à moitié. Un adjoint neutre, ou un soir sans coach, joue tel quel ; les minutes d'un trio (`F`, `D`) ne bougent pas. La couleur d'un adjoint est celle de ses canaux (`coachDesCanaux`), comme à la banque.

**Ce qui ne bouge pas** : `check_places` et `check_personnel` mesurent chaque adjoint sans coach en poste, donc tel quel, sous sa borne. Sur 54 adjoints, 11 sont neutres ; les autres se partagent les huit coachs (de 5 à 8 chacun).

**Mesuré** (`GRAINES=1 CAMPAGNES=1 RUNS_CAMPAGNE=2`, mêmes dés) :

| | avant | après |
|---|---|---|
| attentif − distrait | +11,4 V | +13,9 V |
| défaut − distrait | +6,4 V | +8,9 V |
| attentif − robot d'avant | +5,0 V | +5,0 V ✓ |
| le distrait des bons clubs rate les séries | 0 fois sur 4 ✗ | 1 fois sur 4 ✓ |

**À faire, à l'écran** (tranche 5b) : les vraies stats d'un adjoint (`statsDe`, js/impact.js) ne disent pas encore le prix d'un adjoint mal assorti ; la fiche de l'entraîneur doit le dire avant l'engagement.

**Les minutes d'un trio se disent en chiffres** (`check_banque`, « se lisent en chiffres ») : l'entraîneur du bas et le costumier ne faisaient que déplacer des minutes de trio, et leur puce ne portait aucun chiffre. La puce de la glace (`motsDEffet`) dit maintenant l'unité qui gagne le plus et celle qui perd le plus, en minutes d'un match de 60, sur les parts de base du moteur (`PART_UNITE`, `RANGS_DE_GLACE`) : « Le bas joue plus : 4e trio ≈ +2,8 min, 1er trio ≈ −2,5 min par match ».

## 4d. L'essence : des cartes de joueurs (tranche 6)

JP, 24 oct. 2026 : *en gros, remplacer toutes les cartes et cie par les adjoints et les événements avec choix* ; puis *à la limite, possibilité d'avoir des cartes qui upgradent joueurs, coachs et assistants coachs, et quelques consommables, mais rares, pas genre le main gimmick* ; *on avait tellement tout compliqué que je veux ramener le jeu à son essence de cartes*. La boussole : *quelqu'un qui a joué à EHM, New Star Soccer, MLB The Show mobile se retrouve facilement* ; pas de passifs de joueurs maintenant.

**Le cœur** : les cartes de JOUEURS (packs, cartable, classeur, éditions) et le personnel (un adjoint par poste, comme le personnel d'EHM). Le reste devient un choix d'À faire (une voix, le fait, les options) ou part.

**Une seule petite famille de cartes rares** (`RARES`, js/banque.js), comme les cartes d'objet de MLB The Show : dix cartes, qui sortent rarement, et qui se jouent à la maison de ce qu'elles montent.

| Carte | Ce qu'elle monte | Où elle se joue | Le canal |
|---|---|---|---|
| 🖌 🪟 🔆 ✨ les quatre retouches | l'édition d'un joueur | au verso de sa carte | la mutation d'atelier (inchangée) |
| 🎞 Le stage du coach (neuve) | la confiance du coach en poste, d'un cran | chez l'entraîneur | `coachsDeBase` : les points qui manquent au seuil suivant |
| 🖊 La formation (neuve) | un échelon de plus ouvert pour un adjoint | chez l'entraîneur | une copie de plus (`copiesPerso`, comme un doublon) |
| 🧊 💆 🏥 trois soins | le retour d'un blessé | à l'infirmerie | les gestes de soin (inchangés) |
| 📟 L'échange d'un doublon | ton doublon le plus fourni contre un joueur de son époque | Effectif › Joueurs | une décision `ballottage` (inchangée) |

**D'où elles sortent** : la deuxième carte d'un pack de joueurs, une fois sur quatre (`RARE_DU_PACK`) ; sinon le pack ne donne que son adjoint. Le butin, les paliers des 9e, 18e et 26e matchs et le verdict du proprio offrent trois adjoints, comme avant.

**Ce qui devient un choix** (js/dossiers.js, la porte des dilemmes) :
- **La masse salariale** (37 cartes, dont les contrats lourds et la taxe de luxe) → le dossier du proprio **« La masse salariale »**, qui s'ouvre quand ton espace sous le plafond est mince (le fait : ta masse, ton plafond, ton contrat le plus lourd, nommé). Ses réponses : une retenue sur ce contrat, un contrat lourd (de l'espace tout de suite, un prix ses soirs), ou rien ; chacune passe par la décision `plafond` qui existe (`plafondDe`).
- **Le congédiement** → le dossier du proprio **« La tête de l'entraîneur »**, quand la série de défaites est vraie (quatre de suite, ou plus) : congédier pour l'un de deux coachs (un coach neuf, `coachNeuf`), ou le garder.
- **Les rappels du club-école** → déjà un remède de la blessure (À faire › Infirmerie) ; la carte part, et ses variantes (le pilier, l'ancien) aussi.
- **Les autres soins** (le ruban, l'acupuncteur, le baume, le deuxième avis, le chirurgien du lundi) partent : trois soins suffisent.

**Ce qui part de l'écran** : le Marché › Tes cartes (chaque carte qui reste a sa maison), l'inventaire de cartes, la revente d'une carte, les packs de cartes autres que le Pack Personnel (`PACKS_CARTES`) et la malédiction d'un pack. Le Marché garde la boutique (les packs de joueurs, le personnel, ton club).

**Une méta d'avant** : chaque carte de son inventaire qui n'existe plus rend `REMBOURSEMENT_CARTE` 🏅 (lu une fois, `lireMeta`) ; une partie en cours relit ses décisions jouées, qui portent leurs chiffres.

## 5. Les règles fermes qui changent (CLAUDE.md)

- « Chaque coach a au moins huit cartes, dans deux familles au moins ; le Rhino, l'Abbé et le Contremaître… six places » devient : chaque coach a au moins cinq adjoints, sur trois postes au moins.
- La règle des **places** et de la carte de trop disparaît ; « Une carte peut ne jouer que dans son moment » vaut pour l'adjoint.
- La **confiance** : une décision `coach` qui porte ses chiffres, comptée par les trois chemins.
- Le **combo de la lancée** : l'étincelle, la braise et la poudre deviennent des adjoints ; le vendeur de chandails en est déjà un.

## 6. Les tranches

| Tranche | Ce qu'elle fait | Ce qui la prouve |
|---|---|---|
| 1. Les adjoints neufs | la trentaine d'adjoints, le protégé | `check_places` (en paires, sous la borne, la rare se voit), `check_personnel`, `check_si` |
| 2. La confiance | les trois chemins (`palierAllume`, js/banque.js ; js/coachs.js) | `check_coachs`, `check_voies` |
| 3. Les sources | packs, butin, paliers, doublons | `check_packs`, `check_rogue`, `essai_packs` |
| 4. Le grand départ (faite) | places.js, equipement.js, les clauses, le feu, l'onglet « Tes places », les règles de CLAUDE.md | `check_mort`, `check_banque`, `check_combo`, `check_sauvegardes` |
| 5. L'écran et la run | l'entraîneur montre tes postes et ta collection ; la run se joue | `essai_rogue`, `check_profondeur`, `check_robot` |
| 6. L'essence (§ 4d) | les cartes rares, la masse salariale et le congédiement en dossiers, le Marché › Tes cartes part | `check_banque`, `check_dossiers`, `check_sauvegardes`, `check_rogue`, `essai_rogue` |
