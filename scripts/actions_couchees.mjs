/**
 * LES CARTES COUCHÉES : LES PHOTOS D'ACTION QUI NE TIENNENT PAS DEBOUT (oct. 2026).
 *
 *   node scripts/actions_couchees.mjs                  # toutes : la LNH (≈ 1 700), les libres (≈ 960), les saisons (≈ 2 500)
 *   node scripts/actions_couchees.mjs --sources commons,saisons --planche
 *   node scripts/actions_couchees.mjs --limite 200 --seuil 0.5
 *
 * JP : *tu pourrais faire cartes spéciales action horizontales quand t'as des photos qui gossent vertical*. Une
 * photo de match de la LNH est en paysage (1296 × 729) ; la carte en garde une fenêtre 5:7 de toute la hauteur
 * (js/recadrage-action.js), soit 40 % de la largeur. Quand le jeu s'étale — le joueur couché sur la glace, deux
 * joueurs à la bande, un tir de loin —, la fenêtre en coupe la moitié. La mesure : `garde`, la part des contours
 * nets de l'image que la fenêtre debout garde (js/recadrage-action.js) ; sous le SEUIL, la planche la montre, et
 * l'œil décide (`COUCHEES_A_L_OEIL`). Couchée : une fenêtre 7:5 de toute la hauteur (79 % de la largeur), centrée sur le visage, 560 × 400 en WebP
 * (img/actions/couchees/{clé}.webp), et `couchees` dans data/actions.json : clé → [x, y], le centre du visage dans
 * la photo couchée.
 *
 * TROIS SOURCES (JP : *fais aussi les photos de Commons en couchées*) : les photos de la LNH (`lnh`, clé : l'id), les
 * photos générales libres de Commons et d'Openverse (`commons`, clé : l'id) et les photos de saison de Commons
 * (`saisons`, clé : « id-saison »). Les bruts de la LNH se lisent dans le même cache que scripts/actions.mjs ; ceux
 * de Wikimedia, un à la fois, en se nommant, et la file recule à chaque 429 (leurs limites).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { recadrerAction } from '../js/recadrage-action.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (nom, def) => { const i = process.argv.indexOf(`--${nom}`); return i < 0 ? def : (process.argv[i + 1] ?? true); };
const LARGEUR = 560, HAUTEUR = 400;
/*
 * LE SEUIL ET L'ŒIL. `garde` range les photos, il ne décide pas seul : un gros plan sur une foule nette garde peu
 * (la foule porte les contours) et tient pourtant debout. Sous 0,5 (305 photos sur 1 702, oct. 2026), chaque photo a
 * été vue sur la planche : se couchent celles dont la fenêtre debout coupe le jeu — le jeu étalé, le gardien couché,
 * deux joueurs ou plus, le tir en pleine foulée. Une photo neuve sous le seuil s'annonce « à voir ».
 */
const SEUIL = Number(arg('seuil', 0.5));
const COUCHEES_A_L_OEIL = new Set([
  8445240, 8445865, 8445957, 8446053, 8446142, 8446342, 8446788, 8446917, 8446991, 8447172, 8448091, 8448320,
  8448624, 8448626, 8449423, 8449499, 8449979, 8449988, 8450066, 8450178, 8450505, 8450773, 8450978, 8451033,
  8451715, 8452122, 8452217, 8455738, 8459463, 8460612, 8467370, 8467400, 8467950, 8468505, 8468509, 8468535,
  8468611, 8468674, 8469459, 8469506, 8470320, 8470358, 8470600, 8470602, 8470604, 8470860, 8471498, 8471678,
  8471817, 8473449, 8473503, 8473673, 8474061, 8474145, 8474151, 8474586, 8474602, 8474651, 8474774, 8475098,
  8475197, 8475218, 8475225, 8475233, 8475762, 8475766, 8475788, 8475857, 8475869, 8476158, 8476310, 8476356,
  8476438, 8476454, 8476458, 8476466, 8476472, 8476903, 8476919, 8476932, 8476981, 8477293, 8477401, 8477406,
  8477435, 8477503, 8477591, 8477810, 8477931, 8477934, 8477935, 8477946, 8477959, 8477967, 8478010, 8478027,
  8478067, 8478233, 8478416, 8478493, 8478856, 8478905, 8479293, 8479336, 8479344, 8479368, 8479372, 8479423,
  8479525, 8479992, 8480001, 8480003, 8480015, 8480074, 8480205, 8480216, 8480220, 8480259, 8480289, 8480426,
  8480797, 8480844, 8480950, 8481133, 8481542, 8481546, 8481575, 8481607, 8481692, 8481726, 8482074, 8482103,
  8482131, 8482142, 8482159, 8482201, 8482445, 8482446, 8482635, 8482665, 8482821, 8482874, 8482929, 8483450,
  8483464, 8483466, 8483506, 8484150, 8484180, 8484210, 8484386, 8484471, 8484768, 8484798, 8484860, 8485512,
]);
const QUALITE = Number(arg('qualite', 0.8));
const LIMITE = Number(arg('limite', 0)) || Infinity;
const BRUT = arg('brut', path.join(os.tmpdir(), 'cap82-actions'));
const SORTIE = path.join(ROOT, 'img', 'actions', 'couchees');
const PARALLELE = Number(arg('parallele', 10));
const SOURCE = id => `https://assets.nhle.com/mugs/actionshots/1296x729/${id}.jpg`;
const t0 = Date.now();

