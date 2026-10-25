/**
 * ALIGNER AU MIEUX (oct.) — le bouton de l'alignement fait ce qu'il dit.
 *
 *   node scripts/check_au_mieux.mjs
 *
 * JP : *ajouter bouton best lines et best strategy dans l'alignement pour éviter le gossage ; plusieurs best :
 * défensive, offensive*. Sur des vraies équipes, vérifie que :
 *   1. « Le meilleur » voit plus loin que l'IA (`autoRoster`) — JP : *considérer positions, stratégie, etc.* : sur
 *      les buts d'un soir que le moteur joue (`chiffresDuSoir`, poste, côté, zone, minutes et affinité compris), il ne
 *      fait jamais pire (sauf ce que coûte remettre chacun à son poste, `PRIX_DU_POSTE`), et mieux en moyenne ;
 *   2. chaque style remplit les 23 cases, sans doublon, et garde tout le monde ;
 *   3. « Offensif » marque plus que « Défensif », et « Défensif » en accorde moins — jamais l'inverse au-delà d'un
 *      vingtième de but (`PENCHANT`) : sans systèmes (V18), un style ne penche que par qui joue où, et un effectif qui
 *      ne laisse pas de choix donne deux fois le même alignement ;
 *   4. JP : *les équipes adverses aussi devraient optimiser leurs effectifs* : un club de l'IA s'aligne au mieux en
 *      entrant dans la ligue (`creerLigue`), les mêmes joueurs ; ton club n'est pas touché ;
 *   5. et quand un des siens manque, tout le monde monte : son centre du 1er trio blessé, la case prend le meilleur
 *      qui y convient (un joueur d'une ligne plus bas ou un réserviste), le trou descend au 4e trio, personne deux fois.
 */
import { autoRoster, registerHiddenRatings, SLOTS, createTeam, creerLigue, activeLineup, trioAuMieux, getHiddenRatings, getPositionPenalty, getPersonKey, getPlayerKey, affiniteDeLigne } from '../js/sim.js';
import { alignementAuMieux, chiffresDuSoir, PRIX_DU_POSTE } from '../js/impact.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const CLUBS = [['1995-96', 'DET'], ['1985-86', 'EDM'], ['2007-08', 'PIT'], ['1977-78', 'MTL'], ['2018-19', 'TBL'], ['1999-00', 'NJD']];
const PENCHANT = 0.05;
const affinite = R => [0, 1, 2, 3].reduce((a, u) => a + affiniteDeLigne(R, u), 0);

console.log('\n  ALIGNER AU MIEUX\n');
const pareil = [], gains = [], complets = [], penche = [];
for (const [s, t] of CLUBS) {
  const joueurs = equipeReelle(s, t).flat().map(x => ({ ...x }));
  joueurs.forEach(registerHiddenRatings);
  const r = {};
  for (const st of ['equilibre', 'offensif', 'defensif']) r[st] = alignementAuMieux(joueurs, st);
  const ia = autoRoster(joueurs);
  const lu = R => chiffresDuSoir(createTeam('x', t, R, { season: s }), R);
  const ecart = R => { const m = lu(R); return m.butsPour - m.butsContre; };
  const pen = R => SLOTS.filter(sl => !sl.scratch && R[sl.i]).reduce((a, sl) => a + getPositionPenalty(R[sl.i], sl), 0);
  const [eIa, eMieux] = [ecart(ia), ecart(r.equilibre)];
  gains.push(eMieux - eIa);
  // Le poste d'abord (19 oct.) : le bouton cède au plus PRIX_DU_POSTE but par point de pénalité épargné.
  pareil.push(eMieux >= eIa - PRIX_DU_POSTE * Math.max(0, pen(ia) - pen(r.equilibre)) - 1e-9);
  informer(`${t} ${s} contre l'IA`, `différentiel par match ${eIa.toFixed(2)} → ${eMieux.toFixed(2)} · pénalités de poste ${pen(ia)} → ${pen(r.equilibre)} · affinité ${affinite(ia)} → ${affinite(r.equilibre)}`);
  for (const st of Object.keys(r)) {
    const pris = Object.values(r[st]).filter(Boolean);
    complets.push(SLOTS.filter(sl => !sl.scratch && !sl.extra).every(sl => r[st][sl.i]) && new Set(pris.map(getPersonKey)).size === pris.length);
  }
  // Le penchant : l'offensif marque plus que le défensif, le défensif en accorde moins.
  const [o, d] = [lu(r.offensif), lu(r.defensif)];
  penche.push(o.butsPour >= d.butsPour - PENCHANT && d.butsContre <= o.butsContre + PENCHANT);
  informer(`${t} ${s}`, `offensif ${o.butsPour.toFixed(2)}–${o.butsContre.toFixed(2)} · défensif ${d.butsPour.toFixed(2)}–${d.butsContre.toFixed(2)}`);
}
exiger('« Le meilleur » ne fait jamais pire que l\'IA, sauf ce que coûte remettre chacun à son poste', pareil.every(Boolean), `${pareil.filter(Boolean).length}/${pareil.length} clubs`);
borne('« Le meilleur » contre l\'IA, buts par match en moyenne', gains.reduce((a, x) => a + x, 0) / gains.length, 0.05, 1);
exiger('chaque style remplit les 23 cases, sans doublon', complets.every(Boolean), `${complets.filter(Boolean).length}/${complets.length}`);
exiger('« Offensif » marque plus, « Défensif » accorde moins', penche.every(Boolean), `${penche.filter(Boolean).length}/${penche.length} clubs`);

