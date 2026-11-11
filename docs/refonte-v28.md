# V28 — Le Rogue, de zéro : un vrai jeu, mécanique et écrans ensemble

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 9 nov. 2026. **JP l'a tranché le même jour (§ 11)** :
- **la boucle**, oui ;
- **le simulateur calibré est gardé**, pas de moteur neuf ;
- **l'allure C partout** : la carte de la saison et des écrans illustrés, sans pixel art ;
- **l'ancien Rogue est gelé**, puis supprimé.

Ce texte applique ces décisions. Les maquettes de départ sont dans docs/maquettes/v28.html. Les écrans complets de la direction C sont dans docs/maquettes/v28-ecrans.html (la tranche 1, 10 nov.) ; JP tranche dessus. **Rien n'est codé.**

## En une page

**Le constat.** Le Rogue d'aujourd'hui, c'est deux choses qui se tiennent l'une l'autre :

- **Une saison de 82 soirs.** Le simulateur joue chaque soir d'un trait, l'écran le relit, et on avance d'un toucher par jour.
- **Un site web par-dessus.** Un en-tête, cinq onglets, des pages qui défilent, une boîte de réception, et « Jour suivant » touché 186 fois.

Vingt refontes ont changé l'une sans l'autre. Une saison de 82 soirs ne peut que se feuilleter en pages. Des pages ne peuvent montrer qu'une saison qu'on feuillette.

**Le jeu neuf est la boucle d'un roguelike, et chaque règle a son écran.**

1. **La carte de l'acte**, comme Slay the Spire : un chemin avec des embranchements. Les cases sont des matchs contre de vrais clubs (leur jeu se lit sur la case), une élite, le marché, le vestiaire, une histoire, et le rival au bout. **Choisir son chemin, c'est choisir qui on affronte et quand.**
2. **La feuille du soir.** Tu vois leurs lignes et ta chance de gagner. Tu règles tes lignes, ton gardien et qui reste en civil. Contre le rival ou une élite, tu choisis aussi ton plan (le duel de la V27).
3. **Le match.** Le simulateur calibré le joue, comme aujourd'hui. L'écran montre ses temps forts sur une glace illustrée, en 30 à 60 secondes, et tes pièces de banc s'allument quand elles jouent. On peut aller à la fin d'un toucher.
4. **Les trois portes.** Après chaque match, le dépisteur ouvre trois vrais vestiaires, dont toujours le club que tu viens d'affronter. Tu en signes un joueur sous le plafond. **Ton club est ton deck.**
5. **Retour à la carte.** Trois actes, chacun avec sa cible en points, puis les séries. Deux cœurs.

**Ce qui reste :**
- les vrais joueurs et leurs cotes, et le simulateur calibré ;
- les cartes telles quelles, les vrais vestiaires, les rôles et les accords, le plafond ;
- le banc de cinq et ses pièces, le duel à un choix, le rival, l'élite, deux cœurs ;
- les pochettes, ton cartable, les médailles ;
- le 82-0, Sur table et l'exhibition, qui ne bougent pas.

**Ce qui part :**
- la saison au jour le jour, la vraie cédule et le calendrier placé ;
- le Bureau, sa boîte et ses cinq portes ;
- le plateau à bandeaux.

## 1. Ce que JP a dit

JP, 9 nov. 2026 :

- *Tu travailles beaucoup sur le jeu, mais tu gardes tellement les anciennes mécaniques que tu bâtis sur ce qui marche pas au lieu de vraiment repartir comme il faut à chaque fois. Donne-moi un vrai plan clair qui en fait un roguelike complet, complexe pis le fun, pas juste un roguelike coat of paint sur un jeu qui marche pas.*
- *Je parle de l'interface. J'hais l'interface. On dirait pas un vrai jeu.*
- *Ben interface et mécanique, pour un roguelike, c'est genre super intimement lié, un change l'autre.*
- Ses réponses aux quatre questions : la boucle, **oui** ; un moteur de match neuf, **non, garder le simulateur** ; l'allure, **C partout** ; l'ancien Rogue, **gelé puis supprimé**.

Le même reproche, depuis un mois :

- *Le jeu se joue tout seul, je n'ai pas beaucoup d'impact* (7 oct.).
- *Le Rogue est brain dead* (16 oct.).
- *You didn't really redo the system […] le système actuel marche pas* (29 oct.).
- *you feel sports broadcast, neither the game itself* (3 nov.).
- *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne le même* (4 nov.).

Ce qu'il veut :

- *Le but du jeu, ça devrait être de trouver les meilleures combinaisons* (10 oct.).
- *ni les cartes, ni les packs, ni comment optimiser les équipes n'est aussi réussi qu'un FUT ou un HUT* (10 oct.).
- *pas facile, mais tu peux exploser le jeu* (8 oct.).
- *à la Balatro, Slay the Spire, Pokémon TCG* ; *facile à prendre en main, dur à maîtriser* (2 nov.).
- *calendrier réel pour toutes les équipes, mais tu choisis les équipes qui vont quand pour avoir duels plus tough aux bons endroits* (7 nov.).
- *il faut vraiment bloquer le snowball* (7 nov.).

Ce qu'il a refusé :

- *je comprends pas le contre* (10 oct.) ;
- *je veux plus ce système de matching* (24 oct.) ;
- *les cartes, c'est pas fun* (20 oct., les cartes de tactique au match) ;
- *Les pourcentages, ça me dit fuck all* (4 oct.).

Ce qu'il garde :

- *garder les cartes actuelles du jeu, pas les refondre* (4 nov.) ;
- *faut des logos, et garder anciens looks des cartes de joueurs* (7 nov.) ;
- le moteur calibré (9 nov., question 2).

**La taille est décidée** : le Rogue refait, sa boucle et ses écrans. Ce devis ne la négocie pas à la baisse.

## 2. Pourquoi vingt refontes sont retombées sur le même jeu

**Une saison de 82 soirs ne peut que se feuilleter.** Chaque devis gardait la ligue au jour le jour (V27, § 4.1) et la charpente de site (les cinq portes, la boîte). Sur cette forme, chaque système de décision est mort de la même mesure :

| Le système | Ce qu'il pesait |
|---|---|
| Les événements (V3) | 0,03 victoire |
| La main du duel (V13) | « un bonus sans décision » |
| Les systèmes de ligne (V18) | « dans le bruit » |
| Le choix de pochette | 0 victoire |
| Le plan du soir (V27) | « dominé » |
| L'adjoint aux entractes (V27) | 0,5 victoire pour 40 % du temps de jeu |
| Le calendrier placé (V27) | « à peu près zéro » |

