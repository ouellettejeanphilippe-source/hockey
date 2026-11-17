/*
 * LA SAISON, ET TU EN ES LE DG (V30, docs/refonte-v30.md, docs/refonte-v30-2.md ; JP, 16 nov. 2026 : *un EHM, mais avec un
 * côté rogue*). Le cœur du Rogue, PUR et sans DOM : le jeu (js/run-jeu.js) et les robots (scripts/lib/run_robot.mjs) jouent
 * par ces mêmes fonctions, jamais une copie.
 *
 *   LA RUN : un coach (sa pièce de départ sur le banc), deux pièces choisies, puis le repêchage de 23 dans des clubs du bas
 *   de l'échelle. Une ligue de 32 (toi et 31 vrais clubs de toutes les époques), sa cédule de 82 matchs, son classement.
 *   Chaque soir : la feuille, ton gardien, le match. Quatre quarts ; à chacun, les trois objectifs du proprio, un rival, une
 *   élite (dès le deuxième), et trois affiches que tu poses toi-même à la feuille d'un soir ordinaire (JP, 17 nov. 2026) :
 *   les gros matchs se jouent en duel ; gagnés, ils ouvrent trois portes, à la hauteur du club battu. Deux
 *   objectifs manqués coûtent un cœur ; à zéro, la run finit. Au bout, les seize premiers font les vraies séries : quatre
 *   rondes en 4 de 7.
 *
 *   L'ÉTAT : `R`, un objet JSON (la sauvegarde) ; la séance `S` le porte avec ce qui ne se garde pas (les clubs classés de
 *   toutes les saisons, la cédule relue de la graine, ton club bâti, les feuilles). `figer(S)` écrit l'effectif dans `R` ;
 *   `ouvrirSeance` le relit, sans rejouer un seul match.
 *
 *   LES PHASES (`R.phase`) : pieces → repechage → quart → bureau ⇄ (ballottage) feuille → resultat → (piece) (portes)
 *   → bureau … → bilan → marche → quart … → series ⇄ feuille → resultat → fin ; du bureau : histoire, portes (une pochette).
 *
 * Chaque tirage est un hachage de la graine et de son moment (`hache`) : rien ne dépend de l'ordre des appels. Les matchs
 * des autres clubs ont leurs propres dés (la graine, le jour, l'affiche) : ce que tu fais de ton club ne les déplace pas.
 */
import {
  SLOTS, CAP, SONNE, SONNES_ELITE, ENERGIE_REF, ENERGIE_RECUP_JOUR, createTeam, autoRoster, trioAuMieux, registerHiddenRatings, getHiddenRatings, getPersonKey, getPlayerKey, teamStrength,
  avecHasardIsole, feuilleVierge, playGame, simulerGrosMatch, activeLineup, depenserEnergie, recupererEnergie, energieDe, fits, accordsDeLigne, tirsTotal, effetsDesJoueurs, remettreAZero,
  ceduleDe, noterDepart } from './sim.js';
import { leurJeuDuDuel, appliquerChoix, deDuChoix } from './greffes.js';
import { HISTOIRES, tirer } from './histoires.js';
import { faitsDe } from './faits.js';
import { PIECES, PIECE_DU_COACH, CASES_DU_BANC, piecesOffertes, poserLaPiece, bancDuMatch, persoAdverse, apportDe, compteDe, marcheDe, seuilSuivant } from './pieces.js';
import { JETONS, habillerLaLigue, chiffresDuSoirDe, ecussonsDesSeries, exigencesDe } from './rogue.js';
import { REGLES_DU_COACH } from './coachs.js';
import { MEDAILLES_ACTE, PRIX_PIECE, jeuDuRival, dominanteDe, recompenseDeLElite, perteDeLElite } from './actes.js';
import { chanceDUnSoir } from './pronostic.js';
import { seasonGames } from './ratings.js';
import { groupeDuJoueur as groupeDe } from './niveaux.js';
import { EDITIONS } from './rarete.js';
import { hache } from './util.js';

