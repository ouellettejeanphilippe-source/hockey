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
 * texte, les puces) et rend le bouton. Il ne lit que la couleur d'un club
 * (js/logos.js), pour le fond de la photo d'un joueur (S76). `ouvrirChoix` (js/gerant.js) l'appelle
 * quand un choix se prend en cartes — le palier, la recrue, le deck de départ
 * — et le bouton garde `.choix-option` et `data-choix` : c'est la même
 * décision, dans un autre costume.
 */

import { getTeamBand } from './logos.js';
import { NOM_VARIANTE } from './rarete.js';
import { actionSrc } from './actions.js';

/*
 * Les quatre raretés, de la plus commune à la plus rare. La gemme se lit sans
 * la couleur, et elle se COMPTE depuis S77 : un, deux, trois diamants, les
 * paliers d'une série à diamants des années 2000 — la légendaire est la
 * « parallèle » dorée des trois (la couleur la sépare de la rare, le compte
 * la classe). Le point, l'étoile et l'astérisque d'avant ne disaient pas
 * lequel était au-dessus de l'autre.
 */
export const RARETES = {
  commune: { nom: 'Commune', gemme: '◆' },
  peu: { nom: 'Peu commune', gemme: '◆◆' },
  rare: { nom: 'Rare', gemme: '◆◆◆' },
  legendaire: { nom: 'Légendaire', gemme: '◆◆◆' },
};
/* Les deux raretés qui brillent : l'holographique, le reflet, l'inclinaison au téléphone. */
const brille = r => r === 'rare' || r === 'legendaire';

/*
 * LES ILLUSTRATIONS DES CARTES DE MATCH (1.0). JP : *ça feel vraiment cheap
 * et pas professionnel*. L'émoji dans une boîte grise était l'icône d'une
 * étiquette, pas l'image d'une carte. Une vraie série a UN style de dessin :
 * ici un trait rond de 2,4 sur une grille de 48, une seule couleur d'accent
 * (`.a` en aplat, `.s` en trait), le reste à l'encre de la carte. Trente-six
 * motifs de hockey servent les quatre-vingt-quatre cartes (`DESSIN_DE`) ; une
 * carte sans motif prend celui de son genre. L'émoji reste l'icône de la
 * carte partout ailleurs (listes, main adverse, puces) : une icône = un sens.
 */
