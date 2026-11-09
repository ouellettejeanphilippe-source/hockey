/*
 * TON BANC CE SOIR (V23, docs/refonte-v23.md § A ; V27, tranche 5 : le banc de cinq) — ce qui s'allume au sommaire du soir
 * est arrivé.
 *   node scripts/check_banc.mjs   (quelques secondes, dans tout.mjs)
 *
 * Une vraie saison (les vestiaires témoins, la graine fixe) : ton coach 🐝 pose sa pièce de départ, puis le mur et le
 * canonnier entrent au jour 10, l'arbitre au jour 40. Pour chaque feuille de ton club :
 *   1. chaque pièce à la feuille (ou en relais) s'allume au banc, avec exactement ses périodes ;
 *   2. rien ne s'allume qui n'est pas à la feuille, et le banc montre les cases du soir (`feuille.banc`), allumées ou non ;
 *   3. aucun salaire : le banc ne coûte rien, la caisse ne déduit rien ;
 *   4. la même graine rend le même banc ; un club sans coach-personnage n'a pas de banc ;
 *   5. le banc s'allume au sommaire (js/bilan.js), et le mouvement s'éteint pour qui le demande (style.css) ;
 *   6. la règle du coach (V23) s'allume les soirs où elle paie, la caisse les paie (V27, tranche 6 : le duel n'a plus d'entracte à choix, le banc n'y paraît plus).
 */
import fs from 'node:fs';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague } from '../js/sim.js';
import { PIECES } from '../js/pieces.js';
import { banc } from '../js/profil-style.js';
import { primesDuCoach, chiffresDuSoirDe, PRIME_COACH_MAX } from '../js/rogue.js';
import { REGLES_DU_COACH } from '../js/coachs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const VESTIAIRES = TEMOINS.map(([lab, s, t]) => [lab, s, t, equipeReelle(s, t)]);
const club = i => { const [lab, s, t, un] = VESTIAIRES[i]; const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(p), { season: s }); };
const DECISIONS = [
  { jour: 0, equipe: 0, coach: { cle: 'essaim' } },
  { jour: 10, equipe: 0, piece: { cle: 'mur' } }, { jour: 10, equipe: 0, piece: { cle: 'canonnier' } }, { jour: 40, equipe: 0, piece: { cle: 'arbitre' } },
];
let L_ = null;
const saison = () => {
  const t = VESTIAIRES.map((_, i) => club(i));
  const L = simulateLeague(t, 82, { graine: 'banc', decisions: DECISIONS.map(d => ({ ...d })), courbe: true });
  const toi = t[0];
  L_ = L.ligue;
  const soirs = L.ligue.calendrier.flat().filter(m => m.feuille && (m.A === toi || m.B === toi))
    .map(m => ({ f: m.feuille, cote: m.A === toi ? 'A' : 'B', autre: m.A === toi ? m.B : m.A }));
  return { toi, soirs };
};

