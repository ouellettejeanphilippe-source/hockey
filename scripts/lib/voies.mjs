/*
 * LES VOIES BÂTIES — ce que check_voies bâtit : de vraies ligues de 32 clubs, et le même club rebâti aux couleurs
 * d'un coach (chaque case reprise par le joueur de sa couleur, chez lui à cette case, de salaire le plus proche).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, SLOTS, fits, getHiddenRatings, coachDuJoueur, getPersonKey, unitesIdeales } from '../../js/sim.js';
import { VOIES } from '../../js/coachs.js';
import { equipeReelle } from './vestiaires.mjs';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
export const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
export const signe = (x, d = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`;

/* Les vraies équipes d'une ligue, en joueurs (pas encore en clubs) : chaque bras d'une paire en refait des clubs neufs. */
export function vestiaires(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push({ nom: `${tag} ${sh.season}`, tag, s: sh.season, joueurs: un.flat() });
  }
  return out;
}
export const club = (V, roster) => createTeam(V.nom, V.tag, roster, { season: V.s });
export const rosterDe = V => { const p = V.joueurs.map(x => ({ ...x })); p.forEach(registerHiddenRatings); return autoRoster(p); };

/* Le bassin de chaque couleur : tous les joueurs-saisons d'un vrai rôle (quinze matchs), leur valeur `par` lue une fois. */
export function bassinsDesCouleurs(par) {
  const B = new Map(VOIES.map(k => [k, []]));
  for (const f of SAISONS) for (const p of shard(f).players) {
    if ((p.gp || 0) < 15) continue;
    const q = { ...p };
    registerHiddenRatings(q);
    const k = coachDuJoueur(q);
    if (B.has(k)) B.get(k).push({ p: q, v: par(q) });
  }
  return B;
}
/* Le même club, chaque case reprise par le joueur de la couleur `k` de valeur `par` la plus proche (une personne une fois). */
export function batir(roster, k, bassins, par) {
  const out = {}, pris = new Set(), B = bassins.get(k);
  for (const s of SLOTS) {
    const p = roster[s.i];
    if (!p) continue;
    const v = par(p);
    let best = null, d = Infinity;
    for (const x of B) {
      // Chez lui à cette case : sa position, et sa zone (un plombier ne prend pas la place d'un joueur de premier trio).
      if (pris.has(getPersonKey(x.p)) || !fits(x.p, s) || (s.group !== 'G' && !unitesIdeales(x.p, getHiddenRatings(x.p).v).includes(s.unit))) continue;
      const e = Math.abs(x.v - v);
      if (e < d) { d = e; best = x; }
    }
    const q = best ? { ...best.p } : p;
    registerHiddenRatings(q);
    if (best) pris.add(getPersonKey(best.p));
    out[s.i] = q;
  }
  return out;
}
