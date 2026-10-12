/**
 * Les émojis du jeu et les polices qui les rendent au trait (scripts/emojis.mjs les refait, check_emojis les juge).
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { lireSources } from './mort.mjs';

/* Les pictogrammes que le jeu écrit vraiment : js/, data/ et index.html, commentaires exclus. */
export function pictogrammesDuJeu(racine) {
  const { code } = lireSources(racine);
  const txt = Object.entries(code).filter(([f]) => f.startsWith('js/') || f.startsWith('data/') || f === 'index.html').map(([, c]) => c).join('\n');
  return new Set(txt.match(/\p{Extended_Pictographic}/gu) || []);
}

/* Les séquences liées (🧑‍💼, 😵‍💫) : une tranche doit les porter entières, sinon le navigateur les coupe ou les colore. */
export function sequencesDuJeu(racine) {
  const { code } = lireSources(racine);
  const txt = Object.entries(code).filter(([f]) => f.startsWith('js/') || f.startsWith('data/') || f === 'index.html').map(([, c]) => c).join('\n');
  return new Set(txt.match(/\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)+/gu) || []);
}

/*
 * LA TABLE cmap D'UN WOFF2, sans dépendance. Le flux des tables est compressé en brotli (zlib le lit) ; seules `glyf`
 * et `loca` y sont transformées, et cmap jamais. On saute les tables qui la précèdent, puis on lit son format 12
 * (ou 4) : les points de code que la police dessine.
 */
const GLYF = 10, LOCA = 11, CMAP = 0;
export function cmapWoff2(fichier) {
  const b = fs.readFileSync(fichier);
  if (b.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${fichier} : pas un WOFF2`);
  const nTables = b.readUInt16BE(12), compresse = b.readUInt32BE(20);
  let o = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const x = b[o++]; v = v * 128 + (x & 0x7f); if (!(x & 0x80)) return v; } throw new Error('UIntBase128'); };
  const tables = [];
  for (let i = 0; i < nTables; i++) {
    const drapeau = b[o++], index = drapeau & 0x3f, transfo = drapeau >> 6;
    if (index === 0x3f) o += 4;
    const longueur = base128();
    const transformee = index === GLYF || index === LOCA ? transfo === 0 : transfo !== 0;
    tables.push({ index, longueur: transformee ? base128() : longueur });
  }
  const flux = zlib.brotliDecompressSync(b.subarray(o, o + compresse));
  let at = 0;
  for (const t of tables) { if (t.index === CMAP) break; at += t.longueur; }
  const c = flux.subarray(at);
  const points = new Set();
  const nSous = c.readUInt16BE(2);
  const sous = Array.from({ length: nSous }, (_, i) => ({ pf: c.readUInt16BE(4 + 8 * i), enc: c.readUInt16BE(6 + 8 * i), off: c.readUInt32BE(8 + 8 * i) }));
  const lire = s => {
    const f = c.readUInt16BE(s.off);
    if (f === 12) {
      const n = c.readUInt32BE(s.off + 12);
      for (let i = 0; i < n; i++) { const g = s.off + 16 + 12 * i; for (let p = c.readUInt32BE(g); p <= c.readUInt32BE(g + 4); p++) points.add(p); }
      return true;
    }
    if (f === 4) {
      const n = c.readUInt16BE(s.off + 6) / 2;
      for (let i = 0; i < n; i++) { const fin = c.readUInt16BE(s.off + 14 + 2 * i), debut = c.readUInt16BE(s.off + 16 + 2 * n + 2 * i); if (debut !== 0xffff) for (let p = debut; p <= fin; p++) points.add(p); }
      return true;
    }
    return false;
  };
  // L'Unicode complet d'abord (format 12), sinon le plan de base (format 4).
  const ordre = [...sous].sort((a, b2) => (b2.pf === 3 && b2.enc === 10) - (a.pf === 3 && a.enc === 10) || (b2.pf === 0) - (a.pf === 0));
  for (const s of ordre) if (lire(s)) break;
  return points;
}
