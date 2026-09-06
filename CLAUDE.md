# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Avant de coder

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `MOTEUR.md` — c'est la spécification de la refonte de la simulation par événements, avec les mesures qui appuient chaque choix. Si tu touches à `js/sim.js`, lis-le avant.

Lis `PLAN.md` — il contient l'état exact du projet, ce qui est fait, ce qui reste, et l'ordre de priorité. Coche les cases au fur et à mesure et ajoute une ligne au journal en bas.

## Structure

```
.github/workflows/build-data.yml  Action : bâtit les shards depuis l'API LNH et
                            les commite (modes bios, rerate, seed, full). C'est
                            la voie pour ajouter les dates de naissance quand
                            l'API n'est pas joignable depuis le poste de travail
index.html                  page unique (barre de plafond, roulette, tableau de
                            bord, deux volets vestiaire / alignement, modales)
style.css                   tous les styles, mobile d'abord (390 px), deux
                            volets à partir de 1080 px
js/ratings.js               calcul des cotes cachées (partagé navigateur + build)
                            étage 1 : sous-cotes en z-score (exige l'API)
                            étage 2 : cote globale, salaire, archétype, zone (rejouable hors ligne)
js/data.js                  chargeur trois niveaux + cache IndexedDB
js/traits.js                les traits, tirés des votes de `data/trophees.js`
js/sim.js                   structure de l'alignement + simulation de saison + ligue complète
js/game.js                  contrôleur d'interface
scripts/build_shards.py     aspire l'API LNH, écrit les shards ; --rerate = étage 2 sans API
scripts/rate.mjs            pont Node vers js/ratings.js (étage 1 + 2)
scripts/rerate.mjs          étage 2 sur les shards existants (contrats d'entrée, salaires réels)
scripts/build_salaries.py   assemble data/salaries/<saison>.json depuis data/salaries/sources/
scripts/fetch_markerzone.py dépose les salaires publiés par MarkerZone (1989-90+) dans sources/ ; manuel, jamais dans l'Action
scripts/check_ratings.mjs   distribution des cotes, zones, archétypes, force d'équipe vs classement
scripts/build_lancers.mjs   régénère SEASON_LANCERS de js/ratings.js depuis les shards
scripts/calibrate_sim.mjs   tableau de calibration (de vrais joueurs d'une même cote)
scripts/check_monotonie.mjs améliorer son équipe la rend-elle meilleure ? (vraies équipes)
scripts/mock_zones.mjs      le malus de zone ferme-t-il l'empilement ?
scripts/check_lancers.mjs   les deux constantes d'époque du moteur (voir MOTEUR.md)
scripts/mock_moteur.mjs     maquette du moteur par événements, comparée aux vrais totaux
scripts/check_suppression.mjs  la défensive de l'alignement : volume de lancers
                            concédés ou qualité ? (réponse : la qualité)
scripts/check_neutre.mjs    de quoi est faite l'équipe MOYENNE, une fois alignée
                            (les quatre nombres de REF dans js/sim.js)
scripts/check_feuilles.mjs  les égalités de la feuille de match, les repères
                            d'époque, et les totaux des joueurs
scripts/check_plafond.mjs   le plafond du jeu en victoires et en Coupes
scripts/check_chimie.mjs    la chimie de trio dit-elle ce que le hockey dit ?
scripts/check_traits.mjs    les traits : rareté, couverture d'époque, effet mesuré
scripts/smoke.mjs           test de fumée Playwright à 390 px
data/trophees.js            Selke, Norris, Vezina, Conn Smythe — gagnants et finalistes
data/reputations.js         les réputations curées : 179 joueurs marquants
data/index.json             liste des saisons disponibles
data/seasons/<saison>.json  un shard par saison
data/seed.json              filet hors ligne
data/salaries/<saison>.json salaires réels publiés (playerId -> $ de l'époque), facultatif
```

## Règles fermes

**Une seule implémentation des cotes.** `js/ratings.js` est la source unique. Le navigateur l'importe, et `scripts/build_shards.py` y accède via `scripts/rate.mjs`. Ne réimplémente jamais la formule en Python — ça produirait deux définitions qui divergent silencieusement.

**Toucher à une formule de cote veut dire incrémenter `RATINGS_VERSION`** dans `js/ratings.js`. La version est dans la clé du cache IndexedDB. Sans incrément, un joueur se retrouve avec des cotes calculées par deux formules différentes dans le même alignement.

