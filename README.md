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

Pour la base complète — 1970-71 à aujourd'hui, tout joueur à 10+ matchs :

```bash
python3 scripts/build_shards.py
```

Environ 120 requêtes à l'API officielle de la LNH, 5 minutes. Requiert Python 3 et Node 18+, aucune dépendance à installer.

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

Le salaire découle de la cote globale par une courbe exponentielle sur l'échelle salariale actuelle.

## La simulation

82 matchs joués un par un. Les trios comptent 34/28/22/16 %, les paires 40/34/26 % — ton quatrième trio pèse pour vrai. Le partant prend environ 68 départs.

Buts tirés d'une loi de Poisson autour d'espérances calculées depuis l'attaque, la brigade défensive et le gardien. Un match sur quatre est éreintant, où la robustesse d'équipe ajuste la défensive. Les égalités passent en prolongation, tranchée par le clutch.

Avec 23 joueurs de cote uniforme : cote 60 donne 47-31-5, cote 70 donne 67-13-1, cote 99 donne 81-1-0. Même une équipe parfaite perd en moyenne un match. Le 82-0 reste rare, c'est voulu.

## Documentation

- [CLAUDE.md](CLAUDE.md) — conventions et règles pour les agents de code
- [AGENTS.md](AGENTS.md) — même chose, pour Jules et compagnie
- [ARCHITECTURE.md](ARCHITECTURE.md) — pourquoi le découpage par saison, les trois sources de données
- [PLAN.md](PLAN.md) — état du projet, ce qui reste à faire

## Données

Source : API publique de la LNH (`api.nhle.com/stats/rest`). Non affilié à la LNH.
