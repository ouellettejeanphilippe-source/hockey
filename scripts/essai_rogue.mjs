/*
 * ESSAI DU MODE ROGUE (S77, S79, S80) — à la main : une run du menu jusqu'au
 * bilan : le départ du classeur (les cartes du cartable tirées au hasard, on
 * en prend), une case de réserve débloquée, un réserviste relâché (sa carte
 * va au cartable), la boutique à la HUT, un pack signé dans la case libre,
 * un pack de cartes et un pack Contrats, l'inventaire (une carte jouée), le
 * cartable, la run au bilan (le mandat du proprio), le vestiaire (les jalons,
 * un déblocage acheté).
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
/*
 * UN MÉTA ET UN CARTABLE DE DÉPART (S80) : quatre cartes au cartable (le
 * classeur les tirera), assez d'écussons pour un déblocage, et une case de
 * réserve déjà débloquée. Une seule fois : les rechargements de la page
 * (changer de partie recharge) ne les écrasent pas.
 */
const CARTES = ['1985-86_MNS_8445724', '1995-96_PIT_8446951', '2007-08_DET_8468083', '1985-86_MTL_8449796'];
await page.addInitScript(cartes => {
  if (localStorage.getItem('essai80')) return;
  localStorage.setItem('essai80', '1');
  localStorage.setItem('cap82_cartable', JSON.stringify({ v: 1, migre: true, hist: true, joueurs: Object.fromEntries(cartes.map((k, i) => [k, { v: i === 0 ? { rare: 1 } : { commune: 1 }, n: 1 }])) }));
  localStorage.setItem('cap82_rogue', JSON.stringify({ ecussons: 400, deblocages: ['banc1'], collection: [], cartes: [], runs: 0, jalons: {} }));
}, CARTES);
const lireSauvegarde = () => page.evaluate(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties')); return JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)); });
const cartable = () => page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs) || {}));
const clesDe = sv => Object.values((sv && sv.roster) || {}).filter(Boolean).map(p => `${p.s}_${p.t}_${p.id}`);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');
await page.click('.menu-mode[data-genre="rogue"] [data-menu="nouvelle"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-intro.png` });
const intro = (await page.textContent('#choixModal .choix-sheet')).replace(/\s+/g, ' ');
if (!/proprio/.test(intro) || !/classeur/.test(intro)) erreurs.push('l\'écran de la run ne dit ni le mandat du proprio ni le classeur');
await choix();
/*
 * LE DÉPART DU CLASSEUR (S80, js/depart.js) : sans déblocage, une carte du
 * cartable tirée au hasard. On la voit, on touche sa carte (sa fiche), on la
 * prend, on commence.
 */
await page.waitForSelector('#departModal:not([hidden]) .dp-carte', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-depart-classeur.png` });
const tiree = await page.$$eval('#departModal .dp-carte', e => e.map(x => x.dataset.cle));
const entete = (await page.textContent('#departModal .choix-irl')).trim();
await page.click('#departModal .dp-voir');
await page.waitForTimeout(500);
const ficheClasseur = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
if (!ficheClasseur) erreurs.push('toucher une carte du classeur n\'ouvre pas sa fiche');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('#departModal .dp-prendre:not([disabled])');
await page.waitForTimeout(200);
await page.screenshot({ path: `${DOSSIER}/rogue-depart-pris.png` });
await page.click('#departModal .dp-commencer');
await page.waitForFunction(() => document.querySelectorAll('.slot .slot-name').length >= 20, null, { timeout: 90000 });
await page.waitForTimeout(800);
let sv = await lireSauvegarde();
const pris = (sv.rogue && sv.rogue.classeur && sv.rogue.classeur.pris) || [];
const dansAlignement = pris.length > 0 && pris.every(k => clesDe(sv).includes(k));
console.log(`1. le classeur (${entete}) : tirée ${tiree.join(', ')} · prise ${pris.join(', ') || '(aucune)'} · dans l'alignement : ${dansAlignement} · fiche au toucher : ${ficheClasseur}`);
if (tiree.length !== 1 || !dansAlignement) erreurs.push(`le départ du classeur : ${tiree.length} tirée(s), ${pris.length} prise(s), dans l'alignement ${dansAlignement}`);
const equipe = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.trim()).filter(Boolean));
const barre = (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`2. plombiers : ${equipe.length} joueurs (${equipe.slice(0, 4).join(', ')}…) · barre : ${barre} · cases de réserve de plus : ${sv.rogue.reserves}`);
await page.screenshot({ path: `${DOSSIER}/rogue-plombiers.png` });
/*
 * LA CASE DE RÉSERVE DÉBLOQUÉE ET LE RÉSERVISTE RELÂCHÉ (S80). La run a une
 * case de plus (« Réserve +1 », libre) et montre la suivante, cadenassée. On
 * relâche un réserviste : on confirme, sa carte va au cartable, sa case se
 * libère.
 */
