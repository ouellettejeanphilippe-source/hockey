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

export const NIVEAUX = [
  { cle: 'soutien', nom: 'Soutien', haut: 1, rang: 'la moitié du bas' },
  { cle: 'regulier', nom: 'Régulier', haut: 0.5, rang: 'la moitié du haut' },
  { cle: 'pilier', nom: 'Pilier', haut: 0.2, rang: 'le 20 % du haut' },
  { cle: 'etoile', nom: 'Étoile', haut: 0.04, rang: 'le 4 % du haut' },
  { cle: 'phenomene', nom: 'Phénomène', haut: 0.01, rang: 'le 1 % du haut' },
];
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
  // Le seuil de chaque niveau, par groupe : la mesure du dernier joueur de sa part du haut.
  const seuils = {};
  for (const g of ['F', 'D', 'G']) {
    const r = uniques.filter(p => groupeDuJoueur(p) === g && regulier(p)).map(p => mesureDuNiveau(p, joueurs)).sort((a, b) => b - a);
    seuils[g] = NIVEAUX.map(N => (r.length ? r[Math.max(0, Math.ceil(r.length * N.haut) - 1)] : Infinity));
  }
  const niveau = p => {
    if (!regulier(p)) return -1;
    const t = seuils[groupeDuJoueur(p)], m = mesureDuNiveau(p, joueurs);
    for (let k = NIVEAUX.length - 1; k > 0; k--) if (m >= t[k]) return k;
    return 0;
  };
  const parNiveau = NIVEAUX.map(() => []);
  for (const p of uniques) { const k = niveau(p); if (k >= 0) parNiveau[k].push(p); }
  s = { niveau, parNiveau };
  SAISONS.set(joueurs, s);
  return s;
}
/* Le niveau d'un joueur (0 à 4, ou −1 s'il n'est pas un régulier) parmi les joueurs de SA saison. */
export const niveauDe = (p, joueurs) => (p && joueurs ? saisonDe(joueurs).niveau(p) : -1);
/* Les réguliers d'une saison rangés par niveau (une personne une fois). */
export const joueursParNiveau = joueurs => saisonDe(joueurs).parNiveau;
