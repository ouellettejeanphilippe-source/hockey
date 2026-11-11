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

import { NOM_VARIANTE, EDITIONS } from './rarete.js';
import { NIVEAUX, nomDuNiveau, niveauSur } from './niveaux.js';
import { actionSrc, cadreAction, actionCouchee, cadreCouche } from './actions.js';
import { PIECES } from './pieces.js';
import { esc } from './util.js';

/*
 * Les quatre raretés, de la plus commune à la plus rare. La gemme se lit sans
 * la couleur, et elle se COMPTE depuis S77 : un, deux, trois diamants, les
 * paliers d'une série à diamants des années 2000. Le point, l'étoile et
 * l'astérisque d'avant ne disaient pas lequel était au-dessus de l'autre.
 * Oct. 2026 — JP : *spas clair les niveaux de rareté des cartes*. La
 * légendaire portait les trois diamants de la rare, et seule la couleur les
 * séparait : elle en porte quatre. Une gemme par rareté, la même partout
 * (cartes de jeu, cartes de joueur, cartable, boutique).
 */
/* Les deux cadres qui brillent (l'or, le prisme) : l'holographique, le reflet, l'inclinaison au téléphone. */
const brille = r => r === 'rare' || r === 'legendaire';
/* La gemme d'une carte de jeu : un diamant par niveau, de ◆ (Soutien) à ◆◆◆◆◆ (★ Phénomène). */
const gemmeDuNiveau = k => '◆'.repeat(k + 1);

/* Les genres d'une carte de jeu : la couleur de sa bannière (style.css, `.tc-g-…`). */
const GENRES = ['attaque', 'defense', 'tactique', 'synergie', 'malediction'];

/*
 * LE VRAI LOOK DE CARTE (S77). JP : *Carte qui font upper deck ou ô pee Chee
 * un peu, va chercher un vrai look de cartes avec effets, etc. Rends ça plus
 * dynamique et beau*. Une carte de match est une carte d'« insert » de la
 * même collection que les joueurs : le cadre du métal de sa rareté, le coût
 * dans le coin, et la lumière des rares et des légendaires SUR LE CARTON
 * seulement — la règle chiffrée se lit dessous, sur un fond uni, jamais sous
 * un reflet : on lit d'abord, on brille ensuite. Le cadre et la lumière
 * (`.carton-cadre`, `.carton-lueur`) n'existent que sur les rares et les
 * légendaires : trente communes n'en paient rien.
 *
 * c : { cle, niveau (0 à 4, js/niveaux.js ; V25 B1 : la rareté est partie), i (rang dans la main, pour la donne), ico, nomHtml,
 *       typeHtml, texteHtml et pucesHtml (son verso), genreCarte (la couleur de sa bannière), lecture (à lire, jamais à
 *       prendre), statique (la même face hors d'un choix, sans « Prendre ») }
 * Le dos d'une carte tirée d'un paquet, la carte mini d'un joueur à signer, le costume d'une carte de la banque et le
 * dessin d'une carte de match étaient aux écrans de l'ancien Rogue : partis avec eux (V28, tranche 4).
 */
/* L'icône d'une carte de jeu, dans sa fenêtre et dans son médaillon. */
const artDeJeu = c => `<span class="tc-art-ico" aria-hidden="true">${c.ico || '🃏'}</span>`;
const icoDeJeu = c => (c.ico ? `<span class="tcj-ico" aria-hidden="true">${c.ico}</span>` : artDeJeu(c));
/*
 * LE RECTO D'UNE CARTE DE JEU, seul : le carton de la glace aux couleurs de son genre (le genre se pose sur un parent
 * `.tc.tc-g-…`). `carteHtml` l'habille d'un choix .
 */
