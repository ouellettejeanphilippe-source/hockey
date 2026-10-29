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
| 🐝 Le Frelon | **La ruée** : en 3e, +30 % de tirs | **Le bourdonnement** : après une période gagnée aux tirs, +15 % de tirs | **L'essaim** : derrière au pointage, +35 % de tirs et +5 % de précision |
| 🦅 L'Aigle | **La riposte** : après une période perdue aux tirs, +25 % de précision | **Le tueur** : quand tu mènes, +20 % de précision | **Le tir parfait** : en 3e, +35 % de précision |
| 🐢 La Tortue | **Le verrou** : quand tu mènes, −25 % de buts contre | **La tranchée** : en 1re, −20 % de leurs tirs | **La forteresse** : en 3e, −30 % de buts contre et −20 % de leurs tirs |
| 🦏 Le Rhino | **L'usure** : en 2e et 3e, +1,5 mise en échec par période et leur précision −8 % | **Le choc** : en 1re, leur précision −12 % | **La charge** : derrière, +20 % de tirs et leur précision −10 % |
| 🫁 Le Doc | **Le second souffle** : en 3e, +15 % de tirs et −10 % de buts contre | **La rotation** : toute la soirée, −40 % de blessures | **La résurrection** : derrière après deux, +30 % de tirs et +10 % de précision |
| 😇 L'Abbé | **Le sang-froid** : en 1re et 2e, −40 % de punitions | **La provocation** : en 3e, leurs punitions +40 % | **Le miracle** : à égalité en 3e, +20 % de précision et −50 % de punitions |
| 🪜 Le Contremaître | **Les quatre trios** : en 3e, tes 3e et 4e trios jouent autant que les deux premiers, et −10 % de buts contre | **L'atelier** : un soir de dos-à-dos, +12 % de tirs | **La relève** : derrière, les quatre trios égaux et +20 % de tirs |
| 🌠 Le Showman | **Le spectacle** : à égalité ou derrière en 3e, le 1er trio joue 40 % plus, +15 % de précision | **Le duo vedette** : en 1re, le 1er trio joue 25 % plus, +10 % de précision | **Le grand soir** : en séries ou en gros match, +20 % de précision toute la soirée |

Les chiffres sont des points de départ : `check_pouvoirs` les juge (chaque pouvoir se voit dans la feuille d'un soir où il joue, ne joue jamais hors de ses soirs, et rejoue pareil).

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
