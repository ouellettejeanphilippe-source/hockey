/**
 * LA MASSE SALARIALE D'UNE VIEILLE PARTIE (S79). Ce module était la banque de cartes de l'ancien Rogue (les retouches de
 * l'atelier, les soins, l'échange d'un doublon) : la run en carte n'en tire aucune, on y monte une carte au vestiaire de la
 * carte ; le registre est parti à la V28, tranche 5. Reste `plafondDe` : une partie d'avant qui porte des décisions de
 * plafond (un espace gagné, une retenue, un rachat) se rejoue avec elles.
 */

/*
 * LE PLAFOND EFFECTIF À UNE JOURNÉE, pur : la base, l'espace gagné, la taxe,
 * et le « cap hit » de chaque joueur (sa retenue, son
 * rachat, son contrat d'entrée, ses bonis ; zéro s'il est au LTIR et blessé
 * ce jour-là). `blesses` : l'ensemble des clés à l'infirmerie à cette journée.
 * Rend { cap, lignes [{ nom, montant }], facteurs Map(clé → facteur), ltir Set }.
 */
export function plafondDe(decisions = [], jusqua = Infinity, { base = 0 } = {}) {
  const lignes = [];
  let cap = base;
  const facteurs = new Map(), ltir = new Set(), ecole = new Set();
  for (const d of [...decisions].filter(Boolean).sort((a, b) => (a.jour || 0) - (b.jour || 0))) {
    if ((d.jour || 0) >= jusqua) continue;
    // Le rappel du club-école (une vieille décision `ballottage.ecole`) ne compte pas au plafond.
    if (d.ballottage && d.ballottage.ecole && d.ballottage.entre) ecole.add(d.ballottage.entre);
    const p = d.plafond;
    if (p) {
      if (p.espace) { cap += p.espace; lignes.push({ nom: p.nom || 'Espace', montant: p.espace }); }
      if (p.joueur && p.facteur) facteurs.set(p.joueur, (facteurs.get(p.joueur) || 1) * p.facteur);
      if (p.joueur && p.ltir) ltir.add(p.joueur);
    }
  }
  return { cap, lignes, facteurs, ltir, ecole };
}
