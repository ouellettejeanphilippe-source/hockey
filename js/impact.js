/*
 * L'IMPACT EN CHIFFRES DE MATCH (docs/impact-des-choix.md §5). JP : *les pourcentages, ça me dit fuck all
 * ce que ça impacte dans le match.* Un effet se dit donc en ce que le joueur lit dans la feuille — des
 * tirs, des buts, des punitions, des mises en échec, des minutes — pour CE club, CE soir, jamais en « % ».
 *
 * UN SEUL CALCUL. Le nombre de lancers vient d'`attenduDeCote` (js/sim.js), la fonction même que le moteur
 * joue ; la chance d'un lancer vient de `jouerCote` lui-même, interrogé sans tirer le but
 * (`lectureDuMatch`). Rien n'est recopié : ce que l'écran annonce est la moyenne que le moteur joue
 * (`scripts/check_chiffres.mjs` le prouve contre des milliers de matchs). Pur : aucun DOM, aucun `hasard()`
 * du match — la lecture se fait sous un hasard à part, et la saison en cours ne bouge pas d'un dé.
 *
 * Aucune cote : ce sont des moyennes de profil, comme les totaux du soir, jamais la cote d'un joueur.
 */
import { lectureDuMatch, attenduDeCote, coupsAttendus, CADRE_DU_MATCH, getPlayerKey, energieDe, activeLineup, motsDEffet, motsDeMutation, MUTATIONS } from './sim.js';
import { virgule } from './util.js';

const { AN_MINUTES, AN_TIRS_MIN, DN_TIRS_MIN, FE_TIRS } = CADRE_DU_MATCH;
const N_BASE = 1600;    // les lancers lus pour le niveau absolu d'un soir (±1 % sur les buts)
const N_EFFET = 400;    // pour la différence : les deux lectures partagent leurs dés, le bruit s'en va

/* Une fenêtre d'avantage de deux minutes : le premier but la ferme (un but = un arrêt du processus de lancers), donc sa durée moyenne est (1 − e^(−2λ)) / λ. */
function fenetre(volume, p) {
  const r = AN_TIRS_MIN * volume;            // lancers par minute de l'équipe en avantage
  const lambda = r * p;                      // buts par minute
  const long = lambda > 1e-9 ? (1 - Math.exp(-lambda * AN_MINUTES)) / lambda : AN_MINUTES;
  return { long, tirs: r * long, buts: p * r * long };
}

/* Les moyennes d'un match, lues d'une lecture du moteur. Les mêmes formules que `jouerSoixanteMinutes`. */
function moyennes(L) {
  const { A, B, occasions, p } = L;
  const nPour = occasions * B.discipline, nContre = occasions * A.discipline;   // les avantages que A prend, ceux que A donne
  const wA = fenetre(A.avantage ? A.avantage.volume : 1, p.pour.AN);
  const wB = fenetre(B.avantage ? B.avantage.volume : 1, p.contre.AN);
  const part = Math.max(0.5, (60 - nPour * wA.long - nContre * wB.long) / 60);
  const feA = attenduDeCote(A, B) * part * FE_TIRS, feB = attenduDeCote(B, A) * part * FE_TIRS;
  const dnA = DN_TIRS_MIN * nContre * wB.long, dnB = DN_TIRS_MIN * nPour * wA.long;
  const tirsPour = feA + nPour * wA.tirs + dnA, tirsContre = feB + nContre * wB.tirs + dnB;
  const glace = g => {
    const u = (A.unites && A.unites[g]) || [], s = u.reduce((a, x) => a + x.presence, 0) || 1;
    return u.map(x => 60 * x.presence / s);
  };
  return {
    tirsPour, tirsContre, rythme: tirsPour + tirsContre,
    butsPour: feA * p.pour.FE + nPour * wA.buts + dnA * p.pour.DN,
    butsContre: feB * p.contre.FE + nContre * wB.buts + dnB * p.contre.DN,
    punitions: nContre, punitionsEux: nPour, minutesDesavantage: nContre * wB.long, minutesAvantage: nPour * wA.long,
    coups: coupsAttendus(A),
    blessures: L.blessures, usure: L.usure,
    glaceF: glace('F'), glaceD: glace('D'),
  };
}

