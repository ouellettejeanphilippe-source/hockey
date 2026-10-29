# V21 — Le coach, un personnage

JP, 29 oct. 2026, sur la V20 : *You didn't really redo the system, c'est le même hiring, même ui, presque mêmes cartes, on s'en fout de briser les saves, le système actuel marche pas.* Puis, au choix de trois directions : **le coach-personnage à la Hades** ; le staff **un parmi trois, gratuit, aux moments forts** ; les événements **à conséquences concrètes**.

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
| 🦏 Le Rhino | **L'usure** : en 3e, plus de mises en échec et leur précision −10 % | **Le choc** : en 1re, à domicile, plus de mises en échec et leur précision −10 % | **La charge** : derrière, +25 % de tirs et leur précision −12 % |
| 🫁 Le Doc | **Le second souffle** : en 3e, un soir de dos-à-dos ou de jambes lourdes, +20 % de tirs et −20 % de buts contre | **La rotation** : toute la soirée, −40 % de blessures | **La résurrection** : derrière en 3e, +40 % de tirs et +25 % de précision |
| 😇 L'Abbé | **Le sang-froid** : en 2e, −45 % de punitions | **La provocation** : en 3e, leurs punitions +90 % | **Le miracle** : en 3e, à un but d'écart ou moins, +30 % de précision et −50 % de punitions |
| 🪜 Le Contremaître | **Les quatre trios** : en 3e, à un but d'écart ou moins, les quatre trios jouent autant et −25 % de buts contre | **L'atelier** : un soir de dos-à-dos, +12 % de tirs et −8 % de buts contre | **La relève** : derrière, les quatre trios égaux, +30 % de tirs et +10 % de précision |
| 🌠 Le Showman | **Le spectacle** : en 3e, à égalité ou derrière d'un but, le 1er trio joue 40 % plus, +32 % de précision | **Le duo vedette** : en 1re, à domicile, le 1er trio joue 30 % plus, +35 % de précision | **Le grand soir** : en séries ou en gros match, +25 % de précision toute la soirée |

**La calibration** (`check_pouvoirs`, en paires contre un coach muet joué lui aussi en trois périodes). Le premier jet faisait jouer plusieurs pouvoirs tous les soirs (« en 3e », « en 1re ») : un pouvoir qui joue chaque soir ne peut pas être à la fois visible (≈ 0,3 but le soir où il joue) et sous sa borne (≈ 0,3 × 82 / 6 ≈ 4 victoires). Chaque pouvoir joue maintenant à peu près un soir sur deux — une condition de pointage, de lieu ou de soirée — et fort quand il joue ; seuls l'usure du Rhino (des mises en échec), la provocation de l'Abbé (leurs punitions) et la rotation du Doc (les blessures, toute la soirée) jouent tous les soirs, sur des canaux qui se voient sans peser autant.

Deux trous du moteur se sont montrés en mesurant : la précision d'une équipe est plafonnée (`FINITION_MAX`), et un bon club y est déjà — les pouvoirs de l'Aigle n'y faisaient presque rien. La précision d'un pouvoir passe maintenant par-dessus le plafond, comme la chimie, le temps de sa période (`cartes.pouvoir`, js/sim.js). Et les blessures se tirent après le match, quand les effets de période sont retirés : la part de blessure des pouvoirs de la soirée est portée jusqu'au tirage (`_blessureDuSoir`).

Une soirée en trois plages n'a pas le même tirage qu'une soirée d'un bloc (les punitions et les lancers se répartissent au prorata), d'où le coach muet comme témoin ; sur 8 000 matchs, elle donne ≈ +0,9 tir et +0,13 but par match aux deux clubs ensemble, le même biais que le duel depuis la V9.

## 2. Les adjoints, des bienfaits

Un adjoint ne vient plus seul : il **modifie un pouvoir** de ton coach. Cinq sortes (`BIENFAITS`) :

- ⏪ **Plus tôt** : le pouvoir joue aussi plus tôt (une période avant, ou dès que sa condition se lit) ;
- 💪 **Plus fort** : l'effet grandit de moitié ;
- 🪙 **Payant** : chaque but marqué pendant le pouvoir rapporte 2 jetons (un pouvoir de défense : chaque période sans but contre, 3) ;
- 🏆 **Des séries** : en séries, l'effet double ;
- 🔁 **Contagieux** : quand ce pouvoir joue, un autre de tes pouvoirs débloqués joue aussi à moitié.

**Les obtenir : un parmi trois, gratuit, aux moments forts** — les paliers des 9e, 18e et 26e matchs, un gros match gagné, le verdict du proprio. Les trois se tirent de la graine parmi les bienfaits pas encore pris de tes pouvoirs débloqués. Un pouvoir porte au plus deux bienfaits ; quand il n'y a plus rien à offrir, le moment fort paie cinq points d'expérience. Rien ne s'achète, rien ne se paie.

## 3. Les histoires : des conséquences concrètes

Un lundi sur deux environ, une histoire (`DOSSIERS`), qui ne joue plus sur des pourcentages de quelques soirs. Ses réponses **donnent ou enlèvent de vraies choses** :

- de l'expérience au coach (« ton coach apprend » : +3 XP) ou en moins ;
- des jetons, gagnés ou payés ;
- un bienfait tout de suite (un parmi trois), ou un bienfait perdu ;
- un joueur : un dépanneur du ballottage qui arrive, un blessé qui revient plus tôt, un joueur suspendu des matchs.

## 4. L'écran

Le sous-onglet **Coach** : le portrait du coach, son niveau et la barre d'expérience, puis ses trois pouvoirs en cartes (débloqué ou verrouillé, le niveau qui l'ouvre, ses bienfaits accrochés dessous, combien de fois il a joué cette saison). À faire : un talent à choisir, un bienfait à prendre. Hier soir dit les pouvoirs qui ont joué.

## 5. Les tranches

| Tranche | Ce qu'elle fait |
|---|---|
| 1 | js/pouvoirs.js ; le moteur joue les pouvoirs période par période (soirée normale et duel), la feuille les garde ; les jetons des bienfaits payants |
| 2 | l'écran du coach, le talent et le bienfait dans À faire ; le personnel, les échelons, la confiance, le chiffre, les ententes et le pack Personnel partent, avec leurs vérifications |
| 3 | les histoires à conséquences concrètes |
| 4 | les robots (`rogue_sim`) choisissent talents et bienfaits ; `check_pouvoirs`, `check_profondeur`, `essai_rogue` ; la page des règles et CLAUDE.md |
