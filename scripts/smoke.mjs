/**
 * Test de fumée (CLAUDE.md) avec Playwright, à 390 px de large.
 *
 *   python3 -m http.server 8000 &
 *   node scripts/smoke.mjs http://localhost:8000
 *
 * 1. la page démarre, #game visible
 * 2. auto-draft jusqu'à 23/23 dans le vestiaire de chaque tour (tirage
 *    VESTIAIRE : relances quand rien ne tient dans le budget, #freeCapBtn en
 *    dernier recours)
 * 3. #mainBtn actif, clic : l'écran de saison (une journée, les meneurs, un
 *    match en direct, la fin), le bilan : .result .score et 23 .rrow ; puis
 *    l'écran des séries jusqu'au tableau
 * 4. zéro erreur console
 * 5. le même parcours en tirage LOTO (#rrL quand rien ne tient dans le budget)
 * Écrit des captures dans scripts/smoke-*.png.
 */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Playwright peut être installé globalement (npm root -g) plutôt que dans le dépôt
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const base = process.argv[2] || 'http://localhost:8000';
/* CHROMIUM : le chemin d'un Chromium déjà installé (un poste où la version
   de Playwright ne correspond pas à celle du navigateur). Vide dans
   l'Action, qui installe le sien. */
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
let netErrors = 0;   // images externes (assets.nhle.com) : réseau, pas l'application
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text())) { netErrors++; return; }
  errors.push(`console: ${m.text()}`);
});

// Hors du serveur local, tout est bloqué (portraits, sonde de l'API) : sans
// accès sortant, ces requêtes pendraient et « networkidle » n'arriverait jamais.
await page.route(u => !u.href.startsWith(base), r => r.abort());

await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#game', { state: 'visible', timeout: 30000 });
console.log('1. #game visible');

/* PREMIÈRE VISITE : le localStorage vient d'être vidé, donc l'écran « Nouvelle
   partie » s'ouvre par-dessus. Ce n'est pas un `if` : c'est garanti, donc on
   l'attend durement — le test prouve du même coup que l'écran s'ouvre. Rien
   n'est signé et rien n'a changé, alors « Commencer » se contente de fermer. */
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
await page.click('#npGo');
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 15000 });
console.log('   écran « Nouvelle partie » : ouvert à la première visite, refermé');

/*
 * DEUX RÈGLES FERMES QUE RIEN NE VÉRIFIAIT.
 *
 * `sansDebordement` — « rien ne doit déborder horizontalement de
 * `document.documentElement` ; seuls les conteneurs prévus défilent en x ».
 * Le mode bonus l'avait déjà, le jeu principal non : on pouvait donc casser
 * la mise en page à 390 px et sortir du vert.
 *
 * `sansCote` — « aucune cote dans le DOM, jamais. Un joueur curieux qui ouvre
 * l'inspecteur ne doit rien pouvoir en tirer. » Ce que ça prouve : aucun
 * élément ne porte un attribut nommé comme une sous-cote, et le document ne
 * contient aucun `data-` qui les nomme. Ce que ça ne prouve pas : qu'un
 * gabarit n'écrive pas une cote dans du TEXTE sous un autre nom — les cotes
 * vivent dans un coffre privé, la page ne peut pas les redonner pour qu'on
 * compare. C'est le mode de régression réel (`data-v="${p.v}"` glissé dans un
 * gabarit) qui est couvert, pas la malveillance.
 */
const COTES = ['o', 'd', 'r', 'c', 'v', 'sp'];
async function sansDebordement(ou) {
  const trop = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  if (trop > 0) errors.push(`débordement horizontal de ${trop} px — ${ou}`);
  return trop;
}
/*
 * ON DOIT POUVOIR ATTEINDRE CE QU'ON TOUCHE — et c'était l'angle mort du
 * test de fumée.
 *
 * JP : *l'interface glisse pas pour derrière le banc sur mon cell*. Trois
 * défauts de défilement vivaient dans le dépôt, tous invisibles ici : le
 * volet du banc repassé en `display: block` (donc `.roster` n'était plus un
 * item flex, il grandissait à 1497 px et `.game` le coupait), la bande du
 * bassin en `align-items: start` (donc les colonnes prenaient la hauteur de
 * leur contenu au lieu d'être bornées, et leur `overflow-y` ne servait à
 * rien), et les rangées de l'alignement qui s'écrasaient de 153 px à 48 en
 * se chevauchant.
 *
 * POURQUOI RIEN NE LES A VUS. `sansDebordement` ne regarde que la largeur ;
 * `pasUneLonguePage` ne regarde que le document, qui est borné par
 * construction ; et l'auto-draft signe par `b.click()` en JavaScript, ce qui
 * ne demande ni visibilité ni défilement. Trois garde-fous verts au-dessus
 * d'une interface où l'on ne pouvait pas atteindre la moitié des joueurs.
 *
 * CE QUE CELUI-CI MESURE, en deux questions posées à chaque élément de
 * texte :
 *   — est-il SOUS LE PLI sans qu'aucun ancêtre puisse défiler jusqu'à lui ?
 *   — est-il COUPÉ au-delà de ce que le défilement d'un ancêtre révélerait
 *     (son bas dépasse le `scrollHeight` de la boîte qui le rogne) ?
 * La seconde attrape ce que la première ne peut pas voir : du contenu
 * ÉCRASÉ n'est pas sous le pli, il est à l'intérieur d'une boîte qui a plié
 * pour tenir, et c'est exactement ce que faisaient les rangées de
 * l'alignement.
 */
async function toutEstAtteignable(ou) {
  const mauvais = await page.evaluate(() => {
    const st = el => getComputedStyle(el);
    const rogne = el => { const s = st(el); return ['hidden','auto','scroll'].includes(s.overflowY) || ['hidden','auto','scroll'].includes(s.overflowX); };
    const defile = el => { const o = st(el).overflowY; return (o === 'auto' || o === 'scroll') && el.scrollHeight - el.clientHeight > 1; };
    const vu = el => { const s = st(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nom = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
      + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!vu(el) || el.children.length || !(el.textContent || '').trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= innerHeight - 1 || r.bottom <= 1) {
        let p = el.parentElement, ok = false;
        while (p && !ok) { if (defile(p)) ok = true; p = p.parentElement; }
        if (!ok && defile(document.scrollingElement)) ok = true;
        if (!ok) { out.push(`« ${(el.textContent || '').trim().slice(0, 36)} » (${nom(el)}) est sous le pli et rien ne défile jusqu'à lui`); continue; }
      }
      let c = el.parentElement;
      while (c && !rogne(c)) c = c.parentElement;
      if (!c) continue;
      const rc = c.getBoundingClientRect();
      const bas = r.bottom - rc.top + c.scrollTop;
      if (bas > c.scrollHeight + 2) out.push(`« ${(el.textContent || '').trim().slice(0, 36)} » (${nom(el)}) dépasse de ${Math.round(bas - c.scrollHeight)} px ce que ${nom(c)} peut révéler`);
    }
    return [...new Set(out)];
  });
  if (mauvais.length) errors.push(`hors de portée — ${ou} : ${mauvais.slice(0, 3).join(' | ')}${mauvais.length > 3 ? ` (+${mauvais.length - 3})` : ''}`);
  return mauvais.length;
}

/*
 * JAMAIS UNE LONGUE PAGE. JP : *jamais longue pages, fait onglets si
 * nécessaire* ; *vraiment assurer interface clean, facile à naviguer, peu
 * importe petit écran ou 4k pc*.
 *
 * Mesuré à 390 px AVANT : le bilan faisait 4,2 écrans, ses statistiques 5,0,
 * son alignement 4,9. La cause n'était pas le bilan mais le REPÊCHAGE resté
 * au-dessus — le bilan est un frère de la roulette dans `#game`, et rien ne
 * la cachait : on finissait sa saison et on remontait la roulette et le
 * vestiaire pour revenir à rien. Après : 1,7 / 2,4 / 2,3.
 *
 * La borne est à TROIS écrans, et elle suit la mesure plutôt que le goût :
 * le pire volet en fait 2,4, et le défaut qu'on veut attraper — le repêchage
 * qui revient — en rajoute 2,8 d'un coup. À trois, elle ne crie pas pour du
 * bruit et elle ne peut pas rater ça.
 */
async function pasUneLonguePage(ou, max = 3) {
  const n = await page.evaluate(() => {
    const el = document.documentElement;
    return +(el.scrollHeight / el.clientHeight).toFixed(2);
  });
  if (n > max) errors.push(`longue page : ${ou} fait ${n} écrans (au plus ${max})`);
  return n;
}
async function sansCote(ou) {
  const fautes = await page.evaluate(cotes => {
    const out = [];
    // Pas `data-cote` : dans `js/direct.js` le mot veut dire CÔTÉ (A ou B), pas
    // cote. Deux mots homographes en québécois, et le premier jet du garde-fou
    // a rougi sur le tableau indicateur du direct.
    const interdits = new Set([...cotes, ...cotes.map(k => `data-${k}`), 'data-valeur', 'data-rating']);
    const SVG = 'http://www.w3.org/2000/svg';
    for (const el of document.querySelectorAll('*')) {
      // Le SVG a ses propres `d`, `r` et `c` — la géométrie d'un tracé n'est
      // pas une cote, et les icônes du sprite en sont pleines.
      if (el.namespaceURI === SVG || el.closest('svg')) continue;
      for (const at of el.attributes) {
        if (interdits.has(at.name)) out.push(`<${el.tagName.toLowerCase()} ${at.name}="${at.value}">`);
      }
    }
    return out.slice(0, 3);
  }, COTES);
  for (const f of fautes) errors.push(`une cote dans le DOM — ${ou} : ${f}`);
  return fautes.length;
}

/*
 * LA BARRE D'ONGLETS FLOTTE (S59), et le garde-fou suit la règle neuve.
 *
 * Elle était collée au bas, pleine largeur, avec un filet dessus ; elle est
 * maintenant posée EN RETRAIT de `FLOTTE` pixels et arrondie — c'est le
 * geste qui, à lui seul, fait qu'une interface a l'air d'un jeu. Le contrôle
 * ne peut donc plus exiger « collée au bas », mais il ne doit RIEN perdre de
 * ce qu'il protégeait : le défaut de S55 était une barre POUSSÉE SOUS
 * l'écran par un volet trop haut (−38 px mesurés), donc incliquable.
 *
 * Ce qui est exigé : la barre est ENTIÈREMENT dans l'écran (jamais un écart
 * négatif) et elle est à sa place (jamais plus loin du bas que le retrait
 * voulu). Le `atteignable` de S55 reste, et c'est lui qui attrape le cas où
 * quelque chose passe par-dessus.
 */
const FLOTTE = 10;       // le retrait du bas, en pixels (voir `.navbar`, style.css)
const FLOTTE_MAX = FLOTTE + 4;
const malPlacee = fond => fond < -1 || fond > FLOTTE_MAX;

