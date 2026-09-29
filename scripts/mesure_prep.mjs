/*
 * MESURE — la préparation (S76). Le même gros match isolé, sur les mêmes dés,
 * sans préparation, avec la bonne, avec une mauvaise ; et le rapport de
 * dépistage est-il HONNÊTE (« 55 % » sort-il une fois sur deux et quelque) ?
 * Lecture seule : ce script n'exige rien, il informe (check_combat juge).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, PLANS_ADV, simulerGrosMatch, depistageDe, planDuDepistage } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < 32) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  out[0].isPlayer = true;
  return out;
}

const L = ligue(9100), N = Number(process.env.N || 2000);
let sans = 0, juste = 0, ratee = 0;
const bins = new Map();   // chance annoncée → [annoncés, sortis]
let favori = 0;
for (let k = 0; k < N; k++) {
  const toi = L[k % 32], adv = L[(k * 7 + 3) % 32];
  const dep = depistageDe('calibrage', `j${k}`, adv);
  const plan = planDuDepistage('calibrage', `j${k}`, dep);
  if (plan === dep[0].plan) favori++;
  for (const x of dep) { const b = bins.get(x.p) || [0, 0]; b[0]++; if (x.plan === plan) b[1]++; bins.set(x.p, b); }
  const autre = dep.find(x => x.plan !== plan).plan;
  const o = { plan, graine: 'calibrage', cle: `j${k}`, cartes: { jouees: [] } };
  sans += simulerGrosMatch(toi, adv, o).gagne;
  juste += simulerGrosMatch(toi, adv, { ...o, prep: plan }).gagne;
  ratee += simulerGrosMatch(toi, adv, { ...o, prep: autre }).gagne;
}
const pct = x => `${(x / N * 100).toFixed(1)} %`;
console.log(`  ${N} gros matchs isolés : sans préparation ${pct(sans)} · préparation juste ${pct(juste)} · ratée ${pct(ratee)}`);
console.log(`  le favori du rapport est leur plan ${pct(favori)} des fois`);
console.log('  honnêteté du rapport (annoncé → sorti) :');
for (const [p, [n, s]] of [...bins].sort((a, b) => a[0] - b[0])) if (n >= 30) console.log(`    ${String(p).padStart(3)} %  → ${(100 * s / n).toFixed(0).padStart(3)} %  (${n})`);
