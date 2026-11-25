/*
 * LA SAUVEGARDE D'UN APPAREIL À L'AUTRE, AU DOIGT (js/synchro.js, js/menu.js ; JP, 25 nov. 2026 : *Github sync*, *toute
 * seule*). Dans Chromium, deux appareils — un téléphone à 390 × 844 et un ordinateur à 1280 × 800, chacun son stockage — et
 * un faux GitHub tenu par ce script (aucun appel ne sort d'ici) :
 *
 *   1. le menu porte « D'un appareil à l'autre » ; tant qu'on n'a rien branché, rien ne part chez GitHub ;
 *   2. la fenêtre du jeton : un champ étiqueté, un refus de GitHub dit sous le champ, la fenêtre reste ouverte ;
 *   3. le bon jeton crée la sauvegarde (un Gist secret, sans le jeton dedans) et le menu se dit à jour ;
 *   4. l'ordinateur, vierge, la reçoit dès qu'on le branche, et sa page se recharge sur elle ;
 *   5. ce qu'on joue là-bas arrive ici à l'ouverture du jeu, sans rien toucher ;
 *   6. les deux ont avancé : le menu montre les deux et rien ne s'écrase avant qu'on choisisse ;
 *   7. quitter la page envoie ce qui a bougé ; débrancher oublie le jeton ;
 *   8. rien ne déborde ni au téléphone ni à l'ordinateur, chaque cible fait 44, aucune erreur de page.
 *
 * La règle elle-même (qui gagne, le réseau qui tombe, une version plus récente) a son juge sans navigateur : `check_synchro`.
 *
 *   node scripts/essai_synchro.mjs http://localhost:8000 [dossier]       (une quinzaine de secondes ; deux captures dans le dossier)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { exiger, verdict } from './verdict.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const FICHIER = 'cap82-sauvegarde.json', JETON = 'ghp_essai';

/* ---------- le faux GitHub ---------- */
const github = { gists: new Map(), appels: [], no: 0 };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS' };
async function repondre(route) {
  const req = route.request(), methode = req.method(), chemin = new URL(req.url()).pathname;
  const rendre = (status, data) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
  if (methode === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  github.appels.push(`${methode} ${chemin}`);
  if (req.headers().authorization !== `Bearer ${JETON}`) return rendre(401, { message: 'Bad credentials' });
  const corps = req.postData() ? JSON.parse(req.postData()) : null;
  if (methode === 'GET' && chemin === '/gists') return rendre(200, [...github.gists.values()].map(g => ({ id: g.id, files: Object.fromEntries(Object.keys(g.files).map(n => [n, { filename: n }])) })));
  if (methode === 'POST' && chemin === '/gists') {
    const g = { id: `g${++github.no}`, public: corps.public, files: Object.fromEntries(Object.entries(corps.files).map(([n, f]) => [n, { content: f.content, truncated: false }])) };
    github.gists.set(g.id, g);
    return rendre(201, g);
  }
  const g = github.gists.get(chemin.replace('/gists/', ''));
  if (!g) return rendre(404, { message: 'Not Found' });
  if (methode === 'PATCH') for (const [n, f] of Object.entries(corps.files)) g.files[n] = { content: f.content, truncated: false };
  return rendre(200, g);
}
/* La sauvegarde en ligne, lue comme le jeu la lit : ses clés compressées (`gz`) rendues en clair. */
const enLigne = () => {
  const g = [...github.gists.values()][0];
  if (!g) return null;
  const s = JSON.parse(g.files[FICHIER].content);
  return s.gz ? { ...s, cles: JSON.parse(gunzipSync(Buffer.from(s.gz, 'base64')).toString('utf8')) } : s;
};
const runsEnLigne = () => { const s = enLigne(); return s ? JSON.parse(s.cles.cap82_rogue).runs : null; };

/* ---------- deux appareils ---------- */
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const erreurs = [];
async function appareil(viewport, userAgent) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, userAgent });
  await ctx.route('https://api.github.com/**', repondre);
  const page = await ctx.newPage();
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#menuDepart .menu-synchro-corps');
  return page;
}
/* « Jouer » : une run de plus au méta, écrit comme le jeu l'écrit (ses autres champs restent : une clé réécrite à sa façon se
   relirait au démarrage, et l'appareil se croirait changé). */
