# V33 · La carrière : une première run dure, le contrôle qui s'achète

Le devis (gabarit : `docs/gabarits/devis.md`). Écrit le 26 nov. 2026 avec les réponses de JP. **Rien n'est codé** ; il reste à le faire relire (`/revue-design`) et à mesurer ses chiffres.

## 1. Ce que JP a dit

JP, 26 nov. 2026 : *La première saison, ça devrait être peu de chances de gagner, c'est les upgrades/ajustements permanents qui mènent éventuellement vers la coupe, mais pas aisément.* Puis : la première run **plus dure encore** ; des améliorations achetées en médailles, *pas plus de plafonds, mais d'autres types d'upgrade qui ne rendent pas meilleurs, mais permettent un meilleur contrôle, donc meilleur* ; une vraie chance de Coupe après **cinq runs**.

Ses choix : verrouiller des cartes de son cartable, choisir son entraîneur, choisir une pièce de banc, refaire le tirage une fois ; un quatrième joueur tendu, des relances gagnées, voir avant de choisir. La première run se durcit par **moins de contrôle au départ**.

Ça défait une règle de la V28 : « rien de ce qu'on achète ne gagne un match » (les médailles n'achetaient que de la variété). La question le disait.

## 2. Ce que le joueur ressent

*Ma première run, je subis ; à la cinquième, je décide.* Le hasard ne change pas, c'est ma prise sur lui qui grandit. Le pic : la run où un tirage verrouillé, un entraîneur choisi et une relance gardée font enfin tenir le club jusqu'à la Coupe.

## 3. Les règles du jeu

**La première run, sans rien d'acheté** : ton entraîneur, ses deux pièces et ton club sont tirés, sans choix ; **aucune relance** au repêchage (cinq aujourd'hui) ; **deux affiches par quart** (trois aujourd'hui) ; trois joueurs tendus après un gros match ; rien ne se voit d'avance.

**Huit améliorations**, au Club, payées en médailles, gardées pour toujours. Chacune a ses crans ; aucune n'ajoute de plafond, de jetons ni de force.

| L'amélioration | Ses crans | Ce qu'elle rend |
|---|---|---|
| **Les relances** | 1 à 5 relances de repêchage ; puis une relance gratuite des joueurs tendus par quart | changer un mauvais tirage |
| **L'affiche** | la troisième affiche par quart | plus de gros matchs à poser |
| **Refaire le tirage** | une fois par run, au départ | retirer son club |
| **Verrouiller** | 1, 2, 3 cartes de son cartable | elles sont imposées à coup sûr |
| **L'entraîneur** | un parmi deux, un parmi trois | choisir sa philosophie |
| **La pièce** | une pièce du départ parmi trois | choisir ce qu'on bâtit |
| **Le quatrième joueur** | quatre tendus au lieu de trois | plus de choix après un gros match |
| **Voir d'avance** | le jeu du rival et de l'élite au bureau ; le niveau des joueurs qu'un club tendrait, à la feuille du soir | poser ses affiches en connaissance |

(L'affiche est rendue, pas ajoutée : JP n'a pas voulu d'une quatrième.)

## 4. Les chiffres

À mesurer avant le code, avec les robots (`mesure_run`, et une mesure de carrière à écrire : cinq runs de suite, les médailles dépensées par un robot acheteur) :

- **La cible d'une première run** : les séries une fois sur deux (84 % aujourd'hui), la Coupe moins d'une fois sur 64 (2 aujourd'hui).
- **La cible d'une cinquième run** : la Coupe une fois sur quatre.
- **Les médailles** : une run en laisse 70 à 85 au robot bâtisseur ; cinq runs, environ 400. Le total des crans doit coûter de cet ordre.
- **L'inconnue** : ce que le contrôle seul vaut en points. Si huit améliorations de contrôle ne mènent pas d'une Coupe sur 64 à une sur quatre, le devis le dira à JP avec le chiffre, avant d'ajouter quoi que ce soit.

## 5. Les cas limites

