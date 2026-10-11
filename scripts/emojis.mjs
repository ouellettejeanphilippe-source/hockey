/**
 * LES ÉMOJIS AU TRAIT (R5, la peau ; docs/refonte-ui.md, règle 7). Les mots du jeu gardent leur émoji dans le code ;
 * à l'écran, la police Noto Emoji (OFL 1.1) le rend en monochrome, de la couleur du texte, pareil sur tous les
 * appareils. Ce script refait ses sous-ensembles à partir des pictogrammes que le jeu écrit vraiment (js/, data/,
 * index.html, commentaires exclus) : un émoji neuf qui n'y entre pas sortirait en autocollant de couleur
 * (`check_emojis` le refuse).
 *
 * Les tranches suivent celles de Fontsource (la police variable, graisse 300 à 700, découpée en onze) ; chacune
 * garde ce que le jeu en emploie, et sa `unicode-range` le dit : le navigateur ne charge que les tranches dont un
 * caractère est à l'écran. Une séquence liée (🧑‍💼) se dessine d'un seul glyphe : ses pièces vont toutes dans la
 * tranche qui les a, et dans aucune autre (le navigateur choisit sa police caractère par caractère). Le sélecteur de variante (U+FE0F) et la liaison (U+200D) sont dans chaque police, mais hors
 * des `unicode-range` — sinon un seul « ❄️ » ferait charger les onze —, sauf la liaison d'une tranche qui porte une séquence.
 *
 *   mkdir /tmp/noto && cd /tmp/noto && npm init -y && npm i @fontsource-variable/noto-emoji
 *   pip install fonttools brotli
 *   node scripts/emojis.mjs /tmp/noto/node_modules/@fontsource-variable/noto-emoji/files
 *
 * Il écrit fonts/NotoEmoji-<tranche>.woff2, le bloc @font-face de style.css (à sa place, sous son commentaire) et la
 * liste hors ligne de sw.js. Aucune dépendance du jeu : fontTools ne sert qu'ici.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pictogrammesDuJeu, sequencesDuJeu } from './lib/emojis.mjs';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2];
if (!SOURCE || !fs.existsSync(SOURCE)) {
  console.error('usage : node scripts/emojis.mjs <dossier des tranches Fontsource de Noto Emoji>');
  process.exit(1);
}

const voulus = [...pictogrammesDuJeu(RACINE)].map(c => c.codePointAt(0));
// Une séquence liée (🧑‍💼) se dessine d'un seul glyphe : ses pièces vont ensemble, dans la tranche qui les a toutes.
const sequences = [...sequencesDuJeu(RACINE)].map(q => [...q].map(c => c.codePointAt(0)).filter(p => p !== 0xFE0F && p !== 0x200D));
const PY = `
import sys, json, glob, os
from fontTools.ttLib import TTFont
from fontTools import subset
source, sortie = sys.argv[1], sys.argv[2]
entree = json.loads(sys.stdin.read())
voulus, sequences = set(entree['voulus']), entree['sequences']
JOINTS = {0xFE0F, 0x200D}
pris, tranches = set(), []
def rang(p):
    return int(os.path.basename(p).split('-')[2])
chemins = sorted(glob.glob(os.path.join(source, 'noto-emoji-*-wght-normal.woff2')), key=rang)
cmaps = {p: set(TTFont(p).getBestCmap()) for p in chemins}
# Les séquences qui partagent une pièce (🧑‍💼, 🧑‍🏫…) font un groupe ; chaque groupe va à la première tranche qui a
# toutes ses pièces.
groupes = []
for q in sequences:
    lies_a = [g for g in groupes if g & set(q)]
    neuf = set(q).union(*lies_a)
    groupes = [g for g in groupes if g not in lies_a] + [neuf]
lies = {p: set() for p in chemins}
orphelines = []
for g in groupes:
    ou = next((p for p in chemins if g <= cmaps[p]), None)
    if ou: lies[ou] |= g
    else: orphelines.append(sorted(g))
# Ses pièces n'appartiennent qu'à elle : une pièce dans deux tranches, le navigateur la prend ailleurs et coupe la séquence.
pris = set().union(*lies.values())
for p in chemins:
    f = TTFont(p)
    cmap = cmaps[p]
    miens = ((voulus & cmap) - pris) | lies[p]
    if not miens:
        continue
    pris |= miens
    o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['*']; o.name_IDs = ['*']; o.notdef_outline = True
    s = subset.Subsetter(o); s.populate(unicodes=miens | (JOINTS & cmap)); s.subset(f)
    nom = 'NotoEmoji-%d.woff2' % rang(p)
    f.save(os.path.join(sortie, nom))
    # Une tranche qui porte une séquence liée dit aussi la liaison : sinon U+200D tombe dans la plage de Barlow et la séquence se coupe.
    tranches.append({'fichier': nom, 'points': sorted(miens | ({0x200D} if lies[p] else set()))})
print(json.dumps({'tranches': tranches, 'absents': sorted(voulus - pris), 'orphelines': orphelines}))
`;
const res = JSON.parse(execFileSync('python3', ['-c', PY, SOURCE, path.join(RACINE, 'fonts')], { input: JSON.stringify({ voulus, sequences }) }).toString());

// Les anciennes polices d'émojis qu'aucune tranche ne refait partent.
const gardes = new Set(res.tranches.map(t => t.fichier));
for (const f of fs.readdirSync(path.join(RACINE, 'fonts'))) if (/^NotoEmoji-.*\.woff2$/.test(f) && !gardes.has(f)) fs.unlinkSync(path.join(RACINE, 'fonts', f));

/* Des points de code en plages « U+1F3D2-1F3D4 ». */
const plages = pts => {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    let j = i;
    while (j + 1 < pts.length && pts[j + 1] === pts[j] + 1) j++;
    const h = x => x.toString(16).toUpperCase();
    out.push(i === j ? `U+${h(pts[i])}` : `U+${h(pts[i])}-${h(pts[j])}`);
    i = j;
  }
  return out.join(', ');
};
const faces = res.tranches.map(t => `@font-face { font-family: "Noto Emoji"; font-style: normal; font-weight: 300 700; font-display: swap; src: url("fonts/${t.fichier}") format("woff2"); unicode-range: ${plages(t.points)}; }`);

