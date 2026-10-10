# La V5 · la meilleure boucle possible

9 octobre 2026, commit `977c00c`. JP : *faut replanifier tout le jeu en prenant tout ce qui marche actuellement et en réparant, améliorant ou supprimant le reste pour avoir le meilleur loop possible* ; *quelles cartes sont utilisées quand, de quelle façon, s'assurer que chaque semaine et gros match soit des nodes, des combats* ; *avoir assez de joueurs multi positions pour faciliter les lineups, sans irréaliste : positions multiples aux joueurs qui en ont*.

Ce plan s'appuie sur dix analyses faites le même jour par des agents spécialisés :
- six audits joués dans Chromium, à 390 et 1440 px : premier contact, repêchage, boucle Rogue, match, textes, visuel. Leurs correctifs sûrs sont dans la PR #166 ;
- un inventaire complet des systèmes ;
- une mesure chiffrée de la boucle ;
- la carte des cartes et des nœuds ;
- une mesure des positions réelles.

Chaque chiffre ci-dessous vient d'une de ces mesures, avec la commande qui le donne.

## Ce que disent les mesures

| # | Constat | Le chiffre | D'où |
|---|---|---|---|
| 1 | **Les signatures décident tout** | Le même flot de packs donne 14 V en signant à l'aveugle et 40 V en lisant l'alignement. Au 82-0 : 38,7 V pour le robot « premier Signer », 58,8 V en lisant la carte | `rythme_rogue ACHETER=1`, `rogue_sim`, `check_robot` |
| 2 | **Les cartes ne se sentent pas** | Une carte de saison rare : −1,1 à +0,9 V. Le combo du feu complet : +2,8 V. Un coach à sa III : +4 à +8 V, mais seulement environ +1,5 V de plus que sur une équipe mélangée. L'écart type d'une saison est de 4,5 V | `check_cartes`, `check_combo`, `check_voies` |
| 3 | **Une saison est longue pour peu de vrais choix** | 58 touchers de « Semaine suivante » pour 82 matchs ; environ 400 touchers et 20 à 25 minutes par saison ; environ 60 vrais choix, presque tous binaires ; 37 sommaires à fermer, plus les « mouvements », « retours » et « accidents » à valider | `rythme_rogue` |
| 4 | **La Coupe arrive tout de suite ou jamais** | Campagnes : Coupe à la run 1, ou rien en 12 runs. La cible (première Coupe entre la run 3 et la run 8) est manquée. Sans déblocage, un robot sans cartes gagne dans environ 11 % des runs : `check_robot MODE=rogue` est en échec (0,25 pour une cible de 0,10 au plus) | `check_rogue` réduit, `check_robot` |
| 5 | **La run casse sur une loterie** | 50 % des runs meurent en saison 1. En saison 2, le mandat « gagner une ronde » échoue 46 à 67 % du temps avec 92 % de qualification : le mur est une série au meilleur de sept, pas le build | `eco.mjs` |
| 6 | **L'économie n'a pas de tension** | 5,1 🪙 par match, dont 54 % viennent des victoires et 14 % des défaites. On dépense tout au fil de l'eau (12 🪙 en caisse en fin de saison), presque tout en packs Argent | `eco.mjs` |
| 7 | **Le méta pèse plus que le joueur** | En saison 1 : 89 points sans déblocage, 133 tout débloqué. Pour comparer, les choix d'une saison rapportent 6 à 16 points | `check_rogue` |
| 8 | **Trop de choses à apprendre** | Environ 95 concepts, 4 monnaies, 7 familles de cartes, 3 piles, 535 cartes de banque et 120 versions « + », 7 sortes d'événements narratifs | inventaire |
| 9 | **Les positions officielles manquent d'ailiers** | Sur 1 396 vrais clubs depuis 1967, les 12 attaquants les plus utilisés comptent 4,95 C, 3,51 AG et 3,54 AD ; 81 % des clubs n'ont pas quatre ailiers de chaque côté. En 2023-24, 52 des 222 centres listés prennent moins de 3 mises au jeu par match (ils jouent à l'aile), et 19 ailiers en prennent 5 ou plus (Benn, Giroux, Compher, Hayes, Haula) | shards, API `skater/faceoffwins` |
| 10 | **Le 82-0 est rapide mais sans raison de rejouer** | 26 touchers de repêchage ; un draft raisonnable fait les séries 6 fois sur 6, puis les séries sont un tirage (éliminé à 68-12-2). Ni méta ni objectif qui monte | `rythme_820` |

**En une phrase : le jeu a un excellent moteur et une seule vraie décision, la signature, noyée sous une centaine de petites décisions qui ne se sentent pas.** La V5 met la signature et le gros match au centre, fait de chaque semaine un nœud qu'on choisit, coupe tout ce qui ne change pas un résultat visible, et garde le moteur tel quel.

## Les principes de la V5

1. **Peu de décisions, chacune qui se voit.** Une semaine égale un nœud égale une décision. Le résultat de la décision se lit dans le sommaire de la semaine, cause par cause (`causesDuMatch`), en jetons et en chiffres de match. Pas de « Compris » qui bloque sans choix.
2. **La signature est le cœur du jeu.** C'est le levier de 20 V. Elle doit être guidée (qui entre, qui sort, ce que ça change en chiffres de match), rapide (4 touchers du pack à l'alignement) et réaliste (les positions multiples des joueurs qui en ont).
3. **Le gros match est un combat sur un seul écran.** On y voit l'intention adverse, ta main, l'enjeu et le butin. C'est l'élite de Slay the Spire, et les séries sont les boss.
4. **Trois types de cartes, pas sept.** Le Personnel (permanent), les Tactiques (le deck de combat) et les Coups (la main de la semaine). Environ 120 cartes au lieu de 535.
5. **La run se perd sur la saison, pas sur un dé.** Le mandat juge ce que le build contrôle : les points, le rang, les gros matchs. Les séries paient et donnent la Coupe, mais une série perdue de justesse ne tue pas la run.
6. **Le méta ouvre des options, pas de la force brute.** Les déblocages élargissent les choix (coachs, packs, postes) au lieu d'ajouter +44 points. La Coupe se gagne par le jeu entre la run 3 et la run 8.
7. **Rien de neuf dans le moteur.** Aucune cote neuve, aucun canal neuf. `hasard()`, `deDuJour`, la saison qui se rejoue de sa graine et les 82 matchs restent tels quels. Tout ce qui suit est fait de champs de décision existants.

