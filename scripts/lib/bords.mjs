/*
 * RIEN NE COLLE AU BORD (oct.). JP : *ma théorie, sur mobile, c'est que t'es mieux d'avoir un petit padding, que pas de
 * padding du tout*. À 390 px, un mot, un chiffre, une icône ou une carte (un cadre à coins ronds) tient à `MARGE` px au
 * moins des deux bords de l'écran. Une bande pleine largeur (l'en-tête, la barre, le fond d'une feuille) va bord à
 * bord, c'est son rôle : elle n'a ni texte collé ni coins ronds au bord. Une rangée qui défile de côté (les pastilles,
 * un carrousel de cartes) peut faire sortir ses éléments de l'écran ; seul compte celui qui s'arrête au bord sans en
 * sortir, puisque c'est lui qu'on lit collé.
 *
 * Seul compte ce qu'on voit : à l'écran, que rien ne couvre. Rend la liste des fautes, une par sélecteur, avec le
 * compte et le côté (« span.hub-msg-de à 2 px, gauche »).
 */
export const MARGE = 8;

export async function collesAuBord(page, { marge = MARGE } = {}) {
  return page.evaluate(marge => {
    const W = document.documentElement.clientWidth;
    const cache = el => !!el.closest('[hidden], [inert], details:not([open]) > :not(summary)')
      || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    // Un élément sous une feuille ou un voile ne se lit pas : son centre doit être à lui.
    const devant = (el, r) => {
      const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y = r.top + r.height / 2;
      if (y < 0 || y >= innerHeight) return false;
      const d = document.elementFromPoint(x, y);
      return !!d && (el.contains(d) || d.contains(el));
    };
    // Dans une rangée qui défile de côté (les pastilles, un tableau large), ce qui sort de sa boîte est voulu : on le lit
    // en la faisant défiler. C'est la boîte qui garde sa marge.
    const defile = (el, r) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (!/auto|scroll/.test(s.overflowX) || p.scrollWidth <= p.clientWidth + 1) continue;
        const b = p.getBoundingClientRect();
        if (r.left < b.left + 1 || r.right > b.right - 1) return true;
        // La carte qu'on aperçoit au bord d'un carrousel (la suivante) est coupée exprès : tout ce qu'elle porte aussi.
        const item = [...p.children].find(x => x.contains(el));
        const bi = item && item.getBoundingClientRect();
        return !!bi && (bi.left < b.left - 1 || bi.right > b.right + 1);
      }
      return false;
    };
    const nom = el => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')
      + (typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '');
    const fautes = new Map();
    const noter = (el, r) => {
      const g = r.left, d = W - r.right;
      if (g >= marge && d >= marge) return;
      if (r.right <= 0 || r.left >= W) return;
      if (defile(el, r)) return;
      const cote = g < marge ? 'gauche' : 'droite', px = Math.round(g < marge ? g : d);
      // La boîte qui déborde de l'écran, s'il y en a une : la plus haute dont le parent, lui, tient.
      let large = '';
      for (let p = el; p && p.parentElement && p !== document.body; p = p.parentElement) {
        const b = p.getBoundingClientRect(), bp = p.parentElement.getBoundingClientRect();
        if ((b.right > W + 0.5 || b.left < -0.5) && bp.right <= W + 0.5 && bp.left >= -0.5) large = ` dans ${nom(p)} de ${Math.round(b.width)} px`;
      }
      const k = `${nom(el)} ${cote}`, f = fautes.get(k);
      if (f) { f.n++; f.px = Math.min(f.px, px); } else fautes.set(k, { n: 1, px, large, txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) });
    };
    // Les mots et les chiffres : chaque ligne de texte, à sa vraie place.
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const range = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const el = n.parentElement;
      if (!el || cache(el)) continue;
      range.selectNodeContents(n);
      for (const r0 of range.getClientRects()) {
        // Ce qu'une boîte qui rogne (une ellipse, un `overflow: hidden`) cache ne se lit pas : seule compte la part visible.
        let g = r0.left, d = r0.right;
        for (let p = el; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).overflowX === 'visible') continue;
          const b = p.getBoundingClientRect();
          g = Math.max(g, b.left); d = Math.min(d, b.right);
        }
        const r = { left: g, right: d, top: r0.top, bottom: r0.bottom, width: d - g, height: r0.height };
        if (r.width > 0 && r.bottom > 0 && r.top < innerHeight && devant(el, r)) noter(el, r);
      }
    }
    // Les icônes, les visages, et les cartes : un cadre à coins ronds se lit comme un objet, il ne touche pas le bord.
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      const objet = /^(IMG|SVG|svg|CANVAS)$/.test(el.tagName) || (parseFloat(s.borderTopLeftRadius) > 0 && (parseFloat(s.borderLeftWidth) > 0 || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)));
      if (!objet || cache(el)) continue;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0) || r.bottom <= 0 || r.top >= innerHeight || r.width >= W - 1) continue;
      if (devant(el, r)) noter(el, r);
    }
    return [...fautes].map(([k, f]) => `${k} à ${f.px} px${f.n > 1 ? ` (×${f.n})` : ''}${f.txt ? ` « ${f.txt} »` : ''}${f.large}`);
  }, marge);
}
