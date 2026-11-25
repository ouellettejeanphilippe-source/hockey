# V31 · Le Rogue en fluide : téléphone, tablette, ordinateur

Le devis (gabarit : `docs/gabarits/devis.md`). Ce document est le plan d'ensemble et le devis de la **tranche 1** (la coquille et le soir) ; les tranches 2 et 3 auront chacune le leur (`docs/refonte-v31-2.md`, `-3.md`), pour que `check_refonte` juge ce que chaque PR retire. Repris le 25 nov. 2026 après sa revue (§ 12).

## 1. Ce que JP a dit

JP, 25 nov. 2026 : *Aussi, ui adapté à toutes les tailles de l'écran, pas juste mobile.* Puis, entre « le bureau s'étale » et « tout le Rogue » : **tout le Rogue en fluide**. Et : *use the web design one from this* (les Web Interface Guidelines de Vercel, `/web-design-guidelines`).

Quatre questions tranchées le même jour, les chiffres dans chacune (§ 10) : sur un grand écran **le bureau s'étale en panneaux** ; sur un petit écran **le milieu de la scène défile** ; **code direct, par tranches**.

## 2. Ce que le joueur ressent

Le fantasme : *mon bureau de DG est un vrai bureau*. Au téléphone, une main, un pouce, comme aujourd'hui. À l'ordinateur, l'écran d'un EHM : je vois ce soir, ce que le proprio attend, mon quart et le classement autour de moi sans changer d'onglet ; un tableau de stats montre toutes ses colonnes d'un coup.

Ce que ça répare, calculé du plan fixe d'aujourd'hui (390 × 844, mis à l'échelle par un facteur borné à 1,25) :

| L'écran | L'échelle | Ce qu'on voit |
|---|---|---|
| Un ordinateur, 1440 × 900 | 1,066 | une colonne de 416 px : 29 % de la largeur, le reste est noir |
| Une tablette debout, 820 × 1180 | 1,25 | une colonne de 487 px : 59 % de la largeur |
| Un petit téléphone, 360 × 640 | 0,758 | tout rapetisse : un bouton de 44 px en fait 33, un texte de 13 px en fait 10 |

Le jour ordinaire reste rapide : un soir tient toujours en cinq touchers, et à l'ordinateur en cinq « Entrée ». Rien de spectaculaire ici ; le pic reste le match.

## 3. Les règles du jeu

Aucune règle de jeu ne change : ni un chiffre, ni un geste, ni une phase. Ce qui change est **où chaque bloc se pose**, et qui le décide : la feuille de style, plus les scènes.

### 3.1 La coquille

Le plan n'a plus de taille : il prend tout l'écran et se partage en une grille.

```
┌──────────────────────────┐   ┌───────────────────────────────────────────────┐
│ l'en-tête (le HUD)       │   │ l'en-tête (le HUD), sur toute la largeur      │
├──────────────────────────┤   ├──────┬────────────────────────────────────────┤
│                          │   │      │                                        │
│ le milieu                │   │ le   │ le milieu                              │
│                          │   │ rail │                                        │
├──────────────────────────┤   │      ├────────────────────────────────────────┤
│ le bas : les boutons     │   │      │ le bas : les boutons, bornés, à droite │
├──────────────────────────┤   └──────┴────────────────────────────────────────┘
│ les onglets (au bureau)  │
└──────────────────────────┘
        sans rail                              avec le rail
```

- **L'en-tête** court sur toute la largeur, à toutes les scènes : il ne saute jamais quand le rail apparaît ou disparaît. Il dégage l'encoche du téléphone, en haut et sur les côtés.
- **Les onglets** du bureau sont en bas, comme aujourd'hui. Ils deviennent **un rail à gauche** par la règle du site (dès 1000 px de large, ou couché dès 680 px), à la largeur du rail du site. Le rail reste à la page d'un club et à un match passé, qui s'ouvrent du bureau.
- **Le bas** porte les boutons de la scène. **Le bouton qui avance vit toujours dans le bas, jamais dans le milieu** : il est à l'écran avant tout défilement. Avec le rail, le bas se borne à 640 px et se range à droite, à la même place dans toutes les scènes. Il dégage la barre du téléphone.
- **Rien n'est mis à l'échelle** : une cible fait 44 px sur tous les écrans, un texte a la taille de son jeton. Le plancher est 320 px de large.

### 3.2 Ce qui défile

**Un seul défilement de haut en bas par colonne**, jamais une boîte qui défile dans une autre.

- **Un onglet de tableau** (l'Alignement, la Masse, la Ligue, Mon club, la page d'un club) : c'est la boîte du tableau qui défile, de haut en bas, et de côté si c'est un tableau de stats plus large qu'elle. Sa tête reste en haut et son nom à gauche. Ce qui le coiffe (le segment, le plafond, les trois chiffres, la plaque d'un club) reste en place.
- **Une lecture** (le bureau, la feuille du soir, le résultat) : c'est le milieu qui défile, s'il ne tient pas. Sur un écran assez haut, rien ne défile.
- **Sur un écran très court** (moins de 480 px de haut), ce qui coiffe un tableau défile avec lui : la boîte du tableau garde au moins cinq lignes.
- **Chaque boîte qui défile porte un nom** (`data-defile`), et garde sa place, de haut en bas et de côté, quand la même page se redessine (un joueur tenu, un tri). Le classement s'ouvre sur ton club.

