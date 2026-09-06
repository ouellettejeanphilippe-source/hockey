# Le moteur par événements — ébauche

Ce document est la spécification de la refonte de `js/sim.js`. Il ne décrit pas
ce qui existe : il décrit ce qu'on bâtit, et **pourquoi chaque choix est celui-là
plutôt qu'un autre**, avec les mesures qui l'appuient.

Tout ce qui est marqué « mesuré » a été vérifié sur les 1396 équipes-saisons des
shards ou sur l'API. Tout ce qui est marqué « à mesurer » est une hypothèse de
design qu'il faudra confirmer pendant l'implémentation.

---

## 1. Le constat qui change tout

Le rythme du hockey n'a pratiquement pas bougé en 55 ans. **Mesuré**, lancers
contre par équipe par match, somme des fiches de gardiens :

| Saison | Lancers contre / match | Écart entre la meilleure et la pire équipe |
|---|---|---|
| 1970-71 | 29,4 | 18 % |
| 1985-86 | 28,2 | 30 % |
| 2015-16 | 27,6 | 27 % |

Pendant ce temps, les **buts** par équipe par match vont de 4,33 (1981-82) à 2,79
(2012-13) — **55 % d'écart, mesuré**.

Donc l'inflation offensive des années 80 n'est pas un hockey plus rapide. C'est
un hockey où **on marquait sur ses lancers** : environ 15,5 % en 1981-82 contre
10,0 % en 2012-13. Le gardien a changé, pas le tempo.

**Conséquence de design.** Si l'événement de base est le *lancer* plutôt que le
*but*, la normalisation par époque cesse d'être un facteur global bricolé sur le
pointage. Elle devient deux nombres par saison, tous deux mesurables dans l'API :
le **% de tir de la ligue** et le **% d'arrêts de la ligue**. Le volume, lui, se
porte presque tout seul.

C'est la raison principale de faire cette refonte. Le reste en découle.

---

## 2. Le principe : l'événement est le lancer

Un match se joue en tirant des lancers. Chaque lancer a un tireur, un gardien, et
deux issues.

```
    lancer  →  but      →  passeur principal (souvent) + passeur secondaire (parfois)
            →  arrêt    →  crédité au gardien
```

Une seule primitive produit **toute** la feuille de match : buts, passes, lancers,
arrêts, pourcentage d'arrêts, moyenne de buts alloués, blanchissages. Et les
égalités que tu voulais vérifier se ferment **par construction**, pas par un
contrôle après coup :

- buts de l'équipe = somme des buts de ses joueurs
- lancers = arrêts du gardien adverse + buts de l'équipe
- passes ≤ 2 par but

Aujourd'hui `playGame` tire un total d'équipe en Poisson puis `creditGoals`
répartit ce total. Le pointage individuel est donc **décoré après coup**. Avec le
lancer comme primitive, le total du match **émerge** des joueurs. C'est la même
différence qu'entre peindre un résultat et le jouer.

---

## 3. Les données à ajouter aux shards

**Mesuré : rien de tout ça n'est dans les shards aujourd'hui.** Les patineurs
portent `gp, g, a, pt, pm, pim, ht, fo, toi` ; les gardiens `gp, w, l, sv, ga, so`.

**Mesuré : tout est dans l'API depuis 1970-71**, vérifié à 1970-71, 1985-86 et
2015-16.

| Champ | Source API | Sert à |
|---|---|---|
| `sh` lancers du patineur | `skater/summary.shots` | volume de lancers par joueur |
| `sa` lancers contre du gardien | `goalie/summary.shotsAgainst` | calibrer la suppression de lancers |

**Deux champs, pas cinq.** Le reste se déduit et n'a pas à être stocké :

- **% de tir** d'un joueur = `g / sh`
- **arrêts** d'un gardien = `sa × sv`, `sv` étant déjà dans le shard

**Fait.** `RATINGS_VERSION` 19. Et le travail était plus petit que prévu :
`build_shards.py` récupérait déjà `shots` — `rateSkaters` le lit pour calculer
la sous-cote `sp`. Les deux champs étaient simplement jetés à l'écriture du
shard. Aucun changement au script d'aspiration, deux lignes dans `ratings.js`.