/* La mémoire des lectures : une même scène (club, alignement, effets du jour) ne se lit qu'une fois, le temps d'un écran. */
const MEMOIRE = new Map();
const VIE_MS = 2000, MEMOIRE_MAX = 80;
function cle(team, lu, adv, opts) {
  const J = x => JSON.stringify(x, (k, v) => (v === Infinity ? 'inf' : v === -Infinity ? '-inf' : v));
  const joueurs = Object.values(lu || activeLineup(team)).map(p => (p ? `${getPlayerKey(p)}:${Math.round(energieDe(p))}:${p._mutCles || ''}:${p._cran || ''}:${p._amel ? 1 : 0}:${p._partout ? 1 : 0}:${p._enBas ? 1 : 0}:${p._ombre || ''}:${p._abri || ''}` : '-'));
  try {
    return J([team.name, team.jourCourant, team.games, joueurs, team.cartes, (team.patrons || []).map(x => x.cle), (team.coachs || []).map(x => [x.cle, x.palier]),
      team.effets, team.effetsSerie, team._effetMatch, team.roulement, team.lignes, team.fermeture, team._filetForce, team._filetMatch, team.gardienAux, adv && [adv.name, adv.games],
      opts.aVenir, opts.effets, opts.effetsAdv, opts.lignes, opts.mutation && [opts.mutation.cle, opts.mutation.retirer, opts.mutation.joueur ? getPlayerKey(opts.mutation.joueur) : null],
      opts.nu, opts.n, opts.series]);
  } catch { return null; }   // un état qui ne se range pas en clé (une référence circulaire) : on lit sans mémoire
}
function lire(team, lu, adv, opts) {
  const k = cle(team, lu, adv, opts), maintenant = Date.now(), vu = k === null ? null : MEMOIRE.get(k);
  if (vu && maintenant - vu.t < VIE_MS) return vu.m;
  const m = moyennes(lectureDuMatch(team, lu, adv, opts));
  if (k !== null) {
    if (MEMOIRE.size >= MEMOIRE_MAX) MEMOIRE.delete(MEMOIRE.keys().next().value);
    MEMOIRE.set(k, { t: maintenant, m });
  }
  return m;
}

/**
 * Ce que le soir d'un club vaut en nombres de match, avec ses effets du jour : tirs pour et contre, buts,
 * punitions, minutes à quatre contre cinq, mises en échec attendues. `adv` : l'adversaire ; sans lui, un club moyen.
 */
export function chiffresDuSoir(team, lineup = null, adv = null, aVenir = []) {
  return lire(team, lineup, adv, { aVenir, n: N_BASE });
}

/* ---- les mots ---- */

const nb = (x, d) => virgule(Math.abs(x).toFixed(d));
const signeDe = x => (x > 0 ? '+' : '−');
const mot = (x, un, plusieurs) => (Math.abs(x) < 2 ? un : plusieurs);
const RANGS = { F: ['1er trio', '2e trio', '3e trio', '4e trio'], D: ['1re paire', '2e paire', '3e paire'] };

