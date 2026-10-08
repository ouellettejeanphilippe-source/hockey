/*
 * LE BALLOTTAGE, en fonction PURE (1.0, J1-D). Quand un joueur se blesse
 * pour de bon, trois vrais joueurs pas chers sont au ballottage : de la même
 * position, des MÊMES saisons que la ligue, mais de clubs qui n'y sont pas,
 * et personne qui y joue déjà. Le tirage se fait de la graine et du match :
 * la même blessure offre les mêmes trois noms à la reprise.
 *
 * UN DÉPANNEUR, PAS UNE VEDETTE. Avant 1.0, on offrait les quinze meilleurs
 * producteurs sous 3 % du plafond — par construction les saisons de contrat
 * d'entrée des vedettes (Mogilny 84 points à 1,13 M$, pour une blessure de
 * sept matchs). Un réclamé est maintenant au plus « Régulier » (`niveauMax`,
 * js/niveaux.js) : on offre les meilleurs réguliers, pas des figurants.
 *
 * Le contrôleur (js/game.js) ne fournit que ce que la partie permet — la
 * ligue, les shards chargés, le budget — et scripts/check_ballottage.mjs
 * mesure la même fonction en Node.
 */
import { getPlayerKey, getPersonKey, SLOTS, fits } from './sim.js';
import { niveauDe, joueursParNiveau, groupeDuJoueur, mesureDuNiveau } from './niveaux.js';
import { estD as isD } from './util.js';

export const groupeDe = p => (p.p === 'G' ? 'G' : isD(p) ? 'D' : 'F');
/* La production d'un joueur dans sa saison : points par match, ou % d'arrêts. */
export const productionDe = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));

const MEILLEURS_BALLOTTAGE = 15;
/*
 * UN VRAI RAPPEL (1.0, oct.). JP : *jamais piger remplaçant meilleur que
 * l'original, proposer joueurs avec peu de matchs joués dans la saison et qui
 * donc, sont viables principalement pour la durée de la blessure, comme un
 * vrai call up*. Le candidat a joué de RAPPEL_MATCHS[0] à RAPPEL_MATCHS[1]
 * matchs dans sa vraie saison — un gars du club-école monté quelques semaines —
 * et il produit MOINS que le blessé, chacun rapporté aux réguliers de sa
 * saison à son poste (un point par match en 1985 n'est pas un point par match
 * en 2000).
 */
