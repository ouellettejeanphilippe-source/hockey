# La V6 · trouver la meilleure combinaison

10 octobre 2026. JP, après deux runs :
- *Ya pas assez de stratégie, je pense que les cartes sont trop complexes, autant événements que le reste.*
- *Le but du jeu, ça devrait être de trouver les meilleures combinaisons.*
- *Le truc pour intégrer joueurs des packs et comparer suce, les stratégies sucent, car l'information est pas claire à utiliser, manquante.*
- *Le moteur est bon, les idées de base sont bonnes, mais ni les cartes, ni les packs, ni comment optimiser les équipes n'est aussi réussi qu'un FUT ou un HUT.*
- *Le jeu devrait m'encourager à essayer des joueurs différents, trouver des synergies, tomber sur des événements qui lient des joueurs positivement ou négativement.*
- *Ya de bons et de mauvais joueurs de troisième et quatrième trios, ce sont même parfois les plus importants en séries ; présentement, c'est pas le cas. Même chose en défensive.*

Ce plan s'appuie sur trois enquêtes du même jour :
- **une run jouée dans Chromium à 390 px** : 73 captures et le texte réel de chaque écran. Les packs, la signature, l'alignement, les systèmes, les cartes et les coachs ;
- **un inventaire des mécanismes de combinaison du code**, avec la complexité mesurée des 536 cartes ;
- **une mesure en paires du bas de l'alignement** : 128 vraies équipes, la lecture du moteur et 2 560 séries par condition.

Les mesures du bas de l'alignement sont des scripts hors du dépôt. La phase 1 en fait `check_profondeur`.

## Ce que disent les enquêtes

| # | Constat | Le chiffre | D'où |
|---|---|---|---|
| 1 | **Les combinaisons existent et pèsent lourd** | Mal assortir ses trios à leur système coûte −2,8 V, ses paires −2,8 V, jouer sans système −5,5 V. Un coach à sa III sur une équipe bâtie pour lui vaut +6,4 à +6,9 V, contre +1,8 à +5,2 V sur une équipe mélangée | journal S79, `check_voies` |
| 2 | **On ne les voit pas** | La seule note d'équipe (« Ton alignement ≈ +0,63 but net par match », décomposée en systèmes, badges, chimie et jambes) vit dans Club › Préparation, environ 860 mots sur 4 écrans. Ni l'Effectif, ni la signature, ni « Aligner au mieux » ne la montrent. Aucun écran ne compte les joueurs de la couleur du coach. L'onglet « Ton coach » plantait (`JOUEURS_MAX`, corrigé dans la PR #169) | run jouée, `alignementDuSoir` (js/impact.js:255) |
| 3 | **On signe à l'aveugle** | La carte de la pile montre une stat et un salaire. La bande ajoute le niveau et la couleur, mais ni le rôle ni le badge (le badge n'est que dans la fiche, après défilement, en %). « Qui sort ? » ne montre que la masse de chaque case. Le joueur arrive là où une place s'est libérée : Nyquist, un Régulier T1-2, a atterri au 4e trio « hors de ses lignes ». Aucun avant/après. 12 à 16 touchers | run jouée |
| 4 | **Les systèmes sont opaques** | « Bon fit », « Fit moyen », « gain partiel » : rien ne dit ce qui manque. La Trappe affiche ✓ ✓ ✓ puis « gain partiel ». On ne compare pas deux systèmes. Le ⚠️ « un joueur mal placé » ne nomme personne, et il reste après « Aligner au mieux » | run jouée |
| 5 | **Les cartes sont longues et parlent quatre langues** | 116 cartes ont plus de 3 puces, 43 dépassent 120 caractères. Les puces disent « Tu tires moins », « ≈ +0,14 but », « 1 but tous les 25 matchs », « à peine perceptible », et des % dans la fiche. Le gros match tient en environ 400 mots sur 3 écrans. Les minutes par trio (`F`, `D`) font 8 des 10 cartes les plus chargées | inventaire |
| 6 | **Les événements ne pèsent rien** | 160 événements valent 0,03 V en médiane. 124 d'entre eux sont la même forme : un bonus, un prix, sur 2 canaux. Aucun ne lie deux joueurs | inventaire |
| 7 | **Le bas de l'alignement ne compte pas, il nuit** | Un meilleur attaquant (+12 v) rend un 4e trio PIRE : −0,32 V ±0,07. Une meilleure 3e paire défensive : +0,18 V. Au 1er trio, le même ajout vaut +1,24 V. En séries, rien ne change. Cause : la zone dépend de `v` seul (js/ratings.js:595). Un bon joueur au 4e trio paie le malus « trop bas », et ce malus est retiré aussi de sa défense (js/sim.js:576, 585, 5283) | mesure du bas |
| 8 | **Les liens de FUT sont déjà dans le code** | Même club et même saison, même franchise, même décennie (`origineUnite`, js/sim.js:1532), avec leurs puces 🧩 👬 🎽 🕰️ (js/alignement.js:415). Mais ils ne paient qu'aux gros matchs, et seulement si l'une des 7 cartes `origine` est en main. L'entente par paire de joueurs existe (`team.entente`) et ne se voit que sous un seul mot | inventaire |

