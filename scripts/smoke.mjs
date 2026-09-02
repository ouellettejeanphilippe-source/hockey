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

await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#game', { state: 'visible', timeout: 30000 });
console.log('1. #game visible');

let signed = 0, guard = 0;
while (signed < 23 && guard++ < 200) {
  // Budget : une vedette tant qu'il reste plus de 4 M$ par case à combler,
  // sinon le joueur plaçable le moins cher (le bassin est trié par points).
  const btns = await page.$$('.card .add:not([disabled])');
  const remaining = parseFloat(((await page.textContent('#capAmt')) || '').replace(/[^0-9.\-]/g, '')) || 0;
  const perSlot = remaining / Math.max(1, 23 - signed);
  const btn = btns.length ? (perSlot > 4 ? btns[0] : btns[btns.length - 1]) : null;
  if (btn) {
    await btn.click();
    await page.waitForFunction(() => !document.querySelector('.empty-msg') || true);
    await page.waitForTimeout(150);
  } else {
    const rr = await page.$('#rrP:not([disabled])') || await page.$('#rrS:not([disabled])') || await page.$('#rrT:not([disabled])');
    if (!rr) break;
    await rr.click();
    await page.waitForTimeout(250);
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
