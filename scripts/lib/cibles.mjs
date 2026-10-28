/*
 * LES CIBLES DE 44 PX (Jalon M, B5 ; docs/refonte-ui.md, règle 9 : *aucune cible sous 44 px*). Tout ce qu'un pouce
 * touche à l'écran — un bouton, un résumé de tiroir, un `[role=button]` — offre une zone de 44 × 44 au moins. La zone
 * est la boîte de l'élément, agrandie par son `::before` ou son `::after` quand l'un d'eux est posé en absolu autour
 * de lui (`inset` négatif) : c'est ainsi qu'une petite croix garde son dessin et gagne sa cible.
 *
 * Seul compte ce qu'un doigt atteint : le centre à l'écran, que rien ne couvre (une feuille ouverte cache le reste).
 * Rend la liste des fautes visibles à l'écran (« button.slot-remove 28×28 »), une par sélecteur, avec le compte.
 * `EXCEPTIONS` nomme ce qui n'est pas une cible au doigt, et pourquoi.
 */
export const CIBLE_MIN = 44;
export const EXCEPTIONS = [
  // Le nom dans une case des Lignes : la case entière est la cible (la toucher la choisit) ; agrandir le nom, qui
  // ouvre la fiche, volerait le geste de la case.
  '.slot .slot-name',
  // Un en-tête de colonne de chiffres (PJ, B, A) : 44 de haut, mais la colonne n'a que la largeur de ses chiffres ;
  // l'élargir pousserait le tableau hors de l'écran.
  '.jr-table th[data-tri]',
];

export async function ciblesTropPetites(page, { min = CIBLE_MIN, exceptions = EXCEPTIONS } = {}) {
  return page.evaluate(({ min, exceptions }) => {
    const vu = el => {
      if (el.closest('[hidden], [inert]')) return false;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || s.pointerEvents === 'none') return false;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return false;
      // Ce qu'un doigt atteint : son centre est à l'écran, et rien ne le couvre (une feuille, un voile).
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      const dessus = document.elementFromPoint(x, y);
      return !!dessus && el.contains(dessus);
    };
    // La zone d'un pseudo-élément posé en absolu autour de l'élément : ses `inset` négatifs l'agrandissent.
    const zone = el => {
      const r = el.getBoundingClientRect();
      let { top, left, right, bottom } = r;
      // Un élément qui rogne (overflow) rogne aussi son pseudo-élément : la zone ne grandit pas.
      if (getComputedStyle(el).overflow !== 'visible') return { w: r.width, h: r.height };
      for (const ps of ['::before', '::after']) {
        const s = getComputedStyle(el, ps);
        if (s.content === 'none' || s.position !== 'absolute') continue;
        const px = v => (/px$/.test(v) ? parseFloat(v) : 0);
        top = Math.min(top, r.top + px(s.top)); left = Math.min(left, r.left + px(s.left));
        right = Math.max(right, r.right - px(s.right)); bottom = Math.max(bottom, r.bottom - px(s.bottom));
      }
      return { w: right - left, h: bottom - top };
    };
    const nom = el => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')
      + (typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '');
    const fautes = new Map();
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (!vu(el) || exceptions.some(x => el.matches(x) || el.closest(x))) continue;
      const z = zone(el);
      if (z.w + 0.5 >= min && z.h + 0.5 >= min) continue;
      const k = nom(el), f = fautes.get(k);
      if (f) f.n++; else fautes.set(k, { n: 1, w: Math.round(z.w), h: Math.round(z.h), txt: (el.textContent || '').trim().slice(0, 24) });
    }
    return [...fautes].map(([k, f]) => `${k} ${f.w}×${f.h}${f.n > 1 ? ` (×${f.n})` : ''}${f.txt ? ` « ${f.txt} »` : ''}`);
  }, { min, exceptions });
}
