/**
 * Test de fumée du mode bonus « Sur table », à 390 px.
 *
 *   python3 -m http.server 8000 &
 *   node scripts/smoke_table.mjs http://localhost:8000
 *
 * 0. l'exhibition : deux matchs sur table sans repêchage, depuis l'écran
 *    « Nouvelle partie », et zéro joueur signé après
 * 1. la page démarre, l'option « Sur table » se choisit dans les options
 * 2. auto-draft jusqu'à 23/23 (le repêchage est le même : c'est le but)
 * 3. #mainBtn mène au tournoi (#hubModal), pas à la saison
 * 4. le plateau s'ouvre (#tableModal) : on touche une pièce, la glace
 *    s'allume, on joue des gestes, le dé se montre, le match va au bout
 * 5. le tournoi se finit, le bilan sort et le champion est nommé
 * 6. zéro erreur console, et rien ne déborde à 390 px
 */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const base = process.argv[2] || 'http://localhost:8000';
// La glace vient du moteur : le test lit la même source que le jeu.
const { COLS: COLS_ATTENDU, RANGS: RANGS_ATTENDU, FILET_HAUT, FILET_BAS, BUT_COL } = await import('../js/table.js');
/* CHROMIUM : le chemin d'un Chromium déjà installé (un poste où la version
   de Playwright ne correspond pas à celle du navigateur). Vide dans
   l'Action, qui installe le sien. */
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text())) return;
  errors.push(`console: ${m.text()}`);
});
await page.route(u => !u.href.startsWith(base), r => r.abort());

/*
 * UN TEST DE FUMÉE QUI DÉPEND DU TIRAGE N'EST PAS UN TEST, C'EST UNE LOTERIE.
 * C'est la leçon que `check_table.mjs` porte déjà — sa première version tirait
 * ses clubs avec `Math.random` et rougissait une fois sur quinze, sur main. Ce
 * script avait le même défaut à deux étages : la roulette du repêchage tire
 * avec `Math.random` DANS LA PAGE, et le joueur scripté choisit ses cases avec
 * `Math.random` ICI. Deux couches de hasard, donc un parcours différent à
 * chaque exécution — et l'assertion sur la variété des gestes offerts a fini
 * par tomber à deux sur cinq dans l'Action, sans qu'une ligne du plateau ait
 * bougé.
 *
 * Les deux étages prennent donc le MÊME générateur déterministe (un sfc32
 * comme celui de js/sim.js), semé par `GRAINE` : le parcours est reproductible
 * d'une exécution à l'autre, et `GRAINE=... node scripts/smoke_table.mjs`
 * rejoue exactement le même match quand il faut comprendre un échec.
 */
const GRAINE = process.env.GRAINE || 'fumee';
const semer = graine => {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = 0;
  for (const ch of String(graine)) { d = (d * 31 + ch.charCodeAt(0)) >>> 0; }
  a ^= d; b ^= d; c ^= d;
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d = (d + 1) >>> 0;
    let t = (a + b) >>> 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0; c = (c + t) >>> 0;
    t = (t + d) >>> 0;
    return (t >>> 0) / 4294967296;
  };
};
const dé = semer(GRAINE);
await page.addInitScript(`(${semer.toString()})(${JSON.stringify(GRAINE + '-page')}) && (Math.random = (${semer.toString()})(${JSON.stringify(GRAINE + '-page')}));`);

/* Quitter le plateau : le ✕, puis « Oui » à la question quand le match n'est pas fini (S75). */
const quitterTable = async () => {
  await page.click('#tableModal .table-close');
  const oui = await page.waitForSelector('#choixModal:not([hidden]) [data-choix="quitter"]', { timeout: 1500 }).catch(() => null);
  if (oui) await oui.click();
};

await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
/* LE MENU AU DÉPART (S77) : le premier lancement d'une session ouvre le menu.
   « La saison · Nouvelle partie » bâtit la partie et ouvre l'écran « Nouvelle
   partie » par-dessus, exactement comme la première visite d'avant. */
