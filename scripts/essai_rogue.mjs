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
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
/*
 * v2 : la boutique et tes cartes n'ont plus qu'une porte, la section Marché (la rangée de liens du bureau doublait
 * les étapes, la boîte, la Ligue et le Marché). Le bureau est prêt quand sa barre d'action est là.
 */
// V5 : le lundi, la carte de la semaine (ses cases) couvre le bureau.
const BUREAU = '#hubModal :is(.hub-jour, .hub-traiter, .nd-case, .sem-valider)';
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
/* « Ce soir » (V8) : la section, puis son premier onglet — elle rouvre sinon la page qu'on y lisait (les Lignes). */
const versCeSoir = async () => {
  await page.click('#navbar .navtab[data-section="soir"]').catch(() => {});
  await page.click('#sousNav .soustab[data-page="soir"]', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
};
const auBureau = async (timeout = 120000) => {
  await page.waitForFunction(() => document.querySelector('#hubModal .hub-jour, #hubModal .hub-traiter, #hubModal .nd-case, #hubModal .sem-valider'), null, { timeout });
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
  localStorage.setItem('cap82_rogue', JSON.stringify({ ecussons: 400, deblocages: ['banc1', 'caisse1'], collection: [], cartes: [], runs: 0, jalons: {}, inventaire: { 'consommable:congediement': 1, 'consommable:rappel': 1, 'consommable:echangeDoublon': 1 } }));
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
await choix();
/*
 * TON COACH (v2, js/coachs.js) : les coachs que le prestige ouvre (V2.3 : ce méta est un Club de quartier,
 * donc quatre), un à prendre — sa confiance I est allumée dès le premier soir (une décision du jour 0) —, et
 * les deux patrons imposés de la run, nommés sur le même écran.
 */
const COACHS_ATTENDUS = PRESTIGES[rangDePrestige({ ecussons: 400, deblocages: ['banc1', 'caisse1'], jalons: {} })].coachs;
await page.waitForFunction(() => /Ton coach/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
const offerts = await page.$$eval('#choixModal .choix-option', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
await page.screenshot({ path: `${DOSSIER}/rogue-coach.png` });
console.log(`0. ton coach : ${offerts.length} offerts · ${offerts.map(t => t.slice(0, 40)).join(' | ')}`);
if (offerts.length !== COACHS_ATTENDUS || !offerts.every(t => /Confiance I/.test(t))) erreurs.push(`le choix du coach offre ${offerts.length} coach(s) (le prestige en ouvre ${COACHS_ATTENDUS}), ou ne dit pas sa confiance I`);
if (!/Tes patrons :/.test((await page.textContent('#choixModal .choix-sheet')) || '')) erreurs.push('le choix du coach ne nomme pas les patrons imposés');
await choix();
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
let pocheVendues = 0;   // V4.3 : les cartes de la main vendues en passant
const captures = { main: 0, combat: 0 };   // la première main d'avant-match, photographiée une fois   // les dés lancés pendant la run, et les événements qui les ont demandés
const noeud = { vu: false, choix: [], cases: [], reglees: 0, lots: [], route: '', sous: [] };   // l'écran de la semaine, vu au premier lundi
const butin = { fait: false, retrait: null };   // V5 : le butin « retirer une carte », éprouvé une fois
const combats = [];   // V5 : les combats confirmés, leur soir et la carte de vestiaire gardée
const decisionsDuCombat = async () => ((await lireSauvegarde()).partie || {}).decisions || [];
async function regler() {
  for (let i = 0; i < 30; i++) {
    // Une récompense arrive en paquet scellé (S77) : on le déchire, puis on passe la pile, carte par carte. Elle passe
    // devant le sommaire de la journée, qu'elle couvre : un joueur ouvre d'abord ce qui est sur le dessus.
    const pq = await page.$('#choixModal:not([hidden]) .paquet');
    if (pq && await pq.isVisible()) { await passerLaPile(); continue; }
    /*
     * L'ÉCRAN DE LA SEMAINE (le lundi ; JP : *plus streamlined, sans perdre de complexité*). Chaque choix du lundi est
     * sur la page avec ses options : on coche (une réponse risquée, la première fois, pour lancer le dé), puis « Valider
     * la semaine » les envoie en un lot ; ce qui reste se règle en cases. Photographié une fois : il dit les sept jours,
     * l'état du club (jambes, infirmerie, semaine, caisse) et ce que chaque route lui fait.
     */
    const pageSem = await page.$('#hubModal .hub-page[data-genre="noeud"]');
    if (pageSem && !(await page.$('#choixModal:not([hidden])')) && await pageSem.isVisible()) {
      const SEM = '#hubModal .hub-page[data-genre="noeud"]';
      if (!noeud.vu) {
        noeud.vu = true;
        noeud.choix = await page.$$eval(`${SEM} .sem-choix-titres b`, e => e.map(x => x.textContent.trim()));
        noeud.cases = await page.$$eval(`${SEM} .nd-case`, e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
        await page.screenshot({ path: `${DOSSIER}/rogue-noeud.png` });
        if (!(await page.$(`${SEM} .nd-route .nd-jour`))) erreurs.push('l\'écran de la semaine ne montre pas ses sept jours');
      }
      const blocs = await page.$$eval(`${SEM} .sem-choix`, e => e.map(x => ({ i: x.dataset.i, titre: x.querySelector('.sem-choix-titres b').textContent, coche: !!x.querySelector('.sem-option.on'), pari: [...x.querySelectorAll('.sem-option:not([disabled])')].findIndex(o => /Pari/.test((o.querySelector('.choix-forme') || {}).textContent || '')) })));
      const route = blocs.find(x => /ta route/i.test(x.titre));
      if (route && !noeud.route) {
        noeud.route = await page.$eval(`${SEM} .sem-sheet > .choix-puces`, e => e.textContent).catch(() => '');
        noeud.sous = await page.$$eval(`${SEM} .sem-choix[data-i="${route.i}"] .choix-option-sous`, e => e.map(x => x.textContent.trim()));
        await page.locator(`${SEM} .sem-choix[data-i="${route.i}"]`).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${DOSSIER}/rogue-route.png` });
        if (!/Jambes \d+/.test(noeud.route) || !/en caisse/.test(noeud.route) || !/cette semaine/.test(noeud.route)) erreurs.push(`la semaine ne dit pas l'état du club (« ${noeud.route} »)`);
      }
      const aCocher = blocs.find(x => !x.coche);
      if (aCocher) {
        // Une réponse risquée, tant que le dé n'a pas roulé cinq fois : elle se joue au dé, sur-le-champ.
        const opts = `${SEM} .sem-choix[data-i="${aCocher.i}"] .sem-option:not([disabled])`;
        if (aCocher.pari >= 0 && des.length < 5) { evenementsDe.push(aCocher.titre); await page.locator(opts).nth(aCocher.pari).click(); }
        else await page.locator(opts).first().click();
        await page.waitForTimeout(400);
        continue;
      }
      const valider = await page.$(`${SEM} .sem-valider`);
      const mot = valider ? (await valider.textContent()).trim() : '';
      const caseNoeud = await page.$(`${SEM} .nd-case`);
      if (blocs.length && /Valider/.test(mot)) {
        const n0 = (await decisionsDuCombat()).length;
        await valider.click(); await page.waitForTimeout(1500);
        await page.waitForFunction(() => !document.querySelector('#hubModal .hub-page[data-genre="noeud"] .sem-option.on'), null, { timeout: 60000 }).catch(() => {});
        const pris = (await decisionsDuCombat()).length - n0;
        noeud.lots.push(`${blocs.length}→${pris}`);
        if (pris < blocs.length) erreurs.push(`« Valider la semaine » envoie ${pris} décision(s) pour ${blocs.length} choix`);
      } else if (caseNoeud) { noeud.reglees++; await caseNoeud.click(); await page.waitForTimeout(400); }
      else if (valider) { await valider.click(); await page.waitForTimeout(400); }
      continue;
    }
    // Le sommaire de la journée est une page du Club (1.0, R3) : « Retour au bureau » — une fois réglé ce qui le couvre.
    if (await page.$('#hubModal .hub-page[data-genre="sommaire"]') && !(await page.$('#choixModal:not([hidden])'))) { await page.click('#hubModal .hub-page[data-genre="sommaire"] .hub-page-fermer'); await page.waitForTimeout(250); continue; }
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
        if (vest.length) { await vest[0].click(); await page.waitForTimeout(250); }
        if (premierCombat) await page.screenshot({ path: `${DOSSIER}/rogue-combat-vestiaire.png` });
      }
      // La première main d'avant-match, photographiée : le deck en cartes à 390 px.
      if (!captures.main++) { await page.waitForTimeout(900); await page.screenshot({ path: `${DOSSIER}/rogue-main.png` }); }
      const mains0 = (await decisionsDuCombat()).filter(d => d.main).length;
      await page.click('#choixModal .main-jouer'); await page.waitForTimeout(1500);
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
     * UNE CARTE DE LA MAIN, EN GRAND (V4.3) : « Jouer » ou « Vendre ». Le joueur pressé vend, ce qui amincit la poche.
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
      if (t0 && await page.$$eval('#hubModal .hub-choix-rouvrir', (els, x) => els.some(e => e.textContent.includes(x)), t0).catch(() => false)) erreurs.push(`« ${t0} » réglé au dé attend encore dans la boîte`);
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
    const t = await page.$('#hubModal .hub-traiter');
    // Le message plié : « À régler » le déplie, sous l'affiche du Bureau (V7).
    if (t) {
      const d = await page.$('#hubModal .hub-msg.bloque.ouvert [data-defaut]');
      const cible = d && await d.isVisible() ? d : await t.isVisible() ? t : null;
      // Un message à régler que rien de visible ne règle : le dire, avec ce qu'on voit, plutôt qu'attendre 30 s un clic
      // impossible (une run sur deux, une fois, oct. : « element is not visible » sur « À régler »).
      if (!cible) {
        const vus = await page.evaluate(() => [...document.querySelectorAll('#choixModal:not([hidden]) button, #hubModal button')]
          .filter(b => b.offsetParent).map(b => `${[...b.classList].pop()} « ${b.textContent.trim().slice(0, 30)} »`).slice(0, 12).join(' · '));
        const png = `${DOSSIER}/rogue-coince.png`;
        await page.screenshot({ path: png }).catch(() => {});
        throw new Error(`« À régler » existe mais n'est pas visible, et le message ouvert n'a pas de réponse visible. Boutons visibles : ${vus || 'aucun'} (capture : ${png})`);
      }
      await cible.click(); await page.waitForTimeout(400); continue;
    }
    return;
  }
}
// Lancer la saison
await page.click('#mainBtn');
await unVisible('#hubModal .hub-jour, #hubModal .hub-traiter, #hubModal .nd-case, #hubModal .sem-valider, #choixModal:not([hidden]) .choix-option');
await regler();
// LE MANDAT DU PROPRIO (S80) : le hub dit la saison de la run et ce que le proprio veut — sous le sous-onglet Saison du Club (1.0, R2).
const run = await page.textContent('#hubModal .hub-etat-run').catch(() => '');
console.log(`5. le hub : ${(run || '(pas de ligne de run)').replace(/\s+/g, ' ').trim()}`);
{
  // Ton coach et sa confiance vivent sous « En jeu », plié — dans « Ce soir » depuis la V8.
  await versCeSoir();
  await page.$eval('#hubModal details.ej-plie', d => { d.open = true; }).catch(() => {}); await page.waitForTimeout(300);
  const coachs = ((await page.textContent('#hubModal .ej-coach-tete').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const rangCoach = ((await page.textContent('#hubModal .ej-coach .ej-rang').catch(() => '')) || '').trim();
  await page.click('#navbar .navtab[data-section="bureau"]'); await page.waitForTimeout(300);
  const sv0 = await lireSauvegarde();
  const d0 = ((sv0.partie || {}).decisions || []).find(x => x.jour === 0 && x.coach);
  console.log(`5c. tes coachs : ${coachs || '(absent)'} · décision du jour 0 : ${d0 ? `${d0.coach.nom} ${JSON.stringify(d0.coachsDeBase)}` : '(aucune)'}`);
  if (!d0 || d0.coach.palier !== 1) erreurs.push('le coach de la run n\'allume pas sa confiance I au jour 0');
  const p0 = ((sv0.partie || {}).decisions || []).filter(x => x.jour === 0 && x.patron);
  console.log(`5d. les patrons imposés : ${p0.map(x => `${x.patron.ico} ${x.patron.nom}`).join(' · ') || '(aucun)'}`);
  if (p0.length !== 2) erreurs.push(`la run ne part pas avec deux patrons imposés (${p0.length})`);
  if (rangCoach !== 'I') erreurs.push(`« Ce soir » ne dit pas le coach de la run et sa confiance (« ${coachs} », rang « ${rangCoach} »)`);
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
  // Jalon P2 : la boutique vend sept packs, tous mixtes.
  if (nTout !== 7) erreurs.push(`« Voir les N packs » montre ${nTout} packs, il en faut 7`);
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
await acheter('j:argent', 'rogue-pack-fiche');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
// Jalon Q : un pack mixte se déchire une fois sur tout son contenu (joueurs et cartes de jeu, rien à signer).
const revele = await page.$$eval('#choixModal .choix-option.tc', e => ({ joueurs: e.filter(x => x.querySelector('.cj-mini-carte')).length, jeu: e.filter(x => !x.querySelector('.cj-mini-carte')).length, signer: e.filter(x => x.querySelector('.tcj-signer')).length }));
if (!revele.joueurs || !revele.jeu || revele.signer) erreurs.push(`le pack Argent ne se montre pas en entier avant la signature : ${JSON.stringify(revele)}`);
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
    await page.screenshot({ path: `${DOSSIER}/rogue-signer-qui-sort.png` });
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
const rangees = await page.$$eval('#choixModal .sig-liste .pcard', e => e.length);
if (rangees < 20) erreurs.push(`« qui sort ? » ne montre que ${rangees} joueurs`);
const refusees = await page.$$eval('#choixModal .sig-sort[disabled]', e => e.length);
// Un joueur qui sort (pas la réserve libre) : c'est le chemin qui retire quelqu'un.
// La sortie proposée (U18) signe à sa case calculée ; un autre sortant passe par « Où joue X ? », l'étape éprouvée ici.
const AUTRE = '#choixModal .sig-liste .pcard:not(.meilleure) .sig-sort:not([disabled])';
const barreSortie = await page.$eval(AUTRE, b => b.closest('.pcard').querySelector('.pcard-dest').textContent.replace(/\s+/g, ' ').trim());
if (!/(trio|paire|partant|auxiliaire|réserve).*masse/i.test(barreSortie)) erreurs.push(`une rangée de « qui sort ? » ne dit pas sa ligne et la masse : « ${barreSortie} »`);
await page.screenshot({ path: `${DOSSIER}/rogue-qui-sort.png` });
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
console.log(`9. signé : ${JSON.stringify(signe.map(x => ({ pack: x.achat.pack, entre: x.ballottage.entre, sort: x.ballottage.sort, i: x.ballottage.i, rar: x.ballottage.rar })))} · « ${titre} » · case libre offerte : ${libreOfferte} · ${refusees} case(s) grisée(s) (pas sa position, ou le plafond) · barre : ${await jauge()}`);
if (!signe.length) erreurs.push('le pack de joueurs n\'a rien signé');
else if (!libreOfferte) erreurs.push(`la case de réserve libre n'a pas été offerte (« ${titre} »)`);
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
// Jalon P2 : des packs mixtes (des joueurs ET des cartes) ; leurs cartes vont au deck et dans la poche.
await regler();
for (const pack of ['j:or', 'j:coach']) {
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
 * LA MAIN DE LA SEMAINE (V4.3 ; V8 : dans « Ce soir », où le match se prépare) : après les packs de cartes, quatre
 * cartes de la poche au plus ; on en joue deux par semaine au plus. Chaque carte dit sa place et sa durée.
 */
{
  await auBureau();
  await page.screenshot({ path: `${DOSSIER}/rogue-bureau.png` });
  await versCeSoir();
  await page.screenshot({ path: `${DOSSIER}/rogue-ce-soir.png`, fullPage: true });
  const cases = await page.$$eval('#hubModal .hub-poche .hub-poche-case[data-ref]', e => e.length).catch(() => -1);
  const places = await page.$$eval('#hubModal .hub-poche .hub-poche-case[data-ref] .hub-poche-place', e => e.length).catch(() => 0);
  console.log(`10a. la main de la semaine, dans « Ce soir » : ${cases} carte(s), ${places} disent leur place · ${pocheVendues} vendue(s)`);
  if (cases < 0 || !(await page.$('#hubModal .hub-poche'))) erreurs.push('la main de la semaine ne se voit pas dans « Ce soir »');
  else if (cases > 4) erreurs.push(`la main de la semaine montre ${cases} cartes (quatre au plus)`);
  else if (places < cases) erreurs.push(`${cases - places} carte(s) de la main ne disent pas leur place`);
  /*
   * POSER EN TOUCHANT (V8) : une modif de joueur touchée dans « Ce soir » ouvre tes lignes, ceux qui peuvent la porter
   * allumés ; « Annuler » les referme (l'essai ne la pose pas ici : la poche sert plus loin).
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
  } else console.log('10b. poser en touchant : aucune modif de joueur dans la main cette semaine');
  // L'INFIRMERIE (V8) : un blessé du tableau de l'Effectif est aussi dans l'infirmerie, en tête, avec « Le remplacer ».
  await page.click('#navbar .navtab[data-section="effectif"]'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${DOSSIER}/rogue-effectif.png`, fullPage: true });
  const marques = await page.$$eval('#pageJoueursCorps .jr-bl', e => e.length).catch(() => 0);
  const inf = await page.$$eval('#pageJoueursCorps .jr-infirmerie .jr-remplacer', e => e.length).catch(() => 0);
  console.log(`10c. l'infirmerie : ${inf} blessé(s), ${marques} 🩹 au tableau des avants`);
  if (marques && !inf) erreurs.push('des blessés au tableau de l\'Effectif, mais pas d\'infirmerie');
  await auBureau();
  // UN MOT SE TOUCHE (V8) : la ligne du mandat porte sa définition ; la toucher l'affiche dans une bulle, le toucher suivant la ferme.
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
const plafond = await page.textContent('#pageMarche .hub-page[data-genre="cartes"] .inv-plafond').catch(() => '');
console.log(`10. inventaire : ${poche.join(' · ') || '(vide)'} · ${(plafond || '(pas de panneau)').replace(/\s+/g, ' ').trim()}`);
if (!plafond) erreurs.push('l\'inventaire ne montre pas la masse salariale');
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
   * EN ROGUE, UNE CARTE SE JOUE DE TA MAIN DE LA SEMAINE (V4.3) : les modifs achetées en semaine attendent le lundi,
   * leur bouton le dit. L'erreur, c'est que le pack Modifs n'ait rien laissé dans l'inventaire ; qu'aucune ne soit
   * dans la main cette semaine dépend du tirage (et des prix qui montent, V6), et l'étape du verso attend.
   */
  const modifsVues = await page.$$eval('#pageMarche .hub-page[data-genre="cartes"] .bq-joueur', e => e.length);
  // Jalon P2 : plus de pack Modifs ; une modif sort d'un pack mixte au hasard du tirage, et l'étape du verso attend sans elle.
  if (!modifsVues) console.log('7a. aucune modif de joueur dans l\'inventaire (les packs mixtes n\'en ont pas donné) : l\'étape du verso attend');
  else if (!nModifs) console.log(`7a. ${modifsVues} modif(s) dans l'inventaire, aucune dans la main de la semaine : l'étape du verso attend`);
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
  if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
  const avant = await lireSauvegarde();
  const coachAvant = (avant.rogue && avant.rogue.coach) || (avant.partie && avant.partie.rogue && avant.partie.rogue.coach);
  await page.click('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet[data-onglet="permanent"]');
  await page.waitForTimeout(300);
  const jouer = await page.$('#pageMarche .hub-page[data-genre="cartes"] .inv-jouer-meta[data-id="consommable:congediement"]:not([disabled])');
  if (!jouer) erreurs.push('« Le congédiement » ne se joue pas depuis l\'onglet Permanent');
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
   * dont le joueur sort de ton cartable, au plus Régulier.
   */
  if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
  await page.click('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet[data-onglet="permanent"]').catch(() => {});
  await page.waitForTimeout(300);
  const rappel = await page.$('#pageMarche .hub-page[data-genre="cartes"] .inv-jouer-meta[data-id="consommable:rappel"]:not([disabled])');
  if (!rappel) erreurs.push('« Le rappel du club-école » ne se joue pas depuis l\'onglet Permanent');
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
    await auBureau();
    await regler();
    const d = (await decisions()).slice(n0).find(x => x.ballottage);
    const cartable = await page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs) || {}));
    console.log(`10d. le rappel du club-école : ${offres} cartes offertes · ${d ? `${d.ballottage.entre} entre, ${d.ballottage.sort || 'case libre'} sort` : '(rien signé)'}`);
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
  if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
  await page.click('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet[data-onglet="permanent"]').catch(() => {});
  await page.waitForTimeout(300);
  const echange = await page.$('#pageMarche .hub-page[data-genre="cartes"] .inv-jouer-meta[data-id="consommable:echangeDoublon"]:not([disabled])');
  if (!echange) erreurs.push('« L\'échange d\'un doublon » ne se joue pas depuis l\'onglet Permanent');
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
if (posee) {
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
  if (finie && !ecranRun) erreurs.push('la run est finie et l\'écran « Ta run » ne s\'est pas ouvert');
  if (!finie && ecranRun) erreurs.push('la run continue et l\'écran « Ta run » s\'est ouvert quand même');
  if (ecranRun) {
    await page.screenshot({ path: `${DOSSIER}/rogue-ta-run.png` });
    const txt = (await ecranRun.textContent()).replace(/\s+/g, ' ');
    const d = metaR.derniereRun || {};
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
console.log(`20e. la route de la semaine : ${noeud.route ? `${noeud.route} · ${noeud.sous.join(' | ')}` : 'jamais offerte'}`);
console.log(`20d. l'écran de la semaine : ${noeud.vu ? `lots (choix → décisions) ${noeud.lots.join(' · ') || 'aucun'} · ${noeud.reglees} case(s) réglée(s) · au premier lundi : ${[...noeud.choix, ...noeud.cases].join(' | ')}` : 'jamais ouvert'}`);
if (!noeud.vu) erreurs.push('l\'écran de la semaine ne s\'est jamais ouvert');
if (noeud.vu && !noeud.lots.length) erreurs.push('aucune semaine validée en un lot');
console.log(`20c. butin « retirer une carte » : ${butin.retrait ? `${butin.retrait} retirée` : butin.fait ? 'ouvert, rien d\'enregistré' : 'aucun butin cette run'}`);
console.log(`20. dés lancés : ${des.length ? des.join(' · ') : 'aucun cette run (aucune réponse risquée choisie)'}`);
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
process.exit(erreurs.length ? 1 : 0);
