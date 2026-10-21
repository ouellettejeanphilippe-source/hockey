# V14 — Le personnel qui monte

JP, 21 oct. 2026, après la V13-3 (les adjoints du coach à chaises, montés en jetons) : *j'aime pas l'interface des coachs, ni le système ; je le vois comme un genre de système de materia, mais avec des cartes*. Puis, devant une première maquette trop littérale (des gemmes dans une crosse) : *que le personnel puisse être des cartes qui gagnent des niveaux, ont leurs forces, faiblesses, mais un look plus jeu de gestion* ; et *faut pas me prendre littéral : on parle de mécaniques de jeu, mais faut adapter à nos besoins de jeu de gestion et de gacha*.

Ce qu'on garde de l'idée : une pièce qu'on place, qui grandit à l'usage, avec un prix à elle, et qu'on retrouve d'une partie à l'autre. Ce qu'on en fait, chez nous : des cartes de personnel qui montent. Une première version leur donnait des noms ; JP : *je sais pas s'ils ont besoin de nom, ça peut être des cartes selon leur style*. Elles restent des cartes, nommées par leur style.

## Les règles

- **Des cartes, par leur style.** Chaque poste a sa carte, nommée par ce qu'elle fait : « Le gardien du fort », « Le crieur du banc ».
- **Sa force et son défaut.** Les canaux de sa carte qui aident sont sa force (en vert) ; ceux qui coûtent, son défaut (en rouge). En vraies stats de match, jamais en note (`forceEtFaiblesse`, js/echelons.js ; `canalBon`, js/banque.js).
- **Les échelons, la gestion.** De 1 à 5. Une personne monte en **matchs à ton service** : le 2e échelon à 10 matchs, le 3e à 25, le 4e à 45, le 5e à 70 (`MATCHS_ECHELON`). Ils se comptent sur toute la run, d'une saison à l'autre (`reportDuPersonnel`). Quelqu'un de la couleur de ton coach apprend deux fois plus vite.
- **Le choix d'un échelon.** Chaque échelon atteint est un choix d'À faire, mis en scène par l'entraîneur (`sceneDeLEchelon`), et aussi dans la fiche de la personne : **pousser sa force** (l'écart de ses bons canaux grandit d'un quart, `POUSSEE`) ou **corriger son défaut** (ses mauvais reviennent de 40 % vers zéro, `CORRECTION`). Quelqu'un sans défaut (l'argent, le Comptable) ne fait que pousser.
- **Les doublons, le gacha.** La première copie tirée d'un pack ouvre deux échelons ; chaque doublon en ouvre un de plus, jusqu'à cinq (`ouvertsDe`, `COPIES_MAX` ; js/rogue.js `recevoirPermanents`). Les copies restent au méta, d'une run à l'autre ; les échelons, eux, se regagnent à chaque run. Un doublon de trop, ses cinq échelons ouverts, se revend comme avant.
- **Rien de neuf dans le moteur.** Une personne est une décision `patron` qui porte ses chiffres à son échelon ; monter, c'est une décision de plus, au jour dit, qui la remplace à son poste. Une saison se rejoue pareil.

## Ce qui part

Les adjoints du coach de la V13-3 : les chaises, les échelons payés en jetons, le banc lié au coach (js/adjoints.js, `check_adjoints`). Les deux postes de la couleur d'un coach redeviennent du personnel comme les autres, qui sortent des packs, et que la couleur du coach fait apprendre plus vite.

## L'écran

Bureau › Entraîneur › Ton personnel : une ligne de gestion par poste. On y voit l'icône de la carte et celle du poste, son style, le poste et son moment, et la force et le défaut en une ligne. À droite : l'échelon, ses cinq cases (les fermées en pointillé) et la barre des matchs à ton service. La ligne se déplie sur la fiche : le style, la force et le défaut entiers, ce qui manque pour l'échelon suivant, les choix déjà faits, et les deux boutons quand un échelon est atteint. La maquette : https://claude.ai/artifact/DyL4NTuSjYat2rbU9KSHTN.

## Les juges

- `check_personnel` (nouveau) :
  - les chiffres de chaque échelon ;
  - les échelons, les doublons, le report ;
  - en paires : quatre poussées grandissent la force, quatre corrections font fondre le défaut.
- `check_clarte` : la règle, ses chiffres lus des constantes, et la scène.
- `essai_rogue` : chaque carte en poste et ses cinq échelons, chez l'entraîneur.
- `check_profondeur` : le robot attentif choisit ses échelons, le distrait au hasard.

## Ce qui reste

- **V14b.** Le marché du personnel : les candidats qu'on compare à la personne en poste, et peut-être un salaire. On le mesure avant de le mettre au jeu.
- **V14c.** Les places et l'équipement : est-ce qu'ils deviennent aussi des pièces qui grandissent ? On attend de voir le personnel en jeu.
