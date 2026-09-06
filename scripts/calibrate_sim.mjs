/**
 * Table de calibration : de vrais joueurs, tous d'une même cote.
 *
 * L'ancienne version fabriquait 23 joueurs synthétiques `{o:r, d:r, …}`. Ça
 * ne marche plus, et c'est révélateur : le moteur par événements se nourrit
 * des VRAIES statistiques — lancers, buts par lancer, pourcentage d'arrêts —
 * que des joueurs inventés n'ont pas. Un banc synthétique jouait donc comme
 * 23 rappels de la ligue mineure, quelle que soit sa cote.
 *
 * On tire donc de vrais joueurs-saisons dont la cote globale est celle du
 * palier, en respectant les positions. Le banc reste dégénéré par nature —
 * 23 joueurs de même calibre franchissent tous ensemble les seuils de zone,
 * ce qui fabrique des marches artificielles — et c'est pourquoi
 * `check_monotonie.mjs`, sur de vraies équipes, reste le test qui fait
 * autorité.
 *
 *   node scripts/calibrate_sim.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, simulate, autoRoster, registerHiddenRatings } from '../js/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const N = Number(process.env.ESSAIS ?? 12);

const tous = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  for (const p of JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8')).players) {
    if ((p.gp || 0) >= 40) tous.push(p);
  }
}

/** 23 joueurs dont la cote est aussi près que possible du palier. */
function bancDe(cote) {
  const pool = [];
  const besoin = { F: 15, D: 6, G: 2 };   // 12 + réservistes
  for (const [pos, n] of Object.entries(besoin)) {
    const cands = tous.filter(p => p.p === pos)
      .sort((a, b) => Math.abs(a.v - cote) - Math.abs(b.v - cote));
    const vus = new Set();
    for (const p of cands) {
      if (pool.length >= 23) break;
      if (vus.has(p.id)) continue;
      vus.add(p.id);
      pool.push({ ...p });
      if (pool.filter(x => x.p === pos).length >= n) break;
    }
  }
  pool.forEach(registerHiddenRatings);
  return autoRoster(pool);
}

console.log('\nCote | Fiche moyenne (V-D-DP) | BP-BC');
console.log('---|---|---');
for (const cote of [50, 60, 70, 80, 90, 99]) {
  const roster = bancDe(cote);
  const t = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const x = simulate(roster);
    t[0] += x.W; t[1] += x.L; t[2] += x.OTL; t[3] += x.GF; t[4] += x.GA;
  }
  const r = t.map(v => Math.round(v / N));
  console.log(`${cote} | ${r[0]}-${r[1]}-${r[2]} | ${r[3]}-${r[4]}`);
}
console.log('');