**Deux étages de cotes.** L'étage 1 (`rateSkaters`, `rateGoalies` : sous-cotes o, d, r, c, sp) exige les stats brutes de l'API. L'étage 2 (`finalizeSeason` : cote globale, salaire, archétype `ak`, zone `lz`, contrat d'entrée `elc`) ne lit que le shard, donc `python3 scripts/build_shards.py --rerate` le rejoue sur les 55 saisons en une seconde, sans réseau. Si tu changes l'étage 2, c'est la commande à lancer ; si tu changes l'étage 1, il faut l'API. Le build normal enchaîne toujours un `--rerate` à la fin, parce que les contrats d'entrée dépendent de la première saison de chaque joueur dans toute la base et de sa cohorte d'identifiant (âge estimé quand l'API bios n'a pas donné la date de naissance `bd` ; `python3 scripts/build_shards.py --bios-only` l'ajoute aux shards existants en ~110 requêtes, et les cartes affichent alors l'âge). Règles d'époque dans `elcEra` : rien avant 1995-96.

**La cote globale est relative à la saison.** Un bonus de vedette est calculé sur le rang du joueur dans sa saison, divisé par le nombre d'équipes de la ligue cette année-là. C'est ce qui équilibre 1975 (18 équipes) et 2024 (32). Vérifie avec `node scripts/check_ratings.mjs` : la corrélation entre la force d'une équipe et son vrai classement (reconstitué des fiches de gardiens) doit rester autour de 0,8.

**Modules ES natifs, pas de build step.** `<script type="module">`. Aucun bundler, aucun transpileur, aucun `node_modules`. Le dépôt doit pouvoir être servi tel quel.

**Français québécois** dans toute l'interface et tous les commentaires. Abréviations de hockey en français : PJ, B, A, PTS, PUN, V, D, BL, MBA (moyenne de buts alloués), AG/C/AD, DG/DD.

**Mobile d'abord.** Cible 390 px de large. Teste à cette largeur avant de déclarer une tâche terminée. Rien ne doit déborder horizontalement de `document.documentElement` — seuls les conteneurs prévus (bande du tableau de bord, tableaux du résultat) défilent en x.

**Pas de titre de page.** La barre du haut ne porte que le plafond restant, le compte de signés, le budget par case et les trois accès (historique, règles, options). Le nom du jeu vit dans l'onglet du navigateur, pas dans une bannière qui vole de la hauteur utile.

**Le tableau de profondeur est une trame de six colonnes.** `.line-slots` pose toujours six colonnes : un trio prend deux colonnes par case, une paire trois. Les rangées s'alignent donc les unes sous les autres quel que soit l'effectif de l'unité, et `align-items: stretch` garde les blocs à la même largeur — c'est `align-items: start` qui les faisait rétrécir à la largeur de leur titre.

**Le bassin se range par position, sur une colonne par poste.** Le volet du bassin est un conteneur de requête nommé `pool` ; quand il dépasse 1000 px, `.pool.by-pos` devient six vraies colonnes (AG, C, AD, DG, DD, G), sinon les en-têtes redeviennent de simples séparateurs et les cartes reprennent une grille fluide. Chaque colonne est elle-même un conteneur nommé `col` : sous 260 px la carte se compacte, sous 190 px elle perd son portrait. **Les conteneurs de requête doivent rester nommés** — sans nom, l'en-tête d'une colonne interroge la largeur de sa colonne au lieu de celle du volet, et la mise en page se défait en silence. Disposition : onglets sous 1080 px, volets empilés pleine largeur de 1080 à 1600 px (le bassin garde ses six colonnes, l'alignement s'étale dessous), côte à côte au-delà.

**La couleur d'équipe ne porte jamais du texte.** `--team-primary` et `--team-accent` teintent les fonds, bordures et lueurs. Les états sélectionnés (chips, segments d'options) utilisent `--ui-accent`, fixe, parce qu'une équipe au bleu marine ou au noir rendait le texte foncé illisible sur son propre accent.

