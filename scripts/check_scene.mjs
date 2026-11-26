/*
 * LES SCÈNES DU ROGUE, DU TÉLÉPHONE À L'ORDINATEUR (V30, docs/refonte-v30-2.md § 3.8, § 9 ; JP, 16 nov. 2026 : *bureau EHM,
 * match illustré* ; V31, docs/refonte-v31.md § 9 ; JP, 25 nov. 2026 : *tout le Rogue en fluide*). Un robot
 * (scripts/lib/run_robot.mjs) joue des saisons par les fonctions du jeu et garde une sauvegarde à chaque sorte de scène ;
 * Chromium ouvre chacune par le menu (« Le Rogue ») comme une partie reprise, et on mesure.
 *
 * À 390 × 844, TOUTES LES SCÈNES :
 *   1. les scènes du devis sont toutes là : le départ, les pièces, le repêchage, l'ouverture du quart, le bureau et ses
 *      onglets (l'alignement, un joueur tenu, le banc, la masse, le classement, les meneurs, les gardiens de la ligue, la
 *      cédule, la page d'un club, mon club, ses gardiens, ses matchs, un match passé), les pochettes, la pause, la feuille du
 *      soir, l'affiche posée (le duel), le résultat et ses quatre vues, la pièce d'un rival battu, les trois portes, la porte
 *      ouverte, l'échange, le bilan, le marché du quart, les séries et leur feuille, la fin ; et celles d'entre deux runs,
 *      ouvertes d'un méta semé (le départ et ses crans, le Club et ses pages, l'Album d'un cartable semé, le solde, une run
 *      d'avant qui s'arrête) ;
 *   2. aucune scène ne fait défiler la page, et rien du site ne dépasse ; une scène en plan fixe (pas encore refaite) ne
 *      défile jamais ; dans une scène neuve, une boîte nommée (`data-defile`) défile à sa place, jamais dans une autre, et
 *      de côté seulement si c'est un tableau de stats (son nom figé à gauche, sa tête en haut) ; un milieu qui ne défile pas
 *      ne coupe rien de ce qu'il porte ;
 *   3. l'en-tête est toujours au même endroit (son écusson et ses cœurs au même pixel) ;
 *   4. chaque cible fait 44 × 44 (scripts/lib/cibles.mjs), et tient dans l'écran ;
 *   5. aucun panneau ne passe sous les boutons du bas ni sous les onglets ;
 *   6. le classement montre les trente-deux clubs, la ligne des séries, et s'ouvre sur ton club ;
 *   7. une scène neuve ne pose rien au pixel, et son bouton qui avance est dans le bas, à l'écran ;
 *   8. aucune erreur de page.
 * À CINQ AUTRES ÉCRANS (360 × 640, 820 × 1180, 844 × 390, 1366 × 650, 1440 × 900), LES SCÈNES NEUVES — le soir, du résultat
 * d'hier à celui de ce soir par le bureau et ses onglets : les mêmes mesures, puis ce que chaque écran promet (à 360 × 640
 * rien ne rapetisse et un tableau garde sa place ; à la tablette deux colonnes ; à l'ordinateur trois colonnes, tes
 * vingt-trois sans défiler, quatorze colonnes sans glisser, une ligne qui répond au survol). À 390 × 844, 820 × 1180 et
 * 1440 × 900, aucun milieu ne défile hors d'un tableau.
 * ET CE QUI S'OUVRE DU SOIR (V31, tranche 2, docs/refonte-v31-2.md) — les pochettes, les trois portes, la porte ouverte,
 * l'échange, la pièce gagnée, une histoire, le ballottage — aux mêmes écrans : ce qu'on te tend et ton côté côte à côte
 * quand l'écran est large ou couché, d'un trait sinon ; les portes en rangée large ; une porte montre plus de joueurs quand
 * il y a la place (de front par la largeur, en rangées par la hauteur), sa tuile revient à la première page ; aucune carte
 * ne passe 190 px ; aucun texte d'étal n'est coupé ; ce qui décide est à l'écran sans défiler (la tuile des autres, les
 * « Prendre » d'une histoire dans le bas, le plafond d'après sur « Signer ») ; Échap à une pochette payée ouvre la pause ; au
 * clavier, on arrive aux portes sur une porte.
 * Le ballottage et une histoire s'ouvrent si une des saisons jouées en garde une sauvegarde ; sinon ils s'impriment absents.
 *
 *   node scripts/check_scene.mjs http://localhost:8000 [dossier]     (six minutes ; une capture par scène dans le dossier,
 *                                                                     et une par scène et par écran ; `NETTETE=2` : nettes)
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
 * [a] ou [a, v]. En mouvement réduit, « Au match » va droit au résultat : le direct (js/direct.js) s'éprouve dans `essai_run`.
 */
const ONGLETS = [['l\'alignement', [['onglet', 'alignement']]], ['l\'alignement, un joueur tenu', [['case']]], ['le banc', [['seg-a', 'banc']]], ['la masse', [['onglet', 'masse']]],
  ['le classement', [['onglet', 'ligue']]], ['les meneurs', [['seg-l', 'meneurs']]], ['les meneurs, triés par le +/−', [['tri-l', 'pm']]], ['les gardiens de la ligue', [['seg-l', 'gardiens']]], ['la cédule', [['seg-l', 'cedule']]],
  ['la page d\'un club', [['seg-l', 'classement'], ['club-vu', '3']]], ['mon club', [['fermer-club-vu'], ['onglet', 'club']]], ['mon club, trié par les buts', [['tri', 'b']]],
  ['mes gardiens', [['seg-c', 'gardiens']]], ['mes matchs', [['seg-c', 'matchs']]], ['un match passé', [['match-vu', '0']]], ['un match passé, sa feuille', [['seg-m', 'feuille']]],
  ['les pochettes', [['fermer-match-vu'], ['onglet', 'bureau'], ['etal']]], ['la pause', [['fermer-etal'], ['pause']]]];
