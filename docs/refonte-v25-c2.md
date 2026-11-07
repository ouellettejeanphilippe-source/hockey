# V25 · C2 — Le robot qui lit la banque : l'extrait du devis

L'extrait de `docs/refonte-v25.md` (§ 4 C, § 5, § 9, la tranche 7) pour **C2** (6 nov. 2026 ; JP : *continue the new version*). C1 a livré la banque des quarante histoires à trois moments ; le robot attentif ne la lisait qu'au lundi. C2 la lui apprend aux trois moments, donne à la run la mémoire que la règle promettait (« jamais la même histoire sur le même joueur » ne tenait que dans une saison), et pose les deux juges : `mesure_rythme` étendu et le critère de run de `check_profondeur`.

## 1. Ce que JP a dit

JP (5 nov.) : *la profondeur se juge sur la run* (la revue, q. 2 : la première Coupe de l'attentif deux runs avant celle du robot d'avant) ; V23 : *tout roguelike, on finit par être pété lors de la run gagnante*. Le devis (§ 4 C) : *le robot attentif apprend la banque dans la même tranche : sinon le juge mesure son ignorance*.

## 2. Ce que le joueur ressent

Rien de neuf à l'écran, sauf une promesse enfin tenue : à la troisième saison d'une run, la voix ne revient pas parler du même gars pour la même histoire qu'à la première. Le reste de C2 est pour les juges : un robot qui lit ce que le joueur lit, pour que la profondeur mesurée soit celle du jeu.

## 3. Les règles du jeu

- **La mémoire de la run** (`memoireDeLaRun`, js/histoires.js) : à la fin d'une saison, les histoires sorties (lundi, gros match, ronde) passent à la run, `{ cle, joueur, avant: true }`, dans `G.rogue.histoires` (js/rogue-jeu.js `continuerRun`). L'écran de la saison (`ctx.rogue.histoires`, js/banc.js) et celui des séries (`histoiresDeLaRun`, js/bilan.js) les passent au tirage. Une entrée `avant` ne compte **que** pour le joueur : le repos, `SORTIES_MAX`, la rare d'une saison et « jamais deux fois au gros match ou à la ronde » se comptent à la saison (`auRepos`, `tirer`).
- **Les sorties d'une saison se lisent d'une façon** (`sortiesDe`, js/histoires.js) : l'écran du lundi, celui de la ronde et les robots les tirent des décisions, une ronde datée après la saison (`N` + la ronde).
- **Le robot lit la banque aux trois moments** (scripts/lib/cartes_robot.mjs) : `histoireDuRobot` tire comme l'écran, sur les mêmes faits (`faitsDe`) et les mêmes sorties, mémoire comprise, et répond — le distrait au hasard, le robot d'avant la première carte, l'attentif celle qui rend le plus ; la décision est celle de l'écran (`decisionDHistoire`). Au lundi et au matin d'un gros match (`grosAnnonces`, le jour même : `lundiDuRobot`), au matin du premier match d'une ronde (`rondeDuRobot`, appelé par scripts/lib/rogue_sim.mjs avant chaque match de séries, une fois par ronde). L'échange d'un joueur nommé reste au gérant.
- **L'attentif pèse les canaux du club** d'un gros match ou d'une ronde (`lireLesCanaux`, scripts/lib/rogue_sim.mjs : les buts nets d'un soir avec eux moins sans, en victoires à `V_PAR_BUT`, sur leur durée), comme il pesait déjà ce qui va au joueur nommé (`lireLeJoueur`) ; `ROBOT_SAUF=histoires` lui retire les deux lectures.

## 4. Les chiffres