**La carte ne porte que l'essentiel, la fiche porte tout.** Une carte du bassin montre le poste, le nom, le salaire, le chiffre clé, l'archétype, la zone d'efficacité, la case de destination et le bouton. Rien d'autre : les statistiques détaillées, l'âge, le contrat d'entrée, l'origine du salaire et l'impact sur l'alignement sont dans la fiche, à un clic. Même principe au tableau de bord — trois chiffres, l'explication en infobulle. On ne bloque pas une décision sous un mur de texte.

**Le joueur va où il rend.** `slotFitScore` dans `js/game.js` classe les cases libres par position naturelle d'abord, puis par zone d'efficacité : un joueur de calibre quatrième trio se propose au quatrième trio, pas au premier parce qu'il était vide. Les réservistes viennent en dernier.

**Le vocabulaire est celui du hockey.** Les zones s'appellent Top 6, Top 9, Bottom 6 et 4e trio chez les attaquants ; Top 4, Top 6 D, Bottom 4 et 3e paire chez les défenseurs ; partant numéro un, partant et auxiliaire chez les gardiens. Jamais « calibre 2 ».

**La couleur d'équipe passe par `getTeamAccent`** (`js/logos.js`), qui éclaircit la teinte jusqu'à ce qu'elle reste visible sur fond sombre, et sert de `--team-line` : bordure des cartes du bassin, et bordure de chaque case de l'alignement à la couleur de l'équipe du joueur qui l'occupe. La couleur brute d'une équipe sombre ne porte jamais rien.

**Toute commande visible doit fonctionner.** Si une donnée manque, on retire la commande plutôt que d'afficher des tirets : les dates de naissance (`bd`) ne sont pas dans les shards actuels, donc le tri par âge et la tuile « âge moyen » se masquent d'eux-mêmes (`agesAvailable()` dans `js/game.js`). `python3 scripts/build_shards.py --bios-only` les ajoute et tout réapparaît sans autre changement.

**Pas de localStorage pour les données de saison** — trop petit. IndexedDB, comme dans `js/data.js`.

## Le moteur de match

