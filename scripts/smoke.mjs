/**
 * Test de fumée (CLAUDE.md) avec Playwright, à 390 px de large.
 *
 *   python3 -m http.server 8000 &
 *   node scripts/smoke.mjs http://localhost:8000
 *
 * 1. la page démarre, #game visible
 * 2. auto-draft jusqu'à 23/23 dans le vestiaire de chaque tour (tirage
 *    VESTIAIRE : relances quand rien ne tient dans le budget, #freeCapBtn en
 *    dernier recours)
 * 3. #mainBtn actif, clic : la saison se simule d'un coup, droit au bilan
 *    (.result .score et 23 .rrow) ; puis l'écran des séries, un match en
 *    direct, jusqu'au tableau
 * 4. zéro erreur console
 * 5. le même parcours en tirage LOTO (#rrL quand rien ne tient dans le budget)
 * Écrit des captures dans scripts/smoke-*.png.
 */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { ciblesTropPetites } from './lib/cibles.mjs';

// Playwright peut être installé globalement (npm root -g) plutôt que dans le dépôt
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const base = process.argv[2] || 'http://localhost:8000';
/* CHROMIUM : le chemin d'un Chromium déjà installé (un poste où la version
   de Playwright ne correspond pas à celle du navigateur). Vide dans
   l'Action, qui installe le sien. */
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
/*
 * UN TIRAGE QUI SE REJOUE (1.0, oct.). Le parcours tire tout de `Math.random`
 * (le repêchage, la graine de la saison) : un échec vu une fois ne se
 * retrouvait plus. `SMOKE_GRAINE=n` sème le hasard de la page — le même
 * parcours, au clic près, pour chercher ce qui casse.
 */
/*
 * Sans `SMOKE_GRAINE`, une graine tirée au hasard, IMPRIMÉE en tête : un échec en CI se rejoue ensuite
 * chez soi, au clic près (`SMOKE_GRAINE=… node scripts/smoke.mjs`).
 */
const GRAINE_SMOKE = process.env.SMOKE_GRAINE || Math.random().toString(36).slice(2, 8);
{
  await page.addInitScript(g => {
    let x = 2166136261;
    for (const c of String(g)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
    Math.random = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, GRAINE_SMOKE);
  console.log(`   hasard de la page semé : ${GRAINE_SMOKE} (SMOKE_GRAINE=${GRAINE_SMOKE} pour le rejouer)`);
}
const errors = [];
let barreAuRepechage = null;   // la barre au repêchage, pour la comparer au bilan (S67)
let toastVu = false;           // le premier toast d'une signature, mesuré une fois (1.0, J2-17)

const _click = page.click.bind(page);
const _wait = page.waitForSelector.bind(page);
/*
 * LA COQUILLE (V7, docs/refonte-v7.md) : quatre sections — Bureau, Joueurs, Lignes, Ligue —, et des onglets internes
 * pour la Ligue. Le parcours y va comme un joueur : il touche la section, puis l'onglet interne s'il y en a un. Les
 * règles vivent dans le Menu. `clic` est `page.click` (qui revient d'abord à l'onglet du match, plus bas) ou `_click`.
 */
const SECTION_DE = {
  match: 'bureau', saison: 'ligue', alignement: 'lignes', joueurs: 'joueurs', repechage: 'joueurs',
  classement: 'ligue', calendrier: 'ligue', meneurs: 'ligue', equipes: 'ligue', historique: 'ligue',
};
const SECTIONS = ['bureau', 'joueurs', 'lignes', 'ligue'];
async function aller(cle, clic = s => page.click(s)) {
  if (cle === 'regles') {
    await clic('#menuBtn');
    await _wait('#menuDepart [data-menu="regles"]', { timeout: 10000 });
    await clic('#menuDepart [data-menu="regles"]');
    await _wait('#pageRegles:not([hidden])', { timeout: 10000 });
    return;
  }
  await clic(`#navbar .navtab[data-section="${SECTION_DE[cle]}"]`);
  if (await page.$(`#sousNav:not([hidden]) .soustab[data-page="${cle}"]`)) await clic(`#sousNav .soustab[data-page="${cle}"]`);
}
/* Le 82-0, c'est juste les joueurs (oct.) : « Commencer » mène droit à la roulette, sans carte d'identité (elle reste à Sur table). */
async function sansIdentite() {
  await page.waitForTimeout(300);
  if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="identite"]')) errors.push('« Commencer » offre encore une carte d\'identité au 82-0');
}
/*
 * UNE NOUVELLE PARTIE SE LANCE DU MENU (S79 ; 1.0, R1). L'en-tête n'a plus de
 * bouton « Nouvelle » : le Menu, ouvert en pleine partie, est le menu pause —
 * son héros dit « Retour à la partie », « Quitter vers le titre » ramène aux
 * cartons des modes, et le carton d'un mode commence une partie neuve et ouvre
 * l'écran « Nouvelle partie », réglé sur ce mode.
 */
async function nouvelleSaison() {
  await _click('#menuBtn');
  await _wait('#menuDepart .menu-continuer', { timeout: 10000 });
  const heros = ((await page.textContent('#menuDepart .menu-continuer').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  if (!/^Retour à la partie/.test(heros)) errors.push(`le Menu ouvert en pleine partie ne dit pas « Retour à la partie » : « ${heros} »`);
  // La pause n'a plus les cartons des modes (pause distincte du titre) : « Quitter vers le titre » y mène.
  await _click('#menuDepart [data-menu="titre"]');
  await _wait('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]', { timeout: 10000 });
  await _click('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
  await _wait('#partieModal', { state: 'visible', timeout: 30000 });
}
/*
 * LE DIRECT ET LE SOMMAIRE DISENT LES MÊMES BUTS (S79). JP : *le sommaire
 * post match et ce que je voyais dans le match, les buts sont pas au même
 * moment* — le sommaire donnait le temps écoulé, le direct le temps qu'il
 * reste. `finirDirect` lit les buts du fil (période, heure, marqueur) ;
 * `memesButs` les compare, au caractère près, au « Sommaire du match ».
 */
const PERIODES = ['1re période', '2e période', '3e période', 'Prolongation'];
let butsVusEnDirect = null;
const propre = t => (t || '').replace(/\s+/g, ' ').trim();
const butsDuDirect = () => page.$$eval('#liveModal .live-feed .live-ligne', els => {
  let per = 1; const out = [];
  // Le fil s'écrit du plus récent au plus ancien ; une fin de période est une ligne sans heure.
  for (const e of els.slice().reverse()) {
    if (e.classList.contains('periode') && !e.classList.contains('ent2-marque') && !e.classList.contains('cartes') && !e.querySelector('.live-tps')) { per++; continue; }
    if (e.classList.contains('but')) out.push(`${per} ${e.querySelector('.live-tps').textContent.trim()} ${e.querySelector('b:not(.live-but-mot)').textContent.replace(/\s+/g, ' ').trim()}`);
  }
  return out;
});
let glaceDuDirect = 0;
async function lireLeDirect() {
  butsVusEnDirect = { buts: await butsDuDirect() };
  // UN BUT PORTE LES COULEURS DU CLUB QUI MARQUE, partout (JP).
  const ternes = await page.$$eval('#liveModal :is(.live-ligne.but, .live-but-ligne)', l => l.filter(e => !e.classList.contains('but-eq') || !e.style.getPropertyValue('--eq-band') && !e.closest('[style*="--eq-band"]')).length);
  if (ternes) errors.push(`le direct : ${ternes} but(s) sans les couleurs du club qui marque`);
  // v2 : une rangée du fil ne se comprime jamais sous son texte (JP : *problème affichage*, les jeux se chevauchaient) ; tout le
  // fil, les jeux mineurs compris.
  const debordent = await page.$$eval('#liveModal .live-feed', fs => fs.flatMap(f => {
    const tous = f.classList.contains('tous');
    f.classList.add('tous');
    const trop = [...f.querySelectorAll('.live-ligne')].filter(x => x.offsetParent && x.scrollHeight > x.clientHeight + 1)
      .map(x => `${x.className.replace('live-ligne ', '')} « ${x.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)} » ${x.scrollHeight}/${x.clientHeight}`);
    if (!tous) f.classList.remove('tous');
    return trop;
  }));
  if (debordent.length) errors.push(`le direct : ${debordent.length} rangée(s) du fil débordent sur la suivante (${debordent.slice(0, 3).join(' · ')})`);
  // LA GLACE (js/glace.js) : un point par tir au tableau, ni plus ni moins.
  const points = await page.$$eval('#liveModal .live-glace:not([hidden]) .gl-pt', e => e.length);
  const tirs = await page.$eval('#liveModal .live-tirs', e => (e.textContent.match(/\d+/g) || []).map(Number).reduce((x, y) => x + y, 0)).catch(() => -1);
  if (!points) errors.push('le direct : la glace n\'a posé aucun tir');
  else if (tirs >= 0 && points !== tirs) errors.push(`le direct : ${points} points sur la glace pour ${tirs} tirs au tableau`);
  glaceDuDirect = points;
}
/* Le « Sommaire du match » d'une clé `saison|j|k` ou `series|i|k` : ses buts, période, heure et marqueur. */
async function butsDuSommaire(cle) {
  await page.evaluate(c => {
    const el = document.createElement('div');
    el.dataset.sommaire = c;
    document.body.appendChild(el);
    el.click();
    el.remove();
  }, cle);
  // Au bureau, une page du Club (1.0, R3) ; ailleurs (le bilan), la fenêtre.
  await page.waitForFunction(() => document.getElementById('gameModal').style.display !== 'none' || document.querySelector('#hubModal .hub-page[data-genre="sommaire-match"]'), null, { timeout: 5000 }).catch(() => {});
  const enPage = !!(await page.$('#hubModal .hub-page[data-genre="sommaire-match"]'));
  const portee = enPage ? '#hubModal .hub-page[data-genre="sommaire-match"]' : '#gameModalBody';
  const ternes = await page.$$eval(`${portee} .som-but:not(.som-pun)`, l => l.filter(e => !e.classList.contains('but-eq') || !e.style.getPropertyValue('--eq-band')).length);
  if (ternes) errors.push(`le sommaire du match : ${ternes} but(s) sans les couleurs du club qui marque`);
  // LES FAITS SAILLANTS (JP, 23 oct.) : la manchette, puis le récit et la clé du match, en texte.
  const saillants = await page.$$eval(`${portee} .som-saillants p`, l => l.map(e => e.textContent.trim()).filter(Boolean));
  const manchette = await page.$eval(`${portee} .som-saillants .som-manchette`, e => e.textContent.trim()).catch(() => '');
  if (!manchette || saillants.length < 2) errors.push(`le sommaire n'a pas ses faits saillants : ${saillants.join(' · ') || 'rien'}`);
  else if (!decideVu) { decideVu = true; console.log(`   les faits saillants : ${saillants.join(' · ')}`); }
  const buts = await page.$$eval(enPage ? '#hubModal .hub-page[data-genre="sommaire-match"] .som-per' : '#gameModalBody .som-per', (pers, P) => pers.flatMap(x => {
    const per = P.indexOf(x.querySelector('.som-per-head span').textContent.trim()) + 1;
    return [...x.querySelectorAll('.som-but:not(.som-pun)')].map(b => `${per} ${b.querySelector('.som-tps').textContent.trim()} ${b.querySelector('.som-qui strong').textContent.replace(/\s+/g, ' ').trim()}`);
  }), PERIODES);
  if (enPage) await page.evaluate(() => document.querySelector('#hubModal .hub-page[data-genre="sommaire-match"] .hub-page-retour')?.click());
  else await page.evaluate(() => document.getElementById('closeGameBtn').click());
  await page.waitForTimeout(150);
  return buts;
}
/* Le match de ta série vu en direct se relit à son sommaire : les mêmes buts, au caractère près. */
let decideVu = false;
async function memesButs(etiquette) {
  const vu = butsVusEnDirect;
  butsVusEnDirect = null;
  if (!vu) return;
  const lus = [];
  // Le « Sommaire du match » : le dernier match révélé de ta série (le plus haut numéro).
  const cle = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#hubModal [data-sommaire^="series|"]')];
    const el = els.sort((a, b) => Number(a.dataset.sommaire.split('|')[2]) - Number(b.dataset.sommaire.split('|')[2])).pop();
    return el ? el.dataset.sommaire : null;
  });
  if (cle) lus.push(['le sommaire du match', await butsDuSommaire(cle)]);
  else errors.push(`${etiquette} : le match vu en direct n'a pas de sommaire à ouvrir`);
  const direct = JSON.stringify(vu.buts);
  const faux = lus.filter(([, l]) => JSON.stringify(l) !== direct);
  if (faux.length) errors.push(`${etiquette} : ${faux.map(([q, l]) => `${q} (${l.join(' · ')})`).join(' et ')} ne dit pas les mêmes buts que le direct (${vu.buts.join(' · ')})`);
  else console.log(`   ${etiquette} : le direct, ${lus.map(([q]) => q).join(' et ')} disent les mêmes ${vu.buts.length} buts, période, heure et marqueur (${propre(vu.buts.slice(0, 3).join(' · '))}${vu.buts.length > 3 ? ' …' : ''})`);
}
/* FINIR UN DIRECT (S70) : « Passer à la fin » va au bout sans pause de période, et le fil se lit tel quel. */
async function finirDirect() {
  await _click('#liveModal .live-fin');
  await _wait('#liveModal .live-suite', { timeout: 10000 });
  await lireLeDirect();
}
async function versLeMatch() {
  const ou = await page.evaluate(() => ({ zone: document.body.dataset.zone, page: document.body.dataset.page }));
  if (ou.zone === 'hub' && ou.page !== 'match') { await aller('match', _click); await page.waitForTimeout(200); }
}
page.click = async (sel, opts) => {
  // Un bouton des séries se touche à l'onglet du match : on y revient d'abord, comme un joueur.
  if (typeof sel === 'string' && /hub-(jour|regarder|fin|suite|ronde)\b/.test(sel)) await versLeMatch();
  try { return await _click(sel, opts); }
  catch (e) {
    // UN CLIC QUI ÉCHOUE LAISSE UNE TRACE (S74b) : l'écran, ce que dit
    // l'écran de saison, et les erreurs déjà relevées — sans quoi un
    // `TimeoutError` de trente secondes ne dit rien de ce qu'on voyait.
    await page.screenshot({ path: 'scripts/smoke-echec.png' }).catch(() => {});
    const vu = await page.evaluate(() => ({
      tete: document.querySelector('#hubModal .hub-head')?.innerText.replace(/\s+/g, ' ').trim(),
      actions: document.querySelector('#hubModal .hub-actions')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 400),
      choix: document.querySelector('#choixModal:not([hidden]) .choix-titre')?.innerText,
    })).catch(() => ({}));
    console.log(`\n   ÉCHEC du clic « ${sel} » : ${JSON.stringify(vu)}\n   erreurs relevées : ${errors.join(' | ') || 'aucune'}`);
    throw e;
  }
};
let netErrors = 0;   // images externes (assets.nhle.com) : réseau, pas l'application
// Les photos d'action (1.0) : sur le Web, elles viennent de img/actions ; seule l'application Android va à la LNH.
let actionsLNH = 0;
page.on('request', r => { if (r.url().includes('/mugs/actionshots/')) actionsLNH++; });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text())) { netErrors++; return; }
  errors.push(`console: ${m.text()}`);
});