const DESSINS = {
  baton: '<path d="M34 5 21 34c-1.4 3-3.4 4-6.5 4H6"/><ellipse class="a" cx="36" cy="40" rx="6.5" ry="2.8"/>',
  rondelle: '<ellipse class="a" cx="29" cy="20" rx="12" ry="5"/><ellipse cx="29" cy="20" rx="12" ry="5"/><path d="M17 20v6c0 2.8 5.4 5 12 5s12-2.2 12-5v-6M4 19h8M3 26h9M6 33h7"/>',
  filet: '<path class="s" d="M8 40V12h32v28"/><path d="M8 12l7 7h18l7-7"/><path class="f" d="M15 19v21M33 19v21M15 26h18M15 33h18M21 19v21M27 19v21"/>',
  masque: '<path d="M13 13c0-5 22-5 22 0v13c0 8-6 13-11 13s-11-5-11-13z"/><path class="s" d="M17 23h14M17 28.5h14M24 19v19"/>',
  bouclier: '<path class="a" d="M24 11l9 3.3v7c0 6-3.8 10-9 13.5z"/><path d="M24 5l15 5.5v11c0 9.5-6.3 16-15 21.5C15.3 37.5 9 31 9 21.5v-11z"/>',
  mur: '<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M6 19.3h36M6 28.7h36M16 10v9.3M28 10v9.3M22 19.3v9.4M34 19.3v9.4M16 28.7V38M28 28.7V38"/><path class="a" d="M22 19.3h12v9.4H22z"/>',
  cadenas: '<rect x="11" y="21" width="26" height="20" rx="3"/><path d="M16 21v-6a8 8 0 0 1 16 0v6M24 32v4"/><circle class="a" cx="24" cy="30" r="2.8"/>',
  chrono: '<circle cx="24" cy="27" r="14"/><path class="s" d="M24 13a14 14 0 0 1 14 14"/><path d="M24 27l6-6M20 7h8M24 7v6M36 13l3-3"/>',
  sifflet: '<path d="M16 19h24v8H24.6A9 9 0 1 1 16 19z"/><circle class="a" cx="16" cy="28" r="3.2"/><path d="M40 23c3 0 4.5-3 3-6.5"/>',
  tableau: '<rect x="5" y="7" width="38" height="28" rx="2"/><path d="M11 14l5 5M16 14l-5 5M15 35l-3 7M33 35l3 7"/><circle cx="33" cy="16" r="3.2"/><path class="s" d="M14 28c6-7 12 2 18-6M28.5 21.6l3.5.4-.6 3.4"/>',
  planchette: '<rect x="10" y="8" width="28" height="34" rx="3"/><path d="M18 8V5h12v3M16 18h16M16 25h16M16 32h9"/><path class="s" d="M28 31l3 3 6-7"/>',
  micro: '<rect class="a" x="18" y="5" width="12" height="20" rx="6"/><rect x="18" y="5" width="12" height="20" rx="6"/><path d="M12 21a12 12 0 0 0 24 0M24 33v8M17 41h14"/>',
  video: '<rect x="5" y="8" width="38" height="26" rx="3"/><path class="a" d="M20 15v12l10-6z"/><path d="M16 41h16M24 34v7"/>',
  ampoule: '<path d="M17 30c-3-2.5-5-6-5-10a12 12 0 0 1 24 0c0 4-2 7.5-5 10v4H17z"/><path d="M18 38h12M20 42h8"/><path class="s" d="M21 24l3-5 3 5"/>',
  impact: '<path class="a" d="M24 14l3 6 6-2-2 6 6 3-6 3 2 6-6-2-3 6-3-6-6 2 2-6-6-3 6-3-2-6 6 2z"/><path d="M24 4l4 10 10-5-5 10 11 5-11 5 5 10-10-5-4 10-4-10-10 5 5-10L3 24l11-5-5-10 10 5z"/>',
  eclair: '<path class="a" d="M27 4 10 27h12l-3 17 19-24H26z"/><path d="M27 4 10 27h12l-3 17 19-24H26z"/>',
  flamme: '<path d="M24 44c-8 0-13-5.5-13-12.5 0-7 5-10 7-17 4 3 5 7 5 10 2-2 3-5 3-9 6 4 11 10 11 16.5C37 38.5 32 44 24 44z"/><path class="a" d="M24 44c-3.5 0-6-2.6-6-6 0-3.6 2.8-5.2 4-9 2.6 2 4.5 4.8 4.5 7.5 1-1 1.8-2.4 2-4 1.5 1.6 1.5 3.6 1.5 5.5 0 3.4-2.5 6-6 6z"/>',
  cible: '<circle cx="22" cy="26" r="16"/><circle cx="22" cy="26" r="9.5"/><circle class="a" cx="22" cy="26" r="4"/><path d="M22 26 42 6M35 6h7v7"/>',
  des: '<rect x="5" y="17" width="19" height="19" rx="4"/><rect x="22" y="9" width="19" height="19" rx="4" transform="rotate(14 31.5 18.5)"/><circle class="a" cx="10.5" cy="22.5" r="2"/><circle class="a" cx="18.5" cy="30.5" r="2"/><circle class="a" cx="14.5" cy="26.5" r="2"/><circle class="a" cx="31.5" cy="18.5" r="2"/>',
  coupe: '<path class="a" d="M16 7h16v9a8 8 0 0 1-16 0z"/><path d="M16 7h16v9a8 8 0 0 1-16 0zM16 10h-5c0 5 2 8 6 9M32 10h5c0 5-2 8-6 9M24 24v8M17 41h14l-2-9H19z"/>',
  couronne: '<path d="M8 36 6 16l10 8 8-13 8 13 10-8-2 20z"/><path d="M8 41h32"/><circle class="a" cx="24" cy="29" r="2.8"/><circle class="a" cx="15" cy="31" r="2"/><circle class="a" cx="33" cy="31" r="2"/>',
  etoile: '<path class="a" d="M24 5l5.9 12 13.1 1.9-9.5 9.3 2.2 13.1L24 35.1l-11.7 6.2 2.2-13.1L5 18.9 18.1 17z"/><path d="M24 5l5.9 12 13.1 1.9-9.5 9.3 2.2 13.1L24 35.1l-11.7 6.2 2.2-13.1L5 18.9 18.1 17z"/>',
  lien: '<rect x="4" y="17" width="23" height="13" rx="6.5" transform="rotate(-35 15.5 23.5)"/><rect class="s" x="21" y="18" width="23" height="13" rx="6.5" transform="rotate(-35 32.5 24.5)"/>',
  vague: '<path d="M4 30c5 0 5-6 10-6s5 6 10 6 5-6 10-6 5 6 10 6M4 38c5 0 5-6 10-6s5 6 10 6 5-6 10-6 5 6 10 6"/><path class="s" d="M9 20c2-8 10-12 18-10-5 1-8 5-7 10"/>',
  lune: '<path class="a" d="M29 8a16 16 0 1 0 11 25A13 13 0 0 1 29 8z"/><path d="M29 8a16 16 0 1 0 11 25A13 13 0 0 1 29 8z"/><path d="M31 13h6l-6 7h6M39 4h4l-4 4h4"/>',
  nuage: '<path d="M14 30a8 8 0 0 1 1-16 11 11 0 0 1 21 3 7 7 0 0 1-1 13z"/><path class="s" d="M17 36l-2 5M25 36l-2 5M33 36l-2 5"/>',
  croix: '<rect x="5" y="18" width="38" height="12" rx="6" transform="rotate(-38 24 24)"/><rect class="s" x="5" y="18" width="38" height="12" rx="6" transform="rotate(38 24 24)"/><circle class="a" cx="24" cy="24" r="2.6"/>',
  journal: '<path d="M8 8h26v32H12a4 4 0 0 1-4-4zM34 16h6v20a4 4 0 0 1-4 4M13 15h16M13 21h6M13 27h6M13 33h16"/><rect class="a" x="23" y="20" width="7" height="8"/>',
  loupe: '<circle cx="20" cy="20" r="12"/><path d="M29 29l12 12"/><path class="s" d="M14 17a7 7 0 0 1 6-5"/>',
  oeil: '<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="6.5"/><circle class="a" cx="24" cy="24" r="2.8"/>',
  patin: '<path d="M10 8h10v12l12 5c4 2 6 4 6 8v2H10z"/><path d="M5 41h34c2 0 3.5-1.2 3.5-3M15 35v6M33 35v6"/><path class="s" d="M20 14h-4M22 20h-5"/>',
  chandail: '<path d="M17 6 6 13l4 9 5-2v22h18V20l5 2 4-9-11-7c-1 3-4 5-7 5s-6-2-7-5z"/><path class="s" d="M15 30h18M15 35h18"/>',
  sablier: '<path d="M13 6h22M13 42h22M15 6c0 10 9 12 9 18s-9 8-9 18M33 6c0 10-9 12-9 18s9 8 9 18"/><path class="a" d="M18 39c1-5 4-7 6-8 2 1 5 3 6 8z"/>',
  portevoix: '<path class="a" d="M14 20v8l18 10V10z"/><path d="M8 20v8h6l18 10V10L14 20zM14 28l2 10h5l-2-8"/><path class="s" d="M37 18c2 2 2 10 0 12M41 14c4 4 4 16 0 20"/>',
  coeur: '<path d="M24 41S7 30 7 18a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 12-17 23-17 23z"/><path class="s" d="M10 24h8l3-6 4 11 3-5h9"/>',
  fleches: '<path d="M6 34 30 10M22 10h8v8"/><path class="s" d="M42 14 18 38M26 38h-8v-8"/>',
  toile: '<path d="M24 5v38M5 24h38M10.5 10.5l27 27M37.5 10.5l-27 27"/><path class="s" d="M24 12l8.5 3.5L36 24l-3.5 8.5L24 36l-8.5-3.5L12 24l3.5-8.5z"/><path class="f" d="M24 18l4.2 1.8L30 24l-1.8 4.2L24 30l-4.2-1.8L18 24l1.8-4.2z"/>',
  cle: '<path d="M30 6a9 9 0 0 0-8.4 12.2L7 32.8a4 4 0 0 0 5.7 5.7l14.6-14.6A9 9 0 0 0 39.5 15l-5.5 5.5-5.6-1.9-1.9-5.6z"/><circle class="a" cx="10" cy="35.5" r="1.8"/>',
  chapeau: '<path class="a" d="M15 26c3 1.6 15 1.6 18 0v6H15z"/><path d="M10 36c0-3 6-5 14-5s14 2 14 5-6 5-14 5-14-2-14-5zM15 32V14c0-3 4-5 9-5s9 2 9 5v18"/>',
};
/* Le motif de chaque carte de match (sa clé, sans le « + » d'une carte améliorée). */
const DESSIN_DE = {
  lancer: 'baton', bloquer: 'bouclier', changements: 'chrono', discours: 'portevoix', video: 'video', echecAvant: 'impact',
  trappe: 'toile', sagesse: 'sifflet', frapper: 'impact', partout: 'cible', retour: 'filet', conge: 'lune', prudence: 'cadenas',
  provoquer: 'flamme', quatrieme: 'cle', enclave: 'filet', poignets: 'rondelle', blitz: 'eclair', presse: 'micro',
  doublePresence: 'patin', contrePlan: 'tableau', gardienFeu: 'masque', avantage: 'etoile', systeme: 'tableau', gachettes: 'cible',
  murBleu: 'mur', jambes: 'patin', coequipiers: 'lien', famille: 'chandail', decennie: 'sablier', vieilleGarde: 'sablier',
  releve: 'vague', ligneOrigine: 'lien', des: 'des', user: 'patin', ombre: 'oeil', adrenaline: 'coeur', fermeture: 'cadenas',
  barrage: 'mur', zamboni: 'vague', vieux: 'micro', tueur: 'cible', miracle: 'etoile', legende: 'masque', chapeau: 'chapeau',
  coach: 'tableau', preparation: 'planchette', espion: 'loupe', capitaine: 'chandail', mur: 'mur', butEnOr: 'coupe',
  dynastie: 'couronne', dynastieClub: 'couronne', ferveur: 'portevoix', filature: 'loupe', improvisation: 'ampoule', piege: 'toile',
  elan: 'vague', forteresse: 'bouclier', toutOuRien: 'des', riposte: 'fleches', contreAttaque: 'fleches', systemeDef: 'planchette',
  lecture: 'oeil', grandSoir: 'etoile', sacrifice: 'coeur', cartouche: 'impact', pressionHaute: 'fleches', enclaveNette: 'filet',
  tirRebond: 'rondelle', gardienRelance: 'masque', cinqPuissance: 'eclair', tempsArret: 'chrono', coupGenie: 'ampoule',
  rideauFer: 'mur', feuSacre: 'flamme', nuitMagique: 'lune', distraction: 'journal', doute: 'nuage', trainee: 'croix',
};
const DESSIN_DU_GENRE = { attaque: 'rondelle', defense: 'bouclier', tactique: 'tableau', synergie: 'lien', malediction: 'nuage' };
function dessinHtml(cle, genre) {
  const d = DESSINS[DESSIN_DE[String(cle).replace(/\+$/, '')]] || DESSINS[DESSIN_DU_GENRE[genre]];
  return d ? `<svg class="tc-dessin" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>` : '';
}