/* « ≈ +2,1 tirs par match » : le chiffre d'abord, l'unité de match toujours. */
const SEUILS = { tirs: 0.15, buts: 0.1, rare: 0.03, punitions: 0.1, coups: 1, minutes: 0.3 };
function lignesDe(d, par = 'par match') {
  const out = [];
  const tirs = (x, un, plur, bon) => {
    if (Math.abs(x) < SEUILS.tirs) return;
    out.push({ txt: `≈ ${signeDe(x)}${nb(x, 1)} ${mot(x, un, plur)} ${par}`, bon: bon ? x > 0 : x < 0, cle: un });
  };
  const buts = (x, marque) => {
    const a = Math.abs(x);
    if (a < SEUILS.rare) return;
    const bon = marque ? x > 0 : x < 0;
    if (a < SEUILS.buts) {
      if (par !== 'par match') return;
      const n = Math.round(1 / a);
      out.push({ txt: marque ? `≈ 1 but ${x > 0 ? 'de plus' : 'de moins'} marqué tous les ${n} matchs` : `≈ 1 but accordé ${x > 0 ? 'de plus' : 'de moins'} tous les ${n} matchs`, bon, cle: marque ? 'but' : 'butContre' });
      return;
    }
    out.push({ txt: `≈ ${signeDe(x)}${nb(x, 2)} but ${marque ? 'marqué' : 'accordé'} ${par}`, bon, cle: marque ? 'but' : 'butContre' });
  };
  tirs(d.tirsPour, 'tir', 'tirs', true);
  tirs(d.tirsContre, 'tir accordé', 'tirs accordés', false);
  buts(d.butsPour, true);
  buts(d.butsContre, false);
  if (Math.abs(d.punitions) >= SEUILS.punitions) out.push({ txt: `≈ ${signeDe(d.punitions)}${nb(d.punitions, 1)} ${mot(d.punitions, 'punition', 'punitions')} ${par}`, bon: null, cle: 'punition' });
  if (Math.abs(d.coups) >= SEUILS.coups) out.push({ txt: `≈ ${signeDe(d.coups)}${nb(d.coups, 0)} ${mot(d.coups, 'mise en échec', 'mises en échec')} ${par}`, bon: null, cle: 'coup' });
  return out;
}

/* Les canaux dont le match se lit dans la feuille. Les autres (blessure, jambes, glace) ont leur unité à eux. */
const CANAUX_MATCH = ['volume', 'finition', 'defense', 'discipline', 'robustesse'];
const differences = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, Array.isArray(a[k]) ? a[k].map((x, i) => x - b[k][i]) : a[k] - b[k]]));
/* Le cadre d'une lecture : la part du match qui reste (une 3e période : 1/3) et comment la dire (« en 3e »). */
const surLaPart = (d, part) => (part === 1 ? d : { ...d, tirsPour: d.tirsPour * part, tirsContre: d.tirsContre * part, butsPour: d.butsPour * part, butsContre: d.butsContre * part, punitions: d.punitions * part, coups: d.coups * part });

/**
 * Un effet (des canaux : volume, finition, defense, discipline, blessure, energie, robustesse, F, D), dit en
 * chiffres de match pour CE club, CE soir : la différence entre le soir avec lui et sans lui. `duree` (des
 * matchs) : une blessure se dit alors sur cette durée plutôt que sur la saison.
 * → [{ txt: '≈ +2,1 tirs par match', bon: true, cle: 'tir' }, …] ; vide quand l'effet n'a aucun canal de match.
 */
