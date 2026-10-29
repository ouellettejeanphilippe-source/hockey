# V20 — Le coach, son banc, ses histoires : un système qu'on tient dans sa tête

29 octobre 2026. JP : *revoir entièrement les événements et coachs et assistants coach pour système plus clair et fun*.

Un devis, pas quatre (docs/propositions-coachs-cartes-evenements.md en avait quatre ; la structure C + B a été retenue et ses tranches 1, 2, 3 (en partie), 5 (en partie) et 6 sont faites). Ce qui suit part de ce que le code dit aujourd'hui (HEAD b842865), compte ce que le joueur doit tenir dans sa tête, et refait les trois sujets autour d'**une règle chacun**, avec **un seul lien** entre eux. Rien ne change dans le moteur : tout passe par les canaux qui existent (CLAUDE.md, « Aucune cote neuve, aucune mécanique neuve »).

## Ce qu'il y a aujourd'hui, compté

**Le coach** (js/coachs.js, js/chiffre.js, js/banque.js `buildDe`)

| Ce que le joueur doit savoir | Où |
|---|---|
| 8 coachs à choisir, un 9e (le Comptable 🏦) qui n'est qu'une couleur de carte | `COACHS`, `VOIES` |
| La confiance I/II/III à 3, 7 et 15 points | `SEUILS` |
| **Quatre chemins** vers ces points : 1 par adjoint de sa couleur en poste, 1 par échelon pris, 1 par 90 matchs à ton service, 1 (au plus) par bloc de dix matchs où son chiffre est tenu | `buildDe`, `MATCHS_CONFIANCE`, `PLAFOND_TENUS` |
| Ses joueurs : chaque palier de badge de sa couleur habillé grandit son effet de 10 %, jusqu'à 24 paliers | `JOUEUR_COACH`, `PALIERS_COACH_MAX` |
| Son prix à chaque palier, sa famille paie/coûte, ce que son dépisteur recrute | `prix`, `familles`, `recrute` |
| Son combo : deux adjoints nommés, de deux postes, en poste avec lui | `COMBOS`, js/personnel.js |

**Les adjoints** (js/personnel.js, js/echelons.js, `MAL_ASSORTI` js/sim.js)

| Ce que le joueur doit savoir | Où |
|---|---|
| 54 cartes, 3 raretés, **six** rôles (les cinq postes de la V19, plus `direction`, que sept cartes portent encore) | `PERSONNEL`, `ROLES` |
| Un style net à zéro, amplifié ×1,6, joué chaque match | `AMPLEUR_STYLE` |
| 11 protégés, dont 3 feux qui gagnent une deuxième ligne après deux poussées | `PROTEGES`, `LIGNES_DU_FEU` |
| 3 échelons : des **matchs à ton service** (10, 30 ; doublés à la couleur du coach) **et** des jetons (40, 80) **et** un choix force/défaut, le défaut déjà corrigé de moitié au départ | `MATCHS_ECHELON`, `PRIX_ECHELON`, `CORRECTION_DE_DEPART` |
| Les doublons ouvrent les échelons : sans doublon, l'échelon 3 est fermé | `ouvertsDe` |
| Un **contrat en jours** (46, 62 ou 78 sur 186) qui finit à une date différente pour chaque chaise, une prolongation en jetons (7, 12, 20) | `CONTRAT_JOURS`, `PRIX_PROLONGATION` |
| **Une pénalité cachée** : un adjoint d'une autre couleur que ton coach rend la moitié de sa force et son défaut mord 1,5 fois | `MAL_ASSORTI` |

**Les événements** : dix sources, environ 300 pièces, cinq horloges.

