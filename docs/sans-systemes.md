# Sans les systèmes de ligne

25 octobre 2026. JP, au duel de la V17 : *même les stratégies de lignes, c'est à jeter*. Avant de les jeter : ce que chaque coach y perd, mesuré, et ce que chacun devient. Rien n'est jeté ici ; ce document est la mesure et la proposition. La mesure : `node scripts/mesure_sans_systemes.mjs`.

## 1. Ce que les systèmes font aujourd'hui

Un système (`TACTIQUES` pour un trio, `SYSTEMES_D` pour une paire, js/sim.js) touche le moteur par six chemins. Les jeter, c'est les couper tous :

| Chemin | Ce qu'il fait | Ce qui le lit |
|---|---|---|
| Le gain et le prix | chaque système bouge des canaux de son unité (🌧 +15,7 % de tirs pour −4,6 % de précision…), le gain au prorata du fit de ses badges | `canalSysteme`, `echelleFit`, `fitUnite` |
| La chimie | seule une ligne qui joue un système a de la chimie ; son plafond suit le fit, plus 12 de fit par passeur ou manieur Platine | `chimieLigne`, `BADGE_CHIMIE` |
| L'action spéciale | à chaque lancer à forces égales, une chance (`SPEC_BASE` × chimie) que ce soit le jeu de la ligne, qui entre 1,8 fois plus souvent ; toute la ligue est ramenée d'autant (`SPEC_NORME` 0,88) | `jouerCote` |
| L'étouffé | chaque système en étouffe un autre (`bat`) : l'action spéciale du trio d'en face ne passe pas | `jouerCote`, le dépistage |
| Le style du club | ce que les systèmes font de la pression de ses joueurs ferme ou ouvre le jeu des deux côtés, centré sur `REF_STYLE_VOL` | `tempoDe` |
| L'appariement de l'IA | chez elle, l'IA envoie le trio qui étouffe le tien | `planDeLIA` |

En Rogue (V15), les badges ouvrent les styles : 🌧 et 🏹 au 🎯 Sniper, 🌀 et 🏹 au 🅰 Passeur, 🧲 au 🦍 Power, 🪤 et 🌗 au ☯ Deux sens, 🔥 au 🔧 Checker ou au 🪠 Plombier, 🧰 au 🪠 Plombier ou au 👊 Bagarreur ; 🏠 au 🛑 Défensif, 🛫 au 🚀 Offensif, 💨 au 🏒 Manieur, 🧹 au 💪 Physique. Un coach n'a pas de système : il a des joueurs de sa couleur, et ce sont leurs badges qui ouvrent les styles.

**Ce que chaque badge garde sans système.** Presque chaque rôle a son canal à lui (`EFFET_ROLE`), joué par joueur pendant ses présences, que les systèmes ne touchent pas : le checker et le two-way d'avant, le défensif et le physique étouffent les tirs d'en face ; le bagarreur intimide ; le power forward fait finir ses coéquipiers devant le filet ; le plombier use moins ses jambes ; le sniper tire en avantage numérique ; le défenseur offensif fait tirer sa paire. **Trois badges n'ont pas de canal à eux** : le 🅰 passeur et le 🏒 manieur ne jouent QUE par la chimie (`BADGE_CHIMIE`), donc par un système ; le ☯ two-way d'une paire, que par 🌗 le jeu à deux sens. Sans système, ces trois-là ne font plus rien sur la glace : leurs points restent, leur badge devient une étiquette.

**Ce que chaque coach a dans les systèmes.** Un coach n'a pas de système à lui depuis la V9 ; ses joueurs en ouvrent par leurs badges (`COACH_DU_ROLE`, js/coachs.js) :

| Coach | Ses badges | Les styles qu'ils ouvrent | Ce que ses badges gardent sans eux |
|---|---|---|---|
| 🦅 L'Aigle | 🎯 sniper | 🌧 Volume de tirs, 🏹 Contre-attaque (avec un passeur) | il tire en avantage numérique |
| 🐝 Le Frelon | 🦍 power, 🚀 défenseur offensif | 🧲 Jeu d'enclave, 🛫 Activer les défenseurs | la finition de ses coéquipiers devant le filet ; les tirs de la pointe |
| 🐢 La Tortue | ☯ two-way, 🛑 défensif | 🪤 Trappe, 🌗 Jeu à deux sens, 🏠 Rester à la maison | le two-way d'avant et le défensif étouffent ; le two-way d'une paire, rien |
| 🦏 Le Rhino | 👊 bagarreur, 💪 physique | 🧰 Trio de plombiers, 🧹 Nettoyer l'enclave | il intimide ; le physique étouffe |
| 🫁 Le Doc | 🪠 plombier | 🔥 Échec avant, 🧰 Trio de plombiers | ses jambes s'usent moins |
| 😇 L'Abbé | 🏒 manieur | 💨 Sortie rapide, et la chimie | rien |
| 🪜 Le Contremaître | 🔧 checker | 🔥 Échec avant | il étouffe |
| 🌠 Le Showman | 🅰 passeur | 🌀 Cycle, 🏹 Contre-attaque (avec un sniper), et la chimie | rien |

