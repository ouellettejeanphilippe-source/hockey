# La structure du dépôt, fichier par fichier (version longue)

Refait le 31 octobre 2026 (version 2.9.2, moteur S136, cotes v30) ; les Actions et les listes de scripts revues le 11 novembre 2026, quand l'ancien Rogue est parti (V28, tranche 4, docs/refonte-v28-4.md). La version courte des modules `js/`, une ligne par fichier, est dans `docs/structure.md` et fait foi ; ce fichier détaille ce qu'elle ne fait que nommer : les Actions, les fichiers de la racine, les données, et **tous les scripts**, par famille.

## La racine et les Actions

```
.github/workflows/verifier.yml    Action « Vérifier », à chaque PR et à chaque poussée sur main : une étape par
                            garde-fou (check_coquille, check_graine, check_empreinte, check_ballottage,
                            check_lancee, check_moments_si, check_gros LIGUES=4, check_commentaire,
                            check_feuilles sur une ligue, check_parts, check_table, check_regles MATCHS=80,
                            check_ratings, check_traits, check_fiches, check_clarte, check_lexique,
                            check_lisibilite, check_glace, check_pouvoirs et check_relais MESURE=0 N=20,
                            check_mort, check_css), puis tout.mjs (les 35 rapides), check_actions, et dans
                            Chromium le smoke à 390 px, smoke_table et check_hauteur, puis le Rogue :
                            check_scene, essai_run, mesure_run GRAINES=64 FILS=4. Le travail « fusionner »
                            fusionne la PR quand tout est vert.
.github/workflows/build-data.yml  Action « Bâtir les données » : les shards depuis l'API LNH (modes bios, rerate,
                            seed, full) ; chaque lundi, la saison en cours seulement (--refresh-current)
index.html                  la page unique : l'en-tête du club, les sections (Bureau, Joueurs, Lignes, Ligue),
                            la roulette, le vestiaire, l'alignement, les modales ; le Rogue s'ouvre par-dessus,
                            en plein écran (#runModal, js/run-jeu.js)
style.css                   tous les styles, une seule feuille dans l'ordre des écrans (docs/refonte-ui.md), mobile
                            d'abord (390 px), le rail dès 1000 px
sw.js                       travailleur de service : la coquille hors ligne (FICHIERS), les
                            visages en cache ; les shards restent à IndexedDB ; VERSION = la version du jeu
site.webmanifest, favicon.svg, icon-180/192/512.png   installation et icônes
fonts/                      Barlow Condensed, Manrope, Noto Emoji (les émojis au trait) et les polices des séries
                            de cartes, toutes OFL (fonts/POLICES.txt), hébergées ici : aucune requête tierce
img/logos                   les écussons des 44 franchises (scripts/logos.mjs ; les disparues sont dessinées,
                            js/logos.js)
img/mugs                    les visages recadrés (scripts/portraits.mjs)
img/actions                 les photos de match recadrées en 5:7 (≈ 170 Mo), celles de la LNH, de Commons,
                            d'une saison, les couchées ; data/actions.json les liste
CLAUDE.md, AGENTS.md        les consignes des agents ; AGENTS.md renvoie à CLAUDE.md
README.md, ARCHITECTURE.md, MOTEUR.md, LIVRAISON.md, PLAN.md   voir docs/README.md
```

## Les modules `js/`

La liste, une ligne par module, est dans `docs/structure.md`. Quelques-uns méritent un mot de plus :