**En une phrase : le moteur sait déjà ce qui fait gagner une combinaison. L'écran ne le dit nulle part, et les cartes noient le peu qu'il dit.** La V6 fait de la composition de l'effectif le jeu (le « squad builder » d'un FUT), avec une note qui bouge à chaque geste, des liens visibles entre joueurs et des cartes d'une idée.

## Les principes de la V6

1. **Une note qui bouge.** Chaque geste qui change l'équipe dit tout de suite ce qu'il change, AVANT de le confirmer : signer, sortir, permuter, changer de système. C'est un chiffre de match (« ≈ +0,63 but net par match ») et un rang dans la ligue, jamais une cote. Le calcul existe déjà et `check_chiffres` le prouve égal au moteur.
2. **Les liens se voient.** Entre deux joueurs, un lien dit pourquoi ils valent plus ensemble : le même coach, le rôle que leur système demande, la même origine, l'entente. Il se dessine sur l'alignement, comme la chimie de FUT, et il dit ce qu'il rapporte.
3. **Essayer doit payer.** Un joueur neuf se compare en un toucher : sa meilleure case, ce qu'il rapporte là, qui il pousse. Une signature ratée se défait sans tout perdre. Le jeu montre la combinaison qu'on a presque.
4. **Une carte, une idée.** Au plus deux puces, une seule langue (des mots sur la face, des chiffres de match dans « Les chiffres »), et la couleur du coach partout. Ce qui ne change pas un résultat visible part.
5. **Des événements qui lient des joueurs.** Un événement touche deux de TES joueurs nommés : un duo qui s'entend, un clash au vestiaire, un mentor et sa recrue, une rivalité. Il passe par les canaux existants (l'entente d'une paire, la mutation d'un joueur), et le lien se voit ensuite sur l'alignement.
6. **Chaque trio compte.** Un vrai checker au 4e trio, une vraie paire défensive : ça se voit au résultat, plus encore en séries. C'est une correction du moteur. Elle est mesurée en paires et jugée par `check_parts` (la production suit la vraie saison).
7. **Le moteur reste.** Aucune cote neuve. La seule retouche du moteur est celle du principe 6, jugée par ses scripts. Le reste n'est que de l'écran et des cartes.

## Le plan

