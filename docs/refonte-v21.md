# V21 — Le coach, un personnage

JP, 29 oct. 2026, sur la V20 : *You didn't really redo the system, c'est le même hiring, même ui, presque mêmes cartes, on s'en fout de briser les saves, le système actuel marche pas.* Puis, au choix de trois directions : **le coach-personnage à la Hades** ; le staff **un parmi trois, gratuit, aux moments forts** (puis, précisé : des systèmes de jeu, des échanges) ; les événements **à conséquences concrètes**.

On repart de zéro. Une vieille partie peut casser (JP).

## Ce qui part

Tout le personnel de la V10 à la V20 : les adjoints à force et défaut, leurs cinq postes, les échelons achetés, les doublons qui en paient, la couleur qui vaut un échelon, les protégés, le feu, les combos, les ententes du proprio, le pack Personnel, le banc ouvert et son prix d'embauche. La confiance I-II-III, ses blocs de dix matchs et le chiffre à tenir. Les paliers « un adjoint parmi trois ». Les réponses à « +1,4 pt de précision pendant 4 soirs ».

## 1. Le coach, ton personnage

Choisi au départ de la run (le prestige en ouvre plus), il la fait au complet, comme le héros d'un roguelike. Il a :

- **un niveau**, de 1 à 5, gagné en jouant : chaque victoire vaut un point d'expérience, un gros match gagné deux de plus, une série gagnée cinq (`XP`, `SEUILS_NIVEAU`, js/pouvoirs.js). L'expérience suit la run d'une saison à l'autre ;
- **trois pouvoirs**, son arbre : le premier au niveau 1, le deuxième au niveau 3, l'ultime au niveau 5 ;
- **deux talents** : aux niveaux 2 et 4, tu choisis lequel de tes pouvoirs grandit (+50 %).

**Un pouvoir se déclenche en match, période par période, et se voit.** Il lit ce qui est déjà joué (la période, le pointage, les tirs) et frappe la période qui vient, sur les canaux que le moteur connaît (tirs, précision, buts contre, punitions, mises en échec, glace des trios). La feuille le garde : « 🐝 La ruée · 3e période · 14 tirs ». Une soirée normale se joue alors en trois périodes, comme le duel.

| Coach | I (niveau 1) | II (niveau 3) | Ultime (niveau 5) |
|---|---|---|---|
| 🐝 Le Frelon | **La ruée** : en 3e, à égalité ou derrière, +40 % de tirs | **Le bourdonnement** : en 3e, avec plus de tirs qu'eux jusque-là, +25 % de tirs | **L'essaim** : derrière au pointage, +35 % de tirs et +5 % de précision |
| 🦅 L'Aigle | **La riposte** : après une période perdue aux tirs, sans mener, +28 % de précision | **Le tueur** : quand tu mènes, +17 % de précision | **Le tir parfait** : en 3e, à un but d'écart ou moins, +45 % de précision |
| 🐢 La Tortue | **Le verrou** : quand tu mènes, −25 % de buts contre | **La tranchée** : en 1re, à l'étranger, −25 % de leurs tirs | **La forteresse** : en 3e, en avant ou à égalité, −30 % de buts contre et −20 % de leurs tirs |
| 🦏 Le Rhino | **L'usure** : en 3e, plus de mises en échec et leur précision −10 % | **Le choc** : en 1re, à domicile, plus de mises en échec et leur précision −12 % | **La charge** : derrière, +25 % de tirs et leur précision −12 % |
| 🫁 Le Doc | **Le second souffle** : en 3e, un soir de dos-à-dos ou de jambes lourdes, +20 % de tirs et −26 % de buts contre | **La rotation** : toute la soirée, −40 % de blessures | **La résurrection** : derrière en 3e, +40 % de tirs et +25 % de précision |
| 😇 L'Abbé | **Le sang-froid** : en 2e, −45 % de punitions | **La provocation** : en 3e, leurs punitions +45 % | **Le miracle** : en 3e, à un but d'écart ou moins, +30 % de précision et −50 % de punitions |
| 🪜 Le Contremaître | **Les quatre trios** : en 3e, à un but d'écart ou moins, les quatre trios jouent autant et −25 % de buts contre | **L'atelier** : un soir de dos-à-dos, +12 % de tirs et −8 % de buts contre | **La relève** : derrière, les quatre trios égaux, +30 % de tirs et +10 % de précision |
| 🌠 Le Showman | **Le spectacle** : en 3e, à égalité ou derrière d'un but, le 1er trio joue 40 % plus, +32 % de précision | **Le duo vedette** : en 1re, à domicile, le 1er trio joue 30 % plus, +35 % de précision | **Le grand soir** : en séries ou en gros match, +25 % de précision toute la soirée |

