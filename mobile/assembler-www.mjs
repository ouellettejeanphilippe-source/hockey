/* Rassemble dans `www/` exactement ce que le jeu a besoin d'emporter sur
 * Android, et rien d'autre.
 *
 * Capacitor recopie TOUT le contenu de `webDir` dans les ressources de l'APK.
 * Pointer `webDir` sur la racine du depot y ferait entrer `.git` (20 Mo
 * d'historique), les scripts de fabrication, la documentation et le dossier
 * `desktop/` avec son Electron de 368 Mo. D'ou cette liste explicite : elle
 * dit ce qui part, au lieu d'enumerer sans fin ce qui reste.
 *
 * C'est la meme liste que `extraResources` dans desktop/package.json, A UNE
 * EXCEPTION PRES : les visages. Les deux doivent bouger ensemble : un fichier
 * ajoute au jeu et oublie ici manquerait sur Android seulement.
 *
 * LES VISAGES NE PARTENT PLUS DANS L'APK (1.0)
 * --------------------------------------------
 * JP : *pour mobile, pour limiter taille, telecharger image en background au
 * lieu d'integrer*. Les 3 900 visages recadres (img/mugs, 57 Mo) faisaient un
 * APK de 64 Mo. Aucun site ne sert nos visages (JP : *juste local*) : au
 * premier lancement, en arriere-plan, l'appareil telecharge chaque portrait a
 * la LNH, le recadre lui-meme avec le code de scripts/portraits.mjs
 * (js/recadrage.js) et le garde dans le cache (js/visages.js). Le jeu marche
 * hors ligne des que la passe est faite. Seuls partent img/logos (les
 * ecussons, 0,4 Mo) et img/mugs/silhouette.webp (le visage de secours).
 *
 * Les photos d'action (img/actions, 1.0, 49 Mo) ne partent pas non plus :
 * l'appareil les telecharge et les recadre de la meme facon (js/actions.js),
 * apres les visages et en Wi-Fi ; data/actions.json lui dit lesquelles.
 * (L'exe de desktop/ copie `img/**` : il les emporte si elles sont la.)
 *
 * LA BARRE D'ETAT D'ANDROID : C'EST LE CSS QUI LA DEGAGE
 * ------------------------------------------------------
 * Le JSON n'accepte pas de commentaire, alors la raison est ici.
 *
 * index.html declare `viewport-fit=cover`, donc le jeu dessine BORD A BORD, et
 * Android 15+ l'impose de toute facon. Longtemps, style.css degageait le bas
 * (`env(safe-area-inset-bottom)`) et jamais le haut : sur telephone, l'heure et
 * la batterie chevauchaient « Nouvelle partie » et les reglages.
 *
 * Un premier correctif avait pose `android.adjustMarginsForEdgeToEdge: "force"`
 * dans capacitor.config.json. Ce reglage appartient a Capacitor 7 : Capacitor 8
 * (celui d'ici) ne le lit plus -- aucune ligne de @capacitor/android ne le
 * nomme --, il ne faisait donc RIEN. Capacitor 8 confie les barres a son module
 * SystemBars (reglage « css » par defaut) : la WebView passe sous la barre
 * d'etat et la page recoit `--safe-area-inset-top` (et `env()` quand la WebView
 * est assez recente).
 *
 * Le haut se degage donc dans style.css (S70, « LA BARRE D'ETAT DU TELEPHONE ») :
 * `--safe-top` prend le plus grand des deux, la barre du haut et les ecrans
 * plein ecran descendent d'autant, et une bande de fond couvre la barre
 * d'etat. Sur ordinateur, tout vaut zero. scripts/smoke.mjs l'eprouve en posant
 * la variable a la main.
 *
 *   node mobile/assembler-www.mjs           regroupé et minifié (esbuild)
 *   node mobile/assembler-www.mjs --brut    les modules tels quels
 *   CAP82_RACINE=… CAP82_WWW=…              une autre source, une autre sortie
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = process.env.CAP82_RACINE ? path.resolve(process.env.CAP82_RACINE) : path.join(ICI, '..');
const WWW = process.env.CAP82_WWW ? path.resolve(process.env.CAP82_WWW) : path.join(ICI, 'www');
const BRUT = process.argv.includes('--brut');   // sans minification : pour comparer, ou déboguer dans la WebView

const FICHIERS = [
  'index.html',
  'style.css',
  'sw.js',
  'site.webmanifest',
  'favicon.svg',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
];
// img/ : seulement les écussons (S78, scripts/logos.mjs) et la silhouette ; les
// visages (img/mugs) se téléchargent sur l'appareil, voir l'en-tête.
const DOSSIERS = ['js', 'data', 'fonts', 'img/logos'];
const SILHOUETTE = 'img/mugs/silhouette.webp';
/*
 * CE QUI NE PART PAS (1.0, J3-9).
 *   data/salaries/  les salaires publiés et leurs sources ne servent qu'à la
 *                   fabrication des shards (scripts/build_salaries.py,
 *                   rerate) ; le jeu n'en lit aucun à l'exécution.
 *   data/seed.json  le filet de js/data.js, lu seulement quand un shard ne
 *                   répond pas ET que l'API non plus. Dans l'APK, les 55
 *                   shards sont à bord et répondent toujours : ce filet n'est
 *                   jamais atteint (2,8 Mo). Sur le Web, il RESTE dans la
 *                   coquille de sw.js — scripts/check_coquille.mjs dit pourquoi.
 */