- `js/sim.js` — le plus gros : l'alignement (`SLOTS`, `autoRoster`, les positions multiples), les rôles et les badges (`rolesBruts`, `badgesDe`, `AFFINITES`), les familles (`famillesBrutes`, `PROFIL_FAMILLES` calé par check_familles), le moteur de match lancer par lancer (`playGame`, MOTEUR.md), la ligue au jour le jour (`creerLigue`, `jouerJusqua`, les décisions datées, `deDuJour`), les séries (`creerSeries`, `jouerMatchSeries`, la mort subite), les blessures, les moments (`MOMENTS_SI`, `momentsDuSoir`), le duel en trois périodes (`simulerGrosMatch`). Tout son hasard passe par `hasard()`. Il n'importe aucun module du Rogue : le banc joué par période, le duel et les histoires s'y greffent (js/greffes.js, `check_couches`).
- `js/run.js`, `js/run-scenes.js`, `js/run-jeu.js` — le Rogue, la run en carte (V28, docs/refonte-v28.md). Le cœur est pur, sans DOM ni stockage : ses réglages (l'objet `RUN`), le monde de toutes les années (`classerLesClubs`), la carte de l'acte (`carteDeLActe`), le match isolé (`jouerLeMatch`, `conclure`, `poserLeSoir`), les portes et l'échange (`vestiaireDe`, `signer`, le salaire de la run `prixDe`), le marché et le vestiaire (`acheterLaPiece`, `acheterLaPochette`, `reposer`, `monterUneCarte`), les histoires (`histoireDeLaCase`, `repondre`), les séries, la sauvegarde (`figer`, `ouvrirSeance`, `VERSION_DE_LA_RUN`). Les scènes sont des fonctions pures `(S, V) → HTML` d'un plan de 390 × 844 ; la coquille (`ouvrirRun`, `#runModal`) joue leurs gestes et garde la run sous `cap82_run`. Les robots (scripts/lib/run_robot.mjs) jouent par les mêmes fonctions — `check_run`, `check_neuf`, `check_scene`, `essai_run`, `mesure_run`.
- `js/ratings.js` — partagé par le build et le navigateur. L'étage 1 (`rateSkaters`, `rateGoalies`) lit les lignes de l'API ; l'étage 2 (`rerateShard` : `glaceInferee` pour le temps de glace d'avant 1997-98, `finalizeSeason` pour la valeur, le salaire, l'archétype et le contrat d'entrée, `zonesDuDeploiement` pour la zone) ne lit que le shard. Toucher une formule, c'est monter `RATINGS_VERSION`.
- `js/game.js` — le contrôleur : l'état `G`, `render()`, le démarrage, la sauvegarde (`VERSION_MOTEUR`, qui monte quand un match ne se rejoue plus pareil), les sections, l'historique.
- `js/physique.js` — Sur glace, la physique et les règles (31 oct. 2026) : un pas fixe de 1/120 s, des mètres et des kilogrammes, un hasard semé ; la rondelle, la bande et ses coins, les poteaux et la maille, le patineur (poussée, frein, adhérence des lames, dérive, les jambes), la lame, la passe à un coéquipier, le tir chargé et le tir sur réception, le harpon, la mise en échec par l'élan et ses punitions, les gardiens à 150 ms de retard ; le match (`nouveauMatch`) : les trios et les paires qui changent, la mise en jeu, le hors-jeu, le dégagement refusé, la punition et l'avantage numérique, l'horloge, la prolongation à trois, les tirs de barrage ; les vrais joueurs en paramètres (`parametresDuPatineur`, `parametresDuGardien`) ; `reglesDeLaGlace()` écrit chaque chiffre — `scripts/check_physique.mjs`. `js/glace-ia.js` joue les neuf autres (`decisionIA`, pure, reçue par le match). L'écran est `js/sur-glace.js` : l'affiche de deux clubs, un canevas vu de haut, la caméra sur la rondelle, le radar, les jetons à la vraie face, le tableau, la manette, le clavier et le doigt, les sons, la fin du match ; un lien du menu, comme l'exhibition.

## Les scripts, par famille

### Bâtir les données