/* ---------- les réglages (docs/refonte-v30-2.md § 8) ---------- */
export const RUN = {
  COEURS: 2,                      // JP, 7 nov.
  PORTES: 3,
  PIECES_DU_DEPART: 2,            // les pièces de banc choisies avant le repêchage, après celle du coach
  RACHAT: 0.5,                    // la part du salaire de celui qui sort qui se libère (JP, 10 nov. ; pas retranchée le 16 nov.)
  ESPACE: 4_000_000,              // l'espace gardé sous le plafond au repêchage (JP, 16 nov.)
  REPECHAGE: { BANDE: [0.05, 0.4], PLANCHER: 800_000, RELANCES: 5 },   // des clubs du bas de l'échelle, en rang centile
  LIGUE: { CLUBS: 31, MATCHS: 82, PLACES: 16, BANDE: [0.25, 0.95], USURE_DOS_A_DOS: 3 },
  QUARTS: [21, 20, 21, 20],       // les matchs de chaque quart
  ETAPES: [1, 3, 6, 12, 12],      // les étapes d'édition des adversaires, par quart puis en séries : le dernier quart prépare aux séries
  PORTES_AUTOUR: [-0.3, 0.1],     // les vestiaires des portes : autour de la hauteur du club battu, en rang centile (JP, 17 nov.)
  PORTES_PLANCHER: 0.1,
  PORTES_HAUTES: [0.8, 1],        // après un rival battu
  ELITE_RANGS: 4,                 // l'élite du quart : un des premiers du classement
  FIN_DU_QUART: 5,                // le rival est un adversaire des derniers matchs du quart
  AFFICHES: 3,                    // par quart : tu les poses toi-même, à la feuille d'un soir ordinaire (JP, 17 nov.)
  OBJECTIFS: { TAUX: [1.38, 0.84], MARGE: 1, PLACE_MARGE: 3, PLACE_BORNES: [4, 24], HOCKEY_SOIRS: 7 },
  PASSER: 6,                      // les jetons d'une porte passée
  RELANCE: 8,                     // une relance des portes payée ; le double à chaque relance du même soir (JP, 14 nov.)
  RELANCES_PAYEES: 3,
  JETONS_DU_MATCH: [2, 4],        // une victoire ordinaire, du bas au haut du classement
  JETONS_PERDU: [1, 2],           // une défaite, une défaite en prolongation
  JETONS_DE_L_AFFICHE: [12, 20],
  JETONS_DU_RIVAL: 24,
  PRIME_DU_QUART: 13,             // la règle du coach, au plus par quart
  POCHETTES: { 'j:bronze': 14, 'j:epoque': 26 },   // au bureau, une de chaque par quart
  MONTER: 20,                     // une carte montée au marché du quart (JP, 14 nov.)
  JETONS_PAR_MEDAILLE: 10,
  MEDAILLES_QUART_JOUE: 5,
  REPOS_HISTOIRE: 5,              // les matchs entre deux histoires du bureau
  SERIE: 4,                       // les victoires d'une série ; quatre rondes
};
const RONDES = 4;
/* Les matchs de chez soi du mieux classé, dans une série (de 0) : 1, 2, 5 et 7. */
const CHEZ_LE_MIEUX_CLASSE = [0, 1, 4, 6];
/* Le tableau des séries : les têtes de série de chaque duel de la première ronde, dans l'ordre du tableau. */
const TABLEAU = [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
/* La composition d'un club de 23 : au moins, au plus, par groupe. */
const COMPOSITION = { F: [13, 14], D: [7, 8], G: [2, 3] }, EFFECTIF = 23;

/* ---------- les petits outils ---------- */
const v = p => getHiddenRatings(p).v;
/*
 * UN JOUEUR QUI ENTRE DANS TON EFFECTIF est une copie, remise à zéro (js/sim.js `remettreAZero`) : l'original, celui de sa
 * saison, joue dans la ligue ou dans une run d'avant de la même session (11 nov. 2026, docs/decisions.md).
 */
const copie = p => { const c = { ...p }; remettreAZero(c); delete c._carte; registerHiddenRatings(c); return c; };
const force = t => { const f = teamStrength(t); return f.att + f.def + f.g; };
const cleDuClub = c => `${c.s}:${c.t}`;
const pigeDans = (liste, ...mots) => liste[Math.min(liste.length - 1, Math.floor(hache(...mots) * liste.length))];
const CASES = SLOTS.filter(s => !s.extra);
const HABILLES = CASES.filter(s => !s.scratch);
const PRETS = SLOTS.filter(s => s.extra);
const borne = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- le salaire de la run (11 nov. 2026, docs/decisions.md) ---------- */
/*
 * Le salaire du jeu (`$`) n'est pas à la même échelle d'une époque à l'autre. Le salaire d'une run est donc le RANG du
 * salaire du joueur parmi les réguliers de sa saison, lu sur l'échelle d'aujourd'hui (`ECHELLE`) : Lafleur 1976-77 coûte
 * ce que coûte aujourd'hui le mieux payé de la ligue.
 */
const ECHELLE = [[0, 0.775], [0.05, 0.875], [0.1, 0.875], [0.15, 0.925], [0.2, 0.975], [0.25, 1.025], [0.3, 1.075], [0.35, 1.2], [0.4, 1.575], [0.45, 2.05], [0.5, 2.6],
  [0.55, 3.15], [0.6, 3.625], [0.65, 4.35], [0.7, 4.975], [0.75, 5.7], [0.8, 6.25], [0.85, 6.95], [0.9, 8.1], [0.95, 9.675], [0.98, 11], [1, 14.65]];
const REGULIERS = new Map();   // saison → les salaires de ses réguliers, triés
function rangDeSalaire(donnees, p) {
  if (!REGULIERS.has(p.s)) REGULIERS.set(p.s, donnees.shard(p.s).players.filter(x => (x.gp || 0) >= (x.p === 'G' ? 10 : 30)).map(x => x.$ || 0).sort((a, b) => a - b));
  const t = REGULIERS.get(p.s), x = p.$ || 0;
  let bas = 0, haut = t.length;
  while (bas < haut) { const m = (bas + haut) >> 1; if (t[m] < x) bas = m + 1; else haut = m; }
  let fin = bas;
  while (fin < t.length && t[fin] === x) fin++;
  return t.length > 1 ? Math.min(1, ((bas + Math.max(bas, fin - 1)) / 2) / (t.length - 1)) : 0.5;
}
export function prixDe(S, p) {
  if (!p) return 0;
  const k = getPlayerKey(p);
  if (!S.prix.has(k)) {
    const r = rangDeSalaire(S.donnees, p), i = Math.max(1, ECHELLE.findIndex(([q]) => q >= r));
    const [q0, m0] = ECHELLE[i - 1], [q1, m1] = ECHELLE[i];
    S.prix.set(k, Math.round((m0 + (m1 - m0) * ((r - q0) / ((q1 - q0) || 1))) * 40) * 25_000);
  }
  return S.prix.get(k);
}
/* Tes vingt-trois, sans les prêts du ballottage. */
export const effectifDe = S => CASES.map(s => S.roster[s.i]).filter(Boolean);
export const masseDe = S => effectifDe(S).reduce((a, p) => a + prixDe(S, p), 0) + (S.R.mort || 0);
export const espaceDe = S => S.R.plafond - masseDe(S);

/* ---------- le monde d'une run : toutes les années ensemble (JP, 11 nov. 2026) ---------- */
/* Une saison finie : son joueur le plus assidu (jamais échangé) a joué 90 % du calendrier. La saison en cours ne donne ni club ni porte. */
const saisonFinie = (s, joueurs) => joueurs.reduce((m, p) => (p.x ? m : Math.max(m, p.gp || 0)), 0) >= 0.9 * seasonGames(s);
/*
 * LES CLUBS DU MONDE, classés par leur force (le moins fort d'abord) : chaque vrai club de chaque saison finie, ses douze
 * meilleurs avants, ses six meilleurs défenseurs, ses deux gardiens les plus utilisés. `rang` : son rang centile.
 * `donnees.shard(s)` rend { players, byTeam }, déjà chargé ; `donnees.forces` (facultatif) : les forces d'une visite d'avant
 * (`forcesDuMonde`), pour ne pas rebâtir 1 400 clubs.
 */
const MONDES = new WeakMap();
const batir = (s, t, pool) => { const team = createTeam(t, t, autoRoster(pool), { season: s }); team.courbe = true; team.luck = 0; return team; };
function classerLesClubs(donnees) {
  let monde = MONDES.get(donnees.shard);
  if (!monde || monde.n !== donnees.saisons.length) {
    const tous = [];
    for (const s of donnees.saisons) {
      const sh = donnees.shard(s);
      if (!sh || !saisonFinie(s, sh.players)) continue;
      for (const [t, ps] of Object.entries(sh.byTeam)) {
        const ok = ps.filter(p => (p.gp || 0) >= 10);
        const F = ok.filter(p => groupeDe(p) === 'F').sort((a, b) => v(b) - v(a)).slice(0, 12);
        const D = ok.filter(p => groupeDe(p) === 'D').sort((a, b) => v(b) - v(a)).slice(0, 6);
        const G = ok.filter(p => groupeDe(p) === 'G').sort((a, b) => (b.gp || 0) - (a.gp || 0)).slice(0, 2);
        if (F.length < 12 || D.length < 6 || G.length < 2) continue;
        const pool = [...F, ...D, ...G];
        const connue = donnees.forces ? donnees.forces[`${s}:${t}`] : null;
        tous.push({ s, t, pool, force: Number.isFinite(connue) ? connue : force(batir(s, t, pool)) });
      }
    }
    tous.sort((a, b) => a.force - b.force || (cleDuClub(a) < cleDuClub(b) ? -1 : 1));
    tous.forEach((c, i) => { c.rang = i / Math.max(1, tous.length - 1); });
    monde = { n: donnees.saisons.length, tous };
    MONDES.set(donnees.shard, monde);
  }
  // Chaque séance a ses clubs à elle : un club ne se bâtit qu'à son premier match.
  return monde.tous.map(c => { let team = null; return { ...c, get team() { return team || (team = batir(c.s, c.t, c.pool)); } }; });
}
export const forcesDuMonde = S => Object.fromEntries(S.clubs.map(c => [cleDuClub(c), c.force]));
const dansLaBande = (clubs, [a, b]) => clubs.filter(c => c.rang >= a && c.rang <= b);
const clubDe = (S, x) => (x ? S.clubs.find(c => c.s === x.s && c.t === x.t) || null : null);
/*
 * LES RÈGLES QU'UNE RUN PORTE : celles de `RUN`, durcies par son cran d'exigence (js/rogue.js `exigencesDe`) — les points
 * que le proprio demande, les étapes d'édition des adversaires, le multiple de ses médailles. Écrites à sa création.
 */
export const reglesDe = R => (R && R.regles) || { exigence: 0, cible: 0, etapes: RUN.ETAPES, prime: 1 };

/* ---------- la séance : créer, garder, rouvrir ---------- */
/* La version d'une run gardée : 4, la saison et sa ligue (V30) ; une run d'avant ne se relit pas, elle s'arrête à l'ouverture. */
export const VERSION_DE_LA_RUN = 4;
const seanceVide = (donnees, R) => ({ R, donnees, clubs: classerLesClubs(donnees), roster: {}, prix: new Map(), blesses: new Map(), journal: [], effets: [], absents: new Map(), toi: null, ligue: [], cedule: [], jours: [] });
/*
 * CRÉER LA RUN : `coach` est une carte de coach ({ id, n, saison, tag, cle, rang, maitrise }, js/coachs-reels.js) ou une
 * simple philosophie ({ cle }) pour un robot. Rend la séance, à ses deux pièces de banc : avant le repêchage, pour savoir
 * quoi repêcher.
 */
export function creerLaRun(donnees, { graine, coach, jetons = JETONS.depart, numero = 1, exigence = 0 }) {
  const E = exigencesDe(exigence);
  const S = seanceVide(donnees, {
    v: VERSION_DE_LA_RUN, graine: String(graine), numero,
    regles: { exigence: E.n, cible: E.cible, etapes: RUN.ETAPES.map(e => e + E.etapes), prime: E.medailles },
    coach: { maitrise: 1, ...coach }, banc: [PIECE_DU_COACH[coach.cle]],
    jetons, coeurs: RUN.COEURS, plafond: CAP, mort: 0,
    joueurs: [], vus: [], anciens: [], prets: [], stats: {},
    phase: 'pieces', pieces: 0, rep: null, ligue: null, quart: null, quarts: [], soir: null, apres: null, suite: [], portes: null, marche: null, ballottage: null,
    relances: 0, sonnes: 0, matchs: [], series: null, histoires: [], hRepos: -RUN.REPOS_HISTOIRE, achats: 0, fin: null,
  });
  rebatir(S);
  S.R.apres = { offertes: piecesOffertes(S.toi.perso, S.R.graine, 'depart:0') };
  figer(S);
  return S;
}
/* Rouvrir une run gardée : les mêmes clubs, la même cédule, ton effectif relu de ses clés, ses jambes, ses éditions, ses blessés. */
export function ouvrirSeance(donnees, R) {
  const S = seanceVide(donnees, R);
  const parCle = new Map();
  const trouver = k => {
    const s = k.slice(0, k.indexOf('_'));
    if (!parCle.has(s)) parCle.set(s, new Map(((donnees.shard(s) || {}).players || []).map(p => [getPlayerKey(p), p])));
    return parCle.get(s).get(k) || null;
  };
  for (const x of R.joueurs) {
    const p0 = trouver(x.k);
    if (!p0) continue;
    const p = copie(p0);
    p.energie = x.e ?? 100;
    if (x.r) p._reserve = x.r;
    if (x.su) p._suite = x.su;
    if (x.ed) p._carte = { rar: x.ed };
    S.roster[x.i] = p;
    if (x.bl > 0) S.blesses.set(p, x.bl);
  }
  // Un joueur relu : le tien d'abord (le même objet que ton alignement), sinon celui de sa saison.
  const miens = new Map(Object.values(S.roster).map(p => [getPlayerKey(p), p])), relu = k => (k ? miens.get(k) || trouver(k) : null);
  if (R.ligue) poserLaLigue(S);
  S.journal = (R.journal || []).map(e => relire(e, relu, k => (k ? trouver(k) : null), c => clubDe(S, c)));
  S.effets = (R.effets || []).map(e => ({ ...e, joueur: relu(e.joueur) })).filter(e => e.joueur);
  for (const [k, j] of R.absents || []) { const p = relu(k); if (p) S.absents.set(p, j); }
  S.blessures = (R.blessures || []).map(b => ({ ...b, player: relu(b.k), run: true })).filter(b => b.player);
  // Une pochette ouverte, pas encore réglée : ses joueurs se relisent de leur saison.
  if (R.portes && R.portes.pochette) S.pochette = (R.portes.joueurs || []).map(trouver).filter(Boolean);
  rebatir(S);
  return S;
}
/* Écrire l'effectif dans `R` : la clé de chacun, sa case, ses jambes, son édition, ses matchs à l'infirmerie ; un gardien, ses départs de suite. */
export function figer(S) {
  S.R.joueurs = SLOTS.filter(s => S.roster[s.i]).map(s => {
    const p = S.roster[s.i], bl = S.toi.injured.get(p) || 0, ed = p._carte && p._carte.rar;
    return { k: getPlayerKey(p), i: s.i, e: energieDe(p), ...(p._reserve ? { r: p._reserve } : {}), ...(p._suite ? { su: p._suite } : {}), ...(ed ? { ed } : {}), ...(bl ? { bl } : {}) };
  });
  S.R.effets = (S.toi.effetsCibles || []).filter(e => e.joueur).map(e => ({ ...e, joueur: getPlayerKey(e.joueur) }));
  S.R.absents = [...(S.toi.absents || [])].map(([p, j]) => [getPlayerKey(p), j]);
  S.R.journal = S.journal.map((e, i) => resumer(e, i === S.journal.length - 1));
  S.R.blessures = (S.toi.injuriesLog || []).filter(b => b.player).map(b => ({ k: getPlayerKey(b.player), games: b.games, genre: b.genre || null, at: b.at, jour: b.jour }));
  return S.R;
}
/*
 * LE JOURNAL GARDÉ : ce que les faits d'une histoire lisent d'une feuille (js/faits.js) — les buts, les punitions, les
 * bagarres, les pièces jouées, qui était habillé —, ses joueurs en clés, et ton côté de la feuille. Des lancers, seuls ceux
 * du dernier match se gardent (qui gardait). Les `GARDES` derniers matchs : les faits ne lisent pas plus loin qu'une
 * séquence, et 110 feuilles pèseraient sur la sauvegarde.
 */
const GARDES = 30;
function resumer(e, dernier) {
  const f = e.feuille, k = p => (p ? getPlayerKey(p) : null);
  return { jour: e.jour, n: e.n, cote: e.cote, win: e.win, gf: e.gf, ga: e.ga, adv: e.adv ? { s: e.adv.season, t: e.adv.tag } : null, gardien: k(e.gardien),
    f: { buts: (f.buts || []).map(b => ({ cote: b.cote, instant: b.instant, marqueur: k(b.marqueur), passeurs: (b.passeurs || []).map(k), gardien: k(b.gardien), ...(b.fusillade ? { fusillade: true } : {}) })),
      punitions: (f.punitions || []).map(x => ({ cote: x.cote, instant: x.instant, joueur: k(x.joueur) })),
      physique: (f.physique || []).filter(x => x.type === 'bagarre').map(x => ({ type: x.type, cote: x.cote, minutes: x.minutes, joueur: k(x.joueur), cible: k(x.cible) })),
      pieces: f.pieces || [], alignes: { A: ((f.alignes || {}).A || []).map(k), B: ((f.alignes || {}).B || []).map(k) }, gardienA: k(f.gardienA), gardienB: k(f.gardienB),
      ...(dernier ? { lancers: (f.lancers || []).map(l => (Array.isArray(l) ? l : [l.cote, k(l.gardien)])) } : {}) } };
}
function relire(e, mien, autre, club) {
  const f = e.f, c = e.adv ? club(e.adv) : null;
  // Chaque joueur se relit de SON côté de la feuille : un joueur signé depuis chez le club affronté n'était pas le tien ce soir-là.
  const de = cote => (cote === e.cote ? mien : autre), contre = cote => (cote === e.cote ? autre : mien);
  return { jour: e.jour, n: e.n, cote: e.cote, win: e.win, gf: e.gf, ga: e.ga, adv: c ? c.team : null, gardien: mien(e.gardien),
    feuille: { buts: f.buts.map(b => ({ ...b, marqueur: de(b.cote)(b.marqueur), passeurs: b.passeurs.map(de(b.cote)), gardien: contre(b.cote)(b.gardien) })),
      punitions: f.punitions.map(x => ({ ...x, joueur: de(x.cote)(x.joueur) })), physique: f.physique.map(x => ({ ...x, joueur: de(x.cote)(x.joueur), cible: contre(x.cote)(x.cible) })),
      pieces: f.pieces, alignes: { A: f.alignes.A.map(de('A')), B: f.alignes.B.map(de('B')) }, gardienA: de('A')(f.gardienA), gardienB: de('B')(f.gardienB),
      lancers: (f.lancers || []).map(([cote, g]) => ({ cote, gardien: contre(cote)(g) })) } };
}
/* Ton club, rebâti de l'effectif : la même infirmerie, le même journal, ton coach et son banc, sa fiche au classement. */
function rebatir(S) {
  const R = S.R, avant = S.toi;
  const toi = createTeam('Ton club', 'YOU', S.roster, { isPlayer: true });
  toi.courbe = true;
  toi.luck = 0;
  toi.perso = { cle: R.coach.cle, banc: R.banc.slice(), maitrise: R.coach.maitrise || 1, ...(R.coach.n ? { chef: R.coach } : {}) };
  toi.comptes = () => signesDe(S);
  toi.injured = avant ? avant.injured : S.blesses;
  toi.journal = S.journal;
  // Ce qu'une histoire a posé (js/greffes.js `appliquerChoix`) suit le club : ses effets sur un joueur, ses absents, ses paris.
  for (const k of ['effetsCibles', 'paris', 'suivis', 'retours', 'injuriesLog']) toi[k] = (avant && avant[k]) || (k === 'effetsCibles' ? S.effets : k === 'injuriesLog' ? S.blessures || [] : []);
  toi.absents = (avant && avant.absents) || S.absents;
  toi._filetMatch = (avant && avant._filetMatch) || 'partant';
  // Le club compte ses matchs comme la run : les effets d'une histoire, le registre des blessures, les sonnés s'y datent.
  toi.jourCourant = toi.games = R.matchs.length;
  toi.effets = R.sonnes > 0 ? [{ debut: 0, fin: R.matchs.length + R.sonnes, source: 'miniboss', nom: SONNE.nom, ico: SONNE.ico, finition: SONNE.finition }] : [];
  S.toi = toi;
  if (S.equipes) { S.equipes[0] = toi; poserLesFiches(S); }
  return toi;
}

/* ---------- le banc ---------- */
/*
 * TES SIGNÉS (JP, 14 nov. 2026 : « seulement tes signés ») : les vingt-trois de ton effectif, repêchés ou signés par une
 * porte ou une pochette, où qu'ils soient (habillés, en civil, blessés). Un prêt du ballottage n'en est pas.
 */
export const signesDe = effectifDe;
/* TON BANC, COMPTÉ : chaque pièce, son compte chez tes signés, sa marche, son multiplicateur (js/pieces.js `bancDuMatch`). `joueurs` : un autre effectif (l'échange qu'on regarde). */
export const tonBanc = (S, joueurs = signesDe(S)) => bancDuMatch(S.toi.perso, joueurs);
/* Une pièce gagnée ou choisie entre sur le banc ; plein, `sort` part. */
export function prendreLaPiece(S, cle, sort = null) {
  const R = S.R;
  if (!PIECES[cle] || (R.banc.length >= CASES_DU_BANC && !R.banc.includes(sort))) return false;
  R.banc = poserLaPiece(R.banc, cle, sort);
  rebatir(S); figer(S);
  return true;
}
/* La pièce offerte est prise ou passée. Au départ : la deuxième s'offre, puis le repêchage commence. */
export function pieceReglee(S) {
  const R = S.R;
  if (R.phase !== 'pieces') { R.apres = { ...R.apres, offertes: [] }; return continuer(S); }
  R.pieces++;
  if (R.pieces < RUN.PIECES_DU_DEPART) R.apres = { offertes: piecesOffertes(S.toi.perso, R.graine, `depart:${R.pieces}`) };
  else { R.apres = null; R.phase = 'repechage'; R.rep = { tour: 0, relances: RUN.REPECHAGE.RELANCES, k: 0 }; tirerLeVestiaire(S); }
  figer(S);
  return R.phase;
}

/* ---------- le repêchage de 23 (docs/refonte-v30-2.md § 3.1) ---------- */
const compositionDe = S => { const n = { F: 0, D: 0, G: 0 }; for (const p of Object.values(S.roster)) if (p) n[groupeDe(p)]++; return n; };
/* Un joueur de ce groupe peut-il encore entrer ? Son groupe a de la place, et les tours qui restent suffisent aux minimums des autres. */
function groupeOuvert(S, g) {
  const n = compositionDe(S), total = n.F + n.D + n.G;
  if (n[g] >= COMPOSITION[g][1]) return false;
  n[g]++;
  return Object.keys(COMPOSITION).reduce((a, k) => a + Math.max(0, COMPOSITION[k][0] - n[k]), 0) <= EFFECTIF - total - 1;
}
/* Ce qu'un tour peut dépenser : ce qui reste sous le plafond moins l'espace gardé, moins le plancher de chaque case encore à remplir. */
export function budgetDuTour(S) {
  const R = S.R, reste = R.plafond - RUN.ESPACE - masseDe(S);
  return reste - RUN.REPECHAGE.PLANCHER * (EFFECTIF - R.rep.tour - 1);
}
const offrable = (S, p, vus) => !vus.has(getPersonKey(p)) && groupeOuvert(S, groupeDe(p));
/* La roulette : un vestiaire de la bande où au moins un joueur s'offre et tient ; sinon, le secours (les moins chers de la bande). */
function tirerLeVestiaire(S) {
  const R = S.R, rep = R.rep, bande = dansLaBande(S.clubs, RUN.REPECHAGE.BANDE), vus = new Set(R.vus), max = budgetDuTour(S);
  rep.club = null; rep.secours = false;
  for (let essai = 0; essai < 40 && !rep.club; essai++) {
    const c = pigeDans(bande, R.graine, 'roulette', rep.tour, rep.k, essai);
    if (c.pool.some(p => offrable(S, p, vus) && prixDe(S, p) <= max)) rep.club = { s: c.s, t: c.t };
  }
  if (!rep.club) rep.secours = true;
}
/*
 * LE VESTIAIRE DU TOUR : ses joueurs qui peuvent encore entrer (jamais deux fois la même personne, un groupe plein ne
 * s'offre plus), les plus forts d'abord ; `tient` dit qui passe sous le budget du tour. Le secours : les douze moins chers
 * de la bande qui peuvent entrer — le repêchage ne se coince jamais.
 */
export function vestiaireDuRepechage(S) {
  const R = S.R, rep = R.rep, vus = new Set(R.vus), max = budgetDuTour(S);
  if (rep.secours) {
    const tous = dansLaBande(S.clubs, RUN.REPECHAGE.BANDE).flatMap(c => c.pool).filter(p => offrable(S, p, vus));
    return tous.sort((a, b) => prixDe(S, a) - prixDe(S, b) || v(b) - v(a) || (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1)).slice(0, 12).map(p => ({ p, tient: true }));
  }
  return clubDe(S, rep.club).pool.filter(p => offrable(S, p, vus)).sort((a, b) => v(b) - v(a)).map(p => ({ p, tient: prixDe(S, p) <= max }));
}
/* Repêcher : il entre dans la première case libre qui lui convient ; au vingt-troisième, l'alignement se range et la saison s'ouvre. */
export function repecher(S, p) {
  const R = S.R, x = vestiaireDuRepechage(S).find(y => y.p === p);
  if (R.phase !== 'repechage' || !x || !x.tient) return false;
  const libre = CASES.find(s => !S.roster[s.i] && fits(p, s)) || CASES.find(s => !S.roster[s.i]);
  S.roster[libre.i] = copie(p);
  R.vus.push(getPersonKey(p));
  R.rep.tour++; R.rep.k = 0;
  if (R.rep.tour < EFFECTIF) { rebatir(S); tirerLeVestiaire(S); figer(S); return true; }
  const range = trioAuMieux(effectifDe(S));
  for (const s of CASES) S.roster[s.i] = range[s.i] || null;
  R.rep = null;
  rebatir(S);
  ouvrirLaLigue(S);
  ouvrirLeQuart(S, 0);
  figer(S);
  return true;
}
/* Un autre vestiaire, le même tour : `RELANCES` pour tout le repêchage. */
export function relancerLaRoulette(S) {
  const rep = S.R.rep;
  if (!rep || rep.relances <= 0 || rep.secours) return false;
  rep.relances--; rep.k++;
  tirerLeVestiaire(S);
  figer(S);
  return true;
}

/* ---------- la ligue (docs/refonte-v30-2.md § 3.2) ---------- */
/* Trente et un clubs, un par franchise, tirés de la bande de la ligue ; la cédule, la même que celle du 82-0 ; les fiches à zéro. */
function ouvrirLaLigue(S) {
  const R = S.R, bande = dansLaBande(S.clubs, RUN.LIGUE.BANDE), pris = new Set(), clubs = [];
  for (let k = 0; clubs.length < RUN.LIGUE.CLUBS && k < 4000; k++) {
    const c = pigeDans(bande, R.graine, 'ligue', k);
    if (pris.has(c.t)) continue;
    pris.add(c.t); clubs.push({ s: c.s, t: c.t });
  }
  R.ligue = { clubs, fiches: Array.from({ length: clubs.length + 1 }, () => [0, 0, 0, 0, 0]), jour: 0, pts: {} };
  poserLaLigue(S);
}
/*
 * CE QUI NE SE GARDE PAS, relu de la graine : les clubs (`S.ligue`), les équipes dans l'ordre des fiches (`S.equipes`, toi
 * d'abord), la cédule en indices (`S.cedule[jour]` : [{ a, b }], `a` chez lui), les jours de chacun (`S.jours[i]`).
 */
function poserLaLigue(S) {
  const R = S.R;
  S.ligue = R.ligue.clubs.map(x => clubDe(S, x));
  S.equipes = [S.toi, ...S.ligue.map(c => c.team)];
  const idx = S.equipes.map((_, i) => ({ i }));
  S.cedule = ceduleDe(idx, RUN.LIGUE.MATCHS, `run:${R.graine}`).map(jour => jour.map(m => ({ a: m.A.i, b: m.B.i })));
  S.jours = idx.map(() => []);
  S.cedule.forEach((jour, d) => { for (const m of jour) { S.jours[m.a].push(d); S.jours[m.b].push(d); } });
  S.styles = new Map();
  poserLesFiches(S);
}
/* La fiche de chacun sur son équipe (W, L, OTL, GF, GA, PTS) : ce que les faits d'une histoire et le jeu d'un club lisent. */
function poserLesFiches(S) {
  S.R.ligue.fiches.forEach(([w, l, o, gf, ga], i) => { if (S.equipes[i]) Object.assign(S.equipes[i], { W: w, L: l, OTL: o, GF: gf, GA: ga, PTS: 2 * w + o }); });
}
const pointsDe = f => 2 * f[0] + f[2];
/* LE CLASSEMENT : les indices des clubs (0, c'est toi), le premier d'abord — les points, les victoires, l'écart de buts, les buts. */
export function classement(S) {
  const F = S.R.ligue.fiches;
  return F.map((_, i) => i).sort((a, b) => pointsDe(F[b]) - pointsDe(F[a]) || F[b][0] - F[a][0] || (F[b][3] - F[b][4]) - (F[a][3] - F[a][4]) || F[b][3] - F[a][3] || a - b);
}
export const rangDe = (S, i = 0) => classement(S).indexOf(i) + 1;
/* Le club d'un indice ({ s, t, pool, force, team }) ; 0, c'est toi : null. */
export const clubNo = (S, i) => (i > 0 ? S.ligue[i - 1] : null);
/* Ton rang de force parmi les trente-deux, sans les éditions ni le banc (1, le plus fort) : ce que le proprio lit. */
function rangDeForce(S) {
  const f = forceDe(S);
  return 1 + S.ligue.filter(c => c.force > f).length;
}
/* La hauteur d'un adversaire, de 0 (le dernier) à 1 (le premier) : au classement dès que la ligue a joué, à la force avant. */
function hauteurDe(S, i) {
  const n = S.R.ligue.fiches.length;
  if (S.R.ligue.jour >= 20) return 1 - (rangDe(S, i) - 1) / (n - 1);
  const c = clubNo(S, i);
  return S.ligue.filter(x => x.force <= c.force).length / S.ligue.length;
}
const jouaitHier = (S, i, jour) => S.jours[i].includes(jour - 1);
/*
 * UN CLUB DE LA LIGUE ARRIVE SAIN, À JAMBES ORDINAIRES, à chaque match (11 nov. 2026 : une run ne dépend pas des autres ;
 * ses joueurs sont ceux de leur saison, partagés par toutes les runs d'une session) : tout se remet à zéro, puis ses
 * habillés prennent les jambes d'un matin ordinaire (`ENERGIE_REF`), moins `USURE_DOS_A_DOS` s'il a joué la veille. Son
 * gardien tourne au nombre de ses matchs joués, comme le moteur le fait.
 */
function preparer(S, i, jour) {
  const t = S.equipes[i], e = ENERGIE_REF - (jouaitHier(S, i, jour) ? RUN.LIGUE.USURE_DOS_A_DOS : 0), F = S.R.ligue.fiches[i];
  for (const s of SLOTS) { const p = t.roster[s.i]; if (p) { remettreAZero(p); p.energie = e; } }
  if (t.injured) t.injured.clear();
  t.games = F[0] + F[1] + F[2];
  t._jours = jouaitHier(S, i, jour) ? [0, 1] : [1];
  return t;
}
/* Le pointage d'une feuille, sans le but des tirs de barrage (personne ne l'a marqué). */
const butsDe = (f, cote) => (f.buts || []).filter(b => b.cote === cote && !b.fusillade).length;
/* Compter un match au classement, et ses pointeurs chez les meneurs de la ligue. `a` jouait chez lui (le côté A de la feuille). */
function compterAuClassement(S, a, b, r, f) {
  const F = S.R.ligue.fiches, gagneA = r.gfA > r.gfB;
  const [w, l] = gagneA ? [a, b] : [b, a];
  F[w][0]++; if (r.ot) F[l][2]++; else F[l][1]++;
  const ga = butsDe(f, 'A'), gb = butsDe(f, 'B');
  F[a][3] += ga; F[a][4] += gb; F[b][3] += gb; F[b][4] += ga;
  const P = S.R.ligue.pts;
  for (const x of f.buts || []) {
    if (x.fusillade) continue;
    for (const [p, k] of [[x.marqueur, 0], ...(x.passeurs || []).map(q => [q, 1])]) if (p) { const c = P[getPlayerKey(p)] = P[getPlayerKey(p)] || [0, 0]; c[k]++; }
  }
}
/*
 * LES AUTRES MATCHS DE LA LIGUE, jusqu'au jour `fin` compris : chacun sur ses propres dés (la graine, le jour, l'affiche).
 * Rien n'est joué d'avance : ils se jouent quand ton soir se conclut. Rend les pointages de ce jour-là.
 */
function jouerLaLigueJusqua(S, fin) {
  const R = S.R, L = R.ligue, soir = [];
  for (let d = L.jour; d <= fin && d < S.cedule.length; d++) {
    for (const m of S.cedule[d]) {
      if (m.a === 0 || m.b === 0) continue;
      const A = preparer(S, m.a, d), B = preparer(S, m.b, d), f = feuilleVierge();
      const r = avecHasardIsole(`ligue:${R.graine}:${d}:${m.a}-${m.b}`, () => playGame(A, B, 1, false, false, f, 0, true));
      compterAuClassement(S, m.a, m.b, r, f);
      if (d === fin) soir.push({ a: m.a, b: m.b, gfA: r.gfA, gfB: r.gfB, ot: !!r.ot });
    }
  }
  L.jour = Math.max(L.jour, Math.min(fin + 1, S.cedule.length));
  poserLesFiches(S);
  return soir;
}
/* Les meneurs de la ligue : les `n` premiers pointeurs, tes joueurs compris ([{ k, g, a, i }], `i` l'indice du club). */
export function meneursDe(S, n = 10) {
  const P = S.R.ligue.pts, club = new Map();
  S.ligue.forEach((c, i) => { for (const p of c.pool) club.set(getPlayerKey(p), i + 1); });
  for (const p of effectifDe(S)) club.set(getPlayerKey(p), 0);
  return Object.entries(P).filter(([k]) => club.has(k)).map(([k, [g, a]]) => ({ k, g, a, i: club.get(k) })).sort((x, y) => (y.g + y.a) - (x.g + x.a) || y.g - x.g || (x.k < y.k ? -1 : 1)).slice(0, n);
}

/* ---------- le quart : les objectifs du proprio, le rival, les gros matchs (§ 3.4) ---------- */
const debutDuQuart = n => RUN.QUARTS.slice(0, n).reduce((a, x) => a + x, 0);
/* Ton k-ième match de la saison : son jour, l'adversaire (son indice), le lieu, les dos-à-dos. */
export function matchNo(S, k) {
  const jour = S.jours[0][k], m = S.cedule[jour].find(x => x.a === 0 || x.b === 0), i = m.a === 0 ? m.b : m.a;
  return { k, jour, i, visiteur: m.b === 0, dos: jouaitHier(S, 0, jour), leurDos: jouaitHier(S, i, jour) };
}
/* À quelle distance de toi est ce club : au classement dès que la ligue a joué, à la force avant. */
function ecartAvec(S, i) {
  if (S.R.ligue.jour >= 20) return Math.abs(rangDe(S, i) - rangDe(S, 0));
  return Math.abs(clubNo(S, i).force - forceDe(S));
}
/*
 * OUVRIR UN QUART : le rival (parmi tes adversaires de ses derniers matchs, le plus près de toi), l'élite dès le deuxième
 * (ton match du cœur du quart contre le mieux classé de la ligue), tes trois affiches à poser, puis les trois objectifs
 * du proprio.
 */
function ouvrirLeQuart(S, n) {
  const R = S.R, debut = debutDuQuart(n), fin = debut + RUN.QUARTS[n], gros = {};
  const ms = Array.from({ length: fin - debut }, (_, j) => matchNo(S, debut + j));
  const pres = (a, b) => ecartAvec(S, a.i) - ecartAvec(S, b.i) || b.k - a.k;
  // Le rival : son dernier match contre toi dans la fin du quart.
  const derniers = ms.slice(-RUN.FIN_DU_QUART), rival = derniers.slice().sort(pres)[0];
  const duRival = derniers.filter(m => m.i === rival.i).at(-1);
  gros[duRival.k] = 'rival';
  if (n > 0) {
    const tete = classement(S).filter(i => i !== 0), rangAdv = m => tete.indexOf(m.i);
    const coeur = ms.slice(4, -RUN.FIN_DU_QUART - 1).filter(m => m.i !== rival.i).sort((a, b) => rangAdv(a) - rangAdv(b) || a.k - b.k)[0];
    if (coeur) gros[coeur.k] = 'elite';
  }
  R.quart = { n, debut, fin, rival: rival.i, gros, affiches: RUN.AFFICHES, pts: 0, hockey: 0, prime: 0, grosJoues: 0, grosGagnes: 0, rivalBattu: null, pochettes: [], objectifs: [] };
  R.quart.objectifs = objectifsDuQuart(S, n);
  R.phase = 'quart';
}
/* Ce qu'un club de ce rang de force fait par match dans une ligue de 32, en points. */
const tauxAttendu = r => { const [haut, bas] = RUN.OBJECTIFS.TAUX; return haut - (haut - bas) * (r - 1) / 31; };
/*
 * LES TROIS OBJECTIFS (JP, 16 nov. 2026 : *plusieurs objectifs, variables selon force de l'équipe, de la ligue*) : les points
 * du quart qu'un club de ta force fait, le rival à battre, et un troisième tiré de la graine — ta place à la fin du quart,
 * deux affiches gagnées sur tes trois, ou le hockey de ton coach. Au quatrième quart, la place est la ligne des séries.
 */
function objectifsDuQuart(S, n) {
  const R = S.R, O = RUN.OBJECTIFS, r = rangDeForce(S), m = RUN.QUARTS[n];
  const points = Math.round(m * tauxAttendu(r)) - O.MARGE + (reglesDe(R).cible || 0);
  const sortes = REGLES_DU_COACH[R.coach.cle] ? ['place', 'gros', 'hockey'] : ['place', 'gros'];
  const tiers = n === RUN.QUARTS.length - 1 ? 'place' : pigeDans(sortes, R.graine, 'objectif', n);
  const troisieme = tiers === 'place' ? { sorte: 'place', cible: n === RUN.QUARTS.length - 1 ? RUN.LIGUE.PLACES : borne(r + O.PLACE_MARGE, ...O.PLACE_BORNES) }
    : tiers === 'gros' ? { sorte: 'gros', cible: Math.ceil(RUN.AFFICHES / 2) } : { sorte: 'hockey', cible: O.HOCKEY_SOIRS };
  return [{ sorte: 'points', cible: points }, { sorte: 'rival', cible: 1 }, troisieme];
}
/* Où en est un objectif : sa valeur lue dans le quart en cours, et s'il est tenu. La place se lit au classement du moment. */
export function etatDeLObjectif(S, o) {
  const Q = S.R.quart;
  const valeur = o.sorte === 'points' ? Q.pts : o.sorte === 'rival' ? (Q.rivalBattu ? 1 : 0) : o.sorte === 'place' ? rangDe(S, 0) : o.sorte === 'gros' ? Q.grosGagnes : Q.hockey;
  return { valeur, tenu: o.sorte === 'place' ? valeur <= o.cible : valeur >= o.cible };
}
/* Après l'ouverture du quart (les objectifs lus) : le bureau. */
export function versLeBureau(S) { S.R.phase = 'bureau'; figer(S); return S.R.phase; }

/* ---------- les clubs lus : son jeu, son intention ---------- */
/*
 * LE JEU D'UN CLUB (js/actes.js `jeuDuRival`) : trois lignes de vraies stats, son rang et le tien parmi les clubs de SA
 * saison ; son style en un mot (`cle`, `mot`) : sa ligne au meilleur rang parmi les clubs de sa saison, SANS toi.
 */
const saisonDe = (S, club) => S.clubs.filter(c => c.s === club.s).map(c => c.team);
function styleDe(S, club) {
  const k = cleDuClub(club);
  if (!S.styles) S.styles = new Map();
  if (!S.styles.has(k)) { const { cle, mot } = jeuDuRival(saisonDe(S, club), null, club.team); S.styles.set(k, { cle, mot }); }
  return S.styles.get(k);
}
export function jeuDe(S, x) {
  const club = clubDe(S, x);
  if (!club) return null;
  const jeu = { ...jeuDuRival([...saisonDe(S, club), S.toi], S.toi, club.team), ...styleDe(S, club) };
  return { ...jeu, dominante: dominanteDe(jeu, S.R.graine, S.R.quart ? S.R.quart.n : 0, club.team) };
}

/* ---------- le soir (§ 3.3) ---------- */
/* Le soir qui vient : ton prochain match de la saison, sa sorte (un soir ordinaire, l'élite, le rival ; une affiche si tu la poses), ce qu'il paie. */
export function prochainSoir(S) {
  const R = S.R, k = R.matchs.length;
  if (R.series || k >= RUN.LIGUE.MATCHS) return null;
  const m = matchNo(S, k), c = clubNo(S, m.i), sorte = R.quart.gros[k] || 'match';
  return { ...m, sorte, s: c.s, t: c.t, jetons: sorte === 'rival' ? RUN.JETONS_DU_RIVAL : jetonsEntre(S, m.i, RUN.JETONS_DU_MATCH) };
}
const jetonsEntre = (S, i, [a, b]) => Math.round(a + (b - a) * hauteurDe(S, i));
/*
 * POSER UNE AFFICHE (JP, 17 nov. 2026 : *tu les poses*) : à la feuille d'un soir ordinaire, tant qu'il t'en reste ce quart-ci.
 * Le match devient un duel en trois périodes ; gagné, il paie plus et ouvre trois portes à la hauteur du club battu. `oui`
 * faux : la retirer, tant que le match n'est pas joué. Une affiche pas posée à la fin du quart est perdue.
 */
export function poserLAffiche(S, oui) {
  const R = S.R, c = R.soir;
  if (!c || R.phase !== 'feuille' || !['match', 'affiche'].includes(c.sorte) || (oui && R.quart.affiches <= 0)) return false;
  c.sorte = oui ? 'affiche' : 'match';
  c.jetons = jetonsEntre(S, c.i, oui ? RUN.JETONS_DE_L_AFFICHE : RUN.JETONS_DU_MATCH);
  figer(S);
  return true;
}
/* Les cases d'habillé qu'aucun de tes réservistes ne peut tenir ce soir. */
const trousDe = S => { const L = activeLineup(S.toi); return HABILLES.filter(s => !L[s.i]); };
/*
 * « JOUER CE SOIR » : la feuille du soir s'ouvre. Si une case d'habillé reste vide (un blessé que personne chez toi ne peut
 * remplacer) et qu'une case de prêt est libre, le ballottage d'abord (§ 3.6).
 */
export function allerAuMatch(S) {
  const R = S.R, soir = prochainSoir(S);
  if (R.phase !== 'bureau' || !soir) return false;
  const refuses = new Set(R.refuses || []), cleDuTrou = s => `${s.i}:${S.roster[s.i] ? getPlayerKey(S.roster[s.i]) : ''}`;
  const trou = trousDe(S).find(s => !refuses.has(cleDuTrou(s))), pret = PRETS.find(s => !S.roster[s.i]);
  R.refuses = (R.refuses || []).filter(k => trousDe(S).some(s => cleDuTrou(s) === k));
  if (trou && pret) {
    const offres = offresDuBallottage(S, trou);
    if (offres.length) { R.ballottage = { i: trou.i, cle: cleDuTrou(trou), offres: offres.map(getPlayerKey) }; S.ballottage = offres; R.phase = 'ballottage'; figer(S); return true; }
  }
  R.soir = soir; R.phase = 'feuille';
  figer(S);
  return true;
}
/* Revenir de la feuille au bureau, ou au tableau des séries (changer une ligne, ouvrir une pochette) : rien n'est joué, l'affiche posée ne compte pas. */
export function retourAuBureau(S) { const R = S.R; if (R.phase === 'feuille') { R.soir = null; R.phase = R.series ? 'series' : 'bureau'; figer(S); } }
/* L'élite : l'enjeu se prend ou non à sa feuille ; sa récompense se fixe sur ta chance (`recompenseDeLElite`). */
export function mettreLEnjeu(S, oui) { const c = S.R.soir; if (c && c.sorte === 'elite') { c.enjeu = !!oui; figer(S); } }
export function fixerLElite(S, chance) { const c = S.R.soir; if (c && c.sorte === 'elite' && c.J == null) { c.J = recompenseDeLElite(chance); figer(S); } }
/* Ton gardien du soir : le partant ou l'auxiliaire (js/sim.js `pickGoalie` lit `_filetMatch`) ; il revient au partant après le match. */
export function choisirLeFilet(S, qui) { S.toi._filetMatch = qui === 'aux' ? 'aux' : 'partant'; }
const estUnDuel = c => c.sorte === 'rival' || c.sorte === 'affiche' || c.sorte === 'serie' || (c.sorte === 'elite' && !!c.enjeu);
/* Les étapes d'édition de l'adversaire de ce soir : celles du quart, ou des séries. */
const etapeDe = R => reglesDe(R).etapes[R.series ? RUN.QUARTS.length : R.quart.n];
const habiller = (t, e) => { if (e > 0) habillerLaLigue([t], e, v); };
const deshabiller = t => { for (const p of Object.values(t.roster)) if (p) delete p._carte; };
/* La clé des dés de ton match : son numéro dans la saison, ou sa ronde et son numéro dans la série. */
const cleDuMatch = R => (R.soir.sorte === 'serie' ? `s${R.series.ronde}g${R.series.moi.w + R.series.moi.l}` : `m${R.soir.k}`);
/*
 * LE SOIR, DIT AU MOTEUR : ce qu'une réponse d'histoire attend (js/sim.js `MOMENTS_SI`) se pose sur les deux clubs le temps
 * du match — le rival du quart, le jeu de l'adversaire, ta suite, ta bête noire, l'infirmerie, le dos-à-dos lu dans la
 * cédule, et en séries leur banc.
 */
const suiteDe = R => { let n = 0; for (let i = R.matchs.length - 1; i >= 0; i--) { const g = R.matchs[i].gagne; if (n && (n > 0) !== g) break; n += g ? 1 : -1; } return n; };
function beteNoireDe(R) {
  const perdus = new Map();
  let bete = null;
  for (const m of R.matchs) {
    const k = cleDuClub(m);
    if (m.gagne) { perdus.delete(k); if (bete === k) bete = null; } else { perdus.set(k, (perdus.get(k) || 0) + 1); if (!bete && perdus.get(k) >= 2) bete = k; }
  }
  return bete;
}
/* Le registre des blessures suit l'infirmerie : un joueur soigné (une histoire) ou parti n'y compte plus. */
function accorderLeRegistre(S) {
  const n = S.R.matchs.length, dernier = new Map();
  for (const b of S.toi.injuriesLog || []) if (b.player && (!dernier.has(b.player) || dernier.get(b.player).at <= b.at)) dernier.set(b.player, b);
  for (const [p, b] of dernier) b.games = Math.min(b.games, (S.toi.injured.get(p) || 0) + n - b.at);
}
function poserLeSoir(S, adv) {
  const R = S.R, c = R.soir, toi = S.toi;
  accorderLeRegistre(S);
  toi._suite = suiteDe(R);
  toi.rivaux = c.sorte === 'rival' ? [adv] : null;
  toi.beteNoire = beteNoireDe(R) === cleDuClub(c) ? adv : null;
  adv.sonJeu = [styleDe(S, clubDe(S, c)).cle];
  toi._jours = c.dos ? [0, 1] : [1];
  if (c.sorte === 'serie') adv.persoSeries = persoAdverse(adv, R.series.ronde);
  toi.jourCourant = toi.games = R.matchs.length;
  effetsDesJoueurs(toi, R.matchs.length);
}
function leverLeSoir(S, adv) { delete S.toi._jours; adv.sonJeu = null; adv.persoSeries = null; }
/* L'adversaire de ce soir, prêt : sain, ses jambes du jour, habillé de ses étapes. */
function adversaireDuSoir(S) {
  const R = S.R, c = R.soir, adv = c.sorte === 'serie' ? preparer(S, c.i, -1) : preparer(S, c.i, c.jour);
  if (c.sorte === 'serie') adv._jours = [1];
  habiller(adv, etapeDe(R));
  poserLeSoir(S, adv);
  return adv;
}
/*
 * LEUR BANC, EN SÉRIES : la philosophie de leur coach et ses pièces, chacune comptée sur tout son club, habillé comme il
 * jouera (l'écran le montre sur la feuille du soir ; le moteur joue le même, `poserLeSoir`).
 */
export function leurBanc(S) {
  const c = S.R.soir;
  if (!c || c.sorte !== 'serie') return null;
  const adv = clubDe(S, c).team;
  habiller(adv, etapeDe(S.R));
  const perso = persoAdverse(adv, S.R.series.ronde), banc = bancDuMatch(perso, Object.values(adv.roster).filter(Boolean));
  deshabiller(adv);
  return { cle: perso.cle, banc };
}
/*
 * TA CHANCE CE SOIR (la jauge de la feuille du soir, le seul endroit où elle se montre) : `n` matchs du moteur, tes jambes,
 * ton gardien et ton infirmerie tels quels, l'adversaire prêt. Rend { v, n } ; l'écran l'appelle par tranches (`tranche`).
 */
export function chanceCeSoir(S, { n = 40, tranche = 0 } = {}) {
  const R = S.R, adv = adversaireDuSoir(S);
  const A = R.soir.visiteur ? adv : S.toi, B = R.soir.visiteur ? S.toi : adv;
  const vA = chanceDUnSoir({ A, B, n, graine: `chance:${R.graine}:${cleDuMatch(R)}:${tranche}` });
  deshabiller(adv); leverLeSoir(S, adv);
  return { v: R.soir.visiteur ? n - vA : vA, n };
}
/* L'intention dominante de ce soir : celle que le rival, l'affiche ou l'élite montre ; en séries, aucune. La même pour l'écran, le match et les robots. */
const dominanteCeSoir = S => (S.R.soir.sorte === 'serie' ? null : jeuDe(S, S.R.soir).dominante);
export const intentionCeSoir = S => leurJeuDuDuel(S.toi, clubDe(S, S.R.soir).team, { graine: `run:${S.R.graine}`, cle: cleDuMatch(S.R), dominante: dominanteCeSoir(S) });
/*
 * JOUER LE MATCH de ce soir : un soir ordinaire par `playGame`, un gros match en duel (`simulerGrosMatch`, contre leur
 * intention dominante). Rien n'est encore compté : `conclure` le fait, et l'écran l'appelle tout de suite (un match lancé
 * est joué). Rend { gagne, ot, gf, ga, feuille, cote, adv }.
 */
export function jouerLeMatch(S) {
  const R = S.R, c = R.soir, club = clubDe(S, c), cle = cleDuMatch(R), duel = estUnDuel(c), dominante = duel ? dominanteCeSoir(S) : null;
  const adv = adversaireDuSoir(S);
  let res;
  if (duel) {
    const moment = c.sorte === 'serie' ? { serie: true, ronde: R.series.ronde } : null;
    const r = avecHasardIsole(`run:${R.graine}:${cle}`, () => simulerGrosMatch(S.toi, adv, { graine: `run:${R.graine}`, cle, moment, dominante, visiteur: !!c.visiteur, frais: false }));
    res = { gagne: r.gagne, ot: !!r.feuille.ot, gf: r.gf, ga: r.ga, feuille: r.feuille };
  } else {
    const f = feuilleVierge();
    const r = avecHasardIsole(`run:${R.graine}:${cle}`, () => playGame(c.visiteur ? adv : S.toi, c.visiteur ? S.toi : adv, 1, false, false, f, 0, true));
    res = { gagne: r.winner === S.toi, ot: !!r.ot, gf: c.visiteur ? r.gfB : r.gfA, ga: c.visiteur ? r.gfA : r.gfB, feuille: f };
  }
  deshabiller(adv); leverLeSoir(S, adv);
  return { ...res, cote: c.visiteur ? 'B' : 'A', adv: club, duel };
}

/* ---------- les stats de ta saison, les galons ---------- */
/*
 * CE QUE CHACUN A FAIT CHEZ TOI (`R.stats` : la clé du joueur → [matchs, buts, passes, tirs] ; un gardien → [départs,
 * victoires, défaites, défaites en prolongation, buts contre, tirs reçus]), lu dans chaque feuille : la saison et les séries.
 */
function compterLesStats(S, res) {
  const T = S.R.stats, f = res.feuille, cote = res.cote, autre = cote === 'A' ? 'B' : 'A';
  const ligne = (p, n) => { const k = getPlayerKey(p); return T[k] = T[k] || Array(n).fill(0); };
  for (const p of (f.alignes || {})[cote] || []) ligne(p, 4)[0]++;
  for (const b of f.buts || []) if (b.cote === cote && !b.fusillade) { if (b.marqueur) ligne(b.marqueur, 4)[1]++; for (const q of b.passeurs || []) if (q) ligne(q, 4)[2]++; }
  for (const l of f.lancers || []) if (l.cote === cote && l.tireur) ligne(l.tireur, 4)[3]++;
  const g = cote === 'A' ? f.gardienA : f.gardienB;
  if (g) { const x = ligne(g, 6); x[0]++; x[res.gagne ? 1 : res.ot ? 3 : 2]++; x[4] += butsDe(f, autre); x[5] += tirsTotal(f, autre); }
}
/*
 * LES GALONS (V28, tranche 5b ; docs/refonte-v30-2.md § 3.10) : ce qu'un joueur fait chez toi se grave sur sa carte, au
 * cartable. Le cœur les lit dans la feuille du soir et dans ses stats de la saison ; la coquille les écrit
 * (js/cartable.js `graverAuCartable`). Aucun effet au moteur. Ceux d'un match gardent leurs seuils ; ceux de la saison
 * sont à l'échelle de 82 matchs.
 */
export const GALONS = { CHAPEAU: 3, GRAND_SOIR: 6, MUR: 50, BUTS: 40, POINTS: 80 };
function galonsDuSoir(S, res, avant) {
  const R = S.R, f = res.feuille, cote = res.cote, miens = new Set(effectifDe(S));
  const pour = (f.buts || []).filter(x => !x.fusillade && x.cote === cote), contre = butsDe(f, cote === 'A' ? 'B' : 'A');
  const b = new Map(), p = new Map(), plus = (m, j) => { if (j && miens.has(j)) m.set(j, (m.get(j) || 0) + 1); };
  for (const x of pour) { plus(b, x.marqueur); plus(p, x.marqueur); for (const a of x.passeurs || []) plus(p, a); }
  const out = [], graver = (j, type, extra) => out.push({ k: getPlayerKey(j), n: j.n, type, extra });
  for (const [j, n] of p) {
    const nb = b.get(j) || 0, [, b0 = 0, a0 = 0] = avant[getPlayerKey(j)] || [], [, b1, a1] = R.stats[getPlayerKey(j)];
    if (nb >= GALONS.CHAPEAU) graver(j, 'chapeau', nb);
    if (n >= GALONS.GRAND_SOIR) graver(j, 'grandMatch', n);
    if (b0 < GALONS.BUTS && b1 >= GALONS.BUTS) graver(j, 'quaranteButs', b1);
    if (b0 + a0 < GALONS.POINTS && b1 + a1 >= GALONS.POINTS) graver(j, 'quatreVingtsPoints', b1 + a1);
  }
  // Le but gagnant contre le rival du dernier quart : celui qui met ton club un but devant leur compte final.
  const gagnant = R.soir.sorte === 'rival' && R.quart.n === RUN.QUARTS.length - 1 && res.gagne && pour[contre] ? pour[contre].marqueur : null;
  if (gagnant && miens.has(gagnant)) graver(gagnant, 'bourreau', R.soir.t);
  const g = cote === 'A' ? f.gardienA : f.gardienB, arrets = tirsTotal(f, cote === 'A' ? 'B' : 'A') - contre;
  if (res.gagne && g && miens.has(g)) {
    if (contre === 0) graver(g, 'jeuBlanc', arrets);
    if (arrets >= GALONS.MUR) graver(g, 'mur', arrets);
  }
  return out;
}
/* Les pièces de ton banc qui ont joué ce soir (celles qui ont atteint une marche). */
const piecesJouees = (f, cote) => [...new Set((f.pieces || []).filter(x => x.cote === cote && PIECES[x.cle]).map(x => x.cle))];

/* ---------- conclure : le match compte ---------- */
/*
 * CONCLURE : le classement, les points du quart, les jetons (la victoire, la règle du coach), l'usure des
 * jambes, le départ de ton gardien, les stats, les galons, le journal ; puis les autres matchs de la ligue jusqu'à ce soir,
 * et les jours de repos jusqu'à ton prochain match. Ce qui suit se met en file (`R.suite`) : la pièce d'un rival ou d'une
 * élite battus, les portes d'un gros match gagné, le bilan à la fin du quart. La phase : 'resultat'.
 */
export function conclure(S, res) {
  const R = S.R, c = R.soir, f = res.feuille, serie = c.sorte === 'serie', Q = R.quart, gros = res.duel && !serie;
  const rangAvant = serie ? null : rangDe(S, 0), n = R.matchs.length;
  const pts = serie ? 0 : (res.gagne ? 2 : res.ot ? 1 : 0);
  let jetons = serie ? 0 : res.gagne ? c.jetons : RUN.JETONS_PERDU[res.ot ? 1 : 0];
  // L'élite jouée avec son enjeu (js/actes.js) : gagnée, sa récompense ; perdue, la moitié en jetons et les sonnés.
  const enjeu = c.sorte === 'elite' && !!c.enjeu;
  if (enjeu) jetons = res.gagne ? c.J : -Math.min(R.jetons, perteDeLElite(c.J));
  const regle = REGLES_DU_COACH[R.coach.cle], hockey = !serie && !!regle && regle.lit(chiffresDuSoirDe(f, res.cote));
  const prime = hockey && Q.prime < RUN.PRIME_DU_QUART ? Math.min(regle.jetons, RUN.PRIME_DU_QUART - Q.prime) : 0;
  R.jetons += jetons + prime;
  if (R.sonnes > 0) R.sonnes--;
  if (enjeu && !res.gagne) R.sonnes = SONNES_ELITE;
  if (!serie) {
    Q.pts += pts; Q.prime += prime;
    if (hockey) Q.hockey++;
    // Le rival ne compte qu'à son propre objectif : ni double aux points, ni parmi « les gros matchs » (la revue du 17 nov.).
    if (gros && !res.gagne) R.relances++;
    if (gros && c.sorte !== 'rival') { Q.grosJoues++; if (res.gagne) Q.grosGagnes++; }
    if (c.sorte === 'affiche') Q.affiches--;
    if (c.sorte === 'rival') Q.rivalBattu = res.gagne;
    compterAuClassement(S, c.visiteur ? c.i : 0, c.visiteur ? 0 : c.i, { gfA: c.visiteur ? res.ga : res.gf, gfB: c.visiteur ? res.gf : res.ga, ot: res.ot }, f);
  }
  // Les jambes : ceux qui ont joué paient leur soir ; ton gardien compte un départ de plus, l'autre souffle.
  depenserEnergie(S.toi, activeLineup(S.toi));
  const gardien = res.cote === 'A' ? f.gardienA : f.gardienB;
  noterDepart(S.toi, gardien);
  S.toi._filetMatch = 'partant';
  const avant = JSON.parse(JSON.stringify(R.stats));
  compterLesStats(S, res);
  const marqueurs = new Map();
  for (const b of f.buts || []) if (b.cote === res.cote && !b.fusillade && b.marqueur) marqueurs.set(b.marqueur, (marqueurs.get(b.marqueur) || 0) + 1);
  const [etoile, buts] = [...marqueurs].sort((a, b) => b[1] - a[1])[0] || [];
  S.journal.push({ feuille: f, jour: n, n: n + 1, cote: res.cote, win: res.gagne, gf: res.gf, ga: res.ga, adv: res.adv.team, gardien });
  if (S.journal.length > GARDES) S.journal.splice(0, S.journal.length - GARDES);
  R.matchs.push({ s: c.s, t: c.t, i: c.i, sorte: c.sorte, q: serie ? RUN.QUARTS.length : Q.n, gagne: res.gagne, ot: res.ot, gf: res.gf, ga: res.ga, visiteur: !!c.visiteur, ...(enjeu ? { enjeu: true } : {}) });
  // Une blessure de ce soir se date en matchs de la run : les faits d'une histoire la lisent.
  for (const b of S.toi.injuriesLog || []) if (!b.run) { b.at = R.matchs.length; b.run = true; }
  const galons = galonsDuSoir(S, res, avant);
  if (galons.length) R.galons = [...(R.galons || []), ...galons];
  rendreLesPrets(S);
  // La ligue joue jusqu'à ce soir ; puis les jours passent jusqu'à ton prochain match (en séries : deux soirs, un repos).
  let autres = [];
  if (serie) { if ((R.series.moi.w + R.series.moi.l) % 2 === 1) recupererEnergie(S.toi); }
  else {
    const dernier = R.matchs.length >= RUN.LIGUE.MATCHS;
    autres = jouerLaLigueJusqua(S, c.jour);
    if (dernier) jouerLaLigueJusqua(S, S.cedule.length - 1);
    else for (let d = c.jour; d < S.jours[0][R.matchs.length]; d++) recupererEnergie(S.toi, ENERGIE_RECUP_JOUR);
  }
  R.apres = { gagne: res.gagne, ot: res.ot, gf: res.gf, ga: res.ga, pts, jetons, prime, s: c.s, t: c.t, sorte: c.sorte, duel: res.duel, visiteur: !!c.visiteur,
    pieces: piecesJouees(f, res.cote), tirs: [tirsTotal(f, res.cote), tirsTotal(f, res.cote === 'A' ? 'B' : 'A')], rang: serie ? null : [rangAvant, rangDe(S, 0)], autres,
    ...(etoile && buts >= 2 ? { etoile: { n: etoile.n, buts } } : {}), ...(galons.length ? { galons } : {}), offertes: [] };
  rebatir(S);
  // La suite : en séries, la série ; sinon la pièce, les portes, le bilan.
  R.suite = [];
  if (serie) conclureLeMatchDeSerie(S, res);
  else {
    if (res.gagne && (c.sorte === 'rival' || enjeu)) { R.apres.offertes = piecesOffertes(S.toi.perso, R.graine, `${c.sorte}${Q.n}`); R.suite.push('piece'); }
    if (gros && res.gagne) {
      ouvrirLesPortes(S, { bande: c.sorte === 'rival' ? RUN.PORTES_HAUTES : bandeAutourDe(res.adv), affronte: c, cle: `m${c.k}` });
      R.suite.push('portes');
    }
    if (R.matchs.length >= Q.fin) { faireLeBilan(S); R.suite.push('bilan'); }
  }
  R.hVue = null; S.histoire = undefined;
  R.soir = null;
  R.phase = 'resultat';
  figer(S);
  return R.phase;
}
/*
 * CONTINUER : la phase d'après, dans l'ordre de la file ; vide, le bureau (ou le tableau des séries, ou la fin). Du
 * résultat, d'une pièce réglée, des portes réglées.
 */
export function continuer(S) {
  const R = S.R;
  if (R.fin) R.phase = 'fin';
  else if (R.suite.length) { R.phase = R.suite.shift(); if (R.phase === 'piece' && !(R.apres.offertes || []).length) return continuer(S); }
  else R.phase = R.series ? 'series' : 'bureau';
  figer(S);
  return R.phase;
}

/* ---------- le bilan du quart, le marché (§ 3.4) ---------- */
/*
 * LE BILAN : les trois objectifs, tenus ou non ; deux manqués coûtent un cœur ; à zéro, le proprio te congédie. Les
 * médailles du quart : l'avoir joué, le bilan tenu, le rival battu.
 */
function faireLeBilan(S) {
  const R = S.R, Q = R.quart, objectifs = Q.objectifs.map(o => ({ ...o, ...etatDeLObjectif(S, o) }));
  // Au dernier quart, être des seize suffit : le proprio ne congédie pas un club qui fait les séries.
  const qualifie = Q.n === RUN.QUARTS.length - 1 && rangDe(S, 0) <= RUN.LIGUE.PLACES;
  const tenus = objectifs.filter(o => o.tenu).length, tenu = tenus >= 2 || qualifie;
  const medailles = (tenu ? MEDAILLES_ACTE.passe : RUN.MEDAILLES_QUART_JOUE) + (Q.rivalBattu ? MEDAILLES_ACTE.rival : 0);
  if (!tenu) R.coeurs--;
  const rival = R.ligue.clubs[Q.rival - 1];
  R.quarts.push({ n: Q.n, objectifs, tenus, tenu, coeur: !tenu, pts: Q.pts, rang: rangDe(S, 0), rival: !!Q.rivalBattu, s: rival.s, t: rival.t, medailles });
}
/* Après le bilan : congédié, la run finit ; sinon le marché du quart (une pièce parmi trois, une carte à monter). */
export function apresLeBilan(S) {
  const R = S.R;
  if (R.coeurs <= 0) return finir(S, 'congedie');
  R.marche = { pieces: piecesOffertes(S.toi.perso, R.graine, `marche${R.quart.n}`), piece: false, montee: false };
  R.phase = 'marche';
  figer(S);
  return R.phase;
}
/* La pièce de banc du marché : une seule, une parmi trois ; banc plein, `sort` part. */
export function acheterLaPiece(S, cle, sort = null) {
  const R = S.R, M = R.marche;
  if (!M || M.piece || !M.pieces.includes(cle) || R.jetons < PRIX_PIECE || (R.banc.length >= CASES_DU_BANC && !R.banc.includes(sort))) return false;
  R.jetons -= PRIX_PIECE; M.piece = true;
  R.banc = poserLaPiece(R.banc, cle, sort);
  rebatir(S); figer(S);
  return true;
}
/* Monter une carte d'une édition (js/rarete.js `EDITIONS`) : le moteur la lit dès ce soir. */
export const editionDe = p => (p._carte && p._carte.rar) || EDITIONS[0];
/*
 * AU MARCHÉ, MONTER UNE CARTE (V29, tranche 1 ter ; JP, 14 nov. 2026 : « 20 jetons, une par marché »). `aMonter` : tes
 * signés qui peuvent encore monter, ceux qui avancent le plus ton banc d'abord — une marche gagnée, puis le chemin fait
 * vers le seuil d'après, puis la cote ; pour chacun, ce que sa carte montée ajoute à chaque pièce (`gains`). Pur.
 */
export function aMonter(S) {
  const R = S.R, signes = signesDe(S), comptes = R.banc.map(cle => [cle, compteDe(cle, signes)]);
  return signes.filter(p => EDITIONS.indexOf(editionDe(p)) < EDITIONS.length - 1).map(p => {
    const avant = R.banc.map(cle => apportDe(cle, p)), avait = '_carte' in p, sauve = p._carte;
    p._carte = { rar: EDITIONS[EDITIONS.indexOf(editionDe(p)) + 1] };
    const apres = R.banc.map(cle => apportDe(cle, p));
    if (avait) p._carte = sauve; else delete p._carte;
    const gains = comptes.map(([cle], i) => ({ cle, d: apres[i] - avant[i] })).filter(x => x.d > 0);
    const note = comptes.reduce((a, [cle, n], i) => { const d = apres[i] - avant[i], suivant = seuilSuivant(cle, n); return a + (marcheDe(cle, n + d) - marcheDe(cle, n)) * 100 + (suivant != null && d > 0 ? d / (suivant - n) : 0); }, 0);
    return { p, gains, note };
  }).sort((a, b) => b.note - a.note || v(b.p) - v(a.p));
}
export function monterAuMarche(S, p) {
  const R = S.R, M = R.marche, k = EDITIONS.indexOf(editionDe(p));
  if (!M || M.montee || R.jetons < RUN.MONTER || !signesDe(S).includes(p) || k >= EDITIONS.length - 1) return false;
  R.jetons -= RUN.MONTER; M.montee = true;
  p._carte = { rar: EDITIONS[k + 1] };
  rebatir(S); figer(S);
  return true;
}
/* Quitter le marché : le quart suivant s'ouvre ; après le quatrième, les séries si tu es des seize, sinon la run finit. */
export function quitterLeMarche(S) {
  const R = S.R, n = R.quart.n;
  R.marche = null;
  if (n < RUN.QUARTS.length - 1) ouvrirLeQuart(S, n + 1);
  else if (rangDe(S, 0) <= RUN.LIGUE.PLACES) ouvrirLeTableauDesSeries(S);
  else return finir(S, 'saison');
  figer(S);
  return R.phase;
}

/* ---------- les portes et la signature (§ 3.4, § 3.5) ---------- */
/*
 * OUVRIR LES PORTES : `PORTES` vrais vestiaires de la bande, dont toujours le club affronté ; jamais deux fois le même.
 * `R.portes` : { clubs: [{ s, t }], bande, cle, tour } ; `tour` monte à chaque relance.
 */
function ouvrirLesPortes(S, { bande, affronte = null, cle, tour = 0, payees = 0 }) {
  const R = S.R, a = affronte && tour === 0 ? clubDe(S, affronte) : null;
  const pris = new Set(a ? [cleDuClub(a)] : []), clubs = a ? [a] : [];
  const pool = dansLaBande(S.clubs, bande);
  for (let k = 0; clubs.length < RUN.PORTES && k < 40; k++) {
    const c = pigeDans(pool, R.graine, 'porte', cle, tour, k);
    if (c && !pris.has(cleDuClub(c))) { pris.add(cleDuClub(c)); clubs.push(c); }
  }
  R.portes = { clubs: clubs.map(c => ({ s: c.s, t: c.t })), bande, cle, tour, affronte: a ? cleDuClub(a) : null, ...(payees ? { payees } : {}) };
}
/* La bande des portes d'un gros match gagné : autour de la hauteur du club battu parmi tous les clubs (un gros club battu ouvre de meilleurs vestiaires). */
const bandeAutourDe = club => { const [a, b] = RUN.PORTES_AUTOUR, bas = Math.max(RUN.PORTES_PLANCHER, Math.min(0.85, club.rang + a)); return [bas, Math.min(1, Math.max(bas + 0.15, club.rang + b))]; };
/* Qui peut sortir pour lui : ceux de son groupe (avant, défenseur, gardien), parmi tes vingt-trois. */
export const sortantsPour = (S, p) => effectifDe(S).filter(x => groupeDe(x) === groupeDe(p));
/* Ta masse si `p` entre et `sortant` part : la part `RACHAT` de son salaire se libère, le reste reste au plafond. */
export const masseApres = (S, p, sortant) => masseDe(S) - RUN.RACHAT * prixDe(S, sortant) + prixDe(S, p);
/* Il tient dans ton espace s'il existe quelqu'un de son groupe dont la sortie le fait passer sous le plafond. */
export const tient = (S, p) => sortantsPour(S, p).some(x => masseApres(S, p, x) <= S.R.plafond);
/*
 * LE VESTIAIRE D'UNE PORTE : ses joueurs que tu n'as jamais eus (aucun joueur deux fois dans la run), les plus forts
 * d'abord ; `tient` dit qui passe sous ton plafond. Sans club : la pochette ouverte.
 */
export function vestiaireDe(S, x) {
  const club = clubDe(S, x), vus = new Set(S.R.vus);
  return (club ? club.pool : S.pochette || []).filter(p => !vus.has(getPersonKey(p))).sort((a, b) => v(b) - v(a)).map(p => ({ p, tient: tient(S, p) }));
}
/* Ranger tes trios et tes paires du plus fort au moins fort : l'ordre n'est pas un choix, leur composition, oui. */
function rangerLesUnites(roster) {
  for (const [g, n] of [['F', 4], ['D', 3]]) {
    const unites = Array.from({ length: n }, (_, u) => HABILLES.filter(s => s.group === g && s.unit === u));
    const contenu = unites.map((cases, u) => ({ u, ps: cases.map(s => roster[s.i]) })).map(x => ({ ...x, v: x.ps.reduce((a, p) => a + (p ? v(p) : 0), 0) }));
    contenu.sort((a, b) => b.v - a.v || a.u - b.u).forEach((x, u) => unites[u].forEach((s, k) => { roster[s.i] = x.ps[k]; }));
  }
}
/*
 * SIGNER : l'arrivant prend la case de celui qui sort ; la part du salaire de celui-ci qui ne se libère pas reste au
 * plafond pour la run (`R.mort`). `auMieux` (les robots) : tout l'alignement refait. Rend faux si le plafond ne tient pas.
 */
export function signer(S, p, sortant, { auMieux = false } = {}) {
  const R = S.R, cas = CASES.find(s => S.roster[s.i] === sortant);
  if (!cas || groupeDe(p) !== groupeDe(sortant) || masseApres(S, p, sortant) > R.plafond) return false;
  const neuf = copie(p);
  R.mort += (1 - RUN.RACHAT) * prixDe(S, sortant);
  S.roster[cas.i] = neuf;
  S.toi.injured.delete(sortant);
  R.vus.push(getPersonKey(p));
  R.anciens.push(getPlayerKey(sortant));
  if (auMieux) { const r = autoRoster(effectifDe(S)); for (const s of CASES) S.roster[s.i] = r[s.i] || null; }
  else rangerLesUnites(S.roster);
  rebatir(S);
  return true;
}
/* Passer une porte paie. */
export function passerLesPortes(S) { S.R.jetons += RUN.PASSER; }
/*
 * RELANCER LES PORTES : trois autres vestiaires de la même bande. Un gros match perdu donne une relance ; sinon elle se paie
 * en jetons (JP, 14 nov. 2026), `RELANCE` puis le double à chaque relance payée du même soir, `RELANCES_PAYEES` au plus.
 * `prixDeLaRelance` : 0 (une relance gagnée), son prix, ou null (plus aucune ce soir, ou une pochette ouverte).
 */
export function prixDeLaRelance(S) {
  const R = S.R, P = R.portes;
  if (!P || P.pochette) return null;
  if (R.relances > 0) return 0;
  return (P.payees || 0) >= RUN.RELANCES_PAYEES ? null : RUN.RELANCE * 2 ** (P.payees || 0);
}
export function relancerLesPortes(S) {
  const R = S.R, P = R.portes, prix = prixDeLaRelance(S);
  if (prix == null || prix > R.jetons) return false;
  if (prix) R.jetons -= prix; else R.relances--;
  ouvrirLesPortes(S, { bande: P.bande, cle: P.cle, tour: P.tour + 1, payees: (P.payees || 0) + (prix ? 1 : 0) });
  figer(S);
  return true;
}
/* Après les portes (signé ou passé) : la suite de la file. */
export function apresLesPortes(S) { S.R.portes = null; S.pochette = null; return continuer(S); }
/*
 * UNE POCHETTE, AU BUREAU (JP, 16 nov. 2026 : *packs et portes*) : payée, ses joueurs (tirés par l'écran ou le robot,
 * js/packs.js `tirerJoueursDuPack`) s'ouvrent comme une porte : tu en signes un, ou tu passes. Une de chaque par quart.
 */
export const pochetteLibre = (S, cle) => S.R.phase === 'bureau' && !!RUN.POCHETTES[cle] && !S.R.quart.pochettes.includes(cle) && S.R.jetons >= RUN.POCHETTES[cle];
export function acheterLaPochette(S, cle, joueurs) {
  const R = S.R;
  if (!pochetteLibre(S, cle) || !joueurs.length) return false;
  R.jetons -= RUN.POCHETTES[cle]; R.quart.pochettes.push(cle); R.achats++;
  S.pochette = joueurs;
  R.portes = { clubs: [], pochette: cle, joueurs: joueurs.map(getPlayerKey), cle: `pochette:${R.matchs.length}:${cle}`, tour: 0 };
  R.suite = []; R.phase = 'portes';
  figer(S);
  return true;
}

/* ---------- l'alignement ---------- */
/* Échanger deux cases de ton alignement, si chacun convient à la case de l'autre ; puis tes trios se rangent. */
export function echangerDeuxCases(S, i, j) {
  const a = CASES.find(s => s.i === i), b = CASES.find(s => s.i === j), pa = S.roster[i], pb = S.roster[j];
  if (!a || !b || i === j || (pa && !fits(pa, b)) || (pb && !fits(pb, a))) return false;
  S.roster[i] = pb; S.roster[j] = pa;
  rangerLesUnites(S.roster);
  rebatir(S);
  figer(S);
  return true;
}
/* Les accords d'une ligne (`u` : le trio, et la paire qui joue derrière lui), les plus forts d'abord. */
export const accordsDe = (S, u) => accordsDeLigne(S.roster, u);
/*
 * CE QU'UNE CARTE TENUE ALLUMERAIT à la case `j` : les accords de cette ligne si le joueur de la case `i` y était (et l'autre
 * à sa place), moins ceux qu'elle a déjà. Rend { plus, moins }, ou null si l'échange ne tient pas.
 */
export function siTenu(S, i, j) {
  const a = CASES.find(s => s.i === i), b = CASES.find(s => s.i === j), pa = S.roster[i], pb = S.roster[j];
  if (!a || !b || i === j || !pa || !fits(pa, b) || (pb && !fits(pb, a))) return null;
  const essai = { ...S.roster, [i]: pb, [j]: pa };
  const noms = (r, s) => (s.scratch || s.group === 'G' ? [] : accordsDeLigne(r, s.group === 'F' ? s.unit : Math.min(2, s.unit)).map(x => x.aff.cle));
  const avantB = noms(S.roster, b), apresB = noms(essai, b), avantA = noms(S.roster, a), apresA = noms(essai, a);
  return { plus: apresB.filter(k => !avantB.includes(k)), moins: avantA.filter(k => !apresA.includes(k)) };
}

/* ---------- le ballottage, seulement s'il le faut (§ 3.6 ; JP, 16 nov. 2026) ---------- */
/* Trois vrais joueurs pas chers du bas de l'échelle, à ce poste, que tu n'as jamais eus. */
function offresDuBallottage(S, cas) {
  const R = S.R, vus = new Set(R.vus);
  const pool = dansLaBande(S.clubs, RUN.REPECHAGE.BANDE).flatMap(c => c.pool).filter(p => fits(p, cas) && !vus.has(getPersonKey(p)) && prixDe(S, p) <= RUN.REPECHAGE.PLANCHER * 1.5);
  const out = [];
  for (let k = 0; out.length < 3 && k < 40 && pool.length; k++) {
    const p = pigeDans(pool, R.graine, 'ballottage', R.matchs.length, cas.i, k);
    if (!out.some(x => getPersonKey(x) === getPersonKey(p))) out.push(p);
  }
  return out;
}
/* Ce que le ballottage offre, relu de la sauvegarde s'il le faut. */
export function offresVues(S) {
  if (!S.ballottage && S.R.ballottage) { const tous = new Map(dansLaBande(S.clubs, RUN.REPECHAGE.BANDE).flatMap(c => c.pool).map(p => [getPlayerKey(p), p])); S.ballottage = S.R.ballottage.offres.map(k => tous.get(k)).filter(Boolean); }
  return S.ballottage || [];
}
/* Réclamer : il tient une case de prêt le temps de la blessure, sans salaire au plafond ni compte au banc. `null` : passer. */
export function reclamer(S, p) {
  const R = S.R, B = R.ballottage, pret = PRETS.find(s => !S.roster[s.i]);
  if (R.phase !== 'ballottage' || !B) return false;
  if (p && pret && offresVues(S).includes(p)) {
    S.roster[pret.i] = copie(p);
    R.vus.push(getPersonKey(p));
    R.prets.push({ k: getPlayerKey(p) });
    rebatir(S);
  } else R.refuses = [...(R.refuses || []), B.cle];
  R.ballottage = null; S.ballottage = null;
  R.phase = 'bureau';
  figer(S);
  return allerAuMatch(S);
}
/* Un prêt repart dès que ton club tient toutes ses cases sans lui (celui qu'il remplaçait est revenu, ou un autre a pris la case). */
function rendreLesPrets(S) {
  const R = S.R;
  R.prets = R.prets.filter(x => {
    const cas = PRETS.find(s => S.roster[s.i] && getPlayerKey(S.roster[s.i]) === x.k);
    if (!cas) return false;
    const p = S.roster[cas.i];
    delete S.roster[cas.i];
    if (trousDe(S).length) { S.roster[cas.i] = p; return true; }
    S.toi.injured.delete(p);
    return false;
  });
}

/* ---------- les histoires du bureau (§ 3.7) ---------- */
/* La ligue, comme les faits la lisent (js/faits.js) : les équipes et leur fiche, tes soirs à venir par numéro de match, le gros match du soir. */
function ligueLue(S) {
  const R = S.R, calendrier = [], grosAnnonces = {};
  for (let k = R.matchs.length; k < Math.min(RUN.LIGUE.MATCHS, R.matchs.length + 7); k++) {
    const m = matchNo(S, k), adv = S.equipes[m.i];
    calendrier[k] = [m.visiteur ? { A: adv, B: S.toi } : { A: S.toi, B: adv }];
    if (R.quart.gros[k]) grosAnnonces[k] = { adv, raison: R.quart.gros[k] === 'rival' ? 'rival' : 'gros' };
  }
  return { teams: S.equipes, calendrier, grosAnnonces };
}
/* Ce que la run sait jouer d'une histoire : les jetons, ce qui va au joueur nommé, le dé, les gestes du jour ; ni échange, ni pièce, ni canal de club. */
const GESTES_JOUES = ['soin', 'absents', 'energie', 'energieTous', 'gardienAux'];
const jouable = k => HISTOIRES[k].options.every(o => !o.canaux && !o.adv && !o.suite && Object.keys(o.gestes || {}).every(g => GESTES_JOUES.includes(g)));
/*
 * L'HISTOIRE DU JOUR (js/histoires.js `tirer`) : au bureau, `REPOS_HISTOIRE` matchs après la dernière, la vraie qui tire le
 * plus haut, ou null. Rend { cle, H, f, joueur, joueurs } ; `joueur` est celui de ton club qu'elle nomme. Lue une fois par
 * soir (`S.histoire`) ; pas ouverte, elle tombe au prochain match.
 */
export function histoireDuJour(S) {
  const R = S.R, n = R.matchs.length;
  if (R.series || !R.ligue || n < RUN.REPOS_HISTOIRE || n - R.hRepos < RUN.REPOS_HISTOIRE || R.hVue === n) return null;
  if (S.histoire !== undefined && S.histoire.n === n) return S.histoire.h;
  const toi = S.toi;
  toi._jours = S.jours[0].slice(n).map((d, k) => n + k).filter((k, j, l) => j > 0 && S.jours[0][k] - S.jours[0][l[j - 1]] === 1).flatMap(k => [k - 1, k]);
  const f = faitsDe({ ligue: ligueLue(S), you: toi, jour: n, run: { jetons: R.jetons, coach: R.coach.cle, sorties: R.histoires, places: RUN.LIGUE.PLACES, shard: s => S.donnees.shard(s) } });
  delete toi._jours;
  const cle = tirer(R.graine, 'lundi', f, R.histoires, { permis: jouable });
  let h = null;
  if (cle) {
    const H = HISTOIRES[cle], cles = (H.joueurs ? H.joueurs(f) : [H.joueur(f)]).filter(Boolean).map(x => x.cle);
    const auClub = k => effectifDe(S).find(p => getPlayerKey(p) === k) || null;
    if (auClub(cles[0])) h = { cle, H, f, joueur: auClub(cles[0]), joueurs: cles };
  }
  S.histoire = { n, h };
  return h;
}
/*
 * RÉPONDRE : la décision passe par la porte du jeu (js/greffes.js `appliquerChoix`), datée en matchs joués ; ses jetons vont
 * à la caisse. Rend le dé s'il y en a un ({ gagne, face }).
 */
export function repondre(S, h, choix) {
  const R = S.R, o = h.H.options.find(x => x.cle === choix), n = R.matchs.length;
  if (!o) return null;
  const d = { jour: n, moment: { famille: 'histoire', cle: h.cle, choix, joueur: h.joueurs[0], joueurs: h.joueurs } };
  appliquerChoix(S.toi, d, R.graine);
  R.jetons = Math.max(0, R.jetons + (o.jetons || 0));
  R.histoires.push({ cle: h.cle, choix, joueur: h.joueurs[0], joueurs: h.joueurs, j: n });
  R.hRepos = n; R.hVue = n; S.histoire = { n, h: null };
  const de = o.pari ? deDuChoix(d, R.graine) : null;
  figer(S);
  return de ? { gagne: de.gagne, face: de.face } : null;
}

/* ---------- les vraies séries (§ 3.9 ; JP, 16 nov. 2026 : 16 clubs, 4 rondes) ---------- */
/* Une série du tableau : { a, b } (les indices des clubs, `a` le mieux classé), { w, l } les victoires de `a` et de `b`. */
const serieFinie = x => x.w >= RUN.SERIE || x.l >= RUN.SERIE;
const gagnantDe = x => (x.w >= RUN.SERIE ? x.a : x.b);
function ouvrirLeTableauDesSeries(S) {
  const R = S.R, tetes = classement(S).slice(0, RUN.LIGUE.PLACES);
  R.series = { tetes, ronde: 0, rondes: [TABLEAU.map(([a, b]) => ({ a: tetes[a - 1], b: tetes[b - 1], w: 0, l: 0 }))], moi: null, faites: [] };
  poserMaSerie(S);
  // Quelques jours de congé avant le premier match : les jambes reviennent.
  for (let d = 0; d < 4; d++) recupererEnergie(S.toi);
  Object.assign(R, { phase: 'series', soir: null, apres: null, suite: [], quart: { ...R.quart, gros: {} } });
}
/* Ta série de la ronde : ton adversaire, tes victoires et tes défaites, si tu es le mieux classé. */
function poserMaSerie(S) {
  const X = S.R.series, x = X.rondes[X.ronde].find(y => y.a === 0 || y.b === 0);
  X.moi = { adv: x.a === 0 ? x.b : x.a, w: 0, l: 0, haut: x.a === 0 };
}
/* Le prochain match de ta série : sa feuille du soir. Le mieux classé joue chez lui les matchs 1, 2, 5 et 7. */
export function allerAuMatchDeSerie(S) {
  const R = S.R, X = R.series, M = X.moi, c = clubNo(S, M.adv), n = M.w + M.l;
  R.soir = { sorte: 'serie', i: M.adv, s: c.s, t: c.t, visiteur: CHEZ_LE_MIEUX_CLASSE.includes(n) !== M.haut, jetons: 0, dos: n % 2 === 1, leurDos: n % 2 === 1 };
  R.phase = 'feuille';
  figer(S);
}
/* Un match d'une autre série : les deux clubs sains, sur leurs propres dés. */
function jouerUnMatchDeSerie(S, x, ronde) {
  const R = S.R, n = x.w + x.l, chezA = CHEZ_LE_MIEUX_CLASSE.includes(n);
  const A = preparer(S, x.a, -1), B = preparer(S, x.b, -1);
  A._jours = B._jours = [1];
  const r = avecHasardIsole(`serie:${R.graine}:${ronde}:${x.a}-${x.b}:${n}`, () => playGame(chezA ? A : B, chezA ? B : A, 0, false, true, null, ronde));
  if ((r.winner === A)) x.w++; else x.l++;
}
/*
 * TON MATCH DE SÉRIE EST JOUÉ : les autres séries de la ronde avancent d'un match. Ta série finie : perdue, la run finit ;
 * gagnée, les autres séries se finissent, la ronde suivante se bâtit dans l'ordre du tableau ; la quatrième gagnée, la Coupe.
 */
function conclureLeMatchDeSerie(S, res) {
  const R = S.R, X = R.series, M = X.moi, ronde = X.rondes[X.ronde], mienne = ronde.find(y => y.a === 0 || y.b === 0);
  if (res.gagne) M.w++; else M.l++;
  if (res.gagne === M.haut) mienne.w++; else mienne.l++;
  for (const x of ronde) if (x !== mienne && !serieFinie(x)) jouerUnMatchDeSerie(S, x, X.ronde);
  if (M.l >= RUN.SERIE) return void finir(S, 'serie', { garder: true });
  if (M.w < RUN.SERIE) return;
  const adv = R.ligue.clubs[M.adv - 1];
  X.faites.push({ s: adv.s, t: adv.t, w: M.w, l: M.l });
  for (const x of ronde) while (!serieFinie(x)) jouerUnMatchDeSerie(S, x, X.ronde);
  if (X.ronde === RONDES - 1) return void finir(S, 'coupe', { garder: true });
  const gagnants = ronde.map(gagnantDe), tete = i => X.tetes.indexOf(i);
  X.rondes.push(Array.from({ length: gagnants.length / 2 }, (_, k) => { const [a, b] = [gagnants[2 * k], gagnants[2 * k + 1]].sort((x, y) => tete(x) - tete(y)); return { a, b, w: 0, l: 0 }; }));
  X.ronde++;
  poserMaSerie(S);
  recupererEnergie(S.toi);
}

/* ---------- la fin ---------- */
/*
 * Ce qu'une run a gagné en médailles, là où elle en est : ses quarts joués et ses rondes de séries, au multiple de son cran,
 * plus sa caisse — les jetons qui restent deviennent des médailles, `JETONS_PAR_MEDAILLE` pour une (JP, 14 nov. 2026). Pur ;
 * une run d'avant la V30 (ses actes) s'y lit encore, pour être soldée à l'ouverture.
 */
const medaillesDeLaCaisse = R => Math.floor(Math.max(0, R.jetons || 0) / RUN.JETONS_PAR_MEDAILLE);
export const medaillesDe = (R, rondes = R.series ? R.series.faites.length : 0, coupe = false) => Math.round(((R.quarts || R.actes || []).reduce((a, x) => a + (x.medailles || 0), 0) + ecussonsDesSeries(rondes, coupe)) * reglesDe(R).prime) + medaillesDeLaCaisse(R);
/*
 * LA FIN DE LA RUN : sa cause ('congedie' — plus de cœur —, 'saison' — hors des seize —, 'serie', 'coupe', 'quitte'), ses
 * médailles. `garder` : la fin arrive pendant qu'un match se conclut ; son résultat se montre d'abord.
 */
export function finir(S, cause, { garder = false } = {}) {
  const R = S.R, rondes = R.series ? R.series.faites.length : 0, coupe = cause === 'coupe';
  // La Coupe se grave sur chaque carte de l'effectif qui la gagne.
  if (coupe) R.galons = [...(R.galons || []), ...effectifDe(S).map(j => ({ k: getPlayerKey(j), n: j.n, type: 'coupe' }))];
  R.fin = { cause, rondes, coupe, medailles: medaillesDe(R, rondes, coupe), caisse: medaillesDeLaCaisse(R), matchs: R.matchs.length, rang: R.ligue ? rangDe(S, 0) : null, pts: R.ligue ? pointsDe(R.ligue.fiches[0]) : 0 };
  if (!garder) R.phase = 'fin';
  figer(S);
  return R.phase;
}
export const forceDe = S => force(S.toi);