## La boucle cible

```
RUN ─┬─ Départ : coach (après les packs de départ, en voyant l'équipe), classeur, 2 patrons
     │
     ├─ SAISON = 26 NŒUDS (un par semaine, 82 matchs joués quoi qu'il arrive)
     │    chaque semaine, un nœud choisi parmi deux, visibles trois semaines d'avance :
     │      ⚪ la route   → la main de la semaine (2 Coups au plus)
     │      ❓ événement  → un dilemme, seulement si on prend ce nœud
     │      🩺 infirmerie → repos des jambes, ou soins, ou camp (+) d'une carte, ou ménage
     │      🛒 marché     → le pack de la semaine à −25 %, et la signature guidée
     │    nœuds imposés :
     │      ⚔️ gros match (élite) : l'écran de combat, butin 1 parmi 3
     │      🎁 trésor : un seul palier tous les ~20 matchs (pack gratuit et palier réunis)
     │      🏢 le proprio : le mandat se lit, l'objectif bonus se choisit
     │      boss d'acte (S9, S20, S26) : le gros match contre le rival le plus proche, butin rare
     │    → sommaire de la semaine : les jetons gagnés, ce que ta carte a fait, le mandat
     │
     ├─ SÉRIES = BOSS : la main à chaque match, un ajustement entre deux matchs, la poche jouable
     │
     └─ FIN : Ta run → médailles → déblocages (options, pas force) → la run suivante
```

Une saison de 26 semaines, dessinée par l'analyse des nœuds :