### 3.3 Une scène

Une scène reste une fonction pure `(S, V) → HTML`. Elle rend ses morceaux dans l'ordre où on les lit — l'en-tête, les onglets, le milieu, le bas — et **plus aucune position** dans un attribut `style`.

La coquille dit à la scène la largeur dont elle dispose, en un mot (`V.largeur` : étroit sous 700 px, moyen de 700 à 1199, large dès 1200 : la place de trois colonnes de panneaux à côté du rail), et la redessine quand le mot change. La scène rend alors le bon contenu : pas de bloc caché en double, l'ordre du DOM est celui de l'écran. Ce n'est pas une mesure de mise en page : aucune coordonnée n'est calculée.

### 3.4 Le bureau en large : trois colonnes, une par horizon

« À gauche ce qu'on décide, à droite ce qu'on lit » (docs/decisions.md, S47).

| Aujourd'hui | Le quart | La saison |
|---|---|---|
| **Ce soir** : le club qui vient, son rang, son jeu, tes puces (le rival, chez toi, ton dos-à-dos) | **Le proprio** : ses trois objectifs et où tu en es | **Autour de toi** : les deux clubs devant, les deux derrière, en écarts de points ; la ligne des séries et ton écart à elle |
| **Le fil** : hier, l'infirmerie, tes affiches, une histoire, les pochettes | **Ton quart** : les matchs qui restent au quart — le club, son rang, le lieu, ton dos-à-dos et le leur, le rival et l'élite marqués ; les matchs joués du quart en pastilles | **Ton banc** : chaque pièce, son compte et son prochain seuil |

- « Ton quart » sert la décision du quart : où poser tes trois affiches. C'est la brique de la cédule de la Ligue, bornée au quart. Il commence après ce soir.
- « Autour de toi » ne redit pas ton rang ni tes points (l'en-tête les dit) : il dit les écarts.
- Une ligne de club ouvre sa page, partout ; la tête d'« Autour de toi » ouvre le classement.
- Ces deux panneaux viennent dès qu'il y a deux colonnes (le moyen) ; au téléphone, leur maison reste la Ligue. Deux colonnes en moyen (la tablette, le téléphone couché), trois en large (360 px au moins chacune, à côté du rail).
- « Jouer ce soir » est dans le bas, au seul onglet Bureau.

Pendant les séries, le bureau garde sa composition d'aujourd'hui (ta série, le tableau), en deux colonnes dès le moyen.

### 3.5 Les autres écrans de la tranche 1

**En large, un segment se déplie quand ses vues tiennent côte à côte.**

| L'écran | Étroit | Large |
|---|---|---|
| **Alignement** | Lignes ou Banc ; un tableau | les avants à gauche ; la défense, le filet et les civils à droite : tes vingt-trois sans défiler. Banc reste son segment |
| **Masse** | le plafond, puis les salaires | le plafond en bandeau ; les salaires en deux colonnes |
| **Ligue** | Classement, Meneurs, Gardiens, Cédule | deux segments : le classement et ta cédule côte à côte ; les meneurs et les gardiens côte à côte |
| **Mon club** | Patineurs, Gardiens, Matchs | les patineurs et tes matchs côte à côte ; les gardiens gardent leur segment |
| **La page d'un club** | ses chiffres, puis ses joueurs | ses chiffres à gauche, ses joueurs à droite |
| **Le résultat, un match passé** | Sommaire, Récit, Chiffres, Feuille | le Sommaire à gauche (avec ton soir) ; à droite un segment à trois : Récit, Chiffres, Feuille |
| **La feuille du soir** | la pile d'aujourd'hui | leur club et le tien face à face ; ta chance, ce que le match paie et tes deux gestes entre les deux |
| **La pause, l'attente** | par-dessus, au centre | par-dessus, au centre, 420 px au plus |

Un tableau ne s'étire pas au-delà de ses colonnes : la place en trop va à sa voisine, ou reste à droite.

### 3.6 Le clavier, la manette, la souris

- Après chaque rendu, en mode clavier ou manette, le focus revient au même bouton (le même geste, la même valeur) ; s'il n'existe plus, au bouton qui avance. Cinq « Entrée » jouent un soir ordinaire.
- B et Échap ferment d'abord ce qui est ouvert par-dessus (la pause, la page d'un club, un match passé), puis ouvrent la pause.
- Sous la pause, la scène ne se touche pas (`inert`).
- À la souris, une ligne, un onglet, un segment qu'on survole répond (`@media (hover: hover)`).

