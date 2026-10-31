# Cap 82-0

Bâtis un alignement de 23 joueurs de la LNH — n'importe quelle saison depuis 1970-71, n'importe quelle équipe y compris les franchises disparues — sous le plafond salarial, et vois si ta formation peut faire une saison parfaite.

Chaque tour, la roulette sort une saison et une équipe. Tu piges dans ce vestiaire-là. Tu vois les vraies stats et le salaire. Un joueur se juge sur ce qu'il a fait, et la simulation joue lancer par lancer sur ses vraies colonnes ; une cote, quand elle s'affiche, est celle que le moteur joue.

## Les modes

- **Le 82-0** : le repêchage, rien d'autre. Vestiaire (une équipe entière) ou loto (le même joueur de trois clubs), dans toutes les époques, dans la saison de la ligue ou dans l'histoire d'une franchise (relocalisations comprises). La saison se simule d'un coup ; les séries se regardent match par match.
- **Le Rogue** : une run de plusieurs saisons, au jour le jour. Ton club part en NHL Stars avec des bouche-trous et quelques jetons 🪙 ; la boutique vend des packs de joueurs et de cartes, et chaque saison le proprio en veut plus (le mandat). Ton **coach** est un personnage, choisi au départ de la run parmi huit philosophies, du 🐝 Frelon à la 🐢 Tortue : il monte de niveau en gagnant (1 à 5), ouvre ses trois **pouvoirs**, qui jouent période par période, et garde une **main** d'adjoints, des cartes qu'il poste pour un séjour de douze matchs, chacune un style en vraies stats (tirer de partout, fermer la zone, le jeu physique). Derrière le banc, **ton entraîneur** est une vraie carte de coach-saison (Scotty Bowman · Canadiens 1976-77). Un lundi sur deux, une **histoire** arrive à ton club, lue dans ce qui est déjà joué ; les **gros matchs** et les séries sont des duels en trois périodes, où l'adversaire annonce son plan et où ton adjoint te propose le tien. Les médailles 🏅 et le cartable restent d'une run à l'autre et ouvrent les déblocages.
- **Sur table** : le même alignement, joué comme un jeu de plateau à la Blood Bowl, en tournoi de six clubs.
- **L'exhibition** : deux vrais clubs de n'importe quelle époque, joués par le même moteur — un match, une série 4 de 7, ou cent matchs pour lire les chances.

