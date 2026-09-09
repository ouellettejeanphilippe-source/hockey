/**
 * Test de fumée (CLAUDE.md) avec Playwright, à 390 px de large.
 *
 *   python3 -m http.server 8000 &
 *   node scripts/smoke.mjs http://localhost:8000
 *
 * 1. la page démarre, #game visible
 * 2. auto-draft jusqu'à 23/23 dans le vestiaire de chaque tour (tirage
 *    VESTIAIRE : relances quand rien ne tient dans le budget, #freeCapBtn en
 *    dernier recours)
 * 3. #mainBtn actif, clic : .result .score et 23 .rrow
 * 4. zéro erreur console
 * 5. le même parcours en tirage LOTO (#rrL quand rien ne tient dans le budget)
 * Écrit des captures dans scripts/smoke-*.png.
 */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Playwright peut être installé globalement (npm root -g) plutôt que dans le dépôt
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const base = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
let netErrors = 0;   // images externes (assets.nhle.com) : réseau, pas l'application
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text())) { netErrors++; return; }
  errors.push(`console: ${m.text()}`);
});

// Hors du serveur local, tout est bloqué (portraits, sonde de l'API) : sans
// accès sortant, ces requêtes pendraient et « networkidle » n'arriverait jamais.
await page.route(u => !u.href.startsWith(base), r => r.abort());

await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#game', { state: 'visible', timeout: 30000 });
console.log('1. #game visible');

const MIN_SAL = 0.95;    // plancher réservé par case restante, en millions (marge sur les 0,775 M$ du barème)
const parseM = t => parseFloat(String(t || '').replace(/[^0-9.]/g, '')) || 0;
const lireSignes = async () => parseInt((await page.textContent('#cnt')).trim(), 10) || 0;

/** L'auto-draft : la main de chaque tour, jusqu'à 23/23. */
async function drafter(etiquette) {
  let signed = 0, guard = 0;
  while (signed < 23 && guard++ < 320) {
    const rem = parseM(await page.textContent('#capAmt'));
    const left = 23 - signed;
    // Budget maximal pour ce choix : au-delà, impossible de combler les cases
    // suivantes au salaire plancher. C'est la règle affichée au tableau de bord.
    const maxPick = rem - Math.max(0, left - 1) * MIN_SAL;

    const cards = await page.$$('.pcard');
    const infos = await page.$$eval('.pcard', els => els.map(el => ({
      price: parseFloat((el.querySelector('.pcard-price')?.textContent || '').replace(/[^0-9.]/g, '')) || 0,
      ok: !!el.querySelector('.btn-sign:not([disabled])'),
    })));

    // La main est dans l'ordre de l'unité : le premier qui tient dans le
    // budget fait l'affaire, l'auto-draft ne juge pas.
    let idx = infos.findIndex(c => c.ok && c.price <= maxPick);
    if (idx < 0) {
      // Rien de sûr : on relance (les trois clubs en loto ; passer, autre
      // équipe ou autre année en vestiaire), sinon on prend le moins cher
      const rr = await page.$('#rrL:not([disabled])') || await page.$('#rrP:not([disabled])')
        || await page.$('#rrT:not([disabled])') || await page.$('#rrS:not([disabled])');
      if (rr) { await rr.click(); await page.waitForTimeout(260); signed = await lireSignes(); continue; }
      let best = -1, bestPrice = Infinity;
      infos.forEach((c, i) => { if (c.ok && c.price < bestPrice) { best = i; bestPrice = c.price; } });
      idx = best;
    }

    if (idx < 0) {
      // Impasse : on fait ce que la bande de secours propose au joueur, libérer
      // de la masse salariale en retirant le plus gros contrat.
      const free = await page.$('#freeCapBtn');
      if (free) { await free.click(); await page.waitForTimeout(200); signed = await lireSignes(); continue; }
      break;
    }
    await cards[idx].$eval('.btn-sign', b => b.click());
    await page.waitForTimeout(200);
    signed = await lireSignes();
  }
  console.log(`   ${etiquette} : ${signed}/23 signés`);
  return signed;
}

