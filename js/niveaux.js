/**
 * LES NIVEAUX DE JOUEUR (S80) — ce qu'un joueur a VALU dans sa vraie saison,
 * lu dans ses vraies statistiques, jamais dans une cote.
 *
 * JP : *packs selon les niveaux de joueurs, genre joueur moins bons plus
 * fréquents, du moins, joueurs brisés moins fréquents*.
 *
 * Un pack pigeait presque uniformément dans la moitié productive d'une
 * saison : Gretzky à 212 points sortait aussi souvent qu'un joueur de soutien.
 * Une vraie boîte de cartes ne marche pas comme ça — ni une boîte de hockey,
 * ni un booster Pokémon : les joueurs ordinaires sortent souvent, les
 * vedettes rarement, et la carte qui casse tout, presque jamais. Pour tirer
 * comme ça, il faut d'abord savoir qui est ordinaire et qui est hors normes.
 *
 * LE NIVEAU EST UN RANG. Parmi les RÉGULIERS de sa saison — ceux de l'étoile
 * de S78 : 40 matchs, ou la moitié d'une saison écourtée ; 30 pour un
 * gardien, ou 35 % de la saison —, à son POSTE (avants, défenseurs,
 * gardiens) : aux points par match pour un patineur, aux buts évités pour un
 * gardien. Le rang se prend à son poste parce qu'un défenseur à 60 points
 * est une vedette sans jamais approcher le 4 % du haut de TOUS les pointeurs
 * (avant S80, 51 défenseurs étoiles en 55 saisons ; 388 maintenant).
 *
 * OU À SA DÉFENSE (27 oct. 2026 ; JP, devant une run de « Soutien » qui
 * finit 12e : *clarifier la défense*). Un patineur vaut aussi ce qu'il
 * défend : le même rang, à son poste, sur sa mesure défensive de saison
 * (`mesuresDeSaison`, js/ratings.js — le +/- relatif à son club, les points
 * en désavantage, les minutes ; les mêmes mots que la fiche), et il garde
 * LE MEILLEUR des deux rangs. Jason Smith 2007-08, 10 points et 22 minutes
 * de désavantage par soir, lisait « Soutien » et jouait comme un Pilier ;
 * Craig Ramsay 1974-75, Régulier aux points, est une Étoile à la défense.
 * Un niveau gagné à la défense se dit (`niveauParDefense`, la pastille
 * « déf. ») ; les packs, le classeur et le ballottage le rangent où il joue.
 *
 *   Phénomène   le 1 % du haut      le « brisé » : Orr 1970-71, Gretzky 1981-82
 *   Étoile      le 4 % du haut      l'étoile de S78 (le ruban ★ de la carte)
 *   Pilier      le 20 % du haut
 *   Régulier    la moitié du haut
 *   Soutien     la moitié du bas
 *
 * Une seule définition : l'ÉTOILE du ruban (`estEtoile`, js/game.js), le pack
 * Étoiles et le niveau sont la même chose. Avant S80, l'étoile se lisait aux
 * points TOTAUX de tous les patineurs ensemble et au 8 % des gardiens ; deux
 * définitions de « vedette » côte à côte se seraient contredites sur la même
 * carte. Pas de « Premier trio » : un joueur ne se nomme jamais par une case
 * d'alignement, et un défenseur ou un gardien n'en a pas.
 *
 * Un joueur qui n'est pas un régulier n'a pas de niveau (−1) : il ne sort
 * d'aucun pack par niveau. Un joueur échangé (`x:1`) est dans le vestiaire de
 * chaque club où il a passé, avec les totaux de sa saison : il ne compte
 * qu'une fois dans le rang.
 *
 * TOUT EST PUR : le niveau ne dépend que des joueurs de la saison, calculé
 * une fois par saison (le tableau des joueurs d'un shard sert de clé).
 */

import { mesuresDeSaison } from './ratings.js';
import { famillesBrutes, FAMILLES, clesSpeciales } from './sim.js';

