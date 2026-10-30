/*
 * GLISSER-DÉPOSER (oct., JP : *ça devrait être drag and drop comme l'alignement, genre main de cartes*). Un seul geste pour
 * la souris et le doigt, délégué au document : la souris glisse dès qu'elle bouge ; le doigt, après un appui tenu
 * (`APPUI`), pour que balayer la page la fasse défiler comme avant. Pendant le geste, un fantôme de la carte suit le
 * pointeur et la cible dessous s'allume (`.survol`) ; lâchée sur une cible, `deposer(source, cible)` décide. Le toucher
 * qui suit un dépôt ne compte pas : le geste a déjà agi. Le toucher seul, le clavier et la manette passent par le clic,
 * comme partout.
 */
const APPUI = 260;   // ms : l'appui tenu du doigt avant que la carte se soulève
const SEUIL = 6;     // px : la souris glisse au-delà ; le doigt qui bouge avant l'appui fait défiler

export function glisserDeposer({ prise, cible, deposer }) {
  if (typeof document === 'undefined') return;
  let geste = null;
  const sous = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const c = el && el.closest(cible);
    return c && c !== geste.source ? c : null;
  };
  const allumer = c => {
    if (geste.cible === c) return;
    if (geste.cible) geste.cible.classList.remove('survol');
    geste.cible = c;
    if (c) c.classList.add('survol');
  };
  const soulever = () => {
    const r = geste.source.getBoundingClientRect();
    const f = geste.source.cloneNode(true);
    f.classList.add('fantome');
    f.removeAttribute('id');
    f.setAttribute('aria-hidden', 'true');
    f.style.width = `${r.width}px`;
    geste.dx = geste.x - r.left; geste.dy = geste.y - r.top;
    document.body.appendChild(f);
    geste.fantome = f;
    geste.source.classList.add('glisse');
    bouger(geste.x, geste.y);
    if (geste.doigt && navigator.vibrate) navigator.vibrate(12);
  };
  const bouger = (x, y) => {
    geste.fantome.style.left = `${x - geste.dx}px`;
    geste.fantome.style.top = `${y - geste.dy}px`;
    allumer(sous(x, y));
  };
  const finir = (lacher) => {
    if (!geste) return;
    const { source, fantome, cible: c, minuterie } = geste;
    clearTimeout(minuterie);
    if (fantome) {
      fantome.remove();
      source.classList.remove('glisse');
      if (c) c.classList.remove('survol');
      // Le clic qui suit le relâchement n'est pas un toucher : le geste a déjà agi (ou s'est annulé).
      const avaler = ev => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener('click', avaler, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', avaler, { capture: true }), 400);
    }
    geste = null;
    if (fantome && lacher && c) deposer(source, c);
  };
  document.addEventListener('pointerdown', ev => {
    if (geste || ev.button > 0) return;
    const source = ev.target.closest && ev.target.closest(prise);
    if (!source) return;
    const doigt = ev.pointerType !== 'mouse';
    geste = { source, doigt, x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, fantome: null, cible: null };
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