const reserves = await page.$$eval('.slot .slot-role', e => e.map(x => x.textContent.trim()).filter(t => /Réserve \+/.test(t)));
const verrou = await page.$$eval('.slot.verrou', e => e.length);
console.log(`3. les réservistes de plus : ${reserves.join(' · ')} · ${verrou} case(s) cadenassée(s)`);
if (!reserves.some(t => /Réserve \+1/.test(t)) || !verrou) erreurs.push('la case de réserve débloquée ou la suivante cadenassée ne se voit pas');
const relache = await page.$('.slot-relacher');
await relache.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${DOSSIER}/rogue-reserves.png` });
const nomRelache = await relache.evaluate(b => b.closest('.slot').querySelector('.slot-name').textContent.trim());
const avantRoster = clesDe(sv);
await relache.click();
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-relacher.png` });
await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('cap82_cartable')); window.__avant = Object.keys(m.joueurs).length; });
await choix();
await page.waitForTimeout(600);
sv = await lireSauvegarde();
const partis = avantRoster.filter(k => !clesDe(sv).includes(k));
const auCartable = partis.length === 1 && (await cartable()).includes(partis[0]);
console.log(`4. relâché : ${nomRelache} (${partis.join(', ')}) · alignement ${clesDe(sv).length} joueurs · sa carte au cartable : ${auCartable}`);
if (partis.length !== 1 || !auCartable) erreurs.push(`le relâchement : ${partis.length} joueur(s) parti(s), au cartable ${auCartable}`);
await page.screenshot({ path: `${DOSSIER}/rogue-apres-relache.png` });
/*
 * LA BOÎTE DE RÉCEPTION (S78) : un sommaire après chaque journée jouée, et
 * des messages qui bloquent la journée tant qu'on ne les a pas réglés. On
 * règle tout comme un joueur pressé : le sommaire se ferme, un choix prend
 * sa première option, un message bloquant sa réponse par défaut.
 */
