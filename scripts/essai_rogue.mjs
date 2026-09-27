/*
 * ESSAI DU MODE ROGUE (S77) — à la main : une run du menu jusqu'au bilan.
 *   node scripts/essai_rogue.mjs http://localhost:8000 [dossier-captures]
 */
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
const choix = async (sel = '.choix-option:not([disabled])') => { await page.waitForSelector(`#choixModal:not([hidden]) ${sel}`, { timeout: 60000 }); await page.click(`#choixModal:not([hidden]) ${sel}`); await page.waitForTimeout(300); };

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');
await page.click('.menu-mode[data-genre="rogue"] [data-menu="nouvelle"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-intro.png` });
await choix();
await page.waitForFunction(() => document.querySelectorAll('.slot .slot-name').length >= 20, null, { timeout: 90000 });
await page.waitForTimeout(800);
const equipe = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.trim()).filter(Boolean));
const barre = (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`1. plombiers : ${equipe.length} joueurs (${equipe.slice(0, 4).join(', ')}…) · barre : ${barre}`);
await page.screenshot({ path: `${DOSSIER}/rogue-plombiers.png` });
// Lancer la saison
await page.click('#mainBtn');
await page.waitForSelector('#hubModal .hub-jour, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
for (let i = 0; i < 4 && await page.$('#choixModal:not([hidden]) .choix-option'); i++) await choix();
// Avancer un peu pour gagner des jetons
for (let i = 0; i < 3; i++) {
  if (await page.$('#choixModal:not([hidden]) .choix-option')) { await choix(); continue; }
  if (await page.$('#choixModal:not([hidden]) .main-jouer')) { await page.click('#choixModal .main-jouer'); await page.waitForTimeout(1500); continue; }
  const dix = await page.$('#hubModal .hub-dix');
  if (dix) { await dix.click(); await page.waitForTimeout(600); }
}
while (await page.$('#choixModal:not([hidden]) .choix-option, #choixModal:not([hidden]) .main-jouer')) {
  if (await page.$('#choixModal:not([hidden]) .main-jouer')) { await page.click('#choixModal .main-jouer'); await page.waitForTimeout(1500); } else await choix();
}
const avant = (await page.textContent('#hubModal .hub-boutique')).trim();
console.log(`2. au hub : la boutique dit « ${avant} » · barre : ${(await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim()}`);
await page.click('#hubModal .hub-boutique');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 30000 });
await page.screenshot({ path: `${DOSSIER}/rogue-boutique.png` });
await page.click('#choixModal:not([hidden]) .choix-option[data-choix="joueurs"]');
// Le pack s'ouvre comme un vrai paquet (S77) : on le déchire, puis on touche encore pour tout montrer.
const paquet = await page.waitForSelector('#choixModal:not([hidden]) .paquet', { timeout: 60000 }).catch(() => null);
if (paquet) { await page.click('#choixModal .paquet', { force: true }); await page.waitForTimeout(300); await page.click('#choixModal .choix-tete').catch(() => {}); await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {}); }
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${DOSSIER}/rogue-pack.png` });
const offres = await page.$$eval('#choixModal .choix-option.tc', e => e.map(x => (x.querySelector('.tc-nom') || x).textContent.trim()));
console.log(`3. le pack : ${offres.join(' · ')}`);
await page.click('#choixModal:not([hidden]) .choix-option.tc');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
await page.waitForTimeout(800);
const apres = (await page.textContent('#hubModal .hub-boutique')).trim();
const d = await page.evaluate(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties')); const p = JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)); return (p.partie.decisions || []).filter(x => x.rogue); });
console.log(`4. signé : la boutique dit « ${apres} » · décisions Rogue : ${JSON.stringify(d.map(x => ({ pack: x.rogue.pack, prix: x.rogue.prix, entre: x.ballottage && x.ballottage.entre })))}`);
// Fin de saison
await page.click('#hubModal .hub-fin');
const oui = await page.waitForSelector('#choixModal:not([hidden]) .choix-option[data-choix="fin"]', { timeout: 5000 }).catch(() => null);
if (oui) await oui.click();
await page.waitForSelector('#hubModal .hub-suite', { timeout: 120000 });
// Le palier offert avant le bilan s'ouvre de lui-même : « Plus tard ».
for (let i = 0; i < 4 && await page.$('#choixModal:not([hidden])'); i++) { const f = await page.$('#choixModal:not([hidden]) .choix-fermer'); if (f) await f.click(); else await choix(); await page.waitForTimeout(400); }
await page.click('#hubModal .hub-suite');
await page.waitForTimeout(2500);
const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
console.log(`5. fin de saison : ${meta.ecussons} écussons · ${meta.runs} run · collection ${(meta.collection || []).length} joueurs · dernière équipe ${(meta.derniereEquipe || []).length}`);
await page.click('#menuBtn');
await page.waitForSelector('#menuDepart');
await page.screenshot({ path: `${DOSSIER}/rogue-menu.png` });
await page.click('[data-menu="vestiaire"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-vestiaire.png` });
const ouverts = await page.$$eval('#choixModal .choix-option:not([disabled])', e => e.map(x => x.textContent.trim().slice(0, 40)));
console.log(`6. le vestiaire : ${ouverts.length} déblocage(s) achetable(s)`);
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
