/*
 * LES ROBOTS DE LA SAISON (V30, docs/refonte-v30-2.md § 4, § 9). Ils jouent une run entière par les fonctions du jeu
 * (js/run.js), jamais une copie : les pièces du départ, le repêchage de 23, les 82 soirs, les gros matchs et leurs portes,
 * les pochettes, le bilan de chaque quart et son marché, les séries. scripts/mesure_run.mjs les mesure, scripts/check_run.mjs
 * lit leurs runs contre les invariants.
 *
 *   « premier »  le premier joueur offert qui tient, la première pièce, jamais l'enjeu d'une élite, le partant tous les soirs ;
 *   le CHIFFRE   la meilleure cote au repêchage et aux portes, sans rien lire de son banc, le partant tous les soirs ;
 *   le MALIN     le bâtisseur : au repêchage et aux portes, la cote PLUS ce que le joueur change au compte de son banc
 *                (`POIDS_DU_BANC`) ; il choisit qui sort, prend la pièce la plus avancée chez lui, relance quand l'offre
 *                est faible, ouvre des pochettes, monte au marché la carte que l'écran propose d'abord, choisit son
 *                gardien chaque soir, prend l'enjeu d'une élite quand sa chance le vaut ;
 *   le TÉMOIN    le malin, à une seule différence : il ne lit pas son banc au repêchage ni aux portes (sa note est celle
 *                de la cote). C'est contre lui que « bâtir paie » se juge ;
 *   le DISTRAIT  le malin, à une seule différence : il oublie son gardien (le partant tous les soirs). C'est contre lui
 *                que « choisir son gardien paie » se juge.
 *
 * `espion(moment, S, x)` : appelé aux moments d'une run ('repeche', 'quart', 'bureau', 'ballottage', 'feuille', 'match',
 * 'portes', 'relance', 'signe', 'montee', 'pochette', 'histoire', 'bilan', 'fin').
 */
import { SLOTS, getHiddenRatings, jambesGardien } from '../../js/sim.js';
import { groupeDuJoueur as groupeDe } from '../../js/niveaux.js';
import { PIECES, MARCHES, CASES_DU_BANC, PIECE_DU_COACH, apportDe, compteDe } from '../../js/pieces.js';
import { PRIX_PIECE } from '../../js/actes.js';
import { tirerJoueursDuPack } from '../../js/packs.js';
import { getPersonKey } from '../../js/sim.js';
import {
  RUN, creerLaRun, ouvrirSeance, figer, prendreLaPiece, pieceReglee, vestiaireDuRepechage, budgetDuTour, repecher, relancerLaRoulette, versLeBureau, allerAuMatch, reclamer, offresVues,
  mettreLEnjeu, fixerLElite, poserLAffiche, matchNo, clubNo, choisirLeFilet, chanceCeSoir, jouerLeMatch, conclure, continuer, vestiaireDe, sortantsPour, masseApres, masseDe, signer, passerLesPortes, relancerLesPortes,
  prixDeLaRelance, apresLesPortes, prixDe, apresLeBilan, acheterLaPiece, aMonter, monterAuMarche, quitterLeMarche, pochetteLibre, acheterLaPochette, histoireDuJour, repondre,
  allerAuMatchDeSerie, signesDe, tonBanc, forceDe, rangDe, effectifDe,
} from '../../js/run.js';
import { SAISONS, shard } from './shards.mjs';