export const NIVEAUX = [
  { cle: 'soutien', nom: 'Soutien', haut: 1, rang: 'la moitié du bas' },
  { cle: 'regulier', nom: 'Régulier', haut: 0.5, rang: 'la moitié du haut' },
  { cle: 'pilier', nom: 'Pilier', haut: 0.2, rang: 'le 20 % du haut' },
  { cle: 'etoile', nom: 'Étoile', haut: 0.04, rang: 'le 4 % du haut' },
  { cle: 'phenomene', nom: 'Phénomène', haut: 0.01, rang: 'le 1 % du haut' },
];
export const REGULIER = 1;
export const PILIER = 2;
export const ETOILE = 3;
export const PHENOMENE = 4;

/* Le groupe du rang : avants, défenseurs, gardiens. */
export const groupeDuJoueur = p => (p.p === 'G' ? 'G' : p.p === 'D' || p.p === 'LD' || p.p === 'RD' ? 'D' : 'F');
const points = p => p.pt ?? ((p.g || 0) + (p.a || 0));
/*
 * LES BUTS ÉVITÉS D'UN GARDIEN (1.0, oct.). JP : *Soutien ?* — Rask (64 matchs, ,915) et
 * Kiprusoff, partants, lisaient « Soutien » : au % d'arrêts seul, le travail ne comptait pas, et un
 * auxiliaire de 30 matchs à ,920 passait devant un partant de 65 à ,915. La mesure est maintenant
 * ce qu'il a évité à son club : ses tirs reçus × (son % d'arrêts − celui de la ligue, pondéré par
 * les tirs). Un partant solide monte ; un auxiliaire chanceux descend. Sans tirs reçus (une vieille
 * fiche), son % d'arrêts contre la ligue, sur des tirs estimés à trente par match.
 */
const SV_LIGUE = new WeakMap();
function svLigue(joueurs) {
  let v = SV_LIGUE.get(joueurs);
  if (v === undefined) {
    let tirs = 0, arrets = 0;
    for (const x of joueurs) if (x.p === 'G' && x.sa && x.sv != null) { tirs += x.sa; arrets += x.sa * x.sv; }
    v = tirs ? arrets / tirs : 0.9;
    SV_LIGUE.set(joueurs, v);
  }
  return v;
}
/* Ce qui se range : les points par match d'un patineur, les buts évités d'un gardien (dans SA saison : `joueurs`). */
export const mesureDuNiveau = (p, joueurs) => (p.p === 'G'
  ? ((p.sa || 30 * (p.gp || 0)) * ((p.sv || 0) - svLigue(joueurs)))
  : points(p) / Math.max(1, p.gp || 0));
const personne = p => (p.id != null ? p.id : `${p.n}_${p.p}`);
/*
 * LES AXES DE L'HEXAGONE (30 oct. 2026 ; JP : *un genre de chart à la FIFA, comme leurs hexagones* ; *hexagone si tu peux avoir
 * des stats pertinentes* ; *les pp, les pk*). Chaque axe est une chose que le moteur JOUE de lui, jamais un chiffre inventé :
 *   un patineur   Tir, Jeu, Défense, Robustesse (les quatre familles, `famillesBrutes`) ; l'Avantage et le Désavantage, les
 *                 clés sur lesquelles le moteur range ses unités spéciales (`clesSpeciales`, js/sim.js : les points en
 *                 avantage et la création, les points en désavantage et la défense — tenus depuis 1970-71) ;
 *   un gardien    les Arrêts (son % d'arrêts, ce que chaque lancer lui demande), la Charge (les lancers reçus par match :
 *                 un % égal sous deux fois les lancers, c'est l'Acrobate et les buts évités) et la Présence (ses matchs :
 *                 la rotation du filet et De fer). Un gardien à ,920 derrière un mur et un à ,920 sous le bombardement
 *                 se distinguent enfin (JP : *ceux qui ont un excellent % ou une MBA, et ceux qui ont les deux*).
 */
