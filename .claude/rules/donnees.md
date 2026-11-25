---
paths:
  - "js/ratings.js"
  - "js/niveaux.js"
  - "js/traits.js"
  - "js/data.js"
  - "js/roles_ref.js"
  - "js/franchises.js"
  - "data/**"
  - "scripts/build_*.py"
  - "scripts/fetch_markerzone.py"
  - "scripts/rate.mjs"
  - "scripts/rerate.mjs"
  - "scripts/inferer_*.mjs"
  - "scripts/check_ratings.mjs"
  - "scripts/check_traits.mjs"
  - "scripts/roles_ref.mjs"
  - "scripts/recrues.mjs"
  - ".github/workflows/build-data.yml"
  - "ARCHITECTURE.md"
---

# Les cotes et les données

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md` : avant de défaire une règle, lis sa décision. Le découpage par saison : `ARCHITECTURE.md`.

- Une cote peut s'afficher (JP, 27 oct. 2026 : *enlever la règle « aucune cote à l'écran »* ; la règle d'avant était « aucune cote dans le DOM, jamais » et son smoke `sansCote`, partis). Mais une cote affichée est une cote que le moteur JOUE, jamais un chiffre qu'il ignore : *une OV, c'est « telle carte est meilleure dans l'absolu », et en afficher une que le moteur ne joue pas serait mentir* (docs/refonte-v9.md). Des cotes sur 20, une par chose qu'on fait (Tir, Passes, Défense, Robustesse, Avantage, Désavantage ; Arrêts, Charge, Présence pour un gardien : `AXES`, js/niveaux.js), en cloche (un 19 ou un 20 est rare), jamais une cote générale (JP, 28 oct.) : docs/cotes-sur-20.md, `lesCotes`. À la fiche, elles font un hexagone (`radarHtml`, js/fiche.js ; JP, 30 oct. : *un genre de chart à la FIFA*) ; sous une carte de l'alignement, aucune cote. Sans jouer le jeu aux cotes (JP : *on veut éviter quelque chose de trop basé sur les cotes*) : le niveau, les icônes, les vraies stats se lisent d'abord, la cote est un appui.
- Une seule implémentation des cotes (`js/ratings.js`, partagée par le build et le navigateur) ; toucher une formule, c'est incrémenter `RATINGS_VERSION`.
- La valeur est relative à la saison par construction ; la force d'équipe suit le vrai classement — `check_ratings` (corrélation autour de 0,8).
- Un joueur-saison ne peut habiller qu'une équipe.
- **Une saison n'entre aux données qu'une fois finie** (JP, 25 nov. 2026 : *ne pas utiliser saison en cours dans le shard* ; avant, le 24 oct. : *pas avoir de cartes de cette année*, l'entrée à la mi-saison) : une saison en cours n'a pas de shard. Celle que le calendrier dit en cours (d'octobre à juin) ne s'écrit que lorsque tous ses clubs ont joué le même nombre de matchs, 80 au moins (`saison_finie`, `MATCHS_D_UNE_SAISON`, scripts/build_shards.py) ; en juillet, elle est finie quoi qu'il en soit. L'Action du lundi ne fait que la regarder. Un shard bâti de l'API tient au moins `JOUEURS_PAR_CLUB_MIN` (12) joueurs par club, sinon rien ne s'écrit (le 23 nov. 2026, l'API en a rendu 145 sur 639 et l'Action l'a commité : main est resté rouge). Sans shards, le jeu suit la même règle par la date : le 1er mai (js/data.js `allSeasonLabels`) — `check_actions` (chaque photo a son joueur).
- Pas de scraping de hockey-reference ni hockeydb ; les salaires réels arrivent par `data/salaries/sources/`.
