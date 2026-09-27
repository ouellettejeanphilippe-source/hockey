/**
 * LES CARTES À COLLECTIONNER (S73).
 *
 * JP : *prends vraiment inspiration d'un jeu de deckbuilder avec choix et
 * cartes d'effets et autres* ; *quand y'a un choix, c'est un fullscreen modal
 * pis ça se passe là* ; *pense vraiment à un kid qui joue avec ses cartes
 * Upper Deck comme si c'était Slay the Spire*.
 *
 * Une carte, c'est un OBJET qu'on ramasse, pas une rangée de tableur : un
 * cadre dont la couleur dit la rareté, un nom en haut, une illustration (une
 * grosse icône, ou l'écusson du club et la position pour un vrai joueur), la
 * ligne de type des jeux de cartes (« Amélioration · au joueur de ton
 * choix »), le texte, les puces de l'effet, et le pied de la série. Les rares
 * et les légendaires ont le reflet holographique : on doit avoir envie de les
 * prendre avant même de les lire.
 *
 * Le module ne sait rien du jeu : il reçoit du HTML déjà échappé (le nom, le
 * texte, les puces) et rend le bouton. `ouvrirChoix` (js/gerant.js) l'appelle
 * quand un choix se prend en cartes — le palier, la recrue, le deck de départ
 * — et le bouton garde `.choix-option` et `data-choix` : c'est la même
 * décision, dans un autre costume.
 */

/* Les quatre raretés, de la plus commune à la plus rare. La gemme se lit sans la couleur. */
export const RARETES = {
  commune: { nom: 'Commune', gemme: '●' },
  peu: { nom: 'Peu commune', gemme: '◆' },
  rare: { nom: 'Rare', gemme: '★' },
  legendaire: { nom: 'Légendaire', gemme: '✦' },
};

/**
 * c : { cle, rarete, i (rang dans la main, pour la donne), ico, nomHtml,
 *       typeHtml, artHtml, texteHtml, bonHtml, prixHtml, pucesHtml,
 *       coinHtml, desactive }
 */
export function carteHtml(c) {
  const r = RARETES[c.rarete] ? c.rarete : 'commune';
  const R = RARETES[r];
  return `<button type="button" class="choix-option tc tc-${r}" data-choix="${c.cle}" style="--tc-i:${c.i || 0}"${c.desactive ? ' disabled' : ''}>
    <span class="tc-cadre">
      <span class="tc-tete"><span class="tc-nom">${c.nomHtml || ''}</span>${c.coinHtml ? `<span class="tc-coin">${c.coinHtml}</span>` : ''}</span>
      <span class="tc-art">${c.artHtml || `<span class="tc-art-ico" aria-hidden="true">${c.ico || '🃏'}</span>`}</span>
      <span class="tc-type"><span>${c.typeHtml || ''}</span><span class="tc-gemme" title="${R.nom}">${R.gemme}</span></span>
      ${c.texteHtml || c.bonHtml || c.prixHtml ? `<span class="tc-texte">${c.texteHtml ? `<span class="tc-quoi">${c.texteHtml}</span>` : ''}${c.bonHtml ? `<span class="choix-option-bon">+ ${c.bonHtml}</span>` : ''}${c.prixHtml ? `<span class="choix-option-prix">− ${c.prixHtml}</span>` : ''}</span>` : ''}
      ${c.pucesHtml ? `<span class="choix-puces tc-puces">${c.pucesHtml}</span>` : ''}
      ${c.desactive ? `<span class="choix-option-non">${c.desactive}</span>` : ''}
      <span class="tc-pied"><span>Cap 82-0</span><span>${R.nom}</span></span>
    </span>
  </button>`;
}

/* L'illustration d'un vrai joueur : l'écusson de son club, sa position, sa saison. */
export function artJoueur({ logoHtml = '', pos = '', saison = '', club = '' }) {
  return `<span class="tc-joueur">
    <span class="tc-logo">${logoHtml}</span>
    <span class="tc-pos">${pos}</span>
    <span class="tc-saison">${club ? `${club} · ` : ''}${saison}</span>
  </span>`;
}
