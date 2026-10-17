# La V9 · un plan, des joueurs qui le servent, un adversaire qui répond

16 octobre 2026. JP :
- *Les actions du joueur : gérer les cartes et l'alignement, gérer sa main, faire les choix (tous au même endroit du UI, même UI et UX), avancer les jours.*
- *Les actions du jeu : contrer les cartes du joueur pendant les matchs (quitte à revoir les gros matchs), les blessures, des événements qui racontent, des mécaniques qui rendent les joueurs mémorables.*
- *Une base de données où les joueurs d'un même trio ne se valent pas, pour permettre des substitutions. Jamais « telle carte est meilleure » dans l'absolu : telle carte fitte mieux avec le but du DG et du coach.*
- *Que les cartes elles-mêmes comptent plus dans la façon dont l'équipe joue. Voir si les cotes actuelles marchent, ou s'il faut des OV ou autre chose pour optimiser ses trios.*
- *Simplifier visuellement et la façon de jouer, mais gagner en profondeur et en storytelling, deux choses absentes aujourd'hui. Le Rogue est brain dead ; le 82-0, avec ses rolls, demande plus de stratégie.*
- *Je ne suis pas attaché au jeu tel qu'il est, mais demande-moi avant un changement majeur.*

**Proposé, puis tranché le 16 oct. (§ 12) : oui à tout.** Les tranches 1 à 5 sont faites (§ 13 à § 17) ; les autres attendent leur tour, une PR chacune.

## 1. Comment c'est mesuré

Quatre enquêtes dans le code : les cotes, le moteur, la boucle du Rogue, la narration. Plus trois mesures faites hors du dépôt (méthode en annexe), sur le moteur tel quel :
- **le fit** : à niveau égal, le meilleur joueur pour une case change-t-il selon le système ?
- **les compagnons** : sa valeur change-t-elle selon ses compagnons de trio ?
- **le plafond** : contraint-il les signatures en Rogue ?

## 2. Pourquoi le Rogue se joue tout seul

