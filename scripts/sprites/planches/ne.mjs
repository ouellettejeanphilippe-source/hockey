// Direction NE — le joueur regarde vers le haut à droite de l'écran : trois quarts dos.
// L'arrière du casque (le reflet h en haut à gauche), un bout de joue à droite sous le rebord, la nuque, le joug T,
// le numéro 11 dans le dos vu de biais (glissé à gauche, l'ombre d élargie à droite : le dos tourné), les deux gants
// à droite du ventre, le manche en diagonale 1-1 vers le haut à droite, la lame au point (26, 22), contre l'épaule.
// Même tête, mêmes épaules, mêmes 23 lignes (10 à 32) que le joueur de A vu de face. Aucune ombre au sol.
// Repère :       1111111111222222222233
//      01234567890123456789012345678901
const V = '................................';
const img = o => Array.from({ length: 48 }, (_, y) => o[y] ?? V);
// Décale un bloc de rangées de dy vers le bas et de dx vers la droite.
const decale = (r, dy = 0, dx = 0) => {
  const o = {};
  for (const [y, l] of Object.entries(r)) o[Number(y) + dy] = dx >= 0 ? (V.slice(0, dx) + l).slice(0, 32) : (l + V).slice(-dx, -dx + 32);
  return o;
};

// La tête vue de dos, rangées 10 à 19 : le casque descend jusqu'à la nuque, la joue droite dépasse sous le rebord.
const TETE = {
  10: '.............kkkkkkk............',
  11: '............khhHHHHHk...........',
  12: '...........khhHHHHHHHk..........',
  13: '...........khHHHHHHHHk..........',
  14: '...........kHHHHHHHHHk..........',
  15: '...........kHHHHHHHHHk..........',
  16: '...........kHHHHHHkSSk..........',
  17: '............kHHHHHkSsk..........',
  18: '.............kkkkSSsk...........',
  19: '.............kkkkkkk............',
};
const tete = (dy = 0, dx = 0) => decale(TETE, dy, dx);

// Le buste vu de dos, rangées 20 à 28 : le joug, le numéro, le bras gauche qui pend (son avant-bras passe derrière
// le tronc), le bras droit qui descend aux deux gants, le manche en marches 1-1 de (20, 28) à (25, 23), la lame en 22.
const BUSTE = {
  20: '..........kkkkkkkkkkkkk.........',
  21: '.........kTTTTTTTTTTTTTk..bbb...',
  22: '........kTTTjJJJJJJdTTTkbbbbb...',
  23: '........kJJkJWWJWWddkJdk.B......',
  24: '.........kJdkWWJWWddkJdkB.......',
  25: '..........kdJWWJWWddkTGBGk......',
  26: '...........kJWWJWWddkGBGGk......',
  27: '...........kJWWJWWdGGBGk........',
  28: '...........kTTTTTTTGBGk.........',
};
const buste = (dy = 0, dx = 0) => decale(BUSTE, dy, dx);

// Les jambes au repos : genoux un peu pliés, les deux patins sous le corps, de part et d'autre de l'ancre.
const JAMBES = {
  29: '...........kpPPPPPPPk...........',
  30: '...........kJdk..kJdk...........',
  31: '...........kTTk..kTTk...........',
  32: '...........KKKK..KKKK...........',
  33: '...........LLLL..LLLL...........',
};

// repos : debout, le bâton tenu à droite, sa lame devant à (26, 22).
const repos = img({ ...tete(), ...buste(), ...JAMBES });

// patin1 : la jambe droite (à droite de l'écran) pousse loin de côté, vers le bas à droite ; la gauche sous le corps.
const patin1 = img({
  ...tete(), ...buste(),
  29: '...........kpPPPPPPPPPk.........',
  30: '...........kJdk..kJJJJdk........',
  31: '...........kTTk.....kTTTk.......',
  32: '...........KKKK........KKKK.....',
  33: '...........LLLL........LLLL.....',
});