// Hors du serveur local, tout est bloqué (portraits, sonde de l'API) : sans
// accès sortant, ces requêtes pendraient et « networkidle » n'arriverait jamais.
await page.route(u => !u.href.startsWith(base), r => r.abort());

await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
/* LE MENU AU DÉPART (S77) : le premier lancement d'une session ouvre le menu.
   « La saison · Nouvelle partie » bâtit la partie et ouvre l'écran « Nouvelle
   partie » par-dessus, exactement comme la première visite d'avant. */
await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
const modesAuMenu = await page.$$eval('#menuDepart .menu-mode', l => l.map(x => x.dataset.genre).join(','));
// 1.0 (R8) : le Rogue est le héros du menu — premier dans le DOM et le plus haut ; l'exhibition est un lien sous la grille.
if (modesAuMenu !== 'rogue,saison,table') errors.push(`le menu au départ n'offre pas les trois modes, le Rogue en premier : ${modesAuMenu}`);
if (!(await page.$('#menuDepart .menu-lien[data-menu="exhibition"]'))) errors.push('le menu au départ n\'a pas le lien Exhibition');
{
  const hauteurs = await page.$$eval('#menuDepart .menu-mode', l => l.map(x => [x.dataset.genre, x.getBoundingClientRect().height]));
  const rogue = hauteurs.find(h => h[0] === 'rogue');
  if (!rogue || hauteurs.some(h => h[0] !== 'rogue' && h[1] > rogue[1])) errors.push(`le carton Rogue n'est pas le plus haut du menu : ${hauteurs.map(h => `${h[0]} ${Math.round(h[1])}`).join(', ')}`);
  const extra = await page.$('#menuDepart .menu-mode[data-genre="rogue"] .menu-mode-extra');
  if (extra) errors.push('à la première visite, le carton Rogue affiche un résumé de run qui n\'existe pas');
}
await page.click('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
await page.waitForSelector('#game', { state: 'visible', timeout: 30000 });
console.log('1. #game visible');

/* PREMIÈRE VISITE : le localStorage vient d'être vidé, donc l'écran « Nouvelle
   partie » s'ouvre par-dessus. Ce n'est pas un `if` : c'est garanti, donc on
   l'attend durement — le test prouve du même coup que l'écran s'ouvre. Rien
   n'est signé et rien n'a changé, alors « Commencer » se contente de fermer. */
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
/*
 * LA BARRE D'ÉTAT DU TÉLÉPHONE (S70). JP : *assure de laisser espace dans le
 * haut sinon barre de notif sur Android cache le new game et les settings*.
 * La feuille lit `--safe-top`, le plus grand de `env(safe-area-inset-top)`
 * et de `--safe-area-inset-top` (style.css) : on pose le second à la main,
 * et rien de cliquable ne doit commencer au-dessus — ni l'écran « Nouvelle partie », ni
 * les boutons de la barre du haut. Puis on l'enlève : sur ordinateur, rien ne
 * bouge.
 */
{
  const BARRE = 32;
  const mesurer = () => page.evaluate(() => {
    const haut = el => (el ? Math.round(el.getBoundingClientRect().top) : null);
    const boutons = [...document.querySelectorAll('.topbar button, .topbar a')].filter(b => b.offsetParent);
    return { partie: haut(document.querySelector('#partieModal')), boutons: boutons.length ? Math.min(...boutons.map(haut)) : null };
  });
  const avant = await mesurer();
  await page.evaluate(n => document.documentElement.style.setProperty('--safe-area-inset-top', `${n}px`), BARRE);
  await page.waitForTimeout(150);
  const tel = await mesurer();
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-inset-top'));
  await page.waitForTimeout(150);
  const apres = await mesurer();
  if (tel.partie == null || tel.partie < BARRE) errors.push(`sous une barre d'état de ${BARRE} px, l'écran « Nouvelle partie » commence à ${tel.partie} px`);
  if (tel.boutons == null || tel.boutons < BARRE) errors.push(`sous une barre d'état de ${BARRE} px, un bouton de la barre du haut commence à ${tel.boutons} px`);
  if (apres.partie !== avant.partie || apres.boutons !== avant.boutons) errors.push(`sans barre d'état, le haut a bougé : ${JSON.stringify(avant)} puis ${JSON.stringify(apres)}`);
  else console.log(`   la barre d'état du téléphone : sous ${BARRE} px, « Nouvelle partie » à ${tel.partie} px et les boutons du haut à ${tel.boutons} px ; sans elle, rien ne bouge`);
}
/*
 * LA BARRE DE GESTES (S78). JP : *ajouter espace protégé dans le bas sur
 * mobile aussi*. Même épreuve qu'en haut, avec
 * `--safe-area-inset-bottom` ; la barre d'onglets et le bas de l'écran
 * « Nouvelle partie » doivent s'arrêter au-dessus. Sans elle, rien ne bouge.
 */
{
  const GESTES = 28;
  const mesurer = () => page.evaluate(() => {
    const bas = el => (el ? Math.round(innerHeight - el.getBoundingClientRect().bottom) : null);
    return { navbar: bas(document.querySelector('#navbar')), partie: bas(document.querySelector('#partieModal')) };
  });
  const avant = await mesurer();
  await page.evaluate(n => document.documentElement.style.setProperty('--safe-area-inset-bottom', `${n}px`), GESTES);
  await page.waitForTimeout(150);
  const tel = await mesurer();
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-inset-bottom'));
  await page.waitForTimeout(150);
  const apres = await mesurer();
  if (tel.navbar != null && tel.navbar < GESTES) errors.push(`au-dessus d'une barre de gestes de ${GESTES} px, la barre d'onglets finit à ${tel.navbar} px du bas`);
  if (tel.partie == null || tel.partie < GESTES) errors.push(`au-dessus d'une barre de gestes de ${GESTES} px, l'écran « Nouvelle partie » finit à ${tel.partie} px du bas`);
  if (JSON.stringify(apres) !== JSON.stringify(avant)) errors.push(`sans barre de gestes, le bas a bougé : ${JSON.stringify(avant)} puis ${JSON.stringify(apres)}`);
  else console.log(`   la barre de gestes : au-dessus de ${GESTES} px, la barre d'onglets à ${tel.navbar} px du bas et « Nouvelle partie » à ${tel.partie} px ; sans elle, rien ne bouge`);
}
/*
 * « COMMENT ON JOUE, EN CINQ CARTES » (S74) : cinq cartes à lire, par-dessus
 * « Nouvelle partie », et « Compris ! » y ramène sans rien changer.
 */
{
  await _click('#npAide');
  await _wait('#choixModal:not([hidden]) .choix-sheet[data-genre="aide"] .tc', { timeout: 5000 });
  const n = await page.$$eval('#choixModal .tc', e => e.length);
  const lisibles = await page.$$eval('#choixModal .tc.lecture', e => e.length);
  await _click('#choixModal .choix-fermer');
  await page.waitForTimeout(200);
  const encore = await page.isVisible('#partieModal');
  if (n !== 5 || lisibles !== 5 || !encore) errors.push(`« Comment on joue » : ${n} cartes, ${lisibles} à lire, « Nouvelle partie » ${encore ? 'encore ouverte' : 'refermée'}`);
  else console.log('   « Comment on joue » : cinq cartes à lire, et « Nouvelle partie » reste ouverte dessous');
}
/*
 * DEUX LISTES QUI N'EXISTENT QUE QUAND ELLES SERVENT (1.0, J2-2) : la saison
 * et la franchise se montrent au choix qui les demande ; le résumé du pied se
 * lit en entier (deux lignes au plus), et la toute première partie dit
 * « première roulette ».
 */
{
  const lu = () => page.evaluate(() => {
    const vu = id => { const e = document.getElementById(id); return !!(e && e.offsetParent); };
    const r = document.getElementById('npResume');
    return { saison: vu('epoqueSelect'), franchise: vu('franchiseSelect'), coupe: r.scrollHeight > r.clientHeight + 1, note: (document.getElementById('npGoNote') || {}).textContent };
  });
  const avant = await lu();
  await _click('#partieModal .seg[data-opt="ligue"] button[data-val="UNE"]');
  await page.waitForTimeout(120);
  const une = await lu();
  await _click('#partieModal .seg[data-opt="ligue"] button[data-val="TOUTES"]');
  await page.waitForTimeout(120);
  if (avant.saison || avant.franchise) errors.push(`« Nouvelle partie » montre une liste qui ne sert pas : saison ${avant.saison}, franchise ${avant.franchise}`);
  if (!une.saison) errors.push('« Une saison » ne montre pas la liste des saisons');
  if (avant.coupe || une.coupe) errors.push('le résumé de « Nouvelle partie » est coupé');
  if (avant.note !== 'première roulette') errors.push(`la toute première partie ne dit pas « première roulette » : « ${avant.note} »`);
  await sansDebordement('Nouvelle partie');
  console.log(`   « Nouvelle partie » : les listes suivent le choix, le résumé tient, « ${avant.note} »`);
}
await page.click('#npGo');
await sansIdentite();
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 15000 });
console.log('   écran « Nouvelle partie » : ouvert à la première visite, refermé');
/*
 * LE VESTIAIRE DIT UN SEUL NOMBRE (1.0, J2-6) : le badge de l'onglet, le
 * titre du vestiaire et le tableau de bord comptent les mêmes signables ;
 * les onglets vides avant le premier match sont estompés ; le bouton du bas
 * est une jauge ; et la première roulette ne s'annonce pas par un toast.
 */
{
  await page.waitForSelector('#pool .pcard', { timeout: 30000 });
  await page.waitForTimeout(400);
  const lu = await page.evaluate(() => {
    const txt = s => (document.querySelector(s) || {}).textContent || '';
    const badge = txt('.navtab[data-section="joueurs"] .navtab-badge').trim();
    const dash = (txt('#dash').match(/(\d+)\s*signables/) || [])[1];
    const titre = (txt('#poolCount').match(/(\d+)\s*signable/) || [])[1];
    const b = document.getElementById('mainBtn');
    return { badge, dash, titre, morts: [...document.querySelectorAll('#navbar .navtab.mort')].map(x => x.dataset.section).join(','),
      jauge: b.classList.contains('jauge'), mot: b.textContent.trim(), toast: txt('#toast') };
  });
  if (!(lu.badge && lu.badge === lu.dash && lu.dash === lu.titre)) errors.push(`le vestiaire dit plusieurs nombres : onglet ${lu.badge}, tableau ${lu.dash}, titre ${lu.titre}`);
  // 1.0 (R1) : le classement et les meneurs vivent dans la Ligue — c'est elle qui s'estompe.
  if (!/ligue/.test(lu.morts)) errors.push(`les onglets vides du repêchage ne sont pas estompés : ${lu.morts || 'aucun'}`);
  if (!lu.jauge || !/^\d+ \/ \d+ · encore \d+$/.test(lu.mot)) errors.push(`le bouton du bas n'est pas une jauge : « ${lu.mot} »`);
  if (/repart à zéro/.test(lu.toast)) errors.push(`la première roulette s'annonce par un toast : « ${lu.toast} »`);
  console.log(`   le vestiaire : ${lu.badge} signables partout, onglets estompés (${lu.morts}), jauge « ${lu.mot} »`);
}
/*
 * LA FICHE : « SIGNER » SOUS LE POUCE (1.0, J2-5). Sur téléphone, le bouton
 * de la fiche tombait sous le pli ; il colle au bas de la feuille. On ouvre la
 * fiche d'un joueur du vestiaire et on exige le bouton dans l'écran, sans
 * défiler.
 */
{
  const carte = await page.waitForSelector('#pool .pcard', { timeout: 30000 }).catch(() => null);
  if (carte) {
    await carte.click({ position: { x: 30, y: 30 } });
    const btn = await page.waitForSelector('#hockeyCardModal #modalSignBtn', { timeout: 5000 }).catch(() => null);
    if (btn) {
      // La fiche entre en glissant (la fiche-carte plein écran) : on la mesure à l'arrêt, pas en pleine entrée.
      await auRepos();
      const r = await btn.boundingBox();
      if (!r || r.y + r.height > 844 + 1) errors.push(`la fiche d'un joueur laisse « Signer » sous le pli (${r ? Math.round(r.y + r.height) : '?'} px sur 844)`);
    } else errors.push('la fiche d\'un joueur du vestiaire ne s\'ouvre pas, ou n\'a pas de bouton « Signer »');
    await page.click('#closeHockeyCardBtn').catch(() => {});
    await page.waitForTimeout(250);
  }
}