```
ACTE I — LE CAMP ET LA ROUTE
S1  🏢 le mandat + l'objectif bonus (1 parmi 3)
S2  ⚪ ─┬─ 🛒        └─ ❓
S3  🎁 trésor
S4  ⚔️? 1er gros match dès le 10e match ; sinon ─┬─ 🩺  └─ ❓
S5  ⚪ ─┬─ ❓        └─ 🛒
S6  ⚪ ─┬─ 🩺        └─ 🛒
S7  🎁 TRÉSOR (la main du 20e) + 🏢 verdict de l'objectif
S8  ⚪ ─┬─ 🩺        └─ ❓
S9  BOSS D'ACTE (le rival le plus proche) · butin rare
ACTE II — LA DATE LIMITE
S10–S19  le même rythme ; 🎁 au 40e ; ⚔️ annoncés par le moteur ; adversaire à 4 élans dès le 55e
S20 BOSS D'ACTE + 🛒 dernière vitrine de joueurs (62e) + 🏢
ACTE III — LE SPRINT
S21–S25  ⚪ ─┬─ 🩺 / ❓ / 🛒 (cartes seulement) ; ⚔️?
S26 BOSS D'ACTE : la place en séries
SÉRIES — quatre boss
```

**Cible de rythme :** environ 26 avances et 150 touchers par saison, 10 à 12 minutes par saison, 25 à 35 minutes par run, et chaque avance porte un choix.

## Les cartes : qui sert quand (aujourd'hui → V5)

La carte complète d'aujourd'hui (535 cartes, 7 familles, 3 piles) est dans le rapport des cartes. En résumé :

| Famille | Aujourd'hui | Problème mesuré | V5 |
|---|---|---|---|
| 👔 Patrons (47) | Postes, toute la saison, gardés d'une run à l'autre | Hors de la main de la semaine, jamais nommés dans les causes | **Personnel**, avec les cartes de saison et les adjoints |
| 📘 Cartes de saison (18) | Paliers, objectifs, case vide ; **aucun pack** | Rarissimes ; patron sans poste | **Personnel** |
| 📰 Événements (160) | La main de la semaine, 3 à 12 matchs, s'éteignent aux séries | **12 maudits jamais tirés** ; médiane 0,03 V ; pas nommés après | **Coups**, coupés vers ~40, une semaine de durée ; les maudits deviennent le prix d'un objectif raté |
| 🧬 Modifs (73) | La main de la semaine, posées au verso | Les seules nommées dans les causes : le bon modèle | **Coups**, gardées |
| 🧴 Consommables (81) | La main de la semaine ou permanents | 4 en double avec le camp, le ménage et le stage ; les permanents sont **jetés** des packs gratuits | **Coups** ~25 ; les doublons deviennent les options de 🩺 |
| 💵 Contrats (33) | La main de la semaine | Se voient dans la barre du plafond : bien | **Coups**, gardés |
| 🃏 Cartes de match (123 + 120 « + ») | Le deck, au gros match et en séries | **Deck sans maximum** ; un coach compte les cartes **achetées**, pas les cartes **jouées** | **Tactiques** : un deck borné (~15), les cartes jouées comptent pour le coach, retirer une carte est un butin |

**Les trous à boucher, par ordre de valeur :**
1. Un coach compte les cartes de match **jouées**, pas les cartes achetées. L'incitation est aujourd'hui à l'envers.
2. Chaque carte d'équipe (patron, événement, tactique) est nommée dans les causes, comme une modif. Le principe V3 « la conséquence après » est alors tenu.
3. Les semaines 1 à 3 ne restent pas vides : le premier trésor arrive au plus tard en S3, et la main de la semaine pige déjà dans la poche du départ.
4. La poche se joue en séries (V4-E).

## Les positions multiples (réelles, jamais inventées)

**La règle, tirée seulement des données :**
- **C/aile** : un centre listé qui prend moins de 3 mises au jeu par match joue l'aile du côté de son lancer, sans pénalité.
- **Aile/C** : un ailier qui prend 5 mises au jeu ou plus par match joue le centre sans pénalité.
- **Les deux ailes** : un ailier qui lance du côté opposé à sa position joue aussi l'autre aile.
- **Avant 1997-98** : sans données de mises au jeu, seule la main compte.
- Tout autre joueur garde sa position unique et sa pénalité d'aujourd'hui (−3, −5, −2).
- **À l'écran** : la position se lit « C/AG », « AG/AD », comme dans un pool.

