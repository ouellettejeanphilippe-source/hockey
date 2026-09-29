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
 *   node mobile/assembler-www.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const WWW = path.join(ICI, 'www');

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
// visages (img/mugs) viennent du site publié, voir l'en-tête.
const DOSSIERS = ['js', 'data', 'fonts', 'img/logos'];
const SILHOUETTE = 'img/mugs/silhouette.webp';

await fs.rm(WWW, { recursive: true, force: true });
await fs.mkdir(WWW, { recursive: true });

for (const f of FICHIERS) {
  await fs.copyFile(path.join(RACINE, f), path.join(WWW, f));
}
for (const d of DOSSIERS) {
  await fs.cp(path.join(RACINE, d), path.join(WWW, d), { recursive: true });
}
await fs.mkdir(path.dirname(path.join(WWW, SILHOUETTE)), { recursive: true });
await fs.copyFile(path.join(RACINE, SILHOUETTE), path.join(WWW, SILHOUETTE));

// Le compte des fichiers et le poids : c'est ce qu'on veut voir avant de
// s'apercevoir dans l'APK qu'un dossier manque.
async function peser(dossier) {
  let n = 0;
  let octets = 0;
  for (const e of await fs.readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) {
      const s = await peser(p);
      n += s.n;
      octets += s.octets;
    } else {
      n += 1;
      octets += (await fs.stat(p)).size;
    }
  }
  return { n, octets };
}

const { n, octets } = await peser(WWW);
console.log(`www/ : ${n} fichiers, ${(octets / 1024 / 1024).toFixed(1)} Mo`);

// Le filet du hors-ligne : sw.js liste ce qu'il precache, et le jeu ne demarre
// pas sans ses shards. Si l'un des trois manque, autant le savoir ici.
for (const attendu of ['index.html', 'js/game.js', 'js/visages.js', 'js/recadrage.js', 'data/seed.json', 'data/portraits.json', SILHOUETTE]) {
  try {
    await fs.access(path.join(WWW, attendu));
  } catch {
    console.error(`MANQUANT : ${attendu}`);
    process.exit(1);
  }
}
console.log('les fichiers dont le jeu ne peut pas se passer sont la.');
