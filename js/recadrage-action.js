/*
 * LE RECADRAGE D'UNE PHOTO D'ACTION DE LA LNH (1.0). JP : *trouve des images,
 * pas juste des faces, si tu peux*.
 *
 * La LNH publie, pour la plupart des joueurs d'après 2005, une photo de match
 * en paysage (1296 × 729) : le joueur net, au milieu d'une foule et d'une
 * bande floues. JP : *je veux que le maximum de pixels de l'image y soient*.
 * On ne la RECADRE donc plus : on la garde entière, en 16:9, réduite. On y
 * trouve seulement le JOUEUR, par la netteté (le fond est flou, faible
 * profondeur de champ ; le joueur est ce qui porte les contours) : une carte
 * dont la fenêtre est plus étroite que la photo (4:3 au plus étroit) s'y
 * recentre par `fx`.
 *
 *   1. l'image réduite en gris (324 px de large), la force de ses contours en
 *      chaque point, moins le bruit de fond ;
 *   2. LE JOUEUR : par colonne, la somme de ces contours, le haut de l'image
 *      pesant plus que le bas (la tête et le chandail plutôt que la palette et
 *      les patins) ; la bande étroite (5:7) qui en garde le plus, avec une
 *      légère préférence pour le centre (c'est là que le photographe met le
 *      joueur), puis son barycentre : le milieu du joueur ;
 *   3. l'image ENTIÈRE (si elle n'est pas en 16:9, la plus grande fenêtre
 *      16:9 qu'elle contient, centrée sur lui) ; `fx`, la place du joueur
 *      dans l'image gardée, de 0 (à gauche) à 100 (à droite) ;
 *   4. ramenée à 854 × 480 en WebP.
 *
 * Elle rend aussi quatre MESURES de l'image entière, que la fabrication lit
 * pour écarter une vue d'aréna sans joueur (scripts/actions.mjs) : le contour
 * médian (une foule nette partout), la clarté du bas (des gradins sombres
 * sous la glace), la part de glace au centre, la part d'aplats.
 *
 * UNE SEULE IMPLÉMENTATION pour deux usages, comme js/recadrage.js :
 * `scripts/actions.mjs` (la version Web, recadrée une fois à la fabrication)
 * et `js/actions.js` (l'application Android, qui télécharge et recadre sur
 * l'appareil). La fonction ne lit AUCUNE variable extérieure : le script
 * l'injecte dans Chromium par son texte (`recadrerAction.toString()`).
 */
export async function recadrerAction(blob, { largeur = 854, hauteur = 480, qualite = 0.8 } = {}) {
  const img = await createImageBitmap(blob);
  const W = img.width, H = img.height;
  // 1. L'image réduite, en gris ; la force des contours, moins le fond.
  const w = Math.min(324, W), h = Math.max(8, Math.round(H * w / W));
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const gris = new Float32Array(w * h), sature = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const r = d[k * 4], v = d[k * 4 + 1], b = d[k * 4 + 2];
    gris[k] = 0.299 * r + 0.587 * v + 0.114 * b;
    sature[k] = Math.max(r, v, b) - Math.min(r, v, b);
  }
  const force = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      force[k] = Math.abs(gris[k + 1] - gris[k - 1]) + Math.abs(gris[k + w] - gris[k - w]);
    }
  }
  const tri = Float32Array.from(force).sort();
  let plat = 0;
  for (let k = 0; k < w * h; k++) if (force[k] < 6) plat++;
  let glace = 0, n = 0, bas = 0, nb = 0;
  for (let j = Math.floor(h * 0.35); j < Math.floor(h * 0.75); j++) {
    for (let i = Math.floor(w * 0.15); i < Math.floor(w * 0.85); i++) { n++; if (gris[j * w + i] > 170 && sature[j * w + i] < 45) glace++; }
  }
  for (let k = Math.floor(h * 0.88) * w; k < w * h; k++) { bas += gris[k]; nb++; }
  const r3 = v => Math.round(v * 1000) / 1000;
  const mesures = { contour: r3(tri[Math.floor(tri.length / 2)]), bas: r3(bas / nb), glace: r3(glace / n), plat: r3(plat / (w * h)) };
  const fond = tri[Math.floor(tri.length * 0.6)];
  for (let k = 0; k < w * h; k++) { const v = force[k] - fond; force[k] = v > 0 ? v * v : 0; }

  // 2. Le joueur : la bande 5:7 (un peu serrée en hauteur) qui garde le plus de contours ; le haut de l'image pèse plus.
  const bande = Math.min(w, Math.round(h * 0.9 * 5 / 7));
  const col = new Float32Array(w);
  for (let j = 0; j < h; j++) {
    const poids = 1.2 - 0.7 * (j / h);
    for (let i = 0; i < w; i++) col[i] += force[j * w + i] * poids;
  }
  const cumul = new Float32Array(w + 1);
  for (let i = 0; i < w; i++) cumul[i + 1] = cumul[i] + col[i];
  let meilleur = -1, gb = Math.round((w - bande) / 2);
  for (let g = 0; g + bande <= w; g++) {
    const dc = ((g + bande / 2) - w / 2) / (w / 2);
    const s = (cumul[g + bande] - cumul[g]) * (1 - 0.45 * dc * dc);
    if (s > meilleur) { meilleur = s; gb = g; }
  }
  // Le milieu du joueur : le barycentre de ce que la bande garde (pas le bord de la bande).
  let m = 0, mx = 0;
  for (let i = gb; i < gb + bande; i++) { m += col[i]; mx += col[i] * (i + 0.5); }
  const cx = m > 0 ? mx / m : gb + bande / 2;

  // 3. L'image gardée : entière en 16:9 ; sinon la plus grande fenêtre de ce format, centrée sur lui, le haut gardé.
  const e = W / w;
  let sl = W, sh = Math.round(W * hauteur / largeur);
  if (sh > H) { sh = H; sl = Math.round(H * largeur / hauteur); }
  if (H - sh <= 2) sh = H;   // l'écart d'un arrondi (1296 × 729 n'est pas tout à fait 854 × 480) : l'image entière
  if (W - sl <= 2) sl = W;
  const sx = Math.max(0, Math.min(W - sl, Math.round(cx * e - sl / 2))), sy = 0;
  const fx = Math.max(0, Math.min(100, Math.round((cx * e - sx) / sl * 100)));

  // 4. Ramenée au format de la carte.
  const out = new OffscreenCanvas(largeur, hauteur), o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  o.drawImage(img, sx, sy, sl, sh, 0, 0, largeur, hauteur);
  if (img.close) img.close();
  const webp = await out.convertToBlob({ type: 'image/webp', quality: qualite });
  return { webp, fenetre: [Math.round(sx), Math.round(sy), Math.round(sl), Math.round(sh)], fx, mesures };
}
