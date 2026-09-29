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
let barreAuRepechage = null;   // la barre au repêchage, pour la comparer au bilan (S67)
let toastVu = false;           // le premier toast d'une signature, mesuré une fois (1.0, J2-17)

/*
 * LES CHOIX FORCÉS (S66). Le proprio, les dilemmes et les séquences CACHENT
 * « Journée suivante » tant qu'on n'a pas choisi — c'est la mécanique. Le
 * parcours répond donc à chacun dès qu'il se présente (la première option),
 * et il note lesquels il a croisés : un choix forcé que le test ne verrait
 * jamais serait un choix qui ne s'affiche jamais.
 */
const choixVus = new Map();
const _click = page.click.bind(page);
const _wait = page.waitForSelector.bind(page);
/*
 * L'IDENTITÉ DE DÉPART (S73) : « Commencer » ouvre trois cartes en plein
 * écran avant la première roulette. Le parcours prend la première et exige
 * qu'il y en ait trois ; ce qu'il a vu se dit à la fin.
 */
const identitesVues = [];
const mainsVues = [];   // les cartes jouées aux gros matchs et en séries (S74)
let prepsVues = 0;      // les préparations choisies au dépistage (S76)
async function passerIdentite() {
  const carte = await _wait('#choixModal:not([hidden]) .choix-sheet[data-genre="identite"] .tc', { timeout: 10000 }).catch(() => null);
  if (!carte) { errors.push('« Commencer » n\'offre pas l\'identité de départ'); return; }
  const offre = await page.$$eval('#choixModal .tc', e => e.map(x => x.dataset.choix));
  if (offre.length !== 3 || new Set(offre).size !== 3) errors.push(`l'identité de départ offre ${offre.join(' · ')} au lieu de trois cartes différentes`);
  // TROIS CARTES, ON LES VOIT TOUTES (1.0, J2-3) : sur téléphone, les trois tiennent dans l'écran, sans balayer.
  const horsEcran = await page.$$eval('#choixModal .tc', e => e.filter(t => { const r = t.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).length);
  if (horsEcran) errors.push(`l'identité de départ laisse ${horsEcran} carte(s) hors de l'écran : il faut balayer pour les voir`);
  identitesVues.push(offre[0]);
  await _click('#choixModal .tc');
}
/*
 * LE BALLOTTAGE (S66) n'est pas forcé : on y répond la première fois qu'une
 * offre se présente, et on vérifie que la réclamation entre dans la
 * sauvegarde sans rembobiner la saison. Il dépend d'une blessure longue, donc
 * on DIT si on l'a vu plutôt que de l'exiger (le rejeu est exigé dans
 * check_ballottage.mjs).
 */
/*
 * UN JOUEUR OFFERT SE SIGNE, PUIS ON CHOISIT QUI SORT (S78). Toucher sa carte
 * ouvre sa fiche (un aperçu) : c'est « Signer » qui le prend, puis « qui sort ? »
 * — le parcours prend le premier proposé (un réserviste de sa position).
 */
async function signerPuisSortir(portee = '#choixModal:not([hidden])') {
  await _click(`${portee} .tcj-signer`);
  await sortirDansAlignement();
}
/*
 * QUI SORT, DANS L'ALIGNEMENT (S80). JP : *le screen de choix pour les
 * upgrades et les remplacements sont à chier* ; *dire que x est sur la
 * xième ligne*. « Qui sort ? » est l'alignement lui-même : on exige ses neuf
 * rangées titrées par ce qu'elles sont (quatre trios, trois paires, les
 * gardiens, la réserve), une case par joueur avec son visage, son nom et ses
 * positions, rien qui déborde à 390 px ; toucher une case ne décide rien — la
 * barre dit ce qui va se passer, avec la LIGNE de celui qui sort — et c'est
 * « Confirmer » qui décide. Le parcours prend la première case permise.
 */
const alignementsVus = [];
async function sortirDansAlignement() {
  await _wait('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"] .aln-case', { timeout: 5000 });
  await page.waitForTimeout(150);
  const lu = await page.evaluate(() => {
    const m = document.querySelector('#choixModal');
    const titres = [...m.querySelectorAll('.aln-titre')].map(t => (t.firstChild ? t.firstChild.textContent : t.textContent).trim());
    const cases = [...m.querySelectorAll('.aln-case[data-aln]')];
    const incompletes = cases.filter(c => !c.querySelector('.aln-visage') || !(c.querySelector('.aln-nom') || {}).textContent || !((c.querySelector('.aln-pos') || {}).textContent || '').trim()).length;
    const corps = m.querySelector('.choix-corps');
    return { titres, n: cases.length, permises: cases.filter(c => !c.disabled).length, incompletes, confirmer: !!m.querySelector('.aln-confirmer'), sw: corps.scrollWidth, cw: corps.clientWidth };
  });
  const attendus = ['1er trio', '2e trio', '3e trio', '4e trio', '1re paire', '2e paire', '3e paire', 'Gardiens', 'Réserve'];
  if (JSON.stringify(lu.titres) !== JSON.stringify(attendus)) errors.push(`« qui sort ? » ne titre pas ses rangées par ce qu'elles sont : ${lu.titres.join(' · ')}`);
  if (lu.n < 20) errors.push(`« qui sort ? » ne montre que ${lu.n} joueurs de l'alignement`);
  if (lu.incompletes) errors.push(`« qui sort ? » : ${lu.incompletes} case(s) sans visage, nom ou positions`);
  if (lu.sw > lu.cw + 1) errors.push(`« qui sort ? » déborde à 390 px (${lu.sw} px pour ${lu.cw})`);
  if (!lu.confirmer || !lu.permises) { errors.push(`« qui sort ? » : ${lu.permises} case permise, ${lu.confirmer ? 'un' : 'aucun'} bouton Confirmer`); await _click('#choixModal .aln-retour'); return false; }
  await _click('#choixModal .aln-case[data-aln]:not([disabled])');
  await page.waitForTimeout(120);
  const pret = await page.$eval('#choixModal .aln-confirmer', b => !b.disabled);
  const barre = ((await page.textContent('#choixModal .aln-barre-mot')) || '').replace(/\s+/g, ' ').trim();
  // « Hal Gill (3e paire) sort, Kevin Hatcher prend sa place. » — et toucher n'a rien décidé : la feuille est encore là.
  const encore = !!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"]'));
  if (!pret || !encore || !/\((\d+(er|re|e) (trio|paire)|partant|auxiliaire|réserve)\) sort, .+ prend sa place/.test(barre)) errors.push(`toucher une case de « qui sort ? » ne prépare pas la confirmation : « ${barre} »`);
  alignementsVus.push(barre);
  await _click('#choixModal .aln-confirmer');
  return true;
}
/*
 * « NOUVELLE » RAMÈNE AU CHOIX DU MODE (S79). Le bouton de la barre ouvre les
 * cartons des modes ; « Commencer » sur la saison bâtit une partie neuve et
 * ouvre l'écran « Nouvelle partie », réglé sur la saison.
 */
async function nouvelleSaison() {
  await _click('#openPartieBtn');
  await _wait('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]', { timeout: 10000 });
  const reprise = await page.$$('#menuDepart [data-menu="reprendre"], #menuDepart .menu-parties');
  if (reprise.length) errors.push('le choix du mode montre des reprises ou « Mes parties » : c\'est le rôle du bouton Menu');
  await _click('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
  await _wait('#partieModal', { state: 'visible', timeout: 30000 });
}
const ballottage = { fait: false, mot: null };
/*
 * LA BOÎTE DE RÉCEPTION (S78). JP : *faire une boîte de réception et forcer
 * que le joueur agisse avant de continuer*. Tant qu'un message bloque (une
 * blessure, une case vide, un palier, un choix forcé), « Journée suivante »
 * devient « ⏳ À régler avant le match… » et « +10 » disparaît. Le parcours règle ces
 * messages comme un joueur : la réponse par défaut du message ouvert
 * (`[data-defaut]` : garder l'alignement, compris, ouvrir le choix). La case
 * vide s'éprouve d'abord (`guetterTrouHook`, posé par la saison) ; le palier
 * reste ouvert tant que son bloc ne l'a pas éprouvé (`palierAuto`), puis se
 * joue tout seul : la carte d'effet, ou la première, et son deuxième choix.
 */
let guetterTrouHook = null;
let palierAuto = false;
const paliersJoues = [];
let sommairesVus = 0;
async function prendrePalier() {
  if (!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"]'))) await _click('#hubModal .hub-main-ouvrir');
  await _wait('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc', { timeout: 5000 });
  const eff = await page.$('#choixModal .tc[data-choix^="effet:"]:not([disabled])');
  const nom = eff ? await eff.getAttribute('data-choix') : await page.$eval('#choixModal .tc:not([disabled])', e => e.dataset.choix);
  await _click(`#choixModal .tc[data-choix="${nom}"]`);
  // Le deuxième choix d'une carte du deck (le joueur, le rôle, l'édition… et qui sort, dans l'alignement, S80).
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(350);
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"]')) { await sortirDansAlignement(); continue; }
    if (!(await toucher('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] :is(.tcj-signer, button.choix-option:not([disabled]))'))) break;
  }
  // Après la carte : le hub, ou un autre plein écran (un sommaire, un choix, la main suivante).
  await _wait('#hubModal .hub-jour, #hubModal .hub-traiter, #hubModal .hub-suite, #choixModal:not([hidden]) .choix-sheet, .result .score', { timeout: 120000 });
  paliersJoues.push(nom);
}
/*
 * Un clic PAR SÉLECTEUR, qui tolère le redessin : le hub se redessine après
 * chaque geste (une réclamation, une décision), et une poignée d'élément prise
 * avant ne tient plus (« not attached to the DOM »).
 */
async function toucher(sel) {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await _click(sel, { timeout: 5000 }); } catch { return false; }
  await page.waitForTimeout(350);
  return true;
}
async function debloquer() {
  for (let i = 0; i < 12; i++) {
    if (await page.$('#choixModal:not([hidden]) .choix-sheet')) return;
    if (!(await page.$('#hubModal .hub-traiter'))) return;
    if (await page.$('#hubModal .hub-msg.bloque .hub-trou-prendre')) {
      if (guetterTrouHook) await guetterTrouHook();
      await toucher('#hubModal .hub-msg.bloque .hub-trou-prendre');
      continue;
    }
    if (await page.$('#hubModal .hub-msg.bloque .hub-main-ouvrir')) {
      if (!palierAuto) return;
      await prendrePalier();
      continue;
    }
    // Le ballottage se guette une fois : s'il a joué, le hub s'est redessiné, on repasse.
    const avantBal = ballottage.fait;
    await guetterBallottage();
    if (ballottage.fait !== avantBal) continue;
    if (await toucher('#hubModal .hub-msg.bloque.ouvert [data-defaut]')) continue;
    // Le message à traiter est plié : « À régler avant le match » l'ouvre.
    await toucher('#hubModal .hub-traiter');
  }
}
async function guetterBallottage() {
  if (ballottage.fait) return;
  const ouvrir = await page.$('#hubModal .hub-ballottage-ouvrir');
  if (!ouvrir || !(await ouvrir.isVisible())) return;
  // Un choix forcé — ou n'importe quel plein écran, le sommaire de la journée compris (S78) — passe devant.
  const force = await page.$('#choixModal:not([hidden]) .choix-sheet');
  if (force && (await force.isVisible())) return;
  ballottage.fait = true;
  const tete = ((await page.textContent('#hubModal .hub-head')) || '').match(/Journée\s+(\d+)/);
  await ouvrir.click();
  await _wait('#choixModal:not([hidden]) .choix-option', { timeout: 5000 });
  const qui = ((await page.textContent('#choixModal .choix-option')) || '').replace(/\s+/g, ' ').trim();
  await signerPuisSortir();
  await _wait('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
  await page.waitForTimeout(350);
  const apres = ((await page.textContent('#hubModal .hub-head')) || '').match(/Journée\s+(\d+)/);
  const d = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisions || []; } catch { return []; } })).filter(x => x.ballottage);
  if (!d.length) errors.push('la réclamation au ballottage n\'entre pas dans la sauvegarde');
  if (tete && apres && tete[1] !== apres[1]) errors.push(`réclamer au ballottage rembobine la saison : journée ${tete[1]} puis ${apres[1]}`);
  ballottage.mot = `${qui.slice(0, 70)} réclamé à la journée ${tete ? tete[1] : '?'}`;
}
/*
 * LE PAQUET (S77) : une récompense arrive scellée, par-dessus ses cartes
 * encore invisibles — les toucher, c'est toucher le paquet. On l'ouvre (un
 * toucher), on montre tout (un deuxième), et on exige ce que l'écran
 * promet : autant de cartes face visible qu'il en annonçait, prêtes à
 * choisir. Le paquet FLOTTE (une animation continue) : Playwright attendrait
 * sans fin qu'il soit immobile, d'où `force` ; le deuxième toucher va à la
 * tête de la feuille, qui ne bouge pas.
 */
const paquetsVus = [];
async function ouvrirPaquet() {
  const p = await page.$('#choixModal:not([hidden]) .paquet');
  if (!p || !(await p.isVisible())) return false;
  const annonce = Number(((await page.textContent('#choixModal .paquet-n')) || '').replace(/\D/g, '')) || 0;
  await _click('#choixModal .paquet', { force: true });
  await page.waitForTimeout(120);
  await _click('#choixModal .choix-tete');
  const pret = await _wait('#choixModal .choix-sheet.paquet-fini', { timeout: 5000 }).catch(() => null);
  const lu = await page.evaluate(() => ({
    cartes: document.querySelectorAll('#choixModal .choix-main > .choix-option.tc').length,
    dos: [...document.querySelectorAll('#choixModal .tc-dos')].filter(d => +getComputedStyle(d).opacity > 0.05).length,
  }));
  if (!pret || lu.cartes !== annonce || lu.dos) errors.push(`le paquet annonce ${annonce} cartes et en montre ${lu.cartes} (${lu.dos} encore face cachée${pret ? '' : ', jamais fini'})`);
  paquetsVus.push(`${lu.cartes} cartes`);
  return true;
}
/*
 * LES CHOIX FORCÉS S'OUVRENT EN PLEIN ÉCRAN depuis S68 (`#choixModal`). On
 * range ce qu'on a croisé par son titre, et on exige que chaque option dise
 * son effet en puces — c'est ce que JP a demandé : *tout devrait être clair*.
 */
