# V30 — Le Rogue redevient une saison, et tu en es le DG

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 16 nov. 2026. **Rien n'est codé.** JP a tranché trois questions avant le devis, donné la base et la cible (§ 1), tranché les trois dernières (§ 10), puis, après la revue (§ 11), dix autres (§ 12). **Le § 12 prime sur ce qui le contredit plus haut** ; les § 3.1, 3.3 et 3.5 sont repris, le reste se reprend à l'extrait de sa tranche. La suite : la tranche 0.

## En une page

**Le constat.** La V28 a remplacé la saison par une carte de dix-huit matchs choisis. Ce qu'elle a gagné : chaque match se lit, chaque victoire donne une signature, le banc (V29) fait que bâtir paie (70 % de cibles tenues contre 54 %). Ce qu'elle a perdu, et que JP nomme : il n'y a plus de ligue, plus de classement, plus de course aux séries, plus de stats qui s'accumulent — et aucun geste de directeur général. On signe un joueur derrière une porte ; on ne gère rien.

**Le piège, dit d'avance.** « Les 82 soirs, joués » est la forme de la V3 à la V27. Elle est morte vingt fois de la même mesure : 82 soirs presque pareils se feuillettent, « Jour suivant » touché 186 fois, et chaque système de décision posé dessus pesait à peu près zéro victoire (docs/refonte-v28.md § 2). Y revenir tel quel, c'est refaire la V27.

**Ce qui est différent cette fois, et qui doit le rester :**

1. **Chaque soir a sa feuille** (JP, 16 nov., § 3.3) : les 82 matchs passent par la feuille du soir et les temps forts de la V28, pas par un bouton « Jour suivant » sur une page. Le devis recommandait la semaine d'un toucher ; JP a choisi le soir, en sachant ce qu'il coûte (une saison de quatre à cinq heures).
2. **Chaque soir, tes lignes et ton gardien, et ça doit peser** (JP, 16 nov. : *lignes et gardiens, mais faire que ça a un impact*). Les systèmes de ligne de la V18 sont morts « dans le bruit » : celui-ci se mesure avant d'être codé (tranche 0), et rouge, on ne code pas. Ton club change par les cartes : les pochettes et les portes. **Aucun échange** (JP, 16 nov.).
3. **Les gros matchs restent des scènes.** Le rival, l'élite, les séries : la feuille du soir, le match en temps forts, comme aujourd'hui. Environ dix-huit par saison, les cases de la carte d'aujourd'hui.
4. **Le bureau est fait de tableaux.** La masse salariale, l'alignement, le classement, les meneurs : dense, lisible, triable. Les scènes illustrées de la direction C gardent le match et les portes ; elles quittent la gestion.

**Ce qui reste** : le simulateur, les vrais joueurs et leurs cartes, le banc de la V29 et ses neuf pièces, les portes, le plafond, les coachs, les histoires, les médailles, l'Album.

**Ce qui part** : la run de dix-huit matchs sans ligue, ses cibles en points sur 14, le camp de trois tours de portes, les dos-à-dos posés à la main, la carte de l'acte comme accueil et comme choix d'adversaires (§ 7).

**La base** (JP, 16 nov., après le premier jet de ce devis) : l'ancien mode, la saison et son bureau, refait du début ; le roguelike s'intègre à la gestion, il n'est plus posé à côté d'elle.

## 1. Ce que JP a dit

JP, 16 nov. 2026 : *not gonna lie, j'hais le nouveau rogue, c'est plus une vraie saison, pis l'interface, oui est fun, mais pas vraiment gestion feel*.

Ses trois réponses, le même jour :

