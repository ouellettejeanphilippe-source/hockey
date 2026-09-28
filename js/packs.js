/**
 * LES PACKS (S79) — à la HUT, à la FUT, à MLB The Show… et à la boîte de
 * cartes du dépanneur.
 *
 * JP : *une variété de packs de cartes randoms digne de HUT, FUT ou MLB the
 * show mobile* ; puis : *pack d'équipe, pack d'année, pack par skill, pack par
 * trio, pack all random, avec des vrais pull rates de cartes de hockey,
 * pokemon, etc, que c'est du gambling pour le mode roguelike*.
 *
 * LES VRAIS TAUX. Une boîte « hobby » d'Upper Deck donne une Young Guns
 * toutes les quatre pochettes, une parallèle numérotée /100 par boîte, un
 * « 1 de 1 » dans une caisse sur cent ; un booster Pokémon donne une holo
 * rare toutes les trois pochettes, une ultra rare toutes les sept, une rare
 * secrète toutes les soixante-dix. Nos variantes (js/rarete.js) sont posées
 * sur ces barèmes, par TIER de pack :
 *
 *   tier      cartes   base   parallèle   holo    or      (par carte, en %)
 *   bronze       3      82       14        3,6     0,4
 *   argent       4      70       22        7       1
 *   or           5      55       30       12       3
 *   premium      6      40       35       19       6
 *
 * Et l'or est NUMÉROTÉ, comme les parallèles des séries de luxe : /99 (78 %),
 * /25 (16 %), /10 (5 %) — et le « 1 de 1 » (1 % des or : une carte sur 2 500
 * dans un pack d'argent). Le numéro est COSMÉTIQUE : l'or joue ce que l'or
 * joue (js/rarete.js), rien de plus — la chasse ne casse pas le jeu.
 *
 * CHAQUE PACK AFFICHE SES CHANCES (\`chancesDe\`), en « 1 pack sur N » —
 * comme les packs de FUT depuis 2019. Et la GARANTIE (\`PITIE\`) : en mode
 * Rogue, huit packs de joueurs d'affilée sans holo ni or, et le neuvième en
 * a une. Elle est dite dans la boutique.
 *
 * TOUT EST PUR : un pack se tire de la graine de la partie, de son genre et du
 * numéro de l'achat. Une partie reprise ouvre les mêmes packs.
 */
import { hache } from './rogue.js';
import { BANQUE, idsDe } from './banque.js';

export const TIERS = {
  bronze: { nom: 'Bronze', n: 3, cotes: { commune: 82, peu: 14, rare: 3.6, legendaire: 0.4 } },
  argent: { nom: 'Argent', n: 4, cotes: { commune: 70, peu: 22, rare: 7, legendaire: 1 } },
  or: { nom: 'Or', n: 5, cotes: { commune: 55, peu: 30, rare: 12, legendaire: 3 } },
  premium: { nom: 'Premium', n: 6, cotes: { commune: 40, peu: 35, rare: 19, legendaire: 6 } },
};
/* La numérotation d'une or (en % des or). */
export const NUMEROS = [['/99', 78], ['/25', 16], ['/10', 5], ['1 de 1', 1]];
/* En mode Rogue : huit packs de joueurs sans holo ni or, et le neuvième en a une. */
export const PITIE = 8;

/*
 * LES PACKS DE JOUEURS. \`genre\` dit où l'on pige ; \`choix\` : le pack se
 * règle à l'achat (une franchise, une saison) ou au hasard. \`qui\` : la
 * part de chaque saison où l'on pige (\`productifs\` : la moitié haute ;
 * \`elite\` : le quart du haut).
 */
