# V25 · A1 — Le noyau et les greffes : l'extrait du devis

L'extrait de `docs/refonte-v25.md` pour la tranche **A1** (5 nov. 2026), tel que `check_refonte` le juge : sa partie « Ce qui part » et sa partie « Ce qu'il touche », copiées du devis et arrêtées à ce que la tranche livre. Le devis entier, ses chiffres et ses critères restent là-bas ; ici, seulement ce qui se vérifie à la PR.

    node scripts/check_refonte.mjs docs/refonte-v25-a1.md

## Ce que A1 livre

- Un seul chemin de match dans `playGame` : le match en trois périodes (`jouerEnPeriodes`, `jouerPlage`), pour le 82-0, Sur table, l'exhibition, le Rogue et ses duels. Le gros match du 82-0 se regarde en périodes vues, sans choix (JP, 5 nov.) ; une vieille décision `entracte` ne joue rien.
- Le Rogue sort du moteur : `js/greffes.js` importe `js/sim.js`, jamais l'inverse, et s'y branche par `brancherGreffes` (le contrat en tête du fichier : avantMatch, match, apresMatch, xp, matin, decision, coachDeSeries, lecture, aVenir). `check_couches` (neuf) le prouve.
- `VERSION_MOTEUR` S142 ; l'historique des versions va dans `docs/moteur-recalibrer.md`.

## 7. Ce qu'il touche

- Le moteur et ses greffes : `js/sim.js`, `js/greffes.js`, `js/game.js`, `js/impact.js`, `js/recit.js`, `js/util.js`, `js/direct.js`, `js/saison.js`, `js/gerant.js`, `js/banc.js`, `js/bilan.js`, `js/pronostic.js`, `js/profil-style.js`, `js/alignement.js`, `js/packs.js`, `js/rogue-jeu.js`, `js/verdicts.js`, `js/banque.js`, `style.css`, `sw.js`.
- Les règles et les docs : `MOTEUR.md`, `.claude/rules/moteur.md`, `.claude/rules/rogue.md`, `.claude/rules/tests.md`, `docs/moteur-recalibrer.md`, `docs/structure.md`, `docs/structure-detaillee.md`, `LIVRAISON.md`, `docs/decisions.md`, `docs/journal/2026-11.md`.
- Les juges : `scripts/check_couches.mjs` (neuf), `scripts/check_gros.mjs`, `scripts/check_deck.mjs`, `scripts/check_feuilles.mjs`, `scripts/check_duel.mjs`, `scripts/check_instantane.mjs`, `scripts/check_graine.mjs`, `scripts/check_pouvoirs.mjs`, `scripts/check_relais.mjs`, `scripts/check_banc.mjs`, `scripts/check_rogue.mjs`, `scripts/check_choix.mjs`, `scripts/check_chiffres.mjs`, `scripts/empreinte.json`, `scripts/tout.mjs`, `scripts/lib/duel.mjs`, `scripts/lib/rogue_sim.mjs`, `.github/workflows/verifier.yml`.

## 8. Ce qui part

Chaque nom disparaît du jeu (js/, index.html, style.css, sw.js) ; `check_refonte` le vérifie.

- Les chemins de playGame : `jouerSoixanteMinutes`, `jouerDuel`, `apres40De`.
- Le plan adverse, le dépistage et la préparation du gros match du 82-0 : `PLANS_ADV`, `BADGES_DU_PLAN_ADV`, `commentContrer`, `reglageDuPlan`, `planDeSerie`, `depistageDe`, `planDuDepistage`, `PREP_JUSTE`, `PREP_RATEE`, `poserPlanAdverse`, `poserPreparation`, poserCartes (celle de js/sim.js ; l'homonyme de js/repechage.js pose les cartes de joueurs et reste), `effetsDesCartes`, `planAdverseHtml`, `optionDeCarteMatch`, `regleDeCarte`, `motsDeCarteAdverse`, `motsDeCarteMatch`, `formeDeCarte`, `GENRES_CARTE`, `DE_GENRE`, `EN_3E`, `entractesDu`, `incidentDuMatch`, `planDuMatchDeSerie`, `statsEntracte`, `tableEntracte`, `lignesEntracte`, `suiteDuPlan`, `originesDe`, `SENS_DES_CANAUX`, `scripts/mesure_prep.mjs` ; et leurs classes `.plan-adv`, .depistage (la classe ; le genre de page « depistage » du pronostic hors Rogue reste), `.dep-piste`, `.main-adverse`, `.main-adverse-carte`, `.ent2-incident`.
- Le gros match du 82-0 à choix : `js/combat.js`, `CARTES_MATCH`, `CARTES_REGLEMENT`, `QUI_DE_LA_CARTE`, `QUI_COURT`, `mainAdverse`, `energieAdverse`, `FRANCHISE_MATCH`, `mainAdverseHtml`, `depistageHtml`, `pistesDuRapport`, `FRANCHISE_ENTRACTE`, `ENTRACTES`, `INCIDENTS`, `entractesOfferts`, `effetEntracte`, `scripts/check_combat.mjs`.
- L'affichage qui vivait dans le moteur (il bouge vers js/recit.js et js/impact.js ; les noms restent, leur maison change) et les pierres tombales de sim.js : rien à nommer ici, `check_couches` et la lecture de la PR en jugent.

## 8b. Ce qui reste

- `simulerGrosMatch` : un gros match isolé pour la mesure, pas un chemin de `playGame`.
- `hacherMise` et les doubles du hasard : la tranche A2.
- `familleDeMoment`, `effetDeMoment`, `pariDeDecision`, `appliquerGestes`, `AVANT_GROS` : déménagés dans js/greffes.js ; ils partent avec la couche C.
