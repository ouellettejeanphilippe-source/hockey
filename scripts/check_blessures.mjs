/*
 * LA BLESSURE SE RÈGLE ET SON RETOUR NE TOUCHE À RIEN D'AUTRE (1.0, oct.).
 * JP : *améliorer le système de gestion de blessure pour que ça marche : là,
 * ça bloque même après correction, et lors du retour, ça fucke l'alignement
 * complet*. Deux fautes, une cause : l'écran retenait en mémoire ce qu'il
 * avait « traité » au lieu de le LIRE sur l'alignement, et le retour rejouait
 * la photo COMPLÈTE d'avant la blessure.
 *
 * Ce script joue la vraie ligue (le vrai moteur, jour par jour, les décisions
 * rejouées comme l'écran le fait) et vérifie, par chaque chemin de correction
 * (réserviste monté, rappel du ballottage, banc à la main, banc qui remanie
 * en plus) :
 *   — la blessure BLOQUE tant que la case habillée n'est pas comblée ;
 *   — dès qu'elle l'est, elle ne bloque plus, ni ce jour-là, ni un autre jour
 *     de la même blessure, ni dans une ligue reconstruite depuis les décisions
 *     (un rechargement : rien ne se retient en mémoire) ;
 *   — au retour, `retourDuBlesse` rend sa case au blessé, renvoie son
 *     suppléant d'où il venait, et ne bouge rien d'autre (au plus deux
 *     joueurs) ; l'alignement reste VALIDE : aucun doublon, personne de perdu,
 *     aucune case habillée vide, chacun à un poste qu'il joue ;
 *   — la même fonction, sur des centaines d'alignements tirés au hasard,
 *     ne produit jamais un alignement invalide.
 *
 *   node scripts/check_blessures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, jouerJournee, poserAlignementDuJour, getPlayerKey, connaitre, photoAlignement, fits, activeLineup } from '../js/sim.js';
import { BLESSURE_MOMENT, etatDeBlessure, blessureOuverte, retourDuBlesse, problemesDAlignement, rappelDuClubEcole, productionDe } from '../js/ballottage.js';
import { plafondDe } from '../js/banque.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const shard = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

// Les équipes, lues une fois ; chaque `ligue()` en refait des joueurs neufs (un rechargement).
const BRUT = [];
for (const f of SAISONS.slice(10, 40)) {
  const sh = shard(f);
  for (const tag of [...new Set(sh.players.map(p => p.t))].slice(0, 2)) {
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    BRUT.push({ tag, season: sh.season, joueurs: un.flat() });
    if (BRUT.length === 8) break;
  }
  if (BRUT.length === 8) break;
}
// Des réservistes : `autoRoster` n'en remplit pas, un vrai club en a (la pige les donne).
const EST_D = x => /D$/.test(x.p), EST_F = x => x.p !== 'G' && !EST_D(x);
const POOL = shard(SAISONS[3]).players.filter(x => x.gp > 40);
function ligue() {
  return BRUT.map((b, n) => {
    const p = b.joueurs.map(x => ({ ...x })); p.forEach(registerHiddenRatings);
    // La première est la tienne : les décisions l'alignent, un club de l'IA se réaligne seul (`creerLigue`).
    const t = createTeam(`${b.tag} ${b.season}`, b.tag, autoRoster(p), { season: b.season, isPlayer: n === 0 });
    for (const [role, est] of [['Réserve F', EST_F], ['Réserve D', EST_D]]) {
      const sl = SLOTS.find(x => x.role === role);
      const c = { ...POOL.filter(est)[n] };
      registerHiddenRatings(c);
      if (!t.roster[sl.i]) t.roster[sl.i] = c;
    }
    return t;
  });
}
// Un joueur d'une autre saison, par groupe : le rappelé du ballottage.
const rappeles = {};
for (const g of ['F', 'D']) {
  const p = { ...shard(SAISONS[5]).players.find(x => x.gp > 40 && (g === 'D' ? EST_D(x) : EST_F(x))) };
  registerHiddenRatings(p); rappeles[g] = p;
}

/*
 * LE RAPPEL DU CLUB-ÉCOLE (oct.), par groupe : le vrai joueur que l'écran offre quand rien d'autre ne comble
 * (`rappelDuClubEcole`, js/ballottage.js), tiré des saisons de la ligue, d'un club qui n'y est pas.
 */
