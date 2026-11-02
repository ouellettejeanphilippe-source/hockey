# Instructions pour agents

Ce dépôt suit les conventions décrites dans **[CLAUDE.md](CLAUDE.md)**. Lis-le en entier avant de toucher au code — il contient ce qui vaut partout : le projet, la structure, le code et les tests, les PR, avant de pousser. Les règles fermes de chaque terrain (chacune avec le script qui la prouve), le vocabulaire et la façon de tester vivent dans **[.claude/rules/](.claude/rules/)** ; le tableau « Où vivent les règles » de CLAUDE.md dit lequel lire pour les fichiers que tu touches. Claude Code les charge seul ; toi, lis-les avant de coder — au moins `vocabulaire.md`, `interface.md` et celui de ton terrain. On travaille dans le mode Rogue, sauf demande contraire.

Ensuite :

- **[LIVRAISON.md](LIVRAISON.md)** — ce qui est ouvert et le journal récent : coche les cases, ajoute une entrée courte au journal à chaque livraison (la règle d'écriture est en tête du journal ; l'entrée entière va aussi dans `docs/journal/AAAA-MM.md`).
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — pourquoi les données sont découpées par saison, et les trois sources de chargement.
- **[MOTEUR.md](MOTEUR.md)** — la simulation par événements et les mesures qui appuient chaque choix ; obligatoire avant de toucher à `js/sim.js`, avec `docs/moteur-recalibrer.md` pour la recalibration.
- **[PLAN.md](PLAN.md)** — état court du projet et décisions prises ; le pourquoi de chaque décision est dans `docs/decisions.md`.
- **[docs/](docs/README.md)** — l'historique : les décisions en long, les refontes V3 à V21, la référence du moteur, le journal par sprint puis par mois, le plan de la 1.0 archivé (`docs/livraison-1.0.md`).

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
