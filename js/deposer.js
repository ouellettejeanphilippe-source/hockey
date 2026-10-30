/*
 * GLISSER-DÉPOSER (oct., JP : *ça devrait être drag and drop comme l'alignement, genre main de cartes*). Un seul geste pour
 * la souris et le doigt, délégué au document : la souris glisse dès qu'elle bouge ; le doigt, après un appui tenu
 * (`APPUI`), pour que balayer la page la fasse défiler comme avant. Pendant le geste, un fantôme de la carte suit le
 * pointeur et la cible dessous s'allume (`.survol`, ou `.refus` quand `permis` dit non) ; lâchée sur une cible,
 * `deposer(source, cible)` décide. Le toucher qui suit un dépôt ne compte pas : le geste a déjà agi. Le toucher seul, le
 * clavier et la manette passent par le clic, comme partout.
 *
 * LE GESTE VA OÙ L'ÉCRAN NE TIENT PAS (oct., JP : *drag and drop les cartes, navigation plus fluide sur mobile*). Près du
 * haut ou du bas de ce qui défile, la liste défile sous la carte (`BORD`) ; tenue sur un onglet de `passe` (Attaque,
 * Défense, Filet · réserve), la carte l'ouvre (`PASSE`) : un attaquant se porte en réserve sans lâcher. Une carte soulevée
 * le dit au document (`carte-soulevee`) : le balayage d'onglet de js/glisser.js ne prend pas ce geste-là. L'onglet
 * s'ouvre par `ouvrir` (un toucher, par défaut) : un écran qui se redessine au toucher passe une façon qui ne remplace
 * pas la carte qu'on porte.
 */
const APPUI = 260;   // ms : l'appui tenu du doigt avant que la carte se soulève
const SEUIL = 6;     // px : la souris glisse au-delà ; le doigt qui bouge avant l'appui fait défiler
const BORD = 56;     // px : à moins de ça du bord de ce qui défile, la liste défile sous la carte
const VITESSE = 14;  // px par image, au ras du bord
const PASSE = 420;   // ms : tenue sur un onglet, la carte l'ouvre

/* Ce qui défile en hauteur autour d'un élément, sinon la page. */
function defilant(el) {
  for (let x = el; x && x !== document.body; x = x.parentElement) {
    if (x.scrollHeight > x.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(x).overflowY)) return x;
  }
  return document.scrollingElement || document.documentElement;
}