**La calibration** (`check_pouvoirs`, en paires contre un coach muet joué lui aussi en trois périodes). Le premier jet faisait jouer plusieurs pouvoirs tous les soirs (« en 3e », « en 1re ») : un pouvoir qui joue chaque soir ne peut pas être à la fois visible (≈ 0,3 but le soir où il joue) et sous sa borne (≈ 0,3 × 82 / 6 ≈ 4 victoires). Chaque pouvoir joue maintenant à peu près un soir sur deux — une condition de pointage, de lieu ou de soirée — et fort quand il joue ; seuls l'usure du Rhino (des mises en échec), la provocation de l'Abbé (leurs punitions) et la rotation du Doc (les blessures, toute la soirée) jouent tous les soirs, sur des canaux qui se voient sans peser autant.

**Les jambes.** Le personnel gardait les jambes (le masseur, le nutritionniste, à −19 % d'usure) ; parti, le patineur le plus fatigué d'une saison de run descend plus bas, et « les jambes lourdes » tombaient 62 soirs sur 82 (`check_moments_si` : un moment courant ne passe pas les trois quarts). Leurs seuils suivent, toujours les quartiles du bas et du haut : 89 et 92 → 78 et 88 (`MOMENTS_SI`, 16 et 23 soirs par saison).

Deux trous du moteur se sont montrés en mesurant : la précision d'une équipe est plafonnée (`FINITION_MAX`), et un bon club y est déjà — les pouvoirs de l'Aigle n'y faisaient presque rien. La précision d'un pouvoir passe maintenant par-dessus le plafond, comme la chimie, le temps de sa période (`cartes.pouvoir`, js/sim.js). Et les blessures se tirent après le match, quand les effets de période sont retirés : la part de blessure des pouvoirs de la soirée est portée jusqu'au tirage (`_blessureDuSoir`).

Une soirée en trois plages n'a pas le même tirage qu'une soirée d'un bloc (les punitions et les lancers se répartissent au prorata), d'où le coach muet comme témoin ; sur 8 000 matchs, elle donne ≈ +0,9 tir et +0,13 but par match aux deux clubs ensemble, le même biais que le duel depuis la V9.

## 1b. Ton entraîneur, une vraie carte

JP : *I want the coaches and assistants to be like the team alignment, mais avec des coachs, je serais même ouvert à des cartes de vrais coachs par saison*. Puis, au choix : un **staff en alignement** — la case de l'entraîneur, et trois places d'adjoint libres (n'importe quel adjoint va n'importe où) — et **l'entraîneur, une vraie carte de coach-saison** ; les adjoints restent des échanges inventés.

- **Les données** (`scripts/coachs.mjs` → `data/coachs.json`) : l'API publique des records de la LNH (`coach-franchise-season-records`, une ligne par coach, par club, par saison). Un club qui a changé de coach en cours de saison garde celui qui a dirigé le plus de matchs : 1392 coachs-saisons sur nos 55 saisons, chaque club relié.
- **Sa philosophie** se lit dans les vraies stats de son club cette saison-là, prises des shards : tirs pour (le Frelon), tirs contre (la Tortue), % de tir (l'Aigle), minutes de pénalité (le Rhino) ou leur absence (l'Abbé), santé du vestiaire (le Doc), points hors du top 6 (le Contremaître), poids des deux vedettes (le Showman) ; la lecture la plus marquée par rapport aux autres clubs décide. Scotty Bowman 1976-77 est l'Aigle (1er au % de tir), Paul Maurice 2023-24 le Rhino.
- **Sa maîtrise** : premier ou deuxième de la ligue dans sa lecture, ses pouvoirs jouent ×1,2 ; dans les cinq premiers, ×1,1 (`MAITRISE`, js/coachs-reels.js).
- **Le loto** : au départ de la run, trois vraies cartes, de trois philosophies que le prestige ouvre, tirées de la graine ; tu en prends une, qui fait la run. Sa carte dit son club, sa saison, sa fiche, sa Coupe et son Jack Adams.
- **Le cartable** (JP : *c'est comme les cartes de joueurs*) : l'entraîneur pris entre à ton cartable et y compte ses runs ; l'album a son onglet « Coachs ». Le loto tire d'abord là, comme le classeur : les moins joués d'abord, deux au plus (`DU_CARTABLE`), plus une carte neuve chaque fois — un cartable plein ne ferme jamais la découverte (`coachAuCartable`, js/cartable.js ; `lotoDesCoachs`).
- Le vocabulaire ne bouge pas : **l'entraîneur** est la personne (la carte), **le coach** sa philosophie ; jamais « entraîneur-chef » (`check_lexique`).

## 2. Les adjoints, des systèmes de jeu

JP, sur le premier jet (des bienfaits qui modifiaient un pouvoir, à la Hades) : *les assistants sont des ajustements, des systèmes de jeu* ; *genre deux tirs de plus, mais en alloue deux de plus, ou tu buffs légèrement le gardien numéro un mais un nerf le numéro deux ou l'inverse*.

Un adjoint est donc un **échange** (js/adjoints.js) : ce que ton club gagne et ce qu'il donne, sur les canaux que le moteur connaît, tous les matchs. Il change la forme du match, pas sa force : sur un club ordinaire, le net est près de zéro ; sur le tien, il paie si l'échange lui va. À l'écran, on dit « un ajustement, un échange » (le mot « système » est parti avec les systèmes de ligne, V18).

| Adjoint | Ce qu'il donne | Ce qu'il coûte |
|---|---|---|
| 🏹 Le canonnier | tes tirs +8 % | leurs tirs +10 % |
| 🚧 Le trappeur | leurs tirs −8 % | tes tirs −8 % |
| 📐 Le tireur d'élite | ta précision +13 % | tes tirs −10 % |
| 💨 Le mitrailleur | tes tirs +13 % | ta précision −9 % |
| 🧱 Le bâtisseur de mur | buts contre −8 % | ta précision −8 % |
| 🧤 L'entraîneur du n° 1 | ton gardien n° 1 : buts accordés −10 % | ton n° 2 : +30 % |
| 🧊 L'entraîneur du n° 2 | ton gardien n° 2 : buts accordés −12 % | ton n° 1 : +4 % |
| 🏋 Le préparateur physique | plus de mises en échec | tes punitions +25 % |
| 🧭 Le prof de discipline | tes punitions −25 % | moins de mises en échec |
| 🧲 Le rouleur | tes 3e et 4e trios jouent plus, leurs tirs −10 % | ton 1er trio joue moins |
| 📊 Le vedettiste | ton 1er trio joue plus | le bas joue moins, leurs tirs +8 % |
| 🧪 Le soigneur | tes blessures −30 % | tes tirs −2 % |

Le n° 1 part environ trois soirs sur quatre : un échange de gardiens s'équilibre à trois contre un.

**Les obtenir : un parmi trois, gratuit, aux moments forts** — les paliers des 9e, 18e et 26e matchs, un gros match gagné, le verdict du proprio, et certaines histoires. Les trois se tirent de la graine parmi ceux qui ne sont pas en poste. Ton staff tient **trois adjoints** ; un quatrième, et tu choisis qui part (À faire, « Qui part ? »). Rien ne s'achète. *Oct. : la main d'adjoints remplace « Qui part ? » — tous dans ta main (six au plus), trois en poste, glissés au Bureau › Coach (`staff`, js/deposer.js) ; un arrivant prend une case libre, sinon il attend ; une main pleine laisse partir le plus ancien hors du staff (docs/decisions.md).*

## 2b. Légers d'abord, le bras droit (oct.)

JP, sur la V21 jouée : *tu devrais commencer avec des adjoints avec peu d'impact* ; puis *je suis pas contre que le coach ait un gros impact sur la performance du club, tant que c'est lié à un impact logique de synergie et non car le chiffre est gros, au même titre qu'un champion de LoL avec les bons items est plus fort sans que ça soit débalancé*.

- **Légers d'abord.** Mesurés seuls (`check_pouvoirs`, quatre clubs témoins), six adjoints valent à peu près la même chose partout (entre −2 et +2 victoires d'un club à l'autre : 🚧 📐 💨 🧤 🧊 🧪) ; six autres pèsent bien plus selon le club (de −4 à +7 : 🏹 🧱 🏋 🧭 🧲 📊). Ceux-là sont **lourds** (`lourd`). Sous le niveau 3 du coach (`NIVEAU_DES_LOURDS`), l'offre n'a que des légers ; les lourds arrivent avec son deuxième pouvoir.
- **Le bras droit.** Chaque coach a un adjoint de sa voie (`voie`, `brasDroitDe`) : 🐝 le canonnier, 🦅 le tireur d'élite, 🐢 le bâtisseur de mur, 🦏 le préparateur physique, 🫁 le soigneur, 😇 le prof de discipline, 🪜 le rouleur, 🌠 le vedettiste. En poste, il fait grandir les trois pouvoirs du coach de moitié (`BRAS_DROIT`, dans `forceDuPouvoir`, avec les talents et la maîtrise), et son échange va dans le sens de ces pouvoirs. Il n'arrive qu'au niveau 3, avec les lourds. Sur un autre coach, il reste un échange comme les autres. L'offre le dit d'abord (« Bras droit du Frelon : ses pouvoirs +50 % »).
- **Les plafonds.** La mesure a montré pourquoi le Frelon valait si peu (+3,8 V au complet, contre +9 pour l'Aigle) : la pression d'un bon club est déjà près de `PRESSION_MAX`, et « la ruée, +40 % de tirs » se jouait écrêtée. Comme la précision depuis la V21, le volume et la discipline d'un pouvoir passent maintenant les plafonds du jeu, le temps de sa période (`pouvoirVolume`, `pouvoirDiscipline`, js/sim.js) : ce que la carte du pouvoir dit, le moteur le joue. La provocation de l'Abbé, qui jouait ses « +90 % » écrêtés autour de +40 %, est ramenée à +45 % (seule, elle passait à +4,8 V, sa borne est 2,5).

**Mesuré** (`check_pouvoirs`, 600 matchs par club). Chaque pouvoir seul reste sous sa borne et se voit. Le personnage complet (niveau 5, deux talents) : 🐝 +7,9 · 🐢 +5,5 · 🫁 +4,8 · 🪜 +5,3 · 🦅 +9,1 · 🦏 +8,2 · 😇 +8,4 · 🌠 +7,5 victoires sur une saison ; avec son bras droit, son échange compris : 🐝🏹 +14,3 · 🐢🧱 +7,7 · 🫁🧪 +7,4 · 🪜🧲 +8,5 · 🦅📐 +11,6 · 🦏🏋 +11,3 · 😇🧭 +10,1 · 🌠📊 +10,7, sous la borne de 16. Sur la courbe des runs (`check_rogue`, 20 runs par niveau, 4 campagnes, avant → après) : sans déblocage, la Coupe reste à 0 % ; tout débloqué, la Coupe par run passe de 60 à 75 % et dès la première saison de 10 à 40 % ; la première Coupe d'une campagne vient à la run 5 en médiane (5,5 avant). La première run reste dure ; le coach bâti pèse au bout de la progression. Le premier essai donnait au Frelon le mitrailleur : son prix (−9 % de précision) mangeait le gain (+0,6 V) ; le canonnier ouvre le jeu des deux côtés, et c'est le Frelon qui en profite.

## 3. Les histoires : des conséquences concrètes

Un lundi sur deux environ, une histoire (`DOSSIERS`), qui ne joue plus sur des pourcentages de quelques soirs. Ses réponses **donnent ou enlèvent de vraies choses** :

- de l'expérience au coach (« ton coach apprend » : +3 XP) ou en moins ;
- des jetons, gagnés ou payés ;
- un adjoint pour ton staff, ou le dernier entré qui part ;
- un joueur : un dépanneur du ballottage qui arrive, un blessé qui revient plus tôt, un joueur suspendu des matchs.

## 4. L'écran

Le sous-onglet **Coach** : le portrait du coach, son niveau et la barre d'expérience, ses trois pouvoirs en cartes (débloqué ou verrouillé, le niveau qui l'ouvre, combien de fois il a joué cette saison), puis son staff, chaque adjoint et son échange. À faire : un talent à choisir, un adjoint à prendre, qui part. Hier soir dit les pouvoirs qui ont joué.

## 5. Les tranches

| Tranche | Ce qu'elle fait |
|---|---|
| 1 | js/pouvoirs.js ; le moteur joue les pouvoirs période par période (soirée normale et duel), la feuille les garde |
| 2 | l'écran du coach, le talent et l'adjoint dans À faire ; le personnel, les échelons, la confiance, le chiffre, les ententes et le pack Personnel partent, avec leurs vérifications |
| 3 | les histoires à conséquences concrètes |
| 4b | les adjoints deviennent des systèmes de jeu, des échanges (js/adjoints.js) ; les bienfaits partent |
| 4c | l'entraîneur, une vraie carte de coach-saison (js/coachs-reels.js, data/coachs.json) ; le staff en alignement |
| 4 | les robots (`rogue_sim`) choisissent talents et adjoints ; `check_pouvoirs`, `check_profondeur`, `essai_rogue` ; la page des règles et CLAUDE.md |