await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
const modesAuMenu = await page.$$eval('#menuDepart .menu-mode', l => l.map(x => x.dataset.genre).join(','));
// S78 : l'exhibition a son carton, sans être un genre de sauvegarde.
// 1.0 (R8) : le Rogue en premier, l'exhibition en lien sous la grille.
if (modesAuMenu !== 'rogue,saison,table') errors.push(`le menu au départ n'offre pas les trois modes, le Rogue en premier : ${modesAuMenu}`);
await page.click('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
await page.waitForSelector('#game', { state: 'visible', timeout: 30000 });
console.log('1. #game visible');

/* ---------- l'exhibition : le plateau sans repêchage ----------
   JP : *créer exhibition pour jeu de table pour plus facile de tester ?*. Le
   bouton est sur l'écran « Nouvelle partie » (déjà ouvert : le localStorage
   vient d'être vidé), il tire deux vrais clubs et ouvre le plateau tout de
   suite ; fermer le match le laisse se finir, et le mot du résultat offre un
   autre match. La partie en cours n'est pas touchée : zéro signé après. */
await page.waitForSelector('#partieModal #npExhibition', { state: 'visible', timeout: 30000 });
await page.click('#npExhibition');
await page.waitForSelector('#tableModal .t-glace', { timeout: 30000 });
{
  const lireTitre = async () => (await page.textContent('#tableModal .t-titre')).replace(/\s+/g, ' ').trim();
  const titre = await lireTitre();
  const casesEx = await page.$$eval('#tableModal .t-case', l => l.length);
  console.log(`0. exhibition ouverte : « ${titre} », ${casesEx} cases`);
  if (!/exhibition/i.test(titre)) errors.push(`le plateau d'exhibition titre « ${titre} »`);
  if (!/contre/.test(titre)) errors.push('l\'exhibition ne nomme pas ses deux clubs');
  if (casesEx !== COLS_ATTENDU * RANGS_ATTENDU) errors.push(`l'exhibition montre ${casesEx} cases au lieu de ${COLS_ATTENDU * RANGS_ATTENDU}`);
  const debordeEx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (debordeEx > 1) errors.push(`l'exhibition déborde de ${debordeEx} px à 390 px`);
  /* LE ✕ DEMANDE AVANT DE LAISSER FILER LE MATCH (S75). Un match pas fini ne
     se ferme plus d'un toucher : la question vient, « Non, je reste » garde
     le plateau ouvert, « Oui » le laisse se jouer. */
  await page.click('#tableModal .table-close');
  const question = await page.waitForSelector('#choixModal:not([hidden]) [data-choix="rester"]', { timeout: 5000 }).catch(() => null);
  if (!question) errors.push('le ✕ du plateau ferme le match sans demander');
  else {
    await question.click();
    await page.waitForTimeout(200);
    if (!(await page.isVisible('#tableModal .t-glace'))) errors.push('« Non, je reste » a quand même fermé le plateau');
    await quitterTable();
  }
  await page.waitForSelector('#gameModal', { state: 'visible', timeout: 30000 });
  const mot = (await page.textContent('#gameModal .tr-verdict')).replace(/\s+/g, ' ').trim();
  console.log(`   résultat : « ${mot} »`);
  if (!/\d+ – \d+/.test(mot)) errors.push(`le mot de l'exhibition ne porte pas de pointage : « ${mot} »`);
  /* « Un autre match » : deux clubs neufs, le plateau se rouvre sur la même
     modale — c'est ici qu'une minuterie du match d'avant repeignait la glace
     neuve avec un match fini. On vérifie que le titre a changé ET que la glace
     est vierge de résultat. */
  await page.click('#exhibitionEncore');
  await page.waitForSelector('#tableModal .t-glace', { timeout: 30000 });
  await page.waitForTimeout(900);
  const titre2 = await lireTitre();
  const resultatFantome = await page.$('#tableModal .t-resultat');
  if (titre2 === titre) errors.push('« Un autre match » a rejoué les mêmes clubs');
  if (resultatFantome) errors.push('la glace du deuxième match d\'exhibition porte le résultat du premier');
  console.log(`   un autre match : « ${titre2} »`);
  await quitterTable();
  await page.waitForSelector('#gameModal', { state: 'visible', timeout: 30000 });
  await page.click('#exhibitionFin');
  await page.waitForSelector('#gameModal', { state: 'hidden', timeout: 5000 });
  const signesEx = parseInt((await page.textContent('#cnt')).trim(), 10) || 0;
  if (signesEx !== 0) errors.push(`l'exhibition a touché la partie : ${signesEx} signé(s)`);

  /*
   * LES TIRS DE BARRAGE SE VOIENT (S75b). Le passage de vérification a vu un
   * 0-0 finir « Prolongation · Terminé », une feuille à 0-0, puis une défaite
   * au tournoi : la fusillade était jouée par le moteur et montrée nulle part.
   * On ouvre le plateau sur un match qui y va — Floride contre Toronto
   * 2013-14, Pro contre Pro — par la couture `preparer`, et on exige le
   * panneau, la barre et la feuille.
   *
   * LA GRAINE SE CHERCHE, ELLE NE S'ÉCRIT PAS (S75b). `tb-50` allait en
   * fusillade à douze possessions ; à treize (JP : *go*), plus du tout. Une
   * graine écrite en dur casse au prochain réglage du tempo sans qu'une ligne
   * de l'écran ait bougé. Le test joue donc les graines `tb-0`, `tb-1`…
   * dans le moteur jusqu'à la première qui va en fusillade, et c'est le
   * MOTEUR qui dit ce que l'écran doit montrer : le nombre de tours, le
   * vainqueur et son compte.
   */
  await page.evaluate(async () => {
    const [sim, table, logos, plateau] = await Promise.all([import('/js/sim.js'), import('/js/table.js'), import('/js/logos.js'), import('/js/plateau.js')]);
    const shard = await (await fetch('/data/seasons/2013-14.json')).json();
    const club = t => { const pool = shard.players.filter(p => p.t === t).map(p => ({ ...p })); pool.forEach(sim.registerHiddenRatings); return sim.autoRoster(pool); };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    window.__tb = null;
    const equipes = () => ({ A: table.equipeDeTable('FLA 2013-14', 'FLA', club('FLA'), 'A'), B: table.equipeDeTable('TOR 2013-14', 'TOR', club('TOR'), 'B') });
    let graine = null, attendu = null;
    for (let k = 0; k < 600 && !graine; k++) {
      const { A, B } = equipes();
      const m = table.nouveauMatch(A, B, `tb-${k}`);
      let g = 0; while (!m.fini && g++ < 4000) table.iaPresence(m);
      if (m.fusillade) {
        graine = `tb-${k}`;
        const v = m.fusillade.A > m.fusillade.B ? 'A' : 'B';
        attendu = { graine, tours: m.fusillade.tours.length, vainqueur: v, tag: v === 'A' ? 'FLA' : 'TOR',
          compte: `${Math.max(m.fusillade.A, m.fusillade.B)}-${Math.min(m.fusillade.A, m.fusillade.B)}` };
      }
    }
    window.__tbAttendu = attendu;
    if (!graine) return;
    plateau.ouvrirTable({
      ...equipes(),
      graine, titre: 'Essai', sousTitre: 'Les tirs de barrage',
      ctx: {
        esc, band: logos.getTeamBand, vive: logos.couleurVive, logo: logos.getTeamLogoHtml, niveau: () => 'PRO',
        preparer: m => { let g = 0; while (!m.fini && g++ < 4000) table.iaPresence(m); },
      },
      onTermine: r => { window.__tb = r; },
    });
  });
  const attendu = await page.evaluate(() => window.__tbAttendu);
  const panneau = attendu ? await page.waitForSelector('#tableModal .t-barrage:not([hidden])', { timeout: 5000 }).catch(() => null) : null;
  if (!attendu) errors.push('aucune des 600 graines ne va en fusillade entre la Floride et Toronto : la prolongation règle tout ?');
  else if (!panneau) errors.push('un match réglé aux tirs de barrage ne montre pas la fusillade sur la glace');
  else {
    const tb = await page.evaluate(() => ({
      tours: document.querySelectorAll('#tableModal .t-barrage-tours li').length,
      fin: document.querySelector('#tableModal .t-barrage-fin')?.textContent || '',
      mot: document.querySelector('#tableModal .t-dock .t-barrage-mot')?.textContent || '',
      periode: document.querySelector('#tableModal .tb-periode')?.textContent || '',
    }));
    await page.click('#tableModal .t-barrage');   // toucher montre tout
    await page.screenshot({ path: 'scripts/smoke-table-barrage.png' });
    await page.click('#tableModal .t-resultat');
    const feuilleTB = await page.waitForSelector('#tableModal .tf-barrage', { timeout: 5000 }).catch(() => null);
    const rangsTB = feuilleTB ? await page.$$eval('#tableModal .tf-barrage tr', l => l.length) : 0;
    await page.click('#tableModal .t-feuille-suite');
    const r = await page.evaluate(() => window.__tb);
    console.log(`   tirs de barrage (graine ${attendu.graine}) : ${tb.tours} tours, « ${tb.fin.trim()} », la barre dit « ${tb.mot.replace(/\s+/g, ' ').trim()} », la feuille en montre ${rangsTB}`);
    if (tb.tours !== attendu.tours || !tb.fin.includes(attendu.tag) || !tb.fin.includes(attendu.compte)) errors.push(`le panneau de la fusillade dit ${tb.tours} tours et « ${tb.fin} » au lieu de ${attendu.tours} et ${attendu.tag} ${attendu.compte}`);
    if (!/Tirs de barrage/i.test(tb.periode)) errors.push(`le tableau indicateur dit « ${tb.periode} » après une fusillade`);
    if (!tb.mot.includes(attendu.tag)) errors.push('la barre du bas ne dit pas qui a gagné la fusillade');
    if (rangsTB !== attendu.tours) errors.push(`la feuille du match montre ${rangsTB} tour(s) de fusillade au lieu de ${attendu.tours}`);
    if (!r || r.vainqueur !== attendu.vainqueur || !r.fusillade) errors.push('le match de la fusillade ne rend pas son vainqueur');
  }

  /*
   * LE TIR SE PROPOSE, MIS EN SCÈNE (S77). Le joueur scripté du tournoi ne
   * s'approche du filet qu'au hasard de ses gestes et du minutage : depuis que
   * la zone neutre a grandi (S75c), la zone de tir a rapetissé d'une rangée,
   * et « le tir n'a jamais été offert » rougissait une exécution sur trois ou
   * quatre, sans qu'une ligne de la carte ait bougé. Un test qui dépend du
   * tirage n'est pas un test. Ici, l'IA joue les deux camps (`ctx.preparer`)
   * jusqu'à ce que ce soit TA main, ton porteur à portée ; on touche le porteur,
   * et la carte doit offrir « Tirer ».
   */
  await page.evaluate(async () => {
    const [sim, table, logos, plateau] = await Promise.all([import('/js/sim.js'), import('/js/table.js'), import('/js/logos.js'), import('/js/plateau.js')]);
    const shard = await (await fetch('/data/seasons/2013-14.json')).json();
    const club = t => { const pool = shard.players.filter(p => p.t === t).map(p => ({ ...p })); pool.forEach(sim.registerHiddenRatings); return sim.autoRoster(pool); };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    window.__tirPret = false;
    plateau.ouvrirTable({
      A: table.equipeDeTable('PIT 2013-14', 'PIT', club('PIT'), 'A'), B: table.equipeDeTable('BUF 2013-14', 'BUF', club('BUF'), 'B'),
      graine: 'tir-scene', titre: 'Essai', sousTitre: 'Le tir',
      ctx: {
        esc, band: logos.getTeamBand, vive: logos.couleurVive, logo: logos.getTeamLogoHtml, niveau: () => 'PRO',
        preparer: m => {
          for (let g = 0; !m.fini && g < 4000; g++) {
            const p = table.porteur(m);
            if (m.tour === 'A' && p && p.eq === 'A' && table.peutTirer(m, p)) { window.__tirPret = true; return; }
            table.iaPresence(m);
          }
        },
      },
      onTermine: () => {},
    });
  });
  let tirScene = false;
  if (await page.evaluate(() => window.__tirPret)) {
    await page.waitForSelector('#tableModal .t-glace', { timeout: 10000 });
    await page.waitForTimeout(900);
    const caseP = await page.evaluate(() => {
      const j = [...document.querySelectorAll('#tableModal .t-jeton.mienne')].find(e => e.querySelector('.t-rondelle'));
      return j ? `${j.style.getPropertyValue('--tr')},${j.style.getPropertyValue('--tc')}` : null;
    });
    if (caseP) {
      // Un toucher pendant la LECTURE du plateau l'accélère ou la saute (S75) : on touche jusqu'à ce que
      // le porteur soit choisi, comme un joueur qui tape deux fois — quatre fois au plus.
      for (let k = 0; k < 4; k++) {
        if (await page.$('#tableModal .t-jeton.mienne.choisie .t-rondelle')) break;
        await page.click(`#tableModal .t-case[data-r="${caseP.split(',')[0]}"][data-c="${caseP.split(',')[1]}"]`);
        await page.waitForTimeout(500);
      }
      tirScene = !!(await page.$('#tableModal [data-geste="tir"]'));
    }
    console.log(`   le tir mis en scène : porteur en ${caseP || '?'}, « Tirer » ${tirScene ? 'offert' : 'ABSENT'}`);
    if (!tirScene) errors.push('ton porteur à portée de tir ne se voit pas offrir « Tirer » sur la carte');
    await quitterTable();
    await page.waitForTimeout(600);
    // Ce qu'un match fermé laisse à l'écran (le mot du résultat) se referme aussi.
    const fermer = await page.$('#gameModal:not([style*="display: none"]) .close-btn, #gameModal:not([style*="display: none"]) [data-close]');
    if (fermer && await fermer.isVisible()) await fermer.click();
  } else errors.push('la mise en scène du tir n\'a jamais amené ton porteur à portée en 4000 présences');

  // L'exhibition a fermé l'écran « Nouvelle partie » pour laisser la glace.
}

/* ---------- « Sur table » se choisit au CHOIX DU MODE (S79 ; 1.0, R1) ----------
   JP : *« Nouvelle » devrait ramener aux choix des modes*. Le Menu de l'en-tête
   (le menu pause) montre les cartons des modes ; « Nouvelle partie » sur la
   table ouvre l'écran « Nouvelle partie » déjà réglé sur la table. Rien ne
   s'applique avant le clic sur le pied. */
await page.click('#menuBtn');
await page.waitForSelector('#menuDepart .menu-mode[data-genre="table"] [data-menu="nouvelle"]', { timeout: 10000 });
await page.click('#menuDepart .menu-mode[data-genre="table"] [data-menu="nouvelle"]');
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
const choisi = await page.$eval('#partieModal [data-opt="bonus"] button[data-val="TABLE"]', b => b.classList.contains('on'));
if (!choisi) errors.push('« Sur table » choisi au menu n\'arrive pas réglé dans l\'écran « Nouvelle partie »');
await page.click('#npGo');
// L'identité de départ (S73) : trois cartes avant la première roulette ; on prend la première.
await page.waitForSelector('#choixModal:not([hidden]) .choix-sheet[data-genre="identite"] .tc', { timeout: 10000 });
await page.click('#choixModal .tc');
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 30000 });
console.log(`   option « Sur table » choisie : ${choisi}`);