async function repondreAuxChoix() {
  await ouvrirPaquet();
  await guetterBallottage();
  let rouvert = false;
  for (let i = 0; i < 12; i++) {
    if (await ouvrirPaquet()) continue;
    // LE SOMMAIRE DE LA JOURNÉE (S78) : il se lit, puis « Retour au bureau ».
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"]')) {
      sommairesVus++;
      await _click('#choixModal:not([hidden]) .choix-plus-tard, #choixModal:not([hidden]) .choix-fermer');
      await page.waitForTimeout(250);
      continue;
    }
    // QUI SORT, DANS L'ALIGNEMENT (S80) : ses cases ne sont pas des `.choix-option`.
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"]')) { await sortirDansAlignement(); await page.waitForTimeout(350); continue; }
    const opt = await page.$('#choixModal:not([hidden]) .choix-option:not([disabled])');
    if (!opt || !(await opt.isVisible())) {
      /*
       * UN CHOIX EN ATTENTE SE ROUVRE COMME UN JOUEUR LE ROUVRE (S77). Une
       * récompense peut rester en attente derrière un autre plein écran (le
       * palier refermé « Plus tard », un entracte) : l'écran le dit par
       * « ⏳ Un choix t'attend » et cache « +10 jours » tant qu'on n'a pas
       * choisi — c'est la règle. Le parcours attendait trente secondes un
       * « +10 jours » qui ne pouvait pas venir (vu une fois en trois
       * parcours pendant S77 — le smoke tire au hasard, la graine change) ;
       * il touche le bouton, une fois, comme le ferait un kid.
       */
      const attente = !rouvert && await page.$('#hubModal .hub-choix-rouvrir');
      if (attente && await attente.isVisible()) {
        rouvert = true;
        await attente.click();
        await page.waitForTimeout(300);
        continue;
      }
      // Un message qui bloque la journée (S78) : on le règle, puis on repasse.
      if (await page.$('#hubModal .hub-traiter')) {
        await debloquer();
        if (await page.$('#choixModal:not([hidden]) .choix-option:not([disabled]), #choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"]')) continue;
      }
      return;
    }
    /*
     * LA MAIN D'UN GROS MATCH (S74) : cinq cartes, trois d'énergie. Le
     * parcours joue la première carte jouable (elle doit passer dans « ce
     * soir, sur la glace ») et confirme ; la décision doit porter la carte.
     */
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="main"]')) {
      const n = await page.$$eval('#choixModal .main-carte', e => e.length);
      const orbes = await page.$$eval('#choixModal .main-orbe.plein', e => e.length);
      if (n < 5 || orbes !== 3) errors.push(`la main du match offre ${n} cartes et ${orbes} d'énergie au lieu de cinq et trois`);
      // ENTRE DEUX MATCHS (S74b) : l'ajustement est une rangée de la main — on prend le premier.
      const titreMain = ((await page.textContent('#choixModal .choix-titre')) || '').trim();
      if (await page.$('#choixModal .main-aj')) {
        choixVus.set('hub-dilemme', [...(choixVus.get('hub-dilemme') || []), titreMain]);
        await _click('#choixModal .main-aj');
      }
      /*
       * LE DÉPISTAGE (S76) : trois pistes et leurs chances, et on se prépare
       * pour la première — elle doit s'allumer et partir avec la décision.
       */
      const pistes = await page.$$eval('#choixModal .dep-piste[data-plan]', e => e.length);
      if (!pistes) errors.push('la main d\'un match n\'offre pas le dépistage (aucune piste à préparer)');
      else {
        await _click('#choixModal .dep-piste[data-plan]:not([disabled])');
        if (!(await page.$('#choixModal .dep-piste.on'))) errors.push('toucher une piste du dépistage ne la prépare pas');
        const somme = await page.$$eval('#choixModal .dep-piste .dep-p b', e => e.map(x => parseInt(x.textContent, 10) || 0).reduce((a, b) => a + b, 0));
        if (Math.abs(somme - 100) > 2) errors.push(`les chances du dépistage ne font pas 100 % (${somme} %)`);
        prepsVues++;
        // La première : une capture, pour que JP voie le dépistage tel qu'un kid le voit.
        if (prepsVues === 1) await page.screenshot({ path: 'scripts/smoke-main.png' });
        /*
         * L'EFFET AVANT L'AMBIANCE (1.0, J2-12) : à 1440 × 900, la puce chiffrée
         * de chaque carte est au-dessus des boutons collés en bas, sans défiler.
         */
        if (prepsVues === 1) {
          const vp = page.viewportSize();
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.waitForTimeout(250);
          const sous = await page.evaluate(() => {
            const b = document.querySelector('#choixModal .main-boutons');
            if (!b) return null;
            const haut = b.getBoundingClientRect().top;
            return [...document.querySelectorAll('#choixModal .main-carte .tc-puces')].filter(p => p.getBoundingClientRect().bottom > haut + 1).length;
          });
          await page.setViewportSize(vp);
          await page.waitForTimeout(250);
          if (sous) errors.push(`à 1440 × 900, ${sous} carte(s) de la main ont leur effet sous les boutons`);
        }
      }
      const jouable = await page.$('#choixModal .main-carte:not(.trop-cher):not(.injouable):not(.jouee)');
      let nom = null;
      if (jouable) {
        nom = ((await jouable.$eval('.tc-nom', e => e.textContent)) || '').trim();
        await jouable.click();
        const jouees = await page.$$eval('#choixModal .main-jouee', e => e.length);
        if (jouees !== 1) errors.push(`toucher « ${nom} » ne la joue pas (${jouees} carte(s) sur la glace)`);
        // Une carte de dépistage peut ÉCARTER la piste préparée (c'est son effet) : la préparation
        // tombe alors, comme dans le jeu. On se prépare pour une piste qui reste (S79 : le test mentait).
        if (pistes && !(await page.$('#choixModal .dep-piste.on')) && await page.$('#choixModal .dep-piste[data-plan]:not([disabled])')) {
          await _click('#choixModal .dep-piste[data-plan]:not([disabled])');
        }
      }
      await _click('#choixModal .main-jouer');
      await _wait('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option, #choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"], #hubModal .hub-suite, #hubModal .hub-prochaine', { timeout: 120000 });
      await page.waitForTimeout(350);
      const d = (await page.evaluate(() => { try { const p = JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie; return [...(p.decisions || []), ...(p.decisionsSeries || [])]; } catch { return []; } })).filter(x => x.main);
      if (!d.length) errors.push('la main jouée n\'entre pas dans la sauvegarde');
      if (pistes && !d.some(x => Array.isArray(x.prep) && x.prep.length)) errors.push('la préparation choisie n\'entre pas dans la décision de la main');
      mainsVues.push(nom || 'rien');
      continue;
    }
    // LA MAIN DU PALIER (S73) s'ouvre d'elle-même. Tant que son bloc (plus bas)
    // ne l'a pas éprouvée, on la referme « Plus tard » — elle bloque alors la
    // journée (S78) ; ensuite, elle se joue.
    if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"]')) {
      if (palierAuto) { await prendrePalier(); continue; }
      await _click('#choixModal .choix-fermer');
      await page.waitForTimeout(200);
      return;
    }
    if (await page.$('#choixModal:not([hidden]) .tcj-signer')) { await signerPuisSortir(); await page.waitForTimeout(350); continue; }
    const titre = ((await page.textContent('#choixModal .choix-titre')) || '').trim();
    const genre = /proprio|objectif/i.test(titre) ? 'hub-proprio' : /de suite/i.test(titre) ? 'hub-sequence' : 'hub-dilemme';
    const sansPuce = await page.$$eval('#choixModal .choix-option', els => els.filter(e => !e.querySelector('.puce')).length);
    if (sansPuce && genre !== 'hub-proprio') errors.push(`le choix « ${titre} » a ${sansPuce} option(s) sans effet chiffré`);
    choixVus.set(genre, [...(choixVus.get(genre) || []), titre]);
    await opt.click();
    await _wait('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option, #choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"], #hubModal .hub-suite', { timeout: 120000 });
    await page.waitForTimeout(350);
  }
}
/*
 * FINIR UN DIRECT (S70). Un gros match — et chaque match de ta série —
 * s'arrête au deuxième entracte : on choisit, la saison se rejoue, et le
 * direct reprend à 40:00. On exige qu'il reprenne à la troisième période et
 * que les deux premières, déjà vues, n'aient pas bougé d'une ligne.
 */
const entractesVus = [];
/*
 * LE DIRECT ET LE SOMMAIRE DISENT LES MÊMES BUTS (S79). JP : *le sommaire
 * post match et ce que je voyais dans le match, les buts sont pas au même
 * moment* — le sommaire donnait le temps écoulé, le direct le temps qu'il
 * reste. `finirDirect` lit les buts du fil (période, heure, marqueur) ;
 * `memesButs` les compare, au caractère près, au tableau de la journée et au
 * « Sommaire du match ». Un entracte au milieu n'y change rien : c'est le
 * même match, continué.
 */
const PERIODES = ['1re période', '2e période', '3e période', 'Prolongation'];
let butsVusEnDirect = null;
const propre = t => (t || '').replace(/\s+/g, ' ').trim();
const butsDuDirect = () => page.$$eval('#liveModal .live-feed .live-ligne', els => {
  let per = 1; const out = [];
  // Le fil s'écrit du plus récent au plus ancien ; une fin de période est une ligne sans heure.
  for (const e of els.slice().reverse()) {
    if (e.classList.contains('periode') && !e.classList.contains('ent2-marque') && !e.querySelector('.live-tps')) { per++; continue; }
    if (e.classList.contains('but')) out.push(`${per} ${e.querySelector('.live-tps').textContent.trim()} ${e.querySelector('b:not(.live-but-mot)').textContent.replace(/\s+/g, ' ').trim()}`);
  }
  return out;
});
async function lireLeDirect(entracte) {
  butsVusEnDirect = { buts: await butsDuDirect(), entracte };
}
/* Le « Sommaire du match » d'une clé `saison|j|k` ou `series|i|k` : ses buts, période, heure et marqueur. */
async function butsDuSommaire(cle) {
  await page.evaluate(c => {
    const el = document.createElement('div');
    el.dataset.sommaire = c;
    document.body.appendChild(el);
    el.click();
    el.remove();
  }, cle);
  await page.waitForFunction(() => document.getElementById('gameModal').style.display !== 'none', null, { timeout: 5000 }).catch(() => {});
  const buts = await page.$$eval('#gameModalBody .som-per', (pers, P) => pers.flatMap(x => {
    const per = P.indexOf(x.querySelector('.som-per-head span').textContent.trim()) + 1;
    return [...x.querySelectorAll('.som-but:not(.som-pun)')].map(b => `${per} ${b.querySelector('.som-tps').textContent.trim()} ${b.querySelector('.som-qui strong').textContent.replace(/\s+/g, ' ').trim()}`);
  }), PERIODES);
  await page.evaluate(() => document.getElementById('closeGameBtn').click());
  await page.waitForTimeout(150);
  return buts;
}
/*
 * ET ÇA RESTE VRAI APRÈS (S79). JP : *surtout, la simulation doit pas se faire
 * d'avance, pis rester ok après*. Le match vu en direct se relit au bilan,
 * après toutes les décisions du reste de la saison (et les entractes qui
 * rebâtissent la ligue jusqu'à leur soir) : les mêmes buts, au caractère près.
 */
const aRelire = [];
async function toujoursLesMemes() {
  for (const r of aRelire.splice(0)) {
    const buts = await butsDuSommaire(r.cle);
    if (JSON.stringify(buts) !== JSON.stringify(r.buts)) errors.push(`${r.etiquette} : au bilan, le match vu en direct (${r.cle}) n'a plus les mêmes buts — ${buts.join(' · ')} contre ${r.buts.join(' · ')} au direct`);
    else console.log(`   ${r.etiquette} : au bilan, après le reste de la saison, le match vu en direct garde ses ${buts.length} buts, au caractère près`);
  }
}
async function memesButs(etiquette, serie = false) {
  const vu = butsVusEnDirect;
  butsVusEnDirect = null;
  if (!vu) return;
  const lus = [];
  // S79 : l'écran Match ne répète plus les buts d'hier (une ligne qui ouvre le sommaire) : le sommaire fait foi.
  // Le « Sommaire du match » : le dernier match révélé (ta série : le plus haut numéro).
  const cle = await page.evaluate(s => {
    const els = [...document.querySelectorAll(s ? '#hubModal [data-sommaire^="series|"]' : '#hubModal .hub-hier[data-sommaire]')];
    const el = els.sort((a, b) => Number(a.dataset.sommaire.split('|')[2]) - Number(b.dataset.sommaire.split('|')[2])).pop();
    return el ? el.dataset.sommaire : null;
  }, serie);
  if (cle) {
    lus.push(['le sommaire du match', await butsDuSommaire(cle)]);
    // Le match de saison se relira au bilan, après toutes les décisions qui suivent.
    if (!serie) aRelire.push({ etiquette, cle, buts: vu.buts });
  } else errors.push(`${etiquette} : le match vu en direct n'a pas de sommaire à ouvrir`);
  const direct = JSON.stringify(vu.buts);
  const faux = lus.filter(([, l]) => JSON.stringify(l) !== direct);
  if (faux.length) errors.push(`${etiquette} : ${faux.map(([q, l]) => `${q} (${l.join(' · ')})`).join(' et ')} ne dit pas les mêmes buts que le direct (${vu.buts.join(' · ')})`);
  else console.log(`   ${etiquette} : le direct, ${lus.map(([q]) => q).join(' et ')} disent les mêmes ${vu.buts.length} buts, période, heure et marqueur${vu.entracte ? ' — entracte compris' : ''} (${propre(vu.buts.slice(0, 3).join(' · '))}${vu.buts.length > 3 ? ' …' : ''})`);
}
async function finirDirect(etiquette) {
  await _click('#liveModal .live-fin');
  await _wait('#liveModal .live-suite, #liveModal .live-entracte', { timeout: 10000 });
  if (!(await page.$('#liveModal .live-entracte'))) { await lireLeDirect(false); return; }
  const sousLeMarqueur = () => page.$$eval('#liveModal .live-ligne', els => {
    const i = els.findIndex(e => e.classList.contains('ent2-marque'));
    return els.slice(i + 1).map(e => e.textContent.trim()).join(' | ');
  });
  const avant = await sousLeMarqueur();
  const butsAvant = await butsDuDirect();
  await _click('#liveModal .live-entracte');
  await _wait('#choixModal:not([hidden]) .choix-option', { timeout: 5000 });
  const titre = ((await page.textContent('#choixModal .choix-titre')) || '').trim();
  const opts = await page.$$eval('#choixModal .choix-option', e => e.length);
  const quand = await page.$$eval('#choixModal .choix-option', e => e.filter(x => /3e période/.test(x.textContent)).length);
  if (quand !== opts) errors.push(`${etiquette} : l'entracte a ${opts - quand} option(s) qui ne disent pas « 3e période »`);
  await _click('#choixModal .choix-option');
  await _wait('#liveModal .live-pause, #liveModal .live-suite', { timeout: 120000 });
  /*
   * LE DIRECT REPRIS SE REDESSINE (S74) : la saison se rejoue, puis le fil
   * des deux premières périodes revient avant la troisième. Lire au premier
   * bouton de pause lisait parfois le fil en plein redessin — l'ancien
   * direct a lui aussi un bouton de pause. On attend la troisième période à
   * l'écran et un fil qui ne bouge plus.
   */
  await page.waitForFunction(() => /Troisième période/.test((document.querySelector('#liveModal .live-feed') || {}).textContent || ''), null, { timeout: 120000 }).catch(() => {});
  for (let n = -1, i = 0; i < 20; i++) {
    const m = await page.$$eval('#liveModal .live-ligne', e => e.length);
    if (m === n) break;
    n = m;
    await page.waitForTimeout(250);
  }
  const repris = await page.$eval('#liveModal .live-feed', e => e.textContent);
  if (!/Troisième période/.test(repris)) errors.push(`${etiquette} : le direct ne reprend pas à la troisième période après l'entracte`);
  else {
    const apres = await sousLeMarqueur();
    if (avant !== apres) {
      // La PREMIÈRE ligne qui diffère, pour savoir quoi réparer (un mot du commentateur, un but, une punition…).
      const a = avant.split(' | '), b = apres.split(' | ');
      const k = a.findIndex((x, i) => x !== b[i]);
      errors.push(`${etiquette} : les deux premières périodes ont changé après le choix de l'entracte — ligne ${k} : « ${(a[k] || '').slice(0, 140)} » devient « ${(b[k] || '').slice(0, 140)} » (${a.length} lignes avant, ${b.length} après)`);
    }
  }
  entractesVus.push(`${etiquette} « ${titre} » (${opts} options)`);
  if (await page.$('#liveModal .live-fin')) await _click('#liveModal .live-fin');
  await _wait('#liveModal .live-suite', { timeout: 10000 });
  await lireLeDirect(true);
  // Le même match, continué : les buts vus avant l'entracte sont ceux des deux premières périodes à la fin.
  const deuxPeriodes = butsVusEnDirect.buts.filter(b => /^[12] /.test(b));
  if (JSON.stringify(deuxPeriodes) !== JSON.stringify(butsAvant)) errors.push(`${etiquette} : les buts vus avant l'entracte (${butsAvant.join(' · ')}) ne sont plus ceux des deux premières périodes (${deuxPeriodes.join(' · ')})`);
}
/*
 * LES BOUTONS DE L'ÉCRAN DE SAISON VIVENT SUR L'ONGLET « MATCH » (S67) : sur
 * téléphone, le classement ou les meneurs montrent le volet seul. Un joueur
 * revient au match pour avancer le temps ; le parcours aussi.
 */
/*
 * LE BILAN, APRÈS LA FIN DE SAISON. « Voir le bilan » s'y touche — sauf quand
 * le dernier palier, pris au passage (S78 : il bloque la journée), a déjà
 * refermé l'écran de saison et montré le bilan.
 */
