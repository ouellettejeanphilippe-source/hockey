/*
 * LE FICHIER TRANSFÉRABLE (1.0). Une partie exportée (js/sauvegardes.js,
 * `exporter`) doit revenir intacte par `importer`, sur un stockage vide comme
 * sur un autre appareil ; et un fichier qui n'est pas une partie doit être
 * refusé, jamais écrit. Le stockage est un faux `localStorage` en mémoire :
 * le module ne touche pas au DOM, il n'a besoin que de ça.
 *
 *   node scripts/check_sauvegardes.mjs
 */
import { exiger, verdict } from './verdict.mjs';

const memoire = new Map();
globalThis.localStorage = {
  getItem: k => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => { memoire.set(k, String(v)); },
  removeItem: k => { memoire.delete(k); },
};
const { ecrirePartieActive, lireIndex, lirePartieActive, exporter, importer, activer, supprimer } = await import('../js/sauvegardes.js');

// Une partie Rogue en cours, comme `saveGame` l'écrit : un tirage vide, un roster, une run.
const partie = { moteur: 'S82', bonus: 'ROGUE', tirage: [], roster: { 0: { n: 'Untel', s: '1993-94', _renfort: true }, 1: null }, mode: 'CLASSIQUE', rogue: { run: 3, jetons: 12 }, dette: 0, lignes: null };
ecrirePartieActive(partie, { etape: 'Saison 2', qui: 'NHL Stars' });
const source = lireIndex().parties[0];
const f = exporter(source.id);
exiger('exporter rend un nom et un texte', f && /^cap82-rogue-\d{4}-\d{2}-\d{2}\.json$/.test(f.nom) && typeof f.texte === 'string', f ? f.nom : 'rien');
exiger('exporter d\'un id inconnu rend null', exporter('inconnu') === null);

// Un autre appareil : stockage vide, on relit le fichier.
memoire.clear();
const id = importer(f.texte);
exiger('importer crée une partie', !!id);
const ix = lireIndex();
const p = ix.parties.find(x => x.id === id);
exiger('la partie importée est épinglée et marquée', p && p.copie === true && p.importee === true && p.genre === 'rogue' && p.titre === source.titre, p ? `${p.genre} · ${p.titre}` : 'absente');
exiger('son résumé suit', p && p.resume && p.resume.etape === 'Saison 2');
exiger('elle n\'est pas active d\'elle-même', ix.actif !== id);
activer(id);
exiger('la partie relue est identique', JSON.stringify(lirePartieActive()) === JSON.stringify(partie));

// Le même fichier importé deux fois : deux parties, pas une écrasée.
const id2 = importer(f.texte);
exiger('importer deux fois fait deux parties', id2 && id2 !== id && lireIndex().parties.length === 2);
supprimer(id2);

// Ce qui doit être refusé, sans rien écrire.
const avant = lireIndex().parties.length;
const refus = ['', 'pas du JSON', '{}', JSON.stringify({ format: 'autre', partie }), JSON.stringify({ format: 'cap82-partie' }),
  JSON.stringify({ format: 'cap82-partie', partie: { bonus: 'SAISON', roster: {} } }),
  JSON.stringify({ format: 'cap82-partie', partie: { bonus: 'SAISON', tirage: [] } })];
exiger('les faux fichiers sont refusés', refus.every(t => importer(t) === null));
exiger('un refus n\'écrit rien', lireIndex().parties.length === avant && [...memoire.keys()].filter(k => k.startsWith('cap82_partie_')).length === avant);

// Le genre vient de la partie, pas de l'en-tête du fichier.
const menteur = importer(JSON.stringify({ format: 'cap82-partie', genre: 'table', titre: '  ', partie: { ...partie, bonus: 'SAISON', tirage: [{ season: '1993-94', team: 'MTL' }] } }));
const pm = lireIndex().parties.find(x => x.id === menteur);
exiger('le genre se relit dans la partie, le titre vide prend celui du genre', pm && pm.genre === 'saison' && pm.titre === 'La saison', pm ? `${pm.genre} · ${pm.titre}` : 'absente');

verdict('Le fichier transférable');
