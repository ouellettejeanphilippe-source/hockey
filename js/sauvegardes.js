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
  saison: { ico: '🏒', nom: 'La saison', mot: '82 matchs, puis les séries' },
  table: { ico: '🎲', nom: 'Sur table', mot: 'Le plateau, pièce par pièce' },
  rogue: { ico: '💀', nom: 'Le mode Rogue', mot: 'Une run. Des packs. Le proprio.' },
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
