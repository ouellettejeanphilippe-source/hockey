/*
 * LE PERSONNEL QUI MONTE (V14, js/echelons.js — docs/refonte-v14.md). JP : *le personnel, des cartes qui gagnent des
 * niveaux, avec leurs forces et leurs faiblesses, un look de jeu de gestion* ; *adapter à nos besoins de gestion et de gacha*.
 *   2. les chiffres d'un échelon : la carte telle quelle au premier ; pousser sa force grandit ses bons canaux de
 *      `POUSSEE`, corriger son défaut ramène ses mauvais de `CORRECTION` ; l'argent grandit comme une force ;
 *   2b. la couleur du coach, un échelon de plus (V20, `assortiPour`) ;
 *   3. les échelons : payés en jetons (`PRIX_ECHELON`, V14b : la force s'achète), quand on veut (V20) ; un choix
 *      remplace la carte à son poste (le reste du banc : check_banc) ;
 *   4. le moteur, EN PAIRES (CLAUDE.md) : le même match sur les mêmes dés, sans la personne, à son premier échelon, à son
 *      cinquième (deux poussées), et son défaut corrigé quatre fois ; l'écart sur sa force monte, celui sur son défaut
 *      fond ;
 *   5. le protégé (V16) : ses canaux de joueur grandissent avec la force, la décision d'échelon les porte, et ses
 *      points à sa ligne montent, en paires.
 * `N` : matchs par club (300).
 */
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS, appliquerMutation, joueurDeMutation, getPlayerKey, assortiPour, POUSSEE_COULEUR } from '../js/sim.js';
import { PROTEGES } from '../js/personnel.js';
import { PATRONS } from '../js/banque.js';
import { effetALEchelon, patronALEchelon, etatDuPersonnel, decisionDEchelon, matchsJoues, protegeALEchelon,
  POUSSEE, CORRECTION, CORRECTION_DE_DEPART, PRIX_ECHELON } from '../js/echelons.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 300);
const presque = (a, b) => Math.abs(a - b) < 2e-3;

/* ---------- 2 : les chiffres d'un échelon ---------- */
{
  const k = 'per_gardienDuFort', P = PATRONS[k];   // defense 0,9 (sa force), volume 0,93 (son défaut)
  const base = effetALEchelon(k, []), f2 = effetALEchelon(k, ['force', 'force']), d1 = effetALEchelon(k, ['defaut']);
  exiger('au premier échelon, sa force telle quelle et son défaut déjà à demi corrigé', presque(base.defense, P.effet.defense) && presque(base.volume, 1 + (P.effet.volume - 1) * CORRECTION_DE_DEPART));
  exiger('deux poussées : sa force grandit, son défaut ne bouge pas', presque(f2.defense, 1 + (P.effet.defense - 1) * (1 + 2 * POUSSEE)) && presque(f2.volume, base.volume),
    `${P.effet.defense} → ${f2.defense}`);
  exiger('une correction : son défaut fond, sa force ne bouge pas', presque(d1.volume, 1 + (P.effet.volume - 1) * CORRECTION_DE_DEPART * CORRECTION) && presque(d1.defense, P.effet.defense),
    `${P.effet.volume} → ${d1.volume}`);
  const caisse = effetALEchelon('per_caissier', ['force', 'force']), neg = effetALEchelon('per_negociateur', ['force']);
  exiger('l\'argent grandit comme une force', caisse.econ.jetonsVictoire === Math.round(PATRONS.per_caissier.econ.jetonsVictoire * (1 + 2 * POUSSEE))
    && presque(neg.econ.rabais, Math.round((1 - (1 - PATRONS.per_negociateur.econ.rabais) * (1 + POUSSEE)) * 1000) / 1000),
    `+${caisse.econ.jetonsVictoire} 🪙 par victoire · packs ×${neg.econ.rabais}`);
  const p = patronALEchelon(k, { choix: ['force', 'defaut'] });
  exiger('la décision porte son échelon, ses choix, son moment', p.echelon === 3 && p.choix.join() === 'force,defaut' && p.si === P.si && p.role === P.role);
}