const MIN_SAL = 0.95;    // plancher réservé par case restante, en millions (marge sur les 0,775 M$ du barème)
const parseM = t => parseFloat(String(t || '').replace(/[^0-9.]/g, '')) || 0;
const lireSignes = async () => parseInt((await page.textContent('#cnt')).trim(), 10) || 0;
// Le total vient du COMPTEUR, pas d'une constante : l'Express en a six, le
// Complet vingt-trois, et `casesDuMode` est la seule source de vérité.
const lireTotal = async () => parseInt(((await page.textContent('#cnt')).split('/')[1] || '23').trim(), 10) || 23;

/** L'auto-draft : la main de chaque tour, jusqu'à 23/23. */
async function drafter(etiquette) {
  const total = await lireTotal();
  let signed = 0, guard = 0;
  while (signed < total && guard++ < 320) {
    const rem = parseM(await page.textContent('#capAmt'));
    const left = total - signed;
    // Budget maximal pour ce choix : au-delà, impossible de combler les cases
    // suivantes au salaire plancher. C'est la règle affichée au tableau de bord.
    const maxPick = rem - Math.max(0, left - 1) * MIN_SAL;

    const cards = await page.$$('.pcard');
    const infos = await page.$$eval('.pcard', els => els.map(el => ({
      price: parseFloat((el.querySelector('.pcard-price')?.textContent || '').replace(/[^0-9.]/g, '')) || 0,
      ok: !!el.querySelector('.btn-sign:not([disabled])'),
    })));

    // La main est dans l'ordre de l'unité : le premier qui tient dans le
    // budget fait l'affaire, l'auto-draft ne juge pas.
    let idx = infos.findIndex(c => c.ok && c.price <= maxPick);
    if (idx < 0) {
      // Rien de sûr : on relance (les trois clubs en loto ; passer, autre
      // équipe ou autre année en vestiaire), sinon on prend le moins cher
      const rr = await page.$('#rrL:not([disabled])') || await page.$('#rrP:not([disabled])')
        || await page.$('#rrT:not([disabled])') || await page.$('#rrS:not([disabled])');
      if (rr) { await rr.click(); await page.waitForTimeout(260); signed = await lireSignes(); continue; }
      let best = -1, bestPrice = Infinity;
      infos.forEach((c, i) => { if (c.ok && c.price < bestPrice) { best = i; bestPrice = c.price; } });
      idx = best;
    }

    if (idx < 0) {
      // Impasse : on fait ce que la bande de secours propose au joueur, libérer
      // de la masse salariale en retirant le plus gros contrat.
      const free = await page.$('#freeCapBtn');
      if (free) { await free.click(); await page.waitForTimeout(200); signed = await lireSignes(); continue; }
      break;
    }
    await cards[idx].$eval('.btn-sign', b => b.click());
    await page.waitForTimeout(200);
    signed = await lireSignes();
  }
  console.log(`   ${etiquette} : ${signed}/${total} signés`);
  return { signed, total };
}

let { signed } = await drafter('vestiaire');
console.log(`2. ${signed}/23 signés`);
// Le vestiaire est plein : c'est le moment où le DOM porte le plus de cartes,
// donc le moment où une cote qui fuit se verrait, et où la mise en page est
// la plus chargée.
console.log(`   à 390 px, alignement complet : ${await sansDebordement('vestiaire plein')} px de débordement, ${await sansCote('vestiaire plein')} cote(s) dans le DOM, ${await toutEstAtteignable('vestiaire plein')} hors de portée`);
await page.screenshot({ path: 'scripts/smoke-roster.png', fullPage: false });

/*
 * L'ÉCRAN DES ÉQUIPES. JP : *faciliter de voir les équipes, leurs rosters,
 * stats réelles* ; *jamais longue pages, fait onglets si nécessaire* ; *ça me
 * dérange pas si ya l'option de swipe sur mobile pour voir d'autres colonnes,
 * je veux juste que yait un ui « ancré » avec onglets*.
 *
 * L'ANCRAGE S'ÉPROUVE PAR LA STRUCTURE, pas par un défilement : un club dont
 * la table tient dans l'écran ne prouverait rien en défilant de 0 px. Ce qui
 * sert à naviguer — la saison, la recherche, le bandeau du club, les trois
 * onglets — doit être HORS du conteneur qui défile, et ça, c'est vrai ou
 * faux.
 */
{
  await page.click('.navtab[data-page="equipes"]');
  await page.waitForSelector('#pageEquipes .eq-carte', { timeout: 40000 });
  const clubs = await page.$$eval('#pageEquipes .eq-carte', l => l.length);
  const annee = await page.$eval('#pageEquipes .eq-select', e => e.value);
  if (clubs < 8) errors.push(`l'écran des équipes ne montre que ${clubs} club(s) en ${annee}`);
  await page.click('#pageEquipes .eq-carte');
  await page.waitForSelector('#pageEquipes .eq-table tbody tr', { timeout: 15000 });
  const ancre = await page.evaluate(() => {
    const sc = document.querySelector('#pageEquipes .eq-scroll');
    const dedans = s => { const e = document.querySelector(s); return !!(e && sc && sc.contains(e)); };
    return ['#pageEquipes .eq-barre', '#pageEquipes .eq-tete', '#pageEquipes .eq-onglets'].filter(dedans);
  });
  if (ancre.length) errors.push(`l'écran des équipes n'est pas ancré : ${ancre.join(', ')} défile(nt) avec le contenu`);
  // Les trois onglets, et les colonnes du gardien qui ne sont PAS celles d'un
  // patineur : un onglet qui rend la même table est un onglet décoratif.
  const cols = {};
  for (const poste of ['F', 'D', 'G']) {
    await page.click(`#pageEquipes [data-poste="${poste}"]`);
    await page.waitForTimeout(180);
    cols[poste] = await page.$$eval('#pageEquipes .eq-table thead th', l => l.map(e => e.textContent.replace(/[▾▴]/g, '').trim()).join(' '));
  }
  if (cols.G === cols.F) errors.push('les gardiens portent les colonnes des patineurs');
  if (!/\bV\b/.test(cols.G) || !/%ARR/.test(cols.G)) errors.push(`les colonnes des gardiens sont fausses : ${cols.G}`);
  // Le tri : la même colonne deux fois inverse le sens.
  await page.click('#pageEquipes [data-poste="F"]');
  await page.waitForTimeout(180);
  await page.click('#pageEquipes [data-tri="g"]');
  await page.waitForTimeout(180);
  const buts = await page.$$eval('#pageEquipes .eq-table tbody tr td:nth-child(4)', l => l.slice(0, 5).map(e => Number(e.textContent.trim())));
  if (!buts.every((v, i) => !i || buts[i - 1] >= v)) errors.push(`le tri par buts ne descend pas : ${buts.join(' ')}`);
  // La fiche d'un joueur s'ouvre PAR-DESSUS, et Échap ne ferme que la fiche :
  // avec des modales empilées, tout fermer d'un coup fait sortir de l'écran.
  await page.click('#pageEquipes .eq-joueur');
  await page.waitForTimeout(400);
  const ficheOuverte = await page.$eval('#hockeyCardModal', e => e.style.display !== 'none');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const dessous = await page.$eval('#pageEquipes', e => !e.hidden);
  if (!ficheOuverte) errors.push("la fiche d'un joueur ne s'ouvre pas depuis l'écran des équipes");
  if (!dessous) errors.push("Échap ferme l'écran des équipes SOUS la fiche d'un joueur : une modale du dessous ne doit pas partir avec celle du dessus");
  console.log(`   les équipes : ${clubs} clubs en ${annee}, écran ancré, ${await sansDebordement('écran des équipes')} px de débordement, ${await sansCote('écran des équipes')} cote(s)`);
  await page.click('.navtab[data-page="repechage"]');
  await page.waitForTimeout(250);
}

/*
 * UN ONGLET, UNE RAISON D'ÊTRE. JP : *mettre onglets en bas, pages séparées
 * de l'accueil* ; *je veux pas avoir tout restant dans la page, picks,
 * alignement, match du jour/calendrier, standings, leaders, C'EST TOUS DES
 * ONGLETS DIFFÉRENTS* ; *pense à l'interface d'un EHM*.
 *
 * Deux choses s'éprouvent, et elles sont structurelles. **Chaque onglet tient
 * en UN écran** — les pages sont des boîtes bornées dont le corps défile, pas
 * des pages qui grandissent (la page des règles faisait 24,6 écrans avant).
 * Et **l'onglet de l'alignement ne porte que l'alignement** : ni la roulette,
 * ni le tableau de bord, ni le vestiaire, ni le bilan — c'était ça, « tout
 * restant dans la page ».
 */
{
  const lire = () => page.evaluate(() => {
    const vu = s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const de = document.documentElement;
    return {
      page: document.body.dataset.page,
      spin: vu('#spin'), dash: vu('#dash'), pool: vu('#panePool'), roster: vu('#paneRoster'),
      ecrans: +(de.scrollHeight / de.clientHeight).toFixed(2),
    };
  });
  const vus = [];
  for (const cle of ['repechage', 'alignement', 'equipes', 'historique', 'regles']) {
    const b = await page.$(`.navtab[data-page="${cle}"]`);
    if (!b) { errors.push(`la barre d'onglets n'a pas d'onglet « ${cle} »`); continue; }
    await b.click();
    await page.waitForTimeout(cle === 'equipes' ? 2500 : 400);
    const e = await lire();
    vus.push(`${cle} ${e.ecrans}×`);
    if (e.page !== cle) errors.push(`l'onglet « ${cle} » ne pose pas la page : body[data-page] vaut « ${e.page} »`);
    if (e.ecrans > 1.05) errors.push(`l'onglet « ${cle} » fait ${e.ecrans} écrans : une page est une boîte bornée dont le CORPS défile`);
    await sansDebordement(`l'onglet ${cle}`);
    await toutEstAtteignable(`l'onglet ${cle}`);
    if (cle === 'alignement') {
      const intrus = ['spin', 'dash', 'pool'].filter(k => e[k]);
      if (intrus.length) errors.push(`l'onglet de l'alignement porte aussi ${intrus.join(', ')} : un onglet, une raison d'être`);
      if (!e.roster) errors.push("l'onglet de l'alignement ne montre pas l'alignement");
    }
  }
  console.log(`   un onglet, une raison d'être : ${vus.join(' · ')}`);
  await page.click('.navtab[data-page="repechage"]');
  await page.waitForTimeout(300);
}

const enabled = await page.$eval('#mainBtn', b => !b.disabled);
console.log(`3. #mainBtn actif : ${enabled}`);
/* L'écran de saison : on avance d'une journée, on lit les meneurs, on regarde
   un match en direct (pause, statistiques, reprise, fin), puis on passe à la
   fin et au bilan. */