/*
 * UNE RÈGLE FERME QUE RIEN NE VÉRIFIAIT (la seconde, « aucune cote dans le DOM », est partie le 27 octobre 2026).
 *
 * `sansDebordement` — « rien ne doit déborder horizontalement de
 * `document.documentElement` ; seuls les conteneurs prévus défilent en x ».
 * Le mode bonus l'avait déjà, le jeu principal non : on pouvait donc casser
 * la mise en page à 390 px et sortir du vert.
 */
/*
 * AU REPOS (1.0). La case du dernier joueur signé se pose en s'agrandissant
 * (`cj-arrive`, scale 1,04 à mi-course) et l'animation ne part que quand le
 * volet s'affiche : mesurée 400 ms après l'ouverture de l'onglet, en plein
 * saut, sa boîte dépassait de 2 ou 3 px ce que `clientWidth` révèle — la CI
 * lisait « très bon » coupé, à un joueur différent chaque fois. On attend la
 * fin des animations qui finissent (jamais celles qui bouclent) avant de
 * mesurer : le jeu se juge à l'arrêt.
 */
async function auRepos() {
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(a => { try { return a.effect.getTiming().iterations !== Infinity; } catch { return false; } })
    .map(a => a.finished.catch(() => {}))));
}
async function sansDebordement(ou) {
  await auRepos();
  const trop = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  if (trop > 0) errors.push(`débordement horizontal de ${trop} px — ${ou}`);
  return trop;
}
/*
 * ON DOIT POUVOIR ATTEINDRE CE QU'ON TOUCHE — et c'était l'angle mort du
 * test de fumée.
 *
 * JP : *l'interface glisse pas pour derrière le banc sur mon cell*. Trois
 * défauts de défilement vivaient dans le dépôt, tous invisibles ici : le
 * volet du banc repassé en `display: block` (donc `.roster` n'était plus un
 * item flex, il grandissait à 1497 px et `.game` le coupait), la bande du
 * bassin en `align-items: start` (donc les colonnes prenaient la hauteur de
 * leur contenu au lieu d'être bornées, et leur `overflow-y` ne servait à
 * rien), et les rangées de l'alignement qui s'écrasaient de 153 px à 48 en
 * se chevauchant.
 *
 * POURQUOI RIEN NE LES A VUS. `sansDebordement` ne regarde que la largeur ;
 * `pasUneLonguePage` ne regarde que le document, qui est borné par
 * construction ; et l'auto-draft signe par `b.click()` en JavaScript, ce qui
 * ne demande ni visibilité ni défilement. Trois garde-fous verts au-dessus
 * d'une interface où l'on ne pouvait pas atteindre la moitié des joueurs.
 *
 * CE QUE CELUI-CI MESURE, en deux questions posées à chaque élément de
 * texte :
 *   — est-il SOUS LE PLI sans qu'aucun ancêtre puisse défiler jusqu'à lui ?
 *   — est-il COUPÉ au-delà de ce que le défilement d'un ancêtre révélerait
 *     (son bas dépasse le `scrollHeight` de la boîte qui le rogne) ?
 * La seconde attrape ce que la première ne peut pas voir : du contenu
 * ÉCRASÉ n'est pas sous le pli, il est à l'intérieur d'une boîte qui a plié
 * pour tenir, et c'est exactement ce que faisaient les rangées de
 * l'alignement.
 */
async function toutEstAtteignable(ou) {
  await auRepos();
  const mauvais = await page.evaluate(() => {
    const st = el => getComputedStyle(el);
    const rogne = el => { const s = st(el); return ['hidden','auto','scroll'].includes(s.overflowY) || ['hidden','auto','scroll'].includes(s.overflowX); };
    const defile = el => { const o = st(el).overflowY; return (o === 'auto' || o === 'scroll') && el.scrollHeight - el.clientHeight > 1; };
    const vu = el => { const s = st(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nom = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
      + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!vu(el) || el.children.length || !(el.textContent || '').trim()) continue;
      // LE TEXTE D'UN SVG (un écusson) est dessiné dans sa boîte de vue : il
      // ne défile jamais, et sa boîte englobante peut mentir pendant une
      // transition — « NHL STARS » a été signalé 87 px sous son propre logo.
      if (el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= innerHeight - 1 || r.bottom <= 1) {
        let p = el.parentElement, ok = false;
        while (p && !ok) { if (defile(p)) ok = true; p = p.parentElement; }
        if (!ok && defile(document.scrollingElement)) ok = true;
        if (!ok) { out.push(`« ${(el.textContent || '').trim().slice(0, 36)} » (${nom(el)}) est sous le pli et rien ne défile jusqu'à lui`); continue; }
      }
      let c = el.parentElement;
      while (c && !rogne(c)) c = c.parentElement;
      if (!c) continue;
      const rc = c.getBoundingClientRect();
      const bas = r.bottom - rc.top + c.scrollTop;
      if (bas > c.scrollHeight + 2) out.push(`« ${(el.textContent || '').trim().slice(0, 36)} » (${nom(el)}) dépasse de ${Math.round(bas - c.scrollHeight)} px ce que ${nom(c)} peut révéler`);
      /*
       * COUPÉ À DROITE (1.0, J2-4). Une puce en `nowrap` sortait de sa carte
       * (« un réserviste ou un rappel j… ») et rien ne le voyait : la question
       * du bas ne regarde que la hauteur. Le premier ancêtre qui rogne en X
       * révèle sa largeur de défilement s'il défile en X, sa largeur visible
       * sinon — un `overflow: hidden` compte le contenu coupé dans son
       * `scrollWidth`, donc c'est `clientWidth` qui dit ce qu'on voit.
       */
      let cx = el.parentElement;
      while (cx && !['hidden', 'auto', 'scroll', 'clip'].includes(st(cx).overflowX)) cx = cx.parentElement;
      // Un ancêtre en `text-overflow: ellipsis` coupe EXPRÈS, et le dit par « … » (un nom long dans une bande étroite).
      if (cx && st(cx).textOverflow !== 'ellipsis') {
        const defileX = ['auto', 'scroll'].includes(st(cx).overflowX);
        const rx = cx.getBoundingClientRect();
        const droite = r.right - (rx.left + cx.clientLeft) + (defileX ? cx.scrollLeft : 0);
        const limite = defileX ? cx.scrollWidth : cx.clientWidth;
        if (droite > limite + 2) out.push(`« ${(el.textContent || '').trim().slice(0, 36)} » (${nom(el)}) est coupé à droite de ${Math.round(droite - limite)} px dans ${nom(cx)}`);
      }
    }
    return [...new Set(out)];
  });
  if (mauvais.length) errors.push(`hors de portée — ${ou} : ${mauvais.slice(0, 3).join(' | ')}${mauvais.length > 3 ? ` (+${mauvais.length - 3})` : ''}`);
  return mauvais.length;
}

/*
 * LES CIBLES DE 44 PX (Jalon M, B5 — docs/mise-en-scene-et-mobile.md). L'audit à 390 px en a mesuré à 16, 28, 32,
 * 36 et 40 : la croix d'une case, le nom d'un joueur, « Déjà en jeu », les boutons du bureau, ✕. Tout ce qu'un
 * doigt atteint à l'écran (un bouton, un résumé, un `[role=button]`, que rien ne couvre) offre 44 × 44, ou une zone
 * agrandie autour de son dessin ; scripts/lib/cibles.mjs nomme les exceptions et leur raison.
 */
async function cibles44(ou) {
  const f = await ciblesTropPetites(page);
  if (f.length) errors.push(`cible sous 44 px — ${ou} : ${f.slice(0, 3).join(' | ')}${f.length > 3 ? ` (+${f.length - 3})` : ''}`);
  return f.length;
}

/*
 * JAMAIS UNE LONGUE PAGE. JP : *jamais longue pages, fait onglets si
 * nécessaire* ; *vraiment assurer interface clean, facile à naviguer, peu
 * importe petit écran ou 4k pc*.
 *
 * Mesuré à 390 px AVANT : le bilan faisait 4,2 écrans, ses statistiques 5,0,
 * son alignement 4,9. La cause n'était pas le bilan mais le REPÊCHAGE resté
 * au-dessus — le bilan est un frère de la roulette dans `#game`, et rien ne
 * la cachait : on finissait sa saison et on remontait la roulette et le
 * vestiaire pour revenir à rien. Après : 1,7 / 2,4 / 2,3.
 *
 * La borne est à TROIS écrans, et elle suit la mesure plutôt que le goût :
 * le pire volet en fait 2,4, et le défaut qu'on veut attraper — le repêchage
 * qui revient — en rajoute 2,8 d'un coup. À trois, elle ne crie pas pour du
 * bruit et elle ne peut pas rater ça.
 */
/*
 * ON REDIMENSIONNE SANS RIEN PERDRE (S67). JP : *faire que l'interface soit
 * toujours, peu importe le moment, même organisation et adaptable et
 * redimensionnable sans rien perdre*. À chaque taille — un petit téléphone,
 * une tablette, un portable, un écran de bureau, du 4K — la barre porte les
 * MÊMES entrées dans le même ordre, rien ne déborde en largeur, rien n'est
 * hors de portée, et la barre se touche. On revient à 390 × 844 à la fin :
 * c'est la taille du reste du parcours.
 */
