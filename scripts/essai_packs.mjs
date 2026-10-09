/*
 * ESSAI DES PACKS DE JOUEURS (V4.4) — à la main. JP : *des fois, le joueur pigé d'un pack s'ajoute pas*.
 * Une run Rogue riche en jetons achète des packs de joueurs, tour après tour : un tour sur deux, « Aligner au
 * mieux » derrière le banc d'abord (il remplaçait l'objet de l'alignement, et l'écran se détachait du moteur) ;
 * un pack sur trois environ attend « Plus tard » et se signe de la boîte. Après chaque signature, puis après une
 * semaine, chaque joueur signé (et pas sorti depuis) doit être dans l'alignement que l'écran montre, qui doit
 * être celui que le moteur aligne.
 *   node scripts/essai_packs.mjs http://localhost:8000 [dossier-captures]
 *   GRAINE=5 TOURS=6 pour un autre parcours.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { traverserPaquet, fautesDePile } from './lib/paquet.mjs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const BASE = process.argv[2] || 'http://localhost:8000';
const DOS = process.argv[3] || 'scripts';
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.stack); });
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
let n = 0;
const shot = async nom => { const f = `${DOS}/${String(++n).padStart(3, '0')}-${nom}.png`; await page.screenshot({ path: f }); return f; };
const log = (...a) => console.log(...a);
/*
 * LA PILE (1.0, oct.) : chaque carte d'un pack en grand, passée d'un geste (scripts/lib/paquet.mjs) — 80 % de la
 * largeur à 390 px, et les mêmes cartes au bout, dans la bande où l'on signe. « Tout voir » dans la boîte.
 */
let piles = 0;
const passerLaPile = async (o = {}) => {
  piles++;
  for (const f of fautesDePile(await traverserPaquet(page, o), page.viewportSize().width)) errs.push(`paquet ${piles} : ${f}`);
};

await page.addInitScript(() => {
  if (localStorage.getItem('essai80')) return;
  localStorage.setItem('essai80', '1');
  const cartes = ['1985-86_MNS_8445724', '1995-96_PIT_8446951', '2007-08_DET_8468083', '1985-86_MTL_8449796'];
  localStorage.setItem('cap82_cartable', JSON.stringify({ v: 1, migre: true, hist: true, joueurs: Object.fromEntries(cartes.map((k, i) => [k, { v: { commune: 1 }, n: 1 }])) }));
  localStorage.setItem('cap82_rogue', JSON.stringify({ ecussons: 400, deblocages: ['banc1'], collection: [], cartes: [], runs: 0, jalons: {} }));
});
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');
await page.click('.menu-mode[data-genre="rogue"] [data-menu="nouvelle"]');
const choix = async (sel = '.choix-option:not([disabled])') => { await page.waitForSelector(`#choixModal:not([hidden]) ${sel}`, { timeout: 8000 }); await page.click(`#choixModal:not([hidden]) ${sel}`); await page.waitForTimeout(300); };
await choix();
await page.waitForFunction(() => /Ton coach/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
await choix();
await page.waitForSelector('#departModal:not([hidden])', { timeout: 60000 });
const pr = await page.$('#departModal .dp-prendre:not([disabled])'); if (pr) await pr.click();
await page.click('#departModal .dp-commencer');
await page.waitForFunction(() => document.querySelectorAll('.slot .slot-name').length >= 20, null, { timeout: 90000 });
await page.waitForTimeout(800);
await page.click('#mainBtn');
await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });


