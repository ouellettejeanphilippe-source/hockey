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
 * GRAVÉ SUR LA CARTE (v2 ; réécrit à la V28, tranche 5b, docs/refonte-v28-5.md § 3.6) : ce qu'un joueur a fait chez toi
 * dans une run — dans un match (le chapeau, le grand soir, le jeu blanc, le mur) ou sur la run (dix buts, vingt points, le
 * but gagnant contre un rival, la Coupe) — se grave sur sa carte (`legendes` : [{ type, run, extra }]), une fois par sorte
 * et par run, et y reste. La run les lit (js/run.js `galonsDuSoir`), la coquille les écrit ici, la fiche et l'Album les
 * relisent. Aucun effet au moteur. Les galons d'une saison de 82 soirs (40 buts, 50 passes) sont partis avec l'ancien Rogue.
 */
export const LEGENDES = {
  mur: { ico: '🗿', nom: 'Le Mur', recit: m => (m.extra ? `${m.extra} arrêts, victoire arrachée` : 'une victoire arrachée') },
  jeuBlanc: { ico: '🔒', nom: 'Le jeu blanc', recit: () => 'la porte était fermée' },
  chapeau: { ico: '🎩', nom: 'Le Chapeau', recit: m => `${m.extra || 'trois'} buts dans un match` },
  grandMatch: { ico: '⭐', nom: 'Le grand soir', recit: m => `${m.extra || 'plusieurs'} points dans un match` },
  dixButs: { ico: '🏵', nom: 'Dix buts', recit: () => 'dix buts dans une run' },
  vingtPoints: { ico: '🏵', nom: 'Vingt points', recit: () => 'vingt points dans une run' },
  bourreau: { ico: '🏵', nom: 'Le bourreau', recit: m => `le but gagnant contre le rival${m.extra ? ` (${m.extra})` : ''}` },
  coupe: { ico: '🏵', nom: 'La Coupe', recit: () => 'il était de l\'effectif' },
};
/* Une carte garde au plus `GRAVURES_MAX` gravures, les plus récentes : la même carte peut revenir dans bien des runs. */
const GRAVURES_MAX = 24;
/*
 * GRAVER les galons d'une run (`galons` : [{ k, type, extra }], `run` : sa graine). Une sorte ne se grave qu'une fois par
 * run sur une carte : rappelée deux fois (après le match, puis à la fin de la run), la gravure ne se double pas. La carte
 * entre au cartable si elle n'y était pas. Rend le nombre de gravures neuves.
 */
export function graverAuCartable(galons = [], run = '') {
  const c = lireCartable();
  let n = 0;
  for (const g of galons) {
    if (!g || !g.k || !LEGENDES[g.type]) continue;
    const x = c.joueurs[g.k] = c.joueurs[g.k] || { v: { commune: 1 }, n: 1 };
    if ((x.legendes || []).some(l => l.type === g.type && l.run === run)) continue;
    x.legendes = [...(x.legendes || []), { type: g.type, run, ...(g.extra != null ? { extra: g.extra } : {}) }].slice(-GRAVURES_MAX);
    n++;
  }
  if (n) ecrire(c);
  return n;
}
/* Ce qui est gravé sur la carte d'un joueur-saison : [{ type, run, extra }] (une gravure d'avant porte `saison`). */
export const legendesDe = (cle, c = lireCartable()) => ((c.joueurs[cle] || {}).legendes || []).filter(l => LEGENDES[l.type]);
/*
 * L'ALBUM (V28, tranche 5b, docs/refonte-v28-5.md § 3.7) : le cartable à plat, pour la page du Club. Les cartes de joueur,
 * les plus belles d'abord (l'édition, puis les gravures, puis les copies) ; les entraîneurs, les plus joués d'abord ; et
 * le compte : les clubs-saisons d'où viennent les cartes, les gravures. Pur : aucune saison chargée, la clé d'une carte dit
 * sa saison et son club (« 1976-77_MTL_8448782 »).
 */
export function albumDuCartable(c = lireCartable()) {
  const cartes = Object.entries(c.joueurs || {}).map(([k, x]) => {
    const [saison, club] = k.split('_');
    return { k, saison, club, ed: [...EDITIONS].reverse().find(r => (x.v || {})[r]) || EDITIONS[0], n: x.n || 1, legendes: (x.legendes || []).filter(l => LEGENDES[l.type]) };
  }).sort((a, b) => RANG[b.ed] - RANG[a.ed] || b.legendes.length - a.legendes.length || b.n - a.n || (a.k < b.k ? -1 : 1));
  const coachs = Object.entries(c.coachs || {}).map(([id, x]) => ({ ...x, id, saison: id.split('_')[0], tag: id.split('_')[1] }))
    .sort((a, b) => (b.r || 0) - (a.r || 0) || (a.rang || 99) - (b.rang || 99) || (a.id < b.id ? -1 : 1));
  return { cartes, coachs, clubs: new Set(cartes.map(x => `${x.saison}_${x.club}`)).size, galons: cartes.reduce((a, x) => a + x.legendes.length, 0) };
}
