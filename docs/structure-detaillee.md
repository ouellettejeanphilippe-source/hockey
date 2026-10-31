# La structure du dépôt, fichier par fichier (version longue)

Refait le 31 octobre 2026 (version 2.9.2, moteur S136, cotes v30). La version courte des modules `js/`, une ligne par fichier, est dans CLAUDE.md et fait foi ; ce fichier détaille ce que CLAUDE.md ne fait que nommer : les Actions, les fichiers de la racine, les données, et **tous les scripts**, par famille.

## La racine et les Actions

```
.github/workflows/verifier.yml    Action « Vérifier », à chaque PR et à chaque poussée sur main : une étape par
                            garde-fou (check_coquille, check_graine, check_instantane, check_empreinte,
                            check_ballottage, check_lancee, check_moments_si, check_gros LIGUES=4,
                            check_commentaire, check_feuilles sur une ligue, check_parts, check_table,
                            check_regles MATCHS=80, check_ratings, check_traits, check_fiches, check_clarte,
                            check_lexique, check_lisibilite, check_glace, check_pouvoirs MESURE=0 N=20,
                            check_mort, check_css), puis tout.mjs (les 32 rapides), check_actions, et dans
                            Chromium le smoke à 390 px et smoke_table. Auto-merge quand c'est vert.
.github/workflows/build-data.yml  Action « Bâtir les données » : les shards depuis l'API LNH (modes bios, rerate,
                            seed, full) ; chaque lundi, la saison en cours seulement (--refresh-current)
index.html                  la page unique : l'en-tête du club, les sections (Bureau, Joueurs, Lignes, Marché en
                            Rogue, Ligue), la roulette, le vestiaire, l'alignement, les modales
style.css                   tous les styles, une seule feuille dans l'ordre des écrans (docs/refonte-ui.md), mobile
                            d'abord (390 px), le rail dès 1000 px
sw.js                       travailleur de service : la coquille hors ligne (FICHIERS, réécrite par l'APK), les
                            visages en cache ; les shards restent à IndexedDB ; VERSION = la version du jeu
site.webmanifest, favicon.svg, icon-180/192/512.png   installation et icônes
fonts/                      Barlow Condensed, Manrope, Noto Emoji (les émojis au trait) et les polices des séries
                            de cartes, toutes OFL (fonts/POLICES.txt), hébergées ici : aucune requête tierce
img/logos                   les écussons des 44 franchises (scripts/logos.mjs ; les disparues sont dessinées,
                            js/logos.js)
img/mugs                    les visages recadrés (scripts/portraits.mjs ; l'APK les télécharge sur l'appareil)
img/actions                 les photos de match recadrées en 5:7 (≈ 170 Mo), celles de la LNH, de Commons,
                            d'une saison, les couchées ; data/actions.json les liste
mobile/                     l'APK (Capacitor) : fabriquer-apk.ps1, assembler-www.mjs (www/ minifié par esbuild,
                            sans data/salaries ni data/seed.json)
desktop/                    l'exe (Electron) ; seul le code est versionné
CLAUDE.md, AGENTS.md        les consignes des agents ; AGENTS.md renvoie à CLAUDE.md
README.md, ARCHITECTURE.md, MOTEUR.md, LIVRAISON.md, PLAN.md   voir docs/README.md
```

## Les modules `js/`

La liste, une ligne par module, est dans CLAUDE.md (« Structure »). Trois d'entre eux méritent un mot de plus :

