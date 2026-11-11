/*
 * CE QUE LA RUN LIT D'UN ACTE ET D'UN CLUB (V27, tranches 2, 6 et 7 ; gardé par la V28, docs/refonte-v28.md § 8b). La run en
 * carte (js/run.js) joue des matchs isolés : la saison de 82 matchs coupée en actes, ses rivaux posés dans la cédule, le
 * calendrier placé et la boutique à ses nœuds sont partis (V28, tranche 4). Restent, purs :
 *   - les médailles d'un acte et le prix d'une pièce de banc ;
 *   - la récompense d'une élite, fixée sur ta vraie chance, et ce qu'elle coûte perdue (JP, 9 nov. 2026 : *Sonnés + jetons,
 *     pas de cœur*) ;
 *   - le jeu d'un club lu dans ses vraies stats, les lignes où il est fort, et son intention dominante.
 * Le moteur n'importe pas ce module (check_couches).
 */
import { activeLineup } from './sim.js';
import { hache } from './util.js';

/* Les médailles d'un acte : l'acte passé, le rival battu. */
export const MEDAILLES_ACTE = { passe: 10, rival: 15 };
/* Une pièce de banc, au marché. */
export const PRIX_PIECE = 32;

/*
 * L'ÉLITE (V27, tranche 7 ; JP, 8 nov. 2026 : « Élite = risque plus clair »). Sa récompense se fixe sur ta vraie chance :
 * `J = arrondi(VALEUR_DU_RISQUE × (1 − p) / p) − PRIX_PIECE`, bornée à [10, 90], `p` bornée à [0,25, 0,55]. Gagnée, une pièce
 * parmi trois et `J` jetons ; perdue, les sonnés et `PART_PERDUE` de `J` en jetons, sans descendre la caisse sous zéro.
 */
export const VALEUR_DU_RISQUE = 90, PART_PERDUE = 0.5;
export const recompenseDeLElite = chance => { const p = Math.min(0.55, Math.max(0.25, chance)); return Math.min(90, Math.max(10, Math.round((VALEUR_DU_RISQUE * (1 - p)) / p) - PRIX_PIECE)); };
/* Ce qu'une élite perdue coûte en jetons : la moitié de sa récompense, arrondie (J = 58 → 29). */
export const perteDeLElite = J => Math.round((J || 0) * PART_PERDUE);

/*
 * LE JEU D'UN CLUB (V27, tranche 6 : lu dans ses vraies stats, plus dans sa force). Trois lignes, chacune le rang du club
 * parmi `teams` (de 1) et le tien à côté, sur les joueurs qu'il habille ce soir-là, dans leur vraie saison :
 *   TIRS     ses tirs par match (la somme des tirs par match de ses patineurs) ;
 *   DURS     ses mises en échec et ses punitions par match (les mises en échec ne se comptent que depuis 2005-06 : une ligue
 *            sans elles se lit sur les punitions seules) ;
 *   GARDIEN  le % d'arrêts de son gardien partant.
 * Son style, en un mot, est sa ligne au meilleur rang : des tireurs, des durs, un gros gardien. `lui`, `toi` : la part de la
 * barre (0,05 à 1, du dernier club au premier).
 */
const parMatch = (p, v) => (p && p.gp ? (v || 0) / p.gp : 0);
const patineurs = t => Object.values(activeLineup(t)).filter(p => p && p.p !== 'G');
const LIGNES_DU_JEU = [
  { k: 'tirs', mot: 'des tireurs', nom: 'Tirs', lire: t => patineurs(t).reduce((a, p) => a + parMatch(p, p.sh), 0) },
  { k: 'durs', mot: 'des durs', nom: 'Durs', lire: (t, coups) => patineurs(t).reduce((a, p) => a + (coups ? p.ht || 0 : 0) + parMatch(p, p.pim) / (coups ? 2 : 1), 0) },
  { k: 'gardien', mot: 'un gros gardien', nom: 'Gardien', lire: t => { const g = Object.values(activeLineup(t)).filter(p => p && p.p === 'G').sort((a, b) => (b.gp || 0) - (a.gp || 0))[0]; return g ? g.sv || 0 : 0; } },
];
export function jeuDuRival(teams, you, adv) {
  const coups = teams.every(t => patineurs(t).some(p => p.ht != null));
  const lignes = LIGNES_DU_JEU.map(({ k, mot, nom, lire }) => {
    const v = new Map(teams.map(t => [t, lire(t, coups)]));
    const tri = teams.slice().sort((a, b) => v.get(b) - v.get(a));
    const max = v.get(tri[0]), min = v.get(tri[tri.length - 1]), part = t => Math.max(0.05, Math.min(1, (v.get(t) - min) / ((max - min) || 1)));
    return { k, mot, nom, rang: tri.indexOf(adv) + 1, rangToi: tri.indexOf(you) + 1, lui: part(adv), toi: part(you) };
  });
  const fort = lignes.slice().sort((a, b) => a.rang - b.rang)[0];
  return { cle: fort.k, mot: fort.mot, lignes };
}
/* LES LIGNES OÙ UN CLUB EST FORT (tranche 7) : au 12e rang sur 32 ou mieux, ramené à `n` clubs ; ce que lit une pièce « pour le battre ». */
const TOP_DU_JEU = 12;
export const lignesFortes = (jeu, n) => jeu.lignes.filter(l => l.rang <= Math.round((TOP_DU_JEU * n) / 32)).map(l => l.k);
/*
 * SON INTENTION DOMINANTE : celle des cinq qu'il annoncera le plus souvent (`POIDS_DOMINANTE`, js/greffes.js), fixée par son
 * style et la graine — des tireurs foncent (l'assaut) ou collent ta vedette pour la contrer (l'ombre) ; des durs chassent ou
 * te poussent au cachot ; un gros gardien ferme le centre ou colle ta vedette.
 */
const DOMINANTES = { tirs: ['assaut', 'ombre'], durs: ['chasse', 'cachot'], gardien: ['centre', 'ombre'] };
export const dominanteDe = (jeu, graine, acte, adv) => DOMINANTES[jeu.cle][hache(graine, 'dominante', acte, adv.tag) < 0.5 ? 0 : 1];
