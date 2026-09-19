/*
 * LA PRODUCTION SE RÉPARTIT-ELLE COMME DANS LA VRAIE VIE ?
 *
 * Le moteur reproduit bien le TOTAL d'une équipe — `check_feuilles.mjs` tient
 * les 28,5 lancers et les 3,1 buts par match. Ce script pose l'autre moitié
 * de la question : ce total, est-il réparti entre les quatre trios comme la
 * vraie équipe l'a réparti ?
 *
 * Il a fallu le mesurer pour s'apercevoir que non. Le poids offensif d'une
 * unité valait `POIDS_TRIO[u] × volume`, où `volume` est la moyenne des
 * lancers PAR MATCH de ses joueurs — un nombre qui contient DÉJÀ leur temps
 * de glace. Le temps de glace était donc compté deux fois et le premier trio
 * ramassait tout : Jacques Lemaire 1976-77 sortait à 141 points simulés pour
 * 77 réels, pendant que Bob Gainey tombait à 8 pour 34.
 *
 * JP, devant la fiche d'Alexander Semin 2009-10 (84 points réels, 156
 * simulés) : *grosse déviation versus stats originales, ça devrait pas
 * s'éloigner autant*.
 *
 * Ce qui se juge ici est un RAPPORT, pas un total : la part des lancers du
 * premier trio sur celle du quatrième, comparée à la même part dans la vraie
 * saison de ces mêmes joueurs. Un rapport s'affranchit de l'époque — une
 * ligue à 4 buts par match et une à 3,1 le donnent pareil — et c'est
 * exactement ce que `VOLUME_EXPOSANT` règle.
 *
 *   node scripts/check_parts.mjs
 */
import { SLOTS, autoRoster, registerHiddenRatings, profilMatch, createTeam, VOLUME_EXPOSANT } from '../js/sim.js';
import { equipeReelle, TEMOINS } from './lib/vestiaires.mjs';
import { borne, informer, verdict } from './verdict.mjs';

const align = un => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return autoRoster(p); };
const part = (a, t) => `${(100 * a / t).toFixed(0)} %`;

console.log(`\n  La part des LANCERS par rang de trio · VOLUME_EXPOSANT = ${VOLUME_EXPOSANT}\n`);

for (const [lab, saison, tag] of TEMOINS) {
  let unites;
  try { unites = equipeReelle(saison, tag); } catch { continue; }
  const roster = align(unites);
  const profil = profilMatch(createTeam(lab, tag, roster, { season: saison }), roster);

  // Le réel : les lancers par match qu'ont vraiment pris les joueurs de
  // chaque unité, cette saison-là. Le moteur : le poids offensif que
  // `profilMatch` leur donne — c'est lui qui décide qui tire.
  const reel = [0, 0, 0, 0];
  for (const s of SLOTS) {
    if (s.group !== 'F' || s.scratch) continue;
    const p = roster[s.i];
    if (p) reel[s.unit] += (p.sh || 0) / Math.max(1, p.gp || 1);
  }
  const jeu = profil.unites.F.map(u => u.poids);
  const tr = reel.reduce((a, x) => a + x, 0), tj = jeu.reduce((a, x) => a + x, 0);
  if (!tr || !tj) continue;

  informer(`${lab} · réel`, `F1 ${part(reel[0], tr)} · F2 ${part(reel[1], tr)} · F3 ${part(reel[2], tr)} · F4 ${part(reel[3], tr)}`);
  informer(`${lab} · moteur`, `F1 ${part(jeu[0], tj)} · F2 ${part(jeu[1], tj)} · F3 ${part(jeu[2], tj)} · F4 ${part(jeu[3], tj)}`);
  // Le repère : le moteur peut concentrer un peu plus que le réel — c'est un
  // jeu, et le placement doit se payer — mais pas du double. L'intervalle est
  // celui que la mesure autorise : à VOLUME_EXPOSANT 1, MTL 76-77 lisait
  // 2,15 fois le rapport réel et ce repère rougissait.
  const r = (jeu[0] / (jeu[3] || 1)) / (reel[0] / (reel[3] || 1));
  borne(`${lab} · concentration sur le 1er trio`, r, 0.75, 1.45, 'fois le réel');
}

verdict('La répartition par trio');