// patin2 : les deux jambes sous le corps, tout le corps un cran plus haut (le passage), les jambes allongées d'une ligne.
const patin2 = img({
  ...tete(-1), ...buste(-1),
  28: '...........kpPPPPPPPk...........',
  29: '...........kPPPPPPPPk...........',
  30: '...........kJdk..kJdk...........',
  31: '...........kTTk..kTTk...........',
  32: '...........KKKK..KKKK...........',
  33: '...........LLLL..LLLL...........',
});

// patin3 : la jambe gauche (à gauche de l'écran) pousse loin de côté, vers le haut à gauche ; la droite sous le corps.
const patin3 = img({
  ...tete(), ...buste(),
  29: '.........kPPPpPPPPPPk...........',
  30: '........kdJJJJk..kJdk...........',
  31: '.......kTTTk.....kTTk...........',
  32: '.....KKKK........KKKK...........',
  33: '.....LLLL........LLLL...........',
});

// patin4 : les deux jambes sous le corps (l'élan), genoux pliés, les patins un cran plus écartés qu'au repos.
const patin4 = img({
  ...tete(), ...buste(),
  29: '..........kpPPPPPPPPk...........',
  30: '..........kJdk...kJdk...........',
  31: '..........kTTk...kTTk...........',
  32: '..........KKKK...KKKK...........',
  33: '..........LLLL...LLLL...........',
});

// charge : le lancer frappé se charge. Les deux gants à droite de la tête, le bras droit monte de l'épaule, le manche
// grimpe en marches 2-1 par-dessus le casque vers l'arrière (le bas à gauche de la glace : l'écran le montre en haut à
// gauche), la lame tout en haut. Genoux pliés, jambes écartées. Le bras gauche pend, le tronc se tourne.
const charge = img({
  1: '...............bbbb.............',
  2: '..............bbbbB.............',
  3: '...................B............',
  4: '...................B............',
  5: '....................B...........',
  6: '....................B...........',
  7: '.....................B..........',
  8: '.....................B..........',
  9: '......................B.........',
  10: '.............kkkkkkk..B.........',
  11: '............khhHHHHHk.kBk.......',
  12: '...........khhHHHHHHHkGGGk......',
  13: '...........khHHHHHHHHkGGGk......',
  14: '...........kHHHHHHHHHkGGGk......',
  15: '...........kHHHHHHHHHkGGGk......',
  16: '...........kHHHHHHkSSkGGGk......',
  17: '............kHHHHHkSskGGk.......',
  18: '.............kkkkSSskJdk........',
  19: '.............kkkkkkkJJdk........',
  20: '..........kkkkkkkkkkkJdk........',
  21: '.........kTTTTTTTTTTTTTk........',
  22: '........kTTTjJJJJJJddTTk........',
  23: '........kJJkJWWJWWJddkk.........',
  24: '.........kJJkWWJWWJddk..........',
  25: '..........kTTWWJWWJddk..........',
  26: '...........kJWWJWWJddk..........',
  27: '...........kJWWJWWJddk..........',
  28: '...........kTTTTTTTTTk..........',
  29: '..........kpPPPPPPPPPk..........',
  30: '.........kJdk.......kJdk........',
  31: '........kTTk.........kTTk.......',
  32: '.......KKKK...........KKKK......',
  33: '.......LLLL...........LLLL......',
});

// tir : le fouetté. Le corps tourné d'un cran vers la droite, les gants balancés en haut à droite, le manche file en
// marches 1-1 vers le haut à droite, la lame en l'air devant ; la jambe gauche tendue derrière (le bas à gauche).
const tir = img({
  ...tete(0, 1),
  13: '............khHHHHHHHHk.....bbbb',
  14: '............kHHHHHHHHHk....bbbb.',
  15: '............kHHHHHHHHHk......B..',
  16: '............kHHHHHHkSSk.....B...',
  17: '.............kHHHHHkSsk....B....',
  18: '..............kkkkSSsk....B.....',
  19: '..............kkkkkkk....B......',
  20: '...........kkkkkkkkkkkkkB.......',
  21: '..........kTTTTTTTTTTTTBk.......',
  22: '.........kTTTjJJJJJJdGBGk.......',
  23: '.........kJJkJWWJWWdGBGk........',
  24: '..........kJJkWWJWWddGGk........',
  25: '...........kTTWWJWWddk..........',
  26: '............kJWWJWWddk..........',
  27: '............kJWWJWWddk..........',
  28: '............kTTTTTTTTk..........',
  29: '.........kPPPpPPPPPPPk..........',
  30: '......kdJJJJk...kJdk............',
  31: '.....kTTTk......kTTk............',
  32: '...KKKK.........KKKK............',
  33: '...LLLL.........LLLL............',
});