await page.evaluate(() => { window.cap82.G.rogue.depart = 5000; });
const keysRoster = () => page.evaluate(() => Object.values(window.cap82.G.roster).filter(Boolean).map(p => `${p.s}_${p.t}_${p.id}`));
const decs = () => page.evaluate(() => (window.cap82.G.ligue.decisions || []).map(d => ({ jour: d.jour, palier: d.palier, b: d.ballottage ? { i: d.ballottage.i, entre: d.ballottage.entre, sort: d.ballottage.sort } : null, cases: !!d.cases })));
const etat = () => page.evaluate(() => ({
  choix: (document.querySelector('#choixModal:not([hidden]) .choix-sheet') || {}).dataset?.genre || (document.querySelector('#choixModal:not([hidden])') ? '?' : null),
  titre: (document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || '',
  sommaire: !!document.querySelector('#hubModal .hub-page[data-genre="sommaire"]'),
  traiter: !!document.querySelector('#hubModal .hub-traiter'),
  jour: !!document.querySelector('#hubModal .hub-jour:not([disabled])'),
}));
const rnd = (() => { let x = Number(process.env.GRAINE || 7); return () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
// Règle la boîte comme un joueur pressé (sans signer de pack).
async function regler(max = 40) {
  for (let i = 0; i < max; i++) {
    const e = await etat();
    if (e.choix) {
      if (await page.$('#choixModal:not([hidden]) .paquet')) { await passerLaPile({ tout: true }); await page.waitForTimeout(800); const f = await page.$('#choixModal:not([hidden]) .choix-fermer'); if (f) await f.click(); continue; }
      // L'écran de combat (V5) : une carte de vestiaire à garder avant « Jouer » (la première ; un pari passe par le dé, plus bas).
      if (await page.$('#choixModal:not([hidden]) .main-jouer')) { const v = await page.$('#choixModal .main-vest:not([disabled])'); if (v && await page.$('#choixModal .main-jouer:disabled')) { await v.click(); await page.waitForTimeout(200); } await page.click('#choixModal .main-jouer'); await page.waitForTimeout(1200); continue; }
      if (await page.$('#choixModal:not([hidden]) .poche-vendre')) { await page.click('#choixModal .poche-vendre'); await page.waitForTimeout(600); continue; }
      const carte = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc:not([disabled])'); if (carte) { await carte.click(); await page.waitForTimeout(500); continue; }
      if (await page.$('#choixModal:not([hidden]) .de-lancer:not([disabled]):not(.de-suite)')) { await page.focus('#choixModal .de-lancer'); await page.keyboard.press('Enter'); await page.waitForTimeout(2500); await page.click('#choixModal .de-suite').catch(() => {}); await page.waitForTimeout(500); continue; }
      if (await page.$('#choixModal:not([hidden]) .tcj-signer') && e.choix === 'ballottage') { await page.click('#choixModal:not([hidden]) .tcj-signer'); await page.waitForTimeout(400); continue; }
      if (await page.$('#choixModal:not([hidden]) .aln-confirmer')) { await page.click('#choixModal .aln-case[data-aln]:not([disabled])'); await page.click('#choixModal .aln-confirmer'); await page.waitForTimeout(600); continue; }
      if (await page.$('#choixModal:not([hidden]) button.choix-option:not([disabled])')) { await page.click('#choixModal:not([hidden]) button.choix-option:not([disabled])'); await page.waitForTimeout(400); continue; }
      const f = await page.$('#choixModal:not([hidden]) .choix-fermer'); if (f) { await f.click(); await page.waitForTimeout(300); continue; }
      return 'coince';
    }
    if (e.sommaire) { await page.click('#hubModal .hub-page[data-genre="sommaire"] .hub-page-fermer').catch(() => {}); await page.waitForTimeout(300); continue; }
    if (e.traiter) {
      await page.click('#hubModal .hub-traiter'); await page.waitForTimeout(400);
      const pack = await page.$('#hubModal .hub-msg.ouvert[data-msg="pack"]');
      if (pack) return 'pack';
      const main = await page.$('#hubModal .hub-msg.ouvert .hub-main-reglee'); if (main) { await main.click(); await page.waitForTimeout(600); continue; }
      const d = await page.$('#hubModal .hub-msg.ouvert [data-defaut]'); if (d && await d.isVisible()) { await d.click(); await page.waitForTimeout(500); continue; }
      const r = await page.$('#hubModal .hub-msg.ouvert .vie-rep'); if (r) { await r.click(); await page.waitForTimeout(500); continue; }
      return 'coince-boite';
    }
    return 'ok';
  }
  return 'max';
}
const club = async () => { await page.click('#navbar .navtab[data-section="club"]').catch(() => {}); await page.waitForTimeout(300); const mt = await page.$('#sousNav .soustab[data-page="match"]'); if (mt && await mt.isVisible()) { await mt.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(200); } };
const versBoutique = async () => {
  await page.click('#navbar .navtab[data-section="marche"]'); await page.waitForTimeout(300);
  if (!(await page.$('#pageMarcheCorps .hub-page[data-genre="boutique"]'))) {
    if (await page.$('#pageMarcheCorps .hub-page-retour')) { await page.click('#pageMarcheCorps .hub-page-retour'); await page.waitForTimeout(200); }
    await page.click('#pageMarcheCorps [data-marche="boutique"]');
  }
  await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
};
// Signe dans la fenêtre d'offre ouverte ; rend la clé signée.
async function signer() {
  await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
  const opts = await page.$$('#choixModal:not([hidden]) .choix-option.tc:not([aria-disabled="true"]) .tcj-signer');
  if (!opts.length) return null;
  const k = Math.floor(rnd() * opts.length);
  const cle = await opts[k].evaluate(b => b.closest('.choix-option').dataset.choix);
  await opts[k].click(); await page.waitForTimeout(500);
  // qui sort
  for (let etape = 0; etape < 2; etape++) {
    await page.waitForSelector('#choixModal:not([hidden]) .aln-case', { timeout: 10000 });
    const cases = await page.$$('#choixModal:not([hidden]) .aln-case[data-aln]:not([disabled])');
    if (!cases.length) { log('   aucune case permise'); await page.click('#choixModal:not([hidden]) .choix-fermer').catch(() => {}); return null; }
    await cases[Math.floor(rnd() * cases.length)].click(); await page.waitForTimeout(200);
    await page.click('#choixModal:not([hidden]) .aln-confirmer'); await page.waitForTimeout(700);
    if (!(await page.$('#choixModal:not([hidden]) .aln-case'))) break;
  }
  return cle;
}
const attendu = new Set();
let pb = 0;
for (let tour = 0; tour < Number(process.env.TOURS || 4); tour++) {
  await regler(); await club(); log('regler:', await regler());
  if (tour % 2 === 1) {
    await page.click('#navbar .navtab[data-section="effectif"]'); await page.waitForTimeout(1500);
    const am = await page.$('.ln-auto');
    if (am) { await am.click(); await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 5000 }); await page.click('#choixModal:not([hidden]) .choix-option[data-choix="equilibre"]'); await page.waitForTimeout(800); }
    else log('   pas de bouton au mieux');
    await club(); await page.waitForTimeout(2500); await regler();
    const meme = await page.evaluate(() => window.cap82.G.roster === window.cap82.G.ligue.you.roster); if (!meme) { pb++; log('   ⚠ après « Aligner au mieux », l\'écran ne montre plus l\'alignement du moteur'); }
  }
  await versBoutique();
  // ouvrir « Voir tout » et prendre un pack de joueurs
  if (await page.$('#pageMarche .pk-tout')) { await page.click('#pageMarche .pk-tout'); await page.waitForTimeout(200); }
  const packs = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-pack^="j:"]:not(.verrou):not(.pk-cher)', e => e.map(x => x.dataset.pack));
  const pack = packs[Math.floor(rnd() * packs.length)];
  // Plus rien à sa portée (les jetons, la boutique fermée de la V5) : le tour passe, il n'attend pas un pack qui n'est pas là.
  if (!pack) {
    log(`tour ${tour} : aucun pack de joueurs achetable`, await shot('sans-pack'));
    await club(); await regler();
    const sj = await page.$('#hubModal .hub-jour:not([disabled])');
    if (sj) { await sj.click(); await page.waitForFunction(() => !document.querySelector('#hubModal .hub-jour[disabled]'), null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(800); }
    continue;
  }
  await page.click(`#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-pack="${pack}"]`);
  await page.waitForSelector('#pageMarche .pk-fiche');
  const ok = await page.$('#pageMarche .pk-acheter:not([disabled])');
  if (!ok) { log('pas achetable', pack); await page.click('#pageMarche .pk-retour'); continue; }
  await ok.click();
  const pq = await page.waitForSelector('#choixModal:not([hidden]) .paquet', { timeout: 60000 }).catch(() => null);
  if (pq) { await passerLaPile(); await page.waitForTimeout(600); }
  let cle;
  const plusTard = rnd() < 0.35;
  if (plusTard) {
    await page.click('#choixModal:not([hidden]) .choix-fermer'); await page.waitForTimeout(800);
    await club(); const r = await regler(); log('   plus tard, boîte :', r);
    if (r === 'pack') { await page.click('#hubModal .hub-msg.ouvert .hub-pack-rouvrir'); await page.waitForTimeout(1500); }
    else { log('   ⚠ pas de message de pack après « Plus tard »'); pb++; continue; }
    cle = await signer();
  } else cle = await signer();
  await page.waitForTimeout(2500);
  const d = (await decs()).filter(x => x.b);
  const derniere = d.at(-1); if (derniere && derniere.palier === global.__dernPal) { log('   ⚠ aucune signature enregistrée'); pb++; } global.__dernPal = derniere && derniere.palier;
  if (derniere && derniere.b.sort) attendu.delete(derniere.b.sort);
  if (derniere && derniere.palier && /:signe$/.test(derniere.palier) && derniere.b) { cle = derniere.b.entre; attendu.add(cle); }
    let r = await keysRoster();
  const manque = [...attendu].filter(k => !r.includes(k));
  log(`tour ${tour} : ${pack}${plusTard ? ' (plus tard)' : ''} signé ${cle} · décision ${JSON.stringify(derniere)} · manque ${manque.join(',') || '—'}`);
  if (manque.length) { pb++; await shot('manque'); }
  // une semaine
  await club(); log('regler:', await regler());
  const sj = await page.$('#hubModal .hub-jour:not([disabled])');
  if (sj) { await sj.click(); await page.waitForFunction(() => !document.querySelector('#hubModal .hub-jour[disabled]'), null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(800); }
  log('regler:', await regler());
  r = await keysRoster();
  // retirer de « attendu » les sortants de décisions de ballottage récentes (blessures)
  for (const x of (await decs()).filter(x => x.b && x.b.sort)) attendu.delete(x.b.sort);
  const manque2 = [...attendu].filter(k => !r.includes(k));
  if (manque2.length) { pb++; log('   ⚠ après la semaine, manque', manque2.join(','), JSON.stringify((await decs()).filter(x => x.cases || x.b).slice(-6))); await shot('manque-semaine'); }
}
log(`piles passées carte par carte : ${piles}`);
if (!piles) errs.push('aucun paquet ouvert : la pile n\'a pas été traversée');
log(`\n${pb} problème(s) · erreurs console : ${errs.length ? errs.join(' | ') : 'aucune'}`);
await browser.close();
process.exit(pb || errs.length ? 1 : 0);
