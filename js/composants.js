/*
 * LES COMPOSANTS (V25 D1, docs/refonte-v25-d1.md ; JP : *refais tous les écrans, de zéro* ; *garder les cartes actuelles du
 * jeu, pas les refondre* ; *D1 sur le Rogue d'abord, D2 avec son devis*). Ce module remplace js/plateau-rogue.js : la
 * grammaire de la maquette A, écrite UNE fois en gabarits de chaînes. Une page du Rogue appelle ces composants avec ses
 * données et sa couleur ; elle ne redessine pas un onglet, un filtre ou une jauge à elle, et aucune règle de style.css ne
 * la repeint « en Rogue » (zéro surcharge de mode, `check_composants`). Une carte de joueur ou de jeu n'est jamais
 * redessinée : `cartonDe` et `carteHtml` (js/repechage.js, js/cartes.js) passent ici tels quels, dans `carteLigne`.
 * (js/plateau.js, lui, est le plateau de Sur table.)
 *
 *   bandeau    un titre de bloc en bandeau de bas d'écran (le filet du club, le fond qui s'estompe), ce qu'il compte à droite ;
 *   jetons     une rangée de choix — onglets d'une page, filtres, vues —, le choisi à la couleur du club, encre noire ;
 *   carteLigne une vraie carte, sa ligne dessous, un chiffre en coin sur l'ardoise (`coin`) ;
 *   caseVide   la place d'une carte, en pointillés ;
 *   grille     trois cartes de front (l'effectif, l'album, les trios), quatre pour la main ;
 *   cellules   deux ou trois chiffres séparés d'un filet (l'argent) ;
 *   jauge      une barre qui se remplit (l'expérience du coach) ;
 *   visage     un joueur en vignette, son état et son fait en vrais chiffres (la forme du groupe, ce qui court) ;
 *   billet     un match de la route, encoché sur les côtés ;
 *   marche     un rang de l'échelle du prestige ;
 *   podium     trois cartes, le premier au centre.
 * La case en carte des Lignes (`carteDeLaCase`, `.case-carte`, js/alignement.js) est le composant nommé de l'alignement du Rogue,
 * à côté de la case en rangée du 82-0 : la ligne, le dépôt et les verdicts restent un.
 */
import { esc } from './util.js';

/** Un titre de bloc en bandeau de bas d'écran ; `droite`, ce qu'il compte ou ce qu'il dit, sur l'or. */
export const bandeau = (titre, droite = '') => `<div class="pl-bandeau"><span>${titre}</span>${droite ? `<span class="pl-bandeau-d">${droite}</span>` : ''}</div>`;

/**
 * Une rangée de jetons : `items` [{ cle, mot, n, on, attr, cls }] ; `data` est l'attribut qui porte la clé (« groupe », « vue »…).
 * Le choisi porte `on` ; `n` est son compte, en plus petit. `role` : « tab » (des onglets) ou « button » (des filtres).
 */
export const jetons = (items, data, { role = 'tab', cls = '' } = {}) => `<div class="pl-jetons${cls ? ` ${cls}` : ''}" role="${role === 'tab' ? 'tablist' : 'group'}">${items.map(x =>
  `<button type="button" class="pl-jeton${x.cls ? ` ${x.cls}` : ''}${x.on ? ' on' : ''}" data-${data}="${esc(String(x.cle))}" role="${role}"${role === 'tab' ? ` aria-selected="${!!x.on}"` : ` aria-pressed="${!!x.on}"`}${x.attr || ''}>${x.mot}${x.n != null ? ` <span>${x.n}</span>` : ''}</button>`).join('')}</div>`;

/** Un chiffre en coin, sur l'ardoise noire : la stat du tri, « 19 fois », « Niveau 3 », l'édition. `ton` : or, rouge, vert, gris, club. */
export const coin = (valeur, { unite = '', ton = 'or', cote = 'droite', cls = '' } = {}) => `<span class="pl-coin pl-coin-${ton} pl-coin-${cote}${cls ? ` ${cls}` : ''}">${valeur}${unite ? `<small>${esc(unite)}</small>` : ''}</span>`;

/** Une vraie carte (le carton tel quel), ses coins, sa ligne dessous ; `barre`, ses jambes sous la carte. `cls` ajoute une classe. */
export const carteLigne = (carteHtml, ligne = '', { coins = '', cls = '', attrs = '', barre = null } = {}) => `<div class="pl-carte${cls ? ` ${cls}` : ''}"${attrs}>${coins}${carteHtml}${barre != null ? `<span class="pl-barre" aria-hidden="true"><i class="${barre.cls || ''}" style="width:${Math.round(barre.part * 100)}%"></i></span>` : ''}${ligne ? `<small class="pl-carte-l">${ligne}</small>` : ''}</div>`;