- Les lundis : `CHANCE_HISTOIRE` 0,55 comme avant, et jamais plus de `DISETTE_MAX` (3) lundis de suite sans histoire, le suivant en a une (53 % des lundis au lieu de 50 % ; six lundis vides de suite laissaient un premier quart sans histoire une saison sur cent).
- Le rythme (`mesure_rythme`, l'attentif, huit clubs, trois saisons de suite) : aucun trou de plus de 10 matchs en médiane, un quart des saisons au plus au-dessus, un moment par quart ; **neuf** : une histoire au moins dans chaque quart de chaque saison, et aucune histoire revue sur le même joueur dans la run de trois saisons d'un club ; les histoires par moment se disent.
- La profondeur (`check_profondeur`) : **neuf**, la médiane des premières Coupes du robot d'avant moins celle de l'attentif, au moins `AVANCE_RUNS` (2 ; plage sûre 1 à 3, § 9 du devis) ; la première Coupe de l'attentif entre la run 3 et la run 8, comme avant.
- Aucun match ne change : le moteur, la banque et le tirage d'une saison sans mémoire rendent la même chose (`check_histoires`, `check_empreinte`).

## 5. Les cas limites

- La première saison d'une run : la mémoire est vide, le tirage est celui de C1.
- Une vieille partie : `G.rogue.histoires` manque, lue `[]` ; les clés de sauvegarde ne bougent pas.
- Un joueur parti puis revenu d'une saison à l'autre (gardé, loto) : sa clé est la même, l'histoire ne revient pas sur lui.
- Une ronde : le robot la demande au premier match de sa série, jamais après une élimination (`S.k` à 0, sa série en cours).
- Une option qui coûte des jetons que la caisse n'a pas : le robot ne la prend pas ; une histoire dont aucune option n'est jouable ne sort pas chez lui.

## 6. Ce qu'il touche

- Le jeu : `js/histoires.js` (et `DISETTE_MAX`, la disette de lundis bornée), `js/saison.js`, `js/rogue-jeu.js`, `js/banc.js`, `js/bilan.js`.
- Les robots et les juges : `scripts/lib/cartes_robot.mjs`, `scripts/lib/rogue_sim.mjs`, `scripts/mesure_rythme.mjs`, `scripts/check_profondeur.mjs`, `scripts/check_histoires.mjs`.
- Les règles et les docs : `.claude/rules/rogue.md`, `.claude/rules/tests.md`, `docs/structure-detaillee.md`, `LIVRAISON.md`, `docs/journal/2026-11.md`, `docs/decisions.md`.
- Les règles fermes : rogue.md « ne revient jamais sur le même joueur » devient « de toute la run » (c'était la promesse du commentaire de `auRepos`, que le jeu ne tenait pas) ; rien n'est défait. Les clés de sauvegarde ne bougent jamais : `histoires` est une clé neuve de `G.rogue`.

## 7. Ce qui part

Presque rien, et c'est dit : C2 est la tranche de mesure du devis, pas une refonte du jeu (CLAUDE.md, « Rien à faire partir ? »). Partent les deux lectures en double des sorties dans js/saison.js (le lundi et la ronde ; `sortiesDe` les remplace) et, chez le robot, son tirage du lundi écrit à part (`histoireDuRobot` le remplace pour les trois moments). `check_refonte` ne se lance pas sur cette tranche : il n'a pas de nom à chercher.

### Ce qui reste

- Le tirage (`tirer`), la banque, les faits, la porte et la promesse de C1, tels quels.
- `lireLeJoueur` et `valeurDeReponse` : l'attentif les gardait ; ils lisent maintenant aussi les canaux.

## 8. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| `AVANCE_RUNS` (check_profondeur) | 2 | 1 à 3 | sous 1, lire ses choix ne change pas la carrière ; au-dessus de 3, le robot d'avant ne gagne jamais |
| `DISETTE_MAX` (js/histoires.js) | 3 lundis | 2 à 4 | au-dessus, un quart peut passer sans histoire ; en dessous, le lundi sans histoire n'existe plus |
| Le trou du rythme (`TROU_MAX`) | 10 matchs | 8 à 12 | au-dessus, la saison est un couloir ; en dessous, le soir ordinaire n'existe plus |

## 9. Les critères d'acceptation

- [x] La run ne revoit jamais une histoire sur le même joueur d'une saison à l'autre, et la mémoire ne bloque que le joueur — `check_histoires` § 3b.
- [x] Le rythme : aucun trou de plus de 10 matchs, une histoire par quart, aucune histoire revue sur le même joueur en trois saisons — `mesure_rythme` (étendu) : trou médian 8, 0 quart sans histoire sur 96, aucune redite.
- [x] Jamais plus de `DISETTE_MAX` (3) lundis de suite sans histoire — `check_histoires`.
- [x] La profondeur : la première Coupe de l'attentif deux runs avant celle du robot d'avant, à la run 3 ou plus tard ; le robot lit la banque — `check_profondeur` (le critère de run). **Rouge** au 6 nov. sur deux campagnes (les deux robots aux runs 1 et 4) ; **vert** le 7 nov. sur huit campagnes depuis la #363, sans réglage : l'attentif à la run 6 en médiane, le robot d'avant à 9 ou plus, l'avance médiane de 3 runs (docs/decisions.md, « V25 C2 fermé »).
