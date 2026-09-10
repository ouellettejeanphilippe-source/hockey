/*
 * Le +/- va-t-il à ceux qui étaient sur la glace ?
 *
 * JP, devant une table d'équipe : *this distribution doesn't make any sense,
 * I feel the +/- is not really linked to who is on ice when the goals are
 * scored* — un quatrième trio entier à −28, −28, −26 sur une équipe de 50
 * victoires, une première paire à +32 et +32, des coéquipiers de trio au
 * même chiffre au but près.
 *
 * Ce script aligne de vraies équipes (`autoRoster`) en ligues de 32, les fait
 * jouer, et compare, PAR RANG D'UNITÉ (1er trio…
 * 4e trio, 1re paire… 3e paire), le +/- simulé au vrai +/- des mêmes
 * joueurs dans leur vraie saison. Puis deux choses que le vrai hockey
 * fait et que le moteur peut ne pas faire :
 *
 *   l'ÉCART DU HAUT AU BAS   moyenne du 1er trio moins moyenne du 4e ; si le
 *                            moteur double le réel, le bas de l'alignement
 *                            paie trop et le haut encaisse trop
 *   les JUMEAUX              l'écart absolu moyen entre deux coéquipiers de
 *                            la même unité : dans la vraie ligue les
 *                            changements à la volée et les blessures les
 *                            séparent de plusieurs buts ; s'ils sont à zéro,
 *                            le moteur crédite toujours les cinq de la case
 *
 *   node scripts/check_pm.mjs
 *   LIGUES=4 node scripts/check_pm.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, createTeam, simulateLeague, autoRoster, registerHiddenRatings, generateur } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const LIGUES = Number(process.env.LIGUES ?? 2);
const moy = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const saisons = fs.readdirSync(DIR).filter(x => x.endsWith('.json')).map(x => x.replace('.json', '')).sort();

const alea = generateur('check_pm');
const parts = { sim: [], reel: [] };   // [max/diff, min/diff] des équipes à +60 et plus
const partDe = (pm, diff) => (diff >= 60 && pm.length ? [Math.max(...pm) / diff, Math.min(...pm) / diff] : null);
const rangs = {};   // 'F1'.. 'D3' -> { sim: [], reel: [] }
const jumeaux = { sim: [], reel: [] };
let corr = [];      // [sim, reel] par joueur
let n = 0;
const vus = new Set();
// EN LIGUE, pas en solo : l'adversaire neutre du solo n'a pas de joueurs,
// donc personne n'y reçoit de −1. Le +/- ne se mesure que dans le jeu réel.
for (let l = 0; l < LIGUES; l++) {
  const equipes = [];
  while (equipes.length < 32) {
    const s = saisons[Math.floor(alea() * saisons.length)];
    const shard = JSON.parse(fs.readFileSync(path.join(DIR, s + '.json'), 'utf8'));
    const tags = [...new Set(shard.players.map(p => p.t))];
    const tag = tags[Math.floor(alea() * tags.length)];
    if (vus.has(s + tag)) continue;
    let u;
    try { u = equipeReelle(s, tag); } catch { continue; }
    if (u[0].length < 12 || u[1].length < 6 || !u[2].length) continue;
    vus.add(s + tag);
    const pool = u.flat().map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    equipes.push(createTeam(`${tag} ${s}`, tag, autoRoster(pool), { season: s }));
  }
  simulateLeague(equipes, 82, { graine: `check_pm-${l}` });
  n += equipes.length;
  for (const t of equipes) { const r = partDe(Object.values(t.roster).filter(p => p && p.p !== 'G' && (p.simGP || 0) >= 40).map(p => p.simPM), t.GF - t.GA); if (r) parts.sim.push(r); }
  for (const t of equipes) {
    const roster = t.roster;
    for (const sl of SLOTS) {
      const p = roster[sl.i];
      if (!p || p.p === 'G' || sl.scratch || (p.gp || 0) < 40 || (p.simGP || 0) < 40) continue;
      const cle = `${sl.group}${sl.unit + 1}`;
      (rangs[cle] = rangs[cle] || { sim: [], reel: [] });
      // Le vrai +/- ramené à 82 matchs, pour comparer à une saison simulée entière.
      rangs[cle].sim.push(p.simPM);
      rangs[cle].reel.push(p.pm * 82 / p.gp);
      corr.push([p.simPM, p.pm * 82 / p.gp]);
    }
    // Les jumeaux : chaque paire de coéquipiers d'une même unité.
    for (const g of ['F', 'D']) for (let unit = 0; unit < (g === 'F' ? 4 : 3); unit++) {
      const ps = SLOTS.filter(x => x.group === g && x.unit === unit && !x.scratch).map(x => roster[x.i]).filter(p => p && (p.gp || 0) >= 40 && (p.simGP || 0) >= 40);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        jumeaux.sim.push(Math.abs(ps[i].simPM - ps[j].simPM));
        jumeaux.reel.push(Math.abs(ps[i].pm * 82 / ps[i].gp - ps[j].pm * 82 / ps[j].gp));
      }
    }
  }
}

console.log(`\n${n} vraies équipes alignées en ${LIGUES} ligue(s), joueurs à 40 matchs et plus\n`);
console.log('  unité    +/- simulé   +/- réel (par 82)   joueurs');
for (const cle of ['F1', 'F2', 'F3', 'F4', 'D1', 'D2', 'D3']) {
  const r = rangs[cle]; if (!r) continue;
  console.log(`  ${cle.padEnd(6)}  ${moy(r.sim).toFixed(1).padStart(8)}   ${moy(r.reel).toFixed(1).padStart(10)}          ${r.sim.length}`);
}
const ecart = (k) => moy(rangs.F1[k]) - moy(rangs.F4[k]);
console.log(`\n  écart du 1er au 4e trio : simulé ${ecart('sim').toFixed(1)}, réel ${ecart('reel').toFixed(1)}`);
console.log(`  jumeaux (écart absolu entre coéquipiers d'unité) : simulé ${moy(jumeaux.sim).toFixed(1)}, réel ${moy(jumeaux.reel).toFixed(1)}`);
const mx = moy(corr.map(c => c[0])), my = moy(corr.map(c => c[1]));
const cov = moy(corr.map(c => (c[0] - mx) * (c[1] - my)));
const sx = Math.sqrt(moy(corr.map(c => (c[0] - mx) ** 2))), sy = Math.sqrt(moy(corr.map(c => (c[1] - my) ** 2)));
console.log(`  corrélation joueur par joueur, simulé / réel : ${(cov / (sx * sy)).toFixed(2)} ; écart-type simulé ${sx.toFixed(1)}, réel ${sy.toFixed(1)}\n`);

/*
 * LES GRANDES ÉQUIPES. JP : *les +/- des joueurs sont toujours démesurés* —
 * sur SON équipe, à +150, une vedette à +80. La vraie ligue a connu ça
 * (Robinson +120 sur le Canadien de 1976-77 à +216, Orr +124 en 1970-71),
 * mais la question est de savoir si le moteur fait pareil ou pire : on prend
 * les douze vraies équipes au plus grand différentiel des 55 saisons, on les
 * fait jouer en ligue, et on compare, équipe par équipe, le différentiel, le
 * meilleur +/- et le pire +/- de leurs réguliers, simulés contre réels.
 */
