/**
 * Recalcul hors ligne de l'étage 2 des cotes (cote globale, salaire,
 * archétype, zone de trio, contrats d'entrée) sur les shards existants.
 *
 *   node scripts/rerate.mjs               # tous les shards de data/seasons
 *   node scripts/rerate.mjs 1981-82 2006-07
 *
 * N'appelle pas l'API : les sous-cotes o, d, r, c, sp déjà dans les shards
 * sont conservées. Lit tous les shards de toute façon pour connaître la
 * première saison de chaque joueur (contrats d'entrée), et
 * data/salaries/<saison>.json s'il existe (salaires réels publiés, voir
 * ARCHITECTURE.md). Appelé par scripts/build_shards.py après chaque build
 * et par son option --rerate.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rerateShard, RATINGS_VERSION } from '../js/ratings.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const SALARIES_DIR = path.join(ROOT, 'data', 'salaries');

const only = new Set(process.argv.slice(2).filter(a => !a.startsWith('--')));

const files = fs.readdirSync(SEASONS_DIR).filter(f => f.endsWith('.json')).sort();
const shards = new Map();
for (const f of files) {
  shards.set(f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8')));
}

// Première saison (à minGP matchs ou plus) de chaque joueur dans la base
const firstSeason = {};
for (const [label, shard] of shards) {
  const year = parseInt(label.slice(0, 4), 10);
  for (const p of shard.players) {
    if (p.id == null) continue;
    if (firstSeason[p.id] === undefined || year < firstSeason[p.id]) firstSeason[p.id] = year;
  }
}

/*
 * Cohorte d'identifiant LNH -> année d'entrée estimée. Les identifiants
 * attribués depuis le début des années 1990 (>= 8455000) le sont dans
 * l'ordre d'entrée dans la ligue (repêchage ou signature) ; en dessous,
 * les anciens joueurs ont été numérotés par ordre alphabétique et la
 * cohorte ne veut rien dire. Pour chaque tranche de 1 000 identifiants, on
 * prend le 10e centile de la première saison (les joueurs qui arrivent
 * tout de suite après leur entrée), lissé pour rester croissant.
 */
export function estimateEntryYears(first) {
  const CHRONO_MIN = 8_455_000, BUCKET = 1000;
  const buckets = new Map();
  for (const [id, y] of Object.entries(first)) {
    const n = Number(id);
    if (n < CHRONO_MIN) continue;
    const b = Math.floor(n / BUCKET);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(y);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const p10 = new Map();
  let running = 0;
  for (const b of keys) {
    const ys = buckets.get(b).sort((a, c) => a - c);
    const v = ys[Math.floor(ys.length * 0.1)];
    running = Math.max(running, v);
    p10.set(b, running);
  }
  const out = {};
  for (const id of Object.keys(first)) {
    const n = Number(id);
    if (n < CHRONO_MIN) continue;
    const b = Math.floor(n / BUCKET);
    if (p10.has(b)) out[id] = p10.get(b);
  }
  return out;
}
const entryYear = estimateEntryYears(firstSeason);

export function loadSalaries(label) {
  const f = path.join(SALARIES_DIR, `${label}.json`);
  if (!fs.existsSync(f)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    return { cap: raw.cap || null, players: raw.players || {} };
  } catch (e) {
    console.error(`salaires ${label} illisibles : ${e.message}`);
    return null;
  }
}

let done = 0;
for (const [label, shard] of shards) {
  if (only.size && !only.has(label)) continue;
  const salaries = loadSalaries(label);
  const out = rerateShard(shard, { salaries, firstSeason, entryYear });
  fs.writeFileSync(path.join(SEASONS_DIR, `${label}.json`), JSON.stringify(out));
  const elc = out.players.filter(p => p.elc).length;
  const real = out.players.filter(p => p.isReal).length;
  console.log(`${label}  v${RATINGS_VERSION}  ${out.players.length} entrées, ${elc} contrats d'entrée${real ? `, ${real} salaires réels` : ''}`);
  done++;
}
console.log(`${done} shard(s) recalculé(s)`);
