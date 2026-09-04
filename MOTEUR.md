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
| `s%` pourcentage de tir | `skater/summary.shootingPct` | probabilité qu'un lancer devienne un but |
| `sa` lancers contre du gardien | `goalie/summary.shotsAgainst` | calibrer la suppression de lancers |
| `sv` arrêts du gardien | `goalie/summary.saves` | déjà là sous forme de % |
| `a1` / `a2` passes 1re / 2e | rapports `powerplay` / `penaltykill` | attribuer les passes |

C'est de l'**étage 1** : ces champs viennent des stats brutes, donc il faut un
build complet par l'Action (`full`), pas un `--rerate`. C'est le seul prérequis
bloquant de toute la refonte, et il est petit.

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
par sa part de temps de glace. La **suppression** vient du corps de défenseurs et
des attaquants, et — c'est nouveau — elle a enfin une cible objective à laquelle
se caler : les lancers contre réels de chaque équipe, disponibles depuis 1970-71,
avec un écart de 18 à 30 % entre la meilleure et la pire équipe de chaque saison.

**C'est la première fois que la défensive a une mesure à viser.** Jusqu'ici on
n'avait que le +/-, qui est une différence et pas un volume. Cette cible-là est
un vrai volume, mesuré, par équipe, toutes époques.

### 4.3 Qui tire

Chaque lancer de l'équipe est attribué à un joueur sur la glace, au prorata de
ses lancers par minute. Un franc-tireur au premier trio tire beaucoup ; le même
gars au quatrième tire deux fois moins. Aucune règle spéciale n'est nécessaire —
ça tombe tout seul du temps de glace.

### 4.4 But ou arrêt

```
P(but) = %tir_du_tireur × ajustement_epoque ÷ qualite_du_gardien
```

Le gardien passe donc sur **chaque** lancer. Avec ~28 lancers par match, deux
points de pourcentage d'arrêts valent environ **0,6 but par match**. Le gardien
devient le levier individuel le plus lourd de l'alignement — ce qui est vrai au
hockey et faux dans le moteur actuel, où il ne pèse que 0,38 d'un terme.

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

| Test | Cible |
|---|---|
| Buts de la ligue par saison | retombe sur `SEASON_GOAL_AVG` réel, toutes les 55 saisons |
| Lancers par équipe par match | ≈ 28, écart entre équipes de 18 à 30 % comme le réel |
| % d'arrêts des gardiens | distribution proche du réel de leur saison |
| Totaux des joueurs sur 82 matchs | ≈ leurs vrais totaux, saison par saison |
| Cohérence de chaque feuille de match | buts = somme des joueurs ; lancers = arrêts + buts ; passes ≤ 2 par but |
| `check_monotonie.mjs` | monotone, dix déciles sur dix |
| `check_ratings.mjs` | corrélation ≈ 0,80 |
| Chances de Coupe par palier | **à décider** — mais plus 100 % |
| `smoke.mjs` à 390 px | 0 erreur console |

Le contrôle de cohérence des feuilles de match mérite d'être un test permanent :
c'est lui qui attrape les erreurs d'attribution que l'œil ne voit pas.

---

## 8. L'ordre de bataille

1. **Ajouter `sh`, `s%`, `sa`, `a1`, `a2` aux shards.** Étage 1, donc un `full`
   par l'Action. Bloquant pour tout le reste, et petit. Ne casse rien en attendant :
   les champs sont simplement ignorés par le moteur actuel.
2. **Maquette hors ligne du moteur**, sur le modèle de `mock_prod_sim.mjs` :
   générer les feuilles de match de vraies équipes-saisons et comparer aux vrais
   totaux. C'est là qu'on saura si le modèle tient, **avant** de toucher à `sim.js`.
3. **Calibrer la suppression de lancers** contre les lancers contre réels. C'est
   le morceau neuf, et le seul dont je ne peux pas prédire la difficulté.
4. **Refondre `playGame`.** `simulateLeague`, `playSeries` et l'interface ne
   bougent pas : seul le contenu d'un match change.
5. **Refaire la calibration** et le tableau de `CLAUDE.md`, qui sera de nouveau
   périmé — il l'était déjà de 3 à 6 victoires par ligne avant cette session.
6. **Remesurer les chances de Coupe**, et seulement là décider de la variance de
   série.
7. **Les traits**, une fois le moteur stable, parce qu'ils se greffent sur des
   types d'événements qui doivent d'abord exister.

---

## 9. Ce que la refonte ne réglera pas

Honnêtement, pour que personne n'attende ça d'elle :

- **Les mises en échec avant 2005-06 n'existent pas.** L'API renvoie `0`, pas
  `null` — un piège : un build naïf conclurait que personne ne frappait avant
  2006. Cam Neely restera un franc-tireur plutôt qu'un attaquant de puissance.
- **Le temps de glace réel n'existe pas avant 1997-98.** Les parts de temps de
  glace par unité restent donc un modèle, pas une mesure, sur la moitié des
  saisons.
- **La défensive individuelle reste approximée.** On gagne une cible d'équipe
  (les lancers contre), pas une mesure par joueur. Le +/- reste le seul signal
  individuel d'avant 1998, avec ses défauts connus : asymétrique (le malus vaut
  six fois le bonus, mesuré) et dépendant du vestiaire (lissé à `LISSAGE_EQUIPE`).
- **`sp` n'est pas de la vitesse.** C'est du temps de glace et du volume de tirs :
  mesuré, Chára sort plus « rapide » que Gaudreau. Le champ n'est lu par aucune
  formule de simulation. À retirer de la carte des patineurs ou à renommer pour ce
  qu'il est.