function rectoDeJeu(c) {
  const k = niveauSur(c.niveau), r = NIVEAUX[k].cadre;
  const nomTexte = String(c.nomHtml || '').replace(/<[^>]*>/g, '');
  return `<span class="carton cs-glace cs-jeu tc-${r}">
      ${r === 'peu' ? '<span class="carton-fini" aria-hidden="true"></span>' : ''}
      <span class="carton-photo"><span class="tcj-art">${artDeJeu(c)}</span></span>
      <span class="carton-deco" aria-hidden="true"></span>
      ${brille(r) ? '<span class="carton-lueur" aria-hidden="true"></span><span class="carton-cadre" aria-hidden="true"></span>' : ''}
      <span class="cj-gemme" title="${nomDuNiveau(k)}">${gemmeDuNiveau(k)}</span>
      <span class="carton-nom" style="--n:${Math.max(6, nomTexte.length)}"><span class="lname tc-nom">${c.nomHtml || ''}</span>${c.typeHtml ? `<span class="carton-club-nom">${c.typeHtml}</span>` : ''}</span>
      <span class="carton-club">${icoDeJeu(c)}</span>
      <span class="carton-imprime"><b>Cap 82-0</b><span>${nomDuNiveau(k)}</span></span>
    </span>`;
}
export function carteHtml(c) {
  const k = niveauSur(c.niveau), r = NIVEAUX[k].cadre;
  const genre = GENRES.includes(c.genreCarte) ? c.genreCarte : '';
  /*
   * LE FORMAT CARTE DE HOCKEY (oct. 2026). JP : *j'aime vraiment le format carte de hockey, pas les autres*. Une carte
   * de jeu est un carton comme celui d'un joueur (`cartonHtml`) : la série de la glace, aux couleurs de son genre au
   * lieu d'un club ; son icône dans la fenêtre et dans le médaillon, son niveau dans le coin, son nom sur la plaque.
   * Son niveau fait son cadre : le métal, l'or, le prisme (V25 B1).
   */
  const ico = icoDeJeu(c);
  /*
   * CE QU'ELLE FAIT SE LIT À SON VERSO (JP : *mettre les stats derrière la carte*). Le recto est la carte, rien d'autre ;
   * la toucher la retourne (`brancherInclinaison`). Toucher ne prend plus : « Prendre », dessous, prend. Le verso est le
   * dos du même carton : la glace, le métal de son niveau, la bande de son genre en tête et l'imprimé au pied.
   */
  const verso = `${c.texteHtml ? `<span class="tc-texte"><span class="tc-quoi">${c.texteHtml}</span></span>` : ''}${c.pucesHtml ? `<span class="choix-puces tc-puces">${c.pucesHtml}</span>` : ''}`;
  const face = verso ? 'button type="button" class="tc-face" aria-pressed="false" title="Toucher pour la retourner"' : 'span class="tc-face"';
  return `<div class="choix-option tc tc-${r}${genre ? ` tc-g-${genre}` : ''}${c.lecture ? ' lecture' : ''}" data-carte="${c.cle}" style="--tc-i:${c.i || 0}">
    <${face}>
    ${rectoDeJeu(c)}
    ${verso ? `<span class="carton cs-glace cs-jeu tc-${r} tc-verso">
      ${brille(r) ? '<span class="carton-lueur" aria-hidden="true"></span><span class="carton-cadre" aria-hidden="true"></span>' : ''}
      <span class="tcv-corps"><span class="tcv-tete">${ico}<span class="tcv-nom">${c.nomHtml || ''}</span></span>${verso}<span class="tcv-pied"><b>Cap 82-0</b><span>${nomDuNiveau(k)}</span></span></span>
    </span>` : ''}
    </${verso ? 'button' : 'span'}>
    ${c.statique || c.lecture ? '' : `<button type="button" class="btn-sign tc-prendre" data-choix="${c.cle}">Prendre</button>`}
  </div>`;
}