// passe : le balayage court. Le bras droit tendu vers la droite, les gants un cran plus loin du ventre, le manche court,
// la lame devant sur la glace à (26, 22).
const passe = img({
  ...tete(),
  20: '..........kkkkkkkkkkkkk.........',
  21: '.........kTTTTTTTTTTTTTk..bbb...',
  22: '........kTTTjJJJJJJdTTTkbbbbb...',
  23: '........kJJkJWWJWWddkJJdkB......',
  24: '.........kJdkWWJWWddkdTGBGk.....',
  25: '..........kdJWWJWWddkkGBGk......',
  26: '...........kJWWJWWddkGBGk.......',
  27: '...........kJWWJWWdGGBGk........',
  28: '...........kTTTTTTTGBGk.........',
  ...JAMBES,
});

// echec : la mise en échec. La tête monte de deux et avance de deux vers la droite (le tronc couché vers l'avant,
// l'épaule droite devant), le joug relevé à droite, les bras repliés contre le corps, le bâton bas, sa lame devant.
const echec = img({
  ...tete(-2, 2),
  18: '....................kkkk........',
  19: '..........kkkkkkkkkkTTTk........',
  20: '.........kTTTTTTTTTTTTTk........',
  21: '........kTTTjJJJJJJdTTdk..bbb...',
  22: '........kJJkJWWJWWddkJdkbbbbb...',
  23: '........kTTkJWWJWWddkGGBk.......',
  24: '.........kkkJWWJWWddGGBGk.......',
  25: '...........kJWWJWWdGGBGk........',
  26: '...........kJWWJWWddBGk.........',
  27: '...........kJJJJJJddk...........',
  28: '...........kTTTTTTTTk...........',
  29: '.........kPPPpPPPPPPPk..........',
  30: '........kdJJJk...kJJJdk.........',
  31: '.......kTTTk......kTTTk.........',
  32: '.....KKKK..........KKKK.........',
  33: '.....LLLL..........LLLL.........',
});

// chute : couché à plat sur la glace, en diagonale (marches 2-1), la tête vers le haut à droite, les patins en bas à
// gauche, le dos et le numéro vers nous, le bâton par terre à côté. 24 pixels de long sur 10 de haut, centré sur l'ancre.
const chute = img({
  24: '.......................kkkkk....',
  25: '......................khhHHHk...',
  26: '......................kHHHHHHk..',
  27: '.....................kkHHHHHHk..',
  28: '...................kkTTkHHHHk...',
  29: '..................kTTTTTkkkk....',
  30: '................kkJJTTTTk.......',
  31: '..............kkJJWWJJJdk.......',
  32: '............kkJJJWWJJJdk........',
  33: '..........kkJJJJWWJTTdk.........',
  34: '........kkPPPJJJTTTTdk..........',
  35: '......kkPPPPPPPTTkkk............',
  36: '....kkJTkPPPPPkk................',
  37: '..kKKkJTkkkkk...................',
  38: '.kKKKkKKk.......................',
  39: '..LLL.LL........................',
  39: '.......................bbbbb....',
  40: '.....................BBbbb......',
  41: '...................BB...........',
  42: '.................BB.............',
  43: '...............BB...............',
  44: '.............BB.................',
});

export const PLANCHE = { NE: { repos, patin1, patin2, patin3, patin4, charge, tir, passe, echec, chute } };