const TAILLES = [[360, 640], [768, 1024], [1280, 800], [1920, 1080], [3840, 2160]];
async function redimensionner(ou) {
  const lireBarre = () => page.$$eval('#navbar .navtab', e => e.map(x => x.dataset.section).join(' · '));
  const ref = await lireBarre();
  const vus = [];
  for (const [w, h] of TAILLES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const ici = await lireBarre();
    if (ici !== ref) errors.push(`${ou} à ${w}×${h} : la barre change (« ${ref} » puis « ${ici} »)`);
    const touche = await page.evaluate(() => {
      const b = document.querySelector('#navbar .navtab.on') || document.querySelector('#navbar .navtab');
      if (!b) return false;
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return !!el && b.contains(el);
    });
    if (!touche) errors.push(`${ou} à ${w}×${h} : l'onglet ouvert de la barre ne se touche pas`);
    await sansDebordement(`${ou} à ${w}×${h}`);
    await toutEstAtteignable(`${ou} à ${w}×${h}`);
    if (w === 1280) await page.screenshot({ path: `scripts/smoke-coquille-${ou.replace(/[^a-z]+/gi, '-').toLowerCase()}.png`, fullPage: false });
    vus.push(`${w}×${h}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `scripts/smoke-coquille-${ou.replace(/[^a-z]+/gi, '-').toLowerCase()}-390.png`, fullPage: false });
  console.log(`   redimensionné sans rien perdre — ${ou} : ${vus.join(' · ')}, la barre reste « ${ref} »`);
}

async function pasUneLonguePage(ou, max = 3) {
  const n = await page.evaluate(() => {
    const el = document.documentElement;
    return +(el.scrollHeight / el.clientHeight).toFixed(2);
  });
  if (n > max) errors.push(`longue page : ${ou} fait ${n} écrans (au plus ${max})`);
  return n;
}
/*
 * LA BARRE D'ONGLETS FLOTTE (S59), et le garde-fou suit la règle neuve.
 *
 * Elle était collée au bas, pleine largeur, avec un filet dessus ; elle est
 * maintenant posée EN RETRAIT de `FLOTTE` pixels et arrondie — c'est le
 * geste qui, à lui seul, fait qu'une interface a l'air d'un jeu. Le contrôle
 * ne peut donc plus exiger « collée au bas », mais il ne doit RIEN perdre de
 * ce qu'il protégeait : le défaut de S55 était une barre POUSSÉE SOUS
 * l'écran par un volet trop haut (−38 px mesurés), donc incliquable.
 *
 * Ce qui est exigé : la barre est ENTIÈREMENT dans l'écran (jamais un écart
 * négatif) et elle est à sa place (jamais plus loin du bas que le retrait
 * voulu). Le `atteignable` de S55 reste, et c'est lui qui attrape le cas où
 * quelque chose passe par-dessus.
 */
const FLOTTE = 0;        // le retrait du bas, en pixels : 1.0 (R1), la barre est posée au bas (voir `.navbar`, style.css)
const FLOTTE_MAX = FLOTTE + 4;
const malPlacee = fond => fond < -1 || fond > FLOTTE_MAX;

const MIN_SAL = 0.95;    // plancher réservé par case restante, en millions (marge sur les 0,775 M$ du barème)
/*
 * LIRE UN NOMBRE DE L'ÉCRAN (1.0, gel des chaînes) : « 95,5 M$ », « 0,78 M$ »,
 * « −1,2 M$ », « ,912 », « 46 PTS ». La virgule est décimale, le moins est
 * typographique, l'espace avant M$ est insécable. L'ancien lecteur gardait les
 * chiffres et les POINTS : « 95,5 M$ » y serait devenu 955, « ,912 » 912.
 */
const lireNombre = t => {
  const m = String(t || '').replace(/\u00a0/g, ' ').match(/[−-]?\d*[.,]?\d+/);
  return m ? parseFloat(m[0].replace('−', '-').replace(',', '.')) || 0 : 0;
};
const parseM = lireNombre;
const lireSignes = async () => parseInt((await page.textContent('#cnt')).trim(), 10) || 0;
// Le total vient du COMPTEUR, pas d'une constante : l'Express en a six, le
// Complet vingt-trois, et `casesDuMode` est la seule source de vérité.
const lireTotal = async () => parseInt(((await page.textContent('#cnt')).split('/')[1] || '23').trim(), 10) || 23;

/** L'auto-draft : la main de chaque tour, jusqu'à 23/23. */
async function drafter(etiquette) {
  const total = await lireTotal();
  let signed = 0, guard = 0;
  while (signed < total && guard++ < 320) {
    const rem = parseM(await page.textContent('#capAmt'));
    const left = total - signed;
    // Budget maximal pour ce choix : au-delà, impossible de combler les cases
    // suivantes au salaire plancher. C'est la règle affichée au tableau de bord.
    const maxPick = rem - Math.max(0, left - 1) * MIN_SAL;

    const cards = await page.$$('.pcard');
    const infos = await page.$$eval('.pcard', els => els.map(el => ({
      price: (((t) => { const m = t.replace(/\u00a0/g, ' ').match(/[−-]?\d*[.,]?\d+/); return m ? parseFloat(m[0].replace('−', '-').replace(',', '.')) || 0 : 0; })(el.querySelector('.pcard-price')?.textContent || '')),
      // Un bouton « Signer · bloque la fin » (1.0, J1-Q) demande deux touchers : l'auto-draft ne le prend jamais d'un seul.
      ok: !!el.querySelector('.btn-sign:not([disabled]):not(.risque)'),
      // La carte DIT en rouge ce que la signature va coûter : « ▼ sous sa
      // zone », « −N hors position », « ⚠ bloque la fin ». Un joueur ne signe
      // pas cette carte-là s'il en a une propre ; l'auto-draft non plus.
      propre: !el.querySelector('.pcard-dest .dest-bad, .pcard-dest .dest-warn'),
      // Le chiffre clé de la carte : des points pour un patineur, des victoires
      // pour un gardien. Ce n'est PAS une cote — celles-là ne sont pas dans le
      // DOM, et c'est une règle du dépôt — mais c'est ce que le joueur lit.
      cle: (((t) => { const m = t.replace(/\u00a0/g, ' ').match(/[−-]?\d*[.,]?\d+/); return m ? parseFloat(m[0].replace('−', '-').replace(',', '.')) || 0 : 0; })(el.querySelector('.pcard-big b')?.textContent || '0')),
      // Le chiffre clé SUIT LE RÔLE (1.0) : des points, des punitions, des mises en échec par match… Deux chiffres ne
      // se comparent que dans la même unité ; entre deux unités, c'est le NIVEAU du ruban (Soutien → Phénomène) qui tranche.
      unite: (el.querySelector('.pcard-big span')?.textContent || '').trim(),
      niveau: ['Soutien', 'Régulier', 'Pilier', 'Étoile', 'Phénomène'].indexOf(((el.querySelector('.cj-ruban')?.textContent || '').replace(/[★\s]/g, ''))),
    })));

    /*
     * L'AUTO-DRAFT LIT LA CARTE AU LIEU DE PRENDRE LA PREMIÈRE (S64). Il
     * signait le premier joueur abordable dans l'ORDRE DU DOM — et en « par
     * poste » cet ordre est celui des colonnes, donc le premier ailier gauche
     * abordable, pas le meilleur joueur offert. Il rangeait des joueurs de
     * premier trio au quatrième et payait le malus de zone à chaque tour.
     * Mesuré sur 24 repêchages en Node (même moteur, mêmes adversaires,
     * `sonde_smoke` de S64) : 39,7 victoires, 20e au classement, les séries 8
     * fois sur 24.
     *
     * DEUX CLÉS, DANS CET ORDRE, et les deux sont dans le DOM — les cotes n'y
     * sont pas, et c'est une règle du dépôt : (1) une destination qui ne porte
     * AUCUN avertissement, (2) le plus grand chiffre clé. La première seule ne
     * suffit pas : tôt dans le repêchage toutes les cases sont libres, donc
     * presque aucune carte n'avertit — mesuré dans Chromium, 32-39-11 et trois
     * reprises pour se qualifier. Les deux ensemble : 50-27-5, 51-29-2,
     * 60-21-1 sur trois exécutions, qualifiée sans une seule reprise.
     *
     * Ce n'est pas un test qu'on truque : c'est la décision que l'écran
     * demande de prendre, avec la seule information qu'il donne.
     */
    // Un ordre TOTAL (sinon le tri mélange) : à niveau égal, les points d'abord, puis le chiffre dans son unité.
    const rang = (a, b) => (infos[b].propre - infos[a].propre) || (infos[b].niveau - infos[a].niveau)
      || ((infos[b].unite === 'PTS') - (infos[a].unite === 'PTS')) || (infos[a].unite === infos[b].unite ? infos[b].cle - infos[a].cle : infos[a].unite < infos[b].unite ? -1 : 1);
    const tenables = infos.map((c, i) => i).filter(i => infos[i].ok && infos[i].price <= maxPick);
    let idx = tenables.length ? tenables.sort(rang)[0] : -1;
    if (idx < 0) {
      // Rien de sûr : on relance (les trois clubs en loto ; passer, autre
      // équipe ou autre année en vestiaire), sinon on prend le moins cher
      const rr = await page.$('#rrL:not([disabled])') || await page.$('#rrP:not([disabled])')
        || await page.$('#rrT:not([disabled])') || await page.$('#rrS:not([disabled])');
      if (rr) { await rr.click(); await page.waitForTimeout(260); signed = await lireSignes(); continue; }
      let best = -1, bestPrice = Infinity;
      infos.forEach((c, i) => { if (c.ok && c.price < bestPrice) { best = i; bestPrice = c.price; } });
      idx = best;
    }

    if (idx < 0) {
      // Impasse : on fait ce que la bande de secours propose au joueur, libérer
      // de la masse salariale en retirant le plus gros contrat.
      const free = await page.$('#freeCapBtn');
      if (free) { await free.click(); await page.waitForTimeout(200); signed = await lireSignes(); continue; }
      break;
    }
    await cards[idx].$eval('.btn-sign', b => b.click());
    await page.waitForTimeout(200);
    const avant = signed;
    signed = await lireSignes();
    // Un seul clic ne laisse jamais moins que le plancher pour les cases restantes (J1-Q).
    if (signed > avant) {
      const etat = await page.evaluate(() => {
        const m = (document.querySelector('#capAmt')?.textContent || '').replace(/\u00a0/g, ' ').match(/(−?[\d,]+)\s*M\$/);
        const s = (document.querySelector('#cnt')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
        return { rem: m ? parseFloat(m[1].replace('−', '-').replace(',', '.')) : null, left: s ? Number(s[2]) - Number(s[1]) : null };
      });
      // Le plancher du jeu est 0,775 M$ par case (MIN_SAL de js/game.js) ; le 0,95 d'ici est la marge de l'auto-draft.
      if (etat.rem != null && etat.left != null && etat.rem + 0.01 < 0.775 * etat.left) errors.push(`une signature d'un seul clic a laissé ${etat.rem} M$ pour ${etat.left} cases, sous le plancher`);
      /*
       * LE TOAST NE DIT QUE CE QUI NE SE VOIT PAS (JP : *le toast gosse*). Une signature
       * à sa place n'en lève aucun : la case qui s'allume le dit. Au bas de l'écran
       * (1.0, R3), il ne couvre ni la barre d'action ni les onglets.
       */
      {
        const t = await page.evaluate(() => {
          const e = document.querySelector('#toast.on'); if (!e) return null;
          const r = e.getBoundingClientRect();
          const bas = [...document.querySelectorAll('#navbar, .actionbar')].map(x => x.getBoundingClientRect()).filter(x => x.height > 0);
          return { mot: e.textContent.trim(), warn: e.classList.contains('warn') || e.classList.contains('bad'), couvre: bas.some(x => r.bottom > x.top + 1 && r.top < x.bottom) };
        });
        if (t && !t.warn) errors.push(`une signature lève un toast qui ne dit rien qu'on ne voie : « ${t.mot} »`);
        if (t && t.couvre && !toastVu) errors.push(`le toast couvre la barre du bas : « ${t.mot} »`);
        if (t) toastVu = true;
      }
    }
  }
  console.log(`   ${etiquette} : ${signed}/${total} signés`);
  return { signed, total };
}

/*
 * LA CARTE ENTIÈRE AU PREMIER REGARD (1.0, R4). À 390 px, le prix, le chiffre clé et « Signer » de la première
 * carte tombaient sous le pli : 460 px de bandeau, de relances, de cellules et d'outils avant elle. Sans défiler,
 * la première carte se lit jusqu'à son bouton, et la barre d'action ne prend pas de place tant qu'il n'y a rien à lancer.
 */
{
  const carte = await page.evaluate(() => {
    const b = document.querySelector('.pcard .btn-sign');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const barre = document.querySelector('#actionbar');
    return { bas: Math.round(r.bottom), h: innerHeight, barre: !!(barre && barre.getBoundingClientRect().height > 0 && getComputedStyle(barre).display !== 'none') };
  });
  if (!carte) errors.push('le vestiaire n\'offre aucune carte à signer');
  else if (carte.bas > carte.h) errors.push(`à 390 px, le bouton Signer de la première carte tombe sous le pli (${carte.bas} px pour ${carte.h})`);
  else if (carte.barre) errors.push('à 390 px, la barre d\'action prend de la place au vestiaire alors qu\'il n\'y a rien à lancer');
  else console.log(`   la première carte se lit jusqu'à Signer sans défiler (${carte.bas} px sur ${carte.h})`);
}
let { signed } = await drafter('vestiaire');
console.log(`2. ${signed}/23 signés`);
// Le vestiaire est plein : c'est le moment où le DOM porte le plus de cartes,
// donc le moment où une cote qui fuit se verrait, et où la mise en page est
// la plus chargée.
console.log(`   à 390 px, alignement complet : ${await sansDebordement('vestiaire plein')} px de débordement, ${await toutEstAtteignable('vestiaire plein')} hors de portée, ${await cibles44('vestiaire plein')} cible(s) sous 44 px`);
await page.screenshot({ path: 'scripts/smoke-roster.png', fullPage: false });
// LE GARDIEN DIT SA PART DES DÉPARTS (V2.2) : la case de chaque gardien habillé, dans l'Effectif.
{
  const avant = await page.evaluate(() => document.body.dataset.section);
  await page.click('#navbar .navtab[data-section="lignes"]').catch(() => {});
  await page.waitForTimeout(400);
  const deps = await page.$$eval('.slot .cell-departs', e => e.map(x => x.textContent.trim()));
  if (deps.length < 2) errors.push(`les cases des gardiens ne disent pas leur part des départs (${deps.length} sur 2)`);
  else console.log(`   les gardiens : ${deps.join(' · ')}`);
  if (avant && avant !== 'lignes') { await page.click(`#navbar .navtab[data-section="${avant}"]`).catch(() => {}); await page.waitForTimeout(300); }
}

/*
 * L'ÉCRAN DES ÉQUIPES. JP : *faciliter de voir les équipes, leurs rosters,
 * stats réelles* ; *jamais longue pages, fait onglets si nécessaire* ; *ça me
 * dérange pas si ya l'option de swipe sur mobile pour voir d'autres colonnes,
 * je veux juste que yait un ui « ancré » avec onglets*.
 *
 * L'ANCRAGE S'ÉPROUVE PAR LA STRUCTURE, pas par un défilement : un club dont
 * la table tient dans l'écran ne prouverait rien en défilant de 0 px. Ce qui
 * sert à naviguer — la saison, la recherche, le bandeau du club, les trois
 * onglets — doit être HORS du conteneur qui défile, et ça, c'est vrai ou
 * faux.
 */
{
  await aller('equipes');
  await page.waitForSelector('#pageEquipes .eq-carte', { timeout: 40000 });
  const clubs = await page.$$eval('#pageEquipes .eq-carte', l => l.length);
  const annee = await page.$eval('#pageEquipes .eq-select', e => e.value);
  if (clubs < 8) errors.push(`l'écran des équipes ne montre que ${clubs} club(s) en ${annee}`);
  await page.click('#pageEquipes .eq-carte');
  await page.waitForSelector('#pageEquipes .eq-table tbody tr', { timeout: 15000 });
  const ancre = await page.evaluate(() => {
    const sc = document.querySelector('#pageEquipes .eq-scroll');
    const dedans = s => { const e = document.querySelector(s); return !!(e && sc && sc.contains(e)); };
    return ['#pageEquipes .eq-barre', '#pageEquipes .eq-tete', '#pageEquipes .eq-onglets'].filter(dedans);
  });
  if (ancre.length) errors.push(`l'écran des équipes n'est pas ancré : ${ancre.join(', ')} défile(nt) avec le contenu`);
  // Les trois onglets, et les colonnes du gardien qui ne sont PAS celles d'un
  // patineur : un onglet qui rend la même table est un onglet décoratif.
  const cols = {};
  for (const poste of ['F', 'D', 'G']) {
    await page.click(`#pageEquipes [data-poste="${poste}"]`);
    await page.waitForTimeout(180);
    cols[poste] = await page.$$eval('#pageEquipes .eq-table thead th', l => l.map(e => e.textContent.replace(/[▾▴]/g, '').trim()).join(' '));
  }
  if (cols.G === cols.F) errors.push('les gardiens portent les colonnes des patineurs');
  if (!/\bV\b/.test(cols.G) || !/%ARR/.test(cols.G)) errors.push(`les colonnes des gardiens sont fausses : ${cols.G}`);
  // Le tri : la même colonne deux fois inverse le sens.
  await page.click('#pageEquipes [data-poste="F"]');
  await page.waitForTimeout(180);
  await page.click('#pageEquipes [data-tri="g"]');
  await page.waitForTimeout(180);
  const buts = await page.$$eval('#pageEquipes .eq-table tbody tr td:nth-child(4)', l => l.slice(0, 5).map(e => Number(e.textContent.trim())));
  if (!buts.every((v, i) => !i || buts[i - 1] >= v)) errors.push(`le tri par buts ne descend pas : ${buts.join(' ')}`);
  // La fiche d'un joueur s'ouvre PAR-DESSUS, et Échap ne ferme que la fiche :
  // avec des modales empilées, tout fermer d'un coup fait sortir de l'écran.
  await page.click('#pageEquipes .eq-joueur');
  await page.waitForTimeout(400);
  const ficheOuverte = await page.$eval('#hockeyCardModal', e => e.style.display !== 'none');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const dessous = await page.$eval('#pageEquipes', e => !e.hidden);
  if (!ficheOuverte) errors.push("la fiche d'un joueur ne s'ouvre pas depuis l'écran des équipes");
  if (!dessous) errors.push("Échap ferme l'écran des équipes SOUS la fiche d'un joueur : une modale du dessous ne doit pas partir avec celle du dessus");
  console.log(`   les équipes : ${clubs} clubs en ${annee}, écran ancré, ${await sansDebordement('écran des équipes')} px de débordement`);
  await aller('repechage');
  await page.waitForTimeout(250);
}

