# V29 — Le Rogue : le build décide

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` les 13 et 14 nov. 2026, **repris le 14 nov. après `/revue-design`** (quatre relecteurs en adversaires : « À reprendre » ; ce qu'ils ont trouvé est au § 10, et JP a tranché quatre questions de plus). La carte, les portes, les scènes et le simulateur de la V28 restent ; ce qui change est ce que tes choix pèsent. **Rien du jeu n'est codé** : seule la mesure d'un jour existe (`scripts/mesure_build.mjs`, tranche 0).

## En une page

**Le constat (13 nov.).** Le Rogue de la V28 tient trois règles ensemble, et ensemble elles font un jeu qui se joue tout seul :

1. aucun geste pendant le match ;
2. tout ce que tu choisis est borné sous le dé (« une carte change la forme du match, pas sa force », la boule de neige bloquée) ;
3. un simulateur réaliste, où un match de hockey est presque un pile ou face.

Slay the Spire, Balatro et les autobattlers n'en tiennent jamais plus d'une. Mesuré sur 48 runs du robot qui lit : une signature vaut ≈ 2 points de chance, 44 % des matchs se jouent entre 40 et 60 %, les deux robots habiles finissent à la même force (193), 4 Coupes sur 48.

**JP défait la deuxième** (13 nov. : « le build décide »). Les deux autres restent : le simulateur, et le match qu'on regarde.

**Le jeu neuf, en quatre phrases.**

- Une pièce de banc **compte les joueurs que tu as signés** (leurs badges, ou d'où ils viennent) et **multiplie** un canal du match, tout le match, par marches : rien, puis trois sauts.
- Ton banc a une direction **dès le camp** : la pièce de ton coach et deux que tu choisis, avant la première porte.
- Aux portes, tu signes **pour ton banc** autant que pour la cote, tu choisis qui sort, et tes jetons **relancent les portes** pour chercher ce que ton banc compte.
- Les adversaires montent tard, pour que la cote seule ne suffise plus à l'acte III : un club bien bâti **explose**, et **les séries restent le mur**.

**Ce que la tranche 0 bis a prouvé** (§ 4, deux juges de 256 graines neuves, un témoin à une seule différence) : le robot qui bâtit tient 78 à 81 % de ses cibles contre 57 à 60 % (+21 à +22 points, bruit ±4,8), un quart à un tiers de ses runs explosent, il gagne 10 Coupes sur 64 au second juge, et une run qui explose perd encore en séries près de deux fois sur trois. Restent ouverts : des jetons que la relance ne vide qu'à moitié, et des pièces d'origine qui ne mènent presque aucun banc gagnant.

**Ce que la mesure d'un jour avait dit, avant la revue** (§ 4) : le simulateur porte ces multiplicateurs (un banc bâti vaut +33 points de chance à l'acte III, +13 pour qui ne lit pas le sien) ; bâtir paie quand le banc est connu dès le camp et que tu choisis qui sort (31 Coupes sur 48 contre 12) ; les pièces d'origine font la décision, les pièces de badge la puissance et la variété. La run devient trop facile, et la revue a montré que cette mesure n'est pas encore une preuve (§ 10) : **la tranche 0 bis** la refait à la difficulté livrée, sur des graines neuves, avant qu'une ligne du jeu parte.

## 1. Ce que JP a dit

JP, 13 nov. 2026, après avoir essayé la V28 : *le roguelike est pas le fun, ni bati comme il faut pour être un vrai jeu je trouve*.

Ce qu'il a tranché, aux questions posées :

- 13 nov. — la direction : **« Le build décide »** (devant « le soir se joue », « le match devient un calcul », « on arrête de refaire le Rogue »).
- 14 nov. — ce que les pièces comptent : **« Les deux »**, l'origine et les badges.
- 14 nov. — quand le banc arrive : **« Trois pièces au camp »**.
- 14 nov. — la difficulté : **« Dur, mais ça explose »** : la Coupe reste rare (4 à 12 sur 64 pour qui joue bien, pas avant la troisième run), mais un bon banc explose dans une run sur quatre environ, au lieu de 7 %.

Après la revue du devis (14 nov.), quatre questions de plus :

- qui compte pour une pièce : **« Seulement tes signés »** — un bouche-trou ne compte pour rien, ton banc part de zéro ;
- la Coupe contre l'explosion, deux bornes qui se contredisaient à la mesure : **« Les séries sont le mur »** — une run sur quatre explose aux actes, la Coupe reste à 4 à 12 sur 64 ;
- les jetons après l'acte I : **« Relancer les portes »**, payé en jetons, à un prix qui monte ;
- le match du rival, qui décide encore une cible sur deux à pile ou face : **« On remesure après le banc »**.

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
- **Seuls les joueurs que tu as signés dans la run comptent** (JP, 14 nov.), où qu'ils soient dans ton effectif : habillés, en civil ou blessés. Un bouche-trou du départ ne compte pour rien. Ton banc part donc de zéro, et chaque marche est à toi. Un signé qui sort par l'échange ne compte plus.
- **Deux sortes de compte** (JP : « les deux ») :
  - **les badges** de tes signés, chacun à son palier (Bronze 1, Argent 2, Or 3, Platine 4 ; le second badge à moitié) : les tireurs, les passeurs, les gros, les deux sens, les checkers, les plombiers et les bagarreurs, les défenseurs défensifs et physiques, les défenseurs offensifs, les manieurs ;
  - **l'origine** de tes signés : ton plus gros groupe de la même décennie, de la même franchise, du même club la même saison (de vrais coéquipiers), et deux époques nommées (avant 1985 ; depuis 2010).
- **Les marches** : sous la première, la pièce ne fait rien. Chaque marche est plus haute que la précédente (≈ +12 %, +37 %, +75 % à l'essai) : la concentration paie plus que l'éparpillement. Les seuils se posent sur ce qu'un effectif de signés peut atteindre : une première marche à la portée du camp et de l'acte I, la troisième pour qui a bâti autour d'elle (§ 8).
- **Le canal** est un de ceux que le moteur lit déjà : tes tirs, ta précision, leurs tirs, leur précision. Aucune mécanique neuve au moteur. Chaque pièce justifie son canal par ce qu'elle compte (des tireurs font ta précision, des défenseurs défensifs coupent leurs tirs) ; une pièce d'origine prend le canal du jeu de son époque ou de son groupe, écrit avec elle.
- **Elle joue tout le match, chaque match**, par-dessus les bornes de style du moteur, comme une pièce d'aujourd'hui dans sa période. Plus de condition de pointage, de lieu ni de période ; plus de relais.
- **Deux pièces sur le même canal se multiplient**, et le produit d'un canal est borné (§ 8) : c'est là que le club explose, et là que le moteur reste entier.
- **À l'écran**, aucun mot de code : l'icône de ce qu'elle compte, son compte et le seuil d'après (« 7 / 9 »), trois points pour ses marches, et son effet en vraies stats de match (des tirs, des buts : `motsDeStats`), jamais en pourcentage. Aucune pièce ne porte le nom d'un accord de ligne (« Les plombiers », « La relance » sont pris).

### 3.2 Le banc

- **Cinq cases**, comme aujourd'hui.
- **Le départ** (JP : « trois pièces au camp ») : la pièce de ton coach, puis **deux choix d'une pièce parmi trois**, avant la première porte. Personne n'est encore signé : tu choisis une direction, pas un chiffre. La scène du camp dit ce que chaque pièce compte et ses trois seuils ; elle n'a ni « Passer » ni le texte d'un match gagné.
- **La pièce de départ de chaque coach** compte ce que sa philosophie joue : le Frelon les passeurs, l'Aigle les tireurs, la Tortue les défenseurs défensifs, le Rhino les plombiers et les bagarreurs, le Doc les deux sens, l'Abbé les checkers, le Contremaître les gros, le Showman les défenseurs offensifs. Sa maîtrise (×0,9 à ×1,3) règle ses marches, dans la borne du canal.
- **Ensuite**, comme aujourd'hui : une pièce parmi trois au rival battu, à l'élite gagnée, au marché. Banc plein : la pièce neuve d'abord, puis celle qui sort. Une pièce offerte dit son compte chez toi.
- **La règle du coach** (ses jetons le soir où ton club joue son hockey) ne change pas.

### 3.3 Aux portes et à l'échange

- **La porte fermée** dit combien de joueurs, derrière elle, nourrissent ton banc (« 3 pour ton banc »), à côté de « dans ton espace ». Le tiroir de la carte le dit aussi pour le vestiaire du club affronté.
- **La porte ouverte** montre d'abord ceux qui nourrissent ton banc, puis les plus forts ; le coin d'une carte dit ce que le joueur ajoute, en icônes chiffrées. L'ordre exact se tranche sur capture, à la tranche 2.
- **L'échange** : ton banc avant et après dans le comparatif (deux lignes, le reste plié), la marche gagnée ou perdue. **La sortie proposée d'avance est le plus faible dont le départ ne coûte aucune marche** ; tu peux toucher un autre joueur.
- **Relancer les portes** (JP, 14 nov.) : tes jetons tirent trois autres vestiaires, à un prix qui monte à chaque relance du même soir (§ 8). La relance gratuite après une défaite reste. C'est de la force : elle se mesure et se paie cher.
- **Passer** paie toujours ses jetons.

### 3.4 Le match et l'après-match

- **Le match reste sans geste.** Sous la glace, chaque pièce allumée dit sa marche et ce qu'elle fait ce soir.
- **Une marche qui s'allume** se voit au moment de signer, avant de quitter l'échange, et son palier de jus se tranche à la tranche 2 (notable, ou pic pour la troisième). Une pièce sous sa première marche se lit comme un but à atteindre (« 2 / 3 »), jamais comme une case éteinte.
- **L'après-match** dit ce que ton banc a valu ce soir, en vraies stats de match, comme la feuille le garde déjà par pièce.
- **La fin de run** nomme ton banc : chaque pièce, sa marche finale, et la run morte dit ce qui manquait à sa pièce la plus avancée.

### 3.5 Les adversaires

- **La difficulté vient toujours de clubs plus forts**, jamais d'un malus caché.
- **Elle monte tard** : l'acte I reste celui d'aujourd'hui (ton banc n'y existe pas encore), l'acte III et les séries montent, pour que la cote seule n'y suffise plus.
- **Les séries sont le mur** (JP, 14 nov.) : un club qui explose aux actes y perd encore une fois sur deux. Leur levier est à elles : **leur coach** porte la pièce de départ de sa philosophie, qui compte leurs joueurs à une marche fixée par la ronde (la première, la deuxième, la troisième), en plus de leurs étapes d'édition. Son ombre part.
- **Le style d'un club** (le mot sous sa case) reste. Les trois pièces « pour le battre » partent avec les conditions.

### 3.6 Ce qui ne change pas dans la run

La carte de l'acte, les cibles, les deux cœurs, les trois portes, le plafond qui mord, le duel à un choix, l'élite, le marché, le vestiaire (monter une carte monte ses badges, donc le compte d'une pièce), les Lignes (mettre un signé en civil ne change aucun compte), les histoires, les séries, la méta.

### 3.7 Hors de la taille, et nommé

Le diagnostic les a relevés ; cette refonte ne les règle pas, et le dit :

- **Le match du rival**, qui compte double et décide la cible dans au moins 65 actes sur 135 à 49 % de chance. JP (14 nov.) : on remesure après le banc ; `mesure_run` imprimera la part des actes qu'il décide, et la question se repose avec ce chiffre.
- **La feuille du soir à un bouton**, et **ta chance qui ne se voit qu'après « Y aller »**.
- **Le plan du duel** : sans les pièces qui en proposaient, il vient de ton coach et de ce qui répond à leur jeu ; un choix mince, à revoir après la tranche 2.
- **La pochette Époque**, qui tient sous le plafond 39 fois sur 100 et nourrit rarement une origine.
- **Les accords de ligne** : ils restent au moteur et sur la feuille du soir ; le coin d'une carte à la porte ne les dit plus.

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

**La marche d'une pièce** : `marche(n) = le % du plus haut seuil ≤ n`, zéro sous le premier. Ton canal est multiplié par `1 + %` ; le leur par `1 / (1 + %)`. Un exemple fait à la main, aux valeurs de l'essai : seuils 3 · 6 · 9 pour 15 · 37 · 75 % ; tu as signé deux plombiers Argent et un bagarreur Or, 2 + 2 + 3 = 7 : la deuxième marche, leur précision ×1 / 1,37. L'écran dit « 7 / 9 » et l'effet en buts.

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

**Ce que la revue a défait dans cette mesure** (14 nov., § 10) — elle montre que le simulateur porte la puissance, pas encore que bâtir paie :

- **Le témoin différait en trois points, pas un** : il prenait la première pièce offerte et n'en remplaçait aucune (57 % de ses pièces sous leur seuil). Entre les lignes 5 et 7, sur les mêmes graines, il passe de 65 à 57 % de cibles : la moitié du seul écart vert.
- **Les bouche-trous comptaient** : avant la première porte, une pièce d'origine était déjà à sa troisième marche 9 fois sur 48, et signer la faisait retomber ; Les coéquipiers ne dépassaient jamais 2 pour un seuil de 3.
- **Les seuils étaient calés sur l'effectif de fin de run**, les huit variantes jouées sur les mêmes 48 graines, sans leur coach en séries, et les robots n'achètent ni pochette ni élite.
- **Le chemin au moteur** : les pièces d'essai jouent par-dessus les bornes de style (`PRESSION_MAX`, `FINITION_MAX`), comme une pièce d'aujourd'hui dans sa période. Posées « une fois par match » sous ces bornes, +75 % deviendrait +35 % de tirs ou +20 % de précision. Le § 3.1 le dit maintenant ; et rien ne bornait cinq pièces sur le même canal.

**Deux critères de la mesure restent rouges, de peu**, sur la ligne 8 : « en paires, le bâtisseur tient plus de cibles que le témoin, au-delà du bruit » (+7,6 points pour un bruit de ±10,9 : les cibles plafonnent, les deux robots les tiennent trois fois sur quatre) et « à l'acte III, 10 points de chance au-dessus du témoin » (+9,7). Les bornes ne bougent pas : la tranche 1 doit ouvrir l'écart en montant les adversaires, et le dira si elle n'y arrive pas.

### La tranche 0 bis : la mesure refaite, à la difficulté livrée (14 nov.)

`scripts/mesure_build.mjs`, repris comme la revue l'exigeait : seuls les signés comptent, les seuils reposés, le témoin à une seule différence, la relance des portes payée (8 jetons, puis le double), leur coach en séries, des graines neuves.

**Le réglage, cherché sur 48 graines** (1000 à 1047), en montant les adversaires tard :

| Les adversaires | Cibles tenues, bâtisseur · témoin | L'acte III, en chance | Runs qui explosent | Coupes sur 64 | Une run qui explose gagne |
|---|---|---|---|---|---|
| ceux d'aujourd'hui (étapes 1 · 2 · 3 · 7) | 83 % · 74 % | 88 % · 78 % | 85 % | 48 | 35 fois sur 41 |
| 1 · 3 · 7 · 12 | 77 % · 63 % | 80 % · 67 % | 58 % | 23 | 17 sur 28 |
| 1 · 3 · 10 · 12, leur coach une marche plus haut | 75 % · 65 % | 74 % · 59 % | 44 % | 19 | 13 sur 21 |
| 1 · 3 · 12 · 12, leur coach deux fois plus fort | 71 % · 58 % | 63 % · 48 % | 21 % | 13 | 7 sur 10 |
| **1 · 3 · 12 · 12, leur coach trois fois plus fort** | 71 % · 58 % | 63 % · 48 % | 21 % | 9 | 5 sur 10 |

**Le juge, sur 256 graines neuves** (2000 à 2255), au réglage retenu, trois robots :

| | Le bâtisseur | Le témoin | Le chiffre |
|---|---|---|---|
| Cibles tenues | **81 %** | 60 % | 50 % |
| aux actes I, II, III | 78 · 89 · 74 % | 68 · 75 · 36 % | 61 · 61 · 23 % |
| Chance aux actes I, II, III | 56 · 72 · 65 % | 52 · 63 · 49 % | 49 · 58 · 39 % |
| Runs qui explosent | 23 % | 7 % | 1 % |
| Coupes sur 256 | 56 | 3 | 0 |
| Son banc à l'acte III | +46 points | +23 | +16 |
| Ses pièces à la 3e marche · sous la 1re | 52 % · 9 % | 16 % · 34 % | 7 % · 46 % |
| Jetons en caisse à la fin | 201 | 83 | 157 |

- ✓ **Bâtir paie** : +21,2 points de cibles en paires, pour un bruit de ±4,6 ; à l'acte III, 16 points de chance au-dessus du témoin (224 paires).
- ✓ **Dur, mais ça explose** : 23 % des runs du bâtisseur (15 à 35).
- ✓ **Les séries sont le mur** : une run qui explose gagne la Coupe 24 fois sur 59.
- ✓ **La cote seule ne suffit plus** : le chiffre tient la cible de l'acte III 23 fois sur 100, et ne gagne aucune Coupe.
- ✓ **Plus d'un build gagne** : onze pièces mènent un banc qui tient ses trois cibles, la plus fréquente 26 fois sur 144. La première Coupe du bâtisseur, en médiane, à sa troisième run (22 % par run).
- ✗ **Les Coupes** : 14 sur 64, pour 4 à 12. Les séries devaient durcir encore un peu.
- ✗ **Les jetons servent** : le bâtisseur finit avec 201 jetons en caisse (moins de 40 visés). Il relance 3,4 fois par run : ce que les portes lui offrent vaut presque toujours plus qu'une signature moyenne.

**Le second juge, le même jour** (256 autres graines neuves, 3000 à 3255) : la relance plus fréquente (sous 40 points de cote au lieu de 22, trois par soir au lieu de deux) et leur coach quatre fois plus fort en séries. **Les cinq critères jugés sont verts.**

| | Le bâtisseur | Le témoin |
|---|---|---|
| Cibles tenues | **78 %** | 57 % |
| aux actes I, II, III | 75 · 85 · 73 % | 67 · 69 · 33 % |
| Chance aux actes I, II, III | 57 · 73 · 68 % | 50 · 58 · 44 % |
| Runs qui explosent | 32 % | 1 % |
| Coupes sur 256 | 40 | 1 |
| Jetons dépensés en relances · en caisse à la fin | 115 · 97 | 128 · 38 |

- ✓ **Bâtir paie** : +21,9 points de cibles en paires, pour un bruit de ±4,8 ; à l'acte III, 23,5 points de chance au-dessus du témoin.
- ✓ **Dur, mais ça explose** : 31,6 % des runs du bâtisseur (15 à 35).
- ✓ **Les Coupes** : 10 sur 64 (4 à 12) ; la première, en médiane, à la cinquième run.
- ✓ **Les séries sont le mur** : une run qui explose gagne la Coupe 29 fois sur 81.
- ✓ **Plus d'un build gagne** : dix pièces mènent un banc gagnant, la plus fréquente 20 fois sur 129.
- ✗ **Les jetons servent** : la relance en dépense 115 par run, il en reste 97 pour moins de 40 visés. Mieux que 201, pas encore la borne : le prix de la relance, ou un autre puits, se règle à la tranche 1.
- Relancer plus souvent n'a pas rendu le bâtisseur plus fort (73 % de cibles sur les graines d'essai, contre 71 %) : une relance jette une offre correcte pour en tirer une autre.
- **L'origine ne fait plus la décision** : seuls les signés comptant, une pièce d'origine ne mène que 2 bancs gagnants sur 144 au premier juge (L'époque, La franchise) et 2 sur 129 au second (Les modernes). Les badges font maintenant la décision et la variété. Les seuils d'origine sont à reposer, ou ces pièces à repenser.
- **Ce que cette mesure ne couvre toujours pas** : les robots n'achètent pas de pochette ; les pièces sont des pièces d'essai, sans la maîtrise du coach ; leur coach « quatre fois plus fort » tient lieu d'un banc de pièces, qui reste à écrire et à rejuger.

## 5. Les cas limites

- **Un signé blessé ou en civil compte toujours** : une marche ne retombe pas un soir par malchance. Elle ne retombe que si tu fais sortir un joueur qu'elle compte, et l'échange le dit avant.
- **Au camp, tous les comptes sont à zéro** : la pièce se choisit sur ce qu'elle compte.
- **Banc plein** : la pièce neuve d'abord, puis celle qui sort, comme aujourd'hui.
- **Monter une carte au vestiaire** monte ses badges : le compte d'une pièce de badge monte avec.
- **Les séries** : les mêmes pièces, les mêmes marches ; leur coach à la marche de sa ronde.
- **La run gardée d'avant la V29** : `VERSION_DE_LA_RUN` monte ; elle se rouvre avec son coach et ses joueurs (ses signés sont ceux que la run garde déjà), et chaque pièce d'avant devient la pièce de départ de sa philosophie (une pièce hors des voies part). Les clés de sauvegarde ne bougent pas — `check_sauvegardes`.
- **Hors ligne** : aucun fichier neuf dans la coquille ; `sw.js` oublie ce qui part — `check_coquille`.
- **Le clavier et la manette** : rien ne change ; relancer les portes est un bouton de la scène des portes.

## 6. Ce qu'il touche

**Les fichiers** : `js/pieces.js` (réécrit de zéro), `js/greffes.js` (le banc posé une fois par match), `js/run.js` (les deux choix du camp, les réglages de la difficulté, `VERSION_DE_LA_RUN`), `js/run-scenes.js` et `js/run-jeu.js` (le camp, le coin d'une carte à la porte, l'échange, le banc, le match, la fin de run), `js/impact.js` (les lignes d'une pièce, les plans du duel), `js/cartes.js` (la carte d'une pièce dit son compte), `style.css` (peu), `sw.js` (la version) ; `js/actes.js` (le prix d'une pièce, la récompense de l'élite) ; `scripts/lib/run_robot.mjs` (le robot qui lit devient le bâtisseur ; il achète une pochette, joue l'élite, relance les portes), `scripts/check_pouvoirs.mjs` (réécrit), `scripts/mesure_run.mjs` (les bornes, les jetons qui restent, la part des actes que le rival décide), `scripts/essai_run.mjs` (un parcours de bâtisseur), `scripts/check_moments_si.mjs`, `scripts/check_elites.mjs`, `scripts/check_duel.mjs`, `scripts/lib/duel.mjs`.

**Les règles fermes** (`.claude/rules/rogue.md`, réécrites à la tranche qui change le jeu) :

- **Défaites** par JP le 13 nov. : « une carte change la forme du match, pas sa force » **pour une pièce de banc** (elle tient pour une réponse d'histoire) ; « le banc remesuré » et ses bornes en victoires ; « la boule de neige est bloquée » **dans la run, pour le banc** (rien ne se garde toujours d'une run à l'autre) ; « tu peux exploser le jeu : 5 à 12 % ».
- **Défaites** par ce devis : « le relais », « pour le battre », l'ombre de leur coach ; « la porte ouverte montre les plus forts qui tiennent dans ton espace » (ceux de ton banc d'abord, tranché sur capture à la tranche 2).
- **À tenir, et que le premier jet ne tenait pas** : « un choix se dit en vraies stats de match » (l'effet d'une pièce en tirs et en buts) ; « palier reste un mot du code » ; « un cran d'exigence doit coûter » (remesuré quand les adversaires montent).
- **Tenues** : la run est une carte, la cible et les cœurs, toutes les années ensemble, les trois portes, le plafond qui mord, la difficulté par des clubs plus forts, la première Coupe pas avant la troisième run, le duel à un choix, l'élite, les médailles en variété, le cœur pur, une seule grammaire d'effet pour les histoires.
- `.claude/rules/moteur.md` : **tenue tout entière** (les canaux existants, le moteur n'importe rien du Rogue).
- `.claude/rules/vocabulaire.md` : **entrent** la marche, le compte, le signé ; **partent** le relais, le maillon, « pour le battre », l'ombre.

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
| Les marches d'une pièce | ≈ 12 · 37 · 75 % (l'essai) | la 3e entre 50 et 100 % | plus bas, bâtir ne paie plus (ligne 3) ; plus haut, qui ne lit rien gagne autant (ligne 4) |
| Les seuils d'une pièce | à poser à la tranche 0 bis, sur des signés seulement | la 1re marche atteinte à la fin de l'acte I par qui la vise | calés sur l'effectif de fin, le camp les allume par hasard (§ 10) |
| Le produit d'un canal | borné à ×3 pour toi, ÷3 pour eux | ×2,5 à ×4 | sans borne, cinq pièces sur tes tirs font ×15 |
| La maîtrise sur la pièce de départ | ×0,9 à ×1,3 sur ses marches | à mesurer | ×1,3 sur 75 % : ≈ 4,5 points de chance pris au loto du coach |
| *CASES_DU_BANC* | 5 | 5 | ne se règle pas (JP, 7 nov.) |
| Les pièces au camp | celle du coach et 2 choisies | 2 à 3 | une seule : ligne 2 |
| Le prix d'une relance des portes | 8, puis le double à chaque relance du soir (trois au plus) | à régler : 97 jetons restent en caisse | trop bas, le plafond ne mord plus : on cherche jusqu'à trouver ; mesuré, relancer plus ne rend pas plus fort |
| *PRIX_PIECE* | 32 aujourd'hui, à remesurer | — | posé pour une pièce bornée à 0,18 victoire par acte : un achat d'office |
| La récompense de l'élite | sa chance lue jusqu'à 80 % (55 % aujourd'hui) | — | sinon le club fort se sert : jamais sous 42 jetons |
| *ETAPES*, les étapes d'édition des adversaires | 1 · 3 · 12 · 12 (jugé à la tranche 0 bis ; 1 · 2 · 3 · 7 aujourd'hui) | l'acte III entre 10 et 12 | à 7, 58 % des runs explosent ; l'échelle des éditions plafonne à 12 |
| Le banc de leur coach, en séries | à l'essai, une pièce à la 2e, 3e, 3e marche, quatre fois plus forte | à écrire en vraies pièces et à rejuger | trois fois plus forte, 14 Coupes sur 64 ; deux fois, 13 sur 64 sur les graines d'essai avec sept Coupes pour dix explosions |
| Le poids du banc pour le robot | 3,3 points de cote par point de pourcentage | 2 à 5 | une mesure, jamais lue par le jeu |

## 9. Les critères d'acceptation

Trois robots, sur les mêmes graines : **le bâtisseur** ; **le témoin**, le même robot avec la même pièce prise et la même pièce qui sort, qui ne lit pas son banc aux portes (une seule différence) ; **le chiffre**. Les robots achètent une pochette, jouent l'élite et relancent les portes avant qu'une borne se juge. Une borne ne se juge qu'à la taille où elle ne tire pas à pile ou face.

- [x] **La porte 0, le test d'un jour** (13 et 14 nov.) : le simulateur porte les multiplicateurs — `mesure_build` (§ 4). Pas encore une preuve que bâtir paie (§ 10).
- [x] **La porte 0 bis, à la difficulté livrée** (14 nov., deux juges de 256 graines neuves chacun) : seuls les signés comptent, les seuils reposés, le témoin à une seule différence, leur coach en séries, la relance payée — `mesure_build`, cinq critères verts au second juge (bâtir paie à +21,9 points pour un bruit de ±4,8 ; 32 % de runs qui explosent ; 10 Coupes sur 64). Les jetons (97 en caisse) et les pièces d'origine restent ouverts, à leurs lignes.
- [ ] **Bâtir paie** : sur 256 graines, en paires, le bâtisseur tient plus de cibles que le témoin, au-delà de deux écarts-types — `mesure_run`.
- [ ] **Dur, mais ça explose, et les séries sont le mur** (JP, 14 nov.) : 15 à 35 % des runs du bâtisseur jouent l'acte III à 75 % de chance ou plus ; il gagne la Coupe 4 à 12 fois sur 64, jamais avant sa troisième run en médiane ; une run qui explose gagne la Coupe moins d'une fois sur deux ; « premier » gagne au plus 2 fois — `mesure_run` (256 graines).
- [ ] **La cote seule ne suffit plus** : le robot du chiffre tient la cible de l'acte III au plus une fois sur trois — `mesure_run`.
- [ ] **Plus d'un build gagne** : sur 256 graines, au moins cinq pièces différentes sont la plus forte d'un banc qui tient ses trois cibles, aucune dans plus de 40 % d'entre eux, dont une d'origine au moins ; chaque coach tient ses cibles à dix points de la moyenne (384 graines, à la main) — `mesure_run`.
- [ ] **Chaque pièce vit** : dans les runs du bâtisseur qui la portent, chaque pièce atteint sa première marche plus d'une fois sur deux et sa deuxième dans 10 à 60 % (256 graines) — `mesure_run`.
- [ ] **Chaque pièce joue ce qu'elle dit** : en paires contre un banc vide, le moteur reçoit exactement le facteur de sa marche, rien sous son premier seuil, le produit d'un canal sous sa borne, et la pièce se voit dans la feuille — `check_pouvoirs` (réécrit).
- [ ] **Les jetons servent** : une run du bâtisseur finit avec moins de 40 jetons en caisse (106 aujourd'hui) — `mesure_run`.
- [ ] **Un cran coûte encore** : la part des cibles tenues baisse d'un cran d'exigence au suivant — `CRANS=1 GRAINES=128 mesure_run`, à la tranche 1.
- [ ] **La run** : trois pièces avant la première porte ; la même graine rejoue la même run ; une run gardée d'avant se rouvre — `check_run`, `check_sauvegardes`.
- [ ] **Les scènes** : le camp, la porte, l'échange et le banc tiennent à 390 × 844 sans défiler, le pire cas semé (cinq pièces touchées par un échange) ; une semaine de bâtisseur (une autre porte, un autre joueur, un autre sortant) en neuf touchers — `check_scene`, `essai_run`.
- [ ] **Le moteur ne bouge pas** : le 82-0 se rejoue au but près — `check_empreinte`, `check_couches`.
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées — `check_refonte`.
- [ ] Rien de mort — `check_mort`.
- [ ] À juger par JP à l'essai : une porte donne envie de l'ouvrir pour ce que ton banc compte ; une marche qui s'allume se sent ; perdre fait dire « j'aurais dû ».

## Les tranches

**0. Le test d'un jour** (fait, 13 et 14 nov.). `scripts/mesure_build.mjs` : les pièces d'essai dans la table le temps de la mesure, le bâtisseur contre le témoin. *Le joueur ne voit rien.*

**0 bis. La mesure à la difficulté livrée** (avant qu'une ligne du jeu parte). `scripts/mesure_build.mjs` repris : seuls les signés comptent, les seuils reposés, le témoin propre (une seule différence), leur coach qui compte ses joueurs à la marche de sa ronde, la relance des portes payée, l'acte III et les séries montés, 256 graines neuves. *Le joueur ne voit rien.* Juge : la porte 0 bis. Rouge, on règle les pièces et les seuils ici, pas dans le jeu.

**1. Le banc qui compte.** `js/pieces.js` réécrit, le banc posé une fois par match, les deux choix du camp (par la scène de la pièce offerte), la relance des portes payée, le robot bâtisseur, la difficulté de la tranche 0 bis, `check_pouvoirs` réécrit, le § 7 parti. Les scènes d'aujourd'hui montrent les pièces neuves sans changer de plan. Juge : `mesure_run`, `check_pouvoirs`, `check_run`, `check_refonte`, `check_scene`, `essai_run`.

**2. Lire son banc à l'écran.** La porte fermée qui dit ce qu'elle nourrit, la porte ouverte triée (sur capture, JP tranche), le coin d'une carte, la sortie proposée et le banc avant et après à l'échange, le moment où une marche s'allume, la scène du Banc avec ses comptes et ses marches, le match et l'après-match, la fin de run. Juge : `check_scene`, `essai_run`, JP à l'essai.

**3. Du contenu, et ce qui reste nommé.** Des pièces de plus dans les deux sortes, une à la fois, chacune mesurée ; le rival, remesuré, et sa question reposée à JP ; le plan du duel ; la pochette Époque.

## 10. La revue du 14 nov. 2026 — « À reprendre »

`/revue-design`, quatre relecteurs en adversaires (`rogue-equilibre`, `rogue-design`, `rogue-ux`, `rogue-economie`). Ce qu'ils ont trouvé, et où le devis le reprend :

| Ce qui cassait | Repris |
|---|---|
| La mesure n'était pas une preuve : un témoin à trois différences, les mêmes 48 graines, sans leur coach, sans la difficulté livrée | § 4, § 9, la tranche 0 bis |
| Les bouche-trous comptaient ; les seuils calés sur l'effectif de fin | JP : seuls tes signés (§ 3.1, § 8) |
| Le chemin au moteur : sous les bornes de style, +75 % devenait +35 % ; aucun plafond au produit d'un canal | § 3.1, § 8, `check_pouvoirs` |
| L'échange proposait de sortir le joueur que le banc compte ; la porte triait par cote, cinq par page | § 3.3 |
| « La Coupe 4 à 12 » contre « une run sur quatre explose » ; trois critères à pile ou face à 64 graines | JP : les séries sont le mur (§ 3.5) ; 256 graines (§ 9) |
| Les jetons sans emploi après l'acte I ; la pièce à 32, un achat d'office ; l'élite qui paie le club fort | JP : relancer les portes (§ 3.3) ; § 8 |
| Le robot ne joue ni pochette ni élite : la difficulté se serait réglée sur un aveugle | § 9 |
| Le rival à pile ou face, la feuille à un bouton, le plan du duel : aucun mot | § 3.7 ; JP : on remesure après le banc |
| « Paliers » et « −27 % » à l'écran ; deux pièces au nom d'un accord | § 3.1 |
| La marche sans écran ; le camp qui disait « L'élite est battue » ; l'échange qui déborde | § 3.2, § 3.4, § 9 |
| La maîtrise et le blessé jamais mesurés | § 8 ; § 5 (un signé blessé compte toujours) |

## Ce qui a été écarté

- **Le soir se joue** (un geste par période) et **le match devient un calcul** (plus de simulateur) : les deux autres règles à défaire, écartées par JP le 13 nov.
- **Des pièces en ligne droite** (tant par palier) : mesuré, bâtir ne paie pas (§ 4, ligne 1).
- **Le banc qui se découvre en route** : mesuré, la direction arrive trop tard (ligne 2).
- **Des pièces 2,5 fois plus fortes** : le robot qui ne lit rien gagne autant (ligne 4).
- **L'origine seule** ou **les badges seuls** : JP prend les deux (14 nov.).
- **Tout ton effectif** ou **tes habillés** comptés : les bouche-trous allumaient des marches au camp par hasard, et un blessé en faisait retomber une. JP : seulement tes signés.
- **La Coupe qui monte** avec l'explosion, ou **moins d'explosions** : JP garde les deux bornes, les séries font le mur.
- **Couper les jetons de moitié** : JP préfère qu'ils relancent les portes.
- **Le rival en 2 de 3**, ou **qui ne compte plus double** : pas maintenant ; on remesure après le banc.
- **Régler une constante dans la structure d'aujourd'hui** (le rachat, les portes, les étapes) : essayé du 10 au 12 nov., l'écart entre lire et ne pas lire restait sous le bruit de 64 graines.
