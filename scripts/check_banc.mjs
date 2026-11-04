/*
 * TON BANC CE SOIR (V23, docs/refonte-v23.md § A) — ce qui s'allume au sommaire du soir est arrivé.
 *   node scripts/check_banc.mjs   (quelques secondes, dans tout.mjs)
 *
 * Une vraie saison (les vestiaires témoins, la graine fixe) : ton coach 🐝 monte au niveau 3 au jour 20, le mur et le
 * canonnier sont postés le même jour. Pour chaque feuille de ton club :
 *   1. chaque pouvoir à la feuille s'allume au banc, avec exactement ses périodes ;
 *   2. rien ne s'allume qui n'est pas à la feuille, et un pouvoir éteint est un pouvoir ouvert ;
 *   3. chaque adjoint en poste à la feuille est au banc, allumé, avec ce qui lui reste ; aucun autre ;
 *   4. la même graine rend le même banc ; un club sans coach-personnage n'a pas de banc ;
 *   5. le banc s'allume au sommaire (js/bilan.js), et le mouvement s'éteint pour qui le demande (style.css) ;
 *   6. la règle du coach (V23) s'allume les soirs où elle paie, la caisse les paie ; les salaires des adjoints sont ceux de la feuille ;
 *   7. à l'entracte du duel (V23 A2, `jusqua`), le banc n'allume que les périodes déjà jouées, la règle du coach attend la fin,
 *      et les deux entractes (saison, séries) le montrent sous les périodes.
 */
import fs from 'node:fs';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague } from '../js/sim.js';
import { SEUILS_NIVEAU, NIVEAU_DES_POUVOIRS, niveauDuPerso, POUVOIRS } from '../js/pouvoirs.js';
import { banc } from '../js/profil-style.js';
import { primesDuCoach, salairesDesAdjoints, chiffresDuSoirDe, PRIME_COACH_MAX } from '../js/rogue.js';
import { REGLES_DU_COACH } from '../js/coachs.js';
import { SALAIRE_NIV, ADJOINTS } from '../js/adjoints.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const VESTIAIRES = TEMOINS.map(([lab, s, t]) => [lab, s, t, equipeReelle(s, t)]);
const club = i => { const [lab, s, t, un] = VESTIAIRES[i]; const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(p), { season: s }); };
const DECISIONS = [
  { jour: 0, equipe: 0, coach: { cle: 'essaim', xp: 0, talents: [] } },
  { jour: 20, equipe: 0, xpCoach: SEUILS_NIVEAU[2] },
  { jour: 10, equipe: 0, embauche: { cle: 'mur' } }, { jour: 10, equipe: 0, embauche: { cle: 'canonnier' } },
  { jour: 20, equipe: 0, poste: { cle: 'mur' } }, { jour: 20, equipe: 0, poste: { cle: 'canonnier' } },
  // V23 : l'ancien arbitre, ★ Phénomène : son salaire (le niveau, plus le sien) se paie chaque match en poste.
  { jour: 90, equipe: 0, embauche: { cle: 'arbitre', niv: 5 } }, { jour: 91, equipe: 0, poste: { cle: 'arbitre' } },
];
let L_ = null;
const saison = () => {
  const t = VESTIAIRES.map((_, i) => club(i));
  const L = simulateLeague(t, 82, { graine: 'banc', decisions: DECISIONS.map(d => ({ ...d })) });
  const toi = t[0];
  L_ = L.ligue;
  const soirs = L.ligue.calendrier.flat().filter(m => m.feuille && (m.A === toi || m.B === toi))
    .map(m => ({ f: m.feuille, cote: m.A === toi ? 'A' : 'B', autre: m.A === toi ? m.B : m.A }));
  return { toi, soirs };
};