### 3.7 Entre les tranches

Une scène pas encore refaite garde son plan fixe, mis à l'échelle comme aujourd'hui, au centre de l'écran : la coquille reconnaît une scène neuve à son milieu. Le soir entier est neuf dès la tranche 1 : du bureau au bureau, l'en-tête ne saute pas. Ce qui s'ouvre du soir sans être de tous les soirs (une histoire, les pochettes, le ballottage, les portes) saute encore jusqu'à la tranche 2 ; JP en est prévenu avant l'essai.

## 4. Les chiffres

Aucune formule de jeu. Les seuls nombres sont des largeurs (§ 8).

## 5. Les cas limites

- **Un écran très court** : § 3.2. Couché (844 × 390), le rail remplace les onglets et rend 58 px au milieu.
- **Un écran très large** (2560 px) : le milieu se centre à 1400 px au plus.
- **Une fenêtre qu'on redimensionne** : la grille suit ; si le mot de la largeur change, la scène se redessine et les boîtes gardent leur place.
- **L'encoche** : l'en-tête, le bas et le rail la dégagent. Dans Safari avec ses barres (390 × 664), le bureau défile : « ce soir », le proprio et « Jouer ce soir » restent visibles sans défiler.
- **Le premier, le dernier, la ligne loin de toi** : « Autour de toi » montre les quatre voisins qui existent. **Le premier match** : aucun écart, le panneau le dit. **La fin d'un quart** : « Ton quart » montre ce qui reste, puis le bilan qui vient.
- **Les séries** : ni proprio, ni quart, ni classement ; le bureau montre ta série et le tableau.
- **Le joueur tenu** à l'Alignement : la tête devient « sa fiche › », les deux tableaux gardent leur place.
- **Une run sans sommaire** (gardée avant le 25 nov.) : le résultat sans segment, une seule colonne.
- **Le direct et la fiche** s'ouvrent par-dessus, à leur largeur à eux : inchangés.
- **Une vieille sauvegarde** : rien à relire. `V.largeur` n'est pas gardé.
- **Hors ligne** : aucun fichier neuf ; `sw.js` ne change que de version.
- **`prefers-reduced-motion`** : rien de neuf ne bouge.

## 6. Ce qu'il touche

Tranche 1 : `js/run-scenes.js`, `js/run-jeu.js`, `js/manette.js`, `js/game.js`, `style.css`, `sw.js`, `js/version.js`, `scripts/check_scene.mjs`, `scripts/essai_run.mjs`, `.claude/rules/interface.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`, `.claude/agents/rogue-ux.md`, `docs/decisions.md`, `LIVRAISON.md`, `CLAUDE.md`.

Les règles fermes d'interface.md :

