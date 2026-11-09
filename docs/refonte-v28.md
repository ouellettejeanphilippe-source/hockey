# V28 — Le Rogue, de zéro : le club est le deck, chaque match compte

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec la commande `/refonte` le 9 nov. 2026. **Rien n'est codé.** JP tranche les quatre questions du § 11 avant la tranche 0. Les mesures du § 5 viennent de trois brouillons jetables gardés dans `docs/refonte-v28/` (des clubs synthétiques, aucune ligne du jeu).

## En une page

**Le constat.** Depuis le 7 octobre, vingt refontes ont changé ce qu'il y a AUTOUR du match : les cartes, le personnel, les adjoints, le coach, les histoires, puis les actes, les cœurs et les pièces. Aucune n'a changé ce qu'est une soirée : une saison de 82 matchs que le simulateur joue seul, d'un trait, et que l'écran relit. Sur cette base, un choix ne peut pas se sentir — les dés d'une saison pèsent ±4,5 victoires, une pièce de banc en pèse moins d'une par acte, et les juges du dépôt l'exigent. C'est ça, « le jeu qui marche pas ». La V27 lui a donné la charpente d'un roguelike ; dedans, c'est encore le simulateur.

**Le plan.** On arrête de bâtir dessus. Le Rogue neuf s'écrit à côté, dans des fichiers neufs, et part de son noyau :

1. **Chaque match compte, et il se voit.** Une run, c'est dix-huit matchs et les séries, pas 82 soirs. Un match se joue en quinze présences qu'on regarde en moins d'une minute : ton trio contre le leur, les tirs, le but, et chaque rôle, chaque accord, chaque pièce qui joue s'allume avec son chiffre. Un moteur de match neuf et petit, qui lit les mêmes cotes sur 20 que tes cartes.
2. **Le club est le deck.** Après chaque match, le dépisteur ouvre trois vrais vestiaires : tu en choisis un, tu y signes un joueur sous le plafond. Tes lignes sont ta main : les accords et les liens de vestiaire multiplient. Mesuré sur le brouillon : un seul bon choix déplace ta chance de gagner le match de 3 à 12 points, trois choix empilés la font passer de 50 à 79 %.
3. **Une vraie route.** Avant chaque match, trois affiches : contre qui, où, pour quel prix. Entre deux matchs, un congé : le marché, la pratique, le repos ou une histoire. Au bout de chaque acte, un rival qui a une règle à lui.
4. **Le fun se prouve avant de bâtir.** La tranche 0 est le match seul, sur ton téléphone, avec de vraies cartes. Tant que tu ne veux pas en jouer un autre, rien d'autre ne se code. Les robots règlent la difficulté après ; ils ne jugent plus le fun.
5. **L'ancien part en bloc.** Le jour où le neuf est le fun, le jour à jour, les greffes, les pièces à condition, les histoires du lundi, leurs règles et leurs juges sont supprimés d'un coup — pas retouchés.

**Ce qui reste** : les vrais joueurs et leurs cotes, les cartes de hockey telles quelles, les vrais vestiaires, les rôles et les accords, le plafond, les pochettes, ton cartable, tes médailles, le look de télé. Le 82-0, Sur table, l'exhibition et Sur glace ne bougent pas.

**Ce que je te demande** (§ 11) : quatre oui ou non.

## 1. Ce que JP a dit

JP, 9 nov. 2026 : *Tu travailles beaucoup sur le jeu, mais tu gardes tellement les anciennes mécaniques que tu bâtis sur ce qui marche pas au lieu de vraiment repartir comme il faut à chaque fois. Donne-moi un vrai plan clair qui en fait un roguelike complet, complexe pis le fun, pas juste un roguelike coat of paint sur un jeu qui marche pas.*

Le même reproche, depuis un mois (docs/refonte-v*.md, docs/decisions.md) :

- 7 oct. : *Le jeu se joue tout seul, je n'ai pas beaucoup d'impact, et il ne raconte pas vraiment d'histoire.* ; *Beaucoup de choix, en ce moment, je clique n'importe quoi parce qu'ils n'ont aucun poids.*
- 4 oct. : *ça doit être clair que le build que je fais a un impact pour vrai ; sinon, si je le sens pas, ça sert à quoi ?*
- 16 oct. : *Le Rogue est brain dead ; le 82-0, avec ses rolls, demande plus de stratégie.*
- 20 oct. : *les matchs importants sont vraiment rendus qu'ils se jouent tout seul* ; *c'est un bouton que tu pèses, c'est pas un vrai jeu*.
- 29 oct. : *You didn't really redo the system […] on s'en fout de briser les saves, le système actuel marche pas.*
- 31 oct. : *Supprime tout, fais un plan de quoi on fait, et repars sans reprendre.*
- 4 nov. : *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne le même […] ya sûrement une raison ?*

Ce qu'il veut, dans ses mots :

- *Le but du jeu, ça devrait être de trouver les meilleures combinaisons.* ; *Le jeu devrait m'encourager à essayer des joueurs différents, trouver des synergies.* ; *ni les cartes, ni les packs, ni comment optimiser les équipes n'est aussi réussi qu'un FUT ou un HUT* (10 oct.).
- *pas facile, mais tu peux exploser le jeu* (8 oct.) ; *équilibré ne veut pas dire impossible d'avoir des combinaisons mortelles.*
- *une vraie expérience digne d'un roguelike ou card game le fun à la Balatro, Slay the Spire, Pokémon TCG* ; *facile à prendre en main, dur à maîtriser* (2 nov.).
- *je veux ramener le jeu à son essence de cartes* (24 oct.) ; *le roguelike, c'est une lettre d'amour aux cartes de hockey* (11 oct.).
- *Je veux pas moins d'actions, au contraire, mais moins de confusion.* ; *Ça doit feeler comme si je manage vraiment un club.* (15 oct.)
- *je dois adapter mon alignement en fonction du coach* ; *grande variété pour permettre plein de build* (3 nov.) ; *every coach should change how you play* (2 nov.).
- *je préfère qu'on optimise le fun in game avant de vraiment viser un objectif clair de fin de jeu* (9 oct.).
- *première Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball* (7 nov.).

Ce qu'il a déjà refusé, et qu'on ne refait pas :

- *je comprends pas le contre, dans ma tête, c'est les joueurs et leurs cotes qui gèrent ça* (10 oct.) ; *je veux plus ce système de matching* (24 oct.) ; *Le système de stratégie de ligne est débile* (22 oct.).
- *les cartes, c'est pas fun* (20 oct., les cartes de tactique jouées au gros match) ; *Les pourcentages, ça me dit fuck all* (4 oct.) ; *0,4 pt, ça va fuck all faire* (25 oct.).