**Phase 0 · Déjà fait (PR #169)**
- [x] Le nœud de la semaine dit l'état du club et ce que chaque route lui fait ; quatre routes, variées — `check_noeuds`, `essai_rogue`.
- [x] Les contrats rendent la moitié de leur ancien rabais, et les prix des packs montent de 10 % par pack acheté dans la saison — `check_rogue`, `check_packs`, `check_plafond`.
- [x] L'onglet « Ton coach » de Mes cartes ne plante plus (`JOUEURS_MAX`).

**Phase 1 · Chaque trio compte (le moteur)**
- [x] Fait le 10 oct. (moteur S107, docs/decisions.md « La défense compte ») : le levier A (le malus « trop bas » ne retire plus de défense), `K_DEFENSE` 0,05 → 0,10, le plan à domicile sur 80 % des présences. Le 4e trio défensif passe de −0,28 à +0,37 V, la 3e paire défensive de +0,15 à +0,57 V, et l'appariement aux cotes vaut 0,07 but par match contre le même à l'envers — `check_parts`, `check_monotonie` (31 V d'écart, réel 29), `check_feuilles`, `check_graine`, `check_chiffres`. Les leviers B et C restent sur la table si le bas doit peser plus.
Chaque levier a été mesuré sur une copie du moteur. Le levier choisi se mesure de nouveau dans le dépôt, avec un `check_profondeur` neuf qui rejoue le tableau du constat 7 en paires.
- **A.** Le malus « joué trop bas » ne retire plus de défense ; il ne frappe que l'attaque (`malusZoneJoueur`, son option `{ sous: 0 }` appliquée au seul `bonusDef`). Mesuré : un 4e trio défensif passe de −0,021 à +0,017 but net par match, une 3e paire de +0,019 à +0,033 ; le 1er trio ne bouge pas. Risques : `mock_zones`, `check_monotonie`, `check_pm`.
- **B.** A, plus les badges défensifs deux fois plus forts (`EFFET_ROLE` checker, deux-sens, défensif). Mesuré : 4e trio +0,024, 3e trio +0,094 (contre 0,065), 3e paire +0,032. Risques : `check_cartes`, `check_coachs`, `check_voies`.
- **C.** Un checker, un deux-sens ou un défensif est chez lui en bas : il ne paie aucun malus au 4e trio (`unitesIdeales`, `malusZoneUnite`, js/sim.js:290-336). C'est le seul levier qui donne au bas le gain du haut : +1,5 V. Risques : `check_parts` (les vrais 4e trios perdraient leurs 9 points de malus et produiraient plus que leur vraie saison) et `mock_zones`.
- Plus de glace au bas ne suffit pas : avec le roulement profond, le gain passe seulement de +0,132 à +0,146.

**Phase 2 · La note qui bouge**
- [x] (Corrigé le même jour, JP : *un trio défensif pourrait être hyper pertinent et utile et dans les moins*. La note n'est plus un +/− brut : c'est ce que l'unité fait de plus qu'une unité neutre à sa place, face aux mêmes adversaires — son attaque, et les buts que sa défense évite. Le trio Gainey-Carbonneau de 1985-86 sort premier de son club, +0,19 dont +0,15 en défense.) Derrière le banc, l'en-tête de chaque trio et de chaque paire porte son différentiel attendu à forces égales contre le prochain adversaire (« −0,43 », en vert ou en rouge), à la place des points additionnés de leurs vraies saisons. JP : *les buts pour, sur l'effectif, ça veut rien, pis c'est pas influencé par la stratégie on dirait, bouger un joueur bouge juste sa production un pour un*. La lecture du soir compte, lancer par lancer, l'unité de ton club qui attaque et celle qui défend (`pMoyenDuLancer`, js/sim.js, sans un dé de plus) ; la somme des trios et celle des paires valent le différentiel du club — js/impact.js `unitesDuSoir`, js/alignement.js — `check_impact` (5), `check_chiffres`, `check_graine`.
- En tête de l'Effectif : « ≈ +0,63 but net par match · 9e de la ligue », décomposé d'un toucher en systèmes, badges, chimie, jambes et coach (`alignementDuSoir`). Le même chiffre par trio et par paire, à côté de son étiquette.
- À la signature : chaque case de « Qui sort ? » porte ce que la signature y changerait (« ≈ +0,12 », « ≈ −0,05 »), calculé par `lignesEnChiffres` sur les mêmes dés. La meilleure case arrive en premier, et un toucher de plus montre l'avant/après.
- La carte de la pile montre son rôle et son badge (« 🎯 Sniper Or »), et la couleur de son coach.
- Le ⚠️ nomme le joueur mal placé et sa bonne case. Le système nomme ce qui lui manque (« il manque un passeur au centre »). Deux systèmes se comparent côte à côte, en chiffres de match.
- Preuves : `check_chiffres` (ce que l'écran annonce égale ce que le moteur joue), smoke `sansCote`, `sansDebordement`, `essai_rogue` (touchers du pack à l'alignement : 6 au plus).

**Phase 2b · Le jeu des trios : l'appariement et le contre**
JP : *donner des stratégies à chaque trio et devoir construire autour de ça, avec matching de trios à domicile pour l'équipe, selon sa stratégie, humain et ai* ; *tu choisis le matching de trio dans une liste, et la répartition du temps dans une autre, overall, au lieu de par ligne. À l'étranger, l'adversaire fait de même* ; l'IA *contre*.
- [x] Le moteur : la décision `appariement` (contre leur trio r, ton trio m) ; seul le plan de l'équipe à DOMICILE joue, sur `PLAN_DOMICILE` (60 %) de ses présences à forces égales ; l'IA qui te reçoit a son plan (`planDeLIA` : contre ton trio le plus dangereux, le trio dont le système bat le tien, sinon son meilleur en défense). Sans plan, aucun dé de plus — js/sim.js, version du moteur S106 — `check_graine`, `check_parts`, `check_feuilles`, `check_chiffres`.
- [x] **Le contre, abandonné** (JP : *je comprends pas le contre, dans ma tête, c'est les joueurs et leurs cotes qui gèrent ça*). `CONTRE_SYSTEME` reste à 0 ; ce sont les joueurs sur la glace qui décident (phase 1). Ce qui avait été mesuré : Mesuré en paires par la lecture du moteur (30 paires de vrais clubs) : aujourd'hui l'appariement ne pèse presque rien — l'IA avec son plan +0,007 but par match, un plan pensé chez toi +0,013, un plan à l'envers +0,025 (ce que ton 1er trio gagne contre leur 4e, ton 4e le perd contre leur 1er). Le contre d'un système n'étouffe que l'action spéciale, et la défense d'une unité ne change un lancer que de 5 % par écart-type. `CONTRE_SYSTEME` (0 dans le jeu) étouffe tous leurs lancers de la présence : à 15 %, l'IA avec son plan +0,046, ton plan pensé +0,064 (≈ +0,4 V sur 41 matchs à domicile) ; doubler `K_DEFENSE` seul ne donne que +0,019. Le vrai gain viendra de bâtir des trios pour le système qui bat le leur ; la mesure ne le compte pas encore.
- [x] L'écran (fait, l'onglet Équipe) : deux listes au niveau du club, dans l'Effectif — l'appariement (« contre leur 1er trio : mon trio… ») et le roulement (la glace, qui existe déjà en trois réglages) ; la glace par ligne quitte la fenêtre du système. Au dépistage, le plan de l'IA chez elle se voit avant le match.

**Phase 3 · Les liens**
- Sur l'alignement, entre deux joueurs d'une même unité, un lien dessiné : 🐢 le même coach, ✓ le rôle demandé par le système, 🧩 👬 🎽 🕰️ l'origine, 🤝 l'entente. Chaque lien dit ce qu'il rapporte, et le résumé compte « 🐢 7 joueurs de la Tortue ».
- **À trancher** : les origines paient-elles tout le temps (un petit bonus de chimie par lien, par la `chimieLigne` existante), ou restent-elles réservées aux 7 cartes `origine` du gros match ? Qu'elles paient en permanence est le geste le plus « FUT » du plan : un fan cherche le duo Lemieux-Jagr de 1995-96.
- Preuves : `check_chimie` (neuf ou étendu), `check_parts`, `check_clarte` (une icône = un sens).

**Phase 4 · Une carte, une idée**
- Deux puces au plus par carte, dans une seule langue : sur la face, ce que la carte fait en mots ; dans « Les chiffres », ses chiffres de match. Les minutes par trio deviennent UNE puce (« Le haut joue plus · 4 matchs »). La couleur du coach apparaît sur toute carte, partout, le gros match compris.
- Les événements passent de 160 à environ 40 : on garde ceux qui changent un résultat visible (`check_cartes` en paires) et on coupe les doublons « bonus + prix ».
- Le gros match tient en un écran : l'intention adverse, ta main, l'enjeu.
- Preuves : `check_clarte` (une puce de trop échoue), `check_combat`, `check_cartes`, `check_banque`.

**Phase 5 · Des événements qui lient des joueurs**
- Une famille neuve d'événements, tirée de TON effectif et nommée : le duo (deux compagnons de trio qui s'entendent : l'entente de leur paire monte), le clash (deux joueurs qui ne se parlent plus : leur entente baisse, à séparer ou à réconcilier), le mentor (un vétéran et une recrue de la même position : le badge de la recrue progresse), la rivalité (deux joueurs pour une case : l'un monte s'il joue).
- Chacun passe par un canal existant (`entente`, une mutation, le mentor `_palierTrio`). Le lien se voit ensuite sur l'alignement (phase 3) et dans les fils de la saison (`filsDeSaison`), et ses chiffres viennent des feuilles jouées (`check_fils`).
- Preuves : `check_vie`, `check_fils`, `check_graine` (le tirage passe par `hasard()`).

**Phase 6 · Essayer doit payer**
- **À trancher** : un joueur signé en saison est « à l'essai » pendant cinq matchs. Le relâcher pendant l'essai rend une part du pack en jetons, et sa carte reste au cartable. C'est une décision de ballottage qui existe déjà, avec un remboursement de plus.
- Le jeu montre la combinaison qu'on a presque : « un passeur de plus au 2e trio et ta Trappe joue à 100 » (`fitDeCase`).

## Les points à trancher par JP

1. **Le bas de l'alignement** : le levier A, B ou C (phase 1).
2. **Les origines** : paient-elles tout le temps, par la chimie, ou seulement par les cartes du gros match (phase 3) ?
3. **Les événements** : passer de 160 à environ 40, et ajouter la famille qui lie tes joueurs (phases 4 et 5) ?
4. **L'essai** : un joueur signé en saison peut-il se relâcher pendant cinq matchs contre un remboursement partiel (phase 6) ?
5. **L'ordre** : la phase 2 d'abord (la note qui bouge, sans toucher au moteur), puis la 1 ? Ou la 1 d'abord ?
