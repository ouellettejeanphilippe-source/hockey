/*
 * LES ROBOTS DU DUEL (V9, tranche 5 — docs/refonte-v9.md § 6.3 ; V17, docs/refonte-v17.md). Ce qu'un robot fait,
 * période par période, quand son adjoint propose ses plans (`propositionsDuDuel`, js/impact.js) : `toi.robotDuel`
 * (js/sim.js, `jouerDuel`) les appelle quand aucune décision n'est prise.
 *   - 'attentif' : prend la proposition qui rend le plus de buts nets sur la période, garde son plan si aucune ne rend ;
 *     double la mise quand il mène après deux périodes ;
 *   - 'distrait' : prend une proposition au hasard, ou garde ; double la mise au hasard ;
 *   - 'rien' : garde son plan, ne double jamais.
 * Le hasard du distrait est le sien (`clic`) : il ne touche pas aux dés du moteur ; la lecture de l'adjoint non plus
 * (`avecHasardIsole`).
 */
import { propositionsDuDuel } from '../../js/impact.js';
import { avecHasardIsole } from '../../js/sim.js';

/* Les lancers que le robot lit par proposition : moins que l'écran, assez pour classer trois plans. */
const LANCERS_LUS = Number(typeof process !== 'undefined' && process.env.LANCERS_LUS || 120);
const lirePropositions = ({ toi, adv, intention, plan, pointage, k }) => avecHasardIsole('robot-duel', () => propositionsDuDuel(toi, adv, { intention, plan, pointage, k, n: LANCERS_LUS }));
export function robotDuel(politique, clic = Math.random) {
  if (politique === 'rien') return () => ({});
  if (politique === 'distrait') return x => {
    const props = lirePropositions(x), i = Math.floor(clic() * (props.length + 1));
    return { ...(props[i] ? { plan: { cle: props[i].cle, ...(props[i].vise ? { vise: props[i].vise } : {}) } } : {}), snap: x.k === 2 && !x.serie && clic() < 0.5 };
  };
  return x => {
    const best = lirePropositions(x).sort((a, b) => b.net - a.net)[0];
    return { ...(best && best.net > 0 ? { plan: { cle: best.cle, ...(best.vise ? { vise: best.vise } : {}) } } : {}), snap: x.k === 2 && !x.serie && x.pointage.moi > x.pointage.lui };
  };
}