async function versLeBilan() {
  await _wait('#hubModal .hub-suite, #choixModal:not([hidden]) .choix-sheet, .result .score', { timeout: 120000 });
  await repondreAuxChoix();
  const suite = await page.$('#hubModal .hub-suite');
  if (suite && await suite.isVisible()) await _click('#hubModal .hub-suite');
  await _wait('.result .score', { timeout: 60000 });
}
async function versLeMatch() {
  const ou = await page.evaluate(() => ({ zone: document.body.dataset.zone, page: document.body.dataset.page }));
  if (ou.zone === 'hub' && ou.page !== 'match') { await _click('.navtab[data-page="match"]'); await page.waitForTimeout(200); }
}
page.click = async (sel, opts) => {
  if (typeof sel === 'string' && /hub-(jour|prochaine|regarder|banc|fin|suite|ronde)\b/.test(sel)) {
    await versLeMatch(); await repondreAuxChoix();
    /*
     * LA JOURNÉE PEUT S'ÊTRE BLOQUÉE ENTRE-TEMPS (S78) : un palier qui s'ouvre
     * au clic précédent, refermé « Plus tard » par \`repondreAuxChoix\`, reste à
     * traiter — « +10 » disparaît et « Fin de saison » se grise. Le parcours
     * ne clique pas dans le vide : la boucle qui l'appelle voit le message.
     */
    if (/hub-(jour|prochaine|fin)\b/.test(sel) && await page.$('#hubModal .hub-traiter')) {
      const b = await page.$(sel);
      if (!b || !(await b.isVisible()) || await b.isDisabled()) return;
    }
    /*
     * « JUSQU'À LA PROCHAINE DÉCISION » (S79) joue les journées une à une, et
     * rend la main au navigateur entre deux paquets : le clic revient tout de
     * suite. On attend qu'elle se soit arrêtée (le bouton se réactive, ou un
     * plein écran — le sommaire, un choix — s'ouvre).
     */
    if (/hub-prochaine\b/.test(sel)) {
      const r = await _click(sel, opts);
      await page.waitForFunction(() => !document.querySelector('#hubModal .hub-prochaine[disabled]'), null, { timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(150);
      return r;
    }
  }
  // Un choix forcé ouvert par-dessus se règle avant tout autre clic dans l'écran
  // — et avant un onglet de la barre, que le plein écran couvre aussi (S74b).
  else if (typeof sel === 'string' && /^(#hubModal|\.navtab)\b/.test(sel)) await repondreAuxChoix();
  /*
   * « À RÉGLER AVANT LE MATCH » PEUT S'ÊTRE RÉGLÉ EN ROUTE (1.0). Répondre aux
   * choix ouverts, juste au-dessus, règle souvent le message qui bloquait : le
   * bouton disparaît, et le clic attendait trente secondes un bouton parti
   * (« ÉCHEC du clic #hubModal .hub-traiter », erreurs relevées : aucune). Un
   * joueur ne toucherait pas un bouton qui n'est plus là ; le parcours non plus.
   */
  if (typeof sel === 'string' && /hub-traiter\b/.test(sel)) {
    const b = await page.$(sel);
    if (!b || !(await b.isVisible().catch(() => false))) return;
  }
  try { return await _click(sel, opts); }
  catch (e) {
    // UN CLIC QUI ÉCHOUE LAISSE UNE TRACE (S74b) : l'écran, ce que dit
    // l'écran de saison, et les erreurs déjà relevées — sans quoi un
    // `TimeoutError` de trente secondes ne dit rien de ce qu'on voyait.
    await page.screenshot({ path: 'scripts/smoke-echec.png' }).catch(() => {});
    const vu = await page.evaluate(() => ({
      tete: document.querySelector('#hubModal .hub-head')?.innerText.replace(/\s+/g, ' ').trim(),
      actions: document.querySelector('#hubModal .hub-actions')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 400),
      choix: document.querySelector('#choixModal:not([hidden]) .choix-titre')?.innerText,
    })).catch(() => ({}));
    console.log(`\n   ÉCHEC du clic « ${sel} » : ${JSON.stringify(vu)}\n   erreurs relevées : ${errors.join(' | ') || 'aucune'}`);
    throw e;
  }
};
page.waitForSelector = async (sel, opts) => {
  if (typeof sel === 'string' && /hub-(jour|prochaine|suite)\b/.test(sel)) {
    // Le hub prêt, ou un plein écran à régler d'abord (un choix, un palier, un sommaire).
    await _wait('#hubModal .hub-jour, #hubModal .hub-traiter, #hubModal .hub-suite, #choixModal:not([hidden]) .choix-sheet', opts);
    await repondreAuxChoix();
  }
  return _wait(sel, opts);
};
let netErrors = 0;   // images externes (assets.nhle.com) : réseau, pas l'application
// Les photos d'action (1.0) : sur le Web, elles viennent de img/actions ; seule l'application Android va à la LNH.
let actionsLNH = 0;
page.on('request', r => { if (r.url().includes('/mugs/actionshots/')) actionsLNH++; });
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
/* LE MENU AU DÉPART (S77) : le premier lancement d'une session ouvre le menu.
   « La saison · Nouvelle partie » bâtit la partie et ouvre l'écran « Nouvelle
   partie » par-dessus, exactement comme la première visite d'avant. */
await page.waitForSelector('#menuDepart', { state: 'visible', timeout: 30000 });
const modesAuMenu = await page.$$eval('#menuDepart .menu-mode', l => l.map(x => x.dataset.genre).join(','));
// 1.0 (R8) : le Rogue est le héros du menu — premier dans le DOM et le plus haut ; l'exhibition est un lien sous la grille.
if (modesAuMenu !== 'rogue,saison,table') errors.push(`le menu au départ n'offre pas les trois modes, le Rogue en premier : ${modesAuMenu}`);
if (!(await page.$('#menuDepart .menu-lien[data-menu="exhibition"]'))) errors.push('le menu au départ n\'a pas le lien Exhibition');
{
  const hauteurs = await page.$$eval('#menuDepart .menu-mode', l => l.map(x => [x.dataset.genre, x.getBoundingClientRect().height]));
  const rogue = hauteurs.find(h => h[0] === 'rogue');
  if (!rogue || hauteurs.some(h => h[0] !== 'rogue' && h[1] > rogue[1])) errors.push(`le carton Rogue n'est pas le plus haut du menu : ${hauteurs.map(h => `${h[0]} ${Math.round(h[1])}`).join(', ')}`);
  const extra = await page.$('#menuDepart .menu-mode[data-genre="rogue"] .menu-mode-extra');
  if (extra) errors.push('à la première visite, le carton Rogue affiche un résumé de run qui n\'existe pas');
}
await page.click('#menuDepart .menu-mode[data-genre="saison"] [data-menu="nouvelle"]');
await page.waitForSelector('#game', { state: 'visible', timeout: 30000 });
console.log('1. #game visible');

/* PREMIÈRE VISITE : le localStorage vient d'être vidé, donc l'écran « Nouvelle
   partie » s'ouvre par-dessus. Ce n'est pas un `if` : c'est garanti, donc on
   l'attend durement — le test prouve du même coup que l'écran s'ouvre. Rien
   n'est signé et rien n'a changé, alors « Commencer » se contente de fermer. */
await page.waitForSelector('#partieModal', { state: 'visible', timeout: 30000 });
/*
 * LA BARRE D'ÉTAT DU TÉLÉPHONE (S70). JP : *assure de laisser espace dans le
 * haut sinon barre de notif sur Android cache le new game et les settings*.
 * Capacitor 8 injecte `--safe-area-inset-top` sur la racine quand la
 * WebView passe sous la barre d'état : on le pose à la main, et rien de
 * cliquable ne doit commencer au-dessus — ni l'écran « Nouvelle partie », ni
 * les boutons de la barre du haut. Puis on l'enlève : sur ordinateur, rien ne
 * bouge.
 */
{
  const BARRE = 32;
  const mesurer = () => page.evaluate(() => {
    const haut = el => (el ? Math.round(el.getBoundingClientRect().top) : null);
    const boutons = [...document.querySelectorAll('.topbar button, .topbar a')].filter(b => b.offsetParent);
    return { partie: haut(document.querySelector('#partieModal')), boutons: boutons.length ? Math.min(...boutons.map(haut)) : null };
  });
  const avant = await mesurer();
  await page.evaluate(n => document.documentElement.style.setProperty('--safe-area-inset-top', `${n}px`), BARRE);
  await page.waitForTimeout(150);
  const tel = await mesurer();
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-inset-top'));
  await page.waitForTimeout(150);
  const apres = await mesurer();
  if (tel.partie == null || tel.partie < BARRE) errors.push(`sous une barre d'état de ${BARRE} px, l'écran « Nouvelle partie » commence à ${tel.partie} px`);
  if (tel.boutons == null || tel.boutons < BARRE) errors.push(`sous une barre d'état de ${BARRE} px, un bouton de la barre du haut commence à ${tel.boutons} px`);
  if (apres.partie !== avant.partie || apres.boutons !== avant.boutons) errors.push(`sans barre d'état, le haut a bougé : ${JSON.stringify(avant)} puis ${JSON.stringify(apres)}`);
  else console.log(`   la barre d'état du téléphone : sous ${BARRE} px, « Nouvelle partie » à ${tel.partie} px et les boutons du haut à ${tel.boutons} px ; sans elle, rien ne bouge`);
}
/*
 * LA BARRE DE GESTES (S78). JP : *ajouter espace protégé dans le bas sur
 * mobile aussi*. Même épreuve qu'en haut : Capacitor pose
 * `--safe-area-inset-bottom` ; la barre d'onglets et le bas de l'écran
 * « Nouvelle partie » doivent s'arrêter au-dessus. Sans elle, rien ne bouge.
 */
{
  const GESTES = 28;
  const mesurer = () => page.evaluate(() => {
    const bas = el => (el ? Math.round(innerHeight - el.getBoundingClientRect().bottom) : null);
    return { navbar: bas(document.querySelector('#navbar')), partie: bas(document.querySelector('#partieModal')) };
  });
  const avant = await mesurer();
  await page.evaluate(n => document.documentElement.style.setProperty('--safe-area-inset-bottom', `${n}px`), GESTES);
  await page.waitForTimeout(150);
  const tel = await mesurer();
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-inset-bottom'));
  await page.waitForTimeout(150);
  const apres = await mesurer();
  if (tel.navbar != null && tel.navbar < GESTES) errors.push(`au-dessus d'une barre de gestes de ${GESTES} px, la barre d'onglets finit à ${tel.navbar} px du bas`);
  if (tel.partie == null || tel.partie < GESTES) errors.push(`au-dessus d'une barre de gestes de ${GESTES} px, l'écran « Nouvelle partie » finit à ${tel.partie} px du bas`);
  if (JSON.stringify(apres) !== JSON.stringify(avant)) errors.push(`sans barre de gestes, le bas a bougé : ${JSON.stringify(avant)} puis ${JSON.stringify(apres)}`);
  else console.log(`   la barre de gestes : au-dessus de ${GESTES} px, la barre d'onglets à ${tel.navbar} px du bas et « Nouvelle partie » à ${tel.partie} px ; sans elle, rien ne bouge`);
}
/*
 * « COMMENT ON JOUE, EN CINQ CARTES » (S74) : cinq cartes à lire, par-dessus
 * « Nouvelle partie », et « Compris ! » y ramène sans rien changer.
 */
{
  await _click('#npAide');
  await _wait('#choixModal:not([hidden]) .choix-sheet[data-genre="aide"] .tc', { timeout: 5000 });
  const n = await page.$$eval('#choixModal .tc', e => e.length);
  const lisibles = await page.$$eval('#choixModal .tc.lecture', e => e.length);
  await _click('#choixModal .choix-plus-tard');
  await page.waitForTimeout(200);
  const encore = await page.isVisible('#partieModal');
  if (n !== 5 || lisibles !== 5 || !encore) errors.push(`« Comment on joue » : ${n} cartes, ${lisibles} à lire, « Nouvelle partie » ${encore ? 'encore ouverte' : 'refermée'}`);
  else console.log('   « Comment on joue » : cinq cartes à lire, et « Nouvelle partie » reste ouverte dessous');
}
/*
 * DEUX LISTES QUI N'EXISTENT QUE QUAND ELLES SERVENT (1.0, J2-2) : la saison
 * et la franchise se montrent au choix qui les demande ; le résumé du pied se
 * lit en entier (deux lignes au plus), et la toute première partie dit
 * « première roulette ».
 */
{
  const lu = () => page.evaluate(() => {
    const vu = id => { const e = document.getElementById(id); return !!(e && e.offsetParent); };
    const r = document.getElementById('npResume');
    return { saison: vu('epoqueSelect'), franchise: vu('franchiseSelect'), coupe: r.scrollHeight > r.clientHeight + 1, note: (document.getElementById('npGoNote') || {}).textContent };
  });
  const avant = await lu();
  await _click('#partieModal .seg[data-opt="ligue"] button[data-val="UNE"]');
  await page.waitForTimeout(120);
  const une = await lu();
  await _click('#partieModal .seg[data-opt="ligue"] button[data-val="TOUTES"]');
  await page.waitForTimeout(120);
  if (avant.saison || avant.franchise) errors.push(`« Nouvelle partie » montre une liste qui ne sert pas : saison ${avant.saison}, franchise ${avant.franchise}`);
  if (!une.saison) errors.push('« Une saison » ne montre pas la liste des saisons');
  if (avant.coupe || une.coupe) errors.push('le résumé de « Nouvelle partie » est coupé');
  if (avant.note !== 'première roulette') errors.push(`la toute première partie ne dit pas « première roulette » : « ${avant.note} »`);
  await sansDebordement('Nouvelle partie');
  console.log(`   « Nouvelle partie » : les listes suivent le choix, le résumé tient, « ${avant.note} »`);
}
await page.click('#npGo');
await passerIdentite();
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 15000 });
console.log('   écran « Nouvelle partie » : ouvert à la première visite, refermé');
/*
 * LE VESTIAIRE DIT UN SEUL NOMBRE (1.0, J2-6) : le badge de l'onglet, le
 * titre du vestiaire et le tableau de bord comptent les mêmes signables ;
 * les onglets vides avant le premier match sont estompés ; le bouton du bas
 * est une jauge ; et la première roulette ne s'annonce pas par un toast.
 */
{
  await page.waitForSelector('#pool .pcard', { timeout: 30000 });
  await page.waitForTimeout(400);
  const lu = await page.evaluate(() => {
    const txt = s => (document.querySelector(s) || {}).textContent || '';
    const badge = txt('.navtab[data-page="repechage"] .navtab-badge').trim();
    const dash = (txt('#dash').match(/(\d+)\s*signables/) || [])[1];
    const titre = (txt('#poolCount').match(/(\d+)\s*signable/) || [])[1];
    const b = document.getElementById('mainBtn');
    return { badge, dash, titre, morts: [...document.querySelectorAll('.navtab.mort')].map(x => x.dataset.page).join(','),
      jauge: b.classList.contains('jauge'), mot: b.textContent.trim(), toast: txt('#toast') };
  });
  if (!(lu.badge && lu.badge === lu.dash && lu.dash === lu.titre)) errors.push(`le vestiaire dit plusieurs nombres : onglet ${lu.badge}, tableau ${lu.dash}, titre ${lu.titre}`);
  if (!/classement/.test(lu.morts) || !/meneurs/.test(lu.morts)) errors.push(`les onglets vides du repêchage ne sont pas estompés : ${lu.morts || 'aucun'}`);
  if (!lu.jauge || !/^\d+ \/ \d+ · encore \d+$/.test(lu.mot)) errors.push(`le bouton du bas n'est pas une jauge : « ${lu.mot} »`);
  if (/repart à zéro/.test(lu.toast)) errors.push(`la première roulette s'annonce par un toast : « ${lu.toast} »`);
  console.log(`   le vestiaire : ${lu.badge} signables partout, onglets estompés (${lu.morts}), jauge « ${lu.mot} »`);
}
/*
 * LA FICHE : « SIGNER » SOUS LE POUCE (1.0, J2-5). Sur téléphone, le bouton
 * de la fiche tombait sous le pli ; il colle au bas de la feuille. On ouvre la
 * fiche d'un joueur du vestiaire et on exige le bouton dans l'écran, sans
 * défiler.
 */
{
  const carte = await page.waitForSelector('#pool .pcard', { timeout: 30000 }).catch(() => null);
  if (carte) {
    await carte.click({ position: { x: 30, y: 30 } });
    const btn = await page.waitForSelector('#hockeyCardModal #modalSignBtn', { timeout: 5000 }).catch(() => null);
    if (btn) {
      const r = await btn.boundingBox();
      if (!r || r.y + r.height > 844 + 1) errors.push(`la fiche d'un joueur laisse « Signer » sous le pli (${r ? Math.round(r.y + r.height) : '?'} px sur 844)`);
    } else errors.push('la fiche d\'un joueur du vestiaire ne s\'ouvre pas, ou n\'a pas de bouton « Signer »');
    await page.click('#closeHockeyCardBtn').catch(() => {});
    await page.waitForTimeout(250);
  }
}

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
    /*
     * UN TIROIR FERMÉ NE MONTRE QUE SON RÉSUMÉ. Chrome récent cache le corps
     * d'un <details> fermé par `::details-content` — son style calculé reste
     * « display: block » et sa boîte garde des mesures, donc le garde-fou le
     * comptait visible et le voyait « déborder » du tiroir plié (S78 : « Les
     * autres matchs », le rapport par ligne). Hors de son <summary>, un
     * élément d'un tiroir fermé n'est pas à l'écran.
     */
    const plie = el => {
      for (let d = el.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) {
        const s = d.querySelector(':scope > summary');
        if (!s || !s.contains(el)) return true;
      }
      return false;
    };
    const vu = el => { const s = st(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || plie(el)) return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nom = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
      + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!vu(el) || el.children.length || !(el.textContent || '').trim()) continue;
      // LE TEXTE D'UN SVG (un écusson) est dessiné dans sa boîte de vue : il
      // ne défile jamais, et sa boîte englobante peut mentir pendant une
      // transition — « NHL STARS » a été signalé 87 px sous son propre logo.
      if (el.closest('svg')) continue;
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
      /*
       * COUPÉ À DROITE (1.0, J2-4). Une puce en `nowrap` sortait de sa carte
       * (« un réserviste ou un rappel j… ») et rien ne le voyait : la question
       * du bas ne regarde que la hauteur. Le premier ancêtre qui rogne en X
       * révèle sa largeur de défilement s'il défile en X, sa largeur visible
       * sinon — un `overflow: hidden` compte le contenu coupé dans son
       * `scrollWidth`, donc c'est `clientWidth` qui dit ce qu'on voit.
       */
      let cx = el.parentElement;
      while (cx && !['hidden', 'auto', 'scroll', 'clip'].includes(st(cx).overflowX)) cx = cx.parentElement;
      // Un ancêtre en `text-overflow: ellipsis` coupe EXPRÈS, et le dit par « … » (un nom long dans une bande étroite).
      if (cx && st(cx).textOverflow !== 'ellipsis') {
        const defileX = ['auto', 'scroll'].includes(st(cx).overflowX);
        const rx = cx.getBoundingClientRect();
        const droite = r.right - (rx.left + cx.clientLeft) + (defileX ? cx.scrollLeft : 0);
        const limite = defileX ? cx.scrollWidth : cx.clientWidth;
        if (droite > limite + 2) out.push(`« ${(el.textContent || '').trim().slice(0, 36)} » (${nom(el)}) est coupé à droite de ${Math.round(droite - limite)} px dans ${nom(cx)}`);
      }
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
/*
 * ON REDIMENSIONNE SANS RIEN PERDRE (S67). JP : *faire que l'interface soit
 * toujours, peu importe le moment, même organisation et adaptable et
 * redimensionnable sans rien perdre*. À chaque taille — un petit téléphone,
 * une tablette, un portable, un écran de bureau, du 4K — la barre porte les
 * MÊMES entrées dans le même ordre, rien ne déborde en largeur, rien n'est
 * hors de portée, et la barre se touche. On revient à 390 × 844 à la fin :
 * c'est la taille du reste du parcours.
 */
const TAILLES = [[360, 640], [768, 1024], [1280, 800], [1920, 1080], [3840, 2160]];
async function redimensionner(ou) {
  const lireBarre = () => page.$$eval('#navbar .navtab', e => e.map(x => x.dataset.page).join(' · '));
  const ref = await lireBarre();
  const vus = [];
  for (const [w, h] of TAILLES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const ici = await lireBarre();
    if (ici !== ref) errors.push(`${ou} à ${w}×${h} : la barre change (« ${ref} » puis « ${ici} »)`);
    const touche = await page.evaluate(() => {
      const b = document.querySelector('#navbar .navtab.on') || document.querySelector('#navbar .navtab');
      if (!b) return false;
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return !!el && b.contains(el);
    });
    if (!touche) errors.push(`${ou} à ${w}×${h} : l'onglet ouvert de la barre ne se touche pas`);
    await sansDebordement(`${ou} à ${w}×${h}`);
    await toutEstAtteignable(`${ou} à ${w}×${h}`);
    if (w === 1280) await page.screenshot({ path: `scripts/smoke-coquille-${ou.replace(/[^a-z]+/gi, '-').toLowerCase()}.png`, fullPage: false });
    vus.push(`${w}×${h}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `scripts/smoke-coquille-${ou.replace(/[^a-z]+/gi, '-').toLowerCase()}-390.png`, fullPage: false });
  console.log(`   redimensionné sans rien perdre — ${ou} : ${vus.join(' · ')}, la barre reste « ${ref} »`);
}

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
/*
 * LIRE UN NOMBRE DE L'ÉCRAN (1.0, gel des chaînes) : « 95,5 M$ », « 0,78 M$ »,
 * « −1,2 M$ », « ,912 », « 46 PTS ». La virgule est décimale, le moins est
 * typographique, l'espace avant M$ est insécable. L'ancien lecteur gardait les
 * chiffres et les POINTS : « 95,5 M$ » y serait devenu 955, « ,912 » 912.
 */
const lireNombre = t => {
  const m = String(t || '').replace(/\u00a0/g, ' ').match(/[−-]?\d*[.,]?\d+/);
  return m ? parseFloat(m[0].replace('−', '-').replace(',', '.')) || 0 : 0;
};
const parseM = lireNombre;
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
      price: (((t) => { const m = t.replace(/\u00a0/g, ' ').match(/[−-]?\d*[.,]?\d+/); return m ? parseFloat(m[0].replace('−', '-').replace(',', '.')) || 0 : 0; })(el.querySelector('.pcard-price')?.textContent || '')),
      // Un bouton « Signer · bloque la fin » (1.0, J1-Q) demande deux touchers : l'auto-draft ne le prend jamais d'un seul.
      ok: !!el.querySelector('.btn-sign:not([disabled]):not(.risque)'),
      // La carte DIT en rouge ce que la signature va coûter : « ▼ sous sa
      // zone », « −N hors position », « ⚠ bloque la fin ». Un joueur ne signe
      // pas cette carte-là s'il en a une propre ; l'auto-draft non plus.
      propre: !el.querySelector('.pcard-dest .dest-bad, .pcard-dest .dest-warn'),
      // Le chiffre clé de la carte : des points pour un patineur, des victoires
      // pour un gardien. Ce n'est PAS une cote — celles-là ne sont pas dans le
      // DOM, et c'est une règle du dépôt — mais c'est ce que le joueur lit.
      cle: (((t) => { const m = t.replace(/\u00a0/g, ' ').match(/[−-]?\d*[.,]?\d+/); return m ? parseFloat(m[0].replace('−', '-').replace(',', '.')) || 0 : 0; })(el.querySelector('.pcard-big b')?.textContent || '0')),
    })));

    /*
     * L'AUTO-DRAFT LIT LA CARTE AU LIEU DE PRENDRE LA PREMIÈRE (S64). Il
     * signait le premier joueur abordable dans l'ORDRE DU DOM — et en « par
     * poste » cet ordre est celui des colonnes, donc le premier ailier gauche
     * abordable, pas le meilleur joueur offert. Il rangeait des joueurs de
     * premier trio au quatrième et payait le malus de zone à chaque tour.
     * Mesuré sur 24 repêchages en Node (même moteur, mêmes adversaires,
     * `sonde_smoke` de S64) : 39,7 victoires, 20e au classement, les séries 8
     * fois sur 24.
     *
     * DEUX CLÉS, DANS CET ORDRE, et les deux sont dans le DOM — les cotes n'y
     * sont pas, et c'est une règle du dépôt : (1) une destination qui ne porte
     * AUCUN avertissement, (2) le plus grand chiffre clé. La première seule ne
     * suffit pas : tôt dans le repêchage toutes les cases sont libres, donc
     * presque aucune carte n'avertit — mesuré dans Chromium, 32-39-11 et trois
     * reprises pour se qualifier. Les deux ensemble : 50-27-5, 51-29-2,
     * 60-21-1 sur trois exécutions, qualifiée sans une seule reprise.
     *
     * Ce n'est pas un test qu'on truque : c'est la décision que l'écran
     * demande de prendre, avec la seule information qu'il donne.
     */
    const rang = (a, b) => (infos[b].propre - infos[a].propre) || (infos[b].cle - infos[a].cle);
    const tenables = infos.map((c, i) => i).filter(i => infos[i].ok && infos[i].price <= maxPick);
    let idx = tenables.length ? tenables.sort(rang)[0] : -1;
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
    const avant = signed;
    signed = await lireSignes();
    // Un seul clic ne laisse jamais moins que le plancher pour les cases restantes (J1-Q).
    if (signed > avant) {
      const etat = await page.evaluate(() => {
        const m = (document.querySelector('#capAmt')?.textContent || '').replace(/\u00a0/g, ' ').match(/(−?[\d,]+)\s*M\$/);
        const s = (document.querySelector('#cnt')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
        return { rem: m ? parseFloat(m[1].replace('−', '-').replace(',', '.')) : null, left: s ? Number(s[2]) - Number(s[1]) : null };
      });
      // Le plancher du jeu est 0,775 M$ par case (MIN_SAL de js/game.js) ; le 0,95 d'ici est la marge de l'auto-draft.
      if (etat.rem != null && etat.left != null && etat.rem + 0.01 < 0.775 * etat.left) errors.push(`une signature d'un seul clic a laissé ${etat.rem} M$ pour ${etat.left} cases, sous le plancher`);
      // LE TOAST EN HAUT SUR TÉLÉPHONE (1.0, J2-17) : il se posait sur les boutons du pouce.
      if (!toastVu) {
        const t = await page.evaluate(() => { const e = document.querySelector('#toast.on'); if (!e) return null; const r = e.getBoundingClientRect(); return { haut: r.top, bas: r.bottom, h: innerHeight, w: innerWidth }; });
        if (t) { toastVu = true; if (t.w < 1200 && t.bas > t.h / 2) errors.push(`le toast se pose dans la moitié basse du téléphone (${Math.round(t.haut)}–${Math.round(t.bas)} px sur ${t.h})`); }
      }
    }
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
  // LA BARRE EST FIXE (S67) : ses neuf entrées existent dès le repêchage, et
  // celles qui n'ont encore rien à montrer tiennent leur état vide sur un écran.
  for (const cle of ['match', 'repechage', 'alignement', 'classement', 'calendrier', 'meneurs', 'equipes', 'historique', 'regles']) {
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
  barreAuRepechage = await page.$$eval('#navbar .navtab', e => e.map(x => x.dataset.page).join(' · '));
  await redimensionner('le repêchage');
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
  /*
   * UN MATCH ORDINAIRE SE LIT AU BUREAU (1.0, J2-8) : pas de plein écran,
   * le résultat en tête du volet. Le plein écran ne vient que pour une
   * raison qu'il dit (une blessure, un gros match, du courrier à régler).
   */
  {
    await page.waitForTimeout(250);
    const som = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"]');
    const txt = som ? ((await som.textContent()) || '') : '';
    if (som && !/🚑|Gros match|à traiter/.test(txt)) errors.push(`le sommaire s'ouvre en plein écran pour un match ordinaire : « ${txt.replace(/\s+/g, ' ').slice(0, 80)} »`);
    else if (!som && !(await page.$('#hubModal .hub-hier'))) errors.push('après « Journée suivante », le résultat n\'est ni en plein écran ni au bureau');
    else if (!som) console.log('   un match ordinaire : pas de plein écran, le résultat monte au bureau');
  }
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
    await page.click('#hubModal .hub-prochaine');
    await page.waitForTimeout(400);
    const avant = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    const sauve = await page.evaluate(() => {
      try {
        const brut = localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif)) || '';
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
    // L'onglet Alignement mène derrière le banc (S78 : le bouton « Le banc » faisait doublon).
    await page.click('.navtab[data-page="alignement"]');
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
    // LA CASE LISIBLE (S78) : la ligne de faits a sa classe, `.slot-faits` —
    // la case n'a plus qu'une ligne de méta, on ne la cherche plus par rang.
    const metas = await page.$$eval('.slot', els => els.filter(e => e.querySelector('.slot-name')).map(e => e.querySelector('.slot-faits')?.textContent.trim() || ''));
    // « 1,000 » : un gardien qui n'a rien accordé encore (un blanchissage en début de saison).
    const ficheCase = /^(\d+-\d+-\d+ · [+-−]?\d+|\d+-\d+ · ([,—]|1,000)|aucun match)/;
    if (metas.length !== 23 || !metas.every(m => ficheCase.test(m))) errors.push(`les cases du banc ne portent pas la fiche à ce jour (${metas.length} cases) : ${metas.filter(m => !ficheCase.test(m)).slice(0, 4).join(' | ')}`);
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
    /*
     * MES LIGNES, DERRIÈRE LE BANC (S68) — SOUS LEURS TRIOS DEPUIS S78. Le
     * plan et la glace d'équipe sont devenus les lignes à la HockeyArena : une
     * tactique, une agressivité et des secondes de présence par ligne. JP
     * (S78) : *Alignement et stratégie et trio, ça devrait être ensemble* —
     * la modale « Mes lignes » est devenue un tiroir sous chaque trio, un seul
     * ouvert à la fois, et un réglage s'applique tout de suite (plus de
     * « Garder ces lignes »). Ce qui se vérifie : quatre tiroirs, le premier
     * s'ouvre avec ses sept tactiques, chacune annonce le fit de CETTE ligne,
     * le profil demandé se lit pour les cinq postes de la ligne (le trio et sa
     * paire), l'accordéon referme l'autre tiroir, et le changement voyage
     * jusqu'à la sauvegarde avec la décision du banc — c'est elle qui compte.
     *
     * UN SYSTÈME POUR LE TRIO, UN AUTRE POUR LA PAIRE (S79) : sept tiroirs
     * (quatre trios, trois paires). Le tiroir du 1er trio a ses huit systèmes
     * d'avants (Hourra compris), chacun avec son fit en mots, et demande un
     * rôle à ses trois postes ; celui de la 1re paire a ses six systèmes de
     * défenseurs et demande un rôle à ses deux postes. Le système de la paire
     * voyage lui aussi jusqu'à la sauvegarde (`tacD`). Chaque case porte
     * l'icône du rôle de son joueur, et chaque trio le nom de ce qu'il est.
     */
    let tacChoisie = null, tacDChoisi = null;
    if (await page.$('#bancLignes')) errors.push('le banc a encore son bouton « Mes lignes » : la stratégie vit sous les trios');
    const tiroirs = await page.$$eval('#rosterBoard .ln-strat', e => e.map(x => x.dataset.g + x.dataset.u).join(' '));
    if (tiroirs !== 'F0 F1 F2 F3 D0 D1 D2') errors.push(`les tiroirs de stratégie ne sont pas un par trio et un par paire : ${tiroirs}`);
    {
      const lu = await page.evaluate(() => ({
        roles: document.querySelectorAll('#rosterBoard .slot .slot-roles').length,
        cases: [...document.querySelectorAll('#rosterBoard .slot:not(.empty)')].filter(x => !/^G/.test(x.querySelector('.sb-role')?.textContent || '')).length,
        ids: [...document.querySelectorAll('#rosterBoard .line-id')].map(x => x.textContent.trim()),
      }));
      if (lu.roles < lu.cases - 2) errors.push(`les cases ne portent pas le rôle de leur joueur : ${lu.roles} icônes pour ${lu.cases} patineurs`);
      if (lu.ids.length !== 7 || lu.ids.some(t => !/^(Trio|Paire) /.test(t))) errors.push(`les trios et les paires ne disent pas ce qu'ils sont : ${lu.ids.join(' | ')}`);
      else console.log(`   l'alignement : ${lu.roles} rôles en icônes · ${lu.ids.join(' · ')}`);
    }
    /*
     * LA CASE SANS PHOTO, LE SYSTÈME EN FENÊTRE (1.0, les lignes). JP : *au
     * lieu de dropdown, modal, et au lieu des photos, icônes et cote générale
     * à sa position*. Aucune photo dans les cases ; chaque case porte un rôle
     * et une pastille de NIVEAU (jamais une cote : `sansCote` le vérifie) et,
     * derrière le banc, ses jambes. La rangée « Régler › » ouvre une fenêtre ;
     * rien ne s'applique avant « Appliquer », « Annuler » ne change rien.
     */
    {
      const cases = await page.evaluate(() => {
        const cs = [...document.querySelectorAll('#rosterBoard .line .slot:not(.empty):not(.verrou)')];
        return { n: cs.length, visages: document.querySelectorAll('#rosterBoard .slot img.visage').length,
          sansNiveau: cs.filter(c => !c.querySelector('.niv')).length, sansRole: cs.filter(c => !c.querySelector('.cell-role')).length,
          jambes: document.querySelectorAll('#rosterBoard .slot .jambes').length };
      });
      if (cases.visages) errors.push(`l'alignement montre encore ${cases.visages} photo(s) dans ses cases`);
      if (cases.sansNiveau || cases.sansRole) errors.push(`des cases n'ont pas leur niveau ou leur rôle : ${cases.sansNiveau} sans niveau, ${cases.sansRole} sans rôle sur ${cases.n}`);
      if (cases.jambes < cases.n - 3) errors.push(`derrière le banc, les jambes ne se lisent que sur ${cases.jambes} cases sur ${cases.n}`);
      else console.log(`   la case sans photo : ${cases.n} cases, chacune un rôle et un niveau, ${cases.jambes} jambes lisibles`);
    }
    const ouvrirFenetre = async (g, u) => {
      await _click(`#rosterBoard .ln-strat[data-g="${g}"][data-u="${u}"]`);
      await page.waitForSelector(`#lignesModal:not([hidden]) .ln-fenetre[data-g="${g}"][data-u="${u}"] .gl-tac`, { timeout: 5000 });
    };
    const tacOn = (attr) => page.$eval(`#lignesModal .gl-tac.on`, (b, a) => b.dataset[a], attr).catch(() => null);
    await ouvrirFenetre('F', 0);
    {
      const lu = await page.evaluate(() => ({
        tacs: document.querySelectorAll('#lignesModal .gl-tac').length,
        fits: [...document.querySelectorAll('#lignesModal .gl-tac-fit')].map(e => e.textContent.trim()),
        demandes: document.querySelectorAll('#lignesModal .ln-dem').length,
      }));
      if (lu.tacs !== 8) errors.push(`la fenêtre du 1er trio n'a pas ses huit systèmes : ${lu.tacs}`);
      // LE FIT EN MOTS (S71, S79) : « Sur mesure », « Bon fit », « Fit moyen », « Mauvais fit ».
      if (lu.fits.filter(f => /^(Sur mesure|Bon fit|Fit moyen|Mauvais fit)$/.test(f)).length !== 7) errors.push(`les systèmes n'annoncent pas leur fit : ${lu.fits.join(' | ')}`);
      if (lu.fits.some(f => /\d+ %/.test(f))) errors.push(`le fit s'affiche encore en pourcentage : ${lu.fits.join(' | ')}`);
      const tacOuverte = await tacOn('tac');
      if (tacOuverte !== 'hourra' && lu.demandes !== 3) errors.push(`le 1er trio dit le rôle demandé à ${lu.demandes} postes au lieu de trois`);
      tacChoisie = await page.$eval('#lignesModal .gl-tac:not(.on):not([data-tac="hourra"])', b => b.dataset.tac);
      await _click(`#lignesModal .gl-tac[data-tac="${tacChoisie}"]`);
      await _click('#lignesModal [data-agr="2"]');
      await page.waitForTimeout(150);
      await page.screenshot({ path: 'scripts/smoke-lignes.png', fullPage: false });
      if ((await tacOn('tac')) !== tacChoisie) errors.push('toucher un système dans la fenêtre ne le sélectionne pas');
      await _click('#lignesModal .gl-appliquer');
      await page.waitForTimeout(200);
      if (await page.isVisible('#lignesModal')) errors.push('« Appliquer » ne referme pas la fenêtre du système');
      await ouvrirFenetre('F', 0);
      const reglee = await tacOn('tac');
      if (reglee !== tacChoisie) errors.push(`la fenêtre n'a pas appliqué le système : ${reglee} au lieu de ${tacChoisie}`);
      await _click('#lignesModal .gl-pied .gl-annuler');
      await page.waitForTimeout(150);
      // LA PAIRE (S79) : sa fenêtre, ses six systèmes, ses deux postes.
      await ouvrirFenetre('D', 0);
      const paire = await page.evaluate(() => ({
        tacs: [...document.querySelectorAll('#lignesModal .gl-tac')].map(b => b.dataset.tacd),
        demandes: document.querySelectorAll('#lignesModal .ln-dem').length,
      }));
      if (paire.tacs.length !== 6 || paire.tacs.some(k => !k)) errors.push(`la fenêtre de la 1re paire n'a pas ses six systèmes de défenseurs : ${JSON.stringify(paire.tacs)}`);
      tacDChoisi = await page.$eval('#lignesModal .gl-tac:not(.on):not([data-tacd="hourra"])', b => b.dataset.tacd);
      await _click(`#lignesModal .gl-tac[data-tacd="${tacDChoisi}"]`);
      await page.waitForTimeout(150);
      const demPaire = await page.$$eval('#lignesModal .ln-dem', e => e.length);
      if (demPaire !== 2) errors.push(`la 1re paire dit le rôle demandé à ${demPaire} postes au lieu de deux`);
      await page.screenshot({ path: 'scripts/smoke-paire.png', fullPage: false });
      await _click('#lignesModal .gl-appliquer');
      await page.waitForTimeout(200);
      await ouvrirFenetre('D', 0);
      const paireReglee = await tacOn('tacd');
      if (paireReglee !== tacDChoisi) errors.push(`la fenêtre de la paire n'a pas appliqué son système : ${paireReglee} au lieu de ${tacDChoisi}`);
      await _click('#lignesModal .gl-pied .gl-annuler');
      await page.waitForTimeout(150);
      // « Annuler » ne change rien : le 2e trio garde son système.
      await ouvrirFenetre('F', 1);
      const avant = await tacOn('tac');
      const autre = await page.$eval('#lignesModal .gl-tac:not(.on)', b => b.dataset.tac);
      await _click(`#lignesModal .gl-tac[data-tac="${autre}"]`);
      await _click('#lignesModal .gl-pied .gl-annuler');
      await page.waitForTimeout(150);
      await ouvrirFenetre('F', 1);
      if ((await tacOn('tac')) !== avant) errors.push('« Annuler » a changé le système du 2e trio');
      await _click('#lignesModal .gl-pied .gl-annuler');
      await page.waitForTimeout(150);
      console.log(`   la fenêtre du système : 1er trio en ${tacChoisie}, 1re paire en ${tacDChoisi}, « Annuler » ne change rien`);
    }
    await toutEstAtteignable('derrière le banc, lignes réglées');
    // Le banc à 390 px, réglages compris : c'est l'écran des décisions de
    // saison, et il doit tenir sans rien pousser hors du cadre.
    await page.screenshot({ path: 'scripts/smoke-banc.png', fullPage: false });
    const nomsAvant = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.trim()));
    await page.locator('.slot').nth(0).click(); await page.waitForTimeout(120);
    await page.locator('.slot').nth(9).click(); await page.waitForTimeout(200);
    const nomsApres = await page.$$eval('.slot .slot-name', e => e.map(x => x.textContent.trim()));
    if (nomsAvant[0] !== nomsApres[9]) errors.push('la permutation derrière le banc n\'a pas eu lieu');
    /*
     * LE NOM OUVRE SA CARTE (1.0). JP : *dans alignement, peser sur nom ouvre
     * carte*. Toucher le nom ouvre la fiche et ne choisit PAS la case ; le reste
     * de la case garde son geste (la permutation, juste au-dessus).
     */
    {
      await page.locator('.slot .slot-fiche').nth(2).click();
      const fiche = await page.waitForSelector('#hockeyCardModal', { state: 'visible', timeout: 5000 }).catch(() => null);
      const choisie = await page.$('.slot.selected');
      if (!fiche) errors.push('toucher le nom dans l\'alignement n\'ouvre pas sa carte');
      if (choisie) errors.push('toucher le nom dans l\'alignement choisit aussi la case');
      if (fiche) { await page.evaluate(() => document.getElementById('closeHockeyCardBtn').click()); await page.waitForTimeout(150); }
      if (fiche && !choisie) console.log('   le nom ouvre sa carte, et la case n\'est pas choisie');
    }
    // Au téléphone, le « Retour au match » du panneau se cache : la barre du bas porte le même (QA S74b).
    if (await page.isVisible('#bancRetour')) errors.push('à 390 px, le panneau du banc répète le « Retour au match » de la barre du bas');
    await page.click('#mainBtn');
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 120000 });
    await page.waitForTimeout(300);
    const teteApresBanc = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
    if (teteApresBanc !== teteAvantBanc) errors.push(`le retour au match ne reprend pas au même endroit : « ${teteAvantBanc} » puis « ${teteApresBanc} »`);
    // Les décisions de BANC seulement (celles qui portent un alignement) : le
    // proprio, le plan du soir et les dilemmes en ajoutent d'autres.
    const decisions = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisions || []; } catch { return []; } })).filter(d => d.cases);
    if (decisions.length !== 2 || decisions[1].fermeture !== 1) errors.push(`la sauvegarde ne porte pas la décision du banc : ${JSON.stringify(decisions.map(d => [d.jour, d.fermeture]))}`);
    else if (!Array.isArray(decisions[1].lignes) || decisions[1].lignes[0].tac !== tacChoisie || decisions[1].lignes[0].tacD !== tacDChoisi || decisions[1].lignes[0].agr !== 2) errors.push(`la sauvegarde ne porte pas les lignes du banc : ${JSON.stringify(decisions[1].lignes && decisions[1].lignes[0])}`);
    else console.log(`   derrière le banc : ${nomsAvant[0]} ↔ ${nomsAvant[9]}, fermeture au 2e trio, 1re ligne en ${tacChoisie} (trio) et ${tacDChoisi} (paire), agressivité haute, retour à « ${teteApresBanc} » — décision sauvegardée au jour ${decisions[1].jour}`);
    /*
     * ET L'AFFICHE LE DIT : la tactique et la chimie de chaque ligne se lisent
     * sur la carte du prochain match.
     */
    const affiche = await page.$$eval('#hubModal .hub-lignes .gl-resume', e => e.length).catch(() => 0);
    if (affiche !== 4) errors.push(`l'affiche du match ne dit pas les quatre lignes : ${affiche}`);
    else console.log('   l\'affiche dit les quatre lignes et leur chimie');
    /*
     * LE DÉPISTAGE, OUTIL DE DÉCISION (S79). JP : *spas si lisible le haut, pis
     * le bas aide fuck all aucun processus décisionnel*. Il s'ouvre au toucher
     * (300 matchs du moteur) et montre : les chances, un tableau des forces
     * avec l'avantage marqué, et des conseils qui s'appliquent d'un toucher —
     * jamais plus les « s'il marque quatre buts ». Un conseil appliqué est une
     * décision comme une autre : elle entre dans la sauvegarde.
     */
    {
      await _click('#hubModal .hub-depistage > summary');
      await page.waitForSelector('#hubModal .hub-depistage[open] .dep3-table', { timeout: 60000 });
      await page.waitForTimeout(300);
      const dep = await page.evaluate(() => {
        const d = document.querySelector('#hubModal .hub-depistage');
        return {
          rangees: d.querySelectorAll('.dep3-table tbody tr').length,
          marques: [...d.querySelectorAll('.dep3-av')].map(x => x.textContent.trim()),
          conseils: d.querySelectorAll('.dep3-conseil').length,
          boutons: d.querySelectorAll('.dep3-appliquer').length,
          titres: [...d.querySelectorAll('.dep3-conseil-t')].map(x => x.textContent.trim()),
          texte: d.textContent,
        };
      });
      if (dep.rangees < 5) errors.push(`le tableau des forces n'a que ${dep.rangees} rangées`);
      if (dep.marques.some(m => !/^[◀▶=]$/.test(m))) errors.push(`l'avantage du tableau n'est pas marqué : ${dep.marques.join(' ')}`);
      if (!(await page.$('#hubModal .dep3-conseils'))) errors.push('le dépistage ne dit pas quoi faire ce soir');
      if (/S'il marque|S'il en accorde/.test(dep.texte)) errors.push('le dépistage dit encore « s\'il marque… » : ça ne décide de rien');
      if (/\b(?:[odrcv]|sp)\s*[:=]\s*\d/.test(dep.texte)) errors.push('le dépistage montre une cote cachée');
      console.log(`   le dépistage : ${dep.rangees} forces (${dep.marques.join('')}), ${dep.conseils} conseil(s)${dep.titres.length ? ` — ${dep.titres.slice(0, 3).join(' · ')}` : ''}`);
      await page.screenshot({ path: 'scripts/smoke-depistage.png', fullPage: false });
      if (dep.boutons) {
        const lire = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisions || []; } catch { return []; } });
        const avant = (await lire()).length;
        await _click('#hubModal .dep3-appliquer');
        await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter', { timeout: 120000 });
        await page.waitForTimeout(400);
        const apres = await lire();
        const d = apres[apres.length - 1];
        if (apres.length !== avant + 1 || !d || !(Array.isArray(d.lignes) || d.match || 'fermeture' in d)) errors.push(`« Appliquer » n'a pas laissé de décision : ${JSON.stringify(d)}`);
        else console.log(`   « Appliquer » : une décision au jour ${d.jour} (${Array.isArray(d.lignes) ? 'lignes' : d.match ? 'consigne' : 'fermeture'})`);
      }
    }

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
    /*
     * LA ROUTE ET « PRÉPARER LE MATCH » (S66, S68). La route porte ses
     * marques, la consigne d'un match (son importance) devient une décision
     * datée du soir du match, sans rembobiner la saison. Les factions sont
     * parties en S72 : aucune jauge ne doit rester à l'écran.
     */
    {
      // S79 : la route vit dans « Ma fiche » (l'onglet Calendrier), avec sa légende.
      await _click('.navtab[data-page="calendrier"]');
      await page.waitForTimeout(250);
      const route = await page.$$eval('#hubModal .hub-route-m', e => e.length);
      const legende = await page.$('#hubModal .hub-route-legende');
      if (!legende) errors.push('la route de la saison n\'a pas sa légende dans « Ma fiche »');
      await _click('.navtab[data-page="match"]');
      await page.waitForTimeout(250);
      const jauges = await page.$$eval('#hubModal .hub-jauge, #choixModal .hub-jd', e => e.length);
      if (route < 10) errors.push(`la route de la saison n'a que ${route} marques`);
      if (jauges) errors.push(`${jauges} jauges de faction encore à l'écran`);
      if (!(await page.$('#hubModal .hub-preparer'))) errors.push('l\'affiche n\'offre pas « Préparer le match »');
      else {
        const jAvant = await jourDit();
        // LES TOTAUX DU SOIR (1.0, C5) : la ligne est sur l'affiche.
        const totHub = ((await page.textContent('#hubModal .hub-totaux').catch(() => '')) || '').trim();
        if (!/^(Ce soir|Au prochain match) :/.test(totHub)) errors.push(`l'affiche ne dit pas les totaux du soir : « ${totHub} »`);
        await _click('#hubModal .hub-preparer');
        await page.waitForSelector('#lignesModal:not([hidden]) [data-importance="haute"]', { timeout: 5000 });
        const puces = await page.$$eval('#lignesModal [data-importance="haute"] .puce', e => e.map(x => x.textContent.trim()));
        // TOUT ENSEMBLE (S72) : « Ce qui joue sur ta formation » est dans le même écran que les lignes.
        if (!(await page.$('#lignesModal .gl-effets'))) errors.push('« Préparer le match » ne montre pas ce qui joue sur ta formation');
        // En chiffres depuis S76 : « Précision +3 % », plus des flèches.
        if (!puces.some(t => /Précision [+−]\d+ %/.test(t))) errors.push(`l'importance haute ne dit pas son effet : ${puces.join(' · ')}`);
        // LES TOTAUX (C5) en tête, dits une fois, et recalculés quand la consigne change.
        const lireTot = () => page.$eval('#lignesModal .gl-totaux-l', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
        const totAvant = await lireTot();
        const multiplient = await page.$$eval('#lignesModal .gl-totaux .gl-mot', e => e.filter(x => x.textContent.trim() === 'Les effets se multiplient entre eux.').length);
        if (!/^Ce soir :/.test(totAvant)) errors.push(`« Préparer le match » ne dit pas les totaux du soir : « ${totAvant} »`);
        if (multiplient !== 1) errors.push(`« Les effets se multiplient entre eux. » paraît ${multiplient} fois dans « Préparer le match »`);
        // L'ADVERSAIRE D'ABORD, UN SEUL RÉGLAGE (1.0, J2-11) : « En face » avant la consigne, et plus de curseur attaque / défense.
        const ordre = await page.evaluate(() => {
          const a = document.querySelector('#lignesModal .gl-adv-tete'), c = document.querySelector('#lignesModal .gl-consigne');
          return { adv: !!a, avant: !!(a && c && (a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)), curseur: !!document.querySelector('#lignesModal .gl-ad-range, #lignesModal .gl-ad') };
        });
        if (!ordre.adv || !ordre.avant) errors.push('« Préparer le match » ne montre pas l\'adversaire avant la consigne');
        if (ordre.curseur) errors.push('« Préparer le match » garde un curseur attaque / défense à côté de la consigne');
        await deuxCaptures('preparer');
        // DEVANT LE FILET CE SOIR (C4) : deux gardiens, la rotation choisie, l'autre se touche.
        const filets = await page.$$eval('#lignesModal .gl-filet [data-filet]', e => e.map(b => ({ qui: b.dataset.filet, on: b.classList.contains('on'), jambes: !!b.querySelector('.jambes') })));
        if (filets.length !== 2 || filets.filter(f => f.on).length !== 1 || !filets.every(f => f.jambes)) errors.push(`« Devant le filet ce soir » n'a pas ses deux gardiens : ${JSON.stringify(filets)}`);
        const autreFilet = (filets.find(f => !f.on) || {}).qui;
        await _click('#lignesModal [data-importance="haute"]');
        const totApres = await lireTot();
        if (totApres === totAvant) errors.push(`les totaux ne suivent pas la consigne : « ${totAvant} » avant et après « Haute »`);
        if (autreFilet) await _click(`#lignesModal .gl-filet [data-filet="${autreFilet}"]`);
        console.log(`   totaux du soir : « ${totAvant} » → « ${totApres} » · devant le filet : ${autreFilet || '—'}`);
        await _click('#lignesModal .gl-appliquer');
        await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
        await repondreAuxChoix();
        await page.waitForTimeout(400);
        const jApres = await jourDit();
        const dMatch = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisions || []; } catch { return []; } })).filter(d => d.match);
        const imp = ((await page.textContent('#hubModal .hub-lignes-imp').catch(() => '')) || '').trim();
        if (jApres !== jAvant) errors.push(`la consigne du match rembobine la saison : journée ${jAvant} puis ${jApres}`);
        if (!dMatch.length || dMatch[dMatch.length - 1].match.importance !== 'haute' || !Array.isArray(dMatch[dMatch.length - 1].lignes)) errors.push(`la sauvegarde ne porte pas la consigne du match : ${JSON.stringify(dMatch)}`);
        else if (autreFilet && dMatch[dMatch.length - 1].filet !== autreFilet) errors.push(`choisir l'autre gardien ne laisse pas de décision « filet » : ${JSON.stringify(dMatch[dMatch.length - 1].filet)} au lieu de « ${autreFilet} »`);
        else if (!/Haute/.test(imp)) errors.push(`l'affiche ne dit pas l'importance choisie : « ${imp} »`);
        else console.log(`   préparer le match : importance haute pour la journée ${dMatch[dMatch.length - 1].jour + 1}, route ${route} marques, aucune faction, ce qui joue sur ta formation à côté des lignes`);
      }
    }

    /*
     * LE PORTAIL DU BUREAU (1.0, J2-7) : à 1440 px, quatre tuiles remplissent
     * la colonne de droite ; au téléphone, aucune (les onglets les portent).
     */
    {
      const tuiles = () => page.$$eval('#hubModal .hub-portail .hub-tuile', e => e.filter(x => x.offsetParent).length);
      await page.screenshot({ path: 'scripts/smoke-j2-bureau-390.png' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);
      const large = await tuiles();
      await page.screenshot({ path: 'scripts/smoke-portail-1440.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      const tel = await tuiles();
      if (large !== 4) errors.push(`le bureau à 1440 px montre ${large} tuile(s) au lieu de quatre`);
      if (tel) errors.push(`au téléphone, le bureau montre ${tel} tuile(s) : l'onglet s'allonge`);
      else console.log('   le portail du bureau : quatre tuiles à 1440 px, aucune au téléphone');
    }
    await redimensionner('la saison, onglet Match');
    await _click('.navtab[data-page="classement"]');
    await page.waitForTimeout(250);
    if ((await page.evaluate(() => document.body.dataset.zone)) !== 'hub') errors.push('en pleine saison, le classement ne s\'ouvre pas dans l\'écran de saison');
    /*
     * LE CLASSEMENT SUR TÉLÉPHONE (1.0, J2-10) : aucun nom d'équipe coupé
     * (sous 480 px la cellule dit « CGY '93 »), et ta rangée, défilée au
     * bout, reste au-dessus du bouton flottant.
     */
    {
      const cl = await page.evaluate(async () => {
        const noms = [...document.querySelectorAll('#hubModal .hub-classement td.nom')];
        const coupes = noms.filter(td => td.scrollWidth > td.clientWidth + 1).map(td => td.textContent.trim()).slice(0, 3);
        const toi = document.querySelector('#hubModal .hub-classement tr.toi');
        const f = document.getElementById('hubFlottant');
        let cache = null;
        if (toi && f && !f.hidden && getComputedStyle(f).display !== 'none') {
          const sc = [...document.querySelectorAll('#hubModal, #hubModal *')].find(e => ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1);
          if (sc) sc.scrollTop = sc.scrollHeight;
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const r = toi.getBoundingClientRect(), rf = f.getBoundingClientRect();
          if (r.bottom > rf.top && r.top < rf.bottom) cache = `${Math.round(r.bottom - rf.top)} px`;
          if (sc) sc.scrollTop = 0;
        }
        return { n: noms.length, coupes, cache, w: innerWidth };
      });
      if (cl.w <= 480 && cl.coupes.length) errors.push(`le classement coupe des noms d'équipe à ${cl.w} px : ${cl.coupes.join(' · ')}`);
      if (cl.cache) errors.push(`au bout du classement, le bouton flottant couvre ta rangée de ${cl.cache}`);
    }
    await redimensionner('la saison, onglet Classement');
    await _click('.navtab[data-page="match"]');
    await page.waitForTimeout(250);

    const trouVu = { fait: false, mot: null, erreurs: [] };
    const guetterTrou = async () => {
      if (trouVu.fait) return;
      // Le sommaire de la journée (S78) couvre le hub : on le ferme d'abord. Un autre plein écran passe devant.
      if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="sommaire"]')) {
        sommairesVus++;
        await _click('#choixModal:not([hidden]) .choix-plus-tard');
        await page.waitForTimeout(250);
      }
      if (await page.$('#choixModal:not([hidden]) .choix-sheet')) return;
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
      await _click('#hubModal .hub-trou-prendre');
      await page.waitForSelector('#hubModal .hub-jour', { timeout: 120000 });
      await page.waitForTimeout(400);
      const apres = await jourDit();
      if (apres !== avant) trouVu.erreurs.push(`encaisser la carte d'une case vide rembobine la saison : journée ${avant} puis ${apres}`);
      const dTrou = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisions || []; } catch { return []; } }))
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
    guetterTrouHook = guetterTrou;

    /*
     * LA MAIN DU PALIER (S73) : trois cartes de SORTES différentes, en plein
     * écran — un effet, et deux parmi une recrue, une amélioration, un
     * nouveau rôle, un stage de système. L'écran de saison n'en garde que le
     * dos et « Voir la main ». `lireMain` l'ouvre, lit les cartes et la
     * referme : c'est « Plus tard », et l'offre doit tenir.
     */
    const lireMain = async () => {
      // Un choix forcé passe devant le palier (S74b) : on y répond d'abord.
      if (!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"]'))) await repondreAuxChoix();
      if (!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"]'))) await _click('#hubModal .hub-main-ouvrir');
      await _wait('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] .tc', { timeout: 5000 });
      const main = await page.$$eval('#choixModal .tc', e => e.map(x => x.dataset.choix));
      await _click('#choixModal .choix-plus-tard');
      await page.waitForTimeout(200);
      return main;
    };
    const versPalier = async () => {
      // HUIT CLICS NE SUFFISENT PLUS : l'avance s'arrête aussi aux fenêtres
      // de situations (journées 10, 28, 46, 64) et aux cases vides, en plus
      // des blessures. Le budget suit le nombre d'interruptions possibles.
      for (let i = 0; i < 16 && !(await page.$('#hubModal .hub-main-ouvrir')); i++) {
        await page.click('#hubModal .hub-prochaine');
        await page.waitForTimeout(250);
        await guetterTrou();
      }
      if (!(await page.$('#hubModal .hub-main-ouvrir'))) return [];
      return lireMain();
    };
    const offertesMain = await versPalier();
    const sorte = c => c.split(':')[0];
    const offertes = offertesMain.filter(c => sorte(c) === 'effet').map(c => c.split(':')[1]);
    if (offertesMain.length !== 3) errors.push(`le palier offre une main de ${offertesMain.length} cartes au lieu de trois`);
    else if (new Set(offertesMain.map(sorte)).size !== 3) errors.push(`la main du palier répète une sorte : ${offertesMain.join(' · ')}`);
    else if (offertes.length !== 1) errors.push(`la main du palier n'a pas exactement une carte d'effet : ${offertesMain.join(' · ')}`);
    else {
      const jPalier = await jourDit();
      /*
       * LE PALIER BLOQUE LA JOURNÉE (S78, la boîte de réception) : refermé
       * « Plus tard », il reste à traiter — « Journée suivante » devient
       * « À régler avant le match » et « Jusqu'à la prochaine décision » disparaît.
       */
      const bloque = await page.evaluate(() => ({
        traiter: !!document.querySelector('#hubModal .hub-traiter'),
        prochaine: !!document.querySelector('#hubModal .hub-prochaine'),
        jour: !!document.querySelector('#hubModal .hub-jour'),
      }));
      if (!bloque.traiter || bloque.prochaine || bloque.jour) errors.push(`le palier laissé de côté ne bloque pas la journée : ${JSON.stringify(bloque)}`);
      else console.log('   le palier laissé de côté bloque la journée : « Règle d\'abord », plus de « Jusqu\'à la prochaine décision »');
      // Reprendre l'offre laissée de côté : elle tient.
      const encore = await lireMain();
      if (JSON.stringify(encore) !== JSON.stringify(offertesMain)) errors.push(`la main du palier ne tient pas : ${offertesMain.join(' · ')} puis ${encore.join(' · ')}`);
      const jPrise = await jourDit();
      const pris = offertes[0];
      // La main du palier a pu s'ouvrir d'elle-même après un choix forcé (S74b).
      if (!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"]'))) await _click('#hubModal .hub-main-ouvrir');
      await _wait('#choixModal:not([hidden]) .tc', { timeout: 5000 });
      await _click(`#choixModal .tc[data-choix="effet:${pris}"]`);
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
      const dCarte = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisions || []; } catch { return []; } }))
        .filter(d => d.carte && typeof d.palier === 'number');
      if (dCarte.length !== 1 || dCarte[0].carte !== pris) errors.push(`la sauvegarde ne porte pas la carte prise au palier : ${JSON.stringify(dCarte)}`);
      // Le palier est la CLÉ de l'offre (20, 40, 60) ; l'en-tête peut l'avoir dépassé
      // quand un autre arrêt s'est glissé avant la main (S74) — la clé, elle, ne bouge pas.
      else if (![20, 40, 60].includes(dCarte[0].palier) || dCarte[0].palier > jPalier) errors.push(`la décision ne porte pas son palier : palier ${dCarte[0].palier}, main ouverte à la journée ${jPalier}`);
      if (await page.$('#hubModal .hub-main-ouvrir')) errors.push('le palier reste ouvert après qu\'on y a pris une carte');
      const suivantes = await versPalier();
      if (suivantes.length !== 3) errors.push(`le palier suivant offre ${suivantes.length} cartes au lieu de trois`);
      else if (suivantes.includes(`effet:${pris}`)) errors.push(`la carte « ${pris} », déjà prise, reparaît au palier suivant : ${suivantes.join(' · ')}`);
      else console.log(`   palier ${jPalier} : ${offertesMain.join(' · ')} → « ${pris} » prise au jour ${jPrise}, palier suivant ${suivantes.join(' · ')}`);
      /*
       * UNE CARTE DU DECK SE JOUE POUR VRAI (S73) : au palier suivant, on
       * prend la première carte qui n'est pas un effet, on fait son deuxième
       * choix (le joueur, le rôle, le système), et la décision entre dans la
       * sauvegarde avec son palier et sa sorte — sans rembobiner la saison.
       */
      const deck = suivantes.find(c => sorte(c) !== 'effet');
      if (deck) {
        await repondreAuxChoix();
        const jDeck = await jourDit();
        // La main du palier a pu s'ouvrir d'elle-même après un choix forcé (S74b).
        if (!(await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"]'))) await _click('#hubModal .hub-main-ouvrir');
        await _wait('#choixModal:not([hidden]) .tc', { timeout: 5000 });
        const off = await page.$eval(`#choixModal .tc[data-choix="${deck}"]`, b => b.disabled);
        if (off) console.log(`   la carte « ${deck} » est grisée ce palier-ci (personne à qui la donner)`);
        else {
          await _click(`#choixModal .tc[data-choix="${deck}"]`);
          // L'amélioration (S80) va droit à l'inventaire : pas de deuxième choix, le hub revient.
          await _wait('#choixModal:not([hidden]) :is(.choix-option, .aln-case), #hubModal .hub-jour', { timeout: 120000 });
          await page.waitForTimeout(300);
          const ouvert = !!(await page.$('#choixModal:not([hidden]) .choix-sheet'));
          const suite = ouvert ? ((await page.textContent('#choixModal .choix-titre')) || '').trim() : 'gardée dans l\'inventaire';
          const nb = ouvert ? await page.$$eval('#choixModal :is(.choix-option, .aln-case[data-aln]):not([disabled])', e => e.length) : 0;
          // L'atelier demande l'édition (S80 : elle se garde) ; la recrue, qui sort (dans l'alignement) : on fait chaque choix qui s'ouvre.
          for (let k = 0; k < 3; k++) {
            if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="alignement"]')) { await sortirDansAlignement(); await page.waitForTimeout(400); continue; }
            const o = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="palier"] :is(.tcj-signer, button.choix-option:not([disabled]))');
            if (!o || !(await o.isVisible())) break;
            await o.click();
            await page.waitForTimeout(400);
          }
          await page.waitForSelector('#hubModal .hub-jour', { timeout: 120000 });
          await page.waitForTimeout(400);
          const dDeck = (await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisions || []; } catch { return []; } }))
            .filter(d => d.deck === sorte(deck));
          const jApresDeck = await jourDit();
          if (!dDeck.length) errors.push(`la carte « ${deck} » n'entre pas dans la sauvegarde`);
          else if (typeof dDeck[0].palier !== 'number') errors.push(`la carte « ${deck} » ne porte pas son palier : ${JSON.stringify(dDeck[0])}`);
          else if (jApresDeck !== jDeck) errors.push(`jouer la carte « ${deck} » rembobine la saison : journée ${jDeck} puis ${jApresDeck}`);
          else if (await page.$('#hubModal .hub-main-ouvrir')) errors.push(`la main reste ouverte après la carte « ${deck} »`);
          else console.log(`   carte du deck « ${deck} » : ${suite}, ${nb} choix, décision ${JSON.stringify({ deck: dDeck[0].deck, palier: dDeck[0].palier, mutation: dDeck[0].mutation, garde: dDeck[0].garde, maitrise: dDeck[0].maitrise, ballottage: dDeck[0].ballottage && dDeck[0].ballottage.entre })}`);
          // S80 : l'amélioration (ou l'édition) gardée au palier attend dans l'inventaire, prête à poser au verso.
          if (dDeck.length && dDeck[0].garde) {
            await _click('#hubModal .hub-inventaire');
            await _wait('#inventaireModal:not([hidden]) .inv-onglet', { timeout: 10000 });
            if (!(await page.$(`#inventaireModal .bq-carte[data-id="${dDeck[0].garde}"] .inv-jouer`))) errors.push(`la carte « ${dDeck[0].garde} » gardée au palier n'est pas dans l'inventaire`);
            else console.log(`   « ${dDeck[0].garde} » attend dans l'inventaire`);
            await _click('#inventaireModal .choix-fermer');
            await page.waitForTimeout(300);
          }
        }
      }

      /*
       * TON HISTOIRE (S69) : à mi-saison, « Ma fiche » raconte la run en
       * actes — au moins les attentes du proprio, posées au premier jour.
       */
      if (etiquette === 'saison') {
        await repondreAuxChoix();
        await page.click('.navtab[data-page="calendrier"]');
        await page.waitForTimeout(250);
        const recit = await page.$$eval('#hubModal .recit .recit-ev', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
        const actes = await page.$$eval('#hubModal .recit .recit-acte-t', e => e.map(x => x.textContent.trim()));
        if (!recit.length || !recit.some(t => /proprio/i.test(t))) errors.push(`« Ma fiche » ne raconte pas la saison : ${recit.slice(0, 3).join(' | ') || 'rien'}`);
        else console.log(`   ton histoire : ${recit.length} moments en ${actes.length} acte(s) — ${recit.slice(0, 3).join(' | ')}`);
        await page.click('.navtab[data-page="match"]');
        await page.waitForTimeout(200);
      }

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
        // LA BARRE DU JEU (S67) : c'est elle qui ouvre les volets de la saison.
        const b = document.querySelector('#navbar');
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
    // Le palier est éprouvé : désormais, une main qui s'ouvre se joue (elle bloque la journée, S78).
    palierAuto = true;

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
    /*
     * La boucle part APRÈS le palier 40 : la prochaine fenêtre est au jour 46,
     * puis 64. Elle avance jusqu'à en voir une — pas douze clics fixes : un
     * « +10 » s'arrête à chaque choix (gros match, dilemme, récompense), et
     * douze arrêts ne passaient pas toujours le jour 46. Elle ne tenait avant
     * S74b que parce que le bandeau du jour 28 REVENAIT après chaque choix —
     * le défaut qu'on vient de corriger.
     */
    const trajet = [];   // les arrêts de la boucle, dits si la fenêtre ne vient pas
    const jourVu = async () => Number(((await page.textContent('#hubModal .live-match')) || '').replace(/\D+/g, ' ').trim().split(' ')[0]) || 0;
    // La paire se lit DÈS qu'elle paraît : une décision prise deux journées plus tard la range.
    const lireSitu = () => page.evaluate(() => {
      const el = document.querySelector('#hubModal .hub-situ:not(.hub-accident)');
      if (!el) return null;
      const bout = [...el.querySelectorAll('.hub-situ-bout')].map(b => ({
        sens: b.classList.contains('hub-situ-porte') ? 'porte' : b.classList.contains('hub-situ-pese') ? 'pese' : '?',
        nom: (b.querySelector('.hub-situ-nom') || {}).textContent || '',
        quoi: (b.querySelector('.hub-situ-quoi') || {}).textContent || '',
        mot: (b.querySelector('.hub-situ-mot') || {}).textContent || '',
      }));
      return { bout, large: el.scrollWidth > el.clientWidth + 1 };
    });
    /*
     * S80 : une fenêtre qui tombe un soir de gros match attend le lendemain
     * (64 → 65), et le gros match s'annonce deux journées d'avance — son
     * avant-match s'ouvre EN ROUTE. La boucle y répond (sinon elle piétine
     * derrière le choix) et va jusqu'au jour 70.
     */
    let situ = await lireSitu();
    for (let i = 0; i < 50 && !situ && (await jourVu()) <= 70; i++) {
      if (await page.$('#choixModal:not([hidden])')) { await repondreAuxChoix(); situ = await lireSitu(); if (situ) break; }
      if (await page.$('#hubModal .hub-prochaine')) await page.click('#hubModal .hub-prochaine');
      else if (await page.$('#hubModal .hub-traiter')) await page.click('#hubModal .hub-traiter');
      await page.waitForTimeout(260);
      situ = await lireSitu();
      trajet.push(await page.evaluate(() => {
        const j = (document.querySelector('#hubModal .live-match')?.textContent || '').replace(/\D+/g, ' ').trim().split(' ')[0];
        const c = document.querySelector('#choixModal:not([hidden]) .choix-titre')?.textContent;
        return `j${j}${document.querySelector('#hubModal .hub-situ:not(.hub-accident)') ? '·situ' : ''}${c ? `·« ${c} »` : ''}`;
      }));
      if (!situ) await guetterTrou();
    }
    if (!situ) errors.push(`aucune fenêtre de situations jusqu'au jour 70 : ${trajet.join(' → ')}`);
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
  // La fenêtre de situations peut tomber le soir d'un choix forcé : son plein
  // écran couvre la barre qu'on mesure juste après. On le règle d'abord, comme
  // un joueur (S74b — depuis que le bandeau ne revient plus après chaque
  // choix, la boucle s'arrête sur le soir même où il paraît).
  await repondreAuxChoix();

  /*
   * UNE SEULE BARRE D'ONGLETS, ET ELLE EST EN BAS. L'écran de saison portait
   * la sienne AU MILIEU de la feuille, entre les boutons et le volet ; la
   * barre du jeu, elle, est en bas — deux endroits pour le même geste. Ça se
   * mesure : la barre doit commencer SOUS le volet qu'elle commande.
   */
  {
    const ou = await page.evaluate(() => {
      // S67 : l'écran de saison n'a plus sa barre ; il est ANCRÉ au-dessus de
      // celle du jeu, qui reste visible et cliquable.
      const b = document.querySelector('#navbar'), v = document.querySelector('#hubModal .hub-sheet'), h = document.querySelector('#hubModal .hub-onglets');
      if (!b || !v) return null;
      const rb = b.getBoundingClientRect(), rv = v.getBoundingClientRect();
      const el = document.elementFromPoint(Math.round(rb.left + rb.width / 2), Math.round(rb.top + rb.height / 2));
      return { barre: Math.round(rb.top), volet: Math.round(rv.bottom), fond: Math.round(window.innerHeight - rb.bottom),
        seconde: !!h && h.getBoundingClientRect().height > 0, rail: window.innerWidth >= 1200, touchable: !!el && b.contains(el) };
    });
    if (!ou) errors.push("l'écran de saison n'a plus de barre d'onglets");
    else if (ou.seconde) errors.push("l'écran de saison porte encore sa propre barre d'onglets : il n'y en a qu'une, celle du jeu");
    else if (!ou.touchable) errors.push("l'écran de saison couvre la barre du jeu : elle ne se touche plus");
    else if (!ou.rail && ou.barre < ou.volet - 1) errors.push(`l'écran de saison passe sous la barre du jeu (${ou.volet} px contre ${ou.barre}) : il s'ancre au-dessus d'elle`);
    // Les DEUX bords comptent : une barre poussée SOUS l'écran donne un écart
    // négatif (le défaut de S55, −38 px), une barre qui décolle trop donne un
    // écart plus grand que le retrait voulu.
    else if (malPlacee(ou.fond)) errors.push(`la barre de l'écran de saison est à ${ou.fond} px du bas (retrait voulu ${FLOTTE})`);
    else console.log(`   une seule barre, celle du jeu : l'écran de saison finit à ${ou.volet} px, la barre commence à ${ou.barre} px, à ${ou.fond} px du bas`);
  }
  await page.click('.navtab[data-page="meneurs"]');
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
  await finirDirect(etiquette);
  /*
   * LE FIL RACONTE LES JEUX (S70) : les tirs sans danger sont cachés par
   * défaut, les arrêts dangereux et les beaux jeux défensifs se lisent, et
   * « Voir tous les tirs » montre le reste.
   */
  {
    const lire = () => page.evaluate(() => {
      const L = [...document.querySelectorAll('#liveModal .live-ligne')];
      const vu = e => getComputedStyle(e).display !== 'none';
      return {
        mineurs: L.filter(e => e.classList.contains('mineur')).length,
        mineursVus: L.filter(e => e.classList.contains('mineur') && vu(e)).length,
        jeux: L.filter(e => (e.classList.contains('danger') || e.classList.contains('defense')) && vu(e)).length,
      };
    });
    const avant = await lire();
    if (avant.mineursVus) errors.push(`${etiquette} : ${avant.mineursVus} tirs sans danger se voient dans le fil par défaut`);
    if (!avant.jeux) errors.push(`${etiquette} : le fil ne raconte aucun arrêt dangereux ni jeu défensif`);
    const bouton = await page.$('#liveModal .live-tous');
    if (!bouton) errors.push(`${etiquette} : le fil n'offre pas « Voir tous les tirs »`);
    else {
      await _click('#liveModal .live-tous');
      const tous = await lire();
      if (tous.mineursVus !== avant.mineurs) errors.push(`${etiquette} : « Voir tous les tirs » en montre ${tous.mineursVus} sur ${avant.mineurs}`);
      await _click('#liveModal .live-tous');
      console.log(`   le fil : ${avant.jeux} jeux racontés, ${avant.mineurs} tirs sans danger cachés — « Voir tous les tirs » les montre`);
    }
  }
  const fil = await page.$eval('#liveModal .live-feed', e => e.textContent);
  const xe = (fil.match(/\(\d+(?:er|e) but\)/) || ['aucun but'])[0];
  await page.click('#liveModal .live-suite');
  await page.waitForTimeout(150);
  await memesButs(`${etiquette}, le match vu en direct`);
  const apres = (await page.textContent('#hubModal .hub-head')).replace(/\s+/g, ' ').trim();
  console.log(`   match en direct : ${face} lignes de statistiques, ${xe} · puis ${apres}`);
  if (!face) errors.push(`${etiquette} : aucune statistique du match en direct`);
  await cliquerFin();
  await versLeBilan();
  await toujoursLesMemes();
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
      // La vraie saison se lit au RECTO de la carte (S78), sous sa légende, en six nombres.
      vraie: /vraie saison/i.test((m.querySelector('.fc-recto .fc-legende') || {}).textContent || '') && m.querySelectorAll('.fc-recto .fc-stat').length === 6,
    };
  });
  const titreJour = fiche.sections.some(t => /à ce jour/i.test(t));
  const vraie = fiche.vraie;
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
  const onglet = await page.$eval('#hubModal .hub-sheet', e => e.dataset.vue).catch(() => null);
  if (onglet !== 'equipes') errors.push(`${etiquette} : un code d'équipe n'ouvre pas l'onglet des équipes (onglet « ${onglet} »)`);
  else {
    const dansLeClub = await page.$$eval('#hubModal .hub-volet tbody tr', ls =>
      ls.filter(tr => tr.querySelector('td.nom') && !tr.querySelector('td.nom .lien-joueur')).length);
    if (dansLeClub) errors.push(`${etiquette} : ${dansLeClub} nom(s) muet(s) dans la feuille d'une équipe`);
  }
  await page.click('.navtab[data-page="meneurs"]');
  await page.waitForTimeout(100);
}

