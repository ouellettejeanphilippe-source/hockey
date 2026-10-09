/*
 * LES POSITIONS MULTIPLES, RÉELLES (V5, docs/refonte-v5.md). JP : *avoir assez de joueurs multi positions pour
 * faciliter les lineups, sans irréaliste* ; *positions multiples aux joueurs qui en ont*. Ce qu'on exige :
 *   1. la règle (`positionsAvant`, js/sim.js) ne donne une seconde position que sur ce que les données mesurent :
 *      un centre qui prend peu de mises au jeu joue l'aile de son lancer, un ailier qui en prend beaucoup dépanne
 *      au centre, un ailier qui lance du côté opposé joue les deux ailes ; sans données, une seule position ;
 *   2. la pénalité de position tombe à zéro sur ces cases-là, et nulle part ailleurs ;
 *   3. dans les shards qui portent les données (`sc`, `fpg`), la part d'attaquants à deux positions reste
 *      réaliste (de 15 à 40 %), et un club réel trouve plus souvent ses quatre ailiers de chaque côté.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { positionsAvant, getPositionPenalty, SLOTS } from '../js/sim.js';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const pos = p => [...positionsAvant(p)].sort().join('/');
const caseDe = role => SLOTS.find(s => s.group === 'F' && s.role === role && !s.scratch);

/* 1. La règle, cas par cas. */
exiger('sans données, un centre reste centre', pos({ p: 'F', np: 'C' }) === 'C', pos({ p: 'F', np: 'C' }));
exiger('un centre qui prend des mises au jeu reste centre', pos({ p: 'F', np: 'C', sc: 'L', fpg: 14.2 }) === 'C');
exiger('un centre qui en prend peu joue l\'aile de son lancer', pos({ p: 'F', np: 'C', sc: 'L', fpg: 1.1 }) === 'AG/C' && pos({ p: 'F', np: 'C', sc: 'R', fpg: 0.4 }) === 'AD/C');
exiger('sans le côté du lancer, pas d\'aile devinée', pos({ p: 'F', np: 'C', fpg: 0.4 }) === 'C');
exiger('un ailier qui prend 5 mises au jeu par match dépanne au centre', pos({ p: 'F', np: 'L', sc: 'L', fpg: 7.5 }) === 'AG/C');
exiger('un ailier qui lance du côté opposé joue les deux ailes', pos({ p: 'F', np: 'L', sc: 'R' }) === 'AD/AG' && pos({ p: 'F', np: 'R', sc: 'L' }) === 'AD/AG');
exiger('un ailier qui lance de son côté garde son aile', pos({ p: 'F', np: 'R', sc: 'R', fpg: 0.2 }) === 'AD');

/* 2. La pénalité suit la règle. */
const C = caseDe('C'), AG = caseDe('AG'), AD = caseDe('AD');
const centreAile = { p: 'F', np: 'C', sc: 'L', fpg: 1.1 }, centrePur = { p: 'F', np: 'C', sc: 'L', fpg: 14 };
exiger('le centre-ailier joue l\'aile gauche sans pénalité, pas l\'aile droite', getPositionPenalty(centreAile, AG) === 0 && getPositionPenalty(centreAile, AD) === 3);
exiger('le centre pur garde sa pénalité à l\'aile', getPositionPenalty(centrePur, AG) === 3);
exiger('l\'ailier-centre joue le centre sans pénalité', getPositionPenalty({ p: 'F', np: 'R', sc: 'R', fpg: 6 }, C) === 0);
exiger('un ailier sans mises au jeu garde −5 au centre', getPositionPenalty({ p: 'F', np: 'R', sc: 'R', fpg: 0.3 }, C) === 5);

/* 3. Les shards : la part réaliste, et des ailiers en plus. */
const fichiers = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
let avec = 0, multi = 0, n = 0, clubs = 0, quatreAvant = 0, quatreApres = 0;
for (const f of fichiers) {
  const sh = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const F = sh.players.filter(p => p.p === 'F');
  if (!F.some(p => p.sc || p.fpg != null)) continue;
  avec++;
  for (const p of F) { if (p.gp < 20) continue; n++; if (positionsAvant(p).size > 1) multi++; }
  const parClub = new Map();
  for (const p of F) { if (!parClub.has(p.t)) parClub.set(p.t, []); parClub.get(p.t).push(p); }
  for (const liste of parClub.values()) {
    const top = liste.sort((a, b) => b.gp * (b.toi || 10) - a.gp * (a.toi || 10)).slice(0, 12);
    if (top.length < 12) continue;
    clubs++;
    const officiel = r => top.filter(p => [...positionsAvant({ np: p.np })][0] === r).length;
    const reel = r => top.filter(p => positionsAvant(p).has(r)).length;
    if (officiel('AG') >= 4 && officiel('AD') >= 4) quatreAvant++;
    if (reel('AG') >= 4 && reel('AD') >= 4) quatreApres++;
  }
}
if (!avec) informer('les shards', 'aucun ne porte encore le côté du lancer ni les mises au jeu : le build (`build_shards.py`, mode full) les ajoute ; la règle ne change rien d\'ici là');
else {
  borne('attaquants à deux positions (20 matchs et plus)', 100 * multi / Math.max(1, n), 15, 40, ' %');
  exiger('plus de clubs trouvent quatre ailiers de chaque côté', quatreApres > quatreAvant, `${quatreAvant} → ${quatreApres} sur ${clubs} clubs, ${avec} saisons`);
}

verdict('Les positions multiples');
