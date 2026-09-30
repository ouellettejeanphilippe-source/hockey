# Livrer la 1.0

État au 28 septembre 2026, point de départ commit `7da2bd5` (S80). Ce fichier est le plan de travail vers un jeu livrable : sans code inutile, visuellement et mécaniquement professionnel. Coche les cases en avançant ; chaque item nomme son fichier, sa ligne, la valeur à poser et le script qui le prouve. Un correctif sans preuve n'est pas fini.

Diagnostic complet (55 constats, captures) : https://claude.ai/artifact/2GM7phTiPkSWNyaKYYvet4
Version page de ce plan : https://claude.ai/artifact/ULEA4KWRjKP4aMMkobofAu

## En une page

Le jeu n'a pas besoin d'une refonte, il a besoin d'un gel. On arrête d'ajouter, on ferme les fuites (économie, ballottage, hasard des séries), on fait dire à l'écran ce que le moteur joue, on retire ce qui ne sert plus, et on coupe le poids de moitié.

Portée de la 1.0, décision de JP (28 septembre) : **le mode Rogue est le héros**. C'est lui que le menu met en avant, lui qu'on livre poli en premier ; La saison reste le mode classique (Complet, Express, Vestiaire, Loto, Une saison, Une franchise) et profite de tout ce qui se corrige dans le moteur. Sur table reste « mode bonus » avec l'étiquette bêta tant que ses sept règles ne sont pas réparées (jalon 4). Exhibition reste un lien.

## Priorité : le Rogue d'abord

Ce qui rend un roguelike bon, dans l'ordre où un joueur de Slay the Spire ou de Balatro le ressent : (1) l'économie ne triche pas et chaque jeton compte ; (2) chaque run est différente et les choix se voient dans les résultats ; (3) la boutique et l'inventaire se lisent en une seconde ; (4) perdre donne envie de recommencer parce que le méta (écussons, jalons, cartable) avance. Le Rogue d'aujourd'hui a les quatre morceaux, mais le premier fuit, le troisième est un catalogue, et le quatrième cache son barème. Chemin de travail, à cocher dans cet ordre avant tout le reste :

