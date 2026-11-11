# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs. Plusieurs modes : **le 82-0** (juste le repêchage ; la saison se simule d'un coup, les séries se regardent match par match, aucune carte), **le Rogue** (une run en carte, comme Slay the Spire : la carte de l'acte, la feuille du soir, le match en temps forts, trois portes ; trois actes et les séries ; ton coach et son banc de cinq pièces, le marché, le plafond qui mord), **Sur table**, l'exhibition et **Sur glace** (un match 2D à la manette, à la physique crédible et aux règles complètes : deux vrais clubs, l'IA des neuf autres, la passe, le hors-jeu, les punitions, les tirs de barrage).

Un site statique, publié sur GitHub Pages depuis main, web seulement (JP, 4 nov. 2026 : *oublie APK et exe, on développe maintenant web only* ; l'application Android et l'exe Windows sont partis). Aucun backend, aucune dépendance npm, aucun framework.

## Où on travaille

Le Rogue, tout le temps, sauf si JP demande expressément un autre mode. Le 82-0, Sur table et l'exhibition sont faits : les stats, un peu de hasard, rien de plus. Une mesure, un équilibrage, un correctif se jugent d'abord en Rogue (`scripts/lib/run_robot.mjs`, `mesure_run`, `check_run`, `essai_run`). Le Rogue est la run en carte de la V28 (`docs/refonte-v28.md`) ; l'ancien Rogue (le Bureau, le jour à jour, la boutique) est parti le 11 nov. 2026.

## Où vivent les règles

Ce fichier garde ce qui vaut partout. Les règles fermes de chaque terrain vivent dans `.claude/rules/`, et Claude Code les charge de lui-même dès qu'il lit un fichier de leur terrain (le champ `paths:` en tête de chacune). Un autre agent (Codex, Jules…) les lit à la main : celles du terrain qu'il touche, avant de coder.

