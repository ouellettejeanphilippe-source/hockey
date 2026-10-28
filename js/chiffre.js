/*
 * LE CHIFFRE À TENIR (tranche 3 ; JP, 27 oct. 2026 : *le club se construit autour du coach* ; réponse « oui » à
 * *un coach avec UN chiffre à tenir : sa confiance monte quand tu le tiens*). Chaque coach a UNE vraie stat de match,
 * la sienne (les tirs du Frelon, les tirs contre de la Tortue…), lue dans les feuilles jouées et comparée à la
 * ligue. Dix matchs de suite où ton club la tient, c'est un bloc tenu : un point de confiance de plus (`PLAFOND_TENUS`, un seul : mesuré, plus fait venir la première Coupe trop tôt). Une philosophie qu'on vit vaut plus qu'une philosophie qu'on achète.
 *
 * Le Rhino et le Showman lisent le leur dans la feuille même (`coupsBase`, `glacePremier`), pas contre la ligue : l'époque d'un
 * club dépasse l'effet d'un coach (docs/chiffre-du-coach.md). Aucune mécanique neuve : une stat que le moteur joue déjà, un compte de plus dans `buildDe` (js/banque.js). Les
 * blocs se recomptent des feuilles, comme les matchs à ton service ; une partie d'avant n'en a pas, et ça se tait.
 * Pur (navigateur + Node) ; `scripts/check_chiffre.mjs` le mesure.
 */
import { chiffresDuMatch, matchsJoues as feuillesJouees } from './profil-style.js';

/** Un bloc, en matchs de ton club. */
export const BLOC = 10;
/** Au plus ce nombre de blocs tenus comptent : un coach qu'on vit monte, il ne s'achète pas à lui seul. */
export const PLAFOND_TENUS = 1;

/*
 * Un chiffre : `valeur(feuilles, cote)` rend la stat d'un bloc (une moyenne ou une part) ; `seuil` est l'écart à la
 * ligue sur les mêmes journées, du bon côté (`sens` +1 : plus haut que la ligue, −1 : plus bas) ; `mot` le dit à l'écran.
 */
const moy = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const partDeLigne = (test) => (fs, cote) => {
  const b = fs.flatMap(f => f.buts.filter(x => x.cote === cote));
  return b.length ? b.filter(x => test(x.ligne)).length / b.length : 0;
};
export const CHIFFRES = {
  essaim: { nom: 'Tirs', sens: 1, seuil: 3, valeur: (fs, c) => moy(fs.map(f => chiffresDuMatch(f, c).tirsPour)), mot: n => `${n} tirs de plus que la ligue par match` },
  rapaces: {
    nom: 'Précision', sens: 1, seuil: 0.018,
    valeur: (fs, c) => { const t = fs.reduce((s, f) => s + chiffresDuMatch(f, c).tirsPour, 0); return t ? fs.reduce((s, f) => s + chiffresDuMatch(f, c).butsPour, 0) / t : 0; },
    mot: () => 'presque deux points de précision de plus que la ligue',
  },
  tortue: { nom: 'Tirs contre', sens: -1, seuil: 3, valeur: (fs, c) => moy(fs.map(f => chiffresDuMatch(f, c).tirsContre)), mot: n => `${n} tirs contre de moins que la ligue par match` },
  // Les mises en échec que ton alignement donne, contre ce qu'il donnerait sans carte de robustesse : l'époque et le gabarit des clubs s'annulent.
  rhinos: {
    nom: 'Mises en échec', sens: 1, seuil: 0.08,
    valeur: (fs, c) => { const b = fs.reduce((t, f) => t + ((f.coupsBase && f.coupsBase[c]) || 0), 0); return b > 0 ? fs.reduce((t, f) => t + (f.coups[c] || 0), 0) / b : 1; },
    mot: () => 'huit pour cent de mises en échec de plus que ton alignement n\'en donne seul',
  },
  // La part de glace de ton premier trio, lue de la feuille (les minutes que le moteur lui donne).
  etoiles: {
    nom: 'Glace du premier trio', sens: 1, seuil: 0.04,
    valeur: (fs, c) => moy(fs.map(f => (f.glacePremier && f.glacePremier[c]) || 0)),
    mot: () => 'quatre pour cent de la glace de plus pour ton premier trio que la ligue',
  },
  souffle: { nom: 'Blessures', sens: -1, seuil: 0.14, valeur: (fs, c) => moy(fs.map(f => (f.blessures || []).filter(b => b.cote === c).length)), mot: () => 'deux fois moins de blessures que la ligue' },
  choeur: { nom: 'Punitions', sens: -1, seuil: 1, valeur: (fs, c) => moy(fs.map(f => chiffresDuMatch(f, c).punitions)), mot: n => `${n} punition de moins que la ligue par match` },
  profondeur: { nom: 'Buts des 3e et 4e trios', sens: 1, seuil: 0.08, valeur: partDeLigne(l => l >= 3), mot: () => 'plus de buts du bas de l\'alignement que la ligue' },
};

