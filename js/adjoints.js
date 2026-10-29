/*
 * LES ADJOINTS, DES SYSTÈMES DE JEU (V21 ; JP : *les assistants sont des ajustements, des systèmes de jeu* ; *genre deux
 * tirs de plus, mais en alloue deux de plus, ou tu buffs légèrement le gardien numéro un mais un nerf le numéro deux ou
 * l'inverse*). Un adjoint est un ÉCHANGE : ce que ton club gagne et ce qu'il donne, sur les canaux que le moteur connaît,
 * tous les matchs. Il change la forme du match, pas sa force : sur un club ordinaire, le net est près de zéro ; sur le
 * tien, il paie si l'échange lui va (des tireurs, un gardien n° 1 solide, une profondeur). `check_pouvoirs` le mesure.
 *
 *   effet    sur ton club (`volume`, `finition`, `defense`, `discipline`, `blessure`, `robustesse`, `F` : la glace des trios)
 *   adv      sur l'adversaire, le temps du match
 *   gardiens les buts accordés de ton gardien n° 1 (la première case du filet) et de ton n° 2, le soir où il joue :
 *            un multiplicateur (0,95 = 5 % de moins), que le moteur pose sur son canal `arrets`, sous `GAIN_GARDIEN_MAX`.
 *            Le n° 1 part environ trois soirs sur quatre : un échange de gardiens s'équilibre à 3 contre 1.
 *
 * Pur : le moteur (js/sim.js `poserLesAdjoints`) et l'écran lisent la même table. Trois au plus en poste (`ADJOINTS_MAX`) ;
 * un parmi trois, gratuit, aux moments forts (`adjointsOfferts`).
 */
import { hache } from './util.js';

export const ADJOINTS_MAX = 3;
export const ADJOINTS = {
  canonnier: { ico: '🏹', nom: 'Le canonnier', effet: { volume: 1.08 }, adv: { volume: 1.1 } },
  trappeur: { ico: '🚧', nom: 'Le trappeur', effet: { volume: 0.92 }, adv: { volume: 0.92 } },
  tireur: { ico: '📐', nom: 'Le tireur d\'élite', effet: { finition: 1.13, volume: 0.9 } },
  mitrailleur: { ico: '💨', nom: 'Le mitrailleur', effet: { volume: 1.13, finition: 0.91 } },
  mur: { ico: '🧱', nom: 'Le bâtisseur de mur', effet: { defense: 0.92, finition: 0.92 } },
  numeroUn: { ico: '🧤', nom: 'L\'entraîneur du n° 1', gardiens: { partant: 0.9, aux: 1.3 } },
  numeroDeux: { ico: '🧊', nom: 'L\'entraîneur du n° 2', gardiens: { partant: 1.04, aux: 0.88 } },
  cogneur: { ico: '🏋', nom: 'Le préparateur physique', effet: { robustesse: 2, discipline: 1.25 } },
  prof: { ico: '🧭', nom: 'Le prof de discipline', effet: { discipline: 0.75, robustesse: -1 } },
  rouleur: { ico: '🧲', nom: 'Le rouleur', effet: { F: [0.78, 0.9, 1.15, 1.35] }, adv: { volume: 0.9 } },
  vedettiste: { ico: '📊', nom: 'Le vedettiste', effet: { F: [1.2, 1.05, 0.92, 0.8] }, adv: { volume: 1.08 } },
  soigneur: { ico: '🧪', nom: 'Le soigneur', effet: { blessure: 0.7, volume: 0.98 } },
};

/* Un canal, en mots, de ton côté : ce qu'il dit et s'il aide (`bon`). */
const pct = v => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)} %`;
const MOTS = {
  volume: v => ({ txt: `Tes tirs ${pct(v)}`, bon: v > 1 }),
  finition: v => ({ txt: `Ta précision ${pct(v)}`, bon: v > 1 }),
  defense: v => ({ txt: `Buts contre ${pct(v)}`, bon: v < 1 }),
  discipline: v => ({ txt: `Tes punitions ${pct(v)}`, bon: v < 1 }),
  blessure: v => ({ txt: `Tes blessures ${pct(v)}`, bon: v < 1 }),
  robustesse: v => ({ txt: `${v > 0 ? 'Plus' : 'Moins'} de mises en échec`, bon: v > 0 }),
};
/*
 * CE QU'UN ADJOINT DIT : son gain d'abord, puis son prix, chacun une ligne en vraies stats. La glace des trios se dit
 * en mots (le haut ou le bas de l'alignement joue plus) ; les gardiens, par leur rang.
 */
export function lignesDeLAdjoint(cle) {
  const A = ADJOINTS[cle];
  if (!A) return [];
  const out = [];
  for (const [k, v] of Object.entries(A.effet || {})) {
    if (k === 'F') {
      const haut = v[0] > 1;
      out.push({ txt: haut ? 'Ton 1er trio joue plus' : 'Tes 3e et 4e trios jouent plus', bon: true }, { txt: haut ? 'Le bas de l\'alignement joue moins' : 'Ton 1er trio joue moins', bon: false });
    } else if (MOTS[k]) out.push(MOTS[k](v));
  }
  for (const [k, v] of Object.entries(A.adv || {})) if (k === 'volume') out.push({ txt: `Leurs tirs ${pct(v)}`, bon: v < 1 });
  const g = A.gardiens;
  if (g) out.push({ txt: `Ton gardien n° 1 : buts accordés ${pct(g.partant)}`, bon: g.partant < 1 }, { txt: `Ton gardien n° 2 : buts accordés ${pct(g.aux)}`, bon: g.aux < 1 });
  return [...out.filter(x => x.bon), ...out.filter(x => !x.bon)];
}

/*
 * LES ADJOINTS OFFERTS (un parmi trois, gratuits, aux moments forts) : tirés de la graine parmi ceux qui ne sont pas
 * déjà en poste. `cle` : le moment fort (le palier, le butin, l'histoire) ; deux moments n'offrent pas les mêmes.
 */
export function adjointsOfferts(enPoste, graine, cle, n = 3) {
  const pris = new Set(enPoste || []);
  return Object.keys(ADJOINTS).filter(k => !pris.has(k))
    .sort((a, b) => hache(String(graine), 'adjoint', cle, a) - hache(String(graine), 'adjoint', cle, b)).slice(0, n);
}
/*
 * Prendre un adjoint : il entre, le dernier. Un staff de plus de `ADJOINTS_MAX` attend qu'on dise qui part (À faire, « Qui
 * part ? », une décision `perdAdjoint`) ; d'ici là, les `ADJOINTS_MAX` derniers entrés jouent (`adjointsQuiJouent`).
 */
export const avecAdjoint = (enPoste, cle) => [...(enPoste || []).filter(k => k !== cle), ...(ADJOINTS[cle] ? [cle] : [])];
export const adjointsQuiJouent = enPoste => (enPoste || []).filter(k => ADJOINTS[k]).slice(-ADJOINTS_MAX);
