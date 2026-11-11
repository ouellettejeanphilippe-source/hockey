/*
 * LA RUN EN CARTE (V28, docs/refonte-v28.md § 4 ; JP, 9 nov. 2026 : la boucle, oui ; garder le simulateur). Le cœur, PUR et
 * sans DOM : le jeu (js/run-jeu.js) et les robots (scripts/mesure_run.mjs, scripts/check_run.mjs) jouent par ces mêmes
 * fonctions, jamais une copie.
 *
 *   LA RUN : une décennie tirée de la graine, un coach (sa pièce de départ sur le banc), 23 bouche-trous de la décennie, puis
 *   le camp (`CAMP` fois trois portes). Trois actes : une carte de sept rangs (cinq de matchs, deux d'arrêts) qui monte vers
 *   le rival. Un match se joue isolé par le simulateur (`playGame`) ; l'élite, le rival et les séries en duel
 *   (`simulerGrosMatch`, ton plan). Après chaque match, trois portes : trois vrais vestiaires, dont le club affronté. Signer
 *   passe par l'échange : la part `RACHAT` du salaire de celui qui sort se libère, le reste reste au plafond pour la run.
 *   La cible de l'acte (`CIBLES`, sur 14 : 2 la victoire, 1 la défaite en prolongation, le rival double), `COEURS` cœurs,
 *   puis les séries : trois rondes en 3 de 5, une série perdue rachetée par un cœur.
 *
 *   L'ÉTAT : `R`, un objet JSON (la sauvegarde) ; la séance `S` le porte avec ce qui ne se garde pas (les clubs classés de la
 *   décennie, ton club bâti, les feuilles). `figer(S)` écrit l'effectif dans `R` ; `ouvrirSeance` le relit.
 *
 *   LES PHASES (`R.phase`) : camp → annonce → carte → feuille → portes → carte … → (le rival) finacte → portes → annonce …
 *   → series → fin ; les arrêts : marche, vestiaire, histoire.
 *
 * Les tirages sont des hachages de la graine et de leur moment (`hache`) : rien ne dépend de l'ordre des appels, et la même
 * graine rejoue le même match tant que ton club n'a pas changé.
 */
import {
  SLOTS, CAP, SONNE, SONNES_ELITE, createTeam, autoRoster, registerHiddenRatings, getHiddenRatings, getPersonKey, getPlayerKey, teamStrength,
  avecHasardIsole, feuilleVierge, playGame, simulerGrosMatch, activeLineup, depenserEnergie, recupererEnergie, energieDe, fits, accordsDeLigne, tirsTotal, effetsDesJoueurs,
} from './sim.js';
import { leurJeuDuDuel, appliquerChoix, deDuChoix } from './greffes.js';
import { HISTOIRES, tirer } from './histoires.js';
import { faitsDe } from './faits.js';
import { PIECES, PIECE_DU_COACH, CASES_DU_BANC, piecesOffertes, poserLaPiece, piecesContre } from './pieces.js';
import { JETONS, PRIME_COACH_MAX, VRAIS_CONTRATS, bouchesTrousDuDepart, habillerLaLigue, chiffresDuSoirDe, ecussonsDesSeries } from './rogue.js';
import { REGLES_DU_COACH } from './coachs.js';
import { MEDAILLES_ACTE, PRIX_PIECE, jeuDuRival, lignesFortes, dominanteDe, recompenseDeLElite, perteDeLElite } from './actes.js';
import { chanceDUnSoir } from './pronostic.js';
import { seasonGames } from './ratings.js';
import { groupeDe } from './ballottage.js';
import { EDITIONS } from './rarete.js';
import { hache } from './util.js';

/* ---------- les réglages (docs/refonte-v28.md § 5, § 9) ---------- */
export const RUN = {
  MATCHS: 5,                      // les matchs d'un acte, avant le rival
  CIBLES: [7, 8, 9],              // les points à tenir, sur 14
  COEURS: 2,                      // JP, 7 nov.
  PORTES: 3,
  CAMP: 3,                        // les tours de portes avant la première case
  RACHAT: 0.5,                    // la part du salaire de celui qui sort qui se libère (JP, 10 nov.)
  ESPACE: 4_000_000,              // l'espace de départ sous le plafond
  DECALAGE: 0.25,                 // les adversaires plus haut dans la décennie, en rang centile
  ETAPES: [1, 2, 3, 7],           // leurs étapes d'édition aux actes I, II, III et en séries (mesuré le 11 nov. 2026 : le malin 9 Coupes sur 64)
  BANDES: [[0.15, 0.55], [0.3, 0.7], [0.45, 0.85]],   // les bandes de force des portes, en rang centile parmi les clubs de la décennie
  RIVAUX: [0.65, 0.8, 0.92],
  SERIES: [0.82, 1],
  BANDE_DU_CAMP: [0.2, 0.6],
  ELITE: [0.9, 1],                // un club du haut
  PASSER: 6,                      // les jetons d'une porte passée
  JETONS_DU_MATCH: [8, 16],       // une victoire, du bas au haut de la bande
  JETONS_DU_RIVAL: 24,
  POCHETTES: { 'j:bronze': 14, 'j:epoque': 26 },
  MEDAILLES_ACTE_JOUE: 5,
};
/* La carte d'un acte : la largeur de chaque rang (de bas en haut), les rangs d'arrêts, le rang où une élite peut tenir. */
const LARGEURS = [2, 3, 2, 3, 2, 3, 2];
const RANGS_D_ARRETS = [3, 5];
const RANG_DE_L_ELITE = 2;
const ARRETS = ['marche', 'histoire', 'vestiaire'];
export const RANG_DU_RIVAL = LARGEURS.length;
const ACTES = 3;

