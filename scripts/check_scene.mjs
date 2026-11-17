/*
 * LES SCÈNES DU ROGUE À 390 × 844 (V30, docs/refonte-v30-2.md § 3.8, § 9 ; JP, 16 nov. 2026 : *bureau EHM, match illustré*).
 * Un robot (scripts/lib/run_robot.mjs) joue des saisons par les fonctions du jeu et garde une sauvegarde à chaque sorte de
 * scène ; Chromium, à 390 × 844, ouvre chacune par le menu (« Le Rogue ») comme une partie reprise, et on mesure :
 *
 *   1. les scènes du devis sont toutes là : le départ, les pièces, le repêchage, l'ouverture du quart, le bureau et ses
 *      onglets (l'alignement, un joueur tenu, le banc, la masse, le classement, les meneurs, la cédule, mon club, ses
 *      gardiens, ses matchs), les pochettes, la pause, la feuille du soir, l'affiche posée (le duel), le match, le
 *      résultat, la pièce d'un rival battu, les trois portes, la porte ouverte, l'échange, le bilan, le marché du quart,
 *      les séries et leur feuille, la fin ; et celles d'entre deux runs, ouvertes d'un méta semé (le départ et ses crans,
 *      le Club et ses pages, l'Album d'un cartable semé, le solde, une run d'avant qui s'arrête) ;
 *   2. la scène ne défile jamais, et rien du site ne dépasse : seul le cadre d'un tableau défile, en lui-même
 *      (`.rn-cadre`), et il tient entre le HUD et les onglets ;
 *   3. le HUD est toujours au même endroit (ses cœurs au même pixel) ;
 *   4. chaque cible fait 44 × 44 (scripts/lib/cibles.mjs), et tient dans l'écran ;
 *   5. aucun panneau ne passe sous les boutons du bas ni sous les onglets ;
 *   6. le classement montre les trente-deux clubs, la ligne des séries, et s'ouvre sur ton club ;
 *   7. aucune erreur de page.
 * Le ballottage et une histoire s'ouvrent si une des saisons jouées en garde une sauvegarde ; sinon ils s'impriment absents.
 *
 *   node scripts/check_scene.mjs http://localhost:8000 [dossier]     (deux minutes ; une capture par scène dans le dossier ;
 *                                                                     `NETTETE=2` : des captures nettes, à montrer)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { exiger, informer, verdict } from './verdict.mjs';
import { ciblesTropPetites } from './lib/cibles.mjs';
import { jouerLaRun, DONNEES } from './lib/run_robot.mjs';
import { creerLaRun, figer, medaillesDe, prochainSoir, histoireDuJour } from '../js/run.js';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || null;
const LARGEUR = 390, HAUTEUR = 844, GRAINES_MAX = 4;
/*
 * Les sauvegardes voulues, et les gestes qui mènent de chacune à d'autres scènes : [la scène, ses gestes]. Un geste est
 * [a] ou [a, v] ; « ? » à la fin : facultatif (en mouvement réduit, le match saute seul à sa fin).
 */
const ONGLETS = [['l\'alignement', [['onglet', 'alignement']]], ['l\'alignement, un joueur tenu', [['case']]], ['le banc', [['seg-a', 'banc']]], ['la masse', [['onglet', 'masse']]],
  ['le classement', [['onglet', 'ligue']]], ['les meneurs', [['seg-l', 'meneurs']]], ['la cédule', [['seg-l', 'cedule']]], ['mon club', [['onglet', 'club']]], ['mon club, trié par les buts', [['tri', 'b']]],
  ['mes gardiens', [['seg-c', 'gardiens']]], ['mes matchs', [['seg-c', 'matchs']]], ['les pochettes', [['onglet', 'bureau'], ['etal']]], ['la pause', [['fermer-etal'], ['pause']]]];
