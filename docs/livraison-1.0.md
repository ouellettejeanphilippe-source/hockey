# Livrer la 1.0 — le plan et ses jalons (archive)

Archivé le 2 novembre 2026, mot pour mot, depuis `LIVRAISON.md` : le plan de la 1.0 (livrée en octobre 2026) et les jalons qui l'ont suivie. Les renvois du code à « LIVRAISON.md, jalon … » pointent ici. Les cases encore ouvertes ont été reprises dans `../LIVRAISON.md` : c'est là qu'on les coche, pas ici.

État au 28 septembre 2026, point de départ commit `7da2bd5` (S80). Ce fichier est le plan de travail vers un jeu livrable : sans code inutile, visuellement et mécaniquement professionnel. Coche les cases en avançant ; chaque item nomme son fichier, sa ligne, la valeur à poser et le script qui le prouve. Un correctif sans preuve n'est pas fini.

Diagnostic complet (55 constats, captures) : https://claude.ai/artifact/2GM7phTiPkSWNyaKYYvet4
Version page de ce plan : https://claude.ai/artifact/ULEA4KWRjKP4aMMkobofAu

## En une page

Le jeu n'a pas besoin d'une refonte, il a besoin d'un gel. On arrête d'ajouter, on ferme les fuites (économie, ballottage, hasard des séries), on fait dire à l'écran ce que le moteur joue, on retire ce qui ne sert plus, et on coupe le poids de moitié.

