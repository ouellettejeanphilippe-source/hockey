# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs. Plusieurs modes : **le 82-0** (juste le repêchage ; la saison se simule d'un coup, les séries se regardent match par match, aucune carte), **le Rogue** (le jour à jour, le duel à ton tableau, les cartes de tes places, la boutique, la run), **Sur table** et l'exhibition.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Où on travaille

Le Rogue, tout le temps, sauf si JP demande expressément un autre mode. Le 82-0, Sur table et l'exhibition sont faits : les stats, un peu de hasard, rien de plus. Une mesure, un équilibrage, un correctif se jugent d'abord en Rogue (`scripts/lib/rogue_sim.mjs`, `check_rogue`, `essai_rogue`).

## Avant de coder

Lis `LIVRAISON.md` — c'est le plan de travail courant vers la 1.0 : les jalons, chaque item avec son fichier, sa valeur et le script qui le prouve. Coche les cases au fur et à mesure et ajoute une ligne à son journal.

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `MOTEUR.md` — c'est la spécification de la refonte de la simulation par événements, avec les mesures qui appuient chaque choix. Si tu touches à `js/sim.js`, lis-le avant, et `docs/moteur-recalibrer.md` pour la recalibration.

`PLAN.md` garde l'état court et les décisions prises. L'histoire de chaque décision (pourquoi, ce qui a été essayé et écarté, mesuré) est dans `docs/decisions.md` ; le journal sprint par sprint dans `docs/journal/`. Avant de défaire une règle ci-dessous, lis sa décision.

## Structure

```
index.html            la page unique : l'en-tête du club, les sections, roulette, vestiaire, alignement, modales
style.css             tous les styles, une seule feuille écrite dans l'ordre des écrans (docs/refonte-ui.md), mobile d'abord (390 px), le rail dès 1000 px
sw.js                 travailleur de service : la coquille hors ligne (FICHIERS), les visages en cache
site.webmanifest, favicon.svg, icon-*.png   installation et icônes
fonts/                Barlow Condensed (OFL), hébergée ici
data/                 shards par saison (seasons/), index, seed, portraits.json, salaires, trophées, réputations
img/logos, img/mugs   écussons des 44 franchises et visages recadrés (scripts/logos.mjs, scripts/portraits.mjs)
img/actions           photos de match recadrées en 5:7, la face au centre, pour les éditions hautes des cartes (≈ 50 Mo, versionnées depuis oct. 2026 ; scripts/actions.mjs les refait ; data/actions.json les liste)

js/game.js            le contrôleur : l'état G, render(), le démarrage, la sauvegarde, les sections et l'en-tête, l'historique
js/repechage.js       la roulette, le vestiaire et le loto, la signature, la barre du plafond, le bassin de cartes
js/joueurs.js         l'onglet Joueurs : l'effectif en tableau triable (jambes, saison à ce jour ou vraie saison, salaire)
js/alignement.js      les cases, les trios et les paires, le système en fenêtre, le résumé d'équipe
js/fiche.js           la fiche d'un joueur : recto verso, ses rôles, l'impact, le profil mesuré
js/banc.js            derrière le banc : les décisions en saison, le ballottage, l'écran de saison
js/partie.js          l'écran « Nouvelle partie » (le brouillon)
js/rogue-jeu.js       le Rogue à l'écran : jetons, boutique, packs, inventaire, départ, la run
js/modes-table.js     le tournoi Sur table, ses règles, son bilan, le match d'exhibition au plateau
js/charge-table.js    charge le mode Sur table à la demande (table, tournoi, plateau) : MT.nom, chargerTable()
js/sim.js             l'alignement, le moteur de match, la ligue au jour le jour, les séries ; tout son hasard passe par hasard()
js/ratings.js         les cotes cachées (partagé navigateur + build) : sous-cotes, valeur, salaire, rôles, zones
js/data.js            le chargeur trois niveaux (shard, API, seed) et le cache IndexedDB
js/saison.js          l'écran de saison et des séries : le Bureau (À faire, la route, hier soir), Effectif › Dépistage, Ligue › Ta saison, les choix
js/gerant.js          la fenêtre du système d'une ligne, les choix, l'écran du duel (`ouvrirDuel`, ton tableau)
js/bilan.js           le bilan de saison : onglets, palmarès, calendrier, séries
js/coquille.js        la coquille fixe : l'écran de saison inscrit ses volets auprès des sections
js/pile.js            le retour, un niveau à la fois : Échap, bouton B, retour Android, « ‹ Retour »
js/manette.js         la manette et le clavier : le focus au voisin, l'anneau lumineux, les invites
js/direct.js          un match en direct, rejoué depuis sa feuille
js/commentaire.js     le commentateur du direct
js/recit.js           les mots du sommaire d'un match
js/scenes.js          les scènes des choix du Rogue : qui demande, le fait déjà joué, sa réplique sans chiffre — `check_clarte` § 5
js/causes.js          ce qui a fait le match : les causes qui ont décidé d'un lancer, dites à ton club (sommaire, direct, bilan)
js/entracte.js        le rapport d'entracte en cartons
js/pronostic.js       le dépistage d'avant-match
js/impact.js          l'impact en chiffres de match : ce que le moteur joue, dit pour ton club (« ≈ +1,2 tir par match »), jamais en « % » ; partagé navigateur + Node
js/equipes.js         l'écran des équipes et leurs vraies statistiques
js/combat.js          la main de l'adversaire d'un gros match qui n'est pas un duel (le 82-0) ; ta main est partie (V13-2)
js/places.js          les places neuves (V10) : hors combat, chacune son moment de la semaine
js/equipement.js      l'équipement neuf (V10) : posé sur un joueur, il attend son moment
js/personnel.js       le personnel neuf (V10) : un poste par rôle, chacun son moment de la saison ; les contrats lourds
js/dossiers.js        les dossiers de la semaine (V10) : ce qui arrive à ton club, dit par sa voix, un lundi sur deux — `check_dossiers`
js/cartes.js          le gabarit des cartes (recto, verso, finitions)
js/rarete.js          les variantes de carte et leur bonus
js/galons.js          les galons d'une saison de Rogue (40 buts, 50 passes…), lus dans le journal du club
js/banque.js          la banque de cartes (patrons, événements, modifs, consommables, contrats), le build : la couleur et le compte de chaque coach
js/echelons.js        le personnel qui monte (V14) : la force et le défaut, les échelons, les matchs à ton service, les doublons
js/coachs.js          les coachs (v2) : neuf philosophies, la couleur d'une carte lue sur ses canaux, la confiance à 3, 6 et 9 cartes
js/packs.js           les packs de joueurs et de cartes, leurs taux
js/niveaux.js         le niveau d'un joueur dans sa saison : Soutien → Phénomène
js/inventaire.js      l'inventaire, tes trois places et la revente
js/magasin.js         la boutique
js/rogue.js           le mode Rogue : jetons, mandat, déblocages, jalons
js/club.js            ton club : les noms, les couleurs et les écussons qui se débloquent, le choix porté
js/depart.js          le départ d'une run (le classeur)
js/cartable.js        le cartable des joueurs gagnés
js/album.js           l'album d'une partie à l'autre
js/ballottage.js      le ballottage, en fonction pure (Node et navigateur)
js/visages.js         l'application Android : télécharge et recadre les visages sur l'appareil
js/recadrage.js       le recadrage d'un portrait (partagé par scripts/portraits.mjs et js/visages.js)
js/actions.js         les photos d'action : actionSrc(id) pour une carte ; l'appareil Android les télécharge et les recadre
js/recadrage-action.js le recadrage 5:7 d'une photo de match (partagé par scripts/actions.mjs et js/actions.js)
js/identites.js       l'identité de départ
js/traits.js          les traits, tirés des votes de data/trophees.js
js/roles_ref.js       la référence des rôles
js/franchises.js      les franchises et leurs relocalisations
js/logos.js, js/logos_locaux.js   couleurs et écussons des 44 franchises
js/menu.js            l'écran titre, et le même écran en menu pause en pleine partie
js/sauvegardes.js     les parties sauvegardées, et leur export en fichier transférable, importé au menu — `check_sauvegardes`
js/mouvement.js       les chiffres qui se comptent
js/exhibition.js      l'exhibition
js/table.js           Sur table : le moteur du plateau et reglesDuPlateau()
js/plateau.js         Sur table : l'écran du plateau
js/tournoi.js         Sur table : le tournoi de six clubs
js/sons.js            les effets sonores synthétisés (Web Audio)

scripts/              build des données (build_shards.py, rate.mjs, rerate.mjs, portraits.mjs, actions.mjs, recrues.mjs → data/recrues.json
                      la vraie saison recrue…), vérifications (check_*.mjs, smoke*.mjs, tout.mjs qui enchaîne les rapides),
                      calibration (calibrate_sim, mock_*), verdict.mjs (le juge partagé), lib/mort.mjs (la mesure du code mort)
mobile/, desktop/     l'APK (Capacitor) et l'exe (Electron) ; seul leur code est versionné
mobile/assembler-www.mjs  www/ de l'APK : sans data/salaries ni data/seed.json, JS regroupé en lots et minifié,
                      CSS minifié (esbuild, devDependency de mobile/ seulement ; --brut pour s'en passer),
                      cartes de sources à côté dans www-cartes/ ; la liste hors ligne de sw.js est réécrite
docs/                 l'historique et la référence (voir docs/README.md)
```

