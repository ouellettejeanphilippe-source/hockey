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
import { lectureDuMatch, attenduDeCote, autoRoster, createTeam, avecHasardIsole, trioAuMieux, echangesProposes, coupsAttendus, CADRE_DU_MATCH, getPlayerKey, energieDe, activeLineup, MUTATIONS, joueurDeMutation, badgesDeMutation, avecAVenir, matchsEntre, POIDS_AN, POIDS_DN, MOMENTS_SI, SLOTS, getPositionPenalty, PROFILS, PART_UNITE, penaliteAdaptee } from './sim.js';
import { PLANS, cibleDuPlan } from './greffes.js';
import { virgule } from './util.js';
import { PIECES, bancDe, effetDuRelais } from './pieces.js';

const { AN_MINUTES, AN_TIRS_MIN, DN_TIRS_MIN, FE_TIRS } = CADRE_DU_MATCH;
const N_BASE = 1600;    // les lancers lus pour le niveau absolu d'un soir (±1 % sur les buts)
const N_EFFET = 400;
/*
 * EN VRAIES STATS (V7, JP : *je veux des lancers, précision de lancer, pourcentage d'arrêt, des vrais stats* ; *un coach
 * qui change un joueur se dit pas : je vais gagner 1,2 match de plus*). Une lecture du soir se dit comme une feuille de
 * match : les tirs, la réussite au tir (les buts sur les tirs), les tirs contre, le % d'arrêts. Un choix se lit par
 * l'écart entre deux lectures du même soir, sous les mêmes dés.
 */
export const statsDe = m => ({
  tirs: m.tirsPour, pctTir: m.tirsPour > 0 ? m.butsPour / m.tirsPour : 0,
  contre: m.tirsContre, pctArr: m.tirsContre > 0 ? 1 - m.butsContre / m.tirsContre : 0,
});
/** L'écart de stats de deux lectures du même genre (`a` moins `b`), dans la forme de `motsDeStats`. */
export const statsEntre = (a, b) => { const x = statsDe(a), y = statsDe(b); return { tirs: x.tirs - y.tirs, pctTir: x.pctTir - y.pctTir, contre: x.contre - y.contre, pctArr: x.pctArr - y.pctArr }; };
/* Le poids d'un écart, pour dire d'abord ce qui bouge le plus : un demi-tir vaut trois millièmes d'arrêts. */
const PAS_STAT = { tirs: 0.5, pctTir: 0.002, contre: 0.5, pctArr: 0.003, punitions: 0.1, usure: 1 };
const SEUIL_STAT = { tirs: 0.1, pctTir: 0.0005, contre: 0.1, pctArr: 0.0005, punitions: 0.03, usure: 0.1 };
/*
 * LE BRUIT D'UN CHOIX (nov. 2026 ; JP : *le texte et les effets sont pas toujours clairs*). Un plan dit ce qu'il fait par
 * match, au duel par période ; et ce qui bouge moins qu'un tir, un demi-point ou un tiers de punition par match ne se dit
 * pas (rogue.md, « une ligne sous le bruit ne se dit pas » ; les mêmes seuils que `lignesDe`) : il ne colore plus la
 * carte ni son étiquette. Une période, c'est le tiers d'un match : ses seuils de compte le sont aussi.
 */
const BRUIT = { 'par match': { tirs: 1, pctTir: 0.005, contre: 1, pctArr: 0.005, punitions: 0.3, usure: 0.3 },
  'la période': { tirs: 0.34, pctTir: 0.005, contre: 0.34, pctArr: 0.005, punitions: 0.1, usure: 0.1 } };
const pts = x => virgule((Math.abs(x) * 100).toFixed(1));
/**
 * Un écart de stats en puces, le plus fort d'abord : [{ cle, txt, bon }]. `max` : combien au plus. `par` (« par match »,
 * « la période ») : l'unité dite au bout de chaque ligne, et les seuils du bruit qui vont avec ; `dire: false` la tait
 * quand l'écran la dit une fois pour toutes (le duel : « Les chiffres de la période qui vient »).
 */
export function motsDeStats(d, max = 4, { par = '', dire = true } = {}) {
  if (!d) return [];
  const mots = {
    tirs: x => `${signeDe(x)}${nb(x, 1)} ${mot(x, 'tir', 'tirs')}`,
    pctTir: x => `${signeDe(x)}${pts(x)} pt de précision`,
    contre: x => `${signeDe(x)}${nb(x, 1)} ${mot(x, 'tir contre', 'tirs contre')}`,
    // Le % d'arrêts en points, comme la précision (« +0,7 pt d'arrêts ») : « +,007 au % d'arrêts » se lisait mal, sans zéro.
    pctArr: x => `${signeDe(x)}${pts(x)} pt d'arrêts`,
    // Au duel (nov. 2026 ; JP : *c'est débile comme choix ?*) : « Rester discipliné » se paie en tirs, et ce qu'il donne — moins
    // de punitions pour toi — ne se lisait nulle part ; la carte ne montrait que son prix. Les punitions se disent quand on les lit.
    punitions: x => `${signeDe(x)}${nb(x, 1)} ${mot(x, 'punition', 'punitions')} pour toi`,
    usure: x => `${signeDe(x)}${nb(x, 1)} ${mot(x, 'jambe', 'jambes')} d'usure`,
  };
  const seuils = BRUIT[par] || SEUIL_STAT;
  const lus = Object.keys(mots).filter(k => Math.abs(d[k]) >= seuils[k]);
  // Un plan dont tout bouge sous le bruit le dit, plutôt qu'une carte vide.
  if (par && !lus.length) return [{ cle: 'rien', txt: 'à peine perceptible', bon: null }];
  return lus
    .sort((a, b) => Math.abs(d[b]) / PAS_STAT[b] - Math.abs(d[a]) / PAS_STAT[a]).slice(0, max)
    .map(k => ({ cle: k, txt: `${mots[k](d[k])}${par && dire ? ` ${par}` : ''}`, bon: k === 'contre' || k === 'punitions' || k === 'usure' ? d[k] < 0 : d[k] > 0 }));
}    // pour la différence : les deux lectures partagent leurs dés, le bruit s'en va

/* Une fenêtre d'avantage de deux minutes : le premier but la ferme (un but = un arrêt du processus de lancers), donc sa durée moyenne est (1 − e^(−2λ)) / λ. */
function fenetre(volume, p) {
  const r = AN_TIRS_MIN * volume;            // lancers par minute de l'équipe en avantage
  const lambda = r * p;                      // buts par minute
  const long = lambda > 1e-9 ? (1 - Math.exp(-lambda * AN_MINUTES)) / lambda : AN_MINUTES;
  return { long, tirs: r * long, buts: p * r * long };
}

