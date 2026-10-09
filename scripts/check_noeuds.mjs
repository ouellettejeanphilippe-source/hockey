/*
 * LE NŒUD DE LA SEMAINE (V5, js/noeuds.js). Ce qu'on exige :
 *   1. pur : la même graine et la même semaine rendent les mêmes routes ;
 *   2. trois routes (le repos, l'événement, la commandite), chacune une vraie carte de la banque ;
 *   3. aucune mécanique neuve : la décision ne porte que des champs que le moteur et la caisse lisent déjà
 *      (`gestes`, `effet`, `gain`), plus son palier et le nom de la route ;
 *   4. ce qu'une saison peut rapporter au plus en jetons par la commandite, pour le juger avec l'économie.
 */
import { noeudsDeLaSemaine, decisionDeNoeud, ROUTES } from '../js/noeuds.js';
import { BANQUE } from '../js/banque.js';
import { exiger, informer, verdict } from './verdict.mjs';

const CHAMPS = new Set(['palier', 'noeud', 'gestes', 'effet', 'gain']);
let purs = true, vraies = true, champs = true, routes = true, maxGain = 0;
const vus = new Set();
for (let g = 1; g <= 200; g++) {
  let gain = 0;
  for (let w = 1; w < 27; w += 2) {
    const a = noeudsDeLaSemaine(g, w), b = noeudsDeLaSemaine(g, w);
    if (JSON.stringify(a) !== JSON.stringify(b)) purs = false;
    if (a.map(n => n.route).join() !== Object.keys(ROUTES).join()) routes = false;
    for (const n of a) {
      vus.add(n.id);
      if (!BANQUE[n.id]) vraies = false;
      const d = decisionDeNoeud(w, n);
      if (!Object.keys(d).every(k => CHAMPS.has(k)) || d.palier !== `n:${w}`) champs = false;
      if (n.route === 'commandite') gain += d.gain || 0;
    }
  }
  maxGain = Math.max(maxGain, gain);
}
exiger('pur : la même graine rend les mêmes routes', purs);
exiger('trois routes, dans l\'ordre : le repos, l\'événement, la commandite', routes);
exiger('chaque route est une vraie carte de la banque', vraies, `${vus.size} cartes différentes sur 200 saisons`);
exiger('la décision ne porte que des champs déjà lus (gestes, effet, gain)', champs);
informer('la commandite, prise chaque fois', `au plus ${maxGain} 🪙 par saison (13 nœuds)`);
verdict('Le nœud de la semaine');
