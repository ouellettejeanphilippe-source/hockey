/**
 * Test de fumée du mode bonus « Sur table », à 390 px.
 *
 *   python3 -m http.server 8000 &
 *   node scripts/smoke_table.mjs http://localhost:8000
 *
 * 1. la page démarre, l'option « Sur table » se choisit dans les options
 * 2. auto-draft jusqu'à 23/23 (le repêchage est le même : c'est le but)
 * 3. #mainBtn mène au tournoi (#hubModal), pas à la saison
 * 4. le plateau s'ouvre (#tableModal) : on touche une pièce, la glace
 *    s'allume, on joue des gestes, le dé se montre, le match va au bout
 * 5. le tournoi se finit, le bilan sort et le champion est nommé
 * 6. zéro erreur console, et rien ne déborde à 390 px
 */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const base = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text())) return;
  errors.push(`console: ${m.text()}`);
});
await page.route(u => !u.href.startsWith(base), r => r.abort());

await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#game', { state: 'visible', timeout: 30000 });
console.log('1. #game visible');

/* ---------- choisir le mode bonus ---------- */
await page.click('#openOptionsBtn');
await page.waitForSelector('[data-opt="bonus"]', { state: 'visible', timeout: 10000 });
await page.click('[data-opt="bonus"] button[data-val="TABLE"]');
await page.waitForTimeout(200);
const choisi = await page.$eval('[data-opt="bonus"] button[data-val="TABLE"]', b => b.classList.contains('on'));
if (!choisi) errors.push('l\'option « Sur table » ne se marque pas');
await page.click('#closeOptionsBtn').catch(() => page.keyboard.press('Escape'));
await page.waitForTimeout(200);
console.log(`   option « Sur table » choisie : ${choisi}`);

/* ---------- l'auto-draft, identique au test de fumée principal ---------- */
const MIN_SAL = 0.95;
const parseM = t => parseFloat(String(t || '').replace(/[^0-9.]/g, '')) || 0;
const lireSignes = async () => parseInt((await page.textContent('#cnt')).trim(), 10) || 0;
let signed = 0, guard = 0;
while (signed < 23 && guard++ < 320) {
  const rem = parseM(await page.textContent('#capAmt'));
  const maxPick = rem - Math.max(0, 23 - signed - 1) * MIN_SAL;
  const cards = await page.$$('.pcard');
  const infos = await page.$$eval('.pcard', els => els.map(el => ({
    price: parseFloat((el.querySelector('.pcard-price')?.textContent || '').replace(/[^0-9.]/g, '')) || 0,
    ok: !!el.querySelector('.btn-sign:not([disabled])'),
  })));
  let idx = infos.findIndex(c => c.ok && c.price <= maxPick);
  if (idx < 0) {
    const rr = await page.$('#rrP:not([disabled])') || await page.$('#rrT:not([disabled])') || await page.$('#rrS:not([disabled])');
    if (rr) { await rr.click(); await page.waitForTimeout(240); signed = await lireSignes(); continue; }
    let best = -1, bp = Infinity;
    infos.forEach((c, i) => { if (c.ok && c.price < bp) { best = i; bp = c.price; } });
    idx = best;
  }
  if (idx < 0) { const f = await page.$('#freeCapBtn'); if (f) { await f.click(); await page.waitForTimeout(200); signed = await lireSignes(); continue; } break; }
  await cards[idx].$eval('.btn-sign', b => b.click());
  await page.waitForTimeout(180);
  signed = await lireSignes();
}
console.log(`2. ${signed}/23 signés`);

const libelle = await page.$eval('#mainBtn', b => b.textContent.trim());
console.log(`3. le bouton dit : « ${libelle} »`);
if (!/table/i.test(libelle)) errors.push('le bouton ne mène pas au tournoi sur table');

/* ---------- le tournoi ---------- */
await page.click('#mainBtn');
await page.waitForSelector('#hubModal .hub-jouer', { timeout: 60000 });
const tete = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
console.log(`4. tournoi ouvert : ${tete}`);

/* ---------- le plateau : on joue vraiment un match ---------- */
await page.click('#hubModal .hub-jouer');
await page.waitForSelector('#tableModal .t-glace', { timeout: 20000 });
const cases = await page.$$eval('#tableModal .t-case', l => l.length);
console.log(`   la glace : ${cases} cases (attendu 63)`);
if (cases !== 63) errors.push(`la glace compte ${cases} cases`);

/*
 * Le joueur automatique : il fait ce qu'un pouce ferait, et il doit toucher à
 * TOUT — sinon il ne teste que la moitié du plateau. Il tire quand il peut,
 * joue une case allumée (patiner, passer, frapper), prend un geste de la
 * carte (ramasser, foncer, se placer devant, l'épaule ou le bâton sur le
 * porteur), et passe à la pièce jouable SUIVANTE quand il ne reste rien —
 * c'est ce « suivante » qui empêche de retoucher éternellement la même pièce.
 */
