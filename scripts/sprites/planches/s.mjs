// Artiste A — direction S (le joueur regarde vers nous), les dix poses. Phase 2 : aucune ombre au sol dans le sprite,
// le bâton tenu à droite du ventre (les deux gants empilés), le manche en diagonale régulière jusqu'à la lame en (16, 46).
// Repère :       1111111111222222222233
//      01234567890123456789012345678901
const V = '................................';

// La tête, la même partout (dix lignes : casque rond, reflet, visière, deux yeux, menton).
const TETE = [
  '.............kkkkkkk............', // +0
  '............khhHHHHHk...........', // +1
  '...........khhHHHHHHHk..........', // +2
  '...........kHHHHHHHHHk..........', // +3
  '...........kHHHHHHHHHk..........', // +4
  '...........kkkkkkkkkkk..........', // +5
  '...........kHSkSSSkSHk..........', // +6
  '...........kHSSSSSssHk..........', // +7
  '............kSSSSSssk...........', // +8
  '.............kkkkkkk............', // +9
];
// Les épaules (le joug T), le pommeau du bâton qui dépasse à droite.
const EPAULES = [
  '..........kkkkkkkkkkkkk.........', // +0
  '.........kTTTTTTTTTTTTTk........', // +1
  '........kTTTjJJJJJJdTTBk........', // +2
];
// Le tronc : le bras droit descend au gant du haut ; le bras gauche, un court moignon à poignet, passe sous le tronc
// jusqu'au gant du bas (lignes 23 à 29).
const TRONC = [
  '........kJJkJJJJJJJdkJBk........', // 23
  '.........kTTkJJJJJJdkGGGk.......', // 24
  '..........kJJJJJJJJdkGGGk.......', // 25
  '...........kJJJJJJJJGGGk........', // 26
  '...........kJJJJJJJdGGGk........', // 27
  '...........kTTTTTTTTGGGk........', // 28
  '...........kpPPPPPPPGGGk........', // 29
];
// Le manche, du gant du bas à la lame : quatre lignes par colonne, de (20, 30) à (17, 45).
const MANCHE = [
  '...................B............', // 34
  '...................B............', // 35
  '...................B............', // 36
  '...................B............', // 37
  '..................B.............', // 38
  '..................B.............', // 39
  '..................B.............', // 40
  '..................B.............', // 41
  '.................B..............', // 42
  '.................B..............', // 43
  '.................B..............', // 44
  '.................B..............', // 45
  '..............bbbbb.............', // 46
  V,                                   // 47
];

const repos = [
  V, V, V, V, V, V, V, V, V, V,                   // 0-9
  ...TETE,                                        // 10-19
  ...EPAULES,                                     // 20-22
  ...TRONC,                                       // 23-29
  '...........kJdk..kJdB...........', // 30
  '...........kTTk..kTTB...........', // 31
  '...........KKKK..KKKB...........', // 32
  '...........LLLL..LLLB...........', // 33
  ...MANCHE,                                      // 34-47
];

// patin1 : le contact ; la jambe droite (à droite de l'écran) pousse loin de côté, la gauche glisse sous le corps.
const patin1 = [
  V, V, V, V, V, V, V, V, V, V,                   // 0-9
  ...TETE, ...EPAULES, ...TRONC,                  // 10-29
  '...........kJdk..kJJBJk.........', // 30
  '...........kTTk.....BkTTTk......', // 31
  '...........KKKK.....B.....KKKK..', // 32
  '...........LLLL.....B.....LLLL..', // 33
  ...MANCHE,
];

// patin2 : le passage, les deux jambes sous le corps, le corps un cran plus haut.
const patin2 = [
  V, V, V, V, V, V, V, V, V,                      // 0-8
  ...TETE, ...EPAULES, ...TRONC,                  // 9-28
  '...........kPPPPPPPPkB..........', // 29
  '...........kJdk..kJdB...........', // 30
  '...........kTTk..kTTB...........', // 31
  '...........KKKK..KKKB...........', // 32
  '...........LLLL..LLLB...........', // 33
  ...MANCHE,
];

// patin3 : la jambe gauche pousse loin à gauche.
const patin3 = [
  V, V, V, V, V, V, V, V, V, V,                   // 0-9
  ...TETE, ...EPAULES, ...TRONC,                  // 10-29
  '.........kJJJk...kJdB...........', // 30
  '......kTTTk......kTTB...........', // 31
  '..KKKK...........KKKB...........', // 32
  '..LLLL...........LLLB...........', // 33
  ...MANCHE,
];

