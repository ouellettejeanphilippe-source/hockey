/*
 * LE PLATEAU DU ROGUE, JUGÉ (4 nov. 2026). JP : *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne le
 * même* ; *pourquoi tu refais pas tout le UI au complet ?* ; *tout*. Les juges d'avant mesuraient que rien ne casse — jamais
 * que l'écran ressemble à la maquette ; chaque refonte repassait vert sans rien changer. Celui-ci lance une run du Rogue à
 * 390 × 844 et lit chaque page des cinq portes contre le CONTRAT du plateau (docs/ecrans-rogue.md, « Le plateau, de zéro ») :
 *
 *   partout     cinq portes dans l'ordre ; la porte ouverte sombre ; aucune PILULE BLANCHE (un bouton clair hors des cartes,
 *               la grammaire d'avant) ; l'en-tête sans filet de couleur ;
 *   Ce soir     le bandeau des résultats (dès le 2e jour), l'affiche-héros d'au moins 240 px, la jauge du proprio SOUS elle,
 *               ton banc en main de vraies cartes de jeu (.pl-grille-4), tes choix ;
 *   Proprio     le mandat en citation, ton rang avec la jauge, l'argent en cellules ;
 *   Lignes      les jetons d'unité, chaque trio debout (son nom en colonne verticale), trois cartes pleine colonne, une seule
 *               ligne sous chaque carte (le reste caché) ;
 *   Joueurs     les filtres en jetons, le tri en jetons, une grille de trois vraies cartes avec leur coin ;
 *   Coach       le niveau en gros, trois pouvoirs en vraies cartes de jeu ;
 *   Boutique    quatre pochettes du début avec leur prix, « Ton club » en rangée de quatre ;
 *   Album       les vues en jetons, l'édition en coin sur chaque carte de l'équipe dès Cadre (jamais sur une Base), rien dessous ;
 *   Classement  cinq colonnes (le contenu, de zéro : PJ est parti pour que « 10 derniers » tienne) ; Calendrier : trois billets de front, la grille ;
 *   Palmarès    l'échelle du prestige entière, une marche « tu es ici ».
 *
 * Une capture de chaque page va dans le dossier donné (le 3e argument ; scripts/ par défaut), pour l'œil.
 *   node scripts/check_plateau.mjs http://localhost:8000 [dossier]
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

// Le même départ que l'essai : un cartable, des médailles, une case de réserve ; le classeur tire, on prend, on commence.
const CARTES = ['1985-86_MNS_8445724', '1995-96_PIT_8446951', '2007-08_DET_8468083', '1985-86_MTL_8449796', '1985-86_NJD_8446484', '1985-86_NJD_8452516', '1985-86_NYI_8450314'];
await page.addInitScript(cartes => {
  if (localStorage.getItem('plateau')) return;
  localStorage.setItem('plateau', '1');
  localStorage.setItem('cap82_cartable', JSON.stringify({ v: 1, migre: true, hist: true, joueurs: Object.fromEntries(cartes.map((k, i) => [k, i === 1 ? { v: { commune: 3 }, n: 3 } : { v: i === 0 ? { rare: 1 } : { commune: 1 }, n: 1 }])) }));
  localStorage.setItem('cap82_rogue', JSON.stringify({ ecussons: 400, deblocages: ['banc1', 'caisse1', 'caisse2', 'classeur1'], collection: [], cartes: [], runs: 0, coupes: 1, jalons: {}, jeu: 'v21', inventaire: {} }));
}, CARTES);
const choix = async (sel = ':is(button.choix-option, .tc-prendre):not([disabled])') => { await page.waitForSelector(`#choixModal:not([hidden]) ${sel}`, { timeout: 60000 }); await page.click(`#choixModal:not([hidden]) ${sel}`); await page.waitForTimeout(300); };
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart');
await page.click('.menu-mode[data-genre="rogue"] [data-menu="nouvelle"]');
await page.waitForSelector('#choixModal:not([hidden]) .choix-option', { timeout: 60000 });
await choix('.choix-option[data-choix="go"]');
await page.waitForFunction(() => /Ton entraîneur/.test((document.querySelector('#choixModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
await choix();
await page.waitForFunction(() => /Ton joueur de concession/.test((document.querySelector('#signatureModal:not([hidden]) .choix-titre') || {}).textContent || ''), null, { timeout: 60000 });
await page.click('#signatureModal .sig-liste .btn-sign');
await page.waitForSelector('#departModal:not([hidden]) .pcard', { timeout: 60000 });
await page.click('#departModal [data-prendre]:not([disabled])');
await page.waitForTimeout(200);
await page.click('#departModal .dp-commencer');
await page.waitForFunction(() => document.querySelectorAll('.slot .slot-carte').length >= 20, null, { timeout: 90000 });
await page.waitForTimeout(500);
const b1 = await page.$('#mainBtn:not([disabled])');
if (b1) { await b1.click(); await page.waitForTimeout(1500); }
await page.click('#navbar .navtab[data-section="bureau"]').catch(() => {});
await page.waitForSelector('#hubModal:not([hidden])', { timeout: 60000 });
await page.waitForTimeout(600);

/* Ce que chaque page doit montrer, dans l'ordre ; `lire` tourne dans la page et rend un objet que `juger` lit. */
const PAGES = [
  { porte: 'bureau', page: 'match', nom: 'Ce soir', lire: () => {
    const q = s => document.querySelector(`#hubModal ${s}`);
    const haut = s => { const e = q(s); return e ? Math.round(e.getBoundingClientRect().top) : null; };
    return { hero: q('.bu-prochain') ? Math.round(q('.bu-prochain').getBoundingClientRect().height) : 0, plaques: q('.bu-prochain .bu-plaques') ? 1 : 0,
      ordre: [haut('.bu-prochain'), haut('.bu-run'), haut('.bu-banc')], main: document.querySelectorAll('#hubModal .bu-banc .pl-grille-4 .pl-carte').length, cartes: document.querySelectorAll('#hubModal .bu-banc .pl-carte .carton').length, boite: q('.hub-boite') ? 1 : 0 };
  }, juger: d => {
    exiger('Ce soir · l\'affiche-héros fait 240 px au moins, avec ses deux plaques', d.hero >= 240 && d.plaques, `${d.hero} px`);
    exiger('Ce soir · l\'affiche, puis la jauge du proprio, puis ton banc', d.ordre.every(x => x != null) && d.ordre[0] < d.ordre[1] && d.ordre[1] < d.ordre[2], d.ordre.join(' → '));
    exiger('Ce soir · ton banc est une main de vraies cartes de jeu, quatre de front', d.main >= 2 && d.cartes >= 1, `${d.main} cartes, ${d.cartes} cartons`);
    exiger('Ce soir · tes choix sont là', d.boite === 1);
  } },
  // Le face-à-face (4 nov. ; JP : *cette page n'est pas très lisible*) : l'affiche, une rangée par stat et par force à gros chiffres, aucun tableau.
  { porte: 'bureau', page: 'match', nom: 'Face à face', ouvrir: '#hubModal .bu-prochain', lire: () => ({ ff: !!document.querySelector('#hubModal .ff'), affiche: !!document.querySelector('#hubModal .ff .hub-face'), rangs: document.querySelectorAll('#hubModal .ff .ff-rang').length, gros: [...document.querySelectorAll('#hubModal .ff .ff-rang b')].every(b => parseFloat(getComputedStyle(b).fontSize) >= 16), tableau: !!document.querySelector('#hubModal .ff table'), bandeaux: document.querySelectorAll('#hubModal .ff .pl-bandeau').length }),
    juger: d => { exiger('Face à face · l\'affiche, puis une rangée par stat et par force, en gros chiffres, sous leurs bandeaux, aucun tableau', d.ff && d.affiche && d.rangs >= 6 && d.gros && !d.tableau && d.bandeaux >= 1, `${d.rangs} rangées, ${d.bandeaux} bandeaux`); } },
  { porte: 'bureau', page: 'proprio', nom: 'Proprio', lire: () => ({ cite: !!document.querySelector('#hubModal .pr-mandat .pr-cite'), rang: !!document.querySelector('#hubModal .pr-rang .bu-run-jauge'), cellules: document.querySelectorAll('#hubModal .pr-argent .pl-cellule').length }),
    juger: d => { exiger('Proprio · le mandat en citation, ton rang avec la jauge, l\'argent en cellules', d.cite && d.rang && d.cellules >= 2, `${d.cellules} cellules`); } },
  { porte: 'lignes', page: null, nom: 'Lignes', lire: () => {
    const lignes = [...document.querySelectorAll('#rosterBoard.en-cartes .line')].filter(l => l.offsetParent);
    const tete = lignes[0] && lignes[0].querySelector('.line-head');
    const carte = document.querySelector('#rosterBoard.en-cartes .slot:not(.empty) .slot-carte');
    const slot = carte && carte.closest('.slot');
    const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
    return { trios: lignes.length, debout: tete ? getComputedStyle(tete).writingMode : '', jetons: !!document.querySelector('#game .seg-effectif'),
      carte: carte ? Math.round(carte.getBoundingClientRect().width) : 0, colonne: slot ? Math.round(slot.getBoundingClientRect().width) : 0,
      ligne: slot ? vis(slot.querySelector('.sc-ligne')) : false, reste: slot ? ['.slot-band', '.sc-qui', '.sc-cle', '.sc-verdicts'].filter(s => vis(slot.querySelector(s))).length : 9 };
  }, juger: d => {
    exiger('Lignes · quatre trios, chacun debout (son nom en colonne verticale)', d.trios >= 4 && /vertical/.test(d.debout), `${d.trios} trios, ${d.debout}`);
    exiger('Lignes · les cartes remplissent leur colonne, une seule ligne dessous', d.carte > 0 && d.carte >= d.colonne - 2 && d.ligne && d.reste === 0, `${d.carte} px sur ${d.colonne}, ${d.reste} bloc(s) d'avant visibles`);
  } },
  { porte: 'club', page: 'joueurs', nom: 'Joueurs', lire: () => ({ jetons: document.querySelectorAll('#pageJoueursCorps .pl-jetons').length, grille: document.querySelectorAll('#pageJoueursCorps .pl-grille-3 .pl-carte').length, coins: document.querySelectorAll('#pageJoueursCorps .pl-carte .pl-coin').length, cartons: document.querySelectorAll('#pageJoueursCorps .pl-carte .carton').length, tableau: !!document.querySelector('#pageJoueursCorps table') }),
    juger: d => { exiger('Joueurs · les filtres et le tri en jetons, une grille de vraies cartes avec leur coin, aucun tableau', d.jetons >= 2 && d.grille >= 9 && d.coins >= 9 && d.cartons >= 9 && !d.tableau, `${d.jetons} rangées de jetons, ${d.grille} cartes`); } },
  { porte: 'club', page: 'entraineur', nom: 'Coach', lire: () => ({ niveau: !!document.querySelector('#hubModal .ej-rang b'), pouvoirs: [...document.querySelectorAll('#hubModal .pv-rang .pl-carte')].filter(c => c.querySelector('.carton')).length, coins: document.querySelectorAll('#hubModal .pv-rang .pl-coin').length }),
    juger: d => { exiger('Coach · le niveau en gros, trois pouvoirs en vraies cartes de jeu avec leur coin', d.niveau && d.pouvoirs === 3 && d.coins === 3, `${d.pouvoirs} cartes`); } },
  { porte: 'club', page: 'vestiaire', nom: 'Vestiaire', lire: () => ({ ok: !!document.querySelector('#hubModal .af-onglet[data-maison="vestiaire"]') }), juger: d => { exiger('Vestiaire · la page répond', d.ok); } },
  { porte: 'marche', page: 'marche', nom: 'Boutique', lire: () => ({ packs: [...document.querySelectorAll('#pageMarche .pk-rayon-debut .pk-tuile')].length, prix: [...document.querySelectorAll('#pageMarche .pk-rayon-debut .pk-tuile .pk-prix')].length, club: document.querySelectorAll('#pageMarche .pk-club-rangee .pk-club-mini').length }),
    juger: d => { exiger('Boutique · quatre pochettes du début avec leur prix, « Ton club » en rangée de quatre', d.packs === 4 && d.prix === 4 && d.club === 4, `${d.packs} pochettes, ${d.club} clubs`); } },
  { porte: 'marche', page: 'cartable', nom: 'Album', lire: () => ({ vues: document.querySelectorAll('#pageCartable .ct-vue').length, coins: document.querySelectorAll('#pageCartable .ct-carte[data-ct-equipe]:not([data-edition="commune"]) .pl-coin-gauche').length, basesACoin: document.querySelectorAll('#pageCartable .ct-carte[data-edition="commune"] .pl-coin-gauche').length, editees: document.querySelectorAll('#pageCartable .ct-carte[data-ct-equipe]:not([data-edition="commune"])').length, cartes: document.querySelectorAll('#pageCartable .ct-carte[data-ct-equipe]').length, lignes: document.querySelectorAll('#pageCartable .ct-carte[data-ct-equipe] .ct-stats').length }),
    juger: d => { exiger('Album · les vues, l\'édition en coin sur chaque carte de ton équipe dès Cadre, jamais sur une Base, rien dessous', d.vues >= 3 && d.cartes > 0 && d.coins === d.editees && !d.basesACoin && !d.lignes, `${d.coins} coins sur ${d.editees} cartes éditées (${d.cartes} cartes), ${d.basesACoin} Base à coin, ${d.lignes} lignes dessous`); } },
  { porte: 'ligue', page: 'classement', nom: 'Classement', lire: () => ({ colonnes: document.querySelectorAll('#hubModal .hub-classement thead th').length, rangees: document.querySelectorAll('#hubModal .hub-classement tbody tr').length, bandeau: !!document.querySelector('#hubModal .hub-classement .pl-bandeau') }),
    juger: d => { exiger('Classement · le bandeau, cinq colonnes', d.bandeau && d.colonnes === 5 && d.rangees >= 16, `${d.colonnes} colonnes, ${d.rangees} rangées`); } },
  { porte: 'ligue', page: 'saison', nom: 'Calendrier', lire: () => { const b = document.querySelector('#hubModal .pl-billets'); return { billets: document.querySelectorAll('#hubModal .pl-billets .pl-billet').length, rail: b ? ['auto', 'scroll'].includes(getComputedStyle(b).overflowX) : true, grille: !!document.querySelector('#hubModal .calj-grille') }; },
    juger: d => { exiger('Calendrier · trois billets de front, sans rail, puis la grille', d.billets === 3 && !d.rail && d.grille, `${d.billets} billets${d.rail ? ', un rail' : ''}`); } },
  { porte: 'ligue', page: 'meneurs', nom: 'Meneurs', lire: () => ({ ok: !!document.querySelector('#hubModal .hub-chips, #hubModal .pl-jetons, #hubModal .live-vide') }), juger: d => { exiger('Meneurs · la page répond', d.ok); } },
  { porte: 'ligue', page: 'historique', nom: 'Palmarès', lire: () => ({ marches: document.querySelectorAll('#pageHistorique .pl-echelle .pl-marche').length, ici: document.querySelectorAll('#pageHistorique .pl-marche-ici').length }),
    juger: d => { exiger('Palmarès · l\'échelle du prestige entière, une marche « tu es ici »', d.marches === 5 && d.ici === 1, `${d.marches} marches`); } },
];

