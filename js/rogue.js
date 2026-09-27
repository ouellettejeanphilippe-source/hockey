/**
 * LE MODE ROGUE (S77).
 *
 * JP : *mode rogue like, que tu pars avec des joueurs de marde et gagne des
 * cartes/unlock avec packs, monnaie, etc?* ; puis, au choix proposé : *c'est
 * toujours une saison, mais tu gardes des trucs de saison en saison genre*,
 * et « collection + déblocages ».
 *
 * UNE RUN, C'EST UNE SAISON. On part avec vingt-trois PLOMBIERS — de vrais
 * joueurs, les moins productifs de leurs saisons — et on bâtit en jouant :
 * chaque résultat rapporte des JETONS 🪙, et la BOUTIQUE du hub vend des
 * packs (trois vrais joueurs, tu en signes un ; trois cartes de match, tu en
 * gardes une). Le plafond salarial n'existe pas ici : c'est la boutique qui
 * fait la rareté.
 *
 * CE QUI RESTE D'UNE RUN À L'AUTRE (le « méta », `cap82_rogue`) :
 *   - les ÉCUSSONS 🏅 gagnés à la fin de chaque run (les points de la saison,
 *     les rondes des séries, la Coupe) ;
 *   - les DÉBLOCAGES qu'ils achètent au vestiaire : garder des joueurs de ta
 *     dernière équipe (« tu gardes des trucs de saison en saison »), des
 *     jetons de départ, des packs neufs, un deck aiguisé, de meilleurs
 *     plombiers ;
 *   - la COLLECTION : chaque joueur tiré d'un pack entre dans ton cartable,
 *     qu'on l'ait signé ou non — c'est ça, une carte qu'on a tirée.
 *
 * TOUT CE QUI SE REJOUE EST PUR : les jetons se DÉDUISENT des résultats et
 * des achats (jamais stockés), et le contenu d'un pack se tire de la graine
 * de la ligue et du numéro de l'achat. Une run reprise retrouve les mêmes
 * packs. Seul le méta est un état, et il ne touche pas au moteur.
 */

const CLE_META = 'cap82_rogue';

/* ---------- les jetons ---------- */
/*
 * CALIBRÉ (scripts/mesure_rogue.mjs) : des plombiers font 12 à 33 points ; seize joueurs de
 * pack dès le premier jour, 74 à 90 — la bulle des séries. Une run doit donc en signer une
 * vingtaine en cours de saison : environ 25 packs sur 82 matchs, cinq dans les vingt premiers.
 */
export const JETONS = { depart: 40, victoire: 8, prolongation: 4, defaite: 2, grosMatch: 20, objectif: 20, serie: 40 };
/*
 * Les jetons à un moment de la saison : ce que les résultats ont rapporté,
 * moins ce que la boutique a coûté. `res` : W, L, OTL (matchs révélés), les
 * gros matchs gagnés, les objectifs réussis, les séries gagnées.
 */
export function jetonsDe(res, depenses, depart = JETONS.depart) {
  const r = res || {};
  return depart + (r.W || 0) * JETONS.victoire + (r.OTL || 0) * JETONS.prolongation + (r.L || 0) * JETONS.defaite
    + (r.gros || 0) * JETONS.grosMatch + (r.objectifs || 0) * JETONS.objectif + (r.series || 0) * JETONS.serie - (depenses || 0);
}

/* ---------- les packs ---------- */
/*
 * Les chances d'un pack de joueurs, par VARIANTE de carte (S78, js/rarete.js :
 * la variante se pose par-dessus un vrai joueur productif, avec son bonus tiré
 * au hasard). Un pack de base : surtout des cartes de base, une holo de temps
 * en temps, une or rarement. Le pack Vedettes, déblocable, renverse ça et ne
 * pige que dans le quart du haut de chaque saison (`elite`).
 */
