// Direction N — le joueur regarde vers le HAUT de l'écran : son dos, l'arrière du casque, le numéro 19 dans le dos,
// le joug T ; le bâton tenu à droite du corps (gants à droite du ventre), le manche part en diagonale vers la lame qui
// finit en (16, 18), derrière la tête : on n'en voit que ce qui dépasse à droite. Le même joueur que artiste-a.mjs
// (la tête lignes 10-19, les épaules 20-22, 23 lignes du patin au casque).
// Repère :       1111111111222222222233
//      01234567890123456789012345678901

const L = 32, H = 48;
/* une image : des segments [ligne, colonne, texte] posés sur un fond vide ; '.' dans un texte ne pose rien */
const image = (...groupes) => {
  const g = Array.from({ length: H }, () => Array(L).fill('.'));
  for (const segs of groupes) for (const [y, x, t] of segs) [...t].forEach((c, i) => { if (c !== '.') g[y][x + i] = c; });
  return g.map(r => r.join(''));
};
/* ce qui est DERRIÈRE le corps (le manche, la lame devant le joueur) : ne se pose que sur du vide */
const derriere = (lignes, segs) => {
  const g = lignes.map(r => [...r]);
  for (const [y, x, t] of segs) [...t].forEach((c, i) => { if (c !== '.' && g[y][x + i] === '.') g[y][x + i] = c; });
  return g.map(r => r.join(''));
};
const dec = (segs, dy = 0, dx = 0) => segs.map(([y, x, t]) => [y + dy, x + dx, t]);

/* L'arrière de la tête (lignes 10-19) : le casque rond de A, son reflet en haut à gauche, pas de visière ;
   l'ombre du casque en bas à droite, la nuque (la peau) sous le casque, le col. */
const TETE = [
  [10, 13, 'kkkkkkk'],
  [11, 12, 'khhHHHHHk'],
  [12, 11, 'khhHHHHHHHk'],
  [13, 11, 'kHHHHHHHHHk'],
  [14, 11, 'kHHHHHHHHHk'],
  [15, 11, 'kHHHHHHHHdk'],
  [16, 11, 'kHHHHHHHddk'],
  [17, 11, 'kkHHHHHddkk'],
  [18, 12, 'kkSSSsskk'],
  [19, 13, 'kkkkkkk'],
];
/* Les épaules de A (le joug T, lignes 20-22) */
const EPAULES = [
  [20, 10, 'kkkkkkkkkkkkk'],
  [21, 9, 'kTTTTTTTTTTTTTk'],
  [22, 8, 'kTTTjJJJJJJdTTTk'],
];
/* Le dos (lignes 23-27) : le bras gauche qui part vers l'avant (on en voit l'épaule), le numéro 19, l'ombre à droite,
   le bras droit qui descend vers les gants ; l'ourlet (28) et le pantalon (29). */
const DOS = [
  [23, 8, 'kJJkJWJJWWWdkJdk'],
  [24, 8, 'kJJkWWJJWJWdk'],
  [25, 9, 'kkkJWJJWWWdk'],
  [26, 11, 'kJWJJJJWdk'],
  [27, 11, 'kWWWJWWWdk'],
  [28, 11, 'kTTTTTTTTk'],
  [29, 11, 'kpPPPPPPPk'],
];
/* Les gants, à droite du ventre, l'un sur l'autre sur le manche (lignes 22-28, colonnes 23-27) */
const GANTS = [
  [23, 23, 'k.k'],
  [24, 21, 'kGGGk'],
  [25, 21, 'kGGGk'],
  [26, 21, 'kGGGk'],
  [27, 21, 'kGGGk'],
  [28, 21, 'kkkkk'],
];
/* Le bâton tenu : le manche sort du haut des gants en marches de 2, la lame à plat sur la glace finit en (16, 18) */
const BATON = [
  [23, 24, 'B'], [22, 24, 'B'], [21, 24, 'B'],
  [20, 23, 'B'], [19, 23, 'B'], [18, 23, 'B'],
  [18, 16, 'bbbbbbb'],
];
/* Les jambes du repos (30-33) : les bas, la rayure, les patins et leurs lames */
const JAMBES = [
  [30, 11, 'kJdk..kJdk'],
  [31, 11, 'kTTk..kTTk'],
  [32, 11, 'KKKK..KKKK'],
  [33, 11, 'LLLL..LLLL'],
];
const HAUT = [...TETE, ...EPAULES, ...DOS, ...GANTS];

const repos = derriere(image(HAUT, JAMBES), BATON);

/* patin1 : la jambe droite pousse loin à droite, la gauche glisse sous le corps */
const patin1 = derriere(image(HAUT, [
  [29, 11, 'kpPPPPPPPPPPk'],
  [30, 12, 'kJdk.....kJJJk'],
  [31, 12, 'kTTk.......kTTTk'],
  [32, 12, 'KKKK...........KKKK'],
  [33, 12, 'LLLL...........LLLL'],
]), BATON);

