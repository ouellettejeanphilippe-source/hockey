/*
 * LES ROBOTS DE LA RUN EN CARTE (V28, docs/refonte-v28.md § 5, § 10 ; V29, docs/refonte-v29.md § 9). Ils jouent une run
 * entière par les fonctions du jeu (js/run.js), jamais une copie : le camp et ses pièces, la carte de chaque acte, les
 * matchs, les portes et leurs relances, le marché, le vestiaire, le rival, les séries. scripts/mesure_run.mjs les mesure
 * (les Coupes, les cibles tenues), scripts/check_run.mjs lit leurs runs contre les invariants.
 *
 *   « premier »  la première case offerte, le premier joueur de la première porte qui tient sous le plafond, la première
 *                pièce du camp, aucun plan ;
 *   le CHIFFRE   l'affiche la plus facile, le joueur à la meilleure cote, la première pièce offerte, sans rien lire ;
 *   le MALIN     le bâtisseur (V29) : la cote au prix de l'espace qu'elle prend (`PRIX_ESPACE`), PLUS ce que l'échange
 *                change au compte de son banc (`POIDS_DU_BANC` points de cote par point de pourcentage) ; il choisit qui
 *                sort, prend la pièce la plus avancée chez lui, remplace la moins avancée, relance les portes quand
 *                l'offre est faible ; l'affiche haute quand son club est nettement plus fort (`MARGE_HAUTE`), jamais un
 *                soir de dos-à-dos, l'élite de même, le plan du duel lu à l'écran (scripts/lib/duel.mjs) ;
 *   le TÉMOIN    le malin, à une seule différence : il ne lit pas son banc aux portes (sa note est celle de la cote).
 *                C'est contre lui que « bâtir paie » se juge.
 *
 * `espion(moment, S, x)` : appelé aux moments d'une run ('portes', 'relance', 'signe', 'match', 'case', 'fin').
 */
import { getHiddenRatings, energieDe } from '../../js/sim.js';
import { groupeDuJoueur as groupeDe } from '../../js/niveaux.js';
import { PIECES, MARCHES, CASES_DU_BANC, PIECE_DU_COACH, apportDe, compteDe } from '../../js/pieces.js';
import { PRIX_PIECE } from '../../js/actes.js';
import {
  RUN, creerLaRun, casesOffertes, caseA, allerA, jouerLeMatch, conclure, vestiaireDe, sortantsPour, masseApres, signer, passerLesPortes, relancerLesPortes,
  prixDeLaRelance, apresLesPortes, apresLaFinDActe, pieceReglee, prendreLaPiece, prixDe, acheterLaPiece, avancer, reposer, monterUneCarte, allerAuMatchDeSerie,
  chanceCeSoir, fixerLElite, forceDe, ouvrirSeance, figer, rebatir, histoireDeLaCase, repondre, dosADosA, signesDe, tonBanc,
} from '../../js/run.js';
import { SAISONS, shard } from './shards.mjs';
import { robotDuel } from './duel.mjs';

export const DONNEES = { saisons: SAISONS, shard };
/* Le malin paie la cote au prix de l'espace qu'elle prend : un point de cote vaut `PRIX_ESPACE` M$ d'espace. */
const PRIX_ESPACE = Number(process.env.PRIX_ESPACE ?? 1.5);
/* Ce que le bâtisseur donne à son banc : une signature moyenne vaut 22 points de cote et ≈ 2 points de chance, un point de pourcentage sur un canal ≈ 0,2 (mesurés le 13 nov. 2026), et la moitié de plus pour qui vise la marche d'après. */
const POIDS_DU_BANC = Number(process.env.POIDS_DU_BANC ?? 3.3);
/* Il relance les portes quand le meilleur échange offert vaut moins que `NOTE_FAIBLE` points de cote, en gardant de quoi payer une pièce au marché. */
const NOTE_FAIBLE = Number(process.env.NOTE_FAIBLE ?? 40);
/* Le malin ne cherche l'affiche haute que si son club est nettement plus fort (mesuré le 11 nov. 2026 : à force égale, il manquait sa cible de l'acte III). */
const MARGE_HAUTE = 1.05;
const v = p => getHiddenRatings(p).v;
const COACHS = Object.keys(PIECE_DU_COACH);
const habile = robot => robot === 'malin' || robot === 'temoin';

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
/* Ce qu'un échange change à ton banc, en points de pourcentage sur la pente : celui qui arrive compte, celui qui sort ne compte plus (s'il comptait). */
function gainDuBanc(S, c, comptes) {
  let g = 0;
  for (const [cle, n, signes] of comptes) g += pente(cle, n + apportDe(cle, c.p) - (signes.has(c.sortant) ? apportDe(cle, c.sortant) : 0)) - pente(cle, n);
  return g;
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
  const signes = signesDe(S), enSigne = new Set(signes);
  const comptes = robot === 'malin' ? S.R.banc.map(cle => [cle, compteDe(cle, signes), enSigne]) : [];
  const note = c => c.gain - PRIX_ESPACE * Math.max(0, (prixDe(S, c.p) - RUN.RACHAT * prixDe(S, c.sortant)) / 1e6) + POIDS_DU_BANC * gainDuBanc(S, c, comptes);
  const b = portes.flatMap(x => echanges(S, x)).map(c => ({ ...c, note: note(c) })).sort((a, c) => c.note - a.note)[0];
  return b && b.note > 0 ? b : null;
}
/* Les portes : relancer si l'offre est faible, puis signer ou passer, puis la suite. */
function reglerLesPortes(S, robot, espion) {
  espion('portes', S);
  let c = choisirAuxPortes(S, robot);
  // LA RELANCE (V29) : la relance gagnée par une défaite, ou payée en jetons — quand le meilleur échange offert est faible.
  while (habile(robot) && (!c || c.note < NOTE_FAIBLE)) {
    const prix = prixDeLaRelance(S);
    if (prix == null || (prix > 0 && S.R.jetons < prix + PRIX_PIECE) || !relancerLesPortes(S)) break;
    espion('relance', S, prix);
    c = choisirAuxPortes(S, robot);
  }
  if (c && signer(S, c.p, c.sortant, { auMieux: true })) espion('signe', S, c); else passerLesPortes(S);
  apresLesPortes(S);
}