export function glisserDeposer({ prise, cible, deposer, permis = () => true, fantome = el => el, passe = null, ouvrir = o => o.click() }) {
  if (typeof document === 'undefined') return;
  let geste = null;
  const sous = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const c = el && el.closest(cible);
    return c && c !== geste.source ? c : null;
  };
  const allumer = c => {
    if (geste.cible === c) return;
    if (geste.cible) geste.cible.classList.remove('survol', 'refus');
    geste.cible = c;
    if (c) c.classList.add(permis(geste.source, c) ? 'survol' : 'refus');
  };
  // L'onglet sous la carte : tenue assez longtemps dessus, elle l'ouvre, une fois.
  const viser = (x, y) => {
    if (!passe) return;
    const el = document.elementFromPoint(x, y);
    const o = el && el.closest(passe);
    if (o === geste.onglet) return;
    clearTimeout(geste.minOnglet);
    geste.onglet = o;
    if (o && !o.classList.contains('on') && o.getAttribute('aria-selected') !== 'true') {
      geste.minOnglet = setTimeout(() => {
        if (!geste || geste.onglet !== o) return;
        ouvrir(o);
        if (geste.doigt && navigator.vibrate) navigator.vibrate(8);
      }, PASSE);
    }
  };
  // Le défilement au bord : une image à la fois tant que la carte y reste.
  const defiler = () => {
    if (!geste || !geste.fantome) return;
    const zone = geste.zone, r = zone === document.scrollingElement ? { top: 0, bottom: innerHeight } : zone.getBoundingClientRect();
    const haut = Math.max(r.top, 0), bas = Math.min(r.bottom, innerHeight);
    const v = geste.y < haut + BORD ? -VITESSE * (1 - Math.max(0, geste.y - haut) / BORD)
      : geste.y > bas - BORD ? VITESSE * (1 - Math.max(0, bas - geste.y) / BORD) : 0;
    if (v) { zone.scrollTop += v; allumer(sous(geste.x, geste.y)); }
    geste.raf = requestAnimationFrame(defiler);
  };
  const soulever = () => {
    const modele = fantome(geste.source), r = modele.getBoundingClientRect();
    const f = modele.cloneNode(true);
    f.classList.add('fantome');
    f.removeAttribute('id');
    f.setAttribute('aria-hidden', 'true');
    f.style.width = `${r.width}px`;
    geste.dx = geste.x - r.left; geste.dy = geste.y - r.top;
    document.body.appendChild(f);
    geste.fantome = f;
    geste.zone = defilant(geste.source);
    geste.source.classList.add('glisse');
    // Le document garde le pointeur : si la case sous le doigt se redessine, le geste ne se perd pas avec elle.
    try { document.documentElement.setPointerCapture(geste.id); } catch { /* le pointeur est déjà parti */ }
    document.dispatchEvent(new Event('carte-soulevee'));
    bouger(geste.x, geste.y);
    geste.raf = requestAnimationFrame(defiler);
    if (geste.doigt && navigator.vibrate) navigator.vibrate(12);
  };
  const bouger = (x, y) => {
    geste.fantome.style.left = `${x - geste.dx}px`;
    geste.fantome.style.top = `${y - geste.dy}px`;
    allumer(sous(x, y));
    viser(x, y);
  };
  const finir = (lacher) => {
    if (!geste) return;
    const { source, fantome: f, cible: c, minuterie, minOnglet, raf } = geste;
    clearTimeout(minuterie);
    clearTimeout(minOnglet);
    cancelAnimationFrame(raf);
    if (f) {
      f.remove();
      source.classList.remove('glisse');
      if (c) c.classList.remove('survol', 'refus');
      // Le clic qui suit le relâchement n'est pas un toucher : le geste a déjà agi (ou s'est annulé).
      const avaler = ev => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener('click', avaler, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', avaler, { capture: true }), 400);
    }
    geste = null;
    if (f && lacher && c) deposer(source, c);
  };
  document.addEventListener('pointerdown', ev => {
    if (geste || ev.button > 0) return;
    const source = ev.target.closest && ev.target.closest(prise);
    if (!source) return;
    const doigt = ev.pointerType !== 'mouse';
    geste = { source, doigt, id: ev.pointerId, x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, fantome: null, cible: null, onglet: null };
    if (doigt) geste.minuterie = setTimeout(() => { if (geste && !geste.fantome) soulever(); }, APPUI);
  });
  document.addEventListener('pointermove', ev => {
    if (!geste) return;
    geste.x = ev.clientX; geste.y = ev.clientY;
    if (geste.fantome) { bouger(ev.clientX, ev.clientY); return; }
    const loin = Math.hypot(ev.clientX - geste.x0, ev.clientY - geste.y0) > SEUIL;
    if (!loin) return;
    if (geste.doigt) finir(false); else soulever();
  });
  // Le doigt qui porte une carte ne fait pas défiler la page.
  document.addEventListener('touchmove', ev => { if (geste && geste.fantome) ev.preventDefault(); }, { passive: false });
  document.addEventListener('pointerup', () => finir(true));
  document.addEventListener('pointercancel', () => finir(false));
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && geste) finir(false); });
  // L'appui tenu ne doit pas ouvrir le menu du navigateur sur la carte.
  document.addEventListener('contextmenu', ev => { if (ev.target.closest && ev.target.closest(prise)) ev.preventDefault(); });
}