/* patin2 : les deux jambes sous le corps, le corps un cran plus haut (le passage) */
const patin2 = derriere(image(dec(HAUT, -1), [
  [29, 11, 'kPPPPPPPPk'],
  ...JAMBES,
]), dec(BATON, -1));

/* patin3 : la jambe gauche pousse loin à gauche */
const patin3 = derriere(image(HAUT, [
  [29, 8, 'kpPPPPPPPPPPk'],
  [30, 6, 'kJJJk.....kJdk'],
  [31, 4, 'kTTTk.......kTTk'],
  [32, 1, 'KKKK...........KKKK'],
  [33, 1, 'LLLL...........LLLL'],
]), BATON);

/* patin4 : les deux sous le corps, les genoux pliés : un cran plus bas, les bas rentrés sous la culotte */
const patin4 = derriere(image(dec(HAUT, 1), [
  [31, 11, 'kTTk..kTTk'],
  [32, 11, 'KKKK..KKKK'],
  [33, 11, 'LLLL..LLLL'],
]), dec(BATON, 1));

/* charge : le lancer frappé se charge. Le bâton DROIT en l'air au-dessus de la tête, tenu à droite ; les deux gants
   à la hauteur du casque, le bras droit levé ; les genoux pliés, les jambes écartées, le dos qui se tourne. */
const charge = image(TETE, [
  [1, 24, 'bbb'],
  [2, 23, 'bbbb'],
  [3, 23, 'B'], [4, 23, 'B'], [5, 23, 'B'], [6, 23, 'B'], [7, 23, 'B'], [8, 23, 'B'], [9, 23, 'B'],
  [10, 23, 'B'], [11, 23, 'B'],
  [12, 22, 'kGGGk'],
  [13, 22, 'kGGGk'],
  [14, 22, 'kGGGk'],
  [15, 21, 'kGGGk'],
  [16, 21, 'kGGGk'],
  [17, 21, 'kGGGk'],
  [18, 21, 'kJJk'],
  [19, 21, 'kJJk'],
  [20, 10, 'kkkkkkkkkkkkkJk'],
  [21, 9, 'kTTTTTTTTTTTTJJk'],
  [22, 8, 'kTTTjJJJJJJdTTJk'],
  [23, 8, 'kJJkJWJJWWWdkJk'],
  [24, 8, 'kJJkWWJJWJWdkk'],
  [25, 9, 'kkkJWJJWWWdk'],
  [26, 11, 'kJWJJJJWdk'],
  [27, 11, 'kWWWJWWWdk'],
  [28, 11, 'kTTTTTTTTk'],
  [29, 10, 'kpPPPPPPPPPk'],
  [30, 9, 'kJdk.......kJdk'],
  [31, 8, 'kTTk.........kTTk'],
  [32, 7, 'KKKK...........KKKK'],
  [33, 7, 'LLLL...........LLLL'],
]);

/* tir : le fouetté. Le bâton loin devant, en l'air : il monte à droite de la tête en marches de 3, la lame en haut ;
   les gants à la hauteur de l'épaule droite, le corps tourné (l'épaule gauche devant), la jambe gauche tendue derrière. */
const tir = image(TETE, [
  [3, 17, 'bbbbb'],
  [4, 21, 'B'], [5, 21, 'B'], [6, 21, 'B'],
  [7, 22, 'B'], [8, 22, 'B'], [9, 22, 'B'],
  [10, 23, 'B'], [11, 23, 'B'], [12, 23, 'B'],
  [13, 24, 'B'], [14, 24, 'B'], [15, 24, 'B'],
  [16, 25, 'B'], [17, 25, 'B'],
  [18, 24, 'kGGGk'],
  [19, 24, 'kGGGk'],
  [20, 9, 'kkkkkkkkkkkkkkkGGGk'],
  [21, 8, 'kTTTTTTTTTTTTTJkGGGk'],
  [22, 7, 'kTTTjJJJJJJdTTJJkkk'],
  [23, 7, 'kJJkJWJJWWWdkJJk'],
  [24, 7, 'kJJkWWJJWJWdkkk'],
  [25, 8, 'kkkJWJJWWWdk'],
  [26, 11, 'kJWJJJJWdk'],
  [27, 11, 'kWWWJWWWdk'],
  [28, 11, 'kTTTTTTTTk'],
  [29, 8, 'kPPPpPPPPPPPk'],
  [30, 6, 'kJJk.....kJdk'],
  [31, 4, 'kTTk.......kTTk'],
  [32, 2, 'KKKK.........KKKK'],
  [33, 2, 'LLLL.........LLLL'],
]);

