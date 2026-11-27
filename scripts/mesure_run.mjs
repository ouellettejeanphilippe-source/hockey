/*
 * LA SAISON DU ROGUE, MESURÉE SUR SES ROBOTS (V30, docs/refonte-v30-2.md § 4, § 9).
 *
 * Les robots (scripts/lib/run_robot.mjs) jouent la run entière par les fonctions du jeu (js/run.js) : les pièces du départ,
 * le repêchage de 23, les 82 soirs d'une ligue de 32, les gros matchs et leurs portes, les pochettes, le bilan du proprio à
 * chaque quart, les vraies séries. Les mêmes graines pour chacun : « premier », le CHIFFRE (la meilleure cote), le MALIN (le
 * bâtisseur, qui choisit aussi son gardien) et son TÉMOIN (le même, qui ne lit pas son banc). On juge, à 32 graines ou plus :
 *
 *   le malin gagne la Coupe 4 à 12 fois sur 64, « premier » 2 fois au plus (à 64 graines un compte de Coupes tire au sort à
 *   ±5 : on y exige qu'il soit compatible avec la borne, à deux écarts-types de son bord ; la borne se juge à 256) ;
 *   bâtir ne coûte pas (en paires, le témoin ne fait pas nettement plus de points que le malin) ;
 *   un bon DG garde ses cœurs : le malin en perd moins que le chiffre, en paires (JP, 16 nov. 2026).
 *
 * À `GRAND` graines (256), à la main, ce qui tire à pile ou face en dessous :
 *   — bâtir paie : en paires, le malin fait plus de points sur 82 que son témoin, au-delà de deux écarts-types ;
 *   — un bon DG, quel que soit son club : le malin perd moins de cœurs que le chiffre dans la moitié des repêchages les
 *     plus faibles comme dans la plus forte ;
 *   — aucune marche d'office (JP, 14 nov.) : sur les bancs du témoin, chaque pièce atteint sa deuxième marche au plus 60 %
 *     du temps, sa troisième au plus 25 % ; chaque pièce vit (sa première marche plus d'une fois sur deux chez le malin) ;
 *   — dur, mais ça explose : 15 à 35 % des runs du malin font les trois quarts des points de leur dernier quart ;
 *   — les séries sont le mur : une run qui explose gagne la Coupe moins d'une fois sur deux.
 * Avec `ROBOTS=malin,distrait` : choisir son gardien paie (le malin fait plus de points que le même robot qui l'oublie).
 * Ce qui s'imprime sans se juger : les points, le rang, les objectifs par sorte, les jetons, les signatures.
 * Les galons du malin se jugent (JP, 17 nov. 2026) : 4 à 14 gravures par run, chaque sorte dans 5 à 85 % des runs.
 *
 *   node scripts/mesure_run.mjs                    les quatre robots, `GRAINES` graines (64), `FILS` processus (4)
 *   GRAINES=8 FILS=2 node scripts/mesure_run.mjs   l'essai court : les bornes s'impriment sans se juger
 *   ROBOTS=malin,distrait GRAINE0=2000 …           quelques robots, un autre jeu de graines
 *   REGLAGES='{"RACHAT":1}' …                      un réglage de js/run.js `RUN`, le temps d'une mesure (un objet se fond)
 *   SEUILS='{"gros":[6,13,18]}' …                  les seuils d'une pièce (js/pieces.js), le temps d'une mesure
 *   BANC_SERIES='[0,0,1,2]' …                      leur banc en séries, ronde par ronde (js/pieces.js `BANC_DES_SERIES`), le temps d'une mesure
 *   CRANS=1 GRAINES=128 FILS=3 …                   les exigences (js/rogue.js `EXIGENCES`) : le malin à chaque cran
 *   CRANS=1 JUSQU_AU_CRAN=1 CRANS_REGLES='{"barre":{"cible":3}}' …   les premiers crans seulement, un cran réglé le temps d'une mesure
 *   CRANS=1 DEPUIS_LE_CRAN=2 …                     les derniers crans seulement (le premier mesuré sert de référence au suivant)
 * Mesure seulement : jamais lu par le jeu.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUN } from '../js/run.js';
import { EXIGENCES, controleDuMeta } from '../js/rogue.js';
import { PIECES, BANC_DES_SERIES } from '../js/pieces.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const GRAINES = Number(process.env.GRAINES ?? 64);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const JUGER = GRAINES >= 32, GRAND = 256;
/* « Exploser le jeu » : `EXPLOSE` des points du dernier quart. */
const EXPLOSE = 0.75, PART_EXPLOSE = [15, 35], OFFICE = [0.6, 0.25];
/* Les galons du malin : tant de gravures par run, et chaque sorte dans telle part des runs (ni toujours, ni jamais). */
const GALONS_PAR_RUN = [4, 14], PART_D_UN_GALON = [0.05, 0.85], SORTES_DE_GALON = ['chapeau', 'grandMatch', 'jeuBlanc', 'mur', 'cinquanteButs', 'centPoints', 'bourreau'];
const ROBOTS = (process.env.ROBOTS || 'premier,chiffre,temoin,malin').split(',');
for (const [k, x] of Object.entries(JSON.parse(process.env.REGLAGES || '{}'))) RUN[k] = x && typeof x === 'object' && !Array.isArray(x) ? { ...RUN[k], ...x } : x;
for (const [k, s] of Object.entries(JSON.parse(process.env.SEUILS || '{}'))) PIECES[k].seuils = s;
if (process.env.BANC_SERIES) BANC_DES_SERIES.splice(0, BANC_DES_SERIES.length, ...JSON.parse(process.env.BANC_SERIES));
for (const [cle, x] of Object.entries(JSON.parse(process.env.CRANS_REGLES || '{}'))) Object.assign(EXIGENCES.find(E => E.cle === cle), x);

