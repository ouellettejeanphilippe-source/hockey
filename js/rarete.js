/**
 * LA RARETÉ, PAR-DESSUS LE JOUEUR (S78).
 *
 * JP : *faudrait que la rareté et cie impacte aussi la performance, ou ajoute
 * des traits, rien de game breaker, mais quand même* ; *pour les raretés pas
 * par joueur, mais par-dessus joueur, comme un shiny dans pokemon genre* ;
 * *rareté = bonus random, donc des fois, joueur pas défensif peut avoir boost
 * défensif pas utile, etc*.
 *
 * UNE RARETÉ EST UNE VARIANTE DE CARTE, PAS UN JOUEUR. N'importe quel joueur
 * — un quatrième trio comme Gretzky — peut sortir en version brillante, par
 * chance : le « shiny » de Pokémon, la parallèle d'une vraie série. La carte
 * de BASE (commune) ne fait rien de plus que le joueur. Une brillante porte un
 * BONUS TIRÉ AU HASARD dans une réserve — précision, canon, vision,
 * défensif, solide, clutch, polyvalent ; réflexes ou solide pour un gardien
 * — et il colle au joueur… ou pas : un défensif en or avec « Précision », un
 * franc-tireur en holo avec « Étanche ». C'est la chance du paquet.
 *
 * LA FORCE SUIT LA RARETÉ : une parallèle +3 %, une holo +5 %, une or DEUX
 * bonus à +5 %. Les canaux qui pèsent moins au quotidien (les blessures, le
 * clutch qui ne joue que les grands soirs, la pénalité hors position) valent
 * plus, pour que chaque bonus compte à peu près autant. « Rien de game
 * breaker » : un seul joueur, quelques pour cent.
 *
 * TOUT EST PUR : la variante se tire de la graine de la partie et de la clé
 * du joueur (`varianteTiree`), le bonus aussi (`carteDe`). Un même joueur
 * garde la même carte d'un tour à l'autre et d'une reprise à l'autre ; un
 * pack du mode Rogue écrit la sienne (js/game.js, `G.variantes`).
 *
 * SEULES TES CARTES JOUENT. Le moteur lit `p._carte`, que le contrôleur ne
 * pose que sur les joueurs de TON alignement (js/game.js) : les clubs
 * adverses jouent leurs joueurs, pas des cartes. Un script de mesure qui ne
 * pose rien n'a aucun de ces effets.
 */
import { hache } from './util.js';

/* Les cotes d'une carte ordinaire (le repêchage, le ballottage, la recrue) : une sur quatre brille. */
export const COTES_VARIANTES = { commune: 75, peu: 17, rare: 6, legendaire: 2 };
const FORCE = { peu: 0.03, rare: 0.05, legendaire: 0.05 };
const NOMBRE = { peu: 1, rare: 1, legendaire: 2 };
export const NOM_VARIANTE = { commune: 'Base', peu: 'Parallèle', rare: 'Holo', legendaire: 'Or' };

/*
 * LA RÉSERVE DES BONUS. `sens` : +1 monte le canal, −1 le baisse (moins de
 * buts contre, moins de blessures). `fois` : le multiplicateur de force d'un
 * canal qui pèse moins au quotidien.
 */
