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
import { patronsActifs } from '../js/banque.js';
import { patronALEchelon, etatDuPersonnel, decisionDeProlongation, reportDuPersonnel, prixDeProlongation } from '../js/echelons.js';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague } from '../js/sim.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

const R = ['commune', 'peu', 'rare'];
exiger('plus une carte est rare, plus son contrat dure', R.every((r, i) => !i || CONTRAT_JOURS[r] > CONTRAT_JOURS[R[i - 1]]), R.map(r => `${r} ${CONTRAT_JOURS[r]} j`).join(' · '));
exiger('aucun contrat ne couvre la saison seul ; une prolongation la couvre', R.every(r => CONTRAT_JOURS[r] < JOURS_DE_SAISON && 2 * CONTRAT_JOURS[r] >= JOURS_DE_SAISON));
exiger('prolonger coûte des jetons, plus pour une carte plus rare', R.every((r, i) => PRIX_PROLONGATION[r] > 0 && (!i || PRIX_PROLONGATION[r] > PRIX_PROLONGATION[R[i - 1]])), R.map(r => `${PRIX_PROLONGATION[r]} 🪙`).join(' · '));

const k = 'per_gerantEquipement';   // commune
const engage = [{ jour: 3, patron: patronALEchelon(k, {}) }];
const fin = finDuContrat({ cle: k, jour: 3 });
exiger('un contrat part du jour d\'engagement', fin === 3 + CONTRAT_JOURS.commune, `fin au jour ${fin}`);
exiger('en poste jusqu\'à son dernier jour, parti le lendemain', patronsActifs(engage, fin).length === 1 && patronsActifs(engage, fin + 1).length === 0);
exiger('au bout de la saison, il n\'est plus là s\'il est parti avant', patronsActifs(engage).length === 0);

const e = etatDuPersonnel(engage, 50, { joues: () => 10 })[0];
const pro = decisionDeProlongation(e);
const prolonge = [...engage, { jour: 60, ...pro }];
exiger('la prolongation coûte son prix en jetons et ajoute une durée', pro.gain === -PRIX_PROLONGATION.commune && prixDeProlongation(k) === PRIX_PROLONGATION.commune && finDuContrat(pro.patron, 60) === fin + CONTRAT_JOURS.commune);
exiger('prolongée, la carte remplace l\'autre, garde son jour de départ et son échelon', patronsActifs(prolonge, 150).length === 1 && patronsActifs(prolonge, 150)[0].depuis === 3 && patronsActifs(prolonge, 150)[0].echelon === 1);
exiger('prolongée une fois, elle mène la saison à terme', patronsActifs(prolonge).length === 1);
exiger('prolonger encore n\'a plus de sens : l\'état le dit', etatDuPersonnel(prolonge, 150, { joues: () => 0 })[0].prolongeable === false && e.prolongeable === true);
const rep = reportDuPersonnel(etatDuPersonnel(prolonge, 150, { joues: () => 40 })[0]);
exiger('la saison suivante, le contrat repart de zéro', finDuContrat({ ...rep, jour: 0 }) === CONTRAT_JOURS.commune && !rep.prolonge);

/* Le moteur : une saison, l'adjoint part au jour dit ; prolongé, il reste. */
const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); const T = createTeam(lab, t, autoRoster(ps), { season: sa }); T.isPlayer = true; return T; };
const jouer = decisions => { const t = TEMOINS.map(club); simulateLeague(t, 82, { graine: 'contrats', decisions: decisions.map(d => ({ ...d, equipe: 0 })) }); return t[0]; };
const sans = jouer(engage), avec = jouer(prolonge);
exiger('au bout de son contrat, l\'adjoint a quitté le club', !(sans.patrons || []).some(x => x.cle === k), `${(sans.patrons || []).length} adjoint en poste`);
exiger('prolongé, il finit la saison au club', (avec.patrons || []).some(x => x.cle === k && x.fin > JOURS_DE_SAISON));

verdict('Le contrat d\'un adjoint');
