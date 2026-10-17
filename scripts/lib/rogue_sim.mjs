/*
 * UNE RUN ROGUE JOUÉE PAR UN ROBOT (S80) — la mesure de la courbe.
 *
 * JP : *je veux que ça prenne plusieurs saisons et upgrades gagner la coupe* ;
 * puis *en roguelike, nouvelle saison veut dire continuer avec base des
 * cartes ramassé qui sont pas des consommables, débloquées, etc*. Pour le
 * vérifier, il faut JOUER des runs : les plombiers, les cartes du classeur au
 * départ, les packs achetés avec les jetons que les résultats rapportent, les
 * signatures (qui sort : le moins utile), la saison au jour le jour, les
 * séries, puis la saison suivante de la run avec des plombiers neufs et les
 * meilleurs de l'équipe finie (1.0, `GARDES_DE_SAISON`) — jusqu'à la
 * Coupe, ou jusqu'aux séries ratées. Les écussons, les jalons, les
 * déblocages qu'ils achètent, et la run suivante.
 *
 * Le robot est GROSSIER exprès : il achète le pack qu'il peut, signe le
 * joueur que l'alignement automatique prendrait, ne joue aucune carte en
 * saison et, en séries, la main de l'adjoint. Un
 * humain fait mieux ; ce qui compte, c'est la PENTE d'un niveau de
 * déblocages à l'autre, au même robot.
 *
 * LES TROIS POLITIQUES (V9, tranche 2 ; docs/refonte-v9.md § 10). Le jeu est
 * profond si la façon de mener compte : sur les mêmes dés, un gérant attentif
 * et un gérant distrait ne finissent pas au même rang. `politique` :
 *   - 'defaut' : le robot grossier ci-dessus (check_rogue, check_robot) ;
 *   - 'attentif' : il lit le moteur. Au départ, il prend le coach dont le plan
 *     rend le plus à son effectif (V9, parmi ceux que son prestige ouvre) ; il
 *     signe la carte du pack qui monte le plus ses buts nets, lus au moteur,
 *     plan compris ; il aligne au mieux (`alignementAuMieux`, le bouton
 *     « Aligner au mieux ») au départ et après chaque signature ; il joue chaque
 *     gros match en duel (V9, tranche 5) : il répond à chaque intention, puis
 *     joue ce que l'adjoint jouerait (scripts/lib/duel.mjs) ;
 *   - 'distrait' : il clique sans lire. Un coach au hasard ; une carte du pack au hasard, et qui
 *     sort au hasard (le nouveau prend sa case) ; un système au hasard par
 *     ligne, parmi ceux que la fenêtre offre ; aux gros matchs et en séries, une réponse sur deux et une
 *     main jouable au hasard ; des rivaux, des gardés et des lotos au hasard. Ses
 *     clics ont leur générateur : les adversaires et les dés restent ceux des
 *     deux autres.
 *
 * LES EXIGENCES (V9, tranche 8, js/rogue.js `EXIGENCES`) : `exigence`, le cran de la run, passe par les mêmes canaux
 * qu'au jeu — le plafond, le prix des packs, le classeur et les lotos, le quota de Soutien, le barème, le mandat, les
 * gardés, les médailles. Une Coupe compte au méta (`coupes`) et ouvre le cran suivant (`exigence`).
 *
 * Tout est pur : un générateur semé par la graine de la run, et le moteur
 * sous sa graine. Les tirages de packs imitent `tirerPackJoueurs`
 * (js/game.js) — la moitié productive d'une saison, le quart du haut d'un
 * talent, les étoiles — sans la page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, autoRoster, registerHiddenRatings, getHiddenRatings, getPositionPenalty, getPlayerKey, getPersonKey,
  createTeam, creerLigue, jouerJournee, bilanLigue, creerSeries, jouerMatchSeries, connaitre, photoAlignement,
  ecoleDe, rivauxOfferts, RIVAUX, SYSTEMES_DU_PLAN, avecHasardIsole, lignesAuMieux, activeLineup, teamStrength,
} from '../../js/sim.js';
import { DECK_DEPART } from '../../js/combat.js';
import { robotDuel } from './duel.mjs';
import { galonsDeLaSaison, GALONS_MAX } from '../../js/galons.js';
import { alignementAuMieux, chiffresDuSoir } from '../../js/impact.js';
import { effetDePalier } from '../../js/coachs.js';
import { carteDe, varianteTiree, COTES_VARIANTES, EDITIONS } from '../../js/rarete.js';
import { TIERS, PACKS_JOUEURS, SKILLS, hausseDesPacks, packDeSerie, tierDuPack, niveauxDuPack } from '../../js/packs.js';
import { niveauDe, NIVEAUX, joueursParNiveau } from '../../js/niveaux.js';
import {
  JETONS, jetonsDeDepart, nombreGardes, aDebloque, plafondDuVestiaire, ecussonsDeLaSaison, ecussonsDesSeries,
  DEBLOCAGES, departDuClasseur, lotosDeSaison, tirageDuClasseur, budgetDuClasseur, reservesDeLaRun, PLAFOND_ROGUE, ESPACE_DE_DEPART, jalonsAtteints, mandatRempli, baremeRogue, primesDesFils,
  soutiensDuDepart, tirageDuDepart, rangDePrestige, PRESTIGES, PRIME_DECOUVERTE, coachsOuverts, exigencesDe, plafondDeSaison, gardesDeLaRun,
  LIGUE_PARTS, ligueDe, niveauDeLigue, habillerLaLigue,
  packsOuverts, monteeDesPacks,
} from '../../js/rogue.js';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIR = path.join(ROOT, 'data', 'seasons');
export const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort();
const CACHE = new Map();
export function shard(s) {
  if (!CACHE.has(s)) {
    const e = JSON.parse(fs.readFileSync(path.join(DIR, `${s}.json`), 'utf8'));
    e.players.forEach(registerHiddenRatings);
    e.byTeam = {};
    for (const p of e.players) (e.byTeam[p.t] = e.byTeam[p.t] || []).push(p);
    CACHE.set(s, e);
  }
  return CACHE.get(s);
}

/* Un générateur pur (sfc32), semé par des mots. */
export function generateur(...mots) {
  const txt = mots.join('|');
  let h = 1779033703 ^ txt.length;
  for (const c of txt) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  const graine = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  let a = graine(), b = graine(), c = graine(), d = graine();
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export const groupe = p => (p.p === 'G' ? 'G' : ['D', 'LD', 'RD'].includes(p.p) ? 'D' : 'F');
const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
const v = p => getHiddenRatings(p).v;
const copie = p => ({ ...p });

/* Les étoiles d'une saison : le 4 % du haut des pointeurs, le 8 % des gardiens (js/game.js `estEtoile`). */
const SEUILS = new Map();
function estEtoile(p) {
  let s = SEUILS.get(p.s);
  if (!s) {
    const e = shard(p.s);
    const gpMax = Math.max(1, ...e.players.map(x => x.gp || 0));
    const minP = Math.min(40, Math.floor(gpMax * 0.5)), minG = Math.min(30, Math.floor(gpMax * 0.35));
    const pts = x => x.pt ?? ((x.g || 0) + (x.a || 0));
    const pat = e.players.filter(x => x.p !== 'G' && (x.gp || 0) >= minP).map(pts).sort((a, b) => b - a);
    const gar = e.players.filter(x => x.p === 'G' && (x.gp || 0) >= minG).map(x => x.sv || 0).sort((a, b) => b - a);
    s = { minP, minG, pts: pat.length ? pat[Math.max(0, Math.ceil(pat.length * 0.04) - 1)] : Infinity, sv: gar.length ? gar[Math.max(0, Math.ceil(gar.length * 0.08) - 1)] : Infinity };
    SEUILS.set(p.s, s);
  }
  return p.p === 'G' ? (p.gp || 0) >= s.minG && (p.sv || 0) >= s.sv : (p.gp || 0) >= s.minP && (p.pt ?? ((p.g || 0) + (p.a || 0))) >= s.pts;
}

/*
 * LES PLOMBIERS (js/rogue-jeu.js `plombiersDeLaLigue`) : huit saisons, du 10e au 30e centile de production (30e-50e
 * débloqué), et parmi eux les pires contrats, le tiers le mieux payé (V9, tranche 4 : le plafond qui mord).
 */
const PART_DES_PIRES = 1 / 3;
function plombiers(rnd, meta, exclus) {
  const saisons = SAISONS.slice(), choisies = [];
  while (choisies.length < 8) choisies.push(saisons.splice(Math.floor(rnd() * saisons.length), 1)[0]);
  const [bas, haut] = aDebloque(meta, 'plombiersPlus') ? [0.3, 0.5] : [0.1, 0.3];
  const pires = tranche => tranche.slice().sort((a, b) => (b.$ || 0) - (a.$ || 0) || (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1)).slice(0, Math.max(1, Math.ceil(tranche.length * PART_DES_PIRES)));
  const pool = [];
  for (const s of choisies) {
    const e = shard(s);
    for (const g of ['F', 'D', 'G']) {
      const reg = e.players.filter(p => groupe(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 30) && !exclus.has(getPersonKey(p))).sort((a, b) => prod(a) - prod(b));
      const tranche = pires(reg.slice(Math.floor(reg.length * bas), Math.max(1, Math.floor(reg.length * haut))));
      for (let i = 0; i < (g === 'F' ? 3 : g === 'D' ? 2 : 1) && tranche.length; i++) pool.push(copie(tranche.splice(Math.floor(rnd() * tranche.length), 1)[0]));
    }
  }
  return pool;
}

/*
 * 31 vrais clubs, comme `buildOpponents` : un club-saison entier, aligné par `autoRoster`, sans tes joueurs. LA LIGUE QUI
 * MONTE (tranche 8, js/rogue.js `ligueDe`) : aux premiers niveaux, les plus faibles (`teamStrength`) d'un tirage plus
 * large ; puis leurs cartes montent d'édition (`habillerLaLigue`).
 */
function adversaires(rnd, exclus, n = 31, niveau = LIGUE_PARTS.length) {
  const { part } = ligueDe(niveau);
  const m = Math.ceil(n / part);
  const out = [], vus = new Set();
  while (out.length < m) {
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = Object.keys(e.byTeam);
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${e.season}|${tag}`)) continue;
    const pool = e.byTeam[tag];
    if (pool.filter(p => groupe(p) === 'F').length < 12 || pool.filter(p => groupe(p) === 'D').length < 6 || pool.filter(p => p.p === 'G').length < 2) continue;
    vus.add(`${e.season}|${tag}`);
    const copies = pool.map(copie);
    const roster = autoRoster(copies, exclus);
    for (const p of Object.values(roster)) exclus.add(getPersonKey(p));
    // Son club-école (Jalon P, B) : les vrais joueurs de ce club-saison hors de ses 23.
    const ecole = ecoleDe(copies.filter(p => !exclus.has(getPersonKey(p))), roster);
    for (const p of ecole) exclus.add(getPersonKey(p));
    out.push(createTeam(`${tag} ${e.season}`, tag, roster, { season: e.season, ecole }));
  }
  const ligue = m > n ? out.map(t => [teamStrength(t), t]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]) : out;
  habillerLaLigue(ligue, niveau, v);
  return ligue;
}

/*
 * UN PACK DE JOUEURS (imite `tirerPackJoueurs`) : la famille dit où l'on
 * pige, le tier dit la variante. `libre` : un salaire qu'une sortie ferait
 * entrer, personne de la ligue.
 */
function tirerPack(rnd, cle, libre, role = null, meta = null) {
  const P = PACKS_JOUEURS[cle];
  // V10 : les crans du pack (js/rogue.js `monteeDesPacks`) — un joueur de plus, puis le métal du dessus.
  const mods = meta ? { montee: monteeDesPacks(meta), prestige: PRESTIGES[rangDePrestige(meta)] } : {};
  // LE NIVEAU D'ABORD, comme le vrai tirage (V10) : un pack au hasard, d'époque ou de club tire son niveau à ses taux
  // (`niveauxDuPack`, le prestige compris), puis un joueur de ce niveau — un Bronze sort un Soutien une fois sur deux.
  // Avant, le robot pigeait toujours dans la moitié du haut : il surestimait les petits packs.
  const taux = ['hasard', 'ere', 'equipe', 'coach'].includes(P.famille) ? niveauxDuPack(`j:${cle}`, mods) : null;
  const niveauTire = () => { let r = rnd() * 100; for (let k = 0; k < NIVEAUX.length; k++) { r -= taux[NIVEAUX[k].cle] || 0; if (r < 0) return k; } return 0; };
  const T = TIERS[tierDuPack(`j:${cle}`, mods)];
  const nb = (P.joueurs || TIERS[P.tier].n + (P.famille === 'trio' ? -2 : 0)) + (P.famille !== 'trio' && (mods.montee || {})[`j:${cle}`] >= 1 ? 1 : 0);
  const out = [];
  for (let t = 0; out.length < nb && t < nb * 6; t++) {
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    let pool;
    if (P.famille === 'skill') {
      const S = SKILLS[P.skill || role || 'sniper'];
      const c = e.players.filter(p => (p.gp || 0) >= S.min && (!S.groupe || groupe(p) === S.groupe) && (!S.skaters || p.p !== 'G')).sort((a, b) => S.score(b) - S.score(a));
      pool = c.slice(0, Math.ceil(c.length / 4));
    } else if (P.famille === 'etoiles' || P.famille === 'legendes') pool = e.players.filter(p => estEtoile(p) && (P.famille !== 'legendes' || Number(p.s.slice(0, 4)) < 1995));
    else if (taux) { const par = joueursParNiveau(e.players), k = niveauTire(); pool = (par[k] || []).length ? par[k] : par.slice(0, k).reverse().find(l => l && l.length) || []; }
    else pool = ['F', 'D', 'G'].flatMap(g => { const r = e.players.filter(p => groupe(p) === g && (p.gp || 0) >= (g === 'G' ? 15 : 30)).sort((a, b) => prod(b) - prod(a)); return r.slice(0, Math.ceil(r.length / 2)); });
    pool = pool.filter(p => libre(p) && !out.some(x => getPersonKey(x.p) === getPersonKey(p)));
    if (!pool.length) continue;
    const p = pool[Math.floor(rnd() * pool.length)];
    let r = rnd() * 100, rar = 'commune';
    for (const k of EDITIONS) { r -= T.cotes[k] || 0; if (r < 0) { rar = k; break; } }
    out.push({ p: copie(p), rar });
  }
  return out;
}

/* La valeur d'un alignement, pour le robot : la somme de (valeur − pénalité) des cases habillées. */
function valeurAlignement(roster) {
  let s = 0;
  for (const sl of SLOTS) if (!sl.scratch && roster[sl.i]) s += v(roster[sl.i]) - Math.min(20, getPositionPenalty(roster[sl.i], sl));
  return s;
}
const masseDe = roster => Object.values(roster).filter(Boolean).reduce((a, p) => a + (p.$ || 0), 0);
/* Ranger : l'alignement automatique (ou au mieux), puis les cases de réserve de plus — les meilleurs d'abord. */
function ranger(joueurs, nReserves, aligner = autoRoster) {
  const r = aligner(joueurs);
  const dedans = new Set(Object.values(r).map(getPersonKey));
  const reste = joueurs.filter(p => !dedans.has(getPersonKey(p))).sort((a, b) => v(b) - v(a));
  for (const sl of SLOTS.filter(s => s.extra && s.extra <= nReserves)) { const p = reste.shift(); if (p) r[sl.i] = p; }
  return r;
}

export const POLITIQUES = ['defaut', 'attentif', 'distrait'];
/* L'attentif lit le moteur, le plan compris (V9 : en Rogue, le système paie sa famille, comme son coach la compte). */
const auMieux = coachs => joueurs => alignementAuMieux(joueurs, 'equilibre', { plan: true, coachs });
/* Les buts nets par match d'un alignement, lus au moteur sous ce coach — sous un hasard à part : la saison ne bouge pas d'un dé. */
const lireNet = (R, coachs) => avecHasardIsole('robot', () => {
  const t = createTeam('Lu', 'LU', R);
  t.courbe = true; t.coachs = coachs;
  t.lignes = lignesAuMieux(R, 'equilibre', { plan: true, coachs });
  const m = chiffresDuSoir(t, activeLineup(t));
  return m.butsPour - m.butsContre;
});
/* Les clics du distrait : un générateur à lui (null pour les deux autres). Les meilleurs d'abord, ou dans le désordre. */
const melanger = (l, clic) => l.map(x => [clic(), x]).sort((a, b) => a[0] - b[0]).map(y => y[1]);
const meilleursDabord = (l, clic, f = x => x) => (clic ? melanger(l, clic) : l.slice().sort((a, b) => v(f(b)) - v(f(a))));

/* Les cartes du classeur au départ : au hasard, le tri (deux fois plus, on garde les meilleures), ou le choix. */
function tirerClasseur(rnd, meta, classeur, exclus, clic = null, exigence = 0) {
  const D = departDuClasseur(meta, exigence);
  if (!D.n || !classeur.length) return [];
  const budget = budgetDuClasseur(meta);
  const dispo = classeur.filter(x => (x.p.$ || 0) <= budget && !exclus.has(getPersonKey(x.p)));
  const melange = dispo.map(x => [rnd(), x]).sort((a, b) => a[0] - b[0]).map(y => y[1]);
  const vus = D.mode === 'choix' ? meilleursDabord(dispo, clic, x => x.p) : melange.slice(0, D.vues);
  const ordre = D.mode === 'hasard' ? vus : meilleursDabord(vus, clic, x => x.p);
  const pris = [], personnes = new Set();
  let reste = budget;
  for (const x of ordre) {
    if (pris.length >= D.n) break;
    if ((x.p.$ || 0) > reste || personnes.has(getPersonKey(x.p))) continue;
    pris.push(x); personnes.add(getPersonKey(x.p)); reste -= x.p.$ || 0;
  }
  return pris;
}

/*
 * LA POLITIQUE D'ACHAT DU ROBOT (Jalon P2, la boutique des sept packs mixtes) : un Pack Or un achat sur trois
 * s'il en a les moyens, sinon un Pack Spécialistes dont le rôle tourne (franc-tireurs, passeurs, puis défensif et
 * gardiens s'ils sont débloqués), sinon un Pack Argent. Les cartes des packs ne se jouent pas : il n'en joue aucune.
 * Rend { cle, role } ou null.
 */
const VERROUS = { defensif: 'packDefenseurs', gardien: 'packGardiens' };
/* Le prix d'un pack au `n`-ième achat de la saison : les prix montent comme au jeu (js/packs.js `hausseDesPacks`), et « Les agents » (les exigences) les montent. */
const prixAuAchat = (k, n, exigence = 0) => Math.max(1, Math.round(PACKS_JOUEURS[k].prix * hausseDesPacks(n) * exigencesDe(exigence).prixPacks));
function packVoulu(meta, jetons, n, exigence = 0) {
  const roles = ['sniper', 'passeur', 'defensif', 'gardien'].filter(r => !VERROUS[r] || aDebloque(meta, VERROUS[r]));
  // V10 : seulement ce que la boutique vend — le Bronze et l'Époque d'abord, le reste à son jalon (js/rogue.js `packsOuverts`).
  const ouverts = packsOuverts(meta), peut = k => ouverts[`j:${k}`] === true && jetons >= prixAuAchat(k, n, exigence);
  if (n % 3 === 2 && peut('or')) return { cle: 'or' };
  if (peut('specialistes')) return { cle: 'specialistes', role: roles[n % roles.length] };
  if (peut('argent')) return { cle: 'argent' };
  if (peut('epoque')) return { cle: 'epoque' };
  if (peut('bronze')) return { cle: 'bronze' };
  return null;
}

/*
 * UNE SAISON D'UNE RUN. `etat` : l'alignement et les variantes qui continuent
 * (la saison 2 d'une run repart de l'équipe de la saison 1), les jetons de
 * départ. Rend la fiche, les séries, les jetons qui restent et l'équipe.
 */
export function jouerSaison(meta, etat, { graine, saison, mains = true, politique = 'defaut', exigence = 0, ligue = niveauDeLigue(rangDePrestige(meta), exigence) }) {
  const rnd = generateur('rogue80', graine, saison);
  const attentif = politique === 'attentif';
  const clic = politique === 'distrait' ? generateur('rogue80-distrait', graine, saison) : null;
  const auHasard = l => l[Math.floor(clic() * l.length)];
  const nRes = reservesDeLaRun(meta);
  const { variantes } = etat;
  const poser = p => { const k = getPlayerKey(p); p._carte = carteDe(variantes.get(k) || varianteTiree(COTES_VARIANTES, graine, k), p.p === 'G', graine, k); };
  Object.values(etat.roster).forEach(poser);
  // LE COACH (V9) : l'attentif prend celui dont le plan rend le plus à son effectif ; le distrait, n'importe lequel ; le robot d'avant, aucun.
  const ouverts = coachsOuverts(rangDePrestige(meta));
  const coachs = attentif ? [ouverts.map(k => [k, lireNet(etat.roster, [effetDePalier(k, 1)])]).sort((a, b) => b[1] - a[1])[0][0]]
    : clic ? [auHasard(ouverts)] : [];
  const enPoste = coachs.map(k => effetDePalier(k, 1));
  // L'attentif range ses cartes posées : la variante d'un joueur compte dans ce qu'il rend.
  const roster = attentif ? ranger(Object.values(etat.roster).filter(Boolean), nRes, auMieux(enPoste)) : etat.roster;
  const masse0 = masseDe(roster);
  // LE PLAFOND QUI MORD (V9, tranche 4 ; js/rogue-jeu.js `plafondDeDepart`) : la masse de départ, plus l'espace de départ et les déblocages.
  const cap = plafondDeSaison(masse0, meta, exigence);
  const exclus = new Set(Object.values(roster).map(getPersonKey));
  const you = createTeam('Rogue', 'YOU', roster, { isPlayer: true });
  const opps = adversaires(rnd, exclus, 31, ligue);
  const decisions = [{ jour: 0, cases: photoAlignement(roster), fermeture: 'auto' }, ...enPoste.map(coach => ({ jour: 0, coach }))];
  // LES GALONS DE LA RUN (V9, tranche 7, js/galons.js) : ce que le jeu reporte seul d'une saison à l'autre, un métal de badge chacun.
  const galons = Object.fromEntries(Object.values(roster).filter(Boolean).map(p => [getPlayerKey(p), Math.min(GALONS_MAX, (etat.galons && etat.galons.get(getPlayerKey(p))) || 0)]).filter(([, n]) => n > 0));
  if (Object.keys(galons).length) decisions.push({ jour: 0, galons, report: true });
  // V8 : les rivaux choisis au premier jour. Le robot prend les trois du milieu de l'offre (ni le plus fort ni le plus faible).
  const offre = rivauxOfferts([you, ...opps], you, `rogue80:${graine}:${saison}`);
  if (offre.length >= RIVAUX) decisions.push({ jour: 0, rivaux: (clic ? melanger(offre, clic).slice(0, RIVAUX) : offre.slice(1, 1 + RIVAUX)).map(x => ({ cle: x.cle, butin: x.butin })) });
  // Ce que la fenêtre du Rogue offre (V9) : les systèmes du plan, ou aucun.
  if (clic) decisions.push({ jour: 0, lignes: [0, 1, 2, 3].map(() => ({ tac: auHasard(['hourra', ...SYSTEMES_DU_PLAN.F]), tacD: auHasard(['hourra', ...SYSTEMES_DU_PLAN.D]) })) });
  /*
   * LE DUEL (V9, tranche 5, scripts/lib/duel.mjs) : l'attentif lit chaque intention et y répond ; le distrait clique au
   * hasard ; le robot d'avant laisse l'adjoint jouer ses mains en séries, et rien aux gros matchs de saison, comme avant.
   * `mains: false`, aucun : ni geste ni carte.
   */
  if (mains) {
    const r = robotDuel(attentif ? 'attentif' : clic ? 'distrait' : 'adjoint', clic || undefined);
    you.robotDuel = attentif || clic ? r : ctx => (ctx.serie ? r(ctx) : {});
    you.deckDuel = DECK_DEPART;
  }
  const L = creerLigue([you, ...opps], 82, { graine: `rogue80:${graine}:${saison}`, decisions, courbe: true });
  const dansLaLigue = new Set();
  for (const t of L.teams) for (const p of Object.values(t.roster)) if (p) dansLaLigue.add(getPersonKey(p));
  const entrees = [];
  let depense = 0, achats = 0, signes = 0, serie = 0, serieMax = 0;
  const jetons = () => {
    let W = 0, D = 0, P = 0;
    for (const jour of L.calendrier.slice(0, L.jour)) for (const m of jour) {
      if (m.A !== you && m.B !== you) continue;
      const pour = m.A === you ? m.gfA : m.gfB, contre = m.A === you ? m.gfB : m.gfA;
      if (pour > contre) W++; else if (m.ot) P++; else D++;
    }
    const gros = (you.minisBoss || []).filter(mb => mb.gagne).reduce((n, mb) => n + (mb.butin || 1) * (mb.mise || 1), 0);
    const B = baremeRogue(meta, exigence);
    // V3.6 : la prime des fils (le Cheechoo, le jalon…), comme au jeu (`resultatsRogue`, js/rogue-jeu.js).
    return etat.jetons + W * B.victoire + P * B.prolongation + D * B.defaite + gros * B.grosMatch + primesDesFils(L.calendrier, you, L.jour).total - depense;
  };
  while (!L.fini) {
    // La boutique, le matin : tant qu'il y a de quoi acheter.
    for (let garde = 0; garde < 4; garde++) {
      const voulu = packVoulu(meta, jetons(), achats, exigence);
      if (!voulu) break;
      depense += prixAuAchat(voulu.cle, achats, exigence); achats++;
      const actuel = you.roster;
      // V9 : l'offre n'est plus filtrée sous le plafond ; ne se signe que ce qu'une sortie fait entrer (plus bas).
      const cartes = tirerPack(rnd, voulu.cle, p => p.$ > 0 && !dansLaLigue.has(getPersonKey(p)), voulu.role, meta);
      entrees.push(...cartes);
      // SIGNER (un seul du pack) : celui qui monte le plus l'alignement, sous le plafond ; qui sort : celui que l'alignement laisse.
      // Le distrait : une carte au hasard, et un joueur du même groupe au hasard lui laisse sa case.
      let meilleur = null;
      const joueurs = Object.values(actuel).filter(Boolean);
      const valeur0 = valeurAlignement(actuel);
      if (clic && cartes.length) {
        const x = auHasard(cartes);
        const memes = Object.entries(actuel).filter(([, p]) => p && groupe(p) === groupe(x.p));
        const [i, sort] = memes.length ? auHasard(memes) : [];
        if (sort && masseDe(actuel) - (sort.$ || 0) + (x.p.$ || 0) <= cap) meilleur = { x, r: { ...actuel, [i]: x.p }, sort };
      }
      // L'attentif : la carte qui monte le plus ses buts nets, lus au moteur, plan et coach compris — contre son effectif
      // rangé de la même façon (le rangement automatique), sinon l'alignement qu'il a déjà optimisé gagne toujours.
      const net0 = attentif && cartes.length ? lireNet(ranger(joueurs, nRes), enPoste) : 0;
      for (const x of clic ? [] : cartes) {
        const avec = [...joueurs, x.p];
        const r = ranger(avec, nRes);
        const dedans = new Set(Object.values(r).map(getPersonKey));
        const sort = avec.find(p => !dedans.has(getPersonKey(p))) || null;
        if (sort === x.p) continue;
        if (masseDe(actuel) - (sort ? sort.$ || 0 : 0) + (x.p.$ || 0) > cap) continue;
        // Une case de réserve libre (débloquée) : il entre sans que personne sorte — ça vaut un peu de profondeur.
        const gain = attentif ? lireNet(r, enPoste) - net0 + (sort ? 0 : 0.01) : valeurAlignement(r) - valeur0 + (sort ? 0 : 0.6);
        if (gain > (attentif ? 0.01 : 0.5) && (!meilleur || gain > meilleur.gain)) meilleur = { x, r, sort, gain };
      }
      if (meilleur) {
        const { x, sort } = meilleur;
        const r = attentif ? ranger(Object.values(meilleur.r).filter(Boolean), nRes, auMieux(enPoste)) : meilleur.r;
        variantes.set(getPlayerKey(x.p), x.rar);
        poser(x.p); connaitre(x.p);
        dansLaLigue.add(getPersonKey(x.p));
        const i = sort ? Number(Object.entries(actuel).find(([, p]) => p === sort)[0]) : Number(Object.entries(r).find(([, p]) => p === x.p)[0]);
        decisions.push({ jour: L.jour, ballottage: { i, entre: getPlayerKey(x.p), sort: sort ? getPlayerKey(sort) : null, rar: x.rar }, sel: `b${L.jour}:${achats}` });
        decisions.push({ jour: L.jour, cases: photoAlignement(r), fermeture: 'auto' });
        signes++;
        // Le moteur applique les décisions du jour avant les matchs : l'alignement suit tout de suite.
        for (const k of Object.keys(actuel)) delete actuel[k];
        Object.assign(actuel, r);
      }
    }
    jouerJournee(L);
    // La plus longue séquence de victoires (un jalon).
    for (const m of L.calendrier[L.jour - 1] || []) {
      if (m.A !== you && m.B !== you) continue;
      const gagne = (m.A === you) === (m.gfA > m.gfB);
      serie = gagne ? serie + 1 : 0; serieMax = Math.max(serieMax, serie);
    }
  }
  const b = bilanLigue(L);
  const rang = b.standings.indexOf(you) + 1;
  let rondes = 0, coupe = false, finale = false;
  if (rang <= 16) {
    const decsS = [];
    const S = creerSeries(b.standings.slice(0, 16), { ligue: L, graine: L.graine, decisions: decsS, equipes: L.teams });
    // LA MAIN EN SÉRIES (Jalon P0) : chaque match est un duel, joué par `you.robotDuel` (plus haut).
    for (let garde = 0; !S.fini && garde < 200; garde++) jouerMatchSeries(S);
    rondes = S.toutes.filter(s => s.winner === you).length;
    coupe = S.champion === you;
    // LE PACK D'UNE SÉRIE GAGNÉE (Jalon P1, `PACKS_DE_SERIE`) : ses joueurs vont au classeur, pas dans l'alignement des séries.
    // « Les vedettes » (le déblocage) montent d'un cran le pack de chaque ronde.
    for (let i = 0; i < rondes; i++) entrees.push(...tirerPack(rnd, packDeSerie(i, aDebloque(meta, 'packVedettes')).slice(2), p => !dansLaLigue.has(getPersonKey(p))));
    finale = S.toutes.some(s => s.ronde === S.nRondes - 1 && (s.A === you || s.B === you));
  }
  const reste = Math.max(0, jetons());
  // Les galons gagnés cette saison, par ceux qui la finissent (js/rogue-jeu.js `graverLaSaisonRogue`).
  const galonsNeufs = galonsDeLaSaison(you, Object.values(you.roster).filter(Boolean), getPlayerKey);
  // Le robot ne laisse pas de cartes posées sur des joueurs partagés : chaque saison repart propre.
  for (const p of Object.values(you.roster)) if (p) delete p._carte;
  for (const x of entrees) delete x.p._carte;
  // `L` et `you` : la ligue jouée, pour qui veut relire ses feuilles (check_moments).
  return { pts: you.PTS, W: you.W, rang, series: rang <= 16, rondes, coupe, finale, premier: rang === 1, serieMax, achats, signes, reste, entrees, galons: galonsNeufs, roster: { ...you.roster }, L, you };
}

/*
 * UNE RUN (S80 : PLUSIEURS SAISONS). La saison 1 part des plombiers (et des
 * gardés, et du classeur) ; chaque saison suivante repart de plombiers neufs
 * et des meilleurs de la précédente (`gardesDeSaison`), avec les jetons qui
 * restent et la caisse du vestiaire. La run
 * finit quand on rate les séries — le proprio montre la porte — ou quand on
 * gagne la Coupe. `jalons` : paie les jalons (js/rogue.js `JALONS`), qui
 * peuvent débloquer en cours de run. Rend la run saison par saison, les
 * écussons, ce qui entre au classeur, et l'équipe finale.
 */
export function jouerRun(meta, { classeur = [], derniere = [], graine = 'run', jalons = false, maxSaisons = 8, joues = new Map(), mains = true, politique = 'defaut', exigence = 0 } = {}) {
  const rnd = generateur('rogue80', graine);
  const clic = politique === 'distrait' ? generateur('rogue80-distrait', graine) : null;
  const exclus = new Set();
  // Les joueurs gardés de la dernière équipe (le robot garde les meilleurs ; le distrait, n'importe qui).
  const gardes = meilleursDabord(derniere, clic).slice(0, nombreGardes(meta)).map(copie);
  gardes.forEach(p => exclus.add(getPersonKey(p)));
  // Les cartes du classeur au départ.
  const tires = tirerClasseur(rnd, meta, classeur, exclus, clic, exigence).map(x => ({ p: copie(x.p), rar: x.rar }));
  tires.forEach(x => exclus.add(getPersonKey(x.p)));
  const V = vestiaire(rnd, meta, [...gardes, ...tires.map(x => x.p)], classeur, { joues, graine: `${graine}:depart`, exigence });
  const etat = { roster: V.roster, variantes: new Map(tires.map(x => [getPlayerKey(x.p), x.rar])), jetons: jetonsDeDepart(meta), galons: new Map() };
  for (const x of classeur) if (!etat.variantes.has(getPlayerKey(x.p))) etat.variantes.set(getPlayerKey(x.p), x.rar);
  const jouees = new Set();
  const saisons = [];
  // La ligue de la run (tranche 8) : son niveau est fixé au départ, comme le prestige au jeu (`G.rogue.prestige`).
  const ligue = niveauDeLigue(rangDePrestige(meta), exigence);
  let ecussons = 0;
  const entrees = Object.values(etat.roster).map(p => ({ p, rar: etat.variantes.get(getPlayerKey(p)) || 'commune' }));
  for (let n = 1; n <= maxSaisons; n++) {
    const r = jouerSaison(meta, etat, { graine, saison: n, mains, politique, exigence, ligue });
    entrees.push(...r.entrees);
    for (const g of r.galons) etat.galons.set(g.joueur, (etat.galons.get(g.joueur) || 0) + 1);
    let e = (ecussonsDeLaSaison(r.pts) + ecussonsDesSeries(r.rondes, r.coupe)) * exigencesDe(exigence).medailles;
    // La prime de découverte : les cartes qui finissent leur première saison (`joues` ne les connaît pas encore).
    const fin = Object.values(r.roster).filter(Boolean).map(getPlayerKey);
    e += fin.filter(k => !joues.has(k) && !jouees.has(k)).length * PRIME_DECOUVERTE;
    for (const k of [...Object.values(etat.roster).filter(Boolean).map(getPlayerKey), ...fin]) jouees.add(k);
    if (jalons) e += payerJalonsSim(meta, { ...r, saisonDeLaRun: n, cartes: classeur.length + entrees.length });
    e = Math.round(e);
    ecussons += e;
    saisons.push({ n, pts: r.pts, rang: r.rang, rondes: r.rondes, coupe: r.coupe, ecussons: e, achats: r.achats, signes: r.signes, galons: r.galons.length });
    // La Coupe (tranche 8) : elle compte, et le cran d'exigence gagné ouvre le suivant (js/rogue.js `payerEcussons`).
    if (r.coupe) { meta.coupes = (meta.coupes || 0) + 1; meta.exigence = Math.max(meta.exigence || 0, exigence); }
    // LE MANDAT DU PROPRIO (js/rogue.js `MANDATS`) : manqué, la run est finie ; la Coupe la gagne.
    if (r.coupe || !mandatRempli(n, { series: r.series, rang: r.rang, nEquipes: 32, exigence })) break;
    // LA SAISON SUIVANTE : l'équipe se défait — les meilleurs restent, des plombiers neufs ; les jetons restent, la caisse revient.
    const equipe = Object.values(r.roster).filter(Boolean);
    const restent = gardesDeSaison(meta, equipe, clic, exigence);
    const partants = new Set(equipe.map(getPlayerKey).filter(k => !restent.some(p => getPlayerKey(p) === k)));
    // Le classeur a grossi pendant la saison : les cartes tirées des packs en sont.
    const classeurSaison = [...classeur, ...r.entrees.map(x => ({ p: x.p, rar: x.rar }))];
    // LES LOTOS DU CARTABLE (Jalon Q) : le robot signe la meilleure carte de chaque loto, sous le budget du classeur.
    const lotos = lotosDuRobot(meta, classeurSaison, restent, partants, `${graine}:s${n + 1}`, clic, exigence);
    etat.roster = vestiaire(rnd, meta, [...restent, ...lotos.map(x => copie(x.p))], classeurSaison, { saison: n + 1, exclus: partants, joues, graine: `${graine}:s${n + 1}`, exigence }).roster;
    etat.jetons = r.reste + jetonsDeDepart(meta);
  }
  for (const k of jouees) joues.set(k, (joues.get(k) || 0) + 1);
  const fin = saisons[saisons.length - 1];
  return {
    saisons, nSaisons: saisons.length, coupe: !!fin.coupe, ecussons, depart: tires.length, exigence, ligue,
    pts1: saisons[0].pts, series1: saisons[0].rang <= 16,
    entrees: entrees.map(x => ({ p: x.p, rar: x.rar })),
    equipe: Object.values(etat.roster).filter(Boolean),
  };
}
/*
 * LE VESTIAIRE TIRÉ DU CLASSEUR (js/rogue.js `tirageDuDepart`, comme
 * js/rogue-jeu.js `vestiaireDeDepart`) : les cartes Soutien et Régulier du
 * classeur, les moins jouées d'abord (`joues` : clé → runs jouées) ; les
 * trous, des plombiers de la ligue. Un classeur vide : les plombiers d'avant.
 */
function vestiaire(rnd, meta, fixes, classeur, { saison = 1, exclus = new Set(), joues = new Map(), graine = '', exigence = 0 } = {}) {
  const nRes = reservesDeLaRun(meta);
  const personnes = new Set(fixes.map(getPersonKey));
  const dispo = classeur.filter(x => !exclus.has(getPlayerKey(x.p)) && !personnes.has(getPersonKey(x.p)) && (x.p.$ || 0) > 0);
  if (!dispo.length) return { roster: ranger([...fixes, ...plombiers(rnd, meta, personnes)], nRes), tires: [] };
  const decrire = p => ({ cle: getPlayerKey(p), p, groupe: groupe(p), niveau: niveauDe(p, shard(p.s).players), r: joues.get(getPlayerKey(p)) || 0 });
  const cartes = dispo.map(x => decrire(x.p)).filter(x => x.niveau <= 1);
  const budget = PLAFOND_ROGUE + plafondDuVestiaire(meta) - ESPACE_DE_DEPART;
  const { tires, manque } = tirageDuDepart({ fixes: fixes.map(decrire), cartes, quota: soutiensDuDepart(rangDePrestige(meta), saison, exigence), budget: Math.max(masseDe(fixes), budget), graine, personne: x => getPersonKey(x.p) });
  const pris = [...fixes, ...tires.map(x => copie(x.p))];
  if (Object.values(manque).some(n => n > 0)) {
    const ligue = plombiers(rnd, meta, new Set(pris.map(getPersonKey)));
    for (const g of ['F', 'D', 'G']) pris.push(...ligue.filter(p => groupe(p) === g).slice(0, manque[g]));
  }
  return { roster: ranger(pris, nRes), tires };
}
/*
 * LES LOTOS DU ROBOT (js/rogue-jeu.js `lotoDuCartable`) : le même tirage pur du cartable, loto par loto ; il signe
 * la carte qui vaut le plus parmi celles qui tiennent dans ce qui reste du budget du classeur. Le classeur ouvert :
 * les meilleures de tout le cartable.
 */
function lotosDuRobot(meta, classeur, gardes, partants, graine, clic = null, exigence = 0) {
  const L = lotosDeSaison(meta, exigence);
  let budget = budgetDuClasseur(meta) - masseDe(gardes);
  const personnes = new Set(gardes.map(getPersonKey));
  const parCle = new Map(classeur.filter(x => !partants.has(getPlayerKey(x.p))).map(x => [getPlayerKey(x.p), x]));
  const cles = [...parCle.keys()];
  const tient = x => (x.p.$ || 0) > 0 && (x.p.$ || 0) <= budget && !personnes.has(getPersonKey(x.p));
  const pris = [];
  const prendre = x => { pris.push(x); personnes.add(getPersonKey(x.p)); budget -= x.p.$ || 0; };
  if (L.mode === 'choix') {
    for (const x of meilleursDabord(cles.map(k => parCle.get(k)), clic, y => y.p)) { if (pris.length >= L.n) break; if (tient(x)) prendre(x); }
    return pris;
  }
  for (let i = 0; i < L.n && budget > 0; i++) {
    const vus = [];
    for (const k of tirageDuClasseur(cles, `${graine}:l${i}`)) { if (vus.length >= L.vues) break; const x = parCle.get(k); if (tient(x) && !vus.some(y => getPersonKey(y.p) === getPersonKey(x.p))) vus.push(x); }
    const [meilleure] = meilleursDabord(vus, clic, y => y.p);
    if (meilleure) prendre(meilleure);
  }
  return pris;
}
/* Ceux qui restent d'une saison à l'autre : le robot garde les meilleurs qui tiennent ensemble dans le budget du classeur. */
function gardesDeSaison(meta, equipe, clic = null, exigence = 0) {
  const budget = budgetDuClasseur(meta), out = [];
  let masse = 0;
  for (const p of meilleursDabord(equipe, clic)) {
    if (out.length >= gardesDeLaRun(exigence)) break;
    if (masse + (p.$ || 0) > budget) continue;
    out.push(p); masse += p.$ || 0;
  }
  return out;
}
/* Les jalons, dans la mesure : les mêmes règles que le jeu (js/rogue.js `jalonsAtteints`), payés une fois. */
function payerJalonsSim(meta, faits) {
  meta.jalons = meta.jalons || {};
  let e = 0;
  for (const J of jalonsAtteints(meta, faits)) {
    meta.jalons[J.cle] = true;
    const d = J.recompense.deblocage;
    if (d && DEBLOCAGES[d] && !aDebloque(meta, d) && (!DEBLOCAGES[d].requis || aDebloque(meta, DEBLOCAGES[d].requis))) meta.deblocages.push(d);
    else e += J.recompense.ecussons || 0;
  }
  return e;
}

/*
 * UN CLASSEUR COMME APRÈS N RUNS, sans les jouer : les cartes que N runs de
 * packs auraient tirées (vingt-huit packs par saison, la même politique
 * d'achat) et leurs plombiers. C'est ce que les niveaux fixes tirent au départ.
 */
export function classeurSynthetique(meta, nRuns, graine = 'classeur') {
  const rnd = generateur('rogue80-classeur', graine);
  const out = [];
  for (let r = 0; r < nRuns; r++) {
    out.push(...plombiers(rnd, meta, new Set()).map(p => ({ p, rar: 'commune' })));
    for (let n = 0; n < 28; n++) { const v = packVoulu(meta, 999, n); out.push(...tirerPack(rnd, v.cle, p => p.$ > 0, v.role, meta)); }
  }
  const vus = new Map();
  for (const x of out) if (!vus.has(getPlayerKey(x.p))) vus.set(getPlayerKey(x.p), x);
  return [...vus.values()];
}

/* L'ORDRE DES DÉBLOCAGES du robot : ce qu'un joueur prend d'abord (le moins cher utile), puis le reste. */
export const ORDRE_DEBLOCAGES = [
  'caisse1', 'commanditaire1', 'classeur1', 'plafond1', 'garder1', 'banc1', 'plombiersPlus', 'classeurTri', 'classeur2', 'commanditaire2', 'caisse2',
  'packGardiens', 'packDefenseurs', 'plafond2', 'garder2', 'classeur3', 'packVedettes', 'banc2', 'classeurChoix',
  'deckPlus', 'dgFlexible', 'packAnnees80', 'garder3',
  // V10 : les crans des packs qu'il achète, le premier de chacun, puis les seconds.
  'monte_epoque_1', 'monte_bronze_1', 'monte_argent_1', 'monte_specialistes_1', 'monte_or_1', 'monte_epoque_2', 'monte_argent_2', 'monte_specialistes_2', 'monte_or_2',
].filter(k => DEBLOCAGES[k]);
/* Acheter ce qu'on peut, dans l'ordre (un déblocage qui en demande un autre attend son tour). */
export function acheterDans(meta) {
  for (let fait = true; fait;) {
    fait = false;
    for (const k of ORDRE_DEBLOCAGES) {
      const D = DEBLOCAGES[k];
      if (aDebloque(meta, k) || (D.requis && !aDebloque(meta, D.requis)) || (D.pack && packsOuverts(meta)[D.pack] !== true) || meta.ecussons < D.prix) continue;
      meta.ecussons -= D.prix; meta.deblocages.push(k); fait = true;
      break;
    }
  }
  return meta;
}
/* Les N premiers déblocages de l'ordre : un « niveau » d'améliorations. */
export function metaAuNiveau(n) {
  return { ecussons: 0, deblocages: ORDRE_DEBLOCAGES.slice(0, n), jalons: {} };
}
export const coutDuNiveau = n => ORDRE_DEBLOCAGES.slice(0, n).reduce((a, k) => a + DEBLOCAGES[k].prix, 0);
