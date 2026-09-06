/*
 * La chimie de trio dit-elle ce que le hockey dit ?
 *
 * Depuis qu'elle se calcule sur les vraies statistiques et non sur
 * l'archétype, elle n'est plus une table de cas mais deux nombres : l'ÉCART
 * entre le plus tireur et le plus passeur du trio, et l'EXCÈS, c'est-à-dire à
 * quel point tout le trio penche du même bord.
 *
 * Ce script vérifie que ça tombe sur les bonnes réponses, avec de VRAIS
 * joueurs plutôt que des profils inventés : deux francs-tireurs et un
 * fabricant doivent bien noter, trois francs-tireurs mal, trois fabricants
 * mal aussi. Il sort ensuite la distribution sur les 1395 vraies équipes,
 * pour qu'on voie où la ligue atterrit.
 *
 *   node scripts/check_chimie.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, getUnitSynergy, registerHiddenRatings, autoRoster } from '../js/sim.js';
import { seasonLancers } from '../js/ratings.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* Tous les attaquants réguliers, avec leur penchant mesuré. */
const attaquants = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  for (const p of JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8')).players) {
    if (p.p !== 'F' || (p.pt || 0) < 40 || (p.gp || 0) < 60) continue;
    const ligue = seasonLancers(p.s)[6] || 0.40;
    attaquants.push({ p, pen: (p.g || 0) / p.pt - ligue });
  }
}
attaquants.sort((a, b) => b.pen - a.pen);
const tireurs = attaquants.slice(0, 40);
const passeurs = attaquants.slice(-40);
const neutres = attaquants.slice(Math.floor(attaquants.length / 2) - 20, Math.floor(attaquants.length / 2) + 20);

/** Note un trio composé des joueurs donnés, placé au premier trio. */
function noter(trois) {
  const roster = {};
  const slots = SLOTS.filter(s => s.group === 'F' && s.unit === 0 && !s.scratch);
  const copies = trois.map((x, i) => ({ ...x.p, np: ['L', 'C', 'R'][i] }));
  copies.forEach(registerHiddenRatings);
  slots.forEach((s, i) => { roster[s.i] = copies[i]; });
  const syn = getUnitSynergy(roster, 'F', 0);
  return { off: syn.bonusOff, nom: syn.chem, joueurs: copies.map(c => c.n) };
}

const tirer = (liste) => liste[Math.floor(Math.random() * liste.length)];
const CAS = [
  ['2 francs-tireurs + 1 fabricant', () => [tirer(tireurs), tirer(tireurs), tirer(passeurs)]],
  ['1 franc-tireur + 2 fabricants', () => [tirer(tireurs), tirer(passeurs), tirer(passeurs)]],
  ['1 de chaque', () => [tirer(tireurs), tirer(neutres), tirer(passeurs)]],
  ['3 francs-tireurs', () => [tirer(tireurs), tirer(tireurs), tirer(tireurs)]],
  ['3 fabricants', () => [tirer(passeurs), tirer(passeurs), tirer(passeurs)]],
  ['3 joueurs moyens', () => [tirer(neutres), tirer(neutres), tirer(neutres)]],
];

console.log(`\n${attaquants.length} attaquants réguliers, 200 trios par cas\n`);
console.log('  composition                      chimie   étiquette la plus fréquente');
for (const [nom, fab] of CAS) {
  const notes = [], noms = {};
  for (let i = 0; i < 200; i++) {
    const r = noter(fab());
    notes.push(r.off);
    noms[r.nom] = (noms[r.nom] || 0) + 1;
  }
  const top = Object.entries(noms).sort((a, b) => b[1] - a[1])[0];
  const m = moy(notes);
  console.log(`  ${nom.padEnd(32)} ${(m >= 0 ? '+' : '') + m.toFixed(1).padStart(5)}   ${top[0]} (${Math.round(100 * top[1] / 200)} %)`);
}

/* ---------- où la vraie ligue atterrit ---------- */
const toutes = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);
  for (const [, ps] of Object.entries(parEquipe)) {
    if (ps.length < 20) continue;
    const pool = ps.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    if (Object.keys(roster).length < 20) continue;
    for (let u = 0; u < 4; u++) toutes.push(getUnitSynergy(roster, 'F', u).bonusOff);
  }
}
const tri = toutes.slice().sort((a, b) => a - b);
const q = (x) => tri[Math.floor(x * (tri.length - 1))].toFixed(1);
console.log(`\n  Sur ${tri.length} trios de vraies équipes (zone comprise) :`);
console.log(`    10e centile ${q(0.10)}   médiane ${q(0.50)}   90e centile ${q(0.90)}`);
console.log(`    pire ${tri[0].toFixed(1)}   meilleur ${tri[tri.length - 1].toFixed(1)}\n`);