async function regler() {
  for (let i = 0; i < 30; i++) {
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"]')) { await page.click('#choixModal:not([hidden]) .choix-plus-tard'); await page.waitForTimeout(250); continue; }
    // Une récompense arrive en paquet scellé (S77) : on le déchire, puis on montre tout.
    const pq = await page.$('#choixModal:not([hidden]) .paquet');
    if (pq && await pq.isVisible()) {
      await page.click('#choixModal .paquet', { force: true }); await page.waitForTimeout(300);
      await page.click('#choixModal .choix-tete').catch(() => {});
      await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {});
      continue;
    }
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
// LE MANDAT DU PROPRIO (S80) : le hub dit la saison de la run et ce que le proprio veut.
const run = await page.textContent('#hubModal .hub-etat-run').catch(() => '');
console.log(`5. le hub : ${(run || '(pas de ligne de run)').replace(/\s+/g, ' ').trim()}`);
if (!/proprio veut/.test(run || '')) erreurs.push('le hub ne dit pas le mandat du proprio');
/*
 * « JUSQU'À LA PROCHAINE DÉCISION » (S79) remplace « +10 jours » : elle joue
 * les journées une à une et s'arrête sur ce qui demande le joueur. On attend
 * qu'elle ait fini (le bouton se réactive).
 */
async function prochaineDecision() {
  const p = await page.$('#hubModal .hub-prochaine');
  if (!p || !(await p.isVisible()) || await p.isDisabled()) return false;
  await p.click();
  await page.waitForFunction(() => !document.querySelector('#hubModal .hub-prochaine[disabled]'), null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(300);
  return true;
}
// Avancer un peu pour gagner des jetons
for (let i = 0; i < 3; i++) {
  await regler();
  await prochaineDecision();
}
await regler();
const avant = (await page.textContent('#hubModal .hub-boutique')).trim();
const jauge = async () => (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`6. au hub : la boutique dit « ${avant} » · barre : ${await jauge()}`);
if (!/Plafond restant/.test(await jauge())) erreurs.push('la barre du Rogue ne montre pas le plafond');
/*
 * LA BOUTIQUE (S79, js/magasin.js) : des rayons de packs à la HUT, chacun avec
 * sa fiche (ses chances par pack, le barème d'une carte, l'espace sous le
 * plafond), puis l'ouverture.
 */
const decisions = async () => ((await lireSauvegarde()).partie || {}).decisions || [];
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
console.log(`7. la boutique : ${nPacks} packs · ${(espace || '(pas de plafond)').replace(/\s+/g, ' ').trim()}`);
if (!espace) erreurs.push('la boutique ne dit pas l\'espace sous le plafond');
await acheter('j:hasard_argent', 'rogue-pack-fiche');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-pack.png` });
const offres = await page.$$eval('#choixModal .choix-option.tc', e => e.map(x => (x.querySelector('.tc-nom, .cj-mini-carte .pcard-full-name') || x).textContent.replace(/\s+/g, ' ').trim()));
console.log(`8. le pack Argent : ${offres.join(' · ')}`);
// Toucher la carte montre sa fiche, sans la prendre (S78) ; « Signer » la prend.
await page.click('#choixModal:not([hidden]) .choix-option.tc .tcj-carte');
await page.waitForTimeout(600);
const fiche = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
const encore = !!(await page.$('#choixModal:not([hidden]) .tcj-signer'));
if (!fiche || !encore) erreurs.push(`toucher la carte : fiche ${fiche}, choix toujours ouvert ${encore}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.click('#choixModal:not([hidden]) .choix-option.tc:not([aria-disabled="true"]) .tcj-signer');
/*
 * UNE CASE DE RÉSERVE LIBRE (S80) : avant « qui sort ? », le choix d'y
 * entrer sans que personne sorte. On la prend.
 */
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 10000 });
const titre = (await page.textContent('#choixModal .choix-titre')).trim();
let libre = false;
if (/où \?/.test(titre)) {
  await page.screenshot({ path: `${DOSSIER}/rogue-case-libre.png` });
  const b = await page.$('#choixModal:not([hidden]) .choix-option[data-choix="libre"]:not([disabled])');
  if (b) { await b.click(); libre = true; } else await choix('.choix-option[data-choix="sort"]');
}
if (!libre) {
  await page.waitForSelector('#choixModal:not([hidden]) .choix-option.avec-visage', { timeout: 10000 });
  await page.screenshot({ path: `${DOSSIER}/rogue-qui-sort.png` });
  await page.click('#choixModal:not([hidden]) .choix-option.avec-visage:not([disabled])');
}
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
await page.waitForTimeout(800);
let d = await decisions();
const signe = d.filter(x => x.achat && x.ballottage);
console.log(`9. signé : ${JSON.stringify(signe.map(x => ({ pack: x.achat.pack, entre: x.ballottage.entre, sort: x.ballottage.sort, i: x.ballottage.i })))} · « ${titre} » · case libre : ${libre} · barre : ${await jauge()}`);
if (!signe.length) erreurs.push('le pack de joueurs n\'a rien signé');
else if (!libre || signe[0].ballottage.sort !== null) erreurs.push(`la case de réserve libre n'a pas été offerte (« ${titre} »)`);
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
console.log(`10. inventaire : ${poche.join(' · ') || '(vide)'} · ${(plafond || '(pas de panneau)').replace(/\s+/g, ' ').trim()}`);
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
console.log(`11. jouée (${essais} essai(s)) : ${JSON.stringify(d.filter(x => x.joue).map(x => ({ id: x.joue.id, champs: Object.keys(x).filter(k => !['jour', 'joue', 'sel'].includes(k)) })))} · barre : ${await jauge()}`);
if (!jouee) erreurs.push('aucune carte de l\'inventaire n\'a pu se jouer (cinq essais)');
// LE CARTABLE (S79) : l'onglet Vestiaire, une fois la saison commencée.
await page.click('#navbar [data-page="repechage"]');
await page.waitForSelector('#pageCartable:not([hidden]) .ct-carte', { timeout: 20000 });
await page.screenshot({ path: `${DOSSIER}/rogue-cartable.png` });
console.log(`12. le cartable : ${(await page.textContent('.ct-comptes')).replace(/\s+/g, ' ').trim()} · ${await page.$$eval('[data-ct-equipe]', e => e.length)} cartes d'équipe`);
await page.click('#navbar [data-page="match"]');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 20000 });
// La fin de saison se JOUE (S79 : plus de « Fin de saison ») : décision après décision, jusqu'au bilan.
for (let i = 0; i < 200; i++) {
  await regler();
  const s2 = await page.$('#hubModal .hub-suite');
  if (s2 && await s2.isVisible()) break;
  if (await page.$('.result .score') && await page.isVisible('.result .score')) break;
  if (await prochaineDecision()) continue;
  const j = await page.$('#hubModal .hub-jour');
  if (j && await j.isVisible()) { await j.click(); await page.waitForTimeout(400); }
}
await page.waitForSelector('#hubModal .hub-suite, .result .score', { timeout: 120000 });
// Ce qui reste à régler avant le bilan (un palier, un sommaire).
await regler();
// Prendre le dernier palier peut mener tout droit au bilan : on ne touche « Voir le bilan » que s'il est là.
const suite = await page.$('#hubModal .hub-suite');
if (suite && await suite.isVisible()) await suite.click();
await page.waitForSelector('.result .score', { timeout: 60000 });
await page.waitForTimeout(2500);
/*
 * LA RUN AU BILAN (S80) : la saison de la run, le mandat du proprio, et la
 * suite — la saison suivante si le mandat est rempli (après les séries),
 * sinon une nouvelle run. « Rejouer la saison » n'existe pas dans une run.
 */