```
scripts/build_shards.py     aspire l'API LNH, écrit data/seasons/<saison>.json, data/index.json et data/seed.json ;
                            --rerate = l'étage 2 sans API (puis index et seed) ; --bios-only = dates de
                            naissance, tailles et poids ; --gestes-only = tirs bloqués, vols, revirements,
                            punitions tirées, type de tir (2005-06+) ;
                            --refresh-current = la saison en cours ; --seed-only = le filet
scripts/rate.mjs            pont Node vers js/ratings.js (étage 1 + 2) pour une saison
scripts/rerate.mjs          l'étage 2 sur les shards existants : le temps de glace inféré, la valeur, les salaires
                            réels, les contrats d'entrée, les zones
scripts/build_salaries.py   assemble data/salaries/<saison>.json depuis data/salaries/sources/
scripts/fetch_markerzone.py dépose les salaires publiés par MarkerZone (1989-90+) dans sources/ ; manuel, jamais dans l'Action
scripts/build_lancers.mjs   régénère SEASON_LANCERS de js/ratings.js depuis les shards (les constantes d'époque)
scripts/recrues.mjs         la vraie saison recrue de chaque joueur → data/recrues.json
scripts/coachs.mjs          les vrais coachs, saison par saison → data/coachs.json (V21)
scripts/logos.mjs           les écussons, chez nous (img/logos)
scripts/portraits.mjs       les portraits, téléchargés et recadrés (img/mugs ; js/recadrage.js)
scripts/actions.mjs         les photos d'action de la LNH, recadrées en 5:7 (img/actions ; js/recadrage-action.js)
scripts/actions_commons.mjs les photos libres de Commons et d'Openverse, créditées au dos
scripts/actions_saisons.mjs une photo par saison ({id}-{saison}.webp)
scripts/actions_couchees.mjs les photos couchées, pour les cartes horizontales
scripts/actions_clubs.mjs   le club de la photo générale : la photo seulement quand le club concorde
scripts/actions_clubs.oeil.json, actions_saisons.oeil.json   ce que l'œil a lu sur les planches de photos (le club
                            que le chandail montre, les photos gardées), relu par les deux scripts du même nom
scripts/visages_actions.py  la face dans le cadre : trouve le visage une fois, à la fabrication (YuNet)
scripts/emojis.mjs          les émojis au trait : refait la police des émojis du jeu (scripts/lib/emojis.mjs)
scripts/planche_cartes.mjs  les planches des cartes : toutes les séries, toutes les parallèles, côte à côte
scripts/sprites/            Sur glace : rendu.mjs réécrit js/sprites.js (un joueur en volumes, posé image par image),
                            apercu.mjs en fait la planche en image ; GUIDE.md et RECHERCHE.md l'expliquent
```

### Calibrer (à la main ; chacun imprime ce qu'il faut recopier)

```
scripts/inferer_glace.mjs   le temps de glace inféré d'avant 1997-98 : ajuste sur 2010-2025, éprouve en retenue
                            sur 1997-2005, juge les coefficients du jeu (GLACE_INFEREE, js/ratings.js)
scripts/inferer_gestes.mjs  les mises en échec, les tirs bloqués et les punitions tirées estimés en écart réduit
                            (GESTES_ESTIMES, js/sim.js) : ajuste sur 2015-2025, éprouve en retenue sur 2005-2012
scripts/badges_calibre.mjs  les seuils des paliers de badge et le badge moyen de la ligue
scripts/roles_calibre.mjs   le décalage de chaque rôle (DECALAGE_ROLES, js/sim.js)
scripts/roles_ref.mjs       la référence des rôles par saison et par groupe (js/roles_ref.js)
scripts/calibrate_sim.mjs   le tableau de calibration : de vrais joueurs d'une même cote
scripts/check_lancers.mjs   les deux constantes d'époque du moteur (MOTEUR.md)
scripts/check_neutre.mjs    de quoi est faite l'équipe moyenne, une fois alignée (REF, js/sim.js)
scripts/check_monotonie.mjs améliorer son équipe la rend-elle meilleure ? (vraies équipes)
scripts/check_plafond.mjs   le plafond du jeu en victoires et en Coupes
scripts/check_tireurs.mjs   les alignements que la valeur ne voit pas, et le vrai plafond du jeu
scripts/check_builds.mjs    combien de façons de bâtir mènent quelque part
scripts/check_suppression.mjs la défensive de l'alignement : volume ou qualité ? (MOTEUR.md, étape 3)
scripts/check_pm.mjs        le +/- va-t-il à ceux qui étaient sur la glace ?
scripts/mock_moteur.mjs     maquette du moteur par événements (MOTEUR.md, étape 2)
scripts/mock_prod_sim.mjs   maquette : la simulation par production réelle contre celle par sous-cotes
scripts/mock_zones.mjs      le malus de zone ferme-t-il l'empilement ?
scripts/sonde_aptitudes.mjs l'échelle des profils sur 330 vraies équipes
scripts/sonde_gros_matchs.mjs combien de gros matchs par saison
```

