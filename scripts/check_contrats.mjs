/*
 * LE CONTRAT D'UN ADJOINT (V19 ; JP : *matchs max avant de devoir payer pour étendre*). Un adjoint est engagé pour
 * `CONTRAT_JOURS[sa rareté]` jours de la saison, puis il part ; la prolongation, en jetons, ajoute une durée de plus.
 *   1. les durées : plus la carte est rare, plus elle dure ; aucune ne couvre la saison seule, une prolongation la couvre ;
 *   2. la lecture des décisions (`patronsActifs`) : en poste jusqu'à son dernier jour, parti le lendemain, et au bout de la
 *      saison (les séries) seulement s'il l'a menée à terme ;
 *   3. la prolongation : une décision qui remplace la carte, un cran de contrat de plus, et son prix en jetons ;
 *   4. le moteur : l'adjoint part au jour dit (son protégé avec lui), la prolongation le garde, la saison suivante repart de zéro.
 */
import { CONTRAT_JOURS, PRIX_PROLONGATION, JOURS_DE_SAISON, finDuContrat } from '../js/personnel.js';
import { patronsActifs, buildDe, palierAllume, BANQUE } from '../js/banque.js';
import { effetDePalier } from '../js/coachs.js';
import { patronALEchelon, etatDuPersonnel, decisionDeProlongation, reportDuPersonnel, prixDeProlongation } from '../js/echelons.js';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague } from '../js/sim.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

const R = ['commune', 'peu', 'rare'];
exiger('plus une carte est rare, plus son contrat dure', R.every((r, i) => !i || CONTRAT_JOURS[r] > CONTRAT_JOURS[R[i - 1]]), R.map(r => `${r} ${CONTRAT_JOURS[r]} j`).join(' · '));
const fenetres = r => Math.ceil(JOURS_DE_SAISON / CONTRAT_JOURS[r]);
exiger('des contrats courts : deux à cinq par saison selon la rareté', R.every(r => fenetres(r) >= 2 && fenetres(r) <= 5), R.map(r => `${r} ${fenetres(r)}`).join(' · '));
exiger('couvrir toute la saison coûte à peu près le même prix, quelle que soit la rareté choisie', R.every(r => (fenetres(r) - 1) * PRIX_PROLONGATION[r] <= 40));
exiger('prolonger coûte des jetons, plus pour une carte plus rare', R.every((r, i) => PRIX_PROLONGATION[r] > 0 && (!i || PRIX_PROLONGATION[r] > PRIX_PROLONGATION[R[i - 1]])), R.map(r => `${PRIX_PROLONGATION[r]} 🪙`).join(' · '));

const k = 'per_gerantEquipement';   // commune
const engage = [{ jour: 3, patron: patronALEchelon(k, {}) }];
const fin = finDuContrat({ cle: k, jour: 3 });
exiger('un contrat part du jour d\'engagement', fin === 3 + CONTRAT_JOURS.commune, `fin au jour ${fin}`);
exiger('en poste jusqu\'à son dernier jour, parti le lendemain', patronsActifs(engage, fin).length === 1 && patronsActifs(engage, fin + 1).length === 0);
exiger('au bout de la saison, il n\'est plus là s\'il est parti avant', patronsActifs(engage).length === 0);

const e = etatDuPersonnel(engage, 40, { joues: () => 10 })[0];
const pro = decisionDeProlongation(e);
const prolonge = [...engage, { jour: 40, ...pro }];
exiger('la prolongation coûte son prix en jetons et ajoute une durée', pro.gain === -PRIX_PROLONGATION.commune && prixDeProlongation(k) === PRIX_PROLONGATION.commune && finDuContrat(pro.patron, 40) === fin + CONTRAT_JOURS.commune);
exiger('prolongée, la carte remplace l\'autre, garde son jour de départ et son échelon', patronsActifs(prolonge, 90).length === 1 && patronsActifs(prolonge, 90)[0].depuis === 3 && patronsActifs(prolonge, 90)[0].echelon === 1);
// Prolongée assez de fois (une par fenêtre de moins), elle mène la saison à terme et joue les séries.
const toutes = Array.from({ length: fenetres('commune') - 1 }).reduce(decs => { const x = etatDuPersonnel(decs, decs.at(-1).jour + 1, { joues: () => 0 })[0]; return [...decs, { jour: decs.at(-1).jour + 1, ...decisionDeProlongation(x) }]; }, engage);
exiger('prolongée à chaque fenêtre, elle mène la saison à terme', patronsActifs(toutes).length === 1 && etatDuPersonnel(toutes, 60, { joues: () => 0 })[0].prolongeable === false && e.prolongeable === true, `${toutes.length - 1} prolongations`);
const rep = reportDuPersonnel(etatDuPersonnel(prolonge, 60, { joues: () => 40 })[0]);
exiger('la saison suivante, le contrat repart de zéro', finDuContrat({ ...rep, jour: 0 }) === CONTRAT_JOURS.commune && !rep.prolonge);

