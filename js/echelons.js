/*
 * LES ÉCHELONS DU PERSONNEL (V14 — docs/refonte-v14.md). JP : *le personnel, des cartes qui gagnent des niveaux, avec
 * leurs forces et leurs faiblesses, un look de jeu de gestion* ; *adapter à nos besoins de jeu de gestion et de gacha*.
 *
 *   la CARTE       chaque poste a sa carte, nommée par son style (« le gardien du fort ») ;
 *   sa FORCE       les canaux de sa carte qui aident (`canalBon`, js/banque.js) ; sa FAIBLESSE, ceux qui coûtent ;
 *   les ÉCHELONS   1 à 3, achetés en jetons quand on veut (V20 : plus de matchs à ton service) ; à chaque échelon, tu
 *                  choisis : il pousse sa force (`POUSSEE`), ou il corrige son défaut (`CORRECTION`) ; un adjoint de la
 *                  couleur de ton coach joue un échelon plus haut (js/sim.js `assortiPour`) ;
 *   les DOUBLONS   le gacha : une carte tirée d'un pack de nouveau paie un échelon, d'une run à l'autre
 *                  (`echelonsGratuits`, js/rogue.js `recevoirPermanents`) ; ses échelons, eux, se regagnent à chaque run.
 *
 * Rien de neuf dans le moteur : une carte du personnel est une décision `patron` qui porte ses chiffres à son échelon ; monter
 * d'échelon, c'est une décision de plus, au jour dit, qui la remplace à son poste.
 */
import { PATRONS, patronsActifs, canalBon } from './banque.js';
import { PROTEGES, LIGNES_DU_FEU } from './personnel.js';
import { CANAUX_MUT, estMalus } from './sim.js';

export const ECHELON_MAX = 3;
/*
 * LE PRIX D'UN ÉCHELON, en jetons (V14b). JP : *au lieu de salaire, les cartes de base influencent le style de l'équipe
 * sans la rendre vraiment plus forte, et c'est cher upgrader*. Au premier échelon, une carte change la forme du match ;
 * la force, elle, s'achète, échelon par échelon, et chaque échelon coûte plus que le précédent.
 */
export const PRIX_ECHELON = [0, 0, 50, 100];
/* Pousser sa force grandit l'écart de ses bons canaux d'un quart ; corriger son défaut ramène ses mauvais de 40 %. */
export const POUSSEE = 0.25;
export const CORRECTION = 0.6;
/* V19 : un adjoint sert dès son premier échelon (JP : *l'adjoint utile dès le niveau 1*) — son défaut y est déjà à demi corrigé. */
export const CORRECTION_DE_DEPART = Math.sqrt(CORRECTION);
/*
 * V20 (docs/refonte-v20.md § 2) : plus de matchs à ton service ni d'échelons fermés — un échelon s'achète quand on veut.
 * Un DOUBLON tiré d'un pack paie un échelon : avec `copies` copies, ses `copies − 1` premiers échelons sont gratuits.
 */
export const echelonsGratuits = copies => Math.max(0, Math.min(ECHELON_MAX - 1, (copies || 1) - 1));

const grandir = (x, f) => 1 + (x - 1) * f;
const rond = v => Math.round(v * 1000) / 1000;

/*
 * SES CHIFFRES À SON ÉCHELON : la carte, ses bons canaux grandis par chaque poussée, ses mauvais ramenés par chaque
 * correction. `choix` : la suite de ses choix d'échelon ('force' ou 'defaut'). Un trio qui se répartit (`F`) est sa
 * force entière. L'argent (`econ`) grandit comme une force.
 */
export function effetALEchelon(cle, choix = []) {
  const P = PATRONS[cle];
  if (!P) return null;
  const nF = choix.filter(c => c === 'force').length, nD = choix.filter(c => c === 'defaut').length;
  const fF = 1 + POUSSEE * nF, fD = CORRECTION_DE_DEPART * CORRECTION ** nD;
  const out = {};
  for (const [k, v] of Object.entries(P.effet || {})) {
    if (Array.isArray(v)) out[k] = v.map(x => rond(grandir(x, fF)));
    else if (typeof v === 'number') {
      const f = canalBon(k, v) ? fF : fD;
      out[k] = rond(k === 'robustesse' ? v * f : grandir(v, f));
    }
  }
  if (P.econ) out.econ = Object.fromEntries(Object.entries(P.econ).map(([k, v]) => [k, k === 'rabais' ? rond(1 - (1 - v) * fF)
    : k === 'plafond' ? rond(v * fF) : Math.round(v * fF)]));
  return out;
}
/*
 * SON PROTÉGÉ À SON ÉCHELON (V16) : les canaux de joueur d'un adjoint à protégé grandissent comme sa force et se
 * ramènent comme son défaut ; la décision d'échelon les porte (`canaux`), et le moteur repose la mutation avec eux.
 */
