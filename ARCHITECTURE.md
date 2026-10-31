# Architecture

## Le problème de données

Toutes les saisons-joueurs de la LNH depuis 1970-71 à 10+ matchs, c'est environ **40 000 entrées**. En un seul fichier, ça fait 4 à 6 Mo que le joueur télécharge avant de voir quoi que ce soit. Inacceptable sur mobile, et inutile : une partie de 23 tours touche au maximum une trentaine de saisons.

## Pourquoi la saison est la bonne unité de découpage

L'unité intuitive serait l'équipe — c'est ce que la roulette sort. Mais tout ce qui se calcule d'un joueur est **relatif à sa saison** : les sous-cotes cachées sont des z-scores contre tous les joueurs de son année ; le niveau (Soutien à Phénomène) et les cotes sur 20 sont des rangs dans sa saison, à son poste ; les rôles se lisent en écart au régulier moyen de l'année ; le temps de glace inféré d'avant 1997-98 se calcule sur les réguliers et les clubs de la saison. C'est ce qui fait que 100 points en 1982 et 100 points en 2004 ne valent pas la même chose.

Ces calculs exigent le bassin complet de la ligue pour cette saison. Un shard par équipe le rendrait impossible — il faudrait de toute façon charger les 20 autres équipes pour normaliser. La saison est donc à la fois l'unité correcte et l'unité minimale.

Taille par shard : 200 à 400 Ko brut, 40 à 90 Ko en gzip. Une partie typique en charge 15 à 30. Deuxième partie : zéro téléchargement, tout est en cache.

## Trois sources, dans cet ordre

Le chargeur (`js/data.js`) essaie dans l'ordre et s'arrête au premier succès :

**1. Shards pré-bâtis** — `data/seasons/1981-82.json`, servis depuis la même origine que la page. Même origine veut dire zéro problème de CORS, ce qui est la raison principale de préférer cette voie. Une GitHub Action les régénère (`.github/workflows/build-data.yml`) : à la main (modes `full`, `bios`, `rerate`, `seed`), et chaque lundi pour la saison en cours seulement (`--refresh-current`). Une saison n'entre à l'index qu'à 41 matchs joués par ses clubs (`MATCHS_POUR_JOUER`) : avant, ses cartes se liraient fausses.

