/*
 * L'APERÇU D'UNE PLANCHE DE SPRITES (Sur glace) : son format, sa légende, sa vérification et son image PNG, pour
 * scripts/sprites/rendu.mjs. Une planche : { [direction]: { [pose]: [HAUTEUR lignes de LARGEUR lettres] } } ; chaque
 * lettre est une couleur de la LÉGENDE (la couleur du club se substitue dans le jeu), '.' est transparent.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

export const LARGEUR = 32, HAUTEUR = 48, ANCRE = [16, 32];
const LEGENDE = {
  '.': null,
  k: '#101014',   // contour
  J: '#f47b20', j: '#ff9f4d', d: '#b8551a',   // le chandail : la couleur du club, claire, foncée (changée par club dans le jeu)
  T: '#1c2b5a',   // la bande (épaules, ourlet, poignets) : la 2e couleur du club
  W: '#f4f4f4',   // le masque du gardien, les blancs
  S: '#e8c39e', s: '#c49672',   // la peau et son ombre
  H: '#86440f', h: '#b86a2c',   // le casque et son reflet (la couleur du club, assombrie)
  P: '#1f2230', p: '#343a4e',   // le pantalon et son reflet
  G: '#2a2d35',   // les gants
  K: '#15161c', L: '#d7dde6',   // le patin, la lame
  B: '#c8903c', b: '#111111',   // le manche du bâton, le ruban noir de la lame
  Q: '#f4f6f8', q: '#c4c9d2',   // les jambières du gardien, leur ombre
  o: '#9fb0c2',   // un pixel d'ombre au sol (tramé)
};
const GLACE = '#dfe9f1';
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = buf => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* Vérifie une planche : chaque image fait LARGEUR × HAUTEUR, chaque lettre est connue. Rend la liste des erreurs. */
export function verifier(planche) {
  const erreurs = [];
  for (const [dir, poses] of Object.entries(planche)) for (const [pose, lignes] of Object.entries(poses)) {
    if (!Array.isArray(lignes) || lignes.length !== HAUTEUR) { erreurs.push(`${dir}/${pose} : ${Array.isArray(lignes) ? lignes.length : '?'} lignes au lieu de ${HAUTEUR}`); continue; }
    lignes.forEach((l, y) => {
      if (l.length !== LARGEUR) erreurs.push(`${dir}/${pose} ligne ${y} : ${l.length} caractères au lieu de ${LARGEUR}`);
      for (const ch of l) if (!(ch in LEGENDE)) erreurs.push(`${dir}/${pose} ligne ${y} : lettre inconnue « ${ch} »`);
    });
  }
  return erreurs;
}

/* La planche en image : chaque direction sur une rangée, chaque pose dans une colonne, agrandie sans flou, sur la glace. */
export function apercu(PLANCHE, sortie, E = 6) {
  const marge = 4;
  const dirs = Object.keys(PLANCHE);
  const poses = [...new Set(dirs.flatMap(d => Object.keys(PLANCHE[d])))];
  const W = (LARGEUR * E + marge) * poses.length + marge, H = (HAUTEUR * E + marge) * dirs.length + marge;
  const rgb = Buffer.alloc(W * H * 3);
  const [gr, gg, gb] = hex(GLACE);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = gr; rgb[i * 3 + 1] = gg; rgb[i * 3 + 2] = gb; }
  const point = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; rgb[i] = c[0]; rgb[i + 1] = c[1]; rgb[i + 2] = c[2]; };
  dirs.forEach((d, r) => poses.forEach((p, c) => {
    const lignes = PLANCHE[d][p];
    const x0 = marge + c * (LARGEUR * E + marge), y0 = marge + r * (HAUTEUR * E + marge);
    // le cadre, le repère des patins (croix)
    for (let x = 0; x < LARGEUR * E; x++) { point(x0 + x, y0, [200, 210, 220]); point(x0 + x, y0 + HAUTEUR * E - 1, [200, 210, 220]); }
    for (let y = 0; y < HAUTEUR * E; y++) { point(x0, y0 + y, [200, 210, 220]); point(x0 + LARGEUR * E - 1, y0 + y, [200, 210, 220]); }
    if (lignes) lignes.forEach((l, y) => [...l].forEach((ch, x) => { const col = LEGENDE[ch]; if (!col) return; const cc = hex(col); for (let dy = 0; dy < E; dy++) for (let dx = 0; dx < E; dx++) point(x0 + x * E + dx, y0 + y * E + dy, cc); }));
    const ax = x0 + ANCRE[0] * E + E / 2, ay = y0 + ANCRE[1] * E + E / 2;
    for (let t = -E; t <= E; t++) { point(Math.round(ax + t), Math.round(ay), [220, 40, 40]); point(Math.round(ax), Math.round(ay + t), [220, 40, 40]); }
  }));
  fs.writeFileSync(sortie, png(W, H, rgb));
}
