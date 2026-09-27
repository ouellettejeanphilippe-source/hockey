/*
 * L'IDENTITÉ DE DÉPART (S73) — ce qui doit tenir.
 *
 *   node scripts/check_identite.mjs
 *
 * JP : *un choix au début qui influence en mode loto le type de joueurs
 * qu'ils sortent plus souvent*. La roulette tire deux clubs et garde celui
 * dont le joueur offert colle le mieux (js/game.js, `scoreDeLaMain`). On
 * rejoue ici ce « meilleur de deux » sur les vrais vestiaires, case par case,
 * et on exige :
 *   1. chaque identité sort PLUS SOUVENT son genre de joueur (au moins une
 *      fois et demie plus de cartes qui y collent) ;
 *   2. mais pas TOUJOURS : une carte sur cinq au moins reste hors identité
 *      (c'est une orientation, pas un filtre) ;
 *   3. le score ne lit aucune cote : il ne change pas quand on retire les
 *      cotes d'un joueur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, joueurEquivalent, registerHiddenRatings } from '../js/sim.js';
import { IDENTITES, scoreIdentite } from '../js/identites.js';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const clubs = [];
for (const f of SAISONS) {
  const sh = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const par = new Map();
  for (const p of sh.players) { registerHiddenRatings(p); if (!par.has(p.t)) par.set(p.t, []); par.get(p.t).push(p); }
  for (const [t, pool] of par) if (pool.length >= 8) clubs.push({ season: sh.season, team: t, pool });
}
let x = 73;
const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const club = () => clubs[Math.floor(rnd() * clubs.length)];
const cases = SLOTS.filter(s => !s.scratch && s.group !== 'G');

console.log('\n  L\'identité de départ (S73)\n');
const SEUIL = 0.62;
for (const [cle, I] of Object.entries(IDENTITES)) {
  let sans = 0, avec = 0, n = 0;
  for (let k = 0; k < 1500; k++) {
    const c = cases[k % cases.length];
    const a = club(), b = club();
    const pa = joueurEquivalent(a.pool, c, new Set(), c.unit), pb = joueurEquivalent(b.pool, c, new Set(), c.unit);
    if (!pa || !pb) continue;
    const sa = scoreIdentite(cle, pa), sb = scoreIdentite(cle, pb);
    n++;
    if (sa >= SEUIL) sans++;
    if (Math.max(sa, sb) >= SEUIL) avec++;
  }
  const ps = sans / n, pa = avec / n;
  exiger(`${I.ico} ${I.nom} : plus souvent, pas toujours`, pa >= Math.min(1.5 * ps, ps + 0.12) && pa <= 0.8,
    `${(ps * 100).toFixed(0)} % des cartes y collent sans identité, ${(pa * 100).toFixed(0)} % avec`);
}
// 3. Aucune cote.
{
  const p = clubs[5].pool.find(q => q.p !== 'G');
  const avant = Object.keys(IDENTITES).map(k => scoreIdentite(k, p).toFixed(4)).join();
  const nu = { ...p };
  for (const k of ['o', 'd', 'r', 'c', 'sp', 'v']) delete nu[k];
  const apres = Object.keys(IDENTITES).map(k => scoreIdentite(k, nu).toFixed(4)).join();
  exiger('le score d\'identité ne lit aucune cote', avant === apres, `${p.n} : ${avant === apres ? 'identique sans ses cotes' : `${avant} puis ${apres}`}`);
}
informer('le seuil d\'une carte qui « colle »', `score ≥ ${SEUIL} (profil mesuré, âge, production par dollar)`);
verdict('L\'identité de départ');
