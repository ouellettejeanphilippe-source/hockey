/*
 * LES ROBOTS DU DUEL (V9, tranche 5 — docs/refonte-v9.md § 6.3). Ce qu'un robot fait, période par période, d'une
 * intention annoncée : `toi.robotDuel` (js/sim.js, `jouerDuel`) les appelle quand aucune décision n'est prise.
 * Sans main depuis la V13-2 (docs/refonte-v13.md) : le duel se joue à la glace.
 *   - 'attentif' : répond à chaque intention par son geste ; double la mise quand il mène après deux périodes ;
 *   - 'distrait' : répond une fois sur deux, double la mise au hasard ;
 *   - 'rien' : ne répond à rien, ne double jamais.
 * Le hasard du distrait est le sien (`clic`) : il ne touche pas aux dés du moteur.
 */
export function robotDuel(politique, clic = Math.random) {
  if (politique === 'rien') return () => ({});
  if (politique === 'distrait') return ({ k, reponses, serie }) => ({ reponse: reponses.length && clic() < 0.5 ? reponses[0].cle : null, snap: k === 2 && !serie && clic() < 0.5 });
  return ({ k, intention, reponses, pointage, serie }) => {
    const sauf = typeof process !== 'undefined' && process.env.SAUF;
    const geste = reponses[0] || null;
    return { reponse: geste && sauf !== intention.cle ? geste.cle : null, snap: k === 2 && !serie && pointage.moi > pointage.lui };
  };
}