/*
 * UN ONGLET, UNE RAISON D'ÊTRE. JP : *mettre onglets en bas, pages séparées
 * de l'accueil* ; *je veux pas avoir tout restant dans la page, picks,
 * alignement, match du jour/calendrier, standings, leaders, C'EST TOUS DES
 * ONGLETS DIFFÉRENTS* ; *pense à l'interface d'un EHM*.
 *
 * Deux choses s'éprouvent, et elles sont structurelles. **Chaque onglet tient
 * en UN écran** — les pages sont des boîtes bornées dont le corps défile, pas
 * des pages qui grandissent (la page des règles faisait 24,6 écrans avant).
 * Et **l'onglet de l'alignement ne porte que l'alignement** : ni la roulette,
 * ni le tableau de bord, ni le vestiaire, ni le bilan — c'était ça, « tout
 * restant dans la page ».
 */
{
  const lire = () => page.evaluate(() => {
    const vu = s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const de = document.documentElement;
    return {
      page: document.body.dataset.page,
      spin: vu('#spin'), dash: vu('#dash'), pool: vu('#panePool'), roster: vu('#paneRoster'),
      ecrans: +(de.scrollHeight / de.clientHeight).toFixed(2),
    };
  });
  const vus = [];
  // LA BARRE EST FIXE (S67 ; 1.0, R1) : ses cinq sections existent dès le
  // repêchage, et chaque page de chaque section tient sur un écran, même vide.
  const sections = await page.$$eval('#navbar .navtab', e => e.map(x => x.dataset.section).join(','));
  if (sections !== SECTIONS.join(',')) errors.push(`la barre du repêchage du 82-0 ne porte pas ses quatre sections (sans Cartes) : « ${sections} »`);
  for (const cle of ['match', 'repechage', 'alignement', 'classement', 'calendrier', 'meneurs', 'equipes', 'historique', 'regles']) {
    if (cle !== 'regles' && !(await page.$(`#navbar .navtab[data-section="${SECTION_DE[cle]}"]`))) { errors.push(`la barre n'a pas de section pour « ${cle} »`); continue; }
    await aller(cle);
    await page.waitForTimeout(cle === 'equipes' ? 2500 : 400);
    if (cle === 'regles') {
      // Les règles : un écran secondaire du Menu, par-dessus tout, qui tient sur un écran ; Échap y remonte.
      const r = await page.evaluate(() => { const p = document.getElementById('pageRegles'); const b = p.getBoundingClientRect(); return { vu: !p.hidden, haut: Math.round(b.height), fenetre: innerHeight }; });
      vus.push(`regles ${r.vu ? 'ouvertes' : 'fermées'}`);
      if (!r.vu || r.haut > r.fenetre + 1) errors.push(`les règles ne s'ouvrent pas du Menu sur un écran : ${JSON.stringify(r)}`);
      await sansDebordement('les règles');
      await toutEstAtteignable('les règles');
      await cibles44('les règles');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      if (!(await page.$('#pageRegles[hidden]'))) errors.push('Échap ne referme pas les règles');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      if (await page.$('#menuDepart')) errors.push('Échap ne referme pas le Menu ouvert en pleine partie');
      continue;
    }
    const e = await lire();
    vus.push(`${cle} ${e.ecrans}×`);
    if (e.page !== cle) errors.push(`l'onglet « ${cle} » ne pose pas la page : body[data-page] vaut « ${e.page} »`);
    if (e.ecrans > 1.05) errors.push(`l'onglet « ${cle} » fait ${e.ecrans} écrans : une page est une boîte bornée dont le CORPS défile`);
    await sansDebordement(`l'onglet ${cle}`);
    await toutEstAtteignable(`l'onglet ${cle}`);
    await cibles44(`l'onglet ${cle}`);
    if (cle === 'alignement') {
      const intrus = ['spin', 'dash', 'pool'].filter(k => e[k]);
      if (intrus.length) errors.push(`l'onglet de l'alignement porte aussi ${intrus.join(', ')} : un onglet, une raison d'être`);
      if (!e.roster) errors.push("l'onglet de l'alignement ne montre pas l'alignement");
    }
  }
  console.log(`   un onglet, une raison d'être : ${vus.join(' · ')}`);
  /*
   * LE RETOUR, UN NIVEAU À LA FOIS (1.0, R1). De chaque section, Échap remonte
   * au Club en un geste (deux au plus quand une case est visée) ; une fiche
   * ouverte par-dessus se ferme d'abord, et la section reste.
   */
  {
    const gestes = [];
    for (const s of ['joueurs', 'lignes', 'ligue']) {
      await page.click(`#navbar .navtab[data-section="${s}"]`);
      await page.waitForTimeout(300);
      if (s === 'lignes') {
        const nom = await page.$('.slot .slot-fiche');
        if (nom) {
          await nom.click();
          await page.waitForSelector('#hockeyCardModal', { state: 'visible', timeout: 5000 }).catch(() => {});
          await page.keyboard.press('Escape');
          await page.waitForTimeout(250);
          const o = await page.evaluate(() => ({ fiche: document.getElementById('hockeyCardModal').style.display !== 'none', page: document.body.dataset.page }));
          if (o.fiche || o.page !== 'alignement') errors.push(`Échap sur une fiche ouverte de l'alignement : fiche ${o.fiche ? 'encore ouverte' : 'fermée'}, page « ${o.page} »`);
        }
      }
      let n = 0;
      while (n < 3 && await page.evaluate(() => document.body.dataset.page !== 'match')) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); n++; }
      gestes.push(`${s} ${n}`);
      if (await page.evaluate(() => document.body.dataset.page !== 'match')) errors.push(`Échap ne ramène pas au Bureau depuis « ${s} » en trois gestes`);
      else if (n > 2) errors.push(`de « ${s} », Échap prend ${n} gestes pour remonter au Bureau`);
    }
    /*
     * LES IDIOMES DE CONSOLE : le corps ne se sélectionne pas comme un texte,
     * aucun bouton ni lien n'est souligné, et les flèches déplacent le focus
     * — avec son anneau lumineux, en mode clavier seulement.
     */
    await page.click('#navbar .navtab[data-section="lignes"]');
    await page.waitForTimeout(300);
    const idiomes = await page.evaluate(() => ({
      selection: getComputedStyle(document.body).userSelect,
      soulignes: [...document.querySelectorAll('a, button, .lien-joueur, .lien-equipe')]
        .filter(e => e.offsetParent && getComputedStyle(e).textDecorationLine.includes('underline')).map(e => e.textContent.trim().slice(0, 24)),
    }));
    if (idiomes.selection !== 'none') errors.push(`le corps de la page se sélectionne comme un texte (user-select: ${idiomes.selection})`);
    if (idiomes.soulignes.length) errors.push(`des boutons ou des liens soulignés : ${idiomes.soulignes.slice(0, 4).join(' · ')}`);
    const focus = () => page.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? `${a.tagName}|${a.className}|${(a.textContent || '').trim().slice(0, 20)}` : null; });
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(120);
    const f1 = await focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    const f2 = await focus();
    const clavier = await page.evaluate(() => document.body.classList.contains('nav-clavier'));
    if (!f1 || !f2 || f1 === f2) errors.push(`les flèches ne déplacent pas le focus : « ${f1} » puis « ${f2} »`);
    if (!clavier) errors.push('les flèches ne passent pas en mode clavier (l\'anneau du focus reste éteint)');
    await page.screenshot({ path: 'scripts/smoke-focus.png', fullPage: false });
    await page.mouse.click(5, 5);
    const eteint = await page.evaluate(() => !document.body.classList.contains('nav-clavier'));
    if (!eteint) errors.push('un clic n\'éteint pas l\'anneau du focus');
    console.log(`   le retour : Échap vers le Bureau (${gestes.join(', ')}) · user-select ${idiomes.selection} · ${idiomes.soulignes.length} souligné(s) · les flèches : « ${(f1 || '').split('|')[2]} » → « ${(f2 || '').split('|')[2]} »`);
  }
  barreAuRepechage = await page.$$eval('#navbar .navtab', e => e.map(x => x.dataset.section).join(' · '));
  await redimensionner('le repêchage');
  await aller('repechage');
  await page.waitForTimeout(300);
}

/*
 * ALIGNER AU MIEUX (oct.). JP : *bouton best lines et best strategy pour éviter le gossage*. L'équipe complète, le
 * bouton de l'alignement réaligne d'un toucher (nov. 2026 : plus de fenêtre) sans perdre personne, et la saison reste lançable.
 */
if (await page.$eval('#mainBtn', b => !b.disabled)) {
  await aller('alignement');
  await page.waitForTimeout(300);
  const signes = () => page.evaluate(() => Object.values(window.cap82.G.roster || {}).filter(Boolean).length);
  const avant = await signes();
  if (!(await page.$('#rosterBoard .ln-auto'))) errors.push('l\'alignement n\'offre pas « Aligner au mieux »');
  else {
    // Nov. 2026 : le bouton agit sans fenêtre (il ouvrait une fenêtre à une seule option).
    await page.click('#rosterBoard .ln-auto');
    await page.waitForTimeout(400);
    if (await page.$('#choixModal:not([hidden]) [data-choix]')) errors.push('« Aligner au mieux » ouvre encore une fenêtre');
    const apres = await signes();
    if (apres !== avant) errors.push(`« Aligner au mieux » perd des joueurs : ${avant} → ${apres}`);
    console.log(`   aligner au mieux : appliqué d'un toucher, ${apres} joueurs signés`);
  }
  await aller('repechage');
  await page.waitForTimeout(300);
}
const enabled = await page.$eval('#mainBtn', b => !b.disabled);
console.log(`3. #mainBtn actif : ${enabled}`);
/*
 * LE 82-0 CLASSIQUE (oct.). JP : *la saison est simulée d'un coup, mais les séries, match par match ; le
 * joueur fait rien sauf le draft*. « Lancer la saison » mène droit au bilan : aucun écran jour par jour.
 */
async function saisonDunCoup(etiquette) {
  await _wait('.result .score', { timeout: 120000 });
  if (await page.$('#hubModal .hub-jour')) errors.push(`${etiquette} : le 82-0 ouvre encore l'écran jour par jour`);
  const rows = await page.$$eval('.rrow', r => r.length);
  if (rows !== 23) errors.push(`${etiquette} : le bilan compte ${rows} rangées, pas 23`);
}


/* La saison jusqu'au bilan, sans rien regarder : ce qui sert à REJOUER
   jusqu'à se qualifier, où seul le classement final compte. */
/*
 * LES SÉRIES NE SE SAUTENT PAS NON PLUS (S79) tant que ta série se joue :
 * « Passer à la fin » n'existe qu'éliminé. On joue match après match, ronde
 * après ronde, en réglant chaque choix, jusqu'au tableau.
 */
