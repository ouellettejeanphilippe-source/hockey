# L'impact des choix : le mesurer, le rendre sensible, le prouver

Le joueur : *« Je trouve pas que les choix (événements, dilemmes, cartes de saison, cartes de match, cartes en général) ont un assez gros impact, ni un impact clair, même chose pour les stratégies. Plus fort, ça veut pas dire plus gagner : si je fais juste des choix défensifs, ça devrait être un match défensif. Les pourcentages, ça me dit fuck all ce que ça impacte dans le match. Je veux pas tant que ça brise le jeu, mais ça doit être clair que le build que je fais a un impact pour vrai ; sinon, si je le sens pas, ça sert à quoi ? »*

Ce document est une mesure et un plan. Aucun fichier existant n'a été modifié ; tous les scripts de mesure vivent dans le scratchpad (`/tmp/claude-0/-home-user-hockey/0709c4bb-22d7-5b5a-9a62-0d2e725f4488/scratchpad/`, appelé « le scratchpad » plus bas) et se relancent tels quels.

**Ordre de lecture voulu : le ressenti et la clarté d'abord (§1, §5, §6), la mécanique ensuite (§3, §4), le plan par étapes à la fin (§7).** Le plafond de 4 victoires pour une rare ou une légendaire reste un maximum théorique, pas une cible : les amplitudes proposées sont modérées, à peine au-dessus de l'existant.

---

## 0. Le résumé en dix phrases

1. Le moteur a UN seul levier sur le nombre de tirs d'un club : son propre `volume`. La `defense` n'agit que sur la probabilité que les tirs ADVERSES entrent ; elle ne touche ni les tirs pour ni les tirs contre.
2. Pire : baisser son volume fait MONTER les tirs adverses (`ALPHA_POSSESSION`, la possession, −0,15). Un build défensif donne donc moins de tirs pour, un peu PLUS de tirs contre, moins de buts des deux bords : un match où on subit, pas un match fermé. Mesuré : −2,3 tirs pour, +0,5 tir contre.
3. Un style défensif existant (trois cartes de saison défensives) change le rythme du match (tirs des deux clubs) de −1,9 tir sur 56,8 ; l'offensif de +2,7. C'est 3 à 5 % : le joueur ne le voit pas dans la feuille.
4. Le pourcentage des puces (« Précision +3 % ») ne se traduit en rien de lisible. Le seul endroit qui traduit (`avecQuantite`, js/gerant.js) ne le fait que pour les dilemmes, et il ment sur ce qui compte (un −5 % de buts contre dit « ≈ −0,15 but », pas ce que ça fait aux tirs).
5. Médiane d'un événement du jeu : 0,1 tir et 0,04 but par match, 0,03 victoire sur sa durée. Neuf événements sur dix sont invisibles dans la feuille du match.
6. Seuls l'agressivité (mises en échec ±6 à ±10 par match, punitions +0,7 à +1,2) et la discipline (minutes de punition) se voient déjà dans la feuille. Les systèmes de ligne sont nets en victoires (+1,4 à +2,4 V contre « sans système ») mais le « Trappe 1-3-1 » ne change aucun tir, et les tirs bloqués n'existent pas dans le moteur.
7. Modèle minimal proposé (§4) : trois exposants sur des canaux qui existent déjà, rien de neuf comme mécanique. Mesuré sur un prototype : un build « tout défensif » (3 cartes + trappe + paire à la maison + agressivité basse) passe de 28,4 à 23,8 tirs pour et 24,9 tirs contre, de 3,0 à 2,3 et 2,4 buts, à ±1 victoire (le bruit de la mesure) de l'équilibre. Le « tout offensif » : 33,3 / 32,5 tirs, 3,5 / 3,8 buts.
8. Ce que l'écran doit dire est un nombre de match, pas un pourcentage : une fonction pure qui lit le profil réel de CE club CE soir (§5). Elle remplace `motsDesTotaux` sur les écrans de match et double `reglesDe` partout ailleurs.
9. La preuve de l'impact (§6) tient en trois lectures qu'on peut faire avec les feuilles qu'on a déjà : le profil de style des N derniers matchs contre la ligue, « ce que ton build a fait ce soir » après le match, et l'effet en chiffres de match AVANT de choisir.
10. Le plan (§7) commence par ce qui change le ressenti sans toucher au moteur (affichage, preuve), et ne touche le moteur qu'à l'étape 4, avec les constantes centrées pour que la ligue de base ne bouge pas (28,40 → 28,42 tirs, 3,00 → 2,98 buts mesurés).

---

## 1. Ce qu'on a mesuré : le vocabulaire et la méthode

### La méthode (la même que `check_cartes.mjs`, mais sur le PROFIL du match)

`ligues.mjs` (scratchpad) joue la même ligue de 32 vraies équipes trois fois sous la même graine : sans rien, avec l'effet aux équipes paires, avec l'effet aux impaires. Chaque équipe est comparée à elle-même. Trois ligues (graines 1000, 1001, 1002), soit 96 équipes-saisons traitées par configuration. **Le profil d'une équipe traitée est lu seulement contre des adversaires NON traités** (sinon l'effet se mélange à celui de l'adversaire : un match entre deux clubs traités ne mesure rien).

Le profil vient de `t.journal[i].feuille` (la feuille de chaque match, déjà produite par le moteur) :

| colonne du tableau | d'où elle vient dans la feuille |
|---|---|
| tirs pour / contre | `tirsTotal(feuille, cote)` (les tirs au filet : arrêts + buts) |
| rythme | tirs pour + tirs contre |
| buts pour / contre | `j.gf`, `j.ga` |
| punitions | `feuille.punitions` (`cote` = le club puni), nombre par match |
| jeu de puissance | `fin - instant` de chaque punition : minutes en avantage (adversaire puni) et en désavantage |
| mises en échec | `feuille.coups[cote]` : **ATTENDUES** (`coupsAttendus`), pas comptées une à une |
| tirs bloqués | **n'existe pas dans le moteur** (voir §3) |
| victoires | `t.W` sur la saison (± 0,65 V de bruit sur 96 équipes) |

La ligue de base mesure : **28,4 tirs par club et par match, 3,00 buts, 3,8 punitions, 21,8 mises en échec attendues.** (Les 28,5 et 3,1 de MOTEUR.md §4.7, à la précision de la mesure.)

Le bruit de zéro, mesuré avec un effet vide : tirs ±0,07 (pour) et ±0,14 (contre), buts ±0,02, mises en échec ±0,15, victoires ±0,65. Tout écart plus petit est du bruit.

### Ce qu'on a mesuré, et dans quels fichiers

