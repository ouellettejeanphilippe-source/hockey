/*
 * LA TOUTE PREMIÈRE RUN (oct.) — à la main, dans un navigateur : un méta et un cartable vides, le mode Rogue
 * lancé du menu. JP : *première fois que le mode commence, ouvrir des packs qui forment l'équipe de base*.
 * Vérifie que l'équipe sort des packs de départ (attaquants, défenseurs, gardiens), que chaque carte ouverte
 * est dans l'effectif ET au cartable, et que la run démarre avec elle.
 *   node scripts/essai_depart.mjs http://localhost:8000
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { exiger, informer, verdict } from './verdict.mjs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
const ouvert = () => page.waitForSelector('#choixModal:not([hidden]) .choix-sheet', { timeout: 60000 });
const titre = async () => ((await page.textContent('#choixModal:not([hidden]) .choix-titre').catch(() => '')) || '').trim();

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');
await page.click('.menu-mode[data-genre="rogue"] [data-menu="nouvelle"]');
await ouvert();
const intro = (await page.textContent('#choixModal .choix-sheet')).replace(/\s+/g, ' ');
exiger('l\'écran de la run annonce les packs de départ', /packs de départ/.test(intro), intro.match(/🥉[^·]*/)?.[0] || '');
await page.click('#choixModal:not([hidden]) .choix-option:not([disabled])');
await page.waitForFunction(() => /Ton coach/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
await page.click('#choixModal:not([hidden]) .choix-option:not([disabled])');

// Les packs : chacun se déchire (le paquet), puis « Pack suivant » ou « À la run ».
const packs = [];
for (let i = 0; i < 5; i++) {
  await page.waitForFunction(() => {
    const t = (document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || '';
    return /Pack de départ/.test(t) || document.querySelector('#hubModal .hub-jour, #hubModal .hub-traiter, #mainBtn');
  }, null, { timeout: 120000 });
  const t = await titre();
  if (!/Pack de départ/.test(t)) break;
  // Le paquet FLOTTE (une animation continue) : on le touche de force, et on attend qu'il ait fini (smoke.mjs fait pareil).
  if (await page.$('#choixModal:not([hidden]) .paquet')) {
    await page.click('#choixModal .paquet', { force: true });
    await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 15000 }).catch(() => {});
  }
  const n = (await page.$$('#choixModal .choix-options [data-apercu]')).length;
  packs.push({ t, n });
  await page.click('#choixModal:not([hidden]) .choix-plus-tard');
  await page.waitForTimeout(400);
}
informer('packs ouverts', packs.map(p => `${p.t.replace('Pack de départ · ', '')} (${p.n})`).join(' · '));
exiger('trois packs de départ : les attaquants, les défenseurs, les gardiens', packs.length === 3
  && /attaquants/.test(packs[0].t) && /défenseurs/.test(packs[1].t) && /gardiens/.test(packs[2].t), packs.map(p => p.t).join(' | '));

// La run démarre : l'effectif est celui des packs, et chaque carte est au cartable.
await page.waitForFunction(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties') || 'null'); return ix && ix.actif && localStorage.getItem(`cap82_partie_${ix.actif}`); }, null, { timeout: 120000 });
const etat = await page.evaluate(() => {
  const ix = JSON.parse(localStorage.getItem('cap82_parties'));
  const sv = JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`));
  const roster = Object.values((sv && sv.roster) || {}).filter(Boolean).map(p => `${p.s}_${p.t}_${p.id}`);
  const cartable = Object.keys((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs) || {});
  return { roster, cartable };
});
const total = packs.reduce((a, p) => a + p.n, 0);
informer('effectif et cartable', `${etat.roster.length} dans l'effectif · ${etat.cartable.length} au cartable · ${total} cartes ouvertes`);
exiger('chaque joueur de l\'effectif est sorti d\'un pack, et est au cartable', etat.roster.length >= 20 && etat.roster.every(k => etat.cartable.includes(k)), `${etat.roster.filter(k => !etat.cartable.includes(k)).length} hors du cartable`);
exiger('les packs ont montré toute l\'équipe', total === etat.cartable.length, `${total} cartes, ${etat.cartable.length} au cartable`);
exiger('zéro erreur de page', !erreurs.length, erreurs.slice(0, 2).join(' · '));
await browser.close();
verdict();
