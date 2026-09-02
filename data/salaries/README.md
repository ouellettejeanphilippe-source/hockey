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
masse salariale de l'équipe la plus dépensière de l'année (pas de plafond).

## Sources dans `sources/`

| Fichier | Contenu | Origine |
|---|---|---|
| `nhlnumbers_2016-2021.csv` | 1 673 joueurs : cap hit 2016-17 et 2017-18, salaire contractuel 2016-17 à 2020-21 (tel que connu en juin 2019) | `salaries_data.csv` du dépôt GitHub stanley-l/nhlnumbers (données nhlnumbers.com) |
| `2016-17_kaggle_camnugent.csv` | 874 joueurs, salaire 2016-17 | jeu de données Kaggle « Predict NHL Player Salaries » (Cam Nugent), copie dans le dépôt GitHub bradklassen/Predicting_NHL_Salaries |
| `capredictor_contracts_2007-2021.csv` | 645 contrats : cap hit, durée, saison précédant la signature | dépôt GitHub AliRZ-02/CaPredictor (MIT), données CapFriendly |
| `manual_<saison>.csv` | colonnes `player,team,salary` | à coller à la main depuis n'importe quelle source (USA Today, hockeyzoneplus, markerzone, PuckPedia…) |

Couverture actuelle : complète pour 2016-17 et 2017-18, partielle de
2008-09 à 2024-25 (joueurs sous contrat pluriannuel connu). Rien avant
2008-09 : les bases historiques (hockeyzoneplus.com, markerzone.com, USA
Today) ne sont pas accessibles depuis l'environnement de build. Pour les
ajouter, déposer un `manual_<saison>.csv` puis :

```bash
python3 scripts/build_salaries.py
python3 scripts/build_shards.py --rerate
```

Les cap hits sont préférés aux salaires de l'année (c'est le cap hit qui
compte sous le plafond). Un nom ambigu dans la saison est ignoré plutôt
que deviné.
