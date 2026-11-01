/*
 * LA MISE À JOUR À MÊME LE MENU (1er nov. 2026, js/mise-a-jour.js) : la version installée se lit dans sw.js, celle de
 * GitHub dans l'étiquette de la release ; on n'offre que plus récent, et le bon fichier pour la plateforme ; l'APK
 * (build.gradle) et la release (.github/workflows/publier.yml) lisent la même version au même endroit.
 *
 *   node scripts/check_maj.mjs
 */
import fs from 'node:fs';
import { exiger, verdict } from './verdict.mjs';
import { versionDe, plusRecente, fichierPour, offre, offreWeb } from '../js/mise-a-jour.js';
import { VERSION } from '../js/version.js';

const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const v = versionDe(sw);
exiger('la version du jeu se lit dans sw.js', /^\d+\.\d+\.\d+$/.test(v || ''), v || 'rien');
exiger('le code qui tourne dit la même version que sw.js (js/version.js : les deux montent ensemble)', VERSION === v, `${VERSION} et ${v}`);
exiger('… et dans une étiquette de release', versionDe('v3.2.0') === '3.2.0' && versionDe('3.10.1') === '3.10.1' && versionDe('n\'importe quoi') === null);
exiger('3.10.0 est plus récente que 3.9.4, chiffre par chiffre', plusRecente('3.10.0', '3.9.4') && !plusRecente('3.9.4', '3.10.0'));
exiger('… la même version ne l\'est pas, ni une plus vieille', !plusRecente('3.2.0', '3.2.0') && !plusRecente('3.1.9', '3.2.0') && plusRecente('3.2.1', '3.2.0'));

const release = { tag_name: 'v9.0.0', assets: [
  { name: 'Cap-82-0.apk', browser_download_url: 'https://x/Cap-82-0.apk' },
  { name: 'Cap-82-0-installateur.exe', browser_download_url: 'https://x/Cap-82-0-installateur.exe' },
] };
exiger('le téléphone reçoit l\'APK, le PC l\'installateur, le navigateur rien', fichierPour(release, 'apk').endsWith('.apk') && fichierPour(release, 'exe').endsWith('installateur.exe') && fichierPour(release, null) === null);
const o = offre(release, v, 'apk');
exiger('une version plus récente à GitHub est offerte, avec son fichier', !!o && o.version === '9.0.0' && o.url.endsWith('.apk'), JSON.stringify(o));
exiger('… à jour, rien n\'est offert', offre({ ...release, tag_name: `v${v}` }, v, 'apk') === null);
exiger('… une release sans APK n\'offre rien au téléphone', offre({ tag_name: 'v9.0.0', assets: [release.assets[1]] }, v, 'apk') === null);

// LA VERSION WEB : le sw.js du serveur, plus récent que le code qui tourne, offre la mise à jour ; jamais un fichier.
exiger('la version Web : le serveur plus récent offre la mise à jour, sans fichier à télécharger', (o => !!o && o.web && o.version === '9.0.0' && !o.url)(offreWeb("const VERSION = 'cap82-9.0.0';", v)));
exiger('… le serveur à la même version, ou une plus vieille, ou illisible, n\'offre rien', offreWeb(sw, v) === null && offreWeb("const VERSION = 'cap82-1.0.0';", v) === null && offreWeb('<html>404</html>', v) === null);
const maj = fs.readFileSync(new URL('../js/mise-a-jour.js', import.meta.url), 'utf8');
exiger('… et la mise à jour ne touche jamais au stockage (les parties restent)', !/localStorage\.(removeItem|clear)|indexedDB\.deleteDatabase|caches\.delete/.test(maj));

// L'APK et la release lisent la même version que le menu, au même endroit (une regex chacun : on les rejoue ici).
const gradle = fs.readFileSync(new URL('../mobile/android/app/build.gradle', import.meta.url), 'utf8');
exiger('l\'APK prend sa version dans sw.js (versionCode qui monte avec elle)', /file\('\.\.\/\.\.\/\.\.\/sw\.js'\)/.test(gradle) && /versionCode codeDeVersion/.test(gradle) && /versionName nomDeVersion/.test(gradle));
const [ma, mi, pa] = v.split('.').map(Number);
exiger('… 3.2.0 donne un versionCode de 30200 : la suivante passe toujours par-dessus', ma * 10000 + mi * 100 + pa > 3 && 3 * 10000 + 2 * 100 + 1 > 3 * 10000 + 2 * 100, `${ma * 10000 + mi * 100 + pa}`);
const flux = fs.readFileSync(new URL('../.github/workflows/publier.yml', import.meta.url), 'utf8');
exiger('la release porte l\'étiquette v<version> et les deux fichiers que le menu cherche', /gh release create "v\$V"/.test(flux) && /Cap-82-0\.apk/.test(flux) && /Cap-82-0-installateur\.exe/.test(flux));

verdict();
