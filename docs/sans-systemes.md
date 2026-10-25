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