/* ---------- les petits outils ---------- */
const v = p => getHiddenRatings(p).v;
const copie = p => { const c = { ...p }; registerHiddenRatings(c); return c; };
const force = t => { const f = teamStrength(t); return f.att + f.def + f.g; };
const cleDuClub = c => `${c.s}:${c.t}`;
const pigeDans = (liste, ...mots) => liste[Math.min(liste.length - 1, Math.floor(hache(...mots) * liste.length))];
/* Un ordre tiré de la graine : le même à chaque appel. */
const melange = (liste, ...mots) => liste.map((x, i) => [hache(...mots, i), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const CASES = SLOTS.filter(s => !s.extra);
const HABILLES = CASES.filter(s => !s.scratch);
/*
 * LE SALAIRE DE LA RUN (mesuré le 11 nov. 2026, docs/decisions.md). Le salaire du jeu (`$`) n'est pas à la même échelle d'une
 * époque à l'autre : avant 1989-90, la ligue ne publiait rien et il est estimé (médiane 0,9 M$ ; 3,5 M$ dans les années
 * 2020). Sous un seul plafond, une run des années 1970 signait qui elle voulait, et le malin gagnait 47 % de ses runs des
 * années 2000 contre aucune des années 2020. Le salaire d'une run est donc le RANG du salaire du joueur parmi les réguliers
 * de sa saison, lu sur l'échelle d'aujourd'hui (`ECHELLE` : les réguliers de 2021-22 à 2024-25). Un joueur d'aujourd'hui
 * garde son salaire ; Lafleur 1976-77 coûte ce que coûte aujourd'hui le mieux payé de la ligue.
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
export const masseDe = S => Object.values(S.roster).reduce((a, p) => a + prixDe(S, p), 0) + (S.R.mort || 0);
export const espaceDe = S => S.R.plafond - masseDe(S);

/* ---------- les décennies et leurs clubs ---------- */
/*
 * Les décennies jouables : cinq saisons au moins à l'index, depuis les vrais contrats (`VRAIS_CONTRATS`, 1990-91). Avant, les
 * salaires sont estimés, sans aubaine : mesuré le 11 nov. 2026, une run des années 1970 ne signait qu'une fois sous le
 * plafond qui mord. Ces époques attendent leur économie. [['1990', ['1990-91', …]], …]
 */
export function decenniesDe(saisons) {
  const par = new Map();
  for (const s of saisons) {
    const d = `${s.slice(0, 3)}0`;
    if (s < VRAIS_CONTRATS) continue;
    (par.get(d) || par.set(d, []).get(d)).push(s);
  }
  return [...par].filter(([, ss]) => ss.length >= 5);
}
/* La décennie d'une run : tirée de sa graine. */
export const decennieDe = (graine, saisons) => pigeDans(decenniesDe(saisons), graine, 'decennie')[0];
/* Une saison finie : son joueur le plus assidu (jamais échangé) a joué 90 % du calendrier. La saison en cours ne donne ni club ni porte. */
const saisonFinie = (s, joueurs) => joueurs.reduce((m, p) => (p.x ? m : Math.max(m, p.gp || 0)), 0) >= 0.9 * seasonGames(s);
/*
 * LES CLUBS D'UNE DÉCENNIE, classés par leur force (le moins fort d'abord) : chaque vrai club de chaque saison finie, ses
 * douze meilleurs avants, ses six meilleurs défenseurs, ses deux gardiens les plus utilisés. `rang` : son rang centile.
 * `donnees.shard(s)` rend { players, byTeam }, déjà chargé.
 */
function classerLesClubs(donnees, decennie) {
  const saisons = (decenniesDe(donnees.saisons).find(([d]) => d === decennie) || [null, []])[1];
  const tous = [];
  for (const s of saisons) {
    const sh = donnees.shard(s);
    if (!sh || !saisonFinie(s, sh.players)) continue;
    for (const [t, ps] of Object.entries(sh.byTeam)) {
      const ok = ps.filter(p => (p.gp || 0) >= 10);
      const F = ok.filter(p => groupeDe(p) === 'F').sort((a, b) => v(b) - v(a)).slice(0, 12);
      const D = ok.filter(p => groupeDe(p) === 'D').sort((a, b) => v(b) - v(a)).slice(0, 6);
      const G = ok.filter(p => groupeDe(p) === 'G').sort((a, b) => (b.gp || 0) - (a.gp || 0)).slice(0, 2);
      if (F.length < 12 || D.length < 6 || G.length < 2) continue;
      const pool = [...F, ...D, ...G];
      const team = createTeam(t, t, autoRoster(pool), { season: s });
      team.courbe = true;
      team.luck = 0;
      tous.push({ s, t, team, pool, force: force(team) });
    }
  }
  tous.sort((a, b) => a.force - b.force || (cleDuClub(a) < cleDuClub(b) ? -1 : 1));
  tous.forEach((c, i) => { c.rang = i / Math.max(1, tous.length - 1); });
  return tous;
}
const dansLaBande = (clubs, [a, b]) => clubs.filter(c => c.rang >= a && c.rang <= b);
const decale = ([a, b]) => [Math.min(0.95, a + RUN.DECALAGE), Math.min(1, b + RUN.DECALAGE)];

/* ---------- la run neuve ---------- */
/*
 * L'EFFECTIF DE DÉPART : les bouche-trous de la décennie (js/rogue.js `bouchesTrousDuDepart`, la bande de la V27, les pires
 * contrats), puis ajustés au vrai plafond (JP, oct. 2026 : *de vrais joueurs, trop payés pour leur valeur*) : tant que la
 * masse dépasse le plafond moins l'espace de départ, le plus payé cède sa case au moins payé de sa bande, au même poste ;
 * puis le moins payé cède la sienne à un plus payé, sans passer la cible. Aucun salaire n'est touché.
 */
function effectifDeDepart(S, graine) {
  const saisons = melange([...new Set(S.clubs.map(c => c.s))], graine, 'depart').slice(0, 8);
  const reserve = [];
  const bt = bouchesTrousDuDepart(saisons.map(s => S.donnees.shard(s).players), {
    groupe: groupeDe, valeur: v, personne: getPersonKey, reserve,
    piger: (liste, cle) => pigeDans(liste, graine, 'bouche-trou', cle),
  });
  const roster = autoRoster(bt.map(copie)), cible = CAP - RUN.ESPACE;
  const pris = new Set(Object.values(roster).filter(Boolean).map(getPersonKey));
  const masse = () => Object.values(roster).reduce((a, p) => a + prixDe(S, p), 0);
  const ordre = (a, b) => (getPersonKey(a) < getPersonKey(b) ? -1 : 1);
  const libres = p => reserve.filter(x => x.p === p.p && x.np === p.np && !pris.has(getPersonKey(x)));
  const poser = (i, p, q) => { roster[i] = copie(q); pris.delete(getPersonKey(p)); pris.add(getPersonKey(q)); };
  // Alléger : du plus payé au moins payé, chacun contre le moins payé de sa bande.
  for (const [i, p] of Object.entries(roster).filter(([, q]) => q).sort((a, b) => prixDe(S, b[1]) - prixDe(S, a[1]) || ordre(a[1], b[1]))) {
    if (masse() <= cible) break;
    const q = libres(p).filter(x => prixDe(S, x) < prixDe(S, p)).sort((a, b) => prixDe(S, a) - prixDe(S, b) || ordre(a, b))[0];
    if (q) poser(i, p, q);
  }
  // Alourdir : du moins payé au plus payé, chacun contre le plus payé qui tient sous la cible.
  for (const [i, p] of Object.entries(roster).filter(([, q]) => q).sort((a, b) => prixDe(S, a[1]) - prixDe(S, b[1]) || ordre(a[1], b[1]))) {
    const m = masse();
    const q = libres(p).filter(x => prixDe(S, x) > prixDe(S, p) && m - prixDe(S, p) + prixDe(S, x) <= cible).sort((a, b) => prixDe(S, b) - prixDe(S, a) || ordre(a, b))[0];
    if (q) poser(i, p, q);
  }
  return roster;
}
/*
 * CRÉER LA RUN : `coach` est une carte de coach ({ id, n, saison, tag, cle, rang, maitrise }, js/coachs-reels.js) ou une
 * simple philosophie ({ cle }) pour un robot. Rend la séance, au camp, ses premières portes ouvertes.
 */
export function creerLaRun(donnees, { graine, coach, jetons = JETONS.depart, decennie = decennieDe(graine, donnees.saisons), numero = 1 }) {
  const S = { R: null, donnees, clubs: classerLesClubs(donnees, decennie), roster: {}, prix: new Map(), blesses: new Map(), journal: [], effets: [], absents: new Map(), toi: null, robotDuel: null };
  S.roster = effectifDeDepart(S, graine);
  const masse = Object.values(S.roster).reduce((a, p) => a + prixDe(S, p), 0), cible = CAP - RUN.ESPACE;
  // LE PLAFOND : ta masse de départ et son espace. Quand la décennie n'a pas d'assez gros contrats pour monter au vrai
  // plafond (avant 1989-90, des salaires estimés), l'espace prend ce que ces contrats auraient libéré en sortant.
  const plafond = Math.round((masse + RUN.ESPACE + RUN.RACHAT * Math.max(0, cible - masse)) / 100_000) * 100_000;
  const R = S.R = {
    v: 1, graine: String(graine), numero, decennie,
    coach: { maitrise: 1, ...coach }, banc: [PIECE_DU_COACH[coach.cle]],
    jetons, coeurs: RUN.COEURS, plafond, mort: 0,
    joueurs: [], vus: [], anciens: [],
    acte: 0, pts: 0, rang: 0, ou: null, carte: null, case: null,
    phase: 'camp', camp: 0, portes: null, apres: null, relances: 0, primeCoach: 0, sonnes: 0,
    actes: [], matchs: [], series: null, histoires: [], achats: 0, fin: null,
  };
  for (const p of Object.values(S.roster)) if (p) R.vus.push(getPersonKey(p));
  rebatir(S);
  ouvrirLesPortes(S, { bande: RUN.BANDE_DU_CAMP, cle: 'camp0' });
  figer(S);
  return S;
}
/* Rouvrir une run gardée : les mêmes clubs, ton effectif relu de ses clés, ses jambes, ses éditions, ses blessés. */
export function ouvrirSeance(donnees, R) {
  const clubs = classerLesClubs(donnees, R.decennie);
  const parCle = new Map();
  const trouver = k => {
    const s = k.slice(0, k.indexOf('_'));
    if (!parCle.has(s)) parCle.set(s, new Map(((donnees.shard(s) || {}).players || []).map(p => [getPlayerKey(p), p])));
    return parCle.get(s).get(k) || null;
  };
  const S = { R, donnees, clubs, roster: {}, prix: new Map(), blesses: new Map(), journal: [], effets: [], absents: new Map(), toi: null, robotDuel: null };
  for (const x of R.joueurs) {
    const p0 = trouver(x.k);
    if (!p0) continue;
    const p = copie(p0);
    p.energie = x.e ?? 100;
    if (x.ed) p._carte = { rar: x.ed };
    S.roster[x.i] = p;
    if (x.bl > 0) S.blesses.set(p, x.bl);
  }
  // Un joueur relu : le tien d'abord (le même objet que ton alignement), sinon celui de sa saison.
  const miens = new Map(Object.values(S.roster).map(p => [getPlayerKey(p), p])), relu = k => (k ? miens.get(k) || trouver(k) : null);
  S.journal = (R.journal || []).map(e => relire(e, relu, k => (k ? trouver(k) : null), c => clubDe(S, c)));
  S.effets = (R.effets || []).map(e => ({ ...e, joueur: relu(e.joueur) })).filter(e => e.joueur);
  for (const [k, j] of R.absents || []) { const p = relu(k); if (p) S.absents.set(p, j); }
  S.blessures = (R.blessures || []).map(b => ({ ...b, player: relu(b.k), run: true })).filter(b => b.player);
  // Une pochette ouverte, pas encore réglée : ses joueurs se relisent de leur saison.
  if (R.portes && R.portes.pochette) S.pochette = (R.portes.joueurs || []).map(trouver).filter(Boolean);
  rebatir(S);
  return S;
}
/* Écrire l'effectif dans `R` : la clé de chacun, sa case, ses jambes, son édition, ses matchs à l'infirmerie. */
export function figer(S) {
  S.R.joueurs = CASES.filter(s => S.roster[s.i]).map(s => {
    const p = S.roster[s.i], bl = S.toi.injured.get(p) || 0, ed = p._carte && p._carte.rar;
    return { k: getPlayerKey(p), i: s.i, e: energieDe(p), ...(ed ? { ed } : {}), ...(bl ? { bl } : {}) };
  });
  S.R.filet = S.toi._filetMatch || 'partant';
  S.R.effets = (S.toi.effetsCibles || []).filter(e => e.joueur).map(e => ({ ...e, joueur: getPlayerKey(e.joueur) }));
  S.R.absents = [...(S.toi.absents || [])].map(([p, j]) => [getPlayerKey(p), j]);
  S.R.journal = S.journal.map((e, i) => resumer(e, i === S.journal.length - 1));
  S.R.blessures = (S.toi.injuriesLog || []).filter(b => b.player).map(b => ({ k: getPlayerKey(b.player), games: b.games, genre: b.genre || null, at: b.at, jour: b.jour }));
  return S.R;
}
/*
 * LE JOURNAL GARDÉ : ce que les faits d'une histoire lisent d'une feuille (js/faits.js) — les buts, les punitions, les
 * bagarres, les pièces jouées, qui était habillé —, ses joueurs en clés, et ton côté de la feuille. Des lancers, seuls ceux
 * du dernier match se gardent (qui gardait) ; les coups ne se gardent pas.
 */
function resumer(e, dernier) {
  const f = e.feuille, k = p => (p ? getPlayerKey(p) : null);
  return { jour: e.jour, n: e.n, cote: e.cote, win: e.win, gf: e.gf, ga: e.ga, adv: e.adv ? { s: e.adv.season, t: e.adv.tag } : null, gardien: k(e.gardien),
    f: { buts: (f.buts || []).map(b => ({ cote: b.cote, instant: b.instant, marqueur: k(b.marqueur), passeurs: (b.passeurs || []).map(k), gardien: k(b.gardien), ...(b.fusillade ? { fusillade: true } : {}) })),
      punitions: (f.punitions || []).map(x => ({ cote: x.cote, instant: x.instant, joueur: k(x.joueur) })),
      physique: (f.physique || []).filter(x => x.type === 'bagarre').map(x => ({ type: x.type, cote: x.cote, minutes: x.minutes, joueur: k(x.joueur), cible: k(x.cible) })),
      pieces: f.pieces || [], relais: f.relais || [], alignes: { A: ((f.alignes || {}).A || []).map(k), B: ((f.alignes || {}).B || []).map(k) }, gardienA: k(f.gardienA), gardienB: k(f.gardienB),
      // Les tirs du dernier match seulement : qui gardait, de quel côté (le fait du gardien, js/vie-gm.js `joueurDuFait`).
      ...(dernier ? { lancers: (f.lancers || []).map(l => [l.cote, k(l.gardien)]) } : {}) } };
}
function relire(e, mien, autre, club) {
  const f = e.f, c = e.adv ? club(e.adv) : null;
  // Chaque joueur se relit de SON côté de la feuille : un joueur signé depuis chez le club affronté n'était pas le tien ce soir-là.
  const de = cote => (cote === e.cote ? mien : autre), contre = cote => (cote === e.cote ? autre : mien);
  return { jour: e.jour, n: e.n, cote: e.cote, win: e.win, gf: e.gf, ga: e.ga, adv: c ? c.team : null, gardien: mien(e.gardien),
    feuille: { buts: f.buts.map(b => ({ ...b, marqueur: de(b.cote)(b.marqueur), passeurs: b.passeurs.map(de(b.cote)), gardien: contre(b.cote)(b.gardien) })),
      punitions: f.punitions.map(x => ({ ...x, joueur: de(x.cote)(x.joueur) })), physique: f.physique.map(x => ({ ...x, joueur: de(x.cote)(x.joueur), cible: contre(x.cote)(x.cible) })),
      pieces: f.pieces, relais: f.relais, alignes: { A: f.alignes.A.map(de('A')), B: f.alignes.B.map(de('B')) }, gardienA: de('A')(f.gardienA), gardienB: de('B')(f.gardienB),
      lancers: (f.lancers || []).map(([cote, g]) => ({ cote, gardien: contre(cote)(g) })) } };
}
/* Ton club, rebâti de l'effectif : la même infirmerie, le même journal, ton coach et son banc. */
export function rebatir(S) {
  const R = S.R, avant = S.toi;
  const toi = createTeam('Ton club', 'YOU', S.roster, { isPlayer: true });
  toi.courbe = true;
  toi.luck = 0;
  toi.perso = { cle: R.coach.cle, banc: R.banc.slice(), maitrise: R.coach.maitrise || 1, ...(R.coach.n ? { chef: R.coach } : {}) };
  toi.injured = avant ? avant.injured : S.blesses;
  toi.journal = S.journal;
  // Ce qu'une histoire a posé (js/greffes.js `appliquerChoix`) suit le club : ses effets sur un joueur, ses absents, ses paris.
  for (const k of ['effetsCibles', 'paris', 'suivis', 'retours', 'injuriesLog']) toi[k] = (avant && avant[k]) || (k === 'effetsCibles' ? S.effets : k === 'injuriesLog' ? S.blessures || [] : []);
  toi.absents = (avant && avant.absents) || S.absents;
  toi._filetMatch = (avant && avant._filetMatch) || R.filet || 'partant';
  if (S.robotDuel) toi.robotDuel = S.robotDuel;
  // Les sonnés d'une élite perdue (js/sim.js `SONNE`) : un effet d'équipe, compté en matchs joués.
  toi.jourCourant = R.matchs.length;
  toi.effets = R.sonnes > 0 ? [{ debut: 0, fin: R.matchs.length + R.sonnes, source: 'miniboss', nom: SONNE.nom, ico: SONNE.ico, finition: SONNE.finition }] : [];
  S.toi = toi;
  return toi;
}

/* ---------- la carte de l'acte ---------- */
const clubDe = (S, x) => (x ? S.clubs.find(c => c.s === x.s && c.t === x.t) || null : null);
/* Le rival d'un acte : un club autour de son rang (`RIVAUX`, décalé), tiré de la graine. */
function rivalDe(S, a) {
  const cible = Math.min(1, RUN.RIVAUX[a] + RUN.DECALAGE), n = S.clubs.length;
  const k = Math.round(cible * (n - 1)), autour = S.clubs.slice(Math.max(0, k - 4), Math.min(n, k + 5));
  return pigeDans(autour, S.R.graine, 'rival', a);
}
/* Ce qu'une victoire paie contre ce club : du bas au haut de la bande des affiches. */
function jetonsDuMatch(club, [bas, haut]) {
  const [a, b] = RUN.JETONS_DU_MATCH;
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, (club.rang - bas) / ((haut - bas) || 1))));
}
/*
 * LA CARTE D'UN ACTE : sept rangs de bas en haut (`LARGEURS`), cinq de matchs et deux d'arrêts, puis le rival. Un rang de
 * matchs a toujours une affiche du bas de la bande et une du haut ; aux actes II et III, une case du troisième rang est une
 * élite. Aucun club deux fois sur la carte. Une case : { sorte, s, t, haute, visiteur, jetons }.
 */