**L'événement de base est le lancer, pas le but.** C'est la refonte décrite dans `MOTEUR.md`, et ce qui la motive est mesuré : sur 55 saisons les lancers par équipe par match vont de 27 à 31 (17 % d'amplitude) pendant que les buts varient de 55 %. Le tempo n'a pas bougé, la finition oui. Un match se joue donc lancer par lancer — un tireur, un gardien, deux issues — et toute la feuille de match en découle.

Les trois égalités se ferment **par construction**, jamais par un ajustement après coup, et `node scripts/check_feuilles.mjs` les vérifie sur les 1312 matchs d'une ligue :

```
buts d'une équipe    = somme des buts de ses joueurs
lancers d'un gardien = ses arrêts + les buts alloués
passes              <= 2 par but
lancers pour        = lancers contre, à l'échelle de la ligue
```

**La défensive agit sur la qualité des lancers, pas sur leur nombre.** Mesuré sur 1392 équipes-saisons : la cote défensive d'un alignement corrèle à −0,17 avec les lancers concédés et à +0,45 avec le pourcentage d'arrêts de l'équipe. Une bonne brigade ne réduit pas le volume de rondelles vers son filet, elle réduit la probabilité que chacune entre. Le volume, lui, ne tient qu'à la possession (`possession^0,150`). Ne recâble pas la défensive sur le volume : la mesure dit non.

**Tout est exprimé en écart à `REF`**, l'équipe moyenne une fois alignée — pas le joueur moyen de la ligue. La distinction n'est pas cosmétique : un alignement retient les 18 meilleurs patineurs d'un club et son gardien numéro un, qui tirent 27 % de plus que le régulier moyen, finissent 2 % mieux et arrêtent 10 % de plus. Normaliser sur le joueur moyen donnait une équipe médiane à 60 victoires. `node scripts/check_neutre.mjs` remesure ces quatre nombres.

**Une seule constante est libre : `SYN_ECHELLE`** (42). Elle convertit un bonus de chimie ou un malus de zone (en points de cote) en facteur multiplicatif sur les buts attendus d'une unité, moitié par le volume moitié par la qualité. Tout le reste — `LANCERS_BASE`, `ALPHA_POSSESSION`, `K_DEFENSE`, `REF` — est mesuré. `LANCERS_BASE` et `CIBLE_PCT_TIR` sont réglés sur la *sortie* de `check_feuilles.mjs` (≈ 28,5 lancers et ≈ 3,1 buts par équipe par match), pas sur la moyenne brute des shards.

## La chimie et les archétypes se lisent dans la fiche, pas dans la cote

**C'était le dernier endroit du moteur qui raisonnait sur une cote.** La chimie lisait l'archétype, et l'archétype comparait `o`, `d` et `r` à des seuils : un trio pouvait donc basculer en « conflit de rôles » parce que trois z-scores franchissaient ensemble une frontière, sans qu'aucun de ces joueurs n'ait le même profil de production. Les deux se calculent maintenant sur les vraies statistiques, en écart au régulier moyen de la saison du joueur.

**Le penchant d'un attaquant** est la part de ses points qui vient de ses buts, moins celle de sa ligue (mesurée, ≈ 0,42 et remarquablement stable sur 55 ans). Positif = il finit, négatif = il sert.

**Deux nombres décident d'un trio**, et ils disent ce que le hockey dit :

| | |
|---|---|
| **écart** | entre le plus tireur et le plus passeur — un trio a besoin de quelqu'un qui finit *et* de quelqu'un qui sert |
| **excès** | à quel point tout le trio penche du même bord — trois francs-tireurs se disputent la même rondelle |

Mesuré avec de vrais joueurs (`node scripts/check_chimie.mjs`) : deux francs-tireurs et un fabricant **+8,5**, un franc-tireur et deux fabricants +7,7, trois francs-tireurs **−2,2**, trois fabricants **−4,9**, trois joueurs moyens +2,0.

**La mesure est sans échelle** — elle ne regarde que l'équilibre, jamais le niveau. C'est délibéré : le moteur modélise déjà le volume de tirs et la finition de chacun, donc récompenser un trio parce qu'il produit beaucoup le compterait deux fois. Seul le *poids* de l'effet suit la production, parce qu'organiser les rôles compte davantage quand il y a de l'offensive à organiser.

**La chimie de trio ne touche que l'attaque.** La défensive passe par la cote `d` et par les traits, où elle est mesurée ; la faire agir ici aussi reviendrait à la compter deux fois. Chez les défenseurs, en revanche, la composition a un effet défensif réel et mesuré : une paire dont les deux montent laisse plus de retours.

**L'archétype suit les mêmes quatre axes**, tous disponibles depuis 1970-71 : production, penchant, volume de lancers, minutes de punition — chacun divisé par le régulier moyen de sa saison. `archetypeKey(p)` ne prend plus de cotes en second argument, il n'y en a plus à passer.

**Ce que l'archétype décrit, c'est la SAISON, pas la légende.** Gretzky 1981-82 (92 buts) sort franc-tireur ; Gretzky 1985-86 (163 passes) sort fabricant d'élite. C'est correct : la réputation 🪄 Créateur est là pour dire ce que le joueur *était*, l'archétype dit ce qu'il *a fait cette année-là*.

**Ce que ça ne mesure pas, et c'est assumé** : rien ici ne voit la défensive d'un attaquant, parce que le sommaire ne la porte pas avant 1998. Un attaquant peu productif et peu puni sort « complet » plutôt que « défensif » — c'est la meilleure lecture possible de ses colonnes, et le trait Selke existe pour les cas où le vote sait ce que le sommaire ignore.

## Les traits

**Un trait n'existe que là où le sommaire est aveugle.** C'est la règle qui tient `js/traits.js`, et elle décide de tout le reste. Le moteur lit déjà les lancers, les buts par lancer, le pourcentage d'arrêts, le +/- et les matchs joués — un trait « franc-tireur » ou « homme de fer » ne ferait que recompter ce que le moteur compte déjà, et il le compterait moins bien. Ce qui manque au sommaire, c'est le reste : qui défendait vraiment, qui patinait vite, qui avait le lancer qu'on craignait, qui menait un vestiaire.

**Deux étages, et rien d'autre.**

Les **votés** (`data/trophees.js`) — scrutins publics, population complète, une saison à la fois :

| trait | effet | quand |
|---|---|---|
| 🛡️ Selke | moins de buts alloués | saison et séries |
| 🧱 Norris | idem, pour un défenseur | saison et séries |
| 🥅 Vezina | facteur sur chaque lancer qu'il voit | saison et séries |
| 🏆 Conn Smythe | bonus offensif, ou un gardien plus dur à battre | **séries seulement** |

Les **réputations** (`data/reputations.js`) — le consensus des amateurs, sur toute une carrière, **179 joueurs marquants** :

| trait | effet | porte sur |
|---|---|---|
| ⚡ Vitesse | il obtient plus de lancers | le joueur |
| 💣 Lancer | ses lancers entrent plus souvent | le joueur |
| 🪄 Créateur | son équipe finit mieux | l'équipe |
| 🧭 Meneur | prolongation et séries | l'équipe |
| 🥊 Colosse | l'adversaire finit moins bien | l'équipe |
| 🧤 Voleur | le gardien laisse passer moins | l'équipe |

**🧤 Voleur rachète le trou du Vezina.** Avant 1981-82 ce trophée n'était pas un vote, donc Dryden, Parent, Tony Esposito et Giacomin n'avaient aucun trait — alors qu'ils sont exactement les gardiens dont on se souvient. La réputation couvre toutes les époques et comble ça.

Un vote dit ce qu'une **saison** valait ; une réputation dit ce qu'un **joueur** était. Ni l'un ni l'autre n'est dans le sommaire, et c'est pour ça qu'ils existent.

**La règle qui garde `data/reputations.js` honnête : on n'y met que ce qu'un amateur affirmerait sans hésiter.** Pas « il était bon » — ça, les colonnes le disent. C'est le seul endroit du dépôt qui repose sur du jugement plutôt que sur une mesure, et le contrepoids est double : les effets sont petits, et `check_traits.mjs` vérifie que **chaque nom existe dans les shards**, parce qu'un nom mal orthographié serait un trait mort dont personne ne saurait rien. Une réputation de vitesse s'éteint après 34 ans quand la date de naissance est connue.

**Un trait appartient au joueur, pas à sa case.** Il rend partout dans l'alignement : un lauréat du Selke au quatrième trio défend aussi bien qu'au premier. C'est le malus de zone qui punit de mal placer un joueur, et il le fait déjà — faire porter la punition deux fois reviendrait à dire qu'un Selke oublie comment défendre quand on l'écrit sur la troisième ligne de la feuille. Seule condition : être **habillé**. Un trait sur un réserviste ne compte pas, il regarde le match. `check_traits.mjs` le vérifie en inversant l'ordre de l'alignement : le facteur doit être identique au dix-millième.

**Les deux étages n'ont pas la même rareté, et c'est voulu.** Mesuré : **1,02 %** des 36 820 joueurs-saisons portent un trait voté, **8,8 %** une réputation, **9,8 %** au total. Un vote est décerné une fois par saison ; une réputation dure une carrière, et « les joueurs marquants de 55 saisons » se compte en centaines. Ne pas en avoir veut dire « rien de particulier », ce qui est vrai — contrairement à une cote, qui doit exister pour tout le monde et ment donc quand elle est inconnue.

**Les canaux d'équipe saturent, et c'est ce qui empêche les traits de devenir un deuxième axe d'empilement.** Mesuré : le meilleur alignement légal sous le plafond ramasse **25 traits** contre 9 au Canadien de 1976-77 — l'optimiseur choisit les joueurs les mieux cotés, qui sont exactement les joueurs marquants. Sans borne, sa Coupe passait à 67 %, au-dessus de la meilleure vraie équipe de l'histoire. Le quatrième Norris d'un vestiaire n'apporte pas autant que le premier : on ne défend pas deux fois la même rondelle. Les canaux d'**équipe** sont donc bornés (`BORNES` dans `js/traits.js`) ; ceux de **joueur** — vitesse, lancer — ne le sont pas, puisqu'ils portent sur les lancers de leur seul porteur et ne s'additionnent pas.

**Les magnitudes suivent la longueur de la liste.** Passer de 86 à 215 entrées a fait grimper l'effet d'une grande équipe de +3,9 à **+5,5 victoires sans qu'on touche à un seul nombre** — une équipe des années Lemieux porte treize traits, pas quatre. Vitesse et lancer sont donc redescendus de 1,060 et 1,050 à 1,035 et 1,030. **Allonger `data/reputations.js` sans refaire tourner `check_traits.mjs` gonflerait les grandes équipes en silence** : c'est le piège de ce fichier-là.

**Effet mesuré : +14,0 buts marqués, −3,3 buts alloués et +3,4 victoires** pour une vraie équipe qui en porte onze à treize (les Penguins de Lemieux, les Red Wings de 2002), la même équipe rejouée sans. Les victoires sont bruitées ; les deux colonnes de buts sont le signal propre — les votés pèsent sur les buts alloués, la vitesse et le lancer sur les buts marqués. Un trait doit se voir sans décider la saison à lui seul.

**Deux limites d'époque, écrites pour qu'on ne les redécouvre pas.** Le Selke naît en 1977-78 : sept saisons n'ont aucun attaquant défensif décoré, et rien ne peut le corriger puisque le vote n'a pas eu lieu. Et le Vezina d'avant 1981-82 n'était **pas un vote** — il allait aux gardiens du club ayant alloué le moins de buts, ce qui récompense la brigade autant que le gardien, et le moteur mesure déjà cette brigade. Ces onze saisons sont donc écartées du trait même si `data/trophees.js` les porte.

**Pourquoi les traits agissent en propre plutôt que par la cote `d`.** `K_DEFENSE` est mesuré à 0,04 par écart-type d'alignement, donc un point de cote défensive vaut moins d'un pour cent de probabilité de but : faire passer un Selke par sa cote `d` lui ferait sauver un but par saison, invisible. C'est justement l'aveu du sommaire — le +/- ne voit pas ce que le vote voit.

**La défense se joue présence par présence.** Le moteur tire l'unité défensive adverse à chaque lancer, au prorata de son temps de glace seul (jamais de son volume de tirs : une unité ne défend pas plus souvent parce qu'elle attaque plus). C'est ce qui rend un quatrième trio poreux coûteux pendant ses propres treize minutes, et c'est ce qui donne au +/- des joueurs qui étaient vraiment sur la glace. **Les traits, eux, ne passent pas par là** — ils sont attachés au joueur et agissent sur tout le match.

