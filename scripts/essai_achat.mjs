/*
 * DEUX « ACHETER » COUP SUR COUP (oct.) — à la main, dans un navigateur, les saisons lentes comme sur un téléphone.
 * JP : *encore des doublons de packs achetés*. La fiche d'un pack restait ouverte après « Acheter » (au Marché, la
 * boutique vit dans une page), et le numéro d'achat se prenait à l'ouverture de la boutique : un second toucher
 * ouvrait le même pack une deuxième fois — le même tirage, la même décision `k:n`, qui remplaçait la première.
 * Vérifie qu'un achat ferme sa fiche, qu'un second toucher n'ouvre rien, et que chaque achat a son numéro ; puis,
 * la saison en cours, que « Aligner au mieux » est derrière le banc, là où l'alignement se règle en Rogue.
 *   node scripts/essai_achat.mjs http://localhost:8000
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { exiger, informer, verdict } from './verdict.mjs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const BASE = process.argv[2] || 'http://localhost:8000';
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
// Le paquet FLOTTE (une animation continue) : on le touche de force, et on attend qu'il ait fini (essai_depart pareil).
const dechirer = async () => {
  if (!(await page.$('#choixModal:not([hidden]) .paquet'))) return;
  await page.click('#choixModal .paquet', { force: true });
  await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 15000 }).catch(() => {});
};
const titre = () => page.evaluate(() => (document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || '');

// La première run : l'intro, le coach, les trois packs de départ, puis « Lancer la saison ».
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.click('.menu-mode[data-genre="rogue"] [data-menu="nouvelle"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option:not([disabled])');
await page.click('#choixModal:not([hidden]) .choix-option:not([disabled])');
await page.waitForFunction(() => /Ton coach/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''));
await page.click('#choixModal:not([hidden]) .choix-option:not([disabled])');
for (let i = 0; i < 5; i++) {
  await page.waitForFunction(() => /Pack de départ/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || '')
    || document.querySelector('#hubModal .hub-jour, #hubModal .hub-traiter, #mainBtn:not([disabled])'), null, { timeout: 120000 });
  if (!/Pack de départ/.test(await titre())) break;
  await dechirer();
  await page.click('#choixModal:not([hidden]) .choix-plus-tard');
  await page.waitForTimeout(400);
}
if (await page.$('#mainBtn:not([disabled])') && !(await page.$('#hubModal .hub-jour'))) {
  await page.click('#mainBtn');
  await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden])', { timeout: 120000 });
  await page.waitForTimeout(800);
}
for (let i = 0; i < 10 && !(await page.$('#choixModal[hidden]')); i++) {
  const o = await page.$('#choixModal:not([hidden]) .choix-option:not([disabled])');
  if (o) await o.click(); else await page.click('#choixModal:not([hidden]) .choix-plus-tard').catch(() => {});
  await page.waitForTimeout(400);
}

// La boutique, au Marché ; chaque saison met quatre secondes à arriver (le cache vidé).
await page.click('#navbar .navtab[data-section="marche"]');
await page.waitForSelector('#pageMarcheCorps [data-marche="boutique"]');
await page.click('#pageMarcheCorps [data-marche="boutique"]');
await page.waitForSelector('#pageMarche .pk-tuile');
await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('cap82'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
await page.route(/data\/seasons\/.*\.json/, async r => { await new Promise(x => setTimeout(x, 4000)); await r.continue(); });
const tuiles = await page.$$eval('#pageMarche .pk-tuile', ts => ts.map(x => x.dataset.pack));
const pack = tuiles.find(k => /hasard_bronze/.test(k)) || tuiles[0];
const acheter = async () => {
  await page.click(`#pageMarche .pk-tuile[data-pack="${pack}"]`);
  await page.click('#pageMarche .pk-fiche .pk-acheter');
};
await acheter();
const ficheRestee = !!(await page.$('#pageMarche .pk-fiche .pk-acheter'));
const second = await page.click('#pageMarche .pk-fiche .pk-acheter', { timeout: 2000 }).then(() => true, () => false);
// Le premier pack s'ouvre (le paquet) : on le laisse « Plus tard », puis on en achète un deuxième.
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet', { timeout: 60000 });
await dechirer();
await page.click('#choixModal:not([hidden]) .choix-plus-tard');
await page.waitForTimeout(1500);
await page.waitForSelector(`#pageMarche .pk-tuile[data-pack="${pack}"]`, { timeout: 30000 });
await acheter();
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet', { timeout: 60000 });
await page.waitForTimeout(1500);
const achats = await page.evaluate(() => (window.cap82.G.ligue.decisions || []).filter(d => d.achat).map(d => d.palier));
await dechirer();
await page.click('#choixModal:not([hidden]) .choix-plus-tard').catch(() => {});
await page.waitForTimeout(1500);

// DERRIÈRE LE BANC, en pleine saison, « Aligner au mieux » est là (JP : *le bouton de ligne automatique n'est pas
// toujours là ?* — il se cachait dès la saison lancée, c'est-à-dire là où l'alignement se règle en Rogue).
await page.click('#navbar .navtab[data-section="effectif"]');
await page.waitForFunction(() => window.cap82.G.banc, null, { timeout: 60000 });
await page.waitForTimeout(800);
const auBanc = !!(await page.$('#rosterBoard .ln-auto'));
if (auBanc) {
  await page.click('#rosterBoard .ln-auto');
  await page.click('#choixModal:not([hidden]) .choix-option[data-choix="equilibre"]');
  await page.waitForTimeout(500);
}
const lignesAuBanc = await page.evaluate(() => !!(window.cap82.G.banc && window.cap82.G.banc.lignes));
informer('achats enregistrés', achats.join(' · '));
exiger('« Acheter » ferme la fiche du pack', !ficheRestee);
exiger('un second toucher n\'ouvre pas le même pack', !second);
exiger('deux achats, deux numéros', achats.length === 2 && new Set(achats).size === 2, achats.join(', '));
exiger('derrière le banc, en pleine saison, « Aligner au mieux » est là', auBanc);
exiger('il règle les lignes du banc (elles partent au « Retour au match »)', lignesAuBanc);
exiger('zéro erreur de page', !erreurs.length, erreurs.slice(0, 2).join(' · '));
await browser.close();
verdict();