const HORS_APK = [path.join('data', 'salaries'), path.join('data', 'seed.json'), path.join('img', 'actions')];

await fs.rm(WWW, { recursive: true, force: true });
await fs.mkdir(WWW, { recursive: true });

for (const f of FICHIERS) await fs.copyFile(path.join(RACINE, f), path.join(WWW, f));
for (const d of DOSSIERS) {
  await fs.cp(path.join(RACINE, d), path.join(WWW, d), {
    recursive: true,
    filter: src => !HORS_APK.some(h => { const r = path.relative(path.join(RACINE, h), src); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); }),
  });
}
await fs.mkdir(path.dirname(path.join(WWW, SILHOUETTE)), { recursive: true });
await fs.copyFile(path.join(RACINE, SILHOUETTE), path.join(WWW, SILHOUETTE));

async function peser(dossier) {
  let n = 0, octets = 0;
  for (const e of await fs.readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) { const s = await peser(p); n += s.n; octets += s.octets; }
    else { n += 1; octets += (await fs.stat(p)).size; }
  }
  return { n, octets };
}
const avant = await peser(WWW);
console.log(`www/ copié : ${avant.n} fichiers, ${(avant.octets / 1024 / 1024).toFixed(1)} Mo`);

/*
 * LA MINIFICATION, À LA FABRICATION SEULEMENT (1.0, J3-7). Le dépôt garde ses
 * modules lisibles, sans étape de build ; l'APK reçoit un JavaScript REGROUPÉ
 * en lots et minifié (esbuild, devDependency de mobile/ seulement), et un CSS
 * minifié, avec leurs cartes de sources. `splitting` garde le chargement à la
 * demande : le mode Sur table (js/charge-table.js) et l'exhibition restent
 * des lots à part, lus au premier usage. Puis la liste hors ligne de sw.js est
 * réécrite d'après les fichiers réellement produits.
 */
