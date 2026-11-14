/*
 * LE BANC QUI COMPTE (V29, tranche 1 ; docs/refonte-v29.md § 3). JP, 13 nov. 2026 : *le roguelike est pas le fun, ni
 * bâti comme il faut pour être un vrai jeu* ; il défait « une carte change la forme du match, pas sa force » pour le banc.
 *
 *   LA PIÈCE    elle COMPTE quelque chose chez tes joueurs (`compte` : les badges d'un ou deux rôles, chacun à son palier,
 *               Bronze 1 à Platine 4, le second badge d'un joueur à moitié) et MULTIPLIE un canal du moteur (`cote` : le
 *               tien, `canaux`, ou le leur, `adv` ; `canal` : les tirs, `volume`, ou la précision, `finition`), tout le
 *               match, chaque match. PAR MARCHES : rien sous son premier seuil, puis trois marches (`MARCHES`), chacune
 *               plus haute que la précédente — la concentration paie plus que l'éparpillement.
 *   QUI COMPTE  dans une run, seuls les joueurs que tu as signés (JP, 14 nov. 2026 ; js/run.js `signesDe`) : un bouche-trou
 *               du départ ne compte pour rien. Pour l'adversaire des séries, tout son club.
 *   LE BANC     `CASES_DU_BANC` cases, pour toute la run : `perso.banc`, les clés dans l'ordre des cases. Deux pièces sur
 *               le même canal se multiplient, et le produit d'un canal est borné (`BORNE_DU_CANAL`).
 *   LE COACH    sa philosophie (`cle`), son vrai entraîneur (`chef`) et sa maîtrise (×0,9 à ×1,3, js/niveaux.js), qui règle
 *               les marches de sa seule pièce de départ (`PIECE_DU_COACH` : elle compte les rôles de sa couleur,
 *               js/coachs.js `COACH_DU_ROLE`).
 *
 * Mesuré avant d'être écrit (scripts d'essai des 13 et 14 nov. 2026, deux juges de 256 graines neuves, docs/refonte-v29.md
 * § 4) : le robot qui bâtit autour de son banc tient 78 % de ses cibles, le même robot qui ne lit pas son banc 57 %. En
 * ligne droite (tant par palier), bâtir ne payait pas : un banc se payait en cote ce qu'il rapportait.
 *
 * Pur : le moteur (par js/greffes.js), l'écran et les robots lisent la même table et les mêmes fonctions.
 */
import { hache } from './util.js';
import { badgesDe } from './sim.js';
import { groupeDuJoueur } from './niveaux.js';

export const CASES_DU_BANC = 5;
export const PIECES_OFFERTES = 3;
/* Ce qu'une marche rend, en % du canal : la première, la deuxième, la troisième. */
export const MARCHES = [12, 37, 75];
/* Le produit de toutes les pièces sur un même canal : au plus ×3 sur le tien, ÷3 sur le leur. */
export const BORNE_DU_CANAL = 3;

/*
 * LA FAMILLE (neuf pièces, celles que la mesure a jugées). `voie` : la philosophie qui la porte au départ ; `compte` :
 * les rôles comptés (`F:` un avant, `D:` un défenseur) ; `qui` : les mêmes, en mots pour l'écran ; `seuils` : le compte de
 * chaque marche, posé sur ce qu'un effectif de signés atteint (trois au camp, huit à la fin de l'acte I, une vingtaine à
 * la fin) ; `genre` : la couleur de sa carte. Aucune ne porte le nom d'un accord de ligne (js/sim.js `AFFINITES`).
 */