/* ---------- les processus ---------- */
if (process.env.BRAS) {
  const [robot, a, b] = process.env.BRAS.split(':');
  const g0 = Number(process.env.GRAINE0 ?? 0), exigence = Number(process.env.EXIGENCE ?? 0), controle = process.env.CONTROLE ? JSON.parse(process.env.CONTROLE) : null;
  for (let g = Number(a); g < Number(b); g++) {
    let gains = 0;
    const espion = (m, S) => { if (m === 'match') gains += Math.max(0, S.R.apres.jetons) + S.R.apres.prime; };
    const r = await jouerLaRun(robot, g0 + g, { espion, exigence, controle });
    const R = r.R, sortes = {};
    // Une gravure : un joueur, une sorte, une fois par run — ce que le cartable garde (js/cartable.js `graverAuCartable`).
    for (const cle of new Set((R.galons || []).filter(x => x.type !== 'coupe').map(x => `${x.type}:${x.k}`))) { const type = cle.split(':')[0]; sortes[type] = (sortes[type] || 0) + 1; }
    console.log(JSON.stringify({ robot, graine: r.graine, coach: r.coach, pts: r.pts, rang: r.rang, coeurs: r.coeurs, series: !!R.series, cause: r.fin.cause, rondes: r.rondes, coupe: r.coupe, matchs: r.fin.matchs,
      quarts: r.quarts.map(q => ({ tenus: q.tenus, tenu: q.tenu, pts: q.pts, rang: q.rang, rival: q.rival, o: q.objectifs.map(o => [o.sorte, o.cible, o.valeur, o.tenu ? 1 : 0]) })),
      signatures: r.signatures, relances: r.relances, payees: r.payees, montees: r.montees, pochettes: r.pochettes, forces: r.forces, banc: r.banc, banc0: r.bancDuDepart, jetons: r.jetons, gains, galons: sortes,
      medailles: r.fin.medailles, s: r.s }));
  }
  process.exit(0);
}
const lancer = (robot, a, b, env = {}) => new Promise((ok, non) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, ...env, BRAS: `${robot}:${a}:${b}` }, stdio: ['ignore', 'pipe', 'inherit'] });
  let s = '';
  p.stdout.on('data', d => { s += d; });
  p.on('close', c => (c ? non(new Error(`${robot} ${a}-${b} : code ${c}`)) : ok(s.trim().split('\n').filter(Boolean).map(x => JSON.parse(x)))));
});
/* Les tranches de graines de chaque robot, `FILS` à la fois. */
async function mesurer(robots, env = {}) {
  const pas = Math.ceil(GRAINES / FILS), taches = [];
  for (const robot of robots) for (let a = 0; a < GRAINES; a += pas) taches.push([robot, a, Math.min(GRAINES, a + pas)]);
  const out = [];
  for (let i = 0; i < taches.length; i += FILS) out.push(...(await Promise.all(taches.slice(i, i + FILS).map(t => lancer(...t, env)))).flat());
  return out;
}

