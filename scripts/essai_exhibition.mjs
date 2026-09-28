/*
 * ESSAI DE L'EXHIBITION ET DU « AU HASARD » (S78) — à la main, pas un
 * garde-fou. Le menu montre le carton Exhibition ; on choisit deux clubs
 * (Oilers 1983-84 à Montréal 1976-77), on joue un match, une série, cent
 * matchs, on regarde le match en direct, et rien de la partie n'a bougé.
 * Puis « Nouvelle partie » : la saison et la franchise au hasard.
 *   node scripts/essai_exhibition.mjs http://localhost:8000 [dossier-captures]
 */
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8000';
const DOSSIER = process.argv[3] || 'scripts';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [], problemes = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
const verifier = (ok, mot) => { if (!ok) problemes.push(mot); };

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#menuDepart', { timeout: 20000 });
verifier(!!(await page.$('.menu-mode[data-genre="exhibition"] [data-menu="exhibition"]')), 'le menu n\'a pas de carton Exhibition');
await page.$eval('.menu-mode[data-genre="exhibition"]', e => e.scrollIntoView());
await page.screenshot({ path: `${DOSSIER}/exh-menu.png` });
const cles = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('cap82_partie')).map(k => `${k}:${(localStorage.getItem(k) || '').length}`).sort().join(','));
const avant = await cles();

await page.click('[data-menu="exhibition"]');
await page.waitForSelector('#exhibitionModal .exh-bandeau', { timeout: 20000 });
console.log('1. exhibition ouverte, affiche de départ :', await page.$$eval('.exh-bandeau b', l => l.map(x => x.textContent).join(' @ ')));

// Les visiteurs : les Oilers de 1983-84.
const choisir = async (cote, saison, club) => {
  await page.click(`.exh-cote[data-cote="${cote}"] .exh-bandeau`);
  await page.waitForSelector(`.exh-cote[data-cote="${cote}"] .exh-saison`);
  await page.selectOption(`.exh-cote[data-cote="${cote}"] .exh-saison`, saison);
  await page.waitForSelector(`.exh-cote[data-cote="${cote}"] .exh-club[data-club="${club}"]`);
};
await choisir('vis', '1983-84', 'EDM');
// Les écussons viennent du réseau : on attend qu'ils soient là avant la capture.
await page.waitForFunction(() => [...document.querySelectorAll('.exh-club img')].every(i => i.complete), null, { timeout: 8000 }).catch(() => null);
await page.screenshot({ path: `${DOSSIER}/exh-choix.png` });
const nClubs = await page.$$eval('.exh-cote[data-cote="vis"] .exh-club', l => l.length);
console.log('2. le sélecteur de 1983-84 :', nClubs, 'clubs');
verifier(nClubs >= 20, `1983-84 devrait offrir ses 21 clubs (${nClubs})`);
await page.click('.exh-cote[data-cote="vis"] .exh-club[data-club="EDM"]');
await choisir('loc', '1976-77', 'MTL');
await page.click('.exh-cote[data-cote="loc"] .exh-club[data-club="MTL"]');
await page.waitForTimeout(200);
const affiche = await page.$$eval('.exh-bandeau b', l => l.map(x => x.textContent).join(' @ '));
console.log('3. l\'affiche :', affiche);
verifier(/Oilers/.test(affiche) && /Canadiens/.test(affiche), `l'affiche choisie n'est pas là (${affiche})`);

// Un match.
await page.click('.exh-actions [data-exh="match"]');
await page.waitForSelector('.exh-boite .exh-tableau', { timeout: 20000 });
const match = await page.evaluate(() => {
  const s = [...document.querySelectorAll('.exh-final b')].map(b => Number(b.textContent));
  return { score: s, buts: document.querySelectorAll('.exh-buts li').length, rangs: document.querySelectorAll('.exh-tableau tbody tr').length, etoiles: document.querySelectorAll('.exh-etoiles li').length, gardiens: document.querySelectorAll('.exh-gardiens li').length, mot: document.querySelector('.exh-mot').textContent };
});
console.log('4. un match :', JSON.stringify(match));
verifier(match.score.length === 2 && match.score[0] !== match.score[1], 'le match n\'a pas de gagnant');
verifier(match.buts === match.score[0] + match.score[1], `les buts listés (${match.buts}) ne font pas le pointage`);
verifier(match.rangs === 2 && match.gardiens === 2 && match.etoiles === 3, 'le tableau, les gardiens ou les étoiles manquent');
await page.$eval('.exh-resultat', e => e.scrollIntoView());
await page.screenshot({ path: `${DOSSIER}/exh-match.png` });

