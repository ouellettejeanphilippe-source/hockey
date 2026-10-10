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
import { lectureDuMatch, attenduDeCote, autoRoster, createTeam, avecHasardIsole, trioAuMieux, echangesProposes, lignesAuMieux, coupsAttendus, COUP_JAMBES, CADRE_DU_MATCH, getPlayerKey, energieDe, activeLineup, motsDEffet, motsDeMutation, MUTATIONS, joueurDeMutation, badgesDeMutation } from './sim.js';
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
  // Chaque tireur de ton club, par match : sa part des lancers lus, et la chance de chacun (FE, avantage, désavantage).
  const joueurs = new Map();
  for (const [mode, tirs] of [['FE', feA], ['AN', nPour * wA.tirs], ['DN', dnA]]) {
    for (const [k, j] of L.joueurs[mode]) {
      const x = joueurs.get(k) || { tirs: 0, buts: 0 };
      x.tirs += tirs * j.t; x.buts += tirs * j.b;
      joueurs.set(k, x);
    }
  }
  /*
   * CHAQUE UNITÉ, CE QU'ELLE CHANGE (V6, la note qui bouge). JP : *les buts pour, sur l'effectif, ça veut rien, pis
   * c'est pas influencé par la stratégie on dirait* ; puis *un trio défensif pourrait être hyper pertinent et utile et
   * dans les moins*. À forces égales, par match, ce qu'elle fait de plus qu'une unité neutre à sa place, face aux
   * mêmes adversaires :
   *   attaque  = ses lancers, mieux (ou moins bien) convertis qu'avec un tireur, une création, une qualité et un
   *              système neutres ; plus son volume : les lancers qu'elle prend au-delà de sa part de glace ;
   *   défense  = les buts que sa défense sur la glace évite, contre une défense neutre devant les mêmes tireurs.
   * Un trio de fermeture qui prend leur premier trio se lit à la défense qu'il fait, pas au +/− qu'il subit.
   */
  const U = L.unites;
  const unites = g => {
    if (!U || !U.pour.n) return [];
    const nP = U.pour.n, nC = U.contre.n || 1, pnMoy = (U.pour.pn || 0) / nP, glace = U.glace[g] || [];
    return Array.from({ length: Math.max(glace.length, U.pour[g].length, U.contre[g].length) }, (_, i) => {
      const o = U.pour[g][i] || { n: 0, p: 0, pn: 0 }, d = U.contre[g][i] || { ev: 0 };
      const attaque = feA * ((o.p - o.pn) + (o.n - (glace[i] || 0) * nP) * pnMoy) / nP;
      const defense = feB * d.ev / nC;
      return { attaque, defense, net: attaque + defense };
    });
  };
  return {
    joueurs, partDuFilet: L.partDuFilet, unitesF: unites('F'), unitesD: unites('D'),
    tirsPour, tirsContre, rythme: tirsPour + tirsContre,
    butsPour: feA * p.pour.FE + nPour * wA.buts + dnA * p.pour.DN,
    butsContre: feB * p.contre.FE + nContre * wB.buts + dnB * p.contre.DN,
    punitions: nContre, punitionsEux: nPour, minutesDesavantage: nContre * wB.long, minutesAvantage: nPour * wA.long,
    coups: coupsAttendus(A), bagarres: L.bagarres,
    blessures: L.blessures, usure: L.usure,
    glaceF: glace('F'), glaceD: glace('D'),
    // Les minutes à forces égales du soir (ni avantage ni désavantage) : la glace de « Préparer le match » s'y lit.
    minutesFE: 60 * part,
  };
}

