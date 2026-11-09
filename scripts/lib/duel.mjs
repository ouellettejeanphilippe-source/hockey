/*
 * LES ROBOTS DU DUEL (V27, tranche 6 ; docs/refonte-v27-6a.md). Le duel est un seul choix avant le match : ton plan fort,
 * un parmi ceux que ton banc propose (`plansDuDuel`, js/impact.js), chiffrés contre leur jeu (`leurJeuDuDuel`,
 * js/greffes.js) — les mêmes fonctions que l'écran du choix (js/saison.js `leDuel`). `toi.robotDuel` (js/greffes.js,
 * `match`) l'appelle avant la 1re période quand aucune décision n'est prise.
 *   - 'attentif' : prend le plan qui rend le plus de buts nets sur le match, Ton match si aucun ne rend ;
 *   - 'distrait' : prend un plan au hasard, ou Ton match ;
 *   - 'rien' : Ton match.
 * Le hasard du distrait est le sien (`clic`) : il ne touche pas aux dés du moteur ; la lecture des plans non plus
 * (`avecHasardIsole`).
 */
import { plansDuDuel } from '../../js/impact.js';
import { avecHasardIsole } from '../../js/sim.js';
import '../../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

/* Les lancers que le robot lit par plan : moins que l'écran, assez pour classer trois plans. */
const LANCERS_LUS = Number(typeof process !== 'undefined' && process.env.LANCERS_LUS || 120);
export const lirePlans = ({ toi, adv, intention }) => avecHasardIsole('robot-duel', () => plansDuDuel(toi, adv, { intention, n: LANCERS_LUS }));
export function robotDuel(politique, clic = Math.random) {
  if (politique === 'rien') return () => ({ plan: null });
  if (politique === 'distrait') return x => {
    const plans = lirePlans(x), i = Math.floor(clic() * (plans.length + 1));
    return { plan: plans[i] ? plans[i].plan : null };
  };
  return x => {
    const best = lirePlans(x).sort((a, b) => b.net - a.net)[0];
    return { plan: best && best.net > 0 ? best.plan : null };
  };
}