/* Les captures des écrans du jalon 2 (scripts/smoke-j2-*.png) : au téléphone, puis à 1440 px. */
async function deuxCaptures(nom, voir = null) {
  const vp = page.viewportSize();
  const montrer = () => (voir ? page.$eval(voir, e => e.scrollIntoView({ block: 'center' })).catch(() => {}) : null);
  await montrer();
  await page.screenshot({ path: `scripts/smoke-j2-${nom}-390.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await montrer();
  await page.screenshot({ path: `scripts/smoke-j2-${nom}-1440.png` });
  await page.setViewportSize(vp);
  await page.waitForTimeout(300);
}
async function finirSeries() {
  for (let i = 0; i < 300; i++) {
    const suite = await page.$('#hubModal .hub-suite');
    if (suite && await suite.isVisible()) return;
    for (const sel of ['#hubModal .hub-fin', '#hubModal .hub-ronde', '#hubModal .hub-jour']) {
      const b = await page.$(sel);
      if (b && await b.isVisible() && !(await b.isDisabled())) { await page.click(sel); await page.waitForTimeout(200); break; }
    }
  }
  errors.push('les séries ne vont pas au tableau en 300 gestes');
}

if (enabled) {
  await page.click('#mainBtn');
  await saisonDunCoup('saison');
  const score = await page.textContent('.result .score');
  const rows = await page.$$eval('.rrow', r => r.length);
  console.log(`4. fiche ${score.trim()}, ${rows} rangées`);
  // LE CONSEIL DU BILAN CITE SES CHIFFRES (1.0, J2-18) : un nombre, jamais « regarde tes trois derniers trios ».
  {
    const conseil = ((await page.textContent('#resultHost .note').catch(() => '')) || '').trim();
    if (!/\d/.test(conseil) || /trois derniers trios|bât blesse/.test(conseil)) errors.push(`le conseil du bilan ne cite aucun chiffre : « ${conseil} »`);
    else console.log(`   le conseil du bilan : « ${conseil} »`);
    // LES FORCES EN VRAIES STATS (1.0, oct.) : un rang et une stat de la saison par force, jamais une cote.
    const forces = await page.$$eval('.result .bars .bar', l => l.map(b => [b.querySelector('.bl').textContent.trim(), b.querySelector('.bv').textContent.trim(), (b.querySelector('.bm') || {}).textContent || '']));
    const malFaites = forces.filter(([, rang, mot]) => !/^\d+(er|e)$/.test(rang) || !/\d/.test(mot));
    if (forces.length !== 7 || malFaites.length) errors.push(`les forces du bilan ne sont pas sept rangs avec leur stat : ${forces.map(f => f.join(' ')).join(' · ')}`);
    else console.log(`   les forces du bilan : ${forces.map(([n, r, m]) => `${n} ${r} (${m})`).join(' · ')}`);
    await deuxCaptures('bilan');
    /*
     * LE BILAN SE LIT PAR CHAPITRES (1.0, oct.) : la barre collée y saute, et « Tes chiffres » et « Le rythme »
     * se relisent aux feuilles — une fiche à domicile et sur la route qui fait la fiche entière, une courbe de 82 points.
     */
    const ch = await page.$$eval('#resultHost .bl-sauts .aln-saut', l => l.map(b => b.dataset.blSaut));
    const tuiles = await page.$$eval('#resultHost .bl-tuile', l => l.map(t => [t.querySelector('.k').textContent.trim(), t.querySelector('b').textContent.trim()]));
    const fdu = k => ((tuiles.find(t => t[0] === k) || [])[1] || '0-0-0').split('-').map(Number);
    const [d, r] = [fdu('À domicile'), fdu('Sur la route')];
    const tot = score.trim().split('-').map(Number);
    if (!['resume', 'chiffres', 'rythme'].every(k => ch.includes(k))) errors.push(`le bilan n'a pas ses chapitres : ${ch.join(', ')}`);
    else if (d.some((x, i) => x + r[i] !== tot[i])) errors.push(`domicile ${d.join('-')} et route ${r.join('-')} ne font pas la fiche ${score.trim()}`);
    else {
      await page.click('#resultHost .bl-sauts [data-bl-saut="rythme"]');
      // Le saut défile en douceur : sa durée suit la distance et la machine (500 ms ne suffisaient pas en CI, graine pgui2c).
      // On attend que le chapitre arrive, jusqu'à 3 s, plutôt qu'un délai fixe.
      const vu = await page.waitForFunction(() => { const e = document.querySelector('#resultHost [data-bl="rythme"]'); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight / 2; },
        null, { timeout: 3000 }).then(() => true).catch(() => false);
      if (!vu) {
        // De quoi comprendre : où le chapitre s'arrête, et ce qui défile (au bout ou non).
        const ou = await page.evaluate(() => {
          const e = document.querySelector('#resultHost [data-bl="rythme"]'), r = e && e.getBoundingClientRect();
          let sc = e && e.parentElement; while (sc && !(['auto', 'scroll'].includes(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight + 1)) sc = sc.parentElement;
          return `chapitre ${r ? Math.round(r.top) : '—'} sur ${innerHeight} ; défile : ${sc ? `${sc.id || sc.className} ${Math.round(sc.scrollTop)}/${sc.scrollHeight - sc.clientHeight}` : 'la page ' + Math.round(scrollY)}`;
        });
        errors.push(`le chapitre « Rythme » ne vient pas en haut quand on le touche (${ou})`);
      }
      console.log(`   le bilan par chapitres : ${ch.join(' · ')} · domicile ${d.join('-')}, route ${r.join('-')} · ${tuiles.length} chiffres`);
      await deuxCaptures('bilan-rythme', '#resultHost [data-bl="rythme"]');
    }
  }
  // Le bilan porte les tableaux les plus larges du jeu (onze colonnes) : s'il
  // y a un débordement quelque part, il est ici.
  await sansDebordement('bilan de saison');

  /*
   * PERSONNE NE GAGNAIT RIEN. Le jeu jouait 82 matchs, couronnait un champion,
   * et ne consacrait aucun joueur — les neuf palmarès étaient là, personne ne
   * les remportait. Cinq trophées et une première équipe d'étoiles, tous
   * décidés par les colonnes : ce que le moteur tranche, jamais ce qu'un vote
   * trancherait.
   */
  await aller('meneurs');
  await page.waitForTimeout(350);
  const trophees = await page.$$eval('.tro-carte', els => els.map(e => ({
    nom: (e.querySelector('.tro-nom') || {}).textContent || '',
    val: (e.querySelector('.tro-val') || {}).textContent || '',
  })));
  const etoiles = await page.$$eval('.result-pane[data-volet="stats"] .tro-titre + .table-wrap tbody tr', l => l.length);
  if (trophees.length < 5) errors.push(`seulement ${trophees.length} trophée(s) décerné(s) sur 5`);
  else if (trophees.some(t => !t.val.trim() || t.val.trim() === '—')) errors.push(`un trophée sans gagnant : ${JSON.stringify(trophees)}`);
  else if (etoiles !== 6) errors.push(`l'équipe d'étoiles compte ${etoiles} joueurs au lieu de six`);
  else console.log(`   trophées : ${trophees.map(t => `${t.nom.trim()} ${t.val.trim()}`).join(' · ')} · équipe d'étoiles à ${etoiles}`);
  await sansDebordement('trophées de la saison');

  /*
   * UN CLUB S'OUVRE SUR SES DEUX SAISONS. JP : *pouvoir cliquer sur nom de
   * joueur et équipe pour voir carte avec stats simulés et réelles et liens
   * vers sites externes*. La page d'une équipe montrait la saison JOUÉE et
   * rien d'autre ; la vraie fiche du club se reconstitue de son shard
   * (`ficheDeClub`, la méthode de check_ratings) et arrive en asynchrone,
   * donc on l'ATTEND plutôt que de la lire tout de suite.
   */
  {
    await aller('classement');
    await page.waitForTimeout(150);
    const cible = await page.$$eval('#resultHost .result-pane[data-volet="classement"] .lien-equipe', ls => {
      const i = ls.findIndex(b => !/NHL/.test(b.textContent));
      return i >= 0 ? i : -1;
    }).catch(() => -1);
    if (cible < 0) errors.push('aucun club adverse cliquable au classement');
    else {
      await page.$$eval('#resultHost .result-pane[data-volet="classement"] .lien-equipe', (ls, i) => ls[i].click(), cible);
      await page.waitForSelector('#gameModal', { state: 'visible', timeout: 10000 });
      // La vraie fiche se charge d'un shard : on lui laisse le temps d'arriver.
      // `.eq-vraie-attente` est le mot de CHARGEMENT, et lui seul : une fiche
      // partielle porte aussi une note (« un gardien échangé hors du total »),
      // et la compter ici ferait rougir le test sur 23 % des clubs.
      await page.waitForFunction(() => {
        const g = document.getElementById('eqVraie');
        return g && !g.querySelector('.eq-vraie-attente');
      }, null, { timeout: 20000 }).catch(() => {});
      const club = await page.evaluate(() => {
        const m = document.getElementById('gameModal');
        const cellules = g => [...(g ? g.querySelectorAll('.stat-cell') : [])]
          .map(c => `${c.querySelector('.k').textContent.trim()} ${c.querySelector('.v').textContent.trim()}`);
        return {
          // La saison JOUÉE est dans le titre (la fiche V-D-DP) et dans les
          // deux tables ; la vraie est la grille qu'on vient de reconstituer.
          titre: ((m.querySelector('#gameModalTitle') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
          rangees: m.querySelectorAll('table.data tbody tr').length,
          vraie: cellules(document.getElementById('eqVraie')).slice(0, 3).join(' · '),
          hr: !!m.querySelector('a[href*="hockey-reference"]'),
          partielle: !cellules(document.getElementById('eqVraie')).some(c => c.startsWith('N ')),
          mot: !!(document.getElementById('eqVraie') || {}).querySelector?.('.eq-vraie-mot'),
          attente: !!(document.getElementById('eqVraie') || {}).querySelector?.('.eq-vraie-attente'),
        };
      });
      if (!club.vraie) errors.push(`la page d'un club ne porte pas sa vraie saison (${club.titre.trim()})`);
      // Une fiche à qui il manque un gardien échangé tait ses nuls : elle doit
      // alors DIRE pourquoi, jamais laisser un trou sans mot (`motDeClub`).
      if (club.partielle && !club.mot) errors.push("la vraie saison d'un club est partielle sans dire pourquoi");
      else if (club.attente) errors.push("la vraie saison d'un club reste en attente");
      if (!club.hr) errors.push("la page d'un club n'a pas son lien vers Hockey-Reference");
      if (!club.rangees) errors.push("la page d'un club ne montre aucun joueur");
      else console.log(`   un club s'ouvre : « ${club.titre} », ${club.rangees} rangées · vraie saison ${club.vraie} · lien externe`);
      await sansDebordement("la page d'une équipe");
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
    }
    await aller('match');
    await page.waitForTimeout(120);
    /*
     * ET LES CARTONS D'ENTRACTE, qui sont l'autre endroit où le bilan nomme
     * des joueurs — meneurs, différentiel, gardiens, absences — plus la
     * chronique du vestiaire et l'infirmerie. Un nom affiché qui ne s'ouvre
     * pas est un cul-de-sac : on le compte plutôt que de l'espérer.
     */
    const bilanNoms = await page.evaluate(() => {
      const volet = document.querySelector('#resultHost .result-pane[data-volet="bilan"]');
      if (!volet) return null;
      /*
       * UNE COLONNE EST TOUTE EN NOMS OU PAS DU TOUT. Un carton d'entracte
       * porte aussi des tableaux dont la première colonne n'est PAS un nom
       * (« 1-10 », l'arc de la saison), donc « toute cellule de gauche doit
       * s'ouvrir » crierait pour du bruit. Ce qui ne peut pas arriver, c'est
       * qu'UNE rangée d'une colonne de noms reste muette pendant que ses
       * voisines s'ouvrent.
       */
      let colonnes = 0, boiteuses = 0, liens = 0;
      for (const t of volet.querySelectorAll('.ent-table')) {
        const cells = [...t.querySelectorAll('tbody td.left')].filter(td => td.textContent.trim());
        if (!cells.length) continue;
        const ouvrables = cells.filter(td => td.querySelector('.lien-joueur')).length;
        if (!ouvrables) continue;
        colonnes++; liens += ouvrables;
        if (ouvrables !== cells.length) boiteuses++;
      }
      // Le vestiaire et l'infirmerie nomment des joueurs ; « Tes cartes »
      // nomme des cartes, et ce n'est pas la même chose.
      const nommes = [...volet.querySelectorAll('.result-section')]
        .filter(sec => /vestiaire|infirmerie/i.test((sec.querySelector('h3') || {}).textContent || ''))
        .flatMap(sec => [...sec.querySelectorAll('.inj-list strong')]);
      return {
        colonnes, boiteuses, liens,
        listes: nommes.length,
        listesMuettes: nommes.filter(x => !x.querySelector('.lien-joueur')).length,
      };
    });
    if (!bilanNoms) errors.push('le volet du bilan est introuvable');
    else {
      if (!bilanNoms.colonnes) errors.push("aucun nom ouvrable dans les cartons d'entracte du bilan");
      if (bilanNoms.boiteuses) errors.push(`${bilanNoms.boiteuses} colonne(s) de noms où une rangée reste muette dans les cartons d'entracte`);
      if (bilanNoms.listesMuettes) errors.push(`${bilanNoms.listesMuettes} nom(s) muet(s) sur ${bilanNoms.listes} dans le vestiaire et l'infirmerie`);
      if (!bilanNoms.boiteuses && !bilanNoms.listesMuettes && bilanNoms.colonnes)
        console.log(`   le bilan nomme : ${bilanNoms.liens} joueurs en ${bilanNoms.colonnes} colonnes de cartons, ${bilanNoms.listes} au vestiaire et à l'infirmerie — tous ouvrables`);
    }
  }

  /* Aucun volet du bilan ne doit être une longue page — c'est LE défaut que
     le repêchage resté au-dessus provoquait, et il se lit d'un chiffre. */
  if (await page.$('#resultTabs')) errors.push("le bilan a encore sa propre barre d'onglets : il n'y en a qu'une, et elle est en bas");
  /*
   * LE NIVEAU DE LA LIGUE. JP : *je veux un onglet à la fin de la saison qui
   * montre la force relative de la ligue et comment x performe versus
   * l'attente du niveau de la ligue*. Trois choses s'éprouvent, et la
   * deuxième est un INVARIANT : les attentes sont mises à l'échelle des
   * points que la ligue a vraiment distribués, donc LA SOMME DES ÉCARTS EST
   * NULLE. Si elle dérive, l'écart d'un club ne veut plus rien dire — on
   * lirait « +7 » sur une ligue entière chanceuse.
   */
  {
    // S67 : « La ligue » se lit sous le classement, dans le même onglet.
    const ong = await page.$('#navbar .navtab[data-section="ligue"]');
    if (!ong) errors.push("l'onglet du classement n'existe pas au bilan");
    else {
      await aller('classement');
      await page.waitForTimeout(3500);   // les shards des 31 adversaires
      const n = await page.evaluate(() => {
        const v = document.querySelector('#resultHost .result-pane[data-volet="ligue"]');
        if (!v) return null;
        const ec = [...v.querySelectorAll('.niv-table tbody tr td.heros')].map(x => parseFloat(x.textContent));
        return {
          rangs: v.querySelectorAll('.niv-table tbody tr').length,
          somme: ec.reduce((a, x) => a + x, 0),
          attente: [...v.querySelectorAll('.niv-tuile b')].filter(x => x.textContent.trim() === '…').length,
          niveau: (v.querySelector('.niv-tuile b') || {}).textContent,
        };
      });
      if (!n) errors.push("le volet « La ligue » ne rend rien");
      else {
        if (n.rangs < 30) errors.push(`la table du niveau n'a que ${n.rangs} rangées`);
        if (Math.abs(n.somme) > 1.5) errors.push(`la somme des écarts vaut ${n.somme.toFixed(1)} au lieu de zéro : les attentes ne sont plus à l'échelle des points distribués`);
        if (n.attente) errors.push(`${n.attente} tuile(s) du niveau restent en points de suspension : les vraies saisons ne se sont pas chargées`);
        else console.log(`   le niveau de la ligue : ${n.rangs} clubs, vrai % de victoires des 31 ${(n.niveau || '').trim()}, somme des écarts ${n.somme.toFixed(1)}`);
      }
      await pasUneLonguePage('le bilan · la ligue');
      await sansDebordement('le bilan · la ligue');
    }
  }

  /*
   * MA LIGUE DANS L'ONGLET DES ÉQUIPES. JP : *les équipes dans l'onglet
   * équipe, je parle de ceux de la ligue en cours, je veux pouvoir comparer
   * les joueurs et équipes avec leurs vraies prestations*. L'écran ouvrait
   * les 44 franchises par saison — de l'histoire, sans rapport avec la
   * partie. Trois choses s'éprouvent : la ligue en cours est la source
   * OUVERTE dès qu'elle existe, elle porte ses 32 clubs, et un club met
   * chaque nombre du jeu au-dessus du vrai.
   */
  {
    await aller('equipes');
    await page.waitForTimeout(2600);
    const ouverte = await page.$$eval('#pageEquipes [data-source].on', e => e.map(x => x.dataset.source));
    if (ouverte[0] !== 'ligue') errors.push(`l'onglet des équipes ouvre « ${ouverte[0] || 'rien'} » au lieu de ma ligue une fois la saison jouée`);
    const clubsLigue = await page.$$eval('#pageEquipes .eq-carte', e => e.length);
    if (clubsLigue < 30) errors.push(`ma ligue ne montre que ${clubsLigue} clubs`);
    if (!(await page.$('#pageEquipes .eq-carte.mienne'))) errors.push('ma formation ne paraît pas parmi les clubs de ma ligue');
    const adverse = await page.$('#pageEquipes .eq-carte:not(.mienne)');
    if (!adverse) errors.push('aucun club adverse dans ma ligue');
    else {
      await adverse.click();
      await page.waitForTimeout(2600);
      const m = await page.evaluate(() => {
        const t = document.querySelector('#pageEquipes .eq-table.eq-double');
        if (!t) return null;
        const c = t.querySelector('tbody td.stat');
        return {
          rangees: t.querySelectorAll('tbody tr').length,
          double: !!(c && c.querySelector('b') && c.querySelector('i')),
          reel: !!document.querySelector('#pageEquipes .eq-tete-reel'),
        };
      });
      if (!m) errors.push("un club de ma ligue ne rend pas la table à deux nombres");
      else {
        if (!m.double) errors.push('une cellule ne porte pas le nombre du jeu ET le vrai');
        if (!m.reel) errors.push("le bandeau d'un club de ma ligue ne porte pas sa vraie saison");
        if (m.rangees < 10) errors.push(`un club de ma ligue n'a que ${m.rangees} rangées`);
        console.log(`   ma ligue : ${clubsLigue} clubs, un club rend ${m.rangees} rangées à deux nombres, la vraie saison au bandeau`);
      }
      await sansDebordement('un club de ma ligue');
    }
    await aller('match');
    await page.waitForTimeout(400);
  }
  /*
   * LA BARRE A CHANGÉ D'ENTRÉES, parce que la phase a changé : on ne bâtit
   * plus, on lit. Neuf onglets ne tiennent pas dans 390 px — la barre défile
   * en x plutôt que de rétrécir « Calendrier » à quarante pixels, et c'est LE
   * conteneur qui défile, jamais la page (zéro débordement horizontal).
   */
  {
    const b = await page.evaluate(() => {
      const nav = document.querySelector('#navbar'), de = document.documentElement;
      return {
        noms: [...nav.querySelectorAll('.navtab-lbl')].map(e => e.textContent.trim()),
        defile: nav.scrollWidth > nav.clientWidth + 1,
        deborde: Math.max(0, de.scrollWidth - de.clientWidth),
        bas: Math.round(window.innerHeight - nav.getBoundingClientRect().bottom),
      };
    });
    // LA MÊME BARRE QU'AU REPÊCHAGE (S67), entrée pour entrée, dans le même
    // ordre : c'est ce que « même organisation, peu importe le moment » veut dire.
    const ici = await page.$$eval('#navbar .navtab', e => e.map(x => x.dataset.section).join(' · '));
    if (barreAuRepechage && ici !== barreAuRepechage) errors.push(`la barre a changé depuis le repêchage : « ${barreAuRepechage} » puis « ${ici} »`);
    if (b.deborde) errors.push(`la barre du bas déborde la page de ${b.deborde} px : c'est LA BARRE qui défile, pas la page`);
    if (malPlacee(b.bas)) errors.push(`la barre du bas est à ${b.bas} px du bas (retrait voulu ${FLOTTE})`);
    console.log(`   la barre ne bouge pas : ${b.noms.join(' · ')} · ${b.defile ? 'elle défile' : 'elle tient'} · ${b.deborde} px de débordement`);
  }
  const hauteurs = {};
  for (const v of ['match', 'classement', 'calendrier', 'meneurs', 'alignement']) {
    const b = await page.$(`#navbar .navtab[data-section="${SECTION_DE[v]}"]`);
    // Un onglet manquant ne se saute PAS : c'était un test qui passait
    // toujours. La saison est jouée, donc la barre porte ses sections.
    if (!b) { errors.push(`la barre du bas n'a pas d'onglet « ${v} » une fois la saison jouée`); continue; }
    await aller(v);
    await page.waitForTimeout(220);
    const pose = await page.evaluate(() => document.body.dataset.page);
    if (pose !== v) errors.push(`l'onglet « ${v} » ne pose pas la page : body[data-page] vaut « ${pose} »`);
    hauteurs[v] = await pasUneLonguePage(`le bilan · ${v}`);
    await sansDebordement(`le bilan · ${v}`);
    await toutEstAtteignable(`le bilan · ${v}`);
    await cibles44(`le bilan · ${v}`);
  }
  console.log(`   jamais une longue page : ${Object.entries(hauteurs).map(([k, n]) => `${k} ${n}×`).join(' · ')}`);
  await redimensionner('le bilan');
  await aller('match');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'scripts/smoke-result.png', fullPage: false });
  /*
   * ON DOIT ATTEINDRE LES SÉRIES. `smoke.mjs` tire au hasard, et c'est un
   * choix assumé — mais TOUT ce passage (le tableau, la reprise, la Coupe dans
   * l'historique) ne s'exécute pas si l'équipe rate les séries, et un test qui
   * saute en silence est aussi faux qu'un sélecteur qui ne matche rien.
   *
   * « Rejouer la saison » garde le même alignement et change les dés : on
   * rejoue jusqu'à se qualifier, au plus ESSAIS fois, et on ÉCHOUE si on n'y
   * arrive pas.
   *
   * ET CE GARDE-FOU A RELANCÉ LA MAUVAISE CHOSE PENDANT TROIS CHANTIERS (S64).
   * Le nombre d'essais est passé de 12 à 30 quand l'Action a rougi, sur le
   * calcul « une chance sur trois par reprise, donc trente échecs tombent une
   * fois sur dix mille ». Le calcul suppose que les reprises sont
   * indépendantes. Elles ne le sont pas : une reprise ne change que les DÉS,
   * et l'écart type d'une saison de 82 matchs vaut 4,5 victoires. Une équipe
   * repêchée à 25 victoires a besoin de seize de plus pour se classer — aucun
   * nombre de reprises ne le donne. L'Action a donc joué trente saisons de 25
   * victoires, soixante-dix secondes, et rougi à coup sûr : ce qui décide,
   * c'est le REPÊCHAGE, pas les dés.
   *
   * LA RÉPONSE EST DONC DANS `drafter`, ci-dessus : l'auto-draft lit la carte
   * (destination sans avertissement, puis le plus grand chiffre clé) au lieu
   * de signer la première abordable dans l'ordre du DOM. Mesuré sur 24
   * repêchages en Node : 39,7 victoires et 8 qualifications sur 24 avant,
   * 55,4 et 24 sur 24 après — et dans Chromium, 50-27-5, 51-29-2 et 60-21-1
   * sur trois exécutions, sans une seule reprise. Les reprises redeviennent ce
   * qu'elles doivent être — un filet pour une mauvaise soirée de dés, pas un
   * espoir de rattraper un mauvais repêchage — donc ESSAIS redescend à huit.
   *
   * Deux politiques de repêchage avaient été essayées avant et ÉCARTÉES, et la
   * sonde de S64 le confirme : le meilleur rapport points par million achète
   * des joueurs à 20 points pour 0,78 M$ (30,7 victoires, 2 qualifications sur
   * 24 — la PIRE des quatre), et le meilleur chiffre brut dépense le plafond
   * sur deux vedettes puis comble au plancher. Ce qui marche n'est pas de
   * chercher la valeur — le DOM ne la porte pas, et c'est voulu — c'est de ne
   * pas signer une carte que le jeu peint en rouge.
   */
  const ESSAIS = 8;
  let po = await page.$('#playoffsBtn'), essais = 0;
  while (!po && essais < ESSAIS) {
    essais++;
    await page.click('#replayBtn');
    await saisonDunCoup('rejouée pour les séries');
    po = await page.$('#playoffsBtn');
  }
  if (!po) errors.push(`l'équipe n'a pas atteint les séries en ${ESSAIS + 1} saisons : le passage des séries n'a PAS été éprouvé`);
  else if (essais) console.log(`   séries atteintes après ${essais} saison(s) rejouée(s)`);
  if (po) {
    await po.click();
    // L'écran des séries : un match de plus dans la ronde, le tableau, puis
    // le prochain match en direct, puis tout jusqu'à la Coupe.
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 20000 });
    // LES SÉRIES DU 82-0 SE REGARDENT (oct.) : match par match ; le seul geste est « Match suivant ».
    if (!(await page.$('#hubModal .boss-eclaireur'))) errors.push('les séries ne montrent pas le rapport d\'éclaireur de l\'adversaire');
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 20000 });
    await page.click('#hubModal .hub-jour');
    await page.waitForTimeout(300);

    /*
     * LES SÉRIES SURVIVENT À UN RAFRAÎCHISSEMENT, comme la saison. Elles se
     * REJOUENT : la saison entière repart de sa graine, ce qui remet le
     * générateur là où `playSeries` l'avait pris, et la sauvegarde ne porte
     * que jusqu'où on les a REGARDÉES. Même épreuve que pour la saison — la
     * même en-tête des deux côtés d'un `reload`.
     */
    await page.waitForTimeout(200);
    const poAvant = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    const poSauve = await page.evaluate(() => {
      try {
        const d = JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif)) || '{}');
        const v = d.partie?.series;
        return { vus: v ? v.revele.reduce((a, b) => a + b, 0) : -1, lbId: d.partie?.lbId || null };
      } catch { return { vus: -1, lbId: null }; }
    });
    const lbAvant = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]').length; } catch { return -1; } });
    await page.reload({ waitUntil: 'networkidle' });
    let poRepris = true;
    try { await page.waitForSelector('#hubModal .hub-sheet', { state: 'visible', timeout: 180000 }); }
    catch { poRepris = false; }
    if (!poRepris) {
      console.log('\n✗ les séries en cours ne survivent pas à un rafraîchissement : l\'écran des séries ne rouvre pas.');
      await browser.close();
      process.exit(1);
    }
    await page.waitForTimeout(900);
    const poApres = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    if (poAvant !== poApres) errors.push(`les séries ne reprennent pas au même endroit : « ${poAvant} » puis « ${poApres} »`);
    if (poSauve.vus < 1) errors.push('la sauvegarde ne porte pas les matchs de séries révélés');
    if (!poSauve.lbId) errors.push('la sauvegarde ne porte pas l\'entrée d\'historique de la saison');
    /*
     * UNE SAISON, UNE ENTRÉE. Le bilan se redessine à chaque reprise, et
     * `saveLeaderboard` empilait une entrée neuve à chaque appel : trois
     * allers-retours laissaient trois fois la même saison dans l'historique,
     * et la Coupe se cousait sur la dernière au lieu de celle qu'on joue.
     */
    const lbApres = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]').length; } catch { return -1; } });
    if (lbApres !== lbAvant) errors.push(`le rafraîchissement a ajouté une entrée d'historique : ${lbAvant} puis ${lbApres}`);
    else console.log(`   reprise des séries : ${poApres} — ${poSauve.vus} match(s) révélé(s), ${lbApres} entrée(s) d'historique`);

    await aller('classement');
    const noeuds = await page.$$eval('#hubModal .bk-serie', l => l.length);
    await aller('match');
    await page.waitForTimeout(200);
    const regarder = await page.$('#hubModal .hub-regarder');
    let xe = 'pas de match à regarder';
    if (regarder) {
      await regarder.click();
      await page.waitForSelector('#liveModal .live-pause', { timeout: 20000 });
      await finirDirect();
      const fil = await page.$eval('#liveModal .live-feed', e => e.textContent);
      xe = (fil.match(/\(\d+(?:er|e) but\)/) || ['aucun but'])[0];
      await page.click('#liveModal .live-suite');
      await page.waitForTimeout(150);
      await memesButs('séries, le match vu en direct');
    }
    await finirSeries();
    await page.waitForSelector('#hubModal .hub-suite', { timeout: 10000 });
    await page.click('#hubModal .hub-suite');
    await page.waitForSelector('#playoffsSection .bk-serie', { timeout: 10000 });
    const series = await page.$$eval('#playoffsSection .bk-serie', l => l.length);
    console.log(`   séries : ${noeuds} nœuds au tableau en cours, ${xe}, ${series} séries au tableau final`);
    if (!series) errors.push('séries : aucun tableau final');
    // Les rondes pas encore nées (S79) s'y dessinent « à venir » : le tableau en cours a ses quinze places.
    if (!noeuds) errors.push('séries : le tableau en cours ne se dessine pas');

    /*
     * LA COUPE ENTRE DANS L'HISTORIQUE. `saveLeaderboard` n'était appelé qu'au
     * bilan de la SAISON, donc avant la première série, et rien ne réécrivait
     * l'entrée : le seul but du jeu n'était enregistré nulle part. On lit
     * l'entrée du dessus, qui est celle qu'on vient de jouer.
     */
    const po2 = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]')[0] || null; }
      catch { return null; }
    });
    if (!po2 || !po2.series) errors.push('les séries ne sont pas enregistrées dans l\'historique');
    else if (!Number.isFinite(po2.series.V) || !po2.series.rondes) errors.push(`le verdict des séries est incomplet : ${JSON.stringify(po2.series)}`);
    else console.log(`   historique : ${po2.series.coupe ? '🏆 Coupe' : po2.series.ronde} · séries ${po2.series.V}-${po2.series.D} · format ${po2.mode}`);
    // Et l'écran de l'historique le montre, avec le compte des Coupes en tête.
    await aller('historique');
    await page.waitForSelector('#pageHistorique:not([hidden])', { timeout: 10000 });
    const tete = ((await page.textContent('#leaderboardBody .lb-tete')) || '').replace(/\s+/g, ' ').trim();
    if (!/Coupe/.test(tete)) errors.push(`l'historique ne dit pas les Coupes : « ${tete} »`);
    else console.log(`   l'historique en tête : ${tete}`);
    // LA BARRE NE PERD RIEN (S67) : les Joueurs restent là ; le vestiaire fini, ils montrent l'effectif en tableau (V7).
    if (!(await page.$('#navbar .navtab[data-section="joueurs"]'))) errors.push("la barre a perdu l'onglet des joueurs une fois la saison jouée");
    await aller('joueurs');
    await page.waitForTimeout(250);
    if (!(await page.$('#pageJoueurs:not([hidden]) .jr-table tbody tr'))) errors.push('les Joueurs ne montrent pas le tableau de l\'effectif une fois la saison jouée');
    await aller('match');
    await page.waitForTimeout(250);
  }

  // Rejouer la saison : même alignement, mêmes clubs, d'autres dés.
  await page.click('#replayBtn');
  await saisonDunCoup('rejouée');
  console.log(`   rejouée : fiche ${(await page.textContent('.result .score')).trim()}`);

  // L'historique garde l'alignement : « Reprendre l'alignement » relit les 23 joueurs et
  // repart une saison.
  await aller('historique');
  await page.waitForSelector('#pageHistorique:not([hidden])', { timeout: 10000 });
  const entrees = await page.$$('.lb-replay');
  console.log(`   historique : ${entrees.length} alignements rejouables`);
  if (entrees.length) {
    await entrees[0].click();
    await saisonDunCoup('historique');
    console.log(`   reprise de l'historique : fiche ${(await page.textContent('.result .score')).trim()}`);
  }
}