export const PACKS_JOUEURS = {
  hasard_bronze: { famille: 'hasard', nom: 'Pack Bronze', ico: '🥉', tier: 'bronze', prix: 12, texte: 'Trois vrais joueurs de toutes les époques.' },
  hasard_argent: { famille: 'hasard', nom: 'Pack Argent', ico: '🥈', tier: 'argent', prix: 20, texte: 'Quatre vrais joueurs de toutes les époques.' },
  hasard_or: { famille: 'hasard', nom: 'Pack Or', ico: '🥇', tier: 'or', prix: 35, texte: 'Cinq vrais joueurs, de meilleures chances.' },
  hasard_premium: { famille: 'hasard', nom: 'Pack Premium', ico: '💎', tier: 'premium', prix: 60, texte: 'Six vrais joueurs, les meilleures chances de la boutique.' },
  equipe: { famille: 'equipe', nom: 'Pack d\'équipe', ico: '🏟️', tier: 'argent', prix: 25, choix: 'franchise', texte: 'Quatre joueurs d\'une même franchise, toutes époques confondues.' },
  annee: { famille: 'annee', nom: 'Pack d\'année', ico: '📅', tier: 'argent', prix: 25, choix: 'saison', texte: 'Quatre joueurs d\'une même saison.' },
  ere70: { famille: 'ere', nom: 'Pack années 70', ico: '📻', tier: 'argent', prix: 22, decennie: 1970, texte: 'Quatre joueurs des années 70.' },
  ere80: { famille: 'ere', nom: 'Pack années 80', ico: '📼', tier: 'argent', prix: 22, decennie: 1980, texte: 'Quatre joueurs des années 80.' },
  ere90: { famille: 'ere', nom: 'Pack années 90', ico: '💾', tier: 'argent', prix: 22, decennie: 1990, texte: 'Quatre joueurs des années 90.' },
  ere00: { famille: 'ere', nom: 'Pack années 2000', ico: '📀', tier: 'argent', prix: 22, decennie: 2000, texte: 'Quatre joueurs des années 2000.' },
  ere10: { famille: 'ere', nom: 'Pack années 2010', ico: '📱', tier: 'argent', prix: 22, decennie: 2010, texte: 'Quatre joueurs des années 2010.' },
  ere20: { famille: 'ere', nom: 'Pack années 2020', ico: '🛰️', tier: 'argent', prix: 22, decennie: 2020, texte: 'Quatre joueurs des années 2020.' },
  sniper: { famille: 'skill', nom: 'Pack Francs-tireurs', ico: '🎯', tier: 'argent', prix: 28, skill: 'sniper', texte: 'Quatre marqueurs : le quart du haut aux buts par match de leur saison.' },
  passeur: { famille: 'skill', nom: 'Pack Passeurs', ico: '🪄', tier: 'argent', prix: 28, skill: 'passeur', texte: 'Quatre passeurs : le quart du haut aux passes par match.' },
  defensif: { famille: 'skill', nom: 'Pack Défensif', ico: '🛡️', tier: 'argent', prix: 25, skill: 'defensif', texte: 'Quatre joueurs au meilleur différentiel de leur saison.' },
  dur: { famille: 'skill', nom: 'Pack Durs à cuire', ico: '🥊', tier: 'argent', prix: 22, skill: 'dur', texte: 'Quatre durs : le quart du haut aux minutes de punition.' },
  gardien: { famille: 'skill', nom: 'Pack Gardiens', ico: '🥅', tier: 'argent', prix: 30, skill: 'gardien', texte: 'Quatre gardiens partants au meilleur pourcentage d\'arrêts de leur saison.' },
  recrue: { famille: 'skill', nom: 'Pack Recrues', ico: '🐣', tier: 'argent', prix: 22, skill: 'recrue', texte: 'Quatre joueurs à leur contrat d\'entrée.' },
  veteran: { famille: 'skill', nom: 'Pack Vétérans', ico: '🧓', tier: 'argent', prix: 22, skill: 'veteran', texte: 'Quatre joueurs de 33 ans et plus.' },
  trio: { famille: 'trio', nom: 'Pack Trio', ico: '🔗', tier: 'or', prix: 40, texte: 'Une vraie ligne d\'un même club-saison : son centre et ses deux ailiers — ou sa paire et son gardien.' },
  etoiles: { famille: 'etoiles', nom: 'Pack Étoiles', ico: '⭐', tier: 'or', prix: 55, texte: 'Cinq étoiles de leur saison : le 4 % du haut des pointeurs, le 8 % des gardiens.' },
  legendes: { famille: 'legendes', nom: 'Pack Légendes', ico: '👑', tier: 'premium', prix: 75, texte: 'Six étoiles d\'avant 1995.' },
  garanti: { famille: 'hasard', nom: 'Pack garanti', ico: '🔒', tier: 'or', prix: 45, garanti: true, texte: 'Cinq joueurs, dont une holo ou mieux, garantie.' },
};

