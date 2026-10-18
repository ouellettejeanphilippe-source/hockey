# V10 · Le jeu de cartes neuf

JP, 17 oct. : *en dehors des joueurs, on devrait jeter toutes les cartes et créer de zéro avec la nouvelle philosophie en tête au lieu d'ajuster ce qui était là avant. Ça permettrait d'avoir des cartes plus circonstancielles et plus proches de ce qu'on veut faire.* Tranché le même jour : **les cartes d'abord, puis les écrans du Rogue** ; **le « si » s'élargit** à de nouveaux moments.

Ce document est le devis, tranché par JP le 17 oct. (§ 10) ; ce qui est fait est au § 11.

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

Implantés (`MOMENTS_SI`, js/sim.js), mesurés sur des saisons de run du robot attentif (`check_moments_si`, quatre clubs) :

| Famille | Moments (`si`) | Lu sur | Soirs par saison |
|---|---|---|---|
| **Le lieu** | `domicile` · `visiteur` | qui reçoit | 41 · 38 |
| **Les séries** | `series` (rare) | les séries | `check_si` |
| **Le calendrier** | `dosADos` | `dosADos`, la cédule | 15 |
| **Les jambes** | `jambesLourdes` (un patineur sous 86) · `jambesFraiches` (tous à 92 ou plus) | le patineur le plus fatigué de l'alignement : la moyenne du club ne bouge presque pas (90 à 96), le plus fatigué va de 81 à 93 | 18 · 11 |
| **L'adversaire** | `rival` · `beteNoire` (rare) | `rivalChoisi`, `beteNoire` | 6 · 10 en quatre saisons |
| **La forme** | `apresDefaite` · `enFeu` (trois victoires de suite) | `_suite`, posée après chaque match | 28 · 24 |
| **L'infirmerie** | `infirmerie` (deux blessés ou plus) · `amoche` (un blessé qui joue amoché : un choix du joueur, que les robots ne font pas) | le registre des blessures ; `jouerBlesse` | 49 · — |
| **Le duel** | `ombre` · `chasse` · `centre` · `assaut` · `cachot` (l'intention de la période) ; `mene` · `egal` · `derriere` (la 3e, selon le pointage après deux) — tous rares | `jouerDuel`, période par période | 23 · 8 · 11 · 23 · 34 ; 23 · 4 · 6 en quatre saisons |

Écartés à la mesure : « un seul blessé » (vrai 76 soirs sur 82 : ce n'est plus un moment), « les jambes du club sous 70 » (jamais), « contre plus fort que toi au classement » (le classement change au fil de la journée : pas lu sans un instantané du matin), le plan d'une unité (il ne change pas d'un soir à l'autre : c'est une condition, pas un moment ; les cartes du plan passent par `PLAN_PAIE`).

Un moment qui n'arrive pas ne sert à rien : un moment courant revient **au moins trois fois par saison** dans une run type, sans être vrai plus des trois quarts des soirs ; un moment rare arrive au moins une fois (le juge neuf, `check_moments_si`, § 8). Un moment rare vaut plus par soir.

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

Tranché (JP : *reset toute*) :
- `VERSION_MOTEUR` monte ; l'empreinte du moteur se réécrit (`EMPREINTE=ecrire`).
- **Toutes les runs en cours repartent de zéro** avec le jeu neuf.
- **L'inventaire de cartes** (le méta : `inventaire`, `personnel`, `cartes`) se vide.
- **Le cartable des joueurs** ne bouge pas.
- Le 82-0, Sur table et l'exhibition n'ont pas de cartes : rien n'y change.

Le moteur n'a **aucune table de correspondance** d'identifiants : une carte absente est sautée en silence (`deckDe`, `placesDeLaPartie`, `jouerDuel`), et la saison en cours rejouerait un autre passé — des decks plus courts, d'autres mains, d'autres comptes de coach. D'où la reprise au début de la saison plutôt qu'un rejeu. Pendant les tranches 2 à 5, l'ancien jeu reste défini et passe `retire: true` (la voie déjà prise pour 127 événements) ; il part pour de bon à la tranche 6, avec la conversion.

## 8. Les juges

| Juge | Ce qu'il exige du jeu neuf |
|---|---|
| `check_cartes` | chaque carte mesurée **en paires**, sous la borne de sa rareté ; une rare ou une légendaire se voit dans la feuille |
| `check_si` | étendu à **tous les moments** : dans son moment, plus fort qu'une carte de tous les soirs ; hors de lui, rien |
| **`check_moments_si`** (neuf) | chaque moment se lit sur le passé seulement (rien d'avance) ; chacun revient au moins trois fois par saison dans une run type ; aucune carte dont le moment n'arrive jamais |
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

1. **Les moments dans le moteur** : le « si » élargi aux cartes d'équipe et aux moments du § 3, sans aucune carte neuve ; `check_moments_si`. Les cartes d'aujourd'hui ne bougent pas (l'empreinte du moteur est la même). *Fait (§ 11).*
2. **Le cahier neuf** (le duel) et les robots qui le jouent — ils n'en jouent aucune aujourd'hui, sauf le deck de départ ; l'ancien deck de match part. *Fait (§ 13).*
3. **Les places et l'équipement**. *Fait (§ 14).*
4. **Le personnel et les contrats**. *Fait (§ 15).*
5. **Les événements deviennent des choix d'À faire**, dits par leurs voix (la suite des scènes du Jalon M, A3 à A6). *Fait (§ 16).*
6. **La conversion des sauvegardes, le retrait de l'ancien jeu, la recalibration de la run** (`check_profondeur`, `check_rogue`), les règles du jeu à jour.

Ensuite, **les écrans du Rogue refaits à neuf** (le Bureau, À faire, Ce soir, le duel), maquettes d'abord. Le Jalon M en cours finit ses tranches 1 à 4 (les correctifs mobiles, le look, les cibles, les scènes) ; ses tranches 6 à 8 attendent ces écrans.

## 10. Ce que JP a tranché (17 oct.)

1. **Les événements** sortent de la banque et deviennent des choix d'À faire : *oui*.
2. **Le compte**, ~120 cartes : *oui, si elles sont variées, impactantes et liées aux coachs*. Chaque carte a sa couleur de coach, ses moments variés, et pèse dans son moment (la borne de sa rareté est un maximum, pas une cible ; une rare et une légendaire se voient dans la feuille).
3. **Les maudites** : *si elles sont pertinentes* — une maudite a un moment et une raison de la prendre (son argent, son effet dans un autre moment).
4. **Les runs en cours** : *reset toute* (§ 7).
5. **Les cartes de saison** se fondent dans le personnel : *oui*.
6. **Les moments** : ceux du § 3 ; *go*.

## 11. Fait le 17 octobre : la tranche 1, les moments

- **Le moteur** : `MOMENTS_SI` et `momentsDuSoir` (js/sim.js). `playGame` pose les moments du soir sur le club (`T._soir`) et sur ses joueurs — le même objet ; le duel y ajoute l'intention de la période et, à la 3e, le pointage après deux. La feuille garde les moments du soir (`feuille.moments`). Un effet, une carte, un patron qui portent `si` ne jouent que leur soir (`joueCeSoir`, dans `effetsActifs` et `effetsDeSaison`) ; une modif de joueur, comme avant (`siDe`). La suite de victoires ou de défaites (`_suite`) se pose après chaque match. Aucun appel à `hasard()`.
- **Rien ne change** tant qu'aucune carte ne lit un moment neuf : l'empreinte du moteur est la même (`check_empreinte`), `tout.mjs` vert.
- **Le juge** `check_moments_si` (une minute, au CI) :
  - la porte : un effet d'un moment joue son soir, rien hors de lui ;
  - dans une vraie ligue, un patron d'un moment ne change rien avant son premier soir, et la saison diverge exactement ce soir-là, pour les huit moments de la ligue ordinaire ;
  - rien d'avance : les moments d'un soir sont ceux d'une ligue jouée jusqu'à lui ;
  - chaque moment revient : neuf moments courants au moins trois fois par saison et au plus les trois quarts des soirs ; neuf moments rares au moins une fois en quatre saisons.
- **Mesuré, et changé** : les jambes du club ne descendent jamais sous 70 (la moyenne va de 90 à 96) — le moment se lit sur le patineur le plus fatigué ; un seul blessé, c'est 76 soirs sur 82 — le moment est l'infirmerie qui déborde (deux blessés ou plus, 49 soirs).

## 12. Les packs qui montent, sans fermer le hasard (JP, 17 oct.)

JP : *le type de carte dans les packs s'upgrade, ou tu peux débloquer des nouveaux types de packs, mais sans empêcher un random Crosby saison 1* ; puis : *tu commences avec des packs un peu poches, pis plus ça avance, tu débloques de meilleurs packs, ou bien t'as un système d'upgrade de packs, ou les bons packs arrivent quand tu réussis x, ou tout ça*.

Aujourd'hui, la boutique vend ses sept packs dès la première run (`BOUTIQUE`, js/packs.js), et c'est le prestige qui bride, en cachette : il multiplie les taux des Étoiles et des Phénomènes (`PRESTIGES`, js/rogue.js), et le Club de garage met le Phénomène à **zéro**. Le Crosby de 2005-06 ne peut pas sortir d'une première run.

Le plan, *tout ça*, en quatre morceaux qui passent par des canaux qui existent :

1. **Le hasard reste ouvert.** Aucun rang ne met un taux à zéro : le Club de garage tire aux taux de base de ses packs (un Phénomène : 0,05 % par carte au Bronze). Le prestige n'ôte plus rien ; il ajoute, à partir du Club respecté.
2. **On commence poche.** La boutique d'une première run : le Bronze et l'Époque. Le reste est sous clé, et la clé se voit (« 🔒 Fais les séries »).
3. **Les bons packs arrivent quand tu réussis x** (les `JALONS`, payés une fois pour toujours) : l'Argent en faisant les séries ; les Spécialistes en gagnant une ronde ; le Club à cent points ; le Pack du coach quand un coach atteint sa confiance III ; l'Or en finale ; les Étoiles en boutique avec la Coupe.
4. **L'upgrade, en médailles** (les `DEBLOCAGES`) : chaque pack monte de deux crans au vestiaire — un joueur de plus à choisir, puis les taux du métal du dessus, au même prix. Le Bronze ++ vaut l'Argent d'aujourd'hui.

*Fait le 17 octobre* (decisions.md, « Les packs qui montent ») : le Pack Étoiles de la boutique est le **Pack Vedettes**, mixte comme les autres (trois étoiles et deux cartes, 70 🪙) ; l'Époque descend au Bronze (20 🪙).

Les juges : `check_packs` (les taux affichés, aucun à zéro, la revente), `check_rogue` (la courbe des runs), `check_profondeur` (la première Coupe pas avant la run 3 ; un Phénomène chanceux ne la donne pas d'office), `essai_rogue` (la boutique de départ, la clé qui se voit, le pack qui s'ouvre au jalon).

## 13. Fait le 17 octobre : la tranche 2, le cahier neuf

- **Le cahier** (`CAHIER`, js/cahier.js) : 44 cartes. Le départ (`DEPART_DU_CAHIER`), neutre : une réponse par intention, *Tenir le fort* et *Le dernier effort* en 3e, trois cartes de tous les soirs. Les coachs, quatre cartes chacun (le Comptable, deux paris) ; leurs soirées : à domicile, à l'étranger, un dos-à-dos, les jambes lourdes, un rival, la bête noire, les séries.
- **Le moteur** : `carteRepond` lit le moment d'une carte ; `effetsDesCartes` pose son moment sur ses effets (`si`, et `siToi` sur l'adversaire) ; `jouerDuel` pose les moments de la période avant la décision, borne une réponse à sa période, et filtre ce qui vise l'adversaire sur ton moment.
- **La face** dit le moment d'abord (`regleDeCarte`, js/gerant.js), et ses chiffres sur ce temps-là (la période, la 3e).
- **L'ancien deck** est retiré des tirages (`retire`) ; il joue encore pour une run en cours jusqu'à la tranche 6.
- **Les juges** : `check_cahier` (nouveau), `check_duel` (63,9 %), `check_combat`, `check_coachs`, `check_deck`, `check_emojis` (les pictogrammes neufs dessinés au trait).

## 14. Fait le 18 octobre : la tranche 3, les places et l'équipement

- **Les places** (`PLACES_NEUVES`, js/places.js) : 30, trois par coach et trois neutres ; chacune un moment de la semaine, sur ses `duree` prochains matchs. Le Comptable paie tout de suite.
- **L'équipement** (`EQUIPEMENT`, js/equipement.js) : 18, des mutations d'un moment, au Frelon, à l'Aigle, à la Tortue, au Doc et au Showman (trois chacun) et trois neutres — un joueur n'a pas de canal de robustesse, de punitions, de minutes ni d'argent qui sache attendre un moment.
- **L'ancien jeu de tous les soirs** est retiré des tirages ; les outils qui ont déjà leur moment restent.
- **`parSaison`** sur chaque moment (`MOMENTS_SI`) : combien de soirs il compte dans une saison de run ; la fiche d'un équipement le dit, le juge s'en sert.
- **Le juge** `check_places` (neuf), en paires, match par match.
- **Reporté à la tranche 6** : les robots qui jouent les places et l'équipement.

## 15. Fait le 18 octobre : la tranche 4, le personnel et les contrats

- **Le personnel** (`PERSONNEL`, js/personnel.js) : 21 postes, deux par coach et trois neutres (le départ en impose deux), chacun un moment de la saison ; le Comptable, l'argent toute l'année.
- **Les contrats lourds** (`CONTRATS_MAUDITS`) : quatre, de l'espace tout de suite et un prix certains soirs ; avec la taxe, cinq maudites.
- **Les cartes de saison** se fondent dans le personnel et ne se tirent plus ; l'ancien personnel non plus (le DG du plafond flexible reste).
- **Le moteur** : les minutes et l'usure qu'un patron déplace attendent son moment.
- **Le juge** : `check_places` mesure aussi le personnel et les contrats lourds.

## 16. Fait le 18 octobre : la tranche 5, les dossiers de la semaine

- **Les dossiers** (`DOSSIERS`, js/dossiers.js) : 19, un lundi sur deux, chacun un fait du lundi, une voix, deux ou trois réponses sur les canaux qui existent (souvent d'un moment). « Situation » est déjà au vestiaire : le mot est **dossier**.
- **Les événements** ne se tirent plus ; la route ❓ quitte le nœud, qui garde ses trois autres routes.
- **Les scènes de la semaine** (M5, A3 à A6) : la route, la blessure, les rivaux, le butin.
- **Les juges** : `check_dossiers` (remplace `check_evenements`), `check_places` (les réponses en paires), `check_clarte` § 5, `essai_rogue`.