async function traverserSaison(etiquette, reprise = false) {
  await page.waitForSelector('#hubModal .hub-jour', { timeout: 60000 });
  await page.click('#hubModal .hub-jour');
  await page.waitForTimeout(150);
  const jour = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();

  /*
   * UNE SAISON EN COURS SURVIT À UN RAFRAÎCHISSEMENT. La sauvegarde s'arrêtait
   * au repêchage (`if (G.done) clearSave()`), donc recharger la page à la
   * journée 40 rendait un alignement complet et un bouton « Simuler ». Le
   * moteur étant déterministe, la reprise ne relit rien : elle rejoue la même
   * graine et réapplique les journées vues. Le test le vérifie de la seule
   * façon qui vaille — la même en-tête des deux côtés d'un `reload`.
   */
  if (reprise) {
    await page.click('#hubModal .hub-dix');
    await page.waitForTimeout(400);
    const avant = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    const sauve = await page.evaluate(() => {
      try {
        const brut = localStorage.getItem('cap82_save') || '';
        const d = JSON.parse(brut || '{}');
        return { journee: d.partie?.journee ?? -1, clubs: (d.partie?.adversaires || []).length, ko: Math.round(brut.length / 1024) };
      } catch { return { journee: -1, clubs: 0, ko: 0 }; }
    });
    await page.reload({ waitUntil: 'networkidle' });
    // On DIT ce qui manque plutôt que de laisser expirer une attente de deux
    // minutes : une régression de sauvegarde rendait un test qui meurt sur un
    // `TimeoutError`, illisible dans un journal d'Action.
    let repris = true;
    try { await page.waitForSelector('#hubModal', { state: 'visible', timeout: 90000 }); }
    catch { repris = false; }
    if (!repris) {
      // Rien de ce qui suit n'a de sens sans la saison : on s'arrête ici, en
      // le disant, plutôt que d'expirer trente lignes plus loin sur
      // `.result .score` — l'échec doit nommer ce qui est cassé.
      console.log('\n✗ la saison en cours ne survit pas à un rafraîchissement : l\'écran de saison ne rouvre pas.');
      await browser.close();
      process.exit(1);
    }
    await page.waitForTimeout(900);
    const apres = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    if (avant !== apres) errors.push(`la saison ne reprend pas au même endroit : « ${avant} » puis « ${apres} »`);
    else console.log(`   reprise après rafraîchissement : ${apres} — ${sauve.clubs} clubs et la graine en ${sauve.ko} ko`);
    if (sauve.journee < 1) errors.push('la sauvegarde ne porte pas la journée révélée');

    /*
     * DERRIÈRE LE BANC : les choix en saison. L'écran se retire, l'alignement
     * s'ouvre avec les fiches À CE JOUR (jamais celles de fin de saison), on
     * désigne un trio de fermeture, on permute deux joueurs, et « Retour au
     * match » rejoue la saison depuis la graine avec la décision : les
     * journées d'avant sont identiques, donc la même en-tête des deux côtés.
     */
    const teteAvantBanc = apres;
    await page.click('#hubModal .hub-banc');
    await page.waitForSelector('#bancPanel:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(300);
    /*
     * C'EST L'ÉCRAN QUE JP A SIGNALÉ, et le garde-fou est posé dessus.
     * `#game.banc #paneRoster { display: block }` battait le contrat de
     * hauteur en spécificité : `.roster` cessait d'être un item flex et
     * grandissait à 1497 px sous une fenêtre de 844, coupé sans défilement.
     */
    await toutEstAtteignable('derrière le banc');
    const banc = (await page.textContent('#bancPanel')).replace(/\s+/g, ' ').trim();
    const ficheBanc = (banc.match(/(\d+-\d+-\d+)/) || [])[1];
    if (!ficheBanc || !teteAvantBanc.includes(ficheBanc)) errors.push(`le banc ne dit pas la fiche de l'écran de saison : « ${banc.slice(0, 80)} »`);
    const metas = await page.$$eval('.slot', els => els.filter(e => e.querySelector('.slot-name')).map(e => e.querySelectorAll('.slot-meta')[1]?.textContent.trim() || ''));
    if (metas.length !== 23 || !metas.every(m => /^(\d+-\d+-\d+ · [+-−]?\d+|\d+-\d+ · [,—]|aucun match)/.test(m))) errors.push(`les cases du banc ne portent pas la fiche à ce jour : ${metas.slice(0, 3).join(' | ')}`);
    if ((await page.$$('.slot-remove')).length) errors.push('le banc laisse retirer un joueur en pleine saison');
    // Le 3e trio est la fermeture par défaut (FERMETURE_DEFAUT) : le 🔒 doit
    // déjà le dire, et on la DÉPLACE au 2e — c'est le déplacement qui prouve
    // que la décision voyage jusqu'à la sauvegarde.
    const verrous = await page.$$('.line-ferm');
    if (verrous.length !== 4) errors.push(`${verrous.length} 🔒 au lieu de quatre`);
    else {
      const parDefaut = await page.$$eval('.line-ferm', e => e.map(x => x.classList.contains('on')));
      if (JSON.stringify(parDefaut) !== '[false,false,true,false]') errors.push(`le banc n'affiche pas le 3e trio en fermeture par défaut : ${JSON.stringify(parDefaut)}`);
      await verrous[1].click();
    }
    await page.waitForTimeout(150);
    const nomsAvant = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.trim()));
    await page.locator('.slot').nth(0).click(); await page.waitForTimeout(120);
    await page.locator('.slot').nth(9).click(); await page.waitForTimeout(200);
    const nomsApres = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.trim()));
    if (nomsAvant[0] !== nomsApres[9]) errors.push('la permutation derrière le banc n\'a pas eu lieu');
    await page.click('#bancRetour');
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 120000 });
    await page.waitForTimeout(300);
    const teteApresBanc = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    if (teteApresBanc !== teteAvantBanc) errors.push(`le retour au match ne reprend pas au même endroit : « ${teteAvantBanc} » puis « ${teteApresBanc} »`);
    const decisions = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_save')).partie.decisions || []; } catch { return []; } });
    if (decisions.length !== 2 || decisions[1].fermeture !== 1) errors.push(`la sauvegarde ne porte pas la décision du banc : ${JSON.stringify(decisions.map(d => [d.jour, d.fermeture]))}`);
    else console.log(`   derrière le banc : ${nomsAvant[0]} ↔ ${nomsAvant[9]}, fermeture déplacée au 2e trio, retour à « ${teteApresBanc} » — décision sauvegardée au jour ${decisions[1].jour}`);

    /*
     * LE PALIER DE CARTES. À trois journées de la saison (PALIERS_CARTES), on
     * prend une carte parmi trois : un bonus payé par un malus. Quatre choses
     * se vérifient, et aucune ne se lit dans le moteur.
     *
     * (1) L'avance S'ARRÊTE au palier et trois cartes sont offertes.
     * (2) Elle ne s'arrête qu'UNE FOIS : tant que le palier rebloquait,
     *     « +10 journées » avançait d'UNE journée par clic pour qui avait
     *     décidé de ne pas choisir. L'autre raison légitime de s'arrêter
     *     après une journée est une blessure, et on la lit à l'écran plutôt
     *     que de la deviner — sinon le garde-fou crie pour du bruit.
     * (3) La prise devient une DÉCISION dans la sauvegarde, avec son palier
     *     ET son jour : ce sont deux choses, et les confondre rembobine la
     *     saison pour qui prend une offre laissée de côté.
     * (4) Une carte prise NE REPARAÎT PLUS au palier suivant. Sans ça le pire
     *     cas est trois fois le même curseur, et c'est lui qu'il aurait fallu
     *     équilibrer plutôt que le choix réel.
     */
    /*
     * LA JOURNÉE SE LIT DANS L'EN-TÊTE, et il a fallu le bris pour s'en
     * souvenir : `.hub-titre` est dans le VOLET (« Journée 25 » quand
     * l'onglet de la journée est ouvert, tout autre chose sinon), donc le
     * lire donnait « 25149285792 » — les chiffres du tableau d'à côté. Un
     * sélecteur qui matche la mauvaise chose ment plus fort qu'un sélecteur
     * qui ne matche rien.
     */
    const jourDit = async () => {
      const t = ((await page.textContent('#hubModal .hub-head')) || '').replace(/\s+/g, ' ');
      const m = t.match(/Journée\s+(\d+)/);
      if (!m) { errors.push(`l'en-tête de l'écran de saison ne dit pas la journée : « ${t.slice(0, 60)} »`); return -1; }
      return Number(m[1]);
    };
    /*
     * LA CASE VIDE SE GUETTE PENDANT L'AVANCE, PAS APRÈS — et c'est un test
     * qui mentait, pas un jeu qui ne marchait pas.
     *
     * Chaque interruption n'arrête « +10 journées » qu'UNE fois (la règle du
     * palier, étendue aux blessures, aux situations et aux cases vides). Les
     * clics des blocs précédents CONSOMMENT donc les cases vides au passage :
     * le panneau s'affiche bien, personne ne le regarde, et le clic suivant
     * la marque vue. Un garde-fou posté après la boucle ne trouvait plus
     * rien, et concluait « aucune case vide cette saison » — y compris avec
     * le risque de blessure multiplié par NEUF, ce qui aurait dû mettre la
     * puce à l'oreille bien plus tôt.
     *
     * On guette donc après CHAQUE avance, et on exerce le panneau à la
     * première occasion, où qu'elle tombe.
     */
    const trouVu = { fait: false, mot: null, erreurs: [] };
    const guetterTrou = async () => {
      if (trouVu.fait) return;
      if (!(await page.$('#hubModal .hub-trou'))) return;
      trouVu.fait = true;
      const avant = await jourDit();
      const carte = await page.evaluate(() => {
        const el = document.querySelector('#hubModal .hub-trou');
        return {
          tete: (el.querySelector('.hub-trou-tete') || {}).textContent || '',
          nom: (el.querySelector('.hub-tiree-nom') || {}).textContent || '',
          // `.hub-pige` dans un panneau de case vide voudrait dire qu'on
          // CHOISIT — et c'est la classe que le garde-fou du palier compte.
          pige: el.querySelectorAll('.hub-pige').length,
          tirees: el.querySelectorAll('.hub-tiree').length,
        };
      });
      if (carte.tirees !== 1) trouVu.erreurs.push(`la case vide montre ${carte.tirees} cartes tirées : il en faut exactement une`);
      if (carte.pige) trouVu.erreurs.push(`la case vide porte ${carte.pige} carte(s) « à prendre » : on ne choisit pas celle-là`);
      if (!carte.nom.trim()) trouVu.erreurs.push('la carte tirée n\'est pas nommée');
      const quel = await page.$eval('#hubModal .hub-trou-prendre', e => e.dataset.trou);
      await page.click('#hubModal .hub-trou-prendre');
      await page.waitForSelector('#hubModal .hub-jour', { timeout: 120000 });
      await page.waitForTimeout(400);
      const apres = await jourDit();
      if (apres !== avant) trouVu.erreurs.push(`encaisser la carte d'une case vide rembobine la saison : journée ${avant} puis ${apres}`);
      const dTrou = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_save')).partie.decisions || []; } catch { return []; } }))
        .filter(d => typeof d.palier === 'string' && d.palier.startsWith('trou:'));
      if (!dTrou.length) trouVu.erreurs.push('la carte de la case vide n\'entre pas dans la sauvegarde');
      /*
       * ELLE NE RETEND PAS **LA SIENNE** — et la nuance est tout le test.
       * Un panneau présent juste après l'encaissement peut parfaitement être
       * un SECOND épisode, ce qui est le comportement voulu (une deuxième
       * crise mérite sa carte). Ce qu'il ne doit jamais être, c'est le même :
       * sans `trousFaits`, la reprise repart avec `trousVus` vide, l'épisode
       * déjà encaissé se represente, et la partie accumule une carte par
       * clic. On compare donc l'IDENTITÉ de l'épisode, pas la présence du
       * panneau.
       */
      const encore = await page.$eval('#hubModal .hub-trou-prendre', e => e.dataset.trou).catch(() => null);
      if (encore !== null && String(encore) === String(quel)) {
        trouVu.erreurs.push(`la case vide retend SA carte après qu'on l'a encaissée : épisode ${quel} deux fois`);
      }
      trouVu.mot = `${carte.tete.trim()} → ${carte.nom.trim()} encaissée au jour ${avant}`;
    };

    const versPalier = async () => {
      // HUIT CLICS NE SUFFISENT PLUS : l'avance s'arrête aussi aux fenêtres
      // de situations (journées 10, 28, 46, 64) et aux cases vides, en plus
      // des blessures. Le budget suit le nombre d'interruptions possibles.
      for (let i = 0; i < 16 && !(await page.$('#hubModal .hub-pige')); i++) {
        await page.click('#hubModal .hub-dix');
        await page.waitForTimeout(250);
        await guetterTrou();
      }
      return page.$$eval('#hubModal .hub-pige', e => e.map(x => x.dataset.carte));
    };
    const offertes = await versPalier();
    if (offertes.length !== 3) errors.push(`le palier de cartes en offre ${offertes.length} au lieu de trois`);
    else {
      const jPalier = await jourDit();
      await page.click('#hubModal .hub-dix');
      await page.waitForTimeout(350);
      const jApres = await jourDit();
      const blesse = !!(await page.$('#hubModal .hub-alerte'));
      if (jApres - jPalier < 2 && !blesse) errors.push(`le palier arrête « +10 journées » une seconde fois : journée ${jPalier} puis ${jApres}, et aucune blessure à annoncer`);
      // Reprendre l'offre laissée de côté : elle tient, et la carte entre en
      // vigueur AUJOURD'HUI, pas au palier.
      const encore = await page.$$eval('#hubModal .hub-pige', e => e.map(x => x.dataset.carte));
      if (JSON.stringify(encore) !== JSON.stringify(offertes)) errors.push(`l'offre du palier ne tient pas : ${offertes.join(' · ')} puis ${encore.join(' · ')}`);
      const jPrise = await jourDit();
      const pris = offertes[0];
      await page.click(`#hubModal .hub-pige[data-carte="${pris}"]`);
      await page.waitForSelector('#hubModal .hub-jour', { timeout: 120000 });
      await page.waitForTimeout(400);
      const jRevenu = await jourDit();
      if (jRevenu !== jPrise) errors.push(`prendre une carte rembobine la saison : journée ${jPrise} puis ${jRevenu}`);
      /*
       * LES CARTES D'UN PALIER SE COMPTENT À PART DE CELLES D'UNE CASE VIDE.
       * Cette assertion exigeait UNE seule décision de carte dans la
       * sauvegarde — vrai tant que les paliers étaient la seule façon d'en
       * prendre une. Depuis qu'une case vide en TIRE une, une saison
       * malchanceuse en porte deux, et le garde-fou du palier rougissait sur
       * une partie parfaitement saine. Le palier est un NOMBRE (20 / 40 /
       * 60), la case vide une chaîne (`trou:<match>`) : c'est ce qui les
       * distingue, et c'est pour ça que les deux ne partagent pas la même
       * clé.
       */
      const dCarte = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_save')).partie.decisions || []; } catch { return []; } }))
        .filter(d => d.carte && typeof d.palier === 'number');
      if (dCarte.length !== 1 || dCarte[0].carte !== pris) errors.push(`la sauvegarde ne porte pas la carte prise au palier : ${JSON.stringify(dCarte)}`);
      else if (dCarte[0].palier !== jPalier) errors.push(`la décision ne porte pas son palier : palier ${dCarte[0].palier} au lieu de ${jPalier}`);
      if (await page.$('#hubModal .hub-pige')) errors.push('le palier reste ouvert après qu\'on y a pris une carte');
      const suivantes = await versPalier();
      if (suivantes.length !== 3) errors.push(`le palier suivant offre ${suivantes.length} cartes au lieu de trois`);
      else if (suivantes.includes(pris)) errors.push(`la carte « ${pris} », déjà prise, reparaît au palier suivant : ${suivantes.join(' · ')}`);
      else console.log(`   palier ${jPalier} : ${offertes.join(' · ')} → « ${pris} » prise au jour ${jPrise}, palier suivant ${suivantes.join(' · ')}`);

      /*
       * LE PALIER NE POUSSE RIEN HORS DE L'ÉCRAN. La carte des trois choix
       * s'ajoute EN TÊTE des actions, et l'alerte de blessure juste dessous :
       * deux blocs hauts de plus dans une colonne dont seul le volet peut
       * rétrécir. Quand les deux sont ouverts en même temps, la barre
       * d'onglets sortait par le bas — et un bouton hors du cadre d'une
       * feuille en `position: fixed` ne se clique plus : Playwright a
       * réessayé soixante-deux fois avant d'abandonner sur « html intercepts
       * pointer events », un échec qui ne nomme rien. On le MESURE ici, dans
       * l'état exact qui l'a produit.
       */
      /*
       * LE PIRE CAS SE FABRIQUE, IL NE S'ATTEND PAS. Le débordement demande
       * la carte ET l'alerte de blessure en même temps, et une blessure au
       * bon jour est un tirage : la mesure ne serait vraie qu'une fois sur
       * plusieurs, donc le garde-fou sauterait en silence la plupart du
       * temps — « un test qui dépend du tirage n'est pas un test, c'est une
       * loterie ». Quand l'alerte n'est pas là, on en pose une du même
       * gabarit, on mesure, et on la retire.
       */
      const place = await page.evaluate(() => {
        const actions = document.querySelector('#hubModal .hub-actions');
        const vraie = !!document.querySelector('#hubModal .hub-alerte');
        let faux = null;
        if (actions && !vraie) {
          faux = document.createElement('div');
          faux.className = 'hub-alerte';
          faux.innerHTML = '<div class="hub-alerte-tete">🚑 Untel est blessé</div>'
            + '<div class="hub-alerte-note">8 matchs d\'absence · 1re paire · DD · Untel monte</div>'
            + '<button class="btn gold">Derrière le banc</button>';
          actions.prepend(faux);
        }
        const b = document.querySelector('#hubModal .hub-onglets');
        if (!b) { if (faux) faux.remove(); return null; }
        const r = b.getBoundingClientRect();
        const bas = Math.round(window.innerHeight - r.bottom);
        const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        const out = {
          bas,
          carte: !!document.querySelector('#hubModal .hub-cartes'),
          alerte: vraie ? 'vraie' : 'posée pour la mesure',
          atteignable: !!el && (el === b || b.contains(el)),
        };
        if (faux) faux.remove();
        return out;
      });
      if (!place) errors.push('la barre d\'onglets a disparu de l\'écran de saison');
      else if (malPlacee(place.bas) || !place.atteignable) errors.push(`le palier pousse la barre d'onglets hors de l'écran : ${place.bas} px du bas (retrait voulu ${FLOTTE}), atteignable ${place.atteignable} (carte ${place.carte}, alerte ${place.alerte})`);
      else console.log(`   le palier ne pousse rien : barre à ${place.bas} px du bas, atteignable — carte ${place.carte}, alerte ${place.alerte}`);
    }

  /*
   * LES SITUATIONS : deux hommes nommés, et rien à cliquer.
   *
   * Le panneau s'ouvre aux journées 10, 28, 46 et 64 — des fenêtres FIXES,
   * donc ce garde-fou ne dépend d'aucun tirage : en avançant, on en croise
   * forcément une. Ce qu'il vérifie est ce que la mécanique promet à
   * l'écran : DEUX joueurs, un porté et un pesé, jamais le même homme, et
   * chacun avec le mot qui dit ce qui lui arrive. Un panneau qui n'en
   * nommerait qu'un ne serait plus une paire, et « ça s'équilibre » ne
   * voudrait plus rien dire.
   */
  {
    for (let i = 0; i < 12 && !(await page.$('#hubModal .hub-situ')); i++) {
      await page.click('#hubModal .hub-dix');
      await page.waitForTimeout(260);
      await guetterTrou();
    }
    const situ = await page.evaluate(() => {
      const el = document.querySelector('#hubModal .hub-situ');
      if (!el) return null;
      const bout = [...el.querySelectorAll('.hub-situ-bout')].map(b => ({
        sens: b.classList.contains('hub-situ-porte') ? 'porte' : b.classList.contains('hub-situ-pese') ? 'pese' : '?',
        nom: (b.querySelector('.hub-situ-nom') || {}).textContent || '',
        quoi: (b.querySelector('.hub-situ-quoi') || {}).textContent || '',
        mot: (b.querySelector('.hub-situ-mot') || {}).textContent || '',
      }));
      return { bout, large: el.scrollWidth > el.clientWidth + 1 };
    });
    if (!situ) errors.push('aucune fenêtre de situations en douze avances de dix journées');
    else if (situ.bout.length !== 2) errors.push(`le vestiaire nomme ${situ.bout.length} joueur(s) au lieu de deux`);
    else {
      const [a, b] = situ.bout;
      if (a.sens !== 'porte' || b.sens !== 'pese') errors.push(`la paire n'est pas un porté puis un pesé : ${a.sens} · ${b.sens}`);
      if (!a.nom.trim() || !b.nom.trim()) errors.push('un bout de la paire n\'a pas de nom');
      if (a.nom === b.nom) errors.push(`le porté et le pesé sont le même homme : ${a.nom}`);
      if (!a.quoi.trim() || !b.quoi.trim() || !a.mot.trim() || !b.mot.trim()) errors.push('un bout de la paire ne dit ni ce que ça change ni pourquoi');
      if (situ.large) errors.push('le panneau des situations déborde en largeur');
      if (!errors.length || true) console.log(`   le vestiaire : ${a.nom.trim()} (porté) · ${b.nom.trim()} (pesé)`);
    }
  }

  /*
   * LA CASE VIDE — et pourquoi son garde-fou est PARTAGÉ entre ce script et
   * `check_situations.mjs`.
   *
   * Elle arrive quand aucun réserviste ne peut prendre la place d'un blessé,
   * MESURÉ à 1,3 fois par équipe par saison : deux équipes sur trois en
   * vivent au moins une, une sur trois n'en vit aucune. Une assertion dure
   * ici rougirait donc une exécution sur trois sans qu'une ligne du jeu ait
   * bougé — « un test qui dépend du tirage n'est pas un test, c'est une
   * loterie ».
   *
   * Le partage est donc explicite, et rien ne saute en silence : la
   * FRÉQUENCE et la PURETÉ du tirage sont exigées dans `check_situations.mjs`
   * (côté Node, sur 192 équipes-saisons, sans aucun hasard d'exécution) ;
   * ici, `guetterTrou` exerce le panneau à la PREMIÈRE occasion pendant
   * l'avance, et on DIT laquelle des deux branches on a prise.
   */
  for (const e of trouVu.erreurs) errors.push(e);
  if (trouVu.mot) console.log(`   case vide : ${trouVu.mot}`);
  else console.log('   aucune case vide cette saison (deux saisons sur trois en ont une — la fréquence est exigée dans check_situations)');
  }

  /*
   * UNE SEULE BARRE D'ONGLETS, ET ELLE EST EN BAS. L'écran de saison portait
   * la sienne AU MILIEU de la feuille, entre les boutons et le volet ; la
   * barre du jeu, elle, est en bas — deux endroits pour le même geste. Ça se
   * mesure : la barre doit commencer SOUS le volet qu'elle commande.
   */
  {
    const ou = await page.evaluate(() => {
      const b = document.querySelector('#hubModal .hub-onglets'), v = document.querySelector('#hubModal .hub-volet');
      if (!b || !v) return null;
      const rb = b.getBoundingClientRect(), rv = v.getBoundingClientRect();
      return { barre: Math.round(rb.top), volet: Math.round(rv.top), fond: Math.round(window.innerHeight - rb.bottom) };
    });
    if (!ou) errors.push("l'écran de saison n'a plus de barre d'onglets");
    else if (ou.barre < ou.volet) errors.push(`la barre de l'écran de saison est au-dessus du volet (${ou.barre} px contre ${ou.volet}) : une barre d'onglets est en bas`);
    // Les DEUX bords comptent : une barre poussée SOUS l'écran donne un écart
    // négatif (le défaut de S55, −38 px), une barre qui décolle trop donne un
    // écart plus grand que le retrait voulu.
    else if (malPlacee(ou.fond)) errors.push(`la barre de l'écran de saison est à ${ou.fond} px du bas (retrait voulu ${FLOTTE})`);
    else console.log(`   une seule barre, et elle est en bas : volet à ${ou.volet} px, barre à ${ou.barre} px, à ${ou.fond} px du bas`);
  }
  await page.click('#hubModal .hub-onglets button[data-onglet="meneurs"]');
  const tableaux = await page.$$eval('#hubModal .hub-volet .live-tableau', l => l.length);
  const meneurs = await page.$$eval('#hubModal .hub-volet tbody tr', l => l.length);
  console.log(`   ${etiquette} : ${jour} · meneurs : ${tableaux} tableaux, ${meneurs} rangées`);
  if (!meneurs) errors.push(`${etiquette} : aucun meneur dans l'onglet des meneurs`);
  await nomsCliquables(etiquette);
  // Le match en direct, sur demande seulement.
  await page.click('#hubModal .hub-regarder');
  await page.waitForSelector('#liveModal .live-pause', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.click('#liveModal .live-pause');
  await page.click('#liveModal .live-onglets button[data-onglet="stats"]');
  const face = await page.$$eval('#liveModal .live-face tbody tr', l => l.length);
  await page.click('#liveModal .live-pause');
  await page.click('#liveModal .live-fin');
  await page.waitForSelector('#liveModal .live-suite', { timeout: 10000 });
  const fil = await page.$eval('#liveModal .live-feed', e => e.textContent);
  const xe = (fil.match(/\(\d+(?:er|e) but\)/) || ['aucun but'])[0];
  await page.click('#liveModal .live-suite');
  await page.waitForTimeout(150);
  const apres = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
  console.log(`   match en direct : ${face} lignes de statistiques, ${xe} · puis ${apres}`);
  if (!face) errors.push(`${etiquette} : aucune statistique du match en direct`);
  await page.click('#hubModal .hub-fin');
  await page.waitForSelector('#hubModal .hub-suite', { timeout: 10000 });
  await page.click('#hubModal .hub-suite');
  await page.waitForSelector('.result .score', { timeout: 60000 });
}