- `js/sim.js` — le plus gros : l'alignement (`SLOTS`, `autoRoster`, les positions multiples), les rôles et les badges (`rolesBruts`, `badgesDe`, `AFFINITES`), les familles (`famillesBrutes`, `PROFIL_FAMILLES` calé par check_familles), le moteur de match lancer par lancer (`playGame`, MOTEUR.md), la ligue au jour le jour (`creerLigue`, `jouerJusqua`, les décisions datées, `deDuJour`), les séries (`creerSeries`, `jouerMatchSeries`, la mort subite), les blessures, les fils et leurs retours, les moments (`MOMENTS_SI`), les pouvoirs du coach joués par période. Tout son hasard passe par `hasard()`.
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
scripts/visages_actions.py  la face dans le cadre : trouve le visage une fois, à la fabrication (YuNet)
scripts/emojis.mjs          les émojis au trait : refait la police des émojis du jeu (scripts/lib/emojis.mjs)
scripts/planche_cartes.mjs  les planches des cartes : toutes les séries, toutes les parallèles, côte à côte
```

### Calibrer (à la main ; chacun imprime ce qu'il faut recopier)

```
scripts/inferer_glace.mjs   le temps de glace inféré d'avant 1997-98 : ajuste sur 2010-2025, éprouve en retenue
                            sur 1997-2005, juge les coefficients du jeu (GLACE_INFEREE, js/ratings.js)
scripts/inferer_gestes.mjs  les mises en échec, les tirs bloqués et les punitions tirées estimés en écart réduit
                            (GESTES_ESTIMES, js/sim.js) : ajuste sur 2015-2025, éprouve en retenue sur 2005-2012