| Terrain | Les règles | Ce qui les charge (extrait) |
|---|---|---|
| Les cotes et les données | `.claude/rules/donnees.md` | js/ratings.js, data/, scripts/build_*.py, inferer_* |
| Le moteur des matchs | `.claude/rules/moteur.md` | js/sim.js, game.js, impact.js, causes.js |
| Le Rogue : la run, le banc, l'économie, les textes | `.claude/rules/rogue.md` | js/run*.js, rogue, pieces, actes, coachs, histoires, packs, cartes, sim |
| Sur glace | `.claude/rules/sur-glace.md` | js/physique.js, glace-ia.js, sur-glace.js, sprites.js, sons-glace.js |
| Sur table | `.claude/rules/sur-table.md` | js/table.js, plateau.js, tournoi.js |
| L'interface | `.claude/rules/interface.md` | js/, style.css, index.html |
| Le vocabulaire | `.claude/rules/vocabulaire.md` | js/, docs/ |
| Tester | `.claude/rules/tests.md` | scripts/, .github/workflows/ |

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md` : avant de défaire une règle, lis sa décision. Une règle neuve va dans le fichier de son terrain ; ici, seulement ce qui vaut partout.

## Les agents et les commandes

Dans `.claude/agents/`, des spécialistes à qui confier une question de leur terrain (l'outil Agent) : pour Sur glace, `glace-sensations` (le patin, la manette, la caméra), `glace-ia` (les neuf autres, les gardiens), `glace-graphiste` (les sprites 16 bits), `glace-son` (la foule, les sons), `glace-perf` (le téléphone) ; pour le Rogue, `rogue-design` (le fun, les vrais choix, la courbe d'une run), `rogue-equilibre` (les bornes, mesurées en paires), `rogue-economie` (les jetons, les packs, les médailles), `rogue-ux` (le parcours, une info une maison, ce que l'écran répond, le pouce à 390 px), `rogue-recit` (les histoires de la carte, les voix). Dans `.claude/skills/`, quatre commandes : `/refonte <sujet>` (un gros changement mené pour qu'il en soit un, ci-dessous), `/equilibrer <sujet>` (mesurer et proposer un réglage), `/rapport-essai <glace|rogue> <notes>` (les reproches d'un essai ramenés à leur cause) et `/revue-design <devis>` (un devis jugé avant le code, sur le gabarit `docs/gabarits/devis.md`). `rogue-ux`, `rogue-recit`, `/revue-design` et le gabarit sont adaptés de Claude-Code-Game-Studios (Donchitos, licence MIT).

## Le studio (Claude Code Game Studios 1.2.0)

Installé le 7 nov. 2026 (JP : *utilise et installe le claude code game studio pour l'utiliser dans tous les travaux futurs* ; Donchitos, licence MIT, `.claude/docs/LICENSE-ccgs.txt`). Il ajoute 49 agents et 74 commandes à côté des nôtres, ses hooks dans `.claude/settings.json` et sa config dans `project.yaml` (`rigor: minimal`, `automation: autonomous`, stade Production, aucun moteur : `engine.*` reste vide, le jeu n'est ni Godot, ni Unity, ni Unreal).

- **Tout travail passe par le studio** : la commande du studio qui correspond à la tâche (`/help` pour la trouver ; `/dev-story`, `/code-review`, `/balance-check`, `/ux-review`, `/qa-plan`, `/bug-report`, `/retrospective`…) et ses agents (`game-designer`, `systems-designer`, `economy-designer`, `ux-designer`, `ui-programmer`, `gameplay-programmer`, `qa-tester`…), à côté des nôtres.
- **Nos règles priment.** Si une consigne du studio contredit ce fichier, `.claude/rules/` ou `LIVRAISON.md`, la nôtre gagne : français québécois, aucun build ni dépendance npm, pas de GDD ni d'epics ni de stories ajoutés en double de `LIVRAISON.md` et des devis `docs/refonte-v*.md`, la fusion automatique quand le CI est vert. Un gros changement passe toujours par `/refonte` ; nos agents `rogue-*` et `glace-*` restent les spécialistes de leur terrain, ceux du studio les épaulent.
- Ses fichiers à lui : `.claude/docs/` (la référence, `effects-map.md` pour `project.yaml`), `design/`, `production/` (`production/session-state/active.md`, le point de reprise d'une session, non versionné), `docs/architecture/`, `docs/registry/`, `docs/engine-reference/`. Ses règles (`.claude/rules/*-code.md`) visent `src/`, `Assets/` et `Source/`, que ce dépôt n'a pas : nos règles de terrain s'appliquent à `js/`.

## Un gros changement

JP (4 nov. 2026) : *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne le même* ; *faut arrêter de juste changer la peinture* ; *don't just change the skin*. Mesuré : la livraison de « refais tous les écrans, de zéro » retirait 54 lignes de jeu et ajoutait 247 lignes de CSS. Quand JP dit *refonte*, *refais*, *de zéro*, *au complet*, *tout*, *gros changement* ou *pas juste la peinture* (le hook de `.claude/settings.json`, scripts/lib/gros.mjs, le rappelle à la session), la taille est décidée, et elle se prouve :

- **Avant le code**, la commande `/refonte <sujet>` : l'inventaire de ce qui existe sur le sujet, puis un devis (`docs/gabarits/devis.md`) dont la partie « Ce qui part » nomme en `code` chaque fonction, classe, bloc ou fichier remplacé, et ce qui reste avec sa raison. Un écran se refait sur maquettes, JP tranche sur les maquettes, le code reproduit la maquette.
- **Un gros changement se mesure à ce qui part**, jamais à ce qu'on ajoute par-dessus — `check_refonte <devis>` : le jeu (js/, index.html, sw.js) retire au moins une ligne pour deux qu'il ajoute, style.css fait moins de la moitié du diff, chaque nom de « Ce qui part » est parti. Rouge, ce n'est pas encore une refonte : on continue, on ne baisse pas la borne.
- **Rien à faire partir ?** Alors ce n'est pas une refonte : on le dit à JP en une ligne avant de coder, avec ce qu'on propose. Jamais une retouche livrée sous le nom d'une refonte, jamais la taille négociée à la baisse en silence.

## Une décision de design se demande

JP (11 nov. 2026) : *Ask user, always*. Ce jour-là, trois décisions de jeu avaient été prises puis signalées après coup, dans des PR déjà fusionnées (la monnaie de ton club, le solde à plein prix, des sortes de pochette pas faites).

- **Une décision de jeu ou de design se pose à JP avant le code**, par une question (l'outil de question : deux à quatre options courtes, celle qu'on recommande en premier, chacune avec ce qu'elle coûte) : une monnaie, un prix, un réglage qui change ce que le joueur vit, une chose du devis qu'on ne ferait pas ou qu'on ferait autrement. Jamais décidée, livrée, puis rangée sous « à trancher ».
- **La question se suffit** : elle redit le chiffre ou le constat dont elle dépend ; JP ne voit parfois qu'elle.
- **Ce qui continue sans demander** : mesurer, corriger un bogue, écrire un juge, tenir les documents, et la fusion au CI vert (ci-dessous).

## Avant de coder

- `LIVRAISON.md` — ce qui est ouvert et le journal récent. Coche les cases au fur et à mesure ; une entrée de journal est un fichier neuf dans `docs/journal/entrees/` (`AAAA-MM-JJ-sujet.md`), selon la règle écrite en tête du journal de `LIVRAISON.md` — jamais une ligne ajoutée en tête d'un fichier partagé, pour que deux PR n'entrent jamais en conflit. Le plan de la 1.0 et ses jalons, tous livrés : `docs/livraison-1.0.md`.
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
                      verdict.mjs (le juge partagé), lib/ (mort.mjs la mesure du code mort, run_robot.mjs les robots qui jouent la run en carte…) ;
                      la liste complète : docs/structure-detaillee.md
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

JP (11 oct. 2026) : Claude fusionne quand le CI est vert. Après avoir ouvert une PR, Claude n'a rien à activer : le travail `fusionner` de `.github/workflows/verifier.yml` la fusionne (squash) dès que `verifier` passe au vert (7 nov. 2026 ; main n'a pas de règle de protection, pour que `build-data.yml` y pousse les données du lundi). Il n'attend pas de relecture humaine, sauf si JP dit « attends-moi » pour une PR précise. Si le CI est rouge, la PR reste ouverte et Claude la répare. Une PR qui ne doit pas partir (un brouillon, une expérience) s'ouvre en brouillon, ou porte l'étiquette « attends-moi ».

## Avant de pousser

**Avant de pousser** (JP, 13 oct. : *c'est nécessaire de tester ici et en CI ?*) : ne relance pas ici ce que `verifier` refait. Ici, seulement `node scripts/tout.mjs` et `check_mort` (quelques secondes, un rouge en CI coûte une demi-heure), plus ce que le CI ne fait pas, quand le changement touche leur terrain : `essai_run` et `check_scene` (un serveur statique d'abord) pour les scènes ou la coquille du Rogue ; `FILS=3 node scripts/check_pouvoirs.mjs` et `check_moments_si` quand on touche au banc, aux moments ou à la carte de l'acte ; `GRAINES=64 FILS=3 node scripts/mesure_run.mjs` quand un réglage de la run bouge (jamais plus de trois fils ici). Le smoke, smoke_table, `check_gros`, `check_graine`, `check_feuilles` : le CI.

Chaque script, son temps et ses variables : `.claude/rules/tests.md`.

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne montre pas une valeur brute du coffre privé `RATINGS_VAULT` (js/sim.js : `o d r c v sp`) : une cote qui s'affiche vient d'une fonction de `js/ratings.js` qui la dérive (la cote sur 20), la même que le moteur lit, jamais d'un champ interne copié dans un gabarit. (L'ancienne règle « aucune cote dans le DOM » est partie le 27 octobre 2026.)
