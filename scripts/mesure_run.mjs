/*
 * LA RUN EN CARTE, MESURÉE SUR SES ROBOTS (V28, docs/refonte-v28.md § 5 ; V29, docs/refonte-v29.md § 9 : le build décide).
 *
 * Les robots (scripts/lib/run_robot.mjs) jouent la run entière par les fonctions du jeu (js/run.js) : le camp et ses
 * pièces, la carte de chaque acte, les matchs isolés du simulateur, les portes et leurs relances, le marché, le vestiaire,
 * le rival en duel, les séries. Les mêmes graines pour chacun : « premier », le robot du CHIFFRE (la meilleure cote), le
 * MALIN (le bâtisseur : il lit son banc aux portes) et son TÉMOIN (le même, qui ne le lit pas). On juge, à 32 graines ou plus :
 *
 *   le malin gagne la Coupe 4 à 12 fois sur 64 ; « premier », 2 fois au plus ; sa première Coupe, en médiane, pas avant sa
 *   troisième run (JP, 7 nov.) ; bâtir ne coûte pas (le témoin ne tient pas nettement plus de cibles que le malin, en paires) ;
 *   les galons d'une run courte (V28, tranche 5b) : chaque sorte gravée dans 5 à 85 % des runs du malin, 4 à 12 par run, la
 *   Coupe à part (elle se grave sur les 23 cartes de l'effectif : comptée, la borne suivrait les Coupes).
 *
 * À `GRAND` graines (256), à la main, ce qui tire à pile ou face en dessous (JP, 13 et 14 nov. 2026 ; docs/decisions.md) :
 *   — bâtir paie : en paires, le malin tient plus de cibles que le témoin, au-delà de deux écarts-types ;
 *   — dur, mais ça explose : 15 à 35 % des runs du malin jouent l'acte III à 75 % de chance moyenne ;
 *   — les séries sont le mur : une run qui explose gagne la Coupe moins d'une fois sur deux ;
 *   — la cote seule ne suffit plus : le robot du chiffre tient la cible de l'acte III au plus une fois sur trois ;
 *   — plus d'un build gagne : au moins cinq pièces mènent un banc qui tient ses trois cibles, aucune dans plus de 40 % ;
 *   — chaque pièce vit : sur les bancs du malin, elle atteint sa première marche plus d'une fois sur deux, et sa
 *     deuxième dans 10 à 60 % des cas (aucune marche d'office) ;
 *   — les jetons servent : une run du malin finit avec 40 jetons ou moins en caisse.
 * À 384 graines : chaque coach tient ses cibles à dix points de la moyenne. Ce qui s'imprime sans se juger : les
 * relances, la part des actes que le rival décide (JP, 14 nov. : la question se repose avec ce chiffre).
 *
 *   node scripts/mesure_run.mjs                    les quatre robots, `GRAINES` graines (64), `FILS` processus (4)
 *   GRAINES=8 FILS=2 node scripts/mesure_run.mjs   l'essai court : les bornes s'impriment sans se juger
 *   ROBOTS=malin,temoin GRAINE0=2000 …             quelques robots, un autre jeu de graines
 *   GRAINES=256 FILS=3 GRAINE0=4000 …              le juge du build (une heure et demie)
 *   REGLAGES='{"RACHAT":0.6}' …                    un réglage de js/run.js `RUN`, le temps d'une mesure
 *   CRANS=1 GRAINES=128 FILS=3 …                   les exigences (js/rogue.js `EXIGENCES`) : le malin à chaque cran, sur les
 *                                                  mêmes graines — chaque cran doit COÛTER (la part des cibles tenues baisse
 *                                                  d'un cran au suivant ; jugé à 128 graines ou plus)
 * Mesure seulement : jamais lu par le jeu.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUN, chanceCeSoir } from '../js/run.js';
import { EXIGENCES } from '../js/rogue.js';
import { PIECES } from '../js/pieces.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const GRAINES = Number(process.env.GRAINES ?? 64);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const JUGER = GRAINES >= 32, GRAND = 256;
/* Le pronostic d'un match de l'acte III : `N_CHANCE` matchs rejoués, comme la jauge de la feuille du soir. « Exploser le jeu » : `EXPLOSE` de moyenne. */
const N_CHANCE = 40, EXPLOSE = 0.75, PART_EXPLOSE = [15, 35], RUN_DE_LA_COUPE = 3, BUILDS = 5, PART_MAX = 0.4, DEUXIEME = [0.1, 0.6], JETONS_MAX = 40;
/* Chaque coach à `ECART_DES_COACHS` de la moyenne, en cibles tenues : jugé à `TRES_GRAND` graines (48 runs par coach), imprimé en dessous. */
const TRES_GRAND = 384, ECART_DES_COACHS = 0.1;
const ROBOTS = (process.env.ROBOTS || 'premier,chiffre,temoin,malin').split(',');
Object.assign(RUN, JSON.parse(process.env.REGLAGES || '{}'));

