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
export const brille = r => r === 'rare' || r === 'legendaire';

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
 *       dans le retournement), meilleure (la dernière retournée, qui éclate) }
 */
export function carteHtml(c) {
  const r = RARETES[c.rarete] ? c.rarete : 'commune';
  const R = RARETES[r];
  return `<button type="button" class="choix-option tc tc-${r}${c.meilleure ? ' tc-meilleure' : ''}" data-choix="${c.cle}" style="--tc-i:${c.i || 0}${c.r != null ? `;--tc-r:${c.r}` : ''}"${c.desactive ? ' disabled' : ''}>
    ${brille(r) ? '<span class="tc-holo" aria-hidden="true"></span>' : ''}
    ${c.dos ? '<span class="tc-dos" aria-hidden="true"><span class="tc-dos-marque">Cap<b>82-0</b></span></span>' : ''}
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
 * La gemme d'une carte de joueur, la même que celle des cartes de match. Elle
 * se compte depuis S77 (un à trois diamants), donc la commune porte la sienne
 * aussi : un diamant seul dit « le bas de l'échelle », pas « rien ».
 */
export function gemmeJoueur(r) {
  const R = RARETES[r];
  if (!R) return '';
  return `<span class="cj-gemme" title="${R.nom} : ${sensRarete(r)}">${R.gemme}</span>`;
}

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
export const tirageLimite = cle => `${String(1 + (empreinte(`${cle}|tirage`) % 99)).padStart(2, '0')}/99`;

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
/* Ce qui se penche : une carte de joueur (pas sa vignette, pas la tête de la
   fiche — c'est sa PHOTO qui est la carte), une carte de match, le dos. */
const INCLINABLES = '.cj:not(.cj-mini):not(.pcard-full-head), .choix-option.tc:not(.jouee), .pcard-full-photo, .cj-verso';
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
      if (!c || c.matches('.locked, [disabled]')) return;
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
  const RARES = '.cj-lustre:not(.pcard-full-head), .cj-lustre .pcard-full-photo, .choix-option.tc.tc-rare, .choix-option.tc.tc-legendaire';
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
