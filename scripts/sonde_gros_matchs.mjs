/*
 * SONDE (S70) : combien de gros matchs une saison donne-t-elle à ta formation ?
 * Le chiffre règle la mise en scène : un événement avant chaque gros match et
 * un choix au deuxième entracte ne doivent pas noyer la saison.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 12);
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
  return out;
}
const n = [], rival = [], nem = [];
for (let L = 0; L < LIGUES; L++) {
  const teams = ligue(5000 + L);
  teams[0].isPlayer = true;
  simulateLeague(teams, 82, { graine: `gros-${L}`, decisions: [] });
  const mb = teams[0].minisBoss || [];
  n.push(mb.length); rival.push(mb.filter(x => x.raison === 'rival').length); nem.push(mb.filter(x => x.raison === 'nemesis').length);
}
const moy = a => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
console.log(`gros matchs par saison : ${moy(n)} (min ${Math.min(...n)}, max ${Math.max(...n)}) · rival ${moy(rival)} · rivalité ${moy(nem)}`);