### Vérifier (chacun passe par verdict.mjs et pose le code de sortie)

Dans `tout.mjs` (les 35 rapides, moins de quinze secondes chacun ; le CI les enchaîne) :

```
check_glace             la position d'un tir lue de la feuille, le danger, les icônes du tireur
check_physique          Sur glace : la rondelle, la bande, le patineur, la lame, le filet, le gardien, le choc, la graine ; le match de l'IA, les règles sur des scènes
check_prolongation      la prolongation, les tirs de barrage, la mort subite
check_cotes             les cotes sur 20 : tranches, cloche, six axes, trois pour un gardien
check_incidents         les incidents liés à des joueurs
check_lisibilite        le décor calme, les cartes belles
check_lexique           un mot par idée, une icône par sens
check_verite            la vérité des chiffres : un tirage pur lit la graine par entierDeGraine
check_emojis            les émojis au trait
check_speciales         les unités spéciales (AN 1-2, DN 1-2), que le moteur range
check_fils              les fils de la saison citent des feuilles réelles
check_histoires         les histoires (V25 C1) : la banque, la réplique qui nomme, le tirage pur, chacune s'ouvre
check_mots              les mots d'une réponse disent ses lignes
check_au_mieux          « Aligner au mieux » fait ce qu'il dit
check_identite          l'identité de départ
check_atelier           les retouches et les variantes
check_pronostic         le pronostic ne touche à rien : la chance d'un soir isolé (chanceDUnSoir, js/pronostic.js)
check_totaux            les totaux du soir : l'écran annonce ce que le moteur applique
check_profil            le profil de style
check_sauvegardes       le fichier transférable, les vieilles parties, l'ancien Rogue soldé une seule fois
check_choix             tous les choix en sont
check_vie               le joueur du fait
check_blessures         les blessures du moteur : le remplaçant de la ligue, le nombre de blessés de la vraie LNH, la robustesse qui blesse
check_impact            la base de la ligue et le témoin à zéro ; COMPLET=1 le tableau de chaque choix
check_causes            ce qui a fait le match
check_positions         les positions multiples réelles
check_empreinte         l'empreinte du moteur (scripts/empreinte.json ; EMPREINTE=ecrire la range)
check_familles          le calage du profil en quatre familles (PROFIL_FAMILLES, js/sim.js)
check_gestes            les gestes dans la feuille : les blocs, les punitions tirées, les départs de qualité, le compte
check_css               une définition par composant
check_maj               la mise à jour de la version Web : la version qui tourne est celle de sw.js, la prendre ne touche pas au stockage
check_couches           les couches du moteur (V25 A1) : js/sim.js n'importe aucun module du Rogue, js/greffes.js pose chaque crochet que le moteur lit
check_elites            les règles des élites, sans jouer un match : la récompense et ses bornes, ce qu'une élite perdue coûte, les trois pièces « pour le battre », un style par club
check_neuf              aucun module js/run* ne s'appuie sur un nom de « Ce qui part » du devis V28, aucune ligue en coulisse, le cœur sans DOM ni stockage
check_meta              la méta du Rogue sans navigateur (V28, tranche 5) : les philosophies et leurs prix, la case « Nouveau » du loto, ton club, le prestige et ses exploits, les exigences et les règles qu'une run porte, le solde des déblocages d'avant, la même run le méta vide ou plein ; quatre secondes
check_run               les invariants de la run en carte, jouée par ses trois robots : les actes, la cible, les cœurs, les portes, le plafond, la même graine, une run relue, une histoire relue (GRAINES)
```

Leur propre étape au CI (`verifier.yml`) : `check_coquille`, `check_graine`, `check_empreinte`, `check_ballottage`, `check_lancee`, `check_moments_si`, `check_gros`, `check_commentaire`, `check_feuilles`, `check_parts`, `check_table`, `check_regles`, `check_ratings`, `check_traits`, `check_fiches`, `check_clarte`, `check_lexique`, `check_lisibilite`, `check_glace`, `check_pouvoirs` et `check_relais` (`MESURE=0 N=20`), `check_mort`, `check_css`, `check_actions`, puis dans Chromium `smoke`, `smoke_table`, `check_hauteur`, `check_scene`, `essai_run`, et `mesure_run` (`GRAINES=64 FILS=4`).

