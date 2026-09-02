# Cap 82-0

Bâtis un alignement de 23 joueurs de la LNH — n'importe quelle saison depuis 1970-71, n'importe quelle équipe y compris les franchises disparues — sous le plafond salarial, et vois si ta formation peut faire une saison parfaite.

Chaque tour, la roulette sort une saison et une équipe. Tu piges dans ce vestiaire-là. Tu vois les vraies stats et le salaire. Les cotes cachées — offensive, défensive, robustesse, clutch — ne sortent qu'à la simulation.

## Jouer

Le jeu est un site statique. Aucun serveur, aucun compte.

```bash
python3 scripts/build_shards.py --seed-only   # ~10 saisons, 2 minutes
python3 -m http.server 8000
```

Ouvre http://localhost:8000. Les modules ES exigent `http://`, pas `file://`.

L'écran est celui d'un directeur général : la jauge de plafond et le budget par case restante en haut, la roulette et le tableau de bord dessous, puis le vestiaire et l'alignement. Le vestiaire se range par position — une colonne par poste sur grand écran, des sections empilées sur téléphone. Sur téléphone, vestiaire et alignement se prennent par onglets ; sur écran large, l'alignement reste sous les yeux. Chaque carte de joueur dit où il irait, ce qu'il coûte en part de plafond, ce qu'il te resterait après, et si sa position lui vaut une pénalité.

Pour la base complète — 1970-71 à aujourd'hui, tout joueur à 10+ matchs :

```bash
python3 scripts/build_shards.py
```

Environ 120 requêtes à l'API officielle de la LNH, 5 minutes. Requiert Python 3 et Node 18+, aucune dépendance à installer.

Pour refaire seulement la cote globale, les salaires, les archétypes et les zones (aucun réseau, une seconde) :

```bash
python3 scripts/build_shards.py --rerate
node scripts/check_ratings.mjs      # distribution des cotes et cohérence avec les vrais classements
```

## Publier sur GitHub Pages

1. Pousse le dépôt
2. Settings → Pages → Source : `main`, dossier `/`
3. Onglet Actions → « Bâtir les données » → Run workflow

L'Action génère les shards et les commite. Un rafraîchissement hebdomadaire tient la saison en cours à jour.

## Comment les cotes sont calculées

Elles sont dérivées des vraies stats, pas inventées, et **normalisées par saison**. Chaque joueur est mesuré en z-score contre ses contemporains. C'est ce qui fait que 100 points en 1982 et 100 points en 2004 ne donnent pas la même cote offensive — sinon les années 80 écraseraient tout.

| Cote | Dérivée de |
|---|---|
| Offensive | points/match, tirs/match, points en avantage numérique |
| Défensive | +/-, points en désavantage, temps de glace, tirs bloqués, bonus positionnel pour les défenseurs |
| Robustesse | minutes de punition/match, mises en échec (2005+) |
| Clutch | buts gagnants et en prolongation |

Gardiens : Technique (% d'arrêts), Blindage (moyenne de buts alloués), Robustesse (charge de travail), Clutch (blanchissages, % de victoires).

La cote globale ajoute un bonus de vedette calculé sur le rang du joueur dans sa saison, divisé par le nombre d'équipes de la ligue cette année-là : un top-10 des marqueurs vaut la même chose en 1975 qu'en 2024. Les 100+ points de l'ère moderne tombent entre 88 et 99.

Le salaire suit un barème par cote globale sur le plafond de 95,5 M$ (cote 70 → 2,3 M$, 80 → 5,6 M$, 88 → 11,5 M$, 99 → 18,5 M$). Un joueur de 100+ points coûte 12 à 18 M$, un défenseur de première paire 9 à 14 M$, et le premier contrat d'un joueur de 24 ans ou moins est un contrat d'entrée plafonné selon l'époque (rien avant 1995-96, base + bonis ensuite). Quand un salaire réel publié existe (`data/salaries/`), il remplace le barème au prorata du plafond de l'année ; pour 1989-90 à 2003-04, le « plafond » est la masse salariale de l'équipe la plus dépensière.

Chaque joueur porte aussi un archétype classique (franc-tireur, fabricant de jeu, attaquant de puissance, défenseur offensif…) et une zone d'efficacité (calibre 1er, 2e, 3e ou 4e trio) : un trio où tout le monde est dans sa zone gagne un bonus de chimie.

## La simulation

Une ligue complète : ta formation plus 31 vraies équipes historiques (tirées des saisons sorties par la roulette, alignées automatiquement), 82 matchs chacune, 1 312 matchs. Les trios comptent 34/28/22/16 %, les paires 40/34/26 % — ton quatrième trio pèse pour vrai. Le partant prend environ 68 départs.

Buts tirés d'une loi de Poisson autour d'espérances calculées depuis l'attaque, la brigade défensive et le gardien, avec une part de chance par match et un « PDO » d'équipe pour la saison. Un match sur quatre est éreintant, où la robustesse d'équipe ajuste la défensive. Les égalités passent en prolongation, tranchée par le clutch. Un trio qui reste intact gagne en continuité ; un joueur qui a raté des matchs dans sa vraie saison se blesse plus souvent et laisse sa place à un réserviste. Buts et passes sont distribués selon la vraie production de chaque joueur cette année-là. Classement, meneurs, infirmerie, puis séries 4 de 7 pour les 16 premiers.

Avec 23 joueurs de cote uniforme contre la moyenne de la ligue : cote 60 donne 53-26-4, cote 70 donne 69-12-1, cote 99 donne 81-1-0. Même une équipe parfaite perd en moyenne un match. Le 82-0 reste rare, c'est voulu.

## Documentation

- [CLAUDE.md](CLAUDE.md) — conventions et règles pour les agents de code
- [AGENTS.md](AGENTS.md) — même chose, pour Jules et compagnie
- [ARCHITECTURE.md](ARCHITECTURE.md) — pourquoi le découpage par saison, les trois sources de données
- [PLAN.md](PLAN.md) — état du projet, ce qui reste à faire

## Données

Source : API publique de la LNH (`api.nhle.com/stats/rest`). Non affilié à la LNH.
