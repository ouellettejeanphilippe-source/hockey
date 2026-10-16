/*
 * LES ROBOTS DU DUEL (V9, tranche 5 — docs/refonte-v9.md § 6.3). Ce qu'un robot fait, période par période, d'une
 * intention annoncée : `toi.robotDuel` (js/sim.js, `jouerDuel`) les appelle quand aucune décision n'est prise.
 *   - 'attentif' : répond à chaque intention par son geste ; sinon, par une carte qui y répond ; puis joue ce que
 *     l'adjoint jouerait du reste ; double la mise quand il mène après deux périodes ;
 *   - 'adjoint' : l'adjoint joue la main (`mainDeLAdjoint`) à chaque période, sans répondre aux intentions ;
 *   - 'distrait' : répond une fois sur deux, joue des cartes au hasard tant que l'élan suffit, double la mise au hasard ;
 *   - 'rien' : ni geste ni carte.
 * Le hasard du distrait est le sien (`clic`) : il ne touche pas aux dés du moteur.
 */
import { CARTES_MATCH, energieDepensee, mainDeLAdjoint } from '../../js/combat.js';
import { INTENTIONS, carteRepond } from '../../js/sim.js';

const jouable = c => CARTES_MATCH[c] && !CARTES_MATCH[c].injouable;

export function robotDuel(politique, clic = Math.random) {
  if (politique === 'rien') return () => ({});
  if (politique === 'adjoint') return ({ main, elan }) => ({ cartes: mainDeLAdjoint(main, elan).jouees });
  if (politique === 'distrait') {
    return ({ k, reponses, main, elan, serie }) => {
      const cartes = [];
      for (const i of main.map((_, j) => j).sort(() => clic() - 0.5)) {
        const c = main[i];
        if (jouable(c) && energieDepensee([...cartes, c], elan) >= 0) cartes.push(c);
      }
      return { reponse: reponses.length && clic() < 0.5 ? reponses[0].cle : null, cartes, snap: k === 2 && !serie && clic() < 0.5 };
    };
  }
  return ({ k, intention, reponses, main, elan, pointage, domicile, serie }) => {
    const I = INTENTIONS[intention.cle];
    const geste = reponses[0] || null;
    // L'ombre au loin ne se défait qu'à moitié : une carte la défait toute.
    const gesteSuffit = geste && !(intention.cle === 'ombre' && !domicile);
    const cartes = [];
    if (!gesteSuffit) {
      const rep = main.filter(c => jouable(c) && carteRepond(I, c)).sort((a, b) => CARTES_MATCH[a].cout - CARTES_MATCH[b].cout)[0];
      if (rep && energieDepensee([rep], elan) >= 0) cartes.push(rep);
    }
    // Le reste : ce que l'adjoint jouerait.
    const reste = main.slice();
    for (const c of cartes) reste.splice(reste.indexOf(c), 1);
    for (const c of mainDeLAdjoint(reste, elan).jouees) if (energieDepensee([...cartes, c], elan) >= 0) cartes.push(c);
    const sauf = typeof process !== 'undefined' && process.env.SAUF;
    return { reponse: geste && sauf !== intention.cle ? geste.cle : null, cartes: sauf === intention.cle ? cartes.filter(c => !carteRepond(I, c)) : cartes, snap: k === 2 && !serie && pointage.moi > pointage.lui };
  };
}
