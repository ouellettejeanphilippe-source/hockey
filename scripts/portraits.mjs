/**
 * LES PORTRAITS, CHEZ NOUS ET BIEN CADRÉS (S78).
 *
 *   node scripts/portraits.mjs                 # tout (≈ 5 900 joueurs)
 *   node scripts/portraits.mjs --limite 60     # un échantillon, pour régler
 *   node scripts/portraits.mjs --ids 8448911,8475692 --planche
 *
 * JP : *premier opening du jeu, télécharger toutes les faces et logos sur le
 * device* ; *assurer que les portraits soient toujours bien cadrés, partout
 * dans l'interface* — sa capture du loto : Lysiak coupé, Ribeiro correct,
 * Zuccarello minuscule.
 *
 * POURQUOI ÇA VARIAIT. Les photos de la LNH (336 × 336) sont de trois
 * familles : les vieilles photos sur fond opaque, où la tête remplit le
 * cadre (Lafleur, Lysiak) ; les détourées d'une époque, tête large (Ribeiro) ;
 * les détourées modernes, tête petite au milieu d'un grand vide transparent
 * (Zuccarello, McDavid). Un même cadre CSS ne pouvait pas avoir raison des
 * trois à la fois.
 *
 * CE QUE FAIT CE SCRIPT, une fois, à la fabrication :
 *   1. il télécharge chaque portrait (le brut reste dans un cache, hors du
 *      dépôt, pour qu'une deuxième passe ne retélécharge rien) ;
 *   2. sur une photo détourée, il trouve la TÊTE par la transparence — le
 *      haut de la silhouette, sa largeur dans le tiers du haut — et recadre
 *      pour que la tête fasse toujours la même part du cadre, à la même
 *      hauteur (le vide transparent comble ce qui manque) ; une vieille photo
 *      opaque, déjà serrée sur le visage, garde son cadre ;
 *   3. il écrit un WebP compact (img/mugs/{id}.webp) et la liste des
 *      portraits qui existent (data/portraits.json) : le jeu ne demande
 *      jamais un portrait absent, et n'a plus besoin du réseau pour les faces.
 *
 * Le traitement se fait dans Chromium (Playwright) : le décodage PNG, le
 * canevas et l'encodage WebP y sont natifs, sans dépendance de plus.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (nom, def) => { const i = process.argv.indexOf(`--${nom}`); return i < 0 ? def : (process.argv[i + 1] ?? true); };
const TAILLE = Number(arg('taille', 192));
const QUALITE = Number(arg('qualite', 0.74));
const LIMITE = Number(arg('limite', 0)) || Infinity;
const BRUT = arg('brut', path.join(os.tmpdir(), 'cap82-mugs'));
const SORTIE = path.join(ROOT, 'img', 'mugs');
const PARALLELE = 12;
// La tête fait cette part de la largeur du cadre, et son sommet descend de cette part du haut.
const PART_TETE = 0.46, MARGE_HAUT = 0.09;

fs.mkdirSync(BRUT, { recursive: true });
fs.mkdirSync(SORTIE, { recursive: true });

// Tous les joueurs de toutes les saisons, une fois chacun.
const ids = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  for (const p of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8')).players) if (p.id) ids.add(Number(p.id));
}
let liste = [...ids].sort((a, b) => a - b);
if (arg('ids', null)) liste = String(arg('ids')).split(',').map(Number);
liste = liste.slice(0, LIMITE);
console.log(`\n  ${liste.length} portraits · ${TAILLE} px · WebP ${QUALITE} · brut dans ${BRUT}\n`);

/* 1. Le téléchargement : le brut en cache, les absents (404) retenus. */
const ABSENTS = path.join(BRUT, 'absents.json');
const absents = new Set(fs.existsSync(ABSENTS) ? JSON.parse(fs.readFileSync(ABSENTS, 'utf8')) : []);
async function telecharger(id) {
  const f = path.join(BRUT, `${id}.png`);
  if (fs.existsSync(f)) return f;
  if (absents.has(id)) return null;
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(`https://assets.nhle.com/mugs/nhl/latest/${id}.png`);
      if (r.status === 404 || r.status === 403) { absents.add(id); return null; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      return f;
    } catch (e) { if (essai === 2) { console.log(`   ${id} : ${e.message}`); return null; } await new Promise(r => setTimeout(r, 800 * (essai + 1))); }
  }
  return null;
}