/* ---------- les pièces ---------- */
/* La pièce qu'on prend, parmi les offertes : la première ; le témoin et le malin, la plus avancée chez eux. */
const pieceLue = (S, robot, offertes) => (habile(robot) ? offertes.slice().sort((a, b) => avance(S, b) - avance(S, a))[0] : offertes[0]) || null;
/* Une case libre : la pièce lue. Banc plein : le témoin et le malin sortent leur moins avancée, si la neuve l'est plus. */
function prendreUnePiece(S, robot, offertes, poser) {
  const cle = pieceLue(S, robot, offertes);
  if (!cle) return;
  if (S.R.banc.length < CASES_DU_BANC) return void poser(S, cle);
  if (!habile(robot)) return;
  const sort = S.R.banc.slice().sort((a, b) => avance(S, a) - avance(S, b))[0];
  if (avance(S, sort) < avance(S, cle)) poser(S, cle, sort);
}
/* Une pièce offerte : celles du camp se prennent toujours ; ailleurs, « premier » passe. */
function reglerLaPiece(S, robot) {
  const o = (S.R.apres && S.R.apres.offertes) || [];
  if (o.length && (robot !== 'premier' || S.R.phase === 'camp')) prendreUnePiece(S, robot, o, prendreLaPiece);
  pieceReglee(S);
}

/* ---------- la carte ---------- */
/* La case du rang : « premier » la première ; le chiffre, la plus facile ; le malin et le témoin, l'affiche haute si leur club la vaut. */
function choisirLaCase(S, robot) {
  const R = S.R, offertes = casesOffertes(S), cases = offertes.map(i => ({ i, c: caseA(S, R.rang, i) }));
  if (robot === 'premier' || cases.length === 1) return cases[0].i;
  if (cases[0].c.sorte === 'match' || cases[0].c.sorte === 'elite') {
    const sansElite = cases.filter(x => x.c.sorte !== 'elite');
    if (robot === 'chiffre') return (sansElite.find(x => !x.c.haute) || sansElite[0] || cases[0]).i;
    const club = x => S.clubs.find(k => k.s === x.c.s && k.t === x.c.t);
    // Un dos-à-dos se joue sur les jambes de la veille : ni l'élite ni l'affiche haute.
    const las = dosADosA(cases[0].c, R.rang);
    const elite = cases.find(x => x.c.sorte === 'elite');
    if (elite && !las && R.coeurs >= 2 && forceDe(S) >= club(elite).force) return elite.i;
    const haute = sansElite.find(x => x.c.haute);
    return (haute && !las && forceDe(S) >= club(haute).force * MARGE_HAUTE ? haute : sansElite.find(x => !x.c.haute) || sansElite[0] || cases[0]).i;
  }
  // Un arrêt : le marché quand la pièce se paie et tient sur le banc ; le vestiaire quand le club est usé ou blessé ; sinon l'histoire.
  const joueurs = Object.values(S.roster).filter(Boolean);
  const use = joueurs.reduce((a, p) => a + energieDe(p), 0) / joueurs.length < 85 || S.toi.injured.size > 0;
  const veut = R.jetons >= PRIX_PIECE && R.banc.length < CASES_DU_BANC ? 'marche' : use ? 'vestiaire' : 'histoire';
  return (cases.find(x => x.c.sorte === veut) || cases[0]).i;
}
/* Un match, joué et compté. Le duel : le plan du robot (`S.robotDuel`). */
function jouer(S, espion) {
  const R = S.R;
  if (R.case.sorte === 'elite') fixerLElite(S, (x => x.v / x.n)(chanceCeSoir(S, { n: 60 })));
  const res = jouerLeMatch(S);
  conclure(S, res);
  espion('match', S, res);
}