/* Les moyennes d'un match, lues d'une lecture du moteur. Les mêmes formules que `jouerPlage` (js/sim.js). */
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
   *   attaque  = ses lancers, mieux (ou moins bien) convertis qu'avec un tireur, une création et une qualité
   *              neutres ; plus son volume : les lancers qu'elle prend au-delà de sa part de glace ;
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
      // Ses vraies stats sur la glace, à forces égales (V7) : ses tirs et ceux d'en face par match, la réussite, les arrêts.
      const c = U.contre[g][i] || { n: 0, p: 0 };
      const stats = { tirs: feA * o.n / nP, pctTir: o.n ? o.p / o.n : 0, contre: feB * c.n / nC, pctArr: c.n ? 1 - c.p / c.n : 0 };
      return { attaque, defense, net: attaque + defense, stats };
    });
  };
  /*
   * TES UNITÉS SPÉCIALES (V7) : chacune, par match, ses minutes et ses vraies stats — en avantage, ses tirs et sa
   * réussite ; en désavantage, les tirs d'en face et tes arrêts. Comptées sur l'unité d'attaquants, qui monte avec sa
   * paire.
   */
  const speciales = () => {
    const S = L.speciales;
    if (!S || !S.pour.n) return null;
    const tirsAN = nPour * wA.tirs, tirsDN = nContre * wB.tirs;
    const AN = POIDS_AN.map((w, i) => { const o = S.pour.F[i] || { n: 0, p: 0 }; return { minutes: nPour * wA.long * w, tirs: tirsAN * o.n / S.pour.n, pctTir: o.n ? o.p / o.n : 0 }; });
    const DN = POIDS_DN.map((w, i) => { const c = S.contre.F[i] || { n: 0, p: 0 }; return { minutes: nContre * wB.long * w, contre: tirsDN * c.n / (S.contre.n || 1), pctArr: c.n ? 1 - c.p / c.n : 0 }; });
    return { AN, DN };
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
    speciales: speciales(),
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
    return J([team.name, team.jourCourant, team.games, joueurs,
      team.effets, team.effetsSerie, team._effetMatch, team.speciales, team.fermeture, !!team.isPlayer, team._filetForce, team._filetMatch, team.gardienAux, adv && [adv.name, adv.games, !!adv.isPlayer],
      opts.aVenir, opts.effets, opts.effetsAdv, opts.mutation && [opts.mutation.cle, opts.mutation.retirer, opts.mutation.rien, opts.mutation.joueur ? getPlayerKey(opts.mutation.joueur) : null],
      opts.nu, opts.neutre, opts.n, opts.series, opts.plan, opts.duel,
      opts.intention && [opts.intention.cle, opts.intention.cible ? getPlayerKey(opts.intention.cible) : null, opts.intention.par ? getPlayerKey(opts.intention.par) : null]]);
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
 * Les mêmes nombres, sous des effets posés le temps de la lecture — sur ton club (`effets`) et sur l'adversaire moyen
 * (`effetsAdv`), comme `lectureDuMatch` les pose. C'est ainsi qu'un échange d'adjoint se lit pour TON club avant de le
 * prendre (le robot attentif, scripts/lib/rogue_sim.mjs) : son gain et son prix, sur ton effectif, pas en moyenne.
 */
export function chiffresDuSoirSous(team, { effets = [], effetsAdv = [] } = {}) {
  return lire(team, null, null, { effets, effetsAdv, n: N_BASE });
}

/*
 * ALIGNER AU MIEUX, JUGÉ PAR LE MOTEUR (oct.). JP : *aligner au mieux considéré positions, stratégie, etc.* La
 * lecture rapide (`trioAuMieux`, js/sim.js) propose ; le moteur tranche, sur les buts pour et contre d'un soir contre
 * un club moyen (`lectureDuMatch`, ce que `check_chiffres` prouve égal au jeu), l'affinité de ses lignes comprise.
 * L'alignement de l'IA (`autoRoster`) est toujours candidat : le bouton ne fait jamais
 * pire qu'elle. Puis, quelques tours, les échanges les plus prometteurs (`echangesProposes`), gardés si le moteur les
 * voit meilleurs : les buts qu'on marque moins ceux qu'on accorde. (V18 : l'offensif et le défensif sont partis avec
 * les systèmes qui les faisaient pencher ; sans eux, ils rendaient le même alignement, ou l'inverse de leur nom.)
 */
const TOURS_AU_MIEUX = 3, ECHANGES_LUS = 10;
/*
 * CHACUN À SON POSTE D'ABORD (19 oct.). JP : *le meilleur alignement devrait tout faire pour mettre les joueurs à la
 * bonne position*. Mesuré sur douze effectifs de Rogue : le bouton laissait 10,6 points de pénalité de poste (un centre
 * à l'aile, un gaucher à droite), quand le même effectif pouvait descendre à 4,3. Qui s'habille reste l'affaire du
 * moteur ; OÙ il joue se décide au poste d'abord : les habillés de chaque groupe prennent l'affectation qui coûte le
 * moins de pénalité (`getPositionPenalty`), chacun au plus près du rang où on l'avait mis (`PRES_DU_RANG`), par la
 * méthode hongroise. Et un échange ne passe que s'il ne remet personne hors de son poste.
 */
const PRES_DU_RANG = 0.01;
/* Un réserviste à son poste prend la case d'un habillé hors du sien si le moteur y perd peu : jusqu'à PRIX_DU_POSTE but par match (pesé par le style) par point de pénalité épargné. */
export const PRIX_DU_POSTE = 0.02;
function affectation(cout) {
  // La méthode hongroise (n cases ≤ m joueurs), en O(n² m) : rend, pour chaque case, l'indice de son joueur.
  const n = cout.length, m = cout[0].length, u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), voie = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(m + 1).fill(Infinity), pris = Array(m + 1).fill(false);
    do {
      pris[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) if (!pris[j]) {
        const c = cout[i0 - 1][j - 1] - u[i0] - v[j];
        if (c < minv[j]) { minv[j] = c; voie[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) if (pris[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = voie[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const out = Array(n);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
}
const casesDuGroupe = g => SLOTS.filter(s => !s.scratch && s.group === g);
export function auBonPoste(R) {
  const out = { ...R };
  for (const g of ['F', 'D']) {
    const cases = casesDuGroupe(g), joueurs = cases.map(s => R[s.i]);
    if (joueurs.some(p => !p)) continue;
    const a = affectation(cases.map(s => joueurs.map((p, k) => getPositionPenalty(p, s) + PRES_DU_RANG * Math.abs(s.unit - cases[k].unit))));
    cases.forEach((s, i) => { out[s.i] = joueurs[a[i]]; });
  }
  return out;
}
/* Les échanges qui remettent quelqu'un à son poste : un habillé hors du sien contre un réserviste qui y joue mieux. */
function echangesDePoste(R) {
  const out = [];
  const reserves = SLOTS.filter(s => s.scratch && R[s.i] && R[s.i].p !== 'G');
  for (const s of SLOTS.filter(x => !x.scratch && (x.group === 'F' || x.group === 'D') && R[x.i])) {
    const ici = getPositionPenalty(R[s.i], s);
    if (!ici) continue;
    for (const r of reserves) if (getPositionPenalty(R[r.i], s) < ici) out.push([s, r]);
  }
  return out;
}
/* Ce qu'un alignement coûte en postes : la somme des pénalités de ses habillés. */
export const penaliteDePoste = R => ['F', 'D'].reduce((t, g) => t + casesDuGroupe(g).reduce((a, s) => a + (R[s.i] ? getPositionPenalty(R[s.i], s) : 0), 0), 0);
export function alignementAuMieux(joueurs, { plan = false } = {}) {
  const saison = (joueurs.find(p => p && p.s) || {}).s;
  // Sous un hasard à part : le club lu tire sa chance de saison, et la saison en cours ne doit pas bouger d'un dé.
  const lu = R => avecHasardIsole('au mieux', () => {
    const T = createTeam('Au mieux', 'MOI', R, { season: saison });
    // En Rogue, la lecture joue le moteur du Rogue.
    T.courbe = plan;
    const m = moyennes(lectureDuMatch(T, R, null, { n: N_BASE }));
    return m.butsPour - m.butsContre;
  });
  // Le poste d'abord, puis le moteur : un candidat moins bien posté ne passe jamais devant.
  let best = null, score = -Infinity, poste = Infinity;
  const essayer = (R0, prix = 0) => {
    const R = auBonPoste(R0), pen = penaliteDePoste(R);
    if (pen > poste) return false;
    const v = lu(R);
    if ((pen < poste && v >= score - prix * (poste - pen)) || v > score + 1e-9) { best = R; score = v; poste = pen; return true; }
    return false;
  };
  // Les deux candidats : le meilleur des deux au moteur, puis le mieux posté s'il ne coûte presque rien.
  const [tri, ia] = [trioAuMieux(joueurs), autoRoster(joueurs)].map(auBonPoste);
  const [vt, vi] = [lu(tri), lu(ia)];
  [best, score] = vt >= vi ? [tri, vt] : [ia, vi];
  poste = penaliteDePoste(best);
  essayer(vt >= vi ? ia : tri, PRIX_DU_POSTE);
  // Un réserviste à son poste, contre un habillé hors du sien, quand le moteur n'y perd presque rien.
  for (let tour = 0; tour < TOURS_AU_MIEUX; tour++) {
    let mieux = false;
    for (const [sa, sb] of echangesDePoste(best)) {
      const R = { ...best };
      [R[sa.i], R[sb.i]] = [R[sb.i], R[sa.i]];
      if (essayer(R, PRIX_DU_POSTE)) { mieux = true; break; }
    }
    if (!mieux) break;
  }
  for (let tour = 0; tour < TOURS_AU_MIEUX; tour++) {
    let mieux = false;
    for (const [sa, sb] of echangesProposes(best, ECHANGES_LUS)) {
      const R = { ...best };
      [R[sa.i], R[sb.i]] = [R[sb.i], R[sa.i]];
      if (essayer(R)) mieux = true;
    }
    if (!mieux) break;
  }
  return best;
}

/* ---- les mots ---- */

const nb = (x, d) => virgule(Math.abs(x).toFixed(d));
const signeDe = x => (x > 0 ? '+' : '−');
const mot = (x, un, plusieurs) => (Math.abs(x) < 2 ? un : plusieurs);

/*
 * « ≈ +2,1 tirs par match » : le chiffre d'abord, l'unité de match toujours. EN VRAIES STATS (oct., JP : *on s'entend
 * que but pour et contre, c'est pas une vraie stat du moteur, pourquoi c'est dans les cartes ?*) : le moteur joue des
 * lancers et la chance de chacun ; un but en est le produit, jamais un canal. Une carte se dit donc en ce qu'elle
 * touche : les tirs, la précision, les tirs contre, le % d'arrêts (`statsDe`), en points de pourcentage
 * (« ≈ +0,4 pt de précision par match »). Les quatre mots de l'écran (JP, oct.) : Tirs, Tirs contre, Précision, % d'arrêts. La ligne garde les buts qu'elle vaut (`buts`), pour la preuve seulement.
 */
/*
 * CE QUI VAUT UNE LIGNE (oct., JP : *0,4 pt, ça va fuck all faire* ; *ça a aucun sens*). Sous ces seuils, une ligne disait le
 * contrecoup d'un autre canal (« +0,1 pt de précision » parce qu'on tire moins) et changeait de signe d'un club à l'autre :
 * du bruit, lu comme une promesse. Un tir par match, un demi-point de précision ou d'arrêts, un tiers de punition : la
 * moitié de ce que `check_effets` exige d'un effet pour se voir. Les tirs et les punitions se comptent sur la part du
 * match qu'on lit (une 3e période : le tiers).
 */
const SEUILS = { tirs: 1, pct: 0.005, punitions: 0.3, coups: 1, minutes: 0.3 };
const pt = x => `${signeDe(x)}${virgule((Math.abs(x) * 100).toFixed(1))} pt`;
/* D'où l'on part et où l'on arrive, en vrais chiffres de feuille : « (27,4 → 28,7) ». `b` : { sans, avec }, deux lectures du même soir, vues de ton côté. */
const deA = (b, k, fois, f) => (b ? ` (${f((b.sans[k] || 0) * fois)} → ${f((b.avec[k] || 0) * fois)})` : '');
const un = x => virgule(x.toFixed(1));
const pc = x => virgule((x * 100).toFixed(1));
function lignesDe(d, par = 'par match', part = 1, eux = false, b = null) {
  const out = [];
  const tirs = (x, un_, plur, bon, cle = un_, k) => {
    if (Math.abs(x) < SEUILS.tirs * part) return;
    out.push({ txt: `≈ ${signeDe(x)}${nb(x, 1)} ${mot(x, un_, plur)} ${par}${deA(b, k, part, un)}`, bon: bon ? x > 0 : x < 0, cle });
  };
  const taux = (x, quoi, cle, buts, k) => {
    if (!(Math.abs(x) >= SEUILS.pct)) return;
    out.push({ txt: `≈ ${pt(x)} ${quoi} ${par}${deA(b, k, 1, pc)}`, bon: x > 0, cle, buts });
  };
  tirs(d.tirsPour, 'tir', 'tirs', true, 'tir', 'tirs');
  tirs(d.tirsContre, 'tir contre', 'tirs contre', false, 'tir accordé', 'contre');
  taux(d.pctTir, 'de précision', 'pctTir', d.butsPour, 'pctTir');
  taux(d.pctArr, 'd\'arrêts', 'pctArr', -d.butsContre, 'pctArr');
  // Tes punitions ont un sens (oct.) : en prendre moins t'aide ; lues de leur côté (`eux`), ce sont les leurs, et plus t'aide.
  if (Math.abs(d.punitions) >= SEUILS.punitions * part) out.push({ txt: `≈ ${signeDe(d.punitions)}${nb(d.punitions, 1)} ${mot(d.punitions, 'punition', 'punitions')} ${par}${deA(b, 'punitions', part, un)}`, bon: eux ? d.punitions > 0 : d.punitions < 0, cle: 'punition' });
  if (Math.abs(d.coups) >= SEUILS.coups) out.push({ txt: `≈ ${signeDe(d.coups)}${nb(d.coups, 0)} ${mot(Math.round(d.coups), 'mise en échec', 'mises en échec')} ${par}`, bon: null, cle: 'coup' });
  return out;
}

/* Les canaux dont le match se lit dans la feuille. Les autres (blessure, jambes, glace) ont leur unité à eux. */
const CANAUX_MATCH = ['volume', 'finition', 'defense', 'discipline', 'robustesse'];
const differences = (a, b) => {
  const x = statsDe(a), y = statsDe(b);
  return { ...Object.fromEntries(Object.keys(a).filter(k => k !== 'joueurs').map(k => [k, Array.isArray(a[k]) ? a[k].map((v, i) => v - b[k][i]) : a[k] - b[k]])),
    pctTir: x.pctTir - y.pctTir, pctArr: x.pctArr - y.pctArr };
};
/* Le cadre d'une lecture : la part du match qui reste (une 3e période : 1/3) et comment la dire (« en 3e »). */
const surLaPart = (d, part) => (part === 1 ? d : { ...d, tirsPour: d.tirsPour * part, tirsContre: d.tirsContre * part, butsPour: d.butsPour * part, butsContre: d.butsContre * part, punitions: d.punitions * part, coups: d.coups * part });

/**
 * Un effet (des canaux : volume, finition, defense, discipline, blessure, energie, robustesse, F, D), dit en
 * chiffres de match pour CE club, CE soir : la différence entre le soir avec lui et sans lui. `duree` (des
 * matchs) : une blessure se dit alors sur cette durée plutôt que sur la saison.
 * → [{ txt: '≈ +2,1 tirs par match', bon: true, cle: 'tir' }, …] ; vide quand l'effet n'a aucun canal de match.
 */
export function effetEnChiffres(effet, team, lineup = null, adv = null, { duree = null, part = 1, par = 'par match', eux = false, vuDeToi = false } = {}) {
  if (!effet) return [];
  const e = {};
  for (const k of [...CANAUX_MATCH, 'blessure', 'energie', 'F', 'D']) {
    const v = effet[k];
    if (v == null || (k === 'robustesse' ? v === 0 : v === 1) || (Array.isArray(v) && v.every(m => m === 1))) continue;
    e[k] = v;
  }
  if (!Object.keys(e).length) return [];
  // `vuDeToi` (nov. 2026) : un effet posé sur EUX, mais dit de ton côté — leurs tirs sont tes tirs contre, leurs punitions les leurs.
  const surEux = eux || vuDeToi;
  const sans = lire(team, lineup, adv, { n: N_EFFET }), avec = lire(team, lineup, adv, surEux ? { effetsAdv: [e], n: N_EFFET } : { effets: [e], n: N_EFFET });
  let d = differences(avec, sans);
  // Un effet sur EUX se lit de leur côté : leurs tirs sont ceux qu'on accorde, leurs buts ceux qu'on encaisse.
  if (eux) d = { ...d, tirsPour: d.tirsContre, tirsContre: d.tirsPour, butsPour: d.butsContre, butsContre: d.butsPour, pctTir: -d.pctArr, pctArr: -d.pctTir, punitions: d.punitionsEux, coups: 0 };
  const out = [];
  // Les deux lectures vues de ton côté : de leur côté (`eux`), leurs tirs sont ceux qu'on te donne.
  const vu = m => { const x = statsDe(m); return eux ? { tirs: x.contre, contre: x.tirs, pctTir: 1 - x.pctArr, pctArr: 1 - x.pctTir, punitions: m.punitionsEux } : { ...x, punitions: m.punitions }; };
  if (CANAUX_MATCH.some(k => k in e)) out.push(...lignesDe(surLaPart(d, part), par, part, eux, { sans: vu(sans), avec: vu(avec) }));
  if (vuDeToi && Math.abs(d.punitionsEux * part) >= SEUILS.punitions * part) out.push({ txt: `≈ ${signeDe(d.punitionsEux * part)}${nb(d.punitionsEux * part, 1)} ${mot(d.punitionsEux * part, 'punition', 'punitions')} pour eux ${par}`, bon: d.punitionsEux > 0, cle: 'punitionEux' });
  // Une blessure ou des jambes trop petites pour se compter ne prennent pas de puce (JP, 17 oct. : *encore beaucoup de
  // « à peine perceptible »*) ; un effet qui ne fait rien de lisible le dit une fois, plus bas.
  if (e.blessure != null && !surEux) {
    const sur = duree || 82, n = d.blessures * sur;
    if (Math.abs(n) >= 0.1) out.push({ txt: `≈ ${signeDe(n)}${nb(n, 1)} ${mot(n, 'blessure', 'blessures')} ${duree ? `sur ${duree} match${duree > 1 ? 's' : ''}` : 'par saison'}`, bon: n < 0, cle: 'blessure' });
  }
  if (e.energie != null && !vuDeToi) {
    // Les jambes d'un club qu'on ne voit pas (eux) : l'usure d'un club comme le tien, sous le même effet.
    const usure = eux ? lire(team, lineup, adv, { effets: [{ energie: e.energie }], n: N_EFFET }).usure - sans.usure : d.usure;
    if (Math.abs(usure) >= 0.1) out.push({ txt: `≈ ${signeDe(usure)}${nb(usure, 1)} ${mot(usure, 'jambe', 'jambes')} d'usure ${par}`, bon: usure < 0, cle: 'jambes' });
  }
  /*
   * LA GLACE EN UNE PUCE (V6, phase 4 : une carte, une idée). Elle disait une rangée par trio et par paire touchés,
   * jusqu'à sept : son sens d'abord (« Le haut joue plus »), puis l'unité qui gagne le plus et celle qui perd le plus.
   */
  const sens = !surEux && sensDeLaGlace(e);
  if (sens) {
    // Chaque trio ou paire touché, d'où il part à où il arrive (« 4e trio 6,1 → 11,3 min »).
    const ecarts = ['F', 'D'].flatMap(g => (Array.isArray(e[g]) ? (d[g === 'F' ? 'glaceF' : 'glaceD'] || []).map((x, i) => ({ x, nom: RANGS_DE_GLACE[g][i], de: (sans[g === 'F' ? 'glaceF' : 'glaceD'] || [])[i] || 0 })) : []));
    const bouts = ecarts.filter(b => Math.abs(b.x) >= SEUILS.minutes).sort((a, b) => Math.abs(b.x) - Math.abs(a.x))
      .map(b => `${b.nom} ${signeDe(b.x)}${nb(b.x, 1)} min (${un(b.de)} → ${un(b.de + b.x)})`);
    out.push({ txt: bouts.length ? `${sens} : ${bouts.join(', ')} ${par}` : `${sens}, à peine`, bon: null, cle: 'glace' });
  }
  return out.length ? out : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }];
}

/**
 * Ce que le BUILD change ce soir : tous les effets actifs (cartes, patrons, coachs, moments) contre le même
 * alignement sans aucun. Remplace les « Tirs +14 % · Précision −3 % » du total du soir.
 * `aVenir` : les décisions du jour pas encore jouées.
 */
export function motsDuSoir(team, lineup = null, adv = null, aVenir = []) {
  if (!team) return [];
  const avec = lire(team, lineup, adv, { aVenir, n: N_EFFET }), sans = lire(team, lineup, adv, { aVenir, nu: true, n: N_EFFET });
  const vu = m => ({ ...statsDe(m), punitions: m.punitions });
  const d = differences(avec, sans), mots = [...lignesDe(d, 'par match', 1, false, { sans: vu(sans), avec: vu(avec) }), ...horsFeuille(d)];
  // Des effets qui jouent, trop petits pour une feuille : on le dit plutôt que de taire.
  return mots.length || ![d.tirsPour, d.tirsContre, d.butsPour, d.butsContre, d.punitions, d.blessures, d.usure].some(x => Math.abs(x) > 1e-9) ? mots : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }];
}
/*
 * CE QUE LA FEUILLE NE DIT PAS (V2.2) : les blessures et l'usure des jambes jouent aussi ce soir (un adjoint, un
 * dos-à-dos). Les blessures se disent sur dix matchs — un soir en compte une sur cinquante.
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
 * badges, l'affinité de tes lignes et leurs jambes jouent aussi, et une affiche qui disait « aucun
 * effet » un soir chargé mentait par omission. Chacun se lit par différence (`neutre`, js/sim.js) : le soir tel
 * quel contre le même soir où cette part est au neutre. Un nombre par part, l'écart de buts par match — ce que
 * la part rapporte (ou coûte) au pointage.
 */
export const PARTS_DU_SOIR = [
  ['badges', 'Badges'], ['affinite', 'Affinité'], ['jambes', 'Jambes'],
];
export function alignementDuSoir(team, lineup = null, adv = null, aVenir = []) {
  if (!team) return [];
  const tel = lire(team, lineup, adv, { aVenir, n: N_EFFET });
  return PARTS_DU_SOIR.map(([k, nom]) => {
    const sans = lire(team, lineup, adv, { aVenir, neutre: { [k]: true }, n: N_EFFET });
    const ecart = (tel.butsPour - tel.butsContre) - (sans.butsPour - sans.butsContre);
    const d = statsEntre(tel, sans), m = motsDeStats(d, 2);
    const txt = m.length ? `${nom} : ${m.map(x => x.txt).join(', ')} par match` : `${nom} : rien ce soir`;
    return { txt, bon: Math.abs(ecart) >= 0.01 ? ecart > 0 : null, cle: k, ecart, d };
  });
}

/*
 * CE QUI JOUE, UN PAR UN (V7, JP : *pas facile d'avoir numériquement quels trucs sont déjà actifs*). Le coach, chaque
 * patron, chaque carte de la saison et chaque effet qui court ce soir : le soir tel quel contre le même soir sans lui
 * seul, sous les mêmes dés. Rend [{ genre, ico, nom, reste, d (l'écart de stats, `statsDe`), mots }], le plus lourd d'abord,
 * et `.total` : l'écart de tous ensemble.
 */
export function ceQuiJoue(team, lineup = null, adv = null, aVenir = []) {
  if (!team) return [];
  return avecAVenir(team, aVenir, () => {
    const tel = lire(team, lineup, adv, { n: N_EFFET });
    const j = team.jourCourant || 0;
    const sources = [
      ...(team.effets || []).map((e, i) => ({ champ: 'effets', i, e })).filter(({ e }) => j >= e.debut && j < e.fin && e.source !== 'match')
        .map(({ champ, i, e }) => ({ champ, i, genre: 'effet', ico: e.ico, nom: e.nom, reste: matchsEntre(team, j, e.fin) })),
    ].filter(s => s.nom);
    const sansDes = retires => {
      const avant = {};
      for (const [champ, ix] of retires) { avant[champ] = team[champ]; team[champ] = team[champ].filter((_, k) => !ix.has(k)); }
      try { return lire(team, lineup, adv, { n: N_EFFET }); } finally { Object.assign(team, avant); }
    };
    const r = sources.map(({ champ, i, ...s }) => {
      const sans = sansDes([[champ, new Set([i])]]);
      const d = differences(tel, sans);
      const e = statsEntre(tel, sans);
      return { ...s, d: e, poids: Math.max(...Object.keys(PAS_STAT).map(k => Math.abs(e[k]) / PAS_STAT[k])), mots: [...lignesDe(d), ...horsFeuille(d)] };
    }).sort((a, b) => b.poids - a.poids);
    // LE TOTAL (le Bureau) : le soir tel quel contre le même soir sans aucun d'eux, sous les mêmes dés — pas la somme des
    // lignes, qui compterait deux fois ce qui se chevauche.
    const parChamp = new Map();
    for (const { champ, i } of sources) { if (!parChamp.has(champ)) parChamp.set(champ, new Set()); parChamp.get(champ).add(i); }
    r.total = sources.length ? statsEntre(tel, sansDes([...parChamp])) : null;
    return r;
  });
}

/*
 * UNE SIGNATURE, EN CHIFFRES (V7, JP : *comparaison de joueur lorsque carte à ajouter, on a pas les lignes*). Un autre
 * alignement (`roster`, case → joueur) contre celui en vigueur, contre un club moyen : l'écart de stats par match (`statsDe`).
 */
export function rosterEnStats(team, roster) {
  if (!team || !team.roster) return null;
  return statsEntre(lire(team, activeLineup({ ...team, roster }), null, { n: N_EFFET }), lire(team, activeLineup(team), null, { n: N_EFFET }));
}

/*
 * LA NOTE QUI BOUGE (V6, docs/refonte-v6.md). Chaque trio et chaque paire de ton club : ce qu'il fait de plus qu'une
 * unité neutre à sa place, à forces égales, par match, contre `adv` — en attaque, en défense, et les deux ensemble.
 * Il suit l'affinité de sa ligne, ses badges, ses jambes et ses cases.
 */
/** Tes unités spéciales ce soir, en minutes et en vraies stats (voir `speciales` dans `moyennes`), et les minutes à forces égales. */
export function specialesEnStats(team, lineup, adv, aVenir = []) {
  if (!team) return null;
  const m = lire(team, lineup, adv, { aVenir, n: N_BASE });
  return m.speciales ? { ...m.speciales, minutesFE: m.minutesFE } : null;
}
export function unitesDuSoir(team, lineup, adv) {
  if (!team) return null;
  const m = lire(team, lineup, adv, { n: N_BASE });
  return { F: m.unitesF, D: m.unitesD };
}



/*
 * LES PLANS DU DUEL (V27, tranche 6 ; docs/refonte-v27.md § 4.7, docs/refonte-v27-6a.md). JP : *le duel : un seul choix
 * lourd* ; *un seul choix avant le match, mais le rival montre son jeu dès son annonce*. Avant le match, ton banc propose
 * deux ou trois plans forts : chaque pièce posée qui a un plan propose le sien (`PLAN_DE_LA_PIECE`), ton coach celui de sa
 * philosophie (`PLAN_DU_COACH`) ; deux voix pour un même plan, la plus forte parle. Moins de deux : ton coach complète par
 * les plans qui répondent à leur jeu (`repond`, js/greffes.js), puis fermer le centre, rester discipliné. Un plan joue les trois périodes, à la force du duel et de qui le propose
 * (une pièce à 1, le coach à sa maîtrise). Chacun se dit en vraies stats DU MATCH, son vrai prix : la lecture avec lui contre
 * Ton match, sous leur jeu (`leurJeuDuDuel`, js/greffes.js), les mêmes dés. `net` : les buts nets qu'il change, ce que le
 * robot lit (scripts/lib/duel.mjs) ; l'écran ne dit que les stats.
 *   team, adv : les deux clubs ; intention : leur jeu ; n : les lancers lus
 */
const PLAN_DE_LA_PIECE = { canonnier: 'tirer', mur: 'centre', cogneur: 'assaut', moine: 'discipline', arbitre: 'discipline', vedettiste: 'ombre', lunette: 'ombre' };
const PLAN_DU_COACH = { essaim: 'tirer', rapaces: 'ombre', tortue: 'centre', rhinos: 'assaut', souffle: 'discipline', choeur: 'discipline', profondeur: 'centre', etoiles: 'ombre' };
const PLANS_DU_DUEL = 3;
export function plansDuDuel(team, adv, { intention = null, n = N_EFFET } = {}) {
  if (!team) return [];
  const P = team.perso, voix = [];
  for (const k of bancDe(P)) if (PLAN_DE_LA_PIECE[k]) voix.push({ cle: PLAN_DE_LA_PIECE[k], qui: { genre: 'piece', cle: k }, force: 1 });
  if (P && PLAN_DU_COACH[P.cle]) voix.push({ cle: PLAN_DU_COACH[P.cle], qui: { genre: 'coach', cle: P.cle }, force: Math.min(1.3, Math.max(0.7, Number(P.maitrise) || 1)) });
  const plans = [];
  for (const v of voix.sort((a, b) => b.force - a.force)) if (!plans.some(x => x.cle === v.cle)) plans.push(v);
  const repondent = intention ? Object.keys(PLANS).filter(k => (PLANS[k].repond || []).includes(intention.cle)) : [];
  for (const cle of [...repondent, 'centre', 'discipline']) {
    if (plans.length >= 2) break;
    if (!plans.some(x => x.cle === cle)) plans.push({ cle, qui: { genre: 'coach', cle: P ? P.cle : null }, force: 1 });
  }
  const lu = plan => lire(team, null, adv, { plan, intention, duel: true, n });
  const sans = lu('match');
  const { vedette, colle } = cibleDuPlan(activeLineup(team), adv ? activeLineup(adv) : null);
  return plans.slice(0, PLANS_DU_DUEL).map(x => {
    const avec = lu({ cle: x.cle, force: x.force }), d = statsEntre(avec, sans);
    const stats = { tirs: d.tirs, pctTir: d.pctTir, contre: d.contre, pctArr: d.pctArr, punitions: avec.punitions - sans.punitions, usure: avec.usure - sans.usure };
    return { ...x, stats, net: (avec.butsPour - avec.butsContre) - (sans.butsPour - sans.butsContre),
      plan: { cle: x.cle, force: x.force, ...(PLANS[x.cle].vedette && vedette ? { vise: getPlayerKey(vedette) } : {}) },
      ...(PLANS[x.cle].vedette && vedette ? { vedette, colle } : {}) };
  });
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
/* Ce qu'UN joueur rend à son club se compte en dixièmes de point sur la saison : son seuil n'est pas celui d'un effet d'équipe. */
const SEUIL_PCT_JOUEUR = 0.0005;
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
  // UNE MODIF D'UN MOMENT (V3.4, `si` ; V10 : tous les moments) se lit un soir où son moment est vrai, sur les soirs
  // que ce moment compte d'ici la fin (`parSaison`, js/sim.js `MOMENTS_SI`) ; en séries, sur un printemps (`MATCHS_DE_SERIES_LUS`).
  const resteSaison = Math.max(1, 82 - (c.team.games || 0)), Mo = M.si && MOMENTS_SI[M.si];
  const reste = M.si === 'series' ? MATCHS_DE_SERIES_LUS : Mo ? Math.max(1, Math.round((resteSaison * Mo.parSaison) / 82)) : resteSaison;
  const quand = M.si === 'series' ? `sur ${MATCHS_DE_SERIES_LUS} matchs de séries`
    : `${resteSaison >= 82 ? 'sur la saison' : `d'ici la fin (${resteSaison} matchs)`}${Mo ? `, ses ${reste} soirs (${Mo.mot.toLowerCase()})` : ''}`;
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
  // À TON CLUB, sur la même durée : sa précision et son % d'arrêts (ce que sa création, sa défense ou ses arrêts
  // rapportent aux autres aussi), les vraies stats que le moteur joue. Une carte de gardien ne joue que les soirs où il
  // garde le filet : son % d'arrêts se dit sur la saison du club, à sa part des départs.
  const filet = M.gardien ? avec.partDuFilet : 1;
  for (const [x, quoi, cle] of [[d.pctTir, 'de précision', 'pctTir'], [d.pctArr * filet, 'd\'arrêts', 'pctArr']]) {
    if (Math.abs(x) >= SEUIL_PCT_JOUEUR) out.push({ txt: `Ton club : ≈ ${pt(x)} ${quoi} ${quand}`, bon: x > 0, cle });
  }
  // Sa blessure : un joueur seul se blesse rarement (mesuré : +20 % de risque, ≈ +0,03 blessure sur une saison). Trop peu
  // pour un chiffre, elle se dit en un mot, son sens ; à rien, elle se tait.
  if (M.blessure) {
    const n = d.blessures * reste;
    if (Math.abs(n) >= 0.1) out.push({ txt: `≈ ${signeDe(n)}${nb(n, 1)} ${mot(n, 'blessure', 'blessures')} ${quand}`, bon: n < 0, cle: 'blessure' });
    else if (Math.abs(n) >= 0.01) out.push({ txt: n > 0 ? 'Un peu plus fragile' : 'Un peu moins fragile', bon: n < 0, cle: 'blessure' });
  }
  const qui = joueur || !p ? [] : [{ txt: M.gardien ? `sur ${p.n}, le partant` : `sur ${p.n}`, bon: null, duree: true }];
  // « À peine perceptible » seulement quand rien d'autre ne se dit : ni chiffre, ni badge, ni geste en mots.
  const ditQuelqueChose = out.length || badges.length || base.some(m => !/^🔗/.test(m.txt || ''));
  return [...(ditQuelqueChose ? out : [{ txt: 'à peine perceptible', bon: null, cle: 'rien' }]), ...badges, ...qui, ...base];
}

/**
 * LA FENÊTRE D'UN CHOIX (V19, tranche 5 ; JP : *des dates, pour que ça joue plus*). Les matchs de ton club qu'un effet couvre,
 * dits en rangs : « Du 31e au 38e match ». `joues` : les matchs déjà joués ; `duree` : sa durée en matchs (`apresMatchs`,
 * js/sim.js, compte les mêmes). Rien sans durée.
 */
export function fenetreDuChoix(joues, duree) {
  if (!(duree >= 1)) return '';
  const rang = n => (n === 1 ? '1er' : `${n}e`);
  return duree === 1 ? `Au ${rang(joues + 1)} match` : `Du ${rang(joues + 1)} au ${rang(joues + duree)} match`;
}

/* ---- le club qu'on lit ---- */

let CLUB = null;
/** Le club dont on lit les effets (game.js le lui donne) : `() => ({ team, lineup, adv })`, ou `null` hors partie. */
export function poserClubLu(f) { CLUB = f; }
/** Le club lu en ce moment : `{ team, lineup, adv }`, ou `null`. */
export const clubLu = () => (CLUB && CLUB()) || null;
/*
 * LES PIÈCES DU BANC EN VRAIES STATS (nov. 2026 ; JP : *adjoints and powers: real per-game stats* ; V27, tranche 5). Le
 * canonnier disait « Tes tirs +18 % », le plan « +1,7 tir par match » : on ne pouvait pas les comparer. Une pièce de la
 * soirée entière (`soir`) se lit sur ton club, par match ; les autres, sur la période où elles jouent (le tiers d'un
 * match). Sans club lu (un menu, un essai), leurs mots en %.
 */
// Court, pour une carte : sans « ≈ », sans « (27,4 → 28,7) » ; la glace, son sens seul (« Le haut joue plus »).
const court = x => ({ ...x, txt: x.cle === 'glace' ? String(x.txt).split(' : ')[0].split(',')[0] : String(x.txt).replace(/^≈ /, '').replace(/ \([^)]*→[^)]*\)/g, '') });
// Ce qu'un canal fait d'abord, dit d'abord : le verrou (`defense`) se lit en arrêts avant ses tirs de côté.
const LIGNE_DU_CANAL = { volume: 'tir', finition: 'pctTir', defense: 'pctArr', discipline: 'punition', blessure: 'blessure', energie: 'jambes', F: 'glace', D: 'glace', robustesse: 'coup' };
const LIGNE_DU_CANAL_EUX = { volume: 'tir accordé', finition: 'pctArr', defense: 'pctTir', discipline: 'punitionEux' };
const lireEffets = (effet, adv, cadre, max = 3) => {
  const c = clubLu();
  if (!c || !c.team) return null;
  try {
    const premiers = new Set([...Object.keys(effet || {}).map(k => LIGNE_DU_CANAL[k]), ...Object.keys(adv || {}).map(k => LIGNE_DU_CANAL_EUX[k])].filter(Boolean));
    const out = [...(effet ? effetEnChiffres(effet, c.team, c.lineup || null, c.adv || null, cadre) : []),
      ...(adv ? effetEnChiffres(adv, c.team, c.lineup || null, c.adv || null, { ...cadre, vuDeToi: true }) : [])].filter(x => x.cle !== 'rien').map(court);
    const tries = [...out.filter(x => premiers.has(x.cle)), ...out.filter(x => !premiers.has(x.cle))].slice(0, max);
    return tries.length ? tries : null;
  } catch { return null; }
};
/**
 * La précision d'un état du gros match (😵 sonnés, ⬆ la lancée) sur ton club, par match, sans seuil de bruit : son
 * nom le promet, le chiffre dit combien (nov. 2026 ; JP : *« Sonnés » : what makes more sense to you*). Sans club, en %.
 */