C'est de l'**étage 1** : ces champs viennent des stats brutes, donc il faut un
build complet, pas un `--rerate`.

### Ce qui manque encore

Les **passes principales et secondaires** ne sont pas dans `skater/summary`.
Elles existent dans les rapports `powerplay` et `penaltykill`, mais seulement
pour ces situations-là, pas à forces égales. Le moteur utilisera donc une
répartition moyenne d'époque plutôt qu'une propension par joueur. C'est une
approximation assumée, pas un oubli.

---

## 4. Le moteur, match par match

`simulateLeague` fait déjà tourner 82 rondes et 1312 vrais matchs entre vraies
équipes. **On ne touche pas à cette boucle.** On remplace ce qui se passe à
l'intérieur d'un match.

### 4.1 Le temps de glace est la monnaie

`POIDS_TRIO = [0,34 · 0,28 · 0,22 · 0,16]` et `POIDS_PAIRE = [0,40 · 0,34 · 0,26]`
existent déjà comme pondérations abstraites. Ils deviennent des **parts de temps
de glace réelles**.

Un match ≈ 60 minutes × 5 patineurs. Le premier trio joue 34 % des présences
d'attaquants, le quatrième 16 %. C'est ce qui rend le placement d'un joueur
décisif au lieu de cosmétique : **mettre un joueur au quatrième trio lui donne
deux fois moins de lancers qu'au premier.**

### 4.2 Combien de lancers

```
lancers_equipe = BASE_LANCERS × (pression_offensive / suppression_adverse)
```

`BASE_LANCERS` ≈ 28, **mesuré**, et stable sur 55 ans — donc c'est une vraie
constante, pas un curseur d'époque.

La **pression offensive** vient des lancers par minute de chaque joueur, pondérés
par sa part de temps de glace.

La **suppression**, elle, s'est révélée être autre chose que ce que ce paragraphe
disait dans sa première version. On pariait qu'elle viendrait du corps de
défenseurs, avec les lancers contre réels comme cible à atteindre. **Mesuré
(étape 8.3) : l'alignement ne prédit pas le volume de lancers concédés** —
corrélation −0,17, et 8 % d'écart reproduit contre 56 % de réel. La suppression
se réduit donc à la **possession** :

```
suppression_adverse = possession_adverse ^ 0,150
```

Le reste de l'écart réel entre défensives existe, mais il tient au système et à
l'entraîneur, pas aux joueurs signés. Le moteur ne le vendra pas au joueur comme
quelque chose qui s'achète. **La qualité de la brigade agit au 4.4, sur la
probabilité qu'un lancer entre, pas ici sur leur nombre.**

### 4.3 Qui tire

Chaque lancer de l'équipe est attribué à un joueur sur la glace, au prorata de
ses lancers par minute. Un franc-tireur au premier trio tire beaucoup ; le même
gars au quatrième tire deux fois moins. Aucune règle spéciale n'est nécessaire —
ça tombe tout seul du temps de glace.

### 4.4 But ou arrêt

```
P(but) = %tir_du_tireur × facteur_gardien × (1 − K × z_def_adverse)
```

Le gardien passe donc sur **chaque** lancer. Avec ~28 lancers par match, deux
points de pourcentage d'arrêts valent environ **0,6 but par match**. Le gardien
devient le levier individuel le plus lourd de l'alignement — ce qui est vrai au
hockey et faux dans le moteur actuel, où il ne pèse que 0,38 d'un terme.

Le troisième terme est la **défensive de l'équipe adverse**, et c'est ici qu'elle
agit — pas sur le volume. `z_def_adverse` est la cote défensive de l'alignement
en écart-type de sa saison, pondérée par la part de glace des unités.
**Mesuré : `K` est entre 0,029 et 0,050**, soit 3 à 5 millièmes d'arrêts par
écart-type, survivant au contrôle par l'identité du gardien (étape 8.3). Un
défenseur ne bloque donc pas des lancers dans ce moteur : il rend ceux qui
passent moins dangereux, ce qui est exactement ce que les données disent.