| Source | Pièces | Quand | Choix ? |
|---|---|---|---|
| Dossiers (js/dossiers.js) | 24 | un lundi sur deux | oui |
| Routes de la semaine (js/noeuds.js) | 25 cartes, 3 routes | l'autre lundi | oui |
| Dilemmes (`MOMENTS`, js/sim.js) | 23 | 8 jours, ±2 matchs | oui |
| Dilemmes de la vie du DG (`MOMENTS_VIE`) | 10 | avec les dilemmes | oui |
| Courriels et presse (`REPONSES_VIE`, js/vie-gm.js) | 177 réponses | tous les 8 matchs | oui |
| Choix des fils (`CHOIX_DES_FILS`) | 4 | quand un fil naît | oui |
| Séquences (`SEQUENCES`) | 2 | sur une série | oui |
| Situations du vestiaire (`SITUATIONS`) | 12 | matchs 10, 28, 46, 64 | non |
| Accidents | — | matchs 7, 22, 37, 55, 74 | non |
| Arcs et défis (js/arcs.js) | 19 + 7 | ≤ 5 par saison | non |

**Ce qu'une saison de Rogue demande**, compté sur ces cadences : 13 routes, jusqu'à 13 dossiers, 8 dilemmes, une dizaine de courriels, 3 adjoints aux paliers, 2 objectifs, une dizaine de prolongations (cinq chaises, deux à quatre fins de contrat chacune, à des dates qui ne se suivent pas), jusqu'à dix échelons, les fils et les séquences. **Entre 70 et 85 décisions hors des matchs**, la plupart de ±0,5 V, plus une vingtaine de nouvelles sans choix. Le joueur ne peut pas tenir ça dans sa tête : il clique (docs/propositions-coachs-cartes-evenements.md l'a déjà écrit le 27 oct. ; la V19 a ajouté le chiffre, les contrats et les combos sans rien retirer).

## Ce qui ne va pas, en trois lignes

1. **Des compteurs qu'on attend au lieu de les jouer.** Les matchs à ton service, les contrats en jours, la confiance par quatre chemins : rien de tout ça ne demande une décision, seulement de la patience, et chacun a sa propre date.
2. **Dix sources qui disent la même chose.** La table de massage est une route, un adjoint (le masseur), une réponse de dossier (les jambes lourdes) et un dilemme. Le joueur ne sait plus d'où vient un effet, ni pourquoi il est là.
3. **Les liens sont cachés.** La couleur du coach double les matchs à ton service (invisible), un adjoint mal assorti joue à moitié (invisible), le chiffre du coach compte pour un point sur quinze (presque rien). Le build existe, mais on ne le voit pas grandir.

## La V20 en une page

Trois sujets, une règle chacun, et une seule règle qui les relie.