/*
 * LE VRAI LOOK DE CARTE (S77). JP : *Carte qui font upper deck ou ô pee Chee
 * un peu, va chercher un vrai look de cartes avec effets, etc. Rends ça plus
 * dynamique et beau*. Une carte de match est une carte d'« insert » de la
 * même collection que les joueurs : le cadre du métal de sa rareté, le coût
 * dans une rondelle, et l'holographique des rares et des légendaires SUR LE
 * CADRE ET L'ILLUSTRATION seulement — la règle chiffrée reste sur un fond
 * uni, jamais sous un reflet : on lit d'abord, on brille ensuite. La couche
 * `.tc-holo` n'existe que sur les rares et les légendaires : trente
 * communes n'en paient rien.
 *
 * c : { cle, rarete, i (rang dans la main, pour la donne), ico, nomHtml,
 *       typeHtml, artHtml, texteHtml, bonHtml, prixHtml, pucesHtml,
 *       coinHtml, desactive, dos (le DOS de la carte : elle sort d'un paquet
 *       face cachée et se retourne, js/gerant.js `ouvrirChoix`), r (son rang
 *       dans le retournement), meilleure (la dernière retournée, qui éclate),
 *       joueurHtml (S78 : une CARTE MINI de joueur, qui remplace le cadre
 *       d'« insert » — le choix d'un joueur se voit en carte de joueur),
 *       genreCarte, dessin (1.0 : une carte de MATCH — son genre donne le fond
 *       de l'illustration et la couleur de sa bannière, sa clé son dessin) }
 */