export function ditDeLaFinition(f) {
  const c = clubLu();
  if (!c || !c.team) return `${signeDe(f - 1)}${Math.round(Math.abs(f - 1) * 100)} % de précision`;
  try {
    const sans = lire(c.team, c.lineup || null, c.adv || null, { n: N_EFFET }), avec = lire(c.team, c.lineup || null, c.adv || null, { effets: [{ finition: f }], n: N_EFFET });
    const d = statsEntre(avec, sans).pctTir;
    return `${signeDe(d)}${pts(d)} pt de précision par match`;
  } catch { return `${signeDe(f - 1)}${Math.round(Math.abs(f - 1) * 100)} % de précision`; }
}
const MOTS_EUX = { volume: ['Leurs tirs', false], finition: ['Leur précision', false], discipline: ['Leurs punitions', true] };
const QUOI_DU_RELAIS = { canaux: { volume: 'tes tirs', finition: 'ta précision', discipline: 'tes punitions', blessure: 'tes blessures' }, adv: { volume: 'leurs tirs', discipline: 'leurs punitions' } };
/* LE RELAIS D'UNE PIÈCE, EN UNE LIGNE (V23 D) : son signal, puis ce qu'il ajoute la période — « Relais · Quand tu mènes : leurs tirs −10 % de plus, la période ». */
function ligneDuRelais(cle) {
  const P = PIECES[cle], fx = effetDuRelais(cle);
  if (!fx) return null;
  const v = fx.valeur, quoi = fx.canal === 'F' ? 'ton 1er trio joue plus encore' : fx.canal === 'robustesse' ? 'plus de mises en échec encore'
    : `${QUOI_DU_RELAIS[fx.cote][fx.canal] || fx.canal} ${pctDe(v)} de plus`;
  return { txt: `Relais · ${P.relais.mot} : ${quoi}, la période`, bon: true, relais: true };
}
/** Ce qu'une pièce donne et coûte à ton club : sa soirée par match, une période la période ; son relais au bout ; le bon d'abord. */
export function lignesDeLaPiece(cle) {
  const P = PIECES[cle];
  if (!P) return [];
  const lu = lireEffets(P.canaux || null, P.adv || null, P.soir ? { par: 'par match' } : { part: 1 / 3, par: 'la période' });
  const eux = Object.entries(P.adv || {}).filter(([k]) => MOTS_EUX[k]).map(([k, v]) => ({ txt: `${MOTS_EUX[k][0]} ${pctDe(v)}`, bon: MOTS_EUX[k][1] ? v > 1 : v < 1 }));
  const relais = ligneDuRelais(cle);
  const out = [...(lu || [...motsDEffet(P.canaux || null), ...eux]), ...(relais ? [relais] : [])];
  return [...out.filter(x => x.bon !== false), ...out.filter(x => x.bon === false)];
}
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