L'écran est celui d'un directeur général, en sections qui ne bougent jamais, chacune pour une question : **Bureau** (qu'est-ce qui se passe aujourd'hui ?), **Joueurs** (qui j'ai, et dans quel état ?), **Lignes** (comment on joue ce soir ?), **Ligue** (où j'en suis ?) ; en Rogue, **Marché** (la boutique, l'album) s'y ajoute. Un choix se dit en vraies stats de match — tirs, % au tir, tirs contre, % d'arrêts —, jamais en note.

## Jouer

Le jeu est un site statique qui se joue en local. Aucun compte, aucun serveur distant.

```bash
python3 scripts/build_shards.py --seed-only   # ~10 saisons, 2 minutes
python3 -m http.server 8000
```

Ouvre http://localhost:8000. Les modules ES exigent `http://`, pas `file://`.

Au repêchage, chaque carte dit l'essentiel : le poste, le salaire, le chiffre clé, le rôle, la zone d'efficacité et la case où le joueur irait. Un toucher ouvre sa fiche — ses vraies statistiques, son salaire d'époque, ses cotes sur 20 en hexagone, ce que le moteur fera de lui sur la glace.

Pour la base complète — 1970-71 à aujourd'hui, tout joueur à 10+ matchs :

```bash
python3 scripts/build_shards.py
```

Environ 120 requêtes à l'API officielle de la LNH, 5 minutes. Requiert Python 3 et Node 18+, aucune dépendance à installer.

Pour refaire seulement l'étage 2 — la valeur, les salaires, les archétypes, les zones et le temps de glace inféré (aucun réseau, deux secondes) :

```bash
python3 scripts/build_shards.py --rerate
node scripts/check_ratings.mjs      # distribution des cotes et cohérence avec les vrais classements
```

## En images (1.0, à 390 px)

| Le Bureau, en séries | Les Lignes |
|---|---|
| ![Le Bureau d'un match de séries](docs/captures/bureau-series-390.png) | ![Les trios, leurs tirs pour–contre](docs/captures/lignes-390.png) |

| Ton coach | Les règles |
|---|---|
| ![Le choix du coach au départ d'une run](docs/captures/coach-390.png) | ![La page des règles](docs/captures/regles-390.png) |

Les captures datent de la 1.0 (octobre 2026) ; le Rogue a changé depuis (V9 à V21, `docs/refonte-v*.md`).

## Android et bureau

Le jeu n'est plus publié en ligne : il se joue en local, dans le navigateur, sur Android (`mobile/`, Capacitor) ou sur Windows (`desktop/`, Electron).

```powershell
powershell -ExecutionPolicy Bypass -File mobile\fabriquer-apk.ps1   # l'APK signé, dans mobile\Cap-82-0.apk
```

`mobile/assembler-www.mjs` regroupe et minifie le jeu (esbuild, devDependency de `mobile/` seulement) ; les salaires et le filet `data/seed.json` restent hors de l'APK.

La GitHub Action « Bâtir les données » existe encore pour régénérer les shards depuis l'API de la LNH (modes `full`, `bios`, `rerate`, `seed`) ; chaque lundi, elle rafraîchit la saison en cours. En local, `scripts/build_shards.py` fait la même chose.

**L'application Android** (`mobile/fabriquer-apk.ps1`) n'emporte pas les 3 900 visages recadrés (57 Mo) : l'APK n'a que les écussons et la silhouette. Au premier lancement, en arrière-plan, l'appareil télécharge chaque portrait au site de la LNH, le recadre lui-même avec le code de `scripts/portraits.mjs` (`js/recadrage.js`) et le garde dans son cache (`js/visages.js`). En attendant, la photo brute de la LNH s'affiche ; hors ligne, la silhouette. Le jeu marche hors ligne dès que cette passe est faite.

## Comment les cotes sont calculées

Tout vient des vraies stats, **normalisées par saison** : chaque joueur est mesuré contre ses contemporains, à son poste. C'est ce qui fait que 100 points en 1982 et 100 points en 2004 ne valent pas la même chose — sinon les années 80 écraseraient tout. Une seule implémentation, `js/ratings.js`, partagée par le build et le navigateur.

- **L'étage 1** (au build, depuis l'API) : des sous-cotes cachées en z-score contre la saison — offensive (points, tirs, points en avantage), défensive (+/-, points en désavantage, temps de glace, tirs bloqués), robustesse (punitions, mises en échec depuis 2005-06), vitesse. Le moteur les lit ; elles ne s'affichent jamais telles quelles.
- **L'étage 2** (hors ligne, `--rerate`) : la **valeur**, un rang statistique dans sa saison projeté sur la distribution historique de son poste ; le **salaire** (un barème, ou le salaire réel publié au prorata du plafond) ; l'**archétype** ; la **zone de déploiement** (son rang chez son club au vrai temps de glace depuis 1997-98) ; le **contrat d'entrée** ; et, pour les saisons d'avant 1997-98, le **temps de glace inféré** des colonnes de toutes les époques (buts, passes, lancers, unités spéciales, punitions, rang au club), ajusté sur les saisons mesurées et éprouvé en retenue sur 1997-2005 (`scripts/inferer_glace.mjs` : R² 0,80 chez les avants, 0,67 chez les défenseurs). La fiche le marque d'un « ≈ ».
- **Ce que l'écran montre** : le **niveau** (Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène : le 50, 20, 4 et 1 % du haut de sa saison à son poste, aux points ou à la défense), les **rôles** et leurs badges (Sniper Or, Checker Argent…), et six **cotes sur 20** en cloche — Tir, Passes, Défense, Robustesse, Avantage, Désavantage ; Arrêts, Charge, Présence pour un gardien —, chacune une chose que le moteur joue, en hexagone à la fiche. Jamais une cote générale (`docs/cotes-sur-20.md`).

Le salaire suit le plafond de 95,5 M$ ; quand un salaire réel publié existe (`data/salaries/`), il remplace le barème au prorata du plafond de l'année, et pour 1989-90 à 2003-04 le « plafond » est la masse salariale de l'équipe la plus dépensière, lissée à moitié. Le premier contrat d'un joueur de 24 ans ou moins est un contrat d'entrée plafonné selon l'époque.

## La simulation

Une ligue complète : ta formation plus les vraies équipes historiques sorties par la roulette, alignées par l'IA, au jour le jour sur un vrai calendrier — rien n'est simulé d'avance, une décision s'applique au jour dit. Puis les séries, 4 de 7, pour les seize premiers au plus.

Le moteur joue chaque match **lancer par lancer** ([MOTEUR.md](MOTEUR.md)). Le rythme du hockey n'a presque pas bougé en 55 ans (28 à 29 lancers par équipe par match) ; ce qui a changé, c'est le % au tir et le % d'arrêts. L'événement de base est donc le lancer, et chaque époque garde son % de tir et son % d'arrêts de ligue : une équipe de 1985 rencontre une équipe de 2015 sur un pied d'égalité.

Les trios jouent 30 / 26 / 23,5 / 20,5 % du temps à forces égales, les paires 37 / 32 / 31 % : ton quatrième trio pèse pour vrai. Un joueur rend selon ses badges, la chimie d'une ligne vient de l'**affinité** de ses joueurs (deux badges qui s'accordent : 🎯 sniper et 🅰 passeur, 🔧 checker et 🪠 plombier…), sa carrure fait l'agressivité de sa ligne, ses jambes s'usent et se refont. Buts et passes se distribuent comme sa vraie saison les a distribués. La même graine rejoue la même saison, au but près. Un match nul va en prolongation, puis aux tirs de barrage ; en séries, la mort subite dure ce qu'il faut.

La feuille de match compte aussi ce que la ligue n'a longtemps pas compté : les tirs bloqués, crédités à qui défendait (un bloc blesse, parfois), et qui a tiré chaque punition — l'alignement qui attire les punitions prend plus d'avantages numériques. Avant leur collecte (2005-06, 2009-10), le moteur estime ces gestes des colonnes de toutes les époques, comme des poids (qui frappe, qui bloque), jamais comme des chiffres affichés ; la méthode et ses mesures : MOTEUR.md § 4.8.

## Documentation

- [CLAUDE.md](CLAUDE.md) — les consignes vivantes pour les agents de code : les règles fermes, la structure, le vocabulaire, comment tester
- [AGENTS.md](AGENTS.md) — le renvoi court vers CLAUDE.md, pour les autres agents
- [ARCHITECTURE.md](ARCHITECTURE.md) — pourquoi le découpage par saison, les trois sources de données
- [MOTEUR.md](MOTEUR.md) — le moteur par événements, et les mesures derrière chaque choix
- [LIVRAISON.md](LIVRAISON.md) — le plan de travail et son journal (la 1.0, livrée, puis les refontes)
- [PLAN.md](PLAN.md) — l'état court du projet et les décisions prises
- [docs/](docs/README.md) — l'historique : les décisions en long, les refontes V3 à V21, la référence du moteur, le journal par sprint

## Données

Source : API publique de la LNH (`api.nhle.com/stats/rest`). Non affilié à la LNH.
