# V29, tranche 1 : le banc qui compte

L'extrait du devis `docs/refonte-v29.md` pour sa tranche 1, livrée le 14 nov. 2026. JP, 13 nov. : *le roguelike est pas le fun, ni bati comme il faut pour être un vrai jeu je trouve* ; « le build décide ». 14 nov. : « seulement tes signés », « trois pièces au camp », « dur, mais ça explose », « les séries sont le mur », « relancer les portes », puis « choisis » sur les deux questions restées ouvertes (ci-dessous).

## Ce que le joueur voit

- **Au camp**, après ton coach : deux pièces de banc à choisir, une parmi trois chacune, avant la première porte. Aucun « Passer ». Ton banc a trois pièces et une direction avant ta première signature.
- **Une pièce dit ce qu'elle compte** (« Compte tes snipers »), où tu en es (« 7 / 14 », trois points pour ses marches) et ce qu'elle fait à ce compte, en tirs et en buts par match. Sous son premier seuil, elle dit ce qui l'attend (« À 7 : … »).
- **Signer change ton banc** : seuls les joueurs que tu signes comptent, où qu'ils jouent. À l'échange, la sortie proposée d'avance est le plus faible que ton banc ne compte pas.
- **Relancer les portes** : gratuit après une défaite, sinon 8 jetons, puis 16, puis 32 le même soir ; le bouton dit son prix.
- **Les clubs montent tard** : l'acte I est celui d'avant, l'acte III et les séries sont au sommet de l'échelle des éditions.
- **En séries, leur banc** se voit sous le tien sur la feuille du soir : 1 pièce à la première ronde, 2 à la demi-finale, 3 en finale, qui comptent leurs joueurs.
- **Sous l'annonce du rival**, ton banc et « Son match compte double » ; « Pour le battre » est parti.
- **Une run commencée avant cette version s'arrête** à l'ouverture : ses médailles gagnées jusque-là sont versées une fois, un mot le dit (JP, 14 nov.).

## Les neuf pièces

Chacune compte les badges d'un ou deux rôles chez tes signés (Bronze 1, Argent 2, Or 3, Platine 4 ; le second badge d'un joueur à moitié) et multiplie un canal du moteur, tout le match : rien sous le premier seuil, puis +12 %, +37 %, +75 % (le leur divisé d'autant). Deux pièces sur le même canal se multiplient, jusqu'à ×3.

| Pièce | Elle compte | Elle multiplie | Seuils | Le coach qui la porte au départ |
|---|---|---|---|---|
| 🎯 Les tireurs | tes snipers | ta précision | 7 · 14 · 21 | 🦅 L'Aigle |
| 🅰 Les passeurs | tes passeurs | tes tirs | 7 · 13 · 19 | 🌠 Le Showman |
| 🦍 Les gros | tes power forwards | tes tirs | 4 · 8 · 12 | 🐝 Le Frelon |
| 🚀 La ligne bleue | tes défenseurs offensifs | tes tirs | 5 · 9 · 13 | — |
| 🏒 Les manieurs | tes manieurs de rondelle | ta précision | 5 · 10 · 14 | 😇 L'Abbé |
| ☯ Les deux sens | tes two-way | leur précision | 6 · 12 · 18 | 🐢 La Tortue |
| 🔧 L'étouffoir | tes checkers | leurs tirs | 3 · 6 · 9 | 🪜 Le Contremaître |
| 🪠 Les cols bleus | tes plombiers et tes bagarreurs | leur précision | 4 · 8 · 11 | 🫁 Le Doc |
| 🛑 La muraille | tes défenseurs défensifs et physiques | leurs tirs | 4 · 7 · 10 | 🦏 Le Rhino |

La pièce de départ d'un coach compte un rôle de sa couleur (js/coachs.js, la table des rôles par coach), et sa maîtrise (×0,9 à ×1,3) règle ses marches.

## Ce qui part

Les seize noms du § 7 du devis, d'un coup : `quandMot`, `bancDuSoir`, `poserLeBancDuSoir`, `piecesDuSoir`, `bancDeLaPeriode`, `bancPose`, `RELAIS_NIV`, `effetDuRelais`, `ligneDuRelais`, `scripts/check_relais.mjs`, `POIDS_RARE`, `poidsDuTirage`, `PIECES_PAR_SAISON_DES_FOURCHES`, `piecesContre`, `OMBRE`, `PLAN_DE_LA_PIECE`.

Avec eux : la table des trente-six pièces à condition (*js/pieces.js* passe de 314 à 133 lignes, écrit de zéro), le banc lu période par période (*js/greffes.js*), les voisines du rival battu, les bornes en victoires et la présence par soir du juge du banc (*scripts/check_pouvoirs.mjs*, de 318 à 195 lignes), la mesure d'un jour (*scripts/mesure_build.mjs*, 261 lignes : ses robots sont ceux du jeu maintenant), « N pièces jouent » au tiroir de la carte, « Pour le battre » sous l'annonce du rival, deux règles de style.css.

En lignes : le jeu retire 468 lignes pour 291 ajoutées ; les scripts, 955 pour 415.

**Ce qui reste**, comme au devis : le simulateur et le match sans geste, la carte, les portes, l'échange et les scènes de la V28, les cinq cases et la pièce parmi trois, le coach, sa maîtrise et sa règle, les moments (les réponses d'histoire les lisent), l'élite, le marché, le vestiaire, les histoires, la méta, les galons, les cartes.

