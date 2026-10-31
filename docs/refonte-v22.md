# V22 — La banque d'événements et les adjoints, refaits à neuf

JP, 31 oct. 2026 : *les événements et adjoints, c'est encore à chier. Supprime tout, fais un plan de quoi on fait, et repars sans reprendre* ; *je veux supprimer la banque d'événements, pas le système* ; *coach plus adjoints dans une main, qui sont là x matchs et changent le style de l'équipe* ; *soumets pas de PR avant d'avoir refait*.

On casse les vieilles parties (JP, V21 : *on s'en fout de briser les saves*). Une vieille décision dont la famille n'existe plus ne joue rien et ne plante pas (`check_sauvegardes`).

## Ce qui est parti (phases 1 et 2)

**La banque d'événements** — le contenu, pas le système :

- les 19 dossiers de la semaine (`DOSSIERS`, js/dossiers.js), dont `laMasse` et `laTete` ;
- les quatre choix de fil (`CHOIX_DES_FILS`, js/vie-gm.js : le Cheechoo, la disette, le duo, la recrue) ;
- les courriels, les points de presse et les dilemmes de la vie d'un DG-coach (js/vie-gm.js, ~760 lignes) ;
- les 23 dilemmes (`MOMENTS`), les séquences (`SEQUENCES`), leurs faits (`FAITS`, `faitsDuClub`) et leurs tirages (`momentDuJour`, `matchDuMoment`, `JOURS_MOMENTS`) ;
- les 20 arcs (`ARCS`, js/arcs.js) ;
- `CARTES_MATCH_VIE` (js/cartes-vie.js, déjà vide).

**Les adjoints du staff de la V21** (js/adjoints.js) : les douze échanges, la main de six, les trois en poste, le bras droit (`BRAS_DROIT`), les « légers d'abord », l'écran Bureau › Coach › Ton staff, les offres des 9e, 18e et 26e matchs, du butin d'un gros match gagné, du verdict du proprio et des dossiers.

## Ce qui reste (le système)

La boîte « À faire » et ses spécifications (`messagesCourants`, `specsForces`), `semaineAHistoire` et `dossierDeLaSemaine` (qui rend `null` tant que la banque est vide), `appliquerGestes`, `pariDeDecision`, `familleDeMoment` (les familles `fil` et `dossier`), `js/scenes.js`, `EXPEDITEURS`, `joueurDuFait`, `VOIX_DES_FILS` et la une, les suivis et leurs retours, la boucle des arcs (`episodesDuMatin`, `DEFIS`, `avanceDuDefi`), `MOMENTS_SI`, `SITUATIONS`, `deposer.js` (les Lignes s'en servent), tous les choix du gros match, de la signature, de la blessure, du physio, du proprio, des rivaux, du talent du coach, et le duel avec son adjoint qui propose les plans (V17).

Le coach garde ses pouvoirs seuls : `forceDuPouvoir` = talents × maîtrise de l'entraîneur.

## Phase 3 — Les adjoints : une main, des séjours, un style (fait le 31 oct.)

JP, 31 oct. : *simple, impactant, le fun, marquant*. Quatre mots, quatre règles. Tranché par JP : 12 matchs, les cases suivent le niveau, la carte revient dans la main (main bornée).

**Simple — une carte, un style, un séjour.** Un adjoint est une carte de hockey (`carteHtml`, `.cs-jeu`) : son nom, son icône, son style en deux lignes au verso — ce qu'il donne, ce qu'il coûte, en vraies stats de match — et son séjour, en matchs. Rien d'autre : ni léger ni lourd, ni bras droit, ni main de six, ni « qui part ? ». Ta **main** tient quatre cartes. Tu en **joues** une quand tu veux (Bureau › Coach, glissée ou touchée sur une case) : elle est en poste **`SEJOUR` matchs** (12), puis elle part d'elle-même. Les cases en poste suivent le niveau du coach : une au niveau 1, deux au niveau 3, trois au niveau 5 — ton personnage monte, son banc s'élargit.

**Impactant — un style court frappe fort.** Un échange permanent de la V21 devait rester petit (±1 tir par match) pour tenir sous sa borne sur 82 matchs ; un séjour de 12 matchs peut frapper trois fois plus fort (±3 à 4 tirs, ±0,4 but, ±0,8 punition par soir, `check_pouvoirs`) et rester sous ±1,5 V sur la saison. Tu le VOIS dès le premier soir, et la feuille le dit (« 🏹 Le canonnier · 12 matchs restants »). Deux canaux par style, jamais plus.

**Le fun — le bon moment.** Jouer une carte, c'est un choix de timing : le canonnier avant la semaine à la maison, le mur avant les trois matchs contre ta bête noire, le gourou des gardiens quand ton n° 1 est chaud. Un style qui rejoint la philosophie de ton coach (le canonnier chez le Frelon, le mur chez la Tortue) dure **16 matchs au lieu de 12** (`SEJOUR_SYNERGIE`) : la synergie, pas un chiffre plus gros. Deux en poste s'additionnent sans règle de plus. Les cartes arrivent aux moments forts, un parmi trois, gratuit : les 9e, 18e et 26e matchs, un gros match gagné, le verdict du proprio, une histoire.

**Marquant — la carte revient, et elle se souvient.** (JP : *il revient dans la main, mais maximum de cartes en main.*) Le séjour fini, Hier soir le dit avec ses vrais chiffres : « 🏹 Le canonnier a fini son séjour : 12 matchs, 8-3-1, +3,1 tirs par match. » La carte **retourne dans ta main** et se **repose `REPOS` matchs** (12 : sans repos, la rejouer de suite en ferait un échange permanent, et un style court ne pourrait plus frapper fort) ; puis elle se rejoue. Son verso compte ses séjours chez toi (« 3 séjours · 24-9-3 »), comme les galons d'un joueur. La main tient **`MAIN_MAX` cartes** (4), en poste comprises ; pleine, une offre dit laquelle part si tu prends (la plus ancienne hors poste), et tu peux passer. Chaque adjoint a une voix d'`EXPEDITEURS` : il se présente à son arrivée, une réplique sans chiffre (js/scenes.js).

**Les styles**, écrits de zéro, huit pour commencer — un par philosophie, pour que la synergie se lise d'un coup d'œil (js/adjoints.js, neuf) :

| Adjoint | Style | Ce qu'il donne | Ce qu'il coûte | Rejoint |
|---|---|---|---|---|
| 🏹 Le canonnier | Tirer de partout | tes tirs +18 % | ta précision −10 %, leurs tirs +6 % | 🐝 |
| 🔭 Le tireur d'élite | Choisir ses tirs | ta précision +12 % | tes tirs −10 % | 🦅 |
| 🧱 Le mur | Fermer la zone | leurs tirs −14 % | tes tirs −10 % | 🐢 |
| 🏋 Le cogneur | Le jeu physique | mises en échec, leur précision −2 % | tes punitions +40 % | 🦏 |
| 🏃 Le préparateur | Les jambes fraîches | blessures −35 %, usure −15 % | tes tirs −5 % | 🫁 |
| 🧘 Le moine | La discipline | tes punitions −30 % | moins de mises en échec, tes tirs −6 % | 😇 |
| 🔁 Le rouleur | Quatre trios | tes 3e et 4e trios jouent plus, blessures −30 %, leurs tirs −8 % | ton 1er trio joue moins | 🪜 |
| 🎤 Le vedettiste | Le premier trio | ton 1er trio joue plus, précision +3 % | blessures +30 %, leurs tirs +8 % | 🌠 |

Mesurés (`check_pouvoirs`, 200 matchs par club, quatre clubs témoins) : chaque style se voit chaque soir (de 1,3 à 3,3 fois le seuil), reste sous ±1,5 V ramené à un match sur deux, et s'arrête au bon match. Un match isolé ne paie pas les blessures : le préparateur et le rouleur valent plus sur une vraie saison que ce que la mesure dit (−0,8 et −0,2 V), le vedettiste moins.

**Le code.** Deux décisions neuves : `main: { cle }` (la carte reçue, au jour dit) et `joue: { adjoint: cle }` (la carte posée, au jour dit) ; `appliquerPerso` les lit, le moteur compte les matchs joués du club depuis la pose et retire l'adjoint tout seul (déterministe, rejouable). Le robot (`cartes_robot.mjs`) joue la carte dont le style va à son club, dès qu'une case est libre.

## Phase 4 — La banque d'événements neuve (première banque, 31 oct.)

Les mêmes quatre mots.

**Simple** : un lundi sur deux, une histoire, **deux options**, chaque option **une seule chose concrète** — des jetons, de l'expérience au coach, une carte d'adjoint dans ta main, un blessé qui revient, un joueur suspendu, un dépanneur. Jamais un pourcentage, jamais une durée.
**Impactant** : la chose est grosse : 20 jetons, +5 d'expérience, une carte d'adjoint, deux matchs de suspension.
**Le fun** : l'option audacieuse est un dé (`pari`, déjà là) ; on voit la face avant de valider.
**Marquant** : l'histoire nomme un joueur et ses vrais chiffres (le fait), une voix la dit, et son issue se lit à Hier soir avec les vraies stats.

Six histoires pour commencer (`DOSSIERS`, js/dossiers.js), une par fait lu dans les feuilles ou la cédule, chacune nommant un joueur :

| Histoire | Voix | Le fait | Réponse 1 | Réponse 2 |
|---|---|---|---|---|
| 📸 Tout le monde veut la vedette | l'analyste | ton meilleur pointeur des dix derniers matchs, le rang du club | la tournée des médias : +20 🪙 | le garder pour la glace : +5 d'expérience au coach |
| 🥶 La disette | l'entraîneur | un gros contrat à un point ou moins en huit matchs | le défi devant les journalistes : un dé sur lui (tirs ×1,5, précision ×1,3 ou ×0,5, 8 matchs) | le reposer deux matchs |
| 🥅 Le gardien battu | l'entraîneur | cinq buts ou plus au dernier match | le renvoyer devant le filet : un dé sur lui (arrêts ×0,85 ou ×1,15, 6 matchs) | l'auxiliaire deux soirs |
| 🥊 La chicane au vestiaire | le capitaine | quatre punitions ou plus en dix matchs | le suspendre deux matchs : +4 d'expérience | une amende : +8 🪙 |
| 🧳 La semaine sur la route | le physio | trois matchs à l'étranger, le plus bas en jambes | le vol nolisé : −15 🪙, les jambes de tous +10 | l'autobus de nuit : +10 🪙, les jambes de tous −8 |
| 📋 Un adjoint en vue | le DG | 50 🪙 ou plus en caisse | signer le chèque : −25 🪙, une carte d'adjoint dans ta main | garder l'argent |

Jamais un pourcentage ni une durée à l'équipe ; l'audace est un dé sur le joueur nommé, et ses deux issues se lisent avant de valider. Les quatre choix de fil (`CHOIX_DES_FILS`, js/vie-gm.js) sont écrits aussi : le Cheechoo (le monter au 1er trio, un suivi de 4 buts en 10 matchs), la disette (lui parler, 2 buts en 8 ; ou le reposer), le duo (les souder, 3 buts du duo en 10), la recrue (lui faire confiance, 6 points en 10 ; ou le vétéran mentor) ; deux réponses chacun, le suivi se relit dans les feuilles (`check_retours`, `check_suivis`, `check_effets`). À écrire ensuite, selon le jeu : le fond et le sommet du classement, le dos-à-dos. `check_dossiers`, `check_mots`, `check_incidents`, `check_clarte` et `check_lisibilite` les tiennent.

## Les vérifications

Les scripts qui mesuraient du contenu parti sont vides-vacuement-vrais tant que la banque est vide ; ils se réarment avec la banque neuve (phase 4) : `check_dossiers`, `check_mots`, `check_effets`, `check_arcs`, `check_retours`, `check_suivis`, `check_verdicts`, `check_incidents`, `check_lisibilite`. `check_moments.mjs` est supprimé. `check_pouvoirs` perd ses sections sur les adjoints ; la borne du personnage complet sous 16 V est à remesurer sans le bras droit (phase 5).

Aucune PR avant que les phases 3 et 4 soient faites et vertes.
