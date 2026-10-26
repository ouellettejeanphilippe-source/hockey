/*
 * LES ÉCHELONS DU PERSONNEL (V14 — docs/refonte-v14.md). JP : *le personnel, des cartes qui gagnent des niveaux, avec
 * leurs forces et leurs faiblesses, un look de jeu de gestion* ; *adapter à nos besoins de jeu de gestion et de gacha*.
 *
 *   la CARTE       chaque poste a sa carte, nommée par son style (« le gardien du fort ») ;
 *   sa FORCE       les canaux de sa carte qui aident (`canalBon`, js/banque.js) ; sa FAIBLESSE, ceux qui coûtent ;
 *   les ÉCHELONS   1 à 5, gagnés en MATCHS À TON SERVICE (`MATCHS_ECHELON`), deux fois plus vite pour quelqu'un de la
 *                  couleur de ton coach ; à chaque échelon, tu choisis : il pousse sa force (`POUSSEE`), ou il corrige
 *                  son défaut (`CORRECTION`) ;
 *   les DOUBLONS   le gacha : une carte tirée d'un pack de nouveau ouvre un échelon de plus, d'une run à l'autre
 *                  (`ouvertsDe`, js/rogue.js `recevoirPermanents`) ; ses échelons, eux, se regagnent à chaque run.
 *
 * Rien de neuf dans le moteur : une carte du personnel est une décision `patron` qui porte ses chiffres à son échelon ; monter
 * d'échelon, c'est une décision de plus, au jour dit, qui la remplace à son poste.
 */
import { PATRONS, BANQUE, patronsActifs, coachsActifs, canalBon } from './banque.js';
import { PROTEGES, LIGNES_DU_FEU } from './personnel.js';
import { CANAUX_MUT, estMalus } from './sim.js';

export const ECHELON_MAX = 5;
/* Les matchs à ton service pour atteindre un échelon (l'indice) : le 2e à 10, le 5e à 70. */
export const MATCHS_ECHELON = [0, 0, 10, 25, 45, 70];
/*
 * LE PRIX D'UN ÉCHELON, en jetons (V14b). JP : *au lieu de salaire, les cartes de base influencent le style de l'équipe
 * sans la rendre vraiment plus forte, et c'est cher upgrader*. Au premier échelon, une carte change la forme du match ;
 * la force, elle, s'achète, échelon par échelon, et chaque échelon coûte plus que le précédent.
 */
export const PRIX_ECHELON = [0, 0, 30, 50, 80, 120];
/* Pousser sa force grandit l'écart de ses bons canaux d'un quart ; corriger son défaut ramène ses mauvais de 40 %. */
export const POUSSEE = 0.25;
export const CORRECTION = 0.6;
/* Les échelons ouverts : deux avec la première copie, un de plus par doublon, cinq au plus. */
export const ouvertsDe = copies => Math.min(ECHELON_MAX, 1 + Math.max(1, copies || 1));

const grandir = (x, f) => 1 + (x - 1) * f;
const rond = v => Math.round(v * 1000) / 1000;
/* La couleur d'une carte du personnel : le coach de sa carte, ou null (neutre). */
const couleurDe = cle => (BANQUE[`patron:${cle}`] || {}).coach || null;

/*
 * SES CHIFFRES À SON ÉCHELON : la carte, ses bons canaux grandis par chaque poussée, ses mauvais ramenés par chaque
 * correction. `choix` : la suite de ses choix d'échelon ('force' ou 'defaut'). Un trio qui se répartit (`F`) est sa
 * force entière. L'argent (`econ`) grandit comme une force.
 */
