# Phase 2 — la planche complète, dans le style du graphiste A

Le jury (le projet) a retenu la planche `artiste-a.mjs` (`jury-a.png`) : c'est LE style du jeu. Lis `GUIDE.md` (dont sa
section « Ce que la recherche ajoute ») et `RECHERCHE.md`, regarde `jury-a.png`, et lis `artiste-a.mjs` : tu reprends sa
tête (lignes 10 à 17 : le casque rond, le reflet, la visière noire, les deux yeux, le menton), ses épaules (le joug T),
ses proportions (23 lignes du patin au casque), sa façon de faire les gants, le pantalon, les patins. Un joueur de ta
direction doit se lire comme LE MÊME joueur que celui de A vu de face.

Ce qui change par rapport à la phase 1 :
- **Pas d'ombre au sol** dans le sprite (le jeu la pose lui-même) : aucune lettre `o`.
- **Le bâton** se tient SUR LE CÔTÉ droit du corps (du point de vue de l'écran), les deux gants à droite du ventre, et le
  manche part en DIAGONALE propre (des marches régulières, 2-1 ou 3-1) jusqu'à la lame, qui finit au point donné
  (S → (16, 46) · SE → (26, 42) · E → (30, 32) · NE → (26, 22) · N → (16, 18)). Jamais un manche vertical planté dans le
  sol comme un poteau : il est tenu, incliné, il part des mains.
- **Les dix poses**, dans ta direction : `repos`, `patin1`, `patin2`, `patin3`, `patin4` (le cycle : 1 = la jambe droite
  pousse loin de côté, 2 = les deux sous le corps un cran plus haut, 3 = la jambe gauche pousse, 4 = les deux sous le
  corps), `charge` (le bâton DROIT au-dessus de la tête vers l'arrière, genoux pliés), `tir` (le fouetté : le bâton loin
  devant en l'air, le corps tourné, une jambe tendue derrière), `passe` (le balayage court, le bâton devant sur la
  glace, les bras tendus), `echec` (l'épaule devant, le tronc couché vers l'avant, les bras repliés, le bâton bas),
  `chute` (couché à plat sur la glace, la tête vers l'avant, environ 24 pixels de long sur 10 de haut, centré sur l'ancre).
- Les directions se lisent de l'ÉCRAN : S regarde vers le bas (vers nous : le visage), N vers le haut (le dos, le
  numéro `W`), E vers la droite (le profil : un œil, le nez, une épaule devant l'autre), SE et NE les diagonales (trois
  quarts face, trois quarts dos). W, SW, NW seront des miroirs : ne les dessine pas.
- Vérifie chaque image en la comparant à `jury-a.png` : même taille de tête, mêmes épaules, même hauteur.

La méthode reste la même : écris ton fichier, rends-le (`node apercu.mjs <fichier> <png> 8`), REGARDE le PNG, critique,
corrige, au moins trois tours. Rends compte en trois phrases.
