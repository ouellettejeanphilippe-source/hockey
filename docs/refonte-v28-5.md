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

- **Au départ d'une run** (« Ton coach ») : un bouton dans le coin haut droit, ton écusson et tes médailles (96 × 44). Sous la pièce de départ, une ligne : le cran d'exigence, en quatre boutons (0 à 3), chacun sa règle en deux mots (« Cible +1 », « Clubs +1 », « Cible +2 ») ; seuls les crans ouverts se touchent, et la ligne n'existe pas avant la première Coupe. Le cran proposé est le dernier joué. Aucun écran de plus.
- **À la fin d'une run** : une bande « Le Club · 55 médailles » au-dessus des boutons ; la ligne des médailles dit son multiple quand la run avait un cran (« ×1,15 »). « Une run neuve » reste le bouton franc.
- **Le Club s'ouvre droit sur Variété.** Sa tête remplace le HUD : ton écusson, ton nom, ton rang, tes médailles (leur dessin à elles, jamais la pièce des jetons). Trois pages, en segment : Variété, Ton club, Palmarès ; l'Album vient à 5b. « Retour » ramène d'où on vient.

**Variété** (une scène, sans feuilleter) : une ligne « 3 de 8 · la prochaine : 40 » ; les huit philosophies en grille de quatre, dans l'ordre de `VOIES` (ouverte : cochée ; à ouvrir : éteinte, bord pointillé) ; dessous, celle qu'on touche : son nom, son mot, sa règle, sa pièce de départ, combien de ses entraîneurs attendent au loto et le mieux classé ; en bas, « Retour » et « Ouvrir · 40 ». L'achat répond sur place : la carte s'allume, le solde descend, un coup court (`notable`), le bouton franc devient « Une run neuve ». Sans assez de médailles, le bouton dit ce qui manque (« Il te manque 12 »), il ne se cache pas.

**Ton club** (une scène) : un segment Écusson | Couleurs ; l'aperçu de ton écusson aux couleurs choisies, son nom ; vingt clubs en grille de cinq, cinquante couleurs en pastilles de 44 en sept rangs. Un acquis se porte d'un toucher ; un autre dit son prix, ou le rang qu'il demande.

**Palmarès** (une scène) : tes runs, tes Coupes, ton meilleur parcours ; l'échelle du prestige (le rang d'après dit ce qui manque) ; tes exigences (le plus haut cran gagné) ; la trace du solde (3.5).

### 3.2 La variété : ce que les médailles ouvrent