const SUITES = {
  pieces: [],
  repechage: [],
  quart: [],
  resultat: [['le bureau', [['continuer']]], ...ONGLETS, ['la feuille du soir', [['reprendre'], ['aller']]], ['la feuille, l\'affiche posée', [['affiche', '1']]], ['le match', [['jouer']]], ['le match fini', [['fin-du-match?']]]],
  piece: [['la pièce d\'un rival battu', [['continuer']]]],
  portes: [['la porte ouverte', [['ouvrir-porte', '0']]], ['l\'échange', [['vers-echange']]]],
  bilan: [['le marché du quart', [['apres-bilan']]], ['le marché, une autre carte à monter', [['voir-montee']]]],
  elite: [['la feuille de l\'élite', [['aller']]], ['la feuille de l\'élite, l\'enjeu mis', [['enjeu', '1']]]],
  histoire: [['une histoire', [['ouvrir-histoire']]]],
  ballottage: [],
  serie: [['les séries', [['continuer']]], ['la feuille des séries', [['match-de-serie']]]],
  fin: [['le Club, après une run', [['club']]]],
};
const NOMS = { pieces: 'tes pièces de banc', repechage: 'le repêchage', quart: 'l\'ouverture du quart', resultat: 'le résultat', piece: 'le résultat, un rival battu', portes: 'les trois portes', bilan: 'le bilan du quart',
  elite: 'le bureau, l\'élite ce soir', histoire: 'le bureau, une histoire', ballottage: 'le ballottage', serie: 'le résultat, en séries', fin: 'la fin de run' };
const FACULTATIVES = ['histoire', 'ballottage', 'elite'];

/* ---------- les sauvegardes : une par sorte de scène, tirées de vraies saisons ---------- */
const saves = { pieces: JSON.parse(JSON.stringify(figer(creerLaRun(DONNEES, { graine: 'scene', coach: { cle: 'essaim' } })))) };
const garde = (nom, S) => { if (nom in SUITES && !saves[nom]) saves[nom] = JSON.parse(JSON.stringify(figer(S))); };
for (let g = 1; g <= GRAINES_MAX && Object.keys(SUITES).some(k => !saves[k]); g++) {
  await jouerLaRun('malin', g, { espion: (m, S) => {
    const R = S.R;
    if (m === 'repeche' && R.rep && R.rep.tour === 6) garde('repechage', S);
    else if (m === 'quart' && R.quart.n === 1) garde('quart', S);
    else if (m === 'bureau' && R.matchs.length > 30) { if (prochainSoir(S).sorte === 'elite') garde('elite', S); if (histoireDuJour(S)) garde('histoire', S); }
    else if (m === 'ballottage') garde('ballottage', S);
    else if (m === 'portes' && !R.portes.pochette) garde('portes', S);
    else if (m === 'bilan' && R.coeurs > 0 && R.quart.n < 3) garde('bilan', S);
    else if (m === 'match' && R.phase === 'resultat') {
      if (R.series) { if (!R.fin && R.series.moi.w + R.series.moi.l > 0) garde('serie', S); }
      else if (R.suite[0] === 'piece' && R.apres.sorte === 'rival') garde('piece', S);
      // Un soir ordinaire du milieu de la saison, une affiche encore à poser, rien à l'infirmerie qui bloque le prochain match.
      else if (!R.suite.length && R.matchs.length > 24 && R.quart.affiches > 0 && R.matchs.length < R.quart.fin - 6 && !R.quart.gros[R.matchs.length] && S.toi.injured.size === 0) garde('resultat', S);
    } else if (m === 'fin') garde('fin', S);
  } });
}
const manquent = Object.keys(SUITES).filter(k => !saves[k] && !FACULTATIVES.includes(k));
exiger('une sauvegarde par sorte de scène, tirée de vraies saisons', !manquent.length, manquent.join(', ') || `${Object.keys(saves).length} sauvegardes`);
informer('les scènes facultatives', FACULTATIVES.map(k => `${k} : ${saves[k] ? 'gardée' : 'absente de ces saisons'}`).join(' · '));

/* ---------- le navigateur ---------- */
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const erreurs = [], fautes = { defile: [], dehors: [], hud: [], cibles: [], bord: [], couvert: [], cadre: [] }, vues = [];
let hud0 = null;
if (DOSSIER) fs.mkdirSync(DOSSIER, { recursive: true });

