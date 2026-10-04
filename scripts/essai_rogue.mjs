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
const BUREAU = '#hubModal :is(.hub-jour, .hub-traiter)';
/*
 * LA BOUTIQUE ET « TES CARTES » VIVENT AU MARCHÉ (1.0, oct.). JP : *je veux RIEN de la boutique dans club/accueil*.
 * Une décision prise de la boutique ou de « Tes cartes » rejoue la saison en coulisse et rouvre la même page DANS le
 * Marché. Pour retrouver le bureau, on touche « Club » dans la barre.
 */
const auBureau = async (timeout = 120000) => {
  await page.waitForFunction(() => document.querySelector('#hubModal .hub-jour, #hubModal .hub-traiter'), null, { timeout });
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.body.dataset.section !== 'club')) { await page.click('#navbar .navtab[data-section="club"]').catch(() => {}); await page.waitForTimeout(250); }
  await page.waitForSelector(BUREAU, { timeout });
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
/* Le Club (le bureau, la Boîte) ne dit jamais « boutique » et n'offre rien à acheter. */
const verifClubSansBoutique = async etape => {
  const r = await page.evaluate(() => {
    const hub = document.getElementById('hubModal');
    const t = hub ? hub.innerText : '';
    return { mots: (t.match(/boutique|🛒|scell/gi) || []), tuiles: hub ? hub.querySelectorAll('.pk-tuile, .pk-fiche, [data-genre="boutique"]').length : 0 };
  });
  if (r.mots.length || r.tuiles) erreurs.push(`${etape} : le Club parle de boutique (${r.mots.join(', ')}) ou en rend (${r.tuiles})`);
};
const versMarche = async quoi => {
  await page.click('#navbar .navtab[data-section="marche"]');
  await page.waitForTimeout(150);
  // La page ouverte reste ouverte au Marché (un achat la rouvre) : déjà là, ou on revient à la liste d'abord.
  if (await page.$(`#pageMarcheCorps .hub-page[data-genre="${quoi}"]`)) return;
  if (await page.$('#pageMarcheCorps .hub-page-retour')) await page.click('#pageMarcheCorps .hub-page-retour');
  await page.waitForSelector(`#pageMarcheCorps [data-marche="${quoi}"]`, { timeout: 10000 });
  await page.click(`#pageMarcheCorps [data-marche="${quoi}"]`);
};
const erreurs = [];
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
  localStorage.setItem('cap82_cartable', JSON.stringify({ v: 1, migre: true, hist: true, joueurs: Object.fromEntries(cartes.map((k, i) => [k, { v: i === 0 ? { rare: 1 } : { commune: 1 }, n: 1 }])) }));
  localStorage.setItem('cap82_rogue', JSON.stringify({ ecussons: 400, deblocages: ['banc1'], collection: [], cartes: [], runs: 0, jalons: {} }));
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
 * TON COACH (v2, js/coachs.js) : trois coachs, un à prendre — sa confiance I
 * est allumée dès le premier soir (une décision du jour 0).
 */
