/**
 * Table de calibration de la simulation : 23 joueurs de cote uniforme,
 * 12 saisons par palier, fiche moyenne. À refaire tourner après toute
 * modification des constantes de js/sim.js, et reporter le tableau dans
 * CLAUDE.md et PLAN.md.
 *
 *   node scripts/calibrate_sim.mjs
 */

import { SLOTS, simulate } from '../js/sim.js';

const N = 12;
console.log('Cote | Fiche moyenne (V-D-DP)');
console.log('---|---');
for (const r of [50, 60, 70, 80, 90, 99]) {
  const roster = {};
  for (const s of SLOTS) {
    roster[s.i] = {
      n: 'X', s: 'cal', t: 'CAL', id: r * 100 + s.i,
      p: s.group === 'G' ? 'G' : (s.group === 'ANY' ? 'F' : s.group),
      np: s.group === 'G' ? 'G' : s.group === 'D' ? (s.role === 'DD' ? 'RD' : 'LD') : (s.role === 'AG' ? 'L' : s.role === 'AD' ? 'R' : 'C'),
      o: r, d: r, r, c: r, v: r, sp: r, $: 1e6,
    };
  }
  const t = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const x = simulate(roster);
    t[0] += x.W; t[1] += x.L; t[2] += x.OTL;
  }
  console.log(`${r} | ${t.map(v => Math.round(v / N)).join('-')}`);
}