- **« Un plan fixe, plein écran » : 390 × 844, mis à l'échelle** — **défaite** (JP, 25 nov. 2026 : *tout le Rogue en fluide*). Sa seconde moitié tient : un tableau défile dans sa boîte, garde sa place, le classement s'ouvre sur ton club.
- **« Une scène ne défile jamais »** — **défaite pour un écran trop court** (JP, la règle reposée : *son milieu défile*). L'en-tête, le bas et les onglets ne défilent jamais ; aucun milieu ne défile à 390 × 844, 820 × 1180 ni 1440 × 900.
- **« Partout : la page elle-même ne défile jamais »** — respectée : c'est le milieu de la scène qui défile, pas la page.
- **« Cinq onglets, en bas, toujours au même endroit »** — **changée** : en bas, ou en rail à gauche par la règle du site ; au même endroit dans toutes les scènes d'un même écran.
- **L'ordre de l'onglet Bureau** (ce soir, le proprio, le fil, ton banc) — tenu en étroit ; en large, trois colonnes par horizon (§ 3.4), l'ordre de lecture de chaque colonne dit.
- **« Rien de ce que l'en-tête dit ne se répète dans la scène »** — respectée : « Autour de toi » dit des écarts.
- **« Un tableau de stats glisse de côté »**, **« une cible fait 44 × 44 »**, **« une ligne qu'on touche fait 44 px »** — respectées, et enfin vraies sur un petit téléphone.
- **« Le HUD est toujours au même endroit »** — respectée : l'écusson et les cœurs au même pixel dans toutes les scènes neuves d'un même écran.
- **« Un soir ordinaire tient en cinq touchers »**, **« le fil n'est pas une boîte à vider »**, **« le Rogue a l'allure du 82-0 »**, **« une carte ne se redessine pas »**, **« mobile d'abord »** — respectées.

Les clés de sauvegarde ne bougent pas.

## 7. Ce qui part

### Tranche 1

