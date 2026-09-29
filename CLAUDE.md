# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Avant de coder

Lis `LIVRAISON.md` — c'est le plan de travail courant vers la 1.0 : les jalons, chaque item avec son fichier, sa valeur et le script qui le prouve. Coche les cases au fur et à mesure et ajoute une ligne à son journal.

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `MOTEUR.md` — c'est la spécification de la refonte de la simulation par événements, avec les mesures qui appuient chaque choix. Si tu touches à `js/sim.js`, lis-le avant, et `docs/moteur-recalibrer.md` pour la recalibration.

`PLAN.md` garde l'état court et les décisions prises. L'histoire de chaque décision (pourquoi, ce qui a été essayé et écarté, mesuré) est dans `docs/decisions.md` ; le journal sprint par sprint dans `docs/journal/`. Avant de défaire une règle ci-dessous, lis sa décision.

## Structure

```
index.html            la page unique : barre du haut, roulette, vestiaire, alignement, modales
style.css             tous les styles, mobile d'abord (390 px), deux volets dès 1080 px
sw.js                 travailleur de service : la coquille hors ligne (FICHIERS), les visages en cache
site.webmanifest, favicon.svg, icon-*.png   installation et icônes
fonts/                Barlow Condensed (OFL), hébergée ici
data/                 shards par saison (seasons/), index, seed, portraits.json, salaires, trophées, réputations
img/logos, img/mugs   écussons des 44 franchises et visages recadrés (scripts/logos.mjs, scripts/portraits.mjs)

js/game.js            le contrôleur : l'état G, render(), le démarrage, la sauvegarde, les onglets, l'historique
js/repechage.js       la roulette, le vestiaire et le loto, la signature, la barre du plafond, le bassin de cartes
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
js/saison.js          l'écran de saison et des séries : le hub, la boîte de réception, les choix forcés
js/gerant.js          « Préparer le match » et la fenêtre du système d'une ligne
js/bilan.js           le bilan de saison : onglets, palmarès, calendrier, séries
js/coquille.js        la coquille fixe : une barre d'onglets, toujours la même
js/direct.js          un match en direct, rejoué depuis sa feuille
js/commentaire.js     le commentateur du direct
js/recit.js           les mots du sommaire d'un match
js/entracte.js        le rapport d'entracte en cartons
js/pronostic.js       le dépistage d'avant-match
js/equipes.js         l'écran des équipes et leurs vraies statistiques
js/combat.js          le deck de match : cartes, main, élan, main adverse
js/cartes.js          le gabarit des cartes (recto, verso, finitions)
js/rarete.js          les variantes de carte et leur bonus
js/banque.js          la banque de cartes (patrons, événements, modifs, consommables, contrats)
js/packs.js           les packs de joueurs et de cartes, leurs taux
js/niveaux.js         le niveau d'un joueur dans sa saison : Soutien → Phénomène
js/inventaire.js      l'inventaire et la revente
js/magasin.js         la boutique
js/rogue.js           le mode Rogue : jetons, mandat, déblocages, jalons
js/depart.js          le départ d'une run (le classeur)
js/cartable.js        le cartable des joueurs gagnés
js/album.js           l'album d'une partie à l'autre
js/ballottage.js      le ballottage, en fonction pure (Node et navigateur)
js/visages.js         l'application Android : télécharge et recadre les visages sur l'appareil
js/recadrage.js       le recadrage d'un portrait (partagé par scripts/portraits.mjs et js/visages.js)
js/identites.js       l'identité de départ
js/traits.js          les traits, tirés des votes de data/trophees.js
js/roles_ref.js       la référence des rôles
js/franchises.js      les franchises et leurs relocalisations
js/logos.js, js/logos_locaux.js   couleurs et écussons des 44 franchises
js/menu.js            le menu de départ
js/sauvegardes.js     les parties sauvegardées
js/mouvement.js       les chiffres qui se comptent
js/exhibition.js      l'exhibition
js/table.js           Sur table : le moteur du plateau et reglesDuPlateau()
js/plateau.js         Sur table : l'écran du plateau
js/tournoi.js         Sur table : le tournoi de six clubs
js/sons.js            les effets sonores synthétisés (Web Audio)

scripts/              build des données (build_shards.py, rate.mjs, rerate.mjs, portraits.mjs, recrues.mjs → data/recrues.json
                      la vraie saison recrue…), vérifications (check_*.mjs, smoke*.mjs, tout.mjs qui enchaîne les rapides),
                      calibration (calibrate_sim, mock_*), verdict.mjs (le juge partagé), lib/mort.mjs (la mesure du code mort)
mobile/, desktop/     l'APK (Capacitor) et l'exe (Electron) ; seul leur code est versionné
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
- Tout le hasard du moteur passe par `hasard()` ; la même graine rejoue la même saison — `check_graine`.
- La ligue se joue au jour le jour : rien n'est simulé d'avance, une décision s'applique au jour dit, et les journées d'avant ne bougent pas — `check_graine`, `check_ballottage`.
- Une saison en cours se REJOUE plutôt qu'elle ne se relit ; les séries aussi.
- Les égalités de la feuille de match tiennent — `check_feuilles` (sur table : `check_table`).
- La production se répartit comme la vraie saison l'a répartie — `check_parts`.
- Le direct, le sommaire et le bilan disent les mêmes buts, au caractère près — smoke.
- Aucune cote neuve, aucune mécanique neuve : une carte, un trait, un effet passent par les canaux existants — `check_combat` (chaque carte jouable est lue par le moteur), `check_traits`.
- On mesure une carte EN PAIRES, sinon on ne mesure rien — `check_cartes`.
- Les gros matchs portent leur plan, leur contre et leur pointage après deux périodes — `check_gros`.
- Le robot « premier Signer » ne gagne pas la Coupe — `check_robot`.

**L'économie (Rogue et boutique)**
- Revendre un pack de cartes rapporte au plus 40 % de son prix — `check_packs`.
- L'achat s'enregistre avant le butin ; la prime de série est versée — `check_rogue`.
- Le ballottage offre un dépanneur (niveau Régulier au plus), pas une vedette — `check_ballottage`.
- Une carte ne se prend qu'une fois, et un palier n'arrête l'avance qu'une fois.

**Sur table**
- Les règles du plateau sont ÉCRITES DANS LE CODE (`reglesDuPlateau()`) et affichées de là ; le moteur ne les viole jamais — `check_regles`.
- La rondelle ne se téléporte pas : chaque déplacement est une étape bornée — `check_regles`.

**L'interface**
- Mobile d'abord : rien ne déborde à 390 px, tout ce qu'on touche est atteignable — smoke `sansDebordement`, `toutEstAtteignable`.
- Jamais une longue page : chaque onglet tient en un écran ; une seule barre d'onglets, les mêmes entrées dans le même ordre — smoke.
- La boîte de réception bloque « Journée suivante » tant qu'un message est à traiter.
- Toute commande visible doit fonctionner.
- Une surface de base se change À LA SOURCE, jamais en fin de fichier.
- Le noir est le décor ; la couleur vient des équipes, aux vraies couleurs, jamais délavées ; les écussons des disparues sont dessinés (`js/logos.js`), jamais empruntés.
- Moins de mots, et surtout pas les évidents : une ligne à l'écran, le détail chiffré dans la page des règles, dont chaque chiffre vient d'une constante — `check_clarte`.
- Ton équipe s'appelle les NHL Stars.
- On ne décerne que ce que les colonnes décident, jamais ce qu'un vote déciderait.

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
- **niveau** : ce que le joueur valait dans sa saison, à son poste — Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène (`js/niveaux.js`). Le rôle a ses propres mots (élite, très bon, bon…), qui ne s'appellent pas « niveau ».
- **rôle** : ce que le joueur fait (sniper, passeur, checker…), une icône et un mot ; un système demande des rôles.
- **zone** : où le joueur rend (T1-2, P1…) ; une case porte les zones qui y sont chez elles.
- **carrure** : 🪨 costaud ou 🪶 léger ; elle décide de ce que rapporte l'agressivité.
- **élan** : la mana des cartes de match (trois par main, « 1 élan » sur une carte).
- **plombier** : le rôle 🪠 d'un attaquant de quatrième trio qui lance et frappe en peu de minutes ; le système 🧰 Trio de plombiers.
- **usure des jambes** : ce qu'un match coûte aux jambes (la puce « Usure des jambes +12 % »).
- « énergie » n'est plus un mot de l'écran (il voulait dire cinq choses) — `check_clarte`. Les clés du code (`energie`, `ENERGIE_MAIN`) restent, pour ne pas casser les sauvegardes.
- **Une icône = un sens** dans les étiquettes qu'on voit en jouant : rôles, systèmes, trophées, bonus de carte, styles de gardien, carrure, agressivité, consigne — `check_clarte`. Avant d'ajouter une icône, cherche-la dans `js/`.

## Tester

Sert la page — `python3 -m http.server 8000`, ou sans Python `node <un petit serveur statique> . 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft conscient du budget : à chaque tour il lit le plafond restant, calcule ce qu'il peut mettre sur ce choix sans passer sous le plancher pour les cases suivantes, et signe, parmi les cartes qui tiennent dans ce budget, celle dont la destination ne porte aucun avertissement et dont le chiffre clé est le plus grand (voir S64 : prendre la première rendait une équipe de .500 et faisait du passage des séries une loterie). Sinon il relance (passer, autre équipe, autre année) ; en dernier recours il clique `#freeCapBtn`, le bouton de la bande de secours qui retire le plus gros contrat
3. `#mainBtn` devient actif
4. Cliquer : l'écran de saison s'ouvre (`#hubModal`) — « Journée suivante » (`.hub-jour`), l'onglet des meneurs, « Regarder le match » (`.hub-regarder`, le direct dans `#liveModal` : pause, statistiques, `.live-fin`, `.live-suite` pour continuer), « Passer à la fin » (`.hub-fin`), « Voir le bilan » (`.hub-suite`) ; puis `.result .score` affiche une fiche et `.rrow` en compte 23. Les séries : « Match suivant », le tableau en cours (`.bk-serie`), un match en direct, la fin, puis l'onglet Séries du bilan
5. « Rejouer la saison » (`#replayBtn`) rejoue le même alignement contre les mêmes clubs, puis l'historique (`.lb-replay`) relit un alignement et repart une saison — le même parcours d'écran de saison à chaque fois
6. Le même parcours en tirage Loto (`#rrL` relance quand rien ne tient dans le budget)
7. Zéro erreur console (les portraits refusés ne sont demandés qu'une fois : `PORTRAITS_ABSENTS`)

`node scripts/smoke_table.mjs http://localhost:8000` fait le même parcours en mode bonus : l'option « Sur table » dans les options, le même auto-draft, le tournoi (`#hubModal`), le plateau (`#tableModal`, 247 cases, deux filets d'une case) où il joue un match geste par geste — il touche une pièce, lit les cases allumées, choisit des modes, dégage, tire, saute des verdicts en touchant la glace, dépense des relances d'équipe, change de trio — puis le reste du tournoi et le bilan. Il échoue si moins de quinze gestes ont pu être joués : c'est ce qui attrape une interface qui se fige.