/* La mémoire des lectures : une même scène (club, alignement, effets du jour) ne se lit qu'une fois, le temps d'un écran. */
const MEMOIRE = new Map();
const VIE_MS = 2000, MEMOIRE_MAX = 80;
function cle(team, lu, adv, opts) {
  const J = x => JSON.stringify(x, (k, v) => (v === Infinity ? 'inf' : v === -Infinity ? '-inf' : v));
  const joueurs = Object.values(lu || activeLineup(team)).map(p => (p ? `${getPlayerKey(p)}:${Math.round(energieDe(p))}:${p._mutCles || ''}:${p._cran || ''}:${p._amel ? 1 : 0}:${p._partout ? 1 : 0}:${p._enBas ? 1 : 0}:${p._ombre || ''}:${p._abri || ''}:${p._palier || ''}:${p._mentor ? 1 : 0}:${(p._carte && p._carte.rar) || ''}` : '-'));
  try {
    return J([team.name, team.jourCourant, team.games, joueurs, team.cartes, (team.patrons || []).map(x => x.cle), (team.coachs || []).map(x => [x.cle, x.palier]),
      team.effets, team.effetsSerie, team._effetMatch, team.roulement, team.lignes, team.fermeture, team.appariement, !!team.isPlayer, team._filetForce, team._filetMatch, team.gardienAux, adv && [adv.name, adv.games, adv.appariement, !!adv.isPlayer],
      opts.aVenir, opts.effets, opts.effetsAdv, opts.lignes, opts.mutation && [opts.mutation.cle, opts.mutation.retirer, opts.mutation.rien, opts.mutation.joueur ? getPlayerKey(opts.mutation.joueur) : null],
      opts.nu, opts.neutre, opts.n, opts.series]);
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

/*
 * ALIGNER AU MIEUX, JUGÉ PAR LE MOTEUR (oct.). JP : *aligner au mieux considéré positions, stratégie, etc.* La
 * lecture rapide (`trioAuMieux`, js/sim.js) propose ; le moteur tranche, sur les buts pour et contre d'un soir contre
 * un club moyen (`lectureDuMatch`, ce que `check_chiffres` prouve égal au jeu), chaque alignement avec les systèmes
 * de son style (`lignesAuMieux`). L'alignement de l'IA (`autoRoster`) est toujours candidat : le bouton ne fait jamais
 * pire qu'elle. Puis, quelques tours, les échanges les plus prometteurs (`echangesProposes`), gardés si le moteur les
 * voit meilleurs. Le style pèse les buts : l'offensif compte plus ceux qu'on marque, le défensif ceux qu'on évite.
 */
const POIDS_STYLE = { equilibre: [1, 1], offensif: [1.5, 0.5], defensif: [0.5, 1.5] };
const TOURS_AU_MIEUX = 3, ECHANGES_LUS = 10;
export function alignementAuMieux(joueurs, style = 'equilibre') {
  const [wP, wC] = POIDS_STYLE[style] || POIDS_STYLE.equilibre;
  const saison = (joueurs.find(p => p && p.s) || {}).s;
  // Sous un hasard à part : le club lu tire sa chance de saison, et la saison en cours ne doit pas bouger d'un dé.
  const lu = R => avecHasardIsole('au mieux', () => {
    const T = createTeam('Au mieux', 'MOI', R, { season: saison });
    T.lignes = lignesAuMieux(R, style);
    const m = moyennes(lectureDuMatch(T, R, null, { n: N_BASE }));
    return wP * m.butsPour - wC * m.butsContre;
  });
  let best = null, score = -Infinity;
  for (const R of [trioAuMieux(joueurs, style), autoRoster(joueurs)]) {
    const v = lu(R);
    if (v > score + 1e-9) { best = R; score = v; }
  }
  for (let tour = 0; tour < TOURS_AU_MIEUX; tour++) {
    let mieux = false;
    for (const [sa, sb] of echangesProposes(best, style, ECHANGES_LUS)) {
      const R = { ...best };
      [R[sa.i], R[sb.i]] = [R[sb.i], R[sa.i]];
      const v = lu(R);
      if (v > score + 1e-9) { best = R; score = v; mieux = true; }
    }
    if (!mieux) break;
  }
  return best;
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
  if (Math.abs(d.coups) >= SEUILS.coups) out.push({ txt: `≈ ${signeDe(d.coups)}${nb(d.coups, 0)} ${mot(Math.round(d.coups), 'mise en échec', 'mises en échec')} ${par}`, bon: null, cle: 'coup' });
  return out;
}

/* Les canaux dont le match se lit dans la feuille. Les autres (blessure, jambes, glace) ont leur unité à eux. */
const CANAUX_MATCH = ['volume', 'finition', 'defense', 'discipline', 'robustesse'];
const differences = (a, b) => Object.fromEntries(Object.keys(a).filter(k => k !== 'joueurs').map(k => [k, Array.isArray(a[k]) ? a[k].map((x, i) => x - b[k][i]) : a[k] - b[k]]));
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
  const d = differences(avec, sans), mots = [...lignesDe(d), ...horsFeuille(d)];
  // Des effets qui jouent, trop petits pour une feuille : on le dit plutôt que de taire.
  return mots.length || ![d.tirsPour, d.tirsContre, d.butsPour, d.butsContre, d.punitions, d.blessures, d.usure].some(x => Math.abs(x) > 1e-9) ? mots : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }];
}
/*
 * CE QUE LA FEUILLE NE DIT PAS (V2.2) : les blessures et l'usure des jambes jouent aussi ce soir (la consigne
 * Haute, un roulement, un dos-à-dos). Les blessures se disent sur dix matchs — un soir en compte une sur cinquante.
 */
