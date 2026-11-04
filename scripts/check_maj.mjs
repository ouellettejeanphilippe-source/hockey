/*
 * LA MISE À JOUR DE LA VERSION WEB (1er nov. 2026, js/mise-a-jour.js ; web seulement depuis le 4 nov. 2026) : la
 * version qui tourne (js/version.js) est celle de sw.js, un sw.js plus récent au serveur est une version neuve, et
 * la prendre ne touche jamais au stockage.
 *
 *   node scripts/check_maj.mjs
 */
import fs from 'node:fs';
import { exiger, verdict } from './verdict.mjs';
import { versionDe, plusRecente, versionNeuve } from '../js/mise-a-jour.js';
import { VERSION } from '../js/version.js';

const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const v = versionDe(sw);
exiger('la version du jeu se lit dans sw.js', /^\d+\.\d+\.\d+$/.test(v || ''), v || 'rien');
exiger('le code qui tourne dit la même version que sw.js (js/version.js : les deux montent ensemble)', VERSION === v, `${VERSION} et ${v}`);
exiger('… et nulle part ailleurs', versionDe("const VERSION = 'cap82-3.10.1';") === '3.10.1' && versionDe('v3.2.0') === null && versionDe('n\'importe quoi') === null);
exiger('3.10.0 est plus récente que 3.9.4, chiffre par chiffre', plusRecente('3.10.0', '3.9.4') && !plusRecente('3.9.4', '3.10.0'));
exiger('… la même version ne l\'est pas, ni une plus vieille', !plusRecente('3.2.0', '3.2.0') && !plusRecente('3.1.9', '3.2.0') && plusRecente('3.2.1', '3.2.0'));

// LA VERSION WEB se met à jour toute seule : le serveur plus récent est vu, le cache HTTP n'est plus lu, rien n'est effacé.
exiger('la version Web : un sw.js plus récent au serveur est une version neuve', versionNeuve("const VERSION = 'cap82-9.0.0';", v) === '9.0.0');
exiger('… la même, une plus vieille, ou une page illisible, non', versionNeuve(sw, v) === null && versionNeuve("const VERSION = 'cap82-1.0.0';", v) === null && versionNeuve('<html>404</html>', v) === null);
exiger('… le travailleur de service revalide chaque fichier auprès du serveur (le max-age de GitHub Pages ne sert plus du vieux)', /cache: 'no-cache'/.test(sw.slice(sw.indexOf('async function reseauDabord'), sw.indexOf('async function cacheDabord'))));
const maj = fs.readFileSync(new URL('../js/mise-a-jour.js', import.meta.url), 'utf8');
exiger('… et la mise à jour ne touche jamais au stockage (les parties restent)', !/localStorage\.(removeItem|clear)|indexedDB\.deleteDatabase|caches\.delete/.test(maj));

verdict();
