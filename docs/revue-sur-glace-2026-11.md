# Sur glace, revu et corrigé — 2 novembre 2026

JP (2 nov. 2026) : *ya ben des affaires wack, genre, le gameplay, le fait que les défenseurs sont pas dans la zone à la mise au jeu, l'absence de mécanique de mise au jeu, le positionnement des joueurs, la caméra, etc*. Ce rapport ramène chaque reproche à sa cause dans le code, dit ce qui est corrigé et prouvé (version 3.2.4), ce qui reste à voir à la manette, et ce qui vient ensuite.

## 1. Chaque reproche, sa cause, sa correction

### Les défenseurs pas dans la zone à la mise en jeu

- **La cause** — `placerMiseEnJeu` (js/physique.js) mettait les défenseurs 8 m derrière le point, partout. Reproduit en Node : à une mise en jeu en zone offensive, ils étaient à x = 4,85, soit 2,65 m dans la zone neutre, hors de l'écran (la caméra s'arrête à la bleue). Les ailiers collaient le point, à 2 m. Au début du match, les cinq attendaient empilés au même point.
- **La correction** — le placement de la LNH, lu dans `MEJ` :
  - les centres face à face, à 0,6 m du point, et personne d'autre dans le cercle ;
  - les ailiers sur les traits ;
  - en zone, les défenseurs qui attaquent à 0,9 m en dedans de la bleue, ceux qui défendent au bas du cercle et devant le filet ;
  - au centre et en zone neutre, les défenseurs à 6,5 m derrière ;
  - le hors-jeu respecté ; tout le monde placé dès le début du match.
- **La preuve** — `check_physique`, aux sept points de mise en jeu : les centres, le cercle, les traits, le hors-jeu, les quatre défenseurs dans la zone et en deçà de leur centre.

### L'absence de mécanique de mise en jeu

- **La cause** — `tomber` tirait le gagnant au sort, mais le centre perdant, sa lame à 0,25 m du point, reprenait la rondelle 98 fois sur 100, en 0,01 s (791 mises en jeu de l'IA contre l'IA). Le duel ne décidait de rien.
- **La correction** — un vrai duel, à la manette comme pour l'IA :
  - **le bouton à la chute** : +0,45 pile, plus rien à 200 ms ; seul le premier appui compte ;
  - **le Jeu du centre** (sa cote sur 20) compte pour ×0,25, et un hasard semé pour ×0,5 ;
  - **le bâton dit où** : gagnée nettement, la rondelle part en passe vers le coéquipier pointé — vers l'arrière le défenseur, de côté l'ailier ;
  - **la mise en jeu serrée** (un écart sous 0,06) laisse la rondelle libre au point : une petite bataille ;
  - le flash dit « pile ! » ou « 80 ms trop tôt ». L'IA presse le même bouton, à ±0,15 s de la chute, le bâton vers son défenseur trois fois sur quatre (`miseEnJeu`, js/glace-ia.js). Les règles affichées lisent ces chiffres dans les constantes.
- **La preuve** — `check_physique` :

| Ce qui est mesuré | Résultat |
|---|---|
| Toi, le bouton pile, contre l'IA | 72 % gagnées |
| Sans le bouton | 69 points de moins |
| Le bâton vers l'arrière, gagnée | 100 % au défenseur |
| Le bâton vers la bande, gagnée | 100 % à l'ailier de ce côté |
| La rondelle libre | 16 % |
| Un centre de Jeu 18 contre un de Jeu 4 | 88 % pour le 18 |
| L'IA presse le bouton | 60 mises en jeu sur 60 |

### Le positionnement

- **Mesuré** (l'IA contre l'IA, 24 matchs de 3 × 2 min) : le centre revient bien, 97 % dans sa zone après 2,5 s. Le pire défaut était ailleurs : une passe en vol faisait passer toute l'équipe en chasse, et tout le monde fonçait sur la rondelle.
- **La correction** — les coéquipiers du receveur gardent leur poste pendant la passe (`PASSE_VIVE`, js/glace-ia.js) : de 1,55 à 1,18 paires de coéquipiers à moins de 2,5 m l'un de l'autre. Le prix : les passes réussies baissent de 67 à 64 %. Et la remise en jeu : la rondelle sortie de leur zone, les attaquants en sortent même sans elle, et le porteur qui la reprend à la bleue ressort avec elle.
- **La preuve** — trois faits mis en scène dans `check_physique`, rouges avant, verts après.

### La caméra

- **Les à-coups** — le devancement suivait la vitesse brute de la rondelle : une passe ou un tir le faisait sauter de plusieurs mètres. Il suit maintenant une vitesse lissée sur 0,45 s (js/sur-glace.js).
- **La mise en jeu** — la caméra garde le cercle et tous les patineurs dans l'écran, et le cadre de la zone (de la bleue aux gradins) quand il les contient tous.
- **L'horloge** affichait « 2:60 » : corrigé.

## 2. Ce qui reste à voir à la manette

Tout ce qui précède est mesuré en Node ; une seule mise en jeu (au centre) a été vue à l'écran, en capture, bien placée et gagnée « pile ! ». Jamais vu à l'écran :

- **une mise en jeu de zone** (le cadrage y est raisonné, pas vu) ;
- **le lissage de la caméra en mouvement** ;
- **le jeu au téléphone**.

Deux réglages sont à juger à la main :