/*
 * LES JOUEURS SONT DES CARTES AUSSI (S76). JP : *Même dans le ui et le ux,
 * renforcer que les joueurs aussi, c'est des cartes de hockey*. Les cartes de
 * match avaient leur cadre, leur niveau et leur reflet ; le joueur qu'on
 * repêche, qu'on aligne et qu'on réclame au ballottage n'était qu'une tuile
 * aux couleurs de son club. Il prend le même langage — un cadre dont le
 * métal dit l'édition, le reflet holographique des brillantes, une fenêtre de
 * portrait, la plaque de la saison — pour qu'un joueur et une carte de match
 * se lisent comme deux cartes du même paquet.
 *
/*
 * CE QUE LA GEMME VEUT DIRE (S78). JP : *Pour les rareté pas par joueur, mais
 * par dessus joueur, comme un shiny dans pokemon genre*. La rareté d'une carte
 * de joueur n'est plus son rang de salaire : c'est une VARIANTE tirée par
 * chance — un quatrième trio peut sortir en légendaire, Gretzky en commune
 * (`varianteJoueur`, js/game.js ; les chances et les effets, js/rarete.js).
 * Les mots ne parlent donc plus du salaire : une brillante est de la chance.
 */
const SENS_RARETE = {
  commune: 'l\'édition 1, la Base : le joueur, rien de plus',
  peu: 'l\'édition 2, le Cadre : son second badge monte d\'un métal',
  hors: 'l\'édition 3, le Hors-cadre : ses deux badges montent d\'un métal',
  rare: 'l\'édition 4, l\'Or : ses deux badges montent d\'un métal, et le second rend plein',
  legendaire: 'l\'édition 5, la Holo : ses deux badges montent de deux métaux, et le second rend plein',
};
/*
 * LA CARTE D'UNE PIÈCE DE BANC (V27, tranche 5, js/pieces.js) : la carte de jeu de la glace, au cadre de la pièce et à la
 * couleur de son genre, son nom sur la plaque, sa condition en type. `c` : ce que l'écran y ajoute (le verso, `lecture`).
 */
export function carteDePiece(cle, c = {}) {
  const P = PIECES[cle];
  return P ? carteHtml({ cle, niveau: P.cadre, genreCarte: P.genre, ico: P.ico, nomHtml: esc(P.nom), typeHtml: esc(P.quandMot), ...c }) : '';
}
export const sensRarete = r => SENS_RARETE[r] || SENS_RARETE.commune;
/* Une édition au-dessus de la Base : le « shiny ». */
export const brillante = r => EDITIONS.indexOf(r) > 0;
/* L'édition d'une carte de joueur, ou la Base : ses clés ne sont pas toutes des raretés de cartes de jeu (`hors`). */
const edition = r => (EDITIONS.includes(r) ? r : 'commune');
/*
 * LE COIN D'UNE CARTE DE JOUEUR : le nom de son édition (Cadre, Hors-cadre,
 * Or, Holo), et l'icône d'un autre trait qu'elle joue — l'infobulle dit la
 * phrase entière. Oct. 2026 — JP : *les diamants, je trouve pas ça beau* ;
 * l'édition se VOIT à la carte entière (style.css, « LES ÉDITIONS »), le coin
 * ne fait que la nommer. Une Base n'a pas de coin. Le trait de la RECRUE n'y
 * entre pas : le tampon « Recrue » de la photo le porte déjà.
 */