export function effetEnChiffres(effet, team, lineup = null, adv = null, { duree = null, part = 1, par = 'par match', eux = false } = {}) {
  if (!effet) return [];
  const e = {};
  for (const k of [...CANAUX_MATCH, 'blessure', 'energie', 'F', 'D']) {
    const v = effet[k];
    if (v == null || (k === 'robustesse' ? v === 0 : v === 1) || (Array.isArray(v) && v.every(m => m === 1))) continue;
    e[k] = v;
  }
  if (!Object.keys(e).length) return [];
  const sans = lire(team, lineup, adv, { n: N_EFFET }), avec = lire(team, lineup, adv, eux ? { effetsAdv: [e], n: N_EFFET } : { effets: [e], n: N_EFFET });
  let d = differences(avec, sans);
  // Un effet sur EUX se lit de leur côté : leurs tirs sont ceux qu'on accorde, leurs buts ceux qu'on encaisse.
  if (eux) d = { ...d, tirsPour: d.tirsContre, tirsContre: d.tirsPour, butsPour: d.butsContre, butsContre: d.butsPour, punitions: d.punitionsEux, coups: 0 };
  const out = [];
  if (CANAUX_MATCH.some(k => k in e)) {
    const l = lignesDe(surLaPart(d, part), par);
    out.push(...(l.length ? l : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }]));
  }
  if (e.blessure != null && !eux) {
    const sur = duree || 82, n = d.blessures * sur;
    if (Math.abs(n) >= 0.1) out.push({ txt: `≈ ${signeDe(n)}${nb(n, 1)} ${mot(n, 'blessure', 'blessures')} ${duree ? `sur ${duree} match${duree > 1 ? 's' : ''}` : 'par saison'}`, bon: n < 0, cle: 'blessure' });
    else out.push({ txt: 'blessures : à peine perceptible', bon: null, cle: 'rien' });
  }
  if (e.energie != null) {
    // Les jambes d'un club qu'on ne voit pas (eux) : l'usure d'un club comme le tien, sous le même effet.
    const usure = eux ? lire(team, lineup, adv, { effets: [{ energie: e.energie }], n: N_EFFET }).usure - sans.usure : d.usure;
    if (Math.abs(usure) >= 0.1) out.push({ txt: `≈ ${signeDe(usure)}${nb(usure, 1)} ${mot(usure, 'jambe', 'jambes')} d'usure ${par}`, bon: usure < 0, cle: 'jambes' });
    else out.push({ txt: 'jambes : à peine perceptible', bon: null, cle: 'rien' });
  }
  for (const g of ['F', 'D']) if (!eux && Array.isArray(e[g])) e[g].forEach((m, i) => {
    if (m === 1) return;
    const x = d[g === 'F' ? 'glaceF' : 'glaceD'][i];
    out.push({ txt: Math.abs(x) >= SEUILS.minutes ? `${RANGS[g][i]} : ≈ ${signeDe(x)}${nb(x, 1)} min de glace ${par}` : `${RANGS[g][i]} : glace presque inchangée`, bon: null, cle: 'glace' });
  });
  return out;
}

/**
 * Ce que le BUILD change ce soir : tous les effets actifs (cartes, patrons, coachs, moments, consigne, roulement)
 * contre le même alignement sans aucun. Remplace les « Tirs +14 % · Précision −3 % » du total du soir.
 * `aVenir` : les décisions du jour pas encore jouées (la consigne qu'on vient de choisir).
 */
export function motsDuSoir(team, lineup = null, adv = null, aVenir = []) {
  if (!team) return [];
  const avec = lire(team, lineup, adv, { aVenir, n: N_EFFET }), sans = lire(team, lineup, adv, { aVenir, nu: true, n: N_EFFET });
  const d = differences(avec, sans), mots = lignesDe(d);
  // Des effets qui jouent, trop petits pour une feuille : on le dit plutôt que de taire.
  return mots.length || ![d.tirsPour, d.tirsContre, d.butsPour, d.butsContre, d.punitions].some(x => Math.abs(x) > 1e-9) ? mots : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }];
}

/*
 * UN RÉGLAGE DE LIGNES, EN CHIFFRES : le soir joué avec ces lignes contre le même soir joué avec les
 * autres. Le système, l'agressivité et la glace jouent ligne par ligne dans le moteur ; on lui fait
 * jouer les deux versions, sous les mêmes dés (l'action spéciale d'un système se lit par son espérance,
 * pas par un dé : la différence n'est pas du bruit).
 */
const N_LIGNES = 500;
/** La différence de deux jeux de lignes (quatre `{ tac, tacD, agr, sec }`), en mots de match. */
export function lignesEnChiffres(team, lineup, adv, lignes, contre) {
  if (!team) return [];
  const a = lire(team, lineup, adv, { lignes, n: N_LIGNES }), b = lire(team, lineup, adv, { lignes: contre, n: N_LIGNES });
  const d = differences(a, b), out = lignesDe(d);
  if (Math.abs(d.usure) >= 0.1) out.push({ txt: `≈ ${signeDe(d.usure)}${nb(d.usure, 1)} ${mot(d.usure, 'jambe', 'jambes')} d'usure par match`, bon: d.usure < 0, cle: 'jambes' });
  return out;
}
const surLigne = (lignes, u, patch) => lignes.map((l, i) => (i === u ? { ...l, ...patch } : l));
/** Un système sur la ligne `u` (`groupe` F : le trio, D : la paire), contre aucun système sur cette ligne : ce qu'il fait à CE club CE soir. */
export function systemeEnChiffres(team, lineup, adv, lignes, u, groupe, cle) {
  const champ = groupe === 'D' ? 'tacD' : 'tac';
  return lignesEnChiffres(team, lineup, adv, surLigne(lignes, u, { [champ]: cle }), surLigne(lignes, u, { [champ]: 'hourra' }));
}
/** Une agressivité sur la ligne `u`, contre la moyenne : des mises en échec, des punitions, des tirs. */
export function agressiviteEnChiffres(team, lineup, adv, lignes, u, agr) {
  return lignesEnChiffres(team, lineup, adv, surLigne(lignes, u, { agr }), surLigne(lignes, u, { agr: 1 }));
}