Le Rogue, la run en carte (V28), hors de `tout.mjs` ; les règles qu'ils prouvent : `.claude/rules/rogue.md`, leurs variables : `.claude/rules/tests.md` :

```
mesure_run              la run mesurée sur ses trois robots (« premier », le chiffre, le malin ; lib/run_robot.mjs), 64 graines : les Coupes, la première Coupe du malin en médiane, l'acte III à 75 % (imprimé sans se juger) ; en CI, ici FILS=3 au plus (cinq à six minutes) ; ROBOTS, GRAINE0, REGLAGES
mesure_build            le build décide, le test d'un jour (V29, tranche 0, docs/refonte-v29.md § 4) : quatorze pièces d'essai qui comptent tes joueurs (badges, origines) dans la table le temps de la mesure, le bâtisseur contre le même robot qui ne lit pas son banc, 48 graines ; à la main, neuf minutes
check_pouvoirs          le banc de cinq (js/pieces.js) : les tables, le banc pur, chaque pièce en paires contre un banc vide, sa présence sur des runs du robot malin, les bornes d'un acte de six matchs, le banc complet ; huit minutes sur trois fils (N, PIECES, FILS) ; MESURE=0 N=20 en CI, sans les bornes
check_relais            le relais des pièces (V23 D ; V27, tranche 5) : en paires, chaque pièce relaie exactement les périodes que son signal lit, à deux maillons, se voit le soir où elle relaie, la paire pièce de départ-pièce à relais rend 1,2 à 1,6 fois ses pièces ; deux minutes (N) ; MESURE=0 N=20 en CI
check_moments_si        les moments (MOMENTS_SI, js/sim.js) : un effet d'un moment ne joue que son soir, rien ne se lit d'avance, chaque moment arrive dans des runs du robot malin ; une demi-minute, en CI (GRAINES)
check_duel              le duel à un choix (V27, tranche 6) : le plan joue les trois périodes, la dominante du rival, aucun trio de plans dominé, le meilleur plan contre Ton match sous 60 % ; une minute (N, TRIOS=0)
check_effets            chaque effet d'une réponse d'histoire, en paires : il se voit dans la feuille d'un soir où il joue, sa force bornée par son niveau ; une vingtaine de minutes (N, IDS, DETAIL=1)
check_packs             les deux pochettes du marché selon le niveau des joueurs : pures, aux taux de leur métal, l'Époque un Pilier ou mieux de sa décennie et de son poste, la brillante à la vedette ; une seconde et demie, dans tout.mjs (PACKS)
```

À lancer à part (trop lents pour `tout.mjs`, ou à la main) :

```
check_gardiens, check_jambes (une minute), check_chiffres (une minute), check_affinite (trois minutes),
check_retours (deux minutes ; GRAINES), check_suivis (GRAINES), check_paliers (LIGUES), check_series_pas (S79),
check_force (la fiche suit la force ; LIGUES), check_possession (Sur glace : la possession, les revirements et la
défensive sur des matchs de l'IA ; GLACE_MATCHS), check_refonte (un gros changement se mesure à ce qui part, 4 nov.
2026 : le diff de la branche contre main, chaque nom de « Ce qui part » du devis parti, chaque fichier de « Ce qu'il
touche » dans le diff ; à la main, avant la PR d'une refonte).
Rouges ou muets depuis avant la V28, tranche 4 (docs/refonte-v28-4.md) : check_robot (le robot « premier Signer » du
82-0, 40 saisons ; SAISONS, FILS), check_banque (ce que le moteur joue d'une décision de carte ; une douzaine de
minutes), check_situations (ne démarre plus depuis la V25 A1).
```

### Dans Chromium (Playwright ; l'adresse du jeu en argument)