const SHARDS = new Map();
for (const b of BRUT) if (!SHARDS.has(b.season)) {
  const players = shard(`${b.season}.json`).players, byTeam = {};
  for (const x of players) (byTeam[x.t] = byTeam[x.t] || []).push(x);
  SHARDS.set(b.season, { players, byTeam });
}
const LIGUE_ECOLE = { cles: BRUT.map(b => `${b.season}|${b.tag}`), teams: [], graine: 7 };
const ecoles = {};
for (const g of ['F', 'D']) {
  const blesse = BRUT[0].joueurs.find(x => (g === 'D' ? EST_D(x) : EST_F(x)) && x.gp > 60);
  const p = rappelDuClubEcole({ shards: SHARDS, ligue: LIGUE_ECOLE, blesse, at: 1 });
  ecoles[g] = p ? { ...p } : null;
  if (ecoles[g]) registerHiddenRatings(ecoles[g]);
  exiger(`le club-école a toujours un ${g === 'D' ? 'défenseur' : 'attaquant'} : un vrai joueur, monté quelques matchs, d'un club hors de la ligue`,
    !!p && (g === 'D' ? EST_D(p) : EST_F(p)) && p.gp >= 5 && p.gp <= 30 && !LIGUE_ECOLE.cles.includes(`${p.s}|${p.t}`) && productionDe(p) < productionDe(blesse),
    p ? `${p.n} (${p.t} ${p.s}, ${p.gp} matchs, ${(productionDe(p)).toFixed(2)} pt/m contre ${productionDe(blesse).toFixed(2)})` : 'personne');
}
exiger('le rappel du club-école est le même à chaque appel', getPlayerKey(rappelDuClubEcole({ shards: SHARDS, ligue: LIGUE_ECOLE, blesse: BRUT[0].joueurs.find(x => EST_F(x) && x.gp > 60), at: 1 })) === getPlayerKey(ecoles.F), '');

const cle = getPlayerKey;
const parCle = roster => new Map(Object.values(roster).filter(Boolean).map(p => [cle(p), p]));
const valide = roster => problemesDAlignement(photoAlignement(roster), parCle(roster), { attendu: [...parCle(roster).keys()] });

/* Une ligue reconstruite depuis la graine et les décisions, au jour `n` : un rechargement de la page. */
function etatAuJour(graine, decisions, n) {
  const L = creerLigue(ligue(), 82, { graine, decisions: decisions.map(d => ({ ...d })) });
  jouerJusqua(L, n);
  // L'écran pose tout de suite la part « alignement » des décisions du jour (S79).
  poserAlignementDuJour(L);
  return { L, toi: L.teams[0] };
}
const etatDe = (toi, b) => etatDeBlessure({ roster: toi.roster, injured: toi.injured, b, rappel: false });
const dE = toi => ({ jour: 0, equipe: 0, cases: photoAlignement(toi.roster) });
// La même blessure, retrouvée dans une ligue reconstruite (les objets changent, la clé et le match non).
const memeBlessure = (toi, b) => toi.injuriesLog.find(x => x.at === b.at && cle(x.player) === cle(b.player));

/*
 * LA BLESSURE D'ESSAI : un patineur habillé de TON club, absent huit matchs ou
 * plus, qu'un réserviste peut remplacer. Les graines se parcourent dans
 * l'ordre : la même à chaque exécution.
 */
function trouver(groupe) {
  for (let g = 0; g < 80; g++) {
    const graine = `blessures-${g}`;
    const teams = ligue();
    const L = creerLigue(teams, 82, { graine, decisions: [dE(teams[0])] });
    poserAlignementDuJour(L);
    const toi = L.teams[0];
    for (let j = 0; j < 60 && !L.fini; j++) {
      jouerJournee(L);
      const x = blessureOuverte({ roster: toi.roster, injured: toi.injured, journal: toi.injuriesLog, joues: toi.games });
      if (x && x.forcer && x.b.games >= 8 && x.b.at === toi.games && (groupe === 'D' ? /D$/.test(x.b.player.p) : x.b.player.p !== 'G' && !/D$/.test(x.b.player.p))) {
        return { graine, jour: L.jour, b: x.b, depart: dE(toi), nom: x.b.player.n, at: x.b.at, cle: cle(x.b.player), sl: x.sl, reserves: x.reserves.map(r => ({ i: r.sl.i, cle: cle(r.p) })), L };
      }
    }
  }
  return null;
}