| # | Constat | Le chiffre |
|---|---|---|
| 1 | **La valeur d'un joueur est absolue.** À niveau égal, le meilleur pour une case est le même dans les sept systèmes. | 7 cases mesurées (2e trio, 4e trio, 2e paire…), dans quatre vraies équipes (BOS 1995-96, MTL 1985-86, CHI 2015-16, CAR 2005-06), une quarantaine de candidats chaque fois. L'ordre des candidats d'un système à l'autre : Spearman 0,97 à 0,99. Le même meilleur dans les 7 systèmes, chaque fois. Signer « pour le système » plutôt que le meilleur en général rapporte **0,0 à 0,1 V**. |
| 2 | **Les compagnons ne changent presque rien.** | Avec deux snipers, deux passeurs ou deux two-way à côté : Spearman de 0,87 en moyenne (0,79 au plus bas), et le même meilleur (Gary Roberts 1997-98) dans chaque cas. Le power forward vaut +1,0 à +1,5 V de plus que la moyenne partout : il aide ses compagnons (jusqu'à +7,4 % de finition) quel que soit le plan. |
| 3 | **Ce que l'écran montre ne dit pas ce que le moteur paie.** | À niveau égal, le moteur paie surtout le vrai % de tir, les buts par match et le +/-. Le niveau affiché (les points par match) et la cote cachée `v` n'en prédisent presque rien : Spearman de −0,30 à +0,42. Le joueur ne peut donc pas raisonner : il ne peut que faire confiance à « Le meilleur pour ton alignement ». |
| 4 | **Le jeu est calibré comme si tu ne décidais rien.** | Le robot qui règle la difficulté (`rogue_sim`) ne prend que 4 sortes de décisions sur environ 25 : le pack, la signature, les rivaux, l'alignement automatique. Le reste est un petit bonus optionnel : une carte est bornée à ±1 V (commune) jusqu'à ±4 V (légendaire), un dilemme vaut ±0,2 V sur dix matchs. Une saison a un écart type de 4,5 V. Et `check_choix` exige que chaque option soit un compromis, donc des options d'espérance presque égale : ça se joue à pile ou face. |
| 5 | **L'adversaire ne répond jamais.** | Sa main est pigée de la graine avant la tienne. Son plan sort des chances du dépistage. Gros match : 51,5 % de victoires sans carte, 47,1 % avec sa main seulement, 52,8 % avec tes trois cartes de départ. Deviner son plan : 51,4 % juste, 49,2 % sans deviner, 46,3 % faux. |
| 6 | **Les choix vivent dans douze contenants.** | Environ 25 sortes de choix, rendus dans le Bureau (« À faire »), la page de la semaine, `.choix-modal`, l'écran de combat, l'entracte, `#departModal`, les listes de joueurs, « Ce soir », les Lignes, le Marché, les Cartes et les packs. `optionHtml` n'est partagé qu'entre trois d'entre eux. |
| 7 | **Rien ne reste.** | Les arcs (15 modèles, au plus 5 par saison) jouent leur effet sans rien demander. Les légendes sont 4 badges binaires, cosmétiques, sans date ni adversaire. Les trophées ne sont pas sauvegardés. Entre deux saisons, l'équipe se défait (5 restent) et leurs stats repartent à zéro. La vitrine de la Coupe choisit ses joueurs d'après leur vraie saison, pas d'après ce qu'ils ont fait chez toi. |

**Pourquoi le 82-0 demande plus de stratégie.** La roulette contraint : UN vestiaire, le plafond qui mord, 23 choix à la suite, et chacun a un coût d'opportunité visible. En Rogue, l'offre du pack est déjà filtrée sous le plafond (`salaireMax`), et la liste répond à ta place. Mesuré sur six runs du robot : la masse salariale monte à 97 % du plafond en fin de saison, mais le plafond n'a bloqué que 2 signatures sur 34 joueurs offerts par saison. Il façonne l'offre ; il ne force jamais un choix.

**En une phrase.** Il n'y a qu'une vraie décision, prendre le meilleur, et le jeu la prend pour toi. Le reste ne pèse pas assez pour qu'on s'en souvienne.

## 3. Les cotes : des OV, ou autre chose ?

**Ce qui existe.** Six cotes cachées par joueur : `o`, `d`, `r`, `c`, `sp`, `v`. Le moteur n'en lit presque aucune pendant un lancer :
- il lit les vraies stats du joueur (son % de tir, ses lancers, ses passes, son contexte de création) et sa défensive `d` ;
- `v` ne sert qu'à la zone, au salaire et à l'ordre de l'alignement automatique ;
- `o`, `c` et `sp` sont des vestiges.

**Une OV, non, et pour une raison de design, pas à cause de la règle.** La règle « aucune cote dans le DOM » pourrait tomber si c'était utile (JP, 16 oct.). Mais une OV, c'est exactement « telle carte est meilleure dans l'absolu », le contraire de ce que JP demande. Et le moteur ne joue pas une OV : en afficher une serait mentir.

**Ce qui manque, ce n'est pas une cote : c'est une interaction.** Le moteur multiplie des facteurs indépendants : le tireur, les passeurs, le gardien, la défense. Un système multiplie toute son unité (Volume de tirs : ×1,157 pour tout le monde), ce qui garde l'ordre des joueurs intact. Le fit d'aujourd'hui n'est qu'un bonus quand les étiquettes de rôle concordent. Il n'y a nulle part de terme où le contexte change **quelle stat du joueur compte**. C'est ce qu'il faut ajouter.

**La proposition : le plan décide quelles stats comptent.**
- **Le profil d'un joueur** : quatre familles de rôles, toutes, pas seulement le premier rôle.
  - **Tir** : 🎯 sniper, 🚀 offensif.
  - **Jeu** : 🅰 passeur, 🏒 manieur.
  - **Défense** : 🛑 défensif, ☯ two-way, 🔧 checker.
  - **Robustesse** : 🦍 power, 💪 physique, 👊 bagarreur, 🪠 plombier.

  Les scores de rôle existent déjà (`rolesBruts`) : aucune cote neuve. À l'écran, chaque famille se dit en rang dans sa saison (le badge, Bronze à Platine) et en vraie stat (« 31 buts, 15,2 % »), jamais en chiffre de cote. Le « profil en crans » retiré le 30 septembre ne faisait rien dans le moteur ; celui-ci serait le moteur.
- **Le plan** : le coach (pour l'équipe) et le système (pour chaque unité) disent quelles familles ils paient. Dans un trio en Trappe, la Défense d'un joueur compte double et son Tir moins. En Cycle, c'est son Jeu. Le même joueur est une aubaine dans un plan et un poids dans un autre.
- **Le salaire suit la valeur générale (`v`), pas le fit.** Un joueur fort dans la famille que ton plan paie, mais modeste ailleurs, coûte peu : c'est l'aubaine du DG qui a un plan.
- **Gretzky reste Gretzky.** D'un niveau à l'autre, le talent décide ; à niveau égal, c'est le plan.
- **La force nécessaire, mesurée.** Pour que le plan reclasse des joueurs du même niveau, la famille qu'il paie doit valoir environ **1 V par écart type** dans le top six (le Spearman entre deux plans tombe à 0,44, et 3 plans sur 4 ont un meilleur différent), et environ **0,5 V** dans le bas de l'alignement. C'est l'ordre de grandeur de l'écart entre deux candidats du même niveau : un vrai changement du moteur. À cette force, signer pour son plan rapporte environ +0,4 V par case ; sur 18 cases, une équipe bâtie pour son plan vaudrait de l'ordre de +7 V de plus qu'une équipe mélangée au même salaire. C'est le poids d'un coach à sa III aujourd'hui (`check_voies`).
- **En Rogue seulement.** Le 82-0, Sur table et l'exhibition ne bougent pas : leurs stats, leurs `check_parts` et leur `check_ratings` restent tels quels.

## 4. Les jeux qui inspirent, et ce qu'on leur prend

JP, 16 oct. : *Fire Emblem, XCOM, Darkest Dungeon, Alien: Dark Descent, Slay the Spire, Marvel Snap, Pokémon Pocket, Tape to Tape, Blood Bowl, EHM* ; puis *même NHL 94, si on pouvait avoir un genre de mode action avec les cartes*.

| Le jeu | Ce qu'on lui prend | Où dans la V9 |
|---|---|---|
| **Fire Emblem** | Être familier avec ses joueurs ; les soutiens, deux compagnons qui montent un lien en se battant ensemble | Le duo devient un lien nommé, gagné par un choix ou un exploit commun (§ 6.7). Peu de liens, chacun visible, jamais un compteur caché pour chaque paire : l'entente apprise a été retirée le 11 oct. |
| **XCOM** | Le soldat qu'on a nommé, ses rangs, le mur des disparus ; perdre un vétéran fait mal | Les galons ; le panthéon et ses chandails retirés (§ 6.8) ; une blessure grave qui compte |
| **Darkest Dungeon** | Les manies gagnées, bonnes et mauvaises, qui collent au héros ; soigner et reposer entre deux expéditions | Des galons des deux côtés : la peur des gros matchs après trois défaites en séries, le tueur après trois buts gagnants. La route du lundi : le repos, l'infirmerie |
| **Alien: Dark Descent** | Le roster qui s'use, les traumas, les promotions | Les jambes ; les séquelles d'une longue blessure (§ 6.6) ; la promotion par galons |
| **Slay the Spire** | La run, les reliques, l'intention de l'ennemi, l'envie d'aller plus loin | La run, les places (§ 6.4), le duel à intentions (§ 6.3) |
| **Marvel Snap** | Les gros matchs : des lieux dévoilés un à un, une main courte, « snap » pour doubler la mise | Le duel en trois périodes : chacune a son lieu, dévoilé au début (la glace molle, la foule, l'arbitre qui avale son sifflet), et tu peux doubler la mise (jetons et contrecoup) avant la 3e (§ 6.3) |
| **Pokémon Pocket** | Le cartable, l'ouverture des packs, les extensions | Le cartable (fait) ; la carte qui monte par ses exploits (§ 6.8) |
| **Tape to Tape** | Des améliorations bizarres et drôles | Des galons et des cartes à l'humour d'ici : « Le bâton de ton oncle », « La superstition du gardien » |
| **Blood Bowl** | Chaque joueur a sa personnalité, gagne des points d'étoile, se blesse pour de bon | Les galons par points d'exploits, comme les points d'étoile ; une blessure qui laisse une trace (§ 6.6) |
| **EHM** | Les histoires qui s'écrivent seules, saison après saison ; une information claire et complète | Les fils lus dans les feuilles (§ 6.7) ; chaque information là où elle sert (V8) |
| **NHL 94** | Un mode action : le match joué en direct | À trancher (§ 12, question 9) |

## 5. Le jeu, en dix verbes

| | Le verbe | Aujourd'hui | V9 |
|---|---|---|---|
| Toi | **Bâtir** (cartes et alignement) | Signer le meilleur ; l'alignement se fait seul | Choisir un plan, puis signer et aligner les joueurs qui le servent, sous un plafond qui mord |
| Toi | **Jouer sa main** | Quatre piles (poche, main de la semaine, deck, en jeu) ; deux cartes par semaine | Un seul paquet, joué en combat sur trois périodes : quoi jouer maintenant, quoi garder pour plus tard |
| Toi | **Trancher** | Environ 25 sortes de choix dans douze contenants | Tous dans « À faire », une seule forme, un seul geste |
| Toi | **Avancer** | « Avancer » dit où il s'arrête (V8) | Inchangé : il s'arrête au prochain choix dû ou au prochain combat |
| Le jeu | **Répondre** | Une main pigée d'avance | L'adversaire lit ton équipe et ce que tu as joué, et l'annonce avant d'agir |
| Le jeu | **Blesser** | Un remplaçant à choisir | Des choix avec un prix (le jouer blessé ?), une mémoire, et des vedettes ciblées |
| Le jeu | **Raconter** | Des fils lus ; une prime en jetons, rien à décider | Chaque fil fort devient un choix, et il revient plus tard |
| Le jeu | **Graver** | Quatre légendes cosmétiques | Des galons gagnés dans la run, son histoire chez toi, le panthéon du club |
| Le jeu | **Différencier** | La valeur est absolue | Le profil en quatre familles, payé par le plan |
| Le jeu | **Juger** | Un robot qui ne décide rien | Deux robots, l'attentif et le distrait ; l'écart entre eux est la profondeur du jeu |

## 6. Chaque verbe, en détail

### 6.1 Le plan

- **Le coach, c'est le plan de l'équipe.** On le choisit au début de la saison, comme aujourd'hui. Chacun paie une ou deux familles et en coûte une. Par exemple :
  - 🐢 la Tortue paie la Défense et coûte du Tir ;
  - 🐝 le Frelon paie le Tir et la Robustesse et coûte du Jeu ;
  - l'Aigle paie le Tir et le Jeu et coûte de la Défense.

  Les neuf se tranchent à la tranche 3. La confiance (I, II, III) monte toujours avec les cartes jouées. *Tranché à la tranche 3 (§ 15) : la Tortue et le Contremaître paient la Défense, l'Aigle le Tir et le Jeu, le Frelon le Tir et la Robustesse, le Rhino et le Doc la Robustesse, l'Abbé et le Showman le Jeu.*
- **Moins de systèmes, chacun lisible.** Sept systèmes de trio et cinq de paire deviennent quatre et trois, un par famille, plus « sans système » :
  - trios : Volume (Tir), Cycle (Jeu), Trappe (Défense), Échec avant (Robustesse) ;
  - paires : Activer (Tir et Jeu), Maison (Défense), Nettoyer (Robustesse). *Devenu quatre à la tranche 3 (JP : oui) : Activer (Tir), Sortie rapide (Jeu), Maison (Défense), Nettoyer (Robustesse). À points égaux, le Tir et le Jeu d'un défenseur sont complémentaires : les payer ensemble ne payait rien.*

  Le fit d'une unité ne compare plus des étiquettes : c'est la somme de ce que ses joueurs apportent dans la famille que son système paie.
- **Ce que l'écran dit** : le profil de ton équipe en quatre familles, contre celui que ton coach paie. « Ton plan paie la Défense : 9 joueurs sur 18 la servent. »

### 6.2 Signer : le plafond qui mord

- **Le plafond doit mordre dès le départ.** Ta masse salariale part près du plafond, et chaque signature fait partir quelqu'un ou une partie de la masse. Pour y arriver :
  - l'offre n'est plus filtrée sous le plafond. Un joueur trop cher se signe en libérant de la place, et la liste dit qui partirait ;
  - c'est le choix du 82-0 : le meilleur coûte, et la place a un prix.
- **La liste de signature reste** (JP, 16 oct. : *le meilleur joueur pour notre alignement*). Elle classe pour TON plan, en vraies stats, et dit ce que le joueur ferait dans un autre plan. La couronne d'or ne tranche plus seule pour toi, parce qu'elle dépend :
  - du plan que tu gardes ;
  - de ce que tu laisses partir ;
  - des adversaires qui s'en viennent.
- **Les packs** donnent des joueurs dont le profil tranche : un pack d'une famille (« Défense », « Robustesse »), un vestiaire d'un vrai club-saison, comme la roulette.

### 6.3 Le gros match : un duel en trois périodes

C'est l'élite de Slay the Spire. L'adversaire montre son **intention** avant chaque période, et elle vise TES joueurs, par leur nom.

**Les intentions.** Peu, chacune branchée sur un levier qui existe dans le moteur :

| L'intention | Ce qu'elle fait | Comment y répondre |
|---|---|---|
| **L'ombre** : « Leur meilleur défensif suit Lemieux » | Le Tir de Lemieux baisse selon la Défense de son ombre (l'appariement des trios, qui existe, mais beaucoup plus fort) | Changer Lemieux de trio. À domicile, tu as le dernier changement. Ou une carte (le leurre) |
| **La chasse** : « Leur dur va frapper Bourque » | Ses jambes, son risque de blessure | Un joueur de Robustesse dans son unité (la dissuasion existe) ; une carte |
| **La trappe** : « Ils ferment le centre » | Ton Tir rend moins, ton Jeu rend plus | Passer un trio en Cycle ; aligner tes passeurs |
| **L'assaut** : « Ils lancent de partout » | Plus de tirs des deux côtés ; ta Défense et ton gardien comptent plus | Une paire Maison ; ton gardien |
| **Les punitions** : « Ils cherchent à te faire punir » | Ta discipline, leur avantage numérique | Une consigne Basse ; une carte |

**La boucle d'un gros match.**
1. **Avant le match** : leur intention de 1re période, lue sur ton alignement (ta vedette, ta paire faible, le plan que tu joues). Tu changes tes lignes et tu joues tes cartes.
2. **Chaque période se joue**, puis la période suivante annonce une intention neuve, qui **répond** à ce qui s'est passé : ton 2e trio a marqué deux fois, l'ombre passe sur lui ; tu mènes, ils jouent l'assaut ; tu as joué deux cartes offensives, ils ferment le centre.
3. **Ta main dure les trois périodes** : cinq cartes, de l'élan chaque période, et tu choisis quoi garder pour plus tard. C'est ça, « gérer sa main ».

**Les bornes.**
- L'adversaire ne pige pas de cartes (règle `horsAdverse` gardée) : il choisit des intentions.
- Les icônes des intentions se choisiront à la tranche 5, sans en reprendre une déjà prise (`check_clarte`).
- **Cible** : deux équipes égales, un duel bien joué contre un duel mal joué, entre **62 % et 65 %** de victoires d'un côté et **35 % à 38 %** de l'autre, jamais au-delà de 70 %. Aujourd'hui, tout le gros match vaut environ ±3 points.
- Le moteur joue déjà le gros match en deux blocs (0-40, puis 40-60). Trois blocs, un par période, c'est le même mécanisme avec un bloc de plus.

*Tranché à la tranche 5 (§ 17)* : les icônes 🥷 l'ombre, 🦈 la chasse, ⛔ fermer le centre, 🐗 l'assaut, 🦂 les punitions. Le geste vaut le temps de sa période, comme l'intention ; contrée, l'intention se retourne contre eux jusqu'à la fin du match. Deux d'élan par période. Le nombre de duels : ceux d'aujourd'hui (tes rivaux et ta bête noire, une dizaine), plus chaque match de séries. Le snap se dit « doubler la mise », en saison seulement.

### 6.4 Ta main : un seul paquet

- **Le cahier** : tes cartes de match. Elles se jouent en combat, c'est-à-dire aux gros matchs et aux séries. C'est le deck d'aujourd'hui, borné.
- **Les places**, comme les reliques et les potions de Slay the Spire :
  - le personnel (le coach, les patrons), permanent ;
  - trois places de consommables, qu'on joue quand on veut.
- **L'équipement** se pose sur un joueur (Effectif) et y reste.
- **Ce qui part** : la poche, la main de la semaine et sa limite de deux cartes par semaine. Une carte de pack va droit à sa pile ; sinon elle se vend. Les cartes Événement, des gestes du DG, deviennent des choix de la semaine (§ 6.5).
- *Fait en tranche 5b (§ 18).*

### 6.5 Tous les choix, une seule forme : « À faire »

- **Un choix**, partout, a la même forme :
  1. qui le demande (la voix) ;
  2. le fait, lu dans les feuilles déjà jouées ;
  3. deux ou trois options ;
  4. pour chaque option, ce qu'elle fait en vraies stats et ce qu'elle coûte ;
  5. son échéance (« avant jeudi »).
- **Un seul endroit** : Bureau › À faire, pour la signature offerte, le blessé, le fil du soir, le courriel, le point de presse, la route du lundi, la récompense, l'objectif du proprio et les rivaux. Les autres contenants disparaissent.
- **Un seul geste** : toucher une option montre ce qu'elle change ; « Trancher » la confirme. Le combat et l'entracte gardent leur écran, mais dessinent leurs options de la même façon.
- **Plus de « Compris »**. Ce qui ne demande rien n'est pas un choix : c'est une ligne de la une.

### 6.6 Les blessures

Elles deviennent des choix avec un prix et une mémoire :
- **Le jouer blessé ?** Il joue diminué, avec un risque d'aggravation. Ou il se repose.
- **Le ramener trop tôt ?** Le physio donne son avis.
- **La mémoire** : une commotion se garde sur la carte, et la suivante sera plus longue (`BLESSURES`, `genreDeBlessure` existent déjà).
- **Les cibles** : l'intention « La chasse » vise tes vedettes, et tu les protèges par ton alignement.

### 6.7 Raconter : les fils deviennent des choix

Les fils (`filsDeSaison`) savent déjà lire une histoire dans les feuilles. Chaque fil fort ouvre un choix, et ce choix **revient** deux à quatre semaines plus tard, avec ses vrais chiffres :

| Le fil | Le choix | Le retour |
|---|---|---|
| Le Cheechoo (un joueur du bas en feu) | Le monter au 1er trio ? | Il y reste en feu, ou il retombe ; le joueur qu'il a déplacé demande à jouer |
| La disette d'un marqueur | Le laisser jouer, le reposer, lui parler | La lancée revient, ou le doute s'installe |
| Le duo (un marqueur nourri par un passeur) | Les garder ensemble ? | Un lien nommé entre eux deux, pour la saison. Un choix, pas l'entente qui s'apprenait, retirée le 11 oct. |
| La recrue | La protéger, ou la lancer en séries ? | Son galon (§ 6.8) ou son trou de mémoire |
| Le vétéran | En faire le mentor de la recrue ? | Le badge de la recrue progresse, sur les vraies feuilles |

Les voix (`EXPEDITEURS`) gardent leur rôle : elles disent le fait et y ajoutent une opinion, jamais un chiffre (`check_fils`).

### 6.8 Graver : ce qui reste d'un joueur

- **Son histoire chez toi** : matchs, buts, points, gros matchs gagnés, saison après saison de la run, gardés sur sa carte. Ils ne repartent plus à zéro.
- **Les galons** : ce qu'il a fait chez toi lui donne un trait ou un palier de badge pour le reste de la run. Exemple : 40 buts → 💣 Lancer redouté. Le galon est gravé avec sa date, l'adversaire et le chiffre (« 40e but, 12 mars contre Boston »).
  - Il passe par les canaux existants : un palier de badge (`badgesDe`) ou un trait de `js/traits.js`. Aucune cote neuve.
  - C'est le joker de Balatro : ce que ta run a fait devient ce que ta run est.
- **La carte monte par ses exploits**, pas seulement par trois doublons.
- **Le panthéon du club**, d'une run à l'autre :
  - les records ;
  - les trophées gagnés (aujourd'hui, ils ne sont pas sauvegardés) ;
  - les chandails retirés ;
  - la vitrine de la Coupe, choisie d'après ce que les joueurs ont fait pour toi.
- **Le laisser partir coûte** : entre deux saisons, « Ceux qui restent » montre son histoire avant que tu tranches.

### 6.9 Avancer

« Avancer » s'arrête au prochain choix dû ou au prochain combat. Un choix qui atteint son échéance sans être tranché prend son option par défaut, dite d'avance sur sa face.

## 7. Une semaine type, après

1. **Lundi, Bureau › À faire**, trois choix :
   - « Lindros blessé 5 matchs · le jouer blessé ou le remplacer » ;
   - « Le Cheechoo : Bob Kudelski, 9 buts en 8 matchs au 4e trio · le monter ? » ;
   - le pack Défense offert.
2. Je monte Kudelski. La liste du pack me montre un défenseur de niveau Régulier, fort en Défense : dans ma Trappe, il vaut mon Pilier offensif, pour la moitié du salaire. Je le signe ; mon Pilier part.
3. **Jeudi, gros match contre Boston** (mon rival). Leur intention pour la 1re période, l'ombre : « Leur meilleur défensif suit Kudelski ». Je suis à domicile : je mets Kudelski sur le 3e trio, que leur ombre ne suit pas. Je garde ma carte Leurre pour plus tard.
4. Après la 1re période, 1-0 pour nous. Leur nouvelle intention : l'assaut. Je joue « Bloquer des tirs » et je passe ma 2e paire en Maison.
5. Victoire 3-2. Kudelski a marqué ; la une le dit, l'analyste aussi. Trois semaines plus tard, le joueur qu'il a déplacé demande un échange : un nouveau choix dans À faire.

Moins d'écrans et moins de piles qu'aujourd'hui, plus de décisions qui pèsent. Et chacune raconte quelque chose de tes joueurs.

## 8. Ce qui part, ce qui se simplifie

| Aujourd'hui | V9 |
|---|---|
| Environ 25 sortes de choix dans 12 contenants | 5 familles (signer, trancher, préparer, jouer le duel, avancer) dans 2 contenants (À faire, le duel) |
| 4 piles de cartes (poche, main de la semaine, deck, en jeu) | 1 paquet (le cahier), et des places |
| 7 systèmes de trio, 5 de paire | 4 et 3, un par famille |
| Le fit par étiquettes de rôle | Ce que les joueurs apportent dans la famille que le plan paie |
| Le premier rôle et un second à moitié | Le profil : les quatre familles |
| Le gros match : deviner, une main, l'entracte | Trois périodes, trois intentions, une main qui dure |
| « Compris », les infos qui bloquent | Une ligne de la une |
| La main de la semaine et sa limite de deux cartes | Partie : le cahier se joue en combat, et les gestes du DG sont des choix |
| Les cinq sections de la V8 | Gardées (Bureau, Ce soir, Effectif, Marché, Ligue) ; seul ce qu'elles contiennent change |

## 9. Les règles fermes touchées

**À lever pour le Rogue.** JP, 16 oct. : une règle ferme (une icône = un sens, aucune OV, etc.) peut tomber quand la briser a du sens, pourvu qu'il le sache. Les voici, dites d'avance :
- **« Aucune cote neuve, aucune mécanique neuve. »** Deux mécaniques neuves : le plan qui pondère les familles, et l'adversaire qui choisit des intentions. Le profil, lui, n'est pas une cote neuve : ce sont les scores de rôle qui existent.
- **« La production se répartit comme la vraie saison l'a répartie »** (`check_parts`). En Rogue seulement, la production d'un joueur dépendra de son plan, dans une borne à fixer (±25 % ?).

**Gardées telles quelles :**
- Aucune cote dans le DOM, par choix : le profil se dit en badges et en vraies stats, et ça suffit.
- Une carte de jeu change la forme du match, pas sa force (`check_cartes`). La force passe par les cartes de joueur et par le plan, ce que JP demande.
- `horsAdverse` : l'adversaire ne pige pas de cartes.
- Le robot « premier Signer » ne gagne pas la Coupe.
- La graine rejoue la même saison (`check_graine`).
- Tout le 82-0.

## 10. Les juges

Chaque tranche a son script, et chacun passe par `scripts/verdict.mjs` :
- **`check_fit`** (nouveau, tiré de la mesure du § 2) : à niveau égal, l'ordre des candidats entre deux plans, Spearman ≤ 0,6 ; au moins 3 plans sur 4 avec un meilleur différent ; signer pour son plan rapporte au moins +0,4 V par case, et une équipe bâtie pour son plan vaut +5 à +8 V de plus qu'une équipe mélangée au même salaire. `check_ratings` reste autour de 0,8 : les vraies équipes jouent le plan que leur composition dicte.
- **`check_duel`** (nouveau) : deux équipes égales, le duel bien joué contre le duel mal joué, entre 62 et 65 % ; jamais plus de 70 %.
- **`rogue_sim` à deux robots** : l'attentif lit son plan et répond aux intentions ; le distrait choisit au hasard. Leur écart en victoires par saison est la profondeur du jeu.
  - L'attentif gagne sa première Coupe entre la run 3 et la run 8.
  - Le distrait ne la gagne jamais en 12 runs.
  - **Les deux bouts** (JP, 16 oct.) : un alignement moyen bien mené peut finir premier de la ligue ; un bon alignement mal mené peut rater les séries. Le juge mesure les deux, sur les mêmes joueurs, et exige qu'ils arrivent.
  - C'est le « script qui juge la boucle » que la V8 avait laissé de côté.
- **`essai_rogue`** : chaque choix vit dans À faire et a la même forme ; aucun « Compris » ne bloque.

## 11. Les tranches, une PR chacune

1. **À faire, une seule forme.** L'interface seulement, aucun moteur : tous les choix d'aujourd'hui passent par un seul composant et un seul endroit. Le gain visible est immédiat et le risque faible. Juge : `essai_rogue`.
2. **Le juge d'abord.** `check_fit` et les deux robots, mesurés sur le jeu d'aujourd'hui, pour avoir le point de départ (attendu : Spearman 0,97, écart attentif-distrait petit hors de la signature).
3. **Le plan et le profil** (moteur, Rogue seulement) : les familles payées par le coach et le système ; les systèmes ramenés à 4 et 4 (§ 15) ; l'écran du profil. Juges : `check_fit`, `check_ratings`, `check_graine`, `check_voies`.
4. **Le plafond qui mord**, la liste qui classe pour ton plan, et **un départ bien pire** (JP, 16 oct. : *you should start with a way worse team*). On part d'une équipe beaucoup plus faible, et c'est le plan et le marché qui la font monter. Le mandat de la saison 1 se règle avec elle. Juge : `check_rogue` (la première run reste dure, mais une équipe faible bien menée monte).
5. **Le duel en trois périodes**, les intentions, la main qui dure. Juges : `check_duel`, `check_gros`, `check_robot`. *Fait (§ 17). La poche, la main de la semaine et les places (§ 6.4) n'étaient dans aucune tranche : faites en tranche 5b (§ 18).*
6. **Raconter et blesser** : les fils et les blessures deviennent des choix qui reviennent. Juges : `check_fils`, `check_vie`, `check_arcs`. *Fait (§ 19) ; son juge : `check_retours`.*
7. **Graver** : l'histoire chez toi, les galons, le panthéon. Juges : `check_sauvegardes`, `essai_rogue`.
8. **Recalibrer la run** sur les deux robots.

## 12. Ce que JP tranche

**Tranché le 16 oct.** JP : *oui à tout, commence par la tranche 1 ; l'idée est que ça ne devrait pas être facile, mais possible, de rouler sur la ligue avec les bons joueurs, stratégies et cie, ou de se planter royalement avec un bon roster, comme la vraie vie.* Le nombre de duels par saison (question 4) se tranchera à la tranche 5 ; *tranché là (§ 17) : ceux d'aujourd'hui, une dizaine, plus les séries*. Puis : *start with a way worse team* — avec la tranche 4 : un départ bien pire n'a de sens que quand le plan et le marché donnent de quoi remonter (aujourd'hui, la signature est le seul levier, et une équipe bien pire perdrait sa première saison, point).

1. **Le plan décide quelles stats comptent** (moteur, Rogue seulement), à environ 1 V par écart type dans le top six. Oui ? C'est le changement majeur : il lève la règle « aucune mécanique neuve » pour le Rogue.
2. **Le profil en quatre familles** (Tir, Jeu, Défense, Robustesse), dit en badges et en vraies stats. Oui ? Ou d'autres familles ?
3. **Les systèmes, de 7 et 5 à 4 et 3.** Oui ?
4. **Le gros match, un duel en trois périodes avec des intentions qui répondent.** Oui ? Et combien de duels par saison : les rivaux et la bête noire (environ 10, plus les séries), ou un par semaine ?
5. **La poche et la main de la semaine partent**, au profit d'un seul paquet joué en combat. Oui ?
6. **Le plafond qui mord en Rogue.** Oui ?
7. **Les galons et l'histoire chez toi** : ce qu'un joueur fait chez toi le rend plus fort pour la run. Oui ?
8. **L'ordre** : la tranche 1 (À faire, sans moteur) pendant que je mesure le point de départ (tranche 2) ? Ou le moteur du plan d'abord ?
9. **Un mode action, à la NHL 94** (JP, 16 oct. : *si on pouvait avoir un genre de mode action avec les cartes*) : jouer le gros match, ou une période, en direct, tes cartes comme pouvoirs ? C'est un mode neuf, et gros : il faut un patin, une passe et un tir joués à la manette, sur le moteur de Sur table ou un autre. À trancher : pour le duel du gros match, ou un mode à part, et après quelle tranche.

## 13. Fait le 16 octobre : la tranche 1

- [x] **À faire, une seule forme** (docs/decisions.md). Tous les choix du Rogue vivent au Bureau, dans À faire. Chacun a la même forme : la voix (ou le visage), le sujet, le fait, le joueur visé, ses options `optionHtml` en vraies stats.
  - Toucher coche ; le choix complet se plie et le suivant s'ouvre ; « Trancher » envoie le lot, la saison ne se rejoue qu'une fois.
  - Une option › ouvre son écran : le combat, le paquet, la main du palier, un pack à signer, la liste d'un blessé. Un pari se joue au dé.
  - L'écran de la semaine est parti : la semaine passée se plie en tête du Bureau, l'état du club vit dans le choix de la route.
  - Plus de « Compris » : la carte qui change, le vestiaire, les mouvements et le pack gratuit sont les nouvelles d'Hier soir.
  - La case vide est une décision du lot, comme le reste.
  - Preuves : `essai_rogue` (76 choix réglés, de tous les genres ; chaque lot envoie autant de décisions que de choix ; zéro erreur), `essai_packs`, `essai_achat`, `tout.mjs`, `check_mort`, `check_css`, `check_clarte`.

## 14. Fait le 16 octobre : la tranche 2, le point de départ

Les juges d'abord, mesurés sur le jeu d'aujourd'hui. Rien du jeu ne change ; ce sont les chiffres que les tranches 3 à 8 devront bouger.

- [x] **`check_fit`** (une demi-minute). Sept cases (2e et 4e trio AG, 3e trio C, 2e et 3e paire DG), quatre vraies équipes, trois époques ; des candidats du même côté et du même niveau.
  - L'ordre des candidats d'un système à l'autre : Spearman **0,98** (cible : 0,6 ou moins).
  - Systèmes qui ont un meilleur différent : **1,6** par case en moyenne (cible : 3 ou plus).
  - Signer pour son système plutôt que le meilleur en général : **+0,01 V** par case (cible : +0,4 V).
  - Rouge, comme prévu : c'est le juge de la tranche 3.
- [x] **Les trois robots** (`politique`, scripts/lib/rogue_sim.mjs).
  - **Le robot d'avant** ('defaut') : inchangé, `check_rogue` et `check_robot` le gardent.
  - **L'attentif** : il signe comme lui, mais aligne au mieux (`alignementAuMieux`) au départ et après chaque signature. Il joue chaque gros match de saison : la main de l'adjoint, préparée pour la piste la plus probable.
  - **Le distrait** clique sans lire :
    - à la signature, une carte au hasard, et un joueur du même groupe au hasard lui laisse sa case ;
    - un système au hasard par ligne ;
    - une main jouable et une piste au hasard ;
    - les rivaux, les gardés et les lotos au hasard.
  - Ses clics ont leur propre générateur : les adversaires et les dés restent appariés.
- [x] **`check_profondeur`** (seize minutes à trois fils).
  - **Une saison, de vraies équipes.** Le meilleur club et le club du milieu de 1985-86, 1995-96, 2005-06 et 2015-16, chacun lancé dans une saison du Rogue : 31 vrais clubs, les packs, le plafond. Quatre graines appariées par politique, 32 saisons par robot.

    | | victoires par saison |
    |---|---|
    | l'attentif contre le robot d'avant | **+1,8 V** (± 0,9) |
    | le robot d'avant contre le distrait | **+9,8 V** (± 1,3) |
    | l'attentif contre le distrait | **+11,6 V** (± 1,0) |

  - **D'où vient l'écart du distrait** : 16 saisons appariées, un seul de ses gestes au hasard à la fois.
    - Signer au hasard : **−5,8 V** (± 2,2).
    - Les systèmes au hasard : −0,9 V (± 1,4), le bruit.
    - La main au hasard plutôt que celle de l'adjoint : +1,9 V (± 2,1), le bruit.
  - **Les deux bouts** arrivent, mais à peine.
    - Un club du milieu bien mené finit premier 1 fois sur 16 (VAN 1995-96).
    - Un meilleur club mal mené rate les séries 1 fois sur 16 (WSH 2015-16).
  - **Les campagnes** : de zéro, deux campagnes de douze runs par robot.
    - Le robot d'avant gagne sa première Coupe à la run 3 dans les deux campagnes, puis 19 Coupes en 24 runs.
    - L'attentif : runs 3 et 2, puis 21 Coupes en 24 runs. Médiane 2,5, sous la cible de 3 à 8 : rouge, comme `check_rogue`, dont c'est le même constat.
    - Le distrait : aucune Coupe en 24 runs (cible tenue).

**Ce que ça dit.**
1. **Aujourd'hui, mener, c'est ne pas défaire l'automatique.** L'alignement automatique, le système choisi seul et l'adjoint jouent presque juste. Un joueur qui ne fait que « Signer le meilleur » finit à 1,8 V de l'attentif, moins d'un demi écart type de saison (4,5 V). C'est le « brain dead » en un chiffre.
2. **Seule la signature est une décision.** Le distrait perd surtout en signant au hasard. Des systèmes ou une main au hasard ne coûtent rien de mesurable : à l'écran, ce sont des choix ; dans le moteur, non. C'est ce que la tranche 3 (le plan) et la tranche 5 (le duel) doivent changer.
3. **La run s'aplatit.** Après deux ou trois runs de déblocages, le robot d'avant gagne la Coupe presque à chaque run. La première run reste dure, mais une run gagnée d'office n'a plus d'enjeu. C'est la tranche 4 (le plafond qui mord, un départ bien pire) et la tranche 8 (recalibrer).

**Proposé pour la suite** (à trancher avec JP à la tranche 3) : que `check_profondeur` exige aussi que l'attentif batte le robot d'avant. C'est ce qui prouvera que le joueur qui lit son plan fait mieux que celui qui laisse l'automatique jouer. Aujourd'hui, l'écart est de +1,8 V ; une cible de +4 à +6 V le mettrait au-dessus d'un écart type de saison.

## 15. Fait le 16 octobre : la tranche 3, le plan

Le plan décide quelles stats comptent, en Rogue seulement (docs/decisions.md). Le 82-0, Sur table et l'exhibition ne bougent pas.

- [x] **Le profil en quatre familles** : Tir, Jeu, Défense, Robustesse, lus sur les rôles de toujours à points égaux (`famillesDe`). Chaque famille est centrée sur le joueur typique de ses points et reste dispersée chez les Piliers (`check_familles`, dans `tout.mjs`).
- [x] **Le système paie sa famille** : chaque écart type d'un joueur multiplie le canal naturel de son unité (`PLAN_PAIE`), centré sur l'unité typique qui joue sa meilleure famille (`PLAN_REF`). La ligue garde ses buts par match (5,79 → 5,77).
- [x] **Un système par famille** : quatre de trio, quatre de paire (JP : oui aux quatre de paire). L'IA et la ligne qu'on ne règle pas jouent la famille où leurs joueurs apportent le plus.
- [x] **Les coachs paient une ou deux familles et en coûtent une**, plus fort à mesure que la confiance monte (`COACH_DU_PLAN`) ; le palier de plus de leur vieux système est parti (`check_coachs`).
- [x] **L'écran** : la fenêtre du système parle en familles ; la fiche dit les quatre familles du joueur ; le coach dit son plan et combien de tes patineurs le servent ; « Aligner au mieux » lit le plan ; la page des règles dit la règle.
- [x] **Les juges** :

  | | avant | après | cible |
  |---|---|---|---|
  | `check_fit` · l'ordre entre deux systèmes (Spearman) | 0,98 | **0,49** | ≤ 0,6 ✓ |
  | `check_fit` · signer pour son système | +0,01 V | **+0,52 V** | ≥ +0,4 V ✓ |
  | `check_fit` · systèmes au meilleur différent | 1,6 | **2,7** | ≥ 3 ✗ |
  | l'attentif contre le robot d'avant | +1,8 V | **+5,3 V** | ≥ +5 V ✓ |
  | un club du milieu bien mené finit premier | 1 sur 16 | **7 sur 16** | ✓ |
  | un meilleur club mal mené rate les séries | 1 sur 16 | **4 sur 16** | ✓ |
  | le distrait gagne la Coupe | 0 sur 24 | **0 sur 24** | ✓ |
  | la 1re Coupe de l'attentif (médiane) | run 2,5 | **run 2** | 3 à 8 ✗ |

  - Le ✗ de `check_fit` vient du bas de l'alignement : un candidat complet y reste le meilleur dans les quatre systèmes, et un 4e trio paie peu (ses tirs valent peu).
  - Le ✗ des campagnes est le constat de la tranche 2 en plus fort : bien mené, le Rogue se gagne trop tôt, puis presque à chaque run (l'attentif, 22 Coupes sur 24). C'est la tranche 4 (le plafond qui mord, un départ bien pire) et la tranche 8 (recalibrer).
  - `check_rogue` : la Coupe par run monte plus vite au milieu de la courbe (6 déblocages : 20 % → 50 %), le robot d'avant profitant du plan que l'IA lui choisit ; sans déblocage, elle reste rare (10 %). `check_robot` (Rogue) : 7,5 %, sous sa borne.
  - Preuves : `tout.mjs` (22 scripts), `check_mort`, `check_clarte`, `check_coachs`, `essai_rogue` (57 choix réglés, zéro erreur), `check_robot`, `check_voies`.

## 16. Fait le 16 octobre : la tranche 4, le plafond qui mord

JP : *start with a way worse team* (docs/decisions.md). Le Rogue seulement.

- [x] **Les pires contrats** : les bouche-trous du départ restent de la même tranche de production, mais se tirent dans le tiers le mieux payé (`PART_DES_PIRES`). Leur masse : 43 à 74 M$, 57 en médiane.
- [x] **Le plafond d'une saison est ta masse de départ, plus 4 M$** (`ESPACE_DE_DEPART`), et ce que les déblocages ajoutent.
- [x] **L'offre n'est plus filtrée sous le plafond** : une carte que même ton plus gros contrat ne ferait pas entrer se montre grisée, avec ce qu'il manque. Le robot ne signe que ce qu'une sortie fait entrer.
- [x] **Les packs Spécialistes tirent par famille**, à points égaux ; la liste de signature dit les familles fortes du joueur.
- [x] **Les juges** :

  | | tranche 3 | tranche 4 | cible |
  |---|---|---|---|
  | l'attentif contre le robot d'avant | +5,3 V | **+7,4 V** | ≥ +5 V ✓ |
  | l'attentif contre le distrait | — | **+20,7 V** | |
  | un club du milieu bien mené finit premier | 7 sur 16 | **5 sur 16** | ✓ |
  | un meilleur club mal mené rate les séries | 4 sur 16 | **5 sur 16** | ✓ |
  | la 1re Coupe de l'attentif (médiane) | run 2 | **run 3,5** | 3 à 8 ✓ |
  | le distrait gagne la Coupe | 0 sur 24 | **0 sur 24** | ✓ |
  | `check_rogue` · Coupe par run, sans déblocage → tout débloqué | 10 % → 90 % | **10 % → 90 %** | ✓ |
  | `check_robot` (Rogue) · Coupe par run | 7,5 % | **5 %** | ≤ 10 % ✓ |

  - Le robot d'avant gagne sa première Coupe à la run 7 ou 8 ; l'attentif, à la 2e ou la 5e ; le distrait, jamais. Un départ pire n'a pas cassé le jeu : il a ouvert l'écart, et c'est le plan et le marché qui font remonter l'équipe.
  - Preuves : `tout.mjs` (22 scripts), `check_mort`, `check_clarte`, `check_packs`, `essai_rogue`, `essai_packs`, `check_rogue` (32 vérifications), `check_robot`, `check_profondeur`.

## 17. Fait le 16 octobre : la tranche 5, le duel

Le gros match du Rogue devient un duel en trois périodes (docs/decisions.md). Le 82-0 garde le gros match d'avant.

- [x] **Trois périodes, trois intentions** (`INTENTIONS`, `jouerDuel`) : 🥷 l'ombre, 🦈 la chasse, ⛔ fermer le centre, 🐗 l'assaut, 🦂 les punitions. Chacune vise tes joueurs par leur nom ; elle se lit sur ton alignement et ton plan, puis sur ce qui s'est passé.
- [x] **Y répondre** : un geste, le temps de la période, ou une carte qui porte le bon canal. Laissée là, l'intention frappe sa période ; contrée, son contrecoup joue jusqu'à la fin du match.
- [x] **La main qui dure** : cinq cartes, deux d'élan par période ; la main tirée part avec la première décision. En séries, l'adjoint joue la main qui reste, sans geste.
- [x] **Doubler la mise**, avant la 3e d'un duel de saison : le butin, ou les sonnés.
- [x] **L'écran** : le combat de chaque période (l'intention, son pourquoi, tes gestes, les cartes qui y répondent), le direct qui s'arrête aux deux entractes et dit chaque intention, le hub qui annonce la première.
- [x] **Les juges** :

  | | avant | après | cible |
  |---|---|---|---|
  | `check_duel` · deux clubs égaux, bien et mal joué, en face à face | ±3 points | **63,9 %** | 62 à 65 % ✓ |
  | `check_duel` · contre la même IA : bien joué · mal joué (l'adjoint) | — | **58,4 % · 44,3 %** | ≤ 70 % ✓ |
  | `check_duel` · les intentions contrées : l'attentif · sans réponse | — | **91 % · 2 %** | |
  | `check_gros` · les duels d'une saison de Rogue | — | **9,3** | |
  | l'attentif contre le robot d'avant | +7,4 V | **+8,6 V** | ≥ +5 V ✓ |
  | la 1re Coupe de l'attentif (médiane) | run 3,5 | **run 3** | 3 à 8 ✓ |
  | le robot d'avant, sa 1re Coupe | run 7 ou 8 | **run 8, ou aucune en 12** | |
  | le distrait gagne la Coupe | 0 sur 24 | **0 sur 24** | ✓ |
  | `check_rogue` · Coupe par run, de rien à tout débloqué | 10 % → 90 % | **0 % → 70 %** | ✓ |
  | `check_robot` (Rogue) | 5 % | **2,5 %** | ≤ 10 % ✓ |

  - Le duel départage les gérants : l'attentif y gagne, l'adjoint y perd. Le robot d'avant, qui laisse l'adjoint jouer ses séries, gagne moins de Coupes ; l'attentif, ses premières dès la run 3. C'est l'écart que la V9 cherchait : *rouler sur la ligue ou se planter royalement*.
  - `essai_rogue` : des duels joués jusqu'à leur 3e période, chaque période avec son geste (la consigne Basse, la vedette déplacée, un trio en Cycle), zéro erreur.
  - Preuves : `tout.mjs` (22), `check_mort`, `check_clarte`, `check_css`, `check_coquille`, `check_emojis`, `check_graine`, `check_feuilles`, `check_combat`, `check_choix`, `check_gros`, `check_duel`, `check_rogue` (32), `check_robot`, `check_profondeur` (5), `essai_rogue`.

## 18. Fait le 16 octobre : la tranche 5b, tes places

JP : *Continuer*, après la proposition de la tranche 5b. Ce que § 6.4 décrivait (docs/decisions.md).

- [x] **Trois places** (`PLACES`, `placesDeLaPartie`, js/inventaire.js) : ce qui se joue hors du combat (un consommable, une modif à poser, un contrat). Chacune se joue quand tu veux, autant que tu veux le même jour. Elles suivent d'une saison à l'autre de la run (le report `poche` garde sa clé, pour les sauvegardes). « Ce soir » les montre, une place vide en pointillé.
- [x] **Une carte de trop se vend** : plus de cartes que de places, À faire demande laquelle vendre (une ou plusieurs d'un coup), au prix de revente. Elle presse : « Jour suivant » l'attend, comme un pack à signer. Jouer une carte règle aussi le compte.
- [x] **Ce qui part** : la poche, la main de la semaine (`mainDeLaSemaine`), sa limite de deux cartes et la ligne « Jouer N cartes cette semaine » d'À faire. Le personnel (le coach, les patrons) garde ses postes ; une carte de match va droit au cahier, comme avant.
- [x] **Les paliers de la saison** (9e, 18e et 26e matchs) : une carte parmi trois pour une place (`cartesDuPalier`, `pp:<match>`), au lundi, dans À faire. Avant, un pack gratuit de cinq cartes, qui aurait débordé trois places d'un coup. Ni carte de match, ni événement, ni personnel, ni permanent : ce qui se joue d'une place.
- [x] **Les événements** sortent des packs : ce sont les gestes du DG, que la route ❓ de la semaine offre déjà (js/noeuds.js). Elle offre aussi les quatre rares, que seuls les packs donnaient. La banque les compte avec ce qui se gagne en jouant.
- [x] **Le cahier borné** (`CAHIER_MAX`, js/combat.js) : ton deck de match, 20 cartes au plus. Au-delà, une carte du départ cède sa place (la plus répétée), puis la plus ancienne gagnée ; une malédiction ne cède jamais. L'écran du deck dit « N sur 20 ».
- [x] **Les juges** : `check_deck` (40) dit les places sans limite par semaine, le report, les paliers purs et la carte prise, le cahier borné ; `check_packs` (76) compte la banque sur les packs de la boutique, et chaque événement se gagne aux routes ; `essai_rogue` montre les places dans « Ce soir ». Les robots de `scripts/lib/rogue_sim.mjs` ne jouent pas de carte de place : `check_rogue` et `check_profondeur` ne bougent pas.
  - Preuves : `tout.mjs` (22), `check_mort`, `check_clarte`, `check_css`, `check_deck` (40), `check_packs` (76), `check_noeuds`, `check_rogue` (32 ; 0 % → 70 %, inchangé), `essai_rogue`.

## 19. Fait le 17 octobre : la tranche 6, raconter et blesser

JP : *Continuer*. Ce que § 6.6 et § 6.7 décrivaient, sur les canaux qui existent (docs/decisions.md).

- [x] **Un fil fort, un choix qui revient** (`CHOIX_DES_FILS`, js/vie-gm.js). En Rogue, le fil des deux dernières semaines ouvre un choix dans À faire, dit par sa voix, une fois par sorte et par saison :

  | Le fil | Les options | Le retour (relu dans les feuilles) |
  |---|---|---|
  | 🔥 Le Cheechoo | le monter au 1er trio (il prend la case de même rôle) ; ne rien changer | 10 matchs : 4 buts, il garde le feu ; sinon, celui qu'il a délogé demande à jouer |
  | 🥶 La disette | le reposer deux matchs ; lui parler ; le laisser jouer | 8 matchs : 2 buts, la lancée revient ; lui parler et rien : le doute s'installe |
  | 🤝 Le duo | les garder ensemble ; ne rien promettre | 10 matchs : 3 buts du duo, leur lien est nommé pour la saison ; sinon, ils se lassent |
  | 🐣 La recrue | lui faire confiance ; le protéger (des jambes neuves) | 10 matchs : 6 points, il s'impose pour la saison ; sinon, un trou de mémoire |

  Le retour est un SUIVI que le moteur engage au choix (`engagerSuivi`) et relit le matin qui suit son dernier match (`retoursDuMatin`) : ses buts, ses points ou les buts du duo, dans ces feuilles-là et seulement elles. Le seuil décide ; l'effet se pose sur le joueur nommé (ses canaux à lui, comme un arc), le temps de ses matchs. Aucun dé. Le retour se lit à la une, dit par la voix du fil, avec ses vrais chiffres (`texteDuRetour`) : « Ladd : 4 buts en 10 matchs depuis qu'il est monté. Il garde le feu. »
- [x] **Les blessures, un prix et une mémoire** (js/sim.js) :
  - **Le jouer blessé** : une option du choix de la blessure (ni commotion, ni fracture, ni ligaments ; 8 matchs ou moins à faire, `JOUER_BLESSE_MAX`). Il sort de l'infirmerie le jour même et joue diminué, « Il joue amoché », le temps qu'il lui restait. S'il se blesse encore pendant ce temps, l'aggravation : il manque aussi ce temps-là (`jouerBlesse`, `applyInjuries`).
  - **L'avis du physio** : un blessé d'au moins six matchs, à mi-chemin, peut revenir plus tôt, par le même geste. Une fois par blessure ; il attend le lundi.
  - **La commotion se garde** : en Rogue, chaque commotion d'avant d'un joueur allonge la suivante de moitié (`COMMOTION_MEMOIRE`), cette saison et les saisons d'avant de la run (le report `commotions`).
- [x] **Le Pack Événements est retiré** (JP, 17 oct. : *retire*), et aucun pack d'avant ne donne plus d'événement : les gestes du DG se gagnent aux routes de la semaine. Une vieille partie garde les cartes qu'elle en a tirées.
- [x] **Ce qui n'est pas fait** : le vétéran mentor de la recrue (§ 6.7) attend les galons (tranche 7) ; le joueur délogé ne fait pas encore un second choix, il boude ; les robots de `rogue_sim` ne prennent ni ces choix ni le jouer blessé.
- [x] **Les juges** : `check_retours` (nouveau, deux minutes, trois ligues) : 15 vertes — neuf choix de fils (🥶 3, 🤝 3, 🔥 2, 🐣 1), chacun sans toucher aux journées d'avant, son retour le bon matin et recompté dans ses feuilles ; trois blessés joués blessés, une aggravation ; trois commotions avec mémoire, aucune hors du Rogue.
  - Preuves : `tout.mjs` (22), `check_mort`, `check_clarte`, `check_emojis`, `check_retours`, `check_arcs` (8, chaque arc sous 0,32 V), `check_packs` (76), `check_rogue` (32 ; 0 % → 70 %, la première Coupe des deux campagnes à la run 4).

## Annexe · la méthode des mesures

Scripts hors du dépôt, sur le moteur tel quel. La tranche 2 en fait `check_fit`, avec ses verdicts.

- **Le fit.**
  - Une vraie équipe alignée par `autoRoster`.
  - Une case : 2e trio AG, 4e trio AG, 3e trio C, 2e paire DG, 3e paire DG.
  - Les candidats : une quarantaine de joueurs du même côté et du même niveau (`niveauDe`), au moins 40 matchs, pris dans 11 saisons réparties de 1970 à 2025.
  - Chaque candidat est posé dans la case. L'unité joue chacun des sept systèmes (ou des cinq de paire), les autres lignes gardent `lignesAuMieux`.
  - La lecture : `chiffresDuSoir` (buts pour moins buts contre par match, contre un club moyen), convertie en V sur 82 matchs à 6 buts par victoire.
  - On compare l'ordre des candidats entre systèmes (Spearman) et le meilleur dans chaque système.
- **Les compagnons.** Le même 2e trio, avec son centre et son ailier droit remplacés par deux snipers, deux passeurs ou deux two-way du même niveau ; 25 candidats AG de cinq archétypes (sniper, passeur, two-way, power, habile ; aucun checker ni plombier n'atteint le niveau Pilier).
- **La force nécessaire.** On ajoute à la valeur lue k × (le z de la famille du candidat, tiré de ses vraies colonnes), pour k de 0 à 1,5 V par écart type, puis on mesure à nouveau l'ordre entre plans.
- **Le plafond.** `jouerRun` au niveau de déblocage 0, six runs : la masse salariale au départ, au plus haut et à la fin, et les signatures que le plafond seul a bloquées.