const SUITES = {
  pieces: [],
  repechage: [],
  quart: [],
  resultat: [['le résultat, le récit', [['seg-r', 'recit']]], ['le résultat, les chiffres', [['seg-r', 'chiffres']]], ['le résultat, la feuille', [['seg-r', 'feuille']]], ['le bureau', [['continuer']]], ...ONGLETS,
    ['la feuille du soir', [['reprendre'], ['aller']]], ['la feuille, l\'affiche posée', [['affiche', '1']]], ['le résultat d\'une affiche', [['jouer']]]],
  piece: [['la pièce d\'un rival battu', [['continuer']]]],
  portes: [['l\'échange', [['vers-echange']]]],
  bilan: [['le marché du quart', [['apres-bilan']]], ['le marché, une autre carte à monter', [['voir-montee']]]],
  elite: [['la feuille de l\'élite', [['aller']]], ['la feuille de l\'élite, l\'enjeu mis', [['enjeu', '1']]]],
  histoire: [['une histoire', [['ouvrir-histoire']]]],
  ballottage: [],
  serie: [['les séries', [['continuer']]], ['la feuille des séries', [['match-de-serie']]]],
  fin: [['le Club, après une run', [['club']]]],
};
const NOMS = { pieces: 'le repêchage d\'un club imposé', repechage: 'le repêchage', quart: 'l\'ouverture du quart', resultat: 'le résultat', piece: 'le résultat, un rival battu', portes: 'les trois portes', bilan: 'le bilan du quart',
  elite: 'le bureau, l\'élite ce soir', histoire: 'le bureau, une histoire', ballottage: 'le ballottage', serie: 'le résultat, en séries', fin: 'la fin de run' };
const FACULTATIVES = ['histoire', 'ballottage', 'elite'];