/* ---------- l'auto-draft, identique au test de fumée principal ---------- */
const MIN_SAL = 0.95;
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
let signed = 0, guard = 0;
while (signed < 23 && guard++ < 320) {
  const rem = parseM(await page.textContent('#capAmt'));
  const maxPick = rem - Math.max(0, 23 - signed - 1) * MIN_SAL;
  const cards = await page.$$('.pcard');
  const infos = await page.$$eval('.pcard', els => els.map(el => ({
    price: (((t) => { const m = t.replace(/\u00a0/g, ' ').match(/[−-]?\d*[.,]?\d+/); return m ? parseFloat(m[0].replace('−', '-').replace(',', '.')) || 0 : 0; })(el.querySelector('.pcard-price')?.textContent || '')),
    // Un bouton « Signer · bloque la fin » (1.0, J1-Q) demande deux touchers : l'auto-draft ne le prend jamais d'un seul.
    ok: !!el.querySelector('.btn-sign:not([disabled]):not(.risque)'),
  })));
  let idx = infos.findIndex(c => c.ok && c.price <= maxPick);
  if (idx < 0) {
    const rr = await page.$('#rrP:not([disabled])') || await page.$('#rrT:not([disabled])') || await page.$('#rrS:not([disabled])');
    if (rr) { await rr.click(); await page.waitForTimeout(240); signed = await lireSignes(); continue; }
    let best = -1, bp = Infinity;
    infos.forEach((c, i) => { if (c.ok && c.price < bp) { best = i; bp = c.price; } });
    idx = best;
  }
  if (idx < 0) { const f = await page.$('#freeCapBtn'); if (f) { await f.click(); await page.waitForTimeout(200); signed = await lireSignes(); continue; } break; }
  await cards[idx].$eval('.btn-sign', b => b.click());
  await page.waitForTimeout(180);
  signed = await lireSignes();
}
console.log(`2. ${signed}/23 signés`);

const libelle = await page.$eval('#mainBtn', b => b.textContent.trim());
console.log(`3. le bouton dit : « ${libelle} »`);
if (!/table/i.test(libelle)) errors.push('le bouton ne mène pas au tournoi sur table');

/* ---------- le tournoi ---------- */
await page.click('#mainBtn');
await page.waitForSelector('#hubModal .hub-jouer', { timeout: 60000 });
const tete = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
console.log(`4. tournoi ouvert : ${tete}`);

/* ---------- le plateau : on joue vraiment un match ---------- */
await page.click('#hubModal .hub-jouer');
await page.waitForSelector('#tableModal .t-glace', { timeout: 20000 });
/* LES RÈGLES SE LISENT PENDANT QU'ON JOUE : c'est un jeu de table, et un jeu
   de table dont il faut sortir pour lire les règles n'en est pas un. */
await page.click('#tableModal .table-regles');
await page.waitForSelector('#tableModal .t-regles', { timeout: 5000 });
const sections = await page.$$eval('#tableModal .t-regles section h4', l => l.map(e => e.textContent.trim()));
const gestesEcrits = await page.$$eval('#tableModal .t-regles .t-regle-nom', l => l.length);
console.log(`   règles : ${sections.length} sections (${sections.join(', ')}), ${gestesEcrits} gestes décrits`);
if (sections.length < 8) errors.push(`la page des règles n'a que ${sections.length} sections`);
if (gestesEcrits < 6) errors.push(`la page des règles ne décrit que ${gestesEcrits} gestes`);
const debordeRegles = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (debordeRegles > 1) errors.push(`les règles débordent de ${debordeRegles} px à 390 px`);
await page.screenshot({ path: 'scripts/smoke-table-regles.png' });
await page.click('#tableModal .t-regles-fermer');
await page.waitForSelector('#tableModal .t-glace', { timeout: 5000 });

const cases = await page.$$eval('#tableModal .t-case', l => l.length);
console.log(`   la glace : ${cases} cases (attendu ${COLS_ATTENDU * RANGS_ATTENDU})`);
if (cases !== COLS_ATTENDU * RANGS_ATTENDU) errors.push(`la glace compte ${cases} cases`);
/* DERRIÈRE LE FILET : deux filets d'une case, et du terrain derrière chacun. */
const filets = await page.$$eval('#tableModal .t-case.t-but', l => l.length);
const derriere = await page.$$eval('#tableModal .t-case.t-derriere', l => l.length);
console.log(`   ${filets} filets, ${derriere} cases derrière ou sur la ligne des buts`);
if (filets !== 2) errors.push(`${filets} cases de filet au lieu de deux`);
if (derriere < 2 * (COLS_ATTENDU - 1)) errors.push(`seulement ${derriere} cases derrière les filets`);

/*
 * LE POINTAGE NE COURT PAS DEVANT LA RONDELLE, ET LA GLACE NE SAUTE PAS (S75).
 * Le tableau lisait le moteur : le but y était pendant que le dé adverse
 * roulait encore et que la rondelle n'avait pas quitté la palette. Chaque
 * fois que le pointage change à l'écran, la rondelle MONTRÉE doit être au
 * fond d'un filet — ou déjà au point de mise au jeu, sifflet posé, quand un
 * toucher a fini la lecture d'un coup. Et le haut de la glace ne bouge
 * jamais : la bannière du but et la pastille d'une punition s'y inséraient
 * et la poussaient de 39 et 20 px. Les deux se lisent dans le DOM, à chaque
 * réécriture du tableau, par un observateur posé avant le premier geste.
 * Prouvé en remettant le pointage sur le moteur : le premier but rougit.
 */