export const PIECES = {
  tireurs: { voie: 'rapaces', cadre: 3, genre: 'attaque', ico: '🎯', nom: 'Les tireurs', compte: ['F:sniper'], qui: 'tes snipers', cote: 'canaux', canal: 'finition', seuils: [7, 14, 21] },
  passeurs: { voie: 'etoiles', cadre: 3, genre: 'attaque', ico: '🅰', nom: 'Les passeurs', compte: ['F:passeur'], qui: 'tes passeurs', cote: 'canaux', canal: 'volume', seuils: [7, 13, 19] },
  gros: { voie: 'essaim', cadre: 3, genre: 'attaque', ico: '🦍', nom: 'Les gros', compte: ['F:power'], qui: 'tes power forwards', cote: 'canaux', canal: 'volume', seuils: [4, 8, 12] },
  lignebleue: { voie: 'essaim', cadre: 3, genre: 'attaque', ico: '🚀', nom: 'La ligne bleue', compte: ['D:offensif'], qui: 'tes défenseurs offensifs', cote: 'canaux', canal: 'volume', seuils: [5, 11, 16] },
  manieurs: { voie: 'choeur', cadre: 3, genre: 'attaque', ico: '🏒', nom: 'Les manieurs', compte: ['D:manieur'], qui: 'tes manieurs de rondelle', cote: 'canaux', canal: 'finition', seuils: [5, 10, 14] },
  deuxsens: { voie: 'tortue', cadre: 3, genre: 'defense', ico: '☯', nom: 'Les deux sens', compte: ['F:deuxsens', 'D:deuxsens'], qui: 'tes two-way', cote: 'adv', canal: 'finition', seuils: [6, 12, 18] },
  etouffoir: { voie: 'profondeur', cadre: 3, genre: 'defense', ico: '🔧', nom: 'L\'étouffoir', compte: ['F:checker'], qui: 'tes checkers', cote: 'adv', canal: 'volume', seuils: [3, 6, 9] },
  colsbleus: { voie: 'souffle', cadre: 3, genre: 'defense', ico: '🪠', nom: 'Les cols bleus', compte: ['F:energie', 'F:bagarreur'], qui: 'tes plombiers et tes bagarreurs', cote: 'adv', canal: 'finition', seuils: [4, 8, 11] },
  muraille: { voie: 'rhinos', cadre: 3, genre: 'defense', ico: '🛑', nom: 'La muraille', compte: ['D:defensif', 'D:physique'], qui: 'tes défenseurs défensifs et physiques', cote: 'adv', canal: 'volume', seuils: [4, 7, 10] },
};
/* La pièce de départ de chaque coach : celle qui compte les rôles de sa couleur. */
export const PIECE_DU_COACH = { essaim: 'gros', rapaces: 'tireurs', tortue: 'deuxsens', rhinos: 'muraille', souffle: 'colsbleus', choeur: 'manieurs', profondeur: 'etouffoir', etoiles: 'passeurs' };

/* ---------- le compte, la marche, l'effet ---------- */
/* Ce qu'un joueur ajoute au compte d'une pièce : les paliers de ses badges comptés, le second badge à moitié. */
export function apportDe(cle, p) {
  const P = PIECES[cle];
  if (!P || !p) return 0;
  const g = groupeDuJoueur(p);
  return badgesDe(p).reduce((a, b) => a + (P.compte.includes(`${g}:${b.cle}`) ? (b.second && !b.plein ? b.palier / 2 : b.palier) : 0), 0);
}
export const compteDe = (cle, joueurs) => (joueurs || []).reduce((a, p) => a + apportDe(cle, p), 0);
/* La marche atteinte, de 0 à 3 ; le seuil d'après, ou null à la dernière. */
export const marcheDe = (cle, n) => (PIECES[cle] ? PIECES[cle].seuils.filter(s => n >= s).length : 0);
export const seuilSuivant = (cle, n) => (PIECES[cle] ? PIECES[cle].seuils.find(s => n < s) ?? null : null);
/* La force d'une pièce sur ce banc : la maîtrise de l'entraîneur pour sa pièce de départ, 1 pour les autres. */
export const forceDeLaPiece = (perso, cle) => (perso && !perso.adverse && cle === PIECE_DU_COACH[perso.cle] ? Math.min(1.3, Math.max(0.9, Number(perso.maitrise) || 1)) : 1);
/* Le multiplicateur d'une pièce à une marche : ton canal monte (`1 + %`), le leur descend (`1 / (1 + %)`) ; 1 sous le premier seuil. */
export function facteurDe(cle, marche, force = 1) {
  const P = PIECES[cle];
  if (!P || marche <= 0) return 1;
  const pct = MARCHES[Math.min(marche, MARCHES.length) - 1] * force / 100;
  return P.cote === 'adv' ? 1 / (1 + pct) : 1 + pct;
}

