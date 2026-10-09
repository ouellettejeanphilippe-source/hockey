/**
 * LES PARTIES SAUVEGARDÉES (S77) — plusieurs, rangées par mode.
 *
 * JP : *chaque mode de jeu a ses saves et possibilité de sauvegarder les saves
 * et les reprendre, un menu au départ pour choisir*. Il n'y avait qu'UNE
 * sauvegarde (`cap82_save`) : commencer une partie effaçait la précédente, et
 * jouer sur table effaçait la saison en cours.
 *
 * Maintenant : un INDEX (`cap82_parties`) — quelle partie est active, et pour
 * chacune son mode, son titre et un résumé lisible au menu — et une clé par
 * partie (`cap82_partie_<id>`) qui porte exactement ce que `saveGame`
 * écrivait avant. Une partie pèse une quinzaine de ko (elle se rejoue de sa
 * graine) : on en garde une vingtaine sans s'approcher du plafond du stockage.
 *
 * Ce module ne touche pas au DOM : il lit et écrit le stockage, le menu
 * (js/menu.js) et le contrôleur (js/game.js) décident quoi en faire.
 */

const INDEX = 'cap82_parties';
const ANCIENNE = 'cap82_save';
const cle = id => `cap82_partie_${id}`;
const MAX_PARTIES = 24;

/* Les trois familles de parties, telles que le menu les range. */
export const GENRES = {
  saison: { ico: '🏒', nom: 'Le 82-0', mot: 'Repêche 23 vrais joueurs, joue 82 matchs d\'un coup, vise la Coupe.' },
  table: { ico: '🎲', nom: 'Sur table', mot: 'Le match en jeu de plateau, geste par geste.' },
  rogue: { ico: '💀', nom: 'Le mode Rogue', mot: 'Ouvre des packs, bâtis ton club, survis au proprio. Perds : tu repars plus fort.' },
};
/* Le genre d'une sauvegarde, lu dans ce qu'elle porte. */
const genreDe = data => (data && data.bonus === 'TABLE' ? 'table' : data && data.bonus === 'ROGUE' ? 'rogue' : 'saison');

const lire = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const idNeuf = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;

export function lireIndex() {
  const ix = lire(INDEX);
  return ix && Array.isArray(ix.parties) ? ix : { actif: null, parties: [] };
}
function ecrireIndex(ix) { ecrire(INDEX, ix); }

export function migrer() {
  const ix = lireIndex();
  if (ix.parties.length) return;
  const vieille = lire(ANCIENNE);
  if (!vieille) return;
  const id = idNeuf();
  if (!ecrire(cle(id), vieille)) return;
  const g = genreDe(vieille);
  ix.parties.push({ id, genre: g, titre: GENRES[g].nom, cree: Date.now(), maj: Date.now(), resume: null });
  ix.actif = id;
  ecrireIndex(ix);
  try { localStorage.removeItem(ANCIENNE); } catch { /* ignore */ }
}

export const partieActive = () => { const ix = lireIndex(); return ix.parties.find(p => p.id === ix.actif) || null; };
const lirePartie = id => (id ? lire(cle(id)) : null);
export const lirePartieActive = () => { const a = partieActive(); return a ? lirePartie(a.id) : null; };
export const derniereDuGenre = g => lireIndex().parties.filter(p => p.genre === g).sort((a, b) => b.maj - a.maj)[0] || null;

export function ecrirePartieActive(data, resume = null) {
  const ix = lireIndex();
  let a = ix.parties.find(p => p.id === ix.actif);
  if (!a) {
    const g = genreDe(data);
    a = { id: idNeuf(), genre: g, titre: GENRES[g].nom, cree: Date.now(), maj: Date.now(), resume: null };
    ix.parties.push(a);
    ix.actif = a.id;
  }
  a.genre = genreDe(data);
  a.maj = Date.now();
  if (resume) a.resume = resume;
  ecrire(cle(a.id), data);
  ecrireIndex(ix);
}