function horsFeuille(d) {
  const out = [];
  const b = d.blessures * 10;
  if (Math.abs(b) >= 0.05) out.push({ txt: `≈ ${signeDe(b)}${nb(b, 1)} ${mot(b, 'blessure', 'blessures')} par 10 matchs`, bon: b < 0, cle: 'blessure' });
  if (Math.abs(d.usure) >= 0.1) out.push({ txt: `≈ ${signeDe(d.usure)}${nb(d.usure, 1)} ${mot(d.usure, 'jambe', 'jambes')} d'usure par match`, bon: d.usure < 0, cle: 'jambes' });
  return out;
}

/*
 * CE QUE TON ALIGNEMENT FAIT CE SOIR (V2.2, les totaux du soir disent tout). Les effets ne sont pas tout : tes
 * systèmes, tes badges, la chimie de tes lignes et leurs jambes jouent aussi, et une affiche qui disait « aucun
 * effet » un soir chargé mentait par omission. Chacun se lit par différence (`neutre`, js/sim.js) : le soir tel
 * quel contre le même soir où cette part est au neutre. Un nombre par part, l'écart de buts par match — ce que
 * la part rapporte (ou coûte) au pointage.
 */
export const PARTS_DU_SOIR = [
  ['systemes', 'Systèmes'], ['badges', 'Badges'], ['chimie', 'Chimie'], ['jambes', 'Jambes'],
];
export function alignementDuSoir(team, lineup = null, adv = null, aVenir = []) {
  if (!team) return [];
  const tel = lire(team, lineup, adv, { aVenir, n: N_EFFET });
  return PARTS_DU_SOIR.map(([k, nom]) => {
    const sans = lire(team, lineup, adv, { aVenir, neutre: { [k]: true }, n: N_EFFET });
    const ecart = (tel.butsPour - tel.butsContre) - (sans.butsPour - sans.butsContre);
    const txt = Math.abs(ecart) >= 0.01 ? `${nom} ≈ ${signeDe(ecart)}${nb(ecart, 2)} but net par match` : `${nom} : rien ce soir`;
    return { txt, bon: Math.abs(ecart) >= 0.01 ? ecart > 0 : null, cle: k, ecart };
  });
}

