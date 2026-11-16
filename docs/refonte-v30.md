# V30 — Le Rogue redevient une saison, et tu en es le DG

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 16 nov. 2026. **Rien n'est codé.** JP a tranché trois questions avant le devis, donné la base (§ 1), puis tranché les trois dernières (§ 10). La suite : `/revue-design`, puis la tranche 0.

## En une page

**Le constat.** La V28 a remplacé la saison par une carte de dix-huit matchs choisis. Ce qu'elle a gagné : chaque match se lit, chaque victoire donne une signature, le banc (V29) fait que bâtir paie (70 % de cibles tenues contre 54 %). Ce qu'elle a perdu, et que JP nomme : il n'y a plus de ligue, plus de classement, plus de course aux séries, plus de stats qui s'accumulent — et aucun geste de directeur général. On signe un joueur derrière une porte ; on ne gère rien.

**Le piège, dit d'avance.** « Les 82 soirs, joués » est la forme de la V3 à la V27. Elle est morte vingt fois de la même mesure : 82 soirs presque pareils se feuillettent, « Jour suivant » touché 186 fois, et chaque système de décision posé dessus pesait à peu près zéro victoire (docs/refonte-v28.md § 2). Y revenir tel quel, c'est refaire la V27.

**Ce qui est différent cette fois, et qui doit le rester :**

1. **Chaque soir a sa feuille** (JP, 16 nov., § 3.3) : les 82 matchs passent par la feuille du soir et les temps forts de la V28, pas par un bouton « Jour suivant » sur une page. Le devis recommandait la semaine d'un toucher ; JP a choisi le soir, en sachant ce qu'il coûte (une saison de quatre à cinq heures).
2. **Ce qu'on décide entre les matchs change l'alignement, pas un bonus sous le dé.** Un échange, un rappel, une réclamation au ballottage sortent un joueur et en entrent un autre : l'effet est celui d'une signature, que la V29 a rendu décisif par le banc. Les systèmes morts de la V3 à la V27 ajoutaient un pourcentage borné ; ceux-ci changent qui joue.
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

Ce qu'il a dit avant, et qui tient encore :

- *le jeu se joue tout seul, je n'ai pas beaucoup d'impact* (7 oct.) ; *le Rogue est brain dead* (16 oct.).
- *calendrier réel pour toutes les équipes, mais tu choisis les équipes qui vont quand* (7 nov.).
- *tu devrais jamais simuler d'avance* (S79).
- *pas facile, mais tu peux exploser le jeu* (8 oct.) ; *le build décide* (13 nov.).
- *une run ne dépend plus des autres* (12 nov.).
- *j'hais l'interface. On dirait pas un vrai jeu* (9 nov., devant le Bureau en pages de la V27).

**Deux de ses mots tirent en sens contraire, et le devis doit le dire** : le 9 nov., le Bureau et ses pages « ne faisaient pas un vrai jeu » ; le 16 nov., les scènes « ne font pas gestion ». La réponse proposée n'est ni l'un ni l'autre : des tableaux là où on gère, des scènes là où on joue, et jamais une boîte de réception qu'on vide.

## 2. Ce que le joueur ressent

**Le fantasme** : je suis le DG. J'ai bâti ce club de 23 sous le plafond, je le suis soir après soir au classement, et à la date limite je fais l'échange qui le mène aux séries.

- **Le jour ordinaire** : la feuille du soir, le match en temps forts ou d'un toucher, puis le classement qui bouge et qui est en feu.
- **Le pic** : le gros match en scène ; l'échange à la date limite ; le soir où la place en séries se joue.
- **Les boucles** : le soir (la feuille, le match, le bureau) ; le quart de saison (le bilan du proprio, le marché) ; la saison (le repêchage, 82 matchs, la date limite, les séries).

## 3. Les règles du jeu

Écrites pour la forme recommandée ; les trois questions du § 10 sont tranchées.

### 3.1 Le départ : un repêchage de 23

- Le coach et son banc se choisissent comme aujourd'hui.
- Puis **le repêchage** : la roulette sort un vestiaire, tu y piges un joueur, vingt-trois fois, sous le plafond. C'est le repêchage du 82-0 (js/repechage.js), dans le monde du Rogue (toutes les années ensemble, la bande de force du départ).
- Il remplace le club de départ donné et le camp de trois tours de portes.
- Seuls tes signés comptent pour le banc (V29) : les vingt-trois le sont tous dès le départ. **Les seuils des pièces se remesurent** (§ 4).

### 3.2 La ligue

- Trente et un autres clubs, tirés du monde de la run, avec une vraie cédule de 82 matchs et un vrai classement. `creerLigue` et `jouerJournee` (js/sim.js) le font déjà pour le 82-0 ; rien n'est simulé d'avance.
- Les dos-à-dos, les voyages, les séquences viennent de la cédule ; ils ne sont plus posés à la main.
- **La cible** n'est plus « 8 points sur 14 » : c'est ta place au classement à la fin de chaque quart. Sous la ligne des séries au bilan d'un quart, le proprio retire un cœur. Deux cœurs.