/* La confiance du coach suit les contrats : un adjoint de sa couleur compte tant qu'il est en poste, et la décision d'un jour se juge à ce jour-là. */
{
  const T = Object.keys(BANQUE).find(id => id.startsWith('patron:') && BANQUE[id].coach === 'tortue' && BANQUE[id].rarete === 'commune');
  const base = [{ jour: 0, coachsDeBase: { tortue: 6 }, coach: effetDePalier('tortue', 1) }];
  const d = { jour: 10, patron: patronALEchelon(BANQUE[T].cle, {}) }, decs = [...base, d];
  const fin = finDuContrat({ cle: BANQUE[T].cle, jour: 10 });
  exiger('un adjoint de sa couleur compte pour la confiance tant que son contrat dure, plus après', buildDe(decs, 30).tortue === buildDe(base, 30).tortue + 1 && buildDe(decs, fin + 1).tortue === buildDe(base, 30).tortue, `${buildDe(decs, 30).tortue} → ${buildDe(decs, fin + 1).tortue} points`);
  const a = palierAllume(base, { ...d, jour: 10 });
  exiger('la décision d\'engagement recompte la confiance à son jour, pas au bout de la saison', (a ? a.coach.palier : 1) >= 1 && Number.isFinite(d.jour));
}

/* Le moteur : une saison, l'adjoint part au jour dit ; prolongé, il reste. */
const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); const T = createTeam(lab, t, autoRoster(ps), { season: sa }); T.isPlayer = true; return T; };
const jouer = decisions => { const t = TEMOINS.map(club); simulateLeague(t, 82, { graine: 'contrats', decisions: decisions.map(d => ({ ...d, equipe: 0 })) }); return t[0]; };
const toutLeLong = [{ jour: 3, patron: patronALEchelon(k, { prolonge: fenetres('commune') - 1 }) }];
const sans = jouer(engage), avec = jouer(toutLeLong);
exiger('au bout de son contrat, l\'adjoint a quitté le club', !(sans.patrons || []).some(x => x.cle === k), `${(sans.patrons || []).length} adjoint en poste`);
exiger('prolongé, il finit la saison au club', (avec.patrons || []).some(x => x.cle === k && x.fin > JOURS_DE_SAISON));

/* Son protégé : il part avec l'adjoint, et reste tant que le contrat est prolongé. */
{
  const q = 'per_maitreRuban';   // protégé : sa meilleure gâchette, à domicile
  const marque = t => Object.values(t.roster || {}).filter(p => p && (p._mutCles || []).includes(q)).length;
  const pose = patron => [{ jour: 3, patron, mutation: { cle: q, saison: true } }];
  const parti = jouer(pose(patronALEchelon(q, {}))), reste = jouer(pose(patronALEchelon(q, { prolonge: fenetres('commune') - 1 })));
  exiger('son contrat fini, l\'adjoint part et son protégé perd ce que l\'adjoint lui donnait', !(parti.patrons || []).some(x => x.cle === q) && marque(parti) === 0, `${marque(parti)} joueur(s) marqué(s)`);
  exiger('prolongé, l\'adjoint garde son protégé', (reste.patrons || []).some(x => x.cle === q) && marque(reste) === 1, `${marque(reste)} joueur(s) marqué(s)`);
}

verdict('Le contrat d\'un adjoint');
