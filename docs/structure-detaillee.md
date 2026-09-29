# La structure du dépôt, fichier par fichier (version longue)

Déplacé mot pour mot de CLAUDE.md en 1.0. La version courte, une ligne par fichier, est dans CLAUDE.md.

## Structure

```
.github/workflows/verifier.yml    Action : à chaque PR, check_graine, check_feuilles
                            (une ligue) et le test de fumée dans Chromium
.github/workflows/build-data.yml  Action : bâtit les shards depuis l'API LNH et
                            les commite (modes bios, rerate, seed, full). C'est
                            la voie pour ajouter les dates de naissance quand
                            l'API n'est pas joignable depuis le poste de travail
index.html                  page unique (barre de plafond, roulette, tableau de
                            bord, deux volets vestiaire / alignement, modales)
favicon.svg                 la marque : la jauge de plafond et une rondelle
icon-180/192/512.png        rasterisées depuis favicon.svg (iOS, écran d'accueil)
site.webmanifest            nom, couleurs et icônes pour l'installation
style.css                   tous les styles, mobile d'abord (390 px), deux
                            volets à partir de 1080 px
js/ratings.js               calcul des cotes cachées (partagé navigateur + build)
                            étage 1 : sous-cotes en z-score (exige l'API)
                            étage 2 : valeur, salaire, archétype, zone (rejouable hors ligne)
js/data.js                  chargeur trois niveaux + cache IndexedDB
js/logos.js                 couleurs et écussons des 44 franchises (les disparues
                            sont DESSINÉES ici, jamais empruntées : les Nordiques
                            sont un iglou bleu traversé d'un bâton rouge, semé de
                            fleurs de lys — pas un « N » avec une fleur à côté) ; `getTeamBand`
                            (l'aplat du bandeau, encre mesurée, liseré), `getTeamAccent`
                            (le contour éclairci) et `teamSeasonUrl` (la saison d'une
                            équipe sur Hockey-Reference, adresse vérifiée)
fonts/                      Barlow Condensed (OFL 1.1), trois graisses, hébergée ici :
                            la police des chiffres et des titres, aucune requête tierce
js/traits.js                les traits, tirés des votes de `data/trophees.js`
js/niveaux.js               les niveaux de joueur (S80) : un RANG dans sa vraie
                            saison, à son poste (Soutien → ★ Phénomène) ; l'étoile
                            du ruban et les taux des packs s'y lisent
js/recit.js                 les mots du sommaire d'un match : il ne décide de
                            rien, il raconte ce que le moteur a déjà joué
js/entracte.js              le rapport d'entracte : des cartons de statistiques
                            qu'on balaie (la saison, un match, les trois étoiles)
js/equipes.js               l'écran des équipes : les 44 franchises, leurs
                            alignements et leurs VRAIES statistiques, saison
                            par saison ; deux niveaux (la ligue, un club) et
                            une interface ANCRÉE — rien de ce qui sert à
                            naviguer ne défile
js/saison.js                l'écran de saison et l'écran des séries : le prochain
                            match en tête, les boutons qui font avancer le temps,
                            les onglets ; tout est joué, l'écran révèle — et
                            « Derrière le banc » rend la main à l'alignement
                            (les décisions en saison, voir js/game.js `ouvrirBanc`) ;
                            la ROUTE de la saison, les quatre FACTIONS, le PLAN
                            DU SOIR et les CHOIX FORCÉS (proprio, dilemmes,
                            séquences) y vivent depuis S66
js/coquille.js              la COQUILLE FIXE (S67) : l'écran de saison, des séries
                            ou du tournoi s'y inscrit et dit à quel onglet de la
                            barre du jeu chacun de ses volets répond ; la barre ne
                            change jamais d'entrées
js/mouvement.js             le MOUVEMENT de l'interface (S77) : les chiffres qui se
                            comptent avec un ressort (`data-compte`,
                            `data-compte-suivi`) sans jamais toucher au texte du
                            DOM, qui reste le vrai chiffre
js/gerant.js                le POSTE DE GÉRANT (S68), en plein écran : un choix
                            (l'histoire, le joueur visé, des options chiffrées) et
                            « Mes lignes » (tactiques, fit, chimie, agressivité,
                            glace, énergie, tactique d'en face, consigne du match)
js/direct.js                un match en direct, sur demande seulement : rejoue la
                            feuille d'un match dans le temps, plein écran
js/table.js                 SUR TABLE (mode bonus) : le moteur du match de
                            plateau — la glace 13 x 19 (le filet est une case, on
                            joue derrière), les six nombres d'une pièce (PA MA TI
                            FO DE SO), LA PRESSION (le rayon de chaque patineur,
                            un seul nombre dans tous les duels du porteur), le
                            hors-jeu, le cachot, les SIX GESTES (patiner, passer,
                            tirer, feinter, frapper, harponner), le tempo en
                            POSSESSIONS, le gabarit, le tir signature, le
                            souffle, le revirement, l'IA, et `reglesDuPlateau()`,
                            la source unique des règles ; tout son hasard passe
                            par `generateur()` de sim.js
js/plateau.js               l'écran d'un match sur table : la glace qu'on
                            touche, les cotes sur chaque option, le dé visible,
                            la relance d'équipe, la présence adverse racontée
js/tournoi.js               le tournoi sur table : six clubs, cinq matchs de
                            saison, les quatre premiers en séries
js/sons.js                  les effets sonores du plateau, SYNTHÉTISÉS par Web
                            Audio (aucun fichier audio, aucune requête) : un son
                            par événement du fil, coupés par l'option « Sons »
js/sim.js                   structure de l'alignement + simulation de saison + ligue complète ;
                            TOUT son hasard passe par `hasard()`, graine par saison ;
                            les décisions de saison (alignement, trio de fermeture,
                            cartes, PLANS et ROULEMENTS) s'appliquent au jour dit
js/bilan.js                 le bilan de saison : onglets, palmarès, calendrier, séries et
                            sommaires ; branché au contrôleur par `brancherBilan`
js/game.js                  contrôleur d'interface
sw.js                       travailleur de service : la coquille hors ligne (réseau d'abord),
                            les portraits en cache ; les shards de saison restent à
                            IndexedDB, mais `data/seed.json` est de la coquille
scripts/build_shards.py     aspire l'API LNH, écrit les shards ; --rerate = étage 2 sans API ;
                            --bios-only = dates de naissance, tailles et poids ;
                            --gestes-only = tirs bloqués, vols, type de tir
scripts/rate.mjs            pont Node vers js/ratings.js (étage 1 + 2)
scripts/rerate.mjs          étage 2 sur les shards existants (contrats d'entrée, salaires réels)
scripts/build_salaries.py   assemble data/salaries/<saison>.json depuis data/salaries/sources/
scripts/fetch_markerzone.py dépose les salaires publiés par MarkerZone (1989-90+) dans sources/ ; manuel, jamais dans l'Action
scripts/verdict.mjs         le juge partagé : `exiger` (un invariant), `borne` (un repère
                            et son intervalle), `monte` (une suite qui ne redescend pas),
                            `informer` (ce qui se lit sans se juger) et `verdict()`,
                            qui imprime le tableau et POSE LE CODE DE SORTIE
scripts/check_ratings.mjs   distribution des valeurs, zones, archétypes, force d'équipe vs classement
scripts/build_lancers.mjs   régénère SEASON_LANCERS de js/ratings.js depuis les shards
                            (onze nombres par saison : les parts de buts dans
                            les points servent à la création, les deux derniers
                            — occasions et % d'avantage numérique — valent 0
                            tant que les shards n'ont pas le bloc `an`)
scripts/calibrate_sim.mjs   tableau de calibration (de vrais joueurs d'une même cote)
scripts/check_monotonie.mjs améliorer son équipe la rend-elle meilleure ? (vraies équipes)
scripts/mock_zones.mjs      le malus de zone ferme-t-il l'empilement ?
scripts/check_lancers.mjs   les deux constantes d'époque du moteur (voir MOTEUR.md)
scripts/mock_moteur.mjs     maquette du moteur par événements, comparée aux vrais totaux
scripts/check_suppression.mjs  la défensive de l'alignement : volume de lancers
                            concédés ou qualité ? (réponse : la qualité)
scripts/check_neutre.mjs    de quoi est faite l'équipe MOYENNE, une fois alignée
                            (les cinq nombres de REF dans js/sim.js)
scripts/check_parts.mjs     la production se répartit-elle entre les joueurs
                            comme la vraie saison l'a répartie ? (les lancers
                            SIMULÉS par rang d'unité, toutes situations, plus la
                            queue des joueurs trop au-dessus de la mêlée)
scripts/check_feuilles.mjs  les égalités de la feuille de match, les repères
                            d'époque, et les totaux des joueurs (échoue si une
                            égalité casse : c'est ce que l'Action vérifie)
scripts/check_graine.mjs    la même graine rejoue-t-elle la même saison ? (un
                            `Math.random` glissé dans js/sim.js le fait échouer) ;
                            et une décision au jour 40 laisse-t-elle les 40
                            journées d'avant identiques ?
scripts/check_plafond.mjs   le plafond du jeu en victoires et en Coupes
scripts/check_tireurs.mjs   les deux alignements que la valeur ne voit pas :
                            TIREURS sans zones (~53 V) et PARFAIT (~74 V,
                            le vrai plafond du jeu)
scripts/check_builds.mjs    combien de façons de bâtir mènent quelque part :
                            valeur inclinée vers l'offensive, la défensive, la
                            robustesse, en solo et en ligue avec les Coupes
scripts/check_pm.mjs        le +/- va-t-il à ceux qui étaient sur la glace ? (par rang
                            d'unité contre le réel, écart du haut au bas, jumeaux)
scripts/check_traits.mjs    les traits : rareté, couverture d'époque, effet mesuré
scripts/check_moments.mjs   les moments (S66) : chaque dilemme et chaque réponse à
                            une séquence vaut moins d'une victoire, une faction au
                            bout toute la saison moins de deux et demie, le
                            contre-plan de chaque soir quelque chose sans décider
                            la saison, et chaque objectif du proprio se réussit
                            entre 15 et 75 % des fois — mesuré EN PAIRES
scripts/check_gros.mjs      les gros matchs (S70) : aucun dans une ligue sans joueur,
                            plans neutres pas contrés et payants contrés, l'entracte
                            ne touche pas aux deux premières périodes, la dose
scripts/sonde_gros_matchs.mjs combien de gros matchs par saison (S70)
scripts/check_commentaire.mjs le commentateur du direct (S70) : gabarits, variété, graine
scripts/check_tactiques.mjs les lignes à la HockeyArena (S68) : mal assortir et
                            jouer sans système coûtent, aucune agressivité ni
                            aucune glace ne décide la saison — mesuré EN PAIRES
scripts/sonde_aptitudes.mjs l'échelle des profils sur 330 vraies équipes : ce qui
                            règle `PROFIL_REF`
scripts/check_plans.mjs     (S62, remplacé par check_tactiques depuis S68 : le
                            plan d'équipe n'est plus lu par le moteur) le plan de match et le roulement : ce que chacun vaut
                            en victoires, mesuré EN PAIRES comme les cartes, et
                            chacun doit faire ce qu'il annonce
scripts/check_cartes.mjs    les cartes de saison : ce que chacune vaut en victoires,
                            mesuré EN PAIRES (la même ligue deux fois, la carte
                            aux pairs puis aux impairs) ; et une carte prise ne
                            reparaît jamais dans une main
scripts/check_situations.mjs les situations de vestiaire : la force du club ne
                            bouge pas (mesuré sur une équipe QUI NE RÉAGIT
                            PAS, la moitié des équipes traitée puis l'autre —
                            une ligue est à somme nulle, donc traiter tout le
                            monde rendrait zéro par identité), les deux joueurs
                            bougent, le tempo de la ligue ne bouge pas, et la
                            case vide reste un MOMENT (1,3 par saison)
scripts/check_table.mjs     le match sur table : les égalités de sa feuille, les
                            buts par match (cible ARCADE, 5 à 6), les gestes
                            par présence, le gabarit, le tir signature, la
                            fatigue, la parité par décile
scripts/check_regles.mjs    le plateau est-il COHÉRENT ? dix-sept règles vérifiées
                            entre chaque geste (dont le TRAJET de la rondelle :
                            aucune case sans étape, chaque étape permise à sa
                            distance), les règles écrites comparées aux gestes
                            que le moteur joue vraiment, et dix sifflets joués
                            en scène (hors-jeu, dégagement refusé, gel, relance,
                            punition, but) ; depuis S75, la pièce d'avant le
                            sifflet refusée par le moteur, et le niveau Recrue
                            (un geste par main, jamais de relance, même graine
                            même match)
scripts/check_fiches.mjs    la fiche reconstituée d'un club, sur les 1396 clubs :
                            V + D tient dans le calendrier, le calendrier d'un
                            club ne dépasse pas celui de sa saison, les nuls ne
                            se déduisent que d'un effectif complet, trois fiches
                            d'anthologie au match près, et l'ÉCART entre les
                            deux colonnes de buts
scripts/check_coquille.mjs  la coquille hors ligne : le graphe de modules, les
                            styles, la police et le filet `data/seed.json`
                            sont-ils tous dans le `FICHIERS` de sw.js ?
scripts/check_packs.mjs     les packs selon le niveau des joueurs (S80) : les
                            fréquences observées par niveau contre les taux
                            affichés, la pureté, les familles, avant et après
scripts/smoke.mjs           test de fumée Playwright à 390 px
scripts/mesure_defilement.mjs le défilement du vestiaire à 390 px, processeur ×4 :
                            images par seconde sur une vraie liste et sur trois
                            cents cartes (S77) — ne juge rien, mesure
scripts/smoke_table.mjs     le même, en mode bonus : le tournoi, le plateau, un
                            match joué geste par geste, le bilan
data/trophees.js            Selke, Norris, Vezina, Conn Smythe — gagnants et finalistes
data/reputations.js         les réputations curées : 179 joueurs marquants
data/index.json             liste des saisons disponibles
data/seasons/<saison>.json  un shard par saison
data/seed.json              filet hors ligne
data/salaries/<saison>.json salaires réels publiés (playerId -> $ de l'époque), facultatif
```
