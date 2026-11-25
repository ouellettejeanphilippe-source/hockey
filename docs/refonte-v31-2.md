# V31 · tranche 2 : ce qui s'ouvre du soir

Le devis de la deuxième tranche du Rogue en fluide (gabarit : `docs/gabarits/devis.md` ; le plan d'ensemble : `docs/refonte-v31.md`). Sept scènes : **une histoire, les pochettes, le ballottage, la pièce gagnée, les trois portes, la porte ouverte, l'échange**. Repris deux fois le 25 nov. 2026, après chacune de ses deux revues (§ 11).

## 1. Ce que JP a dit

JP, 25 nov. 2026 : *Aussi, ui adapté à toutes les tailles de l'écran, pas juste mobile* ; **tout le Rogue en fluide** ; **code direct, par tranches** (il juge chaque tranche sur le vrai écran). L'option qu'il a choisie disait : *chaque scène se met en page seule, du téléphone au grand écran (les deux clubs côte à côte à la feuille du soir, les portes en rangée large…)*.

La tranche 1 a refait le soir entier. Il reste un saut : entrer du bureau dans une histoire, une pochette ou des portes ramène l'écran à une colonne de 390 px mise à l'échelle. À 1440 × 900, le milieu passe de 1 344 px à 416.

## 2. Ce que le joueur ressent

Ces sept scènes sont les moments où la run te tend quelque chose : un joueur, une pièce, une pochette, une réponse. Le fantasme : *on me fait une offre, je la pèse, je signe*. À l'ordinateur, l'offre et ce qu'elle me coûte se lisent d'un seul regard ; au téléphone, rien ne change de place.

Le pic reste les trois portes après un gros match gagné : à l'ordinateur elles prennent la rangée et grandissent. Le jour ordinaire n'y passe pas : aucun toucher ne s'ajoute à un soir ordinaire.

## 3. Les règles du jeu

Aucune règle de jeu ne change, **et aucun contenu** : chaque scène dit la même chose à toutes les largeurs. Ce qui change : où chaque bloc se pose, et qui le décide (la feuille de style). Et une règle de plus, parce que le milieu défile maintenant sur un petit écran : **ce qui décide est à l'écran sans défiler** (§ 3.6).

### 3.1 Le comptoir : ce qu'on te tend, puis ton côté

Six des sept scènes ont la même forme. Deux blocs, dans l'ordre où on les lit : **ce qu'on te tend** (avec en tête pourquoi on est là), puis **ton côté** (celui que tu choisis, qui sort, ton plafond, tes réponses).

- **D'un trait** au téléphone et à la tablette debout : l'ordre d'aujourd'hui. Le milieu défile s'il ne tient pas ; à 390 × 844, rien ne défile. Dès 700 px, le trait se borne à 640 px, au centre.
- **Côte à côte quand l'écran est large ou couché** : la règle du rail (dès 1000 px, ou couché dès 680). Ce qu'on te tend prend trois parts sur cinq, ton côté deux, juste au-dessus du bouton qui signe (la tranche 1 a rangé le bas en bas à droite). Le tout se centre dans la hauteur ; chaque colonne défile seule si l'écran est trop court.

C'est la feuille qui choisit entre les deux, pas la scène : le DOM est le même.

| La scène | Ce qu'on te tend | Ton côté |
|---|---|---|
| **La porte ouverte** | le club, ses joueurs qui tiennent dans ton espace | le joueur choisi (son année, son badge, ce qu'il ajoute à ton banc, l'accord qu'il allume) |
| **L'échange** | l'arrivant face à celui qui sort, le comparatif | qui sort, ton plafond après |
| **La pièce gagnée** | le match gagné, les trois pièces | ton banc : la case libre, ou celle qui sort |
| **Le ballottage** | la case à tenir et pourquoi, les trois joueurs | le joueur choisi |
| **Les pochettes** | ce qu'est une pochette, les deux pochettes | ton plafond |
| **Une histoire** | la voix, sa réplique, le joueur et le fait | tes deux réponses (leurs « Prendre » dans le bas) |

- **L'échange en large** (dès 1200 px) : le comparatif tient entre les deux cartes, ligne à ligne.
- Une carte ne grossit pas sans fin : 180 px de large au plus.

### 3.2 Les trois portes : la rangée large

Le pic n'est pas un comptoir. Au téléphone, l'ordre d'aujourd'hui : le match gagné, le titre, les trois portes, ton plafond. Dès que l'écran est large ou couché, le match gagné et ton plafond passent côte à côte au-dessus, et les trois portes prennent la rangée : jusqu'à 250 px de large chacune, et plus hautes (la moitié de la hauteur de l'écran, entre 316 et 480 px). Sur un écran très court (un téléphone couché, moins de 480 px de haut), le match gagné, le titre et ton plafond se rangent à gauche et les portes prennent toute la hauteur à droite : leur compte se lit sans défiler.

### 3.3 La porte ouverte montre plus de joueurs quand il y a la place

Aujourd'hui : cinq joueurs et une tuile « N autres ». La grille suit l'écran, pour ne jamais défiler à côté de sa tuile :

- **de front, par la largeur** : trois en étroit, quatre en moyen, six en large ;
- **en rangées, par la hauteur** (`V.hauteur`, un mot de plus que la coquille dit à la scène) : une sous 620 px de haut, deux jusqu'à 860, trois au-delà ; au téléphone debout, toujours deux, comme aujourd'hui.

Douze tuiles à 1366 × 650, dix-huit à 1440 × 900, quatre sur un téléphone couché.

- Si tous ceux qui tiennent dans ton espace entrent dans la grille, ils y sont tous, sans tuile.
- Sinon la dernière tuile mène à la page suivante, dit sa page (« Page 1 de 3 ») et **revient à la première après la dernière** (aujourd'hui, à la dernière page, elle ne fait plus rien : un bogue).
- L'ordre ne change pas : le plus fort en tête, à toutes les largeurs.
- Celui qui ne tient pas dans ton espace se dit sous la grille, plus dans la tuile.

### 3.4 Le rail

Le rail reste à ce qu'on **consulte** du bureau (la page d'un club, un match passé). Les sept scènes **engagent** quelque chose : sans rail, comme la feuille du soir. Les pochettes surtout : toucher une pochette la paie et ouvre sa porte, et de l'étal à « Signer » rien ne doit sauter.

Deux bogues de la tranche 1 se corrigent ici :

- **Un onglet du rail ferme ce qui est ouvert par-dessus le bureau** (la page d'un club, un match passé) et va à son onglet. Aujourd'hui l'onglet change dessous et la page reste.
- **Sans rail, une page ouverte du bureau n'a pas d'onglets** : au téléphone, la page d'un club et un match passé montraient les cinq onglets sous leur « Retour ».

### 3.5 Le clavier et la manette

Le focus par défaut reste au bouton qui avance (`.go`, le rouge du combat), sinon au premier du bas — après un clic de souris aussi (il retombait sur « Pause »). **Deux scènes posent le focus elles-mêmes, pour qu'« Entrée » ne renonce jamais à ta place** : aux portes, sur la première porte (pas sur « Passer ») ; à la pièce gagnée, sur la pièce choisie (pas sur « Passer »). Aucun bouton qui signe ou qui prend (`.gold`) ne reçoit le focus d'office : l'échange s'ouvre sur « Retour », une histoire sur « Plus tard » (elle reste au fil). Après « Relancer », le focus revient aux portes neuves : deux « Entrée » de suite ne paient pas une seconde relance.

**Échap et B ne renoncent pas non plus** : à une pochette payée et ouverte, « Ne rien signer » n'est pas un retour — Échap ouvre la pause. Aujourd'hui il fermait la pochette : 26 jetons perdus sans rien signer.

### 3.6 Ce qui décide est à l'écran

Le plan fixe tenait tout à l'écran en rapetissant. Maintenant le milieu défile sur un petit écran : ce qui décide ne doit pas passer sous le pli.

- **Une histoire** : ses deux « Prendre » sont dans le bas, chacun au nom de sa carte, à côté de « Plus tard ». Un toucher, comme aujourd'hui. (Sous chaque carte, ils passaient sous le pli de 128 px à 360 × 640.)
- **L'échange** : « Signer » redit le plafond d'après (« 93,7 M$ / 95,5 M$ ») ; s'il ne passe pas, il est éteint et le dit. (Avec quatorze joueurs qui peuvent sortir, le panneau du plafond passait sous le pli à 360 × 640.)
- **La porte ouverte** : sa tuile « N autres » est toujours à l'écran (§ 3.3).
- **La pièce gagnée, banc plein** : « Prendre » est éteint tant qu'on n'a pas touché celle qui sort, comme au marché. (Allumé, il ne faisait qu'un son.)

### 3.7 Trois briques qui se recopiaient

- **Le match gagné** (le pointage, « Le rival est battu », ce que ça donne) : un bloc pour les portes et la pièce gagnée.
- **Ton plafond en panneau** (la masse, le plafond, l'espace, la jauge) : un bloc pour les portes, les pochettes et l'échange.
- **La jauge du plafond** dessine aussi l'échange (ce qui arrive, ce qui reste de celui qui sort).

## 4. Les chiffres

Aucune formule de jeu. Les nombres sont des largeurs et des comptes (§ 8).

## 5. Les cas limites

- **Personne ne tient dans ton espace** (une porte vide) : la grille est vide, ton côté le dit, « Voir l'échange » est éteint.
- **Une pochette ouverte** : la porte ouverte sans club ; « Ne rien signer » remplace « Retour ».
- **Le banc plein** à la pièce gagnée : on touche celle qui sort, puis « Prendre » s'allume.
- **Une histoire après un pari** : la réplique devient le dé, les réponses partent, aucun bouton ; la scène se referme seule — et seulement elle, si on a ouvert autre chose entre-temps.
- **Une histoire sans joueur** : seulement la voix.
- **Une réponse dont le texte est long** : plus rien n'est coupé ; au téléphone, le milieu défile.
- **Quatorze joueurs qui peuvent sortir** : la grille de l'échange garde des cibles de 44 px, sur autant de rangées qu'il faut.
- **Un écran très court** (844 × 390) : chaque colonne défile seule ; le bas reste à l'écran, et ce qui décide avec lui (§ 3.6). JP a écarté « une version courte de chaque scène » : le reste défile. À 1366 × 650, rien ne défile.
- **Une fenêtre redimensionnée** au milieu d'une porte : si le mot de la largeur change, la grille revient à sa première page.
- **Le repêchage et les pièces du départ** (tranche 3) lisent les mêmes briques (la grille, l'étal des pièces) dans leur plan fixe ; la tuile du repêchage revient aussi à la première page.
- **Une vieille sauvegarde**, **hors ligne** : rien à relire, aucun fichier neuf ; `sw.js` ne change que de version.

## 6. Ce qu'il touche

`js/run-scenes.js`, `js/run-jeu.js`, `js/manette.js`, `style.css`, `sw.js`, `js/version.js`, `scripts/check_scene.mjs`, `scripts/essai_run.mjs`, `.claude/rules/interface.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`, `docs/decisions.md`, `docs/refonte-v31.md`, `LIVRAISON.md`.

Les règles fermes d'interface.md :

- **« Une grille, à toutes les tailles d'écran »**, **« un seul défilement de haut en bas par colonne »**, **« le bouton qui avance vit dans le bas »** (V31) — respectées, étendues aux sept scènes.
- **« La scène connaît la place dont elle dispose »** — précisée : la scène choisit son contenu par la largeur (les joueurs d'une porte, le comparatif entre les cartes) ; côte à côte ou d'un trait, c'est la feuille.
- **« Signer, c'est l'échange »** — respectée : même contenu.
- **« Les scènes illustrées gardent leur composition »** (V30) — **changée dès que l'écran est large ou couché** : la composition s'ouvre en deux blocs côte à côte, les portes en rangée. Tenue au téléphone et à la tablette debout.
- **« Une carte ne se redessine pas »** — respectée : seule sa largeur change, bornée.
- **« Au clavier, le focus revient au bouton qui avance »** — précisée (§ 3.5).
- **« Le bouton qui avance vit dans le bas »** — étendue : ce qui décide aussi (§ 3.6).
- **« Le bureau est l'accueil, en cinq onglets »** : le rail gardé à ce qu'on consulte du bureau ; un onglet ferme ce qui est ouvert, et sans rail ces pages n'ont pas d'onglets (§ 3.4).
- **« Un soir ordinaire tient en cinq touchers »** — respectée : aucune de ces scènes n'est d'un soir ordinaire.

Les clés de sauvegarde ne bougent pas.

## 7. Ce qui part

- `plafondApres` — une seconde jauge du plafond, recopiée pour l'échange. La jauge du plafond la dessine.
- `bandeDuMatch` — le panneau du pointage des portes, posé au pixel ; la pièce gagnée écrivait le sien à la main. Un seul bloc pour les deux.
- `rn-reps` — la boîte des réponses d'une histoire, tenue entre deux coordonnées, qui coupait un texte trop long. Les réponses sont un étal à deux, le même que celui des pochettes (qui écrivait sa grille dans un attribut de style), et rien ne les coupe.
- Sans nom à juger : les 24 positions au pixel des sept scènes (24 attributs de style sur 44 en portaient une) ; le panneau « Ton plafond » recopié dans deux scènes ; dans le juge des scènes, les sept scènes mesurées à un seul écran.

### Ce qui reste, et pourquoi

Aucun de ces noms n'est en code : ils restent.

- *Les briques dessinées* : la porte, la grille des joueurs, l'étal, la bulle et la voix, le face-à-face et le comparatif, la grille de ceux qui sortent. Leur dessin ne change pas ; leur place et leur largeur, oui.
- *Le contenu et l'ordre de lecture* : jugés à l'essai par JP à la V28 et à la V30.
- *Les gestes* de ces scènes et leur ordre (ouvrir une porte, voir un joueur, voir l'échange, signer).
- *Cinq joueurs par page au repêchage* : sa scène est de la tranche 3.

**Le test du zéro.** La place de chaque bloc se réécrit sans relire l'ancienne. Le contenu des blocs ne se réécrit pas. À elle seule, cette tranche est la mise en page de sept scènes, pas une refonte : elle est une part de celle de la V31, et se juge avec elle.

## 8. Les réglages

| Le réglage | Sa valeur | Sa plage sûre | Au-delà |
|---|---|---|---|
| Côte à côte | la règle du rail (1000 px ; couché, 680 px) | celle du site | deux règles pour un même écran |
| Les deux colonnes | 3 parts et 2 | 1:1 à 2:1 | plus large à gauche, la droite coupe un nom de joueur |
| Le trait, dès 700 px | 640 px au plus | 560 à 720 | plus large, une réplique d'une ligne de 120 signes |
| Une carte, au plus | 180 px | 150 à 200 | plus large, trois cartes passent la hauteur d'un portable |
| Une porte, en rangée large | 250 px au plus ; la moitié de la hauteur, de 316 à 480 px | 220 à 280 ; 440 à 520 | plus large, la porte devient une fenêtre |
| Les tuiles d'une porte | 3, 4 ou 6 de front ; 1, 2 ou 3 rangées (sous 620 px de haut, jusqu'à 860, au-delà) | 600 à 640 ; 840 à 880 | plus bas, la tuile « N autres » passe sous le pli d'un portable |
| Une cible de la grille de ceux qui sortent | 44 px (43 de plancher, comme aujourd'hui) | — | sous 44, le pouce en touche deux |

## 9. Les critères d'acceptation

Les écrans du juge sont ceux de la tranche 1 : 360 × 640, 390 × 844, 820 × 1180, 844 × 390, 1366 × 650, 1440 × 900.

- [ ] Les pochettes, les portes, la porte ouverte, l'échange et la pièce gagnée s'ouvrent aux six écrans (une histoire et le ballottage, si une saison du robot en garde une sauvegarde) : rien ne déborde, aucune boîte qui défile dans une autre, l'écusson et les cœurs au même pixel que le bureau, chaque cible de 44, aucune position au pixel — `check_scene`
- [ ] À 390 × 844, 820 × 1180 et 1440 × 900, aucune ne défile — `check_scene`
- [ ] Ce qu'on te tend et ton côté sont côte à côte à 844 × 390, 1366 × 650 et 1440 × 900 ; d'un trait à 360 × 640 et à 820 × 1180 — `check_scene`
- [ ] À 1440 × 900, les trois portes sont de front, plus hautes et plus larges qu'au téléphone — `check_scene`
- [ ] Une porte montre six tuiles au plus au téléphone, davantage à l'ordinateur ; sa tuile passe par chaque page et revient à la première — `check_scene`
- [ ] Ce qui décide est à l'écran sans défiler, à chaque écran : la tuile « N autres » d'une porte, les « Prendre » d'une histoire (dans le bas, un par réponse), le plafond d'après sur « Signer » — `check_scene`
- [ ] Une pochette payée s'ouvre aux six écrans ; Échap y ouvre la pause, et la pochette est toujours là — `check_scene`
- [ ] Ce qu'on consulte du bureau garde le rail quand l'écran en a un, et n'a pas d'onglets sinon ; les pochettes et une histoire n'en ont jamais — `check_scene`
- [ ] Aucune carte ne passe 190 px ; aucun texte d'étal, aucune réplique n'est coupé — `check_scene`
- [ ] Aux portes, au clavier, le focus par défaut est sur une porte, pas sur « Passer » — `check_scene`
- [ ] Un onglet du rail ferme la page d'un club et ouvre son onglet — `essai_run`
- [ ] Le parcours au doigt tient : une affiche gagnée ouvre ses portes, une porte, l'échange, « Signer » — `essai_run`
- [ ] Les trois noms sont partis, le jeu retire au moins une ligne pour deux qu'il ajoute, la feuille de style fait moins de la moitié du diff — `check_refonte docs/refonte-v31-2.md`
- [ ] La revue des Web Interface Guidelines sur les sept scènes — `/web-design-guidelines`
- [ ] À juger par JP à l'essai : les deux blocs côte à côte se lisent comme une offre et son prix ; à l'ordinateur, les portes restent le pic.

## 10. À poser à JP (rien de ceci n'est dans la tranche)

Les revues ont trouvé trois choses qui sont des décisions de jeu, pas de la mise en page. La tranche ne les prend pas : elle garde le contenu et le parcours d'aujourd'hui.

- **Le compte de ton banc là où tu décides.** La porte ouverte dit « ton banc : 🦍 +2 » sans dire sur combien ni si une marche s'allume ; à la pièce gagnée, banc plein, on choisit celle qui sort sur cinq cartes de 54 px, sans son compte. Le repêchage, lui, montre ton banc en lignes.
- **Signer place l'arrivant dans la case de celui qui sort.** La sortie proposée est un réserviste à 21 % des portes (591 portes mesurées) : l'arrivant finit alors en civil, même s'il est plus fort qu'un habillé, tant qu'on ne passe pas par l'Alignement. L'écran ne le dit qu'en petit dans l'en-tête.
- **À l'ordinateur, les trois vestiaires ouverts de front**, sans passer par les portes ? Un autre parcours (trois scènes en une).

## 11. La revue du 25 nov. 2026, et ce qu'elle a changé

Deux relecteurs en adversaires (`rogue-ux`, `rogue-design`). Le premier devis mettait les sept scènes en deux colonnes dès 700 px, avec ton banc en lignes aux portes et pièce par pièce à la pièce gagnée, et le focus par défaut sur « Signer » et « Prendre ». **À reprendre.**

- **Le même contenu à toutes les largeurs.** Le banc en lignes n'existait qu'à l'ordinateur, devant des choix irréversibles : parti. Ce qu'il réparait est une vraie question, posée à JP (§ 10).
- **Les portes en rangée large**, pas dans trois cinquièmes de l'écran à côté d'un tableau : c'est ce que l'option de JP disait, et c'est le pic.
- **Le focus ne signe pas à ta place** : cinq « Entrée » prenaient la première pièce, ouvraient la première porte et signaient. Aucun bouton `.gold` par défaut ; les portes et la pièce gagnée posent le focus sur un choix sans conséquence.
- **La tablette debout n'a pas deux colonnes** : à 820 px, ton côté tenait dans 300 px et le titre du plafond se cassait. Côte à côte par la règle du rail ; d'un trait borné sinon.
- **Au ballottage et aux pochettes, le pourquoi se lit avant l'offre**, à toutes les largeurs.
- **La tuile « N autres »** dit sa page ; elle disparaît quand tout tient (à 12 joueurs, une grille de 12 en cachait un derrière elle).
- **« Ce qui part »** : la revue a noté que deux des trois noms sont des blocs fusionnés, pas des blocs supprimés. Le devis le dit, et ne se donne plus pour une refonte à lui seul.
- **Le juge mesurait `.rn-reps p`** : le nom parti, il serait passé au vert à vide. Il mesure maintenant tout texte d'étal, la réplique et le fait.

La seconde revue (`rogue-ux`), sur le devis repris et le code, mesurés dans Chromium à huit écrans : **à reprendre** encore.

- **Ce qui décide passait sous le pli** (§ 3.6) : les « Prendre » d'une histoire, le plafond d'après à l'échange, la tuile « N autres » d'une porte sur un portable de 650 px de haut (les rangées se comptaient par la largeur seule).
- **Échap perdait une pochette payée** : le retour visait tout bouton « fermer », et « Ne rien signer » en était un.
- **Le rail coupait une même course** : l'étal l'avait, la pochette qu'on y ouvre non. Les sept scènes sont sans rail ; le dé d'un pari ne peut plus refermer une page ouverte entre-temps.
- **Banc plein, « Prendre » allumé ne faisait qu'un son.**
- **Sur un téléphone couché**, le compte d'une porte était caché de 73 px : les portes y prennent la hauteur.
- Pas repris : une version courte de chaque scène pour 844 × 390 (JP l'a écartée : le milieu défile) ; l'échange n'est jugé qu'avec les sortants que la sauvegarde du robot donne (sept, pas quatorze) ; l'encoche de côté ne se simule pas dans le juge.
