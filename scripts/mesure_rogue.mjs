/*
 * MESURE — le mode Rogue (S77). Combien de points fait une équipe de
 * plombiers (le bas de huit saisons), et combien avec N joueurs tirés des
 * packs à la place des pires ? C'est ce qui règle l'économie : ce qu'une run
 * rapporte en jetons, et ce qu'il faut de packs pour viser les séries.
 * Lecture seule : ce script informe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { rareteDeSalaire } from '../js/cartes.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) { const s = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); s.players.forEach(registerHiddenRatings); C.set(f, s); } return C.get(f); };
let x = 12345; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const grp = p => (p.p === 'G' ? 'G' : ['D', 'LD', 'RD'].includes(p.p) ? 'D' : 'F');
const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
function plombiers() {
  const pool = [];
  for (let k = 0; k < 8; k++) {
    const sh = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    for (const g of ['F', 'D', 'G']) {
      const reg = sh.players.filter(p => grp(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 30)).sort((a, b) => prod(a) - prod(b));
      const [b, h] = (process.env.BANDE || '0.1,0.3').split(',').map(Number);
      const t = reg.slice(Math.floor(reg.length * b), Math.max(1, Math.floor(reg.length * h)));
      for (let i = 0; i < (g === 'F' ? 3 : g === 'D' ? 2 : 1); i++) pool.push({ ...t[Math.floor(rnd() * t.length)] });
    }
  }
  return pool;
}
/* Un joueur de pack : rareté selon les cotes du pack de base, puis un régulier de cette rareté. */
function joueurDePack() {
  const r = rnd() * 100, rarete = r < 62 ? 'commune' : r < 89 ? 'peu' : r < 98 ? 'rare' : 'legendaire';
  const sh = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
  const reg = g => sh.players.filter(p => grp(p) === g && (p.gp || 0) >= (g === 'G' ? 15 : 30)).sort((a, b) => prod(b) - prod(a));
  const bons = new Set(['F', 'D', 'G'].flatMap(g => { const r = reg(g); return r.slice(0, Math.ceil(r.length * Number(process.env.HAUT || 0.5))); }));
  const c = [...bons].filter(p => p.$ > 0 && rareteDeSalaire(p, sh) === rarete);
  return c.length ? { ...c[Math.floor(rnd() * c.length)] } : null;
}
function ligue(toi) {
  const out = [toi], vus = new Set();
  while (out.length < 32) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)]; const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))]; const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    const p = un.flat().map(q => ({ ...q })); p.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
  }
  return out;
}
const N = Number(process.env.N || 3);
for (const recrues of [0, 4, 8, 12, 16]) {
  const pts = [];
  for (let k = 0; k < N; k++) {
    const pool = plombiers();
    for (let i = 0; i < recrues; i++) { const p = joueurDePack(); if (p) pool.push(p); }
    const toi = createTeam('Rogue', 'YOU', autoRoster(pool), { isPlayer: true });
    const L = ligue(toi);
    simulateLeague(L, 82, { graine: `rogue${recrues}-${k}`, decisions: [] });
    const rang = L.slice().sort((a, b) => b.PTS - a.PTS).indexOf(toi) + 1;
    pts.push(`${toi.PTS} pts (${toi.W}-${toi.L}-${toi.OTL}, ${rang}e)`);
  }
  console.log(`  ${String(recrues).padStart(2)} joueurs de pack : ${pts.join(' · ')}`);
}