/* =====================================================================
   LES MOTS D'UN EFFET (V25 A1 : sortis de js/sim.js, qui ne parle plus à l'écran)

   Ce qu'une carte, une mutation, un total du soir ou une pénalité de position
   DIT, en mots et en pour cent, à partir de ce que le moteur joue. Le moteur
   ne connaît que les canaux ; l'écran passe par ici, jamais par un chiffre
   recopié.
   ===================================================================== */
/*
 * LA PÉNALITÉ QUE L'ÉCRAN AFFICHE (1.0, J1-J) : celle que le moteur joue
 * AUJOURD'HUI, arrondie au dixième — pas la pénalité de base, qui restait
 * « −3 » au jour 40 d'un centre à l'aile qui jouait à −0,2. `matchs` dit
 * depuis combien de matchs il s'adapte à cette case ; 999 reste la
 * sentinelle d'`autoRoster` (une case interdite).
 */
export function penaliteAffichee(player, slot) {
  const base = getPositionPenalty(player, slot);
  if (!base) return { pen: 0, base: 0, matchs: 0 };
  if (base >= 999) return { pen: 999, base, matchs: 0 };
  const matchs = (player && player._adapt && player._adapt[slot.role]) || 0;
  return { pen: Math.round(penaliteAdaptee(player, slot) * 10) / 10, base, matchs };
}
/* Le mot de la pénalité : « −3 », ou « −1,2 · s'adapte (9 m.) » une fois l'adaptation commencée. */
export const motPenalite = a => (a.pen <= 0 ? '' : a.matchs > 0 ? `−${String(a.pen).replace('.', ',')} · s'adapte (${a.matchs} m.)` : `−${a.base}`);
/*
 * LA COURBE, À L'ÉCRAN (1.0, J2-16 et R6). Une carte qui grandit ne le dit
 * qu'en Rogue — la saison et le tournoi n'ont pas de courbe, et « En Rogue,
 * grandit » sur une carte de saison parlait d'un autre mode. Et elle le dit
 * par une JAUGE à quatre crans (octobre ×0,5, janvier ×1, avril ×1,5, finale
 * ×2), le cran d'aujourd'hui allumé, au lieu d'une phrase coupée au bord.
 * Le contrôleur (js/game.js) branche les deux lectures : le mode, et
 * l'échelle du jour (null avant la saison).
 */
