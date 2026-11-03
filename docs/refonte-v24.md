# V24 — Le banc qui s'active : un adjoint entre quand ton club joue son hockey

Deuxième version du devis (3 nov. 2026). La première (25 adjoints, des moments du calendrier, le séjour et le repos par-dessus) a été jugée « À refaire » par `/revue-design` : `rogue-design`, `rogue-equilibre` et `rogue-ux` en adversaires, avec des mesures sur 800 matchs. Cette version part de leurs trouvailles et des quatre choix de JP.

## 1. Ce que JP a dit

- *j'aime le concept qu'un coach ou assistant s'active en réussissant à atteindre x tirs ou autre trucs, ça fait que je dois adapter mon alignement en fonction du coach, ce qui est réaliste et logique.*
- *it has to make sense. Par exemple, l'effet de l'arbitre est d'avoir moins de pénalités, donc ça peut pas être la condition qui l'active dans le match.*
- *the coachs and adjoints devraient être comme ça et il devrait avoir une grande variété pour permettre plein de build qui synergisent ou non, etc.*
- *it should be harsh, we want the best, and I'm willing that we change a lot of things to make it really right.*
- Ses choix, après la revue :
  - **une horloge** : le séjour et le repos partent ;
  - **les quatre familles de conditions** : le rythme, l'alignement, le pointage, le calendrier ;
  - **16 adjoints**, en familles ;
  - **au duel et en séries, la condition joue**, en plus du plan proposé à l'entracte.

## 2. Ce que le joueur ressent

« Je bâtis mon banc comme mon alignement, et mon alignement pour mon banc. » Un adjoint n'est plus un bonus de tous les soirs. Il entre quand ton club fait ce qu'il attend : trois défenseurs offensifs habillés, une période à huit mises en échec, une égalité après la première.

- **Le jour ordinaire.** Au matin, Ce soir te dit qui est sûr d'entrer (l'alignement, le calendrier) et qui entrera « si ça tourne » (le rythme, le pointage).
- **Aux Lignes.** Tu bouges un défenseur pour atteindre le seuil du mur.
- **Le pic.** Le soir où trois adjoints entrent l'un après l'autre en direct, parce que ton club joue exactement le hockey pour lequel tu l'as bâti.

## 3. Les règles du jeu

### Le principe