> **Le coach : un chiffre.** Tu choisis ton coach parmi trois ; il a UN chiffre, une vraie stat de match (les tirs du Frelon, les tirs contre de la Tortue…). Tiens-le, et sa confiance monte. C'est tout.
>
> **Le banc : cinq chaises, toujours ouvert.** Cinq adjoints, une ligne verte et une ligne rouge chacun. Plus de contrat : un adjoint reste tant que tu ne le remplaces pas. Engager est gratuit au camp, payant en saison ; le banc ne demande jamais rien de lui-même.
>
> **Les histoires : un joueur, deux options, un verdict.** Une seule table. Une histoire sort un soir qu'on ne prévoit pas, si son fait est vrai ; elle nomme un joueur de ton effectif ; tu choisis entre la sûre et l'audacieuse (un dé qu'on voit) ; son verdict arrive à la fin de sa fenêtre, en vrais chiffres de ses feuilles.
>
> **Le lien : la couleur de ton coach vaut un cran de plus.** Un adjoint de sa couleur joue un échelon plus haut ; une option d'histoire de sa couleur joue un cran plus fort. Partout la même règle, affichée sur la carte et sur l'option. Et comme ses adjoints et ses options poussent SA stat, ils font monter sa confiance sans compteur de plus.

Une saison demande alors une trentaine de décisions au lieu de 70 à 85 : une douzaine d'histoires, deux mandats du proprio, les blessures, les gros matchs.

## 1. Le coach : un chiffre

**Ce qui reste.** Les huit coachs choisissables (`VOIES`), le choix parmi trois au départ d'une run, leurs paliers I/II/III et ce qu'ils jouent (`COACHS[].paliers` : `check_voies` reste le juge, +6 à +8 V à la III), leurs joueurs de couleur (`porteParSesJoueurs`), leur combo (`COMBOS`), le congédiement au proprio (`laTete`).

**Ce qui change.**

- **La confiance n'a qu'un chemin : son chiffre tenu.** `CHIFFRES` (js/chiffre.js) existe pour les huit. Un bloc de dix matchs de ton club où son chiffre bat la ligue du `seuil` est un bloc tenu ; la confiance est I au choix, II à `BLOCS_CONFIANCE[2]` blocs tenus, III à `BLOCS_CONFIANCE[3]`, comptés sur la run (une saison en a huit). Les blocs ne s'effacent pas : un bloc raté ne coûte rien, il ne rapporte rien. Partent : le point par adjoint en poste, par échelon, par 90 matchs (`MATCHS_CONFIANCE`), `PLAFOND_TENUS`.
- **Le chiffre se voit chaque matin, en une ligne**, à la maison du coach et dans l'en-tête du Bureau : « 🐝 Tirs · 33,4 contre 30,1 pour la ligue · bloc 6 sur 10 · II dans 1 bloc ». Le joueur sait quoi faire : aligner des tireurs, engager le crieur du banc, prendre l'option qui fait lancer.
- **Le Comptable n'est plus une couleur.** Ses cartes d'argent deviennent neutres et vont chez le proprio (§ 2). Il reste huit couleurs, huit coachs, huit chiffres : un mot, un sens.
- **Le prix du coach se dit sur sa carte de choix**, à côté de son chiffre : « Tire plus, vise moins » (`prix`). `recrute` (un texte à la main) part : le dépisteur lit déjà la couleur.

**Pourquoi c'est plus fun.** La confiance devient un objectif qu'on poursuit match après match, comme la quête d'un personnage : un chiffre, une jauge, un palier qui s'allume. Le build (les joueurs, les adjoints, les options de sa couleur) est la façon de le tenir, pas un compteur parallèle.

**À calibrer, pas à deviner.** `BLOCS_CONFIANCE` se règle pour que la II et la III arrivent au même match qu'aujourd'hui, en médiane, chez le robot attentif (`jouerRun` le note déjà : `confiance[palier]`), puis `check_profondeur` (la première Coupe à la run 3 ou plus tard). Mesuré (tranche 1) : un point par bloc tenu (`POINTS_PAR_BLOC`), `SEUILS` inchangés — la II à 4 blocs, la III à 12 ; chez le robot attentif, la II au 50e match en médiane (37 avant), la III en deuxième saison de run (presque jamais avant), la première Coupe à la run 2 ou 4 comme avant. À deux points par bloc, la III venait dès la première saison et la Coupe dès la première run. Chaque `seuil` de `CHIFFRES` doit être tenable à la I avec deux adjoints de sa couleur, et pas sans eux sur un club neutre (`check_chiffre`, les huit coachs, plus six sur huit).

## 2. Le banc : cinq chaises, toujours ouvert

**Les cinq chaises** (V19, inchangées) : l'adjoint en chef, l'attaque, la défense et les gardiens, le physique et les soins, le dépistage. La sixième, `direction`, part, et l'argent quitte le banc :
- les cinq cartes d'argent, où qu'elles soient rangées aujourd'hui (le gestionnaire de la caisse, le négociateur, le fiscaliste, le gérant de la boutique, le chasseur d'aubaines) deviennent **les ententes du proprio** : une à la fois, offerte au verdict du mandat, rangée chez le proprio avec l'argent (la règle d'une maison par sujet, et la décision du 27 oct. : *l'économie du club ne touche jamais le match*) ;
- ses cinq cartes de style prennent la chaise de leur canal : l'ancien arbitre au chef, l'agent des vedettes et l'animateur de foule à l'attaque, le réservateur d'hôtels au physique, le directeur de l'usine au chef.

