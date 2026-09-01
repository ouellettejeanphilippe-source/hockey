# Architecture

## Le problème de données

Toutes les saisons-joueurs de la LNH depuis 1970-71 à 10+ matchs, c'est environ **40 000 entrées**. En un seul fichier, ça fait 4 à 6 Mo que le joueur télécharge avant de voir quoi que ce soit. Inacceptable sur mobile, et inutile : une partie de 23 tours touche au maximum une trentaine de saisons.

## Pourquoi la saison est la bonne unité de découpage

L'unité intuitive serait l'équipe — c'est ce que la roulette sort. Mais les cotes cachées sont **normalisées par saison** : chaque joueur est mesuré en z-score contre tous les autres joueurs de son année. C'est ce qui fait que 100 points en 1982 et 100 points en 2004 ne donnent pas la même cote offensive.

Ce calcul exige le bassin complet de la ligue pour cette saison. Un shard par équipe le rendrait impossible — il faudrait de toute façon charger les 20 autres équipes pour normaliser. La saison est donc à la fois l'unité correcte et l'unité minimale.

Taille par shard : 200 à 400 Ko brut, 40 à 90 Ko en gzip (GitHub Pages sert gzip d'office). Une partie typique en charge 15 à 30. Deuxième partie : zéro téléchargement, tout est en cache.

## Trois sources, dans cet ordre

Le chargeur (`js/data.js`) essaie dans l'ordre et s'arrête au premier succès :

**1. Shards pré-bâtis** — `data/seasons/1981-82.json`, servis depuis la même origine que la page. Même origine veut dire zéro problème de CORS, ce qui est la raison principale de préférer cette voie. Un GitHub Action les régénère (`.github/workflows/build-data.yml`) manuellement ou une fois par semaine pendant la saison.

**2. API LNH en direct** — `api.nhle.com/stats/rest`, appelée depuis le navigateur, cotes calculées à la volée. Aucune donnée sur le disque. Dépend du fait que la LNH envoie les bons en-têtes CORS, **ce qui n'est pas vérifié** (voir PLAN.md, tâche D2). Le chargeur teste une fois au démarrage et retient le résultat. Quand ça marche, c'est la meilleure source pour la saison en cours, qui bouge.

**3. Seed** — `data/seed.json`, une douzaine de saisons marquantes commitées dans le dépôt. Le filet : le jeu démarre toujours, même hors ligne, même si l'API et les shards sautent tous les deux.

## Cache

IndexedDB, une entrée par saison, clé `season:1981-82`, avec la version du calcul des cotes. Un changement de formule dans `js/ratings.js` doit faire monter `RATINGS_VERSION` — ça invalide le cache et évite de mélanger des cotes calculées avec deux formules différentes dans le même alignement.

Préchargement : au démarrage, le jeu charge une saison au hasard. Pendant que le joueur lit le vestiaire, il précharge en arrière-plan les deux ou trois saisons les plus probables du prochain tour. La roulette ne devrait jamais faire attendre.

## Où vit le calcul des cotes

`js/ratings.js` — une seule implémentation, en JavaScript, utilisée à la fois par le navigateur (source 2) et par le script de build via Node (source 1). Une seule formule, un seul endroit à corriger. `scripts/build_shards.py` appelle donc `node scripts/rate.mjs` plutôt que de réimplémenter la logique en Python.

## Ce qu'on ne fait pas

**Pas de backend.** GitHub Pages sert des fichiers statiques. Aucun serveur à maintenir, aucun coût.

**Pas de sauvegarde équipe par équipe pendant qu'on joue.** L'idée était bonne — écrire au fur et à mesure — mais elle produit un cache partiel où certaines saisons ont des cotes et d'autres non, avec des z-scores calculés sur des bassins incomplets. Le shard de saison entière donne le même bénéfice sans le risque de corruption.

**Pas de hockey-reference ni hockeydb en scraping.** Leurs conditions d'utilisation l'interdisent et le HTML change sans avertissement. L'API de la LNH est publique, stable et couvre 1917 à aujourd'hui.