- **La saison** : *les 82 soirs, joués* (devant trois autres choix : la ligue simulée autour de dix-huit cases, une run plus longue, autre chose).
- **La gestion**, les quatre ensemble : *des gestes de DG* (les échanges, les contrats, le ballottage, la date limite) ; *un bureau, pas des scènes* (la masse salariale en tableau, l'alignement en feuille, le classement) ; *mon club dans le temps* (les stats de la saison, les séquences, les blessés, les meneurs) ; *bâtir un alignement de 23* (un vrai repêchage, pas un joueur par porte).
- **Le départ** : d'abord *on garde la carte, on corrige* ; puis, en lisant le premier jet du devis : *en gros, reprend l'ancien mode, mais refait du début afin de mieux intégrer le rogue like dans la gestion*. La base est donc la saison et son bureau ; de la run en carte restent ses pièces de roguelike (le banc de la V29, les portes, le rival, l'élite, les cœurs, le marché), rangées dans la saison.
- **« Refait du début »** : l'ancien mode n'est pas ressorti de l'historique de git. Il est supprimé depuis le 11 nov. (`ouvrirSaison`, ≈ 3 000 lignes, le Bureau en enveloppes, la boîte, les cinq portes) et il le reste ; ce qui revient, c'est sa forme (une ligue, 82 soirs, un bureau), écrite à neuf.

- **La cible, en une phrase** (16 nov., après le devis) : *en gros, je veux un EHM, mais avec un côté rogue*. Eastside Hockey Manager : le bureau est l'accueil, tout se lit en tableaux denses et triables (l'effectif, les salaires, le classement, les meneurs, la cédule), on avance d'un soir par « Continuer », le match se suit en texte et en chiffres, et le DG échange, signe, rappelle et réclame. Le côté rogue : une run d'une saison, une graine, la mort possible (les cœurs du proprio), le banc et ses pièces, la récompense qu'on choisit, les médailles. Les maquettes de la tranche 1 se jugent là-dessus : est-ce que ça se lit comme EHM à 390 px ?

Ce qu'il a dit avant, et qui tient encore :

- *le jeu se joue tout seul, je n'ai pas beaucoup d'impact* (7 oct.) ; *le Rogue est brain dead* (16 oct.).
- *calendrier réel pour toutes les équipes, mais tu choisis les équipes qui vont quand* (7 nov.).
- *tu devrais jamais simuler d'avance* (S79).
- *pas facile, mais tu peux exploser le jeu* (8 oct.) ; *le build décide* (13 nov.).
- *une run ne dépend plus des autres* (12 nov.).
- *j'hais l'interface. On dirait pas un vrai jeu* (9 nov., devant le Bureau en pages de la V27).

**Deux de ses mots tirent en sens contraire, et le devis doit le dire** : le 9 nov., le Bureau et ses pages « ne faisaient pas un vrai jeu » ; le 16 nov., les scènes « ne font pas gestion ». La réponse proposée n'est ni l'un ni l'autre : des tableaux là où on gère, des scènes là où on joue, et jamais une boîte de réception qu'on vide.

## 2. Ce que le joueur ressent

**Le fantasme** : je suis le DG. J'ai bâti ce club de 23 sous le plafond, je le suis soir après soir au classement, et c'est ma main sur les lignes et mes cartes qui le mènent aux séries.

- **Le jour ordinaire** : la feuille du soir, le match en temps forts ou d'un toucher, puis le classement qui bouge et qui est en feu.
- **Le pic** : le gros match en scène ; la pochette qui sort le joueur qui manquait à ton banc ; le soir où la place en séries se joue.
- **Les boucles** : le soir (la feuille, le match, le bureau) ; le quart de saison (le bilan du proprio, le marché) ; la saison (le repêchage, 82 matchs, la date limite, les séries).

## 3. Les règles du jeu

Écrites pour la forme recommandée ; les trois questions du § 10 sont tranchées.

### 3.1 Le départ : un repêchage de 23, dans des clubs faibles

- Le coach et son banc se choisissent comme aujourd'hui.
- Puis **le repêchage** : la roulette sort un vestiaire, tu y piges un joueur, vingt-trois fois, sous le plafond. C'est le repêchage du 82-0 (js/repechage.js), dans le monde du Rogue (toutes les années ensemble).
- **Dans des clubs du bas de l'échelle** (JP, 16 nov.), avec 4 M$ d'espace gardé sous le plafond : pas de Gretzky au soir 1, ton club grandit par les cartes.
- Il remplace le club de départ donné et le camp de trois tours de portes.
- Les vingt-trois comptent pour le banc ; **les seuils des pièces se reposent pour 23 joueurs** (§ 4, § 11 point 3), et la borne « aucune marche d'office » se juge sur le robot qui ne lit pas son banc au repêchage.

### 3.2 La ligue

- Trente et un autres clubs, tirés du monde de la run, avec une vraie cédule de 82 matchs et un vrai classement. `creerLigue` et `jouerJournee` (js/sim.js) le font déjà pour le 82-0 ; rien n'est simulé d'avance.
- Les dos-à-dos, les voyages, les séquences viennent de la cédule ; ils ne sont plus posés à la main.
- **La cible** n'est plus « 8 points sur 14 » : c'est ta place au classement à la fin de chaque quart. Sous la ligne des séries au bilan d'un quart, le proprio retire un cœur. Deux cœurs.

### 3.3 Le soir : le bureau, la feuille, le match

JP, 16 nov. : *chaque soir, sa feuille* ; *je veux un EHM, mais avec un côté rogue* ; *bureau EHM, match illustré* ; *lignes et gardiens, mais faire que ça a un impact*.

- **L'accueil est le bureau** : ses tableaux, et en tête un fil de nouvelles court (une blessure, un retour, le bilan du proprio, une pochette gagnée). Ce n'est pas une boîte à vider : rien n'y attend une réponse.
- **« Jouer ce soir »** ouvre la feuille du soir, illustrée comme aujourd'hui : l'adversaire et son jeu, la cédule (un dos-à-dos, un voyage), les jambes.
- **Ta décision du soir** : tes lignes, qui s'assoit, quel gardien part. Les leviers que le moteur lit déjà : les jambes (un dos-à-dos coûte, la cédule en pose de vrais), le gardien fatigué et son auxiliaire, un blessé qui joue amoché ou s'assoit, les accords d'une ligne, la carrure face à leur jeu.
- **Ça doit peser** : à la tranche 0, un robot qui règle ses lignes et son gardien chaque soir contre le même robot qui ne touche à rien, les mêmes saisons, en paires, en points sur 82. Sous le bruit, c'est le système de ligne de la V18 une deuxième fois : on le dit à JP avec les chiffres et on ne code pas.
- **Le match** en temps forts, illustré, qu'on peut mener à la fin d'un toucher ; puis le résultat, le classement qui bouge, et retour au bureau.
- **Les gros matchs** (le rival de chaque quart, les élites, les affiches contre un club voisin au classement : environ dix-huit) sont des duels en trois périodes, avec leur intention.
- **Ce que ça coûte** : une saison de quatre à cinq heures, plus les séries. Une run se quitte et se reprend n'importe quel soir.

### 3.4 Le roguelike dans la saison

La carte de l'acte part : l'accueil est le bureau, et la cédule dit qui on affronte. Chaque pièce du roguelike prend sa place dans la saison :

- **L'acte est un quart de saison** (vingt ou vingt et un matchs). Au bout de chacun, **le rival** : le club le plus près de toi au classement parmi ceux de la fin du quart, annoncé au début du quart, et son match compte double au bilan.
- **Les cœurs sont la confiance du proprio, et il a plusieurs objectifs** (JP, 16 nov. : *avoir plusieurs objectifs, variables selon force de l'équipe, de la ligue, etc. S'assurer qu'un bon DG va réussir plus qu'un mauvais*). Au début de chaque quart, il en pose deux ou trois, calés sur la force de ton club dans cette ligue-là (les points du quart qu'un club de ta force fait, le rival, une mesure de jeu) ; au bilan, la majorité manquée coûte un cœur ; à zéro, tu es congédié. Le critère : en paires, le robot attentif perd moins de cœurs que le naïf, au-delà du bruit, quelle que soit la force du club de départ.
- **L'élite** : un match de la cédule contre un club du haut, marqué d'avance ; tu choisis d'y mettre l'enjeu ou non (gagné, une pièce de banc et des jetons ; perdu, des sonnés et des jetons, jamais un cœur).
- **La récompense qu'on choisit** : trois portes après un gros match gagné, une pièce de banc parmi trois au rival battu.
- **Les séries sont les vraies** (JP, 16 nov.) : les seize premiers du classement, ton adversaire selon ton rang, quatre rondes en 4 de 7, chaque match avec sa feuille ; hors des seize, la run finit. Leur banc grandit de ronde en ronde, comme à la V29.
- **Le banc** (V29) : tes cinq cases et leurs pièces, qui comptent les badges de tes joueurs ; une carte qui entre change donc ton banc, et c'est la raison de bâtir.
- **Le marché** est au bureau : les pochettes entre deux matchs ; à la fin de chaque quart, une pièce de banc parmi trois et une carte à monter.
- **Les histoires** arrivent quand leur fait est vrai dans ta saison ; elles lisent de nouveau le classement et les meneurs de la ligue.
- **La run** reste une run : une graine, une saison, la mort possible, les médailles à la fin, les exigences 🔺.

### 3.5 Les gestes du DG

- **Aucun échange** (JP, 16 nov. : *pas d'échange, juste packs de cartes*). Ton club ne change que par des cartes.
- **Les pochettes** s'achètent en jetons au bureau, entre deux matchs. Deux sortes aujourd'hui (le Bronze, l'Époque) ; une sorte neuve se mesure d'abord (la règle du 11 nov.).
- **Les trois portes** restent la récompense d'un gros match gagné (JP : *packs et portes*).
- **Une carte qui entre sort un joueur.** Ce que son salaire libère n'est pas tranché (§ 12) : la tranche 0 joue les trois règles (0 %, 50 %, 100 %) sur les mêmes saisons.
- **Le ballottage, seulement s'il le faut** (JP : *seulement si aucun remplacement possible*) : un blessé se remplace d'abord par un de tes réservistes ; si personne chez toi ne peut tenir sa case, le jeu s'arrête et tu réclames un vrai joueur pas cher parmi trois, le temps de la blessure.
- **Pas de contrat à gérer** : un salaire, rien d'autre. **Pas de date limite** : sans échange, elle n'a rien à fermer.

### 3.6 Le bureau

Quatre tableaux, un seul écran chacun à 390 px, sans boîte de réception :

- **L'alignement** : les lignes, les jambes, les blessés, la marche de chaque pièce du banc.
- **La masse** : les vingt-trois salaires, le plafond, qui expire.
- **La ligue** : le classement, la ligne des séries, la cédule de la semaine, les meneurs.
- **Mon club** : les stats de la saison de chacun, ses dix derniers matchs, sa séquence.

Les maquettes en deux ou trois directions franchement différentes viennent après les réponses du § 10 ; JP tranche dessus avant le code.

## 4. Les chiffres

À mesurer, pas à deviner. Une tranche 0 (un script, rien du jeu touché), comme pour la V28 et la V29 :

- **La durée** : une run d'aujourd'hui compte dix-huit matchs et les séries. quatre à cinq heures à un soir par feuille, acceptées par JP le 16 nov. ; la mesure dit le vrai chiffre.
- **Le banc sur 23 signés** : les seuils des neuf pièces ont été posés pour un club qui signe un joueur à la fois ; avec vingt-trois signés d'entrée, la deuxième marche risque d'être d'office. Borne gardée de la V29 : chez qui ne bâtit pas, la deuxième marche au plus 60 % du temps.
- **Les lignes et le gardien** : le robot qui les règle chaque soir contre le même robot qui n'y touche pas, en paires, en points sur 82 ; l'écart doit sortir du bruit.
- **Le salaire libéré** par un joueur qui sort : 0 %, 50 % et 100 % joués sur les mêmes saisons (combien de cartes entrent, si le plafond se sent).
- **Les objectifs du proprio** : calés sur la force du club dans sa ligue ; le robot attentif perd moins de cœurs que le naïf.
- **La difficulté** : les bornes de JP du 14 nov. tiennent (la Coupe 4 à 12 fois sur 64, une run sur quatre qui explose), remesurées sur la saison.
- **Les jetons** : gagnés sur 82 matchs au lieu de dix-huit ; les prix du marché se reposent.

## 5. Les cas limites

- **Une run en cours** de la V29 : soldée à l'ouverture, ses médailles versées une fois, comme le 14 nov. (`VERSION_DE_LA_RUN`). Les clés de sauvegarde ne bougent pas.
- **L'alignement sous 23** après une blessure : un réserviste, sinon le ballottage (§ 3.5), jamais un trou.
- **Le plafond dépassé** par une offre : refusée avant d'être proposée, avec le montant qui manque.
- **Une pochette ouverte sans espace sous le plafond** : la carte se refuse ou sort un joueur, selon la règle du salaire libéré (§ 12).
- **Hors ligne** : rien de neuf à charger sauf les modules du bureau (`sw.js`).
- **Le clavier et la manette** : un tableau se parcourt aux flèches, une ligne s'ouvre à la touche d'action.

## 6. Ce qu'il touche

- **Le jeu** : js/run.js (réécrit autour de la ligue), js/run-scenes.js (les scènes de la carte et du camp partent, celles du match et des portes restent), js/run-jeu.js, js/pieces.js (les seuils), js/actes.js, js/repechage.js (ouvert au Rogue), js/sim.js (`creerLigue` lue par la run ; le moteur ne bouge pas, `VERSION_MOTEUR` reste), un module neuf pour le bureau, style.css, sw.js.
- **Les robots et les juges** : scripts/lib/run_robot.mjs, `mesure_run`, `check_run`, `check_scene`, `essai_run`, `check_pouvoirs`.
- **Les règles fermes** de `.claude/rules/rogue.md` qui se défont, avec leur décision :
  - « la run n'a pas de cédule, le soir se dit au moteur » (11 nov., V28 tranche 4) : défaite, la cédule revient ;
  - « une saison de 82 soirs ne peut que se feuilleter » (V28 § 2) : défaite par JP le 16 nov. (*chaque soir, sa feuille*) ; il en reste un garde-fou, la feuille d'un soir ordinaire doit donner une raison de la lire ;
  - « l'allure C partout » (9 nov.) : restreinte au match, aux portes et aux séries.
- **Le 82-0, Sur table, l'exhibition** : aucun ne change.

## 7. Ce qui part

La liste ferme se fige à l'extrait de chaque tranche, après les réponses du § 10 : `check_refonte` vérifie chaque nom écrit entre accents graves, et un nom écrit trop tôt serait compté parti à tort (la leçon de la V28). Ici, en italique, ce qui part selon la forme recommandée, cherché dans js/ le 16 nov. 2026 :

- **La run de dix-huit matchs** (js/run.js, 983 lignes) : *RUN.MATCHS*, *RUN.CIBLES*, *RUN.CAMP*, *RUN.BANDE_DU_CAMP*, *RUN.RIVAUX* et *RUN.BANDES* comme tirage des adversaires → la ligue et sa cédule.
- **La carte de l'acte** : *LARGEURS*, *RANGS_D_ARRETS*, *RANG_DE_L_ELITE*, *suivantes*, *casesOffertes*, *caseA*, *allerA*, *sceneCarte*, *sceneAnnonce* → la cédule et le bureau.
- **Les dos-à-dos posés à la main** : *RANGS_DE_DOS_A_DOS*, *dosADosA* → la cédule.
- **Le rachat** : *RUN.RACHAT* et *masseApres* restent ou partent selon la règle du salaire libéré (§ 12, après la tranche 0) ; *sceneEchange* (l'arrivant face à celui qui sort) reste.
- **Le camp** : *sceneDepart* (le club donné), les tours de portes du camp → le repêchage de 23.
- **La cible de l'acte** : *sceneFinDActe* et la jauge de points → le bilan du quart au classement.
- **Les scènes de gestion illustrées** : *sceneLignes*, *sceneVestiaire*, *sceneBanc* → les tableaux du bureau.

**Ce qui reste, et pourquoi :**

- **Le simulateur** (`playGame`, `simulerGrosMatch`, `creerSeries`) : JP, 9 nov.
- **Le banc et ses neuf pièces** (js/pieces.js) : la V29, tenue ; ses seuils se remesurent.
- **Les cartes de hockey, les pochettes, l'Album, les médailles, les exigences** : JP, deux fois ; la méta du 11 nov.
- **La feuille du soir, le match en temps forts, les portes, les séries** (`sceneFeuille`, `sceneMatch`, `scenePortes`, `sceneSeries`) : *oui est fun*.
- **Les coachs et leurs règles, les histoires et leurs voix.**
- **`creerLigue`, `jouerJournee`, `bilanLigue`** (js/sim.js) et **le repêchage** (js/repechage.js) : ils existent pour le 82-0, la run les lit au lieu de les récrire.

**Le test du zéro** : la ligue, le bureau et le soir s'écrivent depuis le § 3 sans relire la carte ; js/run.js se repart d'un fichier neuf.

## 8. Les réglages

Posés à la tranche 0, sur mesure : la longueur d'un quart (20 ou 21 matchs), le nombre de gros matchs par quart (4 à 5), la bande de force du repêchage, les seuils des pièces sur 23 joueurs, le nombre et la hauteur des objectifs du proprio, le prix des pochettes sur 82 matchs.

## 9. Les critères d'acceptation

- [ ] Chaque soir a sa feuille, et un soir ordinaire se passe en deux touchers au plus (la feuille, la fin du match) — `essai_run` (compté).
- [ ] Une run se quitte et se reprend à la feuille de n'importe quel soir, la même graine rejoue le même match — `check_run`.
- [ ] La ligue est une vraie ligue : 82 matchs par club, un classement qui se recompte, rien de simulé d'avance — `check_run`.
- [ ] Régler ses lignes et son gardien paie : en paires, en points sur 82, au-delà du bruit — `mesure_run`.
- [ ] Un bon DG garde ses cœurs plus souvent qu'un mauvais, quel que soit son club de départ — `mesure_run`.
- [ ] Bâtir paie encore, et le banc n'a aucune marche d'office sur 23 signés — `mesure_run`, `check_pouvoirs`.
- [ ] Les bornes du 14 nov. tiennent : la Coupe 4 à 12 fois sur 64, une run sur quatre qui explose — `mesure_run` (256 graines).
- [ ] Chaque tableau du bureau tient en un écran à 390 px — `check_scene`.
- [ ] Le moteur ne bouge pas : le 82-0 se rejoue au but près — `check_empreinte`, `check_feuilles`.
- [ ] Pas une couche de peinture — `check_refonte` sur l'extrait de chaque tranche.
- [ ] À juger par JP à l'essai : est-ce une saison ? est-ce que je me sens DG ?

## Les tranches

0. **Le test d'un jour** : la saison de 82 jouée par les robots dans un script — le repêchage de 23 dans des clubs faibles, les lignes et le gardien réglés ou non, les trois règles du salaire libéré, les objectifs du proprio, les vraies séries ; la durée, le banc sur 23, la difficulté, les jetons. Un hasard par match de la cédule, pour que les paires tiennent. Rien du jeu touché. Rouge : on ne code pas.
1. **Les maquettes** du bureau, à 390 × 844, deux ou trois directions ; JP tranche. Faites avec `/hors-moyenne` (JP, 16 nov. : *utiliser le skill anti algorithm et faire UI pensé comme par un humain avec padding, position des éléments, etc., tout doit avoir un sens, une logique*) : chaque maquette porte sa légende — pour chaque bloc, pourquoi il est là, à cette place et à cette taille, pourquoi cet espace autour — et un élément sans raison écrite sort de la maquette.
2. **La ligue sous la run** : js/run.js réécrit, la cédule, le classement, le soir et sa feuille, le bilan du quart.
3. **Le repêchage de 23** au départ ; le camp part.
4. **Le bureau** : les quatre tableaux ; les scènes de gestion partent.
5. **Les gestes du DG** : les lignes et le gardien du soir, les pochettes au bureau, le ballottage s'il le faut, les objectifs du proprio.
6. **Le réglage** sur 256 graines neuves, les règles de `.claude/rules/rogue.md` réécrites.

`/revue-design docs/refonte-v30.md` passe avant la tranche 0.

## 10. Tranché par JP (16 nov. 2026)

1. **Le rythme des 82 soirs** : *chaque soir, sa feuille*. Écartés : la semaine d'un toucher avec dix-huit gros matchs en scène (recommandée), le soir en une ligne.
2. **Une saison ou plusieurs** : *une saison*. Le contrat est un salaire et « expire ou non ». Écartée : la carrière de trois saisons.
3. **Les portes** : *après un gros match gagné*. Écartés : après chaque victoire, plus de portes.
4. **La base**, en cours de devis : l'ancien mode refait du début ; la carte de l'acte ne reste pas l'accueil (§ 1, § 3.4).

## 11. La revue du 16 nov. 2026 — « À reprendre »

`/revue-design`, quatre relecteurs en adversaires (`rogue-design`, `rogue-ux`, `rogue-equilibre`, `rogue-economie`). Les neuf parties y sont ; « Ce qui part » nomme ses noms en italique, à figer par tranche. Le verdict : **À reprendre**, la tranche 0 ne commence pas avant les réponses de JP. Ce qui casse, du plus grave :

1. **Les 64 soirs ordinaires n'ont aucune décision** (§ 3.3). La feuille n'a plus de choix depuis la V29, le bureau ne reçoit qu'une à trois offres par quart : on feuillette 64 feuilles, la forme morte de la V27. Le critère « deux touchers au plus » écrit le feuilletage dans l'acceptation.
2. **Le soir n'a pas de parcours** (§ 3.3, § 3.4, § 3.6) : le bureau est dit l'accueil, la run reprend à la feuille ; rien ne dit où est la porte du bureau, ni l'écran du résultat. Le HUD n'est pas redéfini (« l'acte et la case, la cible en points » n'existent plus).
3. **Le banc sur 23 signés d'entrée** (§ 3.1). Mesuré à la main sur 400 clubs de 23 tirés du quart du haut, sans plafond : la deuxième marche tombe pour les passeurs 81 %, les tireurs 69 %, les deux sens 64 % (la borne est 60 %), la troisième des passeurs 36 % (borne 25 %) ; l'étouffoir, les cols bleus et la muraille n'atteignent presque jamais leur première (0 %, 8 %, 9 %). « Seuls tes signés comptent » ne distingue plus rien ; le build se décide au repêchage, et la courbe d'une run devient plate.
4. **La difficulté n'a plus de levier** (§ 3.2). `ETAPES` par acte et `BANDES` n'ont pas de prise sur 31 clubs fixes. Sur 20 matchs, un club médian est sous la ligne une fois sur deux, un club bien repêché jamais : la cible est pile ou face, ou gratuite. Lu au classement cumulé, un mauvais premier quart congédie au soir 41 par inertie.
5. **Le plafond ne mord plus** (§ 3.5). Le rachat part, le repêchage remplit jusqu'au plafond : zéro espace contre 4 M$ aujourd'hui, une porte ne montre que des joueurs au minimum.
6. **L'échange est un arbitrage gratuit** (§ 3.5). Le club juge la cote et le salaire, toi les badges : le bon badge à cote égale est toujours accepté ; à +15 % de marge, la chaîne vole ; aucune limite de nombre ; la « valeur » n'a pas de formule. Et il n'a pas d'écran : d'où on l'ouvre, où se lit le refus, où arrivent leurs offres.
7. **Les paires sont cassées** (§ 4). `jouerJournee` tire tous les matchs d'un soir d'un seul flux : un échange décale les dés des 31 autres clubs. Un hasard par match de la cédule touche le moteur ; le critère « le moteur ne bouge pas » se réécrit (le 82-0 se rejoue au but près, la ligue de la run a son propre tirage).
8. **Le contrat et le ballottage sont décoratifs** en une saison à 23 pile : « expire » n'existe pas dans les données (un montant, aucune durée) et un rabais sans lendemain se prend toujours ; personne ne sort au ballottage.
9. **L'économie posée pour 22 matchs** (§ 4) : environ 650 jetons gagnés pour 460 à dépenser, 200 en caisse contre 69 ; la prime du coach épuisée au 55e match ; les galons (10 buts, 20 points) gravés par tout le premier six ; les médailles par heure au tiers, la première Coupe à la troisième run vers douze heures de jeu ; les crans d'exigence n'ont plus de cible en points.
10. **Quatre tableaux « en un écran » ne tiennent pas** (§ 3.6) : 23 lignes touchables font 1 012 px, 32 clubs 1 408 px, pour 726 px.
11. **Pas codable sans deviner** : le format des séries et qui s'y qualifie, qui sort à une porte, les affiches « voisines », « les offres doublent ».
12. **Le coût de mesure** : 60 à 70 s par run avec la jauge à chaque soir, cinq à six heures pour 256 graines et quatre robots ; la tranche 0 garde la jauge pour les gros matchs.

**Les règles fermes défaites, à nommer au § 6** : « le plafond mord » (le rachat), « un match se joue isolé », « seuls tes signés comptent », « une scène, jamais une page », « signer, c'est l'échange », le contenu du HUD, les seuils des galons. **Le vocabulaire** : « Bureau » est dit parti ; acte, cible, cœur, signé, rachat, case et camp changent de sens ; quart, ballottage, date limite, rappel ne sont pas définis.

**Les critères sans preuve** : « échanger paie » (à juger en points sur 82, en paires), « une run sur quatre qui explose » (l'acte III n'existe plus), « aucun vol » (pas de formule), « une raison de lire la feuille » (aucun juge), la Coupe 4 à 12 (dépend du format des séries).

## 12. Tranché par JP après la revue (16 nov. 2026)

1. **La cible** : *un EHM, mais avec un côté rogue*.
2. **Le soir ordinaire** : *lignes et gardiens, mais faire que ça a un impact* (devant : le club d'en face au téléphone, recommandé ; le marché ouvert ; rien). Se mesure à la tranche 0 avant tout code.
3. **Le départ** : *23 dans des clubs faibles*, 4 M$ d'espace, les seuils du banc reposés.
4. **Comme EHM** : *bureau EHM, match illustré* — le bureau en tableaux avec un fil de nouvelles court, la feuille et le match illustrés d'aujourd'hui.
5. **Le proprio** : *plusieurs objectifs, variables selon la force de l'équipe, de la ligue ; s'assurer qu'un bon DG va réussir plus qu'un mauvais*.
6. **Les échanges** : *pas d'échange, juste packs de cartes*. La date limite et le contrat partent avec eux.
7. **Les joueurs neufs** : *packs et portes* — les pochettes en jetons au bureau, les trois portes après un gros match gagné.
8. **Le ballottage** : *seulement si aucun remplacement possible*.
9. **Les séries** : *les vraies, 16 clubs, 4 rondes* en 4 de 7.
10. **Le salaire libéré par un joueur qui sort** : pas tranché. JP : *je sais pas si ça devrait être 0 % ou 100 %, peut-être varier selon situation* ; puis : *c'est pourquoi que ça pèse au juste ?* La raison, répondue le jour même : sans rien qui pèse, remplacer un joueur est gratuit, chaque carte meilleure entre sans coût et le plafond ne se gère qu'au repêchage (JP, 10 nov. : le plafond qui mord). La tranche 0 joue 0 %, 50 % et 100 % sur les mêmes saisons, et JP tranche sur les chiffres.

11. **L'interface** : *utiliser le skill anti algorithm et faire UI pensé comme par un humain avec padding, position des éléments, etc., tout doit avoir un sens, une logique* — les maquettes passent par `/hors-moyenne`, chaque bloc avec sa raison (tranche 1).

**Reste de la revue, pour la tranche 0 ou les maquettes** : les jetons, les galons et les médailles à l'échelle de 82 matchs (mesurés, puis posés à JP) ; les tableaux plus longs qu'un écran (sur maquettes) ; le HUD ; le vocabulaire (« Bureau », « quart », « objectif »).

## Ce qui a été écarté

- **L'échange avec les clubs de la ligue, la date limite, le contrat qui expire** : au premier jet de ce devis ; la revue y trouve un arbitrage gratuit (le bon badge à cote égale est toujours accepté) et un état qui n'existe pas dans les données ; JP, 16 nov. : *pas d'échange, juste packs de cartes*.

- **Revenir à la V27 telle quelle** (le Bureau, la boîte, le jour à jour) : supprimée le 11 nov., pour les raisons du § 2 de la V28.
- **Un mode de gestion à côté du Rogue** : proposé à JP le 16 nov., non retenu.
- **La carte gardée comme agenda du DG** (la cédule fixe, l'embranchement étant ce qu'on fait de sa semaine) : le premier jet de ce devis ; JP donne la base le même jour, l'ancien mode refait du début.
- **La ligue simulée autour de dix-huit cases**, sans jouer les 82 : proposée à JP le 16 nov., non retenue (*les 82 soirs, joués*).