/* Le tirage LOTO : trois clubs par case, des relances. Il vit maintenant dans
   l'écran « Nouvelle partie », et RIEN ne s'applique avant le clic sur le pied
   — c'est tout l'objet de l'écran, et c'est ce que ce passage vérifie. */
await nouvelleSaison();
await page.waitForSelector('#partieModal .seg[data-opt="tirage"]', { state: 'visible', timeout: 10000 });
await page.click('#partieModal .seg[data-opt="tirage"] button[data-val="LOTO"]');
const armeLoto = await page.$eval('#partieModal .seg[data-opt="tirage"] button[data-val="LOTO"]', b => b.classList.contains('on'));
if (!armeLoto) errors.push('le tirage « Loto » ne se marque pas dans l\'écran Nouvelle partie');
await page.click('#npGo');
await sansIdentite();
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 30000 });
await page.waitForSelector('#rrL', { timeout: 30000 });
if (await page.$('.spin-identite')) errors.push('la roulette du 82-0 porte une identité');

/*
 * LE ✕ N'EST PAS UNE RELANCE. Deux exploits d'une même formule, éprouvés ici
 * sur un alignement vide, avant que l'auto-draft le remplisse.
 *
 *   (1) Signer fait tourner la roulette ; retirer rendait la masse salariale
 *       en GARDANT le vestiaire neuf. « Signer le moins cher puis ✕ » était
 *       donc un « Passer » gratuit et illimité. La signature suivante repaie
 *       maintenant le tour au lieu de faire tourner la roulette.
 *   (2) Le rang de la main comptait les joueurs SIGNÉS : vider une case le
 *       faisait remonter, et le club retendait le joueur qu'on venait de
 *       retirer — le même exploit que le déplacement de trio, rouvert par le
 *       ✕. C'est ce que teste le retour du nom : il ne doit PAS revenir.
 *
 * Le premier jet de ce garde-fou comparait la main avant et après sans viser
 * la même case, et passait donc exploit ouvert ou non : signer déplace la
 * main à la case suivante, et la roulette avait tourné entre les deux.
 */
{
  // LES NOMS SEULS. Le texte entier d'une carte porte aussi sa case de
  // destination (« 1er trio · AG » contre « 2e trio · AG ») : deux mains
  // identiques s'y liraient toujours différentes.
  const mainNoms = async () => (await page.$$eval('.pcard .pcard-name', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | ');
  // `.pb-team` — le premier jet lisait `.pcard-team`, qui n'existe pas : les
  // deux lectures valaient la chaîne vide, donc « la roulette n'a pas tourné »
  // était vrai par construction. Un sélecteur qui ne matche rien est un test
  // qui passe toujours.
  const clubs = () => page.$$eval('.pcard .pb-team', els => els.map(e => e.textContent.trim()).join('~'));
  const carte = await page.$('.pcard:has(.btn-sign:not([disabled]))');
  if (!carte) { errors.push('aucun joueur signable pour éprouver le ✕'); }
  else {
    const nom = (await carte.$eval('.pcard-name', e => e.textContent.replace(/\s+/g, ' ').trim())).toUpperCase();
    await carte.$eval('.btn-sign', b => b.click());
    await page.waitForTimeout(400);
    const clubsApresSignature = await clubs();

    await aller('alignement');
    await page.waitForTimeout(220);
    const retirer = await page.$('.slot .slot-remove');
    if (!retirer) errors.push('aucune case remplie à retirer pour éprouver le ✕');
    else {
      await retirer.evaluate(el => el.click());
      await page.waitForTimeout(350);
      if (await lireSignes() !== 0) errors.push('le ✕ n\'a pas vidé la case');

      // On revise la MÊME case : signer avait déplacé la main à la suivante.
      const vide = await page.$('.slot');
      if (vide) { await vide.evaluate(el => el.click()); await page.waitForTimeout(350); }
      await aller('repechage');
      await page.waitForTimeout(250);

      /*
       * COMMENT ON LIT L'ÉCHELLE SANS POUVOIR LA LIRE. Le rang n'est nulle
       * part dans le DOM, et regarder si le joueur retiré revient ne dit rien :
       * la roulette avait tourné à la signature, donc son club n'est plus là.
       * Mais deux cases de MÊME poste et de rang différent, elles, se
       * comparent — la case du 1er trio a vu son échelle descendre d'un cran,
       * donc elle doit maintenant offrir EXACTEMENT ce qu'offre la case du 2e
       * trio. Sans le plancher, la première retend des numéros un pendant que
       * la seconde tend des numéros deux.
       */
      const cases = await page.$$('.slot');
      const mainDe = async (n) => {
        await aller('alignement');
        await page.waitForTimeout(200);
        await (await page.$$('.slot'))[n].evaluate(el => el.click());
        await page.waitForTimeout(320);
        await aller('repechage');
        await page.waitForTimeout(220);
        return mainNoms();
      };
      if (cases.length > 3) {
        const premier = await mainDe(0);   // AG du 1er trio, échelle descendue à 1
        const second = await mainDe(3);    // AG du 2e trio, rang 1 par nature
        if (premier !== second) errors.push(`le ✕ fait remonter l'échelle : la case du 1er trio offre « ${premier.slice(0, 60)} » quand celle du 2e offre « ${second.slice(0, 60)} »`);
        else console.log(`   le ✕ éprouvé : après avoir signé puis retiré un ${nom.split(' ')[0] ? 'ailier' : 'joueur'}, la case du 1er trio offre la même main que celle du 2e — l'échelle ne remonte pas`);
      }

      // Et la signature qui repaie la dette ne fait pas tourner la roulette.
      const b2 = await page.$('.pcard .btn-sign:not([disabled])');
      if (b2) {
        await b2.click();
        await page.waitForTimeout(400);
        if ((await clubs()) !== clubsApresSignature) errors.push('la signature qui repaie la dette a fait tourner la roulette');
        else console.log('   la signature suivante repaie le tour : la roulette ne tourne pas');
        await aller('alignement');
        await page.waitForTimeout(220);
        const r = await page.$('.slot .slot-remove');
        if (r) { await r.evaluate(el => el.click()); await page.waitForTimeout(320); }
        await aller('repechage');
        await page.waitForTimeout(220);
      }
    }
  }
}

/*
 * RANGER NE RECOMPOSE PAS LA MAIN (S71). JP : *pas reseed si joueur déplacé
 * dans la sélection des joueurs*. On signe un ailier au 3e trio (en visant sa
 * case), on lit la main de la première case vide — l'ailier gauche du 1er
 * trio —, puis on DÉPLACE l'ailier signé dans cette case-là : la main ne
 * doit pas changer d'un nom.
 */
{
  const nomsMain = async () => (await page.$$eval('.pcard .pcard-name', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | ');
  const cases = async () => { await aller('alignement'); await page.waitForTimeout(220); return page.$$('.slot'); };
  let s = await cases();
  if (s.length > 6) {
    await s[6].evaluate(el => el.click());
    await page.waitForTimeout(300);
    await aller('repechage');
    await page.waitForTimeout(250);
    const b = await page.$('.pcard .btn-sign:not([disabled])');
    if (!b) errors.push('aucun joueur signable pour éprouver le rangement');
    else {
      await b.click();
      await page.waitForTimeout(400);
      const avant = await nomsMain();
      s = await cases();
      await s[6].evaluate(el => el.click());
      await page.waitForTimeout(150);
      s = await page.$$('.slot');
      await s[0].evaluate(el => el.click());
      await page.waitForTimeout(300);
      await aller('repechage');
      await page.waitForTimeout(250);
      const apres = await nomsMain();
      if (!avant) errors.push('la main était vide avant le rangement');
      else if (avant !== apres) errors.push(`ranger un joueur recompose la main : « ${avant.slice(0, 60)} » puis « ${apres.slice(0, 60)} »`);
      else console.log(`   ranger ne recompose pas la main : un ailier déplacé au 1er trio, la même main de ${avant.split(' | ').length} joueurs`);
      await cases();
      const r = await page.$('.slot .slot-remove');
      if (r) { await r.evaluate(el => el.click()); await page.waitForTimeout(320); }
      await aller('repechage');
      await page.waitForTimeout(220);
    }
  }
}

const { signed: lotoSigned } = await drafter('loto');
console.log(`5. loto : ${lotoSigned}/23 signés, relances restantes : ${(await page.textContent('#rrL .rr-count')).trim()}`);
await page.screenshot({ path: 'scripts/smoke-loto.png', fullPage: false });

/*
 * LE FORMAT EXPRESS, que rien ne couvrait. Six cases — un trio, une paire, un
 * partant — sous 34 M$, et le reste de l'alignement fourni par une vraie
 * équipe tirée au hasard, hors plafond et non modifiable. C'est un chemin de
 * code entier (`casesDuMode`, `G.renfort`, le plafond qui change) qui n'avait
 * aucun test : le compteur, la roulette, le renfort et la simulation.
 */
await nouvelleSaison();
await page.waitForSelector('#partieModal .seg[data-opt="format"]', { state: 'visible', timeout: 10000 });
await page.click('#partieModal .seg[data-opt="format"] button[data-val="EXPRESS"]');
await page.click('#partieModal .seg[data-opt="tirage"] button[data-val="VESTIAIRE"]');
await page.click('#npGo');
await sansIdentite();
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 30000 });
await page.waitForTimeout(400);
const expTotal = await lireTotal();
if (expTotal !== 6) errors.push(`l'Express devrait offrir six cases, le compteur en annonce ${expTotal}`);
const expCap = parseM(await page.textContent('#capAmt'));
if (expCap > 40) errors.push(`le plafond de l'Express devrait être sous 34 M$, la jauge annonce ${expCap}`);
// LA MÊME JAUGE PARTOUT (V2.2) : le maximum affiché et le « % du plafond » d'une carte se lisent sur 34 M$, pas sur 95,5.
{
  const max = parseM(await page.textContent('#capMaxLbl'));
  if (Math.abs(max - 34) > 0.6) errors.push(`la jauge de l'Express se lit sur ${max} M$ au lieu de 34`);
  const pct = await page.$$eval('.pcard', cs => cs.map(c => (c.textContent.match(/(\d+,\d) % du plafond/) || [])[1]).filter(Boolean)[0] || null).catch(() => null);
  console.log(`   la jauge de l'Express : / ${max} M$${pct ? ` · une carte : ${pct} % du plafond` : ''}`);
}
const { signed: expSigned } = await drafter('express');
// Les dix-sept autres cases viennent du renfort : l'alignement doit être
// COMPLET même si le joueur n'en a comblé que six.
const expRemplies = await page.$$eval('.slot', els => els.filter(e => !e.classList.contains('empty')).length);
const expPret = await page.$eval('#mainBtn', b => !b.disabled);
console.log(`6. express : ${expSigned}/${expTotal} signés sous ${expCap.toFixed(1)} M$, `
  + `${expRemplies} cases remplies avec le renfort, bouton prêt : ${expPret}`);
if (expSigned < 6) errors.push(`l'Express n'a comblé que ${expSigned} cases sur six`);
if (expRemplies < 23) errors.push(`le renfort de l'Express ne remplit que ${expRemplies} cases sur 23`);
if (!expPret) errors.push('l\'Express ne débloque pas le bouton de simulation');
await sansDebordement('express');

if (actionsLNH) errors.push(`la version Web a demandé ${actionsLNH} photo(s) d'action à la LNH (elles viennent de img/actions)`);

console.log(`   la glace du direct : ${glaceDuDirect} point(s) posé(s) au dernier match regardé`);
console.log(`7. erreurs console : ${errors.length} (ressources externes non chargées : ${netErrors})`);
for (const e of errors) console.log('   ', e);
await browser.close();
process.exit((errors.length || signed < 23 || lotoSigned < 23 || expSigned < 6) ? 1 : 0);
