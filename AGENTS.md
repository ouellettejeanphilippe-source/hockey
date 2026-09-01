# Instructions pour agents

Ce dépôt suit les conventions décrites dans **[CLAUDE.md](CLAUDE.md)**. Lis-le en entier avant de toucher au code — il contient les règles fermes, la structure des fichiers et la procédure de recalibration.

Ensuite :

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — pourquoi les données sont découpées par saison, et les trois sources de chargement.
- **[PLAN.md](PLAN.md)** — état du projet, tâches restantes par ordre de priorité, journal des changements.

## Démarrage rapide

```bash
python3 scripts/build_shards.py --seed-only   # ~10 saisons, 2 minutes
python3 -m http.server 8000                   # les modules ES exigent http://
```

Puis ouvre http://localhost:8000.

Pour la base complète (1970 à aujourd'hui, ~120 requêtes, 5 minutes) :

```bash
python3 scripts/build_shards.py
```

## Avant de soumettre

1. Le test de fumée de CLAUDE.md passe
2. Zéro erreur console à 390 px de large
3. Les cases de PLAN.md sont à jour et le journal a une nouvelle ligne
4. Si une formule de cote a changé : `RATINGS_VERSION` incrémenté dans `js/ratings.js`
5. Si la simulation a changé : tableau de calibration refait dans CLAUDE.md et PLAN.md