Ce qu'il garde : *garder les cartes actuelles du jeu, pas les refondre* (4 nov.) ; *j'aime vraiment le format carte de hockey* ; *faut des logos, et garder anciens looks des cartes de joueurs* ; *garder une partie du coloré et broadcast actuel* (7 nov.).

**La taille est décidée** : une refonte du jeu, pas de sa forme. Ce devis ne la négocie pas à la baisse.

## 2. Le constat : pourquoi vingt refontes sont retombées sur le même jeu

**Ce qu'est le Rogue aujourd'hui**, lu dans le code et joué au navigateur le 9 nov. 2026 (après la V27, tranches 1 à 7) :

| Le fait | Le chiffre | Où |
|---|---|---|
| Un match se joue d'un trait ; l'écran « en direct » relit une feuille déjà jouée | trois périodes dans un seul appel, aucune façon d'arrêter le match pour y décider quoi que ce soit | js/sim.js (les périodes), js/direct.js (la relecture) |
| Un soir ordinaire : un toucher, aucune décision | 186 journées pour 82 matchs ; « Jour suivant », « Jusqu'à lundi » | js/saison.js |
| Le rival, le sommet d'un acte : un plan parmi deux ou trois, puis ≈ 30 secondes de relecture et deux boutons | « +5,7 tirs » ou « −3,3 punitions » | js/gerant.js, js/direct.js |
| Une pièce de banc, la récompense d'un rival battu | « +3,5 tirs par match », 30 à 50 % des soirs, au plus 0,8 victoire sur un acte ; le banc complet au plus +5 | js/pieces.js, scripts/check_pouvoirs.mjs |
| Le meilleur plan d'un duel contre aucun plan | sous 60 % en face à face, par règle | scripts/check_duel.mjs |
| Le hasard d'une saison | ±4,5 victoires d'écart type | docs/decisions.md |
| Ton équipe du départ | des lotos et 23 bouche-trous posés d'office ; aucune roulette, aucun vestiaire | js/rogue-jeu.js |
| Les juges qui tiennent ce jeu-là en place | ≈ 48 scripts sur 86 | scripts/ |

**Le cimetière.** Chaque système de décision posé sur cette base est mort de la même phrase :

| Le système | Son épitaphe |
|---|---|
| Les événements (V3) | 0,03 victoire en médiane : « cliquer au hasard est la stratégie rationnelle » |
| La main de cartes du duel (V13) | « un bonus sans décision » : 48 % jouée sans lire, 52 % jouée par l'attentif |
| Les systèmes de ligne (V18) | « six voies sur huit bougent de moins de 1,2 V, dans le bruit » |
| Le choix de pochette (2 nov.) | 0 victoire d'écart |
| Le plan du soir (V27) | « dominé : une option le vaut presque toujours » |
| L'adjoint aux entractes (V27) | « 0,5 victoire par saison pour 40 % du temps de jeu » |
| Placer son calendrier (V27) | « à peu près zéro en moyenne » |

Ce n'est pas l'idée qui était mauvaise sept fois. C'est la base : un simulateur calibré pour que 82 matchs ressemblent à la LNH absorbe tout ce qu'on lui greffe, et c'est son travail.

**Pourquoi on y revenait.** Quatre habitudes, toutes dans la façon de travailler :

