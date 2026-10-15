# La V8 · le club en main

14 et 15 octobre 2026. JP :
- *Tu me proposes toujours des trucs qui ne sont pas holistiques et ne refont pas le jeu de façon à le rendre réellement plus jouable.*
- *Affordance dans le sens de : chaque chose sous-entend ce à quoi elle sert. Genre, c'est pas clair comment jouer les cartes présentement.*
- *C'est correct, des menus, si les menus sont clairs et s'expliquent d'eux-mêmes.*
- *Je veux pas moins d'actions, au contraire, mais moins de confusion.*
- *Ça doit feeler comme si je manage vraiment un club, mais sans avoir à me faire chier dans les menus. Tu peux avoir des sous-menus si ça rend chaque page claire, mais je veux pas avoir à me chercher non stop.*
- *L'idée est pas de faire un jeu totalement différent, mais d'organiser l'information d'une manière claire, actionnable et basée sur l'intention du joueur.*
- *EHM ou Slay the Spire : y'a aucun moment où je ne suis pas en complet contrôle de ce que je fais. Je veux un mix des deux.*

**Le même jeu**, avec ses joueurs, ses cartes, son moteur et ses modes. Ce qui change, c'est **où vit chaque chose** : rangée selon ce que le joueur veut faire, avec l'information de la décision sur l'écran de la décision. Et **rien ne t'arrive sans que tu l'aies vu venir**.

Ce plan s'appuie sur deux enquêtes :
- une run jouée le 14 oct. dans Chromium à 390 px, sur un profil neuf : 93 captures, une partie jouée avec attention jusqu'à la journée 84, une jouée par script jusqu'au bilan ;
- l'inventaire, dans le code, de chaque information et de chaque action d'une saison de Rogue : où elle s'affiche, où elle se règle, en combien de touchers.

## 1. Pourquoi la V7 n'a pas suffi

