# V27, tranche 6a — Le duel à un choix

L'extrait de la tranche 6 du devis de la V27 (docs/refonte-v27.md, § 4.3, § 4.7, § 5, § 6, § 8 « Le plan du soir et les micro-plans du duel » et « La mise doublée », § 8b, § 9, § 10 et « Les tranches »), au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 8 nov. 2026. Le devis entier prime : cet extrait dit seulement ce que la tranche livre, ce qu'elle fait partir et comment on le prouve. **La tranche 6 est coupée en deux PR** : la 6a, ici, est le duel à un choix (le rival qui montre son jeu, le choix d'avant-match, l'entracte à un bouton, la mise doublée qui part) ; la 6b (docs/refonte-v27-6b.md) fait partir le plan du soir des matchs ordinaires. Elle part de la branche `claude/v27-run`, après les tranches 2 à 5b, et sort vers main avec elles.

## 1. Ce que JP a dit

- JP, 7 nov. 2026 (la décision 9 du devis) : *le duel : un seul choix lourd ; les micro-plans de période partent.*
- Après la revue (décision 3) : *un seul choix avant le match, mais le rival montre son jeu dès son annonce* (son intention dominante et son style : tireurs, durs, gros gardien), *et des pièces y répondent. Aucune décision d'entracte.*
- Sur la mise doublée (décision 8) : *ça sert à rien* — elle part au complet ; un rival perdu laisse ses sonnés, sans doublement.
- Sur les maquettes (docs/maquettes/v27.html, 7 nov.) : *Maquettes ok* ; *montrer, pas dire* ; *garder une partie du coloré et broadcast actuel*. La maquette 2 montre le rival annoncé (son rang en force, « Son jeu : des tireurs », son intention, la fiche rang contre rang), la maquette 4 le duel (« Ton plan · 1 choix », trois cartes, « Ton match · aucun plan », Gagné / Perdu, « Au match »).

## 2. Ce que le joueur ressent

« Le rival m'a dit comment il joue dès le premier soir de l'acte ; le soir venu, je choisis une fois le plan que mon banc propose contre son jeu, et je vis le match. » Le pic : la carte de plan qui répond à ce qu'il a montré, et l'entracte où il annonce encore son intention dominante. Le soir ordinaire ne change pas (la 6b fera partir son plan) ; le duel passe d'une dizaine de touchers à trois (une carte, « Au match », la période suivante).

## 3. Les règles du jeu (ce que la tranche code ; le devis, § 4.3 et § 4.7)