## Recalibrer la simulation

Repères actuels, de vrais joueurs-saisons d'une même cote, moyenne sur 12 essais (`node scripts/calibrate_sim.mjs`) :

| Cote | Fiche | BP-BC |
|---|---|---|
| 50 | 11-66-6 | 133-342 |
| 60 | 28-48-6 | 209-284 |
| 70 | 40-37-5 | 245-254 |
| 80 | 48-30-4 | 246-217 |
| 90 | 59-22-0 | 284-194 |
| 99 | 69-13-0 | 324-157 |

Le banc **ne peut plus être synthétique**. L'ancienne table alignait 23 joueurs inventés `{o:r, d:r, …}` ; le moteur par événements se nourrit des vraies statistiques — lancers, buts par lancer, pourcentage d'arrêts — que des joueurs inventés n'ont pas, et un tel banc joue comme 23 rappels de la ligue mineure quelle que soit sa cote. On tire donc de vrais joueurs-saisons dont la cote est celle du palier.

Il reste dégénéré par nature : 23 joueurs de même calibre franchissent tous ensemble les seuils de zone, ce qui fabrique des marches artificielles.

**Le vrai test de monotonie est ailleurs.** `node scripts/check_monotonie.mjs` range les 1395 vraies équipes-saisons par force, les aligne avec `autoRoster` et les fait jouer. C'est ce test qui fait autorité — améliorer ses joueurs ne doit jamais rendre l'équipe pire. Il suit maintenant le réel de très près :

