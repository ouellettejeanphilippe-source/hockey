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
 *   ouvrirLignes  les quatre lignes : les joueurs avec leur profil et leur
 *                 énergie, les sept tactiques avec le fit de CETTE ligne, la
 *                 chimie, l'agressivité, les secondes de présence ; la
 *                 tactique d'en face et celle qui la contre ; la consigne du
 *                 match. Rien ne s'applique avant « Appliquer ». Depuis S78,
 *                 il ne sert plus qu'à la préparation d'avant-match.
 *   strategieDeLigne  la même stratégie, ligne par ligne, dans un tiroir
 *                 SOUS son trio de l'alignement (S78) : l'alignement, la
 *                 stratégie et les trios sont un seul écran.
 *
 * Le module est aveugle au jeu : `ctx` porte l'échappement et les écussons,
 * les données arrivent en arguments, et les décisions repartent par rappel.
 */

import {
  PROFILS, TACTIQUES, SYSTEMES_D, AGRESSIVITES, IMPORTANCES, AD_DE_CONSIGNE, effetDeMoment, SEC_MIN, SEC_MAX, SEC_DEFAUT, PART_UNITE,
  badgesDe, PALIERS, fitUnite, rolesDuSysteme, fitDeLigne, meilleureTactique, meilleurSystemeD, echelleFit, identiteUnite, effetsDeSysteme,
  joueursDeLigne, contreDe, contreDeD, motCourbe, chimieMax, meilleureAgressivite, enFaceDe, FERMETURE_DEFAUT,
  MUTATIONS, SLOTS, getPlayerKey, getHiddenRatings, getPositionPenalty, CARTES,
  PLANS_ADV, commentContrer, reglageDuPlan,
  physiqueDe, physiqueLigne, bilanAgressivite,
  chimieLigne, ententeLigne, maitriseLigne, apprentissagePhoto, penaliteAdaptee, unitesIdeales, joueEnBas, EDITIONS_REGLEMENT,
} from './sim.js';
import { motsEnChiffres, motsDeMutationEnChiffres, clubLu, systemeEnChiffres, agressiviteEnChiffres } from './impact.js';
import { carteHtml, RARETES, paquetHtml } from './cartes.js';
import { CARTES_MATCH, ENERGIE_MAIN, coutDe, energieDepensee } from './combat.js';
import { ROULEMENTS, effetsDesCartes, PREP_JUSTE, PREP_RATEE, grandirEffet, facesDuPari, niveauJambes, facteurEnergie, ENERGIE_REF, ENERGIE_EFFET, ENERGIE_BLESSURE, CHIMIE_PIVOT, GARDIEN_SUITE_LIBRE, GARDIEN_JAMBES_PAS, GARDIEN_USURE, GARDIEN_JAMBES_MIN } from './sim.js';
import { jouerSon } from './sons.js';
import { TRAITS } from './traits.js';
import { avecArticle } from './commentaire.js';
import { esc, cap as majuscule, pct3, varsEquipe } from './util.js';

const $ = id => document.getElementById(id);
/* Une phrase qui suit un point commence par une majuscule. */

