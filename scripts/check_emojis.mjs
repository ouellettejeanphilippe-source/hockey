/*
 * LES ÉMOJIS AU TRAIT (R5, la peau ; docs/refonte-ui.md, règle 7). Les mots du jeu gardent leur émoji dans le code, et
 * la police Noto Emoji le rend en monochrome, de la couleur du texte. Un émoji que ses tranches ne dessinent pas sort
 * en autocollant de couleur, celui du téléphone : en octobre, 294 des 544 pictogrammes du jeu étaient dans ce cas,
 * l'abeille du Frelon et la tortue de la Tortue comprises. Ce script le refuse :
 *
 *   1. chaque pictogramme que le jeu écrit (js/, data/, index.html, commentaires exclus) est dans une tranche, sauf
 *      les trois symboles de texte que Noto Emoji n'a pas (la police du texte les rend) ;
 *   2. la `unicode-range` de chaque @font-face de style.css dit exactement ce que sa tranche dessine (sinon le
 *      navigateur charge la mauvaise, ou aucune) ;
 *   3. une séquence liée (🧑‍💼) est entière dans UNE tranche, liaison comprise, et ses pièces dans aucune autre : le
 *      navigateur choisit sa police caractère par caractère, et une pièce prise ailleurs coupe la séquence ;
 *   4. aucun sélecteur de variante émoji (U+FE0F) hors d'une séquence : il demande l'autocollant de couleur, et Chrome
 *      le sert même quand la tranche a le caractère (❄️, ⚠️ sortaient en couleur) ;
 *   5. sw.js garde chaque tranche hors ligne, et aucune autre police d'émojis.
 *
 * Un émoji neuf : `node scripts/emojis.mjs <tranches Fontsource>` refait les polices (voir son en-tête).
 *
 *   node scripts/check_emojis.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';
import { pictogrammesDuJeu, sequencesDuJeu, cmapWoff2 } from './lib/emojis.mjs';
import { lireSources } from './lib/mort.mjs';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Des symboles de texte, pas des émojis : Noto Emoji ne les a pas, Barlow ou la police du système les rend.
const TEXTE = new Set(['★', '⚑', '🂠']);

const css = fs.readFileSync(path.join(RACINE, 'style.css'), 'utf8');
const faces = [...css.matchAll(/@font-face \{ font-family: "Noto Emoji";[^}]*src: url\("fonts\/([^"]+)"\)[^}]*unicode-range: ([^;]+);/g)]
  .map(([, fichier, plage]) => ({ fichier, plage }));
const points = plage => {
  const out = new Set();
  for (const p of plage.split(',').map(x => x.trim().replace(/^U\+/i, ''))) {
    const [a, b = a] = p.split('-').map(x => parseInt(x, 16));
    for (let x = a; x <= b; x++) out.add(x);
  }
  return out;
};

const dessines = new Set();
const ecarts = [];
const sequences = [...sequencesDuJeu(RACINE)].map(q => [...q].map(c => c.codePointAt(0)).filter(p => p !== 0xFE0F && p !== 0x200D));
const plages = new Map(faces.map(f => [f.fichier, points(f.plage)]));
for (const f of faces) {
  const cmap = cmapWoff2(path.join(RACINE, 'fonts', f.fichier));
  f.cmap = cmap;
  for (const p of cmap) dessines.add(p);
  // La plage ne nomme pas le sélecteur de variante (un « ❄️ » chargerait sinon toutes les tranches), ni la liaison,
  // sauf dans une tranche qui porte une séquence liée.
  const porte = sequences.some(q => q.every(p => cmap.has(p)));
  const voulue = new Set([...cmap].filter(p => p !== 0xFE0F && (p !== 0x200D || porte) && p > 0x7F));
  const dite = plages.get(f.fichier);
  const trop = [...dite].filter(p => !voulue.has(p)), manque = [...voulue].filter(p => !dite.has(p));
  if (trop.length || manque.length) ecarts.push(`${f.fichier} : ${trop.length} de trop, ${manque.length} manquants`);
}
informer('les tranches', `${faces.length} polices, ${dessines.size} points dessinés`);

const jeu = pictogrammesDuJeu(RACINE);
const absents = [...jeu].filter(c => !TEXTE.has(c) && !dessines.has(c.codePointAt(0)));
exiger('chaque émoji du jeu est dessiné au trait', faces.length > 0 && !absents.length,
  absents.length ? `${absents.length} en couleur : ${absents.slice(0, 30).join(' ')} — node scripts/emojis.mjs les ajoute` : `${jeu.size} pictogrammes, dont ${TEXTE.size} symboles de texte`);
exiger('chaque unicode-range dit ce que sa tranche dessine', faces.length > 0 && !ecarts.length, ecarts.join(' · ') || 'au point près');

const coupees = sequences.filter(q => {
  const chez = faces.filter(f => q.every(p => f.cmap.has(p) && plages.get(f.fichier).has(p)) && plages.get(f.fichier).has(0x200D));
  const ailleurs = faces.filter(f => q.some(p => plages.get(f.fichier).has(p)));
  return chez.length !== 1 || ailleurs.length !== 1;
});
exiger('chaque séquence liée est entière dans une seule tranche', !coupees.length,
  coupees.length ? `coupées : ${coupees.map(q => String.fromCodePoint(...q)).join(' ')}` : `${sequences.length} séquences`);

const { code } = lireSources(RACINE);
const vs16 = Object.entries(code).filter(([f]) => f.startsWith('js/') || f.startsWith('data/') || f === 'index.html')
  .flatMap(([f, c]) => [...c.matchAll(/(.)\uFE0F(?!\u200D)/gu)].map(m => `${f} ${m[1]}`));
exiger('aucun U+FE0F hors d\'une séquence (il demande la couleur)', !vs16.length, vs16.length ? `${vs16.length} : ${vs16.slice(0, 8).join(' · ')}` : 'aucun');

const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
const listees = [...sw.matchAll(/'fonts\/(NotoEmoji-[^']+)'/g)].map(m => m[1]);
const surDisque = fs.readdirSync(path.join(RACINE, 'fonts')).filter(f => /^NotoEmoji-.*\.woff2$/.test(f));
const attendues = faces.map(f => f.fichier);
exiger('sw.js garde chaque tranche hors ligne, et rien d\'autre', attendues.every(f => listees.includes(f)) && listees.every(f => attendues.includes(f)) && surDisque.every(f => attendues.includes(f)),
  `${listees.length} listées, ${surDisque.length} sur disque, ${attendues.length} déclarées`);

verdict('Les émojis au trait');
