# V28, tranche 5 : la méta

L'extrait du devis `docs/refonte-v28.md` pour sa tranche 5 (« La variété en médailles, les exigences sur les leviers neufs, les galons à l'échelle d'une run »). Écrit le 11 nov. 2026 avant le code, relu le jour même par `rogue-economie` et `rogue-ux` (« à reprendre », repris ci-dessous), et corrigé par deux mesures. JP, 10 nov. : *fais tout je suis tanné des maquettes* — pas de tour de maquettes ; les scènes neuves parlent la langue des dix-sept (la direction C, les classes `rn-`).

## 1. Ce que JP a dit

- 7 nov. 2026 (devis V27, § 11) : le prestige, *variété seulement* ; les jetons qui restent en fin de run, perdus.
- 9 nov. 2026 : l'ancien Rogue supprimé, *les médailles et le cartable gardés*.
- Devis V28, § 4.8 : *Les médailles, entre les runs, servent à la variété seulement (des coachs, des pièces, des pochettes, des époques). Les exigences montent la difficulté après une Coupe : la cible, la bande des clubs, le plafond, une porte de moins.*
- § 6 : *Un écran dit ce qui est versé : ses médailles, le prix des déblocages qui partent.*
- § 8b : *Les galons se réécrivent à l'échelle d'une run courte : 40 buts ne se font plus en vingt matchs.*

## 2. Ce que le joueur ressent

Une run finie laisse quelque chose : des médailles, et l'envie d'en dépenser pour que la prochaine soit **différente**, jamais plus facile. Gagner la Coupe ouvre une run **plus dure**, qui paie plus. Rien de ce qu'on achète ne gagne un match.

## 3. Les règles du jeu

### 3.1 Le Club, et où il s'ouvre

Entre deux runs seulement, jamais en pleine run (le menu pause ne l'ouvre pas : rien de ce qu'on y achète ne vaut pour la run en cours).

- **Au départ d'une run** (« Ton coach ») : un bouton dans le coin haut droit, ton écusson et tes médailles (96 × 44). Sous la pièce de départ, une ligne : le cran d'exigence, en cinq boutons (0 à 4), chacun sa règle en trois mots ; seuls les crans ouverts se touchent. Le cran proposé est le dernier joué. Aucun écran de plus.
- **À la fin d'une run** : une bande « Le Club · 55 médailles » au-dessus des boutons ; la ligne des médailles dit son multiple quand la run avait un cran (« ×1,15 »). « Une run neuve » reste le bouton franc.
- **Le Club s'ouvre droit sur Variété.** Sa tête remplace le HUD : ton écusson, ton nom, ton rang, tes médailles (leur dessin à elles, jamais la pièce des jetons). Trois pages, en segment : Variété, Ton club, Palmarès ; l'Album vient à 5b. « Retour » ramène d'où on vient.

**Variété** (une scène, sans feuilleter) : une ligne « 3 de 8 · la prochaine : 40 » ; les huit philosophies en grille de quatre, dans l'ordre de `VOIES` (ouverte : cochée ; à ouvrir : éteinte, bord pointillé) ; dessous, celle qu'on touche : son nom, son mot, sa règle, ses trois pièces ; en bas, « Retour » et « Ouvrir · 40 ». L'achat répond sur place : la carte s'allume, le solde descend, un coup court (`notable`), le bouton franc devient « Une run neuve ». Sans assez de médailles, le bouton dit ce qui manque (« Il te manque 12 »), il ne se cache pas.

**Ton club** (une scène) : un segment Écusson | Couleurs ; l'aperçu de ton écusson aux couleurs choisies, son nom ; vingt clubs en grille de cinq, cinquante couleurs en pastilles de 44 en sept rangs. Un acquis se porte d'un toucher ; un autre dit son prix, ou le rang qu'il demande.

**Palmarès** (une scène) : tes runs, tes Coupes, ton meilleur parcours ; l'échelle du prestige (le rang d'après dit ce qui manque) ; tes exigences (le plus haut cran gagné) ; la trace du solde (3.5).

