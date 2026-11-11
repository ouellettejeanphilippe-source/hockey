/*
 * UNE RUN AU DOIGT (V28, docs/refonte-v28.md § 10 « La run », « Neuf touchers », « Le match vu est le match joué »).
 * Chromium, à 390 × 844, joue une run entière du Rogue par ses boutons, du coach à l'écran de fin, sans jamais lire
 * autre chose que l'écran ; le hasard de la page est semé (`GRAINE`), le parcours se rejoue au toucher près.
 *
 *   1. la run va au bout : le départ, le camp, chaque case, chaque match, les arrêts, la fin d'acte, l'écran de fin ;
 *   2. une semaine gagnée (y aller, jouer, signer un joueur d'une porte) tient en neuf touchers au plus ;
 *   3. le match vu est le match joué : le pointage final de la scène est celui que la run garde ;
 *   4. quitter au menu et rouvrir reprend la run où elle était ;
 *   5. la fin verse ses médailles une fois ; aucune erreur de page.
 *
 *   node scripts/essai_run.mjs http://localhost:8000 [dossier]      (deux minutes ; `GRAINE=…` un autre tirage)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { exiger, informer, verdict } from './verdict.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || null;
const GRAINE = process.env.GRAINE || 'v28-essai';
const TOUCHERS_MAX = 9, PAS_MAX = 900;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce' });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
// Le hasard de la page, semé : la graine de la run, le loto des coachs.
await page.addInitScript(g => {
  let x = 2166136261;
  for (const c of String(g)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  Math.random = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}, GRAINE);
if (DOSSIER) fs.mkdirSync(DOSSIER, { recursive: true });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* rien à vider */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
const ouvrir = async () => { await page.click('#menuDepart [data-menu="run"]'); await page.waitForSelector('#runModal .rn-plan [data-a]', { timeout: 60000 }); };
await ouvrir();

const run = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_run') || 'null'); } catch { return null; } });
const meta = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_rogue') || 'null'); } catch { return null; } });
const la = (a, v = null) => page.$(v == null ? `#runModal [data-a="${a}"]:not([disabled])` : `#runModal [data-a="${a}"][data-v="${v}"]:not([disabled])`);
let touchers = 0;
const toucher = async (a, v = null, attente = 260) => {
  const el = await la(a, v);
  if (!el) return false;
  await el.click();
  touchers++;
  await page.waitForTimeout(attente);
  return true;
};

