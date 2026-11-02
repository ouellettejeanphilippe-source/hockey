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
 * lotos de l'équipe finie (1.0, `gardesDeLaRun`) — jusqu'à la
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
 *     joue ce que l'adjoint jouerait (scripts/lib/duel.mjs) ; chaque soir, son plan
 *     de match (V17) : contre chaque club, celui qui rend le plus de buts nets
 *     lus au moteur (`planDuRobot`) ; à la boutique, le pack qui rend le plus
 *     par jeton (`packLu`, nov. 2026) ;
 *   - 'distrait' : il clique sans lire. Un coach au hasard ; une carte du pack au hasard, et qui
 *     sort au hasard (le nouveau prend sa case) ; aux gros matchs et en séries, une réponse sur deux et une
 *     main jouable au hasard ; un plan de match au hasard chaque soir ; des rivaux, des gardés et des lotos au hasard. Ses
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
  SLOTS, autoRoster, registerHiddenRatings, retenirMatchsDuShard, getHiddenRatings, getPositionPenalty, getPlayerKey, getPersonKey,
  createTeam, creerLigue, jouerJournee, bilanLigue, creerSeries, jouerMatchSeries, connaitre, photoAlignement,
  batirLesClubs, rivauxOfferts, RIVAUX, avecHasardIsole, activeLineup, PLANS,
} from '../../js/sim.js';
import { ADJOINTS, SEJOUR, SEJOUR_SYNERGIE } from '../../js/adjoints.js';
import { robotDuel } from './duel.mjs';
import { lundiDuRobot, coachDuRobot } from './cartes_robot.mjs';
import { niveauDuPerso, POUVOIRS, grandir } from '../../js/pouvoirs.js';
import { lotoDesCoachs } from '../../js/coachs-reels.js';
import { galonsDeLaSaison, GALONS_MAX } from '../../js/galons.js';
import { alignementAuMieux, chiffresDuSoir, chiffresDuSoirSous, planEnChiffres } from '../../js/impact.js';
import { carteDe, varianteTiree, COTES_VARIANTES, EDITIONS } from '../../js/rarete.js';
import { TIERS, PACKS_JOUEURS, SKILLS, hausseDesPacks, packDeSerie, tierDuPack, niveauxDuPack } from '../../js/packs.js';
import { niveauDe, NIVEAUX, joueursParNiveau } from '../../js/niveaux.js';
import {
  JETONS, jetonsDeDepart, gardesDeLaDerniere, aDebloque, plafondDuVestiaire, ecussonsDeLaSaison, ecussonsDesSeries,
  DEBLOCAGES, departDuClasseur, lotosDeSaison, lotoDeCase, tirageDuClasseur, budgetDuClasseur, reservesDeLaRun, PLAFOND_ROGUE, ESPACE_DE_DEPART, jalonsAtteints, mandatRempli, baremeRogue, primesDesFils,
  soutiensDuDepart, tirageDuDepart, rangDePrestige, PRESTIGES, PRIME_DECOUVERTE, coachsOuverts, exigencesDe, plafondDeSaison, gardesDeLaRun,
  NIVEAUX_PLEINS, niveauDeLigue, habillerLaLigue, etapeDeLaRun,
  packsOuverts, monteeDesPacks,
  bouchesTrousDuDepart, vedettesDeConcession, alourdirLaPremiere, VRAIS_CONTRATS, PLAFOND_PREMIERE,
} from '../../js/rogue.js';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIR = path.join(ROOT, 'data', 'seasons');
// Les saisons du jeu sont celles de l'index (scripts/build_shards.py `saison_jouable`) : la saison en cours n'y entre qu'à la mi-saison.
export const SAISONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')).seasons;
/* Les vrais entraîneurs (data/coachs.json, scripts/coachs.mjs) : le loto du départ d'une run. */
const COACHS_REELS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coachs.json'), 'utf8'));
const CACHE = new Map();
export function shard(s) {
  if (!CACHE.has(s)) {
    const e = JSON.parse(fs.readFileSync(path.join(DIR, `${s}.json`), 'utf8'));
    e.players.forEach(registerHiddenRatings);
    retenirMatchsDuShard(e);
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
 * LES PLOMBIERS (js/rogue-jeu.js `plombiersDeLaLigue`) : huit saisons, et la composition du départ
 * (js/rogue.js `bouchesTrousDuDepart`) — peu de bons, quelques entre-deux, beaucoup de faibles ; les défenseurs et les
 * gardiens par leur valeur, les attaquants par leurs points, les pires contrats de chaque bande.
 */
function plombiers(rnd, meta, exclus, reserve = null) {
  // Une `reserve` à remplir, c'est la première run (js/rogue-jeu.js `equipeDeLaPremiere`) : de vrais contrats seulement.
  const vrais = !!reserve;
  const saisons = SAISONS.filter(s => !vrais || s >= VRAIS_CONTRATS), choisies = [];
  while (choisies.length < 8) choisies.push(saisons.splice(Math.floor(rnd() * saisons.length), 1)[0]);
  return bouchesTrousDuDepart(choisies.map(s => shard(s).players.filter(p => !vrais || p.isReal)), { groupe, valeur: v, personne: getPersonKey, exclus, plus: aDebloque(meta, 'plombiersPlus'),
    reserve, piger: liste => liste[Math.floor(rnd() * liste.length)] }).map(copie);
}
/*
 * TON JOUEUR DE CONCESSION (js/rogue.js `vedettesDeConcession`) : trois offerts une fois, à la première run ; le robot
 * prend celui qui vaut le plus (le distrait, au hasard). Sa clé au méta ; il revient à chaque départ.
 */
function vedetteDuRobot(rnd, meta, clic) {
  if (meta.vedette) { const [s] = meta.vedette.split('_'); return shard(s).players.find(p => getPlayerKey(p) === meta.vedette) || null; }
  const saisons = SAISONS.slice(), candidats = [];
  for (let i = 0; i < 8; i++) { const e = shard(saisons.splice(Math.floor(rnd() * saisons.length), 1)[0]); for (const p of e.players) candidats.push({ p, niveau: niveauDe(p, e.players) }); }
  const offerts = vedettesDeConcession(candidats, { personne: getPersonKey, piger: l => l[Math.floor(rnd() * l.length)] });
  const p = clic ? offerts[Math.floor(clic() * offerts.length)] : offerts.slice().sort((a, b) => v(b) - v(a))[0];
  if (p) meta.vedette = getPlayerKey(p);
  return p || null;
}

/*
 * 31 vrais clubs, comme `buildOpponents` : un club-saison entier, aligné par `autoRoster`, sans tes joueurs
 * (`batirLesClubs`, js/sim.js). LA LIGUE QUI MONTE (tranche 8, js/rogue.js `ligueDe`) : passé les premiers niveaux,
 * leurs cartes montent d'édition (`habillerLaLigue`).
 */
function adversaires(rnd, exclus, n = 31, niveau = NIVEAUX_PLEINS, etapeDeRun = 0) {
  const cands = [], vus = new Set();
  while (cands.length < n) {
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = Object.keys(e.byTeam);
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${e.season}|${tag}`)) continue;
    const pool = e.byTeam[tag];
    if (pool.filter(p => groupe(p) === 'F').length < 12 || pool.filter(p => groupe(p) === 'D').length < 6 || pool.filter(p => p.p === 'G').length < 2) continue;
    vus.add(`${e.season}|${tag}`);
    cands.push({ season: e.season, team: tag, pool: pool.map(copie) });
  }
  const ligue = batirLesClubs(cands, exclus);
  for (const t of ligue) { for (const p of Object.values(t.roster)) if (p) exclus.add(getPersonKey(p)); for (const p of t.ecole) exclus.add(getPersonKey(p)); }
  habillerLaLigue(ligue, niveau, v, etapeDeRun);
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
/*
 * MESURE seulement (check_profondeur, l'ablation ; jamais lu par le jeu) : ROBOT_SAUF=plan,net,duel,aumieux,coach,lundi,fit,boutique —
 * ce que l'attentif NE fait PAS dans cette mesure, pour trouver d'où vient son avance (ou son retard) sur le robot d'avant,
 * un geste à la fois, sur les mêmes dés. ROBOT_COACH=essaim force la philosophie du coach de l'attentif, pour mesurer ce
 * que chaque coach vaut à son club.
 */
const SAUF = new Set((process.env.ROBOT_SAUF || '').split(',').filter(Boolean));
const attentifFait = quoi => !SAUF.has(quoi);
const COACH_FORCE = process.env.ROBOT_COACH || null;
/* L'attentif lit le moteur, l'affinité de ses lignes comprise (V18). */
const auMieux = joueurs => alignementAuMieux(joueurs, { plan: true });
/* Les buts nets par match d'un alignement, lus au moteur — sous un hasard à part : la saison ne bouge pas d'un dé. */
const lireNet = R => avecHasardIsole('robot', () => {
  const t = createTeam('Lu', 'LU', R);
  t.courbe = true;
  const m = chiffresDuSoir(t, activeLineup(t));
  return m.butsPour - m.butsContre;
});
/*
 * CE QU'UN ADJOINT RAPPORTE À CET EFFECTIF (31 oct. 2026 ; docs/decisions.md ; V22). Un adjoint est un style, « ni cadeau
 * ni piège » sur un club ordinaire : il paie quand le style va à ton club. L'attentif lisait pourtant ses adjoints dans
 * un ordre fixe, et depuis la V21 il ne battait plus le robot d'avant (check_profondeur : +1,3 V au lieu des 6 à 7
 * d'avant). Il lit maintenant chaque style SUR SON EFFECTIF : les buts nets d'un soir avec le style posé, moins sans
 * (`chiffresDuSoirSous`, js/impact.js, les canaux du club et de l'adversaire), au prorata de son séjour : celui de la
 * voie de son coach joue plus longtemps (`SEJOUR_SYNERGIE`).
 */
function fitDAdjoint(R, k, coach) {
  const J = ADJOINTS[k];
  if (!J) return -Infinity;
  const net = effets => avecHasardIsole('robot', () => {
    const t = createTeam('Lu', 'LU', R);
    t.courbe = true;
    const m = chiffresDuSoirSous(t, effets);
    return m.butsPour - m.butsContre;
  });
  const fit = net({ effets: J.effet ? [{ source: 'adjoint', ...J.effet }] : [], effetsAdv: J.adv ? [{ source: 'adjoint', ...J.adv }] : [] }) - net({});
  return fit * (J.voie === coach ? SEJOUR_SYNERGIE : SEJOUR) / SEJOUR;
}
/*
 * LE COACH LU SUR TON CLUB (oct.). Mesuré (check_profondeur, quatre graines, huit clubs) : l'attentif qui prenait le
 * coach de la couleur de son effectif, sinon le plus haut en maîtrise, perdait 1,6 V par saison sur le robot d'avant,
 * qui prend la première carte ; forcé philosophie par philosophie, le Frelon lui rendait +6,5 V, les sept autres de
 * +1,4 à +4,0. Il lit donc chaque carte du loto comme il lit un adjoint : chaque pouvoir, ses canaux posés sur son
 * effectif à la maîtrise de la carte (`chiffresDuSoirSous`), le temps d'une période, sur chaque état du match où sa
 * condition se lit — le pointage attendu de son club (Poisson sur ses buts pour et contre, la normale sur ses tirs), un
 * soir sur deux à domicile, un sur cinq de dos-à-dos, un sur dix de gros match —, et chaque but qu'il ajoute ou retire
 * compté à ce qu'il change aux chances de gagner DANS CET ÉTAT (un but à égalité en 3e vaut ; un but quand on mène de
 * trois ne vaut rien : lu sans ce poids, l'Aigle sortait premier partout, le contraire de la mesure). Le premier pouvoir
 * entier, le deuxième à moitié, l'ultime au quart : la run n'y arrive pas toujours.
 */
const PART_DOS_A_DOS = 0.2, PART_GROS = 0.1, BUTS_LUS = 8, NULLE = 0.75;
const poisson = (l, n) => { let p = Math.exp(-l); for (let i = 1; i <= n; i++) p *= l / i; return p; };
const normale = x => 1 / (1 + Math.exp(-1.702 * x));
/* Les chances de gagner (une nulle après soixante minutes : NULLE) avant la période k, à moi-lui, sur les buts attendus par période lp et lc. */
function chancesDeGagner(lp, lc) {
  const pw = [];
  for (let k = 0; k < 3; k++) {
    pw[k] = [];
    const a = lp * (3 - k), b = lc * (3 - k);
    for (let moi = 0; moi <= BUTS_LUS + 1; moi++) {
      pw[k][moi] = [];
      for (let lui = 0; lui <= BUTS_LUS + 1; lui++) {
        let w = 0;
        for (let x = 0; x <= BUTS_LUS; x++) for (let y = 0; y <= BUTS_LUS; y++) { const d = moi + x - lui - y; if (d >= 0) w += poisson(a, x) * poisson(b, y) * (d > 0 ? 1 : NULLE); }
        pw[k][moi][lui] = w;
      }
    }
  }
  return pw;
}
/*
 * Ce que les pouvoirs d'une carte valent à ton club, en victoires par match : sur chaque état du match, ceux dont la
 * condition se lit jouent ENSEMBLE (la ruée et le bourdonnement du Frelon se cumulent en 3e ; la riposte et le tueur
 * de l'Aigle s'excluent), chacun ouvert à la chance de son niveau (`CHANCE_DU_NIVEAU`) ; les buts que le cumul ajoute
 * (`pour`) et retire (`contre`) dans la période, lus par `delta(masque)`, pesés par ce qu'un but y change aux chances
 * de gagner. Mesuré (check_pouvoirs) : seul, chaque pouvoir vaut de 1 à 2,5 V ; le personnage complet, de 5 à 9 V
 * (V22, sans bras droit) — c'est le cumul qui fait l'écart, pas un pouvoir.
 */
const CHANCE_DU_NIVEAU = [1, 0.5, 0.25];
function valeurDesPouvoirs(Ps, m, delta) {
  const lp = m.butsPour / 3, lc = m.butsContre / 3, mu = (m.tirsPour - m.tirsContre) / 3, sig = Math.sqrt((m.tirsPour + m.tirsContre) / 3);
  const pw = chancesDeGagner(lp, lc);
  let valeur = 0;
  for (let k = 0; k < 3; k++) {
    const menerAuxTirs = k ? normale(k * mu / (sig * Math.sqrt(k))) : 0, perdreLaPeriode = normale(-mu / sig);
    for (const [soir, ps] of [[{ domicile: true }, 0.5], [{ visiteur: true }, 0.5]]) for (const [dos, pd] of [[true, PART_DOS_A_DOS], [false, 1 - PART_DOS_A_DOS]])
      for (const [gros, pg] of [[true, PART_GROS], [false, 1 - PART_GROS]]) for (const [tirs, pt] of [[1, menerAuxTirs], [-1, 1 - menerAuxTirs]])
        for (const [perdu, pp] of k ? [[true, perdreLaPeriode], [false, 1 - perdreLaPeriode]] : [[null, 1]])
          for (let moi = 0; moi <= BUTS_LUS; moi++) for (let lui = 0; lui <= BUTS_LUS; lui++) {
            const w = ps * pd * pg * pt * pp * poisson(lp * k, moi) * poisson(lc * k, lui);
            if (w < 1e-6) continue;
            const e = { k, moi, lui, tirsMoi: k ? 20 + tirs : 0, tirsLui: 20, der: perdu == null ? null : { moi: 0, lui: 0, tirsMoi: perdu ? 8 : 10, tirsLui: 9 }, series: false, gros, soir: { ...soir, dosADos: dos, jambesLourdes: dos } };
            const actifs = Ps.map((P, p) => (P.quand(e) ? p : -1)).filter(p => p >= 0);
            if (!actifs.length) continue;
            const levier = d => (pw[k][moi + 1][lui] - pw[k][moi][lui]) * d.pour / 3 + (pw[k][moi][lui] - pw[k][moi][lui + 1]) * -d.contre / 3;
            // Chaque sous-ensemble des actifs, à la chance que ces niveaux-là soient ouverts et pas les autres.
            for (let t = 1; t < 1 << actifs.length; t++) {
              let chance = 1, masque = 0;
              actifs.forEach((p, i) => { const ouvert = t & (1 << i); chance *= ouvert ? CHANCE_DU_NIVEAU[p] : 1 - CHANCE_DU_NIVEAU[p]; if (ouvert) masque |= 1 << p; });
              valeur += w * chance * levier(delta(masque));
            }
          }
  }
  return valeur;
}
function fitDeCoach(R, carte) {
  const Ps = POUVOIRS[carte.cle] || [];
  // La force lue : la maîtrise de la carte (V22 : plus de bras droit).
  const f = carte.maitrise || 1;
  const lire = effets => avecHasardIsole('robot', () => {
    const t = createTeam('Lu', 'LU', R);
    t.courbe = true;
    return chiffresDuSoirSous(t, effets);
  });
  const base = lire({}), lus = new Map();
  const delta = masque => {
    if (!lus.has(masque)) {
      const effets = [], effetsAdv = [];
      Ps.forEach((P, p) => { if (!(masque & (1 << p))) return; if (P.effet) effets.push({ source: 'pouvoir', ...grandir(P.effet, f) }); if (P.adv) effetsAdv.push({ source: 'pouvoir', ...grandir(P.adv, f) }); });
      const m = lire({ effets, effetsAdv });
      lus.set(masque, { pour: m.butsPour - base.butsPour, contre: m.butsContre - base.butsContre });
    }
    return lus.get(masque);
  };
  return valeurDesPouvoirs(Ps, base, delta);
}
/* Les clics du distrait : un générateur à lui (null pour les deux autres). Les meilleurs d'abord, ou dans le désordre. */
const melanger = (l, clic) => l.map(x => [clic(), x]).sort((a, b) => a[0] - b[0]).map(y => y[1]);
const meilleursDabord = (l, clic, f = x => x) => (clic ? melanger(l, clic) : l.slice().sort((a, b) => v(f(b)) - v(f(a))));

/*
 * LES LOTOS PAR CASE DU ROBOT (js/rogue-jeu.js `lotosParCase`) : le même tirage pur, case par case ; de chaque loto,
 * il prend la carte qui vaut le plus parmi celles du niveau de la case qui tiennent dans ce qui reste du budget.
 * `cartes` : [{ p, rar? }] (une par clé) ; `personnes` : ceux qui ne reviennent pas. Rend celles prises.
 */
const niveaux = new Map();
const niveauDuRobot = p => { const k = getPlayerKey(p); if (!niveaux.has(k)) niveaux.set(k, niveauDe(p, shard(p.s).players)); return niveaux.get(k); };
function lotosParCase({ cases, vues }, cartes, graine, budget, personnes, clic) {
  const parCle = new Map(cartes.map(x => [getPlayerKey(x.p), x]));
  const pris = [];
  for (let i = 0; i < cases.length && budget > 0; i++) {
    const vus = new Set(personnes), dispo = [];
    for (const k of tirageDuClasseur([...parCle.keys()], `${graine}:c${i}`)) {
      const x = parCle.get(k), q = getPersonKey(x.p);
      if (!((x.p.$ || 0) > 0) || x.p.$ > budget || vus.has(q)) continue;
      vus.add(q); dispo.push({ ...x, niveau: niveauDuRobot(x.p) });
    }
    const [meilleure] = meilleursDabord(lotoDeCase(dispo, cases[i], vues).cartes, clic, y => y.p);
    if (!meilleure) continue;
    pris.push(meilleure); personnes.add(getPersonKey(meilleure.p)); budget -= meilleure.p.$ || 0;
  }
  return pris;
}
/* Les cartes du classeur au départ : ses cases, du plus haut niveau au plus bas, chacune un loto de son cartable. */
const tirerClasseur = (meta, classeur, exclus, graine, clic = null, exigence = 0) =>
  lotosParCase(departDuClasseur(meta, exigence), classeur, `${graine}:classeur`, budgetDuClasseur(meta), new Set(exclus), clic);

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
 * LA BOUTIQUE LUE PAR L'ATTENTIF (nov. 2026, docs/revue-rogue-2026-11.md § 2.6 ; MESURE seulement, `ROBOT_SAUF=boutique`
 * la lui retire). Le robot d'avant achète dans un ordre fixe : l'ablation ne pouvait pas dire si choisir son pack compte.
 * L'attentif lit l'offre : chaque pack que la boutique vend, tiré `ESSAIS_DE_PACK` fois au matin de la saison sur un
 * générateur à lui (les dés de la saison ne bougent pas), et, à chaque achat, ce que vaudrait le meilleur joueur qu'il
 * en signerait — sa valeur au-dessus du plus faible habillé de son groupe, s'il tient sous le plafond à sa place —, en
 * moyenne sur les tirages, sur le prix du pack à cet achat. Il prend le pack qui rend le plus par jeton ; si aucun ne
 * rend rien, l'ordre du robot d'avant.
 */
const PACKS_DE_LA_BOUTIQUE = ['bronze', 'epoque', 'argent', 'or', 'specialistes', 'club', 'vedettes', 'coach'];
const ESSAIS_DE_PACK = 12;
function lireLaBoutique(meta, graine, saison, libre) {
  const rnd = generateur('rogue80-boutique', graine, saison), ouverts = packsOuverts(meta), lu = [];
  const roles = ['sniper', 'passeur', 'defensif', 'gardien'].filter(r => !VERROUS[r] || aDebloque(meta, VERROUS[r]));
  for (const cle of PACKS_DE_LA_BOUTIQUE.filter(k => ouverts[`j:${k}`] === true && PACKS_JOUEURS[k])) {
    for (const role of cle === 'specialistes' ? roles : [null]) {
      lu.push({ cle, ...(role ? { role } : {}), tirages: Array.from({ length: ESSAIS_DE_PACK }, () => tirerPack(rnd, cle, libre, role, meta).map(x => x.p)) });
    }
  }
  return lu;
}
function packLu(lu, roster, cap, jetons, n, exigence) {
  const habilles = SLOTS.filter(sl => !sl.scratch && roster[sl.i]).map(sl => roster[sl.i]);
  const masse = masseDe(roster);
  const plusFaible = new Map(['F', 'D', 'G'].map(g => [g, habilles.filter(p => groupe(p) === g).reduce((b, p) => (!b || v(p) < v(b) ? p : b), null)]));
  const gainDe = p => { const sort = plusFaible.get(groupe(p)); return !sort || masse - (sort.$ || 0) + (p.$ || 0) > cap ? 0 : Math.max(0, v(p) - v(sort)); };
  let meilleur = null;
  for (const o of lu) {
    const prix = prixAuAchat(o.cle, n, exigence);
    if (jetons < prix) continue;
    const attendu = o.tirages.reduce((a, t) => a + Math.max(0, ...t.map(gainDe)), 0) / o.tirages.length;
    if (attendu > 0 && (!meilleur || attendu / prix > meilleur.parJeton)) meilleur = { cle: o.cle, ...(o.role ? { role: o.role } : {}), parJeton: attendu / prix };
  }
  return meilleur ? { cle: meilleur.cle, ...(meilleur.role ? { role: meilleur.role } : {}) } : null;
}

/*
 * UNE SAISON D'UNE RUN. `etat` : l'alignement et les variantes qui continuent
 * (la saison 2 d'une run repart de l'équipe de la saison 1), les jetons de
 * départ. Rend la fiche, les séries, les jetons qui restent et l'équipe.
 */
export function jouerSaison(meta, etat, { graine, saison, mains = true, politique = 'defaut', exigence = 0, ligue = niveauDeLigue(rangDePrestige(meta), exigence), etapeDeRun = 0 }) {
  const rnd = generateur('rogue80', graine, saison);
  const attentif = politique === 'attentif';
  const clic = politique === 'distrait' ? generateur('rogue80-distrait', graine, saison) : null;
  const auHasard = l => l[Math.floor(clic() * l.length)];
  const nRes = reservesDeLaRun(meta);
  const { variantes } = etat;
  const poser = p => { const k = getPlayerKey(p); p._carte = carteDe(variantes.get(k) || varianteTiree(COTES_VARIANTES, graine, k), p.p === 'G', graine, k); };
  Object.values(etat.roster).forEach(poser);
  // LE COACH, UN PERSONNAGE (V21) : choisi au départ de la run (`coachDuRobot`), il la fait au complet ; d'une saison à
  // l'autre, son expérience, ses talents et sa main d'adjoints continuent (`etat.perso`, comme au jeu).
  const ouverts = coachsOuverts(rangDePrestige(meta));
  if (!etat.perso) {
    const c = attentif && COACH_FORCE ? lotoDesCoachs(COACHS_REELS, [COACH_FORCE], `rogue80:${graine}:chef`, 1)[0]
      : coachDuRobot(lotoDesCoachs(COACHS_REELS, ouverts, `rogue80:${graine}:chef`), { politique: attentif && !attentifFait('coach') ? 'defaut' : politique, clic, fit: carte => fitDeCoach(etat.roster, carte) });
    etat.perso = { cle: c.cle, xp: 0, talents: [], main: [], chef: { id: c.id, n: c.n, saison: c.saison, tag: c.tag }, maitrise: c.maitrise };
  }
  // L'attentif range ses cartes posées : la variante d'un joueur compte dans ce qu'il rend.
  const roster = attentif && attentifFait('aumieux') ? ranger(Object.values(etat.roster).filter(Boolean), nRes, auMieux) : etat.roster;
  const masse0 = masseDe(roster);
  // LE VRAI PLAFOND (oct., js/rogue-jeu.js `plafondDeDepart` en `reel`) : celui de la LNH et les déblocages ; une masse plus
  // lourde garde son espace (V9, tranche 4).
  const cap = Math.max(PLAFOND_PREMIERE + plafondDuVestiaire(meta), plafondDeSaison(masse0, meta, exigence));
  const exclus = new Set(Object.values(roster).map(getPersonKey));
  const you = createTeam('Rogue', 'YOU', roster, { isPlayer: true });
  const opps = adversaires(rnd, exclus, 31, ligue, etapeDeRun);
  // Le coach du jour 0 de chaque saison (js/banc.js) : son expérience d'avant, ses talents, sa main d'adjoints.
  const decisions = [{ jour: 0, cases: photoAlignement(roster), fermeture: 'auto' }, { jour: 0, coach: { ...etat.perso, talents: [...etat.perso.talents], main: (etat.perso.main || []).map(c => ({ cle: c.cle, depuis: null, fin: null, sejours: [...(c.sejours || [])] })) } }];
  // LES GALONS DE LA RUN (V9, tranche 7, js/galons.js) : ce que le jeu reporte seul d'une saison à l'autre, un métal de badge chacun.
  const galons = Object.fromEntries(Object.values(roster).filter(Boolean).map(p => [getPlayerKey(p), Math.min(GALONS_MAX, (etat.galons && etat.galons.get(getPlayerKey(p))) || 0)]).filter(([, n]) => n > 0));
  if (Object.keys(galons).length) decisions.push({ jour: 0, galons, report: true });
  // V8 : les rivaux choisis au premier jour. Le robot prend les trois du milieu de l'offre (ni le plus fort ni le plus faible).
  const offre = rivauxOfferts([you, ...opps], you, `rogue80:${graine}:${saison}`);
  if (offre.length >= RIVAUX) decisions.push({ jour: 0, rivaux: (clic ? melanger(offre, clic).slice(0, RIVAUX) : offre.slice(1, 1 + RIVAUX)).map(x => ({ cle: x.cle, butin: x.butin })) });
  /*
   * LE DUEL (V9, tranche 5, scripts/lib/duel.mjs) : l'attentif lit chaque intention et y répond ; le distrait clique au
   * hasard ; le robot d'avant ne répond à rien. Sans main depuis la V13-2. `mains: false`, aucun : ni geste ni tableau.
   */
  if (mains && ((attentif && attentifFait('duel')) || clic)) you.robotDuel = robotDuel(attentif ? 'attentif' : 'distrait', clic || undefined);
  const L = creerLigue([you, ...opps], 82, { graine: `rogue80:${graine}:${saison}`, decisions, courbe: true });
  const dansLaLigue = new Set();
  for (const t of L.teams) for (const p of Object.values(t.roster)) if (p) dansLaLigue.add(getPersonKey(p));
  // L'attentif lit la boutique au matin de la saison (`lireLaBoutique`) ; `ROBOT_SAUF=boutique`, l'ordre du robot d'avant.
  const boutique = attentif && attentifFait('boutique') ? lireLaBoutique(meta, graine, saison, p => p.$ > 0 && !dansLaLigue.has(getPersonKey(p))) : null;
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
  // V10 : le lundi du robot — la route, le dossier, la carte d'un palier (scripts/lib/cartes_robot.mjs).
  const etatCartes = { dossiers: [], paliers: new Set(), butins: new Set() };
  const plans = new Map();
  let planPose = 'match';
  while (!L.fini) {
    for (const d of lundiDuRobot({ L, you, graine: `rogue80:${graine}:${saison}`, politique: attentif && !attentifFait('lundi') ? 'defaut' : politique, clic, jetons: jetons(), etat: etatCartes,
      fit: attentif && attentifFait('fit') ? k => fitDAdjoint(you.roster, k, etat.perso.cle) : null })) {
      decisions.push(d);
      depense -= d.gain || 0;
    }
    // La boutique, le matin : tant qu'il y a de quoi acheter.
    for (let garde = 0; garde < 4; garde++) {
      const voulu = (boutique && packLu(boutique, you.roster, cap, jetons(), achats, exigence)) || packVoulu(meta, jetons(), achats, exigence);
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
      const net0 = attentif && cartes.length ? lireNet(ranger(joueurs, nRes)) : 0;
      for (const x of clic ? [] : cartes) {
        const avec = [...joueurs, x.p];
        const r = ranger(avec, nRes);
        const dedans = new Set(Object.values(r).map(getPersonKey));
        const sort = avec.find(p => !dedans.has(getPersonKey(p))) || null;
        if (sort === x.p) continue;
        if (masseDe(actuel) - (sort ? sort.$ || 0 : 0) + (x.p.$ || 0) > cap) continue;
        // Une case de réserve libre (débloquée) : il entre sans que personne sorte — ça vaut un peu de profondeur.
        const auNet = attentif && attentifFait('net');
        const gain = auNet ? lireNet(r) - net0 + (sort ? 0 : 0.01) : valeurAlignement(r) - valeur0 + (sort ? 0 : 0.6);
        if (gain > (auNet ? 0.01 : 0.5) && (!meilleur || gain > meilleur.gain)) meilleur = { x, r, sort, gain };
      }
      if (meilleur) {
        const { x, sort } = meilleur;
        const r = attentif && attentifFait('aumieux') ? ranger(Object.values(meilleur.r).filter(Boolean), nRes, auMieux) : meilleur.r;
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
    // LE PLAN DE MATCH (V17) : le plan de ce soir, posé s'il change.
    const plan = planDuRobot(L, you, plans, attentif, clic);
    if (plan !== undefined && plan !== planPose) { decisions.push({ jour: L.jour, plan: { cle: plan } }); planPose = plan; }
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
  // `L` et `you` : la ligue jouée, pour qui veut relire ses feuilles (check_moments_si). `report` : ce que la saison suivante reprend.
  // V21 : le personnage que la saison laisse à la suivante — l'expérience gagnée s'ajoute, les choix restent.
  const perso = you.perso ? { ...you.perso, xp: you.perso.xp + (you.xpSaison || 0) } : etat.perso;
  return { pts: you.PTS, W: you.W, rang, series: rang <= 16, rondes, coupe, finale, premier: rang === 1, serieMax, achats, signes, reste, entrees, galons: galonsNeufs, roster: { ...you.roster }, L, you, decisions, perso };
}

/*
 * LE PLAN DU ROBOT (V17, docs/refonte-v17.md § 3), ce soir. L'attentif lit le moteur à la première rencontre d'un club
 * (`planEnChiffres`, js/impact.js : chaque plan contre « Ton match », en paires) et garde, contre lui, celui qui rend
 * le plus de buts nets, « Ton match » si aucun ne rend ; le distrait en tire un au hasard chaque soir ; le robot
 * d'avant n'en pose aucun (`undefined`). `plans` : la lecture de l'attentif, club par club, pour la saison.
 */
function planDuRobot(L, you, plans, attentif, clic) {
  const m = (L.calendrier[L.jour] || []).find(x => x.A === you || x.B === you);
  if (attentif && !attentifFait('plan')) return undefined;
  if (!m || (!attentif && !clic)) return undefined;
  const cles = Object.keys(PLANS);
  if (clic) return cles[Math.floor(clic() * cles.length)];
  const adv = m.A === you ? m.B : m.A;
  if (!plans.has(adv)) {
    const lu = avecHasardIsole('robot', () => cles.filter(k => k !== 'match').map(k => [k, planEnChiffres(you, null, adv, k).net])).sort((a, b) => b[1] - a[1])[0];
    plans.set(adv, lu && lu[1] > 0 ? lu[0] : 'match');
  }
  return plans.get(adv);
}

/*
 * UNE RUN (S80 : PLUSIEURS SAISONS). La saison 1 part des plombiers (et des
 * gardés, et du classeur) ; chaque saison suivante repart de plombiers neufs
 * et de ceux qui restent, une case chacun (`gardesDeLaRun`), avec les jetons qui
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
  // Ceux de la dernière équipe : un loto par case (le robot garde le meilleur de chaque loto ; le distrait, n'importe qui).
  const vedette = vedetteDuRobot(rnd, meta, clic);
  const gardes = lotosParCase(gardesDeLaDerniere(meta), derniere.map(p => ({ p })), `${graine}:derniere`, budgetDuClasseur(meta),
    new Set(vedette ? [getPersonKey(vedette)] : []), clic).map(x => copie(x.p));
  if (vedette) gardes.unshift(copie(vedette));
  gardes.forEach(p => exclus.add(getPersonKey(p)));
  // Les cartes du classeur au départ.
  const tires = tirerClasseur(meta, classeur, exclus, graine, clic, exigence).map(x => ({ p: copie(x.p), rar: x.rar }));
  tires.forEach(x => exclus.add(getPersonKey(x.p)));
  const premiere = !classeur.length && !derniere.length;
  const V = vestiaire(rnd, meta, [...gardes, ...tires.map(x => x.p)], classeur, { joues, graine: `${graine}:depart`, exigence, premiere });
  const etat = { roster: V.roster, variantes: new Map(tires.map(x => [getPlayerKey(x.p), x.rar])), jetons: jetonsDeDepart(meta), galons: new Map() };
  for (const x of classeur) if (!etat.variantes.has(getPlayerKey(x.p))) etat.variantes.set(getPlayerKey(x.p), x.rar);
  const jouees = new Set();
  const saisons = [];
  // La ligue de la run (tranche 8) : son niveau est fixé au départ, comme le prestige au jeu (`G.rogue.prestige`).
  const ligue = niveauDeLigue(rangDePrestige(meta), exigence);
  // La deuxième run est plus dure (31 oct., js/rogue.js `etapeDeLaRun`) : une étape d'édition de plus, dès qu'un classeur ou une dernière équipe la précède.
  const etapeDeRun = etapeDeLaRun(premiere ? 1 : 2);
  let ecussons = 0;
  const entrees = Object.values(etat.roster).map(p => ({ p, rar: etat.variantes.get(getPlayerKey(p)) || 'commune' }));
  for (let n = 1; n <= maxSaisons; n++) {
    // La valeur moyenne de l'équipe au départ de la saison (check_rogue : la saison 2 reste un défi).
    const valeur = (l => l.reduce((t, p) => t + v(p), 0) / (l.length || 1))(Object.values(etat.roster).filter(Boolean));
    const r = jouerSaison(meta, etat, { graine, saison: n, mains, politique, exigence, ligue, etapeDeRun });
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
    const mandat = mandatRempli(n, { series: r.series, rang: r.rang, nEquipes: 32, exigence });
    saisons.push({ n, pts: r.pts, rang: r.rang, rondes: r.rondes, coupe: r.coupe, ecussons: e, achats: r.achats, signes: r.signes, galons: r.galons.length, valeur, mandat, coach: r.perso.cle, niveau: niveauDuPerso(r.perso), adjoints: (r.perso.main || []).length });
    // La Coupe (tranche 8) : elle compte, et le cran d'exigence gagné ouvre le suivant (js/rogue.js `payerEcussons`).
    if (r.coupe) { meta.coupes = (meta.coupes || 0) + 1; meta.exigence = Math.max(meta.exigence || 0, exigence); }
    // LE MANDAT DU PROPRIO (js/rogue.js `MANDATS`) : manqué, la run est finie ; la Coupe la gagne.
    if (r.coupe || !mandat) break;
    // LA SAISON SUIVANTE : l'équipe se défait — les meilleurs restent, des plombiers neufs ; les jetons restent, la caisse revient.
    const equipe = Object.values(r.roster).filter(Boolean);
    // Ton joueur de concession reste d'une saison à l'autre, sans loto ; les autres, une case chacun (`gardesDeLaRun`).
    const ved = meta.vedette && equipe.find(p => getPlayerKey(p) === meta.vedette);
    const restent = [...(ved ? [ved] : []), ...lotosParCase(gardesDeLaRun(meta, exigence), equipe.filter(p => p !== ved).map(p => ({ p })), `${graine}:g${n + 1}`,
      budgetDuClasseur(meta), new Set(ved ? [getPersonKey(ved)] : []), clic).map(x => x.p)];
    const partants = new Set(equipe.map(getPlayerKey).filter(k => !restent.some(p => getPlayerKey(p) === k)));
    // Le classeur a grossi pendant la saison : les cartes tirées des packs en sont.
    const classeurSaison = [...classeur, ...r.entrees.map(x => ({ p: x.p, rar: x.rar }))];
    // LES LOTOS DU CARTABLE (Jalon Q) : le robot signe la meilleure carte de chaque loto, sous le budget du classeur.
    const lotos = lotosDuRobot(meta, classeurSaison, restent, partants, `${graine}:s${n + 1}`, clic, exigence);
    etat.roster = vestiaire(rnd, meta, [...restent, ...lotos.map(x => copie(x.p))], classeurSaison, { saison: n + 1, exclus: partants, joues, graine: `${graine}:s${n + 1}`, exigence }).roster;
    etat.jetons = r.reste + jetonsDeDepart(meta);
    etat.perso = r.perso;
  }
  for (const k of jouees) joues.set(k, (joues.get(k) || 0) + 1);
  const fin = saisons[saisons.length - 1];
  return {
    saisons, nSaisons: saisons.length, coupe: !!fin.coupe, ecussons, depart: tires.length, valeurDepart: tires.reduce((a, x) => a + v(x.p), 0), exigence, ligue,
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
function vestiaire(rnd, meta, fixes, classeur, { saison = 1, exclus = new Set(), joues = new Map(), graine = '', exigence = 0, premiere = false } = {}) {
  const nRes = reservesDeLaRun(meta);
  const personnes = new Set(fixes.map(getPersonKey));
  const dispo = classeur.filter(x => !exclus.has(getPlayerKey(x.p)) && !personnes.has(getPersonKey(x.p)) && (x.p.$ || 0) > 0);
  if (premiere) {
    const reserve = [];
    const roster = ranger([...fixes, ...plombiers(rnd, meta, personnes, reserve)], nRes);
    return { roster: alourdirLaPremiere(roster, reserve.map(copie), { fixes, personne: getPersonKey }), tires: [] };
  }
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
  // Le vrai plafond à chaque run (oct., js/rogue-jeu.js `vestiaireDeDepart`) : au départ, les bouche-trous prennent de vrais
  // contrats trop payés ; entre deux saisons, l'équipe garde sa masse.
  if (saison > 1) return { roster: ranger(pris, nRes), tires };
  const reserve = [];
  plombiers(rnd, meta, new Set(pris.map(getPersonKey)), reserve);
  const v = plafondDuVestiaire(meta), cible = PLAFOND_PREMIERE + v - Math.max(0, ESPACE_DE_DEPART + v + exigencesDe(exigence).espace);
  return { roster: alourdirLaPremiere(ranger(pris, nRes), reserve.map(copie), { fixes: [...fixes, ...tires.map(x => x.p)], personne: getPersonKey, cible }), tires };
}
/* LES LOTOS DU ROBOT (js/rogue-jeu.js `lotoDuCartable`) : les cases de `lotosDeSaison`, sous le budget du classeur moins ses gardés. */
const lotosDuRobot = (meta, classeur, gardes, partants, graine, clic = null, exigence = 0) =>
  lotosParCase(lotosDeSaison(meta, exigence), classeur.filter(x => !partants.has(getPlayerKey(x.p))), graine, budgetDuClasseur(meta) - masseDe(gardes), new Set(gardes.map(getPersonKey)), clic);
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
  'packGardiens', 'packDefenseurs', 'plafond2', 'garder2', 'classeur3', 'packVedettes', 'banc2', 'classeur4',
  'dgFlexible', 'packAnnees80', 'garder3',
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
