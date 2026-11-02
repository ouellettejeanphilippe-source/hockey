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

## 5. Le lot 2 : que ça joue comme du hockey (version 3.2.5)

Les propositions 1, 2 et 3 de la section 4. Chaque correction pousse le même bâton que la manette ; chaque comportement a son fait mis en scène dans `check_physique` (114 → 136 vérifications, toutes vertes).

### Les chiffres, avant → après

L'IA contre l'IA, 48 matchs de 3 × 2 minutes (les graines `postes-0` à `23` du lot 1, et `postes-100` à `123`), le même harnais avant et après.

| Ce qui est mesuré, par match de 6 min | Avant (3.2.4) | Après (3.2.5) |
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

## Comment ces chiffres ont été faits

`node scripts/check_physique.mjs` (98 vérifications avant le lot 1, 114 après, 136 après le lot 2, toutes vertes), `node scripts/tout.mjs` (35 scripts) et `node scripts/check_mort.mjs`, verts. Les mesures du positionnement : l'IA contre l'IA, 24 matchs de 3 × 2 minutes. La capture : Chromium sans tête, 1280 × 720, aucune erreur dans la console.
