# Salaires réels

Un fichier `<saison>.json` par saison couverte, produit par
`python3 scripts/build_salaries.py` à partir des fichiers de `sources/`.
Quand un joueur y figure, son salaire 2026 dans le jeu est le prorata de
ce montant sur le plafond de l'année (`cap`), et sa carte affiche
« Réel » plutôt qu'« Estimé ». Les autres joueurs gardent le barème par cote.

```
{ "season": "2016-17", "cap": 73000000, "sources": {...},
  "players": { "8471675": 8700000, ... } }     # playerId LNH -> dollars de l'époque
```

`cap` : plafond officiel à partir de 2005-06 ; pour 1989-90 à 2003-04, la
masse salariale de l'équipe la plus dépensière de l'année (pas de plafond),
mesurée sur les salaires de MarkerZone. La table vit dans `SEASON_ERA_CAP`
(`js/ratings.js`) et `build_salaries.py` la lit là. 1994-95 est proraté sur
les 48 matchs du lock-out, salaires et « plafond » compris, donc le prorata
vers 2026 reste juste ; la carte montre le montant réellement versé.

## Sources dans `sources/`

| Fichier | Contenu | Origine |
|---|---|---|
| `markerzone_<saison>.csv` | 1989-90 à 2025-26, 500 à 1 500 joueurs par saison : salaire, cap hit (2005-06+), position, équipe de l'époque (avant 2005-06 seulement) | `scripts/fetch_markerzone.py`, une requête par saison (par équipe avant 2005-06) sur markerzone.com/hockey/stats/nhl/salaries.php |
| `nhlnumbers_2016-2021.csv` | 1 673 joueurs : cap hit 2016-17 et 2017-18, salaire contractuel 2016-17 à 2020-21 (tel que connu en juin 2019) | `salaries_data.csv` du dépôt GitHub stanley-l/nhlnumbers (données nhlnumbers.com) |
| `2016-17_kaggle_camnugent.csv` | 874 joueurs, salaire 2016-17 | jeu de données Kaggle « Predict NHL Player Salaries » (Cam Nugent), copie dans le dépôt GitHub bradklassen/Predicting_NHL_Salaries |
| `capredictor_contracts_2007-2021.csv` | 645 contrats : cap hit, durée, saison précédant la signature | dépôt GitHub AliRZ-02/CaPredictor (MIT), données CapFriendly |
| `manual_<saison>.csv` | colonnes `player,team,salary` | à coller à la main depuis n'importe quelle source (USA Today, hockeyzoneplus, PuckPedia…) |

Priorité quand plusieurs sources donnent un chiffre : manuel > cap hit
nhlnumbers > cap hit MarkerZone > salaire Kaggle > salaire contractuel
nhlnumbers > salaire MarkerZone > contrat CaPredictor. Les cap hits sont
préférés aux salaires de l'année (c'est le cap hit qui compte sous le
plafond) ; avant 2005-06 il n'y a que le salaire.

## Couverture (part des entrées du shard avec un salaire réel)

| Saisons | Couverture |
|---|---|
| 1989-90 à 1992-93 | 79 à 85 % |
| 1993-94 à 2003-04 | 77 à 93 % (1999-00 : 77 %) |
| 2005-06 à 2007-08 | 94 à 98 % |
| 2008-09 à 2025-26 | 99 à 100 % |

Les entrées sans salaire réel sont surtout des joueurs que MarkerZone ne
liste pas cette saison-là (rappels, contrats à deux volets d'avant 2005) ;
les lignes de MarkerZone non appariées sont des joueurs à moins de 10 matchs
dans la LNH, absents du shard. Un nom ambigu dans la saison est ignoré
plutôt que deviné, sauf si l'équipe de l'époque tranche.

Note de jeu : comme la référence d'avant 2005 est l'équipe la plus
dépensière, une équipe médiane de ces années coûte environ 50 M$ 2026 une
fois convertie, contre 85 à 92 M$ depuis 2005-06. Les vedettes restent au
même prix (Gretzky 1995-96 : 16,6 M$ 2026 ; McDavid 2018-19 : 15,0 M$),
mais le milieu de l'alignement est moins cher dans les années 1990.

## Refaire

```bash
python3 scripts/fetch_markerzone.py     # à la main, jamais dans l'Action
python3 scripts/build_salaries.py
python3 scripts/build_shards.py --rerate
```