/* LES PACKS DE CARTES : la banque (js/banque.js). Toutes gardées dans ton inventaire. */
const COTES_CARTES = { commune: 55, peu: 30, rare: 12, legendaire: 3 };
export const PACKS_CARTES = {
  patrons: { nom: 'Pack Personnel', ico: '👔', n: 3, prix: 30, cats: ['patron'], cotes: { commune: 45, peu: 35, rare: 16, legendaire: 4 }, texte: 'Trois patrons : le personnel qu\'on engage pour toute la saison.' },
  evenements: { nom: 'Pack Événements', ico: '📰', n: 4, prix: 15, cats: ['evenement'], cotes: COTES_CARTES, texte: 'Quatre événements d\'équipe.' },
  modifs: { nom: 'Pack Modifs', ico: '🧬', n: 4, prix: 20, cats: ['joueur'], cotes: COTES_CARTES, texte: 'Quatre styles, contrats, améliorations et éditions de joueur.' },
  consommables: { nom: 'Pack Consommables', ico: '🧴', n: 5, prix: 15, cats: ['consommable'], cotes: COTES_CARTES, texte: 'Cinq soins, boissons, coffres et coups de pouce.' },
  contrats: { nom: 'Pack Contrats', ico: '💵', n: 4, prix: 20, cats: ['plafond'], cotes: COTES_CARTES, maudite: 0.08, texte: 'Quatre cartes de masse salariale : de l\'espace, une retenue, un rachat… et parfois la taxe de luxe.' },
  match: { nom: 'Pack Cartes de match', ico: '🃏', n: 4, prix: 15, cats: ['match'], cotes: COTES_CARTES, texte: 'Quatre cartes pour ton deck de match.' },
  mixte: { nom: 'Pack Mixte', ico: '🎴', n: 5, prix: 25, cats: ['patron', 'evenement', 'joueur', 'consommable', 'plafond', 'match'], cotes: COTES_CARTES, texte: 'Cinq cartes de toutes les familles.' },
  lot: { nom: 'Le lot du vestiaire', ico: '📦', n: 12, prix: 55, cats: ['patron', 'evenement', 'joueur', 'consommable', 'plafond', 'match'], cotes: COTES_CARTES, maudite: 0.1, texte: 'Douze cartes de toutes les familles — le prix de deux packs mixtes et demi. Une chance sur dix d\'y trouver la taxe de luxe.' },
};

/* Tous les packs, par clé : \`j:\` les joueurs, \`c:\` les cartes. */
export const PACKS_TOUS = {
  ...Object.fromEntries(Object.entries(PACKS_JOUEURS).map(([k, P]) => [`j:${k}`, { ...P, sorte: 'joueurs', cle: k, n: P.n || TIERS[P.tier].n + (P.famille === 'trio' ? -2 : 0) }])),
  ...Object.fromEntries(Object.entries(PACKS_CARTES).map(([k, P]) => [`c:${k}`, { ...P, sorte: 'cartes', cle: k }])),
};
export const RAYONS = [
  { cle: 'jour', nom: 'Le pack du jour', ico: '📆' },
  { cle: 'hasard', nom: 'Au hasard', ico: '🎲', packs: ['j:hasard_bronze', 'j:hasard_argent', 'j:hasard_or', 'j:hasard_premium', 'j:garanti'] },
  { cle: 'cibles', nom: 'Équipe, année, trio', ico: '🏟️', packs: ['j:equipe', 'j:annee', 'j:trio', 'j:etoiles', 'j:legendes'] },
  { cle: 'epoques', nom: 'Les époques', ico: '📼', packs: ['j:ere70', 'j:ere80', 'j:ere90', 'j:ere00', 'j:ere10', 'j:ere20'] },
  { cle: 'skills', nom: 'Par talent', ico: '🎯', packs: ['j:sniper', 'j:passeur', 'j:defensif', 'j:dur', 'j:gardien', 'j:recrue', 'j:veteran'] },
  { cle: 'cartes', nom: 'Les cartes', ico: '🃏', packs: ['c:patrons', 'c:evenements', 'c:modifs', 'c:consommables', 'c:contrats', 'c:match', 'c:mixte', 'c:lot'] },
];

