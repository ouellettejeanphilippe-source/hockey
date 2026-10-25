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
const choix = async (sel = ':is(button.choix-option, .tc-prendre):not([disabled])') => { await page.waitForSelector(`#choixModal:not([hidden]) ${sel}`, { timeout: 8000 }); await page.click(`#choixModal:not([hidden]) ${sel}`); await page.waitForTimeout(300); };
// Le départ d'une run, quel qu'en soit l'ordre : les choix (les exigences, ton coach), ton joueur de concession, le classeur.
for (let i = 0; i < 12 && !(await page.$('#departModal:not([hidden])')); i++) {
  if (await page.$('#signatureModal:not([hidden]) .sig-liste .btn-sign:not([disabled])')) await page.click('#signatureModal .sig-liste .btn-sign:not([disabled])');
  else if (await page.$('#choixModal:not([hidden]) :is(button.choix-option, .tc-prendre):not([disabled])')) await choix();
  await page.waitForTimeout(1500);
}
// Le classeur, s'il y a une case à tirer ; sinon la run part sans lui.
await page.waitForFunction(() => !document.getElementById('departModal')?.hidden || document.querySelectorAll('.slot .slot-name').length >= 20, null, { timeout: 60000 }).catch(() => {});
if (await page.$('#departModal:not([hidden])')) {
  const pr = await page.$('#departModal [data-prendre]:not([disabled])'); if (pr) await pr.click();
  await page.click('#departModal .dp-commencer');
}
await page.waitForFunction(() => document.querySelectorAll('.slot .slot-name').length >= 20, null, { timeout: 90000 });
await page.waitForTimeout(800);
await page.click('#mainBtn');
// V9 : À faire porte tous les choix ; on attend qu'UN des boutons du bureau (avancer, régler) ou une fenêtre soit visible.
await page.waitForFunction(() => [...document.querySelectorAll('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option')].some(e => e.offsetParent), null, { timeout: 120000 });


