/**
 * LES PLANCHES DES CARTES (S78, 1.0) : toutes les séries, toutes les
 * parallèles, côte à côte, pour juger les dessins d'un coup d'oeil
 * (js/cartes.js `SERIES`, style.css « LES SÉRIES »).
 *
 *   node scripts/planche_cartes.mjs http://localhost:8000 [dossier] [--seul <planche>]
 *
 * Planches (dans le dossier, `scripts` par défaut) :
 *   cartes-series-1.png, -2.png  une rangée par série, à la taille du vestiaire
 *                                (la vraie carte, `playerCardEl`) : le meilleur
 *                                pointeur en base, parallèle, holo et or, le
 *                                gardien le plus utilisé en base et en or ;
 *   cartes-fiche-1.png, -2.png   le carton à la taille de la fiche, une série chacune ;
 *   cartes-mini.png              la carte mini des choix (`carteMiniHtml`) ;
 *   cartes-verso.png             le dos de la fiche, cinq séries ;
 *   cartes-match.png             les cartes de match, par genre (js/combat.js) ;
 *   cartes-actions.png           les dix séries avec une photo d'action, à la
 *                                taille du vestiaire : une rangée par série, le
 *                                même joueur avec et sans sa photo, une photo
 *                                lointaine (McDavid), un gardien, une or ;
 *   cartes-paysage.png           la fiche COUCHÉE d'un joueur qui a sa photo,
 *                                une par série, à 400 px ;
 *   cartes-fiche-vraie-*.png     la vraie fiche au téléphone, recto et verso ;
 *   cartes-vestiaire-tel.png     le vestiaire au téléphone (390 px), tel quel.
 * Les photos d'action viennent de img/actions (node scripts/actions.mjs) ;
 * rien ne sort du réseau : une photo absente retombe sur le portrait.
 */
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'scripts';
// --seul <début de nom> : une seule planche (cartes-match, cartes-series…), pour itérer vite.
const iS = process.argv.indexOf('--seul');
const SEUL = iS > 0 ? process.argv[iS + 1] : null;
// Une saison au milieu de chaque série.
const SAISONS = ['1974-75', '1981-82', '1988-89', '1992-93', '1996-97', '2000-01', '2006-07', '2010-11', '2015-16', '2022-23'];
const RARETES = ['commune', 'peu', 'rare', 'legendaire'];

const navigateur = await chromium.launch();
const erreurs = [];
async function demarrer(largeur, hauteur) {
  // Sans travailleur de service : il servirait les images lui-même, et la route des photos d'action ne les verrait pas.
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await contexte.newPage();
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erreurs.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#menuDepart');
  await page.click('.menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
  await page.waitForSelector('#npGo', { timeout: 30000 });
  await page.click('#npGo');
  await page.waitForSelector('#choixModal:not([hidden]) .tc', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('#choixModal .tc').click());
  await page.waitForSelector('#pool .pcard', { timeout: 30000 });
  await page.waitForTimeout(600);
  return page;
}

// Une planche : un conteneur par-dessus tout, rempli par `remplir` (dans la page), puis photographié.
async function planche(page, nom, colonnes, largeur, remplir, arg) {
  if (SEUL && !nom.startsWith(SEUL)) return;
  await page.evaluate(async ({ colonnes, largeur, source, arg }) => {
    let p = document.getElementById('planche');
    if (!p) { p = document.createElement('div'); p.id = 'planche'; document.body.appendChild(p); }
    Object.assign(p.style, { position: 'absolute', top: '0', left: '0', zIndex: '9999', background: '#0b0d11', padding: '16px', gap: '14px 12px', display: 'grid', alignItems: 'start', gridTemplateColumns: `repeat(${colonnes}, ${largeur}px)` });
    p.innerHTML = '';
    window.scrollTo(0, 0);
    await (0, eval)(`(${source})`)(p, arg);
    // Une planche est plus haute que l'écran : toutes ses images se chargent, pas seulement celles du haut.
    for (const i of p.querySelectorAll('img[loading="lazy"]')) i.loading = 'eager';
  }, { colonnes, largeur, source: remplir.toString(), arg });
  // Toutes ses images chargées, pas seulement celles du haut : la fenêtre du navigateur prend la hauteur de la planche
  // (une image paresseuse loin sous l'écran ne part jamais), puis on attend qu'elles soient toutes là (ou tombées).
  const boite = await page.evaluate(() => { const r = document.getElementById('planche').getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, width: r.width, height: r.height }; });
  const vue = page.viewportSize();
  await page.setViewportSize({ width: vue.width, height: Math.min(16000, Math.ceil(boite.y + boite.height + 20)) });
  await page.waitForFunction(() => [...document.querySelectorAll('#planche img')].every(i => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DOSSIER, `cartes-${nom}.png`), clip: boite, fullPage: true });
  await page.setViewportSize(vue);
  console.log(`   cartes-${nom}.png`);
}

