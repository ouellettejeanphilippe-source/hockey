// Direction SE — le joueur regarde vers le bas à droite de l'écran (trois quarts face) : le visage tourné vers la
// droite, l'œil droit entier, le gauche contre le casque, l'épaule droite devant ; le bâton tenu sur son côté droit,
// le manche en marches 2-1 jusqu'à la lame, au point (26, 42). Même tête, mêmes épaules, même hauteur que A.
// Repère :       1111111111222222222233
//      01234567890123456789012345678901
const V = '................................';

// La tête de trois quarts (dix lignes : le casque, la visière, le visage tourné à droite, le menton).
const TETE = [
  '.............kkkkkkk............', // casque
  '............khhHHHHHk...........',
  '...........khhHHHHHHHk..........',
  '...........kHHHHHHHHHk..........',
  '...........kHHHHHHHHHk..........',
  '...........kHHkkkkkkkk..........', // la visière, le côté du casque à gauche
  '...........kHHSkSSSkSk..........', // les yeux : le gauche contre le casque, le droit entier
  '...........kHHSSSSSssk..........',
  '............kHSSSSssk...........', // le menton
  '.............kkkkkkk............',
];

// Les épaules et le tronc du repos (neuf lignes) : le joug T, l'épaule droite devant, le bras gauche en travers,
// les deux gants à droite du ventre, le manche entre eux.
const TRONC = [
  '..........kkkkkkkkkkkk..........', // 20
  '.........kTTTTTTTTTTTTk.........', // 21
  '.........kTTjJJJJJJdTTTk........', // 22
  '.........kJJkJJJJJJdkJJk........', // 23
  '..........kJJkJJJBJdkJJk........', // 24
  '...........kTTkGGGBkTTTk........', // 25
  '............kJJGGGBkGGGk........', // 26
  '............kJJJJJdBGGGk........', // 27
  '............kTTTTTTBk...........', // 28
];

// Le manche sous le corps, du pantalon à la lame (lignes 29 à 42), en marches 2-1 : les colonnes 20 … 26.
const MANCHE = [
  '......................B.........', // 34
  '.......................B........', // 35
  '.......................B........', // 36
  '........................B.......', // 37
  '........................B.......', // 38
  '.........................B......', // 39
  '.........................B......', // 40
  '..........................B.....', // 41
  '........................bbbbb...', // 42 la lame : (26, 42)
  V, V, V, V, V,                                   // 43-47
];

const repos = [
  ...V.repeat(0) ? [] : [V, V, V, V, V, V, V, V, V, V], // 0-9
  ...TETE,                            // 10-19
  ...TRONC,                           // 20-28
  '............kpPPPPPkB...........', // 29
  '...........kJdk.kJdkB...........', // 30
  '...........kTTk.kTTk.B..........', // 31
  '...........KKKK.KKKK.B..........', // 32
  '............LLLL.LLLL.B.........', // 33
  ...MANCHE,                          // 34-47
];

// patin1 : la jambe droite pousse loin à droite ; la gauche glisse sous le corps. Le manche passe devant la jambe.
const patin1 = [
  V, V, V, V, V, V, V, V, V, V,       // 0-9
  ...TETE,                            // 10-19
  ...TRONC,                           // 20-28
  '............kpPPPPPPBPk.........', // 29
  '...........kJdk.....BJJJk.......', // 30
  '...........kTTk......B.kTTTk....', // 31
  '...........KKKK......B.....KKKK.', // 32
  '............LLLL......B.....LLLL', // 33
  ...MANCHE,                          // 34-47
];

// patin2 : les deux jambes sous le corps, le corps un cran plus haut (les jambes allongées d'une ligne).
const patin2 = [
  V, V, V, V, V, V, V, V, V,          // 0-8
  ...TETE,                            // 9-18
  ...TRONC,                           // 19-27
  '............kpPPPPPkB...........', // 28
  '............kPPPPPPkB...........', // 29
  '...........kJdk.kJdk.B..........', // 30
  '...........kTTk.kTTk.B..........', // 31
  '...........KKKK.KKKK..B.........', // 32
  '............LLLL.LLLL.B.........', // 33
  '.......................B........', // 34
  '.......................B........', // 35
  '........................B.......', // 36
  '........................B.......', // 37
  '.........................B......', // 38
  '.........................B......', // 39
  '..........................B.....', // 40
  '..........................B.....', // 41
  '........................bbbbb...', // 42
  V, V, V, V, V,                      // 43-47
];

