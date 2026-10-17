# V10 · Le jeu de cartes neuf (devis à trancher)

JP, 17 oct. : *en dehors des joueurs, on devrait jeter toutes les cartes et créer de zéro avec la nouvelle philosophie en tête au lieu d'ajuster ce qui était là avant. Ça permettrait d'avoir des cartes plus circonstancielles et plus proches de ce qu'on veut faire.* Tranché le même jour : **les cartes d'abord, puis les écrans du Rogue** ; **le « si » s'élargit** à de nouveaux moments.

Ce document est le devis. Rien n'est codé ; ce que JP doit trancher est au § 10.

## 1. Ce qu'on jette, mesuré

| | Aujourd'hui |
|---|---|
| Cartes de jeu dans la banque (`BANQUE`, js/banque.js) | **538** : 160 événements (dont 127 déjà retirés, `retire: true` : 33 encore tirés, par les nœuds de la semaine), 123 de match (et 120 versions « + » dérivées au chargement), 81 consommables, 76 modifs de joueur, 47 patrons, 33 contrats, 18 de saison |
| Tables voisines, mêmes canaux | 11 ajustements, 23 entractes, 12 avant-gros, 91 moments et 61 moments de vie, 177 réponses de courriels |
| Raretés | 172 communes, 218 peu communes, 116 rares, 15 légendaires, 17 maudites |
| Cartes qui ne jouent que dans leur moment (`si`) | **3**, toutes des modifs de joueur (le gardien du château, la route, le printemps : domicile, visiteur, séries). Le `si` des ajustements et des entractes filtre seulement ce qui est offert ; aucune carte d'équipe ne sait attendre son moment |
| Ce que les robots en jouent | **rien**, sauf les dix cartes du deck de départ au duel : ils n'achètent que des packs de joueurs et ignorent places, nœuds, patrons et butins (scripts/lib/rogue_sim.mjs) |
| Écrites pour | des boucles parties depuis : la poche, la main de la semaine, l'entracte en cartons, l'avant-match à deux cartes |

Presque toutes les cartes jouent tout le temps, partout. Une carte qui vaut autant n'importe quel soir ne demande rien : on la pose et on l'oublie. C'est la raison pour laquelle le Rogue se jouait tout seul (docs/refonte-v9.md § 2), du côté des cartes.

On garde : **les cartes de joueur** (le cartable, les éditions, les galons), **les coachs** (les neuf philosophies), **les juges** et leurs bornes, et les canaux du moteur.

## 2. Le principe : une carte = un moment + une réponse

1. **Elle dit son moment en premier** : « Quand ils annoncent l'ombre », « Un soir de dos-à-dos », « Contre ta bête noire ». Hors de son moment, elle ne fait rien ; dans son moment, elle frappe plus fort qu'une carte de tous les soirs (la règle de `check_si`, étendue à tous les moments).
2. **Elle change la forme du match, pas sa force** : les bornes de rareté ne bougent pas (commune ±1 V, peu commune ±1,5, rare ±2,5, légendaire ±4 : un maximum) ; une rare ou une légendaire se voit dans la feuille.
3. **Elle passe par les canaux qui existent** : tirs, précision, précision adverse, punitions, usure des jambes, robustesse, blessures, les gestes (repos, soin), le plafond, les jetons. Le moment est neuf ; l'effet ne l'est pas.
4. **Elle trouve son coach sur ce qu'elle fait** : sa couleur se lit sur ses canaux, comme aujourd'hui (`check_coachs`).
5. **Elle se lit en vraies stats** : « ≈ +2 tirs ce soir », jamais en victoires.
6. **Elle a une voix et un nom d'ici** : l'humour de *Tape to Tape*, les voix d'`EXPEDITEURS` (Jalon M).

## 3. Les moments : le « si » élargi

Chaque moment se lit sur ce qui est **déjà connu** le jour où la carte se joue (`deDuJour`, `grosAnnonces` : rien d'avance — `check_graine`). Aujourd'hui, seul un joueur porte un moment (`p._si`, lu par `siDe` sur `p._soir`, posé par `playGame`). La tranche 1 pose le même drapeau pour une carte d'équipe (un filtre dans `effetsActifs`, sur le modèle d'`effetsCibles`) et ajoute les moments ci-dessous ; aucun nouvel appel à `hasard()`.