**Pourquoi pas une liste de site ?** JP : *c'est pas littéralement listé sur plusieurs sites?* Oui, mais aucune liste n'est à la fois permise et complète :
- hockey-reference et hockeydb (« C/LW ») : le scraping est interdit, par leurs conditions et par `CLAUDE.md` ;
- Elite Prospects, PuckPedia et les pools Yahoo ou ESPN : données propriétaires, et les pools ne couvrent que la saison en cours ;
- Wikidata (ouverte) : 224 joueurs sur 14 037 ont plus d'une position, souvent sans le côté (« ailier ») ;
- l'infobox de Wikipédia : « Forward » pour Benn et Giroux.

Les mises au jeu sont mesurées saison par saison (Giroux, centre puis ailier droit), comme le reste du jeu. Wikidata peut compléter avant 1997-98, seulement là où elle donne un côté précis.

**Comment le faire :**
1. Le build garde `fpg` (mises au jeu par match, rapport `skater/faceoffwins`) et `sc` (le côté du lancer) pour les attaquants.
2. `ratings.js` en tire `pos2`. Toucher la formule, c'est incrémenter `RATINGS_VERSION`.
3. `getPositionPenalty` lit `pos2` comme le fait déjà `_partout`. Le canal existe (l'atelier « Joue partout »), ce n'est pas une mécanique neuve.
4. Les shards sont regénérés par le script et l'Action, jamais à la main.

**Preuves :**
- `check_ratings` : la corrélation reste autour de 0,8.
- Un `check_positions` neuf : une part réaliste de joueurs à deux positions, et les noms de contrôle (Benn, Giroux, Hayes) qui en ont deux.
- `check_robot` et `check_rogue`, pour que la difficulté ne bouge pas plus que voulu.
- smoke, pour qu'aucun départ de run ne porte de « joueur mal placé » impossible à effacer.

## Garder, réparer, améliorer, fusionner, couper

### Garder tel quel
Le moteur (lancers, ligue au jour le jour, graine, jambes, blessures, causes) ; les cotes et la valeur relative à la saison ; les badges, les zones et les niveaux ; le repêchage, le vestiaire et le loto ; l'alignement et les systèmes ; le direct et le commentateur ; les fils et la une ; les coachs et la confiance ; le combo du feu ; le cartable et le classeur ; « Ta run », la Coupe ; la coquille des cinq sections, la pile du retour, la manette, les sauvegardes.

### Réparer (des bogues mesurés)
- Le compte d'un coach : les cartes jouées, pas les cartes achetées.
- Les 12 événements maudits jamais tirés ; les 18 cartes de saison qu'aucun pack ne donne ; les permanents jetés des packs gratuits.
- Le prix des rôles (V2.4) : à salaire égal, 23 V d'écart entre les power forwards et les bagarreurs. C'est le seul déséquilibre mesuré qui fausse un build.
- `check_robot MODE=rogue` et `check_rogue`, aujourd'hui en échec.
- Le choix du coach après les packs de départ : il s'affiche alors en chiffres de match et non en « % ».

### Améliorer
- **La signature guidée.** Une carte de pack dit « entre au 2e trio, sort X, ≈ +0,3 but par match ». Le chemin pack → alignement passe de ~10 touchers à 4. Les sortants montrent leur niveau.
- **Le sommaire de la semaine.** Il dit les jetons gagnés (le chiffre compte, un son), ce que tes cartes ont fait cause par cause, et où en est le mandat (« 9e, la 8e place est à 3 points »).
- **Les jetons visibles** dans l'en-tête au téléphone pendant la saison.
- **L'écran de combat** remplace l'avant-match, la main et la récompense, trois arrêts. Les deux options de l'avant-match deviennent deux cartes de vestiaire à 0 élan, avec la même décision datée.
- **Le butin** : une carte de match, retirer une carte, ou une carte « + ».
- **La confiance II et III** : un moment fêté (son, bannière), pas un toast muet.

### Fusionner

| Fusion | Économie |
|---|---|
| 7 sortes d'événements narratifs (dilemmes, vie du DG, situations, accidents, incidents, avant-match, entractes) → **le message de fil** (né d'une feuille réelle, qui revient) + **le choix du gros match** | ≈ 1 600 lignes ; 91 dilemmes → ~20 |
| Objectifs du proprio + mandat → **le mandat, avec un objectif bonus** | ≈ 250 lignes ; un seul « le proprio veut » |
| Pack gratuit (matchs 9, 18, 26) + paliers du deck (20, 40, 60) → **le trésor 🎁** | ≈ 300 lignes |
| Entente, maîtrise, chimie → **la chimie** | trois compteurs → un |
| Ballottage + rappel du club-école → **le remplacement** | une fenêtre |
| Album + vitrine → **le cartable** | ≈ 90 lignes |
| apres-match.js, profil de style, « Ton impact », « Forces » → **le sommaire + les causes** | ≈ 700 lignes |
| Prestige + jalons → **le prestige, c'est N jalons** ; le club cosmétique se paie en **médailles** et non en jetons | une monnaie par usage |
| Onglet Jambes → l'Effectif | un sous-onglet de moins |