async function mesurer(page, nom) {
  await page.waitForTimeout(350);
  const m = await page.evaluate(({ L, H }) => {
    const racine = document.getElementById('runModal'), plan = racine && racine.querySelector('.rn-plan');
    if (!plan) return null;
    const de = document.scrollingElement, r = plan.getBoundingClientRect();
    // Chaque point d'une grille de l'écran est dans la scène : rien du site ne dépasse.
    let dehors = 0;
    for (let x = 6; x < L; x += 54) for (let y = 6; y < H; y += 52) { const el = document.elementFromPoint(x, y); if (!el || !racine.contains(el)) dehors++; }
    const coeurs = plan.querySelector('.rn-hud .rn-coeurs'), rc = coeurs && coeurs.getBoundingClientRect();
    // Ce qu'on touche tient dans l'écran ; une ligne d'un tableau qui défile se juge par son cadre.
    const bords = [...plan.querySelectorAll('[data-a]')].filter(el => !el.disabled && !el.closest('.rn-cadre')).map(el => ({ el, b: el.getBoundingClientRect() })).filter(({ b }) => b.width > 0 && (b.left < -0.5 || b.top < -0.5 || b.right > L + 0.5 || b.bottom > H + 0.5)).map(({ el }) => el.dataset.a);
    // Un panneau, un cadre ou une rangée de boutons ne passe jamais sous les boutons du bas ni sous les onglets : ce qui déborde se lit à moitié.
    const boite = el => el.getBoundingClientRect(), dessous = [...plan.querySelectorAll('.rn-cellules, .rn-bas, .rn-onglets')].map(boite);
    const sous = p => p.height > 0 && dessous.some(d => d.top > p.top && p.bottom > d.top + 1 && p.left < d.right && p.right > d.left);
    // Ni une cible qu'on touche, où qu'elle soit (une réponse d'histoire dont le texte s'allonge poussait son « Prendre » sous « Plus tard »).
    const cibles = [...plan.querySelectorAll('[data-a]')].filter(el => !el.disabled && !el.closest('.rn-cadre, .rn-bas, .rn-onglets'));
    const couverts = [...plan.querySelectorAll('.rn-panneau, .rn-cadre, .rn-bas, .rn-versbanc'), ...cibles].map(boite).filter(sous).length;
    // Le cadre d'un tableau : entre le HUD et le bas de l'écran, et lui seul défile.
    const cadre = plan.querySelector('.rn-cadre'), bc = cadre && cadre.getBoundingClientRect(), moi = cadre && cadre.querySelector('.rn-moi'), bm = moi && moi.getBoundingClientRect();
    return { couverts, defile: de.scrollHeight > H + 1 || de.scrollWidth > L + 1 || racine.scrollHeight > racine.clientHeight + 1 || plan.scrollHeight > plan.clientHeight + 1,
      plan: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], dehors, hud: rc ? [Math.round(rc.left), Math.round(rc.top)] : null, bords,
      cadre: bc ? { ok: bc.top >= 54 && bc.bottom <= H && bc.left >= 0 && bc.right <= L && cadre.scrollWidth <= cadre.clientWidth + 1, lignes: cadre.querySelectorAll('.rn-l:not(.rn-tete):not(.rn-unite):not(.rn-coupe)').length, coupe: !!cadre.querySelector('.rn-coupe'), moiVu: bm ? bm.top >= bc.top && bm.bottom <= bc.bottom : null } : null };
  }, { L: LARGEUR, H: HAUTEUR });
  if (!m) { fautes.defile.push(`${nom} : aucune scène`); return null; }
  vues.push(nom);
  if (m.defile || m.plan.join() !== `0,0,${LARGEUR},${HAUTEUR}`) fautes.defile.push(`${nom} (${m.plan.join(' ')})`);
  if (m.dehors) fautes.dehors.push(`${nom} : ${m.dehors} points hors de la scène`);
  if (m.couverts) fautes.couvert.push(`${nom} : ${m.couverts} bloc${m.couverts > 1 ? 's' : ''}`);
  if (m.cadre && !m.cadre.ok) fautes.cadre.push(`${nom} : le cadre sort de sa place ou défile de côté`);
  if (m.hud) { if (!hud0) hud0 = m.hud; else if (m.hud.join() !== hud0.join()) fautes.hud.push(`${nom} : ${m.hud.join(',')} au lieu de ${hud0.join(',')}`); }
  if (m.bords.length) fautes.bord.push(`${nom} : ${m.bords.slice(0, 3).join(', ')}`);
  const petites = await ciblesTropPetites(page);
  if (petites.length) fautes.cibles.push(`${nom} : ${petites.slice(0, 3).join(' | ')}`);
  if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/scene-${String(vues.length).padStart(2, '0')}-${nom.replace(/[^a-zà-ü]+/gi, '-')}.png` });
  return m;
}
async function ouvrir(R, meta = null, cartable = null) {
  const page = await browser.newPage({ viewport: { width: LARGEUR, height: HAUTEUR }, deviceScaleFactor: Number(process.env.NETTETE) || 1, hasTouch: true, reducedMotion: 'reduce' });
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([r, m, c]) => { localStorage.clear(); if (r) localStorage.setItem('cap82_run', JSON.stringify(r)); if (m) localStorage.setItem('cap82_rogue', JSON.stringify(m)); if (c) localStorage.setItem('cap82_cartable', JSON.stringify(c)); }, [R, meta, cartable]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
  await page.click('#menuDepart [data-menu="rogue"]');
  await page.waitForSelector('#runModal .rn-plan [data-a]', { timeout: 90000 });
  return page;
}
const geste = async (page, a, v = null) => {
  const el = await page.$(v == null ? `#runModal [data-a="${a}"]:not([disabled])` : `#runModal [data-a="${a}"][data-v="${v}"]:not([disabled])`);
  if (!el) return false;
  await el.click();
  await page.waitForTimeout(450);
  return true;
};

