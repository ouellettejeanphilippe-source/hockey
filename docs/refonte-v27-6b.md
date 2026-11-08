# V27, tranche 6b — Le plan du soir part

L'extrait de la seconde moitié de la tranche 6 du devis de la V27 (docs/refonte-v27.md, § 4.6, § 4.7, § 8 « Le plan du soir et les micro-plans du duel (tranche 6) », § 10 « Les juges qui partent » et « Les tranches »), au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 8 nov. 2026. La 6a (docs/refonte-v27-6a.md) a fait le duel à un choix ; celle-ci fait partir le plan du soir des matchs ordinaires, la dernière réserve que le devis fondait dans le banc. Elle part de la branche `claude/v27-6a` et sort vers main avec les tranches 2 à 6.

## 1. Ce que JP a dit

- JP, 7 nov. 2026 (la décision 9 du devis) : *le plan du soir disparaît, fondu dans le banc.*
- Le constat de départ (§ 1 du devis) : *le plan du soir est dominé : une option le vaut presque toujours.*

## 2. Ce que le joueur ressent

« Un soir ordinaire, je n'ai rien à régler : mon banc joue ses pièces, je touche Jour suivant. » Tirer, fermer, coller, forechecker, rester discipliné sont des pièces de banc depuis la 5a (le canonnier, le mur, le cogneur, le moine, le vedettiste) ; ils ne reviennent comme plan qu'au duel, un seul choix avant le match.

## 3. Les règles du jeu (ce que la tranche code)

- **Plus de plan un soir ordinaire** : le moteur ne pose plus de plan sur un match qui n'est pas un duel ; la languette « Ton banc » de Ce soir perd son bouton « Plan · … » et la feuille des six plans ; toucher le banc ouvre le Coach.
- **Les plans ne vivent qu'au duel** (*PLANS*, *plansDuDuel*, la 6a).
- **La vieille partie** : une décision `plan` (le plan du soir) se relit et ne joue rien ; la saison se rejoue sans elle, au but près (`check_graine`).
- **Les robots** ne posent plus de plan du soir : ils jouent leur banc, comme le joueur.

## 4. Les chiffres

Aucun réglage neuf : la tranche retire. Mesuré au V17 (scripts/check_plan_de_match.mjs, parti) : un plan valait au plus ±1 V sur une saison, et le constat du devis le disait dominé.

## 5. Les cas limites

- **La vieille partie** à un soir dont le plan était posé : le plan ne joue plus ; la saison rejouée de la graine change à partir de ce soir-là (comme toute décision qui part), sans planter — `check_graine`, `check_sauvegardes`.
- **Hors ligne** : aucun module n'entre ni ne part — `check_coquille`.

## 6. Ce qu'il touche

`js/greffes.js`, `js/sim.js`, `js/impact.js`, `js/saison.js`, `js/banc.js`, `js/pieces.js`, `index.html`, `style.css` ; `scripts/lib/rogue_sim.mjs`, `scripts/lib/rogue_actes.mjs`, `scripts/check_duel.mjs` (« Ton match ne change rien » et « un plan ne laisse rien derrière lui », repris), `scripts/check_graine.mjs`, `scripts/check_jambes.mjs`, `scripts/check_chiffres.mjs`, `scripts/essai_rogue.mjs` ; `.claude/rules/rogue.md`, `.claude/rules/interface.md`. Le moteur : les greffes ne posent plus de plan avant un match ordinaire (le contrat garde ses huit fonctions) ; le 82-0 ne pose rien et se rejoue au caractère près (`check_empreinte`). Les règles fermes : rogue.md gagne « le plan du soir est parti » ; interface.md, la languette du banc perd le plan. Les juges : *check_plan_de_match* part (devis § 10 : *le plan du soir part ; « Ton match ne change rien » passe à check_duel*).

## 7. Ce qui part

Pris du § 8 du devis, « Le plan du soir et les micro-plans du duel (tranche 6) » pour le plan du soir (les micro-plans du duel sont partis à la 6a), et ce qu'il faisait vivre autour de lui. Rien n'est réécrit à sa place : les pièces de banc (5a) et le plan du duel (6a) font ce qu'il faisait ; c'est une refonte par retrait, que le devis range à la tranche 6.

- `poserLesPlans`, `planDe`, `_planMatch` (js/greffes.js, js/sim.js : le plan d'un club posé sur un match ordinaire) → rien : un soir ordinaire n'a plus de plan.
- `ouvrirPlan`, `planEnForce`, `banc-plan` (js/saison.js, style.css : la feuille des six plans et son bouton dans la languette du banc) → rien : la languette dit ce qui joue ce soir, le banc ouvre le Coach.
- `planEnChiffres` (js/impact.js : un plan d'un soir en vraies stats) → *plansDuDuel* (au duel seulement).
- Dans les juges (hors du jeu, en italique) : *check_plan_de_match* part, ses deux épreuves de forme passent à *check_duel* ; le robot perd *planDuRobot* ; *check_graine* relit un plan du soir d'une vieille sauvegarde, qui ne joue plus ; *check_jambes* mesure avec une pièce (le canonnier) au lieu du plan « tirer » ; *essai_rogue* vérifie que le Bureau n'a plus de plan.

**Ce qui reste, et pourquoi** : *PLANS*, *planLu*, *effetsDuPlan*, *cibleDuPlan*, la lecture d'un plan (*lecture*, *lectureDuMatch* et son option *plan*) — le duel à un choix les lit (la 6a) ; une vieille décision *plan* dans une sauvegarde (elle ne joue rien) ; les pièces qui portaient les idées du plan (*PIECES*) ; les cartes de jeu et de joueurs, telles quelles (JP).

## 8. Les réglages

Aucun : la tranche retire.

## 9. Les critères d'acceptation

- [x] Un soir ordinaire n'a plus de plan, Ce soir n'en montre plus — `essai_rogue` (`CAPTURES_PAGES=1`).
- [x] Une vieille décision `plan` ne joue rien — `check_graine`.
- [x] Ton match ne change rien, un plan ne laisse rien derrière lui — `check_duel`.
- [x] Rien de mort — `check_mort` ; la page des règles dit les plans du duel — `check_clarte`.
- [ ] Les jambes — `check_jambes` : ses quatre épreuves rouges l'étaient déjà sur la branche avant la 6 (le roulement poussé, la mesure qui ne touche à rien) ; à reprendre à part.
- [x] Pas une couche de peinture — `check_refonte docs/refonte-v27-6b.md` (`BASE=origin/claude/v27-6a`).

## Les écarts avec le devis et la maquette

1. **La tranche 6 est coupée en deux PR** : la 6a (le duel) et la 6b (le plan du soir).
2. **`check_jambes`** n'est pas vert : ses quatre épreuves rouges l'étaient avant la tranche 6 ; la 6b remplace seulement le plan « tirer » par une pièce dans sa mesure, comme le devis le demande.

## Les tranches

La tranche 6b est une PR vers `claude/v27-run`, après la 6a. La branche sort vers main quand `profondeur.yml` est vert (R1).
