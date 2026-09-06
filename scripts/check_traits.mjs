/*
 * Les traits sont-ils rares, couvrent-ils les époques, et se voient-ils ?
 *
 * Trois questions, dans cet ordre, parce que rater la première rend les deux
 * autres sans objet : un trait courant n'est plus un trait, c'est une cote.
 *
 *   1. RARETÉ    quelle part des joueurs-saisons en porte un
 *   2. ÉPOQUES   y a-t-il des saisons sans aucun trait, et lesquelles
 *   3. EFFET     un lauréat change-t-il quelque chose de mesurable
 *
 * La troisième se mesure en dupliquant une vraie équipe et en retirant les
 * traits à la copie : même vestiaire, même moteur, un seul écart.
 *
 *   node scripts/check_traits.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTraits, TRAITS, VEZINA_VOTE_DEPUIS } from '../js/traits.js';
import { autoRoster, registerHiddenRatings, simulate } from '../js/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const ESSAIS = Number(process.env.ESSAIS ?? 10);

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* ---------- 1 et 2 : rareté et couverture ---------- */
let joueursSaisons = 0;
const compte = {}, parSaison = {}, porteurs = [];
for (const k of Object.keys(TRAITS)) compte[k] = [0, 0];

const fichiers = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();
for (const f of fichiers) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const vus = new Set();
  parSaison[shard.season] = 0;
  for (const p of shard.players) {
    if (vus.has(p.id)) continue;
    vus.add(p.id);
    joueursSaisons++;
    const ts = getTraits(p);
    for (const t of ts) { compte[t.cle][t.niveau]++; parSaison[shard.season]++; }
    if (ts.length) porteurs.push({ p, ts });
  }
}

console.log(`\n${joueursSaisons} joueurs-saisons, ${fichiers.length} saisons\n`);
console.log('  trait          gagnants  finalistes   part');
let total = 0;
for (const [k, meta] of Object.entries(TRAITS)) {
  const [g, fi] = compte[k];
  total += g + fi;
  console.log(`  ${meta.icon} ${meta.short.padEnd(12)} ${String(g).padStart(6)}  ${String(fi).padStart(10)}`
    + `   ${(100 * (g + fi) / joueursSaisons).toFixed(2)} %`);
}
console.log(`\n  au total ${total} traits sur ${joueursSaisons} joueurs-saisons — `
  + `${(100 * total / joueursSaisons).toFixed(2)} %`);

const vides = Object.entries(parSaison).filter(([, n]) => n === 0).map(([s]) => s);
console.log(`\n  saisons sans aucun trait : ${vides.length ? vides.join(', ') : 'aucune'}`);
const avantSelke = fichiers.map(f => f.replace('.json', '')).filter(s => s < '1977-78');
console.log(`  saisons sans Selke possible (créé en 1977-78) : ${avantSelke.length}`);
console.log(`  saisons sans Vezina possible (vote depuis ${VEZINA_VOTE_DEPUIS}) : `
  + `${fichiers.map(f => f.replace('.json', '')).filter(s => s < VEZINA_VOTE_DEPUIS).length}`);

/* ---------- 3 : l'effet se voit-il ? ---------- */
/* On prend les vraies équipes qui portent le plus de traits, et on les fait
 * jouer deux fois : avec, puis sans. Retirer un trait se fait en effaçant le
 * nom, seule clé de `getTraits` — le joueur reste identique par ailleurs. */
const parEquipe = new Map();
for (const { p, ts } of porteurs) {
  const cle = `${p.s}|${p.t}`;
  parEquipe.set(cle, (parEquipe.get(cle) || 0) + ts.length);
}
const cibles = [...parEquipe.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

console.log(`\n  CE QUE VALENT LES TRAITS — ${ESSAIS} saisons par équipe, avec puis sans\n`);
console.log('  équipe            traits    V avec   V sans   écart   BC avec  BC sans');
const ecarts = [], ecartsBC = [];
for (const [cle, n] of cibles) {
  const [saison, tag] = cle.split('|');
  const ps = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, `${saison}.json`), 'utf8'))
    .players.filter(p => p.t === tag && p.gp >= 10);
  if (ps.length < 20) continue;

  const jouer = (sansTraits) => {
    const pool = ps.map(p => ({ ...p, ...(sansTraits ? { n: `∅ ${p.n}` } : {}) }));
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    const rs = [];
    for (let i = 0; i < ESSAIS; i++) rs.push(simulate(roster));
    return { W: moy(rs.map(r => r.W)), GA: moy(rs.map(r => r.GA)) };
  };
  const avec = jouer(false), sans = jouer(true);
  ecarts.push(avec.W - sans.W);
  ecartsBC.push(avec.GA - sans.GA);
  console.log(`  ${(tag + ' ' + saison).padEnd(16)} ${String(n).padStart(6)}`
    + `   ${avec.W.toFixed(1).padStart(6)}   ${sans.W.toFixed(1).padStart(6)}`
    + `   ${(avec.W - sans.W >= 0 ? '+' : '')}${(avec.W - sans.W).toFixed(1).padStart(5)}`
    + `   ${avec.GA.toFixed(0).padStart(7)}  ${sans.GA.toFixed(0).padStart(7)}`);
}
console.log(`\n  écart moyen : ${(moy(ecarts) >= 0 ? '+' : '')}${moy(ecarts).toFixed(1)} victoires`
  + `, ${(moy(ecartsBC) >= 0 ? '+' : '')}${moy(ecartsBC).toFixed(1)} buts alloués`);
console.log('  Les victoires sont bruitées à dix essais ; les BUTS ALLOUÉS sont le');
console.log('  signal propre, puisque c\'est là que trois des quatre traits agissent.');
console.log('  Un trait doit se voir sans décider la saison à lui seul.\n');
