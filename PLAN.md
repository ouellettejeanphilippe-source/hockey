# Plan

État au 29 septembre 2026. **Le plan de travail courant est `LIVRAISON.md`** (les jalons vers la 1.0, cochés au fur et à mesure). Ce fichier ne garde que l'état court ; l'historique complet (les « À faire » d'avant 1.0, le journal) est dans `docs/plan-historique.md` et `docs/journal/`.

## Fait

- **Fondations** (F1 à F7) : modules ES natifs sans build, cotes normalisées par saison, courbe salariale, alignement de 23, simulation calibrée.
- **Données** (D1 à D9, M1) : shards par saison depuis l'API LNH, chargeur trois niveaux avec IndexedDB, Action `build-data.yml`, salaires réels, unités spéciales.
- **Jeu** (J1 à J9 et les sprints S7 à S80) : roulette, vestiaire et loto, saison au jour le jour, séries match par match, gros matchs, deck de match, mode Rogue, Sur table, exhibition, packs, cartable, album. Le détail sprint par sprint est dans `docs/journal/`.
- **1.0 en cours** : voir les cases cochées de `LIVRAISON.md`.

## À faire

Les items non faits d'avant 1.0, une ligne chacun. Ce qui est entré dans la 1.0 vit dans `LIVRAISON.md` ; le reste attend après la sortie (`LIVRAISON.md`, « Après la 1.0 »).

- [ ] **S1** — Mode « défi du jour » : une graine par date, la même suite de roulettes pour tous. Après la 1.0.
- [ ] **S2** — Mode deux joueurs : repêchage en alternance, puis série 4 de 7. Après la 1.0.
- [ ] **S3** — Recalibrer la simulation sur des alignements réalistes plutôt qu'uniformes. En partie couvert par `check_robot.mjs` (`LIVRAISON.md`, jalon 0).
- [ ] **S5** — Étendre avant 1970 (TOI et +/- manquent avant les années 1960). Après la 1.0.
- [x] **S6** — Blessures selon la robustesse : fait — un joueur robuste se blesse moins (`ROB_BLESSURE`), la robustesse d'alignement protège les coéquipiers (`DISSUASION`, 30 sept.), et le lien à la fatigue est l'item C3 de `LIVRAISON.md`.
- [ ] **S8** — Vrais classements pour `check_ratings.mjs` (Hockey Databank). Après la 1.0.
- [ ] check_cartes (New Jersey) et check_monotonie à la limite de leur borne : à relire après les réglages de la 1.0 (`LIVRAISON.md`, jalon 1, L et M).
- [ ] Poser une amélioration derrière le banc et aux séries : ouvert si JP le demande.
- [ ] Le poids de la chimie : fait en 1.0 (`LIVRAISON.md`, J1-M).
- [ ] L'APK de 64 Mo : réglé en 1.0 (les visages se téléchargent sur l'appareil, `js/visages.js`).

## Décisions prises

**Découpage par saison, pas par équipe.** La normalisation en z-score exige le bassin complet de la ligue pour l'année. Détail dans ARCHITECTURE.md.

**Pas de sauvegarde progressive équipe par équipe.** L'idée produisait un cache où certaines saisons ont des z-scores calculés sur des bassins partiels. Le shard de saison entière donne le même bénéfice de taille sans le risque.

**Pas de scraping de hockey-reference ni hockeydb.** Conditions d'utilisation, et leur HTML change sans préavis.

**Pas de backend.** GitHub Pages sert du statique, coût zéro, rien à maintenir.

**Cote globale relative à la saison, pas absolue.** Un top-10 des marqueurs vaut la même chose en 1975 et en 2024 (rang divisé par le nombre d'équipes). Une équipe exceptionnelle ou nulle peut encore déséquilibrer sa saison, c'est voulu : on équilibre les époques sans effacer la réalité. Mesuré par `scripts/check_ratings.mjs`.

**Pas de scraping de sites de salaires depuis le build.** Les salaires réels arrivent par `data/salaries/sources/` (fichiers déposés, provenance documentée), jamais par un scraper dans l'Action. `scripts/fetch_markerzone.py` est un outil de dépôt qu'on lance à la main, une requête par saison (par équipe avant 2005-06), et son résultat est commité.

**Référence d'avant 2005 = l'équipe la plus dépensière, lissée à moitié.** Au prorata pur, une équipe médiane de 1989-2004 revient à ~50 M$ 2026 contre 85-92 M$ depuis 2005-06 : le plafond ne mord plus. On garde les écarts individuels (aubaines, contrats trop chers) mais on mélange à parts égales le prorata et la valeur du même rang centile dans les cap hits réels de 2023-26 (`LISSAGE_AVANT_PLAFOND = 0,5` dans `js/ratings.js` ; 0 = prorata pur, 1 = rang pur et écarts effacés). Équipe médiane des années 1990 : 64-68 M$.

- [x] **M1** — **Lancer l'Action en mode `full`** pour que les shards portent les unités spéciales (fait le 8 septembre 2026, 55 shards, 48 blocs d'équipe) : le build garde maintenant `ppg`, `ppp`, `shg`, `shp` par patineur et le bloc `an` par équipe (`team/powerplay`, depuis 1977-78), `build_lancers.mjs` en tire les colonnes [9] et [10], et le moteur lit tout ça dès que c'est là. Ensuite : `node scripts/build_lancers.mjs`, `LIGUES=5 node scripts/check_feuilles.mjs` (qui compare la part des buts d'avantage simulée à la réelle), et régler `AN_QUALITE` sur ce chiffre. À valider au premier passage : les noms des champs de `team/powerplay` (`ppOpportunities`, `ppGoalsFor`) et du point `team` (`triCode`), écrits d'après la documentation publique, le build tolère un renommage en laissant le bloc vide et en l'écrivant sur stderr.
