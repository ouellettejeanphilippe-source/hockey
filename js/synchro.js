/*
 * LA SAUVEGARDE QUI SUIT D'UN APPAREIL À L'AUTRE (JP, 25 nov. 2026 : *avoir sauvegarde multidevice* ; *Github sync* ; *un
 * Gist secret* ; *toute seule*). Le jeu n'a pas de serveur : chaque appareil parle à GitHub avec le jeton d'accès que le
 * joueur y colle une fois (un seul droit : les Gists). La sauvegarde est UN fichier d'un Gist secret de son compte :
 *
 *   { format, v, version, maj, appareil: { id, nom }, resume, gz }       `gz` : les clés ({ cap82_run: '…', … }) en gzip, base 64
 *
 * Chaque envoi porte la sauvegarde entière (GitHub ne prend pas un morceau de fichier) : compressée, elle pèse sept fois
 * moins. Un navigateur sans `CompressionStream` écrit `cles` tel quel, et ne lit pas `gz` : il le dit, et ne touche à rien.
 *
 * CE QUI SUIT : la run du Rogue, ses médailles et son Club (`cap82_rogue`), le cartable, les parties du 82-0 et de Sur
 * table avec leur index, le palmarès. CE QUI RESTE À L'APPAREIL : les options (le son, la palette), les caches, le jeton.
 *
 * QUI GAGNE (`decider`). Chaque appareil retient l'empreinte de la dernière sauvegarde qu'il a vue pareille des deux côtés
 * (`base`).
 *   - Ici n'a pas bougé depuis, là-bas oui : on reçoit, et la page se recharge aussitôt sur ce qu'on a reçu (rien d'ici ne
 *     se perd : ici n'avait pas bougé).
 *   - Ici a bougé, là-bas non : on envoie.
 *   - Les deux ont bougé : personne n'écrase personne ; le menu montre les deux et le joueur choisit (`garder`).
 *   - Un appareil jamais branché où rien n'est joué reçoit sans demander.
 * Une sauvegarde écrite par une version plus récente du jeu ne se reçoit pas : ce code-ci la lirait mal, puis la
 * renverrait abîmée. Rien de ce qu'un choix écarte n'est perdu : ce qu'on écrase en ligne reste à l'historique du Gist, et
 * la sauvegarde d'ici qu'on écarte dans un conflit (elle n'a jamais été envoyée) part d'abord au Gist, dans `ECARTEE`. Ce que la règle ne
 * couvre pas : deux appareils qui envoient dans la même seconde (GitHub n'offre pas d'écriture conditionnelle sur un Gist) ;
 * le dernier écrit gagne, l'autre est à l'historique.
 *
 * Ce module ne dessine rien : il lit et écrit le stockage et parle à GitHub ; js/menu.js décide quoi en dire.
 */
import { VERSION } from './version.js';
import { plusRecente } from './mise-a-jour.js';

const CLE = 'cap82_synchro', FORMAT = 'cap82-synchro', API = 'https://api.github.com';
export const FICHIER = 'cap82-sauvegarde.json', ECARTEE = 'cap82-sauvegarde-ecartee.json';
const SUIVIES = ['cap82_run', 'cap82_rogue', 'cap82_cartable', 'cap82_parties', 'cap82_leaderboard'], PARTIE = 'cap82_partie_';
const suivie = k => SUIVIES.includes(k) || k.startsWith(PARTIE);

const lireReglage = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null') || {}; } catch { return {}; } };
const ecrireReglage = e => { try { localStorage.setItem(CLE, JSON.stringify(e)); } catch { /* le stockage plein : on redemandera le jeton */ } };
const json = t => { try { return JSON.parse(t || 'null'); } catch { return null; } };

