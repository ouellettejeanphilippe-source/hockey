/*
 * LE CHIFFRE À TENIR (tranche 3 ; JP, 27 oct. 2026 : *le club se construit autour du coach* ; réponse « oui » à
 * *un coach avec UN chiffre à tenir : sa confiance monte quand tu le tiens*). Chaque coach a UNE vraie stat de match,
 * la sienne (les tirs du Frelon, les tirs contre de la Tortue…), lue dans les feuilles jouées et comparée à la
 * ligue. Dix matchs de suite où ton club la tient, c'est un bloc tenu.
 *
 * V20 (docs/refonte-v20.md ; JP : *oui à tout*) : c'est le SEUL chemin de la confiance. Chaque bloc tenu vaut
 * `POINTS_PAR_BLOC` point (`SEUILS`, js/coachs.js : la II à quatre blocs, la III à douze), sans plafond ; les adjoints de
 * sa couleur, ses joueurs et les options de sa couleur poussent sa stat, et c'est ainsi qu'ils la font monter. Un bloc
 * raté ne coûte rien. Les blocs se comptent depuis l'entrée en poste du coach (`depuis`), et le report d'une saison
 * les garde (js/rogue-jeu.js). Une philosophie qu'on vit vaut plus qu'une philosophie qu'on achète.
 *
 * Le Rhino et le Showman lisent le leur dans la feuille même (`coupsBase`, `glacePremier`), pas contre la ligue : l'époque d'un
 * club dépasse l'effet d'un coach (docs/chiffre-du-coach.md). Aucune mécanique neuve : une stat que le moteur joue déjà, un compte de plus dans `buildDe` (js/banque.js). Les
 * blocs se recomptent des feuilles ; une partie d'avant n'en a pas, et ça se tait.
 * Pur (navigateur + Node) ; `scripts/check_chiffre.mjs` le mesure.
 */
import { chiffresDuMatch, matchsJoues as feuillesJouees } from './profil-style.js';

/** Un bloc, en matchs de ton club. */
export const BLOC = 10;
/*
 * Les points de confiance d'un bloc tenu (V20) : avec `SEUILS` [3, 7, 15], la II à 4 blocs, la III à 12. Mesuré chez le
 * robot attentif (16 campagnes-saisons) : la II au 50e match en médiane (37 avant, par les quatre chemins), la III en
 * deuxième saison de run ; à deux points par bloc, la III venait en première saison et la Coupe dès la première run.
 */
export const POINTS_PAR_BLOC = 1;

/*
 * Un chiffre : `valeur(feuilles, cote)` rend la stat d'un bloc (une moyenne ou une part) ; `seuil` est l'écart à la
 * ligue sur les mêmes journées, du bon côté (`sens` +1 : plus haut que la ligue, −1 : plus bas) ; `mot` le dit à l'écran,
 * `dit` écrit une valeur (« 33,4 tirs »).
 */
const un = x => x.toFixed(1).replace('.', ',');
const pc = x => `${un(x * 100)} %`;
const moy = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const partDeLigne = (test) => (fs, cote) => {
  const b = fs.flatMap(f => f.buts.filter(x => x.cote === cote));
  return b.length ? b.filter(x => test(x.ligne)).length / b.length : 0;
};
export const CHIFFRES = {
  essaim: { nom: 'Tirs', sens: 1, seuil: 3, valeur: (fs, c) => moy(fs.map(f => chiffresDuMatch(f, c).tirsPour)), mot: n => `${n} tirs de plus que la ligue par match`, dit: x => `${un(x)} tirs` },
  rapaces: {
    nom: 'Précision', sens: 1, seuil: 0.018,
    valeur: (fs, c) => { const t = fs.reduce((s, f) => s + chiffresDuMatch(f, c).tirsPour, 0); return t ? fs.reduce((s, f) => s + chiffresDuMatch(f, c).butsPour, 0) / t : 0; },
    mot: () => 'presque deux points de précision de plus que la ligue', dit: pc,
  },
  tortue: { nom: 'Tirs contre', sens: -1, seuil: 3, valeur: (fs, c) => moy(fs.map(f => chiffresDuMatch(f, c).tirsContre)), mot: n => `${n} tirs contre de moins que la ligue par match`, dit: x => `${un(x)} tirs contre` },
  // Les mises en échec que ton alignement donne, contre ce qu'il donnerait sans carte de robustesse : l'époque et le gabarit des clubs s'annulent.
  rhinos: {
    nom: 'Mises en échec', sens: 1, seuil: 0.08,
    valeur: (fs, c) => { const b = fs.reduce((t, f) => t + ((f.coupsBase && f.coupsBase[c]) || 0), 0); return b > 0 ? fs.reduce((t, f) => t + (f.coups[c] || 0), 0) / b : 1; },
    mot: () => 'huit pour cent de mises en échec de plus que ton alignement n\'en donne seul', dit: x => `${Math.round(x * 100)} % de ton alignement`,
  },
  // La part de glace de ton premier trio, lue de la feuille (les minutes que le moteur lui donne).
  etoiles: {
    nom: 'Glace du premier trio', sens: 1, seuil: 0.04,
    valeur: (fs, c) => moy(fs.map(f => (f.glacePremier && f.glacePremier[c]) || 0)),
    mot: () => 'quatre pour cent de la glace de plus pour ton premier trio que la ligue', dit: pc,
  },
  souffle: { nom: 'Blessures', sens: -1, seuil: 0.17, valeur: (fs, c) => moy(fs.map(f => (f.blessures || []).filter(b => b.cote === c).length)), mot: () => 'deux fois moins de blessures que la ligue', dit: x => `${un(x * 10)} par 10 matchs` },
  choeur: { nom: 'Punitions', sens: -1, seuil: 1, valeur: (fs, c) => moy(fs.map(f => chiffresDuMatch(f, c).punitions)), mot: n => `${n} punition de moins que la ligue par match`, dit: x => `${un(x)} punitions` },
  profondeur: { nom: 'Buts des 3e et 4e trios', sens: 1, seuil: 0.08, valeur: partDeLigne(l => l >= 3), mot: () => 'plus de buts du bas de l\'alignement que la ligue', dit: pc },
};

