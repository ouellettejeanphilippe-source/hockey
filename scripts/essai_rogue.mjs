/*
 * ESSAI DU MODE ROGUE (S77, S79, S80) — à la main : une run du menu jusqu'au
 * bilan : le départ du classeur (une case, un loto de ton cartable, on
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
import { BUTIN_RIVAL, PLANS } from '../js/sim.js';
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
// V9 : À faire porte tous les choix ; le bureau est prêt quand sa barre propose d'avancer ou de régler.
const BUREAU = '#hubModal :is(.hub-jour, .hub-traiter)';
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
const flottant = { vus: 0, petits: [], defiles: 0 };
async function garderLeFlottant(ou) {
  const f = await page.$eval('#hubFlottant', b => { const r = b.getBoundingClientRect(); return { vu: !b.hidden && b.checkVisibility() && r.height > 0, w: r.width, h: r.height }; }).catch(() => null);
  if (!f || !f.vu) return;
  flottant.vus++;
  if (f.h < 44) flottant.petits.push(`${ou} ${Math.round(f.w)}×${Math.round(f.h)}`);
}
const auBureau = async (timeout = 120000) => {
  await page.waitForFunction(() => document.querySelector('#hubModal .hub-jour, #hubModal .hub-traiter'), null, { timeout });
  // Le journal de l'ouverture (oct.), après un rechargement : « Au bureau ».
  if (await page.$('#hubModal .hub-page[data-genre="journal"] .hub-page-fermer')) { await page.click('#hubModal .hub-page[data-genre="journal"] .hub-page-fermer'); await page.waitForTimeout(250); }
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
// La boutique, le sous-onglet du Marché (V16, tranche 6 : « Tes cartes » est parti) : un toucher, sans liste.
const versMarche = async quoi => {
  await page.click('#navbar .navtab[data-section="marche"]').then(() => page.click('#sousNav .soustab[data-page="marche"]', { timeout: 3000 }).catch(() => {}));
  await page.waitForSelector(`#pageMarcheCorps .hub-page[data-genre="${quoi}"]`, { timeout: 10000 });
};
const erreurs = [];
const CLUBS_LISTE = RAYONS_CLUB.find(R => R.cle === 'club').liste;
const NB_CLUBS = Object.keys(CLUBS_LISTE).length, PRIX_HARFANGS = CLUBS_LISTE.harfangs.prix;
page.on('pageerror', e => { erreurs.push(e.message); console.log('PAGEERR', e.stack); });
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
const choix = async (sel = ':is(button.choix-option, .tc-prendre):not([disabled])') => { await page.waitForSelector(`#choixModal:not([hidden]) ${sel}`, { timeout: 60000 }); await page.click(`#choixModal:not([hidden]) ${sel}`); await page.waitForTimeout(300); };
/*
 * UN MÉTA ET UN CARTABLE DE DÉPART (S80) : quatre cartes au cartable, et
 * trois Réguliers que la case Régulier du classeur tirera (24 oct.), assez d'écussons pour un déblocage, et une case de
 * réserve déjà débloquée. Une seule fois : les rechargements de la page
 * (changer de partie recharge) ne les écrasent pas.
 */
