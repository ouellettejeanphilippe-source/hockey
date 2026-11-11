/*
 * LES SAISONS ET LEURS SHARDS, POUR LES ROBOTS (sorti de scripts/lib/rogue_sim.mjs, le robot de l'ancienne run, parti à la
 * V28, tranche 4). Les saisons du jeu sont celles de l'index ; un shard lu une fois, ses joueurs connus du coffre de cotes
 * et rangés par club. Le générateur semé par des mots est celui du robot « premier Signer » (scripts/check_robot.mjs) : ses
 * tirages ne bougent pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHiddenRatings, retenirMatchsDuShard } from '../../js/sim.js';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIR = path.join(ROOT, 'data', 'seasons');
// Les saisons du jeu sont celles de l'index (scripts/build_shards.py `saison_jouable`) : la saison en cours n'y entre qu'à la mi-saison.
export const SAISONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')).seasons;
const CACHE = new Map();
export function shard(s) {
  if (!CACHE.has(s)) {
    const e = JSON.parse(fs.readFileSync(path.join(DIR, `${s}.json`), 'utf8'));
    e.players.forEach(registerHiddenRatings);
    retenirMatchsDuShard(e);
    e.byTeam = {};
    for (const p of e.players) (e.byTeam[p.t] = e.byTeam[p.t] || []).push(p);
    CACHE.set(s, e);
  }
  return CACHE.get(s);
}

/* Un générateur pur (sfc32), semé par des mots. */
export function generateur(...mots) {
  const txt = mots.join('|');
  let h = 1779033703 ^ txt.length;
  for (const c of txt) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  const graine = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  let a = graine(), b = graine(), c = graine(), d = graine();
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
