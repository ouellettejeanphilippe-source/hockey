/*
 * LE PRONOSTIC NE TOUCHE À RIEN (S78, js/pronostic.js).
 *
 * Le pronostic d'avant-match et les chances des objectifs du proprio
 * rejouent des matchs avec le vrai moteur, au milieu d'une saison déjà jouée
 * dont les séries continuent la suite du hasard. Ce script exige :
 *
 *   1. que les séries jouées APRÈS un pronostic soient identiques à celles
 *      jouées sans (le générateur de la saison n'a pas bougé) ;
 *   2. que chaque joueur et chaque club retrouvent leurs champs à l'identique ;
 *   3. que le pronostic soit reproductible (même match, mêmes chiffres) ;
 *   4. que ses chiffres tiennent debout (un club fort gagne plus souvent) ;
 *   5. qu'il se calcule assez vite pour un écran (le temps est affiché).
 *
 *   node scripts/check_pronostic.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, playSeries, generateur } from '../js/sim.js';
import { pronostic, conditions, chancesDesObjectifs } from '../js/pronostic.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const saisons = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();

const choix = generateur('check_pronostic');
const vestiaires = [];
const vus = new Set();
while (vestiaires.length < 32) {
  const f = saisons[Math.floor(choix() * saisons.length)];
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const tags = [...new Set(shard.players.map(p => p.t))];
  const tag = tags[Math.floor(choix() * tags.length)];
  const cle = `${shard.season}|${tag}`;
  if (vus.has(cle)) continue;
  let unites;
  try { unites = equipeReelle(shard.season, tag); } catch { continue; }
  if (unites[0].length < 12 || unites[1].length < 6 || !unites[2].length) continue;
  vus.add(cle);
  vestiaires.push({ tag, season: shard.season, pool: unites.flat() });
}

function ligue() {
  const equipes = vestiaires.map((v, i) => {
    const pool = v.pool.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    return createTeam(`${v.tag} ${v.season}`, v.tag, autoRoster(pool), { season: v.season, isPlayer: i === 0 });
  });
  const L = simulateLeague(equipes, 82, { graine: 'pronostic-graine' });
  return { equipes, ...L };
}
const empreinte = equipes => JSON.stringify(equipes.map(t => ({
  fiche: [t.W, t.L, t.OTL, t.GF, t.GA, t.games, t.injured.size, t.injuriesLog.length, (t.trous || []).length, t.luck],
  joueurs: SLOTS.map(s => t.roster[s.i]).filter(Boolean).map(p => Object.keys(p).sort().map(k => `${k}:${JSON.stringify(p[k])}`).join(',')),
})));

let echecs = 0;
const ok = (cond, quoi, detail = '') => { console.log(`  ${cond ? '✓' : '✗'} ${quoi.padEnd(78)} ${detail}`); if (!cond) echecs++; };

// 1. Les séries après un pronostic = les séries sans pronostic.
const L1 = ligue();
const s1 = playSeries(L1.standings[0], L1.standings[1], true);
const L2 = ligue();
const toi = L2.equipes[0];
const jour = 30;
const m = L2.calendrier.slice(jour).flat().find(x => x.A === toi || x.B === toi);
const jm = L2.calendrier.findIndex(j => j.includes(m));
const avant = empreinte(L2.equipes);
let t0 = performance.now();
const pr = pronostic({ A: m.A, B: m.B, calendrier: L2.calendrier, jourMatch: jm, jourRevele: jour });
const tPr = performance.now() - t0;
t0 = performance.now();
const ch = chancesDesObjectifs({ you: toi, calendrier: L2.calendrier, jourRevele: jour, cles: ['victoires', 'attaque', 'brigade', 'blanchissages', 'vedette', 'sequence', 'regulier'] });
const tOb = performance.now() - t0;
const apres = empreinte(L2.equipes);
const s2 = playSeries(L2.standings[0], L2.standings[1], true);
ok(JSON.stringify(s1.feuilles.map(f => [f.buts.length, f.arrets])) === JSON.stringify(s2.feuilles.map(f => [f.buts.length, f.arrets])) && s1.wA === s2.wA && s1.wB === s2.wB,
  'les séries jouées après le pronostic sont identiques', `${s1.wA}-${s1.wB} puis ${s2.wA}-${s2.wB}`);
ok(avant === apres, 'chaque joueur et chaque club retrouvent leurs champs', avant === apres ? 'identiques' : 'DIFFÉRENTS');

// 3. Reproductible.
const pr2 = pronostic({ A: m.A, B: m.B, calendrier: L2.calendrier, jourMatch: jm, jourRevele: jour });
ok(pr.vA === pr2.vA && pr.prol === pr2.prol, 'le même match redonne le même pronostic', `${pr.vA}/${pr.n} puis ${pr2.vA}/${pr2.n}`);

// 4. Ça tient debout : le premier du classement contre le dernier.
const fort = L2.standings[0], faible = L2.standings[L2.standings.length - 1];
const jf = L2.calendrier.findIndex((j, i) => i >= 10 && j.some(x => (x.A === fort && x.B === faible) || (x.B === fort && x.A === faible)));
if (jf >= 0) {
  const mf = L2.calendrier[jf].find(x => (x.A === fort && x.B === faible) || (x.B === fort && x.A === faible));
  const pf = pronostic({ A: mf.A, B: mf.B, calendrier: L2.calendrier, jourMatch: jf, jourRevele: jf });
  const pctFort = (mf.A === fort ? pf.vA : pf.vB) / pf.n;
  ok(pctFort > 0.5, 'le premier du classement gagne plus souvent contre le dernier', `${(100 * pctFort).toFixed(0)} %`);
} else console.log('  · (le premier et le dernier ne se croisent pas après la journée 10)');
const cA = conditions(pr, 'A');
ok(pr.butsA > 1 && pr.butsA < 6 && pr.butsB > 1 && pr.butsB < 6, 'des buts attendus plausibles', `${pr.butsA.toFixed(2)} – ${pr.butsB.toFixed(2)}`);
ok(pr.prol / pr.n > 0.08 && pr.prol / pr.n < 0.35, 'une part de prolongations plausible', `${(100 * pr.prol / pr.n).toFixed(0)} %`);
console.log(`  · conditions de A : gagne ${JSON.stringify(cA.gagne)} · perd ${JSON.stringify(cA.perd)}`);
console.log(`  · chances des objectifs : ${Object.entries(ch).map(([k, x]) => `${k} ${(100 * x).toFixed(0)} %`).join(' · ')}`);
ok(tPr < 2500, 'le pronostic d\'un match se calcule vite', `${tPr.toFixed(0)} ms (${pr.n} matchs)`);
ok(tOb < 6000, 'les chances des objectifs se calculent vite', `${tOb.toFixed(0)} ms`);

console.log(echecs ? `\n  ${echecs} échec(s).` : '\n  Le pronostic ne touche à rien.');
process.exit(echecs ? 1 : 0);