| Famille | Moments | Lu sur |
|---|---|---|
| **Le lieu** | à domicile · à l'étranger | existe |
| **Les séries** | en séries · en finale | existe (séries) |
| **Le duel** | quand ils annoncent 🥷 l'ombre, 🦈 la chasse, ⛔ fermer le centre, 🐗 l'assaut ou 🦂 les punitions · en 3e période en avance, à égalité ou en retard · la mise doublée | `INTENTIONS`, l'intention de la période dans `jouerDuel` ; le pointage des deux périodes jouées (le duel seulement : un match ordinaire n'a pas d'arrêt à 40:00) |
| **Le calendrier** | un soir de dos-à-dos · le premier match après un congé | `dosADos`, le calendrier |
| **Les jambes** | jambes du club sous 70 · au-dessus de 85 | les jambes du matin |
| **L'adversaire** | contre un rival · contre ta bête noire 😤 · contre plus fort que toi au classement | les rivaux, `beteNoire`, le classement du matin |
| **La forme** | après une défaite · après trois victoires · un joueur sur sa lancée · un joueur dans le doute | les feuilles jouées, `lanceeDe` ; « après une défaite » demande un champ neuf (le dernier résultat), le moteur n'en garde pas |
| **L'infirmerie** | un blessé qui joue amoché · un joueur de moins dans l'alignement | `jouerBlesse`, l'alignement |
| **Le plan** | une unité « bâtie pour » son système · une unité mal assortie | `famillesDe`, `PLAN_PAIE` |

Un moment qui n'arrive pas ne sert à rien : chaque moment doit revenir **au moins trois fois par saison** dans une run type (le juge neuf, `check_moments`, § 8).

## 4. Le jeu neuf, par où il se joue

Les sept catégories d'aujourd'hui deviennent quatre piles, chacune à sa place dans la boucle de la V9 ; les événements quittent la banque.