/* Un bloc de feuilles de ton club : sa stat (`moi`) et celle de la ligue sur les mêmes journées (`ref`, la moyenne de tous les autres côtés). */
function ecart(cle, bloc, ligue, cote) {
  const C = CHIFFRES[cle];
  const moi = C.valeur(bloc.map(m => m.f), cote(bloc, 0));
  const a = bloc[0].jour, b = bloc[bloc.length - 1].jour;
  const lignes = [];
  for (const m of ligue) if (m.jour >= a && m.jour <= b) lignes.push(C.valeur([m.f], 'A'), C.valeur([m.f], 'B'));
  return { moi, ref: moy(lignes) };
}
const tenu = (cle, e) => CHIFFRES[cle].sens * (e.moi - e.ref) >= CHIFFRES[cle].seuil;

/**
 * Les blocs tenus de ce coach, par les matchs de ton club joués de la journée `depuis` (son entrée en poste) à la journée
 * `avant` (exclue). `matchs` : les matchs joués du calendrier, à plat (`matchsJoues`, js/profil-style.js) ; `club` : ton
 * équipe. Un coach sans chiffre (le Comptable) n'en a pas. Rend `{ blocs, tenus, enCours, courant }` : combien de blocs
 * pleins, combien tenus, les matchs du bloc ouvert, et l'écart du bloc ouvert (le dernier plein s'il vient de finir).
 */
export function blocsTenus(cle, matchs, club, avant = Infinity, depuis = 0) {
  if (!CHIFFRES[cle]) return { blocs: 0, tenus: 0, enCours: null, courant: null };
  const miens = matchs.filter(m => m.jour < avant && m.jour >= depuis && (m.A === club || m.B === club));
  const cote = (bloc, i) => (bloc[i].A === club ? 'A' : 'B');
  const ligue = matchs.filter(m => m.jour < avant && m.A !== club && m.B !== club);
  const pleins = Math.floor(miens.length / BLOC);
  let tenus = 0;
  for (let k = 0; k < pleins; k++) if (tenu(cle, ecart(cle, miens.slice(k * BLOC, (k + 1) * BLOC), ligue, cote))) tenus++;
  const enCours = miens.length % BLOC;
  const ouvert = enCours ? miens.slice(-enCours) : miens.slice(-BLOC);
  return { blocs: pleins, tenus, enCours, courant: ouvert.length ? ecart(cle, ouvert, ligue, cote) : null };
}

/** Les points que le chiffre ajoute à la confiance : `POINTS_PAR_BLOC` par bloc tenu. */
export const pointsTenus = (cle, matchs, club, avant = Infinity, depuis = 0) => POINTS_PAR_BLOC * blocsTenus(cle, matchs, club, avant, depuis).tenus;

/* Le `tenus` de `buildDe` / `palierAllume` pour un calendrier et ton club : (coach, journée, entrée en poste) → points. */
export const tenusDe = (calendrier, you) => (cle, jusqua, depuis = 0) => (CHIFFRES[cle] ? pointsTenus(cle, feuillesJouees(calendrier), you, jusqua, depuis) : 0);

/*
 * Ce que l'écran du coach dit de son chiffre : `{ nom, but, tenus, enCours, moi, ligue, tient }` — `moi` et `ligue` écrits
 * (« 33,4 tirs »), sur le bloc ouvert ; ou null (pas de chiffre, pas de ligue).
 */
export function chiffreDit(cle, calendrier, you, avant = Infinity, depuis = 0) {
  const C = CHIFFRES[cle];
  if (!C || !calendrier) return null;
  const r = blocsTenus(cle, feuillesJouees(calendrier), you, avant, depuis);
  return { nom: C.nom, but: C.mot(C.seuil), tenus: r.tenus, enCours: r.enCours,
    ...(r.courant ? { moi: C.dit(r.courant.moi), ligue: C.dit(r.courant.ref), tient: tenu(cle, r.courant) } : {}) };
}