La version longue, fichier par fichier, est dans `docs/structure-detaillee.md`.

## Règles fermes

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md`.

**Les cotes et les données**
- Aucune cote dans le DOM, jamais ; ce qui s'affiche est un rang (le niveau) ou une vraie stat, jamais une cote — smoke `sansCote`.
- Une seule implémentation des cotes (`js/ratings.js`, partagée par le build et le navigateur) ; toucher une formule, c'est incrémenter `RATINGS_VERSION`.
- La valeur est relative à la saison par construction ; la force d'équipe suit le vrai classement — `check_ratings` (corrélation autour de 0,8).
- Un joueur-saison ne peut habiller qu'une équipe.
- Pas de scraping de hockey-reference ni hockeydb ; les salaires réels arrivent par `data/salaries/sources/`.

**Le moteur**
- Tout le hasard du moteur passe par `hasard()` ; la même graine et les mêmes dés du jour rejouent la même saison, et chaque journée tire ses dés quand elle arrive (`deDuJour`) — `check_graine`.
- La ligue se joue au jour le jour : rien n'est simulé d'avance, une décision s'applique au jour dit, et les journées d'avant ne bougent pas — `check_graine`, `check_ballottage`.
- Une saison en cours se REJOUE plutôt qu'elle ne se relit ; les séries aussi.
- Les égalités de la feuille de match tiennent — `check_feuilles` (sur table : `check_table`).
- Ce qui a fait le match se dit cause par cause : une carte, un badge, un système, le gardien n'est dit que si, retiré seul, il changeait le lancer, avec le même dé — `check_causes`.
- La production se répartit comme la vraie saison l'a répartie — `check_parts`.
- Le direct, le sommaire et le bilan disent les mêmes buts, au caractère près — smoke.
- Aucune cote neuve, aucune mécanique neuve : une carte, un trait, un effet passent par les canaux existants — `check_combat` (chaque carte que l'adversaire peut jouer est lue par le moteur), `check_traits`. Une exception, voulue (V15, JP : *les badges des joueurs influencent les styles de trio possibles*) : en Rogue, les badges d'une unité ouvrent ses styles (`veut`, `styleOuvert`) et leurs métaux font leur force (`fitUnite`) ; le plan de la V9 (les familles payées) est parti ; le 82-0 n'y joue pas — `check_styles`, `check_profondeur`.
- On mesure une carte EN PAIRES, sinon on ne mesure rien — `check_cartes`.
- Une carte peut ne jouer que dans son moment (`si` : un des `MOMENTS_SI` de js/sim.js — le lieu, les séries, le dos-à-dos, les jambes, le rival ou la bête noire, la forme, l'infirmerie, l'intention annoncée d'un duel ou sa 3e période) : elle frappe alors plus fort ses soirs-là, rien hors d'eux, et sa face dit son moment en premier. Un moment se lit sur ce qui est déjà joué, jamais d'avance, et revient assez pour qu'une carte ne soit pas morte — `check_si`, `check_moments_si`, `check_places`.
- Une carte change la FORME du match, pas sa force : le net en victoires est borné par la rareté (commune ±1, peu commune ±1,5, rare ±2,5, légendaire ±4 : un maximum, jamais une cible), une rare ou une légendaire se VOIT dans la feuille (±2 tirs, ±0,3 but des deux clubs, ±0,5 punition, ±4 mises en échec ou ±3 blessures ; sur un joueur nommé, ±0,3 point à sa ligne — `check_places`), et le style ne se paie pas en force : au plus 0,5 V par seuil franchi — `check_cartes`.
- Les gros matchs portent leur plan, leur contre et leur pointage après deux périodes — `check_gros`. En Rogue (V9), ce sont des duels de trois périodes, une intention chacune, et les périodes vues ne bougent pas — `check_gros`, `check_duel`.
- Deux clubs égaux, le duel bien joué contre le mal joué : 62 à 65 % en face à face, jamais plus de 70 % — `check_duel`.
- Au duel, ta réponse est ton tableau de la période (V13), sans main de cartes (V13-2) : une porte pleine ou deux demi-portes contrent leur intention, chaque réglage garde son prix, et aucun tableau qui ferme tout d'avance ne vaut le duel bien joué — `check_tableau`.
- Le robot « premier Signer » ne gagne pas la Coupe — `check_robot`.
- Une carte seule reste sous la borne de sa rareté et la première run reste dure ; une run qui a duré, ou un build qui s'emboîte, a le droit de casser le jeu — c'est la récompense du Rogue (docs/refonte-v3.md, principe 5).
- Après sa première Coupe, le gérant attentif la regagne sans la gagner d'office : il monte les exigences (V9, tranche 8) — `check_profondeur`.

**L'économie (Rogue et boutique)**
- Revendre un pack de cartes rapporte au plus 40 % de son prix — `check_packs`.
- L'achat s'enregistre avant le butin ; la prime de série est versée — `check_rogue`.
- Le ballottage offre un dépanneur (niveau Régulier au plus), pas une vedette — `check_ballottage`.
- Une carte ne se prend qu'une fois, et un palier n'arrête l'avance qu'une fois.
- Aucun joueur ne te suit au choix (JP : *garder des joueurs de run en run devrait être fait dans une loto, pas genre tu peux prendre qui tu veux*) : le classeur, les lotos du cartable et ceux qui restent sont des lotos par niveau (`lotoDeCase`) — `check_rogue`.
- Une carte trouve son coach sur ce qu'elle fait (ses canaux), jamais sur une étiquette collée ; la confiance d'un coach est une décision `coach` qui porte ses chiffres, et un seul coach est en poste à la fois — `check_coachs`.
- L'adversaire ne pige pas les cartes de match de la v2 (`horsAdverse`) : sa main est calibrée, la difficulté ne bouge pas — `check_gros`, `check_robot`. Au duel, il n'a pas de main : ses intentions en tiennent lieu.
- Chaque coach a au moins huit cartes, dans deux familles au moins ; le Rhino, l'Abbé et le Contremaître, sans canal de joueur ni équipement, ont six places au lieu de trois (V13-2) — `check_coachs`, `check_places`.

**Sur table**
- Les règles du plateau sont ÉCRITES DANS LE CODE (`reglesDuPlateau()`) et affichées de là ; le moteur ne les viole jamais — `check_regles`.
- La rondelle ne se téléporte pas : chaque déplacement est une étape bornée — `check_regles`.

**L'interface**
- Mobile d'abord : rien ne déborde à 390 px, tout ce qu'on touche est atteignable et fait 44 × 44 — smoke `sansDebordement`, `toutEstAtteignable`, `cibles44`. Rien ne colle au bord : un mot, une icône ou une carte tient à 8 px au moins des deux bords (JP : *un petit padding, mieux que pas de padding du tout*) — `essai_rogue` 20n (scripts/lib/bords.mjs).
- Une carte de jeu a le format d'une carte de hockey (JP : *j'aime vraiment le format carte de hockey, pas les autres*) : un carton 5:7 de la série de la glace, aux couleurs de son genre (`carteHtml`, `.cs-jeu`) ; ce qu'elle fait se lit à son verso (JP : *mettre les stats derrière la carte*) : la toucher la retourne, « Prendre » dessous la prend. Au téléphone, les cartes se balaient en grand, une à la fois ; jamais trois étroites côte à côte.
- Une maison par sujet (V12, docs/refonte-v12.md ; JP : *everything coaching should be at same place* ; *that philosophy should be for everything*) : tout ce qui touche un sujet — son état, ses choix et ses cartes — vit dans le sous-onglet de ce sujet, et nulle part ailleurs ; le coaching chez l'entraîneur (le coach, sa confiance, le personnel, ses cartes, le congédiement), la santé à l'infirmerie, le proprio et l'argent au proprio.
- Jamais une longue page : chaque onglet tient en un écran, la page elle-même ne défile jamais ; hors du Rogue, quatre sections (Bureau, Joueurs, Lignes, Ligue), dans le même ordre, aucune carte (ni au 82-0, ni sur table, ni au repêchage) ; en Rogue, quatre sections rangées comme un jeu de gestion (JP : *organise plus comme EHM, avec moins de trucs qui servent pas*) — Bureau, Effectif (Joueurs, Lignes, Dépistage, Infirmerie), Marché, Ligue —, sans écran par match : le Bureau garde le match en une ligne, qui ouvre Effectif › Dépistage, et tes places se jouent au Marché › Tes cartes ; chacune répond à UNE intention de gérant et chaque info a UNE maison (docs/refonte-v8.md) — smoke, `essai_rogue`.
- Un seul retour, un niveau à la fois (js/pile.js) ; rien de sélectionnable, aucun lien souligné ; l'anneau du focus en mode clavier ou manette seulement — smoke.
- À faire ne contient que ce qui se règle, et renvoie au sous-onglet où ça se règle, un usage par sous-onglet (V12, docs/refonte-v12.md) : une ligne par choix — la voix, le sujet, son état —, rangée sous sa maison (Bureau › Proprio, Entraîneur, Presse, Vestiaire ; Effectif › Infirmerie ; Marché › Butin ; le gros match et la signature, sur place). Sous ses choix, chaque sous-onglet montre toujours sa part (le mandat au proprio ; ton coach, ton personnel et la route chez l'entraîneur ; la une à la presse, ton histoire au vestiaire, les blessés à l'infirmerie : `PERMANENT`), et le Bureau ne la redit pas. Le sous-onglet montre chaque choix sous la même forme : la voix, le fait, ses options (`optionHtml`). Toucher une option l'envoie, sur une tuile à coins vifs (JP : *j'aime pas les arrondis, le fait que ça reste*) ; les rivaux se cochent un à un et partent au dernier ; une option › ouvre son écran (le combat, le paquet, une liste). Le jour par jour : en semaine, seul ce qui presse bloque « Jour suivant » (un gros match, un pack à signer, une carte de trop, un blessé à remplacer, une case vide) ; le reste attend le lundi, au même endroit. Ce qui ne demande rien est une nouvelle d'Hier soir, jamais un « Compris » (docs/refonte-v9.md) — `essai_rogue`.
- Toute commande visible doit fonctionner.
- Une surface de base se change À LA SOURCE, jamais en fin de fichier.
- Le noir est le décor ; la couleur vient des équipes, aux vraies couleurs, jamais délavées ; les écussons des disparues sont dessinés (`js/logos.js`), jamais empruntés.
- Moins de mots, et surtout pas les évidents : une ligne à l'écran, le détail chiffré dans la page des règles, dont chaque chiffre vient d'une constante — `check_clarte`.
- Un choix se dit en vraies stats de match : tirs, % au tir, tirs contre, % d'arrêts (`statsDe`, `motsDeStats`, js/impact.js) ; jamais en victoires ni en but net, jamais en note. Sur une carte, chaque stat est une barre qui diverge du match ordinaire, le chiffre dessous (`pucesDeFace`).
- Ton équipe commence en NHL Stars (noir, blanc, orange, l'étoile) ; son club (un nom et SON écusson, vendus ensemble) et ses couleurs s'achètent en jetons à la boutique, comme les packs, et se portent aux déblocages (`js/club.js`), tous inventés et dessinés, jamais empruntés à un vrai club — `essai_rogue`.
- On ne décerne que ce que les colonnes décident, jamais ce qu'un vote déciderait.
- Ce qu'un texte affirme d'un match (un rythme, une disette, trois punitions en deux matchs) est arrivé dans les feuilles déjà jouées, et il dit les vrais chiffres — `check_fils`, `check_vie`.
- Un choix du Rogue dit qui le demande (une voix d'`EXPEDITEURS`), pourquoi maintenant (le fait, en vrais chiffres) et ce qu'elle en pense (une réplique sans chiffre) : une scène de `js/scenes.js` — `check_clarte` § 5, `essai_rogue`.

**Le code et les tests**
- Modules ES natifs, pas de build step, aucune dépendance npm.
- `sw.js` liste tout ce que la page charge — `check_coquille`.
- Zéro code inutile : aucune déclaration morte, aucun `export` ni import de trop, aucune classe CSS sans élément — `check_mort`. Un petit outil qui sert à plusieurs modules va dans `js/util.js`, pas dans une copie de plus.
- Un chiffre qu'on imprime sans le juger est un chiffre que personne ne relit : chaque script passe par `scripts/verdict.mjs`, qui pose le code de sortie.
- Un test de fumée qui dépend du tirage n'est pas un test, c'est une loterie.
- Français québécois, partout.

## Le vocabulaire

Un mot par idée, le même à l'écran, dans le code neuf et dans les docs.

- **jambes** : la fatigue d'un joueur, sur 100 (jamais « % », jamais « énergie »).
- **Sur la glace** : dans la fiche, en mots, ce que le moteur fera du joueur — l'effet de chacun de ses badges à son palier, ce qu'un coup lui coûte (js/fiche.js). Pas une cote, pas une statistique de plus ; le profil en crans a été essayé et retiré.
- **niveau** : ce que le joueur valait dans sa saison, à son poste — Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène (`js/niveaux.js`). Le badge a ses propres mots (Bronze, Argent, Or, Platine), qui ne s'appellent pas « niveau ».
- **rôle** : ce que le joueur fait (sniper, passeur, checker…), une icône et un mot ; un système demande des rôles.
- **famille** : Tir, Jeu, Défense, Robustesse — ce qu'un joueur apporte à ses points égaux, lu sur ses rôles (`famillesDe`, js/sim.js) ; à l'écran en mots (rare, fort, ordinaire, faible), jamais en chiffre ; elle range les packs et le profil, plus les systèmes (le plan de la V9 est parti). **Un style** : le système d'une unité (🌧 Volume de tirs…) ; en Rogue, il ne s'ouvre qu'aux badges qu'il veut (🎯 Sniper ; 🎯 et 🅰 pour la Contre-attaque), les fermés se plient avec ce qui leur manque (V15).
- **badge** : son rôle à un palier — Bronze, Argent, Or, Platine (`badgesDe`, js/sim.js) ; un premier et, au plus, un second qui rend la moitié. Le palier se dit en mot et se voit en couleur (`pal-1` à `pal-4`), jamais en médaille : 🥉🥈🥇💎 nomment les packs. « Palier » reste un mot du code ; à l'écran on dit « Sniper Or ».
- **zone** : où le joueur rend (T1-2, P1…) ; une case porte les zones qui y sont chez elles.
- **carrure** : 🪨 costaud ou 🪶 léger ; elle fait l'agressivité de sa ligne, qui ne se règle pas (`agressiviteDeLigne`).
- **coach** : une des neuf philosophies de `js/coachs.js` (🐝 le Frelon, 🐢 la Tortue…) ; chaque carte a la couleur d'un coach. Pas « école », pas « build » à l'écran.
- **couleur** : le coach d'une carte, ou d'un joueur (celui de son meilleur rôle maîtrisé) ; « Joueur du Frelon ». Une carte sans couleur est **neutre**.
- **confiance** : I, II, III — un seul coach en poste, choisi au début de la saison à la confiance I ; ses cartes jouées le montent à II (6) et III (9) ; une carte prise (un pack, un butin) ne compte qu'une fois jouée. « Le congédiement » en installe un autre, à I, et l'ancien part avec son bonus (V5).
- **prestige** : le rang du club d'une run à l'autre (`js/rogue.js`, du Club de garage à la Dynastie) — médailles 🏅 gagnées à vie et un exploit par rang ; il ajoute des Étoiles et des Phénomènes aux packs, sans qu'aucun rang n'en ferme un (V10). **Les packs qui montent** : la boutique d'une première run vend le Bronze et l'Époque ; un pack de plus s'ouvre à son jalon (`packsOuverts`), et chaque pack monte de deux **crans** en médailles, un joueur de plus puis le métal du dessus (`CRANS_DE_PACK`, `monteeDesPacks`, js/rogue.js ; `tierDuPack`, js/packs.js) — `check_packs`.
- **exigences** 🔺 : en Rogue, après ta première Coupe, les crans que tu montes au départ d'une run, comme l'Ascension de Slay the Spire (`EXIGENCES`, `exigencesDe`, js/rogue.js). Chaque **cran** ajoute la sienne à celles d'avant, par un canal qui existe (le plafond, le prix des packs, le classeur, le quota de Soutien, le barème, le mandat, les gardés), et paie plus de médailles ; la Coupe gagnée au plus haut cran ouvre le suivant. Pas « difficulté », pas « ascension » à l'écran — `check_rogue`, `check_profondeur`.
- **le personnel** (V14) : des cartes, une par poste, nommées par leur style (« Le gardien du fort »), sans nom de personne. Sa **force** (ses canaux qui aident, en vert) et son **défaut** (ceux qui coûtent, en rouge), en vraies stats. Au premier échelon, une carte change le **style**, pas la force (V14b, `check_places`). Un **échelon**, de 1 à 5, devient possible en **matchs à ton service** (deux fois plus vite à la couleur du coach) et s'achète en jetons, de plus en plus cher (`PRIX_ECHELON`) ; à chaque échelon, tu choisis : pousser sa force ou corriger son défaut. Un **doublon** tiré d'un pack ouvre un échelon de plus, d'une run à l'autre ; les échelons se regagnent à chaque run (`MATCHS_ECHELON`, `etatDuPersonnel`, js/echelons.js) — `check_personnel`. « L'adjoint » qui joue une série pour toi est un entraîneur adjoint ; les adjoints du coach à chaises (V13-3) sont partis.
- **duel** : le gros match du Rogue, en trois périodes (V9). **Intention** : ce que l'adversaire annonce avant une période, et qui vise tes joueurs par leur nom (🥷 l'ombre, 🦈 la chasse, ⛔ fermer le centre, 🐗 l'assaut, 🦂 les punitions). **Le tableau** (V13) : ta réponse, le temps de la période — le système de chaque unité, la consigne, et le **geste** qui déplace un joueur ; chaque réglage qui mord sur leur intention est une **porte**, pleine ou à moitié (`lireLeTableau`) ; une intention **contrée** se retourne contre eux jusqu'à la fin du match. **La mise doublée** : avant la 3e d'un duel de saison, le butin ou les sonnés doublent. Le duel n'a plus de main de cartes (V13-2) : mesurée, l'adjoint la jouait presque aussi bien sans rien lire.
- **places** : en Rogue, tes cartes, qui jouent leurs prochains matchs dans leur moment (des packs, une parmi trois aux 9e, 18e et 26e matchs, et le butin d'un gros match gagné), trois au plus (`PLACES`, `placesDeLaPartie`, js/inventaire.js) ; chacune se joue quand tu veux, sans limite par semaine, au Marché › Tes cartes (onglet « Tes places »), et une de trop se vend (À faire). Elles suivent d'une saison à l'autre de la run (Jalon Q). « La poche » et « la main de la semaine » sont parties (V9, tranche 5b) ; le cahier (le deck de match) aussi, avec la main du duel (V13-2).
- **plombier** : le rôle 🪠 d'un attaquant de quatrième trio qui lance et frappe en peu de minutes ; le système 🧰 Trio de plombiers. Les joueurs faibles du départ d'une run sont des **bouche-trous**, pas des plombiers.
- **vestiaire** : la pièce, et l'équipe qui y vit (« le vestiaire est galvanisé ») ; au repêchage, le vestiaire d'une vraie équipe où l'on pige. Ce que les médailles achètent, ce sont **les déblocages** ; l'équipe d'une run, c'est **ton effectif**.
- **cartable** : tes cartes de joueur, d'une partie à l'autre. **classeur** : le tirage de ton cartable au départ d'une run (« Le départ du classeur ») : des **cases**, chacune d'un niveau (une Régulier sans rien, Pilier et ★ Étoile aux pages), un loto de trois cartes de ce niveau (cinq au tri) dont tu gardes une ; un niveau absent, la case prend celui d'en dessous (`departDuClasseur`, `lotoDeCase`, js/rogue.js). Les lotos du cartable entre deux saisons et ceux qui restent (un Pilier et un Régulier de ton équipe finie, `gardesDeLaRun`) se tirent pareil. La **banque** : toutes les cartes de jeu. Un **doublon** est un joueur déjà à ton cartable ; trois doublons montent sa carte d'une édition, jusqu'à l'Or (`monterLesDoublons`).
- **édition** : la carte d'un joueur, de 1 à 5 — Base, Cadre, Hors-cadre, Or, Holo (`EDITIONS`, js/rarete.js) ; chacune change la carte entière et monte ses badges. Elle se monte par les doublons, par un doublon plus fort tiré d'un pack, et par les cartes de l'atelier (🖌 🪟 🔆 ✨). La **rareté** (commune → légendaire, en diamants) est aux cartes de jeu seulement ; « édition » n'est plus le nom d'une carte de l'atelier, qui est une **retouche**.
- **médailles** 🏅 : la monnaie des déblocages ; **jetons** 🪙 : celle de la boutique. L'**écusson** est un logo, jamais une monnaie.
- **coach** : seulement la philosophie ; la personne derrière le banc est **l'entraîneur** (« L'entraîneur des gardiens »).
- **relance** : seulement le dé qu'on relance (la roulette, la relance d'équipe sur table) ; la sortie de zone se dit « sortie », la passe du gardien « remise ».
- **rejouer** : les mêmes clubs, d'autres dés (« Rejouer la saison ») ; l'historique « reprend l'alignement », une décision « reprend la saison ».
- **rival** : un club à deux rangs ou moins ; la **bête noire** 😤 : celui qui t'a battu deux fois ; **ta rivalité** : le club le plus croisé en gros match.
- **dossier** : en Rogue (V10), ce qui arrive à ton club un lundi sur deux, s'il arrive vraiment — trois soirs sur la route, l'infirmerie qui déborde, un rival dans la semaine, la caisse à sec (`DOSSIERS`, js/dossiers.js) ; une voix le dit, et ses réponses passent par la porte des dilemmes. Les **événements** ne sont plus des cartes. Pas « situation », qui est au vestiaire (`SITUATIONS`, js/sim.js).
- **fil** : une histoire de ta saison lue dans les feuilles jouées (la course, le Cheechoo, la disette, le duo…, `filsDeSaison`, js/recit.js) ; **la une** : le fil le plus lourd d'hier soir, au bureau. En Rogue (V9), un fil fort (le Cheechoo, la disette, le duo, la recrue) ouvre un choix dans À faire (`CHOIX_DES_FILS`, js/vie-gm.js) ; son **retour** se relit dans les feuilles quelques matchs plus tard, à la une, avec ses vrais chiffres (`retoursDuMatin`, js/sim.js) — `check_retours`.
- **jouer blessé** : en Rogue, un blessé (ni commotion, ni fracture, ni ligaments ; 8 matchs ou moins à faire) joue diminué — « Il joue amoché » — le temps qu'il lui restait ; blessé encore, il manque aussi ce temps-là (`jouerBlesse`, js/sim.js). Le physio peut aussi ramener plus tôt un blessé à mi-chemin. Une commotion se garde : la suivante s'allonge, d'une saison à l'autre de la run.
- **scène** : la mise en scène d'un choix du Rogue — la voix qui le demande, sa réplique entre guillemets, le fait sous elle (`sceneDeLaMise`, `sceneDuPalier`… js/scenes.js) ; le prix et le gain restent aux options.
- **voix** : qui écrit dans la boîte (le proprio, l'entraîneur, l'analyste à la télé, les partisans, le capitaine, le physio, le joueur lui-même…) — une seule distribution, `EXPEDITEURS` (js/vie-gm.js). Une voix dit le fait d'un fil et y ajoute une opinion, jamais un chiffre — `check_fils`. En Rogue, le soir où un fil rare naît (le Cheechoo, la recrue, 40 buts, un rythme de 50), sa voix paie une **prime** en jetons (`primesDesFils`, js/rogue.js).
- **moment** : ce qu'une carte attend pour jouer (`si`, `MOMENTS_SI`, js/sim.js) — « Un soir de dos-à-dos », « Quand ils annoncent l'ombre », « Contre ta bête noire » ; courant (au moins trois soirs par saison) ou rare (les séries, la bête noire, le duel), et qui vaut plus par soir (docs/refonte-v10.md).
- **lancée** : en Rogue, un joueur qui vient de marquer beaucoup finit mieux tant que ça dure ; le **doute**, le vrai marqueur en panne qui finit moins bien (`lanceeDe`, js/sim.js — `check_lancee`). Pas « confiance », qui est aux coachs ; jamais dans le 82-0. La lancée **vive** est celle de ☄️ l'étincelle ; la braise, la traînée de poudre et le vendeur de chandails l'entretiennent (le premier combo du Rogue, `check_combo`).
- **trait** : ce qu'un vote ou une réputation donne au joueur (🛡️ Selke, ⚡ vitesse) ; un **trophée** se décerne au bilan, sur les colonnes.
- **galon** 🏵 : en Rogue, ce qu'un joueur a fait chez toi dans une saison (40 buts, 50 passes, 30 victoires, 5 points dans des gros matchs gagnés, 40 points d'une recrue), gravé avec son match et son adversaire (`GALONS`, js/galons.js) ; son badge monte d'un métal pour le reste de la run, deux au plus, et sa carte en garde une copie de plus. **Son histoire chez toi** : ses saisons de run, sur sa carte (`graverLaSaison`, js/cartable.js). **Le panthéon** : les records, les trophées et les chandails retirés du club, d'une run à l'autre (`graverAuPantheon`, js/rogue.js) — `check_galons`.
- **unités spéciales** : AN 1 et AN 2 (l'avantage numérique), DN 1 et DN 2 (le désavantage) ; le moteur les range, l'onglet AN · DN des Lignes les change (`speciales`, `check_speciales`).
- **consigne** : 😌 Basse, 🎚️ Normale, 🌡️ Haute ; **agressivité** : 🕊️ Prudente, ⚖️ Moyenne, 💥 Musclée, 🪓 Rentre-dedans.
- **contrat** : une carte de masse salariale (💵) ; une modif de joueur qui touche son contrat est une **clause**.
- **usure des jambes** : ce qu'un match coûte aux jambes (la puce « Usure des jambes +12 % »).
- « énergie » n'est plus un mot de l'écran (il voulait dire cinq choses) — `check_clarte`. Les clés du code (`energie`, `ENERGIE_MAIN`) restent, pour ne pas casser les sauvegardes.
- **Une icône = un sens** dans les étiquettes qu'on voit en jouant : rôles, systèmes, trophées, bonus de carte, styles de gardien, carrure, agressivité, consigne — `check_clarte`. Avant d'ajouter une icône, cherche-la dans `js/`.

## Les PR et la fusion

JP (11 oct. 2026) : Claude fusionne quand le CI est vert. Après avoir ouvert une PR, Claude y active l'**auto-merge** (squash ou merge, selon ce que le dépôt permet) : GitHub la fusionne seul dès que la vérification `verifier` passe au vert sur main. Il n'attend pas de relecture humaine, sauf si JP dit « attends-moi » pour une PR précise. Si le CI est rouge, la PR reste ouverte et Claude la répare. Une PR qui ne doit pas partir (un brouillon, une expérience) s'ouvre en brouillon, sans auto-merge.

## Tester

Sert la page — `python3 -m http.server 8000`, ou sans Python `node <un petit serveur statique> . 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft conscient du budget : à chaque tour il lit le plafond restant, calcule ce qu'il peut mettre sur ce choix sans passer sous le plancher pour les cases suivantes, et signe, parmi les cartes qui tiennent dans ce budget, celle dont la destination ne porte aucun avertissement et dont le chiffre clé est le plus grand (voir S64 : prendre la première rendait une équipe de .500 et faisait du passage des séries une loterie). Sinon il relance (passer, autre équipe, autre année) ; en dernier recours il clique `#freeCapBtn`, le bouton de la bande de secours qui retire le plus gros contrat
3. `#mainBtn` devient actif
4. Cliquer : le 82-0 va droit au bilan (aucun `#hubModal .hub-jour`), `.result .score` affiche une fiche et `.rrow` en compte 23. Les séries : « Match suivant », le tableau en cours (`.bk-serie`), un match en direct, la fin, puis l'onglet Séries du bilan — sans les Lignes du match ni deck (le jour à jour s'éprouve en Rogue : `essai_rogue.mjs`)
5. « Rejouer la saison » (`#replayBtn`) rejoue le même alignement contre les mêmes clubs, puis l'historique (`.lb-replay`) relit un alignement et repart une saison — droit au bilan à chaque fois
6. Le même parcours en tirage Loto (`#rrL` relance quand rien ne tient dans le budget)
7. Zéro erreur console (les portraits refusés ne sont demandés qu'une fois : `PORTRAITS_ABSENTS`)

`node scripts/smoke_table.mjs http://localhost:8000` fait le même parcours en mode bonus : l'option « Sur table » dans les options, le même auto-draft, le tournoi (`#hubModal`), le plateau (`#tableModal`, 247 cases, deux filets d'une case) où il joue un match geste par geste — il touche une pièce, lit les cases allumées, choisit des modes, dégage, tire, saute des verdicts en touchant la glace, dépense des relances d'équipe, change de trio — puis le reste du tournoi et le bilan. Il échoue si moins de quinze gestes ont pu être joués : c'est ce qui attrape une interface qui se fige.

