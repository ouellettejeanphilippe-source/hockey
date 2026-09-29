/*
 * LE RECADRAGE D'UN PORTRAIT DE LA LNH (S78, sorti du script en 1.0).
 *
 * Les photos de la LNH (336 × 336) sont de trois familles : les vieilles photos
 * sur fond opaque, où la tête remplit le cadre (Lafleur, Lysiak) ; les
 * détourées d'une époque, tête large (Ribeiro) ; les détourées modernes, tête
 * petite au milieu d'un grand vide transparent (Zuccarello, McDavid). Sur une
 * photo détourée, on trouve la TÊTE par la transparence — le haut de la
 * silhouette, sa largeur dans le tiers du haut — et on recadre pour qu'elle
 * fasse toujours la même part du cadre, à la même hauteur ; une photo opaque,
 * déjà serrée sur le visage, garde son cadre.
 *
 * UNE SEULE IMPLÉMENTATION pour deux usages : `scripts/portraits.mjs` (la
 * version Web, recadrée une fois à la fabrication) et `js/visages.js`
 * (l'application Android, qui télécharge et recadre sur l'appareil). La
 * fonction ne lit AUCUNE variable extérieure : le script l'injecte dans
 * Chromium par son texte (`recadrer.toString()`).
 */
export async function recadrer(blob, { taille = 320, qualite = 0.85, partTete = 0.46, margeHaut = 0.09 } = {}) {
  const img = await createImageBitmap(blob);
  const W = img.width, H = img.height;
  const c = new OffscreenCanvas(W, H), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data;
  const a = (i, j) => d[(j * W + i) * 4 + 3];
  // Une photo détourée : ses coins du haut sont transparents.
  const detouree = a(2, 2) < 16 && a(W - 3, 2) < 16;
  let sx = 0, sy = 0, cote = Math.min(W, H), famille = 'opaque';
  if (detouree) {
    const rangs = [];
    for (let j = 0; j < H; j++) {
      let g = -1, dr = -1, n = 0;
      for (let i = 0; i < W; i++) if (a(i, j) > 40) { if (g < 0) g = i; dr = i; n++; }
      rangs.push(n > W * 0.015 ? { g, dr } : null);
    }
    const haut = rangs.findIndex(Boolean);
    let bas = H - 1; while (bas > haut && !rangs[bas]) bas--;
    if (haut >= 0) {
      // La tête : le tiers du haut de la silhouette (du crâne à la bouche).
      const fin = Math.round(haut + 0.30 * (bas - haut));
      let large = 0, somme = 0, k = 0;
      for (let j = haut; j <= fin; j++) { const r = rangs[j]; if (!r) continue; large = Math.max(large, r.dr - r.g); somme += (r.g + r.dr) / 2; k++; }
      if (large > 8 && k) {
        cote = large / partTete;
        sx = somme / k - cote / 2;
        sy = haut - margeHaut * cote;
        famille = 'detouree';
      }
    }
  }
  const out = new OffscreenCanvas(taille, taille), o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  const e = taille / cote;
  // L'image entière, placée : ce qui dépasse du cadre reste transparent (jamais d'étirement).
  o.drawImage(img, -sx * e, -sy * e, W * e, H * e);
  if (img.close) img.close();
  const webp = await out.convertToBlob({ type: 'image/webp', quality: qualite });
  return { webp, famille, cote: Math.round(cote) };
}