// 4 et 5 : les clubs de l'IA.
const ligue = CLUBS.map(([s, t]) => { const j = equipeReelle(s, t).flat().map(x => ({ ...x })); j.forEach(registerHiddenRatings); return createTeam(t, t, autoRoster(j), { season: s }); });
ligue[0].isPlayer = true;
const tonAlignement = { ...ligue[0].roster };
const avant = ligue.map(t => new Set(Object.values(t.roster).filter(Boolean)));
// Les joueurs triés par clé (V4.4) : le même effectif donne le même alignement, d'où qu'il vienne.
const attendus = ligue.map(t => trioAuMieux(Object.values(t.roster).filter(Boolean).sort((a, b) => (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1))));
creerLigue(ligue, 82, { graine: 'au-mieux' });
const memes = (t, k) => { const v = Object.values(t.roster).filter(Boolean); return v.length === avant[k].size && v.every(p => avant[k].has(p)); };
exiger('un club de l\'IA s\'aligne au mieux, avec les mêmes joueurs ; le tien ne bouge pas',
  ligue.slice(1).every((t, k) => memes(t, k + 1) && SLOTS.every(sl => t.roster[sl.i] === attendus[k + 1][sl.i]))
  && SLOTS.every(sl => ligue[0].roster[sl.i] === tonAlignement[sl.i]), `${ligue.length - 1} clubs`);
const monte = [];
for (const t of ligue.slice(1)) {
  const c1 = SLOTS.find(sl => sl.group === 'F' && sl.unit === 0 && sl.role === 'C');
  const blesse = t.roster[c1.i];
  t.injured = new Map([[blesse, 5]]);
  const lu = activeLineup(t), habilles = SLOTS.filter(sl => !sl.scratch).map(sl => lu[sl.i]).filter(Boolean);
  const v = p => getHiddenRatings(p).v;
  // Le remplaçant du centre : jamais un réserviste quand un meilleur joueur d'une ligne plus bas pouvait monter.
  const reserve = SLOTS.filter(sl => sl.scratch).map(sl => t.roster[sl.i]).filter(Boolean);
  const venu = lu[c1.i], deReserve = reserve.includes(venu);
  const plusBas = SLOTS.filter(sl => sl.group === 'F' && sl.unit > 0 && !sl.scratch).map(sl => t.roster[sl.i]);
  // Sans réserviste qui convient, le trou descend au 4e trio : c'est là que joue le rappel du club-école.
  const vides = SLOTS.filter(sl => !sl.scratch && !lu[sl.i]);
  monte.push(vides.every(sl => sl.group === 'F' && sl.unit === 3) && vides.length <= 1 && !habilles.includes(blesse) && new Set(habilles).size === habilles.length
    && (!deReserve || plusBas.every(p => v(p) - getPositionPenalty(p, c1) <= v(venu) - getPositionPenalty(venu, c1))));
  informer(`${t.name} sans ${blesse.n}`, `au centre du 1er trio : ${venu.n}${deReserve ? ' (réserviste)' : ''}`);
  t.injured = new Map();
}
exiger('un blessé de l\'IA : tout le monde monte, le trou descend au 4e trio, personne deux fois', monte.every(Boolean), `${monte.filter(Boolean).length}/${monte.length} clubs`);
verdict();
