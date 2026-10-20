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
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { PRESTIGES, rangDePrestige } from '../js/rogue.js';
import { BUTIN_RIVAL } from '../js/sim.js';
import { RAYONS_CLUB } from '../js/club.js';
import { traverserPaquet, fautesDePile } from './lib/paquet.mjs';
import { collesAuBord, MARGE } from './lib/bords.mjs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const browser = await chromium.launch();
// Au doigt (audit mobile, oct.) : un téléphone n'a pas de survol, et un toucher ne doit pas laisser un bouton dans son état survolé.
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
/*
 * v2 : la boutique et tes cartes n'ont plus qu'une porte, la section Marché (la rangée de liens du bureau doublait
 * les étapes, la boîte, la Ligue et le Marché). Le bureau est prêt quand sa barre d'action est là.
 */
// V9 : À faire porte tous les choix ; le bureau est prêt quand sa barre propose d'avancer, de régler ou de trancher.
const BUREAU = '#hubModal :is(.hub-jour, .hub-traiter, .hub-trancher)';
/* Attendre qu'UN des éléments soit visible (le premier de la liste peut être caché sous une page du Club). */
const unVisible = (sel, timeout = 120000) => page.waitForFunction(s => [...document.querySelectorAll(s)].some(e => e.offsetParent), sel, { timeout });
/*
 * LA PILE D'UN PAQUET (1.0, oct.) : chaque carte en grand, passée d'un geste (scripts/lib/paquet.mjs). Elle doit
 * faire 80 % de la largeur à 390 px et mener aux mêmes cartes dans la bande des choix. LE WALKOUT : un pack qui
 * cache une holo, une or ou un Phénomène l'annonce en trois temps juste avant elle. Une capture de la première
 * carte en grand, et du premier walkout.
 */
let walkouts = 0, piles = 0;
const passerLaPile = async () => {
  const premiere = !piles++;
  const pile = await traverserPaquet(page, {
    surAnnonce: async () => { if (!walkouts) { await page.waitForTimeout(350); await page.screenshot({ path: `${DOSSIER}/rogue-walkout.png` }); } },
    surCarte: async i => { if (premiere && i === 0) await page.screenshot({ path: `${DOSSIER}/rogue-pile.png` }); },
  });
  if (pile.annonce) walkouts++;
  for (const f of fautesDePile(pile, page.viewportSize().width)) erreurs.push(`paquet ${piles} : ${f}`);
};
/*
 * LA BOUTIQUE ET « TES CARTES » VIVENT AU MARCHÉ (1.0, oct.). JP : *je veux RIEN de la boutique dans club/accueil*.
 * Une décision prise de la boutique ou de « Tes cartes » rejoue la saison en coulisse et rouvre la même page DANS le
 * Marché. Pour retrouver le bureau, on touche « Club » dans la barre.
 */
/*
 * LE BOUTON FLOTTANT (audit mobile, oct.) : quand « Jour suivant » sort de l'écran, son double flotte au-dessus de la
 * barre. Il se mesurait lui-même et restait coincé à 230 × 16 après avoir été masqué : partout où il paraît, 44 px au moins.
 */
const flottant = { vus: 0, petits: [] };
async function garderLeFlottant(ou) {
  const f = await page.$eval('#hubFlottant', b => { const r = b.getBoundingClientRect(); return { vu: !b.hidden && b.checkVisibility() && r.height > 0, w: r.width, h: r.height }; }).catch(() => null);
  if (!f || !f.vu) return;
  flottant.vus++;
  if (f.h < 44) flottant.petits.push(`${ou} ${Math.round(f.w)}×${Math.round(f.h)}`);
}
/* « Ce soir » (V8) : la section, puis son premier onglet — elle rouvre sinon la page qu'on y lisait (les Lignes). On
   la défile au bout : le bouton du jour sort de l'écran, son double doit flotter, à sa vraie taille. */
const versCeSoir = async () => {
  await page.click('#navbar .navtab[data-section="soir"]').catch(() => {});
  await page.click('#sousNav .soustab[data-page="soir"]', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const defile = bas => page.evaluate(b => { for (const e of document.querySelectorAll('#hubModal *')) if (e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = b ? e.scrollHeight : 0; }, bas);
  await defile(true); await page.waitForTimeout(400);
  await garderLeFlottant('ce soir, au bout');
  await defile(false); await page.waitForTimeout(200);
};
const auBureau = async (timeout = 120000) => {
  await page.waitForFunction(() => document.querySelector('#hubModal .hub-jour, #hubModal .hub-traiter, #hubModal .hub-trancher'), null, { timeout });
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.body.dataset.section !== 'bureau')) { await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {}); await page.waitForTimeout(250); }
  await unVisible(BUREAU, timeout);
};
/*
 * RIEN DE LA BOUTIQUE DANS LE CLUB, À AUCUN MOMENT : la section ouverte et le bouton allumé de la barre sont le Marché,
 * la feuille du Club (#hubModal) ne porte aucun élément de boutique, et la boutique est rendue au Marché.
 */
