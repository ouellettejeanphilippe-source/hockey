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

- **Le hors-jeu reste trop fréquent** : 4,8 à 4,9 par match de 6 minutes. La cause est connue : dans les mêlées à la bleue, la prise de rondelle automatique (une portée de 2,9 m) fait toucher la rondelle aux joueurs malgré eux. Marqué 🟡 dans `docs/sur-glace.md`.

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

## Comment ces chiffres ont été faits

`node scripts/check_physique.mjs` (98 vérifications avant, 114 après, toutes vertes), `node scripts/tout.mjs` (35 scripts) et `node scripts/check_mort.mjs`, verts. Les mesures du positionnement : l'IA contre l'IA, 24 matchs de 3 × 2 minutes. La capture : Chromium sans tête, 1280 × 720, aucune erreur dans la console.