/* ---------- les sauvegardes : une par sorte de scène, tirées de vraies saisons ---------- */
const saves = {};
const garde = (nom, S) => { if (nom in SUITES && !saves[nom]) saves[nom] = JSON.parse(JSON.stringify(figer(S))); };
for (let g = 1; g <= GRAINES_MAX && Object.keys(SUITES).some(k => k !== 'pieces' && !saves[k]); g++) {
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
// Un club imposé : le cartable est l'effectif d'une saison jouée ; dix-sept en sortent, il reste six tours.
if (saves.portes) saves.pieces = JSON.parse(JSON.stringify(figer(creerLaRun(DONNEES, { graine: 'scene', coach: { cle: 'essaim' }, cartable: saves.portes.joueurs.map(j => j.k) }))));
const manquent = Object.keys(SUITES).filter(k => !saves[k] && !FACULTATIVES.includes(k));
exiger('une sauvegarde par sorte de scène, tirée de vraies saisons', !manquent.length, manquent.join(', ') || `${Object.keys(saves).length} sauvegardes`);
informer('les scènes facultatives', FACULTATIVES.map(k => `${k} : ${saves[k] ? 'gardée' : 'absente de ces saisons'}`).join(' · '));

/* ---------- le navigateur ---------- */
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const erreurs = [], fautes = { defile: [], dehors: [], hud: [], cibles: [], bord: [], couvert: [], cadre: [], neuf: [], ecrans: [] }, vues = [];
// L'en-tête de chaque écran (son écusson, ses cœurs), et les écrans où un milieu doit tenir sans défiler.
const huds = new Map(), ecussons = new Map(), HAUTS = ['390 × 844', '820 × 1180', '1440 × 900'];
if (DOSSIER) fs.mkdirSync(DOSSIER, { recursive: true });

async function mesurer(page, nom, { garde = true } = {}) {
  await page.waitForTimeout(350);
  const { width: L, height: H } = page.viewportSize();
  const m = await page.evaluate(({ L, H }) => {
    const racine = document.getElementById('runModal'), plan = racine && racine.querySelector('.rn-plan');
    if (!plan) return null;
    const de = document.scrollingElement, r = plan.getBoundingClientRect(), fluide = true, boite = el => el.getBoundingClientRect();
    // Chaque point d'une grille de l'écran est dans la scène : rien du site ne dépasse.
    let dehors = 0;
    for (let x = 6; x < L; x += 54) for (let y = 6; y < H; y += 52) { const el = document.elementFromPoint(x, y); if (!el || !racine.contains(el)) dehors++; }
    const coeurs = plan.querySelector('.rn-hud .rn-coeurs'), rc = coeurs && boite(coeurs), ecusson = plan.querySelector('.rn-hud > :first-child'), re = ecusson && boite(ecusson);
    // Ce qu'on touche tient dans l'écran ; ce qui est dans une boîte qui défile se juge par sa boîte.
    const bords = [...plan.querySelectorAll('[data-a]')].filter(el => !el.disabled && !el.closest('[data-defile]')).map(el => ({ el, b: boite(el) })).filter(({ b }) => b.width > 0 && (b.left < -0.5 || b.top < -0.5 || b.right > L + 0.5 || b.bottom > H + 0.5)).map(({ el }) => el.dataset.a);
    // Un panneau, une boîte ou une rangée de boutons ne passe jamais sous les boutons du bas ni sous les onglets : ce qui déborde se lit à moitié.
    const dessous = [...plan.querySelectorAll('.rn-cellules, .rn-bas, .rn-onglets')].filter(el => !el.closest('[data-defile]')).map(boite);
    const sous = p => p.height > 0 && dessous.some(d => d.top > p.top && p.bottom > d.top + 1 && p.left < d.right && p.right > d.left);
    // Ni une cible qu'on touche, où qu'elle soit (une réponse d'histoire dont le texte s'allonge poussait son « Prendre » sous « Plus tard »).
    // (La pause est par-dessus la scène, pas dessous : ses boutons ne se jugent pas contre le bas qu'elle couvre.)
    const cibles = [...plan.querySelectorAll('[data-a]')].filter(el => !el.disabled && !el.closest('[data-defile], .rn-bas, .rn-onglets, .rn-pauseur'));
    // Ni un texte coupé par son bloc : ce qu'un étal dit sous chaque carte (la réponse d'une histoire, une pièce, une pochette), la réplique, le fait.
    const coupes = [...plan.querySelectorAll('.rn-etal p, .rn-bulle, .rn-fait .rn-t')].filter(p => p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1).length;
    // Les boîtes qui défilent : chacune dans l'écran, sous l'en-tête ; de côté, seulement celle d'un tableau de stats. Sur un écran
    // très court, ce qui coiffe un tableau défile avec lui : sa boîte se juge alors par le milieu qui la porte.
    const boites = [...plan.querySelectorAll('[data-defile]')], haut = el => el.scrollHeight > el.clientHeight + 1, cote = el => el.scrollWidth > el.clientWidth + 1;
    const portee = b => boites.some(a => a !== b && a.contains(b) && haut(a) && /auto|scroll/.test(getComputedStyle(a).overflowY));
    const couverts = [...[...plan.querySelectorAll('.rn-panneau, .rn-bas')].filter(el => !el.closest('[data-defile]')), ...[...plan.querySelectorAll('.rn-boite')].filter(b => !portee(b)), ...cibles].map(boite).filter(sous).length + coupes;
    const horsPlace = boites.filter(b => { const x = boite(b); return x.height > 0 && ((!portee(b) && (x.top < 53 || x.bottom > H + 0.5 || x.left < -0.5 || x.right > L + 0.5)) || (cote(b) && !b.querySelector('.rn-large'))); }).map(b => b.dataset.defile);
    // Jamais une boîte qui défile de haut en bas dans une autre ; et un milieu qui ne défile pas ne coupe rien de ce qu'il porte.
    const defile = el => /auto|scroll/.test(getComputedStyle(el).overflowY);
    const imbriquees = boites.filter(b => haut(b) && defile(b) && boites.some(a => a !== b && a.contains(b) && haut(a) && defile(a))).map(b => b.dataset.defile);
    const coupe = [...plan.querySelectorAll('.rn-milieu')].filter(el => !defile(el) && (haut(el) || cote(el))).length;
    const tab = plan.querySelector('.rn-boite'), bc = tab && boite(tab), moi = tab && tab.querySelector('.rn-moi'), bm = moi && boite(moi);
    // Une scène neuve ne pose rien au pixel (la jauge du plafond exceptée : sa place vient des données), et son bouton qui avance est dans le bas, à l'écran.
    const coords = fluide ? [...plan.querySelectorAll('[style]')].filter(el => !el.closest('.rn-plaf') && /(^|;)\s*(left|right|top|bottom|inset)\s*:/.test(el.getAttribute('style'))).length : 0;
    const avance = fluide ? [...plan.querySelectorAll('.rn-bt:is(.go, .rn-combat)')].filter(b => { const x = boite(b); return !b.closest('.rn-bas') || x.bottom > H + 0.5 || x.top < 0 || x.right > L + 0.5; }).length : 0;
    return { fluide, couverts, horsPlace, imbriquees, coupe, coords, avance, lecture: [...plan.querySelectorAll('.rn-lecture, .rn-col, .rn-comptoir')].some(haut),
      defile: de.scrollHeight > H + 1 || de.scrollWidth > L + 1 || racine.scrollHeight > racine.clientHeight + 1 || plan.scrollHeight > plan.clientHeight + 1,
      plan: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], dehors, bords,
      ecusson: (() => { const e = plan.querySelector('.rn-hud > :first-child'); return e ? [Math.round(boite(e).left), Math.round(boite(e).top)] : null; })(),
      hud: rc ? [Math.round(rc.left), Math.round(rc.top), re ? Math.round(re.left) : 0, re ? Math.round(re.top) : 0] : null,
      cadre: bc ? { glisse: !!tab.querySelector('.rn-large'), lignes: tab.querySelectorAll('.rn-l:not(.rn-tete):not(.rn-unite):not(.rn-coupe)').length, coupe: !!tab.querySelector('.rn-coupe'), moiVu: bm ? bm.top >= bc.top && bm.bottom <= bc.bottom : null } : null };
  }, { L, H });
  if (!m) { fautes.defile.push(`${nom} : aucune scène`); return null; }
  const ecran = `${L} × ${H}`, ici = garde ? nom : `${nom} à ${ecran}`;
  if (garde) vues.push(nom);
  // Une scène en plan fixe est au centre, à sa taille ; une scène neuve prend l'écran. Ni l'une ni l'autre ne fait défiler la page.
  if (m.defile || (garde && m.plan.join() !== `0,0,${L},${H}`) || (m.fluide && m.plan.join() !== `0,0,${L},${H}`)) fautes.defile.push(`${ici} (${m.plan.join(' ')})`);
  // Aux écrans de référence, aucun milieu ne défile hors d'un tableau.
  if (m.lecture && HAUTS.includes(ecran)) fautes.defile.push(`${ici} : son milieu défile`);
  if (m.dehors) fautes.dehors.push(`${ici} : ${m.dehors} points hors de la scène`);
  if (m.couverts) fautes.couvert.push(`${ici} : ${m.couverts} bloc${m.couverts > 1 ? 's' : ''}`);
  if (m.horsPlace.length) fautes.cadre.push(`${ici} : ${m.horsPlace.join(', ')} sort de sa place ou défile de côté`);
  if (m.imbriquees.length) fautes.cadre.push(`${ici} : ${m.imbriquees.join(', ')} défile dans une boîte qui défile`);
  if (m.coupe) fautes.cadre.push(`${ici} : son milieu coupe ce qu'il porte`);
  if (m.coords) fautes.neuf.push(`${ici} : ${m.coords} position${m.coords > 1 ? 's' : ''} au pixel`);
  if (m.avance) fautes.neuf.push(`${ici} : le bouton qui avance hors du bas ou de l'écran`);
  // L'en-tête au même endroit : l'écusson et les cœurs, dans toutes les scènes d'un même écran (les scènes en plan fixe, à 390 × 844 seulement).
  // … et l'écusson, avec ou sans run (le départ, le repêchage, la fin, le Club, le solde).
  if (m.ecusson) { const e0 = ecussons.get(ecran); if (!e0) ecussons.set(ecran, m.ecusson); else if (m.ecusson.join() !== e0.join()) fautes.hud.push(`${ici} : l'écusson à ${m.ecusson.join(',')} au lieu de ${e0.join(',')}`); }
  if (m.hud && (m.fluide || garde)) { const h0 = huds.get(ecran); if (!h0) huds.set(ecran, m.hud); else if (m.hud.join() !== h0.join()) fautes.hud.push(`${ici} : ${m.hud.join(',')} au lieu de ${h0.join(',')}`); }
  if (m.bords.length) fautes.bord.push(`${ici} : ${m.bords.slice(0, 3).join(', ')}`);
  const petites = await ciblesTropPetites(page);
  if (petites.length) fautes.cibles.push(`${ici} : ${petites.slice(0, 3).join(' | ')}`);
  if (DOSSIER) await page.screenshot({ path: garde ? `${DOSSIER}/scene-${String(vues.length).padStart(2, '0')}-${nom.replace(/[^a-zà-ü]+/gi, '-')}.png` : `${DOSSIER}/ecran-${L}x${H}-${nom.replace(/[^a-zà-ü]+/gi, '-')}.png` });
  return m;
}
async function ouvrir(R, meta = null, cartable = null, [largeur, hauteur] = [LARGEUR, HAUTEUR]) {
  const page = await browser.newPage({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: Number(process.env.NETTETE) || 1, hasTouch: largeur < 1000, reducedMotion: 'reduce' });
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
  // Une cible couverte (sous le bas, sous un voisin) ne se touche pas : c'est une faute nommée, pas un juge qui plante.
  const touche = await el.click({ timeout: 6000 }).then(() => true, () => false);
  if (!touche) { const { width, height } = page.viewportSize(); fautes.couvert.push(`${a}${v == null ? '' : ` ${v}`} à ${width} × ${height} : la cible ne se touche pas`); return false; }
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
  meta.present.push(['ton entraîneur tiré pour toi, et « Commencer »', !!await page.$('#runModal .rn-vignette .rn-c') && !!await page.$('#runModal [data-a="prendre-coach"]')]);
  for (const [nom, a, v] of [['le Club : le contrôle', 'club'], ['le Club : la variété', 'page', 'variete'],['ton club', 'page', 'club'], ['ton club : les couleurs', 'rayon', 'palette'], ['l\'Album', 'page', 'album'], ['l\'Album, la page suivante', 'album-page', '1'], ['l\'Album : les gravées', 'album-seg', 'gravees'], ['l\'Album : les entraîneurs', 'album-seg', 'coachs'], ['le palmarès', 'page', 'palmares']]) {
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
    for (const [a, v] of gestes) ok = await geste(page, a, v) && ok;
    if (!ok) { fautes.defile.push(`${nom} : un geste manque (${gestes.map(x => x[0]).join(', ')})`); continue; }
    if (nom.startsWith('la feuille')) await page.waitForTimeout(1200);
    const m = await mesurer(page, nom);
    if (m && m.cadre) tableaux[nom] = m.cadre;
    // Un tableau de stats glisse de côté dans sa boîte : glissé au bout, sa dernière colonne se lit, le nom n'a pas bougé, la tête non plus.
    if (m && m.cadre && m.cadre.glisse) tableaux[nom].fige = await page.$eval('#runModal .rn-boite', el => {
      const b = el.getBoundingClientRect(), l = el.querySelector('.rn-l:not(.rn-tete)'), t = el.querySelector('.rn-tete');
      if (!l || !t || el.scrollWidth <= el.clientWidth + 1) return false;
      el.scrollLeft = el.scrollWidth; el.scrollTop = 40;
      const nomB = l.firstElementChild.getBoundingClientRect(), fin = l.lastElementChild.getBoundingClientRect(), tete = t.getBoundingClientRect();
      const ok = Math.abs(nomB.left - b.left) <= 2 && fin.right <= b.right + 1 && fin.left >= nomB.right - 1 && Math.abs(tete.top - b.top) <= 2;
      el.scrollLeft = 0; el.scrollTop = 0;
      return ok;
    });
    if (nom === 'le résultat, la feuille' || nom === 'un match passé, sa feuille') tableaux[nom].patineurs = await page.$$eval('#runModal .som-feuille-table', l => l.map(t => t.querySelectorAll('tbody tr').length));
  }
  await page.close();
}
/*
 * LES AUTRES ÉCRANS (V31, docs/refonte-v31.md § 9 ; JP, 25 nov. 2026 : *tout le Rogue en fluide*). Les scènes neuves — le
 * soir, du résultat d'hier au résultat de ce soir, par le bureau et ses onglets — rouvertes de la même sauvegarde à cinq
 * autres écrans : un petit téléphone, une tablette debout, un téléphone couché, un portable court, un ordinateur. À chacun,
 * les mesures de toutes les scènes (rien ne déborde, aucune boîte qui défile dans une autre, l'en-tête au même pixel, le
 * bouton qui avance dans le bas, aucune position au pixel, chaque cible de 44), puis ce que cet écran-là promet.
 */