export const DONNEES = { saisons: SAISONS, shard };
/* Le malin paie la cote au prix de l'espace qu'elle prend : un point de cote vaut `PRIX_ESPACE` M$ d'espace. */
const PRIX_ESPACE = Number(process.env.PRIX_ESPACE ?? 1.5);
/* Ce que le bâtisseur donne à son banc : un point de pourcentage sur un canal, en points de cote (mesuré le 13 nov. 2026). */
const POIDS_DU_BANC = Number(process.env.POIDS_DU_BANC ?? 3.3);
/* Il relance les portes quand le meilleur échange offert vaut moins que `NOTE_FAIBLE` points de cote, en gardant de quoi payer une pièce au marché. */
const NOTE_FAIBLE = Number(process.env.NOTE_FAIBLE ?? 40);
/* Au repêchage, jamais plus que `PART` fois sa part de ce qui reste : les premiers tours ne vident pas la caisse. */
const PART = Number(process.env.PART ?? 2.5);
/* L'enjeu d'une élite se prend à cette chance ou mieux. */
const CHANCE_ENJEU = Number(process.env.CHANCE_ENJEU ?? 0.42);
const v = p => getHiddenRatings(p).v;
const COACHS = Object.keys(PIECE_DU_COACH);
const habile = robot => robot === 'malin' || robot === 'temoin' || robot === 'distrait';
const batisseur = robot => robot === 'malin' || robot === 'distrait';
const MINIMUMS = { F: 13, D: 7, G: 2 };

/* ---------- le banc lu ---------- */
/* Ce qu'une pièce rend à un compte, en % : sa marche, et la pente entre deux marches (ce qu'on lit pour s'y rendre). */
function pente(cle, n) {
  if (n <= 0) return 0;
  const pts = [[0, 0], ...PIECES[cle].seuils.map((s, i) => [s, MARCHES[i]])], k = pts.findIndex(([s]) => n < s);
  if (k < 0) return pts.at(-1)[1];
  const [n0, p0] = pts[k - 1], [n1, p1] = pts[k];
  return p0 + (p1 - p0) * (n - n0) / (n1 - n0);
}
const avance = (S, cle, signes = signesDe(S)) => pente(cle, compteDe(cle, signes));
/* Ce qu'un joueur qui entre (et un qui sort) change à ton banc, en points de pourcentage sur la pente. */
function gainDuBanc(p, sortant, comptes) {
  let g = 0;
  for (const [cle, n] of comptes) g += pente(cle, n + apportDe(cle, p) - (sortant ? apportDe(cle, sortant) : 0)) - pente(cle, n);
  return g;
}

/* ---------- le repêchage ---------- */
/* Le groupe qui manque le plus à ton club, parmi ceux que le vestiaire offre. */
function groupeVoulu(S, offerts) {
  const n = { F: 0, D: 0, G: 0 };
  for (const p of effectifDe(S)) n[groupeDe(p)]++;
  const manque = g => (MINIMUMS[g] - n[g]) / MINIMUMS[g];
  const g = Object.keys(MINIMUMS).filter(k => offerts.has(k)).sort((a, b) => manque(b) - manque(a))[0];
  return manque(g) > 0 ? g : null;
}
function repecherUn(S, robot, espion) {
  const R = S.R, aVenir = 23 - R.rep.tour - 1, reste = R.plafond - RUN.ESPACE - masseDe(S);
  const choisir = () => {
    const offres = vestiaireDuRepechage(S).filter(x => x.tient);
    if (robot === 'premier' || !offres.length) return offres[0] || null;
    const max = Math.min(budgetDuTour(S), PART * reste / (aVenir + 1));
    const g = groupeVoulu(S, new Set(offres.map(x => groupeDe(x.p))));
    const comptes = batisseur(robot) ? R.banc.map(cle => [cle, compteDe(cle, signesDe(S))]) : [];
    const note = x => v(x.p) + POIDS_DU_BANC * gainDuBanc(x.p, null, comptes);
    const ok = offres.filter(x => prixDe(S, x.p) <= max && (!g || groupeDe(x.p) === g));
    return ok.sort((a, b) => note(b) - note(a))[0] || null;
  };
  let c = choisir();
  // Rien qui tienne dans sa part, ou un vestiaire sans le groupe qu'il lui faut : un autre vestiaire, tant qu'il reste des relances.
  while (!c && relancerLaRoulette(S)) c = choisir();
  c = c || vestiaireDuRepechage(S).filter(x => x.tient).sort((a, b) => prixDe(S, a.p) - prixDe(S, b.p))[0];
  if (!c || !repecher(S, c.p)) throw new Error(`repêchage coincé au tour ${R.rep ? R.rep.tour : '?'} (graine ${R.graine})`);
  espion('repeche', S, c.p);
}

