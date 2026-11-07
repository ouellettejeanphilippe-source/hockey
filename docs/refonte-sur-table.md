# Devis — Sur table, le jeu refait (refonte « digne de Blood Bowl »)

## Les décisions de JP (7 nov. 2026)

Tranchées le 7 nov. 2026 sur les huit questions du brouillon ; elles font foi sur le texte plus bas, qui est le brouillon du même jour, retouché seulement là où une décision le contredisait (la Recrue au § 7 et aux tranches, le nombre de clubs au § 3.10, aux réglages et à la tranche 7, la vieille partie réglée sur la Recrue au § 6).

1. **La présence d'équipe** : le premier jet raté du porteur finit la présence ; **6 présences par équipe par période**.
2. **Un seul dé contre un seuil**, dit avant le geste : « 3+ · 67 % ».
3. **Une glace de 11 × 17**.
4. **4 clubs par défaut, 6 en option** pour le tournoi.
5. **La progression pendant le tournoi seulement** (les points d'étoile et les habiletés apprises ne survivent pas au tournoi).
6. **Les blessures** : 1 à 3 matchs ; la relève vient des 23 de ton alignement.
7. **Aucune tactique de période** dans cette refonte.
8. **L'adversaire Recrue est retiré** : un seul niveau d'IA. (Le § 7, « La tête de l'IA », disait que la Recrue gardait son sens : c'est défait ; `iaPresence` n'a qu'un niveau.)

---

Brouillon du game-designer, 7 nov. 2026, à faire juger par `/revue-design` puis trancher par JP (les huit questions du rapport, tranchées ci-dessus). Rien n'est codé. Les noms en `code` de « Ce qui part » viennent d'une lecture de js/table.js, js/plateau.js et js/tournoi.js le 7 nov. 2026 ; un nom qui n'y serait plus se retire de la liste avant `check_refonte`.

## 1. Ce que JP a dit

JP, 7 nov. 2026 : *je veux que le jeu sur table soit digne des jeux déjà existants comme Blood Bowl, etc.*

Ce qui revient dans ses mots depuis le début du mode (docs/decisions.md) : *mode bonus genre blood bowl, fft et autres jeux de sport de table* ; *plus rapide, surtout pour genre les séries* ; *je pense à hoops tactics* ; *on dirait que tu comprends pas le jeu, son but, que c'est juste random, tu as pas attaché les mécaniques ensemble de façon cohérente* (S41) ; *le jeu de table feel wrong à jouer, on dirait que rien a de sens* ; *c'est up and down, sans strategic* ; *je veux que le positionnement soit logique et force à faire des risques pour gagner, sans que ça soit revirement but direct* (S42) ; *chaque mécanique, chaque stat doit interagir d'une façon logique et équilibrée [...] sans perdre le côté jeu simple, mais complexe* ; *on devrait rester dans les classiques 3-2* (S45).

Le reproche de fond : quarante chantiers (S26 à S75c) ont retouché la même règle de tour et le même dé, chaque fois en remontant un nombre de tours ou de possessions pour rattraper les buts. C'est une refonte : elle se mesure à ce qui part.

## 2. Ce que le joueur ressent

**Le fantasme** : « je suis derrière le banc d'un vrai club, je joue chaque présence comme un jeu de plateau, et chaque décision de pousser ma chance se paie ou paie ».

- **Le pic** : la présence où tu enchaînes cinq gestes risqués, la rondelle traverse la zone, la reprise entre au dernier dé ; ou l'inverse, la mise en échec qui tourne mal, le revirement, et le contre qui part.
- **Le jour ordinaire** : une présence se joue en 30 à 60 secondes ; la présence adverse se regarde en accéléré.
- **La boucle** : la présence (30-60 s, la micro-boucle), la période (six présences chacun, 8-12 min, la méso-boucle), le match (20-40 min), le tournoi (l'équipe qui s'use, se blesse et gagne en métier, le soir).

Esthétiques visées (MDA) : Défi d'abord (pousser sa chance, lire les risques), Fantaisie (les vrais joueurs se reconnaissent à ce qu'ils savent faire), Récit (la feuille, les étoiles, le blessé du tournoi).

## 3. Les règles du jeu

### 3.1 La glace