// Le direct, puis retour.
await page.click('.exh-regarder');
await page.waitForSelector('#liveModal', { state: 'visible', timeout: 10000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${DOSSIER}/exh-direct.png` });
await page.click('#liveModal .live-close');
await page.waitForTimeout(300);
const revenu = await page.isVisible('#exhibitionModal .exh-boite');
console.log('5. le direct s\'ouvre et rend la main :', revenu);
verifier(revenu, 'après le direct, l\'exhibition n\'est pas revenue');

// Une série.
await page.click('.exh-actions [data-exh="serie"]');
await page.waitForSelector('.exh-matchs li', { timeout: 20000 });
const serie = await page.evaluate(() => ({ n: document.querySelectorAll('.exh-matchs li').length, tete: document.querySelector('.exh-serie-tete').textContent.replace(/\s+/g, ' ').trim(), dernier: [...document.querySelectorAll('.exh-etat')].pop().textContent }));
console.log('6. une série :', JSON.stringify(serie));
verifier(serie.n >= 4 && serie.n <= 7 && /4/.test(serie.dernier), 'la série ne finit pas à quatre victoires');
await page.click('.exh-matchs li:first-child .exh-match');
await page.waitForSelector('.exh-matchs li.ouverte .exh-boite');
await page.$eval('.exh-serie', e => e.scrollIntoView());
await page.screenshot({ path: `${DOSSIER}/exh-serie.png` });

// Cent matchs.
await page.click('.exh-actions [data-exh="fois"]');
await page.waitForSelector('.exh-barre', { timeout: 30000 });
const fois = await page.evaluate(() => ({ barre: [...document.querySelectorAll('.exh-barre span')].map(s => s.textContent), victoires: [...document.querySelectorAll('.exh-fois-noms small')].map(s => s.textContent) }));
console.log('7. cent matchs :', JSON.stringify(fois));
const v = fois.victoires.map(x => Number.parseInt(x, 10));
verifier(v.length === 2 && v[0] + v[1] === 100, `les victoires ne font pas cent (${v})`);
await page.$eval('.exh-fois', e => e.scrollIntoView());
await page.screenshot({ path: `${DOSSIER}/exh-fois.png` });

// Le hasard d'un côté.
await page.click('.exh-cote[data-cote="loc"] .exh-bandeau');
await page.click('.exh-cote[data-cote="loc"] [data-exh="hasard"]');
await page.waitForTimeout(300);
console.log('8. les locaux au hasard :', await page.$eval('.exh-cote[data-cote="loc"] .exh-bandeau', b => b.textContent.replace(/\s+/g, ' ').trim()));

await page.click('#exhibitionModal .exh-fermer');
await page.waitForSelector('#menuDepart', { timeout: 5000 });
const apres = await cles();
console.log('9. fermée : le menu revient ; les parties sauvegardées', avant === apres ? 'intactes' : `ONT BOUGÉ (${avant} → ${apres})`);
verifier(avant === apres, 'l\'exhibition a écrit dans une partie');
const memo = await page.evaluate(() => localStorage.getItem('cap82_exhibition'));
verifier(/1983-84/.test(memo || ''), 'l\'affiche n\'est pas retenue');

// « Au hasard » dans Nouvelle partie : la saison de la ligue, puis la franchise.
await page.click('.menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
const hasard = async (preparer, attendu) => {
  await preparer();
  await page.waitForTimeout(150);
  const resume = await page.$eval('#npResume', e => e.textContent);
  // Le toast de l'essai d'avant ne doit pas passer pour celui-ci.
  await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.textContent = ''; });
  await page.click('#npGo');
  // L'identité (S73) : pas de préférence.
  await page.waitForSelector('.choix-modal .choix-fermer', { timeout: 15000 }).catch(() => null);
  const fermer = await page.$('.choix-modal .choix-fermer');
  if (fermer && await fermer.isVisible()) await fermer.click();
  await page.waitForFunction(() => /repart à zéro/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 30000 });
  const toast = await page.$eval('#toast', e => e.textContent);
  const etat = await page.evaluate(() => ({ epoque: window.cap82.G.epoque, franchise: window.cap82.G.franchise, repechage: window.cap82.G.repechage }));
  console.log(`   ${attendu} · pied : « ${resume} »\n   toast : « ${toast} » · partie : ${JSON.stringify(etat)}`);
  return { toast, etat };
};
const h1 = await hasard(async () => {
  await page.click('#partieModal .seg[data-opt="ligue"] button[data-val="UNE"]');
  await page.selectOption('#epoqueSelect', 'HASARD');
}, '10. la saison au hasard');
verifier(/🎲 Le hasard a choisi la saison \d{4}-\d{2}/.test(h1.toast) && /^\d{4}-\d{2}$/.test(h1.etat.epoque || ''), 'la saison au hasard ne s\'est pas résolue');
await page.screenshot({ path: `${DOSSIER}/exh-hasard-saison.png` });
// S79 : « Nouvelle » ouvre le choix du mode, puis l'écran de la saison.
await page.click('#openPartieBtn');
await page.waitForSelector('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]', { timeout: 10000 });
await page.click('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
const h2 = await hasard(async () => {
  await page.click('#partieModal .seg[data-opt="repechage"] button[data-val="FRANCHISE"]');
  await page.selectOption('#franchiseSelect', 'HASARD');
  await page.screenshot({ path: `${DOSSIER}/exh-hasard-franchise.png` });
}, '11. la franchise au hasard');
verifier(/🎲 Le hasard a choisi/.test(h2.toast) && h2.etat.repechage === 'FRANCHISE' && h2.etat.franchise && h2.etat.franchise !== 'HASARD', 'la franchise au hasard ne s\'est pas résolue');

console.log('erreurs :', erreurs.length ? erreurs.join(' | ') : 'aucune');
console.log('problèmes :', problemes.length ? problemes.join(' | ') : 'aucun');
await browser.close();
process.exit(erreurs.length || problemes.length ? 1 : 0);
