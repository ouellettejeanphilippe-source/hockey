/*
 * LES ROBOTS DE LA RUN EN CARTE (V28, docs/refonte-v28.md § 5, § 10). Ils jouent une run entière par les fonctions du jeu
 * (js/run.js), jamais une copie : le camp, la carte de chaque acte, les matchs, les portes, le marché, le vestiaire, le
 * rival, les séries. scripts/mesure_run.mjs les mesure (les Coupes, les cibles tenues), scripts/check_run.mjs lit leurs
 * runs contre les invariants.
 *
 *   « premier »  la première case offerte, le premier joueur de la première porte qui tient sous le plafond, aucun plan ;
 *   le CHIFFRE   l'affiche la plus facile, le joueur à la meilleure cote, sans rien lire, aucun plan ;
 *   le MALIN     ce que l'écran montre : la cote au prix de l'espace qu'elle prend (`PRIX_ESPACE`), l'affiche haute quand
 *                son club est nettement plus fort (`MARGE_HAUTE`), jamais un soir de dos-à-dos, l'élite de même, le plan
 *                du duel lu à l'écran (scripts/lib/duel.mjs), la pièce qui répond au rival de l'acte ou la plus haute
 *                (`pieceLue`), le marché et le vestiaire selon son état.
 *
 * `espion(moment, S, x)` : appelé aux moments d'une run ('portes', 'signe', 'match', 'case', 'fin'), pour les invariants.
 * `lire` (une mesure seulement) : { note(S, candidat), piece(S, offertes), sort(S, cle) } — un robot d'essai qui juge un
 * candidat, choisit sa pièce et dit laquelle sort du banc plein par ses propres règles (scripts/mesure_build.mjs).
 */
import { getHiddenRatings, energieDe } from '../../js/sim.js';
import { groupeDuJoueur as groupeDe } from '../../js/niveaux.js';
import { PIECES, CASES_DU_BANC, PIECE_DU_COACH } from '../../js/pieces.js';
import { PRIX_PIECE } from '../../js/actes.js';
import {
  RUN, creerLaRun, casesOffertes, caseA, allerA, jouerLeMatch, conclure, vestiaireDe, sortantsPour, masseApres, signer, passerLesPortes, apresLesPortes,
  apresLaFinDActe, pieceReglee, prendreLaPiece, prixDe, acheterLaPiece, avancer, reposer, monterUneCarte, allerAuMatchDeSerie, chanceCeSoir, fixerLElite, forceDe,
  ouvrirSeance, figer, rebatir, histoireDeLaCase, repondre, jeuDe, dosADosA,
} from '../../js/run.js';
import { SAISONS, shard } from './shards.mjs';
import { robotDuel } from './duel.mjs';

export const DONNEES = { saisons: SAISONS, shard };
/* Le malin paie la cote au prix de l'espace qu'elle prend : un point de cote vaut `PRIX_ESPACE` M$ d'espace. */
const PRIX_ESPACE = Number(process.env.PRIX_ESPACE ?? 1.5);
/* Le malin ne cherche l'affiche haute que si son club est nettement plus fort (mesuré le 11 nov. 2026 : à force égale, il manquait sa cible de l'acte III). */
const MARGE_HAUTE = 1.05;
const v = p => getHiddenRatings(p).v;
const COACHS = Object.keys(PIECE_DU_COACH);

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
function choisirAuxPortes(S, robot, lire) {
  const portes = S.R.portes.pochette ? [null] : S.R.portes.clubs;
  if (robot === 'premier') return candidats(S, portes[0])[0] || null;
  // Un robot qui lit autre chose que la cote (`lire.note`, une mesure : scripts/mesure_build.mjs) juge chaque échange lui-même.
  // Il choisit aussi qui sort : chaque joueur du groupe dont la sortie fait tenir l'arrivant, pas seulement le plus faible.
  if (lire && lire.note) {
    const paires = portes.flatMap(x => vestiaireDe(S, x).filter(c => c.tient).flatMap(({ p }) => sortantsPour(S, p).filter(q => masseApres(S, p, q) <= S.R.plafond).map(sortant => ({ p, sortant, gain: v(p) - v(sortant), porte: x }))));
    const c = paires.map(x => ({ ...x, note: lire.note(S, x) })).sort((x, y) => y.note - x.note)[0];
    return c && c.note > 0 ? c : null;
  }
  const tous = portes.flatMap(x => candidats(S, x)).filter(c => c.gain > 0);
  if (robot === 'chiffre') return tous.sort((a, b) => b.gain - a.gain)[0] || null;
  const note = c => c.gain - PRIX_ESPACE * Math.max(0, (prixDe(S, c.p) - RUN.RACHAT * prixDe(S, c.sortant)) / 1e6);
  const b = tous.sort((a, c) => note(c) - note(a))[0];
  return b && note(b) > 0 ? b : null;
}
/* Les portes : signer ou passer, puis la suite. */
function reglerLesPortes(S, robot, espion, lire) {
  espion('portes', S);
  const c = choisirAuxPortes(S, robot, lire);
  if (c && signer(S, c.p, c.sortant, { auMieux: true })) espion('signe', S, c); else passerLesPortes(S);
  apresLesPortes(S);
}
/*
 * LA PIÈCE QU'ON PREND, parmi les offertes. Le chiffre prend la première. Le malin lit ce que l'écran montre : la pièce qui
 * répond au rival de l'acte (« Pour le battre », sous son annonce : son match compte double), sinon la carte du plus haut
 * niveau (ses diamants).
 */
