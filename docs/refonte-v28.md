# V28 — Le Rogue, de zéro : un vrai jeu, mécanique et écrans ensemble

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 9 nov. 2026. Il réunit deux brouillons du même jour, l'un sur la mécanique, l'autre sur l'interface, que JP a renvoyés ensemble : *interface et mécanique, pour un roguelike, c'est super intimement lié, un change l'autre*. Trois relecteurs adverses (le fun, les chiffres, le parcours) ont passé le premier brouillon ; leurs corrections sont dedans. Les maquettes : docs/maquettes/v28.html. Les mesures (§ 5) viennent de brouillons jetables sur des clubs synthétiques, à refaire sur de vrais clubs à la tranche 0. **Rien n'est codé.**

## En une page

**Le constat.** Le Rogue d'aujourd'hui, c'est deux choses mal faites qui se tiennent l'une l'autre :

- **Un simulateur** : 82 soirs joués d'un trait. Le match est relu après coup, donc rien ne s'y décide. Chaque effet est borné sous le bruit des dés.
- **Un site web par-dessus** : un en-tête, cinq onglets, des pages qui défilent, une boîte de réception, et « Jour suivant » touché 186 fois.

Vingt refontes ont changé l'une sans l'autre. Changer les cartes sur le simulateur ne se sentait pas ; repeindre les pages sur le simulateur restait un site. **On les refait ensemble, à partir de ce qu'un roguelike est : une carte, des rencontres, des récompenses.**

**Le jeu neuf, en une boucle :**

1. **La carte de l'acte.** L'acte est un chemin avec des embranchements, comme Slay the Spire. Les cases sont des matchs contre de vrais clubs (leur jeu se lit sur la case), une élite, le marché, le vestiaire, une histoire, et le rival au bout. **Choisir son chemin, c'est choisir qui tu affrontes et quand** : ce que JP voulait du calendrier.
2. **La feuille du soir** (20 à 40 secondes). Tu vois leurs lignes. Tu places tes quatre trios dans le roulement de ton coach et tu choisis qui reste en civil. Mesuré : contre un club à vedettes, le bon ordre vaut 12 points de plus que l'ordre par force.
3. **Le match se joue sous tes yeux, en 45 à 60 secondes.** Quinze présences, chacune une courte scène sur la glace de Sur glace, avec ses patineurs. Chaque rôle, chaque accord, chaque pièce qui joue s'allume. Un appel au moment chaud.
4. **Les trois portes.** Après chaque match, le dépisteur ouvre trois vrais vestiaires ; l'un est toujours le club que tu viens d'affronter. Tu en signes un joueur sous le plafond. **Ton club est ton deck.**
5. **Retour à la carte.** Trois actes, chacun avec sa cible en points, deux cœurs, puis les séries.

**Ce qui reste** : les vrais joueurs, les cartes telles quelles, les vrais vestiaires, les rôles et les accords, le plafond, le banc de cinq, le rival, l'élite, deux cœurs, les pochettes, ton cartable, les médailles. Le 82-0, Sur table et l'exhibition ne bougent pas.

**Ce que je te demande** (§ 11) : quatre oui ou non.

## 1. Ce que JP a dit

JP, 9 nov. 2026 :

- *Tu travailles beaucoup sur le jeu, mais tu gardes tellement les anciennes mécaniques que tu bâtis sur ce qui marche pas au lieu de vraiment repartir comme il faut à chaque fois. Donne-moi un vrai plan clair qui en fait un roguelike complet, complexe pis le fun, pas juste un roguelike coat of paint sur un jeu qui marche pas.*
- *Je parle de l'interface. J'hais l'interface. On dirait pas un vrai jeu.*
- *Ben interface et mécanique, pour un roguelike, c'est genre super intimement lié, un change l'autre.*

Le même reproche, depuis un mois :

- *Le jeu se joue tout seul, je n'ai pas beaucoup d'impact* (7 oct.).
- *Le Rogue est brain dead* (16 oct.).
- *les matchs importants sont vraiment rendus qu'ils se jouent tout seul* (20 oct.).
- *You didn't really redo the system […] le système actuel marche pas* (29 oct.).
- *you feel sports broadcast, neither the game itself* (3 nov.).
- *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne le même* (4 nov.).

Ce qu'il veut :

- *Le but du jeu, ça devrait être de trouver les meilleures combinaisons* (10 oct.).
- *ni les cartes, ni les packs, ni comment optimiser les équipes n'est aussi réussi qu'un FUT ou un HUT* (10 oct.).
- *pas facile, mais tu peux exploser le jeu* (8 oct.).
- *à la Balatro, Slay the Spire, Pokémon TCG* ; *facile à prendre en main, dur à maîtriser* (2 nov.).
- *l'important est que je puisse m'adapter aux adversaires, mais pas complètement*.
- *calendrier réel pour toutes les équipes, mais tu choisis les équipes qui vont quand pour avoir duels plus tough aux bons endroits* (7 nov.).
- *la version Windows d'un jeu Flash Newgrounds* (5 nov.).
- *il faut vraiment bloquer le snowball* (7 nov.).

Ce qu'il a refusé, et qu'on ne refait pas :

- *je comprends pas le contre, dans ma tête, c'est les joueurs et leurs cotes qui gèrent ça* (10 oct.).
- *je veux plus ce système de matching* (24 oct.).
- *les cartes, c'est pas fun* (20 oct., les cartes de tactique au match).
- *Les pourcentages, ça me dit fuck all* (4 oct.).

Ce qu'il garde :