/* ---------- les outils ---------- */
const moy = l => l.reduce((a, x) => a + x, 0) / (l.length || 1);
const ecart = l => { const m = moy(l); return Math.sqrt(moy(l.map(x => (x - m) ** 2)) * l.length / Math.max(1, l.length - 1)); };
const un = x => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
const pc = x => `${Math.round(100 * x)} %`;
const sur64 = n => Math.round((n * 64) / GRAINES * 10) / 10;
/* Un compte de `n` runs est-il compatible avec une part entre `a` et `b`, à deux écarts-types de son bord ? */
const compatible = (k, n, a, b) => k >= a * n - 2 * Math.sqrt(n * a * (1 - a)) && k <= b * n + 2 * Math.sqrt(n * b * (1 - b));
/* L'écart moyen en paires (la même graine), et son erreur type. */
function paires(A, B, lire) {
  const parGraine = new Map(B.map(r => [r.graine, r]));
  const d = A.filter(r => parGraine.has(r.graine)).map(r => lire(r) - lire(parGraine.get(r.graine)));
  return { n: d.length, m: moy(d), se: ecart(d) / Math.sqrt(d.length || 1) };
}
const ditPaires = (p, unite, dit = un) => `${p.m >= 0 ? '+' : ''}${dit(p.m)} ${unite} (erreur type ±${dit(p.se)}, ${p.n} paires)`;
/* Au centième : un cran d'exigence coûte des centièmes de cœur, que le dixième arrondit à zéro. */
const cent = x => x.toFixed(2).replace('.', ',');
const perdus = r => RUN.COEURS - r.coeurs;

/* ---------- les exigences : chaque cran doit coûter ---------- */
if (process.env.CRANS) {
  const parCran = [];
  const premier = Math.max(0, Number(process.env.DEPUIS_LE_CRAN ?? 0)), dernier = Math.min(EXIGENCES.length, Number(process.env.JUSQU_AU_CRAN ?? EXIGENCES.length));
  for (let k = premier; k <= dernier; k++) parCran[k] = await mesurer(['malin'], { EXIGENCE: String(k) });
  parCran.forEach((runs, k) => informer(`Cran ${k}${k ? ` (${EXIGENCES[k - 1].court})` : ''}`, `${un(moy(runs.map(r => r.pts)))} points, ${cent(moy(runs.map(perdus)))} cœur perdu par run, un bilan tenu ${pc(moy(runs.flatMap(r => r.quarts.map(q => (q.tenu ? 1 : 0)))))}, congédié ${runs.filter(r => r.cause === 'congedie').length} fois, dans les séries ${pc(moy(runs.map(r => (r.matchs > RUN.LIGUE.MATCHS ? 1 : 0))))}, ${sur64(runs.filter(r => r.coupe).length)} Coupes sur 64, ${un(moy(runs.map(r => r.medailles)))} médailles`));
  for (let k = premier + 1; k < parCran.length; k++) {
    const p = paires(parCran[k], parCran[k - 1], perdus);
    if (GRAINES >= 128) exiger(`Le cran ${k} coûte : plus de cœurs perdus qu'au cran ${k - 1}`, p.m > 0, ditPaires(p, 'cœur', cent));
    else informer(`Le cran ${k} contre le cran ${k - 1} (jugé à 128 graines)`, ditPaires(p, 'cœur', cent));
  }
  verdict('Les exigences du Rogue');
  process.exit(process.exitCode || 0);
}

/* ---------- la première run : peu de chances de gagner (V33) ---------- */
/*
 * JP, 26 nov. 2026 : *la première saison, peu de chances de gagner* ; puis, sur les chiffres, *garder 72 %*. Le malin joue
 * avec le contrôle d'un club neuf (js/rogue.js `controleDuMeta` d'une méta vide : 20 M$ de moins, aucune relance, deux
 * affiches, trois cœurs), le cartable vide : il fait les séries 55 à 85 % du temps et gagne la Coupe au plus 2 fois sur 64.
 */
