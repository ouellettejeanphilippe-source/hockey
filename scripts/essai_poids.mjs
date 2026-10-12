/**
 * LE POIDS DU PREMIER ÉCRAN (1.0, jalon 5). Ce que le joueur attend avant de voir le titre, mesuré comme un téléphone
 * le vit : le processeur ralenti quatre fois (Chrome, `Emulation.setCPUThrottlingRate`), à 390 px.
 *
 *   node scripts/essai_poids.mjs http://localhost:8000    # la version locale, modules tels quels
 *   node scripts/essai_poids.mjs http://localhost:8002    # le www/ de l'APK (mobile/assembler-www.mjs), servi à part
 *
 * Trois chiffres jugés : les requêtes jusqu'au calme du réseau, les octets compressés (gzip, ce qu'un serveur
 * envoie ; les polices et les images comptent tels quels), et le temps jusqu'au menu du titre, médiane de trois.
 * Les octets bruts et la taille de style.css sont dits sans être jugés : le temps du titre est ce qu'ils servaient.
 */
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { borne, informer, verdict } from './verdict.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || 'http://localhost:8000').replace(/\/$/, '');
const RALENTI = 4, ESSAIS = 3;
const MAX_REQUETES = 25, MAX_KO = 900, MAX_TITRE_MS = 1500;

const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const temps = [];
let requetes = 0, brut = 0, compresse = 0, css = 0;
for (let i = 0; i < ESSAIS; i++) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RALENTI });
  const corps = [];
  if (i === 0) page.on('response', r => corps.push(r.body().then(b => ({ url: r.url(), b })).catch(() => null)));
  const t0 = Date.now();
  await page.goto(BASE + '/');
  await page.waitForSelector('#menuDepart:not([hidden]) button', { timeout: 60000 });
  temps.push(Date.now() - t0);
  if (i === 0) {
    await page.waitForLoadState('networkidle');
    for (const x of (await Promise.all(corps)).filter(Boolean)) {
      requetes++;
      brut += x.b.length;
      compresse += /\.(woff2|png|jpe?g|webp)(\?|$)/.test(x.url) ? x.b.length : zlib.gzipSync(x.b).length;
      if (/style\.css/.test(x.url)) css = x.b.length;
    }
  }
  await ctx.close();
}
await navigateur.close();

const mediane = temps.slice().sort((a, b) => a - b)[Math.floor(ESSAIS / 2)];
const ko = n => Math.round(n / 1024);
borne(`requêtes au premier écran (moins de ${MAX_REQUETES})`, requetes, 1, MAX_REQUETES - 1);
borne(`octets compressés au premier écran (moins de ${MAX_KO} Ko)`, ko(compresse), 1, MAX_KO - 1, ' Ko');
borne(`le titre, processeur ×${RALENTI} (moins de ${MAX_TITRE_MS} ms, médiane de ${ESSAIS})`, mediane, 1, MAX_TITRE_MS - 1, ' ms');
informer('octets bruts', `${ko(brut)} Ko · style.css ${ko(css)} Ko · les temps ${temps.join(', ')} ms`);
verdict(`Le premier écran · ${BASE}`);