/*
 * LA SAISON NE SE SAUTE PLUS (S79). JP : *pas possible de sauter la saison,
 * mais possible de simuler jusqu'à la prochaine action forcée*. « Fin de
 * saison » est parti : on JOUE jusqu'au bilan, « Jusqu'à la prochaine
 * décision » après « Jusqu'à la prochaine décision », en réglant chaque
 * événement comme un joueur (`repondreAuxChoix`, `debloquer`).
 */
async function cliquerFin() {
  for (let i = 0; i < 200; i++) {
    await repondreAuxChoix();
    const suite = await page.$('#hubModal .hub-suite');
    if (suite && await suite.isVisible()) return;
    if (await page.$('.result .score') && await page.isVisible('.result .score')) return;
    const p = await page.$('#hubModal .hub-prochaine');
    if (p && await p.isVisible() && !(await p.isDisabled())) { await page.click('#hubModal .hub-prochaine'); continue; }
    const j = await page.$('#hubModal .hub-jour');
    if (j && await j.isVisible()) { await page.click('#hubModal .hub-jour'); continue; }
    await page.waitForTimeout(300);
  }
  errors.push('la saison ne va pas au bilan en 200 arrêts');
}
/* La saison jusqu'au bilan, sans rien regarder : ce qui sert à REJOUER
   jusqu'à se qualifier, où seul le classement final compte. */