- `rn-cadre` — la boîte posée au pixel entre le HUD et les onglets. Remplacée par la boîte nommée d'un tableau, dans la grille.
- `rn-glisse` — la marque d'un cadre qui glisse de côté. Toute boîte de tableau glisse si son tableau est plus large qu'elle ; les autres tableaux tiennent toujours.
- `rn-pile` — la pile de panneaux posée au pixel sous le HUD. Remplacée par la composition du bureau.
- `rn-versbanc` — le banc posé à sa place fixe au bas du bureau. Remplacé par le panneau « Ton banc ».
- `cadreVu` — la place d'un seul cadre, gardée par la coquille. Remplacée par la place de chaque boîte nommée.
- Sans nom à juger : les positions écrites dans les scènes de la tranche (une soixantaine d'attributs de style, comptés avant et après dans la PR), et le seul écran du juge des scènes.

### Tranches 2 et 3 (leurs devis les nommeront)

Les positions des autres scènes (une centaine d'attributs de style) ; puis le plan fixe lui-même, sa taille et son échelle, avec la dernière scène refaite.

### Ce qui reste, et pourquoi

Aucun de ces noms n'est en code : ils restent.

- *Les briques* : la plaque d'un club, le panneau, la jauge, la puce, l'enjeu, le banc et ses cartes, le plafond, le tableau et ses lignes, le segment, les boutons du jeu. Elles sont déjà faites de grille et de flex ; seule leur place change.
- *Les cartes de jeu et de joueur*, telles quelles (JP, deux fois).
- *Le contenu de chaque scène et son ordre de lecture* : la V30 l'a pensé bloc par bloc, et JP l'a jugé à l'essai.
- *Le glissement de côté des tableaux de stats* (JP, 25 nov. 2026).
- *Les gestes de la coquille* ; sa façon de montrer une scène, elle, se réécrit (la place de chaque boîte, le focus).
- *L'en-tête, le bas et le segment des scènes pas encore refaites* : leurs positions restent, bornées au plan fixe, jusqu'à la dernière tranche.

**Le test du zéro.** La place de chaque bloc se réécrit sans relire l'ancienne (une grille, pas des coordonnées) : c'est une refonte de la mise en page. Le contenu des blocs ne se réécrit pas : ce n'est pas une refonte du Rogue, et le devis ne le prétend pas. Si le juge des refontes reste rouge sur la part de la feuille de style, JP le saura en une ligne avant la PR ; la borne ne bouge pas.

## 8. Les réglages

| Le réglage | Sa valeur | Sa plage sûre | Au-delà |
|---|---|---|---|
| Le mot « moyen » | dès 700 px | 640 à 760 | plus bas, deux colonnes trop étroites |
| Le mot « large » | dès 1200 px | 1160 à 1280 | plus bas, trois colonnes sous 340 px à côté du rail |
| Le rail | la règle du site (1000 px ; couché, 680 px), sa largeur | celles du site | deux rails différents dans le même jeu |
| Une colonne de panneaux, au moins | 360 px | 340 à 400 | plus étroit, un objectif du proprio se coupe |
| Le milieu, au plus | 1400 px | 1200 à 1600 | plus large, une ligne de tableau se perd de l'œil |
| Le bas, avec le rail | 640 px au plus, à droite | 480 à 720 | plus large, un bouton d'un mètre |
| Le plancher | 320 px | — | sous lui, le nom d'un joueur n'a plus huit lettres |

## 9. Les critères d'acceptation

Les écrans du juge : **360 × 640**, **390 × 844** (la référence, encoche simulée), **820 × 1180**, **844 × 390**, **1366 × 650**, **1440 × 900**. À 390 × 844, toutes les scènes, comme aujourd'hui ; aux cinq autres, les scènes de la tranche (une sauvegarde, un parcours). Temps visé : cinq minutes au CI, contre deux.

- [ ] À chaque écran, chaque scène de la tranche : rien ne déborde de l'écran, aucune barre de défilement de côté hors d'un tableau de stats, aucune boîte qui défile de haut en bas dans une autre — `check_scene`
- [ ] À 390 × 844, 820 × 1180 et 1440 × 900, aucun milieu ne défile hors d'un tableau ; les scènes en plan fixe ne défilent jamais — `check_scene`
- [ ] À chaque écran : chaque cible fait 44 × 44 ; le bouton qui avance est dans le bas et à l'écran sans défiler ; aucun bloc sous le bas ni sous les onglets — `check_scene`
- [ ] À 360 × 640 : « ce soir », le proprio et « Jouer ce soir » visibles sans défiler ; aucun nom de club coupé au classement (les noms de joueurs coupés à l'Alignement s'impriment) — `check_scene`
- [ ] À 1440 × 900 : le bord droit du dernier panneau du bureau passe 85 % de la largeur, et les panneaux couvrent 60 % de la hauteur du milieu ; les six panneaux visibles sans défiler ; tes vingt-trois visibles à l'Alignement sans défiler ; le tableau de Mon club montre ses quatorze colonnes sans glisser — `check_scene`
- [ ] À 820 × 1180 : le bureau en deux colonnes, ses panneaux descendent à la moitié du milieu — `check_scene`
- [ ] L'écusson et les cœurs de l'en-tête au même pixel dans toutes les scènes neuves d'un même écran ; du bureau au bureau, un soir entier — `check_scene`, `essai_run`
- [ ] Un tableau garde sa place : défilé au bas des lignes, le dernier joueur tenu, la boîte n'a pas bougé ; le classement s'ouvre sur ton club, les trente-deux y sont — `check_scene`
- [ ] Aucune coordonnée dans le rendu des scènes neuves : aucun `left`, `right`, `top` ni `bottom` dans un attribut de style, sauf la jauge du plafond (sa place vient des données) — `check_scene`
- [ ] Un soir ordinaire : cinq touchers à 390 × 844 ; au clavier à 1440 × 900, en « Entrée » seulement (trois en mouvement réduit, deux de plus au direct) ; Échap ferme la page d'un club, puis ouvre la pause, puis reprend — `essai_run`
- [ ] À 1440 × 900, survoler une ligne de tableau change son fond — `check_scene`
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux qu'il ajoute, la feuille de style fait moins de la moitié du diff — `check_refonte docs/refonte-v31.md`
- [ ] La revue des Web Interface Guidelines sur les scènes de la tranche : chaque constat corrigé, ou noté « cède devant » (rien de sélectionnable, aucun lien souligné, la casse de phrase, les guillemets français) — `/web-design-guidelines`
- [ ] À juger par JP à l'essai : le bureau large *fait EHM* ; la tablette n'est ni un gros téléphone ni un petit ordinateur.

## Les tranches

1. **La coquille et le soir** — la grille, le rail, ce qui défile, le focus ; le bureau et ses cinq onglets, les séries, la page d'un club, un match passé, la feuille du soir et celle du duel, le résultat, la pause, l'attente ; le juge à six écrans. — `check_scene`, `essai_run`, `check_refonte`
2. **Ce qui s'ouvre du soir** — une histoire, les pochettes, le ballottage, la pièce gagnée, les portes, la porte ouverte, l'échange. — `check_scene`, `essai_run`
3. **La saison et le Club** — le départ, les pièces, le repêchage, l'ouverture du quart, le bilan, le marché, la fin, le Club et ses quatre pages, le solde ; puis le plan fixe et son échelle partent. — `check_scene`, `essai_run`, `check_refonte`

## 10. Tranché par JP, avec les chiffres (25 nov. 2026)

| La question | Les chiffres dits | Sa réponse |
|---|---|---|
| Jusqu'où ? | le bureau seul, ou les 28 scènes (257 règles de style) | **Tout le Rogue en fluide** |
| Sur un grand écran, que fait-on de la place ? | à 1440 × 900, une colonne de 416 px (29 %) | **Le bureau s'étale en panneaux** (écartés : liste et détail ; la même colonne, plus large) |
| Une scène plus haute que l'écran ? | à 360 × 640, tout à 76 % : 44 px en font 33 | **Son milieu défile** (écarté : une version courte de chaque scène) |
| Comment la mène-t-on ? | 28 scènes, 192 attributs de style, 255 règles | **Code direct, par tranches** (écarté : des maquettes d'abord) |

Le compte exact, refait à la revue : 163 attributs de style portent une position (346 coordonnées). Ça ne change pas la décision.

## 11. Ce qui reste ouvert, à juger à l'essai

- Le bureau large par horizon (§ 3.4) précise le dessin que JP a choisi : mêmes panneaux, « ton banc » à droite, « ton quart » à la place des cinq prochains matchs. À juger sur le vrai écran.
- Les séries en large : le tableau des seize en arbre, quatre rondes de front ? Pas dans ce devis ; à poser à JP avant la tranche 3.
- Les deux panneaux du large n'existent pas au téléphone : poser une affiche en connaissance de cause y coûte trois touchers de plus (la Ligue, la Cédule, le retour).
- La tablette couchée (1180 × 820) : le rail et trois colonnes de 360 px.

## 12. La revue du 25 nov. 2026, et ce qu'elle a changé

Deux relecteurs en adversaires (`rogue-ux`, `rogue-design`) : **à reprendre**, tous deux. Ce que le devis a changé :

- **La tranche 1 suit le soir** : la feuille du soir, la pause et l'attente y entrent. Sinon l'en-tête sautait de 1 352 à 416 px deux fois par soir, 82 soirs.
- **Ce qui défile** : le devis disait « le milieu seul » et donnait pourtant sa boîte au tableau. Une règle : un seul défilement par colonne (§ 3.2).
- **La coquille se réécrit là où elle pendait au cadre** : la place gardée, le classement ouvert sur ton club, les cartons du sommaire.
- **La scène connaît sa largeur** (§ 3.3) : sans elle, quatre écrans demandaient des blocs cachés en double et un DOM dans le désordre.
- **L'en-tête sur toute la largeur, le rail dessous** : il sautait de 88 px entre le bureau et les scènes sans rail.
- **Le bureau large par horizon**, « ton quart » plutôt que cinq matchs à venir, « autour de toi » en écarts, « ton banc » avec ses comptes : chaque panneau sert une décision.
- **Les colonnes se dérivent de la place** : à 1000 px, trois colonnes de 283 px coupaient les objectifs du proprio.
- **Le clavier et la manette** : le focus tombait à chaque rendu et repartait de la Pause.
- **Les écrans du juge** : le téléphone couché, le portable court, l'encoche.
- **Ce qui part** ne nomme plus que ce qui part : la première liste aurait demandé au juge de voir partir le tableau et l'en-tête.
- **Trois critères récrits** : la largeur occupée (la grille couvrait 100 % d'office), les quatorze colonnes, « aucune mesure en JavaScript ».