### 3.3 Le rythme : chaque soir, sa feuille

JP, 16 nov. : *chaque soir, sa feuille* (devant la semaine d'un toucher, recommandée, et le soir en une ligne).

- **Les 82 matchs passent par la feuille du soir** : l'adversaire, son jeu, tes lignes et leurs jambes, ta chance ; puis le match en temps forts, qu'on peut mener à la fin d'un toucher.
- **Le bureau s'ouvre entre deux soirs** : c'est là que la gestion se fait, pas sur la feuille.
- **Les gros matchs** (le rival de chaque quart, les élites, les affiches contre un club voisin au classement : environ dix-huit) sont des duels en trois périodes, avec leur intention ; les autres soirs se jouent d'un trait.
- **Ce que ça coûte, dit à JP avant sa réponse** : une saison de quatre à cinq heures, et 82 soirs dont la plupart se ressemblent. Deux garde-fous, jugés à la tranche 0 et à l'essai :
  - la feuille d'un soir ordinaire doit donner une raison de la lire (un dos-à-dos, un blessé qui revient, une lancée, un club voisin au classement), sinon elle se passe d'un toucher ;
  - une run se quitte et se reprend n'importe quel soir, à sa feuille.

### 3.4 Le roguelike dans la saison

La carte de l'acte part : l'accueil est le bureau, et la cédule dit qui on affronte. Chaque pièce du roguelike prend sa place dans la saison :

- **L'acte est un quart de saison** (vingt ou vingt et un matchs). Au bout de chacun, **le rival** : le club le plus près de toi au classement parmi ceux de la fin du quart, annoncé au début du quart, et son match compte double au bilan.
- **Les cœurs sont la confiance du proprio** : au bilan d'un quart, sous la ligne des séries, −1 ❤️ ; à zéro, tu es congédié et la run finit.
- **L'élite** : un match de la cédule contre un club du haut, marqué d'avance ; tu choisis d'y mettre l'enjeu ou non (gagné, une pièce de banc et des jetons ; perdu, des sonnés et des jetons, jamais un cœur).
- **La récompense qu'on choisit** : trois portes après un gros match gagné, une pièce de banc parmi trois au rival battu.
- **Le banc** (V29) : tes cinq cases et leurs pièces, qui comptent les badges de tes joueurs ; un échange change donc ton banc, et c'est la raison de bâtir.
- **Le marché** ouvre à la fin de chaque quart et la semaine de la date limite : une pièce de banc, les pochettes, une carte à monter.
- **Les histoires** arrivent quand leur fait est vrai dans ta saison ; elles lisent de nouveau le classement et les meneurs de la ligue.
- **La run** reste une run : une graine, une saison, la mort possible, les médailles à la fin, les exigences 🔺.

### 3.5 Les gestes du DG

- **L'échange.** Tu proposes un joueur à un club de la ligue contre un des siens. Le club dit oui si ce qu'il reçoit vaut ce qu'il donne (la cote sur 20 et le salaire, corrigés par son besoin au poste et sa place au classement : un club hors course vend ses vétérans). Il dit pourquoi quand il refuse. Les clubs t'en proposent aussi.
- **Le ballottage.** Un joueur qu'on retire de l'alignement passe au ballottage ; un blessé de longue durée ouvre une réclamation parmi les joueurs que les autres clubs y ont mis.
- **La date limite**, vers le 60e match : après elle, plus d'échange. La dernière semaine avant elle, les offres doublent.
- **Le contrat.** En une saison, un contrat est un salaire et un état : *qui expire* ou *sous contrat*. Un joueur qui expire coûte moins cher à obtenir à la date limite (la location).
- **Les portes** restent après un gros match gagné seulement : la récompense de la victoire qui compte.
- **Le rachat** d'aujourd'hui (la moitié du salaire de celui qui sort reste comptée) est remplacé par l'échange et le ballottage.

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
- **L'échange** : un robot qui échange doit faire mieux que le même robot qui n'échange pas, en paires, au-delà du bruit ; et aucun échange accepté ne doit être un vol (la valeur reçue au plus 15 % au-dessus de la valeur donnée, à régler).
- **La difficulté** : les bornes de JP du 14 nov. tiennent (la Coupe 4 à 12 fois sur 64, une run sur quatre qui explose), remesurées sur la saison.
- **Les jetons** : gagnés sur 82 matchs au lieu de dix-huit ; les prix du marché se reposent.

## 5. Les cas limites

- **Une run en cours** de la V29 : soldée à l'ouverture, ses médailles versées une fois, comme le 14 nov. (`VERSION_DE_LA_RUN`). Les clés de sauvegarde ne bougent pas.
- **L'alignement sous 23** après une blessure et un échange : le rappel d'office d'un joueur au salaire minimum, jamais un trou.
- **Le plafond dépassé** par une offre : refusée avant d'être proposée, avec le montant qui manque.
- **La date limite passée** : le téléphone se ferme, le ballottage reste.
- **Hors ligne** : rien de neuf à charger sauf les modules du bureau (`sw.js`).
- **Le clavier et la manette** : un tableau se parcourt aux flèches, une ligne s'ouvre à la touche d'action.

## 6. Ce qu'il touche

- **Le jeu** : js/run.js (réécrit autour de la ligue), js/run-scenes.js (les scènes de la carte et du camp partent, celles du match et des portes restent), js/run-jeu.js, js/pieces.js (les seuils), js/actes.js, js/repechage.js (ouvert au Rogue), js/sim.js (`creerLigue` lue par la run ; le moteur ne bouge pas, `VERSION_MOTEUR` reste), un module neuf pour le bureau et un pour les échanges, style.css, sw.js.
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
- **Le rachat** : *RUN.RACHAT*, *masseApres*, *sortantsPour*, *sceneEchange* (qui sort quand on signe) → l'échange et le ballottage.
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

**Le test du zéro** : la ligue, le bureau et les échanges s'écrivent depuis le § 3 sans relire la carte ; js/run.js se repart d'un fichier neuf.

## 8. Les réglages

Posés à la tranche 0, sur mesure : la longueur d'un quart (20 ou 21 matchs), le nombre de gros matchs par quart (4 à 5), le jour de la date limite (55 à 65), la marge d'un échange accepté (0 à 15 %), le nombre d'offres reçues par quart (1 à 3), les seuils des pièces sur 23 signés.

## 9. Les critères d'acceptation

- [ ] Chaque soir a sa feuille, et un soir ordinaire se passe en deux touchers au plus (la feuille, la fin du match) — `essai_run` (compté).
- [ ] Une run se quitte et se reprend à la feuille de n'importe quel soir, la même graine rejoue le même match — `check_run`.
- [ ] La ligue est une vraie ligue : 82 matchs par club, un classement qui se recompte, rien de simulé d'avance — `check_run`.
- [ ] Échanger paie : le robot qui échange tient plus de cibles que son témoin, en paires, au-delà du bruit — `mesure_run`.
- [ ] Aucun échange accepté n'est un vol, aucun refus sans sa raison — `check_echange` (à écrire).
- [ ] Bâtir paie encore, et le banc n'a aucune marche d'office sur 23 signés — `mesure_run`, `check_pouvoirs`.
- [ ] Les bornes du 14 nov. tiennent : la Coupe 4 à 12 fois sur 64, une run sur quatre qui explose — `mesure_run` (256 graines).
- [ ] Chaque tableau du bureau tient en un écran à 390 px — `check_scene`.
- [ ] Le moteur ne bouge pas : le 82-0 se rejoue au but près — `check_empreinte`, `check_feuilles`.
- [ ] Pas une couche de peinture — `check_refonte` sur l'extrait de chaque tranche.
- [ ] À juger par JP à l'essai : est-ce une saison ? est-ce que je me sens DG ?

## Les tranches

0. **Le test d'un jour** : la saison de 82 jouée par les robots dans un script, avec le repêchage de 23 et un échange simple ; la durée, le banc, la difficulté. Rien du jeu touché. Rouge : on ne code pas.
1. **Les maquettes** du bureau, à 390 × 844, deux ou trois directions ; JP tranche.
2. **La ligue sous la run** : js/run.js réécrit, la cédule, le classement, le soir et sa feuille, le bilan du quart.
3. **Le repêchage de 23** au départ ; le camp part.
4. **Le bureau** : les quatre tableaux ; les scènes de gestion partent.
5. **Les gestes du DG** : l'échange, le ballottage, la date limite ; le rachat part.
6. **Le réglage** sur 256 graines neuves, les règles de `.claude/rules/rogue.md` réécrites.

`/revue-design docs/refonte-v30.md` passe avant la tranche 0.

## 10. Tranché par JP (16 nov. 2026)

1. **Le rythme des 82 soirs** : *chaque soir, sa feuille*. Écartés : la semaine d'un toucher avec dix-huit gros matchs en scène (recommandée), le soir en une ligne.
2. **Une saison ou plusieurs** : *une saison*. Le contrat est un salaire et « expire ou non ». Écartée : la carrière de trois saisons.
3. **Les portes** : *après un gros match gagné*. Écartés : après chaque victoire, plus de portes.
4. **La base**, en cours de devis : l'ancien mode refait du début ; la carte de l'acte ne reste pas l'accueil (§ 1, § 3.4).

## Ce qui a été écarté

- **Revenir à la V27 telle quelle** (le Bureau, la boîte, le jour à jour) : supprimée le 11 nov., pour les raisons du § 2 de la V28.
- **Un mode de gestion à côté du Rogue** : proposé à JP le 16 nov., non retenu.
- **La carte gardée comme agenda du DG** (la cédule fixe, l'embranchement étant ce qu'on fait de sa semaine) : le premier jet de ce devis ; JP donne la base le même jour, l'ancien mode refait du début.
- **La ligue simulée autour de dix-huit cases**, sans jouer les 82 : proposée à JP le 16 nov., non retenue (*les 82 soirs, joués*).