- **Le duel sans le bouton est sévère** : environ 3 % de victoires contre l'IA. C'est voulu (le bouton est la mécanique), mais si ça frustre, le hasard (`MEJ`, ×0,5) peut monter.
- **Les buts passent de 3,6 à 5,0 par match** (l'IA contre l'IA), parce qu'une mise en jeu gagnée garde maintenant la possession. À sentir sur un vrai match.

## 3. Ce qui n'est pas réglé

- **Le hors-jeu reste trop fréquent** : 4,8 à 4,9 par match de 6 minutes. La cause est connue : dans les mêlées à la bleue, la prise de rondelle automatique (une portée de 2,9 m) fait toucher la rondelle aux joueurs malgré eux. Marqué 🟡 dans `docs/sur-glace.md`. *Réglé au lot 2 (section 5) : 0,9 par match.*

## 4. Les propositions, dans l'ordre

Tirées de l'inventaire (`docs/sur-glace.md`, ses ⬜ et ses 🟡), classées par ce qu'elles donnent au jeu pour leur effort.

1. **Le hors-jeu des mêlées** (§ 3) — la prise automatique plus courte, ou refusée à un joueur qui ne vise pas la rondelle quand elle le mettrait hors-jeu. Preuve : le nombre de hors-jeu par match, de 4,8 vers une valeur de LNH, et la même part de passes réussies.
2. **La sortie de zone et l'attaque construites** (§ 7) — la passe de sortie au défenseur ou à l'ailier sur la bande, le dump-and-chase, le cycle dans le coin. C'est ce qui fait la différence entre « dix joueurs qui courent » et « du hockey ». Preuve : `check_physique`, la part des sorties de zone réussies, le temps en zone.
3. **L'écran et la déviation devant le gardien** (§ 3, § 5, § 7) — un patineur entre la rondelle et le gardien retarde sa réaction ; l'IA va au filet. C'est la principale façon de marquer dans la vraie LNH, et elle manque.
4. **Les gestes du porteur** (§ 3) — la feinte, protéger la rondelle, le revers et la main du joueur (`np` du shard), la passe laissée. Des boutons de plus, mais ce sont eux qui font un jeu d'adresse.
5. **Les changements de ligne** (§ 6) — à la volée et au choix d'un bouton, comme NHL 94 ; l'IA qui change selon les jambes.
6. **Le jeu physique et les fautes** (§ 4) — la bagarre (le moteur de la saison la sait déjà), le soulèvement du bâton, l'accrochage.
7. **La présentation** (§ 8) — la reprise d'un but, les alignements au départ, les stats d'entracte.
8. **La passerelle avec le Rogue** (§ 8) — jouer un gros match du Rogue sur la glace. C'est le plus gros morceau, et c'est à JP de dire si le résultat compte pour la saison.

## 5. Le lot 2 : que ça joue comme du hockey (version 3.2.6)

Les propositions 1, 2 et 3 de la section 4. Chaque correction pousse le même bâton que la manette ; chaque comportement a son fait mis en scène dans `check_physique` (114 → 136 vérifications, toutes vertes).

### Les chiffres, avant → après

L'IA contre l'IA, 48 matchs de 3 × 2 minutes (les graines `postes-0` à `23` du lot 1, et `postes-100` à `123`), le même harnais avant et après.

| Ce qui est mesuré, par match de 6 min | Avant (3.2.4) | Après (3.2.6) |
|---|---|---|
| Hors-jeu | 5,1 (4,3 et 5,9) | 0,9 |
| Passes réussies | 64 % | 67 % |
| Sorties de zone réussies (sortie, reprise dehors) | 14 % | 29 % |
| … perdues dans sa zone | 73 % | 48 % |
| Rondelle en zone offensive, à soi ou touchée en dernier | 31 % | 32 % |
| En zone offensive, un joueur dans l'enclave | 22 % | 37 % |
| Tirs au but | 98 | 84 |
| Lancers au fond (de la neutre) | 18 | 14, repris 27 % |
| Tirs masqués par un écran | — | 21 % |
| Déviations | 0,55 | 12 |
| % d'arrêts | 92 % | 89,5 % |
| Buts | 3,85 | 3,7 |

Une note sur le point de départ : le rapport du lot 1 disait 5,0 buts et 4,9 hors-jeu par match ; le même harnais sur la version livrée (3.2.4) donne 4,0 et 4,3 sur les mêmes 24 graines. Les chiffres du lot 1 venaient d'une version d'avant ses derniers réglages.

### Le hors-jeu des mêlées

- **La cause**, reproduite en Node (le fil de chaque hors-jeu, image par image) : trois mécanismes. La lame prenait d'elle-même la rondelle à sa portée, le bras levé ; un défenseur à la bleue, la lame dans la zone, cueillait une rondelle sortie et la ramenait dedans, ses avants encore au fond ; une passe d'une pointe à l'autre glissait hors de la zone, et la passe de retour y rentrait. Et un défaut de règle : une rondelle que l'adversaire envoyait dans la zone, cueillie au même pas par un attaquant, était un hors-jeu.
- **La correction, dans le moteur** (`prendraitHorsJeu`, js/physique.js) : le bras levé, un attaquant dans la zone ne prend la rondelle que s'il la vise (le bâton poussé vers elle) ; la rondelle dehors et un coéquipier dedans, la lame ne la ramène pas dans la zone. L'entrée dans la zone se lit du dernier à l'avoir touchée avant la ligne. Les deux règles valent pour toi comme pour l'IA, et se lisent dans les règles de l'écran.
- **Dans l'IA** : le bras levé, on attend dehors hors de portée (on « tague » la bleue) ; pas de passe dans la zone depuis l'extérieur ; les défenseurs tiennent la bleue en dedans.
- **Le check** : « ne prend pas la rondelle qui passe à sa lame s'il ne la vise pas », « ne la ramène pas », « l'IA attend dehors hors de portée », et six matchs mesurés (au plus 1,5 hors-jeu par match, la passe au moins 60 %).

