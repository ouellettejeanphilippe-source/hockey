/**
 * LE POSTE DE GÉRANT (S68) : une décision en plein écran, et les mots d'un joueur.
 *
 * JP : *c'est pas clair l'impact des trucs, aussi décisions dans modals plein
 * écran, tout devrait être clair*.
 *
 *   ouvrirChoix   UNE décision : un titre, un mot, et des options en cartes de
 *                 jeu qui disent chacune ce qu'elles donnent et ce qu'elles
 *                 coûtent
 *
 * Le module est aveugle au jeu : les données arrivent en arguments, et les
 * décisions repartent par rappel.
 */

import {
  badgesDe, PALIERS,
  getPlayerKey,
  physiqueDe, accordsDeLigne, EDITIONS_REGLEMENT,
} from './sim.js';
import { MOTS_DU_JOUEUR } from './effets.js';
import { carteHtml } from './cartes.js';
import { niveauJambes, ENERGIE_REF, CHIMIE_PIVOT } from './sim.js';
import { jouerSon } from './sons.js';
import { notable } from './mouvement.js';
import { TRAITS } from './traits.js';
import { esc, cap as majuscule } from './util.js';

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
/* Les lignes d'une option : ce qu'elle rapporte en vert, ce qu'elle coûte en rouge. */
const lignesDe = o => [...(o.bon ? [{ txt: o.bon, bon: true }] : []), ...(o.prix ? [{ txt: o.prix, bon: false }] : [])];

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

/* ======================================================================
   UNE DÉCISION, EN PLEIN ÉCRAN
   ====================================================================== */
let fermerChoixCourant = null;
const mouvementCalme = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Le temps d'une carte jouée, en millisecondes (style.css `choix-jouee`). */
const CARTE_JOUEE_MS = 200;
/* Le premier focus d'un choix : la face d'une carte de jeu, ou son « Prendre » (la carte elle-même n'est pas un bouton). */
const PREMIERE = 'button.tc-face, button.tc-prendre';
/**
 * spec : { ico, titre, recit, genre, cartes, lecture, options: [{ cle, niveau, ico, nom, type, texte, bon, prix }],
 *          fermable, motFermer, onChoix(cle), onFerme() }
 * Trois choix l'ouvrent : « Comment on joue » (des cartes à lire), ton identité (Sur table) et « Quitter le match ? »
 * (le plateau). Le paquet qui se déchire et sa pile, le lancer de dé, la scène d'une voix, le joueur nommé et la boîte
 * étaient à l'ancien Rogue : partis avec lui (V28, tranche 4).
 */
export function ouvrirChoix(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  m.innerHTML = `<div class="choix-sheet${spec.cartes ? ' choix-cartes' : ''}"${spec.genre ? ` data-genre="${esc(spec.genre)}"` : ''} role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
    <div class="choix-tete">
      <span class="choix-ico">${spec.ico || '❓'}</span>
      <div class="choix-titres"><div class="choix-titre">${esc(spec.titre)}</div></div>
      ${spec.fermable ? `<button type="button" class="close-btn choix-fermer" aria-label="${esc(spec.motFermer || 'Plus tard')}" title="${esc(spec.motFermer || 'Plus tard')}">✕</button>` : ''}
    </div>
    <div class="choix-corps">
      ${spec.recit ? `<p class="choix-recit">${esc(spec.recit)}</p>` : ''}
      <div class="choix-options choix-main donne">${spec.options.map((o, i) => {
        const mots = lignesDe(o);
        /*
         * IL N'Y A QU'UNE CARTE DE JEU (V25 B2 ; JP, 5 nov. : *trois petites côte à côte*) : chaque option est une carte, au
         * niveau de ce qu'elle offre ; sa forme (Cadeau, Échange) tient dans son type ; son verso dit ses lignes
         * (`pucesDeFace`) et ce qu'elle fait.
         */
        return carteHtml({
          cle: esc(o.cle), niveau: o.niveau, i, ico: o.ico, nomHtml: esc(o.nom), typeHtml: esc(typeAvecForme(o.type || '', formeDesMots(o, mots))),
          texteHtml: o.texte ? esc(o.texte) : '', pucesHtml: pucesDeFace(mots), lecture: !!spec.lecture,
        });
      }).join('')}</div>
    </div>
  </div>`;
  // Des cartes prennent tout l'écran ; une question (« Quitter le match ? ») reste une feuille.
  m.classList.toggle('feuille', !spec.cartes);
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  if (spec.cartes && !spec.lecture && spec.options.length) jouerSon('donne');
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    m.classList.remove('feuille');
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    if (!silencieux && spec.onFerme) spec.onFerme();
  };
  fermerChoixCourant = fermer;
  // UNE VUE À LIRE (S74, « Comment on joue ») : les cartes ne se prennent pas.
  let envoyee = false;
  m.querySelectorAll('[data-choix]').forEach(b => {
    if (spec.lecture) { b.classList.add('lecture'); return; }
    // Le geste est sur « Prendre » ; ce qui s'allume ou s'envole, c'est la carte entière.
    const carte = b.closest('.choix-option') || b;
    b.onclick = () => {
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
  for (const x of m.querySelectorAll('.choix-fermer')) x.onclick = () => fermer();
  pointsDeBande(m);
  const premier = m.querySelector(PREMIERE);
  if (premier) premier.focus({ preventScroll: true });
  return () => fermer(true);
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
// Sous le pivot (CHIMIE_PIVOT), une chimie coûte au lieu de rapporter : le mot le dit (V2.2, les coûts cachés).
const motChimie = c => (c >= 70 ? 'excellente' : c >= 45 ? 'bonne' : c >= CHIMIE_PIVOT ? 'correcte' : 'naissante, elle coûte');
/* Le résumé d'une ligne pour l'affiche du match (V18) : ses accords et sa chimie, en mots. */
export function resumeLignes(lineup, chimie) {
  return [0, 1, 2, 3].map(u => {
    const a = accordsDeLigne(lineup, u), c = chimie[u] || 0;
    return `<span class="gl-resume" title="${esc(NOMS_LIGNE[u])} : ${a.length ? esc(a.map(x => x.aff.nom).join(', ')) : 'aucun accord'} ; chimie ${motChimie(c)}">${u + 1}<small>${'•'.repeat(c >= 70 ? 3 : c >= 35 ? 2 : 1)}</small></span>`;
  }).join('');
}