const verifMarche = async (etape, { boutique = true } = {}) => {
  const r = await page.evaluate(() => {
    const hub = document.getElementById('hubModal');
    return { sec: document.body.dataset.section, nav: (document.querySelector('#navbar .navtab.on') || {}).dataset?.section,
      horsMarche: hub ? hub.querySelectorAll('[data-genre="boutique"], .pk-tuile, .pk-fiche, .pk-sheet').length : 0,
      boutique: !!document.querySelector('#pageMarche:not([hidden]) .hub-page[data-genre="boutique"] .pk-tuile'),
      hubVisible: !!hub && getComputedStyle(hub).display !== 'none' && hub.offsetParent !== null };
  });
  if (r.sec !== 'marche' || r.nav !== 'marche') erreurs.push(`${etape} : la section ouverte est « ${r.sec} » et la barre allume « ${r.nav} » (attendu : marche)`);
  if (r.horsMarche) erreurs.push(`${etape} : ${r.horsMarche} élément(s) de boutique dans la feuille du Club (#hubModal)`);
  if (r.hubVisible) erreurs.push(`${etape} : la feuille du Club est visible pendant qu'on est au Marché`);
  if (boutique && !r.boutique) erreurs.push(`${etape} : la boutique n'est pas rendue au Marché`);
  console.log(`   ${etape} : section ${r.sec}, barre ${r.nav}, boutique au Marché ${r.boutique}, dans le Club ${r.horsMarche}, Club visible ${r.hubVisible}`);
};
/* Le Bureau (l'affiche, la boîte) ne dit jamais « boutique » et n'offre rien à acheter. */
const verifClubSansBoutique = async etape => {
  const r = await page.evaluate(() => {
    const hub = document.getElementById('hubModal');
    const t = hub ? hub.innerText : '';
    return { mots: (t.match(/boutique|🛒|scell/gi) || []), tuiles: hub ? hub.querySelectorAll('.pk-tuile, .pk-fiche, [data-genre="boutique"]').length : 0 };
  });
  if (r.mots.length || r.tuiles) erreurs.push(`${etape} : le Club parle de boutique (${r.mots.join(', ')}) ou en rend (${r.tuiles})`);
};
// Tes cartes et la boutique sont chacune un sous-onglet des Cartes (« Tes cartes », « Boutique ») : un toucher, sans liste.
const versMarche = async quoi => {
  await page.click('#navbar .navtab[data-section="marche"]').then(() => page.click(`#sousNav .soustab[data-page="${quoi === 'cartes' ? 'poche' : 'marche'}"]`, { timeout: 3000 }).catch(() => {}));
  await page.waitForSelector(`#pageMarcheCorps .hub-page[data-genre="${quoi}"]`, { timeout: 10000 });
};
const erreurs = [];
const CLUBS_LISTE = RAYONS_CLUB.find(R => R.cle === 'club').liste;
const NB_CLUBS = Object.keys(CLUBS_LISTE).length, PRIX_HARFANGS = CLUBS_LISTE.harfangs.prix;
page.on('pageerror', e => { erreurs.push(e.message); console.log('PAGEERR', e.stack); });
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
  localStorage.setItem('cap82_cartable', JSON.stringify({ v: 1, migre: true, hist: true, joueurs: Object.fromEntries(cartes.map((k, i) => [k, i === 1 ? { v: { commune: 3 }, n: 3 } : { v: i === 0 ? { rare: 1 } : { commune: 1 }, n: 1 }])) }));
  // V5 : « Le congédiement » attend dans l'inventaire permanent, pour changer de coach en saison (plus bas, 10c).
  // « Une caisse de départ » (+20 jetons) : les Harfangs puis le Pack Argent s'achètent quel que soit le tirage de la saison
  // (sans elle, une caisse de 22 ou 36 jetons laissait l'essai en panne de jetons devant le Pack Argent : une loterie).
  // V9 (tranche 8) : une Coupe déjà gagnée ouvre le premier cran des exigences ; l'essai le voit, et part au cran 0.
  localStorage.setItem('cap82_rogue', JSON.stringify({ ecussons: 400, deblocages: ['banc1', 'caisse1', 'classeur1'], collection: [], cartes: [], runs: 0, coupes: 1, jalons: {}, jeu: 'v10', inventaire: { 'consommable:congediement': 1, 'consommable:rappel': 1, 'consommable:echangeDoublon': 1 } }));
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
// LES EXIGENCES (V9, tranche 8) : une Coupe au méta ouvre le premier cran, offert à côté du départ ordinaire.
const crans = await page.$$eval('#choixModal .choix-option[data-choix^="e"]', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
console.log(`0. les exigences : ${crans.length} cran(s) offert(s) · ${crans.map(t => t.slice(0, 60)).join(' | ')}`);
if (crans.length !== 1 || !/Exigence 1/.test(crans[0]) || !/médailles/.test(crans[0])) erreurs.push(`le départ d'une run offre ${crans.length} cran(s) d'exigence après une Coupe (attendu : 1, avec sa prime de médailles)`);
await choix('.choix-option[data-choix="go"]');
/*
 * TON COACH (v2, js/coachs.js) : les coachs que le prestige ouvre (V2.3 : ce méta est un Club de quartier,
 * donc quatre), un à prendre — sa confiance I est allumée dès le premier soir (une décision du jour 0) —, et
 * les deux patrons imposés de la run, nommés sur le même écran.
 */
const COACHS_ATTENDUS = PRESTIGES[rangDePrestige({ ecussons: 400, deblocages: ['banc1', 'caisse1', 'classeur1'], jalons: {} })].coachs;
await page.waitForFunction(() => /Ton coach/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
const offerts = await page.$$eval('#choixModal .choix-option', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
await page.screenshot({ path: `${DOSSIER}/rogue-coach.png` });
console.log(`0. ton coach : ${offerts.length} offerts · ${offerts.map(t => t.slice(0, 40)).join(' | ')}`);
if (offerts.length !== COACHS_ATTENDUS || !offerts.every(t => /Confiance I/.test(t))) erreurs.push(`le choix du coach offre ${offerts.length} coach(s) (le prestige en ouvre ${COACHS_ATTENDUS}), ou ne dit pas sa confiance I`);
if (!/Tes patrons :/.test((await page.textContent('#choixModal .choix-sheet')) || '')) erreurs.push('le choix du coach ne nomme pas les patrons imposés');
await choix();
/*
 * TON JOUEUR DE CONCESSION (JP, 18 oct. : *avoir un gros joueur dès la première run, mais difficile d'en avoir
 * d'autres*) : trois Étoiles offertes à la première run, une à prendre, qui revient au départ de chaque run.
 */
await page.waitForFunction(() => /Ton joueur de concession/.test((document.querySelector('#signatureModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-concession.png` });
const concession = await page.$$eval('#signatureModal .sig-liste .btn-sign', e => e.length);
console.log(`0. ton joueur de concession : ${concession} offert(s)`);
if (concession < 2 || concession > 3) erreurs.push(`le joueur de concession offre ${concession} joueur(s) (attendu : 3, au moins 2)`);
await page.click('#signatureModal .sig-liste .btn-sign');
const vedetteGardee = await page.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('cap82_rogue') || '{}').vedette; } catch { return false; } }, null, { timeout: 10000 }).then(() => true, () => false);
if (!vedetteGardee) erreurs.push('le joueur de concession choisi n\'est pas gardé au méta');
/*
 * LE DÉPART DU CLASSEUR (S80, js/depart.js) : sans déblocage, une carte du
 * cartable tirée au hasard. On la voit, on touche sa carte (sa fiche), on la
 * prend, on commence.
 */
await page.waitForSelector('#departModal:not([hidden]) .pcard', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-depart-classeur.png` });
const tiree = await page.$$eval('#departModal .pcard', e => e.map(x => x.dataset.voir));
const entete = (await page.textContent('#departModal .choix-irl')).trim();
await page.click('#departModal .pcard .pcard-qui');
await page.waitForTimeout(500);
const ficheClasseur = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
if (!ficheClasseur) erreurs.push('toucher une carte du classeur n\'ouvre pas sa fiche');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('#departModal [data-prendre]:not([disabled])');
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
// Au téléphone (1.0, R4), l'alignement se lit par onglet : la réserve est sous « Filet · réserve ».
const ongletG = await page.$('.seg-effectif [data-val="G"]');
if (ongletG && await ongletG.isVisible()) { await ongletG.click(); await page.waitForTimeout(250); }
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
const des = [], evenementsDe = [];
let pocheVendues = 0;   // V4.3 : les cartes de tes places vendues en passant
const soirs = { pages: 0, match: 0 };   // les pages du soir, et celles qui sont le sommaire d'un match
const duelCourt = { n: 0, max: 0, longs: 0 };
// UNE SEULE FEUILLE À LA FOIS (Jalon M, B7) : à chaque capture qui en montre une, au plus une `.choix-sheet` se voit.
const feuilles = { vues: 0, empilees: [] };
const compterFeuilles = async ou => {
  const vues = await page.$$eval('.choix-sheet', ls => ls.filter(e => e.checkVisibility({ visibilityProperty: true })).map(e => (e.closest('[id]') || {}).id || e.className));
  feuilles.vues++; if (vues.length > 1) feuilles.empilees.push(`${ou} : ${vues.join(' + ')}`);
};
const captures = { main: 0, combat: 0, duel: 0 };   // la première main d'avant-match, photographiée une fois   // les dés lancés pendant la run, et les événements qui les ont demandés
const afaire = { vu: false, lots: [], route: '', sous: [], genres: new Set(), formes: [], ouverts: 0, pages: 0, maisons: new Set(), sansPage: [] };   // À faire (V9), vu au premier choix
const butin = { fait: false, retrait: null };   // V5 : le butin « retirer une carte », éprouvé une fois
const combats = [];   // V5 : les combats confirmés, leur soir et la carte de vestiaire gardée
const periodes = [];  // V9 : les périodes de duel jouées (1re, 2e, 3e) et le geste pris
const mise = { vue: false, lu: '', scene: '' };   // la mise doublée, touchée une fois, et sa scène
// LES SCÈNES (Jalon M) : les choix d'À faire mis en scène citent leur voix ; on garde la première de chaque genre.
// V10 (tranche 5) : les dossiers de la semaine, la blessure (A4) ; la route (A3) se juge à son bloc.
const SCENES = ['cartes', 'places', 'dossier', 'blessure'];
const scenes = new Map();
const barreA = { vus: 0, sous: [], longs: [] };   // « À régler » touché : le choix déplié au-dessus de la barre (B4)
const decisionsDuCombat = async () => ((await lireSauvegarde()).partie || {}).decisions || [];
/* La saison se rejoue avant d'être écrite : on attend que la sauvegarde compte plus de `n` décisions (10 s au plus), plutôt que de la lire trop tôt. */
const attendreDecisions = n => page.waitForFunction(n0 => { const ix = JSON.parse(localStorage.getItem('cap82_parties'));
  return ((JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)).partie || {}).decisions || []).length > n0; }, n, { timeout: 10000 }).catch(() => {});
/*
 * RIEN NE COLLE AU BORD (JP : *t'es mieux d'avoir un petit padding, que pas de padding du tout*). Chaque écran que l'essai
 * traverse se mesure (scripts/lib/bords.mjs) ; la première capture d'une faute nouvelle se garde.
 */
const bords = { vus: 0, fautes: new Map() };
async function guetterBords(ou) {
  const f = await collesAuBord(page).catch(() => []);
  bords.vus++;
  let neuve = false;
  for (const x of f) { const k = x.replace(/ à .*$/, ''); if (!bords.fautes.has(k)) { bords.fautes.set(k, `${x} — ${ou}`); neuve = true; console.log(`   ▸ au bord : ${x} — ${ou} (capture ${bords.fautes.size})`); } }
  if (neuve && bords.fautes.size <= 12) await page.screenshot({ path: `${DOSSIER}/rogue-bord-${bords.fautes.size}.png` }).catch(() => {});
}
/* Chaque section et chacun de ses sous-onglets, sauf les Lignes (elles mènent derrière le banc), mesurés au bord. */
async function tourDesBords(quand) {
  for (const sec of ['bureau', 'soir', 'effectif', 'marche', 'ligue']) {
    await page.click(`#navbar .navtab[data-section="${sec}"]`).catch(() => {}); await page.waitForTimeout(400);
    const pages = await page.$$eval('#sousNav:not([hidden]) .soustab', b => b.map(x => x.dataset.page)).catch(() => []);
    if (!pages.length) await guetterBords(`${quand} · ${sec}`);
    for (const pg of pages.filter(x => x !== 'alignement')) {
      await page.click(`#sousNav .soustab[data-page="${pg}"]`).catch(() => {}); await page.waitForTimeout(400);
      await guetterBords(`${quand} · ${sec} › ${pg}`);
    }
  }
  await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {}); await page.waitForTimeout(300);
}
/* UN ÉLÉMENT QUI BOUGE (« not stable ») : ce qui bouge autour de lui, image après image, et ce qui l'anime. */
async function sonde(h) {
  return h.evaluate(async el => {
    const out = [];
    for (let p = el; p; p = p.parentElement) {
      const rs = new Set();
      for (let f = 0; f < 20; f++) { await new Promise(r => requestAnimationFrame(r)); const r = p.getBoundingClientRect(); rs.add(`${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`); }
      const an = p.getAnimations ? p.getAnimations().map(a => `${a.animationName || a.transitionProperty || a.constructor.name}:${a.playState}`) : [];
      out.push(`${p.tagName}.${String(p.className || '').split(' ').slice(0, 4).join('.')} ${rs.size} ${[...rs].slice(0, 3).join(' | ')} anim:${an.join(',')} haut:${p.scrollTop} tf:${getComputedStyle(p).transform}`);
    }
    return out.join('\n');
  });
}
async function regler() {
  for (let i = 0; i < 30; i++) {
    await guetterBords('en jouant');
    // Une récompense arrive en paquet scellé (S77) : on le déchire, puis on passe la pile, carte par carte. Elle passe
    // devant le sommaire de la journée, qu'elle couvre : un joueur ouvre d'abord ce qui est sur le dessus.
    const pq = await page.$('#choixModal:not([hidden]) .paquet');
    if (pq && await pq.isVisible()) { await passerLaPile(); continue; }
    // Le sommaire de la journée est une page du Club (1.0, R3) : « Retour au bureau » — une fois réglé ce qui le couvre.
    if (await page.$('#hubModal .hub-page[data-genre="sommaire"]') && !(await page.$('#choixModal:not([hidden])'))) {
      // Le soir d'un seul match (JP, 17 oct.) : la page est son sommaire — ses buts par période —, pas une page « Victoire ».
      const pg = await page.$eval('#hubModal .hub-page[data-genre="sommaire"]', el => ({ match: !!el.querySelector('.som-per'), titre: (el.querySelector('.hub-page-titre, h2') || {}).textContent || '' }));
      soirs.pages++; if (pg.match) { soirs.match++; if (soirs.match === 1) await page.screenshot({ path: `${DOSSIER}/rogue-sommaire-soir.png` }); }
      await page.click('#hubModal .hub-page[data-genre="sommaire"] .hub-page-fermer'); await page.waitForTimeout(250); continue;
    }
    if (await page.$('#choixModal:not([hidden]) .main-jouer')) {
      /*
       * L'ÉCRAN DE COMBAT (V5) : l'avant-match n'est plus un arrêt à part. Dans un gros match, l'écran dit l'enjeu
       * (les vrais chiffres de la run) et offre deux cartes de vestiaire ; on garde la première, et « Jouer » attend ce choix.
       * Le même bouton émet l'avant-match puis la main, au même soir, dans cet ordre.
       */
      const vest = await page.$$('#choixModal .main-vest:not([disabled])');
      const enjeu = ((await page.textContent('#choixModal .main-enjeu').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (enjeu) {
        const B = ((await lireSauvegarde()).partie || {}).rogue?.bareme || (await lireSauvegarde()).rogue?.bareme || null;
        // V8 : un rival choisi paie son butin, un multiple de la prime de la run (`BUTIN_RIVAL`) ; une bête noire, la prime.
        const primes = [1, ...BUTIN_RIVAL].map(x => Math.round(B ? B.grosMatch * x : 0));
        if (B && !primes.some(x => enjeu.includes(`Victoire : +${x} 🪙`))) erreurs.push(`l'enjeu du combat (« ${enjeu} ») ne dit ni la prime de la run (+${B.grosMatch} 🪙) ni le butin d'un rival`);
        if (!/Défaite : 😵 sonnés \d+ matchs/.test(enjeu)) erreurs.push(`l'enjeu du combat ne dit pas la défaite (« ${enjeu} »)`);
        if (vest.length && vest.length !== 2) erreurs.push(`le combat offre ${vest.length} carte(s) de vestiaire au lieu de deux`);
        if (vest.length && !(await page.$('#choixModal .main-jouer:disabled'))) erreurs.push('« Jouer » ne demande pas de garder une carte de vestiaire');
        // Le premier combat, photographié deux fois : l'intention en haut, puis la carte de vestiaire gardée.
        const premierCombat = !captures.combat++;
        if (premierCombat) {
          await page.waitForTimeout(600);
          await page.evaluate(() => document.querySelectorAll('#choixModal, #choixModal .choix-sheet, #choixModal .choix-corps').forEach(e => { e.scrollTop = 0; }));
          await page.screenshot({ path: `${DOSSIER}/rogue-combat.png` });
        }
        if (vest.length) { await vest[0].click({ timeout: 10000 }).catch(async e => { console.log(`la carte de vestiaire bouge :\n${await sonde(vest[0])}`); await page.screenshot({ path: `${DOSSIER}/rogue-vest-bouge.png` }); throw e; }); await page.waitForTimeout(250); }
        if (premierCombat) await page.screenshot({ path: `${DOSSIER}/rogue-combat-vestiaire.png` });
      }
      // La première main d'avant-match, photographiée : le deck en cartes à 390 px.
      if (!captures.main++) { await page.waitForTimeout(900); await page.screenshot({ path: `${DOSSIER}/rogue-main.png` }); }
      /*
       * LE DUEL (V9, tranche 5) : chaque période dit leur intention ; on prend le premier geste offert, et la décision
       * doit porter sa période et ce geste.
       */
      const duel = await page.$('#choixModal .duel-intention');
      let geste = null;
      if (duel) {
        const fait = ((await page.textContent('#choixModal .duel-fait').catch(() => '')) || '').trim();
        if (!fait) erreurs.push('le duel n\'annonce pas leur intention');
        const g = await page.$('#choixModal .duel-geste[data-geste]:not([disabled])');
        if (g) { geste = await g.getAttribute('data-geste'); await g.click(); await page.waitForTimeout(200); }
        /*
         * LE GROS MATCH PLUS COURT (Jalon M, B3) : le geste pris, l'intention se plie en une ligne ; la feuille tient à
         * 1,3 écran au plus, et « Jouer » reste à l'écran.
         */
        if (g) {
          const h = await page.$eval('#choixModal', m => {
            const els = [m, m.querySelector('.choix-sheet'), m.querySelector('.choix-corps')].filter(Boolean);
            const r = Math.max(...els.map(e => e.scrollHeight / Math.max(1, e.clientHeight)));
            const j = m.querySelector('.main-jouer').getBoundingClientRect();
            return { r, plie: !!m.querySelector('.duel-intention.plie .main-pli'), jouer: j.bottom <= innerHeight + 1 && j.top >= 0 };
          });
          duelCourt.n++; duelCourt.max = Math.max(duelCourt.max, h.r);
          if (!h.plie) erreurs.push('le geste pris, l\'intention du duel ne se plie pas');
          if (h.r > 1.3) duelCourt.longs++;
          if (!h.jouer) erreurs.push('« Jouer » n\'est pas à l\'écran une fois le geste pris');
        }
        if (!captures.duel++) { await page.waitForTimeout(400); await page.screenshot({ path: `${DOSSIER}/rogue-duel.png` }); }
      }
      /*
       * LA MISE DOUBLÉE AU DOIGT (audit mobile, oct.) : touchée, elle prend l'or et sa coche — le survol collé d'un
       * toucher lui donnait le fond sombre d'un bouton éteint. Touchée encore, elle se laisse (le robot ne double pas).
       */
      if (!mise.vue && await page.$('#choixModal .duel-snap')) {
        mise.vue = true;
        // LA SCÈNE (Jalon M, A1) : le capitaine la demande, entre guillemets, et le fait nomme le rival.
        const sc = await page.$eval('#choixModal', m => ({ voix: (m.querySelector('.duel-mise .scene-de') || {}).textContent || '',
          mot: (m.querySelector('.duel-mise .scene-mot') || {}).textContent || '', fait: (m.querySelector('.duel-mise .scene-fait') || {}).textContent || '',
          rival: ((m.querySelector('.choix-irl') || {}).textContent || '').replace(/^Contre\s+/, '').trim() }));
        mise.scene = `${sc.voix.trim()} ${sc.mot.trim()} — ${sc.fait.trim()}`;
        if (!/^«.+»$/.test(sc.mot.trim()) || !/capitaine/i.test(sc.voix)) erreurs.push(`la mise doublée ne cite pas le capitaine (« ${sc.voix} ${sc.mot} »)`);
        if (!sc.rival || !sc.fait.includes(sc.rival)) erreurs.push(`le fait de la mise doublée ne nomme pas le rival « ${sc.rival} » (« ${sc.fait} »)`);
        await page.tap('#choixModal .duel-snap'); await page.waitForTimeout(300);
        const lu = await page.$eval('#choixModal .duel-snap', b => {
          const t = document.createElement('i'); t.style.background = 'var(--or)'; document.body.appendChild(t);
          const or = getComputedStyle(t).backgroundColor; t.remove();
          return { on: b.classList.contains('on'), fond: getComputedStyle(b).backgroundColor, or, txt: b.textContent.trim() };
        });
        mise.lu = `${lu.txt} · ${lu.fond}`;
        if (!lu.on || !lu.txt.startsWith('✓')) erreurs.push(`la mise doublée touchée ne se coche pas (« ${lu.txt} »)`);
        if (lu.fond !== lu.or) erreurs.push(`la mise doublée touchée n'a pas le fond de l'or (${lu.fond}, l'or ${lu.or})`);
        await page.tap('#choixModal .duel-snap'); await page.waitForTimeout(300);
        if (await page.$('#choixModal .duel-snap.on')) erreurs.push('la mise doublée touchée deux fois reste doublée');
      }
      const avantJouer = await decisionsDuCombat(), mains0 = avantJouer.filter(d => d.main).length;
      await page.click('#choixModal .main-jouer'); await page.waitForTimeout(1500);
      // Un dé à lancer d'abord : la décision s'écrit après lui.
      if (!(await page.$('#choixModal:not([hidden]) .de-scene'))) await attendreDecisions(avantJouer.length);
      if (duel && !(await page.$('#choixModal:not([hidden]) .de-scene'))) {
        const ds = await decisionsDuCombat();
        const dn = ds.slice().reverse().find(d => d.main && d.duel);
        if (!dn) erreurs.push('la période du duel jouée n\'entre pas dans la sauvegarde');
        else {
          periodes.push(`${dn.duel.p + 1}${geste ? `:${geste}` : ''}`);
          if (geste && dn.duel.reponse !== geste) erreurs.push(`le geste « ${geste} » n'entre pas dans la décision de la période`);
          if (dn.duel.p === 0 && !(dn.main && Array.isArray(dn.main.tirage) && dn.main.tirage.length)) erreurs.push('la main tirée du duel ne part pas avec la décision');
        }
      }
      if (enjeu && !(await page.$('#choixModal:not([hidden]) .de-scene'))) {
        const ds = await decisionsDuCombat();
        const iM = ds.findLastIndex(d => d.main), iA = iM >= 0 ? ds.findLastIndex(d => d.avant && d.jour === ds[iM].jour) : -1;
        combats.push(iM >= 0 ? `J${ds[iM].jour + 1}${iA >= 0 ? ` ${ds[iA].avant.cle}:${ds[iA].avant.choix}` : ''}` : '?');
        if (ds.filter(d => d.main).length !== mains0 + 1) erreurs.push('le combat confirmé n\'enregistre pas la main');
        else if (vest.length && (iA < 0 || iA > iM)) erreurs.push('le combat n\'enregistre pas l\'avant-match puis la main, au même soir');
      }
      continue;
    }
    /*
     * UNE CARTE DE TES PLACES, EN GRAND (V4.3 ; V9) : « Jouer » ou « Vendre ». Le joueur pressé vend.
     */
    if (await page.$('#choixModal:not([hidden]) .poche-vendre')) { await page.click('#choixModal .poche-vendre'); pocheVendues++; await page.waitForTimeout(500); continue; }
    // Une main de palier (des cartes .tc) : la première carte jouable.
    const carte = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc:not([disabled])');
    if (carte) { await carte.click(); await page.waitForTimeout(500); continue; }
    // Un joueur offert (S78) : « Signer », puis « qui sort ? » — en liste (Jalon U), puis « Où joue ? » : une case, puis « Confirmer ».
    if (await page.$('#choixModal:not([hidden]) .tcj-signer')) { await page.click('#choixModal:not([hidden]) .tcj-signer'); await page.waitForTimeout(400); continue; }
    // Jalon R : la liste de signature (un pack rouvert de la boîte, un ballottage) : « Signer », puis « qui sort ? » (U18).
    if (!(await page.$('#choixModal:not([hidden])')) && await page.$('#signatureModal:not([hidden]) .btn-sign:not([disabled])')) { await page.click('#signatureModal .btn-sign:not([disabled])'); await page.waitForTimeout(600); continue; }
    // « Qui sort ? » en liste (Jalon U) : « Sort » sur le premier, la sortie proposée (U18).
    if (await page.$('#choixModal:not([hidden]) .sig-sort:not([disabled])')) { await page.click('#choixModal .sig-sort:not([disabled])'); await page.waitForTimeout(500); continue; }
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-mode="choix"] .aln-ligne .aln-choisir:not([disabled])')) {
      await page.click('#choixModal .aln-ligne .aln-choisir:not([disabled])'); await page.waitForTimeout(600); continue;
    }
    /*
     * LE LANCER DE DÉ (1.0, oct.) : une réponse risquée ouvre le dé. Entrée lance ; le dé tombe sur la face
     * que le moteur a tranchée, et la face dit le verdict (« sur 4, 5 ou 6 »), quelle qu'elle soit.
     */
    if (await page.$('#choixModal:not([hidden]) .de-lancer:not([disabled]):not(.de-suite)')) {
      const besoin = ((await page.textContent('#choixModal .de-besoin')) || '').trim(), k = (besoin.match(/\d/g) || []).length;
      await page.focus('#choixModal .de-lancer'); await page.keyboard.press('Enter');
      const pose = await page.waitForSelector('#choixModal .de.pose', { timeout: 6000 }).catch(() => null);
      const de = pose ? await pose.evaluate(d => ({ face: Number(d.dataset.face), gagne: d.classList.contains('gagne') })) : null;
      if (!de) erreurs.push(`le dé ne tombe pas (${besoin})`);
      else if (de.gagne !== (de.face > 6 - k)) erreurs.push(`le dé montre ${de.face} pour « ${besoin} » et dit ${de.gagne ? 'ça passe' : 'raté'}`);
      else des.push(`${de.face} ${de.gagne ? '✓' : '✗'}`);
      await page.click('#choixModal .de-suite').catch(() => {}); await page.waitForTimeout(600);
      // La boîte se vide : l'événement réglé au dé n'attend plus.
      const t0 = evenementsDe[evenementsDe.length - 1];
      if (t0 && await page.$$eval('#hubModal .hub-msg.bloque .hub-msg-sujet', (els, x) => els.some(e => e.textContent.includes(x)), t0).catch(() => false)) erreurs.push(`« ${t0} » réglé au dé attend encore dans À faire`);
      continue;
    }
    // Un événement qui offre une réponse risquée : on la prend, pour lancer le dé (et vérifier que la boîte se vide).
    const risquee = await page.$$eval('#choixModal:not([hidden]) .choix-sheet[data-genre="evenement"] button.choix-option:not([disabled])',
      bs => bs.map(b => b.dataset.choix).filter((c, i) => /Pari/.test((bs[i].querySelector('.choix-forme') || {}).textContent || ''))[0] || null).catch(() => null);
    if (risquee) {
      const titreDe = ((await page.textContent('#choixModal .choix-titre')) || '').trim();
      await page.click(`#choixModal:not([hidden]) button.choix-option[data-choix="${risquee}"]`); await page.waitForTimeout(300);
      evenementsDe.push(titreDe);
      continue;
    }
    /*
     * LE BUTIN À TROIS CHOIX (V5) : au premier, « Retirer une carte », « Retour » (le butin revient), puis on retire pour
     * de bon ; la décision porte le retrait et pas de carte. Les butins suivants prennent une carte, comme avant.
     */
    const autre = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="recompense"] .choix-autre');
    if (autre && !butin.fait && await autre.isVisible()) {
      butin.fait = true;
      const titre0 = ((await page.textContent('#choixModal .choix-titre')) || '').trim();
      await autre.click(); await page.waitForTimeout(300);
      if (!/Retirer une carte/.test((await page.textContent('#choixModal:not([hidden]) .choix-titre').catch(() => '')) || '')) { erreurs.push('« Retirer une carte » n\'ouvre pas le deck'); continue; }
      await page.click('#choixModal .choix-fermer'); await page.waitForTimeout(300);
      if (((await page.textContent('#choixModal:not([hidden]) .choix-titre').catch(() => '')) || '').trim() !== titre0) erreurs.push('« Retour » ne rouvre pas le butin');
      await page.click('#choixModal:not([hidden]) .choix-autre'); await page.waitForTimeout(300);
      const n0 = (await decisionsDuCombat()).length;
      const cle = await page.$eval('#choixModal:not([hidden]) .choix-option:not([disabled])', b => b.dataset.choix);
      await page.click('#choixModal:not([hidden]) .choix-option:not([disabled])'); await page.waitForTimeout(1200);
      const d = (await decisionsDuCombat()).slice(n0).find(x => x.retrait);
      if (!d || d.retrait !== cle || d.recompense !== null || !String(d.palier).startsWith('r:')) erreurs.push(`le butin « retirer » n'enregistre pas le retrait (${JSON.stringify(d || null)})`);
      else butin.retrait = cle;
      continue;
    }
    if (await page.$('#choixModal:not([hidden]) button.choix-option:not([disabled])')) { await choix('button.choix-option:not([disabled])'); continue; }
    /*
     * À FAIRE (V9, tranche 1 ; JP : *tous les choix au même endroit, même UI et UX*). Chaque choix a la même forme : sa
     * bande (la voix, le sujet), puis ses options `optionHtml`. On règle le choix ouvert comme un joueur pressé : une
     * réponse risquée tant que le dé n'a pas roulé cinq fois, sinon la première option ; une option › ouvre son écran
     * (le combat, le paquet, la main, une liste), que les cas plus haut règlent. « Trancher » envoie tout le coché en
     * un lot : autant de décisions que de choix. Photographié une fois ; la route dit l'état du club.
     */
    /*
     * V12 (docs/refonte-v12.md) : la boîte renvoie au sous-onglet de sa maison (Bureau › Proprio, Effectif › Infirmerie…),
     * qui montre ses choix en entier ; le gros match et la signature montrent leur porte dans la boîte même. On règle le
     * premier qui attend ; un sous-onglet sans rien qui presse, le Bureau rend la boîte.
     */
    const ouvertA = await page.evaluate(() => { const el = [...document.querySelectorAll('#hubModal :is(.af-onglet, .af-maison.ici) .hub-msg.bloque:not(.pret)')].find(x => x.checkVisibility()); if (el) el.dataset.essai = '1'; return !!el; })
      .then(async vu => { if (!vu) return null; const el = await page.$('#hubModal .hub-msg[data-essai="1"]'); await el.evaluate(x => delete x.dataset.essai); return el; });
    if (ouvertA) {
      const lu = await ouvertA.evaluate(el => ({ genre: el.dataset.msg, sujet: (el.querySelector('.af-feuille-sujet') || {}).textContent || '',
        forme: !!el.querySelector('.hub-msg-corps > .af-options .choix-option.af-option'),
        compris: [...el.querySelectorAll('button')].some(b => /^\s*Compris\s*$/.test(b.textContent)),
        etat: (el.querySelector('.hub-msg-corps > .choix-puces') || {}).textContent || '',
        scene: ((el.querySelector('.hub-msg-corps > .scene .scene-mot') || {}).textContent || '').trim(),
        fait: ((el.querySelector('.hub-msg-corps > .scene .scene-fait') || {}).textContent || '').trim(),
        de: ((el.querySelector('.hub-msg-de') || {}).textContent || '').trim(),
        sous: [...el.querySelectorAll('.af-option .choix-option-sous')].map(x => x.textContent.trim()),
        opts: [...el.querySelectorAll('.af-option:not([disabled])')].map(b => ({ cle: b.dataset.choix, on: b.classList.contains('on'), ouvre: b.classList.contains('ouvre'), pari: /Pari/.test((b.querySelector('.choix-forme') || {}).textContent || '') })) }));
      afaire.genres.add(lu.genre); afaire.ouverts++;
      if (!lu.forme) afaire.formes.push(`${lu.genre} « ${lu.sujet} »`);
      if (lu.compris) erreurs.push(`« ${lu.sujet} » demande encore « Compris » dans À faire`);
      if (SCENES.includes(lu.genre)) {
        if (!/^«.+»$/.test(lu.scene) || !lu.fait) erreurs.push(`« ${lu.sujet} » (${lu.genre}) ne cite pas sa voix (« ${lu.scene} »)`);
        if (!scenes.has(lu.genre)) scenes.set(lu.genre, `${lu.de} ${lu.scene} — ${lu.fait}`);
      }
      if (!afaire.vu) { afaire.vu = true; await page.screenshot({ path: `${DOSSIER}/rogue-afaire.png` }); }
      if (/ta route/i.test(lu.sujet) && !afaire.route) {
        afaire.route = lu.etat; afaire.sous = lu.sous;
        await ouvertA.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${DOSSIER}/rogue-route.png` });
        if (!/Jambes \d+/.test(lu.etat) || !/en caisse/.test(lu.etat) || !/cette semaine/.test(lu.etat)) erreurs.push(`la route ne dit pas l'état du club (« ${lu.etat} »)`);
        if (!/^«.+»$/.test(lu.scene) || !lu.fait) erreurs.push(`la route ne cite pas l'entraîneur (« ${lu.scene} »)`);
        else scenes.set('route', `${lu.de} ${lu.scene} — ${lu.fait}`);
      }
      const libres = lu.opts.filter(o => !o.on);
      const pari = libres.find(o => o.pari);
      // La case vide : « tes lignes » ouvre les Lignes, qu'aucun cas plus haut ne règle ; on prend une option sur place.
      const o = pari && des.length < 5 ? pari : (lu.genre === 'trou' && libres.find(x => !x.ouvre)) || libres[0];
      if (!o) throw new Error(`« ${lu.sujet} » attend dans À faire sans option à toucher`);
      if (o === pari) evenementsDe.push(lu.sujet.trim());
      await ouvertA.$(`.af-option[data-choix="${o.cle.replace(/"/g, '\\"')}"]`).then(b => b.click());
      await page.waitForTimeout(400);
      continue;
    }
    // Un sous-onglet qui ne presse plus (un blessé que la réserve couvre, déjà réglé ailleurs) : le Bureau rend la boîte.
    if (await page.evaluate(() => [...document.querySelectorAll('#hubModal .af-onglet')].some(x => x.checkVisibility()))) {
      afaire.pages++; await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300); continue;
    }
    const trancherB = await page.$('#hubModal .hub-trancher');
    if (trancherB && await trancherB.isVisible()) {
      const prets = await page.$$eval('#hubModal .hub-msg.pret', e => e.length);
      if (afaire.lots.length === 0) await page.screenshot({ path: `${DOSSIER}/rogue-trancher.png` });
      const n0 = (await decisionsDuCombat()).length;
      await trancherB.click({ timeout: 8000 }).catch(async e => {
        const f = await page.evaluate(() => [...document.querySelectorAll('#hubModal .af-onglet .hub-msg')].map(x => x.className + ' ' + x.dataset.msg + ' ' + x.dataset.id + ' : ' + x.textContent.replace(/\s+/g, ' ').trim().slice(0, 300)));
        await page.screenshot({ path: `${DOSSIER}/rogue-trancher-cache.png` }).catch(() => {});
        throw new Error(`« Trancher » est caché par une feuille : ${f.join(' | ')}`);
      }); await page.waitForTimeout(1500);
      await page.waitForFunction(() => !document.querySelector('#hubModal .hub-msg.pret'), null, { timeout: 60000 }).catch(() => {});
      if (prets) await attendreDecisions(n0);
      const pris = (await decisionsDuCombat()).length - n0;
      afaire.lots.push(`${prets}→${pris}`);
      if (prets && !pris) console.log('rien d\'écrit : le stockage', await page.evaluate(() => Object.keys(localStorage).map(k => `${k} ${Math.round(localStorage.getItem(k).length / 1024)} Ko`).join(' · ')));
      if (pris < prets) erreurs.push(`« Trancher » envoie ${pris} décision(s) pour ${prets} choix`);
      continue;
    }
    const t = await page.$('#hubModal .hub-traiter');
    // « À régler » déplie le choix qui attend, sous l'affiche du Bureau, ou ouvre l'écran d'un choix à une seule porte.
    if (t) {
      if (!(await t.isVisible())) {
        const vus = await page.evaluate(() => [...document.querySelectorAll('#choixModal:not([hidden]) button, #hubModal button')]
          .filter(b => b.offsetParent).map(b => `${[...b.classList].pop()} « ${b.textContent.trim().slice(0, 30)} »`).slice(0, 12).join(' · '));
        const png = `${DOSSIER}/rogue-coince.png`;
        await page.screenshot({ path: png }).catch(() => {});
        throw new Error(`« À régler » existe mais n'est pas visible. Boutons visibles : ${vus || 'aucun'} (capture : ${png})`);
      }
      /*
       * LA BARRE NE CACHE PLUS LE CHOIX (Jalon M, B4) : « ⏳ Encore un choix · … » tient sur une ligne, et le toucher
       * pose le choix en haut du volet — sa première option au-dessus de la barre collée.
       */
      const mot = await t.evaluate(b => ({ txt: b.textContent.trim(), h: b.getBoundingClientRect().height }));
      if (!mot.txt.startsWith('⏳') || mot.h > 60) barreA.longs.push(`« ${mot.txt.slice(0, 40)} » (${Math.round(mot.h)} px)`);
      await t.click({ timeout: 8000 }).catch(async () => {
        const f = await page.evaluate(() => [...document.querySelectorAll('#hubModal .af-onglet .hub-msg')].map(x => `${x.className} ${x.dataset.msg} ${x.dataset.id} : ${x.textContent.replace(/\s+/g, ' ').trim().slice(0, 300)}`));
        await page.screenshot({ path: `${DOSSIER}/rogue-regler-cache.png` }).catch(() => {});
        throw new Error(`« À régler » est caché par une feuille : ${f.join(' | ')}`);
      }); await page.waitForTimeout(900);
      const sb = await page.evaluate(() => {
        const m = [...document.querySelectorAll('#hubModal :is(.af-onglet, .af-maison.ici) .hub-msg.bloque:not(.pret)')].find(x => x.checkVisibility());
        if (!m || document.querySelector('#choixModal:not([hidden])')) return null;
        // V12 : « À régler » ouvre le sous-onglet de sa maison ; sa première option se touche — rien ne la couvre, ni la barre ni les onglets.
        const o = m.querySelector('.af-option');
        if (o) o.scrollIntoView({ block: 'nearest' });
        const r = o ? o.getBoundingClientRect() : null;
        const dessus = r ? document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 1, r.top + r.height / 2)) : null;
        return { sujet: (m.querySelector('.af-feuille-sujet') || {}).textContent || '', opt: r ? r.bottom : null, libre: !o || (dessus && o.contains(dessus)) };
      });
      if (sb) { barreA.vus++; if (!sb.libre) barreA.sous.push(`« ${sb.sujet.slice(0, 30)} » : sa 1re option est couverte (elle finit à ${Math.round(sb.opt)})`); }
      // V12 : « À régler » ouvre le sous-onglet de sa maison — allumé dans la rangée de sa section —, l'écran d'un choix à
      // une seule porte (le combat, le paquet), ou montre la porte dans la boîte (la signature).
      const ou = await page.evaluate(() => {
        const pg = [...document.querySelectorAll('#hubModal .af-onglet')].find(x => x.checkVisibility());
        const on = document.querySelector('#sousNav:not([hidden]) .soustab.on');
        if (pg) return on && on.dataset.page === pg.dataset.maison ? `${on.textContent.trim()}` : `(${pg.dataset.maison} sans sous-onglet allumé)`;
        return document.querySelector('#choixModal:not([hidden]), #signatureModal:not([hidden]), #hubModal .af-maison.ici') ? 'porte' : '';
      });
      if (ou.startsWith('(')) erreurs.push(`« À régler » ouvre une maison sans son sous-onglet : ${ou}`);
      if (ou && ou !== 'porte') afaire.maisons.add(ou);
      else if (!ou) afaire.sansPage.push(mot.txt.slice(0, 40));
      continue;
    }
    return;
  }
}
// Lancer la saison
await page.click('#mainBtn');
await unVisible('#hubModal .hub-jour, #hubModal .hub-traiter, #hubModal .hub-trancher, #choixModal:not([hidden]) .choix-option');
await regler();
await tourDesBords('le premier jour');
await regler();
// LE MANDAT DU PROPRIO (S80) : la saison de la run et ce que le proprio veut — au sous-onglet du proprio (V12-2).
/* V12-2 (docs/refonte-v12.md) : un sous-onglet de sa section, son contenu permanent rendu ; puis le Bureau rend la boîte. */
/* Les cartes d'une maison sont pliées (V12-4) : on touche leur ligne, comme un joueur, avant de les jouer. */
const deplierLesCartes = async portee => {
  for (const s of await page.$$(`${portee} details.pli:not([open]) > summary`)) await s.click().catch(() => {});
  await page.waitForTimeout(250);
};
const versLOnglet = async (sec, pg) => {
  await page.click(`#navbar .navtab[data-section="${sec}"]`).catch(() => {});
  await page.click(`#sousNav .soustab[data-page="${pg}"]`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
};
await versLOnglet('bureau', 'proprio');
const run = await page.textContent('#hubModal .af-onglet[data-maison="proprio"] .hub-etat-run').catch(() => '');
console.log(`5. le proprio : ${(run || '(pas de ligne de run)').replace(/\s+/g, ' ').trim()}`);
if (!run) erreurs.push('le sous-onglet du proprio ne dit pas le mandat de la run');
// LE CONTENU PERMANENT (V12-2) : la route dit les deux semaines qui viennent ; le Bureau ne les redit pas.
await versLOnglet('bureau', 'entraineur');
const routeOnglet = await page.$('#hubModal .af-onglet[data-maison="entraineur"] .bu-route');
await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300);
const routeBoite = await page.$('#hubModal .hub-volet:not(:has(.af-onglet)) .bu-route, #hubModal .hub-carte .hub-etat');
console.log(`5v. les sous-onglets : la route ${routeOnglet ? 'chez l\'entraîneur' : 'absente'} · le Bureau ${routeBoite ? 'la redit' : 'ne la redit pas'}`);
if (!routeOnglet) erreurs.push('le sous-onglet de l\'entraîneur ne montre pas les deux semaines qui viennent');
if (routeBoite) erreurs.push('le Bureau redit la route ou le mandat, qui ont leur sous-onglet');
{
  // Ton coach et sa confiance, ton personnel : au sous-onglet de l'entraîneur (V12-2 ; JP : *un screen pour les coachs et assistants coachs*).
  await versCeSoir();
  await versLOnglet('bureau', 'entraineur');
  await page.screenshot({ path: `${DOSSIER}/rogue-entraineur.png` });
  const coachs = ((await page.textContent('#hubModal .af-onglet[data-maison="entraineur"] .ej-coach-tete').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const rangCoach = ((await page.textContent('#hubModal .af-onglet[data-maison="entraineur"] .ej-coach .ej-rang').catch(() => '')) || '').trim();
  const postes = await page.$$eval('#hubModal .af-onglet[data-maison="entraineur"] .perso-l', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())).catch(() => []);
  await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300);
  const sv0 = await lireSauvegarde();
  const d0 = ((sv0.partie || {}).decisions || []).find(x => x.jour === 0 && x.coach);
  console.log(`5c. tes coachs : ${coachs || '(absent)'} · décision du jour 0 : ${d0 ? `${d0.coach.nom} ${JSON.stringify(d0.coachsDeBase)}` : '(aucune)'}`);
  if (!d0 || d0.coach.palier !== 1) erreurs.push('le coach de la run n\'allume pas sa confiance I au jour 0');
  const p0 = ((sv0.partie || {}).decisions || []).filter(x => x.jour === 0 && x.patron);
  console.log(`5d. les patrons imposés : ${p0.map(x => `${x.patron.ico} ${x.patron.nom}`).join(' · ') || '(aucun)'}`);
  if (p0.length !== 2) erreurs.push(`la run ne part pas avec deux patrons imposés (${p0.length})`);
  if (rangCoach !== 'I') erreurs.push(`le sous-onglet de l'entraîneur ne dit pas le coach de la run et sa confiance (« ${coachs} », rang « ${rangCoach} »)`);
  console.log(`5f. ton personnel, chez l'entraîneur : ${postes.join(' | ') || '(aucun poste)'}`);
  if (postes.length < p0.length) erreurs.push(`le sous-onglet de l'entraîneur montre ${postes.length} poste(s) pour ${p0.length} patrons engagés`);
}
if (!/proprio veut/.test(run || '')) erreurs.push('le hub ne dit pas le mandat du proprio');
if (!/puis :/.test(run || '')) erreurs.push('le mandat au hub ne dit pas sa suite (« puis : … »)');
/*
 * « SEMAINE SUIVANTE » (V4) remplace « Jusqu'à la prochaine décision » : elle joue les journées une à une jusqu'à
 * la fin de la semaine, et s'arrête avant sur ce qui demande le joueur. On attend qu'elle ait fini (le bouton se
 * réactive).
 */
