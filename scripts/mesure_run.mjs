/*
 * LA RUN EN CARTE, MESURÉE SUR SES ROBOTS (V28 ; docs/refonte-v28.md § 5, § 10 « Lire paie, sans gagner d'office »).
 *
 * Les robots (scripts/lib/run_robot.mjs) jouent la run entière par les fonctions du jeu (js/run.js) : le camp, la carte de
 * chaque acte, les matchs isolés du simulateur, les portes, le marché, le vestiaire, le rival en duel, les séries. Les mêmes
 * graines pour chacun : « premier », le robot du CHIFFRE (la meilleure cote, l'affiche la plus facile), le MALIN (la cote au
 * prix de l'espace, l'affiche haute quand son club est nettement plus fort, le plan du duel, le banc lu). On juge, à 32
 * graines ou plus :
 *
 *   le malin gagne la Coupe 4 à 12 fois sur 64 ; « premier », 2 fois au plus ; lire ne coûte pas (le robot du chiffre ne
 *   gagne pas nettement plus que le malin, en paires) ; sa première Coupe, en médiane, pas avant sa troisième run (JP, 7 nov.) ;
 *   les galons d'une run courte (tranche 5b) : chaque sorte gravée dans 5 à 85 % des runs du malin, 4 à 14 galons par run.
 *
 * *Lire paie* et *tu peux exploser le jeu* se jugent à `GRAND` graines (384), à la main : à 64 graines leur bruit les
 * noie (JP, 11 nov. 2026, après la mesure de deux leviers, docs/decisions.md).
 *   — Lire paie : en paires, le robot qui lit tient plus de cibles que le robot du chiffre, au-delà de deux écarts-types.
 *     Mesuré sur 384 graines : 61 % contre 53 %, +7,8 points (bruit ±4,4). En Coupes, l'écart reste sous son bruit à cette
 *     taille (46 contre 35, bruit ±15) : le critère se juge en cibles tenues. À 64 graines, on exige seulement que lire ne
 *     coûte pas.
 *   — Tu peux exploser le jeu : 5 à 12 % des runs du malin jouent l'acte III à 75 % de chance moyenne. Le devis en
 *     demandait une sur dix ; mesuré, 6,5 % (25 sur 384), et JP l'accepte (« Accepter 7 % »).
 * Les deux leviers essayés pour faire mieux (le prix qui suit la valeur, moins de candidats par porte) ne séparaient pas
 * mieux les robots et faisaient reculer les runs qui explosent : écartés.
 *
 * La tranche 0 (10 nov. 2026) a mesuré le reste, qui ne se rejoue plus ici : l'ordre des trios n'est pas un choix (le
 * meilleur des 24 ordres, +0,6 point sur des dés tenus à l'écart), une signature vaut ≈ 2 points de chance sur un match, et
 * essayer un candidat au moteur ne lit que du bruit (docs/refonte-v28.md § 5, docs/decisions.md).
 *
 *   node scripts/mesure_run.mjs                    les trois robots, `GRAINES` graines (64), `FILS` processus (4)
 *   GRAINES=8 FILS=2 node scripts/mesure_run.mjs   l'essai court : les bornes s'impriment sans se juger
 *   ROBOTS=malin GRAINE0=64 …                      quelques robots, un autre jeu de graines
 *   GRAINES=384 FILS=3 ROBOTS=malin,chiffre …      « lire paie » et « exploser le jeu », jugés (une douzaine de minutes)
 *   REGLAGES='{"RACHAT":0.6}' …                    un réglage de js/run.js `RUN`, le temps d'une mesure
 *   CRANS=1 GRAINES=128 FILS=3 …                   les exigences (js/rogue.js `EXIGENCES`) : le malin à chaque cran, sur les
 *                                                  mêmes graines — chaque cran doit COÛTER (la part des cibles tenues baisse
 *                                                  d'un cran au suivant ; jugé à 128 graines ou plus, six minutes sur trois fils)
 * Mesure seulement : jamais lu par le jeu.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUN, chanceCeSoir } from '../js/run.js';
import { EXIGENCES } from '../js/rogue.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const GRAINES = Number(process.env.GRAINES ?? 64);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const JUGER = GRAINES >= 32, GRAND = 384;
/* Le pronostic d'un match de l'acte III : `N_CHANCE` matchs rejoués, comme la jauge de la feuille du soir. « Exploser le jeu » : `EXPLOSE` de moyenne. */
const N_CHANCE = 40, EXPLOSE = 0.75, PART_EXPLOSE = [5, 12], RUN_DE_LA_COUPE = 3;
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
    const exigence = Number(process.env.EXIGENCE ?? 0);
    const r = jouerLaRun(robot, g0 + g, { exigence, ...(espion ? { espion } : {}) });
    res.push({ ...r, R: undefined, iii, exigence, galons: (r.R.galons || []).map(x => x.type) });
  }
  process.stdout.write(JSON.stringify(res));
  process.exit(0);
}
const lancer = (bras, exigence = 0) => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, BRAS: bras, EXIGENCE: String(exigence) } });
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
const tranches = (robot, exigence = 0) => Array.from({ length: Math.ceil(GRAINES / pas) }, (_, k) => () => lancer(`${robot}:${k * pas}:${Math.min(GRAINES, (k + 1) * pas)}`, exigence));
const pct = x => `${Math.round(100 * x)} %`;
const moy = l => (l.length ? l.reduce((a, x) => a + x, 0) / l.length : 0);

