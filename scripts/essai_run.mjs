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
 *   2. un soir ordinaire tient en cinq touchers au plus (jouer ce soir, au match, passer à la fin, continuer, au bureau) ;
 *   3. le match vu est le match joué : le pointage du résultat (son sommaire) est celui que la run garde ;
 *   3 bis. LE DIRECT, mouvement permis (JP, 25 nov. 2026) : « Au match » ouvre le direct du jeu par-dessus la scène, son
 *      horloge tourne, « Passer à la fin » puis « Continuer » mènent au résultat, dont les quatre vues s'ouvrent, au même
 *      pointage que le direct et que la run ; quitter la page pendant le direct reprend au résultat, le sommaire avec ;
 *   3 ter. LA FICHE D'UN JOUEUR : un nom du direct, un nom du sommaire, une ligne de Mon club l'ouvrent par-dessus (sa
 *      carte, sa saison chez toi, son salaire de la run, ses derniers matchs) ; fermée, on est où on était ;
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
/* Le pointage que le résultat montre (son sommaire : le club qui jouait chez lui d'abord), et celui que la run garde. */
const pointageVu = p => p.$$eval('#runModal .som-lignes .som-ligne > span:nth-child(2)', l => l.map(el => el.textContent.trim()).join(' · ')).catch(() => null);
const pointageGarde = R => { const m = R && R.matchs.at(-1); return m ? (m.visiteur ? `${m.ga} · ${m.gf}` : `${m.gf} · ${m.ga}`) : null; };

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
    // En mouvement réduit, le direct ne s'ouvre pas : on arrive à son résultat. Ses deux touchers (« Passer à la fin »,
    // « Continuer ») sont comptés comme touchés ; le direct lui-même s'éprouve plus bas, mouvement permis.
    await page.waitForSelector('#runModal [data-a="continuer"]:not([disabled])', { timeout: 20000 });
    touchers += 2;
    vu.pointages.push([await pointageVu(page), pointageGarde(await run())]);
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
/* ---------- le direct : deux soirs du deuxième quart, mouvement permis ---------- */
{
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  p2.on('pageerror', e => erreurs.push(e.message));
  const lu = () => p2.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_run') || 'null'); } catch { return null; } });
  const rouvrir = async () => { await p2.reload({ waitUntil: 'networkidle' }); await p2.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 }); await p2.click('#menuDepart [data-menu="rogue"]'); await p2.waitForSelector('#runModal .rn-plan [data-a]', { timeout: 90000 }); };
  const clic = async (sel, attente = 300) => { await p2.click(sel); await p2.waitForTimeout(attente); };
  await p2.goto(BASE, { waitUntil: 'networkidle' });
  await p2.evaluate(r => { localStorage.clear(); localStorage.setItem('cap82_run', JSON.stringify(r)); }, debut);
  await rouvrir();
  // Du bureau à la feuille (le ballottage, s'il s'ouvre, se règle d'abord), puis « Au match ».
  const versLeDirect = async () => {
    for (let k = 0; k < 6 && !(await p2.$('#runModal [data-a="jouer"]:not([disabled])')); k++) {
      const b = await p2.$('#runModal [data-a="reclamer"]:not([disabled])') || await p2.$('#runModal [data-a="aller"]:not([disabled])') || await p2.$('#runModal [data-a="vers-bureau"]:not([disabled])');
      if (b) await b.click();
      await p2.waitForTimeout(400);
    }
    await clic('#runModal [data-a="jouer"]', 100);
    await p2.waitForSelector('#liveModal .live-fin', { state: 'visible', timeout: 20000 });
  };
  // Premier soir : le direct couvre la scène, son horloge tourne ; « Passer à la fin », « Continuer », le résultat.
  await versLeDirect();
  const couvre = await p2.evaluate(() => { const m = document.getElementById('liveModal'); let n = 0; for (let x = 20; x < 390; x += 70) for (let y = 20; y < 844; y += 80) { const el = document.elementFromPoint(x, y); if (!el || !m.contains(el)) n++; } return n === 0 && document.scrollingElement.scrollWidth <= 391; });
  const h0 = await p2.textContent('#liveModal .live-temps');
  await p2.waitForTimeout(1600);
  const h1 = await p2.textContent('#liveModal .live-temps');
  if (DOSSIER) await p2.screenshot({ path: `${DOSSIER}/essai-direct.png` });
  await clic('#liveModal .live-fin', 500);
  // Un nom du fil ouvre sa fiche, par-dessus le direct ; fermée, le direct est encore là.
  const fiche = { visible: () => p2.$eval('#hockeyCardModal', el => getComputedStyle(el).display !== 'none' && document.elementFromPoint(195, 300) && el.contains(document.elementFromPoint(195, 300))), fermer: () => clic('#closeHockeyCardBtn', 300) };
  await clic('#liveModal .live-feed [data-a="fiche"]', 600);
  const ficheAuDirect = await fiche.visible() && !!(await p2.textContent('#ficheTitre')).trim();
  await fiche.fermer();
  const directEncoreLa = !(await fiche.visible()) && !!(await p2.$('#liveModal .live-suite'));
  const auDirect = (await p2.$$eval('#liveModal .live-eq-buts > b', l => l.map(el => el.textContent.trim()))).join(' · ');
  await clic('#liveModal .live-suite', 500);
  await p2.waitForSelector('#runModal [data-a="continuer"]:not([disabled])', { timeout: 20000 });
  const auResultat = await pointageVu(p2), garde = pointageGarde(await lu());
  const vues = [];
  for (const v of ['recit', 'chiffres', 'feuille', 'sommaire']) { await clic(`#runModal [data-a="seg-r"][data-v="${v}"]`, 250); vues.push(await p2.$eval('#runModal .rn-cadre', el => el.querySelectorAll('.som-racine').length === 1 && el.scrollWidth <= el.clientWidth + 1)); }
  if (DOSSIER) await p2.screenshot({ path: `${DOSSIER}/essai-sommaire.png` });
  exiger('« Au match » ouvre le direct par-dessus la scène, et son horloge tourne', couvre && h0 !== h1, `${h0} → ${h1}`);
  exiger('le direct, le résultat et la run disent le même pointage', !!garde && auDirect === garde && auResultat === garde, `le direct ${auDirect}, le résultat ${auResultat}, la run ${garde}`);
  // Un nom du sommaire ouvre sa fiche, par-dessus la scène.
  await clic('#runModal .som-racine [data-a="fiche"]', 600);
  const ficheAuSommaire = await fiche.visible();
  await fiche.fermer();
  exiger('un nom du direct et un nom du sommaire ouvrent la fiche du joueur, par-dessus ; fermée, on est où on était', ficheAuDirect && directEncoreLa && ficheAuSommaire && !(await fiche.visible()), `au direct ${ficheAuDirect ? 'oui' : 'non'}, le direct encore là ${directEncoreLa ? 'oui' : 'non'}, au sommaire ${ficheAuSommaire ? 'oui' : 'non'}`);
  exiger('le résultat ouvre ses quatre vues (le récit, les chiffres, la feuille, le sommaire), sans glisser de côté', vues.length === 4 && vues.every(Boolean), vues.map(x => (x ? 'oui' : 'non')).join(' '));
  await clic('#runModal [data-a="continuer"]', 400);
  // Au bureau : une ligne de Mon club ouvre la fiche de ton joueur — sa saison chez toi, ses derniers matchs.
  if (await p2.$('#runModal [data-a="onglet"][data-v="club"]')) {
    await clic('#runModal [data-a="onglet"][data-v="club"]', 300);
    const nom = (await p2.textContent('#runModal .rn-cadre [data-a="fiche"] > span')).trim();
    await clic('#runModal .rn-cadre [data-a="fiche"]', 600);
    const lu = await p2.evaluate(() => ({ titre: document.getElementById('ficheTitre').textContent, corps: document.getElementById('hockeyCardBody').textContent, matchs: document.querySelectorAll('#hockeyCardBody .jr-table tbody tr').length, carte: !!document.querySelector('#hockeyCardBody .fiche-carte') }));
    exiger('une ligne de Mon club ouvre la fiche de ton joueur : sa carte, sa saison chez toi, ses derniers matchs', await fiche.visible() && lu.carte && nom.includes(lu.titre.trim().split(' ').at(-1)) && /Sa saison chez toi/i.test(lu.corps) && /Son salaire dans ta run/i.test(lu.corps) && lu.matchs >= 1, `${lu.titre} : ${lu.matchs} matchs`);
    await fiche.fermer();
    await clic('#runModal [data-a="onglet"][data-v="bureau"]', 300);
  }
  // Deuxième soir : quitter la page pendant le direct. Le match est compté ; rouvrir reprend à son résultat, le sommaire avec.
  if (await p2.$('#runModal [data-a="aller"]:not([disabled])')) {
    const n0 = (await lu()).matchs.length;
    await versLeDirect();
    await rouvrir();
    const R2 = await lu();
    exiger('quitter pendant le direct reprend au résultat du match, son sommaire avec', R2.matchs.length === n0 + 1 && R2.phase === 'resultat' && (await pointageVu(p2)) === pointageGarde(R2) && !(await p2.$('#liveModal .live-fin:visible')), `match ${R2.matchs.length}, phase ${R2.phase}`);
  } else informer('quitter pendant le direct', 'pas essayé : le premier soir menait ailleurs qu\'au bureau');
  await p2.close();
}
const faux = vu.pointages.filter(([a, b]) => !a || a !== b);
exiger('le match vu est le match joué : chaque pointage du résultat est celui que la run garde', vu.pointages.length >= 20 && !faux.length, faux.length ? faux.slice(0, 3).map(x => x.join(' ≠ ')).join(' · ') : `${vu.pointages.length} matchs`);
exiger('aucune erreur de page', !erreurs.length, [...new Set(erreurs)].slice(0, 3).join(' · '));
await browser.close();
verdict('Une saison au doigt');
