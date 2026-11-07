/*
 * LES COUCHES DU MOTEUR (V25, tranche A1 ; docs/refonte-v25.md § 4 A). Avant la
 * V25, js/sim.js importait js/combat.js, lisait les cartes, les plans adverses,
 * la préparation, les incidents de l'entracte ; le Rogue vivait DANS le moteur,
 * et chaque mode (le 82-0, Sur table, l'exhibition) traînait ce qu'il ne joue
 * pas. Depuis A1, le moteur est pur et le Rogue s'y GREFFE : js/greffes.js
 * importe js/sim.js, jamais l'inverse, et se branche par `brancherGreffes`.
 *
 * Trois invariants, lus dans le code :
 *
 *   1. js/sim.js, de proche en proche, n'importe aucun module du Rogue ni
 *      js/greffes.js (la liste `ROGUE` : ce qui parle de cartes, de coach, de
 *      jetons, d'histoires, d'écran).
 *   2. js/greffes.js importe js/sim.js et appelle `brancherGreffes` avec un
 *      objet qui porte CHAQUE crochet que sim.js lit (`GREFFES.nom(`) : un
 *      crochet lu et jamais posé planterait la première ligue du Rogue.
 *   3. La page charge js/greffes.js (depuis index.html, de proche en proche) :
 *      sans ça, une ligue du Rogue dans le navigateur tomberait sur
 *      `exigerGreffes`.
 *
 * Et, depuis A2 (une source pour trois modes) :
 *
 *   4. Le hasard et le hachage ont UNE définition, dans js/util.js :
 *      `generateur`, `gauss`, `entierDeGraine`, `hache` ; aucune mulberry32,
 *      aucun `hacherMise` ailleurs. Le moteur, Sur table (js/table.js), Sur
 *      glace (js/physique.js) et le direct lisent le générateur de util.js.
 *   5. Sur table et Sur glace lisent les cotes sur 20 de la fiche (`axes20`,
 *      `cote20`, js/niveaux.js), jamais une conversion à eux.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { exiger, informer, verdict } from './verdict.mjs';

const lire = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const normaliser = p => posix.normalize(p).replace(/^\//, '');

const ROGUE = new Set(['js/greffes.js', 'js/pouvoirs.js', 'js/adjoints.js', 'js/coachs.js', 'js/coachs-reels.js',
  'js/histoires.js', 'js/faits.js', 'js/vie-gm.js', 'js/scenes.js', 'js/recit.js', 'js/rogue.js', 'js/rogue-jeu.js',
  'js/impact.js', 'js/banque.js', 'js/packs.js', 'js/cartable.js', 'js/galons.js', 'js/inventaire.js',
  'js/saison.js', 'js/gerant.js', 'js/direct.js', 'js/game.js', 'js/composants.js']);

/** Les modules atteints depuis `depart`, de proche en proche. */
function atteints(depart) {
  const vus = new Set();
  const file = [...depart];
  while (file.length) {
    const f = file.shift();
    if (vus.has(f)) continue;
    vus.add(f);
    const dossier = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
    for (const m of lire(f).matchAll(/from\s+'([^']+)'|^import\s+'([^']+)'/gm)) {
      const cible = m[1] || m[2];
      file.push(normaliser(dossier ? `${dossier}/${cible}` : cible));
    }
  }
  return vus;
}

// 1. Le moteur, pur.
const depuisSim = atteints(['js/sim.js']);
const fautes = [...depuisSim].filter(f => ROGUE.has(f));
exiger('js/sim.js n\'atteint aucun module du Rogue ni js/greffes.js', !fautes.length,
  fautes.length ? fautes.join(', ') : `${depuisSim.size - 1} modules atteints, tous du moteur`);
informer('ce que le moteur importe', [...depuisSim].filter(f => f !== 'js/sim.js').join(', '));

// 2. Les greffes posent chaque crochet lu.
const sim = lire('js/sim.js');
const greffes = lire('js/greffes.js');
const lus = new Set([...sim.matchAll(/GREFFES\.([a-zA-Z]+)\(/g)].map(m => m[1]));
const branche = greffes.match(/brancherGreffes\(\{([^}]*)\}\)/);
const poses = new Set((branche ? branche[1] : '').split(',').map(s => s.trim().split(':')[0]).filter(Boolean));
exiger('js/greffes.js importe js/sim.js et se branche', atteints(['js/greffes.js']).has('js/sim.js') && !!branche,
  branche ? `${poses.size} crochets posés` : 'brancherGreffes absent');
const manquants = [...lus].filter(h => !poses.has(h));
exiger('chaque crochet lu par sim.js est posé par les greffes', !manquants.length,
  manquants.length ? `manquent : ${manquants.join(', ')}` : [...lus].sort().join(', '));
const enTrop = [...poses].filter(h => !lus.has(h));
exiger('aucun crochet posé que sim.js ne lit pas', !enTrop.length, enTrop.length ? `en trop : ${enTrop.join(', ')}` : 'aucun');

// 3. La page charge les greffes.
const html = lire('index.html');
const racines = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map(m => normaliser(m[1]));
exiger('la page charge js/greffes.js', atteints(racines).has('js/greffes.js'), `depuis ${racines.join(', ')}`);

// 4. Une seule source du hasard.
const JS = readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => `js/${f}`);
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
const definitions = nom => JS.filter(f => new RegExp(`^(export )?(function|const|let) ${nom}\\b`, 'm').test(sansCommentaires(lire(f))));
for (const nom of ['generateur', 'gauss', 'entierDeGraine', 'hache']) {
  const ou = definitions(nom);
  exiger(`\`${nom}\` n'a qu'une définition, dans js/util.js`, ou.length === 1 && ou[0] === 'js/util.js', ou.join(', ') || 'aucune');
}
const doubles = JS.filter(f => /0x6D2B79F5|hacherMise/i.test(sansCommentaires(lire(f))));
exiger('aucune mulberry32, aucun hacherMise dans js/', !doubles.length, doubles.join(', ') || 'aucun');
const importeDe = (f, module, nom) => new RegExp(`import \\{[^}]*\\b${nom}\\b[^}]*\\} from '\\./${module}'`).test(lire(f));
for (const f of ['js/sim.js', 'js/table.js', 'js/physique.js', 'js/direct.js']) {
  exiger(`${f} lit \`generateur\` dans js/util.js`, importeDe(f, 'util.js', 'generateur'), '');
}
// 5. Les cotes sur 20, la même source pour les trois modes.
for (const f of ['js/table.js', 'js/sur-glace.js']) {
  exiger(`${f} lit ses cotes dans js/niveaux.js (axes20)`, importeDe(f, 'niveaux.js', 'axes20'), '');
}

verdict('Les couches du moteur (V25 A1, A2)');
