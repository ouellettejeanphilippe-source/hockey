/**
 * LA COQUILLE FIXE (S67). JP : *faire que l'interface soit toujours, peu
 * importe le moment, même organisation et adaptable et redimensionnable sans
 * rien perdre*.
 *
 * La barre d'onglets du jeu porte TOUJOURS les mêmes entrées, dans le même
 * ordre (voir `ONGLETS_FIXES`, js/game.js). Ce qui change avec la phase,
 * c'est ce qu'un onglet MONTRE — le classement du jour pendant la saison, le
 * tableau pendant les séries, le classement final au bilan — jamais la barre.
 *
 * Les écrans qui vivent dans `#hubModal` (la saison, les séries, le tournoi)
 * avaient chacun leur barre à eux. Ils s'INSCRIVENT maintenant ici : chacun
 * dit quels volets il a et à quel onglet de la barre du jeu chacun répond
 * (`page`), et la barre du jeu les ouvre. Le module ne sait rien du jeu : il
 * tient l'écran actif et prévient le contrôleur quand la vue change.
 */

let actif = null;
let ecouteur = null;

/*
 * `hub` : { onglets() → [{ cle, page }], montrer(cle), courant() → cle }.
 * Le dernier inscrit gagne : il n'y a jamais qu'un écran dans `#hubModal`.
 */
export function inscrireHub(hub) {
  actif = hub;
  if (ecouteur) ecouteur({ type: 'ouvert' });
}

/* L'écran se retire (fermé, ou le banc prend la main). */
export function retirerHub(hub) {
  if (hub && actif !== hub) return;
  actif = null;
  if (ecouteur) ecouteur({ type: 'ferme' });
}

export const hubActif = () => actif;

/* Le volet de l'écran qui répond à un onglet de la barre, ou null. */
export function voletPour(page) {
  if (!actif) return null;
  const o = actif.onglets().find(x => x.page === page);
  return o ? o.cle : null;
}

/* La page de la barre que montre le volet courant de l'écran. */
function pageDuHub() {
  if (!actif) return null;
  const o = actif.onglets().find(x => x.cle === actif.courant());
  return o ? o.page : null;
}

/* L'écran a changé de volet de lui-même (après une journée, par exemple). */
export function signalerVue() {
  if (ecouteur) ecouteur({ type: 'vue', page: pageDuHub() });
}

export function surCoquille(fn) { ecouteur = fn; }