**Un adjoint, une carte qui se lit d'un coup d'œil** : son nom de style, sa couleur, UNE ligne verte, UNE ligne rouge, en vraies stats (« +3 tirs par match · −1 pt de précision »), son échelon, et, s'il en a un, son protégé nommé. Rien d'autre sur le recto.

**Le banc ouvert** (tranché par JP, 29 oct. : *au lieu de trois fenêtres, possibilité en tout temps de remplacer, mais prix pour embauche sauf début de saison*). Plus de contrat, plus de fenêtre : un adjoint reste à sa chaise tant que tu ne le remplaces pas. Tu peux changer ton banc **n'importe quand**, depuis la maison du coach :
1. **au camp** (avant le premier match de la saison), engager est gratuit — on bâtit son banc pour sa stratégie ;
2. **en saison**, engager coûte des jetons (`PRIX_EMBAUCHE` : 10, 16, 25 🪙 selon la rareté), et l'adjoint remplacé part ; changer de stratégie en cours de route se paie, mais reste possible à tout moment.

Les adjoints arrivent comme aujourd'hui (les packs, les paliers des 9e, 18e et 26e matchs, le butin d'un gros match, le verdict du proprio) et attendent à ta collection ; les engager est un geste du joueur, jamais une interruption. Partent : `CONTRAT_JOURS`, `PRIX_PROLONGATION`, la prolongation, les avis « à six matchs de la fin » d'Hier soir.

**Les échelons : des jetons et un choix, sans attente.** Trois échelons, achetés en jetons (`PRIX_ECHELON`) quand tu veux ; à chacun, pousser sa force ou corriger son défaut (le choix reste : c'est le seul de l'adjoint, et il est bon). Partent : les matchs à ton service (`MATCHS_ECHELON`), le service doublé à la couleur, les échelons fermés sans doublon. **Un doublon tiré d'un pack** donne un échelon gratuit, tout de suite.

**La couleur du coach : un cran de plus, jamais un de moins.** Un adjoint de la couleur de ton coach joue un échelon plus haut que le sien (un échelon 3 joue une poussée de plus) ; un adjoint d'une autre couleur joue son échelon, ni plus ni moins. Part : `MAL_ASSORTI`, la pénalité cachée. La carte le dit : « 🐝 Avec le Frelon : échelon 2 ».

**Le combo reste**, et se voit : sur chaque carte d'un combo, « Combo 🐝 La foule se lève · 1 sur 2 ». Le feu (☄ 🪔 💫) reste le combo de l'Aigle.

**Ce qui ne bouge pas** : la borne d'un adjoint (le style, pas la force, au premier échelon : `check_places`), son effet chaque match, ses protégés, sa carte au format de hockey.

**Pourquoi c'est plus fun.** Le camp, c'est le moment où l'on bâtit son banc pour son coach, gratuitement ; ensuite, chaque changement de stratégie est une vraie décision, qui coûte, mais qu'on prend quand on veut (ce que JP voulait des contrats courts, le 28 oct.), sans recevoir dix avis à dix dates.

## 3. Les histoires : un joueur, deux options, un verdict

**Une table** : `HISTOIRES` (js/histoires.js), une trentaine d'histoires, qui reprend le meilleur des dossiers, des dilemmes, des courriels, des choix des fils et des séquences. Chacune :

| Champ | Ce qu'il est |
|---|---|
| `fait(f)` | le fait vrai, lu sur ce qui est déjà joué (`FAITS`, `faitsDuClub`) — jamais une histoire bidon |
| `joueur(f)` | **toujours** un joueur de l'effectif (la décision du 27 oct.) : le marqueur en panne, le puni, le plus bas en jambes, le gros contrat, le gardien de la raclée, la recrue, le chaud |
| `de` | la voix qui la dit (`EXPEDITEURS`), avec sa réplique sans chiffre (`check_clarte` § 5) |
| `fenetre` | ses matchs, affichés : « du 24e au 31e match » |
| `sure` | l'option sûre : un effet certain, petit |
| `audace` | l'option audacieuse : un dé qu'on lance à l'écran, ses faces gagnantes et ce que chaque côté fait, en deux lignes |
| `suite` | (quelques-unes) l'épisode d'après, selon le verdict |