export function effetALEchelon(cle, choix = []) {
  const P = PATRONS[cle];
  if (!P) return null;
  const nF = choix.filter(c => c === 'force').length, nD = choix.filter(c => c === 'defaut').length;
  const fF = 1 + POUSSEE * nF, fD = CORRECTION ** nD;
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

/*
 * LA DÉCISION D'UNE PERSONNE à un échelon : le patron, ses chiffres, et d'où se comptent ses matchs à ton service
 * (`depuis` : le jour où elle est arrivée cette saison, son jour d'engagement s'il manque ; `avant` : ses matchs des
 * saisons d'avant de la run).
 */
export function patronALEchelon(cle, { choix = [], depuis, avant = 0 } = {}) {
  const P = PATRONS[cle];
  if (!P) return null;
  const { econ, ...canaux } = effetALEchelon(cle, choix);
  return { cle, role: P.role, nom: P.nom, ico: P.ico, ...canaux, ...(econ ? { econ } : {}), ...(P.si ? { si: P.si } : {}),
    echelon: 1 + choix.length, choix: [...choix], ...(depuis !== undefined ? { depuis } : {}), avant };
}

/* Les matchs que ton club a joués entre deux journées (la première comprise), lus au calendrier. */
export function matchsJoues(calendrier = [], you, de = 0, a = Infinity) {
  let n = 0;
  for (let j = Math.max(0, de); j < Math.min(calendrier.length, a); j++)
    for (const m of calendrier[j] || []) if ((m.A === you || m.B === you) && Number.isFinite(m.gfA)) n++;
  return n;
}
/*
 * TON PERSONNEL À UNE JOURNÉE, pur, pour l'écran, À faire et les robots : chaque carte en poste, ses matchs à ton
 * service (doublés à la couleur du coach en poste), son échelon, l'échelon qu'elle a atteint, et ce qui attend un choix.
 *   decisions, jusqua   la saison ; joues(de, a) : les matchs joués entre deux journées ; copies(cle) : au méta
 */
export function etatDuPersonnel(decisions = [], jusqua = Infinity, { joues = () => 0, copies = () => 1 } = {}) {
  const [C] = coachsActifs(decisions, jusqua);
  return patronsActifs(decisions, jusqua).filter(p => PATRONS[p.cle]).map(p => {
    const double = !!(C && couleurDe(p.cle) === C.cle);
    const depuis = p.depuis ?? p.jour ?? 0;
    const service = (p.avant || 0) + joues(depuis, jusqua) * (double ? 2 : 1);
    const echelon = p.echelon || 1, ouverts = ouvertsDe(copies(p.cle));
    const atteint = Math.min(ouverts, MATCHS_ECHELON.reduce((e, m, i) => (i >= 1 && service >= m ? i : e), 1));
    const prochain = echelon < ECHELON_MAX ? MATCHS_ECHELON[echelon + 1] : null;
    return { cle: p.cle, qui: PATRONS[p.cle].nom, patron: p, echelon, ouverts, service, double, prochain, depuis, prix: PRIX_ECHELON[echelon + 1] || 0,
      aChoisir: atteint > echelon, ferme: prochain !== null && service >= prochain && echelon >= ouverts };
  });
}
/* Le choix d'un échelon : la décision qui remplace la carte, un échelon plus haut, et son prix (un gain négatif, que la caisse lit). */
export function decisionDEchelon(e, choix) {
  const p = e.patron, prix = PRIX_ECHELON[e.echelon + 1] || 0, tous = [...(p.choix || []), choix];
  return { patron: patronALEchelon(e.cle, { choix: tous, depuis: e.depuis, avant: p.avant || 0 }),
    ...(PROTEGES[e.cle] ? { mutation: { cle: e.cle, saison: true, canaux: protegeALEchelon(e.cle, tous), ...(lignesDuFeu(e.cle, tous) ? { lignes: lignesDuFeu(e.cle, tous) } : {}) } } : {}), ...(prix ? { gain: -prix } : {}) };
}
/* La fin d'une saison : la carte passe à la suivante avec ses matchs à ton service, qui repartent de là. */
export const reportDuPersonnel = e => ({ ...e.patron, depuis: 0, avant: e.service });