await page.waitForFunction(() => /Ton coach/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
const offerts = await page.$$eval('#choixModal .choix-option', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
await page.screenshot({ path: `${DOSSIER}/rogue-coach.png` });
console.log(`0. ton coach : ${offerts.length} offerts · ${offerts.map(t => t.slice(0, 40)).join(' | ')}`);
if (offerts.length !== 3 || !offerts.every(t => /Confiance I/.test(t))) erreurs.push(`le choix du coach offre ${offerts.length} coach(s), ou ne dit pas sa confiance I`);
await choix();
/*
 * LE DÉPART DU CLASSEUR (S80, js/depart.js) : sans déblocage, une carte du
 * cartable tirée au hasard. On la voit, on touche sa carte (sa fiche), on la
 * prend, on commence.
 */
await page.waitForSelector('#departModal:not([hidden]) .dp-carte', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-depart-classeur.png` });
const tiree = await page.$$eval('#departModal .dp-carte', e => e.map(x => x.dataset.cle));
const entete = (await page.textContent('#departModal .choix-irl')).trim();
await page.click('#departModal .dp-voir');
await page.waitForTimeout(500);
const ficheClasseur = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
if (!ficheClasseur) erreurs.push('toucher une carte du classeur n\'ouvre pas sa fiche');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('#departModal .dp-prendre:not([disabled])');
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
const des = [], evenementsDe = [];   // les dés lancés pendant la run, et les événements qui les ont demandés
async function regler() {
  for (let i = 0; i < 30; i++) {
    // Le sommaire de la journée est une page du Club (1.0, R3) : « Retour au bureau ».
    if (await page.$('#hubModal .hub-page[data-genre="sommaire"]')) { await page.click('#hubModal .hub-page[data-genre="sommaire"] .hub-page-fermer'); await page.waitForTimeout(250); continue; }
    // Une récompense arrive en paquet scellé (S77) : on le déchire, puis on montre tout.
    const pq = await page.$('#choixModal:not([hidden]) .paquet');
    if (pq && await pq.isVisible()) {
      await page.click('#choixModal .paquet', { force: true }); await page.waitForTimeout(300);
      await page.click('#choixModal .choix-tete').catch(() => {});
      await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {});
      continue;
    }
    if (await page.$('#choixModal:not([hidden]) .main-jouer')) { await page.click('#choixModal .main-jouer'); await page.waitForTimeout(1500); continue; }
    // Une main de palier (des cartes .tc) : la première carte jouable.
    const carte = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc:not([disabled])');
    if (carte) { await carte.click(); await page.waitForTimeout(500); continue; }
    // Un joueur offert (S78) : « Signer », puis « qui sort ? » — dans l'alignement (S80) : une case, puis « Confirmer ».
    if (await page.$('#choixModal:not([hidden]) .tcj-signer')) { await page.click('#choixModal:not([hidden]) .tcj-signer'); await page.waitForTimeout(400); continue; }
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-confirmer')) {
      await page.click('#choixModal .aln-case[data-aln]:not([disabled])'); await page.click('#choixModal .aln-confirmer'); await page.waitForTimeout(600); continue;
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
    if (await page.$('#choixModal:not([hidden]) button.choix-option:not([disabled])')) { await choix('button.choix-option:not([disabled])'); continue; }
    const t = await page.$('#hubModal .hub-traiter');
    // Le message plié, ou rangé sous le sous-onglet Boîte du téléphone (1.0, R2) : « À régler » l'ouvre et y mène.
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
await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
await regler();
// LE MANDAT DU PROPRIO (S80) : le hub dit la saison de la run et ce que le proprio veut — sous le sous-onglet Saison du Club (1.0, R2).
const versSaison = await page.$('#sousNav:not([hidden]) .soustab[data-page="saison"]');
if (versSaison) { await versSaison.click(); await page.waitForTimeout(300); }
const run = await page.textContent('#hubModal .hub-etat-run').catch(() => '');
console.log(`5. le hub : ${(run || '(pas de ligne de run)').replace(/\s+/g, ' ').trim()}`);
{
  const coachs = ((await page.textContent('#hubModal .hub-etat-coachs').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const sv0 = await lireSauvegarde();
  const d0 = ((sv0.partie || {}).decisions || []).find(x => x.jour === 0 && x.coach);
  console.log(`5c. tes coachs : ${coachs || '(absent)'} · décision du jour 0 : ${d0 ? `${d0.coach.nom} ${JSON.stringify(d0.coachsDeBase)}` : '(aucune)'}`);
  if (!d0 || d0.coach.palier !== 1) erreurs.push('le coach de la run n\'allume pas sa confiance I au jour 0');
  if (!/ I\b/.test(coachs)) erreurs.push('le bureau ne dit pas le coach de la run et sa confiance');
}
if (!/proprio veut/.test(run || '')) erreurs.push('le hub ne dit pas le mandat du proprio');
// 1.0 (R4) : le barème des jetons est écrit au hub, et ses chiffres sont ceux de la run (jamais tapés).
{
  const bareme = (await page.textContent('#hubModal .hub-run-bareme').catch(() => '')) || '';
  const svB = await lireSauvegarde();
  const B = (svB.partie && svB.partie.rogue && svB.partie.rogue.bareme) || (svB.rogue && svB.rogue.bareme) || null;
  const lu = [...bareme.matchAll(/(\d+)/g)].map(m => Number(m[1]));
  const attendu = B ? [B.victoire, B.prolongation, B.defaite, B.grosMatch, B.objectif, B.serie] : null;
  console.log(`5b. le barème au hub : ${bareme.replace(/\s+/g, ' ').trim() || '(absent)'} · attendu ${attendu ? attendu.join('/') : '?'}`);
  if (!bareme) erreurs.push('le hub n\'écrit pas le barème des jetons de la run');
  else if (attendu && lu.join(',') !== attendu.join(',')) erreurs.push(`le barème au hub (${lu.join('/')}) n'est pas celui de la run (${attendu.join('/')})`);
  if (!/puis :/.test(run || '')) erreurs.push('le mandat au hub ne dit pas sa suite (« puis : … »)');
  if (versSaison) { await page.click('#sousNav .soustab[data-page="match"]'); await page.waitForTimeout(200); }
}
/*
 * « JUSQU'À LA PROCHAINE DÉCISION » (S79) remplace « +10 jours » : elle joue
 * les journées une à une et s'arrête sur ce qui demande le joueur. On attend
 * qu'elle ait fini (le bouton se réactive).
 */
async function prochaineDecision() {
  const p = await page.$('#hubModal .hub-prochaine');
  if (!p || !(await p.isVisible()) || await p.isDisabled()) return false;
  await p.click();
  await page.waitForFunction(() => !document.querySelector('#hubModal .hub-prochaine[disabled]'), null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(300);
  return true;
}
// Avancer un peu pour gagner des jetons
for (let i = 0; i < 3; i++) {
  await regler();
  await prochaineDecision();
}
await regler();
await page.click('#navbar .navtab[data-section="marche"]'); await page.waitForTimeout(200);
const avant = (await page.textContent('#pageMarcheCorps [data-marche="boutique"]')).replace(/\s+/g, ' ').trim();
await page.click('#navbar .navtab[data-section="club"]'); await page.waitForTimeout(200);
const jauge = async () => (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`6. au hub : la boutique dit « ${avant} » · barre : ${await jauge()}`);
if (!/Plafond restant/.test(await jauge())) erreurs.push('la barre du Rogue ne montre pas le plafond');
/*
 * LA BOUTIQUE (S79, js/magasin.js) : des rayons de packs à la HUT, chacun avec
 * sa fiche (ses chances par pack, le barème d'une carte, l'espace sous le
 * plafond), puis l'ouverture.
 */
const decisions = async () => ((await lireSauvegarde()).partie || {}).decisions || [];
// LE WALKOUT (1.0, oct.) : un pack qui cache une holo, une or ou un Phénomène l'annonce en trois temps avant les cartes.
let walkouts = 0;
const dechirer = async () => {
  const paquet = await page.waitForSelector('#choixModal:not([hidden]) .paquet', { timeout: 60000 }).catch(() => null);
  if (paquet) { await page.click('#choixModal .paquet', { force: true });
    if (await page.waitForSelector('#choixModal .walkout[data-pas="3"]', { timeout: 2600 }).catch(() => null)) { if (!walkouts++) { await page.waitForTimeout(350); await page.screenshot({ path: `${DOSSIER}/rogue-walkout.png` }); } }
    await page.waitForTimeout(300); await page.click('#choixModal .choix-tete').catch(() => {}); await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {}); }
  await page.waitForTimeout(600);
};
const acheter = async (pack, capture) => {
  await versMarche('boutique');
  await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
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
  if (!ok) { await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-retour'); await page.click('#pageMarche .hub-page-retour'); return false; }
  await ok.click();
  await dechirer();
  return true;
};
await versMarche('boutique');
await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
await verifMarche('la boutique ouverte');
await page.screenshot({ path: `${DOSSIER}/rogue-boutique.png` });
const nPacks = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', e => e.length);
const espace = await page.textContent('#pageMarche .hub-page[data-genre="boutique"] .pk-plafond').catch(() => '');
// 1.0 (R5) : à la première run, quatre packs pour commencer, un bouton « Voir les N packs », et un pack impayable qui dit ce qui manque.
const voirTout = await page.$('#pageMarche .hub-page[data-genre="boutique"] .pk-tout');
console.log(`7. la boutique : ${nPacks} packs · ${(espace || '(pas de plafond)').replace(/\s+/g, ' ').trim()}${voirTout ? ` · « ${(await voirTout.textContent()).trim()} »` : ''}`);
if (!espace) erreurs.push('la boutique ne dit pas l\'espace sous le plafond');
if (nPacks !== 4 || !voirTout) erreurs.push(`la première run devrait ouvrir sur quatre packs et « Voir les N packs » : ${nPacks} packs, bouton ${voirTout ? 'présent' : 'absent'}`);
else {
  await page.screenshot({ path: `${DOSSIER}/rogue-boutique-debut.png` });
  await voirTout.click(); await page.waitForTimeout(300);
  const nTout = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', e => e.length);
  const chers = await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile.pk-cher .pk-manque', e => e.map(x => x.textContent.trim()));
  // Un pack coûte plus que la caisse ? Alors sa tuile doit le dire. (À 84 🪙, aucun pack n'est impayable : rien à exiger.)
  const jetonsB = Number(((await page.textContent('#pageMarche .hub-page[data-genre="boutique"] .choix-irl')) || '').replace(/\D+/g, ' ').trim().split(' ')[0]) || 0;
  const prixMax = Math.max(...await page.$$eval('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile:not(.verrou) .pk-prix', e => e.map(x => Number((x.textContent.match(/(\d+)\s*🪙/) || [])[1]) || 0)));
  console.log(`7b. tout : ${nTout} packs · caisse ${jetonsB} 🪙, le plus cher ${prixMax} 🪙 · ${chers.length} impayable(s) (${chers.slice(0, 2).join(' · ')})`);
  if (nTout < 20) erreurs.push(`« Voir les N packs » ne montre que ${nTout} packs`);
  if (prixMax > jetonsB && (!chers.length || !chers.every(t => /il te manque \d+/.test(t)))) erreurs.push('un pack impayable ne dit pas ce qui manque');
  // Échap ferme la boutique (1.0, R5) ; on la rouvre pour continuer comme avant.
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (await page.$('#pageMarche .hub-page[data-genre="boutique"]')) erreurs.push('Échap ne ferme pas la boutique');
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
  await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-rayon-club [data-onglet="nom"]');
  await page.waitForTimeout(300);
  await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-club="nom:harfangs"]');
  await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche .club-porte');
  await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-fiche .pk-acheter');
  await page.waitForTimeout(1500);
  await auBureau();
  const mc = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}').club || {});
  const tete = await page.textContent('.tete-nom');
  await versMarche('boutique'); await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
  const apresJ = Number(((await page.textContent('#pageMarche .hub-page[data-genre="boutique"] .choix-irl')) || '').replace(/\D+/g, ' ').trim().split(' ')[0]) || 0;
  console.log(`7c. ton club à la boutique : les Harfangs · ${avantJ} → ${apresJ} 🪙 · porté : ${mc.nom} · en-tête « ${tete} »`);
  if (mc.nom !== 'harfangs' || tete !== 'Harfangs' || apresJ !== avantJ - 15) erreurs.push(`les Harfangs achetés à la boutique (${avantJ} → ${apresJ} 🪙, méta ${mc.nom}, en-tête « ${tete} »)`);
}
await page.click('#pageMarche .hub-page-retour');
/*
 * S80 : LE JOUEUR D'UNE CARTE. La fiche d'un pack par niveau dit ses chances
 * de joueur par pack (★ Étoile ou mieux, ★ Phénomène) et le niveau d'une
 * carte (cinq rangées, un rang réel chacune). Capturée aussi dépliée : au
 * téléphone, la fiche défile.
 */
const NOMS_NIVEAUX = ['Soutien', 'Régulier', 'Pilier', 'Étoile', 'Phénomène'];
await versMarche('boutique');
await page.waitForSelector('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile', { timeout: 30000 });
await page.click('#pageMarche .hub-page[data-genre="boutique"] .pk-tuile[data-pack="j:hasard_bronze"]');
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
await page.click('#pageMarche .hub-page-retour');
await acheter('j:hasard_argent', 'rogue-pack-fiche');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-pack.png` });
const offres = await page.$$eval('#choixModal .choix-option.tc', e => e.map(x => (x.querySelector('.tc-nom, .carton-nom .lname, .cj-mini-carte .pcard-full-name') || x).textContent.replace(/\s+/g, ' ').trim()));
// S80 : chaque carte dit son niveau UNE fois — sur son ruban (★ Étoile, ★ Phénomène) ou en un mot sous la carte, jamais les deux.
const niveaux = await page.$$eval('#choixModal .choix-option.tc', (e, noms) => e.map(x => {
  const ruban = (x.querySelector('.cj-ruban') || {}).textContent || '';
  const mot = ((x.querySelector('.tc-quoi') || {}).textContent || '').split('\n')[0].trim();
  return { ruban, mot, fois: noms.filter(n => ruban.includes(n)).length + noms.filter(n => mot === n).length };
}), NOMS_NIVEAUX);
if (niveaux.some(x => x.fois !== 1)) erreurs.push(`le niveau d'une carte ouverte n'est pas dit une fois : ${JSON.stringify(niveaux)}`);
console.log(`8. le pack Argent : ${offres.map((o, i) => `${o} (${NOMS_NIVEAUX.includes(niveaux[i].mot) ? niveaux[i].mot : niveaux[i].ruban})`).join(' · ')}`);
// Toucher la carte montre sa fiche, sans la prendre (S78) ; « Signer » la prend, puis on choisit qui sort.
await page.click('#choixModal:not([hidden]) .choix-option.tc .tcj-carte');
await page.waitForTimeout(600);
const fiche = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
const encore = !!(await page.$('#choixModal:not([hidden]) .tcj-signer'));
if (!fiche || !encore) erreurs.push(`toucher la carte : fiche ${fiche}, choix toujours ouvert ${encore}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
// Le nom du joueur qu'on signe : il doit être dans l'alignement tout de suite (S79).
const nomSigne = await page.$eval('#choixModal:not([hidden]) .choix-option.tc:not([aria-disabled="true"])', x => (x.querySelector('.carton-nom .lname, .pcard-full-name') || x).textContent.replace(/\s+/g, ' ').trim());
await page.click('#choixModal:not([hidden]) .choix-option.tc:not([aria-disabled="true"]) .tcj-signer');
/*
 * UNE CASE DE RÉSERVE LIBRE (S80, le Rogue) : avant « qui sort ? », le choix
 * d'y entrer sans que personne sorte. L'essai vérifie qu'elle est OFFERTE,
 * puis choisit « quelqu'un sort » pour éprouver le choix dans l'alignement.
 *
 * QUI SORT, DANS L'ALIGNEMENT (S80). JP : *le screen de choix pour les
 * upgrades et les remplacements sont à chier* ; *dire que x est sur la
 * xième ligne*. Les neuf rangées titrées par ce qu'elles sont ; toucher une
 * case la surligne et la barre dit ce qui va se passer (la ligne de celui
 * qui sort) ; rien ne part avant « Confirmer ».
 */
// QUI SORT, DANS L'ALIGNEMENT (1.0, oct.) : la case de réserve libre y est une case (« personne ne sort »), puis « Où joue X ? ».
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-case', { timeout: 10000 });
await page.waitForTimeout(300);
const titre = (await page.textContent('#choixModal .choix-titre')).trim();
const libreOfferte = await page.$$eval('#choixModal .aln-case[data-aln]:not([disabled]) .aln-nom', e => e.some(x => x.textContent.trim() === 'Case libre'));
const rangees = await page.$$eval('#choixModal .aln-titre', e => e.map(x => (x.firstChild ? x.firstChild.textContent : x.textContent).trim()));
if (rangees.join('|') !== '1er trio|2e trio|3e trio|4e trio|1re paire|2e paire|3e paire|Gardiens|Réserve') erreurs.push(`« qui sort ? » : rangées ${rangees.join(' · ')}`);
const refusees = await page.$$eval('#choixModal .aln-case[data-aln][disabled]', e => e.length);
// Un joueur qui sort (pas la case libre) : c'est le chemin qui retire quelqu'un.
await page.$$eval('#choixModal .aln-case[data-aln]:not([disabled])', e => { const b = e.find(x => x.querySelector('.aln-nom').textContent.trim() !== 'Case libre'); if (b) b.click(); });
await page.waitForTimeout(250);
const barreSortie = (await page.textContent('#choixModal .aln-barre-mot')).replace(/\s+/g, ' ').trim();
if (!/sort : .+masse/.test(barreSortie)) erreurs.push(`la barre de « qui sort ? » ne dit pas ce qui va se passer : « ${barreSortie} »`);
if (!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"]'))) erreurs.push('toucher une case de « qui sort ? » a décidé sans « Continuer »');
await page.screenshot({ path: `${DOSSIER}/rogue-qui-sort.png` });
await page.click('#choixModal .aln-confirmer');
// Où joue l'arrivant : sa case, et ce qui glisse.
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-case', { timeout: 10000 });
await page.waitForTimeout(300);
await page.click('#choixModal .aln-case[data-aln]:not([disabled])');
await page.waitForTimeout(250);
const barrePlace = (await page.textContent('#choixModal .aln-barre-mot')).replace(/\s+/g, ' ').trim();
if (!/: .+masse/.test(barrePlace)) erreurs.push(`la barre de « où joue ? » ne dit pas ce qui va se passer : « ${barrePlace} »`);
console.log(`   qui sort : ${rangees.length} rangées, ${refusees} case(s) grisée(s) · « ${barreSortie} » · puis « ${barrePlace} »`);
await page.click('#choixModal .aln-confirmer');
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
  await page.click('#navbar .navtab[data-section="effectif"]').catch(() => {});
  await page.waitForTimeout(800);
  const noms = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  const nom = nomSigne.split(' ').slice(-1)[0];
  if (!noms.some(n => n.includes(nom))) erreurs.push(`${nomSigne}, signé d'un pack, n'est pas dans l'alignement`);
  else console.log(`   ${nomSigne} est dans l'alignement dès la signature`);
  await page.click('#navbar .navtab[data-section="club"]').catch(() => {});
  await page.waitForTimeout(500);
}
// Un pack Modifs (S80 : ses cartes se posent au verso), un pack de cartes : tout va dans l'inventaire ; puis un pack Contrats (la masse salariale).
await regler();
for (const pack of ['c:modifs', 'c:mixte', 'c:contrats']) {
  if (!(await acheter(pack))) { console.log(`   (pas assez de jetons pour ${pack})`); continue; }
  await page.screenshot({ path: `${DOSSIER}/rogue-${pack.slice(2)}.png` });
  await page.click('#choixModal:not([hidden]) .choix-plus-tard');
  await auBureau();
  await regler();
}
/*
 * L'INVENTAIRE (S79, js/inventaire.js) : les cartes de la saison (elles SE
 * GARDENT jusqu'au moment voulu), les permanentes, le deck, le classeur, et
 * la masse salariale. On joue une carte : une décision datée du jour.
 */
await versMarche('cartes');
await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-inventaire.png` });
const poche = await page.$$eval('#pageMarche .hub-page[data-genre="cartes"] .bq-carte', e => e.map(x => x.querySelector('.bq-nom').textContent.trim()));
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
  if (!nModifs) erreurs.push('aucune modif de joueur dans l\'inventaire (le pack Modifs en donne quatre)');
  let permis = 0, grises = 0;
  for (let k = 0; k < nModifs && !permis; k++) {
    if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
    const jouer = (await page.$$('#pageMarche .hub-page[data-genre="cartes"] .bq-joueur .inv-jouer:not([disabled])'))[k];
    if (!jouer) break;
    nomModif = await jouer.evaluate(b => (((b.closest('.bq-joueur') || b).querySelector('.bq-nom') || {}).textContent || '').trim());
    await jouer.click();
    await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-case', { timeout: 10000 });
    await page.waitForTimeout(400);
    permis = await page.$$eval('#choixModal .aln-case[data-aln]:not([disabled])', e => e.length);
    grises = await page.$$eval('#choixModal .aln-case[data-aln][disabled]', e => e.length);
    if (!permis) {
      console.log(`   « ${nomModif} » : personne ne peut la recevoir (${grises} grisés), on essaie la suivante`);
      await page.click('#choixModal:not([hidden]) .choix-fermer').catch(() => page.keyboard.press('Escape'));
      await page.waitForTimeout(500);
    }
  }
  if (nModifs && !permis) console.log('7a. aucune modif ne se pose sur cet alignement : l\'étape du verso est sautée');
  else if (nModifs) {
    await page.screenshot({ path: `${DOSSIER}/rogue-poser-alignement.png` });
    await page.click('#choixModal .aln-case[data-aln]:not([disabled])');
    await page.waitForSelector('#hockeyCardModal .fc-poser', { timeout: 10000 });
    await page.waitForTimeout(500);
    if (!(await page.$eval('#hockeyCardModal .fiche-carte', e => e.classList.contains('au-verso')))) erreurs.push('la fiche ne s\'ouvre pas au verso pour y poser la carte');
    await page.evaluate(() => document.querySelector('#hockeyCardModal .fc-cases').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${DOSSIER}/rogue-verso-poser.png` });
    const nomJoueur = (await page.textContent('#hockeyCardModal .cjv-nom')).trim();
    await page.click('#hockeyCardModal .fc-poser');
    await auBureau();
    await page.waitForTimeout(800);
    await regler();
    d = await decisions();
    posee = d.find(x => x.joue && x.mutation) || null;
    if (!posee) erreurs.push(`« ${nomModif} » n'a pas été posée`);
    console.log(`7a. « ${nomModif} » posée au verso de ${nomJoueur} (${permis} joueurs permis, ${grises} grisés) : ${JSON.stringify(posee && { joue: posee.joue.id, mutation: posee.mutation })}`);
  }
}
if (!(await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]'))) { await versMarche('cartes'); await page.waitForSelector('#pageMarche .hub-page[data-genre="cartes"] .inv-onglet', { timeout: 10000 }); }
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
if (await page.$('#pageMarche:not([hidden]) .hub-page[data-genre="cartes"]')) await page.click('#pageMarche .hub-page-retour');
d = await decisions();
console.log(`11. jouée (${essais} essai(s)) : ${JSON.stringify(d.filter(x => x.joue).map(x => ({ id: x.joue.id, champs: Object.keys(x).filter(k => !['jour', 'joue', 'sel'].includes(k)) })))} · barre : ${await jauge()}`);
// Une modif posée au verso (7a) est déjà une carte jouée : le Rogue paie moins (S80), et l'inventaire
// ne tient parfois que des modifs. L'erreur, c'est qu'AUCUNE carte n'ait pu se jouer.
if (!jouee && !d.some(x => x.joue)) erreurs.push('aucune carte de l\'inventaire n\'a pu se jouer (cinq essais)');
else if (!jouee) console.log('    (rien d\'autre que des modifs dans l\'inventaire : la modif posée au verso compte)');
// LE CARTABLE (S79) : dans la Collection (1.0, R1), à côté de tes saisons.
await page.click('#navbar .navtab[data-section="collection"]');
await page.click('#sousNav .soustab[data-page="cartable"]');
await page.waitForSelector('#pageCartable:not([hidden]) .ct-carte', { timeout: 20000 });
await page.screenshot({ path: `${DOSSIER}/rogue-cartable.png` });
console.log(`12. le cartable : ${(await page.textContent('.ct-comptes')).replace(/\s+/g, ' ').trim()} · ${await page.$$eval('[data-ct-equipe]', e => e.length)} cartes d'équipe`);
/*
 * LE VERSO GARDE LA CARTE POSÉE (S80) : la fiche du joueur, retournée, la
 * montre dans une case pleine. Puis « + Poser une amélioration » d'une fiche
 * ouverte du cartable : tes cartes qui lui vont, en cartes ; celle qu'on
 * touche revient EN ATTENTE au verso, et « Poser ici » la pose.
 */
if (posee) {
  await page.click(`[data-ct-equipe="${posee.mutation.joueur}"]`);
  await page.waitForSelector('#hockeyCardModal .fc-cases', { state: 'attached', timeout: 10000 });
  await page.click('#hockeyCardModal .fc-recto .cj-retourner');
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
    await page.click('#hockeyCardModal .fc-recto .cj-retourner');
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
  if (!(await page.$(BUREAU))) { await page.click('#navbar .navtab[data-section="club"]').catch(() => {}); }
}
await page.click('#navbar .navtab[data-section="club"]');
await page.waitForSelector(BUREAU, { timeout: 20000 });
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
// Trois onglets (1.0, oct.) : huit noms, cinquante et une couleurs, trente et un écussons — les gratuits compris.
const parOnglet = {};
for (const o of ['palette', 'ecusson', 'nom']) {
  await page.click(`#choixModal:not([hidden]) [data-onglet="${o}"]`);
  await page.waitForTimeout(400);
  parOnglet[o] = await page.$$eval('#choixModal .choix-option', e => e.length);
}
if (parOnglet.nom !== 8 || parOnglet.palette !== 51 || parOnglet.ecusson !== 31) erreurs.push(`les onglets du club : ${JSON.stringify(parOnglet)}, il faut 8, 51 et 31`);
await page.click('#choixModal:not([hidden]) .choix-option[data-choix="nom:stars"]');
await page.waitForSelector('#choixModal:not([hidden]) .club-porte', { timeout: 10000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${DOSSIER}/rogue-club.png` });
const m3 = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
const tete = await page.textContent('.tete-nom');
console.log(`18. ton club : ${nClub} noms · onglets ${JSON.stringify(parOnglet)} · porté : ${(m3.club || {}).nom} · en-tête « ${tete} » · pris : ${((m3.club || {}).pris || []).join(', ')}`);
if ((m3.club || {}).nom !== 'stars' || tete !== 'NHL Stars' || !((m3.club || {}).pris || []).includes('nom:harfangs')) erreurs.push(`le nom remis n'est pas porté (méta ${(m3.club || {}).nom}, en-tête « ${tete} »)`);
console.log(`19. walkouts : ${walkouts} pack(s) ont annoncé leur carte (saison, poste, écusson)`);
console.log(`20. dés lancés : ${des.length ? des.join(' · ') : 'aucun cette run (aucune réponse risquée choisie)'}`);
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
process.exit(erreurs.length ? 1 : 0);
