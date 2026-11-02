# Le Rogue, revu et mesuré — 2 novembre 2026

JP (2 nov. 2026) : *le roguelike, il est pas facile à rendre le fun et balancé*. Ce rapport mesure le Rogue tel qu'il est sur `main` (`8a2660d`, refonte V22), avec les juges du dépôt et une revue de design faite selon `.claude/agents/rogue-design.md`. Il ne change aucun chiffre du jeu : il propose, JP tranche.

## 1. Ce que les juges disent

### `check_pouvoirs`, l'échantillon plein (N = 600, 6 min 49)

- **Tout est sous sa borne.** Chaque pouvoir seul sous 2,5 V (I et II) ou 4 V (l'ultime), aucun n'est un piège ; chaque adjoint reste un style (±1,5 V sur une saison) ; le personnage complet va de +3,7 V (🪜) à +9,9 V (🦏), sous les 16 V.
- **Le duo vedette est réglé** : +2,3 V (borne 2,5), après la correction du 1er novembre. Le « prof de discipline » de `PLAN.md` n'existe plus depuis la V22 (le staff est parti) : les deux lignes de `PLAN.md` étaient périmées, elles sont mises à jour avec ce rapport.
- **Un seul rouge, que le CI ne voit pas** (il tourne à `N=20`) : « chaque pouvoir se voit dans la feuille d'un soir où il joue » échoue pour 🦏 **L'usure** (0,94 : +3,8 mises en échec par soir) et 💥 **Le choc** (0,76 : +2,8). La règle veut ±4 mises en échec pour qu'un effet se voie.

### `check_profondeur`, complet (4 graines × 8 clubs, 2 campagnes de 12 runs, 14 min 22)

Six vérifications sur six au vert. Trois chiffres comptent :

| Mesure | Résultat | Ce que ça dit |
|---|---|---|
| L'attentif contre le distrait | **+17,6 V par saison** (± 1,5) | Dans une saison, bien jouer compte beaucoup. |
| L'attentif contre le robot d'avant (le premier choix partout) | **+5,1 V par saison** (± 1,0), pour un seuil de 5 | Lire ses choix rapporte à peine plus que prendre le premier. |
| La première Coupe | attentif : runs 6 et 4 · robot d'avant : runs 6 et 4 · distrait : jamais | Sur une carrière, l'attentif et le robot d'avant arrivent **au même moment**. |
| La longueur des premières runs | `1·L0 1·L0 1·L0` pour les trois robots | Les trois premières runs ne durent **qu'une saison** : congédié dès la première, trois fois de suite. |

Ailleurs : un club moyen bien mené finit premier 5 fois sur 16, un bon club mal mené rate les séries 3 fois sur 16, et après sa première Coupe l'attentif la regagne 29 % des runs (cible : 25 à 67 %).

## 2. Ce que la revue de design trouve

Classé du plus payant au moins payant. Les chiffres en gras ont été relus dans le code.

### 2.1 Passé le 26e match, il ne se passe plus rien

- Les trois paliers d'adjoints tombent avant le 27e match (**`PALIERS_PACK = [9, 18, 26]`**, js/inventaire.js).
- Les six histoires ne s'ouvrent qu'une fois par saison (`dossierDeLaSemaine(…, deja)`, js/dossiers.js), alors que `semaineAHistoire` tire environ **14,3 lundis à histoire par saison** (mesuré sur 200 graines). La banque est vide vers la mi-saison, et les saisons 2 à 6 d'une run rejouent les mêmes six histoires.
- Du 30e au 82e match, il reste les gros matchs des rivaux et l'objectif du proprio.

**Options**
- **A (recommandée)** : étaler les paliers, par exemple `[12, 30, 50, 68]` (js/inventaire.js, scripts/lib/cartes_robot.mjs). Touche la règle « aux 9e, 18e et 26e matchs » (.claude/rules/rogue.md). La preuve est à écrire : `scripts/mesure_rythme.mjs`, les matchs entre deux décisions de l'attentif, aucun trou de plus de 10 matchs ; plus `essai_rogue` pour les arrêts.
- **B (avec A)** : une histoire peut revenir après 5 semaines de repos, plus trois histoires de deuxième moitié déjà notées (le fond du classement, le sommet, le dos-à-dos). Fichier : js/dossiers.js. La preuve : `check_dossiers`, `check_incidents`, `mesure_rythme`.
- **C** : assumer le creux, avec « jusqu'au prochain choix » qui saute au prochain gros match. Le moins cher, mais ça ne règle pas le fond.

### 2.2 Le coach du départ : toujours les trois mêmes, et un qui domine

- Au Club de garage, `coachsOuverts(0)` ouvre trois voies, et `lotoDesCoachs` ne tire qu'une carte par philosophie. Le loto offre donc **toujours** la Tortue, le Frelon et le Rhino ; voir les huit demande la Dynastie.
- `ROBOT_COACH` a mesuré le Frelon à +6,5 V, contre +1,4 à +4,0 pour les sept autres (docs/decisions.md, 31 oct.), parce que la ruée et le bourdonnement jouent la même 3e période et s'additionnent. Cette mesure date d'avant la V22 : elle est à refaire.

**Options**
- **A (recommandée)** : le bourdonnement ne joue que si tu mènes en 3e, donc jamais en même temps que la ruée (js/pouvoirs.js). La preuve : `COACHS=essaim N=600 node scripts/check_pouvoirs.mjs`, puis `check_profondeur` avec `ROBOT_COACH` pour chacune des trois voies du départ, à moins de 1,5 V l'une de l'autre.
- **B** : un loto de trois voies tirées parmi les huit dès la première run ; le prestige ouvre autre chose (la maîtrise, les cartes du cartable). Touche la décision « le coach au prestige » (docs/decisions.md). La preuve : les campagnes de `check_profondeur`, la première Coupe toujours à la run 3 ou plus tard.

### 2.3 Les adjoints : poser dès qu'une case se libère domine

- **`SEJOUR = 12` et `REPOS = 12`** (js/adjoints.js) : deux cartes en alternance couvrent une case toute la saison. Une case vide est perdue, donc poser tout de suite domine ; c'est ce que fait le robot (`lundiDuRobot`).
- Le style se lit sur ton effectif (`fitDAdjoint`), pas sur l'adversaire : rien ne pousse à attendre le bon moment.
- Les offres arrivent de partout (trois paliers, chaque gros match gagné, le verdict, une histoire), environ 8 à 12 par saison, pour une seule case jusqu'au niveau 3. Après la deuxième carte, « un parmi trois » ne change rien qu'on voie.
- 📋 « Un adjoint en vue » (−25 🪙 pour une carte) est un faux choix : « Garder l'argent » domine.

**Options**
- **A (recommandée)** : `REPOS` à 20, plus long que le séjour. Deux cartes ne couvrent plus une case ; la troisième et la quatrième comptent, et choisir quelles semaines couvrir devient un choix. Une constante. La preuve : `check_pouvoirs` (une carte reste sous ±1,5 V) et un script à écrire, `scripts/mesure_main.mjs`, la part des cartes offertes qui ne jouent jamais un séjour, sous 25 %.
- **B (avec A)** : moins d'offres, qui comptent. Le butin d'un gros match gagné donne des jetons ou de l'expérience plutôt qu'un adjoint, et 📋 « Un adjoint en vue » part (js/saison.js `recompenseOuverte`, js/dossiers.js, cartes_robot.mjs). Touche la liste des moments forts (.claude/rules/rogue.md).
- **C** : une carte se joue une fois et part. Ça défait le « elle revient dans la main » tranché à la V22 : à JP de dire.

### 2.4 Le talent du niveau 2 : un écran à une seule réponse

- Les pouvoirs s'ouvrent aux niveaux 1, 3 et 5 : au niveau 2, **`pouvoirsOuverts(2)` ne rend que le pouvoir I** (js/pouvoirs.js), et l'écran du talent (js/saison.js) n'offre que lui. Au niveau 4, il y en a deux.
- Avec **`SEUILS_NIVEAU = [0, 10, 25, 45, 70]`** et 25 à 60 points d'expérience par saison, le coach est au plus haut dès la saison 2 ou 3 : une run de 4 à 6 saisons finit sans qu'il monte encore.

**Options**
- **A (recommandée)** : couper l'écran du niveau 2 ; le talent s'applique seul et Hier soir le dit. Le vrai choix reste au niveau 4 (js/saison.js, cartes_robot.mjs). La preuve : `essai_rogue`, `check_verite`.
- **B** : une vraie alternative au niveau 2 — « +50 % au pouvoir I » ou « une case d'adjoint tout de suite » (`CASES_PAR_NIVEAU` à `[1, 2, 2, 2, 3]`). La preuve : `check_pouvoirs`, le personnage complet sous 16 V.

### 2.5 Les histoires : deux faux choix sur six

- 🥶 **La disette** : le défi met ses lancers à ×1,5 dans les deux issues ; ses buts font ×1,95 si ça passe et ×0,75 sinon, ×1,35 en moyenne. « Le reposer » coûte deux matchs sans lui et ne rapporte rien. Son `bon` (« la tête vidée ») ne nomme aucune ligne, contre `check_mots`.
- 🥅 **Le gardien battu** : ×0,78 ou ×1,22 à pile ou face, neutre en moyenne, alors que l'auxiliaire est presque toujours plus faible. « Le renvoyer » domine.
- 📸 **La vedette** est un bon choix : 20 🪙 contre +5 d'expérience, que le robot pèse 0,20 et 0,25 V.

**Options**
- **A (recommandée)** : un vrai gain à l'option prudente — au retour du repos, ses lancers ×1,2 sur 6 matchs ; l'auxiliaire donne +20 de jambes au partant et un départ « chaud » au retour (js/dossiers.js). La preuve : `check_effets`, `check_mots`, et un script à écrire, `scripts/mesure_histoires.mjs`, qui pèse chaque réponse en V par `chiffresDuSoirSous` (comme `fitDAdjoint`) : les deux réponses à ±0,3 V l'une de l'autre, ou de nature opposée.
- **B** : rendre le défi moins rentable (ses lancers à ×1,0, ou une chance de 2 sur 6).

### 2.6 La boutique n'est pas mesurée comme un choix

`packVoulu` (scripts/lib/rogue_sim.mjs) achète dans le même ordre pour les trois robots : l'ablation ne peut pas dire si choisir un pack compte. Avec un seul joueur signé par pack et des prix qui montent de 40 % par achat, un pack peut dominer sans que personne l'ait vu.

**Option** : un attentif qui lit l'offre (la valeur attendue du meilleur joueur, sur le prix), avec `ROBOT_SAUF=boutique`. La preuve : `CAMPAGNES=0 GRAINES=4 FILS=2 node scripts/check_profondeur.mjs` (une vingtaine de minutes). Sous 0,5 V d'écart avec le robot d'avant, le choix de pack est faux : on coupe des rayons plutôt que d'en ajouter.

## 3. Ce qui se fait sans toucher une règle

Un premier lot, chaque réglage seul et prouvé :

1. **L'usure et le choc se voient** — *fait (2 nov.)* : robustesse 2,5 et 2 → 3,1 (js/pouvoirs.js) ; +3,8 et +2,8 → +4,8 mises en échec le soir où ils jouent, +2,2 → +2,3 V et +1,6 → +2,0 V (borne 2,5) ; `N=600 node scripts/check_pouvoirs.mjs` vert au complet (31 sur 31).
2. **`REPOS` à 20** — *fait (2 nov.)* : js/adjoints.js, la page des règles, la règle et le vocabulaire. `scripts/mesure_main.mjs` (neuf) : les cartes d'adjoint qui ne jouent jamais un séjour 12,6 → 10,7 % (cible : sous 25 %, déjà tenue avant), les cases occupées 81 → 73 %. Le constat de 2.3 était plus fort que la mesure : l'attentif faisait déjà jouer presque toutes ses cartes ; le repos plus long laisse la case vide un quart du temps, et le moment de poser compte. `check_pouvoirs` : chaque adjoint reste un style (−0,5 à +0,4 V sur 31 matchs).
3. **Le robot de la boutique** — *fait (2 nov.)* : l'attentif lit l'offre (`packLu`, scripts/lib/rogue_sim.mjs), `ROBOT_SAUF=boutique` la lui retire. `CAMPAGNES=0 GRAINES=4 FILS=2 check_profondeur` : +6,2 V (± 1,1) sur le robot d'avant en lisant, +6,7 V (± 0,9) sans — l'écart, −0,5 V, est dans le bruit : le choix de pack ne compte pas. À ce niveau de déblocages, la boutique ne vend que le Bronze et l'Époque ; les campagnes, qui ouvrent les autres packs, ne sont pas mesurées. Rien n'est changé dans le jeu.

## 4. Ce que JP tranche

1. Étaler les paliers des 9e, 18e et 26e matchs (2.1 A) ?
2. Une histoire peut-elle revenir dans la même saison (2.1 B) ?
3. Le coach du départ : empêcher le cumul du Frelon (2.2 A), et le loto parmi les huit voies dès la première run (2.2 B) ?
4. Les adjoints : `REPOS` à 20, et moins d'offres (2.3 A et B) ?
5. Le talent du niveau 2 : couper l'écran (2.4 A) ou lui donner une vraie alternative (2.4 B) ?
6. Les deux histoires à faux choix : relever l'option prudente (2.5 A) ou baisser le défi (2.5 B) ?
7. Les trois premières runs d'une saison chacune : voulu, ou trop dur ?

## Comment ces chiffres ont été faits

- `node scripts/check_pouvoirs.mjs` (N = 600, quatre processus) et `node scripts/check_profondeur.mjs` (complet), sur `8a2660d`, le 2 novembre 2026.
- La revue de design : lecture du code et des refontes V3 à V22, vérifiée contre `docs/decisions.md` pour ne pas reproposer une idée déjà retirée ; une mesure (`semaineAHistoire` sur 200 graines). Les chiffres de 2.1 à 2.4 marqués en gras ont été relus dans le code.
