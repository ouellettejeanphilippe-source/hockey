/*
 * Direction E — le joueur regarde vers la DROITE de l'écran : le profil (un œil, le nez, la visière devant,
 * une épaule devant l'autre, les jambes l'une derrière l'autre). Le même joueur que `artiste-a.mjs` vu de côté :
 * la tête de 11 de large sur 10 de haut (lignes 10 à 19), le joug T, 23 lignes du patin au casque, l'ancre (16, 32).
 * Le bâton est tenu à droite du ventre, deux gants sur le manche, qui descend en 1-1 jusqu'à la lame, sur la
 * glace à (27..31, 32) : le point (30, 32) est dessus.
 *
 * Une image est une liste de segments [ligne, colonne, texte] peints dans l'ordre ('.' est transparent) ;
 * `d(segs, dx, dy)` déplace un morceau. Repère :       1111111111222222222233
 *                                             01234567890123456789012345678901
 */
const d = (segs, dx = 0, dy = 0) => segs.map(([y, x, t]) => [y + dy, x + dx, t]);
function image(...morceaux) {
  const c = Array.from({ length: 48 }, () => Array(32).fill('.'));
  for (const [y, x, t] of morceaux.flat()) [...t].forEach((ch, i) => { if (ch !== '.') { if (y < 0 || y > 47 || x + i < 0 || x + i > 31) throw new Error(`hors cadre : (${x + i}, ${y})`); c[y][x + i] = ch; } });
  return c.map(l => l.join(''));
}

/* La tête de profil (lignes 10-19) : le casque rond, le reflet en haut à gauche (l'arrière), la visière noire
 * devant, un œil, le nez qui dépasse, le menton. */
const TETE = [
  [10, 13, 'kkkkkkk'],
  [11, 12, 'khhHHHHHk'],
  [12, 11, 'khhHHHHHHHk'],
  [13, 11, 'kHHHHHHHHHk'],
  [14, 11, 'kHHHHHHHHHk'],
  [15, 11, 'kHHHkkkkkkk'],
  [16, 11, 'kHHHkSSSkSk'],
  [17, 11, 'kHHHkSSSSSSk'],
  [18, 12, 'kHkSSSSssk'],
  [19, 13, 'kkkkkkkk'],
];

/* Le tronc (lignes 20-28), vu de côté : le joug T, l'épaule de devant (à droite) porte sa bande, l'ourlet. */
const TRONC = [
  [20, 11, 'kkkkkkkkkk'],
  [21, 10, 'kTTTTTTTTTTk'],
  [22, 10, 'kjJJJJJJdTTTk'],
  [23, 10, 'kJJJJJJJdk'],
  [24, 10, 'kJJJJJJJdk'],
  [25, 10, 'kJJJJJJJdk'],
  [26, 10, 'kJJJJJJJdk'],
  [27, 10, 'kJJJJJJJdk'],
  [28, 10, 'kTTTTTTTTk'],
];

/* Les bras du repos : le bras de devant descend de l'épaule au gant du haut ; le bras de derrière sort sous lui
 * jusqu'au gant du bas ; le manche passe dans les deux gants. */
const BRAS = [
  [23, 20, 'Jdk'],
  [24, 20, 'Jdk'],
  [25, 20, 'TTk'],
  [26, 20, 'GGGk'],
  [27, 20, 'GGGB'],
  [28, 20, 'JdkGGGk'],
  [29, 20, 'TTkGGGk'],
];
/* Le manche sous le gant du bas, en 1-1, et la lame sur la glace. */
const MANCHE = [
  [30, 26, 'B'],
  [31, 27, 'B'],
];
const LAME = [[32, 27, 'bbbbb']];

/* Le pantalon et les jambes du repos : l'une derrière l'autre, les deux patins sur la glace. */
const PANTALON = [[29, 10, 'kpPPPPPPPk']];
const JAMBES = [
  [30, 12, 'kJdkJdk'],
  [31, 12, 'kTTkTTk'],
  [32, 10, 'KKKKKKKKKKK'],
  [33, 10, 'LLLLL.LLLLL'],
];

/* repos : debout, les genoux un peu pliés, le bâton sur la glace devant. */
const repos = image(TETE, TRONC, BRAS, MANCHE, LAME, PANTALON, JAMBES);

/* patin1 : la jambe de derrière (la droite) pousse loin derrière, à gauche de l'écran ; la gauche glisse sous le
 * corps ; le tronc penché d'un cran vers l'avant. */