scripts/check_familles.mjs  le calage du profil en quatre familles (PROFIL_FAMILLES, js/sim.js) ; dans tout.mjs
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
scripts/check_impact.mjs    la base de la ligue et le témoin à zéro ; COMPLET=1 le tableau de chaque choix
scripts/mock_moteur.mjs     maquette du moteur par événements (MOTEUR.md, étape 2)
scripts/mock_prod_sim.mjs   maquette : la simulation par production réelle contre celle par sous-cotes
scripts/mock_zones.mjs      le malus de zone ferme-t-il l'empilement ?
scripts/sonde_aptitudes.mjs l'échelle des profils sur 330 vraies équipes
scripts/sonde_gros_matchs.mjs combien de gros matchs par saison
scripts/mesure_prep.mjs, mesure_rogue.mjs, mesure_defilement.mjs   des mesures d'époque (S76-S77), gardées
```

### Vérifier (chacun passe par verdict.mjs et pose le code de sortie)

Dans `tout.mjs` (moins de quinze secondes chacun ; le CI les enchaîne) :

```
check_glace             la position d'un tir lue de la feuille, le danger, les icônes du tireur
check_physique          Sur glace : la rondelle, la bande, le patineur, la lame, le filet, le gardien, le choc, la graine ; le match de l'IA, les règles sur des scènes
check_prolongation      la prolongation, les tirs de barrage, la mort subite
check_cotes             les cotes sur 20 : tranches, cloche, six axes, trois pour un gardien
check_incidents         les incidents liés à des joueurs
check_lisibilite        le décor calme, les cartes belles
check_verdicts          le verdict du lundi d'après
check_lexique           un mot par idée, une icône par sens
check_verite            la vérité des chiffres : un tirage pur lit la graine par entierDeGraine
check_deck              le deck
check_emojis            les émojis au trait
check_speciales         les unités spéciales (AN 1-2, DN 1-2)
check_fils              les fils de la saison citent des feuilles réelles
check_dossiers          les histoires du lundi
check_mots              les mots d'une réponse disent ses lignes
check_au_mieux          « Aligner au mieux » fait ce qu'il dit
check_identite          l'identité de départ
check_atelier           les retouches et les variantes
check_pronostic         le pronostic ne touche à rien
check_totaux            les totaux du soir : l'écran annonce ce que le moteur applique
check_profil            le profil de style
check_sauvegardes       le fichier transférable, les vieilles parties
check_choix             tous les choix en sont
check_vie               le joueur du fait
check_calendrier        le vrai calendrier
check_blessures         une blessure se règle, son retour ne touche à rien d'autre
check_impact            la base de la ligue, le témoin à zéro
check_causes            ce qui a fait le match
check_positions         les positions multiples réelles
check_empreinte         l'empreinte du moteur (scripts/empreinte.json ; EMPREINTE=ecrire la range)
check_familles          le calage des familles
check_galons            graver : les galons, le panthéon
check_gestes            les gestes dans la feuille : les blocs, les punitions tirées, les départs de qualité, le compte
check_css               une définition par composant
```

Leur propre étape au CI : `check_coquille`, `check_graine`, `check_instantane`, `check_ballottage`, `check_lancee`, `check_moments_si`, `check_gros`, `check_commentaire`, `check_feuilles`, `check_parts`, `check_table`, `check_regles`, `check_ratings`, `check_traits`, `check_fiches`, `check_clarte`, `check_mort`, `check_pouvoirs`, `check_actions` (réseau), `smoke`, `smoke_table`.

À lancer à part (trop lents, ou rouges par construction tant qu'un item est ouvert) :

```
check_packs (une demi-minute), check_gardiens, check_combat, check_jambes (une minute), check_chiffres (une minute),
check_banque (une douzaine de minutes), check_affinite (trois minutes), check_duel (six minutes ; N),
check_retours (deux minutes ; GRAINES), check_arcs (deux minutes), check_suivis, check_effets (vingt minutes ; N, IDS),
check_pouvoirs sans MESURE=0 (cinq minutes sur quatre processus ; N, COACHS, FILS), check_cartes, check_paliers,
check_moments (S66, en paires), check_situations, check_series_pas (S79), check_plan_de_match (V17),
check_force (la fiche suit la force), check_robot (le robot « premier Signer », 40 saisons ; BALLOTTAGE, MODE=rogue),
check_rogue (RUNS, CAMPAGNES : la courbe des runs), check_profondeur (un quart d'heure ; rouge tant que la première
Coupe arrive avant la run 3)
```

### Essayer à la main (Playwright ; l'adresse du jeu en argument)

```
scripts/smoke.mjs           le test de fumée à 390 px (CLAUDE.md, « Tester »)
scripts/smoke_table.mjs     le même en mode Sur table : le tournoi, le plateau joué geste par geste, le bilan
scripts/essai_rogue.mjs     une run du menu jusqu'au bout : le jour à jour, le gros match en direct, les bords à 8 px
scripts/essai_packs.mjs     des packs de joueurs signés tour après tour (vingt minutes)
scripts/essai_achat.mjs     deux « Acheter » coup sur coup, les saisons lentes comme sur un téléphone
scripts/essai_depart.mjs    la toute première run : un méta et un cartable vides
scripts/essai_exhibition.mjs l'exhibition et le « au hasard »
scripts/essai_poids.mjs     le poids du premier écran, processeur ×4
```

### `scripts/lib/`

```
verdict.mjs (à la racine de scripts/)   le juge partagé : exiger, borne, monte, informer, verdict()
lib/mort.mjs                la mesure du code mort (check_mort) : déclarations, exports, imports, classes CSS
lib/chaines.mjs             les chaînes d'un module sans ses commentaires (un lecteur à états)
lib/css.mjs                 un lecteur de feuille de style minimal (check_css)
lib/bords.mjs               rien ne colle au bord : 8 px au moins à 390 px (essai_rogue)
lib/cibles.mjs              les cibles de 44 px (smoke)
lib/emojis.mjs              les émojis du jeu et les polices qui les rendent au trait
lib/rogue_sim.mjs           une run Rogue jouée par un robot (check_rogue, check_profondeur ; `politique`)
lib/cartes_robot.mjs        ce que les robots font du coach-personnage (talents, adjoints, histoires)
lib/duel.mjs                les robots du duel : l'attentif, « Garder »
lib/temoins.mjs             des effets témoins pour les juges, au chiffre connu
lib/vestiaires.mjs          les vestiaires que les scripts d'analyse se partagent (equipeReelle)
lib/paquet.mjs              la pile d'un paquet, traversée comme un joueur (essais)
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
data/seed.json              le filet hors ligne du Web : dix saisons, hors de l'APK
data/salaries/<saison>.json salaires réels publiés (playerId → $ de l'époque), facultatif ; sources/ et README.md
data/trophees.js            Selke, Norris, Vezina, Conn Smythe — gagnants et finalistes (les traits)
data/reputations.js         les réputations curées
data/portraits.json, data/actions.json   ce que img/mugs et img/actions contiennent
data/recrues.json           la vraie saison recrue de chaque joueur
data/coachs.json            les vrais coachs, saison par saison (V21)
```