L'Action `verifier.yml` fait tout ça à chaque PR, plus `check_graine.mjs` et `check_feuilles.mjs` sur une ligue, plus `check_fiches.mjs`, `check_table.mjs`, `check_regles.mjs` et `smoke_table.mjs`. Les scripts de calibration (monotonie, plafond, tireurs) restent à lancer à la main.

**Avant de pousser** (JP, 13 oct. : *c'est nécessaire de tester ici et en CI ?*) : ne relance pas ici ce que `verifier` refait. Ici, seulement `node scripts/tout.mjs` et `check_mort` (quelques secondes, un rouge en CI coûte une demi-heure), plus ce que le CI ne fait pas, quand le changement touche leur terrain : `essai_rogue`, `essai_packs`, `essai_achat` pour la signature, la boutique ou le jour à jour du Rogue ; `check_rogue`, `check_banque`, `check_cartes` quand on touche au moteur ou aux cartes. Le smoke, smoke_table, `check_gros`, `check_graine`, `check_feuilles` : le CI.

`node scripts/tout.mjs` enchaîne les vérifications rapides (moins de quinze secondes chacune) ; `node scripts/tout.mjs check_deck check_packs` n'en lance que quelques-unes. `check_packs`, `check_gardiens`, `check_combat` (une demi-minute chacun), `check_jambes` (une minute) et `check_banque` (une demi-heure et plus ; `FAMILLES=patrons PART=1/4` n'en mesure qu'un quart, pour le partager entre quatre processus) se lancent à part.

Depuis la v2 : `node scripts/check_coachs.mjs` (dix minutes : la couleur des cartes, la confiance, et chaque coach mesuré en paires à six ligues ; `LIGUES=0` en CI).

Depuis la V2.3 : `node scripts/check_voies.mjs` (quarante minutes ; `VOIES=tortue,essaim` en partage le travail entre processus ; `LIGUES=0` en CI) — chaque coach à sa III, sur une équipe bâtie pour lui, vaut +6 à +8 V, à ±1 V des autres, plus que sur une équipe mélangée ; la composition (le prix des rôles à salaire égal) se dit à côté.

L'impact des choix en chiffres de match (`docs/impact-des-choix.md`) : `node scripts/check_chiffres.mjs` (une minute : ce que l'écran annonce égale ce que le moteur joue, en paires) et `node scripts/check_impact.mjs` (douze secondes : la base de la ligue, le témoin à zéro ; `COMPLET=1` le tableau de chaque choix).

