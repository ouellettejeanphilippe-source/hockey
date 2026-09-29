/*
 * LE RECADRAGE D'UNE PHOTO D'ACTION DE LA LNH (1.0). JP : *trouve des images,
 * pas juste des faces, si tu peux*.
 *
 * La LNH publie, pour la plupart des joueurs d'après 2005, une photo de match
 * en paysage (1296 × 729) : le joueur net, au milieu d'une foule et d'une
 * bande floues. Une carte est en portrait (5:7). On y découpe donc une fenêtre
 * 5:7 centrée sur le JOUEUR, qu'on trouve par la netteté : le fond est flou
 * (faible profondeur de champ), le joueur est ce qui porte les contours.
 *
 *   1. l'image réduite en gris (324 px de large), la force de ses contours en
 *      chaque point, moins le bruit de fond ;
 *   2. par colonne, la somme de ces contours, le haut de l'image pesant plus
 *      que le bas (la tête et le chandail plutôt que la palette et les
 *      patins) : la fenêtre 5:7 qui en garde le plus, avec une légère
 *      préférence pour le centre (c'est là que le photographe met le joueur),
 *      puis recentrée sur le barycentre de ce qu'elle garde ;
 *   3. en hauteur, la fenêtre est un peu plus basse que l'image (on serre le
 *      joueur) : son haut s'arrête juste au-dessus du premier contour fort —
 *      on coupe les patins avant le casque ;
 *   4. la fenêtre, jamais hors de l'image, ramenée à 400 × 560 en WebP.
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
export async function recadrerAction(blob, { largeur = 400, hauteur = 560, qualite = 0.8, serre = 0.9 } = {}) {
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

  // 2. La fenêtre : sa hauteur (un peu serrée), sa largeur 5:7 ; le haut de l'image pèse plus.
  const ratio = largeur / hauteur;
  let fh = Math.min(h, Math.round(h * serre)), fl = Math.round(fh * ratio);
  if (fl > w) { fl = w; fh = Math.round(fl / ratio); }
  const col = new Float32Array(w);
  for (let j = 0; j < h; j++) {
    const poids = 1.2 - 0.7 * (j / h);
    for (let i = 0; i < w; i++) col[i] += force[j * w + i] * poids;
  }
  const cumul = new Float32Array(w + 1);
  for (let i = 0; i < w; i++) cumul[i + 1] = cumul[i] + col[i];
  let meilleur = -1, gx = Math.round((w - fl) / 2);
  for (let g = 0; g + fl <= w; g++) {
    const dc = ((g + fl / 2) - w / 2) / (w / 2);
    const s = (cumul[g + fl] - cumul[g]) * (1 - 0.45 * dc * dc);
    if (s > meilleur) { meilleur = s; gx = g; }
  }
  // Recentrée sur le barycentre de ce qu'elle garde (le joueur, pas le bord de sa fenêtre).
  let m = 0, mx = 0;
  for (let i = gx; i < gx + fl; i++) { m += col[i]; mx += col[i] * (i + 0.5); }
  if (m > 0) gx = Math.round(mx / m - fl / 2);
  gx = Math.max(0, Math.min(w - fl, gx));

  // 3. En hauteur : le haut juste au-dessus du premier contour fort, dans les colonnes gardées.
  let gy = 0;
  if (fh < h) {
    const rang = new Float32Array(h);
    let somme = 0;
    for (let j = 0; j < h; j++) { for (let i = gx; i < gx + fl; i++) rang[j] += force[j * w + i]; somme += rang[j]; }
    let haut = 0, acc = 0;
    while (haut < h - 1 && acc + rang[haut] < somme * 0.02) acc += rang[haut++];
    gy = Math.max(0, Math.min(h - fh, Math.round(haut - fh * 0.05)));
  }

  // 4. Dans l'image d'origine, jamais hors de ses bords.
  const e = W / w;
  const sl = Math.min(W, fl * e), sh = Math.min(H, fh * e);
  const sx = Math.max(0, Math.min(W - sl, gx * e)), sy = Math.max(0, Math.min(H - sh, gy * e));
  const out = new OffscreenCanvas(largeur, hauteur), o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  o.drawImage(img, sx, sy, sl, sh, 0, 0, largeur, hauteur);
  if (img.close) img.close();
  const webp = await out.convertToBlob({ type: 'image/webp', quality: qualite });
  return { webp, fenetre: [Math.round(sx), Math.round(sy), Math.round(sl), Math.round(sh)], mesures };
}