Portée de la 1.0, décision de JP (28 septembre) : **le mode Rogue est le héros**. C'est lui que le menu met en avant, lui qu'on livre poli en premier ; La saison reste le mode classique (Complet, Express, Vestiaire, Loto, Une saison, Une franchise) et profite de tout ce qui se corrige dans le moteur ; depuis le 6 octobre, c'est « Le 82-0 » : juste le repêchage, la saison d'un coup, les séries match par match (docs/decisions.md). Sur table reste « mode bonus » avec l'étiquette bêta tant que ses sept règles ne sont pas réparées (jalon 4). Exhibition reste un lien.

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
- [x] **R2 · Le Club et sa boîte de réception.** Les décisions deviennent des messages réglés dans un panneau (bureau) ou une feuille (téléphone) ; plus de plein écran de choix, sauf les moments de fête (pack, main de la journée, Coupe). — *30 sept., la mise en page : l'en-tête dit la journée, la fiche et le rang, le bureau ne les redit plus ; hier soir en une ligne dans l'affiche (toucher : le sommaire), le prochain match juste dessous ; la barre d'action (Journée suivante, Regarder, Jusqu'à la prochaine décision) collée au bas du téléphone, la boîte entre l'affiche et le volet. 6 oct. : les choix en feuille (panneau en bas au téléphone, centré au bureau) plutôt qu'en plein écran ; les fêtes (pack, main, Coupe) restent en plein écran.*
- [x] **R3 · Le soir de match** en quatre étapes (Aperçu, Préparation, Match, Résultat) à la place de la chaîne de fenêtres. — *30 sept. : les quatre étapes sur l'affiche (`.soir`, js/saison.js), l'étape courante en or, les faites cochées ; le résultat d'hier en tête de l'affiche (tableau final, buteurs, le drame du soir) puis « Prochain match › » ; chaque étape mène à ce qui existait (dépistage, poste de gérant, direct, sommaire).*
- [x] **R4 · Effectif, Marché, Ligue, Collection**, écran par écran. — *30 sept., au téléphone : le Marché en trois rangées basses (bandeau, relances, la case et le budget du choix) et la liste forcée, pour que la première carte se lise jusqu'à Signer sans défiler ; la barre d'action n'apparaît qu'avec « Lancer la saison » ; l'Effectif sans titre ni phrase d'aide, le résumé sur une ligne ; la fiche avec « ‹ Retour » en tête. 6 oct. : le toast en bande sous l'en-tête au téléphone (en bas au bureau). Preuve : smoke (le Club en un écran, la carte entière).*
- [x] **R5-cartes · De vraies cartes** (JP, 29 sept. : *sauf les cartes, qui ont l'air de vraies cartes, et avec background variés qui font pro*). Une dizaine de séries complètes (Vintage 70, Rétro 80, Glace, Aréna, Filet, Chrome, Écusson, Tableau, Signature…), chacune avec sa mise en page et un fond travaillé, assignées par époque ; les finitions deviennent des parallèles (réfracteur, dorure, numérotée) ; les cartes de match ont un fond par genre (tactique : tableau de coach à la craie) et de vraies illustrations au trait. Le poste, le salaire, le chiffre clé et le rôle restent au même endroit sur toutes les séries.
- [x] **R5 · La peau.** Jetons de design (7 tailles, 3 rayons, ~20 couleurs), icônes au trait à la place des 973 émojis, cartes de collection par époque, illustrations des cartes de match. — *11 oct. : l'interface n'a plus une taille, un rayon ni une couleur hors des jetons (`check_css` l'exige à zéro ; le carton et le plateau gardent leurs plafonds à part) ; chaque émoji du jeu rend au trait, FE0F parti, séquences liées entières (`check_emojis`) ; les dix séries par époque et les 39 dessins des cartes de match datent du 29 sept.*

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

### Inspirés de Trick Shot (JP, 13 oct. : *sans reprendre le fonctionnement, voici un jeu qui peut inspirer* ; choisis : 2, 4 et 8)

- [x] **T2 · La marge du dé décide où va la rondelle.** `glisser`, `passeManquee`, `margeDe` (js/table.js) : une passe ratée sans bâton sur la ligne, ou un « au fond » raté, file au-delà de sa cible d'une case par point manqué (`MARGE_MAX` 3), la bande la renvoie ; le retour d'un tir arrêté de justesse reste collé au gardien, de plus loin à deux cases, du côté opposé au tir (`rebondir`, `rayon0`, `vise`).
  - Preuve : `check_regles` (trois scènes : un point, trois vers la bande, le retour de justesse et de loin).
- [x] **T4 · L'écran et l'interférence.** `gardienGene`, `ecranDe`, `ECRAN_MOD` (js/table.js) : un coéquipier sur la trajectoire, à deux rangées du filet ou plus, vaut +1 au tir ; un coéquipier sur une des trois cases collées au gardien fait refuser le but (sifflet, mise au jeu au neutre, le tir ne compte pas). Le tir affiche 0 % et la consigne dit pourquoi (js/plateau.js) ; l'IA se place en écran et ne tire pas un but qu'on refuserait.
  - Preuve : `check_regles` (l'écran +1 ; 0 % affiché, BUT REFUSÉ, l'égalité de la feuille) ; `check_table` (les cibles du plateau tiennent).
- [x] **T8 · Le format Éclair.** `PERIODES_ECLAIR`, `m.periodes` (js/table.js) ; le réglage « Format » de Nouvelle partie, en Sur table (`G.formatTable`, une préférence) ; le tournoi le fixe à son tirage et le garde dans sa sauvegarde (`T.periodes`, js/tournoi.js), l'exhibition le lit à chaque match ; le titre du plateau dit « Éclair ».
  - Preuve : `check_regles` (30 matchs Éclair : une période, puis la prolongation s'il le faut) ; `smoke_table`.

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
- [x] Poids (réécrit le 11 oct. avec JP) : l'APK, au premier écran, moins de 25 requêtes, moins de 900 Ko compressés, le titre en moins de 1,5 s au processeur ×4 — `essai_poids` ; Sur table à la demande. *Avant : « < 900 Ko et < 25 requêtes ; style.css < 150 Ko », que les octets bruts et la feuille unique ne tenaient qu'en défaisant deux décisions.* — *29 sept. : l'APK y est (13 requêtes, 1,25 Mo au premier écran) ; la version locale non minifiée charge 56 requêtes et 2,45 Mo, sans conséquence puisqu'elle est servie en local (JP : « juste local »).* *11 oct., remesuré (`mobile/assembler-www.mjs`, écran titre à 390 px) : l'APK charge 18 requêtes, 811 Ko compressés, 1,98 Mo bruts ; style.css minifié 374 Ko. La version locale : 77 requêtes, 3,4 Mo (1,3 Mo compressés) — les modules ES natifs sans build, une requête chacun. Les requêtes tiennent ; les octets bruts et style.css < 150 Ko demanderaient de ne charger au titre que le menu (import à la demande du reste) et de réécrire la feuille : à trancher avec JP.* *Puis mesuré comme un téléphone le vit (`node scripts/essai_poids.mjs <adresse>`, processeur ×4, 390 px) : l'APK tient 18 requêtes, 826 Ko compressés et le titre en 874 ms ; la version locale 79 requêtes, 1,3 Mo compressés, le titre en 892 ms. Proposé à JP : la cible devient « l'APK : moins de 25 requêtes, moins de 900 Ko compressés, le titre en moins de 1,5 s au processeur ×4 — `essai_poids` » ; les octets bruts et style.css < 150 Ko défont deux décisions (pas de build sur le web, une seule feuille, docs/decisions.md) pour un titre déjà sous la seconde.*
- [x] Sur table : `check_regles` avec les sept règles neuves, ou le carton porte « bêta ».
- [x] CI verte sur `1.0`, `sw.js` en 1.0.0, `site.webmanifest` et l'APK au même numéro.
- [x] Un vrai téléphone : une saison complète sur Android (barre d'état, barre de gestes, clavier dans la recherche), sans page qui défile de côté.
- [x] Docs vivantes : CLAUDE.md < 40 Ko, journal dans `docs/journal/`, README avec les captures de la 1.0.

### La semaine de sortie

- [x] Lundi · gel des chaînes : relire toutes les chaînes affichées (accents, majuscules, « ,880 » cohérent, zéro mot de développeur).
- [x] Mardi · `v1.0.0-rc1` : `VERSION` du cache dans `sw.js`, APK via `mobile/fabriquer-apk.ps1`, Pages depuis `1.0`.
- [x] Mercredi et jeudi · deux saisons à la main (téléphone et bureau) par quelqu'un qui n'a jamais joué ; noter chaque hésitation de plus de trois secondes ; corriger seulement ce qui est cassé.
- [x] Vendredi · `v1.0.0` : fusion dans `main`, tag, README, lien Pages et APK. Ensuite, les idées gelées (défi du jour, deux joueurs, avant 1970) reprennent sur `main`.

## Jalon P · Les packs et le cartable (JP, 12 oct. : *j'ai facilement fait la finale* ; *les récompenses devraient peut-être être des packs de joueurs, avec des cartables style Pokémon Pocket, mettre l'accent sur la collection des joueurs avec certaines cartes d'effets avec les joueurs* ; *on limite aussi les packs, tout en gardant des thématiques* ; *je veux que les cartes de match, événements, etc. soient avec les cartes de joueurs* ; *avoir des doublons possibles, qui font que t'as moins dans chaque pack, mais ajouter des cartes qui permettent de piger dans tes cartes pour signer*)

Le constat, mesuré le 12 oct. (270 premières saisons de `rogue_sim`, 99 qualifiées, les mêmes dés) : la main de l'adjoint en séries vaut +0,24 ronde avec le deck de départ (1,00 → 1,24), et un club classé 13e à 16e atteint la finale 17 % du temps même sans carte. Le robot de la courbe jouait ses séries sans main : ce que le joueur vit n'était pas mesuré. Ce qui emballe une run en séries : chaque série gagnée donnait une carte rare jouable tout de suite, et quatre cartes du deck coûtent 0 d'élan. Plafonner la main (2 ou 3 cartes, une main de 4) n'a rien changé hors du bruit.

- [x] **P0 · Le robot joue sa main en séries.** `scripts/lib/rogue_sim.mjs` : l'option `mains` (la main de l'adjoint, `mainDeLAdjoint`, et la piste la plus probable) devient le défaut de la courbe.
  - Preuve : `check_rogue.mjs` informe les rondes avec et sans main, sur les mêmes dés ; R9 tient encore (la Coupe entre la run 3 et la run 8).
- [x] **P1 · La série gagnée donne un pack, pas une carte.** `recompenseSerie` (js/saison.js) : Argent à la première ronde, Or à la deuxième, Étoiles en finale, Légendes avec la Coupe. Les joueurs vont au cartable : pour la saison suivante et les runs d'après (le classeur), jamais dans l'alignement des séries en cours ; les cartes de match du pack, au deck de la saison suivante.
  - Preuve : `check_rogue` : aucune décision de séries n'ajoute une carte au deck des séries en cours ; `essai_rogue` ouvre le pack d'une série gagnée.
- [x] **P2 · Sept packs, tous mixtes, des joueurs ET des cartes.** `js/packs.js` : Bronze, Argent, Or (au hasard) ; Époque (la décennie se choisit à l'achat), Spécialistes (le rôle : francs-tireurs, passeurs, défensif, durs, gardiens, recrues, vétérans), Club (une franchise, une saison ou un vrai trio), Coach (des joueurs de sa couleur et des cartes de sa couleur). Chaque pack : des joueurs et une ou deux cartes de la banque (match, événement, modif, consommable, contrat, personnel). Les 33 packs d'aujourd'hui s'ouvrent encore dans une vieille sauvegarde ; ils ne se vendent plus. Étoiles et Légendes ne se gagnent qu'aux séries.
  - Preuve : `check_packs` (la revente ≤ 40 %, les taux de chaque pack, chaque thème tient sa promesse), `essai_packs`.
- [x] **P2b · Tout se pige.** JP : *faire que toutes les cartes et leurs variantes soient possibles avec tous les packs combinés*. Chaque joueur-saison-club des shards, dans chacune de ses quatre variantes (Base, Parallèle, Holo, Or numérotée), et chaque carte de la banque qu'un des 33 packs d'aujourd'hui pouvait donner (aucune ne se perd dans la fusion ; celles qui se gagnent en jouant, les malédictions et les cartes de saison, restent hors des packs), a une chance non nulle de sortir d'au moins un pack (boutique et séries réunies). Aujourd'hui, deux trous : un joueur sous le seuil d'un régulier (`niveauDe` rend −1 sous ~40 matchs) ne sort d'aucun pack, et un joueur échangé ne sort que sous un de ses clubs (`uniques`, js/niveaux.js). Ils entrent comme Soutien, à petit poids : la chance d'un régulier ne bouge pas.
  - Preuve : `check_packs` calcule le SUPPORT de chaque tirage (ce qui peut sortir, pas un échantillon) et exige la couverture complète : joueurs × variantes, et la banque.
- [x] **B · La robustesse blesse, au nombre de la vraie LNH.** JP, 12 oct. : *robustesse cause blessures, pas douze blessés en même temps, mais nombre normal versus la vraie vie* ; partout, tous les modes. Mesuré : le moteur fait 6,4 blessures et 49 matchs-hommes perdus par club-saison (0,6 blessé à la fois) ; la LNH, environ 180 à 220 matchs-hommes (2 à 2,7 à la fois). La robustesse de l'adversaire monte le risque de tes joueurs (`applyInjuries`, js/sim.js), et le risque de base se règle sur la vraie LNH. Une blessure de moins de quatre matchs ne bloque jamais la journée (`BLESSURE_MOMENT`).
  - Preuve : une ligue de vrais clubs, 2 à 2,7 blessés à la fois en moyenne, jamais six de suite chez un club plus d'une fois sur cent ; un club dur blesse plus qu'un club léger, en paires ; `check_ratings`, `check_robot`, `check_graine`, `check_feuilles` restent verts.
- [x] **E · Des arcs qui arrivent seuls ; les cartes Événement, des gestes du DG.** JP, 12 oct. : *arcs arrivent seules, les cartes événements deviennent des choses proactives du DG*. Trois ou quatre arcs par saison, à ton club, de deux ou trois épisodes sur quelques semaines, à la une du bureau, un effet de quelques matchs chacun, la somme neutre sur la saison (comme les situations, `check_situations`). Tirés de la graine, sans `hasard()`, sans décision. Les événements qui arrivent (un chant des gradins, un titre malheureux) deviennent des épisodes ; les cartes Événement qui restent sont ce que le DG décide (le jet privé, le banquet, le documentaire).
  - Preuve : un check des arcs (purs, au jour dit, neutres en paires), `check_clarte`, `check_fils`.
- [x] **P3 · Des doublons, et de quoi s'en servir.** Les packs ne retirent plus les cartes déjà au cartable : un pack rend moins de neuf. En retour, des cartes de la banque qui pigent DANS ton cartable : signer un joueur de ton cartable (trois offerts, sous le plafond, au niveau Régulier au plus pour une commune), rappeler un joueur d'une run d'avant, échanger un doublon contre un joueur de la même série. Elles passent par la signature qui existe (`ballottage`), aucune mécanique neuve. Trois doublons d'une même carte en montent la variante (Base → Parallèle → Holo).
  - Preuve : `check_packs` (le taux de doublons par pack, à cartable vide, à 200 et à 1000 cartes) ; `check_rogue` (le classeur et la pige du cartable n'emballent pas la première run).
  - JP, 12 oct. : *les cartes sont genre le club-école* ; le rappel se fait AVEC UNE CARTE (« Rappel du club-école » : trois joueurs de ton cartable offerts, un signé sous le plafond).
  - Fait : 📟 « Le rappel du club-école » (commune, Régulier au plus) et « Le rappel d'un pilier » (rare, Pilier au plus), signés par une décision `ballottage` (`offresDuCartable`, js/rogue-jeu.js) ; trois doublons montent la carte (`monterLesDoublons`, js/cartable.js), jusqu'à Holo. 📟 « Le retour d'un ancien » (peu commune, Pilier au plus) : une carte qui a joué une run d'avant (`anciens`). 📟 « L'échange d'un doublon » (peu commune) : ton doublon le plus fourni perd une copie (`donnerUnDoublon`, js/cartable.js) contre un joueur de sa série de cartons (`serieDe`), pas encore au cartable, qui y entre (`offresDEchange`, js/rogue-jeu.js). Preuve : `essai_rogue` (10e). Preuve : `check_deck`, `essai_rogue` (10d).
- [x] **P4 · Le cartable façon Pokémon Pocket.** `js/cartable.js` : chaque série de cartons par époque (Vintage 70, Rétro 80…) est une extension avec sa complétion ; des missions de collection payent des médailles 🏅 (un vrai trio complet, un club-saison, cinq Holo d'une époque).
  - Preuve : `essai_rogue` (une mission accomplie paie une fois) ; `check_clarte`.
  - Fait : l'onglet Extensions du cartable (une décennie par extension, Vintage 70 à Années 2020, sa complétion sur ses shards) remplace Saisons ; six missions (`missionsDuCartable`, js/cartable.js), payées une fois en médailles à vie (`payerMissions`, js/rogue.js) à l'ouverture d'un pack. Preuve : `check_deck`, `essai_rogue` (12x).
- [x] **P5 · La carte signature.** Une carte de joueur Holo ou Or apporte au deck une carte de match qui existe déjà, choisie par son rôle maîtrisé (un sniper Or : « Le tir affûté »), tant qu'il est habillé.
  - Preuve : `check_cartes` (en paires, sous la borne de sa rareté), `check_combat`.
  - Fait : `signaturesDe` (js/combat.js), en Rogue seulement : un Holo ou un Or habillé (ni rayé ni blessé) ajoute au deck de match la carte de son premier rôle (sniper « Le tir des poignets », plombier « Le trio de plombiers », gardien « Le gardien en feu »…) ; le camp et le ménage ne visent que le deck. Aucune carte neuve. Preuve : `check_deck`, `check_combat`.

## Jalon Q · Entre deux saisons, et la poche (JP, 12 oct. : *meilleur système de repêchage pour saisons suivantes, et meilleure gestion des cartes tirées de packs pendant la saison* ; *la grosse liste, ça suce, faque je dirais x loto à même mes joueurs pis plus tard, choix dans tout* ; *signer un, et autres cartes (matchs, signature, effets) jouables quand on veut*)

- [x] **Q1 · Le loto du cartable.** `lotoDuCartable` (js/rogue-jeu.js) remplace le classeur et le repêchage de cinquante cartes entre deux saisons : trois lotos (un de plus par page du classeur, `lotosDeSaison`, js/rogue.js), chacun trois cartes de TON cartable (cinq avec le tri), une signée ou aucune ; le classeur ouvert en fait le choix dans tout. Le reste se tire du cartable (`vestiaireDeDepart`), comme le robot le jouait déjà. « Passer le repêchage » ne plante plus (une `graine` qui n'existait pas).
  - Preuve : `check_rogue` (le robot signe la meilleure carte de chaque loto, `lotosDuRobot` ; sans déblocage la Coupe reste rare, la première Coupe demande encore plusieurs runs) ; un essai au navigateur sur la sauvegarde de JP : quatre lotos de cinq cartes, 23 joueurs, zéro erreur.
- [x] **Q2 · La poche, quand on veut, et elle suit.** Toute carte de la poche se joue, du bureau ou de Cartes, `JOUEES_SEMAINE` par semaine en tout (la main de quatre reste le choix du coach, elle ne bloque plus le lundi) ; la poche pas jouée passe à la saison suivante de la run (`poche`, une décision de report). Un pack mixte se déchire une fois sur tout son contenu, puis ses joueurs seuls se signent ; « Plus tard » se signe de la boîte, sur place.
  - Preuve : `check_deck` (une carte hors de la main se joue et compte ; la poche reportée entre au jour 0 et en sort une fois jouée) ; `essai_rogue` (le paquet entier, puis la signature, joueurs seuls).

## Jalon R · Signer comme au 82-0 (JP, 12 oct. : *la liste pour signer en mode 82-0, c'est clair complet, pourquoi c'est pas ça pour intégrer joueurs signés et alignement en mode roguelike ?* ; choisi : la liste, et la case calculée)

- [x] **R1 · La liste de signature.** `ouvrirListeSignature` (js/repechage.js) : les rangées du vestiaire du 82-0 (`rangeeHtml` : visage, salaire, chiffre clé, variante, rôle, zone) ; chacune dit sa meilleure case (`meilleureSortie` : la case où il rend le plus, un avant pour un avant, qui sort, ce que ça change par match). « Signer » l'y pose ; toucher la destination ouvre « qui sort ? ». Les packs de joueurs (après le paquet), le rappel du club-école, le ballottage (sa case : celle du blessé) et le joueur au choix d'une main.
  - Preuve : `essai_rogue` (8 : la liste, la fiche, « Changer » puis « qui sort ? » ; 10d : le rappel signé d'un toucher), `smoke` (le ballottage du 82-0 passe par la liste).
- [x] **R2 · Entre deux saisons, les mêmes rangées.** Le départ du classeur, « Ceux qui restent » et les lotos (js/depart.js) montrent les rangées du vestiaire, « Prendre » et « Remettre ».
  - Preuve : `essai_rogue` (le départ du classeur).

## Jalon U · Une interface (JP, 12 oct. : *je veux que l'interface soit toujours en phase, cohérente, pas avec plein de designs différents pour des fonctions pareilles* ; *prends le meilleur de chaque*)

L'audit (une fonction, ses dessins) a trouvé cinq façons de choisir un joueur, sept d'onglets et de filtres, quatre jauges du plafond, deux faces pour la même carte de jeu, dix « rien ici ».

- [x] **U1 · Les onglets** : un dessin, le souligné d'or des sous-pages (`.soustab`), pour les onglets de l'inventaire, de la boutique, du bilan et les vues du cartable.
- [x] **U2 · Les filtres** : un dessin, la pastille bordée et son compte (`.inv-filtre`), pour les postes du vestiaire (avec ce qui reste à combler), les groupes de l'onglet Joueurs, du classeur et de l'inventaire.
- [x] **U3 · La recherche** : celle du vestiaire (l'icône, la liste qui suit chaque lettre) au départ du classeur.
- [x] **U4 · Le plafond** : une jauge (`jaugePlafond`, js/util.js) à l'inventaire, à la boutique, au classeur et dans la liste de signature.
- [x] **U5 · Les boutons et les pieds** : « Signer » est `.btn-sign` partout ; or pour choisir, vert pour lancer ; un pied de fenêtre (`.gl-pied`).
- [x] **U6 · Choisir un joueur** : les rangées du vestiaire (`ouvrirListeJoueurs`) pour « pour qui ? », « qui soigner ? », « qui monte ? », « Nouveau rôle » et « Garder un joueur ».
- [x] **U7 · La carte de jeu** : l'inventaire montre la face d'un pack ou d'une main (`carteDeBanqueHtml`), plus une carte plate à part.
- [x] **U8 · Rien ici** : une phrase centrée (`.empty-msg`), et sa petite.
- [x] **U9 · Les fenêtres** : une tête (`.choix-tete` : l'icône, le titre, sa sous-ligne, le ✕ `.choix-fermer`) pour les deux familles — les `.modal-backdrop` (sommaire, options, « Nouvelle partie », la fiche) comme les `.choix-modal` ; un pied (`.choix-pied`, le dessin de « qui sort ? » : le mot à gauche, le verbe à droite, pleine largeur au téléphone) pour celles qui confirment (« Où joue X ? », le système d'une unité, le classeur, « Nouvelle partie », une page du club). Le ✕ est la seule façon de fermer : plus de « Plus tard » en ligne, d'« Annuler » ni de « Retour » au pied. Le système d'une unité se ferme enfin à Échap (son ✕ n'était pas un `.choix-fermer`).
- [x] **U10 · La page du club** : bâtie une fois (`pageDuClub`, js/util.js), pour le Bureau et le Marché.
- [x] **U11 · Un nom, une fonction** : `enteteJoueur` (js/gerant.js) et le champ d'option `joueurHtml` ; `carteJoueur` reste à js/repechage.js.
- [x] **U12 · Rien à prendre** : la liste s'ouvre et le dit (`vide`, `.empty-msg`) au lieu d'un toast qui la refermait (infirmerie vide, deck sans malédiction, cartable sans carte sous le plafond, contrats) ; les toasts restent aux confirmations.
- [x] **U13 · Qui sort, en liste** (JP, 13 oct. : *choisir qui est remplacé avec un menu similaire à celui pour signer le joueur*) : les rangées de la liste de signature (`rangeeHtml`), sa ligne, la masse et ce que sa sortie change par match, « Sort » ; ceux de son poste d'abord, le meilleur échange en tête ; la réserve libre en bouton au-dessus. « Où joue X ? » reste l'alignement.
- [x] **U14 · Ton club** (JP, 13 oct. : *nom et logo devraient être ensemble, et logos moins ressemblants*) : vingt clubs, chacun son nom ET son écusson, dessiné sur sa propre composition (tête de mascotte, lettrage, monogramme, fanion, rondin, phare…) ; les couleurs restent à part. Un nom ou un écusson acheté avant donne son club.
- [x] **U15 · Les choix dans l'alignement, en rangées** (JP : *refaire l'alignement plus comme la page signature*) : « Où joue X ? », « Sur qui ? » des cartes et les unités spéciales sont les rangées de la signature, un bouton par rangée (« Ici », « Poser », « Entre ») ; l'onglet Lignes dit le rôle en mots (`roleTag`), comme la rangée du vestiaire.
- [x] **U16 · Jouer une carte** (JP : *trop d'étapes, on ne comprend pas, trop de cartes injouables*) : « Poser » décide depuis la rangée (plus de détour par le verso) ; chaque carte dit sur qui ou sur quoi elle joue ; les jouables d'abord, les autres sous « Pas maintenant », leur raison dite une fois.
- [x] **U17 · Les effets plus francs, ou plus simples** (JP : *les choix de l'entracte, plus gros effet ; les cartes de match, plus gros effet ; les cartes long terme, plus simples et moins brisées*) : l'entracte ×1,6 sur chaque écart au 1 (`FRANCHISE_ENTRACTE`), les cartes de match ×1,8 (`FRANCHISE_MATCH`, leur main à l'adversaire reste à l'échelle d'avant : la difficulté ne bouge pas) ; un événement garde un bonus et un prix, ×0,85, huit journées au plus (`ATTENUATION_LONG`, `DUREE_MAX_LONG`), et « En cours » dit combien de matchs il lui reste.
  - Preuve : `essai_rogue`, `essai_packs`, `smoke`, `check_css`, `check_mort`, `check_gros`, `check_choix`, `check_combat`, `check_evenements`, `check_coachs`.
- [x] **U18 · Signer demande qui part** (JP, 13 oct. : *c'est plus le cas*) : dans la liste de signature (packs, rappel, ballottage, joueur au choix, entre deux saisons), « Signer » ouvre « qui sort ? » dès que quelqu'un sort ; la meilleure sortie y est proposée, en tête et cerclée d'or (`propose`, js/repechage.js `choisirQuiSort`), et « Sort » la signe à sa case déjà calculée ; un autre sortant passe par « Où joue X ? ». Quand la meilleure case est libre (la réserve libre du Rogue), la rangée le dit et « Signer » y signe sans question. Le rappel du club-école suit la même règle (`quiSortOuCaseLibre`).
  - Preuve : `smoke` (la sortie proposée seule en tête), `essai_rogue` (« Signer » ouvre « qui sort ? »), `essai_packs` (un tour sur deux par la sortie proposée, sinon un sortant au hasard puis « Où joue X ? »), `essai_achat`.
- [x] **U19 · Les Lignes plus sobres** (JP : *chargé, ça ressemble pas à la page de signature* ; captures montrées, puis *le fond où y'a la position, pas de couleur, mais couleur où y'a le nom*, *quelque chose de plus sobre*) : sous 1400 px, la colonne du poste et du salaire est neutre, l'écusson du club est devant le nom (`.slot-qui`, `.slot-logo`), une teinte légère du club derrière le joueur ; rien de retiré (poste, salaire, nom, visage, rôle en mots, niveau, zone, ↔, ▼ ▲, 🩹, lancée ou doute, jambes, traits, ✕, chiffre clé). Hors du téléphone, dès 1000 px, chaque unité tient sur une ligne, ses joueurs côte à côte (*style depth chart*) ; à la tablette, « Aligner au mieux » prend toute la largeur au lieu de la place d'une unité.
  - Preuve : captures à 390, 768, 1100 et 1280 px, `smoke` (`sansDebordement`), `check_css`, `check_mort`.
- [x] **U20 · Hier soir, au Bureau** (JP, 13 oct. : *narration et uniformisation du UI, pour que ça soit clair et limiter d'avoir à chercher et se promener partout*) : la soirée tient en un bloc sous l'affiche (`.hub-soir`, js/saison.js `voletJourneeSeul`) — le résultat (toucher : le sommaire) et le récit de son but gagnant, le drame, le gros match, la une, puis « Autour de la ligue » : le rival au classement, la séquence du prochain adversaire, la tienne, la voix du panel. Avant, ces quatre dernières ne vivaient que les trois secondes du passage, en surimpression transparente par-dessus l'affiche (illisible au téléphone). Le passage garde le pointage, le tampon, le but gagnant et le rang, sur un voile presque opaque ; sa liste est partie (une info, une maison).
- [x] **U21 · Tes cartes et la boutique, un toucher chacune** : les Cartes ont quatre sous-onglets — Ta main, Tes cartes, Boutique, Album. Le sous-onglet « Boutique » ouvrait une liste de deux tuiles, et la poche entière (le compte de la pastille) se cachait derrière, sous une seconde tête « ‹ Tes cartes » alors que l'onglet allumé disait « Boutique ». Plus de liste ni de seconde tête (`remplirMarche`, js/game.js) ; hors saison, Tes cartes se regardent sur place. Le même mot partout : « Tes cartes » (le menu, l'album, l'inventaire disaient « Mes cartes »), et « Les lignes » 🏒 à la carte de la semaine, comme au Bureau.
- [x] **U22 · Ton histoire avant le calendrier** : sous Ligue › Ta saison, le récit de la saison vient après la route, plus sous les 186 cases du calendrier.
  - Preuve : `tout.mjs`, `check_mort`, `check_css`, `check_clarte`, `check_coquille`, `essai_rogue` (suit les nouveaux sous-onglets), captures à 390 px.
- [x] **U23 · Une option, un dessin** (JP, 13 oct. : *la carte de la semaine, les cartes événements… le UI est vraiment convoluted ; ça pourrait être plus streamlined sans perdre de complexité*) : `optionHtml` (js/gerant.js) — la fenêtre d'un choix, la carte de vestiaire et l'écran de la semaine dessinent la même option ; cochée, elle est en or avec son crochet. La route n'a plus deux icônes.
- [x] **U24 · La semaine sur un écran** : au lundi, cinq écrans pour deux décisions deviennent un. La semaine passée pliée en tête, les sept jours, l'état du club, chaque choix du lundi avec ses options (récompense à part ; proprio, séquence, dilemme, route, courriel ou point de presse, retour d'un blessé), ce qui attend encore, ta main ; « Valider la semaine » envoie tout en un lot (`specsForces`, `ouvrirNoeud`, js/saison.js). Un pari garde son dé, le butin son paquet. docs/decisions.md.
- [x] **U25 · Le gros match en étapes** : 1 leur plan, 2 ta carte de vestiaire, 3 ta main ; leur main, la règle de la préparation et le tableau des deux clubs pliés.
  - Preuve : `tout.mjs`, `check_mort`, `check_css`, `check_clarte`, `essai_rogue` (chaque semaine validée en un lot : autant de décisions que de choix), `smoke`, `essai_achat`, captures à 390 px.

## Jalon M · La mise en scène et le mobile (JP, 17 oct. : les consignes de docs/mise-en-scene-et-mobile.md — *on n'explique pas pourquoi faire un choix plutôt qu'un autre ; pas de mise en scène, pas de contexte narratif* ; *aussi, refondre le look des boutons et cie pour faire plus clair sur mobile, même chose pour fonts et cie*)

Une petite PR par tranche, dans l'ordre des consignes ; le look des boutons et des polices a la sienne, après la première.

- [x] **M1 · Le bouton flottant et la mise doublée** (B1, B2) : le bouton flottant du bureau garde ses 48 px (la mesure ne sert plus qu'à la réserve du volet, et une hauteur nulle ne s'écrit plus) ; le survol des boutons ne vit plus qu'au curseur (`@media (hover: hover)`), et la mise doublée touchée prend l'or et sa coche (« ✓ Mise doublée »).
  - Preuve : `essai_rogue`, au doigt (`hasTouch`) : le bouton flottant à 44 px au moins chaque fois qu'il paraît (« Ce soir » défilé au bout), la mise doublée touchée sur le fond de l'or, puis laissée.
- [x] **M2 · Le look : boutons et polices, clair au pouce** (JP : *refondre le look des boutons et cie pour faire plus clair sur mobile, même chose pour fonts*). Trois rangs de boutons qu'on ne confond pas : l'action de l'écran pleine en capitales, les autres pleins d'un fond sombre en casse de phrase (un contour sur la photo voilée avait l'air éteint), le lien › en texte ; les rayons de 4 à 8 px. Les polices : les puces de chiffres en phrase, dans la police du texte (« ≈ −0,4 tir la période ») ; les étiquettes d'un joueur, le segment, Retour et ce qui va se passer en casse de phrase (« Bagarreur Argent » tient où « BAGARREUR ARGE… » se coupait) ; le texte courant en 500 ; les deux gris plus clairs (plus de 6:1) ; au téléphone, le plancher à 12,5 px et le corps à 15. Un message ouvert d'À faire porte son fond : la photo ne passe plus derrière ses phrases.
  - Preuve : captures à 390 px avant et après, `smoke` (0 px de débordement, rien hors de portée), `essai_rogue`, `check_css` (sept tailles, trois rayons, aucune couleur en dur).
- [x] **M3 · La barre « Encore un choix » et les cibles de 44 px** (B4, B5). La barre dit « ⏳ Encore un choix · Tes 3 rivaux » sur une ligne, d'une teinte neutre ; la toucher pose le choix en haut du volet, ses options au-dessus d'elle. Ce qui se touche fait 44 px : les rangées de 40 (✕, Retour, segments, filtres, recherche, menus, relances, Signer, outils) et de 32 à 36 (« Déjà en jeu », les boutons du bureau, les sauts, les systèmes d'une ligne, les matchs passés de la route, « En jeu »), et les petits dessins gardent leur taille avec une zone de toucher agrandie autour (la croix d'une case, les liens entre joueurs, « Cartes » de l'en-tête, le nom au tableau, la case visée d'une signature).
  - Preuve : smoke `cibles44` (scripts/lib/cibles.mjs : tout bouton, résumé ou `[role=button]` qu'un doigt atteint fait 44 × 44 de zone, aux mêmes écrans que `toutEstAtteignable` à 390 px ; deux exceptions nommées), `essai_rogue` (« Encore un choix » tient sur une ligne, et la première option du choix déplié finit au-dessus de la barre).
- [x] **M4 · Les scènes, le socle** (A1, A2, A7) : `js/scenes.js`, un module pur partagé avec Node — chaque scène rend `{ de, mot, fait }`, ses répliques pigées par graine comme `messageDuFil`. La mise doublée : le capitaine, et le pointage contre le rival nommé, au-dessus du bouton. Le palier des 9e, 18e et 26e matchs : le proprio, sur la fiche, le rang et le mandat. Une carte de trop : le préposé à l'équipement, et le gros match annoncé s'il vient. Le médecin, le DG et le dépisteur passent dans `EXPEDITEURS` : une seule distribution.
  - Preuve : `check_clarte` § 5 (chaque scène, toutes les situations, quarante graines : une voix d'`EXPEDITEURS`, une réplique sans chiffre, un fait qui porte ses nombres ; chaque réplique écrite), `essai_rogue` (le palier et la carte de trop ouverts dans À faire citent leur voix ; la mise doublée cite le capitaine et son fait nomme le rival).
Le 17 oct., JP tranche le jeu de cartes neuf (docs/refonte-v10.md), puis les écrans du Rogue refaits à neuf : M5 passe dans la V10 (les événements deviennent des choix d'À faire, dits par leurs voix) ; M6 à M8 attendent les écrans neufs, qui les rattrapent.

- [x] **M5 · Les scènes de la semaine** (A3 à A6) — dans la V10, tranche 5 : la route (l'entraîneur nomme le pire problème du lundi et la route qui y répond), la blessure (le médecin, l'absence, la case, le prochain adversaire), les rivaux (le proprio), le butin (l'entraîneur, le pointage et l'épaisseur du cahier) ; `sceneDeLaRoute`, `sceneDeLaBlessure`, `sceneDesRivaux`, `sceneDuButin` (js/scenes.js).
  - Preuve : `check_clarte` § 5 (la route recommandée répond au pire problème ; chaque fait porte ses nombres), `essai_rogue` (la route, la blessure et les dossiers citent leur voix).
- [x] **M6 · La fin de saison et les galons** (A8, B8) — les écrans neufs, E1 (docs/ecrans-rogue.md) : le proprio dit le mandat (`sceneDuMandat`, js/scenes.js) dans « Ta run » et au bilan quand il est rempli ; les galons de la saison se relisent dans l'histoire de chacun chez toi et s'écrivent au bilan, dans la run et dans « Ta run », sous le capitaine (`sceneDesGalons`), au lieu de toasts qui s'écrasaient ; `toast()` a sa file d'attente (un avertissement passe devant, rien ne se répète).
  - Preuve : `check_clarte` § 5 (le mandat et les galons), `essai_rogue` (12c : « Ta run » cite le proprio et montre chaque galon ; 12d : le bilan aussi, sous le capitaine).
- [x] **M7 · Le gros match plus court, une feuille à la fois** (B3, B7) — E2 : l'intention répondue et la carte de vestiaire gardée se plient en une ligne, qu'un toucher rouvre ; la mise doublée a son panneau, hors du pli ; une fenêtre ouverte cache celles qu'elle couvre (style.css, `.choix-modal`), qui reviennent quand elle se ferme.
  - Preuve : `essai_rogue` (20j : au geste pris, la période tient à 1,3 écran au plus et « Jouer » reste à l'écran ; 20k : jamais deux feuilles visibles).
- [x] **M8 · Les places, les troncatures, le jargon** (B6, B9, B10) — E3 : un verbe par tuile (« Jouer · ou vendre +8 🪙 », « Poser »), deux copies groupées « ×2 », tes places sous l'affiche de « Ce soir » ; deux lignes plutôt qu'une coupée (la destination d'une carte, la ligne d'une carte de jeu, la décision prise, le sous-titre d'une rangée, le nom d'un club au direct), la gemme lisible ; le % d'arrêts en mots (« au % d'arrêts », « mieux que la ligue »), les matchs en entier, la route dit « chez » et « prolongation ».
  - Preuve : `essai_rogue` (10b : chaque tuile a son verbe, les places à moins d'un écran du haut), `check_clarte` (trois mots réservés de plus, chacun son témoin).

## V10 · Le jeu de cartes neuf (JP, 17 oct. : *jeter toutes les cartes et créer de zéro avec la nouvelle philosophie en tête* ; tranché : les cartes d'abord, puis les écrans du Rogue ; le « si » élargi)

Le devis : docs/refonte-v10.md. Une carte = un moment + une réponse ; ~120 cartes en quatre piles (le cahier, les places, l'équipement, le personnel), variées, impactantes, liées aux coachs ; les événements deviennent des choix ; toutes les runs repartent de zéro.

- [x] **V10-1 · Les moments dans le moteur** : `MOMENTS_SI`, `momentsDuSoir`, `joueCeSoir` (js/sim.js) — dix-neuf moments posés sur le club et ses joueurs à chaque match, et à chaque période d'un duel ; un effet, une carte, un patron d'un moment ne jouent que leur soir. Aucune carte ne les lit encore : l'empreinte du moteur ne bouge pas.
  - Preuve : `check_moments_si` (au CI), `check_empreinte`, `tout.mjs`.
- [x] **V10-2 · Le cahier neuf** (le duel) et les robots qui le jouent : `CAHIER` (js/cahier.js), 44 cartes — le départ neutre (une réponse par intention, deux coups de 3e, trois cartes de tous les soirs), quatre cartes par coach (deux au Comptable, ses paris), chacune dans un moment. Une réponse ne contre que SON intention et ne joue que sa période ; un coup de 3e, selon le pointage ; une soirée, son soir. L'ancien deck se retire (plus offert, encore joué par les runs en cours jusqu'à V10-6). Les robots gardent une carte hors de son moment ; l'adjoint répond mais laisse le coup de 3e au joueur.
  - Preuve : `check_cahier` (quatre minutes : chaque carte en paires dans son moment, rien hors de lui, sous la borne de sa rareté, une rare se voit), `check_duel` (63,9 % en face à face), `check_combat`, `check_coachs`, `check_deck`.
- [x] **V10-3 · Les places et l'équipement** : 30 places (`PLACES_NEUVES`, js/places.js), trois par coach et trois neutres, chacune un moment de la semaine sur ses `duree` prochains matchs (le Comptable paie tout de suite) ; 18 équipements (`EQUIPEMENT`, js/equipement.js), trois par coach qui a un canal de joueur (le Frelon, l'Aigle, la Tortue, le Doc, le Showman) et trois neutres. L'ancien jeu de tous les soirs se retire (66 places, les améliorations, les styles, l'atelier générique) ; restent les soins, les rappels, le congédiement, les retouches d'édition, les trois modifs d'un moment d'avant, le feu et les contrats. Les routes de la semaine tirent le jeu neuf.
  - Preuve : `check_places` (sept minutes : en paires, 20 500 feuilles identiques hors du moment, toutes sous leur borne, les rares se voient), `check_evenements`, `check_coachs` (le plancher à 10 cartes par coach), `check_packs`, `check_banque`, `check_combo`, `check_chiffres`.
- [x] **V10-P · Les packs qui montent** (refonte-v10.md § 12 ; JP : *tu commences avec des packs un peu poches … ou tout ça*) : aucun taux à zéro, une boutique de départ poche (Bronze, Époque), les bons packs ouverts par les jalons, l'upgrade de chaque pack en médailles.
  - Preuve : `check_packs` (aucun taux à zéro, la boutique de départ, chaque clé et son jalon, les crans), `check_rogue`, `essai_rogue` (six packs sous clé), `check_coachs`.
- [x] **V10-4 · Le personnel et les contrats** : 21 postes (`PERSONNEL`, js/personnel.js), deux par coach et trois neutres (ceux que le départ impose), chacun un moment de la saison ; le Comptable travaille l'argent toute l'année. Quatre contrats lourds (`CONTRATS_MAUDITS`) : de l'espace tout de suite, un prix certains soirs ; avec la taxe de luxe, cinq maudites. L'ancien personnel et les 18 cartes de saison se retirent des tirages ; le DG du plafond flexible reste (un déblocage le donne). Les minutes et l'usure qu'un patron déplace attendent aussi son moment (js/sim.js).
  - Preuve : `check_places` (le personnel et les contrats lourds en paires : 31 500 feuilles identiques hors du moment, sous la borne, les rares se voient, les contrats lourds coûtent), `check_coachs`, `check_packs`, `check_banque` (les patrons).
- [x] **V10-5 · Les événements deviennent des choix d'À faire** (avec M5) : 19 dossiers (`DOSSIERS`, js/dossiers.js), un lundi sur deux, la semaine où le nœud ne s'ouvre pas : chacun lit un fait du lundi (la route, la maison, le dos-à-dos, l'infirmerie, le rival, la bête noire, les jambes, la caisse, le dernier match, le rang), parle par une voix d'`EXPEDITEURS`, et offre deux ou trois réponses, la plupart d'un moment (`si`). Elles passent par la porte des dilemmes (`familleDeMoment`, famille `dossier`) ; les jetons restent à la décision. Les 160 événements ne se tirent plus, et la route ❓ quitte le nœud de la semaine : trois routes, toujours.
  - Preuve : `check_dossiers` (dans `tout.mjs` ; remplace `check_evenements`), `check_places` (chaque réponse en paires, sous la borne d'une commune : de −0,1 à +0,3 V), `check_clarte` § 5, `check_noeuds`, `essai_rogue`.
- [x] **V10-6 · La conversion** : les runs repartent de zéro, l'ancien jeu part, la run se recalibre.
  - **La conversion** (`convertirAuJeuNeuf`, js/rogue.js ; `retirerLesRuns`, js/sauvegardes.js) : une fois, au démarrage, les runs en cours repartent de zéro et l'inventaire de cartes du méta se vide ; le cartable, les médailles, les déblocages et le panthéon restent. `VERSION_MOTEUR` passe à S116, l'empreinte se réécrit.
  - **L'ancien jeu part pour de bon** : les 160 événements (et js/evenements-vie.js), 46 postes de personnel, les 18 cartes de saison, 66 consommables, 53 modifs de joueur, 73 cartes de match. Restent la main de l'adversaire (47 cartes, `adverse`, hors de ta banque : sa main ne change pas d'une carte), les malédictions, le mentor (le choix d'un fil), le vendeur de chandails et les pièces du combo de la lancée. La banque passe de 655 cartes définies à 192, qui toutes se tirent.
  - **Ce qui donnait encore l'ancien jeu** : l'objectif réussi du proprio et la case vide donnent une carte parmi trois, pour une place ; la main des paliers 20, 40 et 60 tire trois des cinq sortes qui restent (ni carte de saison ni amélioration) ; l'atelier, ses quatre retouches ; la carte signature d'un Or ou d'un Holo est une carte du cahier.
  - **Les robots jouent le jeu neuf** (scripts/lib/cartes_robot.mjs) : les deux patrons imposés pour tous ; l'attentif suit la route que l'entraîneur recommande, prend la réponse d'un dossier qui rend le plus et joue la place d'un palier ; le distrait au hasard ; le robot d'avant ne joue toujours pas de cartes.
  - **Les juges** suivent : des patrons témoins à chiffres connus (scripts/lib/temoins.mjs) remplacent les cartes de saison dans `check_totaux`, `check_profil`, `check_impact`, `check_causes`, `check_chiffres`, `check_graine` ; `check_coachs` (le plancher à 9), `check_atelier`, `check_deck`, `check_combat`, `check_banque`, `check_packs`, `check_rogue`, `check_paliers`, `check_gardiens`, `check_dossiers` réécrits sur le jeu neuf.
  - Preuve : `tout.mjs`, `check_mort`, `check_graine`, `check_gros` (la main de l'adversaire identique, à l'empreinte), `check_combo`, `check_coachs`, `check_profondeur`, `check_rogue`, `essai_rogue`.
- [ ] **Les écrans du Rogue refaits à neuf**, maquettes d'abord (M6 à M8 y passent) — le devis : docs/ecrans-rogue.md ; six maquettes à 390 × 844 (le Bureau en enveloppes, une enveloppe ouverte, Ce soir, le duel, la mise, la fin de saison). Faits : E1 à E3 (M6 à M8), E4 (le Bureau en enveloppes : 1,61 → 1,35 écran), E5 (Ce soir en trois chiffres, en barres). E6 (le pointage en tête du duel, les périodes en pastilles : 1,27 écran au plus). Restent Ce soir et le Bureau à un écran (1,5 à 1,8 écran selon le soir).
