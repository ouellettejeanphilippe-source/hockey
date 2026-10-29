/*
 * LE BANC OUVERT (V20, docs/refonte-v20.md § 2 ; JP : *au lieu de trois fenêtres, possibilité en tout temps de remplacer,
 * mais prix pour embauche sauf début de saison*). Plus de contrat : un adjoint reste à sa chaise tant qu'on ne le
 * remplace pas.
 *   1. l'embauche : gratuite au camp (aucun match de ton club joué), puis `PRIX_EMBAUCHE` selon la rareté ;
 *   2. la lecture des décisions (`patronsActifs`) : en poste du jour de son engagement jusqu'au bout de la saison, séries
 *      comprises, à moins qu'un autre prenne sa chaise ;
 *   3. les échelons : achetés quand on veut, au prix de `PRIX_ECHELON` ; un doublon en paie un (`echelonsGratuits`) ;
 *   4. le moteur : l'adjoint et son protégé sont encore là au bout de la saison ;
 *   5. la confiance du coach ne compte pas ses adjoints (V20, le chiffre seul).
 */
import { PRIX_EMBAUCHE, prixDEmbauche } from '../js/personnel.js';
import { patronsActifs, buildDe, BANQUE, PATRONS } from '../js/banque.js';
import { effetDePalier } from '../js/coachs.js';
import { patronALEchelon, etatDuPersonnel, decisionDEchelon, reportDuPersonnel, echelonsGratuits, PRIX_ECHELON, ECHELON_MAX } from '../js/echelons.js';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague } from '../js/sim.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

/* 1. L'embauche. */
const R = ['commune', 'peu', 'rare'];
exiger('engager en saison coûte des jetons, plus pour une carte plus rare', R.every((r, i) => PRIX_EMBAUCHE[r] > 0 && (!i || PRIX_EMBAUCHE[r] > PRIX_EMBAUCHE[R[i - 1]])), R.map(r => `${r} ${PRIX_EMBAUCHE[r]} 🪙`).join(' · '));
const k = 'per_gerantEquipement';   // commune
exiger('au camp, avant le premier match de ton club, engager est gratuit', prixDEmbauche(k, 0) === 0 && prixDEmbauche(k, 1) === PRIX_EMBAUCHE.commune && prixDEmbauche('per_sergent', 30) === PRIX_EMBAUCHE[PATRONS.per_sergent.rarete]);

/* 2. En poste jusqu'au bout, à moins d'être remplacé. */
const engage = [{ jour: 3, patron: patronALEchelon(k, {}) }];
exiger('en poste dès son jour d\'engagement, jusqu\'au bout de la saison (les séries comprises)', patronsActifs(engage, 3).length === 0 && patronsActifs(engage, 4).length === 1 && patronsActifs(engage, 186).length === 1 && patronsActifs(engage).length === 1);
const meme = Object.keys(PATRONS).find(c => c !== k && PATRONS[c].role === PATRONS[k].role);
const remplace = [...engage, { jour: 50, patron: patronALEchelon(meme, {}) }];
exiger('un autre adjoint à sa chaise le remplace', patronsActifs(remplace, 51).map(p => p.cle).join() === meme && patronsActifs(remplace, 40).map(p => p.cle).join() === k, `${PATRONS[k].nom} → ${PATRONS[meme].nom}`);

/* 3. Les échelons, quand on veut ; un doublon en paie un. */
{
  const e1 = etatDuPersonnel(engage, 10, { copies: () => 1 })[0], e2 = etatDuPersonnel(engage, 10, { copies: () => 2 })[0];
  exiger('un échelon s\'achète dès l\'engagement, sans matchs à attendre', e1.aChoisir && e1.prix === PRIX_ECHELON[2] && !e1.gratuit, `${e1.prix} 🪙`);
  exiger('un doublon paie l\'échelon suivant', e2.gratuit && e2.prix === 0 && !('gain' in decisionDEchelon(e2, 'force')) && decisionDEchelon(e1, 'force').gain === -PRIX_ECHELON[2]);
  exiger('les doublons paient un échelon chacun, deux au plus', [1, 2, 3, 4].map(echelonsGratuits).join() === '0,1,2,2');
  const monte = [...engage, { jour: 10, ...decisionDEchelon(e2, 'force') }];
  const e3 = etatDuPersonnel(monte, 20, { copies: () => 2 })[0];
  exiger('le doublon dépensé, l\'échelon d\'après se paie', e3.echelon === 2 && !e3.gratuit && e3.prix === PRIX_ECHELON[3]);
  const haut = etatDuPersonnel([{ jour: 0, patron: patronALEchelon(k, { choix: ['force', 'defaut'] }) }], 20)[0];
  exiger(`au ${ECHELON_MAX}e échelon, plus rien à acheter`, haut.echelon === ECHELON_MAX && !haut.aChoisir);
  exiger('la saison suivante, il garde son échelon et ses choix', JSON.stringify(reportDuPersonnel(e3).choix) === '["force"]' && reportDuPersonnel(e3).echelon === 2);
}

/* 4. Le moteur : l'adjoint et son protégé sont là au bout de la saison. */
const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); const T = createTeam(lab, t, autoRoster(ps), { season: sa }); T.isPlayer = true; return T; };
const jouer = decisions => { const t = TEMOINS.map(club); simulateLeague(t, 82, { graine: 'banc', decisions: decisions.map(d => ({ ...d, equipe: 0 })) }); return t[0]; };
{
  const q = 'per_maitreRuban';   // protégé : sa meilleure gâchette
  const marque = t => Object.values(t.roster || {}).filter(p => p && (p._mutCles || []).includes(q)).length;
  const fin = jouer([{ jour: 3, patron: patronALEchelon(q, {}), mutation: { cle: q, saison: true } }]);
  exiger('au bout de la saison, l\'adjoint est encore en poste, et son protégé marqué', (fin.patrons || []).some(x => x.cle === q) && marque(fin) === 1, `${marque(fin)} joueur(s) marqué(s)`);
}

/* 5. La confiance ne suit pas les adjoints (V20 : le chiffre seul, js/chiffre.js). */
{
  const T = Object.keys(BANQUE).find(id => id.startsWith('patron:') && BANQUE[id].coach === 'tortue' && BANQUE[id].rarete === 'commune');
  const base = [{ jour: 0, coachsDeBase: { tortue: 6 }, coach: effetDePalier('tortue', 1) }];
  const decs = [...base, { jour: 10, patron: patronALEchelon(BANQUE[T].cle, {}) }];
  exiger('un adjoint de sa couleur ne compte pas pour la confiance', buildDe(decs, 30).tortue === buildDe(base, 30).tortue, `${buildDe(decs, 30).tortue} points`);
}

verdict('Le banc ouvert');