await page.evaluate(({ haut, bas, col }) => {
  const S = window.__plateau = { enAvance: [], changements: 0, hauts: [] };
  const tete = document.querySelector('#tableModal .t-tete');
  const glace = document.querySelector('#tableModal .t-glace');
  const score = () => [...tete.querySelectorAll('.tb-score b')].map(b => b.textContent).join('-');
  let avant = score();
  new MutationObserver(() => {
    if (glace.offsetParent) { const h = Math.round(glace.getBoundingClientRect().top); if (!S.hauts.includes(h)) S.hauts.push(h); }
    const s = score();
    if (!s || s === avant) return;
    S.changements++;
    const j = document.querySelector('#tableModal .t-rondelle-libre-jeton');
    const r = +j.style.getPropertyValue('--tr'), c = +j.style.getPropertyValue('--tc');
    const auFilet = (r === haut || r === bas) && c === col;
    const siffle = !document.querySelector('#tableModal .t-sifflet').hidden;
    if (!auFilet && !siffle) S.enAvance.push(`${avant} → ${s}, rondelle en ${r},${c}`);
    avant = s;
  }).observe(tete, { subtree: true, childList: true, characterData: true });
  /*
   * LE POINT DU PORTEUR N'ARRIVE PAS AVANT LA RONDELLE (S75b). Le receveur
   * d'une passe portait son point dès le départ, pendant que la rondelle
   * volait encore : deux rondelles à l'écran, jusqu'à onze cases l'une de
   * l'autre. À chaque image, là où elles sont DESSINÉES (la transition en
   * cours comprise), le jeton qui porte le point et la rondelle ne sont
   * jamais à plus d'une case et demie l'un de l'autre.
   */
  const P = window.__point = { images: 0, ecarts: 0, pire: 0 };
  const cellule = document.querySelector('#tableModal .t-case');
  const regarder = () => {
    const modal = document.getElementById('tableModal');
    if (modal && modal.style.display !== 'none' && glace.offsetParent) {
      const rond = modal.querySelector('.t-rondelle-libre-jeton');
      const point = modal.querySelector('.t-jeton .t-rondelle');
      if (rond && point && !rond.hidden) {
        const a = rond.getBoundingClientRect(), b = point.closest('.t-jeton').getBoundingClientRect(), cote = cellule.getBoundingClientRect().width || 1;
        const d = Math.hypot(a.left + a.width / 2 - b.left - b.width / 2, a.top + a.height / 2 - b.top - b.height / 2) / cote;
        P.images++;
        if (d > 1.5) { P.ecarts++; P.pire = Math.max(P.pire, d); }
      }
    }
    requestAnimationFrame(regarder);
  };
  requestAnimationFrame(regarder);
}, { haut: FILET_HAUT, bas: FILET_BAS, col: BUT_COL });

/*
 * Le joueur automatique : il fait ce qu'un pouce ferait, et il doit toucher à
 * TOUT — sinon il ne teste que la moitié du plateau. Il tire quand il peut,
 * joue une case allumée (patiner, passer, frapper), prend un geste de la
 * carte (se placer devant, tendre le bâton, l'épaule ou le bâton sur le
 * porteur), et passe à la pièce jouable SUIVANTE quand il ne reste rien —
 * c'est ce « suivante » qui empêche de retoucher éternellement la même pièce.
 */
/* Le volet de la pièce (fiche, banc, fil) : fermé par défaut sur téléphone,
   colonne de droite sur grand écran. On ne l'ouvre que si ce qu'on veut
   toucher n'est pas visible. */
const ouvrirVolet = async () => {
  // La CLASSE, pas la visibilité : en refermant les règles, le volet glisse
  // encore pendant 220 ms et « paraît » visible — le premier jet s'y est pris.
  if (await page.$('#tableModal .t-bas.ouvert')) return;
  const b = await page.$('#tableModal .t-volet-btn');
  if (b && await b.isVisible()) { await b.click(); await page.waitForTimeout(300); }   // sur grand écran il n'y a pas de bouton : le volet est là
};
let gestes = 0, tours = 0, relances = 0, changements = 0, pieces = 0, occasionsDuel = 0;
let sauts = 0, modesJoues = 0, degagements = 0, activationsFinies = 0;
let activationsVues = 0;   // le une-deux ouvert à l'écran (S35) : le bouton « Tir sur réception » est là
// UN DÉPLACEMENT ET UNE ACTION PAR MAIN (S36), puis la main passe. Ce qui
// prouve l'alternance, c'est que l'ADVERSAIRE a joué entre deux de mes
// gestes — on compte les fois où la main n'est plus à moi juste après.
let alternances = 0, gesteAvant = false;
let captureModes = false;
const vus = new Set();
let dernierPorteur = null, essaisPorteur = 0;   // le porteur qu'on a choisi exprès (S75b)
const modesVus = new Set();
const motsFin = new Set();
let passerMal = null;
const caseDe = (rc) => `#tableModal .t-case[data-r="${rc.split(',')[0]}"][data-c="${rc.split(',')[1]}"]`;
/* Les cases allumées qu'un doigt atteint vraiment — même règle que dans
   l'état, pour les endroits qui relisent la glace après un clic. */
const casesTouchables = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter(e => {
  const b = e.getBoundingClientRect();
  if (!b.width || !b.height) return false;
  const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !!t && (t === e || e.contains(t));
}).map(e => `${e.dataset.r},${e.dataset.c}`), sel);
let dernierDuel = null, duelsSecs = 0;
/* LA BARRE DU BAS NE MORD PAS SUR LA GLACE (S75b). La consigne de la passe
   faisait trois lignes et cachait la dernière rangée, là où sont les
   coéquipiers derrière ton filet. Mesuré à chaque tour du joueur scripté. */
