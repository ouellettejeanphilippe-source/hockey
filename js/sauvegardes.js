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
export const MAX_PARTIES = 24;

/* Les trois familles de parties, telles que le menu les range. */
export const GENRES = {
  saison: { ico: '🏒', nom: 'La saison', mot: 'Le repêchage, 82 matchs, les séries' },
  table: { ico: '🎲', nom: 'Sur table', mot: 'Le tournoi au plateau, pièce par pièce' },
  rogue: { ico: '💀', nom: 'Le mode Rogue', mot: 'Des plombiers, des packs, une run de plusieurs saisons' },
};
/* Le genre d'une sauvegarde, lu dans ce qu'elle porte. */
export const genreDe = data => (data && data.bonus === 'TABLE' ? 'table' : data && data.bonus === 'ROGUE' ? 'rogue' : 'saison');

const lire = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const idNeuf = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;

export function lireIndex() {
  const ix = lire(INDEX);
  return ix && Array.isArray(ix.parties) ? ix : { actif: null, parties: [] };
}
function ecrireIndex(ix) { ecrire(INDEX, ix); }

/*
 * LA MIGRATION : une sauvegarde d'avant S77 devient la première partie de
 * l'index, active. Rien ne se perd au passage à la nouvelle version.
 */
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
export const lirePartie = id => (id ? lire(cle(id)) : null);
export const lirePartieActive = () => { const a = partieActive(); return a ? lirePartie(a.id) : null; };
/* La plus récente d'un genre : ce que « Reprendre » ouvre sur la carte du mode. */
export const derniereDuGenre = g => lireIndex().parties.filter(p => p.genre === g).sort((a, b) => b.maj - a.maj)[0] || null;

/*
 * ÉCRIRE LA PARTIE ACTIVE. `saveGame` passe ici à chaque geste : la partie
 * active est réécrite, son résumé et sa date aussi. Sans partie active (le
 * tout premier geste d'un joueur neuf), on en crée une.
 */
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

/*
 * UNE PARTIE NEUVE. Elle devient active ; l'ancienne reste dans la liste.
 * Une partie qui n'a encore RIEN (le repêchage à peine tiré, personne de
 * signé) est réutilisée plutôt que multipliée : relancer la roulette trois
 * fois ne doit pas laisser trois parties vides au menu.
 */
export function nouvellePartie(genre, titre = null) {
  const ix = lireIndex();
  const a = ix.parties.find(p => p.id === ix.actif);
  // Rien d'écrit encore (créée par le menu, pas encore jouée) ou rien à perdre : on la reprend.
  let rien = false; try { rien = !localStorage.getItem(cle(a ? a.id : '')); } catch { /* ignore */ }
  if (a && ((a.resume && a.resume.vierge) || rien)) {
    // On reprend la PLACE, pas l'état (S79) : une partie neuve repart à neuf. Sans ça, la
    // saison vide qu'on quittait prêtait son identité déjà réglée à la table qu'on commençait.
    try { localStorage.removeItem(cle(a.id)); } catch { /* ignore */ }
    a.genre = genre; a.titre = titre || GENRES[genre].nom; a.maj = Date.now(); a.resume = null;
    ecrireIndex(ix);
    return a.id;
  }
  const id = idNeuf();
  ix.parties.push({ id, genre, titre: titre || GENRES[genre].nom, cree: Date.now(), maj: Date.now(), resume: null });
  ix.actif = id;
  // Au-delà du plafond, la plus vieille partie non épinglée s'en va.
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

/*
 * SAUVEGARDER UNE COPIE : un instantané de la partie, qu'on peut reprendre
 * plus tard même si l'original a continué. La copie est « épinglée » : le
 * plafond ne la jette pas.
 */
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

/* Toutes les parties d'un genre, la plus récente en tête. */
export const partiesDuGenre = g => lireIndex().parties.filter(p => p.genre === g).sort((a, b) => b.maj - a.maj);