function carteDeLActe(S, a) {
  const g = S.R.graine, bande = decale(RUN.BANDES[a]), mid = (bande[0] + bande[1]) / 2;
  // Aucune franchise deux fois sur la carte : trois écussons des Oilers de trois saisons se lisaient comme le même club.
  const rival = rivalDe(S, a), pris = new Set([rival.t]);
  const pool = dansLaBande(S.clubs, bande);
  const tirer = (haute, ...mots) => {
    const l = pool.filter(c => (haute ? c.rang > mid : c.rang <= mid) && !pris.has(c.t));
    const c = pigeDans(l.length ? l : pool.filter(x => !pris.has(x.t)), g, 'affiche', a, ...mots);
    pris.add(c.t);
    return c;
  };
  const rangs = LARGEURS.map((n, r) => {
    if (RANGS_D_ARRETS.includes(r)) return melange(ARRETS, g, 'arrets', a, r).map(sorte => ({ sorte }));
    // Un du bas, un du haut ; le troisième d'un rang de trois, au hasard ; l'ordre des côtés aussi.
    const hautes = melange(n === 2 ? [false, true] : [false, true, hache(g, 'tiers', a, r) < 0.5], g, 'cotes', a, r);
    return hautes.map((haute, i) => {
      const c = tirer(haute, r, i);
      return { sorte: 'match', s: c.s, t: c.t, haute: c.rang > mid, visiteur: hache(g, 'lieu', a, r, i) < 0.5, jetons: jetonsDuMatch(c, bande) };
    });
  });
  if (a > 0) {
    const elites = dansLaBande(S.clubs, RUN.ELITE).filter(c => !pris.has(c.t));
    const c = elites.length ? pigeDans(elites, g, 'elite', a) : null, i = hache(g, 'elite-cote', a) < 0.5 ? 0 : 1;
    if (c) rangs[RANG_DE_L_ELITE][i] = { sorte: 'elite', s: c.s, t: c.t, haute: true, visiteur: hache(g, 'elite-lieu', a) < 0.5, jetons: 0 };
  }
  return { rangs, rival: { sorte: 'rival', s: rival.s, t: rival.t, haute: true, visiteur: a === 1, jetons: RUN.JETONS_DU_RIVAL } };
}
/* Les cases du rang suivant qu'une case touche : deux pour une case d'un rang de deux, une ou deux d'un rang de trois. */
export const suivantes = (r, i) => (LARGEURS[r] === 2 ? [i, i + 1] : [i - 1, i].filter(k => k >= 0 && k < LARGEURS[r + 1]));
/* Les cases offertes : tout le premier rang, puis celles que ta case touche ; au sommet, le rival. Rend des indices. */
export function casesOffertes(S) {
  const R = S.R;
  if (R.rang >= RANG_DU_RIVAL) return [0];
  return R.rang === 0 || R.ou == null ? Array.from({ length: LARGEURS[0] }, (_, i) => i) : suivantes(R.rang - 1, R.ou);
}
export const caseA = (S, r, i) => (r >= RANG_DU_RIVAL ? S.R.carte.rival : S.R.carte.rangs[r][i]);
function ouvrirLActe(S, a) {
  const R = S.R;
  Object.assign(R, { acte: a, pts: 0, rang: 0, ou: null, case: null, chemin: [], carte: carteDeLActe(S, a), phase: 'annonce', portes: null, apres: null });
}