await page.evaluate(() => { window.cap82.G.rogue.depart = 5000; });
const keysRoster = () => page.evaluate(() => Object.values(window.cap82.G.roster).filter(Boolean).map(p => `${p.s}_${p.t}_${p.id}`));
const decs = () => page.evaluate(() => (window.cap82.G.ligue.decisions || []).map(d => ({ jour: d.jour, palier: d.palier, b: d.ballottage ? { i: d.ballottage.i, entre: d.ballottage.entre, sort: d.ballottage.sort } : null, cases: !!d.cases })));
const etat = () => page.evaluate(() => ({
  choix: (document.querySelector('#choixModal:not([hidden]) .choix-sheet') || {}).dataset?.genre || (document.querySelector('#choixModal:not([hidden])') ? '?' : null),
  titre: (document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || '',
  sommaire: !!document.querySelector('#hubModal .hub-page[data-genre="sommaire"]'),
  traiter: !!document.querySelector('#hubModal .hub-traiter'),
  jour: !!document.querySelector('#hubModal .hub-jour:not([disabled])'),
  liste: (document.querySelector('#signatureModal:not([hidden]) .choix-titre') || {}).textContent || '',
}));
const rnd = (() => { let x = Number(process.env.GRAINE || 7); return () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
// Règle la boîte comme un joueur pressé (sans signer de pack).
async function regler(max = 40) {
  for (let i = 0; i < max; i++) {
    const e = await etat();
    // Le gros match se vit en direct (oct.) : au vestiaire à l'entracte, sinon « Passer à la fin », puis « Continuer » ; jamais de ✕.
    if (await page.evaluate(() => { const m = document.getElementById('liveModal'); return !!m && m.style.display === 'flex'; })) {
      const b = await page.$('#liveModal .live-entracte') || await page.$('#liveModal .live-suite') || await page.$('#liveModal .live-fin');
      if (b) await b.click().catch(() => {});
      await page.waitForTimeout(600); continue;
    }
    if (e.choix) {
      if (await page.$('#choixModal:not([hidden]) .paquet')) { await passerLaPile({ tout: true }); await page.waitForTimeout(800); const f = await page.$('#choixModal:not([hidden]) .choix-fermer'); if (f) await f.click(); continue; }
      // L'écran de combat (V5) : une carte de vestiaire à garder avant « Jouer » (la première ; un pari passe par le dé, plus bas).
      if (await page.$('#choixModal:not([hidden]) .duel-prop')) { const v = await page.$('#choixModal .main-vest:not([disabled])'); if (v && await page.$('#choixModal .duel-prop:disabled')) { await v.click(); await page.waitForTimeout(200); } await page.click('#choixModal .duel-prop[data-prop="garder"]'); await page.waitForTimeout(1200); continue; }
      const carte = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc [data-choix]'); if (carte) { await carte.click(); await page.waitForTimeout(500); continue; }
      if (await page.$('#choixModal:not([hidden]) .de-lancer:not([disabled]):not(.de-suite)')) { await page.focus('#choixModal .de-lancer'); await page.keyboard.press('Enter'); await page.waitForTimeout(2500); await page.click('#choixModal .de-suite').catch(() => {}); await page.waitForTimeout(500); continue; }
      if (await page.$('#choixModal:not([hidden]) .tcj-signer') && e.choix === 'ballottage') { await page.click('#choixModal:not([hidden]) .tcj-signer'); await page.waitForTimeout(400); continue; }
      // L'échange (oct.) : la sortie proposée touchée d'avance, sinon le premier qui peut sortir ; « Signer ».
      if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="echange"]')) { if (await page.$('#choixModal .ech-signer[disabled]')) await page.click('#choixModal .ech-q:not([disabled])').catch(() => {}); await page.click('#choixModal .ech-signer:not([disabled])').catch(() => {}); await page.waitForTimeout(600); continue; }
      if (await page.$('#choixModal:not([hidden]) [data-mode="choix"] .aln-ligne .aln-choisir:not([disabled])')) { await page.click('#choixModal .aln-ligne .aln-choisir:not([disabled])'); await page.waitForTimeout(600); continue; }
      if (await page.$('#choixModal:not([hidden]) :is(button.choix-option, .tc-prendre):not([disabled])')) { await page.click('#choixModal:not([hidden]) :is(button.choix-option, .tc-prendre):not([disabled])'); await page.waitForTimeout(400); continue; }
      const f = await page.$('#choixModal:not([hidden]) .choix-fermer'); if (f) { await f.click(); await page.waitForTimeout(300); continue; }
      return 'coince';
    }
    // Jalon R : la liste de signature — le ballottage se signe (sa case est celle du blessé), un pack attend « Plus tard ».
    if (e.liste && !e.choix) {
      if (/ballottage/i.test(e.liste) && await page.$('#signatureModal .btn-sign:not([disabled])')) await page.click('#signatureModal .btn-sign:not([disabled])');
      else await page.click('#signatureModal .choix-fermer');
      await page.waitForTimeout(500); continue;
    }
    if (e.sommaire) { await page.click('#hubModal .hub-page[data-genre="sommaire"] .hub-page-fermer').catch(() => {}); await page.waitForTimeout(300); continue; }
    // À FAIRE (V9) : le choix ouvert prend sa première option ; un pack qui attend sa signature rend la main à l'essai.
    // V12 : le choix vit dans le sous-onglet de sa maison (docs/refonte-v12.md).
    // V18-5 : on règle dans la Boîte, un choix ouvert à la fois (sa tête l'ouvre, ses options dans son corps).
    const ouv = await page.$('#hubModal .hub-msg.bloque');
    if (ouv && await ouv.isVisible()) {
      if (await ouv.evaluate(x => x.dataset.msg) === 'pack') return 'pack';
      if (!(await ouv.$('.hub-msg-corps'))) { await (await ouv.$('.hub-msg-tete')).click(); await page.waitForTimeout(400); continue; }
      const o = await ouv.$('.hub-msg-corps .choix-option:not([disabled]):not(.on)'); if (o) { await o.click(); await page.waitForTimeout(500); continue; }
      return 'coince-boite';
    }
    // Un sous-onglet sans rien qui presse : le Bureau rend la boîte.
    if (await page.evaluate(() => [...document.querySelectorAll('#hubModal .af-onglet')].some(x => x.checkVisibility()))) { await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300); continue; }
    if (e.traiter) { await page.click('#hubModal .hub-traiter'); await page.waitForTimeout(400); continue; }
    return 'ok';
  }
  return 'max';
}
const club = async () => { await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {}); await page.waitForTimeout(300); const mt = await page.$('#sousNav .soustab[data-page="match"]'); if (mt && await mt.isVisible()) { await mt.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(200); } };
const versBoutique = async () => {
  // La boutique est un sous-onglet des Cartes : un toucher, sans liste.
  await page.click('#navbar .navtab[data-section="marche"]').then(() => page.click('#sousNav .soustab[data-page="marche"]', { timeout: 3000 }).catch(() => {})); await page.waitForTimeout(300);
  await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
};
// Signe dans la fenêtre d'offre ouverte ; rend la clé signée.
// U18 : « Signer » demande qui part dès que quelqu'un sort. L'échange (oct., à la Yahoo Fantasy) : la sortie proposée,
// cerclée d'or, est touchée d'avance ; un tour sur deux on la signe, sinon on ouvre l'échange de la destination et on
// touche un sortant au hasard, puis « Signer ».
async function signer() {
  if (!(await page.$('#signatureModal:not([hidden])'))) {
    await page.waitForSelector('#choixModal:not([hidden]) .choix-fermer', { timeout: 60000 });
    await page.click('#choixModal:not([hidden]) .choix-fermer');
  }
  await page.waitForSelector('#signatureModal:not([hidden]) .pcard', { timeout: 60000 });
  const rangees = await page.$$('#signatureModal .pcard:not(.locked)');
  if (!rangees.length) { await page.click('#signatureModal .choix-fermer'); return null; }
  const k = Math.floor(rnd() * rangees.length);
  const cle = await rangees[k].evaluate(x => x.dataset.cle);
  const echange = '#choixModal:not([hidden]) .choix-sheet[data-genre="echange"]';
  if (rnd() < 0.5) {
    const libre = /personne ne sort/.test(await rangees[k].evaluate(x => x.querySelector('.pcard-dest').textContent));
    await (await rangees[k].$('.btn-sign')).click(); await page.waitForTimeout(500);
    const qs = await page.$(echange);
    if (libre) { if (qs) { pb++; log('   ⚠ une case libre, et « Signer » demande quand même qui sort'); } return cle; }
    if (!qs) { pb++; log('   ⚠ « Signer » pose le joueur sans demander qui sort'); return cle; }
    if (!(await page.$('#choixModal .ech-q.meilleure.on'))) { pb++; log('   ⚠ la meilleure sortie n\'est pas proposée, touchée d\'avance'); await page.click('#choixModal .ech-q:not([disabled])').catch(() => {}); }
    await page.click('#choixModal .ech-signer:not([disabled])');
    await page.waitForTimeout(700);
    return cle;
  }
  await (await rangees[k].$('.sig-changer')).click(); await page.waitForTimeout(500);
  await page.waitForSelector(`${echange} .ech-q`, { timeout: 10000 });
  const sorts = await page.$$('#choixModal:not([hidden]) .ech-q:not([disabled])');
  if (!sorts.length) { log('   personne ne peut sortir'); await page.click('#choixModal:not([hidden]) .choix-fermer').catch(() => {}); return null; }
  await sorts[Math.floor(rnd() * sorts.length)].click(); await page.waitForTimeout(300);
  await page.click('#choixModal .ech-signer:not([disabled])'); await page.waitForTimeout(700);
  return cle;
}
const attendu = new Set();
let pb = 0;
for (let tour = 0; tour < Number(process.env.TOURS || 4); tour++) {
  await regler(); await club(); log('regler:', await regler());
  if (tour % 2 === 1) {
    await page.click('#navbar .navtab[data-section="lignes"]'); await page.waitForTimeout(1500);
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
    if (await page.$('#signatureModal:not([hidden])')) { await page.click('#signatureModal .choix-fermer'); await page.waitForTimeout(500); }
    await club(); const r = await regler(); log('   plus tard, boîte :', r);
    if (r === 'pack') {
      // Le pack attend dans À faire (V9) : son option « Signer un joueur › » rouvre l'offre.
      const pk = await page.$('#hubModal .hub-msg[data-msg="pack"]');
      if (pk && !(await pk.$('.hub-msg-corps'))) { await (await pk.$('.hub-msg-tete')).click(); await page.waitForTimeout(400); }
      const rouvrir = await page.$('#hubModal .hub-msg[data-msg="pack"] .hub-msg-corps .choix-option:not([disabled])'); if (rouvrir && await rouvrir.isVisible()) await rouvrir.click();
      await page.waitForTimeout(1500);
    }
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