/*
 * AUCUN NOM AFFICHÉ NE RESTE MUET — ET AUCUN NE DÉVOILE LA FIN.
 *
 * Deux règles, et la seconde est la seule qui demande une mesure. Un nom
 * cliqué à la journée 20 ouvre la fiche du joueur : si elle lit les
 * compteurs `sim*` du moteur, elle annonce ses 82 matchs, alors que l'écran
 * n'en a révélé que vingt (la leçon de `G.done`, S49). On compare donc les
 * MATCHS JOUÉS de la fiche à la journée courante : une fiche honnête ne
 * peut pas en porter davantage.
 *
 * Et la fiche doit porter les DEUX saisons — celle du jeu et la vraie —
 * puisque c'est ce qu'on est venu y lire.
 */
async function nomsCliquables(etiquette) {
  const muets = await page.$$eval('#hubModal .hub-volet tbody tr', ls => ({
    total: ls.length,
    noms: ls.filter(tr => tr.querySelector('td.nom') && !tr.querySelector('td.nom .lien-joueur')).length,
    eq: ls.filter(tr => tr.querySelector('td.eq') && !tr.querySelector('td.eq .lien-equipe')).length,
  }));
  if (muets.noms) errors.push(`${etiquette} : ${muets.noms} nom(s) sur ${muets.total} ne s'ouvrent pas aux meneurs`);
  if (muets.eq) errors.push(`${etiquette} : ${muets.eq} code(s) d'équipe sur ${muets.total} ne s'ouvrent pas aux meneurs`);
  // ON NE CLIQUE PAS CE QU'ON VIENT DE DÉCLARER ABSENT : sans ce retour,
  // Playwright attend trente secondes un bouton qui n'existe pas et meurt
  // sur « Timeout » au lieu de nommer la cause (la leçon de S46).
  if (!muets.total || muets.noms) return;

  const tete = (await page.textContent('#hubModal .hub-head')) || '';
  const jourN = Number((tete.match(/Journée\s+(\d+)/) || [])[1] || 0);

  await page.click('#hubModal .hub-volet tbody tr td.nom .lien-joueur');
  await page.waitForSelector('#hockeyCardModal .stat-grid', { timeout: 10000 });
  const fiche = await page.evaluate(() => {
    const m = document.getElementById('hockeyCardModal');
    const sections = [...m.querySelectorAll('.section-label')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const cell = [...m.querySelectorAll('.stat-grid .stat-cell')].find(c => c.querySelector('.k').textContent.trim() === 'PJ');
    return {
      nom: (m.querySelector('.pcard-full-name, h2, .pcard-full h2') || {}).textContent || '',
      sections,
      pj: cell ? Number(cell.querySelector('.v').textContent.trim()) : null,
      lien: !!m.querySelector('a[href*="nhl.com"]'),
    };
  });
  const titreJour = fiche.sections.some(t => /à ce jour/i.test(t));
  const vraie = fiche.sections.some(t => /vraie saison/i.test(t));
  if (!titreJour) errors.push(`${etiquette} : la fiche ouverte en pleine saison ne dit pas « à ce jour » (${fiche.sections[0] || 'aucune section'})`);
  if (!vraie) errors.push(`${etiquette} : la fiche ouverte en pleine saison ne montre pas la vraie saison du joueur`);
  if (!fiche.lien) errors.push(`${etiquette} : la fiche n'a pas son lien vers la LNH`);
  if (jourN && fiche.pj !== null && fiche.pj > jourN)
    errors.push(`la fiche dévoile la fin : ${fiche.pj} matchs joués à la journée ${jourN}`);
  console.log(`   un nom s'ouvre à la journée ${jourN} : ${fiche.pj} matchs joués, « ${fiche.sections[0] || '?'} »`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  // UN CODE D'ÉQUIPE OUVRE SON CLUB, DANS L'ÉCRAN : l'onglet « Équipes »
  // montre déjà n'importe quel club à ce jour ; une modale en montrerait une
  // deuxième version, qui lirait la fin de l'année.
  if (muets.eq) return;
  await page.click('#hubModal .hub-volet tbody tr td.eq .lien-equipe');
  await page.waitForTimeout(150);
  const onglet = await page.$eval('#hubModal .hub-onglets button.on', b => b.dataset.onglet).catch(() => null);
  if (onglet !== 'equipes') errors.push(`${etiquette} : un code d'équipe n'ouvre pas l'onglet des équipes (onglet « ${onglet} »)`);
  else {
    const dansLeClub = await page.$$eval('#hubModal .hub-volet tbody tr', ls =>
      ls.filter(tr => tr.querySelector('td.nom') && !tr.querySelector('td.nom .lien-joueur')).length);
    if (dansLeClub) errors.push(`${etiquette} : ${dansLeClub} nom(s) muet(s) dans la feuille d'une équipe`);
  }
  await page.click('#hubModal .hub-onglets button[data-onglet="meneurs"]');
  await page.waitForTimeout(100);
}

/* La saison jusqu'au bilan, sans rien regarder : ce qui sert à REJOUER
   jusqu'à se qualifier, où seul le classement final compte. */
async function finirVite() {
  await page.waitForSelector('#hubModal .hub-fin', { timeout: 90000 });
  await page.click('#hubModal .hub-fin');
  await page.waitForSelector('#hubModal .hub-suite', { timeout: 15000 });
  await page.click('#hubModal .hub-suite');
  await page.waitForSelector('.result .score', { timeout: 60000 });
}

if (enabled) {
  await page.click('#mainBtn');
  await traverserSaison('saison', true);
  const score = await page.textContent('.result .score');
  const rows = await page.$$eval('.rrow', r => r.length);
  console.log(`4. fiche ${score.trim()}, ${rows} rangées`);
  // Le bilan porte les tableaux les plus larges du jeu (onze colonnes) : s'il
  // y a un débordement quelque part, il est ici.
  await sansDebordement('bilan de saison');

  /*
   * PERSONNE NE GAGNAIT RIEN. Le jeu jouait 82 matchs, couronnait un champion,
   * et ne consacrait aucun joueur — les neuf palmarès étaient là, personne ne
   * les remportait. Cinq trophées et une première équipe d'étoiles, tous
   * décidés par les colonnes : ce que le moteur tranche, jamais ce qu'un vote
   * trancherait.
   */
  await page.click('.navtab[data-page="stats"]');
  await page.waitForTimeout(350);
  const trophees = await page.$$eval('.tro-carte', els => els.map(e => ({
    nom: (e.querySelector('.tro-nom') || {}).textContent || '',
    val: (e.querySelector('.tro-val') || {}).textContent || '',
  })));
  const etoiles = await page.$$eval('.result-pane[data-volet="stats"] .tro-titre + .table-wrap tbody tr', l => l.length);
  if (trophees.length < 5) errors.push(`seulement ${trophees.length} trophée(s) décerné(s) sur 5`);
  else if (trophees.some(t => !t.val.trim() || t.val.trim() === '—')) errors.push(`un trophée sans gagnant : ${JSON.stringify(trophees)}`);
  else if (etoiles !== 6) errors.push(`l'équipe d'étoiles compte ${etoiles} joueurs au lieu de six`);
  else console.log(`   trophées : ${trophees.map(t => `${t.nom.trim()} ${t.val.trim()}`).join(' · ')} · équipe d'étoiles à ${etoiles}`);
  await sansDebordement('trophées de la saison');

  /*
   * UN CLUB S'OUVRE SUR SES DEUX SAISONS. JP : *pouvoir cliquer sur nom de
   * joueur et équipe pour voir carte avec stats simulés et réelles et liens
   * vers sites externes*. La page d'une équipe montrait la saison JOUÉE et
   * rien d'autre ; la vraie fiche du club se reconstitue de son shard
   * (`ficheDeClub`, la méthode de check_ratings) et arrive en asynchrone,
   * donc on l'ATTEND plutôt que de la lire tout de suite.
   */
  {
    await page.click('.navtab[data-page="classement"]');
    await page.waitForTimeout(150);
    const cible = await page.$$eval('#resultHost .result-pane[data-volet="classement"] .lien-equipe', ls => {
      const i = ls.findIndex(b => !/NHL/.test(b.textContent));
      return i >= 0 ? i : -1;
    }).catch(() => -1);
    if (cible < 0) errors.push('aucun club adverse cliquable au classement');
    else {
      await page.$$eval('#resultHost .result-pane[data-volet="classement"] .lien-equipe', (ls, i) => ls[i].click(), cible);
      await page.waitForSelector('#gameModal', { state: 'visible', timeout: 10000 });
      // La vraie fiche se charge d'un shard : on lui laisse le temps d'arriver.
      await page.waitForFunction(() => {
        const g = document.getElementById('eqVraie');
        return g && !g.querySelector('.dash-note');
      }, null, { timeout: 20000 }).catch(() => {});
      const club = await page.evaluate(() => {
        const m = document.getElementById('gameModal');
        const cellules = g => [...(g ? g.querySelectorAll('.stat-cell') : [])]
          .map(c => `${c.querySelector('.k').textContent.trim()} ${c.querySelector('.v').textContent.trim()}`);
        return {
          // La saison JOUÉE est dans le titre (la fiche V-D-DP) et dans les
          // deux tables ; la vraie est la grille qu'on vient de reconstituer.
          titre: ((m.querySelector('#gameModalTitle') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
          rangees: m.querySelectorAll('table.data tbody tr').length,
          vraie: cellules(document.getElementById('eqVraie')).slice(0, 3).join(' · '),
          hr: !!m.querySelector('a[href*="hockey-reference"]'),
          attente: !!(document.getElementById('eqVraie') || {}).querySelector?.('.dash-note'),
        };
      });
      if (!club.vraie) errors.push(`la page d'un club ne porte pas sa vraie saison (${club.titre.trim()})`);
      else if (club.attente) errors.push("la vraie saison d'un club reste en attente");
      if (!club.hr) errors.push("la page d'un club n'a pas son lien vers Hockey-Reference");
      if (!club.rangees) errors.push("la page d'un club ne montre aucun joueur");
      else console.log(`   un club s'ouvre : « ${club.titre} », ${club.rangees} rangées · vraie saison ${club.vraie} · lien externe`);
      await sansDebordement("la page d'une équipe");
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
    }
    await page.click('.navtab[data-page="bilan"]');
    await page.waitForTimeout(120);
    /*
     * ET LES CARTONS D'ENTRACTE, qui sont l'autre endroit où le bilan nomme
     * des joueurs — meneurs, différentiel, gardiens, absences — plus la
     * chronique du vestiaire et l'infirmerie. Un nom affiché qui ne s'ouvre
     * pas est un cul-de-sac : on le compte plutôt que de l'espérer.
     */
    const bilanNoms = await page.evaluate(() => {
      const volet = document.querySelector('#resultHost .result-pane[data-volet="bilan"]');
      if (!volet) return null;
      /*
       * UNE COLONNE EST TOUTE EN NOMS OU PAS DU TOUT. Un carton d'entracte
       * porte aussi des tableaux dont la première colonne n'est PAS un nom
       * (« 1-10 », l'arc de la saison), donc « toute cellule de gauche doit
       * s'ouvrir » crierait pour du bruit. Ce qui ne peut pas arriver, c'est
       * qu'UNE rangée d'une colonne de noms reste muette pendant que ses
       * voisines s'ouvrent.
       */
      let colonnes = 0, boiteuses = 0, liens = 0;
      for (const t of volet.querySelectorAll('.ent-table')) {
        const cells = [...t.querySelectorAll('tbody td.left')].filter(td => td.textContent.trim());
        if (!cells.length) continue;
        const ouvrables = cells.filter(td => td.querySelector('.lien-joueur')).length;
        if (!ouvrables) continue;
        colonnes++; liens += ouvrables;
        if (ouvrables !== cells.length) boiteuses++;
      }
      // Le vestiaire et l'infirmerie nomment des joueurs ; « Tes cartes »
      // nomme des cartes, et ce n'est pas la même chose.
      const nommes = [...volet.querySelectorAll('.result-section')]
        .filter(sec => /vestiaire|infirmerie/i.test((sec.querySelector('h3') || {}).textContent || ''))
        .flatMap(sec => [...sec.querySelectorAll('.inj-list strong')]);
      return {
        colonnes, boiteuses, liens,
        listes: nommes.length,
        listesMuettes: nommes.filter(x => !x.querySelector('.lien-joueur')).length,
      };
    });
    if (!bilanNoms) errors.push('le volet du bilan est introuvable');
    else {
      if (!bilanNoms.colonnes) errors.push("aucun nom ouvrable dans les cartons d'entracte du bilan");
      if (bilanNoms.boiteuses) errors.push(`${bilanNoms.boiteuses} colonne(s) de noms où une rangée reste muette dans les cartons d'entracte`);
      if (bilanNoms.listesMuettes) errors.push(`${bilanNoms.listesMuettes} nom(s) muet(s) sur ${bilanNoms.listes} dans le vestiaire et l'infirmerie`);
      if (!bilanNoms.boiteuses && !bilanNoms.listesMuettes && bilanNoms.colonnes)
        console.log(`   le bilan nomme : ${bilanNoms.liens} joueurs en ${bilanNoms.colonnes} colonnes de cartons, ${bilanNoms.listes} au vestiaire et à l'infirmerie — tous ouvrables`);
    }
  }

  /* Aucun volet du bilan ne doit être une longue page — c'est LE défaut que
     le repêchage resté au-dessus provoquait, et il se lit d'un chiffre. */
  if (await page.$('#resultTabs')) errors.push("le bilan a encore sa propre barre d'onglets : il n'y en a qu'une, et elle est en bas");
  /*
   * LE NIVEAU DE LA LIGUE. JP : *je veux un onglet à la fin de la saison qui
   * montre la force relative de la ligue et comment x performe versus
   * l'attente du niveau de la ligue*. Trois choses s'éprouvent, et la
   * deuxième est un INVARIANT : les attentes sont mises à l'échelle des
   * points que la ligue a vraiment distribués, donc LA SOMME DES ÉCARTS EST
   * NULLE. Si elle dérive, l'écart d'un club ne veut plus rien dire — on
   * lirait « +7 » sur une ligue entière chanceuse.
   */
  {
    const ong = await page.$('.navtab[data-page="ligue"]');
    if (!ong) errors.push("l'onglet « La ligue » n'existe pas au bilan");
    else {
      await ong.click();
      await page.waitForTimeout(3500);   // les shards des 31 adversaires
      const n = await page.evaluate(() => {
        const v = document.querySelector('#resultHost .result-pane[data-volet="ligue"]');
        if (!v) return null;
        const ec = [...v.querySelectorAll('.niv-table tbody tr td.heros')].map(x => parseFloat(x.textContent));
        return {
          rangs: v.querySelectorAll('.niv-table tbody tr').length,
          somme: ec.reduce((a, x) => a + x, 0),
          attente: [...v.querySelectorAll('.niv-tuile b')].filter(x => x.textContent.trim() === '…').length,
          niveau: (v.querySelector('.niv-tuile b') || {}).textContent,
        };
      });
      if (!n) errors.push("le volet « La ligue » ne rend rien");
      else {
        if (n.rangs < 30) errors.push(`la table du niveau n'a que ${n.rangs} rangées`);
        if (Math.abs(n.somme) > 1.5) errors.push(`la somme des écarts vaut ${n.somme.toFixed(1)} au lieu de zéro : les attentes ne sont plus à l'échelle des points distribués`);
        if (n.attente) errors.push(`${n.attente} tuile(s) du niveau restent en points de suspension : les vraies saisons ne se sont pas chargées`);
        else console.log(`   le niveau de la ligue : ${n.rangs} clubs, vrai % de victoires des 31 ${(n.niveau || '').trim()}, somme des écarts ${n.somme.toFixed(1)}`);
      }
      await pasUneLonguePage('le bilan · la ligue');
      await sansDebordement('le bilan · la ligue');
    }
  }

  /*
   * MA LIGUE DANS L'ONGLET DES ÉQUIPES. JP : *les équipes dans l'onglet
   * équipe, je parle de ceux de la ligue en cours, je veux pouvoir comparer
   * les joueurs et équipes avec leurs vraies prestations*. L'écran ouvrait
   * les 44 franchises par saison — de l'histoire, sans rapport avec la
   * partie. Trois choses s'éprouvent : la ligue en cours est la source
   * OUVERTE dès qu'elle existe, elle porte ses 32 clubs, et un club met
   * chaque nombre du jeu au-dessus du vrai.
   */
  {
    await page.click('.navtab[data-page="equipes"]');
    await page.waitForTimeout(2600);
    const ouverte = await page.$$eval('#pageEquipes [data-source].on', e => e.map(x => x.dataset.source));
    if (ouverte[0] !== 'ligue') errors.push(`l'onglet des équipes ouvre « ${ouverte[0] || 'rien'} » au lieu de ma ligue une fois la saison jouée`);
    const clubsLigue = await page.$$eval('#pageEquipes .eq-carte', e => e.length);
    if (clubsLigue < 30) errors.push(`ma ligue ne montre que ${clubsLigue} clubs`);
    if (!(await page.$('#pageEquipes .eq-carte.mienne'))) errors.push('ma formation ne paraît pas parmi les clubs de ma ligue');
    const adverse = await page.$('#pageEquipes .eq-carte:not(.mienne)');
    if (!adverse) errors.push('aucun club adverse dans ma ligue');
    else {
      await adverse.click();
      await page.waitForTimeout(2600);
      const m = await page.evaluate(() => {
        const t = document.querySelector('#pageEquipes .eq-table.eq-double');
        if (!t) return null;
        const c = t.querySelector('tbody td.stat');
        return {
          rangees: t.querySelectorAll('tbody tr').length,
          double: !!(c && c.querySelector('b') && c.querySelector('i')),
          reel: !!document.querySelector('#pageEquipes .eq-tete-reel'),
        };
      });
      if (!m) errors.push("un club de ma ligue ne rend pas la table à deux nombres");
      else {
        if (!m.double) errors.push('une cellule ne porte pas le nombre du jeu ET le vrai');
        if (!m.reel) errors.push("le bandeau d'un club de ma ligue ne porte pas sa vraie saison");
        if (m.rangees < 10) errors.push(`un club de ma ligue n'a que ${m.rangees} rangées`);
        console.log(`   ma ligue : ${clubsLigue} clubs, un club rend ${m.rangees} rangées à deux nombres, la vraie saison au bandeau`);
      }
      await sansDebordement('un club de ma ligue');
      await sansCote('un club de ma ligue');
    }
    await page.click('.navtab[data-page="bilan"]');
    await page.waitForTimeout(400);
  }
  /*
   * LA BARRE A CHANGÉ D'ENTRÉES, parce que la phase a changé : on ne bâtit
   * plus, on lit. Neuf onglets ne tiennent pas dans 390 px — la barre défile
   * en x plutôt que de rétrécir « Calendrier » à quarante pixels, et c'est LE
   * conteneur qui défile, jamais la page (zéro débordement horizontal).
   */
  {
    const b = await page.evaluate(() => {
      const nav = document.querySelector('#navbar'), de = document.documentElement;
      return {
        noms: [...nav.querySelectorAll('.navtab-lbl')].map(e => e.textContent.trim()),
        defile: nav.scrollWidth > nav.clientWidth + 1,
        deborde: Math.max(0, de.scrollWidth - de.clientWidth),
        bas: Math.round(window.innerHeight - nav.getBoundingClientRect().bottom),
      };
    });
    const attendus = ['Bilan', 'Classement', 'Calendrier', 'Meneurs', 'Alignement'];
    const manquants = attendus.filter(n => !b.noms.includes(n));
    if (manquants.length) errors.push(`la barre du bas ne porte pas ${manquants.join(', ')} une fois la saison jouée : ${b.noms.join(' · ')}`);
    if (b.noms.includes('Vestiaire')) errors.push("la barre du bas parle encore du vestiaire une fois la saison jouée");
    // Et PAS « Séries » : aucune n'est jouée à ce point du parcours. Le volet
    // des séries porte d'avance son conteneur, donc son balisage n'est jamais
    // vide — c'est ce qu'il y a À LIRE qui décide qu'un onglet existe.
    if (b.noms.includes('Séries')) errors.push("la barre porte « Séries » avant qu'une série soit jouée");
    if (b.deborde) errors.push(`la barre du bas déborde la page de ${b.deborde} px : c'est LA BARRE qui défile, pas la page`);
    if (malPlacee(b.bas)) errors.push(`la barre du bas est à ${b.bas} px du bas (retrait voulu ${FLOTTE})`);
    console.log(`   la barre suit la phase : ${b.noms.join(' · ')} · ${b.defile ? 'elle défile' : 'elle tient'} · ${b.deborde} px de débordement`);
  }
  const hauteurs = {};
  for (const v of ['bilan', 'classement', 'calendrier', 'stats', 'alignement']) {
    const b = await page.$(`.navtab[data-page="${v}"]`);
    // Un onglet manquant ne se saute PAS : c'était un test qui passait
    // toujours. La saison est jouée, donc la barre porte ses sections.
    if (!b) { errors.push(`la barre du bas n'a pas d'onglet « ${v} » une fois la saison jouée`); continue; }
    await b.click();
    await page.waitForTimeout(220);
    const pose = await page.evaluate(() => document.body.dataset.page);
    if (pose !== v) errors.push(`l'onglet « ${v} » ne pose pas la page : body[data-page] vaut « ${pose} »`);
    hauteurs[v] = await pasUneLonguePage(`le bilan · ${v}`);
    await sansDebordement(`le bilan · ${v}`);
    await toutEstAtteignable(`le bilan · ${v}`);
  }
  console.log(`   jamais une longue page : ${Object.entries(hauteurs).map(([k, n]) => `${k} ${n}×`).join(' · ')}`);
  await page.click('.navtab[data-page="bilan"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'scripts/smoke-result.png', fullPage: false });
  /*
   * ON DOIT ATTEINDRE LES SÉRIES. `smoke.mjs` tire au hasard, et c'est un
   * choix assumé — mais une équipe moyenne rate les séries une fois sur deux,
   * et TOUT ce passage (le tableau, la reprise, la Coupe dans l'historique)
   * ne s'exécutait alors pas, sans qu'une ligne le dise. Une exécution a lu
   * 50-28-4 et joué les séries, la suivante 39-39-4 et ne les a pas jouées :
   * un test qui saute en silence est aussi faux qu'un sélecteur qui ne matche
   * rien.
   *
   * « Rejouer la saison » garde le même alignement et change les dés : on
   * rejoue jusqu'à se qualifier, au plus ESSAIS fois, et on ÉCHOUE si on n'y
   * arrive pas.
   *
   * DOUZE ESSAIS NE SUFFISAIENT PAS, et le calcul derrière était faux. Il
   * supposait « seize équipes sur trente-deux, donc une chance sur deux » —
   * mais les trente et un adversaires sont de VRAIS clubs historiques, en
   * moyenne meilleurs qu'un alignement bâti au premier joueur abordable :
   * une fiche de .500 ne se classe pas 16e, elle se classe autour du seuil.
   * Mesuré sur six exécutions : 23-52-7 (jamais qualifiée en 13 saisons,
   * l'Action a rougi), 40-37-5 (1 reprise), 39-41-2 (8), 38-43-1 (5),
   * 35-42-5 (2), 36-42-4 (2). La chance par reprise est donc plus proche
   * d'une sur trois que d'une sur deux, et douze échecs de suite tombent
   * une fois sur cent — assez pour rougir en Action sans qu'une ligne du
   * jeu ait bougé, et « un garde-fou qui crie pour du bruit se fait
   * désactiver ».
   *
   * Deux politiques de repêchage ont été essayées pour bâtir une équipe
   * plus forte, et TOUTES DEUX ÉCARTÉES par la mesure : le meilleur rapport
   * points par million achète des joueurs à 20 points pour 0,78 M$
   * (35-42-5, 36-42-4, 43-31-8), et le meilleur chiffre brut dépense le
   * plafond sur deux vedettes puis comble au plancher (40-37-5, 39-41-2,
   * 38-43-1). Un auto-draft à un joueur par tour donne une équipe de .500
   * quoi qu'on fasse : ce n'est pas la politique qu'il faut changer, c'est
   * le nombre d'essais. À trente, un échec tombe une fois sur dix mille.
   */
  const ESSAIS = 30;
  let po = await page.$('#playoffsBtn'), essais = 0;
  while (!po && essais < ESSAIS) {
    essais++;
    await page.click('#replayBtn');
    await finirVite();
    po = await page.$('#playoffsBtn');
  }
  if (!po) errors.push(`l'équipe n'a pas atteint les séries en ${ESSAIS + 1} saisons : le passage des séries n'a PAS été éprouvé`);
  if (essais) console.log(`   séries atteintes après ${essais} saison(s) rejouée(s)`);
  if (po) {
    await po.click();
    // L'écran des séries : un match de plus dans la ronde, le tableau, puis
    // le prochain match en direct, puis tout jusqu'à la Coupe.
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 20000 });
    await page.click('#hubModal .hub-jour');

    /*
     * LES SÉRIES SURVIVENT À UN RAFRAÎCHISSEMENT, comme la saison. Elles se
     * REJOUENT : la saison entière repart de sa graine, ce qui remet le
     * générateur là où `playSeries` l'avait pris, et la sauvegarde ne porte
     * que jusqu'où on les a REGARDÉES. Même épreuve que pour la saison — la
     * même en-tête des deux côtés d'un `reload`.
     */
    await page.waitForTimeout(200);
    const poAvant = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    const poSauve = await page.evaluate(() => {
      try {
        const d = JSON.parse(localStorage.getItem('cap82_save') || '{}');
        const v = d.partie?.series;
        return { vus: v ? v.revele.reduce((a, b) => a + b, 0) : -1, lbId: d.partie?.lbId || null };
      } catch { return { vus: -1, lbId: null }; }
    });
    const lbAvant = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]').length; } catch { return -1; } });
    await page.reload({ waitUntil: 'networkidle' });
    let poRepris = true;
    try { await page.waitForSelector('#hubModal .hub-head', { state: 'visible', timeout: 90000 }); }
    catch { poRepris = false; }
    if (!poRepris) {
      console.log('\n✗ les séries en cours ne survivent pas à un rafraîchissement : l\'écran des séries ne rouvre pas.');
      await browser.close();
      process.exit(1);
    }
    await page.waitForTimeout(900);
    const poApres = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    if (poAvant !== poApres) errors.push(`les séries ne reprennent pas au même endroit : « ${poAvant} » puis « ${poApres} »`);
    if (poSauve.vus < 1) errors.push('la sauvegarde ne porte pas les matchs de séries révélés');
    if (!poSauve.lbId) errors.push('la sauvegarde ne porte pas l\'entrée d\'historique de la saison');
    /*
     * UNE SAISON, UNE ENTRÉE. Le bilan se redessine à chaque reprise, et
     * `saveLeaderboard` empilait une entrée neuve à chaque appel : trois
     * allers-retours laissaient trois fois la même saison dans l'historique,
     * et la Coupe se cousait sur la dernière au lieu de celle qu'on joue.
     */
    const lbApres = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]').length; } catch { return -1; } });
    if (lbApres !== lbAvant) errors.push(`le rafraîchissement a ajouté une entrée d'historique : ${lbAvant} puis ${lbApres}`);
    else console.log(`   reprise des séries : ${poApres} — ${poSauve.vus} match(s) révélé(s), ${lbApres} entrée(s) d'historique`);

    await page.click('#hubModal .hub-onglets button[data-onglet="tableau"]');
    const noeuds = await page.$$eval('#hubModal .bk-serie', l => l.length);
    const regarder = await page.$('#hubModal .hub-regarder');
    let xe = 'pas de match à regarder';
    if (regarder) {
      await regarder.click();
      await page.waitForSelector('#liveModal .live-pause', { timeout: 20000 });
      await page.click('#liveModal .live-fin');
      await page.waitForSelector('#liveModal .live-suite', { timeout: 10000 });
      const fil = await page.$eval('#liveModal .live-feed', e => e.textContent);
      xe = (fil.match(/\(\d+(?:er|e) but\)/) || ['aucun but'])[0];
      await page.click('#liveModal .live-suite');
    }
    await page.click('#hubModal .hub-fin');
    await page.waitForSelector('#hubModal .hub-suite', { timeout: 10000 });
    await page.click('#hubModal .hub-suite');
    await page.waitForSelector('.navtab[data-page="series"]', { timeout: 10000 });
    const series = await page.$$eval('#playoffsSection .bk-serie', l => l.length);
    console.log(`   séries : ${noeuds} nœuds au tableau en cours, ${xe}, ${series} séries au tableau final`);
    if (!series) errors.push('séries : aucun tableau final');

    /*
     * LA COUPE ENTRE DANS L'HISTORIQUE. `saveLeaderboard` n'était appelé qu'au
     * bilan de la SAISON, donc avant la première série, et rien ne réécrivait
     * l'entrée : le seul but du jeu n'était enregistré nulle part. On lit
     * l'entrée du dessus, qui est celle qu'on vient de jouer.
     */
    const po2 = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]')[0] || null; }
      catch { return null; }
    });
    if (!po2 || !po2.series) errors.push('les séries ne sont pas enregistrées dans l\'historique');
    else if (!Number.isFinite(po2.series.V) || !po2.series.rondes) errors.push(`le verdict des séries est incomplet : ${JSON.stringify(po2.series)}`);
    else console.log(`   historique : ${po2.series.coupe ? '🏆 Coupe' : po2.series.ronde} · séries ${po2.series.V}-${po2.series.D} · format ${po2.mode}`);
    // Et l'écran de l'historique le montre, avec le compte des Coupes en tête.
    await page.click('.navtab[data-page="historique"]');
    await page.waitForSelector('#pageHistorique:not([hidden])', { timeout: 10000 });
    const tete = ((await page.textContent('#leaderboardBody .lb-tete')) || '').replace(/\s+/g, ' ').trim();
    if (!/Coupe/.test(tete)) errors.push(`l'historique ne dit pas les Coupes : « ${tete} »`);
    else console.log(`   l'historique en tête : ${tete}`);
    // On revient au jeu par l'onglet qui existe : la saison est jouée, donc
    // c'est « Bilan », pas « Vestiaire ». Un onglet de repêchage sans
    // repêchage n'aurait aucune raison d'être.
    if (await page.$('.navtab[data-page="repechage"]')) errors.push("la barre garde un onglet de repêchage une fois la saison jouée");
    await page.click('.navtab[data-page="bilan"]');
    await page.waitForTimeout(250);
  }

  // Rejouer la saison : même alignement, mêmes clubs, d'autres dés.
  await page.click('#replayBtn');
  await traverserSaison('rejouée');
  console.log(`   rejouée : fiche ${(await page.textContent('.result .score')).trim()}`);

  // L'historique garde l'alignement : « Rejouer » relit les 23 joueurs et
  // repart une saison.
  await page.click('.navtab[data-page="historique"]');
  await page.waitForSelector('#pageHistorique:not([hidden])', { timeout: 10000 });
  const entrees = await page.$$('.lb-replay');
  console.log(`   historique : ${entrees.length} alignements rejouables`);
  if (entrees.length) {
    await entrees[0].click();
    await traverserSaison('historique');
    console.log(`   reprise de l'historique : fiche ${(await page.textContent('.result .score')).trim()}`);
  }
}