const barreSurGlace = { n: 0, pire: 0, ou: '' };
let menuMenti = null;          // la carte de commandes a-t-elle nommé la mauvaise pièce ?
while (tours++ < 4000) {
  if (!(await page.$('#tableModal .t-glace'))) break;
  const etat = await page.evaluate(() => {
  /*
   * UNE CASE QU'ON NE PEUT PAS TOUCHER N'EST PAS UNE OPTION (S46). La carte
   * de commandes est posée SUR la glace, à côté de la pièce (S45), et elle
   * couvre une trentaine de cases : ni le doigt ni le curseur ne les
   * atteignent tant qu'elle est ouverte — c'est exactement pour ça qu'elle
   * se ferme dès qu'on a choisi. Le joueur scripté, lui, visait au hasard
   * parmi TOUTES les cases allumées, donc il tombait dessous et Playwright
   * attendait trente secondes sur un clic impossible. Il ne vise plus que
   * ce qu'un joueur pourrait toucher : l'élément au centre de la case doit
   * être la case elle-même.
   */
  const touchable = e => {
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) return false;
    const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!t && (t === e || e.contains(t));
  };
  const cases = s => [...document.querySelectorAll(s)].filter(touchable).map(e => `${e.dataset.r},${e.dataset.c}`);
  /*
   * LA CARTE DE COMMANDES DIT LA PIÈCE CHOISIE, ET PAS LA PRÉCÉDENTE.
   * `carte()` calcule `actions` et `majGlace` en dessine la carte : tant que
   * la glace se dessinait AVANT, elle portait les gestes du rendu d'avant —
   * au premier toucher il n'y avait aucun menu, au suivant c'était celui de
   * la pièce d'avant, avec ses cotes et ses cibles. JP : *je suis incapable
   * de passer, les menus sont fucked*. On compare donc ce que la carte
   * NOMME à ce qui est CHOISI ; la carte se ferme légitimement pendant un
   * jet ou une fois un mode pris, d'où `bloque`.
   */
  const nu = x => (x || '').replace(/[^A-Za-zÀ-ÿ]/g, '').toLowerCase();
  const cmd = document.querySelector('#tableModal .t-cmd');
  const jetonSel = document.querySelector('#tableModal .t-jeton.mienne.choisie');
  return ({
    suite: !!document.querySelector('#tableModal .t-suite'),
    relance: !!document.querySelector('#tableModal .t-relancer'),
    mien: !!document.querySelector('#tableModal .tb-tour.mien'),
    sel: !!document.querySelector('#tableModal .t-case.t-sel'),
    menu: jetonSel ? {
      bloque: !!document.querySelector('#tableModal .t-annuler') || !!document.querySelector('#tableModal .t-suite') || !!document.querySelector('#tableModal .t-relancer'),
      ouverte: !!(cmd && !cmd.hidden),
      dit: nu(cmd && cmd.querySelector('.t-cmd-tete') ? cmd.querySelector('.t-cmd-tete').textContent : ''),
      // Le rôle et le NOM ENTIER du jeton (S75) : dans une case étroite il n'en affiche que trois
      // lettres, mais c'est toujours la même pièce que la carte doit nommer.
      piece: nu(`${(jetonSel.querySelector('.t-role') || {}).textContent || ''}${(jetonSel.querySelector('.t-nom-long') || jetonSel).textContent}`),
    } : null,
    // La pièce choisie porte-t-elle la rondelle ? Le joueur scripté monte alors vers le filet.
    porteur: !!document.querySelector('#tableModal .t-jeton.mienne.choisie .t-rondelle'),
    // Mon porteur, s'il peut encore jouer et qu'il n'est pas la pièce choisie (S75b).
    porteurJouable: (() => {
      const j = [...document.querySelectorAll('#tableModal .t-jeton.mienne')].find(e => e.querySelector('.t-rondelle'));
      if (!j || j.classList.contains('choisie')) return null;
      const r = j.style.getPropertyValue('--tr'), c = j.style.getPropertyValue('--tc');
      return document.querySelector(`#tableModal .t-case.t-jouable[data-r="${r}"][data-c="${c}"]`) ? `${r},${c}` : null;
    })(),
    // La carte de commandes, ouverte sur une AUTRE pièce, peut couvrir le porteur (S75c) : un pouce la ferme d'abord.
    porteurCouvert: (() => {
      const j = [...document.querySelectorAll('#tableModal .t-jeton.mienne')].find(e => e.querySelector('.t-rondelle'));
      if (!j) return false;
      const e = document.querySelector(`#tableModal .t-case[data-r="${j.style.getPropertyValue('--tr')}"][data-c="${j.style.getPropertyValue('--tc')}"]`);
      return !!e && !touchable(e) && !!document.querySelector('#tableModal .t-cmd:not([hidden]) .t-cmd-fermer');
    })(),
    jouablesCases: cases('#tableModal .t-case.t-jouable:not(.t-sel)'),
    // MON PORTEUR, s'il est jouable : c'est lui qui offre le mode « Passer » (S80 — le prendre au
    // hasard, c'était ne voir la passe que certains matchs, comme le duel avant S46).
    porteurJouable: (() => {
      const j = [...document.querySelectorAll('#tableModal .t-jeton.mienne')].find(e => e.querySelector('.t-rondelle'));
      if (!j) return null;
      const r = j.style.getPropertyValue('--tr'), c = j.style.getPropertyValue('--tc');
      const e = document.querySelector(`#tableModal .t-case.t-jouable:not(.t-sel)[data-r="${r}"][data-c="${c}"]`);
      return e && touchable(e) ? `${r},${c}` : null;
    })(),
    offresCases: cases('#tableModal .t-case.t-offre'),
    contactsCases: cases('#tableModal .t-case.t-offre-echec'),
    // La case d'un adversaire qui PORTE la rondelle et qu'on peut atteindre :
    // c'est la seule qui ouvre le duel épaule / bâton sur la carte.
    // LES PIÈCES VIVENT DANS UNE COUCHE PAR-DESSUS LA GRILLE, pas dans la
    // case : le sélecteur « une pièce dans la case » ne matchait plus rien
    // depuis que les pièces glissent, et « aucune occasion de duel » était
    // vrai par construction. On lit la case du porteur dans la couche.
    duel: (() => {
      const j = [...document.querySelectorAll('#tableModal .t-jeton.sienne')].find(e => e.querySelector('.t-rondelle'));
      if (!j) return null;
      const r = j.style.getPropertyValue('--tr'), c = j.style.getPropertyValue('--tc');
      const e = document.querySelector(`#tableModal .t-case.t-offre-echec[data-r="${r}"][data-c="${c}"]`);
      return e && touchable(e) ? `${r},${c}` : null;
    })(),
    tir: !!document.querySelector('#tableModal [data-geste="tir"]'),
    autres: [...document.querySelectorAll('#tableModal [data-geste]')].map(b => b.dataset.geste),
    modes: [...document.querySelectorAll('#tableModal [data-mode]')].map(b => b.dataset.mode),
    modeOn: document.querySelector('#tableModal [data-mode].on')?.dataset.mode || null,
    finTour: !!document.querySelector('#tableModal .t-fin-tour'),
    // Le mot de la fin de main, lu pendant la main adverse (S42) ; et le
    // libellé du bouton qui saute la main, qui ne doit plus dire « Passer ».
    motFin: (document.querySelector('#tableModal .t-dock-attente b') || {}).textContent || '',
    passer: (document.querySelector('#tableModal .t-passer') || {}).textContent || '',
    fin: !!document.querySelector('#tableModal .t-resultat'),
    unites: !!document.querySelector('#tableModal .t-seg button:not(.on):not([disabled])'),
    // S75b : de combien la barre du bas mord sur la glace (0 attendu), et dans quel état.
    recouvre: (() => {
      const g = document.querySelector('#tableModal .t-glace'), d = document.querySelector('#tableModal .t-dock');
      if (!g || !d || d.hidden) return 0;
      return Math.round(g.getBoundingClientRect().bottom - d.getBoundingClientRect().top);
    })(),
    etatBarre: document.querySelector('#tableModal .t-dock-gestes .t-geste') ? 'duel' : document.querySelector('#tableModal .t-annuler') ? 'mode' : document.querySelector('#tableModal .t-suite') ? 'dé' : document.querySelector('#tableModal .t-dock-consigne') ? 'consigne' : 'main',
  });
  });
  etat.offres = etat.offresCases.length;
  if (etat.recouvre > 1) { barreSurGlace.n++; if (etat.recouvre > barreSurGlace.pire) { barreSurGlace.pire = etat.recouvre; barreSurGlace.ou = etat.etatBarre; } }
  etat.contacts = etat.contactsCases.length;
  etat.jouables = etat.jouablesCases.length;
  // La carte de commandes doit nommer la pièce choisie, pas la précédente.
  if (!menuMenti && etat.menu && !etat.menu.bloque) {
    if (!etat.menu.ouverte) menuMenti = `aucun menu alors que « ${etat.menu.piece} » est choisie`;
    else if (etat.menu.dit !== etat.menu.piece) menuMenti = `le menu nomme « ${etat.menu.dit} » pendant que « ${etat.menu.piece} » est choisie`;
  }
  if (etat.fin) break;
  if (etat.suite) {
    if (etat.relance && relances < 3) { await page.click('#tableModal .t-relancer'); relances++; await page.waitForTimeout(50); }
    /*
     * LE VERDICT SE SAUTE EN TOUCHANT LA GLACE. JP : *skip automatique de
     * message quand on clique après action réussie ou non*. Une fois sur
     * deux on touche une case au lieu de « Continuer » : le jet doit être
     * accepté et la boîte de décision disparue.
     */
    if (sauts < 6 && dé() < 0.5) {
      const cel = await page.$('#tableModal .t-case');
      await cel.click(); await page.waitForTimeout(60);
      const encore = await page.$('#tableModal .t-suite');
      if (encore) errors.push('toucher la glace pendant un jet en attente ne l\'a pas accepté');
      sauts++;
      continue;
    }
    await page.click('#tableModal .t-suite'); await page.waitForTimeout(50); continue;
  }
  if (!etat.mien) { if (gesteAvant) alternances++; gesteAvant = false; if (etat.motFin) motsFin.add(etat.motFin.trim()); await page.waitForTimeout(180); continue; }
  for (const g of etat.autres) vus.add(g);
  for (const g of etat.modes) modesVus.add(g);
  if (etat.autres.includes('reception')) activationsVues++;
  // Une capture en plein match, une pièce choisie et ses modes à l'écran :
  // c'est ce que JP regarde, pas le pointage final.
  if (etat.sel && etat.modes.length >= 2 && !captureModes) {
    await page.screenshot({ path: 'scripts/smoke-table-modes.png' });
    // Et le volet ouvert : la fiche au deuxième clic (S34), puis refermé.
    await ouvrirVolet();
    await page.screenshot({ path: 'scripts/smoke-table-volet.png' });
    const fermer = await page.$('#tableModal .t-volet-fermer');
    if (fermer && await fermer.isVisible()) { await fermer.click(); await page.waitForTimeout(260); }
    captureModes = true;
  }
  /*
   * LES MODES : on choisit le geste, puis la case. Le dégagement n'existe
   * QUE par son mode (ses cibles n'allument pas la glace autrement), donc
   * c'est lui qu'on cherche exprès ; les autres modes se prennent au hasard.
   */
  if (etat.sel && !etat.modeOn && etat.modes.length && modesJoues < 4 && dé() < 0.3) {
    const quoi = etat.modes[Math.floor(dé() * etat.modes.length)];
    await page.click(`#tableModal [data-mode="${quoi}"]`); await page.waitForTimeout(50);
    const n = await casesTouchables('#tableModal .t-case.t-offre');
    if (n.length) { await page.click(caseDe(n[Math.floor(dé() * n.length)])); gestes++; }
    // Rien à faire dans ce mode : on en ressort par « Annuler ». Le bouton
    // du mode a disparu avec la carte, qui se ferme dès qu'on a choisi —
    // le reclic tombait dans le vide, trente secondes durant.
    else await page.click('#tableModal .t-annuler');
    modesJoues++;
    await page.waitForTimeout(50); continue;
  }
  // Changer de trio deux fois dans le match : c'est la mécanique de fatigue.
  // Les trios sont dans le VOLET (S34) : on l'ouvre d'abord quand il est fermé.
  if (etat.unites && changements < 2) { await ouvrirVolet(); await page.click('#tableModal .t-seg button:not(.on):not([disabled])'); changements++; await page.waitForTimeout(60); continue; }
  /*
   * LE DUEL SE CHERCHE EXPRÈS, IL NE SE TIRE PAS AU SORT. Première version :
   * elle cliquait un contact au hasard une fois sur deux, donc elle tombait
   * sur le porteur certains matchs et pas d'autres — et l'assertion « le
   * geste vol a été offert » rougissait au hasard. Un test qui dépend du
   * tirage n'est pas un test. On vise donc TOUJOURS le porteur adverse
   * quand il est à portée, et on ne réclame les gestes du duel que si
   * l'occasion s'est présentée au moins une fois dans le match.
   */
  /*
   * LE DUEL SE RÉSOUT AVANT D'EN ROUVRIR UN AUTRE. Toucher le porteur ouvre
   * le choix épaule / bâton sur la carte mais ne consomme rien — la case
   * reste une offre. Le joueur automatique la retouchait donc en boucle :
   * 1186 duels ouverts et le match encore à 0-0 en première période. Quand
   * le choix est à l'écran, on tranche.
   */
  const duelOuvert = etat.autres.includes('echec') || etat.autres.includes('vol');
  if (duelOuvert) {
    // L'un ou l'autre : frapper n'est pas offert en pleine course ni vidé, harponner l'est.
    const offerts = ['echec', 'vol'].filter(g => etat.autres.includes(g));
    const quoi = offerts[Math.floor(dé() * offerts.length)];
    await page.click(`#tableModal [data-geste="${quoi}"]`);
    gestes++; await page.waitForTimeout(50); continue;
  }
  if (etat.duel) {
    /*
     * ET IL DOIT S'OUVRIR. Toucher le porteur ne consomme rien : si le choix
     * n'apparaît jamais, le joueur scripté retouche la même case pour
     * toujours — mesuré, 3 689 fois, le match encore à huit possessions en
     * première période, et l'Action a mis sept minutes à mourir sur une
     * assertion qui ne nommait pas la cause. Un test qui tourne en rond est
     * aussi faux qu'un sélecteur qui ne matche rien : il doit DIRE que la
     * case allumée ne fait rien, tout de suite.
     */
    if (etat.duel === dernierDuel && ++duelsSecs > 12) {
      errors.push(`la case du porteur adverse (${etat.duel}) s'allume mais le duel ne s'ouvre jamais : ${duelsSecs} touchers, aucun geste offert`);
      break;
    }
    if (etat.duel !== dernierDuel) { dernierDuel = etat.duel; duelsSecs = 0; }
    occasionsDuel++;
    await page.click(caseDe(etat.duel));
    gestes++; await page.waitForTimeout(50); continue;
  }
  if (etat.contacts && dé() < 0.45) {
    await page.click(caseDe(etat.contactsCases[Math.floor(dé() * etat.contacts)]));
    gestes++; await page.waitForTimeout(50); continue;
  }
  if (etat.tir) { await page.click('#tableModal [data-geste="tir"]'); gestes++; await page.waitForTimeout(50); continue; }
  /*
   * AVEC LA RONDELLE, ON PREND LE PORTEUR (S75b). Le joueur scripté prenait
   * la première pièce jouable, rarement celle qui porte : sous certaines
   * graines il ne tirait jamais, et l'assertion « le tir a été offert »
   * tombait avec le tempo (treize possessions : trois graines sur sept sans
   * un seul tir offert, pour une carte qui l'offre très bien). Un joueur
   * qui a la rondelle la joue ; le test aussi. Trois essais au plus sur la
   * même case, pour ne jamais tourner en rond.
   */
  if (etat.porteurJouable && !etat.modeOn) {
    if (etat.porteurJouable !== dernierPorteur) { dernierPorteur = etat.porteurJouable; essaisPorteur = 0; }
    if (etat.porteurCouvert) { await page.click('#tableModal .t-cmd-fermer'); await page.waitForTimeout(50); continue; }
    if (++essaisPorteur <= 3) { await page.click(caseDe(etat.porteurJouable)); pieces++; await page.waitForTimeout(50); continue; }
  }
  if (etat.offres && dé() < 0.62) {
    /*
     * LE PORTEUR MONTE (S41). Un patin tiré au sort ne traverse jamais une
     * glace de seize rangées : le joueur scripté ne tirait plus, et le
     * chemin du tir humain restait sans test. Avec la rondelle, on prend la
     * case allumée la plus proche du filet adverse (la rangée la plus basse).
     */
    let quoi = etat.offresCases[Math.floor(dé() * etat.offres)];
    if (etat.porteur) {
      for (const rc of etat.offresCases) if (+rc.split(',')[0] < +quoi.split(',')[0]) quoi = rc;
    }
    await page.click(caseDe(quoi));
    gestes++; await page.waitForTimeout(50); continue;
  }
  if (etat.autres.length) {
    const n = await page.$$('#tableModal [data-geste]');
    await n[Math.floor(dé() * n.length)].click();
    gestes++; gesteAvant = true; await page.waitForTimeout(50); continue;
  }
  if (etat.offres) {
    await page.click(caseDe(etat.offresCases[Math.floor(dé() * etat.offres)]));
    gestes++; gesteAvant = true; await page.waitForTimeout(50); continue;
  }
  if (etat.jouables) {
    const piece = !modesVus.has('passe') && etat.porteurJouable ? etat.porteurJouable : etat.jouablesCases[0];
    await page.click(caseDe(piece)); pieces++; await page.waitForTimeout(50); continue;
  }
  // Un déplacement et une action par main (S36) : quand rien ne peut
  // dépenser ce qui reste, on rend la main ; on ne renonce à la présence
  // que si la main n'était pas entamée.
  const fa = await page.$('#tableModal .t-fin-tour');
  if (fa) { await fa.click(); activationsFinies++; await page.waitForTimeout(60); continue; }
  if (etat.passer && etat.passer.trim() !== 'Passer la main') passerMal = etat.passer.trim();
  const fp = await page.$('#tableModal .t-passer');
  if (fp) { await fp.click(); await page.waitForTimeout(60); continue; }
  break;
}

