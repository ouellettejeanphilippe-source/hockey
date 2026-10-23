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

## 3. D'où vient un adjoint

| Source | Avant | V16 |
|---|---|---|
| Pack Personnel | 3 adjoints | inchangé |
| Packs de cartes (`PACKS_CARTES`) | des cartes de la banque | des adjoints, par coach ou par poste ; la revente reste sous 40 % (`check_packs`) |
| Packs de joueurs | 1 ou 2 cartes | 1 adjoint |
| Butin d'un gros match, paliers des 9e, 18e et 26e matchs | une carte parmi trois, pour une place | un adjoint parmi trois |
| Un doublon | — | un échelon de plus (comme aujourd'hui) |

Les places (`PLACES`), la carte de trop et l'onglet « Tes places » de l'inventaire partent. Un adjoint neuf pour un poste occupé : tu choisis qui garde le poste ; l'autre attend à ta collection, d'une run à l'autre.

## 4. La confiance, par trois chemins

Les points d'un coach se comptent ainsi :
- **1 par adjoint de sa couleur en poste** ;
- **1 par échelon** pris par ses adjoints ;
- **1 par tranche de matchs à ton service** de ses adjoints (`MATCHS_CONFIANCE`, à mesurer).

Les paliers II et III gardent leurs seuils (`SEUILS`), recalibrés pour qu'une run attentive atteigne la III vers le milieu de la deuxième saison. `check_voies` garde sa cible : à sa III, sur une équipe bâtie pour lui, chaque coach vaut de +6 à +8 V.

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
