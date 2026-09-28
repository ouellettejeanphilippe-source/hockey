/*
 * ESSAI DU MODE ROGUE (S77, S79) — à la main : une run du menu jusqu'au bilan :
 * la boutique à la HUT, un pack signé (qui sort, sous le plafond), un pack de
 * cartes et un pack Contrats, l'inventaire (une carte jouée), le cartable.
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
    // Un joueur offert (S78) : « Signer », puis « qui sort ? » se règle comme un choix.
    if (await page.$('#choixModal:not([hidden]) .tcj-signer')) { await page.click('#choixModal:not([hidden]) .tcj-signer'); await page.waitForTimeout(400); continue; }
    if (await page.$('#choixModal:not([hidden]) button.choix-option:not([disabled])')) { await choix('button.choix-option:not([disabled])'); continue; }
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
const jauge = async () => (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`2. au hub : la boutique dit « ${avant} » · barre : ${await jauge()}`);
if (!/Plafond restant/.test(await jauge())) erreurs.push('la barre du Rogue ne montre pas le plafond');
/*
 * LA BOUTIQUE (S79, js/magasin.js) : des rayons de packs à la HUT, chacun avec
 * sa fiche (ses chances par pack, le barème d'une carte, l'espace sous le
 * plafond), puis l'ouverture.
 */
const decisions = () => page.evaluate(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties')); const p = JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)); return p.partie.decisions || []; });
const dechirer = async () => {
  const paquet = await page.waitForSelector('#choixModal:not([hidden]) .paquet', { timeout: 60000 }).catch(() => null);
  if (paquet) { await page.click('#choixModal .paquet', { force: true }); await page.waitForTimeout(300); await page.click('#choixModal .choix-tete').catch(() => {}); await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {}); }
  await page.waitForTimeout(600);
};
const acheter = async (pack, capture) => {
  await page.click('#hubModal .hub-boutique');
  await page.waitForSelector('#magasinModal:not([hidden]) .pk-tuile', { timeout: 30000 });
  await page.click(`#magasinModal .pk-tuile[data-pack="${pack}"]`);
  await page.waitForSelector('#magasinModal .pk-fiche');
  if (capture) await page.screenshot({ path: `${DOSSIER}/${capture}.png` });
  const ok = await page.$('#magasinModal .pk-acheter:not([disabled])');
  // Pas assez de jetons : la fiche du pack se referme d'abord (« Retour »), puis la boutique — la fiche couvre le ✕.
  if (!ok) { await page.click('#magasinModal .pk-retour'); await page.click('#magasinModal .choix-fermer'); return false; }
  await ok.click();
  await dechirer();
  return true;
};
await page.click('#hubModal .hub-boutique');
await page.waitForSelector('#magasinModal:not([hidden]) .pk-tuile', { timeout: 30000 });
await page.screenshot({ path: `${DOSSIER}/rogue-boutique.png` });
const nPacks = await page.$$eval('#magasinModal .pk-tuile', e => e.length);
const espace = await page.textContent('#magasinModal .pk-plafond').catch(() => '');
await page.click('#magasinModal .choix-fermer');
console.log(`3. la boutique : ${nPacks} packs · ${(espace || '(pas de plafond)').replace(/\s+/g, ' ').trim()}`);
if (!espace) erreurs.push('la boutique ne dit pas l\'espace sous le plafond');
await acheter('j:hasard_argent', 'rogue-pack-fiche');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-pack.png` });
const offres = await page.$$eval('#choixModal .choix-option.tc', e => e.map(x => (x.querySelector('.tc-nom, .cj-mini-carte .pcard-full-name') || x).textContent.replace(/\s+/g, ' ').trim()));
console.log(`4. le pack Argent : ${offres.join(' · ')}`);
// Toucher la carte montre sa fiche, sans la prendre (S78) ; « Signer » la prend, puis on choisit qui sort.
await page.click('#choixModal:not([hidden]) .choix-option.tc .tcj-carte');
await page.waitForTimeout(600);
const fiche = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
const encore = !!(await page.$('#choixModal:not([hidden]) .tcj-signer'));
if (!fiche || !encore) erreurs.push(`toucher la carte : fiche ${fiche}, choix toujours ouvert ${encore}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.click('#choixModal:not([hidden]) .choix-option.tc:not([aria-disabled="true"]) .tcj-signer');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.avec-visage', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-qui-sort.png` });
const refusees = await page.$$eval('#choixModal .choix-option.avec-visage[disabled]', e => e.length);
await page.click('#choixModal:not([hidden]) .choix-option.avec-visage:not([disabled])');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
await page.waitForTimeout(800);
let d = await decisions();
const signe = d.filter(x => x.achat && x.ballottage);
console.log(`5. signé : ${JSON.stringify(signe.map(x => ({ pack: x.achat.pack, prix: x.achat.prix, entre: x.ballottage.entre, rar: x.ballottage.rar })))} · ${refusees} sortie(s) refusée(s) par le plafond · barre : ${await jauge()}`);
if (!signe.length) erreurs.push('le pack de joueurs n\'a rien signé');
// Un pack de cartes : tout va dans l'inventaire ; puis un pack Contrats (la masse salariale).
await regler();
for (const pack of ['c:mixte', 'c:contrats']) {
  if (!(await acheter(pack))) { console.log(`   (pas assez de jetons pour ${pack})`); continue; }
  await page.screenshot({ path: `${DOSSIER}/rogue-${pack.slice(2)}.png` });
  await page.click('#choixModal:not([hidden]) .choix-plus-tard');
  await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
  await regler();
}
/*
 * L'INVENTAIRE (S79, js/inventaire.js) : les cartes de la saison (elles SE
 * GARDENT jusqu'au moment voulu), les permanentes, le deck, le classeur, et
 * la masse salariale. On joue une carte : une décision datée du jour.
 */