### La sortie de zone et l'attaque construites

- **La cause** : de sa zone, le porteur passait au premier coéquipier qui marquait des points, même couvert ; 73 % des reprises dans sa zone finissaient chez l'adversaire, la plupart sur une passe interceptée dans la demi-seconde.
- **La correction** (`SORTIE`, `sortieDeZone`, js/glace-ia.js) : libre derrière son filet, le défenseur attend 0,8 s que les siens se placent (les ailiers sur la bande, le centre qui revient bas), puis passe à l'avant ouvert, le couloir libre dès sa lame ; pressé sans personne d'ouvert, il la dégage le long de la bande vers son ailier. Plus de passe forcée de sa zone.
- **Le lancer au fond** : hors de la zone d'attaque, le tir part maintenant où pointe le bâton (la visée assistée ne vaut que dans la zone) — c'est la commande du dump, à la manette comme pour l'IA, et il ne compte plus comme un tir au but. L'IA la lance au fond quand deux adversaires bouchent la bleue, dans le coin le moins gardé, puis court après.
- **Le cycle** : au coin et pressé, la rondelle remontée le long de la bande au coéquipier qui attend en haut.
- **Le check** : « la sortie de zone » (elle attend, puis passe à un avant qui la reçoit), « il la dégage le long de la bande », « le lancer au fond » (au fond, et les siens entrent sans hors-jeu), « le cycle », « le tir part où pointe le bâton », et les sorties réussies (au moins 22 %).

### L'écran et la déviation