### 4.5 Les passes

Un but tiré, on attribue une passe principale et, avec une probabilité mesurée
sur l'époque, une passe secondaire, aux coéquipiers sur la glace au prorata de
leur propension à la passe (`a` ÷ `pt` de leur vraie saison). Un fabricant de jeu
au premier trio récolte donc des passes ; le même au quatrième en récolte moins.

### 4.6 La normalisation par époque

Deux nombres par saison, tous deux tirés de l'API :

- **% de tir de la ligue** — 15,5 % en 1981-82, 10,0 % en 2012-13
- **% d'arrêts de la ligue** — le miroir du précédent

Chaque joueur est exprimé en **écart à la ligue de sa saison**, jamais en valeur
absolue. Esposito à 13,8 % en 1970-71 et Kane à 16,0 % en 2015-16 se comparent
alors correctement. `SEASON_GOAL_AVG` existe déjà et sert d'ancrage de contrôle :
la ligue simulée doit retomber sur le vrai nombre de buts de l'année.

---

## 5. Ce qui rend les choix intéressants

C'est la vraie question. Un moteur plus fin ne vaut rien s'il ne récompense pas
des décisions. Chaque levier ci-dessous existe **parce que** le modèle par lancers
le rend mordant.

### 5.1 Où tu places un joueur devient un vrai choix

Le temps de glace étant la monnaie, mettre une vedette au quatrième trio lui coupe
la moitié de ses lancers. Le malus de zone (déjà en place, `ZONE_PEN_SOUS`) punit
déjà le gaspillage ; le moteur par événements le rend **visible dans la feuille de
match** — le gars a 22 buts au lieu de 40, et tu le vois.

### 5.2 Le gardien devient un pari majeur

Il touche chaque lancer. Et **mesuré** : les salaires de gardiens ont des aubaines
énormes selon les époques. Investir 6 M$ dans un gardien ou 6 M$ dans un
attaquant de premier trio devient une vraie question, avec des conséquences
différentes selon le reste de ton alignement.

### 5.3 La profondeur cesse d'être décorative

Le quatrième trio joue 16 % des minutes. Un quatrième trio faible encaisse des
lancers pendant treize minutes par match, tous les soirs. Empiler des vedettes en
haut en négligeant le bas devient une stratégie **avec un coût mesurable**, pas
une punition abstraite.

Et le coût n'est pas celui qu'on annonçait ici. Ce n'est pas que le quatrième
trio *encaisse plus de lancers* — mesuré, il n'en encaisse pas plus. C'est que
les lancers encaissés pendant ses présences entrent plus souvent. Même treize
minutes, plus dangereuses.

### 5.4 Les traits, rares et ciblés

Chacun touche **un** type d'événement, jamais une cote globale. Trois étages,
du plus solide au plus discutable :

- **Factuels**, tirés de l'API, couverture complète : bagarreur (pénalités
  majeures, disponibles depuis 1970-71), tueur de punitions (points en
  désavantage), quart-arrière en avantage, homme de fer (matchs joués),
  spécialiste des mises au jeu (1997-98+), cogneur (2005-06+).
- **Votés**, populations complètes et publiques : Selke, Norris, Vezina, Conn
  Smythe, équipes d'étoiles. `data/trophees.js` est déjà dans le dépôt.
- **Curatés**, un fichier JSON édité à la main, deux cents joueurs légendaires.
  La règle qui le garde honnête : on n'y met que ce qu'un amateur affirmerait
  sans hésiter.

Un trait est **rare par construction**. Ne pas en avoir veut dire « rien de
particulier », ce qui est vrai et n'invente rien — contrairement à une cote, qui
doit exister pour les 33 141 joueurs et ment donc quand elle est inconnue.

### 5.5 Les séries redeviennent incertaines

**Mesuré, et c'est le trou le plus béant du jeu actuel :** une équipe de niveau 80
gagne la Coupe **99 % du temps**, et une équipe de niveau 90 ou plus la gagne
**toujours**. L'objectif déclaré du jeu est plus facile que le 82-0 qu'on
protégeait.

