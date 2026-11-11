# V28, tranche 5 : la méta

L'extrait du devis `docs/refonte-v28.md` pour sa tranche 5 (« La variété en médailles, les exigences sur les leviers neufs, les galons à l'échelle d'une run »). Écrit le 11 nov. 2026, avant le code. JP, 10 nov. : *fais tout je suis tanné des maquettes* — pas de tour de maquettes ; les scènes neuves parlent la langue des dix-sept (la direction C, les classes `rn-`).

## 1. Ce que JP a dit

- 7 nov. 2026 (devis V27, § 11) : le prestige, *variété seulement* ; les jetons qui restent en fin de run, perdus.
- 9 nov. 2026 : l'ancien Rogue supprimé, *les médailles et le cartable gardés*.
- Devis V28, § 4.8 : *Les médailles, entre les runs, servent à la variété seulement (des coachs, des pièces, des pochettes, des époques). Les exigences montent la difficulté après une Coupe : la cible, la bande des clubs, le plafond, une porte de moins.*
- § 6 : *Un écran dit ce qui est versé : ses médailles, le prix des déblocages qui partent.*
- § 8b : *Les galons se réécrivent à l'échelle d'une run courte : 40 buts ne se font plus en vingt matchs.*

## 2. Ce que le joueur ressent

Une run finie laisse quelque chose : des médailles, et l'envie d'en dépenser pour que la prochaine soit **différente**, jamais plus facile. Gagner la Coupe ouvre une run **plus dure**, qui paie plus. Rien de ce qu'on achète ne gagne un match.

## 3. Les règles du jeu

### 3.1 Le Club (entre deux runs)

Depuis le départ d'une run (« Ton coach ») et depuis l'écran de fin, un bouton ouvre **le Club** : ton écusson, ton nom, ton rang de prestige, tes médailles, et quatre pages. Chaque page est une scène qui tient en un écran ; une liste longue se feuillette (« ‹ 2 / 5 › »), elle ne défile pas.