const { toi, soirs } = saison();
const L0 = L_;
const fautes = { allumes: [], cases: [] };
let allumes = 0, eteints = 0;
/* Les périodes où une pièce a joué ce soir-là, lues à la feuille : sa condition (`pieces`) ou son relais (`relais`). */
const periodesDe = (f, cote, cle, jusqua = 3) => [...new Set([...(f.pieces || []), ...(f.relais || [])].filter(x => x.cote === cote && x.cle === cle && x.k < jusqua).map(x => x.k))].sort((a, z) => a - z);
soirs.forEach(({ f, cote }, n) => {
  const b = banc(toi, f).filter(c => c.genre === 'piece');
  // 1 et 2. Chaque case du soir est au banc ; allumée ssi elle a joué, avec ses périodes.
  if (b.map(c => c.cle).join() !== (f.banc[cote] || []).join()) fautes.cases.push(`soir ${n + 1} : ${b.map(c => c.cle).join('·')} contre ${(f.banc[cote] || []).join('·')}`);
  for (const c of b) {
    const periodes = periodesDe(f, cote, c.cle);
    if (c.joue !== (periodes.length > 0) || c.periodes.join() !== periodes.join()) fautes.allumes.push(`soir ${n + 1} : ${c.nom} ${c.periodes.join('·')} contre ${periodes.join('·')}`);
    if (c.joue) allumes++; else eteints++;
  }
  for (const x of [...(f.pieces || []), ...(f.relais || [])].filter(y => y.cote === cote)) if (!b.some(c => c.joue && c.cle === x.cle)) fautes.allumes.push(`soir ${n + 1} : ${x.nom} à la feuille, pas au banc`);
});
informer('la saison', `${soirs.length} soirs, ${allumes} pièces allumées, ${eteints} au banc sans jouer`);
exiger('1. chaque pièce à la feuille (ou en relais) s\'allume au banc, avec exactement ses périodes', !fautes.allumes.length && allumes > 0, fautes.allumes.slice(0, 3).join(' ; ') || `${allumes} allumées`);
exiger('2. le banc montre les cases du soir, allumées ou non', !fautes.cases.length && eteints > 0 && soirs.at(-1).f.banc[soirs.at(-1).cote].join() === 'ruee,mur,canonnier,arbitre',
  fautes.cases.slice(0, 3).join(' ; ') || soirs.at(-1).f.banc[soirs.at(-1).cote].map(k => PIECES[k].ico).join(' '));
// 3. Le banc ne se paie pas : la feuille ne porte plus d'adjoints à salaire.
exiger('3. le banc ne coûte rien : aucune feuille ne porte un salaire', soirs.every(x => !('adjoints' in x.f)), `${soirs.length} feuilles`);

// 6. V23 : la règle du coach s'allume le soir où elle paie ; la caisse paie exactement ces soirs (au plafond près).
const R = REGLES_DU_COACH[toi.perso.cle];
const tenus = soirs.filter(x => R.lit(chiffresDuSoirDe(x.f, x.cote))).length;
const regleAllumee = soirs.filter(x => (banc(toi, x.f).find(c => c.genre === 'regle') || {}).joue).length;
const prime = primesDuCoach(L0.calendrier, toi);
exiger('6. la règle du coach s\'allume au banc les soirs où elle paie, et la caisse les paie', regleAllumee === tenus && prime.total === Math.min(PRIME_COACH_MAX, tenus * R.jetons) && tenus > 0,
  `${R.dit} : ${tenus} soirs, ${prime.total} 🪙 (plafond ${PRIME_COACH_MAX})`);

// 4. Rejouable ; un club sans personnage n'a pas de banc.
const encore = saison();
const empreinte = s => s.soirs.map(x => banc(s.toi, x.f).map(c => `${c.nom}${c.joue ? '*' : ''}${c.periodes.join('')}`).join('|')).join('/');
exiger('4. la même graine rend le même banc', empreinte(encore) === empreinte({ toi, soirs }), `${soirs.length} soirs`);
const sansPerso = soirs.find(x => !x.autre.perso);
exiger('4. un club sans coach-personnage n\'a pas de banc', !sansPerso || banc(sansPerso.autre, sansPerso.f).length === 0, sansPerso ? sansPerso.autre.name || 'adversaire' : 'aucun');

// 5. Branché au sommaire, et le mouvement s'éteint pour qui le demande.
const bilan = fs.readFileSync(new URL('../js/bilan.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const saisonJs = fs.readFileSync(new URL('../js/saison.js', import.meta.url), 'utf8');
exiger('5. le sommaire du soir montre le banc sous le pointage, et Hier soir au Bureau aussi', /\$\{bancDuSoirHtml\(f, A, B, esc\)\}\s*\$\{apres\}/.test(bilan) && /bancDuSoirHtml\(m\.feuille, m\.A, m\.B, ctx\.esc, \{ joues: true \}\)/.test(saisonJs));

exiger('5. le banc s\'allume en animation, éteinte sous prefers-reduced-motion', /\.banc-carte\.joue \{[^}]*animation: banc-allume/.test(css)
  && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0\.01ms !important/.test(css));

verdict();
