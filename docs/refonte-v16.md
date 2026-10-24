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

Ce qui sort encore d'un pack, d'un butin ou d'un palier : le personnel et les outils de gérant (`sortEncore`, js/banque.js) — la masse salariale, les soins, les retouches d'édition (`MUTATIONS_ATELIER`), le congédiement, les rappels et l'échange d'un doublon. Les places, l'équipement, les clauses et le feu n'entrent plus ; ceux déjà pris se jouent jusqu'à la tranche 4.

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
| 4. Le grand départ | places.js, equipement.js, les clauses, le feu, l'onglet « Tes places », les règles de CLAUDE.md | `check_mort`, `check_banque`, `check_combo` |
| 5. L'écran et la run | l'entraîneur montre tes postes et ta collection ; la run se joue | `essai_rogue`, `check_profondeur`, `check_robot` |
