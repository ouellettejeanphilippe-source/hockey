/*
 * ESSAI DU MODE ROGUE (S77, S79) — à la main : une run du menu jusqu'au bilan :
 * la boutique à la HUT, un pack signé (qui sort, sous le plafond), un pack de
 * cartes et un pack Contrats, l'inventaire (une carte jouée), le cartable.
 *   node scripts/essai_rogue.mjs http://localhost:8000 [dossier-captures]
 */
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
const choix = async (sel = '.choix-option:not([disabled])') => { await page.waitForSelector(`#choixModal:not([hidden]) ${sel}`, { timeout: 60000 }); await page.click(`#choixModal:not([hidden]) ${sel}`); await page.waitForTimeout(300); };

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');
await page.click('.menu-mode[data-genre="rogue"] [data-menu="nouvelle"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-intro.png` });
await choix();
await page.waitForFunction(() => document.querySelectorAll('.slot .slot-name').length >= 20, null, { timeout: 90000 });
await page.waitForTimeout(800);
const equipe = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.trim()).filter(Boolean));
const barre = (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`1. plombiers : ${equipe.length} joueurs (${equipe.slice(0, 4).join(', ')}…) · barre : ${barre}`);
await page.screenshot({ path: `${DOSSIER}/rogue-plombiers.png` });
/*
 * LA BOÎTE DE RÉCEPTION (S78) : un sommaire après chaque journée jouée, et
 * des messages qui bloquent la journée tant qu'on ne les a pas réglés. On
 * règle tout comme un joueur pressé : le sommaire se ferme, un choix prend
 * sa première option, un message bloquant sa réponse par défaut.
 */
async function regler() {
  for (let i = 0; i < 30; i++) {
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"]')) { await page.click('#choixModal:not([hidden]) .choix-plus-tard'); await page.waitForTimeout(250); continue; }
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
    if (await page.$('#choixModal:not([hidden]) button.choix-option:not([disabled])')) { await choix('button.choix-option:not([disabled])'); continue; }
    const t = await page.$('#hubModal .hub-traiter');
    if (t) { const d = await page.$('#hubModal .hub-msg.bloque.ouvert [data-defaut]'); await (d || t).click(); await page.waitForTimeout(400); continue; }
    return;
  }
}
// Lancer la saison
await page.click('#mainBtn');
await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
await regler();
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
const avant = (await page.textContent('#hubModal .hub-boutique')).trim();
const jauge = async () => (await page.textContent('#capGauge')).replace(/\s+/g, ' ').trim();
console.log(`2. au hub : la boutique dit « ${avant} » · barre : ${await jauge()}`);
if (!/Plafond restant/.test(await jauge())) erreurs.push('la barre du Rogue ne montre pas le plafond');
/*
 * LA BOUTIQUE (S79, js/magasin.js) : des rayons de packs à la HUT, chacun avec
 * sa fiche (ses chances par pack, le barème d'une carte, l'espace sous le
 * plafond), puis l'ouverture.
 */
const decisions = () => page.evaluate(() => { const ix = JSON.parse(localStorage.getItem('cap82_parties')); const p = JSON.parse(localStorage.getItem(`cap82_partie_${ix.actif}`)); return p.partie.decisions || []; });
const dechirer = async () => {
  const paquet = await page.waitForSelector('#choixModal:not([hidden]) .paquet', { timeout: 60000 }).catch(() => null);
  if (paquet) { await page.click('#choixModal .paquet', { force: true }); await page.waitForTimeout(300); await page.click('#choixModal .choix-tete').catch(() => {}); await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {}); }
  await page.waitForTimeout(600);
};
const acheter = async (pack, capture) => {
  await page.click('#hubModal .hub-boutique');
  await page.waitForSelector('#magasinModal:not([hidden]) .pk-tuile', { timeout: 30000 });
  await page.click(`#magasinModal .pk-tuile[data-pack="${pack}"]`);
  await page.waitForSelector('#magasinModal .pk-fiche');
  if (capture) await page.screenshot({ path: `${DOSSIER}/${capture}.png` });
  const ok = await page.$('#magasinModal .pk-acheter:not([disabled])');
  // Pas assez de jetons : la fiche du pack se referme d'abord (« Retour »), puis la boutique — la fiche couvre le ✕.
  if (!ok) { await page.click('#magasinModal .pk-retour'); await page.click('#magasinModal .choix-fermer'); return false; }
  await ok.click();
  await dechirer();
  return true;
};
await page.click('#hubModal .hub-boutique');
await page.waitForSelector('#magasinModal:not([hidden]) .pk-tuile', { timeout: 30000 });
await page.screenshot({ path: `${DOSSIER}/rogue-boutique.png` });
const nPacks = await page.$$eval('#magasinModal .pk-tuile', e => e.length);
const espace = await page.textContent('#magasinModal .pk-plafond').catch(() => '');
await page.click('#magasinModal .choix-fermer');
console.log(`3. la boutique : ${nPacks} packs · ${(espace || '(pas de plafond)').replace(/\s+/g, ' ').trim()}`);
if (!espace) erreurs.push('la boutique ne dit pas l\'espace sous le plafond');
/*
 * S80 : LE JOUEUR D'UNE CARTE. La fiche d'un pack par niveau dit ses chances
 * de joueur par pack (★ Étoile ou mieux, ★ Phénomène) et le niveau d'une
 * carte (cinq rangées, un rang réel chacune). Capturée aussi dépliée : au
 * téléphone, la fiche défile.
 */