/* LE PACK DU JOUR : un pack de la boutique, à 25 % de rabais, qui change chaque jour (la date). */
export function packDuJour(date = new Date()) {
  const cle = typeof date === 'string' ? date : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const tous = Object.keys(PACKS_TOUS).filter(k => k !== 'c:lot' && k !== 'j:legendes');
  return { pack: tous[Math.floor(hache('pack-du-jour', cle) * tous.length)], rabais: 0.75, date: cle };
}
export const prixDe = (cle, rabais = 1) => Math.max(1, Math.round((PACKS_TOUS[cle] || {}).prix * rabais));

/* ---------- les chances affichées ---------- */
const unSur = p => (p <= 0 ? null : p >= 0.999 ? 1 : Math.max(2, Math.round(1 / p)));
/*
 * « Holo ou mieux : 1 pack sur 4 », « Or : 1 pack sur 25 », « 1 de 1 : 1 pack
 * sur 2 500 » — la chance d'en trouver AU MOINS une dans le pack, pour son
 * nombre de cartes. \`mods\` : ce que les patrons changent (\`holo\`,
 * \`carteExtra\`, \`sansBase\`).
 */
export function chancesDe(cle, mods = {}) {
  const P = PACKS_TOUS[cle];
  if (!P) return [];
  if (P.sorte === 'cartes') {
    const c = P.cotes;
    const tot = c.commune + c.peu + c.rare + c.legendaire;
    const r = (c.rare + c.legendaire) / tot, l = c.legendaire / tot;
    const n = P.n;
    return [
      { nom: 'Rare ou mieux', txt: formatUnSur(1 - (1 - r) ** n), p: 1 - (1 - r) ** n },
      { nom: 'Légendaire', txt: formatUnSur(1 - (1 - l) ** n), p: 1 - (1 - l) ** n },
      // Le jeu de hasard dit aussi sa malchance.
      ...(P.maudite ? [{ nom: 'Une malédiction', txt: formatUnSur(P.maudite), p: P.maudite, maudite: true }] : []),
    ];
  }
  const c = cotesDuPack(cle, mods);
  const n = P.n + (mods.carteExtra || 0);
  const r = (c.rare + c.legendaire) / 100, l = c.legendaire / 100, un = l * NUMEROS[3][1] / 100;
  const pr = P.garanti ? 1 : 1 - (1 - r) ** n;
  return [
    { nom: 'Parallèle ou mieux', txt: formatUnSur(1 - (1 - (c.peu + c.rare + c.legendaire) / 100) ** n), p: 1 - (1 - (c.peu + c.rare + c.legendaire) / 100) ** n },
    { nom: 'Holo ou mieux', txt: P.garanti ? 'garantie' : formatUnSur(pr), p: pr },
    { nom: 'Or numérotée', txt: formatUnSur(1 - (1 - l) ** n), p: 1 - (1 - l) ** n },
    { nom: '1 de 1', txt: formatUnSur(1 - (1 - un) ** n), p: 1 - (1 - un) ** n },
  ];
}
function formatUnSur(p) {
  const n = unSur(p);
  if (n === null) return 'jamais';
  if (n === 1) return 'dans chaque pack';
  // Au-dessus d'une chance sur deux, « 1 pack sur 2 » mentirait : on dit le pourcentage.
  if (p >= 0.5) return p >= 0.995 ? 'dans presque chaque pack' : `${Math.round(p * 100)} % des packs`;
  return `1 pack sur ${n.toLocaleString('fr-CA')}`;
}
/* Le barème d'une carte de ce pack, en %, avec ce que les patrons y changent. */
export function cotesDuPack(cle, mods = {}) {
  const P = PACKS_TOUS[cle];
  const c = { ...TIERS[P.tier || 'argent'].cotes };
  if (mods.holo && mods.holo !== 1) {
    const gain = (c.rare + c.legendaire) * (mods.holo - 1);
    c.rare *= mods.holo; c.legendaire *= mods.holo; c.commune = Math.max(0, c.commune - gain);
  }
  if (mods.sansBase) { c.peu += c.commune; c.commune = 0; }
  return c;
}

