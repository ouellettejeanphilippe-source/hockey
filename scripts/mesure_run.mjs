/*
 * LA RUN EN CARTE, MESURÉE SUR SES ROBOTS (V28 ; docs/refonte-v28.md § 5, § 10 « Lire paie, sans gagner d'office »).
 *
 * Les robots (scripts/lib/run_robot.mjs) jouent la run entière par les fonctions du jeu (js/run.js) : le camp, la carte de
 * chaque acte, les matchs isolés du simulateur, les portes, le marché, le vestiaire, le rival en duel, les séries. Les mêmes
 * graines pour chacun : « premier », le robot du CHIFFRE (la meilleure cote, l'affiche la plus facile), le MALIN (la cote au
 * prix de l'espace, l'affiche haute quand son club la vaut, le plan du duel). On juge, à 32 graines ou plus :
 *
 *   le malin gagne la Coupe 4 à 12 fois sur 64 ; « premier », 2 fois au plus ; le malin plus souvent que le robot du chiffre ;
 *   sa première Coupe, en médiane, pas avant sa troisième run (JP, 7 nov.).
 *
 * *Tu peux exploser le jeu* (le devis demande une run du malin sur dix à 75 % de chance moyenne à l'acte III) se mesure et
 * s'imprime, sans se juger : depuis que le monde mêle toutes les années (JP, 11 nov. 2026), 5 à 8 % des runs y arrivent,
 * et aucun réglage essayé ne ramène 10 % sous le plafond qui mord (docs/decisions.md). Le critère reste ouvert au devis.
 *
 * La tranche 0 (10 nov. 2026) a mesuré le reste, qui ne se rejoue plus ici : l'ordre des trios n'est pas un choix (le
 * meilleur des 24 ordres, +0,6 point sur des dés tenus à l'écart), une signature vaut ≈ 2 points de chance sur un match, et
 * essayer un candidat au moteur ne lit que du bruit (docs/refonte-v28.md § 5, docs/decisions.md).
 *
 *   node scripts/mesure_run.mjs                    les trois robots, `GRAINES` graines (64), `FILS` processus (4)
 *   GRAINES=8 FILS=2 node scripts/mesure_run.mjs   l'essai court : les bornes s'impriment sans se juger
 *   ROBOTS=malin GRAINE0=64 …                      quelques robots, un autre jeu de graines
 *   REGLAGES='{"RACHAT":0.6}' …                    un réglage de js/run.js `RUN`, le temps d'une mesure
 * Mesure seulement : jamais lu par le jeu.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUN, chanceCeSoir } from '../js/run.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const GRAINES = Number(process.env.GRAINES ?? 64);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const JUGER = GRAINES >= 32;
/* Le pronostic d'un match de l'acte III : `N_CHANCE` matchs rejoués, comme la jauge de la feuille du soir. « Exploser le jeu » : `EXPLOSE` de moyenne. */
const N_CHANCE = 40, EXPLOSE = 0.75, PART_EXPLOSE = 0.1, RUN_DE_LA_COUPE = 3;
const ROBOTS = (process.env.ROBOTS || 'premier,chiffre,malin').split(',');
Object.assign(RUN, JSON.parse(process.env.REGLAGES || '{}'));

/* ---------- les processus ---------- */
if (process.env.BRAS) {
  const [robot, a, b] = process.env.BRAS.split(':');
  const res = [], g0 = Number(process.env.GRAINE0 ?? 0);
  for (let g = Number(a); g < Number(b); g++) {
    // La chance de chaque match de l'acte III, lue à la feuille du soir comme l'écran (le malin seulement : c'est lui qu'on juge).
    const iii = [];
    const espion = robot !== 'malin' ? undefined : (m, S) => { if (m === 'case' && S.R.phase === 'feuille' && S.R.acte === 2 && !S.R.series) { const c = chanceCeSoir(S, { n: N_CHANCE }); iii.push(c.v / c.n); } };
    res.push({ ...jouerLaRun(robot, g0 + g, espion ? { espion } : {}), R: undefined, iii });
  }
  process.stdout.write(JSON.stringify(res));
  process.exit(0);
}
const lancer = bras => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, BRAS: bras } });
  let txt = '';
  p.stdout.on('data', x => { txt += x; });
  p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', c => (c === 0 ? ok(JSON.parse(txt)) : ko(new Error(`le bras ${bras} a échoué (${c})`))));
});
async function enParallele(taches) {
  const res = new Array(taches.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => { while (i < taches.length) { const k = i++; res[k] = await taches[k](); } }));
  return res.flat();
}
const pas = Math.max(1, Math.ceil(GRAINES / FILS));
const tranches = robot => Array.from({ length: Math.ceil(GRAINES / pas) }, (_, k) => () => lancer(`${robot}:${k * pas}:${Math.min(GRAINES, (k + 1) * pas)}`));
const pct = x => `${Math.round(100 * x)} %`;
const moy = l => (l.length ? l.reduce((a, x) => a + x, 0) / l.length : 0);