| décile | victoires simulées | vraies victoires |
|---|---|---|
| 1 | 29,5 | 27,1 |
| 5 | 43,1 | 43,2 |
| 10 | 54,2 | 56,2 |

**Le plafond du jeu se mesure en victoires et en Coupes, pas en indice.** `node scripts/check_plafond.mjs` : le meilleur alignement légal atteignable sous le plafond (cueillette libre sur 55 saisons) fait **63,6-17,7-0,7** en ligue et gagne la Coupe **30 %** du temps ; le Canadien de 1976-77, meilleure vraie équipe de l'histoire, fait 63,3-15,6-3,1 et la gagne **35 %** (20 ligues chacun, donc ±11 points). Les deux se tiennent, et l'ordre est le bon : dominer est possible, le 82-0 ne l'est pas, et la Coupe reste un pari. **Les réputations ont poussé ces deux chiffres vers le haut** — de 41 et 44 % avant elles — parce qu'elles favorisent exactement les joueurs marquants dont les grandes équipes sont faites. C'est voulu ; si la Coupe devient trop facile, le curseur est dans `EFFET` et `BORNES`. L'ancien moteur donnait la Coupe à 99 % dès le niveau 80.

`node scripts/mock_zones.mjs` garde le repère sur l'indice de cotes : le meilleur alignement légal est à 69,3 contre 68,0 pour les Bruins de 1970-71. Sans malus de zone il serait à 83,8.