/* Le tirage LOTO : trois clubs par case, des relances. Il vit maintenant dans
   l'écran « Nouvelle partie », et RIEN ne s'applique avant le clic sur le pied
   — c'est tout l'objet de l'écran, et c'est ce que ce passage vérifie. */
await page.click('#openPartieBtn');
await page.waitForSelector('#partieModal .seg[data-opt="tirage"]', { state: 'visible', timeout: 10000 });
await page.click('#partieModal .seg[data-opt="tirage"] button[data-val="LOTO"]');
const armeLoto = await page.$eval('#partieModal .seg[data-opt="tirage"] button[data-val="LOTO"]', b => b.classList.contains('on'));
if (!armeLoto) errors.push('le tirage « Loto » ne se marque pas dans l\'écran Nouvelle partie');
await page.click('#npGo');
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 30000 });
await page.waitForSelector('#rrL', { timeout: 30000 });

/*
 * LE ✕ N'EST PAS UNE RELANCE. Deux exploits d'une même formule, éprouvés ici
 * sur un alignement vide, avant que l'auto-draft le remplisse.
 *
 *   (1) Signer fait tourner la roulette ; retirer rendait la masse salariale
 *       en GARDANT le vestiaire neuf. « Signer le moins cher puis ✕ » était
 *       donc un « Passer » gratuit et illimité. La signature suivante repaie
 *       maintenant le tour au lieu de faire tourner la roulette.
 *   (2) Le rang de la main comptait les joueurs SIGNÉS : vider une case le
 *       faisait remonter, et le club retendait le joueur qu'on venait de
 *       retirer — le même exploit que le déplacement de trio, rouvert par le
 *       ✕. C'est ce que teste le retour du nom : il ne doit PAS revenir.
 *
 * Le premier jet de ce garde-fou comparait la main avant et après sans viser
 * la même case, et passait donc exploit ouvert ou non : signer déplace la
 * main à la case suivante, et la roulette avait tourné entre les deux.
 */
{
  // LES NOMS SEULS. Le texte entier d'une carte porte aussi sa case de
  // destination (« 1er trio · AG » contre « 2e trio · AG ») : deux mains
  // identiques s'y liraient toujours différentes.
  const mainNoms = async () => (await page.$$eval('.pcard .pcard-name', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | ');
  // `.pb-team` — le premier jet lisait `.pcard-team`, qui n'existe pas : les
  // deux lectures valaient la chaîne vide, donc « la roulette n'a pas tourné »
  // était vrai par construction. Un sélecteur qui ne matche rien est un test
  // qui passe toujours.
  const clubs = () => page.$$eval('.pcard .pb-team', els => els.map(e => e.textContent.trim()).join('~'));
  const carte = await page.$('.pcard:has(.btn-sign:not([disabled]))');
  if (!carte) { errors.push('aucun joueur signable pour éprouver le ✕'); }
  else {
    const nom = (await carte.$eval('.pcard-name', e => e.textContent.replace(/\s+/g, ' ').trim())).toUpperCase();
    await carte.$eval('.btn-sign', b => b.click());
    await page.waitForTimeout(400);
    const clubsApresSignature = await clubs();

    await page.click('.navtab[data-page="alignement"]');
    await page.waitForTimeout(220);
    const retirer = await page.$('.slot .slot-remove');
    if (!retirer) errors.push('aucune case remplie à retirer pour éprouver le ✕');
    else {
      await retirer.evaluate(el => el.click());
      await page.waitForTimeout(350);
      if (await lireSignes() !== 0) errors.push('le ✕ n\'a pas vidé la case');

      // On revise la MÊME case : signer avait déplacé la main à la suivante.
      const vide = await page.$('.slot');
      if (vide) { await vide.evaluate(el => el.click()); await page.waitForTimeout(350); }
      await page.click('.navtab[data-page="repechage"]');
      await page.waitForTimeout(250);

      /*
       * COMMENT ON LIT L'ÉCHELLE SANS POUVOIR LA LIRE. Le rang n'est nulle
       * part dans le DOM, et regarder si le joueur retiré revient ne dit rien :
       * la roulette avait tourné à la signature, donc son club n'est plus là.
       * Mais deux cases de MÊME poste et de rang différent, elles, se
       * comparent — la case du 1er trio a vu son échelle descendre d'un cran,
       * donc elle doit maintenant offrir EXACTEMENT ce qu'offre la case du 2e
       * trio. Sans le plancher, la première retend des numéros un pendant que
       * la seconde tend des numéros deux.
       */
      const cases = await page.$$('.slot');
      const mainDe = async (n) => {
        await page.click('.navtab[data-page="alignement"]');
        await page.waitForTimeout(200);
        await (await page.$$('.slot'))[n].evaluate(el => el.click());
        await page.waitForTimeout(320);
        await page.click('.navtab[data-page="repechage"]');
        await page.waitForTimeout(220);
        return mainNoms();
      };
      if (cases.length > 3) {
        const premier = await mainDe(0);   // AG du 1er trio, échelle descendue à 1
        const second = await mainDe(3);    // AG du 2e trio, rang 1 par nature
        if (premier !== second) errors.push(`le ✕ fait remonter l'échelle : la case du 1er trio offre « ${premier.slice(0, 60)} » quand celle du 2e offre « ${second.slice(0, 60)} »`);
        else console.log(`   le ✕ éprouvé : après avoir signé puis retiré un ${nom.split(' ')[0] ? 'ailier' : 'joueur'}, la case du 1er trio offre la même main que celle du 2e — l'échelle ne remonte pas`);
      }

      // Et la signature qui repaie la dette ne fait pas tourner la roulette.
      const b2 = await page.$('.pcard .btn-sign:not([disabled])');
      if (b2) {
        await b2.click();
        await page.waitForTimeout(400);
        if ((await clubs()) !== clubsApresSignature) errors.push('la signature qui repaie la dette a fait tourner la roulette');
        else console.log('   la signature suivante repaie le tour : la roulette ne tourne pas');
        await page.click('.navtab[data-page="alignement"]');
        await page.waitForTimeout(220);
        const r = await page.$('.slot .slot-remove');
        if (r) { await r.evaluate(el => el.click()); await page.waitForTimeout(320); }
        await page.click('.navtab[data-page="repechage"]');
        await page.waitForTimeout(220);
      }
    }
  }
}

const { signed: lotoSigned } = await drafter('loto');
console.log(`5. loto : ${lotoSigned}/23 signés, relances restantes : ${(await page.textContent('#rrL .rr-count')).trim()}`);
await page.screenshot({ path: 'scripts/smoke-loto.png', fullPage: false });

/*
 * LE FORMAT EXPRESS, que rien ne couvrait. Six cases — un trio, une paire, un
 * partant — sous 34 M$, et le reste de l'alignement fourni par une vraie
 * équipe tirée au hasard, hors plafond et non modifiable. C'est un chemin de
 * code entier (`casesDuMode`, `G.renfort`, le plafond qui change) qui n'avait
 * aucun test : le compteur, la roulette, le renfort et la simulation.
 */
await page.click('#openPartieBtn');
await page.waitForSelector('#partieModal .seg[data-opt="format"]', { state: 'visible', timeout: 10000 });
await page.click('#partieModal .seg[data-opt="format"] button[data-val="EXPRESS"]');
await page.click('#partieModal .seg[data-opt="tirage"] button[data-val="VESTIAIRE"]');
await page.click('#npGo');
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 30000 });
await page.waitForTimeout(400);
const expTotal = await lireTotal();
if (expTotal !== 6) errors.push(`l'Express devrait offrir six cases, le compteur en annonce ${expTotal}`);
const expCap = parseM(await page.textContent('#capAmt'));
if (expCap > 40) errors.push(`le plafond de l'Express devrait être sous 34 M$, la jauge annonce ${expCap}`);
const { signed: expSigned } = await drafter('express');
// Les dix-sept autres cases viennent du renfort : l'alignement doit être
// COMPLET même si le joueur n'en a comblé que six.
const expRemplies = await page.$$eval('.slot', els => els.filter(e => !e.classList.contains('empty')).length);
const expPret = await page.$eval('#mainBtn', b => !b.disabled);
console.log(`6. express : ${expSigned}/${expTotal} signés sous ${expCap.toFixed(1)} M$, `
  + `${expRemplies} cases remplies avec le renfort, bouton prêt : ${expPret}`);
if (expSigned < 6) errors.push(`l'Express n'a comblé que ${expSigned} cases sur six`);
if (expRemplies < 23) errors.push(`le renfort de l'Express ne remplit que ${expRemplies} cases sur 23`);
if (!expPret) errors.push('l\'Express ne débloque pas le bouton de simulation');
await sansDebordement('express');
await sansCote('express');

console.log(`7. erreurs console : ${errors.length} (ressources externes non chargées : ${netErrors})`);
for (const e of errors) console.log('   ', e);
await browser.close();
process.exit((errors.length || signed < 23 || lotoSigned < 23 || expSigned < 6) ? 1 : 0);