/* ---------- le banc ---------- */
/* Le banc d'un personnage, propre : ses pièces connues, dans l'ordre des cases. */
export const bancDe = perso => ((perso && perso.banc) || []).filter(k => PIECES[k]).slice(0, CASES_DU_BANC);
/*
 * POSER UNE PIÈCE : elle entre dans la première case libre ; le banc plein, elle prend la case de `sort` (qui part) ;
 * déjà là, ou plein sans `sort` sur le banc, rien ne bouge. Rend le banc.
 */
export function poserLaPiece(banc, cle, sort = null) {
  const b = (banc || []).filter(k => PIECES[k]).slice(0, CASES_DU_BANC);
  if (!PIECES[cle] || b.includes(cle)) return b;
  if (b.length < CASES_DU_BANC) return [...b, cle];
  const i = b.indexOf(sort);
  return i < 0 ? b : b.map((k, j) => (j === i ? cle : k));
}
/*
 * LES PIÈCES OFFERTES (une parmi trois), tirées de la graine parmi celles qui ne sont pas déjà sur le banc. `cle` : le
 * moment (le camp, le rival battu, l'élite, le marché) ; deux moments n'offrent pas les mêmes. Le jeu et les robots
 * tirent tous ici.
 */
export function piecesOffertes(perso, graine, cle, n = PIECES_OFFERTES) {
  const pris = new Set(bancDe(perso));
  return Object.keys(PIECES).filter(k => !pris.has(k)).map(k => [hache(String(graine), 'piece', cle, k), k]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
}
/*
 * LE BANC D'UN MATCH, pur : chaque pièce du banc, son compte chez `joueurs` (ceux qui comptent : tes signés, ou tout le
 * club d'un adversaire), sa marche et son multiplicateur, la maîtrise comprise ; le produit de chaque canal borné à
 * `BORNE_DU_CANAL`, la pièce qui le dépasse rabotée. Rend [{ cle, P, n, marche, facteur, canaux?, adv? }] : `canaux` ou
 * `adv` seulement si la pièce joue (marche 1 ou plus).
 */
export function bancDuMatch(perso, joueurs) {
  const produit = {};
  return bancDe(perso).map(cle => {
    const P = PIECES[cle], n = compteDe(cle, joueurs), marche = marcheDe(cle, n), k = `${P.cote}:${P.canal}`;
    let f = facteurDe(cle, marche, forceDeLaPiece(perso, cle));
    const avant = produit[k] ?? 1, apres = Math.min(BORNE_DU_CANAL, Math.max(1 / BORNE_DU_CANAL, avant * f));
    f = apres / avant; produit[k] = apres;
    return { cle, P, n, marche, facteur: f, ...(marche > 0 ? { [P.cote]: { [P.canal]: f } } : {}) };
  });
}

/*
 * LEUR BANC EN SÉRIES (JP, 14 nov. 2026 : « les séries sont le mur » ; un vrai banc en face, qui grandit). L'adversaire
 * d'une série porte les pièces qui comptent le plus chez lui, tout son club compté : `BANC_DES_SERIES` pièces selon la
 * ronde. Sa philosophie (`cle`), lue sur le style du club (`t.style`, js/sim.js `poserStyles`) ou tirée de son nom, ne
 * sert qu'à le nommer. Pur.
 */
export const BANC_DES_SERIES = [1, 2, 3];
export const COACH_DU_STYLE = { offensif: 'essaim', defensif: 'tortue', robuste: 'rhinos' };
const AUTRES_COACHS = ['rapaces', 'souffle', 'choeur', 'profondeur', 'etoiles'];
export function persoAdverse(team, ronde = 0) {
  const cle = COACH_DU_STYLE[team.style] || AUTRES_COACHS[Math.floor(hache(String(team.tag || ''), String(team.season || ''), 'leur coach') * AUTRES_COACHS.length)];
  const joueurs = Object.values(team.roster || {}).filter(Boolean);
  // Les plus avancées chez lui : la marche d'abord, puis le compte rapporté au premier seuil ; à égalité, l'ordre de la table.
  const rang = k => { const n = compteDe(k, joueurs); return marcheDe(k, n) * 100 + Math.min(99, n / PIECES[k].seuils[0]); };
  const banc = Object.keys(PIECES).map((k, i) => [rang(k), -i, k]).sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, BANC_DES_SERIES[Math.min(BANC_DES_SERIES.length - 1, Math.max(0, ronde))]).map(x => x[2]);
  return { cle, banc, maitrise: 1, adverse: true };
}
