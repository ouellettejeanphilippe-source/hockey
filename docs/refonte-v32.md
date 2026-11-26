# V32 · Le club imposé du cartable

Le devis (gabarit : `docs/gabarits/devis.md`). Écrit le 25 nov. 2026, avec les réponses de JP ; codé le même jour, avec la tranche 3 de la V31 (`docs/refonte-v31-3.md`), qui refaisait les mêmes scènes.

## 1. Ce que JP a dit

JP, 25 nov. 2026 : *Aussi, moins de choix de cartes, plus de cartes imposées du cartable.* Puis, à quatre questions : **17 imposés, 6 tours** ; **au hasard de la run** ; **édition Base, plein salaire** ; **l'entraîneur et les deux pièces du départ imposés aussi**. Et, sur les six tours : **de toute la ligue, sous ton budget**.

Le classeur (des cartes du cartable au départ d'une run) était parti à la V28 parce qu'un gros cartable donnait une run plus forte. JP le sait : la question le disait, et il a choisi l'édition Base et le plein salaire.

## 2. Ce que le joueur ressent

*On me donne un club, je le finis.* Une run commençait par 26 écrans de choix (le coach, deux pièces, 23 joueurs). Elle commence par un écran (ton entraîneur, tiré pour toi) et six tours. Les cartes de tes runs d'avant reviennent : ton cartable sert enfin à jouer.

## 3. Les règles du jeu

1. **Le départ** : ton entraîneur est tiré (un seul, de ton cartable d'abord, comme le loto d'avant) ; l'écran montre sa carte, sa règle, sa pièce de départ ; tes crans d'exigence ; « Commencer ».
2. **Ses deux pièces de banc** sont tirées pour toi : la première offerte de chacun des deux tirages d'avant.
3. **Dix-sept joueurs sortent de ton cartable** : dix avants, cinq défenseurs, deux gardiens, dans l'ordre que la graine de la run donne à tes cartes. Une carte ne sort pas si son groupe est plein, si la même personne est déjà là, ou si elle ne tiendrait pas sous le plafond avec les tours qui restent.
4. **Ils arrivent à l'édition Base et à plein salaire.**
5. **Les tours qui restent** (six) : à chacun la roulette sort un vestiaire de toute la ligue ; tu prends qui tient dans le budget du tour. Cinq relances pour tout le repêchage, comme avant.
6. **Un cartable vide ou trop petit** : autant de tours de plus. Une première run repêche ses vingt-trois.
7. **Ta ligue** ne compte aucun club-saison d'où vient un de tes joueurs.
8. Le repêchage te montre ton club tel qu'il est (ses noms par groupe, combien viennent du cartable), ton banc en lignes, et ce qui reste à dépenser.

## 4. Les chiffres

- `RUN.IMPOSES = { F: 10, D: 5, G: 2 }` : 17.
- La garde du plafond : une carte entre si `masse + son salaire ≤ plafond − ESPACE − PLANCHER × (tours qui restent après elle)`.
- Mesuré (2 000 tirages par cartable, les effectifs de fin de 1 à 6 runs du robot bâtisseur) : dix-sept cartes pèsent 53 à 55 M$ en médiane (39 à 69 M$ de 5 à 95 %) pour 86,7 M$ permis. Aucun tirage ne dépasse.
- Mesuré (12 graines, le robot bâtisseur) :

| Le cartable | Les tours | Points | Coupes | Marches du banc au départ |
|---|---|---|---|---|
| vide | 23, bas de l'échelle (avant) | 114,2 | 0 / 12 | 2,3 |
| vide | 23, toute la ligue | 121,9 | 0 / 12 | 2,8 |
| trois runs | 6, bas de l'échelle | 133,3 | 1 / 12 | 2,0 |
| trois runs | 6, toute la ligue | 134,8 | 1 / 12 | 2,1 |

**Ce que la mesure dit, et que JP doit savoir** : même à l'édition Base et à plein salaire, un club imposé fait une vingtaine de points de plus qu'un club repêché dans le bas de l'échelle. Le cartable est fait de joueurs déjà choisis pour leur rapport qualité-prix (ceux des portes surtout). Les Coupes, elles, restent dans la borne (4 à 12 sur 64) : les séries sont le mur.

## 5. Les cas limites

- **Cartable vide** : 23 tours ; le repêchage le dit.
- **Pas de gardien au cartable**, un groupe court : les tours comblent (les minimums par groupe tiennent : `groupeOuvert`).
- **Une run gardée devant ses pièces du départ** (avant ce changement) : ses pièces sont tirées, elle repêche ses vingt-trois.
- **Une run gardée en plein repêchage** : elle continue ; « Tour 7 de 23 ».
- **Les robots** : `jouerLaRun(…, { cartable })` ; sans cartable, vingt-trois tours.
- **Un gardien échangé en cours de run** garde ses victoires chez toi (le juge les comptait seulement chez tes gardiens du jour).

## 6. Ce qu'il touche

`js/run.js`, `js/run-jeu.js`, `js/run-scenes.js`, `js/cartable.js`, `scripts/lib/run_robot.mjs`, `scripts/check_run.mjs`, `scripts/check_scene.mjs`, `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `docs/decisions.md`, `LIVRAISON.md`.

Règles fermes de rogue.md : **« le repêchage de 23, dans des clubs faibles »** (JP, 16 nov. 2026) — **défaite** par JP ; **« rien de ce qu'on achète ne gagne un match »** (V28) — à surveiller : le cartable ne s'achète pas, mais il rend la run plus forte (§ 4).

Les clés de sauvegarde ne bougent pas ; une run gagne `imposes` (les clés tirées) et `rep.debut`.

## 7. Ce qui part

- `scenePieceDuDepart` — les deux écrans où l'on choisissait ses pièces.
- `rn-loto` — le loto de trois coachs.
- La phase des pièces d'une run, et la moitié de la fonction qui la menait.
- Dix-sept tours de repêchage, quand ton cartable les remplit.

Ce qui reste : les pièces offertes (le rival battu, l'élite, le marché) ; le tirage des entraîneurs, à un seul ; le repêchage lui-même.

## 8. Les réglages

| Le réglage | Sa valeur | Sa plage sûre | Au-delà |
|---|---|---|---|
| `IMPOSES` | 10 · 5 · 2 | 0 à 17 au total | plus, il ne reste plus de tour pour bâtir son banc |
| `REPECHAGE.BANDE` | toute la ligue | [0,05 ; 0,4] à [0 ; 1] | — |

## 9. Les critères d'acceptation

- [ ] Une run sans cartable : trois pièces avant le premier tour, vingt-trois tours, vingt-trois joueurs sous le plafond — `check_run`
- [ ] Une run d'un cartable : son repêchage s'ouvre aux six écrans, dix-sept joueurs déjà là — `check_scene`
- [ ] Une run entière au doigt, d'une page vide — `essai_run`
- [ ] Le robot bâtisseur gagne la Coupe 4 à 12 fois sur 64 — `mesure_run`
- [ ] À juger par JP à l'essai : six tours suffisent à faire d'un club imposé le sien.
