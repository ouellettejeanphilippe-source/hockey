/*
 * LE NEUF NE S'APPUIE PAS SUR L'ANCIEN (V28, docs/refonte-v28.md § 7 et § 10). Vingt refontes sont retombées sur le même
 * jeu parce que chaque écran neuf rouvrait le Bureau et la cédule. Ce juge lit les modules de la run en carte (`js/run.js`
 * et `js/run-*.js`), sans leurs commentaires, contre le devis :
 *
 *   1. aucun n'importe un fichier nommé à « Ce qui part » (§ 8), ni ne nomme une fonction, une constante ou une classe qui
 *      y est ;
 *   2. aucune ligue jouée en coulisse : ni `creerLigue`, ni `jouerJournee` (la run joue des matchs isolés) ;
 *   3. le cœur (`js/run.js`) ne touche ni au DOM ni au stockage : les robots le jouent tel quel, hors du navigateur.
 *
 *   node scripts/check_neuf.mjs            (une seconde, dans `tout.mjs`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';
import { sansCommentaires, partie, codes, motifDe } from './lib/devis.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEVIS = 'docs/refonte-v28.md';
const LIGUE = ['creerLigue', 'jouerJournee'];
const NAVIGATEUR = ['document', 'window', 'localStorage', 'sessionStorage'];

const neufs = fs.readdirSync(path.join(RACINE, 'js')).filter(f => /^run(-[\w-]+)?\.js$/.test(f)).map(f => ({ f: `js/${f}`, texte: sansCommentaires(fs.readFileSync(path.join(RACINE, 'js', f), 'utf8')) }));
exiger('la run en carte a ses modules', neufs.some(x => x.f === 'js/run.js') && neufs.length >= 2, neufs.map(x => x.f).join(', '));

const partants = codes(partie(fs.readFileSync(path.join(RACINE, DEVIS), 'utf8'), 'Ce qui part'));
exiger('« Ce qui part » du devis se lit', partants.length >= 40, `${partants.length} noms dans ${DEVIS}`);

const fautes = [];
for (const { f, texte } of neufs) {
  const importes = [...texte.matchAll(/from\s+'\.\/([\w./-]+)'/g)].map(m => `js/${m[1]}`);
  for (const nom of partants) {
    if (/\.(js|mjs)$/.test(nom)) { if (importes.includes(nom)) fautes.push(`${f} importe ${nom}`); }
    else if (motifDe(nom).test(texte)) fautes.push(`${f} nomme ${nom}`);
  }
}
exiger('aucun module de la run ne s\'appuie sur ce qui part', !fautes.length, fautes.slice(0, 8).join(' · ') || `${neufs.length} modules lus contre ${partants.length} noms`);

const ligue = neufs.flatMap(({ f, texte }) => LIGUE.filter(n => motifDe(n).test(texte)).map(n => `${f} : ${n}`));
exiger('aucune ligue jouée en coulisse', !ligue.length, ligue.join(' · '));

const coeur = neufs.find(x => x.f === 'js/run.js');
const dom = coeur ? NAVIGATEUR.filter(n => motifDe(n).test(coeur.texte)) : ['absent'];
exiger('le cœur de la run ne touche ni au DOM ni au stockage', !dom.length, dom.join(', '));
informer('les modules', neufs.map(x => `${x.f} (${x.texte.split('\n').length} lignes)`).join(' · '));
verdict('Le neuf sans l\'ancien');
