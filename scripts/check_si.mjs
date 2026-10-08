/*
 * FORTE, MAIS DANS SON MOMENT (V3.4). JP : *un joueur est plus robuste à
 * domicile* ; *ce genre de trucs complexes, mais pas trop*. Une modif d'un
 * moment (`si` : domicile, visiteur, series) ne joue que ses soirs, et ses
 * soirs-là elle se VOIT. Mesuré en paires, match par match : le même club
 * joue les mêmes matchs, sous les mêmes dés, avec puis sans la carte.
 *   1. ses soirs, l'effet se voit dans la feuille (au moins un dixième de but
 *      par match, dans le sens promis) ;
 *   2. hors de ses soirs, rien : l'homme des séries ne change pas un seul
 *      but de la saison ;
 *   3. sur une saison (41 soirs à domicile ou à l'étranger), le net en
 *      victoires reste sous la borne de sa rareté (peu commune 1,5 V, rare
 *      2,5 V — CLAUDE.md, check_cartes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, playGame, joueurDeMutation, getPlayerKey } from '../js/sim.js';
import { BANQUE } from '../js/banque.js';
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

const SEEDS = (process.env.SEEDS || '1000,1001,1002').split(',').map(Number);
const BORNE = { commune: 1, peu: 1.5, rare: 2.5, legendaire: 4 };

/*
 * EN PAIRES, comme check_impact : la même ligue deux fois sous la même graine, la carte posée au jour 0 sur le
 * joueur qu'elle vise chez la moitié des clubs (`par`), chacun lu contre les clubs non traités, à domicile et à
 * l'étranger. Puis, sur le même fil de dés, des matchs de séries entre traités et non traités.
 */
function saison(seed, par, cle) {
  const teams = ligue(seed, 32);
  const traites = cle ? teams.map((_, i) => i).filter(i => i % 2 === par) : [];
  const decisions = traites.map(e => ({ jour: 0, equipe: e, deck: 'atelier', mutation: { cle, joueur: getPlayerKey(joueurDeMutation(teams[e], null, cle)) } }));
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
// Le gardien du château : à domicile, il défend ; à l'étranger, rien.
{
  const d = mesurer('domicile'), rar = BANQUE['joueur:domicile'].rarete;
  informer('🏯 Le gardien du château', lire(d));
  borne('à domicile, il fait accorder moins de buts (par match)', -d.dom.ga, 0.1, 1);
  borne(`sur une saison, le net en victoires reste sous la borne d'une ${rar}`, Math.abs(victoires(d)), 0, BORNE[rar]);
}
// Le joueur de route : à l'étranger, il marque ; à domicile, rien.
{
  const d = mesurer('route'), rar = BANQUE['joueur:route'].rarete;
  informer('🛤️ Le joueur de route', lire(d));
  borne('à l\'étranger, il fait marquer plus (buts par match)', d.ext.gf, 0.1, 1);
  borne(`sur une saison, le net en victoires reste sous la borne d'une ${rar}`, Math.abs(victoires(d)), 0, BORNE[rar]);
}
// L'homme des séries : en saison, pas un but ne change ; en séries, il se voit.
{
  const d = mesurer('printemps'), rar = BANQUE['joueur:printemps'].rarete;
  informer('🌋 L\'homme des séries, en séries', `buts ${f(d.series.gf)} / ${f(d.series.ga)}, victoires ${f(d.series.v)} par match`);
  exiger('en saison, l\'homme des séries ne change pas un seul but de la ligue', d.saisonIdentique, d.saisonIdentique ? 'les 32 fiches identiques' : 'une fiche a bougé');
  borne('en séries, il fait marquer plus (buts par match)', d.series.gf, 0.1, 1);
  borne(`sur vingt matchs de séries, le net en victoires reste sous la borne d'une ${rar}`, Math.abs(d.series.v * 20), 0, BORNE[rar]);
}
verdict();
