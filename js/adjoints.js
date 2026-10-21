/*
 * LES ADJOINTS DU COACH (V13-3, docs/refonte-v13.md). JP, 20 oct. : *chaque coach devrait avoir des assistants coachs
 * activables, avec effet et upgrades possibles*. Les deux postes du personnel de la couleur d'un coach (js/personnel.js)
 * sont son BANC : ils viennent avec lui, ne sortent plus des packs, et ne travaillent que tant qu'il est en poste.
 *
 *   les CHAISES   la confiance du coach en poste en ouvre une à I, deux à II (`chaisesDe`) ;
 *   ACTIVER       un adjoint s'assoit sur une chaise libre, gratuitement, et joue son moment (`si`) dès le prochain soir ;
 *   les ÉCHELONS  un adjoint actif monte d'un échelon, trois au plus, en jetons (`ECHELONS`) : chaque échelon grandit
 *                 l'écart de son effet (`grandirEffet`), sur ses canaux à lui.
 *
 * Rien de neuf dans le moteur : un adjoint actif est une décision `patron` (js/banque.js `payloadDe`), qui porte ses
 * chiffres et son coach (`adjointDe`) ; le moteur ne le joue que les soirs de son moment, son coach en poste
 * (`joueCeSoir`, js/sim.js). Son rôle lui est propre (`adj:<clé>`) : il ne prend la place d'aucun autre patron.
 */
import { PERSONNEL } from './personnel.js';
import { BANQUE, patronsActifs, coachsActifs } from './banque.js';
import { grandirEffet } from './sim.js';

/* Un échelon : ce que l'écart de son effet vaut (`f`, ×1 au premier) et ce qu'il coûte pour y monter, en jetons. */
export const ECHELONS = [null, { f: 1, prix: 0 }, { f: 1.5, prix: 25 }, { f: 2, prix: 50 }];
const ECHELON_MAX = ECHELONS.length - 1;
/* Les chaises que la confiance ouvre : une à I, deux à II et à III. */
const chaisesDe = palier => Math.min(2, Math.max(0, palier || 0));

/* Le banc d'un coach : les postes du personnel de sa couleur (js/banque.js les marque `adjoint`). */
const banqueDuCoach = coach => Object.values(BANQUE).filter(c => c.cat === 'patron' && c.adjoint && c.adjoint === coach).map(c => c.cle);
/* Le coach en poste à une journée, ou null. */
const coachEnPoste = (decisions = [], jusqua = Infinity) => coachsActifs(decisions, jusqua)[0] || null;
/* Les adjoints actifs d'un coach à une journée, avec leur échelon. */
const adjointsActifs = (decisions = [], coach, jusqua = Infinity) => patronsActifs(decisions, jusqua).filter(p => p.adjointDe && p.adjointDe === coach);

/* L'effet d'un adjoint à son échelon : l'écart de ses canaux grandi ; son argent (le Comptable) monte pareil. */
export function effetDeLAdjoint(cle, echelon = 1) {
  const P = PERSONNEL[cle], E = ECHELONS[echelon] || ECHELONS[1];
  if (!P) return null;
  const econ = P.econ ? Object.fromEntries(Object.entries(P.econ).map(([k, v]) => [k, k === 'rabais' ? Math.round((1 - (1 - v) * E.f) * 1000) / 1000 : Math.round(v * E.f * 10) / 10])) : null;
  const rond = v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(rond) : v);
  const effet = P.effet ? Object.fromEntries(Object.entries(grandirEffet(P.effet, E.f)).map(([k, v]) => [k, rond(v)])) : {};
  return { ...effet, ...(econ ? { econ } : {}) };
}
/*
 * LA DÉCISION D'UN ADJOINT : l'activer (échelon 1, gratuit) ou le monter d'un échelon (son prix, un gain négatif, que la
 * caisse lit comme les autres : js/rogue-jeu.js `jetonsRogue`). Le moteur remplace l'adjoint du même nom : son échelon suit.
 */
export function decisionDAdjoint(cle, coach, echelon = 1) {
  const P = PERSONNEL[cle];
  if (!P || !ECHELONS[echelon]) return null;
  const { econ, ...canaux } = effetDeLAdjoint(cle, echelon);
  return {
    patron: { cle, role: `adj:${cle}`, nom: P.nom, ico: P.ico, ...canaux, ...(econ ? { econ } : {}), ...(P.si ? { si: P.si } : {}), adjointDe: coach, echelon },
    ...(ECHELONS[echelon].prix ? { gain: -ECHELONS[echelon].prix } : {}),
  };
}
/*
 * LE BANC À UNE JOURNÉE, pur, pour l'écran et les robots : le coach en poste, ses chaises, et chaque adjoint — actif ou
 * non, son échelon, ce qu'activer ou monter coûte, et ce qui l'empêche.
 */
export function etatDuBanc(decisions = [], jusqua = Infinity, caisse = Infinity) {
  const C = coachEnPoste(decisions, jusqua);
  if (!C) return null;
  const actifs = adjointsActifs(decisions, C.cle, jusqua), chaises = chaisesDe(C.palier);
  const adjoints = banqueDuCoach(C.cle).map(cle => {
    const a = actifs.find(x => x.cle === cle), echelon = a ? a.echelon || 1 : 0;
    const prochain = echelon + 1 <= ECHELON_MAX ? ECHELONS[echelon + 1] : null;
    const non = !a ? (actifs.length >= chaises ? 'Chaises prises' : '')
      : !prochain ? 'Au dernier échelon' : prochain.prix > caisse ? 'Pas assez de jetons en caisse' : '';
    return { cle, actif: !!a, echelon, prix: a && prochain ? prochain.prix : 0, non };
  });
  return { coach: C.cle, palier: C.palier, chaises, actifs: actifs.length, adjoints };
}
