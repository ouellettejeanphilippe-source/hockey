# V27, tranche 5b — La main du deck et la recrue qui monte

L'extrait de la seconde moitié de la tranche 5 du devis de la V27 (docs/refonte-v27.md, § 4.6, § 8 « La main du deck et la recrue qui monte (tranche 5) », § 8b, § 10 « Les juges qui partent » et « Les tranches »), au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 8 nov. 2026. La tranche 5a (docs/refonte-v27-5a.md) a fait le banc de cinq ; celle-ci fait partir la troisième réserve que le devis fondait dans le banc : la main du deck. Elle part de la branche `claude/v27-5a` et sort vers main avec les tranches 2 à 6.

## 1. Ce que JP a dit

- JP, 7 nov. 2026 (la décision 7 du devis) : *les pouvoirs du coach, les adjoints et la main du deck fondus en 5 cases permanentes pour la run*.
- La question du § 11 fermée par la revue : *la main du deck : la recrue et le rôle partent, l'atelier reste dans la banque ; la boutique vend des pièces*.
- JP, 7 nov. : *il faut vraiment bloquer le snowball* ; *joueur au choix pige dans les joueurs déjà pigés* (la recrue avait déjà été bridée au cartable : elle part).

## 2. Ce que le joueur ressent

« Aux 20e, 40e et 60e matchs, rien ne m'interrompt plus pour trois cartes de plus : ce qui fait grandir mon équipe, c'est mon banc, la boutique et mes packs. » Le jour ordinaire reste un geste ; les retouches d'édition se trouvent encore dans les packs (une carte rare sur quatre, `RARE_DU_PACK`) et se posent au verso d'un joueur.

## 3. Les règles du jeu (ce que la tranche code)