**2. API LNH en direct** — `api.nhle.com/stats/rest`, appelée depuis le navigateur, cotes calculées à la volée. Aucune donnée sur le disque. La LNH n'envoie pas d'en-tête CORS : le chargeur le sonde une fois au démarrage (`probeLive`) et retient le résultat, donc cette voie ne sert que là où la requête passe (l'application Android, un navigateur sans la règle). Quand ça marche, c'est la meilleure source pour la saison en cours, qui bouge.

**3. Seed** — `data/seed.json`, dix saisons marquantes commitées dans le dépôt (de 1970-71 à 2022-23, des franchises disparues comprises). Le filet du Web : le jeu démarre toujours, même hors ligne, même si l'API et les shards sautent tous les deux. L'APK ne l'emporte pas (`mobile/assembler-www.mjs`, `HORS_APK`) : il a les shards sur le disque.

## Cache

IndexedDB, une entrée par saison, clé `season:1981-82`, avec la version du calcul des cotes. Un changement de formule dans `js/ratings.js` doit faire monter `RATINGS_VERSION` — ça invalide le cache et évite de mélanger des cotes calculées avec deux formules différentes dans le même alignement.

Préchargement : au démarrage, le jeu charge une saison au hasard. Pendant que le joueur lit le vestiaire, il précharge en arrière-plan les deux ou trois saisons les plus probables du prochain tour. La roulette ne devrait jamais faire attendre.

## Où vit le calcul des cotes

`js/ratings.js` — une seule implémentation, en JavaScript, utilisée à la fois par le navigateur (source 2) et par le script de build via Node (source 1). Une seule formule, un seul endroit à corriger. `scripts/build_shards.py` appelle donc `node scripts/rate.mjs` plutôt que de réimplémenter la logique en Python.

Le calcul a deux étages. L'étage 1 transforme les stats brutes de l'API en sous-cotes (offensive, défensive, robustesse, clutch, vitesse) en z-score contre la saison. L'étage 2 (`rerateShard`) ne lit que ce qui est déjà dans le shard : le temps de glace inféré quand la ligue ne le comptait pas (`glaceInferee`, avant 1997-98 : prédit des buts, passes, lancers, unités spéciales, punitions et du rang au club, éprouvé en retenue par `scripts/inferer_glace.mjs`, marqué `toiE`), puis la valeur (un rang dans la saison, projeté sur la distribution historique du poste), le salaire, l'archétype, la zone de déploiement (le rang du joueur dans son club au temps de glace, mesuré ou inféré : `zonesDuDeploiement`) et le contrat d'entrée. `scripts/rerate.mjs` rejoue l'étage 2 sur les 56 shards sans réseau, ce qui permet d'ajuster le barème salarial, les archétypes ou l'inférence sans refaire les 120 requêtes à l'API. Le contrat d'entrée dépend de la première saison du joueur dans toute la base, donc le build enchaîne toujours ce recalcul à la fin.

Ce que l'écran montre vient d'un troisième calcul, dans le navigateur et pur : le niveau et les six cotes sur 20 (`js/niveaux.js`, des rangs dans la saison, en cloche), les rôles et les badges (`js/sim.js`), les familles. Rien de ça n'est dans le shard : il se recalcule de ses colonnes à chaque chargement, et la même formule sert aux scripts (`check_cotes`, `check_familles`).

## Salaires réels

`data/salaries/<saison>.json` (facultatif) : playerId → salaire ou cap hit publié, en dollars de l'époque, avec le plafond de l'année. Quand un joueur y figure, son salaire dans le jeu est le prorata de ce montant sur le plafond de 95,5 M$ ; sinon, le barème par cote. Pour 1989-90 à 2003-04 (salaires publiés, pas de plafond), le plafond de référence est la masse salariale de l'équipe la plus dépensière, mesurée sur les salaires publiés de MarkerZone (1994-95 proratée par le lock-out, comme les salaires), et le salaire du jeu est lissé à moitié vers la valeur du même rang centile dans les cap hits d'aujourd'hui, pour que le plafond morde autant qu'en 2026 sans effacer les aubaines (`LISSAGE_AVANT_PLAFOND` dans `js/ratings.js`). Les fichiers sont assemblés par `scripts/build_salaries.py` depuis `data/salaries/sources/` (provenance dans `data/salaries/README.md`). Aucun scraping dans le build : les sources sont des fichiers déposés dans le dépôt.

## Ce qu'on ne fait pas

**Pas de backend.** Un site statique : il se joue en local dans le navigateur, en APK (Capacitor, `mobile/`) ou en exe (Electron, `desktop/`). Aucun serveur à maintenir, aucun coût.

**Pas de sauvegarde équipe par équipe pendant qu'on joue.** L'idée était bonne — écrire au fur et à mesure — mais elle produit un cache partiel où certaines saisons ont des cotes et d'autres non, avec des z-scores calculés sur des bassins incomplets. Le shard de saison entière donne le même bénéfice sans le risque de corruption.

**Pas de hockey-reference ni hockeydb en scraping.** Leurs conditions d'utilisation l'interdisent et le HTML change sans avertissement. L'API de la LNH est publique, stable et couvre 1917 à aujourd'hui.

**Pas de chiffre inventé dans un shard.** Un champ que la ligue ne comptait pas (le temps de glace avant 1997-98) ne s'écrit que s'il est prédit de colonnes qui existent, éprouvé en retenue sur les saisons qui ont la réponse, marqué comme estimé, et lu par un canal du moteur qui existe déjà.
