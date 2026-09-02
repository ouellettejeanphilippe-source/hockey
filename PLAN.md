# Plan

État au 2 septembre 2026. Coche les cases en avançant et ajoute une ligne au journal, en bas.

## Fait

### Fondations
- [x] **F1** — Structure du dépôt, modules ES natifs, aucun build step
- [x] **F2** — `js/ratings.js` : cotes offensive, défensive, robustesse, clutch, globale, normalisées par saison en z-score
- [x] **F3** — Courbe salariale exponentielle calée sur l'échelle actuelle (0,78 M$ au plancher, ~19 M$ au sommet)
- [x] **F4** — `js/sim.js` : alignement de 23 (4 trios, 3 paires, 2 gardiens, 3 réservistes)
- [x] **F5** — Simulation Poisson 82 matchs, trios pondérés 34/28/22/16, paires 40/34/26
- [x] **F6** — Robustesse active dans les matchs éreintants, clutch tranche les prolongations
- [x] **F7** — Calibration validée sur 6 paliers de cote (tableau dans CLAUDE.md)

### Données
- [x] **D1** — `scripts/build_shards.py` : aspire l'API LNH saison par saison, écrit les shards
- [x] **D3** — `scripts/rate.mjs` : le build appelle `js/ratings.js`, une seule implémentation des cotes
- [x] **D4** — Joueur échangé dupliqué dans le vestiaire de chaque équipe, marqué `x:1`
- [x] **D5** — `js/data.js` : chargeur trois niveaux (shard, API en direct, seed) avec cache IndexedDB
- [x] **D6** — GitHub Action `build-data.yml` : manuel + rafraîchissement hebdo de la saison en cours

### Jeu
- [x] **J1** — Roulette saison + équipe, chargement asynchrone du shard, préchargement en arrière-plan
- [x] **J2** — Rerolls : 6 année, 6 équipe, 4 passer
- [x] **J3** — Ciblage manuel d'une case vide avant de choisir
- [x] **J5** — Barre de plafond, blocage des joueurs hors budget
- [x] **J6** — Écran de résultat avec barres d'équipe et révélation des cotes cachées

## À faire — priorité haute

- [x] **D2** — **Vérifier le CORS de l'API LNH depuis un navigateur.** Testé : L'API `api.nhle.com` renvoie du JSON sans en-tête `Access-Control-Allow-Origin`, ce qui bloque les requêtes directes depuis le navigateur (CORS). Le chargeur retombe proprement sur les shards et le seed grâce à `probeLive()`.
- [x] **D7** — **Premier build complet et vérification des noms de champs.** Exécuté `--only` sur les saisons seed. Tous les champs de l'API LNH (`skaterFullName`, `positionCode`, `teamAbbrevs`, `savePct`, `goalsAgainstAverage`, `ppPoints`, `shPoints`, `gameWinningGoals`, `otGoals`, `timeOnIcePerGame`, `hits`, `blockedShots`) sont validés et la distribution des cotes est confirmée.
- [x] **D8** — **Vérifier les codes d'équipe des franchises disparues.** Vérification effectuée sur tous les codes d'équipe (1970 à 2025). Tous les codes d'équipe générés dans `data/index.json` sont pris en compte dans `TEAMFULL` et `DEFUNCT`.
- [x] **D9** — Générer et commiter `data/seed.json` (sortie de `--seed-only`). `data/seed.json` et `data/index.json` sont générés et prêts à être commités.

## À faire — priorité moyenne

- [x] **J4** — **Sortir les cotes cachées du DOM et de la mémoire accessible.** Elles sont enregistrées dans un conteneur privé `RATINGS_VAULT` hors de `window.cap82.G` et ne sont révélées qu'à la simulation.

