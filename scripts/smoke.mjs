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
const browser = await chromium.launch();
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
console.log(`   à 390 px, alignement complet : ${await sansDebordement('vestiaire plein')} px de débordement, ${await sansCote('vestiaire plein')} cote(s) dans le DOM`);
await page.screenshot({ path: 'scripts/smoke-roster.png', fullPage: false });

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
  }
  await page.click('#hubModal .hub-onglets button[data-onglet="meneurs"]');
  const tableaux = await page.$$eval('#hubModal .hub-volet .live-tableau', l => l.length);
  const meneurs = await page.$$eval('#hubModal .hub-volet tbody tr', l => l.length);
  console.log(`   ${etiquette} : ${jour} · meneurs : ${tableaux} tableaux, ${meneurs} rangées`);
  if (!meneurs) errors.push(`${etiquette} : aucun meneur dans l'onglet des meneurs`);
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

if (enabled) {
  await page.click('#mainBtn');
  await traverserSaison('saison', true);
  const score = await page.textContent('.result .score');
  const rows = await page.$$eval('.rrow', r => r.length);
  console.log(`4. fiche ${score.trim()}, ${rows} rangées`);
  // Le bilan porte les tableaux les plus larges du jeu (onze colonnes) : s'il
  // y a un débordement quelque part, il est ici.
  await sansDebordement('bilan de saison');
  await page.screenshot({ path: 'scripts/smoke-result.png', fullPage: false });
  const po = await page.$('#playoffsBtn');
  if (po) {
    await po.click();
    // L'écran des séries : un match de plus dans la ronde, le tableau, puis
    // le prochain match en direct, puis tout jusqu'à la Coupe.
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 20000 });
    await page.click('#hubModal .hub-jour');
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
    await page.waitForSelector('#resultTabs .result-tab[data-volet="series"]:not([hidden])', { timeout: 10000 });
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
    await page.click('#openLeaderboardBtn');
    await page.waitForSelector('#leaderboardModal', { state: 'visible', timeout: 10000 });
    const tete = ((await page.textContent('#leaderboardBody .lb-tete')) || '').replace(/\s+/g, ' ').trim();
    if (!/Coupe/.test(tete)) errors.push(`l'historique ne dit pas les Coupes : « ${tete} »`);
    else console.log(`   l'historique en tête : ${tete}`);
    await page.click('#closeLeaderboardBtn');
    await page.waitForTimeout(250);
  }

  // Rejouer la saison : même alignement, mêmes clubs, d'autres dés.
  await page.click('#replayBtn');
  await traverserSaison('rejouée');
  console.log(`   rejouée : fiche ${(await page.textContent('.result .score')).trim()}`);

  // L'historique garde l'alignement : « Rejouer » relit les 23 joueurs et
  // repart une saison.
  await page.click('#openLeaderboardBtn');
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

    await page.click('#tabRoster');
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
      await page.click('#tabPool');
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
        await page.click('#tabRoster');
        await page.waitForTimeout(200);
        await (await page.$$('.slot'))[n].evaluate(el => el.click());
        await page.waitForTimeout(320);
        await page.click('#tabPool');
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
        await page.click('#tabRoster');
        await page.waitForTimeout(220);
        const r = await page.$('.slot .slot-remove');
        if (r) { await r.evaluate(el => el.click()); await page.waitForTimeout(320); }
        await page.click('#tabPool');
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
