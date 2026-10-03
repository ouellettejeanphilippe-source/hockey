# La refonte : un tronc commun, une voie par coach

*Réflexions pour JP, à valider avant de toucher au moteur. Octobre 2026.*

> JP : *coach, joueurs, stratégies, stats, cartes de match devraient avoir des genre de commun. Exemple : coach meilleur avec certains styles de stratégie et stats, qu'ils synergisent, ou favorise ses trios du bas. Certains events sont seulement pour certains coachs, certains upgrades de joueurs upgradent leurs compagnons de trio. Simplifier traits, positions et rôles, genre sniper bronze argent or platine, intégrer traits et rôles. Des stratégies uniques de gain pour chaque coach, tout en gardant un gros tronc commun pour balancer.*

---

## 1. Ce qui ne va pas aujourd'hui (mesuré dans le code)

**Tout est petit, par contrat.** Une carte de saison « change la forme, pas la force » : chaque bonus est payé par un malus, et `check_cartes` la borne à ±1 victoire. Avec une saison qui varie de ±4,5 victoires d'elle-même, un adjoint à +0,3 victoire ne se sent pas. Les ordres de grandeur :

| Ce qu'on joue | Taille typique | Ce que ça vaut |
|---|---|---|
| Carte de saison | un canal à ±3 à 8 %, payé par un autre | sous 1 victoire, net |
| Adjoint (patron) | 1 à 3,5 % | 0,2 à 0,6 victoire |
| Événement de la banque | 2 à 5 %, 3 à 15 matchs | quelques dixièmes |
| Variante de carte (holo, or) | 3 à 5 % sur un joueur, au hasard du canal | souvent rien (le canal ne va pas avec son rôle) |
| Rôle maîtrisé (un checker d'élite) | −6 % de qualité de tir… divisé par 3 joueurs, pendant 25 % du match | environ −1,7 %, invisible |
| **Confiance d'un coach, III** | 10 à 17 % sur son canal | **+1,9 à +2,4 victoires** (le seul gros levier) |
| Un système mal choisi | — | −2,6 victoires |

**Trois freins dans le moteur :**

1. **Les plafonds mangent les bonus empilés.** La finition de toutes les cartes est coupée à `FINITION_MAX / finition de l'équipe` : une bonne équipe ne prend que +9 %, peu importe combien de cartes de finition elle empile. Le volume est coupé à `PRESSION_MAX`. Le malus, lui, n'est jamais coupé.
2. **Les rôles sont centrés sur la moyenne de la ligue.** Un joueur moyen dans son rôle vaut 0, et l'effet se divise entre les trois joueurs du trio. Le passeur et le manieur ne font rien du tout dans le moteur.
3. **Rien ne parle à rien.** Une carte lit un canal, un rôle en lit un autre, un système un troisième, un trait un quatrième. La couleur d'un coach se devine après coup, à partir des canaux. Il n'y a pas de mot commun.

Deux cartes de synergie du deck de match ne se déclenchent jamais (`murBleu` et `jambes`, sim.js:7546 et 7550). Elles testent des noms de rôles qui n'existent plus depuis S79. À corriger dans tous les cas.

---

## 2. L'idée : un seul mot commun, la couleur

Il y a déjà neuf coachs, et chaque carte en porte déjà la couleur. **La refonte donne une couleur à TOUT** : chaque badge de joueur, chaque système, chaque carte, chaque événement, chaque paquet. Un coach se reconnaît dans tout ce qui porte sa couleur, et le reste du jeu lui parle dans la même langue.

| Coach | Sa stat | Ses badges | Ses systèmes | Sa voie de victoire |
|---|---|---|---|---|
| 🐝 Le Frelon (essaim) | les tirs | Power, Plombier, Offensif (D) | Échec avant, Volume de tirs | **La tempête** : chaque trio lance, même le 4e |
| 🦅 Les Rapaces | la finition | Sniper, Passeur | Surnombre, Jeu de puissance | **Le tueur** : l'avantage numérique et les gros tireurs |
| 🐢 La Tortue | les buts contre | Checker, Défensif (D), Deux sens | Trappe, Bunker | **Le verrou** : en avance après deux périodes, on ferme la porte |
| 🦏 Les Rhinos | la robustesse | Bagarreur, Physique (D), Checker | Échec avant, Rentre-dedans | **L'usure de l'autre** : chaque mise en échec leur coûte des jambes |
| 🌬️ Le Souffle | les jambes, les blessures | Plombier, Deux sens | Quatre trios, Banc profond | **Les jambes fraîches** : au-dessus de 95, un bonus de plus |
| 🎼 Le Chœur | la discipline | Passeur, Manieur (D) | Contrôle, Possession | **Le jeu propre** : chaque punition qu'eux prennent et pas toi rapporte |
| 🪜 La Profondeur | les trios du bas | Plombier, Checker, Deux sens | Banc profond | **Les trios du bas** : les 3e et 4e trios grimpent quand les autres se fatiguent |
| ⭐ Les Étoiles | le 1er trio | Sniper, Passeur, Power | Trois trios, Le héros | **La vedette** : le 1er trio joue plus et rend plus |
| 🏦 Le Comptable | l'argent | aucun | aucun | **Le marché** : des contrats moins chers, plus de jetons, de meilleurs packs |

**Le tronc commun** (la balance), c'est ce qui ne change pas d'un coach à l'autre :
- les mêmes canaux du moteur (finition, défense, volume, discipline, robustesse, blessures, jambes, minutes) ;
- les mêmes badges, avec les mêmes paliers ;
- les mêmes systèmes, mêmes slots ;
- environ 40 % de cartes **neutres**, utiles à tous ;
- un **budget mesuré** par coach : chaque voie construite au complet vaut à peu près pareil (voir § 8).

Ce qui change, c'est **la façon de gagner** : le Frelon gagne en tirant 40 fois, la Tortue en accordant deux buts, les Étoiles avec un 1er trio à 25 points.

---

## 3. Les joueurs : un badge à paliers, au lieu de rôles, traits et positions

### Aujourd'hui
Un joueur a un niveau (Soutien → Phénomène), une zone (T1-2…), une position (C, AG, AD, D) avec des pénalités hors position et d'aile, un rôle principal et des maîtrises de rôle (sur 100, centrées), des traits (Selke, Tir, Colosse, Vitesse…) et une carrure (🪨/🪶). C'est six systèmes à lire pour savoir ce qu'il fait.

### Proposé : LE BADGE
Chaque joueur porte **un badge principal et, au plus, un badge secondaire**, chacun à un palier :

**🥉 Bronze · 🥈 Argent · 🥇 Or · 💎 Platine**

- Le palier vient de **sa vraie saison**, comme le niveau aujourd'hui : son rang à son poste dans sa saison, sur les stats qui font ce rôle. En gros, Platine ≈ le top 3 % de la saison à son poste, Or ≈ le top 15 %, Argent ≈ le top 40 %, Bronze ≈ le reste. Le Rocket Richard de 2009 est Sniper Platine ; un joueur de 4e trio à 80 mises en échec est Checker Argent.
- **Les traits s'y fondent.** Tir → monte le badge Sniper d'un palier ; Selke → Checker ou Deux sens ; Norris → Défensif ; Colosse → Physique/Bagarreur ; Vitesse et Créateur → Passeur ; Meneur → un badge « Capitaine » (voir § 5). Le trait ne disparaît pas de la carte : il devient la raison du palier (« Sniper Or · Tir »).
- **Positions** : *tranché (§ 10)* — on garde le centre, et ses pénalités de côté.
- **La zone** (T1-2…) : *tranché (§ 10)* — elle reste, à côté du badge.

### Ce que fait un badge, sur la glace
Plus de centrage sur la moyenne : **le palier lui-même donne l'effet**, par joueur, pendant ses présences. L'ordre de grandeur visé (à calibrer) :

| Badge | Bronze | Argent | Or | Platine |
|---|---|---|---|---|
| 🎯 Sniper | finition de ses tirs +3 % | +6 % | +9 % | +12 %, et il prend les tirs de l'avantage |
| 🧠 Passeur *(neuf : il ne faisait rien)* | ses compagnons de trio finissent +2 % | +4 % | +6 % | +8 % |
| 🛡️ Checker | qualité des tirs adverses −2 % | −4 % | −6 % | −8 % |
| 🪠 Plombier | ses jambes s'usent −10 % | −20 % | −30 % | −40 % |
| 🥊 Bagarreur | finition adverse −2 % pendant ses présences | −3 % | −4 % | −6 % |
| 🏗️ Power | ses compagnons finissent mieux devant le filet +2 % | +4 % | +6 % | +8 % |
| 🧱 Défensif (D) | comme Checker | | | |
| 💣 Offensif (D) | sa paire lance +4 % | +8 % | +12 % | +16 % |
| 🧭 Manieur (D) *(neuf)* | ses compagnons de paire et de trio créent +2 % | +4 % | +6 % | +8 % |
| 🪨 Physique (D) | mises en échec qui coûtent des jambes à l'adversaire | | | |

Pour que la ligue ne bouge pas (la force d'équipe suit toujours le vrai classement, `check_ratings` autour de 0,8), les tableaux se calibrent comme `MOTEUR.md` le fait : la ligue entière porte des badges, et les constantes se règlent pour que les buts de la ligue restent les vrais. Un badge fort a une **conséquence visible**, mais il ne gonfle pas la ligue.

**Un toucher, un mot** : la case de l'alignement montre `🎯🥇` (Sniper Or) ; la fiche dit « Sniper Or : la finition de ses tirs +9 %, et c'est lui qui tire en avantage ». Plus besoin de lire six choses.

---

## 4. Les systèmes demandent des badges, et le coach aime certains systèmes

Les systèmes gardent leurs slots, mais un slot demande un **badge** (« un Checker ou un Deux sens à l'aile ») plutôt qu'un score de style. Le fit devient :
- slot rempli par le bon badge : son palier compte (Bronze 1, Platine 4) ;
- bon badge en secondaire : la moitié ;
- mauvais badge : 0.

Le **système de la couleur du coach** gagne un palier de confiance : à Confiance II, la Tortue joue la Trappe comme si chaque slot avait un palier de plus. C'est la synergie coach ↔ stratégie que tu décrivais.

---

## 5. Les synergies : ce qui parle à quoi

Toutes passent par les mêmes trois portes, pour rester lisibles :

**a) Par la couleur (le coach).**
- La confiance monte avec les cartes jouées **et** avec les joueurs habillés qui portent un badge de sa couleur. Aujourd'hui c'est plafonné à 5 joueurs et ça compte des têtes. Proposé : ça compte les **paliers** (un Platine compte pour 4), sans plafond fixe, pour récompenser un build qui va au bout.
- Certaines cartes de la couleur grandissent avec ce compte (ça existe déjà : `echelle`, `parJoueur`). Elles deviennent la règle, plus l'exception.

**b) Par le trio (les compagnons).** *Neuf, demandé par toi.*
- Des **modifs de trio** : posées sur un joueur, elles touchent ses compagnons de ligne. « Le mentor » : ses compagnons de trio montent d'un palier dans son badge. « La gâchette » : un Passeur Or rend le Sniper de son trio Platine pour les soirs importants. « Le capitaine » (l'ancien trait Meneur) : tout son trio s'use moins.
- Les trios **assortis** paient : deux badges qui se complètent dans le même trio (Passeur + Sniper, Checker + Bagarreur, Offensif + Défensif) donnent un bonus de chimie. C'est la chimie qui existe déjà, mais elle se lit enfin (« Passeur + Sniper : +6 % de finition »).