export const AFFICHAGE_COURBE = { actif: () => false, echelle: () => null };
const CRANS_COURBE = [0.5, 1, 1.5, 2];
function motCourbe() {
  if (!AFFICHAGE_COURBE.actif()) return null;
  const e = AFFICHAGE_COURBE.echelle();
  const fmt = x => String(Math.round(x * 100) / 100).replace('.', ',');
  if (e == null) return { txt: '📈 Grandit : ×0,5 en octobre → ×2 en finale', bon: null };
  let k = 0;
  CRANS_COURBE.forEach((c, i) => { if (Math.abs(e - c) < Math.abs(e - CRANS_COURBE[k])) k = i; });
  const jauge = CRANS_COURBE.map((c, i) => (i === k ? '▰' : '▱')).join('');
  return { txt: `📈 Grandit ${jauge} ×${fmt(e)} ce soir · ×2 en finale`, bon: null };
}

/* Ce qu'une mutation fait, en mots : ce que la carte et le choix affichent. */
function motsDeMutation(cle) {
  const M = MUTATIONS[cle];
  if (!M) return [];
  // En chiffres, comme les effets (S76).
  const pct = (x, mot, bon) => ({ txt: `${mot} ${flechesDe(x)}`, bon: bon ? x > 1 : x < 1 });
  const out = [];
  if (M.finition) out.push(pct(M.finition, 'Précision', true));
  if (M.lancers) out.push(pct(M.lancers, 'Tirs', true));
  if (M.creation) out.push(pct(M.creation, 'Création', true));
  if (M.defense) out.push({ txt: `Précision adverse quand il est là ${flechesDe(M.defense)}`, bon: M.defense < 1 });
  if (M.blessure) out.push({ txt: `Blessures ${flechesDe(M.blessure)}`, bon: M.blessure < 1 });
  if (M.arrets) out.push({ txt: `Buts accordés ${flechesDe(M.arrets)}`, bon: M.arrets < 1 });
  if (M.partout) out.push({ txt: 'Pénalité hors position : aucune', bon: true });
  if (M.cran) out.push({ txt: `Trios possibles : +${M.cran} vers le haut`, bon: true });
  if (M.enBas) out.push({ txt: '4e trio et 3e paire : pénalité de zone 0', bon: true });
  if (M.ombre) out.push({ txt: `Leur meilleur joueur : précision ${flechesDe(M.ombre)}`, bon: true });
  // En mots, pas en « % » : l'écran le dit tel quel, à côté de ses chiffres de match.
  if (M.abri) out.push({ txt: `Il échappe à ${({ 0.25: 'un quart', 0.5: 'la moitié', 0.75: 'trois quarts', 1: 'tout' })[M.abri] || 'une part'} de leur étouffement`, bon: true });
  if (M.physio) out.push({ txt: 'Ses malus de carte : effacés', bon: true });
  if (M.lustre) out.push({ txt: 'Sa carte : une édition de plus', bon: true });
  if (M.palier) out.push({ txt: 'Son badge monte au suivant', bon: true, cle: 'badge' });
  if (M.mentor) out.push({ txt: 'Ses compagnons de ligne : leur badge monte au suivant', bon: true, cle: 'badge' });
  // Le feu qui s'entretient (V3.6) : ce que la carte fait à sa lancée, en mots ; les chiffres sont dans les règles.
  // Ses rôles bougent : le SENS, jamais les points (un « Défensif +25 » ne dit rien). Le badge qu'il y gagne se lit dans `badgesDeMutation`.
  for (const [k, d] of Object.entries(M.profils || {})) {
    const P = PROFILS.F[k] || PROFILS.D[k];
    if (P) out.push({ txt: `${d > 0 ? 'Plus' : 'Moins'} ${P.ico} ${P.nom.toLowerCase()}`, bon: d > 0, cle: 'role' });
  }
  // LES DEUX COURBES (S80, `echelleTardive`) : l'amélioration grandit ; le style et l'atelier font fitter un trio, tout de suite.
  const courbe = M.source === 'amelioration' ? motCourbe() : null;
  if (courbe) out.push(courbe);
  else if (M.source !== 'amelioration' && (M.source === 'style' || M.partout || M.cran || M.enBas)) out.push({ txt: '🔗 Carte de trio : pleine tout de suite, elle ne grandit pas', bon: null });
  return out;
}