/* Partout : les cinq portes, la porte ouverte sombre, aucune pilule blanche hors des cartes, l'en-tête sans filet de couleur. */
const partout = () => {
  const lum = c => { const m = c.match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return 0; const a = m[3] != null ? Number(m[3]) : 1; return a < 0.5 ? 0 : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
  const portes = [...document.querySelectorAll('#navbar .navtab')].filter(b => b.offsetParent).map(b => b.dataset.section);
  const ouverte = document.querySelector('#navbar .navtab.on');
  const blanches = [...document.querySelectorAll('button, [role="tab"], [role="button"]')].filter(b => b.getClientRects().length && !b.closest('.carton, .tc, .pcard, #navbar, #menuModal, .toast') && getComputedStyle(b).display !== 'none')
    .filter(b => lum(getComputedStyle(b).backgroundColor) > 0.8).map(b => `${b.tagName.toLowerCase()}.${[...b.classList].slice(0, 2).join('.')}`);
  const tete = document.querySelector('.topbar');
  return { portes, ouverteSombre: ouverte ? lum(getComputedStyle(ouverte).backgroundColor) < 0.5 : false, blanches: [...new Set(blanches)], filet: tete ? getComputedStyle(tete).boxShadow : '' };
};

const fautesPartout = { portes: [], ouverte: [], blanches: [], filet: [] };
for (const P of PAGES) {
  await page.click(`#navbar .navtab[data-section="${P.porte}"]`).catch(() => {}); await page.waitForTimeout(500);
  if (P.page) { await page.click(`#sousNav .soustab[data-page="${P.page}"]`, { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); }
  if (P.porte === 'lignes') { await page.click('.seg-effectif [data-val="F"]').catch(() => {}); await page.waitForTimeout(300); }
  if (P.ouvrir) { await page.click(P.ouvrir, { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); }
  await page.screenshot({ path: `${DOSSIER}/plateau-${P.nom.toLowerCase().replace(/[^a-z]+/g, '-')}.png` }).catch(() => {});
  const d = await page.evaluate(P.lire).catch(e => ({ erreur: String(e) }));
  if (d.erreur) exiger(`${P.nom} · la page se lit`, false, d.erreur.slice(0, 80));
  else P.juger(d);
  const g = await page.evaluate(partout);
  if (g.portes.join() !== 'bureau,lignes,club,marche,ligue') fautesPartout.portes.push(`${P.nom} : ${g.portes.join(' · ')}`);
  if (!g.ouverteSombre) fautesPartout.ouverte.push(P.nom);
  if (g.blanches.length) fautesPartout.blanches.push(`${P.nom} : ${g.blanches.join(', ')}`);
  if (g.filet && g.filet !== 'none') fautesPartout.filet.push(P.nom);
}
exiger('Partout · cinq portes, dans l\'ordre : Ce soir, Lignes, Ton club, Marché, Ligue', !fautesPartout.portes.length, fautesPartout.portes[0] || '');
exiger('Partout · la porte ouverte est sombre, jamais blanche', !fautesPartout.ouverte.length, fautesPartout.ouverte.join(', '));
exiger('Partout · aucune pilule blanche hors des cartes (la grammaire d\'avant)', !fautesPartout.blanches.length, fautesPartout.blanches.slice(0, 3).join(' ; '));
exiger('Partout · l\'en-tête sur le noir, sans filet de couleur', !fautesPartout.filet.length, fautesPartout.filet.join(', '));
exiger('Aucune erreur de page', !erreursPage.length, erreursPage[0] || '');
informer('Les captures', `${DOSSIER}/plateau-*.png`);
await browser.close();
verdict('Le plateau du Rogue, contre la maquette');