const echanger = (cases, a, b) => { const k = cases[a]; if (b in cases) cases[a] = cases[b]; else delete cases[a]; if (k) cases[b] = k; else delete cases[b]; return cases; };

/*
 * LES QUATRE CHEMINS. Chacun rend les décisions qu'il pose au jour J ; l'état
 * d'avant est l'alignement du jour J, juste après la blessure.
 */
const CHEMINS = {
  reserve: (S, toi) => ({ cases: echanger(photoAlignement(toi.roster), S.sl.i, S.reserves[0].i), palier: `b:${S.at}:${S.cle}` }),
  rappel: (S, toi, rap) => {
    // Le rappelé entre dans la réserve libérée, puis échange avec le blessé : comme l'écran (`ouvrirBallottage`).
    const R = SLOTS.find(s => s.scratch && !s.extra && s.group === (/D$/.test(S.b.player.p) ? 'D' : 'F'));
    const cases = photoAlignement(toi.roster), sort = cases[R.i];
    cases[R.i] = S.cle; cases[S.sl.i] = cle(rap);
    return { cases, palier: `b:${S.at}:${S.cle}`, ballottage: { i: R.i, entre: cle(rap), sort } };
  },
  // Le club-école (oct.) : le même chemin que le ballottage, un vrai joueur faible, hors plafond.
  ecole: (S, toi) => {
    const g = /D$/.test(S.b.player.p) ? 'D' : 'F', E = ecoles[g];
    const R = SLOTS.find(s => s.scratch && !s.extra && s.group === g);
    const cases = photoAlignement(toi.roster), sort = cases[R.i];
    cases[R.i] = S.cle; cases[S.sl.i] = cle(E);
    return { cases, palier: `b:${S.at}:${S.cle}`, ballottage: { i: R.i, entre: cle(E), sort, ecole: true } };
  },
  // Le banc, à la main : le blessé dans une réserve de plus, le réserviste à sa case — et rien d'autre.
  banc: (S, toi) => {
    const R = SLOTS.find(s => s.scratch && s.extra && !toi.roster[s.i]);
    const cases = photoAlignement(toi.roster);
    cases[R.i] = S.cle; cases[S.sl.i] = S.reserves[0].cle; delete cases[S.reserves[0].i];
    return { cases };
  },
  // Le banc qui remanie en plus : un autre échange sans rapport (deux ailiers du bas), fait pendant l'absence.
  remanie: (S, toi) => {
    const cases = echanger(photoAlignement(toi.roster), S.sl.i, S.reserves[0].i);
    const F = SLOTS.filter(s => !s.scratch && s.group === 'F' && s.i !== S.sl.i && toi.roster[s.i]);
    const [a, b] = [F[F.length - 1], F[F.length - 2]];
    echanger(cases, a.i, b.i);
    return { cases, autres: [[a.i, cases[a.i]], [b.i, cases[b.i]]] };
  },
};

