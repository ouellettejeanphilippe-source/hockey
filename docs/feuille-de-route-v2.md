# Feuille de route V2

*Tirée de la carte des rouages (https://claude.ai/artifact/Sw7WR6CVmMMorDC9t8Jx1J) : 169 mécaniques, 118 accrocs, lus dans le code le 3 octobre 2026. La page : https://claude.ai/artifact/GPfiv5UjDRYzvuHKfqV53T*

Réparer d'abord, parce qu'on ne branche rien sur ce qui ment ; une seule langue ensuite, pour que les synergies se lisent ; puis la refonte (docs/refonte-systeme.md). Chaque item dit où il vit dans le code et le script qui prouvera qu'il est fait. Coche les cases au fur et à mesure, comme dans LIVRAISON.md.

| Verbe | Items |
|---|---|
| Réparer (cassé ou faux) | 15 |
| Supprimer (un mot, une icône, un vestige) | 10 |
| Améliorer (le vrai chiffre, à l'écran) | 15 |
| Attacher ensemble (ce qui doit se parler) | 8 |
| Ajouter (la refonte) | 8 |

## V2.0 — Ça marche et ça dit vrai

Réparer ce qui est cassé ou qui ment, avant de bâtir dessus. Petits correctifs, chacun prouvé par un script ou une graine.

**Fini quand** Aucune run ne se bloque ; aucune décision ne se prend toute seule ; chaque item a son test qui échoue sans le correctif.

- [ ] **Réparer · Une run ne se bloque plus entre deux saisons.** « Passer le repêchage » laisse des cases vides alors que l'écran promet des plombiers ; la saison refuse de partir et la case vide renvoie à une boutique fermée. Combler les trous avec des plombiers, comme promis. — `js/rogue-jeu.js (choisirNouvelleEquipe)` — preuve : `essai_rogue : passer le repêchage, puis lancer`
- [ ] **Réparer · Déplacer à la main respecte le poste.** La permutation pose un défenseur au centre ou un patineur au filet (−999). Refuser comme la signature le fait déjà. — `js/alignement.js` — preuve : `smoke : un D vers C est refusé`
- [ ] **Réparer · « Plus tard » repousse vraiment.** La main de la journée et les événements offrent « Plus tard », mais leur message bloque quand même « Journée suivante ». Ou bien le bouton repousse (sans bloquer), ou bien il disparaît : on choisit une règle et on l'écrit. — `js/saison.js (boîte)` — preuve : `smoke : « Plus tard » puis « Journée suivante »`
- [ ] **Réparer · La consigne ne passe plus à Haute toute seule en séries.** « Préparer le match » s'ouvre sur Haute en séries (blessures +25 %, usure +12 %) et « Appliquer » la pose sans que tu la choisisses. Normale partout par défaut. — `js/saison.js:3738` — preuve : `check_choix`
- [ ] **Réparer · Contrer un plan fait quelque chose.** Contrer « vedette » par la consigne Basse ou « matraquage » par deux lignes en Basse lève un drapeau que le moteur ne lit jamais ; Basse ne penche défense que de ±0. Brancher le contre, ou retirer ces conseils. — `js/sim.js (gros.contre), effetDeMoment` — preuve : `check_gros`
- [ ] **Réparer · Un pack payé ne se perd plus.** Un pack scellé après la date limite « s'ouvre la saison prochaine », mais il est perdu si la run finit ou en mode Saison. Le rembourser ou l'ouvrir à la fin. — `js/rogue-jeu.js:1343` — preuve : `check_rogue`
- [ ] **Réparer · Le trio de fermeture se remet en automatique.** Retoucher le 🔒 met la fermeture à « aucune » : plus aucun appariement, et la note « par défaut, le 3e » disparaît. — `js/alignement.js:471` — preuve : `check_graine`
- [ ] **Réparer · « Remettre comme avant » ne touche que les cases.** Au retour d'un blessé, il restaure aussi la fermeture et les lignes d'avant : il peut écraser une consigne réglée depuis. — `js/saison.js:3290` — preuve : `check_ballottage`
- [ ] **Réparer · La fiche demande la même confirmation que la carte.** « Signer » depuis la fiche passe sans le « bloque la fin » ni la confirmation à deux touchers. — `js/fiche.js:446` — preuve : `smoke`
- [ ] **Réparer · La recrue repêchée garde la carte qu'on lui a montrée.** Montrée en carte de base, elle entre en jeu avec une variante tirée au hasard (25 % brillante). — `js/rogue-jeu.js:1287, 1322` — preuve : `essai_rogue`
- [ ] **Réparer · « Le retour de l'ancien » ne ment plus.** L'avant-match affirme qu'un joueur que tu as laissé partir joue chez eux, sans le vérifier. Ne le tirer que si c'est vrai. — `js/sim.js:7355` — preuve : `check_choix`
- [ ] **Réparer · Les dates se comptent en matchs, partout.** L'adversaire passe à 4 d'élan au jour 125, pas au 55e match ; le pack gratuit tombe aux journées 20, 40, 60 (le 9e, 18e, 26e match) ; les cartes disent « journées » et comptent des matchs. — `js/combat.js:492, js/inventaire.js:33, js/inventaire.js:86` — preuve : `check_calendrier`
- [ ] **Réparer · La garantie des packs tombe au bon pack.** L'écran promet le 9e, le code donne le 8e. — `js/rogue-jeu.js:258` — preuve : `check_packs`
- [ ] **Réparer · Le conseil « Consigne : attaque » pose un vrai réglage.** Il écrit un réglage (±2) que ni l'écran ni les règles ne connaissent, et rouvrir « Préparer le match » l'efface. — `js/pronostic.js:414` — preuve : `check_pronostic`
- [ ] **Réparer · La main adverse montre ce qui jouera.** L'aperçu échelonne leurs cartes (×0,5 à ×2) même hors Rogue, où le moteur joue ×1. — `js/saison.js:1059, js/gerant.js:1356` — preuve : `check_gros`

## V2.1 — Une langue

Un mot par idée et une icône par sens, partout ; ce qui ne sert plus s'en va. C'est ce qui rend les synergies lisibles avant de les brancher.

**Fini quand** check_clarte connaît la liste des mots réservés et des icônes, et rougit si un écran les réemploie ; check_mort ne trouve aucun vestige.

- [ ] **Supprimer · « Élan » ne veut plus dire qu'une chose.** La mana des cartes, la récompense d'un gros match (« 🔥 L'élan ») et une carte. Garder « élan » pour la mana ; renommer les deux autres (« La lancée », par exemple). — `js/sim.js:7801, js/combat.js:211` — preuve : `check_clarte`
- [ ] **Supprimer · « Vestiaire », « classeur », « rejouer », « coach », « plombier », « relance ».** Cinq sens pour « vestiaire », deux pour « classeur », trois pour « rejouer », la philosophie et l'entraîneur pour « coach », le rôle, les joueurs faibles et un système pour « plombier », le reroll et la sortie de zone pour « relance ». Un mot chacun. — `js/rogue-jeu.js, js/saison.js, js/sim.js` — preuve : `check_clarte`
- [ ] **Supprimer · « Rivalité », « trophée », « Basse », « doublon », « contrat », « écusson ».** La rivalité a quatre définitions ; Selke et Norris sont « trophées » et « traits » ; « Basse » nomme la consigne et l'agressivité ; un doublon n'est pas le même au pack et au cartable ; deux familles « contrat » ; l'écusson est une monnaie et un logo. — `plusieurs` — preuve : `check_clarte`
- [ ] **Supprimer · Une icône, un sens.** 🔥 (l'échec avant, l'élan, quatre victoires, un entracte), 🧱 (Norris, la défense au direct, un style), 🛡️ (un pack, un adjoint, un roulement, le Selke), 🏅 (monnaie et rayon du club), et les identités de départ qui reprennent les icônes des badges et des traits. — `js/identites.js, js/sim.js, js/packs.js` — preuve : `check_clarte`
- [ ] **Supprimer · Une seule écriture des zones.** « 1er-2e trio » sur la carte, « T1-2 » dans la case ; « rés. » qui est aussi une case de réserviste ; les règles n'en listent que la moitié. — `js/ratings.js:634, js/repechage.js:1262` — preuve : `check_clarte`
- [ ] **Supprimer · Le vestige du plan de match.** Le banc dit « avec ces trios, ce plan et cette glace » et remplit un plan que le moteur ne lit plus ; des écouteurs sans bouton. — `js/banc.js:96, 554, 564` — preuve : `check_mort`
- [ ] **Supprimer · Les factions disparues.** Le bureau annonce que « les partisans montent / les médias s'acharnent » : ces factions ont été retirées en S72. — `js/saison.js:2003` — preuve : `check_clarte`
- [ ] **Supprimer · Ce que le bilan dit deux fois.** L'infirmerie et les tranches de 10 matchs apparaissent deux fois. — `js/bilan.js:785, js/entracte.js:261` — preuve : `smoke`
- [ ] **Supprimer · Le poste secondaire inventé.** Aucune donnée ne porte le second poste : 40 % viennent d'un hachage de l'id, et ce poste inventé annule des pénalités, ouvre le loto et élargit la zone. Le lire dans les vraies stats, ou le retirer. — `js/ratings.js:660-684` — preuve : `check_ratings`
- [ ] **Supprimer · Les commentaires qui disent le contraire du code.** « Le Rogue ne repêche jamais », « le Phénomène en dernier », « Autre année » qui garde le club, MOTEUR.md encore à 6 % et −15 %. — `js/cartable.js:10, js/alignement.js:361, MOTEUR.md:368` — preuve : `relecture`

## V2.2 — Ce que tu vois, c'est ce qui joue

Chaque chiffre à l'écran est celui du moteur, et chaque effet qui compte se voit quelque part. Le joueur décide sur du vrai.

**Fini quand** Chaque chiffre affiché vient d'une constante (check_clarte) ; les totaux du soir couvrent tous les canaux ; aucun effet ne joue sans une ligne qui le dit.

- [ ] **Améliorer · Les totaux du soir disent tout.** Ils ne couvrent que tirs, précision, buts contre et punitions : ni blessures, ni usure, ni robustesse, ni systèmes, ni badges, ni chimie, ni jambes. L'affiche peut dire « aucun effet » un soir chargé. — `js/sim.js:6793 (totauxDuSoir)` — preuve : `check_totaux`
- [ ] **Améliorer · Les coûts cachés s'annoncent.** Un objectif raté ajoute « La distraction » au deck ; une longue blessure ou une défaite contre la rivalité laissent une cicatrice ; une chimie sous 26 coûte ; un dos-à-dos multiplie les blessures par 1,5 et coupe la récupération ; une bagarre coûte 8 jambes. — `js/saison.js, js/combat.js, js/direct.js` — preuve : `smoke`
- [ ] **Améliorer · Les bons chiffres sur les zones, la carrure, la glace, les jambes.** « −3 par cran » au lieu de 1,5 × cran² ; « 0,6 jambe » pour un costaud qui en paie 1,06 ; la glace calculée sur la mauvaise table ; le conseil qui dit 90 au lieu de 94 ; l'infobulle des patineurs sur les jambes du gardien. — `js/game.js:401, js/fiche.js:79, js/gerant.js:691, js/pronostic.js:405` — preuve : `check_clarte`
- [ ] **Améliorer · Le badge dit son effet net.** La fiche montre l'effet brut (−8 %), le moteur joue l'effet net (−7,6 %) ; un joueur sans le badge tire son unité un peu sous zéro, sans que rien le dise. — `js/fiche.js:73` — preuve : `check_clarte`
- [ ] **Améliorer · Ce que les règles taisent.** L'avantage numérique et la prolongation (qui se joue sur une cote cachée), le loto et ses retraits, l'ajustement de séries, l'adjoint qui joue la série, les huit sortes de la main, la carte tirée sur une case vide, les coachs dans tous les modes, le barème de jetons hors Rogue. — `index.html (#pageRegles)` — preuve : `check_clarte`
- [ ] **Améliorer · La blessure d'un joueur qui a peu joué.** À 20 matchs dans sa vraie saison, un joueur se blesse huit fois plus qu'à 82 ; rien ne le dit, et le prorata 82 le pousse en haut des tris. — `js/sim.js:4811, la carte` — preuve : `check_fiches`
- [ ] **Améliorer · Le gardien dit sa part des départs.** Un partant de 25 matchs avec un auxiliaire de 60 cède la moitié des départs ; la carte ne montre que le % d'arrêts. — `js/sim.js:4930, js/alignement.js` — preuve : `smoke`
- [ ] **Améliorer · L'agressivité dit tout ce qu'elle change.** Elle change les jambes adverses, les bagarres, la robustesse ; les boutons ne montrent que défense, punitions, usure. Et « Par défaut » n'est pas ce que joue une ligne jamais réglée. — `js/gerant.js:979` — preuve : `check_clarte`
- [ ] **Améliorer · Un système en étouffe vraiment un autre.** La règle dit que chacun en étouffe un, mais trois n'étouffent rien et le Trio de plombiers ne peut jamais être étouffé. Fermer le cycle. — `js/sim.js:1650-1692 (bat)` — preuve : `check_tactiques`
- [ ] **Améliorer · « En face » vise la bonne unité.** Le conseil compare ton trio au trio adverse de même rang ; le moteur envoie leur fermeture contre ton 1er trio 40 % du temps. — `js/gerant.js:728` — preuve : `check_pronostic`
- [ ] **Améliorer · Un seul dé.** Un pari se montre en dé à six faces, en « 🎲 50 % », ou en « 🎲 Pari » sans dé. La même scène pour tous. — `js/gerant.js:1254, 1383` — preuve : `check_choix`
- [ ] **Améliorer · Le plafond, la même jauge partout.** « % du plafond » toujours sur 95,5 M$ ; la valeur d'époque mélange les dollars ; la jauge oublie le plafond effectif hors Rogue ; « signables » a deux définitions. — `js/game.js:68, js/repechage.js:830-1146` — preuve : `smoke`
- [ ] **Améliorer · Le calendrier ne promet que ce qui arrive.** La route pose ❓ et 💬 à des dates où rien ne viendra peut-être ; les accidents et le verdict du proprio n'y sont pas. — `js/saison.js:581, 2173` — preuve : `check_calendrier`
- [ ] **Améliorer · Le niveau, la zone et le badge ne se contredisent plus.** Trois verdicts pour le même joueur (« Soutien », « 1re-2e paire », « Défensif Or ») ; le plus en vue, le niveau, ne joue pas dans le match. Dire à quoi sert chacun, en un mot. — `js/niveaux.js, js/ratings.js, js/sim.js` — preuve : `check_clarte`
- [ ] **Améliorer · La collection se complète.** La banque compte au dénominateur des cartes qui ne sortent d'aucun pack ; l'album compte l'historique, pas le cartable ; les moments légendaires gravés ne se relisent nulle part. — `js/inventaire.js:184, js/album.js:75, js/cartable.js:134` — preuve : `check_packs`

## V2.3 — Tout se parle

Brancher les mécaniques qui devraient se parler : les étapes 2 et 3 de la refonte. Le badge devient la langue du système, du coach et de ses adjoints.

**Fini quand** check_voies : chaque voie de coach bâtie au complet vaut +6 à +8 V, à ±1 V des autres, au-dessus d'une équipe mélangée ; check_ratings et check_robot tiennent.

- [ ] **Attacher ensemble · Les systèmes lisent les badges.** Une case demande un badge ; le bon rend son palier, le second la moitié, le mauvais rien. Fini le score de style à part : « Sniper Or » est ce que le système lit. — `js/sim.js (fitUnite, stylesDe)` — preuve : `check_tactiques, check_chimie`
- [ ] **Attacher ensemble · Le coach aime son système.** Le système de sa couleur joue comme si chaque case avait un palier de plus ; la confiance II apprend un système qui demande SES joueurs (aujourd'hui l'Aigle des snipers apprend un système de power forwards). — `js/coachs.js, js/sim.js` — preuve : `check_coachs`
- [ ] **Attacher ensemble · Le dépisteur recrute la couleur de son coach.** Le Frelon recrute aujourd'hui des joueurs du Doc et de l'Abbé. — `js/packs.js:316` — preuve : `check_coachs`
- [ ] **Attacher ensemble · La confiance se compte en paliers.** Un Platine compte pour quatre, sans plafond à cinq joueurs. — `js/coachs.js:81` — preuve : `check_coachs`
- [ ] **Attacher ensemble · Les gardiens ont un badge.** Un badge à palier lu dans ses vraies stats (le Mur, l'Acrobate…), avec une couleur que le coach compte ; le style devient ce badge, et la saison le lit enfin. — `js/sim.js, js/ratings.js` — preuve : `check_gardiens`
- [ ] **Attacher ensemble · Coach et adjoints, au prestige.** Rogue seulement. Trois coachs ouverts au départ, un de plus par rang ; deux adjoints imposés, des passifs neutres ; le prestige ouvre d'autres adjoints et des places. Le Comptable devient un adjoint. — `js/rogue.js, js/banque.js, js/coachs.js` — preuve : `check_rogue, essai_rogue`
- [ ] **Attacher ensemble · La robustesse se voit là où elle joue.** Le moteur lit une cote cachée de robustesse ; la seule mesure visible, la carrure 🪨, en lit une autre. Une seule mesure, montrée. — `js/sim.js:3563, 1777` — preuve : `check_ratings`
- [ ] **Attacher ensemble · Le roulement devient une vraie décision.** Il ne s'atteint que par « Les ménager », présenté par son prix ; ses effets n'entrent ni dans les totaux ni dans la glace affichée. — `js/saison.js:2261` — preuve : `check_jambes`

## V2.4 — Monter et s'assortir

Les ajouts de la refonte, étape 4 : un joueur monte de palier, un trio s'assortit, les cartes se lisent en cinq types.

**Fini quand** check_cartes (en paires) : une carte isolée jusqu'à ±2 V, dite en vrais chiffres ; la variante sert le joueur ; check_combat lit chaque carte.

- [ ] **Ajouter · Monter un palier : la carte d'entraînement.** Une modif qui monte un badge d'un palier, comme une planète de Balatro monte une main. — `js/banque.js` — preuve : `check_cartes`
- [ ] **Ajouter · Monter un palier : la variante.** Holo ou Or : la carte commence un palier plus haut, au lieu d'un bonus de 3 à 5 % sur un canal tiré au hasard. — `js/rarete.js` — preuve : `check_cartes`
- [ ] **Ajouter · Monter un palier : le mentor de trio.** Une modif de trio : ses compagnons de ligne montent d'un palier tant qu'il joue avec eux. — `js/banque.js, js/sim.js` — preuve : `check_cartes`
- [ ] **Ajouter · Les cartes en cinq types.** Joueur, Modif, Staff, Tactique, Coup. La carte de saison et l'événement (un bonus et son prix, ne différant que par leur durée) se fondent. — `js/banque.js, js/combat.js` — preuve : `check_banque`
- [ ] **Ajouter · Une carte dit ce qu'elle vaut.** « +3 buts projetés », mesuré par le moteur comme la prévision, au lieu de pourcentages à additionner. — `js/pronostic.js` — preuve : `check_cartes`

## V2.5 — Chaque coach son histoire

Étapes 5 et 6 : le coach a ses événements, les paquets suivent les voies, et la difficulté se choisit.

**Fini quand** Chaque coach a 3 ou 4 événements à lui, au dé ; essai_rogue en croise un ; check_robot et check_gros tiennent.

- [ ] **Ajouter · Les événements de chaque coach.** Le blanchissage de la Tortue, la bagarre générale du Rhino, la vedette qui veut plus de glace du Showman… en fenêtre, au dé. — `js/sim.js (MOMENTS)` — preuve : `check_choix`
- [ ] **Ajouter · Les paquets suivent les voies.** Paquet du coach, paquet de badges, paquet de combat, paquet mystère. — `js/packs.js` — preuve : `check_packs`
- [ ] **Ajouter · La difficulté se choisit.** Au départ de la run : un mandat du proprio plus dur contre plus d'écussons, comme la Chaleur de Hades. — `js/rogue.js (MANDATS)` — preuve : `check_rogue`