const { toi, soirs } = saison();
const L0 = L_;
const fautes = { pouvoirs: [], eteints: [], adjoints: [] };
let allumes = 0, adjointsVus = 0;
const niveau = niveauDuPerso({ ...toi.perso, xpSaison: toi.xpSaison || 0 });
soirs.forEach(({ f, cote }, n) => {
  const b = banc(toi, f);
  const notes = (f.pouvoirs || []).filter(x => x.cote === cote);
  // 1 et 2. Les pouvoirs : allumés ssi à la feuille, avec leurs périodes ; éteints, mais ouverts.
  for (const c of b.filter(x => x.genre === 'pouvoir')) {
    const p = POUVOIRS[toi.perso.cle].findIndex(P => P.nom === c.nom);
    const periodes = [...new Set(notes.filter(x => x.p === p).map(x => x.k))].sort((a, z) => a - z);
    if (c.joue !== (periodes.length > 0) || c.periodes.join() !== periodes.join()) fautes.pouvoirs.push(`soir ${n + 1} : ${c.nom} ${c.periodes.join('·')} contre ${periodes.join('·')}`);
    if (!c.joue && niveau < NIVEAU_DES_POUVOIRS[p]) fautes.eteints.push(`soir ${n + 1} : ${c.nom} pas ouvert`);
    if (c.joue) allumes++;
  }
  for (const x of notes) if (!b.some(c => c.genre === 'pouvoir' && c.joue && c.nom === x.nom)) fautes.pouvoirs.push(`soir ${n + 1} : ${x.nom} à la feuille, pas au banc`);
  // 3. Les adjoints : ceux de la feuille, allumés, avec ce qui leur reste.
  const feuilleAdj = (f.adjoints || []).filter(x => x.cote === cote);
  const bancAdj = b.filter(x => x.genre === 'adjoint');
  const dit = xs => xs.map(x => `${x.nom}:${x.reste}`).join(',');
  if (dit(feuilleAdj) !== dit(bancAdj) || bancAdj.some(x => !x.joue)) fautes.adjoints.push(`soir ${n + 1} : ${dit(bancAdj)} contre ${dit(feuilleAdj)}`);
  adjointsVus += bancAdj.length;
});
informer('la saison', `${soirs.length} soirs, ${allumes} pouvoirs allumés, ${adjointsVus} adjoints en poste au banc`);
exiger('1. chaque pouvoir à la feuille s\'allume au banc, avec exactement ses périodes', !fautes.pouvoirs.length && allumes > 0, fautes.pouvoirs.slice(0, 3).join(' ; ') || `${allumes} allumés`);
exiger('2. un pouvoir éteint au banc est un pouvoir ouvert', !fautes.eteints.length, fautes.eteints.slice(0, 3).join(' ; ') || `niveau ${niveau}`);
exiger('3. chaque adjoint en poste est au banc, allumé, avec ce qui lui reste', !fautes.adjoints.length && adjointsVus > 0, fautes.adjoints.slice(0, 3).join(' ; ') || `${adjointsVus} vus`);

// 6. V23 : la règle du coach s'allume le soir où elle paie ; la caisse paie exactement ces soirs (au plafond près) ; les
// salaires sont ceux de la feuille, et l'ancien arbitre ★ Phénomène coûte son niveau plus le sien.
const R = REGLES_DU_COACH[toi.perso.cle];
const tenus = soirs.filter(x => R.lit(chiffresDuSoirDe(x.f, x.cote))).length;
const regleAllumee = soirs.filter(x => (banc(toi, x.f).find(c => c.genre === 'regle') || {}).joue).length;
const prime = primesDuCoach(L0.calendrier, toi);
exiger('6. la règle du coach s\'allume au banc les soirs où elle paie, et la caisse les paie', regleAllumee === tenus && prime.total === Math.min(PRIME_COACH_MAX, tenus * R.jetons) && tenus > 0,
  `${R.dit} : ${tenus} soirs, ${prime.total} 🪙 (plafond ${PRIME_COACH_MAX})`);
const sal = salairesDesAdjoints(L0.calendrier, toi);
const salFeuilles = soirs.reduce((a, x) => a + (x.f.adjoints || []).filter(y => y.cote === x.cote).reduce((b, y) => b + (y.salaire || 0), 0), 0);
const arb = soirs.flatMap(x => (x.f.adjoints || []).filter(y => y.cote === x.cote && y.cle === 'arbitre'));
exiger('6. les adjoints se paient : la caisse déduit ce que la feuille dit, l\'arbitre ★ Phénomène coûte son niveau plus le sien', sal.total === salFeuilles && arb.length > 0 && arb.every(y => y.salaire === SALAIRE_NIV[4] + ADJOINTS.arbitre.salaire),
  `${sal.total} 🪙 sur la saison · l'arbitre ${arb.length} matchs à ${arb[0] ? arb[0].salaire : '—'} 🪙`);

