# L'atelier de pixel art — le guide du graphiste

Les planches du jeu vivent dans `scripts/sprites/planches/` (s, se, e, ne, n, gardien) ; `node scripts/sprites/assembler.mjs` réécrit `js/sprites.js`. Pour retoucher un sprite : modifie sa planche, rends-la (`node scripts/sprites/apercu.mjs scripts/sprites/planches/s.mjs /tmp/s.png 8`), regarde, puis assemble.

Tu dessines les sprites d'un jeu de hockey 2D « Sur glace » (un jeu web, en français québécois), dans le style
des jeux de hockey 16 bits (NHL 94, NHL 95 sur SNES et Genesis). Le joueur a montré ces planches en référence et
a jugé nos essais procéduraux « laids » : il veut du VRAI pixel art dessiné à la main, lisible, avec des
animations claires.

## Le format

Un module ES qui exporte `PLANCHE` :

```js
export const PLANCHE = {
  S: {                       // la direction (où le joueur REGARDE, sur l'écran) : S = vers le bas de l'écran (vers nous)
    repos: [ '................................', … 48 lignes de 32 caractères ],
    patin1: [...], patin2: [...], patin3: [...], patin4: [...],
    charge: [...], tir: [...], passe: [...], echec: [...], chute: [...],
  },
  SE: { ... }, E: { ... }, NE: { ... }, N: { ... },
};
```

- Chaque image : **32 colonnes × 48 lignes** de caractères, `.` = transparent.
- La LÉGENDE (une lettre = une matière, la couleur vient du club dans le jeu) : voir `apercu.mjs` (`LEGENDE`).
  `k` contour · `J j d` chandail (base, clair, foncé) · `T` bande du club (épaules, ourlet, poignets, bas) · `W` numéro, blancs
  · `S s` peau · `H h` casque · `P p` pantalon · `G` gants · `K` patin · `L` lame du patin · `B` manche du bâton · `b` ruban de la lame (noir)
  · `o` pixel d'ombre au sol (tramé, un pixel sur deux).
- **L'ANCRE : les patins sont au pixel (16, 32)** (colonne 16, ligne 32 — la croix rouge de l'aperçu). Le moteur pose
  ce point sur la position du joueur. Le corps monte au-dessus (lignes 10 à 32 environ) ; ce qui est « devant » le
  joueur sur la glace (le bâton, la lame) descend en dessous quand il regarde vers le bas.
- **LA LAME DU BÂTON** doit être à 14 pixels DEVANT l'ancre, dans la direction regardée (le moteur y colle la rondelle) :
  S → (16, 46) · SE → (26, 42) · E → (30, 32) · NE → (26, 22) · N → (16, 18). Pour N et NE, la lame est derrière le corps : dessine-la quand même (ce qui dépasse).
- Les directions SW, W, NW sont obtenues en MIROIR de SE, E, NE : n'en dessine pas.
- Le gardien a sa propre planche (`gardien.mjs`) : directions S, E, N ; poses `garde`, `papillon`, `mitaine`, `bloqueur`.

## La vue

Vue de trois quarts du dessus, comme NHL 94 : on voit le dessus du casque ET le visage (quand il regarde vers le bas),
le dos et le numéro (quand il regarde vers le haut), le profil de côté. Le sol est à plat (pas de perspective) :
les patins touchent l'ancre, la hauteur monte tout droit vers le haut de l'image.

## Le personnage (le même dans toutes les poses et directions)

- Trapu, environ **22 pixels de haut** du patin au dessus du casque, 2,5 à 3 têtes de haut : grosse tête, gros
  casque rond (`H`, un reflet `h` en haut à gauche), visage `S` sous la visière avec deux pixels d'yeux `k`.
- Épaules larges (la bande `T` fait le joug), le chandail `J` avec son ombre `d` sur le côté droit de l'image et sous
  les bras, un reflet `j` discret en haut à gauche ; les poignets `T` ; un ourlet `T` en bas du chandail.
- Le numéro `W` dans le dos (visible de N et NE) : deux chiffres stylisés de 3 × 5 pixels, ou un bloc.
- Pantalon `P` court et foncé, bas `J` avec une rayure `T`, patins `K` noirs à lame `L` blanche d'un pixel.
- Gants `G` ; le bâton : un manche `B` d'UN pixel de large, droit, avec la lame `b` noire (3 à 5 pixels) ; il part
  des deux gants. Gaucher ou droitier, peu importe, mais la lame finit au point donné plus haut.
- **Le contour** `k` : autour de toute la silhouette, UN pixel, et aux séparations importantes (la tête / le corps,
  les bras / le tronc, les jambes). Pas de contour entre deux tons d'une même matière.
- **L'ombre au sol** : une petite ellipse tramée de `o` sous et un peu à droite des patins (lignes 32 à 35).