async function finirVite() {
  await page.waitForSelector('#hubModal .hub-prochaine, #hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-sheet', { timeout: 90000 });
  await cliquerFin();
  await versLeBilan();
}
/*
 * LES SÉRIES NE SE SAUTENT PAS NON PLUS (S79) tant que ta série se joue :
 * « Passer à la fin » n'existe qu'éliminé. On joue match après match, ronde
 * après ronde, en réglant chaque choix, jusqu'au tableau.
 */
/* Les captures des écrans du jalon 2 (scripts/smoke-j2-*.png) : au téléphone, puis à 1440 px. */
async function deuxCaptures(nom, voir = null) {
  const vp = page.viewportSize();
  const montrer = () => (voir ? page.$eval(voir, e => e.scrollIntoView({ block: 'center' })).catch(() => {}) : null);
  await montrer();
  await page.screenshot({ path: `scripts/smoke-j2-${nom}-390.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await montrer();
  await page.screenshot({ path: `scripts/smoke-j2-${nom}-1440.png` });
  await page.setViewportSize(vp);
  await page.waitForTimeout(300);
}
async function finirSeries() {
  for (let i = 0; i < 300; i++) {
    await repondreAuxChoix();
    const suite = await page.$('#hubModal .hub-suite');
    if (suite && await suite.isVisible()) return;
    for (const sel of ['#hubModal .hub-fin', '#hubModal .hub-ronde', '#hubModal .hub-jour']) {
      const b = await page.$(sel);
      if (b && await b.isVisible() && !(await b.isDisabled())) { await page.click(sel); await page.waitForTimeout(200); break; }
    }
  }
  errors.push('les séries ne vont pas au tableau en 300 gestes');
}

if (enabled) {
  await page.click('#mainBtn');
  await traverserSaison('saison', true);
  const score = await page.textContent('.result .score');
  const rows = await page.$$eval('.rrow', r => r.length);
  console.log(`4. fiche ${score.trim()}, ${rows} rangées`);
  // LE CONSEIL DU BILAN CITE SES CHIFFRES (1.0, J2-18) : un nombre, jamais « regarde tes trois derniers trios ».
  {
    const conseil = ((await page.textContent('#resultHost .note').catch(() => '')) || '').trim();
    if (!/\d/.test(conseil) || /trois derniers trios|bât blesse/.test(conseil)) errors.push(`le conseil du bilan ne cite aucun chiffre : « ${conseil} »`);
    else console.log(`   le conseil du bilan : « ${conseil} »`);
    await deuxCaptures('bilan');
  }
  /*
   * L'ALBUM (S74) : la saison jouée y entre — ses 23 joueurs au cartable,
   * ses cartes de match (au moins celles du départ), sans déborder.
   */
  {
    await page.click('.navtab[data-page="historique"]');
    await page.waitForTimeout(300);
    await page.click('.lb-vues [data-vue="album"]');
    await page.waitForTimeout(400);
    const a = await page.evaluate(() => ({
      joueurs: document.querySelectorAll('.album-joueur').length,
      cartes: document.querySelectorAll('.album-carte').length,
      trous: document.querySelectorAll('.album-trou').length,
    }));
    if (a.joueurs < 20 || a.cartes < 1 || !a.trous) errors.push(`l'album ne dit pas la saison jouée : ${JSON.stringify(a)}`);
    else console.log(`   l'album : ${a.joueurs} joueurs au cartable, ${a.cartes} cartes eues, ${a.trous} à trouver`);
    await sansDebordement('l\'album');
    await page.click('.lb-vues [data-vue="saisons"]');
    await page.click('.navtab[data-page="match"]');
    await page.waitForTimeout(300);
  }
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
  await page.click('.navtab[data-page="meneurs"]');
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
      // `.eq-vraie-attente` est le mot de CHARGEMENT, et lui seul : une fiche
      // partielle porte aussi une note (« un gardien échangé hors du total »),
      // et la compter ici ferait rougir le test sur 23 % des clubs.
      await page.waitForFunction(() => {
        const g = document.getElementById('eqVraie');
        return g && !g.querySelector('.eq-vraie-attente');
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
          partielle: !cellules(document.getElementById('eqVraie')).some(c => c.startsWith('N ')),
          mot: !!(document.getElementById('eqVraie') || {}).querySelector?.('.eq-vraie-mot'),
          attente: !!(document.getElementById('eqVraie') || {}).querySelector?.('.eq-vraie-attente'),
        };
      });
      if (!club.vraie) errors.push(`la page d'un club ne porte pas sa vraie saison (${club.titre.trim()})`);
      // Une fiche à qui il manque un gardien échangé tait ses nuls : elle doit
      // alors DIRE pourquoi, jamais laisser un trou sans mot (`motDeClub`).
      if (club.partielle && !club.mot) errors.push("la vraie saison d'un club est partielle sans dire pourquoi");
      else if (club.attente) errors.push("la vraie saison d'un club reste en attente");
      if (!club.hr) errors.push("la page d'un club n'a pas son lien vers Hockey-Reference");
      if (!club.rangees) errors.push("la page d'un club ne montre aucun joueur");
      else console.log(`   un club s'ouvre : « ${club.titre} », ${club.rangees} rangées · vraie saison ${club.vraie} · lien externe`);
      await sansDebordement("la page d'une équipe");
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
    }
    await page.click('.navtab[data-page="match"]');
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
    // S67 : « La ligue » se lit sous le classement, dans le même onglet.
    const ong = await page.$('.navtab[data-page="classement"]');
    if (!ong) errors.push("l'onglet du classement n'existe pas au bilan");
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
    await page.click('.navtab[data-page="match"]');
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
    // LA MÊME BARRE QU'AU REPÊCHAGE (S67), entrée pour entrée, dans le même
    // ordre : c'est ce que « même organisation, peu importe le moment » veut dire.
    const ici = await page.$$eval('#navbar .navtab', e => e.map(x => x.dataset.page).join(' · '));
    if (barreAuRepechage && ici !== barreAuRepechage) errors.push(`la barre a changé depuis le repêchage : « ${barreAuRepechage} » puis « ${ici} »`);
    if (b.deborde) errors.push(`la barre du bas déborde la page de ${b.deborde} px : c'est LA BARRE qui défile, pas la page`);
    if (malPlacee(b.bas)) errors.push(`la barre du bas est à ${b.bas} px du bas (retrait voulu ${FLOTTE})`);
    console.log(`   la barre ne bouge pas : ${b.noms.join(' · ')} · ${b.defile ? 'elle défile' : 'elle tient'} · ${b.deborde} px de débordement`);
  }
  const hauteurs = {};
  for (const v of ['match', 'classement', 'calendrier', 'meneurs', 'alignement']) {
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
  await redimensionner('le bilan');
  await page.click('.navtab[data-page="match"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'scripts/smoke-result.png', fullPage: false });
  /*
   * ON DOIT ATTEINDRE LES SÉRIES. `smoke.mjs` tire au hasard, et c'est un
   * choix assumé — mais TOUT ce passage (le tableau, la reprise, la Coupe dans
   * l'historique) ne s'exécute pas si l'équipe rate les séries, et un test qui
   * saute en silence est aussi faux qu'un sélecteur qui ne matche rien.
   *
   * « Rejouer la saison » garde le même alignement et change les dés : on
   * rejoue jusqu'à se qualifier, au plus ESSAIS fois, et on ÉCHOUE si on n'y
   * arrive pas.
   *
   * ET CE GARDE-FOU A RELANCÉ LA MAUVAISE CHOSE PENDANT TROIS CHANTIERS (S64).
   * Le nombre d'essais est passé de 12 à 30 quand l'Action a rougi, sur le
   * calcul « une chance sur trois par reprise, donc trente échecs tombent une
   * fois sur dix mille ». Le calcul suppose que les reprises sont
   * indépendantes. Elles ne le sont pas : une reprise ne change que les DÉS,
   * et l'écart type d'une saison de 82 matchs vaut 4,5 victoires. Une équipe
   * repêchée à 25 victoires a besoin de seize de plus pour se classer — aucun
   * nombre de reprises ne le donne. L'Action a donc joué trente saisons de 25
   * victoires, soixante-dix secondes, et rougi à coup sûr : ce qui décide,
   * c'est le REPÊCHAGE, pas les dés.
   *
   * LA RÉPONSE EST DONC DANS `drafter`, ci-dessus : l'auto-draft lit la carte
   * (destination sans avertissement, puis le plus grand chiffre clé) au lieu
   * de signer la première abordable dans l'ordre du DOM. Mesuré sur 24
   * repêchages en Node : 39,7 victoires et 8 qualifications sur 24 avant,
   * 55,4 et 24 sur 24 après — et dans Chromium, 50-27-5, 51-29-2 et 60-21-1
   * sur trois exécutions, sans une seule reprise. Les reprises redeviennent ce
   * qu'elles doivent être — un filet pour une mauvaise soirée de dés, pas un
   * espoir de rattraper un mauvais repêchage — donc ESSAIS redescend à huit.
   *
   * Deux politiques de repêchage avaient été essayées avant et ÉCARTÉES, et la
   * sonde de S64 le confirme : le meilleur rapport points par million achète
   * des joueurs à 20 points pour 0,78 M$ (30,7 victoires, 2 qualifications sur
   * 24 — la PIRE des quatre), et le meilleur chiffre brut dépense le plafond
   * sur deux vedettes puis comble au plancher. Ce qui marche n'est pas de
   * chercher la valeur — le DOM ne la porte pas, et c'est voulu — c'est de ne
   * pas signer une carte que le jeu peint en rouge.
   */
  const ESSAIS = 8;
  let po = await page.$('#playoffsBtn'), essais = 0;
  while (!po && essais < ESSAIS) {
    essais++;
    await page.click('#replayBtn');
    await finirVite();
    po = await page.$('#playoffsBtn');
  }
  if (!po) errors.push(`l'équipe n'a pas atteint les séries en ${ESSAIS + 1} saisons : le passage des séries n'a PAS été éprouvé`);
  else if (essais) console.log(`   séries atteintes après ${essais} saison(s) rejouée(s)`);
  if (po) {
    await po.click();
    // L'écran des séries : un match de plus dans la ronde, le tableau, puis
    // le prochain match en direct, puis tout jusqu'à la Coupe.
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 20000 });
    /*
     * LE COMBAT DE BOSS (S69) : le rapport d'éclaireur est là, « Préparer le
     * round » change les lignes du prochain match seulement, et entre deux
     * rounds un ajustement forcé s'ouvre en plein écran.
     */
    {
      // Les enveloppes de clic et d'attente répondent aux choix forcés : on
      // compte les titres croisés depuis ici.
      const vusAvant = (choixVus.get('hub-dilemme') || []).length;
      if (!(await page.$('#hubModal .boss-eclaireur'))) errors.push('les séries ne montrent pas le rapport d\'éclaireur du boss');
      const dsDe = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisionsSeries || []; } catch { return []; } });
      const prep = await page.$('#hubModal .hub-preparer');
      if (!prep) errors.push('les séries n\'offrent pas « Préparer le match »');
      else {
        await prep.click();
        await page.waitForSelector('#lignesModal:not([hidden]) .gl-appliquer', { timeout: 5000 });
        await _click('#lignesModal [data-importance="haute"]').catch(() => {});
        await _click('#lignesModal .gl-appliquer');
        await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-traiter, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
        await page.waitForTimeout(400);
        const ds = await dsDe();
        if (!ds.some(d => Array.isArray(d.lignes) && d.match_no === 0)) errors.push(`la sauvegarde ne porte pas les lignes du round 1 : ${JSON.stringify(ds)}`);
      }
      await page.click('#hubModal .hub-jour');
      await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-suite, #hubModal .hub-ronde, #choixModal:not([hidden]) .choix-option', { timeout: 120000 });
      await page.waitForTimeout(400);
      await repondreAuxChoix();
      await page.waitForTimeout(400);
      const ds = await dsDe();
      const aj = ds.find(d => d.ajustement);
      // « Entre deux matchs » s'appelle « Avant le match N » depuis S76 : l'écran regarde le match qui vient.
      const entre = (choixVus.get('hub-dilemme') || []).slice(vusAvant).some(t => /Avant le match \d/.test(t));
      if (!entre) errors.push('aucun ajustement forcé « Avant le match » après le match 1');
      if (entre && !aj) errors.push(`l'ajustement choisi n'est pas sauvegardé : ${JSON.stringify(ds)}`);
      else if (aj) console.log(`   séries : lignes du match 1 et ajustement « ${aj.ajustement} » au match ${aj.match_no + 1}, ${ds.length} décision(s) de séries`);
    }
    await page.waitForSelector('#hubModal .hub-jour', { timeout: 20000 });
    await page.click('#hubModal .hub-jour');
    await page.waitForTimeout(300);
    await repondreAuxChoix();

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
        const d = JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif)) || '{}');
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

    await repondreAuxChoix();
    await page.click('.navtab[data-page="classement"]');
    const noeuds = await page.$$eval('#hubModal .bk-serie', l => l.length);
    await page.click('.navtab[data-page="match"]');
    await page.waitForTimeout(200);
    const regarder = await page.$('#hubModal .hub-regarder');
    let xe = 'pas de match à regarder';
    if (regarder) {
      await regarder.click();
      await page.waitForSelector('#liveModal .live-pause', { timeout: 20000 });
      await finirDirect('séries');
      const fil = await page.$eval('#liveModal .live-feed', e => e.textContent);
      xe = (fil.match(/\(\d+(?:er|e) but\)/) || ['aucun but'])[0];
      await page.click('#liveModal .live-suite');
      await page.waitForTimeout(150);
      await memesButs('séries, le match vu en direct', true);
    }
    /*
     * L'ADJOINT JOUE CETTE SÉRIE (1.0, J2-13) : la main qui s'ouvre lui est
     * confiée ; ses décisions portent `auto`, et la main du match d'après ne
     * s'ouvre plus. Sans main ouverte (série finie), il n'y a rien à confier.
     */
    {
      await page.waitForTimeout(400);
      const mainOuverte = await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="main"]');
      const adj = await page.$('#choixModal:not([hidden]) .main-adjoint');
      if (mainOuverte && !adj) errors.push('la main d\'un match de séries n\'offre pas « L\'adjoint joue cette série »');
      else if (adj) {
        await deuxCaptures('adjoint', '#choixModal .main-adjoint');
        await adj.click();
        await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-suite, #hubModal .hub-ronde', { timeout: 120000 });
        await page.waitForTimeout(600);
        const dsA = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisionsSeries || []; } catch { return []; } });
        const auto = dsA.filter(d => d.auto && d.main);
        if (!auto.length) errors.push(`l'adjoint n'a rien décidé : ${JSON.stringify(dsA.slice(-2))}`);
        else {
          const r0 = auto[0].ronde;
          let mainsAuto = 0;
          for (let i = 0; i < 8; i++) {
            const b = await page.$('#hubModal .hub-jour');
            if (!b || !(await b.isVisible()) || await page.$('#hubModal .hub-ronde')) break;
            if (await page.$('#choixModal:not([hidden]) .choix-sheet[data-genre="main"]')) { errors.push('une main s\'ouvre encore dans une série confiée à l\'adjoint'); break; }
            if (await page.$('#choixModal:not([hidden])')) break;
            await b.click();
            await page.waitForSelector('#hubModal .hub-jour, #hubModal .hub-suite, #hubModal .hub-ronde', { timeout: 120000 });
            await page.waitForTimeout(700);
            const dsB = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cap82_partie_' + (JSON.parse(localStorage.getItem('cap82_parties') || '{}').actif))).partie.decisionsSeries || []; } catch { return []; } });
            mainsAuto = dsB.filter(d => d.auto && d.ronde === r0 && d.main).length;
          }
          console.log(`   l'adjoint joue la série : ${mainsAuto || auto.length} main(s) décidée(s) par lui, « ${auto[0].main.jouees.join(', ') || 'rien'} » au premier match`);
        }
      }
    }
    await repondreAuxChoix();
    await finirSeries();
    await page.waitForSelector('#hubModal .hub-suite', { timeout: 10000 });
    await page.click('#hubModal .hub-suite');
    await page.waitForSelector('#playoffsSection .bk-serie', { timeout: 10000 });
    const series = await page.$$eval('#playoffsSection .bk-serie', l => l.length);
    console.log(`   séries : ${noeuds} nœuds au tableau en cours, ${xe}, ${series} séries au tableau final`);
    if (!series) errors.push('séries : aucun tableau final');
    // Les rondes pas encore nées (S79) s'y dessinent « à venir » : le tableau en cours a ses quinze places.
    if (!noeuds) errors.push('séries : le tableau en cours ne se dessine pas');

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
    // LA BARRE NE PERD RIEN (S67) : le vestiaire reste là, et il dit que le
    // repêchage est fini plutôt que de disparaître.
    if (!(await page.$('.navtab[data-page="repechage"]'))) errors.push("la barre a perdu l'onglet du vestiaire une fois la saison jouée");
    await page.click('.navtab[data-page="match"]');
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
await nouvelleSaison();
await page.waitForSelector('#partieModal .seg[data-opt="tirage"]', { state: 'visible', timeout: 10000 });
await page.click('#partieModal .seg[data-opt="tirage"] button[data-val="LOTO"]');
const armeLoto = await page.$eval('#partieModal .seg[data-opt="tirage"] button[data-val="LOTO"]', b => b.classList.contains('on'));
if (!armeLoto) errors.push('le tirage « Loto » ne se marque pas dans l\'écran Nouvelle partie');
await page.click('#npGo');
await passerIdentite();
await page.waitForSelector('#partieModal', { state: 'hidden', timeout: 30000 });
await page.waitForSelector('#rrL', { timeout: 30000 });
// L'identité choisie se lit dans la roulette, en une puce.
if (!(await page.$('.spin-identite'))) errors.push('l\'identité choisie ne se lit pas dans la roulette du loto');

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