Depuis la V3 : `node scripts/check_si.mjs` (onze minutes, douze graines : les cartes d'un moment, en paires), `node scripts/check_lancee.mjs` (une minute : la lancée et le doute du Rogue, absents du 82-0), `node scripts/check_combo.mjs` (trois minutes et demie : le feu qui s'entretient, chaque pièce seule sous sa borne, le build complet qui casse le jeu, en paires) et `node scripts/check_fils.mjs` (six secondes, dans `tout.mjs`) — les fils de la saison (la une, « Ton histoire », la section Histoire du bilan) citent des feuilles réelles, chaque chiffre s'y recompte, rien ne lit l'avenir. Le plan de la V3 : `docs/refonte-v3.md`.

Depuis la V10, tranche 1 : `node scripts/check_moments_si.mjs` (une minute, au CI) — un effet d'un moment ne joue que son soir, et dans une vraie ligue la saison diverge exactement au premier soir de son moment ; les moments d'un soir sont ceux d'une ligue jouée jusqu'à lui ; chaque moment courant revient au moins trois fois par saison de run, sans être vrai plus des trois quarts des soirs, et chaque rare au moins une fois. Le plan de la V10, le jeu de cartes neuf : `docs/refonte-v10.md`.

Depuis la V10, tranche 3 (et 4, le personnel et les contrats lourds ; 5, les réponses des dossiers) : `node scripts/check_places.mjs` (douze minutes ; `N` matchs par club et par carte, 1000 ; `CARTES=a,b` quelques-unes) — chaque place et chaque équipement en paires, match par match, son moment posé (`_lireMoment`) : hors de son moment, la feuille est identique ; dans son moment, sous la borne de sa rareté, sur ses soirs (`parSaison`, `MOMENTS_SI`) ; une rare se voit ; trois cartes par coach et par pile.