await page.click('#hubModal .hub-inventaire');
await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-inventaire.png` });
const poche = await page.$$eval('#inventaireModal .bq-carte', e => e.map(x => x.querySelector('.bq-nom').textContent.trim()));
const plafond = await page.textContent('#inventaireModal .inv-plafond').catch(() => '');
console.log(`6. inventaire : ${poche.join(' · ') || '(vide)'} · ${(plafond || '(pas de panneau)').replace(/\s+/g, ' ').trim()}`);
if (!plafond) erreurs.push('l\'inventaire ne montre pas la masse salariale');
/*
 * UNE CARTE SANS CIBLE VALABLE (« Blessé à long terme » sans blessé) rouvre
 * l'inventaire au lieu de se jouer : les plombiers sont tirés au hasard, donc
 * la première carte ne se joue pas toujours. On essaie les cartes une à une
 * jusqu'à ce qu'une décision entre dans la sauvegarde.
 */
let jouee = false, essais = 0;
for (; essais < 5 && !jouee; essais++) {
  if (!(await page.$('#inventaireModal:not([hidden])'))) { await page.click('#hubModal .hub-inventaire'); await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 }); }
  const boutons = await page.$$('#inventaireModal .inv-jouer:not([disabled])');
  if (!boutons[essais]) break;
  await boutons[essais].click();
  await page.waitForTimeout(600);
  await regler();
  if (await page.$('#inventaireModal:not([hidden])')) continue;
  await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
  await regler();
  d = await decisions();
  jouee = d.some(x => x.joue);
}
if (await page.$('#inventaireModal:not([hidden])')) await page.click('#inventaireModal .choix-fermer');
d = await decisions();
console.log(`7. jouée (${essais} essai(s)) : ${JSON.stringify(d.filter(x => x.joue).map(x => ({ id: x.joue.id, champs: Object.keys(x).filter(k => !['jour', 'joue', 'sel'].includes(k)) })))} · barre : ${await jauge()}`);
if (!jouee) erreurs.push('aucune carte de l\'inventaire n\'a pu se jouer (cinq essais)');
// LE CARTABLE (S79) : l'onglet Vestiaire, une fois la saison commencée.
await page.click('#navbar [data-page="repechage"]');
await page.waitForSelector('#pageCartable:not([hidden]) .ct-carte', { timeout: 20000 });
await page.screenshot({ path: `${DOSSIER}/rogue-cartable.png` });
console.log(`8. le cartable : ${(await page.textContent('.ct-comptes')).replace(/\s+/g, ' ').trim()} · ${await page.$$eval('[data-ct-equipe]', e => e.length)} cartes d'équipe`);
await page.click('#navbar [data-page="match"]');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 20000 });
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
const cartable = await page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs) || {}).length);
console.log(`9. fin de saison : ${meta.ecussons} écussons · ${meta.runs} run · collection ${(meta.collection || []).length} joueurs · cartable ${cartable} cartes · personnel ${(meta.personnel || []).length} · inventaire permanent ${Object.values(meta.inventaire || {}).reduce((a, n) => a + n, 0)} · dernière équipe ${(meta.derniereEquipe || []).length}`);
await page.click('#menuBtn');
await page.waitForSelector('#menuDepart');
await page.screenshot({ path: `${DOSSIER}/rogue-menu.png` });
// L'inventaire et le classeur, du menu (hors saison : on regarde, on ne joue pas).
await page.click('[data-menu="inventaire"]');
await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-inventaire-menu.png` });
console.log(`10. l'inventaire du menu : ${(await page.$$eval('#inventaireModal .inv-onglet', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).join(' · ')}`);
await page.click('#inventaireModal .choix-fermer');
await page.waitForSelector('#menuDepart');
await page.click('[data-menu="vestiaire"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-vestiaire.png` });
const ouverts = await page.$$eval('#choixModal .choix-option:not([disabled])', e => e.map(x => x.textContent.trim().slice(0, 40)));
console.log(`11. le vestiaire : ${ouverts.length} déblocage(s) achetable(s)`);
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