// patin4 : l'élan, les deux jambes reviennent sous le corps, la gauche encore un peu à l'écart.
const patin4 = [
  V, V, V, V, V, V, V, V, V, V,                   // 0-9
  ...TETE, ...EPAULES, ...TRONC,                  // 10-29
  '..........kJdk...kJdB...........', // 30
  '..........kTTk...kTTB...........', // 31
  '..........KKKK...KKKB...........', // 32
  '..........LLLL...LLLB...........', // 33
  ...MANCHE,
];

// charge : le lancer frappé se charge. Le bâton droit en l'air au-dessus de la tête (vers l'arrière, le haut de
// l'écran), les deux gants à droite de la tête, le bras gauche en travers du menton, les genoux pliés, les jambes écartées.
const charge = [
  V,                                   // 0
  '........................bbb.....', // 1
  '.......................bbbb.....', // 2
  '.......................B........', // 3
  '.......................B........', // 4
  '.......................B........', // 5
  '.......................B........', // 6
  '.......................B........', // 7
  '.......................B........', // 8
  '.......................B........', // 9
  '.............kkkkkkk...B........', // 10
  '............khhHHHHHk..B........', // 11
  '...........khhHHHHHHHkGGGk......', // 12
  '...........kHHHHHHHHHkGGGk......', // 13
  '...........kHHHHHHHHHkGGGk......', // 14
  '...........kkkkkkkkkkGGGk.......', // 15
  '...........kHSkSSSkSHGGGk.......', // 16
  '...........kHSSSSSssHGGGk.......', // 17
  '............kSSSSSsJJkJJk.......', // 18
  '.............kkkkJJkkJJk........', // 19
  '..........kkkkkJJkkkkJJk........', // 20
  '.........kTTTJJTTTTTTJJk........', // 21
  '........kTTJJkJJJJJdkJJk........', // 22
  '.........kjJJJJJJJJdk...........', // 23
  '..........kJJJJJJJJdk...........', // 24
  '...........kJJJJJJJdk...........', // 25
  '...........kJJJJJJJdk...........', // 26
  '...........kJJJJJJJdk...........', // 27
  '...........kTTTTTTTTk...........', // 28
  '..........kpPPPPPPPPPk..........', // 29
  '.........kJdk.......kJdk........', // 30
  '........kTTk.........kTTk.......', // 31
  '.......KKKK...........KKKK......', // 32
  '.......LLLL...........LLLL......', // 33
  V, V, V, V, V, V, V, V, V, V, V, V, V, V,       // 34-47
];

// tir : le fouetté. Le corps tourné : les deux gants balancés à droite, le bâton en diagonale loin devant (en bas),
// le bras gauche caché par le tronc, la jambe gauche tendue loin de côté, la droite porte le poids.
const tir = [
  V, V, V, V, V, V, V, V, V, V,                   // 0-9
  ...TETE,                                        // 10-19
  '..........kkkkkkkkkkkkk.........', // 20
  '.........kTTTTTTTTTTTTTk........', // 21
  '........kTTTjJJJJJJdTTTk........', // 22
  '........kJJkJJJJJJJdkJJk........', // 23
  '.........kTTkJJJJJJdkJJk........', // 24
  '...........kJJJJJJJdkTTk........', // 25
  '...........kJJJJJGGGBGGGk.......', // 26
  '...........kJJJJJGGGBGGGk.......', // 27
  '...........kTTTTTGGGBGGGk.......', // 28
  '........kPPPpPPPPPPPBk..........', // 29
  '......kJJk.....kJdk.B...........', // 30
  '....kTTk.......kTTkB............', // 31
  '..KKKK.........KKKKB............', // 32
  '..LLLL.........LLLLB............', // 33
  '...................B............', // 34
  '...................B............', // 35
  '..................B.............', // 36
  '..................B.............', // 37
  '..................B.............', // 38
  '..................B.............', // 39
  '..................B.............', // 40
  '.................B..............', // 41
  '.................B..............', // 42
  '.................B..............', // 43
  '.................B..............', // 44
  '.................B..............', // 45
  '..............bbbbb.............', // 46
  V,                                   // 47
];

// passe : le balayage court, les bras tendus devant à droite, les gants plus bas ; le manche en marches de trois.
const passe = [
  V, V, V, V, V, V, V, V, V, V,                   // 0-9
  ...TETE,                                        // 10-19
  '..........kkkkkkkkkkkkk.........', // 20
  '.........kTTTTTTTTTTTTTk........', // 21
  '........kTTTjJJJJJJdTTTk........', // 22
  '........kJJkJJJJJJJdkJJB........', // 23
  '.........kTTkJJJJJJdkkJJk.......', // 24
  '..........kJJJJJJJJdkkGGGk......', // 25
  '...........kJJJJJJJdkkGGGk......', // 26
  '...........kJJJJJJJJJkGGGk......', // 27
  '...........kTTTTTTTTGGGk........', // 28
  '...........kpPPPPPPPGGGk........', // 29
  '...........kJdk..kJdGGGk........', // 30
  '...........kTTk..kTTB...........', // 31
  '...........KKKK..KKKB...........', // 32
  '...........LLLL..LLLB...........', // 33
  '...................B............', // 34
  '...................B............', // 35
  '...................B............', // 36
  '..................B.............', // 37
  '..................B.............', // 38
  '..................B.............', // 39
  '.................B..............', // 40
  '.................B..............', // 41
  '.................B..............', // 42
  '................B...............', // 43
  '................B...............', // 44
  '................B...............', // 45
  '..............bbbbb.............', // 46
  V,                                   // 47
];