const pointage = await page.textContent('#tableModal .tb-score').catch(() => '');
console.log(`   ${gestes} gestes joués, ${relances} relance(s) d'équipe, ${changements} changement(s) de trio, ${pieces} changements de pièce, ${alternances} fois l'adversaire a joué juste après mon geste, ${activationsVues} une-deux offert(s), ${activationsFinies} activation(s) finie(s) au bouton`);
if (!alternances) errors.push('l\'adversaire n\'a jamais joué entre deux de mes gestes : l\'alternance une pièce à la fois ne se joue pas');
console.log(`   gestes offerts par la carte : ${[...vus].sort().join(', ') || 'aucun'}`);
/* LA MAIN SE LIT (S42). JP : *je comprends définitivement pas comment se
   jouent les mains*. Pendant la main adverse, la barre dit pourquoi la mienne
   a fini ; et le bouton qui saute la main dit « Passer la main », jamais
   « Passer » tout court — c'était le mot du mode qui passe la rondelle. */
console.log(`   fins de main lues pendant la main adverse : ${[...motsFin].join(' · ') || 'aucune'}`);
if (!motsFin.size) errors.push('la barre ne dit jamais pourquoi ma main a fini pendant la main adverse');
if (passerMal) errors.push(`le bouton qui saute la main dit « ${passerMal} » au lieu de « Passer la main »`);
console.log(`   modes offerts : ${[...modesVus].sort().join(', ') || 'aucun'} · ${modesJoues} joués par mode, ${degagements} dégagement(s), ${sauts} verdict(s) sautés en touchant la glace`);
if (!modesVus.has('deplacer') || !modesVus.has('passe')) errors.push(`les modes Patiner et Passer n'ont pas tous deux été offerts : ${[...modesVus].join(', ')}`);
/*
 * CE QU'ON AFFIRME, ET CE QU'ON SE CONTENTE DE RAPPORTER.
 *
 * Chaque geste de la carte a une condition : « tirer » demande de porter la
 * rondelle, le tir sur réception qu'une passe vienne de réussir, le duel d'être collé au porteur
 * adverse. Ces conditions dépendent du match, pas du code — exiger les cinq
 * à tous les coups faisait rougir le test au hasard, exactement comme
 * l'assertion sur les passes de check_table.mjs a fait rougir main.
 *
 * On affirme donc ce que le PLATEAU doit garantir quoi qu'il arrive : le
 * TIR, et le HARPONNAGE dès qu'un duel s'est ouvert, puisque là c'est nous
 * qui avons cliqué le porteur exprès. Les gestes sont NOMMÉS plutôt que
 * comptés — un compte ne dit pas lesquels manquent, et il a caché une vraie
 * cause pendant tout un chantier (voir l'assertion en bas de fichier). Le
 * reste est rapporté, pas exigé.
 *
 * ET LE PARCOURS EST DÉTERMINISTE (voir `GRAINE` en tête) : sous la graine
 * par défaut le joueur scripté voit les mêmes gestes à chaque exécution, sur
 * ce poste comme dans l'Action — vérifié en S42, où le même parcours a rendu
 * les mêmes 360 gestes et le même champion des deux côtés.
 */