const ECRANS = [[360, 640], [820, 1180], [844, 390], [1366, 650], [1440, 900]];
/* [la scène, ses gestes] ; un geste est [a, v, facultatif] : en large, un segment déplié n'a plus le bouton de sa seconde vue. */
const PARCOURS = [['le résultat, la feuille', [['seg-r', 'feuille']]], ['le bureau', [['continuer']]], ['l\'alignement', [['onglet', 'alignement']]], ['le banc', [['seg-a', 'banc']]],
  ['la masse', [['onglet', 'masse']]], ['le classement', [['onglet', 'ligue']]], ['les meneurs', [['seg-l', 'meneurs']]], ['la cédule', [['seg-l', 'cedule', true]]],
  ['la page d\'un club', [['seg-l', 'classement'], ['club-vu', '3']]], ['mon club', [['fermer-club-vu'], ['onglet', 'club']]], ['mes matchs', [['seg-c', 'matchs', true]]], ['un match passé', [['match-vu', '0']]],
  ['la pause', [['fermer-match-vu'], ['onglet', 'bureau'], ['pause']]], ['les pochettes', [['reprendre'], ['etal']]], ['la pochette ouverte', [['pochette']]], ['la feuille du soir', [['rien-signer'], ['aller']]], ['le résultat du soir', [['jouer']]]];
