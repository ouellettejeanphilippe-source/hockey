# Coachs, personnel, cartes, incidents et décisions : quatre façons de refaire le système

27 octobre 2026. Avant de coder, lu dans le code du jour (HEAD fcb5627) : js/coachs.js, js/personnel.js, js/echelons.js, js/banque.js, js/packs.js, js/dossiers.js, js/arcs.js, js/vie-gm.js, js/noeuds.js, js/scenes.js, js/saison.js (`messagesCourants`, `specsForces`), js/gerant.js (`optionHtml`, `sceneDuDe`), js/sim.js (`preludeDuJour`, `jouerJournee`, `SITUATIONS`, `MOMENTS`, `FAITS`). La liste des 118 accrocs (docs/carte-des-rouages.md) date du 3 octobre : une bonne part est tombée avec la V16 (les places, l'équipement, le cahier) et la V18 (les systèmes). Ce qui tient encore est nommé ici.

## Ce qui est vrai aujourd'hui

**Le coach.** Neuf philosophies (`COACHS`), huit choisissables (`VOIES` ; le Comptable 🏦 est une couleur de carte, pas un coach). Un seul en poste, décision `coach`. La confiance se compte en points : `coachsDeBase` (3 au départ), +1 par échelon de chaque adjoint de sa couleur en poste, +1 par 60 matchs à ton service (`buildDe`, js/banque.js). Le « système appris à la II » n'existe plus depuis la V9 : les paliers sont des canaux seulement. La couleur d'une carte se lit sur ses canaux (`coachDesCanaux`), celle d'un joueur sur son meilleur rôle (`coachDesRoles`). Le dépisteur du coach lit bien la couleur depuis la v2 (`recrue`, js/packs.js:356) : l'accroc du 3 octobre est réglé ; ce qui reste faux, c'est `COACHS[].recrute`, un texte à la main (« des plombiers », « la jeunesse ») que personne ne recompte, et `check_clarte` ne vérifie pas que ce texte dit la couleur. « 3 cartes jouées » n'est plus affiché ; ce qui reste : « N cartes de sa couleur » dans le choix du coach (`optionsDeCoach`), l'infobulle « fait grandir les cartes de sa couleur » (js/game.js:995, aucune carte ne grandit plus), « tes cartes jouées viennent ici » (js/saison.js:2387), et le commentaire « trois cartes au compteur » (js/banc.js:644). Les règles ne décrivent les coachs que dans « Le mode Rogue » (index.html:505), mais la confiance tourne dans tous les modes.

**Le personnel.** 56 cartes (54 `per_*`, 2 `dir_*`), huit postes (`ROLES`), une par poste. Aucun champ `coach` ni `force`/`défaut` : tout est dérivé des canaux (`forceEtFaiblesse`, `aUnDefaut`). Un modèle déjà unique ; ce qui accroche, c'est le nom du poste « Entraîneur-chef » (un poste que « Le superstitieux » peut tenir, confondu avec ton coach), « Le coach de sprint », et la voix « Ton adjoint » du duel (`EXPEDITEURS.ad`), qui n'est aucun de tes adjoints.

**Les cartes gardées.** Le personnel (en poste ou en attente à ta collection) et dix cartes rares. Rien d'autre ne se garde.

**Les incidents : huit sources, cinq formats, trois horloges.**

| Source | Table | Quand | Tirage | Fait vrai ? | Choix ? | Scène ? |
|---|---|---|---|---|---|---|
| Situations du vestiaire | `SITUATIONS` js/sim.js | matchs 10/28/46/64 | `melangeurSitu` (moteur) | non | non (une nouvelle) | non |
| Accidents | `MUTATIONS` source accident | matchs 7/22/37/55/74 | `melangeurSitu` (moteur) | non | non | non |
| Dilemmes | `MOMENTS` js/sim.js + `MOMENTS_VIE` | jours 8/14/25/33/42/51/60/70 | `momentDuJour` (écran, hachage pur) | oui (`FAITS`) | oui, dé possible | oui |
| Séquences | `SEQUENCES` | sur une série | hachage | oui | oui, dé | non |
| Dossiers | `DOSSIERS` js/dossiers.js | lundis pairs | `hache` (écran) | oui (`faitsDuLundi`) | oui | oui |
| Routes | `ROUTES`, `CARTES_DE_ROUTE` js/noeuds.js | lundis impairs | `hache` | moment possible | oui | oui |
| Vie du DG (courriels, presse) | `REPONSES_VIE` js/vie-gm.js | tous les 8 matchs | hachage | occasion | oui, pari sans dé | non |
| Fils | `CHOIX_DES_FILS` js/vie-gm.js | quand un fil naît | journal | oui | oui, suivi | non |
| Arcs, défis | `ARCS`, `DEFIS` js/arcs.js | ≤ 5 par saison | `episodesDuMatin` (moteur) | oui (`faitsDuMatin`) | non | non |
| Avant gros match | `AVANT_GROS` js/sim.js | le matin du gros match | `hacherMise` | ses propres faits | oui, dé | non |
| Objectif du proprio | `OBJECTIFS` | jours 0 et 41 | hachage | — | oui | non |
| Blessure, retour, physio, trou | js/ballottage.js | sur la blessure | — | oui | oui | blessure seulement |

Trois rendus d'une option : `optionHtml` (À faire, duel), la branche `carteHtml` d'`ouvrirChoix` (quand `spec.cartes`), et les boutons du duel écrits à la main (js/gerant.js:1263). Un pari se dit de trois façons avant le choix (les faces du dé par `facesMot`, une phrase à la main « Une chance sur deux », le % de `motDeChance` pour l'objectif), se lance de deux façons (la modale `sceneDuDe` quand `spec.lancer`, direct avec un `sel` pour les courriels), et s'annonce de trois (Hier soir, le journal, le direct).

**Un bogue de graine, trouvé en passant.** `melangeurSitu` et `momentDuJour` font `Number(graine) >>> 0`. La graine d'une partie est en base 36 (`nouvelleGraine`) et celle du matin est `graine:dé` : `Number` donne NaN, donc 0. Les situations, les accidents et les dilemmes ignorent la graine : toutes les runs tirent les mêmes aux mêmes jours (seuls `deja` et les faits les font varier). `check_graine` ne le voit pas : la même graine rejoue bien la même saison, parce que la graine ne compte pas. À régler dans la tranche 2 (une vérité des chiffres : « la même graine » doit vouloir dire quelque chose) ; la correction change ce qu'une graine tire, pas le format des sauvegardes.

## Quatre façons de refaire

Les tranches 1 (lexique) et 2 (vérité des chiffres) sont les mêmes dans les quatre : elles ne bougent aucune mécanique. Les propositions se distinguent à partir de la tranche 3.

### A. Le minimum qui tient : un seul format, rien ne bouge sous la glace

- **Coach** : inchangé. On corrige les mots (« N cartes de sa couleur », l'infobulle, les règles hors Rogue), `COACHS[].recrute` devient calculé (les rôles de `COACH_DU_ROLE`), `check_clarte` le vérifie.
- **Staff** : inchangé. Le poste `chef` s'affiche « L'adjoint en chef », « Le coach de sprint » devient « L'adjoint de sprint ».
- **Incident** : un adaptateur `incidentDe(source, item)` (js/incidents.js) qui met chaque table existante dans le même objet `{ voix, sujet, fait, scene, options, pari, maison, bloque }` ; `messagesCourants` ne fait plus que les concaténer. Les tables restent où elles sont, leurs tirages aussi.
- **Décision** : `optionHtml` devient le seul rendu ; la branche `carteHtml` et les boutons du duel passent par lui. Un seul rendu du pari (`pariHtml` : les faces, le gain, le prix), un seul lancer (`sceneDuDe` pour tout pari, courriels compris), un seul mot au résultat.
- Coût : petit. Risque : petit. Ce qu'il ne règle pas : les sources restent huit, chacune avec son horloge et son tirage ; les situations et les accidents restent des nouvelles sans choix ; la couleur du coach ne touche toujours ni les incidents ni le duel.

### B. Le coach porte tout : sa couleur traverse le jeu

Tout A, plus :
- **Coach** : sa couleur est lue partout où le jeu choisit pour toi. Le dépisteur (déjà), le Pack du coach (déjà), et en plus : les adjoints offerts aux paliers et au butin tirent d'abord sa couleur (deux sur trois), les incidents de sa couleur sortent plus souvent (un dossier a une couleur comme une carte, lue sur les canaux de ses options), et **ton adjoint du duel est ton adjoint en chef** : la voix `ad` devient la carte en poste au poste `chef` (sa force colore les plans qu'il propose ; sans adjoint en chef, une voix neutre, deux plans au lieu de trois). La confiance : inchangée dans ses trois chemins ; les règles la disent dans la section Coach, hors Rogue, puisqu'elle y tourne.
- **Staff** : un poste par rôle, et chaque poste a une raison d'exister au duel ou aux incidents : le chef propose les plans, les soins répondent aux blessures (le physio, le rappel), le dépistage dit le pronostic, la direction parle au proprio. L'adjoint d'un poste signe les incidents de sa maison (la voix d'un incident de blessure est ton adjoint aux soins s'il existe).
- **Incident** et **Décision** : comme A.
- Coût : moyen. Risque : `check_duel` (les plans proposés changent de distribution), `check_coachs` (la couleur des dossiers est neuve, à mesurer en paires), `check_places`. Ce qu'il règle : « le système d'entraîneur et adjoints est tout brisé » devient un système où le coach et son staff se voient dans chaque choix.

### C. Deux piles : la Main et la Boîte, un seul tirage du matin

Tout A, plus la règle gardée prise au sérieux : « je le garde pour plus tard » = carte, « ça n'existe que par un fait » = incident.
- **Incident** : **une seule table** `INCIDENTS` (js/incidents.js) qui absorbe les dilemmes, les séquences, les dossiers, les courriels et la presse, les choix des fils, l'avant-gros-match et l'objectif du proprio. Chaque incident : `{ cle, voix, maison, fait: FAITS[...], quand(f), scene, options, suivi? }`. Les situations du vestiaire et les accidents **deviennent des incidents avec un choix** (une situation : « Le vestiaire est galvanisé par X » offre d'en profiter ou de calmer ; un accident offre le jouer blessé, le physio ou le repos) ou disparaissent dans la blessure s'ils n'ont rien à demander. Les arcs restent des faits sans choix (un défi), mais passent par le même format d'affichage.
- **Un seul tirage, au moteur** : `preludeDuJour` tire l'incident du matin (`deDuJour`, `graineDuMatin`), plus aucun hachage côté écran. Une horloge au lieu de trois : un incident par lundi, un petit entre deux lundis quand un fait le force (la blessure, le fil, la séquence), le gros match le jour dit. `check_graine` et `check_instantane` tiennent par construction (le moteur tire, la décision ne consomme rien).
- **Décision** : un composant, `decisionHtml` (la voix, le fait, les options `optionHtml`, le pari `pariHtml`), rendu à une seule place : la fenêtre À faire. Le duel y passe aussi pour ses entractes.
- **Main** : le personnel en attente et les dix rares, affichés ensemble, « Ta main », à l'Entraîneur et à l'Effectif selon ce qu'ils montent (déjà le cas).
- **Routes** : la carte d'une route est une carte (on la garde pour sa semaine) : elle passe à la Main ; la route elle-même reste un incident du lundi impair.
- Coût : gros (sept tables, sept ouvreurs, `check_dossiers`, `check_dilemmes`, `check_vie`, `check_fils`, `check_noeuds`, `check_situations` à refondre en un `check_incidents`). Risque : les sauvegardes (les paliers `m:`, `do:`, `vie:`, `fil:`, `n:` restent des clés lues ; une saison en cours d'avant la refonte garde ses décisions, mais ses incidents à venir changent). Ce qu'il règle : les six sources deviennent une, le même jour, la même graine, le même écran.

### D. Rebâtir comme un jeu de gestion : le coach est une personne

Tout C, et on change le modèle :
- **Coach** : l'entraîneur-chef est une carte de personnel au poste `chef`, avec sa philosophie (une des neuf couleurs) et ses échelons comme les autres ; « le coach » cesse d'être une entité à part. La confiance I/II/III devient **sa crédibilité**, gagnée par les mêmes trois chemins (son staff de sa couleur, ses échelons, ses matchs), et c'est elle qui ouvre ses paliers de canaux (`paliers[3]` inchangés). Le congédier, c'est remplacer la carte.
- **Staff** : les sept autres postes, sous lui ; un adjoint de sa couleur compte double, un mal assorti coûte (`MAL_ASSORTI`, déjà là).
- **Incident**, **Décision**, **Main** : comme C.
- Coût : le plus gros. Risque : `check_coachs` et `check_voies` à récrire (le coach mesuré sur son équipe devient une carte mesurée), la décision `coach` et `coachsDeBase` restent des clés de sauvegarde à relire en « carte au poste chef », le choix du coach au départ devient le choix de sa carte (un loto de trois). Ce qu'il règle : « coach » n'a plus qu'un sens, à l'écran comme dans le modèle ; EHM et New Star Soccer s'y retrouvent.

## Ce que je recommande

**C, avec le duel de B** (ton adjoint du duel = ton adjoint en chef), en gardant le coach comme il est (D plus tard, si le mot « coach » accroche encore après C). C est ce que le plan en sept tranches décrit déjà ; B ajoute la seule pièce qui manque pour que le staff se voie dans le jeu sans refaire le modèle du coach. D change la mesure (`check_coachs`, `check_voies`, vingt minutes de calibration chacune) pour un gain de vocabulaire que la tranche 1 obtient déjà en renommant le poste.

## Le lexique de la tranche 1, mot par mot (l'affichage seulement, jamais une clé)

| Mot ou icône | Garde ce sens | Ce qui change (affichage) |
|---|---|---|
| coach | la philosophie, un seul en poste | le poste `chef` → « L'adjoint en chef » ; « Le coach de sprint » → « L'adjoint de sprint » ; le dossier « La tête de l'entraîneur » → « La tête du coach » ; « Ton coach paie le Tir » → « Ton coach mise sur le Tir » ; la voix `ad` → « L'adjoint en chef » |
| entraîneur | la personne derrière le banc (arcs, commentaire) | l'onglet « Entraîneur » du Bureau → « Coach » (c'est sa maison) ; `EXPEDITEURS.en` reste « L'entraîneur » pour ce que le banc dit |
| adjoint | une carte de personnel | — |
| vestiaire | la pièce et l'équipe ; au repêchage, le vestiaire d'une vraie équipe | l'exigence « Le vestiaire mince » → « L'effectif mince » ; « Le vestiaire t'attend » (direct) → « L'entracte » ; l'onglet de bilan « Vestiaire » → « L'équipe » |
| classeur | le tirage du cartable au départ d'une run | « Budget du classeur » → « Budget des lotos » ; l'onglet `classeur` de la banque (clé) s'affiche « La banque » (déjà) |
| plombier | le rôle 🪠 | `COACHS.souffle.recrute` « des plombiers » → calculé : « des joueurs de souffle » ; l'archétype `ENERGY` « Plombier » (js/ratings.js) → « Moteur » si visible |
| contrat | le salaire au plafond | — (l'année de contrat et le contrat d'entrée en sont) |
| écusson | le logo du club | la clé `ecussons` reste, l'écran dit toujours médailles 🏅 ; vérifier que 🏅 ne sert plus d'icône au rayon « Ton club » |
| rejouer | les mêmes clubs, d'autres dés | l'exhibition « ↻ Rejouer » → « Revanche » |
| 🛡️ | le trait Selke | le rôle « Défenseur physique » → 🧱 ; la stat d'équipe « Défense » → 🔒 ; « Bloquer des tirs » (combat) → 🧍 ; ou l'inverse, à ton choix, un seul garde 🛡️ |

`js/lexique.js` : la table ci-dessus en code (`LEXIQUE[mot] = { sens, exemples, interdits }`), lue par `scripts/check_lexique.mjs`, qui lit chaque chaîne visible de js/ et d'index.html (`scripts/lib/chaines.mjs`, déjà là pour `check_clarte`) et refuse un mot hors de son sens, une icône à deux sens. `check_clarte` § 1 et 2c y déménagent.

## La tranche 2, ce qu'elle vérifie (un test par accroc)

Chaque ligne : ce que l'écran dit, ce que le moteur joue, le test.

- La graine compte pour les situations, les accidents et les dilemmes (le bogue ci-dessus) : `check_graine` ajoute « deux graines, deux dilemmes au jour 8 ».
- « N cartes de sa couleur » → le compte réel d'adjoints de sa couleur (`idsDuCoach` filtré sur `patron:`), ou rien.
- L'infobulle « fait grandir les cartes de sa couleur » → ce que `porteParSesJoueurs` fait vraiment (« ta confiance joue 10 % plus fort par joueur de sa couleur habillé, jusqu'à 24 paliers »), chiffres tirés de `JOUEUR_COACH`, `PALIERS_COACH_MAX`.
- La pitié : « au plus tard au 13e » = `PITIE + 1` et `packsSansHolo >= PITIE` : cohérents aujourd'hui, à verrouiller par un test (le 3 octobre, ça décalait d'un pack).
- Les journées contre les matchs : les paliers des adjoints sont aux matchs 9/18/26 (`PALIERS_PACK`), la main du deck aux journées 20/40/60 (`PALIERS_CARTES`) : les règles et chaque étiquette disent la bonne unité ; un test lit les deux constantes.
- Le plafond effectif : ce que la barre du plafond montre = `plafondDe(G)` avec les exigences et le prestige ; un test par cran d'exigence.
- La zone et le badge net contre brut : à revérifier sur le code du jour (« −3 par cran » n'existe plus dans js/game.js ni js/fiche.js), le test garde ce que la fiche affiche égal à ce que `check_fiches` recompte.
- `COACHS[].recrute` = la couleur que `recrue` recrute vraiment.

## Plus simple, plus impactant, plus le fun à jouer (JP, 27 oct.)

Les quatre modèles ci-dessus rangent le code. JP ajoute la vraie contrainte : *faut que ça soit plus simple, plus impactant et plus le fun à jouer*. Ce que ça veut dire, mesuré dans le jeu d'aujourd'hui :

- **Trop de compteurs.** Une confiance en points par trois chemins (adjoints, échelons, 60 matchs), cinq échelons à chaque adjoint, huit postes, onze sources d'incidents sur trois horloges, deux monnaies, le prestige, les exigences. Le joueur ne peut pas tenir ça dans sa tête ; il clique.
- **Trop peu d'effet.** Un adjoint au premier échelon est un échange à zéro par construction (V14b) : il change le style, pas la force. Un dossier vaut au plus ±1 V. Le coach à la I vaut +2 V. Rien de ce qu'on touche ne se sent dans la fiche de la semaine.
- **Pas de tension.** Un choix a souvent trois options qui se valent (« Cadeau », « Échange », « Moindre mal »), le pari se dit en petites lignes, le verdict arrive sans qu'on l'attende.

Trois directions de jeu, cumulables ; chacune se mesure avec les scripts qui existent.

### 1. Moins, mais gros

- **Quatre sources, pas onze** : le lundi (un seul incident, toujours avec un choix), la blessure, le fil (une histoire qui naît des feuilles), le gros match. Les situations et les accidents partent (ou deviennent le lundi) ; les courriels, la presse et les séquences fondent dans le lundi ; l'objectif du proprio est le mandat, rien d'autre ; les arcs restent des défis de joueur (un but, sa stat, sa récompense gravée), sans message.
- **Deux options par choix, trois au plus** : une sûre, une risquée avec son dé. Jamais trois « échanges ».
- **Quatre ou cinq postes, pas huit** : le chef (il propose les plans du duel), l'attaque, la défense, les gardiens, la santé. Le dépistage et la direction deviennent des dossiers du proprio, pas des cartes.
- **Trois échelons, pas cinq**, aux mots des badges (Bronze, Argent, Or), achetés en jetons ; les « matchs à ton service » partent (un compteur qu'on attend, pas qu'on joue).
- **Un adjoint rapporte, dès le premier échelon** : net positif, sous la borne de sa rareté (commune +0,5 V, rare +1,5 V, Or ×2), un défaut qui se voit mais ne l'annule pas. C'est la décision ouverte que le journal du 26 octobre note (*chaque carte de personnel reste un échange à zéro*). Mesure : `check_places`, `check_personnel`, `check_effets` avec les bornes montées.
- **La main plafonnée** : cinq cartes en attente, le reste se vend. Une décision par carte de trop, pas un inventaire.

### 2. Le build qui se voit

Le plaisir d'un roguelike, c'est un build qui s'emboîte et qu'on voit grandir.

- **Chaque coach a UNE stat signature** : le Frelon les tirs, la Tortue les tirs contre, l'Aigle la précision, le Rhino les mises en échec, le Doc les jambes, l'Abbé les punitions, le Contremaître la 3e et la 4e ligne, le Showman la 1re. L'écran Coach montre cette stat en grand, ta moyenne contre la ligue, jour après jour. Pas de « confiance I/II/III » en points : **la confiance monte quand sa stat signature est tenue** (dix matchs au-dessus de la ligue → II ; vingt → III). On comprend quoi faire, et chaque match y contribue.
- **La couleur s'additionne et se lit** : joueurs de sa couleur habillés + adjoints de sa couleur = un multiplicateur affiché en une ligne (« ×1,4 ce soir »), le même que le moteur joue (`porteParSesJoueurs`). Le dépisteur, le Pack du coach, les adjoints offerts aux paliers tirent sa couleur deux fois sur trois.
- **Des combos nommés** : le feu existe déjà (quatre adjoints, `check_combo`). Un combo par coach, trois adjoints qui ensemble ouvrent un effet qui casse (le droit du Rogue, principe 5), annoncé sur la carte : « Avec le géomètre et l'aiguiseur : la lancée vive ». Trois adjoints de sa couleur en poste = la III d'office.
- **Ton adjoint en chef propose les plans du duel**, à sa couleur, à son échelon : un Or propose trois plans, un Bronze deux.
- Mesure : `check_coachs`, `check_voies` (+6 à +8 V à la III, inchangé), `check_duel`, `check_combo`.

### 3. Chaque lundi, une histoire

- **Un seul incident par lundi**, avec sa scène (la voix, le fait en vrais chiffres, sa réplique), deux options, et **son verdict le lundi d'après**, en vrais chiffres de tes feuilles (« Tu as misé sur le quatrième trio : 3 buts en 4 matchs, le pari a payé »). Le suivi existe (`check_suivis`) ; il devient la règle, pas l'exception.
- **Le pari se voit toujours pareil** : un dé qu'on lance à l'écran, ses faces gagnantes, le gain et le prix en deux lignes, à chaque pari (dossier, duel, fil), jamais en « une chance sur deux » à la main.
- **Hier soir nomme ce que TES choix ont fait** : l'adjoint, le coach, le choix du lundi dans les causes d'un but (`check_causes` le fait déjà pour les cartes) ; une ligne « Ta semaine » le lundi : ce que ton build a rapporté en tirs, en buts, en victoires.
- Mesure : `check_incidents` (le format unique), `check_suivis`, `check_causes`.

### Ce que je propose de faire

La structure **C + le duel de B** (le code), et le jeu **1 + 2 + 3** dessus, dans les tranches déjà prévues :

| Tranche | Le code (C + B) | Le jeu (1, 2, 3) |
|---|---|---|
| 1. Lexique | js/lexique.js, check_lexique | les mots d'un seul sens |
| 2. Vérité des chiffres | chaque écran lit le moteur ; la graine compte | — |
| 3. Coach | la couleur lue partout | la stat signature, la confiance par cette stat, le multiplicateur affiché |
| 4. Staff | un modèle de poste | cinq postes, trois échelons, net positif, un combo par coach, le chef au duel, la main à cinq |
| 5. Incidents | une table, un tirage du matin | quatre sources, un lundi, deux options |
| 6. Décision | un composant, une fenêtre | le dé toujours, le verdict le lundi d'après, « Ta semaine » |
| 7. Anciennes parties | check_sauvegardes | ce que la banque ne connaît plus s'ignore |

Ce qui se jette avec 1 : les 40 réponses de dossiers récrites le 26 octobre fondent dans un lundi plus court (une vingtaine d'incidents, deux options chacun), les courriels et la presse (js/vie-gm.js, 1 000 lignes) partent, trois postes et deux échelons partent, et les règles du Rogue raccourcissent d'autant.

## Tranché (JP, 27 oct.) : *je veux que le club se construise autour du coach*

Le coach est LA décision de la run ; tout le reste en découle et se lit depuis lui :

- **Le choix du coach ouvre la run** : sa stat signature, sa couleur, son combo, affichés avant de choisir ; le choisir, c'est choisir comment le club jouera.
- **Le recrutement est le sien** : le dépisteur, les packs de joueurs, le classeur et les lotos tirent sa couleur d'abord (deux sur trois) ; un pack dit combien de joueurs de sa couleur il contient.
- **Le staff est le sien** : les adjoints offerts (paliers, butin, packs) sont de sa couleur deux fois sur trois ; un adjoint de sa couleur compte double, un mal assorti coûte (déjà `MAL_ASSORTI`) ; son combo, trois adjoints de sa couleur, se voit sur chaque carte.
- **La confiance, c'est sa stat tenue** : I au départ, II et III quand sa stat signature bat la ligue assez de matchs ; l'écran Coach la montre en grand, chaque matin.
- **L'alignement se lit à sa couleur** : chaque joueur habillé de sa couleur monte le multiplicateur affiché (« ×1,4 ce soir »), le même que le moteur joue.
- **Les incidents lui parlent** : le lundi, l'incident tiré est de sa couleur une fois sur deux (lu sur les canaux de ses options), et son adjoint en chef propose les plans du duel.
- **Le congédier, c'est rebâtir** : un dossier du proprio, un prix lourd, et le recrutement, le staff et la confiance repartent de I.

Le code : le modèle C avec le duel de B. Le jeu : les directions 1, 2 et 3, le coach au centre. Les tranches 1 et 2 partent maintenant.

## Tranché (JP, 27 oct.) : *un événement peut avoir un fort impact pour un joueur, sans que ça fasse chier le reste du système*

**Trois cibles, une principale.** Un incident vise d'abord un joueur nommé, le staff (le coach ou un adjoint) ou l'équipe, et il en a toujours une principale :

| Cible | Ce que l'incident touche | Taille permise |
|---|---|---|
| **Le joueur** | ses canaux (`CANAUX_MUT` : lancers, finition, création, défense, blessure, arrêts), sa lancée, un galon, sa carte | **forte** : sa ligne peut bouger de moitié pour quelques matchs (le feu de `EN_FEU` vaut déjà ×1,45 en finition pendant huit matchs) |
| **Le staff** | la confiance du coach, l'échelon ou le protégé d'un adjoint, un congédiement | moyenne : un cran, jamais deux |
| **L'équipe** | les canaux d'équipe, les jambes, les punitions | **petite** : l'écho de ce qui arrive au joueur, jamais l'effet lui-même |

**Pourquoi un gros effet sur un joueur ne casse rien.** La borne ne se met pas sur sa ligne, elle se met sur le net en victoires de l'équipe, qui reste sous celui de la rareté de l'incident (`check_arcs` le mesure déjà en blocs appariés : ±1,5 V pour un arc). Un joueur ne joue qu'une part de la glace : sa finition ×1,45 pendant huit matchs rapporte des buts à son compte et ne déplace l'équipe que de quelques dixièmes. La production se répartit comme la vraie saison l'a répartie (`check_parts`) : sa part monte, celle de ses compagnons de trio baisse d'autant. Il reste vrai que l'effet se voit dans Hier soir, par son nom, en vrais chiffres.

**Ce que ça change dans le devis.**
- Le format unique de la tranche 5 porte `cible: 'joueur' | 'staff' | 'equipe'` ; `check_incidents` refuse un incident sans cible principale et mesure, en paires, que le net d'équipe tient sous la borne de sa rareté.
- Le budget d'un joueur nommé monte pour un incident (la règle de CLAUDE.md, ±0,3 point, ±0,15 but ou ±1 tir à sa ligne, vaut pour une CARTE, qui joue tous ses soirs) : un incident qui dure huit matchs a droit à ±1 point, ±0,5 but ou ±3 tirs à sa ligne. À confirmer par la mesure avant de toucher CLAUDE.md.
- Le staff répond au joueur : le coach dit comment il le prend (sa couleur colore l'option), l'adjoint de son poste peut le protéger (`PROTEGES`). C'est ce qui lie les trois niveaux sans les additionner.
- Les incidents d'équipe pure (la raclée, le calendrier chargé) restent petits et ne sont jamais seuls : ils viennent avec un joueur qui les porte.

## Précisé (JP, 27 oct.) : *les incidents, toujours liés à des joueurs ; le staff, le style de jeu et les perks du DG ; des dates pour que ça joue plus*

Ceci remplace le tableau « trois cibles » de la section précédente : l'incident n'a plus qu'une cible, un joueur.

### La règle : trois canaux séparés, trois budgets séparés

| Ce qui bouge | Qui le bouge | Quels canaux | Budget |
|---|---|---|---|
| **Un joueur** | un **incident**, toujours | ses canaux seulement (`CANAUX_MUT` : lancers, finition, création, défense, blessure, arrêts), plus sa lancée, ses jambes, un galon | **fort** sur lui, borné par la durée et par le net d'équipe (`check_arcs`, `check_parts`) |
| **Le style de l'équipe** | le **coach** et les **adjoints** | les canaux d'équipe (volume, défense, discipline, jambes, blessures) | petit et permanent : `AMPLEUR_STYLE`, ±0,5 V au premier échelon (`check_places`) |
| **L'économie du club** | la **direction** (les perks du DG) | les jetons par victoire, les rabais, le plafond (`econ`) | ne touche jamais le match |

Un incident n'écrit **jamais** dans les canaux d'équipe, et le staff n'écrit **jamais** dans les canaux d'un joueur (sauf son protégé, qui est un joueur désigné). Les budgets ne se marchent pas dessus par construction : on peut mettre un gros effet sur un joueur sans toucher à l'équilibre du style, ni à celui de l'argent. `check_incidents` le vérifie sur le format : chaque incident a un `joueur`, ses effets sont dans `CANAUX_MUT`.

### Un incident d'équipe trouve son joueur

Un fait d'équipe se lit toujours dans les feuilles par quelqu'un. L'incident s'accroche à lui :

| Fait d'équipe | Le joueur qui le porte |
|---|---|
| Une raclée, une série de défaites | le gardien partant (ses buts accordés), ou le capitaine |
| Une disette | le meneur du club, ou le marqueur en panne (le doute) |
| Trois soirs sur la route, un dos-à-dos | le plus bas en jambes |
| L'infirmerie qui déborde | le blessé de plus long terme, ou celui qui revient |
| Un rival dans la semaine | le meilleur marqueur contre ce rival, ou sa bête noire |
| La caisse à sec, la masse salariale | le plus gros contrat |
| Une recrue qui fait jaser | la recrue |
| Le point de presse, le courriel | celui dont on parle (le fil le plus lourd) |

Les dossiers ont déjà `joueur(f)` (cinq sur la table) ; les autres l'ont à gagner. Le staff y répond ailleurs : le coach colore l'option, l'adjoint du poste devient candidat au protégé.

### Des dates, pour que ça joue plus : sept façons, cumulables

1. **La fenêtre.** Un effet a un début et une fin, écrits en matchs : « dès lundi prochain, huit matchs ». Il existe déjà (`duree`, `ensuite: { apres, duree }`, comme le congé du gardien) ; ce qui manque, c'est de le montrer : une ligne « du 24e au 32e match » à la maison du joueur.
2. **L'année de contrat.** Un joueur à son dernier contrat a une date : la fin de saison, ou la date limite des échanges (`DATE_LIMITE_MATCH`, 62). L'incident s'ouvre quand la date approche (« il joue pour son prochain contrat », déjà un incident de l'agent) et son effet est plus fort, sa blessure plus probable, jusqu'à la date. Après, il part ou il signe. Une échéance qu'on voit venir fait jouer.
3. **Le compte à rebours.** Le retour d'un blessé, la fin d'une suspension, le jour où une recrue passe en deuxième année : l'incident porte la date, l'écran dit « dans 6 matchs », et ton choix de maintenant (le jouer amoché ou l'attendre) se paie à cette date.
4. **Le prêt sur la lancée.** On emprunte à l'avenir : l'effet fort tout de suite, le prix à une date écrite d'avance (« +30 % en finition pendant six matchs, puis trois matchs à −20 % »). Le net sur toute la fenêtre reste sous la borne, mais le joueur a un vrai choix : prendre l'argent d'abord ou plus tard.
5. **L'épisode daté.** Un arc de joueur en trois temps, à des lundis écrits : le lundi 1 son fait (il explose), le lundi 3 sa suite (la ligue s'ajuste, il doute), le lundi 5 son verdict (il tient ou il s'éteint). Les arcs (`ARCS`, `ESPACE_ARCS`) en ont déjà la forme ; ça fait d'un incident une histoire qu'on suit au lieu d'un clic.
6. **Le moment.** L'effet n'attend pas une date mais un soir : seulement en séries, contre sa bête noire, au deuxième match d'un dos-à-dos (`MOMENTS_SI`). Le joueur « se garde » pour les séries : on y joue, on y arrive.
7. **L'échéance de la direction.** Le DG a une date à lui : la date limite, la fin du mandat (le verdict du proprio aux 41 matchs). Un perk de la direction (un rabais, un plafond de plus) ne vaut que jusqu'à cette date, et un incident peut le prolonger : « le GM veut son joueur avant la date limite ».

### Ce que je propose de retenir

Les façons 1, 2 et 5 comme socle (la fenêtre visible, l'année de contrat, l'épisode daté), parce qu'elles existent presque déjà dans le code et que l'écran n'a qu'à les montrer ; 4 en option de choix risqué ; 3 et 6 là où le fait se lit sans effort ; 7 plus tard, avec la refonte de la direction (tranche 4). Le tout dans le format de la tranche 5 : `{ joueur, fait, debut, fin, options }`, une date de début et une de fin pour chaque incident.