export function carteHtml(c) {
  const r = RARETES[c.rarete] ? c.rarete : 'commune';
  const R = RARETES[r];
  /*
   * UN JOUEUR OFFERT NE SE PREND PAS D'UN TOUCHER (S78). JP : *si je clique sur
   * carte, pas automatiquement la choisir si pas cliqué sur signer*. La carte
   * se TOUCHE pour voir la fiche (`data-apercu`) ; le bouton « Signer » (ou
   * « Garder », « Choisir ») est le seul qui choisit (`data-choix`).
   */
  if (c.joueurHtml) return `<div class="choix-option tc tc-${r} tc-joueur${c.meilleure ? ' tc-meilleure' : ''}" data-apercu="${c.cle}" style="--tc-i:${c.i || 0}${c.r != null ? `;--tc-r:${c.r}` : ''}"${c.desactive ? ' aria-disabled="true"' : ''}>
    ${c.dos ? '<span class="tc-dos" aria-hidden="true"><span class="tc-dos-marque">Cap<b>82-0</b></span></span>' : ''}
    <span class="tcj-carte" role="button" tabindex="0" title="Voir sa fiche">${c.joueurHtml}</span>
    ${c.texteHtml || c.bonHtml || c.prixHtml ? `<span class="tcj-texte">${c.texteHtml ? `<span class="tc-quoi">${c.texteHtml}</span>` : ''}${c.bonHtml ? `<span class="choix-option-bon">+ ${c.bonHtml}</span>` : ''}${c.prixHtml ? `<span class="choix-option-prix">− ${c.prixHtml}</span>` : ''}</span>` : ''}
    ${c.pucesHtml ? `<span class="choix-puces tc-puces">${c.pucesHtml}</span>` : ''}
    ${c.desactive ? `<span class="choix-option-non">${c.desactive}</span>` : `<button type="button" class="btn tcj-signer" data-choix="${c.cle}">${c.motChoixHtml || 'Signer'}</button>`}
  </div>`;
  const genre = DESSIN_DU_GENRE[c.genreCarte] ? c.genreCarte : '';
  const art = c.artHtml || (c.dessin ? dessinHtml(c.dessin, genre) : '') || `<span class="tc-art-ico" aria-hidden="true">${c.ico || '🃏'}</span>`;
  return `<button type="button" class="choix-option tc tc-${r}${genre ? ` tc-g-${genre}` : ''}${c.meilleure ? ' tc-meilleure' : ''}" data-choix="${c.cle}" style="--tc-i:${c.i || 0}${c.r != null ? `;--tc-r:${c.r}` : ''}"${c.desactive ? ' disabled' : ''}>
    ${brille(r) ? '<span class="tc-holo" aria-hidden="true"></span>' : ''}
    ${c.dos ? '<span class="tc-dos" aria-hidden="true"><span class="tc-dos-marque">Cap<b>82-0</b></span></span>' : ''}
    <span class="tc-cadre">
      <span class="tc-tete"><span class="tc-nom">${c.nomHtml || ''}</span>${c.coinHtml ? `<span class="tc-coin">${c.coinHtml}</span>` : ''}</span>
      <span class="tc-art">${art}</span>
      <span class="tc-type"><span>${c.typeHtml || ''}</span><span class="tc-gemme" title="${R.nom}">${R.gemme}</span></span>
      ${c.texteHtml || c.bonHtml || c.prixHtml ? `<span class="tc-texte">${c.texteHtml ? `<span class="tc-quoi">${c.texteHtml}</span>` : ''}${c.bonHtml ? `<span class="choix-option-bon">+ ${c.bonHtml}</span>` : ''}${c.prixHtml ? `<span class="choix-option-prix">− ${c.prixHtml}</span>` : ''}</span>` : ''}
      ${c.pucesHtml ? `<span class="choix-puces tc-puces">${c.pucesHtml}</span>` : ''}
      ${c.desactive ? `<span class="choix-option-non">${c.desactive}</span>` : ''}
      <span class="tc-pied"><span>Cap 82-0</span><span>${R.nom}</span></span>
    </span>
  </button>`;
}

/*
 * LES JOUEURS SONT DES CARTES AUSSI (S76). JP : *Même dans le ui et le ux,
 * renforcer que les joueurs aussi, c'est des cartes de hockey*. Les cartes de
 * match avaient leur cadre, leur rareté et leur reflet ; le joueur qu'on
 * repêche, qu'on aligne et qu'on réclame au ballottage n'était qu'une tuile
 * aux couleurs de son club. Il prend le même langage — un cadre dont le
 * métal dit la rareté, le reflet holographique des rares, une fenêtre de
 * portrait, la plaque de la saison — pour qu'un joueur et une carte de match
 * se lisent comme deux cartes du même paquet.
 *
 * (S78 : la rareté n'est plus le salaire, c'est une variante tirée par chance
 * — voir « CE QUE LA GEMME VEUT DIRE » plus bas. `rareteDeSalaire` reste pour
 * qui veut encore lire le rang d'un salaire ; les cartes ne la lisent plus.)
 *
 * LA RARETÉ D'UN JOUEUR VIENT DE SON SALAIRE, ET DE RIEN D'AUTRE. La règle
 * ferme du dépôt : aucune cote dans le DOM, jamais — ni `o d r c v sp`, ni
 * rien qui s'en déduise en douce. Le salaire, lui, est écrit en gros sur la
 * carte : dire en couleur QUEL RANG il occupe parmi les salaires de sa saison
 * ne révèle rien que la carte ne dise déjà. Le centile se prend dans SA
 * saison (tous les joueurs du shard), pas sur les 55 : le barème est ramené
 * au plafond du jeu, mais sa forme change d'une époque à l'autre — plus du
 * tiers de la ligue touche le plancher en 1970-71, trois pour cent en
 * 2005-06, où le haut de l'échelle s'étire jusqu'à 18,6 M$.
 *
 * Les seuils font un paquet de cartes, mesurés sur six saisons : environ
 * deux tiers de communes, un quart de peu communes, une rare sur dix et deux
 * ou trois légendaires pour cent — Orr et Esposito en 1970-71, Gretzky et
 * Bossy en 1981-82, MacKinnon et McDavid en 2023-24. Un vestiaire de trente
 * joueurs en montre une ou deux rares, et une légendaire une fois sur deux :
 * ce qu'on trouve en ouvrant un paquet.
 */
const PALIERS_RARETE = [['legendaire', 0.97], ['rare', 0.88], ['peu', 0.65]];
/* Le centile (la part de sa saison payée MOINS que lui) vers la rareté. */
function rareteDuCentile(c) {
  for (const [r, seuil] of PALIERS_RARETE) if (c >= seuil) return r;
  return 'commune';
}
/*
 * La rareté d'un joueur dans SA saison : `saison` est l'entrée du shard
 * chargé (`{ players }`, `G.shards` dans js/game.js). Le barème trié se garde
 * par saison, la rareté par joueur — une recherche binaire, une fois : le
 * vestiaire rend trente cartes à chaque rendu, la liste « Tous » d'une
 * franchise des centaines. Une saison pas encore chargée rend « commune »
 * sans rien retenir : le rendu suivant, le shard en main, dira la vraie.
 */
