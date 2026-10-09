# Équilibrer sans casser le jeu

9 octobre 2026. JP : *je me demande s'il n'y a pas moyen que le code soit mieux organisé, et que changer certaines mécaniques ait moins de chance de briser le jeu lorsqu'on tente d'équilibrer*.

## Le diagnostic, mesuré

Le moteur n'est pas en cause : il est déterministe et bien testé. La fragilité vient de trois choses.

1. **Les chiffres d'équilibre sont éparpillés.**
   - 746 constantes en majuscules dans 30 fichiers, dont 203 dans `js/sim.js`, qui fait 8 783 lignes.
   - L'économie du Rogue vit dans six fichiers : `rogue.js`, `packs.js`, `inventaire.js`, `club.js`, `rarete.js`, `rogue-jeu.js`.
   - Dans les formules, il y a 271 nombres non nommés dans `sim.js` et 181 dans `ratings.js`.
2. **Les tests recopient au lieu de lire.**
   - Des valeurs du jeu sont réécrites dans les scripts : `PCT_TIR_MAX`, les bornes de rareté, `MIN_SAL`. La règle « revendre à 40 % au plus » n'existe que dans `check_packs`.
   - La fabrique de ligue (`function ligue`) est recopiée dans 35 scripts, et les copies divergent déjà.
   - 16 des 18 vérifications rapides tirent une seule graine. Certaines prennent « la 4e saison du dossier », qui change dès que l'Action ajoute une saison.
3. **Les juges de l'équilibre ne tournent pas en CI.** C'est le cas de `check_cartes`, `check_packs`, `check_combat`, `check_robot` et `check_rogue`. Et rien ne vérifiait qu'un réglage du moteur fait monter `VERSION_MOTEUR`. Or une saison en cours se rejoue : si on l'oublie, une sauvegarde rejoue un autre passé en silence. La PR #166 l'a oublié (les positions multiples).

Il y a aussi des couplages :
- `banque.js`, une règle, importe `formeDe` de `gerant.js`, un écran ;
- sept modules d'interface forment un cycle (game, repechage, alignement, banc, fiche, partie, rogue-jeu) ;
- `sim.js` porte environ 990 lignes de contenu (`MOMENTS`, `MUTATIONS`, `CARTES`…).

## Le plan, des filets d'abord

Chaque étape de refonte garde les matchs identiques au bit près (`check_empreinte`), ce qui protège les sauvegardes.

| # | Action | Coût | Preuve |
|---|---|---|---|
| 1 | **L'empreinte du moteur** : une ligue fixe, avec des saisons nommées et des cartes brillantes, hachée. Une refonte garde le hachage ; un réglage le change et doit faire monter `VERSION_MOTEUR` ou `RATINGS_VERSION`. | fait (V5) | `check_empreinte`, en CI et dans `tout.mjs` |
| 2 | **Un banc d'essai partagé**, `scripts/lib/banc.mjs` : `ligue(graine, n)` avec une seule règle, `enPaires`, `surGraines` (médiane et intervalle). Les 35 scripts y migrent un par un. | ~1 à 2 sessions | même verdict avant et après ; plus aucune `function ligue` locale |
| 3 | **Les tests lisent les constantes** au lieu de les recopier : exporter `PCT_TIR_MAX`, les bornes de rareté, `REVENTE_MAX` (que le jeu applique) ; tout `check_*` passe par `verdict.mjs`. | ~1 h | `check_recopies` (neuf) |
| 4 | **Les juges de l'équilibre en CI**, chaque semaine ou par étiquette : `check_cartes`, `check_packs`, `check_combat`, `check_robot` et `check_rogue` (réduits). | ~25 min de CI | le workflow |
| 5 | **Plus de loterie** : chaque repère décimal (une borne, un seuil) se juge sur la médiane de 3 graines ou plus ; une saison se nomme, elle ne se compte pas dans le dossier. | ~15 scripts | `GRAINES=1,2,3,4,5 node scripts/tout.mjs` vert |
| 6 | **`js/reglages.js`, l'économie d'abord** : chaque réglage porte sa valeur, son unité, sa plage permise et les scripts qui le jugent. | ~1 session | `check_reglages`, `check_empreinte` inchangée |
| 7 | **`scripts/equilibrer.mjs X=…`** relance seulement les juges des réglages touchés, sur plusieurs graines, et dit l'écart. | ~150 lignes | son verdict |
| 8 | **`reglages.js`, le moteur ensuite** : les 31 réglages `ENV_MESURE` et environ 60 constantes du moteur. | ~1 session | `check_empreinte` au bit près |
| 9 | **Découper `sim.js`** : le contenu d'abord (environ 990 lignes), puis le hasard, le lancer, les lignes, les unités spéciales, la ligue et les séries. `sim.js` reste une façade qui réexporte tout. | 3 à 4 sessions | `check_empreinte` à chaque fichier extrait |
| 10 | **Séparer la règle de l'interface** : `formeDe` sort de `gerant.js`, `inventaire.js` est coupé en deux, le cycle des sept modules est brisé (`js/etat.js`). | ~2 sessions | `check_couches` (neuf) |

Ordre conseillé : 1 → 3 → 2 → 5 → 4 (les filets), puis 6 → 7 (l'économie et la commande d'équilibrage), puis 8 → 9 → 10.
