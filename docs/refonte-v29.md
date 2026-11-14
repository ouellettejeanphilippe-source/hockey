# V29 — Le Rogue : le build décide

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` les 13 et 14 nov. 2026. La carte, les portes, les scènes et le simulateur de la V28 restent ; ce qui change est ce que tes choix pèsent. **Rien du jeu n'est codé** : seule la mesure d'un jour existe (`scripts/mesure_build.mjs`, tranche 0).

## En une page

**Le constat (13 nov.).** Le Rogue de la V28 tient trois règles ensemble, et ensemble elles font un jeu qui se joue tout seul :

1. aucun geste pendant le match ;
2. tout ce que tu choisis est borné sous le dé (« une carte change la forme du match, pas sa force », la boule de neige bloquée) ;
3. un simulateur réaliste, où un match de hockey est presque un pile ou face.

Slay the Spire, Balatro et les autobattlers n'en tiennent jamais plus d'une. Mesuré sur 48 runs du robot qui lit : une signature vaut ≈ 2 points de chance, 44 % des matchs se jouent entre 40 et 60 %, les deux robots habiles finissent à la même force (193), 4 Coupes sur 48.

**JP défait la deuxième** (13 nov. : « le build décide »). Les deux autres restent : le simulateur, et le match qu'on regarde.

**Le jeu neuf, en quatre phrases.**

- Une pièce de banc **compte tes joueurs** (les paliers d'un badge, ou d'où ils viennent) et **multiplie** un canal du match, tout le match, par marches : rien, puis trois sauts.
- Ton banc a une direction **dès le camp** : la pièce de ton coach et deux que tu choisis, avant la première porte.
- Aux portes, tu signes **pour ton banc** autant que pour la cote, et tu choisis qui sort.
- Les adversaires montent assez pour que la cote seule ne suffise plus à l'acte III : un club bien bâti **explose**, un club mal bâti meurt.

**Ce que la mesure d'un jour a dit** (§ 4) : le simulateur porte ces multiplicateurs (un banc bâti vaut +33 points de chance à l'acte III, +13 pour qui ne lit pas le sien) ; bâtir paie quand le banc est connu dès le camp et que tu choisis qui sort (31 Coupes sur 48 contre 12) ; les pièces d'origine font la décision, les pièces de badge la puissance et la variété. La run devient trop facile : la difficulté se remonte à la tranche 1.

## 1. Ce que JP a dit

JP, 13 nov. 2026, après avoir essayé la V28 : *le roguelike est pas le fun, ni bati comme il faut pour être un vrai jeu je trouve*.

Ce qu'il a tranché, aux questions posées :

- 13 nov. — la direction : **« Le build décide »** (devant « le soir se joue », « le match devient un calcul », « on arrête de refaire le Rogue »).
- 14 nov. — ce que les pièces comptent : **« Les deux »**, l'origine et les badges.
- 14 nov. — quand le banc arrive : **« Trois pièces au camp »**.
- 14 nov. — la difficulté : **« Dur, mais ça explose »** : la Coupe reste rare (4 à 12 sur 64 pour qui joue bien, pas avant la troisième run), mais un bon banc explose dans une run sur quatre environ, au lieu de 7 %.

Le même reproche depuis un mois, et ce qu'il demandait déjà (docs/refonte-v28.md § 1) : *le jeu se joue tout seul, je n'ai pas beaucoup d'impact* (7 oct.) ; *le but du jeu, ça devrait être de trouver les meilleures combinaisons* (10 oct.) ; *pas facile, mais tu peux exploser le jeu* (8 oct.) ; *à la Balatro, Slay the Spire, Pokémon TCG* (2 nov.).

**La taille est décidée** : le banc, ce qu'il pèse et la difficulté se refont. La carte, les portes et les scènes de la V28 ne se refont pas (§ 7, « Ce qui reste »).

## 2. Ce que le joueur ressent

**Le fantasme** : « Mon coach compte les plombiers. Au camp, je prends Les anciens et La muraille. À chaque porte, je cherche ce que mon banc compte. À l'acte II, la deuxième marche s'allume, et mon club ne donne plus un tir. »

- **Les pics** : une marche qui s'allume (la carte qu'il te manquait derrière la porte) ; l'acte III joué à 80 % parce que le banc s'emboîte ; le rival battu 6-1.
- **Le creux qui enseigne** : la run morte à l'acte II avec trois pièces sous leur première marche. Perdre dit « j'aurais dû bâtir autour de ce que j'avais ».
- **Le jour ordinaire reste rapide** : un match sans geste, six touchers la semaine gagnée.
- **Les boucles nourries** : la case (signer pour le banc), l'acte (une pièce de plus, une marche de plus), la run (deux runs ne se ressemblent plus : le coach et le camp donnent la direction).

## 3. Les règles du jeu

### 3.1 Une pièce compte, et multiplie

- Une pièce de banc a **ce qu'elle compte**, **son canal** et **ses trois marches**.
- **Deux sortes de compte** (JP : « les deux ») :
  - **les badges** : les paliers d'un ou deux badges chez tes **habillés** (Bronze 1 à Platine 4, le second badge à moitié) — les tireurs, les passeurs, les gros, les deux sens, l'étouffoir (les checkers), les plombiers, la muraille (les défenseurs défensifs et physiques), la pointe, la relance ;
  - **l'origine** : des joueurs de **tout ton effectif** — ton plus gros groupe de la même décennie (l'époque), de la même franchise, du même club la même saison (les coéquipiers), et deux époques nommées (les anciens, d'avant 1985 ; les modernes, depuis 2010).
- **Les marches** : sous la première, la pièce ne fait rien. Chaque marche est plus haute que la précédente (≈ +12 %, +37 %, +75 % aux valeurs de l'essai) : la concentration paie plus que l'éparpillement.
- **Le canal** est un de ceux que le moteur lit déjà : tes tirs, ta précision, leurs tirs, leur précision. Aucune mécanique neuve au moteur.
- **Elle joue tout le match, chaque match.** Plus de condition de pointage, de lieu ni de période ; plus de relais.
- **La marche se lit sur la pièce** : son compte, la marche atteinte, son effet, le seuil de la suivante (« Les plombiers · 7 paliers · 2e marche · leur précision −27 % · la 3e à 9 »).

### 3.2 Le banc

- **Cinq cases**, comme aujourd'hui.
- **Le départ** (JP : « trois pièces au camp ») : la pièce de ton coach, puis **deux choix d'une pièce parmi trois**, avant la première porte. La scène de la pièce offerte d'aujourd'hui sert aux deux choix.
- **La pièce de départ de chaque coach** compte ce que sa philosophie joue : le Frelon les passeurs, l'Aigle les tireurs, la Tortue la muraille, le Rhino les plombiers, le Doc les deux sens, l'Abbé l'étouffoir, le Contremaître les gros, le Showman la pointe. Sa maîtrise (×0,9 à ×1,3) règle ses marches.
- **Ensuite**, comme aujourd'hui : une pièce parmi trois au rival battu, à l'élite gagnée, au marché. Banc plein : la pièce neuve d'abord, puis celle qui sort.
- **La règle du coach** (ses jetons le soir où ton club joue son hockey) ne change pas.

### 3.3 Aux portes et à l'échange

- **La porte ouverte** : le coin de chaque carte dit ce que le joueur ajoute à ton banc (« +2 aux plombiers »), à la place de l'accord qu'il allumerait.
- **L'échange** : sous le comparatif, ton banc avant et après — le compte de chaque pièce touchée, la marche gagnée ou perdue.
- **Tu choisis qui sort**, comme aujourd'hui (« Qui sort · touche un joueur ») : garder un plombier faible plutôt qu'un marqueur moyen devient un vrai choix.

### 3.4 Le match et l'après-match

- **Le match reste sans geste.** Sous la glace, chaque pièce allumée dit sa marche et son effet du soir.
- **L'après-match** dit ce que ton banc a valu ce soir, en vraies stats de match (tirs, buts), comme la feuille le garde déjà par pièce.
- **La fin de run** nomme ton banc : chaque pièce, sa marche finale.

### 3.5 Les adversaires

- **La difficulté vient toujours de clubs plus forts**, jamais d'un malus caché : leurs étapes d'édition et leurs bandes montent (§ 8) pour que la cote seule ne suffise plus à l'acte III.
- **Leur coach en séries** porte la pièce de départ de sa philosophie, qui compte **leurs** joueurs. Son ombre part.
- **Le style d'un club** (le mot sous sa case) reste : le plan du duel y répond. Les trois pièces « pour le battre » partent avec les conditions.

### 3.6 Ce qui ne change pas dans la run

La carte de l'acte, les cibles, les deux cœurs, les trois portes, l'échange, le plafond qui mord, le duel à un choix (le plan vient de ton coach et de ce qui répond à leur jeu), l'élite, le marché et ses pochettes, le vestiaire, les histoires, les séries, la méta.

## 4. Les chiffres

**Ce qu'un multiplicateur vaut au simulateur** (mesuré le 13 nov., une pièce d'essai allumée tout le match, dix soirs de runs du robot qui lit, 300 matchs par soir) :

| La pièce d'essai | Ta chance |
|---|---|
| aucune | 59 % |
| précision ×1,25 | 65 % |
| précision ×1,5 | 70 % |
| précision ×2 | 78 % |
| tirs ×1,5 | 69 % |

Un point de pourcentage sur un canal vaut ≈ 0,2 point de chance ; une signature moyenne, ≈ 2 points (22 points de cote).

**La marche d'une pièce** : `marche(n) = le % du plus haut seuil ≤ n`, zéro sous le premier. Ton canal est multiplié par `1 + %` ; le leur par `1 / (1 + %)`. Un exemple fait à la main : Les plombiers, seuils 3 · 6 · 9 paliers pour 15 · 37 · 75 % ; tu habilles deux plombiers Argent et un bagarreur Or, 2 + 2 + 3 = 7 paliers : la deuxième marche, leur précision ×1 / 1,37 = −27 %.

**La mesure d'un jour** (`scripts/mesure_build.mjs`, 48 graines, les mêmes pour chaque robot). Le **témoin** est le robot qui lit d'aujourd'hui : il prend les pièces d'essai offertes, mais ne lit pas son banc aux portes. Le **bâtisseur** est le même robot, qui ajoute à la cote ce que l'échange change au compte de son banc. Rien d'autre ne les sépare.

| # | Les pièces d'essai | Cibles tenues, bâtisseur · témoin | Coupes | Le banc à l'acte III |
|---|---|---|---|---|
| 1 | badges, en ligne droite, une pièce au départ | 67 % · 66 % (+0,7 ±10,8) | 14 · 10 | +16 · +12 |
| 2 | badges, à seuils, une pièce au départ | 49 % · 59 % (−11,8 ±10,6) | 7 · 5 | +15 · +7 |
| 3 | badges, à seuils, trois au camp | 62 % · 60 % (0,0 ±12,2) | 13 · 5 | +17 · +10 |
| 4 | les mêmes, 2,5 fois plus fortes | 69 % · 75 % (−5,6 ±12,0) | 19 · 20 | +29 · +22 |
| 5 | origines, à seuils, trois au camp | 51 % · 65 % (−13,9 ±12,5) | 3 · 5 | +13 · +5 |
| | *le bâtisseur choisit maintenant qui sort* | | | |
| 6 | badges, à seuils ×1,5, trois au camp | 74 % · 73 % (+0,7 ±13,4) | **27 · 16** | **+30 · +17** |
| 7 | origines, à seuils ×1,5, trois au camp | **72 % · 57 % (+16,7 ±12,1)** | 9 · 4 | +20 · +7 |
| 8 | **les deux ensemble, 14 pièces (le choix de JP)** | 79 % · 72 % (+7,6 ±10,9) | **31 · 12** | **+33 · +13** |

Ce que ces lignes disent :

- **Le simulateur porte la puissance.** Un banc vaut +17 à +30 points de chance à l'acte III ; le quart du haut, +35. Le bâtisseur de la ligne 6 joue l'acte III à 78 % et 54 % de ses runs y dépassent 75 %.
- **Les lignes 1 à 5 étaient faussées par mon robot** : à chaque échange il faisait sortir son joueur le plus faible, donc les joueurs de rôle que son banc comptait. Un humain choisit qui sort ; le robot aussi, depuis la ligne 6.
- **En ligne droite, bâtir ne paie pas** (ligne 1) : chaque palier payant pareil, un banc se paie en cote ce qu'il rapporte. Il faut des marches.
- **Une seule pièce au départ ne suffit pas** (ligne 2) : la direction arrive quand la moitié des signatures sont faites.
- **L'origine fait la décision** (ligne 7) : le témoin ne tombe pas dessus par hasard (son banc vaut +7), et derrière la bonne porte on signe encore le meilleur. Mais elle donne moins de builds : quatre pièces gagnantes, dont Les modernes 12 fois sur 19.
- **Les badges font la puissance et la variété** (ligne 6) : sept pièces gagnantes, 27 Coupes contre 16. Mais le témoin en profite presque autant : les badges payants viennent avec la cote.
- **Les deux ensemble font mieux que chacune** (ligne 8, le réglage par défaut de la mesure) : le bâtisseur joue les actes à 56, 68 et 79 % de chance (le témoin : 54, 62, 69 %), 58 % de ses runs dépassent 75 % à l'acte III (27 %), un tiers de ses pièces sont à leur troisième marche (2 %), et neuf pièces différentes mènent un banc gagnant (Les plombiers 9 fois sur 26, Les tireurs 5).
- **À ces forces, la run est trop facile** pour les deux robots (79 et 72 % de cibles, 31 Coupes sur 48) : la difficulté se règle à la tranche 1, sur les bornes de JP (§ 9).

**Deux critères de la mesure restent rouges, de peu**, sur la ligne 8 : « en paires, le bâtisseur tient plus de cibles que le témoin, au-delà du bruit » (+7,6 points pour un bruit de ±10,9 : les cibles plafonnent, les deux robots les tiennent trois fois sur quatre) et « à l'acte III, 10 points de chance au-dessus du témoin » (+9,7). Les bornes ne bougent pas : la tranche 1 doit ouvrir l'écart en montant les adversaires, et le dira si elle n'y arrive pas.

## 5. Les cas limites

- **Un habillé blessé** ne compte plus pour une pièce de badge tant qu'il est absent : la marche peut retomber un soir, et la pièce le dit (son compte, le seuil manqué).
- **Banc plein** : la pièce neuve d'abord, puis celle qui sort, comme aujourd'hui.
- **Une pièce sous sa première marche** est sur ton banc pour rien : elle le dit, et le marché en offre une autre.
- **Les séries** : les mêmes pièces, les mêmes marches ; leur coach compte leurs joueurs.
- **La run gardée d'avant la V29** : `VERSION_DE_LA_RUN` monte ; elle se rouvre avec son coach et ses joueurs, et chaque pièce d'avant devient la pièce de départ de sa philosophie (une pièce hors des voies part). Les clés de sauvegarde ne bougent pas — `check_sauvegardes`.
- **Hors ligne** : aucun fichier neuf dans la coquille ; `sw.js` oublie ce qui part — `check_coquille`.
- **Le clavier et la manette** : rien ne change, les deux choix du camp sont la scène de la pièce offerte.

## 6. Ce qu'il touche

**Les fichiers** : `js/pieces.js` (réécrit de zéro), `js/greffes.js` (le banc posé une fois par match), `js/run.js` (les deux choix du camp, les réglages de la difficulté, `VERSION_DE_LA_RUN`), `js/run-scenes.js` et `js/run-jeu.js` (le camp, le coin d'une carte à la porte, l'échange, le banc, le match, la fin de run), `js/impact.js` (les lignes d'une pièce, les plans du duel), `js/cartes.js` (la carte d'une pièce dit son compte), `style.css` (peu), `sw.js` (la version) ; `scripts/lib/run_robot.mjs` (le robot qui lit devient le bâtisseur), `scripts/check_pouvoirs.mjs` (réécrit), `scripts/mesure_run.mjs` (les bornes), `scripts/check_moments_si.mjs`, `scripts/check_elites.mjs`, `scripts/check_duel.mjs`, `scripts/lib/duel.mjs`.

**Les règles fermes** (`.claude/rules/rogue.md`, réécrites à la tranche qui change le jeu) :

- **Défaites** par JP le 13 nov. : « une carte change la forme du match, pas sa force » **pour une pièce de banc** (elle tient pour une réponse d'histoire) ; « le banc remesuré » et ses bornes en victoires ; « la boule de neige est bloquée » **dans la run, pour le banc** (rien ne se garde toujours d'une run à l'autre) ; « tu peux exploser le jeu : 5 à 12 % ».
- **Défaites** par ce devis : « le relais », « pour le battre », l'ombre de leur coach.
- **Tenues** : la run est une carte, la cible et les cœurs, toutes les années ensemble, les trois portes, le plafond qui mord, la difficulté par des clubs plus forts, la première Coupe pas avant la troisième run, le duel à un choix, l'élite, les médailles en variété, le cœur pur, une seule grammaire d'effet pour les histoires.
- `.claude/rules/moteur.md` : **tenue tout entière** (les canaux existants, le moteur n'importe rien du Rogue).
- `.claude/rules/vocabulaire.md` : **entrent** la marche, le compte ; **partent** le relais, le maillon, « pour le battre », l'ombre.

**Les clés de sauvegarde ne bougent jamais.**

## 7. Ce qui part

Chaque nom ci-dessous disparaît du jeu ; *check_refonte* le vérifie. Seul ce qui part est entre accents graves dans cette partie. Le test du zéro : la table des pièces, leur compte et leurs marches s'écrivent depuis le § 3 sans relire une condition d'aujourd'hui.

### Les trente-six pièces à condition

- Les conditions lues au pointage, à la période et au lieu, leur mot à l'écran `quandMot`, et les pièces de la soirée : `bancDuSoir`, `poserLeBancDuSoir`, `piecesDuSoir` → la pièce qui compte, posée une fois par match.
- Le banc lu période par période : `bancDeLaPeriode`, `bancPose` → une lecture avant le match.

### Le relais

- `RELAIS_NIV`, `effetDuRelais`, `ligneDuRelais`, `scripts/check_relais.mjs` → rien : la combinaison est le compte.

### La rareté et les restes

- `POIDS_RARE`, `poidsDuTirage` (l'ancien arbitre) → rien : aucune pièce rare au départ.
- `PIECES_PAR_SAISON_DES_FOURCHES` → rien : la saison est partie à la V28.

### Pour le battre, et l'ombre

- `piecesContre` → rien : le style d'un club reste le mot de sa case.
- `OMBRE` → leur coach compte leurs joueurs.
- `PLAN_DE_LA_PIECE` → le plan du duel vient de ton coach et de ce qui répond à leur jeu.

**Le compte** : 16 noms, la table des 36 pièces (≈ 130 lignes de *js/pieces.js*), le banc par période de *js/greffes.js* (≈ 60 lignes), les 203 lignes de `scripts/check_relais.mjs`, les bornes en victoires de *scripts/check_pouvoirs.mjs*.

### Ce qui reste, et pourquoi

- **Le simulateur et le match sans geste** : JP, 9 nov. et 13 nov. (c'est la deuxième règle qu'il défait, pas celles-là).
- **La carte, les portes, l'échange, les scènes de la V28** : livrées le 11 nov., elles sont la bonne charpente ; trois scènes changent de contenu, aucune de plan.
- **Les cinq cases du banc, la pièce parmi trois, banc plein** (*CASES_DU_BANC*, *piecesOffertes*, *poserLaPiece*) : la mécanique d'acquisition est bonne, c'est ce que la pièce fait qui change.
- **Le coach, sa maîtrise, sa règle** (*PIECE_DU_COACH*, *forceDeLaPiece*, *REGLES_DU_COACH*) et **leur coach en séries** (*persoAdverse*).
- **Les moments** (*MOMENTS_SI*, *poserLeSoir*) : les réponses d'histoire les lisent encore.
- **Le duel à un choix, l'élite, le marché, le vestiaire, les histoires, la méta, les galons.**
- **Les cartes de joueurs et de jeu**, telles quelles (JP, deux fois).

## 8. Les réglages

| Constante | Valeur de départ | Plage sûre | Au-delà |
|---|---|---|---|
| Les marches d'une pièce | celles de l'essai (≈ 12 · 37 · 75 %) | la 3e entre 50 et 100 % | plus bas, bâtir ne paie plus (ligne 3) ; plus haut, le témoin gagne sans lire (ligne 4) |
| Les seuils d'une pièce de badge | au-dessus de ce que la cote donne seule (12 paliers de sniper, 1 de checker) | — | trop bas, le premier seuil est gratuit |
| Les seuils d'une pièce d'origine | 3 à 16 joueurs selon le groupe | — | une pièce qui gagne plus de 40 % des bancs gagnants se resserre |
| *CASES_DU_BANC* | 5 | 5 | ne se règle pas (JP, 7 nov.) |
| Les pièces au camp | celle du coach et 2 choisies | 2 à 3 | une seule : ligne 2 |
| *ETAPES*, *DECALAGE*, les bandes | à remesurer (aujourd'hui 1 · 2 · 3 · 7 et 0,25) | — | la tranche 1 les monte jusqu'aux bornes du § 9 |
| Le poids du banc pour le robot | 3,3 points de cote par point de pourcentage | 2 à 5 | une mesure, jamais lue par le jeu |

## 9. Les critères d'acceptation

- [x] **La porte 0, le test d'un jour** (13 et 14 nov.) : le simulateur porte les multiplicateurs ; avec les quatorze pièces et trois au camp, le bâtisseur gagne 31 Coupes sur 48 contre 12 et joue l'acte III 9,7 points au-dessus — `mesure_build` (§ 4). Deux critères rouges de peu, dits au § 4.
- [ ] **Bâtir paie, sans 384 graines** : sur 64 graines, en paires, le bâtisseur tient plus de cibles que le même robot qui ne lit pas son banc, au-delà de deux écarts-types — `mesure_run`.
- [ ] **Dur, mais ça explose** (JP, 14 nov.) : le bâtisseur gagne la Coupe 4 à 12 fois sur 64, jamais avant sa troisième run en médiane ; 15 à 35 % de ses runs jouent l'acte III à 75 % de chance ou plus ; « premier » gagne au plus 2 fois — `mesure_run`.
- [ ] **La cote seule ne suffit plus** : le robot du chiffre tient la cible de l'acte III au plus une fois sur trois — `mesure_run`.
- [ ] **Plus d'un build gagne** : au moins cinq pièces différentes sont la plus forte d'un banc qui tient ses trois cibles, aucune dans plus de 40 % d'entre eux ; chaque coach gagne — `mesure_run`.
- [ ] **Chaque pièce joue ce qu'elle dit** : en paires contre un banc vide, exactement sa marche, rien sous son premier seuil, et elle se voit dans la feuille ; chaque pièce atteint sa deuxième marche dans 10 à 60 % des runs du bâtisseur qui la portent — `check_pouvoirs` (réécrit).
- [ ] **La run** : trois pièces avant la première porte ; la même graine rejoue la même run ; une run gardée d'avant se rouvre — `check_run`, `check_sauvegardes`.
- [ ] **Les scènes** : les deux choix du camp, le coin d'une carte, l'échange et le banc tiennent à 390 × 844 sans défiler ; une semaine gagnée en neuf touchers — `check_scene`, `essai_run`.
- [ ] **Le moteur ne bouge pas** : le 82-0 se rejoue au but près — `check_empreinte`, `check_couches`.
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées — `check_refonte`.
- [ ] Rien de mort — `check_mort`.
- [ ] À juger par JP à l'essai : une porte donne envie de l'ouvrir pour ce que ton banc compte ; une marche qui s'allume se sent ; perdre fait dire « j'aurais dû ».

## Les tranches

**0. Le test d'un jour** (fait, 13 et 14 nov.). `scripts/mesure_build.mjs` : les pièces d'essai dans la table le temps de la mesure, le bâtisseur contre le témoin. *Le joueur ne voit rien.*

**1. Le banc qui compte.** `js/pieces.js` réécrit, le banc posé une fois par match, les deux choix du camp (par la scène de la pièce offerte), le robot bâtisseur, la difficulté remontée aux bornes de JP, `check_pouvoirs` réécrit, le § 7 parti. Les scènes d'aujourd'hui montrent les pièces neuves sans changer de plan. Juge : `mesure_run`, `check_pouvoirs`, `check_run`, `check_refonte`, `check_scene`, `essai_run`.

**2. Lire son banc à l'écran.** Le coin d'une carte à la porte, le banc avant et après à l'échange, la scène du Banc avec ses comptes et ses marches, le match et l'après-match, la fin de run. Juge : `check_scene`, `essai_run`, JP à l'essai.

**3. Du contenu.** Des pièces de plus dans les deux sortes, une à la fois, chacune mesurée ; les exigences relues sur la difficulté neuve.

## Ce qui a été écarté

- **Le soir se joue** (un geste par période) et **le match devient un calcul** (plus de simulateur) : les deux autres règles à défaire, écartées par JP le 13 nov.
- **Des pièces en ligne droite** (tant par palier) : mesuré, bâtir ne paie pas (§ 4, ligne 1).
- **Le banc qui se découvre en route** : mesuré, la direction arrive trop tard (ligne 2).
- **Des pièces 2,5 fois plus fortes** : le robot qui ne lit rien gagne autant (ligne 4).
- **L'origine seule** ou **les badges seuls** : JP prend les deux (14 nov.).
- **Régler une constante dans la structure d'aujourd'hui** (le rachat, les portes, les étapes) : essayé du 10 au 12 nov., l'écart entre lire et ne pas lire restait sous le bruit de 64 graines.