/** La place d'une carte, en pointillés : « Case libre », « Case vide ». */
export const caseVide = (mot, ligne = '', { cls = '', attrs = '', ton = '' } = {}) => `<div class="pl-carte pl-carte-vide${ton ? ` pl-ton-${ton}` : ''}${cls ? ` ${cls}` : ''}"${attrs}><span class="pl-vide">${mot}</span>${ligne ? `<small class="pl-carte-l">${ligne}</small>` : ''}</div>`;

/** Une grille de cartes : trois de front (`n` = 3), quatre pour la main (`n` = 4). */
export const grille = (cartes, { n = 3, cls = '', attrs = '' } = {}) => `<div class="pl-grille pl-grille-${n}${cls ? ` ${cls}` : ''}"${attrs}>${cartes.join('')}</div>`;

/** Des chiffres en cellules séparées d'un filet : [{ k, v, u }]. */
export const cellules = items => `<div class="pl-cellules">${items.map(x => `<span class="pl-cellule"><small>${x.k}</small><b>${x.v}</b><small>${x.u || ''}</small></span>`).join('')}</div>`;

/** Une jauge : la part remplie (0 à 1), ce qu'elle mesure en mots pour le lecteur d'écran. */
export const jauge = (part, mot) => `<div class="pl-jauge" role="img" aria-label="${esc(mot)}"><i style="width:${Math.round(Math.max(0, Math.min(1, part)) * 100)}%"></i></div>`;

/** Un joueur en vignette : son visage, son nom, son état, son fait. `ton` : feu, doute, blesse, or. */
export const visage = ({ mug, nom, mot, fait = '', ton = '' }) => `<div class="pl-visage${ton ? ` pl-ton-${ton}` : ''}"><span class="rond-visage" aria-hidden="true">${mug}</span><b>${esc(nom)}</b><small>${esc(mot)}${fait ? `<br>${esc(fait)}` : ''}</small></div>`;

/** Une rangée qui parle de quelqu'un : son visage (ou une icône), un titre, l'état dessous, un chiffre au bout. */
export const rangeeVisage = ({ mug = '', ico = '', titre, sous = '', chiffre = '', ton = 'or', attrs = '' }) => `<div class="pl-rangee pl-ton-${ton}"${attrs}>${mug ? `<span class="rond-visage" aria-hidden="true">${mug}</span>` : ico ? `<span class="pl-rangee-ico" aria-hidden="true">${ico}</span>` : ''}<span class="pl-rangee-t"><b>${titre}</b>${sous ? `<small>${sous}</small>` : ''}</span>${chiffre ? `<span class="pl-rangee-c">${chiffre}</span>` : ''}</div>`;

/** Un billet de la route : quand et où, l'écusson, le club, sa fiche. `cls` : pl-billet-soir, pl-billet-gros. */
export const billet = ({ quand, ico, nom, pied = '', cls = '', attrs = '', coinHtml = '' }) => `<li class="pl-billet${cls ? ` ${cls}` : ''}"${attrs}><span class="pl-billet-q">${quand}</span><span class="pl-billet-i" aria-hidden="true">${ico}</span><span class="pl-billet-n">${nom}</span>${pied ? `<span class="pl-billet-p">${pied}</span>` : ''}${coinHtml}</li>`;

/** Une marche de l'échelle : son numéro ou ✓, son nom, ce qui manque ou ce qu'elle donne, un mot au bout. `etat` : fait, ici, suivant, loin. */
export const marche = ({ num, nom, sous = '', bout = '', etat = 'loin' }) => `<div class="pl-marche pl-marche-${etat}"><i>${num}</i><span class="pl-marche-n">${esc(nom)}${sous ? `<small>${sous}</small>` : ''}</span><small class="pl-marche-b">${bout}</small></div>`;

/** Le podium : trois cartes de joueur (déjà en `carteLigne`), la première au centre et plus haute. */
export const podium = ([un, deux, trois]) => `<div class="pl-podium" role="group" aria-label="Le podium"><div class="pl-podium-2">${deux}</div><div class="pl-podium-1">${un}</div><div class="pl-podium-3">${trois}</div></div>`;
