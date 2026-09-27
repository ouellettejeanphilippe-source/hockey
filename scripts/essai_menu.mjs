/*
 * ESSAI DU MENU (S77) — à la main, pas un garde-fou : le premier lancement
 * montre le menu, « Nouvelle partie » de la saison ouvre l'écran de partie,
 * un rechargement retombe dans la partie, « Menu » rouvre le menu, une copie
 * s'ajoute à « Mes parties », et une vieille sauvegarde unique migre.
 *   node scripts/essai_menu.mjs http://localhost:8000 [dossier-captures]
 */
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart', { timeout: 20000 });
await page.screenshot({ path: `${DOSSIER}/menu-premier.png` });
console.log('1. premier lancement : le menu', await page.$eval('#menuDepart', m => [...m.querySelectorAll('.menu-mode-nom')].map(x => x.textContent).join(' · ')));
await page.click('.menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
console.log('2. nouvelle saison : l\'écran « Nouvelle partie » s\'ouvre');
await page.click('#closePartieBtn');
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('3. rechargement : menu visible ?', !!(await page.$('#menuDepart')), '· repêchage visible ?', await page.isVisible('#game'));
await page.click('#menuBtn');
await page.waitForSelector('#menuDepart');
await page.screenshot({ path: `${DOSSIER}/menu-en-jeu.png` });
const n0 = await page.$$eval('.menu-partie', l => l.length);
await page.click('.menu-partie [data-menu="copier"]');
await page.waitForTimeout(300);
const n1 = await page.$$eval('.menu-partie', l => l.length);
console.log('4. une copie :', n0, '→', n1, 'parties');
await page.screenshot({ path: `${DOSSIER}/menu-parties.png`, fullPage: false });
await page.click('.menu-fermer');
console.log('5. fermé :', !(await page.$('#menuDepart')));
// 6. La migration : une vieille sauvegarde unique, un navigateur neuf.
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
const vieille = await page.evaluate(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties')); return localStorage.getItem(`cap82_partie_${ix.actif}`); });
await p2.evaluate(v => { localStorage.clear(); localStorage.setItem('cap82_save', v); }, vieille);
await p2.reload({ waitUntil: 'networkidle' });
await p2.waitForSelector('#menuDepart', { timeout: 20000 });
const mig = await p2.evaluate(() => ({ vieille: !!localStorage.getItem('cap82_save'), parties: JSON.parse(localStorage.getItem('cap82_parties') || '{"parties":[]}').parties.length, continuer: !!document.querySelector('.menu-continuer') }));
console.log('6. migration :', JSON.stringify(mig));
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