### 3.2 La variété : ce que les médailles ouvrent

**Une philosophie** (cinq à ouvrir ; trois ouvertes au départ : la Tortue, le Frelon, le Rhino, l'ordre de `VOIES`). Ses entraîneurs entrent au loto du départ ; celle qu'on vient d'ouvrir a sa case au loto suivant, marquée « Nouveau ». Prix : 40, 60, 80, 100, 120 médailles, dans l'ordre où on les ouvre (la première coûte 40, quelle qu'elle soit).

**Ton club** : un nom et son écusson, des couleurs (js/club.js), aux prix d'aujourd'hui, en médailles (c'étaient des jetons de la boutique). Cosmétique.

**Pas les pièces.** Le devis nommait « des pièces » ; mesuré par `rogue-economie` : ouvrir une philosophie avec ses trois pièces fait passer de 39 % à 54 % la part des offres qui montrent une pièce du plus haut cadre. C'est de la force. Les trente-six pièces sont donc aux offres dès la première run.

**Une sorte de pochette** : à 5b.

### 3.3 Le prestige

Le rang du club (du Club de garage à la Dynastie) se gagne en médailles **à vie** et par un exploit, comme avant : jouer les séries, gagner une ronde, jouer la finale. La run en carte écrit ces exploits à sa fin (`m.jalons` : plus rien ne les écrivait, un joueur neuf plafonnait au deuxième rang). Le rang n'ouvre rien au jeu : c'est un titre, et la clé de quelques écussons et couleurs (`rang`, js/club.js). Les multiples de taux des packs, le budget du classeur et les coachs par rang partent.

### 3.4 Les exigences 🔺

Après ta première Coupe, le départ d'une run offre un cran. Chaque cran ajoute sa règle à celles d'avant, et les médailles de la run sont multipliées par 1 + 0,15 par cran. La Coupe gagnée au plus haut cran ouvert ouvre le suivant.

**Mesuré avant d'écrire** (le robot qui lit, 64 graines, chaque levier seul ; sans exigence : 58 % de cibles tenues, 12 runs finies sans cœur) :

| Levier | Cibles tenues | Runs finies sans cœur | Il coûte ? |
|---|---|---|---|
| La cible +1 par acte (8 · 9 · 10) | 52 % | 17 | oui |
| Les clubs plus forts (*ETAPES* +1) | 55 % | 19 | oui |
| 2 M$ d'espace de moins · aucun espace | 66 % · 60 % | 9 · 12 | non |
| Les adversaires plus hauts (*DECALAGE* +0,05) | 59 % | 10 | non (les rivaux et les séries sont déjà au sommet) |
| Deux portes au lieu de trois | 59 % | 14 | non |
| *RACHAT* 0,4 | 63 % | 9 | non |

Deux des quatre leviers du devis (« le plafond », « une porte de moins ») ne coûtent rien aujourd'hui : un cran qui ne coûte pas serait une prime gratuite. C'est le même constat que « lire ne paie pas » (docs/decisions.md, « La V28, tranche 4 ») : rien ne manque aux portes. Ils attendent le levier que JP doit trancher.

| Cran | Nom | Ce qu'il fait | Le réglage |
|---|---|---|---|
| 1 | La barre monte | un point de plus à tenir par acte | la cible 8 · 9 · 10 |
| 2 | Des clubs plus forts | une étape d'édition de plus à chaque adversaire | *ETAPES* 2 · 3 · 4 · 8 |
| 3 | La barre monte encore | deux points de plus par acte | la cible 9 · 10 · 11 |
| 4 | Les grands clubs | deux étapes de plus | *ETAPES* 3 · 4 · 5 · 9 |

Les huit crans de l'ancien Rogue partent avec ce qu'ils réglaient. Un joueur d'avant qui a gagné une Coupe a droit au cran 1 ; ses crans d'avant n'en ouvrent pas d'autre.

### 3.5 Le solde des déblocages (une fois)

Au premier démarrage après la tranche (`m.solde`) :

- chaque déblocage acheté dans l'ancien Rogue est remboursé **à son prix** (le devis, § 6), lu dans une table figée des prix d'alors (`PRIX_D_AVANT`) ; les médailles **à vie** ne bougent pas (elles comptaient déjà ces achats) ;
- les philosophies que le rang de prestige avait ouvertes sont données ;
- les clubs et les couleurs déjà acquis restent acquis (`m.club.pris`, ses vieilles clés relues) ;
- le plus haut cran retombe à zéro ; l'inventaire de cartes rares s'efface.

**Un écran** le dit à la première ouverture du Rogue : ce que l'arrêt de la vieille run a versé (tranche 4), ce qui est remboursé, plié par famille (huit lignes au plus), « tu avais 62, tu as 492 », et deux boutons : « Au départ », « Au Club ». Il ne revient pas ; le Palmarès en garde une ligne.

**À savoir** (`rogue-economie`) : un méta qui avait tout acheté reçoit jusqu'à 4 520 médailles, pour 2 290 à dépenser (400 de philosophies, 580 de clubs, 1 310 de couleurs). C'est la lettre du devis ; plafonner le solde à ce qui reste à acheter est une décision de JP.

### 3.6 Les galons d'une run courte (5b)

Ce qu'un joueur a fait chez toi se grave sur sa carte, au cartable (`LEGENDES`, js/cartable.js) : dans un match (le chapeau, le grand soir, le jeu blanc, le mur), et sur la run (dix buts, quinze points, le but gagnant contre un rival, la Coupe). Aucun effet au moteur.

## 4. Les chiffres

- **Ce qu'une run rapporte** : par acte 5 médailles, 10 la cible tenue, +15 le rival battu ; 20 par ronde, 40 la Coupe. Le robot qui lit : 51 médailles par run en moyenne (`rogue-economie`, 32 graines) ; une Coupe sans faute : 175.
- **Ce qu'il y a à acheter** : cinq philosophies (400), vingt clubs (580), cinquante couleurs (1 310). À 50 médailles par run : une philosophie toutes les une ou deux runs, toutes vers la huitième ; le reste se compte en dizaines de runs.
- **La prime des crans** : au cran 1, 1,15 × ce que la run rapporte quand la cible coûte 6 points ; mesuré sur 256 graines avant de livrer.

## 5. Les cas limites

- **Un méta d'avant** : le solde ne se paie qu'une fois ; un second démarrage, un fichier réimporté ne versent rien — `check_sauvegardes`.
- **Une run en cours à la mise à jour** : elle garde ses règles ; ce qui s'achète vaut pour la suivante.
- **Les jetons de départ** : 40 pour tous (la caisse de départ part).
- **Le loto et la philosophie neuve** : le loto tire deux de ses trois cases au cartable ; la philosophie qu'on vient d'ouvrir prend la troisième, une fois.
- **Sans run** : la coquille refuse aujourd'hui tout geste sans run en cours ; le Club se joue sans run.
- **La manette** : B revient d'une page du Club (`fermer-club`).

## 6. Ce qu'il touche

- `js/rogue.js` : réécrit — les médailles, le prestige en titre, la variété, les exigences, le solde.
- `js/run.js` : une run porte ses règles (`R.regles` : son cran, ses cibles, ses étapes, son multiple) ; la fin écrit les exploits.
- `js/club.js` : l'achat en médailles, les acquis.
- `js/coachs-reels.js` : la case « Nouveau » du loto.
- `js/run-scenes.js`, `js/run-jeu.js`, `style.css` : le Club et ses trois pages, le cran au départ, la bande de la fin, l'écran du solde, le dessin des médailles.
- `js/packs.js`, `js/banque.js` : ce que plus rien ne lit part.
- `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/interface.md` : l'économie, les mots et les scènes du Club.
- `scripts/check_sauvegardes.mjs`, `scripts/check_scene.mjs`, `scripts/essai_run.mjs`, `scripts/mesure_run.mjs`, et un juge neuf, *check_meta*.

## 7. Ce qui part

- `DEBLOCAGES`, `CRANS_DE_PACK`, `cleDeCran`, `jetonsDeDepart`, `rembourserLesPartis`, `REMBOURSEMENT_CARTE` → la variété (3.2) et le solde (3.5).
- `coachsOuverts` et les champs `etoile`, `phenomene`, `classeur`, `coachs` de `PRESTIGES` → le prestige en titre (3.3).
- Les huit crans d'avant (`agents`, `vestiaire`, `commanditaires`, `impatient`, `partants`, `serree`, et les anciens `ceinture` et `classeur`) → les quatre crans mesurés (3.4).
- `BOUTIQUE`, `tierDuPack`, `cartesDuPack` et les packs que la run n'ouvre pas (js/packs.js) → les deux pochettes du marché.
- `BANQUE` (js/banque.js, les cartes rares) → rien : on monte une carte au vestiaire de la carte.

**Ce qui reste, et pourquoi** : `plafondDe` (une vieille partie du 82-0 le lit) ; `payerEcussons`, `ecussonsAVie`, `rangDePrestige` (les médailles et le titre) ; `solderLAncienRogue` (un vieux fichier peut encore s'importer) ; `bouchesTrousDuDepart`, `habillerLaLigue`, `chiffresDuSoirDe` (la run les joue) ; le cartable et js/club.js (JP : gardés).

## 8. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| Le prix d'une philosophie | 40 · 60 · 80 · 100 · 120 | ±20 chacune | moins, tout est ouvert en trois runs ; plus, vingt runs avec trois coachs |
| *PRIME_EXIGENCE* | 0,15 par cran | 0,1-0,25 | trop, on monte pour les médailles ; trop peu, personne ne monte |
| Un cran | la cible +1, ou une étape de plus | — | un levier qui ne coûte pas 5 points de cibles tenues n'est pas un cran |

## 9. Les critères d'acceptation

Aucun ne compte des Coupes sur 64 graines : c'est du bruit (±6).

- [ ] **Rien de ce qu'on achète ne gagne un match** : les pièces offertes sont les mêmes à trois philosophies ou à huit ; le coach d'une philosophie achetée a la même maîtrise au loto — *check_meta* (pur).
- [ ] **Chaque cran coûte** : sur 256 graines, le robot qui lit tient ses cibles au moins 4 points moins souvent à chaque cran qu'au précédent, et ses médailles par run, la prime comprise, ne montent pas de plus de 10 % d'un cran au suivant — `GRAINES=256 CRANS=1 node scripts/mesure_run.mjs` (à la main).
- [ ] **Le solde ne se paie qu'une fois** : chaque déblocage d'avant est remboursé à son prix figé, les médailles à vie ne bougent pas, les philosophies du rang sont données, un second démarrage ne verse rien — `check_sauvegardes`.
- [ ] **Les médailles se dépensent** : une philosophie achetée a sa case au loto suivant ; un achat sans médailles est refusé ; l'achat se relit après un rechargement ; les exploits d'une run font monter le rang — *check_meta*, `essai_run`.
- [ ] **Une scène, jamais une page** : le Club et ses trois pages, le départ avec son cran, la fin avec sa bande, l'écran du solde : 390 × 844, des cibles de 44, rien qui défile — `check_scene` (un méta semé).
- [ ] Rien de mort, et ce qui part est parti — `check_mort`, `check_refonte` (sur la somme).

## 10. À trancher par JP (rien ne bloque le code)

- **Le solde, à plein prix ou plafonné** (3.5) : la lettre du devis est le plein prix.
- **« Le plafond » et « une porte de moins » comme exigences** (3.4) : ils ne coûtent rien aujourd'hui ; ils reviennent avec le levier qui fera mordre le plafond.
- **Des pièces en médailles** (3.2) : écartées, c'est de la force ; ou alors par familles de même cadre.

## Les tranches

- **5a** : le solde et son écran ; la variété (les philosophies) ; ton club en médailles ; le prestige en titre et ses exploits ; les exigences mesurées ; le Club (Variété, Ton club, Palmarès) ; le cran au départ.
- **5b** : l'Album ; les galons d'une run ; les sortes de pochette.