/* ---------- les processus ---------- */
if (process.env.BRAS) {
  const [robot, a, b] = process.env.BRAS.split(':');
  const res = [], g0 = Number(process.env.GRAINE0 ?? 0);
  for (let g = Number(a); g < Number(b); g++) {
    // La chance de chaque match de l'acte III, lue à la feuille du soir comme l'écran (le malin et son témoin : ce sont eux qu'on juge).
    const iii = [];
    const espion = !['malin', 'temoin'].includes(robot) ? undefined : (m, S) => { if (m === 'case' && S.R.phase === 'feuille' && S.R.acte === 2 && !S.R.series) { const c = chanceCeSoir(S, { n: N_CHANCE }); iii.push(c.v / c.n); } };
    const exigence = Number(process.env.EXIGENCE ?? 0);
    const r = jouerLaRun(robot, g0 + g, { exigence, ...(espion ? { espion } : {}) });
    // Le rival décide la cible d'un acte quand, sans son match, elle n'est ni tenue ni perdue.
    const rival = r.actes.map((x, k) => { const m = r.R.matchs.find(y => y.acte === k && y.sorte === 'rival'); if (!m) return null; const sans = x.pts - (m.gagne ? 4 : m.ot ? 2 : 0); return sans < x.cible && sans + 4 >= x.cible; }).filter(x => x !== null);
    res.push({ ...r, R: undefined, iii, exigence, rival, galons: (r.R.galons || []).map(x => x.type) });
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
 * d'un cran au suivant.
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
const tenuesDe = x => moy(x.actes.map(a => (a.tenu ? 1 : 0)));
const tenues = r => moy(de(r).flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0))));
const explose = x => x.iii.length > 0 && moy(x.iii) >= EXPLOSE;
for (const r of ROBOTS) {
  const l = de(r), causes = c => l.filter(x => x.fin && x.fin.cause === c).length;
  const parActe = [0, 1, 2].map(a => { const xs = l.filter(x => x.actes[a]); return `acte ${a + 1} ${pct(moy(xs.map(x => (x.actes[a].tenu ? 1 : 0))))} (${moy(xs.map(x => x.actes[a].pts)).toFixed(1)} pts)`; }).join(' · ');
  const marches = l.flatMap(x => x.banc.map(y => y.marche)), part = k => pct(marches.filter(x => x === k).length / Math.max(1, marches.length)), rival = l.flatMap(x => x.rival);
  informer(`Le robot ${r}`, `${coupes(r)} Coupes sur ${l.length} · cibles tenues ${pct(tenues(r))} (${parActe}) · sans cœur ${causes('coeurs')} · sans séries ${causes('cible')} · série perdue ${causes('serie')} · ${moy(l.map(x => x.rondes)).toFixed(2)} ronde · ${moy(l.map(x => x.signatures)).toFixed(1)} signatures · force ${moy(l.map(x => x.forces[0])).toFixed(0)} → ${moy(l.map(x => x.forces.at(-1))).toFixed(0)} · ${moy(l.map(x => x.s)).toFixed(1)} s la run`);
  informer('  son banc, ses jetons', `${moy(l.map(x => x.banc.length)).toFixed(1)} pièces · sous le premier seuil ${part(0)}, à la 1re marche ${part(1)}, à la 2e ${part(2)}, à la 3e ${part(3)} · ${moy(l.map(x => x.relances)).toFixed(1)} relances par run (${moy(l.map(x => x.payees)).toFixed(0)} jetons) · ${moy(l.map(x => x.jetons)).toFixed(0)} jetons en caisse à la fin · le rival décide la cible dans ${rival.filter(Boolean).length} actes sur ${rival.length}`);
}
/* En paires, par graine : la part des cibles tenues d'un robot moins celle d'un autre ; le bruit, deux écarts-types de la moyenne. */
function enPaires(a, b) {
  const d = de(a).map(x => { const y = de(b).find(z => z.graine === x.graine); return y ? tenuesDe(x) - tenuesDe(y) : null; }).filter(x => x !== null);
  const m = moy(d), bruit = 2 * Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, d.length - 1) / Math.max(1, d.length));
  return { m, bruit, mot: `cibles tenues ${pct(tenues(a))} contre ${pct(tenues(b))} : ${m >= 0 ? '+' : ''}${(100 * m).toFixed(1)} points en paires, le bruit à ±${(100 * bruit).toFixed(1)}` };
}
if (JUGER) {
  if (ROBOTS.includes('malin')) borne('Les Coupes du malin, sur 64', sur64('malin'), 4, 12);
  if (ROBOTS.includes('premier')) borne('Les Coupes de « premier », sur 64', sur64('premier'), 0, 2);
  if (ROBOTS.includes('malin') && ROBOTS.includes('temoin')) {
    // BÂTIR, EN PAIRES : la même graine, le malin et son témoin (une seule différence : lire son banc aux portes). À 64
    // graines le bruit est de ±9 points : on y exige seulement que bâtir ne COÛTE pas ; « bâtir paie » se juge à `GRAND`.
    const P = enPaires('malin', 'temoin');
    if (GRAINES >= GRAND) exiger('Bâtir paie : en paires, le malin tient plus de cibles que son témoin, au-delà du bruit', P.m > P.bruit, P.mot);
    else exiger('Bâtir ne coûte pas : le témoin ne tient pas nettement plus de cibles que le malin, sur les mêmes graines', P.m > -P.bruit, `${P.mot} (« bâtir paie » se juge à ${GRAND} graines)`);
  }
  if (ROBOTS.includes('malin')) {
    const l = de('malin');
    // La première Coupe, en médiane : les runs sont indépendantes (rien de la force ne suit d'une run à l'autre).
    const p = coupes('malin') / GRAINES, mediane = p > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - p)) : Infinity;
    exiger(`La première Coupe du malin, en médiane, pas avant la run ${RUN_DE_LA_COUPE}`, mediane >= RUN_DE_LA_COUPE, `à la run ${mediane} (${pct(p)} de Coupes par run)`);
    // Les galons (V28, tranche 5b) : chaque sorte se voit, aucune n'est de toutes les runs. La Coupe suit les Coupes, jugées plus haut.
    const sortes = ['chapeau', 'grandMatch', 'jeuBlanc', 'mur', 'dixButs', 'vingtPoints', 'bourreau'];
    const part = t => l.filter(x => x.galons.includes(t)).length / l.length, parRun = moy(l.map(x => x.galons.filter(t => t !== 'coupe').length));
    exiger('Les galons : chaque sorte se grave dans 5 à 85 % des runs du malin', sortes.every(t => part(t) >= 0.05 && part(t) <= 0.85), sortes.map(t => `${t} ${pct(part(t))}`).join(' · '));
    // La Coupe à part : elle se grave d'un coup sur tout l'effectif (23 cartes), et le compte suivrait les Coupes au lieu des soirs.
    borne('Les galons gravés par run du malin, la Coupe à part', Math.round(parRun * 10) / 10, 4, 12);
    // LE BUILD (V29), jugé à `GRAND` graines ; en dessous, imprimé.
    const fortes = l.filter(explose), partFortes = Math.round(1000 * fortes.length / GRAINES) / 10;
    const gagnants = l.filter(x => x.actes.length === 3 && x.actes.every(a => a.tenu)).map(x => x.banc.slice().sort((a, b) => b.marche - a.marche || b.n / PIECES[b.cle].seuils[0] - a.n / PIECES[a.cle].seuils[0])[0]).filter(Boolean);
    const sortesDeBanc = [...new Set(gagnants.map(x => x.cle))], combien = k => gagnants.filter(x => x.cle === k).length;
    const motBuilds = `${sortesDeBanc.length} pièces : ${sortesDeBanc.sort((a, b) => combien(b) - combien(a)).map(k => `${PIECES[k].nom} ${combien(k)}`).join(', ') || 'aucune'} (${gagnants.length} runs à trois cibles)`;
    const vit = Object.keys(PIECES).map(k => { const xs = l.flatMap(x => x.banc.filter(y => y.cle === k)); return [k, xs.length, xs.filter(y => y.marche >= 1).length, xs.filter(y => y.marche >= 2).length]; });
    const motVit = vit.map(([k, n, m1, m2]) => `${PIECES[k].nom} ${n ? pct(m1 / n) : '—'} (2e : ${n ? pct(m2 / n) : '—'}, ${n} bancs)`).join(' · ');
    const iiiChiffre = de('chiffre').filter(x => x.actes[2]);
    // Les coachs : la part des cibles tenues du malin sous chaque philosophie, contre la moyenne.
    const coachs = [...new Set(l.map(x => x.coach))].sort(), partDu = c => moy(l.filter(x => x.coach === c).flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0))));
    const motCoachs = coachs.map(c => `${c} ${pct(partDu(c))} (${l.filter(x => x.coach === c).length} runs)`).join(' · ');
    if (GRAINES >= TRES_GRAND) exiger(`Chaque coach tient ses cibles à ${Math.round(100 * ECART_DES_COACHS)} points de la moyenne`, coachs.every(c => Math.abs(partDu(c) - tenues('malin')) <= ECART_DES_COACHS), motCoachs);
    else informer(`  chaque coach, ses cibles (jugé à ${TRES_GRAND} graines)`, motCoachs);
    if (GRAINES >= GRAND) {
      borne(`Dur, mais ça explose : la part des runs du malin à ${pct(EXPLOSE)} de chance à l'acte III, en %`, partFortes, ...PART_EXPLOSE);
      exiger('Les séries sont le mur : une run qui explose gagne la Coupe moins d\'une fois sur deux', fortes.length > 0 && fortes.filter(x => x.coupe).length < fortes.length / 2, `${fortes.filter(x => x.coupe).length} Coupes sur ${fortes.length} runs qui explosent`);
      if (iiiChiffre.length) exiger('La cote seule ne suffit plus : le chiffre tient la cible de l\'acte III au plus une fois sur trois', moy(iiiChiffre.map(x => (x.actes[2].tenu ? 1 : 0))) <= 1 / 3, pct(moy(iiiChiffre.map(x => (x.actes[2].tenu ? 1 : 0)))));
      exiger(`Plus d'un build gagne : au moins ${BUILDS} pièces mènent un banc qui tient ses trois cibles, aucune dans plus de ${pct(PART_MAX)}`, sortesDeBanc.length >= BUILDS && Math.max(0, ...sortesDeBanc.map(combien)) <= PART_MAX * gagnants.length, motBuilds);
      exiger('Chaque pièce vit : sur les bancs du malin, elle atteint sa première marche plus d\'une fois sur deux', vit.every(([, n, m1]) => n > 0 && m1 / n > 0.5), motVit);
      exiger(`Aucune marche d'office : sur les bancs du malin, chaque pièce atteint sa deuxième marche dans ${pct(DEUXIEME[0])} à ${pct(DEUXIEME[1])} des cas`, vit.every(([, n, , m2]) => n > 0 && m2 / n >= DEUXIEME[0] && m2 / n <= DEUXIEME[1]), vit.map(([k, n, , m2]) => `${PIECES[k].nom} ${n ? pct(m2 / n) : '—'}`).join(' · '));
      borne('Les jetons servent : ce qui reste en caisse à la fin d\'une run du malin', Math.round(moy(l.map(x => x.jetons))), 0, JETONS_MAX);
    } else {
      informer(`Le build (jugé à ${GRAND} graines)`, `${fortes.length} runs sur ${GRAINES} explosent (${partFortes} %), dont ${fortes.filter(x => x.coupe).length} Coupes ; l'acte III moyen à ${pct(moy(l.filter(x => x.iii.length).map(x => moy(x.iii))))} · ${motBuilds}`);
      informer('  chaque pièce, sa première marche', motVit);
    }
  }
} else {
  informer('L\'essai court', `${GRAINES} graines : Coupes ${ROBOTS.map(r => `${r} ${coupes(r)}`).join(', ')} ; les bornes ne se jugent qu'à 32 graines ou plus`);
}
verdict('La run en carte (V28, V29)');