/*
 * LES CRANS D'EXIGENCE (V28, tranche 5, docs/refonte-v28-5.md § 3.4) : le malin à chaque cran, sur les mêmes graines. Un
 * cran qui ne coûte rien serait une prime gratuite (15 % de médailles de plus) : la part des cibles tenues doit baisser
 * d'un cran au suivant. Mesuré le 11 nov. 2026 sur 128 graines : 59 %, 51 %, 46 %, 33 % ; 61, 64, 65 et 58 médailles par run.
 */
if (process.env.CRANS) {
  const tous = await enParallele(EXIGENCES.map((_, k) => k).concat(EXIGENCES.length).flatMap(n => tranches('malin', n)));
  const parts = [];
  for (let n = 0; n <= EXIGENCES.length; n++) {
    const l = tous.filter(x => x.exigence === n), part = moy(l.flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0))));
    parts.push(part);
    informer(n ? `Cran ${n} · ${EXIGENCES[n - 1].nom}` : 'Sans exigence', `cibles tenues ${pct(part)} · ${l.filter(x => x.coupe).length} Coupes sur ${l.length} · sans cœur ${l.filter(x => x.fin && x.fin.cause === 'coeurs').length} · ${moy(l.map(x => x.fin ? x.fin.medailles : 0)).toFixed(0)} médailles par run`);
  }
  if (GRAINES >= 128) {
    exiger('chaque cran coûte : la part des cibles tenues baisse d\'un cran au suivant', parts.every((x, k) => k === 0 || x < parts[k - 1]), parts.map(pct).join(' → '));
    exiger('le dernier cran reste jouable : une cible sur cinq tenue, au moins', parts[parts.length - 1] >= 0.2, pct(parts[parts.length - 1]));
  } else informer('L\'essai court', `${GRAINES} graines : ${parts.map(pct).join(' → ')} ; les crans ne se jugent qu'à 128 graines ou plus`);
  verdict('Les crans d\'exigence (V28, tranche 5)');
  process.exit(process.exitCode || 0);
}
const runs = await enParallele(ROBOTS.flatMap(r => tranches(r)));
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
  if (ROBOTS.includes('malin') && ROBOTS.includes('chiffre')) {
    // LIRE, EN PAIRES : la même graine, les deux robots. L'écart en Coupes et son bruit (deux écarts-types de la somme des
    // paires). « Le malin en gagne plus » se jugeait d'une simple inégalité : à 64 graines, c'était pile ou face (8 contre 7
    // le 11 nov. au matin, 6 contre 8 le soir, sans que le jeu ait changé de nature). On exige ce qui se mesure : lire ne
    // COÛTE pas ; « lire paie » s'imprime, et reste ouvert au devis tant que l'écart est sous le bruit.
    const d = de('malin').map(m => { const c = de('chiffre').find(x => x.graine === m.graine); return c ? (m.coupe ? 1 : 0) - (c.coupe ? 1 : 0) : null; }).filter(x => x !== null);
    const ecart = d.reduce((a, x) => a + x, 0), m = ecart / d.length, bruit = 2 * Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) * d.length / Math.max(1, d.length - 1));
    const mot = `${coupes('malin')} Coupes contre ${coupes('chiffre')} : un écart de ${ecart > 0 ? '+' : ''}${ecart}, le bruit à ±${bruit.toFixed(1)}`;
    exiger('Lire ne coûte pas : le robot du chiffre ne gagne pas nettement plus de Coupes que le malin, sur les mêmes graines', ecart > -bruit, mot);
    // LIRE PAIE, en cibles tenues : par graine, la part des actes dont le malin tient la cible moins celle du chiffre ; le
    // bruit, deux écarts-types de la moyenne. Jugé à `GRAND` graines ; en dessous, imprimé avec son bruit.
    const dT = de('malin').map(a => { const c = de('chiffre').find(x => x.graine === a.graine); return c ? moy(a.actes.map(y => (y.tenu ? 1 : 0))) - moy(c.actes.map(y => (y.tenu ? 1 : 0))) : null; }).filter(x => x !== null);
    const mT = moy(dT), bT = 2 * Math.sqrt(dT.reduce((a, x) => a + (x - mT) ** 2, 0) / Math.max(1, dT.length - 1) / dT.length);
    const motT = `cibles tenues ${pct(tenues('malin'))} contre ${pct(tenues('chiffre'))} : ${mT >= 0 ? '+' : ''}${(100 * mT).toFixed(1)} points en paires, le bruit à ±${(100 * bT).toFixed(1)}`;
    if (GRAINES >= GRAND) exiger('Lire paie : en paires, le robot qui lit tient plus de cibles que le robot du chiffre, au-delà du bruit', mT > bT, motT);
    else informer(`Lire paie (jugé à ${GRAND} graines)`, motT);
  }
  if (ROBOTS.includes('malin')) {
    // La première Coupe, en médiane : les runs sont indépendantes (rien de la force ne suit d'une run à l'autre).
    const p = coupes('malin') / GRAINES, mediane = p > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - p)) : Infinity;
    exiger(`La première Coupe du malin, en médiane, pas avant la run ${RUN_DE_LA_COUPE}`, mediane >= RUN_DE_LA_COUPE, `à la run ${mediane} (${pct(p)} de Coupes par run)`);
    // Les galons (tranche 5b) : chaque sorte se voit, aucune n'est de toutes les runs. La Coupe suit les Coupes, jugées plus haut.
    const sortes = ['chapeau', 'grandMatch', 'jeuBlanc', 'mur', 'dixButs', 'vingtPoints', 'bourreau'], l = de('malin');
    const part = t => l.filter(x => x.galons.includes(t)).length / l.length, parRun = moy(l.map(x => x.galons.length));
    exiger('Les galons : chaque sorte se grave dans 5 à 85 % des runs du malin', sortes.every(t => part(t) >= 0.05 && part(t) <= 0.85), sortes.map(t => `${t} ${pct(part(t))}`).join(' · '));
    borne('Les galons gravés par run du malin', Math.round(parRun * 10) / 10, 4, 14);
    const fortes = de('malin').filter(x => x.iii.length && moy(x.iii) >= EXPLOSE).length;
    const partFortes = Math.round(1000 * fortes / GRAINES) / 10;
    if (GRAINES >= GRAND) borne(`Tu peux exploser le jeu : la part des runs du malin à ${pct(EXPLOSE)} de chance à l'acte III, en %`, partFortes, ...PART_EXPLOSE);
    informer(`Tu peux exploser le jeu (${PART_EXPLOSE.join(' à ')} % des runs du malin, jugé à ${GRAND} graines)`, `${fortes} runs sur ${GRAINES} (${partFortes} %) ; l'acte III moyen à ${pct(moy(de('malin').filter(x => x.iii.length).map(x => moy(x.iii))))}`);
  }
} else {
  informer('L\'essai court', `${GRAINES} graines : Coupes ${ROBOTS.map(r => `${r} ${coupes(r)}`).join(', ')} ; les bornes ne se jugent qu'à 32 graines ou plus`);
}
verdict('La run en carte (V28)');