function essai(groupe, nom, S) {
  const rap = rappeles[groupe];
  connaitre(rap);
  if (ecoles[groupe]) connaitre(ecoles[groupe]);
  const decision = CHEMINS[nom](S, S.L.teams[0], rap);
  const decisions = [S.depart, { jour: S.jour, equipe: 0, sel: `s-${nom}`, ...decision }];
  const T = `${groupe} · ${nom}`;

  // 1. Avant la correction : ça bloque (la ligue d'origine, sans décision).
  const avant = etatAuJour(S.graine, [S.depart], S.jour);
  const bAvant = memeBlessure(avant.toi, S.b);
  exiger(`${T} : sans correction, ${S.nom} bloque`, bAvant && etatDe(avant.toi, bAvant).forcer, `case ${S.sl.role}, ${S.reserves.length} réserviste(s)`);

  // 2. Après la correction : plus de blocage, ce jour-là…
  const apres = etatAuJour(S.graine, decisions, S.jour);
  const b = memeBlessure(apres.toi, S.b);
  const e0 = etatDe(apres.toi, b);
  exiger(`${T} : la case du blessé est comblée, il ne bloque plus`, !e0.sl && !e0.forcer, e0.sl ? `encore ${e0.sl.role}` : 'en réserve');
  const ouverte = blessureOuverte({ roster: apres.toi.roster, injured: apres.toi.injured, journal: apres.toi.injuriesLog, joues: apres.toi.games });
  exiger(`${T} : aucune blessure ne bloque l'alignement corrigé`, !ouverte || !ouverte.forcer || cle(ouverte.b.player) !== S.cle, ouverte ? ouverte.b.player.n : 'aucune');
  exiger(`${T} : l'alignement corrigé est valide`, !valide(apres.toi.roster).length, valide(apres.toi.roster).join(' · '));
  exiger(`${T} : le blessé n'est pas dans une case habillée, et son suppléant y joue`,
    !SLOTS.some(s => !s.scratch && apres.toi.roster[s.i] === b.player), `${S.nom} en réserve`);

  if (decision.ballottage && decision.ballottage.ecole) {
    const p = apres.toi.roster[S.sl.i];
    exiger(`${T} : le rappelé du club-école joue sa case, et il ne compte pas au plafond`,
      p && cle(p) === decision.ballottage.entre && plafondDe(decisions).ecole.has(decision.ballottage.entre), p ? p.n : 'personne');
  }
  // 3. …et un autre jour de la même blessure, et dans une ligue reconstruite (un rechargement).
  let rebloque = 0, jours = 0;
  const fin = S.b.at + S.b.games;
  let L = apres.L, toi = apres.toi;
  while (!L.fini && toi.games < fin + 2) {
    jouerJournee(L); jours++;
    const bb = memeBlessure(toi, S.b);
    if (toi.games < fin && toi.games >= S.b.at) {
      const e = etatDe(toi, bb);
      if (e.forcer) rebloque++;
    }
  }
  exiger(`${T} : la même blessure ne bloque plus pendant ses ${S.b.games} matchs`, rebloque === 0, `${jours} journées jouées, ${rebloque} blocages`);
  const milieu = Math.min(L.jour, S.jour + 3);
  const recharge = etatAuJour(S.graine, decisions, milieu);
  const br = memeBlessure(recharge.toi, S.b);
  exiger(`${T} : après rechargement (ligue refaite depuis les décisions), il ne bloque pas non plus`, br && !etatDe(recharge.toi, br).forcer, `jour ${milieu}`);

  // 4. Le retour : on joue jusqu'à ce qu'il revienne, sur la ligue refaite.
  const retour = etatAuJour(S.graine, decisions, 0);
  const Lr = retour.L, tr = retour.toi;
  while (!Lr.fini && tr.games < fin) jouerJournee(Lr);
  const bR = memeBlessure(tr, S.b);
  const r = retourDuBlesse({ roster: tr.roster, injured: tr.injured, b: bR });
  exiger(`${T} : le retour propose de le remettre à sa case`, !!r && r.mouvements[0].vers.i === S.sl.i, r ? `${r.mouvements.map(m => `${m.p.n} → ${m.vers.role}`).join(' · ')}` : 'rien');
  if (!r) return;
  const apresRetour = { ...tr.roster };
  const parClef = parCle(tr.roster);
  for (const k of Object.keys(apresRetour)) delete apresRetour[k];
  for (const [i, k] of Object.entries(r.cases)) apresRetour[i] = parClef.get(k);
  exiger(`${T} : l'alignement du retour est valide`, !valide(apresRetour).length, valide(apresRetour).join(' · '));
  const avantC = photoAlignement(tr.roster), place = c => Object.fromEntries(Object.entries(c).map(([i, k]) => [k, i]));
  const bouge = Object.entries(place(r.cases)).filter(([k, i]) => place(avantC)[k] !== i).map(([k]) => k);
  exiger(`${T} : le retour ne bouge que deux joueurs`, bouge.length <= 2 && r.mouvements.length <= 2, `${bouge.length} joueurs déplacés`);
  exiger(`${T} : le blessé reprend sa case d'avant`, r.cases[S.sl.i] === S.cle, S.sl.role);
  if (decision.autres) {
    // Le remaniement sans rapport (deux ailiers) survit au retour.
    exiger(`${T} : ce qu'on avait remanié depuis ne bouge pas`, decision.autres.every(([i, k]) => r.cases[i] === k), '2 ailiers');
  }
  // On le joue : décision au jour du retour, la ligue rejouée, aucun trou, et il joue sa case.
  const jr = Lr.jour;
  const jouee = etatAuJour(S.graine, [...decisions, { jour: jr, equipe: 0, cases: r.cases, palier: `rv:${S.at}:${S.cle}`, sel: 'retour' }], jr);
  const lineup = activeLineup(jouee.toi);
  // Une case vide n'est permise que si son joueur vient de se blesser et qu'aucun réserviste en santé ne la joue.
  const reservistesSains = SLOTS.filter(s => s.scratch && jouee.toi.roster[s.i] && !jouee.toi.injured.has(jouee.toi.roster[s.i])).map(s => jouee.toi.roster[s.i]);
  const utilises = new Set(Object.values(lineup).filter(Boolean));
  const trous = SLOTS.filter(s => !s.scratch && !s.extra && !lineup[s.i]
    && (!jouee.toi.injured.has(jouee.toi.roster[s.i]) || reservistesSains.some(r => !utilises.has(r) && fits(r, s)))).length;
  exiger(`${T} : le jour du retour, il joue sa case et aucune case n'est vide sans raison`, lineup[S.sl.i] && cle(lineup[S.sl.i]) === S.cle && trous === 0, `${trous} case(s) vide(s)`);
  const jouer = etatAuJour(S.graine, [...decisions, { jour: jr, equipe: 0, cases: r.cases, palier: `rv:${S.at}:${S.cle}`, sel: 'retour' }], jr + 5);
  exiger(`${T} : cinq matchs plus tard, l'alignement est toujours valide`, !valide(jouee.toi.roster).length && !valide(jouer.toi.roster).length, '');
  // Il est revenu : plus de retour à proposer.
  const encore = retourDuBlesse({ roster: jouee.toi.roster, injured: jouee.toi.injured, b: memeBlessure(jouee.toi, S.b) });
  exiger(`${T} : une fois remis, le retour ne se repropose pas`, encore === null, '');
}

