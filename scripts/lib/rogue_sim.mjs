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
 * joueur que l'alignement automatique prendrait, ne joue aucune carte. Un
 * humain fait mieux ; ce qui compte, c'est la PENTE d'un niveau de
 * déblocages à l'autre, au même robot.
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
} from '../../js/sim.js';
import { carteDe, varianteTiree, COTES_VARIANTES } from '../../js/rarete.js';
import { TIERS, PACKS_JOUEURS, SKILLS } from '../../js/packs.js';
import {
  JETONS, jetonsDeDepart, nombreGardes, aDebloque, plafondDuVestiaire, ecussonsDeLaSaison, ecussonsDesSeries,
  DEBLOCAGES, departDuClasseur, budgetDuClasseur, reservesDeLaRun, PLAFOND_ROGUE, ESPACE_DE_DEPART, jalonsAtteints, mandatRempli, baremeRogue, GARDES_DE_SAISON,
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

/* LES PLOMBIERS (js/game.js `plombiers`) : huit saisons, du 10e au 30e centile de production (30e-50e débloqué). */
function plombiers(rnd, meta, exclus) {
  const saisons = SAISONS.slice(), choisies = [];
  while (choisies.length < 8) choisies.push(saisons.splice(Math.floor(rnd() * saisons.length), 1)[0]);
  const [bas, haut] = aDebloque(meta, 'plombiersPlus') ? [0.3, 0.5] : [0.1, 0.3];
  const pool = [];
  for (const s of choisies) {
    const e = shard(s);
    for (const g of ['F', 'D', 'G']) {
      const reg = e.players.filter(p => groupe(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 30) && !exclus.has(getPersonKey(p))).sort((a, b) => prod(a) - prod(b));
      const tranche = reg.slice(Math.floor(reg.length * bas), Math.max(1, Math.floor(reg.length * haut)));
      for (let i = 0; i < (g === 'F' ? 3 : g === 'D' ? 2 : 1) && tranche.length; i++) pool.push(copie(tranche.splice(Math.floor(rnd() * tranche.length), 1)[0]));
    }
  }
  return pool;
}

/* 31 vrais clubs, comme `buildOpponents` : un club-saison entier, aligné par `autoRoster`, sans tes joueurs. */
function adversaires(rnd, exclus, n = 31) {
  const out = [], vus = new Set();
  while (out.length < n) {
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = Object.keys(e.byTeam);
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${e.season}|${tag}`)) continue;
    const pool = e.byTeam[tag];
    if (pool.filter(p => groupe(p) === 'F').length < 12 || pool.filter(p => groupe(p) === 'D').length < 6 || pool.filter(p => p.p === 'G').length < 2) continue;
    vus.add(`${e.season}|${tag}`);
    const roster = autoRoster(pool.map(copie), exclus);
    for (const p of Object.values(roster)) exclus.add(getPersonKey(p));
    out.push(createTeam(`${tag} ${e.season}`, tag, roster, { season: e.season }));
  }
  return out;
}

/*
 * UN PACK DE JOUEURS (imite `tirerPackJoueurs`) : la famille dit où l'on
 * pige, le tier dit la variante. `libre` : un salaire qu'une sortie ferait
 * entrer, personne de la ligue.
 */
function tirerPack(rnd, cle, libre) {
  const P = PACKS_JOUEURS[cle];
  const T = TIERS[P.tier];
  const nb = T.n + (P.famille === 'trio' ? -2 : 0);
  const out = [];
  for (let t = 0; out.length < nb && t < nb * 6; t++) {
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    let pool;
    if (P.famille === 'skill') {
      const S = SKILLS[P.skill];
      const c = e.players.filter(p => (p.gp || 0) >= S.min && (!S.groupe || groupe(p) === S.groupe) && (!S.skaters || p.p !== 'G')).sort((a, b) => S.score(b) - S.score(a));
      pool = c.slice(0, Math.ceil(c.length / 4));
    } else if (P.famille === 'etoiles' || P.famille === 'legendes') pool = e.players.filter(p => estEtoile(p) && (P.famille !== 'legendes' || Number(p.s.slice(0, 4)) < 1995));
    else pool = ['F', 'D', 'G'].flatMap(g => { const r = e.players.filter(p => groupe(p) === g && (p.gp || 0) >= (g === 'G' ? 15 : 30)).sort((a, b) => prod(b) - prod(a)); return r.slice(0, Math.ceil(r.length / 2)); });
    pool = pool.filter(p => libre(p) && !out.some(x => getPersonKey(x.p) === getPersonKey(p)));
    if (!pool.length) continue;
    const p = pool[Math.floor(rnd() * pool.length)];
    let r = rnd() * 100, rar = 'commune';
    for (const k of ['commune', 'peu', 'rare', 'legendaire']) { r -= T.cotes[k]; if (r < 0) { rar = k; break; } }
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
/* Ranger : l'alignement automatique, puis les cases de réserve de plus — les meilleurs d'abord. */
function ranger(joueurs, nReserves) {
  const r = autoRoster(joueurs);
  const dedans = new Set(Object.values(r).map(getPersonKey));
  const reste = joueurs.filter(p => !dedans.has(getPersonKey(p))).sort((a, b) => v(b) - v(a));
  for (const sl of SLOTS.filter(s => s.extra && s.extra <= nReserves)) { const p = reste.shift(); if (p) r[sl.i] = p; }
  return r;
}

/* Les cartes du classeur au départ : au hasard, le tri (deux fois plus, on garde les meilleures), ou le choix. */
function tirerClasseur(rnd, meta, classeur, exclus) {
  const D = departDuClasseur(meta);
  if (!D.n || !classeur.length) return [];
  const budget = budgetDuClasseur(meta);
  const dispo = classeur.filter(x => (x.p.$ || 0) <= budget && !exclus.has(getPersonKey(x.p)));
  const melange = dispo.map(x => [rnd(), x]).sort((a, b) => a[0] - b[0]).map(y => y[1]);
  const vus = D.mode === 'choix' ? dispo.slice().sort((a, b) => v(b.p) - v(a.p)) : melange.slice(0, D.vues);
  const ordre = D.mode === 'hasard' ? vus : vus.slice().sort((a, b) => v(b.p) - v(a.p));
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
 * LA POLITIQUE D'ACHAT DU ROBOT : les étoiles s'il les a débloquées et les
 * moyens, sinon un pack de talent (franc-tireurs, passeurs, défensif ou
 * gardiens s'ils sont débloqués), sinon un pack Argent.
 */
const VERROUS = { defensif: 'packDefenseurs', gardien: 'packGardiens', etoiles: 'packVedettes', legendes: 'packVedettes' };
function packVoulu(meta, jetons, n) {
  const ouvert = k => !VERROUS[k] || aDebloque(meta, VERROUS[k]);
  if (ouvert('etoiles') && jetons >= PACKS_JOUEURS.etoiles.prix) return 'etoiles';
  const talents = [ouvert('sniper') ? 'sniper' : 'hasard_argent', ouvert('passeur') ? 'passeur' : 'hasard_argent', ouvert('defensif') ? 'defensif' : 'hasard_argent', ouvert('gardien') ? 'gardien' : 'hasard_argent'];
  const k = talents[n % talents.length];
  if (jetons >= PACKS_JOUEURS[k].prix) return k;
  if (jetons >= PACKS_JOUEURS.hasard_argent.prix) return 'hasard_argent';
  return null;
}

/*
 * UNE SAISON D'UNE RUN. `etat` : l'alignement et les variantes qui continuent
 * (la saison 2 d'une run repart de l'équipe de la saison 1), les jetons de
 * départ. Rend la fiche, les séries, les jetons qui restent et l'équipe.
 */
function jouerSaison(meta, etat, { graine, saison }) {
  const rnd = generateur('rogue80', graine, saison);
  const { roster, variantes } = etat;
  const nRes = reservesDeLaRun(meta);
  const poser = p => { const k = getPlayerKey(p); p._carte = carteDe(variantes.get(k) || varianteTiree(COTES_VARIANTES, graine, k), p.p === 'G', graine, k); };
  Object.values(roster).forEach(poser);
  const masse0 = masseDe(roster);
  const base = PLAFOND_ROGUE + plafondDuVestiaire(meta);
  // Chaque saison garde 12 M$ d'espace au départ : l'équipe se défait entre deux saisons (js/rogue-jeu.js `plafondDeDepart`).
  const cap = Math.max(base, Math.ceil((masse0 + ESPACE_DE_DEPART) / 100_000) * 100_000);
  const exclus = new Set(Object.values(roster).map(getPersonKey));
  const you = createTeam('Rogue', 'YOU', roster, { isPlayer: true });
  const opps = adversaires(rnd, exclus);
  const decisions = [{ jour: 0, cases: photoAlignement(roster), fermeture: 'auto' }];
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
    const gros = (you.minisBoss || []).filter(mb => mb.gagne).length;
    const B = baremeRogue(meta);
    return etat.jetons + W * B.victoire + P * B.prolongation + D * B.defaite + gros * B.grosMatch - depense;
  };
  while (!L.fini) {
    // La boutique, le matin : tant qu'il y a de quoi acheter.
    for (let garde = 0; garde < 4; garde++) {
      const cle = packVoulu(meta, jetons(), achats);
      if (!cle) break;
      depense += PACKS_JOUEURS[cle].prix; achats++;
      const actuel = you.roster;
      const salaireMax = cap - masseDe(actuel) + Math.max(...Object.values(actuel).filter(Boolean).map(p => p.$ || 0));
      const cartes = tirerPack(rnd, cle, p => p.$ > 0 && p.$ <= salaireMax && !dansLaLigue.has(getPersonKey(p)));
      entrees.push(...cartes);
      // SIGNER (un seul du pack) : celui qui monte le plus l'alignement, sous le plafond ; qui sort : celui que l'alignement laisse.
      let meilleur = null;
      const joueurs = Object.values(actuel).filter(Boolean);
      const valeur0 = valeurAlignement(actuel);
      for (const x of cartes) {
        const avec = [...joueurs, x.p];
        const r = ranger(avec, nRes);
        const dedans = new Set(Object.values(r).map(getPersonKey));
        const sort = avec.find(p => !dedans.has(getPersonKey(p))) || null;
        if (sort === x.p) continue;
        if (masseDe(actuel) - (sort ? sort.$ || 0 : 0) + (x.p.$ || 0) > cap) continue;
        // Une case de réserve libre (débloquée) : il entre sans que personne sorte — ça vaut un peu de profondeur.
        const gain = valeurAlignement(r) - valeur0 + (sort ? 0 : 0.6);
        if (gain > 0.5 && (!meilleur || gain > meilleur.gain)) meilleur = { x, r, sort, gain };
      }
      if (meilleur) {
        const { x, r, sort } = meilleur;
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
    const S = creerSeries(b.standings.slice(0, 16), { ligue: L, graine: L.graine, decisions: [], equipes: L.teams });
    for (let garde = 0; !S.fini && garde < 200; garde++) jouerMatchSeries(S);
    rondes = S.toutes.filter(s => s.winner === you).length;
    coupe = S.champion === you;
    finale = S.toutes.some(s => s.ronde === S.nRondes - 1 && (s.A === you || s.B === you));
  }
  const reste = Math.max(0, jetons());
  // Le robot ne laisse pas de cartes posées sur des joueurs partagés : chaque saison repart propre.
  for (const p of Object.values(you.roster)) if (p) delete p._carte;
  for (const x of entrees) delete x.p._carte;
  return { pts: you.PTS, W: you.W, rang, series: rang <= 16, rondes, coupe, finale, premier: rang === 1, serieMax, achats, signes, reste, entrees, roster: { ...you.roster } };
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
export function jouerRun(meta, { classeur = [], derniere = [], graine = 'run', jalons = false, maxSaisons = 8 } = {}) {
  const rnd = generateur('rogue80', graine);
  const exclus = new Set();
  // Les joueurs gardés de la dernière équipe (le robot garde les meilleurs).
  const gardes = derniere.slice().sort((a, b) => v(b) - v(a)).slice(0, nombreGardes(meta)).map(copie);
  gardes.forEach(p => exclus.add(getPersonKey(p)));
  // Les cartes du classeur au départ.
  const tires = tirerClasseur(rnd, meta, classeur, exclus).map(x => ({ p: copie(x.p), rar: x.rar }));
  tires.forEach(x => exclus.add(getPersonKey(x.p)));
  const pool = [...gardes, ...tires.map(x => x.p), ...plombiers(rnd, meta, exclus)];
  const etat = { roster: ranger(pool, reservesDeLaRun(meta)), variantes: new Map(tires.map(x => [getPlayerKey(x.p), x.rar])), jetons: jetonsDeDepart(meta) };
  const saisons = [];
  let ecussons = 0;
  const entrees = Object.values(etat.roster).map(p => ({ p, rar: etat.variantes.get(getPlayerKey(p)) || 'commune' }));
  for (let n = 1; n <= maxSaisons; n++) {
    const r = jouerSaison(meta, etat, { graine, saison: n });
    entrees.push(...r.entrees);
    let e = ecussonsDeLaSaison(r.pts) + ecussonsDesSeries(r.rondes, r.coupe);
    if (jalons) e += payerJalonsSim(meta, { ...r, saisonDeLaRun: n, cartes: classeur.length + entrees.length });
    ecussons += e;
    saisons.push({ n, pts: r.pts, rang: r.rang, rondes: r.rondes, coupe: r.coupe, ecussons: e, achats: r.achats, signes: r.signes });
    // LE MANDAT DU PROPRIO (js/rogue.js `MANDATS`) : manqué, la run est finie ; la Coupe la gagne.
    if (r.coupe || !mandatRempli(n, r)) break;
    // LA SAISON SUIVANTE : l'équipe se défait — les meilleurs restent, des plombiers neufs ; les jetons restent, la caisse revient.
    const restent = gardesDeSaison(meta, Object.values(r.roster).filter(Boolean));
    etat.roster = ranger([...restent, ...plombiers(rnd, meta, new Set(restent.map(getPersonKey)))], reservesDeLaRun(meta));
    etat.jetons = r.reste + jetonsDeDepart(meta);
  }
  const fin = saisons[saisons.length - 1];
  return {
    saisons, nSaisons: saisons.length, coupe: !!fin.coupe, ecussons, depart: tires.length,
    pts1: saisons[0].pts, series1: saisons[0].rang <= 16,
    entrees: entrees.map(x => ({ p: x.p, rar: x.rar })),
    equipe: Object.values(etat.roster).filter(Boolean),
  };
}
/* Ceux qui restent d'une saison à l'autre : le robot garde les meilleurs qui tiennent ensemble dans le budget du classeur. */
function gardesDeSaison(meta, equipe) {
  const budget = budgetDuClasseur(meta), out = [];
  let masse = 0;
  for (const p of equipe.slice().sort((a, b) => v(b) - v(a))) {
    if (out.length >= GARDES_DE_SAISON) break;
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
    for (let n = 0; n < 28; n++) out.push(...tirerPack(rnd, packVoulu(meta, 999, n) || 'hasard_argent', p => p.$ > 0));
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
].filter(k => DEBLOCAGES[k]);
/* Acheter ce qu'on peut, dans l'ordre (un déblocage qui en demande un autre attend son tour). */
export function acheterDans(meta) {
  for (let fait = true; fait;) {
    fait = false;
    for (const k of ORDRE_DEBLOCAGES) {
      const D = DEBLOCAGES[k];
      if (aDebloque(meta, k) || (D.requis && !aDebloque(meta, D.requis)) || meta.ecussons < D.prix) continue;
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
