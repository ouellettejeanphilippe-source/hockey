/**
 * LES PLANCHES DES CARTES (S78, 1.0) : toutes les séries, toutes les
 * parallèles, côte à côte, pour juger les dessins d'un coup d'oeil
 * (js/cartes.js `SERIES`, style.css « LES SÉRIES »).
 *
 *   node scripts/planche_cartes.mjs http://localhost:8000 [dossier] [--actions <dossier d'images>] [--seul <planche>]
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
 *   cartes-banque.png            les cartes de la banque, par catégorie (js/banque.js) ;
 *   cartes-actions.png           avec --actions : les séries modernes avec une
 *                                photo d'action (<dossier>/<id>.webp, au format
 *                                5:7, servie sous img/actions/) ;
 *   cartes-vestiaire-tel.png     le vestiaire au téléphone (390 px), tel quel.
 * Rien ne sort du réseau : une photo d'action absente retombe sur le portrait.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'scripts';
const iA = process.argv.indexOf('--actions');
const ACTIONS = iA > 0 ? process.argv[iA + 1] : null;
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
  if (ACTIONS) {
    await page.route('**/img/actions/*.webp', route => {
      const f = path.join(ACTIONS, path.basename(new URL(route.request().url()).pathname));
      return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'image/webp' }) : route.fulfill({ status: 404 });
    });
  }
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#menuDepart');
  await page.click('.menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
  await page.waitForSelector('#npGo', { timeout: 30000 });
  await page.click('#npGo');
  // La roulette peut s'ouvrir sur un choix (l'identité de départ) ou droit au vestiaire.
  if (await page.waitForSelector('#choixModal:not([hidden]) .tc', { timeout: 4000 }).catch(() => null)) await page.evaluate(() => document.querySelector('#choixModal .tc').click());
  await page.waitForSelector('#pool .pcard', { timeout: 30000 });
  await page.waitForTimeout(600);
  // Le 82-0 n'a aucune variante (`varianteJoueur`) : la planche montre les finitions du Rogue.
  await page.evaluate(() => { window.cap82.G.bonus = 'ROGUE'; });
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
  await page.waitForTimeout(1500);
  const boite = await page.evaluate(() => { const r = document.getElementById('planche').getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, width: r.width, height: r.height }; });
  await page.screenshot({ path: path.join(DOSSIER, `cartes-${nom}.png`), clip: boite, fullPage: true });
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

// 6 bis. Les cartes de la banque (V3) : une rangée par catégorie, de la commune à la légendaire, dans leur costume.
await planche(page, 'banque', 6, 212, async p => {
  const { BANQUE, reglesDe, CATEGORIES } = await import('/js/banque.js');
  const { puces } = await import('/js/gerant.js');
  const { carteHtml } = await import('/js/cartes.js');
  const esc = t => String(t).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));
  for (const cat of ['patron', 'evenement', 'joueur', 'consommable', 'plafond', 'saison']) {
    const ids = Object.keys(BANQUE).filter(id => BANQUE[id].cat === cat);
    const choix = ['commune', 'peu', 'rare', 'legendaire'].flatMap(r => ids.filter(id => BANQUE[id].rarete === r).slice(0, 2)).slice(0, 6);
    for (const id of choix) {
      const c = BANQUE[id], d = document.createElement('div');
      d.innerHTML = carteHtml({ cle: id, rarete: c.rarete, ico: c.ico, nomHtml: esc(c.nom), typeHtml: esc(CATEGORIES[c.cat].un), texteHtml: esc(c.texte || ''), pucesHtml: puces(reglesDe(id)), famille: c.cat });
      p.appendChild(d.firstElementChild);
    }
  }
});

// 7. Les photos d'action, si on en a.
if (ACTIONS) {
  const ids = fs.readdirSync(ACTIONS).filter(f => f.endsWith('.webp')).map(f => f.replace('.webp', ''));
  await planche(page, 'actions', 5, 220, async (p, { ids }) => {
    const { cartonDe, varsEquipe } = await import('/js/repechage.js');
    const { getShard } = window.cap82.dev;
    const saisons = ['1996-97', '2000-01', '2006-07', '2010-11', '2015-16', '2022-23'];
    const trouves = new Map();
    for (const s of saisons) {
      const e = await getShard(s);
      for (const j of e.players) if (ids.includes(String(j.id)) && !trouves.has(`${j.id}|${s}`)) trouves.set(`${j.id}|${s}`, j);
    }
    for (const j of trouves.values()) {
      for (const avec of [true, false]) {
        const x = { ...j, actionSrc: avec ? `img/actions/${j.id}.webp` : '' };
        const d = document.createElement('div');
        d.setAttribute('style', varsEquipe(x));
        d.innerHTML = cartonDe(x);
        p.appendChild(d);
      }
    }
  }, { ids });
}
await page.close();

// 8. Le vestiaire au téléphone, tel quel.
if (!SEUL || 'vestiaire'.startsWith(SEUL)) {
const tel = await demarrer(390, 844);
await tel.screenshot({ path: path.join(DOSSIER, 'cartes-vestiaire-tel.png') });
console.log('   cartes-vestiaire-tel.png');
await tel.close();
}

console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
await navigateur.close();
