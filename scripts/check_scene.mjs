/*
 * UNE SCÈNE, JAMAIS UNE PAGE (V28, docs/refonte-v28.md § 4.1, § 10 ; JP : *on dirait pas un vrai jeu*). Des robots
 * (scripts/lib/run_robot.mjs) jouent des runs par les fonctions du jeu et gardent une sauvegarde à chaque sorte de scène ;
 * Chromium, à 390 × 844, ouvre chacune par le menu (« Le Rogue ») comme une partie reprise, et on mesure :
 *
 *   1. les scènes du devis sont toutes là : le départ, le camp, la porte ouverte, l'échange, le rival annoncé, la carte,
 *      les Lignes, le banc, la feuille du soir, le duel, le match, le marché, le vestiaire, l'histoire, la fin d'acte, les
 *      séries, la fin, la pause ; et celles d'entre deux runs (tranche 5), ouvertes d'un méta semé : le départ d'un club
 *      qui a gagné (ses crans, la philosophie neuve), le Club (la variété, ton club, ses couleurs, le palmarès), le solde
 *      d'un méta d'avant ;
 *   2. aucune ne défile, et rien du site ne dépasse : ni en-tête, ni barre d'onglets (chaque point de l'écran est dans
 *      la scène) ;
 *   3. le HUD est toujours au même endroit (ses cœurs au même pixel) ;
 *   4. chaque cible fait 44 × 44 (scripts/lib/cibles.mjs), et tient dans l'écran ;
 *   5. aucune erreur de page.
 *
 *   node scripts/check_scene.mjs http://localhost:8000 [dossier]     (une minute et demie ; une capture par scène dans le dossier)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { exiger, informer, verdict } from './verdict.mjs';
import { ciblesTropPetites } from './lib/cibles.mjs';
import { jouerLaRun } from './lib/run_robot.mjs';
import { figer } from '../js/run.js';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || null;
const LARGEUR = 390, HAUTEUR = 844, GRAINES_MAX = 60;
/* Les sauvegardes voulues, et les gestes qui mènent de chacune à d'autres scènes : [la scène, ses gestes]. */
const SUITES = {
  camp: [['la porte ouverte', [['ouvrir-porte', '0']]], ['l\'échange', [['vers-echange']]]],
  annonce: [],
  carte: [['les Lignes', [['lignes']]], ['les Lignes, une carte tenue', [['case']]], ['le banc', [['fermer-lignes'], ['banc']]], ['la pause', [['fermer-banc'], ['pause']]]],
  'feuille-match': [['le match', [['jouer']]], ['le match fini', [['fin-du-match?']]]],
  'feuille-rival': [],
  portes: [],
  marche: [],
  vestiaire: [],
  histoire: [],
  finacte: [],
  series: [],
  fin: [['le Club, après une run', [['club']]]],
};
const NOMS = { camp: 'le camp', annonce: 'le rival annoncé', carte: 'la carte de l\'acte', 'feuille-match': 'la feuille du soir', 'feuille-rival': 'la feuille du duel', portes: 'les trois portes',
  marche: 'le marché', vestiaire: 'le vestiaire', histoire: 'une histoire', finacte: 'la fin d\'acte', series: 'les séries', fin: 'la fin de run' };

/* ---------- les sauvegardes : une par sorte de scène, tirées de vraies runs ---------- */
const saves = {};
const garde = (nom, S) => { if (nom in SUITES && !saves[nom]) saves[nom] = JSON.parse(JSON.stringify(figer(S))); };
for (let g = 1; g <= GRAINES_MAX && Object.keys(SUITES).some(k => !saves[k]); g++) {
  jouerLaRun('malin', g, { espion: (m, S) => {
    const R = S.R;
    if (m === 'portes') garde(R.phase === 'camp' ? 'camp' : R.apres && !(R.apres.offertes || []).length ? 'portes' : '', S);
    else if (m === 'case') garde(R.phase === 'feuille' ? `feuille-${R.case.sorte}` : R.phase, S);
    else if (m === 'match' && R.phase === 'finacte' && !R.apres.fin) garde('finacte', S);
    else if (m === 'match' && R.phase === 'series') garde('series', S);
    else if (m === 'fin') garde('fin', S);
  } });
}
/* L'annonce et la carte se lisent de la sauvegarde du camp : le camp passé, la run annonce son rival, puis ouvre sa carte. */
exiger('une sauvegarde par sorte de scène, tirée de vraies runs', Object.keys(SUITES).filter(k => !['annonce', 'carte'].includes(k)).every(k => saves[k]), Object.keys(SUITES).filter(k => !saves[k] && !['annonce', 'carte'].includes(k)).join(', ') || `${Object.keys(saves).length} sauvegardes`);

