# V31 · Le Rogue en fluide : téléphone, tablette, ordinateur

Le devis (gabarit : `docs/gabarits/devis.md`). Ce document est le plan d'ensemble et le devis de la **tranche 1** (la coquille et le bureau) ; les tranches 2 et 3 auront chacune le leur (`docs/refonte-v31-2.md`, `-3.md`), pour que `check_refonte` juge ce que chaque PR retire.

## 1. Ce que JP a dit

JP, 25 nov. 2026 : *Aussi, ui adapté à toutes les tailles de l'écran, pas juste mobile.* Puis, entre « le bureau s'étale » et « tout le Rogue » : **tout le Rogue en fluide**. Et : *use the web design one from this* (les Web Interface Guidelines de Vercel, `/web-design-guidelines`).

Quatre questions tranchées le même jour, les chiffres dans chacune (§ 10) : sur un grand écran **le bureau s'étale en panneaux** ; sur un petit écran **le milieu de la scène défile** ; **code direct, par tranches**.

## 2. Ce que le joueur ressent

Le fantasme : *mon bureau de DG est un vrai bureau*. Au téléphone, une main, un pouce, comme aujourd'hui. À l'ordinateur, l'écran d'un EHM : je vois ce soir, ce que le proprio attend, mon banc et le classement autour de moi sans changer d'onglet ; un tableau de stats montre toutes ses colonnes d'un coup.