Chaque refonte d'écran, elle, repeignait la même charpente.

**Pourquoi c'était lié** : 82 soirs presque pareils se feuillettent en pages, et la seule action qui reste est « Jour suivant ».

**Un roguelike fait l'inverse** :
- peu de rencontres, chacune choisie sur une carte ;
- avant chacune, une lecture de l'adversaire ;
- après chacune, une récompense qu'on choisit.

**Les habitudes qui ramenaient l'ancien jeu** :
- le succès mesuré en victoires de robot sur 82 matchs, jamais en plaisir de jouer ;
- des bornes posées pour une saison de 82 soirs ;
- une cinquantaine de juges qui encodent cette saison et ses pages (`check_plateau` refuse une page qui n'est pas le plateau).

**Ce qui ne change pas : le moteur des matchs.** JP le garde (9 nov.). La V28 change ce que le simulateur joue et quand : dix-huit matchs choisis au lieu de 82 soirs, et une ligue qui ne tourne plus en coulisse. Elle ne change pas comment il joue.

## 3. Ce que le joueur ressent

**Le fantasme** : « je pars avec des bouche-trous et un coach. Acte après acte, je choisis mon chemin, je lis le club d'en face, je règle mes lignes, je regarde les temps forts, et je pige dans de vrais vestiaires pour monter un club qui s'emboîte. La Coupe ou dehors. »

- **Les pics** :
  - la porte qui cache la carte qu'il te fallait ;
  - le chemin qui évite le gros club ou qui va le chercher pour sa récompense ;
  - le rival, un écran de combat, battu parce que ton club était bâti pour lui ;
  - la run où tout multiplie.
- **Le creux qui fait mal** : la cible ratée d'un point.
- **Pas de jour ordinaire** : chaque case de la carte demande quelque chose.
- **Les boucles** :
  - le match : une à deux minutes, la feuille et les temps forts ;
  - la case : deux à quatre minutes, avec les portes et les Lignes ;
  - l'acte : vingt minutes, sept cases et le rival ;
  - la run : une heure à une heure et demie ;
  - la carrière : la variété débloquée et les exigences.

## 4. Les règles et les écrans

Chaque règle a son écran. Chaque écran est une scène plein écran qui ne défile jamais, à 390 × 844, dans la direction C.

### 4.1 La coquille

- **Rien de ce qui fait un site** : pas d'en-tête de site, pas de barre d'onglets, pas de sous-onglets, pas de boîte de réception.
- **Le HUD**, en haut de chaque scène : tes cœurs dessinés, tes jetons, l'acte, tes points sur la cible (« 5 / 8 »).
- **Le menu pause** (un coin, Échap ou Start) : tes joueurs, l'album, le palmarès, les règles, quitter.
- **Une info, une maison** :
  - la cible et les cœurs vont au HUD ;
  - les jambes et les blessés, sur tes cartes ;
  - le jeu d'un adversaire, sur sa case ;
  - ta chance de gagner, sur la feuille du soir.

### 4.2 La run

- **Le départ.** Ton coach, un parmi trois (le loto d'aujourd'hui). Tes 23 bouche-trous. Puis **le camp** : trois fois trois portes avant la première case, donc trois joueurs signés. Ta run a un visage dès la première minute.
- **Trois actes.** Chacun est une carte de sept cases jusqu'au rival : cinq matchs (ou élites) et deux arrêts (le marché, le vestiaire, une histoire), sur des chemins qui se croisent.
- **La cible.** À la fin de l'acte, tes points de l'acte doivent atteindre *CIBLES* (7, 8, 9 sur 14). On compte 2 la victoire et 1 la défaite en prolongation ; le rival compte double.
  - Cible ratée à l'acte I ou II : −1 cœur.
  - Cible ratée à l'acte III : pas de séries, la run finit.
  - **2 cœurs** (JP, 7 nov.), jamais regagnés.
- **Les séries.** Trois rondes en 3 de 5 contre des clubs du haut, jouées par le simulateur comme aujourd'hui (`creerSeries`, `jouerMatchSeries`). Une série perdue coûte un cœur et se rejoue une fois contre le même club ; sans cœur, la run finit.
- **Une run perdue** rend ses médailles. Le cartable garde chaque carte vue.

### 4.3 La carte de l'acte (l'écran d'accueil)

- Le chemin se lit de bas en haut.
- **Chaque case de match montre** l'écusson et la saison du club, son jeu en un mot (des tireurs, des durs, un gros gardien), ce qu'il paie, et le renfort d'une case plus loin. Le jeu se lit dans ses vraies stats, comme `jeuDuRival` le fait aujourd'hui pour le rival.
- **Les cases** :
  - **match** : un vrai club, de force dans la bande de l'acte. Plus loin sur le chemin, des clubs plus forts.
  - **élite** ◆ : un club du haut. Gagnée, elle paie une pièce de banc et des jetons, selon la formule d'aujourd'hui (`recompenseDeLElite`). Perdue, ses sonnés et la moitié des jetons, jamais un cœur (JP, 9 nov.).
  - **marché** : les pochettes et une pièce parmi trois. Il remplace la boutique à ses nœuds.
  - **vestiaire** : soigner tes blessés et remettre tes jambes à neuf, ou monter une carte d'une édition. Un seul des deux, comme le feu de camp de Slay the Spire.
  - **histoire** : une voix du club, un fait vrai de tes matchs, deux réponses.
  - **le rival** : au sommet, annoncé dès l'ouverture de la carte avec son jeu, son intention dominante et « Pour le battre » (la V27). Son écran est un écran de combat.
- On touche une case du rang suivant et sa scène s'ouvre. Le chemin pris reste dessiné.

### 4.4 La feuille du soir (avant chaque match)

- **Ce que tu vois** :
  - leurs quatre trios et leurs paires, leur vedette en carte, leur gardien ;
  - leur jeu ;
  - **ta chance de gagner** (`pronostic`, js/pronostic.js), en jauge aux couleurs des deux clubs. C'est le seul endroit du jeu où elle se montre.
- **Ce que tu fais** :
  - tes lignes, qui ouvrent les Lignes : l'ordre de tes trios, tes paires, tes unités spéciales ;
  - **ton gardien** ;
  - **qui reste en civil** (les blessés et les vidés sont marqués).

  La jauge bouge pendant que tu places.
- **Contre le rival ou une élite**, en plus : **ton plan**, un parmi deux ou trois que ton banc propose, ou « Ton match ». C'est le duel à un choix de la V27 (`plansDuDuel`), tel quel.
- **L'ordre des trios n'est pas un choix (mesuré, tranche 0).** Sur 24 paires de vrais clubs, l'ordre que le simulateur donne par défaut (`autoRoster`) est déjà le meilleur : le meilleur des 24 ordres ne fait que +0,6 point de chance, sur des dés tenus à l'écart. Un mauvais ordre coûte 23 points. La feuille du soir ne propose donc pas de ranger ses trios ; elle montre tes lignes, ton gardien, qui reste en civil, et le plan contre le rival ou une élite.

### 4.5 Le match

- **Le simulateur calibré le joue** (`playGame`, `jouerEnPeriodes`, les greffes du Rogue), comme un match de la ligue aujourd'hui, mais seul : les deux clubs, ce soir.
  - Ton banc joue par ses conditions, comme à la V27.
  - Les jambes, les blessures et l'élan passent d'un match à l'autre ; un jour de repos sépare deux cases.
- **L'écran montre ses temps forts** sur une glace illustrée de la direction C : chaque but, les gros arrêts, les punitions, avec leurs vrais tireurs et leur minute (les événements que js/direct.js lit déjà), en 30 à 60 secondes.
  - Le tableau donne le pointage, la période et les tirs des deux clubs.
  - Sous la glace, ton banc : une pièce qui joue s'allume avec son chiffre.
  - On peut aller à la fin d'un toucher.
- **Aucune décision pendant le match** (JP, V27 : *aucune décision d'entracte*). L'entracte dure une seconde et demie.
- **Après le match** : le pointage, ce qui a joué (`bancDuSoirHtml`, refait dans la scène), ce que ça rapporte. Puis les portes.

### 4.6 Les trois portes (après chaque match)

- **Trois vrais vestiaires** : l'écusson, la saison, et combien de joueurs tiennent dans ton espace.
  - **L'une est toujours le club que tu viens d'affronter** (« je joue les Islanders 1982 pour Bossy »). La carte devient ainsi un choix de bâtisseur.
  - **Gagné**, les portes viennent d'une bande plus haute. **Perdu**, la même bande, plus **une relance**. Pas de boule de neige.
- **La porte ouverte** montre en cartes, trois de front, ceux qui tiennent dans ton espace. Le coin de chaque carte dit l'accord qu'il allumerait. Les autres sont pliés.
- **Signer** se fait par l'échange d'aujourd'hui (`choisirQuiSort`) : l'arrivant face à celui qui sort, le plafond.
- **Le plafond mord** (JP, 10 nov. 2026, sur la tranche 0) : celui qui sort ne libère que **la moitié de son salaire** ; l'autre moitié reste au plafond pour la run, comme un rachat. Chaque signature devient un arbitrage entre la cote et l'espace qu'elle prend. Ce que ça change se dit en vraies stats de match (`statsDe`, js/impact.js : les tirs, le % au tir), jamais en pourcentage de victoire.
  - Celui qui sort va au cartable.
  - Passer rapporte des jetons.
  - Aucun joueur ne revient deux fois dans la run.

### 4.7 Ton club, le coach, le banc

- **Ton club** : 23 joueurs sous le plafond, aux rôles, badges et accords qui jouent dans le simulateur comme aujourd'hui (`AFFINITES`, les badges, la chimie).
  - « Aligner au mieux » quitte le Rogue : les Lignes sont le casse-tête.
  - Pendant qu'une carte est tenue, chaque case dit l'accord qu'elle allumerait.
- **Ton coach** (la V27) : sa philosophie, sa règle (des jetons le soir où ton club joue son hockey), sa maîtrise et sa pièce de départ.
- **Le banc de cinq** (la V27) : les pièces (`PIECES`, js/pieces.js), leurs conditions, leur relais. Elles viennent du rival battu, de l'élite gagnée et du marché. Leurs bornes ont été posées pour un acte de 27 soirs ; remesurées sur un acte de six matchs à la tranche 4 (docs/refonte-v28-4.md).
- **Le soir se dit au moteur** (tranche 4) : la run n'a pas de cédule, elle pose le temps du match ce que les pièces attendent — le rival, le jeu de l'adversaire (son style, un seul : le mot de sa case), ta suite, ta bête noire, l'infirmerie, leur coach en séries. **Trois matchs en trois soirs** : les deuxième et troisième rangs de chaque acte se jouent sans jour de repos, ce sont ses dos-à-dos ; en séries, un jour de repos tous les deux matchs.
- **Toutes les années ensemble** (JP, 11 nov. 2026 : *Je veux garder l'aspect toutes les années ensemble*) : les portes, les affiches, les rivaux et les séries d'une run se tirent de chaque saison des données, les Canadiens de 1976-77 à côté du Lightning de 2019-20. « Une époque par run » (la run tirait une décennie), essayée aux tranches 2 et 3, est défaite.

### 4.8 L'économie

- **Les jetons**, gagnés aux matchs (plus pour un club difficile), à la règle du coach, en passant une porte, à l'élite. On les dépense au marché ; ceux qui restent en fin de run sont perdus. Les montants se fixent à la tranche 0 sur dix-huit matchs au lieu de 82.
- **Le plafond** est l'autre monnaie, la plus dure : la vedette d'une porte coûte l'espace de deux bons joueurs.
- **Les médailles**, entre les runs, servent à la variété seulement (des coachs, des pièces, des pochettes, des époques). Les exigences montent la difficulté après une Coupe : la cible, la bande des clubs, le plafond, une porte de moins.

### 4.9 Les écrans, direction C

- **Les scènes** :
  - la carte de l'acte ;
  - la feuille du soir, et le plan contre le rival ou une élite ;
  - le match en temps forts ;
  - l'après-match ;
  - les trois portes, la porte ouverte et l'échange ;
  - le marché et la pochette (sa pile et sa carte rare restent) ;
  - le vestiaire ;
  - l'histoire ;
  - le rival en écran de combat ;
  - la fin d'acte ;
  - les séries ;
  - la fin de run ;
  - le menu pause et ses pages.
- **La direction C** (JP, 9 nov.) : la carte de la saison, comme Slay the Spire, et des écrans illustrés sans pixel art. Elle part des maquettes C1 (la carte) et C2 (le rival). Les autres scènes se dessinent à la tranche 1, dans la même langue : le ciel de nuit, les chemins, les écussons en jetons, Barlow Condensed, de gros boutons francs.
- **Les cartes** de joueurs et de jeu passent telles quelles.
- **Une semaine gagnée** (la case, la feuille, le match, les portes, l'échange, la carte) tient en **neuf touchers** au plus, aucun sans décision.

## 5. Les chiffres

**Le moteur** ne bouge pas : `VERSION_MOTEUR` reste, le 82-0 se rejoue au but près.

**La run** :
- *MATCHS_PAR_ACTE* 5, plus le rival ; *ARRETS_PAR_ACTE* 2 ;
- *CIBLES* 7 · 8 · 9 sur 14 ; *COEURS* 2 ;
- les séries en 3 de 5, rachetées une fois par cœur ;
- *PORTES* 3, une relance par défaite ; *CASES_DU_BANC* 5.

**Ce qu'un brouillon a calculé** pour la cible (le calcul tient sur n'importe quel moteur ; les parts de victoires sont des exemples) :

| Le club gagne, acte par acte | En séries, par match | La Coupe, avec le rachat | Sans le rachat |
|---|---|---|---|
| 50 · 50 · 50 % | 45 % | 5 % | 1 % |
| 55 · 60 · 60 % | 50 % | 15 % | 5 % |
| 60 · 65 · 65 % | 55 % | 29 % | 10 % |

À force égale, un acte de six matchs tient à ≈ 80 % des dés. Le build doit donc creuser l'écart, et la tranche 0 mesure qu'il le fait.

**Ce que la tranche 0 a mesuré** (10 nov. 2026, `scripts/mesure_run.mjs`, le simulateur, de vrais clubs, 64 graines, les mêmes dés pour chaque robot). Les robots :
- « premier » prend la première carte ;
- le robot **du chiffre** prend la meilleure cote ;
- le robot **malin** prend la cote au prix de l'espace qu'elle prend sous le plafond, et l'affiche haute quand son club est aussi fort.

| Réglage | Signatures par run | Malin | Chiffre | Premier |
|---|---|---|---|---|
| Des portes après chaque match, le salaire de celui qui sort libéré | ≈ 21 | 27 Coupes | 27 | 11 |
| Après les matchs 2 et 4 et le rival | ≈ 12 | 19 | 21 | 7 |
| Après le rival seulement | 6 | 13 | 12 | 4 |
| **Après chaque match, la moitié du salaire de celui qui sort reste au plafond** (`RACHAT` 0,5) | ≈ 21 | **31** | 14 | 8 |

- **Une signature vaut ≈ +2 points de chance** sur un match, rejouée sur d'autres dés. C'est l'accumulation qui pèse : la force du club passe de 160 à ≈ 189.
- **Essayer au moteur ne lit rien** : à 200 matchs d'essai par candidat, le robot qui essaie choisit du bruit (+9 points au choix, −0,3 rejoués sur d'autres dés), et sa run s'effondre (0 Coupe).
- **Lire au-delà de la cote ne paie que si le plafond mord.**
  - Quand celui qui sort libère tout son salaire, les bouche-trous surpayés du départ laissent de l'espace à chaque échange, et le malin fait comme le robot du chiffre.
  - Quand la moitié reste au plafond, le malin gagne **31 Coupes contre 14**.
  - Le plafond est le levier que le simulateur récompense.
- **Trop facile partout** : la cible est de 4 à 12 Coupes pour celui qui joue bien, 2 au plus pour « premier ». Les bandes de force, les cibles et les séries se règlent ensuite, sur le réglage gardé.
- **Un piège de mesure, corrigé** : `createTeam` tire la chance de saison de chaque club ; un match isolé la remet à zéro, comme l'exhibition. Sans ça, deux effectifs identiques ne jouaient pas le même match sous les mêmes dés.

**Le réglage retenu** (JP, 10 nov. 2026 : le plafond qui mord ; la difficulté par des clubs plus forts). La moitié du salaire de celui qui sort reste au plafond (`RACHAT` 0,5). Les adversaires sont plus forts, les portes ne bougent pas :
- les affiches, les rivaux et les séries montent de 0,25 en rang centile parmi tous les clubs (`DECALAGE`) ;
- ils portent 0, 1 et 2 étapes d'édition aux actes I, II et III, et 4 en séries (`ETAPES`, `habillerLaLigue`).

Sur 128 graines (deux jeux de 64), les mêmes dés :

| | Malin | Chiffre | Premier |
|---|---|---|---|
| Coupes, premier jeu de 64 | 10 | 5 | 1 |
| Coupes, second jeu de 64 | 12 | 9 | 1 |
| Cibles tenues (les deux jeux) | 64 % | 60,5 % | 38 % |

- **La difficulté tient** : celui qui joue bien gagne 10 à 12 Coupes sur 64 (cible : 4 à 12), « premier » 1 (cible : 2 au plus).
- **Gérer son plafond paie, mais peu** : 22 Coupes contre 14 sur 128 graines, et 3,5 points de cibles tenues (le critère en demandait 5).
- **Ce qui reste à mesurer** : les robots ne jouent encore ni le banc, ni les élites, ni les histoires, ni le marché. Le reste de ce que le joueur lit vit là ; la tranche 3 le mesure sur la run entière.

**Réglé de nouveau aux tranches 2 et 3** (11 nov. 2026, docs/refonte-v28-2.md) : le cœur neuf (`js/run.js`) joue le vrai moteur d'un match à l'autre, le banc, les élites, les histoires et le marché compris, et la run était redevenue trop facile.
- **Le salaire de la run** : le rang du salaire d'un joueur dans sa saison, reporté sur l'échelle d'aujourd'hui (`prixDe`, `ECHELLE`) ; le départ à 91,5 M$ sous un plafond de 95,5 M$ dans chaque décennie.
- **Toutes les années ensemble** (JP, 11 nov.) : le monde d'une run couvre les 55 saisons finies des données (1 366 clubs). La run d'une seule décennie à vrais contrats (1990 à 2020), essayée d'abord, est défaite : le salaire de la run, lu sur une seule échelle, suffit à mêler les époques.
- **`ETAPES` 1 · 2 · 3 · 7** ; `RACHAT` 0,5 et `DECALAGE` 0,25 tenus.
- Sur 128 graines, toutes les années ensemble : le malin 14 Coupes (7 sur 64), le chiffre 11, « premier » 0 ; les cibles tenues 61 %, 53 % et 29 % ; la première Coupe du malin à sa sixième run en médiane.
- **Réglé à la tranche 4** (11 nov., docs/refonte-v28-4.md) : le banc branché (les moments posés par la run), trois matchs en trois soirs, cinq pièces réglées. Sur 64 graines : le malin 5 Coupes, le chiffre 8, « premier » 0 ; les cibles tenues 58 %, 57 % et 30 %. **Lire paie à l'acte I (67 % contre 53 %), pas sur la run** : l'écart en Coupes entre le malin et le chiffre est sous le bruit de 64 graines (±6), quelle que soit la façon de lire essayée ; passé le camp, le plafond ne force plus à renoncer. Ouvert, avec le point suivant.
- **Ouvert : *tu peux exploser le jeu*.** À la tranche 4 : 4 runs du malin sur 64 (6 %) jouent l'acte III à 75 % de chance moyenne ou plus. Aux tranches 2 et 3 : 8 runs sur 128 (6 %) ; le critère en demande une sur dix. Essayé sans y arriver : l'acte III à 2 étapes d'édition (6 %), des portes plus hautes après une affiche haute gagnée (7 à 8 %), un robot qui monte une carte au vestiaire (5 %). Sous le plafond qui mord, la force d'un club plafonne ; il faut un levier de plus, à trancher par JP (docs/decisions.md).

**Ce que la tranche 0 mesurait au départ** (la question posée, gardée) :
- ce que vaut une signature de porte, en points de chance sur un match ;
- ce que vaut l'ordre des trios contre leurs lignes ;
- ce que vaut le plan contre le rival ;
- ce que vaut le banc de cinq sur six matchs ;
- les cibles qui donnent 4 à 12 Coupes sur 64 au robot qui lit.

## 6. Les cas limites

- **La vieille partie.** Une run en cours de l'ancien Rogue ne se rejoue pas (JP : gelé puis supprimé). Un écran dit ce qui est versé : ses médailles, le prix des déblocages qui partent. Puis une run neuve commence. Les clés de sauvegarde ne bougent pas ; le cartable, les médailles et ton club restent — `check_sauvegardes`.
- **Une porte sans personne dans ton espace** : elle le dit avant qu'on l'ouvre ; passer paie toujours.
- **Un blessé** : la réserve du même poste monte. Sans réserve, un remplaçant de la ligue, comme aujourd'hui (`remplacants`). Le vestiaire de la carte le soigne.
- **Quitter en plein match** : on reprend à la feuille du soir. La graine rejoue le même match.
- **Une carte sans élite ou sans marché sur un chemin** : chaque carte en a au moins un de chaque, sur des chemins différents.
- **Les histoires sans ligue** : les faits ne lisent plus que tes matchs joués de la run, jamais un classement de la ligue.
- **L'écran** : la scène se centre à 390 × 844 au plus.
- **Le clavier et la manette** : A joue, B revient, Start ouvre le menu pause.
- **`prefers-reduced-motion`** : les temps forts deviennent une liste fixe ; le DOM porte le vrai pointage.
- **Hors ligne** : `sw.js` liste les modules neufs et oublie les partis — `check_coquille`.

## 7. Ce qu'il touche

**Les fichiers neufs**, au préfixe *run-* dans js/ : la carte et la run, la feuille du soir, les portes, la coquille (le HUD, le menu pause) et ses scènes. Aucun n'importe un module nommé au § 8 — *check_neuf* le refuse.

**Les fichiers qui changent** :
- `js/saison.js` : le jour à jour du Rogue en sort ; les séries et le 82-0 restent ;
- `js/game.js`, `js/menu.js`, `js/alignement.js`, `js/gerant.js`, `js/impact.js`, `js/rogue.js` (la méta reste, la run part), `js/histoires.js`, `js/faits.js` (sans ligue), `js/direct.js` (les temps forts en scène) ;
- `index.html`, `style.css`, `sw.js`.

**Les règles fermes** :
- `.claude/rules/rogue.md` : réécrite à la tranche 4.
  - **Partent** : la run en actes sur la cédule, le calendrier placé, la boutique à ses nœuds, l'élite du lundi.
  - **Restent** : le banc de cinq, le duel à un choix, le rival et son jeu, l'élite sans cœur, la boule de neige bloquée, la première Coupe pas avant la troisième run.
- `.claude/rules/interface.md`.
  - **Défaites** : « cinq portes », « Le Rogue est le plateau », « Le contenu des pages », « À faire » (la boîte), « Ta plaque ».
  - **Tenues** : la carte au format carte de hockey, mobile d'abord, le jus en trois paliers, les vraies stats, les vraies couleurs.
  - **Réécrite** : « une maison par sujet », qui devient « le HUD, les cartes, le menu pause ».
- `.claude/rules/moteur.md` : **tenue tout entière** (JP : le simulateur reste). Le Rogue y joue des matchs isolés au lieu d'une ligue au jour le jour ; le crochet `placer` de `creerLigue` devient inutile.
- `.claude/rules/vocabulaire.md`.
  - **Entrent** : carte de l'acte, case, feuille du soir, porte, temps forts, cible, HUD, menu pause.
  - **Partent** : nœud, placer, renfort, Bureau, Tes choix, plateau.

**Les décisions de JP du 7 au 9 nov.**
- **Défaites** :
  - la saison de 82 matchs au jour le jour et la vraie cédule (remplacées par la carte ; *tu choisis les équipes qui vont quand* est tenu par le chemin) ;
  - la boutique à sept nœuds (remplacée par les cases de marché) ;
  - l'élite du lundi (remplacée par la case d'élite).
- **Tenues** : 2 cœurs, « rival », l'élite qui ne coûte pas de cœur, le banc de cinq, la pièce au marché, le duel à un choix, la boule de neige bloquée, la première Coupe pas avant la troisième run, la méta en variété, les cartes.

**Les clés de sauvegarde ne bougent jamais.**

## 8. Ce qui part

Chaque nom ci-dessous disparaît du jeu au remplacement (tranche 4), et *check_refonte* le vérifie sur la somme. Chacun a été cherché dans js/ ou scripts/ le 9 nov. 2026 ; seul ce qui part est entre accents graves. Le test du zéro : la carte, la feuille du soir, les portes et la coquille s'écrivent depuis le § 4 sans rouvrir le Bureau ni la cédule.

### La coquille de site

- `SECTIONS_ROGUE` → le HUD et le menu pause.
- `js/composants.js`, `pl-bandeau`, `pl-jetons`, `pl-coin`, `pl-cellules`, `pl-marche`, `pl-podium` → les scènes de la direction C.

### Le Bureau, sa boîte et le jour à jour

- `ouvrirSaison` (≈ 3 000 lignes de js/saison.js, ouvert seulement en Rogue) et ses pièces :
  - `rendreActions`, `messagesCourants`, `specsForces`, `PRESSE`, `auBureau` ;
  - `ouvrirJournal`, `nouvellesDuJour`, `autourHtml`, `semainePasseeHtml` ;
  - `prochainHtml`, `bancDuMatinHtml`, `proprioHtml`, `voletFiche`, `annonceHtml` ;
  - `motDuJour`, `motDeLaSemaine`, `avancerSemaine`, `avancerPuisResumer`, `arretDeSemaine` ;
  - `etapesDeLActe`, `regarderProchain`, `soignerLeBlesse`.

  Ils sont remplacés par la carte et ses scènes.

### La run posée sur la cédule de la ligue

- `poserLesRivaux`, `crochetDesActes`, `echangeables`, `echangerTesCases`, `ouvrirLeCalendrier`, `renfortDe`, `renfortsDe`, `rangAuSoir` → la carte de l'acte (le rival est la case du sommet).
- `NOEUDS_BOUTIQUE`, `noeudOuvert` → les cases de marché.
- `eliteDeLaSemaine` → les cases d'élite.
- `JOURS_OBJECTIFS`, `offreObjectif` → rien : les objectifs du proprio sur vingt soirs n'ont plus de saison où vivre ; la cible les remplace.

### Le rythme du lundi

- `lundiAHistoire`, `CHANCE_HISTOIRE`, `DISETTE_MAX` → les cases d'histoire de la carte.

### L'ancienne run

- `js/rogue-jeu.js`, `js/inventaire.js`, `js/depart.js` → la run neuve. Ce qui s'y garde (ouvrir une pochette, la page des déblocages) déménage fonction par fonction, nommé à l'extrait de la tranche 4.

### Les juges de l'ancienne forme

- `scripts/check_plateau.mjs`, `scripts/check_composants.mjs`, `scripts/check_calendrier.mjs`, `scripts/check_profondeur.mjs`, `scripts/mesure_rythme.mjs`, `scripts/lib/rogue_actes.mjs` → *check_scene*, *check_run*, *check_neuf*, *mesure_run*, *essai_run*.

**Le compte** : 56 noms, dont la plus grosse fonction du dépôt (`ouvrirSaison`, ≈ 3 000 lignes), 4 fichiers du jeu (≈ 2 070 lignes), la section du plateau de style.css (≈ 840 lignes) et 6 scripts.

**Vérifié à la tranche 4** (11 nov., docs/refonte-v28-4.md) : *js/actes.js* reste (le jeu du rival, l'élite, le prix de la pièce, les médailles d'un acte), sa cédule est partie ; *js/banc-du-soir.js* et *js/scenes.js* sont partis ; *ouvrirLeDuel* est parti, le duel est une scène de la feuille du soir ; les gabarits *hub-* que le tournoi de Sur table partage restent ; dans js/sim.js, les objectifs du proprio, l'instantané, le crochet *placer* et *jouerLaCedule* sont partis. La liste d'origine :

**À vérifier à sa tranche avant de l'ajouter** (en italique, pour que *check_refonte* ne le compte pas encore) :
- *js/actes.js* : ce qui y reste après le départ de la cédule (*jeuDuRival*, *recompenseDeLElite*, le prix de la pièce) déménage, et le fichier part s'il se vide — ces deux fonctions restent dans le jeu, la run en carte les lit (corrigé le 11 nov. : écrites entre accents graves, *check_refonte* les aurait comptées parties) ;
- *js/banc-du-soir.js* : refait dans l'après-match, ou gardé ;
- *ouvrirLeDuel* : son écran est refait dans la feuille du soir ;
- *js/scenes.js* et les histoires dont le fait lit la ligue ;
- les gabarits *hub-* que le tournoi de Sur table partage ;
- dans js/sim.js, ce que seul le jour à jour du Rogue lisait.

## 8b. Ce qui reste, et pourquoi

- **Le simulateur calibré** (js/sim.js, `playGame`, `jouerEnPeriodes`, `creerSeries`) et **ses greffes** (js/greffes.js) : JP, 9 nov.
- **Le banc de cinq** (js/pieces.js, le relais, `PIECE_DU_COACH`) et **le duel à un choix** (`plansDuDuel`, `INTENTIONS`, `FORCE_DUEL`) : la V27, tenue.
- **Les cartes de hockey** (`cartonHtml`, `carteHtml`, les séries, `EDITIONS`, la pochette et sa pile) : JP, deux fois.
- **Les vrais vestiaires et l'échange** (js/repechage.js, `choisirQuiSort`) : c'est la porte et la signature.
- **Les rôles, les badges, les accords** (`AFFINITES`, `badgesDe`) : le club qu'on bâtit.
- **Le pronostic** (js/pronostic.js) : la jauge de la feuille du soir.
- **Les vrais coachs** (`lotoDesCoachs`, data/coachs.json, `REGLES_DU_COACH`).
- **Les histoires et leurs voix** (js/histoires.js, `HISTOIRES`, `EXPEDITEURS`) : sorties du lundi, mises sur la carte.
- **Les sons, le jus, les écussons, les photos.**
- **Le cartable, l'album, ton club, le panthéon, les médailles, les exigences.** Les galons se réécrivent à l'échelle d'une run courte : 40 buts ne se font plus en vingt matchs.
- **Le 82-0, Sur table, l'exhibition** : aucun ne change.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| *MATCHS_PAR_ACTE* | 5 et le rival | 4-6 | moins, la cible est un coup de dés ; plus, la run passe deux heures |
| *CIBLES* | 7 · 8 · 9 sur 14 | ±1 chacune | le premier levier de la difficulté |
| *COEURS* | 2 | 2 (JP) | ne se règle pas |
| *PORTES* | 3 | 2-4 | à 1, pas de choix ; à 5, plus de manque |
| *RACHAT*, la part du salaire de celui qui sort qui se libère | 0,5 (JP, 10 nov.) | 0,4-0,7 | à 1, le plafond ne mord pas et lire la cote suffit ; trop bas, on ne signe plus |
| *DECALAGE*, les adversaires plus haut parmi tous les clubs | 0,25 | 0,15-0,35 | mesuré : 0,15 laisse 14 Coupes au malin, 0,35 garde la boule de neige au chiffre |
| *ETAPES*, les étapes d'édition des adversaires (actes I, II, III, séries) | 1 · 2 · 3 · 7 (11 nov. ; 0 · 1 · 2 · 4 à la tranche 0) | ±1 chacune | sans elles, ton club finit plus fort que le haut de la décennie et gagne une Coupe sur trois |
| Le départ : la masse, le plafond | 91,5 M$ sous 95,5 M$, sur l'échelle de salaires d'aujourd'hui | ±2 M$ d'espace | plus d'espace, le camp règle tout ; moins, on ne signe plus |
| La bande des portes | selon le club battu | — | trop haute après une victoire, la boule de neige revient |
| *RANGS_DE_DOS_A_DOS*, les rangs d'un acte joués sans jour de repos | le 2e et le 3e (tranche 4) | un ou deux rangs | un seul, la famille de la fatigue joue 14 % des soirs ; le rival en plus, huit pièces ne jouent jamais le match qui compte double |
| La durée des temps forts | 30-60 s | 20-90 s | plus long, dix-huit matchs deviennent une corvée |
| Les séries | 3 de 5, rachetées par un cœur | 2 de 3 à 4 de 7 | 2 de 3, la run finit sur des dés |

## 10. Les critères d'acceptation

Les portes d'abord : une tranche ne commence pas tant que la porte d'avant n'est pas passée.

- [x] **La porte 0, le test d'un jour** (10 nov. ; le réglage retenu au § 5 : la difficulté tient, gérer son plafond paie 22 Coupes contre 14, mais 3,5 points de cibles au lieu de 5 — le reste se mesure à la tranche 3 avec le banc, les élites et les histoires) : le simulateur, de vrais clubs, la run en carte jouée par trois robots sur 64 graines, aucun écran — *mesure_run* (neuf). Rouge, on règle la carte et les portes avant tout écran.
  - Le robot qui lit (les portes par ce qu'elles allument, le chemin selon ses forces, le plan contre le rival) tient ses cibles au moins 5 points plus souvent que **le robot du chiffre**, qui prend toujours la carte la mieux cotée et le chemin le plus court.
  - Une signature de porte bien choisie déplace la chance du match suivant d'au moins 3 points en moyenne.
  - L'ordre des trios contre leurs lignes, mesuré en paires : si l'écart reste sous 2 points, la feuille du soir ne le présente pas comme un choix (§ 4.4).
- [x] **La porte 1, les écrans** (JP, 10 nov. : *fais tout je suis tanné des maquettes*) : chaque scène du § 4.9 en direction C, à 390 × 844, docs/maquettes/v28-ecrans.html ; elles font foi.
- [ ] **La porte 2, un acte au téléphone** — à juger par JP : après un acte du « Rogue neuf », il en relance un deuxième. Depuis *fais tout* (10 nov.), elle ne retient plus les tranches 3 à 5 : JP juge la run entière à l'essai.
- [x] **La run** (11 nov.) — *check_run* (neuf), *essai_run* (neuf, à 390 px) :
  - trois actes de cinq matchs et un rival, deux arrêts par acte ;
  - la cible et les cœurs recomptés ;
  - un rival par acte, annoncé avec son jeu ;
  - trois portes après chaque match, l'une le club affronté ;
  - aucun joueur deux fois ;
  - le plafond jamais dépassé ;
  - aucune ligue jouée en coulisse.
- [~] **Lire paie, sans gagner d'office** (11 nov., tranche 4 : le malin 5 Coupes sur 64, la run 9 en médiane, « premier » 0 ; **deux points restent ouverts, à trancher par JP** — le chiffre en gagne 8, un écart sous le bruit : lire paie à l'acte I, 67 % contre 53 %, pas sur la run ; et 6 % des runs au lieu d'une sur dix) — *mesure_run*, en CI (il exige que lire ne coûte pas, et imprime le reste avec son bruit) :
  - le robot qui lit gagne la Coupe 4 à 12 fois sur 64, le robot du chiffre moins souvent en paires, « premier » au plus 2 fois ;
  - la première Coupe jamais avant la troisième run en médiane (JP) ;
  - au moins une run sur dix du robot qui lit finit l'acte III à 75 % de pronostic moyen ou plus (*tu peux exploser le jeu*).
- [x] **Le banc remesuré** (11 nov., tranche 4 : 27 vérifications vertes à l'échantillon plein ; la run pose le soir au moteur, trois matchs en trois soirs, cinq pièces réglées) : chaque pièce se voit le soir où elle joue et n'est jamais un piège sur un acte de six matchs ; le banc complet sous sa borne recalculée — `check_pouvoirs` (sa durée d'acte passe de 27 à 6).
- [x] **Une scène, jamais une page** (11 nov.) — *check_scene* (neuf) :
  - dans le Rogue, aucune scène ne défile ;
  - aucun en-tête de site ni barre d'onglets ;
  - le HUD toujours au même endroit ;
  - chaque cible fait 44 × 44.
- [x] **Neuf touchers** (11 nov. : six) : une semaine gagnée en neuf touchers au plus, aucun sans décision — *essai_run*.
- [x] **Le match vu est le match joué** (11 nov.) : chaque temps fort a le tireur, les passeurs et la minute de la feuille, et le pointage vu est celui que la run garde — *essai_run*.
- [x] **Le moteur ne bouge pas** (11 nov.) : l'empreinte est la même, le 82-0 se rejoue au but près — `check_empreinte`, `check_feuilles`, `check_graine`.
- [x] **Le neuf ne s'appuie pas sur l'ancien** (11 nov.) : aucun fichier *run-* n'importe un module nommé au § 8 — *check_neuf*.
- [x] **Les vieilles parties** (11 nov.) s'arrêtent, versent leurs médailles une fois, et le Rogue ouvre une run neuve — `check_sauvegardes`. L'écran de ce qui est versé (§ 6) est venu à la tranche 5a : le solde, une fois (`sceneSolde`).
- [x] Pas une couche de peinture (11 nov. : le jeu retire cinq lignes pour une ajoutée, les 56 noms sont partis) : ce qui part est parti ; le jeu retire au moins une ligne pour deux ajoutées ; style.css fait moins de la moitié du diff — `check_refonte` (sur la somme).
- [x] Rien de mort (11 nov.) — `check_mort`.
- [ ] À juger par JP à l'essai, au téléphone :
  - on dirait un jeu ;
  - une case donne envie d'y aller ;
  - une porte donne envie de l'ouvrir ;
  - perdre fait dire « j'aurais dû ».

## Les tranches

L'ancien Rogue est **gelé** dès le 9 nov. (JP) : plus aucun travail dessus. Les tranches 8 à 11 de la V27 et D1b s'arrêtent. Il reste jouable jusqu'à la tranche 4. Chaque tranche porte son extrait `docs/refonte-v28-<n>.md`.

**0. Le test d'un jour.** La run en carte, jouée par le simulateur dans un script de mesure. De vrais clubs : les portes tirées des vrais vestiaires, les matchs par `simulerGrosMatch`, les séries par `creerSeries`. Trois robots (celui qui lit, celui du chiffre, « premier ») sur 64 graines. *Le joueur ne voit rien.* Juge : la porte 0.

**1. Les écrans.**
- Fait : les maquettes C1 et C2 (docs/maquettes/v28.html).
- Fait (10 nov.) : dix-sept scènes en direction C, à 390 × 844, avec les vraies cartes à la série de leur saison (docs/maquettes/v28-ecrans.html). Une seule run d'un écran à l'autre : le départ, la carte de l'acte, le rival, la feuille du soir et son plan, le match, les portes, la porte ouverte, l'échange, les Lignes, le marché, le vestiaire, une histoire, la fin d'acte, les séries, la fin de run, le menu pause.
- **Tranché par JP (10 nov. 2026)** : *fais tout je suis tanné des maquettes*. Les dix-sept écrans font foi tels quels ; plus de tour de maquettes. Le code les reproduit, il ne s'en inspire pas.
- **Ce que les maquettes précisent**, que le § 4 ne disait pas, et que JP tranche avec elles :
  - **Le départ** est une scène : ton coach, un parmi trois, avec sa règle et sa pièce de départ. Le camp est l'écran des trois portes, joué trois fois.
  - **La carte** a des rangs de matchs et des rangs d'arrêts : chaque chemin compte bien cinq matchs et deux arrêts. Le tiroir du bas compare les deux cases offertes.
  - **La feuille du soir** dit ce que le match paie, gagné et perdu, avant de jouer.
  - **La porte ouverte** montre les cinq plus forts qui tiennent dans ton espace ; le reste est plié derrière une tuile, pour que l'écran ne défile pas. Le coin d'une carte s'allume pour l'accord ; son salaire est dessous.
  - **Les Lignes** tiennent tes quatre trios sans défiler (des cartes de 88 px) ; la défense, le filet et les joueurs en civil sont à un toucher.
  - **Le marché** ne soigne pas : le soin est au vestiaire, seul.
  - **Les pages du menu pause** rouvrent les scènes : « Tes joueurs » ouvre les Lignes.

**2. Un acte.** « Le Rogue neuf » s'ouvre du menu, à côté de l'ancien, avec :
- la coquille (le HUD, le menu pause) ;
- la carte d'un acte, la feuille du soir, le match en temps forts, les portes ;
- le marché et le vestiaire, un rival.

*Le joueur voit vingt minutes de jeu complètes.* Juge : la porte 2, *check_scene*, *check_neuf*, *essai_run*.

**3. La run.** Trois actes et les séries ; les élites, les histoires sur la carte, toutes les années ensemble (JP, 11 nov. ; « une époque par run » est défaite) ; les robots en CI ; le banc remesuré. Juge : *mesure_run*, *check_run*, `check_pouvoirs`, JP.

**4. Le remplacement.** « Le Rogue neuf » devient le Rogue. Tout le § 8 part d'un coup, avec ses règles et ses juges ; la vieille run est versée. Juge : `check_refonte` sur la somme, `check_mort`, `check_coquille`, `check_sauvegardes`, `tout.mjs`.

**5. La méta.** La variété en médailles, les exigences sur les leviers neufs, les galons à l'échelle d'une run. Juge : *mesure_run*. — **5a livrée le 11 nov. 2026** (docs/refonte-v28-5.md) : le Club entre deux runs (les philosophies, ton club, le palmarès), trois crans d'exigence mesurés (la cible et la force des clubs ; « le plafond » et « une porte de moins » ne coûtent rien aujourd'hui et attendent), le solde des déblocages d'avant ; juges : *check_meta*, `check_scene`, `essai_run`, `CRANS=1` de *mesure_run*. Reste **5b** : l'Album, les galons, les sortes de pochette.

**Ensuite**, du contenu, une PR à la fois : des rivaux, des pièces, des histoires, la Dynastie réécrite sur la carte, le défi du jour.

## 11. Tranché par JP (9 nov. 2026)

1. **La boucle** : la carte de l'acte, la feuille du soir, le match, les trois portes ; trois actes et les séries au lieu des 82 soirs. — **Oui.**
2. **Le moteur** : un moteur de présences fait pour être vu, ou le simulateur ? — **Garder le simulateur.** Le moteur de présences, ses appels en plein match et ses mesures partent du devis. Le match se montre en temps forts, à partir de la feuille du simulateur.
3. **L'allure** : A (l'arcade 16 bits), B (la table de cartes) ou C (la carte de la saison) ? — **C partout**, sans pixel art.
4. **L'ancien Rogue** : gelé dès aujourd'hui, jouable jusqu'au remplacement, puis supprimé ; les runs en cours perdues, les médailles et le cartable gardés. — **Oui.**

## 11b. Tranché par JP (10 nov. 2026, sur les écrans)

*fais tout je suis tanné des maquettes.*

- **Les maquettes font foi** (docs/maquettes/v28-ecrans.html) : les dix-sept scènes, et ce qu'elles précisent (tranche 1). Aucun autre tour de maquettes.
- **Tout** : les tranches 2 à 5 s'enchaînent sans attendre un essai entre elles. Les tranches 2 et 3 se livrent ensemble (la run entière, jouable à côté de l'ancien Rogue) ; puis le remplacement ; puis la méta.
- Ce qui reste à JP : l'essai au téléphone, sur la run entière (§ 10, « à juger par JP »).

## 12. Ce qui a été écarté

- **Garder les 82 soirs et mieux choisir entre eux** : la V3 à la V27.
- **Refaire l'interface seule**, sur la saison d'aujourd'hui (un brouillon du 9 nov.). JP : *un change l'autre*.
- **Un moteur de match neuf, en quinze présences**, avec des appels en plein match (un brouillon du 9 nov.) : JP garde le simulateur. Ses mesures (la feuille du soir à +12 points contre un club à vedettes) valaient pour ce moteur-là et se refont sur le simulateur à la tranche 0.
- **Le pixel art et les patineurs de Sur glace dans le Rogue** (la direction A) : JP a choisi C partout.
- **La table de cartes** (la direction B).
- **Choisir son trio à chaque présence pendant le match** : mesuré, « le plus frais » est toujours la bonne réponse. C'était le contre de la V6 et le matching de la V13 sous un autre nom.
- **Un deck de cartes de tactique au match** : mort trois fois. Les cartes du jeu, ce sont les joueurs.
- **Le pronostic à chaque geste** : un solveur qui jouait le club à ta place. Il reste sur la feuille du soir seulement.
- **Trois portes après une victoire, une seule après une défaite** : c'était la boule de neige.
- **Les séries en 2 de 3** : la run finissait sur des dés.