- Une carrière commencée avant la V33 : ses médailles sont là ; rien n'est acheté d'office.
- Un cartable trop petit pour verrouiller trois cartes ; une carte verrouillée qui ne tient pas sous le plafond.
- Les exigences (les crans après une Coupe) restent ; les philosophies, l'écusson et les couleurs aussi.
- Les robots : un robot « acheteur » pour la mesure de carrière.

## 6. Ce qu'il touche

`js/rogue.js` (la méta), `js/run.js`, `js/run-jeu.js`, `js/run-scenes.js` (le Club, le départ, le repêchage, les trois joueurs), `style.css`, `scripts/lib/run_robot.mjs`, `scripts/mesure_run.mjs`, `scripts/check_meta.mjs`, `scripts/check_run.mjs`, `scripts/check_scene.mjs`, `.claude/rules/rogue.md`, `.claude/rules/interface.md`, `.claude/rules/vocabulaire.md`, `docs/decisions.md`, `LIVRAISON.md`.

Règles fermes : **« rien de ce qu'on achète ne gagne un match »** (V28) — **défaite** par JP ; **« le Club ne s'ouvre qu'entre deux runs »** — respectée ; **« le malin gagne la Coupe 4 à 12 fois sur 64 »** (`mesure_run`) — **changée** : la borne devient celle d'une première run, et une seconde borne juge la cinquième.

Les clés de sauvegarde ne bougent pas ; la méta gagne ses améliorations.

## 7. Ce qui part

À nommer quand l'inventaire du Club sera fait : la page « Variété » comme seule dépense, la borne unique des Coupes dans `mesure_run`, les cinq relances et les trois affiches données d'office.

## 8. Les réglages

Les prix et les crans (§ 4), à poser à JP après mesure.

## 9. Les critères d'acceptation

- [ ] Une première run sans rien : les séries 40 à 60 % du temps, la Coupe au plus 1 fois sur 64 — `mesure_run`
- [ ] Une cinquième run d'un robot acheteur : la Coupe 15 à 35 % du temps — la mesure de carrière
- [ ] Chaque amélioration s'achète, se garde, et change ce qu'elle dit — `check_meta`
- [ ] Le Club montre ce que chaque cran rend et ce qu'il coûte ; le bouton qui dépense n'a jamais le focus d'office — `check_scene`
- [ ] À juger par JP à l'essai : la première run donne envie de la deuxième.

## 10. À poser à JP

- Les prix, après mesure.
- Si le contrôle seul ne suffit pas à mener à la Coupe : quoi d'autre ?

## 11. Ce que la mesure a dit, et ce que JP a tranché (26 nov. 2026)

Le robot bâtisseur, 32 saisons par réglage, les mêmes graines (scratch `carriere.mjs` : le contrôle passé à `creerLaRun`).

| Réglage | Points | Rang | Séries | Coupes | Congédié |
|---|---|---|---|---|---|
| Première run, 0 relance, 2 affiches, cartable vide | 114,2 | 6,2 | 27 | 1 | 3 |
| La même, un cartable plein | 105,5 | 8,6 | 30 | 0 | 2 |
| Plein contrôle (5 relances, 3 affiches, 4 joueurs tendus, 3 cartes verrouillées) | 128,8 | 1,9 | 31 | 0 | 1 |
| Première run, 8 M$ retenus | 106,3 | 7,4 | 28 | 2 | 4 |
| 14 M$ retenus | 105,3 | 8,7 | 27 | 0 | 5 |
| 20 M$ retenus | 95,1 | 11,9 | 19 | 0 | 12 |
| 20 M$ retenus, trois cœurs | 98,7 | 12,5 | 23 | 0 | 2 |

- **Le contrôle gagne la saison, pas les séries** : 129 points et le 2e rang, aucune Coupe sur 32. Posé à JP : *viser moins haut* — le contrôle seul, la Coupe reste rare. Le critère « une Coupe sur quatre à la cinquième run » part.
- **Retirer le contrôle ne suffit pas à durcir la première run** (les séries 27 fois sur 32). Posé à JP : *un repêchage plus pauvre*, **20 M$ de moins, proprio plus patient** (trois cœurs à la première run seulement), et le budget revient par **une amélioration à part**, en quatre marches de 5 M$. C'est de la force achetée : JP le sait, la question le disait. Mesuré : à trois cœurs les séries remontent à 23 sur 32 (72 %), au-dessus de la cible d'une sur deux — dit à JP.
- **Les prix** : *une douzaine de runs* pour tout acheter (environ 900 médailles).

