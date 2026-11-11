/**
 * LE CARTABLE (S79) — la collection de cartes de joueurs, d'une partie à
 * l'autre, dans les deux modes.
 *
 * JP : *page vestiaire devrait contenir toutes les cartes, comme un cartable
 * de carte, clickables, etc, avec stats de la saison en cours et saisons
 * réelles comme vraie carte. Je veux collectionner.*
 *
 * La section Collection montre le cartable dès que la saison commence (le
 * repêchage garde son bassin tant qu'on bâtit ; le Rogue repêche entre les saisons) :
 *   - TON ÉQUIPE : les cartes de ton alignement, avec leur saison en cours (les
 *     journées RÉVÉLÉES, jamais la fin de l'année) et leur vraie saison ;
 *   - LA COLLECTION : chaque carte tirée, signée ou alignée, par saison et par
 *     club, avec la complétion (« 1985-86 · EDM 12 / 27 »), les variantes
 *     obtenues (les cinq éditions, Base à Holo) et les doublons.
 * Une carte s'ouvre sur sa fiche.
 *
 * LE STOCKAGE (`cap82_cartable`) : clé du joueur-saison-club → les variantes
 * obtenues (compte par variante), les numéros d'une or, le nombre de copies.
 * Hors du moteur : rien ici ne touche une saison. La collection du Rogue
 * (`cap82_rogue.collection`, S77) y entre une fois, en cartes de base.
 */
import { EDITIONS } from './rarete.js';

const CLE_CARTABLE = 'cap82_cartable';
const VIDE = () => ({ v: 1, joueurs: {}, migre: false });
const RANG = Object.fromEntries(EDITIONS.map((r, i) => [r, i]));

function ecrire(c) { try { localStorage.setItem(CLE_CARTABLE, JSON.stringify(c)); } catch { /* ignore */ } }
function lireCartable() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(CLE_CARTABLE) || 'null'); } catch { c = null; }
  if (!c || typeof c.joueurs !== 'object') c = VIDE();
  if (!c.migre) {
    try {
      const m = JSON.parse(localStorage.getItem('cap82_rogue') || 'null');
      for (const k of (m && m.collection) || []) if (!c.joueurs[k]) c.joueurs[k] = { v: { commune: 1 }, n: 1 };
    } catch { /* ignore */ }
    c.migre = true;
    ecrire(c);
  }
  return c;
}
/*
 * TROIS DOUBLONS MONTENT LA CARTE (Jalon P3). JP : *avoir des doublons possibles, […] mais ajouter des mécaniques
 * pour compenser*. Une édition qui compte sa carte et `FUSION` doublons de plus les échange contre l'édition
 * au-dessus : Base → Cadre → Hors-cadre → Or (la Holo ne se fabrique pas en doublons : elle se tire, ou le lustre
 * la pose). Pure : rend les montées, `x` change.
 */
const FUSION = 3, MONTE = { commune: 'peu', peu: 'hors', hors: 'rare' };
export function monterLesDoublons(x) {
  const montees = [];
  for (const rar of ['commune', 'peu', 'hors']) {
    while ((x.v[rar] || 0) > FUSION) {
      x.v[rar] -= FUSION;
      x.v[MONTE[rar]] = (x.v[MONTE[rar]] || 0) + 1;
      montees.push({ de: rar, a: MONTE[rar] });
    }
  }
  return montees;
}
/*
 * DES CARTES ENTRENT AU CARTABLE. `doublons` : une copie de plus compte (un
 * pack) ; sinon (l'alignement au départ d'une saison, une signature déjà
 * tirée) seule une variante NEUVE s'ajoute. Rend les cartes montées par leurs
 * doublons ({ cle, de, a }).
 */
export function ajouterAuCartable(entrees = [], { doublons = true } = {}) {
  const c = lireCartable();
  const montees = [];
  for (const e of entrees) {
    if (!e || !e.cle) continue;
    const rar = RANG[e.rar] !== undefined ? e.rar : 'commune';
    const x = c.joueurs[e.cle];
    if (!x) { c.joueurs[e.cle] = { v: { [rar]: 1 }, n: 1, ...(e.num ? { num: [e.num] } : {}) }; continue; }
    if (!doublons && x.v[rar]) continue;
    x.v[rar] = (x.v[rar] || 0) + 1;
    x.n = (x.n || 0) + 1;
    if (e.num) x.num = [...new Set([...(x.num || []), e.num])];
    for (const m of monterLesDoublons(x)) montees.push({ cle: e.cle, ...m });
  }
  ecrire(c);
  return montees;
}
/*
 * LES CARTES DE COACH (V21 ; JP : *c'est comme les cartes de joueurs*). Ton entraîneur, une vraie carte de coach-saison
 * (js/coachs-reels.js), entre au cartable le jour où sa run commence, et y reste ; `coachs` : son id (« 1976-77_MTL ») → ce
 * que l'album en dit sans recharger data/coachs.json, `r` ses runs, `der` la dernière. Le loto du départ tire d'abord
 * dans ton cartable, les moins jouées d'abord (`lotoDesCoachs`).
 */
export function coachAuCartable(carte, run = 0) {
  if (!carte || !carte.id) return;
  const c = lireCartable(), coachs = c.coachs = c.coachs || {};
  const x = coachs[carte.id] = coachs[carte.id] || { n: carte.n, cle: carte.cle, rang: carte.rang, fiche: carte.fiche, coupe: !!carte.coupe, jack: !!carte.jack, r: 0 };
  if (x.der !== run) { x.r = (x.r || 0) + 1; x.der = run; }
  ecrire(c);
}
export const coachsDuCartable = (c = lireCartable()) => c.coachs || {};
/*
 * MOMENTS LÉGENDAIRES SUR LA CARTE (v2) : un exploit de saison — jeu blanc,
 * chapeau, grand match, mur — se grave sur la carte du joueur (`legendes`),
 * une fois par type et par saison de run. La carte le porte d'une run à
 * l'autre ; l'écran en tient compte à l'affichage.
 */
/* Les moments légendaires : leur icône, leur nom et leur récit (le toast du soir, puis la fiche les relit — V2.2). */
export const LEGENDES = {
  mur: { ico: '🗿', nom: 'Le Mur', recit: m => `${m.extra} arrêts, victoire arrachée` },
  jeuBlanc: { ico: '🔒', nom: 'Le jeu blanc', recit: () => 'la porte était fermée' },
  chapeau: { ico: '🎩', nom: 'Le Chapeau', recit: m => `${m.extra} buts dans un match` },
  grandMatch: { ico: '⭐', nom: 'Le grand soir', recit: m => `${m.extra} points dans un match` },
};
/* Ce qui est gravé sur la carte d'un joueur-saison : [{ type, saison }]. */
export const legendesDe = (cle, c = lireCartable()) => ((c.joueurs[cle] || {}).legendes || []).filter(l => LEGENDES[l.type]);