// patin3 : la jambe gauche pousse loin à gauche ; la droite glisse sous le corps.
const patin3 = [
  V, V, V, V, V, V, V, V, V, V,       // 0-9
  ...TETE,                            // 10-19
  ...TRONC,                           // 20-28
  '.........kPPPpPPPPPkB...........', // 29
  '.......kJJJk....kJdkB...........', // 30
  '....kTTTk.......kTTk.B..........', // 31
  '.KKKK...........KKKK.B..........', // 32
  '..LLLL...........LLLL.B.........', // 33
  ...MANCHE,                          // 34-47
];

// patin4 : les deux jambes sous le corps, un cran plus haut, les patins écartés en V (la glisse).
const patin4 = [
  V, V, V, V, V, V, V, V, V,          // 0-8
  ...TETE,                            // 9-18
  ...TRONC,                           // 19-27
  '............kpPPPPPkB...........', // 28
  '...........kPPPPPPPkB...........', // 29
  '..........kJdk..kJdk.B..........', // 30
  '.........kTTk....kTTkB..........', // 31
  '........KKKK.....KKKK.B.........', // 32
  '.........LLLL.....LLLL.B........', // 33
  '.......................B........', // 34
  '.......................B........', // 35
  '........................B.......', // 36
  '........................B.......', // 37
  '.........................B......', // 38
  '.........................B......', // 39
  '..........................B.....', // 40
  '..........................B.....', // 41
  '........................bbbbb...', // 42
  V, V, V, V, V,                      // 43-47
];

// charge : le lancer frappé se charge. Les deux gants à droite du casque, le bâton droit en l'air vers l'arrière
// (en haut, penché vers la gauche), le bras gauche en travers du menton, les genoux pliés, les jambes écartées.
const charge = [
  V,                                  // 0
  '.................bbb............', // 1
  '.................bbbb...........', // 2
  '.....................B..........', // 3
  '.....................B..........', // 4
  '.....................B..........', // 5
  '......................B.........', // 6
  '......................B.........', // 7
  '......................B.........', // 8
  '.......................B........', // 9
  '.............kkkkkkk...B........', // 10
  '............khhHHHHHk..B........', // 11
  '...........khhHHHHHHHkGGGk......', // 12
  '...........kHHHHHHHHHkGGGk......', // 13
  '...........kHHHHHHHHHkGGGk......', // 14
  '...........kHHkkkkkkkGGGk.......', // 15
  '...........kHHSkSSSkSGGGk.......', // 16
  '...........kHHSSSSSssGGGk.......', // 17
  '............kHSSSSsJJkJJk.......', // 18
  '.............kkkkJJkkJJk........', // 19
  '..........kkkkkJJkkkkJJk........', // 20
  '.........kTTTJJTTTTTTJJk........', // 21
  '.........kTTJJkJJJJdkJJk........', // 22
  '.........kjJJJJJJJJdk...........', // 23
  '..........kJJJJJJJJdk...........', // 24
  '...........kJJJJJJJdk...........', // 25
  '............kJJJJJJdk...........', // 26
  '............kJJJJJJdk...........', // 27
  '............kTTTTTTTk...........', // 28
  '...........kpPPPPPPPPk..........', // 29
  '..........kJdk.....kJdk.........', // 30
  '.........kTTk.........kTTk......', // 31
  '........KKKK...........KKKK.....', // 32
  '.........LLLL...........LLLL....', // 33
  V, V, V, V, V, V, V, V, V, V, V, V, V, V,       // 34-47
];

// tir : le fouetté. Les deux gants balancés loin à droite, le bâton en diagonale 1-1 loin devant, soulevé ;
// la jambe gauche tendue derrière (à gauche), la droite porte le poids.
const tir = [
  V, V, V, V, V, V, V, V, V, V,       // 0-9
  ...TETE,                            // 10-19
  '..........kkkkkkkkkkkk..........', // 20
  '.........kTTTTTTTTTTTTk.........', // 21
  '.........kTTjJJJJJJdTTTk........', // 22
  '.........kJJkJJJJJJdkJJJk.......', // 23
  '..........kTTkJJJJJdkTTTk.......', // 24
  '...........kJJJJJJJdkTTTk.......', // 25
  '...........kJJJJJJJGGGBGGGk.....', // 26
  '...........kJJJJJJJGGGBGGGk.....', // 27
  '...........kTTTTTTTGGGBGGGk.....', // 28
  '........kPPPpPPPPPPPk..B........', // 29
  '......kJJk.....kJdk.....B.......', // 30
  '....kTTk.......kTTk......B......', // 31
  '..KKKK.........KKKK.......B.....', // 32
  '...LLLL.........LLLL.......B....', // 33
  '............................B...', // 34
  '.............................B..', // 35
  '...........................bbbbb', // 36
  V, V, V, V, V, V, V, V, V, V, V,    // 37-47
];

