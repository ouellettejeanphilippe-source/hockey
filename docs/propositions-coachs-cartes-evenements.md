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