let signed = await drafter('vestiaire');
console.log(`2. ${signed}/23 signés`);
await page.screenshot({ path: 'scripts/smoke-roster.png', fullPage: false });

const enabled = await page.$eval('#mainBtn', b => !b.disabled);
console.log(`3. #mainBtn actif : ${enabled}`);
if (enabled) {
  await page.click('#mainBtn');
  // La saison se regarde jour par jour : on saute à la fin, puis au bilan.
  await page.waitForSelector('#liveModal .live-fin', { timeout: 60000 });
  await page.click('#liveModal .live-fin');
  await page.waitForSelector('#liveModal .live-suite', { timeout: 10000 });
  console.log('   saison rejouée jour par jour');
  await page.click('#liveModal .live-suite');
  await page.waitForSelector('.result .score', { timeout: 60000 });
  const score = await page.textContent('.result .score');
  const rows = await page.$$eval('.rrow', r => r.length);
  console.log(`4. fiche ${score.trim()}, ${rows} rangées`);
  await page.screenshot({ path: 'scripts/smoke-result.png', fullPage: false });
  const po = await page.$('#playoffsBtn');
  if (po) { await po.click(); await page.waitForTimeout(500); console.log('   séries simulées'); }

  // Rejouer la saison : même alignement, mêmes clubs, d'autres dés. Le direct
  // des séries couvre l'écran : on le quitte d'abord.
  const liveSeries = await page.$('#liveModal .live-close');
  if (liveSeries && await liveSeries.isVisible()) { await liveSeries.click(); await page.waitForTimeout(300); }
  await page.click('#replayBtn');
  await page.waitForSelector('#liveModal .live-fin', { timeout: 60000 });
  await page.click('#liveModal .live-fin');
  await page.waitForSelector('#liveModal .live-suite', { timeout: 10000 });
  await page.click('#liveModal .live-suite');
  await page.waitForSelector('.result .score', { timeout: 60000 });
  console.log(`   rejouée : fiche ${(await page.textContent('.result .score')).trim()}`);

  // L'historique garde l'alignement : « Rejouer » relit les 23 joueurs et
  // repart une saison.
  await page.click('#openLeaderboardBtn');
  const entrees = await page.$$('.lb-replay');
  console.log(`   historique : ${entrees.length} alignements rejouables`);
  if (entrees.length) {
    await entrees[0].click();
    await page.waitForSelector('#liveModal .live-fin', { timeout: 90000 });
    await page.click('#liveModal .live-fin');
    await page.waitForSelector('#liveModal .live-suite', { timeout: 10000 });
    await page.click('#liveModal .live-suite');
    await page.waitForSelector('.result .score', { timeout: 60000 });
    console.log(`   reprise de l'historique : fiche ${(await page.textContent('.result .score')).trim()}`);
  }
}

// Le tirage LOTO : trois clubs par case, des relances. Même parcours. Le
// direct des séries couvre l'écran : on le quitte d'abord.
const live = await page.$('#liveModal .live-close');
if (live && await live.isVisible()) { await live.click(); await page.waitForTimeout(300); }
await page.click('#openOptionsBtn');
await page.click('.seg[data-opt="tirage"] button[data-val="LOTO"]');
await page.waitForTimeout(400);
await page.waitForSelector('#rrL', { timeout: 30000 });
const lotoSigned = await drafter('loto');
console.log(`5. loto : ${lotoSigned}/23 signés, relances restantes : ${(await page.textContent('#rrL .rr-count')).trim()}`);
await page.screenshot({ path: 'scripts/smoke-loto.png', fullPage: false });

console.log(`6. erreurs console : ${errors.length} (ressources externes non chargées : ${netErrors})`);
for (const e of errors) console.log('   ', e);
await browser.close();
process.exit((errors.length || signed < 23 || lotoSigned < 23) ? 1 : 0);