// passe : le balayage court. Les bras tendus devant à droite, les gants bas, le bâton sur la glace jusqu'à la lame.
const passe = [
  V, V, V, V, V, V, V, V, V, V,       // 0-9
  ...TETE,                            // 10-19
  '..........kkkkkkkkkkkk..........', // 20
  '.........kTTTTTTTTTTTTk.........', // 21
  '.........kTTjJJJJJJdTTTk........', // 22
  '.........kJJkJJJJJJdkJJJk.......', // 23
  '..........kJJkJJJJJdkkJJJk......', // 24
  '...........kTTkJJJJdk.kTTTk.....', // 25
  '............kJJkTTJdk.kTTTk.....', // 26
  '............kJJJJkkGGGBGGGk.....', // 27
  '............kTTTTTkGGGBGGGk.....', // 28
  '............kpPPPPPk..B.........', // 29
  '...........kJdk.kJdk..B.........', // 30
  '...........kTTk.kTTk..B.........', // 31
  '...........KKKK.KKKK...B........', // 32
  '............LLLL.LLLL..B........', // 33
  '.......................B........', // 34
  '........................B.......', // 35
  '........................B.......', // 36
  '........................B.......', // 37
  '.........................B......', // 38
  '.........................B......', // 39
  '.........................B......', // 40
  '..........................B.....', // 41
  '........................bbbbb...', // 42
  V, V, V, V, V,                      // 43-47
];

// echec : la mise en échec. La tête baissée et avancée (deux lignes plus bas, une colonne à droite), l'épaule droite
// devant, le tronc couché vers l'avant, les bras repliés devant la poitrine, le bâton bas en marches 3-1.
const echec = [
  V, V, V, V, V, V, V, V, V, V, V, V, V, // 0-12
  '...............kkkkkkk..........', // 13
  '..............khhHHHHHk.........', // 14
  '.............khhHHHHHHHk........', // 15
  '.............kHHHHHHHHHk........', // 16
  '.............kHHHHHHHHHk........', // 17
  '.............kHHkkkkkkkk........', // 18
  '.............kHHSkSSSkSk........', // 19
  '.............kHHSSSSSssk........', // 20
  '..............kHSSSSssk.........', // 21
  '..........kkkkkkkkkkkkkk........', // 22
  '.........kTTTTTTTTTTTTTTk.......', // 23
  '........kTTjJJJJJJJdTTTTk.......', // 24
  '........kJJkJJJJJJJdkJJJk.......', // 25
  '.........kJJkGGGJJJdkJJk........', // 26
  '..........kkkGGGJJGGGBk.........', // 27
  '............kTTTTTGGGBk.........', // 28
  '..........kpPPPPPPPPkB..........', // 29
  '.........kJdk....kJdk.B.........', // 30
  '........kTTk.....kTTk.B.........', // 31
  '.......KKKK......KKKK.B.........', // 32
  '........LLLL......LLLL.B........', // 33
  '.......................B........', // 34
  '.......................B........', // 35
  '........................B.......', // 36
  '........................B.......', // 37
  '........................B.......', // 38
  '.........................B......', // 39
  '.........................B......', // 40
  '.........................B......', // 41
  '........................bbbbb...', // 42
  V, V, V, V, V,                      // 43-47
];

// chute : couché à plat en diagonale, les patins en haut à gauche, le casque en bas à droite (on voit son dessus),
// un bras vers le haut à droite, l'autre vers le bas à gauche, le bâton par terre à côté, centré sur l'ancre.
const chute = [
  V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, // 0-23
  '.......kKKk.....................', // 24  le patin droit, sa lame vers le haut à gauche
  '......LkKKKk....................', // 25
  '....kKKkkTTk....................', // 26  le patin gauche, un cran plus bas
  '...LkKKKkTJJk...................', // 27
  '....LkKKTTJJPk..................', // 28
  '.......kkJJPPPk.................', // 29
  '..........kPPPPk.......kGGk.....', // 30
  '...........kPPPPk....kJJk.B.....', // 31
  '............kpPJJk.kJJk....B....', // 32
  '.............kJJJJkJJk......B...', // 33
  '..............kJJJJJdk.......B..', // 34
  '...........kJJkTTTTTTk........B.', // 35
  '.........kGGk.kTTTTTTk......bbbb', // 36
  '................kkkkkkk.........', // 37
  '...............khhHHHHHk........', // 38
  '...............kHHHHHHHk........', // 39
  '...............kHHHHHHHk........', // 40
  '................kkkkkkk.........', // 41
  V, V, V, V, V, V,                   // 42-47
];

export const PLANCHE = { SE: { repos, patin1, patin2, patin3, patin4, charge, tir, passe, echec, chute } };
