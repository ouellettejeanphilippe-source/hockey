/**
 * ALIGNER AU MIEUX (oct.) — le bouton de l'alignement fait ce qu'il dit.
 *
 *   node scripts/check_au_mieux.mjs
 *
 * JP : *ajouter bouton best lines et best strategy dans l'alignement pour éviter le gossage ; plusieurs best :
 * défensive, offensive*. Sur des vraies équipes, vérifie que :
 *   1. « Le meilleur » voit plus loin que l'IA (`autoRoster`) — JP : *considérer positions, stratégie, etc.* : sur
 *      les buts d'un soir que le moteur joue (`chiffresDuSoir`, poste, côté, zone, minutes et systèmes compris), il ne
 *      fait jamais pire, et mieux en moyenne ; ses systèmes sont ceux que l'IA choisirait pour ces trios (`lignesDe`) ;
 *   2. chaque style remplit les 23 cases, sans doublon, et garde tout le monde ;
 *   3. « Offensif » penche ses systèmes vers l'attaque, « Défensif » vers la défense — jamais l'inverse —, et
 *      aucun ne s'éloigne de plus de huit points de fit du meilleur système de la ligne ;
 *   4. JP : *les équipes adverses aussi devraient optimiser leurs effectifs* : un club de l'IA s'aligne au mieux en
 *      entrant dans la ligue (`creerLigue`), les mêmes joueurs ; ton club n'est pas touché ;
 *   5. et quand un des siens manque, tout le monde monte : son centre du 1er trio blessé, la case prend le meilleur
 *      qui y convient (un joueur d'une ligne plus bas ou un réserviste), le trou descend au 4e trio, personne deux fois.
 */
import { autoRoster, registerHiddenRatings, SLOTS, createTeam, creerLigue, activeLineup, trioAuMieux, getHiddenRatings, getPositionPenalty, lignesAuMieux, lignesDe, getPersonKey, fitUnite, TACTIQUES, SYSTEMES_D } from '../js/sim.js';
import { alignementAuMieux, chiffresDuSoir } from '../js/impact.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const CLUBS = [['1995-96', 'DET'], ['1985-86', 'EDM'], ['2007-08', 'PIT'], ['1977-78', 'MTL'], ['2018-19', 'TBL'], ['1999-00', 'NJD']];
const net = (S, c) => Math.log(((S.gain && S.gain[c]) || 1) * ((S.prix && S.prix[c]) || 1));
const att = S => net(S, 'volume') + net(S, 'finition'), def = S => -net(S, 'defense');
const somme = (L, f) => L.reduce((a, l, u) => a + f(TACTIQUES[l.tac] || {}) + (u < 3 ? f(SYSTEMES_D[l.tacD] || {}) : 0), 0);

console.log('\n  ALIGNER AU MIEUX\n');
const pareil = [], gains = [], complets = [], penche = [], proches = [];
for (const [s, t] of CLUBS) {
  const joueurs = equipeReelle(s, t).flat().map(x => ({ ...x }));
  joueurs.forEach(registerHiddenRatings);
  const r = {}, L = {};
  for (const st of ['equilibre', 'offensif', 'defensif']) { r[st] = alignementAuMieux(joueurs, st); L[st] = lignesAuMieux(r[st], st); }
  const ia = autoRoster(joueurs);
  const ecart = R => { const m = chiffresDuSoir(createTeam('x', t, R, { season: s }), R); return m.butsPour - m.butsContre; };
  const pen = R => SLOTS.filter(sl => !sl.scratch && R[sl.i]).reduce((a, sl) => a + getPositionPenalty(R[sl.i], sl), 0);
  const [eIa, eMieux] = [ecart(ia), ecart(r.equilibre)];
  gains.push(eMieux - eIa);
  pareil.push(eMieux >= eIa - 1e-9 && JSON.stringify(L.equilibre) === JSON.stringify(lignesDe({}, r.equilibre)));
  informer(`${t} ${s} contre l'IA`, `différentiel par match ${eIa.toFixed(2)} → ${eMieux.toFixed(2)} · pénalités de poste ${pen(ia)} → ${pen(r.equilibre)}`);
  for (const st of Object.keys(r)) {
    const pris = Object.values(r[st]).filter(Boolean);
    complets.push(SLOTS.filter(sl => !sl.scratch && !sl.extra).every(sl => r[st][sl.i]) && new Set(pris.map(getPersonKey)).size === pris.length);
  }
  // Le penchant, sur les mêmes trios : les systèmes du style contre ceux du meilleur.
  const Lo = lignesAuMieux(r.equilibre, 'offensif'), Ld = lignesAuMieux(r.equilibre, 'defensif');
  penche.push(somme(Lo, att) >= somme(L.equilibre, att) - 1e-9 && somme(Ld, def) >= somme(L.equilibre, def) - 1e-9);
  for (const Ls of [Lo, Ld]) for (let u = 0; u < 4; u++) {
    proches.push(fitUnite(r.equilibre, 'F', u, Ls[u].tac) >= fitUnite(r.equilibre, 'F', u, L.equilibre[u].tac) - 8);
    if (u < 3) proches.push(fitUnite(r.equilibre, 'D', u, Ls[u].tacD) >= fitUnite(r.equilibre, 'D', u, L.equilibre[u].tacD) - 8);
  }
  informer(`${t} ${s}`, ['equilibre', 'offensif', 'defensif'].map(st => `${st} ${L[st].map(l => `${TACTIQUES[l.tac].ico}${SYSTEMES_D[l.tacD] && l.tacD !== 'hourra' ? SYSTEMES_D[l.tacD].ico : ''}`).join(' ')}`).join(' · '));
}
exiger('« Le meilleur » ne fait jamais pire que l\'IA, et garde ses systèmes', pareil.every(Boolean), `${pareil.filter(Boolean).length}/${pareil.length} clubs`);
borne('« Le meilleur » contre l\'IA, buts par match en moyenne', gains.reduce((a, x) => a + x, 0) / gains.length, 0.05, 1);
exiger('chaque style remplit les 23 cases, sans doublon', complets.every(Boolean), `${complets.filter(Boolean).length}/${complets.length}`);
exiger('« Offensif » penche vers l\'attaque, « Défensif » vers la défense', penche.every(Boolean), `${penche.filter(Boolean).length}/${penche.length} clubs`);
exiger('aucun style ne s\'éloigne de plus de huit points de fit du meilleur système', proches.every(Boolean), `${proches.filter(Boolean).length}/${proches.length} unités`);

// 4 et 5 : les clubs de l'IA.
const ligue = CLUBS.map(([s, t]) => { const j = equipeReelle(s, t).flat().map(x => ({ ...x })); j.forEach(registerHiddenRatings); return createTeam(t, t, autoRoster(j), { season: s }); });
ligue[0].isPlayer = true;
const tonAlignement = { ...ligue[0].roster };
const avant = ligue.map(t => new Set(Object.values(t.roster).filter(Boolean)));
const attendus = ligue.map(t => trioAuMieux(Object.values(t.roster).filter(Boolean)));
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