/* ---------- les clubs lus : son jeu, son intention, pour le battre ---------- */
/*
 * LE JEU D'UN CLUB (js/actes.js `jeuDuRival`) : trois lignes de vraies stats, son rang et le tien parmi les clubs de SA
 * saison ; son style en un mot ; pour un duel, son intention dominante et les pièces qui lui répondent.
 */
export function jeuDe(S, x) {
  const club = clubDe(S, x);
  if (!club) return null;
  const ligue = S.clubs.filter(c => c.s === club.s).map(c => c.team);
  const jeu = jeuDuRival([...ligue, S.toi], S.toi, club.team);
  const fortes = lignesFortes(jeu, ligue.length + 1);
  return { ...jeu, fortes, dominante: dominanteDe(jeu, S.R.graine, S.R.acte, club.team), contre: piecesContre(fortes) };
}

/* ---------- le match ---------- */
/* L'adversaire de la case en cours, habillé de ses étapes d'édition le temps d'un match, puis rendu : ses joueurs sont ceux des portes. */
const etapeDe = R => RUN.ETAPES[R.phase === 'series' || (R.case && R.case.sorte === 'serie') ? 3 : R.acte];
const habiller = (t, e) => { if (e > 0) habillerLaLigue([t], 0, v, e); };
const deshabiller = t => { for (const p of Object.values(t.roster)) if (p) delete p._carte; };
function fraisEtSain(t) {
  for (const s of SLOTS) { const p = t.roster[s.i]; if (p) { p.energie = 100; delete p._reserve; } }
  if (t.injured) t.injured.clear();
}
const estUnDuel = c => ['rival', 'elite', 'serie'].includes(c.sorte);
/* La clé des dés d'un match : son acte et son rang, ou sa ronde, son essai et son numéro. */
function cleDuMatch(R) {
  const c = R.case;
  if (c.sorte === 'serie') return `s${R.series.ronde}e${R.series.essai}g${R.series.w + R.series.l}`;
  return c.sorte === 'rival' ? `rival${R.acte}` : `a${R.acte}r${R.rang}`;
}
/*
 * TA CHANCE CE SOIR (la jauge de la feuille du soir, le seul endroit où elle se montre) : `n` matchs du moteur, tes jambes et
 * ton infirmerie telles quelles, l'adversaire frais et habillé. Rend { v, n } ; l'écran l'appelle par tranches (`tranche`).
 */