/* 2. Le recadrage, dans la page : pur canevas. */
const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent('<body></body>');
await page.evaluate(({ TAILLE, QUALITE, PART_TETE, MARGE_HAUT }) => {
  window.recadrer = async b64 => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
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
          cote = large / PART_TETE;
          sx = somme / k - cote / 2;
          sy = haut - MARGE_HAUT * cote;
          famille = 'detouree';
        }
      }
    }
    const out = new OffscreenCanvas(TAILLE, TAILLE), o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    const e = TAILLE / cote;
    // L'image entière, placée : ce qui dépasse du cadre reste transparent (jamais d'étirement).
    o.drawImage(img, -sx * e, -sy * e, W * e, H * e);
    const webp = await out.convertToBlob({ type: 'image/webp', quality: QUALITE });
    const buf = new Uint8Array(await webp.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { webp: btoa(s), famille, cote: Math.round(cote) };
  };
}, { TAILLE, QUALITE, PART_TETE, MARGE_HAUT });

/*
 * LA SILHOUETTE DE LA LNH. Un joueur sans photo reçoit une silhouette grise
 * générique, la même pour tous : ce n'est pas SON visage. On la reconnaît à
 * son empreinte (le même PNG, octet pour octet) et on le compte absent — le
 * jeu montre alors son propre secours.
 */
const SILHOUETTES = new Set(arg('silhouettes', '') ? String(arg('silhouettes')).split(',') : []);
const empreinte = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const presents = [], familles = {}, parEmpreinte = new Map();
let faits = 0, octets = 0;
const file = liste.slice();
async function ouvrier() {
  while (file.length) {
    const id = file.shift();
    const f = await telecharger(id);
    if (!f) continue;
    const h = empreinte(f);
    parEmpreinte.set(h, [...(parEmpreinte.get(h) || []), id]);
    // Un brut illisible (coupé, ou pas une image) : on le jette et on le retélécharge une fois.
    let r = null;
    for (let essai = 0; essai < 2 && !r; essai++) {
      const brut = essai ? await telecharger(id) : f;
      if (!brut) break;
      try { r = await page.evaluate(b => window.recadrer(b), fs.readFileSync(brut).toString('base64')); } catch { fs.rmSync(brut, { force: true }); }
    }
    if (!r) { absents.add(id); console.log(`   ${id} : image illisible, compté absent`); continue; }
    const buf = Buffer.from(r.webp, 'base64');
    fs.writeFileSync(path.join(SORTIE, `${id}.webp`), buf);
    presents.push(id); familles[r.famille] = (familles[r.famille] || 0) + 1; octets += buf.length;
    if (++faits % 250 === 0) console.log(`   ${faits} / ${liste.length} · ${(octets / 1048576).toFixed(1)} Mo`);
  }
}
await Promise.all(Array.from({ length: PARALLELE }, ouvrier));
// Une même image pour cinq joueurs et plus : la silhouette générique.
for (const [h, qui] of parEmpreinte) if (qui.length >= 5 || SILHOUETTES.has(h)) {
  for (const id of qui) { absents.add(id); fs.rmSync(path.join(SORTIE, `${id}.webp`), { force: true }); }
  console.log(`   silhouette générique (${h.slice(0, 10)}) : ${qui.length} joueurs comptés absents`);
  const garde = new Set(qui);
  presents.splice(0, presents.length, ...presents.filter(id => !garde.has(id)));
}
fs.writeFileSync(ABSENTS, JSON.stringify([...absents]));

// 3. La liste des portraits présents : le jeu la lit avant de demander une face.
if (LIMITE === Infinity && !arg('ids', null)) {
  presents.sort((a, b) => a - b);
  fs.writeFileSync(path.join(ROOT, 'data', 'portraits.json'), JSON.stringify({ taille: TAILLE, ids: presents }));
}
console.log(`\n  ${presents.length} portraits écrits (${Object.entries(familles).map(([k, n]) => `${k} ${n}`).join(' · ')}), ${absents.size} absents à la LNH`);
console.log(`  ${(octets / 1048576).toFixed(1)} Mo en tout, ${(octets / Math.max(1, presents.length) / 1024).toFixed(1)} Ko en moyenne\n`);

if (arg('planche', false)) {
  const vus = presents.slice(0, 48);
  const cases = vus.map(id => `<figure style="margin:3px;display:inline-block;text-align:center;color:#ccc;font:10px sans-serif">
    <div style="width:96px;height:120px;border-radius:8px;overflow:hidden;background:#2a3140"><img src="data:image/webp;base64,${fs.readFileSync(path.join(SORTIE, `${id}.webp`)).toString('base64')}" style="width:100%;height:100%;object-fit:cover;object-position:50% 0"></div>
    <figcaption>${id}</figcaption></figure>`).join('');
  await page.setViewportSize({ width: 1240, height: 900 });
  await page.setContent(`<body style="background:#111;margin:6px">${cases}</body>`);
  const f = path.join(BRUT, 'planche.png');
  await page.screenshot({ path: f, fullPage: true });
  console.log(`  planche : ${f}`);
}
await navigateur.close();