/* Ce qui s'ouvre du soir (V31, tranche 2) : [la sauvegarde, [la scène, ses gestes]…] ; une histoire et le ballottage, si une saison en garde une. */
const OUVERTS = [['portes', [['les trois portes', []], ['l\'échange', [['vers-echange']]]]], ['piece', [['la pièce gagnée', [['continuer']]]]],
  ['histoire', [['une histoire', [['ouvrir-histoire']]]]], ['ballottage', [['le ballottage', []]]],
  // La saison (tranche 3) : le repêchage d'un club imposé, l'ouverture du quart, le bilan et son marché, la fin et le Club.
  ['pieces', [['le repêchage', []]]], ['quart', [['l\'ouverture du quart', []]]], ['bilan', [['le bilan', []], ['le marché', [['apres-bilan']]]]], ['fin', [['la fin', []], ['le Club', [['club']]]]]];
const E = {};
/* Ce qu'un écran promet d'une scène : ses panneaux, ses colonnes, ses boîtes, ce qui se coupe. */
const lire = page => page.evaluate(() => {
  const plan = document.querySelector('#runModal .rn-plan'), m = plan.querySelector('.rn-milieu'), b = el => { const r = el.getBoundingClientRect(); return { g: r.left, h: r.top, d: r.right, b: r.bottom }; };
  const coupe = el => el.scrollWidth > el.clientWidth + 1;
  return { milieu: m ? b(m) : null, panneaux: [...plan.querySelectorAll('.rn-milieu .rn-panneau')].map(b), colonnes: plan.querySelectorAll('.rn-milieu > .rn-col').length,
    // Un comptoir : ses deux blocs (ce qu'on te tend, ton côté) ; les portes ; les joueurs d'une porte et sa tuile ; la plus large des cartes.
    blocs: [...plan.querySelectorAll('.rn-comptoir > .rn-col')].filter(x => x.offsetHeight > 0).map(b), offres: plan.querySelectorAll('.rn-etal > *').length,
    joueurs: [...plan.querySelectorAll('.rn-grille [data-a="voir-joueur"]')].map(x => x.dataset.v), tuile: (plan.querySelector('.rn-plie') || {}).textContent || '',
    carte: Math.max(0, ...[...plan.querySelectorAll('.rn-milieu .rn-c')].map(x => x.getBoundingClientRect().width)), onglets: !!plan.querySelector('.rn-onglets') && plan.querySelector('.rn-onglets').offsetHeight > 0,
    // Ce qui décide est à l'écran : la tuile qui mène aux autres joueurs, les réponses d'une histoire dans le bas, ce que « Signer » dit.
    tuileVue: (() => { const t = plan.querySelector('.rn-plie'); if (!t) return null; const r = t.getBoundingClientRect(), c = t.closest('[data-defile]').getBoundingClientRect(); return r.top >= c.top - 1 && r.bottom <= Math.min(c.bottom, innerHeight) + 1; })(),
    reponses: [plan.querySelectorAll('.rn-bas [data-a="reponse"]').length, plan.querySelectorAll('.rn-milieu .rn-deux > div').length], signer: ((plan.querySelector('.rn-bas [data-a="signer"] small') || {}).textContent || ''),
    soir: plan.querySelector('.rn-p-soir') ? b(plan.querySelector('.rn-p-soir')) : null, proprio: plan.querySelector('.rn-p-proprio') ? b(plan.querySelector('.rn-p-proprio')) : null,
    boites: Object.fromEntries([...plan.querySelectorAll('[data-defile]')].map(x => [x.dataset.defile, { haut: x.scrollHeight > x.clientHeight + 1, cote: x.scrollWidth > x.clientWidth + 1, lignes: x.querySelectorAll('.rn-l:not(.rn-tete):not(.rn-unite):not(.rn-coupe)').length, colonnes: x.querySelector('.rn-tete') ? x.querySelector('.rn-tete').children.length : 0 }])),
    coupes: [...plan.querySelectorAll('.rn-large .rn-l:not(.rn-tete) > :first-child, .rn-alig .rn-l:not(.rn-tete):not(.rn-unite) > :nth-child(2)')].filter(coupe).length };
});
if (saves.resultat) for (const ecran of ECRANS) {
  const cle = `${ecran[0]} × ${ecran[1]}`, page = await ouvrir(saves.resultat, null, null, ecran);
  E[cle] = {};
  await mesurer(page, 'le résultat', { garde: false });
  for (const [nom, gestes] of PARCOURS) {
    let ok = true;
    for (const [a, v, facultatif] of gestes) ok = (await geste(page, a, v) || !!facultatif) && ok;
    if (!ok) { fautes.ecrans.push(`${nom} à ${cle} : un geste manque (${gestes.map(x => x[0]).join(', ')})`); continue; }
    if (nom === 'la feuille du soir') await page.waitForTimeout(1200);
    await mesurer(page, nom, { garde: false });
    E[cle][nom] = await lire(page);
    // Une pochette payée, ouverte : Échap ouvre la pause, il n'y renonce pas ; Échap encore, et la pochette est toujours là.
    if (nom === 'la pochette ouverte' && ecran[0] >= 1000) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const pause = !!await page.$('#runModal .rn-pauseur');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      E[cle].echap = pause && !await page.$('#runModal .rn-pauseur') && !!await page.$('#runModal [data-a="rien-signer"]');
    }
    // Un tableau garde sa place : défilé au bas des lignes, le dernier joueur tenu, la boîte n'a pas bougé.
    if (nom === 'l\'alignement' && E[cle][nom].boites.lignes && E[cle][nom].boites.lignes.haut) {
      const y0 = await page.$eval('#runModal [data-defile="lignes"]', el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
      await (await page.$$('#runModal [data-defile="lignes"] [data-a="case"]')).at(-1).click();
      await page.waitForTimeout(350);
      E[cle].place = [y0, await page.$eval('#runModal [data-defile="lignes"]', el => el.scrollTop)];
      await (await page.$$('#runModal [data-defile="lignes"] [data-a="case"]')).at(-1).click();
      await page.waitForTimeout(250);
    }
    // À la souris, une ligne qu'on survole répond.
    if (nom === 'le classement' && ecran[0] >= 1000) {
      const fond = () => page.$eval('#runModal [data-defile="classement"] button.rn-l:not(.rn-moi)', el => getComputedStyle(el).backgroundColor);
      const avant = await fond();
      await page.hover('#runModal [data-defile="classement"] button.rn-l:not(.rn-moi)');
      await page.waitForTimeout(150);
      E[cle].survol = [avant, await fond()];
      await page.mouse.move(2, 2);
    }
  }
  await page.close();
  // Ce qui s'ouvre du soir, chacun de sa sauvegarde.
  for (const [save, scenes] of OUVERTS) {
    if (!saves[save]) continue;
    const p2 = await ouvrir(saves[save], null, null, ecran);
    for (const [nom, gestes] of scenes) {
      let ok = true;
      for (const [a, v] of gestes) ok = await geste(p2, a, v) && ok;
      if (!ok) { fautes.ecrans.push(`${nom} à ${cle} : un geste manque (${gestes.map(x => x[0]).join(', ')})`); continue; }
      // Aux portes, au clavier : « Entrée » sans rien de tenu pose le focus, et il arrive sur une porte, jamais sur « Passer ».
      if (nom === 'les trois portes' && ecran[0] >= 1000) { await p2.keyboard.press('Enter'); await p2.waitForTimeout(200); E[cle].focus = await p2.evaluate(() => (document.activeElement && document.activeElement.dataset.a) || ''); }
      await mesurer(p2, nom, { garde: false });
      E[cle][nom] = await lire(p2);
      // La tuile qui mène aux autres : de page en page, elle revient aux premiers joueurs.
      if (nom === 'le repêchage' && / de (\d+)/.test(E[cle][nom].tuile)) {
        const pages = Number(E[cle][nom].tuile.match(/ de (\d+)/)[1]), vus = [E[cle][nom].joueurs.join()];
        for (let k = 0; k < pages; k++) { await geste(p2, 'page-porte'); vus.push((await lire(p2)).joueurs.join()); }
        E[cle].tour = { pages, autres: new Set(vus.slice(0, pages)).size, retour: vus[pages] === vus[0] };
      }
    }
    await p2.close();
  }
}
await browser.close();