const semaines = [], vus = new Set(), ecarts = [];
let debut = null, reprise = null, fin = null, signes = 0, matchs = 0;
for (let pas = 0; pas < PAS_MAX && !fin; pas++) {
  // Une scène d'attente (les vestiaires qu'on ouvre, la pochette) : on patiente.
  if (!await page.$('#runModal .rn-plan [data-a]')) { await page.waitForTimeout(300); continue; }
  if (await la('run-neuve')) { fin = await run(); break; }
  if (await toucher('prendre-coach', null, 600)) { vus.add('le départ'); continue; }
  if (await la('apres-match')) {
    // Le pointage de la scène, puis celui que la run garde.
    const vu = await page.$eval('#runModal .rn-pointage', el => el.firstChild.textContent.trim());
    await toucher('apres-match', null, 400);
    const R = await run(), m = R && R.matchs[R.matchs.length - 1];
    if (!m || vu.replace(/\s/g, '') !== `${m.gf}·${m.ga}`) ecarts.push(`${vu} à l'écran, ${m ? `${m.gf}-${m.ga}` : 'rien'} gardé`);
    matchs++;
    if (debut) debut.gagne = !!(m && m.gagne);
    continue;
  }
  if (await toucher('fin-du-match')) continue;
  if (await la('jouer')) { vus.add((await page.$('#runModal .rn-plans')) ? 'le duel' : 'la feuille du soir'); await toucher('jouer', null, 900); vus.add('le match'); continue; }
  if (await toucher('vers-carte')) { vus.add('le rival annoncé'); continue; }
  if (await la('aller')) {
    vus.add('la carte');
    // Une fois dans la run : quitter au menu en pleine carte, rouvrir, et retrouver la même run.
    if (matchs === 2 && !reprise) {
      const avant = await run();
      await toucher('pause'); await toucher('menu', null, 500);
      await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 10000 });
      await ouvrir();
      const apres = await run();
      reprise = { ok: !!apres && apres.phase === avant.phase && apres.rang === avant.rang && apres.matchs.length === avant.matchs.length && apres.joueurs.length === 23, mot: `${avant.phase}, case ${avant.rang + 1}` };
      touchers = 0;
    }
    if (debut && debut.gagne && debut.signe && debut.match) semaines.push(touchers - debut.t);
    debut = { t: touchers, gagne: false, signe: false, match: false };
    await toucher('aller', null, 500);
    const R = await run();
    if (debut) debut.match = !!R && R.phase === 'feuille' && R.case.sorte === 'match';
    continue;
  }
  if (await la('ouvrir-porte')) {
    vus.add('les portes');
    // La première porte : son premier joueur, l'échange proposé, signer s'il passe ; sinon passer.
    await toucher('ouvrir-porte', '0');
    if (await toucher('vers-echange')) {
      vus.add('l\'échange');
      if (await toucher('signer', null, 500)) { signes++; if (debut) debut.signe = true; continue; }
      await toucher('fermer-echange');
    }
    await toucher('fermer-porte');
    await toucher('passer', null, 500);
    continue;
  }
  if (await la('vers-echange') || await la('fermer-porte')) {
    // Une pochette ouverte : un joueur, ou rien.
    if (await toucher('vers-echange') && await toucher('signer', null, 500)) { signes++; continue; }
    await toucher('fermer-echange'); await toucher('fermer-porte', null, 500);
    continue;
  }
  if (await la('prendre-piece')) { vus.add('une pièce offerte'); if (!await toucher('prendre-piece', null, 500)) await toucher('apres-acte'); continue; }
  if (await toucher('apres-acte', null, 500)) { vus.add('la fin d\'acte'); continue; }
  if (await la('quitter-marche')) {
    vus.add('le marché');
    if (await toucher('voir-piece')) await toucher('acheter-piece');
    await toucher('quitter-marche', null, 500);
    continue;
  }
  if (await toucher('reposer', null, 500)) { vus.add('le vestiaire'); continue; }
  if (await toucher('reponse', '0', 2300) || await toucher('histoire-calme', null, 500)) { vus.add('une histoire'); continue; }
  if (await toucher('match-de-serie', null, 500)) { vus.add('les séries'); continue; }
  if (await toucher('piece-passee', null, 500)) continue;
  await page.waitForTimeout(300);
}
if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/essai-run-fin.png` });

// La fin : ses médailles versées une fois, même en rouvrant l'écran de fin.
const m1 = await meta();
if (fin) { await toucher('quitter', null, 500); await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 10000 }).catch(() => {}); await ouvrir().catch(() => {}); }
const m2 = await meta();
await browser.close();

const medailles = x => (x && (x.ecussons ?? x.medailles)) || 0;
exiger('la run va au bout, au doigt', !!fin && !!fin.fin, fin && fin.fin ? `${fin.matchs.length} matchs, ${signes} joueurs signés, fin : ${fin.fin.cause}` : 'pas d\'écran de fin');
exiger('ses scènes se sont ouvertes en chemin', ['le départ', 'les portes', 'l\'échange', 'le rival annoncé', 'la carte', 'la feuille du soir', 'le match', 'la fin d\'acte'].every(s => vus.has(s)), [...vus].join(' · '));
exiger(`une semaine gagnée tient en ${TOUCHERS_MAX} touchers au plus`, semaines.length > 0 && Math.max(...semaines) <= TOUCHERS_MAX, semaines.length ? `${semaines.length} semaines gagnées et signées : ${Math.min(...semaines)} à ${Math.max(...semaines)} touchers` : 'aucune semaine gagnée et signée à compter');
exiger('le match vu est le match joué', matchs > 0 && !ecarts.length, ecarts.slice(0, 3).join(' · ') || `${matchs} pointages relus`);
exiger('quitter au menu et rouvrir reprend la run', !!reprise && reprise.ok, reprise ? reprise.mot : 'jamais essayé');
exiger('la fin verse ses médailles une fois', !!fin && medailles(m1) >= (fin.fin ? fin.fin.medailles : 1) && medailles(m2) === medailles(m1), `${medailles(m1)} médailles, ${medailles(m2)} après avoir rouvert la fin`);
exiger('aucune erreur de page', !erreurs.length, [...new Set(erreurs)].slice(0, 3).join(' · '));
informer('le tirage', `GRAINE=${GRAINE}`);
verdict('Une run au doigt');
