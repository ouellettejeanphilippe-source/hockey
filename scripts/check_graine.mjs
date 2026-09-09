/*
 * La même graine rejoue-t-elle la même saison ?
 *
 * Tout le hasard du moteur passe par `hasard()` (js/sim.js), et
 * `simulateLeague` tire ou reçoit une graine. Ce script bâtit une ligue de
 * 32 vraies équipes, la joue deux fois sur la même graine et exige des
 * classements, des fiches et des feuilles IDENTIQUES ; puis une troisième
 * fois sur une autre graine et exige qu'elle diffère. C'est le test qui
 * protège « Rejouer la saison », le défi du jour et tout test reproductible :
 * un `Math.random` glissé dans le moteur le fait échouer.
 *
 *   node scripts/check_graine.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, playSeries,
         generateur } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const saisons = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();

// Le choix des équipes est lui-même graine, pour que le script soit stable.
const choix = generateur('check_graine');
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

function jouer(graine) {
  const equipes = vestiaires.map(v => {
    const pool = v.pool.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    return createTeam(`${v.tag} ${v.season}`, v.tag, autoRoster(pool), { season: v.season });
  });
  const ligue = simulateLeague(equipes, 82, { graine });
  // Les séries continuent la même suite : elles doivent se rejouer aussi.
  const [A, B] = ligue.standings;
  const serie = playSeries(A, B, true);
  const feuilles = ligue.calendrier.flat().map(m => `${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}`).join('\n');
  const fiches = ligue.standings.map(t => `${t.name} ${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`).join('\n');
  const joueurs = ligue.standings.flatMap(t => SLOTS.map(s => t.roster[s.i]).filter(Boolean)
    .map(p => `${p.n} ${p.simGP} ${p.simG} ${p.simA} ${p.simPM} ${p.simSV || 0}`)).join('\n');
  const serieTexte = `${serie.wA}-${serie.wB} ` + serie.feuilles.map(f => `${f.buts.filter(b => b.cote === 'A').length}-${f.buts.filter(b => b.cote === 'B').length}`).join(' ');
  return { graine: ligue.graine, feuilles, fiches, joueurs, serie: serieTexte };
}

let echecs = 0;
const dire = (ok, quoi) => { console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${quoi}`); if (!ok) echecs++; };

const a = jouer('la-meme-graine');
const b = jouer('la-meme-graine');
const c = jouer('une-autre-graine');
const d = jouer();   // sans graine : le moteur en tire une et la rend

dire(a.graine === 'la-meme-graine', `la saison porte sa graine (${a.graine})`);
dire(a.fiches === b.fiches, 'même graine, mêmes fiches de 32 équipes');
dire(a.feuilles === b.feuilles, 'même graine, mêmes 1312 pointages');
dire(a.joueurs === b.joueurs, 'même graine, mêmes fiches de joueurs');
dire(a.serie === b.serie, `même graine, même série (${a.serie})`);
dire(a.feuilles !== c.feuilles, 'autre graine, autre saison');
dire(typeof d.graine === 'string' && d.graine.length > 0, `sans graine, le moteur en rend une (${d.graine})`);
const e = jouer(d.graine);
dire(e.fiches === d.fiches, 'la graine rendue rejoue la saison tirée sans graine');

console.log(echecs ? `\n${echecs} échec(s)` : '\ntout se rejoue');
process.exit(echecs ? 1 : 0);
