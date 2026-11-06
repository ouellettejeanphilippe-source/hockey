# V25 · A2 — Une source pour trois modes : l'extrait du devis

L'extrait de `docs/refonte-v25.md` pour la tranche **A2** (5 nov. 2026), tel que `check_refonte` le juge : sa partie « Ce qui part » et sa partie « Ce qu'il touche », copiées du devis et arrêtées à ce que la tranche livre.

    node scripts/check_refonte.mjs docs/refonte-v25-a2.md

## Ce que A2 livre

- **Le hasard et le hachage ont une seule définition**, dans `js/util.js` : `generateur` (le sfc32 du moteur), `gauss`, `entierDeGraine`, `hache`. Le moteur (`js/sim.js`), Sur table (`js/table.js`), Sur glace (`js/physique.js`), le direct (`js/direct.js`), le commentateur (`js/commentaire.js`) et la foule de Sur glace (`js/sur-glace.js`) les lisent là. Les copies partent : la mulberry32 et la gaussienne de Sur glace, celle du direct et du commentateur, le hachage de la foule, `hacherMise` du moteur (les tirages purs du Rogue passent par `hache`).
- **Sur table lit les cotes sur 20 de la fiche** (`axes20`, js/niveaux.js), comme Sur glace déjà : les nombres d'une pièce (le maniement, le tir, la défense, la force, l'arrêt du gardien) viennent du rang du joueur dans sa saison, sur un dé par une seule table (`surDe`), au lieu de cinq conversions à lui sur les lectures du moteur. Pour lire sans liste, chaque joueur enregistré est rangé sous sa saison (`joueursDeLaSaison`, js/sim.js).
- **Les punitions suivent l'époque** : Sur table et Sur glace gardent leur `punir`, mais le rythme des fautes lit les chiffres du moteur (`facteurPunitionsEpoque`, js/sim.js : les occasions d'avantage de l'année, rapportées à la médiane de la table), par la saison du fautif (le plateau) ou du club (la glace).
- `VERSION_MOTEUR` S143 (les tirages purs du Rogue tombent autrement sur la même graine ; un match ordinaire se rejoue au but près).

## 7. Ce qu'il touche

- Le moteur et les trois modes : `js/util.js`, `js/sim.js`, `js/greffes.js`, `js/niveaux.js`, `js/table.js`, `js/physique.js`, `js/glace-ia.js`, `js/sur-glace.js`, `js/direct.js`, `js/commentaire.js`, `js/game.js`.
- Les règles et les docs : `.claude/rules/moteur.md`, `.claude/rules/sur-table.md`, `.claude/rules/sur-glace.md`, `docs/moteur-recalibrer.md`, `docs/structure.md`, `LIVRAISON.md`, `docs/decisions.md`, `docs/journal/2026-11.md`.
- Les juges : `scripts/check_couches.mjs`, `scripts/check_physique.mjs`, `scripts/check_verite.mjs`, `scripts/check_force.mjs`, `scripts/check_pm.mjs`, `scripts/check_pronostic.mjs`, `scripts/empreinte.json`.

## 8. Ce qui part

Chaque nom disparaît du jeu (js/, index.html, style.css, sw.js) ; `check_refonte` le vérifie. Les copies qui portaient le même nom que ce qui reste (le generateur et le gauss de js/physique.js, le hache de la foule de js/sur-glace.js) ne se nomment pas ici : `check_couches` compte les définitions, une seule chacune, dans js/util.js.

- Le hasard en double : `hacherMise` (le moteur), `hacher` (le commentateur), la mulberry32 de js/direct.js et celle de js/commentaire.js (le juge : aucune constante `0x6D2B79F5` hors de js/util.js, qui n'en a pas non plus).
- Les conversions de Sur table : `robu` (le centile de robustesse lu à la main), les formules de MA, TI, DE, FO et AR sur pctTirRelDe, passesRelDe et facteurGardienDe ; `passesRelDe` lui-même, que plus personne ne lisait.

## 8b. Ce qui reste

- hache (js/util.js) : le nombre pur tiré de mots, la seule forme ; pctTirRelDe et facteurGardienDe (js/sim.js) : les lectures du moteur que scripts/check_neutre.mjs mesure.
- `PUNITION_TOURS`, `PUNITIONS_MAX`, `FAUTES`, `HARPON.trebuche` : les règles physiques des deux modes, telles quelles ; seul leur rythme lit l'époque.
- `lancersRelDe` dans Sur table : le patin de qui va chercher beaucoup de rondelles (une lecture du moteur, pas une conversion).
