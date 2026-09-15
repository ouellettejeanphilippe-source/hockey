/*
 * LA COQUILLE HORS LIGNE — sw.js tient-il sa promesse ?
 *
 * `sw.js` promet « le jeu entier hors ligne, après une première visite », et
 * CLAUDE.md en fait une règle ferme. Deux trous trouvés, et la mesure a
 * corrigé ce que je croyais du premier :
 *
 * (1) Cinq modules ajoutés depuis (entracte, plateau, saison, table, tournoi)
 *     n'étaient jamais entrés dans `FICHIERS`. Je les croyais fatals — ils ne
 *     l'étaient PAS : `reseauDabord` garde chaque réponse réussie, et ces
 *     modules sont importés statiquement, donc la première visite en ligne
 *     les met au cache d'elle-même. Vérifié dans Chromium : l'ancien
 *     travailleur rendait la page hors ligne, 26 entrées au cache. Le
 *     préchargement reste la bonne façon de l'écrire (un module ajouté plus
 *     tard et chargé tard, lui, manquerait), mais ce n'était pas le bogue.
 *
 * (2) `data/seed.json` — LUI est un vrai trou, et un trou muet. `estShard()`
 *     l'envoyait au réseau SEULEMENT, alors que `js/data.js` le nomme « filet
 *     hors ligne » et ne le demande QUE lorsque le réseau a déjà échoué. Il
 *     n'entrait donc jamais au cache par la porte d'à côté. Mesuré, hors
 *     ligne, même page, même profil : `fetch('data/seed.json')` rendait
 *     « Failed to fetch » avec l'ancien travailleur et « ok » avec le
 *     nouveau. Une saison jamais chargée n'avait aucun filet.
 *
 * Un trou de ce genre ne se voit ni à l'écran ni dans une console en ligne,
 * et il revient à chaque fichier ajouté. Il se VÉRIFIE donc, comme les 44
 * codes d'équipe de `TEAM_COLORS`. Ce script part de `index.html`, suit les
 * `import` de proche en proche (aucun n'est dynamique — vérifié), ramasse
 * aussi ce que la page et la feuille de style demandent, et compare au
 * tableau.
 *
 * Ce qu'il ne couvre PAS, exprès : `data/seasons/*.json`. IndexedDB s'en
 * occupe déjà avec la version des cotes dans sa clé, et préécrire 55 shards
 * coûterait des mégaoctets à la première visite.
 */

import { readFileSync } from 'node:fs';
import { exiger, informer, verdict } from './verdict.mjs';

const lire = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Le tableau FICHIERS de sw.js, lu là où il vit plutôt que recopié.
const sw = lire('sw.js');
const bloc = sw.match(/const FICHIERS = \[([\s\S]*?)\];/);
const FICHIERS = new Set((bloc ? bloc[1] : '').match(/'[^']+'/g)?.map(s => s.slice(1, -1)) ?? []);

// Un chemin relatif à la portée du travailleur, normalisé comme sw.js l'écrit.
const normaliser = p => p.replace(/^\.\//, '').replace(/^\//, '');

/** Le graphe des modules, depuis les <script type="module"> de index.html. */
function graphe() {
  const html = lire('index.html');
  const vus = new Set();
  const file = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map(m => normaliser(m[1]));
  while (file.length) {
    const f = file.shift();
    if (vus.has(f)) continue;
    vus.add(f);
    const dossier = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
    for (const m of lire(f).matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;   // aucun paquet externe, mais au cas où
      const abs = new URL(spec, `file:///${dossier}/`).pathname.slice(1);
      file.push(abs);
    }
  }
  return [...vus].sort();
}

const modules = graphe();
const manquants = modules.filter(f => !FICHIERS.has(f));
exiger('tous les modules du graphe sont dans FICHIERS', !manquants.length,
  manquants.length ? manquants.join(', ') : `${modules.length} modules`);

// Ce que la page et la feuille de style demandent d'autre, et qui doit
// survivre à une coupure : styles, manifeste, icônes, police.
const html = lire('index.html');
const statiques = new Set();
for (const m of html.matchAll(/(?:href|src)="((?!https?:|data:|#)[^"]+)"/g)) {
  const p = normaliser(m[1]);
  if (p.endsWith('.js')) continue;                  // couvert par le graphe
  if (p.startsWith('data/seasons/')) continue;      // IndexedDB
  statiques.add(p);
}
for (const m of lire('style.css').matchAll(/url\(([^)]+)\)/g)) {
  const p = normaliser(m[1].replace(/['"]/g, '').trim());
  if (p.startsWith('data:') || p.startsWith('http')) continue;
  statiques.add(p);
}
const absents = [...statiques].filter(f => !FICHIERS.has(f)).sort();
exiger('styles, police, icônes et manifeste sont dans FICHIERS', !absents.length,
  absents.length ? absents.join(', ') : `${statiques.size} fichiers`);

// Le filet hors ligne de js/data.js : sans lui, une première visite coupée ne
// rend AUCUNE saison.
exiger('data/seed.json est dans la coquille', FICHIERS.has('data/seed.json'),
  FICHIERS.has('data/seed.json') ? 'le filet tient' : 'js/data.js le nomme « filet hors ligne »');
const seedReseau = /estShard\s*=[^;]*seed\.json/.test(sw);
exiger('data/seed.json n\'est pas exclu du cache', !seedReseau,
  seedReseau ? 'estShard() l\'envoie au réseau seulement' : 'servi par la coquille');

// Rien dans le tableau ne doit manquer sur le disque : `Promise.allSettled`
// avale silencieusement un chemin faux.
const morts = [...FICHIERS].filter(f => { try { lire(f === './' ? 'index.html' : f); return false; } catch { return true; } });
exiger('aucun chemin mort dans FICHIERS', !morts.length, morts.length ? morts.join(', ') : `${FICHIERS.size} chemins`);

informer('modules suivis', modules.join(' '));
verdict('La coquille hors ligne');
