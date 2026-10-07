/**
 * ALIGNER AU MIEUX (oct.) — le bouton de l'alignement fait ce qu'il dit.
 *
 *   node scripts/check_au_mieux.mjs
 *
 * JP : *ajouter bouton best lines et best strategy dans l'alignement pour éviter le gossage ; plusieurs best :
 * défensive, offensive*. Sur des vraies équipes, vérifie que :
 *   1. « Le meilleur » est l'alignement et les systèmes que l'IA se ferait (`autoRoster`, `lignesDe`) ;
 *   2. chaque style remplit les 23 cases, sans doublon, et garde tout le monde ;
 *   3. « Offensif » penche ses systèmes vers l'attaque, « Défensif » vers la défense — jamais l'inverse —, et
 *      aucun ne s'éloigne de plus de huit points de fit du meilleur système de la ligne.
 */
import { autoRoster, registerHiddenRatings, SLOTS, trioAuMieux, lignesAuMieux, lignesDe, getPersonKey, fitUnite, TACTIQUES, SYSTEMES_D } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const CLUBS = [['1995-96', 'DET'], ['1985-86', 'EDM'], ['2007-08', 'PIT'], ['1977-78', 'MTL'], ['2018-19', 'TBL'], ['1999-00', 'NJD']];
const net = (S, c) => Math.log(((S.gain && S.gain[c]) || 1) * ((S.prix && S.prix[c]) || 1));
const att = S => net(S, 'volume') + net(S, 'finition'), def = S => -net(S, 'defense');
const somme = (L, f) => L.reduce((a, l, u) => a + f(TACTIQUES[l.tac] || {}) + (u < 3 ? f(SYSTEMES_D[l.tacD] || {}) : 0), 0);

console.log('\n  ALIGNER AU MIEUX\n');
const pareil = [], complets = [], penche = [], proches = [];
for (const [s, t] of CLUBS) {
  const joueurs = equipeReelle(s, t).flat().map(x => ({ ...x }));
  joueurs.forEach(registerHiddenRatings);
  const r = {}, L = {};
  for (const st of ['equilibre', 'offensif', 'defensif']) { r[st] = trioAuMieux(joueurs, st); L[st] = lignesAuMieux(r[st], st); }
  const ia = autoRoster(joueurs);
  pareil.push(SLOTS.every(sl => ia[sl.i] === r.equilibre[sl.i]) && JSON.stringify(L.equilibre) === JSON.stringify(lignesDe({}, r.equilibre)));
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
exiger('« Le meilleur » est ce que l\'IA se ferait', pareil.every(Boolean), `${pareil.filter(Boolean).length}/${pareil.length} clubs`);
exiger('chaque style remplit les 23 cases, sans doublon', complets.every(Boolean), `${complets.filter(Boolean).length}/${complets.length}`);
exiger('« Offensif » penche vers l\'attaque, « Défensif » vers la défense', penche.every(Boolean), `${penche.filter(Boolean).length}/${penche.length} clubs`);
exiger('aucun style ne s\'éloigne de plus de huit points de fit du meilleur système', proches.every(Boolean), `${proches.filter(Boolean).length}/${proches.length} unités`);
verdict();