/*
 * ---------- 2b : la couleur du coach, un cran de plus (V20, docs/refonte-v20.md § 2) ----------
 * Chez la Tortue, le gardien du fort à son échelon 1 joue comme à une poussée de plus ; son défaut ne bouge pas. Chez
 * un autre coach, il joue tel quel : la pénalité cachée d'avant (`MAL_ASSORTI`) est partie.
 */
{
  const k = 'per_gardienDuFort';
  const un = patronALEchelon(k), deux = patronALEchelon(k, { choix: ['force'] });
  const chez = assortiPour('tortue', un), ailleurs = assortiPour('essaim', un), chez2 = assortiPour('tortue', deux);
  exiger('la poussée de la couleur est celle d\'un échelon', POUSSEE_COULEUR === POUSSEE, `${POUSSEE_COULEUR} et ${POUSSEE}`);
  exiger('chez son coach, un échelon de plus : sa force poussée une fois, son défaut tel quel', presque(chez.defense, deux.defense) && presque(chez.volume, un.volume), `défense ${un.defense} → ${chez.defense}`);
  exiger('à son échelon 2, la couleur en ajoute un : il joue comme deux poussées', presque(chez2.defense, patronALEchelon(k, { choix: ['force', 'force'] }).defense), `${chez2.defense}`);
  exiger('chez un autre coach, ou sans coach, il joue tel quel', ailleurs === un && assortiPour(null, un) === un);
}

/* ---------- 3 : les échelons (V20 : achetés quand on veut ; le détail du banc est à check_banc) ---------- */
{
  const k = 'per_gardienDuFort';
  const engage = [{ jour: 3, patron: patronALEchelon(k, {}) }];
  const e = etatDuPersonnel(engage, 60)[0];
  const achat = decisionDEchelon(e, 'force');
  exiger('monter coûte cher : chaque échelon, plus que le précédent, en jetons', achat.gain === -PRIX_ECHELON[2] && PRIX_ECHELON.slice(2).every((p, i, l) => !i || p > l[i - 1]),
    PRIX_ECHELON.slice(2).map(p => `${p} 🪙`).join(' · '));
  const monte = [...engage, { jour: 40, ...achat }];
  const apres = etatDuPersonnel(monte, 60)[0];
  exiger('un choix remplace la carte à son poste', apres.echelon === 2 && apres.qui === PATRONS[k].nom && etatDuPersonnel(monte, 60).length === 1);
  // Le calendrier : seuls tes matchs joués comptent (le prix d'embauche les lit).
  const A = {}, B = {}, cal = [[{ A, B, gfA: 2, gfB: 1 }], [{ A: B, B: {}, gfA: 1, gfB: 0 }], [{ A: B, B: A }]];
  exiger('les matchs de ton club : les tiens, joués', matchsJoues(cal, A, 0, 3) === 1 && matchsJoues(cal, B, 0, 3) === 2 && matchsJoues(cal, B, 1, 2) === 1);
}

/* ---------- 4 : le moteur, en paires ---------- */
const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function match(toi, adv, graine, visiteur, nomme = null) {
  for (const t of [toi, adv]) { for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) p.energie = 100; } if (t.injured) t.injured.clear(); t.jourCourant = 0; }
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  const moi = visiteur ? 'B' : 'A';
  const somme = a => (a || []).reduce((x, y) => x + y, 0);
  const pts = nomme ? (f.buts || []).reduce((a, b) => a + (b.marqueur && getPlayerKey(b.marqueur) === nomme ? 1 : 0) + (b.passeurs || []).filter(q => getPlayerKey(q) === nomme).length, 0) : 0;
  return { v: r.winner === toi ? 1 : 0, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB, tp: somme(f.tirs && f.tirs[moi]), pts };
}
/* Une carte d'un lieu : sa force et son défaut, lus sur ce qu'un soir montre. */
const LIRE = { tirs: S => S.tp / S.n, pct: S => (100 * S.gf) / S.tp, contre: S => S.ga / S.n };
const MOT = { tirs: 'tir par soir', pct: 'point de % au tir', contre: 'but contre par soir' };
const MESURES = [
  { cle: 'per_crieurDuBanc', force: ['tirs', 1], defaut: ['pct', 1] },        // volume 1,08 · finition 0,97
  { cle: 'per_gardiensDeRoute', force: ['contre', -1], defaut: ['tirs', 1] }, // defense 0,96 · volume 0,97
];
const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ',');
for (const M of MESURES) {
  const P = PATRONS[M.cle], visiteur = P.si === 'visiteur';
  const vide = () => ({ n: 0, v: 0, gf: 0, ga: 0, tp: 0 });
  const bras = { sans: [], un: [], force: ['force', 'force'], defaut: ['defaut', 'defaut'] };
  const S = Object.fromEntries(Object.keys(bras).map(k => [k, vide()]));
  for (const [lab, s, t] of TEMOINS) {
    const un = equipeReelle(s, t);
    for (let i = 0; i < N; i++) {
      for (const [k, choix] of Object.entries(bras)) {
        grainerHasard(`personnel:${lab}:toi`); const toi = equipe('Toi', t, un, s);
        grainerHasard(`personnel:${lab}:eux`); const adv = equipe('Eux', t, un, s);
        if (k !== 'sans') toi.patrons = [patronALEchelon(M.cle, { choix })];
        const r = match(toi, adv, `personnel:${lab}:${M.cle}:${i}`, visiteur);
        S[k].n++; for (const x of ['v', 'gf', 'ga', 'tp']) S[k][x] += r[x];
      }
    }
  }
  const ecart = (k, canal) => LIRE[canal](S[k]) - LIRE[canal](S.sans);
  const [cf, sf] = M.force, [cd, sd] = M.defaut;
  exiger(`${P.ico} ${P.nom} : ses deux poussées grandissent sa force (${cf})`, sf * ecart('force', cf) > sf * ecart('un', cf) && sf * ecart('un', cf) > 0,
    `${f2(ecart('un', cf))} → ${f2(ecart('force', cf))} ${MOT[cf]}`);
  exiger(`${P.ico} ${P.nom} : ses deux corrections font fondre son défaut (${cd})`, Math.abs(ecart('defaut', cd)) < Math.abs(ecart('un', cd)),
    `${f2(ecart('un', cd))} → ${f2(ecart('defaut', cd))} ${MOT[cd]}`);
  informer(`${P.ico} ${P.nom} : en victoires, sur ses soirs d'une saison`, `échelon 1 ${f2(((S.un.v - S.sans.v) / S.sans.n) * 41)} V · deux poussées ${f2(((S.force.v - S.sans.v) / S.sans.n) * 41)} V`);
}

