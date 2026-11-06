# V25 · B2 — Une carte de jeu : l'extrait du devis

L'extrait de `docs/refonte-v25.md` pour la tranche **B2** (6 nov. 2026 ; JP : *Continuer le plan*). B1 (docs/refonte-v25-b1a.md, -b1b.md) a posé l'échelle `NIVEAUX` et la grammaire d'effet ; B2 ne laisse qu'un squelette de carte de jeu, et un choix se fait entre des cartes.

    node scripts/check_refonte.mjs docs/refonte-v25-b2.md

## Ce que B2 livre

- **Il n'y a qu'une carte de jeu, `carteHtml`**, et un choix, c'est deux ou trois cartes de jeu côte à côte (JP, 5 nov. : *trois petites côte à côte*). La tuile de choix (`optionHtml`, js/gerant.js) part avec son gros chiffre (`grosChiffre`) et sa branche sobre (`LIGNES_MAX`) : chaque écran qui l'appelait — la Boîte et ses histoires, le proprio, les rivaux, les plans de l'adjoint au duel, la carte de vestiaire d'un avant-match, le choix d'un fil, « Ton plan », les déblocages, le club, le départ d'une run — dessine des cartes de jeu, chacune au niveau de ce qu'elle offre, sa forme (Cadeau, Échange, Pari) dans son type, son visage ou son écusson dans sa fenêtre, ses couleurs de club sur son carton (`varsCarton`, les rivaux), son verso disant ses lignes dérivées (`pucesDeFace`, les mêmes mots que `motsDe`, plus le `bon` et le `prix` écrits d'un avant-match ou d'un fil jusqu'à la tranche C) et ce qu'elle fait (`versoDe` : son texte, sa sous-ligne, l'enjeu, « Rien ne change »). Trois cartes tiennent de front à 390 px ; à deux, elles se font face ; à quatre et plus (les plans du duel avec « Garder », les rivaux), la main se balaie ; une liste (`compact` : tes cartes en main, Ton club, Ton plan) se range en grille de trois. Une petite carte retournée se rapproche : son verso grossit par-dessus ses voisines, pour se lire.
- **Le coach est une carte** : la plaque de l'entraîneur au Bureau › Coach (`.ej-coach-tete`) devient une carte de jeu au genre des pouvoirs, aux couleurs de son vrai club, son niveau d'entraîneur en cadre, son club et sa saison en type, sa philosophie et sa maîtrise au verso, le niveau du personnage en coin (`.ej-rang`), sa jauge et sa règle à côté, ses trois pouvoirs en cartes dessous comme aujourd'hui.
- **La pochette** fusionne le paquet de récompense (`paquetHtml`, le carton scellé qu'on touche pour ouvrir) et le sachet de la boutique (`.pk-sachet`) en un seul objet, `pochetteHtml` (js/cartes.js), à deux états nommés : **scellée** (achetée, elle attend dans « Déjà à toi » jusqu'à sa date limite, `DATE_LIMITE_MATCH`, remboursée en fin de run ; une plaque au métal de son pack) et **récompense** (une série, un jalon, un palier : elle s'ouvre devant toi, luit de sa meilleure carte, et sa vedette sort en walkout dès ★ Étoile).
- **Les galons gardent leur effet et perdent leur écran** (JP, 5 nov.) : le bloc « Les galons de la saison » du Palmarès et de « Ta run » (`galonsHtml`, js/rogue-jeu.js ; sa scène `sceneDesGalons`) part ; un galon se lit au verso de la carte du joueur (« Gravé sur sa carte », js/fiche.js), avec son match et son adversaire, et il monte toujours son badge pour la run (`check_galons`).
- **`check_hauteur`** (neuf, dans `verifier.yml` après le plateau) : à 390 × 844, un choix ouvert par la vraie porte avec une scène, un joueur nommé et trois cartes tient en un écran sans défiler, les trois cartes de front font un pouce chacune, chaque nom se lit (le joueur, la plaque de chaque carte, 9 px au moins), la carte retournée grossit d'une fois et demie et ses lignes se lisent ; la règle d'interface.md « jamais trois étroites côte à côte » est défaite et réécrite.

## 7. Ce qu'il touche

- La carte et ses écrans : `js/cartes.js`, `js/gerant.js`, `js/saison.js`, `js/rogue-jeu.js`, `js/alignement.js`, `js/magasin.js`, `js/scenes.js`, `js/glisser.js`, `js/util.js`, `style.css`.
- Les juges : `scripts/check_hauteur.mjs` (neuf), `scripts/check_lisibilite.mjs`, `scripts/check_plateau.mjs`, `scripts/check_clarte.mjs`, `scripts/smoke.mjs`, `scripts/essai_rogue.mjs`, `scripts/essai_packs.mjs`, `scripts/essai_achat.mjs`, `scripts/essai_depart.mjs`, `scripts/lib/paquet.mjs`, `.github/workflows/verifier.yml`.
- Les règles et les docs : `.claude/rules/interface.md`, `.claude/rules/tests.md`, `docs/structure.md`, `docs/structure-detaillee.md`, `LIVRAISON.md`, `docs/journal/2026-11.md`, `docs/decisions.md`.

## 8. Ce qui part

Chaque nom disparaît du jeu (js/, index.html, style.css, sw.js) ; `check_refonte` le vérifie.

- Les squelettes en trop : `optionHtml`, `grosChiffre`, `paquetHtml`, `motsDeCarte`, `LIGNES_MAX` (la branche sobre de detailDe, qui ne servait qu'à la tuile), `classeOption`, et leurs classes `.choix-option-nom`, `.choix-option-gros`, `.choix-option-bon`, `.choix-option-prix`, `.choix-option-sous`, `.choix-option-mut`, `.choix-option-visage`, `.choix-forme`, `.af-options`, `.paquet`, `.paquet-scene`, `.pk-sachet`, `.pk-tier`, `.pk-dent`, `.ej-coach-tete`, `.ej-coach-qui`, `.ej-coach-ico`.
- Le bloc des galons au Palmarès : `galonsHtml`, `galonsDeCetteSaison`, `sceneDesGalons`, `.run-galons`, `.run-galons-l`.
- Les champs d'une tuile que la carte ne lit pas : `bonHtml`, `prixHtml` (la face dit ses lignes dérivées, B1b) ; le bande des rivaux (leurs couleurs vont sur le carton, couleurs).

## 8b. Ce qui reste

- `cartonHtml`, `carteCouchee`, `dosDeCarton`, les 55 séries `.cs-*`, les éditions Base à Holo : la carte de joueur ne bouge pas d'un pixel (JP, deux fois) ; seul le nom d'une carte de JEU (`.cs-jeu`) a un plancher et deux lignes, pour se lire sur une carte d'un pouce.
- `.choix-option` : la racine d'une option dans un choix (le relief, le survol, l'envol d'une carte jouée, `.on` quand elle est gardée, `.ouvre` quand elle ouvre un écran) ; elle n'habille plus que des cartes de jeu.
- `.tc`, `.tcj-*`, `.tcv-*`, `rectoDeJeu`, `pucesDeFace`, `FACE_MAX`, detailDe, « Les chiffres » : la carte de jeu et sa lecture.
- `ouvrirChoix`, `ouvrirDuel`, `sceneDuDe`, les scènes, `spec.cartes` (une fête : la pochette, la donne, le plein écran) : la porte d'un choix, pas son dessin.
- `packsScelles`, `DATE_LIMITE_MATCH`, le remboursement en fin de run, le walkout (`vedette.walkout`), `brancherPaquet` et les quatre temps de la feuille (`paquet-ferme`, `paquet-dechire`, `paquet-pile`, `paquet-fini`), les keyframes `paquet-flotte`, `paquet-pouls`, `paquet-reflet` : les règles et le geste de la pochette, qui ne changent pas.
- `GALONS`, `graverLaSaison`, `histoireChezToi`, `monteBadge` : les galons jouent et se gravent ; seul leur bloc du Palmarès part.
- `bon`, `prix` sur `AVANT_GROS`, `AJUSTEMENTS` et `CHOIX_DES_FILS` : la tranche C les refait en histoires ; d'ici là, la carte les dit en lignes verte et rouge.