L'Action `verifier.yml` fait tout ça à chaque PR, plus `check_graine.mjs` et `check_feuilles.mjs` sur une ligue, plus `check_fiches.mjs`, `check_table.mjs`, `check_regles.mjs` et `smoke_table.mjs`. Les scripts de calibration (monotonie, plafond, tireurs) restent à lancer à la main.

`node scripts/tout.mjs` enchaîne les vérifications rapides (moins de quinze secondes chacune) ; `node scripts/tout.mjs check_deck check_packs` n'en lance que quelques-unes. `check_packs`, `check_gardiens`, `check_combat` (une demi-minute chacun), `check_jambes` (une minute) et `check_banque` (douze minutes) se lancent à part.

Depuis la 1.0 : `node scripts/check_robot.mjs` (le robot « premier Signer », 40 saisons, avec et sans ballottage ; `BALLOTTAGE=1`, `MODE=rogue`) et `RUNS=40 CAMPAGNES=6 node scripts/check_rogue.mjs` (la courbe des runs). Playwright peut vivre ailleurs que dans le dépôt : `NODE_PATH=<dossier>/node_modules`.

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne mets pas les cotes cachées dans le DOM avant la simulation. Un joueur curieux qui ouvre l'inspecteur ne devrait pas pouvoir les lire. Elles vivent dans le coffre privé `RATINGS_VAULT` (js/sim.js), hors de `window.cap82.G`, et ne sortent que pour la simulation.