/* ---------- les chemins, sur une vraie blessure d'avant ---------- */
const trouves = {};
for (const groupe of ['F', 'D']) {
  trouves[groupe] = trouver(groupe);
  exiger(`une blessure longue d'un ${groupe === 'D' ? 'défenseur' : 'attaquant'} habillé de ton club existe`, !!trouves[groupe], trouves[groupe] ? `${trouves[groupe].nom}, ${trouves[groupe].b.games} matchs, graine ${trouves[groupe].graine}` : 'aucune sur 80 graines');
}
for (const groupe of ['F', 'D']) {
  const S = trouves[groupe];
  if (!S) continue;
  for (const nom of Object.keys(CHEMINS)) essai(groupe, nom, S);
}

/* ---------- les cas qui ne bloquent pas ---------- */
{
  const [toi] = ligue();
  const roster = toi.roster, injured = toi.injured;
  const habille = (g, u = 0) => SLOTS.find(s => !s.scratch && s.group === g && s.unit === u);
  const entree = (sl, games = 10) => ({ player: roster[sl.i], games, at: 1, jour: 0, avant: photoAlignement(roster) });
  const un = sl => ({ roster, injured, journal: [entree(sl)], joues: 1 });
  const aile = habille('F');
  exiger('un patineur habillé qu\'un réserviste peut remplacer bloque', blessureOuverte(un(aile)).forcer, aile.role);
  const g = habille('G');
  const xG = blessureOuverte({ roster, injured, journal: [{ ...entree(g), player: roster[g.i] }], joues: 1 });
  exiger('un gardien n\'est jamais forcé : l\'auxiliaire joue', xG === null, 'le gardien blessé ne s\'impose pas');
  const reserveF = SLOTS.find(s => s.scratch && roster[s.i] && fits(roster[s.i], aile));
  const xR = blessureOuverte({ roster, injured, journal: [{ ...entree(aile), player: roster[reserveF.i] }], joues: 1 });
  exiger('un blessé déjà en réserve ne bloque jamais', xR === null, 'rien à combler');
  // Plus de réserviste, plus de rappel : il n'y a rien à combler — on le dit, on ne bloque pas.
  const sans = { ...roster };
  for (const s of SLOTS) if (s.scratch) delete sans[s.i];
  const xS = blessureOuverte({ roster: sans, injured, journal: [entree(aile)], joues: 1 });
  exiger('sans réserviste ni rappel, la case n\'est pas comblable : ça ne bloque pas', xS && !xS.forcer, 'info');
  const xP = blessureOuverte({ roster: sans, injured, journal: [entree(aile)], joues: 1, peutRappeler: () => true });
  exiger('un rappel possible suffit à bloquer', xP && xP.forcer, 'le ballottage offre quelqu\'un');
  exiger(`une blessure de moins de ${BLESSURE_MOMENT} matchs ne bloque pas`, blessureOuverte({ roster, injured, journal: [{ ...entree(aile), games: BLESSURE_MOMENT - 1 }], joues: 1 }) === null, '');
  exiger('une blessure finie ne bloque pas', blessureOuverte({ roster, injured, journal: [entree(aile)], joues: 11 }) === null, '');
}