`ZONE_PEN_SOUS` et `ZONE_PEN_MAX` ne tirent pas sur la même chose. Sur un alignement empilé la pénalité sature, donc seul le plafond mord ; sur une vraie équipe elle reste dessous, donc seul le coefficient mord. Un coefficient bas avec un plafond haut ferme donc l'empilement sans toucher aux vraies équipes — monter le coefficient punit les deux.

**Les zones sont calibrées sur la réalité.** Une vraie équipe aligne 6 attaquants de top 6, 4 défenseurs de top 4 et 1 partant. `ZONE_THRESHOLDS` est réglé pour que la ligue y atterrisse **en moyenne** — 6,5 / 3,9 / 1,05 mesurés sur les 1396 équipes-saisons — et non au plancher : le Canadien de 1976-77 en a neuf, Detroit la même année en a trois. Si tu retouches ces seuils, revérifie cette distribution avant tout le reste.

Si tu changes `POIDS_TRIO`, `POIDS_PAIRE`, `SYN_ECHELLE`, `K_DEFENSE`, `REF`, la courbe du clutch, `ZONE_THRESHOLDS` ou les constantes `ZONE_PEN_*`, refais tourner les quatre et reporte-les ici et dans `PLAN.md` :

```bash
LIGUES=5 node scripts/check_feuilles.mjs   # les égalités et les repères d'époque
node scripts/calibrate_sim.mjs       # la table par palier de cote
node scripts/check_monotonie.mjs     # monotone sur dix déciles
node scripts/check_plafond.mjs       # victoires et Coupes au plafond
node scripts/check_traits.mjs        # les traits restent rares et se voient
```

**Ne règle jamais `LANCERS_BASE` ni `CIBLE_PCT_TIR` sur une seule exécution de `check_feuilles.mjs`.** Le script tire 32 équipes au hasard dans 55 saisons, ce qui fait varier le repère de ±0,15 but. En élargissant les réputations j'ai lu 3,19 buts sur cinq exécutions, conclu à une inflation de 3 %, rabaissé les deux constantes — puis relu 2,99. Les deux lectures étaient du bruit : sur cinq ligues moyennées (`LIGUES=5`), les valeurs d'origine retombent sur la cible et n'ont pas eu à bouger.

**Les chances de Coupe demandent 40 ligues, pas 6.** Une Coupe est un événement composé de quatre séries : à 6 ligues j'ai lu 33 %, à 16 ligues 38 %, à 16 autres 75 %. À 40 ligues c'est stable à ±8 points. Ne conclus rien d'un `ESSAIS=6`.

La partie réelle se joue dans `simulateLeague` : 32 équipes (le joueur + 31 vraies équipes historiques alignées automatiquement), 82 rondes d'appariements, 1 312 matchs, avec chance, continuité des trios et blessures au prorata des matchs vraiment joués. **Les blessures s'appliquent aussi en séries** — c'est ce que l'ancien moteur sautait, et pourquoi la Coupe se gagnait à tout coup.

## Tester

Sert la page — `python3 -m http.server 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft conscient du budget : à chaque tour il lit le plafond restant, calcule ce qu'il peut mettre sur ce choix sans passer sous le plancher pour les cases suivantes, et clique le premier `.pcard .btn-sign:not([disabled])` qui tient dans ce budget. Sinon il relance ; en dernier recours il clique `#freeCapBtn`, le bouton de la bande de secours qui retire le plus gros contrat
3. `#mainBtn` devient actif
4. Cliquer : `.result .score` affiche une fiche, `.rrow` en compte 23
5. Zéro erreur console

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne mets pas les cotes cachées dans le DOM avant la simulation. Un joueur curieux qui ouvre l'inspecteur ne devrait pas pouvoir les lire. (Actuellement elles sont dans l'objet JS en mémoire — voir PLAN.md tâche J4.)
