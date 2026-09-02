/**
 * Vérification des cotes sur les shards en place : distribution de la cote
 * globale, part de chaque zone de trio, répartition des archétypes, cibles
 * salariales, et surtout la cohérence entre la force d'une équipe (moyenne
 * des cotes de son alignement) et son vrai classement — reconstitué depuis
 * les fiches des gardiens (V-D), les buts des patineurs et la moyenne des
 * gardiens.
 *
 *   node scripts/check_ratings.mjs                 # résumé global + corrélations par saison
 *   node scripts/check_ratings.mjs 1981-82 2006-07 # + détail des vedettes de ces saisons
 *
 * À faire tourner après un `--rerate` ou un changement de formule. Repères
 * attendus (voir PLAN.md) : corrélation force ~ % de victoires ≈ 0,8.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINE_ZONES } from '../js/ratings.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const detail = new Set(process.argv.slice(2));

const pct = (a, q) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(q * (b.length - 1))]; };
const M = n => (n / 1e6).toFixed(2) + ' M$';

function spearman(x, y) {
  const rk = a => { const s = [...a.keys()].sort((i, j) => a[i] - a[j]); const r = []; s.forEach((idx, i) => { r[idx] = i; }); return r; };
  const rx = rk(x), ry = rk(y), n = x.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}

const allF = [], allD = [], allG = [];
const corr = [];
const eras = [];

for (const f of fs.readdirSync(SEASONS_DIR).filter(f => f.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const label = shard.season;
  const uniq = new Map();
  for (const p of shard.players) uniq.set(p.id ?? p.n, p);
  const arr = [...uniq.values()];
  for (const p of arr) (p.p === 'F' ? allF : p.p === 'D' ? allD : allG).push(p);

  // Force d'équipe vs classement reconstitué
  const byTeam = {};
  for (const p of shard.players) (byTeam[p.t] = byTeam[p.t] || []).push(p);
  const xs = [], wins = [], gfs = [], gas = [];
  for (const ps of Object.values(byTeam)) {
    const F = ps.filter(p => p.p === 'F').sort((a, b) => b.v - a.v).slice(0, 12);
    const D = ps.filter(p => p.p === 'D').sort((a, b) => b.v - a.v).slice(0, 6);
    const G = ps.filter(p => p.p === 'G').sort((a, b) => b.gp - a.gp);
    if (F.length < 9 || D.length < 4 || !G.length) continue;
    const gw = G.reduce((s, g) => s + g.w, 0), gl = G.reduce((s, g) => s + g.l, 0);
    if (gw + gl < 20) continue;
    const mean = a => a.reduce((s, p) => s + p.v, 0) / a.length;
    xs.push(0.5 * mean(F) + 0.3 * mean(D) + 0.2 * G[0].v);
    wins.push(gw / (gw + gl));
    gfs.push(ps.filter(p => p.p !== 'G' && !p.x).reduce((s, p) => s + p.g, 0));
    gas.push(-G.reduce((s, g) => s + (g.ga || 3) * g.gp, 0) / G.reduce((s, g) => s + g.gp, 0));
  }
  if (xs.length >= 6) corr.push({ label, n: xs.length, w: spearman(xs, wins), gf: spearman(xs, gfs), ga: spearman(xs, gas) });

  // Disponibilité des statistiques et amplitude des sous-cotes. Le temps de
  // glace n'existe qu'à partir de 1997-98 et les mises en échec qu'à partir
  // de 2005-06 : si `mix` fait sa job, l'écart-type des sous-cotes doit
  // rester comparable de part et d'autre de ces deux frontières. Un
  // écrasement dans la colonne « déf » ou « vit » avant 1998 veut dire
  // qu'une composante absente est retombée à compter comme un zéro.
  const sk = arr.filter(p => p.p !== 'G');
  if (sk.length) {
    const sd = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
    eras.push({
      label,
      toi: sk.some(p => (p.toi || 0) > 0),
      ht: sk.some(p => p.ht != null),
      sd: ['o', 'd', 'r', 'c', 'sp'].map(k => sd(sk.map(p => p[k]))),
      top10: (() => {
        const F = sk.filter(p => p.p === 'F').sort((a, b) => b.pt - a.pt).slice(0, 10);
        return F.length ? F.reduce((s2, p) => s2 + p.v, 0) / F.length : 0;
      })(),
    });
  }

  if (detail.has(label)) {
    console.log(`\n=== ${label} (${Object.keys(byTeam).length} équipes, v${shard.v})`);
    const row = p => `  ${p.n.padEnd(24)} ${p.p} ${String(p.np).padEnd(2)} PJ ${String(p.gp).padStart(2)} PTS ${String(p.pt ?? p.w).padStart(3)}  o ${p.o} d ${p.d} r ${p.r} c ${p.c}  v ${p.v}  ${M(p.$).padStart(9)}  ${p.ak} · zone ${p.lz}${p.elc ? ' · ELC' : ''}`;
    const sk = arr.filter(p => p.p !== 'G');
    console.log('-- meilleurs marqueurs');
    for (const p of [...sk].sort((a, b) => b.pt - a.pt).slice(0, 10)) console.log(row(p));
    console.log('-- défenseurs');
    for (const p of sk.filter(p => p.p === 'D').sort((a, b) => b.pt - a.pt).slice(0, 6)) console.log(row(p));
    console.log('-- gardiens');
    for (const p of arr.filter(p => p.p === 'G').sort((a, b) => b.v - a.v).slice(0, 4)) console.log(row(p));
    console.log(`-- ≥ 10 M$ : ${sk.filter(p => p.$ >= 10e6).length}, ≥ 5 M$ : ${sk.filter(p => p.$ >= 5e6).length}, contrats d'entrée : ${arr.filter(p => p.elc).length}, salaires réels : ${arr.filter(p => p.isReal).length}`);
  }
}

const P = a => ['p10', 'p50', 'p85', 'p95', 'p99', 'max'].map((n, i) => `${n}=${pct(a.map(p => p.v), [0.1, 0.5, 0.85, 0.95, 0.99, 1][i])}`).join('  ');
console.log(`\nCote globale — F : ${P(allF)}`);
console.log(`Cote globale — D : ${P(allD)}`);
console.log(`Cote globale — G : ${P(allG)}`);
const share = (a, zones) => zones.map(z => `${z.short} ${(100 * a.filter(p => p.lz === z.level).length / a.length).toFixed(0)} %`).join(' · ');
console.log(`Zones F : ${share(allF, LINE_ZONES.F)}`);
console.log(`Zones D : ${share(allD, LINE_ZONES.D)}`);
console.log(`Zones G : ${share(allG, LINE_ZONES.G)}`);

const h = allF.filter(p => p.pt >= 100);
console.log(`100+ points (${h.length}) : cote min ${Math.min(...h.map(p => p.v))}, p10 ${pct(h.map(p => p.v), 0.1)}, médiane ${pct(h.map(p => p.v), 0.5)}, max ${Math.max(...h.map(p => p.v))}`);
const hm = h.filter(p => parseInt(p.s.slice(0, 4), 10) >= 1995);
console.log(`100+ points depuis 1995 (${hm.length}) : cote min ${Math.min(...hm.map(p => p.v))}, médiane ${pct(hm.map(p => p.v), 0.5)}`);
const d5 = allD.filter(p => p.pt >= 50 && p.pt <= 60 && p.gp >= 60);
console.log(`Défenseurs 50-60 pts (${d5.length}) : cote médiane ${pct(d5.map(p => p.v), 0.5)}, salaire médian ${M(pct(d5.map(p => p.$), 0.5))}`);

const count = {};
for (const p of [...allF, ...allD, ...allG]) count[p.ak] = (count[p.ak] || 0) + 1;
console.log('Archétypes :', Object.entries(count).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
const all = allF.length + allD.length + allG.length;
console.log(`Contrats d'entrée : ${[...allF, ...allD, ...allG].filter(p => p.elc).length} / ${all}`);

console.log('\nDisponibilité des stats et amplitude des sous-cotes (écart-type)');
console.log("  saison    TG  MÉ     off    déf    rob    clu    vit   cote moy. des 10 meilleurs compteurs");
for (const e of eras) {
  console.log(`  ${e.label}  ${(e.toi ? 'oui' : ' — ').padStart(3)} ${(e.ht ? 'oui' : ' — ').padStart(3)}`
    + e.sd.map(v => v.toFixed(1).padStart(7)).join('') + `   ${e.top10.toFixed(1).padStart(5)}`);
}
{
  const grp = f => { const g = eras.filter(f); return g.length
    ? ['déf', 'vit'].map((n, i) => `${n} ${(g.reduce((s2, e) => s2 + e.sd[i === 0 ? 1 : 4], 0) / g.length).toFixed(1)}`).join('  ')
      + `  top10 ${(g.reduce((s2, e) => s2 + e.top10, 0) / g.length).toFixed(1)}`
    : '—'; };
  console.log(`  avant 1997-98 (sans TG)  : ${grp(e => !e.toi)}`);
  console.log(`  1997-98 à 2004-05        : ${grp(e => e.toi && !e.ht)}`);
  console.log(`  2005-06 et après         : ${grp(e => e.ht)}`);
}

console.log('\nForce d\'équipe (Spearman) ~ % victoires | buts pour | buts contre');
for (const c of corr) console.log(`  ${c.label}  ${String(c.n).padStart(2)} éq.  ${c.w.toFixed(2)} | ${c.gf.toFixed(2)} | ${c.ga.toFixed(2)}`);
const avg = k => corr.reduce((s, c) => s + c[k], 0) / corr.length;
console.log(`  moyenne          ${avg('w').toFixed(3)} | ${avg('gf').toFixed(3)} | ${avg('ga').toFixed(3)}   (min victoires ${Math.min(...corr.map(c => c.w)).toFixed(2)})`);