const CARTES = ['1985-86_MNS_8445724', '1995-96_PIT_8446951', '2007-08_DET_8468083', '1985-86_MTL_8449796', '1985-86_NJD_8446484', '1985-86_NJD_8452516', '1985-86_NYI_8450314'];
await page.addInitScript(cartes => {
  if (localStorage.getItem('essai80')) return;
  localStorage.setItem('essai80', '1');
  localStorage.setItem('cap82_cartable', JSON.stringify({ v: 1, migre: true, hist: true, joueurs: Object.fromEntries(cartes.map((k, i) => [k, i === 1 ? { v: { commune: 3 }, n: 3 } : { v: i === 0 ? { rare: 1 } : { commune: 1 }, n: 1 }])) }));
  // V16 (tranche 6) : « Le stage du coach » attend dans l'inventaire permanent, pour monter le coach d'un cran (plus bas, 10c).
  // « Une caisse de départ » (+20 jetons) : les Harfangs puis le Pack Argent s'achètent quel que soit le tirage de la saison
  // (sans elle, une caisse de 22 ou 36 jetons laissait l'essai en panne de jetons devant le Pack Argent : une loterie).
  // V9 (tranche 8) : une Coupe déjà gagnée ouvre le premier cran des exigences ; l'essai le voit, et part au cran 0.
  localStorage.setItem('cap82_rogue', JSON.stringify({ ecussons: 400, deblocages: ['banc1', 'caisse1', 'classeur1'], collection: [], cartes: [], runs: 0, coupes: 1, jalons: {}, jeu: 'v21', inventaire: { 'consommable:stage': 1, 'consommable:echangeDoublon': 1 } }));
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
 * TON ENTRAÎNEUR (V21, js/coachs-reels.js) : un loto de trois vraies cartes de coach-saison, de trois philosophies que
 * le prestige ouvre (ce méta est un Club de quartier, donc quatre) ; chacune dit son club et sa saison, et ses trois
 * pouvoirs avec le niveau qui ouvre chacun.
 */
const COACHS_ATTENDUS = PRESTIGES[rangDePrestige({ ecussons: 400, deblocages: ['banc1', 'caisse1', 'classeur1'], jalons: {} })].coachs;
await page.waitForFunction(() => /Ton entraîneur/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
const offerts = await page.$$eval('#choixModal .choix-option', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
await page.screenshot({ path: `${DOSSIER}/rogue-coach.png` });
console.log(`0. ton entraîneur : ${offerts.length} offerts · ${offerts.map(t => t.slice(0, 60)).join(' | ')}`);
if (offerts.length !== Math.min(3, COACHS_ATTENDUS) || !offerts.every(t => /niveau 3/.test(t) && /niveau 5/.test(t) && /\d{4}-\d{2}/.test(t))) erreurs.push(`le loto de l'entraîneur offre ${offerts.length} carte(s) (attendu : 3), ou une carte ne dit pas sa saison et ses trois pouvoirs`);
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
 * LE DÉPART DU CLASSEUR (S80, js/depart.js) : une page Pilier et le joueur de
 * concession, qui prend la case du haut : reste une case Régulier, un loto de
 * trois cartes au plus (24 oct.). On les voit, on touche une carte (sa fiche),
 * on en prend une, on commence.
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
if (tiree.length < 1 || tiree.length > 3 || pris.length !== 1 || !dansAlignement) erreurs.push(`le départ du classeur : ${tiree.length} tirée(s) (une case, un loto de trois au plus), ${pris.length} prise(s), dans l'alignement ${dansAlignement}`);
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
let journal = '';   // le journal de l'ouverture, lu une fois
let directs = 0;   // les gestes faits dans le direct d'un gros match
const soirs = { pages: 0, match: 0 };   // les pages du soir, et celles qui sont le sommaire d'un match
const duelCourt = { n: 0, max: 0, longs: 0 };
// UNE SEULE FEUILLE À LA FOIS (Jalon M, B7) : à chaque capture qui en montre une, au plus une `.choix-sheet` se voit.
const feuilles = { vues: 0, empilees: [] };
const compterFeuilles = async ou => {
  const vues = await page.$$eval('.choix-sheet', ls => ls.filter(e => e.checkVisibility({ visibilityProperty: true })).map(e => (e.closest('[id]') || {}).id || e.className));
  feuilles.vues++; if (vues.length > 1) feuilles.empilees.push(`${ou} : ${vues.join(' + ')}`);
};
const captures = { combat: 0, duel: 0, entracte: 0 };   // le premier combat et le premier duel, photographiés une fois
const afaire = { vu: false, lots: [], histoire: '', genres: new Set(), formes: [], ouverts: 0, pages: 0, maisons: new Set(), sansPage: [], horsBoite: new Set() };   // À faire (V9), vu au premier choix
const butin = { vus: 0, pris: [], fautes: [] };   // V21 : le butin d'une victoire, un adjoint parmi trois, un échange
const combats = [];   // V5 : les combats confirmés, leur soir et la carte de vestiaire gardée
const intentionsVues = new Set();   // V17 : les intentions lues au duel, leurs puces jugées
const veilles = [];   // V17 : un gros match ouvert avant son matin
const periodes = [];  // V9 : les périodes de duel jouées (1re, 2e, 3e) et le plan pris (V17)
const mise = { vue: false, lu: '', scene: '' };   // la mise doublée, touchée une fois, et sa scène
// LES SCÈNES (Jalon M) : les choix d'À faire mis en scène citent leur voix ; on garde la première de chaque genre.
// V10 (tranche 5) : les dossiers de la semaine, la blessure (A4) ; la route (A3) se juge à son bloc.
const SCENES = ['cartes', 'dossier', 'blessure'];
const scenes = new Map();
const barreA = { vus: 0, sous: [], longs: [] };   // « À régler » touché : le choix déplié au-dessus de la barre (B4)
const decisionsDuCombat = async () => ((await lireSauvegarde()).partie || {}).decisions || [];
/* La saison se rejoue avant d'être écrite : on attend que la sauvegarde compte plus de `n` décisions (10 s au plus), plutôt que de la lire trop tôt. */
const attendreDecisions = n => page.waitForFunction(n0 => { const ix = JSON.parse(localStorage.getItem('cap82_parties'));
  return ((JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)).partie || {}).decisions || []).length > n0; }, n, { timeout: 30000 }).catch(() => {});
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
  for (const sec of ['bureau', 'joueurs', 'marche', 'ligue']) {
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
/*
 * CE QUI COURT SE SUIT (oct. 2026, JP : *ça le confirme bon, mais aucun suivi*). L'objectif du proprio se lit chaque
 * matin où il bouge dans Hier soir (« 🏢 … · Martin : 5 / 21 points · 5/20 matchs ») ; son verdict arrive comme un
 * message de la boîte, aux vrais chiffres.
 */
const suivi = { pas: new Set(), verdict: '' };
async function lireLeSuivi() {
  const l = await page.evaluate(() => [...document.querySelectorAll('#hubModal .hub-soir .som-l')].map(e => e.textContent.trim()).filter(t => /^🏢 .+ · \d+\/20 matchs$/.test(t)));
  for (const t of l) suivi.pas.add(t);
  // La ligne de la boîte, puis le message en entier chez le proprio (son récit, ses vrais chiffres) : on garde le plus long.
  const v = await page.evaluate(() => [...document.querySelectorAll('#hubModal .hub-msg')].map(a => a.textContent.replace(/\s+/g, ' ').trim()).filter(x => /Objectif (atteint|raté|levé)/.test(x)).sort((a, b) => b.length - a.length)[0] || '');
  if (v.length > suivi.verdict.length) { suivi.verdict = v; if (/ en \d+ matchs/.test(v)) await page.screenshot({ path: `${DOSSIER}/rogue-verdict-proprio.png` }); }
}
async function regler() {
  for (let i = 0; i < 30; i++) {
    await guetterBords('en jouant');
    await lireLeSuivi();
    // Le gros match se vit en direct (oct.) : au vestiaire à l'entracte, sinon « Passer à la fin », puis « Continuer » ; jamais de ✕.
    if (await page.evaluate(() => { const m = document.getElementById('liveModal'); return !!m && m.style.display === 'flex'; })) {
      if (await page.$('#liveModal .live-close:not([hidden])')) erreurs.push('le direct d\'un gros match garde son ✕');
    directs++;
    const b = await page.$('#liveModal .live-entracte') || await page.$('#liveModal .live-suite') || await page.$('#liveModal .live-fin');
      if (b) await b.click().catch(() => {});
      await page.waitForTimeout(600); continue;
    }
    // Rien ne passe par-dessus le Bureau après « Jour suivant » (oct., JP : *j'hais le modal avec le score de la veille*).
    if (await page.$('.passage')) erreurs.push('le bandeau télé du passage de la journée est revenu');
    // Le journal de l'ouverture (oct.) : une page, une fois par visite ; elle se lit, puis « Au bureau ».
    if (await page.$('#hubModal .hub-page[data-genre="journal"]')) {
      if (!journal) { journal = await page.$eval('#hubModal .hub-page[data-genre="journal"]', el => el.textContent.replace(/\s+/g, ' ').trim()); await page.screenshot({ path: `${DOSSIER}/rogue-journal.png` }); }
      await page.click('#hubModal .hub-page[data-genre="journal"] .hub-page-fermer'); await page.waitForTimeout(250); continue;
    }
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
    if (await page.$('#choixModal:not([hidden]) .duel-prop')) {
      /*
       * L'ÉCRAN DE COMBAT (V5) : l'avant-match n'est plus un arrêt à part. Dans un gros match, l'écran dit l'enjeu
       * (les vrais chiffres de la run) et offre deux cartes de vestiaire ; on garde la première, et les plans de ton adjoint
       * attendent ce choix (V17). Le plan touché émet l'avant-match puis la période, au même soir, dans cet ordre.
       */
      const vest = await page.$$('#choixModal .main-vest:not([disabled])');
      // LE JOUR DU GROS MATCH, PAS LA VEILLE (V17) : l'écran s'ouvre le matin où il se joue.
      const journeeOuverte = ((await lireSauvegarde()).partie || {}).journee;
      const enjeu = ((await page.textContent('#choixModal .main-enjeu').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (enjeu) {
        const B = ((await lireSauvegarde()).partie || {}).rogue?.bareme || (await lireSauvegarde()).rogue?.bareme || null;
        // V8 : un rival choisi paie son butin, un multiple de la prime de la run (`BUTIN_RIVAL`) ; une bête noire, la prime.
        const primes = [1, ...BUTIN_RIVAL].map(x => Math.round(B ? B.grosMatch * x : 0));
        if (B && !primes.some(x => enjeu.includes(`Victoire : +${x} 🪙`))) erreurs.push(`l'enjeu du combat (« ${enjeu} ») ne dit ni la prime de la run (+${B.grosMatch} 🪙) ni le butin d'un rival`);
        if (!/Défaite : 😵 sonnés \d+ matchs/.test(enjeu)) erreurs.push(`l'enjeu du combat ne dit pas la défaite (« ${enjeu} »)`);
        if (vest.length && vest.length !== 2) erreurs.push(`le combat offre ${vest.length} carte(s) de vestiaire au lieu de deux`);
        if (vest.length && !(await page.$('#choixModal .duel-prop:disabled'))) erreurs.push('les plans de l\'adjoint ne demandent pas de garder une carte de vestiaire');
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
      /*
       * SANS MAIN (V13-2, docs/refonte-v13.md) : le duel se joue à ton tableau ; ni cartes de match, ni élan, ni « Mon deck ».
       */
      const resteDeMain = await page.$$eval('#choixModal :is(.main-carte, .main-energie, .main-orbe, .main-deck, .main-reprendre, .deck-grille, .duel-cartes)', e => e.map(x => x.className.split(' ').filter(c => /^(main|deck|duel)-/.test(c))[0] || x.tagName));
      if (resteDeMain.length) erreurs.push(`l'écran du duel montre encore la main : ${[...new Set(resteDeMain)].join(', ')}`);
      if (/(^|[^\p{L}])élan([^\p{L}]|$)|Mon deck/iu.test(((await page.textContent('#choixModal .choix-sheet').catch(() => '')) || ''))) erreurs.push('l\'écran du duel parle encore d\'élan ou de deck');
      /*
       * LE DUEL (V9 ; V17, l'adjoint) : chaque période dit leur intention ; ton adjoint parle (sa voix, sa réplique entre
       * guillemets, le fait) et propose deux ou trois plans en vraies stats de la période, plus « Garder ». On prend
       * tour à tour sa première idée, sa deuxième, puis on garde ; la décision porte sa période et ce plan.
       */
      const duel = await page.$('#choixModal .duel-intention');
      let pris = null;
      if (duel) {
        const fait = ((await page.textContent('#choixModal .duel-fait').catch(() => '')) || '').trim();
        if (!fait) erreurs.push('le duel n\'annonce pas leur intention');
        const lu = await page.$eval('#choixModal', m => ({
          voix: (m.querySelector('.duel-adjoint .scene-de') || {}).textContent || '', mot: ((m.querySelector('.duel-adjoint .scene-mot') || {}).textContent || '').trim(),
          props: [...m.querySelectorAll('.duel-prop')].map(b => ({ cle: b.dataset.prop, puces: b.querySelectorAll('.puce').length, on: b.disabled })),
          tableau: !!m.querySelector('.duel-tableau, .duel-tab-s, .duel-geste, .duel-verdict'),
        }));
        if (!/adjoint/i.test(lu.voix) || !/^«.+»$/.test(lu.mot)) erreurs.push(`l'adjoint ne parle pas au duel (« ${lu.voix} ${lu.mot} »)`);
        const idees = lu.props.filter(x => x.cle !== 'garder');
        if (idees.length < 2 || idees.length > 3 || !lu.props.some(x => x.cle === 'garder')) erreurs.push(`l'adjoint propose ${idees.length} plan(s) (${lu.props.map(x => x.cle).join(', ')}), et « Garder »`);
        if (idees.some(x => !x.puces)) erreurs.push('un plan de l\'adjoint ne dit pas ses vraies stats');
        if (lu.tableau) erreurs.push('le tableau du duel (systèmes, portes, geste) est encore à l\'écran');
        /*
         * LEURS PUCES (V17) : leur intention se lit comme ton plan, en vraies stats de la période, le canal qui la définit
         * d'abord, ce qui est à eux sous « Eux : ». 🦂 : tes punitions ; ⛔ : tes tirs ; 🐗 : leurs tirs ; 🦈 et 🥷 : ton joueur visé.
         */
        const pu = await page.$eval('#choixModal .duel-intention', e => ({ etape: (e.querySelector('.main-etape') || {}).textContent || '', puces: [...e.querySelectorAll('.puce')].map(x => x.textContent.trim()) }));
        const DEF = { '🦂': /^≈ \+.* punitions? pour toi/, '⛔': /^≈ −.* tirs? pour toi/, '🐗': /^Eux : ≈ \+.* tirs?/, '🦈': /: moins de tirs, des coups/, '🥷': /: moins de tirs, moins de chances/ };
        const ico = Object.keys(DEF).find(k => pu.etape.includes(k));
        intentionsVues.add(ico || '?');
        // Un canal à sa borne (`DISCIPLINE_MAX` : un club déjà indiscipliné) ne bouge plus : la puce qui le définit manque alors, et rien d'autre ne passe devant elle.
        const SON_CANAL = { '🦂': /punitions? pour toi/, '⛔': /tirs? pour toi/, '🐗': /^Eux : .*tirs?/, '🦈': /moins de tirs, des coups/, '🥷': /moins de tirs, moins de chances/ };
        const absent = ico && !pu.puces.some(x => SON_CANAL[ico].test(x));
        if (!ico || !pu.puces.length || (!absent && !DEF[ico].test(pu.puces[0]))) erreurs.push(`leur intention (${pu.etape.trim()}) ne dit pas d'abord ce qui la définit : ${pu.puces.join(' | ') || 'aucune puce'}`);
        if (ico && ico !== '🥷' && !pu.puces.some(x => x.startsWith('Eux : '))) erreurs.push(`leur intention ${ico} ne dit pas ce qu'elle leur fait (« Eux : ») : ${pu.puces.join(' | ')}`);
        if (pu.puces.some(x => /%/.test(x))) erreurs.push(`leur intention se dit en % : ${pu.puces.join(' | ')}`);
        pris = periodes.length % 3 === 2 ? 'garder' : (idees[periodes.length % 3] || idees[0] || { cle: 'garder' }).cle;
        /* LE GROS MATCH PLUS COURT (Jalon M, B3) : l'entracte de l'adjoint tient à 1,3 écran au plus, ses plans à l'écran. */
        const h = await page.$eval('#choixModal', m => {
          const els = [m, m.querySelector('.choix-sheet'), m.querySelector('.choix-corps')].filter(Boolean);
          const r = Math.max(...els.map(e => e.scrollHeight / Math.max(1, e.clientHeight)));
          return { r };
        });
        duelCourt.n++; duelCourt.max = Math.max(duelCourt.max, h.r);
        if (h.r > 1.3) duelCourt.longs++;
        if (!captures.duel++) { await page.waitForTimeout(400); await page.screenshot({ path: `${DOSSIER}/rogue-duel.png` }); }
        if (/entracte/i.test(((await page.textContent('#choixModal .choix-titre').catch(() => '')) || '')) && !captures.entracte++) {
          await page.waitForTimeout(300); await page.screenshot({ path: `${DOSSIER}/rogue-duel-entracte.png` });
        }
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
      await page.click(`#choixModal .duel-prop[data-prop="${pris || 'garder'}"]`); await page.waitForTimeout(1500);
      // Un dé à lancer d'abord : la décision s'écrit après lui.
      if (!(await page.$('#choixModal:not([hidden]) .de-scene'))) await attendreDecisions(avantJouer.length);
      if (duel && !(await page.$('#choixModal:not([hidden]) .de-scene'))) {
        const ds = await decisionsDuCombat();
        const dn = ds.slice().reverse().find(d => d.main && d.duel);
        if (!dn) erreurs.push('la période du duel jouée n\'entre pas dans la sauvegarde');
        else {
          periodes.push(`${dn.duel.p + 1}:${pris}`);
          if (dn.duel.p === 0 && journeeOuverte != null && dn.jour !== journeeOuverte) { veilles.push(`J${dn.jour + 1} ouvert à la journée ${journeeOuverte}`); }
          const cle = dn.duel.plan ? dn.duel.plan.cle : 'garder';
          if (cle !== pris) erreurs.push(`le plan « ${pris} » n'entre pas dans la décision de la période (${cle})`);
          if (dn.duel.reponse || dn.duel.tactiques) erreurs.push('la période du duel part encore avec un geste ou un tableau');
          if (dn.main.tirage || (dn.main.jouees || []).length) erreurs.push(`la période du duel part encore avec une main (${JSON.stringify(dn.main)})`);
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
    // Une main de palier (des cartes .tc) : la première carte jouable.
    const carte = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc [data-choix]');
    if (carte) { await carte.click(); await page.waitForTimeout(500); continue; }
    // Un joueur offert (S78) : « Signer », puis « qui sort ? » — en liste (Jalon U), puis « Où joue ? » : une case, puis « Confirmer ».
    if (await page.$('#choixModal:not([hidden]) .tcj-signer')) { await page.click('#choixModal:not([hidden]) .tcj-signer'); await page.waitForTimeout(400); continue; }
    // Jalon R : la liste de signature (un pack rouvert de la boîte, un ballottage) : « Signer », puis « qui sort ? » (U18).
    if (!(await page.$('#choixModal:not([hidden])')) && await page.$('#signatureModal:not([hidden]) .btn-sign:not([disabled])')) { await page.click('#signatureModal .btn-sign:not([disabled])'); await page.waitForTimeout(600); continue; }
    // L'échange (oct., à la Yahoo Fantasy) : la sortie proposée est touchée d'avance ; sinon le premier qui peut sortir, puis « Signer ».
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="echange"]')) {
      if (await page.$('#choixModal .ech-signer[disabled]')) await page.click('#choixModal .ech-q:not([disabled])').catch(() => {});
      await page.click('#choixModal .ech-signer:not([disabled])').catch(() => {}); await page.waitForTimeout(600); continue;
    }
    // Une autre liste de l'alignement (une retouche à poser, une unité spéciale) : la première case permise.
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
     * LE BUTIN D'UNE VICTOIRE (V5 ; V13-2 ; V21) : un adjoint parmi trois, un échange pour la run — ni
     * « Retirer une carte ». On prend le premier ; la décision porte `adjoint` et son palier `r:`. Photographié une fois.
     */
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="recompense"] .choix-option:not([disabled])')) {
      const lu = await page.$eval('#choixModal .choix-sheet[data-genre="recompense"]', m => ({
        titre: ((m.querySelector('.choix-titre') || {}).textContent || '').trim(), recit: ((m.querySelector('.choix-recit') || {}).textContent || '').trim(),
        cles: [...m.querySelectorAll('.choix-options [data-choix]:not([disabled])')].map(b => b.dataset.choix), autre: !!m.querySelector('.choix-autre') }));
      // La récompense d'une série gagnée (un pack de joueurs) a son propre écran : on la laisse au cas général.
      if (/Récompense/.test(lu.titre)) {
        if (!butin.vus++) { await page.waitForTimeout(500); await page.screenshot({ path: `${DOSSIER}/rogue-butin.png` }); }
        if (lu.cles.length !== 3) butin.fautes.push(`${lu.cles.length} adjoint(s) offerts au lieu de trois`);
        if (!/ce qu'il donne, ce qu'il coûte/.test(lu.recit)) butin.fautes.push(`le butin ne dit pas l'échange d'un adjoint (« ${lu.recit} »)`);
        if (lu.autre) butin.fautes.push('le butin offre encore « Retirer une carte »');
        const n0 = (await decisionsDuCombat()).length;
        await page.click(`#choixModal:not([hidden]) [data-choix="${lu.cles[0]}"]`); await page.waitForTimeout(1200);
        await attendreDecisions(n0);
        const sv = await lireSauvegarde();
        const d = (((sv.partie || {}).decisions) || []).slice(n0).find(x => String(x.palier || '').startsWith('r:'));
        const pris = d && d.adjoint ? d.adjoint.cle : null;
        if (!d || pris !== lu.cles[0] || d.recompense !== undefined || d.retrait !== undefined) butin.fautes.push(`le butin n'enregistre pas l'adjoint pris (${JSON.stringify(d || null)})`);
        else butin.pris.push(lu.cles[0]);
        continue;
      }
    }
    if (await page.$('#choixModal:not([hidden]) :is(button.choix-option, .tc-prendre):not([disabled])')) { await choix(); continue; }
    /*
     * À FAIRE (V9, tranche 1 ; JP : *tous les choix au même endroit, même UI et UX*). Chaque choix a la même forme : sa
     * bande (la voix, le sujet), puis ses options `optionHtml`. On règle le choix ouvert comme un joueur pressé : une
     * réponse risquée tant que le dé n'a pas roulé cinq fois, sinon la première option ; une option › ouvre son écran
     * (le combat, le paquet, la main, une liste), que les cas plus haut règlent. Toucher une option l'envoie : une décision
     * par choix (les rivaux, au dernier coché). Photographié une fois ; la route dit l'état du club.
     */
    /*
     * ON RÈGLE DANS LA BOÎTE (V18-5, docs/ecrans-rogue.md) : le choix qui attend s'ouvre sur place, sous sa maison — la
     * voix, le fait, les options —, jamais dans un sous-onglet. On règle le premier ouvert qui attend ; un sous-onglet
     * à l'écran (il ne montre que ce qu'il garde toujours), le Bureau rend la boîte.
     */
    const ouvertA = await page.evaluate(() => { const el = [...document.querySelectorAll('#hubModal .hub-boite .hub-msg.ouvert.bloque')].find(x => x.checkVisibility()); if (el) el.dataset.essai = '1'; return !!el; })
      .then(async vu => { if (!vu) return null; const el = await page.$('#hubModal .hub-msg[data-essai="1"]'); await el.evaluate(x => delete x.dataset.essai); return el; });
    if (ouvertA) {
      const lu = await ouvertA.evaluate(el => ({ genre: el.dataset.msg, maison: el.dataset.maison, sujet: (el.querySelector('.hub-msg-sujet') || {}).textContent || '',
        forme: !!el.querySelector('.hub-msg-corps > .af-options .choix-option.af-option'),
        compris: [...el.querySelectorAll('button')].some(b => /^\s*Compris\s*$/.test(b.textContent)),
        etat: (el.querySelector('.hub-msg-corps > .choix-puces') || {}).textContent || '',
        scene: ((el.querySelector('.hub-msg-corps > .scene .scene-mot') || {}).textContent || '').trim(),
        fait: ((el.querySelector('.hub-msg-corps > .scene .scene-fait') || {}).textContent || '').trim(),
        de: ((el.querySelector('.hub-msg-de') || {}).textContent || '').trim(),
        sous: [...el.querySelectorAll('.af-option .choix-option-sous')].map(x => x.textContent.trim()),
        opts: [...el.querySelectorAll('.af-option:not([disabled])')].map(b => ({ cle: b.dataset.choix, on: b.classList.contains('on'), ouvre: b.classList.contains('ouvre'), pari: /Pari/.test((b.querySelector('.choix-forme') || {}).textContent || '') })) }));
      afaire.genres.add(lu.genre); afaire.ouverts++; afaire.maisons.add(lu.maison);
      if (!lu.forme) afaire.formes.push(`${lu.genre} « ${lu.sujet} »`);
      if (lu.compris) erreurs.push(`« ${lu.sujet} » demande encore « Compris » dans À faire`);
      if (SCENES.includes(lu.genre)) {
        if (!/^«.+»$/.test(lu.scene) || !lu.fait) erreurs.push(`« ${lu.sujet} » (${lu.genre}) ne cite pas sa voix (« ${lu.scene} »)`);
        if (!scenes.has(lu.genre)) scenes.set(lu.genre, `${lu.de} ${lu.scene} — ${lu.fait}`);
      }
      if (!afaire.vu) { afaire.vu = true; await page.screenshot({ path: `${DOSSIER}/rogue-afaire.png` }); }
      // V20 : l'histoire de la semaine (un dossier), la seule source du lundi.
      if (lu.genre === 'dossier' && !afaire.histoire) {
        afaire.histoire = lu.sujet;
        await ouvertA.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${DOSSIER}/rogue-histoire.png` });
      }
      const libres = lu.opts.filter(o => !o.on);
      const pari = libres.find(o => o.pari);
      // La case vide : « tes lignes » ouvre les Lignes, qu'aucun cas plus haut ne règle ; on prend une option sur place.
      const o = pari && des.length < 5 ? pari : (lu.genre === 'trou' && libres.find(x => !x.ouvre)) || libres[0];
      if (!o) throw new Error(`« ${lu.sujet} » attend dans À faire sans option à toucher`);
      if (o === pari) evenementsDe.push(lu.sujet.trim());
      const n0 = o.ouvre || o === pari ? null : (await decisionsDuCombat()).length;
      if (n0 !== null && !afaire.lots.length) await page.screenshot({ path: `${DOSSIER}/rogue-choix-touche.png` });
      await ouvertA.$(`.af-option[data-choix="${o.cle.replace(/"/g, '\\"')}"]`).then(b => b.click());
      await page.waitForTimeout(400);
      // Un rival coché avant le dernier attend les autres ; tout autre choix touché est parti.
      if (n0 !== null && !(await page.$('#hubModal .af-option.on'))) {
        await attendreDecisions(n0);
        const pris = (await decisionsDuCombat()).length - n0;
        afaire.lots.push(`${lu.genre}→${pris}`);
        if (!pris) erreurs.push(`« ${lu.sujet.trim()} » touché n'écrit aucune décision`);
      }
      continue;
    }
    // Un sous-onglet à l'écran : aucun choix n'y vit (V18-5), et le Bureau rend la boîte.
    const onglet = await page.evaluate(() => { const o = [...document.querySelectorAll('#hubModal .af-onglet')].find(x => x.checkVisibility()); return o ? { k: o.dataset.maison, choix: o.querySelectorAll('.hub-msg, .af-option').length } : null; });
    if (onglet) {
      if (onglet.choix) afaire.horsBoite.add(onglet.k);
      afaire.pages++; await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300); continue;
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
        const m = [...document.querySelectorAll('#hubModal .hub-boite .hub-msg.ouvert.bloque')].find(x => x.checkVisibility());
        if (!m || document.querySelector('#choixModal:not([hidden])')) return null;
        // V18-5 : « À régler » ouvre le choix dans la boîte ; sa première option se touche — rien ne la couvre, ni la barre ni les onglets.
        const o = m.querySelector('.af-option');
        if (o) o.scrollIntoView({ block: 'nearest' });
        const r = o ? o.getBoundingClientRect() : null;
        const dessus = r ? document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 1, r.top + r.height / 2)) : null;
        return { sujet: (m.querySelector('.hub-msg-sujet') || {}).textContent || '', opt: r ? r.bottom : null, libre: !o || (dessus && o.contains(dessus)) };
      });
      if (sb) { barreA.vus++; if (!sb.libre) barreA.sous.push(`« ${sb.sujet.slice(0, 30)} » : sa 1re option est couverte (elle finit à ${Math.round(sb.opt)})`); }
      // V18-5 : « À régler » ouvre le choix dans la boîte, ou l'écran d'un choix à une seule porte (le combat, le paquet, la signature).
      const ou = await page.evaluate(() => (document.querySelector('#choixModal:not([hidden]), #signatureModal:not([hidden])') ? 'porte'
        : [...document.querySelectorAll('#hubModal .hub-boite .hub-msg.ouvert')].some(x => x.checkVisibility()) ? 'boîte' : ''));
      if (!ou) afaire.sansPage.push(mot.txt.slice(0, 40));
      continue;
    }
    return;
  }
}
// Lancer la saison
await page.click('#mainBtn');
await unVisible('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option');
await regler();
await tourDesBords('le premier jour');
await regler();
// LE MANDAT DU PROPRIO (S80) : la saison de la run et ce que le proprio veut — au sous-onglet du proprio (V12-2).
/* V12-2 (docs/refonte-v12.md) : un sous-onglet de sa section, son contenu permanent rendu ; puis le Bureau rend la boîte. */
/* Les cartes d'une maison sont toujours visibles (JP, 28 oct. : plus d'accordéon) : une bande qui se balaie, rien à déplier. */
const deplierLesCartes = async () => { await page.waitForTimeout(250); };
/* Les cartes d'une maison (V19 : une rangée qui ouvre une feuille, plus de bande) : leurs clés « src|id|ref » et le geste d'en jouer une. */
const cartesDeLaMaison = async (portee, maison) => {
  const rangee = await page.$(`${portee} .cartes-maison[data-cartes-maison="${maison}"]`);
  if (!rangee) return [];
  await rangee.click(); await page.waitForSelector('#choixModal:not([hidden]) [data-choix]', { timeout: 8000 }).catch(() => {});
  const cles = await page.$$eval('#choixModal [data-choix]', e => e.map(b => b.dataset.choix)).catch(() => []);
  return cles;
};
const fermerLaFeuille = async () => { await page.click('#choixModal .choix-fermer, #choixModal [data-retour], #choixModal .btn-fermer').catch(() => page.keyboard.press('Escape')); await page.waitForTimeout(250); };
const idsDesCartes = cles => cles.map(k => k.split('|')[1]).filter(Boolean);
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
  // TON COACH, UN PERSONNAGE (V21) : au sous-onglet de l'entraîneur (V12-2) — son niveau, son expérience, ses trois pouvoirs,
  // le premier ouvert, les deux autres au niveau qui les ouvre.
  await versLOnglet('bureau', 'entraineur');
  await page.screenshot({ path: `${DOSSIER}/rogue-entraineur.png` });
  const coachs = ((await page.textContent('#hubModal .af-onglet[data-maison="entraineur"] .ej-coach-tete').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const rangCoach = ((await page.textContent('#hubModal .af-onglet[data-maison="entraineur"] .ej-coach .ej-rang').catch(() => '')) || '').trim();
  const pouvoirs = await page.$$eval('#hubModal .af-onglet[data-maison="entraineur"] .pv:not(.adj)', e => e.map(x => ({ nom: (x.querySelector('.pv-tete b') || {}).textContent || '', ferme: x.classList.contains('ferme'), etat: (x.querySelector('.pv-etat') || {}).textContent || '' }))).catch(() => []);
  const jauge = await page.$('#hubModal .af-onglet[data-maison="entraineur"] .ej-jauge');
  await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300);
  const sv0 = await lireSauvegarde();
  const d0 = ((sv0.partie || {}).decisions || []).find(x => x.jour === 0 && x.coach);
  console.log(`5c. ton coach : ${coachs || '(absent)'} · décision du jour 0 : ${d0 ? JSON.stringify(d0.coach) : '(aucune)'}`);
  if (!d0 || !d0.coach.cle || !Array.isArray(d0.coach.talents) || !Array.isArray(d0.coach.adjoints)) erreurs.push('le coach de la run n\'est pas posé au jour 0 avec son expérience, ses talents et son staff');
  if (((sv0.partie || {}).decisions || []).some(x => x.patron)) erreurs.push('une décision de personnel (`patron`) reste dans la partie');
  console.log(`5f. ses pouvoirs : ${pouvoirs.map(x => `${x.nom} (${x.etat})`).join(' | ') || '(aucun)'}`);
  if (!/^Niveau [1-5]$/.test(rangCoach) || !jauge) erreurs.push(`le sous-onglet de l'entraîneur ne dit pas le niveau du coach et son expérience (« ${coachs} », « ${rangCoach} »)`);
  if (pouvoirs.length !== 3 || pouvoirs[0].ferme || !pouvoirs.slice(1).every(x => x.ferme === /Niveau [35]/.test(x.etat))) erreurs.push(`le coach ne montre pas ses trois pouvoirs, le premier ouvert (${JSON.stringify(pouvoirs)})`);
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
// V20 : LES HISTOIRES — une seule source le lundi (les dossiers, `semaineAHistoire`) ; plus de route, de dilemme, de séquence ni de courriel.
{
  const decs = ((await lireSauvegarde()).partie || {}).decisions || [];
  const vieilles = decs.filter(d => d && (/^(n|m|s|vie):/.test(d.palier || '')));
  const histoires = decs.filter(d => d && d.moment && d.moment.famille === 'dossier');
  console.log(`6n. les histoires prises : ${histoires.map(d => `${d.palier} ${d.moment.cle}`).join(' · ') || 'aucune'} · routes, dilemmes, séquences, courriels : ${vieilles.length}`);
  if (vieilles.length) erreurs.push(`une source partie a encore écrit une décision : ${vieilles.map(d => d.palier).join(', ')}`);
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
// Jalon Q : un pack mixte se déchire une fois sur tout son contenu (ses joueurs, et sa carte rare s'il en tire une ; rien à signer).
const revele = await page.$$eval('#choixModal .choix-option.tc', e => ({ joueurs: e.filter(x => x.querySelector('.cj-mini-carte')).length, jeu: e.filter(x => !x.querySelector('.cj-mini-carte')).length, signer: e.filter(x => x.querySelector('.tcj-signer')).length }));
if (!revele.joueurs || revele.signer) erreurs.push(`le pack Époque ne se montre pas en entier avant la signature : ${JSON.stringify(revele)}`);
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
  const qs = await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="echange"] .ech-q', { timeout: 10000 }).catch(() => null);
  if (!qs) erreurs.push(`« Signer » pose le joueur sans demander qui sort (${destSigner})`);
  else {
    // La sortie proposée : une seule, cerclée d'or, touchée d'avance — le comparatif montre les deux joueurs, « Signer » est prêt.
    const tete = await page.evaluate(() => { const m = document.querySelector('#choixModal'); return { n: m.querySelectorAll('.ech-q.meilleure').length, on: !!m.querySelector('.ech-q.meilleure.on'),
      deux: m.querySelectorAll('.cmp-qui:not(.vide)').length, pret: !m.querySelector('.ech-signer').disabled }; });
    if (tete.n !== 1 || !tete.on || tete.deux !== 2 || !tete.pret) erreurs.push(`l'échange après « Signer » : la sortie proposée n'est pas seule, touchée d'avance, comparée et prête (${JSON.stringify(tete)})`);
    await page.screenshot({ path: `${DOSSIER}/rogue-signer-qui-sort.png` }); await compterFeuilles('signer-qui-sort');
    await page.click('#choixModal .choix-fermer');
    await page.waitForTimeout(400);
    if (!(await page.$('#signatureModal:not([hidden]) .pcard'))) erreurs.push('fermer l\'échange referme aussi la liste de signature');
    console.log(`   « Signer » ouvre l'échange : la sortie proposée touchée d'avance, comparée (${destSigner})`);
  }
}
// Le nom du joueur qu'on signe : il doit être dans l'alignement tout de suite (S79). On choisit sa case soi-même (« Changer »).
const nomSigne = await page.$eval('#signatureModal .pcard:not(.locked) .pcard-nom', x => x.textContent.replace(/\s+/g, ' ').trim());
await page.click('#signatureModal .pcard:not(.locked) .sig-changer');
/*
 * L'ÉCHANGE À LA YAHOO FANTASY (oct.). JP : *alignement simple, mais quand tu choisis un joueur, t'as un comparatif en
 * haut entre les deux joueurs*. L'alignement en lignes simples ; toucher un joueur le met en face de l'arrivant, stat par
 * stat, et le bilan dit où l'arrivant jouerait et la masse ; « Signer » décide. La réserve libre est une ligne de plus.
 */
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="echange"] .ech-q', { timeout: 10000 });
await page.waitForTimeout(300);
const titre = (await page.textContent('#choixModal .choix-titre')).trim();
const libre = await page.$$eval('#choixModal .ech-q', e => e.filter(b => /Case libre/.test(b.textContent)).map(b => ({ non: b.disabled, pourquoi: b.title || '' }))[0] || null);
const libreOfferte = !!(libre && !libre.non);
// V9 (tranche 4, le plafond qui mord) : une case libre que le plafond refuse se montre grisée, avec sa raison.
const libreRefus = libre && libre.non ? libre.pourquoi : '';
const rangees = await page.$$eval('#choixModal .ech-q', e => e.length);
if (rangees < 20) erreurs.push(`l'échange ne montre que ${rangees} lignes de l'alignement`);
const refusees = await page.$$eval('#choixModal .ech-q[disabled]', e => e.length);
// Un autre que la sortie proposée : le comparatif se remplit, le bilan dit sa case et la masse.
await page.click('#choixModal .ech-q:not(.meilleure):not([disabled])');
await page.waitForTimeout(300);
const lu = await page.evaluate(() => { const m = document.querySelector('#choixModal'); return { lignes: m.querySelectorAll('.cmp-l').length, deux: m.querySelectorAll('.cmp-qui:not(.vide)').length,
  bilan: ((m.querySelector('.cmp-bilan') || {}).textContent || '').replace(/\s+/g, ' ').trim(), bouton: m.querySelector('.ech-signer').textContent.trim(), sw: m.querySelector('.choix-corps').scrollWidth, cw: m.querySelector('.choix-corps').clientWidth }; });