- **L'écran** (`GARDIEN.ecran`, `masque`) : un patineur de l'une ou l'autre équipe sur la ligne de la rondelle au gardien, le gardien la voit 120 ms plus tard ; démasqué, il la retrouve à double vitesse, pas d'un coup (d'un coup, l'écran ne changeait presque rien : au même tir, 79 % d'arrêts sans écran, 76 % avec ; ainsi, 63 %).
- **La déviation malgré soi** (`BATON.devant`, `devie`, `garde`) : un tir qui frappe une lame à moins de 5 m du filet change de route (±20°) et garde 80 % de sa vitesse ; celle d'un adversaire reste au tireur.
- **L'IA au filet** (`ECRAN_D`, `posteEcran`) : un avant se place sur la ligne du tir, à 1,9 m devant le gardien, le premier servi ; la rondelle libre à nous, l'avant le plus près y va au lieu de chasser ; il tient son bâton quand notre tir part.
- **Le check** : « l'écran » (le même tir, du même point, à la même vitesse : 79 % d'arrêts sans écran, 63 % avec), « la déviation » (la route change), « l'IA envoie un avant au filet », « un joueur dans l'enclave » (au moins 28 % du temps en zone).
- **L'équilibre** : le gardien perd 2,5 points d'arrêts, mais les tirs baissent (les lancers au fond ne comptent plus, l'attaque se construit) : les buts restent à ≈ 3,8 par match, sous la cible de 5 à 6. Rien à compenser.

### Ce qui reste

- **Le temps en zone offensive ne monte pas** (31 → 32 %) : la possession en zone dure 0,1 s en médiane (le harpon et la mise en échec arrivent vite). C'est aussi ce qui garde le cycle rare (≈ 1,2 par match). La suite naturelle : protéger la rondelle (la proposition 4).
- **Les déviations sont nombreuses** (12 par match, dont la plupart sur un bâton adverse devant le filet). À sentir à la manette ; `BATON.devant` (5 m) ou `devie` se règlent si c'est trop.
- **Le dégagement** ne va qu'à l'ailier : un dégagement vers la neutre glisse jusqu'au bout de la glace (la rondelle ne perd rien le long de la bande), un dégagement refusé presque chaque fois. Un frottement le long de la bande (§ 1, 🟡) le rendrait possible.
- **À voir à la manette** : le lancer au fond (ta visée change hors de la zone : le tir part où tu pointes), la lame qui ne prend pas la rondelle le bras levé, l'écran vu de l'écran. Une capture d'une attaque en zone (Toronto chez les Golden Seals) a été faite, sans erreur dans la console ; l'écran en action, lui, n'a pas été vu à l'image.

## 6. Le lot 3 : le porteur a des gestes, et on choisit ses lignes (version 3.2.8)

Les propositions 4 et 5 de la section 4. Chaque geste pousse le même bâton pour toi et pour l'IA ; chacun a son fait mis en scène dans `check_physique` (136 → 157 vérifications, toutes vertes) et sa ligne dans les règles de l'écran.

### D'abord, ce qui coupait la possession

Le lot 2 voyait une possession en zone offensive de 0,1 s en médiane et pensait au harpon. Mesuré (24 matchs de la 3.2.6, 3 575 possessions en zone, ce qui les finit) : 1 908 par un tir, 1 267 par une passe, 100 par un harpon, 84 par une mise en échec. L'IA lance ou passe dans la demi-seconde ; au coin, pressée, elle lançait même d'un angle mort, ce qui tuait le cycle. Protéger la rondelle ne suffisait donc pas : il fallait aussi que l'IA garde la rondelle au coin.

### Les gestes

| Le geste | Comment il se joue | La constante | La preuve (check_physique) |
|---|---|---|---|
| **Protéger la rondelle** | Sans bouton : plus lent que 20 km/h, un adversaire debout à 2,6 m, la lame passe de l'autre côté du corps. Tourne-lui le dos : son harpon doit passer par ton corps | `PROTEGE` : 0,75 m de côté ; le harpon × 0,3 | Le même harpon, du même mètre et demi : 8 réussis sur 60 dans ton dos, 26 sur 60 de face |
| **L'IA au coin** | Pressée, sans passe, elle file lentement le long de la bande, dos au poursuivant, 1,6 s au plus, le temps qu'un coéquipier s'ouvre en haut ; elle ne lance plus de là, et ne harponne pas une rondelle cachée derrière un corps | `COIN` (js/glace-ia.js) | « l'IA protège dans le coin » : le bâton à 0,3, loin de lui, 31 images sur 31 |
| **La feinte** | Y avec la rondelle ; le bâton dit de quel côté, au neutre vers le revers | `FEINTE` : 1 m, 0,3 s, 1 s de repos, la poussée à 60 % | 0 harpon réussi sur 40 pendant la feinte (18 sur 40 sans) ; la charge ne renverse pas ; l'IA feinte devant un défenseur seul (`FEINTE_IA`) |
| **Le revers et la main** | La lame du côté de la main (la LNH la dit : `np` RD/LD, `sc` ; sans donnée, gaucher). La rondelle de l'autre côté du corps, ou lancée à plus de 74° du cap vers ce côté : le revers. Le tir sur réception ne part que du coup droit | `BATON.cote` 25 cm ; `REVERS` : le tir à 82 %, 1,5 fois l'écart ; la passe à 85 %, 1,6 fois | Le même tir du poignet, du même point, le filet à sa gauche : un droitier 89 km/h et 1,3° d'écart, un gaucher (du revers) 73 km/h et 2,2° |
| **La passe laissée** | A, le bâton tiré vers l'arrière, un coéquipier qui te suit (derrière, 6 m au plus, lancé dans ton sens) ; personne qui suit, c'est une passe | `LAISSEE` : 1,5 m/s | La rondelle reste derrière, celui qui suit la prend ; sans lui, une passe |

### Les lignes

- **Choisir son trio** : Y à l'arrêt de jeu, le trio suivant ; l'invite le nomme avec ses jambes (« Trio 3 (jambes 100) »). Il joue même fatigué ; encore Y pendant la mise en jeu, elle se replace avec le suivant. Les paires de défenseurs restent aux jambes. Check : le trio 2 choisi à 40 jambes est celui qui joue ; le trio 3 aussi.
- **À la volée, par la porte** : chaque club a sa porte sur la bande, à 5 m du centre (dans la neutre : personne n'entre hors-jeu), du côté de son filet de la première période — en deuxième, la présence est plus longue. Un patineur qui demande le banc et arrive à 1,4 m de la porte sort ; au même instant, le plus reposé de son groupe entre par la même porte. Un pour un, jamais téléporté. Toi, fatigué (sous 60 jambes), tu y patines et tu sors. Check : trois avants à 45 jambes, un trio frais au banc, la rondelle loin : trois changements, chacun entre à la porte (à 0,02 m au plus), au plus 5 sur la glace, et au banc leurs jambes remontent (45 → 67 à 76 en 8 s).
- **L'IA change selon les jambes** : la rondelle loin (dans leur moitié, hors de leur zone, pas à eux), un groupe sous 60 jambes en moyenne file à la porte s'il y a une ligne à 80 au banc ; dans leur zone, elle reste, sauf sous 40 ; l'adversaire qui porte la rondelle chez elle, elle revient. Aux arrêts, `habiller` change comme avant.
- **Un défaut trouvé en chemin** : le gardien remis en jeu revenait au filet avec les six patineurs sur la glace jusqu'à l'arrêt suivant (1 200 à 5 000 images par 24 matchs, IA contre IA). Il attend maintenant qu'un patineur sorte par la porte ; à l'arrêt de jeu, il revient tout de suite. Le check compte les images de trop dans les matchs mesurés : 0.

### Les chiffres, avant → après

L'IA contre l'IA, 96 matchs de 3 × 2 minutes (les graines `postes-0` à `23`, `100` à `123`, `200` à `223`, `300` à `323`), le même harnais que le lot 2.

| Par match de 6 min | 3.2.6 | 3.2.8 |
|---|---|---|
| Cycles (du coin, le long de la bande, au coéquipier en haut) | 1,1 | 4,0 |
| Possession en zone offensive, % du jeu (deux clubs) | 8,5 % | 9,6 % |
| … la durée d'une possession en zone : médiane, 75e, 90e centile | 0,10, 0,28, 0,64 s | 0,10, 0,34, 0,74 s |
| Le porteur protège, % du temps en zone | — | 10 % |
| Harpons réussis | 58 | 48 |
| Tirs du revers | — | 16 % |
| Feintes | — | 10 |
| Changements à la volée | — | 71 |
| Buts | 3,8 | 3,9 |
| Hors-jeu | 1,1 | 0,9 |
| Passes réussies | 67 % | 66 % |
| Punitions | 1,0 | 0,8 |
| En zone, un joueur dans l'enclave | 39 % | 36 % |
| % d'arrêts | 89,1 | 89,8 |

Deux réglages ont été faits en route, pour l'équilibre : le premier jet (le revers dès 34° du cap, à 75 % et 1,8 fois l'écart) faisait 40 % des tirs du revers, et avec ses autres défauts depuis corrigés, 3,0 buts par match (74° et 82 % : 16 % des tirs, 3,9 buts) ; l'IA qui ne chargeait plus un porteur qui protège ne prenait presque plus de punitions (0,25 par match) — elle charge comme avant, seul le harpon dans le dos est retenu.

### Ce qui reste

- **La médiane ne bouge pas** (0,10 s) : la plupart des possessions en zone sont des tirs sur réception et des passes du premier coup, voulus. Ce qui s'allonge, c'est la queue (75e et 90e centiles) et le cycle.
- **Les sprites tiennent tous le bâton de la même main** : la rondelle d'un droitier, ou celle qu'on protège, est à côté de la lame dessinée (25 cm, puis 75 cm). Des sprites en miroir pour les droitiers se rendraient par scripts/sprites/rendu.mjs (le double des images).
- **La passe laissée de l'IA est involontaire** : ≈ 26 par match, quand elle passe en arrière à un coéquipier qui la suit. Elle ne la cherche pas.
- **Les joueurs au banc ne se voient pas** : la porte est dessinée aux couleurs du club, pas le banc.
- **À sentir à la manette** : la protection automatique (est-ce qu'elle se sent, ou faut-il la tenir sur LB ?) ; la feinte, qui pourrait être trop sûre contre l'IA (elle mord à tout coup pendant 0,3 s, une feinte par seconde) ; le trio choisi qui se replace pendant la mise en jeu ; les changements à la volée de tes coéquipiers (≈ toutes les 30 s par groupe, des présences plus courtes que dans la LNH : `JAMBES.volee` à 50 les allongerait).
- **Les captures** : un porteur qui protège au coin, le dos au poursuivant, la rondelle de l'autre côté (`protege-2.png`), et l'invite du trio à l'arrêt de jeu (`trio.png`), Chromium sans tête, 1280 × 720, aucune erreur dans la console. Le changement à la volée n'a pas été vu à l'image.

## 7. Le lot 4 : le jeu physique, les fautes et la présentation d'un match (version 3.2.10)

Les propositions 6 et 7 de la section 4 : ce qui fait qu'un match de NHL 94 se raconte. Chaque geste pousse le même bâton pour toi et pour l'IA, chaque faute se siffle sur un fait mis en scène dans `check_physique` (157 → 170 vérifications, toutes vertes), et chaque chiffre dit à l'écran vient d'une constante (deux lignes de plus dans les règles).

### Le jeu physique et les fautes

| Le geste | Comment il se joue | La constante | La preuve (check_physique) |
|---|---|---|---|
| **Soulever le bâton** | X sans la rondelle, le piton du harpon. Collé au porteur (1,5 m au plus), de côté (ni devant lui ni dans son dos), la rondelle à portée de ta lame : tu lui lèves le bâton et tu prends la rondelle. Sans contact, sans punition ; son corps n'y change rien, sa feinte oui. L'invite dit « Soulever le bâton » quand tu es bien placé | `LEVE` : 80 % d'un harpon ouvert (la Défense contre le Jeu) | Le porteur qui protège : 27 rondelles volées sur 60 de côté, 8 harpons réussis sur 60 dans son dos ; 0 punition |
| **L'accrochage** | Un harpon raté par-derrière sur un porteur lancé à plus de 22 km/h : deux minutes, et il le ralentit | `FAUTES.accroche` 25 %, `rapide` 6 m/s | 98 sur 370 harpons ratés à 8 m/s (le dé : 24 % après le trébuchement), 0 à 3 m/s |
| **Le cinglage** | Un harpon raté en fonçant sur le porteur à plus de 18 km/h | `FAUTES.cinglage` 3,5 %, `fonce` 5 m/s | 28 sur 684 en fonçant, 0 arrêté |
| **Le bâton élevé** | Un harpon raté à travers le corps du porteur (il protège) | `FAUTES.eleve` 10 % | 37 sur 364 |
| **La bagarre** | Après une mise en échec de plus de 900 kg·m/s ou une punition, le frappé et le frappeur (la victime et le puni) laissent tomber les gants, au dé de leur rudesse : la Robustesse au-dessus de 11 sur 20 (en deçà, jamais), fois leurs vraies minutes de punition par match à la LNH (`pim` et `gp` du shard, de 0,3 à 3 fois). Une par joueur, jamais en prolongation. Le jeu s'arrête, la caméra va aux deux ; 3,5 s de duel : A ou X martelés (l'IA, 5 coups par seconde), chaque coup pèse la Robustesse et la masse. Cinq minutes chacun, coïncidentes ; la foule se lève, le coup de poing | `BAGARRE` | Deux durs à cuire : les gants tombent ; toi qui martèles à 7,5 coups par seconde, tu gagnes, sans le bouton tu perds ; 5 minutes chacun, 5 contre 5 à la mise en jeu, sortis du cachot ils rentrent au banc ; deux joueurs ordinaires, 0 bagarre en 30 gros coups |

**Les punitions coïncidentes** : une punition garde maintenant les secondes qui comptent pour l'avantage (`avantage`) ; la majeure d'une bagarre n'en a pas. La mineure et la majeure d'un même joueur se suivent (un but en avantage n'efface que la mineure) ; sa mineure finie, son club, à court, reçoit un patineur par la porte (`renfort`) ; sorti du cachot, le puni saute sur la glace si son club y manque d'un patineur, sinon il rentre au banc (`liberer`). L'IA lit le désavantage de là (`penalisesDe`).

**L'IA** soulève le bâton collée au porteur, la rondelle cachée ou pas (elle ne harponnait pas une rondelle cachée, le lot 3). Elle ne cherche pas la faute : ce sont ses harpons ratés qui la font.

### La présentation

- **La reprise d'un but** (js/sur-glace.js, `REPRISE`) : l'écran garde ce qu'il dessine, un tampon des positions, des poses et de la rondelle. Une seconde après un but, le match s'arrête et les 4 s d'avant le but, plus 0,6 s, repassent au ralenti (× 0,4), la caméra sur la rondelle d'alors, la lumière qui s'allume au but. A, X, Start ou le doigt la passent ; à deux, chacun le peut (elle ne gêne pas : un appui). Pas de reprise pour le but qui finit le match, un tir de barrage ou un tir de punition. Le moteur, lui, ne se rejoue pas : son hasard (`de`) ne se garde pas, ce sont les images dessinées qui repassent.
- **Les partants** : au coup d'envoi, le trio et la paire de chaque club, puis son gardien, une ligne chacun ; le match attend « ▶ Au jeu » (A, X, Start).
- **L'entracte** : à chaque fin de période, le pointage, les tirs, les tirs bloqués, les mises en échec, les mises en jeu gagnées, le % d'arrêts de chaque gardien, les minutes de punition et les buts par joueur ; la fin du match lit les mêmes stats (le % d'arrêts en plus).

### Les chiffres, avant → après

L'IA contre l'IA, 96 matchs de 3 × 2 minutes, les graines du lot 3 (`postes-0` à `23`, `100`, `200`, `300`), le même harnais ; puis de vrais clubs (douze saisons, de 1975-76 à 2023-24, bâtis comme l'écran les bâtit), 96 matchs, pour la bagarre (les clubs inventés du harnais n'ont que des défenseurs de Robustesse 14).

| Par match de 6 min | 3.2.8 | 3.2.10 |
|---|---|---|
| Punitions | 0,76 | 1,88 |
| … dont l'accrochage, le cinglage, le bâton élevé | — | 0,14, 0,53, 0,23 |
| Minutes de punition | 1,5 | 4,1 |
| Bâtons soulevés (réussis) | — | 29 (40 %) |
| Harpons réussis | 48,5 | 46,3 |
| Buts | 3,94 | 4,03 |
| Hors-jeu | 0,93 | 0,98 |
| Passes réussies | 66,3 % | 66,8 % |
| % d'arrêts | 89,8 | 90,1 |
| Cycles | 4,0 | 3,7 |
| De vrais clubs : bagarres | — | 0,20 (17 matchs sur 96) |
| De vrais clubs : punitions | — | 1,75 |

Trois réglages en route : le premier jet des fautes (un seul dé, 10 %, pour le cinglage et le bâton élevé) donnait 1,4 cinglage par match à lui seul — l'IA harponne en fonçant ≈ 14 fois par match ; le cinglage a pris son propre dé (3,5 %) et un seuil plus haut (5 m/s). La bagarre après une « grosse » mise en échec de 1,6 fois le seuil de chute (480 kg·m/s) aurait eu ≈ 135 occasions par match ; à 3 fois (900), ≈ 2 avec les clubs inventés, ≈ 6 avec de vrais clubs, plus lourds. Le dé de la bagarre est passé de 0,25 à 0,75 pour qu'elle arrive à un match sur cinq ou six avec de vrais clubs (un sur douze avant). Et un défaut trouvé en chemin : le puni d'une majeure coïncidente revenait sur la glace d'un club déjà à cinq (1 053 images de trop sur 24 matchs) ; il rentre au banc.

### Ce qui reste

- **Le double-échec, la rudesse après le sifflet, l'inconduite** : pas faits. La majeure n'existe que pour la bagarre.
- **La bagarre de l'IA contre toi est rare et subie** : tu ne la provoques pas, et tu ne la refuses pas. NHL 93 avait un bouton pour se battre ; à décider. Le duel est simple (marteler) ; un coup et une esquive seraient la suite.
- **La reprise rejoue des images, pas le moteur** : elle ne peut pas changer d'angle ni reculer. Un vrai rejeu demanderait de garder l'état du hasard (`generateur`) avec l'état du match.
- **Les clubs inventés du harnais** se battent presque jamais (0,04 par match) : le check ne mesure la fréquence que sur des faits mis en scène ; la fréquence vraie vient du harnais à vrais clubs (scratchpad), pas de `check_physique`.
- **La règle de `.claude/rules/sur-glace.md`** dit qu'un vrai joueur n'apporte que ses cotes sur 20 et son poids : il apporte aussi sa main (le lot 3) et ses minutes de punition (le lot 4). À écrire si JP le garde.
- **À sentir à la manette** : soulever le bâton (est-ce que « collé de côté » se trouve sans y penser, ou faut-il un piton à part ?) ; les fautes (1,9 punition par match de 6 min, c'est près de cinq par match de 15 min : à voir si c'est trop) ; le duel de la bagarre (7,5 appuis par seconde battent un dur de l'IA ; un enfant au téléphone ?) ; la reprise (le ralenti à × 0,4 dure 11 s : la passer est-il assez évident ?).
- **Les captures** (Chromium sans tête, 1280 × 720, aucune erreur dans la console) : les partants (`alignements.png`), une montée et son but repris au ralenti (`montee.png`, `reprise-0.png` à `reprise-5.png`), une bagarre (`bagarre.png`, `bagarre-fin.png`) et l'entracte (`entracte.png`).

## 8. Le lot 5 : la finition et l'équilibre (version 3.2.12)

Un lot de finition : ce que la section 7 laissait douteux (le rythme des punitions, le compte des tirs, la main des sprites) et deux ⬜ de l'inventaire (le gardien qui joue la rondelle, la célébration). Chaque comportement a son fait mis en scène dans `check_physique` (170 → 185 vérifications, toutes vertes).

### Les punitions au rythme de la LNH

- **La cause** : 1,88 punition par match de 6 min (IA contre IA), trois fois la LNH (≈ 3 par club par 60 min, ≈ 0,6 par 6 min pour deux clubs). Le gros n'était pas un dé : 0,81 venaient de **charges par-derrière**. Reproduit (24 matchs, chaque charge sifflée, son fil) : 20 sur 20 sur un joueur **sans la rondelle**, chargé de face par l'IA, qui venait de passer et se détournait pendant les 0,35 s de l'élan ; puis, ce défaut corrigé, des charges sur un **autre** adversaire, de dos sur le chemin du frappeur.
- **La correction** : la charge par-derrière ne se siffle que si la victime montrait déjà le dos quand le frappeur s'est élancé (`elanDos`, `dosTourne`, js/physique.js ; la règle 43 de la LNH : celui qui se détourne au dernier instant se met lui-même en danger) ; l'IA ne s'élance pas avec un autre adversaire de dos sur son chemin (js/glace-ia.js). Les dés de `FAUTES` : l'accrochage 25 → 10 %, le cinglage 3,5 → 2,5 %, le bâton élevé 10 → 8 %. Une ligne de règle le dit.
- **La preuve** : « la charge par-derrière ne se siffle que sur un dos déjà tourné » (le même coup que la punition du lot 1, la victime détournée pendant l'élan : le coup porte, pas de punition) ; les faits du lot 4 (le taux de chaque faute suit son dé) restent verts.

### Le compte des tirs et des arrêts

- **La cause** : `M.tirs` comptait chaque tir **tenté** de la zone (`tirer`) : à côté, sur le poteau, par-dessus la barre, bloqué. Le % d'arrêts, lui, comptait les arrêts et les buts. D'où CGY 2 tirs pour 1 but et le gardien de BUF à 0,0 % : un tir à côté, un but. Deux écarts de plus : le gardien comptait l'arrêt d'une rondelle venue de son propre club, et les arrêts des tirs de barrage (que le % excluait des buts).
- **La correction** : un tir au but est un arrêt ou un but (`tirAuBut`) ; la déviation compte à qui l'a déviée ; ni la rondelle de son club ni les tirs de barrage. Les tirs du joueur (`stats.tirs`, la fin du match) suivent.
- **La preuve** : trois faits (un tir arrêté : 1 tir, 1 arrêt ; un but : 1 tir ; à côté, au poteau, bloqué : 0) et, sur les matchs mesurés, pour chaque club, tirs = arrêts du gardien adverse + buts (192 clubs sur 192 dans le harnais, 12 sur 12 dans le check). Il y a ≈ 37 tirs au but par match pour ≈ 86 tirs tentés de la zone.

### Les sprites tiennent le bâton de la bonne main

- **La cause** : les poses posaient la lame au milieu, devant les patins ; le moteur la tient à 25 cm du côté de la main (le lot 3), à 75 cm quand on protège.
- **La correction** (scripts/sprites/rendu.mjs, puis js/sprites.js) : la lame posée du côté de la main (`BATON.cote`, lu du moteur) et ramenée où le jeu dessine la rondelle (14 pixels par mètre, tassés par la plongée) ; le droitier est le même corps **en miroir, rendu** sous la même lumière (pas retourné à l'écran) ; une pose de plus, « protège » (la lame à `PROTEGE.cote`). `spriteDe` choisit la planche du côté de `s.lat` : la main, ou l'autre côté quand il protège ou feinte. Le garde du script (`fileURLToPath`) le fait aussi tourner sous Windows.
- **Le poids** : rendre tout deux fois doublait le fichier (155 → 309 Ko, gzip 23 → 45). Le droitier n'a pas la chute ni l'épaule (sans la rondelle, la main ne s'y lit pas : celles du gaucher servent), et une suite de vides s'écrit par son nombre : **155 → 179 Ko, gzip 23 → 41 Ko**. js/sprites.js n'est chargé qu'à l'ouverture de Sur glace, pas au premier écran.
- **La preuve** : « la lame dessinée est du côté de la lame du moteur » (56 images sur 56 où la lame se voit, les deux mains, quatre poses, huit directions ; à 2,4 pixels au plus de la rondelle). Les aperçus avant et après ont été lus ; la capture `mains.png` montre un gaucher et un droitier côte à côte.

### Le gardien qui joue la rondelle, et le trapèze

- **Le geste** (`GARDIEN.jouer`, `aJouer`, `jouerLaRondelle`) : une rondelle libre derrière sa ligne, plus lente que 18 km/h, dans le trapèze, et lui dessus 0,3 s avant tout adversaire (un coéquipier qui y est bien avant lui la prend) : il fait le tour du filet, la remet au coéquipier ouvert (un défenseur d'abord, aucun adversaire à 1,6 m du couloir), sinon la dégage le long de la bande, puis revient. Derrière sa ligne, il ne gèle plus rien.
- **Le trapèze** (la règle de 2005, 18 pieds à la ligne des buts, 28 à la bande, dessiné sur la glace) : dehors, il ne va pas la chercher ; s'il la joue dehors — il l'a vue dedans, 170 ms plus tôt, et elle a glissé —, deux minutes, purgées par un patineur sur la glace.
- **La preuve** : quatre faits (la remise au défenseur, sorti à 0,9 m derrière sa ligne ; le retour devant le filet ; la bande ; dehors, il ne bouge pas) et la punition du trapèze mise en scène. IA contre IA : **≈ 0,2 fois par match** de 6 min.

### La célébration d'un but

- **Le moteur** (`CELEBRATION`, `feter`) : le jeu arrêté, 2,5 s, les coéquipiers du buteur patinent à lui (5 m/s au plus) et s'y serrent sans s'empiler ; les autres freinent. La pause d'un but passe de 2,5 à 3,5 s ; la reprise commence à la fin de la célébration (`REPRISE.attente` lit `CELEBRATION.duree`).
- **L'écran** : le buteur lève son bâton ; la foule tape des mains en cadence, trois fois trois coups (`ovation`, js/sons-glace.js), une poignée de partisans pour les visiteurs.
- **La preuve** : « la célébration » (les coéquipiers de 11,2 à 2,0 m du buteur, ceux d'en face ne bougent pas), puis la mise en jeu au centre.

### Les chiffres, avant → après

L'IA contre l'IA, 96 matchs de 3 × 2 minutes, les graines du lot 3 et du lot 4, le même harnais.

| Par match de 6 min | 3.2.10 | 3.2.12 |
|---|---|---|
| Punitions | 1,88 | 0,63 |
| … la charge par-derrière, le cinglage, le bâton élevé, l'accrochage, le trébuchement | 0,81, 0,53, 0,23, 0,14, 0,14 | 0,00, 0,27, 0,16, 0,05, 0,10 |
| Minutes de punition | 4,1 | 1,4 |
| Buts | 4,03 | 3,95 |
| % d'arrêts | 90,1 | 89,7 |
| Hors-jeu | 0,98 | 1,08 |
| Passes réussies | 66,8 % | 66,6 % |
| Tirs au but (un arrêt ou un but) | — | 36,6 |
| Clubs où tirs ≠ arrêts + buts | presque tous | 0 sur 192 |
| Le gardien joue la rondelle | — | 0,2 |

Deux réglages en route, pour l'équilibre. Le premier jet des dés (1,5 % de cinglage, 5 % de bâton élevé) donnait 0,59 punition, en bas de la cible : remontés à 2,5 et 8 %. Et moins de punitions, ce sont moins d'avantages numériques : les buts sont tombés de 4,03 à 3,6–3,8 (quatre mesures ; le bruit de 96 matchs est de ±0,2). Les trous du gardien entre les jambières et sur le corps sont passés de 0,2 et 0,03 à 0,25 et 0,04 : 3,95 buts, 89,7 % d'arrêts.

### Ce qui reste

- **Le gardien joue rarement la rondelle** (≈ 0,2 par match de 6 min, deux par soirée de 60 min) : derrière le filet, la rondelle lente a presque toujours un patineur plus près. Arrêter le dégagement qui fait le tour de la bande, pour son défenseur, serait la suite.
- **La charge par-derrière ne se voit presque plus** entre deux IA (0,01 par match) : c'est toi qui peux la prendre. À sentir : celle qu'on t'inflige paraît-elle juste ?
- **Les sprites** : la lame se voit peu de dos ; la pose « protège » de profil cache parfois la lame derrière le corps ; le droitier qui chute ou donne l'épaule prend un éclair le sprite du gaucher ; le gardien est toujours de la même main.
- **La célébration** n'a pas de pose dédiée (pas d'accolade) : les joueurs se serrent, le buteur lève le bâton.
- **À sentir à la manette** : 0,63 punition par match de 6 min, c'est ≈ 1,6 par match de 15 min — l'avantage numérique devient rare ; la célébration de 2,5 s avant la reprise ; le trapèze sur la glace se comprend-il ?
- **Les captures** (Chromium sans tête, 1280 × 720, aucune erreur dans la console) : un gaucher et un droitier côte à côte, et un patineur qui protège (`mains.png`), le gardien derrière son filet (`gardien-sort.png`, `gardien-joue.png`, `gardien-revient.png`), la célébration (`fete-1.png`, `fete-2.png`).

## Comment ces chiffres ont été faits

`node scripts/check_physique.mjs` (98 vérifications avant le lot 1, 114 après, 136 après le lot 2, 157 après le lot 3, 170 après le lot 4, 185 après le lot 5, toutes vertes), `node scripts/tout.mjs` (35 scripts) et `node scripts/check_mort.mjs`, verts. Les mesures du positionnement : l'IA contre l'IA, 24 matchs de 3 × 2 minutes. La capture : Chromium sans tête, 1280 × 720, aucune erreur dans la console.