- **La main du deck part** : plus de main de trois cartes aux 20e, 40e et 60e matchs, plus d'arrêt de l'avance pour elle, plus de ligne « La main de la journée » dans la boîte, plus de bouton « La main de la journée t'attend » à la fin de la saison.
- **La recrue part** (« Joueur au choix ») : le Pack Époque fait le joueur au choix (un seul, Pilier ou mieux, de la décennie et du poste de ton choix, tranche 3). Ses deux déblocages de force (`recrue1`, `recrue2`, js/rogue.js) partent avec elle ; une vieille méta qui les avait achetés sera remboursée à la tranche 9, avec les autres déblocages de force.
- **Le nouveau rôle part** (la conversion d'un joueur au palier).
- **L'atelier reste dans la banque** : ses retouches sont déjà des cartes rares des packs (`RARE_DU_PACK`), qui se posent au verso d'un joueur ; seule l'offre de trois retouches au palier part.
- **La vieille partie** : une décision `deck` (une recrue, un rôle, une retouche gardée au palier) se rejoue telle quelle (le moteur lit encore son ballottage, sa mutation, sa retouche gardée) : rien ne plante, et une partie d'avant garde ce qu'elle a pris.

## 4. Les chiffres

Les paliers *PALIERS_CARTES* 20 · 40 · 60 partent ; aucune constante neuve. Mesuré au 6 nov. 2026 (scripts/mesure_deck.mjs, parti) : la recrue valait ≈ 1 V et jusqu'à 3,4 V à la place d'un 9e avant, le rôle ≈ 1 V, la retouche de Cadre ≈ 0,4 V — de la force gratuite, trois fois par saison, que le devis retire au profit du banc et de la boutique.

## 5. Les cas limites

- **La vieille partie** à un palier non pris : il ne s'ouvre plus ; une décision `deck` déjà prise se rejoue — `check_sauvegardes`.
- **Les séries** : la main d'un palier non prise ne s'offre plus à la fin de la saison.
- **Hors ligne** : aucun module ne part ni n'entre — `check_coquille`.

## 6. Ce qu'il touche

`js/sim.js`, `js/saison.js`, `js/banc.js`, `js/rogue.js`, `js/rogue-jeu.js`, `style.css`, `index.html` ; `scripts/check_atelier.mjs`, `scripts/check_calendrier.mjs`, `scripts/check_verite.mjs`, `scripts/check_clarte.mjs`, `scripts/mesure_rythme.mjs`, `scripts/tout.mjs` ; `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`. Le moteur : la main ne se tirait que pour l'écran (`mainDuDeck`, pure) ; aucun dé ne change, `VERSION_MOTEUR` ne bouge pas. Les règles fermes : rogue.md — « la main du deck… vaut le niveau qu'elle affiche » **défaite** (décision 7) ; vocabulaire.md — **la main du deck** part du vocabulaire du Rogue. Les juges `check_deck` et `mesure_deck` partent (§ 10 du devis : *ce qu'ils prouvaient de l'atelier reste à `check_atelier`*).

## 7. Ce qui part

Pris du § 8 du devis, « La main du deck et la recrue qui monte (tranche 5) », et ce que la main faisait vivre autour d'elle dans l'écran de saison. Il n'y a rien à réécrire à sa place : le banc de cinq (5a), la boutique à ses nœuds et le Pack Époque font déjà ce qu'elle faisait ; c'est une refonte par retrait, que le devis range dans la tranche 5.

- `mainDuDeck`, `PALIERS_CARTES`, `SORTES_DECK`, `NIVEAU_SORTE` → rien : la main du deck part ; le banc, la boutique et le Pack Époque la remplacent.
- `cranDeLaRecrue`, `niveauxDeLaRecrue`, `NIVEAUX_RECRUE`, `candidatsRecrue`, `niveauxRecrue`, `MOTS_RECRUE` → rien : plus de « Joueur au choix ».
- `editionsDuJour`, `rolesOfferts` → rien : l'offre de trois retouches et la conversion d'un joueur au palier partent ; l'atelier reste dans la banque (*RARE_DU_PACK*).
- `ouvrirMain`, `suiteDeLaMain`, `deciderDeck`, `palierOuvert`, `paliersVus`, `palProposes`, `paliersPris`, `hub-main-ouvrir`, `hub-dos-rang`, `hub-dos` → rien : l'écran de la main, ses arrêts et sa ligne de la boîte.
- Les deux déblocages de force de la recrue, `recrue1` et `recrue2` (le § 8 du devis les range à la tranche 9 ; ils ne servent plus à rien sans elle) → remboursés à la tranche 9.
- Dans les juges (hors du jeu, en italique) : *check_deck* et *mesure_deck* partent ; *check_atelier* perd ses deux épreuves de l'offre du palier et reçoit ce que *check_deck* prouvait hors de la main (la retouche gardée et ses cases au verso, tes cartes sans limite, les doublons, les missions du cartable) ; le smoke perd sa main du palier.

**Ce qui reste, et pourquoi** : *MUTATIONS* et les retouches d'édition (la banque, *RARE_DU_PACK*, posées au verso) ; le ballottage (*candidatsBallottage*) ; une décision *deck* d'une vieille partie, que le moteur rejoue (son ballottage, sa mutation, sa retouche gardée) ; le Pack Époque (le joueur au choix de la V27) ; les cartes de jeu et de joueurs, telles quelles (JP).

## 8. Les réglages

Aucun : la tranche retire.

## 9. Les critères d'acceptation

- [x] Plus de main aux 20e, 40e et 60e matchs ; l'avance ne s'y arrête plus — `essai_rogue`.
- [x] La vieille partie avec une décision `deck` se rejoue — `check_sauvegardes`.
- [x] L'atelier reste dans la banque — `check_atelier`.
- [x] Rien de mort — `check_mort` ; la page des règles ne dit plus la main — `check_clarte`, `check_verite`.
- [x] Pas une couche de peinture — `check_refonte docs/refonte-v27-5b.md` (`BASE=origin/claude/v27-5a`).

## Les écarts avec le devis et la maquette

1. **Les déblocages `recrue1` et `recrue2`** partent ici (le devis les range à la tranche 9) : sans la recrue, ils ne feraient rien, et une commande visible doit fonctionner ; leur remboursement en 🏅 attend la tranche 9.
2. **L'atelier** ne s'offre plus au palier : ses retouches restent des cartes rares des packs.

## Les tranches

La tranche 5b est une PR vers `claude/v27-run`, après la 5a. La 6 (le duel à un choix) suit.
