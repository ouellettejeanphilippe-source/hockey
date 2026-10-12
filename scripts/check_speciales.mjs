/*
 * TES UNITÉS SPÉCIALES (V7, JP : *créer lignes avantages numériques à part*). Le moteur jouait déjà deux unités
 * d'avantage (65 et 35 % du temps) et deux de désavantage (60 et 40 %), rangées seules sur les vrais points de chacun
 * en avantage et en désavantage. Elles se voient maintenant dans les Lignes, et se choisissent. Ce script prouve :
 *
 *   1. sans choix, rien ne bouge : le choix du moteur, posé tel quel, se lit au point près comme pas de choix ;
 *   2. un choix est joué tel quel (les deux unités échangées le sont dans le moteur) ;
 *   3. un choisi absent ou en double cède sa case au suivant du moteur : toujours cinq et quatre, personne deux fois ;
 *   4. les minutes se tiennent : avantage + désavantage + forces égales = 60, et chaque unité a sa part ;
 *   5. la décision se joue : posée comme décision du soir (`aVenir`), elle se lit comme posée sur l'équipe, et une
 *      forme abîmée est refusée (`specialesValides`) ; sortir les vedettes de l'avantage coûte des buts AU TOTAL
 *      (la part d'avantage d'un joueur se retire à forces égales selon sa vraie saison, pas selon ton choix) ;
 *   6. EN PAIRES, sur des saisons : les plus mauvais tireurs en première unité d'avantage marquent moins en avantage
 *      que le choix du moteur, sous les mêmes dés.
 *
 *   node scripts/check_speciales.mjs
 */
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, activeLineup, getPlayerKey, specialesDuSoir, specialesValides } from '../js/sim.js';
import { chiffresDuSoir, specialesEnStats } from '../js/impact.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const eq = (saison, tag) => {
  const p = equipeReelle(saison, tag).flat().map(x => ({ ...x }));
  p.forEach(registerHiddenRatings);
  return createTeam(`${tag} ${saison}`, tag, autoRoster(p), { season: saison });
};
const T = eq('2005-06', 'OTT'), adv = eq('2005-06', 'CAR');
const lu = activeLineup(T);
const cles = u => u.map(getPlayerKey);
const auto = specialesDuSoir(T, lu);

// 1. Le choix du moteur, posé, se lit comme pas de choix.
const sans = chiffresDuSoir(T, lu, adv);
T.speciales = { AN: auto.AN.map(cles), DN: auto.DN.map(cles) };
const pose = chiffresDuSoir(T, lu, adv);
exiger('sans choix, rien ne bouge (le choix du moteur posé se lit pareil)', Math.abs(sans.butsPour - pose.butsPour) < 1e-9 && Math.abs(sans.butsContre - pose.butsContre) < 1e-9,
  `${sans.butsPour.toFixed(4)} et ${pose.butsPour.toFixed(4)} buts pour`);

// 2. Un choix est joué tel quel.
T.speciales = { AN: [cles(auto.AN[1]), cles(auto.AN[0])], DN: [cles(auto.DN[1]), cles(auto.DN[0])] };
const echange = specialesDuSoir(T, lu);
exiger('un choix est joué tel quel (les deux unités échangées)', cles(echange.AN[0]).join() === cles(auto.AN[1]).join() && cles(echange.DN[1]).join() === cles(auto.DN[0]).join());

// 3. Un absent et un doublon cèdent leur case.
const fantome = 'personne-1999';
T.speciales = { AN: [[fantome, ...cles(auto.AN[0]).slice(1)], cles(auto.AN[0])], DN: auto.DN.map(cles) };
const comble = specialesDuSoir(T, lu);
const tous = [...comble.AN[0], ...comble.AN[1]];
exiger('un absent ou un doublon cède sa case : cinq et quatre, personne deux fois',
  comble.AN.every(u => u.length === 5) && comble.DN.every(u => u.length === 4) && new Set(tous).size === tous.length && !cles(tous).includes(fantome),
  `AN ${comble.AN.map(u => u.length).join('+')} · DN ${comble.DN.map(u => u.length).join('+')} · ${new Set(tous).size} joueurs distincts en avantage`);