// Dans la page : les joueurs d'une saison (le meilleur pointeur, le gardien le plus utilisé), avec leur photo d'action.
const JOUEURS = `async s => {
  const { getShard } = window.cap82.dev;
  const e = await getShard(s);
  const pts = p => p.pt ?? ((p.g || 0) + (p.a || 0));
  const pat = e.players.filter(p => p.p !== 'G' && (p.gp || 0) >= 30).sort((a, b) => pts(b) - pts(a))[0];
  const gar = e.players.filter(p => p.p === 'G' && (p.gp || 0) >= 20).sort((a, b) => (b.gp || 0) - (a.gp || 0))[0];
  return [pat, gar];
}`;

const page = await demarrer(1400, 900);
await page.evaluate(src => { window.__joueurs = (0, eval)(`(${src})`); }, JOUEURS);

// 1-2. Les séries au vestiaire.
for (const [k, tranche] of [[1, SAISONS.slice(0, 5)], [2, SAISONS.slice(5)]]) {
  await planche(page, `series-${k}`, 6, 158, async (p, { tranche, rar }) => {
    const { playerCardEl } = window.cap82.dev;
    const { getPlayerKey } = await import('/js/sim.js');
    const G = window.cap82.G;
    for (const s of tranche) {
      const [pat, gar] = await window.__joueurs(s);
      const poser = (j, r) => { G.variantes.cartes[getPlayerKey(j)] = r; const el = playerCardEl(j); p.appendChild(el); };
      for (const r of rar) poser(pat, r);
      if (gar) { poser(gar, 'commune'); poser(gar, 'legendaire'); }
    }
  }, { tranche, rar: RARETES });
}

// 3-4. Le carton à la taille de la fiche.
for (const [k, tranche] of [[1, SAISONS.slice(0, 5)], [2, SAISONS.slice(5)]]) {
  await planche(page, `fiche-${k}`, 5, 300, async (p, { tranche }) => {
    const { cartonDe, varsEquipe } = await import('/js/repechage.js');
    const { getPlayerKey } = await import('/js/sim.js');
    const G = window.cap82.G;
    let i = 0;
    for (const s of tranche) {
      const [pat] = await window.__joueurs(s);
      G.variantes.cartes[getPlayerKey(pat)] = ['commune', 'legendaire', 'peu', 'rare', 'commune'][i++ % 5];
      const d = document.createElement('div');
      d.setAttribute('style', varsEquipe(pat));
      d.innerHTML = cartonDe(pat, { nomClasse: 'pcard-full-name' });
      p.appendChild(d);
    }
  }, { tranche });
}

// 5. La carte mini.
await planche(page, 'mini', 10, 118, async p => {
  const { carteMiniHtml } = window.cap82.dev;
  const { getPlayerKey } = await import('/js/sim.js');
  const G = window.cap82.G;
  const saisons = ['1974-75', '1981-82', '1988-89', '1992-93', '1996-97', '2000-01', '2006-07', '2010-11', '2015-16', '2022-23'];
  let i = 0;
  for (const s of saisons) {
    const [pat, gar] = await window.__joueurs(s);
    for (const j of [pat, gar]) {
      G.variantes.cartes[getPlayerKey(j)] = ['commune', 'peu', 'commune', 'rare', 'commune', 'legendaire'][i++ % 6];
      const d = document.createElement('div');
      d.innerHTML = carteMiniHtml(j);
      p.appendChild(d.firstElementChild);
    }
  }
});