// style.css : le bloc se remplace à sa place, entre son commentaire et les jetons.
const cssF = path.join(RACINE, 'style.css');
const css = fs.readFileSync(cssF, 'utf8');
const debut = css.indexOf('/* ---- Noto Emoji');
const fin = css.indexOf('/* ---- Les jetons');
if (debut < 0 || fin < debut) throw new Error('style.css : le bloc Noto Emoji est introuvable');
const tete = css.slice(debut, css.indexOf('*/', debut) + 2).replace(/le sous-ensemble des \d+ émojis du jeu/, `les ${voulus.length - res.absents.length} pictogrammes du jeu, en ${res.tranches.length} tranches`);
fs.writeFileSync(cssF, `${css.slice(0, debut)}${tete}\n${faces.join('\n')}\n\n${css.slice(fin)}`);

// sw.js : la coquille hors ligne liste les tranches.
const swF = path.join(RACINE, 'sw.js');
const sw = fs.readFileSync(swF, 'utf8').replace(/^\s*'fonts\/NotoEmoji-[^\n]*\n/gm, '');
const ancre = sw.indexOf('];', sw.indexOf("'fonts/BarlowCondensed-800-latin.woff2'"));
const lignes = [];
for (let i = 0; i < res.tranches.length; i += 4) lignes.push(`  ${res.tranches.slice(i, i + 4).map(t => `'fonts/${t.fichier}'`).join(', ')},`);
fs.writeFileSync(swF, `${sw.slice(0, ancre)}${lignes.join('\n')}\n${sw.slice(ancre)}`);

const poids = res.tranches.reduce((a, t) => a + fs.statSync(path.join(RACINE, 'fonts', t.fichier)).size, 0);
console.log(`${res.tranches.length} tranches, ${voulus.length - res.absents.length} pictogrammes, ${Math.round(poids / 1024)} Ko`);
if (res.orphelines.length) console.log(`séquences liées sans tranche entière : ${res.orphelines.map(q => String.fromCodePoint(...q)).join(' ')}`);
if (res.absents.length) console.log(`hors de Noto Emoji (la police du texte les rend) : ${res.absents.map(x => String.fromCodePoint(x)).join(' ')}`);