const runs = await enParallele(ROBOTS.flatMap(tranches));
const de = r => runs.filter(x => x.robot === r);
const coupes = r => de(r).filter(x => x.coupe).length;
const sur64 = r => Math.round(coupes(r) * 64 / GRAINES);
const tenues = r => moy(de(r).flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0))));
for (const r of ROBOTS) {
  const l = de(r), causes = c => l.filter(x => x.fin && x.fin.cause === c).length;
  const parActe = [0, 1, 2].map(a => { const xs = l.filter(x => x.actes[a]); return `acte ${a + 1} ${pct(moy(xs.map(x => (x.actes[a].tenu ? 1 : 0))))} (${moy(xs.map(x => x.actes[a].pts)).toFixed(1)} pts)`; }).join(' · ');
  informer(`Le robot ${r}`, `${coupes(r)} Coupes sur ${l.length} · cibles tenues ${pct(tenues(r))} (${parActe}) · sans cœur ${causes('coeurs')} · sans séries ${causes('cible')} · série perdue ${causes('serie')} · ${moy(l.map(x => x.rondes)).toFixed(2)} ronde · ${moy(l.map(x => x.signatures)).toFixed(1)} signatures · force ${moy(l.map(x => x.forces[0])).toFixed(0)} → ${moy(l.map(x => x.forces.at(-1))).toFixed(0)} · ${moy(l.map(x => x.s)).toFixed(1)} s la run`);
}
if (JUGER) {
  if (ROBOTS.includes('malin')) borne('Les Coupes du malin, sur 64', sur64('malin'), 4, 12);
  if (ROBOTS.includes('premier')) borne('Les Coupes de « premier », sur 64', sur64('premier'), 0, 2);
  if (ROBOTS.includes('malin') && ROBOTS.includes('chiffre')) exiger('Lire paie : le malin gagne plus de Coupes que le robot du chiffre, sur les mêmes graines', coupes('malin') > coupes('chiffre'), `${coupes('malin')} contre ${coupes('chiffre')}`);
  if (ROBOTS.includes('malin')) {
    // La première Coupe, en médiane : les runs sont indépendantes (rien de la force ne suit d'une run à l'autre).
    const p = coupes('malin') / GRAINES, mediane = p > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - p)) : Infinity;
    exiger(`La première Coupe du malin, en médiane, pas avant la run ${RUN_DE_LA_COUPE}`, mediane >= RUN_DE_LA_COUPE, `à la run ${mediane} (${pct(p)} de Coupes par run)`);
    const fortes = de('malin').filter(x => x.iii.length && moy(x.iii) >= EXPLOSE).length;
    informer(`Tu peux exploser le jeu (le devis : une run du malin sur dix à ${pct(EXPLOSE)} de chance à l'acte III ; ouvert)`, `${fortes} runs sur ${GRAINES} (${pct(fortes / GRAINES)}, la cible ${pct(PART_EXPLOSE)}) ; l'acte III moyen à ${pct(moy(de('malin').filter(x => x.iii.length).map(x => moy(x.iii))))}`);
  }
} else {
  informer('L\'essai court', `${GRAINES} graines : Coupes ${ROBOTS.map(r => `${r} ${coupes(r)}`).join(', ')} ; les bornes ne se jugent qu'à 32 graines ou plus`);
}
verdict('La run en carte (V28)');
