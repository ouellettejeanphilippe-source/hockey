# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Avant de coder

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `PLAN.md` — il contient l'état exact du projet, ce qui est fait, ce qui reste, et l'ordre de priorité. Coche les cases au fur et à mesure et ajoute une ligne au journal en bas.

## Structure

```
index.html                  page unique
style.css                   tous les styles
js/ratings.js               calcul des cotes cachées (partagé navigateur + build)
                            étage 1 : sous-cotes en z-score (exige l'API)
                            étage 2 : cote globale, salaire, archétype, zone (rejouable hors ligne)
js/data.js                  chargeur trois niveaux + cache IndexedDB
js/sim.js                   structure de l'alignement + simulation de saison + ligue complète
js/game.js                  contrôleur d'interface
scripts/build_shards.py     aspire l'API LNH, écrit les shards ; --rerate = étage 2 sans API
scripts/rate.mjs            pont Node vers js/ratings.js (étage 1 + 2)
scripts/rerate.mjs          étage 2 sur les shards existants (contrats d'entrée, salaires réels)
scripts/build_salaries.py   assemble data/salaries/<saison>.json depuis data/salaries/sources/
scripts/fetch_markerzone.py dépose les salaires publiés par MarkerZone (1989-90+) dans sources/ ; manuel, jamais dans l'Action
scripts/check_ratings.mjs   distribution des cotes, zones, archétypes, force d'équipe vs classement
scripts/calibrate_sim.mjs   tableau de calibration de la simulation
scripts/smoke.mjs           test de fumée Playwright à 390 px
data/index.json             liste des saisons disponibles
data/seasons/<saison>.json  un shard par saison
data/seed.json              filet hors ligne
data/salaries/<saison>.json salaires réels publiés (playerId -> $ de l'époque), facultatif
```

## Règles fermes

**Une seule implémentation des cotes.** `js/ratings.js` est la source unique. Le navigateur l'importe, et `scripts/build_shards.py` y accède via `scripts/rate.mjs`. Ne réimplémente jamais la formule en Python — ça produirait deux définitions qui divergent silencieusement.

**Toucher à une formule de cote veut dire incrémenter `RATINGS_VERSION`** dans `js/ratings.js`. La version est dans la clé du cache IndexedDB. Sans incrément, un joueur se retrouve avec des cotes calculées par deux formules différentes dans le même alignement.

**Deux étages de cotes.** L'étage 1 (`rateSkaters`, `rateGoalies` : sous-cotes o, d, r, c, sp) exige les stats brutes de l'API. L'étage 2 (`finalizeSeason` : cote globale, salaire, archétype `ak`, zone `lz`, contrat d'entrée `elc`) ne lit que le shard, donc `python3 scripts/build_shards.py --rerate` le rejoue sur les 55 saisons en une seconde, sans réseau. Si tu changes l'étage 2, c'est la commande à lancer ; si tu changes l'étage 1, il faut l'API. Le build normal enchaîne toujours un `--rerate` à la fin, parce que les contrats d'entrée dépendent de la première saison de chaque joueur dans toute la base et de sa cohorte d'identifiant (âge estimé quand l'API bios n'a pas donné la date de naissance `bd` ; `python3 scripts/build_shards.py --bios-only` l'ajoute aux shards existants en ~110 requêtes, et les cartes affichent alors l'âge). Règles d'époque dans `elcEra` : rien avant 1995-96.

**La cote globale est relative à la saison.** Un bonus de vedette est calculé sur le rang du joueur dans sa saison, divisé par le nombre d'équipes de la ligue cette année-là. C'est ce qui équilibre 1975 (18 équipes) et 2024 (32). Vérifie avec `node scripts/check_ratings.mjs` : la corrélation entre la force d'une équipe et son vrai classement (reconstitué des fiches de gardiens) doit rester autour de 0,8.

**Modules ES natifs, pas de build step.** `<script type="module">`. Aucun bundler, aucun transpileur, aucun `node_modules`. Le dépôt doit pouvoir être servi tel quel.

**Français québécois** dans toute l'interface et tous les commentaires. Abréviations de hockey en français : PJ, B, A, PTS, PUN, V, D, BL, MBA (moyenne de buts alloués), AG/C/AD, DG/DD.

**Mobile d'abord.** Cible 390 px de large. Teste à cette largeur avant de déclarer une tâche terminée.

**Pas de localStorage pour les données de saison** — trop petit. IndexedDB, comme dans `js/data.js`.

## Recalibrer la simulation

Les constantes de `js/sim.js` sont calibrées. Repères actuels, 23 joueurs de cote uniforme, moyenne sur 12 essais :

| Cote | Fiche |
|---|---|
| 50 | 22-53-7 |
| 60 | 53-26-4 |
| 70 | 69-12-1 |
| 80 | 75-6-0 |
| 90 | 80-2-0 |
| 99 | 81-1-0 |

(Les zones d'efficacité jouent : à cote uniforme 50, tout le monde est calibre 4e trio, donc les trois premiers trios sont « mal assortis ».)

Si tu changes `POIDS_TRIO`, `POIDS_PAIRE`, les exposants de `xGF`/`xGA`, la courbe du clutch ou les bonus de zone, tu dois refaire tourner ce tableau et le mettre à jour ici et dans `PLAN.md`. La cible : une équipe parfaite perd quand même environ un match en moyenne. Le 82-0 doit rester rare, sinon le jeu n'a pas d'enjeu.

```bash
node scripts/calibrate_sim.mjs
```

La partie réelle se joue dans `simulateLeague` : 32 équipes (le joueur + 31 vraies équipes historiques alignées automatiquement), 82 rondes d'appariements, 1 312 matchs, avec chance, continuité des trios, blessures au prorata des matchs vraiment joués et distribution des buts et passes selon la vraie production de chaque joueur. Le moteur de match est le même que `simulate`.

## Tester

Sert la page — `python3 -m http.server 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft : cliquer le premier `.card .add:not([disabled])` en boucle jusqu'à 23/23, en utilisant les rerolls quand le bassin ne contient rien de plaçable
3. `#mainBtn` devient actif
4. Cliquer : `.result .score` affiche une fiche, `.rrow` en compte 23
5. Zéro erreur console

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne mets pas les cotes cachées dans le DOM avant la simulation. Un joueur curieux qui ouvre l'inspecteur ne devrait pas pouvoir les lire. (Actuellement elles sont dans l'objet JS en mémoire — voir PLAN.md tâche J4.)