**Les effets vont au joueur.** Ses canaux (`CANAUX_MUT` : lancers, finition, création, défense, blessure, arrêts), ses jambes, sa glace ; l'équipe n'en reçoit que l'écho (la règle des trois canaux du 27 oct. : un incident n'écrit jamais dans les canaux d'équipe). Le net d'équipe reste sous la borne de sa rareté (`check_arcs` le mesure déjà en blocs appariés).

**Le soir où elle sort ne se prévoit pas.** Au moins `ESPACE_HISTOIRES` (4) matchs depuis la dernière, puis une chance par soir (`CHANCE_DU_SOIR`, 0,25) tirée de la graine et du jour (`hache`), si un fait est vrai : une douzaine par saison, jamais deux à la fois dans À faire, jamais le jour d'un gros match. Le type se tire parmi les faits vrais, pondéré par ce qu'on n'a pas vu depuis longtemps. La même graine rejoue les mêmes soirs (`check_graine`).

**Le verdict arrive.** À la fin de sa fenêtre, une ligne d'Hier soir, par son nom, en vrais chiffres de ses feuilles : « Caufield : 5 buts en 7 matchs, il en avait 1 en 10. L'audace a payé. » (`js/verdicts.js` le fait déjà pour les choix de la semaine.)

**La couleur, là aussi.** L'option dont les canaux sont ceux d'un coach (`coachDesCanaux`) porte son icône ; si c'est ton coach, elle joue un cran plus fort, comme son adjoint. La même règle, partout.

