# La V8 · un jeu qui se comprend en le regardant

14 octobre 2026. JP :
- *On a fait plusieurs idéations et améliorations à l'interface, mais tu me proposes toujours des trucs qui ne sont pas holistiques et ne refont pas le jeu de façon à le rendre réellement plus jouable.*
- *L'interface devrait être beaucoup plus naturelle et affordante.*
- *Affordance dans le sens de : chaque chose sous-entend ce à quoi elle sert. Genre, c'est pas clair comment jouer les cartes présentement.*
- *C'est correct, des menus, si les menus sont clairs et s'expliquent d'eux-mêmes.*
- *Je veux pas moins d'actions, au contraire, mais moins de confusion.*

Ce plan s'appuie sur une run jouée le même jour dans Chromium à 390 px, sur un profil neuf. Il y a deux parties : une jouée avec attention jusqu'à la journée 84, une jouée par script jusqu'au bilan de la run. Il y a 93 captures. Il s'appuie aussi sur la relecture des V3 à V7.

## 1. Pourquoi sept refontes n'ont pas suffi

JP a raison, et le motif se lit dans le journal : **chaque refonte a ajouté, aucune n'a retiré un système.**

| Refonte | Ce qu'elle promettait de couper | Ce qui est arrivé |
|---|---|---|
| V3 (7 oct.) | « Trop de tout » : 528 cartes, 60 décisions forcées par saison | La poche bornée, les fils et la une **ajoutés** |
| V4 (8 oct.) | Trois sortes de cartes au lieu de sept, environ 120 cartes | Pas fait. La semaine **ajoutée** par-dessus la journée |
| V5 (9 oct.) | Environ 95 concepts, 4 monnaies, 7 familles : couper | Pas fait. Les nœuds **ajoutés** |
| V6 (10 oct.) | La composition au centre | Les liens, l'appariement, le roulement, la note par unité **ajoutés** |
| V7 (11 oct.) | Ranger chaque lego à une seule maison | Les legos **déménagés**, pas un seul retiré. Ensuite : les unités spéciales, les arcs, sept packs mixtes, le club-école |

Aujourd'hui, la banque a encore **535 cartes en 7 familles** (408 se tirent). Le dépôt compte 71 modules et 51 000 lignes de JS. Un joueur neuf rencontre **environ 40 concepts dans son premier quart d'heure**, dont 4 monnaies (jetons, médailles, plafond, élan).

Le défaut de méthode est de mon côté. Chaque message de JP est devenu un correctif local, jugé par son propre script. Les règles fermes protègent chaque système : un check par mécanique rend chaque mécanique intouchable. Si personne n'a le droit de retirer, aucune refonte de l'écran ne rend le jeu jouable, parce que le problème n'est pas l'écran. **Le problème, c'est la quantité de choses que l'écran doit montrer.**

## 2. Ce que la run montre

**La boucle vécue.**
- Environ 14 touchers par semaine de jeu, dont 1 ou 2 vraies décisions. Le reste se répartit ainsi :
  - « Jour suivant », sept fois, pour des journées où il ne se passe presque rien (186 journées pour 82 matchs) ;
  - des « Compris » ;
  - des remplacements de blessés.
- **Les blessures mangent la boucle** : dans la partie jouée par script, 108 des 202 touchers. Souvent avec une seule option (« Qui monte ? » : Gino Odjick, seul).
- « Qui sort ? » à un rappel libère pour de bon un joueur absent cinq matchs.

