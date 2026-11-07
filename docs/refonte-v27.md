# V27 — Le Rogue en roguelike : une run, une saison, quatre actes

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec la commande `/refonte` (7 nov. 2026), puis **revu le même jour** : une revue adverse à quatre relecteurs (`/revue-design`) l'a jugé « À reprendre », et JP a tranché six points (§ 1, « Après la revue »). Cette version les applique partout. Le numéro : la V26 est réservée à « D2, les autres modes » (docs/refonte-v25.md § 4 D) ; celui-ci prend le suivant. **Rien n'est codé.** Ce qui reste à JP est au § 11.

La V25 (docs/refonte-v25.md) a fait la grammaire : un moteur pur et ses greffes, une carte de jeu, une grammaire d'effet, une banque d'histoires. La V27 garde cette grammaire et refait **la forme du jeu** : ce qu'est une run, ce qui la fait perdre, quand on décide, et combien de fois.

## 1. Ce que JP a dit, et ce qu'il a tranché

**Le constat de départ**, mesuré par trois rapports et trois tours de prototype (nov. 2026) :
- une saison du Rogue demande **environ 175 décisions, dont 20 à 25 vrais choix** ;
- **le plan du soir est dominé** : une option le vaut presque toujours ;
- **le duel vaut environ 0,5 victoire par saison pour 40 % du temps** de jeu ;
- **63 % des histoires ont deux réponses à moins de 0,1 V d'écart** ;
- le joueur gère **5 réserves** (les jetons, l'expérience du coach, la main d'adjoints, la main du deck, les médailles), **9 familles de pièces** et **une dizaine de minuteries** (séjours, repos, paliers, mains du deck, lundis d'histoire, annonces de gros match, promesses, situations, lancées, salaires).

Ce qui pèse des semaines d'avant : *le roguelike, il est pas facile à rendre le fun et balancé* (2 nov.) ; *première Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball* (7 nov.) ; *faut arrêter de juste changer la peinture* (4 nov.).

**Les décisions de JP, 7 nov. 2026, avant la revue** (telles que la revue les a laissées ; les six points d'après la revue les corrigent là où ils les touchent) :

1. **Une run = une saison**, en 4 actes : trois actes d'environ 27 matchs, chacun fini par un **rival** annoncé au premier soir de l'acte (le 8e club de la ligue en force, puis le 4e, puis le plus fort), puis **les séries comme 4e acte, plus dures** (chaque adversaire y monte de 3 étapes d'édition). Gagner, c'est la Coupe. Les rustines entre deux saisons partent.
2. **La vie : les ❤️ de confiance du proprio** (2, après la revue). On perd un cœur sur un point de contrôle raté ou sur une **élite ratée**. Un rival perdu ne coûte pas de cœur. À 0 ❤️, la run finit.
3. **Le calendrier** (JP : *calendrier réel pour toutes les équipes, mais tu choisis les équipes qui vont quand pour avoir duels plus tough aux bons endroits*) : la ligue garde sa vraie cédule ; tu places tes adversaires dans tes cases. **Son prix, le renfort** : un club que tu repousses plus tard monte d'étapes d'édition (mesuré : placer vaut à peu près zéro en moyenne, et aide dans 7 graines sur 16).
4. **Les élites** : un vrai match contre un club du haut, que tu choisis de jouer en duel ; grosse récompense, un cœur perdu si raté. À construire, et à mesurer (les prototypes ne l'ont pas modélisé).
5. **La boutique** : seulement à son nœud, et le prix des packs repart à zéro à chaque ouverture (mesuré : c'est ce qui fait grandir l'équipe aux actes II et III).
6. **Le départ** : les bouche-trous du départ pigés entre 35 % et 55 % de leur saison au lieu de 5 % à 25 % (l'équipe part vers le 26e rang de force).
7. **Le banc** : les pouvoirs du coach, les adjoints et la main du deck fondus en 5 cases permanentes pour la run, sans séjour, repos ni salaire ; le relais est le moteur des combos. Le coach garde sa philosophie, sa règle, une pièce de départ, et prend une pièce à chaque rival battu (1 parmi 3, ou passer).
8. **Les bornes** : plus de « ±1 victoire au plus par carte » ; une courbe de la ligue par acte, et un bon build peut casser le jeu à l'acte III.
9. **Le duel** : un seul choix lourd ; les micro-plans de période partent. **Le plan du soir** disparaît, fondu dans le banc. **Les histoires** : moins, une aux 2 ou 3 semaines, de vraies fourches avec un prix en stats ; les autres deviennent des nouvelles d'Hier soir sans choix ; la voix et le fait vrai restent.
10. **La méta** : de la variété plutôt que de la puissance (coachs, pièces de banc, packs, époques) ; les déblocages de force deviennent de la variété ou partent ; les exigences 🔺 font la difficulté.
11. **Les monnaies** : 🪙 dans la run, 🏅 entre les runs.
12. **Les écrans** (JP, le même jour, sur l'audit d'interface) : Hier soir en tête de Ce soir ; l'affiche garde 240 px ; le Proprio s'ouvre en touchant ta plaque ; on retourne les cartes, mais le verso agrandi porte son « Prendre » et retourner une carte referme l'autre ; le fait sous la réplique d'une histoire dit seulement ce qu'elle tait ; « La run continue » devient un moment fort ; ton rang une seule fois, dans ta plaque ; le verbe sous une carte est « Prendre » partout. La seconde moitié de l'interface (D1b dans LIVRAISON.md) se fait dans ces écrans neufs.

**Après la revue, 7 nov. 2026 — JP a tranché :**

1. **2 ❤️, pas 3** (JP : *Passer à 2 ❤️*). Rater le contrôle de l'acte I puis celui de l'acte II finit la run. Si la mesure montre que l'attentif meurt trop à l'acte II, on règle la bande du départ ou le rang des rivaux, **pas les cœurs**.
2. **La boutique vend des pièces de banc** : à chaque nœud, 1 pièce parmi 3 contre des jetons, à côté des packs ; les rivaux battus et les élites en donnent aussi (§ 4.6, § 4.8).
3. **Le duel : un seul choix avant le match, mais le rival montre son jeu dès son annonce** (son intention dominante et son style : tireurs, durs, gros gardien), et des pièces y répondent. **Aucune décision d'entracte** (§ 4.7).
4. **La livraison** : les maquettes de tous les écrans neufs à 390 × 844 d'abord (JP tranche), puis les tranches 2 à 6 se construisent sur une branche à part et sortent ensemble, mesurées ; **le jeu publié ne change qu'une fois** (« Les tranches »).
5. **La première Coupe jamais avant la 3e run** (JP : *Le jamais avant 3 est quand même bien*) : la règle tenue reste (§ 5, § 10).
6. **Le mot à l'écran : « rival »**, pas « boss » (JP : *rival*). Les rivaux du proprio partent dans ce devis ; le mot se libère pour le club qui finit un acte (§ 7, vocabulaire.md).

**Ce qui ne bouge pas** (JP) : les vrais joueurs et leurs vraies stats, le moteur calibré, le repêchage dans de vrais vestiaires, le gros match vécu en direct, les histoires vraies qui nomment le joueur, les cartes de hockey.

**La taille est décidée** : une refonte de la forme du Rogue. Ce devis ne la négocie pas à la baisse.

## 2. Ce que le joueur ressent

**Le fantasme** : « j'ai une saison pour gagner la Coupe avec une équipe de bouche-trous ; au début de chaque acte, je vois le rival qui m'attend au bout et comment il joue, je bâtis un banc qui s'emboîte, et je sais exactement ce que je risque : deux cœurs, pas un de plus. »

- **Le pic** : le rival de l'acte battu, et la pièce qui fait clic avec ton banc ; l'élite gagnée sur un cœur ; le build qui casse le jeu à l'acte III ; la Coupe. Le cœur perdu au point de contrôle doit faire mal, pas finir la soirée.
- **Le jour ordinaire** reste rapide : un soir sans choix se joue en un geste (Jour suivant), le banc s'allume tout seul ; aucun écran ne demande rien entre deux nœuds sauf ce qui presse.
- **Les boucles** (le modèle emboîté) :
  - la micro-boucle (30 s) : le soir joué, le banc qui s'allume, Hier soir qui le dit ;
  - la méso-boucle (5 à 15 min) : de nœud de boutique en nœud de boutique (≈ 14 matchs), avec une élite ou une fourche d'histoire entre deux ;
  - la macro-boucle : l'acte (≈ 27 matchs), qui finit par son rival et son point de contrôle — l'arrêt naturel et la raison de revenir ;
  - la run : une saison, quatre actes, deux cœurs ;
  - la carrière : la variété débloquée en 🏅, les exigences 🔺.

**Les esthétiques visées** (MDA) : le Défi (lire le rival, gérer ses cœurs), l'Expression (le banc qui s'emboîte), la Fantaisie (les vrais joueurs, le vrai coach), le Récit (les fourches vraies). **Les besoins** (SDT) : l'autonomie par le calendrier placé, les élites choisies et le banc ; la compétence par des rivaux annoncés et des contrôles chiffrés ; la relatedness par les voix et les joueurs nommés.

## 3. L'inventaire : ce qui existe aujourd'hui

Lu dans js/ le 7 nov. 2026, chaque nom vérifié par une recherche (les lignes exactes se comptent à la tranche 1, `wc -l`).

**La run sur plusieurs saisons et ses rustines** (js/rogue.js) : le mandat du proprio (`MANDATS`, `mandatDe`, `MANDAT_DE_LA_PREMIERE`, `rangDuMandat`, `mandatRempli`, qui lit la taille de la ligue, `nEquipes`) ; la marche de la deuxième saison (`ETAPE_APRES_LA_PREMIERE`, `etapeDeLaRun`) ; entre deux saisons, le loto du cartable et les gardés (`LOTOS_DE_SAISON`, `lotosDeSaison`, `GARDES_DE_SAISON`, `gardesDeLaRun`) ; le départ (`bouchesTrousDuDepart`, `departDuClasseur`, `lotoDeCase`, `budgetDuClasseur`, `PAGES_DU_CLASSEUR`, `CASES_DE_LA_DERNIERE`, `gardesDeLaDerniere`).

**Le coach et sa croissance** (js/pouvoirs.js) : l'expérience (`XP`, `SEUILS_NIVEAU` 0 · 25 · 70 · 140 · 240), les talents (`TALENT`, `TALENT_CASE`, `aLaCaseDePlus`), les trois `POUVOIRS` ouverts aux niveaux 1, 3, 5. Son entraîneur a un niveau et une maîtrise (`niveauDuCoach`, js/coachs-reels.js ; `MAITRISE`, js/niveaux.js).

**La main d'adjoints** (js/adjoints.js, js/greffes.js, js/rogue.js) : `ADJOINTS`, le séjour et le repos (`SEJOUR` 12, `SEJOUR_SYNERGIE` 16, `REPOS` 20, `finirSejours`), la main (`MAIN_MAX` 4, `quiPartDeLaMain`), les cases (`CASES_PAR_NIVEAU`, `casesDuNiveau`, `CASE_DE_PLUS`, `casesDuPerso`), le salaire (`SALAIRE_NIV`, `salaireDe`, `salairesDesAdjoints`), les offres et leur niveau (`adjointsOfferts`, `niveauOffert`, `momentFort`, `FORCE_NIV`, `PRIX_NIV`, `NIV_DEFAUT`, `PALIERS_PACK` 10 · 30 · 50 · 70), le relais (`effetDuRelais`, `RELAIS_NIV`). **Sa présence réelle** : un adjoint joue 12 matchs puis se repose 20, soit 12 soirs sur 32 (37,5 %) ; une pièce permanente au même écart jouerait 32 soirs sur 32, **≈ 2,7 fois** plus (§ 4.6).

**La main du deck** (js/sim.js, js/saison.js, js/rogue.js, js/banc.js) : `mainDuDeck`, `PALIERS_CARTES` 20 · 40 · 60, `SORTES_DECK`, `NIVEAU_SORTE` ; la recrue qui monte (`cranDeLaRecrue`, `niveauxDeLaRecrue`, `NIVEAUX_RECRUE`).

**Le plan du soir et le duel** (js/greffes.js, js/impact.js, js/saison.js, js/sim.js) : `PLANS` (six plans), `poserLesPlans` (le plan posé sur un soir ordinaire), `ouvrirPlan` (son écran), `planEnChiffres` ; au duel, les propositions du banc période par période (`propositionsDuDuel`, `voixDuBanc`), `INTENTIONS`, `FORCE_DUEL`, la mise doublée (`MISE_DOUBLEE` 2 : gagné, le butin double ; perdu, les sonnés durent deux fois plus), l'élan et les sonnés (`ELAN`, `SONNE` : finition ×1,03 ou ×0,97, 3 matchs).

**Les gros matchs** (js/sim.js) : les rivaux choisis au proprio (`RIVAUX` 3, `RIVAUX_OFFERTS` 5, `rivauxOfferts`, `rivalChoisi`, `BUTIN_RIVAL`), les raisons d'un gros match (`MINI_BOSS` : rival au classement, bête noire, rival choisi), l'annonce (`annoncerGros`, `grosMatchAvant`, `ESPACEMENT_GROS`, `ANNONCE_GROS`), le butin (`BUTIN_DU_GROS` 15 🪙 ou 4 d'expérience, js/rogue.js). Le moment « Contre un rival » (`MOMENTS_SI`, `rival`) lit `rivalChoisi`.

**La boutique et ses prix** (js/rogue.js, js/packs.js) : `BOUTIQUE` (huit pochettes : Bronze 14 🪙, Argent 22, Or 38, Époque 26, Spécialistes 28, Club 28, du coach 30, Vedettes 70), la hausse (`hausseDesPacks`, `HAUSSE_PACK` 0,40 : chaque pack acheté dans la saison fait monter les suivants de 40 % de leur prix), le pack d'une série gagnée (`packDeSerie`). Le barème (`JETONS`, `baremeRogue`) : 5 🪙 la victoire (8 et 10 avec les commanditaires), 4 la défaite en prolongation, 2 la défaite ; 40 au départ (`jetonsDeDepart`, +20 et +40 avec la caisse) ; la règle du coach (`PRIME_COACH_MAX` 50 par saison) ; la prime de série (`JETONS.serie` 40).

**La méta** (js/rogue.js) : `DEBLOCAGES` — de force : `caisse1`, `caisse2`, `commanditaire1`, `commanditaire2`, `plafond1`, `plafond2`, `garder1` à `garder3`, `classeur1` à `classeur4`, `classeurTri`, `banc1`, `banc2` (les réserves, `reservesDeLaRun`), `recrue1`, `recrue2`, `plombiersPlus`, `packVedettes`, les crans de pack (`CRANS_DE_PACK`, `monteeDesPacks`, `cleDeCran`) ; de variété : `packDefenseurs`, `packGardiens`, `packAnnees80` ; `plafondDuVestiaire`. **Le prestige** (`PRESTIGES`, cinq rangs, du Club de garage à la Dynastie) : il multiplie les taux d'Étoiles et de Phénomènes des packs, ajoute au budget du classeur, ouvre des coachs (`coachsOuverts`, 3 à 8) et monte le niveau de la ligue (`niveauDeLigue`). **Les jalons** (`JALONS`, treize) : trois sont impossibles dans une run d'une saison (`deuxSaisons`, `troisSaisons` ; `coachIII`, le coach au sommet, qui ouvre le Pack du coach), et cinq paient un déblocage de force (`classeur1`, `banc1`, `classeurTri`, `plafond1`, `classeur4`). **Les exigences** (`EXIGENCES`, huit crans, `exigencesDe`) : la ceinture, les agents, le classeur fermé, l'effectif mince, les commanditaires boudent, le proprio impatient, ceux qui partent, la ceinture serrée.

**Les histoires** (js/histoires.js) : quarante, trois moments, le lundi tiré (`lundiAHistoire`, `CHANCE_HISTOIRE` 0,55, `DISETTE_MAX` 3, `SORTIES_MAX`, `REPOS_HISTOIRE`).

**La plaque** (js/saison.js) : la bande de la run sur Ce soir est le bouton `bu-run` (« Le proprio », le rang sur la cible, la jauge) ; elle ouvre déjà le Proprio.

**Le prototype** (scratchpad du 7 nov., `proto-actes/sim_copie.mjs`, une copie de `scripts/lib/rogue_sim.mjs` hors du jeu) : il a ajouté `jouerSaisonActes` et ce qui la sert, et rien changé au moteur. Ce qu'il fait, exactement :
- **les actes** : `actes` [27, 54, 82] (tes matchs joués) ; `actDe` range chaque match dans son acte ;
- **les rivaux de l'acte** (son `bossRang` [7, 3, 0]) : le rang de force (attaque + défense + gardien, `teamStrength`) parmi les 31 adversaires ; le dernier match de chaque acte est échangé (`echanger`, qui garde 82 matchs à chacun et un match par jour, `peut`) pour mettre le rival dans cette case ; **seuls les rivaux sont des duels** (`grosAnnonces` posé sur les trois fins d'acte), le reste des soirs ordinaires ;
- **les cœurs** : `coeurs` **3** ; à la fin d'un acte, un cœur de moins si le rang au classement passe le contrôle (`controles`, [24, 16, 16] par défaut, relus à 20 · 12 · séries au tour 3) ;
- **la montée du coach** : un rival battu donne au coach l'expérience jusqu'à son prochain `SEUILS_NIVEAU` (`xpBoss`) — **une approximation** de « 1 pièce parmi 3 » ;
- **le calendrier placé** : `placer` (`reel`, `croissant`, `decroissant`, `jambes`) ; le renfort (`renfort` 2) : `habillerLaLigue` monte d'arrondi(renfort × recul moyen en actes) étapes un club repoussé ;
- **la boutique** : `noeuds` [0, 14, 27, 41, 54, 68], **`achatsParNoeud` 4**, `prixReset` à `true` ;
- **les séries plus dures** : `etapeSeries` 3 ;
- **le départ** : `reglerDepart({ bande: [0.35, 0.55] })` et `bouchesTrousBande` ;
- **ce qu'il gardait de l'ancien jeu** (et qui part dans ce devis) : le plan du soir (`planDuRobot`), les adjoints à séjours et à salaire, la main du deck, le coach à l'expérience, les plans par période au duel, le butin des rivaux du proprio, les histoires telles quelles (`lundiDuRobot`, `rondeDuRobot`) ; et **aucune élite**, aucune pièce en boutique.

**La mesure qu'il a rendue** (`t4_s3.jsonl` : 16 graines, la vraie première run, `META=0`, les mêmes dés pour chaque robot) : **l'attentif gagne la Coupe 2 fois sur 16 (13 %), le robot « premier » et le naïf aucune** ; l'attentif fait **5 à 9 victoires de plus** en paires et **trois fois plus de rondes de séries**. **Elle a été prise sur l'ancien jeu** (ci-dessus) avec 3 ❤️ : c'est le risque R1 (§ 5).

## 4. Les règles du jeu : la run neuve, au complet

Ces règles se lisent seules ; elles ne sont pas un diff des règles d'avant.

### 4.1 La run

- Une run est **une saison de 82 matchs et ses séries**. Il n'y a pas de deuxième saison dans ce devis : la Coupe gagnée ou la run perdue, c'est la fin, et on revient au départ (la méta, § 4.9). Une saison de plus après la Coupe (la Dynastie) est une question ouverte à JP (§ 11.1) ; tant qu'il ne l'a pas écrite, elle n'existe pas.
- La saison se coupe en **quatre actes** : l'acte I (tes matchs 1 à 27), l'acte II (28 à 54), l'acte III (55 à 82), les séries (l'acte IV).
- La ligue joue sa vraie cédule, au jour le jour, comme aujourd'hui (moteur.md : rien d'avance).

### 4.2 Les cœurs et les points de contrôle

- Le proprio te donne **2 ❤️** au départ ; ils ne remontent jamais dans la run.
- **À la fin de chaque acte**, après le match du rival, le classement du soir est lu, **tel que l'écran Classement le montre** (ses bris d'égalité compris : le contrôle ne recalcule rien) :
  - acte I : 20e ou mieux, sinon −1 ❤️ ;
  - acte II : 12e ou mieux, sinon −1 ❤️ ;
  - acte III : une place en séries, sinon **la run finit** (sans séries, pas d'acte IV), quels que soient les cœurs.
- **Les contrôles suivent la taille de la ligue** : dans une ligue de `n` clubs, le rang à tenir est `arrondi(C × n / 32)` (20 · 12 dans une ligue de 32 ; 15 · 9 dans une de 24) et l'acte III demande une place en séries de cette ligue. Le code d'aujourd'hui lit déjà la taille de la ligue (`rangDuMandat`, `nEquipes`), mais il coupe au minimum ; la V27 passe à la proportion.
- **Une élite perdue** : −1 ❤️ (§ 4.5).
- **Un rival perdu** ne coûte aucun cœur (§ 4.3).
- **À 0 ❤️**, la run finit le soir même : l'écran de fin, les 🏅 de ce qui a été fait. Avec 2 ❤️ : rater l'acte I puis l'acte II finit la run à la fin de l'acte II ; une élite perdue plus un contrôle raté aussi.
- En séries, aucun cœur ne se perd : une série perdue finit la run.

### 4.3 Les rivaux

- Chaque acte a son rival, **annoncé au premier soir de l'acte, un par acte** (jamais les trois au départ) : à l'acte I le 8e club de la ligue en force, à l'acte II le 4e, à l'acte III le plus fort (la force : attaque + défense + gardien, lue au premier soir de la saison sur `teamStrength` ; le rang suit la taille de la ligue comme les contrôles). Il est le **dernier match de l'acte**, posé là par un échange de cédule qui garde à chaque club ses 82 matchs et un match par jour (ce que fait `echanger` dans le prototype).
- **Il montre son jeu dès son annonce** (décision 3 d'après la revue) : son **intention dominante** (celle des cinq `INTENTIONS` qu'il annonce le plus souvent, fixée à l'annonce de la graine et de son style) et son **style** en un mot lu dans ses vraies stats : des **tireurs** (ses tirs par match), des **durs** (ses mises en échec et ses punitions), un **gros gardien** (son % d'arrêts). Des pièces de banc y répondent (leur moment « Contre un rival qui tire », « Contre leur gros gardien »… : un moment rare, au sens de vocabulaire.md), et tu as un acte pour les trouver.
- Le rival est un **duel** (§ 4.7), le seul gros match obligatoire de l'acte.
- **Gagné** : 1 pièce de banc parmi 3, ou passer (§ 4.6), l'élan (`ELAN`, 3 matchs) et 15 🏅. **Aucun jeton** : un rival paie en pièce et en médailles, l'élite en jetons (§ 4.5).
- **Perdu** : aucun cœur ; les sonnés (`SONNE`, la finition ×0,97, 3 matchs) et rien d'autre.
- **Son club se place comme les autres** : ses autres matchs contre toi se déplacent et portent le renfort (§ 4.4) ; le match du rival, lui, ne bouge pas.

### 4.4 Le calendrier placé et le renfort

- **Au premier soir de chaque acte**, après l'annonce du rival, l'écran du calendrier de l'acte s'ouvre de la boîte (une ligne qui bloque « Jour suivant », rien ne s'ouvre seul) : tes cases de l'acte, chacune avec son adversaire de la vraie cédule. Tu peux **échanger deux adversaires** entre deux de tes cases, dans l'acte ou vers un acte plus loin ; le match du rival ne bouge pas. L'écran ne montre que les clubs échangeables (ceux dont l'échange garde 82 matchs et un par jour) ; échanger, c'est **deux touchers** (la case, puis l'autre).
- **L'échange touche d'autres clubs** : pour garder à chacun 82 matchs et un match par jour, `echanger` déplace aussi les matchs des deux adversaires ces jours-là, donc l'adversaire de certains autres clubs change. Chaque club garde ses 82 matchs, un par jour ; le reste de la cédule ne bouge pas.
- **Le renfort** : chaque match d'un club que tu as reculé lui vaut **+1 étape d'édition par acte de recul**, sans arrondi, **toujours compté depuis la cédule d'origine** (reculer, puis ramener, ne coûte rien ; reculer deux fois ne compte pas deux fois). Les étapes d'un club sont la somme sur tous ses matchs contre toi. **Dans un même acte**, un match reculé au-delà du nœud de boutique du milieu de l'acte (le 14e, le 41e, le 68e) compte +1 étape aussi ; avant ce nœud, l'ordre est gratuit.
- **Le renfort habille le club** (`habillerLaLigue`) pour toute la saison qui reste, contre toi **et contre les autres** : le classement des autres en bouge un peu (`check_profondeur` le mesure : placer ne doit pas devenir un moyen d'affaiblir tes voisins au classement, § 10).
- **En séries**, le renfort reste et s'ajoute aux étapes des séries (`ETAPE_SERIES`) : un club renforcé que tu retrouves en séries porte les deux, jusqu'à l'Holo au plus (`editionDansLaLigue`).
- L'écran le dit sur la case avant que tu valides (« Boston +2 ✦ »), et **le « +2 ✦ » suit le club** : à l'affiche, au Calendrier et au Face à face, tant que la saison dure.
- On peut ne rien placer : la vraie cédule, gratuite. Une fois l'acte commencé, il ne bouge plus.

Exemple fait à la main : Boston joue contre toi aux matchs 5 (acte I), 33 (acte II) et 70 (acte III). Tu mets le match 5 au 60 (acte III, +2) et le 33 au 40 (même acte, avant le nœud du 41e, 0) : Boston porte +2 étapes. Puis tu ramènes le 60 au 20 (acte I, après le nœud du 14e, +1 au lieu de +2) : Boston porte +1 étape — compté depuis la cédule d'origine, pas depuis le premier placement.

### 4.5 Les élites

- **Au plus une par acte** : le lundi, si ta semaine a un match contre un club **du top 8 en force**, l'écran peut proposer d'en faire une **élite** — un duel (§ 4.7) contre lui. **Jamais la semaine du rival, jamais en séries.**
- La proposition est une ligne de la boîte, le lundi ; **sans réponse, c'est un soir ordinaire**. Prise, l'affiche du soir dit « Élite ».
- **Gagnée** : **1 pièce de banc parmi 3**, ou passer, **et des jetons** qui montent avec la force du club battu : `J = arrondi(V_COEUR × (1 − p) / p) − PRIX_PIECE`, borné à [10, 90], avec `p` la chance que le pronostic du jour (`pronostic`, js/pronostic.js) te donne, bornée à [0,25, 0,55], et `V_COEUR` 60 🪙 (la valeur d'un cœur en jetons, le revenu d'un nœud ; un réglage, § 9). La règle : `p × récompense ≥ (1 − p) × V_COEUR`, la pièce comptée à son prix en boutique. Exemple fait : contre le 3e club en force, le pronostic dit 38 % ; `60 × 0,62 / 0,38 = 97,9`, moins 32 : **66 🪙 et une pièce parmi 3**. Contre le 8e, 52 % : `60 × 0,48 / 0,52 = 55,4`, moins 32 : **23 🪙 et une pièce**.
- **Perdue** (en temps réglementaire, en prolongation ou en fusillade) : −1 ❤️ et les sonnés (3 matchs).
- À 1 ❤️, elle est proposée avec un avertissement (« Ton dernier cœur ») ; la prendre est un choix.
- Les pièces n'ont pas de niveau (§ 4.6) : l'élite ne donne pas « un niveau au-dessus », elle donne une pièce **et** des jetons.
- **Mesurée en paires** : le robot qui prend chaque élite contre celui qui les refuse, les mêmes dés ; on juge le gain en Coupes et en morts, pas le taux de victoires (§ 10).

### 4.6 Le banc : cinq cases pour la run

- Le banc a **5 cases**, permanentes pour toute la run. Une **pièce de banc** est une carte de jeu (`carteHtml`) de la grammaire d'effet (js/effets.js) : un pouvoir du coach, un adjoint ou une idée de l'ancien plan du soir, réécrits en une seule famille, *PIECES* (js/pieces.js). Chacune garde ce qui faisait son jeu : sa condition (`quand`, lue période par période), ses canaux, son prix, sa réplique (`dit`), son **relais** (le moteur des combos : une pièce qui se lit relaie le canal d'une autre, deux maillons au plus, `effetDuRelais`, `RELAIS_NIV`).
- **Aucun séjour, aucun repos, aucun salaire, aucune main, aucun niveau** : une pièce posée joue chaque soir où sa condition se lit, jusqu'à ce que tu la remplaces. Le coach garde son niveau et sa maîtrise (`MAITRISE`, ×0,9 à ×1,3), qui règlent sa seule pièce de départ.
- **La force d'une pièce, ramenée à sa présence réelle** : un adjoint d'aujourd'hui joue 37,5 % des soirs (12 sur 32) ; posée pour la run au même écart, une pièce vaudrait ≈ 2,7 fois plus. Chaque pièce garde donc **son écart d'un soir** (pour qu'elle se voie, rogue.md) mais sa condition est réglée pour qu'elle joue **30 à 50 % des soirs** ; sur un acte, son net en paires est celui d'un adjoint d'aujourd'hui sur la même durée (× 1, pas × 2,7). Une pièce qui jouerait chaque soir voit son écart ramené d'autant.
- **Le plan du soir n'existe plus** : ce que les plans faisaient sur un soir ordinaire (tirer, coller, fermer, forechecker, rester discipliné) devient des pièces de banc.
- **Le coach** : au départ, tu tires ton entraîneur au loto comme aujourd'hui (`lotoDesCoachs`) ; il garde sa **philosophie**, sa **règle** (`REGLES_DU_COACH`, les 🪙 du soir où ton club joue son hockey) et apporte **une pièce de départ** posée dans la première case. Il n'a plus d'expérience à gagner en jouant.
- **D'où viennent les pièces** :
  - un rival battu : 1 parmi 3, tirée de la graine dans les pièces de sa philosophie et des voisines, ou passer ;
  - une élite gagnée : 1 parmi 3, ou passer (avec ses jetons) ;
  - la boutique : 1 parmi 3 à chaque nœud, contre des jetons (§ 4.8) ;
  - une fourche d'histoire : **au plus une pièce par fourche, au plus deux par saison**.
- **Banc plein** : tu choisis d'abord la pièce neuve, puis celle qui sort ; l'écran confirme « X part ». « Passer » est toujours là.

### 4.7 Le duel

- Le duel (le rival, l'élite, chaque match de séries vu en direct) garde ses trois périodes vues et les intentions de l'adversaire (`INTENTIONS`).
- **Un seul choix, avant le match** : **un plan fort**, parmi deux ou trois que ton banc propose (chacun tiré d'une pièce posée ou de la philosophie du coach), chacun avec un **vrai prix** en stats de match (tirs, % au tir, tirs contre, % d'arrêts, punitions), ou « Ton match ». Ce que le rival a montré à son annonce (son intention dominante, son style) est sur l'écran du choix.
- **La mise**, posée sur le même écran, avant le match (décision 3 : aucune décision d'entracte) : elle double ce que le duel rapporte et ce qu'il coûte, **jamais les cœurs**. Le bouton dit le prix exact. Pour chaque duel :

| Duel | Gagné, sans mise | Gagné, misé | Perdu, sans mise | Perdu, misé |
|---|---|---|---|---|
| Le rival | 1 pièce parmi 3, l'élan 3 matchs, 15 🏅 | 2 pièces (deux offres de 1 parmi 3), l'élan 6 matchs, 30 🏅 | les sonnés 3 matchs | les sonnés 6 matchs |
| L'élite | 1 pièce parmi 3 et `J` 🪙, l'élan 3 matchs | 1 pièce et 2 × `J` 🪙, l'élan 6 matchs | −1 ❤️, les sonnés 3 matchs | −1 ❤️ (jamais 2), les sonnés 6 matchs |
| Un match de séries | l'élan 3 matchs | l'élan 6 matchs | les sonnés 3 matchs | les sonnés 6 matchs |

  Exemple du bouton, au rival de l'acte II : « Miser : gagné, 2 pièces et 30 🏅 ; perdu, sonnés 6 matchs ».
- **Plus rien entre les périodes** : les propositions de l'adjoint à chaque entracte partent. L'entracte montre le pointage, leur intention qui vient, et un seul bouton.

### 4.8 La boutique et les monnaies

- **🪙 jetons dans la run, 🏅 médailles entre les runs.** Aucune autre réserve : l'expérience du coach, la main d'adjoints et la main du deck partent.
- La boutique **n'ouvre qu'à son nœud**, **sept fois par saison** : avant ton 1er match, puis après tes 14e, 27e, 41e, 54e, 68e et **82e** matchs (le dernier, avant les séries). Hors d'un nœud, la porte Marché montre la boutique fermée et le prochain nœud (« Dans 9 matchs »).
- **Le prix des packs repart à zéro à chaque ouverture** : le premier achat d'un nœud coûte le prix de base, les suivants montent comme aujourd'hui (`hausseDesPacks`, compté sur les achats **de ce nœud**).
- **La pièce de banc** : à chaque nœud, 3 pièces tirées de la graine, une seule peut s'acheter. Son prix : `arrondi(PRIX_PIECE × hausseDesPacks(n))`, `PRIX_PIECE` 32 🪙 (plage 24-40), `n` les achats déjà faits à ce nœud, packs et pièce confondus. Exemple fait : au nœud du 41e match, la pièce en premier coûte 32 🪙 ; après un pack Bronze (14 🪙), elle coûte `32 × 1,4 = 44,8`, soit 45 🪙. 32, c'est un peu plus de la moitié d'un nœud de revenu : une pièce, ou deux à trois packs.
- **Au plus `ACHATS_PAR_NOEUD` achats par nœud** (4, ce que le prototype a mesuré), packs et pièce confondus.
- **Les jetons qui restent** après le nœud du 82e match ne servent plus à rien dans la run : ils sont perdus (proposé ; la conversion en 🏅 est une question à JP, § 11.3). L'écran du 82e nœud le dit (« Dernière boutique »).
- **Les sources** : les victoires (le barème : 5 🪙 la victoire, 4 la défaite en prolongation, 2 la défaite), les 40 du départ, la règle du coach (50 au plus par saison), les élites gagnées et les primes des fils. **Les rivaux ne paient pas de jetons** (§ 4.3). **La prime de série passe en 🏅** (20 🏅 la ronde gagnée) : en séries, la boutique est fermée. Plus aucun salaire ne vide la caisse.
- **Le tableau des sources et des puits**, pour l'attentif (une estimation de la revue, à remesurer à la tranche 1 : 10 % de défaites en prolongation, .400 à l'acte I, .450 au II, .500 au III ; la règle du coach ≈ 8 🪙 par tranche de 14 matchs ; les fils ≈ 1 à 2 ; une élite par acte prise, gagnée 40 % du temps pour ≈ 65 🪙, soit ≈ 26 en espérance) :

| Nœud (après ton match) | Acte | Matchs depuis le nœud d'avant | Revenu attendu | Solde attendu au nœud, avant achat | Puits attendus |
|---|---|---|---|---|---|
| 0 | I | — | 40 (le départ) | 40 | 2 packs Bronze (34), ou une pièce (32) |
| 14 | I | 14 à .400 | 48 + 8 + 1 = 57 | ≈ 60 | une pièce et un pack, ou trois packs |
| 27 | I → II | 13 à .400, l'élite I | 44 + 8 + 1 + 26 ≈ 79 | ≈ 80 | une pièce et deux packs |
| 41 | II | 14 à .450 | 50 + 8 + 2 = 60 | ≈ 60 | une pièce et un pack |
| 54 | II → III | 13 à .450, l'élite II | 46 + 8 + 2 + 26 ≈ 82 | ≈ 80 | une pièce et deux packs |
| 68 | III | 14 à .500 | 52 + 8 + 2 = 62 | ≈ 60 | une pièce et un pack |
| 82 | III → IV | 14 à .500, l'élite III | 52 + 8 + 2 + 26 ≈ 88 | ≈ 90 | ce qui reste ; le reste est perdu |

  **Le total** : ≈ 470 🪙 par saison. **Le risque** : sans la pièce, ≈ 60 🪙 par nœud achètent 2 à 3 packs, soit **13 à 16 packs par saison** (l'estimation de la revue), alors que 11 était « trop fort ». La cible : **7 à 10 packs par saison** pour l'attentif, la pièce faisant le reste ; si la mesure dépasse, on monte `PRIX_PIECE` ou `HAUSSE_PACK`, pas le barème.
- **Les médailles** (🏅) : 10 par acte passé (le contrôle tenu), 15 par rival battu, 20 par ronde de séries gagnée, 40 pour la Coupe ; les exigences les multiplient comme aujourd'hui (`PRIME_EXIGENCE`). Une run de l'attentif en rapporte ≈ 60 en espérance (§ 4.9).

### 4.9 Le départ et la méta

- **Le départ** : tes bouche-trous sont pigés entre **35 % et 55 %** de leur saison (`bouchesTrousDuDepart`, la bande), plus ta vedette du départ et ton classeur sans pages ; l'équipe part vers le 26e rang de force.
- **La méta est de la variété** : les 🏅 ouvrent des coachs, des pièces de banc, des pochettes et des époques ; aucune ne rend la run plus facile. **Le catalogue chiffré** (proposé ; le nombre de runs pour tout ouvrir est une question à JP, § 11.5) :

| Objet | Combien | Prix | Total |
|---|---|---|---|
| Les coachs (les philosophies au départ du loto) | 5 fermés sur 8 (3 ouverts) | 60 🏅 | 300 |
| Les pièces de banc (*PIECES*) | ≈ 12 fermées (≈ deux tiers ouvertes au départ) | 25 🏅 | 300 |
| Les pochettes (Argent, Or, Spécialistes, Club, du coach, Vedettes ; aujourd'hui ouvertes par leur jalon) | 6 | 40 🏅, ou leur jalon | 240 |
| Les spécialités qui restent (`packDefenseurs`, `packGardiens`, `packAnnees80`) | 3 | 35 · 50 · 60 🏅 | 145 |
| Des époques de plus au Pack Époque | 3 | 40 🏅 | 120 |
| **Tout** | | | **≈ 1 100 🏅** |

  À ≈ 60 🏅 par run (l'attentif : un acte passé 9 fois sur 10, le deuxième 7 sur 10, le troisième une fois sur deux ; un rival battu sur deux ; une demi-ronde ; une Coupe sur huit), **tout ouvrir prend ≈ 18 runs**. Les clubs et leurs couleurs (js/club.js, aujourd'hui en jetons) passent en 🏅 avec le reste de la variété, puisque les jetons ne survivent plus à la run.
- **Les déblocages de force partent** : la caisse, le plafond, les commanditaires, les Piliers gardés, les pages et le tri du classeur, les réserves de plus, la recrue qui monte, les bouche-trous moins pires, les vedettes des séries et les crans de pack (§ 8). Une vieille sauvegarde qui les avait achetés est **remboursée** de leur prix en 🏅 (§ 6).
- **Le prestige** (`PRESTIGES`) : ses taux d'Étoiles et de Phénomènes et son budget du classeur sont de la force ; ils partent (proposé, § 11.6). Le rang reste un titre (l'échelle du Palmarès) ; les coachs qu'il ouvrait passent au catalogue ; le niveau de la ligue ne suit plus que les exigences (`niveauDeLigue`). À mesurer : le taux de Coupes au premier rang et au dernier, en paires (§ 10).
- **Les jalons** se réécrivent à la tranche 9 : les trois impossibles deviennent « L'acte II passé » (au lieu de la deuxième saison, 30 🏅), « Les séries sans perdre un cœur » (au lieu de la troisième, 45 🏅) et « Le banc plein » (cinq pièces posées, au lieu du coach au sommet ; il ouvre le Pack du coach) ; ceux qui payaient un déblocage de force paient son prix en 🏅.
- **Les exigences 🔺** restent la seule difficulté qui monte, et elles passent par les leviers de la V27, pas par le plafond acheté ni les gardés. Les huit crans, refaits :

| Cran | Le nom | Avant | Après (V27) |
|---|---|---|---|
| 1 | La ceinture | 2 M$ d'espace de moins | le même (le plafond de la run existe toujours) |
| 2 | Les agents | les packs coûtent 25 % de plus | les packs **et la pièce** coûtent 25 % de plus |
| 3 | Le classeur fermé | une case de moins au classeur, un loto de moins | une case de moins au classeur |
| 4 | L'effectif mince | 3 Soutiens de plus au départ de chaque saison | 3 Soutiens de plus au départ |
| 5 | Les commanditaires boudent | 2 jetons de moins par victoire | 1 jeton de moins par victoire (le barème est à 5 sans commanditaire) |
| 6 | Le proprio impatient | chaque mandat une saison plus tôt | **les contrôles serrés** : 18 · 10 au lieu de 20 · 12 |
| 7 | Ceux qui partent | une case de moins chez ceux qui restent | **les rivaux plus haut** : le 6e, le 2e et le plus fort (`RANGS_DES_RIVAUX` 5 · 1 · 0) |
| 8 | La ceinture serrée | 3 M$ d'espace de moins encore | **les séries plus dures** : `ETAPE_SERIES` +1 (4 étapes) |

### 4.10 Les histoires

- **Une fourche aux 2 ou 3 semaines** : un vrai choix, deux réponses, chacune avec **un prix en stats** (jamais deux réponses de même valeur). Une fourche donne au plus une pièce de banc (deux par saison au plus, § 4.6). Le reste des histoires de la banque devient des **nouvelles d'Hier soir**, sans choix, dites par leur voix avec leur fait vrai.
- **Un vrai choix** (la définition de `mesure_decisions`) : deux options **proches en moyenne** (à moins de 0,3 V l'une de l'autre en paires sur la run) **dont la meilleure change selon l'état de la run** (le banc posé, le rang, les cœurs), mesuré en paires sur deux états opposés (un banc de tireurs à 2 ❤️ et 18e, un banc de défense à 1 ❤️ et 8e, par exemple).
- La voix, le joueur nommé, le fait vrai lu dans les feuilles (`faitsDe`) et la vraie saison avec ses bornes restent ; la règle « jamais deux fois le même joueur dans la run » reste.

### 4.11 Les écrans (décision 12 ; les maquettes d'abord, tranche 0)

- **Ce soir** tient en **1,0 écran** à 390 × 844 (`check_hauteur`) : Hier soir en tête, puis l'affiche (240 px au moins, ton adversaire), ta plaque, ton banc en **cinq petites cartes de front** (≈ 66 px chacune ; en toucher une l'agrandit), tes choix, un bouton.
- **Ta plaque** est la bande de la run d'aujourd'hui (le bouton `bu-run` de js/saison.js), refaite : « Acte I », le rang sur la cible (« 22e / 20 »), **les cœurs dessinés** (pas des emojis dans un bouton, interface.md) avec un texte pour le lecteur d'écran (« 2 cœurs sur 2 ») ; **ton rang une seule fois, là** ; la toucher ouvre le Proprio (les cœurs, les contrôles, la caisse).
- **Le rival** : sur l'affiche **seulement le soir du rival** ; les autres soirs, un jeton sous l'affiche (« Rival · dans 9 matchs »). **Une seule unité, « dans N matchs »**, pour le rival et pour la boutique.
- **Le renfort** « +2 ✦ » suit le club jusqu'à l'affiche, au Calendrier et au Face à face.
- **Le soir de fin d'acte**, dans un ordre fixe : le rival (le match), le contrôle et le cœur, la pièce gagnée, le calendrier de l'acte qui vient, la boutique. Chaque étape est **une ligne de la boîte qui bloque « Jour suivant »** ; rien ne s'ouvre seul.
- **Placer** : seulement les clubs échangeables, deux touchers.
- **Banc plein** : la pièce neuve d'abord, puis celle qui sort ; la confirmation dit « X part ».
- **L'élite** : proposée le lundi, une ligne de la boîte ; sans réponse, un soir ordinaire ; prise, l'affiche dit « Élite ».
- **L'écran de fin** dit la cause en une ligne (« 17e, il fallait 16e » ; « Deux contrôles ratés » ; « Éliminés en deuxième ronde ») puis les 🏅.
- **« La run continue »** est le moment fort (le palier « pic » de js/mouvement.js) de la fin d'un acte passé ; ses trois cellules sont refaites (les gardés et les lotos partent) : **le contrôle** (« 18e / 20 »), **les cœurs** (gardés ou perdus), **la pièce** gagnée au rival (ou « Passé »).
- **La vieille sauvegarde** : l'écran dit ce qui est versé (les 🏅 de la run, les déblocages remboursés) avant la run neuve.
- **Les cartes** : on les retourne ; **le verso agrandi porte son « Prendre »**, et retourner une carte referme l'autre. **Le verbe sous une carte est « Prendre » partout** (plus de « Poster », de « Signer » sous une carte de jeu ; « Signer » reste l'échange d'un joueur, interface.md).
- **Une histoire** : sous la réplique, le fait dit **seulement ce que la réplique tait** (jamais le même chiffre deux fois).
- **Écrans neufs** (tous en maquette à la tranche 0) : le rival annoncé (son intention, son style), le calendrier de l'acte (le placement, le renfort sur la case), la proposition d'élite, le choix du duel (le plan et la mise), l'entracte à un bouton, le soir de fin d'acte, le point de contrôle (les cœurs), la pièce à prendre (1 parmi 3, banc plein), la boutique (les packs et la pièce, fermée entre deux nœuds), « La run continue », l'écran de fin, la vieille sauvegarde, Ce soir et ta plaque, le Proprio.
- La seconde moitié de l'interface (D1b de LIVRAISON.md) se fait dans ces écrans neufs, pas dans les anciens.

## 5. Les chiffres

- **Les actes** : *ACTES* [27, 54, 82] (tes matchs joués à la fin de chaque acte). Exemple : ton 27e match est le rival de l'acte I.
- **Les rivaux** : *RANGS_DES_RIVAUX* [7, 3, 0], le rang (de 0) parmi les 31 adversaires triés par `att + def + g` au premier soir ; dans une ligue de `n` clubs, `arrondi(r × (n − 1) / 31)`.
- **Les contrôles** : *CONTROLES* [20, 12, séries] (rang au classement le soir du rival, inclus), `arrondi(C × n / 32)` dans une ligue de `n` clubs. Le tour 3 du prototype les a relus avec 3 ❤️ : l'attentif ne meurt qu'une fois sur 16, à l'acte III ; le premier robot 6 fois.
- **Les cœurs** : *COEURS* 2 (JP).
- **Le renfort** : *RENFORT* 1 étape par match reculé et par acte de recul, compté depuis la cédule d'origine, sans arrondi, plus 1 pour un match reculé au-delà du nœud du milieu de son acte. Exemple fait : § 4.4.
- **Les séries** : chaque adversaire monte de *ETAPE_SERIES* 3 étapes d'édition au premier match des séries, renfort compris en plus.
- **La courbe de la ligue par acte** : *ETAPES_DES_ACTES* [0, 0, 0] (mesuré) ; [0, 1, 2] essayé, à trancher par la mesure de la tranche 1 (pas une question à JP : le juge décide).
- **La boutique** : *NOEUDS_BOUTIQUE* [0, 14, 27, 41, 54, 68, 82] ; *ACHATS_PAR_NOEUD* 4 ; le prix d'un pack, `prixDe(cle, hausseDesPacks(n))` avec `n` les achats **de ce nœud** ; la pièce, `arrondi(PRIX_PIECE × hausseDesPacks(n))`, *PRIX_PIECE* 32.
- **L'élite** : au plus *ELITES_PAR_ACTE* 1 ; `J = arrondi(V_COEUR × (1 − p) / p) − PRIX_PIECE`, borné à [10, 90], *V_COEUR* 60, `p` borné à [0,25, 0,55]. Exemple fait : § 4.5.
- **Les médailles** : 10 par acte passé, 15 par rival battu, 20 par ronde gagnée, 40 pour la Coupe.
- **Le départ** : *BANDE_DEPART* [0,35, 0,55] de la saison du bouche-trou à son poste (il était [0,05, 0,25]).
- **Le banc** : *CASES_DU_BANC* 5 ; *PIECES_OFFERTES* 3 ; une pièce joue 30 à 50 % des soirs ; une fourche, une pièce au plus, deux par saison.
- **Les bornes** : la règle « une carte sous ±1 V, ±1,5, ±2,5, ±4 selon son niveau » part pour les pièces de banc (elle reste pour les réponses d'histoire et les cartes de la banque). Ce qui la remplace : chaque pièce **se voit** dans la feuille du soir où elle joue (les seuils de rogue.md : ±2 tirs, ±0,3 but…), **n'est jamais un piège** (en paires, jamais sous −0,5 V sur un acte) ; **le banc complet** (cinq pièces) de l'attentif rend **au plus +5 V sur un acte** en paires contre un banc vide ; le robot **glouton** (qui prend toujours la meilleure pièce offerte) gagne **au plus la moitié** de ses runs.
- **La courbe** se lit **en points au classement par acte**, pas en `teamStrength` (aveugle aux greffes, donc au banc) : la part de points de l'attentif monte d'un acte à l'autre, en médiane, et il passe ses contrôles ; les bornes chiffrées se posent à la tranche 1 sur la mesure du vrai banc, écrites comme des intervalles.
- **La première Coupe** (décision 5) : la médiane de la première Coupe de l'attentif à la run 3 ou plus tard, et sa chance à la run 1 **au plus ≈ 15 %**. Vérifié : sans méta de force, les runs sont indépendantes, et une chance `q` par run donne une première Coupe à la run `k` avec `(1 − q)^(k−1) × q` ; la médiane est le premier `k` où `1 − (1 − q)^k ≥ 0,5`. À 13 % : `ln 0,5 / ln 0,87 = 4,98`, **médiane à la run 5** ; à 10 % : 6,58, **run 7** ; à 15 % : 4,27, run 5. La médiane ne tombe sous la run 3 qu'au-dessus de ≈ 29 % par run. **10 à 13 % par run tient donc la règle**, et la borne qui pince est celle de la run 1 (≤ 15 %). Sous 9 % (médiane à la run 8 ou plus), la Coupe s'éloigne trop.
- **Les cœurs comptent** : l'attentif perd au moins un cœur dans **30 à 60 %** des runs ; il meurt de ses cœurs (0 ❤️ avant l'acte III) dans **au plus une run sur huit** ; il rate les séries (l'acte III) dans au plus une run sur trois.
- **Les histoires** : une fourche aux 2 ou 3 semaines, soit **9 à 13 fourches** sur une saison de ≈ 26 semaines ; **au plus 20 %** des fourches ont deux réponses à moins de 0,1 V d'écart (63 % aujourd'hui).
- **Les décisions** : cible **≤ 90 décisions par saison, dont ≥ 30 vrais choix** (175 et 20 à 25 aujourd'hui) ; « vrai choix », § 4.10. `mesure_decisions` est rouge au-dessus de 90 une fois la définition codée.
- **La cible de la tranche 1** : sur **64 graines** de la vraie première run, les mêmes dés, l'attentif gagne la Coupe **6 à 10 fois sur 64** (9 à 15 %, la décision 5), « premier » et le naïf **au plus 2 sur 64** ; l'attentif fait 5 à 9 victoires de plus en paires et au moins deux fois plus de rondes de séries.
- **Le risque R1 — la cible a été mesurée sur l'ancien jeu.** Le prototype gardait le plan du soir, les adjoints à séjours et leur salaire, la main du deck, le coach à l'expérience, les plans par période, le butin des rivaux du proprio et 4 achats par nœud, avec 3 ❤️ et sans élite ni pièce en boutique. Le vrai banc, 2 ❤️ et les élites peuvent la déplacer dans un sens ou dans l'autre. **Critère obligatoire** : la cible se remesure sur le vrai banc **avant que les tranches 2 à 6 sortent** ; rouge, on règle la bande du départ ou le rang des rivaux (jamais les cœurs, décision 1), et on remesure.

## 6. Les cas limites

- **La vieille partie** (JP, V20 : *on s'en fout de briser les saves* ; mais une partie en cours ne doit pas planter). Les clés de sauvegarde ne bougent pas ; la V27 ajoute des champs (`G.rogue.acte`, `G.rogue.coeurs`, `G.rogue.banc`, `G.rogue.place`). Une run d'avant (sans `acte`, ou à sa 2e saison ou plus) **ne se rejoue pas sous les règles neuves** : à l'ouverture, un écran dit « Cette run date d'avant la nouvelle saison » et **ce qui est versé** (ses 🏅 comme à une fin de run, et le prix en 🏅 des déblocages qui partent, remboursés), puis une run neuve commence. Une vieille décision (`poste`, `embauche`, `talent`, `xpCoach`, `plan`, une main du deck) ne joue rien et ne plante pas — `check_sauvegardes`.
- **Un rival blessé ou échangé** : le rival est un club, pas un joueur ; il reste.
- **Le rival déjà joué contre toi dans l'échange** : l'échange choisit le match du rival le plus proche de la fin de l'acte qui garde 82 matchs à chacun ; s'il n'en existe aucun, le dernier match de l'acte contre un club du même rang ± 1 (à vérifier par le juge : jamais de rival manquant).
- **Le club du rival** reçoit un renfort comme un autre pour ses autres matchs reculés ; le match du rival ne bouge pas.
- **L'égalité au contrôle** : le rang est celui du Classement, ses bris d'égalité compris ; deux clubs à égalité de points ne partagent jamais un rang.
- **Une ligue plus petite que 32** : les contrôles et le rang des rivaux suivent la taille (§ 4.2, § 5).
- **La semaine sans club du top 8**, ou un acte où l'élite est déjà prise : pas d'élite.
- **Une élite sans réponse le lundi** : un soir ordinaire.
- **Une élite à 1 ❤️** : proposée, avec l'avertissement ; la prendre est un choix.
- **Une élite en prolongation perdue** : perdue.
- **La mise sur une élite à 1 ❤️** : elle double les sonnés et les jetons, jamais le cœur.
- **Le dernier cœur perdu à l'acte II** : la run finit le soir du contrôle, avant l'acte III.
- **L'acte III raté avec 2 ❤️** : la run finit, sans séries.
- **Le banc plein** : la pièce neuve, puis celle qui sort, « X part » ; « Passer » est toujours là.
- **Une pièce qui ne se lit jamais** (sa condition ne revient pas avec ton club) : `check_moments_si` exige que chaque condition revienne assez souvent ; une pièce contre un style de rival est un moment rare, au sens de vocabulaire.md.
- **Le calendrier sans échange possible** : la case reste ; l'écran ne propose pas l'échange qui casserait les 82 matchs.
- **Les jetons au dernier nœud** : perdus après le 82e nœud (proposé, § 11.3) ; l'écran le dit.
- **Les séries** : pas de cœurs, la série perdue finit la run ; chaque match vu en direct est un duel ; le renfort reste.
- **Hors ligne** : sw.js liste les modules neufs et oublie les partis — `check_coquille`.
- **Le clavier et la manette** : chaque écran neuf répond à A, B, Échap et au balayage — smoke, `essai_rogue`.

## 7. Ce qu'il touche

**Les fichiers** : js/rogue.js, js/rogue-jeu.js, js/pouvoirs.js, js/adjoints.js, js/greffes.js, js/impact.js, js/sim.js (les gros matchs et la main du deck, qui sortent du moteur), js/saison.js, js/gerant.js, js/banc.js, js/inventaire.js, js/magasin.js, js/packs.js, js/histoires.js, js/coachs.js, js/coachs-reels.js, js/cartable.js, js/club.js, js/composants.js, `js/pieces.js` (neuf : *PIECES*), `js/actes.js` (neuf : les actes, les rivaux, les cœurs, le placement, les élites), style.css, sw.js ; scripts/lib/rogue_sim.mjs, scripts/lib/cartes_robot.mjs, `scripts/lib/rogue_actes.mjs` (neuf, le prototype repris), les juges du § 10, `.github/workflows/profondeur.yml` (neuf).

**Les règles fermes de `.claude/rules/`**, chacune réécrite pour décrire le neuf (refonte, § 4) :
- rogue.md : « Le coach est un personnage… expérience, niveaux 1 à 5, talents » — **défaite** (décision 7) ; « chaque pouvoir… sous sa borne seul (2,5 V, 4 V) », « le personnage complet sous 16 V », « une carte… bornée par son niveau » (pour les pièces) — **défaites** (décision 8), réécrites comme « se voit, jamais un piège, le banc complet sous +5 V sur un acte, le glouton sous la moitié des runs » ; « la deuxième run est plus dure… `ETAPE_APRES_LA_PREMIERE` », « la première saison… `MANDAT_DE_LA_PREMIERE` », « la boule de neige est bloquée… lotos et gardés entre deux saisons » — **défaites** (décision 1 : plus de deuxième saison), et la première Coupe à la run 3 ou plus tard **tenue** (décision 5 d'après la revue) ; « les adjoints ne s'achètent pas… séjour, repos, salaire, main, cases par niveau » — **défaite** (décision 7 ; et une pièce s'achète maintenant en boutique, décision 2 d'après la revue) ; « la main du deck » — **défaite** (décision 7) ; « au duel, ton banc propose avant chaque période », « le duel bien joué… la meilleure proposition à chaque période » — **défaites** (décision 9 et décision 3 d'après la revue) ; « le robot premier Signer ne gagne pas la Coupe » — **tenue** (au plus 2 sur 64) ; « après sa première Coupe… exigences » — **tenue**, par les leviers neufs ; « le gros match se règle le jour où il se joue » — **tenue** (le rival et l'élite aussi) ; « aucun joueur ne te suit au choix » — **tenue** ; « l'histoire… un lundi sur deux, `CHANCE_HISTOIRE` » — **défaite** (décision 9), le reste de la règle des histoires tenu ; « la prime de série est versée » — **tenue**, en 🏅.
- interface.md : « ton banc en main de quatre vraies cartes » — devient **cinq petites cartes de front**, une exception écrite à « à quatre et plus, la main se balaie » ; « "Prendre" sous une carte » — tenue et étendue (décision 12) ; « rien que ton rang dans la bande de Ce soir » — devient « dans ta plaque » ; « Ce soir est une émission… hier en une ligne » — Hier soir passe en tête, Ce soir tient en 1,0 écran ; « le Proprio… ses rivaux », « les rivaux se cochent un à un » — **défaites** (les rivaux du proprio partent).
- vocabulaire.md : **adjoint**, **séjour**, **au repos**, **salaire**, **la main**, **talent**, **expérience**, **la main du deck** partent du vocabulaire du Rogue ; entrent **acte**, **élite**, **cœur** (❤️, la confiance du proprio : le mot « confiance » revient, pour le proprio seulement), **point de contrôle**, **pièce de banc**, **le banc** (cinq cases), **renfort**, **nœud** (de la boutique), **fourche**, **la mise** (avant le match). **Le mot « rival » change de sens** (décision 6 d'après la revue) : la ligne « **rival** : un club à deux rangs ou moins » est réécrite — le rival est le club annoncé au premier soir d'un acte, qu'on affronte à son dernier match, trois par run ; « Rival au classement » et « Ton rival, choisi au début de la saison » partent avec `MINI_BOSS` ; la **bête noire** et **ta rivalité** (le club le plus croisé en duel) restent. **« Boss » n'entre pas** : la ligne « leur coach… Pas "boss" » est tenue telle quelle. Les noms de code `bossHtml` et `.boss-vie` du combat des séries (js/saison.js) ne s'affichent pas ; ils se renomment s'ils sont réécrits, sinon ils restent.
- moteur.md : rien (le moteur ne bouge pas ; `jouerEnPeriodes` et les greffes restent).
- **Les clés de sauvegarde ne bougent jamais** (`check_sauvegardes`).

## 8. Ce qui part

La pièce maîtresse. Chaque nom ci-dessous disparaît de js/, index.html, style.css et sw.js, et *check_refonte* le vérifie à la PR de sa tranche (pour les tranches 2 à 6, sur leur somme). Chacun a été cherché dans js/ le 7 nov. 2026. Le test du zéro : *js/actes.js* et *js/pieces.js* s'écrivent depuis le § 4 sans relire les modules d'avant ligne par ligne ; c'est une refonte.

Dans cette partie, seul ce qui part est entre accents graves : *check_refonte* exige l'absence de chaque nom ainsi écrit sous ce titre, donc les noms neufs qui les remplacent, et ceux qui restent, sont écrits en italique (le motif est un mot entier : *RANGS_DES_RIVAUX* ne retient pas `RIVAUX`).

### La run sur plusieurs saisons (tranche 2)

- `ETAPE_APRES_LA_PREMIERE`, `etapeDeLaRun` → la courbe par acte et les séries plus dures (*ETAPES_DES_ACTES*, *ETAPE_SERIES*).
- `MANDATS`, `mandatDe`, `MANDAT_DE_LA_PREMIERE`, `rangDuMandat`, `mandatRempli` → les cœurs et les points de contrôle (*COEURS*, *CONTROLES*, *controleDeLActe*).
- `LOTOS_DE_SAISON`, `lotosDeSaison`, `GARDES_DE_SAISON`, `gardesDeLaRun` → rien : il n'y a plus d'entre-deux-saisons.

### Les gros matchs choisis et les rivaux du proprio (tranches 2 et 6)

- `RIVAUX`, `RIVAUX_OFFERTS`, `rivauxOfferts`, `rivalChoisi`, `BUTIN_RIVAL`, `MINI_BOSS`, `annoncerGros`, `grosMatchAvant`, `ESPACEMENT_GROS` → les rivaux de l'acte (*rivalDeLActe*, *RANGS_DES_RIVAUX*) et les élites (*eliteDeLaSemaine*), dans *js/actes.js* ; les raisons d'un duel (*RAISONS_DU_DUEL* : le rival, l'élite, la série).
- `BUTIN_DU_GROS` → la pièce du rival battu, les jetons de l'élite.

### Le coach qui grandit à l'expérience (tranche 5)

- `XP`, `SEUILS_NIVEAU`, `TALENT`, `TALENT_CASE`, `aLaCaseDePlus` → la pièce de départ et les pièces des rivaux (*piecesOffertes*).
- `POUVOIRS` → refaits en pièces de banc dans *PIECES* (leur condition, leurs canaux, leur réplique passent ; leur ouverture par niveau part).

### La main d'adjoints et leurs niveaux (tranche 5)

- `ADJOINTS` → refaits en pièces de banc dans *PIECES* (le style, le signal, le relais, la réplique passent).
- `SEJOUR`, `SEJOUR_SYNERGIE`, `REPOS`, `finirSejours` → rien : une pièce reste jusqu'à ce que tu la remplaces.
- `MAIN_MAX`, `quiPartDeLaMain` → rien : il n'y a plus de main.
- `CASES_PAR_NIVEAU`, `casesDuNiveau`, `CASE_DE_PLUS`, `casesDuPerso` → *CASES_DU_BANC* (5).
- `SALAIRE_NIV`, `salaireDe`, `salairesDesAdjoints` → rien : plus de salaire.
- `adjointsOfferts`, `momentFort`, `PALIERS_PACK` → *piecesOffertes* aux rivaux battus, aux élites, aux fourches et à la boutique.
- `niveauOffert`, `FORCE_NIV`, `PRIX_NIV`, `NIV_DEFAUT` → rien : une pièce n'a pas de niveau (§ 4.6) ; sa force se règle par sa présence.

### La main du deck et la recrue qui monte (tranche 5)

- `mainDuDeck`, `PALIERS_CARTES`, `SORTES_DECK`, `NIVEAU_SORTE` → la recrue part (le Pack Époque fait le joueur au choix), le rôle part, l'atelier reste dans la banque (ses retouches sont déjà des cartes rares, *RARE_DU_PACK* ; § 8b).
- `cranDeLaRecrue`, `niveauxDeLaRecrue`, `NIVEAUX_RECRUE` → rien : plus de « Joueur au choix ».

### Le plan du soir et les micro-plans du duel (tranche 6)

- `poserLesPlans`, `ouvrirPlan` → rien sur un soir ordinaire : ce qu'un plan faisait est une pièce de banc.
- `propositionsDuDuel`, `voixDuBanc` → le plan fort d'avant-match (*plansDuDuel*), un seul choix, et la mise sur le même écran.

### Les histoires tirées chaque lundi (tranche 8)

- `lundiAHistoire`, `CHANCE_HISTOIRE`, `DISETTE_MAX` → le rythme fixe des fourches (*SEMAINES_ENTRE_FOURCHES*, 2 ou 3) ; les autres histoires vont aux nouvelles d'Hier soir.

### Les déblocages de force (tranche 9)

- `plafondDuVestiaire` → rien : le plafond d'une run ne s'achète plus.
- `PAGES_DU_CLASSEUR`, `CASES_DE_LA_DERNIERE`, `gardesDeLaDerniere` → rien : ni pages de force, ni Piliers gardés.
- `CRANS_DE_PACK`, `monteeDesPacks`, `cleDeCran` → les pochettes s'ouvrent comme variété (*packsOuverts*, qui reste), elles ne montent plus en force.
- `reservesDeLaRun` → rien : les cases de réserve de plus étaient de la force (et « banc » nomme maintenant les cinq cases).
- Les clés des déblocages de force, des clés de données écrites entre guillemets dans js/rogue.js, js/rogue-jeu.js et js/saison.js (*check_refonte* les cherche aussi) : `caisse1`, `caisse2`, `commanditaire1`, `commanditaire2`, `plafond1`, `plafond2`, `garder1`, `garder2`, `garder3`, `classeur1`, `classeur2`, `classeur3`, `classeur4`, `classeurTri`, `banc1`, `banc2`, `recrue1`, `recrue2`, `plombiersPlus`, `packVedettes`. (La phrase d'avant, « aucune déclaration de commanditaire », était fausse : les deux sont dans *DEBLOCAGES*, et *baremeRogue* les lit.)

**Le compte** : **90 noms** entre accents graves ci-dessus, dont 70 fonctions et constantes et 20 clés de déblocage. Trois sont courts (`XP`, `REPOS`, `TALENT`) : la tranche 5 vérifie qu'aucun texte d'écran ne les contient en mot entier avant de les mettre dans son extrait.

## 8b. Ce qui reste, et pourquoi

**À vérifier à sa tranche avant de l'ajouter à « Ce qui part »** (écrit ici en italique pour que `check_refonte` ne le compte pas encore) : *periodesDuDuel* (js/sim.js : les plans période par période ?), *planEnChiffres* (js/impact.js : lu aussi par le duel ?), *jetonsDeDepart* (garde sa base de 40, perd la caisse), *budgetDuClasseur* (perd le prestige et le plafond acheté, garde le reste), *ecussonsDeLaSaison* et *ecussonsDesSeries* (réécrits sur les médailles du § 4.8 : acte passé, rival battu, ronde gagnée).

**Reste, et pourquoi** :

- **Le moteur calibré** : `jouerEnPeriodes`, les greffes (`brancherGreffes`), `teamStrength`, `profilMatch`, le hasard, la ligue au jour le jour — JP : *le moteur calibré ne bouge pas* ; la V27 ne touche aucune cote.
- **Les vrais joueurs, le repêchage dans de vrais vestiaires** : `bouchesTrousDuDepart` (sa bande change, pas sa règle), `departDuClasseur`, `lotoDeCase`, `vestiaire` du départ — JP.
- **Le duel vécu en direct** : `INTENTIONS`, `FORCE_DUEL`, `MISE_DOUBLEE`, `ELAN`, `SONNE`, les trois périodes vues, leur coach en séries (`persoAdverse`, `OMBRE`) — JP : *le gros match vécu en direct*.
- **Le relais** : `effetDuRelais`, `RELAIS_NIV`, la chaîne de deux maillons — décision 7 : le moteur des combos.
- **La règle du coach** : `REGLES_DU_COACH`, `primesDuCoach`, `PRIME_COACH_MAX` — décision 7.
- **L'entraîneur au loto et son niveau** : `lotoDesCoachs`, `coachAuCartable`, `niveauDuCoach`, `MAITRISE`, la philosophie lue des vraies stats — décision 7 (sa pièce de départ) et la variété de la méta.
- **Les bornes par niveau des autres cartes** : `BORNE_NIV`, `NIVEAUX[k].borneV` (js/niveaux.js) — les réponses d'histoire et les cartes de la banque gardent leur niveau ; seules les pièces de banc n'en ont pas.
- **La grammaire d'effet et la carte de jeu** : js/effets.js, `motsDe`, `carteHtml`, la pochette — V25, ce qui tient.
- **Les histoires vraies** : `HISTOIRES`, `tirer`, `faitsDe`, les voix (`EXPEDITEURS`), la promesse et son verdict, `memoireDeLaRun` — JP : *les histoires vraies qui nomment le joueur*.
- **Les cartes de hockey** : `cartonHtml`, `carteCouchee`, `dosDeCarton`, les 55 séries, `EDITIONS` — JP, deux fois.
- **L'économie à une caisse** : `jetonsDe`, `baremeRogue` (sans commanditaires), `hausseDesPacks`, `HAUSSE_PACK`, `prixDe`, `BOUTIQUE`, la banque et `RARE_DU_PACK` (l'atelier y vit) — recomptée des décisions, lisible.
- **Le pack d'une série gagnée** : `packDeSerie` — il sert la ronde d'après ; c'est le cran de plus de `packVedettes` qui part.
- **Les spécialités de pack** : `packDefenseurs`, `packGardiens`, `packAnnees80` — déjà de la variété.
- **Les exigences** : `EXIGENCES`, `exigencesDe`, `PRIME_EXIGENCE` — décision 10 ; leurs crans changent de leviers (§ 4.9).
- **Le prestige** : `PRESTIGES`, `rangDePrestige` — le rang reste un titre ; ses taux et son budget partent si JP le confirme (§ 11.6).
- **Les jalons** : `JALONS`, `jalonsAtteints`, `packsOuverts` — réécrits à la tranche 9 (§ 4.9), pas retirés.
- **La plaque** : la classe `bu-run` — refaite (§ 4.11), son nom reste.
- **Les galons** et le panthéon — ils comptent ce qu'un joueur a fait chez toi, une run ou plusieurs.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| *ACTES* | 27 · 54 · 82 | ± 3 matchs par borne | un acte de moins de 22 matchs n'a pas de méso-boucle ; de plus de 32, l'arrêt naturel s'éloigne |
| *RANGS_DES_RIVAUX* | 7 · 3 · 0 | [12, 6, 2] à [3, 1, 0] (essayés : `att-bossdoux`, `att-bossdur`) | trop bas, le rival n'est pas un pic ; trop haut à l'acte I, l'équipe du départ ne peut pas gagner. Le premier levier si l'attentif meurt trop (R1) |
| *CONTROLES* | 20 · 12 · séries | 18-24 · 10-16 · séries | relu au tour 3 avec 3 ❤️ : l'attentif meurt 1 fois sur 16 ; avec 2 ❤️, à remesurer (R1) |
| *COEURS* | 2 | 2 (JP) | ne se règle pas : si l'attentif meurt trop, on règle le départ ou les rivaux (décision 1) |
| *RENFORT* | 1 étape par match et par acte | 1-2 | à 0, placer est gratuit et dominant ; à 3 par acte (essayé), placer ne vaut plus rien |
| *ETAPE_SERIES* | 3 étapes | 2-4 | à 0, les séries sont plus faciles que l'acte III |
| *ETAPES_DES_ACTES* | 0 · 0 · 0 | 0-2 par acte | la tranche 1 tranche par la mesure |
| *NOEUDS_BOUTIQUE* | 0 · 14 · 27 · 41 · 54 · 68 · 82 | 5 à 8 nœuds | 3 nœuds (essayé) : l'équipe ne grandit pas assez ; chaque matin (essayé) : la boutique redevient une corvée |
| Le prix au nœud | remis à zéro | — | sans remise, l'équipe ne grandit pas aux actes II et III (mesuré) |
| *ACHATS_PAR_NOEUD* | 4 | 3-5 | à 2, l'économie ne sert plus ; sans plafond, un nœud riche vide la boutique |
| *PRIX_PIECE* | 32 🪙 | 24-40 | à 20, la pièce est obligatoire à chaque nœud ; à 50, on ne prend que des packs |
| *V_COEUR* | 60 🪙 | 40-90 | trop bas, l'élite ne vaut pas le risque ; trop haut, elle est obligatoire |
| *ELITES_PAR_ACTE* | 1 | 0-1 | à 2, l'élite redevient une routine et les cœurs fondent |
| *BANDE_DEPART* | 0,35 · 0,55 | 0,25-0,45 · 0,45-0,65 | à 0,05-0,25, l'équipe part au 31e rang et l'acte I tue ; au-dessus, la run 1 se gagne. Le deuxième levier de R1 |
| *CASES_DU_BANC* | 5 | 4-6 | à 3, aucun combo ; à 7, tout se lit à la fois |
| *PIECES_OFFERTES* | 3 | 2-4 | — |
| La présence d'une pièce | 30-50 % des soirs | 25-60 % | sous 25 %, elle ne se sent pas ; au-dessus de 60 %, elle vaut deux adjoints d'aujourd'hui |
| *SEMAINES_ENTRE_FOURCHES* | 2 ou 3 (tiré) | 2-4 | à 1, on revient à 175 décisions ; à 4, une saison n'a que six fourches |
| Les médailles | 10 · 15 · 20 · 40 | ±50 % | trop bas, la méta prend 30 runs ; trop haut, tout s'ouvre en 8 |

## 10. Les critères d'acceptation, et ce que deviennent les juges

**Où ça tourne** : les campagnes lourdes ne tournent jamais sur le PC de JP. `check_profondeur` n'est pas dans `verifier` aujourd'hui (vérifié dans .github/workflows/verifier.yml : ni lui, ni `check_robot`, ni `check_duel`) ; la tranche 1 ajoute un fichier de travail à part, `.github/workflows/profondeur.yml`, lancé à la main (`workflow_dispatch`) et sur chaque PR qui touche js/rogue*.js, js/actes.js, js/pieces.js ou scripts/lib/rogue_actes.mjs ; **budget : 45 minutes à quatre fils** (`timeout-minutes` 50) pour 64 graines × quatre robots (l'attentif, « premier », le naïf, le glouton) et les variantes (placée, élites prises ou refusées, méta pleine ou vide, prestige bas ou haut). Si la tranche 1 mesure plus, les variantes passent dans un deuxième travail. La branche des tranches 2 à 6 ne fusionne qu'avec `profondeur.yml` vert, lu avant d'activer l'auto-merge.

**Les critères** (64 graines, les mêmes dés, chaque borne écrite comme un intervalle) :

- [ ] **Le juge neuf** (tranche 1) : le prototype repris comme robot du dépôt (`scripts/lib/rogue_actes.mjs`) ; sur 64 graines de la vraie première run : l'attentif gagne **6 à 10 Coupes sur 64**, « premier » et le naïf **au plus 2** ; l'attentif fait 5 à 9 victoires de plus en paires et au moins deux fois plus de rondes de séries — `check_profondeur`.
- [ ] **R1, la cible remesurée sur le vrai banc** (avant que 2 à 6 sortent) : le même critère, sur le jeu de la branche (2 ❤️, les pièces, la boutique à pièces, le duel à un choix) ; rouge, on règle la bande du départ ou le rang des rivaux, jamais les cœurs — `check_profondeur`.
- [ ] **La première Coupe** (décision 5) : la chance de Coupe de l'attentif à la run 1 **entre 9 % et 15 %** (soit 6 à 10 sur 64), donc une médiane de première Coupe entre la run 5 et la run 8 ; jamais sous la run 3 — `check_profondeur`.
- [ ] **Les cœurs comptent** : l'attentif perd au moins un cœur dans **19 à 38 runs sur 64** (30 à 60 %), meurt de ses cœurs avant l'acte III dans **au plus 8 sur 64**, rate les séries dans au plus 21 sur 64 — `check_profondeur`.
- [ ] **Le glouton** (neuf : il prend toujours la pièce qui rend le plus, en paires) gagne la Coupe dans **au plus 32 runs sur 64** ; **le banc complet** de l'attentif rend au plus +5 V sur un acte contre un banc vide, en paires — `check_profondeur`, `check_pouvoirs`.
- [ ] **La run** : quatre actes aux bornes *ACTES*, un rival par acte au bon rang de force (à la taille de la ligue), annoncé au premier soir de son acte, jamais manquant ; 82 matchs à chaque club et un match par jour après chaque échange ; un cœur perdu à chaque contrôle raté des actes I et II et à chaque élite perdue, aucun pour un rival perdu ; la run finit à 0 ❤️ ou à l'acte III raté ; les contrôles proportionnels à la ligue et l'égalité départagée comme le Classement — `check_rogue` (réécrit : ses blocs « deuxième saison », « mandat » et « gardés » partent), `check_calendrier` (étendu : la cédule placée).
- [ ] **Le calendrier placé** : le renfort compté depuis la cédule d'origine, +1 par match et par acte, +1 au-delà du nœud du milieu ; placer vaut à peu près zéro en moyenne (−1 à +1 V sur 64 graines, en paires) et aide dans au moins une graine sur quatre ; placer ne fait pas reculer tes voisins au classement de plus d'un point en médiane — `check_rogue`, `check_profondeur` (la variante placée), `check_graine` (étendu : une cédule placée et son renfort se rejouent sur la graine).
- [ ] **L'écran dit ce que le moteur joue** : « Boston +2 ✦ » est exactement les deux étapes que `habillerLaLigue` donne à Boston ; les lignes d'une pièce sont ce qu'elle joue un soir où elle se lit — `check_chiffres` (réécrit : les plans du soir partent, le renfort et les pièces entrent), `check_impact` (réécrit : le profil d'un soir avec une pièce au lieu d'un plan).
- [ ] **La boutique** : elle n'ouvre qu'à ses sept nœuds ; le premier achat d'un nœud coûte le prix de base ; au plus quatre achats par nœud ; une pièce parmi trois, une seule achetable ; les jetons restants perdus après le 82e (ou convertis, selon JP) ; l'attentif achète 7 à 10 packs par saison — `check_rogue`, `check_packs` (la revente sous 40 % du prix reste).
- [ ] **Le départ** : l'équipe du départ médiane entre le 24e et le 28e rang de force sur 64 graines — `check_rogue`.
- [ ] **Le banc** : cinq cases, aucun séjour, repos, salaire ni niveau ; chaque pièce joue 30 à 50 % des soirs, se voit dans la feuille du soir où elle joue et n'est jamais un piège (jamais sous −0,5 V en paires sur un acte) ; le relais rend 1,2 à 1,6 fois la somme d'une paire — `check_pouvoirs` (devient le juge des pièces : ses bornes de 2,5 V, 4 V et 16 V partent), `check_relais`, `check_banc` (le salaire part), `check_moments_si`.
- [ ] **La courbe** : la part de points au classement de l'attentif monte d'un acte à l'autre en médiane, aux intervalles posés par la tranche 1 (pas en `teamStrength`) — `check_profondeur`.
- [ ] **Le robot « premier »** ne gagne pas la Coupe (au plus 2 sur 64) — `check_robot` (réécrit : sa campagne passe sur le robot des actes).
- [ ] **Le duel** : un seul choix avant le match (le plan et la mise), aucune décision d'entracte ; le rival montre son intention dominante et son style à son annonce ; deux clubs égaux, le meilleur plan fort contre « Ton match » : un avantage net, sous 60 % en face à face ; **chaque trio de plans que le banc peut proposer, sur toute la banque de pièces, n'a aucun plan qui domine les deux autres** sur les cinq intentions (meilleur ou égal contre chacune, et meilleur contre une) ; la mise ne touche jamais les cœurs et le bouton dit le prix exact — `check_duel` (réécrit : les propositions par période partent).
- [ ] **Les gros matchs** : au 82-0, les trois périodes vues sans choix (inchangé) ; en Rogue, seuls le rival, l'élite et la série sont des duels ; leur coach en séries tient — `check_gros` (réécrit : les rivaux du proprio, `MINI_BOSS` et le butin partent).
- [ ] **Les jambes** : la profondeur contre les vedettes, mesurée avec une pièce au lieu du plan « tirer » — `check_jambes` (réécrit à la tranche 6).
- [ ] **Les élites** : au plus une par acte, jamais la semaine du rival ni en séries, sans réponse un soir ordinaire ; la récompense suit la formule du § 4.5 ; **en paires**, le robot qui prend contre celui qui refuse : il gagne au moins autant de Coupes sur 64 et ne meurt pas plus d'une fois sur huit de plus — `check_elites` (neuf), `check_profondeur`.
- [ ] **Les histoires** : 9 à 13 fourches par saison, aucun trou de plus de trois semaines ; au plus 20 % des fourches à moins de 0,1 V entre leurs réponses ; une pièce au plus par fourche, deux par saison ; les autres sortent en nouvelles d'Hier soir avec leur voix et leur fait — `mesure_rythme` (réécrit à la tranche 8 : la run d'une saison, plus trois), `check_histoires`, `check_effets` (réécrit à la tranche 8 : l'écart des fourches ; ses bornes par niveau restent pour les réponses).
- [ ] **Les décisions** : au plus 90 par saison, dont au moins 30 vrais choix (§ 4.10), mesurés en paires sur deux états opposés — `mesure_decisions` (neuf ; une information jusqu'à ce que la définition soit codée, puis rouge au-dessus de 90).
- [ ] **La méta** : en paires, le taux de Coupes **avec tous les déblocages et sans aucun** ne diffère pas de plus de 3 points sur 64 graines ; de même au premier et au dernier rang de prestige ; le catalogue de variété est chiffré dans la page des règles — `check_rogue`, `check_profondeur`.
- [ ] **Les vieilles sauvegardes** : une partie de chaque forme d'avant (saison 1, saison 2+, en séries, au milieu d'un duel, avec des déblocages de force) s'ouvre sans erreur, verse ses 🏅, rembourse ses déblocages qui partent, et commence une run neuve — `check_sauvegardes`.
- [ ] **Les écrans** : la maquette de la tranche 0 reproduite ; Hier soir en tête de Ce soir, Ce soir en 1,0 écran ; l'affiche à 240 px ; la plaque (« Acte I », « 22e / 20 », les cœurs dessinés et lus) ouvre le Proprio ; le banc en cinq cartes de front ; le soir de fin d'acte dans son ordre, chaque étape une ligne qui bloque ; le verso agrandi porte « Prendre », retourner une carte referme l'autre ; le rang une seule fois — `check_plateau` (contrat réécrit), `check_hauteur`, `check_clarte`, `essai_rogue` (`CAPTURES_PAGES=1`).
- [ ] **Les juges qui partent** : `check_deck` et `mesure_deck` (tranche 5 : la main du deck part ; ce qu'ils prouvaient de l'atelier reste à `check_atelier`) ; `mesure_main` (tranche 5 : plus de main) ; `check_plan_de_match` (tranche 6 : le plan du soir part ; « Ton match ne change rien » passe à `check_duel`).
- [ ] **Les juges réécrits, un par un, et leur tranche** : `check_profondeur` (tranche 1 : sa partie 1, « mener une vraie équipe » sur quatre saisons, devient une saison en actes ; sa partie 2, les campagnes de douze runs, et « regagner après la Coupe » (`APRES`) partent, remplacées par le taux de Coupes par run et, après la Coupe, les exigences) ; `check_robot` (tranche 1) ; `check_rogue`, `check_calendrier`, `check_graine` (tranches 2 et 4) ; `check_gros` (tranches 2 et 6) ; `check_chiffres`, `check_impact` (tranches 4 et 5) ; `check_pouvoirs`, `check_banc`, `check_relais` (tranche 5) ; `check_duel`, `check_jambes` (tranche 6) ; `check_elites` (neuf, tranche 7) ; `mesure_rythme`, `check_effets`, `mesure_decisions` (tranche 8) ; `check_sauvegardes` (tranches 2, 5 et 9) ; `check_plateau` (tranches 2 à 6 et 10).
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées — `check_refonte` (sur chaque tranche, avec son extrait `docs/refonte-v27-<n>.md` ; pour 2 à 6, sur leur somme).
- [ ] Rien de mort — `check_mort`.
- [ ] À juger par JP à l'essai : le rival annoncé donne envie de bâtir vers lui ; perdre un cœur fait mal sans finir la soirée ; le banc de cinq fait des combos qu'on sent ; la run se joue en une soirée ou deux.

## Les tranches

Les campagnes lourdes tournent en CI (`profondeur.yml`), jamais sur le PC de JP. Chaque tranche porte son extrait `docs/refonte-v27-<n>.md` (ce qui part dans cette tranche) pour `check_refonte`.

**0. Les maquettes** — tous les écrans neufs du § 4.11, à 390 × 844, sur le canevas privé de JP (comme les écrans du Rogue) : Ce soir et ta plaque, le rival annoncé, le calendrier de l'acte, l'élite du lundi, le choix du duel, l'entracte, le soir de fin d'acte, le contrôle et le cœur, la pièce à prendre et le banc plein, la boutique, « La run continue », l'écran de fin, la vieille sauvegarde, le Proprio. **JP tranche sur les maquettes ; aucune ligne de code.** *Le joueur ne voit rien.*

**1. Le juge neuf** — le prototype (`jouerSaisonActes`, l'échange de cédule, les rivaux, les cœurs, le renfort neuf, les nœuds, la bande du départ) devient `scripts/lib/rogue_actes.mjs`, le robot du dépôt, avec le glouton ; `check_profondeur` et `check_robot` le lisent sur 64 graines ; `profondeur.yml` entre. Aucune ligne du jeu ne change ; **elle peut fusionner seule**. *Le joueur ne voit rien.* Juge : `check_profondeur` reproduit la cible sur l'ancien banc avec 2 ❤️, et dit le temps de la campagne.

**2 à 6, ensemble** — construites sur une branche à part (`claude/v27-run`), une PR par tranche vers cette branche, chacune son extrait et ses juges ; la branche sort vers main **en une fois**, quand la cible est remesurée sur le vrai banc (R1, `profondeur.yml` vert) et que `check_refonte` passe sur leur somme. **Le jeu publié ne change qu'une fois.** Les écrans de ces tranches reproduisent les maquettes de la tranche 0, et D1b s'y fait.
- **2. Une saison, quatre actes, deux cœurs** — js/actes.js : les actes, les rivaux annoncés un par acte et leur jeu montré, les points de contrôle proportionnels, les séries plus dures, le départ à 35-55 % ; les saisons de plus, le mandat, la marche, les gardés et les rivaux du proprio partent. *Le joueur voit l'acte et ses cœurs dans sa plaque, le rival de l'acte annoncé avec son style, et la run finir à la Coupe, à 0 ❤️ ou à l'acte III raté.* Juge : `check_rogue` (réécrit), `check_gros`, `check_profondeur`, `check_sauvegardes`, `essai_rogue`.
- **3. La boutique à ses nœuds** — sept ouvertures, le prix remis à zéro, quatre achats au plus, la pièce parmi trois (à brancher sur *PIECES* de la tranche 5, d'où le regroupement). *Le joueur voit la boutique fermée entre deux nœuds, « dans N matchs », ses packs moins chers à chaque ouverture et une pièce à vendre.* Juge : `check_rogue`, `check_packs`, `check_profondeur`.
- **4. Le calendrier placé et le renfort** — l'écran du calendrier de l'acte, l'échange en deux touchers, le renfort compté depuis l'origine, le « +2 ✦ » qui suit le club. *Le joueur choisit au premier soir de chaque acte qui il affronte quand, et voit ce que ça coûte partout où le club apparaît.* Juge : `check_rogue`, `check_calendrier`, `check_graine`, `check_chiffres`, `check_profondeur` (variante placée), `essai_rogue`.
- **5. Le banc de cinq** — js/pieces.js : pouvoirs, adjoints et plans fondus en *PIECES*, sans niveau, à leur présence réelle ; le coach et sa pièce de départ, la pièce des rivaux ; séjour, repos, salaire, main, expérience, talents, niveaux d'adjoint et main du deck partent. *Le joueur voit cinq cartes sur son banc, qui restent, et une pièce à prendre après chaque rival battu.* Juge : `check_pouvoirs` (réécrit), `check_relais`, `check_banc`, `check_moments_si`, `check_impact`, `check_profondeur` (le glouton), `check_sauvegardes`.
- **6. Le duel à un choix** — le plan fort d'avant-match et la mise sur le même écran ; le plan du soir, les propositions par période et l'entracte à choix partent. *Le joueur choisit une fois avant le rival, puis vit le match ; les soirs ordinaires n'ont plus de plan à régler.* Juge : `check_duel` (réécrit), `check_gros`, `check_jambes`, `essai_rogue`.

**Ensuite, une PR chacune vers main** :
- **7. Les élites** — la proposition du lundi, le duel, la récompense chiffrée, le cœur perdu ; mesurées en paires. *Le joueur peut, une fois par acte, risquer un cœur contre un gros club pour une pièce et des jetons.* Juge : `check_elites` (neuf), `check_profondeur`.
- **8. Les fourches** — une histoire aux 2 ou 3 semaines, de vraies fourches à prix en stats, les autres en nouvelles d'Hier soir. *Le joueur reçoit moins d'histoires, mais chacune est un vrai choix.* Juge : `mesure_rythme`, `check_histoires`, `check_effets`, `check_clarte`, `mesure_decisions` (neuf).
- **9. La méta en variété** — les déblocages de force partent et sont remboursés, le catalogue de variété, les jalons et les exigences réécrits, le prestige selon JP (et la Dynastie si JP l'écrit, § 11.1). *Le joueur dépense ses 🏅 pour d'autres coachs, pièces, pochettes et époques.* Juge : `check_rogue` (aucun déblocage de force), `check_profondeur` (méta en paires, exigences), `check_sauvegardes`.
- **10. L'ordre de Ce soir** — seulement l'ordre : Hier soir en tête, l'affiche, la plaque, le banc, tes choix, le bouton, en 1,0 écran (les autres écrans sont faits aux tranches 2 à 6). *Le joueur voit Ce soir commencer par hier.* Juge : `check_plateau`, `check_hauteur`, `essai_rogue` (`CAPTURES_PAGES=1`), `check_mort`.

## 11. Les questions qui restent à JP

Fermées par la revue et JP : les contrôles et les cœurs (décision 1), le rival perdu (sans cœur, il ne donne rien et laisse les sonnés), les cœurs regagnés (jamais), la récompense d'élite (une pièce et des jetons, § 4.5), la main du deck (la recrue et le rôle partent, l'atelier reste dans la banque ; la boutique vend des pièces), la courbe par acte (la mesure tranche), le vrai choix (§ 4.10), le mot « rival » (décision 6).

1. **La Dynastie** (une saison de plus après la Coupe) : l'écrire en règles dans la V27, ou la sortir de la V27 ? — **Recommandé : la sortir** ; une run = une saison reste net, et la Dynastie se fera dans un devis à part après la mesure (le nom est aussi celui du dernier rang de prestige).
2. **Le prix d'une pièce en boutique** : 32 🪙 au premier achat d'un nœud, puis la hausse des packs ? — **Recommandé : oui**, la mesure règle entre 24 et 40.
3. **Les jetons qui restent après le dernier nœud** : perdus, ou convertis en 🏅 ? — **Recommandé : perdus**, l'écran du 82e nœud le dit ; une conversion pousserait à garder au lieu d'acheter.
4. **Ce que paient les jetons** : seulement les packs et la pièce (les clubs et couleurs passent en 🏅) ? — **Recommandé : oui**, une monnaie par horizon.
5. **La méta** : combien de runs pour tout débloquer ? Le catalogue chiffré fait ≈ 1 100 🏅, soit ≈ 18 runs. — **Recommandé : ≈ 15 runs** (les prix baissés d'un cinquième).
6. **Le prestige** : de la force (ses taux d'Étoiles, son budget du classeur) ou de la variété seulement ? — **Recommandé : variété** ; le rang reste un titre, ses taux et son budget partent, et la mesure en paires le prouve.
7. **La mise avant le match** (déduite de « aucune décision d'entracte ») : la mise de la 3e devient une mise posée avec le plan, avant le match ? — **Recommandé : oui**.