/* ---------- le navigateur ---------- */
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const erreurs = [], fautes = { defile: [], dehors: [], hud: [], cibles: [], bord: [], couvert: [] }, vues = [];
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
    const bords = [...plan.querySelectorAll('[data-a]')].filter(el => !el.disabled).map(el => ({ el, b: el.getBoundingClientRect() })).filter(({ b }) => b.width > 0 && (b.left < -0.5 || b.top < -0.5 || b.right > L + 0.5 || b.bottom > H + 0.5)).map(({ el }) => `${el.dataset.a}${el.dataset.v ? `=${el.dataset.v}` : ''}`);
    // Un panneau ne passe jamais sous le compte ni sous les boutons du bas : ce qui déborde se lit à moitié.
    const boite = el => el.getBoundingClientRect(), dessous = [...plan.querySelectorAll('.rn-cellules, .rn-bas')].map(boite);
    const couverts = [...plan.querySelectorAll('.rn-panneau')].map(boite).filter(p => p.height > 0 && dessous.some(d => d.top > p.top && p.bottom > d.top + 1 && p.left < d.right && p.right > d.left)).length;
    return { couverts, defile: de.scrollHeight > H + 1 || de.scrollWidth > L + 1 || racine.scrollHeight > racine.clientHeight + 1 || plan.scrollHeight > plan.clientHeight + 1,
      plan: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], dehors, hud: rc ? [Math.round(rc.left), Math.round(rc.top)] : null, bords };
  }, { L: LARGEUR, H: HAUTEUR });
  if (!m) { fautes.defile.push(`${nom} : aucune scène`); return; }
  vues.push(nom);
  if (m.defile || m.plan.join() !== `0,0,${LARGEUR},${HAUTEUR}`) fautes.defile.push(`${nom} (${m.plan.join(' ')})`);
  if (m.dehors) fautes.dehors.push(`${nom} : ${m.dehors} points hors de la scène`);
  if (m.couverts) fautes.couvert.push(`${nom} : ${m.couverts} panneau${m.couverts > 1 ? 'x' : ''}`);
  if (m.hud) { if (!hud0) hud0 = m.hud; else if (m.hud.join() !== hud0.join()) fautes.hud.push(`${nom} : ${m.hud.join(',')} au lieu de ${hud0.join(',')}`); }
  if (m.bords.length) fautes.bord.push(`${nom} : ${m.bords.slice(0, 3).join(', ')}`);
  const petites = await ciblesTropPetites(page);
  if (petites.length) fautes.cibles.push(`${nom} : ${petites.slice(0, 3).join(' | ')}`);
  if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/scene-${String(vues.length).padStart(2, '0')}-${nom.replace(/[^a-zà-ü]+/gi, '-')}.png` });
}
async function ouvrir(R, meta = null) {
  const page = await browser.newPage({ viewport: { width: LARGEUR, height: HAUTEUR }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce' });
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([r, m]) => { localStorage.clear(); if (r) localStorage.setItem('cap82_run', JSON.stringify(r)); if (m) localStorage.setItem('cap82_rogue', JSON.stringify(m)); }, [R, meta]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
  await page.click('#menuDepart [data-menu="rogue"]');
  await page.waitForSelector('#runModal .rn-plan [data-a]', { timeout: 60000 });
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
 * ENTRE DEUX RUNS (tranche 5, docs/refonte-v28-5.md). Un club qui a gagné : deux Coupes (ses crans), une philosophie tout
 * juste ouverte (sa case au loto), des médailles à dépenser. Puis un méta d'avant la V28, qui ouvre sur son solde.
 */
const meta = { present: [] };
{
  const RICHE = { ecussons: 300, ecussonsAVie: 900, voies: ['rapaces'], nouvelle: 'rapaces', coupes: 2, exigence: 1, cran: 1, runs: 12, jalons: { series: true, ronde: true },
    meilleur: { pts: 27, ronde: 3, coupe: true }, club: { club: 'harfangs', palette: 'etoiles', pris: ['club:harfangs'] }, recompenses: {}, solde: { avant: 0, rendu: 0, familles: [], voies: [], vu: true } };
  const page = await ouvrir(null, RICHE);
  await mesurer(page, 'le départ, ses crans');
  meta.present.push(['les crans du départ', await page.$$eval('#runModal .rn-crans [data-a="cran"]', l => l.length) === 4 && await page.$$eval('#runModal .rn-crans [data-a="cran"]:not([disabled])', l => l.length) === 3]);
  meta.present.push(['« Nouveau » au loto', await page.$$eval('#runModal .rn-loto .rn-puce', l => l.some(x => /Nouveau/.test(x.textContent)))]);
  for (const [nom, a, v] of [['le Club : la variété', 'club'], ['ton club', 'page', 'club'], ['ton club : les couleurs', 'rayon', 'palette'], ['le palmarès', 'page', 'palmares']]) {
    if (!await geste(page, a, v)) { fautes.defile.push(`${nom} : un geste manque (${a})`); continue; }
    await mesurer(page, nom);
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
for (const [cle, suites] of Object.entries(SUITES)) {
  if (!saves[cle]) continue;
  const page = await ouvrir(saves[cle]);
  if (cle.startsWith('feuille')) await page.waitForTimeout(1200);
  await mesurer(page, NOMS[cle]);
  for (const [nom, gestes] of suites) {
    let ok = true;
    // Un geste marqué « ? » est facultatif : en mouvement réduit, le match saute seul à sa fin.
    for (const [a, v] of gestes) ok = (await geste(page, a.replace(/\?$/, ''), v) || a.endsWith('?')) && ok;
    if (!ok) { fautes.defile.push(`${nom} : un geste manque (${gestes.map(x => x[0]).join(', ')})`); continue; }
    if (nom === 'le match fini') await page.waitForTimeout(900);
    await mesurer(page, nom);
  }
  // Du camp, la run mène au rival annoncé puis à la carte : trois portes passées.
  if (cle === 'camp') {
    await geste(page, 'fermer-echange'); await geste(page, 'fermer-porte');
    for (let k = 0; k < 4 && await page.$('#runModal [data-a="passer"]:not([disabled])'); k++) await geste(page, 'passer');
    await mesurer(page, NOMS.annonce);
    await geste(page, 'vers-carte');
    await mesurer(page, NOMS.carte);
    for (const [nom, gestes] of SUITES.carte) { for (const [a, v] of gestes) await geste(page, a, v); await mesurer(page, nom); }
  }
  await page.close();
}
await browser.close();

const VOULUES = ['le départ', 'le camp', 'la porte ouverte', 'l\'échange', 'le rival annoncé', 'la carte de l\'acte', 'les Lignes', 'les Lignes, une carte tenue', 'le banc', 'la pause', 'la feuille du soir',
  'le match', 'le match fini', 'la feuille du duel', 'les trois portes', 'le marché', 'le vestiaire', 'une histoire', 'la fin d\'acte', 'les séries', 'la fin de run',
  'le départ, ses crans', 'le Club : la variété', 'ton club', 'ton club : les couleurs', 'le palmarès', 'le solde', 'le Club, après une run'];
exiger('chaque scène du devis s\'ouvre', VOULUES.every(n => vues.includes(n)), VOULUES.filter(n => !vues.includes(n)).join(', ') || `${vues.length} scènes`);
exiger('entre deux runs : les crans et la philosophie neuve au départ, le Club qui se ferme d\'où on vient, le solde puis le départ', meta.present.every(x => x[1]), meta.present.filter(x => !x[1]).map(x => x[0]).join(' · ') || `${meta.present.length} repères`);
exiger('aucune scène ne défile : un plan de 390 × 844', !fautes.defile.length, fautes.defile.slice(0, 4).join(' · '));
exiger('rien du site ne dépasse : ni en-tête, ni barre d\'onglets', !fautes.dehors.length, fautes.dehors.slice(0, 4).join(' · '));
exiger('aucun panneau ne passe sous le compte ni sous les boutons du bas', !fautes.couvert.length, fautes.couvert.slice(0, 4).join(' · '));
exiger('le HUD est toujours au même endroit', !fautes.hud.length && !!hud0, fautes.hud.slice(0, 4).join(' · ') || `ses cœurs à ${hud0 ? hud0.join(',') : '?'}`);
exiger('chaque cible fait 44 × 44', !fautes.cibles.length, fautes.cibles.slice(0, 5).join(' · '));
exiger('chaque cible tient dans l\'écran', !fautes.bord.length, fautes.bord.slice(0, 4).join(' · '));
exiger('aucune erreur de page', !erreurs.length, [...new Set(erreurs)].slice(0, 3).join(' · '));
informer('les scènes', vues.join(' · '));
verdict('Une scène, jamais une page');