**Les cartes : rien ne dit à quoi elles servent.**
- Il y a quatre piles :
  - la poche (« Cette saison ») ;
  - la main de la semaine (« 2 par semaine, d'ici ou de ta poche ») ;
  - le deck de match (avec l'élan, seulement au gros match) ;
  - « En jeu », replié au Bureau.
- On voit les mêmes cartes au Bureau, au lundi et dans Cartes. Une carte n'a pas de forme qui dise sa pile.
- Pour jouer une carte : un bouton dans une rangée, une fenêtre « Jouer · Vendre · La garder », puis souvent une deuxième fenêtre pour la cible.
- La cible est mal proposée. « Style : Faiseur de jeu » dit « sur Clark Gillies », puis demande « sur qui ? » avec Gainey en tête. Une rare a été posée sur le mauvais joueur par accident.
- Une carte « Espace sous le plafond · Contrat · 1 utilisation · Le comptable · Plafond » donne +2 M$ à une équipe qui utilise 40 M$ sur 82. **Le plafond, qui donne son nom au jeu, ne contraint rien en Rogue.**
- Rien ne confirme qu'une carte a été jouée. Les cartes s'empilent (10 à 15 à mi-saison), rien n'invite à les jouer, et les jetons non dépensés se perdent à la fin sans avertissement.

**Des choix sans poids, et qui le disent.**
- Une carte affiche « À peine perceptible ».
- La main du gros match totalise environ +0,7 tir.
- L'entracte à 0-4 propose +0,3 point de précision.
- Les trois défis du proprio sont tous « très durs ».
- « Aligner au mieux » laisse « un joueur mal placé » toute la saison.

**Des menus qui ne s'expliquent pas.**
- Des mots jamais définis : Fragile ×8, T2-3, Parallèle, ◆◆, sonnés, « Joueur du Showman » (un coach qu'on n'a pas).
- Des chemins qui tournent en rond. Le gros match « à régler » renvoie de la semaine au Bureau et retour. Ligue › Classement a montré la page de la semaine. Cartes s'ouvre sur l'onglet vide « Permanent ».
- Le pack ouvert se termine sur un ✕, sans « Continuer ». Toucher une carte ouvre sa fiche, pas « Signer ».

**Ce qui marche, et qu'on garde au centre.**
- **L'ouverture d'un pack de vrais joueurs** : tirer Phil Esposito 1975-76, c'est le moment fort.
- **La signature** : qui part, et ce que ça change en chiffres clairs (« +2,3 tirs »). C'est la décision la plus claire du jeu, et c'est aussi celle qui pèse le plus (20 V, V5).
- **Le match en direct.**
- **Le gros match** : deviner leur plan, jouer sa main, l'entracte.
- **Le dé des paris.**
- **Les voix** : l'analyste, Marcel de Laval.

## 3. La thèse

**Le Cap, c'est une lettre d'amour aux cartes de hockey : tu ouvres des paquets de vrais joueurs, tu bâtis le meilleur alignement sous le plafond, et tu le regardes jouer.**

Tout ce qui ne sert pas l'une de ces trois choses (ouvrir, bâtir, regarder) part ou devient automatique. Tout ce qui reste se comprend en le regardant.

Quatre principes :

1. **La forme dit l'usage.** Une carte, un bouton, un onglet annonce par sa forme et son libellé où il va et ce qu'il fait. Un bouton dit son verbe et son objet (« Poser sur un joueur », « Jouer les 10 prochains matchs »), jamais « OK » ni « Compris ».
2. **On touche la chose, pas un menu sur la chose.** Une carte se joue en la touchant, puis en touchant sa cible, qui s'allume sur l'écran où elle vit (les Lignes). Les menus restent, mais chaque menu dit ce qu'il contient, et aucun ne renvoie vers un autre qui renvoie vers lui.
3. **Plus d'actions, aucune vide.** Le but n'est pas de toucher moins : c'est que chaque toucher soit un choix qu'on comprend. Un « Compris », un choix à une seule option ou une journée sans rien à faire, c'est du bruit : on le retire, et on met de vrais choix à sa place (une carte de plus à jouer, un remplaçant parmi trois, un trio à monter avant le match).
4. **Si ça ne se voit pas, ça n'existe pas.** Une carte ou un choix sous la borne visible d'une commune est retiré, pas étiqueté « à peine perceptible ».

## 4. La boucle, de zéro

```
RUN    3 saisons au plus · le mandat du proprio en une ligne · les déblocages entre les runs
 └─ SAISON = 8 ÉTAPES (environ 10 matchs chacune) + les séries
     └─ ÉTAPE = un seul écran, dans cet ordre :
          1. LE MARCHÉ   un pack offert parmi deux (ou des jetons pour en acheter un autre)
                         → tu ouvres, tu signes, l'écran dit qui part et ce que ça change
          2. LE BANC     tu poses 0 à 2 cartes, en les touchant puis en touchant leur cible
          3. « Jouer les 10 prochains matchs » → le sommaire : la fiche, LE moment (un but, un fil),
                         les blessés et qui les a remplacés, les jetons
          4. LE GROS MATCH de fin d'étape contre un rival : l'écran de combat qu'on a déjà
     SÉRIES = les boss : un gros match à chaque match
```

- **Huit étapes au lieu de 26 semaines et 186 journées.** La ligue se joue toujours au jour le jour en dessous : `check_graine` tient, rien n'est simulé d'avance. Seul le pas de l'écran change.
- **Cible : aucun toucher vide.** Le nombre d'actions peut monter ; ce qui doit tomber à zéro, ce sont les « Compris », les choix à une seule option et les journées sans rien à décider. Aujourd'hui, ils font la majorité des touchers.
- **Les blessures ne bloquent plus.** L'adjoint rappelle le meilleur du club-école au poste exact (c'est déjà la règle de `check_ballottage`). Le sommaire le dit avec le visage du joueur, et on peut changer dans les Lignes. Un rappel ne libère jamais personne.
- **« Regarder » reste offert** pour chaque match de l'étape, et toujours pour le gros match.
- **Le plafond redevient la contrainte.** En Rogue, le plafond de la saison 1 est serré et monte avec les saisons (le mérite du club). Chaque signature se lit d'abord contre la barre. C'est la tension que le 82-0 a déjà et que le Rogue a perdue.

## 5. Les cartes : quatre formes, quatre places

Aujourd'hui : 7 familles, 4 piles, 535 cartes. Proposé : **la carte de joueur, plus trois sortes de cartes de jeu, chacune avec sa forme et sa seule place.**

| Forme | Ce que c'est | Sa place, et le seul geste | Sa durée | Ce qu'elle remplace |
|---|---|---|---|---|
| **Carte de joueur** (le portrait) | Un vrai joueur-saison | Les Lignes : on la glisse ou on la touche, puis on touche la case | La run | Inchangée |
| **Équipement** (cadre à pince, en bas de la carte) | Ce qui change UN joueur : un style, une clause, un bâton | Toucher la carte, puis toucher le joueur dans les Lignes. Les joueurs à qui elle va s'allument, les autres s'éteignent. Elle reste ensuite épinglée sur sa carte de joueur, visible | La saison | Modifs, contrats, consommables de joueur |
| **Personnel** (cadre en fanion) | Le coach et ses adjoints, comme les jokers de Balatro | Le banc : **5 cases visibles en haut des Lignes**. Toucher la carte, puis toucher une case. Le banc plein, il faut en remplacer une | La run | Patrons, cartes de saison, le coach |
| **Tactique** (cadre de tableau blanc) | Un jeu de match | Seulement dans la main du gros match. Elle ne se voit nulle part ailleurs | Un match | Cartes de match. Les événements utiles deviennent des tactiques ou des choix de sommaire |

- **Plus de poche, plus de main de la semaine, plus de « En jeu » replié.** Ce qui est en jeu se voit là où ça agit : l'équipement sur le joueur, le personnel au banc, la tactique dans la main.
- **Le pied de chaque carte dit sa place et sa durée** en une ligne : « Se pose sur un attaquant · toute la saison ». Son bouton dit le même verbe. Il n'y a plus de « Jouer » générique.
- **Une carte achetée va dans un tiroir de 3 places**, au-dessus des Lignes. Un tiroir plein se voit, et la carte de trop se pose ou se vend sur-le-champ.
- **Environ 100 cartes de jeu au lieu de 408**, chacune au-dessus de la borne visible de sa rareté (`check_cartes`, en paires). Une carte qui dit « à peine perceptible » part.
- **L'élan ne vit que dans le gros match**, là où on le voit se dépenser. Ce n'est plus une monnaie du jeu.

## 6. Les écrans : des menus qui s'expliquent

On garde des onglets, mais chacun porte le nom de ce qu'il contient, et le Bureau devient une seule question.

| Onglet | Ce qu'il contient | Ce qui en sort |
|---|---|---|
| **Bureau** | Le mandat en une ligne, la dernière étape (fiche et moment), et UN gros bouton qui dit la prochaine chose : « Ouvrir le pack de l'étape », « Jouer les 10 prochains matchs », « Préparer le gros match contre Boston » | Le duel en stats répété, le dépistage en double, la main, « En jeu », la boîte |
| **Équipe** (Lignes et Joueurs, deux vues de la même chose) | Le banc (5 cases), le tiroir (3), les trios, les paires et les gardiens avec leurs cartes épinglées. La vue tableau garde le tri à la EHM | La barre du plafond répétée |
| **Cartes** | La boutique et l'album, rien d'autre | Les quatre sous-onglets de piles |
| **Ligue** | Le classement, le calendrier, les meneurs, le palmarès | — |

Les règles des menus :
- **Un mot à l'écran se touche** et dit sa définition en une ligne (Fragile, T2-3, Parallèle). Un mot qu'on ne peut pas définir en une ligne ne s'affiche pas.
- **Un onglet ne s'ouvre jamais vide.** Il s'ouvre sur ce qui a quelque chose.
- **Une fenêtre se ferme par son action** (« Signer », « Continuer »), le ✕ n'est qu'une sortie de secours.
- **Aucun lien ne renvoie vers un écran qui renvoie vers lui** (smoke : un parcours sans boucle).

## 7. Les concepts : de 40 à environ 15

Le premier quart d'heure ne montre que ceci :

joueur, niveau, rôle et badge, trio et paire, système, jambes, plafond, pack, jetons, équipement, personnel, coach, tactique, gros match, mandat.

| Concept d'aujourd'hui | Le sort |
|---|---|
| Médailles, prestige, déblocages | Entre les runs seulement : un écran de fin de run, pas pendant |
| Confiance I-II-III | Elle se lit sur la case du coach au banc (« 4 joueurs du Frelon ») et monte avec les joueurs de sa couleur alignés, pas avec les cartes jouées. On bâtit l'équipe pour son coach |
| Élan | Dans le gros match seulement |
| Poche, main de la semaine, deck, banque | Remplacés par le tiroir et la main du gros match |
| Zones (T2-3), carrure, Parallèle, ◆◆, Fragile ×N | Une icône qu'on touche pour la définir, ou rien. « Mal placé » nomme le joueur et sa case, ou disparaît |
| Ballottage, club-école, rappel, bouche-trous | L'adjoint, automatique ; le sommaire le dit |
| Cartable, classeur, album | L'album seulement ; le classeur devient « ton premier pack » |
| Arcs, fils, voix, une, lancée | Le « moment » de l'étape, dans le sommaire : une histoire à la fois |
| Appariement, roulement, unités spéciales, consigne, agressivité | Restent dans Équipe › Ce soir, réglés par défaut, jamais demandés |
| Défi du proprio (trois « très durs ») | Un choix réel : facile et petit butin, moyen, dur et gros butin |

Rien de cela n'enlève du moteur : les réglages fins restent pour qui les cherche. Ils cessent seulement d'être sur le chemin.

## 8. La méthode : couper d'abord, ensuite polir

1. **Gel des ajouts** jusqu'à ce que la boucle V8 soit jouable : aucune mécanique, aucun onglet, aucune famille de cartes neuve.
2. **La boucle V8 se bâtit à côté**, derrière une option « Rogue V8 », jouable de bout en bout avant de toucher au reste. Le moteur ne bouge pas : une étape est une suite de journées, une carte passe par les canaux existants.
3. **Un juge de la boucle** : `essai_boucle.mjs` joue une saison et échoue si :
   - un toucher n'est qu'une confirmation (« Compris », un choix à une seule option) ;
   - un choix ne dit pas, avant, ce qu'il va changer ;
   - plus de 15 concepts distincts sont affichés dans les 15 premières minutes ;
   - un écran renvoie vers un écran qui renvoie vers lui ;
   - une carte se joue en plus de 2 touchers.
4. **Ensuite, on retire l'ancien** : les familles fondues, leurs écrans, leurs scripts. `check_mort` dit ce qui reste. Une règle ferme qui protégeait un système retiré part avec lui (section 9).
5. **Un joueur neuf la joue** (une personne qui n'a jamais vu le jeu, ou un agent sur un profil neuf) avant la fusion. On compte le temps jusqu'à la première carte bien posée.

## 9. Ce que JP tranche

1. **La thèse** : ouvrir, bâtir, regarder. Tout le reste part ou devient automatique. D'accord ?
2. **Le rythme** : l'étape de 10 matchs, ou la semaine d'aujourd'hui débarrassée de ses touchers vides ? Les blessures deviennent un vrai choix parmi trois remplaçants (ou l'adjoint, si tu passes), jamais un « qui monte ? » à une seule option.
3. **Les quatre formes de cartes** (joueur, équipement, personnel, tactique) au lieu des 7 familles et des 4 piles, et une banque d'environ 100 cartes ?
4. **Le plafond qui contraint en Rogue**, serré à la saison 1 et qui s'ouvre avec le mérite ?
5. **Les règles fermes à réécrire** :
   - « cinq sections » devient quatre (Équipe réunit Joueurs et Lignes) ;
   - « la boîte ne contient que ce qui se règle » devient « il n'y a pas de boîte : le sommaire de l'étape et le gros bouton du Bureau » ;
   - les scripts des familles fondues partent avec elles.
6. **L'ordre** : la boucle V8 derrière une option, ou l'entre-deux ci-dessous ?

## 10. L'entre-deux : transformer en place, par tranches

JP : *un entre-deux ?*, puis *je veux pas moins d'actions, au contraire, mais moins de confusion*. On transforme le jeu actuel, une PR par tranche. Chaque tranche ajoute des choix lisibles et retire de la confusion. Elle ne retire jamais d'action.

1. **Les cartes qui disent leur usage.**
   - La poche et la main de la semaine deviennent une seule rangée de cartes.
   - Le pied de chaque carte dit sa place et sa durée (« Se pose sur un attaquant · toute la saison »), et son bouton dit le même verbe.
   - Toucher la carte allume ses cibles dans les Lignes ; toucher une cible la pose. Le joueur nommé par la carte est en tête.
   - La carte posée reste visible là où elle agit : sur la carte du joueur, ou au banc.
   - Le deck de match ne bouge pas : il reste au gros match.
2. **Aucun toucher vide.**
   - Les « Compris » partent ; ce qu'ils annonçaient va au sommaire.
   - Une blessure propose trois remplaçants, chacun avec ce qu'il change en vraies stats ; un rappel ne libère jamais personne pour de bon.
   - Une journée sans rien à décider ne demande pas de toucher. Une journée de match peut en demander : le trio à monter, la carte du soir.
3. **Les mots qui s'expliquent.**
   - Chaque terme se touche et dit sa définition en une ligne.
   - Aucun onglet ne s'ouvre vide.
   - Les chemins en boucle trouvés dans la run sont corrigés : le gros match « à régler », Ligue › Classement qui montrait la semaine, le pack qui finit sur un ✕.
4. **Des cartes qui se sentent.** Celles sous la borne visible de leur rareté quittent les tirages (`retire`, comme les 120 événements). Les vieilles parties les rejouent.

Le juge de chaque tranche : un script joue une saison et échoue s'il trouve un toucher vide, un choix qui ne dit pas d'avance ce qu'il change, ou une carte dont la face ne dit pas sa place.
