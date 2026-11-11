# V28, tranches 2 et 3 : la run en carte dans le vrai jeu

L'extrait du devis `docs/refonte-v28.md` pour ses tranches 2 (« Un acte ») et 3 (« La run »), livrées ensemble le 11 nov. 2026. JP, 10 nov. : *fais tout je suis tanné des maquettes* — les dix-sept écrans de `docs/maquettes/v28-ecrans.html` font foi, et le code les reproduit.

## Ce que le joueur voit

« Le Rogue neuf » s'ouvre du menu, à côté de l'ancien Rogue (gelé, il part à la tranche 4). Une run entière se joue : ton coach parmi trois, le camp (trois fois trois portes), trois actes de cinq matchs et un rival, puis des séries en 3 de 5. Une scène plein écran à la fois, sur un plan fixe de 390 × 844 mis à l'échelle de l'écran : ni page qui défile, ni en-tête de site, ni onglets. La run se garde à chaque geste et reprend où elle était.

## Ce qui est neuf

- **`js/run.js`** — le cœur, pur, partagé par le jeu et les robots : l'état de la run (un objet JSON, `R`), la séance (`S`), les phases, la carte de l'acte, les portes, le plafond, les matchs isolés du simulateur, le marché, le vestiaire, les histoires, les séries, la fin. Il ne touche ni au DOM ni au stockage.
- **`js/run-scenes.js`** — les scènes, des fonctions pures `(S, V) → HTML` : le départ, la carte, le rival annoncé, la feuille du soir, le duel, le match en temps forts, les portes, la porte ouverte, l'échange, les Lignes, le banc, le marché, le vestiaire, l'histoire, la fin d'acte, la pièce gagnée, les séries, la fin, la pause. Les cartes sont celles du jeu, telles quelles (`cartonDe`, `carteHtml`, `carteDePiece`, `pochetteHtml`).
- **`js/run-jeu.js`** — la coquille : `#runModal`, l'échelle, la sauvegarde (`cap82_run`), les gestes (`data-a`), le rythme des temps forts, la chance de la feuille du soir calculée par tranches.
- **style.css, section « 9d. LE ROGUE NEUF »** — les classes `rn-*` et leurs jetons de couleur.
- **Les robots et les juges** : `scripts/lib/run_robot.mjs` (premier, le chiffre, le malin : ils jouent par les fonctions de `js/run.js`, jamais une copie), `scripts/mesure_run.mjs` (réécrit), `scripts/check_run.mjs`, `scripts/check_neuf.mjs`, `scripts/check_scene.mjs`, `scripts/essai_run.mjs`, `scripts/lib/devis.mjs`.

## Ce qui change dans l'existant