/* ---------- les tirages ---------- */
const ORDRE_VAR = ['commune', 'peu', 'rare', 'legendaire'];
/* Une variante tirée aux cotes du pack, et son numéro si c'est une or. */
export function tirerVariante(cotes, ...parts) {
  let r = hache('pack-var', ...parts) * 100;
  let rar = 'commune';
  for (const k of ORDRE_VAR) { r -= cotes[k] || 0; if (r < 0) { rar = k; break; } }
  let num = null;
  if (rar === 'legendaire') {
    let x = hache('pack-num', ...parts) * 100;
    for (const [n, w] of NUMEROS) { x -= w; if (x < 0) { num = n; break; } }
    num = num || '/99';
  }
  return { rar, num };
}
/*
 * LES CARTES D'UN PACK DE CARTES : pures (graine, pack, numéro d'achat). Pour
 * chaque carte : sa FAMILLE d'abord (une des familles du pack, à parts égales —
 * sinon les 73 cartes de match noieraient un pack mixte), puis sa rareté aux
 * cotes du pack, puis une carte de cette famille et de cette rareté ; sans
 * carte à cette rareté, on descend d'un cran. Les malédictions ne sortent
 * jamais d'un pack.
 */
export function tirerCartesPack(cleCourte, graine, n) {
  const P = PACKS_CARTES[cleCourte];
  if (!P) return [];
  const out = [];
  for (let t = 0; t < P.n; t++) {
    const cat = P.cats[Math.floor(hache(graine, 'pack-famille', cleCourte, n, t) * P.cats.length)];
    const pool = idsDe(cat).filter(id => BANQUE[id].rarete !== 'maudite');
    let r = hache(graine, 'pack-cartes', cleCourte, n, t) * 100;
    let rar = 'commune';
    for (const k of ORDRE_VAR) { r -= P.cotes[k] || 0; if (r < 0) { rar = k; break; } }
    for (let i = ORDRE_VAR.indexOf(rar); i >= 0; i--) {
      const c = pool.filter(id => BANQUE[id].rarete === ORDRE_VAR[i]);
      if (!c.length) continue;
      out.push(c[Math.floor(hache(graine, 'pack-carte', cleCourte, n, t, ORDRE_VAR[i]) * c.length)]);
      break;
    }
  }
  // LA MALCHANCE (le jeu de hasard) : certains packs cachent une malédiction, qui prend la dernière place.
  if (P.maudite && out.length && hache(graine, 'pack-maudite', cleCourte, n) < P.maudite) {
    const m = P.cats.flatMap(idsDe).filter(id => BANQUE[id].rarete === 'maudite');
    if (m.length) out[out.length - 1] = m[Math.floor(hache(graine, 'pack-maudite-carte', cleCourte, n) * m.length)];
  }
  return out;
}
/*
 * LA GARANTIE (Rogue) : combien de packs de joueurs d'affilée sans holo ni or
 * — lu dans les décisions d'achat (\`achat.meilleure\`). Au bout de PITIE − 1,
 * le prochain en garantit une.
 */
export function packsSansHolo(decisions = []) {
  let n = 0;
  for (const d of [...decisions].filter(x => x && (x.achat || x.rogue) && (x.achat || x.rogue).sorte === 'joueurs').sort((a, b) => (a.achat || a.rogue).n - (b.achat || b.rogue).n)) {
    const m = (d.achat || d.rogue).meilleure;
    n = m === 'rare' || m === 'legendaire' ? 0 : n + 1;
  }
  return n;
}

/*
 * LES TALENTS : lus dans les VRAIES fiches de la saison du joueur, jamais
 * dans une cote. \`score\` : plus c'est haut, mieux il correspond ; on pige
 * dans le quart du haut de sa saison (les réguliers seulement).
 */
export const SKILLS = {
  sniper: { groupe: 'F', min: 30, score: p => (p.g || 0) / Math.max(1, p.gp || 1) },
  passeur: { groupe: null, min: 30, skaters: true, score: p => (p.a || 0) / Math.max(1, p.gp || 1) },
  defensif: { groupe: null, min: 40, skaters: true, score: p => (p.pm || 0) },
  dur: { groupe: null, min: 30, skaters: true, score: p => (p.pim || 0) / Math.max(1, p.gp || 1) },
  gardien: { groupe: 'G', min: 20, score: p => p.sv || 0 },
  recrue: { groupe: null, min: 20, filtre: p => !!p.elc, score: p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1) },
  veteran: { groupe: null, min: 30, filtre: (p, age) => age >= 33, score: p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1) },
};