const BAREMES = new WeakMap();
const RARETE_DE = new WeakMap();
export function rareteDeSalaire(p, saison) {
  if (!p) return 'commune';
  const connue = RARETE_DE.get(p);
  if (connue) return connue;
  if (!saison || !saison.players || !(p.$ > 0)) return 'commune';
  let s = BAREMES.get(saison);
  if (!s) { s = saison.players.map(x => x.$).filter(x => x > 0).sort((a, b) => a - b); BAREMES.set(saison, s); }
  let bas = 0, haut = s.length;
  while (bas < haut) { const m = (bas + haut) >> 1; if (s[m] < p.$) bas = m + 1; else haut = m; }
  const r = rareteDuCentile(s.length ? bas / s.length : 0);
  RARETE_DE.set(p, r);
  return r;
}
/*
 * CE QUE LA GEMME VEUT DIRE (S78). JP : *Pour les rareté pas par joueur, mais
 * par dessus joueur, comme un shiny dans pokemon genre*. La rareté d'une carte
 * de joueur n'est plus son rang de salaire : c'est une VARIANTE tirée par
 * chance — un quatrième trio peut sortir en légendaire, Gretzky en commune
 * (`varianteJoueur`, js/game.js ; les chances et les effets, js/rarete.js).
 * Les mots ne parlent donc plus du salaire : une brillante est de la chance.
 */
const SENS_RARETE = {
  commune: 'la carte de base : le joueur, rien de plus',
  peu: 'une parallèle : un bonus tiré au hasard, +3 %',
  rare: 'une holo : un bonus tiré au hasard, +5 %',
  legendaire: 'une or : deux bonus tirés au hasard, +5 % chacun',
};
export const sensRarete = r => SENS_RARETE[r] || SENS_RARETE.commune;
/* Une variante BRILLANTE (peu commune et au-dessus) : le « shiny ». */
export const brillante = r => r === 'peu' || r === 'rare' || r === 'legendaire';
/*
 * LA FEUILLE DE FINITION (S80). JP : *les visuels des cartes sont un peu plus
 * grossiers versus une vraie carte, ça manque de détails, de vrai*. Une vraie
 * parallèle, une holo, une or, c'est le CARTON lui-même qui est traité — le
 * chrome coloré d'un refractor, la feuille prismatique d'une holo, l'or brossé
 * — et pas un filet de couleur autour d'une carte de base. Cette couche se
 * pose sur le carton, SOUS la photo et SOUS chaque mot (style.css, « S80 —
 * DES VRAIES CARTES ») : elle ne teint jamais un visage et ne passe jamais
 * sur un chiffre. Une carte de base n'en porte pas (rien de lourd sur une
 * commune) : les trois gabarits et le verso l'écrivent par ici.
 */
export const finiHtml = r => (brillante(r) ? '<span class="cj-fini" aria-hidden="true"></span>' : '');
/*
 * LA GEMME D'UNE CARTE DE JOUEUR, avec ce que sa variante FAIT. Les diamants
 * disent la rareté (un à trois, l'or pour la légendaire), l'étoile ✦ qu'elle
 * est brillante, et l'icône du trait (`traitsDeCarte`, js/rarete.js) ce
 * qu'elle joue — une seule pastille, et l'infobulle dit la phrase entière.
 * Une commune ne joue rien de plus : ses diamants seuls. Le trait de la
 * RECRUE n'y entre pas : le tampon « Recrue » de la photo le porte déjà.
 */
export function gemmeJoueur(r, traits = []) {
  const R = RARETES[r];
  if (!R) return '';
  const joue = traits.filter(t => t && t.nom !== 'Le jeune progresse');
  const titre = [`${NOM_VARIANTE[r] || R.nom} : ${sensRarete(r)}`, ...joue.map(t => `${t.ico} ${t.nom} — ${t.mot}`)].join(' · ');
  return `<span class="cj-gemme" title="${echapper(titre)}">${R.gemme}${brillante(r) ? '<i class="cj-shiny" aria-hidden="true">✦</i>' : ''}${joue.map(t => `<b class="cj-trait">${t.ico}</b>`).join('')}</span>`;
}
const echapper = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/*
 * LES SÉRIES (1.0). JP : *les visuels des cartes sont un peu plus grossiers
 * versus une vraie carte, ça manque de détails, de vrai* ; *les cartes, ça
 * manque de variété de mise en page* ; puis *sauf les cartes, qui ont l'air
 * de vraies cartes, et avec background variés qui font pro* et *pense à des
 * cartes complexes*.
 *
 * Avant, une carte s'assemblait de cinq modules tirés d'une table (le cadre,
 * la photo, le nom, le motif, l'accent) : cinquante combinaisons qui se
 * ressemblaient toutes, parce que la MISE EN PAGE ne changeait jamais. Une
 * vraie collection change de DESSIN d'une série à l'autre. Il y en a dix,
 * chacune complète — le carton, la fenêtre de la photo, la plaque du nom, la
 * typographie, les petits caractères — et chacune inspirée des cartes de son
 * époque sans en copier aucune (ni marque, ni logo de fabricant) :
 *   vintage   1970-78  le carton crème, la fenêtre aux coins ronds cernée de
 *                      la couleur du club, le fanion du nom, le médaillon ;
 *   retro     1978-86  le bord blanc, la photo carrée, la bande du nom en
 *                      biais entre deux rayures du club ;
 *   tableau   1986-91  le tableau indicateur : le noir, la photo cernée
 *                      d'ampoules, le nom en points lumineux ;
 *   mosaique  1991-95  le graphisme du début des années 90 : une colonne de
 *                      tuiles aux couleurs du club, le nom à la verticale ;
 *   filet     1995-99  le filet : les poteaux et la barre rouges autour de la
 *                      photo, les mailles derrière, le nom en italique ;
 *   chrome    1999-03  le métal brossé, la fenêtre biseautée, la capsule du
 *                      nom estampée ;
 *   ecusson   2003-08  le ton sur ton : l'écusson géant embossé dans le
 *                      carton, le joueur détouré, le nom sur deux lignes ;
 *   glace     2008-13  la glace rayée et ses lignes, le joueur qui sort de
 *                      son cadre, la plaque du nom en biais ;
 *   arena     2013-19  l'aréna dans le noir : les projecteurs, la foule en
 *                      trame, la plaque blanche ;
 *   signature 2019-    le haut de gamme sobre : le carton nacré, les marges,
 *                      le nom espacé, l'écusson doré à chaud.
 * La SAISON choisit la série (`DEBUTS`), le CLUB la palette, la VARIANTE
 * (js/rarete.js) la parallèle — le même dessin, traité : voir `cartonHtml`.
 *
 * `action` : ce que la série fait d'une photo d'action (`photoAction`) —
 * 'plein', sur toute la carte ; 'fenetre', dans sa fenêtre ; rien, elle garde
 * le portrait, comme les vraies séries d'avant la photo d'action.
 */