/*
 * CE QU'UN EFFET FAIT, EN MOTS (S68). JP : *c'est pas clair l'impact des
 * trucs*. Toutes les options — dilemmes, séquences, cartes, factions,
 * importance du match, tactiques — passent par ici : un seul endroit qui dit
 * « Finition +8 % », « Buts alloués −6 % », « 1er trio +25 % de glace »,
 * pour que l'écran ne recopie jamais un chiffre qui finirait par mentir.
 * Chaque mot dit s'il AIDE (`bon`) ; l'écran le colore.
 */
/*
 * LES EFFETS SE LISENT EN CHIFFRES (S76). JP : *faudrait des maths plus
 * claires sur les effets, comme dans un vrai deckbuilder* — et *j'aime les
 * mécaniques, mais c'est pas très compréhensible pour le joueur*. Les flèches
 * de S71 (↑, ↑↑, ↑↑↑) disaient « un peu, net, beaucoup » et laissaient
 * deviner le reste : deux cartes à ↑ ne se comparaient pas. Un effet se lit
 * maintenant comme dans Slay the Spire, en nombre entier : « Tirs +6 % »,
 * « Précision adverse −5 % ». Le nom est resté (`flechesDe`) pour ne pas toucher
 * tous ses appels ; `seuils` ne sert plus.
 */