### Couper
- 32 packs → environ 8 : 4 de joueurs, 3 de cartes, celui du coach. Plus de « scellé ». Le pack du jour est tiré de la graine (`packDuJour(graine:semaine)`), plus de la date réelle.
- Express et Loto express (4 formats pour un mode « juste le draft »).
- L'identité de départ, déjà hors du 82-0.
- Les messages bloquants sans choix : « mouvements », « retour » quand rien ne change, « accident » (dits dans la une).
- La boutique toujours ouverte, **à trancher** : ouverte seulement aux nœuds 🛒, ou toujours ouverte avec le pack de la semaine au rabais au 🛒.
- **Sur table** (≈ 8 100 lignes JS, 17 % du code, 265 règles CSS) : la sortir du jeu principal ou la geler, **à trancher**.

**Total visé :** environ 95 concepts → 40, 4 monnaies → 3 (jetons, médailles, plafond ; l'élan reste une ressource de combat), 535 cartes → environ 120, et 10 à 26 % de JS en moins selon le sort de Sur table.

## La courbe de difficulté et l'économie

| Aujourd'hui | V5 | Preuve |
|---|---|---|
| Coupe à la run 1 ou jamais ; un robot sans cartes la gagne dans ~11 % des runs | Première Coupe entre la run 3 et la run 8 ; le robot jamais avant la run 5, ≤ 10 % au total | `check_rogue`, `check_robot MODE=rogue` |
| Saison 2 : « gagner une ronde » échoue 46 à 67 % du temps | Le mandat juge la saison : un rang, des points, les gros matchs gagnés. La ronde de séries paie 40 🪙 et mène à la Coupe, mais ne tue pas la run seule. **À trancher** : une « vie » (deux mandats manqués) ou le mandat sur la saison | `check_rogue` (la part des runs tuées par une seule série) |
| Les déblocages valent +44 points en saison 1 | Des options : coachs, postes, packs, réservistes, cosmétiques. La force brute est plafonnée à environ +10 points tout débloqué | `check_rogue` (points en saison 1 selon les déblocages) |
| La défaite paie 40 % d'une victoire ; tout se dépense au fil de l'eau | La tension vient des nœuds 🛒 (on n'achète pas partout), d'une prime pour un objectif difficile (15, 25 ou 40 🪙 selon la chance affichée) et de la caisse visible. **À trancher** : la défaite à 1 🪙 | `check_rogue`, `check_packs` (revente ≤ 40 %) |

## Le 82-0 : rester court, gagner une raison de rejouer
On le garde tel qu'il est : juste le repêchage, la saison d'un coup, les séries match par match. On ajoute **le défi du jour**, tiré de la graine du jour : une contrainte (plafond à 60 M$, que des Soutien et des Réguliers, une seule franchise, une époque). Le score est gardé dans l'historique. Rien de neuf dans le moteur : ce sont les options existantes de « Nouvelle partie », imposées.

## Les phases, dans l'ordre

Chaque item nomme ses fichiers et le script qui le prouve. Un correctif sans preuve n'est pas fini.

**Phase 0 · Réparer** (1 à 2 jours). Ne change pas la boucle.
- [x] Un coach compte les cartes de match jouées — `js/banque.js` `buildDe` — `check_coachs`, `check_voies` (en paires).
- [x] Les permanents d'un pack gratuit se repigent (le pack gratuit donne ses cinq cartes). Les maudites et les cartes de saison restent ce qu'elles sont : elles se gagnent en jouant, par choix de conception (`sortDUnPack`) — `js/packs.js`, `js/inventaire.js` — `check_packs`, `check_deck`.
- [x] **Un seul coach en poste** (JP : *juste un coach peut être actif à la fois* ; *le coach, choisi au début de la saison, ou changé avec une carte qui enlève l'autre bonus* ; *les cartes doivent faire la même chose qu'en vrai*) : le coach se choisit au début de chaque saison (on garde celui en poste avec sa confiance, ou un autre repart à I) ; en saison, seule « 📋 Le congédiement » (consommable peu commun) en change, comme on congédie un entraîneur dans la LNH. Les cartes d'une autre couleur ne montent plus personne ; le moteur ne garde qu'une confiance (`team.coachs`), `VERSION_MOTEUR` S105 — `js/banque.js` `coachsActifs`, `coachNeuf`, `palierAllume`, `js/sim.js`, `js/rogue-jeu.js` `choisirCoachDeSaison` — `check_coachs` (2a), `essai_rogue` (10c).
- [x] Une carte de match compte UNE fois pour son coach, et le deck de départ ne compte pas : la run de JP gagnée du premier coup avait monté la Tortue, le Doc et l'Aigle à III en rejouant « Bloquer », « Changements » et « Les gâchettes » à chaque gros match — `js/banque.js` `quiComptent` — `check_coachs`, `check_deck`.
- [ ] (reporté : il faut que l'équipe des packs soit posée avant l'écran du coach pour que ses chiffres se calculent) Le coach se choisit après les packs de départ — `js/rogue-jeu.js` `ouvrirRogue` — `essai_rogue`, `check_graine`.
- [x] Les jetons dans l'en-tête au téléphone ; le sommaire de la semaine dit les jetons et la caisse, et la prime d'un gros match gagné — `index.html`, `js/game.js`, `js/saison.js` `ouvrirSommaire` — `essai_rogue` (le chiffre égale `jetonsRogue`).
- [ ] La carte en grand garde ses chiffres ; `.aln-sauts` (déjà fait en #166) — `js/rogue-jeu.js` — smoke.

- [x] ~~La boutique ouvre au début de la semaine (décision 3 de JP)~~ — défait le 9 oct. : JP veut *accès au store en tout temps* ; la main de la semaine se distribue après les achats du lundi ; le pack au rabais est celui de la semaine, tiré de la graine — `js/rogue-jeu.js` `boutiqueFermee`, `js/inventaire.js` `mainDeLaSemaine` — `check_deck`, `check_graine`, `essai_rogue`.
- [x] Les positions multiples réelles, le code : `positionsAvant` (js/sim.js), « C/AG » à l'écran, `sc` et `fpg` dans le build, `RATINGS_VERSION` 28 — `check_positions` (sur 2023-24 rebâtie à part : 25,6 % d'attaquants à deux positions, les clubs à quatre ailiers de chaque côté passent de 2 à 14 sur 32). **Reste** : lancer l'Action `build-data` en mode `full` après la fusion, puis mesurer `check_robot` et `check_rogue`.

**Phase 1 · La semaine devient un nœud.**
- [ ] `noeudsDeLaSaison` dans un module neuf `js/route.js` : une fonction pure, d'abord seulement affichée — `check_route` (neuf : pur, un nœud par semaine, 82 matchs, aucun `hasard()` consommé), `check_graine`, `check_coquille`.
- [x] L'écran de combat : l'enjeu en une ligne (victoire +20 🪙 et une carte, défaite sonnés N matchs), leur main et le dépistage, l'avant-match en deux cartes de vestiaire à 0 élan, ta main de 5 et tes 3 élans ; un seul bouton émet les mêmes décisions qu'avant (`{ avant }` puis `{ main }`, même soir) ; la veille n'a plus d'arrêt « événement, avant le combat » — `js/saison.js`, `js/gerant.js`, `js/combat.js` — `check_graine`, `check_gros`, `check_combat`.
- [ ] 🎁 Le trésor : packs gratuits et paliers réunis — `js/sim.js` `PALIERS_CARTES`, `js/inventaire.js` — `check_deck`, `check_paliers`.
- [x] **Le nœud de la semaine, première forme** (`js/noeuds.js`) : au bureau du lundi, une semaine sur deux, trois routes — 🛌 le repos (une carte de soin ou de jambes), ❓ l'événement (une carte d'événement), 💰 la commandite (10 ou 12 🪙). Chaque route est une carte existante de la banque ; la décision `n:w` ne porte que `gestes`, `effet`, `gain`. Pas de nœud « marché » : JP ne veut rien de la boutique dans le Club, et la boutique ouvre déjà chaque lundi. La commandite plafonne à ~152 🪙 par saison, à calibrer en phase 4 — `check_noeuds` (neuf), `check_graine`, `essai_rogue`.
- [x] **Le nœud qui se lit et qui varie** (JP : *comment je suis supposé savoir quoi prendre sans les infos nécessaires ? Aussi, varier ces choix*) : la route dit l'état du club (jambes, infirmerie, semaine, caisse) et ce que chaque carte fait à ce club (`etatDuNoeud`, js/saison.js) ; quatre routes (🏋️ l'entraînement s'ajoute), trois offertes, jamais les mêmes ni la même carte deux nœuds de suite, les bassins lus dans toute la banque — `check_noeuds`, `essai_rogue` (20e).
- [ ] Suite du nœud : la route visible trois semaines d'avance sur la carte de la saison ; le dilemme seulement au ❓ — `check_route`, `check_moments`, `check_choix`, `check_sauvegardes` (une ancienne partie se rejoue).
- [ ] Le boss d'acte, variante A (le premier gros match de la semaine de fin d'acte, sans toucher `annoncerGros`) — `check_gros`, `check_robot`.
- [x] **Le jour par jour et le nœud du lundi** (JP : *revenir au jour par jour, mais avec une fois par semaine un genre de node avec tous les éléments de la semaine, sauf match important ; accès au store en tout temps* ; *ça va ressembler plus à un vrai roguelike, que t'as accès à ton deck, menus, etc. du menu de la map de nodes*). « Jour suivant » est le bouton principal, « Jusqu'à lundi » le second. En Rogue, hors du lundi, seul ce qui presse bloque (`PRESSE` : la main d'un gros match, un pack à signer, un blessé à remplacer, une case vide) ; le reste (événements, séquences, proprio, courriels, butins, retours, paliers, packs gratuits, la main et la route) attend le lundi (`auNoeud`). Le lundi, après le sommaire de la semaine, la carte de la semaine (`ouvrirNoeud`) montre la route des sept jours, les cases à régler dans l'ordre qu'on veut, et le deck, tes cartes et l'alignement à un toucher ; la boutique reste au Marché (JP : *rien de la boutique dans le Club*), ouverte en tout temps — `js/saison.js`, `js/rogue-jeu.js`, `js/game.js` — `essai_rogue` (5e, 20d).
- [ ] Les messages sans choix ne bloquent plus ; ils vont dans la une — `js/saison.js` `arretDeSemaine` — `essai_rogue` (plus d'avance sans choix).

**Phase 2 · Trois types de cartes.**
- [ ] Personnel, Tactiques, Coups : une seule pile de main (les Coups), le deck borné à ~15 cartes avec le retrait comme butin — `js/banque.js`, `js/combat.js`, `js/inventaire.js` — `check_combat`, `check_deck`, `check_cartes` (en paires).
- [x] **Le butin à trois choix** : après un gros match ou une série gagnés, une carte parmi trois, « 🗑️ Retirer une carte » (les malédictions d'abord) ou « 🏋️ Améliorer une carte » (sa version « + »), ou passer. Ce sont les décisions du ménage et du camp (`retrait`, `aiguise`) portées par la décision du butin ; `deckDe` les lit aussi en séries. Une fiche dont un second rôle naît d'une variante dit « gagné : Bronze » (elle plantait) — `js/saison.js` `autresButins`, `js/combat.js`, `js/gerant.js` (`autres`), `js/fiche.js` — `check_deck`, `essai_rogue` (20c).
- [ ] Couper de 535 vers ~120 cartes : on garde celles qui se voient dans la feuille et celles d'un moment (`si`) — `check_banque FAMILLES=…`, `check_cartes`, `check_si`, `check_mort`.
- [x] Chaque carte d'équipe est nommée dans les causes (« 🎯 « L'école de tir » a fait entrer 16 buts ») : `effetsDeSaison` garde ses sources nommées, `causesDuLancer` les dit une par une ; ce qui reste sans nom va au groupe — `js/sim.js`, `js/causes.js` — `check_causes` (6), `check_empreinte` (les matchs ne bougent pas).

**Phase 3 · La signature au centre.**
- [ ] Les positions multiples réelles (voir plus haut) — `scripts/build_shards.py`, `js/ratings.js`, `js/sim.js` `getPositionPenalty` — `check_ratings`, `check_positions` (neuf), `check_robot`.
- [ ] La signature guidée en 4 touchers, avec qui sort et ce que ça change — `js/rogue-jeu.js`, `js/repechage.js`, `js/impact.js` — `essai_packs`, `check_chiffres`.
- [ ] Le prix des rôles (V2.4) — `js/ratings.js` — `check_voies` (la composition à ±3 V).

**Phase 4 · La courbe.**
- [ ] Le mandat sur la saison, et les déblocages en options — `js/rogue.js` — `check_rogue` (première Coupe entre la run 3 et la run 8), `check_robot MODE=rogue` (≤ 10 %).
- [ ] La tension de l'économie (nœuds 🛒, prime d'objectif selon la chance, packs ramenés à ~8) — `js/magasin.js`, `js/packs.js`, `js/rogue.js` — `check_packs`, `check_rogue`, `essai_achat`.

**Phase 5 · Couper.**
- [ ] Les fusions (événements narratifs, objectifs, album, apres-match, profil de style, Express) et le sort de Sur table — `check_mort`, `check_coquille`, `tout.mjs`.

**Phase 6 · Le 82-0.**
- [ ] Le défi du jour — `js/partie.js`, `js/menu.js` — smoke (un défi jouable de bout en bout).

## Tranché par JP (9 oct.)

1. **Le mandat** (JP, 9 oct. : *je suis ouvert à tous*) : **le proprio juge la saison, pas une série.** Faire les séries, puis finir dans les dix premiers, les six, puis les trois premiers (mesuré : le premier tiers puis le quart laissaient la Coupe à 17 % des runs sans déblocage) (`MANDATS`, `rangDuMandat`, js/rogue.js). Les séries paient toujours et la Coupe gagne la run ; une série perdue ne la finit plus.
2. **Les trois types de cartes** : oui. **La coupe** (JP : *nécessaire de couper ?*) : non. On garde les cartes. On retire seulement les doublons (les 4 consommables qui font le camp, le ménage et le stage) et on rebranche les cartes mortes (les 12 maudites, les 18 cartes de saison). La clarté vient des trois types et de ce qu'on montre à la fois, pas du nombre de cartes.
3. **La boutique** (JP : *nœud en début de semaine ?*) : oui, puis défait le même jour (JP : *accès au store en tout temps*). La boutique est ouverte **à toute journée**, au Marché ; le pack au rabais reste celui de la semaine, tiré de la graine.
4. **Les déblocages en options** : oui.
5. **Sur table** : garder comme mode à part, gelé.
6. **Les gros matchs** (JP : *décidés au fur et à mesure selon la saison*) : c'est ce que fait déjà `annoncerGros` (la veille, contre un rival à deux rangs ou moins, ou la bête noire). Le boss d'acte est le gros match que le classement désigne à la fin de l'acte, sans calendrier fixé d'avance : la variante A.
7. **La défaite** (JP : *décide*) : **elle reste à 2 🪙.** La tension vient de la boutique en début de semaine et des nœuds, pas d'une punition de plus pour une équipe qui perd déjà. La première run est déjà dure (50 % d'élimination en saison 1).
8. **Les messages sans choix** (JP : *les passer au sommaire, et bloquer si ça fait qu'on les voit ; le moins d'endroits différents, le mieux c'est*) : la carte qui change, le vestiaire et les mouvements se lisent dans le sommaire de la semaine, qui bloque jusqu'à ce qu'on le ferme ; il les archive, et la boîte ne les redit pas.
9. **La courbe de difficulté** (JP, 9 oct. : *je vis avec ça, c'est clairement facile de rebalancer ensuite* ; *je préfère qu'on optimise le fun in game avant de vraiment viser un objectif clair de fin de jeu*) : la Coupe possible dès la 2e run est tolérée pour l'instant. La difficulté se réglera plus tard, par paliers de défi débloqués (comme l'Ascension de Slay the Spire) et en retirant la force brute aux déblocages (phase 4).