let esbuild = null;
if (!BRUT) {
  try { esbuild = createRequire(path.join(ICI, 'package.json'))('esbuild'); }
  catch {
    try { esbuild = createRequire(path.join(process.env.ESBUILD_DIR || ICI, 'package.json'))('esbuild'); }
    catch { console.warn('esbuild introuvable (npm install dans mobile/) : www/ garde les modules tels quels.'); }
  }
}
if (esbuild) {
  const jsDe = path.join(WWW, 'js');
  const entree = path.join(RACINE, 'js', 'game.js');
  await fs.rm(jsDe, { recursive: true, force: true });
  const res = await esbuild.build({
    entryPoints: [entree], bundle: true, splitting: true, format: 'esm', minify: true,
    sourcemap: 'linked', outdir: jsDe, entryNames: '[name]', chunkNames: 'lot-[hash]',
    legalComments: 'none', logLevel: 'warning', metafile: true,
  });
  // Les modules de data/ (trophées, réputations) sont dans les lots : leurs copies ne servent plus.
  for (const f of ['trophees.js', 'reputations.js']) await fs.rm(path.join(WWW, 'data', f), { force: true });
  const css = await fs.readFile(path.join(WWW, 'style.css'), 'utf8');
  const cssMin = await esbuild.transform(css, { loader: 'css', minify: true, sourcemap: 'external', sourcefile: 'style.css' });
  await fs.writeFile(path.join(WWW, 'style.css'), `${cssMin.code}/*# sourceMappingURL=style.css.map */\n`);
  await fs.writeFile(path.join(WWW, 'style.css.map'), cssMin.map);
  // La liste hors ligne : les fichiers de la coquille d'origine, hors modules, plus les lots produits.
  const sw = await fs.readFile(path.join(WWW, 'sw.js'), 'utf8');
  const m = sw.match(/const FICHIERS = \[([\s\S]*?)\];/);
  if (!m) throw new Error('sw.js : liste FICHIERS introuvable');
  const origine = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  const lots = (await fs.readdir(jsDe)).filter(f => f.endsWith('.js')).map(f => `js/${f}`);
  // Seulement ce qui est à bord : un fichier absent (le filet, par exemple) ne s'annonce pas.
  const aBord = f => f === './' || fsSync.existsSync(path.join(WWW, f));
  const garde = origine.filter(f => !f.startsWith('js/') && !/^data\/.*\.js$/.test(f) && aBord(f));
  const liste = [...garde, ...lots.sort()];
  await fs.writeFile(path.join(WWW, 'sw.js'), sw.replace(m[0], `const FICHIERS = [\n  ${liste.map(f => `'${f}'`).join(', ')},\n];`));
  const sorties = Object.entries(res.metafile.outputs).filter(([f]) => f.endsWith('.js'));
  console.log(`minifié : ${sorties.length} lot(s) JS, ${Math.round(sorties.reduce((a, [, o]) => a + o.bytes, 0) / 1024)} Ko ; style.css ${Math.round(css.length / 1024)} → ${Math.round(cssMin.code.length / 1024)} Ko`);
}

// Les cartes de sources restent sur le poste, à côté de www/ : l'APK ne les emporte pas (3 Mo de plus),
// et un débogage dans la WebView peut les charger à la main (chrome://inspect, « Add source map »).
if (esbuild) {
  const CARTES = WWW.replace(/[\/]?$/, '') + '-cartes';
  await fs.rm(CARTES, { recursive: true, force: true });
  await fs.mkdir(path.join(CARTES, 'js'), { recursive: true });
  for (const f of await fs.readdir(path.join(WWW, 'js'))) if (f.endsWith('.map')) await fs.rename(path.join(WWW, 'js', f), path.join(CARTES, 'js', f));
  await fs.rename(path.join(WWW, 'style.css.map'), path.join(CARTES, 'style.css.map'));
  console.log(`cartes de sources : ${path.relative(ICI, CARTES) || CARTES}`);
}
const apres = await peser(WWW);
console.log(`www/ : ${apres.n} fichiers, ${(apres.octets / 1024 / 1024).toFixed(1)} Mo`);

// Le filet du hors-ligne : ce dont le jeu ne peut pas se passer.
for (const attendu of ['index.html', 'js/game.js', 'data/index.json', 'data/portraits.json', 'data/actions.json', SILHOUETTE]) {
  try { await fs.access(path.join(WWW, attendu)); }
  catch { console.error(`MANQUANT : ${attendu}`); process.exit(1); }
}
for (const h of HORS_APK) {
  try { await fs.access(path.join(WWW, h)); console.error(`${h} ne devrait pas partir`); process.exit(1); } catch { /* absent : voulu */ }
}
console.log('les fichiers dont le jeu ne peut pas se passer sont la.');