const jouer = (page, runs) => page.evaluate(n => { const m = JSON.parse(localStorage.getItem('cap82_rogue') || '{}'); localStorage.setItem('cap82_rogue', JSON.stringify({ ...m, runs: n, ecussons: n * 10 })); }, runs);
const runsIci = page => page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}').runs);
const motDe = page => page.textContent('#menuDepart .menu-synchro-corps .ms-mot');
const geste = (page, quoi) => page.click(`#menuDepart [data-synchro="${quoi}"]`);
const aJour = page => page.waitForFunction(() => /À jour/.test((document.querySelector('#menuDepart .menu-synchro-corps .ms-mot') || {}).textContent || ''), null, { timeout: 10000 });
const brancher = async (page, jeton) => { await page.fill('#synchroJeton', jeton); await page.click('#synchroForm [type="submit"]'); };
/* Ce qui déborde de la page, et les cibles de la section et de la fenêtre qui font moins de 44. */
const mesures = page => page.evaluate(() => {
  const petites = [...document.querySelectorAll('.menu-synchro button, #synchroModal :is(button, a, input)')].filter(el => el.offsetParent).map(el => ({ r: el.getBoundingClientRect(), t: (el.textContent || el.id).trim().slice(0, 24) }))
    .filter(x => x.r.height < 43.5 || x.r.width < 43.5 || x.r.left < 0 || x.r.right > innerWidth + 0.5).map(x => `${x.t} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`);
  return { deborde: document.documentElement.scrollWidth - innerWidth, petites };
});