// echec : la mise en échec. La tête baissée de trois lignes (le tronc couché vers nous), les épaules élargies,
// les bras repliés, les gants contre la poitrine, le bâton bas tenu du gant droit, les jambes écartées.
const echec = [
  V, V, V, V, V, V, V, V, V, V, V, V, V,          // 0-12
  '.............kkkkkkk............', // 13
  '............khhHHHHHk...........', // 14
  '...........khhHHHHHHHk..........', // 15
  '...........kHHHHHHHHHk..........', // 16
  '...........kHHHHHHHHHk..........', // 17
  '...........kkkkkkkkkkk..........', // 18
  '...........kHSkSSSkSHk..........', // 19
  '.......kkkkkHSSSSSssHkkkkk......', // 20
  '......kTTTTTkSSSSSsskTTTTTk.....', // 21
  '.....kTTTTTTTkkkkkkkTTTTTTk.....', // 22
  '.....kJJJkJJJJJJJJJJdkJJJk......', // 23
  '.....kTTkJJJJJJJJJJJdkGGGk......', // 24
  '.....kGGGkJJJJJJJJJJdkGGGk......', // 25
  '......kGGGkJJJJJJJJJdkB.........', // 26
  '.......kkkkTTTTTTTTTk.B.........', // 27
  '..........kpPPPPPPPPk.B.........', // 28
  '..........kPPPPPPPPPk.B.........', // 29
  '.........kJdk.....kJdB..........', // 30
  '........kTTk......kTTB..........', // 31
  '.......KKKK.......KKKB..........', // 32
  '.......LLLL.......LLLB..........', // 33
  '....................B...........', // 34
  '....................B...........', // 35
  '....................B...........', // 36
  '....................B...........', // 37
  '...................B............', // 38
  '...................B............', // 39
  '...................B............', // 40
  '...................B............', // 41
  '..................B.............', // 42
  '..................B.............', // 43
  '..................B.............', // 44
  '..................B.............', // 45
  '..............bbbbb.............', // 46
  V,                                   // 47
];

// chute : à plat sur la glace, la tête vers nous (en bas), les patins derrière (en haut) : on voit le dos, le numéro,
// le dessus du casque ; les bras écartés, le bâton par terre à côté. Lignes 20 à 44, centré sur l'ancre.
const chute = [
  V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V,   // 0-19
  '.............KK...KK............', // 20
  '.............KK...KK............', // 21
  '............kTTk.kTTk...........', // 22
  '............kJdk.kJdk...........', // 23
  '............kPPPkPPPk...........', // 24
  '...........kpPPPPPPPPk..........', // 25
  '...........kPPPPPPPPPk..........', // 26
  '...........kTTTTTTTTTk..........', // 27
  '..........kjJJJJJJJJdk.....B....', // 28
  '........kkkJJJJJJJJJdkkk...B....', // 29
  '.......kJJkJWWWJWWWJdkJJk..B....', // 30
  '......kJJJkJWWWJWWWJdkJJJk..B...', // 31
  '......kTTTkJWWWJWWWJdkTTTk..B...', // 32
  '.....kGGGkJJJJJJJJJJdkGGGk..B...', // 33
  '.....kGGGkJJJJJJJJJJdkGGGk...B..', // 34
  '......kkk.kJJJJJJJJJdk.kkk...B..', // 35
  '..........kTTTTTTTTTTk.......B..', // 36
  '...........kTTTTTTTTk.........B.', // 37
  '.............kkkkkkk..........B.', // 38
  '............khhHHHHHk.........B.', // 39
  '...........khhHHHHHHHk.......bbb', // 40
  '...........kHHHHHHHHHk..........', // 41
  '...........kHHHHHHHHHk..........', // 42
  '............kHHHHHHHk...........', // 43
  '.............kkkkkkk............', // 44
  V, V, V,                             // 45-47
];

export const PLANCHE = { S: { repos, patin1, patin2, patin3, patin4, charge, tir, passe, echec, chute } };