/* 1.0 (C1) : aucune icône d'un rôle ou d'un trophée — 🎯 est le sniper, 🚀 le défenseur offensif, 🪄 le Créateur, 🛡️ le Selke, 🧤 le Voleur. */
export const BONUS = {
  finition: { ico: '📍', nom: 'Précision', canal: 'finition', sens: 1, mot: x => `Ses tirs entrent : précision +${x} %.` },
  lancers: { ico: '☄️', nom: 'Canon', canal: 'lancers', sens: 1, mot: x => `Il lance plus : tirs +${x} %.` },
  creation: { ico: '👓', nom: 'Vision', canal: 'creation', sens: 1, mot: x => `Ses passes font marquer : création +${x} %.` },
  defense: { ico: '⛔', nom: 'Étanche', canal: 'defense', sens: -1, mot: x => `Buts contre −${x} % quand il est sur la glace.` },
  solide: { ico: '🩹', nom: 'Solide', canal: 'blessure', sens: -1, fois: 4, mot: x => `Blessures −${x} %.` },
  clutch: { ico: '🧊', nom: 'Clutch', canal: 'clutch', sens: 1, fois: 2, mot: x => `Les grands soirs (gros match, séries) : précision +${x} %.` },
  polyvalent: { ico: '🔄', nom: 'Polyvalent', canal: 'horsPosition', sens: -1, fois: 6, mot: x => `Pénalité hors position −${x} %.` },
  reflexes: { ico: '🐱', nom: 'Réflexes', canal: 'arrets', sens: -1, mot: x => `Buts accordés −${x} %.` },
};
const RESERVE_PATINEUR = ['finition', 'lancers', 'creation', 'defense', 'solide', 'clutch', 'polyvalent'];
const RESERVE_GARDIEN = ['reflexes', 'reflexes', 'solide'];
export const RECRUE_PROGRESSE = { ico: '🐣', nom: 'Le jeune progresse', mot: 'Contrat d\'entrée : précision +1 % à partir de son 42e match.', apres: 41, finition: 1.01 };

/* La variante tirée selon des cotes (en %), de la graine et de la clé du joueur. */
export function varianteTiree(cotes, ...parts) {
  let r = hache('variante', ...parts) * 100;
  for (const k of ['commune', 'peu', 'rare', 'legendaire']) { r -= cotes[k] || 0; if (r < 0) return k; }
  return 'commune';
}
/*
 * LA CARTE D'UN JOUEUR : sa variante et ses bonus, tirés de la graine et de
 * sa clé. Une or tire deux bonus DIFFÉRENTS.
 */
export function carteDe(rarete, gardien, ...parts) {
  if (!NOMBRE[rarete]) return { rar: 'commune', bonus: [] };
  const reserve = gardien ? RESERVE_GARDIEN : RESERVE_PATINEUR;
  const pris = [];
  for (let k = 0; pris.length < NOMBRE[rarete] && k < 24; k++) {
    const cle = reserve[Math.floor(hache('bonus', k, ...parts) * reserve.length)];
    if (!pris.includes(cle)) pris.push(cle);
  }
  return { rar: rarete, bonus: pris.map(cle => ({ cle, x: FORCE[rarete] * (BONUS[cle].fois || 1) })) };
}

/* Le soir en cours est-il « grand » (gros match, séries) ? Le moteur le pose au début de chaque match. */
let SOIR_GRAND = false;
export function poserSoirGrand(oui) { SOIR_GRAND = !!oui; }

/*
 * L'EFFET D'UNE CARTE SUR UN CANAL du moteur, pour un joueur : un facteur (1 =
 * rien). `finition` porte aussi le clutch les grands soirs et la recrue qui a
 * fait ses classes (ses matchs joués cette saison, `simGP`).
 */
export function effetCarte(p, canal) {
  const c = p && p._carte;
  if (!c) return 1;
  let f = 1;
  for (const b of c.bonus) {
    const B = BONUS[b.cle];
    if (B.canal === canal || (canal === 'finition' && B.canal === 'clutch' && SOIR_GRAND)) f *= 1 + B.sens * b.x;
  }
  if (canal === 'finition' && c.recrue && (p.simGP || 0) > RECRUE_PROGRESSE.apres) f *= RECRUE_PROGRESSE.finition;
  return f;
}

/* Ce qu'une carte fait sur la glace, en mots : l'écran l'affiche UNE fois. Rien pour une carte de base. */
export function traitsDeCarte(carte) {
  const out = (carte && carte.bonus ? carte.bonus : []).map(b => {
    const B = BONUS[b.cle];
    const pct = Math.round(b.x * 1000) / 10;
    return { ico: B.ico, nom: B.nom, mot: B.mot(String(pct).replace('.', ',')) };
  });
  if (carte && carte.recrue) out.push({ ico: RECRUE_PROGRESSE.ico, nom: RECRUE_PROGRESSE.nom, mot: RECRUE_PROGRESSE.mot });
  return out;
}