fs.mkdirSync(BRUT, { recursive: true });
fs.mkdirSync(SORTIE, { recursive: true });
const LU = path.join(ROOT, 'data', 'actions.json');
const A = JSON.parse(fs.readFileSync(LU, 'utf8'));
const SOURCES = String(arg('sources', 'lnh,commons,saisons')).split(',');
const UA = 'Cap82-0/1.0 (https://github.com/ouellettejeanphilippe-source/hockey)';
const LIBRES = { ...(A.commons || {}), ...(A.libres || {}) };
const vignette = ([f, dossier, largeur]) => {
  const nom = encodeURIComponent(f.replace(/ /g, '_'));
  return `https://upload.wikimedia.org/wikipedia/commons/${largeur ? 'thumb/' : ''}${dossier[0]}/${dossier}/${nom}${largeur ? `/${largeur}px-${nom}` : ''}`;
};
// La vignette de 960 px d'un original de Commons (l'original peut peser plusieurs Mo) ; ailleurs (Openverse), rien.
const vignette960 = url => {
  const m = String(url).match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/(\w\/\w\w)\/([^/]+)$/);
  return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/960px-${m[3]}` : null;
};
// Chaque photo : sa clé, d'où elle vient, le centre du visage dans l'image entière, sa hauteur dans la carte debout.
let liste = [];
for (const id of A.ids || []) {
  const libre = LIBRES[id];
  if (libre ? !SOURCES.includes('commons') : !SOURCES.includes('lnh')) continue;
  liste.push({ cle: id, urls: libre ? [vignette960(libre.s), libre.s].filter(Boolean) : [SOURCE(id)], wiki: !!libre, centre: A.visages?.[id] ?? null, y: A.cadres?.[id]?.[1] ?? 0.3 });
}
if (SOURCES.includes('saisons')) {
  for (const [id, parSaison] of Object.entries(A.saisons || {})) {
    for (const [saison, e] of Object.entries(parSaison)) liste.push({ cle: `${id}-${saison}`, urls: [vignette(e)], wiki: true, centre: e[5] ?? null, y: e[6]?.[1] ?? 0.3 });
  }
}
if (arg('ids', null)) { const ids = new Set(String(arg('ids')).split(',')); liste = liste.filter(x => ids.has(String(x.cle))); }
liste = liste.slice(0, LIMITE);
console.log(`\n  ${liste.length} photos (${SOURCES.join(', ')}) · seuil ${SEUIL} · ${LARGEUR} × ${HAUTEUR} · brut dans ${BRUT}\n`);

const dormir = ms => new Promise(r => setTimeout(r, ms));
let pauseWiki = 1200;
async function telecharger(x) {
  const f = path.join(BRUT, x.wiki ? `wiki-${x.cle}.img` : `${x.cle}.jpg`);
  if (fs.existsSync(f)) return f;
  for (let essai = 0; essai < 8; essai++) {
    try {
      let r = null;
      for (const url of x.urls) {
        if (x.wiki) await dormir(pauseWiki);
        r = await fetch(url, x.wiki ? { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } } : { redirect: 'manual' });
        if (r.ok || r.status === 429) break;   // une vignette refusée (l'original est plus petit) : l'original
      }
      // Wikimedia limite : on recule, puis on reprend plus doucement.
      if (r.status === 429) { pauseWiki = Math.min(10000, pauseWiki * 1.5); await dormir(30000 * (essai + 1)); continue; }
      if (!r.ok) return null;
      fs.writeFileSync(`${f}.part`, Buffer.from(await r.arrayBuffer()));
      fs.renameSync(`${f}.part`, f);
      return f;
    } catch (e) { if (essai === 7) { console.log(`   ${x.cle} : ${e.message}`); return null; } await dormir(2000 * (essai + 1)); }
  }
  console.log(`   ${x.cle} : toujours limité, laissé debout`);
  return null;
}

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: `window.recadrerActionBlob = ${recadrerAction.toString()};` });
await page.evaluate(({ LARGEUR, HAUTEUR, QUALITE }) => {
  const b64 = async blob => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); };
  // La mesure debout (la fenêtre de la carte), puis la fenêtre couchée, sur le même visage.
  window.coucher = async (brut, centre) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${brut}`)).blob();
    const debout = await window.recadrerActionBlob(blob, { centre });
    const couchee = await window.recadrerActionBlob(blob, { largeur: LARGEUR, hauteur: HAUTEUR, qualite: QUALITE, centre });
    const img = await createImageBitmap(blob);
    const r = { garde: debout.mesures.garde, W: img.width, H: img.height, debout: debout.fenetre, couchee: couchee.fenetre, webp: await b64(couchee.webp) };
    img.close();
    return r;
  };
}, { LARGEUR, HAUTEUR, QUALITE });