export function chanceCeSoir(S, { n = 40, tranche = 0 } = {}) {
  const R = S.R, adv = clubDe(S, R.case).team, e = etapeDe(R);
  fraisEtSain(adv); habiller(adv, e);
  S.toi.jourCourant = R.matchs.length;
  effetsDesJoueurs(S.toi, R.matchs.length);
  const A = R.case.visiteur ? adv : S.toi, B = R.case.visiteur ? S.toi : adv;
  const vA = chanceDUnSoir({ A, B, n, graine: `chance:${R.graine}:${cleDuMatch(R)}:${tranche}` });
  deshabiller(adv);
  return { v: R.case.visiteur ? n - vA : vA, n };
}
/* Leur intention annoncée et les plans que ton banc propose se lisent par js/impact.js `plansDuDuel` (l'écran) ; ici, leur jeu du duel. */
export const intentionCeSoir = (S, dominante) => leurJeuDuDuel(S.toi, clubDe(S, S.R.case).team, { graine: `run:${S.R.graine}`, cle: cleDuMatch(S.R), dominante });
/*
 * JOUER LE MATCH de la case en cours. `plan` (un duel) : absent, le robot du club choisit ; null, Ton match ; sinon le plan
 * pris ({ cle, force, vise }). Rien n'est encore compté : `conclure` le fera (quitter avant rejoue le même match).
 * Rend { gagne, ot, gf, ga, feuille, cote, adv }.
 */
export function jouerLeMatch(S, { plan, dominante = null } = {}) {
  const R = S.R, c = R.case, club = clubDe(S, c), adv = club.team, cle = cleDuMatch(R);
  fraisEtSain(adv); habiller(adv, etapeDe(R));
  S.toi.jourCourant = R.matchs.length;
  effetsDesJoueurs(S.toi, R.matchs.length);
  let res;
  if (estUnDuel(c)) {
    const moment = c.sorte === 'serie' ? { serie: true, ronde: R.series.ronde + 1 } : null;
    const r = avecHasardIsole(`run:${R.graine}:${cle}`, () => simulerGrosMatch(S.toi, adv, { graine: `run:${R.graine}`, cle, moment, plan, dominante, visiteur: !!c.visiteur, frais: false }));
    res = { gagne: r.gagne, ot: !!r.feuille.ot, gf: r.gf, ga: r.ga, feuille: r.feuille };
  } else {
    const f = feuilleVierge();
    const r = avecHasardIsole(`run:${R.graine}:${cle}`, () => playGame(c.visiteur ? adv : S.toi, c.visiteur ? S.toi : adv, 1, false, false, f));
    res = { gagne: r.winner === S.toi, ot: !!r.ot, gf: c.visiteur ? r.gfB : r.gfA, ga: c.visiteur ? r.gfA : r.gfB, feuille: f };
  }
  deshabiller(adv);
  return { ...res, cote: c.visiteur ? 'B' : 'A', adv: club };
}
/* Les pièces de ton banc qui ont joué ce soir (à la feuille, ou en relais). */
const piecesJouees = (f, cote) => [...new Set([...(f.pieces || []), ...(f.relais || [])].filter(x => x.cote === cote && PIECES[x.cle]).map(x => x.cle))];
/*
 * CONCLURE : le match compte. Les points vers la cible (le rival double), les jetons (la victoire, la règle du coach), l'usure
 * des jambes, le journal du club ; une défaite donne une relance. Puis la phase d'après : les portes ; au rival, la fin de
 * l'acte ; en séries, la série.
 */