- *garder les cartes actuelles du jeu, pas les refondre* (4 nov.).
- *faut des logos, et garder anciens looks des cartes de joueurs* (7 nov.).
- *ça, c'est des sprites* (1er nov., Sur glace).

**La taille est décidée** : le Rogue refait, sa boucle et ses écrans. Ce devis ne la négocie pas à la baisse.

## 2. Pourquoi vingt refontes sont retombées sur le même jeu

**Le noyau n'a jamais été sur la table.** Chaque devis l'écrivait dans « ce qui ne bouge pas » : la ligue au jour le jour (V27, § 4.1), les cinq portes, la boîte. Sur ce noyau, chaque système de décision est mort de la même mesure :

| Le système | Ce qu'il pesait |
|---|---|
| Les événements (V3) | 0,03 victoire |
| La main du duel (V13) | « un bonus sans décision » |
| Les systèmes de ligne (V18) | « dans le bruit » |
| Le choix de pochette | 0 victoire |
| Le plan du soir (V27) | « dominé » |
| L'adjoint aux entractes (V27) | 0,5 victoire pour 40 % du temps de jeu |
| Le calendrier placé (V27) | « à peu près zéro » |

Chaque refonte d'écran, elle, retombait sur la même charpente de site.

**Les deux sont liés**, et c'est ce qui manquait :

- Un match de 60 minutes simulé d'un trait ne peut que se relire. Donc rien ne s'y décide, et l'écran n'a qu'un fil de texte à montrer.
- Une saison de 82 soirs ne peut que se feuilleter en pages. Donc elle a un bouton « Jour suivant » et une boîte de réception.

Un roguelike fait l'inverse : une carte, des rencontres courtes qu'on voit, une récompense qu'on choisit. La règle et l'écran s'écrivent ensemble.

**Les habitudes qui ramenaient l'ancien jeu** :

- le succès mesuré en victoires de robot, jamais en plaisir de jouer ;
- des bornes posées pour protéger le calibrage (une pièce ±0,8 victoire sur un acte, un plan sous 60 %) ;
- une cinquantaine de juges qui encodent l'ancien jeu (`check_plateau` refuse une page qui n'est pas le plateau).

## 3. Ce que le joueur ressent

**Le fantasme** : « je pars avec des bouche-trous et un coach. Acte après acte, je choisis mon chemin, je lis le club d'en face, je place mes trios, je les regarde jouer sur la glace, et je pige dans de vrais vestiaires pour monter un club qui s'emboîte. La Coupe ou dehors. »

- **Les pics** :
  - la porte qui cache la carte qu'il te fallait ;
  - ton checker qui éteint leur vedette parce que tu l'as placé contre elle ;
  - le rival, écran de combat, battu parce que ton club était bâti pour lui ;
  - la run où tout multiplie et où tu gagnes 7-1.
- **Le creux qui fait mal** : la cible ratée d'un point ; ton centre blessé la veille du rival.
- **Pas de jour ordinaire** : chaque case de la carte demande quelque chose.
- **Les boucles** :
  - le match : 1 à 2 minutes, la feuille et le match ;
  - la case : 2 à 4 minutes, avec les portes et les Lignes ;
  - l'acte : 20 minutes, sept cases et le rival ;
  - la run : une heure à une heure et demie ;
  - la carrière : la variété débloquée, les exigences.

## 4. Les règles et les écrans

Chaque règle a son écran ; chaque écran est une scène plein écran qui ne défile jamais, à 390 × 844.

### 4.1 La coquille

- **Pas d'en-tête de site, pas de barre d'onglets, pas de sous-onglets, pas de boîte de réception.**
- **Le HUD**, en haut de chaque scène : tes cœurs dessinés, tes jetons, l'acte, tes points sur la cible (« 5 / 8 »).
- **Le menu pause** (un coin, Échap, Start) : tes joueurs, l'album, le palmarès, les règles, quitter.
- **Une info, une maison** :
  - la cible et les cœurs vont au HUD ;
  - les jambes et les blessés, sur tes cartes ;
  - la règle du rival, sur sa case ;
  - le pronostic, sur la feuille du soir.

### 4.2 La run

- **Le départ** : ton coach, un parmi trois (le loto d'aujourd'hui). Puis 23 bouche-trous et **le camp** : trois fois trois portes avant la première case, donc trois joueurs signés. Ta run a un visage dès la première minute.
- **Trois actes.** Chacun est une carte de sept cases jusqu'au rival : cinq matchs (ou élites) et deux arrêts (le marché, le vestiaire, une histoire), sur des chemins qui se croisent.
- **La cible** : à la fin de l'acte, tes points de l'acte (2 la victoire, 1 la défaite en prolongation ; le rival compte double) doivent atteindre *CIBLES* (7, 8, 9 sur 14).
  - Ratée aux actes I ou II : −1 cœur.
  - Ratée à l'acte III : pas de séries, la run finit.
  - **2 cœurs** (JP, 7 nov.), jamais regagnés.
- **Les séries** : trois rondes en 3 de 5 contre des clubs du haut. Une série perdue coûte un cœur et se rejoue une fois, contre le même club ; sans cœur, la run finit.
- **Une run perdue** rend ses médailles. Le cartable garde chaque carte vue.

### 4.3 La carte de l'acte (l'écran d'accueil)