/*
 * ON EXIGE CE QUE LE PLATEAU GARANTIT, ET ON NOMME LES GESTES (S42). Le
 * seuil était « au moins trois des quatre », un COMPTE qui ne disait pas
 * lesquels ; il est devenu infaisable pour une raison de jeu, pas de carte.
 *
 * ON NE FRAPPE PAS EN PLEINE COURSE (S41) : la carte n'offre « Frapper »
 * qu'à une pièce qui n'a pas patiné cette main-ci. Le joueur scripté ferme
 * sur le porteur puis ouvre le duel dans la MÊME main, donc il le demande
 * toujours au seul joueur qui ne peut pas y répondre — et depuis que la
 * main achète aussi un placement (S42), la pièce qu'il a sous la main est
 * encore plus souvent celle qui vient de patiner. Le geste reste parfaitement
 * joignable pour un humain : mesuré dans le moteur, 30 % des mains
 * défensives commencent avec une pièce qui PEUT frapper, et `check_table`
 * compte 13,9 mises en échec par équipe par match. Exiger ici qu'un
 * parcours scripté tombe dessus, ce serait une loterie — exactement ce que
 * ce fichier s'interdit.
 *
 * On exige donc les deux gestes que la carte doit offrir quoi qu'il arrive :
 * le TIR, et le HARPONNAGE dès qu'un duel s'est ouvert (le bâton, lui, ne
 * demande pas d'être à l'arrêt). Le reste est rapporté, pas exigé.
 */
