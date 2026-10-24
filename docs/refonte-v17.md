# V17 · Le plan de match

JP, 24 oct. 2026, sur la capture d'un duel (l'intention « Les punitions », huit menus à régler) : *je veux plus ce système de matching* ; *ça devrait être des choix avant le match et pendant, mais plus stratégiques, genre tirer plus, suivre un joueur de près, qqchose qui change vraiment le match, mais sans briser les équipes au complet*. JP a tranché : **pour tous les matchs**.

## 1. Ce qui change

| Avant (V13) | V17 |
|---|---|
| Au duel, leur intention se contre en réglant ton tableau : le système de chaque unité, la consigne, le geste ; chaque réglage qui mord est une porte | Avant chaque match, tu choisis **ton plan** : un levier de hockey, avec son gain et son prix en vraies stats. Pas de casse-tête : aucun plan n'est « la bonne réponse » à leur intention |
| Seuls les gros matchs ont des choix pendant | Pendant un match regardé en direct, tu changes ton plan aux entractes ; un gros match garde ses trois périodes, avec un plan à chaque entracte |
| Leur intention, le seul levier qui « change le match » | Leur plan s'annonce encore, pour l'info : tu le lis au dépistage et à l'entracte |

## 2. Les plans

Les mêmes leviers que l'adversaire, sur les canaux qui existent : les intentions (`INTENTIONS`, js/sim.js), la consigne du match (`d.match`) et les canaux d'équipe. Une icône garde son sens : 🥷 l'ombre, ⛔ fermer le centre, 🐗 l'assaut, 🦂 les punitions sont les mêmes des deux côtés.

| Plan | Ce qu'il fait | Son prix |
|---|---|---|
| ⚖ Ton match | rien : ton alignement tel quel | — |
| 🌧 Tirer de partout | plus de tirs | moins de précision, plus d'usure des jambes |
| 🥷 Coller leur vedette | leur meilleur marqueur, nommé, tire moins et finit moins bien | ton joueur qui le colle crée moins |
| ⛔ Fermer le centre | moins de tirs contre, et de moins bonne qualité | moins de tirs pour toi |
| 🐗 Forechecker fort | plus de tirs, de la pression | plus de punitions, plus d'usure, plus de tirs contre en échappée |
| 🧊 Rester discipliné | moins de punitions | moins de mises en échec, moins de tirs |

**La borne** : un plan change la FORME du match, pas sa force. Sur une saison, joué tous les soirs, le net d'un plan tient sous la borne d'une commune (±1 V), et il se voit dans la feuille (au moins ±2 tirs, ou ±0,5 punition, ou ±0,3 point à la ligne de la vedette collée). Aucun plan ne domine : chacun est le meilleur contre au moins un type d'adversaire (`check_plans`).

## 3. Où ça se joue

- **Avant le match** : Effectif › Dépistage, sous tes chances, « Ton plan » en tuiles à coins vifs ; toucher l'envoie. Le plan reste celui de la veille tant que tu n'y touches pas. Une décision `match` du jour, qui porte `plan` (et `vise`, le joueur collé).
- **Pendant** : un match regardé en direct s'arrête aux deux entractes, le temps de dire « Garder » ou de changer de plan pour la période qui vient. Les périodes vues ne bougent pas : c'est la mécanique des périodes du duel, étendue à tout match regardé.
- **Le gros match** : ses trois périodes restent, et l'enjeu aussi (le butin, ou sonnés). Avant chacune, leur plan s'annonce et tu choisis le tien. Plus de tableau, plus de portes, plus de « contrée ».

## 4. Ce qui part

Le tableau du duel (`lireLeTableau` pour le joueur, l'écran de huit menus, les portes pleines et à moitié, la contrée qui se retourne contre eux), `check_tableau`, et les règles fermes qui les nomment. `check_duel` devient la mesure du duel joué au plan : deux clubs égaux, le plan bien choisi contre « Ton match » tout le long, qui reste sous 60 % en face à face.

## 5. Les tranches

| Tranche | Ce qu'elle fait | Ce qui la prouve |
|---|---|---|
| 1. Les plans | `PLANS` dans le moteur, la décision `plan` d'un match et d'une période | `check_plans` (en paires : la borne, se voit, aucun ne domine), `check_graine` |
| 2. Avant le match | « Ton plan » sous Effectif › Dépistage ; le robot choisit le sien | `essai_rogue`, `check_rogue` |
| 3. Pendant | le direct s'arrête aux entractes ; le duel au plan, le tableau part | `check_duel` récrit, `check_gros`, `essai_rogue` |
| 4. Les règles | CLAUDE.md, docs/decisions.md, le journal | `check_mort`, `tout.mjs` |