if (process.env.PREMIERE) {
  const premiere = await mesurer(['malin'], { CONTROLE: JSON.stringify(controleDuMeta({})) });
  const series = premiere.filter(r => r.series).length, coupes = premiere.filter(r => r.coupe).length, n = premiere.length;
  informer('La première run du malin', `${un(moy(premiere.map(r => r.pts)))} points, ${un(moy(premiere.map(r => r.rang)))}e en moyenne, congédié ${premiere.filter(r => r.coeurs <= 0).length} fois sur ${n}`);
  if (GRAINES >= 32) {
    exiger('La première run fait les séries 55 à 85 % du temps (compatible)', compatible(series, n, 0.55, 0.85), `${series} sur ${n}`);
    exiger('La première run gagne la Coupe au plus 2 fois sur 64 (compatible)', compatible(coupes, n, 0, 2 / 64), `${coupes} sur ${n}`);
  } else informer('Les bornes de la première run (jugées à 32 graines)', `séries ${series} sur ${n}, Coupes ${coupes}`);
  verdict('La première run du Rogue');
  process.exit(process.exitCode || 0);
}

/* ---------- la mesure ---------- */
const t0 = Date.now();
const runs = await mesurer(ROBOTS);
const de = robot => runs.filter(r => r.robot === robot).sort((a, b) => a.graine - b.graine);
for (const robot of ROBOTS) {
  const l = de(robot), causes = {};
  for (const r of l) causes[r.cause] = (causes[r.cause] || 0) + 1;
  informer(`« ${robot} »`, `${un(moy(l.map(r => r.pts)))} points (écart-type ${un(ecart(l.map(r => r.pts)))}), rang ${un(moy(l.map(r => r.rang)))}, dans les séries ${pc(moy(l.map(r => (r.matchs > RUN.LIGUE.MATCHS ? 1 : 0))))}, ${un(moy(l.map(r => r.rondes)))} ronde gagnée, ${l.filter(r => r.coupe).length} Coupes sur ${l.length} ; ${un(moy(l.map(perdus)))} cœur perdu par run ; les fins : ${Object.entries(causes).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  // Où une run meurt en séries : celles qui s'y rendent, par le nombre de rondes gagnées (quatre : la Coupe).
  const enSeries = l.filter(r => r.matchs > RUN.LIGUE.MATCHS);
  if (enSeries.length) informer('  ses séries', `${enSeries.length} runs s'y rendent ; sorties à la 1re ronde ${enSeries.filter(r => r.rondes === 0).length}, à la 2e ${enSeries.filter(r => r.rondes === 1).length}, à la 3e ${enSeries.filter(r => r.rondes === 2).length}, en finale ${enSeries.filter(r => r.rondes === 3).length}, la Coupe ${enSeries.filter(r => r.coupe).length}`);
  const parSorte = {};
  for (const r of l) for (const q of r.quarts) for (const [sorte, , , tenu] of q.o) { const x = parSorte[sorte] = parSorte[sorte] || [0, 0]; x[0] += tenu; x[1]++; }
  informer('  ses objectifs', `${Object.entries(parSorte).map(([k, [a, b]]) => `${k} ${pc(a / b)} (${b})`).join(', ')} ; un bilan tenu ${pc(moy(l.flatMap(r => r.quarts.map(q => (q.tenu ? 1 : 0)))))} ; les points par quart ${[0, 1, 2, 3].map(n => un(moy(l.filter(r => r.quarts[n]).map(r => r.quarts[n].pts)))).join(' · ')} pour ${[0, 1, 2, 3].map(n => un(moy(l.filter(r => r.quarts[n]).map(r => r.quarts[n].o[0][1])))).join(' · ')} demandés`);
  informer('  son club', `la force au départ ${un(moy(l.map(r => r.forces[0])))}, à la fin ${un(moy(l.map(r => r.forces.at(-1))))} ; ${un(moy(l.map(r => r.signatures)))} signatures, ${un(moy(l.map(r => r.pochettes)))} pochettes, ${un(moy(l.map(r => r.relances)))} relances, ${un(moy(l.map(r => r.montees)))} cartes montées ; ${un(moy(l.map(r => r.gains)))} jetons gagnés aux matchs, ${un(moy(l.map(r => r.jetons)))} en caisse à la fin ; ${un(moy(l.map(r => r.medailles)))} médailles ; ${un(moy(l.map(r => r.s)))} s par run`);
  const marches = (cle, champ) => { const bancs = l.map(r => (r[champ] || []).find(x => x.cle === cle)).filter(Boolean); return bancs.length ? `${cle} ${[1, 2, 3].map(m => Math.round(100 * moy(bancs.map(x => (x.marche >= m ? 1 : 0))))).join('/')} (${bancs.length})` : null; };
  informer('  son banc au repêchage (% à la 1re/2e/3e marche)', Object.keys(PIECES).map(k => marches(k, 'banc0')).filter(Boolean).join(', '));
  informer('  son banc à la fin', Object.keys(PIECES).map(k => marches(k, 'banc')).filter(Boolean).join(', '));
  const galons = {};
  for (const r of l) for (const [k, n] of Object.entries(r.galons)) { const x = galons[k] = galons[k] || [0, 0]; x[0]++; x[1] += n; }
  informer('  ses galons', `${un(moy(l.map(r => Object.values(r.galons).reduce((a, x) => a + x, 0))))} par run ; ${Object.entries(galons).map(([k, [n]]) => `${k} ${pc(n / l.length)}`).join(', ')}`);
}

const M = de('malin'), T = de('temoin'), C = de('chiffre'), P = de('premier'), D = de('distrait');
if (M.length) {
  // Un galon que chaque run grave ne dit plus rien, un galon que personne ne grave non plus.
  const parRun = moy(M.map(r => Object.values(r.galons).reduce((a, x) => a + x, 0))), parts = SORTES_DE_GALON.map(k => [k, moy(M.map(r => (r.galons[k] ? 1 : 0)))]);
  const ditGalons = `${un(parRun)} gravures par run ; ${parts.map(([k, x]) => `${k} ${pc(x)}`).join(', ')}`;
  if (JUGER) exiger(`Les galons : ${GALONS_PAR_RUN[0]} à ${GALONS_PAR_RUN[1]} gravures par run du malin, chaque sorte dans ${pc(PART_D_UN_GALON[0])} à ${pc(PART_D_UN_GALON[1])} de ses runs`, parRun >= GALONS_PAR_RUN[0] && parRun <= GALONS_PAR_RUN[1] && parts.every(([, x]) => x >= PART_D_UN_GALON[0] && x <= PART_D_UN_GALON[1]), ditGalons);
  else informer('Les galons du malin (jugés à 32 graines ou plus)', ditGalons);
  const coupes = M.filter(r => r.coupe).length;
  const explose = M.filter(r => r.quarts[3] && r.quarts[3].pts >= EXPLOSE * 2 * RUN.QUARTS[3]), coupesExplose = explose.filter(r => r.coupe).length;
  if (JUGER) exiger('Le malin gagne la Coupe 4 à 12 fois sur 64 (à moins de 256 graines : compatible avec la borne)', GRAINES >= GRAND ? coupes >= (4 / 64) * M.length && coupes <= (12 / 64) * M.length : compatible(coupes, M.length, 4 / 64, 12 / 64), `${coupes} sur ${M.length} (${sur64(coupes)} sur 64)`);
  else informer('La Coupe du malin (jugée à 32 graines ou plus)', `${coupes} sur ${M.length}`);
  informer('Dur, mais ça explose : les runs du malin aux trois quarts des points de leur dernier quart', `${pc(explose.length / M.length)} (${PART_EXPLOSE.join(' à ')} % visés) ; elles gagnent la Coupe ${coupesExplose} fois sur ${explose.length}`);
  if (GRAINES >= GRAND) {
    borne('Dur, mais ça explose', 100 * explose.length / M.length, ...PART_EXPLOSE, ' %');
    exiger('Les séries sont le mur : une run qui explose gagne la Coupe moins d\'une fois sur deux', coupesExplose < explose.length / 2, `${coupesExplose} sur ${explose.length}`);
  }
}
if (P.length) {
  const coupes = P.filter(r => r.coupe).length;
  if (JUGER) exiger('« premier » gagne la Coupe au plus 2 fois sur 64 (compatible)', GRAINES >= GRAND ? coupes <= (2 / 64) * P.length : compatible(coupes, P.length, 0, 2 / 64), `${coupes} sur ${P.length}`);
}
if (M.length && T.length) {
  const p = paires(M, T, r => r.pts);
  if (GRAINES >= GRAND) exiger('Bâtir paie : le malin fait plus de points que son témoin, au-delà de deux écarts-types', p.m > 2 * p.se, ditPaires(p, 'points sur 82'));
  else if (JUGER) exiger('Bâtir ne coûte pas : le témoin ne fait pas nettement plus de points que le malin', p.m > -2 * p.se, ditPaires(p, 'points sur 82'));
  else informer('Bâtir (le malin contre son témoin)', ditPaires(p, 'points sur 82'));
  // Aucune marche d'office : sur les bancs du témoin, à la fin.
  const office = Object.keys(PIECES).map(cle => { const b = T.map(r => r.banc.find(x => x.cle === cle)).filter(Boolean); return { cle, n: b.length, m2: moy(b.map(x => (x.marche >= 2 ? 1 : 0))), m3: moy(b.map(x => (x.marche >= 3 ? 1 : 0))) }; }).filter(x => x.n >= 8);
  const fautes = office.filter(x => x.m2 > OFFICE[0] || x.m3 > OFFICE[1]);
  if (GRAINES >= GRAND) exiger('Aucune marche d\'office : chez le témoin, la deuxième marche au plus 60 % du temps, la troisième au plus 25 %', !fautes.length, fautes.map(x => `${x.cle} ${pc(x.m2)}/${pc(x.m3)}`).join(', ') || `${office.length} pièces`);
  else informer('Les marches d\'office chez le témoin (jugées à 256 graines)', fautes.map(x => `${x.cle} ${pc(x.m2)}/${pc(x.m3)}`).join(', ') || 'aucune');
  const mortes = Object.keys(PIECES).map(cle => { const b = M.map(r => r.banc.find(x => x.cle === cle)).filter(Boolean); return { cle, n: b.length, m1: moy(b.map(x => (x.marche >= 1 ? 1 : 0))) }; }).filter(x => x.n >= 8 && x.m1 <= 0.5);
  if (GRAINES >= GRAND) exiger('Chaque pièce vit : sa première marche plus d\'une fois sur deux chez le malin', !mortes.length, mortes.map(x => `${x.cle} ${pc(x.m1)}`).join(', ') || 'toutes');
}
if (M.length && C.length) {
  const p = paires(C, M, perdus);
  if (JUGER) exiger('Un bon DG garde ses cœurs : le chiffre en perd plus que le malin, en paires', p.m > 0, ditPaires(p, 'cœur'));
  else informer('Les cœurs (le chiffre contre le malin)', ditPaires(p, 'cœur'));
  // Quel que soit son club de départ : la moitié des repêchages les plus faibles, et la plus forte.
  const mediane = M.map(r => r.forces[0]).sort((a, b) => a - b)[Math.floor(M.length / 2)];
  for (const [nom, ok] of [['les repêchages faibles', r => r.forces[0] < mediane], ['les repêchages forts', r => r.forces[0] >= mediane]]) {
    const q = paires(C, M.filter(ok), perdus);
    if (GRAINES >= GRAND) exiger(`Un bon DG, quel que soit son club : ${nom}`, q.m > 0, ditPaires(q, 'cœur'));
    else informer(`Un bon DG, ${nom} (jugé à 256 graines)`, ditPaires(q, 'cœur'));
  }
}
if (M.length && D.length) {
  const p = paires(M, D, r => r.pts);
  if (GRAINES >= 64) exiger('Choisir son gardien paie : le malin fait plus de points que le même robot qui l\'oublie, au-delà de deux écarts-types', p.m > 2 * p.se, ditPaires(p, 'points sur 82'));
  else informer('Choisir son gardien (jugé à 64 graines ou plus)', ditPaires(p, 'points sur 82'));
}
informer('La mesure', `${runs.length} runs, ${Math.round((Date.now() - t0) / 1000)} s`);
verdict('La saison du Rogue : les robots');