**c) Par le match (le deck de combat).**
- Les cartes de match lisent les badges sur la glace : « Le tir sur réception : +4 % de finition par Sniper Or ou mieux dans tes deux premiers trios. » (Ça existe pour `gachettes`, réduit à 2 % ; on le généralise et on le grossit.)
- Les cartes `murBleu` et `jambes` sont réparées et lisent les badges Défensif et Plombier.

---

## 6. Les événements : certains sont pour certains coachs

- Chaque coach a **3 ou 4 événements à lui**, qui n'arrivent que s'il est le tien (ou si sa confiance est allumée). Exemples :
  - 🐢 Tortue : « Le blanchissage » — ton gardien en enchaîne deux ; tu le gardes devant le filet (une chance sur deux qu'il en fasse un troisième, sinon il craque) ou tu le reposes.
  - ⭐ Étoiles : « La vedette veut plus de glace » — ton meilleur pointeur joue 25 minutes pendant cinq matchs, avec un dé pour sa blessure.
  - 🪜 Profondeur : « Le 4e trio a fait la job » — tu le récompenses (il monte d'un palier pour dix matchs) ou tu gardes ta hiérarchie.
  - 🦏 Rhinos : « La bagarre générale » — le dé décide qui finit au vestiaire.
- Les événements neutres restent (la pieuvre, la courbe illégale, le conducteur de surfaceuse…). Ils sont pour tout le monde.
- Tous s'ouvrent **en fenêtre avec le dé** quand il y a un risque. C'est la tâche que je code en ce moment : le dé montre ce que le moteur a tranché, jamais du hasard d'écran.

---

## 7. Les cartes et les paquets, simplifiés

### Aujourd'hui : 311 cartes en sept familles
Cartes de saison (18), adjoints (45), événements de banque (65), consommables (46), modifs (44), contrats (14), cartes de match (93 et leurs « + »).

### Proposé : cinq types, qu'un enfant reconnaît de loin

| Type | Ce que c'est | Combien de temps | Exemples |
|---|---|---|---|
| 👤 **Joueur** | un vrai joueur, sa saison, son badge | la saison (la run) | Rocket Richard 2009, 🎯💎 |
| 🔧 **Modif** | posée sur un joueur ; certaines touchent son trio | la saison | Le mentor, Affûté, Le capitaine |
| 🧑‍💼 **Staff** | un adjoint, un médecin, un comptable — les anciennes cartes de saison, adjoints et contrats | la saison | L'adjoint à la défensive, Le physio |
| ⚔️ **Tactique** | une carte du deck de combat, pour un gros match | un match | Bloquer des tirs, Le héros |
| 🎴 **Coup** | un événement ou un consommable : un effet court, souvent avec un dé | quelques matchs | La vague, Le chandail porte-bonheur |

Chaque carte garde sa couleur (ou est neutre), sa rareté et sa variante. **La variante (holo, or) cesse d'être tirée au hasard** : elle monte le palier de la carte (une Modif holo donne un palier de plus), au lieu d'un bonus de 3 % sur un canal qui ne va pas avec le joueur.

### Les paquets

| Paquet | Contenu | Pour qui |
|---|---|---|
| **Paquet du coach** | 4 cartes de sa couleur, dont 1 joueur à badge de sa couleur | celui qui construit sa voie |
| **Paquet de badges** | 3 modifs, dont 1 modif de trio | celui qui monte ses joueurs |
| **Paquet de combat** | 4 tactiques | celui qui veut gagner ses gros matchs |
| **Paquet de joueurs** (Bronze → Premium) | comme aujourd'hui | tout le monde |
| **Paquet mystère** | n'importe quoi, une chance de Platine | le joueur qui aime le risque |

---

## 8. L'impact : des chiffres qu'on sent, mais un tronc qui tient

**Le budget visé** (à mesurer en paires, comme toujours) :

| Ce qu'on a construit | Aujourd'hui | Visé |
|---|---|---|
| Une carte isolée | ±1 V | jusqu'à ±2 V, et **dite en vrais chiffres** (« +3 buts projetés », mesuré par le moteur comme la prévision) |
| Un coach à Confiance III, sans les joueurs | +1,9 V | +2 V |
| **Un coach à III avec une équipe construite pour lui** | +2,4 V | **+6 à +8 V** |
| Toutes les voies, construites au complet | — | à ±1 V l'une de l'autre |

C'est ce dernier chiffre qui fait le **tronc commun** : aucune voie n'est la bonne, toutes rapportent autant quand on va au bout, et une équipe qui mélange tout rapporte moins. C'est le principe des jeux de cartes : la force vient de la cohérence, pas de la carte.

**Ce que deviennent les gardes-fous :**
- `check_cartes` : la borne passe de ±1 V à ±2 V par carte isolée, toujours en paires. Une nouvelle mesure, `check_voies`, construit chaque voie au complet et exige qu'elles soient à ±1 V l'une de l'autre, et toutes au-dessus d'une équipe mélangée.
- `check_robot` : inchangé. Le robot « premier Signer » ne joue aucune carte, donc la puissance des cartes ne l'aide pas, et il ne gagne toujours pas la Coupe. **Mais** les badges jouent pour tout le monde (l'IA aussi) : ils se calibrent pour que la ligue reste la vraie, et `check_robot` le vérifie.
- `check_gros` : l'adversaire ne pige toujours pas les cartes de la v2 (`horsAdverse`). Sa main reste calibrée, la difficulté ne bouge pas.
- `check_ratings` : la force d'équipe suit toujours le vrai classement (autour de 0,8).
- Les plafonds `FINITION_MAX` et `PRESSION_MAX` se relèvent pour l'équipe du joueur seulement quand une voie les vise (le Frelon a droit à plus de volume, les Rapaces à plus de finition). Sinon une voie construite se cogne au plafond et ne sent rien.
- `VERSION_MOTEUR` s'incrémente ; si une formule de `js/ratings.js` change, `RATINGS_VERSION` aussi.

---

## 9. Ce que ça casse, et dans quel ordre le faire

**Ça casse :**
- **Les sauvegardes en cours.** Une saison se rejoue depuis ses décisions, et le moteur change : une partie en cours ne rejouerait plus pareil. Proposé : les parties en cours finissent sur l'ancien moteur (on garde `VERSION_MOTEUR` dans la sauvegarde), les nouvelles partent sur le nouveau. Le méta (album, club, jetons, prestige) est gardé.
- **La règle ferme « aucune mécanique neuve »** de CLAUDE.md. Les badges à paliers, les modifs de trio et la voie de chaque coach sont des mécaniques neuves. La règle devient : *« une mécanique neuve passe par la couleur et les badges, se mesure en paires, et la refonte l'écrit dans docs/decisions.md »*.

**L'ordre proposé, une PR chacune, chacune mesurée avant la suivante :**
1. **Les badges à paliers** : les rôles et les traits fondus, les positions simplifiées. Calibrer pour que la ligue ne bouge pas. Corriger `murBleu` et `jambes`.
2. **Les systèmes lisent les badges**, et le système de la couleur du coach gagne un palier.
3. **La voie de chaque coach** : sa règle maison, ses plafonds relevés, la confiance comptée en paliers. Nouveau `check_voies`.
4. **Les cartes en cinq types**, les modifs de trio, les variantes qui montent un palier, l'effet dit en vrais chiffres.
5. **Les événements de chaque coach**, en fenêtre avec le dé (le dé lui-même arrive avant, avec la tâche en cours).
6. **Les paquets.**

---

## 10. Les réponses de JP (3 oct.)

1. **Positions** : on **garde le centre** (Centre, Ailier, Défenseur, Gardien).
2. **La zone** : on **la garde** à côté du badge. Le badge dit quoi, la zone dit où.
3. **Neuf coachs** : le Comptable **devient un adjoint** (une carte Staff : rabais, jetons), à combiner avec n'importe quel coach. Huit voies de jeu.
4. **Le budget** : **+6 à +8 victoires** pour une voie construite au complet.
5. **Les sauvegardes** : pas de réponse. Le dépôt a déjà sa règle (`VERSION_MOTEUR`, js/game.js) : une saison en cours se rejoue avec les nouvelles règles, et un toast le dit. On garde cette règle plutôt que deux moteurs.

Et JP ajoute : *t'aurais coach, pis adjoint, qui ont des bonus, pis plus t'avances, plus c'est complexe, mais fort si bien fait*. Le coach est le choix de départ ; ses **adjoints** (Staff) ajoutent chacun un bonus, et ils s'empilent. Plus la run avance (le prestige, les saisons), plus le club ouvre de **places d'adjoint** et de liens entre eux — plus de choses à assortir, donc plus complexe, mais une équipe bien assortie (coach, adjoints, badges, système) monte jusqu'au budget du § 8. C'est l'étape 3.

Puis : *au début, t'as genre 3 coachs seulement, et 2 adjoints possibles, pis ça augmente selon les runs*. Une run neuve offre **trois coachs** au choix et **deux places d'adjoint** ; les autres coachs et les places de plus s'ouvrent d'une run à l'autre (le prestige, `js/rogue.js`), comme les Étoiles et les Phénomènes des packs aujourd'hui.

## 11. Fait

- **Étape 1, les badges à paliers** (oct.) : voir docs/decisions.md, « Les badges à paliers ».
