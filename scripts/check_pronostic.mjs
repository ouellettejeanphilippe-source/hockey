/*
 * LE PRONOSTIC NE TOUCHE À RIEN (S78, js/pronostic.js ; V28, tranche 4 : la chance d'un soir isolé).
 *
 * La jauge de la feuille du soir (`chanceDUnSoir`, js/run.js) rejoue le match des dizaines de fois avec le vrai
 * moteur, sur les deux vrais clubs tels qu'ils sont ce soir, pendant que la run continue la suite de son hasard.
 * Ce script exige :
 *
 *   1. que des séries jouées APRÈS un pronostic soient identiques à celles jouées sans (le générateur n'a pas bougé) ;
 *   2. que chaque joueur et chaque club retrouvent leurs champs à l'identique ;
 *   3. que le pronostic soit reproductible (mêmes clubs, même graine, même compte) ;
 *   4. que ses chiffres tiennent debout (le premier du classement gagne plus souvent contre le dernier) ;
 *   5. qu'il se calcule assez vite pour un écran (le temps est affiché).
 *
 * Le pronostic d'une ligue au jour le jour, ses conditions et les chances des objectifs du proprio sont partis avec
 * l'ancien Rogue : ce juge lit ce qui reste, sur les mêmes cinq exigences.
 *
 *   node scripts/check_pronostic.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, playSeries } from '../js/sim.js';
import { generateur } from '../js/util.js';
import { chanceDUnSoir } from '../js/pronostic.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

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

// 1 et 2. Les séries après un pronostic sont celles sans pronostic, et rien n'a bougé chez les clubs.
const L1 = ligue();
const s1 = playSeries(L1.standings[0], L1.standings[1], true);
const L2 = ligue();
const toi = L2.equipes[0], autre = L2.equipes[1];
const N = 40;
const avant = empreinte(L2.equipes);
const t0 = performance.now();
const v1 = chanceDUnSoir({ A: toi, B: autre, n: N, graine: 'juge' });
const temps = performance.now() - t0;
const apres = empreinte(L2.equipes);
// Le même soir, deux fois, AVANT les séries : elles blessent et fatiguent leurs clubs.
const v2 = chanceDUnSoir({ A: toi, B: autre, n: N, graine: 'juge' });
const v3 = chanceDUnSoir({ A: toi, B: autre, n: N, graine: 'autre tranche' });
const s2 = playSeries(L2.standings[0], L2.standings[1], true);
exiger('les séries jouées après le pronostic sont identiques',
  JSON.stringify(s1.feuilles.map(f => [f.buts.length, f.arrets])) === JSON.stringify(s2.feuilles.map(f => [f.buts.length, f.arrets])) && s1.wA === s2.wA && s1.wB === s2.wB, `${s1.wA}-${s1.wB} puis ${s2.wA}-${s2.wB}`);
exiger('chaque joueur et chaque club retrouvent leurs champs', avant === apres, avant === apres ? 'identiques' : 'DIFFÉRENTS');

// 3. Reproductible : la graine de la tranche fait le compte.
exiger('les mêmes clubs et la même graine redonnent le même pronostic', v1 === v2 && Number.isInteger(v1) && v1 >= 0 && v1 <= N, `${v1}/${N} puis ${v2}/${N}`);
informer('une autre tranche, d\'autres dés', `${v3}/${N}`);

// 4. Ça tient debout : le premier du classement contre le dernier, sur plusieurs tranches.
const fort = L2.standings[0], faible = L2.standings[L2.standings.length - 1];
const TRANCHES = 5;
let vFort = 0;
for (let i = 0; i < TRANCHES; i++) vFort += chanceDUnSoir({ A: fort, B: faible, n: N, graine: `debout:${i}` });
exiger('le premier du classement gagne plus souvent contre le dernier', vFort / (TRANCHES * N) > 0.5, `${(100 * vFort / (TRANCHES * N)).toFixed(0)} % de ${TRANCHES * N} matchs`);

// 5. Assez vite pour un écran.
exiger('la chance d\'un soir se calcule vite', temps < 2500, `${temps.toFixed(0)} ms (${N} matchs)`);

verdict('Le pronostic ne touche à rien');