export function conclure(S, res) {
  const R = S.R, c = R.case, f = res.feuille, rival = c.sorte === 'rival', serie = c.sorte === 'serie';
  const pts = serie ? 0 : (res.gagne ? 2 : res.ot ? 1 : 0) * (rival ? 2 : 1);
  let jetons = serie ? 0 : res.gagne ? c.jetons : res.ot ? JETONS.prolongation : JETONS.defaite;
  // L'élite (js/actes.js) : sa récompense suit ta chance, lue avant le match ; perdue, la moitié en jetons et les sonnés.
  if (c.sorte === 'elite') jetons = res.gagne ? c.J : -Math.min(R.jetons, perteDeLElite(c.J));
  const regle = REGLES_DU_COACH[R.coach.cle];
  const prime = !serie && regle && R.primeCoach < PRIME_COACH_MAX && regle.lit(chiffresDuSoirDe(f, res.cote)) ? Math.min(regle.jetons, PRIME_COACH_MAX - R.primeCoach) : 0;
  R.pts += pts; R.jetons += jetons + prime; R.primeCoach += prime;
  if (!res.gagne) R.relances++;
  if (R.sonnes > 0) R.sonnes--;
  if (c.sorte === 'elite' && !res.gagne) R.sonnes = SONNES_ELITE;
  // Les jambes : ceux qui ont joué paient leur soir (le match s'est joué sans compte, `track` faux).
  depenserEnergie(S.toi, activeLineup(S.toi));
  const marqueurs = new Map();
  for (const b of f.buts || []) if (b.cote === res.cote && !b.fusillade && b.marqueur) marqueurs.set(b.marqueur, (marqueurs.get(b.marqueur) || 0) + 1);
  const [etoile, buts] = [...marqueurs].sort((a, b) => b[1] - a[1])[0] || [];
  const n = R.matchs.length;
  S.journal.push({ feuille: f, jour: n, n: n + 1, cote: res.cote, win: res.gagne, gf: res.gf, ga: res.ga, adv: res.adv.team, gardien: res.cote === 'A' ? f.gardienA : f.gardienB });
  R.matchs.push({ s: c.s, t: c.t, sorte: c.sorte, acte: R.acte, gagne: res.gagne, ot: res.ot, gf: res.gf, ga: res.ga, visiteur: !!c.visiteur });
  // Une blessure de ce soir se date en matchs de la run (le moteur la datait d'un club qui ne compte pas ses matchs) : les faits d'une histoire la lisent.
  for (const b of S.toi.injuriesLog || []) if (!b.run) { b.at = R.matchs.length; b.run = true; }
  R.apres = { gagne: res.gagne, ot: res.ot, gf: res.gf, ga: res.ga, pts, jetons, prime, s: c.s, t: c.t, sorte: c.sorte, visiteur: !!c.visiteur,
    pieces: piecesJouees(f, res.cote), tirs: [tirsTotal(f, res.cote), tirsTotal(f, res.cote === 'A' ? 'B' : 'A')],
    ...(etoile && buts >= 2 ? { etoile: { n: etoile.n, buts } } : {}) };
  rebatir(S);
  if (serie) return conclureLaSerie(S, res);
  if (rival) return conclureLActe(S, res);
  const bande = RUN.BANDES[R.acte];
  // L'élite gagnée laisse une pièce parmi trois (l'écran la règle avant les portes, `pieceReglee`).
  if (c.sorte === 'elite' && res.gagne) R.apres.offertes = piecesOffertes(S.toi.perso, R.graine, `elite${R.acte}`);
  ouvrirLesPortes(S, { bande: res.gagne && c.haute ? [bande[1] - 0.1, Math.min(1, bande[1] + 0.15)] : bande, affronte: c, cle: `a${R.acte}r${R.rang}` });
  R.phase = 'portes';
  figer(S);
  return R.phase;
}
/* La fin d'un acte : la cible tenue ou non, le cœur, le rival ; les médailles de l'acte. Le rival battu laisse une pièce parmi trois. */
function conclureLActe(S, res) {
  const R = S.R, a = R.acte, tenu = R.pts >= RUN.CIBLES[a];
  const medailles = RUN.MEDAILLES_ACTE_JOUE + (tenu ? MEDAILLES_ACTE.passe - RUN.MEDAILLES_ACTE_JOUE : 0) + (res.gagne ? MEDAILLES_ACTE.rival : 0);
  if (!tenu && a < ACTES - 1) R.coeurs--;
  const fin = !tenu && (a === ACTES - 1 || R.coeurs <= 0) ? (a === ACTES - 1 ? 'cible' : 'coeurs') : null;
  R.actes.push({ pts: R.pts, cible: RUN.CIBLES[a], tenu, rival: res.gagne, s: R.case.s, t: R.case.t, gf: res.gf, ga: res.ga, medailles, coeur: !tenu && a < ACTES - 1 });
  R.apres = { ...R.apres, acte: true, tenu, fin,
    offertes: !fin && res.gagne ? piecesOffertes(S.toi.perso, R.graine, `rival${a}`, RUN.PORTES, { voisines: true }) : [] };
  R.phase = 'finacte';
  figer(S);
  return R.phase;
}
/* Après la fin d'acte (la pièce prise ou passée) : la run finit, ou les portes du rival s'ouvrent. */
export function apresLaFinDActe(S) {
  const R = S.R, a = R.acte, x = R.actes[a];
  if (R.apres.fin) return finir(S, R.apres.fin);
  ouvrirLesPortes(S, { bande: x.rival ? [Math.min(0.9, RUN.RIVAUX[a]), 1] : RUN.BANDES[a], affronte: R.carte.rival, cle: `rival${a}` });
  R.phase = 'portes';
  figer(S);
  return R.phase;
}

/* ---------- les portes et la signature ---------- */
/*
 * OUVRIR LES PORTES : `PORTES` vrais vestiaires de la bande, dont toujours le club affronté (le camp n'en a pas) ; jamais
 * deux fois le même. `R.portes` : { clubs: [{ s, t }], bande, cle, tour } ; `tour` monte à chaque relance.
 */
function ouvrirLesPortes(S, { bande, affronte = null, cle, tour = 0 }) {
  const R = S.R, a = affronte && tour === 0 ? clubDe(S, affronte) : null;
  const pris = new Set(a ? [cleDuClub(a)] : []), clubs = a ? [a] : [];
  const pool = dansLaBande(S.clubs, bande);
  for (let k = 0; clubs.length < RUN.PORTES && k < 40; k++) {
    const c = pigeDans(pool, R.graine, 'porte', cle, tour, k);
    if (c && !pris.has(cleDuClub(c))) { pris.add(cleDuClub(c)); clubs.push(c); }
  }
  R.portes = { clubs: clubs.map(c => ({ s: c.s, t: c.t })), bande, cle, tour, affronte: a ? cleDuClub(a) : null };
}
/* Qui peut sortir pour lui : ceux de son groupe (avant, défenseur, gardien). */
export const sortantsPour = (S, p) => CASES.map(s => S.roster[s.i]).filter(x => x && groupeDe(x) === groupeDe(p));
/* Ta masse si `p` entre et `sortant` part : la part `RACHAT` de son salaire se libère, le reste reste au plafond. */
export const masseApres = (S, p, sortant) => masseDe(S) - RUN.RACHAT * prixDe(S, sortant) + prixDe(S, p);
/* Il tient dans ton espace s'il existe quelqu'un de son groupe dont la sortie le fait passer sous le plafond. */
export const tient = (S, p) => sortantsPour(S, p).some(x => masseApres(S, p, x) <= S.R.plafond);
/*
 * LE VESTIAIRE D'UNE PORTE : ses joueurs que tu n'as jamais eus (aucun joueur deux fois dans la run), les plus forts
 * d'abord ; `tient` dit qui passe sous ton plafond. Le tri lit la valeur du moteur, l'écran ne la montre pas.
 */
export function vestiaireDe(S, x) {
  const club = clubDe(S, x), vus = new Set(S.R.vus);
  return (club ? club.pool : S.pochette || []).filter(p => !vus.has(getPersonKey(p))).sort((a, b) => v(b) - v(a)).map(p => ({ p, tient: tient(S, p) }));
}
/* Ranger tes trios et tes paires du plus fort au moins fort : l'ordre n'est pas un choix (mesuré, tranche 0), leur composition, oui. */
function rangerLesUnites(roster) {
  for (const [g, n] of [['F', 4], ['D', 3]]) {
    const unites = Array.from({ length: n }, (_, u) => HABILLES.filter(s => s.group === g && s.unit === u));
    const contenu = unites.map((cases, u) => ({ u, ps: cases.map(s => roster[s.i]) })).map(x => ({ ...x, v: x.ps.reduce((a, p) => a + (p ? v(p) : 0), 0) }));
    contenu.sort((a, b) => b.v - a.v || a.u - b.u).forEach((x, u) => unites[u].forEach((s, k) => { roster[s.i] = x.ps[k]; }));
  }
}
/*
 * SIGNER : l'arrivant prend la case de celui qui sort ; la moitié du salaire de celui-ci reste au plafond pour la run
 * (`R.mort`). `auMieux` (les robots) : tout l'alignement refait par `autoRoster`. Rend faux si le plafond ne tient pas.
 */
