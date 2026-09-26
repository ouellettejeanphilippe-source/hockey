/*
 * LE BALLOTTAGE SE REJOUE (S66). C'est la seule décision qui fait ENTRER un
 * joueur neuf dans l'alignement — tout le reste permute les mêmes 23 — donc
 * elle a son propre garde-fou :
 *   — la même graine et la même décision rejouent la même saison, au but près ;
 *   — les journées d'AVANT la réclamation sont identiques à la saison sans elle ;
 *   — le joueur réclamé joue vraiment, et celui qu'il remplace ne joue plus ;
 *   — la décision 0 retrouve le libéré (le moteur le connaît par sa clé).
 *
 *   node scripts/check_ballottage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, getPlayerKey, getPersonKey, connaitre, photoAlignement } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const shard = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

function ligue() {
  const out = [];
  for (const f of SAISONS.slice(10, 50)) {
    const sh = shard(f);
    for (const tag of [...new Set(sh.players.map(p => p.t))].slice(0, 2)) {
      let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
      if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
      const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings);
      out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
      if (out.length === 16) return out;
    }
  }
  return out;
}

// Un joueur hors ligue : un attaquant d'une autre saison.
const autre = shard(SAISONS[5]).players.find(p => p.p !== 'G' && p.p !== 'D' && p.gp > 40);
registerHiddenRatings(autre);
const iR = SLOTS.find(s => s.scratch && s.role === 'Réserve F').i;

const jouer = avecBallottage => {
  const teams = ligue();
  const toi = teams[0];
  connaitre(autre);
  const d0 = { jour: 0, equipe: 0, cases: photoAlignement(toi.roster) };
  const sort = toi.roster[iR];
  const decisions = [d0];
  if (avecBallottage) decisions.push({ jour: 30, equipe: 0, ballottage: { i: iR, entre: getPlayerKey(autre), sort: sort && getPlayerKey(sort) } });
  const L = simulateLeague(teams, 82, { graine: 'ballottage', decisions });
  const empreinte = j => L.calendrier.slice(0, j).map(jr => jr.map(m => `${m.gfA}-${m.gfB}`).join(',')).join('|');
  return { L, toi, sort, avant: empreinte(30), tout: empreinte(Infinity) };
};

const sans = jouer(false), avec = jouer(true), encore = jouer(true);
exiger('la même réclamation rejoue la même saison', avec.tout === encore.tout, 'au but près');
exiger('les 30 journées d\'avant sont celles de la saison sans réclamation', avec.avant === sans.avant, 'identiques');
exiger('la réclamation change la suite', avec.tout !== sans.tout, 'la saison diverge');
exiger('le joueur réclamé est dans l\'alignement', avec.toi.roster[iR] === autre, autre.n);
exiger('le joueur réclamé a joué', (autre.simGP || 0) > 0, `${autre.simGP || 0} matchs`);
exiger('le libéré n\'est plus dans l\'alignement', !Object.values(avec.toi.roster).includes(avec.sort), avec.sort ? avec.sort.n : 'case vide');
/*
 * DES DÉS NEUFS APRÈS CHAQUE DÉCISION (S68). La même décision prise deux fois
 * (deux sels) donne deux suites différentes ; le même sel redonne la même ;
 * et les journées d'avant ne bougent jamais.
 */
const avecSel = sel => {
  const teams = ligue();
  const decisions = [{ jour: 0, equipe: 0, cases: photoAlignement(teams[0].roster) }, { jour: 30, equipe: 0, plan: 'equilibre', sel }];
  const L = simulateLeague(teams, 82, { graine: 'sel', decisions });
  const e = j => L.calendrier.slice(0, j).map(jr => jr.map(m => `${m.gfA}-${m.gfB}`).join(',')).join('|');
  return { avant: e(30), tout: e(Infinity) };
};
const s1 = avecSel('a'), s2 = avecSel('b'), s1b = avecSel('a');
exiger('la même décision avec un autre sel rejoue AUTREMENT la suite', s1.tout !== s2.tout, 'deux saisons différentes');
exiger('le même sel redonne la même saison (la sauvegarde)', s1.tout === s1b.tout, 'au but près');
exiger('les journées d’avant ne bougent pas', s1.avant === s2.avant, 'identiques');
verdict('Le ballottage et les dés neufs');
