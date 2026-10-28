/*
 * LE COMBO DU COACH (js/personnel.js `COMBOS`, V19 ; JP : *le club se construit autour du coach*). Deux adjoints de la couleur
 * du coach en poste, avec lui, ajoutent un effet chaque match (JP : *pas de moments pour les adjoints*). Ce qu'on exige, en paires
 * (la même soirée, les mêmes dés, le combo allumé contre éteint — `_sansCombo`), un soir sur deux à domicile :
 *   1. il se VOIT dans la feuille d'un soir (±2 tirs, ±0,3 but, ±0,5 punition, ±4 mises en échec, ±3 blessures par saison ou ±3 points de glace d'un trio) ;
 *   2. il reste sous la borne d'une commune sur une saison (1 V) ;
 *   3. il ne joue ni sans l'un de ses deux adjoints, ni sans son coach ;
 *   4. un coach ne lit que son combo, et ses deux adjoints sont de sa couleur et de deux postes.
 *   N=300 node scripts/check_combos.mjs
 */
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, playGame, feuilleVierge, grainerHasard } from '../js/sim.js';
import { COMBOS } from '../js/personnel.js';
import { BANQUE } from '../js/banque.js';
import { effetDePalier } from '../js/coachs.js';
import { patronALEchelon } from '../js/echelons.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 300);
const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
const somme = a => (a || []).reduce((x, y) => x + y, 0);
function soir(toi, adv, graine, visiteur) {
  for (const t of [toi, adv]) { for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) p.energie = 100; } if (t.injured) t.injured.clear(); t.jourCourant = 0; }
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  const moi = visiteur ? 'B' : 'A', lui = visiteur ? 'A' : 'B';
  return { v: r.winner === toi ? 1 : 0, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB, tp: somme(f.tirs[moi]), tc: somme(f.tirs[lui]),
    pun: (f.punitions || []).filter(p => p.cote === moi).length, coups: f.coups[moi], bless: (f.blessures || []).filter(b => b.cote === moi).length,
    g1: 100 * ((f.glace && f.glace[moi] && f.glace[moi].F[0]) || 0), g4: 100 * ((f.glace && f.glace[moi] && f.glace[moi].F[3]) || 0) };
}
const CLES = ['v', 'gf', 'ga', 'tp', 'tc', 'pun', 'coups', 'bless', 'g1', 'g4'];
function paires(coach, cles, sansCoach = false) {
  const C = COMBOS[coach], S = Object.fromEntries(['avec', 'sans'].map(k => [k, { n: 0, ...Object.fromEntries(CLES.map(c => [c, 0])) }]));
  for (const [lab, s, t] of TEMOINS) {
    const un = equipeReelle(s, t);
    for (let i = 0; i < N; i++) for (const k of ['avec', 'sans']) {
      grainerHasard(`combo:${lab}:toi`); const toi = equipe('Toi', t, un, s);
      grainerHasard(`combo:${lab}:eux`); const adv = equipe('Eux', t, un, s);
      toi.patrons = cles.map(c => patronALEchelon(c, {}));
      toi.coachs = sansCoach ? [] : [effetDePalier(coach, 1)];
      toi._sansCombo = k === 'sans';
      const r = soir(toi, adv, `combo:${lab}:${coach}:${i}`, i % 2 === 1);
      S[k].n++; for (const c of CLES) S[k][c] += r[c];
    }
  }
  return S;
}
const delta = (S, c) => (S.avec[c] - S.sans[c]) / S.avec.n;
for (const [coach, C] of Object.entries(COMBOS)) {
  const [a, b] = C.cles, ba = BANQUE[`patron:${a}`], bb = BANQUE[`patron:${b}`];
  exiger(`${C.ico} ${C.nom} : deux adjoints de la couleur du coach, de deux postes`, ba.coach === coach && bb.coach === coach && ba.role !== bb.role, `${ba.role} + ${bb.role}`);
  const S = paires(coach, C.cles);
  const d = Object.fromEntries(CLES.map(c => [c, delta(S, c)]));
  const parSaison = 82;
  const vSaison = d.v * parSaison;
  informer(`${C.ico} ${C.nom}`, `tirs ${d.tp >= 0 ? '+' : ''}${d.tp.toFixed(1)} / contre ${d.tc >= 0 ? '+' : ''}${d.tc.toFixed(1)} · buts ${d.gf >= 0 ? '+' : ''}${d.gf.toFixed(2)} / ${d.ga >= 0 ? '+' : ''}${d.ga.toFixed(2)} · punitions ${d.pun.toFixed(2)} · coups ${d.coups.toFixed(1)} · blessures ${(d.bless * 82).toFixed(1)} par saison · glace ${d.g1.toFixed(1)} / ${d.g4.toFixed(1)} pts · ${vSaison.toFixed(2)} V par saison`);
  const visible = Math.abs(d.tp) >= 2 || Math.abs(d.tc) >= 2 || Math.abs(d.gf) >= 0.3 || Math.abs(d.ga) >= 0.3 || Math.abs(d.pun) >= 0.5 || Math.abs(d.coups) >= 4 || Math.abs(d.bless * 82) >= 3 || Math.abs(d.g1) >= 3 || Math.abs(d.g4) >= 3;
  exiger(`${C.ico} ${C.nom} : il se voit dans la feuille d'un soir`, visible);
  exiger(`${C.ico} ${C.nom} : sous la borne d'une commune sur une saison (1 V)`, Math.abs(vSaison) <= 1, `${vSaison.toFixed(2)} V`);
  const seul = paires(coach, [a]), sansC = paires(coach, C.cles, true);
  const nul = S2 => CLES.every(c => Math.abs(delta(S2, c)) < 1e-9);
  exiger(`${C.ico} ${C.nom} : rien sans l'un des deux adjoints, rien sans son coach`, nul(seul) && nul(sansC));
}
verdict('Le combo du coach');