// 6. Le verso de la fiche : on ouvre la fiche, on la retourne, on la photographie.
await planche(page, 'verso', 5, 330, async p => {
  const { showPlayerModal } = await import('/js/fiche.js');
  const saisons = ['1974-75', '1988-89', '2000-01', '2010-11', '2022-23'];
  for (const s of saisons) {
    const [pat] = await window.__joueurs(s);
    showPlayerModal(pat);
    await new Promise(r => setTimeout(r, 250));
    const carte = document.querySelector('#hockeyCardModal .pcard-full');
    const clone = carte.cloneNode(true);
    clone.querySelectorAll('.modal-body, .pcard-full-foot').forEach(x => x.remove());
    const f = clone.querySelector('.fiche-carte');
    f.classList.add('au-verso');
    f.querySelector('.fc-recto').classList.add('fc-cachee');
    f.querySelector('.fc-verso').classList.remove('fc-cachee');
    clone.style.display = 'block';
    f.style.margin = '0'; f.style.width = '100%';
    p.appendChild(clone);
  }
  document.querySelector('#hockeyCardModal .close-btn, #hockeyCardModal [data-fermer]')?.click();
});

// 6 bis. Les cartes de match, une rangée par genre (et une carte sans genre au bout de la dernière).
await planche(page, 'match', 6, 212, async p => {
  const { CARTES_MATCH } = await import('/js/combat.js');
  const { optionDeCarteMatch, puces } = await import('/js/gerant.js');
  const { carteHtml } = await import('/js/cartes.js');
  const esc = t => String(t).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));
  for (const genre of ['attaque', 'defense', 'tactique', 'synergie', 'malediction']) {
    const cles = Object.keys(CARTES_MATCH).filter(k => !k.endsWith('+') && CARTES_MATCH[k].genre === genre);
    const choix = ['commune', 'peu', 'rare', 'legendaire', 'maudite'].flatMap(r => cles.filter(k => CARTES_MATCH[k].rarete === r).slice(0, 2)).slice(0, 6);
    for (const k of choix) {
      const o = optionDeCarteMatch(k);
      const d = document.createElement('div');
      d.innerHTML = carteHtml({ cle: k, rarete: o.rarete, ico: o.ico, nomHtml: esc(o.nom), typeHtml: esc(o.type), texteHtml: '<i class=\"tc-ambiance\">' + esc(o.texte) + '</i>', coinHtml: esc(o.coin), pucesHtml: puces(o.mots), genreCarte: o.genreCarte, dessin: o.dessin });
      p.appendChild(d.firstElementChild);
    }
  }
  const d = document.createElement('div');
  d.innerHTML = carteHtml({ cle: 'x', rarete: 'peu', ico: '🧪', nomHtml: 'Une carte sans genre', typeHtml: 'Amélioration · au joueur de ton choix', texteHtml: 'Une modif, un événement, une identité : son icône sur un médaillon.', pucesHtml: puces([{ txt: 'Précision +3 %', bon: true }, { txt: 'Jambes −5', bon: false }]) });
  p.appendChild(d.firstElementChild);
});