### La tranche 1, codée

`controleDe` (js/run.js) : relances, affiches, offerts, verrous, retenue, cœurs, portés par la run (`R.regles.controle`). `AMELIORATIONS`, `acheterUneAmelioration`, `controleDuMeta` (js/rogue.js) : le budget (40 · 60 · 80 · 100), les relances (15 · 20 · 25 · 30 · 40), la troisième affiche (60), le quatrième joueur tendu (80) — 470 médailles. La page « Contrôle » du Club (`pageControle`), la première ouverte.

### Ce qui reste (tranche 2, environ 430 médailles)

Verrouiller des cartes (le cœur le lit déjà : `verrous` ; il manque le geste à l'Album), choisir son entraîneur parmi deux ou trois, une pièce de départ parmi trois, refaire le tirage une fois, voir d'avance, la relance gratuite des joueurs tendus ; `mesure_run` qui juge une première run ; le robot acheteur.

### Les cases actives (JP, 26 nov. 2026 : *voir les upgrades comme des skill trees, comme le Witcher 3, avec un max d'upgrades en même temps*)

Trois questions posées, trois réponses : les cases **s'ouvrent avec les runs** (deux d'abord, une de plus aux runs 3, 5, 8 et 12, six au bout : `CASES`) ; **pas de branches, une liste** ; **le budget prend une case** comme les autres. Ce qu'on achète reste ; une run ne porte que ce qui est actif (`activesDe`, `activerUneAmelioration`, `casesDe`). Achetée, une amélioration s'active d'elle-même s'il reste une case. Avec quatre améliorations aujourd'hui, la limite ne mord qu'aux deux premières runs ; elle mordra pour vrai avec celles de la tranche 2 (dix en tout pour six cases). Le « plein contrôle » mesuré plus haut (tout actif à la fois) n'existe donc plus tel quel.

## 12. La tranche 2 (26 nov. 2026)

JP : *Continuer* ; les prix « comme proposés » ; la première run à 25 M$ retenus.

- **Mesuré, 25 M$ retenus** (32 saisons, trois cœurs) : les séries 22 fois sur 32 (98 points, congédié 4), contre 23 à 20 M$ — la même chose, au bruit près ; avec un cartable, 27. Retenir plus ne ramène pas la première run à une sur deux : **gardé à 20 M$** et reposé à JP.
- **Codé** : choisir son entraîneur (le loto du départ en tire 2, puis 3 : `controleDuMeta(m).coachs`) ; une pièce de départ parmi trois (`piecesDuDepart`, `creerLaRun({ piece })`) ; refaire le tirage une fois, avant le premier tour (`peutRetirer`, la coquille recrée la run avec `retire`, le cartable se retire sous un autre sel) ; verrouiller une, deux, trois cartes à l'Album (`verrouillerUneCarte`, `verrousDe` ; la run les impose d'abord) ; voir d'avance (à la feuille du soir, le plus haut niveau que ce club te tendrait : `ceQuIlTendrait`) ; la sixième marche des relances (une relance gratuite des joueurs tendus à chaque quart : `relanceOfferte`).
- **Les prix** : verrouiller 30 · 45 · 60, l'entraîneur 40 · 60, la pièce 50, le tirage 50, voir d'avance 40, la sixième relance 60. **Le compte juste** : la tranche 1 coûte 550 médailles, pas 470 comme dit à JP ; tout coûte 985.
- **Pas encore** : `mesure_run` ne juge pas une première run ; aucun robot n'achète ni ne choisit au départ.

## 13. La borne de la première run (27 nov. 2026)

