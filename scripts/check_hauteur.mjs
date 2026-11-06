/*
 * UN CHOIX TIENT EN UN ÉCRAN (V25 B2, 6 nov. 2026 ; JP, 5 nov. : *trois petites côte à côte* ; l'ancienne règle d'interface,
 * « jamais trois étroites côte à côte », est défaite ici). Dans Chromium, à 390 × 844 : la page chargée, un choix ouvert
 * par la vraie porte (`ouvrirChoix`, js/gerant.js) avec une scène, un joueur nommé et trois cartes de jeu, et on mesure :
 *
 *   1. tout tient en un écran : la feuille du choix ne défile pas (la scène, le joueur, les trois cartes, « Prendre ») ;
 *   2. trois cartes de front, sur une seule rangée, chacune large d'au moins 90 px (un pouce) ;
 *   3. chaque nom se lit : le nom du joueur dans son entête, et le nom sur la plaque de chaque carte, sans déborder,
 *      à 9 px au moins ;
 *   4. une petite carte retournée se rapproche : au verso, elle grossit d'au moins une fois et demie et ses lignes se
 *      lisent (10 px au moins) ;
 *   5. aucune erreur de page.
 *
 *   node scripts/check_hauteur.mjs http://localhost:8000 [dossier]       (une vingtaine de secondes ; une capture dans le dossier)
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
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');

// Le choix : la scène du physio, un vrai joueur d'un shard, trois cartes de trois niveaux (un geste, un dé, un moindre mal).
const lu = await page.evaluate(async () => {
  const [{ ouvrirChoix }, { sceneDeLaBlessure }] = await Promise.all([import('./js/gerant.js'), import('./js/scenes.js')]);
  const sh = await (await fetch('data/seasons/1985-86.json')).json();
  const p = sh.players.filter(x => x.p !== 'G' && (x.gp || 0) >= 60).sort((a, b) => (b.pts || 0) - (a.pts || 0))[0];
  ouvrirChoix({
    ico: '🩹', titre: 'Son aine le fait souffrir', boite: { msg: 'blessure' }, joueur: p, fermable: true,
    scene: sceneDeLaBlessure({ joueur: p.n, n: 3, ou: '2e trio', adv: 'Bruins', graine: 'hauteur' }),
    options: [
      { cle: 'soigner', ico: '💉', nom: 'Le soigner deux matchs', niveau: 1, gestes: { soin: 2 } },
      { cle: 'jouer', ico: '🎲', nom: 'Le laisser jouer', niveau: 2, pari: { chance: 0.5, gagne: { lui: { finition: 1.3 } }, perd: { lui: { blessure: 1.5 } } } },
      { cle: 'reposer', ico: '🛏', nom: 'Le reposer', niveau: 0, gestes: { absents: 2 } },
    ],
    onChoix: () => {}, lancer: () => null,
  });
  await new Promise(r => setTimeout(r, 900));
  const m = document.querySelector('#choixModal'), feuille = m.querySelector('.choix-sheet'), corps = m.querySelector('.choix-corps');
  const cartes = [...m.querySelectorAll('.choix-main > .tc')];
  const rect = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, bas: r.bottom }; };
  const nomLisible = e => { const r = e.getBoundingClientRect(); return { px: parseFloat(getComputedStyle(e).fontSize), deborde: e.scrollWidth > e.clientWidth + 1, visible: r.width > 0 && r.height > 0 }; };
  const entete = m.querySelector('.gj-joueur-nom');
  const avant = {
    joueur: p.n, scene: !!m.querySelector('.choix-corps > .scene'),
    feuille: { defile: feuille.scrollHeight > feuille.clientHeight + 1 || corps.scrollHeight > corps.clientHeight + 1, bas: Math.max(feuille.getBoundingClientRect().bottom, corps.getBoundingClientRect().bottom) },
    cartes: cartes.map(c => ({ ...rect(c), nom: nomLisible(c.querySelector('.carton:not(.tc-verso) .tc-nom')), prendre: !!c.querySelector('.tc-prendre') })),
    entete: entete ? { texte: entete.textContent, ...nomLisible(entete) } : null,
  };
  // La carte du milieu se retourne : elle doit grossir et ses lignes se lire.
  const face = cartes[1].querySelector('button.tc-face');
  const l0 = rect(face);
  face.click();
  await new Promise(r => setTimeout(r, 1200));
  const l1 = rect(face);
  const lignes = [...cartes[1].querySelectorAll('.tc-verso .puce:not(.detail), .tc-verso .impact-l, .tc-verso .tc-quoi')].map(e => e.getBoundingClientRect().height);
  return { ...avant, retournee: { avant: l0.w, apres: l1.w, auVerso: face.classList.contains('au-verso'), lignes, droite: l1.x + l1.w, gauche: l1.x } };
});
await page.screenshot({ path: `${DOSSIER}/hauteur-choix.png` });
await browser.close();

informer('le choix ouvert', `${lu.joueur} · ${lu.cartes.length} cartes${lu.scene ? ' · une scène' : ''}`);
exiger('tout tient en un écran : la feuille ne défile pas et finit au-dessus de 844 px', !lu.feuille.defile && lu.feuille.bas <= 844, `bas à ${Math.round(lu.feuille.bas)} px${lu.feuille.defile ? ', elle défile' : ''}`);
const rangee = lu.cartes.length === 3 && lu.cartes.every(c => Math.abs(c.y - lu.cartes[0].y) < 2);
exiger('trois cartes de front, sur une seule rangée, chacune large d\'un pouce au moins (90 px)', rangee && lu.cartes.every(c => c.w >= 90), lu.cartes.map(c => `${Math.round(c.w)} × ${Math.round(c.h)} px à y=${Math.round(c.y)}`).join(' · '));
exiger('chaque carte a son « Prendre »', lu.cartes.every(c => c.prendre), `${lu.cartes.filter(c => c.prendre).length} sur ${lu.cartes.length}`);
const noms = lu.cartes.map(c => c.nom);
exiger('le nom sur la plaque de chaque carte se lit : visible, 9 px au moins, sans déborder', noms.every(n => n.visible && n.px >= 9 && !n.deborde), noms.map(n => `${n.px.toFixed(1)} px${n.deborde ? ' (déborde)' : ''}`).join(' · '));
exiger('le joueur nommé se lit dans son entête', !!lu.entete && lu.entete.visible && lu.entete.texte.includes(lu.joueur) && lu.entete.px >= 11 && !lu.entete.deborde, lu.entete ? `« ${lu.entete.texte.trim().slice(0, 50)} » à ${lu.entete.px} px` : 'aucun entête');
exiger('une petite carte retournée se rapproche : au verso, elle grossit d\'au moins une fois et demie, sans sortir de l\'écran', lu.retournee.auVerso && lu.retournee.apres >= lu.retournee.avant * 1.5 && lu.retournee.gauche >= 0 && lu.retournee.droite <= 390, `${Math.round(lu.retournee.avant)} → ${Math.round(lu.retournee.apres)} px, de ${Math.round(lu.retournee.gauche)} à ${Math.round(lu.retournee.droite)}`);
exiger('ses lignes se lisent au verso (10 px de haut au moins, une ligne au moins)', lu.retournee.lignes.length > 0 && lu.retournee.lignes.every(h => h >= 10), `${lu.retournee.lignes.length} lignes, de ${Math.round(Math.min(...lu.retournee.lignes, 999))} px`);
exiger('aucune erreur de page', !erreursPage.length, erreursPage.join(' · ') || 'aucune');
verdict('Un choix tient en un écran');
