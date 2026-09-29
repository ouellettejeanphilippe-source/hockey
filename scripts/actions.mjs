/**
 * LES PHOTOS D'ACTION, CHEZ NOUS ET CADRÉES POUR UNE CARTE (1.0).
 *
 *   node scripts/actions.mjs                   # tout (≈ 5 900 joueurs, ≈ 2 800 photos)
 *   node scripts/actions.mjs --limite 60       # un échantillon, pour régler
 *   node scripts/actions.mjs --ids 8478402,8471675 --planche
 *
 * JP : *pense à des cartes complexes, trouve des images, pas juste des faces,
 * si tu peux*. La LNH publie une photo de match pour la plupart des joueurs
 * d'après 2005 (assets.nhle.com/mugs/actionshots/1296x729/{id}.jpg ; un
 * joueur sans photo est redirigé vers une image générique). Mesuré sur nos
 * joueurs : ≈ 95 % depuis 2010, ≈ 58 % dans les années 2000, presque aucun
 * avant 1990 — une carte d'un joueur sans photo garde son portrait.
 *
 * CE QUE FAIT CE SCRIPT, une fois, à la fabrication (le frère de
 * scripts/portraits.mjs) :
 *   1. il télécharge chaque photo (le brut reste dans un cache, hors du dépôt,
 *      pour qu'une deuxième passe ne retélécharge rien ; les absents aussi
 *      sont retenus) ;
 *   2. il garde l'image ENTIÈRE (JP : *je veux que le maximum de pixels de
 *      l'image y soient*) et y trouve le joueur, par la netteté
 *      (js/recadrage-action.js, le même code que l'appareil Android) ;
 *   3. il écrit un WebP 854 × 480 (img/actions/{id}.webp, HORS DU DÉPÔT :
 *      des dizaines de Mo qui se refont) et la liste des photos qui existent
 *      (data/actions.json, versionnée), avec la place du joueur dans chacune
 *      (`fx`, 0 à 100) : une carte plus étroite que la photo s'y recentre ;
 *      le jeu ne demande jamais une photo absente, et l'appareil sait quoi
 *      télécharger.
 *
 * Le traitement se fait dans Chromium (Playwright) : le décodage JPEG, le
 * canevas et l'encodage WebP y sont natifs, sans dépendance de plus.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { recadrerAction } from '../js/recadrage-action.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (nom, def) => { const i = process.argv.indexOf(`--${nom}`); return i < 0 ? def : (process.argv[i + 1] ?? true); };
const LARGEUR = 854, HAUTEUR = 480;
const QUALITE = Number(arg('qualite', 0.8));
const LIMITE = Number(arg('limite', 0)) || Infinity;
const BRUT = arg('brut', path.join(os.tmpdir(), 'cap82-actions'));
const SORTIE = path.join(ROOT, 'img', 'actions');
const PARALLELE = Number(arg('parallele', 10));
const SOURCE = id => `https://assets.nhle.com/mugs/actionshots/1296x729/${id}.jpg`;
const t0 = Date.now();

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
console.log(`\n  ${liste.length} joueurs · ${LARGEUR} × ${HAUTEUR} · WebP ${QUALITE} · brut dans ${BRUT}\n`);

/* 1. Le téléchargement : le brut en cache, les absents (la redirection vers l'image générique) retenus. */
const ABSENTS = path.join(BRUT, 'absents.json');
const absents = new Set(fs.existsSync(ABSENTS) ? JSON.parse(fs.readFileSync(ABSENTS, 'utf8')) : []);
let telecharges = 0, octetsBruts = 0;
async function telecharger(id) {
  const f = path.join(BRUT, `${id}.jpg`);
  if (fs.existsSync(f)) return f;
  if (absents.has(id)) return null;
  for (let essai = 0; essai < 4; essai++) {
    try {
      const r = await fetch(SOURCE(id), { redirect: 'manual' });
      // Sans photo, la LNH redirige (302) vers actionshots/default.jpg : ce n'est pas LUI.
      if (r.status === 404 || r.status === 403 || (r.status >= 300 && r.status < 400)) { absents.add(id); return null; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 4096) throw new Error(`${buf.length} octets`);
      fs.writeFileSync(`${f}.part`, buf);
      fs.renameSync(`${f}.part`, f);
      telecharges++; octetsBruts += buf.length;
      return f;
    } catch (e) { if (essai === 3) { console.log(`   ${id} : ${e.message}`); return null; } await new Promise(r => setTimeout(r, 1000 * (essai + 1))); }
  }
  return null;
}