| fichier du scratchpad | quoi |
|---|---|
| `lib.mjs`, `ligues.mjs` | le banc : `paires(payload)` rend l'écart de profil et de victoires |
| `configs.mjs` + `run.mjs` | 69 configurations : grille des canaux, 18 cartes de saison, 11 systèmes, 4 agressivités, 6 styles composés. Résultats : `res_0..3.json` |
| `catalogue.mjs`, `modele.mjs`, `tables.mjs` | tous les choix du jeu réduits à leurs canaux (18 + 135 + 182 + 227 + 45 + 74), puis un modèle de réponse par canal (pente mesurée sur la grille) |
| `rel.mjs`, `fmt.mjs` | les tableaux de ce document |
| `proto/js/sim.js` + `protorun/` | une COPIE du moteur avec le modèle de tempo de §4 (le dépôt n'est pas touché) ; résultats `ta..td_*.json` |

---

## 2. A. L'existant, mesuré

### 2.1 Les canaux, un à la fois (par match, club traité contre non traité)

Lecture directe de la grille (`res_*.json`) à ×1,10 ou ×0,90 du canal ; `modele.mjs` en tire une pente log-linéaire par canal, qui sert aux catégories de §2.6. Base : 28,4 tirs, 3,0 buts.

| canal ×1,10 (ou ×0,9) | tirs pour | tirs contre | buts pour | buts contre | punitions | mises en échec | V/saison |
|---|---|---|---|---|---|---|---|
| `volume` ×1,10 | **+2,2** | −0,3 | +0,23 | −0,04 | 0 | 0 | +1,9 |
| `volume` ×0,90 | **−2,2** | **+0,6** | −0,23 | +0,02 | 0 | 0 | −1,4 |
| `finition` ×1,10 | +0,1 | +0,2 | **+0,30** | −0,05 | 0 | 0 | +2,1 |
| `defense` ×0,90 (moins de buts contre) | 0 | 0 | 0 | **−0,27** | 0 | 0 | +1,8 |
| `defense` ×1,10 | 0 | 0 | 0 | **+0,34** | 0 | 0 | −2,0 |
| `discipline` ×1,30 | −0,7 | **+1,1** | −0,08 | +0,17 | **+0,97** | 0 | −1,3 |
| `discipline` ×0,70 | +0,9 | −0,8 | +0,09 | −0,18 | **−1,10** | 0 | +1,4 |
| `robustesse` +1 | 0 | +0,1 | +0,10 | −0,08 | 0 | 0 | +1,1 |
| `energie` (jambes) ×1,15 | −0,2 | 0 | −0,07 | 0 | 0 | 0 | −0,4 |
| `blessure` ×2 | −0,2 | +0,2 | −0,06 | +0,07 | 0 | 0 | −1,1 |

Lecture, et c'est le cœur du problème :

- **Deux canaux seulement bougent le nombre de tirs : `volume` (les siens) et `discipline` (les tirs contre, par les minutes en désavantage).** La finition, la défensive et la robustesse ne changent AUCUN tir. Ils changent le pourcentage de ceux qui entrent.
- **`volume` ×0,90 donne +0,6 tir CONTRE.** Moins de volume = plus de tirs de l'adversaire (la possession). C'est le contraire d'un match défensif.
- **Aucun canal ne touche les mises en échec**, sauf l'agressivité (par `coupsAttendus`, hors des canaux d'effet) ; aucun ne touche les tirs bloqués (qui n'existent pas).

### 2.2 Les cartes de saison (18), directes, par match d'une saison complète

Direct (`res_*.json`), les 18 cartes aux équipes traitées. Colonnes : écart par match. « Rythme » = tirs pour + tirs contre. Les V sont ± 0,65.

| carte | tirs pour | tirs contre | rythme | buts pour | buts contre | punitions | mises en échec | blessures/saison | V |
|---|---|---|---|---|---|---|---|---|---|
| La chasse | +1,6 | −0,1 | **+1,6** | +0,04 | +0,01 | +0,04 | −0,1 | −0,6 | +0,5 |
| Le jeu ouvert | +1,3 | −0,1 | +1,2 | +0,14 | +0,06 | −0,03 | −0,1 | −0,2 | +0,8 |
| Le système du New Jersey | −1,5 | +0,2 | **−1,2** | −0,14 | −0,17 | −0,03 | −0,2 | −0,2 | +0,3 |
| Le coach des gardiens | −1,0 | +0,3 | −0,7 | −0,12 | −0,09 | 0 | −0,1 | −0,3 | −0,4 |
| L'école de tir | −0,9 | +0,3 | −0,6 | +0,04 | +0,05 | −0,05 | −0,1 | −0,4 | 0 |
| La jeunesse | +0,9 | 0 | +0,9 | −0,02 | +0,12 | −0,01 | −0,3 | +1,2 | −0,9 |
| Les vétérans | −0,7 | +0,3 | −0,4 | +0,05 | −0,06 | −0,01 | 0 | −1,5 | +0,7 |
| La fougue | 0 | +0,7 | +0,7 | +0,10 | +0,14 | **+0,88** | −0,2 | −0,4 | −0,5 |
| Le sang-froid | −0,6 | −0,3 | −0,8 | −0,03 | −0,04 | **−0,56** | −0,1 | −0,4 | −0,1 |
| Le grand jeu | 0 | +0,2 | +0,3 | **+0,28** | **+0,31** | −0,03 | −0,1 | +0,3 | −0,1 |
| Bloc de départ | +0,1 | +0,2 | +0,2 | +0,23 | +0,19 | −0,04 | −0,2 | −0,1 | 0 |
| Le cadenas | +0,3 | 0 | +0,3 | −0,15 | **−0,20** | −0,08 | −0,1 | −0,5 | +0,5 |
| Les défenseurs montent | +0,4 | 0 | +0,4 | +0,13 | +0,12 | 0 | −0,2 | +0,1 | 0 |
| Les durs à cuire | +0,1 | 0 | +0,1 | +0,03 | −0,08 | −0,09 | 0 | −1,4 | +0,9 |
| Roulement court | +0,5 | +0,1 | +0,6 | 0 | 0 | −0,02 | −0,4 | **+4,5** | +0,6 |
| La vague | −0,1 | +0,2 | +0,1 | 0 | +0,03 | −0,04 | −0,4 | **+6,2** | −0,3 |
| L'infirmerie | 0 | +0,1 | +0,1 | +0,05 | −0,03 | −0,09 | +0,1 | **−3,7** | +0,6 |
| Le préparateur physique | −0,3 | +0,1 | −0,2 | −0,04 | +0,01 | −0,12 | 0 | **−2,6** | −0,1 |

- **Écart net maximal : 0,9 V** (La jeunesse, Les durs à cuire). La règle de `check_cartes` (moins d'une victoire) est respectée par les 18, et c'est exactement pourquoi elles sont invisibles.
- **Ce qui bouge le plus dans la feuille : La chasse (+1,6 tir) et le New Jersey (−1,2 de rythme).** 5 % du rythme. En mots de match : une partie sur 28 tirs devient une partie sur 29,6 ; personne ne le voit.
- **« Le cadenas » est un bon exemple du problème.** Il vend « tu alloues moins de buts » : −0,20 but par match, c'est un but de moins tous les cinq matchs. Mais les tirs contre ne bougent pas (0,0) : le joueur voit les mêmes 28 tirs adverses, et un but de moins ne se voit qu'à long terme.
- **La seule carte dont le premier chiffre est de la blessure** (Le roulement court : +4,5 blessures sur la saison ; La vague : +6,2) est la plus visible, mais dans une autre vue que le match.

Les cartes qui font le plus : La chasse, Le jeu ouvert, Le New Jersey (le rythme) ; Le grand jeu, Bloc de départ (les buts des deux bords) ; La fougue et Le sang-froid (les punitions). Celles qui font le moins : **Les durs à cuire, L'école de tir, Les défenseurs montent, Bloc de départ côté tirs** (rien du tout dans la feuille).

### 2.3 Les systèmes de ligne (relatifs à « aucun système », partout, quatre lignes)

La référence est « sans système » parce que l'IA, par défaut, choisit déjà le meilleur système de chaque ligne (`meilleureTactique`) : forcer « Hourra » partout coûte −3,2 V de base. Écarts contre « Hourra ». (`rel.mjs`.)

| système | tirs pour | tirs contre | rythme | buts pour | buts contre | punitions | mises en échec | V |
|---|---|---|---|---|---|---|---|---|
| Volume de tirs (trio) | **+1,2** | −0,3 | +1,0 | +0,26 | −0,13 | −0,02 | 0 | +2,4 |
| Échec avant 2-1-2 | **+1,2** | −0,1 | +1,1 | +0,24 | −0,05 | **+0,11** | 0 | +1,9 |
| Jeu d'enclave | +0,9 | −0,2 | +0,6 | +0,31 | −0,04 | +0,04 | 0 | +2,2 |
| Contre-attaque | +0,8 | −0,1 | +0,7 | +0,33 | −0,05 | 0 | 0 | +2,3 |
| Cycle et possession | +0,3 | 0 | +0,3 | +0,24 | −0,03 | 0 | 0 | +1,5 |
| Trio de plombiers | +0,4 | 0 | +0,4 | +0,22 | −0,03 | **+0,18** | 0 | +1,8 |
| **Trappe 1-3-1** | **0,0** | 0,0 | **0,0** | +0,18 | **−0,05** | 0 | 0 | +1,4 |
| Rester à la maison (paire) | **−0,8** | 0 | −0,8 | −0,08 | −0,07 | 0 | 0 | −0,2 |
| Activer les défenseurs (paire) | +0,3 | −0,2 | +0,1 | +0,05 | −0,02 | −0,09 | 0 | +0,4 |
| Relance rapide (paire) | +0,3 | 0 | +0,3 | +0,05 | −0,05 | −0,04 | 0 | +0,6 |
| Nettoyer l'enclave (paire) | −0,1 | −0,2 | −0,2 | 0 | −0,01 | **+0,21** | 0 | 0 |

- **Le « Trappe 1-3-1 » ne change rien de visible** : 0 tir, −0,05 but contre. Il porte `defense 0.93, volume 0.95` mais le gain est mis à l'échelle du fit de la ligne (`echelleFit`) et se dilue sur la présence ; ce qui reste est un −0,05 but, que la feuille ne montre pas. C'est LE système défensif du jeu.
- **« Rester à la maison » est le seul système à baisser le rythme (−0,8 tir).** Le reste est un système d'attaque.
- Les gains en victoires viennent surtout de l'écart au « sans système » (la chimie) ; ils ne disent rien du style.

### 2.4 L'agressivité (relative à « Moyenne »)

| réglage | tirs pour | tirs contre | punitions pour | punitions contre | mises en échec | V |
|---|---|---|---|---|---|---|
| Basse | +0,3 | −0,6 | **−0,54** | +0,09 | **−8,4** | −0,8 |
| Haute | −0,6 | +0,3 | **+0,72** | +0,04 | **+6,3** | +0,5 |
| Rentre-dedans | −1,0 | +0,7 | **+1,24** | +0,05 | **+10,5** | +0,4 |

**C'est le seul levier qui se voit dans la feuille** : −8 à +10 mises en échec sur 22 (−38 % à +48 %), ±1 punition. Le style physique existe déjà parce que `coupsAttendus` lit l'agressivité.

### 2.5 Les styles composés d'aujourd'hui (tout défensif, tout offensif)

Mesuré direct sur le moteur actuel (3 cartes + une ligne de systèmes) :

| style | tirs pour | tirs contre | buts pour | buts contre | punitions | mises en échec | V |
|---|---|---|---|---|---|---|---|
| Défensif cartes (cadenas + New Jersey + gardiens) | −2,3 | **+0,5** | −0,40 | −0,35 | 0 | 0 | 0 |
| Offensif cartes (grand jeu + ouvert + chasse) | +3,0 | −0,3 | +0,44 | +0,36 | 0 | 0 | +0,4 |
| Défensif systèmes (trappe + maison + agr. basse) | −1,4 | +0,2 | −0,24 | +0,20 | −0,60 | **−9,3** | −2,7 (vs auto) |
| Offensif systèmes (volume + activer + agr. haute) | 0 | +0,5 | −0,10 | +0,10 | +0,6 | **+5,5** | −0,9 |
| Défensif TOUT | **−3,7** | **+0,5** | −0,62 | −0,17 | −0,62 | −9,3 | −3,0 |
| Offensif TOUT | +2,8 | 0 | +0,32 | +0,37 | +0,65 | +5,5 | −0,5 |

**Ce que le joueur vit quand il fait « juste des choix défensifs » : 24,7 tirs pour, 28,9 tirs contre.** Il perd 3,7 tirs, l'adversaire en prend 0,5 de PLUS. Les buts contre baissent de 0,17 seulement parce que la défensive compense. Pour lui, le match est plus pauvre en occasions de son côté et pas plus fermé de l'autre : il ne reconnaît pas un match défensif.

### 2.6 Les autres catégories (réduites à leurs canaux)

Chaque choix du jeu a été réduit à ses canaux (`catalogue.mjs`) puis passé dans un modèle de réponse log-linéaire mesuré sur la grille de §2.1 (`modele.mjs`) ; les effets sur l'adversaire (`adv` des cartes de match) sont retournés comme un miroir. Les victoires de la colonne de droite sont sur la DURÉE RÉELLE du choix. « Visible » : un des effets suivants atteint le seuil, par match, tirs ±1, buts des deux clubs ±0,15, punitions ±0,3, minutes en désavantage ±0,6 ou mises en échec ±2 (`tables.mjs`).

| catégorie | choix avec un canal / total | Δ tirs pour : min · médiane · max (abs.) | Δ rythme (tirs des deux clubs) | Δ buts des deux clubs | Δ victoires sur la durée du choix | visibles |
|---|---|---|---|---|---|---|
| cartes de saison | 18 / 18 | 0,0 · 0,5 · 1,6 | 0,0 · 0,7 · 1,4 | 0,03 · 0,12 · 0,55 | 0,05 · 0,31 · 1,06 | 11 (61 %) |
| événements (135, dont 70 de la vie) | 135 / 135 | 0,0 · **0,1** · 1,2 | 0,0 · 0,1 · 1,0 | 0,00 · **0,04** · 0,23 | 0,00 · **0,03** · 0,34 | **14 (10 %)** |
| dilemmes (182 options) | 163 / 182 | 0,0 · 0,2 · 1,5 | 0,0 · 0,1 · 1,3 | 0,00 · 0,10 · 0,29 | 0,00 · 0,04 · 0,15 | 83 (51 %) |
| cartes de match (227) | 154 / 227 | 0,0 · 0,3 · 3,8 | 0,0 · 0,2 · 3,2 | 0,00 · 0,14 · 0,58 | 0,00 · 0,02 · 0,09 (pour UN match) | 91 (59 %) |
| patrons (45) | 36 / 45 | 0,0 · 0,0 · 0,9 | 0,0 · 0,0 · 0,8 | 0,00 · 0,03 · 0,13 | 0,03 · **0,48** · 1,68 | **0 (0 %)** |
| consommables (74) | 52 / 74 | 0,0 · 0,0 · 0,9 | 0,0 · 0,0 · 0,8 | 0,00 · 0,02 · 0,14 | 0,00 · 0,02 · 0,19 | 6 (12 %) |

**Ceux qui font le plus et le moins** (le plus gros rythme ; le plus de victoires) :

- *Événements* : La rumeur d'échange (+1,0 de rythme), La surfaceuse en panne (−0,8), Le déménagement d'aréna (+0,8) ; pour les victoires, Le dernier droit (0,34 V), Le nom de l'aréna vendu (0,33), Le jeune prodige sous contrat (0,32). Les plus faibles : Le retour au jeu, La une des journaux, La semaine de relâche (zéro). Par rareté : commune 0,017 V (médiane sur 5 matchs), peu commune 0,030 V, rare 0,28 V (12 matchs), maudite 0,09 V.
- *Dilemmes* : « Trop de joueurs sur la glace : garder le rythme rapide » (+1,3 de rythme), « Le tableau blanc effacé : laisser improviser » (+1,2), « Le gardien sort trop tôt » (+1,2) ; plus gros en victoires 0,15 V (« Un film dans ton aréna : accepter »). Zéro : « C'est mon dernier match ici : le renvoyer dans la mêlée », « La ville gronde : contester en public ». 19 options sur 182 n'ont aucun canal (un geste, une carte, du hasard).
- *Cartes de match* (un match) : Le blitz+ (+3,2 de rythme), Tirer de partout+ (+2,8), La nuée+ (+2,6), La glace molle+ (−2,5). Par rareté, l'effet sur la probabilité de gagner CE match : commune 2,3 % médian (max 6,0), peu commune 1,7 % (6,6), rare 3,5 % (8,7), légendaire 5,2 % (7,9). **73 cartes sur 227 n'ont aucun canal de profil** (pioche, élan, dépistage) : normal. **Le rythme médian est de 0,2 tir** : jouer une carte ne se voit presque jamais dans la feuille du soir, seulement dans la probabilité de gagner, qui est elle-même invisible à l'échelle d'un match (l'écart type du différentiel d'un match est de 2,4 buts).
- *Patrons* : le plus fort (La légende derrière le banc) vaut 1,7 V sur la saison, mais **aucun patron ne change le profil du match de façon visible** (0 sur 36). Par rareté : commune 0,34 V médian, peu commune 0,59, rare 0,35, légendaire 1,00.
- *Consommables* : les plus forts sont les gestes (soin, jambes) et non les canaux ; Le C cousu en réserve (0,19 V).

### 2.7 Conclusion A : ce que le joueur ressent

**Styles qui existent déjà dans la feuille :**
1. **Physique / propre** (agressivité) : mises en échec −38 % à +48 %, punitions ±1 par match. Net, lisible, mais pas relié à la force du build (+0,5 V).
2. **Indiscipline** (La fougue, Le sang-froid, la consigne de discipline) : ±0,6 à ±0,9 punition, ±1 à 1,7 minute de désavantage par match.
3. **Volume offensif** (La chasse, Le jeu ouvert, Volume de tirs, Échec avant) : +1,2 à +1,6 tir. Visible, mais petit (4 à 6 %).
4. **L'infirmerie** (Roulement court, La vague, L'infirmerie) : +6 à −4 blessures par saison. Visible ailleurs que dans le match.

**Styles invisibles :**
1. **Le style défensif** : aucun tir de moins chez l'adversaire (+0,5 tir de PLUS), un but de moins tous les 5 matchs au mieux. Le « Trappe 1-3-1 » est nul à l'écran. Un match « défensif » n'existe pas dans la feuille.
2. **Le style offensif à deux sens** (grand jeu, Bloc de départ, Les défenseurs montent) : +0,2 à +0,3 but des deux bords, aucun tir de plus. Un match de 3-3 ressemble à un 3-3.
3. **Tout ce qui est événement, dilemme, patron, consommable, carte de match** : médiane sous 0,2 tir et sous 0,15 but. 90 % des événements, tous les patrons : invisibles.
4. **La qualité de tir** (finition, précision) : ne bouge aucun tir ; on ne la voit qu'à la longue dans les buts. Il n'y a pas de « tir de qualité » dans la feuille.
5. **Les tirs bloqués** : n'existent pas.

Le moteur est calibré pour que les cartes soient honnêtes (moins d'une victoire), et elles le sont. Mais elles le sont en bougeant 3 à 5 % de tout : c'est pourquoi aucune n'a de visage.

---

## 3. B. Pourquoi un choix défensif ne donne pas un match défensif

### 3.1 Ce que fait chaque canal dans le moteur, ligne par ligne

Le nombre de tirs de A au cinq contre cinq est tiré dans `jouerCote` (js/sim.js, ~4514) :

```
attenduBase = LANCERS_BASE × (A.pression / REF.pression)
            × max(0,3, B.pression / REF.pression) ^ −ALPHA_POSSESSION        // −0,150
            × (1 − K_VOLUME_DEF × (B.zDef − REF.zDef))                        // 0,012 par écart type de brigade
tirs FE = poisson(attenduBase × part × FE_TIRS)                               // FE_TIRS = 1,20
```

et `A.pression = borne(pression × cartes.volume, 0,40, REF.pression × PRESSION_MAX)`, `PRESSION_MAX = 1,35`. À cela s'ajoutent les tirs de punitions (`AN_TIRS_MIN` 0,60 par minute × 2 min × le volume de la première unité d'avantage, `DN_TIRS_MIN` 0,09 par minute en désavantage), qui ne dépendent PAS de la pression.

| canal | où il entre | ce qu'il fait réellement |
|---|---|---|
| `volume` | `profilMatch.pression` (× cartes.volume, borné par `PRESSION_MAX` 1,35 et `0,40`), puis `A.pression` dans `jouerCote` | Multiplie les tirs de A au cinq contre cinq. Effet indirect sur B : B tire `(A.pression)^−0,15` : un volume de A de −10 % donne **+1,6 % de tirs à B**. |
| `finition` | `profilMatch.finitionFacteur = min(FINITION_MAX/finEquipe, cartes.finition)`, `FINITION_MAX 1,20` ; × `p` de chaque tir de A | Probabilité d'entrer. Aucun tir de plus ou de moins. Plafonné : le 1,20 mord sur les clubs déjà forts. |
| `defense` | `profilMatch.traitDef = facteurDefensifEquipe × cartes.defense`, lu par `jouerCote` comme `def.traitDef` dans `traits`, multiplié dans `p` des tirs ADVERSES | Probabilité que les tirs de l'adversaire entrent. **Aucun effet sur le nombre de tirs de personne.** |
| `discipline` | `profilMatch.discipline` (× cartes.discipline, borné 0,5 à 1,8) ; Poisson des punitions dans `jouerSoixanteMinutes` | Nombre de punitions de ce club. Chaque punition = 2 minutes d'avantage pour l'adversaire (0,60 tir/min) : plus de tirs adverses, moins de tirs pour. **Le seul canal qui déplace le rythme des deux bords** (et c'est un effet de penalty-kill, pas de style). |
| `blessure` | `injuryChance` | Le risque de blessure. Sens unique (voir CARTES, js/sim.js). Zéro effet sur le profil du soir. |
| `energie` (jambes) | usure des unités (`depenserEnergie`) | Un joueur essoufflé a un cran de moins : fait baisser un peu tout. À ×1,15 : environ −0,1 tir de chaque côté, de l'ordre du bruit. |
| `robustesse` | `traitRob`, `K_ROB` × `intensite` (0,35 chaque soir, 1 les soirs éreintants, plus en séries) | Multiplie `p` des tirs de A et divise celui de B (le `facteurRob`). Aucun tir. |
| `F[]`, `D[]` | `partsDuRoulement` | Déplace qui tire (le quatrième trio tire plus ou moins). La somme est renormalisée : **la pression d'équipe ne bouge pas par construction**. |
| `physique` (système) | `robTac` | Le jeu physique des soirs durs. |
| mises en échec | `coupsAttendus(profil)` : joueurs (`ht` de chaque joueur) × `(0,6 + A.physique)` de l'agressivité de chaque ligne | Un nombre de coups ATTENDUS par match (≈ 17 à 22). Le seul canal : l'agressivité. `robustesse` d'une carte ne l'atteint pas. Les coups coûtent des jambes (`encaisserCoups`). |

Dans `profilMatch`, les systèmes de ligne entrent à trois endroits : `x.poids *= c('volume')` (le volume de l'unité, donc de l'équipe), `x.qualite *= c('finition')`, `x.defTac = c('defense') × (1 − A.def × eff)` (la défensive de l'unité PENDANT SES PRÉSENCES, dans `facteurDef` de `jouerCote`) ; la discipline et la robustesse par `discTac` et `robTac`.

### 3.2 Les trois raisons du manque de style

1. **Aucun canal ne baisse les tirs de l'adversaire.** `defense` agit sur `p`, jamais sur le nombre. Le style « on ferme le jeu » est invisible dans une feuille qui compte des tirs.
2. **Le seul lien entre les tirs des deux clubs est la possession, et il va dans le mauvais sens** pour un style : −0,15 (mesuré sur les ligues : les clubs qui tirent beaucoup en prennent un peu moins). Baisser son volume donne des tirs à l'autre. C'est vrai au niveau des équipes dans la LNH et c'est ce qui rend la force d'équipe mesurable (`check_suppression`, MOTEUR.md §4.2) ; mais ça empêche le moteur de montrer un match fermé.
3. **Les amplitudes sont petites, bornées exprès** (`PRESSION_MAX`, `FINITION_MAX`, la règle < 1 victoire). Une carte qui bouge 5 % bouge 1,4 tir sur 28.

### 3.3 Ce qui manque pour que le style bouge le rythme des DEUX côtés (sans mécanique neuve)

Il manque trois liens, tous entre des canaux qui existent :

1. **Le volume de style de A agit sur les tirs de B, dans le sens du style** (A joue un match rapide, B tire plus ; A joue lent, B tire moins). Exposant `τ` > 0.
2. **La défensive de style de A agit sur les tirs de B** (la trappe étouffe : moins de tirs *et* moins de qualité). Exposant `κ`.
3. **La défensive de style de A agit un peu sur ses PROPRES tirs** (un club qui ferme le jeu lance moins : il ne contre-attaque pas). Exposant `κo`.

Ces trois liens ne s'appliquent qu'à la partie « style » (les cartes, les patrons, les événements, les systèmes, les plans : tout ce qui n'est pas le joueur), JAMAIS à la partie « joueurs » (la pression des joueurs gardée dans `ALPHA_POSSESSION`) : c'est ce qui garde la force d'équipe, la corrélation du classement et les 28,4 / 3,0 de la ligue de base intacts.

---

## 4. Le modèle minimal

### 4.1 L'idée

Séparer, dans le profil, ce qui vient des joueurs de ce qui vient du style :

```
pressionJ = la pression des joueurs seule (avant cartes et systèmes de volume)
styleVol  = (pression / pressionJ) × cartes.volume / REF_STYLE_VOL     // tout le volume de style, centré
styleDef  = mean_presence(x.defTac) × cartes.defense / REF_STYLE_DEF   // toute la défensive de style, centrée

tirsFE(A contre B) = LANCERS_BASE × (A.pression / REF)
                   × (B.pressionJ / REF)^(−ALPHA_POSSESSION)           // la possession : inchangée, joueurs seulement
                   × (1 − K_VOLUME_DEF × zDef_B)
                   × B.styleVol^τ  ×  B.styleDef^κ  ×  A.styleDef^κo   // NOUVEAU : le style de B ferme (ou ouvre) le jeu des deux côtés
```

Aucune cote neuve, aucune mécanique neuve : les trois exposants sont lus sur des quantités que `profilMatch` calcule déjà. `REF_STYLE_VOL = 1,012` et `REF_STYLE_DEF = 0,9705` sont mesurés sur une ligue de base (les systèmes automatiques de l'IA donnent déjà un style moyen à tous les clubs) : à style moyen, tous les facteurs valent 1. Mesuré : base 28,40 → 28,42 tirs, 3,004 → 2,979 buts (`td_*.json`, bruit ±0,07 et ±0,02).

### 4.2 Les amplitudes mesurées (prototype, `proto/js/sim.js`, copie du moteur)

Les trois réglages mesurés, dans le même banc, les mêmes graines :

| réglage | Défensif cartes (tirs pour / contre ; buts pour / contre) | Défensif TOUT | Offensif cartes | Offensif TOUT | V (bruit ±0,65) |
|---|---|---|---|---|---|
| existant | 26,1 / **28,9** ; 2,60 / 2,65 | 24,7 / 28,9 ; 2,4 / 2,8 | 31,4 / 28,1 ; 3,45 / 3,36 | 31,2 / 28,4 ; 3,3 / 3,4 | 0 · −3,0 · +0,4 · −0,5 |
| τ = κ = 0,5, κo = 0 (`ta`) | 26,0 / 25,8 ; 2,55 / 2,42 | 24,8 / 25,0 ; 2,42 / 2,50 | 31,5 / 31,4 ; 3,46 / 3,65 | 31,2 / 32,5 ; 3,3 / 3,8 | +0,9 · −0,5 · −1,0 · −2,5 |
| **τ = κ = κo = 0,5 (`td`)** | **24,7 / 25,8 ; 2,45 / 2,37** | **23,8 / 24,9 ; 2,32 / 2,43** | **33,1 / 31,2 ; 3,63 / 3,70** | **33,3 / 32,5 ; 3,5 / 3,84** | +0,7 · −1,0 · −0,4 · −1,5 |
| τ = κ = 1, κo = 0 (`tb`) | 26,2 / 23,3 ; 2,63 / 2,21 | 24,8 / 22,3 ; 2,4 / 2,2 | 31,3 / 34,9 ; 3,48 / 4,15 | 31,5 / 36,5 ; 3,4 / 4,2 | +3,1 · +1,3 · −3,3 · −4,4 |

Lecture :

- **Le réglage qui garde le mieux la symétrie est τ = κ = κo = 0,5** : les tirs pour et contre bougent de la même quantité (24,7 / 25,8), les buts aussi, et les victoires restent dans le bruit.
- **κo (ses propres tirs) est ce qui rend le style symétrique.** Sans lui (`ta`), le défensif ne perd des tirs que d'un côté.
- **τ = κ = 1 est trop fort et asymétrique** : le défensif gagne 3,1 V (la défensive paie deux fois : moins de buts ET moins de tirs), l'offensif en perd 3,3 à 4,4. Un des deux styles devient le bon choix. C'est le piège à éviter : **« plus fort » ne doit pas vouloir dire « plus gagnant »**. La symétrie de `td` (et la règle `check_cartes` en paires) est ce qui l'assure.
- **Cible demandée (22 tirs, 2,2 buts / 34 tirs, 3,8 buts à force égale) : pas atteinte avec 3 cartes + une ligne de systèmes.** À τ = κ = κo = 0,5 on lit 23,8 / 24,9 tirs (tout défensif) et 33,3 / 32,5 (tout offensif) ; 2,3-2,4 et 3,5-3,8 buts. C'est environ 60 % de la cible. Pour la combler, deux voies, sans mécanique neuve : monter les trois exposants à 0,7 (mesuré seulement à τ = κ = 0,75 sans κo : `tc_*.json`), ou laisser le joueur cumuler plus de sources de style (un patron et deux événements défensifs de plus) ; les deux sont à re-mesurer à l'étape 4 (§7). **Je n'ai pas mesuré τ = κ = κo = 0,7 ni le « tout défensif » à cinq ou six sources.**

### 4.3 L'effet sur chaque canal, après le modèle (τ = κ = κo = 0,5)

| canal | avant (par ×0,90) | après (τ = κ = 0,5 ; mesuré à κo = 0, `ta_*.json`) |
|---|---|---|
| `volume` ×0,90 | −2,2 tirs pour, **+0,6** tirs contre | **−2,2 pour, −1,1 contre** (par `styleVol^τ` : le style lent ralentit les deux) |
| `defense` ×0,90 | 0 tir ; −0,27 but contre | 0 tir pour (avec κo = 0,5 elle en perdrait aussi, non mesuré seul), **−1,2 tir contre**, −0,39 but contre |
| `finition`, `robustesse`, `energie`, `blessure`, `F[]`, `D[]` | inchangés | inchangés |

(Les canaux ne sont pas rejoués à κo = 0,5 : seuls les cartes et les styles de §4.2 le sont, `td_*.json`.)

### 4.4 Les mises en échec et les tirs bloqués

- **Les mises en échec** : le seul canal est l'agressivité. Pour que les cartes « on frappe tout ce qui bouge » et le canal `robustesse` donnent des coups, brancher `coupsAttendus` sur `robustesse` : `× exp(0,12 × effets.robustesse)`. Ça n'a pas de conséquence sur les buts (les coups ne font que coûter des jambes), mais : `encaisserCoups` use les jambes ; il faut re-mesurer `check_jambes` (voir §7, étape 5). **Non mesuré.**
- **Les tirs bloqués** : le moteur ne compte que des tirs AU FILET (`lancers` = arrêts + buts). Il n'y a ni tentative ni blocage. Deux voies honnêtes : (a) ne pas promettre le mot (« tirs bloqués » n'est pas un chiffre du jeu) ; (b) le DÉFINIR comme un chiffre dérivé d'affichage : `blocs = tirs_contre_évités`, la différence entre les tirs que l'adversaire aurait pris sans ton `styleDef` et ceux qu'il prend, qui est un compteur réel de la feuille quand `κ > 0`. **Je recommande (b) seulement après l'étape 4, jamais avant** : avant, c'est un chiffre inventé. Ça respecte « aucune cote » et « on ne décerne que ce que les colonnes décident ».

### 4.5 Le jeu de puissance

La durée moyenne du jeu de puissance dépend de `discipline` (le nombre de punitions) et du but qui l'ferme (`arretAuBut`). Les minutes d'avantage et de désavantage sont déjà dans la feuille (`punitions[i].fin - instant`) ; mesuré : `discipline` ×1,30 donne +0,97 punition et +1,7 minute de désavantage par match. À montrer comme « minutes à quatre contre cinq par match », sans rien changer au moteur.

---

## 5. C. L'affichage : l'effet en chiffres de match

### 5.1 Le problème, dans le code

- `motsDEffet(e, duree)` (js/sim.js ~6687) n'a aucun contexte d'équipe : il ne peut dire que « Tirs +6 % ». Il est appelé à partir de `reglesDe` (js/banque.js 582-630), de `regleDeCarte` (js/gerant.js 1219+), de l'écran des dilemmes (gerant.js 312), des puces d'agressivité (gerant.js 987, 1112) et de l'inventaire (gerant.js 805-816).
- `avecQuantite` (gerant.js 56-67) fait déjà un début de traduction (« Tirs +7 % ≈ +2,1 tirs par match »), mais seulement aux dilemmes, avec `Δ = (v − 1) × base × part`. Ça ne dit rien du style (pas d'effet sur les tirs de l'adversaire), ne prend ni les bornes ni les systèmes, et il n'y a pas de test qui prouve que ça reste vrai.
- `motsDesTotaux(totauxDuSoir(...))` (saison.js 2724, 2827, 3780) dit « Ce soir : Tirs +14 % · Précision −3 % », en pourcentage.

### 5.2 La fonction pure

Nouveau module `js/impact.js` (pur, aucun DOM, aucun `hasard()`, importable par Node) :

```js
/** Ce que le soir d'un club vaut en nombres de match, avec ou sans un effet. */
export function chiffresDuSoir(team, lineup, adv, aVenir = [])            // → { tirsPour, tirsContre, rythme, butsPour, butsContre,
                                                                          //     punitions, minutesDesavantage, minutesAvantage, coups }
/** Un effet, dit en chiffres de match pour CE club, CE soir. */
export function effetEnChiffres(effet, team, lineup, adv)                 // → [{ txt: '≈ +2,1 tirs par match', bon: true, cle: 'tirsPour' }, …]
/** Le même, sur une durée : « ≈ −0,3 but accordé par match, pendant 6 matchs ». */
export function effetEnChiffresSurLaDuree(effet, duree, team, lineup, adv)
```

**Le calcul** (le MÊME que le moteur) : un seul endroit dit combien de tirs un club prend. On sort de `jouerCote` une fonction pure `attenduDeCote(off, def, st)` (aujourd'hui, c'est le début de `jouerCote`, lignes 4514-4518) et le moteur ET `chiffresDuSoir` l'appellent. Les nombres affichés sont donc EXACTEMENT les moyennes du moteur :

- tirs pour = `Σ attenduDeCote(pA, pB, FE) + Σ tirs d'avantage − …` (espérances de Poisson, explicites) ;
- punitions = `occasions × discipline` (explicite) ; minutes = punitions × durée moyenne d'un avantage (fenêtre de 2 min, raccourcie par le but ; sa moyenne reste à mesurer, la feuille la donne : `fin - instant`) ;
- mises en échec = `coupsAttendus` (déjà une espérance) ;
- buts = tirs × `E[p]` où `E[p]` est la probabilité de but moyenne d'un tir. Pas de forme close commode (le tireur, les défenseurs apparies) : on l'échantillonne SANS tirer de résultat, par `avecHasardIsole(graine fixe)` : 400 tirages de (unité, tireur, défenseurs) dont on moyenne `p` (pas de Bernoulli, pas de Poisson). Variance ≈ 1 %, aucun appel au hasard du match (`avecHasardIsole` existe déjà : le pronostic le fait). Cache par (club, alignement, effets du jour). **Non mesuré** ; la voie « jouer 300 matchs avec et sans » a été mesurée trop bruitée (écart type ±0,15 tir, ±0,04 but pour 600 matchs en CRN) pour afficher un chiffre au dixième.

**Comment elle reste vraie.** `check_totaux.mjs` prouve aujourd'hui que le total annoncé égale le rapport des profils du moteur, canal par canal (« 2. le total affiché est celui que le moteur joue »). On ajoute `check_chiffres.mjs`, même gabarit :

1. `chiffresDuSoir` égale, à 1 % près, la moyenne de 4 000 matchs joués (tirs, punitions, coups) pour 6 clubs ;
2. `effetEnChiffres(e)` égale l'écart mesuré en paires (le banc de ce document : `paires()`) à ±0,15 tir et ±0,03 but pour une grille d'effets (les 69 configurations de `configs.mjs` sont déjà la liste) ;
3. lire les chiffres ne change pas une journée (même assertion que check_totaux 5).

### 5.3 Ce que les mots disent

| aujourd'hui | demain |
|---|---|
| Tirs +6 % · Buts contre −5 % | **≈ +1,7 tirs par match (29,9) · ≈ −0,15 but accordé par match** |
| Précision +8 % · Buts contre +7 % (Bloc de départ) | ≈ +0,23 but marqué et ≈ +0,19 but accordé par match : **des matchs de 3,2-3,2 au lieu de 3,0-3,0** |
| Punitions +25 % | ≈ +0,9 punition par match, ≈ +1,7 minute à quatre contre cinq |
| Le cadenas (Buts contre −6 %, Précision −5,5 %) | ≈ **−0,20 but accordé** et **−0,15 but marqué** par match ; **1 but accordé de moins tous les 5 matchs** ; tirs : inchangés |

Règles de l'écran :

- **Une seule ligne par effet, les chiffres d'abord.** « ≈ +1,7 tirs par match » avec le mot « par match » toujours.
- Les nombres sous 0,1 se disent en rareté : « ≈ 1 but de moins tous les 8 matchs ». Sous 0,03 but et 0,3 tir : « à peine perceptible » (c'est vrai, c'est dit).
- **Le rythme est un mot** : `Match fermé` (< 52 tirs des deux clubs), `Match normal` (52-60), `Match ouvert` (> 60), ET le nombre : « ≈ 49 tirs en tout ».
- Pas de pourcentage dans une puce, nulle part, sauf la page des règles (qui doit encore dire d'où vient chaque chiffre).
- La couleur : vert si ça aide à gagner, rouge si ça coûte ; **gris si c'est un style** (le rythme, les punitions, les coups : ni bon ni mauvais en soi).
- **Pas de « Précision » ni de « Buts contre » à l'écran** : « ≈ +0,24 but marqué ». « Précision » veut déjà dire trois choses.

### 5.4 Où ça se branche

| lieu | fichier | quoi |
|---|---|---|
| puces d'un effet en général | `motsDEffet` (js/sim.js 6687) | **ne change pas** (reste sans contexte, sert à la sauvegarde et aux tests) ; devient le repli quand le contexte manque |
| catalogue d'une carte (« Patrons », « Cartes de saison », « Événements », « Consommables ») | `reglesDe(id)` (js/banque.js 582) | prend un `ctx` optionnel `{ team, lineup, adv }` ; sans club (le catalogue hors partie), utilise le **profil moyen de la ligue** (28,4 tirs, 3,0 buts) et le dit : « pour un club moyen » |
| avant de choisir un dilemme, un événement, une carte de palier | `gerant.js` 312 (`avecQuantite`) | `avecQuantite` est REMPLACÉ par `effetEnChiffres` ; le pari se dit par ses deux issues chiffrées |
| cartes de match jouables | `regleDeCarte` (gerant.js 1219) | une ligne de chiffres sous la règle : « ≈ +1,1 tir, ≈ +0,07 but pour toi · ≈ −0,3 punition chez eux » |
| totaux du soir, « Préparer le match » | `motsDesTotaux` (saison.js 2724, 2827, 3780) | `totauxDuSoir` reste (le pourcentage brut est utile au test) ; l'écran lit `chiffresDuSoir` |
| agressivité et systèmes | gerant.js 987, 1112 | « ≈ +6 mises en échec, ≈ +0,7 punition par match » (mesuré ci-dessus : +6,3 / +0,72) |
| dépistage d'avant-match | `js/pronostic.js` | la même ligne : « Eux : ≈ 25 tirs, ≈ 2,3 buts par match avec ce plan » |
| gros matchs (entracte, main) | `js/entracte.js`, `js/combat.js` | l'effet de la carte en chiffres de match avant de la jouer |

---

## 6. La preuve de l'impact : comment le joueur VOIT que son build a joué

Les trois lectures sont dans cet ordre de risque : aucune ne touche le moteur ; toutes s'appuient sur des données que la feuille porte déjà.

### 6.1 (a) Le profil de style de ton club sur les N derniers matchs, contre la ligue

**Données disponibles** : `team.journal[i].feuille` (tirs par période, `punitions` avec instant et fin, `coups`, buts) pour CHAQUE match de CHAQUE équipe de la ligue (mesuré : le banc de ce document les lit toutes). La moyenne de la ligue se calcule sur les 31 autres clubs.

**L'écran** (dans l'onglet Club ou la fiche de saison, une ligne, jamais un tableau) :

```
Ton style · 10 derniers matchs                   toi     ligue
Tirs pour / contre                               24 / 25    28 / 28
Buts pour / contre                               2,3 / 2,4  3,0 / 3,0
Punitions                                        2,6        3,8
Mises en échec (attendues)                       24         22
Rythme (tirs des deux clubs)                     49         56      Match fermé
```

Un mot de style tiré de ces chiffres, pas d'un vote : `Défensif` si le rythme est sous la ligue de 5 tirs et les buts sous elle de 0,4 ; `Offensif` à l'inverse ; `Physique` si les mises en échec sont à +4 ; `Indiscipliné` si les punitions sont à +1. (Le mot existe déjà dans `STYLES` du moteur pour l'IA, `poserStyles` ; on l'étend à ta mesure, il ne devient pas une cote.)

**Pourquoi c'est une preuve.** Si tu as bâti un club défensif et que l'écran dit « ton rythme : 49 contre 56 pour la ligue », le build a un visage. Sans la modification du moteur (§4), l'écran dirait : « tirs pour 25, tirs contre 29 » : il dirait la vérité (tu perds des tirs) et ça rendrait le défaut visible. C'est pour ça que cette lecture vient AVANT l'étape 4 (§7), pas après : elle prouve que le moteur ne donne pas de match défensif.

### 6.2 (b) « Ce que ton build a fait ce soir »

Après le match (bilan, juste sous le pointage). Chaque carte, patron, système et événement actif est un nom ; l'écart du profil du soir se dit en chiffres de match, contre ta moyenne et contre la ligue :

```
Ce que ton build a fait ce soir
  🧊 Trappe, 🔒 Le cadenas, 🧱 New Jersey en action
  Tirs contre : 22   (ta moyenne 25 · ligue 28)       ≈ −2,4 de moins que sans ton build
  Tirs pour   : 24   (ta moyenne 24 · ligue 28)       ≈ −2,1 de moins que sans ton build
  Mises en échec : 31 (ta moyenne 24)   ← l'agressivité Haute
  Punitions : 2      (ta moyenne 2,6)
  Rythme du match : 46 tirs en tout — un match fermé
```

La partie « ≈ de moins que sans ton build » est `chiffresDuSoir(avec) − chiffresDuSoir(sans)` (§5) : c'est une espérance, pas ce qui s'est passé ce soir, et elle est dite comme telle (« ≈ »). La partie « ce qui s'est passé » est la feuille réelle du match : un chiffre juste, pas une cote. **Si le soir n'a pas ressemblé au build** (le gardien adverse a volé le match), l'écran le dit : « Ton build visait 24 tirs, il en est venu 31 : la soirée a débordé ».

**Données déjà là** : `feuille.tirs`, `feuille.punitions`, `feuille.coups` (attendues), les alignements du soir (`alignes`), les effets actifs (`effetsActifs(team)`, `team.cartes`, `team.patrons`, `lignesDe`). Rien à stocker : une saison se REJOUE (`check_graine`), donc la lecture se refait de la graine.

### 6.3 (c) L'effet chiffré AVANT de choisir

C'est §5 : à l'écran d'une carte de palier, d'un événement, d'un dilemme, d'une carte de match, les puces sont des nombres de match pour CE club CE soir, et le style se lit sous elles :

```
🔒 Le cadenas
   ≈ −0,20 but accordé par match · ≈ −0,15 but marqué par match
   Tirs : inchangés — c'est un style plus patient, pas plus fermé
   Sur les 62 matchs qui restent : ≈ −12 buts accordés, ≈ +0,4 victoire
```

La dernière ligne vient de `effetEnChiffresSurLaDuree` et de la pente victoires/buts mesurée plus haut (0,14 V par but de différentiel, 7 buts par victoire). **Elle dit les victoires en dernier**, après le style, parce que c'est la phrase du joueur : *plus fort, ça veut pas dire plus gagner*.

---

## 7. D. Le plan de mise en œuvre

Chaque étape a un script qui la prouve, ses risques, et ne commence que quand la précédente tient. Ordre : du ressenti qui coûte le moins de risque jusqu'à la calibration.

### Étape 0. Faire de la mesure un script du dépôt (zéro risque)

- Ajouter `scripts/check_impact.mjs` : le banc `ligues.mjs` + `paires()` du scratchpad, via `scripts/verdict.mjs` (`informer` seulement, pas `borne`), qui rend le profil de match (tirs, rythme, buts, punitions, coups) de chaque carte de saison, système, agressivité. C'est l'outil de calibration de toutes les étapes. Trop long pour l'Action (cinq minutes) : à la main, comme `check_cartes`.
- Risque : aucun (lecture seule). **Prouvé par** : la ligne « sans carte, les deux passages sont identiques » (le témoin de `check_cartes`) vaut 0 sur le nouveau profil.

### Étape 1. L'affichage en chiffres de match (aucun changement du moteur)

- `js/impact.js` (§5.2), `attenduDeCote` extrait de `jouerCote` (le moteur et l'affichage appellent la même fonction), branchements de §5.4. `sw.js` liste le nouveau fichier (`check_coquille`). Un export de plus et rien d'inutile (`check_mort`).
- **Script** : `scripts/check_chiffres.mjs` (§5.2) + `check_totaux.mjs` inchangé.
- **Risques** : `check_graine` : l'extraction de `attenduDeCote` ne doit consommer aucun `hasard()` et rendre la même valeur ; prouver par `check_graine` + une comparaison de 40 saisons (empreintes identiques avant/après). `check_feuilles`, `check_robot`, `check_rogue`, `check_coachs`, `check_banque` : aucun (pas de changement de nombres). `check_clarte` : de nouveaux mots à l'écran (« par match », « tirs ») ; ajouter les chiffres de la page des règles qui viennent d'une constante. Smoke `sansCote` : aucun chiffre ne vient d'une cote (ce sont des espérances de profil, comme les totaux).
- **Ressenti** : immédiat. Le joueur lit « ≈ −0,20 but accordé par match », pas « −6 % ».

### Étape 2. La preuve de l'impact (aucun changement du moteur)

- Le profil de style des N matchs (§6.1), « ce que ton build a fait ce soir » (§6.2) à partir des feuilles et de `chiffresDuSoir`. Un onglet ou une ligne dans `js/saison.js` / `js/bilan.js` ; la ligue lit les `t.journal` déjà gardés.
- **Script** : `scripts/check_profil.mjs` : le profil lu des feuilles égale `t.journal` recompté à la main (tirs, punitions, coups), pour 3 clubs ; le mot de style ne change pas pour un même historique ; smoke `sansDebordement` à 390 px (une ligne, jamais un tableau).
- **Risques** : mémoire (les feuilles d'une ligue de 32 clubs × 82 matchs, mesuré : une ligue joue en 4 s et lit sans problème ; l'écran ne lit que ses 10 derniers matchs et un résumé de la ligue calculé une fois par journée). `check_graine` : lecture seule, vérifiée par le test « lire ne change rien ».
- **Ressenti** : le joueur voit qu'un build défensif a un rythme de 49 contre 56. S'il ne l'a pas (le défaut de §3), l'écran le dit (« tu tires 25, ils tirent 29 ») : c'est le meilleur argument pour l'étape 4.

### Étape 3. Les amplitudes modérées des petits choix (changement de données, pas de moteur)

Pour que les choix aient un visage SANS changer la force :

| catégorie | aujourd'hui (médiane) | cible (modérée) | comment |
|---|---|---|---|
| événements | 0,1 tir · 0,04 but · 0,03 V sur la durée | ≈ 1 tir ou ≈ 0,15 but sur la durée ; ≤ 0,3 V pour un commun, ≤ 0,6 V pour un rare | multiplier ×3 à ×4 l'écart au 1,00 de leur canal de style (`volume`, `defense`, `discipline`) ; retirer un canal sur deux de la plupart des « communs » (deux canaux de 2 % ne se voient pas : un canal de 7 % se voit) ; maintenir la compensation du prix |
| dilemmes | 0,2 tir | ≈ 1 tir ou 0,15 but | idem pour les options sans pari |
| patrons | 0,0 tir (0 sur 36 visibles) | un patron de style change le rythme de ±1 tir | `att_adjoint` 1,025 → 1,04 (+1,1 tir) ; `def_systeme` ajoute `defense: 0.965, volume: 0.985` = −0,4 tir : monter à `0.95 / 0.97` ; garder les victoires (≤ 1,2 V légendaire) |
| cartes de match | 0,2 tir | rare/légendaire : ±2 tirs dans le soir (une carte `+` déjà à 2,5-3,2) | déjà dans le haut des cartes `+` ; les communes restent à ±0,5 |
| cartes de saison | 0,7 de rythme (max 1,4) | **rares et légendaires** : jusqu'à ±3 tirs de rythme, ≤ ± 2,5 V | amplitudes ×1,5 à ×2 sur celles qui portent un style (`chasse`, `ouvert`, `newjersey`, `gardiens`) ; compenser par le prix |

- **Script** : `check_impact.mjs` (étape 0) et `check_cartes.mjs` (la règle de victoires, §7.5) : chaque nouvelle amplitude se lit en paires, douze ligues au moins (une demi-victoire d'incertitude par lecture : MOTEUR/decisions).
- **Risques** : `check_banque` (douze minutes : toute la banque, les poids des raretés), `check_coachs` (les coachs lisent la couleur des cartes sur leurs CANAUX : changer un canal change la couleur d'une carte ; `check_coachs` exige que « une carte trouve son coach sur ce qu'elle fait »), `check_rogue` et `check_robot` (le robot ne doit pas gagner la Coupe : si les cartes de style deviennent plus fortes, le robot qui pige « premier Signer » peut gagner plus). `check_graine` : les décisions portent leurs CHIFFRES (une partie reprise rejoue ce qui a été joué) : changer la banque ne casse pas une sauvegarde, mais change une partie rejouée depuis une graine sans décision stockée.
- **Ressenti** : l'écart se voit dans la feuille, mais le style reste faible parce que la partie `τ, κ, κo` manque.

### Étape 4. Le modèle de tempo (le seul changement de moteur)

- §4 : trois exposants (`TAU`, `KAPPA`, `KAPPA_OWN`, 0,5 pour commencer) et deux constantes de centrage (`REF_STYLE_VOL`, `REF_STYLE_DEF`) dans `js/sim.js`, avec `pressionJ`, `styleVol`, `styleDef` dans `profilMatch`. Les cartes elles-mêmes ne changent pas. Un commentaire écrit, comme `K_ROB`, qui dit la cible : « un club tout défensif tire ~25 et prend ~25 tirs, ~2,4 buts ; un club tout offensif ~33 et ~32, ~3,6 buts ».
- **Scripts** : `check_feuilles.mjs` (`LIGUES=5` : 28,5 lancers et 3,1 buts par équipe par match, une part de buts en avantage de 25-26 %, les cinq égalités de la feuille), `check_monotonie.mjs` (monotone sur dix déciles), `check_ratings.mjs` (corrélation du classement autour de 0,8), `check_suppression.mjs` (la corrélation −0,17 des tirs contre ; **elle ne doit pas bouger : `ALPHA_POSSESSION` ne lit plus que `pressionJ`**), `check_cartes.mjs` (douze ligues, §7.5), `check_graine.mjs`, `check_totaux.mjs`, `check_chiffres.mjs`.
- **Risques** (non mesurés dans ce document, sauf la ligne de base) :
  - **`check_graine`** : le tempo ne consomme aucun hasard de plus (c'est un facteur sur `attendu`, avant le `poisson`), donc la graine rejoue. Mais **chaque match change de valeur** pour tout club qui porte une carte ou un système de style : un test d'empreinte figée (s'il y en a un) doit être régénéré.
  - **`check_feuilles`** : la ligue de base bouge de 28,40 → 28,42 tirs et de 3,004 → 2,979 buts (mesuré, 3 ligues, bruit ±0,07 et ±0,02) ; à vérifier à 5 ligues. Si `REF_STYLE_VOL`/`REF_STYLE_DEF` dérivent avec les systèmes de l'IA, les remesurer (le script `probe.mjs` du scratchpad le fait).
  - **`check_robot`** (« premier Signer » ne gagne pas la Coupe) : l'IA défend et attaque avec les systèmes automatiques, qui portent un `styleVol`/`styleDef` moyen (centré). Un club de robot qui choisit des cartes défensives gagne `κ`: le défensif rapporte à peu près 0 V net à 0,5, mais **à τ = κ = 1 il rapporte +3 V** : c'est le piège mesuré (`tb`). Rester à 0,5-0,7.
  - **`check_coachs`** (dix minutes, six ligues, la confiance des neuf coachs) : les coachs portent des `volume` et `defense` (`js/coachs.js`) et sont comptés comme de la partie « style » : leur valeur en victoires change (la Tortue, le Frelon). Remesurer et recaler leurs paliers.
  - **`check_banque`** (douze minutes) : la valeur de chaque carte change (en paires, une carte `defense` double son effet sur les tirs) ; recaler les amplitudes de §7.3 en conséquence.
  - **`check_rogue`** (la courbe des runs) : des clubs défensifs ou offensifs de plus : la courbe peut bouger ; ajuster le prix du coffre.
  - **Les séries** : `playGame` en séries utilise `series=true` et `effetsSerie` ; les mêmes facteurs s'appliquent ; vérifier `check_series_pas` que le tempo ne casse pas la variance des 4 de 7.
- **Plan de recalage** : `docs/moteur-recalibrer.md` : changer les exposants se remesure en paires, un à la fois ; si `td` gagne 1 V de trop en défensif, c'est `κo` qu'on monte (le défensif perd des tirs pour), pas la carte.
- **Ressenti** : c'est l'étape qui donne la phrase demandée : « si je fais juste des choix défensifs, c'est un match défensif ».

### Étape 5. Les mises en échec, et le mot « tirs bloqués » (optionnel)

- `coupsAttendus` lit `effets.robustesse` ; décider avec le joueur du mot « tirs bloqués » (§4.4, voie (b)). **Script** : `check_jambes.mjs` (une minute : les coups usent les jambes), `check_feuilles` (inchangé).
- **Risques** : l'usure des jambes (les coups coûtent `COUP_JAMBES` 1,2 ; si un club « corps » frappe 30 % de plus, il fatigue l'adversaire plus : un effet net sur les victoires qu'il faut mesurer).

### 7.5 La nouvelle règle de `check_cartes.mjs`

Aujourd'hui (`borne(..., -1, 1, 'victoire')`) : *une carte vaut moins d'UNE victoire d'écart net*. Elle est remplacée par trois lignes. Le texte, à mettre en tête du fichier :

> **UNE CARTE CHANGE LA FORME DU MATCH, PAS SA FORCE. Plus fort veut dire plus de style perceptible, jamais plus de victoires.** Le net en victoires est borné par la rareté — commune ±1, peu commune ±1,5, rare ±2,5, légendaire ±4 — et c'est un MAXIMUM, pas une cible : aucune carte ne devrait s'en approcher sans que ce soit la forme de sa saison qui le porte. Une carte rare ou légendaire doit, de plus, être VISIBLE dans la feuille : au moins l'un de ces déplacements par match — le rythme (tirs des deux clubs) de ±2 tirs, les buts des deux clubs de ±0,3, les punitions de ±0,5, les mises en échec de ±4. Et le style doit être gagné SANS le payer en force : le rapport entre le net en victoires et le déplacement du profil (la somme des valeurs absolues de ces quatre déplacements, chacune divisée par son seuil) ne dépasse pas 0,5 V par seuil franchi. Une carte qui gagne 2 V en ne changeant rien à la feuille est un cadeau ; une carte qui change tout et vaut 0 V est un style.

Ce que le script assertionne :

1. `borne(carte · écart net, ΔV, −MAX[rareté], +MAX[rareté], 'victoire')` avec `MAX = { commune: 1, peu: 1,5, rare: 2,5, legendaire: 4 }` (la rareté vient de la banque ; les 18 cartes de saison sont toutes « communes » à ±1 aujourd'hui).
2. `exiger(carte · visible, rythme ≥ 2 || buts ≥ 0,3 || punitions ≥ 0,5 || coups ≥ 4, …)` pour les rares et légendaires seulement (les communes peuvent être discrètes).
3. `borne(carte · victoires par déplacement, ΔV / déplacement, −0,5, 0,5)`.
4. `informer` : le tableau de §2.2 (tirs pour, tirs contre, rythme, buts, punitions, coups) pour chaque carte, qui est le tableau que le joueur lit.
5. **Le témoin** (sans carte, deux passages identiques) reste le garde-fou de la méthode ; **sous douze ligues on informe au lieu de juger**, comme aujourd'hui (une demi-victoire d'incertitude par lecture).

Valeurs d'appui de la mesure d'aujourd'hui : écart net des 18 cartes entre −0,9 et +0,9 V ; rythme médian 0,7 tir (max 1,4) ; parmi les 18 cartes de saison, seules La fougue (+0,88 punition) et Le sang-froid (−0,56) franchissent un seuil de visibilité de la ligne 2 ; aucune n'atteint ±2 tirs de rythme (le max est 1,6) ni ±0,3 but des deux clubs sauf Le grand jeu et Bloc de départ.

---

## 8. Ce que je n'ai pas pu mesurer

- **Les tirs bloqués** : n'existent pas dans le moteur ; je n'ai rien à mesurer. Les mises en échec ne sont lues que comme ATTENDUES (`coupsAttendus`) : un compte exact de coups (la feuille ne les compte pas) n'existe pas.
- **Les victoires** : ±0,65 V pour 96 équipes-saisons par configuration. Les tableaux de victoires de ce document ne tranchent pas sous 1 V ; ceux des cartes (§2.2) sont des lectures uniques, à ne pas retoucher sans douze ligues (la règle de `check_cartes`).
- **Le modèle de réponse** (§2.6) est log-linéaire, calé sur ×0,9 à ×1,2 d'un seul canal ; il ne connaît ni les bornes (`PRESSION_MAX`, `FINITION_MAX`) ni les interactions, ni les gestes (soin, jambes, hasard) qui font une grande part des consommables, des dilemmes et des événements de la vie. Les catégories autres que les cartes de saison, les systèmes et l'agressivité ne sont pas mesurées directement ; **un événement ou une carte de match isolé** n'a pas été joué en ligue.
- **Les modifs de joueur** (`MUTATIONS`, 72) et **les coachs** : à effet par joueur ou par confiance, non mesurés ici.
- **Les cartes de match** sont mesurées comme des effets permanents d'un canal ; un seul match, sans la main, l'énergie ni la préparation (`gros`).
- **Le prototype de tempo** (`proto/`, §4) a été joué sur trois ligues de 32 clubs, les configurations de style, pas sur la banque entière ; `τ = κ = κo = 0,5` n'atteint que 60 % de la cible 22/34 tirs ; `0,7` et le cumul de six sources ne sont pas mesurés. Aucune des suites `check_graine`, `check_robot`, `check_rogue`, `check_coachs`, `check_banque`, `check_feuilles` n'a été lancée sur le prototype (aucun fichier du dépôt n'a été modifié).
- **L'espérance des buts** pour l'affichage (§5.2) : la voie par échantillonnage de `p` est décrite, pas codée ni mesurée ; la voie « 300 matchs avec et sans » est trop bruitée (±0,15 tir pour 600 matchs, mesuré).
- La copie de moteur du prototype date d'avant une modification parallèle de `js/sim.js` (le champ `avant` de `injuriesLog`) : sans effet sur le profil du match.

---

## 9. Reproduire

Depuis le scratchpad (`cd /tmp/claude-0/-home-user-hockey/0709c4bb-22d7-5b5a-9a62-0d2e725f4488/scratchpad`) :

```
for i in 0 1 2 3; do SHARD=$i/4 node run.mjs & done; wait   # 69 configurations, ~10 min, res_0..3.json
node fmt.mjs res            # le tableau brut
node rel.mjs                # systèmes (relatifs à « sans système »), agressivité, cartes
node modele.mjs             # pentes par canal, victoires par but
node tables.mjs             # §2.6 : les catégories
cd protorun && ./go.sh      # le prototype de tempo (TEMPO=1 TAU=… KAPPA=… KO=… SVR=1.012 SDR=0.9705)
node ../fmt.mjs ta | node ../fmt.mjs td   # les réglages comparés
```

Variables du prototype : `TEMPO=1` allume le modèle, `TAU`, `KAPPA`, `KO` ses trois exposants, `SVR` et `SDR` ses constantes de centrage (`node protorun/probe.mjs` les remesure). `SEEDS=1000,1001,1002` règle les ligues. Le diff complet du prototype est de 21 lignes dans `proto/js/sim.js` (`diff js/sim.js proto/js/sim.js`).

---

## 10. Où en est le plan (étapes 0 et 1, faites)

- **Étape 0** : `scripts/check_impact.mjs` (douze secondes) : la base de la ligue (28,2 tirs, 3,03 buts, 3,8 punitions, 22 mises en échec), le témoin exactement à zéro sur chaque colonne du profil, une carte mesurée en paires contre sa lecture. `COMPLET=1` : le tableau de chaque choix, en `informer`.
- **Étape 1** : `js/impact.js`. `attenduDeCote` est sorti de `jouerCote` (le moteur et l'écran appellent la même fonction), et `lectureDuMatch` (js/sim.js) interroge `jouerCote` lui-même sous un hasard à part, en sommant la chance du lancer au lieu de tirer le but : le tirage ne dépend plus de `p`, donc deux lectures se comparent sans bruit. Le moteur ne bouge pas d'un dé (empreinte de deux ligues, 82 jours, avant et après : identique). `scripts/check_chiffres.mjs` (une minute) : les 48 niveaux du soir contre des milliers de vrais matchs, la différence de neuf effets contre l'écart mesuré en paires, la forme des mots, et lire ne change pas une journée.
- **Ce qui se dit en chiffres de match** : les effets de canaux (cartes de saison, patrons, événements, dilemmes, consommables, coachs, consigne, cartes de match, leurs effets sur eux), les systèmes et l'agressivité (le soir joué avec ou sans), les synergies (`plein`), les modifs de joueur (posées le temps de la lecture), le total du soir, les conseils du dépistage. Une blessure se dit en blessures par saison (ou sur la durée du choix), l'usure en jambes par match, les minutes de trio en minutes de glace.
- **Ce qui garde son pourcentage**, parce que ce n'est pas un effet de match : les prix et les rabais des packs, le plafond salarial, les chances (un pari, un dépistage, « viser juste »), la maîtrise d'un système, les variantes de carte (+3 %, +5 % : un bonus par joueur, sous le dixième de tir) et les situations du vestiaire (un effet par joueur).
