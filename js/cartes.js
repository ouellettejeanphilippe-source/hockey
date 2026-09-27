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
export const PALIERS_RARETE = [['legendaire', 0.97], ['rare', 0.88], ['peu', 0.65]];
/* Le centile (la part de sa saison payée MOINS que lui) vers la rareté. */
export function rareteDuCentile(c) {
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
/* Ce que la gemme veut dire, en mots : l'infobulle ne parle que du salaire. */
const SENS_RARETE = {
  commune: 'un salaire comme les deux tiers de sa saison',
  peu: 'un salaire dans le tiers du haut de sa saison',
  rare: 'un salaire dans le 12 % du haut de sa saison',
  legendaire: 'un salaire dans le 3 % du haut de sa saison',
};
export const sensRarete = r => SENS_RARETE[r] || SENS_RARETE.commune;
/*
 * La gemme d'une carte de joueur. Rien sur une commune : trente cartes au
 * vestiaire, et un point gris sur vingt d'entre elles ne dirait rien que le
 * cadre ne dise déjà. Sur les autres, la gemme des cartes de match — elle se
 * lit sans la couleur.
 */
export function gemmeJoueur(r) {
  const R = RARETES[r];
  if (!R || r === 'commune') return '';
  return `<span class="cj-gemme" title="${R.nom} : ${sensRarete(r)}">${R.gemme}</span>`;
}

/*
 * L'illustration d'un vrai joueur : son visage, l'écusson de son club, sa
 * position, sa saison. Depuis S76 le visage REMPLIT l'illustration, sur le
 * fond de son club — la photo d'une carte de hockey, la position en pastille
 * et la saison en plaque par-dessus, comme la carte du vestiaire. Le petit
 * médaillon rond d'avant faisait de la recrue une carte d'effet avec un
 * visage dedans ; c'est une carte de JOUEUR. Sans portrait, l'écusson seul.
 */
export function artJoueur({ logoHtml = '', portraitHtml = '', pos = '', saison = '', club = '' }) {
  if (!portraitHtml) return `<span class="tc-joueur">
    <span class="tc-logo">${logoHtml}</span>
    <span class="tc-pos">${pos}</span>
    <span class="tc-saison">${club ? `${club} · ` : ''}${saison}</span>
  </span>`;
  const fond = club ? getTeamBand(club).bg : '';
  return `<span class="tc-joueur cj-art"${fond ? ` style="--cj-fond:${fond}"` : ''}>
    <span class="tc-portrait">${portraitHtml}</span>
    <span class="tc-medaille">${logoHtml}</span>
    <span class="tc-pos">${pos}</span>
    <span class="tc-saison">${club ? `${club} · ` : ''}${saison}</span>
  </span>`;
}
