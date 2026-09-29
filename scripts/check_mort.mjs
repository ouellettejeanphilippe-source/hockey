/*
 * ZÉRO CODE INUTILE (1.0, jalon 3). Le jeu a porté jusqu'à 31 déclarations
 * mortes, 33 imports jamais employés, 216 `export` que personne n'importait et
 * 88 classes CSS sans élément : chacune se lisait, s'entretenait, se
 * recopiait, et aucune ne jouait. Ce script échoue si l'une revient.
 *
 *   1. une déclaration du haut d'un module de js/ que rien ne lit — dans son
 *      fichier si elle n'est pas exportée, n'importe où (js/, data/, scripts/,
 *      index.html, sw.js) si elle l'est ;
 *   2. un `export` que personne n'importe (le module l'emploie seul : le mot
 *      `export` est de trop) ;
 *   3. un nom importé que le module n'emploie jamais ;
 *   4. une classe de style.css qu'aucun élément ne porte — ni index.html, ni
 *      une chaîne de js/ ; une classe fabriquée (`tc-${rareté}`, `lz${n}`) est
 *      protégée par sa racine.
 *
 * Le décompte est prudent (scripts/lib/mort.mjs) : un nom compte dès qu'il
 * paraît, même dans une chaîne ou comme propriété. Ce script ne condamne
 * jamais un vivant ; un mort qui porte le nom d'un vivant peut lui échapper.
 *
 *   node scripts/check_mort.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';
import { lireSources, declarations, occurrences, occurrencesClasse, importeDeHors, importsInutiles, classesCss, prefixesDynamiques } from './lib/mort.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const t0 = Date.now();
const { code } = lireSources(ROOT);
const jsFiles = Object.keys(code).filter(f => f.startsWith('js/'));

/*
 * LES EXCEPTIONS, CHACUNE AVEC SA RAISON. Une exception sans raison est un
 * mort qu'on a renoncé à enterrer.
 */
// `export` gardé : un item ouvert de LIVRAISON.md les nomme (un chantier en cours peut les importer).
const EXPORTS_GARDES = new Set(['leagueStats', 'finirPresence', 'BORNES', 'EFFET']);
// Classes gardées : les tuiles du hub d'avant S77, que le chantier du hub sur bureau (jalon 2, item 7) peut reprendre.
// À retirer d'ici, et de style.css si elles restent sans élément, une fois ce chantier fusionné.
const CLASSES_GARDEES = new Set(['hub-tuiles', 'hub-tuiles-grille', 'hub-t-classement', 'hub-t-deck', 'hub-t-forme', 'hub-t-infirmerie',
  'hub-t-proprio', 'tuiles', 'tuile-coin', 'tuile-grande', 'tuile-pied', 'tuile-tete', 'tuile-vide']);

/* 1 et 2. Les déclarations mortes, et les `export` de trop. */
const mortes = [], exportsDeTrop = [];
let nDecl = 0, nExports = 0;
for (const f of jsFiles) {
  for (const d of declarations(code[f])) {
    nDecl++;
    const ici = occurrences(code[f], d.nom) - 1;
    const ailleurs = d.exporte ? Object.entries(code).filter(([g]) => g !== f).reduce((a, [, c]) => a + occurrences(c, d.nom), 0) : 0;
    if (ici + ailleurs <= 0) { mortes.push(`${f}:${d.ligne} ${d.nom}`); continue; }
    if (!d.exporte) continue;
    nExports++;
    if (EXPORTS_GARDES.has(d.nom)) continue;
    if (!importeDeHors(code, f, d.nom).length) {
      // Une ligne qui exporte plusieurs constantes ne perd son `export` que si AUCUNE n'est importée : on la juge entière.
      const ligne = code[f].split('\n')[d.ligne - 1];
      const noms = [...ligne.matchAll(/(?:^export\s+(?:const|let|var)\s+|,\s*)([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1]);
      if (noms.length > 1 && noms.some(n => n !== d.nom && importeDeHors(code, f, n).length)) continue;
      exportsDeTrop.push(`${f}:${d.ligne} ${d.nom}`);
    }
  }
}
exiger('aucune déclaration morte dans js/', !mortes.length, mortes.length ? mortes.slice(0, 12).join(' · ') : `${nDecl} déclarations lues`);
exiger('aucun « export » que personne n\'importe', !exportsDeTrop.length, exportsDeTrop.length ? `${exportsDeTrop.length} : ${exportsDeTrop.slice(0, 10).join(' · ')}` : `${nExports} exports, tous importés quelque part (${EXPORTS_GARDES.size} gardés pour un item ouvert)`);

/* 3. Les imports jamais employés. */
const imports = [];
for (const f of Object.keys(code).filter(f => f.startsWith('js/') || f.startsWith('data/'))) for (const n of importsInutiles(code[f])) imports.push(`${f} ${n}`);
exiger('aucun nom importé pour rien', !imports.length, imports.length ? imports.slice(0, 12).join(' · ') : 'chaque nom importé sert');

/* 4. Les classes CSS sans élément. */
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const classes = classesCss(css);
const prefixes = [...prefixesDynamiques(code)];
const tout = Object.entries(code).filter(([f]) => f.startsWith('js/') || f === 'index.html').map(([, c]) => c).join('\n');
const classesMortes = [...classes].filter(c => !CLASSES_GARDEES.has(c) && !occurrencesClasse(tout, c) && !prefixes.some(p => c.startsWith(p)));
exiger('aucune classe CSS sans élément', !classesMortes.length, classesMortes.length ? `${classesMortes.length} : ${classesMortes.slice(0, 12).join(' ')}` : `${classes.size} classes, ${prefixes.length} racines fabriquées, ${CLASSES_GARDEES.size} gardées`);
const gardeesVivantes = [...CLASSES_GARDEES].filter(c => occurrencesClasse(tout, c) || !classes.has(c));
informer('classes gardées qui n\'ont plus besoin de l\'être', gardeesVivantes.length ? `${gardeesVivantes.join(' ')} (servent de nouveau, ou ont quitté style.css : retire-les de CLASSES_GARDEES)` : 'aucune');

verdict(`Le code mort · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