// Le joueur scripté ne l'exige plus : c'est la mise en scène du tir (plus haut) qui le garantit.
if (!vus.has('tir')) console.log(`   (le joueur scripté ne s'est pas vu offrir de tir ce match-ci : vus ${[...vus].join(', ') || 'aucun'} — la mise en scène l'a éprouvé)`);
if (occasionsDuel) {
  if (!vus.has('vol')) errors.push(`le duel s'est présenté ${occasionsDuel} fois mais le geste « vol » n'a jamais été offert`);
  console.log(`   le duel épaule / bâton s'est présenté ${occasionsDuel} fois · frapper ${vus.has('echec') ? 'offert' : 'jamais offert (le porteur était fermé en pleine course)'}`);
} else {
  console.log('   aucune occasion de duel ce match-ci (le porteur adverse n\'est jamais venu à portée)');
}
console.log(`   ${pointage.replace(/\s+/g, ' ').trim()}`);
if (gestes < 15) errors.push(`seulement ${gestes} gestes joués sur le plateau : le match n'avance pas`);
{
  const P = await page.evaluate(() => window.__plateau);
  console.log(`   le pointage suit la rondelle : ${P.changements} but(s) au tableau, ${P.enAvance.length} en avance · le haut de la glace : ${P.hauts.join(', ')} px`);
  if (P.enAvance.length) errors.push(`le pointage a changé avant que la rondelle arrive : ${P.enAvance.slice(0, 3).join(' ; ')}`);
  if (P.hauts.length > 1) errors.push(`la glace a sauté pendant le match : son haut a pris ${P.hauts.join(', ')} px`);
  console.log(`   la barre du bas sur la glace : ${barreSurGlace.n} fois${barreSurGlace.n ? `, jusqu'à ${barreSurGlace.pire} px (${barreSurGlace.ou})` : ''}`);
  if (barreSurGlace.n) errors.push(`la barre du bas a couvert la glace ${barreSurGlace.n} fois, jusqu'à ${barreSurGlace.pire} px (${barreSurGlace.ou})`);
  const Q = await page.evaluate(() => window.__point);
  console.log(`   le point du porteur suit la rondelle : ${Q.images} images regardées, ${Q.ecarts} avec un écart de plus d'une case et demie${Q.ecarts ? ` (jusqu'à ${Q.pire.toFixed(1)})` : ''}`);
  if (!Q.images) errors.push('le point du porteur n\'a jamais été regardé : le contrôle ne contrôle rien');
  if (Q.ecarts) errors.push(`le point du porteur a devancé la rondelle sur ${Q.ecarts} image(s), jusqu'à ${Q.pire.toFixed(1)} cases`);
}
await page.screenshot({ path: 'scripts/smoke-table.png' });

/* ---------- rien ne déborde à 390 px ---------- */
const deborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`   débordement horizontal : ${deborde} px`);
if (deborde > 1) errors.push(`le plateau déborde de ${deborde} px à 390 px`);

/* ---------- la feuille du match ----------
 * Le moteur comptait marqueurs, passeurs, mises en échec, vols et arrêts, et
 * l'écran allait droit à `fermer()` : deux des trois blocs de `resultatDe`
 * n'étaient lus par aucune ligne d'interface. « Voir le résultat » ouvre
 * maintenant la feuille, et c'est « Continuer » qui ferme.
 */
const fin = await page.$('#tableModal .t-resultat');
if (fin) {
  await fin.click();
  // On DIT ce qui manque plutôt que de laisser expirer une attente : une
  // régression qui referme le match au lieu d'ouvrir la feuille rendait un
  // `TimeoutError` sur un sélecteur, illisible dans un journal d'Action.
  let ouverte = true;
  try { await page.waitForSelector('#tableModal .t-feuille', { timeout: 15000 }); }
  catch { ouverte = false; }
  if (!ouverte) {
    console.log('\n✗ « Voir le résultat » n\'ouvre pas la feuille du match.');
    await browser.close();
    process.exit(1);
  }
  const lu = await page.evaluate(() => ({
    etoiles: document.querySelectorAll('#tableModal .tf-etoile').length,
    cotes: document.querySelectorAll('#tableModal .tf-cote').length,
    rangees: document.querySelectorAll('#tableModal .tf-table tr').length,
    gardiens: document.querySelectorAll('#tableModal .tf-gardien').length,
    resume: (document.querySelector('#tableModal .tf-etoile') || {}).textContent || '',
    // Les lancers de l'adversaire (S75b) : la Recrue, par défaut, doit encore attaquer.
    tirsB: parseInt((document.querySelectorAll('#tableModal .tf-cote')[1]?.querySelector('.tf-chiffres b') || {}).textContent, 10) || 0,
  }));
  console.log(`   feuille du match : ${lu.etoiles} étoile(s), ${lu.cotes} côtés, ${lu.rangees} rangées, ${lu.gardiens} gardiens · ${lu.resume.replace(/\s+/g, ' ').trim()}`);
  if (lu.cotes !== 2) errors.push(`la feuille du match montre ${lu.cotes} côté(s) au lieu de deux`);
  if (!lu.etoiles) errors.push('la feuille du match ne nomme aucune étoile');
  if (!lu.rangees) errors.push('la feuille du match ne montre aucun joueur');
  if (lu.gardiens !== 2) errors.push(`la feuille du match montre ${lu.gardiens} gardien(s) au lieu de deux`);
  console.log(`   l'adversaire (Recrue) a lancé ${lu.tirsB} fois`);
  if (lu.tirsB < 3) errors.push(`l'adversaire Recrue n'a lancé que ${lu.tirsB} fois : il n'attaque plus`);
  const deborde2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (deborde2 > 1) errors.push(`la feuille du match déborde de ${deborde2} px à 390 px`);
  await page.click('#tableModal .t-feuille-suite');
} else await quitterTable();
await page.waitForTimeout(400);

/* ---------- le reste du tournoi ---------- */
await page.waitForSelector('#hubModal', { state: 'visible', timeout: 20000 });

/*
 * UN TOURNOI EN COURS SURVIT À UN RAFRAÎCHISSEMENT. Sept matchs sur table,
 * c'est une soirée, et elle se perdait au premier rechargement.
 *
 * La reprise n'est qu'à MOITIÉ un rejeu, et c'est ce qu'on éprouve ici : les
 * matchs joués À VIDE repartent de leur graine, TON match — celui qu'on vient
 * de jouer geste par geste — est relu depuis sa feuille, puisque aucune
 * graine ne redonne tes décisions. Deux lectures le prouvent, chacune la
 * sienne : le CLASSEMENT (les matchs à vide ont rejoué pareil) et les MENEURS
 * (ta feuille est revenue entière, joueurs compris).
 */
/* LA COQUILLE (1.0, R1) : le classement et les meneurs sont des onglets internes de la Ligue. */
const aLaLigue = async cle => {
  await page.click('#navbar .navtab[data-section="ligue"]');
  await page.click(`#sousNav .soustab[data-page="${cle}"]`);
};
const litTournoi = async () => {
  await aLaLigue('classement');
  await page.waitForTimeout(250);
  const classement = (await page.textContent('#hubModal .hub-volet')).replace(/\s+/g, ' ').trim();
  await aLaLigue('meneurs');
  await page.waitForTimeout(250);
  const meneurs = (await page.textContent('#hubModal .hub-volet')).replace(/\s+/g, ' ').trim();
  const tete = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
  return { tete, classement, meneurs };
};
const avantT = await litTournoi();
const sauveT = await page.evaluate(() => {
  try {
    const brut = localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif)) || '';
    const d = JSON.parse(brut || '{}');
    const m = (d.tournoi && d.tournoi.matchs) || {};
    const cles = Object.keys(m);
    return {
      ko: Math.round(brut.length / 1024),
      vide: cles.filter(k => m[k] === 1).length,
      miens: cles.filter(k => m[k] !== 1).length,
      clubs: ((d.tournoi && d.tournoi.clubs) || []).length,
    };
  } catch { return { ko: 0, vide: -1, miens: -1, clubs: -1 }; }
});
if (sauveT.miens < 1) errors.push(`la sauvegarde du tournoi ne porte aucune feuille de TES matchs : ${JSON.stringify(sauveT)}`);
if (sauveT.vide < 1) errors.push(`la sauvegarde du tournoi ne marque aucun match joué à vide : ${JSON.stringify(sauveT)}`);
if (sauveT.clubs !== 5) errors.push(`la sauvegarde du tournoi porte ${sauveT.clubs} clés de clubs au lieu de cinq`);
await page.reload({ waitUntil: 'networkidle' });
let reprisT = true;
try { await page.waitForSelector('#hubModal .hub-head', { state: 'visible', timeout: 90000 }); }
catch { reprisT = false; }
if (!reprisT) {
  // On DIT ce qui manque plutôt que d'expirer trente lignes plus loin : un
  // test qui meurt sur un `TimeoutError` ne nomme pas ce qui est cassé.
  console.log('\n✗ le tournoi en cours ne survit pas à un rafraîchissement : l\'écran du tournoi ne rouvre pas.');
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(700);
const apresT = await litTournoi();
if (avantT.tete !== apresT.tete) errors.push(`le tournoi ne reprend pas au même endroit : « ${avantT.tete} » puis « ${apresT.tete} »`);
else if (avantT.classement !== apresT.classement) errors.push('le classement du tournoi change après un rafraîchissement : les matchs joués à vide ne rejouent pas à l\'identique');
else if (avantT.meneurs !== apresT.meneurs) errors.push('les meneurs du tournoi changent après un rafraîchissement : la feuille de TON match n\'est pas relue');
else console.log(`   reprise du tournoi : ${apresT.tete} — ${sauveT.vide} match(s) rejoué(s), ${sauveT.miens} feuille(s) relue(s), ${sauveT.ko} ko`);

/* LES MENEURS DU TOURNOI. Le tournoi ne tenait que six nombres par club :
   rien ne s'accumulait d'un match à l'autre, donc l'ordre des matchs n'avait
   aucune importance. Le cumul se fait à l'affichage, en parcourant les matchs
   joués, et il inclut les séries. */
{
  await page.click('#navbar .navtab[data-section="ligue"]');
  const bouton = await page.$('#sousNav .soustab[data-page="meneurs"]');
  if (!bouton) errors.push('le tournoi n\'a pas d\'onglet « Meneurs »');
  else {
    await bouton.click();
    await page.waitForTimeout(300);
    const lu = await page.evaluate(() => ({
      tables: document.querySelectorAll('#hubModal .hub-volet table').length,
      rangees: document.querySelectorAll('#hubModal .hub-volet tbody tr').length,
      premier: (document.querySelector('#hubModal .hub-volet tbody tr') || {}).textContent || '',
    }));
    if (lu.tables < 2) errors.push(`les meneurs du tournoi ne montrent que ${lu.tables} tableau(x)`);
    if (!lu.rangees) errors.push('les meneurs du tournoi ne montrent aucun joueur');
    else console.log(`   meneurs du tournoi : ${lu.tables} tableaux, ${lu.rangees} rangées · ${lu.premier.replace(/\s+/g, ' ').trim()}`);
    const deborde3 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (deborde3 > 1) errors.push(`les meneurs du tournoi débordent de ${deborde3} px à 390 px`);
  }
}
// Les boutons du tournoi vivent au Club (S67 ; 1.0, R1).
await page.click('#navbar .navtab[data-section="club"]');
await page.waitForTimeout(250);
let tour = 0;
/*
 * UNE ÉGALITÉ AU TABLEAU EST UNE FUSILLADE, ET ELLE A UN GAGNANT (S75b). La
 * rangée d'un match nul disait « PROL. » et mettait en gras le club de
 * droite, gagnant ou non : le gagnant se lisait aux buts. Chaque rangée à
 * égalité dit « TB » et met UN club en gras.
 */
const egalites = { vues: 0, fausses: [] };
const lireEgalites = async () => {
  for (const r of await page.$$eval('#hubModal .tr-match', l => l.map(e => ({ p: e.querySelector('.tr-p')?.textContent || '', g: e.querySelectorAll('.tr-c.gagne').length })))) {
    const s = r.p.match(/(\d+) – (\d+)/);
    if (!s || s[1] !== s[2]) continue;
    egalites.vues++;
    if (!/TB/.test(r.p) || r.g !== 1) egalites.fausses.push(`${r.p.trim()} (${r.g} en gras)`);
  }
};
while (tour++ < 20) {
  await lireEgalites();
  const sauter = await page.$('#hubModal .hub-sauter');
  if (!sauter) break;
  await sauter.click();
  await page.waitForTimeout(220);
}
console.log(`   égalités au tableau du tournoi : ${egalites.vues} vue(s), ${egalites.fausses.length} sans « TB » ou sans gagnant`);
if (egalites.fausses.length) errors.push(`une égalité au tableau ne dit pas sa fusillade : ${egalites.fausses.slice(0, 3).join(' ; ')}`);
const suite = await page.$('#hubModal .hub-suite');
if (suite) await suite.click(); else await page.click('#hubModal .hub-close');
await page.waitForSelector('#gameModal', { state: 'visible', timeout: 20000 });
const verdict = (await page.textContent('#gameModal .tr-verdict')).trim();
const rangees = await page.$$eval('#gameModal .tbl tbody tr', l => l.length);
console.log(`5. bilan : « ${verdict} » · ${rangees} rangées de tableau`);
if (!verdict) errors.push('le bilan du tournoi ne nomme pas de champion');
await page.screenshot({ path: 'scripts/smoke-table-bilan.png' });

if (menuMenti) errors.push(`la carte de commandes est en retard d'un rendu : ${menuMenti}`);
else console.log('   la carte de commandes nomme toujours la pièce choisie');

console.log(errors.length ? `\n6. ÉCHEC — ${errors.length} erreur(s) :\n  ${errors.join('\n  ')}` : '\n6. zéro erreur console ✓');
await browser.close();
process.exit(errors.length ? 1 : 0);
