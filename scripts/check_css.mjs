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
const PLAFOND_DOUBLONS = 20;
const PLAFOND_IMPORTANT = 6;

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

/*
 * 3. LE SYSTÈME DE DESIGN (1.0, la refonte — docs/refonte-ui.md) : sept
 * tailles, trois rayons, une vingtaine de couleurs, toutes des jetons. On
 * compte ce qui s'en écarte HORS des jetons (:root) : une taille écrite en
 * px, un rayon en px, une couleur en hexadécimal ou en rgba.
 *
 * R5, la peau (oct.) : AUCUN écart dans l'interface. Deux blocs ont leurs
 * propres règles et leurs propres plafonds, qui ne montent pas : le carton de
 * collection (4b, ses dix séries : le papier, le chrome, l'or — des palettes
 * de cartes, pas des couleurs d'écran) et le plateau de Sur table (10, ses
 * tailles suivent la case, `--tcell`).
 */
const PLAFOND_COULEURS_CARTON = Number(process.env.PLAFOND_COULEURS_CARTON ?? 301);
const PLAFOND_TAILLES_PLATEAU = Number(process.env.PLAFOND_TAILLES_PLATEAU ?? 6);
const bloc = (debut, fin) => {
  const i = src.indexOf(debut), j = fin ? src.indexOf(fin, i) : src.length;
  if (i < 0 || j < 0) throw new Error(`style.css : le bloc « ${debut} » est introuvable`);
  return [i, j];
};
const CARTON = bloc('4b. LE CARTON DE COLLECTION', '(B) LA FICHE DU JOUEUR');
const PLATEAU = bloc('/* == 10. SUR TABLE', null);
const sansJetons = t => t.replace(/:root[^{]*\{[^}]*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const mesurer = t => ({
  tailles: (t.match(/font(?:-size)?:[^;]*?\b\d+(?:\.\d+)?px/g) || []).length,
  rayons: (t.match(/border-radius:[^;]*?\b\d+(?:\.\d+)?px/g) || []).filter(x => !/50%/.test(x)).length,
  couleurs: (t.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) || []).length,
});
const [a0, b0] = CARTON, [a1, b1] = PLATEAU;
const interface_ = mesurer(sansJetons(src.slice(0, a0) + src.slice(b0, a1) + src.slice(b1)));
const carton = mesurer(sansJetons(src.slice(a0, b0))), plateau = mesurer(sansJetons(src.slice(a1, b1)));
exiger('aucune taille de police en px dans l\'interface (les sept tailles sont --t-1 à --t-7)', interface_.tailles === 0, `${interface_.tailles}`);
exiger('aucun rayon en px dans l\'interface (--r-0, --r-1, --r-2)', interface_.rayons === 0, `${interface_.rayons}`);
exiger('aucune couleur écrite en dur dans l\'interface (toutes des jetons)', interface_.couleurs === 0, `${interface_.couleurs}`);
exiger(`le carton : ${PLAFOND_COULEURS_CARTON} couleurs de ses séries au plus, aucune taille ni rayon en px`, carton.couleurs <= PLAFOND_COULEURS_CARTON && !carton.tailles && !carton.rayons,
  `${carton.couleurs} couleurs · ${carton.tailles} tailles · ${carton.rayons} rayons`);
exiger(`le plateau : ${PLAFOND_TAILLES_PLATEAU} tailles bornées en px au plus (elles suivent la case), aucune couleur ni rayon en px`, plateau.tailles <= PLAFOND_TAILLES_PLATEAU && !plateau.couleurs && !plateau.rayons,
  `${plateau.tailles} tailles · ${plateau.couleurs} couleurs · ${plateau.rayons} rayons`);
verdict('Le CSS');