/* 2. Le recadrage, dans la page : pur canevas. */
const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent('<body></body>');
// Le même code recadre ici et sur l'appareil Android ; il ne lit aucune variable extérieure.
await page.addScriptTag({ content: `window.recadrerActionBlob = ${recadrerAction.toString()};` });
await page.evaluate(({ LARGEUR, HAUTEUR, QUALITE }) => {
  // L'empreinte d'une image (dHash 16 × 16) : deux images qui ne diffèrent que par leur encodage ont la même, à quelques bits près.
  const empreinte = async blob => {
    const img = await createImageBitmap(blob);
    const c = new OffscreenCanvas(17, 16), x = c.getContext('2d');
    x.drawImage(img, 0, 0, 17, 16);
    const d = x.getImageData(0, 0, 17, 16).data;
    const g = (i, j) => d[(j * 17 + i) * 4] * 0.3 + d[(j * 17 + i) * 4 + 1] * 0.59 + d[(j * 17 + i) * 4 + 2] * 0.11;
    const octets = new Array(32).fill(0);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (g(i + 1, j) > g(i, j)) octets[(j * 16 + i) >> 3] |= 1 << (i & 7);
    return octets;
  };
  window.recadrer = async b64 => {
    const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
    const { webp, fenetre, fx, mesures } = await window.recadrerActionBlob(blob, { largeur: LARGEUR, hauteur: HAUTEUR, qualite: QUALITE });
    const buf = new Uint8Array(await webp.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { webp: btoa(s), fenetre, fx, mesures, empreinte: await empreinte(blob) };
  };
}, { LARGEUR, HAUTEUR, QUALITE });

/*
 * CE QUI N'EST PAS UNE PHOTO DU JOUEUR. Pour un joueur sans vraie photo, la
 * LNH sert souvent une image de son ÉQUIPE : une vue de l'aréna, la glace au
 * logo, la foule. Mesuré sur la première passe (2 043 photos) : 331 de ces
 * images reviennent, à l'encodage près, chez 2 à 16 joueurs (52 images) ; une
 * vingtaine d'autres, uniques, sont des vues d'aréna. Trois filtres :
 *   1. une image qui revient chez deux joueurs ou plus (empreinte à 10 bits
 *      près sur 256) n'est la photo d'aucun des deux ;
 *   2. une vue d'aréna : des gradins sombres sous la glace (le bas de l'image
 *      sombre) avec une grande glace au centre, ou une foule nette partout
 *      (un contour médian fort sur une image sans aplats). Sur la planche de
 *      contrôle, aucune vue d'aréna n'en sort, sauf les deux suivantes ; deux
 *      vraies photos y tombent (un gardien de Seattle, un portrait de la
 *      Caroline sur fond rouge) : on les garde ;
 *   3. deux vues d'aréna sombres, que les mesures ne distinguent pas d'un
 *      portrait sur fond noir. Ces deux listes sont vues à l'œil (sept. 2026).
 * La planche (--planche) montre aussi les écartées, pour qu'on les revoie.
 */
const vueDArena = m => m.bas < 72 && (m.glace > 0.35 || (m.contour > 25 && m.plat > 0.18));
const GARDEES_A_L_OEIL = new Set([8475831, 8480336]);
const ECARTEES_A_L_OEIL = new Set([8476433, 8478176]);
const EMPREINTE_PROCHE = 10;
const distance = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) { let v = a[i] ^ b[i]; while (v) { n += v & 1; v >>= 1; } } return n; };