Ce que ça répare, mesuré sur le plan fixe d'aujourd'hui (390 × 844, mis à l'échelle par `--rn-k`, borné à 1,25) :

| L'écran | L'échelle | Ce qu'on voit |
|---|---|---|
| Un ordinateur, 1440 × 900 | 1,066 | une colonne de 416 px : 29 % de la largeur, le reste est noir |
| Une tablette debout, 820 × 1180 | 1,25 | une colonne de 487 px : 59 % de la largeur |
| Un petit téléphone, 360 × 640 | 0,758 | tout rapetisse : un bouton de 44 px en fait 33, un texte de 13 px en fait 10 |

Le jour ordinaire reste rapide : un soir tient toujours en cinq touchers. Rien de spectaculaire ici ; le pic reste le match.

## 3. Les règles du jeu

Aucune règle de jeu ne change : ni un chiffre, ni un geste, ni une phase. Ce qui change est **où chaque bloc se pose**, et qui le décide : la feuille de style, plus les scènes.

### 3.1 La coquille

Le plan (`.rn-plan`) n'a plus de taille : il prend tout l'écran et se partage en une grille de trois rangées, sans une ligne de JavaScript.

```
┌──────────────────────────┐   ┌──────┬───────────────────────────────────────┐
│ en-tête (le HUD)         │   │      │ en-tête (le HUD)                      │
├──────────────────────────┤   │ rail ├───────────────────────────────────────┤
│                          │   │      │                                       │
│ le milieu                │   │      │ le milieu                             │
│ (défile s'il est trop    │   │      │                                       │
│  haut)                   │   │      │                                       │
├──────────────────────────┤   │      ├───────────────────────────────────────┤
│ le bas : boutons, onglets│   │      │ le bas : les boutons de la scène      │
└──────────────────────────┘   └──────┴───────────────────────────────────────┘
        étroit, moyen                               large
```

- **Trois largeurs**, lues sur le plan lui-même (une requête de conteneur, comme `pool` et `roster` au 82-0) : **étroit** sous 700 px, **moyen** de 700 à 999, **large** dès 1000 (le seuil du rail du site).
- **L'en-tête** garde son ordre et ses cellules ; il dégage l'encoche (`env(safe-area-inset-top)`).
- **Le milieu** (`.rn-milieu`) est la seule chose qui défile, de haut en bas, quand il ne tient pas (`overscroll-behavior: contain`). Sur un écran assez haut, rien ne défile, comme aujourd'hui.
- **Le bas** porte les boutons de la scène ; au bureau, les cinq onglets. En large, les onglets deviennent **un rail à gauche** (leur icône au-dessus de leur mot, le même ordre) et le bas ne garde que « Jouer ce soir ». Il dégage la barre du téléphone (`env(safe-area-inset-bottom)`).
- **Rien n'est mis à l'échelle** : une cible fait 44 px sur tous les écrans, un texte a la taille de son jeton (`--t-1` à `--t-7`).

### 3.2 Une scène

Une scène reste une fonction pure `(S, V) → HTML`. Elle rend trois morceaux nommés — `<header class="rn-hud">`, `<main class="rn-milieu …">`, `<footer class="rn-bas">` (et `<nav class="rn-onglets">` au bureau) — et **plus aucune position** : ni `left`, ni `top`, ni `bottom` dans un attribut `style`. Le milieu porte le nom de sa composition (`rn-c-bureau`, `rn-c-tableau`, `rn-c-lecture`…), que la feuille range pour chaque largeur.

### 3.3 Le bureau (tranche 1)

| Onglet | Étroit (le téléphone) | Large (l'ordinateur) |
|---|---|---|
| **Bureau** | une pile : ce soir, le proprio, le fil, ton banc ; « Jouer ce soir » en bas | trois colonnes : *ce soir* et *ton banc* · *le proprio* et *le fil* · *autour de toi* (les cinq clubs qui t'entourent au classement, la ligne des séries) et *à venir* (tes cinq prochains matchs) |
| **Alignement** | Lignes ou Banc (le segment) | les lignes à gauche, le coach et le banc à droite, sans segment |
| **Masse** | le plafond, puis les salaires | le plafond à gauche, les salaires à droite |
| **Ligue** | le segment, un tableau qui glisse de côté | le même segment ; le tableau montre toutes ses colonnes s'il a la place, et ne glisse que s'il ne l'a pas |
| **Mon club** | idem | idem ; « Matchs » : les trois chiffres à gauche, la liste à droite |
| La page d'un club, un match passé, le résultat | une colonne | deux colonnes : ce qu'on lit (le tableau, la vue du sommaire) et ce qui l'accompagne (ses chiffres ; ton soir) |

Les deux panneaux neufs du bureau large (*autour de toi*, *à venir*) ne se voient qu'en large : au téléphone, leur maison reste la Ligue. Toucher *autour de toi* ouvre le classement ; toucher un match à venir ouvre la page du club.

En moyen (la tablette) : la pile de l'étroit, en deux colonnes quand un onglet en a deux à dire (le bureau : ce soir et le proprio à gauche, le fil et le banc à droite).

### 3.4 Les scènes illustrées (tranches 2 et 3)

Elles gardent leur composition (les écussons, les cartes, les portes) et leur ordre de lecture. En étroit : la pile d'aujourd'hui. En large : la composition se centre (960 px au plus) et met côte à côte ce qui se compare — la feuille du soir, leur club et le tien face à face, ta chance et tes gestes entre les deux ; l'échange, l'arrivant et celui qui sort ; le repêchage, le vestiaire en grille et ton effectif à côté ; le marché, ses rayons de front. Une carte de jeu ne grandit pas au-delà de sa taille de carte (elle ne se redessine pas : JP, deux fois).

### 3.5 Entre les tranches

Une scène pas encore refaite garde son plan fixe, mis à l'échelle comme aujourd'hui, au centre de l'écran : la coquille reconnaît une scène neuve à son `<main class="rn-milieu">`. La dernière tranche retire le plan fixe et son échelle.

## 4. Les chiffres

Aucune formule de jeu. Les seuls nombres sont des largeurs (§ 8).

## 5. Les cas limites

- **Un écran très court** (360 × 560, le clavier ouvert, un téléphone couché) : le milieu défile ; l'en-tête et le bas restent. Couché sous 500 px de haut, l'en-tête se réduit à une ligne.
- **Un écran très large** (2560 px) : le milieu se centre à 1400 px au plus ; le rail reste à gauche.
- **Une fenêtre qu'on redimensionne** : la grille suit, sans écouteur `resize` ; le milieu garde sa place de défilement.
- **Le direct et la fiche** s'ouvrent par-dessus, à leur largeur à eux : inchangés.
- **Les tableaux de stats** : le nom figé à gauche et la tête en haut restent, à toutes les largeurs.
- **Le clavier et la manette** : l'ordre du DOM est l'ordre de lecture (l'en-tête, le milieu, le bas, puis le rail) ; A confirme, B revient, Start ouvre la pause. Le focus ne passe jamais sous l'en-tête ni sous le bas (`scroll-padding`).
- **Une vieille sauvegarde** : rien à relire, l'état de la run ne change pas ; `V` (ce que l'écran retient : l'onglet, le segment) non plus.
- **Hors ligne** : aucun fichier neuf ; `sw.js` ne change que de version.
- **`prefers-reduced-motion`** : rien de neuf ne bouge.

## 6. Ce qu'il touche

Tranche 1 : `js/run-scenes.js`, `js/run-jeu.js`, `style.css`, `sw.js`, `js/version.js`, `scripts/check_scene.mjs`, `scripts/lib/cibles.mjs`, `scripts/essai_run.mjs`, `.claude/rules/interface.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`, `.claude/agents/rogue-ux.md`, `docs/decisions.md`, `LIVRAISON.md`.

Les règles fermes :

- **« Un plan fixe, plein écran » : un plan de 390 × 844 mis à l'échelle** (interface.md) — **défaite** (JP, 25 nov. 2026 : *tout le Rogue en fluide*). Elle devient « trois rangées, trois largeurs ».
- **« Une scène ne défile jamais »** — **défaite pour un écran trop court** (JP, 25 nov. 2026, la règle reposée : *son milieu défile*). L'en-tête et le bas ne défilent jamais.
- **« Un tableau de stats glisse de côté, aucun autre cadre ni la scène »** — respectée ; en large il ne glisse que s'il manque de place.
- **« Une cible fait 44 × 44 »**, **« une ligne qu'on touche fait 44 px »** — respectées, et enfin vraies sur un petit téléphone.
- **« Le HUD est toujours au même endroit »** — respectée : en haut, sur toute la largeur du milieu.
- **« Un soir ordinaire tient en cinq touchers »**, **« le fil n'est pas une boîte à vider »**, **« le Rogue a l'allure du 82-0 »** — respectées.
- **« Une carte ne se redessine pas d'un écran à l'autre »** — respectée.
- **« Mobile d'abord »** — respectée : l'étroit est la base de la feuille, le moyen et le large s'y ajoutent.

Les clés de sauvegarde ne bougent pas.

## 7. Ce qui part

### Tranche 1 (ce devis)

- `cadre` (js/run-scenes.js) — la boîte posée au pixel entre le HUD et les onglets (`cadre(html, haut, bas0)`), et sa classe `rn-cadre`. Remplacées par le milieu de la grille (`milieu`, `.rn-milieu`) et, pour un tableau, sa propre boîte qui défile (`.rn-tab`).
- `rn-pile` — la pile de panneaux posée au pixel sous le HUD. Remplacée par la composition du milieu (`rn-c-bureau`).
- `rn-versbanc` — le bouton du banc posé à sa place fixe au bas du bureau. Remplacé par le panneau « Ton banc », un panneau comme les autres.
- Les positions écrites dans les scènes du bureau : chaque `left`, `right`, `top`, `bottom` des attributs `style` de `hud`, `segment`, `pageBureau`, `pageAlignement`, `pageMasse`, `pageLigue`, `pageMonClub`, `pageSeries`, `sceneClubVu`, `sceneMatchVu`, `sceneResultat` (une quarantaine). Remplacées par des classes de composition.
- Dans la feuille : `left`, `right`, `top`, `bottom`, `inset` et `height` des règles `.rn-hud`, `.rn-bas`, `.rn-onglets`, `.rn-seg`.
- Dans les juges : le seul écran de 390 × 844 de `check_scene` (trois écrans), et sa règle « la scène ne défile jamais ».

### Tranches 2 et 3 (leurs devis le reprendront)

- Les positions des scènes illustrées (environ 150 attributs `style`).
- `echelle`, `LARGEUR`, `HAUTEUR`, `ECHELLE_MAX` (js/run-jeu.js), `--rn-k` et la règle `.rn-plan > * { position: absolute; }` (style.css) : le plan fixe lui-même, avec la dernière scène refaite.

### Ce qui reste, et pourquoi

- **Les briques** : la plaque d'un club, le panneau, la jauge, la puce, l'enjeu, le banc et ses cartes, le plafond, le tableau et ses lignes (`tableau`, `ligne`), le segment, les boutons du jeu. Elles sont déjà faites de grille et de flex ; seule leur place change.
- **Les cartes de jeu et de joueur**, telles quelles (JP, deux fois).
- **Le contenu de chaque scène et son ordre de lecture** : la V30 l'a pensé bloc par bloc, et JP l'a jugé à l'essai.
- **Le glissement de côté des tableaux de stats** (JP, 25 nov. 2026).
- **La coquille de `js/run-jeu.js`** (les gestes, `rendre`, `montrer`), moins son échelle.

**Le test du zéro.** La place de chaque bloc se réécrit sans relire l'ancienne (une grille par largeur, pas 192 coordonnées) : c'est une refonte de la mise en page. Le contenu des blocs ne se réécrit pas : ce n'est pas une refonte du Rogue, et le devis ne le prétend pas.

## 8. Les réglages

| Le réglage | Sa valeur | Sa plage sûre | Au-delà |
|---|---|---|---|
| Le seuil du moyen | 700 px | 640 à 760 | plus bas, deux colonnes trop étroites sur un grand téléphone couché |
| Le seuil du large | 1000 px | 960 à 1100 | plus bas, le rail mange une tablette debout |
| La largeur du rail | 88 px | 76 à 104 | plus étroit, un mot d'onglet se coupe |
| Le milieu, au plus | 1400 px | 1200 à 1600 | plus large, une ligne de tableau se perd de l'œil |
| Une colonne de lecture, au plus | 640 px | 560 à 720 | plus large, une phrase dépasse 80 caractères |

## 9. Les critères d'acceptation

- [ ] Chaque scène du bureau s'ouvre à trois écrans (390 × 844, 820 × 1180, 1440 × 900) : rien ne déborde de l'écran, aucune barre de défilement de côté hors d'un tableau de stats — `check_scene`
- [ ] À 360 × 640, rien ne rapetisse : chaque cible fait 44 × 44, le milieu défile, l'en-tête et le bas ne bougent pas — `check_scene`
- [ ] À 1440 × 900, le bureau occupe au moins 85 % de la largeur ; ce soir, le proprio, le fil, ton banc, *autour de toi* et *à venir* sont visibles sans défiler — `check_scene`
- [ ] À 1440 × 900, le tableau de Mon club montre ses quatorze colonnes sans glisser — `check_scene`
- [ ] L'en-tête est au même endroit dans toutes les scènes d'une même largeur — `check_scene`
- [ ] Aucune position au pixel dans les scènes refaites : aucun `left`, `right`, `top` ni `bottom` dans un attribut `style` de leurs fonctions — `check_scene` (lu dans la source)
- [ ] Aucune mesure en JavaScript pour la mise en page des scènes refaites — `check_neuf`
- [ ] Un soir ordinaire tient en cinq touchers, à 390 × 844 comme à 1440 × 900 — `essai_run`
- [ ] Le clavier joue un soir entier à 1440 × 900 — `essai_run`
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire autant qu'il ajoute — `check_refonte docs/refonte-v31.md`
- [ ] La revue des Web Interface Guidelines sur `js/run-scenes.js` et la partie Rogue de `style.css` : chaque constat corrigé, ou noté « cède devant » — `/web-design-guidelines`
- [ ] À juger par JP à l'essai : le bureau large *fait EHM* ; la tablette n'est ni un gros téléphone ni un petit ordinateur.

## Les tranches

1. **La coquille et le bureau** — la grille, les trois largeurs, le rail ; les cinq onglets, les séries, la page d'un club, un match passé, le résultat ; `check_scene` à trois écrans. — `check_scene`, `essai_run`, `check_refonte`
2. **Le soir** — la feuille du soir et celle du duel, le ballottage, la pièce gagnée, les portes, la porte ouverte, l'échange, une histoire. — `check_scene`, `essai_run`
3. **La saison et le Club** — le départ, les pièces, le repêchage, l'ouverture du quart, le bilan, le marché, les pochettes, la fin, la pause, le Club et ses quatre pages, le solde ; puis le plan fixe et son échelle partent. — `check_scene`, `essai_run`, `check_refonte`

## 10. Tranché par JP, avec les chiffres (25 nov. 2026)

| La question | Les chiffres dits | Sa réponse |
|---|---|---|
| Jusqu'où ? | le bureau seul, ou les 28 scènes (257 règles de style) | **Tout le Rogue en fluide** |
| Sur un grand écran, que fait-on de la place ? | à 1440 × 900, une colonne de 416 px (29 %) | **Le bureau s'étale en panneaux** (écartés : liste et détail ; la même colonne, plus large) |
| Une scène plus haute que l'écran ? | à 360 × 640, tout à 76 % : 44 px en font 33 | **Son milieu défile** (écarté : une version courte de chaque scène) |
| Comment la mène-t-on ? | 28 scènes, 192 positions au pixel, 255 règles | **Code direct, par tranches** (écarté : des maquettes d'abord) |

## 11. Ce qui reste ouvert

- Le résultat en large : deux colonnes (la vue, ton soir) ; faut-il montrer deux vues du sommaire à la fois ? À juger à l'essai de la tranche 1.
- La tablette couchée (1180 × 820) tombe en large : le rail et trois colonnes de 360 px. À juger à l'essai.