const grandes = [];
for (const s of saisons) {
  const shard = JSON.parse(fs.readFileSync(path.join(DIR, s + '.json'), 'utf8'));
  const eq = {};
  for (const p of shard.players) {
    const e = eq[p.t] || (eq[p.t] = { gf: 0, ga: 0, max: -999, min: 999 });
    // Le gardien du shard porte ses tirs reçus (`sa`) et son pourcentage d'arrêts (`sv`) : les buts alloués en découlent.
    if (p.p === 'G') e.ga += Math.round((p.sa || 0) * (1 - (p.sv || 0)));
    else { e.gf += p.g || 0; if ((p.gp || 0) >= 40) { e.max = Math.max(e.max, p.pm || 0); e.min = Math.min(e.min, p.pm || 0); } }
  }
  for (const [tag, e] of Object.entries(eq)) grandes.push({ s, tag, diff: e.gf - e.ga, max: e.max, min: e.min });
  for (const e of Object.values(eq)) { const r = partDe([e.max, e.min], e.gf - e.ga); if (r) parts.reel.push(r); }
}
grandes.sort((a, b) => b.diff - a.diff);
const douze = grandes.slice(0, 12);
{
  const equipes = [], vus = new Set();
  const ajouter = (s, tag) => { const u = equipeReelle(s, tag); if (u[0].length < 12 || u[1].length < 6 || !u[2].length) return false; const pool = u.flat().map(p => ({ ...p })); pool.forEach(registerHiddenRatings); equipes.push(createTeam(`${tag} ${s}`, tag, autoRoster(pool), { season: s })); vus.add(s + tag); return true; };
  for (const g of douze) { try { ajouter(g.s, g.tag); } catch { /* vestiaire incomplet */ } }
  while (equipes.length < 32) {
    const s = saisons[Math.floor(alea() * saisons.length)];
    const shard = JSON.parse(fs.readFileSync(path.join(DIR, s + '.json'), 'utf8'));
    const tags = [...new Set(shard.players.map(p => p.t))];
    const tag = tags[Math.floor(alea() * tags.length)];
    if (vus.has(s + tag)) continue;
    try { ajouter(s, tag); } catch { /* vestiaire incomplet */ }
  }
  simulateLeague(equipes, 82, { graine: 'check_pm-grandes' });
  for (const t of equipes) { const r = partDe(Object.values(t.roster).filter(p => p && p.p !== 'G' && (p.simGP || 0) >= 40).map(p => p.simPM), t.GF - t.GA); if (r) parts.sim.push(r); }
  console.log('  LES GRANDES ÉQUIPES : différentiel, meilleur et pire +/- des réguliers (40 matchs et plus), simulé / réel\n');
  console.log('  équipe            diff sim / réel    max sim / réel    min sim / réel   max / diff sim · réel');
  const ratios = { sim: [], reel: [] };
  for (const g of douze) {
    const t = equipes.find(x => x.tag === g.tag && x.season === g.s);
    if (!t) continue;
    const pm = Object.values(t.roster).filter(p => p && p.p !== 'G' && (p.simGP || 0) >= 40).map(p => p.simPM);
    const diff = t.GF - t.GA, mx = Math.max(...pm), mn = Math.min(...pm);
    // La part n'a de sens que sur une équipe dominante aussi dans la ligue simulée.
    if (diff >= 60) { ratios.sim.push(mx / diff); ratios.reel.push(g.max / g.diff); }
    // Le meilleur : sa part des buts pour et contre sur la glace, hors avantage.
    const pats = Object.values(t.roster).filter(p => p && p.p !== 'G' && (p.simGP || 0) >= 40);
    const top = pats.reduce((a, b) => (b.simPM > a.simPM ? b : a));
    const gfOn = pats.reduce((a, p) => a + (p.simPlus || 0), 0) / 5, gaOn = pats.reduce((a, p) => a + (p.simMoins || 0), 0) / 5;
    console.log(`     ${top.n.padEnd(22)} sur la glace pour ${((top.simPlus || 0) / Math.max(1, gfOn) * 100).toFixed(0)} % des buts pour et ${((top.simMoins || 0) / Math.max(1, gaOn) * 100).toFixed(0)} % des buts contre (à forces égales)`);
    console.log(`  ${(g.tag + ' ' + g.s).padEnd(16)}  ${String(diff).padStart(5)} / ${String(g.diff).padStart(5)}      ${String(mx).padStart(4)} / ${String(g.max).padStart(4)}      ${String(mn).padStart(4)} / ${String(g.min).padStart(4)}      ${(mx / Math.max(1, diff)).toFixed(2)} · ${(g.max / Math.max(1, g.diff)).toFixed(2)}`);
  }
  console.log(`\n  sur ces douze : meilleur +/- en part du différentiel (équipes simulées à +60 et plus, ${ratios.sim.length}) : simulé ${moy(ratios.sim).toFixed(2)}, réel ${moy(ratios.reel).toFixed(2)}`);
  // LA PART DU MEILLEUR ET DU PIRE, sur toutes les équipes dominantes : c'est
  // le chiffre qui dit si une vedette à +80 sur une équipe à +150 est le
  // moteur ou le hockey (le réel dit environ 0,4 : Robinson +120 sur +216).
  console.log(`  toutes les équipes à +60 et plus — meilleur +/- en part du différentiel : simulé ${moy(parts.sim.map(x => x[0])).toFixed(2)} (${parts.sim.length} équipes), réel ${moy(parts.reel.map(x => x[0])).toFixed(2)} (${parts.reel.length} équipes)`);
  console.log(`                                         pire +/- en part du différentiel : simulé ${moy(parts.sim.map(x => x[1])).toFixed(2)}, réel ${moy(parts.reel.map(x => x[1])).toFixed(2)}\n`);
}
