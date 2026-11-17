/*
 * UNE SAISON AU DOIGT (V30, docs/refonte-v30-2.md § 9). Chromium, à 390 × 844, joue le Rogue par ses boutons, sans jamais
 * lire autre chose que l'écran ; le hasard de la page est semé (`GRAINE`), le parcours se rejoue au toucher près.
 *
 *   LE DÉBUT, d'une page vide : ton coach, tes deux pièces, les vingt-trois tours du repêchage, l'ouverture du quart, puis
 *   le premier quart joué soir par soir — le bureau, la feuille, une affiche posée, le match, le résultat, les portes d'un
 *   gros match gagné, le bilan du proprio, le marché, l'ouverture du deuxième quart.
 *   LA FIN, d'une sauvegarde de robot au 80e match (une saison entière au doigt prendrait dix minutes) : les derniers
 *   matchs, le dernier bilan, les séries match par match s'il y en a, l'écran de fin.
 *
 *   1. le repêchage donne vingt-trois joueurs et ouvre le bureau ;
 *   2. un soir ordinaire tient en cinq touchers au plus (jouer ce soir, au match, à la fin, continuer, au bureau) ;
 *   3. le match vu est le match joué : le pointage du résultat est celui que la run garde ;
 *   4. une affiche posée à la feuille est jouée en affiche ;
 *   5. quitter au menu et rouvrir reprend la run où elle était ;
 *   6. le premier quart finit par son bilan, son marché, et l'ouverture du deuxième ;
 *   7. la run va à son écran de fin, verse ses médailles une fois ; le Club s'ouvre de l'écran de fin et une philosophie
 *      s'y paie une fois (ou dit ce qui manque) ; « Une run neuve » rouvre le départ ; aucune erreur de page.
 *
 *   node scripts/essai_run.mjs http://localhost:8000 [dossier]      (trois minutes ; `GRAINE=…` un autre tirage)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { exiger, informer, verdict } from './verdict.mjs';
import { jouerLaRun } from './lib/run_robot.mjs';
import { figer } from '../js/run.js';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || null;
const GRAINE = process.env.GRAINE || 'v30-essai';
const TOUCHERS_MAX = 5, PAS_MAX = 700;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce' });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
// Le hasard de la page, semé : la graine de la run, le loto des coachs.
await page.addInitScript(g => {
  let x = 2166136261;
  for (const c of String(g)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  Math.random = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}, GRAINE);
if (DOSSIER) fs.mkdirSync(DOSSIER, { recursive: true });

const run = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_run') || 'null'); } catch { return null; } });
const meta = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_rogue') || 'null'); } catch { return null; } });
const la = (a, v = null) => page.$(v == null ? `#runModal [data-a="${a}"]:not([disabled])` : `#runModal [data-a="${a}"][data-v="${v}"]:not([disabled])`);
const ouvrir = async () => { await page.click('#menuDepart [data-menu="rogue"]'); await page.waitForSelector('#runModal .rn-plan [data-a]', { timeout: 90000 }); };
let touchers = 0;
const toucher = async (a, v = null, attente = 220) => {
  const el = await la(a, v);
  if (!el) return false;
  await el.click();
  touchers++;
  await page.waitForTimeout(attente);
  return true;
};
const photo = async nom => { if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/essai-${nom}.png` }); };

/* ---------- ce que le doigt fait de chaque scène ---------- */
const vu = { soirs: [], pointages: [], affiches: 0, affichesJouees: 0, portes: 0, signes: 0, bilans: 0, marches: 0, quarts: 0, ballottages: 0 };
let soir = null;   // le soir en cours : ses touchers, s'il est ordinaire
/* Un pas : la première chose à faire que la scène offre. Rend son nom, ou null si rien ne se touche. */
async function pas({ affiches = true } = {}) {
  if (await la('prendre-coach')) return (await toucher('prendre-coach', null, 600)) && 'coach';
  if (await la('repecher')) return (await toucher('repecher')) && 'repêchage';
  if (await la('relancer-roulette') && !(await la('repecher'))) return (await toucher('relancer-roulette')) && 'roulette';
  if (await la('prendre-piece')) {
    // Banc plein : celle qui sort d'abord (la première), sinon on passe.
    if (!(await toucher('prendre-piece')) || await la('prendre-piece')) { if (!(await toucher('piece-sort')) || !(await toucher('prendre-piece'))) await toucher('piece-passee'); }
    return 'pièce';
  }
  if (await la('vers-bureau')) { vu.quarts++; return (await toucher('vers-bureau')) && 'quart'; }
  if (await la('reclamer')) { vu.ballottages++; if (soir) soir.ordinaire = false; const offre = await page.$('#runModal [data-a="reclamer"][data-v]:not([data-v=""])'); if (offre) { await offre.click(); touchers++; await page.waitForTimeout(300); } else await toucher('reclamer'); return 'ballottage'; }
  if (await la('apres-match')) {
    await toucher('apres-match', null, 300);
    // Le résultat : son pointage, et celui que la run garde.
    const lu = await page.$eval('#runModal .rn-final b', el => el.textContent.trim()).catch(() => null), R = await run(), m = R && R.matchs.at(-1);
    vu.pointages.push([lu, m ? `${m.gf} · ${m.ga}` : null]);
    return 'match';
  }
  if (await la('fin-du-match')) return (await toucher('fin-du-match')) && 'à la fin';
  if (await la('continuer')) {
    await toucher('continuer', null, 300);
    if (soir) { soir.fin = touchers; if (soir.ordinaire && !(await la('ouvrir-porte')) && !(await la('prendre-piece')) && !(await la('apres-bilan'))) vu.soirs.push(soir.fin - soir.debut); soir = null; }
    return 'résultat';
  }
  if (await la('ouvrir-porte', '0')) {
    vu.portes++;
    await toucher('ouvrir-porte', '0');
    if (await toucher('vers-echange')) { if (await toucher('signer', null, 400)) { vu.signes++; return 'signé'; } await toucher('fermer-echange'); }
    await toucher('fermer-porte');
    await toucher('passer', null, 300);
    return 'portes';
  }
  if (await la('apres-bilan')) { vu.bilans++; await photo(`bilan-${vu.bilans}`); return (await toucher('apres-bilan', null, 300)) && 'bilan'; }
  if (await la('quitter-marche')) { vu.marches++; await toucher('acheter-piece'); await toucher('monter-au-marche'); return (await toucher('quitter-marche', null, 400)) && 'marché'; }
  if (await la('jouer')) {
    const R = await run(), c = R.soir;
    if (soir) soir.ordinaire = soir.ordinaire && c.sorte === 'match';
    // Une affiche, les soirs ordinaires où il en reste (le début seulement).
    if (affiches && c.sorte === 'match' && await toucher('affiche', '1', 500)) { vu.affiches++; if (soir) soir.ordinaire = false; }
    if (c.sorte === 'affiche') vu.affichesJouees++;
    await toucher('jouer', null, 200);
    await page.waitForSelector('#runModal [data-a="apres-match"]:not([disabled])', { timeout: 20000 });
    touchers++;   // « À la fin », que le mouvement réduit épargne : compté comme touché
    return 'feuille';
  }
  if (await la('aller')) { soir = { debut: touchers, ordinaire: true }; return (await toucher('aller', null, 300)) && 'bureau'; }
  if (await la('match-de-serie')) { soir = null; return (await toucher('match-de-serie', null, 300)) && 'séries'; }
  return null;
}