**Ce qui part.** Les routes de la semaine (js/noeuds.js : leurs cartes sont des réponses de dossier, des adjoints ou des dilemmes en double ; la commandite va au proprio), les courriels et la presse (les 177 réponses de js/vie-gm.js ; `EXPEDITEURS` reste), les dilemmes (`MOMENTS`, `MOMENTS_VIE`, `JOURS_MOMENTS`), les situations (deviennent des nouvelles d'Hier soir ou des histoires), les séquences et les choix des fils (deviennent des histoires à suite), les dossiers (deviennent des histoires). Les accidents restent des blessures, avec leur écran.

**Ce qui reste à part**, parce que chacun a déjà sa forme et sa maison : la blessure (jouer amoché, le physio, le repos), le gros match (le duel), le mandat du proprio, les arcs et les défis (des nouvelles d'un joueur, sans choix, suivies au Vestiaire), les rivaux du premier lundi.

**Pourquoi c'est plus fun.** Une histoire, c'est quelqu'un de ton effectif, une décision qui a une vraie chance de rater, et une réponse qu'on attend : le Cheechoo qu'on met sur le premier trio, le gardien qu'on garde après une raclée. Moins souvent, mais chaque fois quelque chose.

## Ce qui change dans les règles de CLAUDE.md (à la signature de JP)

| Règle d'aujourd'hui | V20 |
|---|---|
| La confiance se compte par quatre chemins (adjoints, échelons, matchs, chiffre) | Un chemin : les blocs où son chiffre est tenu (`BLOCS_CONFIANCE`) |
| Un échelon devient possible en matchs à ton service, deux fois plus vite à la couleur | Un échelon s'achète en jetons, quand on veut ; la couleur du coach joue un échelon plus haut |
| Le contrat d'un adjoint : 46, 62, 78 jours, la prolongation en jetons | Plus de contrat : un adjoint reste tant qu'on ne le remplace pas ; engager est gratuit au camp, payant en saison (`PRIX_EMBAUCHE`) |
| Un dilemme / un dossier / une route / un courriel… | Une histoire : un fait vrai, un joueur, deux options (la sûre, l'audacieuse), un verdict |
| Le personnel est la seule carte bonus ; la direction en est | Le banc est la seule carte de match ; l'argent va aux ententes du proprio |

Ce qui ne change pas : une carte change la forme, pas la force (les bornes par rareté) ; on mesure en paires ; tout le hasard passe par `hasard()` et la graine ; un texte ne dit que ce qui est arrivé ; une maison par sujet ; les cartes au format de hockey.

## Les tranches

Chacune se fusionne seule, au vert, et laisse le jeu jouable.

| Tranche | Ce qu'elle fait | Le juge |
|---|---|---|
| **1. Le coach, un chiffre** (faite) | `POINTS_PAR_BLOC` ; `buildDe` ne compte plus que la base et les blocs tenus depuis l'entrée en poste ; le report d'une saison garde ses blocs ; le chiffre en une ligne chez le coach (ta stat du bloc contre la ligue) | `check_chiffre` (huit sur huit), `check_coachs`, `check_profondeur`, `check_rogue`, `essai_rogue` |
| **2. La couleur, un cran** (faite) | `MAL_ASSORTI` part ; un adjoint de la couleur joue un échelon plus haut (`assortiPour`) ; la rangée et la feuille le disent (« 🐝 +1 ») | `check_places`, `check_personnel`, `check_combos`, `check_voies` |
| **3. Le banc ouvert** (faite, sauf l'argent) | plus de contrat ; engager gratuit au camp, payant en saison (`PRIX_EMBAUCHE`) ; échelons en jetons sans service ; doublon = un échelon. Reste (3b) : le Comptable neutre, `recrute`, la direction (ententes du proprio) | `check_banc` (neuf, remplace `check_contrats`), `check_personnel`, `check_packs`, `check_dossiers`, `essai_rogue` |
| **4. Les histoires** (4a et 4b faites) | 4a : une seule source le lundi, le dossier, un lundi tiré de la graine (`semaineAHistoire`, 55 %) ; les routes (js/noeuds.js), les dilemmes, les séquences, les courriels et la presse ne s'offrent plus ; les choix des fils restent (une histoire née d'un fil). 4b : l'option audacieuse au dé sur les histoires d'un joueur — Il boude (« Le mettre au premier trio »), l'agent (« Lui lancer un défi »), la raclée (« Le renvoyer devant le filet ») : un dé de six, trois faces, l'issue sur lui seul, huit ou six matchs (`pari`, `lui`). 4c : retirer les tables des sources parties (une partie d'avant les relit encore) | `check_dossiers`, `check_verdicts`, `check_effets`, `check_mots`, `check_lisibilite`, `essai_rogue` ; `check_dilemmes` et `check_noeuds` partent avec leurs sources |
| **5. L'écran et les règles** | À faire : l'histoire en cours, la blessure, le gros match, le pack ; la page des règles récrite ; CLAUDE.md et `docs/decisions.md` | `essai_rogue`, `check_clarte`, `check_lexique`, `check_mort` |
| **6. Les anciennes parties** | les clés `do:`, `n:`, `vie:`, `m:`, `fil:` se relisent pour les décisions prises ; rien de neuf n'est tiré pour elles ; un contrat en jours s'ignore : l'adjoint reste | `check_sauvegardes` |

L'ordre compte : 1 et 2 sont petites, rendent le lien visible tout de suite, et ne touchent pas aux sauvegardes ; 3 et 4 sont les grosses ; 5 et 6 ferment.

## Tranché (JP, 29 oct.)

*Oui à tout, mais au lieu de trois fenêtres, possibilité en tout temps de remplacer, mais prix pour embauche sauf début de saison.*

1. Les contrats en jours partent ; **pas de fenêtres** : le banc est ouvert en tout temps, l'embauche est gratuite au camp et payante en saison (§ 2).
2. Les routes de la semaine partent.
3. La confiance ne vient que du chiffre tenu.
4. La couleur du coach vaut un cran de plus ; `MAL_ASSORTI` part.
5. On part par la tranche 1.
