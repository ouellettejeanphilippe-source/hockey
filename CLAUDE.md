# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs. Plusieurs modes : **le 82-0** (juste le repêchage ; la saison se simule d'un coup, les séries se regardent match par match, aucune carte), **le Rogue** (le jour à jour, le duel joué au plan que ton adjoint propose, ton coach-personnage et ses pouvoirs, la boutique, la run), **Sur table**, l'exhibition et **Sur glace** (un match 2D à la manette, à la physique crédible et aux règles complètes : deux vrais clubs, l'IA des neuf autres, la passe, le hors-jeu, les punitions, les tirs de barrage).

Un site statique, joué en local, en APK (Capacitor) ou en exe (Electron) ; il n'est plus publié en ligne. Aucun backend, aucune dépendance npm, aucun framework.

## Où on travaille

Le Rogue, tout le temps, sauf si JP demande expressément un autre mode. Le 82-0, Sur table et l'exhibition sont faits : les stats, un peu de hasard, rien de plus. Une mesure, un équilibrage, un correctif se jugent d'abord en Rogue (`scripts/lib/rogue_sim.mjs`, `check_rogue`, `essai_rogue`).

## Où vivent les règles

Ce fichier garde ce qui vaut partout. Les règles fermes de chaque terrain vivent dans `.claude/rules/`, et Claude Code les charge de lui-même dès qu'il lit un fichier de leur terrain (le champ `paths:` en tête de chacune). Un autre agent (Codex, Jules…) les lit à la main : celles du terrain qu'il touche, avant de coder.

| Terrain | Les règles | Ce qui les charge (extrait) |
|---|---|---|
| Les cotes et les données | `.claude/rules/donnees.md` | js/ratings.js, data/, scripts/build_*.py, inferer_* |
| Le moteur des matchs | `.claude/rules/moteur.md` | js/sim.js, game.js, impact.js, causes.js |
| Le Rogue : le jeu, l'économie, les textes | `.claude/rules/rogue.md` | js/rogue*.js, packs, cartes, pouvoirs, adjoints, dossiers, saison, gerant, sim |
| Sur glace | `.claude/rules/sur-glace.md` | js/physique.js, glace-ia.js, sur-glace.js, sprites.js, sons-glace.js |
| Sur table | `.claude/rules/sur-table.md` | js/table.js, plateau.js, tournoi.js |
| L'interface | `.claude/rules/interface.md` | js/, style.css, index.html |
| Le vocabulaire | `.claude/rules/vocabulaire.md` | js/, docs/ |
| Tester | `.claude/rules/tests.md` | scripts/, .github/workflows/ |

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md` : avant de défaire une règle, lis sa décision. Une règle neuve va dans le fichier de son terrain ; ici, seulement ce qui vaut partout.

## Les agents et les commandes

Dans `.claude/agents/`, des spécialistes à qui confier une question de leur terrain (l'outil Agent) : pour Sur glace, `glace-sensations` (le patin, la manette, la caméra), `glace-ia` (les neuf autres, les gardiens), `glace-graphiste` (les sprites 16 bits), `glace-son` (la foule, les sons), `glace-perf` (le téléphone) ; pour le Rogue, `rogue-design` (le fun, les vrais choix, la courbe d'une run), `rogue-equilibre` (les bornes, mesurées en paires), `rogue-economie` (les jetons, les packs, les médailles). Dans `.claude/skills/`, deux commandes : `/equilibrer <sujet>` (mesurer et proposer un réglage) et `/rapport-essai <glace|rogue> <notes>` (les reproches d'un essai ramenés à leur cause).

## Avant de coder

- `LIVRAISON.md` — ce qui est ouvert et le journal récent. Coche les cases au fur et à mesure et ajoute une entrée au journal, la plus récente en premier, selon la règle écrite en tête du journal. Le plan de la 1.0 et ses jalons, tous livrés : `docs/livraison-1.0.md`.
- `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.
- `MOTEUR.md` — la spécification de la simulation par événements, avec les mesures qui appuient chaque choix ; obligatoire avant de toucher à `js/sim.js`, avec `docs/moteur-recalibrer.md` pour la recalibration. Pour Sur glace, `docs/sur-glace.md` est l'inventaire de toutes les fonctions d'un jeu de hockey 2D, faites ou à faire, et l'ordre de travail.
- `PLAN.md` — l'état court et les décisions prises. L'histoire de chaque décision (pourquoi, ce qui a été essayé et écarté, mesuré) est dans `docs/decisions.md` ; les refontes du Rogue dans `docs/refonte-v*.md` ; le journal dans `docs/journal/` (par sprint, S7 à S80 ; par mois depuis septembre 2026, `AAAA-MM.md`).
- Pour trouver un fichier : `docs/structure.md` (une ligne par fichier), `docs/structure-detaillee.md` (la version longue).

## Structure

