/**
 * LA PLANCHE DES CARTES (S78) : une carte par saison, toutes côte à côte, pour
 * juger les designs d'année d'un coup d'oeil (js/cartes.js `DESIGNS`).
 *
 *   node scripts/planche_cartes.mjs http://localhost:8000 [dossier] [--mini]
 *
 * Deux joueurs par saison (le meilleur pointeur et un gardien, pour voir un
 * portrait détouré et une vieille photo quand il y en a), dans la VRAIE carte
 * du vestiaire (`playerCardEl`) — ou la carte mini (`carteMiniHtml`) avec
 * `--mini`. La planche se photographie par tranches de saisons.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'scripts';
const MINI = process.argv.includes('--mini');
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');
await page.click('.menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
await page.waitForSelector('#npGo', { timeout: 30000 });
await page.click('#npGo');
await page.waitForSelector('#choixModal:not([hidden]) .tc', { timeout: 20000 });
await page.evaluate(() => document.querySelector('#choixModal .tc').click());
await page.waitForSelector('#pool .pcard', { timeout: 30000 });
await page.evaluate(() => document.querySelector('button[data-val="LIST"]').click());
await page.waitForTimeout(400);

const saisons = await page.evaluate(() => fetch('data/index.json').then(r => r.json()).then(i => i.seasons));
for (let t = 0; t < saisons.length; t += 12) {
  const tranche = saisons.slice(t, t + 12);
  await page.evaluate(async ({ tranche, mini }) => {
    const { playerCardEl, carteMiniHtml, getShard } = window.cap82.dev;
    const pool = document.getElementById('pool');
    // La planche se pose par-dessus tout, pleine page : le vestiaire défile dans son panneau et rognerait la photo.
    if (!pool.dataset.planche) { document.body.appendChild(pool); pool.dataset.planche = '1'; Object.assign(pool.style, { position: 'absolute', top: '0', left: '0', zIndex: '9999', background: '#0b0d11', padding: '12px', gap: '10px', display: 'grid' }); }
    pool.innerHTML = '';
    pool.style.gridTemplateColumns = mini ? 'repeat(8, 138px)' : 'repeat(8, 150px)';
    for (const s of tranche) {
      const e = await getShard(s);
      const pts = p => p.pt ?? ((p.g || 0) + (p.a || 0));
      const pat = e.players.filter(p => p.p !== 'G' && (p.gp || 0) >= 30).sort((a, b) => pts(b) - pts(a))[0];
      const gar = e.players.filter(p => p.p === 'G' && (p.gp || 0) >= 20).sort((a, b) => (b.gp || 0) - (a.gp || 0))[0];
      for (const p of [pat, gar].filter(Boolean)) {
        if (mini) { const d = document.createElement('div'); d.innerHTML = carteMiniHtml(p); pool.appendChild(d.firstElementChild); }
        else pool.appendChild(playerCardEl(p));
      }
    }
  }, { tranche, mini: MINI });
  await page.waitForTimeout(1800);
  const boite = await page.evaluate(() => { const r = document.getElementById('pool').getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top + scrollY), width: Math.min(r.width, 1280), height: r.height }; });
  await page.screenshot({ path: `${DOSSIER}/planche-${MINI ? 'mini-' : ''}${tranche[0]}.png`, clip: boite, fullPage: true });
  console.log(`   ${tranche[0]} → ${tranche[tranche.length - 1]}`);
}
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await navigateur.close();