export const SERIES = {
  vintage: { nom: 'Vintage 70' },
  retro: { nom: 'Rétro 80' },
  tableau: { nom: 'Tableau', action: 'fenetre' },
  mosaique: { nom: 'Mosaïque', action: 'fenetre' },
  filet: { nom: 'Filet', action: 'fenetre' },
  chrome: { nom: 'Chrome', action: 'fenetre' },
  ecusson: { nom: 'Écusson', action: 'plein' },
  glace: { nom: 'Glace', action: 'fenetre' },
  arena: { nom: 'Aréna', action: 'plein' },
  signature: { nom: 'Signature', action: 'fenetre' },
};
/* La première saison de chaque série : une saison prend la série de la dernière qui l'a commencée. */
const DEBUTS = [
  ['1970-71', 'vintage'], ['1978-79', 'retro'], ['1986-87', 'tableau'], ['1991-92', 'mosaique'], ['1995-96', 'filet'],
  ['1999-00', 'chrome'], ['2003-04', 'ecusson'], ['2008-09', 'glace'], ['2013-14', 'arena'], ['2019-20', 'signature'],
];
export function serieDe(saison) {
  const s = String(saison || '');
  let serie = DEBUTS[0][1];
  for (const [debut, cle] of DEBUTS) if (s >= debut) serie = cle;
  return serie;
}
/* L'année imprimée, dans le style de sa série : « '77-78 » sur un carton
   des années 70-80 (le millésime), « 1993-94 » ensuite. */
export function anneeDeCarte(saison) {
  const s = String(saison || '');
  return ['vintage', 'retro'].includes(serieDe(s)) ? `'${s.slice(2)}` : s;
}
/*
 * LA PHOTO D'ACTION. Le contrat : l'adresse d'une image au format carte
 * (portrait 5:7), ou rien. js/actions.js la fournit (les images, leur
 * liste, leur téléchargement sur l'appareil), `p.actionSrc` la force (les
 * planches) ; elle se branche ICI, et tous
 * les gabarits (le vestiaire, la carte mini, la fiche, `artJoueur`) la
 * reçoivent par ce seul endroit. Sans elle — ou si l'image manque au
 * chargement (`onerror`) — chaque série retombe sur le portrait.
 */
export const photoAction = p => (p && (p.actionSrc || (p.id && actionSrc(p.id)))) || '';

/*
 * LE NUMÉRO DE LA CARTE ET LE TIRAGE LIMITÉ (S77). Une vraie série numérote
 * ses cartes, et une carte haut de gamme porte son tirage (« 07/99 »). Les
 * deux se DÉDUISENT de la clé du joueur-saison (FNV-1a) : la même carte porte
 * toujours le même numéro, d'une partie à l'autre et d'un appareil à l'autre,
 * et rien n'est à sauvegarder. Aucune cote n'y entre — la clé est la saison,
 * le club et l'identifiant.
 */
function empreinte(cle) {
  let x = 2166136261 >>> 0;
  for (const ch of String(cle)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619) >>> 0;
  return x;
}
export const TAILLE_SERIE = 396;     // une série de l'époque : 396 cartes
export const numeroDeCarte = cle => 1 + (empreinte(cle) % TAILLE_SERIE);
/*
 * LE TIRAGE D'UNE OR. Le paquet lui a donné sa série limitée (`NUMEROS`,
 * js/packs.js : « /99 », « /25 », « /10 », « 1 de 1 ») ; l'exemplaire se
 * déduit de sa clé, comme le numéro de la carte. Sans série (le repêchage),
 * « /99 ».
 */
export function tirageLimite(cle, num = '/99') {
  if (num === '1 de 1') return '1 de 1';
  const sur = parseInt(String(num).replace(/\D/g, ''), 10) || 99;
  return `${String(1 + (empreinte(`${cle}|tirage`) % sur)).padStart(2, '0')}/${sur}`;
}

/*
 * LE CARTON D'UN JOUEUR (1.0) : UN gabarit, partout où un joueur est une
 * carte — le vestiaire, la carte mini des choix, la fiche. Il reçoit du HTML
 * déjà fait (le portrait, l'écusson, la gemme, le ruban du niveau) et le pose
 * dans le dessin de sa SÉRIE (`SERIES`, style.css « LES SÉRIES »).
 *
 * CE QUI NE BOUGE JAMAIS, d'une série à l'autre : le poste en haut à gauche,
 * le ruban du niveau à côté, la gemme en haut à droite. Le reste — la
 * fenêtre, la plaque du nom, l'écusson, les petits caractères — est à la
 * série. Au vestiaire, le salaire, le chiffre clé et le rôle vivent SOUS le
 * carton, dans une bande identique pour toutes (js/repechage.js).
 *
 * LES COUCHES, du fond vers l'œil : le carton de la série (son fond et ses
 * motifs, en CSS) ; la PARALLÈLE (`.carton-fini`) ; la photo ; le décor de
 * la série par-dessus la photo (un cadre, des poteaux, des rayures) ; les
 * mots ; le reflet de l'inclinaison. Une commune ne porte aucune couche de
 * plus : trente cartes au vestiaire, vingt-deux et demie sont des communes.
 *
 * LES PARALLÈLES (la variante, js/rarete.js) traitent la série au lieu de la
 * recouvrir, comme les vraies :
 *   peu (Parallèle) — le RÉFRACTEUR : le carton devient un chrome irisé, le
 *                     filet de la série prend l'argent ;
 *   rare (Holo)     — la feuille PRISMATIQUE sur le carton, et la RELIQUE :
 *                     un carré de chandail aux couleurs du club, tissé ;
 *   legendaire (Or) — l'OR brossé, le carton DÉCOUPÉ (les coins en rondelle),
 *                     le nom doré à chaud, la signature en FAC-SIMILÉ et le
 *                     TIRAGE numéroté (« 07/25 »).
 * Le tout reste sous les mots : on lit d'abord, on brille ensuite.
 *
 * c : { serie, rarete, portraitHtml, actionSrc, pos, posClasse, gemmeHtml,
 *       rubanHtml, nomHtml (`formatName`), nomLettres (le nom de famille, pour
 *       la taille de la plaque), nomClasse, logoHtml, club, clubNom, numero,
 *       annee, tirage, signature, clubClasse, eclat }
 */