- `js/sim.js` : `simulerGrosMatch` prend `frais` (faux : seul l'adversaire arrive reposé ; ton club garde ses jambes et son infirmerie d'un match à l'autre). Le moteur ne bouge pas : l'empreinte est la même.
- `js/pronostic.js` : `chanceDUnSoir`, la chance d'un match isolé, sur des dés tenus à l'écart.
- `js/histoires.js` : `tirer` prend `sansRythme` et `permis` (une case d'histoire tire dans le pool du lundi, sans son rythme, parmi ce que la run sait jouer).
- `js/actes.js` : `dominanteDe` exportée.
- `js/menu.js`, `js/game.js`, `js/manette.js`, `sw.js`, `js/version.js` : le lien du menu, le retour, la manette, la coquille hors ligne, la version 3.4.0.

## Ce qui part

Rien à cette tranche : le neuf vit à côté. Les 56 noms du § 8 partent d'un coup à la tranche 4, et `check_refonte` juge la somme. `check_neuf` garantit d'ici là qu'aucun module `run*` ne s'appuie sur eux.

## Ce que les mesures ont changé au devis

Le cœur neuf joue le vrai moteur d'un match à l'autre (les pièces du banc jouent à leur condition, les jambes et les blessures suivent). Il a fallu régler de nouveau, sur 128 graines :

- **Le salaire de la run** (`prixDe`) : le rang du salaire d'un joueur parmi les réguliers de sa saison, reporté sur l'échelle d'aujourd'hui (`ECHELLE`, les saisons 2021-22 à 2024-25). Les échelles de salaires diffèrent trop d'une époque à l'autre (médiane de 0,9 M$ avant 1989, 3,5 M$ dans les années 2020) : sans ça, le malin gagnait 47 % des runs des années 2000 et aucune des années 2020.
- **Le départ au vrai plafond** : une masse de 91,5 M$ sous un plafond de 95,5 M$.
- **Toutes les années ensemble** (JP, 11 nov. : *Je veux garder l'aspect toutes les années ensemble*) : le monde d'une run couvre les 55 saisons finies des données, 1 366 clubs classés par leur force. D'abord essayée dans une seule décennie à vrais contrats (1990 à 2020), la run mêle maintenant les époques : le salaire de la run les met sur une seule échelle. Les 55 saisons se chargent à l'ouverture (3 Mo la première fois, gardés ensuite) ; les forces des clubs se gardent d'une visite à l'autre (`cap82_run_monde`, un cache) : 2,4 s à l'ouverture sur un processeur de téléphone simulé, 5 s sans.
- **Des clubs plus forts** : `ETAPES` passe de 0 · 1 · 2 · 4 à **1 · 2 · 3 · 7** étapes d'édition (actes I, II, III, séries). `RACHAT` 0,5 (la décision de JP) et `DECALAGE` 0,25 ne bougent pas.
- **Aucune franchise deux fois** sur la carte d'un acte ; **les trios se rangent seuls** du plus fort au moins fort après chaque changement (l'ordre n'est pas un choix, la tranche 0 l'a mesuré ; la composition en est un).

| 128 graines, toutes les années | Malin | Chiffre | Premier |
|---|---|---|---|
| Coupes | 14 (7 sur 64) | 11 | 0 |
| Cibles tenues | 61 % | 53 % | 29 % |

La première Coupe du malin tombe à sa sixième run en médiane (JP : pas avant la troisième).

**Ouvert : *tu peux exploser le jeu*.** Le devis demande qu'une run du malin sur dix joue son acte III à 75 % de chance moyenne ou plus. Mesuré : 8 runs sur 128 (6 %). `mesure_run` l'imprime sans le juger ; le critère reste ouvert au devis, avec ce qui a été essayé (docs/decisions.md).

## Ce qui s'écarte des maquettes, et pourquoi

- **L'échange** a un rang « Qui sort » (les joueurs de ton groupe, du plus faible au plus fort, ceux qui ne passent pas sous le plafond grisés) à la place de « ce que ça change à ton club » : la tranche 0 a mesuré qu'une signature vaut ≈ 2 points de chance, sous le bruit ; la montrer en chiffre aurait menti.
- **La pochette Époque** tire un attaquant (le choix du poste viendra avec la méta).
- **Le banc du match** dit ses pièces en deux lignes sous lui, pas en étiquette sur la carte (deux étiquettes voisines se recouvraient).

## Quatre défauts trouvés par les juges, corrigés

- **Une blessure datée** : le moteur datait chaque blessure du premier match (un club rebâti ne compte pas ses matchs). `conclure` la date en matchs de la run ; les histoires d'infirmerie se lisent enfin.
- **Une run relue** : un joueur signé chez le club affronté était confondu avec le tien dans les vieilles feuilles, et l'histoire d'une case changeait après avoir quitté le jeu. Le journal garde ton côté de chaque feuille, les tirs du dernier match et le dossier des blessures ; `check_run` relit chaque case d'histoire.
- **Les tirs de barrage** : le pointage final de la scène vient de la feuille (4-5, pas 4-4) ; `essai_run` compare chaque pointage vu à celui que la run garde.
- **Une classe en double** (trouvé par le smoke, au CI) : la racine de la run s'appelait `rn`, le nom d'une rangée du bilan du 82-0 (`.rrow .rn`), que son style étirait en plein écran. Elle s'appelle `rn-racine`.

## Les critères, et ce qui les prouve

| Critère (§ 10) | Juge | État |
|---|---|---|
| La run : trois actes, la cible et les cœurs recomptés, un rival par acte, trois portes, personne deux fois, le plafond tenu | `check_run` (dans `tout.mjs`) | vert |
| Aucune ligue jouée en coulisse ; le neuf ne s'appuie pas sur l'ancien | `check_neuf` (dans `tout.mjs`) | vert |
| Lire paie, sans gagner d'office ; la première Coupe | `mesure_run` (en CI, 64 graines) | vert |
| Tu peux exploser le jeu (une run sur dix à 75 % à l'acte III) | `mesure_run`, imprimé | **ouvert** : 6 % |
| Une scène, jamais une page : rien ne défile, le HUD fixe, les cibles de 44 | `check_scene` (en CI) | vert |
| Neuf touchers par semaine gagnée ; le match vu est le match joué ; la reprise ; les médailles une fois | `essai_run` (en CI) | vert, 6 touchers |
| Le moteur ne bouge pas | `check_empreinte`, `check_feuilles`, `check_graine` | le CI |
| Le banc remesuré sur un acte de six matchs | `check_pouvoirs` | **à la tranche 4** : sa durée d'acte (27) est celle de l'ancien Rogue, encore en jeu |
| La porte 2 et l'essai au téléphone | JP | à juger |

## Ce qui reste

- **4 · Le remplacement** : « Le Rogue neuf » devient le Rogue ; les 56 noms du § 8 partent ; les règles `.claude/rules/rogue.md`, `interface.md` et `vocabulaire.md` se réécrivent ; les vieilles parties versent leurs médailles ; `check_pouvoirs` passe à six matchs.
- **5 · La méta** : la variété en médailles, les exigences sur les leviers neufs, les galons à l'échelle d'une run courte.