- [x] **J7** — Contrainte de position naturelle. Pénalités de position appliquées (-3 centre à l'aile, -2 mauvaise aile, -5 ailier au centre, -2 défenseur du mauvais côté LD/RD).

- [x] **J8** — Sauvegarde de la partie en cours dans localStorage, pour survivre à un rafraîchissement.

- [x] **J9** — Partage du résultat : bouton de copie dans le presse-papier avec fiche formatée.

- [x] **C1** — Cote globale relative à la saison (rang / nombre d'équipes + z-score), barème salarial réaliste (100+ pts = 12 à 18 M$, défenseur de 1re paire 9 à 14 M$), contrats d'entrée selon l'époque (aucun avant 1995-96 ; 1995-2004 base ~2,7 % du budget + bonis ; 2005+ base ~1 % + bonis ≤ 2,85 M$) et l'âge à la première saison (3 saisons à 18-21 ans, 2 à 22-23, 1 à 24 ; âge = année de naissance de l'API bios, sinon cohorte d'identifiant LNH, sinon pas de contrat d'entrée). `RATINGS_VERSION = 12`, 55 shards recalculés hors ligne (`--rerate`).
- [x] **C2** — Archétypes classiques (fabricant de jeu d'élite, franc-tireur, attaquant de puissance, complet, énergie, profondeur ; défenseur offensif, physique, défensif, polyvalent, profondeur ; gardiens) posés dans les shards (`ak`), plus zones d'efficacité (`lz`) : calibre 1er trio → trios 1-2, 2e → 1-3, 3e → 3-4, 4e → 4. Bonus « ✨ Trio optimal » +2/+2, malus « ⚠️ mal assorti » -2/-2.
- [x] **C3** — Salaires réels : `data/salaries/<saison>.json` (playerId → $ de l'époque, prorata du plafond de l'année ; 1989-2004 = plus gros budget d'équipe comme plafond). Assemblés par `scripts/build_salaries.py` depuis trois sources GitHub (couverture complète 2016-17 et 2017-18, partielle 2008-09 à 2025-26). Les cartes marquent « Réel » seulement quand le chiffre vient de là.
- [x] **C4** — Salaires réels étendus à toutes les saisons depuis 1989-90 : `scripts/fetch_markerzone.py` dépose `markerzone_<saison>.csv` (MarkerZone.com, salaire et cap hit ; par équipe avant 2005-06 pour l'équipe de l'époque et la masse salariale maximale), `build_salaries.py` les assemble, `--rerate` les pose dans les shards. Couverture : 77 à 93 % des entrées de 1989-90 à 2003-04, 94 à 100 % depuis 2005-06. `SEASON_ERA_CAP` 1989-2004 remplacé par les masses salariales maximales mesurées (1994-95 proraté par le lock-out), lissage à moitié vers le rang centile moderne (`LISSAGE_AVANT_PLAFOND`), `RATINGS_VERSION = 14`.
- [x] **L1** — Simulation de ligue complète : 32 équipes (31 vraies équipes historiques alignées automatiquement), 82 rondes, chance par match et PDO de saison, continuité des trios, blessures au prorata des PJ réels, buts et passes selon la vraie production, séries 4 de 7 jouées match par match. Classement, meneurs et infirmerie à l'écran de résultat.
- [x] **U1** — Interface : compteur signés/requis par position dans les en-têtes du bassin, fog of war par défaut, PTS/M sur les cartes et la fiche, étiquettes de zone et de contrat d'entrée, fiche relue depuis le shard au rechargement.
- [x] **U2** — **Refonte de l'interface en poste de directeur général.** Barre de plafond collante avec jauge, repère de rythme et budget par case restante ; roulette compacte avec l'instruction du moment et l'état des relances ; tableau de bord en trois cartes (à combler par position, budget du prochain choix, ce que vaut ce vestiaire) ; deux volets vestiaire / alignement, en onglets sous 1080 px et côte à côte au-dessus. Cartes de joueur portant tout ce qui sert à décider : position, salaire et part du plafond, statistiques, archétype, zone d'efficacité, contrat d'entrée, salaire réel ou estimé, case de destination, pénalité de position et plafond restant après signature. Alignement affiché par trio et par paire avec la chimie chiffrée de chaque unité. Bassin rangé par position, une colonne par poste sur grand écran (six colonnes de 220 px dès 1440 px), séparateurs et grille fluide en dessous. Aucun titre de page : la barre du haut ne porte que l'information utile. Options persistantes (statistiques, salaires, brouillard de guerre, signables seulement), recherche, sept tris, fiche de joueur en modale, bande de secours quand plus aucune signature n'est possible.

- [ ] **U3** — Dates de naissance dans les shards. L'API de la LNH est refusée par la politique réseau de l'environnement de développement (403 au CONNECT sur `api.nhle.com`), donc `--bios-only` ne peut pas tourner d'ici. L'Action `build-data.yml` a été ajoutée pour ça : onglet Actions → « Bâtir les données » → mode `bios`. Sans `bd`, l'âge et le tri par âge se masquent tout seuls ; ils réapparaissent dès que les shards les portent, sans changement de code.

- [x] **U4** — **Interface épurée.** La carte du bassin ne porte que l'essentiel (poste, nom, salaire, chiffre clé, archétype, zone, destination) ; tout le détail est dans la fiche au clic. Tableau de bord ramené à trois chiffres avec l'explication en infobulle. Vocabulaire de hockey pour les zones (Top 6, Top 9, Bottom 6, 4e trio ; Top 4, Bottom 4, 3e paire ; partant numéro un, auxiliaire). Destination selon la zone : un joueur de quatrième trio se propose au quatrième trio. Couleur de l'équipe sur les cartes et sur chaque case de l'alignement, éclaircie par `getTeamAccent` pour rester visible. Tableau de profondeur sur une trame de six colonnes, blocs de largeur égale.

- [ ] **S1** — Mode « défi du jour » : une graine déterministe par date, tout le monde a la même suite de roulettes. Tableau de meneurs local.

## À faire — priorité basse

- [ ] **S2** — Mode deux joueurs, repêchage en alternance sur la même suite de roulettes, puis série 4 de 7.
- [ ] **S3** — Recalibrer la simulation avec des alignements réalistes plutôt qu'uniformes. La table actuelle utilise 23 joueurs de cote identique, ce qui n'arrive jamais en jeu. Bâtir 200 alignements aléatoires valides sous le plafond, tracer la distribution des fiches, ajuster pour que la médiane tombe autour de 41-33-8.
- [x] **S4** — Séries éliminatoires après la saison régulière (top 16, séries simulées avec les alignements).
- [ ] **S5** — Étendre avant 1970. L'API couvre 1917. À valider : `timeOnIcePerGame` et `plusMinus` n'existent pas avant les années 1960, la cote défensive tomberait sur presque rien.
- [ ] **S6** — Blessures : un joueur à faible robustesse rate des matchs, son trio est dégradé pendant ce temps.
- [ ] **S7** — Service worker pour jouer complètement hors ligne après une première visite.

## Décisions prises

**Découpage par saison, pas par équipe.** La normalisation en z-score exige le bassin complet de la ligue pour l'année. Détail dans ARCHITECTURE.md.

**Pas de sauvegarde progressive équipe par équipe.** L'idée produisait un cache où certaines saisons ont des z-scores calculés sur des bassins partiels. Le shard de saison entière donne le même bénéfice de taille sans le risque.

**Pas de scraping de hockey-reference ni hockeydb.** Conditions d'utilisation, et leur HTML change sans préavis.

**Pas de backend.** GitHub Pages sert du statique, coût zéro, rien à maintenir.

**Cote globale relative à la saison, pas absolue.** Un top-10 des marqueurs vaut la même chose en 1975 et en 2024 (rang divisé par le nombre d'équipes). Une équipe exceptionnelle ou nulle peut encore déséquilibrer sa saison, c'est voulu : on équilibre les époques sans effacer la réalité. Mesuré par `scripts/check_ratings.mjs`.

**Pas de scraping de sites de salaires depuis le build.** Les salaires réels arrivent par `data/salaries/sources/` (fichiers déposés, provenance documentée), jamais par un scraper dans l'Action. `scripts/fetch_markerzone.py` est un outil de dépôt qu'on lance à la main, une requête par saison (par équipe avant 2005-06), et son résultat est commité.

**Référence d'avant 2005 = l'équipe la plus dépensière, lissée à moitié.** Au prorata pur, une équipe médiane de 1989-2004 revient à ~50 M$ 2026 contre 85-92 M$ depuis 2005-06 : le plafond ne mord plus. On garde les écarts individuels (aubaines, contrats trop chers) mais on mélange à parts égales le prorata et la valeur du même rang centile dans les cap hits réels de 2023-26 (`LISSAGE_AVANT_PLAFOND = 0,5` dans `js/ratings.js` ; 0 = prorata pur, 1 = rang pur et écarts effacés). Équipe médiane des années 1990 : 64-68 M$.

## Journal

| Date | Quoi |
|---|---|
| 2026-09-01 | Création du dépôt. Fondations, données et jeu en place. Reste D2, D7, D8, D9 à vérifier contre l'API réelle avant de considérer la base solide. |
| 2026-09-01 | Réalisation des tâches de priorité haute D2, D7, D8, D9. Vérification CORS, génération de data/seed.json et data/index.json, et validation des codes d'équipe. |
| 2026-09-01 | Amélioration UI/UX : Toggles (stats réelles/prorata 82M, $ cap/% cap, Fog of war / Hexagone FIFA), headshots LNH avec fallback, +/- colorés, badges de PTS/V en gros, tri du bassin, liens externes (NHL/HDB), et historique/leaderboard local. |
| 2026-09-01 | Finalisation Version 1.0 : Isolation des cotes cachées (J4), pénalités de position et support complet LD/RD (J7), sauvegarde automatique dans localStorage (J8), bouton de partage du résultat (J9), grisement des cartes quand position pleine/hors budget, et mise en valeur des noms de famille, stats et salaires. |
| 2026-09-01 | Séparation complète des LD/RD (DG/DD) basée sur la main de tir de l'API LNH, régénération des 55 shards et seed.json, attribution prioritaire des cases sans pénalité dans openSlots, nettoyage de l'en-tête et amélioration UI/UX pour écrans 1080p+. |
| 2026-09-01 | Ajout du support des salaires réels (1989-1990 à aujourd'hui) et des estimations relatives par époque (1970 à 1989). Intégration de `realSal` et `isReal` dans les shards, mise à jour des cartes de joueurs, emplacements et info-bulles radar avec étiquettes « Réel » vs « Estimé ». |
| 2026-09-02 | Refonte cotes/salaires (C1-C3) : `RATINGS_VERSION` 12, étage 2 rejouable hors ligne (`--rerate`, `scripts/rerate.mjs`), cote globale relative à la saison (corrélation force d'équipe ~ classement reconstitué : 0,81 en moyenne sur 55 saisons, min 0,52), barème salarial par ancres, contrats d'entrée, archétypes classiques et zones d'efficacité dans les shards, salaires réels 2008-09 à 2025-26 depuis trois sources GitHub (le champ `isReal` de la veille était en fait une estimation). Contrats d'entrée par époque et par âge (cohorte d'identifiant LNH quand l'année de naissance manque) : 18,7 % des entrées, 0 avant 1995-96. Simulation de ligue complète (L1) avec blessures, chance, continuité et séries. Calibration refaite (tableau CLAUDE.md). Interface U1. Test de fumée `scripts/smoke.mjs`. |
| 2026-09-02 | U4 : épuration. Carte du bassin réduite à l'essentiel, détail dans la fiche ; tableau de bord en trois chiffres ; zones renommées avec le vocabulaire du hockey ; `slotFitScore` place chaque joueur dans sa zone plutôt qu'au premier trio libre ; couleur d'équipe lisible (`getTeamAccent`) sur les cartes et les cases ; tableau de profondeur aligné sur six colonnes, blocs égaux (`align-items: start` les rétrécissait à la largeur de leur titre). Le partant et l'auxiliaire portent maintenant des unités distinctes pour que la zone des gardiens sache les distinguer. Action `build-data.yml` ajoutée : elle manquait au dépôt alors que la documentation la décrivait, et c'est la seule voie pour récupérer les dates de naissance, l'API étant refusée par la politique réseau de l'environnement. |
| 2026-09-02 | Refonte de l'interface (U2) en poste de directeur général : `index.html` et `style.css` réécrits, `js/game.js` réécrit. Mobile d'abord à 390 px, deux volets dès 1080 px, aucun débordement horizontal de la page à 390, 820 et 1440 px. Les cartes portent maintenant la case de destination, la pénalité de position, la part du plafond et le budget restant après signature ; le tableau de bord donne le budget maximal du prochain choix avant de se bloquer. Correction dans `js/sim.js` : `fits` était permissif entre groupes, un défenseur pouvait donc occuper une case d'ailier avec une pénalité de 999 et une cote ramenée au plancher ; la compatibilité est maintenant stricte (les réservistes `ANY` prennent toujours tout le monde). Calibration revérifiée, table inchangée aux aléas près (25-51-6, 50-27-5, 67-14-1, 76-6-0, 80-2-0, 81-1-0). Test de fumée mis à jour : tirage conscient du budget et sortie d'impasse par le bouton de secours. Bassin en six colonnes de position sur grand écran (requêtes de conteneur nommées, `pool` pour le volet et `col` pour chaque colonne) et suppression du titre et du sous-titre de page. |
| 2026-09-02 | C4 : salaires réels 1989-90 à 2025-26 depuis MarkerZone (`scripts/fetch_markerzone.py`, 36 fichiers `markerzone_<saison>.csv`), plafonds d'époque 1989-2004 mesurés sur ces données, lissage à moitié des salaires d'avant le plafond vers le rang centile moderne (équipe médiane des années 1990 : 50 → 66 M$ 2026, aubaines conservées), `RATINGS_VERSION` 14, 55 shards recalculés. Appariement des salaires corrigé : noms exacts d'abord, repli par nom de famille seulement avec la même initiale et une équipe compatible (Jody Hull volait l'identifiant de Brett Hull ; 218 joueurs touchés sur 36 saisons). Corrélation force / classement inchangée (0,81). Test de fumée : les hôtes externes sont bloqués (sans accès sortant, `networkidle` n'arrivait jamais). |