/*
 * LE RETOUR, SUR DES CENTAINES D'ALIGNEMENTS TIRÉS AU HASARD. On blesse un
 * habillé, on le descend et on monte un réserviste (ou on remanie d'autres
 * cases), puis on le fait revenir : jamais un alignement invalide, jamais plus
 * de deux joueurs déplacés, le blessé retrouve sa case quand elle se rend.
 */
{
  const equipes = ligue();
  let seed = 12345;
  const alea = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed % n; };
  let cas = 0, invalides = 0, trop = 0, nulls = 0, rendus = 0, sansCase = 0;
  const details = [];
  for (let t = 0; t < 600; t++) {
    const toi = equipes[t % equipes.length];
    const roster = { ...toi.roster };
    const habilles = SLOTS.filter(s => !s.scratch && s.group !== 'G' && roster[s.i]);
    const T = habilles[alea(habilles.length)], B = roster[T.i];
    const avant = photoAlignement(roster);
    const reserves = SLOTS.filter(s => s.scratch && roster[s.i] && fits(roster[s.i], T));
    // Le remaniement : le blessé descend (réserviste monté, ou case de réserve libre), puis des échanges sans rapport.
    let cases = photoAlignement(roster);
    const mode = alea(3);
    if (mode < 2 && reserves.length) echanger(cases, T.i, reserves[alea(reserves.length)].i);
    else { const libre = SLOTS.find(s => s.scratch && s.extra && !roster[s.i]); if (!libre) continue; cases[libre.i] = cle(B); const S2 = reserves[0]; if (!S2) continue; cases[T.i] = cle(roster[S2.i]); delete cases[S2.i]; }
    const touches = new Set();
    for (let k = alea(4); k > 0; k--) {
      const hab = SLOTS.filter(s => !s.scratch && s.i !== T.i && cases[s.i] && cle(roster[T.i]) !== cases[s.i]);
      const a = hab[alea(hab.length)], b = hab[alea(hab.length)];
      if (a && b && a.i !== b.i && fits(parCle(roster).get(cases[a.i]), b) && fits(parCle(roster).get(cases[b.i]), a)) { echanger(cases, a.i, b.i); touches.add(a.i); touches.add(b.i); }
    }
    const par = parCle(roster);
    const nouveau = {};
    for (const [i, k] of Object.entries(cases)) nouveau[i] = par.get(k);
    const r = retourDuBlesse({ roster: nouveau, injured: new Map(), b: { player: B, games: 10, at: 1, avant } });
    cas++;
    if (!r) { nulls++; if (details.length < 3) details.push(`${B.n} ${T.role}`); continue; }
    rendus++;
    const suite = {};
    for (const [i, k] of Object.entries(r.cases)) suite[i] = par.get(k);
    if (problemesDAlignement(r.cases, par, { attendu: [...par.keys()] }).length) invalides++;
    const place = c => Object.fromEntries(Object.entries(c).map(([i, k]) => [k, i]));
    const bouge = Object.entries(place(r.cases)).filter(([k, i]) => place(cases)[k] !== i).length;
    if (bouge > 2 || r.mouvements.length > 2) trop++;
    if (r.cases[T.i] !== cle(B)) sansCase++;
  }
  exiger('600 retours au hasard : aucun alignement invalide', invalides === 0, `${rendus} retours rendus, ${invalides} invalides`);
  exiger('600 retours au hasard : jamais plus de deux joueurs déplacés', trop === 0, `${trop} retours trop larges`);
  exiger('600 retours au hasard : le blessé retrouve sa case quand le retour se rend', sansCase === 0, `${sansCase} ailleurs`);
  informer('retours', `${cas} cas, ${rendus} rendus, ${nulls} sans retour à proposer${details.length ? ` (${details.join(', ')})` : ''}`);
  exiger('la plupart des retours se rendent', rendus / Math.max(1, cas) > 0.85, `${rendus} / ${cas}`);
}

