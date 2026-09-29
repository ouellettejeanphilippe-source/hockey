/*
 * UNE DÉFINITION PAR COMPOSANT (1.0, jalon 3). Chaque couche redéfinissait un
 * composant par-dessus au lieu de le modifier, et la cascade tranchait en
 * silence : `:root` six fois, `.topbar` cinq fois. Ce script compte, par
 * contexte (la même chaîne de @media / @container / @supports) :
 *
 *   1. les sélecteurs déclarés deux fois ou plus. Ceux qui restent ne se
 *      fusionnent pas sans changer le rendu : une règle entre les deux vise le
 *      même élément avec la même spécificité. Le nombre ne doit pas monter ;
 *   2. les `!important` hors des blocs `prefers-reduced-motion`, où couper toute
 *      animation pour qui le demande est l'usage voulu du mot. Même plafond.
 *
 * Il imprime aussi la taille du fichier.
 *
 *   node scripts/check_css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';
import { regles } from './lib/css.mjs';

// Les plafonds : le compte à la fusion (J3-3). On les baisse, on ne les monte pas.
const PLAFOND_DOUBLONS = 59;
const PLAFOND_IMPORTANT = 23;

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const rs = regles(src);

// 1. Les doublons, par contexte.
const vus = new Map();
for (const r of rs) {
  const k = `${r.contexte} ¦ ${r.selecteur}`;
  if (!vus.has(k)) vus.set(k, []);
  vus.get(k).push(r.ligne);
}
const doublons = [...vus].filter(([, l]) => l.length > 1);
exiger(`${PLAFOND_DOUBLONS} sélecteurs en double au plus dans un même contexte`, doublons.length <= PLAFOND_DOUBLONS,
  `${doublons.length}${doublons.length ? ' : ' + doublons.slice(0, 4).map(([k, l]) => `${k.split(' ¦ ')[1]} (l. ${l.join(', ')})`).join(' · ') + (doublons.length > 4 ? ' …' : '') : ''}`);

// 2. Les !important, hors prefers-reduced-motion.
const compte = t => (t.replace(/\/\*[\s\S]*?\*\//g, '').match(/!\s*important/g) || []).length;
const imp = rs.filter(r => !/prefers-reduced-motion/.test(r.contexte)).reduce((a, r) => a + compte(r.corps), 0);
const impRm = rs.filter(r => /prefers-reduced-motion/.test(r.contexte)).reduce((a, r) => a + compte(r.corps), 0);
exiger(`${PLAFOND_IMPORTANT} \`!important\` au plus (hors prefers-reduced-motion)`, imp <= PLAFOND_IMPORTANT, `${imp} (et ${impRm} dans les blocs prefers-reduced-motion)`);

informer('la feuille', `${(Buffer.byteLength(src) / 1024).toFixed(0)} Ko · ${rs.length} règles`);
verdict('Le CSS');
