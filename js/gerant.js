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
  badgesDe, PALIERS, motCourbe,
  MUTATIONS, getPlayerKey, PLANS_ADV, commentContrer, reglageDuPlan,
  physiqueDe, accordsDeLigne, EDITIONS_REGLEMENT,
} from './sim.js';
import { motsEnChiffres, motsDeMutationEnChiffres, motsDeStats } from './impact.js';
import { carteHtml, RARETES, paquetHtml } from './cartes.js';
import { CARTES_MATCH, ENERGIE_MAIN } from './combat.js';
import { flechesDe, INTENTIONS, PLANS, MOMENTS_SI, PREP_JUSTE, PREP_RATEE, grandirEffet, facesDuPari, niveauJambes, facteurEnergie, ENERGIE_REF, ENERGIE_EFFET, ENERGIE_BLESSURE, CHIMIE_PIVOT, GARDIEN_SUITE_LIBRE, GARDIEN_JAMBES_PAS, GARDIEN_USURE, GARDIEN_JAMBES_MIN } from './sim.js';
import { jouerSon } from './sons.js';
import { coachDeCarte } from './banque.js';
import { COACHS } from './coachs.js';
import { TRAITS } from './traits.js';
import { avecArticle } from './commentaire.js';
import { esc, cap as majuscule, glyphe, varsEquipe, nom } from './util.js';

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
/** Une tuile de choix montre au plus deux lignes de stats vertes ou rouges ; les autres se plient (« Les chiffres »). */
export const LIGNES_MAX = 2;
function detailDe(mots, { sobre = false } = {}) {
  const chiffres = mots.filter(estChiffre);
  const taux = m => m.cle === 'pctTir' || m.cle === 'pctArr';
  const meilleur = sens => chiffres.find(m => m.bon === sens && taux(m)) || chiffres.find(m => m.bon === sens) || null;
  // Un chiffre pour et un contre, au plus : ce que l'option rapporte et ce qu'elle coûte, le % au tir ou d'arrêts d'abord.
  const tete = [meilleur(true), meilleur(false)].filter(Boolean);
  if (!tete.length && chiffres[0]) tete.push(chiffres[0]);
  const garde = new Set(tete.map(m => `${m.cle}|${m.txt}`));
  const plie = m => estChiffre(m) && !garde.has(`${m.cle}|${m.txt}`);
  if (!sobre) return plie;
  // UNE TUILE SOBRE (V19, tranche 6 ; JP : un verbe, au plus deux lignes de stats) : deux lignes vertes ou rouges au plus, une de
  // chaque couleur d'abord (ce que l'option rapporte, ce qu'elle coûte). Un changement concret (la carte qui change, un geste, un
  // pari, un joueur nommé) passe avant un chiffre de club ; le reste se plie avec les chiffres, jamais perdu.
  const colore = m => m.bon === true || m.bon === false;
  const lues = mots.map((m, i) => ({ m, i })).filter(({ m }) => colore(m) && !plie(m));
  if (lues.length <= LIGNES_MAX) return plie;
  const rang = [...lues].sort((a, b) => estChiffre(a.m) - estChiffre(b.m));
  const gardees = new Set();
  for (const sens of [true, false]) { const x = rang.find(({ m }) => m.bon === sens); if (x) gardees.add(x.i); }
  for (const { i } of rang) if (gardees.size < LIGNES_MAX) gardees.add(i);
  return (m, i) => plie(m) || (colore(m) && !gardees.has(i));
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
 * CE QU'UNE CARTE FAIT, EN PUCES (S72). JP : *varie les cartes* ; *faut le
 * faire pour vrai*. Un cadeau n'a que du vert, un moindre mal que du rouge ;
 * un pari dit sa chance et ses deux issues, un investissement ce qui vient
 * plus tard, un geste réel qui il touche et ce qui lui arrive.
 */
const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
/* Les faces gagnantes d'un dé, les plus hautes : « sur 4, 5 ou 6 ». Jamais une cote. */
const facesMot = k => { const f = Array.from({ length: k }, (_, i) => 7 - k + i); return `sur ${f.length > 1 ? `${f.slice(0, -1).join(', ')} ou ${f[f.length - 1]}` : `un ${f[0]}`}`; };
function motsDAction(a, noms = '') {
  if (!a) return [];
  const qui = noms || 'le joueur visé';
  const out = [];
  if (a.absents) out.push({ txt: `👥 ${qui} au vestiaire ${plur(a.absents, 'match')} — un réserviste ou un rappelé joue`, bon: null });
  if (a.energie) out.push({ txt: `👥 ${qui} : jambes ${a.energie > 0 ? '+' : '−'}${Math.abs(a.energie)}`, bon: a.energie > 0 });
  if (a.energieTous) out.push({ txt: `👥 Toute l'équipe : jambes ${a.energieTous > 0 ? '+' : '−'}${Math.abs(a.energieTous)}`, bon: a.energieTous > 0 });
  if (a.gardienAux) out.push({ txt: `🧤 L'auxiliaire garde le filet ${plur(a.gardienAux, 'match')}`, bon: null });
  return out;
}
/*
 * UN PARI SE DIT D'UNE SEULE FAÇON (V19, tranche 6 ; JP : *une seule lecture des choix*) : le dé et sa chance, ce qu'il donne
 * s'il tombe, ce qu'il donne sinon — en vraies stats, une puce verte et une puce rouge. Les options, les cartes de route et les
 * dossiers passent tous par ici.
 */
function motsDuPari(pari, noms = '') {
  const issue = e => { const { duree, action, ...c } = e || {}; const m = [...motsEnChiffres(c, duree), ...motsDAction(action, noms)]; return m.length ? m.map(x => x.txt).join(', ') : 'rien'; };
  return [{ txt: `🎲 ${majuscule(facesMot(facesDuPari(pari.chance)))} : ${issue(pari.gagne)}`, bon: true }, { txt: `🎲 sinon : ${issue(pari.perd)}`, bon: false }];
}
function motsDeCarte(o, noms = '') {
  const out = [];
  if (o.action) out.push(...motsDAction(o.action, noms));
  if (o.lui) out.push(...motsSurLeJoueur(o.lui, noms || 'Ton joueur'));
  if (o.changeGardien) out.push({ txt: '🧤 L\'auxiliaire prend le filet', bon: null });
  if (o.gardienAux === true) out.push({ txt: '🧤 L\'auxiliaire au filet ce match-là', bon: null });
  if (o.enjeu) out.push({ txt: '⚖ Après le match, l\'élan ou le contrecoup dure deux fois plus', bon: null });
  if (o.pari) out.push(...motsDuPari(o.pari, noms));
  if (o.ensuite) {
    const { apres, duree, ...c } = o.ensuite;
    out.push({ txt: `⏳ Dans ${plur(apres || 0, 'match')} : ${motsEnChiffres(c, duree).map(x => x.txt).join(', ')}`, bon: true });
  }
  if (o.rien) out.push({ txt: 'Rien ne change', bon: null });
  return out;
}

/*
 * LE PLAN DE L'ADVERSAIRE (S70, V18), tel que le rapport d'éclaireur le lit :
 * ce qu'il fait, et si ta préparation l'a fait tomber.
 */
export function planAdverseHtml(cle, contre, { nomAdv = 'Ils', suite = '', prepJuste } = {}) {
  const P = PLANS_ADV[cle];
  if (!P) return '';
  return `<div class="plan-adv${contre ? ' contre' : ''}">
    <div class="plan-adv-t">${P.ico} Leur plan : <b>${esc(P.nom)}</b>${suite ? ` <small>${esc(suite)}</small>` : ''}</div>
    <div class="plan-adv-mot">${esc(P.mot)} <b>${esc(majuscule(reglageDuPlan(cle)))}</b>.</div>
    ${prepJuste === undefined ? `<div class="plan-adv-contre"><b>${contre ? '✓ Tu le contres' : '✗ Pas contré'}</b> · pour le contrer : ${esc(commentContrer(cle))}.</div>`
      : `<div class="plan-adv-contre ${prepJuste ? 'juste' : prepJuste === false ? 'ratee' : ''}"><b>${prepJuste ? '🎯 Ta préparation visait juste : leur plan est tombé' : prepJuste === false ? '💥 T\'as chié ta préparation' : 'Pas de préparation'}</b></div>`}
  </div>`;
}

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
/* Les canaux d'effet d'un objet : ce que motsEnChiffres sait dire. */
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
const canauxDe = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => CANAUX.includes(k)));
/*
 * CE QU'UNE RÉPONSE FAIT, EN MOTS DE MATCH (courriels et points de presse, js/vie-gm.js) : les chiffres de ses
 * canaux sur la durée, le changement de carte d'un joueur nommé, ses gestes, son pari. Les mêmes mots que les
 * options d'un dilemme (`ouvrirChoix`).
 */
