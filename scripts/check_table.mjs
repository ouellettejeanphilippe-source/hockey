/*
 * LE MATCH SUR TABLE — est-ce que ça donne du hockey ?
 *
 * Le mode bonus « Sur table » (js/table.js) est un jeu de plateau, pas le
 * moteur par événements : il ne cherche pas à reproduire une saison, il
 * cherche à être JOUABLE. Mais un match de hockey qui finit 11-9 ou 0-0 n'est
 * pas du hockey, et une partie qui dure quarante gestes n'est pas rapide.
 * Ce script mesure les quatre choses dont le réglage dépend :
 *
 *   les buts par équipe par match   cible ~3, comme le vrai (et comme le
 *                                   moteur par événements : 3,1)
 *   les gestes par présence         cible 2 à 4 : c'est ce qui fait la
 *                                   vitesse. Blood Bowl joue vite parce que
 *                                   le revirement coupe le tour tôt.
 *   la part de nulles après 3 périodes  la prolongation doit rester l'exception
 *   l'écart fort/faible             une meilleure équipe doit gagner plus
 *                                   souvent : c'est la monotonie, en petit
 *
 *   node scripts/check_table.mjs
 *   MATCHS=400 node scripts/check_table.mjs
 *
 * RÉGLAGE ACTUEL (240 matchs) : 2,88 but par équipe par match, 26,7 % de
 * prolongations, 3,81 gestes par présence, et les pointages les plus
 * fréquents sont 2-1, 3-2, 4-3, 5-4, 1-0 — du hockey. La parité va de 93
 * victoires sur 100 pour le premier décile contre le dixième à 51 sur 100
 * entre deux équipes du même décile. Trois réglages y sont arrivés, chacun
 * mesuré ici : `md` (deux crans de talent pour un point de dé), le 6 qui
 * réussit toujours, et la sortie de zone du gardien.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, getHiddenRatings, SLOTS } from '../js/sim.js';
import { equipeDeTable, jouerMatchAuto, nouveauMatch, iaPresence, resultatDe,
         statsDeTable, PERIODES, PRESENCES_PAR_PERIODE } from '../js/table.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const MATCHS = Number(process.env.MATCHS ?? 240);

/* ---------- de vraies équipes, alignées comme le jeu les aligne ---------- */
const clubs = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);
  for (const [t, ps] of Object.entries(parEquipe)) {
    if (ps.length < 20) continue;
    const pool = ps.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    if (Object.keys(roster).length < 20) continue;
    const vals = Object.values(roster).map(p => getHiddenRatings(p).v);
    clubs.push({ nom: `${t} ${shard.season}`, tag: t, roster, force: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
}
clubs.sort((a, b) => b.force - a.force);
console.log(`${clubs.length} vraies équipes alignées.\n`);

/* ---------- la distribution des quatre nombres ---------- */
const axes = { PA: [], MA: [], TI: [], FO: [], AR: [] };
for (const c of clubs) for (const p of Object.values(c.roster)) {
  const st = statsDeTable(p);
  if (p.p === 'G') axes.AR.push(st.AR);
  else { axes.PA.push(st.PA); axes.MA.push(st.MA); axes.TI.push(st.TI); axes.FO.push(st.FO); }
}
const moy = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
console.log('Les quatre nombres (1 à 6), sur tous les joueurs alignés :');
for (const [k, a] of Object.entries(axes)) {
  const h = [1, 2, 3, 4, 5, 6].map(n => a.filter(x => x === n).length);
  console.log(`  ${k}  moyenne ${moy(a).toFixed(2)}   répartition ${h.map((n, i) => `${i + 1}:${(100 * n / a.length).toFixed(0)}%`).join(' ')}`);
}

/* ---------- les matchs ---------- */
const tire = (n) => clubs[Math.floor(Math.random() * n)];
let buts = 0, tirs = 0, nuls3 = 0, prolongations = 0, n = 0, garde = 0;
const pointages = new Map();

for (let i = 0; i < MATCHS; i++) {
  const a = clubs[Math.floor(Math.random() * clubs.length)];
  const b = clubs[Math.floor(Math.random() * clubs.length)];
  const A = equipeDeTable(a.nom, a.tag, a.roster, 'A');
  const B = equipeDeTable(b.nom, b.tag, b.roster, 'B');
  const m = nouveauMatch(A, B, `t${i}`);
  let presences = 0;
  while (!m.fini && presences++ < 200) { if (m.periode === PERIODES + 1 && !m.prolongation) break; iaPresence(m); }
  const r = resultatDe(m);
  if (m.prolongation) prolongations++;
  buts += r.gfA + r.gfB; tirs += r.A.tirs + r.B.tirs; n += 2;
  const cle = `${Math.max(r.gfA, r.gfB)}-${Math.min(r.gfA, r.gfB)}`;
  pointages.set(cle, (pointages.get(cle) || 0) + 1);
}
console.log(`\n${MATCHS} matchs :`);
console.log(`  buts par équipe par match   ${(buts / n).toFixed(2)}   (le moteur par événements : 3,1)`);
console.log(`  tirs par équipe par match   ${(tirs / n).toFixed(2)}`);
console.log(`  prolongation                ${(100 * prolongations / MATCHS).toFixed(1)} %   (la vraie ligue : ~23 %)`);
const top = [...pointages.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
console.log(`  pointages les plus fréquents  ${top.map(([k, v]) => `${k} (${(100 * v / MATCHS).toFixed(0)}%)`).join(', ')}`);

/* ---------- les gestes par présence : la vitesse du jeu ---------- */
{
  let gestes = 0, presences = 0;
  for (let i = 0; i < 40; i++) {
    const a = clubs[Math.floor(Math.random() * clubs.length)];
    const b = clubs[Math.floor(Math.random() * clubs.length)];
    const m = nouveauMatch(equipeDeTable(a.nom, a.tag, a.roster, 'A'), equipeDeTable(b.nom, b.tag, b.roster, 'B'), `g${i}`);
    let garde2 = 0;
    while (!m.fini && garde2++ < 200) { gestes += iaPresence(m).length; presences++; }
  }
  console.log(`  gestes par présence         ${(gestes / presences).toFixed(2)}   (cible : 2 à 4)`);
}

/* ---------- la monotonie, en petit : le fort bat-il le faible ? ---------- */
const decile = i => clubs[Math.floor(i * (clubs.length - 1) / 9)];
console.log('\nLe fort contre le faible (100 matchs par paire, chacun chez soi une fois sur deux) :');
for (const [ia, ib, mot] of [[0, 9, 'le 1er décile contre le 10e'], [0, 4, 'le 1er contre le 5e'], [4, 9, 'le 5e contre le 10e'], [2, 2, 'deux équipes du 3e décile']]) {
  const a = decile(ia), b = decile(ib);
  let v = 0, bu = 0;
  for (let i = 0; i < 100; i++) {
    const inverse = i % 2 === 1;
    const A = equipeDeTable(a.nom, a.tag, a.roster, inverse ? 'B' : 'A');
    const B = equipeDeTable(b.nom, b.tag, b.roster, inverse ? 'A' : 'B');
    const r = jouerMatchAuto(inverse ? B : A, inverse ? A : B, `m${ia}${ib}${i}`);
    const butsA = inverse ? r.gfB : r.gfA, butsB = inverse ? r.gfA : r.gfB;
    if (butsA > butsB) v++;
    bu += butsA - butsB;
  }
  console.log(`  ${mot.padEnd(32)} ${String(v).padStart(3)} victoires sur 100, différentiel ${(bu / 100).toFixed(2)} par match`);
}