JP, sur les chiffres (72 % de séries, aucune Coupe ; 25 M$ n'y changeaient rien) : *garder 72 %*. La borne s'écrit dans `mesure_run`, à la main : `PREMIERE=1 GRAINES=64 FILS=3 node scripts/mesure_run.mjs` — le malin, avec le contrôle d'une méta vide (`controleDuMeta({})`) et un cartable vide, fait les séries 55 à 85 % du temps et gagne la Coupe au plus 2 fois sur 64 (compatible à deux écarts-types). Pas au CI : il est déjà près de sa limite de temps.

## 14. Les premières runs, « fucking tough » (27 nov. 2026)

JP : *première run, ça doit être fucking tough faire les séries* ; la cible, *une fois sur quatre* ; le levier, *faire les séries, c'est les faire, faque juste faire qu'on finit plus bas* ; puis, devant les congédiements, *club poche premières runs, mais proprio lousse*.

| Première run (32 saisons, sauf mention) | Séries | Congédié | Rang moyen |
|---|---|---|---|
| Avant (20 M$ retenus, trois cœurs), 64 saisons | 48 / 64 | 4 | 10,8e |
| Ligue +4 éditions | 11 | 16 | 17,6e |
| Ligue +6 éditions | 9 | 19 | 20,5e |
| +6, le proprio attend comme pour un club 10 rangs plus bas | 11 | 14 | 20,5e |
| +6, un objectif sur trois suffit au proprio | 11 | 5 | 20,5e |
| +7, un objectif sur trois | 7 | 4 | 21,6e |
| +8, un objectif sur trois | 5 | 2 | 23,7e |
| **+7, un objectif sur trois, 64 saisons** | **14 / 64** | **11** | **22,6e** |

Un proprio qui attend moins de points ne change presque rien : ce qu'un club poche manque, c'est le rival et la place. **Retenu** : les adversaires portent `LIGUE_DURCIE` étapes de plus (7, 5, 3, 1 aux quatre premières runs ; js/rogue.js), et tant qu'elle est durcie le proprio se contente d'un objectif sur trois (`tenir`, js/run.js `faireLeBilan`). L'étalement sur quatre runs est de moi (JP : *premières runs*) : la deuxième run ne retombe pas d'un coup à 75 % de séries. Le départ, le proprio du quart et la page Contrôle le disent. La borne : séries 10 à 40 %, congédié au plus une fois sur quatre, la Coupe au plus 2 sur 64 (`PREMIERE=1 mesure_run`).

## 15. Un club poche qui grandit (27 nov. 2026, remplace le § 14)

JP a corrigé le § 14 en quatre messages : *la ligue devrait pas être plus forte, mais le club plus poche* ; *club à chier, pas de budget* ; *tu compliques vraiment le côté roguelike* ; *commencer un club poche pis débloquer tranquillement joueurs et upgrades sans devenir plus fort qu'un excellent club normal ; le max possible, le meilleur club de l'histoire*.

**La règle, simple** : la ligue ne change jamais. Ton club part sans le sou — 50 M$ de moins au repêchage (`RETENUE`) — et l'amélioration « budget » le rend en cinq marches de 10 M$ (30 · 50 · 70 · 90 · 110). Tant qu'il n'est pas racheté, le proprio se contente d'un objectif sur trois. Les joueurs viennent du cartable, qui grandit run après run. Tout racheté, c'est le plafond plein : le club d'un excellent DG.

| Première run, proprio lousse (32 saisons) | Séries | Rang moyen | Congédié |
|---|---|---|---|
| 40 M$ de moins | 14 | 18,7e | 5 |
| **50 M$ de moins** | **10** | **22,1e** | **6** |
| 60 M$ de moins | 3 | 27,6e | 10 |
| 70 M$ de moins | 0 | 28,8e | 14 |
| 20 M$, repêcher dans le tiers faible des clubs | 14 | 16,3e | 0 |
| Le repêchage d'expansion (7 avants, 3 défenseurs, 1 gardien protégés) | 2 | 26,8e | 9 |

**Partis** : `LIGUE_DURCIE` et les étapes de plus du contrôle, la bande et la rareté réglables, le repêchage d'expansion. La #431 (la ligue plus forte) reste en brouillon, à fermer.