const COTES_BASE = { commune: 62, peu: 27, rare: 9, legendaire: 2 };
export const PACKS = {
  joueurs: { ico: '📦', nom: 'Pack de joueurs', prix: 20, genre: 'joueurs', cotes: COTES_BASE,
    texte: 'Trois vrais joueurs de toutes les époques : tu en signes un.' },
  cartes: { ico: '🃏', nom: 'Pack de cartes', prix: 12, genre: 'cartes',
    texte: 'Trois cartes de match : tu en gardes une pour ton deck.' },
  // L'ATELIER (S78) : éditer un de tes joueurs — son poste, ses trios, ses malus, sa carte.
  atelier: { ico: '🛠️', nom: 'L\'atelier', prix: 15, genre: 'atelier',
    texte: 'Trois éditions de joueur (poste, trios, malus, carte) : tu en gardes une, pour le joueur de ton choix.' },
  defenseurs: { ico: '🧱', nom: 'Pack Défenseurs', prix: 20, genre: 'joueurs', groupe: 'D', cotes: COTES_BASE, deblocage: 'packDefenseurs',
    texte: 'Trois défenseurs : tu en signes un.' },
  gardiens: { ico: '🥅', nom: 'Pack Gardiens', prix: 25, genre: 'joueurs', groupe: 'G', cotes: COTES_BASE, deblocage: 'packGardiens',
    texte: 'Trois gardiens : le poste qui gagne les séries.' },
  annees80: { ico: '📼', nom: 'Pack Années 80', prix: 20, genre: 'joueurs', decennie: 1980, cotes: { commune: 55, peu: 30, rare: 12, legendaire: 3 }, deblocage: 'packAnnees80',
    texte: 'Trois joueurs des années 80, l\'époque des 400 buts par saison.' },
  vedettes: { ico: '🌟', nom: 'Pack Vedettes', prix: 50, genre: 'joueurs', elite: true, cotes: { commune: 0, peu: 40, rare: 45, legendaire: 15 }, deblocage: 'packVedettes',
    texte: 'Trois vedettes du quart du haut de leur saison, jamais une carte de base.' },
};

/* ---------- les déblocages (le vestiaire) ---------- */
export const DEBLOCAGES = {
  garder1: { ico: '🤝', nom: 'Garder un joueur', prix: 40, texte: 'Au début d\'une run, garde un joueur de ta dernière équipe.' },
  garder2: { ico: '🤝', nom: 'Garder deux joueurs', prix: 120, requis: 'garder1', texte: 'Deux joueurs de ta dernière équipe te suivent.' },
  garder3: { ico: '🤝', nom: 'Garder trois joueurs', prix: 240, requis: 'garder2', texte: 'Trois joueurs de ta dernière équipe te suivent.' },
  caisse1: { ico: '🪙', nom: 'Une caisse de départ', prix: 30, texte: '+20 jetons au début de chaque run.' },
  caisse2: { ico: '🪙', nom: 'Une grosse caisse', prix: 100, requis: 'caisse1', texte: '+20 jetons de plus au départ (+40 en tout).' },
  packDefenseurs: { ico: '🛡️', nom: 'Le pack Défensif', prix: 35, texte: 'La boutique vend le pack Défensif : quatre joueurs au meilleur différentiel de leur saison.' },
  packGardiens: { ico: '🥅', nom: 'Le pack Gardiens', prix: 50, texte: 'La boutique vend le pack Gardiens : quatre partants au meilleur pourcentage d\'arrêts.' },
  packAnnees80: { ico: '📼', nom: 'Le pack années 80', prix: 60, texte: 'La boutique vend le pack des années 80, l\'époque des 400 buts par saison.' },
  packVedettes: { ico: '🌟', nom: 'Les packs Étoiles et Légendes', prix: 150, texte: 'La boutique vend les packs Étoiles et Légendes : les meilleurs de leur saison.' },
  deckPlus: { ico: '🃏', nom: 'Un deck aiguisé', prix: 50, texte: 'Ton deck de départ commence avec « Lancer de la pointe+ » et « Bloquer des tirs+ ».' },
  plombiersPlus: { ico: '🛠️', nom: 'Des plombiers moins pires', prix: 80, texte: 'Tes plombiers de départ sortent du bas de la ligue, pas du fond du baril.' },
};

/* ---------- le méta ---------- */
/*
 * S79 : l'INVENTAIRE PERMANENT — `personnel` (les patrons qu'on possède, qu'on
 * engage à chaque run), `inventaire` (id → nombre de consommables permanents),
 * et `recus` (les achats déjà versés au méta : une ouverture ne paie qu'une fois).
 */