## Ce qu'il touche

`js/pieces.js` (réécrit), `js/greffes.js` (le banc posé une fois par match, au-dessus des bornes de style), `js/run.js` (les deux pièces du camp, tes signés, leur banc, la relance payée, la difficulté, la vieille run soldée), `js/run-scenes.js` et `js/run-jeu.js` (le camp, les lignes d'une pièce, leur banc sur la feuille, le prix de la relance, la sortie proposée), `js/impact.js` (les lignes d'une pièce en vraies stats, les plans du coach), `js/cartes.js`, `js/faits.js`, `js/histoires.js`, `index.html` (la page des règles), `style.css`, `sw.js` et `js/version.js` (3.8.0).

Les juges : `scripts/lib/run_robot.mjs` (réécrit : le malin bâtit, son témoin ne lit pas son banc), `scripts/mesure_run.mjs` (réécrit), `scripts/check_pouvoirs.mjs` (réécrit), `scripts/check_run.mjs`, `scripts/check_gros.mjs`, `scripts/check_elites.mjs`, `scripts/check_duel.mjs`, `scripts/check_clarte.mjs`, `scripts/essai_run.mjs`.

Les règles : `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`, `.claude/rules/interface.md`, `.claude/rules/moteur.md`.

## Ce qui diffère du devis, et pourquoi

| Le devis disait | La tranche fait | Pourquoi |
|---|---|---|
| Des pièces de badge et des pièces d'origine | Neuf pièces de badge | JP, 14 nov., « choisis » : l'origine ne menait que 2 bancs gagnants sur 129 depuis que seuls les signés comptent ; elle revient une pièce à la fois, mesurée |
| Leur coach porte une pièce, à la marche de sa ronde | Leur banc de 1, 2 puis 3 pièces, qui compte tout leur club | JP, 14 nov., « choisis » : un vrai banc en face, qui se lit comme le tien, au lieu d'une pièce quatre fois plus forte |
| Le Frelon compte les passeurs, la Tortue les défenseurs défensifs… | Chaque coach porte la pièce qui compte un rôle de sa couleur | La couleur d'un joueur existe déjà (js/coachs.js) : le pack du coach et sa pièce disent la même chose |
| Une run gardée d'avant se rouvre | Elle s'arrête, ses médailles versées une fois | JP, 14 nov. : elle rouvrirait avec une seule pièce contre un acte III monté de 3 à 12 étapes |
| Le plan du duel, « un choix mince, à revoir après la tranche 2 » | Il reste dans cette tranche (ton coach propose les trois), et part à la suivante | Mesuré : le meilleur plan ne gagne que 0,3 % de matchs de plus que Ton match (6,4 % avant, quand des pièces le relayaient). JP, 14 nov. : « le plan part » |
| Le grand soir à cinq points, le bourreau contre un rival | Six points ; le bourreau contre le rival de l'acte III | Un club que son banc multiplie marque plus : les galons débordaient leurs bornes. La Coupe, gravée d'un coup sur les 23 cartes de l'effectif, se compte maintenant à part : 4 à 12 galons par run hors la Coupe (10,7 mesurés), au lieu de 4 à 14 Coupe comprise |
| Les robots achètent une pochette | Pas encore | Les pochettes ne se mesurent toujours pas dans la run ; à la tranche du marché (ci-dessous) |

## Les mesures

Quatre robots sur les mêmes graines (scripts/lib/run_robot.mjs) : « premier », le chiffre, le malin (le bâtisseur) et son témoin (le même, qui ne lit pas son banc aux portes).

**Le juge du build**, 256 graines neuves (4000 à 4255), `GRAINES=256 FILS=3 GRAINE0=4000 node scripts/mesure_run.mjs` :

