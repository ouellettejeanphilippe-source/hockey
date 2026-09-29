/**
 * LE RETOUR (1.0, R1 · La coquille). JP : *je me sens comme une balle de
 * pinball*. Un seul geste pour remonter, partout, et il remonte d'UN niveau :
 * Échap au clavier, B à la manette (js/manette.js), le bouton retour
 * d'Android, « ‹ Retour » à l'écran (tout ce qui porte `data-retour`).
 *
 * Le module ne sait rien du jeu : le contrôleur y inscrit ses niveaux, du
 * plus haut au plus bas — la couche du dessus, le direct, le Menu, une case
 * visée, une section. Chacun répond vrai s'il a pris le geste (il a fermé
 * quelque chose, ou il le garde : un choix forcé ne se ferme pas), et la
 * descente s'arrête là. Au Club, rien ne répond : on y est.
 *
 * LE BOUTON D'ANDROID. Avec le greffon App de Capacitor, on l'écoute ; au
 * Club, il range l'appli comme partout sur Android. Sans lui (un navigateur,
 * une WebView nue), une entrée d'historique sert de butée : « précédent »
 * la consomme, le jeu remonte d'un niveau et la repose. Au Club, elle n'est
 * pas reposée : un deuxième « précédent » quitte la page, comme ailleurs.
 */

import { jouerSon } from './sons.js';

let niveaux = [];
let arme = false;

/* `niveaux` : des fonctions () → vrai si le geste est pris, du plus haut au plus bas. */
export function brancherRetour(liste) {
  niveaux = liste;
  window.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape' || ev.defaultPrevented) return;
    ev.preventDefault();
    retour();
  });
  document.addEventListener('click', ev => {
    if (ev.target.closest && ev.target.closest('[data-retour]')) retour();
  });
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && App.addListener) {
    App.addListener('backButton', () => {
      if (retour()) return;
      if (App.minimizeApp) App.minimizeApp(); else if (App.exitApp) App.exitApp();
    });
    return;
  }
  // La butée d'historique se pose sous un geste de l'utilisateur : un
  // navigateur saute les entrées posées sans lui quand on fait « précédent ».
  const armer = () => {
    if (arme) return;
    arme = true;
    try { history.pushState({ cap82: 'retour' }, ''); } catch { arme = false; }
  };
  document.addEventListener('pointerdown', armer, true);
  document.addEventListener('keydown', armer, true);
  window.addEventListener('popstate', () => {
    arme = false;
    if (retour()) armer();
  });
}

/** Remonte d'un niveau. Vrai si quelque chose a répondu. */
export function retour() {
  for (const n of niveaux) {
    if (n()) { jouerSon('arriere'); return true; }
  }
  return false;
}