Le 🏦 Comptable n'a pas de joueurs : il paie, les systèmes ne le touchent pas.

## 2. La mesure

`node scripts/mesure_sans_systemes.mjs` (douze ligues Rogue de 32 vrais clubs, une demi-heure sur quatre processus). Deux mondes, les mêmes clubs, les mêmes graines :

- **avec** : le jeu d'aujourd'hui (`courbe`, chaque unité joue le style que ses badges ouvrent) ;
- **sans** : chaque ligne de chaque club au Hourra. La ligue y est recalée comme on la recalerait en jetant les systèmes : `SPEC_NORME` à 1 (plus d'actions spéciales à compenser) et `REF_STYLE_VOL` à 1 (le style de référence que les systèmes donnaient à tous).

Pour chaque coach, en paires (la moitié de la ligue traitée, puis l'inverse, comme `check_voies`) : **ses joueurs** (le club rebâti à sa couleur, à salaire égal, contre le club tel quel, sans coach) et **sa confiance III** (sur ce club rebâti, contre le même sans lui). La voie, c'est les deux.

La ligue sans systèmes, recalée : 3,03 buts et 27,7 tirs par club et par match, contre 3,15 et 28,5 avec (−4 % de buts : la comparaison en victoires tient, `borne`). Douze ligues de 32 clubs font 384 paires par bras : l'erreur d'une voie est d'environ ±0,4 V, celle d'un écart entre les deux mondes d'environ ±0,6 V ; sous 1,2 V, un écart est du bruit.

## 3. Ce que chaque coach perd

La voie, c'est le club rebâti à la couleur du coach, avec sa confiance III, contre le même club tel quel. Ses vraies stats sont par match, contre le club tel quel.

| Coach | La voie avec | sans | Écart | Ses joueurs | Sa III | La voie sans, en stats |
|---|---|---|---|---|---|---|
| 🐝 Le Frelon | +19,6 V | +17,1 V | **−2,5** | +12,1 → +10,0 | +7,5 → +7,1 | +9,5 tirs (13,0 avec) · +2,0 pt au tir · +1,7 tir contre |
| 😇 L'Abbé | +6,3 | +5,4 | −0,9 | +0,1 → −1,0 | +6,2 → +6,4 | +2,5 tirs · +1,1 pt au tir · −2,5 tirs contre |
| 🦅 L'Aigle | +10,6 | +10,9 | +0,2 | +3,9 → +4,4 | +6,8 → +6,5 | +2,1 tirs (4,1 avec) · +3,7 pt au tir (3,0 avec) |
| 🫁 Le Doc | −1,6 | −1,6 | 0 | −9,7 → −8,9 | +8,1 → +7,3 | +11,1 tirs · −2,7 pt au tir |
| 🌠 Le Showman | +2,4 | +2,6 | +0,2 | −4,1 → −4,0 | +6,5 → +6,6 | +0,8 tir · +1,2 pt au tir · −1,5 tir contre |
| 🪜 Le Contremaître | −1,4 | −0,7 | +0,7 | −8,5 → −7,9 | +7,1 → +7,2 | +2,4 tirs contre · +2,3 pt d'arrêts |
| 🦏 Le Rhino | +1,8 | +3,0 | +1,2 | −6,5 → −6,4 | +8,3 → **+9,4** | −5,1 tirs · +1,3 pt au tir · +3,3 pt d'arrêts |
| 🐢 La Tortue | +10,8 | +12,6 | **+1,8** | +3,8 → +4,0 | +7,0 → **+8,6** | −4,9 tirs · −3,5 tirs contre · +4,5 pt d'arrêts |

**Ce que la mesure dit.**

1. **Les systèmes ne font pas les coachs.** Sans eux, six voies sur huit bougent de moins de 1,2 V, dans le bruit. Ce qu'un coach vaut, c'est sa confiance (+6 à +9 V partout) et le prix de ses rôles (« ses joueurs », de −10 à +12 V à salaire égal, déjà dit par `check_voies` : une affaire de salaires, pas de systèmes).
2. **Un seul perd vraiment : le Frelon**, −2,5 V, tout dans ses joueurs : 🛫 Activer les défenseurs (+19 % de tirs pour la paire) et 🧲 l'enclave. Il perd 3,5 tirs par match… et reste, de loin, la voie la plus forte (+17 V).
3. **Deux gagnent : la Tortue (+1,8 V) et le Rhino (+1,2 V)**, par leur confiance : sans les actions spéciales et l'étouffé, fermer la porte et cogner pèsent plus. Leur III passe à 8,6 et 9,4 V, au-dessus de la bande de `check_voies` (6 à 8 V) : leurs paliers se recalent d'un cran.
4. **Le passeur et le manieur ne valaient presque rien en victoires par la chimie** : le Showman ne perd rien (+0,2), l'Abbé perd 0,9 V. Les actions spéciales déplacent les buts vers les lignes bien bâties sans en créer (`SPEC_NORME`) ; ce que la chimie rendait aux passeurs était surtout de la forme. Mais sans système, leur badge ne fait plus rien sur la glace, et c'est ce qui doit changer.
5. **Les voies se resserrent un peu** : du plus fort au plus faible, 10,6 V sur deux avec, 9,4 V sans.

## 4. Ce que chacun devient

Sans système, un coach est ce qu'il était déjà : sa philosophie (sa confiance, ses canaux, son prix) et les joueurs de sa couleur, qui jouent leurs badges eux-mêmes. Aucun n'a besoin d'un système de remplacement. Ce qui se règle :

- 🐝 **Le Frelon** : « tirer de partout » par ses joueurs, devant le filet (le power forward) et de la pointe (le défenseur offensif). Il perd l'élan que lui donnait 🛫, et c'est bien : il était déjà trop fort. Rien à faire.
- 🦅 **L'Aigle** : moins de tirs, plus de précision ; il devient plus lui-même (« Chaque lancer doit rentrer »). Rien à faire.
- 🐢 **La Tortue** et 🦏 **le Rhino** : leur III recalée pour revenir dans la bande (la défense de la III de la Tortue, ×0,897, vers ×0,91 ; la robustesse du Rhino, +1,3, vers +1,1 ; à mesurer par `check_voies`).
- 😇 **L'Abbé** et 🌠 **le Showman** : leurs joueurs gardent leurs points, mais leur badge doit faire quelque chose sur la glace. Proposition, sans mécanique neuve : **la chimie revient aux joueurs**. Une ligne a de la chimie sans système, de ses passeurs et de ses manieurs (`chimieDesBadges`, un fit de base égal à celui d'aujourd'hui) ; l'action spéciale reste, l'étouffé part avec le cycle des systèmes. Et le ☯ two-way d'une paire étouffe comme celui d'un trio (`EFFET_ROLE.deuxsens`). {{VARIANTE}}
- 🫁 **Le Doc**, 🪜 **le Contremaître** : rien ne bouge.
- 🏦 **Le Comptable** : rien ne le touche.

**Leur plan de match.** Les plans de la V17 (`PLANS`) ont pris la place que les systèmes prenaient dans la tête du joueur : 🌧 Tirer de partout, ⛔ Fermer le centre, 🐗 Forechecker fort, 🧘 Rester discipliné, 🥷 Coller leur vedette. Cinq coachs s'y reconnaissent (le Frelon, la Tortue, le Rhino, l'Abbé, le Contremaître). Rien ne les lie aujourd'hui, et rien ne l'exige : c'est une idée pour plus tard, pas une condition pour jeter les systèmes.

## 5. Ce qui part avec eux

- Le moteur (js/sim.js) : `TACTIQUES`, `SYSTEMES_D`, le fit des systèmes (`fitUnite`, `fitDeCase`, `rangSystemes`, `meilleureTactique`, `meilleurStyle`, `styleOuvert`, `badgesManquants`, `effetsDeSysteme`), le cycle (`bat`, `contreDe`, `CONTRE_SYSTEME`, l'étouffé), la part des systèmes dans `lignesAuMieux` et `trioAuMieux`, la lecture neutre `systemes`. La chimie et l'action spéciale restent si la proposition du § 4 est prise.
- Les écrans : la fenêtre du système d'une ligne et le pied « Système · Régler » (js/gerant.js, js/alignement.js), les conseils de système du dépistage (js/pronostic.js), « Leur trappe est déjà étouffée », la ligne « Systèmes » du sommaire et de Lignes › Équipe (js/impact.js, js/bilan.js), la cause « le système et la chimie » (js/causes.js).
- Les juges : `check_styles`, `check_tactiques` ; `check_chimie` et `check_au_mieux` maigrissent.
- La règle ferme de la V15 (« les badges d'une unité ouvrent ses styles »), et le mot « style » du vocabulaire.

## 6. Ce que JP tranche

1. **Jeter les systèmes partout, ou seulement en Rogue.** La mesure est en Rogue. Partout, le 82-0 se recale (la ligue à −4 % de buts, `check_ratings`, `check_feuilles`, `check_parts`) et le code part pour de bon ; en Rogue seulement, le 82-0 garde ses systèmes automatiques et le code reste. Recommandé : partout, pour une seule lecture du moteur.
2. **La chimie aux joueurs** (§ 4) : oui, ou le passeur et le manieur cherchent un autre canal.
3. **La Tortue et le Rhino recalés** dans la bande de `check_voies`.