/*
 * UNE RUN ENTIÈRE. `relireA` (les invariants) : après ce nombre de matchs, la run est gardée, relue de sa sauvegarde
 * (`ouvrirSeance`) et continue : elle doit finir pareil. Rend { robot, graine, coach, actes, coeurs, fin, rondes,
 * coupe, signatures, relances, payees, forces, banc, jetons, s, R }.
 */
export function jouerLaRun(robot, graine, { espion = () => {}, donnees = DONNEES, relireA = null, exigence = 0 } = {}) {
  const t0 = Date.now();
  const coach = COACHS[Math.floor(COACHS.length * (Number(graine) * 0.6180339887 % 1))];
  let S = creerLaRun(donnees, { graine: `v28:${graine}`, coach: { cle: coach }, exigence });
  S.robotDuel = robotDuel(habile(robot) ? 'attentif' : 'rien');
  const forces = [forceDe(S)];
  let signatures = 0, relances = 0, payees = 0, relue = false;
  const compte = (m, s, x) => { if (m === 'signe') signatures++; if (m === 'relance') { relances++; payees += x; } espion(m, s, x); };
  for (let garde = 0; S.R.phase !== 'fin' && garde < 400; garde++) {
    const R = S.R;
    if (relireA != null && !relue && R.phase === 'carte' && R.matchs.length >= relireA) {
      relue = true;
      S = ouvrirSeance(donnees, JSON.parse(JSON.stringify(figer(S))));
      S.robotDuel = robotDuel(habile(robot) ? 'attentif' : 'rien');
      rebatir(S);
      continue;
    }
    if (R.phase === 'camp' || R.phase === 'portes') {
      // Les pièces offertes d'abord (au camp, deux de suite), puis les portes.
      for (let k = 0; S.R.apres && (S.R.apres.offertes || []).length && k < 4; k++) reglerLaPiece(S, robot);
      reglerLesPortes(S, robot, compte);
    } else if (R.phase === 'annonce') { forces.push(forceDe(S)); R.phase = 'carte'; }
    else if (R.phase === 'carte') { allerA(S, choisirLaCase(S, robot)); compte('case', S); }
    else if (R.phase === 'feuille') jouer(S, compte);
    else if (R.phase === 'finacte') { reglerLaPiece(S, robot); apresLaFinDActe(S); }
    else if (R.phase === 'marche') {
      const M = R.marche;
      if (robot !== 'premier' && !M.piece && R.jetons >= PRIX_PIECE) prendreUnePiece(S, robot, M.pieces, acheterLaPiece);
      avancer(S);
    } else if (R.phase === 'vestiaire') {
      const joueurs = Object.values(S.roster).filter(Boolean);
      const use = joueurs.reduce((a, p) => a + energieDe(p), 0) / joueurs.length < 85 || S.toi.injured.size > 0;
      const meilleur = joueurs.filter(p => groupeDe(p) !== 'G').sort((a, b) => v(b) - v(a))[0];
      if (use || robot === 'premier' || !monterUneCarte(S, meilleur)) reposer(S);
    } else if (R.phase === 'histoire') {
      // Une histoire : le malin et le témoin évitent le dé à moins d'une chance sur deux ; les autres prennent la première carte.
      const h = histoireDeLaCase(S);
      if (!h) avancer(S);
      else { const sur = h.H.options.find(o => !o.pari || o.pari.chance >= 0.5) || h.H.options[0]; repondre(S, h, (habile(robot) ? sur : h.H.options[0]).cle); compte('histoire', S, h); }
    }
    else if (R.phase === 'series') { forces.push(forceDe(S)); allerAuMatchDeSerie(S); }
    else throw new Error(`phase inconnue : ${R.phase}`);
  }
  compte('fin', S);
  const R = S.R;
  return { robot, graine, coach, actes: R.actes, coeurs: R.coeurs, fin: R.fin, rondes: R.fin ? R.fin.rondes : 0, coupe: !!(R.fin && R.fin.coupe),
    signatures, relances, payees, forces: [...forces, forceDe(S)], banc: tonBanc(S).map(x => ({ cle: x.cle, n: x.n, marche: x.marche })), jetons: R.jetons,
    s: Math.round((Date.now() - t0) / 1000), R };
}
