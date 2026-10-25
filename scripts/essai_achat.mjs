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
import { traverserPaquet, fautesDePile } from './lib/paquet.mjs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const BASE = process.argv[2] || 'http://localhost:8000';
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
// Le paquet se déchire, puis sa pile se passe carte par carte jusqu'à la bande des choix (scripts/lib/paquet.mjs ; essai_depart pareil).
const dechirer = async () => {
  if (!(await page.$('#choixModal:not([hidden]) .paquet'))) return;
  for (const f of fautesDePile(await traverserPaquet(page), page.viewportSize().width)) erreurs.push(f);
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
  await page.click('#choixModal:not([hidden]) .choix-fermer');
  await page.waitForTimeout(400);
}
// « Lancer la saison » : la saison part derrière les Lignes, le bureau reste caché (la ligue suffit).
if (await page.$('#mainBtn:not([disabled])')) {
  await page.click('#mainBtn');
  await page.waitForFunction(() => window.cap82.G.ligue, null, { timeout: 120000 });
  await page.waitForTimeout(800);
}
for (let i = 0; i < 10 && !(await page.$('#choixModal[hidden]')); i++) {
  const o = await page.$('#choixModal:not([hidden]) :is(button.choix-option, .tc-prendre):not([disabled])');
  if (o) await o.click(); else await page.click('#choixModal:not([hidden]) .choix-fermer').catch(() => {});
  await page.waitForTimeout(400);
}

// La boutique, au Marché ; chaque saison met quatre secondes à arriver (le cache vidé).
await page.click('#navbar .navtab[data-section="marche"]').then(() => page.click('#sousNav .soustab[data-page="marche"]', { timeout: 3000 }).catch(() => {}));
await page.waitForSelector('#pageMarche .pk-tuile');
await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('cap82'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
await page.route(/data\/seasons\/.*\.json/, async r => { await new Promise(x => setTimeout(x, 4000)); await r.continue(); });
const tuiles = await page.$$eval('#pageMarche .pk-tuile', ts => ts.map(x => x.dataset.pack));
const pack = tuiles.find(k => k === 'j:bronze') || tuiles[0];
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
await page.click('#choixModal:not([hidden]) .choix-fermer');
await page.waitForTimeout(600);
// Un pack mixte passe ensuite à sa liste de signature (Jalon Q) : « Plus tard » est son ✕ aussi.
if (await page.$('#signatureModal:not([hidden]) .choix-fermer')) await page.click('#signatureModal:not([hidden]) .choix-fermer');
await page.waitForTimeout(900);
await page.waitForSelector(`#pageMarche .pk-tuile[data-pack="${pack}"]`, { timeout: 30000 });
await acheter();
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet', { timeout: 60000 });
await page.waitForTimeout(1500);
const achats = await page.evaluate(() => (window.cap82.G.ligue.decisions || []).filter(d => d.achat).map(d => d.palier));
await dechirer();
await page.click('#choixModal:not([hidden]) .choix-fermer').catch(() => {});
await page.waitForTimeout(600);
if (await page.$('#signatureModal:not([hidden]) .choix-fermer')) await page.click('#signatureModal:not([hidden]) .choix-fermer');
await page.waitForTimeout(900);

/*
 * SIGNÉ, IL QUITTE LA BOÎTE (oct.). JP : *j'achète un pack, je choisis, pis y a encore un pack dans la boîte*.
 * Les deux packs attendent leur signature ; chacun se signe comme le joueur le fait — « Aller au Marché » du
 * message (l'événement `cap82:marche`), le paquet, « Signer », l'échange (qui sort) —, et la boîte se vide.
 */
const enAttente = () => page.evaluate(() => (window.cap82.G.ligue.decisions || []).filter(d => d.achat && d.achat.sorte === 'joueurs' && !d.achat.scelle)
  .filter(d => !(window.cap82.G.ligue.decisions || []).some(x => x.palier === `${d.palier}:signe`)).length);
const attendaient = await enAttente();
const signes = [];
for (let k = 0; k < 2; k++) {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('cap82:marche', { detail: { signer: true } })));
  // Le pack se rouvre : un pack mixte montre d'abord ses cartes (le ✕ passe à la signature), puis la liste (Jalon R).
  await page.waitForSelector('#choixModal:not([hidden]), #signatureModal:not([hidden])', { timeout: 60000 }).catch(() => {});
  await dechirer();
  if (!(await page.$('#signatureModal:not([hidden])')) && await page.$('#choixModal:not([hidden]) .choix-fermer')) await page.click('#choixModal:not([hidden]) .choix-fermer');
  const b = await page.waitForSelector('#signatureModal:not([hidden]) .pcard:not(.locked) .btn-sign:not([disabled])', { timeout: 30000 }).catch(() => null);
  if (!b) break;
  await b.click();
  await page.waitForTimeout(600);
  // L'échange (oct., à la Yahoo Fantasy) : la sortie proposée est touchée d'avance ; sinon la première qui peut sortir ; « Signer ».
  if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="echange"]')) {
    if (await page.$('#choixModal .ech-signer[disabled]')) await page.click('#choixModal .ech-q:not([disabled])').catch(() => {});
    await page.click('#choixModal .ech-signer:not([disabled])').catch(() => {});
    await page.waitForTimeout(1200);
  }
  signes.push(await page.evaluate(() => (window.cap82.G.ligue.decisions || []).filter(d => /:signe$/.test(d.palier || '') && d.ballottage).length));
}
await page.waitForTimeout(1500);
const resteBoite = await page.evaluate(() => !!document.querySelector('#hubModal [data-msg="pack"]'));
const resteMarche = await page.evaluate(() => !!document.querySelector('.marche-signer'));
const restent = await enAttente();

// DERRIÈRE LE BANC, en pleine saison, « Aligner au mieux » est là (JP : *le bouton de ligne automatique n'est pas
// toujours là ?* — il se cachait dès la saison lancée, c'est-à-dire là où l'alignement se règle en Rogue).
await page.click('#navbar .navtab[data-section="effectif"]').then(() => page.click('#sousNav .soustab[data-page="alignement"]', { timeout: 3000 }).catch(() => {}));
await page.waitForFunction(() => window.cap82.G.banc, null, { timeout: 60000 });
await page.waitForTimeout(800);
const auBanc = !!(await page.$('#rosterBoard .ln-auto'));
if (auBanc) {
  await page.click('#rosterBoard .ln-auto');
  await page.click('#choixModal:not([hidden]) .choix-option[data-choix="equilibre"]');
  await page.waitForTimeout(500);
}
informer('achats enregistrés', achats.join(' · '));
exiger('« Acheter » ferme la fiche du pack', !ficheRestee);
exiger('un second toucher n\'ouvre pas le même pack', !second);
exiger('deux achats, deux numéros', achats.length === 2 && new Set(achats).size === 2, achats.join(', '));
informer('packs à signer', `${attendaient} avant · ${restent} après · signatures ${signes.join(' → ')}`);
exiger('les deux packs attendaient leur signature', attendaient === 2, `${attendaient}`);
exiger('signés, ils quittent la boîte et le Marché', restent === 0 && !resteBoite && !resteMarche, `${restent} en attente · boîte ${resteBoite} · Marché ${resteMarche}`);
exiger('derrière le banc, en pleine saison, « Aligner au mieux » est là', auBanc);
exiger('zéro erreur de page', !erreurs.length, erreurs.slice(0, 2).join(' · '));
await browser.close();
verdict();
