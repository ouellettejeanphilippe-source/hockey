# V27, tranche 2 — Une saison, quatre actes, deux cœurs

L'extrait de la tranche 2 du devis de la V27 (docs/refonte-v27.md, « Les tranches »), au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 8 nov. 2026. Le devis entier prime : cet extrait dit seulement ce que la tranche 2 livre, ce qu'elle fait partir et comment on le prouve. Elle se construit sur la branche `claude/v27-run`, avec les tranches 3 à 6, et sort vers main avec elles.

## 1. Ce que JP a dit

- JP, 7 nov. 2026 : *première Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball* ; *Passer à 2 ❤️* ; le mot à l'écran est *rival*.
- Sur les maquettes (docs/maquettes/v27.html, 7 nov.) : *Maquettes ok* ; *montrer, pas dire* ; *garder une partie du coloré et broadcast actuel* ; *faut des logos, et garder anciens looks des cartes*.
- Après la première mesure du robot de la tranche 1 (8 nov.) : JP a choisi **« Élite = risque plus clair »** — *aucune élite à l'acte I*, et l'écran d'une élite montre ta vraie chance de gagner (le pronostic). Les élites elles-mêmes sont la tranche 7 ; ici, la règle entre au devis (§ 4.5, § 9) et dans le robot (`scripts/lib/rogue_actes.mjs`).

## 2. Ce que le joueur ressent

« J'ai une saison pour gagner la Coupe ; je vois l'acte où je suis, mon rang contre la cible, mes deux cœurs ; au premier soir de l'acte, le rival qui m'attend au bout. » Le pic : le soir du rival, « La run continue » (ou la porte qui claque). Le jour ordinaire ne change pas : Jour suivant, en un geste.

## 3. Les règles du jeu (ce que la tranche code ; le devis, § 4.1 à 4.3)