/* passe : le balayage court. Les bras tendus à droite, les gants loin du ventre, le bâton balayé vers la droite :
   la lame à plat sur la glace, devant à droite de la tête. */
const passe = image(TETE, EPAULES, [
  [17, 27, 'bbbbb'],
  [18, 28, 'B'],
  [19, 27, 'B'], [20, 27, 'B'],
  [21, 26, 'B'], [22, 26, 'B'],
  [23, 8, 'kJJkJWJJWWWdkJdJk'],
  [24, 8, 'kJJkWWJJWJWdkkJJdk'],
  [25, 9, 'kkkJWJJWWWdk.kGGGk'],
  [26, 11, 'kJWJJJJWdk..kGGGk'],
  [27, 11, 'kWWWJWWWdk..kGGGk'],
  [28, 11, 'kTTTTTTTTk..kGGGk'],
  [29, 11, 'kpPPPPPPPk..kkkkk'],
  ...JAMBES,
]);

/* echec : la mise en échec. L'épaule droite devant (plus haute), le tronc couché vers l'avant : la tête s'enfonce
   dans les épaules, le dos se voit plus ; les bras repliés, les gants contre le corps ; le bâton bas, traînant sur la
   glace derrière à droite ; les jambes écartées, les genoux pliés. */
const echec = image(dec(TETE, 1), [
  [18, 13, 'kkkkkkk'],
  [19, 10, 'kkkkkkkkkkkkkkk'],
  [20, 9, 'kTTTTTTTTTTTTTTk'],
  [21, 8, 'kTTTjJJJJJJJdTTk'],
  [22, 8, 'kJJkJWJJWWWJdkJk'],
  [23, 8, 'kJJkWWJJWJWJdkGGk'],
  [24, 9, 'kkkJWJJWWWJdkGGk'],
  [25, 11, 'kJWJJJJWJdkGGk'],
  [26, 11, 'kWWWJWWWJdkkkB'],
  [27, 11, 'kTTTTTTTTTk'],
  [28, 10, 'kpPPPPPPPPPk'],
  [29, 9, 'kJdk.......kJdk'],
  [30, 8, 'kTTk.........kTTk'],
  [31, 7, 'KKKK...........KKKK'],
  [32, 7, 'LLLL...........LLLL'],
  [33, 7, '.'],
  [27, 24, 'B'], [28, 24, 'B'],
  [29, 25, 'B'], [30, 25, 'B'],
  [31, 26, 'B'], [32, 26, 'B'],
  [33, 27, 'bbbbb'],
]);

/* chute : couché à plat sur la glace, la tête vers le haut, le dos au ciel, les bras ouverts, les patins en bas ;
   le bâton couché à côté, à droite. 24 lignes de long (20-43), 10 de large, centré sur l'ancre. */
const chute = image([
  [21, 13, 'kkkkkkk'],
  [22, 12, 'khhHHHHHk'],
  [23, 11, 'khhHHHHHHHk'],
  [24, 11, 'kHHHHHHHHdk'],
  [25, 11, 'kkHHHHHHdkk'],
  [26, 10, 'kkkkkkkkkkkkk'],
  [27, 9, 'kTTTTTTTTTTTTTk'],
  [28, 8, 'kTTTjJJJJJJdTTTk'],
  [29, 6, 'kkkJJkJWJJWWWdkJJkkk'],
  [30, 5, 'kGGkJJkWWJJWJWdkJJkGGk'],
  [31, 5, 'kGGkkkkJWJJWWWdkkkkGGk'],
  [32, 5, 'kkkk.kJWJJJJWdk.kkkk'],
  [33, 11, 'kWWWJWWWdk'],
  [34, 11, 'kTTTTTTTTk'],
  [35, 10, 'kpPPPPPPPPk'],
  [36, 9, 'kPPPPkkPPPPk'],
  [37, 8, 'kJJdk..kJJdk'],
  [38, 7, 'kJJdk....kJJdk'],
  [39, 6, 'kTTTk......kTTTk'],
  [40, 5, 'kKKKk......kKKKk'],
  [41, 4, 'kKKKk........kKKKk'],
  [42, 4, 'kLLLk........kLLLk'],
  [22, 25, 'bbb'],
  [23, 24, 'B'], [24, 24, 'B'], [25, 24, 'B'], [26, 24, 'B'],
  [27, 25, 'B'], [28, 25, 'B'], [29, 25, 'B'], [30, 25, 'B'],
  [31, 26, 'B'], [32, 26, 'B'], [33, 26, 'B'], [34, 26, 'B'],
  [35, 27, 'B'], [36, 27, 'B'], [37, 27, 'B'], [38, 27, 'B'],
]);

export const PLANCHE = { N: { repos, patin1, patin2, patin3, patin4, charge, tir, passe, echec, chute } };