- Le chemin, de bas en haut. Sur chaque case de match : l'écusson et la saison du club, son jeu en un mot (des tireurs, des durs, un gros gardien, de la profondeur) et ce qu'il paie.
- **Les cases** :
  - **match** : un vrai club, de force dans la bande de l'acte ;
  - **élite** ◆ : un club du haut, qui paie une pièce de banc en plus des portes ; perdue, rien de plus que ses points ;
  - **marché** : les pochettes, une pièce parmi trois ;
  - **vestiaire** : soigner tes blessés et remettre tes jambes à neuf, ou monter une carte d'une édition (un seul des deux, comme le feu de camp de Slay the Spire) ;
  - **histoire** : une voix du club, un fait vrai de tes matchs, deux réponses qui changent ton club pour la run ;
  - **le rival** : au sommet, annoncé dès l'ouverture de la carte, avec son jeu et **sa règle**, une règle à lui qui attaque une façon de bâtir. Par exemple : « chaque présence te coûte le double de jambes » (les Flyers de 1974-75), « leur premier trio saute une présence sur deux » (les Oilers de 1983-84). Son écran est un écran de combat.
- On touche une case du rang suivant ; la scène s'ouvre. Le chemin pris reste dessiné.

### 4.4 La feuille du soir (avant chaque match)

- **Ce que tu vois** : leurs quatre trios et leurs paires en plaques (leur vedette en carte), leur jeu, leur gardien, la règle du rival s'il y en a une. Et **ta chance de gagner**, en jauge aux couleurs des deux clubs : le seul endroit du jeu où elle se montre.
- **Ce que tu fais** :
  - **l'ordre de tes quatre trios** dans le roulement de ton coach, en les glissant (le premier saute le plus souvent) ;
  - **qui reste en civil** : trois joueurs, les blessés et les vidés marqués ;
  - **ton gardien**.

  La jauge bouge pendant que tu places.
- **Pourquoi c'est un vrai choix** (brouillon `ordre`, § 5) : les rôles s'enchaînent d'une présence à l'autre.
  - La zone gagnée donne la mise au jeu offensive au trio suivant.
  - Le plombier vide les jambes du trio qu'il affronte.
  - Le checker freine le meilleur tireur qu'il croise.

  Le bon ordre dépend donc de leurs lignes. Ce n'est pas un réglage abstrait : c'est **ton checker nommé contre leur vedette nommée**, ce que JP appelait *m'adapter aux adversaires, mais pas complètement*.

### 4.5 Le match

- **Quinze présences**, cinq par période. Chacune est une courte scène de 2 à 3 secondes sur la glace de Sur glace, avec ses patineurs aux couleurs des deux clubs : la rondelle sort, le trio monte, les tirs, l'arrêt ou le but. Le direct ne relit plus une feuille : il montre les présences que le moteur joue (§ 5).
- **Le tableau** : le pointage, la présence (« 7 / 15 ») et les **tirs attendus cumulés** des deux clubs, pour que perdre fasse dire « j'aurais dû » et pas « les dés ».
- **Sous la glace** : ton banc ; une pièce qui joue s'allume avec son chiffre. Une puce par présence, au plus, pour ce qui l'a décidée (un rôle, un accord, une pièce), seulement si, retirée, elle changeait la présence (la règle de `check_causes`).
- **L'appel** : le **temps d'arrêt**, une fois par match. La prochaine présence se joue à toute allure des deux bords (les tirs doublés). Mesuré : +6 points en retard d'un but en fin de match, −2 en avance. Le gardien se retire tout seul en fin de match quand tu perds (c'est toujours le bon coup). Des pièces donnent d'autres appels.
- **L'entracte** : 1,5 seconde, puis ça repart. Rien n'arrête le match sauf l'appel.
- **La prolongation** : présence par présence jusqu'au but, trois au plus, puis les tirs de barrage. En séries, jusqu'au but.

### 4.6 Les trois portes (après chaque match)

- Trois vrais vestiaires : l'écusson, la saison, et combien de joueurs tiennent dans ton espace.
  - **L'une est toujours le club que tu viens d'affronter** (« je joue les Islanders 1982 pour Bossy »), ce qui fait de la carte un choix de bâtisseur.
  - Gagné, les portes viennent d'une bande plus haute ; perdu, la même bande, plus **une relance**.
- **La porte ouverte** montre en cartes, trois de front, ceux qui tiennent dans ton espace. Le coin de chaque carte dit l'accord ou le lien qu'il allumerait. Les autres sont pliés.
- **Signer** : l'échange (l'arrivant face à celui qui sort, le plafond). On voit les **tirs par présence** de la ligne touchée avant et après, jamais un pourcentage de victoire. Celui qui sort va au cartable. Passer rapporte des jetons.
- Aucun joueur ne revient deux fois dans la run.

### 4.7 Ton club

- **23 joueurs** sous le plafond (quatorze avants, sept défenseurs, deux gardiens).
- **Les rôles sont des habiletés qu'on voit**, plus fortes à chaque métal du badge. Elles agissent sur les tirs de leur joueur, jamais sur ceux de tout le trio :
  - 🎯 le sniper marque plus ;
  - 🅰 le passeur nourrit ses compagnons ;
  - 🔧 le checker freine leur meilleur tireur ;
  - 🪠 le plombier use leurs jambes ;
  - 🛑 le défensif coupe les tirs contre ;
  - 🏔 le mur arrête d'office le premier tir de chaque période.