```
index.html            la page unique : l'en-tête du club, les sections, roulette, vestiaire, alignement, modales
style.css             tous les styles, une seule feuille écrite dans l'ordre des écrans (docs/refonte-ui.md), mobile d'abord (390 px), le rail dès 1000 px
sw.js                 travailleur de service : la coquille hors ligne (FICHIERS), les visages en cache
site.webmanifest, favicon.svg, icon-*.png   installation et icônes
fonts/                Barlow Condensed, Manrope, Noto Emoji et les polices des séries de cartes (OFL, fonts/POLICES.txt), hébergées ici
data/                 shards par saison (seasons/), index, seed, portraits.json, salaires, trophées, réputations
img/logos, img/mugs   écussons des 44 franchises et visages recadrés (scripts/logos.mjs, scripts/portraits.mjs)
img/actions           photos de match recadrées en 5:7, la face au centre (≈ 170 Mo, versionnées depuis oct. 2026 ; scripts/actions.mjs refait celles de la LNH, scripts/actions_commons.mjs les photos libres de Commons et d'Openverse, créditées au dos, scripts/actions_saisons.mjs une photo par saison, {id}-{saison}.webp ; scripts/actions_couchees.mjs les photos couchées, de la LNH comme de Commons, couchees/{clé}.webp, pour les cartes horizontales ; data/actions.json les liste)

js/                   le jeu, un module ES natif par sujet — la carte fichier par fichier : docs/structure.md
scripts/              build des données (build_shards.py, rate.mjs, rerate.mjs, portraits.mjs, actions.mjs, recrues.mjs → data/recrues.json
                      la vraie saison recrue…), vérifications (check_*.mjs, smoke*.mjs, tout.mjs qui enchaîne les rapides), les essais à la
                      main (essai_*.mjs), calibration (calibrate_sim, mock_*, *_calibre, inferer_glace et inferer_gestes : ce que la ligue ne comptait pas),
                      verdict.mjs (le juge partagé), lib/ (mort.mjs la mesure du code mort, rogue_sim.mjs la run jouée par un robot…) ;
                      la liste complète : docs/structure-detaillee.md
mobile/, desktop/     l'APK (Capacitor) et l'exe (Electron) ; seul leur code est versionné ; leur version est celle de sw.js (build.gradle la lit), et .github/workflows/publier.yml les fabrique et les publie en release à chaque version neuve sur main (l'APK signé par les secrets CAP82_KEYSTORE_B64 et CAP82_KEYPASS)
mobile/assembler-www.mjs  www/ de l'APK : sans data/salaries ni data/seed.json, JS regroupé en lots et minifié,
                      CSS minifié (esbuild, devDependency de mobile/ seulement ; --brut pour s'en passer),
                      cartes de sources à côté dans www-cartes/ ; la liste hors ligne de sw.js est réécrite
docs/                 l'historique et la référence (voir docs/README.md)
```

## Le code et les tests

- Modules ES natifs, pas de build step, aucune dépendance npm.
- `sw.js` liste tout ce que la page charge — `check_coquille`.
- Zéro code inutile : aucune déclaration morte, aucun `export` ni import de trop, aucune classe CSS sans élément — `check_mort`. Un petit outil qui sert à plusieurs modules va dans `js/util.js`, pas dans une copie de plus.
- Un chiffre qu'on imprime sans le juger est un chiffre que personne ne relit : chaque script passe par `scripts/verdict.mjs`, qui pose le code de sortie.
- Un test de fumée qui dépend du tirage n'est pas un test, c'est une loterie.
- Français québécois, partout.

## Les PR et la fusion

JP (11 oct. 2026) : Claude fusionne quand le CI est vert. Après avoir ouvert une PR, Claude y active l'**auto-merge** (squash ou merge, selon ce que le dépôt permet) : GitHub la fusionne seul dès que la vérification `verifier` passe au vert sur main. Il n'attend pas de relecture humaine, sauf si JP dit « attends-moi » pour une PR précise. Si le CI est rouge, la PR reste ouverte et Claude la répare. Une PR qui ne doit pas partir (un brouillon, une expérience) s'ouvre en brouillon, sans auto-merge.

## Avant de pousser

**Avant de pousser** (JP, 13 oct. : *c'est nécessaire de tester ici et en CI ?*) : ne relance pas ici ce que `verifier` refait. Ici, seulement `node scripts/tout.mjs` et `check_mort` (quelques secondes, un rouge en CI coûte une demi-heure), plus ce que le CI ne fait pas, quand le changement touche leur terrain : `essai_rogue`, `essai_packs`, `essai_achat` pour la signature, la boutique ou le jour à jour du Rogue ; `check_rogue`, `check_banque`, `check_cartes` quand on touche au moteur ou aux cartes. Le smoke, smoke_table, `check_gros`, `check_graine`, `check_feuilles` : le CI.

Chaque script, son temps et ses variables : `.claude/rules/tests.md`.

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne montre pas une valeur brute du coffre privé `RATINGS_VAULT` (js/sim.js : `o d r c v sp`) : une cote qui s'affiche vient d'une fonction de `js/ratings.js` qui la dérive (la cote sur 20), la même que le moteur lit, jamais d'un champ interne copié dans un gabarit. (L'ancienne règle « aucune cote dans le DOM » est partie le 27 octobre 2026.)