// 4. Les minutes.
T.speciales = null;
const st = specialesEnStats(T, lu, adv), m = chiffresDuSoir(T, lu, adv);
const somme = xs => xs.reduce((a, x) => a + x.minutes, 0);
borne('avantage + désavantage + forces égales = 60 minutes', st.minutesFE + somme(st.AN) + somme(st.DN), 59.9, 60.1, ' min');
exiger('chaque unité a sa part des minutes (65/35 en avantage, 60/40 en désavantage)',
  Math.abs(somme(st.AN) - m.minutesAvantage) < 1e-6 && Math.abs(st.AN[0].minutes / somme(st.AN) - 0.65) < 1e-6 && Math.abs(st.DN[0].minutes / somme(st.DN) - 0.60) < 1e-6,
  `AN ${st.AN.map(x => x.minutes.toFixed(1)).join(' + ')} · DN ${st.DN.map(x => x.minutes.toFixed(1)).join(' + ')} · FE ${st.minutesFE.toFixed(1)} min`);
informer('les unités, par match', `AN1 ${st.AN[0].tirs.toFixed(1)} tirs à ${(st.AN[0].pctTir * 100).toFixed(1)} % · AN2 ${st.AN[1].tirs.toFixed(1)} · DN1 ${st.DN[0].contre.toFixed(1)} tirs contre à ${st.DN[0].pctArr.toFixed(3)}`);

// 5. La décision du soir se lit comme posée ; une forme abîmée est refusée.
const pire = (() => {
  const F = Object.values(lu).filter(p => p && p.p !== 'G' && p.p !== 'D' && p.p !== 'LD' && p.p !== 'RD');
  const D = Object.values(lu).filter(p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD'));
  const bas = xs => xs.slice().sort((a, b) => ((a.ppp || 0) / Math.max(1, a.gp)) - ((b.ppp || 0) / Math.max(1, b.gp)));
  const f = bas(F), d = bas(D);
  return { AN: [cles([...f.slice(0, 3), ...d.slice(0, 2)]), cles([...f.slice(3, 6), ...d.slice(2, 4)])], DN: auto.DN.map(cles) };
})();
const parDecision = chiffresDuSoir(T, lu, adv, [{ speciales: pire }]);
T.speciales = pire;
const posee = chiffresDuSoir(T, lu, adv);
T.speciales = null;
exiger('la décision du soir se lit comme posée sur l\'équipe', Math.abs(parDecision.butsPour - posee.butsPour) < 1e-9, `${posee.butsPour.toFixed(4)} buts pour`);
// Sortir les vedettes de l'avantage ne leur rend pas, à forces égales, les lancers de leur vraie saison en avantage.
exiger('les plus mauvais en avantage : moins de buts AU TOTAL (aucun lancer d\'avantage rendu à forces égales)', posee.butsPour < sans.butsPour,
  `${sans.butsPour.toFixed(2)} → ${posee.butsPour.toFixed(2)} buts pour par match`);
exiger('une forme abîmée est refusée', specialesValides({ AN: [['a']] }) === null && specialesValides(null) === null && !!specialesValides(pire));

// 6. En paires, sur des saisons : les plus mauvais en avantage marquent moins en avantage.
const SAISONS = [['1985-86', 'EDM', 'MTL'], ['1995-96', 'COL', 'DET'], ['2005-06', 'OTT', 'CAR'], ['2015-16', 'WSH', 'PIT']];
let buts0 = 0, buts1 = 0, n = 0;
for (const [s, a, b] of SAISONS) {
  for (const avecPire of [false, true]) {
    const A = eq(s, a), B = eq(s, b);
    if (avecPire) {
      const l = activeLineup(A);
      const F = Object.values(l).filter(p => p && p.p !== 'G' && !['D', 'LD', 'RD'].includes(p.p));
      const D = Object.values(l).filter(p => p && ['D', 'LD', 'RD'].includes(p.p));
      const bas = xs => xs.slice().sort((x, y) => ((x.ppp || 0) / Math.max(1, x.gp)) - ((y.ppp || 0) / Math.max(1, y.gp)));
      const f = bas(F), d = bas(D), aut = specialesDuSoir(A, l);
      A.speciales = { AN: [cles([...f.slice(0, 3), ...d.slice(0, 2)]), cles([...f.slice(3, 6), ...d.slice(2, 4)])], DN: aut.DN.map(cles) };
    }
    simulateLeague([A, B], 82, { graine: `SP${s}` });
    const anA = Object.values(A.roster).reduce((x, p) => x + ((p && p.simPPG) || 0), 0);
    if (avecPire) buts1 += anA; else { buts0 += anA; n++; }
  }
}
informer('en avantage, sur 82 matchs (quatre saisons)', `le choix du moteur ${buts0} buts · les plus mauvais en AN1 ${buts1} buts`);
exiger('EN PAIRES : les plus mauvais en avantage marquent moins en avantage', n === SAISONS.length && buts1 < buts0, `${buts0} → ${buts1}`);

verdict('Tes unités spéciales');
