# La V9 · un plan, des joueurs qui le servent, un adversaire qui répond

16 octobre 2026. JP :
- *Les actions du joueur : gérer les cartes et l'alignement, gérer sa main, faire les choix (tous au même endroit du UI, même UI et UX), avancer les jours.*
- *Les actions du jeu : contrer les cartes du joueur pendant les matchs (quitte à revoir les gros matchs), les blessures, des événements qui racontent, des mécaniques qui rendent les joueurs mémorables.*
- *Une base de données où les joueurs d'un même trio ne se valent pas, pour permettre des substitutions. Jamais « telle carte est meilleure » dans l'absolu : telle carte fitte mieux avec le but du DG et du coach.*
- *Que les cartes elles-mêmes comptent plus dans la façon dont l'équipe joue. Voir si les cotes actuelles marchent, ou s'il faut des OV ou autre chose pour optimiser ses trios.*
- *Simplifier visuellement et la façon de jouer, mais gagner en profondeur et en storytelling, deux choses absentes aujourd'hui. Le Rogue est brain dead ; le 82-0, avec ses rolls, demande plus de stratégie.*
- *Je ne suis pas attaché au jeu tel qu'il est, mais demande-moi avant un changement majeur.*

**Proposé, puis tranché le 16 oct. (§ 12) : oui à tout.** La tranche 1 est faite (§ 13) ; les autres attendent leur tour, une PR chacune.

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

  Les neuf se tranchent à la tranche 3. La confiance (I, II, III) monte toujours avec les cartes jouées.
- **Moins de systèmes, chacun lisible.** Sept systèmes de trio et cinq de paire deviennent quatre et trois, un par famille, plus « sans système » :
  - trios : Volume (Tir), Cycle (Jeu), Trappe (Défense), Échec avant (Robustesse) ;
  - paires : Activer (Tir et Jeu), Maison (Défense), Nettoyer (Robustesse).

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

### 6.4 Ta main : un seul paquet

- **Le cahier** : tes cartes de match. Elles se jouent en combat, c'est-à-dire aux gros matchs et aux séries. C'est le deck d'aujourd'hui, borné.
- **Les places**, comme les reliques et les potions de Slay the Spire :
  - le personnel (le coach, les patrons), permanent ;
  - trois places de consommables, qu'on joue quand on veut.
- **L'équipement** se pose sur un joueur (Effectif) et y reste.
- **Ce qui part** : la poche, la main de la semaine et sa limite de deux cartes par semaine. Une carte de pack va droit à sa pile ; sinon elle se vend. Les cartes Événement, des gestes du DG, deviennent des choix de la semaine (§ 6.5).

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
3. **Le plan et le profil** (moteur, Rogue seulement) : les familles payées par le coach et le système ; les systèmes ramenés à 4 et 3 ; l'écran du profil. Juges : `check_fit`, `check_ratings`, `check_graine`, `check_voies`.
4. **Le plafond qui mord**, la liste qui classe pour ton plan, et **un départ bien pire** (JP, 16 oct. : *you should start with a way worse team*). On part d'une équipe beaucoup plus faible, et c'est le plan et le marché qui la font monter. Le mandat de la saison 1 se règle avec elle. Juge : `check_rogue` (la première run reste dure, mais une équipe faible bien menée monte).
5. **Le duel en trois périodes**, les intentions, la main qui dure. Juges : `check_duel`, `check_gros`, `check_robot`.
6. **Raconter et blesser** : les fils et les blessures deviennent des choix qui reviennent. Juges : `check_fils`, `check_vie`, `check_arcs`.
7. **Graver** : l'histoire chez toi, les galons, le panthéon. Juges : `check_sauvegardes`, `essai_rogue`.
8. **Recalibrer la run** sur les deux robots.

## 12. Ce que JP tranche

**Tranché le 16 oct.** JP : *oui à tout, commence par la tranche 1 ; l'idée est que ça ne devrait pas être facile, mais possible, de rouler sur la ligue avec les bons joueurs, stratégies et cie, ou de se planter royalement avec un bon roster, comme la vraie vie.* Le nombre de duels par saison (question 4) se tranchera à la tranche 5. Puis : *start with a way worse team* — avec la tranche 4 : un départ bien pire n'a de sens que quand le plan et le marché donnent de quoi remonter (aujourd'hui, la signature est le seul levier, et une équipe bien pire perdrait sa première saison, point).

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