function pieceLue(S, robot, offertes, lire) {
  if (lire && lire.piece) return lire.piece(S, offertes);
  if (robot !== 'malin') return offertes[0];
  const rival = S.R.phase !== 'finacte' && S.R.carte ? S.R.carte.rival : null, contre = rival ? jeuDe(S, rival).contre : [];
  return offertes.find(k => contre.includes(k)) || offertes.slice().sort((a, b) => PIECES[b].cadre - PIECES[a].cadre)[0];
}
/* Une pièce offerte : s'il reste une case sur le banc. */
function reglerLaPiece(S, robot, lire) {
  const o = (S.R.apres && S.R.apres.offertes) || [];
  if (o.length && robot !== 'premier') prendreUnePiece(S, robot, o, lire, prendreLaPiece);
  pieceReglee(S);
}
/* Une case libre : la pièce lue. Banc plein : seulement le robot qui dit laquelle sort (`lire.sort`). */
function prendreUnePiece(S, robot, offertes, lire, poser) {
  const cle = pieceLue(S, robot, offertes, lire);
  if (!cle) return;
  if (S.R.banc.length < CASES_DU_BANC) poser(S, cle);
  else if (lire && lire.sort) { const sort = lire.sort(S, cle); if (sort) poser(S, cle, sort); }
}
/* La case du rang : « premier » la première ; le chiffre, la plus facile ; le malin, l'affiche haute si son club la vaut. */
function choisirLaCase(S, robot) {
  const R = S.R, offertes = casesOffertes(S), cases = offertes.map(i => ({ i, c: caseA(S, R.rang, i) }));
  if (robot === 'premier' || cases.length === 1) return cases[0].i;
  if (cases[0].c.sorte === 'match' || cases[0].c.sorte === 'elite') {
    const sansElite = cases.filter(x => x.c.sorte !== 'elite');
    if (robot === 'chiffre') return (sansElite.find(x => !x.c.haute) || sansElite[0] || cases[0]).i;
    const club = x => S.clubs.find(k => k.s === x.c.s && k.t === x.c.t);
    // Un dos-à-dos se joue sur les jambes de la veille : le malin n'y cherche ni l'élite ni l'affiche haute.
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
 * coupe, signatures, forces, s, R }.
 */
export function jouerLaRun(robot, graine, { espion = () => {}, donnees = DONNEES, relireA = null, exigence = 0, lire = null } = {}) {
  const t0 = Date.now();
  const coach = COACHS[Math.floor(COACHS.length * (Number(graine) * 0.6180339887 % 1))];
  let S = creerLaRun(donnees, { graine: `v28:${graine}`, coach: { cle: coach }, exigence });
  S.robotDuel = robotDuel(robot === 'malin' ? 'attentif' : 'rien');
  const forces = [forceDe(S)];
  let signatures = 0, relue = false;
  const compte = (m, s, x) => { if (m === 'signe') signatures++; espion(m, s, x); };
  for (let garde = 0; S.R.phase !== 'fin' && garde < 400; garde++) {
    const R = S.R;
    if (relireA != null && !relue && R.phase === 'carte' && R.matchs.length >= relireA) {
      relue = true;
      S = ouvrirSeance(donnees, JSON.parse(JSON.stringify(figer(S))));
      S.robotDuel = robotDuel(robot === 'malin' ? 'attentif' : 'rien');
      rebatir(S);
      continue;
    }
    if (R.phase === 'camp' || R.phase === 'portes') {
      if (R.apres && (R.apres.offertes || []).length) reglerLaPiece(S, robot, lire);
      reglerLesPortes(S, robot, compte, lire);
    } else if (R.phase === 'annonce') { forces.push(forceDe(S)); R.phase = 'carte'; }
    else if (R.phase === 'carte') { allerA(S, choisirLaCase(S, robot)); compte('case', S); }
    else if (R.phase === 'feuille') jouer(S, compte);
    else if (R.phase === 'finacte') { reglerLaPiece(S, robot, lire); apresLaFinDActe(S); }
    else if (R.phase === 'marche') {
      const M = R.marche;
      if (robot !== 'premier' && !M.piece && R.jetons >= PRIX_PIECE) prendreUnePiece(S, robot, M.pieces, lire, acheterLaPiece);
      avancer(S);
    } else if (R.phase === 'vestiaire') {
      const joueurs = Object.values(S.roster).filter(Boolean);
      const use = joueurs.reduce((a, p) => a + energieDe(p), 0) / joueurs.length < 85 || S.toi.injured.size > 0;
      const meilleur = joueurs.filter(p => groupeDe(p) !== 'G').sort((a, b) => v(b) - v(a))[0];
      if (use || robot === 'premier' || !monterUneCarte(S, meilleur)) reposer(S);
    } else if (R.phase === 'histoire') {
      // Une histoire : le malin évite le dé à moins d'une chance sur deux ; les autres prennent la première carte.
      const h = histoireDeLaCase(S);
      if (!h) avancer(S);
      else { const sur = h.H.options.find(o => !o.pari || o.pari.chance >= 0.5) || h.H.options[0]; repondre(S, h, (robot === 'malin' ? sur : h.H.options[0]).cle); compte('histoire', S, h); }
    }
    else if (R.phase === 'series') { forces.push(forceDe(S)); allerAuMatchDeSerie(S); }
    else throw new Error(`phase inconnue : ${R.phase}`);
  }
  compte('fin', S);
  const R = S.R;
  return { robot, graine, coach, actes: R.actes, coeurs: R.coeurs, fin: R.fin, rondes: R.fin ? R.fin.rondes : 0, coupe: !!(R.fin && R.fin.coupe),
    signatures, forces: [...forces, forceDe(S)], s: Math.round((Date.now() - t0) / 1000), R };
}
