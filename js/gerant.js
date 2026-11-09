/**
 * LE POSTE DE GÉRANT (S68) : deux écrans plein écran.
 *
 * JP : *c'est pas clair l'impact des trucs, aussi décisions dans modals plein
 * écran, tout devrait être clair* ; *chaque ligne peut avoir stratégie
 * différente, qui doit fitter avec profils, style hockeyarena.net* ;
 * *pouvoir en tout temps changer les trios et cie et ça a un impact*.
 *
 *   ouvrirChoix   UNE décision : une histoire, le joueur visé s'il y en a un,
 *                 et des options qui disent chacune en CHIFFRES ce qu'elles
 *                 achètent, ce qu'elles coûtent, combien de matchs, et
 *                 quelles factions elles bougent
 *
 * Le module est aveugle au jeu : `ctx` porte l'échappement et les écussons,
 * les données arrivent en arguments, et les décisions repartent par rappel.
 */

import {
  badgesDe, PALIERS,
  MUTATIONS, getPlayerKey,
  physiqueDe, accordsDeLigne, EDITIONS_REGLEMENT,
} from './sim.js';
import { motsDeMutationEnChiffres, motsDeStats, lignesDeLaPiece } from './impact.js';
import { carteLigne } from './composants.js';
import { motsDe, motsDuPari, facesMot, MOTS_DU_JOUEUR } from './effets.js';
import { carteHtml, pochetteHtml, carteDePiece } from './cartes.js';
import { facesDuPari, niveauJambes, facteurEnergie, ENERGIE_REF, ENERGIE_EFFET, ENERGIE_BLESSURE, CHIMIE_PIVOT, GARDIEN_SUITE_LIBRE, GARDIEN_JAMBES_PAS, GARDIEN_USURE, GARDIEN_JAMBES_MIN } from './sim.js';
import { PLANS } from './greffes.js';
import { jouerSon } from './sons.js';
import { notable, pic } from './mouvement.js';
import { TRAITS } from './traits.js';
import { esc, cap as majuscule, glyphe, varsEquipe, nom } from './util.js';
import { getTeamBand, getTeamLogoHtml } from './logos.js';
import { PIECES, CASES_DU_BANC } from './pieces.js';
import { COACHS } from './coachs.js';
import { NIVEAUX, niveauSur } from './niveaux.js';

const $ = id => document.getElementById(id);
/* Une phrase qui suit un point commence par une majuscule. */

/* Les puces d'un effet : vert s'il aide, rouge s'il coûte, gris s'il ne fait que déplacer. */
export function puces(mots, detail = () => false) {
  return (mots || []).map((m, i) => `<span class="puce ${m.bon === true ? 'bon' : m.bon === false ? 'prix' : 'neutre'}${m.duree ? ' duree' : ''}${m.enMots ? ' en-mots' : ''}${detail(m, i) ? ' detail' : ''}">${esc(m.txt)}</span>`).join('');
}
/*
 * UN CHIFFRE À LA FOIS (V3, JP : *ya trop de stats dans les choix et cartes, trop d'information en même temps à
 * l'écran*). Une option montre d'abord ce qu'elle fait en mots (+ bon, − prix), ses gestes réels et sa durée, et
 * au plus DEUX chiffres de match : ce qu'elle rapporte et ce qu'elle coûte, en buts quand elle en change ; une
 * CARTE, aucun : sa face dit ses chiffres en mots (`enMots`). Les autres chiffres (« ≈ … ») restent
 * dans la page, en `.detail`, et se déplient d'un toucher pour tout le choix (« Les chiffres », `chiffresOuverts`).
 * Rien ne disparaît : ce que le moteur joue reste écrit, on choisit seulement quand le lire.
 */
