# Le chiffre à tenir du coach — essai de la tranche 3 (27 oct. 2026)

**L'idée.** Chaque coach a UNE vraie stat de match ; dix matchs de suite où ton club la tient (comparée à la ligue sur les mêmes journées), c'est un bloc tenu : +1 point de confiance, au plus 3 par run. Le module pur et sa vérification sont dans `docs/chiffre-du-coach/` (`chiffre.js.txt`, `check_chiffre.mjs.txt`, la mesure en paires `paires.mjs.txt`) ; ils ne sont PAS dans `js/` : rien n'est branché, parce que deux coachs ne passent pas la preuve.

## Mesure en paires (confiance III contre rien, mêmes dés, six saisons de 82 matchs, ton club)

| Coach | Stat | Effet de la III | Tenu (club ordinaire → coach III) |
|---|---|---|---|
| Frelon | tirs par match | +4,2 | 9 % → 56 % ✓ |
| Doc | blessures par match | −0,21 | 20 % → 38 % ✓ |
| Abbé | punitions par match | −1,5 | 13 % → 41 % ✓ |
| Aigle | % au tir | +0,012 | 20 % → 34 % ✓ (mince) |
| Tortue | tirs contre | −2,5 | 9 % → 28 % ~ |
| Contremaître | part des buts des 3e et 4e trios | +0,07 | 11 % → 28 % ~ |
| Rhino | (aucune ne tient) | buts contre −0,5 ; **mises en échec −0,8** | 27 % → 22 % ✗ |
| Showman | (aucune ne tient) | buts des 2 premiers trios +0,5 | 16 % → 16 % ✗ |

## Ce que ça apprend

1. **L'écart entre deux clubs de la ligue (±0,6 but contre par match) est plus grand que l'effet de la plupart des coachs.** Une stat de buts ne distingue pas le coach de la force du club : seules les stats que le coach pousse directement (tirs, tirs contre, punitions, blessures) se lisent.
2. **Le Rhino fait baisser ses mises en échec (−0,8 par match) au lieu de les monter.** Sa promesse (« cogner ») ne se voit pas dans la feuille : c'est un défaut du coach, pas de la mesure. À régler avant de lui donner un chiffre.
3. Le Showman agit sur les minutes du 1er trio, que la feuille ne montre qu'en buts (trop bruyants à dix matchs).

## Suite

- Régler la promesse du Rhino (les mises en échec) et trouver au Showman une stat de minutes ou de tirs de son 1er trio assez forte.
- Brancher ensuite `pointsTenus` dans `buildDe` (`tenus` à côté de `joues`, js/banque.js ; banc.js et scripts/lib/cartes_robot.mjs le passent), l'afficher à la maison du coach, puis mesurer `check_coachs`, `check_voies` et `check_profondeur` (la première Coupe doit rester entre la run 3 et la run 8).

## Branché (28 oct.) : un point, et le service plus lent

Mesure `check_profondeur` (trois campagnes de quatre runs, l'attentif ; cible : la première Coupe entre la run 3 et la run 8) :

| Variante | Médiane de la première Coupe |
|---|---|
| avant la V19 | 4 |
| V19 avec le chiffre à trois points | 2,5 (trop tôt) |
| V19 sans le chiffre | 5 |
| chiffre à un point | 2 (encore trop tôt) |
| chiffre à deux points, un point de service par 120 matchs | 2 |
| **chiffre à un point, un point de service par 90 matchs** | **4** (l'attentif bat le robot d'avant de 5,0 V) |

Branché ainsi : `PLAFOND_TENUS = 1`, `MATCHS_CONFIANCE = 90`. Un point de plus venu du chiffre se paie en retardant les points de service.