const META_VIDE = () => ({ ecussons: 0, deblocages: [], collection: [], cartes: [], runs: 0, meilleur: null, derniereEquipe: [], recompenses: {}, personnel: [], inventaire: {}, recus: {} });
export function lireMeta() {
  try { return { ...META_VIDE(), ...(JSON.parse(localStorage.getItem(CLE_META) || 'null') || {}) }; } catch { return META_VIDE(); }
}
export function ecrireMeta(m) { try { localStorage.setItem(CLE_META, JSON.stringify(m)); } catch { /* ignore */ } }
export const aDebloque = (m, cle) => (m.deblocages || []).includes(cle);
/* Combien de joueurs on garde : zéro, un, deux, trois selon les déblocages. */
export const nombreGardes = m => (aDebloque(m, 'garder3') ? 3 : aDebloque(m, 'garder2') ? 2 : aDebloque(m, 'garder1') ? 1 : 0);
export const jetonsDeDepart = m => JETONS.depart + (aDebloque(m, 'caisse1') ? 20 : 0) + (aDebloque(m, 'caisse2') ? 20 : 0);
export const packsOuverts = m => Object.entries(PACKS).filter(([, P]) => !P.deblocage || aDebloque(m, P.deblocage)).map(([k]) => k);
/* Un déblocage s'achète si on en a les moyens et si ce qu'il demande est déjà pris. */
export function peutAcheter(m, cle) {
  const D = DEBLOCAGES[cle];
  if (!D || aDebloque(m, cle)) return false;
  if (D.requis && !aDebloque(m, D.requis)) return false;
  return (m.ecussons || 0) >= D.prix;
}
export function acheterDeblocage(cle) {
  const m = lireMeta();
  if (!peutAcheter(m, cle)) return false;
  m.ecussons -= DEBLOCAGES[cle].prix;
  m.deblocages = [...(m.deblocages || []), cle];
  ecrireMeta(m);
  return true;
}
/*
 * LES PERMANENTS D'UN PACK (S79) : le personnel et les consommables permanents
 * vont au méta, UNE fois par achat (`recus[cle]`) — une ouverture ne paie pas
 * deux fois. Et un consommable permanent qu'on joue le quitte.
 */
export function recevoirPermanents(ids = [], cleRecu = '') {
  const m = lireMeta();
  m.recus = m.recus || {};
  if (cleRecu && m.recus[cleRecu]) return false;
  if (cleRecu) m.recus[cleRecu] = true;
  const perso = new Set(m.personnel || []);
  m.inventaire = m.inventaire || {};
  for (const id of ids) {
    const [cat, cle] = String(id).split(':');
    if (cat === 'patron') perso.add(cle);
    else m.inventaire[id] = (m.inventaire[id] || 0) + 1;
  }
  m.personnel = [...perso];
  const cles = Object.keys(m.recus);
  if (cles.length > 400) for (const x of cles.slice(0, cles.length - 400)) delete m.recus[x];
  ecrireMeta(m);
  return true;
}
export function retirerDuMeta(id) {
  const m = lireMeta();
  m.inventaire = m.inventaire || {};
  const n = m.inventaire[id] || 0;
  if (n <= 1) delete m.inventaire[id]; else m.inventaire[id] = n - 1;
  ecrireMeta(m);
}
/* La collection : les joueurs (clés) et les cartes tirés des packs. Un ensemble : pas de doublon. */
export function ajouterCollection({ joueurs = [], cartes = [] } = {}) {
  const m = lireMeta();
  const J = new Set(m.collection || []), C = new Set(m.cartes || []);
  for (const k of joueurs) J.add(k);
  for (const k of cartes) C.add(String(k).replace(/\+$/, ''));
  m.collection = [...J]; m.cartes = [...C];
  ecrireMeta(m);
}
/*
 * LES ÉCUSSONS D'UNE RUN : la saison (un par tranche de deux points), les
 * séries (dix par ronde gagnée, vingt de plus pour la Coupe). Payés UNE fois
 * par run et par étape (`recompenses[cle]`) : un rechargement du bilan ne
 * paie pas deux fois.
 */
export function payerEcussons(cleRun, etape, n, { equipe = null, bilan = null } = {}) {
  const m = lireMeta();
  const k = `${cleRun}:${etape}`;
  if (m.recompenses[k]) return 0;
  m.recompenses[k] = true;
  m.ecussons = (m.ecussons || 0) + Math.max(0, Math.round(n));
  if (etape === 'saison') m.runs = (m.runs || 0) + 1;
  if (equipe) m.derniereEquipe = equipe;
  if (bilan && (!m.meilleur || (bilan.pts || 0) > (m.meilleur.pts || 0) || (bilan.ronde || 0) > (m.meilleur.ronde || 0))) m.meilleur = { ...(m.meilleur || {}), ...bilan };
  // Les vieilles runs payées s'oublient : la liste ne doit pas grossir sans fin.
  const cles = Object.keys(m.recompenses);
  if (cles.length > 200) for (const x of cles.slice(0, cles.length - 200)) delete m.recompenses[x];
  ecrireMeta(m);
  return Math.round(n);
}
export const ecussonsDeLaSaison = pts => Math.floor((pts || 0) / 2);
export const ecussonsDesSeries = (rondes, coupe) => (rondes || 0) * 10 + (coupe ? 20 : 0);

/* ---------- le hasard pur ---------- */
export function hache(...parts) {
  let h = 2166136261 >>> 0;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/* Une rareté tirée selon des cotes (en %), de la graine et de mots. */
export function rareteTiree(cotes, ...parts) {
  let r = hache(...parts) * 100;
  for (const k of ['commune', 'peu', 'rare', 'legendaire']) { r -= cotes[k] || 0; if (r < 0) return k; }
  return 'commune';
}