export function nouvellePartie(genre, titre = null) {
  const ix = lireIndex();
  const a = ix.parties.find(p => p.id === ix.actif);
  let rien = false; try { rien = !localStorage.getItem(cle(a ? a.id : '')); } catch { /* ignore */ }
  if (a && ((a.resume && a.resume.vierge) || rien)) {
    try { localStorage.removeItem(cle(a.id)); } catch { /* ignore */ }
    a.genre = genre; a.titre = titre || GENRES[genre].nom; a.maj = Date.now(); a.resume = null;
    ecrireIndex(ix);
    return a.id;
  }
  const id = idNeuf();
  ix.parties.push({ id, genre, titre: titre || GENRES[genre].nom, cree: Date.now(), maj: Date.now(), resume: null });
  ix.actif = id;
  while (ix.parties.length > MAX_PARTIES) {
    const vieilles = ix.parties.filter(p => p.id !== id && !p.copie).sort((x, y) => x.maj - y.maj);
    const v = vieilles[0] || ix.parties.filter(p => p.id !== id).sort((x, y) => x.maj - y.maj)[0];
    if (!v) break;
    ix.parties = ix.parties.filter(p => p.id !== v.id);
    try { localStorage.removeItem(cle(v.id)); } catch { /* ignore */ }
  }
  ecrireIndex(ix);
  return id;
}

export function activer(id) {
  const ix = lireIndex();
  if (!ix.parties.some(p => p.id === id)) return false;
  ix.actif = id;
  ecrireIndex(ix);
  return true;
}

export function supprimer(id) {
  const ix = lireIndex();
  ix.parties = ix.parties.filter(p => p.id !== id);
  if (ix.actif === id) ix.actif = null;
  try { localStorage.removeItem(cle(id)); } catch { /* ignore */ }
  ecrireIndex(ix);
}

export function copier(id) {
  const ix = lireIndex();
  const src = ix.parties.find(p => p.id === id);
  const data = lirePartie(id);
  if (!src || !data) return null;
  const nid = idNeuf();
  if (!ecrire(cle(nid), data)) return null;
  const quand = new Date().toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' });
  ix.parties.push({ ...src, id: nid, titre: `${src.titre} · copie du ${quand}`, cree: Date.now(), maj: Date.now(), copie: true });
  ecrireIndex(ix);
  return nid;
}

export const partiesDuGenre = g => lireIndex().parties.filter(p => p.genre === g).sort((a, b) => b.maj - a.maj);

/*
 * LE FICHIER TRANSFÉRABLE (1.0). Une partie vit dans le stockage du navigateur
 * ou de l'appareil : rien ne la fait passer d'un téléphone à un ordinateur, et
 * un navigateur qui vide ses données l'emporte. `exporter` la met dans un
 * fichier JSON — son entrée d'index (genre, titre, résumé) et ce que
 * `saveGame` a écrit, tel quel — et `importer` relit ce fichier en une partie
 * NEUVE de l'index, épinglée comme une copie : l'original, s'il est encore
 * ici, ne bouge pas. Le genre se relit dans la partie, jamais dans l'en-tête
 * du fichier : c'est la partie qui fait foi.
 */
const FORMAT = 'cap82-partie';
export function exporter(id) {
  const p = lireIndex().parties.find(x => x.id === id);
  const data = lirePartie(id);
  if (!p || !data) return null;
  const jour = new Date().toISOString().slice(0, 10);
  const nom = `cap82-${p.genre}-${jour}.json`;
  const texte = JSON.stringify({ format: FORMAT, version: 1, exporte: jour, genre: p.genre, titre: p.titre, resume: p.resume || null, partie: data });
  return { nom, texte };
}
export function importer(texte) {
  let f = null;
  try { f = JSON.parse(texte); } catch { return null; }
  if (!f || f.format !== FORMAT || !f.partie || typeof f.partie !== 'object') return null;
  const data = f.partie;
  // Ce que `restoreSave` (js/game.js) exige pour reprendre : un tirage, ou une run Rogue.
  if (!Array.isArray(data.tirage) || (!data.tirage.length && data.bonus !== 'ROGUE')) return null;
  const ix = lireIndex();
  const id = idNeuf();
  if (!ecrire(cle(id), data)) return null;
  const g = genreDe(data);
  const titre = typeof f.titre === 'string' && f.titre.trim() ? f.titre.trim().slice(0, 80) : GENRES[g].nom;
  const resume = f.resume && typeof f.resume === 'object' ? f.resume : null;
  ix.parties.push({ id, genre: g, titre, cree: Date.now(), maj: Date.now(), resume, copie: true, importee: true });
  ecrireIndex(ix);
  return id;
}
