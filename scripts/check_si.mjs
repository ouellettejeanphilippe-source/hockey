/*
 * FORTE, MAIS DANS SON MOMENT (V3.4 ; V16, sur le personnel). JP : *un joueur est plus robuste à domicile* ; *ce genre
 * de trucs complexes, mais pas trop*. Un adjoint d'un moment (`si` : domicile, visiteur, series) ne joue que ses soirs,
 * et ses soirs-là il se VOIT. Mesuré en paires, match par match : le même club joue les mêmes matchs, sous les mêmes
 * dés, avec puis sans l'adjoint engagé au jour 0 (les places de la V3.4, le gardien du château, le joueur de route et
 * l'homme des séries, sont parties à la V16 ; ces trois adjoints les reprennent).
 *   1. ses soirs, l'effet se voit dans la feuille (au moins un dixième de but par match, pour ou contre) ;
 *   2. hors de ses soirs, son fond seulement (V19, `FOND_DU_STYLE`) : l'adjoint des séries joue sa saison en fond, `check_places` en borne les victoires ;
 *   3. sur une saison (41 soirs à domicile ou à l'étranger), le net en victoires reste sous la borne de sa rareté
 *      (commune 1 V, rare 2,5 V — CLAUDE.md, check_cartes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, playGame } from '../js/sim.js';
import { BANQUE, payloadDe } from '../js/banque.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}

// Douze graines (S111) : six ne suffisaient plus quand l'adversaire se blesse comme dans la vraie LNH — une saison appariée
// diverge au moindre écart, et 🛤️ lisait +0,08 sur les six premières, +0,20 sur les six suivantes. À trois (oct.), déjà,
// le net d'une carte d'un moment se lisait au hasard des dés (🏯 plus fort avec une défense plus faible).
const SEEDS = (process.env.SEEDS || '1000,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011').split(',').map(Number);
const BORNE = { commune: 1, peu: 1.5, rare: 2.5, legendaire: 4 };

/*
 * EN PAIRES, comme check_impact : la même ligue deux fois sous la même graine, l'adjoint engagé au jour 0 chez la
 * moitié des clubs (`par`), chacun lu contre les clubs non traités, à domicile et à l'étranger. Puis, sur le même fil de dés, des matchs de séries entre traités et non traités.
 */
function saison(seed, par, cle) {
  const teams = ligue(seed, 32);
  const traites = cle ? teams.map((_, i) => i).filter(i => i % 2 === par) : [];
  const decisions = traites.map(e => ({ jour: 0, equipe: e, ...payloadDe(`patron:${cle}`) }));
  simulateLeague(teams, 82, { graine: `si${seed}`, decisions });
  const lu = teams.map(() => ({ dom: { gf: 0, ga: 0, v: 0, n: 0 }, ext: { gf: 0, ga: 0, v: 0, n: 0 } }));
  teams.forEach((t, i) => {
    if (i % 2 !== par) return;
    for (const j of t.journal) {
      if (teams.indexOf(j.adv) % 2 === par) continue;
      const o = j.feuille.A === t ? lu[i].dom : lu[i].ext;
      o.gf += j.gf; o.ga += j.ga; o.v += j.win ? 1 : 0; o.n++;
    }
  });
  // Les séries, sur le même fil : chaque club traité contre son voisin non traité, à domicile puis à l'étranger.
  const series = { gf: 0, ga: 0, v: 0, n: 0 };
  for (let i = par; i + 1 < 32; i += 2) {
    const T = teams[i], O = teams[i + 1 - 2 * par] || teams[i + 1];
    for (let g = 0; g < SERIES; g++) {
      const a = playGame(T, O, g, false, true), b = playGame(O, T, g, false, true);
      series.gf += a.gfA + b.gfB; series.ga += a.gfB + b.gfA; series.v += (a.gfA > a.gfB) + (b.gfB > b.gfA); series.n += 2;
    }
  }
  return { lu: lu.filter((_, i) => i % 2 === par), series, fiche: teams.map(t => `${t.W}-${t.L}-${t.OTL}-${t.GF}`).join(' ') };
}
const SERIES = Number(process.env.SERIES || 10);
function mesurer(cle) {
  const d = { dom: { gf: 0, ga: 0, v: 0 }, ext: { gf: 0, ga: 0, v: 0 }, series: { gf: 0, ga: 0, v: 0 }, saisonIdentique: true };
  let k = 0;
  for (const seed of SEEDS) for (const par of [0, 1]) {
    const a = saison(seed, par, cle), s = saison(seed, par, null);
    if (a.fiche !== s.fiche) d.saisonIdentique = false;
    a.lu.forEach((x, i) => {
      const y = s.lu[i];
      for (const o of ['dom', 'ext']) for (const c of ['gf', 'ga', 'v']) d[o][c] += x[o][c] / x[o].n - y[o][c] / y[o].n;
      k++;
    });
    for (const c of ['gf', 'ga', 'v']) d.series[c] += (a.series[c] - s.series[c]) / a.series.n * a.lu.length;
  }
  for (const o of ['dom', 'ext', 'series']) for (const c of ['gf', 'ga', 'v']) d[o][c] /= k;
  return d;
}
const f = x => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2).replace('.', ',')}`;
const lire = d => `à domicile : buts ${f(d.dom.gf)} / ${f(d.dom.ga)}, victoires ${f(d.dom.v)} par match · à l'étranger : buts ${f(d.ext.gf)} / ${f(d.ext.ga)}, victoires ${f(d.ext.v)}`;

