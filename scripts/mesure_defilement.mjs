/**
 * LE DÉFILEMENT DU VESTIAIRE, MESURÉ (S77).
 *
 *   node scripts/mesure_defilement.mjs http://localhost:8000
 *
 * Les cartes de joueur portent de l'holographique, des reflets et des
 * animations au repos : ce qui est beau sur trente cartes peut faire ramer un
 * téléphone sur trois cents. Ce script ne juge rien, il MESURE — à refaire à
 * chaque animation neuve sur une carte (CLAUDE.md, « Les cartes en ont le
 * look, et les effets (S77) »).
 *
 * À 390 px, écran ×2, tactile, processeur ralenti ×4 (CDP
 * `Emulation.setCPUThrottlingRate`, un téléphone moyen) : la liste « Tous »
 * d'un vestiaire défile pendant quatre secondes par `requestAnimationFrame`,
 * et on compte les images, leur durée moyenne, le 95e centile, la pire, et
 * les lentes (plus de 34 ms). Puis la même liste recopiée dix fois (des
 * clones statiques : le même CSS, aucun JavaScript par carte), puis deux
 * secondes au repos. La graine du tirage est fixe (les Oilers de 1985-86,
 * onze cartes brillantes sur vingt-huit : le pire cas qu'on ait trouvé).
 * `CSS='...'` injecte une feuille de plus, pour isoler un coupable.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const base = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(g => {
  let a = g >>> 0, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  Math.random = () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296; };
}, 7);
await page.route(u => !u.href.startsWith(base), r => r.abort());
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
await page.evaluate(() => document.getElementById('npGo').click());
await page.waitForSelector('#choixModal:not([hidden]) .tc', { timeout: 10000 });
await page.evaluate(() => document.querySelector('#choixModal .tc').click());
await page.waitForSelector('.pcard', { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(() => document.querySelector('button[data-val="LIST"]').click());
await page.waitForTimeout(600);
if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS });

const cdp = await page.context().newCDPSession(page);
async function defiler(quoi) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    let sc = document.getElementById('pool');
    while (sc && !(sc.scrollHeight - sc.clientHeight > 50 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    sc = sc || document.scrollingElement;
    sc.scrollTop = 0;
    const dts = [];
    const t0 = performance.now();
    let prec = t0;
    const vitesse = (sc.scrollHeight - sc.clientHeight) / 4000;
    await new Promise(fin => {
      const pas = t => {
        dts.push(t - prec); prec = t;
        sc.scrollTop = Math.min(sc.scrollHeight, (t - t0) * vitesse);
        if (t - t0 < 4000) requestAnimationFrame(pas); else fin();
      };
      requestAnimationFrame(pas);
    });
    dts.shift();
    const tri = dts.slice().sort((a, b) => a - b);
    return {
      cartes: document.querySelectorAll('.pcard').length, brillantes: document.querySelectorAll('.cj-holo').length,
      images: dts.length, moyenne: +(dts.reduce((a, b) => a + b, 0) / dts.length).toFixed(1),
      p95: +tri[Math.floor(tri.length * 0.95)].toFixed(1), pire: +tri[tri.length - 1].toFixed(1), lentes: dts.filter(x => x > 34).length,
    };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`${quoi.padEnd(22)} ${r.cartes} cartes (${r.brillantes} brillantes) · ${r.images} images en 4 s · ${r.moyenne} ms en moyenne · p95 ${r.p95} ms · pire ${r.pire} ms · ${r.lentes} lentes`);
}

await defiler('la liste du vestiaire');
await page.evaluate(() => {
  const pool = document.getElementById('pool');
  const cartes = [...pool.querySelectorAll('.pcard')];
  for (let k = 0; k < 10; k++) for (const c of cartes) pool.appendChild(c.cloneNode(true));
});
await page.waitForTimeout(800);
await defiler('dix fois plus');
const repos = await page.evaluate(async () => {
  const d = [];
  let prec = performance.now();
  const t0 = prec;
  await new Promise(fin => { const pas = t => { d.push(t - prec); prec = t; if (t - t0 < 2000) requestAnimationFrame(pas); else fin(); }; requestAnimationFrame(pas); });
  d.shift();
  return { moyenne: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1), lentes: d.filter(x => x > 34).length };
});
console.log(`${'au repos (sans ×4)'.padEnd(22)} ${repos.moyenne} ms par image · ${repos.lentes} lentes`);
await browser.close();