// Le départ : aucune run gardée.
{
  const page = await ouvrir(null);
  await mesurer(page, 'le départ');
  await page.close();
}
/*
 * ENTRE DEUX RUNS (V28, tranche 5). Un club qui a gagné : deux Coupes (ses crans), une philosophie tout juste ouverte (sa
 * case au loto), des médailles à dépenser. Puis un méta d'avant la V28, qui ouvre sur son solde.
 */
const meta = { present: [] };
{
  const RICHE = { ecussons: 300, ecussonsAVie: 900, voies: ['rapaces'], nouvelle: 'rapaces', coupes: 2, exigence: 1, cran: 1, runs: 12, jalons: { series: true, ronde: true },
    meilleur: { pts: 27, ronde: 3, coupe: true }, club: { club: 'harfangs', palette: 'etoiles', pris: ['club:harfangs'] }, recompenses: {}, solde: { avant: 0, rendu: 0, familles: [], voies: [], vu: true } };
  // Son cartable : l'effectif d'une vraie saison (des éditions, des copies, des gravures), deux entraîneurs.
  const source = saves.portes || saves.resultat, eds = ['legendaire', 'rare', 'hors', 'peu'];
  const CARTABLE = { v: 1, migre: true, joueurs: Object.fromEntries(source.joueurs.map((j, i) => [j.k, { v: { [eds[i] || 'commune']: 1 }, n: 1 + (i % 5 === 0 ? 2 : 0),
    ...(i < 2 ? { legendes: [{ type: 'chapeau', run: 'a', extra: 3 }, { type: 'quaranteButs', run: 'a' }, { type: 'coupe', run: 'a' }, { type: 'bourreau', run: 'b', extra: 'MTL' }, { type: 'dixButs', run: 'c' }] } : {}) }])),
    coachs: { '1976-77_MTL': { n: 'Scotty Bowman', cle: 'etoiles', rang: 1, fiche: '60-8-12', r: 4 }, '1998-99_STL': { n: 'Joel Quenneville', cle: 'tortue', rang: 6, fiche: '37-32-13', r: 1 } } };
  const page = await ouvrir(null, RICHE, CARTABLE);
  await mesurer(page, 'le départ, ses crans');
  meta.present.push(['les crans du départ', await page.$$eval('#runModal .rn-crans [data-a="cran"]', l => l.length) === 4 && await page.$$eval('#runModal .rn-crans [data-a="cran"]:not([disabled])', l => l.length) === 3]);
  meta.present.push(['« Nouveau » au loto', await page.$$eval('#runModal .rn-loto .rn-puce', l => l.some(x => /Nouveau/.test(x.textContent)))]);
  for (const [nom, a, v] of [['le Club : la variété', 'club'], ['ton club', 'page', 'club'], ['ton club : les couleurs', 'rayon', 'palette'], ['l\'Album', 'page', 'album'], ['l\'Album, la page suivante', 'album-page', '1'], ['l\'Album : les gravées', 'album-seg', 'gravees'], ['l\'Album : les entraîneurs', 'album-seg', 'coachs'], ['le palmarès', 'page', 'palmares']]) {
    if (!await geste(page, a, v)) { fautes.defile.push(`${nom} : un geste manque (${a})`); continue; }
    // L'Album charge les saisons de sa page : ses six cartes arrivent, aucune tuile ne reste vide.
    if (nom.startsWith('l\'Album') && a !== 'album-seg') await page.waitForFunction(() => !document.querySelector('#runModal .rn-album .rn-vide'), null, { timeout: 20000 }).catch(() => {});
    await mesurer(page, nom);
    if (nom === 'l\'Album') meta.present.push(['l\'Album montre six vraies cartes, la plus belle d\'abord, et dit ses gravures', await page.$$eval('#runModal .rn-album .carton', l => l.length) === 6 && !await page.$('#runModal .rn-album .rn-vide') && /Le Chapeau|La Coupe|Le bourreau|Quarante buts|Dix buts/.test(await page.textContent('#runModal .rn-panneau.rn-on'))]);
  }
  // Le Club se ferme sur le départ, là d'où on venait.
  await geste(page, 'fermer-club');
  meta.present.push(['le Club se ferme sur le départ', !!await page.$('#runModal [data-a="prendre-coach"]')]);
  await page.close();
}
{
  // Le solde le plus chargé : les neuf familles de déblocages, une run arrêtée, les cinq philosophies d'une Dynastie.
  const AVANT = { jeu: 'v27', ecussons: 232, ecussonsAVie: 1700, deblocages: ['caisse1', 'garder1', 'plafond1', 'classeur1', 'monte_bronze_1', 'banc1', 'commanditaire1', 'packGardiens', 'plombiersPlus'], coupes: 1, runs: 20,
    jalons: { series: true, ronde: true, finale: true }, arret: { runs: 2, verse: 172 }, recompenses: {} };
  const page = await ouvrir(null, AVANT);
  await mesurer(page, 'le solde');
  await geste(page, 'solde-depart');
  meta.present.push(['le solde vu, le départ suit', !!await page.$('#runModal [data-a="prendre-coach"]')]);
  await page.close();
}
{
  // UNE RUN D'AVANT LA V30 (la run en carte) : le Rogue est devenu une saison, elle s'arrête à l'ouverture — ses médailles
  // gagnées versées une fois, le départ le dit, et la run gardée s'efface. Rouvrir ne verse rien de plus.
  const vieille = { v: 3, graine: 'vieille', numero: 2, regles: { exigence: 0, prime: 1 }, jetons: 34, actes: [{ pts: 9, tenu: true, medailles: 25 }, { pts: 6, tenu: false, medailles: 5 }], series: null, fin: null }, du = medaillesDe(vieille);
  const page = await ouvrir(vieille, { jeu: 'v28', ecussons: 10, ecussonsAVie: 10, runs: 3, recompenses: {}, solde: { avant: 0, rendu: 0, familles: [], voies: [], vu: true } });
  await mesurer(page, 'le départ, une run d\'avant arrêtée');
  const lu = () => page.evaluate(() => ({ run: localStorage.getItem('cap82_run'), m: JSON.parse(localStorage.getItem('cap82_rogue') || '{}').ecussons, mot: (document.querySelector('#runModal .rn-plan') || {}).textContent || '' }));
  const un = await lu();
  await geste(page, 'quitter');
  await page.click('#menuDepart [data-menu="rogue"]');
  await page.waitForSelector('#runModal .rn-plan [data-a="prendre-coach"]', { timeout: 60000 });
  const deux = await lu();
  meta.present.push([`une run d'avant s'arrête : ${du} médailles versées une fois, dites au départ, la run effacée`, du > 0 && un.run === null && un.m === 10 + du && un.mot.includes(`+${du} médailles`) && deux.m === un.m && !deux.mot.includes('médailles</span>')]);
  await page.close();
}
const tableaux = {};
for (const [cle, suites] of Object.entries(SUITES)) {
  if (!saves[cle]) continue;
  // Le marché et les pochettes s'ouvrent la caisse garnie : la pièce, la carte à monter et une pochette s'y paient.
  if (cle === 'bilan' || cle === 'resultat') saves[cle].jetons = Math.max(saves[cle].jetons, 80);
  const page = await ouvrir(saves[cle]);
  await mesurer(page, NOMS[cle]);
  for (const [nom, gestes] of suites) {
    let ok = true;
    for (const [a, v] of gestes) ok = (await geste(page, a.replace(/\?$/, ''), v) || a.endsWith('?')) && ok;
    if (!ok) { fautes.defile.push(`${nom} : un geste manque (${gestes.map(x => x[0]).join(', ')})`); continue; }
    if (nom.startsWith('la feuille')) await page.waitForTimeout(1200);
    if (nom === 'le match fini') await page.waitForTimeout(900);
    const m = await mesurer(page, nom);
    if (m && m.cadre) tableaux[nom] = m.cadre;
  }
  await page.close();
}
await browser.close();