**Une philosophie** (cinq à ouvrir ; trois ouvertes au départ : la Tortue, le Frelon, le Rhino, l'ordre de `VOIES`). Ses entraîneurs entrent au loto du départ ; celle qu'on vient d'ouvrir a sa case au loto suivant, marquée « Nouveau ». Prix : 40, 60, 80, 100, 120 médailles, dans l'ordre où on les ouvre (la première coûte 40, quelle qu'elle soit).

**Ton club** : un nom et son écusson, des couleurs (js/club.js), aux prix d'aujourd'hui, en médailles. Cosmétique. C'étaient des jetons de la boutique (JP, oct. 2026 : *même monnaie que les autres packs*) ; la boutique est partie, et dans une run en carte un jeton mis sur une couleur est un jeton de moins pour une pièce de banc : l'habit y coûterait de la force. À trancher (§ 10).

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

| Cran | Nom | Ce qu'il fait | Le réglage | Cibles tenues (128 graines) | Coupes | Médailles par run |
|---|---|---|---|---|---|---|
| 0 | — | — | la cible 7 · 8 · 9 | 59 % | 13 | 61 |
| 1 | La barre monte | un point de plus à tenir par acte | la cible 8 · 9 · 10 | 51 % | 10 | 64 |
| 2 | Des clubs plus forts | une étape d'édition de plus à chaque adversaire | *ETAPES* 2 · 3 · 4 · 8 | 46 % | 10 | 65 |
| 3 | La barre monte encore | deux points de plus par acte | la cible 9 · 10 · 11 | 33 % | 4 | 58 |

Trois crans, pas quatre : un quatrième (« Les grands clubs », une étape d'édition de plus encore) a été écrit puis retiré, il n'ajoutait rien de mesurable au troisième. La mesure se refait par `CRANS=1 GRAINES=128 FILS=3 node scripts/mesure_run.mjs`, qui exige que chaque cran coûte. La prime (×1,15 par cran) compense à peu près ce que le cran coûte : 61, 64, 65 puis 58 médailles par run. Monter ne se fait pas pour les médailles ; ça se fait pour la run plus dure.

Les huit crans de l'ancien Rogue partent avec ce qu'ils réglaient. Un joueur d'avant qui a gagné une Coupe a droit au cran 1 ; ses crans d'avant n'en ouvrent pas d'autre.

### 3.5 Le solde des déblocages (une fois)

Au premier démarrage après la tranche (`m.solde`) :

- chaque déblocage acheté dans l'ancien Rogue est remboursé **à son prix** (le devis, § 6), lu dans une table figée des prix d'alors (`PRIX_D_AVANT`) ; les médailles **à vie** ne bougent pas (elles comptaient déjà ces achats) ;
- les philosophies que le rang de prestige avait ouvertes sont données ;
- les clubs et les couleurs déjà acquis restent acquis (`m.club.pris`, ses vieilles clés relues) ;
- le plus haut cran retombe à zéro ; l'inventaire de cartes rares s'efface.

**Un écran** le dit à la première ouverture du Rogue : ce que l'arrêt de la vieille run a versé (tranche 4), ce qui est remboursé, plié par famille (neuf familles ; onze lignes au plus, chacune sur une ligne), « tu avais 62, tu as 492 », et deux boutons : « Au Club », « Continuer ». Il ne revient pas ; le Palmarès en garde une ligne. Un club neuf, qui n'a rien à solder, ne le voit jamais.

**À savoir** (`rogue-economie`) : un méta qui avait tout acheté reçoit jusqu'à 4 520 médailles, pour 2 290 à dépenser (400 de philosophies, 580 de clubs, 1 310 de couleurs). C'est la lettre du devis ; plafonner le solde à ce qui reste à acheter est une décision de JP.

### 3.6 Les galons d'une run courte (5b)

Ce qu'un joueur a fait chez toi se grave sur sa carte, au cartable (`LEGENDES`, js/cartable.js), et y reste d'une run à l'autre. Aucun effet au moteur : c'est ce qu'on collectionne. Plus rien ne les écrivait depuis que l'ancien Rogue est parti ; la fiche les lisait encore.

**Mesuré avant d'écrire** (le robot qui lit, 48 runs de 22 matchs en moyenne) : le meilleur buteur d'une run marque 10,5 buts, son meilleur pointeur fait 21 points.

| Galon | Ce qu'il demande | Par run | Runs qui en voient un |
|---|---|---|---|
| 🏵 Le bourreau | le but gagnant contre un rival | 1,3 | 77 % |
| 🔒 Le jeu blanc | ton gardien gagne sans accorder de but | 1,4 | 63 % |
| 🏵 Dix buts | dix buts dans la run (douze : 38 % des runs) | 1,0 | 54 % |
| 🏵 Vingt points | vingt points dans la run (quinze, le chiffre du premier jet : 79 %, trop) | 1,4 | 54 % |
| 🎩 Le Chapeau | trois buts dans un match | 0,8 | 52 % |
| ⭐ Le grand soir | cinq points dans un match (quatre : 1,9 par run, trois runs sur quatre, trop) | 0,25 | 19 % |
| 🗿 Le Mur | 40 arrêts dans une victoire (35 : 58 % des runs) | 0,1 | 10 % |
| 🏵 La Coupe | être de l'effectif qui la gagne | 23 cartes | 8 % |

Huit galons par run en moyenne, du courant au rare. `mesure_run` les juge : chaque sorte gravée dans 5 à 85 % des runs du robot qui lit, 4 à 14 galons par run.

Un galon se grave une fois par sorte et par run sur une carte. Le soir d'un galon, l'écran d'après-match le dit (« 🎩 Le Chapeau, gravé sur sa carte ») ; l'écran de fin compte ceux de la run. Les comptes d'une run (les buts et les points de chacun) vivent dans la run gardée (`R.comptes`), pour survivre à une reprise.

### 3.7 L'Album (5b)

La quatrième page du Club : ton cartable. Les cartes de joueur que tu as signées ou tirées, les plus belles d'abord (l'édition, puis les galons, puis les copies), neuf par écran, qu'on feuillette ; un segment Joueurs | Entraîneurs ; un filtre « Gravées ». En tête : combien de cartes, de combien de clubs-saisons, combien de galons. Une carte touchée montre ce qui est gravé dessus et ses copies. Il charge les saisons qu'il montre, pas les cinquante-cinq.

### 3.8 Les sortes de pochette : pas à cette tranche

Le devis nommait « des pochettes » parmi la variété. Deux constats : les robots n'achètent jamais de pochette (le tirage est asynchrone, hors du cœur), donc rien ne mesure ce qu'une pochette vaut dans une run ; et une sorte qui tire de meilleurs joueurs est de la force, comme les pièces (3.2). Une sorte de pochette en médailles demande d'abord que la pochette entre dans la mesure. Ce qui se fait ici : les dix-huit packs que plus rien ne vend partent (js/packs.js ne garde que les deux pochettes du marché). À trancher par JP (§ 10).

## 4. Les chiffres

- **Ce qu'une run rapporte** : par acte 5 médailles, 10 la cible tenue, +15 le rival battu ; 20 par ronde, 40 la Coupe. Le robot qui lit : 61 médailles par run en moyenne (128 graines ; 51 sur les 32 de `rogue-economie`) ; une Coupe sans faute : 175.
- **Ce qu'il y a à acheter** : cinq philosophies (400), vingt clubs (580), cinquante couleurs (1 310). À 60 médailles par run : une philosophie toutes les une ou deux runs, toutes vers la septième ; le reste se compte en dizaines de runs.
- **La prime des crans** : 1,15 · 1,30 · 1,45 fois ce que la run rapporte ; mesurée avec les crans (§ 3.4 et le verdict de la mesure, docs/decisions.md).

## 5. Les cas limites

- **Un méta d'avant** : le solde ne se paie qu'une fois ; un second démarrage, un fichier réimporté ne versent rien — *check_meta*, `check_sauvegardes`. Une run d'avant finie sur une Coupe pas encore payée la compte au palmarès, avec ses exploits (`solderLAncienRogue`).
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
- `js/coachs.js`, `scripts/check_lexique.mjs`, `scripts/check_packs.mjs`, `scripts/check_run.mjs`, `scripts/lib/run_robot.mjs`, `scripts/tout.mjs` : les mots et les juges qui suivent.
- `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/interface.md` : l'économie, les mots et les scènes du Club.
- `scripts/check_sauvegardes.mjs`, `scripts/check_scene.mjs`, `scripts/essai_run.mjs`, `scripts/mesure_run.mjs`, et un juge neuf, *check_meta* (dans `tout.mjs`).
- **5b** : `js/cartable.js` (les galons gravés, l'album à plat), `js/fiche.js` (la gravure dit son récit), `js/packs.js` (réécrit autour des deux pochettes), `scripts/check_packs.mjs` (réécrit), `scripts/check_banque.mjs`.

## 7. Ce qui part

Les noms en police de code sont partis du jeu ; les champs et les clés au nom trop commun pour se chercher sont en italique.

- `DEBLOCAGES`, `CRANS_DE_PACK`, `cleDeCran`, `jetonsDeDepart`, `rembourserLesPartis`, `REMBOURSEMENT_CARTE` → la variété (3.2) et le solde (3.5).
- `coachsOuverts` et les champs *etoile*, *phenomene*, *classeur*, *coachs* de la table des prestiges → le prestige en titre (3.3).
- Les huit crans d'avant (*agents*, *vestiaire*, *commanditaires*, *impatient*, *partants*, *serree*, et les anciens *ceinture* et *classeur*) → les trois crans mesurés (3.4).
- `BOUTIQUE` et les packs qui montent (les *mods* de *tierDuPack*, le *montee* de *cartesDuPack*, le bloc du prestige de *niveauxDuPack*, js/packs.js) → les deux pochettes du marché, telles quelles.
- `BANQUE` et son registre (*construire*, les mutations ; js/banque.js, les cartes rares) → rien : on monte une carte au vestiaire de la carte.

**À la 5b**, js/packs.js réécrit de zéro :

- `PACKS_JOUEURS` et ses dix-huit packs que plus rien ne vendait (les clés *hasard_bronze* à *hasard_premium*, *equipe*, *annee*, *ere70* à *ere20*, *sniper*, *passeur*, *defensif*, *dur*, *gardien*, *recrue*, *veteran*, *trio*, *etoiles*, *legendes*, *garanti*, *argent*, *or*, *specialistes*, *club*, *vedettes*, *coach*) → les deux pochettes du marché (*PACKS_TOUS* : le Bronze, l'Époque).
- `TIERS` (quatre métaux), `tierDuPack`, `cotesDuPack`, `cartesDuPack` → un seul métal, le Bronze (*METAL*).
- `SKILLS` (les talents d'un pack), `POSTES_DU_PACK`, le trio, l'équipe, l'année, les légendes, la garantie → rien.
- `recrueDuCoach`, `scoreDeCouleur` (le dépisteur du coach, que la run n'appelait plus) → rien.

## 7b. Ce qui reste, et pourquoi

*plafondDe* (une vieille partie du 82-0 le lit) ; *payerEcussons*, *ecussonsAVie*, *rangDePrestige* (les médailles et le titre) ; *solderLAncienRogue* (un vieux fichier peut encore s'importer) ; *bouchesTrousDuDepart*, *habillerLaLigue*, *chiffresDuSoirDe* (la run les joue) ; le cartable et js/club.js (JP : gardés) ; à la 5b, *tirerJoueursDuPack* et *niveauxDuPack* (le marché tire ses pochettes par eux, aux mêmes dés qu'avant : une run reprise relit la même pochette).

## 8. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| Le prix d'une philosophie | 40 · 60 · 80 · 100 · 120 | ±20 chacune | moins, tout est ouvert en trois runs ; plus, vingt runs avec trois coachs |
| *PRIME_EXIGENCE* | 0,15 par cran | 0,1-0,25 | trop, on monte pour les médailles ; trop peu, personne ne monte |
| Un cran | la cible +1, ou une étape de plus | — | un levier qui ne fait pas baisser la part des cibles tenues n'est pas un cran |

## 9. Les critères d'acceptation

Aucun ne compte des Coupes sur 64 graines : c'est du bruit (±6).

- [x] **Rien de ce qu'on achète ne gagne un match** : la même graine joue la même run, le méta vide ou plein (huit philosophies, 5 000 médailles, un club acheté) ; les pièces ne se vendent pas — *check_meta* (pur).
- [x] **Chaque cran coûte** : la part des cibles tenues du robot qui lit baisse d'un cran au suivant, et le dernier reste jouable (une cible sur cinq au moins) — `CRANS=1 GRAINES=128 FILS=3 node scripts/mesure_run.mjs` (à la main ; le premier jet du critère demandait 256 graines et 4 points d'écart à chaque cran : trois crans à 8, 5 et 13 points d'écart sur 128 graines le disent sans doubler la mesure).
- [x] **Le solde ne se paie qu'une fois** : chaque déblocage d'avant est remboursé à son prix figé (4 520 médailles tout acheté), les médailles à vie ne bougent pas, les philosophies du rang sont données, un second solde ne verse rien — *check_meta*, `check_sauvegardes`.
- [x] **Les médailles se dépensent** : une philosophie achetée a sa case au loto suivant ; un achat sans médailles est refusé et dit ce qui manque ; l'achat se relit ; les exploits d'une run font monter le rang — *check_meta*, `essai_run` (le Club ouvert de l'écran de fin, une philosophie payée une fois, « Nouveau » au départ suivant).
- [x] **Une scène, jamais une page** : le Club et ses trois pages, le départ avec son cran, la fin avec sa bande, l'écran du solde le plus chargé : 390 × 844, des cibles de 44, rien qui défile, aucun panneau sous le compte — `check_scene` (28 scènes, deux métas semés).
- [x] Rien de mort, et ce qui part est parti — `check_mort`, `check_refonte` (sur la somme).

**La 5b** :

- [x] **Un galon se grave, une fois, et se relit** : une fois par sorte et par run, 24 au plus par carte, chacun son récit, même gravé avant la V28 — *check_meta* ; dans une run, chaque galon à son seuil, dix buts et vingt points une fois par joueur et recomptés, la Coupe sur tout l'effectif, une run gardée puis relue les garde — `check_run`.
- [x] **Chaque sorte de galon se voit, aucune n'est de toutes les runs** : 5 à 85 % des runs du robot qui lit, 4 à 14 galons par run — `mesure_run`.
- [x] **L'Album montre le cartable** : les plus belles d'abord, six vraies cartes par écran, la carte touchée dit ses gravures ; il ne charge que les saisons de sa page — *check_meta* (l'ordre et les comptes), `check_scene` (quatre scènes de plus : 32).
- [x] **Les deux pochettes tirent comme avant** : pures, aux taux de leur métal, l'Époque un Pilier ou mieux de sa décennie et de son poste — `check_packs` (réécrit, une seconde et demie, dans `tout.mjs`).

## 10. Tranché par JP (11 nov. 2026)

Les quatre questions de la tranche, posées à JP une fois les deux moitiés en ligne :

- **Le solde, à plein prix** (3.5) : comme livré. Un méta qui avait tout acheté reçoit 4 520 médailles pour 2 290 à dépenser ; pas de plafond.
- **Ton club, en médailles** (3.2) : comme livré. Ses mots d'octobre (*même monnaie que les autres packs*) valaient pour la boutique en jetons, partie ; un jeton d'une run sert aux pièces de banc et aux pochettes.
- **Deux pochettes** (3.8) : on reste au Bronze et à l'Époque ; pas de sorte de pochette en médailles.
- **« Lire paie » et « tu peux exploser le jeu »** (tranche 4) : mesurer deux leviers avant de changer le jeu — le prix qui suit la valeur de plus près, moins de candidats par porte. La mesure et sa suite : docs/decisions.md.

Restent sans objet tant que le plafond ne mord pas : « le plafond » et « une porte de moins » comme exigences (3.4) ; des pièces en médailles (3.2), écartées, c'est de la force.

## Les tranches

- **5a** (livrée le 11 nov. 2026) : le solde et son écran ; la variété (les philosophies) ; ton club en médailles ; le prestige en titre et ses exploits ; les trois exigences mesurées ; le Club (Variété, Ton club, Palmarès) ; le cran au départ. Corrigé en chemin : « Une run neuve » plantait le départ après une run finie (la coquille lisait le club d'une run déjà rendue).
- **5b** : l'Album (3.7) ; les galons d'une run courte (3.6) ; js/packs.js taillé à ses deux pochettes (3.8). Les sortes de pochette en médailles attendent que la pochette entre dans la mesure.