/* ---------- les portes ---------- */
/* Le candidat d'une porte : celui qui entre, et le plus faible de son groupe dont la sortie le fait tenir. */
function candidats(S, x) {
  const out = [];
  for (const { p, tient } of vestiaireDe(S, x)) {
    if (!tient) continue;
    const sortant = sortantsPour(S, p).sort((a, b) => v(a) - v(b))[0];
    if (!sortant || masseApres(S, p, sortant) > S.R.plafond) continue;
    out.push({ p, sortant, gain: v(p) - v(sortant), porte: x });
  }
  return out;
}
/* Tous les échanges d'une porte : chaque joueur qui tient, contre chaque joueur de son groupe dont la sortie le fait tenir. */
const echanges = (S, x) => vestiaireDe(S, x).filter(c => c.tient).flatMap(({ p }) => sortantsPour(S, p).filter(q => masseApres(S, p, q) <= S.R.plafond).map(sortant => ({ p, sortant, gain: v(p) - v(sortant), porte: x })));
function choisirAuxPortes(S, robot) {
  const portes = S.R.portes.pochette ? [null] : S.R.portes.clubs;
  if (robot === 'premier') return candidats(S, portes[0])[0] || null;
  if (robot === 'chiffre') return portes.flatMap(x => candidats(S, x)).filter(c => c.gain > 0).sort((a, b) => b.gain - a.gain)[0] || null;
  // Le témoin et le malin jugent chaque échange, donc aussi qui sort ; le malin y ajoute ce que son banc y gagne.
  const comptes = batisseur(robot) ? S.R.banc.map(cle => [cle, compteDe(cle, signesDe(S))]) : [];
  const note = c => c.gain - PRIX_ESPACE * Math.max(0, (prixDe(S, c.p) - RUN.RACHAT * prixDe(S, c.sortant)) / 1e6) + POIDS_DU_BANC * gainDuBanc(c.p, c.sortant, comptes);
  const b = portes.flatMap(x => echanges(S, x)).map(c => ({ ...c, note: note(c) })).sort((a, c) => c.note - a.note)[0];
  return b && b.note > 0 ? b : null;
}
/* Les portes : relancer si l'offre est faible, puis signer ou passer, puis la suite. */
function reglerLesPortes(S, robot, espion) {
  espion('portes', S);
  let c = choisirAuxPortes(S, robot);
  while (habile(robot) && (!c || c.note < NOTE_FAIBLE)) {
    const prix = prixDeLaRelance(S);
    if (prix == null || (prix > 0 && S.R.jetons < prix + PRIX_PIECE) || !relancerLesPortes(S)) break;
    espion('relance', S, prix);
    c = choisirAuxPortes(S, robot);
  }
  if (c && signer(S, c.p, c.sortant, { auMieux: true })) espion('signe', S, c); else if (!S.R.portes.pochette) passerLesPortes(S);
  apresLesPortes(S);
}

/* ---------- les pièces ---------- */
/* La pièce qu'on prend, parmi les offertes : la première ; les habiles, la plus avancée chez eux. */
const pieceLue = (S, robot, offertes) => (habile(robot) ? offertes.slice().sort((a, b) => avance(S, b) - avance(S, a))[0] : offertes[0]) || null;
/* Une case libre : la pièce lue. Banc plein : les habiles sortent leur moins avancée, si la neuve l'est plus. */
function prendreUnePiece(S, robot, offertes, poser) {
  const cle = pieceLue(S, robot, offertes);
  if (!cle) return;
  if (S.R.banc.length < CASES_DU_BANC) return void poser(S, cle);
  if (!habile(robot)) return;
  const sort = S.R.banc.slice().sort((a, b) => avance(S, a) - avance(S, b))[0];
  if (avance(S, sort) < avance(S, cle)) poser(S, cle, sort);
}

