# V30, tranches 2 à 6 — La saison jouée : la ligue, le repêchage, le bureau, le proprio

L'extrait du devis `docs/refonte-v30.md`, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 17 nov. 2026. Il fige les règles au complet et la liste ferme de « Ce qui part ». Ce que JP a tranché (§ 10 et § 12 du devis) n'est pas rediscuté ici ; ce qui n'est pas tranché garde la règle d'aujourd'hui et se pose à JP avec les chiffres (§ 10 de cet extrait).

## 1. Ce que JP a dit

JP, 17 nov. 2026 : *Faire le nouveau Rogue avec ce qui a été décidé, tout.*

Ce qui a été décidé (16 nov. 2026, `docs/refonte-v30.md` § 1, § 10, § 12) : *un EHM, mais avec un côté rogue* ; *les 82 soirs, joués*, *chaque soir, sa feuille* ; *lignes et gardiens, mais faire que ça a un impact* ; *23 dans des clubs faibles* ; *bureau EHM, match illustré* ; *plusieurs objectifs, variables selon force de l'équipe, de la ligue ; s'assurer qu'un bon DG va réussir plus qu'un mauvais* ; *pas d'échange, juste packs de cartes* ; *packs et portes*, les portes *après un gros match gagné* ; le ballottage *seulement si aucun remplacement possible* ; les séries, *les vraies, 16 clubs, 4 rondes* ; *une saison* par run ; *UI pensé comme par un humain… tout doit avoir un sens, une logique*.

Ce que la tranche 0 a mesuré (17 nov., `scripts/mesure_saison.mjs`, 64 graines) : choisir son gardien pèse 5,4 points sur 82 contre qui l'oublie ; asseoir les jambes lourdes coûte 2,4 points (rouge) ; le club repêché dans la bande 0,2 à 0,6 finit 8e ou 9e sur 32 (trop fort).

## 2. Ce que le joueur ressent

**Le fantasme** : je suis le DG. J'ai repêché ces vingt-trois-là sous le plafond, je les suis soir après soir au classement, et c'est mon banc, mes cartes et ma main sur le filet qui les mènent aux séries.

- **Le jour ordinaire** : le bureau dit qui vient ce soir et où j'en suis ; la feuille, mon gardien, le match d'un toucher ; le classement bouge.
- **Le pic** : le gros match en trois périodes et ses trois portes ; le rival du quart ; le bilan du proprio ; la pochette qui sort le badge qui manquait ; le soir où la 16e place se joue ; les séries.
- **Les boucles** : le soir (bureau, feuille, match, résultat) ; le quart (les objectifs du proprio, quatre ou cinq gros matchs, le rival, le bilan, le marché) ; la saison (le repêchage, 82 matchs, les seize, quatre rondes).

## 3. Les règles du jeu

### 3.1 Le départ

1. **Ton coach**, un parmi trois (le loto d'aujourd'hui). Sa pièce de départ entre sur le banc.
2. **Tes deux pièces de banc**, une parmi trois chacune, sans « Passer » : avant le repêchage, pour savoir quoi repêcher.
3. **Le repêchage de 23**. À chaque tour, la roulette sort le vestiaire d'un vrai club du bas de l'échelle (`REPECHAGE.BANDE`, en rang centile parmi tous les clubs de toutes les époques) ; tu y prends un joueur, vingt-trois fois.
   - Le plafond de la run est `CAP` ; le repêchage ne dépense pas plus que `CAP − ESPACE` (4 M$ gardés), et jamais au point de ne plus pouvoir remplir les cases qui restent au salaire plancher (`REPECHAGE.PLANCHER`).
   - La composition finale tient les cases du jeu : 13 ou 14 avants, 7 ou 8 défenseurs, 2 ou 3 gardiens, 23 en tout. Un joueur dont le groupe est plein ne s'offre plus.
   - `REPECHAGE.RELANCES` relances de la roulette pour tout le repêchage (un autre vestiaire, le même tour).
   - À la fin, l'alignement se range au mieux (`trioAuMieux`) ; tu le reprends au bureau.
   - **Les vingt-trois sont tes signés** : ils comptent pour ton banc. Les seuils des pièces se reposent pour vingt-trois joueurs (§ 4).

