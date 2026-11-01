# Les sprites de Sur glace — le rendu

`node scripts/sprites/rendu.mjs` réécrit `js/sprites.js` (une minute et demie). Pour regarder une partie de la planche :
`DIRS=S,E POSES=repos,tir node scripts/sprites/rendu.mjs --apercu /tmp/x.png` (`GARDIEN=1` pour le gardien, `ECHELLE=8` pour agrandir).

## Comment c'est fait

Comme les sprites précalculés des années 90 : un joueur en volumes, posé, vu de trois quarts, réduit en pixels.

- **Le modèle** (`modele`) : le bassin, le torse (l'empiècement des épaules et l'ourlet en bande du club), les épaulettes,
  la tête (le casque, le visage), les jambes (le pantalon, les bas rayés, la bottine, la lame), les bras, les gants, le
  bâton. Les genoux et les coudes se plient par cinématique inverse (`ik`) : une pose ne dit que le bassin, l'inclinaison
  et la torsion du torse, les chevilles, le pommeau et la lame du bâton ; les mains suivent le bâton. Le gardien
  (`gardien: true`) prend les jambières, la mitaine, le bloqueur, le masque et la palette.
- **Les poses** (`POSES`, `POSES_GARDIEN`) : en mètres, le corps regarde +y, x à sa droite, z en haut. La lame posée sur
  la glace est écrite à un mètre devant ; le rendu la ramène aux quatorze pixels du jeu dans chaque direction.
- **La vue** : la hauteur raccourcie de `HAUTEUR_VUE`, la profondeur du sol de `PROFONDEUR`, le joueur grossi de `GROS`
  et épaissi de `EPAIS` (la glace, elle, reste à l'échelle). Les patins à l'ancre (16, 32) de l'image de 32 × 48.
- **Les pixels** (`image`) : 4 × 4 échantillons par pixel ; la matière la plus présente le prend (le bâton et la lame
  comptent triple, sinon ils disparaissent) ; la lumière (`LUMIERE`) choisit le ton clair, moyen ou sombre de la
  matière (`MAT`, `SEUILS`) ; le contour `k` ferme la silhouette, et sépare la tête du reste ; un membre devant un autre
  fonce le pixel de derrière ; l'ombre portée (`SOLEIL`) se trame en `o` sur la glace.

## Les lettres

Celles de `apercu.mjs` (`LEGENDE`), teintes aux couleurs du club par `teintesDe` (js/sur-glace.js) : `k` contour ·
`J j d` chandail · `T` bande du club · `W` masque · `S s` peau · `H h` casque · `P p` pantalon · `G` gants · `K` patin ·
`L` lame · `B` manche · `b` ruban · `Q q` jambières · `o` ombre.

## Retoucher

Une pose se change dans `POSES` ; une matière ou un ton dans `MAT` ; une proportion dans `modele`. Rends l'aperçu,
regarde-le à côté d'une planche des NHL classiques (la silhouette, la foulée, le bâton, la tête de quatre ou cinq pixels),
puis réécris `js/sprites.js`. `RECHERCHE.md` garde ce que la recherche a rapporté sur le pixel art de 16 bits.