// 7-8. Les photos d'action : les dix séries (la saison choisit la série), des joueurs qui ont leur photo.
const VEDETTES = [['1992-93', 8448782], ['2010-11', 8471675], ['2022-23', 8478402], ['2014-15', 8471679], ['2008-09', 8471214]];
const AVEC_PHOTO = async () => {
  const { getShard } = window.cap82.dev;
  const trouve = async ([s, id]) => (await getShard(s)).players.find(j => Number(j.id) === id);
  return Promise.all(window.__vedettes.map(trouve));
};
await page.evaluate(v => { window.__vedettes = v; }, VEDETTES);
await page.evaluate(src => { window.__avecPhoto = (0, eval)(`(${src})`); }, AVEC_PHOTO.toString());
await planche(page, 'actions', 6, 158, async (p, { saisons }) => {
  const { cartonDe, varsEquipe } = await import('/js/repechage.js');
  const { getPlayerKey } = await import('/js/sim.js');
  const G = window.cap82.G;
  const [lemieux, crosby, mcdavid, price, ovechkin] = await window.__avecPhoto();
  for (const s of saisons) {
    // Crosby avec et sans sa photo, McDavid (une photo lointaine), Price (un gardien), Ovechkin en or, Lemieux en holo.
    for (const [j, r, sans] of [[crosby, 'commune', false], [crosby, 'commune', true], [mcdavid, 'peu', false], [price, 'commune', false], [ovechkin, 'legendaire', false], [lemieux, 'rare', false]]) {
      const x = { ...j, s, ...(sans ? { actionSrc: '' } : {}) };
      G.variantes.cartes[getPlayerKey(x)] = r;
      const d = document.createElement('div');
      d.setAttribute('style', varsEquipe(x));
      d.innerHTML = cartonDe(x);
      p.appendChild(d);
    }
  }
}, { saisons: SAISONS });
await planche(page, 'paysage', 2, 400, async (p, { saisons }) => {
  const { cartonDe, varsEquipe } = await import('/js/repechage.js');
  const { getPlayerKey } = await import('/js/sim.js');
  const G = window.cap82.G;
  const vedettes = await window.__avecPhoto();
  saisons.forEach((s, i) => {
    const x = { ...vedettes[i % vedettes.length], s };
    G.variantes.cartes[getPlayerKey(x)] = ['commune', 'legendaire', 'peu', 'rare', 'commune'][i % 5];
    const d = document.createElement('div');
    d.setAttribute('style', varsEquipe(x));
    d.innerHTML = cartonDe(x, { nomClasse: 'pcard-full-name', paysage: true });
    p.appendChild(d);
  });
}, { saisons: SAISONS });
await page.close();

// 9. La vraie fiche au téléphone, recto et verso : deux joueurs qui ont leur photo (couchée), le meilleur pointeur de
//    1974-75 qui n'en a pas (debout).
if (!SEUL || 'fiche-vraie'.startsWith(SEUL)) {
  const tel = await demarrer(390, 844);
  let n = 0;
  for (const [s, id] of [['2010-11', 8471675], ['2022-23', 8478402], ['1974-75', null]]) {
    await tel.evaluate(async ({ s, id }) => {
      const { showPlayerModal } = await import('/js/fiche.js');
      const { photoAction } = await import('/js/cartes.js');
      const pts = x => x.pt ?? ((x.g || 0) + (x.a || 0));
      const joueurs = (await window.cap82.dev.getShard(s)).players;
      const j = id ? joueurs.find(x => Number(x.id) === id) : joueurs.filter(x => x.p !== 'G' && !photoAction(x)).sort((a, b) => pts(b) - pts(a))[0];
      showPlayerModal(j, {});
    }, { s, id });
    await tel.waitForSelector('#hockeyCardModal:not([hidden]) .fiche-carte', { timeout: 15000 });
    await tel.waitForTimeout(1200);
    n++;
    await tel.screenshot({ path: path.join(DOSSIER, `cartes-fiche-vraie-${n}-recto.png`) });
    await tel.click('#hockeyCardModal .fc-recto .cj-retourner');
    await tel.waitForTimeout(900);
    await tel.screenshot({ path: path.join(DOSSIER, `cartes-fiche-vraie-${n}-verso.png`) });
    console.log(`   cartes-fiche-vraie-${n}-recto.png, -verso.png`);
    await tel.keyboard.press('Escape');
    await tel.waitForTimeout(400);
  }
  await tel.close();
}

// 8. Le vestiaire au téléphone, tel quel.
if (!SEUL || 'vestiaire'.startsWith(SEUL)) {
const tel = await demarrer(390, 844);
await tel.screenshot({ path: path.join(DOSSIER, 'cartes-vestiaire-tel.png') });
console.log('   cartes-vestiaire-tel.png');
await tel.close();
}

console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await navigateur.close();