// Un chiffre de match, en tête (« ≈ +0,2 but ») ou après son sujet (« Ton club : ≈ +1,5 but marqué »).
const estChiffre = m => /(^|: )(jusqu'à )?≈ |^Jusqu'à ≈ |, et ≈ /.test(String(m.txt || '')) || (m.cle === 'glace' && /≈ /.test(String(m.txt || '')));
function detailDe(mots) {
  const chiffres = mots.filter(estChiffre);
  const taux = m => m.cle === 'pctTir' || m.cle === 'pctArr';
  const meilleur = sens => chiffres.find(m => m.bon === sens && taux(m)) || chiffres.find(m => m.bon === sens) || null;
  // Un chiffre pour et un contre, au plus : ce que l'option rapporte et ce qu'elle coûte, le % au tir ou d'arrêts d'abord.
  const tete = [meilleur(true), meilleur(false)].filter(Boolean);
  if (!tete.length && chiffres[0]) tete.push(chiffres[0]);
  const garde = new Set(tete.map(m => `${m.cle}|${m.txt}`));
  return m => estChiffre(m) && !garde.has(`${m.cle}|${m.txt}`);
}
/** Des puces au bref : les chiffres de trop pliés, comme dans les options d'un choix. */
export const pucesEnBref = mots => puces(mots, detailDe(mots || []));
/*
 * UN CHIFFRE DIT EN MOTS (V3.4) : la face d'une carte dit ce qu'elle fait sans nombre (« Tu marques plus »,
 * « L'adversaire tire moins ») ; « Les chiffres » rend les nombres exacts à la place des mots.
 */
const MOTS_DU_CHIFFRE = {
  pctTir: ['Tu tires plus juste', 'Tu tires moins juste'], pctArr: ['Ton filet arrête plus', 'Ton filet arrête moins'],
  tir: ['Tu tires plus', 'Tu tires moins'], 'tir accordé': ['L\'adversaire tire plus', 'L\'adversaire tire moins'],
  punition: ['Plus de punitions', 'Moins de punitions'], coup: ['Plus de mises en échec', 'Moins de mises en échec'],
  blessure: ['Plus de blessures', 'Moins de blessures'], jambes: ['Les jambes s\'usent plus', 'Les jambes s\'usent moins'],
};
/* Le sujet d'un chiffre, lu dans son texte quand la ligne ne le porte pas (une condition, une ligne « Eux : »). */
const CLE_DU_TEXTE = [[/pt de précision/, 'pctTir'], [/pt d'arrêts/, 'pctArr'], [/tirs? contre/, 'tir accordé'], [/\btirs?\b/, 'tir'],
  [/punition/, 'punition'], [/mises? en échec/, 'coup'], [/blessure/, 'blessure'], [/jambe/, 'jambes']];
const cleDuTexte = t => (CLE_DU_TEXTE.find(([re]) => re.test(t)) || [])[1];
/* Ce qui leur arrive, dit de ton côté : leurs tirs sont ceux que tu accordes. Leur précision et leur % d'arrêts se disent d'eux. */
const VU_D_EUX = { tir: 'tir accordé', 'tir accordé': 'tir' };
const MOTS_D_EUX = {
  pctTir: ['Ils tirent plus juste', 'Ils tirent moins juste'], pctArr: ['Leur filet arrête plus', 'Leur filet arrête moins'],
  punition: ['Ils prennent plus de punitions', 'Ils prennent moins de punitions'], coup: ['Ils frappent plus', 'Ils frappent moins'],
  blessure: ['Plus de blessures chez eux', 'Moins de blessures chez eux'], jambes: ['Leurs jambes s\'usent plus', 'Leurs jambes s\'usent moins'],
};
const HAUT_EST_BON = { pctTir: true, pctArr: true, tir: true, 'tir accordé': false, blessure: false, jambes: false };
/* Chez eux, monter est mauvais pour toi. */
const HAUT_EST_BON_EUX = { pctTir: false, pctArr: false };
const minuscule = t => t.charAt(0).toLowerCase() + t.slice(1);
/* La taille d'un chiffre de match, pour mettre le plus gros devant. */
function ampleurDe(t) {
  const m = String(t).match(/≈ [+−]?(\d+(?:,\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}
function enMots(m) {
  const t = String(m.txt || ''), moins = /≈ −|de moins/.test(t);
  // La glace, en une puce : son sens (« Le haut joue plus »), rien quand elle bouge à peine.
  if (m.cle === 'glace') return /à peine/.test(t) ? null : [t.split(/ : |, /)[0], 'glace'];
  if (m.cle === 'lui') return [`${t.split(' : ')[0]} : ${moins ? 'moins' : 'plus'} de buts`, 'lui'];
  // Un pari dit ses deux issues, chacune en mots.
  if (/ — sinon : /.test(t)) {
    const [gagne, perd] = t.split(' — sinon : '), a = enMots({ txt: gagne }), b = enMots({ txt: `Sinon : ${perd}` });
    return a && b ? [`${a[0]} — ${minuscule(b[0])}`, a[1], null, false] : null;
  }
  // Une ligne à sujet (« Eux : ≈ … », « Si tu mènes après deux périodes : ≈ … ») garde son sujet ; une ligne qui
  // grandit (« Jusqu'à ≈ … avec 5 joueurs du Rhino habillés ») le dit en tête : « Avec 5 joueurs du Rhino habillés : … ».
  const j = t.indexOf('≈ '), grandit = t.match(/ (avec \d+ (?:cartes|joueurs) .*)$/);
  const avant = (j > 0 ? t.slice(0, j) : '').replace(/(^|: )jusqu'à $/i, '$1').trim();
  const sujet = grandit && !avant ? majuscule(grandit[1]) : avant.replace(/ :$/, '');
  const lie = !!avant && !avant.endsWith(':');   // « Si ta préparation rate : pas de malus, et ≈ … »
  const corps = (j >= 0 ? t.slice(j) : t).replace(grandit ? grandit[0] : /$^/, '');
  // Une ligne de plusieurs chiffres (« ≈ −0,3 tir …, ≈ +0,4 pt d'arrêts … ») se dit par un seul : un % au tir ou d'arrêts, sinon le plus gros.
  const bouts = corps.split(/, (?=≈ )/);
  const plusGros = l => [...l].sort((x, y) => ampleurDe(y) - ampleurDe(x))[0];
  const bout = bouts.length > 1 ? plusGros(bouts.filter(x => / pt /.test(x)).length ? bouts.filter(x => / pt /.test(x)) : bouts) : bouts[0];
  const bas = /≈ −|de moins/.test(bout), par = (bout.match(/ (par carte .*)$/) || [])[1];
  const cle = m.cle && bouts.length === 1 && !/^Eux/.test(sujet) ? m.cle : cleDuTexte(bout);
  // Le sens du bout choisi, quand la ligne en mêle plusieurs : plus de tirs est bon, plus de tirs accordés non.
  const bonDe = (c, haut = HAUT_EST_BON) => (bouts.length > 1 && haut[c] !== undefined ? haut[c] !== bas : m.bon);
  const dit = mot => {
    const avec = par ? `${mot} ${par}` : mot;
    if (lie) return `${avant} ${minuscule(avec)}`;
    return sujet && !['Eux', 'Ton club', 'Toi'].includes(sujet) ? `${sujet} : ${minuscule(avec)}` : avec;
  };
  if (/^Eux/.test(sujet)) {
    const mot = VU_D_EUX[cle] ? MOTS_DU_CHIFFRE[VU_D_EUX[cle]][bas ? 1 : 0] : MOTS_D_EUX[cle] ? MOTS_D_EUX[cle][bas ? 1 : 0] : null;
    return mot ? [dit(mot), VU_D_EUX[cle] || cle, VU_D_EUX[cle] ? bonDe(VU_D_EUX[cle]) : bonDe(cle, HAUT_EST_BON_EUX), !!grandit] : null;
  }
  const M = MOTS_DU_CHIFFRE[cle];
  return M ? [dit(M[bas ? 1 : 0]), cle, bonDe(cle), !!grandit] : null;
}
/* Les mots d'une carte : chaque chiffre dit aussi en mots (une fois chacun), le chiffre gardé pour « Les chiffres ». */
function enMotsEtChiffres(mots) {
  const vus = new Set(), out = [];
  for (const m of mots) {
    // Un joueur nommé (V11) : son mot court sur la face, la ligne chiffrée sous « Les chiffres ».
    if (m.cle === 'surLui') {
      if (!vus.has(m.mot)) { vus.add(m.mot); out.push({ txt: m.mot, bon: m.bon, cle: 'lui', enMots: true }); }
      out.push({ ...m, chiffre: true });
      continue;
    }
    if (!estChiffre(m) && m.cle !== 'lui' && m.cle !== 'glace') { out.push(m); continue; }
    const [txt, cle, bon = m.bon, grandit = false] = enMots(m) || [];
    if (txt && !vus.has(txt)) { vus.add(txt); out.push({ txt, bon, cle, ampleur: ampleurDe(m.txt), enMots: true, grandit }); }
    out.push({ ...m, chiffre: true });
  }
  return out;
}
/*
 * UNE CARTE, UNE IDÉE (V6, phase 4). JP : *je pense que les cartes sont trop complexes*. La face d'une carte dit au
 * plus FACE_MAX choses, en mots : ce qu'elle rapporte et ce qu'elle coûte, ce qui la définit d'abord (un geste, un
 * badge, le joueur visé), les buts ensuite ; sa durée se dit à part. Le reste — ses autres effets, ses chiffres de
 * match — attend « Les chiffres » (`.detail`). Rien ne disparaît : on choisit seulement quand le lire.
 */
export const FACE_MAX = 2;
const BRUIT = /à peine perceptible|ne changent pas/;
const poidsFace = m => (m.cle === 'rien' || BRUIT.test(m.txt) ? 5
  : !m.enMots ? (/^(Jusqu'à|Grandit|🔗)/.test(m.txt) ? 4 : 0) : m.grandit ? 4
  : m.cle === 'lui' ? 1 : m.cle === 'pctTir' || m.cle === 'pctArr' ? 2 : 3);
/** Ce qui se plie sur la face d'une carte (ses mots déjà passés par `enMotsEtChiffres`) : un prédicat pour `puces`. */
function pliDeFace(lus) {
  const face = (lus || []).filter(m => !m.chiffre && !m.duree && poidsFace(m) < 5)
    .sort((a, b) => poidsFace(a) - poidsFace(b) || (poidsFace(a) === 2 ? (b.ampleur || 0) - (a.ampleur || 0) : 0));
  // Un bon, un prix, ou ce qui n'est ni l'un ni l'autre : jamais deux fois le même sens.
  const tete = [];
  for (const m of face) if (tete.length < FACE_MAX && (m.bon === null || m.bon === undefined || !tete.some(x => x.bon === m.bon))) tete.push(m);
  return m => !!m.chiffre || (!m.duree && !tete.includes(m));
}
/*
 * L'IMPACT EN BARRES (oct. 2026). JP : *possible de montrer plus visuellement les impacts des cartes, genre graphique, ou
 * hexagone à la FIFA ?* Une carte change des stats de match par rapport à ton club sans elle : c'est un écart à une base,
 * donc une barre qui part du centre — à droite si ça t'aide, à gauche si ça te nuit, verte ou rouge, sa longueur à la
 * taille de l'écart (`ECHELLE_IMPACT` : la barre pleine). Le mot de la stat la nomme ; son chiffre exact paraît avec
 * « Les chiffres ». Seules les lignes sans condition deviennent des barres ; « Si tu mènes : … » reste une puce.
 */
const BARRES = {
  tir: ['Tirs', 2], 'tir accordé': ['Tirs contre', 2], pctTir: ['Précision', 2], pctArr: ['Arrêts', 2],
  punition: ['Punitions', 1], coup: ['Mises en échec', 5], blessure: ['Blessures', 4], jambes: ['Usure', 3],
};
const valeurDuChiffre = t => { const m = String(t).match(/^≈ ([+−])(\d+(?:,\d+)?)/); return m ? (m[1] === '−' ? -1 : 1) * parseFloat(m[2].replace(',', '.')) : null; };
/*
 * Hors d'une saison (pas de club pour lire le moteur), une carte se dit en canaux : « Tirs +23 % ». Ce sont aussi des
 * écarts : la barre pleine y vaut `PLEIN_CANAL` %. La précision adverse est le % d'arrêts vu de l'autre côté.
 */
const PLEIN_CANAL = 25;
const CANAL_DU_MOT = { Tirs: ['tir', 1], 'Précision': ['pctTir', 1], 'Précision adverse': ['pctArr', -1], Punitions: ['punition', 1], Blessures: ['blessure', 1], 'Usure des jambes': ['jambes', 1] };
function lireBarre(m) {
  if (m.chiffre && !/, (?=≈ )/.test(m.txt)) {
    const v = valeurDuChiffre(m.txt), cle = m.cle && BARRES[m.cle] ? m.cle : cleDuTexte(m.txt);
    return v != null && BARRES[cle] ? { cle, v, plein: BARRES[cle][1], txt: m.txt.replace(/^≈ /, '') } : null;
  }
  const c = !m.enMots && String(m.txt || '').match(/^(Tirs|Précision adverse|Précision|Punitions|Blessures|Usure des jambes) ([+−])(\d+) %$/);
  if (!c) return null;
  const [cle, sens] = CANAL_DU_MOT[c[1]];
  return { cle, v: sens * (c[2] === '−' ? -1 : 1) * Number(c[3]), plein: PLEIN_CANAL, txt: sens < 0 ? m.txt : `${c[2]}${c[3]} %` };
}
function barresDe(lus) {
  const par = new Map(), pris = new Set();
  for (const m of lus) {
    const l = lireBarre(m);
    if (!l) continue;
    const b = par.get(l.cle) || { cle: l.cle, v: 0, plein: l.plein, txt: [], bon: m.bon };
    b.v += l.v; b.txt.push(l.txt); par.set(l.cle, b); pris.add(m);
  }
  // Le plus gros effet d'abord : une carte étroite (la main du duel) n'en montre que deux, le reste avec « Les chiffres ».
  const part = b => Math.abs(b.v) / b.plein;
  return { barres: [...par.values()].sort((a, b) => part(b) - part(a)), pris };
}
const barresHtml = barres => (barres.length ? `<span class="impact" role="img" aria-label="${esc(barres.map(b => `${BARRES[b.cle][0]} ${b.txt.join(', ')}`).join(' · '))}">${barres.map(b => {
  const part = Math.max(0.06, Math.min(1, Math.abs(b.v) / b.plein)), sens = b.bon === true ? 'bon' : b.bon === false ? 'prix' : 'neutre';
  // À droite ce qui t'aide, à gauche ce qui te nuit ; sans sens (les punitions, les mises en échec), le signe décide.
  const droite = b.bon === true || (b.bon == null && b.v > 0);
  return `<span class="impact-l ${sens}"><span class="impact-k">${BARRES[b.cle][0]}</span><span class="impact-barre"><i class="${droite ? 'd' : 'g'}" style="--part:${(part * 100).toFixed(0)}%"></i></span><span class="impact-v puce detail">${esc(b.txt.join(', '))}</span></span>`;
}).join('')}</span>` : '');
/** La face d'une carte : ses stats en barres, le reste en puces — au plus FACE_MAX en mots, le reste plié sous « Les chiffres ». */
export const pucesDeFace = mots => {
  const lus = enMotsEtChiffres(mots || []), { barres, pris } = barresDe(lus);
  // Le mot d'une stat dite en barre (« Tu tires plus ») ne se redit pas en puce.
  const reste = lus.filter(m => !pris.has(m) && !(m.enMots && barres.some(b => b.cle === m.cle)));
  return barresHtml(barres) + puces(reste, pliDeFace(reste));
};
let CHIFFRES_OUVERTS = null;
export const chiffresOuverts = () => {
  if (CHIFFRES_OUVERTS === null) { try { CHIFFRES_OUVERTS = localStorage.getItem('cap82.chiffres') === '1'; } catch { CHIFFRES_OUVERTS = false; } }
  return CHIFFRES_OUVERTS;
};
/* « Les chiffres » : ouvrir ou plier, retenu d'un choix à l'autre (et dans « Tes cartes », js/inventaire.js). */
export function basculerChiffres() {
  CHIFFRES_OUVERTS = !chiffresOuverts();
  try { localStorage.setItem('cap82.chiffres', CHIFFRES_OUVERTS ? '1' : '0'); } catch { /* le choix vaut pour la session */ }
  return CHIFFRES_OUVERTS;
}
/*
 * LES LIGNES D'UNE CARTE (V25 B1b, B2) : celles de sa grammaire (js/effets.js `motsDe`), ce que sa mutation change, ses
 * lignes écrites (`mots`, les plans du duel), et, jusqu'à la tranche C, le `bon` et le `prix` écrits d'un avant-match ou
 * d'un choix de fil, en ligne verte et rouge comme les autres.
 */
const lignesDe = (o, { qui, cadre, joueur = null }) => [...motsDe(o, { qui, cadre: o.cadre || cadre, offert: o.offert || null }),
  ...(o.mutation ? motsDeMutationEnChiffres(o.mutation, joueur) : []), ...(o.mots || []),
  ...(o.bon && !o.rien ? [{ txt: o.bon, bon: true }] : []), ...(o.prix ? [{ txt: o.prix, bon: false }] : [])];
/* Ce que la carte dit à son verso hors de ses lignes : son texte, sa sous-ligne, sa mutation, l'enjeu d'un avant-match, « Rien ne change ». */
const versoDe = (o, sub) => [o.texte ? sub(o.texte) : '', o.sous ? sub(o.sous) : '', o.mutation ? esc(MUTATIONS[o.mutation].quoi) : '',
  o.enjeu ? '⚖ Après le match, l\'élan ou le contrecoup dure deux fois plus' : '', o.rien ? 'Rien ne change' : ''].filter(Boolean).join('<br>');

/*
 * CE QU'UN JOUEUR SAIT FAIRE, EN MOTS (S71). JP : *la carte des joueurs est
 * rendue trop complexe à lire* ; *pas besoin de stats chiffrées aussi
 * complexes*. Six barres chiffrées disaient tout et ne disaient rien : on
 * garde ses deux ou trois vrais rôles, avec un mot pour le niveau, et sa
 * carrure quand elle compte (le jeu physique en dépend).
 */
export const carrureDe = p => { const ph = physiqueDe(p); return ph >= 0.62 ? { ico: '🪨', mot: 'Costaud' } : ph <= 0.38 ? { ico: '🪶', mot: 'Léger' } : null; };
/*
 * UN BADGE, EN MOTS (refonte 1) : son icône, son nom, son palier — « 🎯 Sniper
 * Or » — et le trait qui le monte s'il en a un (« · Tir »). Le palier se lit
 * aussi à la couleur (`pal-1` à `pal-4`) : 🥉🥈🥇💎 nomment déjà les packs.
 */
export const motDuBadge = b => `${b.nom} ${PALIERS[b.palier].nom}`;
export const raisonDuBadge = b => (b.trait && TRAITS[b.trait] ? TRAITS[b.trait].short : '');
export const titreDuBadge = b => `${b.second ? (b.plein ? 'Son second badge (plein : sa carte brille)' : 'Son second badge (la moitié de son effet)') : 'Son badge'} : ${motDuBadge(b)} — lu dans ${b.mot}, ${b.gardien ? 'comparé aux gardiens de sa saison' : 'comparé aux joueurs de son poste, toutes saisons'}${b.trait ? ` ; ${raisonDuBadge(b)} le monte` : ''}. Il dit CE QU'IL FAIT au match ; sa zone dit où.`;
function rolesDe(p) {
  const bs = badgesDe(p);
  if (!bs.length) return '';
  const c = carrureDe(p);
  const puce = b => `<span class="puce badge pal-${b.palier}" title="${esc(titreDuBadge(b))}">${b.ico} ${esc(motDuBadge(b))}${b.trait ? ` · ${esc(raisonDuBadge(b))}` : ''}</span>`;
  return `<div class="gj-roles">${bs.map(puce).join('')}${c ? `<span class="puce neutre" title="Son physique : le jeu robuste lui ${c.ico === '🪨' ? 'réussit' : 'coûte des punitions'}">${c.ico} ${c.mot}</span>` : ''}</div>`;
}
/* L'ancien nom : la fiche l'appelle encore. */
export const barresProfils = rolesDe;
/* « Brodeur, Stevens et Niedermayer » : une liste de noms, en français. */
const listeNoms = ns => (ns.length <= 1 ? ns[0] || '' : `${ns.slice(0, -1).join(', ')} et ${ns[ns.length - 1]}`);
/* Une forme, un mot : ce qu'on lit avant les chiffres. Un cadeau n'est pas un échange. */
const CANAUX_FORME = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse'];
const aideCanal = (k, v) => (k === 'robustesse' ? v > 0 : (k === 'defense' || k === 'discipline' || k === 'blessure' || k === 'energie' ? v < 1 : v > 1));
function bitsDe(e, pourToi) {
  const out = [];
  if (!e) return out;
  for (const k of CANAUX_FORME) {
    const v = e[k];
    if (v == null) continue;
    if (k === 'robustesse' ? v === 0 : v === 1) continue;
    const bon = aideCanal(k, v);
    out.push(pourToi ? bon : !bon);
  }
  return out;
}
export function formeDe(o) {
  if (!o || typeof o !== 'object') return '';
  if (o.etiquette) return o.etiquette;
  if (o.pari) return 'Pari';
  if (o.gestes && Object.keys(o.gestes).some(k => k !== 'piece')) return 'Geste';
  // Ne rien faire se dit une fois, par sa puce (« Rien ne change ») : ni étiquette, ni « + Rien ne change » de plus.
  if (o.rien) return '';
  if (o.trou || (o.mutation && EDITIONS_REGLEMENT.includes(o.mutation))) return 'Règlement';
  if (EDITIONS_REGLEMENT.includes(o.cle)) return 'Règlement';
  const c = o.canaux || {};
  if (Array.isArray(c.F) || Array.isArray(c.D)) return 'Minutes';
  // Ce qui va au joueur nommé (`lui`) compte aussi : sa précision qui monte aide, ses buts accordés qui montent coûtent.
  // Ce que le moteur ne joue pas compte aussi (oct.) : des jetons gagnés ou payés, de l'espace sous le plafond. Le contrat de
  // télé (+2,5 M$) se lisait « Moindre mal ».
  const bits = [...bitsDe(c, true), ...Object.entries(o.lui || {}).filter(([k]) => MOTS_DU_JOUEUR[k]).map(([k, v]) => (MOTS_DU_JOUEUR[k][1] ? v > 1 : v < 1)),
    ...(o.jetons ? [o.jetons > 0] : []), ...(o.plafond ? [true] : [])];
  if (!bits.length) return '';
  if (bits.every(Boolean)) return 'Cadeau';
  if (bits.every(b => !b)) return 'Moindre mal';
  return 'Échange';
}
/*
 * L'ÉTIQUETTE SUIT LES LIGNES QU'ON LIT (oct., JP : *ça a aucun sens*). `formeDe` jugeait les canaux cachés : « Cadeau »
 * au-dessus d'un « −0,9 tir » rouge, parce qu'une défense qui ferme le jeu coûte aussi des tirs. Ce que l'option montre
 * décide : tout vert, un cadeau ; tout rouge, un moindre mal ; les deux, un échange. Les formes de structure (Pari,
 * Geste, Minutes, Plus tard, Règlement) restent ce qu'elles sont.
 */
const FORMES_LUES = ['Cadeau', 'Échange', 'Moindre mal', ''];
function formeDesMots(o, mots) {
  const forme = formeDe(o);
  if (!FORMES_LUES.includes(forme)) return forme;
  const bits = (mots || []).filter(m => m.bon === true || m.bon === false).map(m => m.bon);
  if (!bits.length) return forme;
  return bits.every(Boolean) ? 'Cadeau' : bits.every(b => !b) ? 'Moindre mal' : 'Échange';
}
function typeAvecForme(type, forme) {
  if (!forme) return type || '';
  if (!type) return forme;
  const m = /^(.*) · (\d+ élan|injouable)$/.exec(type);
  return m ? `${m[1]} · ${forme} · ${m[2]}` : `${type} · ${forme}`;
}

/* `ligne` (S80) : où il joue dans ton alignement (« 3e paire ») — on le dit, on ne le nomme pas par là. */
function enteteJoueur(p, ligne = '') {
  if (!p) return '';
  const barres = barresProfils(p);
  const marques = (p._mutCles || []).map(k => MUTATIONS[k] ? `<span class="puce neutre">${MUTATIONS[k].ico} ${esc(MUTATIONS[k].nom)}</span>` : '').join('');
  // V23, la nouvelle interface : le joueur sur la plaque de son club, son écusson devant.
  return `<div class="gj-joueur" style="${varsEquipe(getTeamBand(p.t))}"><div class="gj-joueur-nom">${getTeamLogoHtml(p.t, 28)}${esc(p.n)} <span>${esc(p.p)} · ${esc(p.t)} ${esc(p.s)}</span>${ligne ? ` <span class="gj-ligne">${esc(ligne)}</span>` : ''}</div>${marques ? `<div class="gj-marques">${marques}</div>` : ''}${barres}</div>`;
}

/* ======================================================================
   UNE DÉCISION, EN PLEIN ÉCRAN
   ====================================================================== */
let fermerChoixCourant = null;
/*
 * L'OUVERTURE D'UN PAQUET (S77). JP : *rends ça plus dynamique et beau*. Une
 * récompense (un gros match gagné, une série gagnée) arrive dans un PAQUET
 * scellé qui luit de la couleur de sa meilleure carte ; on le touche, le rabat
 * se déchire, et les cartes attendent en PILE (1.0, oct. ; JP : *ouverture de
 * pack, cartes plus grosses avec swipe ?*) : une à la fois, en grand, la
 * meilleure en DERNIER. On la glisse, on la touche, Entrée ou → : la suivante ;
 * « Tout voir » saute au bout. Puis le choix se fait comme avant : le contenu
 * était déjà décidé (la graine), la pile n'est qu'une façon de le
 * montrer. Une pochette ne s'ouvre qu'une fois : rouvrir le choix (« Voir la
 * récompense ») montre les cartes. Sous `prefers-reduced-motion`, la pile sans
 * pochette ni mouvement.
 */
// Le rang d'une option, pour l'ordre du retournement et la vedette d'une pochette : une carte de jeu par son niveau (0 à 4,
// js/niveaux.js), une carte de joueur par son édition (`hors` entre le Cadre et l'Or) ramenée à la même échelle (V25 B1).
const RANG_EDITION = { commune: 0, peu: 1, hors: 1.5, rare: 3, legendaire: 4 };
const rangDOption = o => (o.niveau != null ? o.niveau : RANG_EDITION[o.edition] || 0);
const PAQUETS_OUVERTS = new Set();
const DECHIRE = 460;             // ms du rabat qui se déchire
const mouvementCalme = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * spec : { ico, titre, irl, recit, joueur, options: [{ cle, nom, bon, prix, effet, duree, jauges,
 *          mutation, desactive }], fermable, motFermer, onChoix(cle), onFerme() }
 *   suite : la suite se dit en un vrai bouton sous les cartes (« Signer un joueur › »), pas seulement dans le ✕ (V8).
 */
/*
 * UN GROS MATCH AUX COULEURS DE L'ADVERSAIRE (1.0, oct.). JP : *matchs importants aux couleurs de
 * l'adversaire*. `couleurs` (le bandeau du club, js/logos.js `getTeamBand`) habille la tête de la feuille :
 * son fond, son encre, son liseré — l'avant-match, la main du soir, le deuxième entracte.
 */
const auxCouleurs = b => (b ? ` aux-couleurs" style="${varsEquipe(b)}` : '');
/*
 * LES JOUEURS NOMMÉS D'UN CHOIX : {nom} (le visé) et {noms} (ceux qu'un geste touche, S72), et où ils jouent
 * (S80, JP : *dire que x est sur la xième ligne*) : `ouDe(p)` rend « 3e paire », dit à côté du nom.
 */
function nommer({ joueur = null, joueurs = [], ouDe = null }) {
  const nom = joueur ? joueur.n : (joueurs && joueurs[0] ? joueurs[0].n : '');
  const ou = p => (typeof ouDe === 'function' && p ? ouDe(p) || '' : '');
  const noms = joueurs && joueurs.length ? listeNoms(joueurs.map(p => (ou(p) ? `${p.n} (${ou(p)})` : p.n))) : '';
  const sub = t => esc(String(t || '').replace(/\{nom\}/g, nom || 'ton joueur').replace(/\{noms\}/g, noms || 'tes joueurs'));
  return { nom, ou, noms, sub };
}
/*
 * UNE SCÈNE (Jalon M, js/scenes.js) : la réplique d'une voix entre guillemets, et le fait sous elle. Dans À faire, la
 * voix est déjà dans la bande du choix ; ailleurs (le duel), `voix` la dit en tête.
 */
function sceneHtml(sc, { voix = false } = {}) {
  return `<blockquote class="scene">${voix ? `<span class="scene-de">${glyphe(sc.de.ico)} ${esc(sc.de.nom)}</span>` : ''}<p class="scene-mot">« ${esc(sc.mot)} »</p><p class="scene-fait">${esc(sc.fait)}</p></blockquote>`;
}

/* Le temps d'une carte jouée, en millisecondes (style.css `choix-jouee`). */
const CARTE_JOUEE_MS = 200;
/* Le premier focus d'un choix : la face d'une carte de jeu, ou son « Prendre » (la carte elle-même n'est pas un bouton). */
const PREMIERE = 'button.tc-face, button.tc-prendre, button.tcj-signer';
/*
 * PRENDRE UNE PIÈCE (V27, tranche 5 ; la maquette 7 de docs/maquettes/v27.html). La bande de qui la donne (« Le prix du
 * rival », son écusson et ses couleurs ; « Boutique ») et « Choisis ta pièce », puis les pièces offertes en vraies cartes
 * de jeu, une ligne dessous ; toucher une carte la choisit. Banc plein : tes cinq pièces sous « Banc plein · Qui sort ? »,
 * toucher celle qui part, et la bande de l'échange (« Le mur → Le verrou part »). « Passer » est toujours là quand la
 * pièce est gratuite ; le ✕ (Échap) la laisse dans la boîte. `spec` : { k, club: { tag, nom }?, titre, offres: [cle],
 * banc: [cle], motPrendre, onPrendre(cle, sort), onPasser?, onFerme? }.
 */
export function ouvrirPiece(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const plein = spec.banc.length >= CASES_DU_BANC;
  let choisie = spec.offres.length === 1 ? spec.offres[0] : null, sort = null;
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    if (!silencieux && spec.onFerme) spec.onFerme();
  };
  const ligne = cle => { const l = lignesDeLaPiece(cle)[0]; return l ? `<span class="${l.bon === false ? 'fx-moins' : 'fx-plus'}">${esc(l.txt)}</span>` : ''; };
  const carte = (cle, data, on, cls = '') => carteLigne(carteDePiece(cle, { lecture: true }), data === 'pc' ? ligne(cle) : '',
    { cls: `pl-carte-touche${on ? ` ${cls}` : ''}`, attrs: ` data-${data}="${esc(cle)}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${esc(`${PIECES[cle].nom} : ${PIECES[cle].quandMot}`)}"` });
  const dessiner = () => {
    const pret = choisie && (!plein || sort);
    m.innerHTML = `<div class="choix-sheet pc-sheet" data-genre="piece" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
      <div class="pc-bande"${spec.club ? ` style="${varsEquipe(getTeamBand(spec.club.tag))}"` : ''}>
        ${spec.club ? `<i class="pc-ecu" aria-hidden="true">${getTeamLogoHtml(spec.club.tag, 140)}</i>` : ''}
        <span class="pc-k"><b>${esc(spec.k)}</b>${spec.club ? `<span>${getTeamLogoHtml(spec.club.tag, 16)}${esc(spec.club.nom)}</span>` : ''}</span>
        <span class="pc-titre">${esc(spec.titre)}</span>
        <button type="button" class="close-btn choix-fermer" aria-label="Plus tard" title="Plus tard">✕</button>
      </div>
      <div class="pc-corps">
        <div class="pl-grille pl-grille-3 pc-offres">${spec.offres.map(k => carte(k, 'pc', k === choisie, 'choisie')).join('')}</div>
        ${plein ? `<span class="pc-l"><span>Banc plein</span><b>Qui sort ?</b></span>
        <div class="pl-grille pl-grille-5 pc-banc">${spec.banc.map(k => carte(k, 'sort', k === sort, 'sort')).join('')}</div>
        <div class="pc-echange"><b>${choisie ? esc(PIECES[choisie].nom) : 'Ta pièce'}</b><svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M2 7h17l-5-5M19 7l-5 5"/></svg><span>${sort ? `${esc(PIECES[sort].nom)} part` : 'Qui sort ?'}</span></div>` : ''}
      </div>
      <div class="pc-boutons">${spec.onPasser ? '<button type="button" class="btn pc-passer">Passer</button>' : ''}<button type="button" class="btn gold pc-prendre"${pret ? '' : ' disabled'}>${esc(spec.motPrendre || 'Prendre')}</button></div>
    </div>`;
    const toucher = (sel, poser) => m.querySelectorAll(sel).forEach(b => {
      const faire = () => { poser(b.dataset.pc || b.dataset.sort); dessiner(); m.querySelector(`${sel}[aria-pressed="true"]`)?.focus(); };
      b.onclick = faire;
      b.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); faire(); } };
    });
    toucher('[data-pc]', k => { choisie = k; });
    toucher('[data-sort]', k => { sort = k; });
    m.querySelector('.choix-fermer').onclick = () => fermer();
    const passer = m.querySelector('.pc-passer');
    if (passer) passer.onclick = () => { fermer(true); spec.onPasser(); };
    m.querySelector('.pc-prendre').onclick = () => { if (!pret) return; fermer(true); jouerSon('joue'); notable(); spec.onPrendre(choisie, plein ? sort : null); };
  };
  dessiner();
  m.classList.remove('feuille');
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  fermerChoixCourant = fermer;
  (m.querySelector('[data-pc]') || m.querySelector('.pc-prendre')).focus({ preventScroll: true });
  return () => fermer(true);
}
export function ouvrirChoix(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const { nom, ou, noms, sub } = nommer(spec);
  const clePaquet = `${spec.titre}|${spec.options.map(o => o.cle).join(',')}`;
  const pile = spec.genre === 'recompense' && spec.cartes && !spec.lecture && spec.options.length > 0 && !PAQUETS_OUVERTS.has(clePaquet);
  const scellee = pile && !mouvementCalme();
  // L'ordre du retournement : la meilleure carte en dernier (l'ordre à l'écran ne bouge pas) ; à rareté égale, le meilleur joueur (`rang`, son niveau, S80).
  const ordre = spec.options.map((o, i) => i).sort((a, b) => rangDOption(spec.options[a]) - rangDOption(spec.options[b])
    || (spec.options[a].rang || 0) - (spec.options[b].rang || 0) || a - b);
  const rangDe = i => ordre.indexOf(i);
  const meilleure = spec.options.reduce((b, o) => (rangDOption(o) > rangDOption(b) ? o : b), spec.options[0] || {});
  // LE WALKOUT (1.0, oct.), comme FUT et HUT : la carte du pack — une holo, une or, un Phénomène — s'annonce avant de sortir.
  const vedette = scellee ? spec.options[ordre[ordre.length - 1]] : null;
  const walkout = vedette && vedette.walkout && (rangDOption(vedette) >= 3 || vedette.eclat) ? vedette.walkout : null;
  // Le genre dit CE QUE C'EST, à part du titre : un événement n'est pas le combat, le butin n'est pas l'événement.
  const BADGE = { evenement: 'Événement', recompense: 'Butin', entracte: 'Gros match' };
  // QUI LE DEMANDE (V21, la Boîte en plein écran) : la scène dit sa voix ; sans scène, la voix se dit sous le titre.
  const irl = spec.irl || (spec.de && spec.de.nom && !spec.scene ? `${spec.de.ico} ${spec.de.nom}` : '');
  const badgeTxt = spec.regle && spec.genre === 'evenement' ? 'Événement · Règlement' : (BADGE[spec.genre] || '');
  const badge = badgeTxt ? `<div class="choix-badge">${badgeTxt}</div>` : '';
  m.innerHTML = `<div class="choix-sheet${chiffresOuverts() ? ' chiffres' : ''}${spec.cartes ? ' choix-cartes' : ''}${scellee ? ' paquet-ferme' : pile ? ' paquet-pile' : ''}${auxCouleurs(spec.couleurs)}"${spec.genre ? ` data-genre="${esc(spec.genre)}"` : ''}${spec.boite ? ` data-msg="${esc(spec.boite.msg)}" data-maison="${esc(spec.boite.maison)}"` : ''} role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
    <div class="choix-tete">
      <span class="choix-ico">${spec.ico || '❓'}</span>
      <div class="choix-titres">${badge}<div class="choix-titre">${sub(spec.titre)}</div>${irl ? `<div class="choix-irl">${esc(irl)}</div>` : ''}</div>
      ${spec.fermable ? `<button type="button" class="close-btn choix-fermer" aria-label="${esc(spec.motFermer || 'Plus tard')}" title="${esc(spec.motFermer || 'Plus tard')}">✕</button>` : ''}
    </div>
    <div class="choix-corps">
      ${spec.scene ? sceneHtml(spec.scene, { voix: true }) : ''}
      ${spec.recit ? `<p class="choix-recit">${sub(spec.recit)}</p>` : ''}
      ${spec.joueur ? enteteJoueur(spec.joueur, ou(spec.joueur)) : ''}
      ${spec.contexte || ''}
      ${scellee ? `<div class="pochette-scene">${pochetteHtml({ n: spec.options.length, meilleure: meilleure.edition || NIVEAUX[niveauSur(meilleure.niveau)].cadre, serie: spec.titre })}</div>` : ''}
      <div class="choix-options choix-main${pile ? '' : ' donne'}${spec.compact ? ' compact' : ''}">${spec.options.map((o, i) => {
        const mots = lignesDe(o, { qui: noms || 'Ton joueur', cadre: spec.cadre, joueur: spec.joueur || null });
        /*
         * IL N'Y A QU'UNE CARTE DE JEU (V25 B2 ; JP, 5 nov. : *trois petites côte à côte*) : chaque option est une carte, au
         * niveau de ce qu'elle offre ; sa forme (Cadeau, Échange, Pari) tient dans son type, son visage ou son écusson dans
         * sa fenêtre, ses couleurs de club sur son carton ; son verso dit ses lignes (`pucesDeFace`) et ce qu'elle fait.
         */
        return carteHtml({
          cle: esc(o.cle), niveau: o.niveau, edition: o.edition, i, ico: o.ico, nomHtml: sub(o.nom), typeHtml: esc(typeAvecForme(o.type || '', formeDesMots(o, mots))),
          artHtml: o.art || o.visage || '', texteHtml: versoDe(o, sub), coinHtml: o.coin ? esc(o.coin) : '', style: o.couleurs || '',
          pucesHtml: pucesDeFace(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) }))) + (o.fenetre ? `<span class="puce neutre duree">${esc(o.fenetre)}</span>` : ''),
          desactive: o.desactive ? esc(o.desactive) : '',
          dos: pile, r: pile ? rangDe(i) : null, meilleure: pile && rangDe(i) === ordre.length - 1 && (rangDOption(o) >= 3 || !!o.eclat),
          joueurHtml: o.joueurHtml || '', vue: !!o.vue, motChoixHtml: o.motChoix ? esc(o.motChoix) : '', genreCarte: o.genreCarte, dessin: o.dessin, famille: o.famille,
          lecture: !!spec.lecture, classe: o.ouvre ? 'ouvre' : '',
        });
      }).join('')}</div>
      ${spec.options.length ? '' : `<p class="empty-msg">${esc(spec.vide || 'Rien ici.')}</p>`}
      <button type="button" class="choix-chiffres" aria-pressed="${chiffresOuverts()}" hidden>Les chiffres</button>
      ${spec.autres && spec.autres.length ? `<div class="choix-autres">${spec.autres.map((a, i) => `<button type="button" class="btn choix-autre" data-autre="${i}">${esc(a.mot)}</button>`).join('')}</div>` : ''}
      ${spec.suite ? `<button type="button" class="btn gold choix-fermer choix-suite">${esc(spec.motFermer || 'Continuer')} ›</button>` : ''}
    </div>
  </div>`;
  const FETE = spec.cartes || spec.genre === 'recompense' || spec.genre === 'main' || spec.genre === 'entracte' || spec.genre === 'coupe';
  // Un choix de la Boîte (`boite`) prend tout l'écran (V21 ; JP : *en plein écran, pas dans la boîte*) ; les autres décisions, la feuille.
  m.classList.toggle('feuille', !FETE && !spec.boite);
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  // Une pochette se tait tant qu'elle est scellée : ses sons sont ceux de l'ouverture.
  if (spec.cartes && !spec.lecture && !pile && spec.options.length) jouerSon(spec.genre === 'recompense' ? 'recompense' : 'donne');
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    m.classList.remove('feuille');
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    if (!silencieux && spec.onFerme) spec.onFerme();
  };
  fermerChoixCourant = fermer;
  // LES CHIFFRES (V3) : le bouton ne paraît que s'il y a des chiffres pliés, et le choix se retient d'un choix à l'autre.
  const btnChiffres = m.querySelector('.choix-chiffres');
  if (btnChiffres && m.querySelector('.puce.detail')) {
    btnChiffres.hidden = false;
    btnChiffres.onclick = () => {
      basculerChiffres();
      m.querySelector('.choix-sheet').classList.toggle('chiffres', CHIFFRES_OUVERTS);
      btnChiffres.setAttribute('aria-pressed', String(CHIFFRES_OUVERTS));
    };
  }
  // UNE VUE À LIRE (S74, « Mon deck ») : les cartes ne se prennent pas.
  let envoyee = false;
  m.querySelectorAll('[data-choix]').forEach(b => {
    if (spec.lecture) { b.classList.add('lecture'); return; }
    const o = spec.options.find(x => String(x.cle) === b.dataset.choix);
    // Le geste est sur « Prendre » ; ce qui s'allume ou s'envole, c'est la carte entière.
    const carte = b.closest('.choix-option') || b;
    b.onclick = () => {
      if (o && o.pari && typeof spec.lancer === 'function') { sceneDuDe(m, spec, o, sub, fermer); return; }
      // LA CARTE JOUÉE (V23) : elle s'envole le temps d'un geste, puis le choix part ; sous `prefers-reduced-motion`, tout de suite.
      if (envoyee) return;
      envoyee = true;
      const partir = () => { fermer(true); spec.onChoix(b.dataset.choix); };
      if (mouvementCalme()) { partir(); return; }
      carte.classList.add('jouee');
      jouerSon('joue');
      notable();
      setTimeout(partir, CARTE_JOUEE_MS);
    };
  });
  // LA CARTE D'UN JOUEUR OFFERT se touche pour voir sa fiche (`apercu` de l'option), sans le choisir (S78).
  const apercus = new Map(spec.options.filter(o => typeof o.apercu === 'function').map(o => [String(o.cle), o.apercu]));
  m.querySelectorAll('[data-apercu] .tcj-carte').forEach(el => {
    const voir = apercus.get(el.closest('[data-apercu]').dataset.apercu);
    if (!voir) return;
    el.onclick = () => voir();
    el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); voir(); } };
  });
  for (const x of m.querySelectorAll('.choix-fermer')) x.onclick = () => fermer();
  // LES AUTRES BUTINS (V5) : retirer ou améliorer une carte du deck, au lieu d'en prendre une — chacun ouvre son propre choix.
  for (const x of m.querySelectorAll('.choix-autre')) x.onclick = () => { fermer(true); spec.autres[+x.dataset.autre].ouvrir(); };
  pointsDeBande(m);
  if (pile) brancherPaquet(m, () => PAQUETS_OUVERTS.add(clePaquet), { walkout, scelle: scellee });
  const premier = scellee ? m.querySelector('.pochette') : pile ? null : m.querySelector(PREMIERE);
  if (premier) premier.focus({ preventScroll: true });
  return () => fermer(true);
}

/*
 * LE LANCER DE DÉ (1.0, oct.). JP : *courbe de bâton, faire modal avec lancé de dé et réponse, pas juste
 * dans boîte*. Une réponse risquée (un `pari`) ne se ferme pas d'un toucher : la fenêtre montre le dé et
 * ce qu'il faut (« sur 4, 5 ou 6 »), et « Lancer le dé » (Entrée) prend la décision. C'est à ce moment-là
 * que `spec.lancer(cle)` tire le sel de la décision et rend ce que le moteur en fera (`deDuPari`, js/sim.js) :
 * la face, et si ça passe. Le dé roule sur une suite de faces fixe — aucun hasard d'écran — et s'arrête
 * sur cette face-là. Une fois lancé, la décision est prise : « Continuer », le ✕ ou Échap la
 * remettent au moteur, jamais une autre réponse.
 */
const DE_PAS = [55, 55, 60, 70, 85, 105, 130, 165, 210];   // ms entre deux faces : le dé ralentit
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const deHtml = face => `<span class="de" data-face="${face}" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<i${PIPS[face].includes(i) ? ' class="on"' : ''}></i>`).join('')}</span>`;
function sceneDuDe(m, spec, o, sub, fermer, autre = () => ouvrirChoix(spec)) {
  const faces = facesDuPari(o.pari.chance);
  const corps = m.querySelector('.choix-corps');
  if (!corps) return;
  corps.innerHTML = `<div class="de-scene">
    <div class="de-choix">${o.ico ? `${o.ico} ` : ''}${sub(o.nom)}</div>
    <div class="de-besoin">🎲 Ça passe ${facesMot(faces)}</div>
    <div class="de-table">${deHtml(6)}</div>
    <div class="de-verdict" role="status" aria-live="polite"></div>
    <span class="choix-puces de-issue">${puces(motsDuPari(o.pari, spec.joueur ? spec.joueur.n : 'Ton joueur'))}</span>
    <div class="de-boutons">
      <button type="button" class="btn de-autre">Autre réponse</button>
      <button type="button" class="btn go de-lancer">Lancer le dé</button>
    </div>
  </div>`;
  const table = corps.querySelector('.de-table'), verdict = corps.querySelector('.de-verdict');
  let v = null, fini = false;
  const valider = () => { if (fini || !v) return; fini = true; fermer(true); v.valider(); };
  const poser = face => { table.innerHTML = deHtml(face); };
  const montrer = () => {
    const de = table.querySelector('.de');
    de.classList.add('pose', v.gagne ? 'gagne' : 'perd');
    const mots = motsDe(v.effet, { qui: spec.joueur ? spec.joueur.n : 'Ton joueur' });
    verdict.innerHTML = `<b>${v.face}</b> — ${v.gagne ? 'ça passe !' : 'raté.'}`;
    verdict.classList.add(v.gagne ? 'gagne' : 'perd');
    corps.querySelector('.de-issue').innerHTML = puces(mots.length ? mots : [{ txt: 'Rien ne change', bon: null }]);
    jouerSon(v.gagne ? 'recompense' : 'rate');
    notable();
    const b = corps.querySelector('.de-lancer');
    b.textContent = 'Continuer'; b.disabled = false; b.classList.add('de-suite');
    b.onclick = valider;
    b.focus({ preventScroll: true });
  };
  corps.querySelector('.de-autre').onclick = autre;
  const lancer = corps.querySelector('.de-lancer');
  lancer.onclick = () => {
    v = spec.lancer(o.cle);
    if (!v) { fermer(true); spec.onChoix(o.cle); return; }
    lancer.disabled = true;
    corps.querySelector('.de-autre').remove();
    // Lancé, la décision est prise : le ✕ et Échap la remettent au moteur.
    const croix = m.querySelector('.choix-fermer');
    if (croix) croix.onclick = valider;
    if (mouvementCalme()) { poser(v.face); montrer(); return; }
    jouerSon('de');
    // La suite de faces part de la face tirée et y revient : elle ne dépend que du résultat.
    const suite = DE_PAS.map((_, i) => ((v.face + DE_PAS.length - 1 - i) % 6) + 1);
    let t = 0;
    suite.forEach((f, i) => { t += DE_PAS[i]; setTimeout(() => { if (!fini && m.contains(table)) { poser(f); table.firstChild.classList.add('roule'); } }, t); });
    setTimeout(() => { if (!fini && m.contains(table)) { poser(v.face); montrer(); } }, t + 260);
  };
  lancer.focus({ preventScroll: true });
}

/*
 * CHOISIR DANS L'ALIGNEMENT (S80). JP : *le screen de choix pour les upgrades
 * et les remplacements sont à chier* ; *donne l'alignement, je clique sur le
 * joueur* ; *dire que x est sur la xième ligne*. « Qui sort ? » était une
 * liste de dix-neuf rangées — visage, nom, rôle, stats, « libère X $ » — où
 * l'on cherchait son troisième défenseur gauche en lisant des noms. Le choix
 * se fait maintenant DANS L'ALIGNEMENT, en petit : les quatre trios, les trois
 * paires, les gardiens et la réserve, chaque rangée titrée par ce qu'elle est
 * (« 1er trio », « 2e paire »), chaque case avec son visage, son nom et ses
 * positions. On voit OÙ joue chacun sans qu'on le nomme par sa case.
 *
 * Jalon U : chaque case est une rangée de la liste de signature, et un bouton par rangée décide
 *   SÉLECTION  (`onChoix`, `motConfirmer`) : le bouton prend la case ;
 *   APERÇU     (`onApercu`, `motBouton`) : le bouton ouvre quelque chose par-dessus (la fiche du joueur,
 *              retournée au verso) — l'action est là-bas.
 * Toucher la rangée ouvre la fiche du joueur (`fiche`). Une case qu'on ne peut pas prendre reste visible,
 * grisée, avec sa raison ; quand toute une rangée l'est pour la même raison, la raison se dit une fois, dans
 * son titre. Ce que le choix fait à chaque case se dit sur sa ligne (`barre(cle)`, sinon `note`).
 *
 * spec : { ico, titre, contexte, motFermer, motConfirmer | motBouton, fiche(p),
 *          rangees: [{ titre, cases: [{ cle, vide, p, rangee(dest, bouton) → html, rar, nom, pos, marque, note, ton, non, meilleure }] }],
 *          barre(cle) → html, onChoix(cle) | onApercu(cle), onFerme() }
 */
/*
 * LES SAUTS DE LIGNE (1.0, oct.). JP : *ajouter un bouton des lignes, et enlever la section de texte du haut*.
 * Neuf rangées ne tiennent pas dans un téléphone : une rangée de boutons, collée en haut du corps, va à la
 * ligne voulue — les mots de la zone (T1, P1…) ; le paragraphe d'explication est parti, la barre du bas dit
 * déjà ce que fait un toucher.
 */
const SAUT = { '1er trio': 'T1', '2e trio': 'T2', '3e trio': 'T3', '4e trio': 'T4', '1re paire': 'P1', '2e paire': 'P2', '3e paire': 'P3', Gardiens: 'G', 'Réserve': 'Rés.' };
export function ouvrirAlignement(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const apercu = typeof spec.onApercu === 'function';
  // La raison commune d'une rangée entière (« pas sa position ») se dit une fois, dans son titre…
  const communeDe = r => { const pleines = r.cases.filter(c => !c.vide); return pleines.length && pleines.every(c => c.non && c.non === pleines[0].non) ? pleines[0].non : ''; };
  // …et une fois pour toutes quand toutes les rangées grisées le sont pour la même (une carte de gardien : sept rangées).
  const communes = spec.rangees.map(communeDe).filter(Boolean);
  const partout = communes.length >= 3 && communes.every(x => x === communes[0]) ? communes[0] : '';
  const mot = esc(apercu ? spec.motBouton || 'Choisir' : spec.motConfirmer || 'Choisir');
  /*
   * EN RANGÉES, COMME LA SIGNATURE (Jalon U, JP : *refaire l'alignement plus comme la page signature*). Chaque joueur
   * est une rangée de la liste de signature (`c.rangee`, le `rangeeHtml` de js/repechage.js) : visage, salaire, chiffre clé, rôle ; sa ligne dit ce que
   * ce choix lui fait (`barre`, sinon `note`), ou pourquoi il ne peut pas (`non`) ; le bouton décide. Toucher la
   * rangée ouvre sa fiche (`fiche`). Une case libre qu'on peut prendre est une rangée sans visage.
   */
  const ligne = c => {
    if (c.vide) return `<p class="empty-msg small">Case vide${c.pos ? ` · ${esc(c.pos)}` : ''}</p>`;
    const dit = c.non ? `<span class="dest-bad">${esc(c.non)}</span>`
      : spec.barre ? spec.barre(c.cle) : `${c.marque ? '<span class="dest-warn">hors position</span> · ' : ''}<span class="${c.ton === 'bon' ? 'dest-ok' : c.ton === 'prix' ? 'dest-bad' : ''}">${esc(c.note || '')}</span>`;
    const dest = `<div class="pcard-dest aln-dit">${dit}</div>`;
    const bouton = `<button type="button" class="btn-sign aln-choisir"${c.non ? ' disabled' : ''}>${mot}</button>`;
    const classe = `pcard aln-ligne tc-${c.rar || 'commune'}${c.non ? ' locked' : ''}${c.meilleure ? ' meilleure' : ''}`;
    if (!c.rangee) return `<div class="${classe}" data-aln="${esc(c.cle)}"><div class="pcard-rangee"><span class="pcard-mug"></span><span class="pcard-qui"><b class="pcard-nom">${esc(c.nom)}</b><small>${esc(c.pos || '')}</small></span></div><div class="pcard-fiche">${dest}${bouton}</div></div>`;
    return `<div class="${classe}" data-aln="${esc(c.cle)}" style="${varsEquipe(c.p)}">${c.rangee(dest, bouton)}</div>`;
  };
  const rangee = r => {
    const commune = communeDe(r);
    return `<section class="aln-rangee${commune ? ' grisee' : ''}" data-rangee="${esc(r.titre)}">
      <h3 class="aln-titre">${esc(r.titre)}${commune && !partout ? ` <small>· ${esc(commune)}</small>` : ''}</h3>
      <div class="sig-liste">${r.cases.map(ligne).join('')}</div>
    </section>`;
  };
  m.innerHTML = `<div class="choix-sheet choix-aln" data-genre="alignement" data-mode="${apercu ? 'apercu' : 'choix'}" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
    <div class="choix-tete">
      <span class="choix-ico">${spec.ico || '🔁'}</span>
      <div class="choix-titres"><div class="choix-titre">${esc(spec.titre)}</div></div>
      <button type="button" class="close-btn choix-fermer" aria-label="${esc(spec.motFermer || 'Retour')}" title="${esc(spec.motFermer || 'Retour')}">✕</button>
    </div>
    <div class="choix-corps">
      ${spec.contexte || ''}
      ${partout ? `<p class="aln-grises">Grisées : ${esc(partout)}.</p>` : ''}
      <nav class="aln-sauts" aria-label="Aller à une ligne">${spec.rangees.map(r => `<button type="button" class="aln-saut" data-saut="${esc(r.titre)}">${esc(SAUT[r.titre] || r.titre)}</button>`).join('')}</nav>
      <div class="aln">${spec.rangees.map(rangee).join('')}</div>
    </div>
  </div>`;
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    if (!silencieux && spec.onFerme) spec.onFerme();
  };
  fermerChoixCourant = fermer;
  const cases = new Map(spec.rangees.flatMap(r => r.cases).filter(c => !c.vide).map(c => [c.cle, c]));
  m.querySelectorAll('.aln-ligne[data-aln]').forEach(el => {
    const c = cases.get(el.dataset.aln);
    const b = el.querySelector('.aln-choisir');
    if (b && !b.disabled) b.onclick = ev => {
      ev.stopPropagation();
      if (apercu) { spec.onApercu(c.cle); return; }
      fermer(true); spec.onChoix(c.cle);
    };
    if (c && c.p && spec.fiche) el.onclick = ev => { if (!ev.target.closest('button')) spec.fiche(c.p); };
  });
  m.querySelector('.choix-fermer').onclick = () => fermer();
  for (const x of m.querySelectorAll('.aln-saut')) x.onclick = () => m.querySelector(`.aln-rangee[data-rangee="${CSS.escape(x.dataset.saut)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  // La première rangée qu'on peut prendre se montre : une carte de gardien ouvre sur les gardiens, pas sur le 1er trio grisé.
  const premier = m.querySelector('.aln-choisir:not([disabled])');
  if (premier) {
    premier.focus({ preventScroll: true });
    const corps = m.querySelector('.choix-corps'), r = premier.getBoundingClientRect(), rc = corps.getBoundingClientRect();
    if (r.bottom > rc.bottom) premier.closest('.aln-rangee').scrollIntoView({ block: 'start' });
  }
  return () => fermer(true);
}

/*
 * La pochette en quatre temps, portés par des classes sur la feuille : `paquet-ferme`
 * (il luit, il attend), `paquet-dechire` (le rabat part, la pochette tremble),
 * `paquet-pile` (les cartes en pile, une à la fois, en grand), puis
 * `paquet-fini` : la bande des choix, comme avant. Tant que ce n'est pas fini,
 * un toucher n'importe où dans la feuille est intercepté (en capture) — il
 * ouvre, puis il passe à la carte suivante — pour qu'un doigt pressé ne prenne
 * pas une carte qu'il n'a pas vue. Le ✕ reste le ✕ : on peut passer sans ouvrir.
 *
 * LA PILE (1.0, oct.), comme Pokémon TCG Pocket et HUT : la carte du dessus en
 * grand, deux autres face cachée derrière elle. Elle se glisse (le doigt, la
 * souris), se touche, ou Entrée, Espace, → (A à la manette) ; un point par
 * carte dit où on en est. Les cartes passent dans l'ordre du retournement
 * (`--tc-r`), la meilleure en dernier ; « Tout voir » saute au bout. Ce sont
 * les cartes MÊMES de la bande, empilées : au bout, la bande reprend sa place,
 * avec ses boutons et ses décisions.
 *
 * LE WALKOUT (1.0, oct.). JP : *regarde comment d'autres jeux gèrent les cartes, les FUT et HUT*. Quand
 * le pack cache une holo, une or ou un Phénomène, FUT fait attendre : le drapeau, le poste, le club, puis
 * le joueur. Ici, la saison, le poste, l'écusson — trois temps de 650 ms juste avant que la carte du pack
 * monte sur la pile. Un toucher saute l'annonce.
 */
const WALKOUT_PAS = 650;
const GLISSE_SEUIL = 60;   // px : un glissé plus court revient en place
function brancherPaquet(m, ouvert, { walkout = null, scelle = true } = {}) {
  const feuille = m.querySelector('.choix-sheet');
  const bande = feuille && feuille.querySelector('.choix-main');
  if (!bande) return;
  const rangDe = c => Number(c.style.getPropertyValue('--tc-r')) || 0;
  const cartes = [...bande.children].sort((a, b) => rangDe(a) - rangDe(b));
  const n = cartes.length;
  let etat = scelle ? 'ferme' : 'pile', cur = 0, minuteur = 0, glisseA = 0, x0 = null, dx = 0;
  const points = m.querySelector('.choix-points');
  const tout = document.createElement('button');
  tout.type = 'button';
  tout.className = 'btn pile-tout';
  tout.textContent = 'Tout voir';
  tout.hidden = n < 2;
  (points || bande).after(tout);
  const poser = () => {
    cartes.forEach((c, k) => { c.dataset.pile = k < cur ? 'passee' : k - cur > 2 ? 'loin' : String(k - cur); });
    if (points) {
      points.hidden = n < 2;
      points.innerHTML = cartes.map((_, k) => `<i class="${k === cur ? 'on' : ''}"></i>`).join('');
    }
  };
  const montrer = () => {
    feuille.querySelector('.walkout')?.remove();
    etat = 'pile';
    poser();
    const rare = cartes[cur].matches('.tc-meilleure, .tc-rare, .tc-legendaire');
    jouerSon(rare ? 'recompense' : 'tap');
    // V23 G : la carte rare est un pic — la secousse et les particules sur la feuille, trois coups au téléphone.
    if (rare) pic(feuille);
  };
  const annoncer = () => {
    etat = 'walkout';
    poser();
    // Elle attend face cachée derrière l'annonce : son retournement et son éclat se jouent après.
    cartes[cur].dataset.pile = '1';
    const wo = document.createElement('div');
    wo.className = 'walkout';
    wo.setAttribute('aria-hidden', 'true');
    wo.innerHTML = `<span class="wo-pas">${walkout.saison}</span><span class="wo-pas">${walkout.pos}</span><span class="wo-pas wo-ecu">${walkout.logo}</span>`;
    feuille.appendChild(wo);
    [0, 1, 2].forEach(i => setTimeout(() => { if (etat === 'walkout') { wo.dataset.pas = String(i + 1); jouerSon(i < 2 ? 'tap' : 'valide'); } }, i * WALKOUT_PAS));
    minuteur = setTimeout(() => { if (etat === 'walkout') montrer(); }, 3 * WALKOUT_PAS + 300);
  };
  // La carte du pack s'annonce juste avant de monter sur la pile.
  const suivante = () => (walkout && cur === n - 1 ? annoncer() : montrer());
  const empiler = () => {
    clearTimeout(minuteur);
    feuille.classList.remove('paquet-ferme', 'paquet-dechire');
    feuille.classList.add('paquet-pile');
    bande.tabIndex = -1;
    bande.focus({ preventScroll: true });
    suivante();
  };
  const finir = () => {
    if (etat === 'fini') return;
    etat = 'fini';
    clearTimeout(minuteur);
    feuille.querySelector('.walkout')?.remove();
    feuille.classList.remove('paquet-ferme', 'paquet-dechire', 'paquet-pile');
    feuille.classList.add('paquet-fini');
    for (const c of cartes) { delete c.dataset.pile; c.style.removeProperty('--glisse'); }
    bande.removeAttribute('tabindex');
    bande.classList.add('donne');
    tout.remove();
    window.removeEventListener('keydown', clavier, true);
    ouvert();
    pointsDeBande(m);
    const premiere = feuille.querySelector(PREMIERE);
    if (premiere) premiere.focus({ preventScroll: true });
  };
  const avancer = (sens = 'g') => {
    if (etat === 'ferme') { ouvrir(); return; }
    if (etat === 'ouvre') { empiler(); return; }
    if (etat === 'walkout') { clearTimeout(minuteur); montrer(); return; }
    if (etat !== 'pile') return;
    if (cur >= n - 1) { finir(); return; }
    cartes[cur].dataset.sens = sens;
    cur++;
    suivante();
  };
  const ouvrir = () => {
    etat = 'ouvre';
    jouerSon('donne');
    feuille.classList.remove('paquet-ferme');
    feuille.classList.add('paquet-dechire');
    minuteur = setTimeout(empiler, DECHIRE);
  };
  feuille.addEventListener('click', ev => {
    if (etat === 'fini' || ev.target.closest('.choix-fermer')) return;
    ev.stopPropagation();
    ev.preventDefault();
    if (ev.target.closest('.pile-tout')) finir();
    // Le clic qui suit un glissé est le même geste : la carte est déjà passée.
    else if (performance.now() - glisseA > 350) avancer();
  }, true);
  // Le clavier, où que soit le focus (un toucher sur la tête l'a rendu à la page) : il passe avant les flèches de js/manette.js.
  const clavier = ev => {
    if (etat === 'fini' || !feuille.isConnected) { window.removeEventListener('keydown', clavier, true); return; }
    if (m.hidden || !['Enter', ' ', 'ArrowRight'].includes(ev.key) || ev.target.closest?.('.choix-fermer, .pile-tout')) return;
    ev.preventDefault();
    ev.stopPropagation();
    avancer();
  };
  window.addEventListener('keydown', clavier, true);
  // LE GLISSÉ : la carte du dessus suit le doigt (`--glisse`) ; assez loin, elle part de ce côté-là.
  bande.addEventListener('pointerdown', ev => {
    if (etat !== 'pile' || ev.button > 0) return;
    x0 = ev.clientX; dx = 0;
    bande.setPointerCapture?.(ev.pointerId);
    cartes[cur].classList.add('glisse');
  });
  bande.addEventListener('pointermove', ev => {
    if (x0 === null) return;
    dx = ev.clientX - x0;
    cartes[cur].style.setProperty('--glisse', String(Math.round(dx)));
  });
  const lacher = () => {
    if (x0 === null) return;
    x0 = null;
    const c = cartes[cur];
    c.classList.remove('glisse');
    if (Math.abs(dx) > 8) glisseA = performance.now();
    if (Math.abs(dx) >= GLISSE_SEUIL) avancer(dx < 0 ? 'g' : 'd');
    else c.style.removeProperty('--glisse');
  };
  bande.addEventListener('pointerup', lacher);
  bande.addEventListener('pointercancel', lacher);
  // Un visage est une image : la souris la traînerait (glisser-déposer) et le navigateur annulerait le glissé.
  bande.addEventListener('dragstart', ev => { if (etat !== 'fini') ev.preventDefault(); });
  if (!scelle) empiler();
}
export const choixOuvert = () => !!fermerChoixCourant;

/*
 * LES POINTS D'UNE BANDE DE CARTES (S74). Sur téléphone, une main se balaie :
 * sans repère, la deuxième carte qui dépasse à droite ne dit pas qu'il y en a
 * trois. Un point par carte, allumé sur celle qu'on regarde. Rien sur grand
 * écran, où toutes les cartes sont côte à côte (la bande ne défile pas).
 */
function pointsDeBande(m) {
  const bande = m.querySelector('.choix-main');
  if (!bande) return;
  const n = bande.children.length;
  let pts = m.querySelector('.choix-points');
  if (!pts) { pts = document.createElement('div'); pts.className = 'choix-points'; pts.setAttribute('aria-hidden', 'true'); bande.after(pts); }
  const maj = () => {
    const defile = bande.scrollWidth - bande.clientWidth > 4;
    pts.hidden = !defile || n < 2;
    if (pts.hidden) return;
    const pas = bande.children[1] ? bande.children[1].offsetLeft - bande.children[0].offsetLeft : bande.clientWidth;
    const i = Math.max(0, Math.min(n - 1, Math.round(bande.scrollLeft / (pas || 1))));
    pts.innerHTML = Array.from({ length: n }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  };
  bande.addEventListener('scroll', maj, { passive: true });
  maj();
}

/*
 * LA PASTILLE DE NIVEAU (1.0, les lignes). JP : *au lieu des photos, icônes et
 * cote générale à sa position dans l'alignement, ou quelque chose de même*.
 * Aucune cote ne s'affiche (règle ferme) : la pastille est son NIVEAU, son
 * rang dans sa vraie saison à son poste (js/niveaux.js). Le contrôleur la
 * branche, parce que lui seul connaît les saisons chargées.
 */
let pastilleNiveau = () => '';
export const brancherPastilleNiveau = f => { pastilleNiveau = f; };
/* Les jambes d'un joueur (sa fatigue, sur 100), en chiffre et en barre. Celles d'un gardien se comptent en départs de suite (C4). */
export function jambesHtml(e, { gardien = false } = {}) {
  const v = Math.round(e);
  const N = niveauJambes(v);
  const effet = Math.round((facteurEnergie({ energie: v }) - 1) * 1000) / 10;
  // UN GARDIEN N'A PAS LA RÈGLE DES PATINEURS (V2.2) : ses jambes tombent par départs de suite, et lui coûtent des buts accordés.
  const titre = gardien
    ? `Ses jambes ce matin, sur 100 : ${N.nom.toLowerCase()}. Un gardien les garde ${GARDIEN_SUITE_LIBRE} départs de suite ; ensuite il en perd ${GARDIEN_JAMBES_PAS} par départ, jamais sous ${GARDIEN_JAMBES_MIN}, et chaque ${GARDIEN_JAMBES_PAS} points perdus lui coûtent ${String(GARDIEN_USURE * 100).replace('.', ',')} % de buts accordés en plus.`
    : `Ses jambes ce matin, sur 100 : ${N.nom.toLowerCase()}. Chaque point sous ${ENERGIE_REF} lui coûte ${String(ENERGIE_EFFET).replace('.', ',')} % de lancers, de finition et de création, chaque point au-dessus lui en rend autant (ce matin : ${effet > 0 ? '+' : ''}${String(effet).replace('.', ',')} %) ; sous ${ENERGIE_BLESSURE}, il se blesse plus.`;
  return `<span class="jambes jambes-${N.cle}" title="${titre}"><span class="jambes-k">Jambes</span><b>${v}</b><i><span style="width:${v}%" class="${N.cle}"></span></i><em class="jambes-mot">${N.nom}</em></span>`;
}

/*
 * LA COURBE DES JAMBES (1.0, le suivi des jambes) : ses jambes au matin de chaque journée, lues dans
 * l'instantané du moteur (`team.jourLignes[j].energie`) jusqu'à la journée `jusqua`. Une journée où il
 * n'était pas du club coupe la courbe. Le trait pointillé est la ligne ordinaire (ENERGIE_REF).
 */
export function courbeJambes(team, p, jusqua = Infinity) {
  const cle = getPlayerKey(p), J = (team && team.jourLignes) || [];
  const v = [];
  for (let j = 0; j < Math.min(J.length, jusqua + 1); j++) { const e = J[j] && J[j].energie ? J[j].energie[cle] : undefined; v.push(Number.isFinite(e) ? e : null); }
  return v;
}
const COURBE_BAS = 50;   // le bas du dessin : sous 50, la courbe touche le fond
export function courbeJambesHtml(v, { large = false } = {}) {
  const pts = v.map((e, j) => (e == null ? null : [j, e]));
  const vus = pts.filter(Boolean);
  if (vus.length < 2) return '';
  const n = Math.max(1, v.length - 1);
  const y = e => ((100 - Math.max(COURBE_BAS, Math.min(100, e))) / (100 - COURBE_BAS) * 30).toFixed(1);
  let d = '', ouvert = false;
  for (const q of pts) { if (!q) { ouvert = false; continue; } d += `${ouvert ? 'L' : 'M'}${(q[0] / n * 100).toFixed(1)} ${y(q[1])}`; ouvert = true; }
  const fin = vus[vus.length - 1][1], bas = Math.min(...vus.map(q => q[1]));
  return `<span class="courbe-jambes${large ? ' large' : ''} jambes-${niveauJambes(fin).cle}" title="Ses jambes au matin de chaque journée : ${fin} ce matin, ${bas} au plus bas. Le pointillé : la ligne ordinaire, ${ENERGIE_REF}."><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="courbe-ref" d="M0 ${y(ENERGIE_REF)}H100"/><path class="courbe-trait" d="${d}"/></svg></span>`;
}

/* ======================================================================
   TES LIGNES SUR L'AFFICHE
   ====================================================================== */
const NOMS_LIGNE = ['1re ligne', '2e ligne', '3e ligne', '4e ligne'];
export const motDeFamille = z => (z >= 1.25 ? 'rare' : z >= 0.5 ? 'fort' : z > -0.5 ? 'ordinaire' : 'faible');
// Sous le pivot (CHIMIE_PIVOT), une chimie coûte au lieu de rapporter : le mot le dit (V2.2, les coûts cachés).
const motChimie = c => (c >= 70 ? 'excellente' : c >= 45 ? 'bonne' : c >= CHIMIE_PIVOT ? 'correcte' : 'naissante, elle coûte');
/* Le résumé d'une ligne pour l'affiche du match (V18) : ses accords et sa chimie, en mots. */
export function resumeLignes(lineup, chimie) {
  return [0, 1, 2, 3].map(u => {
    const a = accordsDeLigne(lineup, u), c = chimie[u] || 0;
    return `<span class="gl-resume" title="${esc(NOMS_LIGNE[u])} : ${a.length ? esc(a.map(x => x.aff.nom).join(', ')) : 'aucun accord'} ; chimie ${motChimie(c)}">${u + 1}<small>${'•'.repeat(c >= 70 ? 3 : c >= 35 ? 2 : 1)}</small></span>`;
  }).join('');
}

/*
 * UNE CARTE DE LA BANQUE, HORS D'UN CHOIX (Jalon U : un seul dessin). JP : *pas plein de designs différents pour des
 * fonctions pareilles*. L'inventaire montre la même face qu'un pack ou une main (`carteHtml`) ; `cache` : une carte
 * qu'on n'a pas encore (sa règle ne se lit pas).
 */
export const carteDeBanqueHtml = (o, { cache = false } = {}) => carteHtml({
  cle: esc(o.cle), niveau: o.niveau, edition: o.edition, i: 0, ico: o.ico, nomHtml: esc(o.nom), typeHtml: esc(typeAvecForme(o.type || '', formeDe(o))),
  texteHtml: cache ? 'Pas encore dans ta collection' : o.texte ? `<i class="tc-ambiance">${esc(o.texte)}</i>` : '', coinHtml: o.coin ? esc(o.coin) : '',
  pucesHtml: cache ? '' : pucesDeFace(o.mots), genreCarte: o.genreCarte, dessin: o.dessin, famille: o.famille, statique: true,
});
/*
 * LE DUEL, UN SEUL CHOIX (V27, tranche 6 ; la maquette 4 de docs/maquettes/v27.html ; docs/refonte-v27-6a.md). JP : *un seul
 * choix avant le match, mais le rival montre son jeu dès son annonce* ; *aucune décision d'entracte*. En tête, la languette du
 * duel (« Rival · Match 54 ») et les deux plaques aux couleurs des clubs, « VS » entre les deux ; la barre du pronostic ; leur
 * jeu (son style, son intention dominante) ; « Ton plan · 1 choix » et deux ou trois plans de ton banc en vraies cartes de jeu,
 * chacune son gain et son prix du match dessous ; « Ton match · aucun plan » ; ce que le duel rapporte et coûte ; « Au match ».
 * Rien n'est choisi d'avance : sans carte touchée, c'est Ton match.
 *
 * spec : { k, no, toi, eux ({ tag, nom, sous }), prono (ta chance, 0 à 1, ou null), jeu ({ mot, intention } ou null),
 *          plans (`plansDuDuel`, js/impact.js), gagne, perd (des lignes), onJouer({ plan }), onAuto (en séries) }
 */
/* Ta chance contre eux, en barre (le pronostic du jour), et ce que le duel rapporte et coûte : le choix du duel, l'élite du lundi. */
export const pronoHtml = (p, toi, eux) => `<div class="dl-prono" role="img" aria-label="${esc(`Ta chance : ${Math.round(p * 100)} %`)}" style="${varsEquipe(getTeamBand(eux))}"><b>${Math.round(p * 100)} %</b><span class="dl-barre"><i style="width:${Math.round(p * 100)}%;background:${getTeamBand(toi).bg}"></i></span><b>${100 - Math.round(p * 100)} %</b></div>`;
export const enjeuHtml = x => `<div class="dl-enjeu"><span class="dl-gagne"><b>Gagné</b>${x.gagne.map(esc).join('<br>')}</span><span class="dl-perd"><b>Perdu</b>${x.perd.map(esc).join('<br>')}</span></div>`;
export function ouvrirLeDuel(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  let pris = null;
  const fermer = () => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
  };
  const plaque = (x, cote) => `<span class="dl-plaque ${cote}" style="${varsEquipe(getTeamBand(x.tag))}">${getTeamLogoHtml(x.tag, 34)}<b>${esc(x.nom)}</b>${x.sous ? `<small>${x.sous}</small>` : ''}</span>`;
  const carte = x => {
    const PL = PLANS[x.cle], Pc = x.qui && x.qui.genre === 'piece' ? PIECES[x.qui.cle] : null, C = x.qui && x.qui.genre === 'coach' ? COACHS[x.qui.cle] : null;
    const qui = Pc ? Pc.nom : C ? 'Ton coach' : 'Ton banc';
    const mots = motsDeStats(x.stats, 4, { par: 'par match', dire: false });
    const plus = mots.find(l => l.bon === true), moins = mots.find(l => l.bon === false);
    const ligne = [plus && `<span class="fx-plus">${esc(plus.txt)}</span>`, moins && `<span class="fx-moins">${esc(moins.txt)}</span>`].filter(Boolean).join('') || '<span>à peine perceptible</span>';
    const suit = PL.vedette && x.vedette && x.colle ? ` ${nom(x.colle)} suit ${nom(x.vedette)}.` : '';
    return carteLigne(carteHtml({ cle: esc(x.cle), niveau: Pc ? Pc.cadre : 2, genreCarte: Pc ? Pc.genre : 'tactique', ico: PL.ico, nomHtml: esc(PL.nom), typeHtml: esc(qui), lecture: true }), ligne,
      { cls: `pl-carte-touche${pris === x.cle ? ' choisie' : ''}`, attrs: ` data-plan="${esc(x.cle)}" role="button" tabindex="0" aria-pressed="${pris === x.cle}" aria-label="${esc(`${PL.nom}, proposé par ${qui} : ${mots.map(l => l.txt).join(', ')}.${suit}`)}"` });
  };
  const dessiner = () => {
    const p = spec.prono;
    m.innerHTML = `<div class="choix-sheet dl-sheet" data-genre="duel" role="dialog" aria-modal="true" aria-label="${esc(`${spec.k} : ${spec.eux.nom}`)}">
      <div class="dl-tete">
        <span class="dl-k"><b>${esc(spec.k)}</b><span>${esc(spec.no)}</span></span>
        <div class="dl-plaques">${plaque(spec.toi, 'toi')}<span class="dl-vs" aria-hidden="true">VS</span>${plaque(spec.eux, 'eux')}</div>
        ${p != null ? pronoHtml(p, spec.toi.tag, spec.eux.tag) : ''}
        ${spec.jeu ? `<div class="dl-jeu"><span>Leur jeu : ${esc(spec.jeu.mot)}</span><span>${spec.jeu.intention.ico} ${esc(spec.jeu.intention.nom)}</span></div>` : ''}
      </div>
      <div class="dl-corps">
        <span class="dl-l"><span>Ton plan</span><b>1 choix</b></span>
        <div class="pl-grille pl-grille-3 dl-plans">${spec.plans.map(carte).join('')}</div>
        <button type="button" class="btn dl-tonmatch${pris ? '' : ' on'}" aria-pressed="${!pris}">Ton match · aucun plan</button>
        ${enjeuHtml(spec)}
      </div>
      <div class="pc-boutons">${spec.onAuto ? '<button type="button" class="btn dl-auto">Ton match, toute la série</button>' : ''}<button type="button" class="btn gold dl-jouer">Au match</button></div>
    </div>`;
    m.querySelectorAll('[data-plan]').forEach(b => {
      const faire = () => { pris = pris === b.dataset.plan ? null : b.dataset.plan; jouerSon('joue'); dessiner(); m.querySelector('[data-plan][aria-pressed="true"]')?.focus(); };
      b.onclick = faire;
      b.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); faire(); } };
    });
    m.querySelector('.dl-tonmatch').onclick = () => { pris = null; dessiner(); m.querySelector('.dl-tonmatch').focus(); };
    m.querySelector('.dl-jouer').onclick = () => { const x = spec.plans.find(y => y.cle === pris); fermer(); notable(); spec.onJouer({ plan: x ? x.plan : null }); };
    const auto = m.querySelector('.dl-auto');
    if (auto) auto.onclick = () => { fermer(); spec.onAuto(); };
  };
  dessiner();
  m.classList.remove('feuille');
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  jouerSon('donne');
  fermerChoixCourant = fermer;
  (m.querySelector('[data-plan]') || m.querySelector('.dl-jouer')).focus({ preventScroll: true });
  return () => fermer();
}