export function gemmeJoueur(r, traits = []) {
  r = edition(r);
  // L'édition s'y lit déjà en toutes lettres : ses icônes ne disent que les autres traits.
  const joue = traits.filter(t => t && t.nom !== 'Le jeune progresse' && t.nom !== NOM_VARIANTE[r]);
  if (!brillante(r) && !joue.length) return '';
  const titre = [sensRarete(r), ...joue.map(t => `${t.ico} ${t.nom} — ${t.mot}`)].join(' · ');
  return `<span class="cj-gemme" title="${echapper(titre)}">${brillante(r) ? `<i class="cj-var">${NOM_VARIANTE[r]}</i>` : ''}${joue.map(t => `<b class="cj-trait">${t.ico}</b>`).join('')}</span>`;
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
 * vraie collection change de DESSIN d'une année à l'autre. JP (oct. 2026) :
 * *avoir variété de design de cartes par années, pas par décennie* ; *chaque
 * année devra être différente* ; *ça doit être pro et commercial, la vraie
 * affaire*. Une série par saison, chacune complète — le carton, la fenêtre de
 * la photo, la plaque du nom, sa typographie (fonts/), ses ornements
 * (`.carton-orne`), les petits caractères — et
 * chacune inspirée des cartes de son année sans en copier aucune (ni marque,
 * ni logo de fabricant). Le dessin de chacune est décrit sur sa règle, dans
 * style.css « LES SÉRIES ».
 * La SAISON choisit la série (`SERIES`), le CLUB la palette, la VARIANTE
 * (js/rarete.js) la parallèle — le même dessin, traité : voir `cartonHtml`.
 * Une saison sans série (une saison neuve) prend celle de la dernière saison qui en a une.
 *
 * La photo d'action (`photoAction`) n'appartient pas à une série : elle remplit sa
 * fenêtre, et toute la carte aux éditions hautes (oct. 2026).
 * `dos` range son verso (JP : *varie plus le positionnement des éléments derrière selon les séries*) : `centre` et
 * `logo-g` reprennent son recto (le nom centré, l'écusson à gauche) ; `tete-bas` (l'en-tête au pied) et `stats-bas`
 * (les saisons sous les badges) font qu'une année ne range pas son dos comme la précédente (style.css, « LES DOS »).
 */
export const SERIES = {
  fanion: { nom: 'Fanion', saison: '1970-71', dos: 'centre logo-g' },
  almanach: { nom: 'Almanach', saison: '1971-72', dos: 'tete-bas stats-bas' },
  affiche: { nom: 'L\'affiche', saison: '1972-73', dos: 'centre logo-g' },
  bordure: { nom: 'Bordure', saison: '1973-74', dos: 'stats-bas' },
  crosse: { nom: 'La crosse', saison: '1974-75', dos: 'tete-bas' },
  tricolore: { nom: 'Tricolore', saison: '1975-76', dos: 'stats-bas' },
  losange: { nom: 'Losange', saison: '1976-77' },
  kraft: { nom: 'Kraft', saison: '1977-78', dos: 'tete-bas stats-bas' },
  rayure: { nom: 'Rayure', saison: '1978-79' },
  vif: { nom: 'Cadre vif', saison: '1979-80', dos: 'stats-bas' },
  medaillon: { nom: 'Médaillon', saison: '1980-81', dos: 'logo-g tete-bas' },
  pointille: { nom: 'Pointillé', saison: '1981-82', dos: 'stats-bas' },
  ecran: { nom: 'Écran', saison: '1982-83' },
  bandes: { nom: 'Les bandes', saison: '1983-84', dos: 'tete-bas stats-bas' },
  quadrillage: { nom: 'Quadrillage', saison: '1984-85' },
  neon: { nom: 'Néon', saison: '1985-86', dos: 'stats-bas' },
  marquoir: { nom: 'Le marquoir', saison: '1986-87', dos: 'tete-bas' },
  punaise: { nom: 'Punaise', saison: '1987-88', dos: 'stats-bas' },
  vague: { nom: 'La vague', saison: '1988-89' },
  geant: { nom: 'Le géant', saison: '1989-90', dos: 'logo-g tete-bas stats-bas' },
  patinoire: { nom: 'Patinoire', saison: '1990-91' },
  marbre: { nom: 'Marbre', saison: '1991-92', dos: 'centre stats-bas' },
  pleine: { nom: 'Pleine glace', saison: '1992-93', dos: 'tete-bas' },
  ultra: { nom: 'Ultra', saison: '1993-94', dos: 'stats-bas' },
  dorure: { nom: 'Dorure', saison: '1994-95' },
  refracteur: { nom: 'Réfracteur', saison: '1995-96', dos: 'tete-bas stats-bas' },
  eclat: { nom: 'Éclat', saison: '1996-97' },
  ardoise: { nom: 'Ardoise', saison: '1997-98', dos: 'stats-bas' },
  circuit: { nom: 'Circuit', saison: '1998-99', dos: 'tete-bas' },
  millenaire: { nom: 'Millénaire', saison: '1999-00', dos: 'centre logo-g stats-bas' },
  acier: { nom: 'Acier', saison: '2000-01' },
  decoupe: { nom: 'Découpe', saison: '2001-02', dos: 'tete-bas stats-bas' },
  miroir: { nom: 'Miroir', saison: '2002-03' },
  blason: { nom: 'Blason', saison: '2003-04', dos: 'centre stats-bas' },
  releve: { nom: 'La relève', saison: '2005-06', dos: 'tete-bas' },
  souvenir: { nom: 'Souvenir', saison: '2006-07', dos: 'centre stats-bas' },
  vitre: { nom: 'La baie vitrée', saison: '2007-08' },
  givre: { nom: 'Givre', saison: '2008-09', dos: 'tete-bas stats-bas' },
  prisme: { nom: 'Prisme', saison: '2009-10' },
  filigrane: { nom: 'Filigrane', saison: '2010-11', dos: 'stats-bas' },
  contrejour: { nom: 'Contre-jour', saison: '2011-12', dos: 'centre tete-bas' },
  lame: { nom: 'La lame', saison: '2012-13', dos: 'stats-bas' },
  projecteur: { nom: 'Projecteur', saison: '2013-14', dos: 'logo-g' },
  pixel: { nom: 'Pixel', saison: '2014-15', dos: 'tete-bas stats-bas' },
  encre: { nom: 'Encre', saison: '2015-16' },
  degrade: { nom: 'Dégradé', saison: '2016-17', dos: 'stats-bas' },
  centenaire: { nom: 'Centenaire', saison: '2017-18', dos: 'centre tete-bas' },
  brume: { nom: 'Brume', saison: '2018-19', dos: 'stats-bas' },
  perle: { nom: 'Perle', saison: '2019-20', dos: 'centre' },
  bulle: { nom: 'La bulle', saison: '2020-21', dos: 'centre tete-bas stats-bas' },
  origine: { nom: 'Origine', saison: '2021-22' },
  spectre: { nom: 'Spectre', saison: '2022-23', dos: 'centre stats-bas' },
  velocite: { nom: 'Vélocité', saison: '2023-24', dos: 'tete-bas' },
  apogee: { nom: 'Apogée', saison: '2024-25', dos: 'centre stats-bas' },
  // L'Aurore était dessinée pour 2026-27 ; la saison en cours n'est pas encore au jeu (scripts/build_shards.py `MATCHS_POUR_JOUER`) : elle habille 2025-26 (JP, 24 oct.).
  aurore: { nom: 'Aurore', saison: '2025-26', dos: 'logo-g' },
};
const PAR_SAISON = Object.entries(SERIES).map(([cle, s]) => [s.saison, cle]);
export function serieDe(saison) {
  const s = String(saison || '');
  let serie = PAR_SAISON[0][1];
  for (const [debut, cle] of PAR_SAISON) if (s >= debut) serie = cle;
  return serie;
}
/* L'année imprimée, dans le style de son année : « '77-78 » sur un carton d'avant 1990 (le millésime), « 1993-94 » ensuite. */
export function anneeDeCarte(saison) {
  const s = String(saison || '');
  return s && s < '1990-91' ? `'${s.slice(2)}` : s;
}
/*
 * LA PHOTO D'ACTION. Le contrat : l'adresse d'une image au format carte
 * (portrait 5:7), ou rien. js/actions.js la fournit (les images, leur
 * liste), `p.actionSrc` la force (les
 * planches) ; elle se branche ICI, et tous
 * les gabarits (le vestiaire, la carte mini, la fiche, `artJoueur`) la
 * reçoivent par ce seul endroit. Sans elle — ou si l'image manque au
 * chargement (`onerror`) — chaque série retombe sur le portrait.
 *
 * L'ACTION, DÈS QU'ELLE EXISTE (oct. 2026). JP : *plus de cartes avec photo en action, lorsque possible, les
 * vraies cartes sont plus souvent en action*. Avant, seules les éditions hautes la montraient. Maintenant toute
 * carte la prend : en Base et en Cadre, elle remplit la fenêtre de sa série ; au Hors-cadre, à l'Or et à la
 * Holo, elle sort du cadre et prend toute la carte. Le portrait reste pour qui n'a pas de photo d'action.
 */
// La photo de SA saison (`p.s`, à son club `p.t`) d'abord, s'il y en a une (scripts/actions_saisons.mjs) ; sinon la générale.
export const photoAction = p => (p && (p.actionSrc || (p.id && actionSrc(p.id, p.s, p.t)))) || '';
/*
 * LE CADRE DE LA PHOTO (oct. 2026, JP : *try fit according to the space the picture will be in*). Le centre du visage
 * dans la photo d'action (`cadreAction`, js/actions.js), ou null ; la fenêtre de chaque série y pose la face
 * (`.photo-cadree`, style.css).
 */
export const cadrePhoto = p => (p && p.id && cadreAction(p.id, p.s, p.t)) || null;
const styleCadre = c => (c ? ` style="--fx:${c[0]};--fy:${c[1]}"` : '');
/*
 * LA PHOTO COUCHÉE (oct. 2026, JP : *cartes spéciales action horizontales quand t'as des photos qui gossent vertical*) :
 * la version 7:5 de la photo que montre la carte (celle de sa saison, ou la générale) quand la fenêtre debout coupe le
 * jeu (scripts/actions_couchees.mjs), ou rien (`actionCouchee`, js/actions.js) ; avec elle, la carte se couche.
 */
export const photoCouchee = p => (p && p.id && !p.actionSrc && actionCouchee(p.id, p.s, p.t)) || '';
export const cadrePhotoCouchee = p => (p && p.id && cadreCouche(p.id, p.s, p.t)) || null;

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
 * motifs, en CSS) ; le réfracteur du Cadre (`.carton-fini`) ; la photo ; le
 * décor de la série par-dessus la photo (un cadre, des poteaux, des
 * rayures) ; la lumière de l'Or et de la Holo (`.carton-lueur`) ; le métal
 * de l'édition (`.carton-cadre`) ; les mots ; le reflet de l'inclinaison.
 * Une Base ne porte aucune couche de plus.
 *
 * LES ÉDITIONS (js/rarete.js, oct. 2026) changent la carte ENTIÈRE, à la
 * Marvel Snap, et chacune garde ce que la précédente avait :
 *   peu (Cadre)        — le RÉFRACTEUR sur le carton, et un cadre de métal
 *                        épais, biseauté, tout autour ;
 *   hors (Hors-cadre)  — la photo sort de sa fenêtre et prend toute la carte ;
 *   rare (Or)          — le cadre et le nom en feuille d'or, la lumière
 *                        dorée qui suit la main, la RELIQUE (un carré de
 *                        chandail aux couleurs du club, tissé) ;
 *   legendaire (Holo)  — le cadre en prisme qui tourne, le nom irisé,
 *                        l'arc-en-ciel qui balaie la carte et le TIRAGE
 *                        numéroté (« 07/25 »). Pas de signature (JP : *c'est laid*).
 * Le tout reste sous les mots : on lit d'abord, on brille ensuite.
 *
 * c : { serie, edition, portraitHtml, actionSrc, cadre, pos, posClasse, gemmeHtml,
 *       rubanHtml, nomHtml (`formatName`), nomLettres (le nom de famille, pour
 *       la taille de la plaque), nomClasse, logoHtml, club, clubNom, numero,
 *       annee, tirage, clubClasse, eclat }
 */
/*
 * LE DOS DU CARTON (oct. 2026, JP : *chaque série de cartes, joueur et personnel, devrait avoir un style qui fitte des
 * deux bords*). Le verso pose son texte sur la même coque que le recto — le carton de la série, son cadre, ses ornements,
 * le métal de son édition, aux couleurs du club — sans la photo ni la plaque : le pourtour d'un dos est celui de sa face.
 */
export function dosDeCarton(serie, editionDe, couchee = false) {
  const s = SERIES[serie] ? serie : serieDe('');
  const r = edition(editionDe);
  // Le dos d'une carte couchée est couché aussi : le carton de sa série, à plat, son métal.
  if (couchee) return aPlat(`<span class="carton carton-couchee tc-${r} carton-dos" aria-hidden="true"><span class="cc-carte cs-${s} tc-${r}">
    ${r === 'peu' ? '<span class="carton-fini"></span>' : ''}
    <span class="carton-deco"></span>
    ${r === 'rare' || r === 'legendaire' ? '<span class="carton-lueur"></span>' : ''}
    ${brillante(r) ? '<span class="carton-cadre"></span>' : ''}
  </span></span>`);
  return `<span class="carton cs-${s} tc-${r} carton-dos" aria-hidden="true">
    ${r === 'peu' ? '<span class="carton-fini"></span>' : ''}
    <span class="carton-orne"><i></i><i></i><i></i></span>
    <span class="carton-deco"></span>
    ${r === 'rare' || r === 'legendaire' ? '<span class="carton-lueur"></span>' : ''}
    ${brillante(r) ? '<span class="carton-cadre"></span>' : ''}
  </span>`;
}
export function cartonHtml(c) {
  const serie = SERIES[c.serie] ? c.serie : serieDe('');
  const r = edition(c.edition);
  if (c.couchee) return carteCouchee(c, serie, r);
  const action = c.actionSrc
    ? `<img class="carton-action photo-cadree" src="${echapper(c.actionSrc)}"${styleCadre(c.cadre)} alt="" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
  return `<span class="carton cs-${serie} tc-${r}">
    ${r === 'peu' ? '<span class="carton-fini" aria-hidden="true"></span>' : ''}
    <span class="carton-orne" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="carton-photo">${action}${c.portraitHtml || ''}</span>
    <span class="carton-deco" aria-hidden="true"></span>
    ${r === 'rare' || r === 'legendaire' ? '<span class="carton-lueur" aria-hidden="true"></span>' : ''}
    ${brillante(r) ? '<span class="carton-cadre" aria-hidden="true"></span>' : ''}
    ${r === 'rare' ? '<span class="carton-relique" aria-hidden="true"><i>Relique</i></span>' : ''}
    <span class="carton-pos ${c.posClasse || ''}">${c.pos || ''}</span>
    ${c.rubanHtml || ''}${c.gemmeHtml || ''}
    <span class="carton-nom ${c.nomClasse || ''}" style="--n:${Math.max(4, c.nomLettres || 8)}">${c.nomHtml || ''}${c.clubNom ? `<span class="carton-club-nom">${c.clubNom}</span>` : ''}</span>
    <span class="carton-club ${c.clubClasse || ''}">${c.logoHtml || ''}<span class="carton-sigle">${c.club || ''}</span></span>
    <span class="carton-imprime"><b>Nº ${c.numero || ''}</b><span>${c.annee || ''}</span></span>
    ${r === 'legendaire' && c.tirage ? `<span class="carton-tirage">${c.tirage}</span>` : ''}
    ${c.eclat ? '<span class="cj-eclat" aria-hidden="true"></span>' : ''}
  </span>`;
}

/*
 * LA CARTE COUCHÉE (oct. 2026, JP : *cartes spéciales action horizontales quand t'as des photos qui gossent vertical* ;
 * *ces cartes doivent ressembler aux séries de leur année, pas être une série à part, c'est un upgrade de série
 * existante*). La carte de sa saison, couchée : le carton, le cadre, la plaque, les polices, le médaillon et les
 * encres de SA série (`.cs-…` sur la carte couchée), le métal de son édition ; seule la mise en page passe en paysage
 * (style.css, « LA CARTE COUCHÉE »). Dans une case (le vestiaire, un pack, un choix), elle se range tournée d'un
 * quart, comme une carte horizontale dans un classeur ; dans la fiche (`debout`), toute la case pivote et elle se lit
 * à l'endroit. Dans les deux, la case est une carte debout : ses tailles se prennent sur son petit côté.
 */
function carteCouchee(c, serie, r) {
  const carte = `<span class="carton carton-couchee tc-${r}"><span class="cc-carte cs-${serie} tc-${r}">
    ${r === 'peu' ? '<span class="carton-fini" aria-hidden="true"></span>' : ''}
    <span class="carton-orne" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="carton-photo"><img class="carton-action photo-couchee" src="${echapper(c.couchee)}"${styleCadre(c.cadreCouche)} alt="" loading="lazy" decoding="async" onerror="this.remove()">${c.portraitHtml || ''}</span>
    <span class="carton-deco" aria-hidden="true"></span>
    ${r === 'rare' || r === 'legendaire' ? '<span class="carton-lueur" aria-hidden="true"></span>' : ''}
    ${brillante(r) ? '<span class="carton-cadre" aria-hidden="true"></span>' : ''}
    ${r === 'rare' ? '<span class="carton-relique" aria-hidden="true"><i>Relique</i></span>' : ''}
    <span class="carton-pos ${c.posClasse || ''}">${c.pos || ''}</span>
    ${c.rubanHtml || ''}${c.gemmeHtml || ''}
    <span class="carton-nom ${c.nomClasse || ''}" style="--n:${Math.max(4, c.nomLettres || 8)}">${c.nomHtml || ''}${c.clubNom ? `<span class="carton-club-nom">${c.clubNom}</span>` : ''}</span>
    <span class="carton-club ${c.clubClasse || ''}">${c.logoHtml || ''}<span class="carton-sigle">${c.club || ''}</span></span>
    <span class="carton-imprime"><b>Nº ${c.numero || ''}</b><span>${c.annee || ''}</span></span>
    ${r === 'legendaire' && c.tirage ? `<span class="carton-tirage">${c.tirage}</span>` : ''}
    ${c.eclat ? '<span class="cj-eclat" aria-hidden="true"></span>' : ''}
  </span></span>`;
  return c.debout ? aPlat(carte) : carte;
}
/* À l'endroit : la case pivote d'un quart, la carte couchée en elle aussi ; le tout se lit à plat, en 7:5. */
const aPlat = carte => `<span class="carton-a-plat"><span class="carton-pivot">${carte}</span></span>`;

/*
 * LA POCHETTE SCELLÉE (V25 B2 ; au marché de la run en carte, js/run-scenes.js) : une plaque de métal au métal de son
 * pack (`--pk-a`, posé par l'écran), son icône au centre, son mot au pied. La pochette de récompense, qui luisait de sa
 * meilleure carte avant qu'on la déchire, est partie avec l'ancien Rogue (V28, tranche 4).
 */
export function pochetteHtml({ ico = '', mot = '' } = {}) {
  return `<span class="pochette pochette-scellee" aria-hidden="true"><span class="pochette-corps" aria-hidden="true">
      <span class="pochette-rabat pochette-haut"></span>
      <span class="pochette-face">
        <span class="pochette-ico">${ico}</span>
        <span class="pochette-serie">${esc(mot)}</span>
      </span>
      <span class="pochette-rabat pochette-bas"></span>
    </span></span>`;
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
const TOUR = [200, 340];
const GYRO_MAX = 6;
const PROPS = ['--mx', '--my', '--rx', '--ry', '--lueur'];
export function brancherInclinaison(doc = document) {
  if (!doc || doc.__inclinaison) return;
  doc.__inclinaison = true;
  const win = doc.defaultView || window;
  const calme = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  // Une carte de jeu se retourne d'un toucher, et revient d'un autre : les deux moitiés du tour (style.css, `cj-tourne-1/2`).
  doc.addEventListener('click', ev => {
    const f = ev.target.closest && ev.target.closest('button.tc-face');
    if (!f || f.matches('.tourne-1, .tourne-2')) return;
    const changer = () => { const v = !f.classList.contains('au-verso'); f.classList.toggle('au-verso', v); f.setAttribute('aria-pressed', String(v)); };
    if (calme.matches) { changer(); return; }
    f.classList.add('tourne-1');
    setTimeout(() => {
      f.classList.replace('tourne-1', 'tourne-2');
      changer();
      setTimeout(() => f.classList.remove('tourne-2'), TOUR[1]);
    }, TOUR[0]);
  });
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
  const RARES = '.carton:is(.tc-peu, .tc-hors, .tc-rare, .tc-legendaire), .choix-option.tc:is(.tc-rare, .tc-legendaire)';
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