const VOULUES = ['le départ', ...Object.keys(SUITES).filter(k => !FACULTATIVES.includes(k)).flatMap(k => [NOMS[k], ...SUITES[k].map(x => x[0])]),
  'le départ, ses crans', 'le Club : la variété', 'ton club', 'ton club : les couleurs', 'l\'Album', 'l\'Album, la page suivante', 'l\'Album : les gravées', 'l\'Album : les entraîneurs', 'le palmarès', 'le solde', 'le départ, une run d\'avant arrêtée'];
exiger('chaque scène du devis s\'ouvre', VOULUES.every(n => vues.includes(n)), VOULUES.filter(n => !vues.includes(n)).join(', ') || `${vues.length} scènes`);
exiger('entre deux runs : les crans et la philosophie neuve au départ, le Club qui se ferme d\'où on vient, le solde puis le départ, une run d\'avant arrêtée', meta.present.every(x => x[1]), meta.present.filter(x => !x[1]).map(x => x[0]).join(' · ') || `${meta.present.length} gestes`);
exiger('la scène ne défile jamais : un plan de 390 × 844', !fautes.defile.length, fautes.defile.slice(0, 4).join(' · '));
exiger('rien du site ne dépasse : ni en-tête, ni barre du site', !fautes.dehors.length, fautes.dehors.slice(0, 4).join(' · '));
exiger('seul le cadre d\'un tableau défile, en lui-même, à sa place', !fautes.cadre.length, fautes.cadre.slice(0, 4).join(' · ') || `${Object.keys(tableaux).length} tableaux`);
const C = tableaux['le classement'];
exiger('le classement montre les trente-deux clubs et la ligne des séries, et s\'ouvre sur ton club', !!C && C.lignes === 32 && C.coupe && C.moiVu === true, C ? `${C.lignes} clubs, la ligne ${C.coupe ? 'tracée' : 'absente'}, ton club ${C.moiVu ? 'à l\'écran' : 'hors du cadre'}` : 'pas de tableau');
exiger('l\'alignement montre tes vingt-trois', !!tableaux['l\'alignement'] && tableaux['l\'alignement'].lignes >= 23, tableaux['l\'alignement'] ? `${tableaux['l\'alignement'].lignes} lignes` : 'pas de tableau');
exiger('aucun bloc ne passe sous les boutons du bas ni sous les onglets', !fautes.couvert.length, fautes.couvert.slice(0, 4).join(' · '));
exiger('le HUD est toujours au même endroit', !fautes.hud.length && !!hud0, fautes.hud.slice(0, 4).join(' · ') || `ses cœurs à ${hud0 ? hud0.join(',') : '?'}`);
exiger('chaque cible fait 44 × 44', !fautes.cibles.length, fautes.cibles.slice(0, 5).join(' · '));
exiger('chaque cible tient dans l\'écran', !fautes.bord.length, fautes.bord.slice(0, 4).join(' · '));
exiger('aucune erreur de page', !erreurs.length, [...new Set(erreurs)].slice(0, 3).join(' · '));
informer('les scènes', vues.join(' · '));
verdict('Les scènes du Rogue à 390 × 844');