const blocRun = await page.$('#resultHost .rg-run');
if (blocRun) { await blocRun.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${DOSSIER}/rogue-run-bilan.png` }); }
const motRun = blocRun ? (await blocRun.textContent()).replace(/\s+/g, ' ').trim() : '';
const rejouer = await page.isVisible('#replayBtn').catch(() => false);
console.log(`13. la run au bilan : ${motRun.slice(0, 220) || '(rien)'}${rejouer ? ' · « Rejouer la saison » visible !' : ''}`);
if (!blocRun || rejouer) erreurs.push('le bilan ne montre pas la run, ou garde « Rejouer la saison »');
const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
const nCartable = (await cartable()).length;
console.log(`14. fin de saison : ${meta.ecussons} écussons · ${meta.runs} run · ${meta.saisons} saison · jalons ${Object.keys(meta.jalons || {}).join(', ') || '(aucun)'} · collection ${(meta.collection || []).length} joueurs · cartable ${nCartable} cartes · personnel ${(meta.personnel || []).length} · inventaire permanent ${Object.values(meta.inventaire || {}).reduce((a, n) => a + n, 0)} · dernière équipe ${(meta.derniereEquipe || []).length}`);
await page.click('#menuBtn');
await page.waitForSelector('#menuDepart');
await page.screenshot({ path: `${DOSSIER}/rogue-menu.png` });
// L'inventaire et le classeur, du menu (hors saison : on regarde, on ne joue pas).
await page.click('[data-menu="inventaire"]');
await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-inventaire-menu.png` });
console.log(`15. l'inventaire du menu : ${(await page.$$eval('#inventaireModal .inv-onglet', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).join(' · ')}`);
await page.click('#inventaireModal .choix-fermer');
await page.waitForSelector('#menuDepart');
/*
 * LE VESTIAIRE (S80) : les jalons en tête (atteints ou à faire, et ce qu'ils
 * offrent), puis les déblocages. On en achète un.
 */
await page.click('[data-menu="vestiaire"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-vestiaire.png` });
const nJalons = await page.$$eval('#choixModal .vs-jalon', e => e.length);
const ouverts = await page.$$eval('#choixModal .choix-option:not([disabled])', e => e.map(x => x.dataset.choix));
console.log(`16. le vestiaire : ${nJalons} jalons · ${ouverts.length} déblocage(s) achetable(s) : ${ouverts.join(', ')}`);
if (!nJalons) erreurs.push('le vestiaire ne montre pas les jalons');
const achat = ['classeur1', 'classeurTri', 'banc2'].find(k => ouverts.includes(k));
if (achat) {
  await page.click(`#choixModal:not([hidden]) .choix-option[data-choix="${achat}"]`);
  await page.waitForTimeout(600);
  const m2 = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
  const opt = await page.$(`#choixModal:not([hidden]) .choix-option[data-choix="${achat}"]`);
  if (opt) await opt.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${DOSSIER}/rogue-deblocage.png` });
  console.log(`17. débloqué : ${achat} · ${meta.ecussons} → ${m2.ecussons} écussons · ${(m2.deblocages || []).join(', ')}`);
  if (!(m2.deblocages || []).includes(achat)) erreurs.push(`le déblocage ${achat} n'a pas été acheté`);
} else erreurs.push('aucun déblocage du classeur ni des cases à acheter');
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
process.exit(erreurs.length ? 1 : 0);