/*
 * UN CHANGEMENT DE CARTE, EN CHIFFRES : le moteur le pose sur un joueur le temps de la lecture. Une carte qui ne
 * vise personne (« libre ») se lit sur un joueur du premier trio ; celle qui vise un profil, sur le joueur qu'elle
 * choisirait. Le reste de ses mots (les rôles, le placement) ne sont pas des pourcentages : ils restent.
 */
const CANAUX_MUTATION = ['lancers', 'finition', 'creation', 'defense', 'blessure', 'arrets', 'ombre', 'abri'];
export function motsDeMutationEnChiffres(cle, joueur = null, { deja = false } = {}) {
  const base = motsDeMutation(cle), M = MUTATIONS[cle], c = clubLu();
  if (!c || !c.team || !M || !CANAUX_MUTATION.some(k => M[k])) return base;
  let d;
  try {
    // Une modif à poser : le soir avec elle contre sans. Une modif déjà posée (`deja`) : le soir tel qu'il est contre le même soir sans elle.
    const L = o => lire(c.team, c.lineup || null, c.adv || null, { ...o, n: N_EFFET });
    d = deja ? differences(L({}), L({ mutation: { cle, joueur, retirer: true } })) : differences(L({ mutation: { cle, joueur } }), L({}));
  } catch { return base; }
  const out = lignesDe(d);
  if (M.blessure) {
    const n = d.blessures * 82;
    out.push(Math.abs(n) >= 0.1 ? { txt: `≈ ${signeDe(n)}${nb(n, 1)} ${mot(n, 'blessure', 'blessures')} par saison`, bon: n < 0, cle: 'blessure' } : { txt: 'blessures : à peine perceptible', bon: null, cle: 'rien' });
  }
  const qui = joueur ? [] : [{ txt: M.cible === 'libre' ? 'sur un joueur du 1er trio' : 'sur le joueur visé', bon: null, duree: true }];
  return [...(out.length ? out : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }]), ...qui, ...base.filter(m => !m.txt.includes(' %'))];
}

/* ---- le club qu'on lit ---- */

let CLUB = null;
/** Le club dont on lit les effets (game.js le lui donne) : `() => ({ team, lineup, adv })`, ou `null` hors partie. */
export function poserClubLu(f) { CLUB = f; }
/** Le club lu en ce moment : `{ team, lineup, adv }`, ou `null`. */
export const clubLu = () => (CLUB && CLUB()) || null;
/**
 * Un effet dit pour le club courant, avec ses autres mots (le changement de carte, la durée) : le remplaçant
 * de `motsDEffet` partout où un joueur lit ce qu'un choix fait au match. Sans club — ou si la lecture est
 * impossible (un alignement trop vide au repêchage) —, les mots d'avant.
 * `cadre` : { part, par, eux } — une 3e période seulement (« en 3e »), ou l'effet que l'adversaire reçoit.
 */
export function motsEnChiffres(effet, duree = null, cadre = null) {
  const c = clubLu();
  if (!c || !c.team || !effet) return motsDEffet(effet, duree);
  let chiffres;
  try { chiffres = effetEnChiffres(effet, c.team, c.lineup || null, c.adv || null, { duree, ...(cadre || {}) }); } catch { return motsDEffet(effet, duree); }
  return [...chiffres, ...(effet.mutation ? motsDEffet({ mutation: effet.mutation }) : []), ...(duree ? motsDEffet({}, duree) : [])];
}
