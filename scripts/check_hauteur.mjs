/*
 * UN CHOIX TIENT EN UN ÉCRAN (V25 B2, 6 nov. 2026 ; JP, 5 nov. : *trois petites côte à côte*). Dans Chromium, à
 * 390 × 844 : la page chargée, un vrai choix du jeu ouvert par sa vraie porte — ton identité, avant le premier tour d'un
 * repêchage (`choisirIdentite`, js/partie.js ; `ouvrirChoix`, js/gerant.js), trois cartes de jeu — et on mesure :
 *
 *   1. tout tient en un écran : la feuille du choix ne défile pas (le récit, les trois cartes, « Prendre ») ;
 *   2. trois cartes de front, sur une seule rangée, chacune large d'au moins 90 px (un pouce) ;
 *   3. chaque nom se lit sur la plaque de sa carte, sans déborder, à 9 px au moins ;
 *   4. une petite carte retournée se rapproche : au verso, elle grossit d'au moins une fois et demie et son texte se
 *      lit (10 px de haut au moins) ;
 *   5. « Prendre » rend la carte touchée et ferme le choix ;
 *   6. aucune erreur de page.
 *
 * La scène d'une voix et le joueur nommé au-dessus des cartes étaient aux choix de l'ancien Rogue : partis avec lui
 * (V28, tranche 4). Les scènes de la run en carte ont leur juge, `check_scene`.
 *
 *   node scripts/check_hauteur.mjs http://localhost:8000 [dossier]       (une dizaine de secondes ; une capture dans le dossier ;
 *                                                                         `GRAINE=…` un autre tirage des trois identités)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { exiger, informer, verdict } from './verdict.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const erreursPage = [];
page.on('pageerror', e => erreursPage.push(e.message));
// Les trois identités offertes se tirent au hasard de la page : semé, le même choix s'ouvre à chaque passe.
const GRAINE = process.env.GRAINE || 'hauteur';
await page.addInitScript(g => {
  let x = 0;
  for (const c of g) x = (Math.imul(x, 31) + c.charCodeAt(0)) >>> 0;
  Math.random = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}, GRAINE);
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');

const lu = await page.evaluate(async () => {
  const { choisirIdentite } = await import('./js/partie.js');
  const prises = [];
  choisirIdentite().then(k => prises.push(k));
  await new Promise(r => setTimeout(r, 900));
  const m = document.querySelector('#choixModal'), feuille = m.querySelector('.choix-sheet'), corps = m.querySelector('.choix-corps');
  const cartes = [...m.querySelectorAll('.choix-main > .tc')];
  const rect = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, bas: r.bottom }; };
  const nomLisible = e => { const r = e.getBoundingClientRect(); return { texte: e.textContent.trim(), px: parseFloat(getComputedStyle(e).fontSize), deborde: e.scrollWidth > e.clientWidth + 1, visible: r.width > 0 && r.height > 0 }; };
  const avant = {
    titre: (m.querySelector('.choix-titre') || {}).textContent || '',
    feuille: { defile: feuille.scrollHeight > feuille.clientHeight + 1 || corps.scrollHeight > corps.clientHeight + 1, bas: Math.max(feuille.getBoundingClientRect().bottom, corps.getBoundingClientRect().bottom) },
    cartes: cartes.map(c => ({ ...rect(c), cle: (c.querySelector('[data-choix]') || { dataset: {} }).dataset.choix, nom: nomLisible(c.querySelector('.carton:not(.tc-verso) .tc-nom')), prendre: !!c.querySelector('.tc-prendre') })),
  };
  // La carte du milieu se retourne : elle doit grossir et son texte se lire.
  const face = cartes[1].querySelector('button.tc-face');
  const l0 = rect(face);
  face.click();
  await new Promise(r => setTimeout(r, 1200));
  const l1 = rect(face);
  const lignes = [...cartes[1].querySelectorAll('.tc-verso .tc-quoi')].map(e => e.getBoundingClientRect().height);
  return { ...avant, prises, retournee: { avant: l0.w, apres: l1.w, auVerso: face.classList.contains('au-verso'), lignes, droite: l1.x + l1.w, gauche: l1.x } };
});
await page.screenshot({ path: `${DOSSIER}/hauteur-choix.png` });
// « Prendre » sous la première carte : le choix rend sa clé et se ferme.
const pris = await page.evaluate(async () => {
  const { choisirIdentite } = await import('./js/partie.js');
  const rendus = [];
  choisirIdentite().then(k => rendus.push(k));
  await new Promise(r => setTimeout(r, 600));
  const b = document.querySelector('#choixModal .choix-main > .tc .tc-prendre');
  const cle = b.dataset.choix;
  b.click();
  await new Promise(r => setTimeout(r, 700));
  return { cle, rendus, ferme: document.querySelector('#choixModal').hidden };
});
await browser.close();

informer('le choix ouvert', `« ${lu.titre} » · ${lu.cartes.length} cartes (${lu.cartes.map(c => c.nom.texte).join(', ')}) · GRAINE=${GRAINE}`);
exiger('tout tient en un écran : la feuille ne défile pas et finit au-dessus de 844 px', !lu.feuille.defile && lu.feuille.bas <= 844, `bas à ${Math.round(lu.feuille.bas)} px${lu.feuille.defile ? ', elle défile' : ''}`);
const rangee = lu.cartes.length === 3 && lu.cartes.every(c => Math.abs(c.y - lu.cartes[0].y) < 2);
exiger('trois cartes de front, sur une seule rangée, chacune large d\'un pouce au moins (90 px)', rangee && lu.cartes.every(c => c.w >= 90), lu.cartes.map(c => `${Math.round(c.w)} × ${Math.round(c.h)} px à y=${Math.round(c.y)}`).join(' · '));
exiger('chaque carte a son « Prendre »', lu.cartes.every(c => c.prendre), `${lu.cartes.filter(c => c.prendre).length} sur ${lu.cartes.length}`);
const noms = lu.cartes.map(c => c.nom);
exiger('le nom sur la plaque de chaque carte se lit : visible, 9 px au moins, sans déborder', noms.every(n => n.visible && n.px >= 9 && !n.deborde), noms.map(n => `${n.px.toFixed(1)} px${n.deborde ? ' (déborde)' : ''}`).join(' · '));
exiger('une petite carte retournée se rapproche : au verso, elle grossit d\'au moins une fois et demie, sans sortir de l\'écran', lu.retournee.auVerso && lu.retournee.apres >= lu.retournee.avant * 1.5 && lu.retournee.gauche >= 0 && lu.retournee.droite <= 390, `${Math.round(lu.retournee.avant)} → ${Math.round(lu.retournee.apres)} px, de ${Math.round(lu.retournee.gauche)} à ${Math.round(lu.retournee.droite)}`);
exiger('son texte se lit au verso (10 px de haut au moins)', lu.retournee.lignes.length > 0 && lu.retournee.lignes.every(h => h >= 10), `${lu.retournee.lignes.length} bloc(s), de ${Math.round(Math.min(...lu.retournee.lignes, 999))} px`);
exiger('rien n\'est pris tant qu\'on lit', lu.prises.length === 0, lu.prises.length ? `déjà rendu : ${lu.prises.join(', ')}` : 'rien');
exiger('« Prendre » rend la carte touchée et ferme le choix', pris.rendus.length === 1 && pris.rendus[0] === pris.cle && pris.ferme, `touchée ${pris.cle}, rendu ${JSON.stringify(pris.rendus)}${pris.ferme ? '' : ', le choix reste ouvert'}`);
exiger('aucune erreur de page', !erreursPage.length, erreursPage.join(' · ') || 'aucune');
verdict('Un choix tient en un écran');