| La pile | Où elle se joue | Ce qu'elle répond | Combien |
|---|---|---|---|
| **Le cahier** (cartes de match) | au duel, à l'élan (2 par période), une main pour les trois périodes | une intention annoncée (une **réponse**), ou l'état du pointage en 3e (un **coup**) | ~45 |
| **Les places** (consommables) | hors combat, quand tu veux, trois au plus | la semaine : les jambes, le dos-à-dos, un blessé, une disette, un fil ouvert | ~30 |
| **L'équipement** (modifs de joueur) | posée sur un joueur, pour la saison | un moment du joueur : en séries, contre un rival, sur sa lancée, en avantage numérique | ~25 |
| **Le personnel** (patrons et contrats) | permanent, un poste par rôle ; les contrats au plafond | un moment de la saison : les dos-à-dos, les voyages, les soirs de bête noire ; l'espace sous le plafond | ~20 |
| **Total** | | | **~120** (538 aujourd'hui) |

Par coach : environ quatre cartes de cahier, trois places, trois équipements et deux postes de personnel chacun (9 × 12 = 108), plus une douzaine de cartes neutres. Chaque coach a donc assez de cartes pour une voie (`check_voies` : à sa III, +6 à +8 V sur une équipe bâtie pour lui).

**Les événements** (160) ne sont plus des cartes : ce sont des choix d'À faire, dits par une voix (les scènes du Jalon M). Une vingtaine de situations, chacune avec ses options, au lieu de 160 cartes à tirer.

**Les cartes de saison** (18) se fondent dans le personnel. **Les maudites** (17) : il en reste cinq, des contrats lourds qu'on prend pour leur argent.

## 5. Ce à quoi elles ressemblent

Dix cartes pour donner le ton. Les chiffres sont à mesurer en paires (§ 8) ; l'effet ici dit la forme, pas le dosage.

| Carte | Pile · coach · rareté | Moment | Ce qu'elle fait |
|---|---|---|---|
| 🪞 **Le miroir** | cahier · 🐢 la Tortue · commune | quand ils annoncent 🥷 l'ombre | ta vedette joue le temps de la période avec son ombre en moins ; contrée, elle rend la moitié |
| 🧲 **Le double échec** | cahier · 🦏 le Rhino · peu commune | quand ils annoncent 🦈 la chasse | les mises en échec changent de camp ; une punition de plus pour toi |
| 🥅 **Le filet désert** | cahier · 🌠 le Showman · rare | en 3e, en retard | les deux dernières minutes : +3 tirs pour toi, la porte grande ouverte |
| 🔒 **Fermer les livres** | cahier · 🐢 la Tortue · peu commune | en 3e, en avance | ils tirent de loin ; tes tirs aussi baissent |
| 🛌 **Le bain de glace** | place · 🫁 le Doc · commune | un soir de dos-à-dos | les jambes perdent moins ce soir |
| 📼 **La cassette de 1987** | place · 😇 l'Abbé · peu commune | après une défaite | le vestiaire se ressoude : moins de punitions trois soirs |
| 🏒 **Le bâton de ton oncle** | équipement · 🦅 l'Aigle · rare | sur sa lancée | sa lancée dure deux matchs de plus et finit mieux |
| 🧂 **La rancune** | équipement · 🦏 le Rhino · peu commune | contre ta bête noire | il frappe et lance plus ; il s'expose aux punitions |
| 🚌 **Le chauffeur d'autobus** | personnel · 🪜 le Contremaître · peu commune | à l'étranger, un dos-à-dos | l'usure des jambes baisse ces soirs-là |
| 💼 **La clause du vieux** | personnel (contrat) · 🏦 le Comptable · maudite | toute la saison | 3 M$ d'espace de plus ; ton vétéran le plus cher s'use plus vite |

## 6. La rareté et la valeur

- Les quatre raretés et leurs bornes restent ; une légendaire est une carte de **moment rare** (la finale, la mise doublée, la bête noire en séries), qui frappe fort quand il arrive.
- Le prix d'une carte suit la fréquence de son moment : un moment qui revient chaque semaine paie moins par soir qu'un moment qui arrive trois fois par saison.
- Les packs de cartes gardent leurs taux par rareté (`check_packs`) ; le butin d'un duel gagné offre une carte du **coach en poste** et une neutre.

## 7. Les sauvegardes et les runs en cours

Les sauvegardes rejouent la saison avec les identifiants des cartes : les décisions (`d.carte`, `place`, `vend.refs`, `main.tirage`, `retrait`), le cahier, les places, l'inventaire permanent (`cap82_rogue.inventaire`). Un identifiant parti ne se rejoue pas.

Proposé :
- `VERSION_MOTEUR` monte ; l'empreinte du moteur se réécrit (`EMPREINTE=ecrire`).
- **Une run commencée avant** reprend sa saison en cours **au début** avec le jeu neuf : ses cartes anciennes sont remboursées en jetons, à leur valeur de revente (`valeurDe`) ; son effectif, ses jetons et son cartable restent.
- **L'inventaire permanent** (le congédiement, le rappel…) : chaque carte ancienne a sa remplaçante désignée, ou se rembourse en médailles 🏅.
- **Le cartable des joueurs** ne bouge pas.
- Le 82-0, Sur table et l'exhibition n'ont pas de cartes : rien n'y change.

Le moteur n'a **aucune table de correspondance** d'identifiants : une carte absente est sautée en silence (`deckDe`, `placesDeLaPartie`, `jouerDuel`), et la saison en cours rejouerait un autre passé — des decks plus courts, d'autres mains, d'autres comptes de coach. D'où la reprise au début de la saison plutôt qu'un rejeu. Pendant les tranches 2 à 5, l'ancien jeu reste défini et passe `retire: true` (la voie déjà prise pour 127 événements) ; il part pour de bon à la tranche 6, avec la conversion.

## 8. Les juges

| Juge | Ce qu'il exige du jeu neuf |
|---|---|
| `check_cartes` | chaque carte mesurée **en paires**, sous la borne de sa rareté ; une rare ou une légendaire se voit dans la feuille |
| `check_si` | étendu à **tous les moments** : dans son moment, plus fort qu'une carte de tous les soirs ; hors de lui, rien |
| **`check_moments`** (neuf) | chaque moment se lit sur le passé seulement (rien d'avance) ; chacun revient au moins trois fois par saison dans une run type ; aucune carte dont le moment n'arrive jamais |
| `check_combat` | chaque carte jouable est lue par le moteur |
| `check_coachs`, `check_voies` | la couleur de chaque carte sur ses canaux ; chaque coach à sa III vaut +6 à +8 V sur une équipe bâtie pour lui |
| `check_combo` | réécrit sur les combos neufs : chaque pièce seule sous sa borne, le build complet qui casse le jeu |
| `check_packs`, `check_banque` | les taux des packs ; la banque entière mesurée (une heure et plus) |
| `check_robot`, `check_profondeur`, `check_rogue`, `check_duel` | **les robots apprennent à jouer des cartes**, ce qu'ils ne font pas aujourd'hui : l'attentif achète des cartes de son coach, garde une réponse pour l'intention qu'elle contre, joue une place dans son moment ; le distrait au hasard. Sans eux, la profondeur du jeu neuf ne se mesure pas. Le duel bien joué contre le mal joué reste à 62-65 % ; la première Coupe vers la run 3, puis les exigences : la run se recalibre |
| Les comptes des juges | `check_coachs` exige 280 cartes et 13 par coach, `check_banque` 150 cartes en 7 familles : ces planchers suivent le jeu neuf (≈ 120 cartes, 4 piles, 12 par coach), dits et justifiés dans la PR qui les baisse |
| Les identifiants écrits dans les juges | `check_combat`, `check_coachs`, `check_banque`, `check_rogue`, `check_si`, `check_combo`, `check_deck`, `check_atelier`, `check_chiffres`, `check_impact` nomment des cartes d'aujourd'hui : chacun se réécrit avec la pile qu'il juge |
| `check_clarte` | chaque face dit son moment en premier ; une icône = un sens |
| `check_mort` | l'ancien jeu part en entier : aucune carte morte, aucun export orphelin |

## 9. Les tranches, une PR chacune

1. **Les moments dans le moteur** : le « si » élargi aux cartes d'équipe et aux moments du § 3, sans aucune carte neuve ; `check_moments` et `check_si` étendus ; les robots apprennent à jouer une carte. Les cartes d'aujourd'hui ne bougent pas.
2. **Le cahier neuf** (le duel) et les robots qui le jouent ; l'ancien deck de match part.
3. **Les places et l'équipement**.
4. **Le personnel et les contrats**.
5. **Les événements deviennent des choix d'À faire**, dits par leurs voix (la suite des scènes du Jalon M, A3 à A6).
6. **La conversion des sauvegardes, le retrait de l'ancien jeu, la recalibration de la run** (`check_profondeur`, `check_rogue`), les règles du jeu à jour.

Ensuite, **les écrans du Rogue refaits à neuf** (le Bureau, À faire, Ce soir, le duel), maquettes d'abord. Le Jalon M en cours finit ses tranches 1 à 4 (les correctifs mobiles, le look, les cibles, les scènes) ; ses tranches 6 à 8 attendent ces écrans.

## 10. Ce que JP tranche

1. **Les événements** sortent de la banque et deviennent des choix d'À faire (une vingtaine de situations) ?
2. **Le compte** : ~120 cartes, environ douze par coach, est-ce assez de variété d'une run à l'autre ?
3. **Les maudites** : cinq contrats lourds, ou aucune ?
4. **Les runs en cours** : reprises au début de leur saison, les cartes remboursées en jetons (proposé), ou finies au bilan ?
5. **Les cartes de saison** se fondent dans le personnel ?
6. **Les moments du § 3** : en manque-t-il un que tu veux voir (une rivalité de série, le match des anciens, la date limite des échanges) ?