/* ---------- 5 : le protégé (V16) ---------- */
{
  const k = 'per_maitreRuban', P = PATRONS[k], M = PROTEGES[k];   // à domicile : sa finition et ses tirs, sur sa meilleure gâchette
  const deux = protegeALEchelon(k, ['force', 'force']);
  exiger('le protégé : au premier échelon, la carte telle quelle ; deux poussées grandissent ses canaux', presque(protegeALEchelon(k, []).finition, M.finition)
    && presque(deux.finition, 1 + (M.finition - 1) * (1 + 2 * POUSSEE)) && presque(deux.lancers, 1 + (M.lancers - 1) * (1 + 2 * POUSSEE)), `finition ${M.finition} → ${deux.finition}`);
  const e = etatDuPersonnel([{ jour: 0, patron: patronALEchelon(k, {}) }], 60)[0];
  const d = decisionDEchelon(e, 'force');
  exiger('la décision d\'échelon repose le protégé, ses canaux à l\'échelon', d.mutation && d.mutation.cle === k && presque(d.mutation.canaux.finition, protegeALEchelon(k, ['force']).finition));
  const vide = () => ({ n: 0, pts: 0 });
  const bras = { sans: null, un: [], force: ['force', 'force', 'force', 'force'] };
  const S = Object.fromEntries(Object.keys(bras).map(x => [x, vide()]));
  for (const [lab, s, t] of TEMOINS) {
    const un = equipeReelle(s, t);
    for (let i = 0; i < N; i++) {
      let nomme = null;
      for (const [x, choix] of Object.entries(bras)) {
        grainerHasard(`personnel:${lab}:toi`); const toi = equipe('Toi', t, un, s);
        grainerHasard(`personnel:${lab}:eux`); const adv = equipe('Eux', t, un, s);
        const p = joueurDeMutation(toi, null, k);
        nomme = getPlayerKey(p);
        if (choix) { toi.patrons = [patronALEchelon(k, { choix })]; appliquerMutation(toi, p, k, 0, 'personnel', { canaux: protegeALEchelon(k, choix) }); }
        const r = match(toi, adv, `personnel:${lab}:${k}:${i}`, false, nomme);
        S[x].n++; S[x].pts += r.pts;
      }
    }
  }
  const par = x => S[x].pts / S[x].n - S.sans.pts / S.sans.n;
  exiger(`${P.ico} ${P.nom} : deux poussées grandissent les points de son protégé`, par('force') > par('un') && par('un') > 0,
    `${f2(par('un'))} → ${f2(par('force'))} point par soir à domicile`);
}

verdict('le personnel qui monte');
