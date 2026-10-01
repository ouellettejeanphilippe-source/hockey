/*
 * TOUS LES CHOIX EN SONT (1.0, oct.). JP, sur « Une classe dans le
 * vestiaire » : *s'assurer que tous les choix en sont vraiment* — « On reste
 * avec eux » donnait +4 % de précision pour rien, contre « Rien ne change ».
 * Personne ne prend la deuxième ; ce n'est pas un choix, c'est un clic.
 *
 * Pour chaque événement à options (les dilemmes, ceux de js/situations.js,
 * les séquences, les avant-matchs), une option GRATUITE — un effet sans prix,
 * sans pari, sans geste, sans plus tard — ne fait jamais face à :
 *   1. une option VIDE (« Rien ne change », ou aucun effet) ;
 *   2. une option qui ne fait QUE coûter (« Moindre mal », sans rien d'autre).
 * La forme est celle de l'écran (`formeDe`, js/gerant.js).
 */
import { MOMENTS, SEQUENCES, AVANT_GROS, JOURS_MOMENTS } from '../js/sim.js';
import { brancherMoments } from '../js/situations.js';
import { formeDe } from '../js/gerant.js';
import { exiger, informer, verdict } from './verdict.mjs';

brancherMoments(MOMENTS, JOURS_MOMENTS);

const CANAUX = ['volume', 'finition', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D', 'creation', 'lancers'];
const aDesEffets = o => !!(o.mutation || o.trou || CANAUX.some(k => o[k] != null && o[k] !== 1));
const vide = o => !!o.rien || (!aDesEffets(o) && !o.pari && !o.action && !o.ensuite && !o.enjeu);
const gratuite = o => !o.rien && !o.prix && !o.pari && !o.action && !o.ensuite && !o.enjeu && aDesEffets(o)
  && ['Cadeau', ''].includes(formeDe(o));
const queDuCout = o => formeDe(o) === 'Moindre mal' && !o.mutation && !o.pari && !o.action && !o.ensuite && !o.enjeu;

console.log('\n  TOUS LES CHOIX EN SONT\n');

const fautifs = [];
let n = 0;
for (const [cat, liste] of [['dilemme', MOMENTS], ['séquence', SEQUENCES], ['avant-match', AVANT_GROS]]) {
  for (const [cle, ev] of Object.entries(liste)) {
    n++;
    const os = ev.options || [];
    const g = os.filter(gratuite);
    if (!g.length) continue;
    for (const o of os) {
      if (g.includes(o)) continue;
      if (vide(o)) fautifs.push(`${cat} « ${ev.titre} » : « ${g[0].nom} » gratuit contre « ${o.nom} » qui ne fait rien`);
      else if (queDuCout(o)) fautifs.push(`${cat} « ${ev.titre} » : « ${g[0].nom} » gratuit contre « ${o.nom} » qui ne fait que coûter`);
    }
  }
}

informer('événements lus', `${n}`);
exiger('aucune option gratuite face à une option vide', !fautifs.some(f => /ne fait rien/.test(f)), fautifs.filter(f => /ne fait rien/.test(f)).join(' · '));
exiger('aucune option gratuite face à une option qui ne fait que coûter', !fautifs.some(f => /que coûter/.test(f)), fautifs.filter(f => /que coûter/.test(f)).join(' · '));

verdict();