/*
 * LA NOTE QUI BOUGE (V6, docs/refonte-v6.md). Chaque trio et chaque paire de ton club : ce qu'il fait de plus qu'une
 * unité neutre à sa place, à forces égales, par match, contre `adv` — en attaque, en défense, et les deux ensemble.
 * Il suit son système, sa chimie, ses badges, ses jambes et ses cases. `lignes` : celles à lire (le banc).
 */
export function unitesDuSoir(team, lineup, adv, lignes = null) {
  if (!team) return null;
  const m = lire(team, lineup, adv, { lignes, n: N_BASE });
  return { F: m.unitesF, D: m.unitesD };
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
  // CE QUE LE JEU PHYSIQUE FAIT DE PLUS (V2.2) : les jambes que tes coups ôtent à l'adversaire, et les bagarres.
  const otees = d.coups * COUP_JAMBES;
  if (Math.abs(otees) >= 0.5) out.push({ txt: `≈ ${signeDe(otees)}${nb(otees, 1)} jambes ôtées à l'adversaire par match`, bon: otees > 0, cle: 'coupsJambes' });
  const bag = d.bagarres * 10;
  if (Math.abs(bag) >= 0.05) out.push({ txt: `≈ ${signeDe(bag)}${nb(bag, 1)} ${mot(bag, 'bagarre', 'bagarres')} par 10 matchs`, bon: null, cle: 'bagarre' });
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
 * UN CHANGEMENT DE CARTE, EN CHIFFRES. JP : *les events de modifications de joueur, « +25 déf », ça veut rien
 * dire.* Une modif touche UN joueur : au niveau du club, un joueur sur vingt ne fait qu'un dixième de but par
 * match, et le dire par match la rendait invisible. On la dit donc d'abord À LUI — ses buts et ses tirs d'ici la
 * fin de la saison, lus dans le moteur (ses lancers et leur chance, `lectureDuMatch`) —, puis à ton club sur la
 * même durée, puis ce qu'il devient (ses badges, `badgesDeMutation`), jamais en points de profil. Le moteur la
 * pose sur le joueur le temps de la lecture ; une carte qui ne vise personne (« libre ») se lit sur un joueur du
 * premier trio, celle qui vise un profil sur le joueur qu'elle choisirait.
 */
const CANAUX_MUTATION = ['lancers', 'finition', 'creation', 'defense', 'blessure', 'arrets', 'ombre', 'abri'];
const N_MUTATION = 2000;   // un joueur tire un lancer sur vingt : il en faut plus pour lire les siens
const auMatch = x => (Math.abs(x) >= 9.5 ? String(Math.round(Math.abs(x))) : virgule(Math.abs(x).toFixed(1)));
/* Un printemps qui va loin : quatre rondes de cinq matchs. */
const MATCHS_DE_SERIES_LUS = 20;
export function motsDeMutationEnChiffres(cle, joueur = null, { deja = false } = {}) {
  const base = motsDeMutation(cle).filter(m => m.cle !== 'role' && !m.txt.includes(' %')), M = MUTATIONS[cle], c = clubLu();
  if (!c || !c.team || !M) return motsDeMutation(cle);
  // Le joueur nommé, tel que le club lu le porte : la carte de l'écran peut être une autre copie du même joueur-saison.
  if (joueur) {
    const k = getPlayerKey(joueur);
    joueur = [...Object.values(c.lineup || activeLineup(c.team)), ...Object.values(c.team.roster || {})].find(q => q && getPlayerKey(q) === k) || joueur;
  }
  const p = joueurDeMutation(c.team, c.lineup || null, cle, joueur);
  const badges = p ? badgesDeMutation(p, cle, { deja }) : [];
  if (!CANAUX_MUTATION.some(k => M[k])) return [...badges, ...base];
  let avec, sans;
  try {
    // Une modif à poser : le soir avec elle contre sans. Une modif déjà posée (`deja`) : le soir tel qu'il est contre le même soir sans elle.
    const L = o => lire(c.team, c.lineup || null, c.adv || null, { ...o, n: N_MUTATION });
    const tel = { mutation: { cle, joueur, rien: true } };   // le même joueur lu, sans rien poser (le gardien qu'elle vise devant le filet)
    if (deja) { avec = L(tel); sans = L({ mutation: { cle, joueur, retirer: true } }); } else { avec = L({ mutation: { cle, joueur } }); sans = L(tel); }
  } catch { return motsDeMutation(cle); }
  const d = differences(avec, sans);
  // UNE MODIF D'UN MOMENT (V3.4, `si`) se lit un soir où son moment est vrai : la moitié des soirs pour domicile ou
  // l'étranger ; en séries, sur un printemps (`MATCHS_DE_SERIES_LUS`).
  const resteSaison = Math.max(1, 82 - (c.team.games || 0));
  const reste = M.si === 'series' ? MATCHS_DE_SERIES_LUS : M.si ? Math.round(resteSaison / 2) : resteSaison;
  const quand = M.si === 'series' ? `sur ${MATCHS_DE_SERIES_LUS} matchs de séries`
    : `${resteSaison >= 82 ? 'sur la saison' : `d'ici la fin (${resteSaison} matchs)`}${M.si === 'domicile' ? ', à domicile' : M.si === 'visiteur' ? ', à l\'étranger' : ''}`;
  const out = [];
  // À LUI : ses buts et ses tirs (un patineur), ou les buts que son filet accorde (un gardien : ceux du club, c'est lui).
  if (p && p.p !== 'G') {
    const k = getPlayerKey(p), a = avec.joueurs.get(k) || { tirs: 0, buts: 0 }, b = sans.joueurs.get(k) || { tirs: 0, buts: 0 };
    const db = (a.buts - b.buts) * reste, dt = (a.tirs - b.tirs) * reste;
    const bits = [];
    if (Math.abs(db) >= 0.5) bits.push(`${signeDe(db)}${auMatch(db)} ${mot(db, 'but', 'buts')}`);
    if (Math.abs(dt) >= 3) bits.push(`${signeDe(dt)}${auMatch(dt)} tirs`);
    if (bits.length) out.push({ txt: `${p.n} : ≈ ${bits.join(', ')} ${quand}`, bon: (Math.abs(db) >= 0.5 ? db : dt) > 0, cle: 'lui' });
  }
  // À TON CLUB, sur la même durée : les buts marqués et accordés (ce que sa création, sa défense ou ses arrêts rapportent aux autres aussi).
  // Une carte de gardien ne joue que les soirs où il garde le filet.
  const bp = d.butsPour * reste, bc = d.butsContre * reste * (M.gardien ? avec.partDuFilet : 1);
  if (Math.abs(bp) >= 0.5) out.push({ txt: `Ton club : ≈ ${signeDe(bp)}${auMatch(bp)} ${mot(bp, 'but marqué', 'buts marqués')} ${quand}`, bon: bp > 0, cle: 'but' });
  if (Math.abs(bc) >= 0.5) out.push({ txt: `Ton club : ≈ ${signeDe(bc)}${auMatch(bc)} ${mot(bc, 'but accordé', 'buts accordés')} ${quand}`, bon: bc < 0, cle: 'butContre' });
  if (M.blessure) {
    const n = d.blessures * reste;
    out.push(Math.abs(n) >= 0.1 ? { txt: `≈ ${signeDe(n)}${nb(n, 1)} ${mot(n, 'blessure', 'blessures')} ${quand}`, bon: n < 0, cle: 'blessure' } : { txt: 'blessures : à peine perceptible', bon: null, cle: 'rien' });
  }
  const qui = joueur || !p ? [] : [{ txt: M.gardien ? `sur ${p.n}, le partant` : `sur ${p.n}`, bon: null, duree: true }];
  return [...(out.length ? out : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }]), ...badges, ...qui, ...base];
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