/* Le texte des clés, compressé pour le voyage (gzip, base 64) ; nul si le navigateur ne sait pas compresser. */
async function compresser(texte) {
  if (typeof CompressionStream !== 'function') return null;
  const o = new Uint8Array(await new Response(new Blob([texte]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let s = '';
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(s);
}
async function decompresser(b64) {
  const o = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Response(new Blob([o]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/* Une empreinte de 53 bits d'un texte (cyrb53) : deux sauvegardes pareilles ont la même, au caractère près. */
function empreinteDe(texte) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) { const c = texte.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
/* D'un lot de clés, celles que ce code suit, telles qu'elles sont écrites, et leur empreinte. */
function etatDe(source) {
  const cles = {};
  for (const k of Object.keys(source).sort()) if (suivie(k) && typeof source[k] === 'string') cles[k] = source[k];
  return { cles, empreinte: empreinteDe(Object.entries(cles).map(([k, v]) => `${k}\u0000${v}`).join('\u0001')) };
}
/* Ce que cet appareil porte, maintenant. */
function etatLocal() {
  const tout = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (suivie(k)) tout[k] = localStorage.getItem(k); }
  return etatDe(tout);
}
/* Ce qu'une sauvegarde contient, en une ligne : où en est la run, ce que le club a gagné, les parties. Vide : rien n'est joué. */
export function resumeDe(cles) {
  const R = json(cles.cap82_run), M = json(cles.cap82_rogue), ix = json(cles.cap82_parties), mots = [];
  if (R && Array.isArray(R.matchs) && R.phase !== 'fin') mots.push(R.series ? 'Rogue, en séries' : R.quart ? `Rogue, ${R.matchs.length} matchs joués` : 'Rogue, au repêchage');
  if (M && (M.runs || M.ecussons)) mots.push(`${M.runs || 0} run${M.runs > 1 ? 's' : ''}, ${M.ecussons || 0} médailles`);
  const n = ix && Array.isArray(ix.parties) ? ix.parties.filter(p => p.resume && !p.resume.vierge).length : 0;
  if (n) mots.push(`${n} partie${n > 1 ? 's' : ''}`);
  if (!mots.length && Object.keys((json(cles.cap82_cartable) || {}).joueurs || {}).length) mots.push('un cartable');
  if (!mots.length && (json(cles.cap82_leaderboard) || []).length) mots.push('un palmarès');
  return mots.join(' · ');
}
/* Le nom de cet appareil, pour le reconnaître de l'autre : ce que le navigateur dit de lui-même. */
function nomDeLAppareil() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  return /iPhone/.test(ua) ? 'un iPhone' : /iPad/.test(ua) ? 'un iPad' : /Android/.test(ua) ? 'un Android' : /Macintosh|Mac OS/.test(ua) ? 'un Mac' : /Windows/.test(ua) ? 'un PC Windows' : /Linux/.test(ua) ? 'un PC Linux' : 'un autre appareil';
}
const cetAppareil = () => lireReglage().appareil || { id: Math.floor(Math.random() * 0xffffffff).toString(36), nom: nomDeLAppareil() };

/*
 * QUI GAGNE. `ici` et `la` : les empreintes d'ici et de là-bas (`la` nulle : aucune sauvegarde en ligne) ; `base` : la
 * dernière vue pareille des deux côtés (nulle : cet appareil n'a jamais été branché) ; `vierge` : rien n'est joué ici.
 * Rend 'creer', 'egale', 'recevoir', 'envoyer' ou 'conflit'.
 */
export function decider({ ici, la, base = null, vierge = false }) {
  if (la == null) return 'creer';
  if (la === ici) return 'egale';
  if (ici === base || (base == null && vierge)) return 'recevoir';
  if (la === base) return 'envoyer';
  return 'conflit';
}

/* ---------- GitHub ---------- */
async function api(jeton, methode, chemin, corps = null) {
  let r;
  try {
    r = await fetch(API + chemin, { method: methode, cache: 'no-store', body: corps ? JSON.stringify(corps) : undefined,
      headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(corps ? { 'Content-Type': 'application/json' } : {}) } });
  } catch { return { horsLigne: true }; }
  if (!r.ok) return { refus: r.status };
  try { return { data: await r.json() }; } catch { return { horsLigne: true }; }
}
/*
 * Le fichier de la sauvegarde dans un Gist lu ; un gros fichier arrive tronqué, son adresse brute le rend entier. Pas de
 * fichier : rien n'est encore écrit (on créera). Un fichier qui ne se lit pas ici (abîmé, ou compressé pour un navigateur
 * qui ne sait pas décompresser) est une erreur, jamais « rien » : on n'écrit pas par-dessus ce qu'on n'a pas su lire.
 */
async function fichierDe(gist) {
  const f = gist && gist.files && gist.files[FICHIER];
  if (!f) return { sauvegarde: null };
  let texte = f.content;
  if (f.truncated && f.raw_url) { try { texte = await (await fetch(f.raw_url, { cache: 'no-store' })).text(); } catch { return { erreur: { horsLigne: true } }; } }
  const s = json(texte);
  if (s && s.format === FORMAT && typeof s.gz === 'string') { try { s.cles = JSON.parse(await decompresser(s.gz)); } catch { s.cles = null; } }
  return s && s.format === FORMAT && s.cles && typeof s.cles === 'object' ? { sauvegarde: s } : { erreur: { illisible: true } };
}
/* La sauvegarde en ligne : { id, sauvegarde } (`sauvegarde` nulle : rien n'est encore écrit), ou { erreur }. */
async function lireEnLigne(e) {
  let id = e.gist || null, r = id ? await api(e.jeton, 'GET', `/gists/${id}`) : null;
  if (r && (r.horsLigne || (r.refus && r.refus !== 404))) return { erreur: r };
  if (!r || !r.data) {
    // Pas de Gist connu ici (ou il a été supprimé) : celui qu'un autre appareil a créé se retrouve par son fichier.
    id = null;
    for (let page = 1; page <= 5 && !id; page++) {
      const l = await api(e.jeton, 'GET', `/gists?per_page=100&page=${page}`);
      if (!l.data) return { erreur: l };
      const g = l.data.find(x => x.files && x.files[FICHIER]);
      if (g) id = g.id; else if (l.data.length < 100) break;
    }
    if (!id) return { id: null, sauvegarde: null };
    r = await api(e.jeton, 'GET', `/gists/${id}`);
    if (!r.data) return { erreur: r };
  }
  const f = await fichierDe(r.data);
  return f.erreur ? f : { id, sauvegarde: f.sauvegarde };
}
/* Écrire la sauvegarde d'ici ; une clé d'en ligne que ce code ne suit pas (une version plus récente l'a écrite) y reste. */
async function ecrireEnLigne(e, id, local, enLigne, fichier = FICHIER) {
  const autres = Object.fromEntries(Object.entries((enLigne && enLigne.cles) || {}).filter(([k]) => !suivie(k)));
  const cles = { ...autres, ...local.cles }, gz = await compresser(JSON.stringify(cles));
  const contenu = JSON.stringify({ format: FORMAT, v: 1, version: VERSION, maj: Date.now(), appareil: e.appareil, resume: resumeDe(local.cles), ...(gz ? { gz } : { cles }) });
  const corps = { files: { [fichier]: { content: contenu } } };
  const r = id ? await api(e.jeton, 'PATCH', `/gists/${id}`, corps) : await api(e.jeton, 'POST', '/gists', { description: 'Cap 82-0 · la sauvegarde du jeu (ne pas modifier à la main)', public: false, ...corps });
  return r.data ? { id: r.data.id } : { erreur: r };
}
/*
 * Poser ici la sauvegarde reçue : chaque clé suivie devient la sienne, celles qu'elle n'a pas s'effacent. Tout ou rien : si le
 * stockage refuse une clé (il est plein), celles d'avant reviennent, et on rend faux.
 */
function poserIci(cles) {
  const avant = etatLocal().cles;
  const poser = neuves => { for (const k of Object.keys(etatLocal().cles)) if (!(k in neuves)) localStorage.removeItem(k); for (const [k, v] of Object.entries(neuves)) localStorage.setItem(k, v); };
  try { poser(cles); return true; } catch { try { poser(avant); } catch { /* le stockage ne répond plus */ } return false; }
}
const MOTS_DU_REFUS = {
  401: 'GitHub refuse ce jeton : il est faux, ou expiré.',
  403: 'GitHub refuse : ce jeton n\'a pas le droit « gist », ou trop d\'appels d\'un coup.',
  404: 'GitHub ne trouve rien : ce jeton n\'a pas le droit « gist ».',
};
const motDeLErreur = r => (r.horsLigne ? 'Hors ligne : ça partira au retour du réseau.'
  : r.illisible ? 'La sauvegarde en ligne ne se lit pas ici : ce navigateur est trop vieux, ou le Gist a été retouché. Rien n\'a été touché.'
  : MOTS_DU_REFUS[r.refus] || `GitHub a répondu ${r.refus}.`);
/* Ce que finit une passe ratée : son mot, le `refus` de GitHub s'il a dit non, et `arret` quand réessayer seule ne sert à rien. */
const echec = r => ({ mot: motDeLErreur(r), refus: r.refus || 0, arret: !!(r.refus || r.illisible) });

/* ---------- ce que le menu lit, et ses gestes ---------- */
/*
 * Où en est la synchro sur cet appareil : `branchee`, `quand` (la dernière fois que les deux côtés étaient pareils), `mot`
 * (ce que la dernière passe a à dire), `conflit` ({ ici, la } : les deux ont avancé), `refus` (le non de GitHub : 401, 403…),
 * `arret` (la synchro toute seule n'insiste plus : un refus, un fichier qui ne se lit pas ; une passe demandée la relance),
 * `source` (l'appareil d'où vient ce qu'on porte, si on l'a reçu), `empreinte` (celle d'ici), `sale` (ici a bougé depuis).
 */
export function etatDeLaSynchro() {
  const e = lireReglage();
  const empreinte = e.jeton ? etatLocal().empreinte : '';
  return { branchee: !!e.jeton, quand: e.quand || 0, mot: e.mot || '', conflit: e.conflit || null, refus: e.refus || 0, arret: !!e.arret, source: e.source || '', empreinte, sale: !!e.jeton && empreinte !== e.base };
}
/*
 * SYNCHRONISER : une passe. `garder` ('ici' ou 'la') tranche un conflit. Rend { etat, mot, conflit } : 'debranchee', 'egale',
 * 'envoyee', 'recue', 'conflit' ou 'erreur'. APRÈS 'recue', QUI APPELLE RECHARGE LA PAGE : la sauvegarde reçue est au
 * stockage, le jeu en mémoire est celui d'avant, et son prochain geste l'écraserait. Une seule passe à la fois : un deuxième
 * appel attend que la première ait fini.
 */
let file = Promise.resolve();
export function synchroniser(options = {}) {
  const p = file.then(() => passe(options));
  file = p.catch(() => {});
  return p;
}
async function passe({ garder = null }) {
  const e = lireReglage();
  if (!e.jeton) return { etat: 'debranchee', mot: '', conflit: null };
  // Le réglage se relit au moment d'écrire : pendant l'appel à GitHub, le joueur a pu débrancher.
  const finir = (etat, plus = {}) => {
    const f = lireReglage();
    if (f.jeton !== e.jeton) return { etat: 'debranchee', mot: '', conflit: null };
    Object.assign(f, { mot: '', conflit: null, refus: 0, arret: false }, plus);
    ecrireReglage(f);
    return { etat, mot: f.mot, conflit: f.conflit };
  };
  const ligne = await lireEnLigne(e);
  if (ligne.erreur) return finir('erreur', { ...echec(ligne.erreur), conflit: e.conflit || null });
  const local = etatLocal(), S = ligne.sauvegarde, distant = S ? etatDe(S.cles) : null;
  // `base` ne vaut que pour le Gist où on l'a vue : un autre Gist (un autre compte, un Gist refait) repart de rien.
  const base = e.gist && e.gist === ligne.id ? e.base || null : null;
  let quoi = decider({ ici: local.empreinte, la: distant ? distant.empreinte : null, base, vierge: !resumeDe(local.cles) });
  if (garder && quoi !== 'egale' && quoi !== 'creer') quoi = garder === 'ici' ? 'envoyer' : 'recevoir';
  if (quoi === 'egale') return finir('egale', { gist: ligne.id, base: local.empreinte, quand: Date.now() });
  if (quoi === 'creer' || quoi === 'envoyer') {
    const w = await ecrireEnLigne(e, ligne.id, local, S);
    return w.erreur ? finir('erreur', echec(w.erreur)) : finir('envoyee', { gist: w.id, base: local.empreinte, quand: Date.now(), source: '' });
  }
  const autre = { resume: S.resume || 'Rien de joué', quand: S.maj || 0, appareil: (S.appareil && S.appareil.nom) || 'un autre appareil' };
  if (quoi === 'conflit') return finir('conflit', { gist: ligne.id, conflit: { ici: { resume: resumeDe(local.cles) || 'Rien de joué' }, la: autre } });
  if (typeof S.version === 'string' && plusRecente(S.version, VERSION)) return finir('erreur', { gist: ligne.id, mot: `La sauvegarde en ligne vient de la version ${S.version} du jeu ; ici, c'est la ${VERSION}. Mets cet appareil à jour pour la recevoir.` });
  // La sauvegarde d'ici qu'un choix écarte n'a jamais été envoyée : elle part d'abord au Gist, à part, pour qu'on la retrouve.
  if (local.empreinte !== base && resumeDe(local.cles)) { const w = await ecrireEnLigne(e, ligne.id, local, null, ECARTEE); if (w.erreur) return finir('erreur', { ...echec(w.erreur), conflit: e.conflit || null }); }
  if (!poserIci(distant.cles)) return finir('erreur', { gist: ligne.id, mot: 'Le stockage de cet appareil est plein : la sauvegarde en ligne n\'y entre pas.' });
  return finir('recue', { gist: ligne.id, base: distant.empreinte, quand: Date.now(), source: autre.appareil });
}
/*
 * Brancher cet appareil : le jeton s'essaie d'abord (une première synchro) ; refusé, il ne se garde pas. Un jeton qu'on
 * change (l'ancien a expiré) reprend où l'on était : le même Gist, la même base.
 */
export async function brancher(jeton) {
  const propre = String(jeton || '').trim();
  if (!propre) return { etat: 'erreur', mot: 'Colle ton jeton GitHub d\'abord.', conflit: null };
  ecrireReglage({ ...lireReglage(), jeton: propre, appareil: cetAppareil(), mot: '', refus: 0, arret: false });
  const r = await synchroniser();
  if (r.etat !== 'erreur' || lireReglage().gist) return r;
  const s = etatDeLaSynchro(), horsLigne = !s.refus && !s.arret;
  debrancher();
  return horsLigne ? { ...r, mot: 'GitHub ne répond pas : réessaie avec du réseau.' } : r;
}
/* Débrancher : le jeton s'oublie ici, et d'où l'on en était ; la partie reste sur l'appareil, la sauvegarde en ligne aussi. */
export function debrancher() { ecrireReglage({ appareil: cetAppareil() }); }

/*
 * TOUTE SEULE (JP : *toute seule*). À l'ouverture du jeu et à chaque retour sur sa page, on reçoit ce qu'un autre appareil
 * a envoyé. Ce qui a bougé ici part quand la page se cache, et pendant qu'on joue dès que rien n'a bougé d'une demi-minute
 * (on regarde un match, on réfléchit) — au plus tard après cinq minutes : chaque envoi porte la sauvegarde entière, on
 * n'en fait pas un par geste. `recharger` : la sauvegarde reçue est au stockage, le jeu en mémoire est celui d'avant.
 * `dire(r)` : le résultat de chaque passe, pour le menu. Rend la première passe.
 */
const PAUSE_MS = 30000, AU_PLUS_TARD_MS = 300000;
export function suivreLaSynchro({ recharger, dire = () => {} }) {
  const passer = async () => { const r = await synchroniser(); if (r.etat === 'recue') recharger(); else dire(r); return r; };
  // Un jeton que GitHub refuse ne se réessaie pas tout seul (GitHub bloque qui insiste), ni un conflit que le joueur n'a pas tranché.
  const pret = s => s.branchee && !s.arret && !s.conflit;
  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible', s = etatDeLaSynchro();
    if (pret(s) && (visible || s.sale)) passer();
  });
  let vue = null, depuis = 0;       // l'empreinte d'ici au dernier coup d'œil, et depuis quand ce qui a bougé attend
  setInterval(() => {
    const s = etatDeLaSynchro(), calme = s.empreinte === vue;
    vue = s.empreinte;
    if (!s.sale || !pret(s)) { depuis = 0; return; }
    depuis = depuis || Date.now();
    if (document.visibilityState === 'visible' && (calme || Date.now() - depuis >= AU_PLUS_TARD_MS)) passer();
  }, PAUSE_MS);
  return passer();
}