export const AXES = {
  F: [...Object.keys(FAMILLES), 'avantage', 'desavantage'],
  D: [...Object.keys(FAMILLES), 'avantage', 'desavantage'],
  G: ['arrets', 'charge', 'presence'],
};
function valeursDesAxes(p) {
  if (p.p === 'G') return { arrets: p.sv != null ? p.sv : null, charge: p.sa > 0 && p.gp > 0 ? p.sa / p.gp : null, presence: p.gp || 0 };
  const b = famillesBrutes(p);
  if (!b) return {};
  const c = clesSpeciales(p);
  return { ...b, avantage: c.an, desavantage: c.dn };
}

const SAISONS = new WeakMap();
function saisonDe(joueurs) {
  let s = SAISONS.get(joueurs);
  if (s) return s;
  let gpMax = 1;
  for (const x of joueurs) gpMax = Math.max(gpMax, x.gp || 0);
  // Les réguliers de l'étoile de S78 : une saison écourtée (ou en cours) abaisse le seuil.
  const minP = Math.min(40, Math.floor(gpMax * 0.5)), minG = Math.min(30, Math.floor(gpMax * 0.35));
  const regulier = p => (p.gp || 0) >= (p.p === 'G' ? minG : minP);
  const vus = new Set(), uniques = [];
  for (const p of joueurs) { const k = personne(p); if (!vus.has(k)) { vus.add(k); uniques.push(p); } }
  // Le seuil de chaque niveau, par groupe : la mesure du dernier joueur de sa part du haut — aux points
  // (`seuils`), et à la défense (`seuilsDef`, les patineurs seulement).
  const mes = mesuresDeSaison(joueurs);
  const defDe = p => { const m = mes.get(p); return m && m.def != null ? m.def : null; };
  const seuilsSur = (g, f) => {
    const r = uniques.filter(p => groupeDuJoueur(p) === g && regulier(p)).map(f).filter(x => x != null).sort((a, b) => b - a);
    return NIVEAUX.map(N => (r.length ? r[Math.max(0, Math.ceil(r.length * N.haut) - 1)] : Infinity));
  };
  const seuils = {}, seuilsDef = {};
  for (const g of ['F', 'D', 'G']) { seuils[g] = seuilsSur(g, p => mesureDuNiveau(p, joueurs)); seuilsDef[g] = g === 'G' ? null : seuilsSur(g, defDe); }
  const rang = (t, m) => { if (m == null || !t) return 0; for (let k = NIVEAUX.length - 1; k > 0; k--) if (m >= t[k]) return k; return 0; };
  const niveauAuxPoints = p => (regulier(p) ? rang(seuils[groupeDuJoueur(p)], mesureDuNiveau(p, joueurs)) : -1);
  const niveauALaDefense = p => (regulier(p) ? rang(seuilsDef[groupeDuJoueur(p)], defDe(p)) : -1);
  const niveau = p => Math.max(niveauAuxPoints(p), niveauALaDefense(p));
  const parDefense = p => regulier(p) && niveauALaDefense(p) > niveauAuxPoints(p);
  const parNiveau = NIVEAUX.map(() => []);
  for (const p of uniques) { const k = niveau(p); if (k >= 0) parNiveau[k].push(p); }
  // CEUX QUI N'ONT PAS DE NIVEAU (Jalon P2b, tout se pige) : sous le seuil d'un régulier, ou la seconde fiche d'un
  // joueur échangé. Les packs les donnent comme des Soutien, à petit poids (`PART_HORS_NIVEAU`, js/packs.js).
  const classes = new Set(parNiveau.flat());
  const horsNiveau = joueurs.filter(p => !classes.has(p));
  // LA COTE SUR 20 (docs/cotes-sur-20.md) : la même mesure que le niveau, déroulée entre ses seuils — le bas de Soutien est
  // à 1, le haut de Soutien à 8, Régulier 9 à 12, Pilier 13 à 16, Étoile 17 à 19, Phénomène 20. Le meilleur des points et de la défense.
  const ECHELLE = [1, 9, 13, 17, 20];
  const surVingt = (t, m) => {
    if (m == null || !t || !Number.isFinite(t[0])) return null;
    if (m >= t[4]) return 20;
    for (let k = 3; k >= 0; k--) {
      if (m < t[k]) continue;
      const a = ECHELLE[k], b = ECHELLE[k + 1], f = t[k + 1] > t[k] ? (m - t[k]) / (t[k + 1] - t[k]) : 0;
      return Math.min(b - 1, Math.floor(a + (b - a) * f));
    }
    return 1;
  };
  const cote = (p, aux_points = false) => {
    if (!regulier(p)) return null;
    const g = groupeDuJoueur(p);
    const a = surVingt(seuils[g], mesureDuNiveau(p, joueurs)), d = seuilsDef[g] && !aux_points ? surVingt(seuilsDef[g], defDe(p)) : null;
    return Math.max(a ?? 1, d ?? 1);
  };
  // LES COTES D'UN JOUEUR (`AXES`) : son rang dans sa saison, à son poste, sur ce que le moteur lit de chaque axe, déroulé
  // de 1 (le dernier) à 20 (le premier), en cloche (JP, 30 oct. : *des joueurs vraiment performants, c'est rare ; la
  // plupart sont bons, moyens ou poches*) : le milieu du rang s'étale sur 10, les bouts se resserrent — un 19 ou un 20 est
  // rare. Le rang d'un régulier, pour lui comme pour qui joue peu.
  const listes = {};
  for (const g of ['F', 'D', 'G']) {
    listes[g] = {};
    const valeurs = uniques.filter(p => groupeDuJoueur(p) === g && regulier(p)).map(valeursDesAxes);
    for (const k of AXES[g]) listes[g][k] = valeurs.map(v => v[k]).filter(x => x != null).sort((a, b) => a - b);
  }
  const axes = p => {
    const g = groupeDuJoueur(p), v = valeursDesAxes(p), out = {};
    for (const k of AXES[g]) {
      const L = listes[g][k];
      if (v[k] == null || !L.length) continue;
      let n = 0; while (n < L.length && L[n] < v[k]) n++;
      const u = 2 * (n / L.length - 0.5);
      const q = 0.5 + 0.5 * Math.sign(u) * Math.pow(Math.abs(u), 2);
      out[k] = Math.max(1, Math.min(20, 1 + Math.round(19 * q)));
    }
    return Object.keys(out).length ? out : null;
  };
  s = { niveau, parDefense, seuils, parNiveau, horsNiveau, cote, axes };
  SAISONS.set(joueurs, s);
  return s;
}
/* Le niveau d'un joueur (0 à 4, ou −1 s'il n'est pas un régulier) parmi les joueurs de SA saison. */
export const niveauDe = (p, joueurs) => (p && joueurs ? saisonDe(joueurs).niveau(p) : -1);
/* Vrai quand c'est sa défense, pas ses points, qui lui donne son niveau : la pastille le dit (« déf. »). */
export const niveauParDefense = (p, joueurs) => !!(p && joueurs && saisonDe(joueurs).parDefense(p));
/* Le seuil aux points (ou aux buts évités) du niveau `k` d'un groupe : la barre d'un joueur sans niveau (le ballottage). */
export const seuilDuNiveau = (joueurs, g, k) => saisonDe(joueurs).seuils[g][k];
/* Les réguliers d'une saison rangés par niveau (une personne une fois). */
export const joueursParNiveau = joueurs => saisonDe(joueurs).parNiveau;
export const joueursHorsNiveau = joueurs => saisonDe(joueurs).horsNiveau;
/* Ses cotes sur 20 (`AXES` : six pour un patineur, trois pour un gardien) dans SA saison, ou null (un joueur sans lecture). */
export const axes20 = (p, joueurs) => (p && joueurs ? saisonDe(joueurs).axes(p) : null);
/* La cote sur 20 d'un joueur dans SA saison (1 à 20), ou null s'il n'est pas un régulier. Un appui à lire après le niveau, jamais un tri. */
export const cote20 = (p, joueurs, auxPointsSeulement = false) => (p && joueurs ? saisonDe(joueurs).cote(p, auxPointsSeulement) : null);