console.log('\n  FORTE, MAIS DANS SON MOMENT\n');

const victoires = d => (d.dom.v + d.ext.v) * 41;
const nom = cle => { const c = BANQUE[`patron:${cle}`]; return `${c.ico} ${c.nom}`; };
const seVoit = o => Math.abs(o.gf) + Math.abs(o.ga);
// L'ancien capitaine (il reprend le gardien du château) : à domicile, il se voit.
{
  const cle = 'per_ancienCapitaine', d = mesurer(cle), rar = BANQUE[`patron:${cle}`].rarete;
  informer(nom(cle), lire(d));
  borne('à domicile, il change le pointage (buts pour et contre, par match)', seVoit(d.dom), 0.1, 1);
  borne(`sur une saison, le net en victoires reste sous la borne d'une ${rar}`, Math.abs(victoires(d)), 0, BORNE[rar]);
}
// L'entraîneur des gardiens de route (il reprend le joueur de route) : à l'étranger, il se voit.
{
  const cle = 'per_gardiensDeRoute', d = mesurer(cle), rar = BANQUE[`patron:${cle}`].rarete;
  informer(nom(cle), lire(d));
  borne('à l\'étranger, il change le pointage (buts pour et contre, par match)', seVoit(d.ext), 0.1, 1);
  borne(`sur une saison, le net en victoires reste sous la borne d'une ${rar}`, Math.abs(victoires(d)), 0, BORNE[rar]);
}
// Le directeur de l'usine (il reprend l'homme des séries) : en saison, son fond seulement ; en séries, il se voit.
{
  const cle = 'per_directeurUsine', d = mesurer(cle), rar = BANQUE[`patron:${cle}`].rarete;
  informer(`${nom(cle)}, en séries`, `buts ${f(d.series.gf)} / ${f(d.series.ga)}, victoires ${f(d.series.v)} par match`);
  informer('en saison, l\'adjoint des séries ne joue que son fond', d.saisonIdentique ? 'les 32 fiches identiques' : 'le fond a bougé des fiches (V19)');
  borne('en séries, il change le pointage (buts pour et contre, par match)', seVoit(d.series), 0.1, 1);
  borne(`sur vingt matchs de séries, le net en victoires reste sous la borne d'une ${rar}`, Math.abs(d.series.v * 20), 0, BORNE[rar]);
}
verdict();