### 3.2 La ligue

- **Trente et un clubs**, un par franchise, tirés de la bande `LIGUE.BANDE` du monde de la run (toutes les époques). Ton club est le trente-deuxième.
- **Une vraie cédule** : 82 matchs par club en 186 jours (`ceduleDe`, js/sim.js, celle du 82-0). Les dos-à-dos et les jours de repos viennent d'elle, pour toi comme pour eux.
- **Rien n'est simulé d'avance.** Quand ton match du soir se conclut, les matchs des autres clubs se jouent jusqu'à ce soir-là compris, chacun sur ses propres dés (un hachage de la graine, du jour et de l'affiche) : ce que tu fais de ton club ne déplace pas les dés des autres, et la même graine rejoue la même ligue.
- **Les autres clubs arrivent sains et à jambes ordinaires** à chaque match (`ENERGIE_REF`, moins `LIGUE.USURE_DOS_A_DOS` s'ils ont joué la veille) : la règle du 11 nov. (une run ne dépend pas des autres) tient, et la run se garde sans rejouer la saison. Leur gardien tourne comme le moteur le fait.
- **Le classement** : 2 points la victoire, 1 la défaite en prolongation ; les seize premiers font les séries. **Les meneurs** : les buts et les passes de chaque feuille de la ligue.

### 3.3 Le soir

- **L'accueil est le bureau** (§ 3.8). « Jouer ce soir » ouvre la feuille du soir.
- **La feuille du soir** : l'adversaire, son jeu, ses lignes ; le lieu, ton dos-à-dos ou le leur ; tes lignes, leurs accords, leurs jambes ; **ton gardien** (le partant ou l'auxiliaire, chacun avec ses jambes) ; ta chance ; ce que le match paie.
- **Ton gardien est à toi** : le jeu ne fait plus tourner tes gardiens à ta place. Un partant qui enchaîne s'use (`jambesGardien`), l'auxiliaire le relève. C'est le geste mesuré vert à la tranche 0 (5,4 points sur 82). Tes lignes se changent au bureau (l'Alignement) ; aucun geste de ligne n'est demandé chaque soir (asseoir les jambes lourdes, mesuré, coûte).
- **Le match** en temps forts, qu'on mène à la fin d'un toucher. **Un match lancé est joué** : il se compte tout de suite ; quitter pendant ses temps forts reprend à son résultat.
- **Le résultat** : le pointage, tes points, tes jetons, ton rang qui bouge, les autres pointages de la ligue ; puis le bureau.

### 3.4 Le quart, le proprio, les cœurs

