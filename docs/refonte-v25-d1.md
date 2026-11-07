# V25 · D1 — Les composants et la feuille, le Rogue seul : l'extrait du devis

L'extrait de `docs/refonte-v25.md` (§ 4 D, § 7, § 8 D1, § 10) pour la tranche **D1** (7 nov. 2026 ; JP, 5 nov. : *D1 sur le Rogue d'abord, D2 avec son devis*). Cette PR en livre la **première partie** (D1a) : le module de composants, zéro surcharge de mode, la case en carte en composant nommé, et le juge `check_composants`. La suite (D1b) est nommée au bas, avec ce qu'elle fera partir ; LIVRAISON.md garde D1 à [~] jusqu'à elle.

    node scripts/check_refonte.mjs docs/refonte-v25-d1.md

## 1. Ce que JP a dit

JP (4 nov. 2026) : *refais tous les écrans, de zéro* ; *garder les cartes actuelles du jeu, pas les refondre* ; *pourquoi tu refais pas tout le UI au complet ?* ; *faut arrêter de juste changer la peinture*. JP (5 nov.) : *D1 sur le Rogue d'abord, D2 avec son devis* ; les écrans des autres modes sur une seule direction, la A du Rogue.

## 2. Ce que le joueur ressent

Rien de neuf à l'œil sur les douze pages du Rogue : c'est le but. Ce qui change est dessous : une page ne se repeint plus « en Rogue » par 112 règles posées par-dessus le 82-0 ; elle est faite des composants, et la direction A est la feuille de base.

## 3. Les règles

- **Un module de composants, `js/composants.js`**, remplace js/plateau-rogue.js : le bandeau, les jetons (onglets d'une page, filtres, vues), la carte et sa ligne, le coin, la case vide, la grille, les cellules, **la jauge** (neuve), le visage, la rangée, le billet, la marche, le podium. Les jetons portent `role` (« tab » ou « button », avec `aria-pressed`) et une classe de placement (`cls`).
- **Zéro surcharge de mode.** La classe `mode-rogue` n'est plus posée sur `body` (js/game.js) ni lue par style.css. Ce que les 112 règles `body.mode-rogue` faisaient :
  - 43 surcharges d'une ligne (la casse de phrase, la graisse 600, l'interlettrage 0,02 em de l'audit d'unslop ; les jetons de `.hub-chips`, `.ct-vues`, `.pm-tete`…) sont **fondues dans leur règle de base**, à la source (interface.md : « une surface de base se change À LA SOURCE ») ; sept surcharges à sélecteurs multiples (les bandeaux des titres, les fonds des volets) aussi ;
  - l'éclairage d'en haut (`--ambiance`) est celui du Rogue, au jeton même ;
  - l'en-tête : js/game.js ne pose ni la fiche ni le rang quand il pose les jetons (au Rogue, ils vivent sur l'affiche et la jauge du proprio) ; à Ce soir, les jetons montent dans la ligne du club quand ils sont là (`:has(#teteJetons:not([hidden]))`), un état et non un mode ;
  - ce qui reste (les jetons des segments `.seg`, les titres en bandeau, la coquille : `.navtab`, `.topbar`, `.retour-btn`, `.soustab.on`, `.live-sheet`) est rattaché à `body` sans mode : **la direction A devient la base de la coquille et des volets partagés**, comme JP l'a tranché pour D2 (une seule direction). C'est le seul endroit où D1a touche l'œil des autres modes : leurs onglets, leurs boutons d'or et leurs segments passent en casse de phrase et en jetons sombres. La fusion de ces règles dans leurs blocs de base vient avec la réécriture par sections (D1b).
- **La case en carte est un composant nommé** (js/alignement.js) : `caseEnCarte` (le Rogue : sa carte debout, `carteDeLaCase`, une ligne dessous, le ✕ qui relâche un réserviste, la case de réserve cadenassée) et `caseEnRangee` (le 82-0 et Sur table : le visage, le nom, la rangée, le ✕ qui retire), sur un socle commun (`socleDeCase`), une bande (`bandeDeCase`), des verdicts (`verdictsDeCase`) et un toucher (`toucherLaCase`) partagés — plus de `enCarte ?` dans le gabarit d'une case. La feuille la reconnaît à sa classe, `.case-carte`, et le trio qui en est fait à ses cases (`.line:has(.case-carte)`) : plus de classe posée sur `#rosterBoard`.
- **Les pages du Rogue sans gabarit à elles, la première moitié** : l'Album (`.ct-vues`), tes cartes (les onglets et les filtres de l'inventaire) et Joueurs (ses groupes) sont faits de `jetons` ; l'expérience du coach est une `jauge`.

## 4. Les chiffres