- **La run est une saison.** Plus de deuxième saison : la Coupe gagne la run, et la run finit à 0 ❤️, à l'acte III raté ou à une série perdue. Ni mandat, ni marche de la ligue, ni gardés, ni loto du cartable entre deux saisons.
- **Les actes** : tes matchs 1 à 27, 28 à 54, 55 à 82, puis les séries (*ACTES*, js/actes.js).
- **Les rivaux** : le dernier match de chaque acte, contre le 8e, le 4e puis le plus fort club en force (attaque + défense + gardien au premier soir, *RANGS_DES_RIVAUX*, ramené à la taille de la ligue). Il est posé là à la création de la ligue par l'échange de cédule du robot (*echanger*, puis *amener*, puis un club d'un rang voisin), qui garde à chaque club ses 82 matchs, un par jour : *poserLesRivaux* (js/actes.js), que le jeu et le robot appellent tous deux par le crochet *placer* de *creerLigue*. Le rival est annoncé **au premier soir de son acte, un par acte** : une ligne de la boîte qui bloque « Jour suivant » ouvre son écran (sa plaque, son rang en force, son jeu en un mot : des tireurs, des durs ou un gros gardien, lu dans sa force) ; les autres soirs, un jeton sous l'affiche (« Rival · dans 9 matchs »). Il est un duel, le seul gros match de l'acte.
- **Rival battu** : l'élan (3 matchs), 15 🏅, et « une pièce » ; tant que le banc de cinq n'existe pas (tranche 5), la pièce est **le niveau suivant du coach**, exactement ce que le robot joue. **Rival perdu** : les sonnés, rien d'autre. Un rival ne paie aucun jeton.
- **Les cœurs** : 2 ❤️ (*COEURS*), jamais regagnés. À la fin des actes I et II, le rang au classement du soir du rival, avec les bris d'égalité de l'écran Classement (*rangAuSoir*), doit tenir 20e puis 12e (*CONTROLES*, `arrondi(C × n / 32)` dans une ligue de `n` clubs : *controleDeLActe*) ; sinon −1 ❤️. À 0 ❤️, la run finit ce soir-là. L'acte III demande une place en séries.
- **Les séries plus dures** : chaque club qualifié monte de *ETAPE_SERIES* (3) étapes d'édition au premier match des séries.
- **Le départ** : les bouche-trous du départ pigés du 35e au 55e centile de leur saison (*BANDE_DEPART*, dans `bouchesTrousDuDepart` de js/rogue.js ; le robot réimporte la règle au lieu de la copier).
- **Les exigences qui lisaient le mandat et les gardés** prennent les leviers neufs (devis § 4.9) : « Le proprio impatient » serre les contrôles (18 · 10), « Ceux qui partent » monte les rivaux (le 6e, le 2e, le plus fort), « La ceinture serrée » ajoute une étape aux séries.
- **Les écrans, reproduits des maquettes** : la plaque de Ce soir (« Acte II », « 14e / 12 », les cœurs dessinés avec « 1 cœur sur 2 » pour le lecteur d'écran) et la piste de la saison sous elle (le match où tu es, les fins d'acte, le rival de l'acte en écusson, la Coupe) ; le rival annoncé (maquette 2) ; le soir de fin d'acte (maquette 6 : « La run continue », le contrôle, les cœurs, les médailles, puis les étapes, chacune une ligne de la boîte, rien ne s'ouvre seul) ; l'écran de fin (maquette 8 : la cause en une ligne, les actes et les rivaux, les médailles, « Une run neuve »).
- **La vieille sauvegarde** : une run d'avant (sans *acte*) ne se rejoue pas : au démarrage, ses 🏅 de saison (la moitié de ses points) sont versées, la run est retirée, et un mot le dit ; la run neuve commence au menu.

## 4. Les chiffres

*ACTES* 27 · 54 · 82 ; *RANGS_DES_RIVAUX* 7 · 3 · 0 (de 0, parmi les 31 adversaires ; `arrondi(r × (n − 1) / 31)`) ; *CONTROLES* 20 · 12 (`arrondi(C × n / 32)`) ; *COEURS* 2 ; *ETAPE_SERIES* 3 ; *BANDE_DEPART* 0,35 · 0,55 ; les médailles d'un acte : 10 l'acte passé, 15 le rival battu (§ 4.8 du devis). Exemple fait : dans une ligue de 32, le rival de l'acte II est le 4e en force (`arrondi(3 × 31 / 31)` = 3, de 0) ; finir l'acte II 13e avec 2 ❤️ laisse 1 ❤️.

## 5. Les cas limites

Le rival que l'échange ne peut pas amener : un club d'un rang voisin (le robot, *amener*) ; une run morte à l'acte II : la boîte ne propose plus que la fin, « Jour suivant » reste bloqué ; une vieille partie : versée et retirée au démarrage (*convertirAuJeuNeuf*) ; une ligue qui se rebâtit (une reprise) : *poserLesRivaux* est pur, la même cédule revient ; les séries rechargées : l'étape des séries se pose une fois par club (*habillerLaLigue* est idempotent à étape égale).

## 6. Ce qu'il touche

`js/actes.js` (neuf), `js/rogue.js`, `js/rogue-jeu.js`, `js/saison.js`, `js/sim.js`, `js/banc.js`, `js/game.js`, `js/scenes.js`, `js/faits.js`, `js/gerant.js`, `sw.js`, `style.css`, `scripts/lib/rogue_actes.mjs`, `scripts/lib/rogue_sim.mjs`, `scripts/check_rogue.mjs`, `docs/refonte-v27.md`, `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/interface.md`. Les clés de sauvegarde ne bougent pas ; `G.rogue` gagne *acte*, *coeurs* et *actes* (`check_sauvegardes`).

## 7. Ce qui part

Pris du § 8 du devis, « La run sur plusieurs saisons (tranche 2) » et « Les gros matchs choisis et les rivaux du proprio (tranches 2 et 6) ». Le neuf s'écrit depuis le § 4 du devis et le robot de la tranche 1 ; c'est une refonte.

- `ETAPE_APRES_LA_PREMIERE`, `etapeDeLaRun` → *ETAPE_SERIES* (la marche de la deuxième saison part avec la deuxième saison).
- `MANDATS`, `mandatDe`, `MANDAT_DE_LA_PREMIERE`, `rangDuMandat`, `mandatRempli` → *COEURS*, *CONTROLES*, *controleDeLActe*.
- `LOTOS_DE_SAISON`, `lotosDeSaison`, `GARDES_DE_SAISON`, `gardesDeLaRun` → rien : il n'y a plus d'entre-deux-saisons ; avec eux `choisirGardesDeSaison`, `lotoDuCartable`, `choisirNouvelleEquipe`, `continuerRun` (js/rogue-jeu.js) et le bouton `rg-suivante`.
- `RIVAUX`, `RIVAUX_OFFERTS`, `rivauxOfferts`, `rivalChoisi`, `BUTIN_RIVAL`, `MINI_BOSS`, `annoncerGros`, `grosMatchAvant`, `ESPACEMENT_GROS` → *poserLesRivaux*, *RANGS_DES_RIVAUX*, *RAISONS_DU_DUEL* (js/actes.js) ; avec eux l'offre du premier lundi (`rivalOuvert`, `sceneDesRivaux`) et le bloc des rivaux au Proprio (`pr-rivaux`).
- `BUTIN_DU_GROS` → la pièce du rival battu (le niveau suivant du coach jusqu'à la tranche 5) ; aucun jeton.
- `sceneDuMandat` (js/scenes.js) → l'écran de fin, sa cause en une ligne.

**Ce qui reste, et pourquoi** : le moteur et le duel en trois périodes (*jouerEnPeriodes*, *ELAN*, *SONNE*, la mise doublée jusqu'à la tranche 6) ; *bouchesTrousDuDepart* (sa bande change, pas sa règle) ; *habillerLaLigue* (le renfort et les séries le lisent) ; la bête noire (*beteNoire*, un moment de carte) ; la boutique telle quelle (tranche 3) ; le plan du soir, les adjoints et la main du deck (tranches 5 et 6) ; *numeroDeSaison* (toujours 1, lu par vingt écrans ; il part avec la Dynastie, tranche 11). Les cartes de jeu et les cartes de joueurs, telles quelles (JP).

## 8. Les réglages

Ceux du devis, § 9 ; la tranche n'en ajoute aucun. Le réglage de JP après la première mesure : *ELITES_PAR_ACTE* 0 à l'acte I, 1 aux actes II et III.

## 9. Les critères d'acceptation

- [ ] La run en actes : un rival par acte au bon rang de force, jamais manquant, 82 matchs à chaque club et un par jour ; le rang du contrôle égal à celui du Classement ; un cœur perdu par contrôle raté — `check_rogue` (réécrit : ses blocs « deuxième saison », « mandat » et « gardés » partent).
- [ ] Les gros matchs : au 82-0, plus de gros match de saison ; en Rogue, seuls les rivaux sont des duels — `check_gros`.
- [ ] Le jour à jour du Rogue tient — `essai_rogue`.
- [ ] Rien de mort — `check_mort` ; la coquille — `check_coquille`.
- [ ] Pas une couche de peinture — `check_refonte docs/refonte-v27-2.md`.
- [ ] À juger par JP à l'essai : la plaque se lit d'un coup d'œil ; le rival annoncé donne envie de bâtir vers lui ; perdre un cœur fait mal sans finir la soirée.

## Les tranches

La tranche 2 est une PR vers `claude/v27-run`. La 3 (la boutique à ses nœuds), la 4 (le calendrier placé), la 5 (le banc de cinq) et la 6 (le duel à un choix) suivent sur la même branche.