const NOMS_NIVEAUX = ['Soutien', 'Régulier', 'Pilier', 'Étoile', 'Phénomène'];
await page.click('#hubModal .hub-boutique');
await page.waitForSelector('#magasinModal:not([hidden]) .pk-tuile', { timeout: 30000 });
await page.click('#magasinModal .pk-tuile[data-pack="j:hasard_bronze"]');
await page.waitForSelector('#magasinModal .pk-fiche');
await page.screenshot({ path: `${DOSSIER}/rogue-fiche-bronze.png` });
const fiche3 = await page.evaluate(() => {
  const c = document.querySelector('#magasinModal .pk-fiche-carte');
  const lu = { titres: [...c.querySelectorAll('h4')].map(h => h.textContent.trim()),
    chances: [...c.querySelectorAll('.pk-chances tr.pk-niveau')].map(t => t.textContent.replace(/\s+/g, ' ').trim()),
    niveaux: [...c.querySelectorAll('.pk-niveaux tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()) };
  c.style.maxHeight = 'none';
  return lu;
});
await page.locator('#magasinModal .pk-fiche-carte').screenshot({ path: `${DOSSIER}/rogue-fiche-bronze-entiere.png` });
console.log(`3b. la fiche du Pack Bronze : ${fiche3.chances.join(' · ')} · ${fiche3.niveaux.join(' · ')}`);
if (!fiche3.titres.includes('Le joueur d\'une carte') || fiche3.niveaux.length !== 5 || !fiche3.chances.some(x => /Phénomène/.test(x))) erreurs.push(`la fiche du pack ne dit pas le joueur d'une carte : ${JSON.stringify(fiche3)}`);
await page.click('#magasinModal .pk-retour');
await page.click('#magasinModal .choix-fermer');
await acheter('j:hasard_argent', 'rogue-pack-fiche');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option.tc', { timeout: 60000 });
await page.screenshot({ path: `${DOSSIER}/rogue-pack.png` });
const offres = await page.$$eval('#choixModal .choix-option.tc', e => e.map(x => (x.querySelector('.tc-nom, .cj-mini-carte .pcard-full-name') || x).textContent.replace(/\s+/g, ' ').trim()));
// S80 : chaque carte dit son niveau UNE fois — sur son ruban (★ Étoile, ★ Phénomène) ou en un mot sous la carte, jamais les deux.
const niveaux = await page.$$eval('#choixModal .choix-option.tc', (e, noms) => e.map(x => {
  const ruban = (x.querySelector('.cj-ruban') || {}).textContent || '';
  const mot = ((x.querySelector('.tc-quoi') || {}).textContent || '').split('\n')[0].trim();
  return { ruban, mot, fois: noms.filter(n => ruban.includes(n)).length + noms.filter(n => mot === n).length };
}), NOMS_NIVEAUX);
if (niveaux.some(x => x.fois !== 1)) erreurs.push(`le niveau d'une carte ouverte n'est pas dit une fois : ${JSON.stringify(niveaux)}`);
console.log(`4. le pack Argent : ${offres.map((o, i) => `${o} (${NOMS_NIVEAUX.includes(niveaux[i].mot) ? niveaux[i].mot : niveaux[i].ruban})`).join(' · ')}`);
// Toucher la carte montre sa fiche, sans la prendre (S78) ; « Signer » la prend, puis on choisit qui sort.
await page.click('#choixModal:not([hidden]) .choix-option.tc .tcj-carte');
await page.waitForTimeout(600);
const fiche = await page.evaluate(() => { const m = document.getElementById('hockeyCardModal'); return !!m && getComputedStyle(m).display !== 'none'; });
const encore = !!(await page.$('#choixModal:not([hidden]) .tcj-signer'));
if (!fiche || !encore) erreurs.push(`toucher la carte : fiche ${fiche}, choix toujours ouvert ${encore}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
// Le nom du joueur qu'on signe : il doit être dans l'alignement tout de suite (S79).
const nomSigne = await page.$eval('#choixModal:not([hidden]) .choix-option.tc:not([aria-disabled="true"])', x => (x.querySelector('.pcard-full-name') || x).textContent.replace(/\s+/g, ' ').trim());
await page.click('#choixModal:not([hidden]) .choix-option.tc:not([aria-disabled="true"]) .tcj-signer');
/*
 * QUI SORT, DANS L'ALIGNEMENT (S80). JP : *le screen de choix pour les
 * upgrades et les remplacements sont à chier* ; *dire que x est sur la
 * xième ligne*. Les neuf rangées titrées par ce qu'elles sont ; toucher une
 * case la surligne et la barre dit ce qui va se passer (la ligne de celui
 * qui sort) ; rien ne part avant « Confirmer ».
 */
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-case', { timeout: 10000 });
await page.waitForTimeout(300);
const rangees = await page.$$eval('#choixModal .aln-titre', e => e.map(x => (x.firstChild ? x.firstChild.textContent : x.textContent).trim()));
if (rangees.join('|') !== '1er trio|2e trio|3e trio|4e trio|1re paire|2e paire|3e paire|Gardiens|Réserve') erreurs.push(`« qui sort ? » : rangées ${rangees.join(' · ')}`);
const refusees = await page.$$eval('#choixModal .aln-case[data-aln][disabled]', e => e.length);
await page.click('#choixModal .aln-case[data-aln]:not([disabled])');
await page.waitForTimeout(250);
const barreSortie = (await page.textContent('#choixModal .aln-barre-mot')).replace(/\s+/g, ' ').trim();
if (!/\(.+\) sort, .+ prend sa place/.test(barreSortie)) erreurs.push(`la barre de « qui sort ? » ne dit pas ce qui va se passer : « ${barreSortie} »`);
if (!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"]'))) erreurs.push('toucher une case de « qui sort ? » a décidé sans « Confirmer »');
await page.screenshot({ path: `${DOSSIER}/rogue-qui-sort.png` });
console.log(`   qui sort : ${rangees.length} rangées, ${refusees} case(s) grisée(s) · « ${barreSortie} »`);
await page.click('#choixModal .aln-confirmer');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
await page.waitForTimeout(800);
let d = await decisions();
const signe = d.filter(x => x.achat && x.ballottage);
console.log(`5. signé : ${JSON.stringify(signe.map(x => ({ pack: x.achat.pack, prix: x.achat.prix, entre: x.ballottage.entre, rar: x.ballottage.rar })))} · ${refusees} case(s) grisée(s) (pas sa position, ou le plafond) · barre : ${await jauge()}`);
if (!signe.length) erreurs.push('le pack de joueurs n\'a rien signé');
/*
 * LE JOUEUR SIGNÉ EST DANS L'ALIGNEMENT TOUT DE SUITE (S79). JP : *les cartes
 * que j'ouvre des packs s'ajoutent pas dans mon équipe ?*. La décision ne
 * s'appliquait qu'au matin de la journée suivante : l'écran montrait l'ancien
 * alignement jusque-là (`poserAlignementDuJour`, js/sim.js).
 */
{
  await page.click('.navtab[data-page="alignement"]').catch(() => {});
  await page.waitForTimeout(800);
  const noms = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  const nom = nomSigne.split(' ').slice(-1)[0];
  if (!noms.some(n => n.includes(nom))) erreurs.push(`${nomSigne}, signé d'un pack, n'est pas dans l'alignement`);
  else console.log(`   ${nomSigne} est dans l'alignement dès la signature`);
  await page.click('.navtab[data-page="match"]').catch(() => {});
  await page.waitForTimeout(500);
}
// Un pack Modifs (S80 : ses cartes se posent au verso), un pack de cartes : tout va dans l'inventaire ; puis un pack Contrats (la masse salariale).
await regler();
for (const pack of ['c:modifs', 'c:mixte', 'c:contrats']) {
  if (!(await acheter(pack))) { console.log(`   (pas assez de jetons pour ${pack})`); continue; }
  await page.screenshot({ path: `${DOSSIER}/rogue-${pack.slice(2)}.png` });
  await page.click('#choixModal:not([hidden]) .choix-plus-tard');
  await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
  await regler();
}
/*
 * L'INVENTAIRE (S79, js/inventaire.js) : les cartes de la saison (elles SE
 * GARDENT jusqu'au moment voulu), les permanentes, le deck, le classeur, et
 * la masse salariale. On joue une carte : une décision datée du jour.
 */
await page.click('#hubModal .hub-inventaire');
await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-inventaire.png` });
const poche = await page.$$eval('#inventaireModal .bq-carte', e => e.map(x => x.querySelector('.bq-nom').textContent.trim()));
const plafond = await page.textContent('#inventaireModal .inv-plafond').catch(() => '');
console.log(`6. inventaire : ${poche.join(' · ') || '(vide)'} · ${(plafond || '(pas de panneau)').replace(/\s+/g, ' ').trim()}`);
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
  const modif = await page.$('#inventaireModal .bq-joueur .inv-jouer:not([disabled])');
  if (!modif) erreurs.push('aucune modif de joueur dans l\'inventaire (le pack Modifs en donne quatre)');
  else {
    nomModif = await page.$eval('#inventaireModal .bq-joueur .bq-nom', e => e.textContent.trim());
    await modif.click();
    await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-case', { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DOSSIER}/rogue-poser-alignement.png` });
    const permis = await page.$$eval('#choixModal .aln-case[data-aln]:not([disabled])', e => e.length);
    const grises = await page.$$eval('#choixModal .aln-case[data-aln][disabled]', e => e.length);
    await page.click('#choixModal .aln-case[data-aln]:not([disabled])');
    await page.waitForSelector('#hockeyCardModal .fc-poser', { timeout: 10000 });
    await page.waitForTimeout(500);
    if (!(await page.$eval('#hockeyCardModal .fiche-carte', e => e.classList.contains('au-verso')))) erreurs.push('la fiche ne s\'ouvre pas au verso pour y poser la carte');
    await page.evaluate(() => document.querySelector('#hockeyCardModal .fc-cases').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${DOSSIER}/rogue-verso-poser.png` });
    const nomJoueur = (await page.textContent('#hockeyCardModal .cjv-nom')).trim();
    await page.click('#hockeyCardModal .fc-poser');
    await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
    await page.waitForTimeout(800);
    await regler();
    d = await decisions();
    posee = d.find(x => x.joue && x.mutation) || null;
    if (!posee) erreurs.push(`« ${nomModif} » n'a pas été posée`);
    console.log(`7a. « ${nomModif} » posée au verso de ${nomJoueur} (${permis} joueurs permis, ${grises} grisés) : ${JSON.stringify(posee && { joue: posee.joue.id, mutation: posee.mutation })}`);
  }
}
if (!(await page.$('#inventaireModal:not([hidden])'))) { await page.click('#hubModal .hub-inventaire'); await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 }); }
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
  if (!(await page.$('#inventaireModal:not([hidden])'))) { await page.click('#hubModal .hub-inventaire'); await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 }); }
  const boutons = await page.$$('#inventaireModal .bq-carte:not(.bq-joueur) .inv-jouer:not([disabled])');
  if (!boutons[essais]) break;
  await boutons[essais].click();
  await page.waitForTimeout(600);
  await regler();
  if (await page.$('#inventaireModal:not([hidden])')) continue;
  await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
  await regler();
  d = await decisions();
  jouee = d.filter(x => x.joue).length > avantJouees;
}
if (await page.$('#inventaireModal:not([hidden])')) await page.click('#inventaireModal .choix-fermer');
d = await decisions();
console.log(`7. jouée (${essais} essai(s)) : ${JSON.stringify(d.filter(x => x.joue).map(x => ({ id: x.joue.id, champs: Object.keys(x).filter(k => !['jour', 'joue', 'sel'].includes(k)) })))} · barre : ${await jauge()}`);
if (!jouee) erreurs.push('aucune carte de l\'inventaire n\'a pu se jouer (cinq essais)');
// LE CARTABLE (S79) : l'onglet Vestiaire, une fois la saison commencée.
await page.click('#navbar [data-page="repechage"]');
await page.waitForSelector('#pageCartable:not([hidden]) .ct-carte', { timeout: 20000 });
await page.screenshot({ path: `${DOSSIER}/rogue-cartable.png` });
console.log(`8. le cartable : ${(await page.textContent('.ct-comptes')).replace(/\s+/g, ' ').trim()} · ${await page.$$eval('[data-ct-equipe]', e => e.length)} cartes d'équipe`);
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
  console.log(`8a. son verso : « ${titre} » — ${pleines.join(' | ')}`);
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
    await page.waitForSelector('#hubModal .hub-boutique', { timeout: 120000 });
    await page.waitForTimeout(800);
    await regler();
    const apres = (await decisions()).filter(x => x.joue && x.mutation).length;
    if (apres !== avant + 1) erreurs.push(`« + Poser une amélioration » n'a rien posé (${avant} puis ${apres})`);
    console.log(`8b. « + Poser une amélioration » : ${offertes.join(' · ')} offertes, la première posée (${apres} modif(s) posée(s))`);
    fait = true;
    break;
  }
  if (!fait) console.log('8b. plus de modif à poser (ou personne à qui elles vont)');
  if (!(await page.$('#hubModal .hub-boutique'))) { await page.click('#navbar [data-page="match"]').catch(() => {}); }
}
await page.click('#navbar [data-page="match"]');
await page.waitForSelector('#hubModal .hub-boutique', { timeout: 20000 });
// La fin de saison se JOUE (S79 : plus de « Fin de saison ») : décision après décision, jusqu'au bilan.
for (let i = 0; i < 200; i++) {
  await regler();
  const s2 = await page.$('#hubModal .hub-suite');
  if (s2 && await s2.isVisible()) break;
  if (await page.$('.result .score') && await page.isVisible('.result .score')) break;
  if (await prochaineDecision()) continue;
  const j = await page.$('#hubModal .hub-jour');
  if (j && await j.isVisible()) { await j.click(); await page.waitForTimeout(400); }
}
await page.waitForSelector('#hubModal .hub-suite, .result .score', { timeout: 120000 });
// Ce qui reste à régler avant le bilan (un palier, un sommaire).
await regler();
// Prendre le dernier palier peut mener tout droit au bilan : on ne touche « Voir le bilan » que s'il est là.
const suite = await page.$('#hubModal .hub-suite');
if (suite && await suite.isVisible()) await suite.click();
await page.waitForSelector('.result .score', { timeout: 60000 });
await page.waitForTimeout(2500);
const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('cap82_rogue') || '{}'));
const cartable = await page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('cap82_cartable') || '{}').joueurs) || {}).length);
console.log(`9. fin de saison : ${meta.ecussons} écussons · ${meta.runs} run · collection ${(meta.collection || []).length} joueurs · cartable ${cartable} cartes · personnel ${(meta.personnel || []).length} · inventaire permanent ${Object.values(meta.inventaire || {}).reduce((a, n) => a + n, 0)} · dernière équipe ${(meta.derniereEquipe || []).length}`);
await page.click('#menuBtn');
await page.waitForSelector('#menuDepart');
await page.screenshot({ path: `${DOSSIER}/rogue-menu.png` });
// L'inventaire et le classeur, du menu (hors saison : on regarde, on ne joue pas).
await page.click('[data-menu="inventaire"]');
await page.waitForSelector('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-inventaire-menu.png` });
console.log(`10. l'inventaire du menu : ${(await page.$$eval('#inventaireModal .inv-onglet', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).join(' · ')}`);
await page.click('#inventaireModal .choix-fermer');
await page.waitForSelector('#menuDepart');
await page.click('[data-menu="vestiaire"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 10000 });
await page.screenshot({ path: `${DOSSIER}/rogue-vestiaire.png` });
const ouverts = await page.$$eval('#choixModal .choix-option:not([disabled])', e => e.map(x => x.textContent.trim().slice(0, 40)));
console.log(`11. le vestiaire : ${ouverts.length} déblocage(s) achetable(s)`);
console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await browser.close();