/* ---------- le début : d'une page vide au deuxième quart ---------- */
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* rien à vider */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
await ouvrir();
await photo('depart');
let reprise = null, apresRepechage = null;
for (let k = 0; k < PAS_MAX && vu.quarts < 2; k++) {
  const quoi = await pas();
  if (!quoi) { await page.waitForTimeout(300); continue; }
  const R = await run();
  if (quoi === 'quart' && vu.quarts === 1) { apresRepechage = { joueurs: R.joueurs.length, phase: R.phase, banc: R.banc.length }; await photo('bureau'); }
  // Au dixième match, au bureau : quitter au menu, rouvrir.
  if (!reprise && R && R.phase === 'bureau' && R.matchs.length === 10) {
    const avant = JSON.stringify([R.phase, R.matchs, R.jetons, R.joueurs.map(j => j.k)]);
    await toucher('pause'); await toucher('menu', null, 500);
    await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 20000 });
    await ouvrir();
    const R2 = await run();
    reprise = { ok: avant === JSON.stringify([R2.phase, R2.matchs, R2.jetons, R2.joueurs.map(j => j.k)]) && !!(await la('aller')), matchs: R2.matchs.length };
    touchers -= 2;
  }
}
const debut = await run();
exiger('le repêchage donne vingt-trois joueurs, trois pièces, et ouvre le bureau', !!apresRepechage && apresRepechage.joueurs === 23 && apresRepechage.banc === 3 && apresRepechage.phase === 'bureau', JSON.stringify(apresRepechage));
exiger(`un soir ordinaire tient en ${TOUCHERS_MAX} touchers au plus`, vu.soirs.length >= 5 && Math.max(...vu.soirs) <= TOUCHERS_MAX, `${vu.soirs.length} soirs ordinaires, de ${Math.min(...vu.soirs)} à ${Math.max(...vu.soirs)} touchers`);
exiger('une affiche posée à la feuille est jouée en affiche', vu.affiches >= 1 && debut.matchs.filter(m => m.sorte === 'affiche').length === vu.affiches, `${vu.affiches} posées, ${debut.matchs.filter(m => m.sorte === 'affiche').length} jouées`);
exiger('quitter au menu et rouvrir reprend la run où elle était', !!reprise && reprise.ok, reprise ? `au match ${reprise.matchs}` : 'jamais essayé');
exiger('le premier quart finit par son bilan, son marché, et l\'ouverture du deuxième', vu.bilans === 1 && vu.marches === 1 && vu.quarts === 2 && debut.quart.n === 1 && debut.matchs.length === 21, `${debut.matchs.length} matchs, quart ${debut.quart.n + 1}`);
informer('le début', `${touchers} touchers ; ${vu.portes} fois trois portes, ${vu.signes} joueurs signés, ${vu.ballottages} ballottage(s)`);