- **Une condition, lue sur ce qui est déjà joué ou déjà connu au matin**, comme un pouvoir du coach (`pouvoirsDeLaPeriode`, js/pouvoirs.js). Il y en a quatre familles :
  - **🔵 Le rythme** : ce que ton club a fait dans la période d'avant (ses mises en échec, ses tirs, les punitions des deux clubs). C'est le « atteindre x » de JP.
  - **🟢 L'alignement** : ce que tes habillés du soir portent (leurs badges, leur niveau, les recrues). C'est le « adapter mon alignement ».
  - **🟠 Le pointage** : où en est le match. La famille la plus petite, pour qu'un club fort ne fasse pas boule de neige.
  - **⚪ Le calendrier** : ce que le soir est (le lieu, le classement de l'adversaire, après une défaite).
- **Jamais son propre effet.** Une condition ne lit aucun canal que son adjoint bouge, ni dans ce qu'il donne ni dans ce qu'il coûte. Le moine baisse tes punitions : il entre sur celles de l'autre club, pas sur les tiennes. Ainsi aucune condition ne s'éteint ni ne s'entretient d'elle-même. `check_pouvoirs` le prouve : la liste des canaux de l'effet, comparée à la lecture de la condition.
- **Il joue la période qui vient**, quand sa condition se lit avant elle. Une condition du matin (l'alignement, le calendrier) le fait jouer les trois périodes. Une condition du rythme ne se lit qu'après une période : elle joue en 2e et en 3e. Hors de sa condition, il ne fait rien, et son salaire court quand même.
- **Il ne double jamais un pouvoir de son coach** : pas la même condition sur le même canal. Le mur n'entre pas « quand tu mènes » : c'est le verrou de la Tortue. Ainsi la synergie paie en largeur (plus de soirs couverts), jamais en force sur le même soir.

### Une horloge

- **Le séjour (12, 16) et le repos (20) partent.** Une carte posée reste en poste tant que tu la gardes. Sa condition dit quand elle joue.
- **Changer d'adjoint est la décision.** La carte retirée revient dans la main et se repose `REPOS_RETIRE` matchs (10) avant d'être reposée. Sinon tu changerais de banc à chaque adversaire, et ce serait l'échange permanent que la V22 a chassé.
- **La synergie.** Un adjoint qui rejoint ton coach (`voie`) joue sans salaire de style : il ne paie que celui de son niveau. Elle se paie en argent, jamais en force. Elle remplace le séjour allongé, parti avec le séjour.

### Où ça se lit

| L'écran | Ce qu'on y lit |
|---|---|
| **La carte, au recto** | la condition courte (`quandCourt`, trois mots au plus : « 3 🚀 habillés », « Après 8 MÉ », « Égalité en 2e ») sur un filet de la couleur de sa famille. Le verso garde la phrase entière et les vraies stats de la période. Plus de texte de 7 px. |
| **Ce soir** (le matin) | une ligne du banc : les sûrs (« 🧱 Le mur entre : 3 🛑 habillés »), puis les « si ça tourne » (« 🏋 Le cogneur, si ils te dominent aux tirs »). Une fonction pure, `quiEntreraCeSoir`, partagée avec le moteur. |
| **Les Lignes** | un compteur par adjoint d'alignement, à jour à chaque geste (« 🧱 2 sur 3 🛑 »). |
| **Le direct** | à l'entracte, la ligne « 🧱 Le mur entre » pour chaque adjoint dont la condition vient de se lire, comme un pouvoir. |
| **Le banc du soir** (js/banc-du-soir.js) | il s'allume avec les périodes jouées (la feuille garde `k` pour chaque adjoint, comme `feuille.pouvoirs`). Éteint, il dit pourquoi en vrais chiffres : « 6 mises en échec sur 8 », « 2 🛑 sur 3 ». |

### Le duel, les séries, les offres

- **Au duel et en séries**, la condition joue comme un autre soir. À l'entracte, l'adjoint propose aussi le plan de son style (`voixDuBanc`, livré). Un adjoint entré voit sa proposition marquée « il est entré » ; elle ne pèse rien de plus.
- **Les offres** (`adjointsOfferts`) : un parmi trois, comme avant. Une des trois au moins partage la famille ou la voie d'une carte de ta main, s'il en reste une hors de ta main. On bâtit un banc ; on ne prend pas que ce qui passe.
- **La main** reste à quatre cartes (`MAIN_MAX`), et les cases suivent le niveau du coach (`CASES_PAR_NIVEAU`).

### La banque : seize adjoints, deux par philosophie

Les neuf clés d'aujourd'hui restent ; sept sont neuves (✚). « MÉ » veut dire mises en échec.

| | Adjoint | Voie | Famille | Il entre… | Ce qu'il donne · ce qu'il coûte |
|---|---|---|---|---|---|
| 1 | 🏹 Le canonnier | 🐝 Frelon | 🟢 | quand 3 🚀 défenseurs offensifs s'habillent | plus de tirs · moins de précision |
| 2 | ⏰ Le réveille-matin ✚ | 🐝 Frelon | ⚪ | le soir après une défaite | plus de tirs · plus de punitions pour toi |
| 3 | 🔭 Le tireur d'élite | 🦅 Rapaces | 🟠 | quand tu tires de l'arrière d'un but | plus de précision · moins de tirs |
| 4 | 🔬 Le spécialiste ✚ | 🦅 Rapaces | 🔵 | après une période à 9 tirs ou moins | plus de précision · moins de MÉ |
| 5 | 🧱 Le mur | 🐢 Tortue | 🟢 | quand 3 🛑 défensifs s'habillent | moins de tirs contre · moins de tirs |
| 6 | 📐 Le stratège ✚ | 🐢 Tortue | ⚪ | contre un club mieux classé que toi | moins de buts contre · moins de tirs |
| 7 | 🏋 Le cogneur | 🦏 Rhinos | 🔵 | après une période où ils t'ont dominé aux tirs | plus de MÉ · plus de punitions pour toi |
| 8 | 🚔 Le policier ✚ | 🦏 Rhinos | 🟢 | quand 4 🔧, 🪠 ou 💪 s'habillent | plus de MÉ, leur précision baisse · plus de punitions pour toi |
| 9 | 🏃 Le préparateur | 🫁 Souffle | ⚪ | à l'étranger | jambes fraîches, moins de blessures · un peu moins de tirs |
| 10 | 🌀 Le patineur ✚ | 🫁 Souffle | 🔵 | après une période à 8 MÉ ou plus | jambes fraîches, moins de blessures · moins de MÉ |
| 11 | 🧘 Le moine | 😇 Chœur | 🔵 | après une période où ils ont pris 2 punitions ou plus | moins de punitions pour toi · moins de MÉ |
| 12 | 🦓 L'ancien arbitre | 😇 Chœur | ⚪ | à domicile | moins de punitions pour toi, plus pour eux · son salaire |
| 13 | 🔁 Le rouleur | 🪜 Profondeur | 🟠 | quand tu mènes de deux buts ou plus | quatre trios, moins de blessures · ton 1er trio joue moins |
| 14 | 🧒 Le développeur ✚ | 🪜 Profondeur | 🟢 | quand 4 recrues s'habillent | tes 3e et 4e trios jouent plus, plus de précision · moins de tirs |
| 15 | 🎤 Le vedettiste | 🌠 Étoiles | 🟠 | à égalité après la 1re | ton 1er trio joue plus · plus de blessures |
| 16 | 📯 Le promoteur ✚ | 🌠 Étoiles | 🟢 | quand 3 ★ Étoile ou mieux s'habillent | ton 1er trio joue plus, plus de précision · plus de buts contre |

**Les familles.** Le rythme en compte quatre, l'alignement cinq, le pointage trois, le calendrier quatre. Chaque philosophie a deux adjoints de deux familles différentes.

**L'ancien arbitre.**
- Il rejoint maintenant le Chœur, la discipline, et garde son salaire : JP voulait *a ref, and pay them*.
- La règle « hors des voies, un adjoint se paie » devient « l'arbitre se paie ».

**Les bancs qui s'emboîtent :**
- **la ligne bleue** : 🏹 et 🧱, deux seuils de défenseurs qui se disputent les six places ;
- **le jeu physique** : 🚔, 🌀 et 🏋, le policier fait les mises en échec qui font entrer le patineur ;
- **la route contre la maison** : 🏃 et 🦓, jamais le même soir ;
- **les vedettes** : 📯 et 🎤, avec le Chœur.

**Partis de la première version :** le vieux renard (les séries sont des duels), le médecin (il vidait l'infirmerie qui le faisait entrer), le flambeur (il entretenait sa propre série), l'animateur, le chasseur, le showman, l'entraîneur des gardiens (c'est un mot de voix), le coach des défenseurs (« le coach de… » est interdit, il est devenu le mur) et le plombier-chef (il est devenu le policier).

## 4. Les chiffres

- **La fréquence visée.**
  - **Une condition de période** (le rythme, le pointage) entre de 25 % à 65 % des périodes qu'elle peut lire (`check_pouvoirs`, mesurée sur des clubs réels).
  - **Une condition du matin**, de 25 % à 65 % des soirs : à domicile 50 %, à l'étranger 50 %, après une défaite environ 45 %, contre un mieux classé environ 50 %.
  - **Les seuils d'alignement** sont pris pour qu'un vrai club ordinaire les atteigne de 15 % à 30 % des soirs, et un alignement bâti pour eux chaque soir. Ce sont les chiffres de la tranche 0, pas des devinettes : la revue a mesuré 56 % des clubs à trois 🎯 sans rien faire.
- **Un seuil d'alignement atteint joue chaque soir.** Il se paie autrement :
  - **en places** : un 🛑 de plus, c'est un 🚀 de moins ;
  - **en force** : sa table est réglée pour jouer les trois périodes sous la borne de son niveau (`BORNE_NIV`), comme une carte qui joue tous les soirs. Il reste sous la borne même atteint 82 soirs sur 82.
- **La force d'une période active.**
  - C'est la table de l'adjoint à son niveau (`styleAuNiveau`, ×0,7 à ×1,3 pour ce qu'il donne).
  - Pour une condition de période, la table est remontée jusqu'à ce que le soir où il joue se voie dans la feuille. Ce sont les seuils de la règle des cartes (rogue.md) : ±2 tirs, ±0,3 but, ±0,5 punition, ±4 mises en échec.
- **Le plafond d'une période** (`PLAFOND_PERIODE`, neuf).
  - Le coach et tous ses adjoints entrés réunis, un canal ne bouge pas plus de ×0,65 à ×1,6 dans une période. Les buts contre ne descendent pas sous ×0,65.
  - La revue a mesuré la Tortue niveau 5, en avance en 3e, avec le mur : buts contre ×0,53. Le plafond s'applique à cette somme.
  - `FINITION_MAX` reste réservé aux pouvoirs.
- **La borne.**
  - Seul, sur une saison, un adjoint reste sous celle de son niveau (±1 V au Soutien et au Régulier, ±1,5 au Pilier, ±2,5 à l'★ Étoile, ±4 au ★ Phénomène).
  - Le banc plein (trois adjoints) avec son coach au niveau 5 reste sous 16 V, la borne du personnage complet.

## 5. Les cas limites

- **Une vieille partie.** Un adjoint d'avant la V24 garde sa clé et son niveau, et prend sa condition. Un séjour en cours devient un poste sans fin, un repos en cours se ramène à `REPOS_RETIRE`. Une partie en cours se rejoue (`VERSION_MOTEUR`). Les clés `sejours` et `fin` se lisent encore, pour les fiches.
- **Un blessé, le remplaçant de la ligue.** Les badges se comptent sur les habillés du soir. Le remplaçant n'a ni badge ni niveau.
- **Un joueur qui joue amoché** compte : il est habillé.
- **Le duel et les séries** : la condition joue, et le plan est proposé à part (§ 3).
- **Le pointage en prolongation** : la prolongation lit l'état après trois périodes, comme un pouvoir.
- **Deux conditions contraires sur le même banc** (à domicile, à l'étranger) : elles ne jouent jamais le même soir. C'est un choix, et Ce soir le dit.
- **La main pleine** : rien ne change (`quiPartDeLaMain`).

## 6. Ce qu'il touche

**Le code :**

| Fichier | Ce qui change |
|---|---|
| js/adjoints.js | la banque à seize, `quand`, `quandCourt`, `famille`, `REPOS_RETIRE`, la synergie en salaire ; `sejourDe` et `motDeSynergie` refaits |
| js/sim.js | `jouerEnPeriodes` pose les adjoints entrés par période, comme les pouvoirs ; `poserLesAdjoints` ne pose plus que le journal ; `etatDuPouvoir` compte aussi les mises en échec et les punitions des deux clubs dans la période d'avant ; un moment neuf, `mieuxClasse` ; `PLAFOND_PERIODE` ; la feuille garde `k` |
| js/pouvoirs.js | `etatDuPouvoir` partagé ; `quiEntreraCeSoir`, pur |
| js/impact.js | `lignesDeLAdjointEnChiffres` : la condition devant, la période |
| js/saison.js | Ce soir : la ligne du banc ; le direct : « … entre » |
| js/lignes.js | le compteur d'alignement |
| js/alignement.js | la carte : le recto et son filet |
| js/banc-du-soir.js, js/profil-style.js | les périodes, et le pourquoi d'un adjoint éteint |
| js/rogue.js | `salairesDesAdjoints` (la synergie), et rien d'autre de l'économie |
| js/ballottage.js | rien |

**Les scripts :**
- `check_pouvoirs` : la fréquence réelle, le canal contre la condition, le doublon avec le coach, les boucles jouées sur une saison, le banc plein avec son coach, `PLAFOND_PERIODE`, les seuils sur les vrais clubs ;
- `check_banc` (les périodes, le pourquoi) ;
- `check_moments_si` (`mieuxClasse`) ;
- `check_lexique` (les icônes neuves) ;
- `essai_rogue` (la ligne du banc dans Ce soir tient sous 1,0 écran).

**Les règles fermes :**
- **rogue.md.** « Une carte, un style, un séjour » devient « une carte, un style, une condition ». `SEJOUR`, `SEJOUR_SYNERGIE` et `REPOS` partent, `REPOS_RETIRE` arrive. « Court, un style frappe fort chaque soir » part. « Un adjoint par philosophie » devient « deux, de deux familles ». « Hors des voies, un salaire » devient « l'arbitre se paie ».
- **vocabulaire.md.** Plusieurs mots changent :
  - « en poste » perd son séjour ;
  - « au repos » devient la carte retirée ;
  - **la condition** d'un adjoint et **sa famille** (rythme, alignement, pointage, calendrier) arrivent ;
  - « il entre » est le mot de l'écran.
- **decisions.md.** On ajoute une entrée : V22 (séjour) défait par JP le 3 nov., S132 (*pas de moments pour les adjoints*) défait en partie par JP le 3 nov. Le calendrier revient, mais il se lit au matin dans Ce soir, ce qui manquait en V10.
- **Les sauvegardes.** `cap82_rogue` ne bouge pas ; la décision `poste` garde sa forme, sans `fin`.

## 7. Les réglages

| Constante | Défaut | Plage sûre | Ce qu'elle fait |
|---|---|---|---|
| `REPOS_RETIRE` | 10 | 6 à 15 | sous 6, on change de banc par adversaire |
| `PLAFOND_PERIODE` | ×0,65 à ×1,6 | ±0,1 | — |
| Les seuils d'alignement | 3 🚀, 3 🛑, 4 🔧🪠💪, 4 recrues, 3 ★ | — | fixés à la tranche 0 sur les vrais clubs, de 15 % à 30 % des soirs ordinaires |
| Les seuils du rythme | 8 MÉ, 9 tirs ou moins, 2 punitions | — | fixés à la tranche 0, de 25 % à 65 % des périodes |
| La table de chacun | — | — | réglée par `check_pouvoirs` : visible le soir où il entre, sous sa borne, jamais un piège |

## 8. Les critères d'acceptation

- [ ] Aucune condition ne lit un canal que son adjoint bouge — `check_pouvoirs`
- [ ] Aucun adjoint ne double un pouvoir de son coach (même condition, même canal) — `check_pouvoirs`
- [ ] Chaque condition entre de 25 % à 65 % des périodes ou des soirs qu'elle lit, sur des clubs réels ; les seuils d'alignement, de 15 % à 30 % des soirs d'un club ordinaire — `check_pouvoirs`
- [ ] Le soir où il entre, il se voit dans la feuille ; seul sur une saison, il reste sous la borne de son niveau, jamais un piège ; hors de ses périodes, il ne change rien — `check_pouvoirs`
- [ ] Le banc plein et son coach au niveau 5 restent sous 16 V, et aucune période ne passe `PLAFOND_PERIODE` — `check_pouvoirs`
- [ ] Une saison jouée : aucune condition ne s'éteint ni ne s'entretient d'elle-même (sa fréquence avec l'adjoint en poste, contre sans lui, à 5 points près) — `check_pouvoirs`
- [ ] `quiEntreraCeSoir` dit au matin ce que le moteur joue le soir, pour les conditions du matin — `check_pouvoirs`
- [ ] Le banc du soir allume les périodes jouées et dit pourquoi un adjoint est resté éteint — `check_banc`
- [ ] Ce soir tient sous 1,0 écran avec la ligne du banc ; la condition se lit au recto d'une carte de 78 px — `essai_rogue`
- [ ] La courbe des runs tient (la première Coupe de l'attentif à la run 3 ou plus tard) — `check_rogue`, `check_profondeur`
- [ ] À juger par JP à l'essai : on bâtit son alignement pour son banc ; on regarde Ce soir avant le match ; on voit « … entre » en direct.

## Les tranches

0. **La mesure d'abord**, sans rien changer au jeu. On étend `check_pouvoirs` :
   - la fréquence réelle de chaque condition sur des clubs réels ;
   - les seuils d'alignement sur les 32 clubs d'une dizaine de saisons ;
   - le canal contre la condition ;
   - le doublon avec le coach ;
   - le banc plein avec son coach.

   Les seuils du § 7 en sortent. Si une condition ne tient pas dans sa plage, on la change dans ce devis avant la tranche 1.
1. **Le moteur.** Les adjoints par période, la feuille `k`, `etatDuPouvoir` étendu, `PLAFOND_PERIODE`, une horloge (`REPOS_RETIRE`, la synergie en salaire), la vieille partie — `check_pouvoirs`, `check_banc`, `check_sauvegardes`, `check_rogue`.
2. **Les neuf adjoints d'aujourd'hui avec leur condition, et les écrans.** La carte au recto, Ce soir, le direct, le banc — `check_pouvoirs`, `check_banc`, `essai_rogue`.
3. **Les sept neufs.** Les conditions d'alignement, le compteur des Lignes, les offres qui bâtissent — `check_pouvoirs`, `check_moments_si`, `check_lexique`, `essai_rogue`.
4. **Plus tard, si JP le veut** : la même largeur pour les coachs (deux arbres de pouvoirs par philosophie).