export function signer(S, p, sortant, { auMieux = false } = {}) {
  const R = S.R, cas = CASES.find(s => S.roster[s.i] === sortant);
  if (!cas || groupeDe(p) !== groupeDe(sortant) || masseApres(S, p, sortant) > R.plafond) return false;
  const neuf = copie(p);
  neuf.energie = 100;
  R.mort += (1 - RUN.RACHAT) * prixDe(S, sortant);
  S.roster[cas.i] = neuf;
  S.toi.injured.delete(sortant);
  R.vus.push(getPersonKey(p));
  R.anciens.push(getPlayerKey(sortant));
  if (auMieux) { const r = autoRoster(Object.values(S.roster).filter(Boolean)); for (const s of CASES) S.roster[s.i] = r[s.i] || null; }
  else rangerLesUnites(S.roster);
  rebatir(S);
  return true;
}
/* La pièce offerte (le rival battu, l'élite gagnée) est prise ou passée. */
export function pieceReglee(S) { if (S.R.apres) S.R.apres.offertes = []; figer(S); }
/* Passer une porte paie ; relancer coûte une relance et tire trois autres vestiaires de la même bande. */
export function passerLesPortes(S) { S.R.jetons += RUN.PASSER; }
export function relancerLesPortes(S) {
  const R = S.R, P = R.portes;
  if (!P || R.relances <= 0) return false;
  R.relances--;
  ouvrirLesPortes(S, { bande: P.bande, cle: P.cle, tour: P.tour + 1 });
  figer(S);
  return true;
}
/*
 * APRÈS LES PORTES (signé ou passé) : le camp continue ou l'acte I s'ouvre ; une case jouée, la suivante (un jour de repos
 * entre deux cases) ; après le rival, l'acte suivant, ou les séries.
 */
export function apresLesPortes(S) {
  const R = S.R;
  R.portes = null; S.pochette = null;
  if (R.phase === 'camp' || R.camp < RUN.CAMP) {
    R.camp++;
    if (R.camp < RUN.CAMP) { ouvrirLesPortes(S, { bande: RUN.BANDE_DU_CAMP, cle: `camp${R.camp}` }); R.phase = 'camp'; } else ouvrirLActe(S, 0);
  } else if (R.case && R.case.sorte === 'rival') {
    recupererEnergie(S.toi);
    if (R.acte < ACTES - 1) ouvrirLActe(S, R.acte + 1); else ouvrirLesSeries(S);
  } else if (R.marche) R.phase = 'marche';
  else avancer(S);
  figer(S);
  return R.phase;
}
/* La case est faite : un jour de repos, et le rang suivant s'offre. */
export function avancer(S) {
  const R = S.R;
  recupererEnergie(S.toi);
  R.chemin = [...(R.chemin || []), R.ou];
  Object.assign(R, { rang: R.rang + 1, case: null, apres: null, marche: null, phase: 'carte' });
  figer(S);
}
/* Toucher une case offerte : sa scène s'ouvre (la feuille du soir, le marché, le vestiaire, l'histoire). */
export function allerA(S, i) {
  const R = S.R;
  if (!casesOffertes(S).includes(i)) return false;
  const c = caseA(S, R.rang, i);
  R.ou = i; R.case = { ...c };
  if (c.sorte === 'marche') { R.marche = { pieces: piecesOffertes(S.toi.perso, R.graine, `marche${R.acte}:${R.rang}`), piece: false, pochettes: [] }; R.phase = 'marche'; }
  else R.phase = ['vestiaire', 'histoire'].includes(c.sorte) ? c.sorte : 'feuille';
  figer(S);
  return true;
}
/* L'élite : sa récompense se fixe sur ta chance lue à la feuille du soir (`recompenseDeLElite`). */
export function fixerLElite(S, chance) { if (S.R.case && S.R.case.sorte === 'elite' && S.R.case.J == null) { S.R.case.J = recompenseDeLElite(chance); figer(S); } }

/* ---------- les Lignes ---------- */
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
 * à sa place), moins ceux qu'elle a déjà. Rend { plus: [accords neufs], moins: [accords perdus là-bas] }, ou null si l'échange ne tient pas.
 */
export function siTenu(S, i, j) {
  const a = CASES.find(s => s.i === i), b = CASES.find(s => s.i === j), pa = S.roster[i], pb = S.roster[j];
  if (!a || !b || i === j || !pa || !fits(pa, b) || (pb && !fits(pb, a))) return null;
  const essai = { ...S.roster, [i]: pb, [j]: pa };
  const noms = (r, s) => (s.scratch || s.group === 'G' ? [] : accordsDeLigne(r, s.group === 'F' ? s.unit : Math.min(2, s.unit)).map(x => x.aff.cle));
  const avantB = noms(S.roster, b), apresB = noms(essai, b), avantA = noms(S.roster, a), apresA = noms(essai, a);
  return { plus: apresB.filter(k => !avantB.includes(k)), moins: avantA.filter(k => !apresA.includes(k)) };
}
/* Ton gardien du soir : le partant ou l'auxiliaire (js/sim.js `pickGoalie` lit `_filetMatch`). */
export function choisirLeFilet(S, qui) { S.toi._filetMatch = qui === 'aux' ? 'aux' : 'partant'; figer(S); }

/* ---------- le marché, le vestiaire ---------- */
/* La pièce de banc du marché : une seule, une parmi trois ; banc plein, `sort` part. */
export function acheterLaPiece(S, cle, sort = null) {
  const R = S.R, M = R.marche;
  if (!M || M.piece || !M.pieces.includes(cle) || R.jetons < PRIX_PIECE || (R.banc.length >= CASES_DU_BANC && !R.banc.includes(sort))) return false;
  R.jetons -= PRIX_PIECE; M.piece = true;
  R.banc = poserLaPiece(R.banc, cle, sort);
  rebatir(S); figer(S);
  return true;
}
/* Une pièce gagnée (le rival battu, l'élite, une histoire) : elle entre sur le banc ; plein, `sort` part. */
export function prendreLaPiece(S, cle, sort = null) {
  const R = S.R;
  if (!PIECES[cle] || (R.banc.length >= CASES_DU_BANC && !R.banc.includes(sort))) return false;
  R.banc = poserLaPiece(R.banc, cle, sort);
  rebatir(S); figer(S);
  return true;
}
/*
 * UNE POCHETTE DU MARCHÉ : payée, ses joueurs (tirés par l'écran ou le robot, js/packs.js `tirerJoueursDuPack`) s'ouvrent
 * comme une porte : tu en signes un, ou tu passes. Une de chaque par marché.
 */