- Une grille de **11 colonnes × 17 rangées** (proposition, question 3 du rapport), le filet une case sur chaque ligne des buts, une rangée derrière chaque filet. Trois zones : la zone défensive, la zone neutre, la zone offensive, lignes bleues et rouge dérivées des constantes comme aujourd'hui.
- La patinoire SVG, la lecture des trajets, les sons, les couleurs restent (voir 7).

### 3.2 Le tour : la présence

- Un match : 3 périodes ; chaque période, **6 présences par équipe**, en alternance (A, B, A, B…). Le tableau dit « Présence 4/6 ». C'est l'horloge, et elle est visible.
- À sa présence, une équipe **active ses pièces une à une, dans l'ordre qu'elle veut**. Chaque pièce activée fait **un déplacement et une action** (ou l'une des deux), puis elle est jouée pour la présence. Le gardien ne s'active pas (voir 3.8).
- **Le revirement** : un jet raté **par le porteur** (esquive, passe, tir arrêté qui ne laisse pas de retour à toi, feinte), ou une mise en échec qui renverse ton propre joueur, **finit ta présence sur-le-champ**. Les pièces qui n'ont pas joué ne jouent pas. C'est la décision de pousser sa chance : les gestes sûrs d'abord, le risque en dernier.
- Une présence peut se finir volontairement (« Finir la présence »).
- **Le changement de trio** : au début de ta présence seulement, avant toute activation, gratuit, une fois ; les entrants entrent à leur banc (ton bout de glace) — on paie la fraîcheur en position. Pas avec l'unité qui porte la rondelle.

### 3.3 Les actions (sept, une liste fixe)

| Action | Qui | Jet | Réussi | Raté |
|---|---|---|---|---|
| Patiner | toute pièce | aucun, sauf esquive pour quitter une case sous pression avec la rondelle | elle avance de son PA | esquive ratée : rondelle libre sur place, revirement |
| Passer | le porteur | seuil passe | le receveur l'a | rondelle libre au bout de la ligne ou interceptée ; revirement |
| Tirer | le porteur en zone offensive | seuil tir | but | arrêt : le gardien la garde, ou retour libre devant lui |
| Reprendre | une de tes pièces collée au retour libre, pendant ta présence | seuil tir +1 (plus dur) | but | arrêt ; revirement |
| Feinter | le porteur collé à un défenseur | seuil feinte | le défenseur est battu, le porteur peut repatiner 2 cases | rondelle libre, revirement |
| Mettre en échec | toute pièce collée à un adversaire | le dé de contact | voir 3.5 | voir 3.5 |
| Harponner | toute pièce collée au porteur | seuil vol | elle prend la rondelle | rien ; elle reste debout, mais l'arbitre regarde (3.6) |

Le « au fond » (dégager dans un coin depuis la zone neutre) est une passe sans receveur, seuil fixe 3+, la rondelle libre au coin visé.

### 3.4 Le dé : un d6 sur un seuil, la chance écrite avant le geste

- Chaque jet est **un seul d6 contre un seuil de 2+ à 6+**. Le 1 rate toujours, le 6 réussit toujours. Le seuil se calcule ainsi : `seuil = borne(4 − (stat de qui agit − stat de qui s'oppose) − modificateurs de situation, 2, 6)`.
- Le seuil se dit « 3+ · 67 % » sur la case ou le bouton, **avant** le geste. Une action dont le raté finit la présence porte un liseré rouge (« revirement si raté »).
- **La relance d'équipe** : 2 par période (réglage), après avoir vu le dé ; certaines habiletés en donnent une de plus pour leur geste.
- La pression (zone de bâton) : chaque patineur debout tient les cases autour de lui (2 cases si DE ≥ 5). Quitter une case tenue avec la rondelle demande une esquive ; chaque bâton de plus sur le porteur ajoute +1 au seuil de ses passes, feintes et esquives.

### 3.5 La mise en échec et le dé de contact

- La mise en échec compare `FO` de l'agresseur à `FO` de la cible, et **les appuis** : chaque coéquipier de l'agresseur qui tient aussi la cible (et que personne ne tient lui-même) vaut +1, chaque coéquipier de la cible qui tient l'agresseur vaut +1 en face.
- Écart ≥ +2 : l'agresseur lance 2 dés et garde le meilleur ; écart −2 ou moins : il en lance 2 et la cible choisit ; sinon un dé.
- Les six faces du dé de contact, au hockey : **1 Tu tombes** (l'agresseur au sol, revirement si c'est ta présence) ; **2 Accrochage** (les deux au sol, l'arbitre regarde) ; **3-4 Repoussé** (la cible recule d'une case, le porteur garde la rondelle) ; **5 Repoussé au sol** (la cible recule et tombe ; le porteur échappe la rondelle, libre) ; **6 Plaqué** (la cible tombe sur place, la rondelle libre, et elle fait un jet de robustesse).
- Au sol : la pièce passe sa prochaine activation à se relever. Une mise en échec dans la bande : « Repoussé » devient « Repoussé au sol ».
- **Jet de robustesse** après un Plaqué : un d6 + modificateur de robustesse (de `mr`, du gabarit) ; 1-2 sonné (sort jusqu'à la fin de la période), 1 naturel suivi d'un deuxième 1 : blessé (sort du match, et du tournoi selon 3.10).

### 3.6 L'arbitre et les punitions

- « L'arbitre regarde » après un Accrochage, un harponnage raté ou une mise en échec par derrière : un d6 contre le seuil de punition de l'époque du fautif (`facteurPunitionsEpoque`) et de sa colonne de minutes de punition ; punition mineure si le dé l'atteint.
- Le puni va au cachot pour **les 3 prochaines présences adverses** ; son équipe joue à quatre (l'avantage numérique) ; un but contre elle le libère. Deux punis au plus. Prolongation à trois contre trois : le non-puni ajoute un patineur (la règle de la LNH, déjà tenue).

### 3.7 La rondelle libre et le revirement

- Une rondelle libre se ramasse en patinant dessus : un jet de ramassage (seuil MA, 3+ de base) ; raté, elle rebondit d'une case, et si c'était ta présence avec ce patin, c'est un revirement.
- Le revirement n'est pas un but direct : la présence adverse s'ouvre là où la rondelle est, et l'équipe qui vient de la perdre a laissé ses pièces jouées en place (la position compte).

### 3.8 Le gardien

- Une pièce fixe dans son filet, avec un nombre `AR` (de `facteurGardienDe`, comme aujourd'hui) et un **angle** qu'il règle une fois au début de chaque présence adverse, gratuitement : « au centre », « côté gauche », « côté droit » (−1 au seuil du tir venu de son côté, +1 au tir de l'autre côté et à la passe transversale). L'IA règle le sien.
- Le tir : `seuil = borne(4 − (TI − AR) + distance + angle − écran, 2, 6)`. L'écran : un coéquipier devant le gardien sur la ligne du tir, −1 au seuil.
- L'arrêt : un d6 de contrôle (AR) ; manqué, un retour libre devant le filet.
- Le filet désert : sortir son gardien dans la dernière présence de la troisième, un sixième patineur.

### 3.9 Les unités spéciales

- L'avantage numérique et le désavantage jouent les unités AN 1 / DN 1 que le moteur range déjà (`speciales`). Un joueur à fort rendement en avantage (ses vrais points en AN, quand la colonne existe) porte l'habileté « Quart arrière » (voir 4.3).

### 3.10 Le tournoi et l'équipe qui progresse

- Le format reste six clubs, cinq matchs puis demi-finale et finale (ou quatre clubs, question 4 : **tranchée, 4 par défaut, 6 en option**). Les matchs que tu ne joues pas passent par le même moteur, comme aujourd'hui.
- **Entre deux matchs** : les **jambes** (sur 100) de chaque joueur baissent selon ses présences du match, et remontent de 30 par journée de repos ; sous 50, son souffle maximal baisse d'un. Un blessé manque 1 à 3 matchs (d6 : 1-3 un, 4-5 deux, 6 trois). Ton alignement des 23 fournit la relève : la profondeur du repêchage compte.
- **Les points d'étoile** : un but 3, une passe 2, un Plaqué 2, une étoile du match 3. À 6, 16 et 31 points, le joueur gagne une **habileté apprise**, à choisir parmi deux tirées dans les familles que ses vraies stats lui ouvrent (4.3). Gardé le temps du tournoi.
- 🧭 Meneur et 🏆 Conn Smythe trouvent leur canal : une relance gratuite par match en séries et en prolongation.

### 3.11 Ce que le joueur voit à 390 px avant chaque geste

1. Le tableau : pointage, période, « Présence 4/6 », relances (●●), le cachot.
2. Il touche une pièce : les cases atteignables allumées, leur prix en pas, et sur celles qui demandent une esquive « 4+ · 50 % ». La route tracée.
3. La carte de commandes à côté de la pièce : les sept actions, **toujours dans le même ordre**, chacune avec son seuil et sa chance, ou la raison qui l'éteint ; le liseré rouge sur celles qui finissent la présence si elles ratent.
4. Il touche une cible : le détail « TI 5 c. AR 4 · écran −1 · de loin +1 = 3+ ». Puis le dé roule sur la glace, le verdict tombe sur sa case.
5. Barre du bas : « Finir la présence », le banc (au début seulement), et la relance après un raté.

## 4. Les chiffres

### 4.1 Le seuil d'un jet

`seuil = borne(4 − Δ − S, 2, 6)` ; `Δ` = stat de qui agit − stat de qui s'oppose (chacune de 1 à 6, `statsDeTable`) ; `S` = somme des modificateurs de situation (positif aide qui agit). `P(réussir) = (7 − seuil) / 6`.
Exemple : tir de TI 5 contre AR 4, de la deuxième rangée (+0), avec écran (+1) : `4 − 1 − 1 = 2` → 2+ · 83 %. Sans écran, de la pointe (−2) : `4 − 1 + 2 = 5` → 5+ · 33 %.
Bornes : 17 % à 83 %. Le talent se lit de la carte au seuil sans calculatrice.

### 4.2 Le tempo

`gestes par match ≈ 2 équipes × 3 périodes × 6 présences × G` ; `G` = gestes par présence (cible 3 à 6). À 4,5 : 162 gestes, dont 81 à toi ; à 15 s le geste avec la lecture, 20 min à toi, plus 8 à 12 min de présences adverses accélérées : **28 à 32 min**. Format Éclair, une période : 10 min.
Cible de buts : 2,6 à 4,2 par équipe (la fourchette de JP, S45), à mesurer et à régler par le nombre de présences (5 à 8), jamais par un seuil caché.

### 4.3 Les habiletés tirées des vraies stats (aucune cote neuve)

Une habileté de naissance par patineur, au plus deux : la colonne où il est dans le **premier quintile de sa saison à son poste** ; elle se lit dans des lectures qui existent déjà.

| Habileté | Ce qu'elle fait | D'où elle vient |
|---|---|---|
| Franc-tireur | relance un tir raté, une fois par période | `pctTirRelDe` |
| Canonnier | pas de malus de distance sur le tir de loin | `lancersRelDe`, tir signature 💣 (`ts`) |
| Passeur | relance une passe ratée, une fois par période | `passesRelDe` |
| Mains de velours | +1 sur l'esquive et le ramassage | `tk` (2005-06+), repli MA |
| Frappeur | +1 dé de contact quand il met en échec | `ht`, repli `mr` (`bonFrappeur`) |
| Bloqueur | sur la ligne d'un tir, il ajoute +1 au seuil | `bl` (2005-06+), repli `md` (`ecranVaut`) |
| Pilier défensif | rayon de deux cases quoi qu'en dise DE | `md`, traits Selke, Norris |
| Quart arrière | en avantage numérique, −1 au seuil de ses passes | ses points en AN (colonne à vérifier), repli archétype |
| Tête dure | +1 au jet de robustesse | `mr`, gabarit matador |
| Agitateur | ses accrochages font regarder l'arbitre deux fois pour l'adversaire | minutes de punition (colonne à vérifier), `tiree` 2009-10+ |
| Rapide | +1 PA | trait ⚡ Vitesse |
| Endurant | souffle max +2 | `r` (l'usure) |
| Gardien : Mur | un retour de moins (contrôle +1) | `facteurGardienDe`, traits Vezina, Voleur |

Les six nombres d'une pièce (PA, MA, TI, FO, DE, SO) et AR restent ceux de `statsDeTable` (`axes20` → `surDe`) : la règle ferme de `.claude/rules/sur-table.md` tient.

## 5. Les cas limites

- La rondelle libre dans un coin collé à deux adversaires : le ramassage prend +1 par bâton adverse (au plus +2).
- Une présence où le porteur n'est pas activable (au sol) : les autres pièces jouent, personne ne tire.
- Le dernier geste d'une période : la sirène sonne après la présence de B (B n'est jamais privé de sa sixième).
- Un blessé dans un trio : le trio joue à deux avants jusqu'au prochain changement ; le moteur pose le remplaçant à la mise au jeu.
- Toute l'équipe au cachot ou au sol : règle de la LNH (deux punis au plus), et une présence où aucune pièce ne peut jouer se finit seule.
- La vieille partie : un tournoi d'avant la refonte se relit (`relireTournoi`) ; ses matchs déjà joués gardent leur pointage, les suivants se jouent sous la règle neuve — `check_sauvegardes`.
- Hors ligne : `sw.js` liste les fichiers neufs, s'il y en a — `check_coquille`.
- Clavier : chaque case et chaque action atteignable au focus (smoke).

## 6. Ce qu'il touche

- Fichiers : `js/table.js` (le moteur), `js/plateau.js` (l'écran), `js/tournoi.js` (la campagne), `js/modes-table.js` (le menu, les règles), `style.css` (section du plateau), `scripts/check_table.mjs`, `scripts/check_regles.mjs`, `scripts/smoke_table.mjs`, `.claude/rules/sur-table.md`, `docs/decisions.md`, `LIVRAISON.md`.
- Règles fermes : `sur-table.md` — « les règles écrites dans le code » (respectée : `reglesDuPlateau()` réécrite), « la rondelle ne se téléporte pas » (respectée : `m.trajet` et `TRAJETS` restent), « les nombres viennent des cotes sur 20, sur un dé par une seule table » (respectée), « une punition au rythme de l'époque » (respectée). `interface.md` : 390 px, 44 × 44 (respectée) ; « aucune carte sur table » (respectée si la question 7 tranche pour des boutons).
- Clés de sauvegarde : `G.bonus`, `G.niveauTable`, `G.formatTable`, l'état du tournoi (`etatDuTournoi`) — elles ne bougent pas ; l'état du tournoi gagne des champs (jambes, blessés, points d'étoile), lus en absence par défaut. Une vieille partie réglée sur la Recrue (`G.niveauTable`) se lit au seul niveau qui reste.

## 7. Ce qui part

### Le tour à main alternée et le tempo en possessions (js/table.js)

- `mainNeuve`, `finirMain`, `aLaMain`, `mainEpuisee`, `PLACEMENT`, `POOL`, `PAS_PAR_MAIN`, `pasRestants`, `enCourse`, `PATIN_CONTACT`, `MOD_EN_COURSE`, `tropLoin`, `enMouvement` → la présence d'équipe (`nouvellePresence`, `activerPiece`, `finirPresence` réécrite).
- `POSSESSIONS_PAR_PERIODE`, `POSSESSIONS_PROLONGATION`, `PRESENCES_PAR_PERIODE`, `PRESENCES_PROLONGATION` → `PRESENCES_PAR_PERIODE` neuve (6) et `PRESENCES_PROLONGATION` neuve, comptées par équipe.
- `LIBRE_SUR_PERTE`, `RELANCE_RAMASSAGE`, `HORSJEU_FILTRE`, `TIR_AU_TIREUR`, `DESERT_ECART` et les interrupteurs `MESURE.*` d'expériences closes → rien (la règle neuve est une seule règle).

### Le duel à deux dés (js/table.js)

- `duel`, `avec`, `ecartDuel`, `haut`, `bas`, `naturel`, `gagneLeDuel`, `chances`, `chancesDe`, `PRES_NATUREL`, `placeDeLoin`, `PLACE_GARDIEN`, `GARDIEN_PLUS` → `seuilDe` et `chanceDe` (4.1).
- `modEchec`, `appliquerEchec`, `pousser` → le dé de contact (`deContact`, `appliquerContact`).
- `modVol`, `appliquerVol`, `modDejouer`, `appliquerDejouer`, `modEsquive`, `appliquerEsquive`, `modPasse`, `modTir`, `modBataille`, `appliquerBataille`, `bataillePossible` → réécrits sur `seuilDe` (la bataille devient le ramassage).
- `PUNITION_CHANCE`, `PUNITIONS_MAX`, `punir`, `PUNITION_TOURS` → l'arbitre (`arbitreRegarde`), en présences adverses.

### L'habileté une fois par période (js/table.js)

- `HABILETES`, `HABILETE_PAR_ARCHETYPE`, `habileteDe`, `userHabilete`, `bonusDe` → les habiletés de 4.3 (`HABILETES` neuve, lue des colonnes, `habiletesDe`).

### La tête de l'IA (js/table.js)

- `iaGeste` et sa pesée main par main (`valeurCase`, `optionTir`, `optionsPasse`, `optionFond`, `COUT_RONDELLE`, `COUT_POSITION`, `ECRAN_IA`, `CHASSE_VAL`, `FORECHECK_LIBRE`) → `iaPresence` neuve : l'ordre de Blood Bowl (les gestes sûrs d'abord, le porteur en dernier, la relance gardée pour le tir). Un seul niveau (décision 8 : la Recrue est retirée).

### L'écran de la main (js/plateau.js)

- `dock`, `noterFinDeMain`, `SIFFLETS_DE_MAIN`, `tourAdverse`, `de`, `deGlaceHtml`, `motDuJet`, `parLesTotaux`, `REUSSITE_SIENNE`, `detail`, `signeDe`, `carte` → la barre de la présence, la carte de commandes aux sept actions et au liseré du revirement, le dé unique sur la glace, la présence adverse jouée pièce par pièce.

### Ce qui reste, et pourquoi

- **La glace et sa patinoire** (`patinoireSvg`, `batirGlace`, `majGlace`, `natureCase`, `estFilet`, `profondeur`, `POINTS_MJ`, `ECARTS`) : la géométrie se dérive déjà de `COLS` et `RANGS` ; on change deux nombres (11 × 17, décision 3).
- **Le trajet de la rondelle** (`m.trajet`, `TRAJETS`, `donner`, `rebondir`, `lacher`, `deposer`, `preparerLecture`) : c'est la règle « la rondelle ne se téléporte pas », gagnée en S74.
- **Les nombres d'une pièce** (`statsDeTable`, `surDe`, `GABARITS`, `TIRS`, `AXE_MOT`) : la règle ferme, et le repêchage sur table les lit.
- **Les postes et le repli** (`posteDe`, `POSTE`, `sesCases`) : la position défensive sans laquelle le jeu était un va-et-vient (S42).
- **Le hors-jeu, le dégagement refusé, la prolongation 3 c. 3, les tirs de barrage, le filet désert** (`verifierHorsJeu`, `horsJeu`, `rolesEnJeuDe`, `ORDRE_PROLONGATION`, `retirerGardien`) : du hockey déjà juste, prouvé par `check_regles`.
- **Le tournoi** (`calendrierRondRobin`, `classement`, `meneursDuTournoi`, `etatDuTournoi`, `relireTournoi`) : la structure est bonne ; il gagne la campagne (3.10).
- **La feuille, les sons, les verdicts sur la glace** (`feuilleHtml`, `etoilesDuMatch`, `sonner`, `verdict`, `VERDICTS`, `js/sons.js`) : ils lisent le fil, que la refonte garde.

Le test du zéro : la règle du tour, le dé, l'habileté, le contact, l'arbitre et l'IA s'écrivent depuis la section 3 sans relire l'ancien ; c'est une refonte.

## 8. Les réglages

| Constante | Valeur | Plage sûre | Ce qui casse au-delà |
|---|---|---|---|
| `PRESENCES_PAR_PERIODE` | 6 | 5-8 | sous 5, peu de buts et peu de retours ; au-dessus de 8, le match passe 40 min |
| `RELANCES_PAR_PERIODE` | 2 | 1-3 | à 3, le revirement ne fait plus peur |
| seuil de base | 4 | 3-5 | à 3, tout passe ; à 5, rien ne passe |
| bornes du seuil | 2 et 6 | fixes | le 1 qui rate et le 6 qui réussit font la surprise |
| appui de contact | +1 par appui | +1 | +2 fait du contact un massacre |
| cachot | 3 présences adverses | 2-4 | à 4, une punition décide du match |
| quintile d'une habileté | 20 % | 15-25 % | à 30 %, tout le monde a la sienne et elle ne distingue plus |
| points d'étoile | 6 / 16 / 31 | ±30 % | trop bas, un tournoi fait des monstres |
| jambes : remontée par repos | 30 | 20-40 | sous 20, la relève joue toute la finale |
| clubs du tournoi | 4 (6 en option) | 4 ou 6 | — |

## 9. Les critères d'acceptation

- [ ] Une présence finit au premier jet raté du porteur, et jamais autrement que par un raté, un geste qui l'épuise ou le bouton — `check_regles` (règle neuve)
- [ ] Le seuil affiché égale le seuil joué, pour chaque action, à un point près — `check_regles`
- [ ] Les buts par équipe par match entre 2,6 et 4,2, un blanchissage possible (1 à 20 %) — `check_table` (cibles gardées)
- [ ] Gestes par présence entre 3 et 6 ; part des présences finies par un revirement entre 25 et 50 % — `check_table` (cible neuve)
- [ ] La parité : un décile d'écart 53 à 92, deux clubs du même décile 44 à 56 — `check_table` (gardée)
- [ ] La durée : un match joué par le joueur scripté du smoke compte 140 à 200 gestes — `smoke_table`
- [ ] Chaque habileté naît chez au moins 3 % et au plus 25 % des patineurs d'une saison, et se joue au moins une fois sur 80 matchs — `check_table` (bloc neuf)
- [ ] Les blessés manquent leurs matchs, les jambes remontent, les points d'étoile ouvrent leurs habiletés, et un tournoi d'avant se relit — `check_sauvegardes`, scène neuve de `check_regles`
- [ ] À 390 px, la carte de commandes tient, les seuils se lisent, rien ne déborde, 44 × 44 — `smoke_table`
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées — `check_refonte`
- [ ] À juger par JP à l'essai : la décision de pousser sa chance se sent ; un vrai joueur se reconnaît à son habileté ; un match tient entre 20 et 40 minutes.

## Les tranches

Chaque tranche est une petite PR ; la mesure lourde (`check_table` 240 matchs) tourne en CI, jamais sur le PC de JP ; ici, au plus `MATCHS=40`.

1. **Le dé à seuil** — `seuilDe`, `chanceDe` remplacent le duel ; l'écran affiche « 3+ · 67 % ». Juge : `check_regles` (le seuil affiché égale le joué), `check_table` (buts dans la fourchette, réglé par le seuil de base seul).
2. **La présence d'équipe et le revirement** — le tour neuf, `PRESENCES_PAR_PERIODE` 6, la nouvelle IA ordonnée à un seul niveau ; la main alternée part. Juge : `check_regles` (la présence finit au premier raté), `check_table` (gestes par présence, revirements, buts, parité), `smoke_table`.
3. **Le dé de contact et l'arbitre** — la mise en échec à appuis, les six faces, le cachot en présences. Juge : `check_regles` (chaque face jouée, le cachot), `check_table` (punitions 2 à 5 par match).
4. **Le gardien qui règle son angle, et le retour** — juge : `check_table` (part des tirs au plancher sous 20 %), `check_regles`.
5. **Les habiletés tirées des colonnes** — `HABILETES` neuve, l'ancienne habileté part. Juge : `check_table` (bloc des habiletés), `check_fiches` (la fiche du repêchage sur table les nomme).
6. **L'écran de la présence** — la carte de commandes aux sept actions, le liseré du revirement, la présence adverse pièce par pièce, `dock` et `tourAdverse` partent. Juge : `smoke_table`, maquettes à 390 × 844 tranchées par JP AVANT le code.
7. **La campagne du tournoi** — 4 clubs par défaut (6 en option), jambes, blessés, points d'étoile, Meneur et Conn Smythe en séries. Juge : `check_sauvegardes`, scène neuve de `check_regles`, `smoke_table` (un tournoi entier).
8. **Les règles écrites et le ménage** — `reglesDuPlateau()` réécrite, `.claude/rules/sur-table.md`, `docs/decisions.md`, `check_mort`. Juge : `check_refonte` sur la somme des tranches, `check_mort`, `tout.mjs`.