/*
 * LES RETOURS QUI NE SE RENDENT PAS À LA LETTRE, un à un.
 */
{
  const [toi] = ligue();
  const roster = { ...toi.roster };
  const T = SLOTS.find(s => !s.scratch && s.group === 'F' && s.unit === 1 && s.role === 'C');
  const R = SLOTS.find(s => s.scratch && s.group === 'F');
  const B = roster[T.i], S = roster[R.i];
  const avant = photoAlignement(roster);
  const b = { player: B, games: 10, at: 1, avant };
  const cases = echanger(photoAlignement(roster), T.i, R.i);
  const mettre = c => Object.fromEntries(Object.entries(c).map(([i, k]) => [i, parCle(roster).get(k)]));

  let r = retourDuBlesse({ roster: mettre(cases), injured: new Map(), b });
  exiger('le cas simple : le blessé et son suppléant échangent leurs cases', r && r.cases[T.i] === cle(B) && r.cases[R.i] === cle(S) && r.mouvements.length === 2, 'B ⇄ S');

  r = retourDuBlesse({ roster, injured: new Map(), b });
  exiger('déjà à sa case : rien à rendre', r === null, '');
  r = retourDuBlesse({ roster: mettre(cases), injured: new Map([[B, 3]]), b });
  exiger('encore blessé : rien à rendre', r === null, '');
  const R2 = SLOTS.find(s => s.scratch && s.group === 'D');
  r = retourDuBlesse({ roster: mettre(cases), injured: new Map(), b: { ...b, avant: { ...avant, [T.i]: undefined, [R2.i]: cle(B) } } });
  exiger('il était en réserve avant sa blessure : rien à lui rendre', r === null, '');
  const parti = { ...mettre(cases) }; delete parti[R.i];
  exiger('parti depuis (relâché, échangé) : rien à rendre', retourDuBlesse({ roster: parti, injured: new Map(), b }) === null, '');
  // La case d'origine du suppléant est prise par un autre : il va là où le blessé était (sa réserve).
  const Y = SLOTS.find(s => !s.scratch && s.group === 'F' && s.unit === 3 && s.role === 'C');
  const casesY = echanger({ ...cases }, Y.i, R.i);          // un troisième joueur occupe la réserve du suppléant… et S est ailleurs
  void casesY;
  // Le suppléant a depuis changé de case (il joue au 4e trio) : le retour le laisse où il est si sa case d'avant n'est pas libre.
  const casesS = { ...cases }; echanger(casesS, T.i, Y.i);   // S va au 4e trio, Y au 2e
  const rS = retourDuBlesse({ roster: mettre(casesS), injured: new Map(), b });
  const pS = rS && problemesDAlignement(rS.cases, parCle(roster), { attendu: Object.values(casesS) });
  exiger('le suppléant parti plus loin : le retour reste valide', !rS || !pS.length, rS ? rS.mouvements.map(m => `${m.p.n} → ${m.vers.role}`).join(' · ') : 'aucun retour');
}

verdict('La blessure se règle et le retour ne bouge que ce qu\'il faut');