const VOULUES = ['le départ', ...Object.keys(SUITES).filter(k => !FACULTATIVES.includes(k)).flatMap(k => [NOMS[k], ...SUITES[k].map(x => x[0])]),
  'le départ, ses crans', 'le Club : la variété', 'ton club', 'ton club : les couleurs', 'l\'Album', 'l\'Album, la page suivante', 'l\'Album : les gravées', 'l\'Album : les entraîneurs', 'le palmarès', 'le solde', 'le départ, une run d\'avant arrêtée'];
exiger('chaque scène du devis s\'ouvre', VOULUES.every(n => vues.includes(n)), VOULUES.filter(n => !vues.includes(n)).join(', ') || `${vues.length} scènes`);
exiger('entre deux runs : les crans et la philosophie neuve au départ, le Club qui se ferme d\'où on vient, le solde puis le départ, une run d\'avant arrêtée', meta.present.every(x => x[1]), meta.present.filter(x => !x[1]).map(x => x[0]).join(' · ') || `${meta.present.length} gestes`);
exiger('aucune scène ne fait défiler la page ; à 390 × 844, 820 × 1180 et 1440 × 900, aucun milieu ne défile hors d\'un tableau', !fautes.defile.length, fautes.defile.slice(0, 4).join(' · '));
exiger('rien du site ne dépasse : ni en-tête, ni barre du site', !fautes.dehors.length, fautes.dehors.slice(0, 4).join(' · '));
exiger('une boîte qui défile reste à sa place, jamais dans une autre ; de côté, seulement un tableau de stats', !fautes.cadre.length, fautes.cadre.slice(0, 4).join(' · ') || `${Object.keys(tableaux).length} tableaux`);
const C = tableaux['le classement'];
exiger('le classement montre les trente-deux clubs et la ligne des séries, et s\'ouvre sur ton club', !!C && C.lignes === 32 && C.coupe && C.moiVu === true, C ? `${C.lignes} clubs, la ligne ${C.coupe ? 'tracée' : 'absente'}, ton club ${C.moiVu ? 'à l\'écran' : 'hors du cadre'}` : 'pas de tableau');
const GL = ['le classement', 'les meneurs', 'les meneurs, triés par le +/−', 'les gardiens de la ligue', 'la page d\'un club', 'mon club', 'mon club, trié par les buts', 'mes gardiens'].map(n => [n, tableaux[n]]);
exiger('un tableau de stats glisse de côté dans son cadre, le nom figé à gauche et la tête en haut', GL.every(([, t]) => t && t.glisse && t.fige === true), GL.map(([n, t]) => `${n} : ${t && t.glisse ? (t.fige ? 'figé' : 'le nom ou la tête bouge') : 'ne glisse pas'}`).join(' · '));
const FM = tableaux['le résultat, la feuille'];
exiger('le résultat est le sommaire du match : sa feuille dit les patineurs des deux clubs', !!FM && FM.patineurs.length === 2 && FM.patineurs.every(n => n >= 15), FM ? `${FM.patineurs.join(' et ')} patineurs` : 'pas de feuille');
const MP = tableaux['un match passé, sa feuille'], MM = tableaux['mes matchs'];
exiger('un match passé se rouvre de Mon club : sa feuille de match gardée dit encore les patineurs des deux clubs', !!MP && MP.patineurs.length === 2 && MP.patineurs.every(n => n >= 15) && !!MM && MM.lignes >= 1, MP ? `${MP.patineurs.join(' et ')} patineurs` : 'pas de feuille');
exiger('l\'alignement montre tes vingt-trois', !!tableaux['l\'alignement'] && tableaux['l\'alignement'].lignes >= 23, tableaux['l\'alignement'] ? `${tableaux['l\'alignement'].lignes} lignes` : 'pas de tableau');
exiger('aucun bloc ni aucune cible ne passe sous les boutons du bas ni sous les onglets, aucune réponse d\'histoire n\'est coupée', !fautes.couvert.length, fautes.couvert.slice(0, 4).join(' · '));
exiger('l\'en-tête est toujours au même endroit : son écusson et ses cœurs au même pixel, à chaque écran', !fautes.hud.length && huds.size === ECRANS.length + 1, fautes.hud.slice(0, 4).join(' · ') || [...huds].map(([e, h]) => `${e} : ${h.slice(0, 2).join(',')}`).join(' · '));
// ---- les autres écrans (V31) ----
{
  const e = (ecran, nom) => (E[ecran] || {})[nom] || null, bas = (x, k) => Math.max(0, ...x.panneaux.map(p => p[k]));
  exiger('le soir s\'ouvre à cinq autres écrans, du petit téléphone à l\'ordinateur', !fautes.ecrans.length && ECRANS.every(([l, h]) => PARCOURS.every(([nom]) => (E[`${l} × ${h}`] || {})[nom])), fautes.ecrans.slice(0, 4).join(' · ') || `${ECRANS.map(x => x.join(' × ')).join(' · ')} : ${PARCOURS.length + 1} scènes chacun`);
  exiger('une scène neuve ne pose rien au pixel, et son bouton qui avance est dans le bas, à l\'écran', !fautes.neuf.length, fautes.neuf.slice(0, 4).join(' · '));
  const P = e('360 × 640', 'le bureau');
  exiger('à 360 × 640, rien ne rapetisse : ce soir et le proprio se lisent sans défiler', !!P && !!P.soir && !!P.proprio && P.soir.h >= P.milieu.h - 1 && P.proprio.b <= P.milieu.b + 1, P && P.proprio ? `le proprio finit à ${Math.round(P.proprio.b)} px, le milieu à ${Math.round(P.milieu.b)}` : 'pas de bureau');
  const place = (E['360 × 640'] || {}).place;
  exiger('un tableau garde sa place : défilé au bas des lignes, le dernier joueur tenu, la boîte n\'a pas bougé', !!place && place[0] > 0 && Math.abs(place[0] - place[1]) <= 1, place ? `${Math.round(place[0])} px, puis ${Math.round(place[1])}` : 'pas mesuré');
  const T = e('820 × 1180', 'le bureau');
  exiger('à la tablette, le bureau tient en deux colonnes et ses panneaux descendent à la moitié du milieu', !!T && T.colonnes === 2 && bas(T, 'b') - T.milieu.h >= 0.5 * (T.milieu.b - T.milieu.h), T ? `${T.colonnes} colonnes, jusqu'à ${Math.round((100 * (bas(T, 'b') - T.milieu.h)) / (T.milieu.b - T.milieu.h))} % du milieu` : 'pas de bureau');
  const G = e('1440 × 900', 'le bureau');
  exiger('à l\'ordinateur, le bureau s\'étale : trois colonnes, six panneaux dont le haut est à l\'écran, jusqu\'à 85 % de la largeur et 60 % de la hauteur', !!G && G.colonnes === 3 && G.panneaux.length >= 6 && G.panneaux.every(p => p.h < G.milieu.b) && bas(G, 'd') >= 0.85 * 1440 && bas(G, 'b') - G.milieu.h >= 0.6 * (G.milieu.b - G.milieu.h),
    G ? `${G.colonnes} colonnes, ${G.panneaux.length} panneaux, jusqu'à ${Math.round(bas(G, 'd'))} px de large et ${Math.round((100 * (bas(G, 'b') - G.milieu.h)) / (G.milieu.b - G.milieu.h))} % du milieu` : 'pas de bureau');
  const A = e('1440 × 900', 'l\'alignement'), M = e('1440 × 900', 'mon club');
  exiger('… tes vingt-trois se lisent à l\'Alignement sans défiler', !!A && !!A.boites.avants && !!A.boites.arriere && !A.boites.avants.haut && !A.boites.arriere.haut && A.boites.avants.lignes + A.boites.arriere.lignes >= 23, A && A.boites.avants ? `${A.boites.avants.lignes} avants et ${A.boites.arriere.lignes} à l'arrière` : 'pas deux boîtes');
  exiger('… et le tableau de Mon club montre ses quatorze colonnes sans glisser, tes matchs à côté', !!M && !!M.boites.patineurs && !M.boites.patineurs.cote && M.boites.patineurs.colonnes === 15 && !!M.boites.matchs, M && M.boites.patineurs ? `${M.boites.patineurs.colonnes - 1} colonnes` : 'pas de tableau');
  const survol = (E['1440 × 900'] || {}).survol;
  exiger('… à la souris, une ligne qu\'on survole répond', !!survol && survol[0] !== survol[1], survol ? survol.join(' → ') : 'pas mesuré');
  const coupes = ECRANS.map(([l, h]) => `${l} × ${h}`).map(k => [k, (e(k, 'le classement') || {}).coupes, (e(k, 'l\'alignement') || {}).coupes]);
  exiger('aucun nom de club coupé au classement, à aucun écran', coupes.every(([, c]) => c === 0), coupes.map(([k, c]) => `${k} : ${c}`).join(' · '));
  informer('les noms de joueurs coupés à l\'Alignement', coupes.map(([k, , a]) => `${k} : ${a}`).join(' · '));
}
// ---- ce qui s'ouvre du soir (V31, tranche 2) ----
{
  const ecrans = ECRANS.map(([l, h]) => `${l} × ${h}`), e = (ecran, nom) => (E[ecran] || {})[nom] || null;
  const scenes = ['les pochettes', 'la pochette ouverte', ...OUVERTS.filter(([save]) => saves[save]).flatMap(([, l]) => l.map(x => x[0]))], manquent = ecrans.flatMap(k => scenes.filter(n => !e(k, n)).map(n => `${n} à ${k}`));
  exiger('ce qui s\'ouvre du soir s\'ouvre aux cinq autres écrans : les pochettes, une pochette ouverte, les trois joueurs, l\'échange, la pièce gagnée, le repêchage', ['les pochettes', 'la pochette ouverte', 'les trois portes', 'l\'échange', 'la pièce gagnée', 'le repêchage'].every(n => scenes.includes(n)) && !manquent.length, manquent.slice(0, 4).join(' · ') || `${scenes.length} scènes à ${ecrans.length} écrans`);
  // Le comptoir : côte à côte quand l'écran est large ou couché (la règle du rail), d'un trait sinon.
  const COMPTOIRS = scenes.filter(n => n !== 'le Club'), cote = x => x.blocs.length < 2 || x.blocs[1].g >= x.blocs[0].d - 1, trait = x => x.blocs.length < 2 || x.blocs[1].h >= x.blocs[0].b - 1;
  const faux = [...['844 × 390', '1366 × 650', '1440 × 900'].flatMap(k => COMPTOIRS.filter(n => e(k, n) && !cote(e(k, n))).map(n => `${n} à ${k} : d'un trait`)), ...['360 × 640', '820 × 1180'].flatMap(k => COMPTOIRS.filter(n => e(k, n) && !trait(e(k, n))).map(n => `${n} à ${k} : côte à côte`))];
  exiger('… ce qu\'on te tend et ton côté : côte à côte quand l\'écran est large ou couché, d\'un trait au téléphone et à la tablette debout', !faux.length, faux.slice(0, 4).join(' · ') || `${COMPTOIRS.length} scènes`);
  // Trois joueurs, un par vestiaire : trois tuiles de front, à chaque écran.
  const trois = ecrans.filter(k => e(k, 'les trois portes')).map(k => [k, e(k, 'les trois portes').offres]);
  exiger('… après un gros match gagné : trois joueurs de front, un par vestiaire, à chaque écran', trois.length === ecrans.length && trois.every(([, n]) => n === 3), trois.map(([k, n]) => `${k} : ${n}`).join(' · '));
  const G = e('1440 × 900', 'le repêchage'), g0 = e('360 × 640', 'le repêchage');
  exiger('… le repêchage montre plus de joueurs quand il y a la place : six tuiles au plus au téléphone, davantage à l\'ordinateur', !!G && !!g0 && g0.joueurs.length <= 6 && G.joueurs.length > g0.joueurs.length, G && g0 ? `${g0.joueurs.length} au téléphone, ${G.joueurs.length} à l'ordinateur` : 'pas de repêchage');
  const tour = (E['360 × 640'] || {}).tour;
  exiger('… la tuile qui mène aux autres passe par chaque page et revient à la première', !!tour && tour.pages > 1 && tour.autres === tour.pages && tour.retour, tour ? `${tour.pages} pages, ${tour.autres} différentes, ${tour.retour ? 'revenue' : 'pas revenue'} au début` : 'une seule page à 360 × 640');
  const larges = ecrans.flatMap(k => scenes.filter(n => e(k, n) && e(k, n).carte > 190).map(n => `${n} à ${k} : ${Math.round(e(k, n).carte)} px`));
  exiger('… aucune carte ne passe 190 px de large', !larges.length, larges.slice(0, 4).join(' · ') || `la plus large : ${Math.round(Math.max(0, ...ecrans.flatMap(k => scenes.map(n => (e(k, n) || {}).carte || 0))))} px`);
  // Ce qu'on consulte du bureau (la page d'un club, un match passé) garde le rail quand l'écran en a un, et n'a pas d'onglets sinon ; ce qui engage (les pochettes, une histoire) n'en a jamais.
  const DU_BUREAU = ['la page d\'un club', 'un match passé'], SANS = ['les pochettes', 'la pochette ouverte', 'une histoire'];
  const rails = [...['360 × 640', '820 × 1180'].flatMap(k => DU_BUREAU.filter(n => e(k, n) && e(k, n).onglets).map(n => `${n} à ${k} : des onglets`)), ...['844 × 390', '1366 × 650', '1440 × 900'].flatMap(k => DU_BUREAU.filter(n => e(k, n) && !e(k, n).onglets).map(n => `${n} à ${k} : pas de rail`)),
    ...ecrans.flatMap(k => SANS.filter(n => e(k, n) && e(k, n).onglets).map(n => `${n} à ${k} : des onglets`))];
  exiger('… ce qu\'on consulte du bureau garde le rail quand l\'écran en a un ; ce qui engage (les pochettes, une histoire) n\'a pas d\'onglets', !rails.length, rails.slice(0, 4).join(' · ') || [...DU_BUREAU, ...SANS].join(' · '));
  // Ce qui décide est à l'écran, sans défiler.
  const caches = [...ecrans.flatMap(k => ['le repêchage', 'la pochette ouverte'].filter(n => e(k, n) && e(k, n).tuileVue === false).map(n => `${n} à ${k} : la tuile des autres sous le pli`)),
    ...ecrans.filter(k => e(k, 'une histoire') && (e(k, 'une histoire').reponses[0] !== e(k, 'une histoire').reponses[1] || !e(k, 'une histoire').reponses[0])).map(k => `une histoire à ${k} : ${e(k, 'une histoire').reponses.join(' « Prendre » dans le bas pour ')} réponses`),
    ...ecrans.filter(k => e(k, 'l\'échange') && !/M\$|ne passe pas/.test(e(k, 'l\'échange').signer)).map(k => `l'échange à ${k} : « Signer » ne dit pas le plafond`)];
  exiger('… ce qui décide est à l\'écran sans défiler : la tuile des autres joueurs, les « Prendre » d\'une histoire dans le bas, le plafond d\'après sur « Signer »', !caches.length, caches.slice(0, 4).join(' · ') || `${ecrans.length} écrans`);
  const echap = ['1366 × 650', '1440 × 900'].map(k => [k, (E[k] || {}).echap]);
  exiger('… Échap à une pochette payée ouvre la pause : il n\'y renonce pas', echap.every(([, x]) => x === true), echap.map(([k, x]) => `${k} : ${x === true ? 'la pause, puis la pochette' : x === false ? 'la pochette est perdue' : 'pas essayé'}`).join(' · '));
  const focus = ['1366 × 650', '1440 × 900'].map(k => [k, (E[k] || {}).focus]);
  exiger('… au clavier, on arrive aux trois joueurs sur un joueur, jamais sur « Passer »', focus.every(([, f]) => f === 'voir-joueur'), focus.map(([k, f]) => `${k} : ${f || 'rien'}`).join(' · '));
}
exiger('chaque cible fait 44 × 44', !fautes.cibles.length, fautes.cibles.slice(0, 5).join(' · '));
exiger('chaque cible tient dans l\'écran', !fautes.bord.length, fautes.bord.slice(0, 4).join(' · '));
exiger('aucune erreur de page', !erreurs.length, [...new Set(erreurs)].slice(0, 3).join(' · '));
informer('les scènes', vues.join(' · '));
verdict('Les scènes du Rogue, du téléphone à l\'ordinateur');