const JAMBE_POUSSE_ARRIERE = [
  [30, 8, 'kJJdk'],
  [31, 6, 'kTTk'],
  [32, 4, 'KKKKK'],
  [33, 4, 'LLLLL'],
];
const JAMBE_SOUS = [
  [30, 14, 'kJdk'],
  [31, 14, 'kTTk'],
  [32, 13, 'KKKKKK'],
  [33, 13, 'LLLLLL'],
];
const patin1 = image(d(TETE, 1, 0), TRONC, BRAS, MANCHE, LAME, PANTALON, JAMBE_SOUS, JAMBE_POUSSE_ARRIERE);

/* patin2 : les deux jambes sous le corps, le corps un cran plus haut (le pantalon fait deux lignes) ; les gants
 * restent sur le manche : le bras de devant s'allonge d'une ligne. */
const BRAS_HAUT = [[22, 20, 'Jdk'], ...BRAS];
const PANTALON_HAUT = [[28, 10, 'kpPPPPPPPk'], [29, 10, 'kPPPPPPPPk']];
const patin2 = image(d(TETE, 0, -1), d(TRONC, 0, -1), BRAS_HAUT, MANCHE, LAME, PANTALON_HAUT, JAMBES);

/* patin3 : la jambe de devant (la gauche) pousse ; dessinée devant la droite, qui glisse sous le corps. */
const JAMBE_POUSSE_DEVANT = [
  [30, 9, 'kJJdk'],
  [31, 7, 'kTTk'],
  [32, 5, 'KKKKK'],
  [33, 5, 'LLLLL'],
];
const JAMBE_SOUS_ARRIERE = [
  [30, 13, 'kJdk'],
  [31, 13, 'kTTk'],
  [32, 12, 'KKKKKK'],
  [33, 12, 'LLLLLL'],
];
const patin3 = image(d(TETE, 1, 0), TRONC, BRAS, MANCHE, LAME, PANTALON, JAMBE_SOUS_ARRIERE, JAMBE_POUSSE_DEVANT);

/* patin4 : comme patin2, les jambes un cran décalées (la gauche devant). */
const JAMBES_4 = [
  [30, 11, 'kJdkJdk'],
  [31, 11, 'kTTkTTk'],
  [32, 10, 'KKKKKKKKKKK'],
  [33, 10, 'LLLLL.LLLLL'],
];
const patin4 = image(d(TETE, 0, -1), d(TRONC, 0, -1), BRAS_HAUT, MANCHE, LAME, PANTALON_HAUT, JAMBES_4);

/* charge : le lancer frappé se charge. Les deux gants levés devant le visage, le bras de devant monte de l'épaule ;
 * le manche part des gants DROIT au-dessus de la tête, vers l'arrière (en haut à gauche), la lame tout en haut ;
 * les genoux pliés, les jambes écartées devant-derrière. */
const BRAS_LEVES = [
  [13, 22, 'kGGGk'],
  [14, 22, 'kGGGk'],
  [15, 22, 'kGGGk'],
  [16, 22, 'kGGGk'],
  [17, 22, 'kTTk'],
  [18, 21, 'kJdk'],
  [19, 21, 'kJdk'],
  [20, 20, 'kJdk'],
  [21, 20, 'kJdk'],
  [22, 19, 'TTTk'],
];
const BATON_LEVE = [
  [0, 16, 'bbb'],
  [1, 16, 'bbbb'],
  [2, 19, 'B'], [3, 19, 'B'],
  [4, 20, 'B'], [5, 20, 'B'],
  [6, 21, 'B'], [7, 21, 'B'],
  [8, 22, 'B'], [9, 22, 'B'],
  [10, 23, 'B'], [11, 23, 'B'],
  [12, 24, 'B'],
];
const JAMBES_ECARTEES = [
  [30, 9, 'kJJdk'],
  [31, 8, 'kTTk'],
  [32, 6, 'KKKKK'],
  [33, 6, 'LLLLL'],
  [30, 16, 'kJdk'],
  [31, 17, 'kTTk'],
  [32, 17, 'KKKKKK'],
  [33, 17, 'LLLLLL'],
];
const charge = image(TETE, TRONC, BRAS_LEVES, BATON_LEVE, PANTALON, JAMBES_ECARTEES);

/* tir : le fouetté. Le corps penché devant, les bras tendus loin devant à la poitrine, le manche part des gants
 * vers l'avant et le haut (en 2-1), la lame en l'air au bout ; la jambe de derrière tendue loin derrière. */
