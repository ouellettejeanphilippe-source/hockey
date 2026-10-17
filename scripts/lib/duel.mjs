/*
 * LES ROBOTS DU DUEL (V9, tranche 5 — docs/refonte-v9.md § 6.3). Ce qu'un robot fait, période par période, d'une
 * intention annoncée : `toi.robotDuel` (js/sim.js, `jouerDuel`) les appelle quand aucune décision n'est prise.
 *   - 'attentif' : répond à chaque intention par son geste ; sinon, par une carte qui y répond ; puis joue ce que
 *     l'adjoint jouerait du reste ; double la mise quand il mène après deux périodes ;
 *   - 'adjoint' : l'adjoint joue la main (`mainDeLAdjoint`) à chaque période, sans répondre aux intentions ;
 *   - 'distrait' : répond une fois sur deux, joue des cartes au hasard tant que l'élan suffit, double la mise au hasard ;
 * Le cahier neuf (V10) : une carte hors de son moment se garde (`dansSonMoment`) ; l'adjoint répond à ce qu'il voit
 * mais ne joue pas le coup de 3e (`pourLAdjoint`) ; l'attentif joue la réponse s'il faut, son coup de 3e, puis une réponse pour son effet ;
 * le distrait gaspille ce qu'il pige.
 *   - 'rien' : ni geste ni carte.
 * Le hasard du distrait est le sien (`clic`) : il ne touche pas aux dés du moteur.
 */
import { CARTES_MATCH, energieDepensee, mainDeLAdjoint } from '../../js/combat.js';
import { INTENTIONS, carteRepond } from '../../js/sim.js';

const jouable = c => CARTES_MATCH[c] && !CARTES_MATCH[c].injouable;

export function robotDuel(politique, clic = Math.random) {
  if (politique === 'rien') return () => ({});
  if (politique === 'adjoint') return ({ main, elan, pourLAdjoint }) => ({ cartes: mainDeLAdjoint(main, elan, pourLAdjoint).jouees });
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
  return ({ k, intention, reponses, main, elan, pointage, domicile, serie, dansSonMoment = () => true, pourLAdjoint }) => {
    const I = INTENTIONS[intention.cle];
    const geste = reponses[0] || null;
    // L'ombre au loin ne se défait qu'à moitié : une carte la défait toute.
    const gesteSuffit = geste && !(intention.cle === 'ombre' && !domicile);
    const cartes = [], reste = main.slice();
    const prendre = c => { if (c && energieDepensee([...cartes, c], elan) >= 0) { cartes.push(c); reste.splice(reste.indexOf(c), 1); } };
    const moinsCher = (a, b) => CARTES_MATCH[a].cout - CARTES_MATCH[b].cout;
    const repond = c => jouable(c) && carteRepond(I, c);
    if (!gesteSuffit) prendre(reste.filter(repond).sort(moinsCher)[0]);
    // Le coup de 3e, dans son moment ; puis une réponse jouée pour son effet, même quand le geste suffit.
    if (k === 2) for (const c of reste.filter(c => jouable(c) && CARTES_MATCH[c].si && !INTENTIONS[CARTES_MATCH[c].si] && dansSonMoment(c))) prendre(c);
    for (const c of reste.filter(c => repond(c) && CARTES_MATCH[c].si)) prendre(c);
    // Le reste : ce que l'adjoint jouerait.
    for (const c of mainDeLAdjoint(reste, elan, pourLAdjoint).jouees) prendre(c);
    const sauf = typeof process !== 'undefined' && process.env.SAUF;
    return { reponse: geste && sauf !== intention.cle ? geste.cle : null, cartes: sauf === intention.cle ? cartes.filter(c => !carteRepond(I, c)) : cartes, snap: k === 2 && !serie && pointage.moi > pointage.lui };
  };
}