export function acheterLaPochette(S, cle, joueurs) {
  const R = S.R, M = R.marche, prix = RUN.POCHETTES[cle];
  if (!M || !prix || M.pochettes.includes(cle) || R.jetons < prix) return false;
  R.jetons -= prix; M.pochettes.push(cle);
  S.pochette = joueurs;
  R.portes = { clubs: [], pochette: cle, joueurs: joueurs.map(getPlayerKey), cle: `pochette:${R.acte}:${R.rang}:${cle}`, tour: 0 };
  R.phase = 'portes';
  figer(S);
  return true;
}
/* Le vestiaire, un des deux. Reposer : tout le monde retrouve ses jambes, et le blessé le plus long revient. */
export function reposer(S) {
  for (const p of Object.values(S.roster)) if (p) p.energie = 100;
  const long = [...S.toi.injured].sort((a, b) => b[1] - a[1])[0];
  if (long) S.toi.injured.delete(long[0]);
  avancer(S);
  return long ? long[0] : null;
}
/* Monter une carte d'une édition (js/rarete.js `EDITIONS`) : le moteur la lit dès ce soir. Rend faux à la Holo. */
export const editionDe = p => (p._carte && p._carte.rar) || EDITIONS[0];
export function monterUneCarte(S, p) {
  const k = EDITIONS.indexOf(editionDe(p));
  if (!Object.values(S.roster).includes(p) || k >= EDITIONS.length - 1) return false;
  p._carte = { rar: EDITIONS[k + 1] };
  rebatir(S);
  avancer(S);
  return true;
}

/* ---------- les histoires de la carte ---------- */
/*
 * LES FAITS DE TA RUN (js/faits.js `faitsDe`, sans ligue) : lus dans tes matchs joués (le journal du club), rien d'autre.
 */
function faitsDeLaRun(S) {
  const R = S.R;
  return faitsDe({ ligue: null, you: S.toi, jour: R.matchs.length, run: { jetons: R.jetons, coach: R.coach.cle, sorties: R.histoires, shard: s => S.donnees.shard(s) } });
}
/* Ce que la run sait jouer d'une histoire : les jetons, ce qui va au joueur nommé, le dé, les gestes du jour ; ni échange, ni pièce, ni canal de club. */
const GESTES_JOUES = ['soin', 'absents', 'energie', 'energieTous', 'gardienAux'];
const jouable = k => HISTOIRES[k].options.every(o => !o.canaux && !o.adv && !o.suite && Object.keys(o.gestes || {}).every(g => GESTES_JOUES.includes(g)));
/*
 * L'HISTOIRE D'UNE CASE (js/histoires.js `tirer`, le pool du lundi, sans son rythme) : la vraie qui tire le plus haut, ou
 * null si aucun fait n'est vrai. Rend { cle, H, f, joueur, joueurs } ; `joueur` est celui de ton club qu'elle nomme.
 */
export function histoireDeLaCase(S) {
  const f = faitsDeLaRun(S), cle = tirer(S.R.graine, 'lundi', f, S.R.histoires, { sansRythme: true, permis: jouable });
  if (!cle) return null;
  const H = HISTOIRES[cle], cles = (H.joueurs ? H.joueurs(f) : [H.joueur(f)]).filter(Boolean).map(x => x.cle);
  const auClub = k => Object.values(S.roster).find(p => p && getPlayerKey(p) === k) || null;
  return auClub(cles[0]) ? { cle, H, f, joueur: auClub(cles[0]), joueurs: cles } : null;
}
/*
 * RÉPONDRE : la décision passe par la porte du jeu (js/greffes.js `appliquerChoix`), datée en matchs joués ; ses jetons vont
 * à la caisse. Rend le dé s'il y en a un ({ gagne, face }), puis la case est faite.
 */
export function repondre(S, h, choix) {
  const R = S.R, o = h.H.options.find(x => x.cle === choix), n = R.matchs.length;
  if (!o) return null;
  const d = { jour: n, moment: { famille: 'histoire', cle: h.cle, choix, joueur: h.joueurs[0], joueurs: h.joueurs } };
  appliquerChoix(S.toi, d, R.graine);
  R.jetons = Math.max(0, R.jetons + (o.jetons || 0));
  R.histoires.push({ cle: h.cle, choix, joueur: h.joueurs[0], joueurs: h.joueurs, j: n });
  const de = o.pari ? deDuChoix(d, R.graine) : null;
  avancer(S);
  return de ? { gagne: de.gagne, face: de.face } : null;
}

/* ---------- les séries, la fin ---------- */
function ouvrirLesSeries(S) {
  const R = S.R, haut = dansLaBande(S.clubs, decale(RUN.SERIES)), pris = new Set();
  const adv = [];
  for (let k = 0; adv.length < 3 && k < 60; k++) { const c = pigeDans(haut, R.graine, 'serie', k); if (!pris.has(cleDuClub(c))) { pris.add(cleDuClub(c)); adv.push(c); } }
  adv.sort((a, b) => a.force - b.force);
  R.series = { adv: adv.map(c => ({ s: c.s, t: c.t })), ronde: 0, essai: 0, w: 0, l: 0, faites: [] };
  Object.assign(R, { phase: 'series', case: null, carte: null, apres: null });
}
/* Le prochain match de ta série : sa feuille du soir. Le premier et les matchs pairs chez toi. */
export function allerAuMatchDeSerie(S) {
  const R = S.R, x = R.series, a = x.adv[x.ronde];
  R.case = { sorte: 'serie', s: a.s, t: a.t, haute: true, visiteur: (x.w + x.l) % 2 === 1, jetons: 0 };
  R.phase = 'feuille';
  figer(S);
}
function conclureLaSerie(S, res) {
  const R = S.R, x = R.series;
  if (res.gagne) x.w++; else x.l++;
  recupererEnergie(S.toi);
  R.case = null;
  if (x.w === 3) {
    x.faites.push({ ...x.adv[x.ronde], w: x.w, l: x.l });
    Object.assign(x, { ronde: x.ronde + 1, essai: 0, w: 0, l: 0 });
    if (x.ronde === 3) return finir(S, 'coupe');
  } else if (x.l === 3) {
    // Une série perdue coûte un cœur et se rejoue une fois contre le même club ; sans cœur, la run finit.
    if (R.coeurs > 0 && x.essai === 0) { R.coeurs--; Object.assign(x, { essai: 1, w: 0, l: 0, rejouee: true }); } else return finir(S, 'serie');
  }
  R.phase = 'series';
  figer(S);
  return R.phase;
}
/*
 * LA FIN DE LA RUN : sa cause ('coeurs', 'cible' — l'acte III raté —, 'serie', 'coupe', 'quitte'), les médailles de chaque
 * acte et des séries (`ecussonsDesSeries`). Une run perdue rend ses médailles.
 */
export function finir(S, cause) {
  const R = S.R, rondes = R.series ? R.series.faites.length : 0, coupe = cause === 'coupe';
  R.fin = { cause, rondes, coupe, medailles: R.actes.reduce((a, x) => a + x.medailles, 0) + ecussonsDesSeries(rondes, coupe), matchs: R.matchs.length };
  R.phase = 'fin';
  figer(S);
  return R.phase;
}
/* Un jour de repos de plus (une histoire, le marché) ne se compte pas ici : `avancer` le donne à chaque case. */
export const forceDe = S => force(S.toi);
