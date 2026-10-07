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
import { MOMENTS, SEQUENCES, AVANT_GROS, JOURS_MOMENTS, ENTRACTES, entractesDu, pariDeDecision, facesDuPari, deDeMise, AJUSTEMENTS } from '../js/sim.js';
import { CARTES_MATCH } from '../js/combat.js';
import fs from 'node:fs';
import { brancherMoments } from '../js/situations.js';
import { REPONSES_VIE } from '../js/vie-gm.js';
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
for (const [cat, liste] of [['dilemme', MOMENTS], ['séquence', SEQUENCES], ['avant-match', AVANT_GROS], ['réponse', REPONSES_VIE]]) {
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

/*
 * 3. AUCUNE OPTION BATTUE SUR TOUT (1.0, oct.). JP, sur « Trois défaites de
 * suite » : « Garder le cap » (buts contre −5 %, gratuit) contre « Briser le
 * règlement » (buts contre −4 %, punitions et blessures en plus) — *le choix
 * deux et quatre... lol*. Une option qui fait moins sur chaque canal, et
 * pas plus ailleurs, n'est pas un choix. Les minutes (F, D), un pari, un
 * geste ou un changement de carte ne se comparent pas : on les laisse.
 */
const PLUS = ['volume', 'finition', 'creation', 'lancers'], MOINS = ['defense', 'discipline', 'blessure', 'energie'];
const comparable = o => !o.rien && !o.pari && !o.action && !o.ensuite && !o.enjeu && !o.mutation && !o.changeGardien && !o.F && !o.D && !o.incident;
const vecteur = o => [...PLUS.map(k => o[k] ?? 1), ...MOINS.map(k => -(o[k] ?? 1)), o.robustesse ?? 0, o.trou ? -1 : 0];
const domine = (y, x) => { const a = vecteur(y), b = vecteur(x); return a.every((v, i) => v >= b[i] - 1e-9) && a.some((v, i) => v > b[i] + 1e-9); };
const battues = [];
const groupes = [
  ...[['dilemme', MOMENTS], ['séquence', SEQUENCES], ['avant-match', AVANT_GROS], ['réponse', REPONSES_VIE]].flatMap(([cat, liste]) => Object.values(liste).map(ev => [`${cat} « ${ev.titre} »`, ev.options || []])),
  ...['derriere', 'egal', 'devant'].map(e => [`entracte (${e})`, [ENTRACTES.garder, ...entractesDu(e).map(c => ENTRACTES[c])]]),
];
for (const [nomG, os] of groupes) {
  const c = os.filter(comparable);
  for (const x of c) { const y = c.find(z => z !== x && domine(z, x)); if (y) battues.push(`${nomG} : « ${x.nom} » battue par « ${y.nom} »`); }
}

informer('événements lus', `${n}`);
exiger('aucune option gratuite face à une option vide', !fautifs.some(f => /ne fait rien/.test(f)), fautifs.filter(f => /ne fait rien/.test(f)).join(' · '));
exiger('aucune option gratuite face à une option qui ne fait que coûter', !fautifs.some(f => /que coûter/.test(f)), fautifs.filter(f => /que coûter/.test(f)).join(' · '));
exiger('aucune option battue sur tous les canaux par une autre du même choix', !battues.length, battues.join(' · '));

/*
 * 4. UN PARI SE JOUE AU DÉ (1.0, oct.). JP : *faire modal avec lancé de dé et réponse*. Chaque pari d'un
 * événement a une chance en sixièmes (« sur 4, 5 ou 6 », jamais une cote) ; le dé que l'écran montre est
 * celui que le moteur tranche (`pariDeDecision`) : une face de 1 à 6, gagnante si elle est parmi les plus
 * hautes, la même pour le même sel (la décision se rejoue), et sur mille sels la part gagnante tombe
 * sur ses faces.
 */
const paris = [['moment', MOMENTS], ['sequence', SEQUENCES], ['avant', AVANT_GROS], ['vie', REPONSES_VIE]].flatMap(([fam, liste]) =>
  Object.entries(liste).flatMap(([cle, ev]) => (ev.options || []).filter(o => o.pari).map(o => ({ fam, cle, o, titre: ev.titre }))));
const pasEnSixiemes = paris.filter(x => Math.abs(x.o.pari.chance * 6 - Math.round(x.o.pari.chance * 6)) > 1e-9 || facesDuPari(x.o.pari.chance) !== Math.round(x.o.pari.chance * 6));
const decisionDe = (x, sel) => (x.fam === 'avant' ? { jour: 30, avant: { cle: x.cle, choix: x.o.cle, joueurs: [] }, sel }
  : { jour: 30, moment: { famille: x.fam === 'sequence' ? 'sequence' : x.fam === 'vie' ? 'vie' : 'moment', cle: x.cle, choix: x.o.cle, joueurs: [] }, sel });
const fautesDe = [];
let ecartMax = 0;
for (const x of paris) {
  let gagnes = 0;
  for (let i = 0; i < 1000; i++) {
    const a = pariDeDecision(decisionDe(x, `s${i}`), 'graine-de'), b = pariDeDecision(decisionDe(x, `s${i}`), 'graine-de');
    if (!a) { fautesDe.push(`${x.titre} : aucun dé`); break; }
    if (!(a.face >= 1 && a.face <= 6) || a.gagne !== (a.face > 6 - a.faces) || a.faces !== facesDuPari(x.o.pari.chance)) { fautesDe.push(`${x.titre} : la face ${a.face} ne dit pas le verdict`); break; }
    if (a.face !== b.face || a.gagne !== b.gagne) { fautesDe.push(`${x.titre} : le même sel ne redonne pas le même dé`); break; }
    if (a.gagne) gagnes++;
  }
  ecartMax = Math.max(ecartMax, Math.abs(gagnes / 1000 - facesDuPari(x.o.pari.chance) / 6));
}
informer('paris d’événement', `${paris.length}, sur ${[...new Set(paris.map(x => facesDuPari(x.o.pari.chance)))].sort().join(', ')} face(s)`);
exiger('chaque pari a sa chance en sixièmes (des faces de dé)', !pasEnSixiemes.length, pasEnSixiemes.map(x => `${x.titre} : ${x.o.pari.chance}`).join(' · '));
exiger('le dé montre le verdict du moteur, et le même sel le redonne', !fautesDe.length, fautesDe.join(' · '));
exiger('sur mille sels, la part gagnante tombe sur ses faces', ecartMax < 0.05, `écart max ${ecartMax.toFixed(3)}`);

/*
 * UN SEUL DÉ (V2.2). Une carte de match, un ajustement de série, un dilemme : chaque pari se tranche par la face
 * d'un dé (`deDeMise`) et se dit en faces (« sur 4, 5 ou 6 »), jamais en « 🎲 50 % » ni en « 🎲 Pari » muet. Pour
 * une chance de k/6, la face tombe exactement comme l'ancienne mise (`h < chance`) : rien ne bouge en dessous.
 */
{
  const paris = [...Object.values(CARTES_MATCH).filter(C => C.pari).map(C => C.pari.chance), ...Object.values(AJUSTEMENTS).filter(A => A.pari).map(A => A.pari.chance)];
  const surDes = paris.every(c => Math.abs(c * 6 - Math.round(c * 6)) < 1e-9);
  exiger('chaque pari de carte et d\'ajustement tombe sur des faces entières', surDes, `${paris.length} paris`);
  let accord = 0;
  for (let k = 0; k < 1000; k++) { const h = (k + 0.5) / 1000; if (deDeMise(h, 0.5).gagne === (h < 0.5) && deDeMise(h, 2 / 6).gagne === (h < 2 / 6)) accord++; }
  exiger('la face du dé tombe comme la mise : rien ne bouge pour une chance de k/6', accord === 1000, `${accord}/1000`);
  const g = fs.readFileSync(new URL('../js/gerant.js', import.meta.url), 'utf8');
  exiger('l\'écran dit tout pari en faces, jamais en « 🎲 50 % » ni en « 🎲 Pari » muet', !/🎲 \$\{Math\.round\(C\.pari\.chance \* 100\)\} %/.test(g) && !/'🎲 Pari'/.test(g) && (g.match(/facesMot\(facesDuPari\(/g) || []).length >= 4);
}

verdict();
