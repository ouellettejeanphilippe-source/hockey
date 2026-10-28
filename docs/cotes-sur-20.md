# Les cotes sur 20

27 octobre 2026. JP : *enlever la règle « aucune cote à l'écran »* ; *on pourrait faire des cotes comme le jeu de table, mais sur 20, ce qui brise pas le jeu de table si on met un dé de vingt au lieu de six, et ferait des cotes plus fines pour le roguelike* ; *on veut éviter quelque chose de trop basé sur les cotes quand même, mais on a plusieurs fois vu que cette règle nous a empêchés de faire quelque chose de mieux* ; *rendre clair la performance attendue du joueur, de façon visible et simple, comme l'écran de lineup* (GM Connected).

## Ce qui change dans les règles

La règle « aucune cote dans le DOM, jamais » et son smoke `sansCote` sont partis. Ce qui reste, et qui est une raison de design, pas une règle d'écran : **une cote affichée est une cote que le moteur joue**. Le 16 octobre, on avait refusé une OV parce qu'elle dit *telle carte est meilleure dans l'absolu*, et que le moteur ne joue pas une OV (docs/refonte-v9.md). Les systèmes de ligne sont partis depuis (V18) ; reste à ne pas afficher un chiffre inventé.

## Le garde-fou : pas un jeu aux cotes

JP veut des cotes sans que tout se joue à qui a le plus gros chiffre. Donc :
- **Le chiffre est un appui, pas le centre.** Le niveau (Soutien à Phénomène), les icônes, les vraies stats et le salaire restent ce qu'on lit en premier ; la cote est un petit chiffre à côté.
- **Aucun tri ni choix par défaut à la cote** : l'effectif se trie comme avant, un pack ne se juge pas à la cote.
- **Un joueur se choisit pour ce qu'il fait** (ses rôles, l'accord de son trio, sa case) : la cote dit combien, pas quoi.
- **Pas de cote cachée du moteur qui sort telle quelle** : une cote affichée vient d'une fonction de `js/ratings.js` (jamais `o d r c v sp` copiés dans un gabarit).

## L'échelle : 1 à 20

- **OV** (la cote générale) : le rang du joueur dans sa saison et à son poste, déroulé sur 20. Les cinq niveaux restent les paliers : le bas de Soutien est à 1, le haut de Soutien à 8, Régulier 9 à 12, Pilier 13 à 16, Étoile 17 à 19, Phénomène 20. Entre deux paliers, une courbe continue (les mêmes seuils que `NIVEAUX`, js/niveaux.js : la moitié du haut, 20 %, 4 %, 1 %). Gretzky 1981-82 est 20 ; un Régulier typique, 10. Relative à sa saison par construction, comme tout le reste : un 17 de 1982 vaut un 17 de 2004.
- **Quatre axes** pour un patineur : Tir, Jeu, Défense, Robustesse (les quatre familles, `famillesDe`, js/sim.js). Chacun, un écart à la ligue de sa saison déroulé sur 20 (la moyenne à 10, un écart type à 3 points). Un gardien : l'OV et l'arrêt.
- **Le jeu de table** : ses axes (PA, MA, TI, FO, SO, AR, de 1 à 6 ; un nombre vaut `nombre − 3` au jet) restent tels quels, lus de la même cote : `1 + ⌊5 × (cote − 1) / 19⌋`. Un dé de vingt à la place du six est possible plus tard (`nombre − 10`), sans rien casser : la cote sur 20 est la source, le 1 à 6 en est une lecture.

## Où elle s'affiche (une maison chacune)

1. **La fiche d'un joueur**, au verso : l'OV et les quatre axes, avec la vraie stat à côté de chacun.
2. **L'écran Lignes** : une petite pastille d'OV par joueur, à la façon de GM Connected, et la moyenne du trio. Les cartes de l'écran prennent les couleurs de l'équipe de chaque joueur (JP : *imagine avec les couleurs des joueurs de leurs équipes*).
3. **La signature** : l'arrivant face au sortant, l'OV et les quatre axes en tête de la comparaison stat par stat.
4. **La performance attendue** : par ligne et par match, en vraies stats (« ≈ 0,9 but par match, ≈ 28 tirs »), lue du moteur (`espP`, js/impact.js), jamais la cote elle-même.

Les cartes de joueur (le recto) ne changent pas : leur pastille de niveau reste. Une OV sur le recto, comme les cartes de GM Connected, est à décider par JP.

## Comment on le tient

- `cote20(p)` et `axes20(p)` dans `js/ratings.js` (une seule implémentation, partagée par le build et le navigateur) ; toucher la formule, c'est incrémenter `RATINGS_VERSION`.
- `check_cotes` : l'OV tombe dans la tranche de son niveau, monte avec le rang, est relative à la saison (Gretzky 20, un Soutien sous 9), la lecture 1 à 6 du jeu de table redonne les axes d'aujourd'hui, la cote ne change ni un tirage ni une feuille (`check_graine`, `check_empreinte`).

## Décision du 28 octobre : pas d'OV, des cotes par chose qu'on fait

JP : *les cotes, pas un OV, mais selon tir, arrêts, défense, passes, etc.* L'écran ne montre plus de cote générale. Un patineur a quatre cotes sur 20 — **Tir, Passes, Défense, Robustesse** (les quatre familles, `axes20`, js/sim.js) ; un gardien, ses **Arrêts** (`cote20` aux buts évités, `lesCotes`, js/repechage.js). Elles s'affichent aux Lignes (T, P, D), à la comparaison de la signature (une rangée chacune) et à la fiche. `cote20` (l'OV) reste le calcul des arrêts d'un gardien et du rang ; il n'est plus dit tel quel.