1. Chaque devis commençait par « ce qui ne bouge pas », et le simulateur au jour le jour y était (V27, § 1 et § 4.1 : « la ligue joue sa vraie cédule, au jour le jour, comme aujourd'hui »). Le noyau n'a jamais été sur la table.
2. Le succès se mesurait en victoires de robot sur une saison (`check_profondeur`), jamais en « est-ce le fun de jouer un match ». Un robot ne s'ennuie pas.
3. Les règles écrites bornaient chaque effet pour protéger le calibrage (une carte ±1 V, une pièce 30 à 50 % des soirs, un plan sous 60 %). Un effet borné pour ne pas déranger ne peut pas se sentir.
4. Une cinquantaine de juges encodent l'ancien jeu ; chaque session prenait le plus petit changement qui les gardait verts. `check_refonte` compte les lignes parties, pas si la boucle a changé.

Depuis le 9 octobre (docs/refonte-v5.md), les nœuds, les routes, le butin à trois choix et le boss d'acte d'un roguelike ont été posés sur ce simulateur, puis retirés un à un parce qu'ils ne pesaient rien. La V27 les a reposés mieux rangés. Le problème est en dessous.

## 3. Ce que le joueur ressent

**Le fantasme** : « je pars avec un club de bouche-trous et un coach ; match après match, je pige dans de vrais vestiaires et je monte des trios qui s'emboîtent ; je vois mon club jouer comme je l'ai bâti ; la Coupe ou dehors. »

- **Le pic** : la porte de vestiaire qui cache la carte qu'il te fallait ; le trio qui s'allume d'un accord de plus ; le rival battu parce que ton club était bâti pour lui ; la run où tout multiplie et où tu gagnes 7 à 1.
- **Le creux qui fait mal** : la cible de l'acte ratée d'un point ; ton premier centre blessé la veille du rival.
- **Le jour ordinaire** n'existe plus : il n'y a pas de soir sans enjeu.
- **Les boucles** :
  - le match (≈ 45 secondes, jusqu'à 3 minutes contre un rival) : quinze présences, tes appels ;
  - la semaine (2 à 4 minutes) : le match, le dépisteur, le congé, tes lignes, l'affiche suivante ;
  - l'acte (≈ 20 minutes) : six matchs, la cible en points, le rival ;
  - la run (une heure à une heure et demie quand elle va au bout) : trois actes, les séries ;
  - la carrière : la variété débloquée, les exigences.

Les jeux de référence, chacun pour une chose : **FUT et HUT** pour le club qu'on optimise carte par carte ; **Balatro** pour le pointage qu'on regarde monter et les multiplicateurs qu'on a bâtis soi-même ; **Slay the Spire** pour la route, les élites et le boss d'acte ; **le 82-0** pour la roulette des vestiaires, la seule chose du jeu que JP a dite plus stratégique que le Rogue.

## 4. Les règles du jeu

Elles se lisent seules ; ce n'est pas un diff de la V27. Le § 4.2 (le match) est écrit pour être codé tel quel à la tranche 0. Le reste est la charpente : chaque tranche la précise dans son extrait, **après** la porte de la tranche d'avant — on n'écrit pas dix pages de règles sur un noyau que le téléphone de JP n'a pas encore jugé.

### 4.1 La run, d'un coup d'œil

- Au départ : ton **coach** (un parmi trois), 23 bouche-trous, et **le camp** — le dépisteur ouvre trois fois ses portes (§ 4.4) : trois joueurs signés avant le premier match. Ta run a un visage dès la première minute.
- **Trois actes de six matchs** : cinq matchs choisis sur affiche, puis le rival de l'acte. Entre deux matchs : le dépisteur (si tu as gagné), un congé, tes lignes, l'affiche suivante.
- À la fin de chaque acte, **la cible** : un nombre de points au classement à avoir faits dans l'acte (2 la victoire, 1 la défaite en prolongation). Ratée aux actes I ou II, un cœur de moins ; ratée à l'acte III, pas de séries, la run finit. **2 cœurs** (JP, 7 nov.), jamais regagnés.
- **Les séries** : trois rondes (2 de 3, 2 de 3, puis la finale 3 de 5). Une série perdue finit la run. La Coupe la gagne.
- Une run perdue rend ses médailles et on repart ; le cartable garde chaque carte vue.

### 4.2 Le match

**Qui joue.** Ton alignement des Lignes : quatre trios, trois paires, un gardien. En face, un vrai club d'une vraie saison, aligné par le jeu.

**Le temps.** Trois périodes de cinq **présences**. À égalité après quinze : la prolongation, une présence à la fois jusqu'au but, trois au plus, puis les tirs de barrage (tu nommes trois tireurs). En séries, pas de tirs de barrage : on joue jusqu'au but.

**Une présence**, dans l'ordre :

1. **La mise au jeu.** Au centre en début de période et après un but ; sinon dans la zone du club qui a le moins tiré à la présence d'avant.
2. **Qui saute.** Chaque club envoie un trio et une paire selon **le roulement de son coach** (§ 4.8) : le trio prévu s'il lui reste des jambes, sinon le plus frais.
3. **Elle se joue**, en deux secondes sur la patinoire : les tirs de chaque bord, les arrêts, le but. Ce qui a joué s'allume avec son chiffre — le rôle (« Sniper Or : 2 tirs, 1 but »), l'accord (« La passe et le tir ×1,5 »), la pièce, la règle du rival. Une ligne du commentateur nomme les joueurs.
4. **Les jambes.** Le trio et la paire qui ont joué en perdent ; ceux du banc en reprennent ; tout le monde en reprend à l'entracte. Un trio aux jambes basses joue diminué, et ça se voit avant qu'il saute.

**Ce qui décide une présence** : les cotes des cinq cartes sur la glace contre les cinq d'en face et leur gardien (les formules, § 5), puis leurs rôles, leurs accords, tes pièces. Rien d'autre : pas de contre, pas de système à régler, pas de carte de tactique (JP : *c'est les joueurs et leurs cotes qui gèrent ça*).

**Les rôles sont des habiletés qu'on voit**, plus fortes à chaque métal du badge. Les six du prototype (les autres suivent la même forme, à la tranche 2) :

| Rôle | Ce qu'il fait dans sa présence |
|---|---|
| 🎯 Sniper | ses tirs entrent plus souvent (sa chance de but ×1,25 au Bronze, ×1,9 au Platine) |
| 🅰 Passeur | ajoute de l'attaque à ses deux compagnons de trio |
| 🔧 Checker | retire du Tir au meilleur tireur d'en face |
| 🪠 Plombier | sa présence coûte moins de jambes à son trio, et plus à celui d'en face |
| 🛑 Défensif | moins de tirs contre pendant sa présence |
| 🏔 Mur (gardien) | arrête d'office le premier tir de chaque période |

Un **accord** (les douze d'`AFFINITES`, deux rôles qui marchent ensemble sur la même ligne) **multiplie** : l'effet des deux rôles ×1,5. Un **lien de vestiaire** (neuf) : deux cartes du même vrai club, la même saison, sur la même ligne, +1 à leurs cotes ; trois, +2 — rebâtir un vrai trio de 1977 paie.

**Tes appels.** Le match roule seul, une présence aux deux secondes, et s'arrête à chaque entracte sur un seul bouton. Entre deux présences, tu peux lancer un **appel** : il arrête le jeu, tu choisis, ça repart.

- **Le temps d'arrêt** (tout coach, une fois par match) : la prochaine présence est jouée par le trio de ton choix, les jambes pleines, en zone offensive.
- **Retirer le gardien** (aux deux dernières présences, si tu perds) : plus de tirs pour toi, un filet désert pour eux.
- **Les pièces à appel** (§ 4.8) : celles qui ont une charge.

Deux ou trois appels par match, au moment que tu choisis. Le match n'est pas l'endroit où tu gagnes la run ; c'est l'endroit où tu vois si tu as bien bâti, avec de quoi forcer le destin deux fois.

**Le pronostic.** Partout où tu décides (une affiche, une signature, un échange de deux joueurs entre deux trios), l'écran dit ta chance de gagner le prochain match et ce qu'elle devient si tu fais le geste : « contre Boston : 41 % → 47 % », avec les tirs attendus. C'est le moteur du match qui le calcule, pas une copie.

**Ce que le prototype compare** (tranche 0), sur le même moteur : (a) regarder, sans appel ; (b) les appels ; (c) tenir le banc, c'est-à-dire choisir le trio à chaque présence. Le brouillon dit que (c) n'est pas un vrai choix (§ 5) ; il coûte vingt lignes au prototype, JP l'essaie et tranche.

### 4.3 Ton club : le deck

- 23 joueurs sous **le plafond** : quatorze avants, sept défenseurs, deux gardiens, comme aujourd'hui. Les bouche-trous du départ sont faibles et prennent presque tout le plafond ; chaque acte passé en libère.
- **Signer, c'est échanger** : l'arrivant face à celui qui sort, stat par stat, la masse, et le pronostic qui bouge (l'écran d'échange d'aujourd'hui). Celui qui sort va au cartable.
- **Les Lignes sont le casse-tête** : où mettre l'arrivant pour que les accords et les liens s'allument, qui joue avec qui, quel trio prend les présences du roulement de ton coach. « Aligner au mieux » reste, et dit ce qu'il a allumé.
- **Monter une carte** : son édition (Base, Cadre, Hors-cadre, Or, Holo) monte ses badges d'un métal ; elle monte à la pratique (§ 4.5), ou par trois doublons.
- **L'usure d'un match à l'autre** : les jambes ne reviennent pas toutes entre deux matchs ; une blessure sort un joueur pour un à quatre matchs. Le quatrième trio et les réserves comptent (JP : *ce sont même parfois les plus importants en séries*).

### 4.4 Le dépisteur : trois vestiaires

- Après un match **gagné**, trois portes : trois vrais clubs, chacun d'une vraie saison (« Canadiens 1976-77 », « Nordiques 1981-82 », « Sharks 2009-10 »), tirés de la graine dans une bande qui monte avec l'adversaire battu. La porte montre l'écusson, la saison, et combien de ses joueurs tiennent dans ton espace.
- Tu ouvres **une** porte : son vestiaire entier, comme au repêchage du 82-0 ; ceux que ton plafond ne peut pas payer sont grisés. Tu signes un joueur, ou tu passes pour des jetons.
- Après un match **perdu**, une seule porte, sans choix.
- **Une relance par acte** : les trois portes retirées. Des pièces en donnent d'autres.
- Aucun joueur ne revient deux fois dans la run.

### 4.5 Le congé

Entre deux matchs, un congé : **une** activité parmi trois offertes (tirées de la graine, jamais les trois mêmes de suite).

| Le congé | Ce qu'il donne |
|---|---|
| Le marché | des jetons à dépenser : des pochettes de joueurs, une pièce de banc parmi trois, un soin |
| La pratique | une carte de ton choix monte d'une édition |
| Le repos | toutes les jambes pleines, un blessé revient |
| L'échange | un de tes joueurs contre un parmi trois d'un autre club, à salaire voisin |
| Une histoire | une voix du club, un fait vrai de tes matchs joués, deux réponses qui changent ton club pour le reste de la run (§ 4.10) |

Pas de congé avant le rival : son match suit le cinquième.

### 4.6 Les affiches, les élites, les rivaux

- **L'affiche** : avant chaque match, trois affiches côte à côte. Chacune dit le club (un vrai, sa saison), son jeu lu dans ses vraies stats (des tireurs, des durs, un gros gardien), chez toi ou chez eux, ton pronostic, et ce qu'elle paie (les jetons, la qualité des portes). Plus c'est dur, plus ça paie. Le club qui reçoit a le dernier changement : son meilleur trio saute contre le plus faible d'en face.
- **L'élite** : parfois, une des trois affiches est dorée — un club du haut. Gagnée, une pièce de banc en plus des portes. Perdue, les points sont perdus comme un autre match, rien de plus.
- **Le rival** : annoncé au premier match de son acte, avec son jeu et **sa règle**, une règle à lui qui attaque une façon de bâtir. Exemples : les Flyers de 1974-75, « chaque présence te coûte le double de jambes » ; les Oilers de 1983-84, « leur premier trio saute une présence sur deux, sans s'user » ; les Devils de 1994-95, « en zone neutre, personne n'a de tir ». Tu as un acte pour bâtir contre. Battu : une pièce parmi trois, des médailles. Perdu : rien de plus que ses points.
- Les adversaires montent d'un acte à l'autre (des clubs plus forts, puis des éditions plus hautes) plus vite qu'un club qui signe sans lire : il faut que ça multiplie pour suivre.

### 4.7 Les cœurs et la cible

- La cible de l'acte se lit sur ta plaque à chaque match : « 5 points · il en faut 7 · 2 matchs ». Le rival compte dans l'acte.
- 2 cœurs ; un de moins à chaque cible ratée des actes I et II ; l'acte III raté finit la run ; à 0 cœur, la run finit le soir même.
- Aucun classement de ligue, aucun autre club ne joue en coulisse : ce que tu fais est ce qui compte.

### 4.8 Le coach et le banc

- **Ton coach** : une vraie carte de coach-saison, un parmi trois au départ (le loto d'aujourd'hui). Sa philosophie change comment ton club joue, par trois choses : **son roulement** (quel trio prend quelles présences d'une période), **sa règle**, **sa pièce de départ**. Exemples : le Showman, « le premier trio saute deux fois par période » — un club bâti sur un trio ; le Contremaître, « quatre trios égaux, le quatrième ne s'use pas » — un club de profondeur ; la Tortue, « en avance, moins de tirs des deux bords » — un gardien et une défensive.
- **Le banc** : cinq cases pour la run (JP, 7 nov.). Une **pièce** est de trois sortes : une **règle** qui joue toujours (« tes plombiers usent leurs jambes deux fois plus ») ; un **appel** qu'on lance, une ou deux charges par match (« La contestation : annule un but contre ; ratée, une punition ») ; une **prime** qui paie (« un jeton par tir de ton quatrième trio »). Elles viennent du rival battu, de l'élite gagnée, du marché, d'une histoire.
- Les pièces multiplient ce que le club fait déjà ; aucune n'est bornée en victoires. Ce qui borne, c'est la ligue qui monte et la cible.

### 4.9 Les séries

- Trois rondes contre des clubs du haut, chacun avec la règle de son coach. Entre deux matchs d'une série : tes lignes, un appel de moins ou de plus selon tes pièces, pas de congé ; l'usure et les blessures restent d'un match à l'autre.
- Entre deux rondes : le dépisteur et un congé.

### 4.10 Les histoires

- Une histoire est une des activités du congé, jamais un arrêt forcé. Une voix du club, un joueur nommé, un fait vrai lu dans tes matchs joués de la run (il a marqué dans quatre matchs de suite ; son trio n'a rien accordé depuis trois matchs).
- Deux réponses, chacune une carte de jeu, chacune change ton club **pour le reste de la run** : un rôle de plus sur une carte, un métal de plus ou de moins, un contrat qui monte, un joueur qui part contre un autre, une pièce. Jamais « ×1,1 pour huit matchs ».
- Vingt histoires à la tranche 3, écrites de zéro avec `rogue-recit` ; la banque des quarante d'aujourd'hui ne se transpose pas (ses effets sont des canaux du simulateur).

### 4.11 L'économie

- **Les jetons** se gagnent aux matchs (plus pour une affiche dure), à la règle de certaines pièces, en passant une porte. Ils se dépensent au marché, quand un congé y mène : rare, donc pesé.
- **Le plafond** est l'autre monnaie, la plus dure : la vedette de la porte coûte l'espace de deux bons joueurs.
- **Les médailles** entre les runs (§ 4.12).

### 4.12 La méta

- Les médailles ouvrent de la **variété** : des coachs, des pièces, des pochettes, des époques de portes. Rien qui rende la run plus facile (la direction de la V27, § 4.9, tenue).
- **Les exigences** montent la difficulté après une Coupe, par les leviers neufs : la cible, la force des affiches, le plafond, une porte de moins.
- Le cartable, l'album, ton club et ses couleurs, le panthéon restent.
- Le détail se fixe à la tranche 5, sur le jeu fini.

### 4.13 Les écrans

Des maquettes à 390 × 844 d'abord (tranche 1), JP tranche, le code les reproduit. Les écrans neufs : la route de l'acte et ta plaque (la cible, les cœurs), les trois affiches, le match (la patinoire, les deux unités sur la glace en vraies petites cartes, les jambes, tes appels), les trois portes, le vestiaire ouvert, le congé, les Lignes avec leurs accords et leurs liens, le rival annoncé et sa règle, la fin d'acte, la fin de run. Les cartes de joueurs et les cartes de jeu passent telles quelles ; la télé du jeu, ses plaques et ses bandeaux restent la langue visuelle.

## 5. Les chiffres

Des valeurs de départ, à régler à la tranche 0 sur de vrais clubs. Les cotes sont celles des cartes, sur 20 (`axes20`, js/niveaux.js) : Tir, Jeu, Défense, Robustesse ; Arrêts pour le gardien.

- **Les tirs attendus d'une présence** : `T = T0 × (A / D)^K × (1 + ZONE × z)`.
  - `A` = (0,7 × l'attaque du trio + 0,3 × l'attaque de la paire) × `j(jambes du trio)` ; l'attaque d'une ligne est la moyenne de Tir et de Jeu de ses cartes.
  - `D` = (0,4 × la Défense du trio d'en face + 0,6 × la Défense de leur paire) × `j(jambes de leur trio)`.
  - `j(x) = 0,7 + 0,3 × x / 100` : un trio vidé joue à 70 %.
  - `z` : +1 en zone offensive, 0 au centre, −1 en zone défensive.
  - *T0* 2,0 · *K* 1,5 · *ZONE* 0,25.
- **La chance de but d'un tir** : `p = P0 × Tir du trio / Arrêts du gardien`, plafonnée à 0,40 ; *P0* 0,095.
- **Exemple fait à la main.** Ton premier trio (attaque 16, Tir 17, jambes pleines) et ta première paire (attaque 13) contre leur troisième trio (Défense 15) et leur première paire (Défense 15), au centre, leur gardien à 13 d'Arrêts : `A = 0,7 × 16 + 0,3 × 13 = 15,1` ; `D = 15` ; `T = 2 × (15,1 / 15)^1,5 = 2,0 tirs` ; `p = 0,095 × 17 / 13 = 0,124` ; la chance d'au moins un but : `1 − e^(−2,0 × 0,124)` = **22 %**. La même présence contre leur quatrième trio et leur troisième paire (Défense 11) : `T = 2 × (15,1 / 11)^1,5 = 3,2 tirs`, soit **33 %**.
- **Les jambes** : une présence coûte *COUT_PRESENCE* 30 au trio (34 à la paire) ; une présence au banc rend *REPOS_PRESENCE* 15 (22 à la paire) ; l'entracte, *ENTRACTE* 20.
- **Le match** : *PRESENCES_PAR_PERIODE* 5.
- **La run** : *MATCHS_PAR_ACTE* 6 ; *CIBLES* 6 · 7 · 8 points sur 12 ; *COEURS* 2 ; les séries 2 de 3, 2 de 3, 3 de 5 ; *PORTES* 3 ; une relance par acte ; *CASES_DU_BANC* 5.
- **Les jetons** : 12 la victoire, 6 la défaite en prolongation, 4 la défaite ; 6 pour une porte passée ; les prix d'aujourd'hui au marché (Bronze 14, Époque 26, la pièce 32).

**Ce que les brouillons ont mesuré** (docs/refonte-v28/, deux clubs synthétiques de force égale, les formules ci-dessus, 20 000 à 40 000 matchs par ligne) :

| La question | Le résultat |
|---|---|
| Ça ressemble à du hockey ? | 3,0 buts et 30 tirs par club, 17 % de prolongations |
| Le club le mieux bâti gagne ? | +1 sur toutes ses cotes : 71 % des matchs ; +2 : 85 % ; +4 : 97 % |
| Un choix de bâtisseur se sent ? | un accord au premier trio : 50 → 55 % ; un gardien d'un cran : 57 % ; une vedette au premier trio : 62 % ; un accord à chaque trio : 61 % ; les trois empilés : **79 %** |
| Le coach change le club ? | le roulement du Showman avec un premier trio ordinaire : 44 % ; avec une vedette : 57 % |
| Choisir soi-même le trio à chaque présence, c'est un vrai choix ? | **non, la bonne réponse est toujours la même** : « envoie le plus frais » fait 55 % contre une rotation fixe ; un coach qui lit chaque présence fait 53 %, et un coach qui rejoue la fin du match 200 fois par geste ne bat pas « le plus frais » (42 à 50 % contre lui) |
| Fermer le jeu en avance, l'ouvrir en retard ? | pas séparé du bruit (53 % ± 4,5) : à essayer comme appel, pas comme réglage |
| Ce qui cloche déjà | un quatrième trio refait ne rapporte que +0,3 point : la profondeur ne pèse pas encore, il faut que l'usure la fasse compter (§ 4.3) |

La leçon du brouillon vaut pour tout le devis : **l'habileté du joueur vit dans le club qu'il bâtit, pas dans un bouton pesé pendant le match.** C'est ce que JP disait du contre le 10 octobre, et ce que la V6 avait mesuré (l'appariement des trios : +0,007 à +0,025 but par match). Le match montre ; les appels donnent le drame.

Pour comparer : aujourd'hui, une pièce de banc ajoute 3,5 tirs un soir sur trois.

## 6. Les cas limites

- **La vieille partie** (JP : *on s'en fout de briser les saves*) : une run en cours de l'ancien Rogue ne se rejoue pas. À l'ouverture, un écran dit ce qui est versé (ses médailles, le prix des déblocages qui partent), puis une run neuve commence. Les clés de sauvegarde ne bougent pas ; le cartable, les médailles, ton club restent — `check_sauvegardes`.
- **Le plafond plein** : la porte dit combien de ses joueurs tiennent dans ton espace ; zéro, elle le dit avant que tu l'ouvres. Passer paie toujours.
- **Un vestiaire sans joueur à ta mesure** : tu passes, les jetons.
- **Tous tes trios vidés** : le plus frais saute, diminué ; un trio n'est jamais à zéro au début d'un match (plancher à 40).
- **Un blessé dans un trio** : la réserve du même poste monte ; sans réserve, un bouche-trou de la ligue, plus faible, le temps de l'absence.
- **Le gardien blessé** : l'auxiliaire ; les deux blessés, un gardien de la ligue.
- **L'égalité** : la prolongation, puis les tirs de barrage ; en séries, jusqu'au but.
- **Le rival joué à 0 point d'écart de la cible** : son match compte comme un autre ; perdu en prolongation, il donne son point.
- **Quitter au milieu d'un match** : le match reprend à la présence où il était ; la graine et les appels déjà lancés le rejouent pareil.
- **Hors ligne** : `sw.js` liste les modules neufs et oublie les partis — `check_coquille`.
- **Le clavier et la manette** : chaque écran neuf répond à A, B, Échap et au balayage.
- **`prefers-reduced-motion`** : le match se lit présence par présence sans animation ; le DOM porte toujours le vrai pointage.

## 7. Ce qu'il touche

**Les fichiers neufs**, tous au préfixe *run-* dans js/ (le moteur du match, la run et sa route, le dépisteur, le congé, les pièces, les rivaux, les histoires, les écrans) ; aucun n'importe un module de l'ancien Rogue — un juge neuf, *check_neuf*, le refuse.

**Les fichiers qui changent** : `js/saison.js` (le jour à jour en sort, les séries du 82-0 restent), `js/sim.js` (ce que seul l'ancien Rogue lisait en sort, à la tranche 6), `js/game.js`, `js/menu.js`, `js/alignement.js`, `js/repechage.js`, `js/gerant.js`, `js/impact.js`, `js/cartes.js`, `js/rogue.js` (la méta reste, la run d'avant part), `js/niveaux.js`, `style.css`, `sw.js`, `index.html`.

**Les règles fermes de `.claude/rules/`** :

- `.claude/rules/rogue.md` : **réécrite au complet** à la tranche 4. Elle décrit la V27 ligne par ligne ; chaque session y reviendrait.
- `.claude/rules/moteur.md` : « un seul chemin de match pour tous les modes » — **défaite pour le Rogue** (il a son moteur de présences, comme Sur table et Sur glace ont le leur) ; « aucune cote neuve » — **tenue** (le match du Rogue lit `axes20`, les cotes que l'écran montre) ; « le moteur est pur, le Rogue s'y greffe » — sans objet une fois les greffes parties.
- `.claude/rules/interface.md` : le contrat du plateau page par page (Ce soir, le Proprio, le Calendrier, la boîte « Tes choix », les cinq portes) — **réécrit** sur les maquettes de la tranche 1 ; « une carte de jeu a le format d'une carte de hockey », « les cartes passent telles quelles », « un choix se dit en vraies stats de match » — **tenues**.
- `.claude/rules/vocabulaire.md` : entrent **présence**, **roulement**, **appel**, **affiche**, **porte**, **congé**, **cible**, **lien de vestiaire**, **règle du rival** ; partent **nœud**, **placer**, **renfort**, **moment**, **relais**, **intention**, **promesse**, **lancée** ; **rival**, **acte**, **cœur**, **élite**, **pièce de banc**, **le banc** changent de définition.
- `.claude/rules/tests.md` et `CLAUDE.md` : les juges partis en sortent, les neufs y entrent ; la phrase qui décrit le Rogue est réécrite.
- **Les décisions de JP du 7 au 9 nov. que ce devis défait**, s'il dit oui au § 11 : « la ligue joue sa vraie cédule » et le calendrier placé ; la boutique à sept nœuds ; « un seul choix avant le match » (remplacé par aucun choix avant et des appels pendant) ; « le moteur calibré ne bouge pas » (il ne bouge pas : le Rogue cesse de s'en servir pour ses matchs). Tenues : 2 cœurs, « rival », le banc de cinq, la première Coupe pas avant la troisième run, la boule de neige bloquée, la méta en variété.
- **Les clés de sauvegarde ne bougent jamais** — `check_sauvegardes`.

## 8. Ce qui part

La pièce maîtresse. Chaque nom ci-dessous disparaît du jeu à la tranche 4 (le remplacement), et *check_refonte* le vérifie sur la somme. Seul ce qui part est entre accents graves dans cette partie ; ce qui le remplace est en italique. Chaque nom a été cherché dans js/ ou scripts/ le 9 nov. 2026. Le test du zéro : le match, la run et le dépisteur s'écrivent depuis le § 4 sans ouvrir un module de l'ancien Rogue.

### Le jour à jour

- `ouvrirSaison` (≈ 3 000 lignes de js/saison.js, ouvert seulement en Rogue), `avancerSemaine`, `avancerPuisResumer`, `motDuJour`, `arretDeSemaine`, `messagesCourants`, `specsForces`, `etapesDeLActe`, `regarderProchain`, `offreObjectif`, `soignerLeBlesse` → *la route de l'acte* : un match, le dépisteur, un congé, une affiche.

### Les actes posés sur la cédule

- `js/actes.js`, `poserLesRivaux`, `crochetDesActes`, `echangeables`, `ouvrirLeCalendrier`, `renfortDe`, `eliteDeLaSemaine`, `NOEUDS_BOUTIQUE` → *les affiches, la cible, le congé*.

### Le Rogue greffé au simulateur

- `js/greffes.js`, `brancherGreffes`, `exigerGreffes`, `INTENTIONS`, `FORCE_DUEL`, `plansDuDuel`, `ouvrirLeDuel`, `MOMENTS_SI`, `momentsDuSoir`, `appliquerChoix` → *le moteur de présences*, qui ne se greffe à rien.
- `JOURS_OBJECTIFS`, `lanceeDe` → rien : il n'y a plus de saison simulée à habiller.

### Les pièces à condition et leurs bornes

- `js/pieces.js`, `RELAIS_NIV`, `persoAdverse`, `borneV`, `js/banc-du-soir.js`, `bancDuSoirHtml` → *les pièces en trois sortes (règle, appel, prime)*, sans borne en victoires ; *la règle du rival*.

### Les histoires du lundi

- `js/histoires.js`, `js/faits.js`, `js/scenes.js`, `lundiAHistoire`, `CHANCE_HISTOIRE`, `promettre`, `verdictsDuMatin` → *les histoires du congé*, écrites de zéro, aux effets qui durent la run.

### L'écran et le départ de l'ancienne run

- `js/rogue-jeu.js`, `js/inventaire.js`, `js/depart.js` → *les écrans de la run neuve* ; ce qui s'y garde (ouvrir une pochette, la page des déblocages) déménage par fonction, nommé à l'extrait de la tranche 4.

### Les juges et les robots de l'ancien jeu

- `scripts/check_pouvoirs.mjs`, `scripts/check_relais.mjs`, `scripts/check_banc.mjs`, `scripts/check_duel.mjs`, `scripts/check_elites.mjs`, `scripts/check_profondeur.mjs`, `scripts/check_moments_si.mjs`, `scripts/check_histoires.mjs`, `scripts/check_suivis.mjs`, `scripts/check_effets.mjs`, `scripts/check_calendrier.mjs`, `scripts/mesure_rythme.mjs`, `scripts/lib/rogue_sim.mjs`, `scripts/lib/rogue_actes.mjs`, `scripts/lib/cartes_robot.mjs`, `scripts/lib/duel.mjs` → *check_match*, *check_run*, *check_neuf*, *mesure_run*, *essai_run*.

**Le compte** : 63 noms, dont 10 fichiers du jeu (≈ 4 200 lignes) et la plus grosse fonction du dépôt (≈ 3 000 lignes), soit au moins 7 200 lignes de jeu avant ce que la tranche 6 retire de js/sim.js, et 16 scripts. La liste complète des juges qui partent (une cinquantaine touchent l'ancien Rogue) se fixe à la tranche 4 : tout script qui importe un module parti part ou se réécrit.

**À vérifier à sa tranche avant de l'ajouter** (en italique, pour que *check_refonte* ne le compte pas encore) : *js/banque.js* (ses neuf cartes rares deviennent la pratique et le repos), *js/magasin.js*, *js/pronostic.js*, *js/vie-gm.js* (les voix), *js/galons.js*, *js/profil-style.js*, *js/ballottage.js* (le 82-0 s'en sert-il encore ?), les situations de vestiaire et les accidents de carte de js/sim.js, les parts de js/gerant.js et de js/impact.js que seul le duel lisait.

## 8b. Ce qui reste, et pourquoi

- **Les données et les cotes** : data/, js/ratings.js, `axes20`, `NIVEAUX` — les vrais joueurs, leurs vraies stats ; une cote affichée est une cote jouée.
- **Les cartes de hockey** : `cartonHtml`, `carteHtml`, les 55 séries, `EDITIONS`, le recto-verso — JP, deux fois.
- **Les rôles, les badges, les accords** : `PROFILS`, `badgesDe`, `AFFINITES`, `accordsDeLigne` — le vocabulaire du club ; le match neuf leur donne un effet qu'on voit.
- **Les vrais vestiaires et l'écran du repêchage** (js/repechage.js) — c'est la porte du dépisteur.
- **L'alignement en cartes et l'échange** : `caseEnCarte`, `choisirQuiSort`, « Aligner au mieux ».
- **Les vrais coachs** : `lotoDesCoachs`, data/coachs.json, les huit philosophies de js/coachs.js — leur règle est réécrite, leur carte reste.
- **Les pochettes** : `BOUTIQUE`, `pochetteHtml`, la pile et l'annonce d'une carte rare — le plaisir d'ouvrir.
- **Le cartable, l'album, ton club, le panthéon, les médailles, les exigences** — la carrière ne repart pas de zéro.
- **Le plateau et la télé du jeu** : js/composants.js, la patinoire (js/glace.js), le commentateur (js/commentaire.js), les sons, le jus en trois paliers (js/mouvement.js).
- **Le simulateur calibré** (js/sim.js) pour le 82-0 et l'exhibition, et pour aligner les clubs adverses (`buildOpponents`, `autoRoster`).
- **Le 82-0, Sur table, l'exhibition, Sur glace** : aucun ne change.
- **De la V27** : les mots acte, rival, cœur, élite, banc, et leurs maquettes pour la langue visuelle. Aucune ligne de son code.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| *PRESENCES_PAR_PERIODE* | 5 | 4-6 | à 3, un match est un coup de dés ; à 8, il dure trop pour dix-huit matchs |
| *T0*, *P0* | 2,0 · 0,095 | ce qui donne 28 à 32 tirs et 2,7 à 3,3 buts par club | hors de là, ce n'est plus du hockey |
| *K* | 1,5 | 1,2-2,0 | plus bas, le club bâti ne se sent pas ; plus haut, +1 de cote gagne tout |
| *COUT_PRESENCE*, *REPOS_PRESENCE* | 30 · 15 | 25-40 · 10-20 | trop doux, le premier trio joue tout le match ; trop dur, tous les trios se valent |
| *MATCHS_PAR_ACTE* | 6 | 5-7 | à 4, la cible est un coup de dés ; à 8, la run passe deux heures |
| *CIBLES* | 6 · 7 · 8 sur 12 | ±1 chacune | le premier levier de la difficulté |
| *COEURS* | 2 | 2 (JP) | ne se règle pas |
| *PORTES* | 3 | 2-4 | à 1, il n'y a pas de choix ; à 5, il n'y a plus de manque |
| L'accord, le lien | ×1,5 · +1, +2 | ×1,25-×2 · +1-+3 | trop bas, on aligne au mieux sans lire ; trop haut, un seul build existe |
| *CASES_DU_BANC* | 5 | 4-6 | — |
| Les séries | 2 de 3 · 2 de 3 · 3 de 5 | jusqu'à 3 de 5 partout | plus long, la run ne tient plus dans une soirée |

## 10. Les critères d'acceptation

Les portes d'abord : une tranche ne commence pas tant que la porte d'avant n'est pas passée.

- [ ] **La porte 0, le fun du match** — à juger par JP à l'essai : après cinq matchs du prototype sur son téléphone, il veut en jouer un sixième, et il dit lequel des trois (regarder, les appels, tenir le banc) est le bon. Deux non de suite : on change de noyau avant d'écrire une ligne de la run.
- [ ] **Le match est du hockey** : sur 64 paires de vrais clubs, 28 à 32 tirs et 2,7 à 3,3 buts par club, 12 à 22 % de prolongations ; la même graine et les mêmes appels rejouent le même match — *check_match* (neuf).
- [ ] **Le club bâti se sent** : à vrais clubs, un niveau de plus sur une ligne déplace le pronostic d'au moins 3 points ; chaque rôle, chaque accord, chaque pièce, retiré seul, change la présence où il joue et l'écran le nomme ; le pronostic affiché est la fréquence mesurée, à 2 points près — *check_match*.
- [ ] **La profondeur compte** : sur une série de cinq matchs, un quatrième trio refait vaut au moins 3 points de pronostic — *check_match*.
- [ ] **Rien n'est un bouton qu'on pèse** : aucun appel n'est meilleur lancé toujours à la même présence ; un appel bien placé vaut au moins 3 points, mal placé au plus 1 — *check_match*.
- [ ] **La porte 2, un acte** — à juger par JP : deux actes joués avec deux coachs différents donnent deux clubs qu'il décrit différemment.
- [ ] **La run** : trois actes de six matchs, la cible et les cœurs recomptés, un rival par acte avec sa règle annoncée, trois portes après une victoire et une après une défaite, aucun joueur deux fois, le plafond jamais dépassé ; une run entière tient en 60 à 90 minutes au robot qui lit tout — *check_run* (neuf), *essai_run* (neuf, à 390 px).
- [ ] **Lire paie** : sur 64 graines, les mêmes dés, le robot qui lit (les accords, le jeu de l'affiche, la règle du rival) gagne la Coupe 6 à 10 fois, celui qui signe la première carte et aligne au mieux au plus 2 fois ; la première Coupe jamais avant la troisième run en médiane (JP) — *mesure_run* (neuf).
- [ ] **On peut exploser le jeu** : au moins une run sur dix du robot qui lit finit l'acte III à plus de 75 % de pronostic moyen ; le robot qui prend toujours la carte la mieux cotée, sans lire, gagne au plus une run sur deux — *mesure_run*.
- [ ] **Deux coachs, deux clubs** : pour chaque paire de philosophies, le robot qui lit n'aligne pas le même premier trio dans plus de la moitié des graines — *mesure_run*.
- [ ] **Le neuf ne s'appuie pas sur l'ancien** : aucun fichier *run-* n'importe un module nommé au § 8 — *check_neuf* (neuf, dans `tout.mjs` dès la tranche 2).
- [ ] **Les vieilles parties** : une run de chaque forme d'avant s'ouvre sans erreur, verse ses médailles et commence une run neuve — `check_sauvegardes`.
- [ ] **Le 82-0 ne bouge pas** : l'empreinte du simulateur est la même avant et après la tranche 6 — `check_empreinte`, `check_feuilles`, le smoke.
- [ ] **Les écrans** : chaque maquette de la tranche 1 reproduite ; tout tient à 390 × 844 ; trois cartes de front se lisent — `check_hauteur`, *essai_run*.
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées — `check_refonte` (sur la somme, à la tranche 4).
- [ ] Rien de mort — `check_mort`.
- [ ] À juger par JP à l'essai : une porte donne envie de l'ouvrir ; placer l'arrivant dans ses lignes est un plaisir, pas une corvée ; perdre fait dire « j'aurais dû » et pas « les dés ».

## Les tranches

L'ancien Rogue reste jouable et **gelé** jusqu'à la tranche 4 : plus aucun travail dessus (les tranches 8 à 11 de la V27 et D1b s'arrêtent). Chaque tranche porte son extrait `docs/refonte-v28-<n>.md`.

**0. Le match, seul.** Un prototype jetable dans `proto/` (hors du jeu, hors de `sw.js`, ouvert par son adresse sur le site) : le moteur de présences du § 4.2 et du § 5, un écran à 390 px, deux vrais clubs tirés au sort avec leurs vraies cartes, les six rôles, les accords, le temps d'arrêt, le gardien retiré, le pronostic, et les trois façons de jouer (regarder, les appels, tenir le banc). *Le joueur voit : un match, rien d'autre.* Juge : la porte 0 (JP), et *check_match* sur le prototype. **Rien de la run ne s'écrit avant.**

**1. Les maquettes.** Les écrans du § 4.13 à 390 × 844, sur le noyau choisi à la porte 0. JP tranche. Aucune ligne de code.

**2. Un acte.** Le moteur déménage dans js/ ; la run d'un acte dans des fichiers neufs, ouverte du menu sous « Le Rogue neuf » à côté de l'ancien : le camp, cinq affiches, les portes, le congé (le marché, la pratique, le repos), les Lignes avec les accords et les liens, la cible, un cœur, un rival et sa règle ; trois coachs, huit pièces, tous les rôles. *Le joueur voit : vingt minutes de jeu complètes.* Juge : la porte 2 (JP), *check_match*, *check_run*, *check_neuf*, *essai_run*.

**3. La run.** Trois actes et les séries ; les huit coachs, vingt-quatre pièces, six rivaux à règle, vingt histoires, l'échange, les élites, l'usure et les blessures ; les robots et leurs cibles. *Le joueur voit : une run de bout en bout, la Coupe ou dehors.* Juge : *mesure_run* (en CI, comme `profondeur.yml`), *check_run*, *essai_run*, JP.

**4. Le remplacement.** « Le Rogue neuf » devient le Rogue. L'ancien part d'un coup : tout le § 8, ses règles réécrites (`.claude/rules/rogue.md` au complet, le contrat du plateau, le vocabulaire), ses juges ; la vieille run versée. *Le joueur voit : un seul Rogue.* Juge : `check_refonte` sur la somme, `check_mort`, `check_coquille`, `check_sauvegardes`, `tout.mjs`.

**5. La méta.** Le catalogue de variété en médailles, les exigences sur les leviers neufs, les jalons réécrits. Juge : *mesure_run* (avec tout et sans rien : pas plus de 3 points d'écart sur la Coupe).

**6. Le ménage du simulateur.** Ce que seul l'ancien Rogue lisait sort de js/sim.js, mesuré : `check_mort` nomme ce qui est mort une fois le § 8 parti, `check_empreinte` prouve que le 82-0 se rejoue au but près.

**Ensuite**, du contenu, une PR à la fois : des rivaux et leurs règles, des pièces, des histoires, la saison de plus après la Coupe (la Dynastie de la V27, réécrite sur le jeu neuf), le défi du jour (une graine par date).

## 11. Les questions à JP

1. **Le noyau** : une run de dix-huit matchs et les séries, où le club que tu bâtis est le jeu et où chaque match se voit en moins d'une minute, avec des appels ? — **Recommandé : oui.** Le prototype te fait aussi essayer « tenir le banc » ; tu tranches au téléphone.
2. **Le moteur** : le Rogue joue ses matchs avec un petit moteur de présences à lui, qui lit les mêmes cotes que tes cartes ; le simulateur calibré reste au 82-0 ? — **Recommandé : oui.** C'est ce qui permet qu'un accord pèse 5 points de pronostic au lieu de 3,5 tirs un soir sur trois.
3. **L'ancien Rogue** : gelé dès aujourd'hui (les tranches 8 à 11 de la V27 arrêtées), jouable jusqu'au remplacement, puis supprimé ; les runs en cours perdues, les médailles et le cartable gardés ? — **Recommandé : oui.**
4. **La ligue** : plus de classement ni de 31 clubs qui jouent en coulisse ; ta cible est en points, tes adversaires sont sur les affiches ? — **Recommandé : oui.** Si le classement te manque à l'essai, il revient comme un décor, pas comme un moteur.

## 12. Ce qui a été écarté

- **Garder les 82 soirs et mieux choisir entre eux** : c'est la V3 à la V27.
- **Le joueur choisit son trio à chaque présence** comme cœur du jeu : mesuré au brouillon, la bonne réponse est toujours « le plus frais », et c'est le contre de la V6 et le matching de la V13, refusés deux fois. Gardé au prototype comme troisième façon, pour que JP le juge de ses pouces.
- **Un deck de cartes de tactique joué pendant le match** : mort trois fois (la v2, la V10, la V13) — *les cartes, c'est pas fun* ; les cartes du jeu, ce sont les joueurs.
- **Le match de Sur table comme combat** : vingt à quarante minutes par match, et il a son propre devis.
- **Sur glace comme combat** : une autre habileté, une manette ; un mode à lui.
- **Le simulateur calibré sous le match neuf**, par ses canaux : c'est par là que chaque effet a été borné jusqu'à ne plus se sentir. Le repli, si le moteur de présences sonne faux à la porte 0 : `jouerPlage` sur des fenêtres courtes.
- **Écrire tout de suite les règles complètes de la run, de la méta et de la Dynastie** : c'est ainsi que la V27 a mesuré sa cible sur l'ancien jeu (son risque R1). Chaque tranche écrit les siennes après sa porte.
