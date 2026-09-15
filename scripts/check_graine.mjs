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
         generateur, photoAlignement } from '../js/sim.js';
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

/*
 * `decider(equipes)` rend la liste des décisions en saison (voir
 * `simulateLeague`) : l'alignement de la première équipe change au jour dit.
 * Sans décision, la saison est celle du repêchage, comme avant.
 */
function jouer(graine, decider = null) {
  const equipes = vestiaires.map(v => {
    const pool = v.pool.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    return createTeam(`${v.tag} ${v.season}`, v.tag, autoRoster(pool), { season: v.season });
  });
  const decisions = decider ? decider(equipes) : [];
  const ligue = simulateLeague(equipes, 82, { graine, decisions });
  // Les séries continuent la même suite : elles doivent se rejouer aussi.
  const [A, B] = ligue.standings;
  const serie = playSeries(A, B, true);
  const feuilles = ligue.calendrier.flat().map(m => `${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}`).join('\n');
  const fiches = ligue.standings.map(t => `${t.name} ${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`).join('\n');
  const joueurs = ligue.standings.flatMap(t => SLOTS.map(s => t.roster[s.i]).filter(Boolean)
    .map(p => `${p.n} ${p.simGP} ${p.simG} ${p.simA} ${p.simPM} ${p.simSV || 0}`)).join('\n');
  const serieTexte = `${serie.wA}-${serie.wB} ` + serie.feuilles.map(f => `${f.buts.filter(b => b.cote === 'A').length}-${f.buts.filter(b => b.cote === 'B').length}`).join(' ');
  const jours = ligue.calendrier.map(j => j.map(m => `${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}`).join(';'));
  return { graine: ligue.graine, feuilles, fiches, joueurs, serie: serieTexte, jours, equipes };
}

/* Une décision au jour J : les deux ailiers gauches du 1er et du 4e trio de la
   première équipe échangent leur case. Le talent change de trio, rien d'autre. */
const JOUR_DECISION = 40;
const permuter = equipes => {
  const t = equipes[0];
  const ag = i => SLOTS.find(s => s.group === 'F' && s.unit === i && s.role === 'AG' && !s.scratch).i;
  const cases = photoAlignement(t.roster);
  [cases[ag(0)], cases[ag(3)]] = [cases[ag(3)], cases[ag(0)]];
  return [{ jour: 0, cases: photoAlignement(t.roster) }, { jour: JOUR_DECISION, cases }];
};
/* La décision vide : l'alignement de départ, réappliqué au jour 0. */
const rien = equipes => [{ jour: 0, cases: photoAlignement(equipes[0].roster) }];

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

/* ---------- les décisions en saison ---------- */
const f0 = jouer('la-meme-graine', rien);
dire(f0.feuilles === a.feuilles && f0.joueurs === a.joueurs, 'réappliquer l\'alignement de départ ne change rien');
const f1 = jouer('la-meme-graine', permuter);
const f2 = jouer('la-meme-graine', permuter);
const avant = a.jours.slice(0, JOUR_DECISION).join('\n') === f1.jours.slice(0, JOUR_DECISION).join('\n');
const apres = a.jours.slice(JOUR_DECISION).join('\n') !== f1.jours.slice(JOUR_DECISION).join('\n');
dire(avant, `une décision au jour ${JOUR_DECISION} laisse les ${JOUR_DECISION} journées d'avant identiques`);
dire(apres, `et change ce qui suit (${f1.equipes[0].name} : ${a.fiches.split('\n').find(x => x.startsWith(f1.equipes[0].name))} → ${f1.fiches.split('\n').find(x => x.startsWith(f1.equipes[0].name))})`);
dire(f1.feuilles === f2.feuilles && f1.joueurs === f2.joueurs, 'les mêmes décisions se rejouent à l\'identique');
const ag0 = SLOTS.find(s => s.group === 'F' && s.unit === 0 && s.role === 'AG' && !s.scratch).i;
dire(f1.equipes[0].roster[ag0] !== a.equipes[0].roster[ag0] || f1.equipes[0].roster[ag0].n !== a.equipes[0].roster[ag0].n,
  `l'alignement final porte la décision (${f1.equipes[0].roster[ag0].n} au 1er trio)`);

console.log(echecs ? `\n${echecs} échec(s)` : '\ntout se rejoue');
process.exit(echecs ? 1 : 0);
