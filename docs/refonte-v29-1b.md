# V29, tranche 1 bis : le plan du duel part

L'extrait du devis `docs/refonte-v29.md` pour sa tranche 1 bis. JP, 14 nov. 2026, à la question posée avec sa mesure : **« Le plan part »**.

## Ce que JP a tranché, et sur quel chiffre

Au duel (le rival, l'élite, chaque match de série), tu choisissais un plan parmi trois avant le match (V27, tranche 6 ; JP, 7 nov. : *un seul choix lourd*). Depuis que le banc compte, plus aucune pièce ne relayait ce plan, et mesuré sur deux copies d'un même vrai club, les mêmes dés : le meilleur plan ne gagnait que 0,3 % de matchs de plus que « Ton match » (6,4 % avant). Avec un banc vide, l'ancien jeu donnait le même chiffre : le plan n'avait de poids que par ses pièces. Un choix qui ne pèse rien est ce que JP reproche au Rogue.

Écartés : « il mise sur une pièce » (une marche de plus pour un soir : de la force à remesurer, et sans doute toujours la même pièce) ; « on le laisse jusqu'à la tranche 3 » (huit duels par run avec un choix qui ne change rien).

## Ce que le joueur voit

- **La feuille du duel ne demande plus rien.** À la place des trois plans : **« Leur jeu ce soir »**, en une ligne qui nomme ton joueur visé (« L'ombre suit Miller ») et ce que ça te coûte en vraies stats (« −2,7 tirs contre · −0,6 pt de précision · −1,3 tir »), puis **« Ton banc ce soir »**, pièce par pièce : son compte, ses marches, ce qu'elle rend.
- En séries, **leur banc** reste sous le tien. Le bouton est « Au combat ».
- **La ligne d'une pièce ne se dit plus jamais en pourcentage.** Elle se lisait sous les bornes de style du moteur : un club déjà à sa borne voyait « Précision +37 % », et la première marche d'une pièce sur leur précision, un demi-point d'arrêts, tombait sous le seuil d'affichage. Elle se lit maintenant comme le moteur la joue, et se dit toujours.
- La page des règles : le paragraphe des plans du duel est parti.

## Ce qui part

`PLANS`, `planLu`, `cibleDuPlan`, `effetsDuPlan`, `forceContre`, `plansDuDuel`, `PLAN_DU_COACH`, `PLANS_DU_DUEL`, `lignesDuPlan`, `choixDuDuel`, `robotDuel`, `lirePlans`, `.rn-plans`, `scripts/lib/duel.mjs`.

Avec eux : le choix d'avant-match dans le moteur (la décision *main* d'une vieille ligue ne joue plus rien, comme les décisions d'entracte avant elle), le plan dans la lecture du match, « un plan qui répond à leur intention » (leur intention frappe toujours à la force du duel), les mots « par période » et l'usure des lignes d'un écart, le geste du plan dans la coquille, la mesure du meilleur plan contre Ton match.

En lignes : le jeu retire 235 lignes pour 109 ajoutées ; les scripts, 186 pour 86.

**Ce qui reste** : le duel en trois périodes, leurs cinq intentions et la dominante du rival, que rien d'autre ne remplace ; la jauge de ta chance ; l'enjeu.

## Ce qu'il touche

`js/greffes.js`, `js/impact.js` (`leurJeuEnStats` remplace les plans ; une pièce se lit par-dessus les bornes de style), `js/sim.js` (le choix d'avant-match et le plan d'une lecture retirés ; aucun tirage ne bouge), `js/run.js` (l'intention dominante a une seule source, pour l'écran, le match et les robots), `js/run-jeu.js`, `js/run-scenes.js` (la feuille du duel), `style.css`, `index.html`, `sw.js`, `js/version.js` (3.9.0).

Les juges : `scripts/check_duel.mjs` (réécrit : le duel sans plan), `scripts/lib/run_robot.mjs`, `scripts/check_clarte.mjs`, `scripts/check_pouvoirs.mjs` (une pièce se dit en vraies stats à chaque marche, même pour un club à sa borne).

Les règles : `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`, `.claude/rules/interface.md`.

## Un écart corrigé en chemin

Les robots jouaient le rival et l'élite sans leur intention dominante : l'écran la passait au match, pas eux. Elle a maintenant une seule source (`dominanteCeSoir`, js/run.js). La mesure ci-dessous est faite avec.

## Les mesures

**Le juge**, 256 graines neuves (6000 à 6255), le bâtisseur et son témoin, `GRAINES=256 FILS=3 GRAINE0=6000 ROBOTS=malin,temoin node scripts/mesure_run.mjs` :

| Le critère | Mesuré | La borne | |
|---|---|---|---|
| Bâtir paie, en paires | 73 % de cibles tenues contre 56 % : +17,4 points, bruit ±5,2 | au-delà du bruit | vert |
| Dur, mais ça explose | 21,1 % des runs jouent l'acte III à 75 % de chance | 15 à 35 % | vert |
| La Coupe | 31 sur 256, soit 8 sur 64 ; la première à la run 6 en médiane | 4 à 12 sur 64, pas avant la run 3 | vert |
| Les séries sont le mur | une run qui explose gagne la Coupe 12 fois sur 54 | moins d'une fois sur deux | vert |
| Plus d'un build gagne | 9 pièces mènent un banc gagnant ; la plus fréquente, les gros, 31 sur 107 | 5 pièces, aucune au-delà de 40 % | vert |
| Chaque pièce vit | la première marche atteinte de 73 à 97 % des bancs | plus d'une fois sur deux | vert |
| Aucune marche d'office | la deuxième marche atteinte de 56 à 95 % des bancs | 10 à 60 % | **rouge**, ouvert (1 ter) |
| Les jetons servent | 93 jetons en caisse à la fin | 40 ou moins | **rouge**, ouvert (1 ter) |

**Sur les graines du CI** (0 à 63, les quatre robots) : le malin 7 Coupes sur 64, « premier » et le chiffre aucune ; 73 % de cibles tenues contre 53 % pour son témoin ; 11 runs sur 64 explosent ; 11,5 galons par run hors la Coupe.

**Ce que le vrai rival coûte.** À réglages égaux, sur ces mêmes graines du CI, le bâtisseur tenait 79 % de ses cibles à la tranche 1, son témoin 59 %, « premier » 26 % ; ils en tiennent 73, 53 et 21 %. « Premier » ne prenait aucun plan : la baisse vient du rival, qui joue maintenant son intention dominante contre les robots comme à l'écran. Les mesures de la tranche 1 jouaient un rival plus doux que celui du joueur ; les bornes de JP tiennent quand même contre le vrai.

`check_duel` (réécrit, 11 vérifications) : trois périodes et leur intention, aucun plan, la même graine rejoue le même duel, la dominante sort dans 63 à 73 % des périodes, chacune des cinq intentions dit ce qu'elle coûte en vraies stats, et deux copies d'un même club en duel gagnent 49,5 % du temps (40 à 55 % voulus).

## Ce qui reste ouvert

- [ ] **Le marché monte une carte** (tranche 1 ter) : les jetons en caisse et la deuxième marche, rouges au juge.
- [ ] **Lire son banc à l'écran** (tranche 2) : la feuille d'un soir ordinaire ne montre toujours pas ton banc ; la porte, l'échange, la marche qui s'allume, la fin de run.
- [ ] À juger par JP à l'essai : la feuille du duel se lit-elle d'un coup d'œil, sans rien à décider ?