La V7 a rangé par **question** (« Qu'est-ce qui se passe aujourd'hui ? », « Qui j'ai ? »). Une question appelle de l'information. Or un gérant arrive avec une **intention** : préparer le match de ce soir, boucher un trou, jouer une carte. L'action et l'information dont elle a besoin se retrouvent donc dans deux onglets différents. L'inventaire le montre partout :

| Je veux… | L'action vit dans | L'info pour décider vit dans |
|---|---|---|
| Préparer le match de ce soir | Lignes (consigne, gardien, systèmes, appariement) | Bureau › Dépistage (leurs forces, leur plan, ce qui est en jeu) |
| Remplacer un blessé | Un message de la boîte, puis « Remanier derrière le banc » (le message ne suit pas) | Lignes : seulement 🩹 et qui le remplace |
| Jouer une carte | Bureau (la main) | La confiance du coach est pliée sous « En jeu » ; le deck est dans Cartes |
| Jouer une carte de plafond 💵 | Bureau | La barre du plafond n'est que dans Cartes et la Boutique : celle de l'en-tête est **cachée partout**, parce qu'elle vise des sections qui n'existent plus (`marche`, `effectif`, style.css:330) |
| Acheter un pack | Cartes › Boutique, 4 touchers | Les trous de l'effectif, les blessés et les jambes : Joueurs et Lignes |

Et la même chose s'affiche à plusieurs endroits :
- le rang, à 6 endroits ;
- les jetons, à 6 ;
- les effets en jeu, à 4 (« En jeu », « En cours », « Déjà en jeu », Lignes › Équipe) ;
- le gros match, à 4 ;
- les blessés, à 7.

On ne sait jamais lequel est le vrai, ni où agir.

**Ce qui brise le contrôle**, au sens d'EHM et de Slay the Spire :
- **Ce que tu changes aux Lignes ne compte pas** tant que tu n'as pas touché « Retour au match » ou un autre onglet de la saison.
- **Des choses arrivent sans que tu les voies venir** : une fenêtre qui bloque, un pack gratuit qui tombe, une main de la semaine pigée pour toi, une carte qui change.
- **Des choses se décident à ta place** : le rappel qui libère pour de bon un joueur absent cinq matchs, une case vide remplie d'une carte tirée pour toi, « l'adjoint joue cette série ».
- **Des cartes qui ne disent pas ce qu'elles font** : « à peine perceptible », « Tu tires moins », une main de match qui ne donne aucun chiffre.
- **« Jour suivant »** ne dit pas où il va s'arrêter.

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

## 3. Le contrôle : six règles, d'EHM et de Slay the Spire

| D'où | La règle | Ce qu'elle exige à l'écran |
|---|---|---|
| Slay the Spire, la carte | **Tu vois ce qui vient.** | La route des deux prochaines semaines est toujours visible : les matchs, les gros matchs, le lundi, le pack gratuit, la date limite. Rien n'arrive qui n'était pas sur la route. |
| Slay the Spire, l'intention de l'ennemi | **Tu sais ce que fait l'adversaire avant de jouer.** | Le plan de l'adversaire et ses forces sont affichés là où tu prépares le match, pas un écran à côté. |
| Slay the Spire, le texte des cartes | **Chaque carte dit exactement ce qu'elle fait**, en vraies stats, là où tu la joues. | « +1,2 tir par match pour ton 1er trio · 4 matchs ». Jamais « à peine perceptible » ; une carte qui ne peut pas le dire n'est pas dans le jeu. |
| EHM, la coquille | **Tout ce que tu possèdes se consulte et se change en tout temps.** | Les lignes, l'effectif, les cartes et le plafond sont à un toucher de partout, et un changement compte tout de suite, sans « Retour au match ». |
| EHM, la boîte | **Rien ne se décide à ta place, sauf si tu le délègues.** | Pas de libération ni de carte tirée en silence. Tu peux confier à l'adjoint une sorte de tâche (les blessures, par exemple), par un réglage que tu vois et que tu reprends. |
| Les deux | **Avancer dit où il s'arrête.** | « Jouer jusqu'à jeudi · gros match contre Boston », jamais un « Jour suivant » muet. |

## 4. Les cinq sections, rangées par intention

On garde cinq sections et des sous-onglets. Chacune répond à **une intention** et porte, sur le même écran, l'information dont l'intention a besoin.

| Section | L'intention | Ce qu'on y fait | L'info qui y vit, pour décider sur place |
|---|---|---|---|
| **Bureau** | « Qu'est-ce que j'ai à faire, et qu'est-ce qui s'en vient ? » | **À faire** : chaque élément est un bouton qui ouvre l'endroit exact où il se règle, avec son contexte, puis revient. **Avancer**, qui dit où il s'arrête. | **La route** (deux semaines, à la Slay the Spire), le mandat, hier soir en un bloc (le résultat, la une) |
| **Ce soir** (les Lignes d'aujourd'hui, devenues la préparation du match) | « Préparer le prochain match » | Les trios, les paires, le filet, AN · DN ; la consigne ; **les cartes du soir** ; Aligner au mieux | **L'adversaire en face** : son plan, ses forces, ses meneurs (le dépistage déménage ici). Ce qui est en jeu, **en un seul endroit**, et la feuille attendue qui bouge à chaque changement |
| **Effectif** (Joueurs) | « Gérer mes joueurs » | La fiche, poser un équipement sur un joueur, libérer, échanger de case ; **l'infirmerie** : chaque blessé avec ses remplaçants proposés | Le tableau triable : jambes, stats, salaire, niveau, badge ; la barre du plafond |
| **Marché** (la Boutique d'aujourd'hui, sortie de Cartes) | « Améliorer mon équipe » | Acheter un pack, signer, le ballottage, le club-école | **Les besoins de l'équipe** : les cases faibles, les blessés, le plafond qu'il reste. Chaque joueur offert dit sa meilleure case et ce qu'il y changerait |
| **Ligue** | « Où j'en suis ? » | — | Le classement, le calendrier, les meneurs, les équipes, le palmarès, ton histoire |

**Les cartes, le build et le plafond restent à portée en tout temps**, comme le deck dans Slay the Spire. L'en-tête porte trois boutons :
- 🪙 les jetons ;
- 💵 le plafond, qui ouvre sa barre détaillée ;
- 🂠 tes cartes, qui ouvre ta collection : le coach et sa confiance, le deck de match, la poche, l'album.

Le panneau des cartes s'ouvre par-dessus n'importe quel écran et s'y referme.

**Le menu (☰)** garde ce qui vit entre les runs : les déblocages, les options, les règles, les parties.

### Ce qui déménage

| Aujourd'hui | Sa maison V8 |
|---|---|
| Bureau › Dépistage, « En cours », la forme de l'adversaire | Ce soir, en tête |
| Bureau › la main de la semaine, « En jeu » | Ce soir › les cartes du soir ; Effectif pour l'équipement ; le panneau 🂠 pour le reste |
| La boîte de réception | Bureau › À faire. Chaque élément ouvre l'endroit où il se règle |
| La page du lundi | Bureau › À faire, regroupé sous « Lundi » ; ses choix restent envoyés en un lot |
| Cartes › Boutique | Marché |
| Cartes › Tes cartes, Album | Le panneau 🂠 de l'en-tête |
| La barre du plafond (Cartes, Boutique, signatures) | L'en-tête 💵, en tout temps ; en grand dans Marché et Effectif |
| Les blessés (7 endroits) | Effectif › Infirmerie ; une ligne dans À faire tant que rien n'est réglé |
| Ligue › Ta saison › Calendrier | Bureau › La route (les deux semaines), Ligue › Calendrier (la saison) |

## 5. Les cartes, par intention

Une carte vit là où agit son effet, et sa face dit sa place et sa durée.

| La carte | Où elle se joue | Le geste |
|---|---|---|
| **Carte du soir** (match, consigne, événement d'une semaine) | Ce soir | La toucher allume ses cibles (un trio, le gardien, l'équipe), toucher la cible la pose. La feuille attendue bouge tout de suite, et tu peux la reprendre jusqu'au match |
| **Équipement** (modif, style, clause) | Effectif | La toucher allume les joueurs qui peuvent la porter, toucher un joueur la pose. Elle reste ensuite visible sur sa carte de joueur |
| **Personnel** (coach, patrons) | Panneau 🂠 › Le banc | Des cases visibles, comme les jokers de Balatro |
| **Tactique du gros match** (le deck, l'élan) | Le gros match, comme aujourd'hui | Inchangé : c'est un des bons moments du jeu |
| **Contrat 💵** | Marché, à côté de la barre du plafond | Elle n'est offerte que si elle change quelque chose à ton plafond |

- **Le pied de la carte** dit sa place et sa durée (« Ce soir · ton 1er trio · 4 matchs ») ; **son bouton**, le même verbe.
- **Sa face dit l'effet exact** en vraies stats, comme le dit déjà la signature (« +2,3 tirs »), qui est le modèle à suivre.
- **Le compteur** « 2 cartes à jouer cette semaine » vit dans l'en-tête, sur 🂠, et dans À faire.

## 6. Une journée type, après

1. **Bureau.** À faire : « Lindros blessé 5 matchs · le remplacer », « 2 cartes à jouer cette semaine ». La route : mardi contre Ottawa, jeudi **gros match** contre Boston, lundi.
2. Je touche « Lindros blessé ». **Effectif › Infirmerie** s'ouvre sur lui avec trois remplaçants, chacun avec ce qu'il change en vraies stats. J'en choisis un et je reviens au Bureau.
3. Je touche **Ce soir**. Ottawa en tête (leur plan, leurs forces), mes lignes dessous. Je touche une carte du soir, mon 1er trio s'allume, je le touche. La feuille attendue passe de 31 à 33 tirs.
4. **Avancer · jusqu'à jeudi, gros match contre Boston.** Le match de mardi se joue : je peux le regarder, ou le sommaire le dira.
5. Jeudi, le gros match s'ouvre tout seul, parce qu'il était sur la route.

Il y a autant d'actions qu'aujourd'hui, ou plus. Aucune ne demande de chercher, et aucune n'est une surprise.

## 7. Les tranches, une PR chacune, dans le jeu actuel

1. **Les correctifs de contrôle** (petits, tout de suite) :
   - un changement aux Lignes compte sans « Retour au match » ;
   - la barre du plafond de l'en-tête réapparaît ;
   - un rappel ne libère plus personne ;
   - plus aucune case vide remplie d'une carte tirée en silence ;
   - « Avancer » dit où il s'arrête.
2. **Bureau : À faire et la route.**
   - La boîte et la page du lundi deviennent la liste À faire, chaque élément avec son lien vers l'endroit exact.
   - La route des deux semaines remplace le calendrier du Bureau.
3. **Ce soir.**
   - Le dépistage et ce qui est en jeu montent en tête des Lignes.
   - Les cartes du soir se posent sur leur cible.
   - La feuille attendue bouge à chaque geste.
4. **Effectif et Marché.**
   - L'infirmerie, avec ses remplaçants proposés.
   - L'équipement posé sur le joueur.
   - Le Marché sort de Cartes, avec les besoins de l'équipe en tête.
5. **L'en-tête et le panneau 🂠.**
   - Les cartes, le coach et le plafond deviennent accessibles de partout.
   - La section Cartes disparaît.

Le juge de chaque tranche : un script joue une saison et échoue s'il trouve :
- une fenêtre qui n'était pas sur la route ;
- un élément d'À faire qui n'ouvre pas l'endroit où il se règle ;
- une carte dont la face ne dit pas sa place, sa durée et son effet ;
- une même information affichée à deux endroits sans être un lien vers sa maison.

## 8. Ce que JP tranche

1. Les cinq sections par intention : **Bureau, Ce soir, Effectif, Marché, Ligue**, avec les cartes et le plafond dans l'en-tête plutôt que dans une section ?
2. La boîte de réception et la page du lundi fondues dans **À faire**, au Bureau ?
3. La délégation : quelles tâches l'adjoint peut-il prendre si tu le lui confies (les blessés, Aligner au mieux avant chaque match) ?
4. On commence par la tranche 1, les correctifs de contrôle, pendant que je monte une maquette cliquable des tranches 2 et 3 ?
