# V27 — Le Rogue en roguelike : une run, une saison, quatre actes

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec la commande `/refonte` (7 nov. 2026). Le numéro : la V26 est réservée à « D2, les autres modes » (docs/refonte-v25.md § 4 D) ; celui-ci prend le suivant. **Rien n'est codé.** Les décisions de JP du 7 nov. 2026 sont tranchées (§ 1) ; ce qui reste ouvert est au § 11. À faire juger par `/revue-design docs/refonte-v27.md` avant la tranche 1.

La V25 (docs/refonte-v25.md) a fait la grammaire : un moteur pur et ses greffes, une carte de jeu, une grammaire d'effet, une banque d'histoires. La V27 garde cette grammaire et refait **la forme du jeu** : ce qu'est une run, ce qui la fait perdre, quand on décide, et combien de fois.

## 1. Ce que JP a dit, et ce qu'il a tranché

**Le constat de départ**, mesuré par trois rapports et trois tours de prototype (nov. 2026) :
- une saison du Rogue demande **environ 175 décisions, dont 20 à 25 vrais choix** ;
- **le plan du soir est dominé** : une option le vaut presque toujours ;
- **le duel vaut environ 0,5 victoire par saison pour 40 % du temps** de jeu ;
- **63 % des histoires ont deux réponses à moins de 0,1 V d'écart** ;
- le joueur gère **5 réserves** (les jetons, l'expérience du coach, la main d'adjoints, la main du deck, les médailles), **9 familles de pièces** et **une dizaine de minuteries** (séjours, repos, paliers, mains du deck, lundis d'histoire, annonces de gros match, promesses, situations, lancées, salaires).

Ce qui pèse des semaines d'avant : *le roguelike, il est pas facile à rendre le fun et balancé* (2 nov.) ; *première Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball* (7 nov.) ; *faut arrêter de juste changer la peinture* (4 nov.).

**Les décisions de JP, 7 nov. 2026 — toutes tranchées :**

1. **Une run = une saison**, en 4 actes : trois actes d'environ 27 matchs, chacun fini par un **boss** annoncé dès le début de l'acte (le 8e club de la ligue en force, puis le 4e, puis le plus fort), puis **les séries comme 4e acte, plus dures** (chaque adversaire y monte de 3 étapes d'édition). Gagner, c'est la Coupe. Les rustines entre deux saisons partent.
2. **La vie : 3 ❤️ de confiance du proprio.** On perd un cœur sur un point de contrôle raté (20e après l'acte I, 12e après l'acte II, une place en séries après l'acte III) ou sur une **élite ratée**. Un boss perdu ne coûte pas de cœur : il prive seulement le coach de sa montée. À 0 ❤️, la run finit.
3. **Le calendrier** (JP : *calendrier réel pour toutes les équipes, mais tu choisis les équipes qui vont quand pour avoir duels plus tough aux bons endroits*) : la ligue garde sa vraie cédule ; tu places tes adversaires dans tes cases. **Son prix, le renfort** : un club que tu repousses plus tard monte de 2 étapes d'édition par acte de recul (mesuré : placer vaut à peu près zéro en moyenne, et aide dans 7 graines sur 16).
4. **Les élites** : un vrai match de la semaine contre un club du haut, que tu choisis de jouer en duel ; grosse récompense, un cœur perdu si raté. À construire, et à mesurer (les prototypes ne l'ont pas modélisé).
5. **La boutique** : seulement à son nœud, à 6 moments de la saison (tes matchs 0, 14, 27, 41, 54 et 68), et le prix des packs repart à zéro à chaque ouverture (mesuré : c'est ce qui fait grandir l'équipe aux actes II et III).
6. **Le départ** : les bouche-trous du départ pigés entre 35 % et 55 % de leur saison au lieu de 5 % à 25 % (l'équipe part vers le 26e rang de force).
7. **Le banc** : les pouvoirs du coach, les adjoints et la main du deck fondus en 5 cases permanentes pour la run, sans séjour, repos ni salaire ; le relais est le moteur des combos. Le coach garde sa philosophie, sa règle, une pièce de départ, et monte à chaque boss battu (1 pièce parmi 3, ou passer).
8. **Les bornes** : plus de « ±1 victoire au plus par carte » ; une courbe de la ligue par acte, et un bon build peut casser le jeu à l'acte III.
9. **Le duel** : un seul choix lourd (un plan fort avec un vrai prix, la mise de la 3e) ; les micro-plans de période partent. **Le plan du soir** disparaît, fondu dans le banc. **Les histoires** : moins, une aux 2 ou 3 semaines, de vraies fourches avec un prix en stats ; les autres deviennent des nouvelles d'Hier soir sans choix ; la voix et le fait vrai restent.
10. **La méta** : de la variété plutôt que de la puissance (coachs, pièces de banc, packs, époques) ; les déblocages de force (la caisse, le plafond, les commanditaires, les Piliers gardés, les pages du classeur) deviennent de la variété ou partent ; les exigences 🔺 font la difficulté ; un mode Dynastie après la Coupe.
11. **Les monnaies** : 🪙 dans la run, 🏅 entre les runs.
12. **Les écrans** (JP, le même jour, sur l'audit d'interface) : Hier soir en tête de Ce soir ; l'affiche garde 240 px ; le Proprio s'ouvre en touchant ta plaque ; on retourne les cartes, mais le verso agrandi porte son « Prendre » et retourner une carte referme l'autre ; le fait sous la réplique d'une histoire dit seulement ce qu'elle tait ; « La run continue » devient un moment fort ; ton rang une seule fois, dans ta plaque ; le verbe sous une carte est « Prendre » partout. La seconde moitié de l'interface (D1b dans LIVRAISON.md) se fait dans ces écrans neufs.

**Ce qui ne bouge pas** (JP) : les vrais joueurs et leurs vraies stats, le moteur calibré, le repêchage dans de vrais vestiaires, le gros match vécu en direct, les histoires vraies qui nomment le joueur, les cartes de hockey.

**La taille est décidée** : une refonte de la forme du Rogue. Ce devis ne la négocie pas à la baisse.

## 2. Ce que le joueur ressent

**Le fantasme** : « j'ai une saison pour gagner la Coupe avec une équipe de bouche-trous ; je vois les trois boss qui m'attendent, je bâtis un banc qui s'emboîte, et chaque acte je sais exactement ce que je risque. »

- **Le pic** : le boss de l'acte battu, et la pièce qui fait clic avec ton banc ; l'élite gagnée sur un cœur ; le build qui casse le jeu à l'acte III ; la Coupe. Le cœur perdu au point de contrôle doit faire mal, pas finir la soirée.
- **Le jour ordinaire** reste rapide : un soir sans choix se joue en un geste (Jour suivant), le banc s'allume tout seul ; aucun écran ne demande rien entre deux nœuds sauf ce qui presse.
- **Les boucles** (le modèle emboîté) :
  - la micro-boucle (30 s) : le soir joué, le banc qui s'allume, Hier soir qui le dit ;
  - la méso-boucle (5 à 15 min) : de nœud de boutique en nœud de boutique (≈ 14 matchs), avec une élite ou une fourche d'histoire entre deux ;
  - la macro-boucle : l'acte (≈ 27 matchs), qui finit par son boss et son point de contrôle — l'arrêt naturel et la raison de revenir ;
  - la run : une saison, quatre actes, trois cœurs ;
  - la carrière : la variété débloquée en 🏅, les exigences 🔺, la Dynastie.

**Les esthétiques visées** (MDA) : le Défi (lire le boss, gérer ses cœurs), l'Expression (le banc qui s'emboîte), la Fantaisie (les vrais joueurs, le vrai coach), le Récit (les fourches vraies). **Les besoins** (SDT) : l'autonomie par le calendrier placé, les élites choisies et le banc ; la compétence par des boss annoncés et des contrôles chiffrés ; la relatedness par les voix et les joueurs nommés.

## 3. L'inventaire : ce qui existe aujourd'hui

Lu dans js/ le 7 nov. 2026 (chaque nom vérifié par une recherche ; les lignes exactes se comptent à la tranche 1, `wc -l`, que ce devis n'a pas pu lancer).

**La run sur plusieurs saisons et ses rustines** (js/rogue.js) : le mandat du proprio (`MANDATS`, `mandatDe`, `MANDAT_DE_LA_PREMIERE`) ; la marche de la deuxième saison (`ETAPE_APRES_LA_PREMIERE`, `etapeDeLaRun`) ; entre deux saisons, le loto du cartable et les gardés (`LOTOS_DE_SAISON`, `GARDES_DE_SAISON`, `gardesDeLaRun`) ; le départ (`bouchesTrousDuDepart`, `departDuClasseur`, `lotoDeCase`, `PAGES_DU_CLASSEUR`, `CASES_DE_LA_DERNIERE`, `gardesDeLaDerniere`).

**Le coach et sa croissance** (js/pouvoirs.js) : l'expérience (`XP`, `SEUILS_NIVEAU` 0 · 25 · 70 · 140 · 240), les talents (`TALENT`, `TALENT_CASE`, `aLaCaseDePlus`), les trois `POUVOIRS` ouverts aux niveaux 1, 3, 5.

**La main d'adjoints** (js/adjoints.js, js/greffes.js, js/rogue.js) : `ADJOINTS`, le séjour et le repos (`SEJOUR` 12, `SEJOUR_SYNERGIE` 16, `REPOS` 20, `finirSejours`), la main (`MAIN_MAX` 4, `quiPartDeLaMain`), les cases (`CASES_PAR_NIVEAU`, `casesDuNiveau`, `CASE_DE_PLUS`, `casesDuPerso`), le salaire (`SALAIRE_NIV`, `salaireDe`, `salairesDesAdjoints`), les offres (`adjointsOfferts`, `niveauOffert`, `momentFort`, `PALIERS_PACK` 10 · 30 · 50 · 70), le relais (`effetDuRelais`, `RELAIS_NIV`).

**La main du deck** (js/sim.js, js/saison.js) : `mainDuDeck`, `PALIERS_CARTES` 20 · 40 · 60, `SORTES_DECK`, `NIVEAU_SORTE`.

**Le plan du soir et le duel** (js/greffes.js, js/impact.js, js/saison.js, js/sim.js) : `PLANS` (six plans), `poserLesPlans` (le plan posé sur un soir ordinaire), `ouvrirPlan` (son écran), `planEnChiffres` ; au duel, les propositions du banc période par période (`propositionsDuDuel`, `voixDuBanc`), `INTENTIONS`, `FORCE_DUEL`, la mise doublée (`MISE_DOUBLEE`).

**Les gros matchs** (js/sim.js) : les rivaux choisis au proprio (`RIVAUX` 3, `RIVAUX_OFFERTS` 5, `rivalChoisi`), l'annonce (`annoncerGros`, `grosMatchAvant`, `ESPACEMENT_GROS`, `ANNONCE_GROS`), le butin (`BUTIN_DU_GROS`, js/rogue.js).

**La boutique et la méta** (js/rogue.js, js/packs.js) : `BOUTIQUE` (huit pochettes), `prixAuAchat` (le prix qui monte à chaque achat de la saison), les crans de pack (`CRANS_DE_PACK`, `monteeDesPacks`, `packsOuverts`), `DEBLOCAGES` (dont `caisse1`, `caisse2`, `plafond1`, `plafond2`, `garder1` à `garder3`, `classeur1` à `classeur4`, `banc1`, `banc2`), `plafondDuVestiaire`, `jetonsDeDepart`, `reservesDeLaRun`, `EXIGENCES`, `exigencesDe`.

**Les histoires** (js/histoires.js) : quarante, trois moments, le lundi tiré (`lundiAHistoire`, `CHANCE_HISTOIRE` 0,55, `DISETTE_MAX` 3, `SORTIES_MAX`, `REPOS_HISTOIRE`).

**Le prototype** (scratchpad du 7 nov., `proto-actes/sim_copie.mjs`, une copie de `scripts/lib/rogue_sim.mjs` hors du jeu) : il a ajouté `jouerSaisonActes` et ce qui la sert, et rien changé au moteur. Ce qu'il fait, exactement :
- **les actes** : `actes` [27, 54, 82] (tes matchs joués) ; `actDe` range chaque match dans son acte ;
- **les boss** : `bossRang` [7, 3, 0], le rang de force (attaque + défense + gardien, `teamStrength`) parmi les 31 adversaires ; le dernier match de chaque acte est échangé (`echanger`, qui garde 82 matchs à chacun et un match par jour, `peut`) pour mettre le boss dans cette case ; **seuls les boss sont des duels** (`grosAnnonces` posé sur les trois fins d'acte, `raison: 'choisi'`), le reste des soirs ordinaires ;
- **les cœurs** : `coeurs` 3 ; à la fin d'un acte, un cœur de moins si le rang au classement passe le contrôle (`controles`, **[24, 16, 16] par défaut, et c'est ce qui a été mesuré**) et un de moins pour un boss perdu si `coeurBoss` (mesuré à `false`, la décision 2) ; `mort` note l'acte où la run finit ;
- **la montée du coach** : un boss battu donne au coach l'expérience jusqu'à son prochain `SEUILS_NIVEAU` (`xpBoss`) — **une approximation** de « 1 pièce parmi 3 » ;
- **le calendrier placé** : `placer` (`reel`, `croissant`, `decroissant`, `jambes`) réordonne tes adversaires hors des boss ; **le renfort** (`prix: 'renfort'`, `renfort` 2 mesuré) : `habillerLaLigue` monte d'arrondi(renfort × recul moyen en actes) étapes un club repoussé ; une variante `prix: 'boss'` (le boss devient le plus fort des clubs sortis de l'acte) a été essayée et écartée ;
- **la boutique** : `noeuds` [0, 14, 27, 41, 54, 68] (tes matchs joués), `achatsParNoeud` 4, et `prixReset` (le compteur de prix repart à zéro à chaque nœud) mesuré à `true` ;
- **les séries plus dures** : `etapeSeries` 3, la ligue habillée de 3 étapes de plus pour les séries ;
- **le départ** : `reglerDepart({ bande: [0.35, 0.55] })` et `bouchesTrousBande`, la bande des bouche-trous en part de la ligue au lieu de [0,05, 0,25] ;
- **ce qu'il n'a pas changé** : le plan du soir (`planDuRobot` tourne encore), les adjoints à séjour et à salaire, la main du deck, les histoires telles quelles (`lundiDuRobot`, `rondeDuRobot`), la courbe de la ligue par acte (`etapes` [0, 0, 0] mesuré ; [0, 1, 2] essayé, variante `att-courbe`), et **aucune élite**.

**La mesure qu'il a rendue** (`t4_s3.jsonl` : 16 graines, la vraie première run, `META=0`, les mêmes dés pour chaque robot) : **le robot attentif gagne la Coupe 2 fois sur 16 (13 %), le robot « premier » et le naïf aucune** ; l'attentif fait **5 à 9 victoires de plus** en paires et **trois fois plus de rondes de séries**.

## 4. Les règles du jeu : la run neuve, au complet

Ces règles se lisent seules ; elles ne sont pas un diff des règles d'avant.

### 4.1 La run

- Une run est **une saison de 82 matchs et ses séries**. Il n'y a pas de deuxième saison : la Coupe gagnée ou la run perdue, c'est la fin, et on revient au départ (la méta, § 4.9).
- La saison se coupe en **quatre actes** : l'acte I (tes matchs 1 à 27), l'acte II (28 à 54), l'acte III (55 à 82), les séries (l'acte IV).
- La ligue joue sa vraie cédule, au jour le jour, comme aujourd'hui (moteur.md : rien d'avance).

### 4.2 Les cœurs et les points de contrôle

- Le proprio te donne **3 ❤️** au départ ; ils ne remontent jamais dans la run (question ouverte 11.3).
- **À la fin de chaque acte**, après le boss, le classement du soir est lu :
  - acte I : 20e ou mieux, sinon −1 ❤️ ;
  - acte II : 12e ou mieux, sinon −1 ❤️ ;
  - acte III : une place en séries (16e ou mieux), sinon −1 ❤️ **et la run finit** (sans séries, pas d'acte IV) ;
- **Une élite perdue** : −1 ❤️ (§ 4.5).
- **Un boss perdu** ne coûte aucun cœur ; le coach ne monte pas (§ 4.6).
- **À 0 ❤️**, la run finit le soir même : l'écran de fin, les 🏅 de ce qui a été fait.
- En séries, aucun cœur ne se perd : une série perdue finit la run.

### 4.3 Les boss

- Chaque acte a son boss, **annoncé au premier soir de l'acte** : à l'acte I le 8e club de la ligue en force, à l'acte II le 4e, à l'acte III le plus fort (la force : attaque + défense + gardien, lue au premier soir de la saison sur `teamStrength`). Il est le **dernier match de l'acte**, posé là par un échange de cédule qui garde à chaque club ses 82 matchs et un match par jour (ce que fait `echanger` dans le prototype).
- Le boss est un **duel** (§ 4.7), le seul gros match obligatoire de l'acte. L'affiche le montre dès le premier soir de l'acte (Ce soir, la plaque du boss et son compte à rebours en matchs).
- Gagné, le coach monte (§ 4.6). Perdu, rien d'autre ne se passe.

### 4.4 Le calendrier placé et le renfort

- **Au premier soir de chaque acte**, l'écran du calendrier de l'acte s'ouvre : tes cases de l'acte, chacune avec son adversaire de la vraie cédule. Tu peux **échanger deux adversaires** entre deux de tes cases du même acte ou vers un acte plus loin ; le boss ne bouge pas. Le reste de la ligue garde sa cédule (l'échange se fait comme `echanger` : les deux jours, tous leurs matchs, 82 chacun).
- **Le renfort** : un club que tu as repoussé vers un acte plus tard monte de **2 étapes d'édition par acte de recul**, en moyenne sur ses matchs contre toi, arrondi, pour toute la saison (`RENFORT_PAR_ACTE`). L'écran le dit sur la case avant que tu valides (« Boston +2 ✦ »).
- On peut ne rien placer : la vraie cédule, gratuite.
- Le placement se fait au premier soir de l'acte, en un seul arrêt ; une fois l'acte commencé, il ne bouge plus.

### 4.5 Les élites

- **Une fois par semaine au plus** (le lundi), si ta semaine a un match contre un club **du top 8 en force**, l'écran propose d'en faire une **élite** : un duel (§ 4.7) contre lui.
- Tu choisis : la jouer en élite ou en soir ordinaire. Le choix se fait le lundi, pour son jour.
- **Gagnée** : une grosse récompense (§ 11.4, à trancher ; proposition : une pièce de banc parmi 3, un niveau au-dessus de ce que le boss offrirait, ou 25 🪙).
- **Perdue** (en temps réglementaire, en prolongation ou en fusillade) : −1 ❤️.
- Jamais d'élite la semaine du boss, jamais en séries, jamais à 1 ❤️ sans un avertissement à l'écran (« Ton dernier cœur »).
- **À construire et à mesurer** : le prototype ne l'a pas modélisée (§ 10, tranche 7).

### 4.6 Le banc : cinq cases pour la run

- Le banc a **5 cases**, permanentes pour toute la run. Une **pièce de banc** est une carte de jeu (`carteHtml`) de la grammaire d'effet (js/effets.js) : un pouvoir du coach, un adjoint ou une carte de l'ancienne main du deck, réécrits en une seule famille, `PIECES`. Chacune garde ce qui faisait son jeu : sa condition (`quand`, lue période par période), ses canaux, son prix, sa réplique (`dit`), son **relais** (le moteur des combos : une pièce qui se lit relaie le canal d'une autre, deux maillons au plus, `effetDuRelais`, `RELAIS_NIV`).
- **Aucun séjour, aucun repos, aucun salaire, aucune main** : une pièce posée joue chaque soir où sa condition se lit, jusqu'à ce que tu la remplaces.
- **Le plan du soir n'existe plus** : ce que les plans faisaient sur un soir ordinaire (tirer, coller, fermer, forechecker, rester discipliné) devient des pièces de banc.
- **Le coach** : au départ, tu tires ton entraîneur au loto comme aujourd'hui (`lotoDesCoachs`) ; il garde sa **philosophie**, sa **règle** (`REGLES_DU_COACH`, les 🪙 du soir où ton club joue son hockey) et apporte **une pièce de départ** posée dans la première case. Il n'a plus d'expérience ni de niveaux à gagner en jouant.
- **La montée** : à chaque boss battu, **1 pièce parmi 3**, tirée de la graine dans les pièces de sa philosophie et des voisines, **ou passer**. Une pièce prise va dans une case libre ou remplace celle que tu touches (l'ancienne part).
- D'autres pièces viennent des élites gagnées, de certaines fourches d'histoire et de la boutique (§ 4.8, question 11.5).

### 4.7 Le duel

- Le duel (le boss, l'élite, chaque match de séries vu en direct) garde ses trois périodes vues et les intentions de l'adversaire (`INTENTIONS`).
- **Un seul choix lourd avant le match** : **un plan fort**, parmi deux ou trois que ton banc propose (chacun tiré d'une pièce posée ou de la philosophie du coach), chacun avec un **vrai prix** en stats de match (tirs, % au tir, tirs contre, % d'arrêts, punitions), ou « Ton match ».
- **La mise de la 3e** : avant la 3e période, tu peux doubler ce que le duel rapporte, et ce qu'il coûte s'il est perdu (`MISE_DOUBLEE`).
- **Plus rien entre les périodes** : les propositions de l'adjoint à chaque entracte partent. L'entracte montre le pointage, leur intention qui vient, et un seul bouton.

### 4.8 La boutique et les monnaies

- **🪙 jetons dans la run, 🏅 médailles entre les runs.** Aucune autre réserve : l'expérience du coach, la main d'adjoints et la main du deck partent.
- La boutique **n'ouvre qu'à son nœud**, six fois par saison : avant ton 1er match, puis après tes 14e, 27e, 41e, 54e et 68e matchs. Hors d'un nœud, la porte Marché montre la boutique fermée et le prochain nœud (« Ouvre après ton 41e match »).
- **Le prix des packs repart à zéro à chaque ouverture** : le premier pack d'un nœud coûte le prix de base, le deuxième monte comme aujourd'hui (`prixAuAchat` compté sur les achats du nœud).
- Les jetons viennent des victoires (le barème), de la règle du coach, des boss et élites gagnés et des primes des fils ; plus aucun salaire ne les vide.

### 4.9 Le départ et la méta

- **Le départ** : tes bouche-trous sont pigés entre **35 % et 55 %** de leur saison (`bouchesTrousDuDepart`, la bande), plus ta vedette du départ ; l'équipe part vers le 26e rang de force.
- **La méta est de la variété** : les 🏅 ouvrent des coachs, des pièces de banc, des pochettes et des époques ; aucune ne rend la run plus facile. **Les déblocages de force partent** : la caisse (`caisse1`, `caisse2`), le plafond (`plafond1`, `plafond2`), les commanditaires, les Piliers gardés (`garder1` à `garder3`), les pages du classeur (`classeur1` à `classeur4`) et les crans de pack ; chacun devient une variété ou part (§ 7, question 11.6).
- **Les exigences 🔺** restent la seule difficulté qui monte, et elles passent par les leviers de la V27 (moins de cœurs, des contrôles plus serrés, des boss plus haut, des séries plus dures), pas par le plafond ou le classeur.
- **La Dynastie** : après sa première Coupe, un mode ouvert où la run continue une saison de plus avec la même équipe, à exigence montée. « La run continue » est un moment fort (§ 4.11).

### 4.10 Les histoires

- **Une fourche aux 2 ou 3 semaines** : un vrai choix, deux réponses, chacune avec **un prix en stats** (jamais deux réponses de même valeur). Le reste des histoires de la banque devient des **nouvelles d'Hier soir**, sans choix, dites par leur voix avec leur fait vrai.
- La voix, le joueur nommé, le fait vrai lu dans les feuilles (`faitsDe`) et la vraie saison avec ses bornes restent ; la règle « jamais deux fois le même joueur dans la run » reste.

### 4.11 Les écrans (décision 12)

- **Ce soir** : Hier soir en tête, puis l'affiche (240 px au moins, ton adversaire, le boss de l'acte et son compte à rebours), tes cœurs et l'acte dans ta plaque, ton banc en cinq cartes ; **ton rang une seule fois, dans ta plaque** ; **toucher ta plaque ouvre le Proprio** (les cœurs, les contrôles, la caisse).
- **Les cartes** : on les retourne ; **le verso agrandi porte son « Prendre »**, et retourner une carte referme l'autre. **Le verbe sous une carte est « Prendre » partout** (plus de « Poster », de « Signer » sous une carte de jeu ; « Signer » reste l'échange d'un joueur, interface.md).
- **Une histoire** : sous la réplique, le fait dit **seulement ce que la réplique tait** (jamais le même chiffre deux fois).
- **« La run continue »** (le passage à la Dynastie, et la fin d'un acte gagné) est un **moment fort** (le palier « pic » de js/mouvement.js).
- **Écrans neufs** : le calendrier de l'acte (le placement, le renfort sur la case), le boss annoncé, la proposition d'élite, le point de contrôle (les cœurs), la montée du coach (1 parmi 3), le banc de cinq.
- La seconde moitié de l'interface (D1b de LIVRAISON.md) se fait dans ces écrans neufs, pas dans les anciens.

## 5. Les chiffres

- **Les actes** : `ACTES` [27, 54, 82] (tes matchs joués à la fin de chaque acte). Exemple : ton 27e match est le boss de l'acte I.
- **Les boss** : `RANGS_DES_BOSS` [7, 3, 0], le rang (de 0) parmi les 31 adversaires triés par `att + def + g` au premier soir.
- **Les contrôles** : `CONTROLES` [20, 12, 16] (rang au classement le soir du boss, inclus). Le tour 3 du prototype les a mesurés (les mêmes 16 saisons relues à 20 · 12 · séries) : l'attentif ne meurt qu'une fois sur 16, à l'acte III ; le premier robot 6 fois. À remesurer à la tranche 1, avec le vrai banc (risque R1).
- **Le renfort** : `e = arrondi(RENFORT_PAR_ACTE × (acte moyen placé − acte moyen réel))` pour chaque club, `RENFORT_PAR_ACTE` 2 ; `e > 0` monte le club de `e` étapes d'édition (`habillerLaLigue`) pour la saison. Exemple fait à la main : un club qui jouait 1 match dans chaque acte (moyenne 1) et que tu places 3 fois à l'acte III (moyenne 2) : `arrondi(2 × 1) = 2` étapes.
- **Les séries** : chaque adversaire monte de `ETAPE_SERIES` 3 étapes d'édition au premier match des séries.
- **La courbe de la ligue par acte** : `ETAPES_DES_ACTES` [0, 0, 0] (mesuré) ; [0, 1, 2] essayé, à trancher par la mesure (question 11.7).
- **La boutique** : `NOEUDS_BOUTIQUE` [0, 14, 27, 41, 54, 68] ; prix d'un pack = `prixAuAchat(cle, n)` avec `n` les achats **de ce nœud** (0 au premier).
- **Le départ** : `BANDE_DEPART` [0,35, 0,55] de la saison du bouche-trou à son poste (il était [0,05, 0,25]).
- **Les cœurs** : `COEURS` 3.
- **Le banc** : `CASES_DU_BANC` 5 ; `PIECES_OFFERTES` 3 à la montée.
- **Les bornes** : la règle « une carte sous ±1 V, ±1,5, ±2,5, ±4 selon son niveau » part pour les pièces de banc. Ce qui reste : chaque pièce **se voit** dans la feuille du soir où elle joue (les seuils de rogue.md : ±2 tirs, ±0,3 but…), **n'est jamais un piège** (en paires, jamais sous −0,5 V sur l'acte), et la run suit **une courbe** : le rang de force de l'attentif part vers le 26e, est dans le top 16 à la fin de l'acte II et dans le top 8 à la fin de l'acte III en médiane. Un build peut casser le jeu à l'acte III : c'est voulu.
- **Les histoires** : une fourche aux 2 ou 3 semaines, soit **9 à 13 fourches** sur une saison de ≈ 26 semaines ; **au plus 20 %** des fourches ont deux réponses à moins de 0,1 V d'écart (63 % aujourd'hui).
- **Les décisions** (une information, pas un rouge) : cible **≤ 90 décisions par saison, dont ≥ 30 vrais choix** (175 et 20 à 25 aujourd'hui) ; « vrai choix » : deux options à plus de 0,3 V d'écart en paires ou à des formes de jeu différentes (question 11.8, la définition).
- **La cible du prototype** (tranche 1) : sur 16 graines, la vraie première run, les mêmes dés, l'attentif gagne la Coupe 2 fois sur 16 (1 à 4 accepté, le bruit de 16 graines), « premier » et le naïf 0 (au plus 1) ; l'attentif fait 5 à 9 victoires de plus en paires et au moins deux fois plus de rondes de séries.

## 6. Les cas limites

- **La vieille partie** (JP, V20 : *on s'en fout de briser les saves* ; mais une partie en cours ne doit pas planter). Les clés de sauvegarde ne bougent pas ; la V27 ajoute des champs (`G.rogue.acte`, `G.rogue.coeurs`, `G.rogue.banc`, `G.rogue.place`). Une run d'avant (sans `acte`, ou à sa 2e saison ou plus) **ne se rejoue pas sous les règles neuves** : à l'ouverture, un écran dit « Cette run date d'avant la nouvelle saison », ses 🏅 sont versées comme à une fin de run, et une run neuve commence. Une vieille décision (`poste`, `embauche`, `talent`, `xpCoach`, `plan`, une main du deck) ne joue rien et ne plante pas — `check_sauvegardes` (une partie de chaque forme d'avant s'ouvre sans erreur).
- **Une Dynastie** en cours (la saison d'après une Coupe) se joue comme une run, cœurs remis à 3, exigence montée.
- **Un boss blessé ou échangé** : le boss est un club, pas un joueur ; il reste.
- **Le boss déjà joué contre toi dans l'échange** : l'échange choisit le match du boss le plus proche de la fin de l'acte qui garde 82 matchs à chacun ; s'il n'en existe aucun, le dernier match de l'acte contre un club du même rang ± 1 (à vérifier par le juge : jamais de boss manquant).
- **La semaine sans club du top 8** : pas d'élite cette semaine.
- **Une élite à 1 ❤️** : proposée, avec l'avertissement ; la prendre est un choix.
- **Une élite en prolongation perdue** : perdue.
- **Le dernier cœur perdu à l'acte III** : la run finit avant les séries, même qualifiée.
- **Le banc plein à la montée** : la pièce prise remplace celle que tu touches ; « Passer » est toujours là.
- **Une pièce qui ne se lit jamais** (sa condition ne revient pas avec ton club) : le juge `check_moments_si` exige que chaque condition revienne assez souvent.
- **Le calendrier sans échange possible** : la case reste ; l'écran ne propose pas l'échange qui casserait les 82 matchs.
- **Les séries** : pas de cœurs, la série perdue finit la run ; chaque match vu en direct est un duel.
- **Hors ligne** : sw.js liste les modules neufs et oublie les partis — `check_coquille`.
- **Le clavier et la manette** : chaque écran neuf répond à A, B, Échap et au balayage — smoke, `essai_rogue`.

## 7. Ce qu'il touche

**Les fichiers** : js/rogue.js, js/rogue-jeu.js, js/pouvoirs.js, js/adjoints.js, js/greffes.js, js/impact.js, js/sim.js (les gros matchs et la main du deck, qui sortent du moteur), js/saison.js, js/gerant.js, js/banc.js, js/inventaire.js, js/magasin.js, js/packs.js, js/histoires.js, js/coachs.js, js/coachs-reels.js, js/cartable.js, js/composants.js ou js/plateau-rogue.js (selon D1), `js/pieces.js` (neuf : `PIECES`), `js/actes.js` (neuf : les actes, les boss, les cœurs, le placement, les élites), style.css, sw.js ; scripts/lib/rogue_sim.mjs, scripts/lib/cartes_robot.mjs, `scripts/lib/rogue_actes.mjs` (neuf, le prototype repris), les juges du § 9.

**Les règles fermes de `.claude/rules/`**, chacune réécrite pour décrire le neuf (refonte, § 4) :
- rogue.md : « Le coach est un personnage… expérience, niveaux 1 à 5, talents » — **défaite** (décision 7) ; « chaque pouvoir… sous sa borne seul (2,5 V, 4 V) », « le personnage complet sous 16 V », « une carte… bornée par son niveau » — **défaites** (décision 8), réécrites comme « se voit, jamais un piège, la courbe par acte » ; « la deuxième run est plus dure… `ETAPE_APRES_LA_PREMIERE` », « la première saison… `MANDAT_DE_LA_PREMIERE` », « la boule de neige est bloquée… lotos et gardés entre deux saisons » — **défaites** (décision 1 : plus de deuxième saison) ; « les adjoints ne s'achètent pas… séjour, repos, salaire, main, cases par niveau » — **défaite** (décision 7) ; « la main du deck » — **défaite** (décision 7) ; « au duel, ton banc propose avant chaque période » — **défaite** (décision 9) ; « le robot premier Signer ne gagne pas la Coupe » — **tenue** ; « après sa première Coupe… exigences » — **tenue**, par les leviers neufs ; « le gros match se règle le jour où il se joue » — **tenue** (le boss et l'élite aussi) ; « aucun joueur ne te suit au choix » — **tenue** ; « l'histoire… un lundi sur deux, `CHANCE_HISTOIRE` » — **défaite** (décision 9), le reste de la règle des histoires tenu.
- interface.md : « ton banc en main de quatre vraies cartes » — devient cinq ; « "Prendre" sous une carte » — tenue et étendue (décision 12) ; « rien que ton rang dans la bande de Ce soir » — devient « dans ta plaque » ; « Ce soir est une émission… hier en une ligne » — Hier soir passe en tête.
- vocabulaire.md : **adjoint**, **séjour**, **au repos**, **salaire**, **la main**, **talent**, **expérience**, **la main du deck** partent du vocabulaire du Rogue ; entrent **acte**, **boss**, **élite**, **cœur** (❤️, la confiance du proprio : le mot « confiance » revient, pour le proprio seulement), **point de contrôle**, **pièce de banc**, **le banc** (cinq cases), **renfort**, **nœud** (de la boutique), **fourche**, **Dynastie** ; « boss » était écarté pour leur coach en séries (« Pas "boss" ») : il nomme maintenant le dernier match d'un acte, et leur coach reste « leur coach ».
- moteur.md : rien (le moteur ne bouge pas ; `jouerEnPeriodes` et les greffes restent).
- **Les clés de sauvegarde ne bougent jamais** (`check_sauvegardes`).

## 8. Ce qui part

La pièce maîtresse. Chaque nom ci-dessous disparaît de js/, index.html, style.css et sw.js, et `check_refonte` le vérifie à la PR de sa tranche. Chacun a été cherché dans js/ le 7 nov. 2026. Le test du zéro : `js/actes.js` et `js/pieces.js` s'écrivent depuis le § 4 sans relire les modules d'avant ligne par ligne ; c'est une refonte.

Dans cette partie, seul ce qui part est en `code` : `check_refonte` exige l'absence de chaque nom en `code` sous ce titre, donc les noms neufs qui les remplacent sont écrits en italique.

### La run sur plusieurs saisons (tranche 2)

- `ETAPE_APRES_LA_PREMIERE`, `etapeDeLaRun` → la courbe par acte et les séries plus dures (*ETAPES_DES_ACTES*, *ETAPE_SERIES*).
- `MANDATS`, `mandatDe`, `MANDAT_DE_LA_PREMIERE` → les cœurs et les points de contrôle (*COEURS*, *CONTROLES*).
- `LOTOS_DE_SAISON`, `GARDES_DE_SAISON`, `gardesDeLaRun` → rien : il n'y a plus d'entre-deux-saisons.

### Les gros matchs choisis (tranches 2 et 7)

- `RIVAUX`, `RIVAUX_OFFERTS`, `rivalChoisi`, `annoncerGros`, `grosMatchAvant`, `ESPACEMENT_GROS` → les boss annoncés (*bossDeLActe*) et les élites (*eliteDeLaSemaine*), dans js/actes.js.
- `BUTIN_DU_GROS` → la montée du coach (boss) et la récompense d'élite.

### Le coach qui grandit à l'expérience (tranche 5)

- `XP`, `SEUILS_NIVEAU`, `TALENT`, `TALENT_CASE`, `aLaCaseDePlus` → la montée à chaque boss battu, 1 pièce parmi 3 (*piecesOffertes*).
- `POUVOIRS` → refaits en pièces de banc dans *PIECES* (leur condition, leurs canaux, leur réplique passent ; leur ouverture par niveau part).

### La main d'adjoints (tranche 5)

- `ADJOINTS` → refaits en pièces de banc dans *PIECES* (le style, le signal, le relais, la réplique passent).
- `SEJOUR`, `SEJOUR_SYNERGIE`, `REPOS`, `finirSejours` → rien : une pièce reste jusqu'à ce que tu la remplaces.
- `MAIN_MAX`, `quiPartDeLaMain` → rien : il n'y a plus de main.
- `CASES_PAR_NIVEAU`, `casesDuNiveau`, `CASE_DE_PLUS`, `casesDuPerso` → *CASES_DU_BANC* (5).
- `SALAIRE_NIV`, `salaireDe`, `salairesDesAdjoints` → rien : plus de salaire.
- `adjointsOfferts`, `momentFort`, `PALIERS_PACK` → *piecesOffertes* aux boss battus, aux élites, aux fourches.

### La main du deck (tranche 5)

- `mainDuDeck`, `PALIERS_CARTES`, `SORTES_DECK`, `NIVEAU_SORTE` → des pièces de banc (la recrue, le rôle, l'atelier deviennent des pièces ou des cartes rares de la banque, § 11.5).

### Le plan du soir et les micro-plans du duel (tranche 6)

- `poserLesPlans`, `ouvrirPlan` → rien sur un soir ordinaire : ce qu'un plan faisait est une pièce de banc.
- `propositionsDuDuel`, `voixDuBanc` → le plan fort d'avant-match (*plansDuDuel*), un seul choix.

### Les histoires tirées chaque lundi (tranche 8)

- `lundiAHistoire`, `CHANCE_HISTOIRE`, `DISETTE_MAX` → le rythme fixe des fourches (*SEMAINES_ENTRE_FOURCHES*, 2 ou 3) ; les autres histoires vont aux nouvelles d'Hier soir.

### Les déblocages de force (tranche 9)

- `plafondDuVestiaire` → rien : le plafond d'une run ne s'achète plus.
- `PAGES_DU_CLASSEUR`, `CASES_DE_LA_DERNIERE`, `gardesDeLaDerniere` → rien : ni pages de force, ni Piliers gardés.
- `CRANS_DE_PACK`, `monteeDesPacks` → les pochettes s'ouvrent comme variété (*packsOuverts*, qui reste), elles ne montent plus en force.
- Les clés `caisse1`, `caisse2`, `plafond1`, `plafond2`, `garder1`, `garder2`, `garder3`, `classeur1`, `classeur2`, `classeur3`, `classeur4` des déblocages (des clés de données, écrites entre guillemets dans js/rogue.js : `check_refonte` les cherche aussi) ; les commanditaires (aucune déclaration à ce nom dans js/ le 7 nov. : leur nom dans le code se trouve à la tranche 9, avant d'entrer dans son extrait).

**Le compte** : **66 noms** en `code` ci-dessus, dont 55 fonctions et constantes et 11 clés de déblocage. Trois sont courts (`XP`, `REPOS`, `TALENT`) : la tranche 5 vérifie qu'aucun texte d'écran ne les contient en mot entier avant de les mettre dans son extrait.

## 8b. Ce qui reste, et pourquoi

**À vérifier à sa tranche avant de l'ajouter à « Ce qui part »** (écrit ici en italique pour que `check_refonte` ne le compte pas encore) : *periodesDuDuel* (js/sim.js : les plans période par période ?), *planEnChiffres* (js/impact.js : lu aussi par le duel ?), *niveauOffert* (le niveau d'une pièce offerte, peut-être gardé), *reservesDeLaRun* et les clés *banc1*, *banc2* (les réserves de l'alignement : une force ?), *jetonsDeDepart* (garde sa base, perd la caisse).

**Reste, et pourquoi** :

- **Le moteur calibré** : `jouerEnPeriodes`, les greffes (`brancherGreffes`), `teamStrength`, `profilMatch`, le hasard, la ligue au jour le jour — JP : *le moteur calibré ne bouge pas* ; la V27 ne touche aucune cote.
- **Les vrais joueurs, le repêchage dans de vrais vestiaires** : `bouchesTrousDuDepart` (sa bande change, pas sa règle), `departDuClasseur`, `lotoDeCase`, `vestiaire` du départ — JP.
- **Le duel vécu en direct** : `INTENTIONS`, `FORCE_DUEL`, `MISE_DOUBLEE`, les trois périodes vues, leur coach en séries (`persoAdverse`, `OMBRE`) — JP : *le gros match vécu en direct*.
- **Le relais** : `effetDuRelais`, `RELAIS_NIV`, la chaîne de deux maillons — décision 7 : le moteur des combos.
- **La règle du coach** : `REGLES_DU_COACH`, `primesDuCoach`, `PRIME_COACH_MAX` — décision 7.
- **L'entraîneur au loto** : `lotoDesCoachs`, `coachAuCartable`, la philosophie lue des vraies stats — décision 7 et la variété de la méta.
- **La grammaire d'effet et la carte de jeu** : js/effets.js, `motsDe`, `carteHtml`, la pochette — V25, ce qui tient.
- **Les histoires vraies** : `HISTOIRES`, `tirer`, `faitsDe`, les voix (`EXPEDITEURS`), la promesse et son verdict, `memoireDeLaRun` — JP : *les histoires vraies qui nomment le joueur*.
- **Les cartes de hockey** : `cartonHtml`, `carteCouchee`, `dosDeCarton`, les 55 séries, `EDITIONS` — JP, deux fois.
- **L'économie à une caisse** : `jetonsDe`, `baremeRogue`, `prixAuAchat`, `BOUTIQUE`, la banque et `RARE_DU_PACK` — recomptée des décisions, lisible.
- **Les exigences** : `EXIGENCES`, `exigencesDe` — décision 10 ; leurs crans changent de leviers.
- **Les galons** et le panthéon — ils comptent ce qu'un joueur a fait chez toi, une run ou plusieurs.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| `ACTES` | 27 · 54 · 82 | ± 3 matchs par borne | un acte de moins de 22 matchs n'a pas de méso-boucle ; de plus de 32, l'arrêt naturel s'éloigne |
| `RANGS_DES_BOSS` | 7 · 3 · 0 | [12, 6, 2] à [3, 1, 0] (essayés : `att-bossdoux`, `att-bossdur`) | trop bas, le boss n'est pas un pic ; trop haut à l'acte I, l'équipe du départ ne peut pas gagner |
| `CONTROLES` | 20 · 12 · 16 | 18-24 · 10-16 · 16 | mesuré au tour 3 : l'attentif meurt 1 fois sur 16 (acte III), le premier robot 6 ; avec 2 ❤️, il mourrait à l'acte II (R1) |
| `COEURS` | 3 | 2-4 | à 1, un soir raté finit la run ; à 5, les cœurs ne font plus peur |
| `RENFORT_PAR_ACTE` | 2 étapes | 1-3 | à 0, placer est gratuit et dominant ; à 3 (essayé), placer ne vaut plus rien |
| `ETAPE_SERIES` | 3 étapes | 2-4 | à 0, les séries sont plus faciles que l'acte III |
| `ETAPES_DES_ACTES` | 0 · 0 · 0 | 0-2 par acte | à trancher par la mesure (11.7) |
| `NOEUDS_BOUTIQUE` | 0 · 14 · 27 · 41 · 54 · 68 | 4 à 8 nœuds | 3 nœuds (essayé) : l'équipe ne grandit pas assez ; chaque matin (essayé) : la boutique redevient une corvée |
| Le prix au nœud | remis à zéro | — | sans remise, l'équipe ne grandit pas aux actes II et III (mesuré) |
| `BANDE_DEPART` | 0,35 · 0,55 | 0,25-0,45 · 0,45-0,65 | à 0,05-0,25, l'équipe part au 31e rang et l'acte I tue ; au-dessus, la run 1 se gagne |
| `CASES_DU_BANC` | 5 | 4-6 | à 3, aucun combo ; à 7, tout se lit à la fois |
| `PIECES_OFFERTES` | 3 | 2-4 | — |
| `SEMAINES_ENTRE_FOURCHES` | 2 ou 3 (tiré) | 2-4 | à 1, on revient à 175 décisions ; à 4, une saison n'a que six fourches |
| La récompense d'élite | à trancher (11.4) | — | trop forte, l'élite est obligatoire ; trop faible, personne ne risque un cœur |

## 10. Les critères d'acceptation, et ce que deviennent les juges

- [ ] **Le juge neuf de la profondeur** : le prototype repris comme robot du dépôt (`scripts/lib/rogue_actes.mjs`), sur 16 graines de la vraie première run avec les mêmes dés : l'attentif gagne 1 à 4 Coupes sur 16, « premier » et le naïf au plus 1 ; l'attentif fait 5 à 9 victoires de plus en paires et au moins deux fois plus de rondes de séries — `check_profondeur` (réécrit ; son critère d'avant, « la première Coupe de l'attentif deux runs avant le robot d'avant », part avec les runs de plusieurs saisons). La campagne tourne en CI, jamais sur le PC de JP.
- [ ] **La run** : quatre actes aux bornes `ACTES`, un boss par acte au bon rang de force, jamais manquant, 82 matchs à chaque club et un match par jour après l'échange ; un cœur perdu à chaque contrôle raté et à chaque élite perdue, aucun pour un boss perdu ; la run finit à 0 ❤️ — `check_rogue` (réécrit : ses blocs « deuxième saison », « mandat » et « gardés » partent).
- [ ] **Le calendrier placé** : un club repoussé monte de `RENFORT_PAR_ACTE` étapes par acte de recul ; placer vaut à peu près zéro en moyenne (−1 à +1 V sur 16 graines) et aide dans au moins une graine sur quatre — `check_rogue`, `check_profondeur` (une variante placée).
- [ ] **La boutique** : elle n'ouvre qu'à ses six nœuds ; le premier pack d'un nœud coûte le prix de base — `check_rogue`, `check_packs` (la revente sous 40 % du prix reste).
- [ ] **Le départ** : l'équipe du départ médiane entre le 24e et le 28e rang de force sur 16 graines — `check_rogue`.
- [ ] **Le banc** : cinq cases, aucun séjour, repos ni salaire ; chaque pièce se voit dans la feuille du soir où elle joue et n'est jamais un piège (jamais sous −0,5 V en paires sur un acte) ; la borne haute par carte n'existe plus ; le relais rend 1,2 à 1,6 fois la somme d'une paire — `check_pouvoirs` (devient le juge des pièces : ses bornes de 2,5 V, 4 V et 16 V partent), `check_relais`, `check_banc` (le salaire part), `check_moments_si`.
- [ ] **La courbe** : le rang de force médian de l'attentif dans le top 16 à la fin de l'acte II et dans le top 8 à la fin de l'acte III — `check_profondeur`.
- [ ] **Le robot « premier »** ne gagne pas la Coupe (au plus 1 sur 16) — `check_robot` (sa campagne passe sur le robot des actes).
- [ ] **Le duel** : un seul choix avant le match et la mise de la 3e ; deux clubs égaux, le meilleur plan fort contre « Ton match » : un avantage net, sous 60 % en face à face ; aucun plan ne domine contre les cinq intentions (chacun est le meilleur contre au moins une) — `check_duel` (réécrit : les propositions par période partent).
- [ ] **Les élites** : proposées au plus une fois par semaine, jamais la semaine du boss ni en séries ; mesurées sur le robot : l'attentif en prend et en gagne plus de la moitié ; le gain net d'une élite prise par l'attentif est positif sur la run — `check_elites` (neuf), `check_profondeur`.
- [ ] **Les histoires** : 9 à 13 fourches par saison, aucun trou de plus de trois semaines ; au plus 20 % des fourches à moins de 0,1 V entre leurs réponses ; les autres sortent en nouvelles d'Hier soir avec leur voix et leur fait — `mesure_rythme` (cible neuve), `check_histoires`, `check_effets` (l'écart des fourches).
- [ ] **Les décisions** (information) : le compte par saison et la part de vrais choix — `mesure_decisions` (neuf, information, jamais rouge).
- [ ] **La méta** : aucun déblocage ne change la force d'une run (la première run avec tous les déblocages et sans aucun : même rang de force médian au départ, ±1) — `check_rogue`.
- [ ] **Les vieilles sauvegardes** : une partie de chaque forme d'avant (saison 1, saison 2+, en séries, au milieu d'un duel) s'ouvre sans erreur, verse ses 🏅 et commence une run neuve — `check_sauvegardes`.
- [ ] **Les écrans** : Hier soir en tête de Ce soir ; l'affiche à 240 px ; la plaque ouvre le Proprio ; le verso agrandi porte « Prendre », retourner une carte referme l'autre ; le rang une seule fois ; « Prendre » partout sous une carte de jeu — `check_plateau` (contrat réécrit), `check_hauteur`, `check_clarte`, `essai_rogue` (`CAPTURES_PAGES=1`).
- [ ] Les juges qui partent : `check_deck` et `mesure_deck` (la main du deck part ; ce qu'ils prouvaient de l'atelier reste à `check_atelier`).
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées — `check_refonte` (sur chaque tranche, avec son extrait `docs/refonte-v27-<n>.md`).
- [ ] Rien de mort — `check_mort`.
- [ ] À juger par JP à l'essai : le boss annoncé donne envie de bâtir vers lui ; perdre un cœur fait mal sans finir la soirée ; le banc de cinq fait des combos qu'on sent ; la run se joue en une soirée ou deux.

## Les tranches

Une petite PR chacune, dans l'ordre ; chacune livrable et prouvée seule ; chacune porte son extrait `docs/refonte-v27-<n>.md` (ce qui part dans cette tranche) pour `check_refonte`. Les campagnes lourdes tournent en CI, jamais sur le PC de JP.

1. **Le juge neuf** — le prototype (`jouerSaisonActes`, l'échange de cédule, les boss, les cœurs, le renfort, les nœuds, la bande du départ) devient `scripts/lib/rogue_actes.mjs`, le robot du dépôt, et `check_profondeur` le lit ; aucune ligne du jeu ne change. *Le joueur ne voit rien.* Juge : `check_profondeur` reproduit la cible (2 sur 16, 0, 0, +5 à +9 V) sur les graines du prototype, puis la remesure aux contrôles 20 · 12 · 16 (R1).
2. **Une saison, quatre actes, trois cœurs** — js/actes.js : les actes, les boss annoncés, les points de contrôle, les séries plus dures, le départ à 35-55 % ; les saisons de plus, le mandat, la marche et les gardés partent. *Le joueur voit l'acte et ses cœurs dans sa plaque, le boss sur l'affiche dès le premier soir, et la run finir à la Coupe ou à 0 ❤️.* Juge : `check_rogue` (réécrit), `check_profondeur`, `check_sauvegardes`, `essai_rogue`.
3. **La boutique à ses nœuds** — six ouvertures, le prix remis à zéro. *Le joueur voit la boutique fermée entre deux nœuds, avec la date du prochain, et ses packs moins chers à chaque ouverture.* Juge : `check_rogue`, `check_packs`, `check_profondeur`.
4. **Le calendrier placé et le renfort** — l'écran du calendrier de l'acte, l'échange, le renfort sur la case. *Le joueur choisit au premier soir de chaque acte qui il affronte quand, et voit ce que ça coûte.* Juge : `check_rogue` (82 matchs, un par jour, le renfort), `check_profondeur` (variante placée), `essai_rogue`.
5. **Le banc de cinq** — js/pieces.js : pouvoirs, adjoints et main du deck fondus en `PIECES` ; le coach et sa pièce de départ, la montée 1 parmi 3 au boss ; séjour, repos, salaire, main, expérience et talents partent. *Le joueur voit cinq cartes sur son banc, qui restent, et un choix de pièce après chaque boss battu.* Juge : `check_pouvoirs` (réécrit), `check_relais`, `check_banc`, `check_moments_si`, `check_profondeur`, `check_sauvegardes`.
6. **Le duel à un choix** — le plan fort d'avant-match et la mise de la 3e ; le plan du soir et les propositions par période partent. *Le joueur choisit une fois avant le boss, puis vit le match ; les soirs ordinaires n'ont plus de plan à régler.* Juge : `check_duel` (réécrit), `check_gros`, `essai_rogue`.
7. **Les élites** — la proposition du lundi, le duel, la récompense, le cœur perdu ; construites puis mesurées sur le robot. *Le joueur peut, certaines semaines, risquer un cœur contre un gros club pour une grosse récompense.* Juge : `check_elites` (neuf), `check_profondeur`.
8. **Les fourches** — une histoire aux 2 ou 3 semaines, de vraies fourches à prix en stats, les autres en nouvelles d'Hier soir. *Le joueur reçoit moins d'histoires, mais chacune est un vrai choix ; les autres se lisent dans Hier soir.* Juge : `mesure_rythme`, `check_histoires`, `check_effets`, `check_clarte`, `mesure_decisions` (neuf).
9. **La méta en variété et la Dynastie** — les déblocages de force partent ou deviennent de la variété, les exigences passent par les leviers neufs, la Dynastie après la Coupe. *Le joueur dépense ses 🏅 pour d'autres coachs, pièces, pochettes et époques, et peut continuer sa run gagnante.* Juge : `check_rogue` (aucun déblocage de force), `check_profondeur` (exigences), `check_sauvegardes`.
10. **Les écrans** — les douze décisions d'écran et la seconde moitié de l'interface (D1b) dans les écrans neufs : Hier soir en tête, la plaque qui ouvre le Proprio, le verso qui porte « Prendre », « La run continue » en moment fort. *Le joueur voit Ce soir commencer par hier, son rang une seule fois, et un seul verbe sous chaque carte.* Juge : maquettes à 390 × 844 tranchées par JP avant le code, `check_plateau`, `check_hauteur`, `check_clarte`, `essai_rogue` (`CAPTURES_PAGES=1`), `check_refonte` sur la somme, `check_mort`.

Les tranches 2 à 4 peuvent se livrer sans la 5 : le robot du dépôt (tranche 1) joue l'ancien banc tant que le neuf n'est pas là, comme le prototype.

## 11. Les questions qui restent ouvertes

1. **Les contrôles 20 · 12 · 16** ont été mesurés au tour 3 du prototype (l'attentif meurt 1 fois sur 16, à l'acte III), mais avec l'ancien banc : si la tranche 1 montre que l'attentif meurt trop souvent à l'acte II, on desserre les contrôles ou on garde la décision et on règle autre chose (les boss, la bande du départ) ?
2. **Le boss perdu** : sans cœur ni montée, il ne prive que d'une pièce ; est-ce assez pour qu'on le craigne ?
3. **Les cœurs regagnés** : jamais dans la run (proposé), ou un cœur pour une élite gagnée à 1 ❤️ ?
4. **La récompense d'une élite** : une pièce de banc parmi 3 d'un niveau au-dessus (proposé), des jetons, ou au choix ?
5. **Ce que devient la main du deck** : la recrue du cartable, le rôle et l'atelier deviennent des pièces de banc, des cartes rares de la banque, ou partent ? Et la boutique vend-elle des pièces de banc ?
6. **Chaque déblocage de force** : lequel devient une variété (et laquelle), lequel part ? Et `banc1`, `banc2` (les réserves) sont-ils de la force ?
7. **La courbe de la ligue par acte** : rester à 0 · 0 · 0 (mesuré) ou monter (0 · 1 · 2, essayé) ?
8. **Le compte des décisions** : la définition d'un « vrai choix » pour `mesure_decisions` (proposé : deux options à plus de 0,3 V en paires, ou deux formes de jeu différentes).
9. **La Dynastie** : une saison de plus, ou autant qu'on veut ? Les cœurs remis à 3 ?
10. **Le mot « boss »** à l'écran (vocabulaire.md l'avait écarté) : « boss », ou un mot de hockey (« le gros club de l'acte ») ?