Depuis la V9, tranche 5 : `node scripts/check_duel.mjs` (une minute et demie ; `N` matchs par club et par bras, 2500 pour la précision qu'exige la cible) — deux copies d'un même vrai club, le duel bien joué contre le mal joué, sur les mêmes dés ; les périodes vues ne bougent pas.

Depuis la V9, tranche 6 : `node scripts/check_retours.mjs` (deux minutes ; `GRAINES=83,85,86`) — le choix d'un fil ne touche pas aux journées d'avant, son retour arrive le matin qui suit son dernier match et se recompte dans ces feuilles-là ; le jouer blessé, l'aggravation, la mémoire des commotions.

Depuis la V13 : `node scripts/check_tableau.mjs` (trois minutes ; `N` matchs par club et par bras) — au duel, chaque porte de ton tableau contre comme elle le dit, le moteur joue le tableau qu'on lui donne, et aucune couverture (un tableau qui ferme tout d'avance) ne vaut le duel bien joué.

Depuis le Jalon P : `node scripts/check_arcs.mjs` (deux minutes) — chaque arc naît d'un fait relu dans le journal du club, joue son effet, se rejoue pareil ; sa valeur se mesure en blocs appariés (ses matchs avec et sans son effet, les mêmes dés), jamais en saisons appariées, qui divergent au moindre écart.

