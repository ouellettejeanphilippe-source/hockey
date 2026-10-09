/*
 * LA PILE D'UN PAQUET, TRAVERSÉE COMME UN JOUEUR (1.0, oct. ; js/gerant.js `brancherPaquet`). Le paquet se
 * touche (il FLOTTE, une animation continue : `force`), puis chaque carte du dessus se passe d'un geste — tour à
 * tour glissée à la souris, touchée, et → au clavier — jusqu'à la bande des choix (`paquet-fini`). `tout` : au
 * lieu d'aller au bout, « Tout voir » après la première carte. `surAnnonce` : appelé quand le walkout a posé son
 * dernier temps (l'écusson), avant qu'un toucher le saute. `surCarte(i)` : appelé une fois la carte i retournée.
 *
 * Rend { ouvert, vues : [{ cle, largeur }] dans l'ordre de la pile, choix : les clés de la bande au bout,
 * annonce : un walkout a passé, fini }. `largeur` est la largeur de mise en page (offsetWidth : sans le
 * retournement en cours) de la carte du dessus.
 */
const DESSUS = '#choixModal .choix-sheet.paquet-pile .choix-main > [data-pile="0"]';
const GESTES = ['glisse', 'touche', 'clavier'];
export async function traverserPaquet(page, { tout = false, delai = 120, surAnnonce = null, surCarte = null } = {}) {
  const p = await page.$('#choixModal:not([hidden]) .paquet');
  const ouvert = !!(p && await p.isVisible());
  if (ouvert) await page.click('#choixModal .paquet', { force: true });
  const etat = () => page.evaluate(() => {
    const f = document.querySelector('#choixModal:not([hidden]) .choix-sheet');
    return !f ? 'aucun' : f.classList.contains('paquet-fini') ? 'fini' : f.classList.contains('paquet-pile') ? 'pile' : 'autre';
  });
  await page.waitForFunction(() => !!document.querySelector('#choixModal .choix-sheet:is(.paquet-pile, .paquet-fini)') || !document.querySelector('#choixModal:not([hidden])'), null, { timeout: 5000 }).catch(() => {});
  const vues = [];
  let annonce = false;
  for (let i = 0; i < 200 && (await etat()) === 'pile'; i++) {
    // L'annonce (le walkout) passe devant la carte du pack : un toucher la saute, la carte reste à voir.
    if (await page.$('#choixModal .walkout')) {
      if (!annonce && surAnnonce && await page.waitForSelector('#choixModal .walkout[data-pas="3"]', { timeout: 2600 }).catch(() => null)) await surAnnonce();
      annonce = true;
      await page.click('#choixModal .choix-tete');
      await page.waitForTimeout(delai);
      continue;
    }
    const dessus = await page.$(DESSUS);
    const lu = dessus ? await dessus.evaluate(el => ({ cle: el.dataset.choix || el.dataset.apercu || '', largeur: el.offsetWidth })) : null;
    if (lu && (!vues.length || vues[vues.length - 1].cle !== lu.cle)) {
      vues.push(lu);
      if (surCarte) { await page.waitForTimeout(700); await surCarte(vues.length - 1); }
    }
    if (tout && vues.length) { await page.click('#choixModal .pile-tout'); break; }
    const geste = GESTES[i % GESTES.length];
    const b = geste === 'glisse' && dessus ? await dessus.boundingBox() : null;
    if (b) {
      const y = b.y + Math.min(b.height / 2, 200);
      await page.mouse.move(b.x + b.width / 2, y);
      await page.mouse.down();
      for (let k = 1; k <= 6; k++) await page.mouse.move(b.x + b.width / 2 - k * 25, y);
      await page.mouse.up();
    } else if (geste === 'clavier') await page.keyboard.press('ArrowRight');
    else await page.click('#choixModal .choix-tete');
    await page.waitForTimeout(delai);
  }
  await page.waitForSelector('#choixModal .choix-sheet.paquet-fini', { timeout: 8000 }).catch(() => {});
  const choix = await page.$$eval('#choixModal .choix-main > .choix-option.tc', els => els.map(el => el.dataset.choix || el.dataset.apercu || '')).catch(() => []);
  return { ouvert, vues, choix, annonce, tout, fini: (await etat()) === 'fini' };
}

/* Ce qu'une traversée doit prouver : toutes les cartes vues (ou, après « Tout voir », dans la bande), assez grandes (80 % de la largeur d'un téléphone de 390 px ; plus large, la carte ne grandit plus que jusqu'à 360 px), et les mêmes dans la bande. Rend les fautes. */
export function fautesDePile({ vues, choix, tout, fini }, largeurEcran = 390) {
  const fautes = [];
  if (!fini) fautes.push('la pile ne mène pas à la bande des choix');
  // « Tout voir » saute le reste : ce qu'on a vu est dans la bande.
  if (tout) return vues.every(v => choix.includes(v.cle)) ? fautes : [...fautes, 'une carte vue dans la pile manque à la bande'];
  if (vues.length !== choix.length) fautes.push(`la pile montre ${vues.length} cartes, la bande ${choix.length}`);
  const etroite = vues.find(v => v.largeur < 0.8 * Math.min(largeurEcran, 390));
  if (etroite) fautes.push(`une carte de la pile fait ${etroite.largeur} px de large à ${largeurEcran} px (80 % au moins)`);
  if (vues.map(v => v.cle).sort().join('|') !== [...choix].sort().join('|')) fautes.push(`la pile et la bande n'ont pas les mêmes cartes : ${vues.map(v => v.cle).join(',')} / ${choix.join(',')}`);
  return fautes;
}