/* Un bloc de `BLOC` feuilles de ton club : la ligue sur les mêmes journées est la moyenne de tous les autres côtés. */
function blocTenu(cle, bloc, ligue, cote) {
  const C = CHIFFRES[cle];
  const moi = C.valeur(bloc.map(m => m.f), cote(bloc, 0));
  const a = bloc[0].jour, b = bloc[bloc.length - 1].jour;
  const autres = ligue.filter(m => m.jour >= a && m.jour <= b);
  const lignes = [];
  for (const m of autres) { lignes.push(C.valeur([m.f], 'A'), C.valeur([m.f], 'B')); }
  const ref = moy(lignes);
  return C.sens * (moi - ref) >= C.seuil;
}

/**
 * Les blocs tenus de ce coach, par les matchs de ton club joués avant la journée `avant` (exclue). `matchs` : les
 * matchs joués du calendrier, à plat (`matchsJoues`, js/profil-style.js) ; `club` : ton équipe. Un coach sans chiffre
 * (le Comptable) n'en a pas. Rend `{ blocs, tenus, enCours }` : combien de blocs pleins, combien tenus, et le bloc ouvert.
 */
export function blocsTenus(cle, matchs, club, avant = Infinity) {
  const C = CHIFFRES[cle];
  if (!C) return { blocs: 0, tenus: 0, enCours: null };
  const miens = matchs.filter(m => m.jour < avant && (m.A === club || m.B === club));
  const cote = (bloc, i) => (bloc[i].A === club ? 'A' : 'B');
  const ligue = matchs.filter(m => m.jour < avant && m.A !== club && m.B !== club);
  const pleins = Math.floor(miens.length / BLOC);
  let tenus = 0;
  for (let k = 0; k < pleins; k++) if (blocTenu(cle, miens.slice(k * BLOC, (k + 1) * BLOC), ligue, cote)) tenus++;
  return { blocs: pleins, tenus, enCours: miens.length % BLOC };
}

/** Les points que le chiffre ajoute à la confiance : les blocs tenus, plafonnés. */
export const pointsTenus = (cle, matchs, club, avant = Infinity) => Math.min(PLAFOND_TENUS, blocsTenus(cle, matchs, club, avant).tenus);

/* Le `tenus` de `buildDe` / `palierAllume` pour un calendrier et ton club : (coach, journée) → points. */
export const tenusDe = (calendrier, you) => (cle, jusqua) => (CHIFFRES[cle] ? pointsTenus(cle, feuillesJouees(calendrier), you, jusqua) : 0);

/* Ce que l'écran du coach dit de son chiffre : `{ nom, but, tenus, enCours }`, ou null (pas de chiffre, pas de ligue). */
export function chiffreDit(cle, calendrier, you, avant = Infinity) {
  const C = CHIFFRES[cle];
  if (!C || !calendrier) return null;
  const r = blocsTenus(cle, feuillesJouees(calendrier), you, avant);
  return { nom: C.nom, but: C.mot(C.seuil), tenus: Math.min(PLAFOND_TENUS, r.tenus), enCours: r.enCours };
}