export function cartonHtml(c) {
  const serie = SERIES[c.serie] ? c.serie : 'signature';
  const r = RARETES[c.rarete] ? c.rarete : 'commune';
  const action = c.actionSrc && SERIES[serie].action
    ? `<img class="carton-action" src="${echapper(c.actionSrc)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
  return `<span class="carton cs-${serie} tc-${r}${action ? (SERIES[serie].action === 'plein' ? ' action-plein' : ' action-fenetre') : ''}">
    ${brillante(r) ? '<span class="carton-fini" aria-hidden="true"></span>' : ''}
    <span class="carton-photo">${action}${c.portraitHtml || ''}</span>
    <span class="carton-deco" aria-hidden="true"></span>
    ${r === 'rare' ? '<span class="carton-relique" aria-hidden="true"><i>Relique</i></span>' : ''}
    <span class="carton-pos ${c.posClasse || ''}">${c.pos || ''}</span>
    ${c.rubanHtml || ''}${c.gemmeHtml || ''}
    <span class="carton-nom ${c.nomClasse || ''}" style="--n:${Math.max(4, c.nomLettres || 8)}">${c.nomHtml || ''}${c.clubNom ? `<span class="carton-club-nom">${c.clubNom}</span>` : ''}</span>
    ${r === 'legendaire' && c.signature ? `<span class="carton-signature" aria-hidden="true" style="--sig:${Math.max(8, c.signature.length)}">${c.signature}<small>fac-similé</small></span>` : ''}
    <span class="carton-club ${c.clubClasse || ''}">${c.logoHtml || ''}<span class="carton-sigle">${c.club || ''}</span></span>
    <span class="carton-imprime"><b>Nº ${c.numero || ''}</b><span>${SERIES[serie].nom}</span><span>${c.annee || ''}</span></span>
    ${r === 'legendaire' && c.tirage ? `<span class="carton-tirage">${c.tirage}</span>` : ''}
    ${c.eclat ? '<span class="cj-eclat" aria-hidden="true"></span>' : ''}
  </span>`;
}

/*
 * LE PAQUET (S77) : une récompense s'ouvre comme un paquet de cartes. JP :
 * *rends ça plus dynamique et beau*. Le paquet est du papier métallisé en CSS
 * pur — le rabat serti du haut, celui du bas, la marque, le nombre de cartes —
 * et il LUIT de la couleur de la meilleure carte qu'il contient avant qu'on
 * l'ouvre (argent pour une rare, or pour une légendaire), comme la lumière
 * d'une ouverture de paquet dans les jeux de sport : la tension avant le
 * contenu. Le contenu, lui, est déjà décidé (`recompensesOffertes`) : ce n'est
 * que la façon de le montrer.
 */
export function paquetHtml({ n = 3, meilleure = 'commune', serie = 'Récompense' } = {}) {
  serie = String(serie).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<button type="button" class="paquet paquet-${RARETES[meilleure] ? meilleure : 'commune'}" aria-label="Ouvrir le paquet">
    <span class="paquet-lueur" aria-hidden="true"></span>
    <span class="paquet-corps" aria-hidden="true">
      <span class="paquet-rabat paquet-haut"></span>
      <span class="paquet-face">
        <span class="paquet-glace"></span>
        <span class="paquet-marque">Cap<b>82-0</b></span>
        <span class="paquet-serie">${serie}</span>
        <span class="paquet-n">${n} cartes</span>
      </span>
      <span class="paquet-rabat paquet-bas"></span>
    </span>
    <span class="paquet-mot">Touche pour ouvrir</span>
  </button>`;
}

/*
 * L'INCLINAISON (S77) : une carte se penche sous le doigt ou la souris, et son
 * holographique et son reflet bougent avec elle. La technique des cartes
 * holographiques en CSS : la position du pointeur dans la carte devient des
 * propriétés (`--mx`, `--my` en pourcentage, `--rx`, `--ry` en degrés, au plus
 * 12°), et la feuille de style fait le reste — la rotation, le dégradé
 * arc-en-ciel en `color-dodge`, le reflet radial qui suit le doigt.
 *
 * UN SEUL écouteur délégué pour tout le document, et une seule carte à la
 * fois : celle sous le pointeur, ou celle qu'on presse. Aucun travail par
 * carte au rendu — le vestiaire en rend des centaines. Le calcul se fait une
 * fois par image (`requestAnimationFrame`). Au téléphone, le doigt penche la
 * carte tant qu'il la tient ; dès que le navigateur prend le geste pour un
 * défilement (`pointercancel`), la carte revient. Au relâcher, les propriétés
 * reviennent à zéro par une transition élastique (`@property`, style.css).
 *
 * LES RARES SUIVENT LE TÉLÉPHONE. Sur un appareil qui a l'orientation (le
 * WebView Android du jeu ne demande aucune permission ; iOS, qui en demande
 * une, est laissé tranquille), les rares et les légendaires À L'ÉCRAN
 * penchent doucement avec l'appareil (6° au plus), comme une carte qu'on
 * tourne sous la lampe. Une image par rafraîchissement au plus, rien quand
 * l'onglet est caché, rien sous `prefers-reduced-motion`.
 */
/* Ce qui se penche : le CARTON d'un joueur (1.0 : la carte, pas la bande de
   renseignements dessous ni le bouton), le dos de la fiche, une carte de
   match. Une case de l'alignement ne se penche pas (S78) : elle doit se lire,
   pas briller. */
