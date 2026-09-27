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
/*
 * LA BOÎTE DE RÉCEPTION (S78) : un sommaire après chaque journée jouée, et
 * des messages qui bloquent la journée tant qu'on ne les a pas réglés. On
 * règle tout comme un joueur pressé : le sommaire se ferme, un choix prend
 * sa première option, un message bloquant sa réponse par défaut.
 */
async function regler() {
  for (let i = 0; i < 30; i++) {
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"]')) { await page.click('#choixModal:not([hidden]) .choix-plus-tard'); await page.waitForTimeout(250); continue; }
    if (await page.$('#choixModal:not([hidden]) .main-jouer')) { await page.click('#choixModal .main-jouer'); await page.waitForTimeout(1500); continue; }
    // Une main de palier (des cartes .tc) : la première carte jouable.
    const carte = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc:not([disabled])');
    if (carte) { await carte.click(); await page.waitForTimeout(500); continue; }
    if (await page.$('#choixModal:not([hidden]) .choix-option:not([disabled])')) { await choix(); continue; }
    const t = await page.$('#hubModal .hub-traiter');
    if (t) { const d = await page.$('#hubModal .hub-msg.bloque.ouvert [data-defaut]'); await (d || t).click(); await page.waitForTimeout(400); continue; }
    return;
  }
}
// Lancer la saison
await page.click('#mainBtn');
await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
await regler();
// Avancer un peu pour gagner des jetons
for (let i = 0; i < 3; i++) {
  await regler();
  const dix = await page.$('#hubModal .hub-dix');
  if (dix) { await dix.click(); await page.waitForTimeout(600); }
}
await regler();
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
const offres = await page.$$eval('#choixModal .choix-option.tc', e => e.map(x => (x.querySelector('.tc-nom, .cj-mini-carte .pcard-full-name') || x).textContent.replace(/\s+/g, ' ').trim()));
console.log(`3. le pack : ${offres.join(' · ')}`);
await page.click('#choixModal:not([hidden]) .choix-option.tc');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
await page.waitForTimeout(800);
const apres = (await page.textContent('#hubModal .hub-boutique')).trim();
const d = await page.evaluate(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties')); const p = JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)); return (p.partie.decisions || []).filter(x => x.rogue); });
console.log(`4. signé : la boutique dit « ${apres} » · décisions Rogue : ${JSON.stringify(d.map(x => ({ pack: x.rogue.pack, prix: x.rogue.prix, entre: x.ballottage && x.ballottage.entre })))}`);
// L'ATELIER (S78) : une édition de joueur, au joueur de ton choix.
await regler();
await page.click('#hubModal .hub-boutique');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option[data-choix="atelier"]', { timeout: 30000 });
await page.click('#choixModal:not([hidden]) .choix-option[data-choix="atelier"]');
const paquet2 = await page.waitForSelector('#choixModal:not([hidden]) .paquet', { timeout: 5000 }).catch(() => null);
if (paquet2) { await page.click('#choixModal .paquet', { force: true }); await page.waitForTimeout(300); await page.click('#choixModal .choix-tete').catch(() => {}); await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {}); }
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 30000 });
await page.waitForTimeout(500);
const editions = await page.$$eval('#choixModal .choix-option', e => e.map(x => x.dataset.choix));
await page.screenshot({ path: `${DOSSIER}/rogue-atelier.png` });
await page.click('#choixModal:not([hidden]) .choix-option');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option:not([disabled])', { timeout: 30000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${DOSSIER}/rogue-atelier-joueur.png` });
const premier = await page.$eval('#choixModal .choix-option:not([disabled])', x => x.textContent.replace(/\s+/g, ' ').trim());
await page.click('#choixModal:not([hidden]) .choix-option:not([disabled])');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
await page.waitForTimeout(800);
const dA = await page.evaluate(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties')); const p = JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)); return (p.partie.decisions || []).filter(x => x.deck === 'atelier'); });
console.log(`4b. l'atelier : ${editions.join(' · ')} → « ${premier} » · décision : ${JSON.stringify(dA.map(x => x.mutation && { cle: x.mutation.cle, rar: x.mutation.carte && x.mutation.carte.rar }))}`);
if (!dA.length) erreurs.push('l\'atelier n\'a laissé aucune décision');
// Fin de saison
await regler();
await page.click('#hubModal .hub-fin');
const oui = await page.waitForSelector('#choixModal:not([hidden]) .choix-option[data-choix="fin"]', { timeout: 5000 }).catch(() => null);
if (oui) await oui.click();
await page.waitForSelector('#hubModal .hub-suite', { timeout: 120000 });
// Ce qui reste à régler avant le bilan (un palier, un sommaire).
await regler();
// Prendre le dernier palier peut mener tout droit au bilan : on ne touche « Voir le bilan » que s'il est là.
const suite = await page.$('#hubModal .hub-suite');
if (suite && await suite.isVisible()) await suite.click();
await page.waitForSelector('.result .score', { timeout: 60000 });
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