// La LNH en parallèle ; Wikimedia, une à la fois.
const mesures = new Map(), fichiers = new Map();
const mesurer = async x => {
  const f = await telecharger(x);
  if (!f) return;
  fichiers.set(x.cle, f);
  try { mesures.set(x.cle, { ...x, ...(await page.evaluate(([b, c]) => window.coucher(b, c), [fs.readFileSync(f).toString('base64'), x.centre])) }); } catch { /* illisible : reste debout */ }
  if (mesures.size % 250 === 0) console.log(`   ${mesures.size} mesurées · ${Math.round((Date.now() - t0) / 1000)} s`);
};
const lnh = liste.filter(x => !x.wiki), wiki = liste.filter(x => x.wiki);
await Promise.all([
  ...Array.from({ length: PARALLELE }, async () => { while (lnh.length) await mesurer(lnh.shift()); }),
  (async () => { while (wiki.length) await mesurer(wiki.shift()); })(),
]);

// Le centre du visage dans la photo couchée : x d'après le visage dans l'image entière, y celui de la carte debout (toute la hauteur dans les deux).
const centreCouche = m => {
  const [sx, , sl] = m.couchee;
  const x = Number.isFinite(m.centre) ? (m.centre * m.W - sx) / sl : 0.5;
  return [Math.round(Math.min(1, Math.max(0, x)) * 100) / 100, m.y];
};
// Les couchées des sources qu'on n'a pas relues restent ; celles qu'on a relues se refont.
const relues = new Set(liste.map(x => String(x.cle)));
const couchees = Object.fromEntries(Object.entries(A.couchees || {}).filter(([cle]) => !relues.has(cle)));
let octets = 0;
for (const [cle, m] of [...mesures].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
  const f = path.join(SORTIE, `${cle}.webp`);
  if (!COUCHEES_A_L_OEIL.has(cle)) { fs.rmSync(f, { force: true }); continue; }
  const buf = Buffer.from(m.webp, 'base64');
  fs.writeFileSync(f, buf); octets += buf.length;
  couchees[cle] = centreCouche(m);
}
if (LIMITE === Infinity && !arg('ids', null)) {
  const tri = Object.fromEntries(Object.entries(couchees).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })));
  fs.writeFileSync(LU, JSON.stringify({ ...A, couchees: tri }));
}

const gardes = [...mesures.values()].map(m => m.garde).sort((a, b) => a - b);
const q = p => gardes[Math.floor(p * (gardes.length - 1))];
console.log(`\n  ${mesures.size} mesurées · garde : 10 % ${q(0.1)} · médiane ${q(0.5)} · 90 % ${q(0.9)}`);
const aVoir = [...mesures].filter(([id, m]) => m.garde < SEUIL && !COUCHEES_A_L_OEIL.has(id)).length;
console.log(`  ${Object.keys(couchees).length} couchées (vues à l'œil) · ${aVoir} sous ${SEUIL} restées debout · ${(octets / 1048576).toFixed(1)} Mo · ${Math.round((Date.now() - t0) / 1000)} s\n`);

/* La planche : les photos sous le seuil, entières, leur fenêtre debout (jaune) et couchée (bleue), triées par `garde`, pour les voir à l'œil. */
if (arg('planche', false)) {
  const vus = [...mesures].filter(([, m]) => m.garde < SEUIL).sort((a, b) => a[1].garde - b[1].garde);
  const fig = ([id, m]) => { const e = 220 / m.W, [x, y, l, h] = m.debout, [cx, cy, cl, ch] = m.couchee; return `<figure style="margin:3px;display:inline-block;vertical-align:top;position:relative;color:${COUCHEES_A_L_OEIL.has(id) ? '#7cf' : '#ccc'};font:11px sans-serif">
    <img src="data:image/jpeg;base64,${fs.readFileSync(fichiers.get(id)).toString('base64')}" style="width:220px;height:${Math.round(m.H * e)}px;display:block">
    <div style="position:absolute;left:${cx * e}px;top:${cy * e}px;width:${cl * e}px;height:${ch * e}px;outline:2px solid #39f"></div>
    <div style="position:absolute;left:${x * e}px;top:${y * e}px;width:${l * e}px;height:${h * e}px;outline:2px solid #ff0"></div>
    <figcaption>${id} · ${m.garde}${COUCHEES_A_L_OEIL.has(id) ? ' · couchée' : ''}</figcaption></figure>`; };
  await page.setViewportSize({ width: 1200, height: 900 });
  for (let k = 0; k * 60 < vus.length; k++) {
    await page.setContent(`<body style="background:#111;margin:6px">${vus.slice(k * 60, k * 60 + 60).map(fig).join('')}</body>`);
    const f = path.join(BRUT, `planche-couchees-${k}.png`);
    await page.screenshot({ path: f, fullPage: true });
    console.log(`  planche : ${f}`);
  }
}
await navigateur.close();
