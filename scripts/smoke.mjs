/**
 * Test de fumée (CLAUDE.md) avec Playwright, à 390 px de large.
 *
 *   python3 -m http.server 8000 &
 *   node scripts/smoke.mjs http://localhost:8000
 *
 * 1. la page démarre, #game visible
 * 2. auto-draft jusqu'à 23/23 (rerolls quand rien n'est plaçable)
 * 3. #mainBtn actif, clic : .result .score et 23 .rrow
 * 4. zéro erreur console
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

let signed = 0, guard = 0;
while (signed < 23 && guard++ < 260) {
  const rem = parseM(await page.textContent('#capAmt'));
  const left = 23 - signed;
  // Budget maximal pour ce choix : au-delà, impossible de combler les cases
  // suivantes au salaire plancher. C'est la règle affichée au tableau de bord.
  const maxPick = rem - Math.max(0, left - 1) * MIN_SAL;

  const cards = await page.$$('.pcard');
  const infos = await page.$$eval('.pcard', els => els.map(el => ({
    price: parseFloat((el.querySelector('.pcard-price .amt')?.textContent || '').replace(/[^0-9.]/g, '')) || 0,
    ok: !!el.querySelector('.btn-sign:not([disabled])'),
  })));

  // Le meilleur joueur qu'on peut encore se payer sans se bloquer ; le bassin
  // est trié par points, donc le premier qui passe est le plus productif.
  let idx = infos.findIndex(c => c.ok && c.price <= maxPick);
  if (idx < 0) {
    // Rien de sûr ici : on relance plutôt que de crever le plancher
    const rr = await page.$('#rrP:not([disabled])') || await page.$('#rrT:not([disabled])') || await page.$('#rrS:not([disabled])');
    if (rr) { await rr.click(); await page.waitForTimeout(220); signed = parseInt((await page.textContent('#cnt')).trim(), 10) || signed; continue; }
    // Plus de relance : on prend le moins cher disponible
    let best = -1, bestPrice = Infinity;
    infos.forEach((c, i) => { if (c.ok && c.price < bestPrice) { best = i; bestPrice = c.price; } });
    idx = best;
  }

  if (idx < 0) {
    // Impasse : on fait ce que la bande de secours propose au joueur, libérer
    // de la masse salariale en retirant le plus gros contrat.
    const free = await page.$('#freeCapBtn');
    if (free) { await free.click(); await page.waitForTimeout(200); signed = parseInt((await page.textContent('#cnt')).trim(), 10) || signed; continue; }
    const rr = await page.$('#rrP:not([disabled])') || await page.$('#rrS:not([disabled])') || await page.$('#rrT:not([disabled])');
    if (!rr) break;
    await rr.click();
    await page.waitForTimeout(220);
  } else {
    await cards[idx].$eval('.btn-sign', b => b.click());
    await page.waitForTimeout(160);
  }
  signed = parseInt((await page.textContent('#cnt')).trim(), 10) || 0;
}
console.log(`2. ${signed}/23 signés`);
await page.screenshot({ path: 'scripts/smoke-roster.png', fullPage: false });

const enabled = await page.$eval('#mainBtn', b => !b.disabled);
console.log(`3. #mainBtn actif : ${enabled}`);
if (enabled) {
  await page.click('#mainBtn');
  await page.waitForSelector('.result .score', { timeout: 60000 });
  const score = await page.textContent('.result .score');
  const rows = await page.$$eval('.rrow', r => r.length);
  console.log(`4. fiche ${score.trim()}, ${rows} rangées`);
  await page.screenshot({ path: 'scripts/smoke-result.png', fullPage: false });
  const po = await page.$('#playoffsBtn');
  if (po) { await po.click(); await page.waitForTimeout(500); console.log('   séries simulées'); }
}
console.log(`5. erreurs console : ${errors.length} (ressources externes non chargées : ${netErrors})`);
for (const e of errors) console.log('   ', e);
await browser.close();
process.exit((errors.length || signed < 23) ? 1 : 0);
