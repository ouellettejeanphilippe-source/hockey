# Instructions pour agents

Ce dépôt suit les conventions décrites dans **[CLAUDE.md](CLAUDE.md)**. Lis-le en entier avant de toucher au code — il contient les règles fermes (chacune avec le script qui la prouve), la structure des fichiers, le vocabulaire et la façon de tester. On travaille dans le mode Rogue, sauf demande contraire.

Ensuite :

- **[LIVRAISON.md](LIVRAISON.md)** — le plan de travail courant et son journal : coche les cases, ajoute une ligne au journal à chaque livraison.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — pourquoi les données sont découpées par saison, et les trois sources de chargement.
- **[MOTEUR.md](MOTEUR.md)** — la simulation par événements et les mesures qui appuient chaque choix ; obligatoire avant de toucher à `js/sim.js`, avec `docs/moteur-recalibrer.md` pour la recalibration.
- **[PLAN.md](PLAN.md)** — état court du projet et décisions prises ; le pourquoi de chaque décision est dans `docs/decisions.md`.
- **[docs/](docs/README.md)** — l'historique : les décisions en long, les refontes V3 à V21, la référence du moteur, le journal par sprint.

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

## Avant de pousser

1. `node scripts/tout.mjs` et `node scripts/check_mort.mjs` passent ici ; le smoke, `check_graine`, `check_feuilles`, `check_gros` et le reste, c'est le CI (`verifier.yml`).
2. Un changement au Rogue (signature, boutique, jour à jour) : `essai_rogue`, `essai_packs`, `essai_achat` ; au moteur ou aux cartes : `check_rogue`, `check_banque`, `check_cartes`.
3. Si une formule de cote a changé : `RATINGS_VERSION` incrémenté dans `js/ratings.js`, puis `python3 scripts/build_shards.py --rerate`.
4. Si un match ne se rejoue plus pareil : `VERSION_MOTEUR` monté dans `js/game.js`, et `EMPREINTE=ecrire node scripts/check_empreinte.mjs`.
5. Les cases de `LIVRAISON.md` sont à jour et son journal a une nouvelle ligne ; une décision nouvelle a son entrée dans `docs/decisions.md`.
6. Une PR s'ouvre prête à relire, avec l'auto-merge : GitHub la fusionne dès que `verifier` est vert (CLAUDE.md, « Les PR et la fusion »). Un brouillon ou une expérience s'ouvre en brouillon, sans auto-merge.