const INCLINABLES = '.carton, .choix-option.tc:not(.jouee), .cj-verso';
const INCLINE_MAX = 12;
const GYRO_MAX = 6;
const PROPS = ['--mx', '--my', '--rx', '--ry', '--lueur'];
export function brancherInclinaison(doc = document) {
  if (!doc || doc.__inclinaison) return;
  doc.__inclinaison = true;
  const win = doc.defaultView || window;
  const calme = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let carte = null, x = 0, y = 0, raf = 0;
  const bornes = v => Math.min(1, Math.max(0, v));
  const poser = (c, px, py, max) => {
    const s = c.style;
    s.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    s.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    s.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
    s.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
    s.setProperty('--lueur', '1');
  };
  const dessiner = () => {
    raf = 0;
    if (!carte || !carte.isConnected) { carte = null; return; }
    const r = carte.getBoundingClientRect();
    if (!r.width || !r.height) return;
    poser(carte, bornes((x - r.left) / r.width), bornes((y - r.top) / r.height), INCLINE_MAX);
  };
  const relacher = () => {
    if (!carte) return;
    const c = carte;
    carte = null;
    c.classList.remove('incline');
    c.classList.add('relache');
    for (const k of PROPS) c.style.removeProperty(k);
    setTimeout(() => c.classList.remove('relache'), 700);
  };
  const suivre = ev => {
    if (calme.matches || !ev.target || !ev.target.closest) return;
    const c = ev.target.closest(INCLINABLES);
    if (c !== carte) {
      relacher();
      if (!c || c.matches('[disabled]') || c.closest('.locked')) return;
      carte = c;
      c.classList.remove('relache', 'gyro');
      c.classList.add('incline');
    }
    x = ev.clientX; y = ev.clientY;
    if (!raf) raf = win.requestAnimationFrame(dessiner);
  };
  const opts = { passive: true };
  doc.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse' || ev.buttons) suivre(ev); }, opts);
  doc.addEventListener('pointerdown', suivre, opts);
  doc.addEventListener('pointerup', ev => { if (ev.pointerType !== 'mouse') relacher(); }, opts);
  doc.addEventListener('pointercancel', relacher, opts);
  doc.addEventListener('pointerout', ev => {
    if (ev.pointerType === 'mouse' && carte && !(ev.relatedTarget && carte.contains(ev.relatedTarget))) relacher();
  }, opts);

  /*
   * LE DÉFILEMENT D'ABORD. Mesuré au processeur ralenti ×4, trois cents cartes
   * dont cent vingt brillantes : le miroitement et le reflet de la plaque
   * coûtaient une image sur deux au défilement (43 ms par image au lieu de
   * 21). Pendant qu'une liste défile, les miroitements se FIGENT
   * (`html.cj-defile`, style.css) et repartent 200 ms après le dernier
   * mouvement : l'œil suit la liste, pas le reflet.
   */
  let finDefile = 0;
  const racine = doc.documentElement;
  doc.addEventListener('scroll', () => {
    if (!racine.classList.contains('cj-defile')) racine.classList.add('cj-defile');
    clearTimeout(finDefile);
    finDefile = setTimeout(() => racine.classList.remove('cj-defile'), 200);
  }, { capture: true, passive: true });

  // L'orientation de l'appareil, pour les rares à l'écran seulement.
  const Ori = win.DeviceOrientationEvent;
  const tactile = win.matchMedia && win.matchMedia('(pointer: coarse)').matches;
  if (!Ori || typeof Ori.requestPermission === 'function' || !tactile) return;
  let base = null, lu = null, rafG = 0, avant = '';
  const RARES = '.carton:is(.tc-rare, .tc-legendaire), .choix-option.tc:is(.tc-rare, .tc-legendaire)';
  const pencher = () => {
    rafG = 0;
    if (!lu || calme.matches || doc.hidden) return;
    // La position de repos glisse vers celle de la main : on tient le
    // téléphone comme on veut, c'est le MOUVEMENT qui penche la carte.
    base = base ? { b: base.b * 0.96 + lu.beta * 0.04, g: base.g * 0.96 + lu.gamma * 0.04 } : { b: lu.beta, g: lu.gamma };
    const dx = Math.max(-1, Math.min(1, (lu.gamma - base.g) / 20));
    const dy = Math.max(-1, Math.min(1, (lu.beta - base.b) / 20));
    const cle = `${dx.toFixed(2)}|${dy.toFixed(2)}`;
    if (cle === avant) return;
    avant = cle;
    const h = win.innerHeight;
    for (const c of doc.querySelectorAll(RARES)) {
      if (c === carte) continue;
      const r = c.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > h) continue;
      c.classList.add('gyro');
      poser(c, 0.5 + dx / 2, 0.5 + dy / 2, GYRO_MAX);
    }
  };
  win.addEventListener('deviceorientation', e => {
    if (e.beta == null || e.gamma == null) return;
    lu = e;
    if (!rafG) rafG = win.requestAnimationFrame(pencher);
  }, opts);
}

/*
 * L'illustration d'un vrai joueur : son visage, l'écusson de son club, sa
 * position, sa saison. Depuis S76 le visage REMPLIT l'illustration, sur le
 * fond de son club — la photo d'une carte de hockey, la position en pastille
 * et la saison en plaque par-dessus, comme la carte du vestiaire. Le petit
 * médaillon rond d'avant faisait de la recrue une carte d'effet avec un
 * visage dedans ; c'est une carte de JOUEUR. Sans portrait, l'écusson seul.
 * 1.0 : une photo d'action (`photoAction`) prend toute l'illustration quand
 * elle est là ; si elle manque au chargement, le portrait revient.
 */
export function artJoueur({ logoHtml = '', portraitHtml = '', pos = '', saison = '', club = '', actionSrc = '' }) {
  if (!portraitHtml) return `<span class="tc-joueur">
    <span class="tc-logo">${logoHtml}</span>
    <span class="tc-pos">${pos}</span>
    <span class="tc-saison">${club ? `${club} · ` : ''}${saison}</span>
  </span>`;
  const fond = club ? getTeamBand(club).bg : '';
  return `<span class="tc-joueur cj-art"${fond ? ` style="--cj-fond:${fond}"` : ''}>
    <span class="tc-portrait">${actionSrc ? `<img class="tc-action" src="${echapper(actionSrc)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}${portraitHtml}</span>
    <span class="tc-medaille">${logoHtml}</span>
    <span class="tc-pos">${pos}</span>
    <span class="tc-saison">${club ? `${club} · ` : ''}${saison}</span>
  </span>`;
}