- [x] **R0 · Mesurer la run.** `RUNS=40 CAMPAGNES=6 node scripts/check_rogue.mjs` (existe) : noter la première Coupe par campagne et le taux d'élimination par saison. Plus `check_robot.mjs` (jalon 0) en variante Rogue : `jouerRun` avec la boutique jouée au hasard (premier pack payable, première carte). Cibles : la Coupe arrive entre la run 3 et la run 8 ; un robot ne la gagne jamais avant la run 5.
- [x] **R1 · L'argent** : J1-A (revente), J1-B (achat avant butin), J1-C (prime de série), J1-H (pack du jour). Quatre items, un après-midi, et l'économie tient.
- [x] **R2 · Le ballottage** : J1-D. En Rogue, une réclamation coûte 10 🪙 et n'offre que des réguliers.
- [x] **R3 · Le deck** : J1-E (malédictions), J1-F (cicatrices), J1-G (le + et l'holo). Le deck qui traverse les saisons de la run devient un vrai build, pas une pile de cicatrices.
- [x] **R4 · Le barème, visible.** Nulle part à l'écran : 5/4/2 🪙 par résultat, 20 par gros match, 20 par objectif, 40 par ronde de séries (`js/rogue.js:41`), et le mandat qui plafonne à « atteindre la finale » dès la saison 4 (`mandatDe`, `:313`). Une ligne sous « 💀 La run » au hub : « Victoire 5 🪙 · prolongation 2 · gros match +20 · objectif +20 · ronde +40 ». Le mandat dit sa suite (« puis : gagner une ronde »).
  - Preuve : smoke Rogue (`essai_rogue.mjs`) exige la ligne du barème au hub, chiffres égaux à `JETONS`.
- [x] **R5 · La boutique et l'inventaire** : J2-15 (quatre packs à la première run, intro en deux phrases, légende en infobulles, Échap, roulette figée). Puis le prix de chaque pack comparé à la caisse : un pack impayable est grisé avec « il te manque 8 🪙 » (`js/magasin.js`, `render`).
- [x] **R6 · Les cartes qu'on choisit** : J2-3 (trois cartes visibles), J2-4 (puces), J2-12 (puces de la main visibles), J2-16 (texte Rogue seulement en Rogue). En Rogue, la puce « grandit : ×0,5 en octobre, ×1 en janvier, ×2 en finale » devient une jauge sur la carte (quatre crans, le cran du jour allumé) plutôt qu'une phrase.
- [x] **R7 · Le méta qui donne envie.** Le vestiaire des déblocages (`js/game.js`, « Le vestiaire · 0 écussons ») est bon ; ce qui manque : à la fin d'une run, un écran unique « Ta run » (saisons jouées, Coupe ou mandat manqué, écussons gagnés, jalon débloqué, cartes entrées au cartable) avant le retour au menu. Réutiliser le bilan (`js/bilan.js`) et `finDesSeriesRogue` (`js/game.js:1888`). Le carton Rogue du menu montre la dernière run (« Run 3 · finale · 210 🏅 ») au lieu de « 0 écussons · 0 joueurs · 0 run ».
  - Preuve : `essai_rogue.mjs` : après une run finie, l'écran « Ta run » s'ouvre une fois, ses chiffres égalent le méta sauvegardé.
- [x] **R8 · Le menu** : J2-1 avec le Rogue en carton héros (pleine largeur, fond sombre, la dernière run dessus), La saison et Sur table dessous, Exhibition en lien.
- [x] **R9 · Rejouer R0** : la Coupe entre la run 3 et 8, le robot jamais avant la run 5. Sinon, les curseurs sont la courbe des cartes (`×0,5 → ×2`, `js/rogue.js`) et le prix des packs Or et Premium.

Ensuite seulement : le reste du jalon 1 (I à Q, qui améliorent aussi le Rogue par le moteur), le reste du jalon 2, puis 3, 4, 5.

## Point de départ, mesuré

Chromium 390 × 844, cache vide, serveur local, sans minification ni compression.

| Mesure | Aujourd'hui | Cible 1.0 |
|---|---|---|
| Poids transféré au premier écran | 2 813 Ko | < 900 Ko |
| Requêtes au premier écran | 82 | < 25 |
| JavaScript chargé avant le menu | 2 064 Ko (43 modules) | < 600 Ko |
| Feuille de style | 588 Ko · 3 400 règles | < 150 Ko |
| Nœuds DOM au menu | 2 162 | < 800 |
| Menu visible | 0,7 s | < 0,5 s (< 2 s sur 4G) |
| Premier vestiaire affiché | 2,1 s | < 1,5 s |
| Plus gros module | game.js 370 Ko | ≤ 120 Ko par module |
| Docs d'agent | CLAUDE.md 608 Ko · PLAN.md 283 Ko | < 40 Ko vivant |
| Erreurs console sur deux saisons | 0 | 0 |

Scripts de vérification rapides au départ : tous verts (check_coquille, check_graine, check_deck 16, check_packs 50, check_traits, check_fiches, check_commentaire 82, check_identite, check_regles, check_ratings 0,777, check_parts, check_table, check_gros 39).

## Les cinq jalons

| # | Jalon | Ce qui est vrai à la fin | Jours |
|---|---|---|---|
| 0 | Le gel | Branche `1.0`, rien de neuf, CI verte, mesures notées, `check_robot.mjs` écrit | 1 |
| 1 | L'intégrité du jeu | Aucune boucle d'argent, aucun cadeau par blessure, l'écran dit ce que le moteur joue, le robot ne gagne pas la Coupe | 9 |
| 2 | L'interface pro | Rien de coupé à 390 px, rien de vide à 1440 px, une décision = un écran qui montre tout, des mots de hockey | 8 |
| 3 | Zéro code inutile | Exports, fonctions, sélecteurs et scripts morts retirés ; poids divisé par trois ; docs vivantes sous 40 Ko | 6 |
| 4 | Sur table sort de la bêta | Les règles écrites sont les règles jouées, mesurées par `check_regles` | 4 |
| 5 | La sortie | La liste « Fini, ça veut dire » cochée, v1.0.0, APK et Pages publiés | 3 |

Jours-personne pour un dev qui connaît le dépôt. Les jalons 1 et 2 se mènent en parallèle ; le 3 attend la fin du 2 (purger du CSS pendant qu'on le retouche coûte double).

---

## Jalon 0 · Le gel

- [x] Créer la branche `1.0` depuis `main`. Jusqu'à la sortie : aucune carte, aucun mode, aucune règle nouvelle. Chaque commit ferme un item de ce fichier et le nomme (`1.0 · J1-D ballottage`).
- [x] La CI est le juge : `verifier.yml` passe 15 vérifications ; y ajouter au fil des jalons les assertions listées sous « Preuve ».
- [x] Écrire `scripts/check_robot.mjs` avant de corriger. Harnais existant : `scripts/lib/rogue_sim.mjs` (`jouerRun`), `scripts/check_plafond.mjs` (`simulateLeague`/`playSeries`), `scripts/lib/vestiaires.mjs`. Le script bâtit un alignement « premier Signer » (tri points, premier joueur sous `maxForPick`), joue 82 matchs avec les choix par défaut (aucune carte, première option d'entracte), réclame le premier candidat au ballottage à chaque blessure ≥ 7, puis les séries sans carte. Deux passes `BALLOTTAGE=1|0`, 40 saisons.
  - Preuve : `borne('Coupe du robot', taux, [0, 0.05])`, `borne('séries du robot', taux, [0.2, 0.5])`, `informer('apport du ballottage', ΔV)`. Mesure de départ (40 saisons, sans ballottage) : fiche 45-33-4, séries 60 %, finale 3 %, Coupe 0 / 40.

## Jalon 1 · L'intégrité du jeu

### L'argent

- [x] **A · La revente ne dépasse plus le prix d'achat.** `js/inventaire.js:70` `VENTE = { commune: 2, peu: 5, rare: 12, legendaire: 30, maudite: 1 }` ; aux cotes 55/30/12/3 (`js/packs.js:113`) une carte revend 4,94 🪙 : Consommables 5 cartes/15 🪙 → 24,7 🪙 (165 %), Match et Événements 132 %, Lot 108 %.
  - Correctif : `VENTE = { commune: 1, peu: 1, rare: 2, legendaire: 5, maudite: 0 }` (1,24 🪙/carte) et `valeurDe → 0` pour `cat === 'consommable'`. Résultat : Match/Événements 33 %, Modifs/Contrats 25 %, Lot 27 %, Personnel 13 %, Consommables 0 %. `venteJoueur` (doublons) ne bouge pas.
  - Preuve : `check_packs.mjs` : pour chaque pack de cartes, `Σ n × Σ(cote × VENTE) ≤ 0,4 × prix`.
- [x] **B · L'achat s'enregistre avant le butin.** `js/game.js:1380-1381` (`ajouterCollection`, `ajouterAuCartable`) et `:1463` (`recevoirPermanents`) écrivent le méta avant `decider(dec)` (`:1478`).
  - Correctif : tirer (pur) → `decider({ jour, palier: 'k:n', achat })` → cartable et permanents → modale, dont `onChoix` n'enregistre qu'une seconde décision `k:n:signe`. À la reprise, un `achat` sans `k:n:signe` rouvre le choix (test dans `hub-choix-rouvrir`, `js/saison.js`) sans retirer le pack.
  - Preuve : `check_rogue.mjs` : décisions = [achat] sans signature → jetons débités, cartable garni.
- [x] **C · La prime de série est versée.** `js/game.js:1247-1259` `resultatsRogue` renvoie `{ W, L, OTL, gros, objectifs }` ; `js/rogue.js:51` lit `r.series` ; `finDesSeriesRogue` (`:1888`) pose `G.rogue.series.rondes`.
  - Correctif : `const series = G.rogue?.series?.rondes || 0;` et le renvoyer. Le report (`:1986`) se calcule avant la remise à zéro : il suit.
  - Preuve : `check_rogue.mjs` : `jetonsDe({ series: 3 }, …) === 160` ; une run qui gagne une ronde repart avec 40 🪙 de plus.
- [x] **H · Le pack du jour n'est jamais verrouillé.** `js/packs.js:140-144` n'exclut que deux packs ; verrous dans `packsOuvertsBoutique()` (`js/game.js:1312`).
  - Correctif : `packDuJour(date, ouverts)` filtre `ouverts[k] === true` ; appel à `:1325`.
  - Preuve : `check_packs.mjs` : 60 dates avec verrous, jamais un pack verrouillé.

### Le ballottage

- [x] **D · Un dépanneur, pas une vedette.** `js/game.js:5976` filtre ≥ 20 matchs, salaire ≤ 3 % du plafond, même groupe ; `:5984` garde les 15 meilleurs producteurs → saisons ELC des vedettes (Mogilny 84 pts à 1,13 M$, Federko 92 pts à 1,65 M$ pour une blessure de 7 matchs).
  - Correctif : `niveauDe(p, e.players) > 1 → continue` (import `js/niveaux.js` : 0 Soutien, 1 Régulier, 2 Pilier, 3 Étoile, 4 Phénomène). Garder le tri par production. En Rogue, `cout: 10` 🪙 sur la décision, lu par `jetonsRogue`. Récit : « Trois réguliers de la ligue, sous 3 % du plafond : un dépanneur, pas une vedette. »
  - Preuve : `check_ballottage.mjs` : 20 blessures rejouées, chaque candidat `niveauDe ≤ 1` et ≤ 0,9 pt/match.

### Les cartes

- [x] **E · Les malédictions du Lot ont un consommateur.** `js/packs.js:391` pige dans toutes les familles ; seul `plafond:taxe` est lu (`js/banque.js:159`).
  - Correctif minimal : `idsDe('plafond').filter(maudite)` ; le taux affiché (1 sur 10) devient vrai. Option complète : dans `ouvrirPackCartes` (`js/game.js:1452`), une maudite d'événement pousse `decisionDeCarte(id)` (`js/banque.js:432`, consommée `js/sim.js:4776`), une maudite de match pousse `{ recompense: cle }` (`js/combat.js:309`).
  - Preuve : `check_cartes.mjs` : 500 Lots, toute maudite a un consommateur.
- [x] **F · Deux cicatrices au plus, saison neuve propre.** `js/saison.js:908`, `js/combat.js:324`, `js/game.js:1985`.
  - Correctif : dans `deckDe`, plafond de 2 (`doute`/`trainee`), la plus ancienne tombe ; une série gagnée en retire une ; `deckDeBase: deck.filter(c => !CARTES_MATCH[c].maudite)` au report.
  - Preuve : `check_deck.mjs` : pertes [3, 9, 20, 31] → au plus 2 ; série gagnée → une de moins ; report sans maudite (le cas « 10 + 6 = 16 » devient 12).
- [x] **G · La carte dit ce que le moteur joue.** `plusDe` (`js/combat.js:256`) amplifie tous les canaux ; « L'instinct du tueur » (`:135`) inconditionnel ; l'holo tire son bonus de la graine de la partie (`js/game.js:1392, 2907`).
  - Correctif : (1) `SENS = { finition:1, volume:1, robustesse:1, defense:-1, energie:-1, discipline:-1 }`, `plusDe` n'amplifie que dans le bon sens, inversé pour `adv`. (2) `apres40: { siMene: { finition: 1.06 }, sinon: {} }` appliqué à `js/sim.js:4412-4416` (où `gros.apres40 = { moi, lui }`) ; `defense: 1.02` disparaît. (3) `carteDe(rar, gardien, getPlayerKey(p), rar, num)`.
  - Preuve : `check_combat.mjs` : aucune carte + ne s'éloigne de 1 dans le mauvais sens ; `carteDe` stable pour une clé, différent selon `num`.

### L'alignement et ce que l'écran en dit

- [x] **I · Pas de verdict sur une unité incomplète.** `fitUnite` (`js/sim.js:1650-1662`) compte une case vide pour 0 ; `meilleureTactique` (`:1668-1687`) prend la première clé → « Échec avant 2-1-2 · Mauvais fit » sur des trios vides.
  - Correctif : `fitUnite → null` dès qu'une case est vide ; `meilleureTactique → 'hourra'` sur null ; `identiteUnite` (`:1383`) → null sous 3 F ou 2 D. Écran (`js/gerant.js:737-743`, `js/game.js:4717`) : « À compléter », sans fit, chimie ni nom de trio.
  - Preuve : `check_tactiques.mjs` : `fitUnite(vide) === null`, `meilleureTactique(vide) === 'hourra'`, `identiteUnite(2 sur 3) === null`.
- [x] **J · Un seul « −N », celui du jour.** Moteur `penaliteAdaptee` (`js/sim.js:541-548`) = base × e^(−matchs/15) ; écran `getPositionPenalty` à `js/game.js:3145, 3962, 4060, 4445`.
  - Correctif : exporter `penaliteAffichee(player, slot)` de `sim.js` (arrondi au dixième, 999 gardé pour `autoRoster`) ; libellé « −1,2 · s'adapte (9 m.) ».
  - Preuve : `check_situations.mjs` : après 15 matchs, affiché ≤ base × 0,37 + 0,05.
- [x] **K · Les cases portent leurs vraies zones.** `js/sim.js:315-319` Top 6 / Middle 6 / Bottom 6 ; zones réelles chevauchantes (`js/ratings.js:616-636`).
  - Correctif : étiquette dérivée de `idealUnits` : F « T1 · T1-2 », « T1-2 · T2-3 », « T2-3 · T3-4 », « T3-4 · T4 » ; D « P1 · P1-2 », « P1-2 · P2 · P3 », « P2 · P3 · rés. ».
  - Preuve : `check_chimie.mjs` : `zoneEcart === 'ok'` ⇔ l'étiquette contient la zone.
- [x] **L · Un cran ça passe, deux c'est énorme.** `malusZoneUnite` (`js/sim.js:305-311`) : `ZONE_NOMBRE = [1, 1, 1.6, 2.2]` quel que soit l'écart ; `ZONE_DUR = 12`. Deux vedettes au 2e trio = 14,4 → « hors de ses lignes ».
  - Correctif : multiplicateur de nombre seulement si l'écart max ≥ 2 ; `ZONE_DUR = 15`. 1/2/3 vedettes au 2e trio = 4,5 / 9,0 / 13,5. Si `mock_zones.mjs` lit EMPILÉ > 67,5, monter `ZONE_ECHELLE[1]` de 0,45 à 0,60.
  - Preuve : `mock_zones.mjs` (EMPILÉ ≤ 67,5) et `check_monotonie.mjs`.
- [x] **M · La chimie devient un levier, sans gonfler la ligue.** `CHIMIE_BONUS = 3,4` (`js/sim.js:4057`), `SYN_ECHELLE = 42` (`:2939`) → ×1,041 à 100.
  - Correctif : bonus relatif `CHIMIE_BONUS × (c − 53) / 100` avec `CHIMIE_BONUS = 8,0` (2 × 42 × ln 1,10) : ligne soudée ×1,046, ligne cassée ×0,95, moyenne de ligue inchangée. Sinon, retirer « Plafond / Entente / Maîtrise » du tiroir (`js/gerant.js:757`).
  - Preuve : `calibrate_sim.mjs` (buts/match ±0,1) ; `check_chimie.mjs` : chimie 100 vs 0 → +9 à +11 % de buts sur 2 000 matchs.

### L'adversaire

- [x] **N · Les indices de contre lisent le plan probable.** `js/saison.js:2050` passe `lignesDe(adv, adv.roster)` ; le gros match joue `PLANS_ADV[plan]` (`js/sim.js:6379`).
  - Correctif : ne pas révéler `mb.plan` ; passer le plan le plus probable du dépistage dans `lignesDeGros(adv, activeLineup(adv), probable)` extraite de `poserGros`. Étiquette « contre, selon le dépistage ». `activeLineup(adv)` partout.
  - Preuve : `check_gros.mjs` : lignes du hub = `adv._lignesMatch` quand le probable est le joué ; aucun blessé adverse.
- [x] **O · « Normale » par défaut.** `js/saison.js:2054` `importance: mb ? 'haute' : 'normale'` → `'normale'` ; puce « Haute conseillée » sur le gros match.
  - Preuve : `smoke.mjs` : gros match, `[data-importance="normale"][aria-pressed="true"]`.

### Le repêchage

- [x] **Q · Le bouton Signer dit quand il te bloque.** `maxForPick` (`js/game.js:514`) et `risky` (`:3881`) existent ; badge et toast à retardement (`:4066`) ; le refus (`:4051`) ne regarde que le plafond.
  - Correctif : `<button class="btn-sign risque">Signer · bloque la fin</button>` en rouge du club ; 1er toucher « Confirmer ? il restera 0,1 M$ pour 1 case », 2e toucher signe. Retirer le toast.
  - Preuve : `smoke.mjs` : `.btn-sign.risque` exige deux clics ; jamais `capLeft() < slotsLeft() × MIN_SAL` après un clic simple.
- [x] **R · Le robot ne gagne plus la Coupe.** Relire `check_robot.mjs` après A à Q. Si Coupe > 5 % : `EFFET`/`BORNES` des réputations (CLAUDE.md « Recalibrer ») et le prix d'une main non préparée (`energieAdverse`, `js/sim.js`).
  - Preuve : `check_robot.mjs` en CI : Coupe ≤ 5 %, séries 20 à 50 %, apport du ballottage ≤ +3 V.

## Jalon 2 · L'interface pro

### Le menu et « Nouvelle partie »

- [x] **1 · Le Rogue en héros.** `js/menu.js:73-96` (`carte`), `:109-118` (exhibition) ; `style.css:8035` `repeat(auto-fit, minmax(260px, 1fr))` étire et orpheline.
  - Correctif : grille `"rogue rogue" "saison table"` à ≥ 900 px, `align-items: start`, carton Rogue pleine largeur avec la dernière run dessus (voir R7) ; exhibition en lien `menu-lien` ; « écussons · joueurs · run » (`:77`) remplacé par le résumé de la dernière run, ou rien à la première visite.
  - Preuve : `smoke.mjs` (~470) : le carton Rogue a la plus grande hauteur et vient en premier dans le DOM.
- [x] **2 · Deux listes qui n'existent que quand elles servent.** `js/game.js:2450, 2470` `disabled` → `.opt-row.sans-liste` `display:none`. `#npResume` (`style.css:3037`) : `white-space: normal`, deux lignes, sans le plafond (`:2356`). Note du bouton (`:2378`) : « première roulette » quand `G.tirage` est vide.
  - Preuve : `sansDebordement('Nouvelle partie')` + `#npResume` sans débordement.

### Les cartes à choisir

- [x] **3 · Trois cartes visibles sur téléphone.** `style.css:6741-6749` bande `.choix-main` à 78 vw ; points `js/gerant.js:412`.
  - Correctif : trois mini-cartes (`calc((100vw − 48px) / 3)`, art 56 px, texte et puces masqués) ; la carte touchée s'ouvre en grand dans `.choix-lue` (gabarit `carteHtml`, `js/cartes.js:80`) ; second toucher choisit. Plus de points.
  - Preuve : `passerIdentite` (`smoke.mjs:57`) exige 3 `.tc` dont le bord droit ≤ `innerWidth`.
- [x] **4 · Les puces passent à la ligne.** `style.css:6346` `.puce { white-space: nowrap }` ; dérogations `:9323`, `:9494`.
  - Correctif : `white-space: normal; max-width: 100%` sur les puces de `.choix-option` et `.choix-sheet`, retirer les dérogations.
  - Preuve : `toutEstAtteignable` : question « coupé à droite » (`r.right > scrollWidth`).
- [x] **16 · Une carte ne parle que du mode joué.** `js/gerant.js:841` et `js/sim.js:5705` « En Rogue, grandit… » → `if (C.adv && MODE().rogue)`. `.tc-quoi` (`style.css:6726`) : `-webkit-line-clamp: 3`, puces toujours visibles.

### Le repêchage et la fiche

- [x] **5 · La fiche : Signer collé au bas, verso au recto.** `js/game.js:5081-5135` (`ouvrirFiche`), `:5193` (« Ce qu'il sait faire » au verso).
  - Correctif : bouton dans `.fiche-pied` `position: sticky; bottom: 0` (≤ 640 px) ; à ≥ 900 px, colonne droite = archétypes et traits + « Plus de détails » ouvert.
  - Preuve : `toutEstAtteignable('fiche')` + bouton visible sans défiler.
- [x] **6 · Sept retouches du vestiaire.** (a) Signer en risque : J1-Q. (b) Un seul compte : `:2564` badge = signables, `:3849` « Vestiaire · 35 signables ». (c) `index.html:102` « Tous » de la vue → « Liste », chip « Tous » → « Tout » ; sur téléphone, vue liste forcée quand le filtre est « Tout » (`style.css:1065`). (d) « À compléter » : J1-I. (e) `:2560-2570` onglets `mort` pendant le repêchage, opacité 0,45, badge « dès J1 ». (f) `:4822` « Encore N joueurs » → jauge (dégradé au pourcentage, « 14 / 23 · encore 9 »). (g) `:2141` toast « Classique… » seulement si une partie existait.

### La saison

- [x] **7 · La colonne droite du hub, remplie.** `style.css:5157-5180` (grille carte | volet), `voletJourneeSeul` (`js/saison.js:1577`).
  - Correctif : `.hub-tuiles` 2 × 2 à ≥ 1200 px : classement autour de toi (`voletClassement` `:1590` avec `{ autour: 5 }`), cinq prochains matchs (`L.calendrier.slice(jour, jour + 5)` via `carteMatch` `:1516`), trois meneurs (`leagueStats`, `js/bilan.js:83`), le deck. Une colonne à 390 px.
  - Preuve : `smoke.mjs` : 4 `.hub-tuile` à 1440, une colonne à 390.
- [x] **8 · Le sommaire ne se force plus chaque jour.** `ouvrirSommaire` (`js/saison.js:19`, `:1384`).
  - Correctif : match ordinaire sans attente → pas de plein écran ; `hub-hier` (`:1506`) monte en tête du volet avec animation 400 ms, « Sommaire › » l'ouvre. Plein écran gardé pour gros matchs, avances multiples (`:1445`) et choix en attente.
  - Preuve : `sommairesVus` (`smoke.mjs:262`) ≈ gros matchs + avances ; `memesButs` inchangé.
- [x] **9 · Des mots de hockey.** `js/saison.js:1387` « Retour au hub » → « Retour au bureau » ; `:2327` « ⏳ Règle d'abord ce message » → « À régler avant le match » ; `:1796, 2222` « Le palier de la journée N » → « La main de la journée N ».
  - Preuve : grep `hub` dans les chaînes affichées → 0.
- [x] **10 · Le classement sur téléphone.** `#hubFlottant` (`js/saison.js:514`, CSS `:6908`) cache des rangées ; `:1594` `teamShort(t)` tronqué.
  - Correctif : `padding-bottom: calc(var(--bas-coquille) + 72px)` sur le volet ; à ≤ 480 px, `tagCourt(t)` (« CGY '93 », déjà `:1504`).
  - Preuve : à 390, aucune `td.nom` tronquée, `tr.toi` au-dessus du flottant.
- [x] **11 · Préparer le match : l'adversaire d'abord, un seul réglage.** `js/gerant.js:495` (`enFace` par ligne), `:596` (titre), `:604-605` (curseur `gl-ad`), `:631` (phrase chimie).
  - Correctif : bloc `gl-adv-tete` une fois sous le titre, depuis le dépistage ; phrase chimie en `title` ; curseur retiré du tiroir et de `match.ad` dans `js/sim.js` (il alimente `finition 1 + 0,025·ad` : l'encoder dans la consigne, basse = −1, haute = +1).
  - Preuve : `.gl-adv-tete` précède `.gl-consigne` ; `toutEstAtteignable`.
- [x] **12 · Les puces des cartes de la main visibles à 900 px.** `js/cartes.js:87-88` texte d'ambiance avant les puces ; `.main-sheet .tc-art` 84 px (`style.css:6818`).
  - Correctif : `.main-sheet .tc-puces { order: -1 }` sous le type, art 64 px, ambiance à deux lignes.
  - Preuve : `smoke.mjs:290` à 1440 × 900 : chaque `.tc-puces` au-dessus de `.main-boutons`.
- [x] **13 · « L'adjoint joue cette série ».** Ouverture de la main de série `js/saison.js:925` (`ouvrirMainGros`) ; aucun robot de main n'existe.
  - Correctif : `mainParDefaut(main, energie, pistes)` dans `js/combat.js` (piste la plus probable, cartes par gain décroissant sous `ENERGIE_MAIN`) ; option qui enregistre `{ main, auto: true, serie: i }` et saute mains et entractes de la série (« Garder le cap »).
  - Preuve : `check_combat.mjs` : jamais au-dessus de l'énergie ; smoke série accepte « adjoint ».
- [x] **14 · L'entracte en 2 × 2.** `style.css:6331` : `.choix-options:has(> :nth-child(4):last-child) { grid-template-columns: repeat(2, 1fr) }` à ≥ 900 px ; poser `data-genre="entracte"`.
- [x] **17 · Le toast en haut sur téléphone.** `style.css:2292, 7031` : à ≤ 1199 px, `top: calc(var(--topbar-h) + 8px + env(safe-area-inset-top))`.
  - Preuve : après une signature, `#toast` dans la moitié haute.
- [x] **18 · Le bilan conseille avec ses chiffres.** `js/bilan.js:498-501` → « Ton 4e trio a marqué 3 buts en 80 tirs : c'est là que ça se joue. » depuis le rapport du dépisteur ; sous 41 V, la défense et son rang.
  - Preuve : `check_fiches.mjs` : la phrase cite un nombre du rapport.

### Le Rogue

- [x] **15 · Moins de vitrines, moins de mots, Échap qui ferme.** (a) `js/game.js:1736` récit → « Une équipe de plombiers, 40 🪙, plusieurs saisons. Chaque saison, le proprio en veut plus ; la Coupe finit la run. » (le reste dans `#pageRegles`). (b) `js/magasin.js:45` : première run avant J20, quatre packs (`bronze, argent, c:match, c:consommables`) + « Voir les 26 packs ». (c) `js/inventaire.js:126` légende supprimée, `title` par étiquette. (d) Échap : `js/game.js:2152-2165` ne voit que `.modal-backdrop` ; fermer le dernier `.choix-modal:not([hidden])` (fiche de pack d'abord). (e) `:3536` `renderSpin` : « Alignement complet » quand `slotsLeft() === 0`.
  - Preuve : `essai_rogue.mjs` : `#spin` sans « tourne » à 23/23 ; Échap ferme la boutique.

## Jalon C · La clarté (JP, 28 sept. : *je comprends pas la fatigue, la gestion des gardiens, les stats qui ont un impact, les pourcentages ; trop de catégories de stats, trop floues*)

Diagnostic mesuré dans le code (28 sept.) : la fatigue ne coûte rien au réglage par défaut (le matin revient à 100 tant que l'usure reste sous 1,22) et ne se voit que dans une infobulle ; les gardiens n'ont aucune fatigue et le joueur ne choisit jamais son partant ; environ 14 familles d'étiquettes décrivent « ce que le joueur fait bien », « Défensif » revient cinq fois et huit icônes servent deux fois ; « énergie » veut dire cinq choses et « robustesse » trois ; tous les pourcentages sont des multiplicateurs qui se multiplient sous des plafonds, sans que rien ne le dise ; la page des règles est en partie périmée (tactiques de S68, chimie de S72, « l'auxiliaire part un match sur six »).

Le principe (JP, 28 sept. : *je veux variété de build, pas trop simple, complexe mais clair*) : **la profondeur est dans les combinaisons, pas dans les étiquettes.** On ne retire aucune mécanique qui fait un build ; on retire ce que le moteur ne lit pas et ce qui dit deux fois la même chose, et chaque mécanique qui reste se VOIT là où on décide.

Ce qui fait un build, et qui reste (chacun visible à l'endroit où il se décide) :
- **Rôles × systèmes** : le système demande des rôles, le joueur en a un principal et un score dans les autres ; la fenêtre du système montre qui colle (✓ ≈ ✗) dans chaque case. C'est le cœur.
- **Carrure × agressivité** : une ligne costaude 🪨 rapporte en rentre-dedans, une ligne légère 🪶 prend des punitions ; dit sur la ligne.
- **Zones** : un 1er trio de vedettes ou trois trios égaux, deux façons de dépenser le plafond.
- **Traits** : rares, un trophée qui compte, un seul badge.
- **Origines** : les cartes de club (vrais coéquipiers, même franchise, ligne d'origine, décennie).
- **Profondeur contre vedettes** : avec des JAMBES qui comptent (C3), un banc solide devient un build ; un tandem de gardiens contre un gardien de fer aussi (C4).
- **Chimie et entente** : ce qui s'apprend en gardant ses lignes (poids à régler au jalon 1, M).

Un joueur se lit donc en : RÔLE (icône, mot, et ses scores dans les autres rôles à un toucher), NIVEAU (Soutien → Phénomène), ZONE, CARRURE, JAMBES, et au plus un TRAIT. Tout le reste passe dans « Plus de détails » ou disparaît.

- [x] **C1 · Un mot par idée.** « Jambes » pour la fatigue d'un joueur (sur 100, jamais « % ») ; « Élan » pour la mana des cartes ; le rôle 🌪️ Énergie devient « Plombier » ; « Punitions / match » là où la fiche écrit « ROBUSTESSE » ; « niveau » ne désigne plus que Soutien → Phénomène (le rôle dit élite / très bon / bon…). Une icône = un sens (liste des huit doublons dans le diagnostic : 🪨 🧊 🚀 🎯 🪄 🧤 🔄 🧱).
- [x] **C2 · Moins de familles à l'écran, pas moins de profondeur.** Retirer de l'affichage ce que le moteur ne lit pas ou qui répète : archétype des patineurs, PRODUCTION et PENCHANT du profil mesuré, MJ %, MBA et BL des gardiens hors fiche, la marque 🧊 (le rôle la porte). La carrure 🪨 / 🪶 RESTE (elle fait le build d'agressivité), avec son seul sens. Les scores d'un joueur dans les autres rôles deviennent visibles à un toucher (ils décident déjà du fit). Le chiffre clé d'un gardien devient son % d'arrêts (celui que le moteur lit), pas ses victoires.
- [x] **C3 · La fatigue qui compte et qui se voit.** Récupération journalière ajustée pour que le 1er trio d'une équipe qui joue Haute descende vraiment (cible : 75-85 au matin après une semaine chargée, 100 au repos) ; les jambes affichées en chiffre sur la case de l'alignement et dans « Préparer le match » ; le roulement « jambes fraîches » agit vraiment sur les jambes (ou son texte change) ; les gestes « énergie +N » ne sont offerts que sous 100.
- [x] **C4 · Les gardiens.** Une fatigue du gardien (départs consécutifs, sans effet sous trois de suite, qui pèse au quatrième) ; dans « Préparer le match », « Devant le filet ce soir » : le partant et l'auxiliaire avec leurs jambes et leur % d'arrêts, et on choisit. La rotation automatique reste le défaut.
- [x] **C5 · Les pourcentages disent ce qu'ils multiplient.** Dans « Préparer le match » et au hub : le TOTAL par canal ce soir (« Tirs +14 % · Précision −3 % · Buts contre −6 % »), calculé comme le moteur le fait (produit, plafonds compris) ; une phrase une fois : « les effets se multiplient ». Les puces gardent leur chiffre.
- [x] **C6 · La page des règles réécrite** sur le modèle ci-dessus, courte, sans ce qui est périmé, avec les mêmes mots que l'écran.
- Preuves : un `scripts/check_clarte.mjs` qui refuse une icône à deux sens, le mot « énergie » hors des jambes, et un chiffre affiché que le moteur ne lit pas (liste blanche) ; `check_situations` pour les jambes (cible C3) ; smoke : la case de l'alignement montre rôle, niveau, zone, jambes.

## Jalon R · La refonte (JP, 29 sept. : *les cartes pis le UI, ça feel vraiment cheap* ; *tu vas pas assez loin, je parle des menus, de comment c'est monté, de tout* ; *que si je le montre à quelqu'un, ça ait pas l'air d'un jeu web, mais d'un jeu console, PC ou mobile* ; *je me sens comme une balle de pinball*)

Diagnostic et maquettes : https://claude.ai/artifact/4yq6wM131Bp1b231nmJmMk (la structure) et https://claude.ai/artifact/ACR6EPD4nmrDBXXcYZXHeK (la peau). Direction retenue : A (télédiffusion) pour l'interface, B (carte de collection) pour les cartes. Le moteur, les sauvegardes et les règles ne bougent pas : c'est une refonte de l'interface.

- [x] **R1 · La coquille.** Cinq sections fixes dans tous les modes (Club, Effectif, Marché, Ligue, Collection) : rail à gauche au bureau, barre en bas au téléphone ; l'en-tête du club (écusson, fiche, rang, plafond) ; l'écran titre (« Continuer » en héros) ; le Menu prend Nouvelle partie, Options et Règles ; une seule pile d'écrans (Retour = Échap, bouton B, retour Android) ; clavier et manette avec un focus lumineux et les invites « Ⓐ Confirmer · Ⓑ Retour » ; transitions d'écran, sons d'interface, rien de sélectionnable, aucun lien souligné. Les écrans existants s'y rangent tels quels.
- [ ] **R2 · Le Club et sa boîte de réception.** Les décisions deviennent des messages réglés dans un panneau (bureau) ou une feuille (téléphone) ; plus de plein écran de choix, sauf les moments de fête (pack, main de la journée, Coupe). — *30 sept., la mise en page : l'en-tête dit la journée, la fiche et le rang, le bureau ne les redit plus ; hier soir en une ligne dans l'affiche (toucher : le sommaire), le prochain match juste dessous ; la barre d'action (Journée suivante, Regarder, Jusqu'à la prochaine décision) collée au bas du téléphone, la boîte entre l'affiche et le volet. Reste : les choix en feuille plutôt qu'en plein écran.*
- [x] **R3 · Le soir de match** en quatre étapes (Aperçu, Préparation, Match, Résultat) à la place de la chaîne de fenêtres. — *30 sept. : les quatre étapes sur l'affiche (`.soir`, js/saison.js), l'étape courante en or, les faites cochées ; le résultat d'hier en tête de l'affiche (tableau final, buteurs, le drame du soir) puis « Prochain match › » ; chaque étape mène à ce qui existait (dépistage, poste de gérant, direct, sommaire).*
- [ ] **R4 · Effectif, Marché, Ligue, Collection**, écran par écran. — *30 sept., au téléphone : le Marché en trois rangées basses (bandeau, relances, la case et le budget du choix) et la liste forcée, pour que la première carte se lise jusqu'à Signer sans défiler ; la barre d'action n'apparaît qu'avec « Lancer la saison » ; l'Effectif sans titre ni phrase d'aide, le résumé sur une ligne ; le toast en bande sous l'en-tête ; la fiche avec « ‹ Retour » en tête. Preuve : smoke (le Club en un écran, la carte entière).*
- [ ] **R5-cartes · De vraies cartes** (JP, 29 sept. : *sauf les cartes, qui ont l'air de vraies cartes, et avec background variés qui font pro*). Une dizaine de séries complètes (Vintage 70, Rétro 80, Glace, Aréna, Filet, Chrome, Écusson, Tableau, Signature…), chacune avec sa mise en page et un fond travaillé, assignées par époque ; les finitions deviennent des parallèles (réfracteur, dorure, numérotée) ; les cartes de match ont un fond par genre (tactique : tableau de coach à la craie) et de vraies illustrations au trait. Le poste, le salaire, le chiffre clé et le rôle restent au même endroit sur toutes les séries.
- [ ] **R5 · La peau.** Jetons de design (7 tailles, 3 rayons, ~20 couleurs), icônes au trait à la place des 973 émojis, cartes de collection par époque, illustrations des cartes de match.

## Jalon 3 · Zéro code inutile

Inventaire mesuré au commit `7da2bd5` (commandes à la fin).

| Catégorie | Mesure | Compte | Poids | Risque |
|---|---|---|---|---|
| JS | déclarations top-level sans référence | 26 / 1 789 | ~190 lignes | sûr |
| JS | branches mortes (`contre`, `PACKS`/`packsOuverts`) | 3 | ~30 lignes | sûr |
| JS | helpers définis 2 à 6 fois | 22 noms, 56 défs | ~150 lignes | faible |
| JS | exports jamais importés ailleurs | 287 / 850 | 0 Ko | cosmétique |
| CSS | 598 Ko, 3 730 règles, 1 683 classes, 30 `!important` | | | |
| CSS | classes jamais référencées | 137 | ≈27 Ko | 60 sûres, 40 à vérifier |
| CSS | sélecteurs déclarés plus d'une fois | 267 (306 en trop) | à mesurer | moyen |
| Scripts | orphelins | 3 / 64 | 347 lignes | sûr |
| Scripts | `check_*` hors CI | 27 | | couverture perdue |
| Dépôt | fichiers suivis, dont portraits | 4 224 | 83,6 Mo · 57,4 Mo | |
| Docs | CLAUDE.md + PLAN.md, dont journal | 2 068 lignes | 892 Ko · ~650 Ko | sûr |

- [x] **1 · Les 26 déclarations mortes et les 3 branches.** `js/game.js:873` `posteLong`, `:882` `positionColor`, `:998` `ageTag`, `:1003` `elcTag`, `:4277` `roleCourt` (+ `ROLE_COURT`), `:4613` `chemShort`, `:4615` `zoneShort`, `:6203` `segments` · `js/sim.js:85` `uniteDeCase`, `:1961` `CONTRE_PLAN`, `:4258` `pickUnit`, `:5210` `separerSeries`, `:5976` `jouerSeriesJusqua`, `:6157` `planDuGros` · `js/saison.js:438` `motDuPlan`, `:455` `panneauChoix` · `js/table.js:876` `rolesEnJeu`, `:1182` `caseLibre` · `js/banque.js:45` `RARETES_BANQUE` · `js/cartes.js:310` `ERES` · `js/commentaire.js:183` `ACTION_TIR` · `js/franchises.js:72, 77` · `js/logos.js:274` `getTeamInk` · `js/sons.js:211` `NOMS_SONS`. Branches : `js/sim.js:6421-6431` et `js/gerant.js:848` (`contre`) ; `js/rogue.js:85-101` `PACKS` et `:205` `packsOuverts` (import `js/game.js:58`). `js/sauvegardes.js:156` `renommer` : brancher ou retirer. `#tabPool` dans le CSS : retirer.
  - Preuve : `check_graine.mjs` + `smoke.mjs` verts.
- [x] **2 · Les 60 classes CSS sûres, puis les 40 dynamiques.** Restes des hubs S66-S70 : `hub-t-*`, `hub-jauge*`, `hub-soir-*`, `hub-tuiles-grille`, `pcard-full-*`, `tuile-*`, `live-autre(s)`, `live-jour-match(s)`, `hub-ballottage*`, `slot-face`, `slot-texte`, `pos-chip`, `recit-saison`, `hub-sequence`, `lz1-4`, `spin-unite`, `hub-pige-*`, `tag-arch`, `eligible`, `wide`, `needs`, `opt-note`, `pb-season`, `lb-entry`. Les 40 à préfixe construit (`tc-`, `t-`, `pk-`, `bq-`, `v-`) une à une (`tc-peu`, `tc-commune` sont vivantes).
  - Preuve : `smoke.mjs` et `smoke_table.mjs`, captures comparées écran par écran.
- [x] **3 · Fusionner les 267 sélecteurs dupliqués.** `:root` ×6, `.topbar` ×5, `.icon-btn` ×4, `.chip`, `.pcard`, `.slot.empty`, `.actionbar`, `.toast`, `.navtab`, `.tc-rare`, `.tc-legendaire` ×3. Garder la dernière déclaration, un écran à la fois, smoke entre chaque. Viser style.css < 150 Ko, un bloc par composant, une `@media` par point de rupture, zéro numéro de sprint dans les commentaires.
  - Preuve : `scripts/check_css.mjs` en CI : zéro classe sans référence, zéro doublon, `!important` ≤ 5.
- [x] **4 · Un `js/util.js`.** `esc` ×6 (album, game, gerant, inventaire, magasin, menu + 6 copies dans exhibition), `nomCourt` ×4, `ecrire`/`lire` ×4, `pct` ×3, `ord`/`ordF`/`ordP` ×3, `estD` ×3, 13 noms ×2. `money` (`js/game.js:76`) exporté.
  - Preuve : `check_graine`, `check_commentaire`, smoke.
- [x] **5 · Retirer `export` sur les 287 symboles internes** (`js/commentaire.js` 39, `js/ratings.js` 26, `js/sim.js` 60+). Aucun n'est utilisé seulement par `scripts/`.
- [x] **6 · Découper `game.js` et charger par mode.** `repechage.js`, `alignement.js`, `fiche.js`, `ballottage.js` (fonction pure réutilisée par `check_robot`), `demarrage.js` ; `game.js` reste contrôleur. `import()` dynamique de `table.js`, `plateau.js`, `tournoi.js`, `sons.js` (390 Ko) et `exhibition.js` ; `sw.js` les précache toujours.
  - Preuve : < 900 Ko et < 25 requêtes au menu ; `check_coquille` vert.
- [x] **7 · Une minification à la publication.** Une étape `esbuild --minify` dans l'Action Pages vers le dossier publié, source maps ; le dépôt reste sans build. Gain attendu : −55 % JS, −30 % CSS avant gzip.
- [x] **8 · Scripts et couverture.** Supprimer `essai_menu.mjs`, `mock_plafond.mjs` ; documenter `recrues.mjs` (écrit `data/recrues.json`). `npm test` avec les `check_*` sous 15 s (`check_deck`, `check_packs`, `check_combat`, `check_banque`, `check_identite`, `check_atelier`, `check_pronostic`…) dans `verifier.yml`.
- [x] **9 · Les données.** Publier seulement index.html, style.css, sw.js, js/, fonts/, img/logos, img/mugs, `data/{index,seed,portraits,recrues}.json`, `data/{trophees,reputations}.js`, `data/seasons/*.json`. `data/salaries/` (1,9 Mo) hors du publié. `data/seed.json` (2,8 Mo) hors de la coquille précachée, en cache à la demande. Portraits (57 Mo du dépôt, 64 Mo de l'APK) : 160 px pour le vestiaire, 320 px pour la fiche, ou téléchargement à la première ouverture.
- [x] **10 · Les docs.** CLAUDE.md < 40 Ko : projet en une phrase, avant de coder, structure, invariants en une ligne avec leur script, tester, ce qu'il ne faut pas faire. Le reste dans `docs/journal/S66.md … S80.md` et `docs/decisions.md` (388 paragraphes en gras → titres datés). PLAN.md < 15 Ko ; son journal (220 Ko) dans `docs/journal/`. MOTEUR.md : garder.

Rejouer l'inventaire :

```sh
# scripts référencés où
for f in scripts/*.mjs scripts/*.py; do b=$(basename $f); echo "$b wf:$(grep -l $b .github/workflows/*.yml|tr '\n' ' ') CLAUDE:$(grep -c $b CLAUDE.md) scripts:$(grep -l $b scripts/*.mjs scripts/lib/*|grep -v $b|wc -l)"; done
# poids suivi par git, par dossier
git ls-files -z | xargs -0 -n 500 du -b | awk -F'\t' '{split($2,a,"/"); k=a[1]; if(a[1]=="data"||a[1]=="img")k=a[1]"/"a[2]; s[k]+=$1} END{for(k in s) print s[k], k}' | sort -rn
# helpers définis plusieurs fois
grep -hoE "^(export )?const [a-z][A-Za-z0-9_]* = \(?[a-z, ]*\)? ?=>" js/*.js | sed -E 's/^(export )?const //; s/ =.*//' | sort | uniq -c | awk '$1>1'
# poids des sections de CLAUDE.md
awk '/^## /{if(n)print b"\t"s"\t"n; n=$0; s=NR; b=0} {b+=length($0)+1} END{print b"\t"s"\t"n}' CLAUDE.md | sort -rn
```

## Jalon 4 · Sur table sort de la bêta

- [x] **P1 · Après un sifflet ou un but, l'autre camp joue.** `arretDeJeu` (`js/table.js:1608`) et le but (`:2327`) appellent `finirPresence` sans `finirMain` ; `:2959` redonne la main à l'interrompu.
  - Correctif : `finirPresence` commence par `m.dernier = m.tour`.
  - Preuve : `check_regles.mjs` : mémoriser `m.tour` avant chaque `finirPresence`, exiger `m.tour !== avant` après la mise au jeu.
- [x] **P2 · Sortir son gardien.** `retirerGardien` (`:2639`), `peutRetirerGardien` (`:2558`) ; seule l'IA (`:3604`) les appelle.
  - Correctif : `js/plateau.js:1666-1671` bouton `.t-desert` « 🥅 Sortir le gardien » quand `peutRetirerGardien(m, 'A') && aMoi()` ; handler `:2355-2368`.
  - Preuve : `smoke_table.mjs` : mené 1-2 en 3e, bouton cliquable, fil « FILET DÉSERT ».
- [x] **P3 · Banc verrouillé pendant la main adverse.** `js/plateau.js:2358` sans `aMoi()` ; `js/table.js:3958` ne borne que si `m.tour === cote`.
  - Correctif : `if (uni && aMoi())` ; moteur `if (m.tour !== cote || m.main.change) return false;` et `m.main.change = true` sans condition (`:3994`).
  - Preuve : « un changement par main, par le camp qui a la main ».
- [x] **P4 · Ordre patin / placement libre.** `js/table.js:2138` : le premier patin consomme `main.bouge`.
  - Correctif : une pièce sans rondelle prend d'abord le placement, le patin reste au porteur ; l'IA (`:3627`) au même régime. Sinon réécrire la règle `:4053`.
  - Preuve : après un placement, `peutBouger(m, porteur)` vrai.
- [x] **P5 · La cote affichée est la cote jouée.** `deplacer` dépense (`:2146`) avant `modEsquive` (`:2158`) ; l'écran calcule avant (`js/plateau.js:389`).
  - Correctif : duel (`modEsquive`, `modBataille`) avant `depenser`.
  - Preuve : 500 esquives, `chancesDe(avant) === chancesDe(jet.mod)`.
- [x] **P6 · La feinte rend l'élan.** `:2755` ajouter `piece.echappee = true`.
  - Preuve : après une feinte réussie, `peutBouger(m, porteur)` vrai même si `m.main.bouge`.
- [x] **P7 · Pas de « au fond » qui est un sifflet.** `ciblesFondDe` (`:1712-1716`) offre les coins depuis sa zone ; `appliquerPasse` siffle (`:2266`).
  - Correctif : le geste n'existe plus depuis sa zone (`profondeur > LONGUEUR − PORTEE_TIR → []`).
  - Preuve : `m.icings === 0` sur 250 matchs.
- [x] **Les petites règles, écrites.** `ciblesVolDe` (`:2108`) exclut l'essoufflé ; bouton (`js/plateau.js:1462`) « à bout de souffle » ; `reglesDuPlateau()` ajoute durées au sol (`:2452`), diagonale couverte à 3 (`:2031`), fusillade tranchée après 40 rondes (`:3894`). Un « ? » par geste dans le menu de pièce (`bouton()`, `:1574`) lit sa règle dans le fil.

## Jalon 5 · La sortie

### Fini, ça veut dire

- [x] Aucune boucle d'argent : `check_packs` revente ≤ 40 %, `check_rogue` achat avant butin, prime de série versée.
- [x] Le robot ne gagne pas : `check_robot` Coupe ≤ 5 % sur 40 saisons, ballottage ≤ +3 V.
- [x] L'écran dit le moteur : fit null sur unité incomplète, un seul « −N », étiquettes de zone dérivées, indices de contre sur le plan probable, cartes + sans malus amplifié.
- [x] Rien de coupé à 390 px : `toutEstAtteignable` avec « coupé à droite » sur repêchage, fiche, dilemme, main, classement, bilan.
- [x] Rien de vide à 1440 px : quatre tuiles au hub, fiche remplie, menu sans carton étiré.
- [x] Une décision montre tout : trois cartes visibles, puces au-dessus du pli, l'adversaire en tête de « Préparer ».
- [x] Des mots de hockey : zéro « hub », « palier », « Classique » affichés ; intro Rogue en deux phrases ; légende de l'inventaire en infobulles.
- [x] Zéro code inutile : zéro export non importé, zéro fonction sans appel, zéro sélecteur sans élément, zéro script orphelin.
- [ ] Poids : < 900 Ko et < 25 requêtes au premier écran ; Sur table à la demande ; style.css < 150 Ko. — *29 sept. : l'APK y est (13 requêtes, 1,25 Mo au premier écran) ; la version locale non minifiée charge 56 requêtes et 2,45 Mo, sans conséquence puisqu'elle est servie en local (JP : « juste local »).*
- [x] Sur table : `check_regles` avec les sept règles neuves, ou le carton porte « bêta ».
- [x] CI verte sur `1.0`, `sw.js` en 1.0.0, `site.webmanifest` et l'APK au même numéro.
- [ ] Un vrai téléphone : une saison complète sur Android (barre d'état, barre de gestes, clavier dans la recherche), sans page qui défile de côté.
- [x] Docs vivantes : CLAUDE.md < 40 Ko, journal dans `docs/journal/`, README avec les captures de la 1.0.

### La semaine de sortie

- [x] Lundi · gel des chaînes : relire toutes les chaînes affichées (accents, majuscules, « ,880 » cohérent, zéro mot de développeur).
- [x] Mardi · `v1.0.0-rc1` : `VERSION` du cache dans `sw.js`, APK via `mobile/fabriquer-apk.ps1`, Pages depuis `1.0`.
- [ ] Mercredi et jeudi · deux saisons à la main (téléphone et bureau) par quelqu'un qui n'a jamais joué ; noter chaque hésitation de plus de trois secondes ; corriger seulement ce qui est cassé.
- [ ] Vendredi · `v1.0.0` : fusion dans `main`, tag, README, lien Pages et APK. Ensuite, les idées gelées (défi du jour, deux joueurs, avant 1970) reprennent sur `main`.

## Après la 1.0 · idées notées

- [ ] **Variété de mise en page des cartes** (JP, 28 sept. : *les cartes, ça manque de variété de mise en page*). Les 55 designs du S80 varient la couleur, la bande du nom et la finition, mais la structure reste la même partout : photo en haut, nom, salaire et points en bas. Pistes, comme les vraies séries : photo pleine carte avec le nom en surimpression (années 90), photo en médaillon sur un fond de club (années 70), cadre horizontal pour les cartes de série ou de trophée, photo d'action détourée qui déborde du cadre, dos de carte stylisé par époque. Contrainte : le poste, le salaire et le chiffre clé restent au même endroit sur toutes les cartes du vestiaire, sinon on ne compare plus d'un coup d'oeil.

## Journal

- 2026-09-28 — Plan écrit à partir de la revue du joueur (deux saisons jouées, trois audits de code).
- 2026-09-28 — JP : *prioriser roguelike*. Le Rogue devient le héros de la 1.0 ; chemin R0-R9 ajouté en tête, menu réordonné.
- 2026-09-28 — Mobile : l'APK ne porte plus les 3 913 portraits (www/ 80 → 23 Mo), ils se téléchargent en arrière-plan depuis le site publié (js/distant.js). À faire : activer GitHub Pages, sinon silhouettes.
- 2026-09-28 — Fusionnés dans 1.0 : J0 (check_robot), J1 A B C D E F G H I J N O Q, R4 R5 R7 R8, J4 au complet. Correctif : poserGros lisait une variable disparue après l'extraction de lignesDeGros.
- 2026-09-28 — JP : *les packs sont trop généreux en joueurs étoiles*. Au moins une étoile par pack : Bronze 2,5 %, Argent 7 %, Or 16 %, Premium 35 % (avant 6, 18, 34, 60 %).
- 2026-09-29 — Fusionnés : J1 K L M (zones, deux vedettes, chimie relative), J2 3 4 5 10 12 16 17 et R6 (mobile), les cartes de club (7 cartes d'origine), la page des lignes (cases sans photo, niveau, jambes ; le système en fenêtre), C3 C4 C5 (jambes qui comptent, gardiens et « Devant le filet ce soir », totaux du soir), J3-10 (CLAUDE.md 608 → 14 Ko, PLAN.md 284 → 5 Ko, historique dans docs/).
- 2026-09-29 — Mesures : Rogue sans déblocage 2,5 % de Coupe par run, première Coupe à la run 3,5 en médiane (R9 tenu) ; robot 0 Coupe sur 40, séries 57 %, ballottage −0,4 V ; chimie 100 contre 0 : +10,9 % de buts ; jambes du 1er trio 92,7 au défaut, 84,0 poussé.
- 2026-09-29 — C1 C2 C6 fusionnés : élan (mana des cartes), 🪠 Plombier, PUN / MATCH, une icône par sens (check_clarte, 56 icônes), « Ses rôles » dans la fiche, % d'arrêts comme chiffre clé d'un gardien ; règles 6 037 → 1 520 mots, 28 chiffres reconstruits depuis leurs constantes.
- 2026-09-29 — Jalon 2 fini : Nouvelle partie (listes à la demande), vestiaire (un seul compte, jauge, onglets atténués pendant le repêchage), bureau (quatre tuiles dès 1200 px), match ordinaire lu au bureau, « bureau » et « main de la journée », Préparer (l'adversaire d'abord ; le curseur attaque/défense fondu dans la consigne : Basse −1, Normale 0, Haute +1), « L'adjoint joue cette série », entracte en 2 × 2, bilan chiffré. Écarts : pas de badge « dès J1 » (infobulle), portail caché sous 1200 px (jamais une longue page), bande par poste gardée au téléphone.
- 2026-09-29 — J3, première passe : 33 déclarations et 3 branches mortes, 33 imports, 220 export, 106 classes CSS (−26 Ko de CSS), js/util.js, check_mort et tout.mjs en CI, check_traits déterministe. Reste : fusion des sélecteurs CSS en double (et les correctifs posés en fin de fichier), découpage de game.js et chargement de Sur table à la demande, minification à la publication, données.
- 2026-09-29 — J3-6/7/9 : game.js 6 933 → 2 254 lignes (repechage, alignement, fiche, banc, rogue-jeu, partie, modes-table, charge-table) ; Sur table et l'exhibition chargés à la demande ; l'APK est regroupé et minifié à la fabrication (esbuild, devDependency de mobile/), sans data/salaries ni seed.json : APK 8,33 → 6,80 Mo, premier écran de l'APK 13 requêtes et 1,25 Mo. Le jeu n'est plus publié en ligne (JP : « juste local ») : la minification se fait à la fabrication, pas dans une Action.
- 2026-09-29 — J5 lundi, gel des chaînes : l'argent s'écrit « 95,5 M$ » par une seule fonction (`money`, 73 appels ; la barre écrivait « $9.3M » et la boutique « 82,0 M$ »), le % d'arrêts « ,912 » par `pct3` (16 sites dans 10 fichiers), un mot par idée (« tactique » et « profil » → système et rôle dans 6 chaînes, l'aide du banc qui disait que changer un joueur coûte de la chimie), la typographie (espace avant « ? », apostrophe droite, « Vézina », « L'œil du public »). `check_clarte` juge désormais l'argent, les ordinaux, « … », l'espace avant « ; ! ? » et le passage par `money` et `pct3` (20 vérifications) ; le lecteur de chaînes est partagé dans `scripts/lib/chaines.mjs`.
- 2026-09-29 — J3-3 : 273 → 59 sélecteurs en double, 419 déclarations qui ne gagnaient jamais retirées, rendu identique sur 198 rendus (≈ 954 000 éléments comparés) ; les 59 restants demandent une réécriture à la main (conflits réels ou cascade par @media), check_css les empêche d'augmenter. La cible « style.css < 150 Ko » n'est pas atteinte (562 Ko, dont 177 Ko de commentaires) ; l'APK reçoit une feuille minifiée de 348 Ko.
- 2026-09-29 — Gel des chaînes : un format d'argent (« 95,5 M$ »), un format de % d'arrêts (« ,912 »), Vézina, check_clarte à 20 vérifications.
- 2026-09-29 — v1.0.0-rc1 : cache 1.0.0, APK versionName 1.0.0 (versionCode 2), 6,8 Mo. Batterie complète verte (22 scripts, smoke, smoke_table, essai_rogue, essai_exhibition, 0 erreur console). check_situations passe à 12 ligues par défaut (bruit à 6). Reste : une saison sur un vrai téléphone, deux saisons par quelqu'un qui n'a jamais joué, puis la fusion dans main et v1.0.0.
- 2026-09-29 — R5, les cartes : dix séries de cartons de joueur (Vintage 70, Rétro 80, Tableau, Mosaïque, Filet, Chrome, Écusson, Glace, Aréna, Signature) dans un seul gabarit (`cartonHtml`), les variantes en parallèles (réfracteur ; holo et relique ; or découpé, doré, signé en fac-similé et numéroté), le verso de sa série et son rang dans la ligue, la photo d'action prête (`photoAction`) ; les cartes de match ont leur genre (fond, gemme de coût, bannière) et trente-neuf dessins au trait à la place de l'émoji ; style.css −46 Ko ; vestiaire ~10 ms par carte au processeur ×4 (12 à 16 avant). Planches : `node scripts/planche_cartes.mjs`.
- 2026-09-29 — R1 · La coquille : cinq sections (Club, Effectif, Marché, Ligue, Collection), rail dès 1000 px et barre au bas au téléphone ; l'en-tête du club (fiche et rang à la journée révélée, plafond) ; l'écran titre et le même écran en menu pause ; js/pile.js (Échap, B, retour Android, « ‹ Retour », un niveau à la fois) ; js/manette.js (flèches et croix, anneau lumineux, invites) ; page qui ne défile jamais, aucun souligné, rien de sélectionnable, sons d'interface. smoke adapté (aller()) et six assertions neuves ; seul échec : l'entracte des séries, déjà connu.
- 2026-09-30 — JP : *encore confondant côté UI/UX ; on ne distingue pas bien les joueurs selon position, un excellent bagarreur de 4e trio devrait être impactant ; l'interface encore dull et trop de trucs petits*. Mesuré d'abord : trois soirs sur quatre la robustesse ne pesait rien (intensité 0) et un bagarreur n'était qu'un coût de punitions ; le niveau et le chiffre clé étaient aux points pour tout le monde, donc « Soutien · 3 PTS » ; à 1280 px les rangées de l'alignement se recouvraient (six chevauchements mesurés) ; 125 déclarations sous 12 px. Fait : (1) le moteur — `ROB_ORDINAIRE` 0,35 (la robustesse pèse chaque soir, 2,5 % par écart-type) et `DISSUASION` 0,2 (les durs réduisent les blessures de l'équipe de 18 % par écart-type) ; `check_builds` ROBUSTE 55,5 → 60,5 V, DÉF+ROB 60,5 → 65,5, VALEUR inchangé, « pur r » toujours à 20 V ; monotonie verte (25,6 / 51,4) ; graine et feuilles inchangées ; la règle écrite avec ses trois chiffres, vérifiés par `check_clarte` (30 chiffres). (2) L'écran — `chiffreCle` (js/game.js) : un bagarreur lit ses PUN, un checker, un plombier ou un défenseur physique ses MÉ/M, un défensif ses TB/M, les autres leurs PTS ; le même chiffre sur la carte du vestiaire, la carte mini, la case et le nombre en évidence de la fiche ; la case dit le rôle ET son mot (« Bagarreur · élite ») sur trois rangées (rôle, niveau et zone, chiffre clé) ; le smoke classe par niveau puis par points avant le chiffre d'une autre unité. (3) L'interface — `grid-auto-rows: max-content` sur l'alignement en colonnes (0 chevauchement) ; la case grossit (nom 17 px, rôle 12,5, chiffre clé 13,5, bandeau 11) ; plancher des étiquettes les plus petites (8 à 10 px → 10 à 11 px). Reste ouvert, dans R5 : les émojis et les pastilles.
- 2026-09-30 — JP : *une refonte COMPLÈTE de ce que voit le joueur ; chaque type de joueur devrait avoir un impact quand maîtrisé ; perte d'énergie des joueurs frappés ; des niveaux de fatigue, pas de cap à 90*. Moteur (js/sim.js) : la maîtrise des rôles (`MAITRISE_LIGUE`, `EFFET_ROLE` : étouffer, intimider, devant le filet, les jambes du plombier, le sniper en avantage, la pointe), les coups qui coûtent des jambes (`encaisserCoups`, 1,5 par coup, la carrure encaisse), la fatigue en continu autour de 94 avec quatre niveaux (`NIVEAUX_JAMBES`). Règles écrites, 38 chiffres vérifiés. Mesures : feuilles 3,01 buts inchangé, monotonie 27,3 / 53,5, jambes 11/11, gros 42/42, graine verte. Interface : docs/refonte-ui.md (le système de design), Noto Emoji monochrome en sous-ensemble (fonts/, les 310 émojis du jeu rendent au trait), style.css réécrite depuis zéro par sections (jetons, coquille, briques, puis un agent par écran).
- 2026-09-30 — JP : *tu devrais pouvoir pilonner ou être pilonné ; je veux des batailles et du chamaillage aussi, tout ce qui arrive dans un vrai match et ajoute du drama*. Le jeu physique en événements (`tirerPhysique`, js/sim.js) : le coup marquant (2 jambes sur-le-champ, blessure ×1,5 ce soir), la bagarre (le bagarreur de chaque club, le duel au rôle, au physique et au gabarit ; 5 minutes hors de leurs unités, l'élan ×1,06 / ×0,94 pendant 10 minutes, le battu se blesse ×3), la mêlée (2 minutes qui s'annulent) ; leur nombre suit l'époque (les punitions de ligue du shard), les bagarreurs et le rentre-dedans. Racontés par trois banques neuves du commentateur, au direct (la bagarre arrête le fil une seconde, en or si ton club la gagne), au sommaire, et « Mises en échec » dans les statistiques du direct. Le coup ordinaire passe de 1,5 à 1,2 jambe pour que le 1er trio dorme encore au-dessus de 90. Mesuré : 4 coups marquants, 0,37 bagarre, 0,3 mêlée par match (2021-22) ; feuilles, graine, gros, jambes, situations, traits, combat, commentaire, clarté (1 797 mots, 41 chiffres) verts.
- 2026-09-30 — La feuille de style réécrite depuis zéro (docs/refonte-ui.md, treize sections dans l'ordre des écrans, le carton de collection gardé verbatim) : 9 163 → 4 539 lignes, 517 → 384 Ko, tailles en px 825 → 6, rayons 181 → 1, couleurs en dur 842 → 342 (toutes dans le carton), dégradés 193 → 115, ombres 170 → 108, doublons 59 → 16, `!important` 23 → 6 ; `check_css` verrouille ces plafonds. Captures avant / après sur dix-neuf écrans à 390 et 1280 px ; trois défauts corrigés à la source (le rail, le mot du rôle, la bande de trois cartes). Smoke, smoke_table et essai_rogue verts, zéro erreur console.
- 2026-09-30 — R3 : le soir de match en quatre étapes sur l'affiche (Aperçu, Préparation, Match, Résultat). Après « Journée suivante », le résultat vient en premier : le tableau final, les buteurs, le drame du soir (bagarres gagnées, coups marquants donnés et reçus, blessés), puis « Prochain match › » ramène à l'aperçu du suivant ; l'affiche remonte en haut d'elle-même. Les boutons de l'écran et les sélecteurs du smoke ne bougent pas. Une bagarre par joueur par soir (la deuxième, c'est l'expulsion).
- 2026-09-30 — La CI lisait un mot de case coupé de 2 ou 3 px, à un joueur différent chaque fois : la case du dernier signé se pose en grossissant (`cj-arrive`, 1,04 à mi-course) et l'animation ne part qu'à l'affichage de l'onglet ; le smoke mesurait 400 ms plus tard, en plein saut. Reproduit avec le Chromium de la CI (« bon +3 px » à 400 ms, rien au repos). Le smoke attend désormais la fin des animations finies avant de mesurer (`auRepos`). Le mot du rôle plie aussi sous le rôle plutôt que d'être coupé.
- 2026-09-30 — JP : *refaire l'interface au complet, information placée plus logique, surtout sur mobile*. Mesuré sur les captures à 390 px : au Marché, « 0/23 » trois fois (en-tête, barre du bas, badge), le plafond deux fois, 460 px de chrome avant la première carte dont le prix et Signer tombaient sous le pli ; au Club, la journée, la fiche et le rang deux fois, le résultat d'hier en plein écran avec ses buteurs, le prochain match derrière un bouton, « Journée suivante » flottant par-dessus le texte. Fait (R2, R4, la mise en page) : la bande de tête du bureau retirée (l'en-tête la disait), hier en une ligne une seule fois, la barre d'action collée au bas (`.hub-barre`, sticky dans la feuille ; plus de bouton flottant au Club), la boîte entre l'affiche et le volet ; le Marché en trois rangées basses, liste forcée sous 680 px, barre d'action masquée tant que l'alignement est incomplet ; l'Effectif sans titre ni aide, résumé sur une ligne ; le toast en bande ; la fiche avec « ‹ Retour ». Le smoke exige le Club en un écran (affiche et bouton visibles, hier une fois, pas de bande en double) et la première carte lisible jusqu'à Signer. check_css, check_mort, check_clarte, check_coquille verts.
- 2026-09-30 — JP, sur les captures : *tout est zoomed in et pogné ; des sous-pages avec icônes, des modals, que presque tout rentre dans un écran de cell, réduire un peu certaines polices*. Au téléphone, les jetons baissent à la source (`:root` sous 680 px : t-3 15, t-4 17, t-5 22, t-6 30 ; esp-3 10, esp-4 12 ; barres 64 et 56) ; l'en-tête tient sur une rangée (écusson, club, fiche, rang, plafond, menu, sans étiquettes) ; au Club, l'affiche garde les étapes, hier en une ligne, le prochain match et « ce soir », puis une rangée de tuiles à icône — 🔎 Dépistage (une sous-page, `ctx.sousPage` sur #gameModal), 🏒 Préparer, 📋 Sommaire, 📥 Boîte — à la place du dépistage déplié et de la rangée des lignes ; la boîte de réception est pliée tant que rien ne bloque ; l'Effectif se lit par onglet (Attaque, Défense, Filet · réserve : `body[data-effectif]`, `data-groupe` sur chaque ligne) avec des cases plus basses. Capturé à 390 × 844 : le Club en saison tient en un écran, barre d'action comprise.