/* ---------- le soir ---------- */
/* Le gardien du soir : l'auxiliaire quand un départ de plus userait le partant, ou le second soir d'un dos-à-dos (la tranche 0). */
function choisirSonGardien(S) {
  const [partant, aux] = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => S.roster[s.i]).filter(p => p && !S.toi.injured.has(p));
  if (!partant || !aux) return;
  const c = S.R.soir, use = jambesGardien({ ...partant, _suite: (partant._suite || 0) + 1 }) < 100 || (c.dos && c.sorte !== 'serie');
  choisirLeFilet(S, use && c.sorte !== 'serie' ? 'aux' : 'partant');
}
/*
 * TES AFFICHES (JP, 17 nov. 2026 : tu les poses) : « premier » et le chiffre les posent aux premiers soirs ordinaires du
 * quart ; les habiles choisissent leurs soirs — parmi les soirs ordinaires qui restent au quart, les clubs les plus hauts
 * qu'ils peuvent battre (leur force au plus la tienne), jamais sur leur propre dos-à-dos s'il y a mieux.
 */
function veutLAffiche(S, robot) {
  const R = S.R, Q = R.quart, c = R.soir;
  if (c.sorte !== 'match' || Q.affiches <= 0) return false;
  if (!habile(robot)) return true;
  const reste = [];
  for (let k = c.k; k < Q.fin; k++) if (!Q.gros[k]) reste.push(matchNo(S, k));
  if (reste.length <= Q.affiches) return true;
  const moi = forceDe(S), note = m => { const club = clubNo(S, m.i); return (club.force <= moi ? 1 : 0) + club.rang * (club.force <= moi ? 1 : -1) - (m.dos ? 0.5 : 0) + (m.leurDos ? 0.05 : 0); };
  return reste.slice().sort((a, b) => note(b) - note(a)).slice(0, Q.affiches).some(m => m.k === c.k);
}
function jouer(S, robot, espion) {
  const c = S.R.soir;
  if (veutLAffiche(S, robot)) poserLAffiche(S, true);
  if (c.sorte === 'elite') {
    const r = habile(robot) && !c.dos ? chanceCeSoir(S, { n: 60 }) : null, p = r ? r.v / r.n : 0;
    if (r) fixerLElite(S, p);
    mettreLEnjeu(S, p >= CHANCE_ENJEU);
  }
  if (robot === 'malin' || robot === 'temoin') choisirSonGardien(S);
  const res = jouerLeMatch(S);
  conclure(S, res);
  espion('match', S, res);
}
/* Au bureau : une histoire à répondre ; pour les habiles, une pochette quand la caisse garde de quoi payer la pièce du marché. */
async function tenirLeBureau(S, robot, espion) {
  const R = S.R, h = histoireDuJour(S);
  if (h) {
    const sur = h.H.options.find(o => !o.pari || o.pari.chance >= 0.5) || h.H.options[0];
    repondre(S, h, (habile(robot) ? sur : h.H.options[0]).cle); espion('histoire', S, h);
  }
  if (!habile(robot)) return false;
  for (const cle of ['j:epoque', 'j:bronze']) {
    if (!pochetteLibre(S, cle) || R.jetons < RUN.POCHETTES[cle] + PRIX_PIECE) continue;
    const vus = new Set(R.vus);
    const r = await tirerJoueursDuPack(cle, { graine: `${R.graine}:pochette`, n: R.achats, params: { poste: 'F' }, saisons: SAISONS, shard, libre: p => !vus.has(getPersonKey(p)) });
    if (r.cartes.length && acheterLaPochette(S, cle, r.cartes.map(x => x.p))) { espion('pochette', S, cle); return true; }
  }
  return false;
}

/*
 * UNE RUN ENTIÈRE. `relireA` (les invariants) : après ce nombre de matchs, la run est gardée, relue de sa sauvegarde
 * (`ouvrirSeance`) et continue : elle doit finir pareil. Rend { robot, graine, coach, quarts, coeurs, fin, rondes, coupe,
 * pts, rang, signatures, relances, payees, montees, pochettes, forces, banc, bancDuDepart, jetons, s, R }.
 */