- **Variété** : ce que les médailles ouvrent (3.2).
- **Ton club** : son nom et son écusson (vendus ensemble), ses couleurs (js/club.js). En médailles (c'étaient des jetons de la boutique). Tout est cosmétique.
- **Palmarès** : tes runs, tes Coupes, ton meilleur parcours, l'échelle du prestige, tes exigences.
- **Album** (5b) : tes cartes, par saison et par club.

### 3.2 La variété : ce que les médailles ouvrent

**Une philosophie** (cinq à ouvrir, trois ouvertes au départ : la Tortue, le Frelon, le Rhino — l'ordre de `VOIES`). L'ouvrir fait deux choses : ses entraîneurs entrent au loto du départ, et ses trois pièces de banc entrent dans les offres (le rival battu, l'élite, le marché). Les neuf pièces d'adjoint, les trois « pour le battre » et l'arbitre sont dans les offres dès la première run. Prix : 40, 60, 80, 100, 120 médailles, dans l'ordre où on les ouvre (la première coûte 40, quelle qu'elle soit).

**Une sorte de pochette** (5b) : le marché vend deux pochettes ; avec plus de sortes ouvertes, il en tire deux parmi elles. Au départ : le Bronze et l'Époque.

**Rien d'autre.** Les déblocages qui rendaient la run plus facile (la caisse de départ, le plafond indexé, les joueurs gardés, le commanditaire, les pages du classeur, les cases de réserve, les bouche-trous moins pires, les packs qui montent) partent, et se remboursent (3.5).

### 3.3 Le prestige

Le rang du club (du Club de garage à la Dynastie) se gagne en médailles **à vie** et par un exploit (les séries, une ronde, la finale), comme avant. Il n'ouvre plus rien au jeu : c'est un titre, écrit au Club et au Palmarès. Il ouvre des écussons et des couleurs (`rang`, js/club.js). Les multiples de taux des packs (`etoile`, `phenomene`), le budget du classeur et les coachs par rang partent.

Un joueur d'avant garde ce que son rang avait ouvert : les philosophies de son rang lui sont données (3.5).

### 3.4 Les exigences 🔺

Après ta première Coupe, le départ d'une run offre un cran. Chaque cran ajoute sa règle à celles d'avant, et les médailles de la run sont multipliées par 1 + 0,15 par cran. La Coupe gagnée au plus haut cran ouvert ouvre le suivant.

| Cran | Nom | Ce qu'il fait | Le réglage |
|---|---|---|---|
| 1 | La ceinture | 2 M$ d'espace de moins au départ | *ESPACE* 4 → 2 M$ |
| 2 | Le calendrier relevé | des adversaires plus hauts | *DECALAGE* +0,05 |
| 3 | La barre monte | un point de plus à tenir par acte | *CIBLES* 8 · 9 · 10 |
| 4 | Une porte de moins | deux portes après chaque match | *PORTES* 2 |

Les huit crans de l'ancien Rogue (le prix des packs, le classeur, le barème, les contrôles) partent avec ce qu'ils réglaient. Un joueur d'avant garde le droit au cran 1 s'il avait gagné une Coupe.

### 3.5 Le solde des déblocages (une fois)

Au premier démarrage après la tranche : chaque déblocage acheté dans l'ancien Rogue est remboursé à son prix, en médailles ; les philosophies que le rang de prestige avait ouvertes sont données ; les couleurs et les clubs déjà achetés en jetons restent acquis. **Un écran** le dit, à la première ouverture du Rogue : ce qui a été versé à l'arrêt de la vieille run (tranche 4), ce qui est remboursé, ce qui est gardé. Un bouton : « Compris ». Il ne revient pas.

### 3.6 Les galons d'une run courte (5b)

Ce qu'un joueur a fait chez toi se grave sur sa carte, au cartable, pour toujours (`LEGENDES`, js/cartable.js) : dans un match (le chapeau, le grand soir de quatre points, le jeu blanc, le mur de quarante arrêts), et sur la run (dix buts, quinze points, le but gagnant contre un rival, la Coupe). Aucun effet au moteur : c'est une mémoire, que l'Album et la fiche montrent.

## 4. Les chiffres

- **Ce qu'une run rapporte** (js/run.js, js/actes.js) : par acte 5 médailles, 10 la cible tenue, +15 le rival battu ; 20 par ronde, 40 la Coupe. Une run du robot qui lit : 35 à 55 médailles ; une Coupe sans faute : 175.
- **Ce qu'il y a à acheter** : cinq philosophies (400 médailles), vingt clubs (≈ 600) et cinquante couleurs (≈ 1 000) : une dizaine de runs pour toutes les philosophies, des dizaines pour tout le reste. Rien ne s'épuise en une soirée.
- **Les exigences** se mesurent une à une par `REGLAGES` devant `mesure_run`, 64 graines : chaque cran doit coûter des Coupes au robot qui lit sans le ramener à zéro au premier.

## 5. Les cas limites

- **Un méta d'avant** : ses médailles restent ; ses déblocages se remboursent une fois (`m.solde`) ; un second démarrage ne rembourse rien — `check_sauvegardes`.
- **Une run en cours au moment de la mise à jour** : elle garde ses règles (son cran, ses philosophies) ; ce qui s'achète vaut pour la run suivante.
- **Pas assez de médailles** : le bouton le dit, il ne se cache pas.
- **Une philosophie ouverte en cours de run** : au loto et aux offres de la run suivante.
- **Les jetons de départ** : 40 pour tous (la caisse de départ part).

## 6. Ce qu'il touche

- `js/rogue.js` : réécrit — le méta (les médailles, le prestige en titre, la variété, les exigences, le solde).
- `js/run.js` : une run porte son cran et ses philosophies (`R.exigence`, `R.voies`) ; ses réglages se lisent par la run, plus par la constante.
- `js/pieces.js` : les offres ne tirent que des philosophies ouvertes.
- `js/club.js` : les prix en médailles, l'achat.
- `js/run-scenes.js`, `js/run-jeu.js`, `style.css` : les scènes du Club, le cran au départ, l'écran du solde.
- `js/packs.js`, `js/banque.js` : ce que plus rien ne lit part.
- `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md` : l'économie et les mots réécrits.
- `scripts/check_sauvegardes.mjs`, `scripts/check_scene.mjs`, `scripts/essai_run.mjs`, `scripts/mesure_run.mjs`, un juge neuf *check_meta*.

## 7. Ce qui part

- `DEBLOCAGES`, `CRANS_DE_PACK`, `cleDeCran`, `jetonsDeDepart`, `rembourserLesPartis`, `REMBOURSEMENT_CARTE` → la variété (3.2) et le solde (3.5).
- `coachsOuverts` et les champs `etoile`, `phenomene`, `classeur`, `coachs` de `PRESTIGES` → le prestige en titre (3.3).
- Les huit crans d'avant de `EXIGENCES` (`ceinture`, `agents`, `classeur`, `vestiaire`, `commanditaires`, `impatient`, `partants`, `serree`) → les quatre crans neufs (3.4).
- `BOUTIQUE`, `tierDuPack`, `cartesDuPack` et les packs que la run n'ouvre pas (js/packs.js) → les deux pochettes du marché ; les sortes de plus reviennent à 5b.
- `BANQUE` (js/banque.js, les cartes rares) → rien : on monte une carte au vestiaire de la carte.

**Ce qui reste, et pourquoi** : `plafondDe` (une vieille partie du 82-0 le lit) ; `payerEcussons`, `ecussonsAVie`, `rangDePrestige` (les médailles et le titre) ; `solderLAncienRogue` (un vieux fichier peut encore s'importer) ; `bouchesTrousDuDepart`, `habillerLaLigue`, `chiffresDuSoirDe` (la run les joue) ; le cartable et js/club.js (JP : gardés).

## 8. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| Le prix d'une philosophie | 40 · 60 · 80 · 100 · 120 | ±20 chacune | moins, tout est ouvert en trois runs ; plus, on joue vingt runs avec trois coachs |
| *PRIME_EXIGENCE* | 0,15 par cran | 0,1-0,25 | trop, on monte les crans pour les médailles ; trop peu, personne ne monte |
| Les crans | quatre | 3-6 | chaque cran doit coûter des Coupes, mesuré |

## 9. Les critères d'acceptation

- [ ] **Rien de ce qu'on achète ne gagne un match** : une run aux huit philosophies ouvertes ne gagne pas plus de Coupes qu'une run aux trois du départ, en paires — *mesure_run* (`VOIES=toutes` contre le départ, à deux écarts-types).
- [ ] **Chaque cran coûte** : les Coupes du robot qui lit ne montent pas d'un cran au suivant, et le cran 4 lui en laisse moins que le cran 0 — *mesure_run*.
- [ ] **Le solde ne se paie qu'une fois** : un méta d'avant est remboursé de chaque déblocage, garde ses philosophies, et un second démarrage ne verse rien — `check_sauvegardes`.
- [ ] **Les médailles se dépensent** : acheter une philosophie la met au loto et aux offres de la run suivante ; un achat sans médailles est refusé ; l'achat se relit après un rechargement — *check_meta*, `essai_run`.
- [ ] **Une scène, jamais une page** : les scènes du Club, le cran et l'écran du solde tiennent en 390 × 844, des cibles de 44 — `check_scene`.
- [ ] Rien de mort, et ce qui part est parti — `check_mort`, `check_refonte` (sur la somme).

## Les tranches

- **5a** : le solde et son écran ; la variété (les philosophies) ; ton club en médailles ; le prestige en titre ; les exigences mesurées ; le Club (accueil, Variété, Ton club, Palmarès).
- **5b** : l'Album ; les galons d'une run ; les sortes de pochette.
