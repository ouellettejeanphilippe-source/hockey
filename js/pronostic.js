/**
 * LE PRONOSTIC (S78) : ce que le MOTEUR pense d'un match avant qu'on le
 * regarde. JP : *avant match, mettre forces comparatives … avec chances de
 * victoire … basé dans les vraies probabilités et équipes, pas inventés*.
 *
 * RIEN N'EST INVENTÉ ICI : on rejoue le match des dizaines de fois avec le
 * vrai moteur (`playGame`), sur les deux vrais clubs tels qu'ils sont ce
 * soir — leurs blessés, leurs jambes — et on compte. La chance de victoire
 * est une fréquence de ces matchs-là, rien d'autre.
 *
 * CE QUI N'Y ENTRE PAS, exprès : la chance de saison de chaque club
 * (`luck`, un dé caché — la montrer dirait le dé) et la mise en scène d'un
 * gros match : le pronostic est celui du match nu, à forces égales.
 *
 * RIEN NE BOUGE : le hasard est isolé (`avecHasardIsole` : ce qui continue
 * sa suite retrouve le générateur exactement où il était), les clubs sont
 * des copies, et chaque joueur touché retrouve à la fin ses champs d'avant
 * (`photographier`/`rendre`).
 *
 * Le module est pur et sans DOM : la feuille du soir de la run (js/run.js,
 * js/run-jeu.js) l'affiche. Le pronostic d'une ligue au jour le jour, sa
 * prévision et les chances des objectifs sont partis avec l'ancien Rogue
 * (V28, tranche 4).
 */

import { playGame, avecHasardIsole, SLOTS } from './sim.js';

/* Les joueurs qu'un match peut toucher : les deux alignements, et le gardien de rappel. */
const joueursDe = t => [...SLOTS.map(s => t.roster[s.i]).filter(Boolean), ...(t.rappelG ? [t.rappelG] : [])];

/* Une photo des champs de chaque joueur de ces clubs, pour les lui rendre tels quels après : leurs alignements, le gardien de
 * rappel et leur club-école (un rappelé joue les matchs de la mesure ; sans sa photo, ses jambes et ses points restaient). */
function photographier(clubs) {
  const vus = new Set();
  const out = [];
  for (const p of clubs.flatMap(t => [...joueursDe(t), ...(t.ecole || [])])) if (p && !vus.has(p)) { vus.add(p); out.push([p, { ...p }]); }
  return out;
}
function rendre(photos) {
  for (const [p, ph] of photos) {
    for (const k of Object.keys(p)) if (!(k in ph)) delete p[k];
    Object.assign(p, ph);
  }
}

/*
 * LA CHANCE D'UN SOIR ISOLÉ (V28, js/run.js) : la run n'a ni ligue ni calendrier. Les deux clubs tels qu'ils sont ce soir
 * (leurs jambes, leur infirmerie), `n` matchs du moteur sur des copies, A à domicile ; rend les victoires de A. La jauge de
 * la feuille du soir l'appelle par tranches (`graine` change à chaque tranche) pour ne pas figer l'écran.
 */
export function chanceDUnSoir({ A, B, n = 40, graine = 'soir' }) {
  const photos = photographier([A, B]);
  const nu = t => ({ ...t, injured: new Map(t.injured), injuriesLog: [], journal: null, luck: 0, _gros: null, _effetMatch: null, _advGros: null, _dernierGros: null });
  const cA = nu(A), cB = nu(B);
  let vA = 0;
  try {
    avecHasardIsole(`${graine}|${A.tag}|${B.tag}`, () => {
      for (let i = 0; i < n; i++) {
        cA.injured = new Map(A.injured); cB.injured = new Map(B.injured);
        if (playGame(cA, cB, 1, false, false, null).winner === cA) vA++;
      }
    });
  } finally { rendre(photos); }
  return vA;
}