export function motsDeReponse(o, { joueur = null, noms = '' } = {}) {
  const { duree, mutation, ...canaux } = o;
  return [...motsEnChiffres(canaux, Object.keys(canauxDe(canaux)).length ? duree : null), ...(mutation ? motsDeMutationEnChiffres(mutation, joueur) : []), ...motsDeCarte(o, noms)];
}
/* Une forme, un mot : ce qu'on lit avant les chiffres. Un cadeau n'est pas un échange. */
const CANAUX_FORME = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse'];
const CARTES_REGLEMENT = new Set(['sixGlace', 'courbeIllegale', 'paragraphe', 'filetDesert', 'retardement']);
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
function formeDeCarte(C, cle) {
  if (C.pari) return 'Pari';
  if (C.effet && (Array.isArray(C.effet.F) || Array.isArray(C.effet.D))) return 'Minutes';
  if (CARTES_REGLEMENT.has(String(cle || '').replace(/\+$/, ''))) return 'Règlement';
  const bits = [...bitsDe(C.effet, true), ...bitsDe(C.adv, false)];
  if (bits.length && bits.some(Boolean) && bits.some(b => !b)) return 'Échange';
  if (bits.length && bits.every(b => !b)) return 'Moindre mal';
  return '';
}
export function formeDe(o) {
  if (!o || typeof o !== 'object') return '';
  if (o.etiquette) return o.etiquette;
  if (o.pari) return 'Pari';
  if (o.ensuite) return 'Plus tard';
  if (o.action) return 'Geste';
  // Ne rien faire se dit une fois, par sa puce (« Rien ne change ») : ni étiquette, ni « + Rien ne change » de plus.
  if (o.rien) return '';
  if (o.trou || (o.mutation && EDITIONS_REGLEMENT.includes(o.mutation))) return 'Règlement';
  if (!(o.genreCarte || o.dessin) && EDITIONS_REGLEMENT.includes(o.cle)) return 'Règlement';
  if (o.genreCarte || o.dessin) {
    const cle = o.dessin || o.cle;
    const C = CARTES_MATCH[cle];
    return C ? formeDeCarte(C, cle) : '';
  }
  const src = o.effet || o;
  if (Array.isArray(src.F) || Array.isArray(src.D)) return 'Minutes';
  // Ce qui va au joueur nommé (`lui`) compte aussi : sa précision qui monte aide, ses buts accordés qui montent coûtent.
  // Ce que le moteur ne joue pas compte aussi (oct.) : des jetons gagnés ou payés, de l'espace sous le plafond. Le contrat de
  // télé (+2,5 M$) se lisait « Moindre mal ».
  const bits = [...bitsDe(src, true), ...Object.entries(src.lui || {}).filter(([k]) => MOTS_DU_JOUEUR[k]).map(([k, v]) => (MOTS_DU_JOUEUR[k][1] ? v > 1 : v < 1)),
    ...(o.gain ? [o.gain > 0] : []), ...(o.plafond ? [true] : [])];
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
export function enteteJoueur(p, ligne = '') {
  if (!p) return '';
  const barres = barresProfils(p);
  const marques = (p._mutCles || []).map(k => MUTATIONS[k] ? `<span class="puce neutre">${MUTATIONS[k].ico} ${esc(MUTATIONS[k].nom)}</span>` : '').join('');
  return `<div class="gj-joueur"><div class="gj-joueur-nom">${esc(p.n)} <span>${esc(p.p)} · ${esc(p.t)} ${esc(p.s)}</span>${ligne ? ` <span class="gj-ligne">${esc(ligne)}</span>` : ''}</div>${marques ? `<div class="gj-marques">${marques}</div>` : ''}${barres}</div>`;
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
 * montrer. Un paquet ne s'ouvre qu'une fois : rouvrir le choix (« Voir la
 * récompense ») montre les cartes. Sous `prefers-reduced-motion`, la pile sans
 * paquet ni mouvement.
 */
// `hors` est une édition de carte de joueur (js/rarete.js), entre le Cadre et l'Or.
const RANG_RARETE = { commune: 0, peu: 1, hors: 1.5, rare: 2, legendaire: 3 };
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
export function sceneHtml(sc, { voix = false } = {}) {
  return `<blockquote class="scene">${voix ? `<span class="scene-de">${glyphe(sc.de.ico)} ${esc(sc.de.nom)}</span>` : ''}<p class="scene-mot">« ${esc(sc.mot)} »</p><p class="scene-fait">${esc(sc.fait)}</p></blockquote>`;
}

/*
 * UNE OPTION, UN DESSIN (JP : *le UI est convoluted, ça pourrait être plus streamlined*). Le nom, sa forme (Cadeau,
 * Échange, Pari), ce qu'elle change en vraies stats sur une ligne, puis le bon et le prix en mots : le même bouton
 * pour un événement, la route de la semaine, le proprio, une carte de vestiaire et l'écran de la semaine.
 * `spec` donne les noms ({nom}, {noms}), le joueur visé et le cadre du match ; `classe`, `attr` et `on` laissent
 * chaque écran brancher son geste (`data-vest`, `data-semaine`) sans redessiner le bouton.
 */
export function optionHtml(o, spec = {}, { mots = null, classe = '', attr = '', on = false, plein = false } = {}) {
  const { nom, noms, sub } = nommer(spec);
  if (!mots) {
    const { duree: _d, ...canaux } = o.effet || o;
    mots = [...(o.rien ? [] : motsEnChiffres(canaux, Object.keys(canauxDe(canaux)).length ? o.duree : null, o.cadre || spec.cadre)), ...(o.mutation ? motsDeMutationEnChiffres(o.mutation, spec.joueur || null) : []), ...motsDeCarte(o, noms), ...(o.mots || [])];
  }
  const forme = formeDesMots(o, mots);
  const pucesHtml = `${puces(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) })), detailDe(mots, { sobre: !plein }))}${o.quand ? `<span class="puce neutre duree">${esc(o.quand)}</span>` : ''}`;
  return `<button type="button" class="choix-option${o.visage ? ' avec-visage' : ''}${classe ? ` ${classe}` : ''}${on ? ' on' : ''}" data-choix="${esc(o.cle)}"${attr ? ` ${attr}` : ''}${o.desactive ? ' disabled' : ''}${on ? ' aria-pressed="true"' : ''}>
    ${o.visage ? `<span class="choix-option-visage" aria-hidden="true">${o.visage}</span>` : ''}
    <span class="choix-option-nom">${o.ico ? `${o.ico} ` : ''}${sub(o.nom)}</span>
    ${forme ? `<span class="choix-forme">${esc(forme)}</span>` : ''}
    ${o.sous ? `<span class="choix-option-sous">${sub(o.sous)}</span>` : ''}
    ${pucesHtml ? `<span class="choix-puces">${pucesHtml}</span>` : ''}
    ${o.bon && !o.rien ? `<span class="choix-option-bon">+ ${sub(o.bon)}</span>` : ''}
    ${o.prix ? `<span class="choix-option-prix">− ${sub(o.prix)}</span>` : ''}
    ${o.mutation ? `<span class="choix-option-mut">${MUTATIONS[o.mutation].ico} ${esc(MUTATIONS[o.mutation].quoi)}</span>` : ''}
    ${o.desactive ? `<span class="choix-option-non">${esc(o.desactive)}</span>` : ''}
  </button>`;
}
/* Le premier focus d'un choix : une option, ou la face d'une carte de jeu (la carte elle-même n'est plus un bouton). */
const PREMIERE = 'button.choix-option:not([disabled]), button.tc-face';
export function ouvrirChoix(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const { nom, ou, noms, sub } = nommer(spec);
  const clePaquet = `${spec.titre}|${spec.options.map(o => o.cle).join(',')}`;
  const pile = spec.genre === 'recompense' && spec.cartes && !spec.lecture && spec.options.length > 0 && !PAQUETS_OUVERTS.has(clePaquet);
  const paquet = pile && !mouvementCalme();
  // L'ordre du retournement : la meilleure carte en dernier (l'ordre à l'écran ne bouge pas) ; à rareté égale, le meilleur joueur (`rang`, son niveau, S80).
  const ordre = spec.options.map((o, i) => i).sort((a, b) => (RANG_RARETE[spec.options[a].rarete] || 0) - (RANG_RARETE[spec.options[b].rarete] || 0)
    || (spec.options[a].rang || 0) - (spec.options[b].rang || 0) || a - b);
  const rangDe = i => ordre.indexOf(i);
  const meilleure = spec.options.reduce((b, o) => ((RANG_RARETE[o.rarete] || 0) > (RANG_RARETE[b] || 0) ? o.rarete : b), 'commune');
  // LE WALKOUT (1.0, oct.), comme FUT et HUT : la carte du pack — une holo, une or, un Phénomène — s'annonce avant de sortir.
  const vedette = paquet ? spec.options[ordre[ordre.length - 1]] : null;
  const walkout = vedette && vedette.walkout && ((RANG_RARETE[vedette.rarete] || 0) >= RANG_RARETE.rare || vedette.eclat) ? vedette.walkout : null;
  // Le genre dit CE QUE C'EST, à part du titre : un événement n'est pas le combat, le butin n'est pas l'événement.
  const BADGE = { evenement: 'Événement', recompense: 'Butin', entracte: 'Gros match' };
  const badgeTxt = spec.regle && spec.genre === 'evenement' ? 'Événement · Règlement' : (BADGE[spec.genre] || '');
  const badge = badgeTxt ? `<div class="choix-badge">${badgeTxt}</div>` : '';
  m.innerHTML = `<div class="choix-sheet${chiffresOuverts() ? ' chiffres' : ''}${spec.cartes ? ' choix-cartes' : ''}${paquet ? ' paquet-ferme' : pile ? ' paquet-pile' : ''}${auxCouleurs(spec.couleurs)}"${spec.genre ? ` data-genre="${esc(spec.genre)}"` : ''} role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
    <div class="choix-tete">
      <span class="choix-ico">${spec.ico || '❓'}</span>
      <div class="choix-titres">${badge}<div class="choix-titre">${sub(spec.titre)}</div>${spec.irl ? `<div class="choix-irl">${esc(spec.irl)}</div>` : ''}</div>
      ${spec.fermable ? `<button type="button" class="close-btn choix-fermer" aria-label="${esc(spec.motFermer || 'Plus tard')}" title="${esc(spec.motFermer || 'Plus tard')}">✕</button>` : ''}
    </div>
    <div class="choix-corps">
      ${spec.recit ? `<p class="choix-recit">${sub(spec.recit)}</p>` : ''}
      ${spec.joueur ? enteteJoueur(spec.joueur, ou(spec.joueur)) : ''}
      ${spec.contexte || ''}
      ${paquet ? `<div class="paquet-scene">${paquetHtml({ n: spec.options.length, meilleure, serie: spec.titre })}</div>` : ''}
      <div class="choix-options${spec.cartes ? ` choix-main${pile ? '' : ' donne'}` : ''}${spec.compact ? ' compact' : ''}">${spec.options.map((o, i) => {
        const { duree: _d, ...canaux } = o.effet || o;
        const mots = [...(o.rien ? [] : motsEnChiffres(canaux, Object.keys(canauxDe(canaux)).length ? o.duree : null, spec.cadre)), ...(o.mutation ? motsDeMutationEnChiffres(o.mutation, spec.joueur || null) : []), ...motsDeCarte(o, noms), ...(o.mots || [])];
        const forme = formeDe(o);
        // EN CARTES (S73) : le même choix, dans le costume d'une carte à collectionner. La forme tient dans le type, le visage ne bouge pas.
        if (spec.cartes) return carteHtml({
          cle: esc(o.cle), rarete: o.rarete, i, ico: o.ico, nomHtml: sub(o.nom), typeHtml: esc(typeAvecForme(o.type || '', forme)),
          artHtml: o.art || '', texteHtml: o.texte ? sub(o.texte) : (o.mutation ? esc(MUTATIONS[o.mutation].quoi) : ''),
          bonHtml: o.bon ? sub(o.bon) : '', prixHtml: o.prix ? sub(o.prix) : '', coinHtml: o.coin ? esc(o.coin) : '',
          // UNE CARTE SE LIT EN MOTS (V3, JP : *les cartes doivent être plus claires, quitte à pas mettre de stats*) :
          // sa face dit ce qu'elle fait (+ bon, − prix) ; ses chiffres de match attendent « Les chiffres ».
          pucesHtml: pucesDeFace(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) }))) + (o.quand ? `<span class="puce neutre duree">${esc(o.quand)}</span>` : ''),
          desactive: o.desactive ? esc(o.desactive) : '',
          dos: pile, r: pile ? rangDe(i) : null, meilleure: pile && rangDe(i) === ordre.length - 1 && ((RANG_RARETE[o.rarete] || 0) >= 2 || !!o.eclat),
          joueurHtml: o.joueurHtml || '', vue: !!o.vue, motChoixHtml: o.motChoix ? esc(o.motChoix) : '', genreCarte: o.genreCarte, dessin: o.dessin, famille: o.famille,
          lecture: !!spec.lecture,
        });
        return optionHtml(o, spec, { mots });
      }).join('')}</div>
      ${spec.options.length ? '' : `<p class="empty-msg">${esc(spec.vide || 'Rien ici.')}</p>`}
      <button type="button" class="choix-chiffres" aria-pressed="${chiffresOuverts()}" hidden>Les chiffres</button>
      ${spec.autres && spec.autres.length ? `<div class="choix-autres">${spec.autres.map((a, i) => `<button type="button" class="btn choix-autre" data-autre="${i}">${esc(a.mot)}</button>`).join('')}</div>` : ''}
      ${spec.suite ? `<button type="button" class="btn gold choix-fermer choix-suite">${esc(spec.motFermer || 'Continuer')} ›</button>` : ''}
    </div>
  </div>`;
  const FETE = spec.cartes || spec.genre === 'recompense' || spec.genre === 'main' || spec.genre === 'entracte' || spec.genre === 'coupe';
  m.classList.toggle('feuille', !FETE);
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  // Un paquet se tait tant qu'il est scellé : ses sons sont ceux de l'ouverture.
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
  m.querySelectorAll('[data-choix]').forEach(b => {
    if (spec.lecture) { b.classList.add('lecture'); return; }
    const o = spec.options.find(x => String(x.cle) === b.dataset.choix);
    b.onclick = () => {
      if (o && o.pari && typeof spec.lancer === 'function') { sceneDuDe(m, spec, o, sub, fermer); return; }
      fermer(true); spec.onChoix(b.dataset.choix);
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
  if (pile) brancherPaquet(m, () => PAQUETS_OUVERTS.add(clePaquet), { walkout, scelle: paquet });
  const premier = paquet ? m.querySelector('.paquet') : pile ? null : m.querySelector(PREMIERE);
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
    <span class="choix-puces de-issue"></span>
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
    const { duree, action, ...canaux } = v.effet || {};
    const mots = [...motsEnChiffres(canaux, Object.keys(canaux).length ? duree : null), ...motsDAction(action)];
    verdict.innerHTML = `<b>${v.face}</b> — ${v.gagne ? 'ça passe !' : 'raté.'}`;
    verdict.classList.add(v.gagne ? 'gagne' : 'perd');
    corps.querySelector('.de-issue').innerHTML = puces(mots.length ? mots : [{ txt: 'Rien ne change', bon: null }]);
    jouerSon(v.gagne ? 'recompense' : 'rate');
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
 * Le paquet en quatre temps, portés par des classes sur la feuille : `paquet-ferme`
 * (il luit, il attend), `paquet-dechire` (le rabat part, le paquet tremble),
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
    jouerSon(cartes[cur].matches('.tc-meilleure, .tc-rare, .tc-legendaire') ? 'recompense' : 'tap');
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

/* ======================================================================
   LE DÉPISTAGE ET TA PRÉPARATION (S76)
   ======================================================================
   JP : *contrer, ça devrait être un scouting de leur stratégie potentielles
   avec taux de succès, qui fait que parfois, t'as chié ta préparation*. Le
   rapport montre trois pistes et leurs chances (`depistageDe`, js/sim.js) ;
   on se prépare pour une. Les cartes de dépistage le resserrent : la vidéo
   RAYE une piste fausse (jamais la bonne — la moins probable d'abord), la
   filature dit la vraie. */
export function pistesDuRapport(dep, { planReel = null, ecarte = 0, revele = false } = {}) {
  if (!dep || !dep.length) return [];
  if (revele && planReel) return dep.map(x => ({ ...x, p: x.plan === planReel ? 100 : 0, ecarte: x.plan !== planReel }));
  const fausses = dep.filter(x => x.plan !== planReel).sort((a, b) => a.p - b.p);
  const rayees = new Set(planReel ? fausses.slice(0, ecarte).map(x => x.plan) : []);
  const tot = dep.filter(x => !rayees.has(x.plan)).reduce((a, x) => a + x.p, 0) || 1;
  return dep.map(x => (rayees.has(x.plan) ? { ...x, p: 0, ecarte: true } : { ...x, p: Math.round(100 * x.p / tot) }));
}
export function depistageHtml(pistes, { nomAdv = 'Eux', prep = [], choisir = false, fx = null, etape = '' } = {}) {
  if (!pistes || !pistes.length) return '';
  const qui = nomAdv === 'Eux' ? '' : ' ' + esc(avecArticle('de', nomAdv));
  const ligne = x => {
    const P = PLANS_ADV[x.plan];
    if (!P) return '';
    const on = prep.includes(x.plan);
    const corps = `<span class="dep-ico">${P.ico}</span><span class="dep-nom"><b>${esc(P.nom)}</b><small>${esc(reglageDuPlan(x.plan))}</small></span>
      <span class="dep-p">${x.ecarte ? '<b>✗</b>' : `<b>${x.p} %</b>`}<i style="--p:${x.p}%"></i></span>`;
    return choisir
      ? `<button type="button" class="dep-piste${on ? ' on' : ''}${x.ecarte ? ' ecarte' : ''}" data-plan="${x.plan}"${x.ecarte ? ' disabled' : ''}>${corps}<span class="dep-prep">${x.ecarte ? 'Écarté' : on ? '🎯 Préparé' : 'Me préparer'}</span></button>`
      : `<div class="dep-piste${x.ecarte ? ' ecarte' : ''}">${corps}</div>`;
  };
  // EN MOTS D'ABORD (V3) : ce que la préparation fait se dit en mots ; ses chiffres de match attendent « Les chiffres ».
  const lu = e => enMotsEtChiffres(motsEnChiffres(e));
  const mots = e => lu(e).filter(m => m.enMots).map(m => m.txt.charAt(0).toLowerCase() + m.txt.slice(1)).join(', ');
  const chiffres = e => lu(e).filter(m => m.chiffre).map(m => m.txt).join(' · ');
  const juste = `leur plan tombe${mots(PREP_JUSTE) ? ` : ${mots(PREP_JUSTE)}` : ''}${fx && fx.piege ? `, et le piège : ${mots(fx.piege)}` : ''}`;
  const justeN = [chiffres(PREP_JUSTE), fx && fx.piege ? chiffres(fx.piege) : ''].filter(Boolean).join(' · ');
  const rate = fx && fx.improvise ? `pas de malus, et l'improvisation : ${mots(fx.improvise)}` : mots(PREP_RATEE);
  const rateN = chiffres(fx && fx.improvise ? fx.improvise : PREP_RATEE);
  // `etape` (l'écran de combat) : le titre devient son étape ; la règle (vise juste, rate) reste visible sous les pistes.
  const regle = `<div class="dep-regle"><span class="puce bon">🎯 Vise juste : ${esc(juste)}</span>${justeN ? `<span class="puce bon detail">${esc(justeN)}</span>` : ''}<span class="puce prix">💥 Rate : ${esc(rate)}</span>${rateN ? `<span class="puce prix detail">${esc(rateN)}</span>` : ''}<span class="puce neutre">Sans préparation : rien ne change</span></div>`;
  return `<div class="depistage${choisir ? ' choisir' : ''}">
    ${etape || `<div class="gl-k">🔎 Le dépistage${qui} : leur plan probable</div>`}
    <div class="dep-pistes">${pistes.map(ligne).join('')}</div>
    ${choisir ? regle : ''}
  </div>`;
}

/* ======================================================================
   LE DECK DE MATCH (S74) : la main, le deck, les cartes en options
   ====================================================================== */
const GENRES_CARTE = { attaque: 'Attaque', defense: 'Défense', tactique: 'Tactique', synergie: 'Synergie', malediction: 'Malédiction' };
const DE_GENRE = { attaque: 'd\'attaque', defense: 'de défense', tactique: 'tactique', synergie: 'de synergie' };
/*
 * LA RÈGLE D'UNE CARTE, EN CHIFFRES (S76). JP : *des maths plus claires sur
 * les effets, comme dans un vrai deckbuilder*. Tout ce qu'une carte fait se
 * lit ici, déduit de ses champs — jamais écrit deux fois : « Tirs +6 % »,
 * « Eux : punitions +25 % », « Pige 2 cartes », « Écarte 1 plan ». En vert ce
 * qui t'aide, en rouge ce qui coûte. `regle` n'est écrite à la main que pour
 * une carte qui lit ta formation.
 */
/* Un effet de troisième période seulement : le tiers du match, dit « en 3e ». */
const EN_3E = { part: 1 / 3, par: 'en 3e' };
const QUI_DE_LA_CARTE = { vise: 'Le joueur qu\'ils visent', vedette: 'Ta vedette', brigadier: 'Ton meilleur défenseur' };
const QUI_COURT = { vise: 'Le visé', vedette: 'Ta vedette', brigadier: 'Ton défenseur' };
const MOTS_DU_JOUEUR = { lancers: ['ses tirs', true], finition: ['sa précision', true], creation: ['ses passes', true], defense: ['leur précision contre lui', false], blessure: ['ses blessures', false], arrets: ['les buts qu\'il accorde', false] };
/* Sur la face, sans chiffre et court (une carte de la main a la largeur d'un pouce) : « Le visé : tire plus juste ». */
const FACE_DU_JOUEUR = { lancers: ['tire plus', 'tire moins'], finition: ['tire plus juste', 'tire moins juste'], creation: ['passe plus', 'passe moins'],
  defense: ['plus facile à battre', 'plus dur à battre'], blessure: ['se blesse plus', 'se blesse moins'], arrets: ['accorde plus', 'accorde moins'] };
/*
 * Ce qui bouge chez un joueur nommé (V11), un canal par ligne : « Ton joueur : sa précision +80 % » aux règles, et
 * « Ton joueur : tire plus juste » sur la face (`mot`, lu par `enMotsEtChiffres`).
 */
export const motsSurLeJoueur = (canaux, qui, quand = '', court = qui) => Object.entries(canaux).filter(([k]) => MOTS_DU_JOUEUR[k])
  .map(([k, v]) => ({ txt: `${qui} : ${MOTS_DU_JOUEUR[k][0]} ${flechesDe(v)}${quand ? `, ${quand}` : ''}`, bon: MOTS_DU_JOUEUR[k][1] ? v > 1 : v < 1,
    cle: 'surLui', mot: `${court} : ${FACE_DU_JOUEUR[k][v > 1 ? 0 : 1]}` }));
function regleDeCarte(C) {
  if (!C) return [];
  const out = [];
  /*
   * SON MOMENT D'ABORD (V10, js/cahier.js) : une réponse contre son intention, le temps de la période ; un coup de 3e,
   * en 3e ; une soirée, son soir. Hors de lui, elle ne fait rien. Ses chiffres se disent sur ce temps-là.
   */
  const M = C.si && MOMENTS_SI[C.si];
  const cadre = !M ? null : INTENTIONS[C.si] ? { part: 1 / 3, par: 'la période' } : M.duel ? EN_3E : null;
  if (M) out.push({ txt: INTENTIONS[C.si] ? `${M.mot} : elle la contre, le temps de la période` : `${M.mot} seulement`, bon: null });
  const txt = e => motsEnChiffres(e).map(m => m.txt).join(', ');
  // Ce qui s'ajoute à chaque carte (jouée, ou dans une main) : le chiffre de match d'un pas, dit « par carte … ».
  // Un pas trop petit pour un chiffre se dit à trois cartes (JP, 17 oct. : *encore beaucoup de « à peine perceptible »*).
  const fois = (e, n) => Object.fromEntries(Object.entries(e || {}).map(([k, v]) => [k, typeof v !== 'number' ? v : k === 'robustesse' ? v * n : v ** n]));
  const parCarte = (e, quand) => {
    const lu = (x, q) => motsEnChiffres(x, null, { par: q }).filter(y => y.cle !== 'rien').map(y => y.txt).join(', ');
    return lu(e, quand) || lu(fois(e, 3), quand.replace(/^par carte/, 'pour 3 cartes')) || `à peine perceptible ${quand}`;
  };
  if (C.plein) {
    // Une synergie : sa condition, puis ce qu'elle rapporte à son maximum, en chiffres de match pour ton club.
    const m = motsEnChiffres(C.plein).filter(x => x.cle !== 'rien');
    out.push({ txt: `${C.quand} : ${C.seuil ? '' : 'jusqu\'à '}${m.length ? m.map(x => x.txt).join(', ') : 'à peine perceptible'}`, bon: true });
  } else if (C.regle) out.push({ txt: C.regle, bon: C.maudite ? false : true });
  out.push(...motsEnChiffres(C.effet || null, null, cadre));
  // Une carte sur un joueur (V11) : qui, et ce qui bouge chez lui, en flèches (ses chiffres sont aux règles).
  if (C.joueur) {
    const { qui, ...canaux } = C.joueur;
    const quand = INTENTIONS[C.si] ? 'la période' : 'jusqu\'à la fin du match';
    out.push(...motsSurLeJoueur(canaux, QUI_DE_LA_CARTE[qui], quand, QUI_COURT[qui]));
  }
  for (const m of motsEnChiffres(C.adv || null, null, { ...(cadre || {}), eux: true })) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  /*
   * LES DEUX COURBES (S80, js/sim.js `echelleTardive`) : une carte qui vise
   * l'adversaire GRANDIT (×1,5 au dernier soir de la saison, ×2 en finale) ;
   * une carte de trio — une synergie, les minutes des lignes — est pleine tout
   * de suite et ne grandit pas.
   */
  const courbe = motCourbe();
  if (courbe && C.adv) out.push(courbe);
  else if (courbe && (C.synergie || (C.effet && (C.effet.F || C.effet.D)))) out.push({ txt: '🔗 Carte de trio : pleine tout de suite, elle ne grandit pas', bon: null });
  if (C.pioche) out.push({ txt: `Pige ${C.pioche} carte${C.pioche > 1 ? 's' : ''}`, bon: true });
  if (C.energiePlus) out.push({ txt: `+${C.energiePlus} élan`, bon: true });
  if (C.energieTous) out.push({ txt: `Tes patineurs : jambes +${C.energieTous}`, bon: true });
  if (C.lire) out.push({ txt: 'Leur plan tombe', bon: true });
  if (C.annule) out.push({ txt: 'Leur main ne fait rien', bon: true });
  if (C.ecarte) out.push({ txt: `🔎 Écarte ${C.ecarte} plan${C.ecarte > 1 ? 's' : ''} qu'ils ne joueront pas`, bon: true });
  if (C.revele) out.push({ txt: '🔎 Tu sais leur plan : ta préparation vise juste', bon: true });
  if (C.planB) out.push({ txt: '🎯 Tu te prépares pour 2 plans', bon: true });
  if (C.improvise) out.push({ txt: `Si ta préparation rate : pas de malus, et ${txt(C.improvise)}`, bon: true });
  if (C.piege) out.push({ txt: `Si ta préparation vise juste : ${txt(C.piege)} de plus`, bon: true });
  if (C.parGenre) out.push({ txt: parCarte(C.parGenre.effet, `par carte ${DE_GENRE[C.parGenre.genre] || ''} jouée ce match`), bon: true });
  if (C.selonLeurMain) out.push({ txt: parCarte(C.selonLeurMain.effet, `par carte ${DE_GENRE[C.selonLeurMain.genre] || ''} dans leur main`), bon: true });
  if (C.siVide) out.push({ txt: `Si tu dépenses tout ton élan : ${txt(C.siVide)}`, bon: true });
  // 1.0 (J1-G) : un effet conditionnel au pointage après deux périodes — la carte dit sa condition.
  if (C.apres40) {
    for (const m of motsEnChiffres(C.apres40.siMene || null, null, EN_3E)) out.push({ ...m, txt: `Si tu mènes après deux périodes : ${m.txt}` });
    for (const m of motsEnChiffres(C.apres40.sinon || null, null, EN_3E)) out.push({ ...m, txt: `Sinon : ${m.txt}` });
  }
  if (C.rabais) out.push({ txt: `Tes cartes ${DE_GENRE[C.rabais] || ''} coûtent 1 de moins ce match`, bon: true });
  if (C.pari) out.push({ txt: `🎲 ${majuscule(facesMot(facesDuPari(C.pari.chance)))} : ${txt(C.pari.gagne)} — sinon : ${txt(C.pari.perd)}`, bon: null });
  if (C.enMain) for (const m of motsEnChiffres(C.enMain)) out.push({ ...m, txt: `Dans ta main : ${m.txt}` });
  if (C.injouable) out.push({ txt: 'Injouable', bon: false });
  if (C.epuise) out.push({ txt: '⌛ Épuisée : elle quitte ton deck après ce match', bon: null });
  return out;
}
/* La règle d'une carte de match, en mots : la face d'une carte de leur main (`optionDeCarteMatch`). */
const motsDeCarteMatch = regleDeCarte;
/* Une carte de LEUR main, en puces de ton point de vue : ce qui les aide est rouge pour toi. */
function motsDeCarteAdverse(C, echelle = 1) {
  if (!C) return [];
  const out = [];
  for (const m of (motsEnChiffres(C.effet || null, null, { eux: true }))) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  // Ce qui te vise grandit avec le soir, pour eux aussi (S80).
  for (const m of (motsEnChiffres(grandirEffet(C.adv || null, echelle)))) out.push({ txt: `Toi : ${m.txt}`, bon: m.bon });
  if (C.pari) out.push({ txt: `🎲 Leur pari, ${facesMot(facesDuPari(C.pari.chance))}`, bon: null });
  if (C.apres40) for (const m of motsEnChiffres(C.apres40.siMene || null, null, { ...EN_3E, eux: true })) out.push({ txt: `Eux, s'ils mènent après deux périodes : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  if (C.synergie) out.push({ txt: 'Lit leur formation', bon: null });
  if (C.parGenre) for (const m of motsEnChiffres(C.parGenre.effet, null, { eux: true, par: `par carte ${DE_GENRE[C.parGenre.genre] || ''} qu'ils jouent` }).filter(x => x.cle !== 'rien')) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  if (C.selonLeurMain) for (const m of motsEnChiffres(C.selonLeurMain.effet, null, { eux: true, par: `par carte ${DE_GENRE[C.selonLeurMain.genre] || ''} que TU joues` }).filter(x => x.cle !== 'rien')) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  if (C.energieTous) out.push({ txt: `Leurs patineurs : jambes +${C.energieTous}`, bon: false });
  return out;
}
/*
 * LEUR MAIN (S74) : les « intentions » de Slay the Spire. On la connaît avant
 * de jouer la sienne — c'est tout le jeu : répondre.
 */
export function mainAdverseHtml(cartes, { nomAdv = 'Eux', energie = ENERGIE_MAIN, echelle = 1 } = {}) {
  if (!cartes || !cartes.length) return '';
  return `<div class="main-adverse"><div class="gl-k">🂠 La main ${nomAdv === 'Eux' ? 'adverse' : esc(avecArticle('de', nomAdv))} ce soir${energie > ENERGIE_MAIN ? ` · <span class="main-adverse-fort" title="En fin de saison et dans les dernières rondes des séries, l'adversaire joue avec un élan de plus">⚡ ${energie} d'élan</span>` : ''}</div><div class="main-adverse-cartes">${cartes.map(c => {
    const C = CARTES_MATCH[c];
    return C ? `<span class="main-adverse-carte tc-${C.rarete}" title="${esc(C.texte)}"><b>${C.ico} ${esc(C.nom)}</b><span class="choix-puces">${puces(motsDeCarteAdverse(C, echelle))}</span></span>` : '';
  }).join('')}</div></div>`;
}
/* « · 🐝 Le Frelon », ou « · Neutre » : la couleur d'une carte, dite comme dans « Tes cartes ». */
const couleurDe = k => (COACHS[k] ? ` · ${COACHS[k].ico} ${COACHS[k].nom}` : ' · Neutre');
/* Une carte de match en option d'`ouvrirChoix` (une récompense, un retrait). */
export function optionDeCarteMatch(cle) {
  const C = CARTES_MATCH[cle];
  return {
    cle, rarete: C.maudite ? 'commune' : C.rarete, ico: C.ico, nom: C.nom,
    // La couleur de son coach, sur toute carte, le gros match compris (V6, phase 4).
    type: `${GENRES_CARTE[C.genre] || ''} · ${C.injouable ? 'injouable' : `${C.cout} élan`}${C.maudite ? '' : couleurDe(coachDeCarte(`match:${cle}`))}`,
    texte: C.texte, coin: C.injouable ? '✕' : String(C.cout), mots: motsDeCarteMatch(C), genreCarte: C.genre, dessin: cle,
  };
}
/*
 * UNE CARTE DE LA BANQUE, HORS D'UN CHOIX (Jalon U : un seul dessin). JP : *pas plein de designs différents pour des
 * fonctions pareilles*. L'inventaire montre la même face qu'un pack ou une main (`carteHtml`) ; `cache` : une carte
 * qu'on n'a pas encore (sa règle ne se lit pas).
 */
export const carteDeBanqueHtml = (o, { cache = false } = {}) => carteHtml({
  cle: esc(o.cle), rarete: o.rarete, i: 0, ico: o.ico, nomHtml: esc(o.nom), typeHtml: esc(typeAvecForme(o.type || '', formeDe(o))),
  texteHtml: cache ? 'Pas encore dans ta collection' : o.texte ? `<i class="tc-ambiance">${esc(o.texte)}</i>` : '', coinHtml: o.coin ? esc(o.coin) : '',
  pucesHtml: cache ? '' : pucesDeFace(o.mots), genreCarte: o.genreCarte, dessin: o.dessin, famille: o.famille, statique: true,
});
/*
 * LE DUEL (V9), en plein écran : l'enjeu, leur intention de la période et CE QUE TON ADJOINT PROPOSE (V17,
 * docs/refonte-v17.md) — deux ou trois plans nets, chacun en vraies stats de la période, et « Garder » ; la carte de
 * vestiaire dont on garde une, l'ajustement entre deux matchs de séries, la mise doublée avant la 3e. Toucher un plan
 * l'envoie : `onJouer` reçoit ta réponse (`{ plan, snap }` : le plan pris, ou null pour garder le tien ; la mise),
 * l'ajustement et la carte de vestiaire. Une carte de vestiaire qui est un pari se joue au dé d'abord (`sceneDuDe`).
 *
 * spec : { titre, sousTitre, recit, duel (specDuDuel), ajustements (séries : [{ cle, ico, nom, bon, prix, … }] ou null),
 *          enjeu(vestiaire) → html, vestiaire : { ico, titre, recit, joueurs, ouDe, cadre, options, pris,
 *          lancer(cle, args) → le dé d'un pari }, stats, couleurs, onAdjoint, onJouer(reponse, ajustement, vestiaire) }
 */
export function ouvrirDuel(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const D = spec.duel;
  let snap = false, aj = null;
  // UNE LIGNE, UNE FOIS RÉPONDU (Jalon M, B3) : la carte de vestiaire se plie dès qu'on y a répondu ; la toucher la rouvre.
  const ouverts = new Set();
  const V = spec.vestiaire || null, nV = V ? nommer(V) : null;
  let vest = V ? V.pris || null : null;
  const manque = () => (spec.ajustements && !aj ? 'Choisis ton ajustement' : V && !vest ? 'Choisis ta carte de vestiaire' : '');
  const dessiner = () => {
    // L'ÉCRAN NE REMONTE PAS quand on règle quelque chose (S80) : on reste où on lisait.
    const hauts = [m, m.querySelector('.choix-sheet'), m.querySelector('.choix-corps')].map(e => (e ? e.scrollTop : 0));
    const etapes = ['duel', V && 'vest', spec.ajustements && 'aj'].filter(Boolean);
    const etape = (k, txt) => `<div class="main-etape"><b>${etapes.indexOf(k) + 1}</b><span>${txt}</span></div>`;
    const pli = (k, txt) => `<button type="button" class="main-pli" data-deplier="${k}"><b>${etapes.indexOf(k) + 1}</b><span>${txt}</span><span class="main-pli-ouvrir" aria-hidden="true">›</span></button>`;
    const vestPris = V && vest && V.options.find(o => o.cle === vest);
    const vestiaire = vestPris && !ouverts.has('vest') ? pli('vest', `${V.ico} ${esc(V.titre)} · ✓ ${nV.sub(vestPris.nom)}`) : V ? `<div class="main-vestiaire">
      ${etape('vest', `${V.ico} ${esc(V.titre)} · garde une carte`)}
      ${V.recit ? `<p class="main-vest-recit">${nV.sub(V.recit)}</p>` : ''}
      <div class="main-vest-rang">${V.options.map(o => {
        const { duree: _d, ...canaux } = o;
        const mv = [...motsEnChiffres(canaux, Object.keys(canauxDe(canaux)).length ? o.duree : null, V.cadre), ...motsDeCarte(o, nV.noms)];
        return optionHtml({ ...o, desactive: V.pris && V.pris !== o.cle ? 'L\'autre est gardée' : o.desactive }, V, { mots: mv, classe: 'main-vest', plein: true, attr: `data-vest="${esc(o.cle)}"`, on: vest === o.cle });
      }).join('')}</div>
    </div>` : '';
    /*
     * CE QUE TON ADJOINT PROPOSE (V17). JP : *mon adjoint propose des ajustements à chaque période, j'en choisis un*.
     * Sa scène (la voix, sa réplique, le fait), puis ses plans en tuiles à coins vifs, chacun en vraies stats de la
     * période ; « Garder » laisse ton plan en force. Toucher une tuile joue la période.
     */
    const bloque = manque();
    const propositionsHtml = () => `<div class="duel-adjoint">
      ${D.scene ? sceneHtml(D.scene, { voix: true }) : ''}
      <div class="af-options duel-props">${[...D.propositions, D.garder].map(o => optionHtml({ ...o, ...(bloque ? { desactive: bloque } : {}) }, {}, { mots: o.mots || [], plein: true, classe: 'af-option duel-prop', attr: `data-prop="${esc(o.cle)}"` })).join('')}</div>
    </div>`;
    m.innerHTML = `<div class="choix-sheet choix-cartes main-sheet${chiffresOuverts() ? ' chiffres' : ''}${auxCouleurs(spec.couleurs)}" data-genre="main" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
      <div class="choix-tete">
        <span class="choix-ico">⚔</span>
        <div class="choix-titres"><div class="choix-badge">Gros match</div><div class="choix-titre">${esc(spec.titre)}</div>${spec.sousTitre ? `<div class="choix-irl">${esc(spec.sousTitre)}</div>` : ''}</div>
      </div>
      <div class="choix-corps">
        ${spec.recit ? `<p class="choix-recit">${esc(spec.recit)}</p>` : ''}
        ${spec.enjeu ? `<div class="main-enjeu choix-puces">${spec.enjeu(vest)}</div>` : ''}
        ${D.tete ? `<div class="duel-tete">${D.tete}</div>` : ''}
        <div class="duel-intention">
          ${etape('duel', `${D.ico} ${esc(D.nom)} · leur intention`)}
          <p class="duel-fait">${esc(D.fait)}</p>
          ${D.pourquoi ? `<p class="duel-pourquoi">${esc(D.pourquoi)}</p>` : ''}
          ${D.mots && D.mots.length ? `<div class="choix-puces">${pucesEnBref(D.mots)}</div>` : ''}
        </div>
        ${D.mise ? `<div class="duel-mise">${sceneHtml(D.mise, { voix: true })}<button type="button" class="btn duel-snap${snap ? ' on' : ''}" aria-pressed="${snap}">${snap ? '✓ Mise doublée' : 'Doubler la mise'} · ${esc(D.mise.chiffres)}</button></div>` : ''}
        ${vestiaire}
        ${spec.ajustements ? `<div class="main-ajuste">${etape('aj', 'Ton ajustement pour ce match')}<div class="main-ajuste-rang">${spec.ajustements.map(o => {
          const { cle: _c, ico: _i, nom: _n, bon: _b, prix: _p, si: _s, pari: _pa, gardienAux: _g, ...canaux } = o;
          const mots = [...motsEnChiffres(canaux), ...(o.pari ? motsDuPari(o.pari) : []), ...(o.gardienAux ? [{ txt: '🧤 L\'auxiliaire au filet', bon: null }] : [])];
          return `<button type="button" class="main-aj${aj === o.cle ? ' on' : ''}" data-aj="${esc(o.cle)}"><b>${o.ico} ${esc(o.nom)}</b><small>${esc(o.bon || '')}</small><span class="choix-puces">${puces(mots)}</span></button>`;
        }).join('')}</div></div>` : ''}
        ${propositionsHtml()}
        ${spec.stats ? `<div class="main-stats"><div class="gl-k">📊 Les deux clubs, par match</div>${spec.stats}</div>` : ''}
        <div class="main-outils">
          <button type="button" class="btn main-chiffres" aria-pressed="${chiffresOuverts()}">Les chiffres</button>
          ${spec.onAdjoint ? '<button type="button" class="btn main-adjoint" title="Il garde ton tableau aux entractes, jusqu\'à la fin de la série">L\'adjoint joue cette série</button>' : ''}
        </div>
      </div>
    </div>`;
    [m, m.querySelector('.choix-sheet'), m.querySelector('.choix-corps')].forEach((e, i) => { if (e && hauts[i]) e.scrollTop = hauts[i]; });
    pointsDeBande(m);
    m.querySelectorAll('.duel-prop[data-prop]').forEach(b => { b.onclick = () => {
      if (manque()) return;
      const o = [...D.propositions, D.garder].find(x => x.cle === b.dataset.prop);
      const reponse = { plan: o && o.plan ? o.plan : null, snap };
      // Une carte de vestiaire neuve qui est un pari : le dé d'abord, puis tout part ensemble.
      const ov = V && !V.pris && V.options.find(x => x.cle === vest);
      if (ov && ov.pari && typeof V.lancer === 'function') { sceneDuDe(m, { lancer: c => V.lancer(c, [reponse, aj]), onChoix: c => spec.onJouer(reponse, aj, c) }, ov, nV.sub, fermer, dessiner); return; }
      fermer(true);
      spec.onJouer(reponse, aj, V && !V.pris ? vest : null);
    }; });
    m.querySelectorAll('.main-vest[data-vest]').forEach(b => { b.onclick = () => { vest = b.dataset.vest; ouverts.delete('vest'); jouerSon('joue'); dessiner(); }; });
    m.querySelectorAll('.main-pli[data-deplier]').forEach(b => { b.onclick = () => { ouverts.add(b.dataset.deplier); dessiner(); }; });
    m.querySelectorAll('.main-aj').forEach(b => { b.onclick = () => { aj = b.dataset.aj; jouerSon('joue'); dessiner(); }; });
    const bs = m.querySelector('.duel-snap');
    if (bs) bs.onclick = () => { snap = !snap; jouerSon('joue'); dessiner(); };
    // LES CHIFFRES (V3) : la préparation se lit en mots ; ses chiffres se déplient, comme dans un choix.
    const bc = m.querySelector('.main-chiffres');
    bc.onclick = () => { const o = basculerChiffres(); m.querySelector('.choix-sheet').classList.toggle('chiffres', o); bc.setAttribute('aria-pressed', String(o)); };
    const adj = m.querySelector('.main-adjoint');
    if (adj) adj.onclick = () => { fermer(true); spec.onAdjoint(); };
    // Le focus reste DANS le duel : le clavier ne tombe jamais sur la page dessous.
    const f0 = m.querySelector('.main-vest:not(:disabled), .main-aj') || m.querySelector('.duel-prop:not(:disabled)') || m.querySelector('.choix-sheet');
    if (f0) f0.focus({ preventScroll: true });
  };
  const fermer = () => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
  };
  fermerChoixCourant = fermer;
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  jouerSon('donne');
  dessiner();
  return () => fermer(true);
}

/*
 * LE DUEL EN MOTS (V9 ; V17). Ce que `ouvrirDuel` montre d'une période : leur intention (le fait, son pourquoi, ce
 * qu'elle fait aux deux clubs, le temps de la période), la scène de ton adjoint et ses plans. `P` : `{ intention }`
 * (le moteur) ; `propositions` : ce que `propositionsDuDuel` (js/impact.js) rend ; `enChiffres` : leurs puces
 * (`intentionEnChiffres`) ; `enForce` : la clé de ton plan en
 * force ; `scene` : `sceneDeLAdjoint` (js/scenes.js) ; `mise` : la ligne de la mise doublée, avant la 3e d'un duel de
 * saison.
 */
const PERIODE_MOT = ['1re', '2e', '3e'];
export function specDuDuel(P, { k = 0, mise = null, propositions = [], enForce = 'match', scene = null, enChiffres = [] } = {}) {
  const I = P.intention, J = INTENTIONS[I.cle], c = nom(I.cible), par = nom(I.par);
  const fait = {
    ombre: `${par || 'Leur meilleur défensif'} suit ${c} toute la période`,
    chasse: `${par || 'Leur dur'} va frapper ${c}`,
    centre: 'Ils ferment le centre : moins de tirs des deux bords',
    assaut: 'Ils lancent de partout, quitte à écoper',
    cachot: 'Ils cherchent à te faire punir',
  }[I.cle];
  const w = I.pourquoi || {};
  const pourquoi = {
    vedette: `${c} est ta vedette.`, sansDur: `Personne ne protège ${c}.`, brigadier: `${c} lance l'attaque de ta brigade.`,
    planTir: 'Ton coach mise sur le Tir.', planDefense: 'Ton coach mise sur la Défense : ils veulent la tester.', indiscipline: 'Ton club écope plus que le leur.',
    garde: 'Ça a marché la période d\'avant.', mene: 'Tu mènes : ils n\'ont plus rien à perdre.', traine: 'Ils mènent : ils protègent l\'avance.',
    punitions: `Tu as pris ${w.n} punitions.`, trio: `Ton ${w.u + 1}e trio a marqué ${w.n} fois.`, marqueur: `${c} a marqué ${w.n} fois.`,
  }[w.cle] || '';
  // Leurs puces (`intentionEnChiffres`, js/impact.js), le joueur visé d'abord : c'est lui que leur plan définit.
  const mots = [...(J.joueur && c ? [{ txt: I.cle === 'ombre' ? `${c} : moins de tirs, moins de chances` : `${c} : moins de tirs, des coups, des jambes en moins`, bon: false }] : []), ...enChiffres];
  // Ses plans : le nom et l'icône du plan, qui suit qui pour 🥷, et ses vraies stats de la période.
  const tuile = x => {
    const PL = PLANS[x.cle];
    return { cle: x.cle, ico: PL.ico, nom: PL.nom, sous: PL.vedette && x.vedette && x.colle ? `${nom(x.colle)} suit ${nom(x.vedette)}` : '',
      mots: motsDeStats(x.stats, 2), plan: { cle: x.cle, ...(x.vise ? { vise: x.vise } : {}) } };
  };
  const PE = PLANS[enForce] || PLANS.match;
  return {
    k, ico: J.ico, nom: J.nom, fait, pourquoi, mots, mise, scene, periode: PERIODE_MOT[k],
    propositions: propositions.map(tuile),
    // « Garder tirer de partout » se lisait mal : le verbe du plan reste à sa ligne du dessous.
    garder: { cle: 'garder', ico: PE.ico, nom: enForce === 'match' ? 'Garder ton match' : 'Garder ton plan', sous: enForce === 'match' ? 'Ton alignement, tel quel' : `${PE.nom}, tel quel`, mots: [], plan: null },
  };
}

void RARETES;