`node scripts/essai_poids.mjs <adresse>` (une demi-minute) mesure le premier écran comme un téléphone le vit, processeur ×4 : les requêtes, les octets compressés, le temps du titre ; sur le www/ de l'APK (`mobile/assembler-www.mjs`, servi à part), les trois tiennent.

`node scripts/essai_packs.mjs http://localhost:8000` (une vingtaine de minutes) signe des packs de joueurs tour après tour, avec « Aligner au mieux » un tour sur deux et « Plus tard » puis la boîte : chaque joueur signé reste dans l'alignement de l'écran, qui est celui du moteur.

Depuis la V15 : `node scripts/check_styles.mjs` (une seconde : chaque style veut des badges que ses cases demandent, un vrai trio n'en ouvre ni tous ni aucun, plus de badges en ouvrent plus, un style fermé joue le meilleur ouvert en Rogue). Depuis la V9 (docs/refonte-v9.md § 10) : `node scripts/check_profondeur.mjs` (un quart d'heure ; `GRAINES=1 CAMPAGNES=1 RUNS_CAMPAGNE=2` en deux minutes : trois robots sur les mêmes dés, `politique` de scripts/lib/rogue_sim.mjs — le robot d'avant, l'attentif, le distrait ; les deux bouts, la première Coupe des campagnes). Ce n'est pas une vérification de la CI : `check_profondeur` est rouge tant que la première Coupe arrive avant la run 3, ou qu'après elle l'attentif gagne la Coupe d'office (les campagnes montent les exigences ; le point de départ : docs/refonte-v9.md § 14, la tranche 8 : § 21).

Depuis la V14 : `node scripts/check_personnel.mjs` (deux minutes ; `N` matchs par club) — les chiffres de chaque échelon, les doublons, et, en paires, une force qui grandit et un défaut qui fond.

Depuis la 1.0 : `node scripts/check_robot.mjs` (le robot « premier Signer », 40 saisons, avec et sans ballottage ; `BALLOTTAGE=1`, `MODE=rogue`) et `RUNS=40 CAMPAGNES=6 node scripts/check_rogue.mjs` (la courbe des runs). Les photos d'action : `node scripts/actions.mjs` les refait (deux minutes, 700 Mo téléchargés une fois) et `node scripts/check_actions.mjs` les vérifie (avec l'adresse du jeu en argument, il simule aussi l'application Android ; réseau requis). Playwright peut vivre ailleurs que dans le dépôt : `NODE_PATH=<dossier>/node_modules`.

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne mets pas les cotes cachées dans le DOM avant la simulation. Un joueur curieux qui ouvre l'inspecteur ne devrait pas pouvoir les lire. Elles vivent dans le coffre privé `RATINGS_VAULT` (js/sim.js), hors de `window.cap82.G`, et ne sortent que pour la simulation.
