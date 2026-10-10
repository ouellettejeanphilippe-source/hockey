/*
 * LE NŒUD DE LA SEMAINE (V5, js/noeuds.js). Ce qu'on exige :
 *   1. pur : la même graine et la même semaine rendent les mêmes routes ;
 *   2. trois routes sur quatre (le repos, l'entraînement, l'événement, la commandite), chacune une vraie carte de la
 *      banque ; VARIÉES : jamais les trois mêmes routes, ni la même carte sur une route, deux nœuds de suite ;
 *   3. aucune mécanique neuve : la décision ne porte que des champs que le moteur et la caisse lisent déjà
 *      (`gestes`, `effet`, `gain`), plus son palier et le nom de la route ;
 *   4. ce qu'une saison peut rapporter au plus en jetons par la commandite, pour le juger avec l'économie.
 */
import { noeudsDeLaSemaine, decisionDeNoeud, ROUTES } from '../js/noeuds.js';
import { BANQUE } from '../js/banque.js';
import { exiger, informer, verdict } from './verdict.mjs';

const CHAMPS = new Set(['palier', 'noeud', 'gestes', 'effet', 'gain']);
let purs = true, vraies = true, champs = true, routes = true, variees = true, maxGain = 0;
const vus = new Set();
for (let g = 1; g <= 200; g++) {
  let gain = 0, avant = null;
  for (let w = 1; w < 27; w += 2) {
    const a = noeudsDeLaSemaine(g, w), b = noeudsDeLaSemaine(g, w);
    if (JSON.stringify(a) !== JSON.stringify(b)) purs = false;
    const sortes = a.map(n => n.route);
    if (sortes.length !== 3 || sortes.join() !== Object.keys(ROUTES).filter(r => sortes.includes(r)).join()) routes = false;
    if (avant && (sortes.join() === avant.map(n => n.route).join() || a.some(n => avant.some(x => x.route === n.route && x.id === n.id)))) variees = false;
    avant = a;
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
exiger('trois routes sur quatre, dans l\'ordre : le repos, l\'entraînement, l\'événement, la commandite', routes);
exiger('variées : ni les mêmes routes ni la même carte deux nœuds de suite', variees);
exiger('chaque route est une vraie carte de la banque', vraies, `${vus.size} cartes différentes sur 200 saisons`);
exiger('la décision ne porte que des champs déjà lus (gestes, effet, gain)', champs);
informer('la commandite, prise chaque fois', `au plus ${maxGain} 🪙 par saison (13 nœuds)`);
verdict('Le nœud de la semaine');
