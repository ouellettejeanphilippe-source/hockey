# Plan

État au 11 novembre 2026 : version 3.7.1 (`sw.js`), moteur S148 (`js/game.js`), cotes v31 (`js/ratings.js`), refonte V28 (le Rogue est une run en carte ; l'ancien Rogue est parti). **Le plan de travail courant est `LIVRAISON.md`**, avec son journal ; ce fichier ne garde que l'état court et les décisions. L'histoire de chaque décision est dans `docs/decisions.md`, les « À faire » d'avant la 1.0 dans `docs/plan-historique.md`, le journal par sprint (S7 à S80) et par mois dans `docs/journal/`, le plan de la 1.0 et ses jalons dans `docs/livraison-1.0.md`.

## Fait

- **Fondations** (F1 à F7) : modules ES natifs sans build, cotes normalisées par saison, courbe salariale, alignement de 23, simulation calibrée.
- **Données** (D1 à D9, M1) : 56 shards par saison depuis l'API LNH (55 au jeu, la saison en cours attend ses 41 matchs), chargeur trois niveaux avec IndexedDB, Action `build-data.yml` (la saison en cours chaque lundi), salaires réels, unités spéciales par patineur et par club depuis 1977-78 ; le temps de glace inféré avant 1997-98 (oct. 2026, `scripts/inferer_glace.mjs`) ; les revirements et les punitions tirées (2005-06+, 2009-10+) ; les mises en échec, les blocs et les punitions tirées estimés avant leur collecte comme des poids du moteur (`zGeste`, `scripts/inferer_gestes.mjs`), les blocs comptés dans la feuille, les punitions tirées jouées, les départs de qualité (31 oct., MOTEUR.md § 4.8).
- **Jeu** (J1 à J9, les sprints S7 à S80) : roulette, vestiaire et loto, saison au jour le jour, séries match par match, gros matchs, mode Rogue, Sur table, exhibition, packs, cartable, album.
- **La 1.0** (28 septembre au 15 octobre 2026) : livrée — les cases de `LIVRAISON.md`, jalons 0 à 5, `v1.0.0`, l'APK.
- **Les refontes V3 à V22** (octobre 2026, `docs/refonte-v*.md`) : le Rogue refait — les fils et la lancée (V3), la boîte où tout se règle (V4), le duel en trois périodes et les plans (V9, V13, V17), le jeu de cartes neuf et les moments (V10), une maison par sujet (V12), les histoires du lundi (V20), le coach-personnage et ses pouvoirs (V21), la banque d'événements et les adjoints refaits à neuf — une main, des séjours, un style (V22), l'affinité à la place des systèmes de ligne (V18), les cotes sur 20 et l'hexagone (27 au 30 oct.).
- **Les refontes V23 à V28** (novembre 2026) : le banc de cinq, le duel à un choix, les élites (V27) ; puis **la V28**, le Rogue refait de zéro, mécanique et écrans ensemble (JP, 9 nov. : *un change l'autre*) — une run en carte comme Slay the Spire (la carte de l'acte, la feuille du soir, le match en temps forts, trois portes ; trois actes, deux cœurs, des séries en 3 de 5 ; toutes les années ensemble ; le plafond qui mord), sur le simulateur gardé ; l'ancien Rogue (le Bureau, le jour à jour, la boutique, 56 noms et 20 000 lignes) supprimé le 11 nov. (`docs/refonte-v28.md`, `docs/refonte-v28-4.md`) ; la méta réécrite le même jour (tranche 5a, `docs/refonte-v28-5.md`) : les médailles n'achètent que de la variété au Club, entre deux runs, trois crans d'exigence après une Coupe, les déblocages d'avant remboursés une fois.

## À faire

Une ligne chacun. Ce qui est engagé vit dans `LIVRAISON.md` ; le reste attend là (« Après la 1.0 · idées notées »).

- [ ] **S1** — Mode « défi du jour » : une graine par date, la même suite de roulettes pour tous.
- [ ] **S2** — Mode deux joueurs : repêchage en alternance, puis série 4 de 7.
- [ ] **S5** — Étendre avant 1970 (le +/- manque avant les années 1960 ; le temps de glace s'infère maintenant).
- [ ] **S8** — Vrais classements pour `check_ratings.mjs` (Hockey Databank).
- [ ] **La possession par joueur** : les vols et les revirements sont dans les shards (2005-06+) et à la fiche, mais la possession se lit au club ; un canal par joueur serait une mécanique neuve, à mesurer en paires avant. *Mesuré (V25 A3, 7 nov. 2026, `check_suppression`) : en retenue 2013-2025, les vols moins les revirements ne battent pas la cote défensive du club et ne s'ajoutent pas au gardien ; la possession par joueur n'entre pas.* Pas les mises au jeu ni le clutch tant que le moteur ne les joue pas.
- [ ] **V29, le build décide** (JP, 13 et 14 nov. 2026, docs/refonte-v29.md) : la porte 2 de la V28 est ratée à l'essai ; une pièce de banc comptera tes joueurs (l'origine et les badges) et multipliera un canal du match par marches, trois pièces dès le camp, « dur, mais ça explose ». La mesure d'un jour est faite (`mesure_build` : le bâtisseur 31 Coupes sur 48 contre 12) ; le jeu ne change qu'à la tranche 1, après `/revue-design`.
- [x] **Lire paie, et *tu peux exploser le jeu*** (V28, tranchés par JP le 11 nov. 2026) : mesuré sur 384 graines, lire paie déjà (61 % de cibles tenues contre 54 %, +7,6 points, bruit ±4,3) et 6,5 % des runs explosent ; JP ne change rien et accepte 7 % (borné de 5 à 12 %). Deux leviers mesurés et écartés : le prix qui suit la valeur, moins de candidats par porte (docs/decisions.md). Jugés à la main : `GRAINES=384 FILS=3 ROBOTS=malin,chiffre node scripts/mesure_run.mjs`.
- [x] **La méta, tranchée par JP** (11 nov. 2026, docs/refonte-v28-5.md § 10) : le solde des déblocages à plein prix ; ton club en médailles ; deux pochettes, pas de sorte en médailles.
- [x] `check_pouvoirs` à l'échantillon plein (N=600, hors du CI) : vert le 11 nov. 2026, le banc remesuré sur un acte de six matchs (docs/refonte-v28-4.md) ; l'usure et le choc, qui ne se voyaient pas le 2 nov., se voient.

## Décisions prises

**Découpage par saison, pas par équipe.** La normalisation en z-score exige le bassin complet de la ligue pour l'année. Détail dans ARCHITECTURE.md.

**Pas de sauvegarde progressive équipe par équipe.** L'idée produisait un cache où certaines saisons ont des z-scores calculés sur des bassins partiels. Le shard de saison entière donne le même bénéfice de taille sans le risque.

**Pas de scraping de hockey-reference ni hockeydb.** Conditions d'utilisation, et leur HTML change sans préavis.

**Pas de backend.** Un site statique, publié sur GitHub Pages depuis `main` ; rien à maintenir.

**Web seulement** (JP, 4 nov. 2026 : *oublie APK et exe, on développe maintenant web only*). L'application Android (Capacitor, `mobile/`), l'exe Windows (Electron, `desktop/`), leur release (`publier.yml`) et tout le code qui ne servait qu'à eux sont partis ; la version Web suit `main` toute seule (`js/mise-a-jour.js`). Le pourquoi : `docs/decisions.md`.

**La valeur est relative à la saison, pas absolue.** Un rang statistique dans sa saison, à son poste, projeté sur la distribution historique ; un top-10 des marqueurs vaut la même chose en 1975 et en 2024. Une équipe exceptionnelle ou nulle peut encore déséquilibrer sa saison, c'est voulu : on équilibre les époques sans effacer la réalité. Mesuré par `scripts/check_ratings.mjs` (corrélation force ~ classement autour de 0,8).

**Une cote affichée est une cote que le moteur joue.** Pas de cote générale à l'écran ; des cotes sur 20, une par chose qu'on fait, en cloche (`docs/cotes-sur-20.md`). Le niveau, les icônes et les vraies stats se lisent d'abord.

**Pas de scraping de sites de salaires depuis le build.** Les salaires réels arrivent par `data/salaries/sources/` (fichiers déposés, provenance documentée), jamais par un scraper dans l'Action. `scripts/fetch_markerzone.py` est un outil de dépôt qu'on lance à la main, une requête par saison (par équipe avant 2005-06), et son résultat est commité.

**Référence d'avant 2005 = l'équipe la plus dépensière, lissée à moitié.** Au prorata pur, une équipe médiane de 1989-2004 revient à ~50 M$ 2026 contre 85-92 M$ depuis 2005-06 : le plafond ne mord plus. On garde les écarts individuels (aubaines, contrats trop chers) mais on mélange à parts égales le prorata et la valeur du même rang centile dans les cap hits réels de 2023-26 (`LISSAGE_AVANT_PLAFOND = 0,5` dans `js/ratings.js` ; 0 = prorata pur, 1 = rang pur et écarts effacés). Équipe médiane des années 1990 : 64-68 M$.

**Un chiffre inféré se joue dans un canal qui existe et se prouve en retenue.** Le temps de glace d'avant 1997-98 est prédit des colonnes de toutes les époques, ajusté sur 2010-2025 et éprouvé vers le passé sur 1997-2005 (R² 0,80 et 0,67) ; il fait les zones, la mesure défensive et les rôles, pas la valeur (qui compterait la production deux fois) ; la fiche le dit « ≈ » (`docs/decisions.md`, 31 oct. 2026).