- `body.mode-rogue` : 112 → 0 sélecteurs ; `mode-rogue` posé par le jeu : 1 → 0.
- style.css : 7 299 → 7 241 lignes (D1a) ; la cible de D1, sous 6 000, attend la réécriture par sections (D1b).
- Le compte des `ctx.rogue` de js/saison.js ne monte pas (22).

## 5. Les cas limites

- **La vieille partie** : aucune clé de sauvegarde ne bouge — `check_sauvegardes`.
- **Hors ligne** : sw.js liste js/composants.js et oublie js/plateau-rogue.js — `check_coquille`.
- **Le clavier et la manette** : les jetons sont des `button` ; rien ne change à la navigation (D2) — smoke, `essai_rogue`.
- **Sur table** : la case en rangée est celle d'avant, ses nombres du plateau compris — `smoke_table`.

## 6. Ce qu'il touche

- Le jeu : `js/composants.js` (neuf), `js/plateau-rogue.js` (parti), `js/alignement.js`, `js/game.js`, `js/cartable.js`, `js/inventaire.js`, `js/joueurs.js`, `js/saison.js`, `js/rogue-jeu.js`, `style.css`, `sw.js`.
- Les juges : `scripts/check_composants.mjs` (neuf, dans `tout.mjs`), `scripts/tout.mjs`, `scripts/check_plateau.mjs`, `scripts/essai_rogue.mjs`, `scripts/check_couches.mjs`.
- Les règles et les docs : `.claude/rules/interface.md`, `LIVRAISON.md`.

## 7. Ce qui part

Chaque nom disparaît du jeu (js/, index.html, style.css, sw.js) ; check_refonte le vérifie.

- Le module d'avant : `js/plateau-rogue.js` (refait en js/composants.js).
- La surcharge de mode : `mode-rogue` (la classe posée sur la page et ses 112 sélecteurs), `en-cartes` (la classe posée sur l'alignement, ses 30 règles), `en-carte` (la classe de la case, devenue case-carte).
- Les gabarits d'une page du Rogue remplacés par les jetons et la jauge : `.ct-vue`, `.inv-onglet`, `.inv-onglets`, `.inv-filtre`, `.inv-filtres`, `.ej-jauge`.

## 7b. Ce qui reste, et pourquoi

- `carteDeLaCase`, `celluleCarte`, `celluleJoueur`, la ligne (`lineEl`), le dépôt (`permuter`, js/deposer.js), les verdicts : ce que les deux cases partagent reste un (le devis, § 4 D).
- Le carton (`cartonDe`, `carteHtml`, les 55 séries `.cs-*`) : tel quel (JP, deux fois).
- `.ct-vues` : la classe de placement de la rangée de jetons de l'Album (sa grille de colonnes égales).

## 7c. Ce que D1b fera partir (la suite, nommée ici et non à la liste du dessus)

Les gabarits que le devis nomme et que D1a n'a pas encore remplacés, parce qu'ils sont partagés avec Sur table (le tournoi) ou portent les douze pages entières : les `hub-onglets`, `hub-chips`, `hub-carte`, `hub-volet`, `hub-boite`, `hub-tuile`, `hub-table`, `hub-sheet`, `hub-barre` de js/saison.js (131 `class="hub-`), `rl-table`, `pr-bloc`, `bu-run-jauge`, `tuile-jauge`, `ff-barre`, `impact-barre`, `pk-tuile` (et les treize règles de `pk-rayon-debut`), `ct-feuille`, `inv-pl-barre`, `choix-modal`, `choix-sheet`, `main-sheet`, la grille `calj` ; le tableau triable, la feuille et le toast uniques ; style.css réécrit par sections (les jetons, les composants, le carton, plus de section du Rogue) sous 6 000 lignes ; les règles rattachées à `body` fondues dans leur bloc.

## 8. Les réglages

Aucune constante de jeu. Le plafond de `check_composants` : zéro sélecteur de mode, zéro classe de mode posée par le jeu, zéro import de js/plateau-rogue.js.

## 9. Les critères d'acceptation

- [x] Zéro `body.mode-rogue`, zéro `mode-rogue` posé par le jeu, zéro `en-cartes` — `check_composants`.
- [x] Les composants vivent dans js/composants.js et chaque page du Rogue de D1a les importe (Joueurs, l'Album, tes cartes, les Lignes, le Palmarès, Ce soir) ; aucune n'écrit une rangée de jetons ou une jauge à la main — `check_composants`.
- [x] La case en carte est un composant nommé, la case en rangée l'autre ; aucun `enCarte ?` dans leur gabarit — `check_composants`.
- [x] `check_css`, `check_mort`, `tout.mjs`, `essai_rogue`.
- [ ] D1b : les douze pages sans hybride, style.css sous 6 000 lignes par sections — `check_composants` (étendu), `check_plateau`.
- [ ] Pas une couche de peinture — `check_refonte docs/refonte-v25-d1.md`.