export function protegeALEchelon(cle, choix = []) {
  const M = PROTEGES[cle];
  if (!M) return null;
  const nF = choix.filter(c => c === 'force').length, nD = choix.filter(c => c === 'defaut').length;
  const fF = 1 + POUSSEE * nF, fD = CORRECTION ** nD;
  return Object.fromEntries(CANAUX_MUT.filter(c => M[c]).map(c => [c, rond(grandir(M[c], estMalus(c, M[c]) ? fD : fF))]));
}
/* Le feu d'un adjoint (`portee`) prend sa deuxième ligne à son troisième échelon : deux poussées de sa force (`LIGNES_DU_FEU`). */
export const lignesDuFeu = (cle, choix = []) => (PROTEGES[cle] && PROTEGES[cle].portee ? (choix.filter(c => c === 'force').length >= LIGNES_DU_FEU.poussees ? 2 : 1) : null);
/* La force et la faiblesse, séparées : ce que la fiche dit en vert et en rouge. */
function forceEtFaiblesse(effet) {
  const force = {}, faiblesse = {};
  for (const [k, v] of Object.entries(effet || {})) {
    if (k === 'econ' || Array.isArray(v)) force[k] = v;
    else if (typeof v === 'number') (canalBon(k, v) ? force : faiblesse)[k] = v;
  }
  return { force, faiblesse };
}
/* A-t-elle un défaut à corriger ? Une carte d'argent n'en a pas : elle ne fait que pousser. */
export const aUnDefaut = cle => Object.keys(forceEtFaiblesse(effetALEchelon(cle)).faiblesse).length > 0;

/* LA DÉCISION D'UNE PERSONNE à un échelon : le patron, ses chiffres, son échelon et ses choix. */
export function patronALEchelon(cle, { choix = [] } = {}) {
  const P = PATRONS[cle];
  if (!P) return null;
  const { econ, ...canaux } = effetALEchelon(cle, choix);
  return { cle, role: P.role, nom: P.nom, ico: P.ico, ...canaux, ...(econ ? { econ } : {}), ...(P.si ? { si: P.si } : {}),
    echelon: 1 + choix.length, choix: [...choix] };
}

/* Les matchs que ton club a joués entre deux journées (la première comprise), lus au calendrier. */
export function matchsJoues(calendrier = [], you, de = 0, a = Infinity) {
  let n = 0;
  for (let j = Math.max(0, de); j < Math.min(calendrier.length, a); j++)
    for (const m of calendrier[j] || []) if ((m.A === you || m.B === you) && Number.isFinite(m.gfA)) n++;
  return n;
}
/*
 * TON PERSONNEL À UNE JOURNÉE, pur, pour l'écran et les robots : chaque carte en poste, son échelon, le prix du suivant
 * (rien si un doublon le paie : `gratuit`) et s'il en reste un à prendre (`aChoisir`).
 *   decisions, jusqua   la saison ; copies(cle) : ses copies au méta
 */
export function etatDuPersonnel(decisions = [], jusqua = Infinity, { copies = () => 1 } = {}) {
  return patronsActifs(decisions, jusqua).filter(p => PATRONS[p.cle]).map(p => {
    const echelon = p.echelon || 1, gratuit = echelon - 1 < echelonsGratuits(copies(p.cle));
    return { cle: p.cle, qui: PATRONS[p.cle].nom, patron: p, echelon, gratuit, prix: gratuit ? 0 : PRIX_ECHELON[echelon + 1] || 0, aChoisir: echelon < ECHELON_MAX };
  });
}
/* Le choix d'un échelon : la décision qui remplace la carte, un échelon plus haut, et son prix (un gain négatif, que la caisse lit). */
export function decisionDEchelon(e, choix) {
  const tous = [...(e.patron.choix || []), choix];
  return { patron: patronALEchelon(e.cle, { choix: tous }),
    ...(PROTEGES[e.cle] ? { mutation: { cle: e.cle, saison: true, canaux: protegeALEchelon(e.cle, tous), ...(lignesDuFeu(e.cle, tous) ? { lignes: lignesDuFeu(e.cle, tous) } : {}) } } : {}), ...(e.prix ? { gain: -e.prix } : {}) };
}
/* La fin d'une saison : la carte passe à la suivante avec son échelon et ses choix. */
export const reportDuPersonnel = e => patronALEchelon(e.cle, { choix: e.patron.choix || [] });