function pctDe(x) {
  const d = (x - 1) * 100;
  if (Math.abs(d) < 0.5) return '±0 %';
  const n = Math.abs(d) < 1 ? Math.abs(d).toFixed(1).replace('.', ',') : String(Math.round(Math.abs(d)));
  return `${d > 0 ? '+' : '−'}${n} %`;
}
export function flechesDe(x, seuils = null) {
  void seuils;
  return pctDe(x);
}
/*
 * LE SENS D'UN DÉPLACEMENT DE GLACE (V6) : les multiplicateurs F (trios) et D (paires) d'un effet, dits en une idée.
 * La moitié du haut contre la moitié du bas, pondérée par l'écart de chaque rang à 1 : « Le haut joue plus »,
 * « Le bas joue plus », ou « La glace se brasse » quand les deux bouts bougent pareil. Rend '' sans glace.
 */
/* Les noms des unités à forces égales, dans l'ordre de `PART_UNITE`. */
const RANGS_DE_GLACE = { F: ['1er trio', '2e trio', '3e trio', '4e trio'], D: ['1re paire', '2e paire', '3e paire'] };
/* Les minutes qu'un effet de glace déplace, unité par unité, sur un match de 60 : ses parts de base, multipliées puis
   ramenées à 1. */
function minutesDeLaGlace(e) {
  return ['F', 'D'].flatMap(g => {
    if (!Array.isArray(e[g])) return [];
    const b = PART_UNITE[g], m = b.map((x, i) => x * (e[g][i] ?? 1));
    const s = m.reduce((a, x) => a + x, 0), s0 = b.reduce((a, x) => a + x, 0);
    return m.map((x, i) => ({ nom: RANGS_DE_GLACE[g][i], x: 60 * (x / s - b[i] / s0) }));
  });
}
function sensDeLaGlace(e) {
  let haut = 0, bas = 0, bouge = false;
  for (const g of ['F', 'D']) {
    if (!Array.isArray(e && e[g])) continue;
    const n = e[g].length;
    e[g].forEach((m, i) => { if (m === 1) return; bouge = true; if (i < n / 2) haut += m - 1; else bas += m - 1; });
  }
  if (!bouge) return '';
  const net = haut - bas;
  return Math.abs(net) < 0.05 ? 'La glace se brasse' : net > 0 ? 'Le haut joue plus' : 'Le bas joue plus';
}
function motsDEffet(e, duree = null) {
  if (!e) return [];
  const out = [];
  const pct = x => flechesDe(x);
  if (e.volume && e.volume !== 1) out.push({ txt: `Tirs ${pct(e.volume)}`, bon: e.volume > 1 });
  if (e.finition && e.finition !== 1) out.push({ txt: `Précision ${pct(e.finition)}`, bon: e.finition > 1 });
  if (e.defense && e.defense !== 1) out.push({ txt: `Précision adverse ${pct(e.defense)}`, bon: e.defense < 1 });
  if (e.discipline && e.discipline !== 1) out.push({ txt: `Punitions ${pct(e.discipline)}`, bon: e.discipline < 1 });
  if (e.blessure && e.blessure !== 1) out.push({ txt: `Blessures ${pct(e.blessure)}`, bon: e.blessure < 1 });
  if (e.energie && e.energie !== 1) out.push({ txt: `Usure des jambes ${pct(e.energie)}`, bon: e.energie < 1 });
  if (e.robustesse) out.push({ txt: `Robustesse ${e.robustesse > 0 ? '+' : '−'}${String(Math.abs(Math.round(e.robustesse * 10) / 10)).replace('.', ',')}`, bon: e.robustesse > 0 });
  // LA GLACE EN UNE PUCE (V6, phase 4 : une carte, une idée) : son sens, puis l'unité qui gagne le plus et celle qui
  // perd le plus, en minutes d'un match de 60 (les parts de base `PART_UNITE`, comme js/impact.js les mesure).
  const sens = sensDeLaGlace(e);
  if (sens) {
    const ecarts = minutesDeLaGlace(e);
    const plus = ecarts.reduce((a, b) => (b.x > a.x ? b : a), { x: 0 }), moins = ecarts.reduce((a, b) => (b.x < a.x ? b : a), { x: 0 });
    const dit = x => `${x > 0 ? '+' : '−'}${String(Math.abs(Math.round(x * 10) / 10)).replace('.', ',')} min`;
    const bouts = [plus, moins].filter(b => Math.abs(b.x) >= 0.1).map(b => `${b.nom} ≈ ${dit(b.x)}`);
    out.push({ txt: bouts.length ? `${sens} : ${bouts.join(', ')} par match` : sens, bon: null, cle: 'glace' });
  }
  if (e.mutation && MUTATIONS[e.mutation]) out.push({ txt: `Change sa carte : ${MUTATIONS[e.mutation].ico} ${MUTATIONS[e.mutation].nom}`, bon: null });
  if (duree) out.push({ txt: `${duree} match${duree > 1 ? 's' : ''}`, bon: null, duree: true });
  return out;
}
/* Les mots des totaux : les quatre canaux, dans l'ordre, arrondis au pour cent (0 % se tait). */
export function motsDesTotaux(t) {
  if (!t) return [];
  const e = {};
  for (const k of ['volume', 'finition', 'defense', 'discipline']) if (Math.round((t[k] - 1) * 100) !== 0) e[k] = t[k];
  return motsDEffet(e);
}
