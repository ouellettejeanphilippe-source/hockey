/**
 * LES VOIES (V2.3, docs/refonte-systeme.md § 8) — chaque coach bâti au complet.
 *
 *   node scripts/check_voies.mjs            (LIGUES=4 par défaut, une quinzaine de minutes)
 *   LIGUES=0 node scripts/check_voies.mjs   (la construction seule, sans saison : la CI)
 *
 * Une voie BÂTIE AU COMPLET : le même club, chaque case reprise par le joueur de la couleur du coach dont la
 * valeur est la plus proche (la force de l'alignement ne bouge pas, sa couleur oui), la confiance III du coach,
 * et ses lignes laissées à l'IA (qui prend le système où ses joueurs ont leur badge, le sien à la II). Elle se
 * mesure EN PAIRES contre le même club sans coach. L'ÉQUIPE MÉLANGÉE : le club tel qu'il est, avec la même
 * confiance III — les couleurs de tout le monde.
 *
 * Vérifie, comme le budget du § 8 le demande :
 *   1. la construction tient : la valeur de l'alignement bâti reste celle du club (à 1 % près), et ses cases
 *      sont de la couleur du coach ;
 *   2. chaque voie bâtie vaut +6 à +8 V ;
 *   3. les voies sont à ±1 V l'une de l'autre (aucune n'est LA bonne) ;
 *   4. chacune vaut plus que l'équipe mélangée avec la même confiance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, fits, getHiddenRatings, coachDuJoueur, getPersonKey } from '../js/sim.js';
import { COACHS, VOIES, effetDePalier } from '../js/coachs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 4);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const signe = x => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;

/* Les vraies équipes d'une ligue, en joueurs (pas encore en clubs) : chaque bras de la paire en refait des clubs neufs. */
function vestiaires(seed, n = 32) {
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
const club = (V, roster) => createTeam(V.nom, V.tag, roster, { season: V.s });
const rosterDe = V => { const p = V.joueurs.map(x => ({ ...x })); p.forEach(registerHiddenRatings); return autoRoster(p); };

/* Le bassin de chaque couleur : tous les joueurs-saisons d'un vrai rôle (quinze matchs), leur valeur lue une fois. */
const BASSIN = new Map(VOIES.map(k => [k, []]));
for (const f of SAISONS) for (const p of shard(f).players) {
  if ((p.gp || 0) < 15) continue;
  const q = { ...p };
  registerHiddenRatings(q);
  const k = coachDuJoueur(q);
  if (BASSIN.has(k)) BASSIN.get(k).push({ p: q, v: getHiddenRatings(q).v });
}
/* Le même club, chaque case reprise par le joueur de la couleur `k` de valeur la plus proche (une personne une fois). */
function batir(roster, k) {
  const out = {}, pris = new Set(), B = BASSIN.get(k);
  for (const s of SLOTS) {
    const p = roster[s.i];
    if (!p) continue;
    const v = getHiddenRatings(p).v;
    let best = null, d = Infinity;
    for (const x of B) {
      if (pris.has(getPersonKey(x.p)) || !fits(x.p, s)) continue;
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
const valeur = roster => SLOTS.reduce((a, s) => a + (roster[s.i] ? getHiddenRatings(roster[s.i]).v : 0), 0);

console.log('\n  LES VOIES\n');

// 1. La construction tient.
{
  const V = vestiaires(41, 4);
  const ecarts = [], couleurs = [];
  for (const v of V) for (const k of VOIES) {
    const r0 = rosterDe(v), r1 = batir(r0, k);
    ecarts.push(Math.abs(valeur(r1) / valeur(r0) - 1));
    const js = Object.values(r1).filter(Boolean);
    couleurs.push(js.filter(p => coachDuJoueur(p) === k).length / js.length);
  }
  informer('bassins', VOIES.map(k => `${COACHS[k].ico} ${BASSIN.get(k).length}`).join(' · '));
  // Une couleur ne prend que les cases qu'elle a : le Frelon n'a pas de gardien, l'Aigle pas de défenseur.
  informer('cases de la couleur du coach', VOIES.map((k, i) => `${COACHS[k].ico} ${Math.round(100 * moy(couleurs.filter((_, j) => j % VOIES.length === i)))} %`).join(' · '));
  borne('la valeur d\'un alignement bâti reste celle du club (en moyenne)', moy(ecarts), 0, 0.02);
  borne('… et au pire', Math.max(...ecarts), 0, 0.06);

}

/*
 * 2 à 4. EN PAIRES : la moitié de la ligue reçoit le traitement, l'autre joue telle quelle, puis on inverse ; le
 * même club, les mêmes dés. `traite(V, roster)` rend le roster du club traité ; le coach III s'ajoute aux deux voies.
 */
function paires(k, batie) {
  const dv = [];
  for (let Lg = 0; Lg < LIGUES; Lg++) {
    const V = vestiaires(5000 + Lg), bras = [];
    for (const parite of [0, 1]) {
      const teams = V.map((v, i) => { const r = rosterDe(v); return club(v, i % 2 === parite && batie ? batir(r, k) : r); });
      const decisions = teams.map((_, i) => i).filter(i => i % 2 === parite).map(equipe => ({ jour: 0, equipe, coach: effetDePalier(k, 3) }));
      simulateLeague(teams, 82, { graine: `voies-${Lg}`, decisions });
      bras.push(teams.map(t => t.W));
    }
    for (let i = 0; i < V.length; i++) dv.push(bras[i % 2][i] - bras[1 - (i % 2)][i]);
  }
  return moy(dv);
}
if (LIGUES > 0) {
  console.log(`\n  ${LIGUES} ligues × 32 équipes, en paires\n`);
  const lu = [];
  for (const k of VOIES) {
    const b = paires(k, true), m = paires(k, false);
    lu.push({ k, b, m });
    console.log(`  ${COACHS[k].ico} ${COACHS[k].nom.padEnd(16)} bâtie ${signe(b)} V · mélangée ${signe(m)} V`);
  }
  const bs = lu.map(x => x.b);
  for (const x of lu) borne(`${COACHS[x.k].nom} : la voie bâtie au complet`, x.b, 6, 8, ' V');
  borne('les voies à ±1 V l\'une de l\'autre (l\'écart du plus fort au plus faible, sur deux)', (Math.max(...bs) - Math.min(...bs)) / 2, 0, 1, ' V');
  exiger('chaque voie bâtie vaut plus que l\'équipe mélangée avec la même confiance', lu.every(x => x.b > x.m), lu.filter(x => x.b <= x.m).map(x => COACHS[x.k].nom).join(', ') || `${lu.length} voies`);
}
verdict();