export const RAPPEL_MATCHS = [5, 30];
const REGULIERS = new WeakMap();
function moyenneDesReguliers(players, g) {
  let m = REGULIERS.get(players);
  if (!m) {
    m = {};
    for (const k of ['F', 'D', 'G']) {
      const v = players.filter(x => (x.gp || 0) >= 40 && groupeDe(x) === k).map(productionDe);
      m[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    }
    REGULIERS.set(players, m);
  }
  return m[g];
}
/* Sa production sur celle des réguliers de sa saison ; un gardien, en % d'arrêts brut (l'écart d'une époque à l'autre est petit). */
const productionRelative = (p, shards) => {
  if (p.p === 'G') return productionDe(p);
  const e = shards.get(String(p.s));
  const m = e ? moyenneDesReguliers(e.players, groupeDe(p)) : 0;
  return m > 0 ? productionDe(p) / m : productionDe(p);
};
export const NIVEAU_MAX_BALLOTTAGE = 1;   // Régulier (js/niveaux.js) : jamais un Pilier, une Étoile ou un Phénomène

/*
 * Le seuil du niveau au-dessus de `niveauMax`, par groupe, dans une saison :
 * la mesure du plus faible joueur de ce niveau. Un joueur trop court pour
 * être rangé (moins de 40 matchs, niveau −1 — la recrue de 32 matchs à un
 * point par match) se juge sur cette même barre.
 */
const SEUILS = new WeakMap();
function seuilDe(players, niveauMax) {
  let s = SEUILS.get(players);
  if (!s) {
    s = {};
    const au = joueursParNiveau(players)[niveauMax + 1] || [];
    for (const g of ['F', 'D', 'G']) { const m = au.filter(x => groupeDuJoueur(x) === g).map(x => mesureDuNiveau(x, players)); s[g] = m.length ? Math.min(...m) : Infinity; }
    SEUILS.set(players, s);
  }
  return s;
}
const tropFort = (p, players, niveauMax) => {
  const k = niveauDe(p, players);
  if (k > niveauMax) return true;
  return k < 0 && mesureDuNiveau(p, players) >= seuilDe(players, niveauMax)[groupeDuJoueur(p)];
};

/*
 * Les candidats au ballottage pour `blesse`, au match `at`.
 *   shards   Map saison → { players, byTeam } (les saisons de la ligue chargées)
 *   ligue    { cles: ['saison|TAG', …], teams: [{ roster }], graine }
 *   budget   le salaire maximal (l'espace sous le plafond, borné à 3 % du plafond par le contrôleur)
 *   niveauMax  le niveau le plus haut qu'un réclamé peut avoir (1 = Régulier)
 * Rend jusqu'à trois joueurs (des personnes différentes), les mêmes à chaque appel.
 */
export function candidatsBallottage({ shards, ligue, blesse, budget, at, graine = ligue && ligue.graine, niveauMax = NIVEAU_MAX_BALLOTTAGE, meilleurs = MEILLEURS_BALLOTTAGE }) {
  if (!ligue || !blesse || !Array.isArray(ligue.cles) || !shards) return [];
  const g = groupeDe(blesse);
  const plafond = productionRelative(blesse, shards);
  const dansLaLigue = new Set();
  for (const t of ligue.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const clubs = new Set(ligue.cles);
  const pool = [];
  for (const s of new Set(ligue.cles.map(c => String(c).split('|')[0]))) {
    const e = shards.get(s);
    if (!e) continue;
    for (const [tag, joueurs] of Object.entries(e.byTeam || {})) {
      if (clubs.has(`${s}|${tag}`)) continue;
      for (const p of joueurs) {
        if ((p.gp || 0) < RAPPEL_MATCHS[0] || (p.gp || 0) > RAPPEL_MATCHS[1] || !(p.$ > 0) || p.$ > budget || groupeDe(p) !== g || dansLaLigue.has(getPersonKey(p))) continue;
        if (niveauMax != null && niveauMax < 4 && tropFort(p, e.players, niveauMax)) continue;
        if (productionRelative(p, shards) >= plafond) continue;
        pool.push(p);
      }
    }
  }
  const h = str => { let x = ((Number(graine) >>> 0) ^ Math.imul(at + 1, 2654435761)) >>> 0; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
  // Des offres qui valent la peine : les meilleurs producteurs qui passent le
  // filtre (tous sous le blessé), puis trois d'entre eux tirés de la graine.
  pool.sort((a, b) => productionRelative(b, shards) - productionRelative(a, shards));
  pool.length = Math.min(pool.length, meilleurs);
  pool.sort((a, b) => h(getPlayerKey(a)) - h(getPlayerKey(b)));
  const out = [], vus = new Set();
  for (const p of pool) {
    if (vus.has(getPersonKey(p))) continue;
    vus.add(getPersonKey(p)); out.push(p);
    if (out.length === 3) break;
  }
  return out;
}

/*
 * LE RAPPEL DU CLUB-ÉCOLE (oct.). JP : *des cartes de remplissage pour les rappels, pour que le jeu ne casse pas s'il
 * est impossible de remplacer un joueur* ; *ça doit ajouter un « mauvais » joueur : tout doit être réel dans le
 * système, si on le dit au joueur*. Le ballottage peut n'offrir personne, ou personne que le plafond et les jetons
 * laissent signer. Le club-école, lui, a toujours quelqu'un : un VRAI joueur des saisons de la ligue, d'un club qui
 * n'y est pas, monté quelques matchs dans sa saison (RAPPEL_MATCHS) — le plus faible producteur de son groupe (à
 * égalité, celui qui a le plus joué), un bouche-trou, pas un renfort. Gratuit et hors plafond (le contrôleur le dit à `plafondDe`, js/banque.js). Le même à
 * chaque appel (la graine et le match départagent les égalités). Pas de gardien : l'auxiliaire prend le filet.
 */
export function rappelDuClubEcole({ shards, ligue, blesse, at, graine = ligue && ligue.graine }) {
  if (!ligue || !blesse || !Array.isArray(ligue.cles) || !shards) return null;
  const g = groupeDe(blesse);
  if (g === 'G') return null;
  const dansLaLigue = new Set();
  for (const t of ligue.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const clubs = new Set(ligue.cles);
  const h = str => { let x = ((Number(graine) >>> 0) ^ Math.imul(at + 1, 2654435761)) >>> 0; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
  let best = null, bestMesure = Infinity;
  for (const s of new Set(ligue.cles.map(c => String(c).split('|')[0]))) {
    const e = shards.get(s);
    if (!e) continue;
    for (const [tag, joueurs] of Object.entries(e.byTeam || {})) {
      if (clubs.has(`${s}|${tag}`)) continue;
      for (const p of joueurs) {
        if ((p.gp || 0) < RAPPEL_MATCHS[0] || (p.gp || 0) > RAPPEL_MATCHS[1] || !(p.$ > 0) || groupeDe(p) !== g || dansLaLigue.has(getPersonKey(p))) continue;
        // À production égale (souvent zéro point), celui qui a joué le plus : un mauvais joueur éprouvé, pas un fragile.
        const m = productionRelative(p, shards);
        const egal = Math.abs(m - bestMesure) <= 1e-12;
        if (m < bestMesure - 1e-12 || (egal && (p.gp > best.gp || (p.gp === best.gp && h(getPlayerKey(p)) < h(getPlayerKey(best)))))) { best = p; bestMesure = m; }
      }
    }
  }
  return best;
}

/*
 * OÙ VA CELUI QUI CÈDE SA CASE (1.0, oct.). JP : *ça me permet pas de le
 * mettre dans l'alignement* — Oleksiak sortait d'une réserve de défenseur,
 * et Kessel ne pouvait prendre aucune case d'attaquant : leur joueur devait
 * glisser à la case libérée, qu'un attaquant ne joue pas. Il glisse donc là
 * s'il le peut ; sinon dans une réserve libre ; sinon il prend la réserve
 * d'un réserviste qui, lui, peut jouer la case libérée. `ouverte` : les
 * réserves de la partie (js/game.js `caseOuverte`). Rend les déplacements
 * `[[joueur, case], …]`, ou null.
 */
export function quiGlisse(roster, A, B, ouverte = () => true) {
  const q = roster[B.i];
  if (B.i === A.i || !q) return [];
  if (fits(q, A)) return [[q, A]];
  const reserve = R => R.scratch && R.i !== A.i && R.i !== B.i && ouverte(R) && fits(q, R);
  const libre = SLOTS.find(R => reserve(R) && !roster[R.i]);
  if (libre) return [[q, libre]];
  const R = SLOTS.find(R => reserve(R) && roster[R.i] && fits(roster[R.i], A));
  return R ? [[q, R], [roster[R.i], A]] : null;
}

/*
 * LA BLESSURE ET SON RETOUR, en fonctions PURES (1.0, oct.). JP : *ça bloque
 * même après correction, et lors du retour, ça fucke l'alignement complet*.
 * Deux fautes, une cause : l'écran retenait en mémoire ce qu'il avait déjà
 * « traité » au lieu de le LIRE sur l'alignement. Ici, tout se déduit de
 * trois choses — l'effectif d'aujourd'hui, le journal des blessures du moteur
 * et les matchs joués — donc une page rechargée dit la même chose.
 *
 *   — une blessure BLOQUE tant qu'un patineur blessé occupe une case habillée
 *     qu'un réserviste en santé ou un rappel peut combler ; dès que la case est
 *     comblée (par n'importe quel chemin), elle ne bloque plus, pour de bon ;
 *   — un retour ne remet JAMAIS l'alignement d'avant : il rend sa case au
 *     blessé, renvoie son suppléant d'où il venait, et ne touche à personne
 *     d'autre.
 */
export const BLESSURE_MOMENT = 4;        // à partir de ce nombre de matchs d'absence, la blessure se règle derrière le banc
export const RETOUR_FENETRE = 3;         // matchs après son retour pendant lesquels on propose de le remettre à sa place

export const caseHabillee = (roster, p) => SLOTS.find(sl => !sl.scratch && roster[sl.i] === p) || null;

/* Les réservistes en santé qui peuvent jouer la case `sl`. */
const reservistesPour = (roster, injured, sl) => SLOTS.filter(x => x.scratch && roster[x.i] && !injured.has(roster[x.i]) && fits(roster[x.i], sl))
  .map(x => ({ sl: x, p: roster[x.i] }));

/*
 * Où en est une blessure : la case habillée du blessé (`sl`), les réservistes
 * qui peuvent la jouer, et `forcer` — ça bloque. Il faut une case habillée à
 * combler et de quoi la combler (un réserviste en santé, ou `rappel` : le
 * ballottage offre quelqu'un). Un gardien n'est jamais forcé : l'auxiliaire
 * prend le filet de lui-même. Un blessé déjà en réserve n'a pas de case.
 */
export function etatDeBlessure({ roster, injured, b, rappel = false }) {
  const sl = caseHabillee(roster, b.player);
  const reserves = sl ? reservistesPour(roster, injured, sl) : [];
  // `rappel` : un booléen, ou une fonction qu'on n'appelle que si aucun réserviste ne comble (le ballottage coûte).
  return { b, sl, reserves, forcer: !!sl && sl.group !== 'G' && (reserves.length > 0 || !!(typeof rappel === 'function' ? rappel(b) : rappel)) };
}

/*
 * La blessure qui s'impose : celle d'un patineur habillé qui court encore, la
 * plus longue de celles qu'on peut combler (`peutRappeler(b)` : le ballottage
 * offre quelqu'un), sinon la plus longue tout court — celle-là se dit, elle ne
 * bloque pas.
 */
export function blessureOuverte({ roster, injured, journal, joues, peutRappeler = () => false }) {
  const h = (journal || [])
    .filter(b => b.at <= joues && b.at + b.games > joues && b.games >= BLESSURE_MOMENT && b.player.p !== 'G')
    .sort((x, y) => y.games - x.games)
    .filter(b => caseHabillee(roster, b.player));
  const etat = b => etatDeBlessure({ roster, injured, b, rappel: peutRappeler });
  for (const b of h) { const x = etat(b); if (x.forcer) return x; }
  return h[0] ? etat(h[0]) : null;
}

/*
 * L'alignement est-il valide ? Rend la liste de ce qui cloche : une clé en
 * double, un joueur inconnu ou à une case qu'il ne joue pas, un joueur perdu
 * en route (`attendu` : ses clés), une case habillée vide (si `pleine`).
 */
export function problemesDAlignement(cases, parCle, { attendu = null, pleine = true } = {}) {
  const out = [], vus = new Set();
  for (const [i, k] of Object.entries(cases)) {
    const sl = SLOTS[Number(i)], p = parCle.get(k);
    if (!sl) out.push(`case ${i} inconnue`);
    else if (!p) out.push(`${k} inconnu`);
    else if (!fits(p, sl)) out.push(`${p.n} ne joue pas ${sl.role}`);
    if (vus.has(k)) out.push(`${k} en double`);
    vus.add(k);
  }
  if (attendu) for (const k of attendu) if (!vus.has(k)) out.push(`${k} perdu`);
  if (pleine) for (const sl of SLOTS) if (!sl.scratch && !sl.extra && !cases[sl.i]) out.push(`case ${sl.role} vide`);
  return out;
}

/*
 * LE RETOUR MINIMAL. Le blessé `b.player` revient et n'est plus habillé alors
 * qu'il l'était (`b.avant`, la photo du soir de sa blessure). On lui rend SA
 * case ; celui qui l'occupe — le suppléant — retourne là d'où il venait si la
 * case est encore libre ou si c'est celle que le blessé quitte, sinon à celle
 * que le blessé quitte, sinon à une réserve libre. Si sa case ne se rend pas,
 * une autre case habillée de son groupe, dans le même trio ou la même paire
 * d'abord. Tout le reste ne bouge pas : au plus deux déplacements.
 *
 * Rend `{ cases, mouvements: [{ p, de, vers }] }` (`cases` : l'alignement
 * complet, comme une décision le porte), ou null s'il n'y a rien à rendre ou
 * si aucun déplacement ne laisse un alignement valide.
 */
export function retourDuBlesse({ roster, injured, b }) {
  const B = b && b.player;
  if (!B || !b.avant || injured.has(B)) return null;
  const sB = SLOTS.find(s => roster[s.i] === B);
  if (!sB || !sB.scratch) return null;              // parti depuis, ou déjà habillé
  const parCle = new Map(Object.values(roster).filter(Boolean).map(p => [getPlayerKey(p), p]));
  const iDe = (cle, avant) => { const i = Object.keys(avant).find(k => avant[k] === cle); return i === undefined ? null : SLOTS[Number(i)] || null; };
  const T = iDe(getPlayerKey(B), b.avant);
  if (!T || T.scratch) return null;                 // il n'était pas habillé : rien à lui rendre
  const attendu = [...parCle.keys()];
  const cibles = [T, ...SLOTS.filter(s => !s.scratch && s.i !== T.i && s.group === T.group && fits(B, s))
    .sort((x, y) => (x.unit === T.unit ? 0 : 1) - (y.unit === T.unit ? 0 : 1))];
  for (const t of cibles) {
    const X = roster[t.i] || null;
    if (X === B) return null;
    const o = X ? iDe(getPlayerKey(X), b.avant) : null;
    const libres = SLOTS.filter(s => s.scratch && !roster[s.i] && s.i !== sB.i);
    const dests = X ? [o && o.i !== t.i && (o.i === sB.i || !roster[o.i]) ? o : null, sB, ...libres].filter(s => s && fits(X, s)) : [null];
    for (const d of dests) {
      const cases = {};
      for (const [i, p] of Object.entries(roster)) if (p) cases[i] = getPlayerKey(p);
      delete cases[sB.i];
      cases[t.i] = getPlayerKey(B);
      if (X) cases[d.i] = getPlayerKey(X);
      if (problemesDAlignement(cases, parCle, { attendu, pleine: false }).length) continue;
      // Une case habillée remplie avant le retour l'est encore après.
      if (SLOTS.some(s => !s.scratch && roster[s.i] && !cases[s.i])) continue;
      return { cases, mouvements: [{ p: B, de: sB, vers: t }, ...(X ? [{ p: X, de: t, vers: d }] : [])] };
    }
  }
  return null;
}
