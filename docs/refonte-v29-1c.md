# V29, tranche 1 ter : le marché monte une carte, la caisse devient des médailles

L'extrait du devis `docs/refonte-v29.md` pour sa tranche 1 ter. JP, 14 nov. 2026 : **« Monter une carte au marché »** (à la question des jetons : 98 restaient en caisse à la fin d'une run), puis, avec la mesure de trois prix : **« 20 jetons, une par marché »** et **« Ils deviennent des médailles »**.

## Ce que le joueur voit

- **Au marché, une carte à monter** : une tuile à côté des pochettes montre un de tes signés, celui qui avance le plus ton banc ; la toucher encore passe au suivant. Pour 20 jetons, sa carte monte d'une édition : ses badges montent, donc le compte de tes pièces (« 🎯 +1 »). Une par marché, comme la pièce de banc.
- **À la fin de la run, la caisse compte** : 10 jetons qui restent valent une médaille ; l'écran de fin le dit sur une ligne. Ce qu'on gagne après le dernier marché (le rival de l'acte III) sert enfin à quelque chose.
- **La ligne bleue** demande un peu plus : ses seuils passent de 5 · 9 · 13 à 5 · 11 · 16 (c'était la seule pièce qu'on montait presque sans y penser).
- **Le Mur** se grave à 50 arrêts dans une victoire, plus à 40 : un club que son banc multiplie reçoit et donne plus de tirs, et à 40 il tombait plus d'une fois par run (prévu pour une run sur dix).

## Ce que la mesure des prix avait dit

Sur les 64 graines du CI, le robot qui bâtit, un prototype :

| La carte à monter | Montées par run | La Coupe, sur 64 | Runs qui explosent | Jetons en caisse |
|---|---|---|---|---|
| Aucune (la tranche 1 bis) | 0 | 7 | 17 % | 87 |
| 32 jetons, sans limite | 1,7 | 12 | 25 % | 57 |
| **20 jetons, une par marché** | 1,7 | 10 | 27 % | 74 |
| 20 jetons, sans limite | 3,4 | 13 | 33 % | 55 |
| 12 jetons, sans limite | 5,5 | 13 | 38 % | 55 |

Une carte montée est de la force : son édition monte ses badges au moteur comme au compte du banc. Et la caisse ne se vide pas : ce qu'on gagne après le dernier marché ne s'achète nulle part (ni porte ni marché en séries). D'où les deux réponses de JP.

## Ce qu'il touche

`js/run.js` (`MONTER`, `JETONS_PAR_MEDAILLE`, `aMonter`, `monterAuMarche`, `medaillesDeLaCaisse` ; le Mur à 50 arrêts), `js/run-scenes.js` (la tuile du marché, la ligne de la caisse à la fin), `js/run-jeu.js` (ses deux gestes), `index.html` (la page des règles), `sw.js`, `js/version.js` (3.10.0).

Les juges : `scripts/lib/run_robot.mjs` (le bâtisseur et son témoin montent la carte que l'écran propose d'abord), `scripts/mesure_run.mjs` (les cartes montées par run, la caisse en médailles, le compte de chaque pièce, les marches du témoin), `scripts/check_run.mjs` (une seule carte montée par marché, la caisse jamais sous zéro, la caisse de fin recomptée), `scripts/check_scene.mjs` (34 scènes : le marché, une carte à monter), `scripts/essai_run.mjs`, `scripts/check_clarte.mjs`.

Les règles : `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`, `.claude/rules/interface.md`.

## « Aucune marche d'office », jugée sur qui ne bâtit pas

Le devis voulait la deuxième marche atteinte sur 10 à 60 % des bancs du bâtisseur ; il l'atteint sur 57 à 91 % — il bâtit pour ça. JP, 14 nov., avec ces chiffres : **« Le juger sur qui ne bâtit pas »**. Sur les bancs du témoin, chaque pièce doit atteindre sa deuxième marche au plus 60 % du temps et sa troisième au plus 25 %. La ligne bleue était pile sur la borne (60 % et 25 %, puis 59 % et 25 % à 5 · 10 · 14 : qui la porte l'a prise parce qu'elle était déjà avancée chez lui) : d'où ses seuils à 5 · 11 · 16.

## Une borne se juge à sa taille

Avec la carte à monter, les 64 graines du CI donnaient 13 Coupes au bâtisseur (la borne de JP s'arrête à 12), quand 256 graines neuves en donnent 8 sur 64. À cette fréquence, un compte sur 64 runs bouge de ±5 : le juge du CI tirait à pile ou face. La borne de JP se juge maintenant à 256 graines, à la main, comme les autres bornes du build ; à 64 graines, le CI exige que le compte soit compatible avec elle, à deux écarts-types de son bord. Un mur plus haut en séries (2 · 2 · 3 pièces) a été essayé et écarté : il ne changeait rien à ces treize runs.

## Ce qui part

Rien du jeu ne part ici : c'est un ajout tranché par JP, pas une refonte à lui seul, et `check_refonte` ne s'y juge pas (la refonte se juge sur la somme des tranches). Ce qui part du côté des juges : la borne « 40 jetons ou moins en caisse », que la décision de JP remplace (la caisse devient des médailles).

## Les mesures

**Le juge**, 256 graines neuves (9000 à 9255), les quatre robots, `GRAINES=256 FILS=3 GRAINE0=9000 node scripts/mesure_run.mjs` — treize vérifications, toutes vertes, pour la première fois depuis le devis :

| Le critère | Mesuré | La borne |
|---|---|---|
| Bâtir paie, en paires | 70 % de cibles tenues contre 54 % : +17,1 points, bruit ±5,0 | au-delà du bruit |
| Dur, mais ça explose | 19,5 % des runs jouent l'acte III à 75 % de chance | 15 à 35 % |
| La Coupe | 40 sur 256, soit 10 sur 64 ; la première à la run 5 en médiane ; « premier » aucune | 4 à 12 sur 64, pas avant la run 3 ; 2 au plus |
| Les séries sont le mur | une run qui explose gagne la Coupe 22 fois sur 50 | moins d'une fois sur deux |
| La cote seule ne suffit plus | le chiffre tient la cible de l'acte III 13 fois sur 100 | au plus une sur trois |
| Plus d'un build gagne | 9 pièces mènent un banc gagnant ; la plus fréquente, les deux sens, 21 sur 92 | 5 pièces, aucune au-delà de 40 % |
| Chaque pièce vit | la première marche atteinte de 81 à 96 % des bancs | plus d'une fois sur deux |
| Aucune marche d'office | chez le témoin, la deuxième marche au plus 54 % du temps, la troisième au plus 11 % | 60 % et 25 % au plus |
| Les jetons servent | 1,8 carte montée au marché par run | 1 à 4 |
| Les galons | chaque sorte dans 14 à 80 % des runs ; 9,1 par run hors la Coupe | 5 à 85 % ; 4 à 12 |

Le juge d'avant (8000 à 8255, la ligne bleue à 5 · 10 · 14) était vert lui aussi : 10 Coupes sur 64, 75 % de cibles contre 56 %, 25 % de runs qui explosent.

**Sur les graines du CI** (0 à 63) : le malin 13 Coupes sur 64 (compatible avec la borne à cette taille), « premier » aucune ; 77 % de cibles tenues contre 56 % pour son témoin ; 11,3 galons par run hors la Coupe ; 69 jetons en caisse à la fin, soit 6 à 7 médailles.

## Ce qui reste ouvert

- [ ] **Lire son banc à l'écran** (tranche 2) : la porte qui dit ce qu'elle nourrit, la porte ouverte triée (sur capture, JP tranche), le banc avant et après à l'échange, la marche qui s'allume, la feuille d'un soir ordinaire, la fin de run qui nomme ton banc.
- [ ] **La tranche 3** : l'origine, une pièce à la fois ; le match du rival, qui décide encore la cible dans un acte sur deux, et sa question reposée à JP ; le prix d'une pièce et la récompense de l'élite à remesurer ; une pochette achetée par les robots ; la pochette Époque.
- [ ] Une run qui explose gagne la Coupe 22 fois sur 50 : sous la borne (moins d'une fois sur deux), mais près d'elle ; à surveiller au prochain juge.
- [ ] À juger par JP à l'essai : monter une carte au marché se sent-il sur ton banc ? la caisse en médailles change-t-elle ta dernière visite au marché ?