La cause est dans `playSeries`, qui appelle `playGame(A, B, g, false)` : avec
`track = false`, tout le bloc `if (track)` est sauté, donc **aucune blessure**,
aucune usure, aucune rotation de gardien sur quatre rondes. Les séries sont
l'expression pure de la qualité, et un 4 de 7 amplifie l'écart au lieu de
l'égaliser.

Le moteur par lancers donne la variance naturellement :

- un **gardien chaud** est un tirage de % d'arrêts par série, pas un bonus inventé
- les **blessures** s'activent en séries comme en saison
- l'**usure** s'accumule sur quatre rondes

**À mesurer** : quelle amplitude de tirage ramène une équipe forte de 99 % à
quelque chose comme 40 à 60 % de chances de Coupe. Mon test préliminaire dit que
la variance seule ne suffit pas — la vraie cause est que l'alignement du joueur
domine tout le champ. Le malus de zone vient de refermer une bonne partie de cet
écart (l'optimum atteignable est passé de 83,8 à 69,3, contre 68,0 pour la
meilleure équipe de l'histoire), donc il faut **remesurer les chances de Coupe
après la refonte** avant de toucher à la variance.

---

## 6. Les invariants — ce qui ne doit jamais casser

Ces quatre règles ont chacune été apprises en la brisant, cette session.

1. **Monotonie.** Améliorer ses joueurs ne doit jamais rendre l'équipe pire.
   `node scripts/check_monotonie.mjs`, sur de vraies équipes, doit rester monotone
   sur les dix déciles. Un malus forfaitaire sur un seuil absolu viole cette règle
   — mesuré : `70 → 55-25` mais `80 → 43-38`.
2. **Équité entre époques.** Aucune saison ne doit être un raccourci. La
   corrélation force/classement de `check_ratings.mjs` doit rester autour de 0,80,
   et le nombre de buts simulés de chaque saison doit retomber sur son
   `SEASON_GOAL_AVG` réel.
3. **Plafond réaliste.** `node scripts/mock_zones.mjs` : le meilleur alignement
   légal doit rester près de 68,0, l'indice de la meilleure équipe de l'histoire.
4. **Un seul endroit par formule.** Les maquettes importent `CAP`, `ZONE_PEN_*`,
   `ZONE_THRESHOLDS` et `LINE_ZONES` au lieu de les recopier. Toute nouvelle
   constante suit la même règle.

---

## 7. Le plan de vérification

La refonte se juge sur des nombres, pas sur une impression. Dans l'ordre :

| Test | Cible | Mesuré |
|---|---|---|
| Buts de la ligue par match | ≈ 3,1, la référence moderne | **3,06 à 3,11** ✓ |
| Lancers par équipe par match | ≈ 28,5 | **28,2 à 28,5** ✓ |
| Cohérence de la feuille de match | les quatre égalités, sur 1312 matchs | **aucun écart** ✓ |
| Totaux des joueurs sur 82 matchs | ≈ leurs vrais totaux | biais −15 %, erreur 34 % dont 26 de bruit ⚠ |
| `check_monotonie.mjs` | monotone, dix déciles sur dix | **10/10, et colle au réel** ✓ |
| `check_ratings.mjs` | corrélation ≈ 0,80 | **0,804** ✓ |
| Plafond du jeu | près du sommet historique, pas au-dessus | **64,3 V contre 62,8** ✓ |
| Chances de Coupe | plus 100 %, et un vrai pari | **50 % au plafond, 40 % à MTL 76-77** ✓ |
| Rareté des traits | assez rare pour vouloir dire quelque chose | **1,02 % des joueurs-saisons** ✓ |
| `smoke.mjs` à 390 px | 0 erreur console | **0** ✓ |

Le contrôle de cohérence des feuilles de match est devenu un test permanent,
`scripts/check_feuilles.mjs` : c'est lui qui attrape les erreurs d'attribution
que l'œil ne voit pas. Il en a déjà trouvé deux que rien d'autre n'aurait
signalées — une unité entièrement blessée produisait un but sans marqueur, et
une équipe dont les deux gardiens étaient blessés recevait des lancers que
personne ne pouvait créditer. Une centaine de lancers par saison disparaissaient
ainsi de la comptabilité, sans que le pointage ait l'air faux.

---

## 8. L'ordre de bataille

1. **Ajouter `sh`, `s%`, `sa`, `a1`, `a2` aux shards.** Étage 1, donc un `full`
   par l'Action. Bloquant pour tout le reste, et petit. Ne casse rien en attendant :
   les champs sont simplement ignorés par le moteur actuel.
2. **Maquette hors ligne du moteur** — `scripts/mock_moteur.mjs`. **Fait.**
   Résultat sur 124 équipes-saisons de six époques :

   | | biais | erreur moyenne par équipe |
   |---|---|---|
   | lancers d'équipe | −0,2 % | 1,8 % |
   | buts d'équipe | −2,7 % | 6,4 % |
   | % d'arrêts | −2,9 millièmes | 3,7 |
   | cohérence des feuilles de match | **aucune incohérence** | |

   **Le modèle tient.** Les trois égalités se ferment sur chaque match, pas à la
   fin, et le volume de lancers est reproduit presque exactement. Le résidu de
   2,7 % sur les buts vient de ce que seuls 18 patineurs tirent alors qu'une
   vraie équipe en aligne davantage, et de l'absence d'avantage numérique.
3. **Calibrer la suppression de lancers** contre les lancers contre réels.
   **Fait — et la réponse n'est pas celle que ce document attendait.**
   `scripts/check_suppression.mjs`, sur les 1392 équipes-saisons.

   La section 4.2 pariait que la brigade défensive ferait baisser le *volume*
   de lancers concédés. **Mesuré, elle ne le fait pas** : la cote défensive de
   l'alignement corrèle à **−0,17** avec les lancers contre, et le modèle
   complet — possession, brigade, quatre trios — n'en reproduit que 8 % d'écart
   entre la meilleure et la pire défensive, là où le réel en montre 56 %.
   L'alignement n'explique pratiquement pas qui concède des lancers.

   Le signal, lui, est ailleurs. La même cote défensive corrèle à **+0,45** avec
   le pourcentage d'arrêts de l'équipe et à **−0,45** avec ses buts alloués :

   | signal de l'alignement | lancers contre | % d'arrêts | buts contre |
   |---|---|---|---|
   | possession | −0,19 | +0,25 | −0,30 |
   | brigade défensive (cote `d`) | −0,17 | **+0,45** | −0,43 |
   | quatre trios (cote `d`) | −0,18 | **+0,45** | −0,45 |
   | +/- de l'équipe | −0,23 | +0,59 | −0,58 |

   **Conséquence de design, et elle est nette : la défensive passe par la
   qualité des lancers, pas par leur nombre.** Une bonne brigade ne réduit pas
   le volume de rondelles dirigées vers son filet ; elle réduit la probabilité
   que chacune entre. C'est cohérent avec ce que le hockey mesuré dit depuis
   quinze ans, et ça tombe bien : la primitive du moteur est justement le
   lancer, donc le curseur se pose exactement là où l'événement se résout.

   **La circularité a été testée, pas supposée.** La cote `d` est bâtie sur le
   +/-, qui dépend des buts que *son* gardien a alloués : un bon gardien gonfle
   la cote défensive de tout son vestiaire, et la corrélation de 0,45
   apparaîtrait même si personne ne défendait. Deux indices que le doute était
   fondé — la brigade (0,450) et les quatre trios (0,452) prédisent le % d'arrêts
   *exactement* aussi bien, alors qu'un vrai signal défensif devrait pencher du
   côté des défenseurs. Le test qui tranche : **le même gardien, d'une saison à
   l'autre**, comparé à sa propre moyenne de carrière corrigée de l'époque, sur
   312 gardiens à trois saisons et plus. Le signal survit à **+0,23**. Il est
   donc réel, et à peu près moitié moins fort que la corrélation brute.

   Les deux constantes que le moteur portera :

   ```
   VOLUME    lancers = base × possession^0,150
             la brigade n'y entre pas : 0,3 % par écart-type

   QUALITÉ   P(but) = %tir_du_tireur × facteur_gardien × (1 − K × z_def_adverse)
             K entre 0,029 et 0,050
   ```

   `K` est encadré plutôt que fixé, et les deux bornes sont des mesures, pas des
   marges de sécurité : la borne basse (2,9 millièmes d'arrêts par écart-type)
   vient du test contrôlé par gardien, qui efface au passage l'équipe qui suit
   son gardien d'un club à l'autre, donc elle sous-estime ; la borne haute
   (5,0 millièmes) ne contrôle rien, donc elle contient le gardien qui gonfle
   son vestiaire. Le vrai chiffre est entre les deux, et c'est l'étape 5 qui
   choisira où, sur le seul critère qui compte : la monotonie et le réalisme du
   plafond.

   **Ce que ça change pour le joueur.** Signer une brigade défensive reste
   payant, mais ça ne se voit pas dans les lancers concédés — ça se voit dans le
   pourcentage d'arrêts de ton gardien. Un écart-type d'alignement défensif vaut
   de 3 à 5 millièmes d'arrêts, soit environ 0,08 à 0,14 but par match. Sur 82
   matchs, entre 7 et 12 buts. Et l'effet est **multiplicatif avec le gardien** :
   la même brigade rapporte davantage devant un gardien qui voit beaucoup de
   rondelles.

   **Un piège de mesure de plus, et il est gros.** Écarter les joueurs échangés,
   comme le fait la maquette du moteur, est catastrophique ici : retirer un
   *gardien* échangé retire d'un coup tous les lancers contre de son équipe, et
   l'écart entre la meilleure et la pire défensive explose à **185 %** au lieu
   des 56 % réels. Ce script répartit donc les totaux d'un joueur également
   entre ses `k` équipes — faux dans le détail, sans biais systématique, et
   chaque équipe reste complète.

   **Trois pièges de mesure, trouvés en bâtissant la maquette.** Chacun donnait
   un écart qu'on aurait pris pour un défaut du modèle :

   - **Les joueurs échangés sont comptés deux fois.** Un `x:1` porte ses totaux
     de saison complète dans *chaque* équipe. Sommer par équipe gonfle les
     lancers de **43 % en 1995-96** et de 14,5 % en 2023-24. Les écarter des
     deux côtés fausse en sens inverse, parce que les patineurs sont échangés
     souvent et les gardiens presque jamais : l'identité de ligue (lancers pour
     = lancers contre) donne le facteur de correction.
   - **Un nombre impair d'équipes.** Une équipe chôme à chaque ronde, donc
     chacune joue moins de 82 matchs : **−3,1 % de volume à 29 équipes**, −0,2 %
     à 32. Il faut proratiser sur les matchs réellement joués.
   - **Ne faire jouer que les partants.** Un partant arrête **4,7 à 7,1
     millièmes** de mieux que la moyenne de sa ligue, parce que les auxiliaires
     la tirent vers le bas. Sous-produisait les buts de 4 %.
4. **Refondre `playGame`. Fait.** `simulateLeague`, `playSeries` et l'interface
   n'ont pas bougé : seul le contenu d'un match a changé. Les quatre égalités
   se ferment sur les 1312 matchs d'une ligue (`check_feuilles.mjs`), et les
   repères d'époque retombent sur le réel — 28,4 lancers et 3,1 buts par
   équipe par match.

   **Deux choses ont dû être mesurées avant que le moteur tienne debout.**

   - **Normaliser sur l'ÉQUIPE moyenne, pas sur le joueur moyen.** Un
     alignement retient les 18 meilleurs patineurs d'un club et son gardien
     numéro un : mesuré, ils tirent **27 % de plus** que le régulier moyen de
     la ligue, finissent 2 % mieux et arrêtent 10 % de plus. Normaliser sur le
     joueur moyen mettait l'équipe médiane à **60 victoires**. D'où `REF`, les
     quatre nombres de `check_neutre.mjs` ; tout le moteur s'exprime en écart
     à eux, si bien qu'un match entre deux équipes de référence produit
     exactement `LANCERS_BASE` lancers.
   - **Un banc synthétique ne peut plus servir de calibration.** L'ancienne
     table alignait 23 joueurs inventés `{o:r, d:r, …}`. Le moteur se nourrit
     des vraies statistiques, que ces joueurs n'ont pas : ils jouaient comme
     23 rappels de la ligue mineure quelle que soit leur cote. La table tire
     maintenant de vrais joueurs-saisons du calibre voulu.

   Résultat sur `check_monotonie.mjs`, le test qui fait autorité — les
   victoires simulées suivent maintenant le réel décile par décile :

   | décile | simulé | réel |
   |---|---|---|
   | 1 | 28,6 | 27,1 |
   | 5 | 42,0 | 43,2 |
   | 10 | 52,1 | 56,2 |

   **Ce qui reste en travers.** Les totaux individuels ont un biais de −15 % et
   une erreur moyenne de 34 % par joueur. Mesuré, 26 points de cette erreur
   sont du **bruit de tirage irréductible** — une saison de 82 matchs est un
   tirage, et un marqueur de 30 buts a un écart-type de 18 % même si le moteur
   est parfait. Reste ~22 % de systématique, qui vient de la place : le moteur
   décide de l'utilisation d'un joueur par son rang dans l'alignement, pas par
   son vrai temps de glace. Le biais de −15 %, lui, est correct plutôt que
   fautif — dix-huit joueurs qui gardaient chacun son vrai volume de tirs
   dépasseraient les 29 lancers d'équipe. On ne peut pas aligner dix-huit
   premiers trios et les faire tous tirer autant.
5. **Refaire la calibration. Fait.** Table par palier et repères du plafond
   remis à jour dans `CLAUDE.md`. `SYN_ECHELLE` est la seule constante libre du
   moteur ; réglée à 50, le meilleur alignement légal atteint 63,5 victoires
   contre 62,7 au Canadien de 1976-77 — la parité avec le sommet historique,
   qui est exactement la cible.
6. **Remesurer les chances de Coupe. Fait, et le trou est bouché.** Le meilleur
   alignement légal la gagne **40 %** du temps, le Canadien de 1976-77 **60 %**
   (40 ligues chacun, `check_plafond.mjs`). L'ancien moteur la donnait à 99 %
   dès le niveau 80. Deux causes, et aucune n'a demandé de variance inventée :
   les blessures et l'usure s'appliquent maintenant **aussi en séries**, et le
   malus de zone empêche l'alignement du joueur de dominer tout le champ.

   **Attention au bruit sur cette mesure-là.** Une Coupe est un événement
   composé de quatre séries : à 6 ligues j'ai lu 33 %, à 16 ligues 38 %, à 16
   autres 75 %. Il faut au moins 40 ligues pour que le chiffre veuille dire
   quelque chose, et il reste à ±8 points. Ne conclus rien d'un `ESSAIS=6`.
7. **Les traits. Fait**, et la règle qui les gouverne s'est révélée plus
   tranchante que la section 5.4 ne l'annonçait : **un trait n'existe que là
   où le sommaire est aveugle.**

   La section 5.4 proposait trois étages, en commençant par les traits
   « factuels » tirés de l'API — bagarreur, homme de fer, spécialiste des
   mises au jeu, cogneur. À l'implémentation, aucun ne survit :

   - **Homme de fer** recompte `gpShare`, que `injuryChance` lit déjà. Un
     joueur à 82 matchs a déjà la probabilité de blessure la plus basse du
     moteur. Le trait n'ajoute rien.
   - **Spécialiste des mises au jeu** (1997-98+) et **cogneur** (2005-06+)
     n'existent pas avant leur saison de collecte. Les accorder, c'est donner
     aux modernes un levier que 1975 ne peut pas avoir — l'invariant d'équité
     entre époques dit non.
   - **Bagarreur** se lit dans `pim`, déjà dans la cote de robustesse.

   Restent les **votés**, et ils sont exactement ce qui manque : le sommaire
   ne dit pas qui défendait vraiment, quel gardien tenait vraiment son
   équipe, qui se transformait en avril. Quatre traits, un type d'événement
   chacun, tous depuis `data/trophees.js` :

   | trait | effet | quand |
   |---|---|---|
   | Selke | moins de buts alloués pendant ses présences | toujours |
   | Norris | idem, pour un défenseur | toujours |
   | Vezina | facteur sur chaque lancer qu'il voit | toujours |
   | Conn Smythe | bonus offensif, ou un gardien plus dur à battre | **séries seulement** |

   **Mesuré** (`scripts/check_traits.mjs`) : **1,02 %** des 36 820
   joueurs-saisons portent un trait, aucune saison n'en est dépourvue, et une
   vraie équipe qui en porte trois ou quatre alloue **10,3 buts de moins** et
   gagne 1,3 match de plus que la même équipe rejouée sans. Visible, jamais
   décisif à soi seul.

   **Une structure a dû changer pour que les traits aient où mordre : la
   défense se joue maintenant présence par présence.** Le moteur tirait la
   qualité défensive de la MOYENNE d'équipe, si bien qu'un quatrième trio
   poreux ne coûtait rien pendant ses propres treize minutes, et qu'un Selke
   ne défendait pas plus quand il était sur la glace. L'unité défensive
   adverse est désormais tirée à chaque lancer, au prorata de son temps de
   glace **seul** — une unité ne défend pas plus souvent parce qu'elle
   attaque plus. Le −1 du +/- va donc aux joueurs qui étaient vraiment là.

   **Pourquoi les traits agissent en propre et non par la cote `d`.**
   `K_DEFENSE` est mesuré à 0,04 par écart-type, donc un point de cote
   défensive vaut moins d'un pour cent de probabilité de but : un Selke qui
   passerait par sa cote sauverait un but par saison. C'est précisément
   l'aveu du sommaire — le +/- ne voit pas ce que le vote voit.

   **Deux limites d'époque, assumées.** Le Selke naît en 1977-78 : sept
   saisons n'ont aucun attaquant défensif décoré, et le vote n'ayant pas eu
   lieu, rien ne peut le corriger. Et le Vezina d'avant 1981-82 n'était pas un
   vote — il allait aux gardiens du club ayant alloué le moins de buts, ce qui
   récompense la brigade autant que le gardien, et le moteur mesure déjà cette
   brigade. Ces onze saisons sont écartées du trait.

---

## 9. Ce que la refonte ne réglera pas

Honnêtement, pour que personne n'attende ça d'elle :

- **Les mises en échec avant 2005-06 n'existent pas.** L'API renvoie `0`, pas
  `null` — un piège : un build naïf conclurait que personne ne frappait avant
  2006. Cam Neely restera un franc-tireur plutôt qu'un attaquant de puissance.
- **Le temps de glace réel n'existe pas avant 1997-98.** Les parts de temps de
  glace par unité restent donc un modèle, pas une mesure, sur la moitié des
  saisons.
- **La défensive individuelle reste approximée, et l'étape 3 l'a confirmé plus
  durement que prévu.** On croyait gagner une cible d'équipe — les lancers contre
  — et elle ne répond pas à l'alignement (corrélation −0,17). Ce qui répond, la
  qualité des lancers concédés, ne se sépare pas proprement du gardien : d'où un
  `K` encadré entre 0,029 et 0,050 plutôt que mesuré. Et le signal ne distingue
  pas les défenseurs des attaquants (0,450 contre 0,452) — il mesure la qualité
  du vestiaire, pas celle de la brigade. Le +/- reste le seul signal individuel
  d'avant 1998, avec ses défauts connus : asymétrique (le malus vaut six fois le
  bonus, mesuré) et dépendant du vestiaire (lissé à `LISSAGE_EQUIPE`).
- **`sp` n'est pas de la vitesse.** C'est du temps de glace et du volume de tirs :
  mesuré, Chára sort plus « rapide » que Gaudreau. Le champ n'est lu par aucune
  formule de simulation. À retirer de la carte des patineurs ou à renommer pour ce
  qu'il est.