- **Les accords** (les douze d'`AFFINITES`) multiplient : l'effet des deux rôles ×1,5.
- **Les liens de vestiaire** (neufs) : deux cartes du même club et de la même saison sur une ligne, +1 à leurs cotes ; trois, +2. Rebâtir un vrai trio de 1977 paie.
- **Les Lignes** sont l'avant-match de la feuille du soir. Pendant qu'une carte est tenue, chaque case dit ce qu'elle allumerait. « Aligner au mieux » part : c'est le casse-tête.
- **L'usure** : une blessure sort un joueur pour un à quatre matchs ; les jambes ne reviennent pas toutes d'un match à l'autre. La profondeur compte, et le vestiaire de la carte aussi.

### 4.8 Le coach et le banc

- **Ton coach** est une vraie carte de coach-saison, et une **classe**, définie par trois choses :
  - **son roulement** : quel trio prend quelles présences, avec sa règle de jambes, pour qu'il soit un échange et jamais un piège. Le Showman fait sauter son premier trio deux fois par période, qui s'use deux fois moins ;
  - **sa règle** ;
  - **sa pièce de départ**.
- **Le banc** : cinq cases pour la run (JP, 7 nov.). Une **pièce** est de trois sortes :
  - une **règle** qui joue toujours (« tes plombiers usent deux fois plus ») ;
  - un **appel** à charges (« la contestation : annule un but contre ; ratée, une punition ») ;
  - une **prime** qui compte quelque chose dans ton club (« un jeton par sniper », « +1 tir par lien »).

  Les pièces viennent du rival battu, de l'élite, du marché et des histoires. Aucune n'est bornée en victoires : ce qui borne, c'est l'acte qui monte et la cible.
- **Une époque par run** : la run tire une décennie. Ses portes en viennent d'abord, et le rythme du jeu (les tirs, les buts) suit l'époque. Deux runs ne se ressemblent pas.

### 4.9 L'économie

- **Les jetons** : 12 la victoire, 6 la défaite en prolongation, 4 la défaite, 6 pour une porte passée, plus les primes. Ils se dépensent au marché (Bronze 14, Époque 26, la pièce 32) ; les jetons restants en fin de run sont perdus.
- **Le plafond** est l'autre monnaie, la plus dure : la vedette d'une porte coûte l'espace de deux bons joueurs.
- **Les médailles**, entre les runs : de la variété seulement (des coachs, des pièces, des pochettes, des époques). Les exigences montent la difficulté après une Coupe (la cible, la bande des clubs, le plafond, une porte de moins).

### 4.10 Les écrans, et la direction

- **Les scènes** :
  - la carte de l'acte ;
  - la feuille du soir ;
  - le match ;
  - les trois portes et la porte ouverte ;
  - l'échange ;
  - le marché et la pochette (sa pile et la carte rare restent) ;
  - le vestiaire ;
  - l'histoire ;
  - le rival en écran de combat ;
  - la fin d'acte ;
  - les séries ;
  - la fin de run ;
  - le menu pause et ses pages.
- **La direction recommandée** : la carte de C, le reste en A. A, c'est l'arcade 16 bits de Sur glace : la foule, la glace, les patineurs, un tableau indicateur, des boîtes de menu à la NHL 94. Les maquettes montrent aussi B, la table de cartes à la Balatro.
- **Les cartes** de joueurs et de jeu passent telles quelles, en haute définition au milieu du décor.
- **Une semaine gagnée** (la case, la feuille, le match, les portes, l'échange, la carte) tient en **neuf touchers** au plus, aucun sans décision.

## 5. Les chiffres

**Le moteur du match**, à caler sur de vrais clubs à la tranche 0 (les cotes sur 20 des cartes, `axes20`) :

- **Les tirs attendus d'une présence** : `T = T0 × (A / D)^K × (1 + ZONE × z)`.
  - `A` = (0,7 × l'attaque du trio + 0,3 × l'attaque de la paire) × `j(jambes)`.
  - `D` = (0,4 × la Défense du trio d'en face + 0,6 × celle de leur paire) × `j(leurs jambes)`.
  - `z` vaut +1 en zone offensive, 0 au centre, −1 en zone défensive.
  - *K* entre 0,75 et 1,0 (relecteur des chiffres : à 1,5, le favori gagnait 83 % en médiane sur de vrais clubs) ; *T0* ≈ 1,75 ; *ZONE* 0,25.
- **La chance de but d'un tir** : `p = P0 × (Tir / Arrêts)^0,25`, avec *P0* ≈ 0,093. L'exposant tient les vrais gardiens (Arrêts de 1 à 19) dans le hockey.
- **Les jambes** :
  - *COUT_PRESENCE* 40 ;
  - *REPOS_PRESENCE* 15 ;
  - l'entracte rend 20 ;
  - `j(x) = 0,5 + 0,5 × x / 100` ;
  - à égalité de jambes, le meilleur trio saute d'abord.
- **Le résultat visé** : 28 à 32 tirs et 2,7 à 3,3 buts par club, 12 à 20 % de prolongations ; sur de vrais clubs, le favori gagne 60 à 66 % en médiane (la LNH : ≈ 61 %).

**Ce que les brouillons ont mesuré** (clubs synthétiques, les mêmes dés en paires) :

| La question | Le résultat |
|---|---|
| Un club mieux bâti gagne ? | +1 sur toutes ses cotes : 58 à 60 % une fois *K* recalé ; une vedette au premier trio : +4 à +5 points |
| La feuille du soir est un vrai choix ? | Le meilleur ordre contre l'ordre par force, selon le jeu adverse : à vedettes +12, des tireurs +4, un gros gardien +1, de la profondeur 0, des durs 0. Trois meilleurs ordres différents pour cinq jeux. Un mauvais ordre coûte 7 à 18 points |
| Choisir son trio à chaque présence, en plein match ? | Non : « envoie le plus frais » est toujours la bonne réponse. D'où la feuille avant le match, et pas un bouton pendant |
| Le temps d'arrêt ? | En variance (les tirs doublés des deux bords) : +6 points en retard d'un but à la dernière présence, −2 en avance, 0 au début. Avec un bonus de zone, il valait mieux le lancer tout de suite : un faux choix, retiré |
| La profondeur ? | À *COUT* 30, le quatrième trio ne jouait jamais ; à 40, un quatrième trio refait vaut +4 points le match, +7 sur une série de cinq |
| La cible ? | Un club qui gagne 55 à 60 % de ses matchs et 50 % en séries gagne la Coupe ≈ 15 % du temps avec le rachat d'une série par un cœur (5 % sans) |
| La part des dés dans un acte de six matchs, à force égale ? | ≈ 80 % : une cible d'acte tient du pile ou face si le club ne la dépasse pas. Le build doit l'emporter, d'où des cibles qu'on rate franchement quand on bâtit mal |

**La run** :

- *MATCHS_PAR_ACTE* 5 et le rival ; *ARRETS_PAR_ACTE* 2 ;
- *CIBLES* 7 · 8 · 9 sur 14 ; *COEURS* 2 ;
- les séries en 3 de 5, rachetées une fois par cœur ;
- *PORTES* 3 ; une relance par défaite ; *CASES_DU_BANC* 5.

## 6. Les cas limites

- **La vieille partie** (JP : *on s'en fout de briser les saves*). Une run en cours de l'ancien Rogue ne se rejoue pas : un écran dit ce qui est versé (ses médailles, le prix des déblocages qui partent), puis une run neuve commence. Les clés de sauvegarde ne bougent pas ; le cartable, les médailles et ton club restent — `check_sauvegardes`.
- **Une porte sans personne dans ton espace** : elle le dit avant qu'on l'ouvre ; passer paie toujours.
- **Tous les trios vidés** : le plus frais saute, diminué ; un trio commence un match à 40 de jambes au moins.
- **Un blessé** : la réserve du même poste monte ; sans réserve, un remplaçant de la ligue, plus faible, le temps de l'absence. Les deux gardiens blessés : un gardien de la ligue.
- **Quitter en plein match** : on reprend à la présence où on était ; la graine et l'appel le rejouent pareil.
- **Une carte sans élite sur le chemin, ou sans marché** : chaque carte en a au moins un de chaque, sur des chemins différents.
- **L'écran** : la scène se centre à 390 × 844 au plus ; le pixel art grandit par nombres entiers.
- **Le clavier et la manette** : A joue, B revient, Start ouvre le menu pause ; on glisse un trio avec les flèches.
- **`prefers-reduced-motion`** : le match se lit présence par présence en images fixes ; le DOM porte le vrai pointage.
- **Hors ligne** : `sw.js` liste les modules et la police neufs, oublie les partis — `check_coquille`.

## 7. Ce qu'il touche

**Les fichiers neufs**, au préfixe *run-* dans js/ :

- le moteur des présences ;
- la carte et la run ;
- la feuille du soir ;
- les portes ;
- les pièces et les rivaux ;
- les histoires ;
- la coquille et ses scènes.

Aucun n'importe un module de l'ancien Rogue — *check_neuf* le refuse. Le match en scène lit js/sprites.js et le dessin de la glace de js/sur-glace.js.

**Les fichiers qui changent** :

- `js/saison.js` : le jour à jour du Rogue en sort ; les séries du 82-0 restent ;
- `js/sim.js` : ce que seul l'ancien Rogue lisait en sort, à la tranche 6 ;
- `js/game.js`, `js/menu.js`, `js/alignement.js`, `js/repechage.js`, `js/gerant.js`, `js/impact.js`, `js/rogue.js` (la méta reste, la run part), `js/cartes.js` ;
- `index.html`, `style.css`, `sw.js`, `fonts/` (une police pixel sous licence OFL qui a les capitales accentuées : celle des maquettes, *Press Start 2P*, ne les a pas).

**Les règles fermes** :

- `.claude/rules/rogue.md` : réécrite au complet à la tranche 4.
- `.claude/rules/interface.md` :
  - défaits : « cinq portes », « Le Rogue est le plateau », « Le contenu des pages », « À faire » (la boîte) et « Ta plaque » ;
  - tenus : la carte au format carte de hockey, mobile d'abord, le jus en trois paliers, les vraies stats, les vraies couleurs ;
  - réécrite : « une maison par sujet », qui devient « le HUD, les cartes, le menu pause ».
- `.claude/rules/moteur.md` :
  - « un seul chemin de match » est défait pour le Rogue, qui a son moteur comme Sur table et Sur glace ont le leur ;
  - « aucune cote neuve » est tenue : il lit `axes20`.
- `.claude/rules/vocabulaire.md` :
  - entrent : **carte de l'acte**, **case**, **feuille du soir**, **présence**, **roulement**, **appel**, **porte**, **lien de vestiaire**, **règle du rival**, **cible**, **HUD**, **menu pause** ;
  - partent : **nœud**, **placer**, **renfort**, **moment**, **relais**, **intention**, **promesse**, **Bureau**, **Tes choix**, **plateau**.

**Les décisions de JP du 7 au 9 nov.** :

- Défaites :
  - la saison de 82 matchs au jour le jour et la vraie cédule, remplacées par la carte : *tu choisis les équipes qui vont quand*, tenu par le chemin ;
  - la boutique à sept nœuds, remplacée par les cases de marché ;
  - le duel à un choix, remplacé par la feuille du soir à chaque match ;
  - l'élite du lundi, remplacée par la case d'élite.
- Tenues : 2 cœurs, « rival », l'élite qui ne coûte pas de cœur, le banc de cinq, la pièce au marché, la boule de neige bloquée, la première Coupe pas avant la troisième run, la méta en variété, les maquettes « garder les cartes ».

**Les clés de sauvegarde ne bougent jamais.**

## 8. Ce qui part

La pièce maîtresse. Chaque nom ci-dessous disparaît du jeu au remplacement (tranche 4), et *check_refonte* le vérifie sur la somme. Chacun a été cherché dans js/ ou scripts/ le 9 nov. 2026 ; seul ce qui part est entre accents graves. Le test du zéro : la carte, la feuille, le moteur des présences et les portes s'écrivent depuis le § 4 sans ouvrir un module de l'ancien Rogue.

### La coquille de site

- `SECTIONS_ROGUE` → le HUD et le menu pause.
- `js/composants.js`, `pl-bandeau`, `pl-jetons`, `pl-coin`, `pl-cellules`, `pl-marche`, `pl-podium` → les scènes de la direction choisie.

### Le Bureau, sa boîte et le jour à jour

- `ouvrirSaison` (≈ 3 000 lignes de js/saison.js, ouvert seulement en Rogue) et ses pièces :
  - `rendreActions`, `messagesCourants`, `specsForces`, `PRESSE`, `auBureau` ;
  - `ouvrirJournal`, `nouvellesDuJour`, `autourHtml`, `semainePasseeHtml` ;
  - `prochainHtml`, `bancDuMatinHtml`, `proprioHtml`, `voletFiche`, `annonceHtml` ;
  - `motDuJour`, `motDeLaSemaine`, `avancerSemaine`, `avancerPuisResumer`, `arretDeSemaine` ;
  - `etapesDeLActe`, `regarderProchain`, `offreObjectif`, `soignerLeBlesse`.

  Ils sont remplacés par la carte et ses scènes.

### Les actes posés sur la cédule

- `js/actes.js`, `poserLesRivaux`, `crochetDesActes`, `echangeables`, `ouvrirLeCalendrier`, `renfortDe`, `eliteDeLaSemaine`, `NOEUDS_BOUTIQUE` → la carte de l'acte, ses cases, la cible.

### Le Rogue greffé au simulateur

- `js/greffes.js`, `brancherGreffes`, `exigerGreffes`, `INTENTIONS`, `FORCE_DUEL`, `plansDuDuel`, `ouvrirLeDuel`, `MOMENTS_SI`, `momentsDuSoir`, `appliquerChoix` → le moteur des présences et la feuille du soir.
- `JOURS_OBJECTIFS`, `lanceeDe` → rien : il n'y a plus de saison simulée à habiller.

### Les pièces à condition et leurs bornes

- `js/pieces.js`, `RELAIS_NIV`, `persoAdverse`, `borneV`, `js/banc-du-soir.js`, `bancDuSoirHtml` → les pièces en trois sortes et la règle du rival.

### Les histoires du lundi

- `js/histoires.js`, `js/faits.js`, `js/scenes.js`, `lundiAHistoire`, `CHANCE_HISTOIRE`, `promettre`, `verdictsDuMatin` → les histoires de la carte, écrites de zéro avec `rogue-recit`, aux effets qui durent la run.

### L'ancienne run

- `js/rogue-jeu.js`, `js/inventaire.js`, `js/depart.js` → la run neuve. Ce qui s'y garde (ouvrir une pochette, la page des déblocages) déménage fonction par fonction, nommé à l'extrait de la tranche 4.

### Les juges et les robots de l'ancien jeu

- `scripts/check_plateau.mjs`, `scripts/check_composants.mjs` ;
- `scripts/check_pouvoirs.mjs`, `scripts/check_relais.mjs`, `scripts/check_banc.mjs` ;
- `scripts/check_duel.mjs`, `scripts/check_elites.mjs`, `scripts/check_profondeur.mjs` ;
- `scripts/check_moments_si.mjs`, `scripts/check_histoires.mjs`, `scripts/check_suivis.mjs` ;
- `scripts/check_effets.mjs`, `scripts/check_calendrier.mjs`, `scripts/mesure_rythme.mjs` ;
- `scripts/lib/rogue_sim.mjs`, `scripts/lib/rogue_actes.mjs`, `scripts/lib/cartes_robot.mjs`, `scripts/lib/duel.mjs`.

Ils sont remplacés par *check_match*, *check_run*, *check_scene*, *check_neuf*, *mesure_run* et *essai_run*.

**Le compte** : 76 noms, dont 10 fichiers du jeu (≈ 4 200 lignes), la plus grosse fonction du dépôt (≈ 3 000 lignes), la section du plateau de style.css (≈ 840 lignes) et 18 scripts. Tout script qui importe un module parti part ou se réécrit ; leur liste complète se fixe à la tranche 4.

**À vérifier à sa tranche avant de l'ajouter** (en italique, pour que *check_refonte* ne le compte pas encore) :

- *js/banque.js* : ses cartes rares deviennent le vestiaire et le marché ;
- *js/magasin.js*, *js/pronostic.js*, *js/vie-gm.js* (les voix), *js/galons.js*, *js/profil-style.js* ;
- *js/ballottage.js* : le 82-0 s'en sert-il encore ?
- les gabarits *hub-* que le tournoi de Sur table partage ;
- les situations de vestiaire et les accidents de carte de js/sim.js.

## 8b. Ce qui reste, et pourquoi

- **Les données et les cotes** : data/, js/ratings.js, `axes20`, `NIVEAUX`. Les vrais joueurs ; une cote affichée est une cote jouée.
- **Les cartes de hockey** : `cartonHtml`, `carteHtml`, les 55 séries, `EDITIONS`, le recto-verso, la pochette et sa pile (JP, deux fois).
- **Les rôles, les badges, les accords** : `PROFILS`, `badgesDe`, `AFFINITES`. Le match neuf leur donne un effet qu'on voit.
- **Les vrais vestiaires et l'échange** : js/repechage.js, `choisirQuiSort`. C'est la porte et la signature.
- **Les vrais coachs** : `lotoDesCoachs`, data/coachs.json, les huit philosophies. Leur roulement et leur règle sont réécrits, leur carte reste.
- **Sur glace** : js/sur-glace.js, js/sprites.js, js/sons-glace.js. Il devient la scène du match, sans changer ses règles.
- **Les sons et le jus** : js/sons.js, js/mouvement.js.
- **Les écussons et les photos** : js/logos.js, img/.
- **Le cartable, l'album, ton club, le panthéon, les médailles, les exigences.** Les galons se réécrivent à l'échelle d'une run courte (trois buts dans un match, cinq points dans une série) : 40 buts ne se font plus en vingt matchs.
- **Le simulateur calibré** (js/sim.js), pour le 82-0, l'exhibition, et pour aligner les clubs adverses (`autoRoster`).
- **Le 82-0, Sur table, l'exhibition** : aucun ne change.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| *PRESENCES_PAR_PERIODE* | 5 | 4-6 | à 3, un match est un coup de dés ; à 8, il dure trop |
| *K* | 0,9 | 0,75-1,0 | plus haut, une cote de plus gagne tout ; plus bas, le build ne se sent pas |
| *COUT_PRESENCE* | 40 | 35-50 | à 30, le quatrième trio ne joue jamais ; à 50, tous les trios se valent |
| *MATCHS_PAR_ACTE* | 5 et le rival | 4-6 | moins, la cible est un coup de dés ; plus, la run passe deux heures |
| *CIBLES* | 7 · 8 · 9 sur 14 | ±1 chacune | le premier levier de la difficulté |
| *COEURS* | 2 | 2 (JP) | ne se règle pas |
| *PORTES* | 3 | 2-4 | à 1, pas de choix ; à 5, plus de manque |
| L'accord, le lien | ×1,5 · +1, +2 | ×1,25-×2 · +1-+3 | trop bas, on aligne sans lire ; trop haut, un seul build existe |
| La durée d'un match vu | 45-60 s | 30-90 s | plus long, dix-huit matchs deviennent une corvée |

## 10. Les critères d'acceptation

Les portes d'abord : une tranche ne commence pas tant que la porte d'avant n'est pas passée.

- [ ] **La porte 0, le test d'un jour** (robots, de vrais clubs, aucun écran) — *mesure_run* (neuf), sur 64 actes et les mêmes dés. Rouge, on change le noyau avant tout écran.
  - Le match est du hockey : 28 à 32 tirs et 2,7 à 3,3 buts par club ; le favori gagne 60 à 66 % en médiane.
  - Le robot qui lit (les lignes adverses, les accords, la règle du rival) tient sa cible au moins 5 points plus souvent que le **robot du chiffre**, qui prend toujours la carte la mieux cotée et l'ordre par force.
  - Aucun roulement de coach n'est un piège : chacun est au-dessus du coach neutre avec le club qui lui va, et en dessous sans lui.
  - La feuille du soir : le meilleur ordre vaut au moins 4 points de plus que l'ordre par force en moyenne, et change pour au moins trois jeux adverses sur cinq.
- [ ] **La porte 1, les écrans** — à juger par JP : chaque scène du § 4.10, dans la direction choisie, à 390 × 844 ; il tranche avant le code.
- [ ] **La porte 2, un acte au téléphone** — à juger par JP : après un acte grossier du « Rogue neuf », il en relance un deuxième.
- [ ] **La run** — *check_run* (neuf), *essai_run* (neuf, à 390 px) :
  - trois actes de cinq matchs et un rival, deux arrêts par acte ;
  - la cible et les cœurs recomptés ;
  - un rival par acte, avec sa règle annoncée ;
  - trois portes après chaque match, l'une le club affronté ;
  - aucun joueur deux fois ;
  - le plafond jamais dépassé.
- [ ] **Lire paie, sans gagner d'office** — *mesure_run*, en CI :
  - en paires, sur 64 graines, le robot qui lit gagne la Coupe 4 à 12 fois, le robot du chiffre moins souvent, « premier » au plus 2 fois ;
  - la première Coupe jamais avant la troisième run en médiane (JP) ;
  - au moins une run sur dix du robot qui lit finit l'acte III à 75 % de pronostic moyen ou plus (*tu peux exploser le jeu*).
- [ ] **Une scène, jamais une page** : dans le Rogue, aucune scène ne défile ; aucun en-tête de site ni barre d'onglets ; le HUD toujours au même endroit ; chaque carte du match fait 90 px au moins ; chaque cible fait 44 × 44 — *check_scene* (neuf).
- [ ] **Neuf touchers** : une semaine gagnée (la case, la feuille, le match, les portes, l'échange) en neuf touchers au plus, aucun sans décision — *essai_run*.
- [ ] **Le match vu est le match joué** : chaque présence montrée a les tirs, les buts et les tireurs que le moteur a joués ; la même graine et le même appel rejouent le même match — *check_match* (neuf).
- [ ] **Le match tient au téléphone** : 60 images par seconde à l'essai de `glace-perf` — `essai_poids`.
- [ ] **Le neuf ne s'appuie pas sur l'ancien** : aucun fichier *run-* n'importe un module nommé au § 8 — *check_neuf*.
- [ ] **Le 82-0 ne bouge pas** : l'empreinte du simulateur est la même — `check_empreinte`, `check_feuilles`, le smoke.
- [ ] **Les vieilles parties** s'ouvrent, versent leurs médailles et commencent une run neuve — `check_sauvegardes`.
- [ ] Pas une couche de peinture : ce qui part est parti ; le jeu retire au moins une ligne pour deux ajoutées ; style.css fait moins de la moitié du diff — `check_refonte` (sur la somme).
- [ ] Rien de mort — `check_mort`.
- [ ] À juger par JP à l'essai :
  - on dirait un jeu ;
  - une porte donne envie de l'ouvrir ;
  - placer ses trios contre leurs lignes est un plaisir ;
  - perdre fait dire « j'aurais dû ».

## Les tranches

L'ancien Rogue reste jouable et **gelé** jusqu'à la tranche 4 : les tranches 8 à 11 de la V27 et D1b s'arrêtent. Chaque tranche porte son extrait `docs/refonte-v28-<n>.md`.

**0. Le test d'un jour.** Le moteur des présences dans un script de mesure, sur de vrais clubs, avec trois robots (celui qui lit, celui du chiffre, « premier ») sur 64 actes. *Le joueur ne voit rien.* Juge : la porte 0.

**1. Les écrans.**
- Fait : les trois directions sur deux écrans, et la boucle (docs/maquettes/v28.html).
- À faire : toutes les scènes dans la direction choisie. *JP tranche ; aucune ligne de code.*

**2. Un acte.** Le moteur dans js/, la coquille (le HUD, le menu pause), la carte d'un acte, la feuille du soir, le match en scène, les portes, le marché et le vestiaire, un rival et sa règle ; trois coachs, huit pièces. « Le Rogue neuf » s'ouvre du menu à côté de l'ancien. *Le joueur voit vingt minutes de jeu complètes.* Juge : la porte 2, *check_match*, *check_scene*, *check_neuf*, *essai_run*.

**3. La run.** Trois actes et les séries ; les huit coachs, vingt-quatre pièces, six rivaux, vingt histoires, les élites, l'usure, une époque par run ; les robots. Juge : *mesure_run* (en CI), *check_run*, JP.

**4. Le remplacement.** « Le Rogue neuf » devient le Rogue. Tout le § 8 part d'un coup, ses règles et ses juges avec ; la vieille run est versée. Juge : `check_refonte` sur la somme, `check_mort`, `check_coquille`, `check_sauvegardes`, `tout.mjs`.

**5. La méta.** La variété en médailles, les exigences sur les leviers neufs, les galons à l'échelle d'une run. Juge : *mesure_run* (avec tout débloqué et sans rien, dans l'écart du hasard).

**6. Le ménage du simulateur.** Ce que seul l'ancien Rogue lisait sort de js/sim.js. Juge : `check_mort`, `check_empreinte`.

**Ensuite**, du contenu, une PR à la fois : des rivaux, des pièces, des histoires, la Dynastie réécrite sur le jeu neuf, le défi du jour.

## 11. Les questions à JP

1. **La boucle** : l'acte devient une carte à chemins (des matchs contre de vrais clubs, l'élite, le marché, le vestiaire, une histoire, le rival au bout). Chaque match se joue en trois temps : la feuille du soir, le match vu sur la glace, les trois portes. La run fait trois actes et les séries, au lieu des 82 soirs ? — **Recommandé : oui.**
2. **Le moteur** : le Rogue joue ses matchs avec un moteur de présences à lui, fait pour être vu sur la glace de Sur glace et qui lit les mêmes cotes que tes cartes ; le simulateur calibré reste au 82-0 ? — **Recommandé : oui.**
3. **La direction** : la carte de C et le reste en arcade 16 bits (A), ou la table de cartes (B) ? — **Recommandé : C pour la carte, A pour le reste.**
4. **L'ancien Rogue** : gelé dès aujourd'hui, jouable jusqu'au remplacement, puis supprimé ; les runs en cours perdues, les médailles et le cartable gardés ? — **Recommandé : oui.**

## 12. Ce qui a été écarté

- **Garder les 82 soirs et mieux choisir entre eux** : la V3 à la V27.
- **Refaire l'interface seule, sur la mécanique d'aujourd'hui** : un premier brouillon du 9 nov. ; JP : *un change l'autre*. Une saison simulée d'un trait ne donne qu'un fil à montrer et des pages à feuilleter.
- **Choisir son trio à chaque présence pendant le match** : mesuré, « le plus frais » est toujours la bonne réponse. C'était le contre de la V6 et le matching de la V13 sous un autre nom.
- **Un deck de cartes de tactique joué pendant le match** : mort trois fois (la v2, la V10, la V13). Les cartes du jeu, ce sont les joueurs.
- **Le pronostic à chaque geste** : c'était un solveur qui jouait le club à ta place (la V9 : *mener, c'est ne pas défaire l'automatique*). Il reste sur la feuille du soir seulement.
- **Trois portes après une victoire, une après une défaite** : c'était la boule de neige.
- **Les séries en 2 de 3** : la run finissait sur des dés.
- **Le match de Sur table ou un match joué à la manette dans le Rogue** : vingt à quarante minutes par match, une autre habileté. Sur glace prête sa glace, pas sa manette.
- **Le simulateur calibré sous le match neuf** : c'est par ses canaux que chaque effet était borné jusqu'à ne plus se sentir.