const presents = [], fenetres = new Map(), focales = new Map(), empreintes = new Map(), ecartees = new Map();
let faits = 0, octets = 0;
const file = liste.slice();
async function ouvrier() {
  while (file.length) {
    const id = file.shift();
    const f = await telecharger(id);
    if (!f) continue;
    // Un brut illisible (coupé, ou pas une image) : on le jette et on le retélécharge une fois.
    let r = null;
    for (let essai = 0; essai < 2 && !r; essai++) {
      const brut = essai ? await telecharger(id) : f;
      if (!brut) break;
      try { r = await page.evaluate(b => window.recadrer(b), fs.readFileSync(brut).toString('base64')); } catch { fs.rmSync(brut, { force: true }); }
    }
    if (!r) { console.log(`   ${id} : image illisible, laissée de côté`); continue; }
    fenetres.set(id, r.fenetre); focales.set(id, r.fx);
    if (vueDArena(r.mesures) && !GARDEES_A_L_OEIL.has(id)) { ecartees.set(id, 'aréna'); continue; }
    if (ECARTEES_A_L_OEIL.has(id)) { ecartees.set(id, 'à l\'œil'); continue; }
    const buf = Buffer.from(r.webp, 'base64');
    fs.writeFileSync(path.join(SORTIE, `${id}.webp`), buf);
    presents.push(id); empreintes.set(id, r.empreinte); octets += buf.length;
    if (++faits % 250 === 0) console.log(`   ${faits} photos · ${(octets / 1048576).toFixed(1)} Mo · ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}
await Promise.all(Array.from({ length: PARALLELE }, ouvrier));
fs.writeFileSync(ABSENTS, JSON.stringify([...absents].sort((a, b) => a - b)));

// 1. Les images qui reviennent chez plusieurs joueurs : l'image de l'équipe, pas la leur.
const communes = new Set();
for (let a = 0; a < presents.length; a++) {
  for (let b = a + 1; b < presents.length; b++) {
    if (distance(empreintes.get(presents[a]), empreintes.get(presents[b])) <= EMPREINTE_PROCHE) { communes.add(presents[a]); communes.add(presents[b]); }
  }
}
for (const id of communes) { ecartees.set(id, 'commune'); octets -= fs.statSync(path.join(SORTIE, `${id}.webp`)).size; }
presents.splice(0, presents.length, ...presents.filter(id => !communes.has(id)));
// Une photo écartée ne reste pas dans img/actions (une passe d'avant a pu l'écrire).
for (const id of ecartees.keys()) fs.rmSync(path.join(SORTIE, `${id}.webp`), { force: true });

// 3. La liste des photos présentes : le jeu la lit avant de demander une photo, l'appareil pour savoir quoi télécharger.
//    `fx` (en parallèle de `ids`) : la place du joueur dans sa photo, de 0 (à gauche) à 100 (à droite).
presents.sort((a, b) => a - b);
if (LIMITE === Infinity && !arg('ids', null)) {
  fs.writeFileSync(path.join(ROOT, 'data', 'actions.json'), JSON.stringify({ taille: [LARGEUR, HAUTEUR], ids: presents, fx: presents.map(id => focales.get(id)) }));
}
const brutsTotal = presents.reduce((a, id) => a + fs.statSync(path.join(BRUT, `${id}.jpg`)).size, 0);
const parRaison = {};
for (const r of ecartees.values()) parRaison[r] = (parRaison[r] || 0) + 1;
console.log(`\n  ${presents.length} photos d'action écrites sur ${liste.length} joueurs ; ${liste.length - presents.length - ecartees.size} sans photo à la LNH`);
console.log(`  ${ecartees.size} écartées, pas une photo du joueur : ${Object.entries(parRaison).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
console.log(`  ${(octets / 1048576).toFixed(1)} Mo en tout, ${(octets / Math.max(1, presents.length) / 1024).toFixed(1)} Ko en moyenne`);
console.log(`  bruts : ${(brutsTotal / 1048576).toFixed(0)} Mo (${telecharges} téléchargés cette fois, ${(octetsBruts / 1048576).toFixed(0)} Mo) — ce que l'appareil téléchargerait`);
console.log(`  ${Math.round((Date.now() - t0) / 1000)} s\n`);

/* La planche : les photos recadrées, et leur fenêtre dans l'image entière, pour régler à l'œil. */
if (arg('planche', false)) {
  const n = Number(arg('planche')) > 1 ? Number(arg('planche')) : 40;
  const vus = Array.from({ length: Math.min(n, presents.length) }, (_, k) => presents[Math.floor(k * presents.length / Math.min(n, presents.length))]);
  const b64 = f => fs.readFileSync(f).toString('base64');
  const cartes = vus.map(id => `<figure style="margin:3px;display:inline-block;text-align:center;color:#ccc;font:10px sans-serif">
    <div style="position:relative"><img src="data:image/webp;base64,${b64(path.join(SORTIE, `${id}.webp`))}" style="width:213px;height:120px;border-radius:6px;display:block">
    <div style="position:absolute;top:0;bottom:0;left:${focales.get(id) * 2.13}px;width:0;border-left:2px dashed #ff0"></div></div>
    <figcaption>${id} · fx ${focales.get(id)}</figcaption></figure>`).join('');
  const bruts = vus.map(id => { const [x, y, l, hh] = fenetres.get(id); const e = 200 / 1296; return `<figure style="margin:3px;display:inline-block;position:relative;color:#ccc;font:10px sans-serif">
    <img src="data:image/jpeg;base64,${b64(path.join(BRUT, `${id}.jpg`))}" style="width:200px;height:112px;display:block">
    <div style="position:absolute;left:${x * e}px;top:${y * e}px;width:${l * e}px;height:${hh * e}px;outline:2px solid #ff0"></div>
    <figcaption>${id}</figcaption></figure>`; }).join('');
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.setContent(`<body style="background:#111;margin:6px">${cartes}</body>`);
  const f1 = path.join(BRUT, 'planche.png');
  await page.screenshot({ path: f1, fullPage: true });
  await page.setContent(`<body style="background:#111;margin:6px">${bruts}</body>`);
  const f2 = path.join(BRUT, 'planche-fenetres.png');
  await page.screenshot({ path: f2, fullPage: true });
  // Les écartées autres que les images communes (celles-là se ressemblent toutes) : aucune ne devrait montrer un joueur.
  const rejets = [...ecartees].filter(([, r]) => r !== 'commune').map(([id, r]) => `<figure style="margin:3px;display:inline-block;color:#ccc;font:10px sans-serif">
    <img src="data:image/jpeg;base64,${b64(path.join(BRUT, `${id}.jpg`))}" style="width:180px;height:101px;display:block">
    <figcaption>${id} · ${r}</figcaption></figure>`).join('');
  await page.setContent(`<body style="background:#111;margin:6px">${rejets}</body>`);
  const f3 = path.join(BRUT, 'planche-ecartees.png');
  await page.screenshot({ path: f3, fullPage: true });
  console.log(`  planches : ${f1}\n            ${f2}\n            ${f3}`);
}
await navigateur.close();
