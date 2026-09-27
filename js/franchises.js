/**
 * LES FRANCHISES (S73) — l'histoire d'un club, relocalisations comprises.
 *
 * JP : *ajouter possible de juste piger dans l'histoire d'une équipe, comme
 * l'équivalent dans une même saison pour l'alignement*. Le tirage « Une
 * franchise » ne sort que des vestiaires de CE club, toutes saisons
 * confondues : le Canadien de 1976-77 et celui de 1992-93 dans le même
 * alignement, Sakic nordique et Sakic avalanche.
 *
 * UNE FRANCHISE, C'EST UNE LIGNÉE DE CODES. Les données rangent les joueurs
 * par code d'équipe d'une saison (`QUE` en 1994-95, `COL` en 1995-96), donc
 * une franchise est la liste des codes qu'elle a portés, chacun avec ses
 * années. Les années sont celles du début de la saison (1972 pour 1972-73) ;
 * une saison absente des données (2004-05, le lock-out) est simplement sautée.
 *
 * Utah (2024-) reprend les joueurs et l'organisation hockey des Coyotes, et
 * c'est ce qui compte pour un repêchage : on le range dans leur lignée.
 * Les Barons de Cleveland reprennent les Golden Seals ; leur fusion avec les
 * North Stars (1978) n'en fait pas une lignée, les North Stars restent les leurs.
 */
export const FRANCHISES = {
  MTL: { nom: 'Canadiens de Montréal', codes: [['MTL', 1970, 2100]] },
  TOR: { nom: 'Maple Leafs de Toronto', codes: [['TOR', 1970, 2100]] },
  BOS: { nom: 'Bruins de Boston', codes: [['BOS', 1970, 2100]] },
  NYR: { nom: 'Rangers de New York', codes: [['NYR', 1970, 2100]] },
  DET: { nom: 'Red Wings de Détroit', codes: [['DET', 1970, 2100]] },
  CHI: { nom: 'Blackhawks de Chicago', codes: [['CHI', 1970, 2100]] },
  PHI: { nom: 'Flyers de Philadelphie', codes: [['PHI', 1970, 2100]] },
  PIT: { nom: 'Penguins de Pittsburgh', codes: [['PIT', 1970, 2100]] },
  STL: { nom: 'Blues de St. Louis', codes: [['STL', 1970, 2100]] },
  LAK: { nom: 'Kings de Los Angeles', codes: [['LAK', 1970, 2100]] },
  BUF: { nom: 'Sabres de Buffalo', codes: [['BUF', 1970, 2100]] },
  VAN: { nom: 'Canucks de Vancouver', codes: [['VAN', 1970, 2100]] },
  DAL: { nom: 'Stars de Dallas', lignee: 'North Stars du Minnesota · Stars', codes: [['MNS', 1970, 1992], ['DAL', 1993, 2100]] },
  SEALS: { nom: 'Golden Seals · Barons', lignee: 'Golden Seals de Californie · Barons de Cleveland', codes: [['CGS', 1970, 1975], ['CLE', 1976, 1977]] },
  NYI: { nom: 'Islanders de New York', codes: [['NYI', 1972, 2100]] },
  CGY: { nom: 'Flames de Calgary', lignee: "Flames d'Atlanta · Flames de Calgary", codes: [['AFM', 1972, 1979], ['CGY', 1980, 2100]] },
  WSH: { nom: 'Capitals de Washington', codes: [['WSH', 1974, 2100]] },
  NJD: { nom: 'Devils du New Jersey', lignee: 'Scouts de Kansas City · Rockies du Colorado · Devils', codes: [['KCS', 1974, 1975], ['CLR', 1976, 1981], ['NJD', 1982, 2100]] },
  EDM: { nom: "Oilers d'Edmonton", codes: [['EDM', 1979, 2100]] },
  COL: { nom: 'Avalanche du Colorado', lignee: 'Nordiques de Québec · Avalanche', codes: [['QUE', 1979, 1994], ['COL', 1995, 2100]] },
  CAR: { nom: 'Hurricanes de la Caroline', lignee: 'Whalers de Hartford · Hurricanes', codes: [['HFD', 1979, 1996], ['CAR', 1997, 2100]] },
  UTA: { nom: 'Jets · Coyotes · Utah', lignee: 'Jets de Winnipeg (1979-96) · Coyotes · Utah', codes: [['WIN', 1979, 1995], ['PHX', 1996, 2013], ['ARI', 2014, 2023], ['UTA', 2024, 2100]] },
  SJS: { nom: 'Sharks de San Jose', codes: [['SJS', 1991, 2100]] },
  OTT: { nom: "Sénateurs d'Ottawa", codes: [['OTT', 1992, 2100]] },
  TBL: { nom: 'Lightning de Tampa Bay', codes: [['TBL', 1992, 2100]] },
  ANA: { nom: "Ducks d'Anaheim", codes: [['ANA', 1993, 2100]] },
  FLA: { nom: 'Panthers de la Floride', codes: [['FLA', 1993, 2100]] },
  NSH: { nom: 'Predators de Nashville', codes: [['NSH', 1998, 2100]] },
  WPG: { nom: 'Jets de Winnipeg', lignee: "Thrashers d'Atlanta · Jets", codes: [['ATL', 1999, 2010], ['WPG', 2011, 2100]] },
  CBJ: { nom: 'Blue Jackets de Columbus', codes: [['CBJ', 2000, 2100]] },
  MIN: { nom: 'Wild du Minnesota', codes: [['MIN', 2000, 2100]] },
  VGK: { nom: 'Golden Knights de Vegas', codes: [['VGK', 2017, 2100]] },
  SEA: { nom: 'Kraken de Seattle', codes: [['SEA', 2021, 2100]] },
};

/* Le code que la franchise portait cette saison-là, ou null si elle n'existait pas. */
export function codeDeFranchise(cle, saison) {
  const F = FRANCHISES[cle];
  const an = parseInt(String(saison).slice(0, 4), 10);
  if (!F || !Number.isFinite(an)) return null;
  const c = F.codes.find(([, a, b]) => an >= a && an <= b);
  return c ? c[0] : null;
}

/* Les saisons des données où la franchise a joué : [[saison, code], …]. */
export function saisonsDeFranchise(cle, saisons) {
  return saisons.map(s => [s, codeDeFranchise(cle, s)]).filter(([, c]) => c);
}

/* La franchise d'un code d'équipe (l'écusson du bouton, la couleur de l'interface). */
export function franchiseDuCode(code) {
  return Object.keys(FRANCHISES).find(k => FRANCHISES[k].codes.some(([c]) => c === code)) || null;
}

/* L'écusson qui la représente : celui de son code actuel (le dernier de la lignée). */
export const codeActuel = cle => { const F = FRANCHISES[cle]; return F ? F.codes[F.codes.length - 1][0] : null; };