## Les règles du pixel art (ce qui fait « propre » et « console »)

1. **La silhouette d'abord** : la pose doit se lire en noir sur blanc. Exagère : la jambe qui pousse part LOIN de
   côté, le bâton levé est VERTICAL au-dessus de la tête à la charge, le fouetté pointe loin devant.
2. **Peu de couleurs** : 2 à 3 tons par matière, pas plus. La lumière vient du haut à gauche : le reflet en haut à
   gauche, l'ombre en bas à droite. JAMAIS d'« oreiller » (des anneaux concentriques de tons).
3. **Des lignes propres** : les diagonales en marches régulières (1-1-1 ou 2-2-2), jamais des « doubles » (deux
   pixels côte à côte dans une diagonale fine) ni des « jaggies ».
4. **Le tramage** seulement pour l'ombre au sol (un pixel sur deux). Pas de tramage sur le corps.
5. **Les grappes** : des taches de couleur franches (un bloc de 2 × 2 ou plus), pas des pixels isolés qui font du bruit.
6. **Le contour sélectif** : noir autour de la silhouette ; à l'intérieur, utilise le ton foncé de la matière pour
   séparer, et le noir seulement là où ça aide la lecture (sous le casque, entre les jambes).
7. **La cohérence** : la même tête, les mêmes épaules, la même taille dans toutes les poses et directions. Une
   animation, c'est la MÊME silhouette qui bouge : compare tes images entre elles.

## Les poses (toutes, dans chaque direction)

- `repos` : debout, genoux un peu pliés, le bâton sur la glace devant.
- `patin1` à `patin4` : le cycle de patinage, boucle : 1 = jambe droite qui pousse loin de côté, jambe gauche sous
  le corps ; 2 = les deux jambes sous le corps, le corps un peu plus haut ; 3 = jambe gauche qui pousse loin de côté ;
  4 = les deux sous le corps. Le tronc penché vers l'avant, les bras et le bâton balancent un peu.
- `charge` : le lancer frappé qui se charge : le bâton DROIT EN L'AIR au-dessus de la tête (vers l'arrière), les
  genoux pliés, le regard devant. C'est la pose la plus lisible du jeu.
- `tir` : le fouetté : le bâton loin devant, en l'air, le corps tourné, une jambe tendue derrière.
- `passe` : un balayage court : le bâton devant, sur la glace, les bras tendus.
- `echec` : la mise en échec : l'épaule gauche devant, le tronc couché vers l'avant, les bras repliés, le bâton bas.
- `chute` : couché sur la glace, à plat, la tête vers l'avant (dans la direction regardée), les patins derrière,
  le bâton par terre à côté. Comme le joueur est à plat, l'image fait environ 24 pixels de long sur 10 de haut,
  centrée sur l'ancre.

## Ta méthode (obligatoire)

1. Écris ta planche dans TON fichier (`artiste-<ton nom>.mjs`).
2. Rends-la : `node apercu.mjs artiste-<nom>.mjs artiste-<nom>.png 6` (l'outil refuse une image mal formée et dit où).
3. REGARDE le PNG (l'outil Read lit les images) à chaque tour, critique-le comme un directeur artistique
   (silhouette ? lecture de la pose ? cohérence entre images ? lignes propres ? trop de bruit ?), corrige, rends encore.
   Fais au moins trois tours. Ne t'arrête que quand tu serais fier de le montrer à côté de NHL 94.
4. Rends compte en deux phrases : ce que tu as dessiné, ce que tu changerais encore.

## Ce que la recherche ajoute (RECHERCHE.md, à lire aussi)

- **Proportions de 16 bits, pas de chibi** : tête ≈ 6-7 pixels, le corps 3 à 3,5 têtes de haut ; les bras et les jambes font 2 pixels d'épais, jamais 1.
- **3 tons par matière, 8 à 12 couleurs** : la lettre de base, sa claire, sa foncée. L'ombre d'une couleur tire vers le violet, le reflet vers le jaune (le jeu s'en charge : toi, place les lettres).
- **Zéro tramage sur le corps.** L'ombre au sol est un calque À PART : NE LA DESSINE PAS (le jeu pose une ellipse sous les patins). La lettre `o` n'est plus à utiliser.
- **Le contour** : foncé local (le ton foncé de la matière) à l'intérieur ; `k` seulement au bord extérieur, là où le sprite touche la glace.
- **La silhouette en aplats d'abord** : bloque le bonhomme en 4 couleurs pleines, vérifie qu'il se lit rempli en noir, puis ajoute les tons.
- **Le cycle de patinage** : quatre poses-clés (contact, descente, passage — le plus haut —, élan) ; la tête descend 1 pixel, 1 pixel, puis remonte 2 d'un coup.
- **Une action** (la charge, le fouetté) : l'anticipation, puis l'extension tenue, un pixel plus loin dans la cible.