```
scripts/smoke.mjs           le test de fumée à 390 px (.claude/rules/tests.md) ; en CI
scripts/smoke_table.mjs     le même en mode Sur table : le tournoi, le plateau joué geste par geste, le bilan ; en CI
scripts/check_hauteur.mjs   un choix tient en un écran (V25 B2, 6 nov. 2026) : ton identité au repêchage, trois cartes de jeu de front à 390 × 844, chaque nom lisible, la carte retournée qui se rapproche ; une capture ; en CI
scripts/check_scene.mjs     chaque scène de la run ouverte à 390 × 844 depuis une vraie sauvegarde de robot : rien ne défile, rien du site ne dépasse, le HUD au même pixel, les cibles de 44 ; une capture par scène dans le dossier donné ; en CI
scripts/essai_run.mjs       une run entière du Rogue jouée au doigt, le hasard semé (GRAINE) : neuf touchers au plus par semaine gagnée, le pointage vu est celui que la run garde, quitter et reprendre, les médailles une fois ; en CI
scripts/essai_exhibition.mjs l'exhibition et le « au hasard »
scripts/essai_poids.mjs     le poids du premier écran, processeur ×4
scripts/mesure_defilement.mjs le défilement du vestiaire, mesuré (S77) : il ne juge rien
```

### `scripts/lib/`

```
verdict.mjs (à la racine de scripts/)   le juge partagé : exiger, borne, monte, informer, verdict()
lib/mort.mjs                la mesure du code mort (check_mort) : déclarations, exports, imports, classes CSS
lib/chaines.mjs             les chaînes d'un module sans ses commentaires (un lecteur à états)
lib/css.mjs                 un lecteur de feuille de style minimal (check_css)
lib/gros.mjs                le hook UserPromptSubmit (.claude/settings.json) : quand la demande de JP porte les mots d'un gros changement (refonte, de zéro, au complet, pas juste la peinture…), il écrit la marche à suivre dans le contexte de la session (/refonte, le devis, check_refonte)
lib/cibles.mjs              les cibles de 44 px (smoke, check_scene)
lib/emojis.mjs              les émojis du jeu et les polices qui les rendent au trait
lib/run_robot.mjs           les trois robots de la run en carte (V28 : « premier », le chiffre, le malin), qui jouent par les fonctions de js/run.js (check_run, mesure_run, check_scene, check_pouvoirs, check_moments_si)
lib/shards.mjs              les saisons de l'index et leurs shards, lus une fois, pour les robots (`SAISONS`, `shard`, `generateur` ; sorti du robot de l'ancienne run, parti à la V28, tranche 4)
lib/devis.mjs               lire un devis : la partie sous un titre, ses noms en code (check_refonte, check_neuf)
lib/duel.mjs                les robots du duel à un choix (`robotDuel` : l'attentif, le distrait, rien) ; le malin de la run y prend son plan
lib/temoins.mjs             des effets témoins pour les juges, au chiffre connu
lib/vestiaires.mjs          les vestiaires que les scripts d'analyse se partagent (equipeReelle)
```

## Les données

```
data/seasons/<saison>.json  un shard par saison : season, minGP, v (RATINGS_VERSION), an (les unités spéciales
                            par club depuis 1977-78), players (une entrée par joueur et par club ; les colonnes de
                            l'API, le coffre o d r c sp v, le salaire, l'archétype ak, les zones lz et zd, le
                            temps de glace toi — inféré avant 1997-98, marqué toiE —, et depuis 2005-06 les
                            mises en échec ht, blocs bl, vols tk, revirements gv, depuis 2009-10 les punitions
                            tirées pd, depuis 2009-10 le type de tir ts)
data/index.json             les saisons au jeu (41 matchs joués au moins) et les 44 équipes
data/seed.json              le filet hors ligne : dix saisons
data/salaries/<saison>.json salaires réels publiés (playerId → $ de l'époque), facultatif ; sources/ et README.md
data/trophees.js            Selke, Norris, Vezina, Conn Smythe — gagnants et finalistes (les traits)
data/reputations.js         les réputations curées
data/portraits.json, data/actions.json   ce que img/mugs et img/actions contiennent
data/recrues.json           la vraie saison recrue de chaque joueur
data/coachs.json            les vrais coachs, saison par saison (V21)
```