/*
 * RANGER NE RECOMPOSE PAS LA MAIN (S71). JP : *pas reseed si joueur déplacé
 * dans la sélection des joueurs*. On signe un ailier au 3e trio (en visant sa
 * case), on lit la main de la première case vide — l'ailier gauche du 1er
 * trio —, puis on DÉPLACE l'ailier signé dans cette case-là : la main ne
 * doit pas changer d'un nom.
 */
{
  const nomsMain = async () => (await page.$$eval('.pcard .pcard-name', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | ');
  const cases = async () => { await page.click('.navtab[data-page="alignement"]'); await page.waitForTimeout(220); return page.$$('.slot'); };
  let s = await cases();
  if (s.length > 6) {
    await s[6].evaluate(el => el.click());
    await page.waitForTimeout(300);
    await page.click('.navtab[data-page="repechage"]');
    await page.waitForTimeout(250);
    const b = await page.$('.pcard .btn-sign:not([disabled])');
    if (!b) errors.push('aucun joueur signable pour éprouver le rangement');
    else {
      await b.click();
      await page.waitForTimeout(400);
      const avant = await nomsMain();
      s = await cases();
      await s[6].evaluate(el => el.click());
      await page.waitForTimeout(150);
      s = await page.$$('.slot');
      await s[0].evaluate(el => el.click());
      await page.waitForTimeout(300);
      await page.click('.navtab[data-page="repechage"]');
      await page.waitForTimeout(250);
      const apres = await nomsMain();
      if (!avant) errors.push('la main était vide avant le rangement');
      else if (avant !== apres) errors.push(`ranger un joueur recompose la main : « ${avant.slice(0, 60)} » puis « ${apres.slice(0, 60)} »`);
      else console.log(`   ranger ne recompose pas la main : un ailier déplacé au 1er trio, la même main de ${avant.split(' | ').length} joueurs`);
      await cases();
      const r = await page.$('.slot .slot-remove');
      if (r) { await r.evaluate(el => el.click()); await page.waitForTimeout(320); }
      await page.click('.navtab[data-page="repechage"]');
      await page.waitForTimeout(220);
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
await nouvelleSaison();
await page.waitForSelector('#partieModal .seg[data-opt="format"]', { state: 'visible', timeout: 10000 });
await page.click('#partieModal .seg[data-opt="format"] button[data-val="EXPRESS"]');
await page.click('#partieModal .seg[data-opt="tirage"] button[data-val="VESTIAIRE"]');
await page.click('#npGo');
await passerIdentite();
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

/*
 * LES CHOIX FORCÉS CROISÉS (S66). Le proprio s'ouvre au jour 0 et le premier
 * dilemme à la journée 14 : une saison traversée les voit forcément. Les
 * séquences dépendent des résultats, elles s'informent.
 */
console.log(`   ballottage : ${ballottage.mot || 'aucune offre croisée (il faut une blessure de quatre matchs et plus)'}`);
console.log(`   qui sort, dans l'alignement (S80) : ${alignementsVus.length ? `${alignementsVus.length} fois — « ${alignementsVus[0]} »` : 'pas croisé ce parcours-ci (il faut un ballottage ou une recrue)'}`);
// Un paquet dépend d'une victoire en gros match ou d'une série gagnée : on dit ce qu'on a ouvert.
console.log(`   paquets ouverts : ${paquetsVus.length ? paquetsVus.join(' · ') : 'aucun (pas de gros match gagné ni de série gagnée)'}`);
// LE SOMMAIRE DE LA JOURNÉE (S78) : après une avance où ton club a joué, avant le retour au hub.
console.log(`   sommaires de journée lus : ${sommairesVus} · paliers joués en passant : ${paliersJoues.join(' · ') || 'aucun'}`);
if (!sommairesVus) errors.push('aucun sommaire de journée après « Journée suivante », alors que ton club a joué');
console.log(`   deuxièmes entractes en direct : ${entractesVus.join(' · ') || 'aucun'} ; au fil des journées : ${(choixVus.get('hub-dilemme') || []).filter(t => /entracte/i.test(t)).length}`);
console.log(`   identités de départ prises : ${identitesVues.join(' · ') || 'aucune'}`);
console.log(`   mains de match jouées : ${mainsVues.length} (${mainsVues.slice(0, 6).join(" · ") || "aucune"}) · ${prepsVues} préparation(s) au dépistage`);
console.log(`   choix forcés croisés : ${[...choixVus].map(([k, v]) => `${k} ×${v.length} (${v.slice(0, 2).join(' · ')})`).join(' ; ') || 'aucun'}`);
if (!choixVus.has('hub-proprio')) errors.push('le proprio n\'a jamais fixé d\'objectif');
if (!choixVus.has('hub-dilemme')) errors.push('aucun dilemme croisé en traversant une saison');
if (actionsLNH) errors.push(`la version Web a demandé ${actionsLNH} photo(s) d'action à la LNH (elles viennent de img/actions)`);

console.log(`7. erreurs console : ${errors.length} (ressources externes non chargées : ${netErrors})`);
for (const e of errors) console.log('   ', e);
await browser.close();
process.exit((errors.length || signed < 23 || lotoSigned < 23 || expSigned < 6) ? 1 : 0);
