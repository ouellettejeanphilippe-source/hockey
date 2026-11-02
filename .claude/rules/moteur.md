---
paths:
  - "js/sim.js"
  - "js/game.js"
  - "js/impact.js"
  - "js/causes.js"
  - "js/combat.js"
  - "js/ballottage.js"
  - "js/direct.js"
  - "js/glace.js"
  - "js/commentaire.js"
  - "js/recit.js"
  - "js/apres-match.js"
  - "js/exhibition.js"
  - "scripts/calibrate_sim.mjs"
  - "scripts/mock_*.mjs"
  - "scripts/*_calibre.mjs"
  - "scripts/check_graine.mjs"
  - "scripts/check_feuilles.mjs"
  - "scripts/check_parts.mjs"
  - "scripts/check_causes.mjs"
  - "scripts/check_empreinte.mjs"
  - "scripts/check_gestes.mjs"
  - "scripts/check_prolongation.mjs"
  - "scripts/check_instantane.mjs"
  - "scripts/check_ballottage.mjs"
  - "MOTEUR.md"
  - "docs/moteur-recalibrer.md"
---

# Le moteur des matchs

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md` : avant de défaire une règle, lis sa décision. Avant de toucher à `js/sim.js` : `MOTEUR.md`, et `docs/moteur-recalibrer.md` pour la recalibration. Si un match ne se rejoue plus pareil : `VERSION_MOTEUR` monté dans `js/game.js`, et `EMPREINTE=ecrire node scripts/check_empreinte.mjs`.

- Tout le hasard du moteur passe par `hasard()` ; la même graine et les mêmes dés du jour rejouent la même saison, et chaque journée tire ses dés quand elle arrive (`deDuJour`) — `check_graine` ; un tirage pur (un dilemme, une situation, une offre) lit la graine par `entierDeGraine`, jamais par `Number(graine)` — `check_verite`.
- La ligue se joue au jour le jour : rien n'est simulé d'avance, une décision s'applique au jour dit, et les journées d'avant ne bougent pas — `check_graine`, `check_ballottage`.
- Une saison en cours se REJOUE plutôt qu'elle ne se relit ; les séries aussi. L'entracte d'un duel, lui, se rembobine au matin retenu de son match, sans rejouer la saison (JP : *rend instantané, c'est la base*) — `check_instantane`.
- Les égalités de la feuille de match tiennent — `check_feuilles` (sur table : `check_table`). Un match nul après soixante minutes va en prolongation de cinq minutes, où un sur deux se règle ; l'autre va aux tirs de barrage, dont le but fait gagner sans être marqué par personne (`fusillade`, ni aux buts de l'équipe ni à ceux contre son gardien). En séries, la mort subite se joue en périodes de vingt minutes, autant qu'il en faut (`otLongue`) — `check_prolongation`.
- Ce qui a fait le match se dit cause par cause : une carte, un badge, l'affinité, le gardien n'est dit que si, retiré seul, il changeait le lancer, avec le même dé — `check_causes`.
- La production se répartit comme la vraie saison l'a répartie — `check_parts`.
- Un geste que la ligue ne comptait pas (le temps de glace avant 1997-98, les mises en échec et les blocs avant 2005-06, les punitions tirées avant 2009-10) ne se joue que s'il s'estime en retenue, vers le passé, sur les saisons qui ont la réponse (JP, 31 oct. 2026 : *tout ce qui est logique et mathématiquement acceptable*) : le temps de glace s'écrit dans le shard (R² 0,80, `toiE`, « ≈ » à l'écran), les trois autres sont des POIDS du moteur (`zGeste`, qui frappe, qui bloque, qui attire la punition ; rang 0,53 à 0,65), jamais une stat affichée ; la fiche et Joueurs ne montrent que ce que la ligue a compté — `inferer_glace`, `inferer_gestes`, `check_gestes`. Les tirs bloqués se comptent dans la feuille sans changer le volume de lancers (0,5 par lancer au but ; un bloc blesse, le pied) ; une punition nomme qui l'a tirée, et l'alignement qui attire prend plus d'avantages (`K_TIRAGE`, la ligue ne bouge pas) — `check_gestes`, `check_feuilles` (MOTEUR.md § 4.8).
- Le direct, le sommaire et le bilan disent les mêmes buts, au caractère près — smoke.
- Aucune cote neuve, aucune mécanique neuve : une carte, un trait, un effet passent par les canaux existants — `check_combat` (chaque carte que l'adversaire peut jouer est lue par le moteur), `check_traits`. Les systèmes de ligne, la glace de chaque trio, l'appariement et la consigne du match sont partis (V18, docs/refonte-v18.md ; JP : *enlever partout*) ; la chimie d'une ligne vient de l'affinité de ses joueurs — les badges qui s'accordent (`AFFINITES`, `accordsDeLigne`), un accord au plus petit des deux —, par les canaux de la chimie (son bonus, l'action spéciale), partout, et rien ne se règle — `check_affinite`.
- On mesure une carte EN PAIRES, sinon on ne mesure rien — `check_cartes`.