| Le critère | Mesuré | La borne | |
|---|---|---|---|
| Bâtir paie, en paires | 74 % de cibles tenues contre 56 % : +18,8 points, bruit ±4,9 | au-delà du bruit | vert |
| Dur, mais ça explose | 24,6 % des runs du malin jouent l'acte III à 75 % de chance | 15 à 35 % | vert |
| La cote seule ne suffit plus | le chiffre tient la cible de l'acte III 14 fois sur 100 (0 Coupe sur 256) | au plus une sur trois | vert |
| Plus d'un build gagne | 8 pièces mènent un banc qui tient ses trois cibles ; la plus fréquente, les gros, 24 sur 112 | 5 pièces, aucune au-delà de 40 % | vert |
| Chaque pièce vit | la première marche atteinte de 74 % (l'étouffoir) à 99 % (la ligne bleue) des bancs | plus d'une fois sur deux | vert |
| La Coupe du malin, leur banc à 2 · 3 · 4 pièces | 13 sur 256, soit 3 sur 64 ; une run qui explose la gagne 8 fois sur 63 | 4 à 12 sur 64 | **rouge** |
| La Coupe du malin, leur banc à 1 · 2 · 3 pièces (les mêmes graines) | 36 sur 256, soit 9 sur 64 ; sa première Coupe à la run 5 en médiane | 4 à 12 sur 64, pas avant la run 3 | vert |
| Les séries sont le mur (1 · 2 · 3) | une run qui explose gagne la Coupe 23 fois sur 63 | moins d'une fois sur deux | vert |
| Aucune marche d'office | la deuxième marche atteinte de 53 % (les tireurs) à 93 % (les cols bleus) des bancs | 10 à 60 % | **rouge** |
| Les jetons servent | 98 jetons en caisse à la fin (93 dépensés en 13 relances par run) | 40 ou moins | **rouge** |

Le banc adverse des séries est donc livré à 1 · 2 · 3 pièces : à 2 · 3 · 4, le mur était trop haut pour la borne de JP.

**Confirmé sur 256 autres graines neuves** (5000 à 5255, le malin seul, leur banc à 1 · 2 · 3) : 28 Coupes sur 256, soit 7 sur 64, la première à la run 6 en médiane ; 25,4 % de runs qui explosent ; une run qui explose gagne la Coupe 11 fois sur 65 ; neuf pièces mènent un banc gagnant, la plus fréquente (les deux sens) 29 fois sur 112 ; 10,7 galons par run hors la Coupe. Les deux mêmes bornes y sont rouges : la deuxième marche (50 à 96 %) et les jetons (97).

**Sur les graines du CI** (0 à 63, les quatre robots, `GRAINES=64 node scripts/mesure_run.mjs`) : le malin 10 Coupes sur 64, « premier » et le chiffre aucune ; 79 % de cibles tenues contre 59 % pour son témoin (+21,4 points, bruit ±10,6) ; sa première Coupe à la run 5 en médiane ; 16 runs sur 64 explosent ; chaque sorte de galon dans 22 à 81 % des runs, 10,7 galons par run hors la Coupe.

Ce qui s'imprime sans se juger : chaque coach tient ses cibles entre 66 % (l'Aigle, le Showman) et 82 % (l'Abbé), pour 74 % en moyenne (jugé à 384 graines : dix points au plus) ; le match du rival décide la cible dans 396 actes sur 752.

Les autres juges : `check_pouvoirs` (chaque pièce en paires contre un banc vide : rien sous son premier seuil, notée aux trois périodes, vue du bon côté de la feuille), `check_run`, `check_gros` (leur banc grandit et coûte des buts), `check_scene` (33 scènes), `essai_run` (une run entière au doigt), `check_refonte` sur cet extrait, `check_mort`, `tout.mjs`.

## Ce qui reste ouvert

- [ ] **Le plan du duel part** (JP, 14 nov.) : une petite PR à part ; `check_duel`, dont une ligne est rouge depuis cette tranche (« le meilleur plan gagne plus que Ton match »), part ou se réécrit avec lui.
- [ ] **Les jetons** : 98 en caisse à la fin d'une run du bâtisseur, pour 40 visés (rouge au juge). JP, 14 nov. : au marché, des jetons montent d'une édition la carte d'un signé (ses badges, donc le compte de ton banc) ; à mesurer sur 256 graines avant de livrer.
- [ ] **Aucune marche d'office** : la deuxième marche est atteinte sur 53 à 93 % des bancs du bâtisseur, pour 10 à 60 % visés (rouge au juge) ; la moitié de ses pièces finissent à la troisième. Les seuils se reposent avec le marché qui monte une carte, sur la même mesure : monter une carte monte les comptes.
- [ ] **Le match du rival** décide encore la cible dans 396 actes sur 752 (53 %) ; la question se repose à JP avec ce chiffre (tranche 3).
- [ ] **La tranche 2**, lire son banc à l'écran : la porte qui dit ce qu'elle nourrit, la porte ouverte triée, le banc avant et après à l'échange, la marche qui s'allume, la fin de run qui nomme ton banc.
- [ ] **Un cran coûte encore** : `CRANS=1 GRAINES=128 FILS=3 node scripts/mesure_run.mjs`, à refaire sur la difficulté neuve (« Clubs +1 » ne peut plus monter l'acte III ni les séries, déjà au sommet de l'échelle).
