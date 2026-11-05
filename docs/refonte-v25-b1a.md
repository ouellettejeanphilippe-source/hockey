# V25 · B1a — Une seule échelle de rang : l'extrait du devis

L'extrait de `docs/refonte-v25.md` pour la première moitié de la tranche **B1** (5 nov. 2026) : l'échelle. La seconde (B1b), la grammaire d'effet `js/effets.js` et `motsDe`, suit.

    node scripts/check_refonte.mjs docs/refonte-v25-b1a.md

## Ce que B1a livre

- **Une seule échelle de rang**, `NIVEAUX` (js/niveaux.js), pour le joueur, l'entraîneur, l'adjoint et la carte de jeu. Chaque niveau porte ce que le jeu en lit : `maitrise` (la force des pouvoirs d'un entraîneur de ce niveau, ×0,9 à ×1,3), `borneV` (ce qu'une carte de jeu ou un adjoint a le droit de valoir en victoires : 1 · 1 · 1,5 · 2,5 · 4), `cadre` (le métal du carton : les quatre cadres de style.css), `tirage` (sa part dans la carte rare d'un pack : 55 · 30 · 12 · 3, les deux premiers niveaux ensemble). `nomDuNiveau(k)` dit son nom avec l'étoile des deux du haut.
- **La carte de jeu porte un niveau** (`carteHtml({ niveau })`) : la gemme compte un diamant par niveau, l'imprimé dit le niveau ; une carte de joueur offerte porte son `edition`. Les pouvoirs du coach en Pilier, ★ Étoile, ★ Phénomène (`NIVEAU_POUVOIR`) ; un adjoint au sien ; les sortes du deck, les retouches de l'atelier, les identités, le plan, les réponses d'histoire, chacune au sien.
- **La banque au niveau** : les neuf cartes (js/banque.js) ont un niveau ; la carte rare d'un pack se tire par niveau (`NIVEAUX[k].tirage`) ; le filtre de l'inventaire est par niveau ; la revente par niveau reste sous 40 % du prix (`check_packs`).
- **Les restes morts** : la recrue qui progressait par sa carte (`effetCarte`, +1 % de précision après 41 matchs) ; les remboursements des déblocages partis (`PARTIS`) ; le rang de salaire d'un joueur (`rareteDeSalaire`), que plus rien ne lisait. `VERSION_MOTEUR` S144.
- **`check_effets` reprend les deux règles de `check_cartes`** (la borne par niveau, le style qui ne se paie pas en force : 0,5 V par seuil franchi) ; `check_cartes` part.

## 7. Ce qu'il touche

- Les cartes et l'échelle : `js/niveaux.js`, `js/cartes.js`, `js/adjoints.js`, `js/coachs-reels.js`, `js/pouvoirs.js`, `js/banque.js`, `js/packs.js`, `js/identites.js`, `js/partie.js`, `js/game.js`, `js/saison.js`, `js/alignement.js`, `js/gerant.js`, `js/rogue-jeu.js`, `js/profil-style.js`, `js/inventaire.js`, `js/magasin.js`, `js/repechage.js`, `js/rarete.js`, `js/sim.js`, `js/rogue.js`, `index.html`.
- Les règles et les docs : `.claude/rules/rogue.md`, `.claude/rules/moteur.md`, `.claude/rules/vocabulaire.md`, `docs/moteur-recalibrer.md`, `docs/structure.md`, `docs/structure-detaillee.md`, `LIVRAISON.md`, `docs/decisions.md`, `docs/journal/2026-11.md`.
- Les juges : `scripts/check_effets.mjs`, `scripts/check_packs.mjs`, `scripts/check_pouvoirs.mjs`, `scripts/check_relais.mjs`, `scripts/check_clarte.mjs`, `scripts/check_rogue.mjs`, `scripts/planche_cartes.mjs`, `scripts/mesure_rogue.mjs`, `scripts/empreinte.json`.

## 8. Ce qui part

Chaque nom disparaît du jeu (js/, index.html, style.css, sw.js) ; `check_refonte` le vérifie.

- Les vocabulaires de rang en trop et leurs ponts : `RARETES`, `NOMS_NIV`, `MAITRISE`, `RARETE_NIV`, `RARETE_POUVOIR`, `RARETE_SORTE`, `PALIERS_RARETE`, `rareteDeSalaire`, `rareteDuCentile`, `COTES_CARTES`, `BORNE_NIV`, `RANG_RARETE`, `RARETE_MOD`, `NIV_DE_MAITRISE`, `ORDRE_VAR`.
- Les systèmes isolés : `effetCarte`, `RECRUE_PROGRESSE`, `PARTIS`.
- Le juge cassé : `scripts/check_cartes.mjs`.

## 8b. Ce qui reste

- Les éditions d'une carte de joueur (`EDITIONS`, `NOM_VARIANTE`, `VARIANTE_PALIERS`, js/rarete.js) : la seule deuxième échelle, et elle n'habille que le joueur ; leurs clés (commune, peu, hors, rare, legendaire) nomment aussi les quatre cadres du carton de jeu dans style.css (`.tc-*`), par `NIVEAUX[k].cadre` : la peau ne bouge pas, le vocabulaire si.
- `FORCE_NIV`, `PRIX_NIV`, `RELAIS_NIV`, `SALAIRE_NIV`, `NIV_DEFAUT`, `nivDe` (js/adjoints.js) : les règles des adjoints, celles que la V24 fixe.
- `optionHtml`, `grosChiffre`, `paquetHtml`, `galonsHtml` : la tranche B2 (une carte de jeu) ; `js/effets.js` et `motsDe` : B1b.