- **Quatre quarts** : les matchs 1 à 21, 22 à 41, 42 à 62, 63 à 82.
- **À l'ouverture d'un quart, le proprio pose trois objectifs** (JP : *plusieurs objectifs, variables selon force de l'équipe, de la ligue*) :
  1. **Les points du quart** : ce qu'un club de ta force fait dans cette ligue-là, `rond(matchs × tauxAttendu(rang de force)) − MARGE` (§ 4).
  2. **Le rival** : le battre.
  3. **Un troisième, tiré de la graine** parmi : **ta place** à la fin du quart (ton rang de force plus `PLACE_MARGE`, jamais plus exigeant que la 4e ni plus doux que la 24e ; au quatrième quart, la 16e : les séries) ; **tes affiches** (en gagner deux sur tes trois) ; **le hockey de ton coach** (jouer sa règle `HOCKEY_SOIRS` soirs du quart).
- **Au bilan, deux objectifs manqués sur trois coûtent un cœur.** Deux cœurs ; à zéro, le proprio te congédie : la run finit. Au dernier quart, être des seize suffit : il ne congédie pas un club qui fait les séries. Le rival ne compte qu'à son propre objectif.
- **Le rival du quart** : parmi tes adversaires des `FIN_DU_QUART` derniers matchs du quart, le club le plus près de toi au classement (au premier quart, à la force). Annoncé à l'ouverture, joué en duel, battu il laisse une pièce de banc parmi trois.
- **Une élite par quart, dès le deuxième** : dans le cœur du quart, ton match contre le club le mieux classé parmi les `ELITE_RANGS` premiers. Sa feuille demande : **l'enjeu, ou non**. Avec l'enjeu, un duel : gagné, une pièce parmi trois et `J` jetons (fixés sur ta vraie chance, comme aujourd'hui) ; perdu, les sonnés `SONNES_ELITE` matchs et la moitié de `J`, jamais un cœur. Sans l'enjeu, un soir ordinaire.
- **Trois affiches par quart, que tu poses toi-même** (JP, 17 nov. 2026 : *tu les poses*) : à la feuille de n'importe quel soir ordinaire, tu déclares l'affiche ; le match devient un duel. Celles que tu ne poses pas sont perdues à la fin du quart.
- **Un gros match gagné ouvre trois portes** (JP) : trois vrais vestiaires, dont le club battu, à sa hauteur (`PORTES_AUTOUR` : un gros club battu ouvre de meilleurs vestiaires), ceux du haut de l'échelle après un rival battu. Signer, c'est l'échange ; la relance se paie en jetons, une défaite en gros match en donne une ; passer paie.
- **Le bilan du quart** : les trois objectifs, le cœur, les médailles ; puis **le marché du quart** : une pièce de banc parmi trois, une carte à monter. Après le quatrième quart : dans les seize, les séries ; sinon la run finit.

### 3.5 Les cartes

- **Aucun échange.** Ton club change par les portes et par les pochettes.
- **Les pochettes au bureau**, entre deux matchs : le Bronze et l'Époque, une de chaque par quart.
- **Une carte qui entre sort un joueur** de son groupe ; celui qui sort libère `RACHAT` de son salaire (0,5, la règle du 10 nov. : JP n'a pas tranché, § 10).
- **Monter une carte** : au marché du quart, `MONTER` jetons.

### 3.6 Les blessés, le ballottage

- Un blessé s'assoit ; un réserviste qui convient à sa case monte de lui-même (`activeLineup`).
- **Le ballottage, seulement s'il le faut** (JP) : si aucun de tes réservistes ne peut tenir une case d'habillé, le bureau s'arrête avant le match et t'offre trois vrais joueurs pas chers du bas de l'échelle, à ce poste. Celui que tu prends tient une case de réserve en plus (`RESERVES_EN_PLUS`, js/sim.js) le temps de la blessure, sans salaire au plafond ni compte au banc, puis repart.

### 3.7 Les histoires

Une histoire vient au bureau quand son fait est vrai dans ta saison (`faitsDe`, qui relit le classement de la ligue et ta semaine) et que `REPOS_HISTOIRE` matchs ont passé depuis la dernière. Le fil du bureau la montre en une ligne ; l'ouvrir donne sa scène et ses deux réponses ; ne pas l'ouvrir ne bloque rien : elle tombe au prochain match.

### 3.8 Le bureau

Cinq onglets en bas, toujours au même endroit ; le HUD en haut (les cœurs, le quart et le match, ton rang et tes points, tes jetons, la pause).

- **Bureau** : ce soir (l'adversaire, le lieu, la sorte du match, « Jouer ce soir ») ; le proprio (les trois objectifs et où ils en sont) ; le fil, quatre lignes au plus (hier soir, un blessé ou un retour, une histoire, une pochette qui attend) ; ton banc.
- **Alignement** : tes lignes en tableau (le joueur, son badge, ses jambes, ses points), les accords de chaque ligne, l'infirmerie ; toucher deux joueurs les échange.
- **Masse** : les vingt-trois salaires triés, le plafond, l'espace, ce qui reste au plafond des joueurs sortis.
- **Ligue** : le classement (la ligne des séries tracée), les meneurs, ta cédule (les dix prochains, les gros matchs marqués).
- **Mon club** : les stats de la saison de chacun (matchs, buts, passes, points, tirs ; les gardiens, leur fiche et leur % d'arrêts), les dix derniers matchs, la séquence.

Un tableau plus long que son cadre défile dans son cadre ; la scène, elle, ne défile pas.

### 3.9 Les séries

- **Les vraies** : les seize premiers, 1 contre 16, 2 contre 15… ; un tableau fixe ; quatre rondes en 4 de 7. Le mieux classé joue chez lui les matchs 1, 2, 5 et 7.
- Chaque match de ta série a sa feuille et se joue en duel ; deux matchs en deux soirs, puis un jour de repos. Les autres séries avancent d'un match à chacun des tiens.
- **Leur banc** grandit de ronde en ronde (`BANC_DES_SERIES` : aucune pièce à la première, puis 1, 1 et 2).
- **Une série perdue finit la run** : les cœurs sont la confiance du proprio pendant la saison, pas des vies de séries.

### 3.10 Les jetons, les médailles, les galons

- **Les jetons** : une victoire ordinaire `JETONS_DU_MATCH` (du bas au haut du classement), une affiche `JETONS_DE_L_AFFICHE`, le rival `JETONS_DU_RIVAL`, l'élite `J` ; une défaite, une prolongation (`JETONS`) ; la règle du coach, `PRIME_DU_QUART` au plus par quart ; une porte passée.
- **Les médailles** : par quart joué, par bilan tenu, par rival battu ; par ronde de séries, la Coupe ; la caisse de fin, 10 jetons pour une.
- **Les galons** : ceux d'un match ne bougent pas ; ceux de la saison passent à l'échelle de 82 matchs (`GALONS.BUTS`, `GALONS.POINTS`).

Ces trois échelles sont provisoires : mesurées par les robots, puis posées à JP (§ 10).

## 4. Les chiffres

- **Le taux attendu** : `tauxAttendu(r) = TAUX_HAUT − (TAUX_HAUT − TAUX_BAS) × (r − 1) / 31`, `r` le rang de force de ton club parmi les trente-deux (1 le plus fort), en points par match. Exemple : 16e, 21 matchs, `TAUX` 1,38 à 0,84 → 1,119 × 21 = 23,5 → 23, moins `MARGE` 1 = **22 points**.
- **Les seuils des pièces, pour 23 signés** : posés sur ce que les repêchages du robot qui ne lit pas son banc atteignent, pour que sa deuxième marche tombe au plus 60 % du temps et sa troisième au plus 25 % (la borne du 14 nov.), et que chaque pièce atteigne sa première plus d'une fois sur deux chez qui bâtit.
- **La difficulté** : les adversaires portent `ETAPES` étapes d'édition par quart et en séries ; la bande de la ligue et celle du repêchage placent ton club de départ autour de la ligne des séries.
- **Les bornes gardées** (14 nov.), jugées par `mesure_run` : la Coupe 4 à 12 fois sur 64 pour le bâtisseur, « premier » au plus 2 ; bâtir paie (en paires, le bâtisseur fait plus de points que son témoin) ; un bon DG garde ses cœurs plus souvent qu'un mauvais.

## 5. Les cas limites

- **Une run de la V29 gardée** : `VERSION_DE_LA_RUN` passe à 4 ; elle s'arrête à l'ouverture, ses médailles versées une fois, et le départ le dit. Les clés (`cap82_run`, `cap82_run_monde`) ne bougent pas.
- **Quitter** : à la feuille, on y revient ; pendant les temps forts, au résultat ; au repêchage, au tour en cours.
- **Le plafond** : une signature qui le dépasse est refusée avant d'être offerte ; le repêchage ne peut pas se coincer (le plancher gardé pour chaque case qui reste).
- **Personne à offrir au ballottage** : le remplaçant de la ligue du moteur tient la case, comme au 82-0.
- **Banc plein** : la pièce neuve d'abord, puis celle qui sort.
- **Hors ligne** : aucun module de plus à charger (`sw.js` ne change que de version).
- **Le clavier et la manette** : A confirme, B revient, Start ouvre la pause.

## 6. Ce qu'il touche

- **Le jeu** : `js/run.js` (réécrit), `js/run-scenes.js` (réécrit), `js/run-jeu.js` (réécrit), `js/pieces.js` (les seuils, leur banc sur quatre rondes), `js/rogue.js` (les bouche-trous partent, les exigences), `js/actes.js`, `js/sim.js` (deux exports : `ceduleDe`, `noterDepart` ; aucun match ne change), `js/cartable.js` (les galons de la saison), `style.css`, `sw.js`.
- **Les robots et les juges** : `scripts/lib/run_robot.mjs`, `scripts/mesure_run.mjs`, `scripts/check_run.mjs`, `scripts/check_neuf.mjs`, `scripts/check_scene.mjs`, `scripts/essai_run.mjs`, `scripts/check_moments_si.mjs`, `scripts/check_meta.mjs`.
- **Les règles fermes défaites**, avec leur décision (docs/decisions.md, « V30 ») : « la run est une carte » et « la cible et les cœurs » (la saison et le proprio) ; « un match se joue isolé, aucune ligue en coulisse » (la ligue se joue, soir par soir, sur ses propres dés) ; « le soir se dit au moteur » (il se lit dans la cédule) ; « une scène, jamais une page » (restreinte au match, aux portes, aux séries : le bureau est fait de tableaux qui défilent dans leur cadre) ; « la carte de l'acte est l'accueil » ; « une semaine gagnée tient en neuf touchers » ; « une série perdue se rachète une fois par cœur » ; les seuils des galons.
- **Les règles gardées** : toutes les années ensemble ; le plafond mord ; le build décide ; seuls tes signés comptent ; neuf pièces de badge ; la règle du coach ; le duel sans plan ; leur banc en séries ; les médailles n'achètent que de la variété ; le cœur est pur.
- **Le 82-0, Sur table, l'exhibition, Sur glace** : aucun ne change (`check_empreinte`).

## 7. Ce qui part

- **La carte de l'acte** : `LARGEURS`, `RANGS_D_ARRETS`, `RANG_DE_L_ELITE`, `RANG_DU_RIVAL`, `carteDeLActe`, `casesOffertes`, `caseA`, `ouvrirLActe`, `sceneCarte`, `X_DES_CASES`, `Y_DES_RANGS`, `S_LARGEURS`, `.rn-chemin`, `.rn-noeud`, `.rn-tiroir`, `.rn-opt` → la cédule et le bureau.
- **Les dos-à-dos posés à la main** : `RANGS_DE_DOS_A_DOS`, `dosADosA` → la cédule.
- **Le départ donné et le camp** : `effectifDeDepart`, `bouchesTrousDuDepart`, `BANDE_DEPART`, `PIECES_DU_CAMP`, `BANDE_DU_CAMP`, `scenePieceDuCamp` → le repêchage de 23.
- **La cible de l'acte** : `conclureLActe`, `apresLaFinDActe`, `sceneFinDActe`, `MEDAILLES_ACTE_JOUE` → le bilan du quart et les objectifs du proprio.
- **Le rival annoncé en scène** : `sceneAnnonce`, `rivalDe`, `.rn-lui` → l'ouverture du quart.
- **Les arrêts de la carte** : `sceneVestiaire`, `monterUneCarte`, `histoireDeLaCase`, `.rn-choix`, `.rn-avap` → la cédule repose, le marché du quart monte une carte, l'histoire vient au bureau.
- **Les scènes de gestion illustrées** : `sceneLignes`, `sceneBanc` → les tableaux du bureau.
- **Les séries de trois rondes rachetées** : `conclureLaSerie` → les vraies séries.

**Ce qui reste, et pourquoi** (les noms en italique : `check_refonte` lit comme partis ceux qui sont en code) :

- **Le simulateur** (*playGame*, *simulerGrosMatch*) : JP, 9 nov. ; aucun match ne change.
- **Le banc et ses neuf pièces** (js/pieces.js, js/greffes.js) : la V29, tenue ; seuls ses seuils se reposent.
- **Les cartes de hockey, les pochettes, l'Album, le Club, les médailles, les exigences, le solde** : JP, deux fois ; la méta du 11 nov.
- **La feuille du soir, le match en temps forts, les portes, la porte ouverte, l'échange** : *oui est fun* (JP, 16 nov.) ; leurs scènes sont reprises, à leur HUD près.
- **Le monde de toutes les années, le salaire de la run** (*classerLesClubs*, *prixDe*) : JP, 11 nov.
- **Les coachs et leur règle, les histoires et leurs voix, les intentions du duel.**

**Le test du zéro** : la ligue, le repêchage, le quart, le proprio et les séries s'écrivent depuis le § 3 sans relire la carte ; le cœur, ses scènes et sa coquille se repartent chacun d'un fichier neuf.

## 8. Les réglages

`RUN` (js/run.js) : `REPECHAGE` (la bande 0,05 à 0,4, le plancher, cinq relances), `LIGUE` (la bande 0,25 à 0,95, l'usure du dos-à-dos), `QUARTS`, `ETAPES` (1 · 3 · 6 · 12, puis 12 en séries), `PORTES_AUTOUR`, `FIN_DU_QUART`, `AFFICHES`, `OBJECTIFS` (les taux, les marges, les soirs de hockey), les jetons, `GALONS`. `PIECES[*].seuils` et `BANC_DES_SERIES` (js/pieces.js). Chacun se pose sur mesure (`mesure_run`), jamais à l'œil.

## 9. Les critères d'acceptation

- [ ] La ligue est une vraie ligue : 82 matchs par club, un classement qui se recompte des pointages, rien de joué d'avance — `check_run`.
- [ ] Une run se quitte et se reprend n'importe quel soir et finit pareil ; la même graine rejoue la même run, quelles que soient celles d'avant — `check_run`.
- [ ] Le repêchage tient ses cases et son plafond, et ne se coince jamais — `check_run`.
- [ ] Les trois objectifs se recomptent des matchs joués ; deux manqués coûtent un cœur — `check_run`.
- [ ] Les séries sont les vraies : seize clubs, quatre rondes en 4 de 7, le tableau tenu — `check_run`.
- [ ] Choisir son gardien paie, en paires, en points sur 82 — `mesure_run`.
- [ ] Bâtir paie encore ; un bon DG garde ses cœurs plus souvent qu'un mauvais ; la Coupe 4 à 12 fois sur 64 — `mesure_run`.
- [ ] Chaque scène à 390 × 844 : le HUD au même pixel, les cibles de 44, aucun débordement ; seuls les cadres de tableau défilent — `check_scene`.
- [ ] Une saison se joue au doigt du coach à l'écran de fin — `essai_run`.
- [ ] Le moteur ne bouge pas — `check_empreinte`, `check_couches`.
- [ ] Pas une couche de peinture — `check_refonte docs/refonte-v30-2.md`.
- [ ] À juger par JP à l'essai : est-ce une saison ? est-ce que je me sens DG ? est-ce que ça se lit comme EHM à 390 px ?

## Les tranches

Une seule livraison (JP : *tout*) : le cœur et ses robots d'abord, mesurés ; puis les écrans ; puis les juges et les règles.

## 10. Tranché par JP, avec les chiffres (17 nov. 2026)

1. **Les écrans du bureau sans tour de maquettes** : *code direct* ; il juge sur le vrai écran.
2. **Les affiches** : *tu les poses* (devant : le jeu les pose). Mesuré : 63 soirs sur 82 ne demandaient rien d'autre que le gardien.
3. **Le salaire libéré** : *50 %, comme aujourd'hui*. Mesuré sur 24 saisons du bâtisseur : 2 signatures par saison à 0 %, 13 à 50 %, 15 à 100 % (46 % de runs qui explosent).
4. **Les médailles** : *garder le barème* (environ 105 par saison pour le bâtisseur ; une philosophie coûte 40 à 120).
6. **La Coupe** (17 nov., le juge du build à 256 graines) : leur banc en séries à *0 · 0 · 1 · 1*. Sur les mêmes 256 saisons du bâtisseur : 11 Coupes à 0 · 1 · 1 · 2 (une pièce en face dès la deuxième ronde y faisait tomber ses séries gagnées de 59 à 40 %), 14 à 0 · 0 · 1 · 2, 15 à 0 · 1 · 1 · 1, 20 à 0 · 0 · 1 · 1 (5 sur 64, dans la cible de 4 à 12).
7. **Les galons** : *resserrer* (27 par saison aujourd'hui ; viser 4 à 14 par run, chaque sorte dans 5 à 85 % des runs).
8. **Le cran 1** : *plus de points* (un point de plus par quart coûte moins de 0,05 cœur par run ; deux et trois se mesurent).
9. **Les galons, mesurés** (17 nov.) : *quand ça compte* — l'exploit d'un match (3 buts, 5 points, le jeu blanc, 40 arrêts dans une victoire) ne se grave que dans un gros match ; la saison passe à 50 buts et 100 points. Sur 128 saisons du bâtisseur : 7,9 gravures par run, chaque sorte dans 39 à 73 % des runs (avant : 15,5, le chapeau dans 99 %). L'autre voie, des seuils plus hauts n'importe quel soir (4 buts, 7 points, 45 arrêts, 5 blanchissages : 6,3 par run), faisait d'un « Chapeau » autre chose qu'un tour du chapeau.
5. **L'allure, le bureau vu** (17 nov., après la livraison) : *interface plus proche du 82-0* ; entre refaire les écrans, vivre dans la coquille du 82-0 et l'allure seule, *seulement l'allure*, en *code direct*. Les écrans du § 3.8 restent ; le Rogue lit les couleurs, les boutons, l'en-tête et les onglets à icônes du jeu, et les visages entrent dans les tableaux (docs/decisions.md, « Le Rogue prend l'allure du 82-0 »).

## 11. La revue du 17 nov. 2026, et ce qu'elle a changé

Deux relecteurs en adversaires sur cet extrait (`rogue-design`, `rogue-equilibre`), pendant que le cœur s'écrivait. Repris : le rival ne compte qu'à son objectif ; un club des seize n'est pas congédié au dernier bilan ; le dernier quart se joue aux étapes des séries et leur banc commence à la deuxième ronde ; les seuils du banc reposés pour vingt-trois signés (le bâtisseur sort du repêchage à sa première marche, pas à sa troisième) ; la ligue remontée (le club repêché est 20e de force en médiane) ; les jetons d'un soir ordinaire divisés par quatre. Posé à JP : qui pose les affiches. Les mesures : docs/decisions.md, « La V30 ».

## 12. Ce qui reste ouvert

- *Fermé le 17 nov.* — la Coupe était trop rare (11 sur 256 pour le bâtisseur, 2,8 sur 64) : leur banc en séries passe à 0 · 0 · 1 · 1 (§ 10, point 6).
- **Les crans d'exigence ne coûtent presque rien au bâtisseur** (`CRANS=1 GRAINES=128 FILS=3`, 17 nov.) : 0,3 cœur perdu par run sans exigence ; le cran 1 (un point de plus par quart) en ajoute moins de 0,05, pour 15 % de médailles de plus ; le cran 2 (des clubs plus forts) coûte 5 points au classement et 0,1 cœur, la Coupe 1 fois sur 128 au lieu de 5 ; le cran 3, moins de 0,05 cœur. Le juge est vert de justesse (chaque cran coûte, en paires), mais « un cran doit coûter » n'est pas tenu en esprit au cran 1 : un levier qui morde (deux ou trois points par quart, ou un cœur de moins) est à poser à JP. Les crans ne s'ouvrent qu'après une première Coupe.
- *Fermé le 17 nov.* — les galons : *quand ça compte* (§ 10, point 9).
- Le ballottage vient une dizaine de fois par saison : à juger à l'essai.