// 4. Rejouable ; un club sans personnage n'a pas de banc.
const encore = saison();
const empreinte = s => s.soirs.map(x => banc(s.toi, x.f).map(c => `${c.nom}${c.joue ? '*' : ''}${c.periodes.join('')}${c.reste ?? ''}`).join('|')).join('/');
exiger('4. la même graine rend le même banc', empreinte(encore) === empreinte({ toi, soirs }), `${soirs.length} soirs`);
const sansPerso = soirs.find(x => !x.autre.perso);
exiger('4. un club sans coach-personnage n\'a pas de banc', !sansPerso || banc(sansPerso.autre, sansPerso.f).length === 0, sansPerso ? sansPerso.autre.name || 'adversaire' : 'aucun');

// 5. Branché au sommaire, et le mouvement s'éteint pour qui le demande.
const bilan = fs.readFileSync(new URL('../js/bilan.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const saisonJs = fs.readFileSync(new URL('../js/saison.js', import.meta.url), 'utf8');
exiger('5. le sommaire du soir montre le banc sous le pointage, et Hier soir au Bureau aussi', /\$\{bancDuSoirHtml\(f, A, B, esc\)\}\s*\$\{apres\}/.test(bilan) && /bancDuSoirHtml\(m\.feuille, m\.A, m\.B, ctx\.esc, \{ joues: true \}\)/.test(saisonJs));

// 7. V23 A2 : à l'entracte du duel, le banc n'allume que ce qui a déjà joué — jamais une période à venir, jamais la règle.
const fautes7 = [];
let allumesAvant = 0, eteintsAvant = 0;
soirs.forEach(({ f, cote }, n) => {
  const notes = (f.pouvoirs || []).filter(x => x.cote === cote);
  for (const k of [1, 2]) {
    const b = banc(toi, f, { jusqua: k });
    if (b.some(c => c.genre === 'regle')) fautes7.push(`soir ${n + 1} : la règle du coach au ${k}e entracte`);
    for (const c of b.filter(x => x.genre === 'pouvoir')) {
      if (c.periodes.some(x => x >= k)) fautes7.push(`soir ${n + 1} : ${c.nom} allumé pour une période à venir (${c.periodes.join('·')} au ${k}e entracte)`);
      const p = POUVOIRS[toi.perso.cle].findIndex(P => P.nom === c.nom);
      const vraies = [...new Set(notes.filter(x => x.p === p && x.k < k).map(x => x.k))].sort((a, z) => a - z);
      if (c.periodes.join() !== vraies.join()) fautes7.push(`soir ${n + 1} : ${c.nom} ${c.periodes.join('·')} contre ${vraies.join('·')} au ${k}e entracte`);
      if (c.joue) allumesAvant++;
      else if (notes.some(x => x.p === p)) eteintsAvant++;
    }
    const plein = banc(toi, f).filter(x => x.genre === 'adjoint').map(x => x.nom).join();
    if (b.filter(x => x.genre === 'adjoint').map(x => x.nom).join() !== plein) fautes7.push(`soir ${n + 1} : les adjoints ne sont pas les mêmes à l'entracte`);
  }
});
exiger('7. à l\'entracte, le banc allume exactement les périodes déjà jouées, sans la règle du coach, les mêmes adjoints', !fautes7.length && allumesAvant > 0 && eteintsAvant > 0,
  fautes7.slice(0, 3).join(' ; ') || `${allumesAvant} allumés avant l'entracte, ${eteintsAvant} qui attendaient encore leur période`);
exiger('7. les deux entractes du duel (saison, séries) montrent le banc sous les périodes', /bancDuSoirHtml\(f, p\.m\.A, p\.m\.B, ctx\.esc, \{ jusqua: k \}\)/.test(saisonJs) && /bancDuSoirHtml\(f, s\.A, s\.B, ctx\.esc, \{ jusqua: p \}\)/.test(saisonJs)
  && /\.ent2 \.banc \{/.test(css));
exiger('5. le banc s\'allume en animation, éteinte sous prefers-reduced-motion', /\.banc-carte\.joue \{[^}]*animation: banc-allume/.test(css)
  && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0\.01ms !important/.test(css));

verdict();