const BRAS_TENDUS = [
  [23, 20, 'Jdk'],
  [24, 20, 'JdJd'],
  [25, 20, 'TTTT'],
  [26, 20, 'GGGk'],
  [27, 20, 'GGGk'],
  [28, 20, 'kkk'],
  [23, 25, 'kkk'],
  [24, 24, 'kGGGk'],
  [25, 24, 'kGGGk'],
  [26, 25, 'kkk'],
];
const BATON_DEVANT = [
  [27, 23, 'B'], [26, 24, 'B'],
  [23, 27, 'B'], [22, 28, 'B'], [21, 29, 'B'], [20, 30, 'B'],
  [19, 31, 'b'],
  [18, 30, 'bb'],
  [17, 30, 'b'],
];
const JAMBE_TENDUE = [
  [30, 7, 'kJJJdk'],
  [31, 4, 'kTTTk'],
  [32, 2, 'KKKKK'],
  [33, 2, 'LLLLL'],
];
const tir = image(d(TETE, 2, 0), TRONC, BRAS_TENDUS, BATON_DEVANT, PANTALON, JAMBE_SOUS, JAMBE_TENDUE);

/* passe : le balayage court. Les bras tendus devant et en bas, les gants glissés le long du manche, la lame sur la
 * glace ; le tronc penché d'un cran. */
const BRAS_PASSE = [
  [23, 20, 'Jdk'],
  [24, 20, 'kJdk'],
  [25, 21, 'kTTk'],
  [26, 22, 'kGGGk'],
  [27, 22, 'kGGGk'],
  [27, 20, 'Jd'],
  [28, 20, 'TTk'],
  [28, 23, 'kB'],
  [29, 25, 'GGGk'],
  [30, 25, 'GGGk'],
  [31, 28, 'B'],
];
const passe = image(d(TETE, 1, 0), TRONC, BRAS_PASSE, LAME, PANTALON, JAMBES);

/* echec : la mise en échec. L'épaule devant, le tronc couché vers l'avant (la tête devant les épaules, trois
 * lignes plus bas), les bras repliés sous le menton, le bâton bas ; la jambe de derrière pousse. */
const TRONC_COUCHE = [
  [21, 13, 'kkkkkkkkkkk'],
  [22, 12, 'kTTTTTTTTTTk'],
  [23, 12, 'kjJJJJJJJJdk'],
  [24, 11, 'kJJJJJJJJJdk'],
  [25, 11, 'kJJJJJJJJJdk'],
  [26, 10, 'kJJJJJJJJdk'],
  [27, 10, 'kJJJJJJJJdk'],
  [28, 10, 'kTTTTTTTTk'],
];
const BRAS_REPLIES = [
  [24, 22, 'Jdk'],
  [25, 22, 'TTk'],
  [26, 21, 'kGGGk'],
  [27, 21, 'kGGGk'],
  [27, 25, 'B'],
  [28, 20, 'GGGk'],
  [28, 24, 'kB'],
  [29, 26, 'B'],
];
const echec = image(d(TETE, 4, 3), TRONC_COUCHE, BRAS_REPLIES, d(MANCHE, 1, 0).filter(s => s[0] >= 30), LAME, PANTALON, JAMBE_SOUS, JAMBE_POUSSE_ARRIERE);

/* chute : couché à plat sur la glace, la tête vers l'avant (à droite), les patins derrière ; environ 25 de long
 * sur 9 de haut, centré sur l'ancre ; le bâton par terre devant, la lame au point. */
const chute = image([
  [27, 20, 'kkkkkkk'],
  [28, 11, 'kkkkkkkkhhHHHHHk'],
  [29, 9, 'kkTTTTTTTTkhHHHHHHHk'],
  [30, 6, 'kkkJjJJJJJJJdkHHHHHHHHk'],
  [31, 4, 'kkkPPPJJJJJJJJJdkHHHkkkkkkk'],
  [32, 4, 'KKkPPPPJJJJJJJJdkHHHkSSkSSk'],
  [33, 4, 'KKkPPPPJTTTTTTTdkHkSSSSSSk'],
  [34, 4, 'LLkkkkkkkkkkkkkkkkkkkkkkk'],
  [35, 22, 'kGGGk'],
  [36, 22, 'kGGGk'],
  [35, 27, 'B'], [34, 28, 'B'], [33, 29, 'B'],
  [32, 30, 'b'], [31, 30, 'bb'], [30, 31, 'b'],
]);

export const PLANCHE = { E: { repos, patin1, patin2, patin3, patin4, charge, tir, passe, echec, chute } };