/* Les puces d'un effet : vert s'il aide, rouge s'il coûte, gris s'il ne fait que déplacer. */
export function puces(mots, detail = () => false) {
  return (mots || []).map(m => `<span class="puce ${m.bon === true ? 'bon' : m.bon === false ? 'prix' : 'neutre'}${m.duree ? ' duree' : ''}${m.enMots ? ' en-mots' : ''}${detail(m) ? ' detail' : ''}">${esc(m.txt)}</span>`).join('');
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
const estChiffre = m => /(^|: )≈ /.test(String(m.txt || ''));
function detailDe(mots) {
  const chiffres = mots.filter(estChiffre);
  const buts = m => m.cle === 'but' || m.cle === 'butContre';
  const meilleur = sens => chiffres.find(m => m.bon === sens && buts(m)) || chiffres.find(m => m.bon === sens) || null;
  // Un chiffre pour et un contre, au plus : ce que l'option rapporte et ce qu'elle coûte, en buts d'abord.
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
  but: ['Tu marques plus', 'Tu marques moins'], butContre: ['Tu accordes plus de buts', 'Tu accordes moins de buts'],
  tir: ['Tu tires plus', 'Tu tires moins'], 'tir accordé': ['L\'adversaire tire plus', 'L\'adversaire tire moins'],
  punition: ['Plus de punitions', 'Moins de punitions'], coup: ['Plus de mises en échec', 'Moins de mises en échec'],
  blessure: ['Plus de blessures', 'Moins de blessures'], jambes: ['Les jambes s\'usent plus', 'Les jambes s\'usent moins'],
};
function enMots(m) {
  const t = String(m.txt || ''), moins = /≈ −|de moins/.test(t);
  if (m.cle === 'glace') { const qui = t.split(' : ')[0]; return /presque inchangée/.test(t) ? null : `${qui} : ${moins ? 'moins' : 'plus'} de glace`; }
  if (m.cle === 'lui') return `${t.split(' : ')[0]} : ${moins ? 'moins' : 'plus'} de buts`;
  const M = MOTS_DU_CHIFFRE[m.cle];
  return M ? M[moins ? 1 : 0] : null;
}
/* Les mots d'une carte : chaque chiffre dit aussi en mots (une fois chacun), le chiffre gardé pour « Les chiffres ». */
export function enMotsEtChiffres(mots) {
  const vus = new Set(), out = [];
  for (const m of mots) {
    if (!estChiffre(m) && m.cle !== 'lui' && m.cle !== 'glace') { out.push(m); continue; }
    const txt = enMots(m);
    if (txt && !vus.has(txt)) { vus.add(txt); out.push({ txt, bon: m.bon, enMots: true }); }
    out.push({ ...m, chiffre: true });
  }
  return out;
}
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
function motsDeCarte(o, noms = '') {
  const out = [];
  if (o.action) out.push(...motsDAction(o.action, noms));
  if (o.changeGardien) out.push({ txt: '🧤 L\'auxiliaire prend le filet', bon: null });
  if (o.gardienAux === true) out.push({ txt: '🧤 L\'auxiliaire au filet ce match-là', bon: null });
  if (o.enjeu) out.push({ txt: '⚖️ Après le match, l\'élan ou le contrecoup dure deux fois plus', bon: null });
  if (o.pari) {
    const issue = e => { const { duree, action, ...c } = e || {}; const m = [...motsEnChiffres(c, duree), ...motsDAction(action, noms)]; return m.length ? m.map(x => x.txt).join(', ') : 'rien'; };
    out.push({ txt: `🎲 ${majuscule(facesMot(facesDuPari(o.pari.chance)))} : ${issue(o.pari.gagne)}`, bon: true });
    out.push({ txt: `🎲 sinon : ${issue(o.pari.perd)}`, bon: false });
  }
  if (o.ensuite) {
    const { apres, duree, ...c } = o.ensuite;
    out.push({ txt: `⏳ Dans ${plur(apres || 0, 'match')} : ${motsEnChiffres(c, duree).map(x => x.txt).join(', ')}`, bon: true });
  }
  if (o.rien) out.push({ txt: 'Rien ne change', bon: null });
  return out;
}

/*
 * LE PLAN DE L'ADVERSAIRE (S70, S72), tel que le rapport d'éclaireur le lit :
 * ce qu'il règle sur ses lignes, ce que ce système fait, ce qui le contre, et
 * si tes lignes le contrent.
 */
/* Ce que leur système fait à LEUR match, en chiffres : sur deux de leurs lignes (≈ 65 % de la glace), à plein fit. Les mots disent ce qui leur arrive. */
const PART_DE_DEUX_LIGNES = 0.65;
function motsDuSystemeAdverse(T) {
  const e = {};
  for (const m of effetsDeSysteme(T, 75)) if (['volume', 'finition', 'defense', 'discipline'].includes(m.canal)) e[m.canal] = 1 + (m.v - 1) * PART_DE_DEUX_LIGNES;
  return motsEnChiffres(e, null, { eux: true }).filter(m => m.cle !== 'rien');
}
export function planAdverseHtml(cle, contre, { nomAdv = 'Ils', suite = '', prepJuste } = {}) {
  const P = PLANS_ADV[cle];
  if (!P) return '';
  // Le plan est un réglage de lignes (S72) : ce qu'il règle, et ce que ce système fait.
  const T = P.tac ? TACTIQUES[P.tac] : null;
  const mots = T ? motsDuSystemeAdverse(T).map(m => ({ txt: `${nomAdv} : ${m.txt}`, bon: m.bon == null ? null : !m.bon })) : [];
  return `<div class="plan-adv${contre ? ' contre' : ''}">
    <div class="plan-adv-t">${P.ico} Leur plan : <b>${esc(P.nom)}</b>${suite ? ` <small>${esc(suite)}</small>` : ''}</div>
    <div class="plan-adv-mot">${esc(P.mot)} <b>${esc(majuscule(reglageDuPlan(cle)))}</b>.</div>
    ${mots.length ? `<div class="choix-puces">${puces(mots)}</div>` : ''}
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
/* Ce que la case lit d'un joueur (V2.3) : son badge de ce rôle, à son palier, ou la base. */
const motDuFit = (p, role) => {
  const b = p && badgesDe(p).find(x => x.cle === role);
  return !b ? 'pas ce badge : la case ne rend que la base' : b.second && !b.plein ? `son second badge, ${motDuBadge(b)} : la moitié` : `son badge, ${motDuBadge(b)}`;
};
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
  if (o.rien) return 'Rien';
  if (o.trou || (o.mutation && EDITIONS_REGLEMENT.includes(o.mutation))) return 'Règlement';
  if (!(o.genreCarte || o.dessin) && EDITIONS_REGLEMENT.includes(o.cle)) return 'Règlement';
  if (o.genreCarte || o.dessin) {
    const cle = o.dessin || o.cle;
    const C = CARTES_MATCH[cle];
    return C ? formeDeCarte(C, cle) : '';
  }
  const src = o.effet || o;
  if (Array.isArray(src.F) || Array.isArray(src.D)) return 'Minutes';
  const bits = bitsDe(src, true);
  if (!bits.length) return '';
  if (bits.every(Boolean)) return 'Cadeau';
  if (bits.every(b => !b)) return 'Moindre mal';
  return 'Échange';
}
function typeAvecForme(type, forme) {
  if (!forme) return type || '';
  if (!type) return forme;
  const m = /^(.*) · (\d+ élan|injouable)$/.exec(type);
  return m ? `${m[1]} · ${forme} · ${m[2]}` : `${type} · ${forme}`;
}

/* `ligne` (S80) : où il joue dans ton alignement (« 3e paire ») — on le dit, on ne le nomme pas par là. */
export function carteJoueur(p, ligne = '') {
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
 * était déjà décidé (`recompensesOffertes`), la pile n'est qu'une façon de le
 * montrer. Un paquet ne s'ouvre qu'une fois : rouvrir le choix (« Voir la
 * récompense ») montre les cartes. Sous `prefers-reduced-motion`, la pile sans
 * paquet ni mouvement.
 */
const RANG_RARETE = { commune: 0, peu: 1, rare: 2, legendaire: 3 };
const PAQUETS_OUVERTS = new Set();
const DECHIRE = 460;             // ms du rabat qui se déchire
const mouvementCalme = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * spec : { ico, titre, irl, recit, joueur, options: [{ cle, nom, bon, prix, effet, duree, jauges,
 *          mutation, desactive }], fermable, motFermer, onChoix(cle), onFerme() }
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
      ${spec.joueur ? carteJoueur(spec.joueur, ou(spec.joueur)) : ''}
      ${spec.contexte || ''}
      ${paquet ? `<div class="paquet-scene">${paquetHtml({ n: spec.options.length, meilleure, serie: spec.titre })}</div>` : ''}
      <div class="choix-options${spec.cartes ? ` choix-main${pile ? '' : ' donne'}` : ''}${spec.compact ? ' compact' : ''}${spec.cartes && spec.options.length && spec.options.every(o => o.carteJoueur) ? ' joueurs' : spec.cartes && !spec.lecture && spec.options.length >= 2 && spec.options.length <= 3 ? ' trois' : ''}">${spec.options.map((o, i) => {
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
          pucesHtml: puces(enMotsEtChiffres(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) }))), m => !!m.chiffre) + (o.quand ? `<span class="puce neutre duree">${esc(o.quand)}</span>` : ''),
          desactive: o.desactive ? esc(o.desactive) : '',
          dos: pile, r: pile ? rangDe(i) : null, meilleure: pile && rangDe(i) === ordre.length - 1 && ((RANG_RARETE[o.rarete] || 0) >= 2 || !!o.eclat),
          joueurHtml: o.carteJoueur || '', vue: !!o.vue, motChoixHtml: o.motChoix ? esc(o.motChoix) : '', genreCarte: o.genreCarte, dessin: o.dessin, famille: o.famille,
        });
        const pucesHtml = `${puces(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) })), detailDe(mots))}${o.quand ? `<span class="puce neutre duree">${esc(o.quand)}</span>` : ''}`;
        return `<button type="button" class="choix-option${o.visage ? ' avec-visage' : ''}" data-choix="${esc(o.cle)}"${o.desactive ? ' disabled' : ''}>
          ${o.visage ? `<span class="choix-option-visage" aria-hidden="true">${o.visage}</span>` : ''}
          <span class="choix-option-nom">${o.ico ? `${o.ico} ` : ''}${sub(o.nom)}</span>
          ${forme ? `<span class="choix-forme">${esc(forme)}</span>` : ''}
          ${o.sous ? `<span class="choix-option-sous">${sub(o.sous)}</span>` : ''}
          ${pucesHtml ? `<span class="choix-puces">${pucesHtml}</span>` : ''}
          ${o.bon ? `<span class="choix-option-bon">+ ${sub(o.bon)}</span>` : ''}
          ${o.prix ? `<span class="choix-option-prix">− ${sub(o.prix)}</span>` : ''}
          ${o.mutation ? `<span class="choix-option-mut">${MUTATIONS[o.mutation].ico} ${esc(MUTATIONS[o.mutation].quoi)}</span>` : ''}
          ${o.desactive ? `<span class="choix-option-non">${esc(o.desactive)}</span>` : ''}
        </button>`;
      }).join('')}</div>
      <button type="button" class="choix-chiffres" aria-pressed="${chiffresOuverts()}" hidden>Les chiffres</button>
      ${(spec.cartes || spec.genre) && spec.fermable ? `<button type="button" class="btn choix-plus-tard">${esc(spec.motFermer || 'Plus tard')}</button>` : ''}
    </div>
  </div>`;
  const FETE = spec.cartes || spec.genre === 'recompense' || spec.genre === 'main' || spec.genre === 'entracte' || spec.genre === 'coupe';
  m.classList.toggle('feuille', !FETE);
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  // Un paquet se tait tant qu'il est scellé : ses sons sont ceux de l'ouverture.
  if (spec.cartes && !spec.lecture && !pile) jouerSon(spec.genre === 'recompense' ? 'recompense' : 'donne');
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
  for (const x of m.querySelectorAll('.choix-fermer, .choix-plus-tard')) x.onclick = () => fermer();
  pointsDeBande(m);
  if (pile) brancherPaquet(m, () => PAQUETS_OUVERTS.add(clePaquet), { walkout, scelle: paquet });
  const premier = paquet ? m.querySelector('.paquet') : pile ? null : m.querySelector('.choix-option:not([disabled])');
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
 * Deux façons de toucher, jamais d'action sans bouton :
 *   SÉLECTION  (`onChoix`) toucher surligne la case, la barre du bas dit ce
 *              qui va se passer (« Hal Gill (3e paire) sort, … »), et c'est
 *              « Confirmer » qui décide ;
 *   APERÇU     (`onApercu`) toucher ouvre quelque chose par-dessus (la fiche
 *              du joueur, retournée au verso) — l'action est là-bas.
 * Une case qu'on ne peut pas prendre reste visible, grisée, avec sa raison ;
 * quand toute une rangée l'est pour la même raison, la raison se dit une fois,
 * dans son titre.
 *
 * spec : { ico, titre, contexte, aide, motFermer, motConfirmer,
 *          rangees: [{ titre, cases: [{ cle, vide, visage, nom, nomLong, pos, marque, marqueMot, note, non }] }],
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
  const rangee = r => {
    const commune = communeDe(r);
    return `<section class="aln-rangee${commune ? ' grisee' : ''}" data-cases="${r.cases.length}" data-rangee="${esc(r.titre)}">
      <h3 class="aln-titre">${esc(r.titre)}${commune && !partout ? ` <small>· ${esc(commune)}</small>` : ''}</h3>
      <div class="aln-cases">${r.cases.map(c => (c.vide
        ? `<div class="aln-case aln-vide" aria-label="Case vide"><span class="aln-nom">Case vide</span>${c.pos ? `<span class="aln-pos">${esc(c.pos)}</span>` : ''}</div>`
        : `<button type="button" class="aln-case${c.non ? ' non' : ''}" data-aln="${esc(c.cle)}" aria-pressed="false"${c.non ? ' disabled' : ''} title="${esc([c.nomLong || c.nom, c.pos, c.marqueMot, c.non].filter(Boolean).join(' · '))}">
            <span class="aln-visage" aria-hidden="true">${c.visage || ''}</span>
            <span class="aln-nom">${esc(c.nom)}</span>
            <span class="aln-pos"><span>${esc(c.pos || '')}</span>${c.marque ? `<b class="aln-marque" aria-label="${esc(c.marqueMot || c.marque)}">${esc(c.marque)}</b>` : ''}</span>
            ${c.non && !commune ? `<span class="aln-non">${esc(c.non)}</span>` : !c.non && c.note ? `<span class="aln-note">${esc(c.note)}</span>` : ''}
          </button>`)).join('')}</div>
    </section>`;
  };
  m.innerHTML = `<div class="choix-sheet choix-aln" data-genre="alignement" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
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
    <div class="aln-barre">
      <p class="aln-barre-mot" aria-live="polite">${esc(spec.aide || 'Touche un joueur.')}</p>
      <div class="aln-barre-boutons">
        <button type="button" class="btn aln-retour">${esc(spec.motFermer || 'Retour')}</button>
        ${apercu ? '' : `<button type="button" class="btn gold aln-confirmer" disabled>${esc(spec.motConfirmer || 'Confirmer')}</button>`}
      </div>
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
  const mot = m.querySelector('.aln-barre-mot');
  const ok = m.querySelector('.aln-confirmer');
  let choisie = null;
  m.querySelectorAll('.aln-case[data-aln]').forEach(b => {
    b.onclick = () => {
      if (b.disabled) return;
      if (apercu) { spec.onApercu(b.dataset.aln); return; }
      // Toucher la case choisie la relâche ; toucher une autre la remplace.
      choisie = choisie === b.dataset.aln ? null : b.dataset.aln;
      m.querySelectorAll('.aln-case[data-aln]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.aln === choisie)));
      m.querySelector('.aln-barre').classList.toggle('pret', !!choisie);
      mot.innerHTML = choisie && spec.barre ? spec.barre(choisie) : esc(spec.aide || 'Touche un joueur.');
      ok.disabled = !choisie;
    };
  });
  if (ok) ok.onclick = () => { if (!choisie) return; const k = choisie; fermer(true); spec.onChoix(k); };
  for (const x of m.querySelectorAll('.choix-fermer, .aln-retour')) x.onclick = () => fermer();
  for (const x of m.querySelectorAll('.aln-saut')) x.onclick = () => m.querySelector(`.aln-rangee[data-rangee="${CSS.escape(x.dataset.saut)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  // La première case qu'on peut prendre se montre : une carte de gardien ouvre sur les gardiens, pas sur le 1er trio grisé.
  const premier = m.querySelector('.aln-case[data-aln]:not([disabled])');
  if (premier) {
    premier.focus({ preventScroll: true });
    const corps = m.querySelector('.choix-corps'), r = premier.getBoundingClientRect(), rc = corps.getBoundingClientRect();
    if (r.bottom > rc.bottom) premier.closest('.aln-rangee').scrollIntoView({ block: 'center' });
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
  const trois = bande.classList.contains('trois');
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
    // Deux ou trois cartes se rangent en mini côte à côte (`.trois`) : pas dans la pile, où elles sont en grand.
    bande.classList.remove('trois');
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
    if (trois) bande.classList.add('trois');
    bande.removeAttribute('tabindex');
    bande.classList.add('donne');
    tout.remove();
    window.removeEventListener('keydown', clavier, true);
    ouvert();
    pointsDeBande(m);
    const premiere = feuille.querySelector('.choix-option:not([disabled])');
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
   MES LIGNES, EN PLEIN ÉCRAN
   ====================================================================== */
const NOMS_LIGNE = ['1re ligne', '2e ligne', '3e ligne', '4e ligne'];
const ROLES = ['AG', 'C', 'AD', 'DG', 'DD'];
/*
 * LA GLACE DE CHAQUE TRIO À FORCES ÉGALES (V2.2, les bons chiffres). La part est celle que le moteur joue
 * (`PART_UNITE`, pas `POIDS_TRIO` qui compte aussi les avantages), les secondes de chaque ligne appliquées.
 * Avec `glace` (« Préparer le match ») : les minutes du soir, roulement, moments et coachs compris, sur les
 * minutes à forces égales que le moteur lit. Sans club (avant la saison) : la part, en pour cent.
 */
function glaceDe(lignes, glace = null) {
  if (glace) return { mins: glace(lignes), pct: null };
  const w = PART_UNITE.F.map((x, u) => x * lignes[u].sec / SEC_DEFAUT);
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return { mins: null, pct: w.map(x => x / s * 100) };
}
const mmss = m => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
const glaceMot = (g, u, court = false) => (g.mins ? `≈ ${mmss(g.mins[u])}${court ? ' de glace' : ' à forces égales'}` : `${Math.round(g.pct[u])} %${court ? ' de la glace' : ' de la glace à forces égales'}`);
/* Le fit d'une ligne à une tactique, et sa chimie, en mots (S71). */
const motFit = f => (f >= 70 ? 'Sur mesure' : f >= 55 ? 'Bon fit' : f >= 40 ? 'Fit moyen' : 'Mauvais fit');
// Sous le pivot (CHIMIE_PIVOT), une chimie coûte au lieu de rapporter : le mot le dit (V2.2, les coûts cachés).
const motChimie = c => (c >= 70 ? 'excellente' : c >= 45 ? 'bonne' : c >= CHIMIE_PIVOT ? 'correcte' : 'naissante, elle coûte');
/* L'entente et la maîtrise, de 0 à 1, en mots (S73). */
const motAppris = x => (x >= 0.75 ? 'solide' : x >= 0.45 ? 'bonne' : x >= 0.2 ? 'en route' : 'à bâtir');
const plafondChimie = c => (c >= 70 ? 'haut' : c >= 45 ? 'bon' : c >= 20 ? 'bas' : 'très bas');

const nomSys = k => { const S = TACTIQUES[k] || SYSTEMES_D[k]; return S ? `${S.ico} ${esc(S.nom)}` : ''; };
/*
 * LES SYSTÈMES D'UNE UNITÉ (S79), pour le tiroir de l'alignement et la
 * préparation du match : les systèmes et leur fit, le conseil quand un autre
 * lui irait nettement mieux (un toucher l'applique), ce que fait le sien (en
 * chiffres, au prorata du fit), qui il étouffe et qui l'étouffe, ce qu'il
 * demande à chaque poste — et ce qu'il y a en face.
 */
/* L'agressivité d'une ligne et le système d'une unité, en chiffres de match pour TON club : le moteur joue les deux versions (js/impact.js). */
function chiffresAgressivite(lineup, lignes, u, agr) {
  const c = clubLu();
  return c && c.team ? agressiviteEnChiffres(c.team, lineup, c.adv || null, lignes, u, agr) : [];
}
function chiffresSysteme(lineup, lignes, u, groupe, cle) {
  const c = clubLu();
  return c && c.team ? systemeEnChiffres(c.team, lineup, c.adv || null, lignes, u, groupe, cle) : [];
}
function systemesHtml({ lineup, lignes = null, u, groupe, l, adv = null, advNom = '', chimieDe = null, selonDepistage = false, advFermeture = FERMETURE_DEFAUT }) {
  const D = groupe === 'D';
  const SYS = D ? SYSTEMES_D : TACTIQUES;
  const attr = D ? 'tacd' : 'tac';
  const cle = SYS[D ? l.tacD : l.tac] ? (D ? l.tacD : l.tac) : 'hourra';
  const S = SYS[cle];
  const fitBrut = S.slots ? fitUnite(lineup, groupe, u, cle) : 0;
  // UNITÉ INCOMPLÈTE (J1-I) : aucun fit, aucun conseil, les systèmes se lisent sans verdict.
  const incomplete = fitBrut == null;
  const fit = fitBrut ?? 0;
  const classeFit = f => (f >= 55 ? ' bon' : f < 40 ? ' prix' : '');
  const meilleur = D ? meilleurSystemeD(lineup, u) : meilleureTactique(lineup, u);
  const fM = SYS[meilleur] && SYS[meilleur].slots ? (fitUnite(lineup, groupe, u, meilleur) ?? 0) : 0;
  const conseil = !incomplete && meilleur !== cle && fM >= fit + 10
    ? `<div class="ln-conseil">💡 ${D ? 'Cette paire' : 'Ce trio'} irait mieux en <button type="button" class="ln-conseil-btn" data-${attr}="${meilleur}">${nomSys(meilleur)}</button> <small>${motFit(fM).toLowerCase()}</small></div>` : '';
  // EN FACE (V2.2) : le trio adverse que le moteur envoie vraiment — celui de même rang, et leur fermeture
  // contre ton 1er trio (ou leur 1er contre ta fermeture) une présence sur PLAN_FERMETURE (`enFaceDe`).
  const croises = !D && adv ? enFaceDe(u, advFermeture != null && adv.length > advFermeture ? advFermeture : null) : [{ rang: u, part: 1 }];
  const autre = croises[1] && adv && adv[croises[1].rang];
  const aAutre = autre && TACTIQUES[autre.tac] && TACTIQUES[autre.tac].slots ? autre.tac : null;
  const a = adv && adv[u];
  const aF = a && TACTIQUES[a.tac] && TACTIQUES[a.tac].slots ? a.tac : null;
  const aD = a && u < 3 && SYSTEMES_D[a.tacD] && SYSTEMES_D[a.tacD].slots ? a.tacD : null;
  let enFace = '';
  if (aF && !D) {
    const menace = TACTIQUES[aF].bat === cle || (aD && SYSTEMES_D[aD].bat === cle);
    const pour = contreDe(aF);
    // Un gros match (J1-N) : ces lignes sont celles du plan le plus probable du dépistage, et l'écran le dit.
    enFace = `<div class="gl-adv">En face, ${esc(advNom)}${selonDepistage ? ' <small>(selon le dépistage)</small>' : ''} : ${aAutre ? `${Math.round(croises[0].part * 100)} % du temps ` : ''}<b>${nomSys(aF)}</b>${aD ? ` et une paire en <b>${nomSys(aD)}</b>` : ''}${S.bat === aF ? ' · <span class="ok">✓ tu étouffes ses actions spéciales</span>' : pour ? ` · pour l'étouffer : <b>${nomSys(pour)}</b>` : ''}${menace ? ' · <span class="prix">⚠️ son système étouffe le tien</span>' : ''}${aAutre ? `<br><small>${Math.round(croises[1].part * 100)} % du temps, ${croises[1].rang === 0 ? 'leur 1er trio' : `leur trio de fermeture (le ${croises[1].rang + 1}e)`} : <b>${nomSys(aAutre)}</b>${S.bat === aAutre ? ' · <span class="ok">✓ tu l\'étouffes</span>' : contreDe(aAutre) ? ` · l'étouffer : <b>${nomSys(contreDe(aAutre))}</b>` : ''}</small>` : ''}</div>`;
  } else if (aF) {
    const pour = contreDeD(aF);
    enFace = `<div class="gl-adv">En face, le trio ${esc(avecArticle('de', advNom || 'Eux'))} : <b>${nomSys(aF)}</b>${S.bat === aF ? ' · <span class="ok">✓ ta paire étouffe ses actions spéciales</span>' : pour ? ` · ta paire l'étouffe en <b>${nomSys(pour)}</b>` : ''}</div>`;
  }
  const boutons = Object.entries(SYS).map(([k, X]) => {
    const f = X.slots && !incomplete ? fitUnite(lineup, groupe, u, k) : null;
    return `<button type="button" class="gl-tac${cle === k ? ' on' : ''}${aF && X.bat === aF ? ' contre' : ''}" data-${attr}="${k}" aria-pressed="${cle === k}" title="${esc(X.mot)}${aF && X.bat === aF ? ` — contre ${selonDepistage ? 'leur plan probable, selon le dépistage' : 'leur système'}` : ''}"><b>${X.ico} ${esc(X.nom)}</b><span class="gl-tac-fit${f == null ? '' : classeFit(f)}">${f == null ? (incomplete && X.slots ? 'à compléter' : 'rien à assortir') : motFit(f)}</span>${f != null && chimieDe ? `<small class="gl-tac-soir">chimie ${motChimie(chimieDe(k))}</small>` : ''}</button>`;
  }).join('');
  const effets = lignes && S.slots ? chiffresSysteme(lineup, lignes, u, groupe, cle) : [];
  const etouffe = S.bat ? (D ? ` Étouffe l'action spéciale d'un trio en ${nomSys(S.bat)}.` : ` Étouffe ${nomSys(S.bat)}.`) : '';
  const cT = !D && S.slots ? contreDe(cle) : null, cD = !D && S.slots ? contreDeD(cle) : null;
  const parQui = cT || cD ? ` Étouffé par ${[cT && `un trio en ${nomSys(cT)}`, cD && `une paire en ${nomSys(cD)}`].filter(Boolean).join(' ou ')}.` : '';
  const motGain = f => (echelleFit(f) >= 1 ? 'gain complet' : echelleFit(f) <= 0 ? 'aucun gain' : 'gain partiel');
  const choisie = `<div class="ln-choisie"><span class="gl-mot">${esc(S.mot)}${etouffe}${parQui}</span>${S.slots ? `<span class="choix-puces">${puces(effets.length ? effets : [{ txt: 'à peine perceptible', bon: null }])}<span class="puce neutre" title="Le gain d'un système suit les badges qu'il demande : la moitié sans eux, tout quand chacun a le sien en Argent, un quart de plus au-delà. Son prix se paie toujours.">${motGain(fit)}</span></span>` : ''}</div>`;
  // Ce qu'il demande, poste par poste : le rôle, et si le joueur de la case l'a.
  const js = joueursDeLigne(lineup, u);
  // Les rôles tels qu'il les joue : ses ailes dans le sens où elles rendent le mieux (`rolesDuSysteme`).
  const roles = rolesDuSysteme(lineup, groupe, u, cle);
  const inverse = roles && S.slots && roles.AG !== S.slots.AG;
  const demande = roles ? (D ? ['DG', 'DD'] : ['AG', 'C', 'AD']).filter(r => r in js && roles[r]).map(r => {
    const prof = roles[r], P = PROFILS[groupe][prof], p = js[r];
    // V2.3 : la case lit le BADGE — le bon rend son palier, le second la moitié, le mauvais la base (`fitDeCase`).
    const b = p ? badgesDe(p).find(x => x.cle === prof) : null;
    const marque = !p ? '' : !b ? '✗' : b.second && !b.plein ? '≈' : '✓';
    return `<span class="ln-dem${marque === '✓' ? ' fit-bon' : marque === '✗' ? ' fit-mauvais' : ''}" title="${esc(P.nom)}, lu dans ${esc(P.mot)}${p ? ` — ${esc(p.n)} : ${esc(motDuFit(p, prof))}` : ' — case vide'}"><b>${r}</b> ${P.ico} ${esc(P.nom)}${marque ? ` <i>${marque}</i>` : ''}</span>`;
  }).join('') : '';
  return `${enFace}<div class="gl-tacs ln-tacs">${boutons}</div>${conseil}${choisie}${demande ? `<div class="ln-demande"><span class="gl-k">Il demande${inverse ? ' · ailes inversées' : ''}</span>${demande}</div>` : ''}`;
}
/**
 * spec : {
 *   titre, lineup (case → joueur), lignes [{ tac, tacD, agr, sec }] × 4, chimie [4], energie { clé: 0-100 },
 *   adv: { nom, lignes [{ tac }] } | null, match: { importance, ad } | null,
 *   onAppliquer(lignes, match), onBanc() | null, sousTitre,
 *   usure(match, lignes) → { clé: jambes perdues ce soir } | absent
 * }
 */
/*
 * LE PLACEMENT D'UN JOUEUR DANS SA LIGNE (S72) : ▼ trop bas (son talent est
 * gaspillé, l'unité porte un malus), ▲ trop haut (un cran, léger), ↔ hors de
 * sa position naturelle. Rien s'il est à sa place.
 */
function placementDe(p, role, u) {
  const g = role === 'DG' || role === 'DD' ? 'D' : 'F';
  const unite = g === 'D' ? u : u;
  const slot = SLOTS.find(s => !s.scratch && s.role === role && s.unit === unite && s.group === g);
  const bits = [];
  // La zone GRANDIT avec « ⏫ Monte d'un cran » (l'atelier, S78) : `unitesIdeales`,
  // jamais la zone brute de `getLineZone`, qui ignorerait l'édition.
  const ideal = unitesIdeales(p, getHiddenRatings(p).v) || [];
  if (ideal.length && unite > Math.max(...ideal) && !joueEnBas(p, g, unite)) bits.push(['▼', 'Trop bas : son talent est gaspillé ici, l\'unité porte un malus']);
  else if (ideal.length && unite < Math.min(...ideal)) bits.push(['▲', 'Un cran trop haut : léger malus']);
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  if (pen > 0) {
    const reste = penaliteAdaptee(p, slot);
    bits.push(['↔', reste < pen * 0.6 ? 'Hors de sa position naturelle, mais il s\'y adapte' : 'Hors de sa position naturelle : il s\'y fera en jouant là']);
  }
  return bits.length ? { html: bits.map(([m, t]) => ` <span class="gl-j-place" title="${esc(t)}">${m}</span>`).join(''), bits } : null;
}
/*
 * CE QUI JOUE SUR TA FORMATION (S72). JP : *les bonus et malus devraient être
 * avec les stratégies, tout devrait être ensemble*. Les effets en cours —
 * dilemmes, séquences, élan, paris, investissements, cartes — et les absents
 * se lisent ici, à côté des lignes, avec le nombre de matchs qui restent.
 */
function effetsHtml(e) {
  if (!e) return '';
  const ligne = (nom, mots, duree) => `<div class="gl-effet"><span class="gl-effet-nom">${nom}</span><span class="choix-puces">${puces(mots)}${duree}</span></div>`;
  const regle = [];
  const reste = [];
  for (const x of e.effets || []) {
    const mots = motsEnChiffres(canauxDe(x), x.reste).filter(m => !m.duree);
    if (!mots.length) continue;
    const nom = `${x.ico ? `${x.ico} ` : ''}${esc(x.nom || 'Effet')}${x.choix ? ` <small>· ${esc(x.choix)}</small>` : ''}`;
    (x.regle ? regle : reste).push(ligne(nom, mots, `<span class="puce neutre duree">${plur(x.reste, 'match')}</span>`));
  }
  for (const t of e.trous || []) {
    const M = MUTATIONS[t.cle];
    if (!M) continue;
    const qui = t.p && t.p.n ? ` <small>· ${esc(t.p.n)}</small>` : '';
    regle.push(ligne(`${M.ico} ${esc(M.nom)}${qui}`, motsDeMutationEnChiffres(t.cle, t.p, { deja: true }), '<span class="puce neutre duree">la saison</span>'));
  }
  for (const c of e.cartes || []) if (CARTES[c]) reste.push(ligne(`${CARTES[c].ico} ${esc(CARTES[c].nom)} <small>· carte</small>`, motsEnChiffres(canauxDe(CARTES[c])), '<span class="puce neutre duree">la saison</span>'));
  for (const a of e.absents || []) reste.push(`<div class="gl-effet"><span class="gl-effet-nom">👥 ${esc(a.p.n)} <small>· au vestiaire</small></span><span class="choix-puces"><span class="puce neutre duree">${plur(a.reste, 'match')}</span></span></div>`);
  if (e.gardienAux) reste.push(`<div class="gl-effet"><span class="gl-effet-nom">🧤 L'auxiliaire au filet</span><span class="choix-puces"><span class="puce neutre duree">${plur(e.gardienAux, 'match')}</span></span></div>`);
  const corps = `${regle.length ? `<div class="gl-k">Le règlement contourné</div>${regle.join('')}` : ''}${reste.join('')}`;
  return `<section class="gl-effets"><div class="gl-sec-titre">Ce qui joue sur ta formation</div>${corps || '<div class="gl-mot">Rien pour l\'instant : tes lignes jouent sur leur propre valeur.</div>'}</section>`;
}
export function ouvrirLignes(spec) {
  // Dans une page du Club (1.0, R3 : `spec.dans`, `spec.fermer`) ou dans sa fenêtre.
  const m = spec.dans || $('lignesModal');
  if (!m) return;
  /*
   * LA CHIMIE DE CE SOIR (S73) : entente × maîtrise × fit, pour la tactique
   * que tu choisis. Sans photo de l'apprentissage (avant la saison), la chimie
   * que l'appelant a donnée.
   */
  const app = spec.apprentissage ? apprentissagePhoto(spec.apprentissage) : null;
  const chimieDe = (u, l) => (app ? chimieLigne(app, spec.lineup, u, l) : (spec.chimie || [])[u] || 0);
  const brouillon = spec.lignes.map(l => ({ ...l }));
  // La consigne porte la répartition attaque / défense (1.0, J2-11) : `ad` suit l'importance.
  const importance0 = spec.match ? (spec.match.importance || 'normale') : null;
  const match = spec.match ? { importance: importance0, ad: AD_DE_CONSIGNE[importance0] ?? 0 } : null;
  // Ce que joue une consigne, exactement comme le moteur la pose (`effetDeMoment`).
  const effetConsigne = k => effetDeMoment({ jour: 0, match: { importance: k, ad: AD_DE_CONSIGNE[k] ?? 0 } });
  let ouverte = 0;
  /*
   * LE ROULEMENT, UNE VRAIE DÉCISION (V2.3). Il ne s'atteignait que par « Les ménager », présenté par son prix.
   * Ici, à côté de la glace qu'il déplace : ses trois choix, ce que chacun rend et coûte, et les minutes, les
   * totaux et l'usure du soir recalculés avec lui (`spec.roulement` : { avant, choix } — celui d'avant ce soir
   * et celui qui joue ce soir ; la saison seulement). La décision du soir le porte dès qu'il diffère d'avant :
   * elle remplace celle du même soir, qui le portait peut-être.
   */
  let roulement = spec.roulement ? spec.roulement.choix : null;
  const avecRoul = () => (roulement && roulement !== spec.roulement.avant ? { roulement } : {});
  /*
   * DEVANT LE FILET CE SOIR (1.0, C4). JP : *je comprends pas la gestion des
   * gardiens*. Le partant et l'auxiliaire, leurs jambes et leur % d'arrêts de
   * leur vraie saison ; la rotation du club est choisie d'office, toucher
   * l'autre gardien lui donne le filet pour CE soir (une décision, qui se
   * rejoue). `spec.filet` : { partant, aux (clés), rotation: 'partant'|'aux', choix }.
   */
  const F0 = spec.filet || null;
  const gardienDe = cle => (cle ? Object.values(spec.lineup || {}).find(p => p && getPlayerKey(p) === cle) || null : null);
  const gPartant = F0 ? gardienDe(F0.partant) : null, gAux = F0 ? gardienDe(F0.aux) : null;
  let filet = F0 ? (F0.choix && F0.choix !== 'auto' ? F0.choix : F0.rotation) : null;
  const filetSortie = () => (!F0 ? undefined : filet === F0.rotation ? (F0.choix && F0.choix !== 'auto' ? 'auto' : undefined) : filet);

  /*
   * L'USURE DES JAMBES CE SOIR (1.0, le suivi des jambes) : ce que ses présences lui coûteront, refait à
   * chaque toucher — les secondes, l'agressivité, le système et la consigne la changent (`spec.usure`,
   * `usureDuSoir` dans js/sim.js). Les coups reçus s'y ajoutent en jouant.
   */
  let usureSoir = null;
  const usureHtml = p => {
    const c = p && usureSoir ? usureSoir[getPlayerKey(p)] : null;
    return c == null ? '<span class="gl-j-usure"></span>'
      : `<span class="gl-j-usure" title="L'usure des jambes de ses présences ce soir : ses minutes, l'agressivité, le système et la consigne la décident. Les coups reçus s'y ajoutent.">−${Math.round(c)}</span>`;
  };
  const joueurLigne = (u, role) => {
    const js = joueursDeLigne(spec.lineup, u);
    if (!(role in js)) return '';
    const p = js[role];
    const T = role === 'DG' || role === 'DD' ? SYSTEMES_D[brouillon[u].tacD] : TACTIQUES[brouillon[u].tac];
    const g = role === 'DG' || role === 'DD' ? 'D' : 'F';
    const R = T && T.slots ? rolesDuSysteme(spec.lineup, g, u, g === 'D' ? brouillon[u].tacD : brouillon[u].tac) : null;
    const voulu = R ? R[role] : null;
    const pp = p && badgesDe(p)[0];
    const e = p ? (spec.energie[getPlayerKey(p)] ?? 100) : 0;
    // V2.3 : la case lit son badge de ce rôle — ✓ le badge, ≈ le second, ✗ la base.
    const bVoulu = voulu && p ? badgesDe(p).find(b => b.cle === voulu) : null;
    const c = p ? carrureDe(p) : null;
    const marque = !voulu || !p ? '' : !bVoulu ? '✗' : bVoulu.second && !bVoulu.plein ? '≈' : '✓';
    // TOUT CE QUI JOUE SUR LE TRIO, ICI (S72) : sa zone (le rang de ligne où
    // il rend) et sa position (mauvaise aile, centre à l'aile).
    const place = p ? placementDe(p, role, u) : null;
    return `<div class="gl-j${marque === '✓' ? ' fit-bon' : marque === '✗' ? ' fit-mauvais' : ''}">
      <span class="gl-j-role">${role}</span>
      <span class="gl-j-nom">${p ? esc(p.n) : '<i>vide</i>'}${place ? place.html : ''}</span>
      <span class="gl-j-prof" title="${pp ? `${esc(titreDuBadge(pp))}${c ? ` · ${c.mot}` : ''}` : ''}">${pp ? `<i class="badge pal-${pp.palier}">${pp.ico}</i> <small>${esc(pp.nom)}</small>` : ''}</span>
      <span class="gl-j-niv">${p ? pastilleNiveau(p) : ''}</span>
      ${voulu ? `<span class="gl-j-voulu" title="Ce que ${esc(T.nom)} demande à ce poste : ${esc(PROFILS[g][voulu].nom)} — il y joue ${esc(motDuFit(p, voulu))}">${PROFILS[g][voulu].ico} <b class="gl-j-marque">${marque}</b></span>` : '<span class="gl-j-voulu"></span>'}
      ${p ? jambesHtml(e) : '<span class="jambes"></span>'}
      ${usureHtml(p)}
      ${(p && p._mutCles || []).map(k => MUTATIONS[k] ? `<span class="gl-j-mut" title="${esc(MUTATIONS[k].nom)}">${MUTATIONS[k].ico}</span>` : '').join('')}
    </div>`;
  };

  function dessiner() {
    const mins = glaceDe(brouillon, spec.glace ? lignes => spec.glace(match, lignes, avecRoul()) : null);
    usureSoir = spec.usure ? spec.usure(match, brouillon, avecRoul()) : null;
    const tete = `<div class="choix-tete">
      <span class="choix-ico">🏒</span>
      <div class="choix-titres"><div class="choix-titre">${esc(spec.titre || 'Mes lignes')}</div>${spec.sousTitre ? `<div class="choix-irl">${esc(spec.sousTitre)}</div>` : ''}</div>
      <button type="button" class="close-btn gl-annuler" aria-label="Fermer sans rien changer" title="Fermer sans rien changer">✕</button>
    </div>`;
    /*
     * LA CONSIGNE TIENT EN UNE RANGÉE (S71). JP : *avoir les bonnes infos au
     * bon endroit, lisible*. Trois grandes cases poussaient les lignes — ce
     * qu'on vient régler — sous le premier écran du téléphone. Trois boutons
     * courts, et l'effet du choix courant en une ligne dessous.
     */
    const Icour = match ? IMPORTANCES[match.importance] || IMPORTANCES.normale : null;
    const consigne = match ? `<section class="gl-consigne">
      <div class="gl-sec-titre">Consigne du match</div>
      <div class="gl-seg gl-seg-court">${Object.entries(IMPORTANCES).map(([k, I]) => `<button type="button" class="gl-seg-btn${match.importance === k ? ' on' : ''}" data-importance="${k}">
        <b>${I.ico} ${esc(I.nom)}</b><span class="choix-puces">${puces(motsEnChiffres(effetConsigne(k)).filter(x => x.cle !== 'rien'))}</span></button>`).join('')}</div>
      <div class="gl-consigne-effet"><small>${esc(Icour.mot)}</small>${spec.grosMatch && match.importance !== 'haute' ? ' <span class="choix-puces"><span class="puce neutre" title="Un gros match : la consigne Haute joue plus fort, au prix des jambes et des blessures. Elle se choisit.">🌡️ Haute conseillée</span></span>' : ''}</div>
    </section>` : '';
    const pctR = x => `${x > 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)} %`;
    const roulHtml = roulement ? `<section class="gl-roulement">
      <div class="gl-sec-titre">Le roulement · toute l'équipe, dès ce soir</div>
      <div class="gl-seg gl-seg-court">${Object.entries(ROULEMENTS).map(([k, R]) => `<button type="button" class="gl-seg-btn${roulement === k ? ' on' : ''}" data-roulement="${k}" aria-pressed="${roulement === k}">
        <b>${R.ico} ${esc(R.nom)}</b><span class="choix-puces">${puces([{ txt: R.bon, bon: true }, ...(k === 'quatre' ? [] : [{ txt: R.prix, bon: false }]), ...(R.blessure ? [{ txt: `Blessures ${pctR(R.blessure)}`, bon: R.blessure < 1 }] : [])])}</span></button>`).join('')}</div>
      <div class="gl-mot">Il déplace la glace d'un trio à l'autre ; les minutes des onglets le suivent.</div>
    </section>` : '';
    /*
     * LES TOTAUX DU SOIR (1.0, C5). Tout ce qui joue ce soir, multiplié et
     * lu dans le moteur (`motsDuSoir`, js/impact.js) — la
     * consigne qu'on règle ici comprise, recalculée à chaque toucher.
     */
    const tot = spec.totaux ? spec.totaux(match, brouillon, avecRoul()) : null;
    // TON ALIGNEMENT (V2.2) : ce que tes systèmes, tes badges, ta chimie et tes jambes rapportent ce soir, chacun contre le neutre.
    const al = spec.alignement ? spec.alignement(match, brouillon, avecRoul()) : [];
    const totauxHtml = tot ? `<section class="gl-totaux">
      <div class="gl-totaux-l"><b>Tes effets :</b> <span class="choix-puces">${tot.length ? puces(tot) : '<span class="puce neutre">aucune carte ni consigne</span>'}</span></div>
      ${al.length ? `<div class="gl-totaux-l"><b>Ton alignement :</b> <span class="choix-puces">${puces(al)}</span></div>` : ''}
      <div class="gl-mot">Chacun contre le même soir sans lui.</div>
    </section>` : '';
    /*
     * L'ADVERSAIRE D'ABORD (1.0, J2-11). Tout ce qui se règle ici se règle
     * CONTRE quelqu'un : son nom, son plan probable (le dépistage d'un gros
     * match) ou, un soir ordinaire, les systèmes de ses deux premières lignes.
     * Le détail par ligne (« pour l'étouffer ») reste sous chaque système.
     */
    const advL = (spec.adv && spec.adv.lignes) || [];
    const sysAdv = l => { const T = l && TACTIQUES[l.tac]; return T ? `${T.ico} ${esc(T.nom)}` : ''; };
    const advTete = spec.adv ? `<section class="gl-adv-tete">
      <div class="gl-sec-titre">En face · ${esc(spec.adv.nom || 'Eux')}</div>
      ${spec.depistage ? depistageHtml(pistesDuRapport(spec.depistage), { nomAdv: spec.adv.nom || 'Eux' })
        : advL.length ? `<div class="gl-adv">Leur 1re ligne : <b>${sysAdv(advL[0])}</b>${advL[1] ? ` · leur 2e : <b>${sysAdv(advL[1])}</b>` : ''}</div>` : ''}
    </section>` : (spec.depistage ? depistageHtml(pistesDuRapport(spec.depistage), { nomAdv: 'Eux' }) : '');
    const svTxt = g => (g && Number.isFinite(g.sv) ? pct3(g.sv) : '—');
    const boutonGardien = (qui, g) => {
      const e = g ? (spec.energie[getPlayerKey(g)] ?? 100) : 100;
      const estRot = F0 && F0.rotation === qui;
      return `<button type="button" class="gl-seg-btn gl-gardien${filet === qui ? ' on' : ''}" data-filet="${qui}" aria-pressed="${filet === qui}">
        <b>🥅 ${g ? esc(g.n) : 'Le rappel du club-école'}</b>
        <span class="gl-gardien-l"><small>${qui === 'partant' ? 'Partant' : 'Auxiliaire'}${estRot ? ' · la rotation' : ''}</small><small title="Son % d'arrêts de sa vraie saison">${svTxt(g)} d'arrêts</small></span>
        ${jambesHtml(e, { gardien: true })}</button>`;
    };
    const filetHtml = F0 ? `<section class="gl-filet">
      <div class="gl-sec-titre">Devant le filet ce soir</div>
      <div class="gl-seg gl-seg-court">${boutonGardien('partant', gPartant)}${boutonGardien('aux', gAux)}</div>
      <div class="gl-mot">Trois départs de suite sans perte ; ensuite ses jambes baissent. Touche l'autre pour lui donner le filet.</div>
    </section>` : '';
    const onglets = `<div class="gl-onglets" role="tablist">${NOMS_LIGNE.map((n, u) => {
      const T = TACTIQUES[brouillon[u].tac] || TACTIQUES.hourra, D = u < 3 ? SYSTEMES_D[brouillon[u].tacD] || SYSTEMES_D.hourra : null;
      return `<button type="button" role="tab" class="gl-onglet${u === ouverte ? ' on' : ''}" data-ligne="${u}" aria-selected="${u === ouverte}">
        <b>${n}</b><span>${T.ico}${D ? ` ${D.ico}` : ''} ${esc(T.nom)}</span><small>chimie ${motChimie(chimieDe(u, brouillon[u]))} · ${glaceMot(mins, u, true)}</small></button>`;
    }).join('')}</div>`;
    const u = ouverte, l = brouillon[u];
    const sansSysteme = l.tac === 'hourra' && (u > 2 || l.tacD === 'hourra');
    const fitLigneBrut = fitDeLigne(spec.lineup, u, l);
    const fitCourant = fitLigneBrut ?? 0;
    // LA CARRURE DE LA LIGNE (S71) : c'est elle qui dit si le jeu physique paie.
    const ph = physiqueLigne(spec.lineup, u);
    const carrureLigne = ph >= 0.56 ? '🪨 ligne costaude' : ph <= 0.44 ? '🪶 ligne légère' : 'ligne moyenne';
    // UN SYSTÈME POUR LE TRIO, UN AUTRE POUR LA PAIRE (S79), chacun sous le nom de ce que ses joueurs sont.
    const choixDe = groupe => {
      const id = identiteUnite(spec.lineup, groupe, u);
      const titre = `<div class="gl-sec-titre">Système ${groupe === 'D' ? 'de la paire' : 'du trio'}${id ? ` · <span class="ln-id">${id.ico} ${esc(id.nom)}</span>` : ''}</div>`;
      return titre + systemesHtml({ lineup: spec.lineup, lignes: brouillon, u, groupe, l, adv: spec.adv && spec.adv.lignes, advNom: spec.adv ? spec.adv.nom : '', selonDepistage: !!(spec.adv && spec.adv.selonDepistage),
        chimieDe: app ? k => chimieDe(u, { ...l, [groupe === 'D' ? 'tacD' : 'tac']: k }) : null });
    };
    const detail = `<section class="gl-ligne">
      <div class="gl-joueurs">${ROLES.map(r => joueurLigne(u, r)).join('')}</div>
      <div class="gl-etat">
        <div><span class="gl-k">Fit</span> <b>${sansSysteme ? '—' : fitLigneBrut == null ? 'À compléter' : motFit(fitCourant)}</b> <small>${sansSysteme ? 'aucune chimie' : fitLigneBrut == null ? 'ligne incomplète' : `plafond de chimie : ${plafondChimie(chimieMax(fitCourant))}`}</small></div>
        <div><span class="gl-k">Chimie ce soir</span> <span class="gj-barre gl-chimie"><span style="width:${Math.round(chimieDe(u, l))}%"></span></span> <b>${motChimie(chimieDe(u, l))}</b></div>
        ${app && !sansSysteme ? `<div class="gl-appris" title="La chimie s'apprend en gardant ses lignes, et ne se perd pas."><span>🤝 Entente : <b>${motAppris(ententeLigne(app, spec.lineup, u))}</b></span><span>📘 Maîtrise des systèmes : <b>${motAppris(maitriseLigne(app, spec.lineup, u, l))}</b></span></div>` : ''}
      </div>
      ${choixDe('F')}
      ${u < 3 ? choixDe('D') : ''}
      <div class="gl-sec-titre">Agressivité · ${carrureLigne}</div>
      <div class="gl-mot">🪨 Le physique paie aux costauds ; 🪶 les légers prennent des punitions.</div>
      <div class="gl-seg">${AGRESSIVITES.map((A, i) => {
        const b = bilanAgressivite(i, ph);
        // V2.2 : la Moyenne est la RÉFÉRENCE des chiffres ; « par défaut », c'est ce que joue une ligne jamais réglée (`meilleureAgressivite`).
        const verdict = i === 1 ? { txt: 'La référence', bon: null } : b.net > 0.006 ? { txt: '✓ Payant pour cette ligne', bon: true } : b.net < -0.006 ? { txt: '✗ Coûteux pour cette ligne', bon: false } : { txt: '≈ Neutre pour cette ligne', bon: null };
        const defaut = i === meilleureAgressivite(spec.lineup, u) ? [{ txt: 'Par défaut', bon: null }] : [];
        const effets = i === 1 ? [] : chiffresAgressivite(spec.lineup, brouillon, u, i);
        return `<button type="button" class="gl-seg-btn${l.agr === i ? ' on' : ''}" data-agr="${i}">
        <b>${A.ico} ${esc(A.nom)}</b><span class="choix-puces">${puces([verdict, ...defaut, ...effets])}</span></button>`;
      }).join('')}</div>
      <div class="gl-sec-titre">Glace : ${l.sec} s par présence · ${glaceMot(mins, u)}</div>
      <input type="range" class="gl-sec" min="${SEC_MIN}" max="${SEC_MAX}" step="5" value="${l.sec}" aria-label="Secondes de présence de la ${NOMS_LIGNE[u]}">
      <div class="gl-mot">Plus de glace, plus de lancers, et plus d'usure des jambes.</div>
    </section>`;
    m.innerHTML = `<div class="choix-sheet gl-sheet" role="dialog" aria-modal="true" aria-label="Mes lignes">
      ${tete}
      <div class="choix-corps">${advTete}${totauxHtml}${effetsHtml(spec.effets)}${consigne}${roulHtml}${filetHtml}${onglets}${detail}</div>
      <div class="gl-pied">
        ${spec.onBanc ? '<button type="button" class="btn gl-banc">Changer les trios</button>' : ''}
        <button type="button" class="btn go gl-appliquer">${esc(spec.motAppliquer || 'Appliquer')}</button>
      </div>
    </div>`;
    brancher();
  }
  function brancher() {
    m.querySelectorAll('[data-ligne]').forEach(b => { b.onclick = () => { ouverte = Number(b.dataset.ligne); dessiner(); }; });
    m.querySelectorAll('[data-tac]').forEach(b => { b.onclick = () => { brouillon[ouverte].tac = b.dataset.tac; dessiner(); }; });
    m.querySelectorAll('[data-tacd]').forEach(b => { b.onclick = () => { brouillon[ouverte].tacD = b.dataset.tacd; dessiner(); }; });
    m.querySelectorAll('[data-agr]').forEach(b => { b.onclick = () => { brouillon[ouverte].agr = Number(b.dataset.agr); dessiner(); }; });
    const s = m.querySelector('.gl-sec');
    if (s) s.onchange = () => { brouillon[ouverte].sec = Number(s.value); dessiner(); };
    m.querySelectorAll('[data-importance]').forEach(b => { b.onclick = () => { match.importance = b.dataset.importance; match.ad = AD_DE_CONSIGNE[match.importance] ?? 0; dessiner(); }; });
    m.querySelectorAll('[data-roulement]').forEach(b => { b.onclick = () => { roulement = b.dataset.roulement; dessiner(); }; });
    m.querySelectorAll('[data-filet]').forEach(b => { b.onclick = () => { filet = b.dataset.filet; dessiner(); }; });
    m.querySelector('.gl-annuler').onclick = fermer;
    m.querySelector('.gl-appliquer').onclick = () => { fermer(); spec.onAppliquer(brouillon, match, filetSortie(), avecRoul()); };
    const bb = m.querySelector('.gl-banc');
    if (bb) bb.onclick = () => { fermer(); spec.onBanc(); };
  }
  const fermer = () => {
    if (spec.dans) { if (spec.fermer) spec.fermer(); return; }
    m.hidden = true; m.innerHTML = ''; document.body.classList.remove('choix-ouvert');
  };
  if (!spec.dans) { m.hidden = false; document.body.classList.add('choix-ouvert'); }
  dessiner();
}

/* Le résumé d'une ligne pour l'affiche du match : sa tactique et sa chimie. */
export function resumeLignes(lignes, chimie) {
  return lignes.map((l, u) => {
    const T = TACTIQUES[l.tac] || TACTIQUES.hourra, D = u < 3 && SYSTEMES_D[l.tacD] && l.tacD !== 'hourra' ? SYSTEMES_D[l.tacD] : null;
    const c = chimie[u] || 0;
    return `<span class="gl-resume" title="${esc(NOMS_LIGNE[u])} : trio en ${esc(T.nom)}${D ? `, paire en ${esc(D.nom)}` : ''}, chimie ${motChimie(c)}">${T.ico}${D ? D.ico : ''}<small>${'•'.repeat(c >= 70 ? 3 : c >= 35 ? 2 : 1)}</small></span>`;
  }).join('');
}
void SLOTS;

/* ======================================================================
   LA STRATÉGIE D'UNE LIGNE, DANS L'ALIGNEMENT (S78)
   ======================================================================
   JP : *Alignement et stratégie et trio, ça devrait être ensemble*, et *sur
   mobile, trucs comme stratégie … dropdown, modals … pour gagner espace,
   page trop longue, ça fait qu'on perd parfois l'info*.

   « Mes lignes » était une modale À CÔTÉ de l'alignement : on y relisait les
   cinq joueurs qu'on venait de quitter, la tactique que l'en-tête du trio
   répétait déjà, et le banc la répétait une troisième fois en icônes. Les
   réglages vivent maintenant SOUS leur trio, dans un tiroir : fermé, il dit
   en une ligne la tactique, le fit et la glace ; ouvert, il montre les
   commandes et le résumé se tait (il dirait ce que les boutons disent).
   Les noms ne s'y répètent pas — ils sont dans les cases, juste au-dessus :
   ce qui dépend du joueur, la marque du profil demandé, s'écrit par POSTE.

   `ouvrirLignes` reste : la préparation d'avant-match (js/saison.js) a sa
   consigne et son dépistage, et c'est un moment à part.

   spec : { lineup, lignes, chimie, apprentissage, adv: { nom, lignes } | null }
   Rend { sommaire, corps } ; l'appelant pose le tiroir et branche ses
   boutons ([data-tac], [data-tacd], [data-agr], .gl-sec). Le corps ne se
   calcule que pour un tiroir OUVERT (`ouvert`) : l'alignement se redessine
   à chaque signature, et huit fits × sept unités pour des tiroirs fermés,
   c'est du travail que personne ne lit.

   S79 : UN TIROIR PAR TRIO, UN PAR PAIRE (`groupe`). JP : *stratégie des
   def et attaquants différents?* Sous le trio, son système (`tac`), et
   l'agressivité et la glace de la ligne ; sous la paire, son système
   (`tacD`). Le corps commun est `systemesHtml`.
*/
const NOMS_TRIO = ['1er trio', '2e trio', '3e trio', '4e trio'];
export function strategieDeLigne(spec, u, ouvert = true, groupe = 'F') {
  // La photo de l'apprentissage, une fois par rendu pour les sept tiroirs.
  if (spec._app === undefined) spec._app = spec.apprentissage ? apprentissagePhoto(spec.apprentissage) : null;
  const app = spec._app;
  const D = groupe === 'D';
  const l = spec.lignes[u];
  const SYS = D ? SYSTEMES_D : TACTIQUES;
  const cle = SYS[D ? l.tacD : l.tac] ? (D ? l.tacD : l.tac) : 'hourra';
  const S = SYS[cle];
  // La chimie est celle de la LIGNE (trio et paire) : elle s'écrit sous le trio.
  const chimie = patch => (app ? chimieLigne(app, spec.lineup, u, { ...l, ...patch }) : (spec.chimie || [])[u] || 0);
  const mins = glaceDe(spec.lignes, spec.glace || null);
  const fitBrut = S.slots ? fitUnite(spec.lineup, groupe, u, cle) : 0;
  // UNITÉ INCOMPLÈTE (1.0, J1-I) : ni fit, ni chimie, ni système — « À
  // compléter ». Un trio vide lisait « Échec avant 2-1-2 · Mauvais fit ».
  const incomplete = fitBrut == null;
  const sansFit = !S.slots || incomplete;
  const fit = fitBrut ?? 0;
  const classeFit = f => (f >= 55 ? ' bon' : f < 40 ? ' prix' : '');

  // FERMÉ : une ligne. La chimie ne s'y écrit que derrière le banc — avant
  // la saison, elle est « naissante » pour les quatre, et le dire quatre fois
  // n'apprend rien.
  const sommaire = incomplete
    ? `<span class="ln-som-k">Système</span><span class="ln-som-detail"><b>À compléter</b>${D ? '' : `<span>${glaceMot(mins, u, true)}</span>`}</span><span class="ln-som-ouvre" aria-hidden="true"></span>`
    : `<span class="ln-som-k">Système</span><span class="ln-som-detail"><b>${S.ico} ${esc(S.nom)}</b>${sansFit ? '' : `<span class="ln-som-fit${classeFit(fit)}">${motFit(fit)}</span>`}${D ? '' : `${app ? `<span>chimie ${motChimie(chimie({}))}</span>` : ''}<span>${glaceMot(mins, u, true)}</span>`}</span><span class="ln-som-ouvre" aria-hidden="true"></span>`;
  if (!ouvert) return { sommaire, corps: '' };

  const choix = systemesHtml({ lineup: spec.lineup, lignes: spec.lignes, u, groupe, l, adv: spec.adv && spec.adv.lignes, advNom: spec.adv ? spec.adv.nom : '', selonDepistage: !!(spec.adv && spec.adv.selonDepistage),
    chimieDe: app ? k => chimie({ [D ? 'tacD' : 'tac']: k }) : null });
  if (D) return { sommaire, corps: `${choix}<div class="gl-mot">Chimie, agressivité et glace : avec le ${NOMS_TRIO[u]}.</div>` };

  const ph = physiqueLigne(spec.lineup, u);
  const carrure = ph >= 0.56 ? '🪨 ligne costaude' : ph <= 0.44 ? '🪶 ligne légère' : 'ligne moyenne';
  const agr = AGRESSIVITES.map((A, i) => {
    const b = bilanAgressivite(i, ph);
    const verdict = `${i === 1 ? 'la référence' : b.net > 0.006 ? '✓ payant' : b.net < -0.006 ? '✗ coûteux' : '≈ neutre'}${i === meilleureAgressivite(spec.lineup, u) ? ' · par défaut' : ''}`;
    return `<button type="button" class="gl-seg-btn${l.agr === i ? ' on' : ''}" data-agr="${i}" aria-pressed="${l.agr === i}"><b>${A.ico} ${esc(A.nom)}</b><small>${verdict}</small></button>`;
  }).join('');
  const effetsAgr = l.agr === 1 ? [] : chiffresAgressivite(spec.lineup, spec.lignes, u, l.agr);
  const avecPaire = u < 3 && !(l.tac === 'hourra' && l.tacD === 'hourra');
  const corps = `
    ${choix}
    ${incomplete || (sansFit && !avecPaire) || fitDeLigne(spec.lineup, u, l) == null ? '' : `<div class="ln-etat"><span>Plafond de chimie${u < 3 ? ' (trio et paire)' : ''} : <b>${plafondChimie(chimieMax(fitDeLigne(spec.lineup, u, l)))}</b></span>${app ? `<span>Ce soir : <b>${motChimie(chimie({}))}</b></span><span>🤝 Entente : <b>${motAppris(ententeLigne(app, spec.lineup, u))}</b></span><span>📘 Maîtrise : <b>${motAppris(maitriseLigne(app, spec.lineup, u, l))}</b></span>` : ''}</div>`}
    <div class="gl-sec-titre">Agressivité · ${carrure}</div>
    <div class="gl-seg gl-seg-court ln-agr">${agr}</div>
    ${effetsAgr.length ? `<div class="choix-puces ln-agr-effets">${puces(effetsAgr)}</div>` : ''}
    <div class="gl-sec-titre">Glace : ${l.sec} s par présence · ${glaceMot(mins, u)}</div>
    <input type="range" class="gl-sec" min="${SEC_MIN}" max="${SEC_MAX}" step="5" value="${l.sec}" aria-label="Secondes de présence de la ${NOMS_LIGNE[u]}">
    <div class="gl-mot">Plus de glace, plus de lancers, et plus d'usure des jambes.</div>`;
  return { sommaire, corps };
}

/*
 * LE RÉGLAGE D'UNE UNITÉ, EN FENÊTRE (1.0, les lignes). JP : *la page des
 * lignes et stratégie, au lieu de dropdown, modal*. Le tiroir sous chaque
 * trio est devenu une rangée qu'on touche : elle ouvre cette fenêtre, avec les
 * mêmes systèmes, le même fit, les mêmes chiffres. On essaie (rien ne
 * s'applique en touchant), puis « Appliquer » décide ; ✕ ou « Annuler » ne
 * change rien. `onAppliquer(ligne)` reçoit la ligne réglée (tac, tacD, agr, sec).
 */
const NOMS_PAIRE = ['1re paire', '2e paire', '3e paire'];
export function ouvrirStrategie(spec, u, groupe, onAppliquer) {
  const m = $('lignesModal');
  if (!m) return;
  const brouillon = spec.lignes.map(l => ({ ...l }));
  const app = spec.apprentissage ? apprentissagePhoto(spec.apprentissage) : null;
  const titre = groupe === 'D' ? NOMS_PAIRE[u] : NOMS_TRIO[u];
  const fermer = () => { m.hidden = true; m.innerHTML = ''; document.body.classList.remove('choix-ouvert'); };
  function dessiner() {
    const { corps } = strategieDeLigne({ ...spec, lignes: brouillon, _app: app }, u, true, groupe);
    m.innerHTML = `<div class="choix-sheet gl-sheet ln-fenetre" role="dialog" aria-modal="true" aria-label="Système du ${esc(titre)}" data-g="${groupe}" data-u="${u}">
      <div class="choix-tete">
        <span class="choix-ico">${groupe === 'D' ? '🛡️' : '🏒'}</span>
        <div class="choix-titres"><div class="choix-titre">${esc(titre)} · son système</div><div class="choix-irl">Touche un système pour le lire, puis « Appliquer ».</div></div>
        <button type="button" class="close-btn gl-annuler" aria-label="Fermer sans rien changer" title="Fermer sans rien changer">✕</button>
      </div>
      <div class="choix-corps">${corps}</div>
      <div class="gl-pied"><button type="button" class="btn gl-annuler">Annuler</button><button type="button" class="btn go gl-appliquer">Appliquer</button></div>
    </div>`;
    m.querySelectorAll('[data-tac]').forEach(b => { b.onclick = () => { brouillon[u].tac = b.dataset.tac; dessiner(); }; });
    m.querySelectorAll('[data-tacd]').forEach(b => { b.onclick = () => { brouillon[u].tacD = b.dataset.tacd; dessiner(); }; });
    m.querySelectorAll('[data-agr]').forEach(b => { b.onclick = () => { brouillon[u].agr = Number(b.dataset.agr); dessiner(); }; });
    const sec = m.querySelector('.gl-sec');
    if (sec) sec.onchange = () => { brouillon[u].sec = Number(sec.value); dessiner(); };
    m.querySelectorAll('.gl-annuler').forEach(b => { b.onclick = fermer; });
    m.querySelector('.gl-appliquer').onclick = () => { fermer(); onAppliquer({ ...brouillon[u] }); };
  }
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  dessiner();
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
export function depistageHtml(pistes, { nomAdv = 'Eux', prep = [], choisir = false, fx = null } = {}) {
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
  return `<div class="depistage${choisir ? ' choisir' : ''}">
    <div class="gl-k">🔎 Le dépistage${qui} : leur plan probable</div>
    <div class="dep-pistes">${pistes.map(ligne).join('')}</div>
    ${choisir ? `<div class="dep-regle"><span class="puce bon">🎯 Vise juste : ${esc(juste)}</span>${justeN ? `<span class="puce bon detail">${esc(justeN)}</span>` : ''}<span class="puce prix">💥 Rate : ${esc(rate)}</span>${rateN ? `<span class="puce prix detail">${esc(rateN)}</span>` : ''}<span class="puce neutre">Sans préparation : rien ne change</span></div>` : ''}
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
/*
 * UNE CARTE DE MATCH DURE UN SOIR (1.0, le tempo) : « 1 but de moins tous les 16 matchs » n'y veut rien dire, et
 * depuis que le style se lit des deux côtés (tirs pour ET contre) ces lignes faisaient passer la carte sous les
 * boutons. Elles tombent quand la carte dit déjà autre chose ; seules, elles restent.
 */
const unSoir = mots => { const autres = mots.filter(m => !/ tous les \d+ matchs/.test(m.txt)); return autres.length ? autres : mots; };
function regleDeCarte(C) {
  if (!C) return [];
  const out = [];
  const txt = e => motsEnChiffres(e).map(m => m.txt).join(', ');
  // Ce qui s'ajoute à chaque carte (jouée, ou dans une main) : le chiffre de match d'un pas, dit « par carte … ».
  const parCarte = (e, quand) => { const m = motsEnChiffres(e, null, { par: quand }).filter(x => x.cle !== 'rien'); return m.length ? m.map(x => x.txt).join(', ') : `à peine perceptible ${quand}`; };
  if (C.plein) {
    // Une synergie : sa condition, puis ce qu'elle rapporte à son maximum, en chiffres de match pour ton club.
    const m = motsEnChiffres(C.plein).filter(x => x.cle !== 'rien');
    out.push({ txt: `${C.quand} : ${C.seuil ? '' : 'jusqu\'à '}${m.length ? m.map(x => x.txt).join(', ') : 'à peine perceptible'}`, bon: true });
  } else if (C.regle) out.push({ txt: C.regle, bon: C.maudite ? false : true });
  out.push(...unSoir(motsEnChiffres(C.effet || null)));
  for (const m of unSoir(motsEnChiffres(C.adv || null, null, { eux: true }))) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
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
/* L'ancien nom : les écrans de récompense et de deck l'appellent encore. */
const motsDeCarteMatch = regleDeCarte;
/* Une carte de LEUR main, en puces de ton point de vue : ce qui les aide est rouge pour toi. */
function motsDeCarteAdverse(C, echelle = 1) {
  if (!C) return [];
  const out = [];
  for (const m of unSoir(motsEnChiffres(C.effet || null, null, { eux: true }))) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  // Ce qui te vise grandit avec le soir, pour eux aussi (S80).
  for (const m of unSoir(motsEnChiffres(grandirEffet(C.adv || null, echelle)))) out.push({ txt: `Toi : ${m.txt}`, bon: m.bon });
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
/* Une carte de match en option d'`ouvrirChoix` (une récompense, un retrait). */
export function optionDeCarteMatch(cle) {
  const C = CARTES_MATCH[cle];
  return {
    cle, rarete: C.maudite ? 'commune' : C.rarete, ico: C.ico, nom: C.nom,
    type: `${GENRES_CARTE[C.genre] || ''} · ${C.injouable ? 'injouable' : `${C.cout} élan`}`,
    texte: C.texte, coin: C.injouable ? '✕' : String(C.cout), mots: motsDeCarteMatch(C), genreCarte: C.genre, dessin: cle,
  };
}
const carteDeMatch = (cle, i, etat, cout = null) => {
  const o = optionDeCarteMatch(cle);
  const coin = cout != null && CARTES_MATCH[cle] && cout < CARTES_MATCH[cle].cout ? `<s>${CARTES_MATCH[cle].cout}</s>${cout}` : esc(o.coin);
  return carteHtml({
    cle: String(i), rarete: o.rarete, i, ico: o.ico, nomHtml: esc(o.nom), typeHtml: esc(o.type),
    texteHtml: `<i class="tc-ambiance">${esc(o.texte)}</i>`, coinHtml: coin, pucesHtml: puces(o.mots), genreCarte: o.genreCarte, dessin: o.dessin,
  }).replace('class="choix-option tc', `class="choix-option tc main-carte${String(cle).endsWith('+') ? ' plus' : ''}${etat ? ` ${etat}` : ''}`);
};

/* Combine des effets de match : les facteurs se multiplient, les minutes aussi. */
function combiner(effets) {
  const out = {};
  for (const e of effets) for (const [k, v] of Object.entries(e)) {
    if (['source', 'nom', 'ico'].includes(k)) continue;
    if (Array.isArray(v)) out[k] = (out[k] || v.map(() => 1)).map((x, i) => x * (v[i] ?? 1));
    else if (typeof v === 'number') out[k] = (out[k] ?? 1) * v;
  }
  return out;
}

/*
 * LA MAIN D'UN MATCH (S74), en plein écran. Cinq cartes, trois d'énergie :
 * on touche une carte pour la jouer, et ce qu'elle fait s'ajoute à l'aperçu —
 * calculé par le moteur lui-même (`effetsDesCartes`), synergies comprises,
 * sauf l'issue d'un pari, qui ne se sait qu'au match. Une carte qui pige
 * ajoute la suite de la pioche à la main. « Recommencer » rend la main du
 * début ; « Jouer ces cartes » décide (zéro carte, c'est aussi un choix).
 *
 * L'ÉCRAN DE COMBAT (V5, phase 1). JP : *s'assurer que chaque semaine et gros match soit des nodes, des
 * combats*. Un gros match ne s'arrête plus trois fois : l'intention d'en face (l'enjeu, leur main, leurs
 * pistes) en haut, l'avant-match en deux cartes de vestiaire à 0 élan dont on garde une, puis ta main.
 * Le même bouton décide tout : `onJouer` reçoit la carte de vestiaire, et la saison en fait les deux mêmes
 * décisions qu'avant (`{ avant }` puis `{ main }`). Une carte de vestiaire qui est un pari se joue au dé
 * d'abord (`sceneDuDe`), et « Autre réponse » ramène à la main.
 *
 * spec : { titre, sousTitre, recit, contexte, equipe, main, pioche, deck,
 *          ajustements (séries : [{ cle, ico, nom, bon, prix, … }] ou null),
 *          enjeu(vestiaire) → html, vestiaire : { ico, titre, recit, joueurs, ouDe, cadre, options, pris,
 *          lancer(cle, args) → le dé d'un pari }, onJouer(jouees, enMain, ajustement, prep, vestiaire), motJouer }
 */
export function ouvrirMainDeMatch(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  let main, pioche, jouees, energie, voirDeck = false, aj = null, prep = [];
  const V = spec.vestiaire || null, nV = V ? nommer(V) : null;
  let vest = V ? V.pris || null : null;
  const manque = () => (spec.ajustements && !aj ? 'Choisis ton ajustement' : V && !vest ? 'Choisis ta carte de vestiaire' : '');
  const depart = () => { main = spec.main.slice(); pioche = (spec.pioche || []).slice(); jouees = []; energie = ENERGIE_MAIN; };
  depart();
  const joue = new Set();          // les rangs de la main déjà joués
  let premier = true, pigees = new Set();
  const dessiner = () => {
    const defile = m.querySelector('.choix-main');
    const x = defile ? defile.scrollLeft : 0;
    // L'ÉCRAN NE REMONTE PAS quand on touche une carte (S80, JP : *pas remonter quand choix de carte
    // prématch*) : la main se redessine, mais on reste où on lisait — la feuille et son corps gardent
    // leur défilement vertical, comme la rangée des cartes garde le sien.
    const hauts = [m, m.querySelector('.choix-sheet'), m.querySelector('.choix-corps')].map(e => (e ? e.scrollTop : 0));
    // Leur plan, déplié, le reste d'une carte à l'autre : il se refermait à
    // chaque carte touchée, et on le lit justement en choisissant (QA S74b).
    const planOuvert = !!m.querySelector('.main-plan[open]');
    const cartes = main.map((c, i) => {
      const C = CARTES_MATCH[c];
      const etat = joue.has(i) ? 'jouee' : C.injouable ? 'injouable' : energieDepensee([...jouees, c]) < 0 ? 'trop-cher' : '';
      return carteDeMatch(c, i, [etat, pigees.has(i) ? 'pige' : ''].filter(Boolean).join(' '), joue.has(i) ? null : coutDe(c, [...jouees, c]));
    }).join('');
    const sansPari = jouees.filter(c => !CARTES_MATCH[c].pari);
    // L'échelle du soir (S80) : ce que le moteur jouera, les cartes qui visent l'adversaire comprises.
    const echelle = spec.echelle || 1;
    const fx = effetsDesCartes(spec.equipe, { jouees: sansPari, enMain: main.filter((c, i) => !joue.has(i) && CARTES_MATCH[c].enMain) }, 'apercu', { echelle });
    const mots = [...motsEnChiffres(combiner(fx.effets))];
    for (const x2 of motsEnChiffres(combiner(fx.adv), null, { eux: true })) mots.push({ txt: `Eux : ${x2.txt}`, bon: x2.bon == null ? null : !x2.bon });
    if (fx.adv.length && echelle > 1) mots.push({ txt: `📈 Ce soir, ce qui vise l'adversaire vaut ×${String(Math.round(echelle * 100) / 100).replace('.', ',')}`, bon: true });
    if (fx.lire) mots.push({ txt: 'Leur plan tombe', bon: true });
    if (fx.annule) mots.push({ txt: 'Leur main ne fait rien', bon: true });
    if (fx.energieTous) mots.push({ txt: `Tes patineurs : jambes +${fx.energieTous}`, bon: true });
    // LE DÉPISTAGE DU SOIR (S76) : les cartes jouées le resserrent, et ta préparation suit.
    const pistes = pistesDuRapport(spec.depistage, { planReel: spec.planReel, ecarte: fx.ecarte, revele: fx.revele });
    if (fx.revele && spec.planReel) prep = [spec.planReel];
    prep = prep.filter(k => pistes.some(x => x.plan === k && !x.ecarte)).slice(-(fx.planB ? 2 : 1));
    const chance = pistes.filter(x => prep.includes(x.plan)).reduce((a, x) => a + x.p, 0);
    if (prep.length) mots.push({ txt: `🎯 Préparé : ${prep.map(k => PLANS_ADV[k] ? PLANS_ADV[k].nom : k).join(' et ')} · ${chance} % de viser juste`, bon: chance >= 50 ? true : null });
    for (const c of jouees) if (CARTES_MATCH[c].pari) mots.push({ txt: `🎲 ${CARTES_MATCH[c].nom} : au match`, bon: null });
    const orbes = Array.from({ length: Math.max(ENERGIE_MAIN, energie) }, (_, i) => `<i class="main-orbe${i < energie ? ' plein' : ''}"></i>`).join('');
    const deck = (spec.deck || []).slice().sort((a, b) => CARTES_MATCH[a].cout - CARTES_MATCH[b].cout || CARTES_MATCH[a].nom.localeCompare(CARTES_MATCH[b].nom, 'fr'));
    // LES CARTES DE VESTIAIRE : l'avant-match, deux cartes à 0 élan ; on en garde une (déjà gardée : elle reste dite).
    const vestiaire = V ? `<div class="main-vestiaire">
      <div class="gl-k">${V.ico} ${esc(V.titre)} · garde une carte</div>
      ${V.recit ? `<p class="main-vest-recit">${nV.sub(V.recit)}</p>` : ''}
      <div class="main-vest-rang">${V.options.map(o => {
        const { duree: _d, ...canaux } = o;
        const mv = [...motsEnChiffres(canaux, Object.keys(canauxDe(canaux)).length ? o.duree : null, V.cadre), ...motsDeCarte(o, nV.noms)];
        const forme = formeDe(o);
        return `<button type="button" class="main-vest${vest === o.cle ? ' on' : ''}" data-vest="${esc(o.cle)}"${V.pris ? ' disabled' : ''}>
          <span class="main-vest-tete"><b>${nV.sub(o.nom)}</b><span class="main-vest-coin" title="0 élan">0</span></span>
          ${forme ? `<span class="choix-forme">${esc(forme)}</span>` : ''}
          ${o.bon ? `<span class="choix-option-bon">+ ${nV.sub(o.bon)}</span>` : ''}
          ${o.prix ? `<span class="choix-option-prix">− ${nV.sub(o.prix)}</span>` : ''}
          <span class="choix-puces">${puces(enMotsEtChiffres(mv.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nV.nom).replace(/\{noms\}/g, nV.noms) }))), x => !!x.chiffre)}</span>
        </button>`;
      }).join('')}</div>
    </div>` : '';
    m.innerHTML = `<div class="choix-sheet choix-cartes main-sheet${chiffresOuverts() ? ' chiffres' : ''}${auxCouleurs(spec.couleurs)}" data-genre="main" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
      <div class="choix-tete">
        <span class="choix-ico">⚔️</span>
        <div class="choix-titres"><div class="choix-badge">Gros match</div><div class="choix-titre">${esc(spec.titre)}</div>${spec.sousTitre ? `<div class="choix-irl">${esc(spec.sousTitre)}</div>` : ''}</div>
      </div>
      <div class="choix-corps">
        ${spec.recit ? `<p class="choix-recit">${esc(spec.recit)}</p>` : ''}
        ${spec.enjeu ? `<div class="main-enjeu choix-puces">${spec.enjeu(vest)}</div>` : ''}
        ${spec.contexte || ''}
        ${spec.depistage ? depistageHtml(pistes, { nomAdv: spec.nomAdv || 'Eux', prep, choisir: true, fx }) : ''}
        ${vestiaire}
        ${spec.ajustements ? `<div class="main-ajuste"><div class="gl-k">Ton ajustement pour ce match</div><div class="main-ajuste-rang">${spec.ajustements.map(o => {
          const { cle: _c, ico: _i, nom: _n, bon: _b, prix: _p, si: _s, pari: _pa, gardienAux: _g, ...canaux } = o;
          const mots = [...motsEnChiffres(canaux), ...(o.pari ? [{ txt: `🎲 ${majuscule(facesMot(facesDuPari(o.pari.chance)))} : ${motsEnChiffres(o.pari.gagne).map(x => x.txt).join(', ') || 'rien'}`, bon: true }, { txt: `🎲 sinon : ${motsEnChiffres(o.pari.perd).map(x => x.txt).join(', ') || 'rien'}`, bon: false }] : []), ...(o.gardienAux ? [{ txt: '🧤 L\'auxiliaire au filet', bon: null }] : [])];
          return `<button type="button" class="main-aj${aj === o.cle ? ' on' : ''}" data-aj="${esc(o.cle)}"><b>${o.ico} ${esc(o.nom)}</b><small>${esc(o.bon || '')}</small><span class="choix-puces">${puces(mots)}</span></button>`;
        }).join('')}</div></div>` : ''}
        <div class="main-energie" aria-label="Élan : ${energie}"><span class="gl-k">Élan</span><span class="main-orbes">${orbes}</span><b>${energie}</b>
          <span class="main-pioche" title="Les cartes qui restent à piger ce match">🂠 ${pioche.length}</span></div>
        <div class="choix-options choix-main${premier ? ' donne' : ''}">${cartes}</div>
        <div class="main-apercu">
          <div class="gl-k">Ce soir, sur la glace</div>
          ${jouees.length ? `<div class="main-jouees">${jouees.map(c => `<span class="main-jouee">${CARTES_MATCH[c].ico} ${esc(CARTES_MATCH[c].nom)}</span>`).join('')}</div>` : '<div class="main-vide">Aucune carte jouée. Touche une carte pour la jouer.</div>'}
          ${mots.length ? `<div class="choix-puces">${puces(mots)}</div>` : ''}
        </div>
        ${spec.stats || ''}
        <div class="main-boutons">
          <button type="button" class="btn go main-jouer"${manque() ? ' disabled' : ''}>${esc(manque() || (jouees.length ? (spec.motJouer || 'Jouer ces cartes') : 'Ne rien jouer'))}</button>
        </div>
        <div class="main-outils">
          <button type="button" class="btn main-reprendre"${jouees.length ? '' : ' disabled'}>Recommencer la main</button>
          <button type="button" class="btn main-deck">${voirDeck ? 'Cacher mon deck' : `Mon deck · ${deck.length}`}</button>
          ${spec.depistage ? `<button type="button" class="btn main-chiffres" aria-pressed="${chiffresOuverts()}">Les chiffres</button>` : ''}
          ${spec.onAdjoint ? '<button type="button" class="btn main-adjoint" title="Il joue tes mains et garde le cap aux entractes, jusqu\'à la fin de la série">L\'adjoint joue cette série</button>' : ''}
        </div>
        ${voirDeck ? `<div class="deck-grille">${deck.map(c => `<span class="deck-mini tc-${CARTES_MATCH[c].maudite ? 'commune' : CARTES_MATCH[c].rarete}${CARTES_MATCH[c].maudite ? ' maudite' : ''}" title="${esc(CARTES_MATCH[c].texte)}"><b>${CARTES_MATCH[c].injouable ? '✕' : CARTES_MATCH[c].cout}</b>${CARTES_MATCH[c].ico} ${esc(CARTES_MATCH[c].nom)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
    const nd = m.querySelector('.choix-main');
    if (nd) nd.scrollLeft = x;
    [m, m.querySelector('.choix-sheet'), m.querySelector('.choix-corps')].forEach((e, i) => { if (e && hauts[i]) e.scrollTop = hauts[i]; });
    if (planOuvert) { const pl = m.querySelector('.main-plan'); if (pl) pl.open = true; }
    pointsDeBande(m);
    premier = false; pigees = new Set();
    m.querySelectorAll('.main-carte').forEach(b => {
      b.onclick = () => {
        const i = Number(b.dataset.choix), c = main[i], C = CARTES_MATCH[c];
        if (joue.has(i) || C.injouable || energieDepensee([...jouees, c]) < 0) { jouerSon('refus'); return; }
        jouerSon('joue');
        joue.add(i); jouees.push(c);
        // Le coût se relit sur TOUTE la main : un rabais joué après rend l'énergie des cartes d'avant (S76).
        energie = energieDepensee(jouees);
        if (C.pioche) { const n0 = main.length; main.push(...pioche.splice(0, C.pioche)); for (let k = n0; k < main.length; k++) pigees.add(k); }
        dessiner();
      };
    });
    m.querySelector('.main-jouer').onclick = () => {
      if (manque()) return;
      const enMain = main.filter((c, i) => !joue.has(i) && CARTES_MATCH[c].enMain);
      const args = [jouees.slice(), enMain, aj, prep.slice()];
      // Une carte de vestiaire neuve qui est un pari : le dé d'abord, puis tout part ensemble.
      const ov = V && !V.pris && V.options.find(o => o.cle === vest);
      if (ov && ov.pari && typeof V.lancer === 'function') { sceneDuDe(m, { lancer: c => V.lancer(c, args), onChoix: c => spec.onJouer(...args, c) }, ov, nV.sub, fermer, dessiner); return; }
      fermer(true);
      spec.onJouer(...args, V && !V.pris ? vest : null);
    };
    m.querySelectorAll('.main-vest[data-vest]').forEach(b => { b.onclick = () => { vest = b.dataset.vest; jouerSon('joue'); dessiner(); }; });
    // Me préparer : toucher une piste. Une seule (deux avec « Le plan B ») ; la dernière touchée reste.
    m.querySelectorAll('.dep-piste[data-plan]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.plan;
        prep = prep.includes(k) ? prep.filter(x => x !== k) : [...prep, k];
        jouerSon('joue');
        dessiner();
      };
    });
    m.querySelectorAll('.main-aj').forEach(b => { b.onclick = () => { aj = b.dataset.aj; jouerSon('joue'); dessiner(); }; });
    m.querySelector('.main-reprendre').onclick = () => { depart(); joue.clear(); premier = true; aj = null; prep = []; vest = V ? V.pris || null : null; dessiner(); };
    m.querySelector('.main-deck').onclick = () => { voirDeck = !voirDeck; dessiner(); };
    // LES CHIFFRES (V3) : la préparation se lit en mots ; ses chiffres se déplient, comme dans un choix.
    const bc = m.querySelector('.main-chiffres');
    if (bc) bc.onclick = () => { const o = basculerChiffres(); m.querySelector('.choix-sheet').classList.toggle('chiffres', o); bc.setAttribute('aria-pressed', String(o)); };
    const adj = m.querySelector('.main-adjoint');
    if (adj) adj.onclick = () => { fermer(true); spec.onAdjoint(); };
    // Le focus reste DANS la main : le clavier ne tombe jamais sur la page dessous.
    (m.querySelector('.main-jouer:not(:disabled)') || m.querySelector('.main-vest:not(:disabled), .main-aj') || m.querySelector('.main-jouer')).focus({ preventScroll: true });
  };
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    void silencieux;
  };
  fermerChoixCourant = fermer;
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  jouerSon('donne');
  dessiner();
  return () => fermer(true);
}

/* Mon deck, à lire : toutes les cartes, rangées par coût. */
export function ouvrirDeck({ deck, titre = 'Mon deck', recit = '' }) {
  const tri = deck.slice().sort((a, b) => CARTES_MATCH[a].cout - CARTES_MATCH[b].cout || CARTES_MATCH[a].nom.localeCompare(CARTES_MATCH[b].nom, 'fr'));
  const compte = new Map();
  for (const c of tri) compte.set(c, (compte.get(c) || 0) + 1);
  return ouvrirChoix({
    ico: '🃏', titre: `${titre} · ${deck.length} cartes`, cartes: true, genre: 'deck', fermable: true, motFermer: 'Fermer',
    recit: recit || 'Tes cartes de match : avant chaque gros match et chaque match de séries, tu en piges cinq et tu as trois d\'élan pour les jouer.',
    lecture: true,
    options: [...compte.entries()].map(([c, n]) => ({ ...optionDeCarteMatch(c), cle: `vue:${c}`, nom: n > 1 ? `${CARTES_MATCH[c].nom} ×${n}` : CARTES_MATCH[c].nom })),
    onChoix: () => {},
  });
}
void RARETES;
