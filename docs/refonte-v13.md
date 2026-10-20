# V13 · Le fun : moins de cartes, des décisions qui se sentent

20 octobre 2026. JP : *les matchs importants sont vraiment rendus qu'ils se jouent tout seul* ; *le choix de contre, c'est un bouton que tu pèses, c'est pas un vrai jeu, rends ça plus ludique* ; *ya moyen de faire ça plus à la EHM ?* ; puis *I feel like the cards concept is good on paper, but not working well* — *mon point, c'est que ça marche pas présentement, c'est pas fun*.

## Pourquoi ce n'est pas fun (lu dans le code et dans les mesures)

1. **Une carte ne se sent pas.** Par règle (`check_cartes`), une carte change la forme du match, pas sa force : une commune bouge de ±1 victoire sur une saison. On la joue, rien ne change sous les yeux (« à peine perceptible »).
2. **Trop de sortes, chacune ses règles.** Le deck de match, l'élan, le cahier ; trois places, les permanents, le personnel, les contrats, les modifs posées sur un joueur, les consommables. Chacune sa maison, son moment, sa vente, sa limite : les gérer coûte plus que ce qu'elles rendent.
3. **Les choix sont évidents.** Au duel, chaque intention offre UN geste, et c'est toujours le contre (`reponsesDuDuel`) : on le touche, ou on joue sans. Ailleurs, on joue ce qu'on a, faute de prix. Un choix sans coût n'est pas un choix.
4. **Les cartes doublent un vrai système.** Les systèmes d'une unité, son temps de glace, la consigne, le personnel, les contrats existent déjà dans le moteur ; une carte qui « donne +x tirs » les emballe d'une couche de plus, là où EHM les fait toucher.

## Le principe

**On gère le club, on ne joue pas des cartes.** Ce que les cartes faisaient devient de la gestion qu'on touche directement, à la EHM : les tactiques d'une unité, son temps de glace, les jumelages ; le personnel qu'on engage ; les contrats qu'on négocie. Chaque décision a plusieurs bonnes réponses, chacune son prix en vraies stats de match, et son effet se voit dans la feuille. Le Rogue reste une run (le mandat, les saisons, le prestige, les exigences) ; ses récompenses deviennent des joueurs, du personnel, de l'argent, des déblocages.

## Les tranches

- [x] **V13-1 · Le duel se joue à ton tableau, à la EHM.** Ta réponse à leur intention n'est plus un bouton : c'est ton tableau de la période — le système de chaque trio et de chaque paire, la consigne, et le geste qui déplace un joueur. Le moteur le lit en portes (`lireLeTableau`) : une pleine ou deux demi-portes la contrent ; l'écran dit le verdict à chaque réglage, et le prix de tes changements en vraies stats contre tes Lignes. Fait : les portes et leur lecture, l'écran, la décision qui garde le tableau ; aucune couverture ne vaut le bien joué. Juges : `check_tableau`, `check_duel`, `check_gros`, `essai_rogue`.
- [ ] **V13-1b · L'entracte, la suite.** La feuille de la période jouée plus riche (tirs de l'enclave, mises en échec, qui était sur la glace), le rapport de l'adjoint qui en tire la preuve ; le temps de glace d'une ligne et les jumelages comme réglages (les jumelages seraient la seule mécanique neuve, à juger d'abord).
- [ ] **V13-2 · La main du duel.** Mesurer sur des runs ce qu'elle rend ; selon la mesure, elle devient une poignée de coups forts et rares, ou elle part au profit des réglages.
- [ ] **V13-3 · Les cartes hors du duel.** Mesurer lesquelles se jouent, lesquelles dorment, lesquelles changent la feuille ; ce qui ne se sent pas part, le reste devient de la gestion directe (engager, négocier, un plan d'entraînement).
- [ ] **V13-4 · Les récompenses.** Les packs de cartes cèdent la place aux joueurs, au personnel, à l'argent et aux déblocages.