/* ---------- 1 à 3 : le téléphone ---------- */
const A = await appareil({ width: 390, height: 844 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
exiger('le menu porte « D\'un appareil à l\'autre », et tant qu\'on n\'a rien branché rien ne part chez GitHub', /GitHub/.test(await motDe(A)) && await A.isVisible('#menuDepart [data-synchro="ouvrir"]') && github.appels.length === 0, `${github.appels.length} appel`);
await jouer(A, 2);
await A.reload({ waitUntil: 'networkidle' });
await A.waitForSelector('#menuDepart .menu-synchro-corps');
await A.locator('#menuDepart .menu-synchro').scrollIntoViewIfNeeded();
await geste(A, 'ouvrir');
await A.waitForSelector('#synchroModal', { state: 'visible' });
const champ = await A.evaluate(() => { const i = document.getElementById('synchroJeton'), l = document.querySelector('label[for="synchroJeton"]'); return { etiquette: !!l && l.textContent.trim().length > 0, type: i.type, corrige: i.spellcheck, taille: parseFloat(getComputedStyle(i).fontSize), lien: document.querySelector('#synchroForm a').href }; });
exiger('la fenêtre du jeton : un champ étiqueté, masqué, sans correcteur, à 16 px (le téléphone ne zoome pas), et le lien qui crée le jeton au seul droit « gist »', champ.etiquette && champ.type === 'password' && champ.corrige === false && champ.taille >= 16 && /github\.com\/settings\/tokens\/new\?scopes=gist/.test(champ.lien), JSON.stringify(champ));
let m = await mesures(A);
exiger('… au téléphone, rien ne déborde et chaque cible fait 44', m.deborde <= 0 && !m.petites.length, `déborde de ${m.deborde} px ; ${m.petites.join(', ') || 'toutes de 44'}`);
await A.waitForTimeout(400);                       // la feuille finit d'entrer
await A.screenshot({ path: `${DOSSIER}/essai-synchro-jeton.png` });
await brancher(A, 'ghp_faux');
await A.waitForFunction(() => /refuse/.test(document.querySelector('#synchroForm .synchro-mot').textContent));
exiger('un jeton que GitHub refuse : le mot sous le champ, la fenêtre reste ouverte, rien n\'est gardé ni créé', await A.isVisible('#synchroModal') && !github.gists.size && !(await A.evaluate(() => (localStorage.getItem('cap82_synchro') || '').includes('ghp_'))), await A.textContent('#synchroForm .synchro-mot'));
await brancher(A, JETON);
await A.waitForSelector('#synchroModal', { state: 'hidden' });
await aJour(A);
const g = [...github.gists.values()][0];
exiger('le bon jeton crée la sauvegarde : un Gist secret, sans le jeton dedans, et le menu se dit à jour', github.gists.size === 1 && g.public === false && !g.files[FICHIER].content.includes(JETON) && runsEnLigne() === 2 && /un iPhone/.test(enLigne().appareil.nom), await motDe(A));

/* ---------- 4 : l'ordinateur, vierge ---------- */
const B = await appareil({ width: 1280, height: 800 }, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36');
await geste(B, 'ouvrir');
await B.waitForSelector('#synchroModal', { state: 'visible' });
m = await mesures(B);
exiger('à l\'ordinateur non plus, rien ne déborde', m.deborde <= 0 && !m.petites.length, `déborde de ${m.deborde} px ; ${m.petites.join(', ') || 'toutes de 44'}`);
await Promise.all([B.waitForNavigation({ waitUntil: 'networkidle' }), brancher(B, JETON)]);
await B.waitForSelector('#menuDepart .menu-synchro-corps');
exiger('l\'ordinateur, vierge, reçoit la sauvegarde dès qu\'on le branche : sa page se recharge sur elle, le menu dit d\'où elle vient', await runsIci(B) === 2 && /reçue d'un iPhone/.test(await motDe(B)) && /2 runs/.test(await B.textContent('#menuDepart .menu-mode[data-genre="rogue"]')), await motDe(B));
await B.screenshot({ path: `${DOSSIER}/essai-synchro-recue.png` });

/* ---------- 5 : on joue là-bas, on ouvre ici ---------- */
await jouer(B, 3);
await geste(B, 'synchroniser');
await aJour(B);
exiger('ce qu\'on joue à l\'ordinateur part en ligne', runsEnLigne() === 3, `${runsEnLigne()} runs en ligne`);
await A.reload();
await A.waitForFunction(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}').runs === 3 && !!document.querySelector('#menuDepart .menu-mode[data-genre="rogue"]'), null, { timeout: 15000 });
await A.waitForLoadState('networkidle');
exiger('… et arrive au téléphone à l\'ouverture du jeu, sans rien toucher : le menu montre la run reçue', /3 runs/.test(await A.textContent('#menuDepart .menu-mode[data-genre="rogue"]')), await motDe(A));

/* ---------- 6 : les deux avancent ---------- */
await jouer(A, 4);
await jouer(B, 5);
await geste(B, 'synchroniser');
await aJour(B);
await A.locator('#menuDepart .menu-synchro').scrollIntoViewIfNeeded();
await geste(A, 'synchroniser');
await A.waitForSelector('#menuDepart .ms-choix');
const choix = await A.$$eval('#menuDepart .ms-choix button', bs => bs.map(b => b.textContent.replace(/\s+/g, ' ').trim()));
exiger('les deux ont avancé : le menu montre les deux, ce que chacune porte et d\'où vient l\'autre, et rien ne s\'écrase', choix.length === 2 && /d'ici.*4 runs/.test(choix[0]) && /PC Windows.*5 runs/.test(choix[1]) && runsEnLigne() === 5 && await runsIci(A) === 4, choix.join(' | '));
m = await mesures(A);
exiger('… le choix tient au téléphone, chaque sauvegarde un bouton de 44 au moins', m.deborde <= 0 && !m.petites.length, `déborde de ${m.deborde} px ; ${m.petites.join(', ') || 'toutes de 44'}`);
await A.screenshot({ path: `${DOSSIER}/essai-synchro-conflit.png` });
await geste(A, 'ici');
await aJour(A);
exiger('« celle d\'ici » part en ligne', runsEnLigne() === 4 && await runsIci(A) === 4, `${runsEnLigne()} runs en ligne`);

/* ---------- 7 : quitter la page envoie ; débrancher ---------- */
await jouer(A, 6);
await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await A.waitForFunction(() => /À jour|Des changements/.test(document.querySelector('#menuDepart .ms-mot').textContent));
for (let i = 0; i < 50 && runsEnLigne() !== 6; i++) await A.waitForTimeout(100);
exiger('ce qui a bougé part tout seul quand la page se cache', runsEnLigne() === 6, `${runsEnLigne()} runs en ligne`);
await geste(A, 'debrancher');
exiger('débrancher se confirme (un deuxième toucher)', /Débrancher \?/.test(await A.textContent('#menuDepart [data-synchro="debrancher"]')) && await A.evaluate(() => (localStorage.getItem('cap82_synchro') || '').includes('ghp_')));
await geste(A, 'debrancher');
await A.waitForSelector('#menuDepart [data-synchro="ouvrir"]');
exiger('… puis oublie le jeton ; la partie reste ici, la sauvegarde reste en ligne', !(await A.evaluate(() => (localStorage.getItem('cap82_synchro') || '').includes('ghp_'))) && await runsIci(A) === 6 && github.gists.size === 1);

exiger('aucune erreur de page', !erreurs.length, erreurs.slice(0, 3).join(' | '));
await browser.close();
verdict();
