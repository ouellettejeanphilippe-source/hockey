# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Avant de coder

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `PLAN.md` — il contient l'état exact du projet, ce qui est fait, ce qui reste, et l'ordre de priorité. Coche les cases au fur et à mesure et ajoute une ligne au journal en bas.

## Structure

```
.github/workflows/build-data.yml  Action : bâtit les shards depuis l'API LNH et
                            les commite (modes bios, rerate, seed, full). C'est
                            la voie pour ajouter les dates de naissance quand
                            l'API n'est pas joignable depuis le poste de travail
index.html                  page unique (barre de plafond, roulette, tableau de
                            bord, deux volets vestiaire / alignement, modales)
style.css                   tous les styles, mobile d'abord (390 px), deux
                            volets à partir de 1080 px
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
scripts/calibrate_sim.mjs   tableau de calibration de la simulation (banc uniforme)
scripts/check_monotonie.mjs améliorer son équipe la rend-elle meilleure ? (vraies équipes)
scripts/mock_zones.mjs      le malus de zone ferme-t-il l'empilement ?
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

**Mobile d'abord.** Cible 390 px de large. Teste à cette largeur avant de déclarer une tâche terminée. Rien ne doit déborder horizontalement de `document.documentElement` — seuls les conteneurs prévus (bande du tableau de bord, tableaux du résultat) défilent en x.

**Pas de titre de page.** La barre du haut ne porte que le plafond restant, le compte de signés, le budget par case et les trois accès (historique, règles, options). Le nom du jeu vit dans l'onglet du navigateur, pas dans une bannière qui vole de la hauteur utile.

**Le tableau de profondeur est une trame de six colonnes.** `.line-slots` pose toujours six colonnes : un trio prend deux colonnes par case, une paire trois. Les rangées s'alignent donc les unes sous les autres quel que soit l'effectif de l'unité, et `align-items: stretch` garde les blocs à la même largeur — c'est `align-items: start` qui les faisait rétrécir à la largeur de leur titre.

**Le bassin se range par position, sur une colonne par poste.** Le volet du bassin est un conteneur de requête nommé `pool` ; quand il dépasse 1000 px, `.pool.by-pos` devient six vraies colonnes (AG, C, AD, DG, DD, G), sinon les en-têtes redeviennent de simples séparateurs et les cartes reprennent une grille fluide. Chaque colonne est elle-même un conteneur nommé `col` : sous 260 px la carte se compacte, sous 190 px elle perd son portrait. **Les conteneurs de requête doivent rester nommés** — sans nom, l'en-tête d'une colonne interroge la largeur de sa colonne au lieu de celle du volet, et la mise en page se défait en silence. Disposition : onglets sous 1080 px, volets empilés pleine largeur de 1080 à 1600 px (le bassin garde ses six colonnes, l'alignement s'étale dessous), côte à côte au-delà.

**La couleur d'équipe ne porte jamais du texte.** `--team-primary` et `--team-accent` teintent les fonds, bordures et lueurs. Les états sélectionnés (chips, segments d'options) utilisent `--ui-accent`, fixe, parce qu'une équipe au bleu marine ou au noir rendait le texte foncé illisible sur son propre accent.

**La carte ne porte que l'essentiel, la fiche porte tout.** Une carte du bassin montre le poste, le nom, le salaire, le chiffre clé, l'archétype, la zone d'efficacité, la case de destination et le bouton. Rien d'autre : les statistiques détaillées, l'âge, le contrat d'entrée, l'origine du salaire et l'impact sur l'alignement sont dans la fiche, à un clic. Même principe au tableau de bord — trois chiffres, l'explication en infobulle. On ne bloque pas une décision sous un mur de texte.

**Le joueur va où il rend.** `slotFitScore` dans `js/game.js` classe les cases libres par position naturelle d'abord, puis par zone d'efficacité : un joueur de calibre quatrième trio se propose au quatrième trio, pas au premier parce qu'il était vide. Les réservistes viennent en dernier.

**Le vocabulaire est celui du hockey.** Les zones s'appellent Top 6, Top 9, Bottom 6 et 4e trio chez les attaquants ; Top 4, Top 6 D, Bottom 4 et 3e paire chez les défenseurs ; partant numéro un, partant et auxiliaire chez les gardiens. Jamais « calibre 2 ».

**La couleur d'équipe passe par `getTeamAccent`** (`js/logos.js`), qui éclaircit la teinte jusqu'à ce qu'elle reste visible sur fond sombre, et sert de `--team-line` : bordure des cartes du bassin, et bordure de chaque case de l'alignement à la couleur de l'équipe du joueur qui l'occupe. La couleur brute d'une équipe sombre ne porte jamais rien.

**Toute commande visible doit fonctionner.** Si une donnée manque, on retire la commande plutôt que d'afficher des tirets : les dates de naissance (`bd`) ne sont pas dans les shards actuels, donc le tri par âge et la tuile « âge moyen » se masquent d'eux-mêmes (`agesAvailable()` dans `js/game.js`). `python3 scripts/build_shards.py --bios-only` les ajoute et tout réapparaît sans autre changement.

**Pas de localStorage pour les données de saison** — trop petit. IndexedDB, comme dans `js/data.js`.

## Recalibrer la simulation

Les constantes de `js/sim.js` sont calibrées. Repères actuels, 23 joueurs de cote uniforme, moyenne sur 12 essais :

| Cote | Fiche |
|---|---|
| 50 | 21-54-6 |
| 60 | 44-34-5 |
| 70 | 61-19-2 |
| 80 | 59-22-1 |
| 90 | 64-18-0 |
| 99 | 69-13-0 |

(Les zones d'efficacité jouent, et beaucoup : à cote uniforme 50, tout le monde est calibre 4e trio, donc les trois premiers trios sont « mal assortis » ; à cote uniforme élevée, c'est l'inverse — tout le monde est top 6, donc les 3e et 4e trios gaspillent du talent. Un alignement uniforme est le pire cas de l'un et de l'autre, et c'est voulu.)

Le palier 80 se tient au palier 70, à un ou deux matchs près. C'est un artefact du banc : douze attaquants identiques franchissent tous ensemble la frontière d'archétype de `o = 76`, et un trio de trois francs-tireurs identiques bascule en « conflit de rôles ». Un vrai vestiaire n'a jamais cette forme.

**Le vrai test de monotonie est ailleurs.** `node scripts/check_monotonie.mjs` range les 1395 vraies équipes-saisons par force, les aligne avec `autoRoster` et les fait jouer : les victoires simulées doivent monter d'un décile au suivant, sans exception. C'est ce test qui fait autorité — améliorer ses joueurs ne doit jamais rendre l'équipe pire. Si celui-ci monte et que la table ci-dessus a une marche, la marche est un artefact du banc uniforme.

Si tu changes `POIDS_TRIO`, `POIDS_PAIRE`, les exposants de `xGF`/`xGA`, la courbe du clutch, `ZONE_THRESHOLDS` ou les constantes `ZONE_PEN_*`, tu dois refaire tourner ce tableau et le mettre à jour ici et dans `PLAN.md`. La cible : une équipe parfaite perd quand même quelques matchs. Le 82-0 doit rester rare, sinon le jeu n'a pas d'enjeu.

Repère de garde-fou, avec `node scripts/mock_zones.mjs` : le meilleur alignement légal atteignable sous le plafond doit rester proche de la meilleure vraie équipe de l'histoire (indice 68,0, les Bruins de 1970-71). Il est à 69,3. Sans malus de zone il serait à 83,8, soit quinze points au-dessus de tout ce qui a existé.

`ZONE_PEN_SOUS` et `ZONE_PEN_MAX` ne tirent pas sur la même chose. Sur un alignement empilé la pénalité sature, donc seul le plafond mord ; sur une vraie équipe elle reste dessous, donc seul le coefficient mord. Un coefficient bas avec un plafond haut ferme donc l'empilement sans toucher aux vraies équipes — monter le coefficient punit les deux.

**Les zones sont calibrées sur la réalité.** Une vraie équipe aligne 6 attaquants de top 6, 4 défenseurs de top 4 et 1 partant. `ZONE_THRESHOLDS` est réglé pour que la ligue y atterrisse **en moyenne** — 6,5 / 3,9 / 1,05 mesurés sur les 1396 équipes-saisons — et non au plancher : le Canadien de 1976-77 en a neuf, Detroit la même année en a trois. Si tu retouches ces seuils, revérifie cette distribution avant tout le reste.

```bash
node scripts/calibrate_sim.mjs
```

La partie réelle se joue dans `simulateLeague` : 32 équipes (le joueur + 31 vraies équipes historiques alignées automatiquement), 82 rondes d'appariements, 1 312 matchs, avec chance, continuité des trios, blessures au prorata des matchs vraiment joués et distribution des buts et passes selon la vraie production de chaque joueur. Le moteur de match est le même que `simulate`.

## Tester

Sert la page — `python3 -m http.server 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft conscient du budget : à chaque tour il lit le plafond restant, calcule ce qu'il peut mettre sur ce choix sans passer sous le plancher pour les cases suivantes, et clique le premier `.pcard .btn-sign:not([disabled])` qui tient dans ce budget. Sinon il relance ; en dernier recours il clique `#freeCapBtn`, le bouton de la bande de secours qui retire le plus gros contrat
3. `#mainBtn` devient actif
4. Cliquer : `.result .score` affiche une fiche, `.rrow` en compte 23
5. Zéro erreur console

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne mets pas les cotes cachées dans le DOM avant la simulation. Un joueur curieux qui ouvre l'inspecteur ne devrait pas pouvoir les lire. (Actuellement elles sont dans l'objet JS en mémoire — voir PLAN.md tâche J4.)