let gestes = 0, tours = 0, relances = 0, changements = 0, pieces = 0;
const vus = new Set();
while (tours++ < 1200) {
  if (!(await page.$('#tableModal .t-glace'))) break;
  const etat = await page.evaluate(() => ({
    suite: !!document.querySelector('#tableModal .t-suite'),
    relance: !!document.querySelector('#tableModal .t-relancer'),
    mien: !!document.querySelector('#tableModal .tb-tour.mien'),
    sel: !!document.querySelector('#tableModal .t-case.t-sel'),
    jouables: document.querySelectorAll('#tableModal .t-case.t-jouable:not(.t-sel)').length,
    offres: document.querySelectorAll('#tableModal .t-case.t-offre').length,
    contacts: document.querySelectorAll('#tableModal .t-case.t-offre-echec').length,
    tir: !!document.querySelector('#tableModal [data-geste="tir"]'),
    autres: [...document.querySelectorAll('#tableModal [data-geste]')].map(b => b.dataset.geste),
    fin: !!document.querySelector('#tableModal .t-resultat'),
    unites: !!document.querySelector('#tableModal .t-seg button:not(.on)'),
  }));
  if (etat.fin) break;
  if (etat.suite) {
    if (etat.relance && relances < 3) { await page.click('#tableModal .t-relancer'); relances++; await page.waitForTimeout(50); }
    await page.click('#tableModal .t-suite'); await page.waitForTimeout(50); continue;
  }
  if (!etat.mien) { await page.waitForTimeout(180); continue; }
  for (const g of etat.autres) vus.add(g);
  // Changer de trio deux fois dans le match : c'est la mécanique de fatigue.
  if (etat.unites && changements < 2) { await page.click('#tableModal .t-seg button:not(.on)'); changements++; await page.waitForTimeout(60); continue; }
  // Le contact : on le cherche exprès, c'est lui qui ouvre le duel
  // épaule / bâton sur la carte quand la cible porte la rondelle.
  if (etat.contacts && Math.random() < 0.55) {
    const n = await page.$$('#tableModal .t-case.t-offre-echec');
    if (n.length) { await n[Math.floor(Math.random() * n.length)].click(); gestes++; await page.waitForTimeout(50); continue; }
  }
  if (etat.tir) { await page.click('#tableModal [data-geste="tir"]'); gestes++; await page.waitForTimeout(50); continue; }
  if (etat.offres && Math.random() < 0.62) {
    const n = await page.$$('#tableModal .t-case.t-offre');
    await n[Math.floor(Math.random() * n.length)].click();
    gestes++; await page.waitForTimeout(50); continue;
  }
  if (etat.autres.length) {
    const n = await page.$$('#tableModal [data-geste]');
    await n[Math.floor(Math.random() * n.length)].click();
    gestes++; await page.waitForTimeout(50); continue;
  }
  if (etat.offres) {
    const n = await page.$$('#tableModal .t-case.t-offre');
    await n[Math.floor(Math.random() * n.length)].click();
    gestes++; await page.waitForTimeout(50); continue;
  }
  if (etat.jouables) { await page.click('#tableModal .t-case.t-jouable:not(.t-sel)'); pieces++; await page.waitForTimeout(50); continue; }
  const fp = await page.$('#tableModal .t-passer');
  if (fp) { await fp.click(); await page.waitForTimeout(60); continue; }
  break;
}

const pointage = await page.textContent('#tableModal .tb-score').catch(() => '');
console.log(`   ${gestes} gestes joués, ${relances} relance(s) d'équipe, ${changements} changement(s) de trio, ${pieces} changements de pièce`);
console.log(`   gestes offerts par la carte : ${[...vus].sort().join(', ') || 'aucun'}`);
for (const g of ['tir', 'echec', 'vol', 'ecran', 'foncer']) {
  if (!vus.has(g)) errors.push(`le geste « ${g} » n'a jamais été offert : le plateau ne le propose pas`);
}
console.log(`   ${pointage.replace(/\s+/g, ' ').trim()}`);
if (gestes < 15) errors.push(`seulement ${gestes} gestes joués sur le plateau : le match n'avance pas`);
await page.screenshot({ path: 'scripts/smoke-table.png' });

/* ---------- rien ne déborde à 390 px ---------- */
const deborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`   débordement horizontal : ${deborde} px`);
if (deborde > 1) errors.push(`le plateau déborde de ${deborde} px à 390 px`);

const fin = await page.$('#tableModal .t-resultat');
if (fin) await fin.click(); else await page.click('#tableModal .table-close');
await page.waitForTimeout(400);

/* ---------- le reste du tournoi ---------- */
await page.waitForSelector('#hubModal', { state: 'visible', timeout: 20000 });
let tour = 0;
while (tour++ < 20) {
  const sauter = await page.$('#hubModal .hub-sauter');
  if (!sauter) break;
  await sauter.click();
  await page.waitForTimeout(220);
}
const suite = await page.$('#hubModal .hub-suite');
if (suite) await suite.click(); else await page.click('#hubModal .hub-close');
await page.waitForSelector('#gameModal', { state: 'visible', timeout: 20000 });
const verdict = (await page.textContent('#gameModal .tr-verdict')).trim();
const rangees = await page.$$eval('#gameModal .tbl tbody tr', l => l.length);
console.log(`5. bilan : « ${verdict} » · ${rangees} rangées de tableau`);
if (!verdict) errors.push('le bilan du tournoi ne nomme pas de champion');
await page.screenshot({ path: 'scripts/smoke-table-bilan.png' });

console.log(errors.length ? `\n6. ÉCHEC — ${errors.length} erreur(s) :\n  ${errors.join('\n  ')}` : '\n6. zéro erreur console ✓');
await browser.close();
process.exit(errors.length ? 1 : 0);