/*
 * V5 : « Jour suivant » est le bouton principal (le jour par jour) ; « Jusqu'à lundi » saute au nœud de la semaine.
 * L'essai prend « Jusqu'à lundi » quand il est là, sinon le bouton principal (« Aujourd'hui › » le matin).
 */
async function prochaineDecision() {
  const s = await page.$('#hubModal .hub-semaine');
  const p = s && await s.isVisible() ? s : await page.$('#hubModal .hub-jour');
  if (!p || !(await p.isVisible()) || await p.isDisabled()) return false;
  await garderLeFlottant('au bureau');
  await p.click();
  await page.waitForFunction(() => !document.querySelector('#hubModal :is(.hub-jour, .hub-semaine)[disabled]'), null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(300);
  return true;
}
/*
 * LE JOUR PAR JOUR ET LE NŒUD DU LUNDI (V5). « Jour suivant » avance d'une seule journée ; en semaine, rien d'autre
 * qu'un gros match, un pack à signer, un blessé à remplacer ou une case vide ne bloque l'avance.
 */
const PRESSE = ['choix', 'pack', 'blessure', 'trou'];
async function unJour() {
  const b = await page.$('#hubModal .hub-jour:not(.hub-vers-soir)');
  if (!b || !(await b.isVisible())) return null;
  const j0 = ((await lireSauvegarde()).partie || {}).journee;
  await garderLeFlottant('au bureau');
  await b.click();
  await page.waitForFunction(() => !document.querySelector('#hubModal .hub-jour[disabled]'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(400);
  const j1 = ((await lireSauvegarde()).partie || {}).journee;
  const bloquants = await page.$$eval('#hubModal .hub-msg.bloque', e => e.map(x => x.dataset.msg)).catch(() => []);
  return { j0, j1, bloquants };
}
// Trois journées une à une : chacune avance d'un jour, et en semaine seul ce qui presse bloque.
{
  const vus = [];
  for (let i = 0; i < 3; i++) {
    await regler();
    const r = await unJour();
    if (!r) continue;
    vus.push(`J${r.j0}→J${r.j1}${r.bloquants.length ? ` (${r.bloquants.join(',')})` : ''}`);
    if (r.j1 !== r.j0 + 1) erreurs.push(`« Jour suivant » avance de ${r.j0} à ${r.j1}`);
    if (r.j1 % 7 !== 0 && r.bloquants.some(g => !PRESSE.includes(g))) erreurs.push(`en semaine (J${r.j1}), un message qui ne presse pas bloque : ${r.bloquants.join(', ')}`);
  }
  console.log(`5e. le jour par jour : ${vus.join(' · ') || '(aucune journée)'}`);
}
// Avancer un peu pour gagner des jetons (des semaines : V4). V5 : « Jusqu'à lundi » ne s'arrête plus en route, cinq
// semaines suffisent — et la boutique de la première run montre encore ses quatre packs (avant le 20e match).
for (let i = 0; i < 5; i++) {
  await regler();
  await prochaineDecision();
}
await regler();
await versMarche('boutique'); await page.waitForTimeout(200);
const avant = (await page.textContent('#pageMarcheCorps .hub-page[data-genre="boutique"] .choix-irl')).replace(/\s+/g, ' ').trim();
await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(200);
const jauge = async () => (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`6. au hub : la boutique dit « ${avant} » · barre : ${await jauge()}`);
if (!/Plafond restant/.test(await jauge())) erreurs.push('la barre du Rogue ne montre pas le plafond');
// 1.0 (R4) ; V7 : le barème des jetons est écrit à la boutique, et ses chiffres sont ceux de la run (jamais tapés).
{
  // V7 : le barème est à la boutique, là où les jetons se dépensent.
  await versMarche('boutique'); await page.waitForSelector('#pageMarche .pk-bareme-run', { timeout: 30000 }).catch(() => {});
  const bareme = (await page.textContent('#pageMarche .pk-bareme-run').catch(() => '')) || '';
  await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300);
  const svB = await lireSauvegarde();
  const B = (svB.partie && svB.partie.rogue && svB.partie.rogue.bareme) || (svB.rogue && svB.rogue.bareme) || null;
  const lu = [...bareme.matchAll(/(\d+)/g)].map(m => Number(m[1]));
  const attendu = B ? [B.victoire, B.prolongation, B.defaite, B.grosMatch, B.objectif, B.serie] : null;
  console.log(`5b. le barème à la boutique : ${bareme.replace(/\s+/g, ' ').trim() || '(absent)'} · attendu ${attendu ? attendu.join('/') : '?'}`);
  if (!bareme) erreurs.push('la boutique n\'écrit pas le barème des jetons de la run');
  else if (attendu && lu.join(',') !== attendu.join(',')) erreurs.push(`le barème à la boutique (${lu.join('/')}) n'est pas celui de la run (${attendu.join('/')})`);
}
// V5 : LE NŒUD DE LA SEMAINE (js/noeuds.js) : après huit semaines, le lundi d'une semaine sur deux a offert ses trois routes.
{
  const routes = (((await lireSauvegarde()).partie || {}).decisions || []).filter(d => d && /^n:\d+$/.test(d.palier || ''));
  console.log(`6n. les routes prises : ${routes.map(d => `${d.palier} ${d.noeud && d.noeud.route}`).join(' · ') || 'aucune'}`);
  if (!routes.length) erreurs.push('aucune route de la semaine prise en huit semaines (js/noeuds.js)');
  if (routes.some(d => !d.noeud || !(d.gestes || d.effet || d.gain))) erreurs.push(`une route prise ne porte pas la charge de sa carte : ${JSON.stringify(routes[0])}`);
}
/*
 * LA BOUTIQUE (S79, js/magasin.js) : des rayons de packs à la HUT, chacun avec
 * sa fiche (ses chances par pack, le barème d'une carte, l'espace sous le
 * plafond), puis l'ouverture.
 */
const decisions = async () => ((await lireSauvegarde()).partie || {}).decisions || [];
const dechirer = async () => {
  const paquet = await page.waitForSelector('#choixModal:not([hidden]) .paquet', { timeout: 60000 }).catch(() => null);
  if (paquet) await passerLaPile();
  await page.waitForTimeout(600);
};
const acheter = async (pack, capture) => {
  await versMarche('boutique');
  await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
  // V5 : la boutique est ouverte en tout temps (JP : *accès au store en tout temps*).
  if (await page.$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-mot', p => p.textContent.trim().startsWith('🔒')).catch(() => false)) erreurs.push('la boutique est fermée');
  // 1.0 (R5) : à la première run, la boutique commence par quatre packs ; « Voir les N packs » montre le reste.
  if (!(await page.$(`#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-pack="${pack}"]`)) && await page.$('#pageMarche .hub-page[data-genre="boutique"] .pk-tout')) { await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-tout'); await page.waitForTimeout(300); }
  await page.click(`#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-pack="${pack}"]`);
  await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche');
  // LA FICHE SE POSE SUR L'ÉCRAN (1.0, oct.) : JP la trouvait au bas des rayons, hors écran.
  const vue = await page.$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche-carte', c => { const r = c.getBoundingClientRect(); return { haut: Math.round(r.top), bas: Math.round(r.bottom), h: innerHeight }; });
  if (vue.haut < 0 || vue.bas > vue.h + 1) erreurs.push(`la fiche du pack ${pack} sort de l'écran (de ${vue.haut} à ${vue.bas} px sur ${vue.h})`);
  if (capture) await page.screenshot({ path: `${DOSSIER}/${capture}.png` });
  const ok = await page.$('#pageMarche .hub-page[data-genre="boutique"] .pk-acheter:not([disabled])');
  // Pas assez de jetons : la fiche du pack se referme d'abord (« Retour »), puis la boutique — la fiche couvre le ✕.
  if (!ok) { await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-retour'); return false; }
  await ok.click();
  await dechirer();
  return true;
};
await versMarche('boutique');
await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
await verifMarche('la boutique ouverte');
await page.screenshot({ path: `${DOSSIER}/rogue-boutique.png` });
const nPacks = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', e => e.length);
const espace = await page.textContent('#pageMarche .hub-page[data-genre="boutique"] .inv-plafond').catch(() => '');
// 1.0 (R5) : à la première run, quatre packs pour commencer, un bouton « Voir les N packs », et un pack impayable qui dit ce qui manque.
const voirTout = await page.$('#pageMarche .hub-page[data-genre="boutique"] .pk-tout');
console.log(`7. la boutique : ${nPacks} packs · ${(espace || '(pas de plafond)').replace(/\s+/g, ' ').trim()}${voirTout ? ` · « ${(await voirTout.textContent()).trim()} »` : ''}`);
if (!espace) erreurs.push('la boutique ne dit pas l\'espace sous le plafond');
if (nPacks !== 4 || !voirTout) erreurs.push(`la première run devrait ouvrir sur quatre packs et « Voir les N packs » : ${nPacks} packs, bouton ${voirTout ? 'présent' : 'absent'}`);
else {
  await page.screenshot({ path: `${DOSSIER}/rogue-boutique-debut.png` });
  await voirTout.click(); await page.waitForTimeout(300);
  // Les packs des rayons (le pack de la semaine et ton club à part).
  const nTout = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-rayon:not(.pk-rayon-jour):not(.pk-rayon-club) .pk-tuile[data-pack]', e => e.length);
  const chers = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile.pk-cher .pk-manque', e => e.map(x => x.textContent.trim()));
  // Un pack coûte plus que la caisse ? Alors sa tuile doit le dire. (À 84 🪙, aucun pack n'est impayable : rien à exiger.)
  const jetonsB = Number(((await page.textContent('#pageMarche .hub-page[data-genre="boutique"] .choix-irl')) || '').replace(/\D+/g, ' ').trim().split(' ')[0]) || 0;
  const prixMax = Math.max(...await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile:not(.verrou) .pk-prix', e => e.map(x => Number((x.textContent.match(/(\d+)\s*🪙/) || [])[1]) || 0)));
  console.log(`7b. tout : ${nTout} packs · caisse ${jetonsB} 🪙, le plus cher ${prixMax} 🪙 · ${chers.length} impayable(s) (${chers.slice(0, 2).join(' · ')})`);
  // Jalon P2 : la boutique vend ses packs, tous mixtes ; V10 (les packs qui montent) : huit, dont deux ouverts à la première run.
  if (nTout !== 8) erreurs.push(`« Voir les N packs » montre ${nTout} packs, il en faut 8`);
  const sousCle = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-rayon:not(.pk-rayon-jour):not(.pk-rayon-club) .pk-tuile.verrou[data-pack]', e => e.map(x => `${x.dataset.pack} : ${x.title}`));
  console.log(`7c. sous clé : ${sousCle.length} · ${sousCle.slice(0, 2).join(' · ')}`);
  if (sousCle.length !== 6 || !sousCle.some(t => /^j:argent : Qualifie-toi pour les séries/.test(t))) erreurs.push(`à la première run, six packs sous clé, l'Argent aux séries : ${sousCle.join(' · ')}`);
  if (prixMax > jetonsB && (!chers.length || !chers.every(t => /il te manque \d+/.test(t)))) erreurs.push('un pack impayable ne dit pas ce qui manque');
  // Échap ferme la boutique (1.0, R5 ; U21 : c'est un sous-onglet, le retour mène au Bureau) ; on la rouvre pour continuer comme avant.
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="boutique"]')) erreurs.push('Échap ne ferme pas la boutique');
  await versMarche('boutique'); await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
}
/*
 * TON CLUB À LA BOUTIQUE (1.0, oct.). JP : *même monnaie que les autres packs*. Les Harfangs (15 🪙) s'achètent au rayon
 * « Ton club » : la caisse baisse, le méta les garde, ils sont portés, et l'en-tête le dit.
 */
{
  const tout = await page.$('#pageMarche .hub-page[data-genre="boutique"] .pk-tout');
  if (tout) { await tout.click(); await page.waitForTimeout(300); }
  const avantJ = Number(((await page.textContent('#pageMarche .hub-page[data-genre="boutique"] .choix-irl')) || '').replace(/\D+/g, ' ').trim().split(' ')[0]) || 0;
  // Le nuancier : l'onglet des couleurs en montre une par tuile, l'aplat et la seconde.
  await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-rayon-club [data-onglet="palette"]');
  await page.waitForTimeout(300);
  const nuances = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-rayon-club .pk-nuance', e => e.length);
  await page.$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-rayon-club', e => e.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${DOSSIER}/rogue-boutique-couleurs.png` });
  if (nuances !== 50) erreurs.push(`le nuancier de la boutique montre ${nuances} couleurs, il en faut 50`);
  console.log(`7c. le nuancier : ${nuances} couleurs à débloquer`);
  await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-rayon-club [data-onglet="club"]');
  await page.waitForTimeout(300);
  await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-club="club:harfangs"]');
  await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche .club-porte');
  await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche .pk-acheter');
  await page.waitForTimeout(1500);
  await auBureau();
  const mc = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}').club || {});
  const tete = await page.textContent('.tete-nom');
  await versMarche('boutique'); await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
  const apresJ = Number(((await page.textContent('#pageMarche .hub-page[data-genre="boutique"] .choix-irl')) || '').replace(/\D+/g, ' ').trim().split(' ')[0]) || 0;
  console.log(`7c. ton club à la boutique : les Harfangs · ${avantJ} → ${apresJ} 🪙 · porté : ${mc.club} · en-tête « ${tete} »`);
  if (mc.club !== 'harfangs' || tete !== 'Harfangs' || apresJ !== avantJ - PRIX_HARFANGS) erreurs.push(`les Harfangs achetés à la boutique (${avantJ} → ${apresJ} 🪙, méta ${mc.club}, en-tête « ${tete} »)`);
}
/*
 * S80 : LE JOUEUR D'UNE CARTE. La fiche d'un pack par niveau dit ses chances
 * de joueur par pack (★ Étoile ou mieux, ★ Phénomène) et le niveau d'une
 * carte (cinq rangées, un rang réel chacune). Capturée aussi dépliée : au
 * téléphone, la fiche défile.
 */
const NOMS_NIVEAUX = ['Soutien', 'Régulier', 'Pilier', 'Étoile', 'Phénomène'];
await versMarche('boutique');
await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-pack="j:bronze"]');
await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche');
await page.screenshot({ path: `${DOSSIER}/rogue-fiche-bronze.png` });
const fiche3 = await page.evaluate(() => {
  const c = document.querySelector('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche-carte');
  const lu = { titres: [...c.querySelectorAll('h4')].map(h => h.textContent.trim()),
    chances: [...c.querySelectorAll('.pk-chances tr.pk-niveau')].map(t => t.textContent.replace(/\s+/g, ' ').trim()),
    niveaux: [...c.querySelectorAll('.pk-niveaux tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()) };
  c.style.maxHeight = 'none';
  return lu;
});
await page.locator('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche-carte').screenshot({ path: `${DOSSIER}/rogue-fiche-bronze-entiere.png` });
// La fiche est fixée à l'écran : dépliée pour la capture, elle se replie avant qu'on touche « Retour ».
await page.$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche-carte', c => { c.style.maxHeight = ''; });
console.log(`3b. la fiche du Pack Bronze : ${fiche3.chances.join(' · ')} · ${fiche3.niveaux.join(' · ')}`);
if (!fiche3.titres.includes('Le joueur d\'une carte') || fiche3.niveaux.length !== 5 || !fiche3.chances.some(x => /Phénomène/.test(x))) erreurs.push(`la fiche du pack ne dit pas le joueur d'une carte : ${JSON.stringify(fiche3)}`);
await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-retour');
await acheter('j:epoque', 'rogue-pack-fiche');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
// Jalon Q : un pack mixte se déchire une fois sur tout son contenu (joueurs et cartes de jeu, rien à signer).
const revele = await page.$$eval('#choixModal .choix-option.tc', e => ({ joueurs: e.filter(x => x.querySelector('.cj-mini-carte')).length, jeu: e.filter(x => !x.querySelector('.cj-mini-carte')).length, signer: e.filter(x => x.querySelector('.tcj-signer')).length }));
if (!revele.joueurs || !revele.jeu || revele.signer) erreurs.push(`le pack Époque ne se montre pas en entier avant la signature : ${JSON.stringify(revele)}`);
await page.screenshot({ path: `${DOSSIER}/rogue-pack.png` });
// S80 : chaque carte dit son niveau UNE fois — sur son ruban (★ Étoile, ★ Phénomène) ou en un mot sous la carte, jamais les deux.
const niveaux = await page.$$eval('#choixModal .choix-option.tc', (e, noms) => e.filter(x => x.querySelector('.cj-mini-carte')).map(x => {
  const ruban = (x.querySelector('.cj-ruban') || {}).textContent || '';
  const mot = ((x.querySelector('.tc-quoi') || {}).textContent || '').split('\n')[0].trim();
  return { ruban, mot, fois: noms.filter(n => ruban.includes(n)).length + noms.filter(n => mot === n).length };
}), NOMS_NIVEAUX);
if (niveaux.some(x => x.fois !== 1)) erreurs.push(`le niveau d'une carte ouverte n'est pas dit une fois : ${JSON.stringify(niveaux)}`);
/*
 * LA LISTE DU 82-0 (Jalon R). JP : *la liste pour signer en mode 82-0, c'est clair complet, pourquoi c'est pas ça en
 * roguelike ?*. « Signer un joueur » ouvre les rangées du vestiaire, chacune avec sa meilleure case (la ligne, qui
 * sort, ce que ça change par match) ; toucher la rangée ouvre la fiche ; toucher la destination ouvre « qui sort ? ».
 */
await page.click('#choixModal:not([hidden]) .choix-fermer');
await page.waitForSelector('#signatureModal:not([hidden]) .pcard', { timeout: 30000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${DOSSIER}/rogue-liste-signature.png` });
const offres = await page.$$eval('#signatureModal .pcard .pcard-nom', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
const dests = await page.$$eval('#signatureModal .pcard .pcard-dest', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
console.log(`8. le pack Argent, en liste : ${offres.map((o, i) => `${o} → ${dests[i]}`).join(' · ')} · niveaux ${niveaux.map(x => x.mot || x.ruban).join(', ')}`);
if (!offres.length || offres.length !== revele.joueurs) erreurs.push(`la liste de signature montre ${offres.length} joueurs, le pack ${revele.joueurs}`);
if (!dests.some(t => / sort/.test(t))) erreurs.push(`aucune rangée ne dit où il va : ${dests.join(' | ')}`);
// LE MEILLEUR POUR TON ALIGNEMENT (oct. 2026) : la liste se range par ce que chacun change à ton alignement ; le premier
// qui fait gagner quelque chose passe en tête, sous son titre, cerclé d'or — jamais plus d'un.
{
  const titres = await page.$$eval('#signatureModal .sig-liste > .aln-titre', e => e.map(x => x.textContent.trim()));
  const cercles = await page.$$eval('#signatureModal .sig-liste > .pcard.meilleure', e => e.length);
  const premier = await page.$eval('#signatureModal .sig-liste > :first-child', x => x.className).catch(() => '');
  console.log(`8m. le meilleur pour ton alignement : ${titres.join(' · ') || 'aucun titre'} · ${cercles} cerclé(s)`);
  if (cercles > 1) erreurs.push(`${cercles} joueurs cerclés d'or dans la liste de signature`);
  if (cercles && !(titres[0] === 'Le meilleur pour ton alignement' && /aln-titre/.test(premier))) erreurs.push('le joueur cerclé d\'or n\'est pas en tête, sous son titre');
}
// Toucher la rangée montre sa fiche, sans la prendre.
await page.click('#signatureModal .pcard .pcard-qui');
await page.waitForTimeout(600);
const fiche = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
const encore = !!(await page.$('#signatureModal:not([hidden]) .btn-sign'));
if (!fiche || !encore) erreurs.push(`toucher la rangée : fiche ${fiche}, liste toujours ouverte ${encore}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
// U18 (JP : *signer doit toujours demander qui part*) : « Signer » ouvre « qui sort ? » dès que quelqu'un sort, la meilleure
// sortie en tête et cerclée d'or ; une case libre où personne ne sort se signe sans question. Le ✕ ramène à la liste.
const destSigner = await page.$eval('#signatureModal .pcard:not(.locked) .pcard-dest', x => x.textContent.replace(/\s+/g, ' ').trim());
if (!/personne ne sort/.test(destSigner)) {
  await page.click('#signatureModal .pcard:not(.locked) .btn-sign');
  const qs = await page.waitForSelector('#choixModal:not([hidden]) .sig-liste .pcard', { timeout: 10000 }).catch(() => null);
  if (!qs) erreurs.push(`« Signer » pose le joueur sans demander qui sort (${destSigner})`);
  else {
    const tete = await page.$$eval('#choixModal .sig-liste .pcard', e => ({ n: e.filter(x => x.classList.contains('meilleure')).length, premiere: e[0].classList.contains('meilleure') }));
    if (tete.n !== 1 || !tete.premiere) erreurs.push(`« qui sort ? » après « Signer » : la meilleure sortie n'est pas seule en tête, cerclée d'or (${JSON.stringify(tete)})`);
    await page.screenshot({ path: `${DOSSIER}/rogue-signer-qui-sort.png` }); await compterFeuilles('signer-qui-sort');
    await page.click('#choixModal .choix-fermer');
    await page.waitForTimeout(400);
    if (!(await page.$('#signatureModal:not([hidden]) .pcard'))) erreurs.push('fermer « qui sort ? » referme aussi la liste de signature');
    console.log(`   « Signer » demande qui sort : la meilleure sortie proposée en tête (${destSigner})`);
  }
}
// Le nom du joueur qu'on signe : il doit être dans l'alignement tout de suite (S79). On choisit sa case soi-même (« Changer »).
const nomSigne = await page.$eval('#signatureModal .pcard:not(.locked) .pcard-nom', x => x.textContent.replace(/\s+/g, ' ').trim());
await page.click('#signatureModal .pcard:not(.locked) .sig-changer');
/*
 * QUI SORT, EN LISTE (Jalon U). JP : *choisir qui est remplacé avec un menu similaire à celui pour signer le joueur*.
 * Les rangées de la liste de signature : chacune dit sa ligne et ce que sa sortie change à la masse ; « Sort » décide
 * qui part, puis « Où joue X ? » (l'alignement) place l'arrivant. La réserve libre est un bouton au-dessus.
 */
await page.waitForSelector('#choixModal:not([hidden]) .sig-liste .pcard', { timeout: 10000 });
await page.waitForTimeout(300);
const titre = (await page.textContent('#choixModal .choix-titre')).trim();
const libreOfferte = !!(await page.$('#choixModal .sig-libre:not([disabled])'));
// V9 (tranche 4, le plafond qui mord) : une case libre que le plafond refuse se montre grisée, avec sa raison.
const libreRefus = libreOfferte ? '' : await page.$eval('#choixModal .sig-libre[disabled]', b => b.getAttribute('title') || '').catch(() => '');
const rangees = await page.$$eval('#choixModal .sig-liste .pcard', e => e.length);
if (rangees < 20) erreurs.push(`« qui sort ? » ne montre que ${rangees} joueurs`);
const refusees = await page.$$eval('#choixModal .sig-sort[disabled]', e => e.length);
// Un joueur qui sort (pas la réserve libre) : c'est le chemin qui retire quelqu'un.
// La sortie proposée (U18) signe à sa case calculée ; un autre sortant passe par « Où joue X ? », l'étape éprouvée ici.
const AUTRE = '#choixModal .sig-liste .pcard:not(.meilleure) .sig-sort:not([disabled])';
const barreSortie = await page.$eval(AUTRE, b => b.closest('.pcard').querySelector('.pcard-dest').textContent.replace(/\s+/g, ' ').trim());
if (!/(trio|paire|partant|auxiliaire|réserve).*masse/i.test(barreSortie)) erreurs.push(`une rangée de « qui sort ? » ne dit pas sa ligne et la masse : « ${barreSortie} »`);
await page.screenshot({ path: `${DOSSIER}/rogue-qui-sort.png` }); await compterFeuilles('qui-sort');
await page.click(AUTRE);
// Où joue l'arrivant : sa case, et ce qui glisse.
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-ligne', { timeout: 10000 });
await page.waitForTimeout(300);
// Où joue X ? (Jalon U) : les rangées de la signature ; chacune dit ce que sa case fait, « Ici » décide.
const barrePlace = await page.$eval('#choixModal .aln-ligne .aln-choisir:not([disabled])', b => b.closest('.aln-ligne').querySelector('.aln-dit').textContent.replace(/\s+/g, ' ').trim());
if (!/: .+masse/.test(barrePlace)) erreurs.push(`une rangée de « où joue ? » ne dit pas ce qui va se passer : « ${barrePlace} »`);
console.log(`   qui sort : ${rangees} rangées, ${refusees} grisée(s) · « ${barreSortie} » · puis « ${barrePlace} »`);
await page.click('#choixModal .aln-ligne .aln-choisir:not([disabled])');
// APRÈS UN PACK SIGNÉ : la boutique est rouverte AU MARCHÉ, le Club n'a pas paru (une capture à 390 px).
await page.waitForSelector('#pageMarche:not([hidden]) .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 120000 });
await page.waitForTimeout(500);
await verifMarche('après un pack signé');
await page.screenshot({ path: `${DOSSIER}/rogue-boutique-apres-pack.png` });
await auBureau();
await verifClubSansBoutique('le bureau du Club après un pack');
await page.waitForTimeout(800);
let d = await decisions();
// 1.0 (J1-B) : l'achat est la décision `k:n` ; la signature, une seconde décision `k:n:signe` (sans l'achat).
const signe = d.filter(x => x.ballottage && (x.achat || /^k:\d+:signe$/.test(x.palier || '')))
  .map(x => ({ ...x, achat: x.achat || (d.find(a => a.achat && a.palier === x.palier.replace(/:signe$/, '')) || {}).achat || {} }));
console.log(`9. signé : ${JSON.stringify(signe.map(x => ({ pack: x.achat.pack, entre: x.ballottage.entre, sort: x.ballottage.sort, i: x.ballottage.i, rar: x.ballottage.rar })))} · « ${titre} » · case libre offerte : ${libreOfferte}${libreRefus ? ` (refusée : ${libreRefus})` : ''} · ${refusees} case(s) grisée(s) (pas sa position, ou le plafond) · barre : ${await jauge()}`);
if (!signe.length) erreurs.push('le pack de joueurs n\'a rien signé');
else if (!libreOfferte && !libreRefus) erreurs.push(`la case de réserve libre n'a pas été offerte, ni refusée avec sa raison (« ${titre} »)`);
/*
 * LE JOUEUR SIGNÉ EST DANS L'ALIGNEMENT TOUT DE SUITE (S79). JP : *les cartes
 * que j'ouvre des packs s'ajoutent pas dans mon équipe ?*. La décision ne
 * s'appliquait qu'au matin de la journée suivante : l'écran montrait l'ancien
 * alignement jusque-là (`poserAlignementDuJour`, js/sim.js).
 */
{
  await page.click('#navbar .navtab[data-section="soir"]').then(() => page.click('#sousNav .soustab[data-page="alignement"]', { timeout: 3000 }).catch(() => {})).catch(() => {});
  await page.waitForTimeout(800);
  const noms = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  const nom = nomSigne.split(' ').slice(-1)[0];
  if (!noms.some(n => n.includes(nom))) erreurs.push(`${nomSigne}, signé d'un pack, n'est pas dans l'alignement`);
  else console.log(`   ${nomSigne} est dans l'alignement dès la signature`);
  await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {});
  await page.waitForTimeout(500);
}
// Jalon P2 : des packs mixtes (des joueurs ET des cartes) ; leurs cartes vont au deck et à tes places (une de trop se vend, À faire). V10 : les deux de la première run.
await regler();
for (const pack of ['j:bronze', 'j:epoque']) {
  if (!(await acheter(pack))) { console.log(`   (pas assez de jetons pour ${pack})`); continue; }
  await page.screenshot({ path: `${DOSSIER}/rogue-${pack.slice(2)}.png` });
  // Jalon Q : le paquet entier, puis la signature, joueurs seuls ; « Plus tard » laisse l'offre à la boîte.
  await page.click('#choixModal:not([hidden]) .choix-fermer');
  await page.waitForTimeout(500);
  if (await page.$('#signatureModal:not([hidden])')) await page.click('#signatureModal .choix-fermer');
  await auBureau();
  await regler();
}
/*
 * TES PLACES (V9, tranche 5b ; dans « Ce soir », où le match se prépare) : après les packs de cartes, trois cartes au
 * plus, la carte de trop vendue par À faire ; une place vide se voit. Chaque carte dit où elle joue et sa durée.
 */
{
  await auBureau();
  await page.screenshot({ path: `${DOSSIER}/rogue-bureau.png` });
  // LE BUREAU À UN ÉCRAN (docs/ecrans-rogue.md, E4) : la route en puces, À faire en enveloppes ; on mesure ce qui défile encore.
  const bu = await page.$eval('#hubModal .hub-sheet', e => ({ h: e.scrollHeight, v: e.clientHeight, blocs: [...e.querySelectorAll('.hub-volet > *, .hub-carte > *, .hub-boite')].map(x => `${x.className.split(' ')[0]} ${Math.round(x.getBoundingClientRect().height)}`).join(' · ') })).catch(() => null);
  if (bu) console.log(`10c. le Bureau : ${(bu.h / Math.max(1, bu.v)).toFixed(2).replace('.', ',')} écran · ${bu.blocs}`);
  await versCeSoir();
  await page.screenshot({ path: `${DOSSIER}/rogue-ce-soir.png`, fullPage: true });
  // CE SOIR EN TROIS CHIFFRES (E5) : les barres face à face, et ce qui défile encore.
  const cs = await page.$eval('#hubModal .hub-sheet', e => ({ h: e.scrollHeight, v: e.clientHeight, barres: e.querySelectorAll('.hub-duel.barres tr').length })).catch(() => null);
  if (cs) console.log(`10d. Ce soir : ${(cs.h / Math.max(1, cs.v)).toFixed(2).replace('.', ',')} écran · ${cs.barres} rangée(s) en barres`);
  if (cs && cs.barres && cs.barres !== 3) erreurs.push(`Ce soir montre ${cs.barres} rangées en barres, pas trois`);
  // Deux copies d'une même carte se groupent en une tuile « ×2 » (Jalon M, B9) : on compte les copies.
  const cases = await page.$$eval('#hubModal .hub-poche .hub-poche-case[data-ref]', e => e.reduce((a, x) => a + Number(((x.querySelector('.hub-poche-n') || {}).textContent || '×1').slice(1)), 0)).catch(() => -1);
  // UN VERBE PAR TUILE, ET LES PLACES SOUS L'AFFICHE (B9) : chaque tuile dit ce qu'un toucher fait, et la section est à moins d'un écran du haut du volet.
  const b9 = await page.$eval('#hubModal', m => {
    const ts = [...m.querySelectorAll('.hub-poche .hub-poche-case[data-ref]')];
    const sec = m.querySelector('.hub-poche'), v = sec && sec.closest('.hub-volet, .coq-volet, [data-volet]') || m;
    return { sansVerbe: ts.filter(t => !/Jouer|Poser| ›/.test((t.querySelector('.hub-poche-verbe') || {}).textContent || '')).length,
      haut: sec ? sec.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop : -1, ecran: innerHeight };
  }).catch(() => ({ sansVerbe: 0, haut: -1, ecran: 844 }));
  console.log(`10b. tes places : ${b9.sansVerbe} tuile(s) sans verbe · à ${Math.round(b9.haut)} px du haut du volet (un écran : ${b9.ecran})`);
  if (b9.sansVerbe) erreurs.push(`${b9.sansVerbe} tuile(s) de tes places ne disent pas ce qu'un toucher fait`);
  if (b9.haut > b9.ecran) erreurs.push(`tes places sont à ${Math.round(b9.haut)} px du haut de « Ce soir », plus d'un écran`);
  // Comptées comme les cases : une tuile « ×2 » dit où jouent ses deux copies.
  const places = await page.$$eval('#hubModal .hub-poche .hub-poche-case[data-ref]', e => e.filter(x => x.querySelector('.hub-poche-place'))
    .reduce((a, x) => a + Number(((x.querySelector('.hub-poche-n') || {}).textContent || '×1').slice(1)), 0)).catch(() => 0);
  // V12-4 : une place qui se joue ailleurs est une ligne qui y mène (`.hub-poche-vers`) ; les libres, le titre les compte (« 2 sur 3 »).
  const ailleurs = await page.$$eval('#hubModal .hub-poche .hub-poche-vers', e => e.length).catch(() => 0);
  const titrePlaces = ((await page.textContent('#hubModal .hub-poche-t b').catch(() => '')) || '').match(/(\d+) sur (\d+)/);
  const libres = titrePlaces ? Number(titrePlaces[2]) - Number(titrePlaces[1]) : 3;
  const trop = (await decisionsDuCombat()).filter(d => d.vend && !d.joue).length;
  console.log(`10a. tes places, dans « Ce soir » : ${cases} carte(s), ${ailleurs} ailleurs, ${libres} libre(s), ${places} disent où elles jouent · ${pocheVendues} vendue(s) en grand, ${trop} vente(s) en tout · À faire : ${[...afaire.genres].join(', ')}`);
  if (cases < 0 || !(await page.$('#hubModal .hub-poche'))) erreurs.push('tes places ne se voient pas dans « Ce soir »');
  else if (cases + ailleurs > 3) erreurs.push(`« Ce soir » montre ${cases + ailleurs} cartes à tes places (trois au plus, la carte de trop se vend)`);
  else if (cases + ailleurs && cases + ailleurs + libres !== 3) erreurs.push(`${cases} carte(s), ${ailleurs} ailleurs et ${libres} place(s) libre(s) : il en faut trois`);
  else if (places < cases) erreurs.push(`${cases - places} carte(s) de tes places ne disent pas où elles jouent`);
  /*
   * POSER EN TOUCHANT (V8) : une modif de joueur touchée dans « Ce soir » ouvre tes lignes, ceux qui peuvent la porter
   * allumés ; « Annuler » les referme (l'essai ne la pose pas ici : tes places servent plus loin).
   */
  const modif = await page.$$eval('#hubModal .hub-poche .hub-poche-case[data-ref]', e => e.findIndex(x => x.hasAttribute('data-pose'))).catch(() => -1);
  if (modif >= 0) {
    await page.click(`#hubModal .hub-poche .hub-poche-case[data-ref] >> nth=${modif}`); await page.waitForTimeout(400);
    await page.screenshot({ path: `${DOSSIER}/rogue-pose.png`, fullPage: true });
    const cibles = await page.$$eval('#hubModal .pose-zone .pose-puce.cible', e => e.length).catch(() => 0);
    const grises = await page.$$eval('#hubModal .pose-zone .pose-puce:disabled', e => e.length).catch(() => 0);
    console.log(`10b. poser en touchant : ${cibles} joueur(s) allumé(s), ${grises} grisé(s)`);
    if (!cibles) erreurs.push('une modif touchée dans « Ce soir » n\'allume aucun joueur de tes lignes');
    await page.click('#hubModal .pose-zone .pose-annuler').catch(() => {}); await page.waitForTimeout(300);
    if (await page.$('#hubModal .pose-zone')) erreurs.push('« Annuler » ne referme pas les lignes de la pose');
  } else console.log('10b. poser en touchant : aucune modif de joueur à tes places');
  // L'INFIRMERIE (V8 ; son sous-onglet en V12-2) : un blessé du tableau de l'Effectif est aussi dans l'infirmerie.
  await page.click('#navbar .navtab[data-section="effectif"]'); await page.waitForTimeout(500);
  await page.click('#sousNav .soustab[data-page="joueurs"]', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400);
  await page.screenshot({ path: `${DOSSIER}/rogue-effectif.png`, fullPage: true });
  const marques = await page.$$eval('#pageJoueursCorps .jr-bl', e => e.length).catch(() => 0);
  await versLOnglet('effectif', 'infirmerie');
  await page.screenshot({ path: `${DOSSIER}/rogue-infirmerie.png` });
  // Un réserviste blessé n'a pas de case à remplir et se dit dans la ligne « En réserve » : on compte les blessés du titre.
  const inf = await page.$eval('#hubModal .af-onglet[data-maison="infirmerie"] .jr-infirmerie', e => ({
    lignes: e.querySelectorAll('.jr-inf').length,
    total: Number(((e.querySelector('h3') || {}).textContent || '').match(/(\d+)\s*$/)?.[1] || 0),
  })).catch(() => ({ lignes: 0, total: 0 }));
  console.log(`10c. l'infirmerie : ${inf.total} blessé(s), ${inf.lignes} en case, ${marques} 🩹 au tableau des avants`);
  if (marques > inf.total) erreurs.push(`${marques} blessé(s) au tableau de l'Effectif, ${inf.total} à l'infirmerie`);
  // UN MOT SE TOUCHE (V8) : la ligne du mandat porte sa définition ; la toucher l'affiche dans une bulle, le toucher suivant la ferme.
  await versLOnglet('bureau', 'proprio');
  if (await page.$('#hubModal .hub-etat-run')) {
    await page.click('#hubModal .hub-etat-run'); await page.waitForTimeout(200);
    const bulle = ((await page.textContent('.bulle-def').catch(() => '')) || '').trim();
    console.log(`10d. un mot se touche : « ${bulle.slice(0, 60)} »`);
    if (!/mandat/i.test(bulle)) erreurs.push('toucher la ligne du mandat n\'affiche pas sa définition');
    await page.mouse.click(5, 300); await page.waitForTimeout(150);
    if (await page.$('.bulle-def')) erreurs.push('la bulle d\'une définition ne se referme pas au toucher suivant');
  }
}
/*
 * L'INVENTAIRE (S79, js/inventaire.js) : les cartes de la saison (elles SE
 * GARDENT jusqu'au moment voulu), les permanentes, le deck, le classeur, et
 * la masse salariale. On joue une carte : une décision datée du jour.
 */
await versMarche('cartes');
await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-inventaire.png` });
const poche = await page.$$eval('#pageMarche .hub-page[data-genre="cartes"] .bq-carte', e => e.map(x => x.querySelector('.tc-nom').textContent.trim()));
console.log(`10. inventaire : ${poche.join(' · ') || '(vide)'}`);
/*
 * UNE MAISON PAR SUJET (V12-3). JP : *that philosophy should be for everything*. La masse salariale et les cartes de
 * contrat sont chez le proprio, les soins à l'infirmerie, le personnel chez l'entraîneur ; Tes cartes y renvoie
 * (« À l'infirmerie › ») au lieu de les jouer, et ce bouton ouvre le bon sous-onglet.
 */
{
  if (await page.$('#pageMarche .hub-page[data-genre="cartes"] .inv-plafond')) erreurs.push('la masse salariale est encore au Marché › Tes cartes');
  const renvois = await page.$$eval('#pageMarche .hub-page[data-genre="cartes"] .inv-renvoi', e => e.map(b => b.dataset.maison));
  const SEC = { proprio: 'bureau', entraineur: 'bureau', infirmerie: 'effectif' };
  const ici = {};
  let plafond = '';
  for (const k of Object.keys(SEC)) {
    await versLOnglet(SEC[k], k);
    await page.waitForSelector(`#hubModal:not([hidden]) .af-onglet[data-maison="${k}"]`, { timeout: 15000 }).catch(() => erreurs.push(`le sous-onglet « ${k} » ne s'ouvre pas`));
    ici[k] = await page.$$eval(`#hubModal .af-onglet[data-maison="${k}"] .maison-jouer`, e => e.map(b => b.dataset.id)).catch(() => []);
    // Le volet ne garde que le sous-onglet ouvert : la masse salariale se lit chez le proprio, pendant qu'on y est.
    if (k === 'proprio') plafond = await page.textContent('#hubModal .af-onglet[data-maison="proprio"] .inv-plafond', { timeout: 3000 }).catch(() => '');
  }
  if (!plafond) erreurs.push('le proprio ne montre pas la masse salariale');
  for (const k of new Set(renvois)) if (!(ici[k] || []).length) erreurs.push(`Tes cartes renvoie à « ${k} », qui n'a aucune carte à jouer`);
  let suivi = '';
  if (renvois.length) {
    await versMarche('cartes');
    await page.click('#pageMarche .hub-page[data-genre="cartes"] .inv-renvoi');
    await page.waitForTimeout(600);
    suivi = await page.$eval('#hubModal:not([hidden]) .af-onglet[data-maison]', e => e.dataset.maison).catch(() => '');
    if (suivi !== renvois[0]) erreurs.push(`« ${renvois[0]} › » ouvre « ${suivi || 'rien'} »`);
  }
  // V12-4 : chaque sous-onglet tient en un écran (390 × 844) ; on mesure chacun, la feuille entière.
  const hauteur = () => page.$eval('#hubModal .hub-sheet', e => e.scrollHeight / Math.max(1, e.clientHeight)).catch(() => 0);
  const ecrans = {}, avecChoix = new Set();
  for (const [sec, k] of [['bureau', 'match'], ['bureau', 'proprio'], ['bureau', 'entraineur'], ['bureau', 'presse'], ['bureau', 'vestiaire'], ['effectif', 'infirmerie'], ['marche', 'butin'], ['soir', 'soir']]) {
    await versLOnglet(sec, k);
    await page.waitForTimeout(300);
    ecrans[k] = await hauteur();
    if (await page.$(`#hubModal .af-onglet[data-maison="${k}"] .hub-msg`)) avecChoix.add(k);
  }
  console.log(`10h. les sous-onglets, en écrans : ${Object.entries(ecrans).map(([k, v]) => `${k} ${v.toFixed(2).replace('.', ',')}${avecChoix.has(k) ? ' (avec un choix)' : ''}`).join(' · ')}`);
  // V12-4a : un sous-onglet de la boîte, sans choix qui attend, tient sous la borne du duel (20j), 1,3 écran ; le but reste
  // un écran. La boîte, « Ce soir » et les sous-onglets qui ont des choix se mesurent : leurs choix se plieront (V12-4b).
  for (const [k, v] of Object.entries(ecrans)) if (!['match', 'soir'].includes(k) && !avecChoix.has(k) && v > 1.3) erreurs.push(`le sous-onglet « ${k} » fait ${v.toFixed(2).replace('.', ',')} écran (1,3 au plus)`);
  // `ARRET=10h` : on ne veut que ces hauteurs (une mise en page qu'on retouche) ; le reste de la saison attend.
  if (process.env.ARRET === '10h') {
    // Chaque sous-onglet en entier : l'écran grandit à sa hauteur, le temps d'une capture.
    for (const [sec, k] of [['bureau', 'entraineur'], ['bureau', 'vestiaire'], ['effectif', 'infirmerie'], ['soir', 'soir']]) {
      await versLOnglet(sec, k);
      await page.setViewportSize({ width: 390, height: Math.ceil(844 * Math.max(1, ecrans[k])) + 40 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DOSSIER}/ecran-${k}.png` });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.click('#navbar .navtab[data-section="soir"]').catch(() => {});
    await page.click('#sousNav .soustab[data-page="alignement"]', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    for (const t of ['Équipe', 'Attaque', 'Défense']) {
      await page.getByRole('button', { name: t, exact: true }).first().click().catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${DOSSIER}/ecran-lignes-${t}.png`, fullPage: true });
    }
    await browser.close(); process.exit(erreurs.length ? 1 : 0);
  }
  console.log(`10m. une maison par sujet : ${(plafond || '(pas de masse salariale)').replace(/\s+/g, ' ').trim().slice(0, 60)} · renvois ${renvois.join(', ') || 'aucun'}${suivi ? ` (→ ${suivi})` : ''} · ${Object.entries(ici).map(([k, v]) => `${k} ${v.length}`).join(' · ')}`);
  await versMarche('cartes');
  await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 });
}
/*
 * UNE MODIF DE JOUEUR SE POSE AU VERSO (S80). JP : *donne l'alignement, je
 * clique sur le joueur, pis je dois aller au verso pour l'ajouter dans une
 * des slots joueurs?* ; *je veux que les upgrades de joueurs se fassent au
 * verso de la carte*. « Jouer » ouvre l'alignement ; toucher un joueur ouvre
 * sa fiche retournée au verso, la carte en attente sur sa case libre ;
 * « Poser ici » décide — une décision `{ joue, mutation }`.
 */
let posee = null, nomModif = '';
{
  /*
   * UNE MODIF QUE PERSONNE NE PEUT RECEVOIR (« Le physio » sans malus, un
   * masque sans gardien…) ouvre l'alignement tout grisé, avec la raison : on
   * la referme et on essaie la suivante (S80, la fusion : le premier tirage
   * n'en donnait pas toujours une qui se pose).
   */
  const nModifs = await page.$$eval('#pageMarche .hub-page[data-genre="cartes"] .bq-joueur .inv-jouer:not([disabled])', e => e.length);
  /*
   * EN ROGUE, UNE CARTE SE JOUE DE TES PLACES (V9) : quand tu veux, sans limite. Qu'aucune modif n'y soit dépend du
   * tirage (et de la carte de trop vendue), et l'étape du verso attend.
   */
  const modifsVues = await page.$$eval('#pageMarche .hub-page[data-genre="cartes"] .bq-joueur', e => e.length);
  // Jalon P2 : plus de pack Modifs ; une modif sort d'un pack mixte au hasard du tirage, et l'étape du verso attend sans elle.
  if (!modifsVues) console.log('7a. aucune modif de joueur dans l\'inventaire (les packs mixtes n\'en ont pas donné) : l\'étape du verso attend');
  else if (!nModifs) console.log(`7a. ${modifsVues} modif(s) dans l'inventaire, aucune ne se joue : l'étape du verso attend`);
  let permis = 0, grises = 0;
  for (let k = 0; k < nModifs && !permis; k++) {
    if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
    const jouer = (await page.$$('#pageMarche .hub-page[data-genre="cartes"] .bq-joueur .inv-jouer:not([disabled])'))[k];
    if (!jouer) break;
    nomModif = await jouer.evaluate(b => (((b.closest('.bq-joueur') || b).querySelector('.tc-nom') || {}).textContent || '').trim());
    await jouer.click();
    await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-ligne', { timeout: 10000 });
    await page.waitForTimeout(400);
    permis = await page.$$eval('#choixModal .aln-ligne .aln-choisir:not([disabled])', e => e.length);
    grises = await page.$$eval('#choixModal .aln-ligne .aln-choisir[disabled]', e => e.length);
    if (!permis) {
      console.log(`   « ${nomModif} » : personne ne peut la recevoir (${grises} grisés), on essaie la suivante`);
      await page.click('#choixModal:not([hidden]) .choix-fermer').catch(() => page.keyboard.press('Escape'));
      await page.waitForTimeout(500);
    }
  }
  if (nModifs && !permis) console.log('7a. aucune modif ne se pose sur cet alignement : l\'étape du verso est sautée');
  else if (nModifs) {
    await page.screenshot({ path: `${DOSSIER}/rogue-poser-alignement.png` });
    // Jalon U : « Poser » sur la rangée décide tout de suite (plus de détour par la fiche au verso).
    const nomJoueur = await page.$eval('#choixModal .aln-ligne .aln-choisir:not([disabled])', b => b.closest('.aln-ligne').querySelector('.pcard-nom').textContent.trim());
    await page.click('#choixModal .aln-ligne .aln-choisir:not([disabled])');
    await auBureau();
    await page.waitForTimeout(800);
    await regler();
    d = await decisions();
    posee = d.find(x => x.joue && x.mutation) || null;
    if (!posee) erreurs.push(`« ${nomModif} » n'a pas été posée`);
    console.log(`7a. « ${nomModif} » posée sur ${nomJoueur} (${permis} joueurs permis, ${grises} grisés) : ${JSON.stringify(posee && { joue: posee.joue.id, mutation: posee.mutation })}`);
  }
}
if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
/*
 * LE CONGÉDIEMENT (V5). JP : *juste un coach peut être actif à la fois* ; *changé avec une carte qui enlève l'autre
 * bonus*. La carte offre les autres coachs (pas celui en poste) ; le choix entre comme une décision `coachNeuf` à la
 * confiance I, et la sauvegarde porte le nouveau coach de la run.
 */
{
  // V12-2 (JP : *everything coaching should be at same place*) : il se joue chez l'entraîneur, avec ton coach et ton personnel.
  const avant = await lireSauvegarde();
  const coachAvant = (avant.rogue && avant.rogue.coach) || (avant.partie && avant.partie.rogue && avant.partie.rogue.coach);
  await versLOnglet('bureau', 'entraineur');
  await deplierLesCartes('#hubModal .af-onglet[data-maison="entraineur"]');
  const jouer = await page.$('#hubModal .af-onglet[data-maison="entraineur"] .maison-jouer[data-id="consommable:congediement"]');
  if (await page.$('#pageMarche .inv-jouer-meta[data-id="consommable:congediement"]')) erreurs.push('« Le congédiement » est encore au Marché › Tes cartes');
  if (!jouer) erreurs.push('« Le congédiement » ne se joue pas depuis le sous-onglet de l\'entraîneur');
  else {
    await jouer.click();
    await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 10000 });
    await page.screenshot({ path: `${DOSSIER}/rogue-congediement.png` });
    const offerts = await page.$$eval('#choixModal .choix-option', e => e.map(x => x.dataset.choix));
    const n0 = (await decisions()).length;
    await page.click('#choixModal .choix-option');
    await page.waitForTimeout(800);
    await regler();
    const dc = (await decisions()).slice(n0).find(x => x.coachNeuf);
    const apres = await lireSauvegarde();
    const coachApres = (apres.rogue && apres.rogue.coach) || (apres.partie && apres.partie.rogue && apres.partie.rogue.coach);
    console.log(`10c. le congédiement : ${coachAvant} → ${dc ? `${dc.coach.cle} ${dc.coach.palier}` : '(rien)'} · offerts ${offerts.join(', ')} · coach de la run ${coachApres}`);
    if (offerts.includes(coachAvant)) erreurs.push('« Le congédiement » offre le coach déjà en poste');
    if (!dc || dc.coach.palier !== 1 || dc.coach.cle === coachAvant) erreurs.push(`« Le congédiement » n'installe pas un autre coach à la confiance I (${JSON.stringify(dc ? dc.coach : null)})`);
    else if (coachApres !== dc.coach.cle) erreurs.push(`la sauvegarde garde ${coachApres} comme coach de la run, pas ${dc.coach.cle}`);
  }
  /*
   * LE RAPPEL DU CLUB-ÉCOLE (Jalon P3) : trois cartes de ton cartable, une signée ; la décision est un ballottage
   * dont le joueur sort de ton cartable, au plus Régulier. V12-3 : les rappels se jouent dans l'effectif, sous le tableau
   * des joueurs (Effectif › Joueurs), plus au Marché › Tes cartes.
   */
  if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
  await page.click('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet[data-onglet="permanent"]').catch(() => {});
  await page.waitForTimeout(300);
  if (await page.$('#pageMarche .inv-jouer-meta[data-id="consommable:rappel"], #pageMarche .inv-jouer-meta[data-id="consommable:echangeDoublon"]')) erreurs.push('un rappel est encore au Marché › Tes cartes');
  const versLEffectif = async () => {
    await versLOnglet('effectif', 'joueurs');
    await page.waitForSelector('#pageJoueurs:not([hidden]) .jr-table', { timeout: 15000 }).catch(() => {});
  };
  await versLEffectif();
  await deplierLesCartes('#pageJoueurs');
  const rappel = await page.$('#pageJoueurs .maison-jouer[data-id="consommable:rappel"]');
  if (!rappel) erreurs.push('« Le rappel du club-école » ne se joue pas dans l\'effectif (Effectif › Joueurs)');
  else {
    await rappel.click();
    // Jalon R : la liste, chacun à sa meilleure case ; « Signer » demande qui sort (U18), la meilleure sortie proposée.
    await page.waitForSelector('#signatureModal:not([hidden]) .btn-sign', { timeout: 30000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DOSSIER}/rogue-rappel.png` });
    const offres = await page.$$eval('#signatureModal .pcard', e => e.length);
    const n0 = (await decisions()).length;
    await page.click('#signatureModal .btn-sign:not([disabled])');
    await page.waitForTimeout(500);
    // Qui sort, puis la boîte se règle du bureau (un message peut attendre sous la page du Marché).
    for (let k = 0; k < 6 && await page.$('#choixModal:not([hidden])'); k++) await regler().catch(() => {});
    // Joué, on revient dans l'effectif (`G.pageVoulue`), pas au Bureau.
    await page.waitForSelector('#pageJoueurs:not([hidden]) .jr-table', { timeout: 20000 }).catch(() => {});
    const revenu = await page.evaluate(() => !document.querySelector('#pageJoueurs').hidden);
    await auBureau();
    await regler();
    const d = (await decisions()).slice(n0).find(x => x.ballottage);
    const cartable = await page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs) || {}));
    console.log(`10d. le rappel du club-école : ${offres} cartes offertes · ${d ? `${d.ballottage.entre} entre, ${d.ballottage.sort || 'case libre'} sort` : '(rien signé)'} · revenu dans l'effectif : ${revenu}`);
    if (!revenu) erreurs.push('un rappel joué dans l\'effectif ne ramène pas dans l\'effectif');
    // Trois au plus : seulement les cartes qui tiennent sous le plafond, Pilier au plus (`offresDuCartable`) — le tirage en laisse parfois moins.
    if (offres < 1 || offres > 3) erreurs.push(`le rappel offre ${offres} cartes (d'une à trois)`);
    if (!d) erreurs.push('le rappel du club-école ne signe personne');
    else if (!cartable.includes(d.ballottage.entre)) erreurs.push('le joueur rappelé ne vient pas du cartable');
  }
  /*
   * L'ÉCHANGE D'UN DOUBLON (Jalon P3) : le doublon le plus fourni du cartable (trois copies de CARTES[1], 1995-96) donne
   * trois joueurs de sa série de cartons (Filet : 1995-96 à 1998-99), pas encore au cartable ; signé, le doublon perd une
   * copie et le nouveau entre au cartable.
   */
  await versLEffectif();
  await deplierLesCartes('#pageJoueurs');
  const echange = await page.$('#pageJoueurs .maison-jouer[data-id="consommable:echangeDoublon"]');
  if (!echange) erreurs.push('« L\'échange d\'un doublon » ne se joue pas dans l\'effectif (Effectif › Joueurs)');
  else {
    const copies = () => page.evaluate(k => ((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs || {})[k] || {}).n || 0, CARTES[1]);
    const avant = await copies();
    await echange.click();
    await page.waitForSelector('#signatureModal:not([hidden]) .pcard', { timeout: 60000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DOSSIER}/rogue-echange.png` });
    const lu = await page.evaluate(() => ({ cles: [...document.querySelectorAll('#signatureModal .pcard')].map(e => e.dataset.cle), recit: (document.querySelector('#signatureModal .choix-recit') || {}).textContent || '' }));
    const horsSerie = lu.cles.filter(k => !['1995-96', '1996-97', '1997-98', '1998-99'].includes(k.split('_')[0]));
    if (lu.cles.length !== 3) erreurs.push(`l'échange offre ${lu.cles.length} joueurs au lieu de trois`);
    if (horsSerie.length) erreurs.push(`l'échange offre des joueurs hors de la série du doublon : ${horsSerie.join(', ')}`);
    if (!/Il part : .+, série Filet/.test(lu.recit)) erreurs.push(`l'échange ne dit pas quel doublon part : « ${lu.recit} »`);
    const n0 = (await decisions()).length;
    const signable = await page.$('#signatureModal .pcard:not(.locked) .btn-sign:not([disabled])');
    if (signable) {
      await signable.click();
      await page.waitForTimeout(500);
      for (let k = 0; k < 6 && await page.$('#choixModal:not([hidden])'); k++) await regler().catch(() => {});
      await auBureau();
      await regler();
    }
    const d = (await decisions()).slice(n0).find(x => x.ballottage);
    const apres = await copies(), au = d ? (await cartable()).includes(d.ballottage.entre) : false;
    console.log(`10e. l'échange d'un doublon : ${lu.cles.join(', ')} · ${d ? `${d.ballottage.entre} entre` : '(rien signé)'} · copies du doublon ${avant} → ${apres} · au cartable ${au}`);
    if (!d) erreurs.push('l\'échange d\'un doublon ne signe personne');
    else {
      if (apres !== avant - 1) erreurs.push(`le doublon donné garde ses copies (${avant} → ${apres})`);
      if (!au) erreurs.push('le joueur reçu à l\'échange n\'entre pas au cartable');
    }
  }
  // Les cartes de la saison, pour la suite (11).
  if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
  await page.click('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet[data-onglet="partie"]').catch(() => {});
  await page.waitForTimeout(300);
}
/*
 * UNE CARTE SANS CIBLE VALABLE (« Blessé à long terme » sans blessé) rouvre
 * l'inventaire au lieu de se jouer : les plombiers sont tirés au hasard, donc
 * la première carte ne se joue pas toujours. On essaie les cartes une à une
 * jusqu'à ce qu'une décision entre dans la sauvegarde.
 */
// Une autre famille que les modifs (elles se posent au verso, plus haut).
const avantJouees = (await decisions()).filter(x => x.joue).length;
let jouee = false, essais = 0;
for (; essais < 5 && !jouee; essais++) {
  if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
  const boutons = await page.$$('#pageMarche .hub-page[data-genre="cartes"] .bq-carte:not(.bq-joueur) .inv-jouer:not([disabled])');
  if (!boutons[essais]) break;
  await boutons[essais].click();
  await page.waitForTimeout(600);
  // Personne à qui la donner (Jalon U : la liste vide le dit à sa place, et reste ouverte) : on la ferme.
  if (await page.$('#signatureModal:not([hidden]) .empty-msg')) { await page.click('#signatureModal .choix-fermer'); await page.waitForTimeout(300); }
  await regler();
  await page.waitForSelector('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 120000 }).catch(() => {});
  d = await decisions();
  jouee = d.filter(x => x.joue).length > avantJouees;
  // REVENIR OÙ L'ON ÉTAIT (1.0, oct.) : une carte jouée rouvre « Tes cartes », pas le bureau.
  if (jouee && !(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) erreurs.push('une carte jouée ramène au bureau au lieu de « Tes cartes », au Marché');
}
if (await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]')) await page.click('#navbar .navtab[data-section="bureau"]');
d = await decisions();
console.log(`11. jouée (${essais} essai(s)) : ${JSON.stringify(d.filter(x => x.joue).map(x => ({ id: x.joue.id, champs: Object.keys(x).filter(k => !['jour', 'joue', 'sel'].includes(k)) })))} · barre : ${await jauge()}`);
// Une modif posée au verso (7a) est déjà une carte jouée : le Rogue paie moins (S80), et l'inventaire
// ne tient parfois que des modifs. L'erreur, c'est qu'AUCUNE carte n'ait pu se jouer.
if (!jouee && !d.some(x => x.joue)) erreurs.push('aucune carte de l\'inventaire n\'a pu se jouer (cinq essais)');
else if (!jouee) console.log('    (rien d\'autre que des modifs dans l\'inventaire : la modif posée au verso compte)');
// LE CARTABLE (S79) : dans la Collection (1.0, R1), à côté de tes saisons.
await page.click('#navbar .navtab[data-section="marche"]');
await page.click('#sousNav .soustab[data-page="cartable"]');
await page.waitForSelector('#pageCartable:not([hidden]) .ct-carte', { timeout: 20000 });
await page.screenshot({ path: `${DOSSIER}/rogue-cartable.png` });
console.log(`12. le cartable : ${(await page.textContent('.ct-comptes')).replace(/\s+/g, ' ').trim()} · ${await page.$$eval('[data-ct-equipe]', e => e.length)} cartes d'équipe`);
// LES EXTENSIONS (Jalon P4) : les missions en tête, une décennie s'ouvre et dit sa complétion sur ses shards.
{
  await page.click('#pageCartable [data-vue="extensions"]');
  await page.waitForSelector('#pageCartable .ct-missions', { timeout: 10000 });
  const missions = await page.$$eval('#pageCartable .ct-mission', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  await page.click('#pageCartable details.ct-set > summary');
  await page.waitForFunction(() => /\d+ \/ \d+/.test((document.querySelector('#pageCartable details.ct-set[open] .ct-set-n') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const ext = await page.$eval('#pageCartable details.ct-set[open] summary', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  await page.screenshot({ path: `${DOSSIER}/rogue-extensions.png` });
  console.log(`12x. les extensions : ${ext} · missions : ${missions.join(' | ')}`);
  if (missions.length !== 6) erreurs.push(`le cartable montre ${missions.length} missions au lieu de six`);
  if (!/\d+ \/ \d+/.test(ext)) erreurs.push(`une extension ouverte ne dit pas sa complétion (« ${ext} »)`);
  await page.click('#pageCartable [data-vue="equipe"]');
  await page.waitForTimeout(300);
}
/*
 * LE VERSO GARDE LA CARTE POSÉE (S80) : la fiche du joueur, retournée, la
 * montre dans une case pleine. Puis « + Poser une amélioration » d'une fiche
 * ouverte du cartable : tes cartes qui lui vont, en cartes ; celle qu'on
 * touche revient EN ATTENTE au verso, et « Poser ici » la pose.
 */
// Une modif de gardien (un masque) peut tomber sur un bouche-trou de la ligue, qui n'est pas au cartable : l'étape attend.
const poseeAuCartable = posee && await page.$(`[data-ct-equipe="${posee.mutation.joueur}"]`);
if (posee && !poseeAuCartable) console.log(`12a. ${posee.mutation.joueur} est un bouche-trou de la ligue, pas une carte du cartable : l'étape du verso attend`);
if (poseeAuCartable) {
  await page.click(`[data-ct-equipe="${posee.mutation.joueur}"]`);
  await page.waitForSelector('#hockeyCardModal .fc-cases', { state: 'attached', timeout: 10000 });
  await page.click('#hockeyCardModal .fc-plaque .cj-retourner');
  await page.waitForTimeout(700);
  const pleines = await page.$$eval('#hockeyCardModal .fc-case.pleine', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  const titre = await page.$$eval('#hockeyCardModal .fc-sec', e => e.map(x => x.textContent.trim()).find(t => /améliorations/i.test(t)) || '');
  if (!pleines.some(t => t.includes(nomModif))) erreurs.push(`le verso ne montre pas « ${nomModif} » dans une case : ${pleines.join(' | ') || 'aucune case pleine'}`);
  await page.evaluate(() => document.querySelector('#hockeyCardModal .fc-cases').scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${DOSSIER}/rogue-verso-cases.png` });
  console.log(`12a. son verso : « ${titre} » — ${pleines.join(' | ')}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
{
  let fait = false;
  for (const cle of (await page.$$eval('[data-ct-equipe]', e => e.map(x => x.dataset.ctEquipe))).slice(0, 23)) {
    await page.click(`[data-ct-equipe="${cle}"]`);
    await page.waitForSelector('#hockeyCardModal .fc-cases', { state: 'attached', timeout: 10000 });
    if (!(await page.$('#hockeyCardModal .fc-plus'))) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); continue; }
    await page.click('#hockeyCardModal .fc-plaque .cj-retourner');
    await page.waitForTimeout(700);
    await page.click('#hockeyCardModal .fc-plus');
    await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="poser"] .tc', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DOSSIER}/rogue-choisir-carte.png` });
    const offertes = await page.$$eval('#choixModal .tc .tc-nom', e => e.map(x => x.textContent.trim()));
    await page.click('#choixModal .tc');
    await page.waitForSelector('#hockeyCardModal .fc-poser', { timeout: 10000 });
    const avant = (await decisions()).filter(x => x.joue && x.mutation).length;
    await page.click('#hockeyCardModal .fc-poser');
    await auBureau();
    await page.waitForTimeout(800);
    await regler();
    const apres = (await decisions()).filter(x => x.joue && x.mutation).length;
    if (apres !== avant + 1) erreurs.push(`« + Poser une amélioration » n'a rien posé (${avant} puis ${apres})`);
    console.log(`12b. « + Poser une amélioration » : ${offertes.join(' · ')} offertes, la première posée (${apres} modif(s) posée(s))`);
    fait = true;
    break;
  }
  if (!fait) console.log('12b. plus de modif à poser (ou personne à qui elles vont)');
  if (!(await page.$(BUREAU))) { await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {}); }
}
await page.click('#navbar .navtab[data-section="bureau"]');
await unVisible(BUREAU, 20000);
// La fin de saison se JOUE (S79 : plus de « Fin de saison ») : décision après décision, jusqu'au bilan.
for (let i = 0; i < 200; i++) {
  await regler();
  // Deux « Voir le bilan » peuvent exister (le bureau et sa page) : c'est le visible qui compte.
  if (await page.locator('#hubModal .hub-suite:visible').count()) break;
  if (await page.$('.result .score') && await page.isVisible('.result .score')) break;
  if (await prochaineDecision()) continue;
  const j = await page.$('#hubModal .hub-jour');
  if (j && await j.isVisible()) { await j.click(); await page.waitForTimeout(400); }
}
await page.locator('#hubModal .hub-suite:visible, .result .score:visible').first().waitFor({ timeout: 120000 }).catch(async e => {
  console.log('DIAG', await page.evaluate(() => ({ sec: document.body.dataset.section, page: document.body.dataset.page, choix: (document.getElementById('choixModal') || {}).hidden, choixTxt: ((document.getElementById('choixModal') || {}).innerText || '').slice(0, 300), boutons: [...document.querySelectorAll('#hubModal button')].filter(b => b.offsetParent).map(b => b.className.split(' ').pop() + ':' + b.textContent.trim().slice(0, 25)) })));
  throw e;
});
// Ce qui reste à régler avant le bilan (un palier, un sommaire).
await regler();
// Prendre le dernier palier peut mener tout droit au bilan : on ne touche « Voir le bilan » que s'il est là.
const suite = page.locator('#hubModal .hub-suite:visible').first();
if (await suite.count()) await suite.click();
await page.waitForSelector('.result .score', { timeout: 60000 });
await page.waitForTimeout(2500);
/*
 * LA RUN AU BILAN (S80) : la saison de la run, le mandat du proprio, et la
 * suite — la saison suivante si le mandat est rempli (après les séries),
 * sinon une nouvelle run. « Rejouer la saison » n'existe pas dans une run.
 */
/*
 * « TA RUN » (1.0, R7) : une run finie (mandat manqué : la première saison
 * sans séries) ou gagnée ouvre UN écran, une fois, avant qu'on reparte ; ses
 * chiffres sont ceux du méta. Une run qui continue n'en ouvre pas.
 */
{
  const ecranRun = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="run"]');
  const svR = await lireSauvegarde();
  const sort = ((await page.textContent('#resultHost .rg-run').catch(() => '')) || '');
  const finie = /Mandat manqué|run est gagnée/.test(sort);
  const metaR = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
  console.log(`12c. « Ta run » : ${ecranRun ? 'ouvert' : 'fermé'} · run ${finie ? 'finie' : 'en cours'} · dernière run au méta : ${metaR.derniereRun ? JSON.stringify(metaR.derniereRun) : '(aucune)'}`);
  // LES GALONS AU BILAN (Jalon M, A8 et B8) : ceux que le cartable a gravés pour cette saison, un par ligne, sous le capitaine.
  const nGalons = await page.evaluate(() => Object.values((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs) || {})
    .flatMap(x => (x.chez || []).filter(e => e.run === 1 && e.s === 1)).reduce((a, e) => a + (e.galons || []).length, 0));
  const auBilan = await page.$$eval('#resultHost .rg-run .run-galons-l li', ls => ls.length);
  console.log(`12d. les galons au bilan : ${auBilan} ligne(s) pour ${nGalons} galon(s) gravé(s)`);
  if (auBilan !== nGalons) erreurs.push(`le bilan montre ${auBilan} galon(s), le cartable en a gravé ${nGalons}`);
  if (nGalons && !/Le capitaine/.test(await page.textContent('#resultHost .rg-run .run-galons').catch(() => ''))) erreurs.push('les galons du bilan ne disent pas la voix du capitaine');
  if (finie && !ecranRun) erreurs.push('la run est finie et l\'écran « Ta run » ne s\'est pas ouvert');
  if (!finie && ecranRun) erreurs.push('la run continue et l\'écran « Ta run » s\'est ouvert quand même');
  if (ecranRun) {
    await page.screenshot({ path: `${DOSSIER}/rogue-ta-run.png` });
    const txt = (await ecranRun.textContent()).replace(/\s+/g, ' ');
    const d = metaR.derniereRun || {};
    if (/Mandat manqué/.test(sort) && !/Le proprio\s*« [^»]+ »/.test(txt)) erreurs.push(`« Ta run » ne cite pas le proprio : ${txt.slice(0, 160)}`);
    const galonsRun = await ecranRun.$$eval('.run-galons-l li', ls => ls.length);
    if (galonsRun !== nGalons) erreurs.push(`« Ta run » montre ${galonsRun} galon(s), le cartable en a gravé ${nGalons}`);
    if (!new RegExp(`${d.saisons}\\s*saison`).test(txt) || !txt.includes(`+${d.ecussons}`) || !txt.includes(`🏅 ${metaR.ecussons}`)) erreurs.push(`« Ta run » ne dit pas les chiffres du méta : ${txt.slice(0, 160)}`);
    if (!(svR.partie && svR.partie.rogue && svR.partie.rogue.taRunVue) && !(svR.rogue && svR.rogue.taRunVue)) erreurs.push('« Ta run » vu n\'est pas dans la sauvegarde (il se rouvrirait au rechargement)');
    await page.click('#choixModal:not([hidden]) .choix-fermer');
    await page.waitForTimeout(300);
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="run"]')) erreurs.push('« Ta run » ne se ferme pas');
  }
}
const blocRun = await page.$('#resultHost .rg-run');
if (blocRun) { await blocRun.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${DOSSIER}/rogue-run-bilan.png` }); }
const motRun = blocRun ? (await blocRun.textContent()).replace(/\s+/g, ' ').trim() : '';
const rejouer = await page.isVisible('#replayBtn').catch(() => false);
console.log(`13. la run au bilan : ${motRun.slice(0, 220) || '(rien)'}${rejouer ? ' · « Rejouer la saison » visible !' : ''}`);
if (!blocRun || rejouer) erreurs.push('le bilan ne montre pas la run, ou garde « Rejouer la saison »');
const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
const nCartable = (await cartable()).length;
console.log(`14. fin de saison : ${meta.ecussons} écussons · ${meta.runs} run · ${meta.saisons} saison · jalons ${Object.keys(meta.jalons || {}).join(', ') || '(aucun)'} · collection ${(meta.collection || []).length} joueurs · cartable ${nCartable} cartes · personnel ${(meta.personnel || []).length} · inventaire permanent ${Object.values(meta.inventaire || {}).reduce((a, n) => a + n, 0)} · dernière équipe ${(meta.derniereEquipe || []).length}`);
/*
 * GRAVER (V9, tranche 7) : la saison finie, chaque joueur de ton équipe a sa ligne « chez toi » au cartable (run 1,
 * saison 1, ses matchs et ses points), ses galons s'il en a, et le panthéon garde au moins le record du club.
 */
{
  const g = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('cap82_cartable') || '{}'), m = JSON.parse(localStorage.getItem('cap82_rogue') || '{}');
    const lignes = Object.values(c.joueurs || {}).map(x => (x.chez || []).find(e => e.run === 1 && e.s === 1)).filter(Boolean);
    return { lignes: lignes.length, joues: lignes.filter(e => e.gp > 0).length, galons: lignes.reduce((a, e) => a + (e.galons || []).length, 0), pantheon: m.pantheon || null };
  });
  const P = g.pantheon || { records: {}, trophees: [], chandails: [] };
  console.log(`14b. graver : ${g.lignes} ligne(s) « chez toi » (${g.joues} avec des matchs) · ${g.galons} galon(s) · panthéon : ${Object.keys(P.records).join(', ') || 'aucun record'} · ${P.trophees.length} trophée(s)`);
  if (g.lignes < 18) erreurs.push(`la saison gravée ne garde que ${g.lignes} ligne(s) « chez toi »`);
  if (!P.records.club) erreurs.push('le panthéon ne garde pas le record du club');
  // Un galon se mérite : une poignée par saison, jamais tout l'alignement (la première règle des grands soirs en donnait 18).
  if (g.galons > 8) erreurs.push(`${g.galons} galons en une saison : un galon se mérite`);
}
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
/*
 * TON CLUB (1.0, oct.) : au vestiaire, on porte ce qu'on a acheté à la boutique. On remet les NHL Stars :
 * le méta le garde, et l'en-tête le dit.
 */
await page.waitForSelector('#choixModal:not([hidden]) .choix-option[data-choix="club"]', { timeout: 10000 });
await page.click('#choixModal:not([hidden]) .choix-option[data-choix="club"]');
await page.waitForSelector('#choixModal:not([hidden]) .club-porte', { timeout: 10000 });
const nClub = await page.$$eval("#choixModal .choix-option", e => e.length);
// Deux onglets (Jalon U) : les clubs (un nom et son écusson, ensemble) et cinquante et une couleurs — les gratuits compris.
const parOnglet = {};
for (const o of ['palette', 'club']) {
  await page.click(`#choixModal:not([hidden]) [data-onglet="${o}"]`);
  await page.waitForTimeout(400);
  parOnglet[o] = await page.$$eval('#choixModal .choix-option', e => e.length);
}
if (parOnglet.club !== NB_CLUBS || parOnglet.palette !== 51) erreurs.push(`les onglets du club : ${JSON.stringify(parOnglet)}, il faut ${NB_CLUBS} et 51`);
await page.click('#choixModal:not([hidden]) .choix-option[data-choix="club:stars"]');
await page.waitForSelector('#choixModal:not([hidden]) .club-porte', { timeout: 10000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${DOSSIER}/rogue-club.png` });
const m3 = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
const tete = await page.textContent('.tete-nom');
console.log(`18. ton club : ${nClub} clubs · onglets ${JSON.stringify(parOnglet)} · porté : ${(m3.club || {}).club} · en-tête « ${tete} » · pris : ${((m3.club || {}).pris || []).join(', ')}`);
if ((m3.club || {}).club !== 'stars' || tete !== 'NHL Stars' || !((m3.club || {}).pris || []).includes('club:harfangs')) erreurs.push(`le club remis n'est pas porté (méta ${(m3.club || {}).club}, en-tête « ${tete} »)`);
console.log(`19. walkouts : ${walkouts} pack(s) ont annoncé leur carte (saison, poste, écusson) · ${piles} pile(s) passée(s) carte par carte`);
if (!piles) erreurs.push('aucun paquet ouvert : la pile n\'a pas été traversée');
console.log(`20b. combats (un écran chacun) : ${combats.length ? combats.join(' · ') : 'aucun cette run'}`);
console.log(`20d. périodes de duel jouées (période:geste) : ${periodes.length ? periodes.join(' · ') : 'aucune cette run'}`);
console.log(`20e. la route de la semaine : ${afaire.route ? `${afaire.route} · ${afaire.sous.join(' | ')}` : 'jamais offerte'}`);
console.log(`20d. À faire : ${afaire.ouverts} choix réglés, genres ${[...afaire.genres].join(', ') || 'aucun'} · lots tranchés (cochés → décisions) ${afaire.lots.join(' · ') || 'aucun'}`);
if (!afaire.vu) erreurs.push('À faire n\'a jamais porté de choix');
if (afaire.vu && !afaire.lots.length) erreurs.push('aucun lot tranché');
if (afaire.formes.length) erreurs.push(`des choix d'À faire n'ont pas la forme commune (options \`optionHtml\`) : ${afaire.formes.slice(0, 4).join(' · ')}`);
if (!afaire.route) erreurs.push('la route de la semaine n\'a jamais été offerte dans À faire');
// V12 : chaque chose à régler ouvre sa page ; la boîte n'en règle aucune sur place.
console.log(`20m. les sous-onglets de la boîte : ${[...afaire.maisons].join(' · ') || 'aucun'} · ${afaire.pages} retour(s) à la boîte`);
if (afaire.sansPage.length) erreurs.push(`« À régler » n'ouvre ni page ni écran : ${afaire.sansPage.slice(0, 3).join(' · ')}`);
if (afaire.maisons.size < 3) erreurs.push(`la boîte n'a renvoyé qu'à ${afaire.maisons.size} sous-onglet(s) : ${[...afaire.maisons].join(', ')}`);
console.log(`20c. butin « retirer une carte » : ${butin.retrait ? `${butin.retrait} retirée` : butin.fait ? 'ouvert, rien d\'enregistré' : 'aucun butin cette run'}`);
console.log(`20. dés lancés : ${des.length ? des.join(' · ') : 'aucun cette run (aucune réponse risquée choisie)'}`);
// LE DUEL (V9) : un gros match joué se rend à sa troisième période, chacune décidée.
if (combats.length && !periodes.some(x => x.startsWith('3'))) erreurs.push(`aucun duel ne s'est rendu à sa troisième période (${periodes.join(' · ') || 'aucune période'})`);
// LE SOIR D'UN MATCH (JP, 17 oct.) : une page du soir qui suit un gros match est le sommaire du match.
console.log(`20f. les pages du soir : ${soirs.pages}, dont ${soirs.match} sommaire(s) de match`);
if (combats.length && !soirs.match) erreurs.push(`aucune page du soir n'a été le sommaire d'un match (${soirs.pages} page(s) du soir)`);
console.log(`20g. le bouton flottant : vu ${flottant.vus} fois${flottant.petits.length ? `, écrasé : ${flottant.petits.slice(0, 4).join(' · ')}` : ', 44 px au moins chaque fois'} · la mise doublée touchée : ${mise.lu || 'jamais offerte'}`);
if (flottant.petits.length) erreurs.push(`le bouton flottant est écrasé sous 44 px (${flottant.petits.length} fois : ${flottant.petits.slice(0, 3).join(' · ')})`);
if (!flottant.vus) erreurs.push('le bouton flottant n\'a jamais paru (« Ce soir » défilé au bout)');
console.log(`20n. rien ne colle au bord (${MARGE} px) : ${bords.vus} écrans mesurés${bords.fautes.size ? `, ${bords.fautes.size} faute(s) : ${[...bords.fautes.values()].slice(0, 12).join(' | ')}` : ', aucun ne colle'}`);
if (bords.fautes.size) erreurs.push(`${bords.fautes.size} élément(s) collent au bord de l'écran : ${[...bords.fautes.values()].slice(0, 4).join(' | ')}`);
console.log(`20i. « Encore un choix » touché : ${barreA.vus} choix dépliés${barreA.sous.length ? `, ${barreA.sous.length} sous la barre` : ', la 1re option au-dessus de la barre chaque fois'}`);
if (barreA.sous.length) erreurs.push(`la barre collée cache le choix qu'elle ouvre : ${barreA.sous.slice(0, 3).join(' · ')}`);
if (barreA.longs.length) erreurs.push(`« Encore un choix » ne tient pas sur une ligne : ${barreA.longs.slice(0, 3).join(' · ')}`);
console.log(`20k. une feuille à la fois : ${feuilles.vues} capture(s) · ${feuilles.empilees.length ? `empilées : ${feuilles.empilees.join(', ')}` : 'jamais deux'}`);
if (feuilles.empilees.length) erreurs.push(`des feuilles s'empilent à l'écran : ${feuilles.empilees.join(', ')}`);
console.log(`20j. le gros match plus court : ${duelCourt.n} période(s) au geste pris · la plus longue à ${duelCourt.max.toFixed(2).replace('.', ',')} écran · ${duelCourt.longs} au-dessus de 1,3`);
if (duelCourt.longs) erreurs.push(`${duelCourt.longs} période(s) du duel font plus de 1,3 écran une fois le geste pris (${duelCourt.max.toFixed(2)})`);
if (periodes.some(x => x.startsWith('3')) && !mise.vue) erreurs.push('un duel de saison s\'est rendu à sa 3e période sans offrir la mise doublée');
console.log(`20h. les scènes : ${[...scenes].map(([g, t]) => `${g} : ${t}`).join(' | ') || 'aucun choix mis en scène ouvert'}${mise.scene ? ` | la mise : ${mise.scene}` : ''}`);
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
process.exit(erreurs.length ? 1 : 0);