if (lu.deux !== 2 || lu.lignes < 6) erreurs.push(`le comparatif ne met pas les deux joueurs face à face, stat par stat (${JSON.stringify(lu)})`);
if (!/(trio|paire|partant|auxiliaire|réserve).*masse/i.test(lu.bilan)) erreurs.push(`le comparatif ne dit pas où il jouerait et la masse : « ${lu.bilan} »`);
if (lu.sw > lu.cw + 1) erreurs.push(`l'échange déborde à 390 px (${lu.sw} px pour ${lu.cw})`);
await page.screenshot({ path: `${DOSSIER}/rogue-qui-sort.png` }); await compterFeuilles('qui-sort');
console.log(`   l'échange : ${rangees} lignes, ${refusees} grisée(s) · ${lu.lignes} stats face à face · « ${lu.bilan} » · « ${lu.bouton} »`);
await page.click('#choixModal .ech-signer:not([disabled])');
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
  await page.click('#navbar .navtab[data-section="lignes"]').catch(() => {});
  await page.waitForTimeout(800);
  const noms = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  const nom = nomSigne.split(' ').slice(-1)[0];
  if (!noms.some(n => n.includes(nom))) erreurs.push(`${nomSigne}, signé d'un pack, n'est pas dans l'alignement`);
  else console.log(`   ${nomSigne} est dans l'alignement dès la signature`);
  await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {});
  await page.waitForTimeout(500);
}
// Jalon P2 : des packs mixtes (des joueurs, et parfois une carte rare, V21). V10 : les deux de la première run.
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
 * TES CARTES, AU MARCHÉ (V16) : les places et la carte de trop sont parties. Ce qui a une maison s'y joue (10m) ; le
 * Marché garde le reste, et sa pastille compte ce qui attend d'être joué.
 */
{
  await auBureau();
  await page.screenshot({ path: `${DOSSIER}/rogue-bureau.png` });
  // LE BUREAU À UN ÉCRAN (docs/ecrans-rogue.md, E4) : la route en puces, À faire en enveloppes ; on mesure ce qui défile encore.
  const bu = await page.$eval('#hubModal .hub-sheet', e => ({ h: e.scrollHeight, v: e.clientHeight, blocs: [...e.querySelectorAll('.hub-volet > *, .hub-carte > *, .hub-boite')].map(x => `${x.className.split(' ')[0]} ${Math.round(x.getBoundingClientRect().height)}`).join(' · ') })).catch(() => null);
  if (bu) console.log(`10c. le Bureau : ${(bu.h / Math.max(1, bu.v)).toFixed(2).replace('.', ',')} écran · ${bu.blocs}`);
  // CINQ PORTES EN BAS (oct., JP : *tu peux avoir cinq menus icons*) : Bureau, Joueurs, Lignes, Marché, Ligue ; l'Avant-match est parti.
  const portes = await page.$$eval('#navbar .navtab', e => e.filter(b => b.offsetParent).map(b => b.dataset.section)).catch(() => []);
  console.log(`10b. la barre : ${portes.join(' · ')}`);
  if (portes.join() !== 'bureau,joueurs,lignes,marche,ligue') erreurs.push(`la barre du bas n'a pas ses cinq portes : ${portes.join(' · ')}`);
  // TON PLAN AU BUREAU (oct., JP : *Dépistage, je vais jamais sur cette page* ; *dans bureau ?* ; *j'hais les accordéons*) : une rangée
  // sous la ligne du match, qui ouvre une feuille des six plans, celui en force le dit, 🥷 nomme les deux joueurs ; en toucher un
  // écrit la décision.
  {
    if (await page.$('#hubModal details, #hubModal summary')) erreurs.push('le Bureau garde un accordéon (details / summary)');
    await page.click('#hubModal button.bu-plan').catch(() => {});
    await page.waitForTimeout(800);
    const pl = await page.$$eval('#choixModal .choix-option[data-choix]', bs => bs.map(b => ({ cle: b.dataset.choix, on: !![...b.querySelectorAll('.puce')].find(x => /En force/.test(x.textContent)), sous: ((b.querySelector('.choix-option-sous') || {}).textContent || '').trim(), stats: b.querySelectorAll('.puce:not(.duree)').length }))).catch(() => []);
    await page.screenshot({ path: `${DOSSIER}/rogue-plan.png` });
    const on = pl.filter(x => x.on), ombre = pl.find(x => x.cle === 'ombre');
    const autre = pl.find(x => !x.on && x.cle !== 'match');
    let ecrit = null;
    if (autre) {
      const n0 = (await decisionsDuCombat()).length;
      await page.click(`#choixModal .choix-option[data-choix="${autre.cle}"]`).catch(() => {});
      await page.waitForTimeout(600); await attendreDecisions(n0);
      ecrit = (await decisionsDuCombat()).filter(d => d.plan).pop() || null;
    } else await page.click('#choixModal .choix-fermer').catch(() => {});
    await auBureau();
    const ligne = await page.$eval('#hubModal button.bu-plan', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
    console.log(`10d. ton plan : ${pl.length} tuiles · en force ${on.map(x => x.cle).join(', ') || 'aucune'} · 🥷 « ${ombre ? ombre.sous : ''} » · ${pl.filter(x => x.stats).length} en stats · touché ${autre ? autre.cle : '—'} → ${ecrit ? JSON.stringify(ecrit.plan) : 'rien d\'écrit'} · au Bureau « ${ligne.trim()} »`);
    if (pl.length !== 6) erreurs.push(`le plan du Bureau montre ${pl.length} plans, pas six`);
    if (on.length !== 1) erreurs.push(`le plan du Bureau marque ${on.length} plans en force, pas un`);
    if (ombre && !/ suit /.test(ombre.sous)) erreurs.push('le plan 🥷 ne nomme pas leur vedette et ton joueur qui la suit');
    if (pl.filter(x => x.cle !== 'match' && !x.stats).length) erreurs.push('un plan ne dit pas ses stats de match');
    if (autre && !(ecrit && ecrit.plan.cle === autre.cle)) erreurs.push(`toucher le plan « ${autre.cle} » n'écrit pas sa décision`);
    if (autre && !ligne.includes(PLANS[autre.cle].mot)) erreurs.push(`le Bureau ne dit pas le plan en force (« ${PLANS[autre.cle].mot} »)`);
  }
  // La ligne du match, au Bureau, ouvre tes Lignes.
  const ligneMatch = await page.$('#hubModal .bu-prochain');
  if (ligneMatch && await ligneMatch.isVisible()) {
    await ligneMatch.click(); await page.waitForTimeout(1200);
    const ou = await page.evaluate(() => document.body.dataset.section);
    if (ou !== 'lignes') erreurs.push(`la ligne du match, au Bureau, ouvre « ${ou} », pas les Lignes`);
    await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {});
    await auBureau();
  }
  // LE MARCHÉ (V16, tranche 6) : la boutique et l'album ; « Tes cartes » est parti, chaque carte rare se joue chez ce qu'elle monte.
  await page.click('#navbar .navtab[data-section="marche"]').catch(() => {}); await page.waitForTimeout(400);
  const sousMarche = await page.$$eval('#sousNav:not([hidden]) .soustab', e => e.map(b => b.dataset.page)).catch(() => []);
  console.log(`10a. le Marché : ${sousMarche.join(', ')} · À faire : ${[...afaire.genres].join(', ')}`);
  if (sousMarche.includes('poche')) erreurs.push('« Tes cartes » est encore un sous-onglet du Marché');
  if (await page.$('#teteCartes')) erreurs.push('l\'en-tête garde le raccourci de « Tes cartes »');
  if (afaire.genres.has('places')) erreurs.push('À faire demande encore laquelle vendre (la carte de trop)');
  // L'INFIRMERIE (V8 ; le filtre 🩹 de Joueurs en V18-5) : un blessé du tableau de l'Effectif est aussi dans l'infirmerie.
  await page.click('#navbar .navtab[data-section="joueurs"]'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${DOSSIER}/rogue-effectif.png`, fullPage: true });
  const marques = await page.$$eval('#pageJoueursCorps .jr-bl', e => e.length).catch(() => 0);
  if (await page.$('#sousNav .soustab[data-page="infirmerie"]')) erreurs.push('l\'infirmerie est encore un sous-onglet d\'Effectif');
  await page.click('#pageJoueursCorps .inv-filtre[data-groupe="B"]', { timeout: 3000 }).catch(() => erreurs.push('Effectif › Joueurs n\'a pas de filtre 🩹'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DOSSIER}/rogue-infirmerie.png` });
  // Un réserviste blessé n'a pas de case à remplir et se dit dans la ligne « En réserve » : on compte les blessés du titre.
  const inf = await page.$eval('#pageJoueursCorps .jr-infirmerie', e => ({
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
 * UNE MAISON PAR SUJET (V12-3 ; V16, tranche 6). JP : *that philosophy should be for everything*. La masse salariale est
 * chez le proprio, les soins à l'infirmerie, les pouvoirs et le stage du coach chez l'entraîneur, les cartes de joueur
 * à l'effectif ; il n'y a plus de « Tes cartes » qui y renvoie.
 */
{
  const SEC = { proprio: 'bureau', entraineur: 'bureau' };
  const ici = {};
  let plafond = '';
  for (const k of Object.keys(SEC)) {
    await versLOnglet(SEC[k], k);
    await page.waitForSelector(`#hubModal:not([hidden]) .af-onglet[data-maison="${k}"]`, { timeout: 15000 }).catch(() => erreurs.push(`le sous-onglet « ${k} » ne s'ouvre pas`));
    ici[k] = k === 'entraineur' ? idsDesCartes(await cartesDeLaMaison(`#hubModal .af-onglet[data-maison="${k}"]`, k)) : await page.$$eval(`#hubModal .af-onglet[data-maison="${k}"] .maison-jouer`, e => e.map(b => b.dataset.id)).catch(() => []);
    if (k === 'entraineur') await fermerLaFeuille();
    // Le volet ne garde que le sous-onglet ouvert : la masse salariale se lit chez le proprio, pendant qu'on y est.
    if (k === 'proprio') plafond = await page.textContent('#hubModal .af-onglet[data-maison="proprio"] .inv-plafond', { timeout: 3000 }).catch(() => '');
  }
  if (!plafond) erreurs.push('le proprio ne montre pas la masse salariale');
  // Les cartes de joueur (une retouche, l'échange d'un doublon) vivent sous le tableau d'Effectif › Joueurs.
  {
    await versLOnglet('joueurs', 'joueurs');
    await page.waitForSelector('#pageJoueurs:not([hidden]) .jr-table', { timeout: 15000 }).catch(() => {});
    await page.click('#pageJoueursCorps .inv-filtre[data-groupe="F"]').catch(() => {}); await page.waitForTimeout(200);
    ici.joueurs = idsDesCartes(await cartesDeLaMaison('#pageJoueurs', 'joueurs')); await fermerLaFeuille();
    // Les soins, au filtre 🩹 (V18-5).
    await page.click('#pageJoueursCorps .inv-filtre[data-groupe="B"]').catch(() => {}); await page.waitForTimeout(200);
    ici.infirmerie = idsDesCartes(await cartesDeLaMaison('#pageJoueurs', 'infirmerie')); await fermerLaFeuille();
    await page.click('#pageJoueursCorps .inv-filtre[data-groupe="F"]').catch(() => {}); await page.waitForTimeout(200);
  }
  if (!(ici.entraineur || []).includes('consommable:stage')) erreurs.push('« Le stage du coach » ne se joue pas chez l\'entraîneur');
  if (!(ici.joueurs || []).includes('consommable:echangeDoublon')) erreurs.push('« L\'échange d\'un doublon » ne se joue pas dans l\'effectif');
  // V12-4 : chaque sous-onglet tient en un écran (390 × 844) ; on mesure chacun, la feuille entière.
  const hauteur = () => page.$eval('#hubModal .hub-sheet', e => e.scrollHeight / Math.max(1, e.clientHeight)).catch(() => 0);
  const ecrans = {}, avecChoix = new Set();
  for (const [sec, k] of [['bureau', 'match'], ['bureau', 'proprio'], ['bureau', 'entraineur'], ['bureau', 'vestiaire']]) {
    await versLOnglet(sec, k);
    await page.waitForTimeout(300);
    ecrans[k] = await hauteur();
    // Défilé au bout, le bouton du jour sort de l'écran : son double doit flotter, à sa vraie taille.
    if (ecrans[k] > 1.02) {
      flottant.defiles++;
      await page.$eval('#hubModal .hub-sheet', e => { e.scrollTop = e.scrollHeight; }).catch(() => {}); await page.waitForTimeout(400);
      await garderLeFlottant(`${k}, au bout`);
      await page.$eval('#hubModal .hub-sheet', e => { e.scrollTop = 0; }).catch(() => {});
    }
    if (await page.$(`#hubModal .af-onglet[data-maison="${k}"] .hub-msg`)) avecChoix.add(k);
    // Trop long : ses blocs, du plus haut au plus bas, pour savoir quoi plier.
    if (ecrans[k] > 1.3) console.log(`    ▸ ${k} : ${await page.$eval(`#hubModal .af-onglet[data-maison="${k}"]`, o => [...o.querySelectorAll(':scope > *, :scope > * > *')].filter(e => e.offsetHeight > 30).map(e => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} ${e.offsetHeight}`).join(' · ')).catch(() => '?')}`);
  }
  // V21 : le personnel est parti ; aucune rangée d'adjoint au banc de l'entraîneur, ses pouvoirs seulement.
  {
    await versLOnglet('bureau', 'entraineur');
    const restes = await page.$$('#hubModal .af-onglet[data-maison="entraineur"] :is(.gens-l, .perso-l, [data-choix^="echelon:"])');
    console.log(`10p. le banc de l'entraîneur : ${restes.length ? `${restes.length} rangée(s) de personnel` : 'les pouvoirs du coach seulement'}`);
    if (restes.length) erreurs.push('le sous-onglet de l\'entraîneur montre encore du personnel ou ses échelons');
  }
  console.log(`10h. les sous-onglets, en écrans : ${Object.entries(ecrans).map(([k, v]) => `${k} ${v.toFixed(2).replace('.', ',')}${avecChoix.has(k) ? ' (avec un choix)' : ''}`).join(' · ')}`);
  // V12-4a : un sous-onglet de la boîte, sans choix qui attend, tient sous la borne du duel (20j), 1,3 écran ; le but reste
  // un écran. La boîte et les sous-onglets qui ont des choix se mesurent : leurs choix se plieront (V12-4b).
  // Le dépistage d'Effectif aussi, un soir de gros match compris.
  for (const [k, v] of Object.entries(ecrans)) if (k !== 'match' && !avecChoix.has(k) && v > 1.3) erreurs.push(`le sous-onglet « ${k} » fait ${v.toFixed(2).replace('.', ',')} écran (1,3 au plus)`);
  // `ARRET=10h` : on ne veut que ces hauteurs (une mise en page qu'on retouche) ; le reste de la saison attend.
  if (process.env.ARRET === '10h') {
    // Chaque sous-onglet en entier : l'écran grandit à sa hauteur, le temps d'une capture.
    for (const [sec, k] of [['bureau', 'entraineur'], ['bureau', 'vestiaire']]) {
      await versLOnglet(sec, k);
      await page.setViewportSize({ width: 390, height: Math.ceil(844 * Math.max(1, ecrans[k])) + 40 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DOSSIER}/ecran-${k}.png` });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.click('#navbar .navtab[data-section="lignes"]').catch(() => {});
    await page.waitForTimeout(800);
    for (const t of ['Attaque', 'Défense', 'Filet · réserve']) {
      await page.getByRole('button', { name: t, exact: true }).first().click().catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${DOSSIER}/ecran-lignes-${t}.png`, fullPage: true });
    }
    await browser.close(); process.exit(erreurs.length ? 1 : 0);
  }
  console.log(`10m. une maison par sujet : ${(plafond || '(pas de masse salariale)').replace(/\s+/g, ' ').trim().slice(0, 60)} · ${Object.entries(ici).map(([k, v]) => `${k} ${v.length}`).join(' · ')}`);
}
/*
 * LA LIGUE DU ROGUE (V18-5, docs/ecrans-rogue.md) : Classement · Calendrier · Meneurs · Palmarès. Un club s'ouvre du
 * classement (EHM) et le retour y revient ; le Palmarès est celui du club — sa vitrine, son panthéon, tes runs —, pas
 * l'historique du 82-0.
 */
{
  await page.click('#navbar .navtab[data-section="ligue"]'); await page.waitForTimeout(400);
  const sous = await page.$$eval('#sousNav:not([hidden]) .soustab', e => e.map(b => b.textContent.trim())).catch(() => []);
  if (sous.includes('Équipes') || sous.includes('Ta saison') || !sous.includes('Calendrier') || !sous.includes('Palmarès')) erreurs.push(`la Ligue du Rogue n'est pas Classement · Calendrier · Meneurs · Palmarès : ${sous.join(' · ')}`);
  await versLOnglet('ligue', 'classement');
  const rangee = await page.$('#hubModal .hub-classement tr.a-club:not(.toi)');
  let club = false, revenu = false;
  if (rangee) {
    await rangee.click(); await page.waitForTimeout(400);
    club = !!(await page.$('#hubModal .hub-eq-entete'));
    await page.screenshot({ path: `${DOSSIER}/rogue-club-du-classement.png` });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    revenu = !!(await page.$('#hubModal .hub-classement tr.a-club')) && !(await page.$('#hubModal .hub-eq-entete'));
  }
  if (!rangee || !club) erreurs.push('toucher un club du classement n\'ouvre pas sa feuille');
  else if (!revenu) erreurs.push('le retour, d\'un club ouvert, ne rend pas le classement');
  await versLOnglet('ligue', 'historique');
  const pal = ((await page.textContent('#leaderboardBody').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  if (/Aucune saison enregistrée|Ton album/.test(pal) || !/Tes runs/.test(pal)) erreurs.push(`le Palmarès du Rogue n'est pas celui du club : « ${pal.slice(0, 80)} »`);
  console.log(`10l. la Ligue : ${sous.join(' · ')} · un club ouvert du classement ${club ? 'oui' : 'non'}, le retour ${revenu ? 'y revient' : 'non'} · le Palmarès « ${pal.slice(0, 70)} »`);
  await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300);
}
// V16 : une retouche ne se joue plus au Marché (l'onglet « Tes places » est parti) : elle se pose au verso de son joueur (12b).
let posee = null, nomModif = '';
/*
 * LE STAGE DU COACH (V16, tranche 6 ; V21) : une carte rare qui donne de l'expérience au coach. Elle se joue chez
 * l'entraîneur ; sa décision porte ses points (`xpCoach`). Le proprio qui doute du coach est une histoire (`laTete`).
 */
{
  await versLOnglet('bureau', 'entraineur');
  await deplierLesCartes('#hubModal .af-onglet[data-maison="entraineur"]');
  const clesEntraineur = await cartesDeLaMaison('#hubModal .af-onglet[data-maison="entraineur"]', 'entraineur');
  const jouer = clesEntraineur.includes('meta|consommable:stage|') ? await page.$('#choixModal [data-choix="meta|consommable:stage|"]') : null;
  if (!jouer) erreurs.push('« Le stage du coach » ne se joue pas depuis le sous-onglet de l\'entraîneur');
  else {
    const n0 = (await decisions()).length;
    await jouer.click();
    await page.waitForTimeout(800);
    await regler();
    const ds = (await decisions()).slice(n0).find(x => x.xpCoach && x.joue);
    console.log(`10c. le stage du coach : ${ds ? `+${ds.xpCoach} d'expérience` : '(rien)'}`);
    if (!ds) erreurs.push('« Le stage du coach » n\'écrit pas sa décision d\'expérience');
  }
  const versLEffectif = async () => {
    await versLOnglet('joueurs', 'joueurs');
    await page.waitForSelector('#pageJoueurs:not([hidden]) .jr-table', { timeout: 15000 }).catch(() => {});
  };
  /*
   * L'ÉCHANGE D'UN DOUBLON (Jalon P3) : le doublon le plus fourni du cartable (trois copies de CARTES[1], 1995-96) donne
   * trois joueurs de son époque (1995-96 à 1998-99, `epoqueDe`), pas encore au cartable, et nomme sa série (une par saison : Réfracteur) ; signé, le doublon perd une
   * copie et le nouveau entre au cartable.
   */
  await versLEffectif();
  await deplierLesCartes('#pageJoueurs');
  await page.click('#pageJoueursCorps .inv-filtre[data-groupe="F"]').catch(() => {}); await page.waitForTimeout(200);
  const clesJoueurs = await cartesDeLaMaison('#pageJoueurs', 'joueurs');
  const echange = clesJoueurs.includes('meta|consommable:echangeDoublon|') ? await page.$('#choixModal [data-choix="meta|consommable:echangeDoublon|"]') : null;
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
    if (!/Il part : .+, série Réfracteur/.test(lu.recit)) erreurs.push(`l'échange ne dit pas quel doublon part : « ${lu.recit} »`);
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
}
// UNE CARTE JOUÉE (V16, tranche 6) : chaque carte rare se joue chez ce qu'elle monte — le stage, l'échange, plus haut.
d = await decisions();
console.log(`11. jouées : ${JSON.stringify(d.filter(x => x.joue).map(x => ({ id: x.joue.id, champs: Object.keys(x).filter(k => !['jour', 'joue', 'sel'].includes(k)) })))} · barre : ${await jauge()}`);
if (!d.some(x => x.joue)) erreurs.push('aucune carte rare n\'a pu se jouer dans sa maison');
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
  // Un ensemble se remplit en approchant de l'écran (plus de pli) : le premier se charge seul et dit sa complétion.
  await page.waitForFunction(() => /\d+ \/ \d+/.test((document.querySelector('#pageCartable .ct-set .ct-set-n') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const ext = await page.$eval('#pageCartable .ct-set .ct-set-tete', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  await page.screenshot({ path: `${DOSSIER}/rogue-extensions.png` });
  console.log(`12x. les extensions : ${ext} · missions : ${missions.join(' | ')}`);
  if (missions.length !== 6) erreurs.push(`le cartable montre ${missions.length} missions au lieu de six`);
  if (!/\d+ \/ \d+/.test(ext)) erreurs.push(`une extension ouverte ne dit pas sa complétion (« ${ext} »)`);
  await page.click('#pageCartable [data-vue="equipe"]');
  await page.waitForTimeout(300);
}
/*
 * « + POSER UNE AMÉLIORATION » d'une fiche ouverte du cartable (S80 ; V16, le seul chemin d'une retouche) : tes cartes
 * qui lui vont, en cartes ; celle qu'on touche revient EN ATTENTE au verso, et « Poser ici » la pose.
 */
const editionDe = async () => ((await page.$eval('#hockeyCardModal .carton', e => [...e.classList].find(c => /^tc-/.test(c)) || '').catch(() => '')));
let editionAvant = '';
{
  let fait = false;
  for (const cle of (await page.$$eval('[data-ct-equipe]', e => e.map(x => x.dataset.ctEquipe))).slice(0, 23)) {
    await page.click(`[data-ct-equipe="${cle}"]`);
    await page.waitForSelector('#hockeyCardModal .fc-cases', { state: 'attached', timeout: 10000 });
    if (!(await page.$('#hockeyCardModal .fc-plus'))) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); continue; }
    await page.click('#hockeyCardModal .fc-plaque .cj-retourner');
    await page.waitForTimeout(700);
    // L'ÉDITION SE VOIT (oct., JP : *les upgrades de cartes changent pas le look*) : le carton de la fiche porte sa classe tc-… ; après une retouche d'édition, elle monte, le jour même.
    editionAvant = await editionDe();
    await page.click('#hockeyCardModal .fc-plus');
    await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="poser"] .tc', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DOSSIER}/rogue-choisir-carte.png` });
    const offertes = await page.$$eval('#choixModal .tc .tc-nom', e => e.map(x => x.textContent.trim()));
    await page.click('#choixModal .tc [data-choix]');
    await page.waitForSelector('#hockeyCardModal .fc-poser', { timeout: 10000 });
    const avant = (await decisions()).filter(x => x.joue && x.mutation).length;
    await page.click('#hockeyCardModal .fc-poser');
    await auBureau();
    await page.waitForTimeout(800);
    await regler();
    const apres = (await decisions()).filter(x => x.joue && x.mutation).length;
    if (apres !== avant + 1) erreurs.push(`« + Poser une amélioration » n'a rien posé (${avant} puis ${apres})`);
    console.log(`12b. « + Poser une amélioration » : ${offertes.join(' · ')} offertes, la première posée (${apres} modif(s) posée(s))`);
    posee = (await decisions()).filter(x => x.joue && x.mutation).at(-1) || null;
    nomModif = offertes[0] || '';
    fait = true;
    break;
  }
  if (!fait) console.log('12b. plus de modif à poser (ou personne à qui elles vont)');
  if (!(await page.$(BUREAU))) { await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {}); }
}
/*
 * LE VERSO GARDE LA CARTE POSÉE (S80) : la fiche du joueur, retournée, montre la retouche de 12b dans une case pleine.
 */
if (posee) {
  await page.click('#navbar .navtab[data-section="marche"]');
  await page.click('#sousNav .soustab[data-page="cartable"]');
  await page.waitForSelector('#pageCartable:not([hidden]) .ct-carte', { timeout: 20000 });
}
// Une modif de gardien (un masque) peut tomber sur un bouche-trou de la ligue, qui n'est pas au cartable : l'étape attend.
const poseeAuCartable = posee && await page.$(`[data-ct-equipe="${posee.mutation.joueur}"]`);
if (posee && !poseeAuCartable) console.log(`12a. ${posee.mutation.joueur} est un bouche-trou de la ligue, pas une carte du cartable : l'étape du verso attend`);
if (poseeAuCartable) {
  await page.click(`[data-ct-equipe="${posee.mutation.joueur}"]`);
  await page.waitForSelector('#hockeyCardModal .fc-cases', { state: 'attached', timeout: 10000 });
  // L'ÉDITION SE VOIT (oct., JP : *les upgrades de cartes changent pas le look*) : une retouche d'édition monte la classe tc-… du carton le jour même.
  if (posee.mutation.carte && posee.mutation.carte.rar) {
    const editionApres = await editionDe();
    console.log(`12a'. l'édition de sa carte : ${editionAvant || '?'} → ${editionApres || '?'} (${posee.mutation.cle} → ${posee.mutation.carte.rar})`);
    if (editionApres !== `tc-${posee.mutation.carte.rar}`) erreurs.push(`la retouche ${posee.mutation.cle} monte la carte à ${posee.mutation.carte.rar}, mais la fiche la montre encore ${editionApres || '(sans édition)'}`);
  }
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
if (veilles.length) erreurs.push(`un gros match s'ouvre avant le matin où il se joue : ${veilles.join(' · ')}`);
console.log(`20d. leurs intentions lues, leurs puces jugées : ${[...intentionsVues].join(' ') || 'aucune'}`);
console.log(`20d. périodes de duel jouées (période:plan pris) : ${periodes.length ? periodes.join(' · ') : 'aucune cette run'}`);
console.log(`20e. l'histoire de la semaine : ${afaire.histoire || 'jamais offerte'}`);
console.log(`20s. ce qui court : ${suivi.pas.size} pas de l'objectif dits dans Hier soir (${[...suivi.pas].slice(0, 3).join(' | ') || 'aucun'}) · verdict : ${suivi.verdict.slice(0, 160) || 'aucun'}`);
// L'essai ne visite pas chaque matin (il saute aux gros matchs) : un objectif qui a bougé se dit au moins une fois dans
// les matins visités ; chaque pas, matin par matin, se recompte dans `check_suivis`.
const bouge = Number((suivi.verdict.match(/(\d+) [^\d]*? en \d+ matchs/) || [])[1]);
if (suivi.pas.size < (Number.isFinite(bouge) ? Math.min(1, bouge) : 1)) erreurs.push(`l'objectif du proprio ne se suit pas dans Hier soir (${suivi.pas.size} pas)`);
if (!/Objectif (atteint|raté|levé)[^]* en \d+ matchs/.test(suivi.verdict)) erreurs.push(`le verdict du proprio ne dit pas ses vrais chiffres : « ${suivi.verdict.slice(0, 160)} »`);
console.log(`20d. À faire : ${afaire.ouverts} choix réglés, genres ${[...afaire.genres].join(', ') || 'aucun'} · choix envoyés (genre → décisions) ${afaire.lots.join(' · ') || 'aucun'}`);
if (!afaire.vu) erreurs.push('À faire n\'a jamais porté de choix');
if (afaire.vu && !afaire.lots.length) erreurs.push('aucun choix touché n\'a été envoyé');
if (afaire.formes.length) erreurs.push(`des choix d'À faire n'ont pas la forme commune (options \`optionHtml\`) : ${afaire.formes.slice(0, 4).join(' · ')}`);
if (!afaire.histoire) erreurs.push('aucune histoire (un dossier) n\'a été offerte dans À faire');
// V12 : chaque chose à régler ouvre sa page ; la boîte n'en règle aucune sur place.
console.log(`20m. les maisons réglées dans la boîte : ${[...afaire.maisons].join(' · ') || 'aucune'} · ${afaire.pages} retour(s) à la boîte`);
if (afaire.sansPage.length) erreurs.push(`« À régler » n'ouvre ni le choix ni son écran : ${afaire.sansPage.slice(0, 3).join(' · ')}`);
if (afaire.maisons.size < 3) erreurs.push(`la boîte n'a réglé les choix que de ${afaire.maisons.size} maison(s) : ${[...afaire.maisons].join(', ')}`);
if (afaire.horsBoite.size) erreurs.push(`un sous-onglet porte encore des choix : ${[...afaire.horsBoite].join(', ')}`);
console.log(`20c. le butin d'une victoire (un adjoint parmi trois, sur un pouvoir du coach) : ${butin.vus ? `${butin.vus} offert(s), pris : ${butin.pris.join(', ') || 'aucun'}` : 'aucun butin cette run'}`);
if (butin.fautes.length) erreurs.push(`le butin d'une victoire : ${[...new Set(butin.fautes)].slice(0, 3).join(' · ')}`);
console.log(`20. dés lancés : ${des.length ? des.join(' · ') : 'aucun cette run (aucune réponse risquée choisie)'}`);
// LE DUEL (V9) : un gros match joué se rend à sa troisième période, chacune décidée.
if (combats.length && !periodes.some(x => x.startsWith('3'))) erreurs.push(`aucun duel ne s'est rendu à sa troisième période (${periodes.join(' · ') || 'aucune période'})`);
// LE SOIR D'UN MATCH (JP, 17 oct.) : une page du soir qui suit un gros match est le sommaire du match.
console.log(`20f. les pages du soir : ${soirs.pages}, dont ${soirs.match} sommaire(s) de match`);
console.log(`20r. le gros match en direct : ${directs} geste(s) dans le direct`);
if (combats.length && !directs) erreurs.push('un gros match a été joué sans son direct');
console.log(`20q. le journal de l'ouverture : ${journal || 'pas croisé (aucun rechargement en pleine saison)'}`);
if (combats.length && !soirs.match) erreurs.push(`aucune page du soir n'a été le sommaire d'un match (${soirs.pages} page(s) du soir)`);
console.log(`20g. le bouton flottant : vu ${flottant.vus} fois${flottant.petits.length ? `, écrasé : ${flottant.petits.slice(0, 4).join(' · ')}` : ', 44 px au moins chaque fois'} · la mise doublée touchée : ${mise.lu || 'jamais offerte'}`);
if (flottant.petits.length) erreurs.push(`le bouton flottant est écrasé sous 44 px (${flottant.petits.length} fois : ${flottant.petits.slice(0, 3).join(' · ')})`);
// Depuis le départ de l'Avant-match (oct.), aucun écran ne cache « Jour suivant » à coup sûr : le flottant se juge quand il paraît.
console.log(`20n. rien ne colle au bord (${MARGE} px) : ${bords.vus} écrans mesurés${bords.fautes.size ? `, ${bords.fautes.size} faute(s) : ${[...bords.fautes.values()].slice(0, 12).join(' | ')}` : ', aucun ne colle'}`);
if (bords.fautes.size) erreurs.push(`${bords.fautes.size} élément(s) collent au bord de l'écran : ${[...bords.fautes.values()].slice(0, 4).join(' | ')}`);
console.log(`20i. « Encore un choix » touché : ${barreA.vus} choix dépliés${barreA.sous.length ? `, ${barreA.sous.length} sous la barre` : ', la 1re option au-dessus de la barre chaque fois'}`);
if (barreA.sous.length) erreurs.push(`la barre collée cache le choix qu'elle ouvre : ${barreA.sous.slice(0, 3).join(' · ')}`);
if (barreA.longs.length) erreurs.push(`« Encore un choix » ne tient pas sur une ligne : ${barreA.longs.slice(0, 3).join(' · ')}`);
console.log(`20k. une feuille à la fois : ${feuilles.vues} capture(s) · ${feuilles.empilees.length ? `empilées : ${feuilles.empilees.join(', ')}` : 'jamais deux'}`);
if (feuilles.empilees.length) erreurs.push(`des feuilles s'empilent à l'écran : ${feuilles.empilees.join(', ')}`);
console.log(`20j. le gros match plus court : ${duelCourt.n} entracte(s) de l'adjoint · la plus longue à ${duelCourt.max.toFixed(2).replace('.', ',')} écran · ${duelCourt.longs} au-dessus de 1,3`);
if (duelCourt.longs) erreurs.push(`${duelCourt.longs} entracte(s) du duel font plus de 1,3 écran (${duelCourt.max.toFixed(2)})`);
if (periodes.some(x => x.startsWith('3')) && !mise.vue) erreurs.push('un duel de saison s\'est rendu à sa 3e période sans offrir la mise doublée');
console.log(`20h. les scènes : ${[...scenes].map(([g, t]) => `${g} : ${t}`).join(' | ') || 'aucun choix mis en scène ouvert'}${mise.scene ? ` | la mise : ${mise.scene}` : ''}`);
{
  // V21 : le coach de la saison — ses talents et ses adjoints pris, et les pouvoirs qui ont joué dans les feuilles.
  const sv = await lireSauvegarde().catch(() => null);
  const ds = (((sv && sv.partie) || {}).decisions || []);
  console.log(`20p. le coach : ${ds.filter(d => d.talent).length} talent(s), ${ds.filter(d => d.adjoint).length} adjoint(s) pris, ${ds.filter(d => d.xpCoach).length} gain(s) d'expérience`);
}
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
process.exit(erreurs.length ? 1 : 0);