- **Le rival montre son vrai jeu dès son annonce** (*poserLesRivaux*, js/actes.js) : son style est lu dans ses vraies stats, sur les joueurs qu'il habille, rang contre rang avec ton club dans la ligue (*jeuDuRival*, réécrit) — ses **tirs** par match, ses **durs** (ses mises en échec et ses punitions par match ; une ligue sans mises en échec comptées, d'avant 2005-06, se lit sur les punitions), son **gardien** (le % d'arrêts du partant). Son style, en un mot, est sa ligne au meilleur rang : des tireurs, des durs, un gros gardien. Son **intention dominante** (*dominanteDe*) est fixée à l'annonce de son style et de la graine : des tireurs foncent (🐗 l'assaut) ou collent ta vedette (🥷 l'ombre) ; des durs chassent (🦈) ou te poussent au cachot (🦂) ; un gros gardien ferme le centre (⛔) ou colle ta vedette. Elle est posée sur l'annonce du duel (*grosAnnonces*, `dominante`), que le moteur lit.
- **L'annonce** (la maquette 2) : la ligne « Le rival de l'acte » de la boîte ouvre sa plaque, son rang en force, la bande « Son jeu : des tireurs | 🐗 L'assaut », puis ses trois lignes contre les tiennes (ton rang, ta barre, le nom, sa barre, son rang ; son meilleur en or). **À l'affiche**, le soir du rival, la languette « ⚔ Le rival » porte la même bande (« Des tireurs · 🐗 L'assaut »).
- **Le moteur** : leur intention dominante a *POIDS_DOMINANTE* (1,5) d'attrait de plus à chaque période (*intentionDuDuel*) ; elle sort plus souvent que chacune des quatre autres (≈ 60 à 70 % des périodes). Le duel garde ses trois périodes vues et leurs intentions lues sur ce qui est déjà joué.
- **Un seul choix, avant le match** (la maquette 4, *ouvrirLeDuel*, js/gerant.js) : la languette (« Le rival · Match 54 »), les deux plaques aux couleurs des clubs (la tienne : ton rang et tes cœurs dessinés ; la leur : leur style), « VS », la barre de ta chance (le pronostic du jour, *pronostic*), leur jeu (« Leur jeu : des tireurs | 🐗 L'assaut »), puis « Ton plan · 1 choix » et **deux ou trois plans de ton banc** (*plansDuDuel*, js/impact.js) en vraies cartes de jeu, chacune son gain et son prix du match dessous (« +2,4 tirs », « −0,8 pt de précision ») ; « Ton match · aucun plan » ; Gagné / Perdu (le tableau du § 4.7) ; « Au match ». Rien n'est choisi d'avance ; toucher une carte la choisit, la toucher encore la laisse ; sans carte, c'est Ton match. Le choix est la décision du soir (`main`, avec `duel.plan`) ; le direct part aussitôt.
- **D'où viennent les plans** (*plansDuDuel*) : chaque pièce posée qui a un plan propose le sien (*PLAN_DE_LA_PIECE* : le canonnier tire, le mur ferme, le cogneur forechecke, le moine et l'arbitre restent disciplinés, le vedettiste et la lunette collent leur vedette), ton coach celui de sa philosophie (*PLAN_DU_COACH*) à sa maîtrise ; deux voix pour un même plan, la plus forte parle. Moins de deux : ton coach complète par les plans qui répondent à leur jeu, puis fermer le centre, rester discipliné. Trois au plus. Chacun est chiffré contre leur jeu (*leurJeuDuDuel*, js/greffes.js : leur dominante ; sans elle, leur intention de la 1re), sur le match, les mêmes dés.
- **Le plan qui répond** (*repond*, dans *PLANS* ; *forceContre*, js/greffes.js ; devis § 4.3 : *des pièces y répondent*) : 🌧 tirer répond à 🥷, 🥷 coller à 🐗, ⛔ fermer à 🐗 et 🦈, 🐗 forechecker à ⛔, 🧘 rester discipliné à 🦂 et 🦈. Un plan qui répond à leur intention ramène, la période où elle joue, ce qu'elle te fait et ce qu'elle leur donne à la force d'un soir ordinaire (1 au lieu de *FORCE_DUEL*, 2) ; ce qu'elle leur coûte ne bouge pas. C'est ce qui fait du plan un vrai choix contre le jeu montré (§ 4).
- **Le plan joue les trois périodes** (*match*, js/greffes.js) : posé à la force du duel et de qui le propose. Plus rien ne se décide entre les périodes.
- **L'entracte** (*diffuserMatch*, js/direct.js, `pauses`) : le direct s'arrête à la fin de la 1re et de la 2e : le pointage et les tirs, leur intention de la période qui vient (« ⚔ 2e période · 🐗 L'assaut — ton plan : 🌧 Tirer de partout »), les onglets du match, et **un seul bouton** (« 2e période › »). Le gros match du 82-0 garde son « Passer à la fin » à la pause.
- **En séries** : chaque match de ta série a le même écran (la languette de la ronde, « Série 2-1 » sur ta plaque, leur jeu, les plans), sans pronostic ; « ⚔ Ton plan · match N » l'ouvre ; « Ton match, toute la série » joue la série sans écran (une décision `auto`, comme avant), « Reprendre la série » la rend. L'éclaireur de la série dit leur jeu et leur coach.
- **Ce que le duel rapporte et coûte** (§ 4.7, sans mise) : le rival — gagné, une pièce parmi trois, la lancée trois matchs, 15 🏅 ; perdu, aucun cœur, les sonnés trois matchs. L'élite — gagnée, une pièce et ses jetons ; perdue, −1 ❤️ et les sonnés (son écran vient à la tranche 7). Un match de séries — l'élan ou les sonnés.
- **Les robots** (scripts/lib/duel.mjs, la saison en actes de scripts/lib/rogue_actes.mjs et la vieille saison de scripts/lib/rogue_sim.mjs) font le même choix que le joueur, par les mêmes fonctions : avant la 1re période, *leurJeuDuDuel* puis *plansDuDuel* ; l'attentif prend le plan qui rend le plus (Ton match si aucun ne rend), le distrait un au hasard.

## 4. Les chiffres

*POIDS_DOMINANTE* 1,5 (l'attrait de plus de leur dominante ; les autres intentions partent de 1 à 1,9, plus ce qui se lit). *FORCE_DUEL* 2 (inchangé). Un plan qui répond : ce qu'elle te fait à la force 1. *PLANS.tirer* passe de tirs ×1,15 à ×1,11 (le reste tel quel) : sur un match entier à la force du duel, il dominait les quatre autres plans contre toutes les intentions. Mesuré ici (check_duel, N = 200 et 1200, le club témoin MTL 76-77 en double) : leur dominante sort 59 à 72 % des périodes ; sur les dix trios de plans que le banc peut proposer, aucun n'a un plan meilleur ou égal aux deux autres contre les cinq intentions ; le meilleur plan contre Ton match, en face à face, 0,58 (sous 0,60). Exemple fait (la sonde de la tranche, buts nets par match, MTL 76-77) : contre 🦈, 🧘 rend +0,52 et 🌧 +0,25 ; contre ⛔, 🐗 rend +0,24 et 🌧 +0,16 ; contre 🦂, 🧘 +0,40 et 🌧 +0,24.

## 5. Les cas limites

- **La vieille partie** (devis § 6) : une décision d'entracte (`duel.p` 1 ou 2, avec ou sans `snap`, la mise) ne joue rien et ne tire aucun dé ; la saison se rejoue sans planter, au but près comme sans elle (`check_gros`) ; une décision neuve l'efface (js/banc.js). Une vieille feuille sans `dominante` se lit sans elle. Les clés de sauvegarde ne bougent pas (`check_sauvegardes`).
- **Un match de séries** : pas de dominante ; leur jeu est leur intention de la 1re, lue comme le moteur la lira.
- **Un banc sans pièce à plan** : le coach propose le sien et complète par ce qui répond à leur jeu (deux plans au moins).
- **Le choix pris après coup** (un soir déjà joué) : le moteur rembobine au matin du duel et rejoue ce soir-là seul (`check_instantane`).
- **Hors ligne** : aucun module n'entre ni ne part — `check_coquille`.
- **Le clavier et la manette** : chaque carte de plan est un bouton (Entrée, espace), « Ton match » et « Au match » aussi ; le focus va à la première carte — `essai_rogue`.

## 6. Ce qu'il touche

`js/actes.js`, `js/greffes.js`, `js/sim.js`, `js/impact.js`, `js/gerant.js`, `js/saison.js`, `js/direct.js`, `js/scenes.js`, `js/banc.js`, `js/banc-du-soir.js`, `js/profil-style.js`, `index.html`, `style.css` ; `scripts/lib/duel.mjs`, `scripts/lib/rogue_sim.mjs`, `scripts/lib/rogue_actes.mjs`, `scripts/check_duel.mjs` (réécrit), `scripts/check_gros.mjs`, `scripts/check_instantane.mjs`, `scripts/check_banc.mjs`, `scripts/check_clarte.mjs`, `scripts/essai_rogue.mjs`, `scripts/essai_packs.mjs`, `scripts/smoke.mjs` ; `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/tests.md`. Le moteur : le gros match porte `choix` (le plan d'avant-match) et `dominante` au lieu de `periodes` ; la feuille du duel garde ses trois périodes (leur intention, ton plan, le pointage) et la dominante, plus la mise ; le 82-0 ne pose rien et se rejoue au caractère près (`check_empreinte`). Les règles fermes : rogue.md — « au duel, ton banc propose avant chaque période » et « le duel bien joué… la meilleure proposition à chaque période » **défaites** (décision 9 et décision 3 d'après la revue), réécrites : un seul choix avant le match, le plan qui répond, aucun trio dominé ; vocabulaire.md — **la mise doublée** sort, **intention dominante**, **plan qui répond** et **Ton match, toute la série** entrent ; « ton adjoint » n'est plus la voix du duel. La décision : docs/decisions.md, « Le duel à un choix ».

## 7. Ce qui part

Pris du § 8 du devis, « Le plan du soir et les micro-plans du duel (tranche 6) » pour les micro-plans du duel (le plan du soir est la 6b) et « La mise doublée (tranche 6) », et ce que le duel par période faisait vivre autour d'eux : les entractes à choix, la scène de ton adjoint, son écran de combat. Le neuf (l'écran du choix, *plansDuDuel*, le jeu du rival lu dans ses vraies stats, l'entracte à un bouton) s'écrit depuis le § 4.7 et les maquettes 2 et 4, sans relire l'écran de combat ligne par ligne : un écran, un choix, une décision, là où il y avait trois écrans par duel, trois décisions et une mise. C'est une refonte.

- `MISE_DOUBLEE` (js/sim.js), `sceneDeLaMise` (js/scenes.js, sa scène et ses mots), `duel-mise` et `duel-snap` (le bloc et le bouton « Doubler la mise ») → rien : un rival perdu laisse ses sonnés (*SONNE*), sans doublement. Le champ *snap* du gros match et la clé *mise* des mots de scène sont partis avec eux (vérifiés à la main : ils ne restent que dans des commentaires et dans *physique.js*, le tir instantané de Sur glace).
- `propositionsDuDuel`, `voixDuBanc`, `IDEES_DE_LADJOINT`, `IDEES_MAX`, `JAMBES_LOURDES` → *plansDuDuel* (un seul choix, avant le match, contre leur jeu).
- `periodesDuDuel`, `_duelSerie`, `_mainSerie`, `mainDuJour`, `duelDuJour` (js/sim.js : les décisions des trois périodes) → *choixDuDuel*, *choix* sur le gros match, *_choixSerie* en séries.
- `apercuDuDuel` → *leurJeuDuDuel* (leur dominante, sinon leur 1re).
- `ouvrirDuel`, `specDuDuel`, `duelDeLAdjoint`, `sceneDeLAdjoint`, `intentionEnChiffres`, `duelAvantHtml`, `statsAvantGros`, `scoreDuDuel` (l'écran de combat, la scène de ton adjoint, leurs puces de période, le tableau des deux clubs) → *ouvrirLeDuel* (la maquette 4), *leDuel*, *jeuDuDuel*, *leurJeuHtml*, *enjeuDuDuel*.
- `ouvrirPeriodeDuDuel`, `ouvrirEntracte`, `entracteAttendu`, `periodeAttendue`, `decisionDuDuel`, `entracteDemande`, `duelDuSoir`, `suiteEntracte`, `instantMot` (l'entracte à choix de la saison) → l'entracte du direct (*pauses*), *suiteDuDuel*.
- `ouvrirPeriodeSerie`, `ouvrirEntracteSerie`, `entracteSerieAttendu`, `periodeSerieAttendue`, `decisionSerieDuDuel`, `suiteEntracteSerie`, `leurCoachAJoue`, `resultatPrecedent`, `saisonFeuilles`, `hub-main-serie`, `main-adjoint`, `main-chiffres` (l'entracte à choix des séries, son récit, « Ton adjoint · match N », « L'adjoint joue cette série ») → le même écran du choix, *hub-duel-serie* (« ⚔ Ton plan · match N »), *dl-auto* (« Ton match, toute la série ») ; leur coach passe à l'éclaireur.
- `periodeDuDuel` (js/banc.js : le voile « La deuxième période commence… ») → rien : aucune décision d'entracte.
- `onArret`, `live-entracte` (js/direct.js : l'arrêt au vestiaire et la reprise à 40:00, son bouton « Au vestiaire — ton choix ») → les pauses de période, un seul bouton.
- `STYLES_DU_RIVAL` (le style lu dans la force, *teamStrength*) → *LIGNES_DU_JEU* (ses vraies stats).
- Les classes de l'écran de combat et de l'entracte : `ent2`, `ent2-score`, `ent2-eq`, `ent2-note`, `ent2-periodes`, `a-jouer`, `ent2-buts`, `ent2-but`, `ent2-stats`, `duel-tete`, `duel-adjoint`, `duel-intention`, `duel-fait`, `duel-pourquoi`, `duel-unite`, `duel-props`, `duel-prop`, `main-sheet`, `main-etape`, `main-stats`, `main-enjeu`, `main-outils`, `boss-lueur` → *dl-sheet* et ses parties (la maquette 4).
- Dans les juges (hors du jeu, en italique) : *check_duel* est réécrit (les propositions par période partent ; la dominante, le plan des trois périodes, aucun trio dominé, la mesure au meilleur plan) ; *check_banc* perd son épreuve 7 (le banc à l'entracte, et l'option *jusqua* qui le servait) ; *check_gros* perd la mise et les entractes, gagne la vieille décision d'entracte rejouée et la dominante ; *check_instantane* rembobine le choix d'avant-duel pris après coup ; *check_clarte* perd les scènes de la mise et de l'adjoint.

**Ce qui reste, et pourquoi** : *INTENTIONS*, *intentionDuDuel*, *FORCE_DUEL*, *PERIODES_DU_DUEL*, les trois périodes vues, *ELAN*, *SONNE*, leur coach en séries (*persoAdverse*, *OMBRE*) — JP : *le gros match vécu en direct* ; *PLANS* (les plans du duel ; ils gagnent *repond*) et *cibleDuPlan* ; *PLAN_DE_LA_PIECE*, *PLAN_DU_COACH* (déplacés dans *plansDuDuel*) ; l'instantané du moteur (*rembobiner*, *rembobinerSeries* : une décision datée d'un soir déjà joué) ; « Ton match, toute la série » (une décision *auto*, comme avant) ; le plan du soir des matchs ordinaires (*poserLesPlans*, *ouvrirPlan*, *planEnForce*, *planEnChiffres*, la décision *plan*) — la 6b ; les cartes de jeu et de joueurs, telles quelles (JP).

## 8. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| *POIDS_DOMINANTE* | 1,5 | 1-2 | sous 1, la dominante ne sort plus devant les autres (le rival ment) ; à 2,5, elle sort presque toujours et l'entracte n'apprend plus rien |
| *FORCE_DUEL* | 2 | 1,8-2,2 | inchangé (V17 : à 1,6, rien de net) |
| Le plan qui répond | ce qu'elle te fait à la force 1 | 1-1,5 | à 2, rien ne répond : un plan domine les autres |
| *PLANS.tirer*, tirs | ×1,11 | 1,08-1,12 | à ×1,15, tirer dominait chaque trio sur un match entier |

## 9. Les critères d'acceptation

- [x] Le duel : un seul choix avant le match, le plan, sans mise et sans décision d'entracte ; le rival montre son intention dominante et son style à son annonce, et elle sort plus que les autres ; le banc propose deux ou trois plans distincts en vraies stats du match ; aucun trio de plans n'a un plan qui domine les deux autres sur les cinq intentions ; deux clubs égaux, le meilleur plan contre Ton match, un avantage net, sous 60 % en face à face — `check_duel` (réécrit ; N = 1200 en CI).
- [x] Les gros matchs : en Rogue, chaque duel en trois périodes, le plan des trois ; une vieille décision d'entracte (et sa mise) rejouée sans planter et sans rien changer ; un duel perdu laisse ses sonnés sans doublement ; chaque rival annoncé porte son jeu et sa dominante, que son duel joue — `check_gros`.
- [x] L'instantané : le choix d'avant-duel pris après coup se rembobine et rejoue la saison au caractère près, en saison et en séries — `check_instantane`.
- [x] La page des règles dit le duel à un choix et ce qui répond à quoi, depuis *PLANS* — `check_clarte`.
- [ ] Les jambes, la profondeur contre les vedettes mesurée avec une pièce au lieu du plan « tirer » — `check_jambes` (la 6b).
- [x] Les écrans : le rival annoncé (la maquette 2), le choix du duel (la maquette 4), l'entracte à un bouton — `essai_rogue` (`CAPTURES_PAGES=1` : `rogue-rival.png`, `rogue-duel.png`, `rogue-duel-plan.png`, `rogue-duel-entracte.png`), le smoke (en CI).
- [x] Rien de mort — `check_mort` ; pas une couche de peinture — `check_refonte docs/refonte-v27-6a.md` (`BASE=origin/claude/v27-run`).
- [ ] R1, la cible remesurée sur le vrai banc et le duel à un choix — `check_profondeur` (en CI, `profondeur.yml`).
- [ ] À juger par JP à l'essai : le rival annoncé donne envie de bâtir vers lui ; le choix d'avant-match se sent ; l'entracte se regarde sans s'arrêter.

## Les écarts avec le devis et la maquette

1. **La tranche est coupée en deux PR** : la 6a (le duel) et la 6b (le plan du soir) ; les deux sortent avec les tranches 2 à 5b.
2. **Le plan qui répond est neuf** : sans lui, sur un match entier à la force du duel, un plan (tirer) rendait plus que les autres contre toutes les intentions, et le critère du § 10 (« aucun plan ne domine les deux autres ») tombait. Le devis le dit en un mot au § 4.3 (*des pièces y répondent*) ; c'est le plan, pas une pièce de la banque, qui répond. Ce n'est pas le tableau de contres de la V13 (JP, V17 : *je veux plus ce système de matching*) : un plan ramène à la force d'un soir ordinaire ce que leur intention te fait, rien de plus. **À trancher par JP.**
3. **Tirer de partout est moins fort** (tirs ×1,11 au lieu de ×1,15), aussi les soirs ordinaires jusqu'à la 6b.
4. **Boston 70-71**, l'un des quatre clubs témoins, garde un plan dominant (🧘 rester discipliné, contre trois trios) : un club très puni joue discipliné contre tout jeu. Le juge mesure sur le premier témoin, comme le reste de *check_duel* ; la sonde de la tranche lit les quatre.
5. **La maquette 4** n'a pas leur jeu ; l'écran le pose sous la barre du pronostic, la même bande qu'à l'annonce (la décision 3 d'après la revue : *ce que le rival a montré est sur l'écran du choix*).
6. **La maquette 2** montre, sous « Pour le battre », les pièces qui répondent à son style ; aucune pièce de la banque ne lit encore le style d'un rival (un moment rare à écrire) : la ligne attend.
7. **Le pronostic** est celui d'un soir ordinaire (*pronostic*, sans le duel) ; en séries, l'écran n'en montre pas.
8. **Deux juges rouges, laissés à la 6b** : `check_plan_de_match` (le plan du soir ; tirer de partout, plus faible, n'est plus « le meilleur contre au moins un adversaire ») part avec le plan du soir à la 6b ; `check_jambes` était déjà rouge sur la branche avant la 6a (les quatre mêmes épreuves, la mesure du plan « tirer »), et le devis le réécrit à la 6 : il l'est à la 6b, sur une pièce. Ni l'un ni l'autre n'est dans `verifier`.
9. **L'entracte** se vit dans le direct : le banc allumé à l'entracte (V23 A2) part avec l'entracte à choix ; il se lit au sommaire du soir.

## Les tranches

La tranche 6a est une PR vers `claude/v27-run`, après la 5b. La 6b (le plan du soir) part d'elle.