/* ---------- la fin : d'une sauvegarde de robot au 80e match à l'écran de fin ---------- */
let tardive = null;
for (let g = 1; g <= 6 && !tardive; g++) {
  try { await jouerLaRun('malin', g, { espion: (m, S) => { if (m === 'bureau' && S.R.matchs.length === 80 && S.R.coeurs > 0) throw { R: JSON.parse(JSON.stringify(figer(S))) }; } }); } catch (e) { if (!e.R) throw e; tardive = e.R; }
}
exiger('une saison de robot arrive au 80e match', !!tardive, tardive ? `graine ${tardive.graine}` : 'aucune en six graines');
if (tardive) {
  await toucher('pause'); await toucher('menu', null, 500);
  await page.evaluate(r => { localStorage.setItem('cap82_run', JSON.stringify(r)); const m = JSON.parse(localStorage.getItem('cap82_rogue') || '{}'); localStorage.setItem('cap82_rogue', JSON.stringify(m)); }, tardive);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
  const avant = ((await meta()) || {}).ecussons || 0;
  await ouvrir();
  let fini = false;
  for (let k = 0; k < PAS_MAX && !fini; k++) {
    if (await la('run-neuve')) { fini = true; break; }
    if (!(await pas({ affiches: false }))) await page.waitForTimeout(300);
  }
  await photo('fin');
  const R = await run(), m1 = await meta();
  exiger('la run va à son écran de fin', fini && !!R && !!R.fin, R && R.fin ? `${R.fin.cause}, ${R.fin.matchs} matchs, ${R.fin.rang}e` : 'pas finie');
  if (R && R.fin) {
    exiger('la fin verse ses médailles, une fois', ((m1 || {}).ecussons || 0) === avant + R.fin.medailles, `${avant} + ${R.fin.medailles} = ${(m1 || {}).ecussons}`);
    // Le Club, de l'écran de fin : une philosophie s'y paie une fois, ou le bouton dit ce qui manque.
    await toucher('club', null, 500);
    const bouton = await page.$('#runModal [data-a="ouvrir-voie"]'), mot = bouton ? (await bouton.textContent()).trim() : '';
    const peut = !!(await la('ouvrir-voie'));
    if (peut) { await toucher('ouvrir-voie', null, 400); await toucher('ouvrir-voie', null, 300); }
    const m2 = await meta();
    exiger('le Club s\'ouvre de l\'écran de fin ; une philosophie s\'y paie une fois, ou le bouton dit ce qui manque', !!bouton && (peut ? (m2.voies || []).length === 1 && m2.ecussons === m1.ecussons - 40 : /Il te manque \d+/.test(mot)), peut ? `${m1.ecussons} → ${m2.ecussons} médailles` : mot);
    await toucher('fermer-club', null, 300);
    exiger('le Club se ferme sur l\'écran de fin, et ne verse rien de plus', !!(await la('run-neuve')) && (await meta()).ecussons === m2.ecussons);
    await toucher('run-neuve', null, 800);
    await page.waitForSelector('#runModal [data-a="prendre-coach"]', { timeout: 30000 }).catch(() => {});
    exiger('« Une run neuve » rouvre le départ, la run gardée effacée', !!(await la('prendre-coach')) && (await run()) === null);
  }
}
const faux = vu.pointages.filter(([a, b]) => !a || a !== b);
exiger('le match vu est le match joué : chaque pointage du résultat est celui que la run garde', vu.pointages.length >= 20 && !faux.length, faux.length ? faux.slice(0, 3).map(x => x.join(' ≠ ')).join(' · ') : `${vu.pointages.length} matchs`);
exiger('aucune erreur de page', !erreurs.length, [...new Set(erreurs)].slice(0, 3).join(' · '));
await browser.close();
verdict('Une saison au doigt');