export async function jouerLaRun(robot, graine, { espion = () => {}, donnees = DONNEES, relireA = null, exigence = 0, cartable = [] } = {}) {
  const t0 = Date.now();
  const coach = COACHS[Math.floor(COACHS.length * (Number(graine) * 0.6180339887 % 1))];
  let S = creerLaRun(donnees, { graine: `v30:${graine}`, coach: { cle: coach }, exigence, cartable });
  const forces = [];
  let signatures = 0, relances = 0, payees = 0, montees = 0, pochettes = 0, relue = false, bancDuDepart = null;
  const compte = (m, s, x) => { if (m === 'signe') signatures++; if (m === 'relance') { relances++; payees += x; } if (m === 'montee') montees += x; if (m === 'pochette') pochettes++; espion(m, s, x); };
  for (let garde = 0; S.R.phase !== 'fin' && garde < 2000; garde++) {
    const R = S.R;
    if (relireA != null && !relue && R.phase === 'bureau' && R.matchs.length >= relireA) {
      relue = true;
      S = ouvrirSeance(donnees, JSON.parse(JSON.stringify(figer(S))));
      continue;
    }
    if (R.phase === 'piece') {
      const o = (R.apres && R.apres.offertes) || [];
      if (o.length && robot !== 'premier') prendreUnePiece(S, robot, o, prendreLaPiece);
      pieceReglee(S);
    } else if (R.phase === 'repechage') repecherUn(S, robot, compte);
    else if (R.phase === 'quart') {
      if (R.quart.n === 0) bancDuDepart = tonBanc(S).map(x => ({ cle: x.cle, n: x.n, marche: x.marche }));
      forces.push(forceDe(S)); compte('quart', S); versLeBureau(S);
    } else if (R.phase === 'bureau') { compte('bureau', S); if (!(await tenirLeBureau(S, robot, compte))) allerAuMatch(S); }
    else if (R.phase === 'ballottage') { compte('ballottage', S); reclamer(S, offresVues(S).slice().sort((a, b) => v(b) - v(a))[0] || null); }
    else if (R.phase === 'feuille') { compte('feuille', S); jouer(S, robot, compte); }
    else if (R.phase === 'resultat') continuer(S);
    else if (R.phase === 'portes') reglerLesPortes(S, robot, compte);
    else if (R.phase === 'bilan') { compte('bilan', S, R.quarts.at(-1)); apresLeBilan(S); }
    else if (R.phase === 'marche') {
      const M = R.marche;
      if (robot !== 'premier' && !M.piece && R.jetons >= PRIX_PIECE) prendreUnePiece(S, robot, M.pieces, acheterLaPiece);
      if (habile(robot)) { const c = aMonter(S)[0]; if (c && monterAuMarche(S, c.p)) compte('montee', S, 1); }
      quitterLeMarche(S);
    } else if (R.phase === 'series') { if (!R.series.moi.w && !R.series.moi.l) forces.push(forceDe(S)); allerAuMatchDeSerie(S); }
    else throw new Error(`phase inconnue : ${R.phase}`);
  }
  if (S.R.phase !== 'fin') throw new Error(`la run ne finit pas (graine ${graine}, phase ${S.R.phase})`);
  compte('fin', S);
  const R = S.R;
  return { robot, graine, coach, quarts: R.quarts, coeurs: R.coeurs, fin: R.fin, rondes: R.fin.rondes, coupe: !!R.fin.coupe, pts: R.fin.pts, rang: R.ligue ? rangDe(S, 0) : null,
    signatures, relances, payees, montees, pochettes, forces: [...forces, forceDe(S)], banc: tonBanc(S).map(x => ({ cle: x.cle, n: x.n, marche: x.marche })), bancDuDepart, jetons: R.jetons,
    s: Math.round((Date.now() - t0) / 1000), R };
}
