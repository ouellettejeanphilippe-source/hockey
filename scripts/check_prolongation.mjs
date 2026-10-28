/*
 * LA PROLONGATION (V19 ; JP : *pourquoi tout se finit toujours en première prolongation en série, et pas de tirs de barrage
 * en saison ?*). Avant, un match nul tirait un dé et un seul but. Maintenant :
 *   - en saison : cinq minutes de prolongation, où un match sur deux se règle (`P_BUT_EN_PROLONGATION`) ; l'autre va aux tirs
 *     de barrage, dont le but fait gagner sans que personne soit crédité ;
 *   - en séries : la mort subite, des périodes de vingt minutes, autant qu'il en faut.
 * Ce que le script prouve, sur des centaines de matchs entre deux vrais clubs :
 *   1. en saison, 40 à 70 % des prolongations finissent aux tirs de barrage... pas toutes au premier but ;
 *   2. un but de prolongation tombe entre 60 et 65 minutes ; un tir de barrage n'a ni marqueur ni lancer, et le pointage le compte ;
 *   3. en séries, une prolongation sur six dure plus d'une période, jamais aucun tir de barrage, et le but tombe dans sa période ;
 *   4. les buts de l'équipe, eux, restent la somme de ses joueurs (`check_feuilles`).
 *   node scripts/check_prolongation.mjs
 */
import { autoRoster, registerHiddenRatings, createTeam, playGame, feuilleVierge } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const club = (sa, tag) => { const ps = equipeReelle(sa, tag).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); return createTeam(`${tag} ${sa}`, tag, autoRoster(ps), { season: sa }); };
const A = club('2003-04', 'TBL'), B = club('2003-04', 'CGY');
const joue = (series, n) => {
  const out = [];
  for (let i = 0; i < n; i++) { const f = feuilleVierge(); playGame(A, B, 20 + (i % 60), false, series, f); if (f.ot) out.push(f); }
  return out;
};
const saison = joue(false, 3000), series = joue(true, 3000);
informer('prolongations', `${saison.length} en saison, ${series.length} en séries (sur 3000 matchs chacune)`);
const tb = saison.filter(f => f.fusillade);
exiger('en saison, entre 40 et 70 % des prolongations vont aux tirs de barrage', saison.length >= 300 && tb.length / saison.length > 0.4 && tb.length / saison.length < 0.7, `${(100 * tb.length / saison.length).toFixed(0)} % de ${saison.length}`);
exiger('un but de prolongation tombe entre 60 et 65 minutes, en saison', saison.filter(f => !f.fusillade).every(f => f.buts.some(b => b.instant >= 60 && b.instant < 65)), `${saison.length - tb.length} matchs`);
exiger('aux tirs de barrage, aucun but n\'est marqué après 60 minutes, et le pointage compte celui du gagnant', tb.every(f => !f.buts.some(b => b.instant >= 60) && f.gfA + f.gfB === f.buts.length + 1 && f.vainqueur === f.fusillade.gagnant && Math.abs(f.fusillade.A - f.fusillade.B) >= 1), `${tb.length} matchs`);
const longues = series.filter(f => f.periodesOT > 1);
exiger('en séries, jamais de tirs de barrage', series.every(f => !f.fusillade && f.otLongue));
exiger('en séries, de 8 à 35 % des prolongations durent plus d\'une période', series.length >= 300 && longues.length / series.length > 0.08 && longues.length / series.length < 0.35, `${(100 * longues.length / series.length).toFixed(0)} % de ${series.length}`);
exiger('en séries, le but gagnant tombe dans la période où il est dit', series.every(f => { const b = f.buts.find(x => x.instant >= 60); return b && b.instant >= 60 + 20 * (f.periodesOT - 1) && b.instant < 60 + 20 * f.periodesOT; }));
verdict("La prolongation");
