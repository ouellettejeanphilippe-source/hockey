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
 * de BASE (commune) ne fait rien de plus que le joueur. Jusqu'à V2.4, une
 * brillante portait un bonus tiré au hasard (précision, canon, vision…) qui
 * collait au joueur… ou pas : un défensif en or avec « Précision ».
 *
 * V2.4 — LA VARIANTE SERT LE JOUEUR (docs/refonte-systeme.md § 10). JP : *la
 * variante (holo, or) cesse d'être tirée au hasard : elle monte le palier de
 * la carte*. Le bonus de 3 à 5 % sur un canal tiré au hasard (un défensif en
 * or avec « Précision ») est parti : une parallèle monte son SECOND badge d'un
 * palier, une holo son PREMIER, une or les deux (`VARIANTE_PALIERS`, lu par
 * `badgesDe`, js/sim.js) ; un gardien (un seul badge), un, deux ou trois. Ce que
 * le badge fait, la carte le fait, au joueur qu'elle habille.
 *
 * TOUT EST PUR : la variante se tire de la graine de la partie et de la clé
 * du joueur (`varianteTiree`). Un même joueur
 * garde la même carte d'un tour à l'autre et d'une reprise à l'autre ; un
 * pack du mode Rogue écrit la sienne (js/game.js, `G.variantes`).
 *
 * SEULES TES CARTES JOUENT. Le moteur lit `p._carte`, que le contrôleur ne
 * pose que sur les joueurs de TON alignement (js/game.js) : les clubs
 * adverses jouent leurs joueurs, pas des cartes. Un script de mesure qui ne
 * pose rien n'a aucun de ces effets.
 */
import { hache } from './util.js';
import { getTraits } from './traits.js';
import { ageAtSeason } from './ratings.js';

/* Les cotes d'une carte ordinaire, en moyenne (le repêchage, le ballottage, la recrue) : une sur quatre brille. */
export const COTES_VARIANTES = { commune: 75, peu: 17, rare: 6, legendaire: 2 };
/*
 * LA BRILLANTE VA AUX VEDETTES (V5). JP : *la rareté des cartes devrait avoir un lien avec leur niveau ; irl, les holo,
 * c'est généralement les vedettes ou les joueurs vraiment aimés : capitaines, leaders, vétérans, recrues* ; *tu pulls un
 * Crosby normal, 125 points, nice ; tu pognes le holo, c'est une machine de guerre*. La STATURE d'un joueur, c'est son
 * niveau dans sa saison (Soutien 0 → Phénomène 4), plus un cran s'il est recrue (`rk`), vétéran (VETERAN ans et plus)
 * ou 🧭 Meneur ; ses cotes de variante suivent sa stature. Un Soutien peut encore briller (le « shiny »), juste
 * rarement ; une vedette brille souvent. Les cotes restent en moyenne près de COTES_VARIANTES (check_atelier).
 */
const VETERAN = 34;
export const COTES_PAR_STATURE = [
  { commune: 85, peu: 13.6, rare: 1.2, legendaire: 0.2 },
  { commune: 77, peu: 19, rare: 3.4, legendaire: 0.6 },
  { commune: 66, peu: 24, rare: 8, legendaire: 2 },
  { commune: 50, peu: 28, rare: 16, legendaire: 6 },
  { commune: 32, peu: 30, rare: 26, legendaire: 12 },
];
export function statureDe(p, niveau) {
  if (!p) return 0;
  const age = p.bd && p.s ? ageAtSeason(p.bd, p.s) : null;
  const marques = (p.rk ? 1 : 0) + (age != null && age >= VETERAN ? 1 : 0) + (getTraits(p).some(t => t.cle === 'MENEUR') ? 1 : 0);
  return Math.max(0, Math.min(COTES_PAR_STATURE.length - 1, Math.max(0, niveau ?? 0) + marques));
}
export const NOM_VARIANTE = { commune: 'Base', peu: 'Parallèle', rare: 'Holo', legendaire: 'Or' };
/* Les paliers qu'une variante ajoute : [premier badge, second badge] d'un patineur ; un nombre pour un gardien. */
/*
 * V5 — UNE HOLO, C'EST SPÉCIAL (JP : *tomber sur un holo doit être vraiment spécial*). La holo monte ses DEUX badges
 * d'un métal et son second badge rend PLEIN au lieu de la moitié (`VARIANTE_PLEINE`, lu par js/sim.js) : même un double
 * Platine (Makar, Fox) y gagne. L'or les monte de deux métaux. Plus rares en moyenne, et surtout chez les vedettes (`COTES_PAR_STATURE`).
 */
export const VARIANTE_PALIERS = { commune: [0, 0], peu: [0, 1], rare: [1, 1], legendaire: [2, 2] };
export const VARIANTE_PLEINE = { rare: true, legendaire: true };
export const VARIANTE_PALIERS_G = { commune: 0, peu: 1, rare: 2, legendaire: 3 };
const ICO_VARIANTE = { peu: '◆◆', rare: '✦', legendaire: '★' };
const RECRUE_PROGRESSE = { ico: '🐣', nom: 'Le jeune progresse', mot: 'Contrat d\'entrée : précision +1 % à partir de son 42e match.', apres: 41, finition: 1.01 };

/* La variante tirée selon des cotes (en %), de la graine et de la clé du joueur. */
export function varianteTiree(cotes, ...parts) {
  let r = hache('variante', ...parts) * 100;
  for (const k of ['commune', 'peu', 'rare', 'legendaire']) { r -= cotes[k] || 0; if (r < 0) return k; }
  return 'commune';
}
/* LA CARTE D'UN JOUEUR : sa variante (les paliers qu'elle ajoute se lisent dans `badgesDe`). */
export function carteDe(rarete) {
  return { rar: VARIANTE_PALIERS[rarete] ? rarete : 'commune' };
}

/*
 * L'EFFET D'UNE CARTE SUR UN CANAL du moteur, pour un joueur : un facteur (1 = rien). Depuis V2.4, la variante
 * joue par ses paliers (`badgesDe`) ; reste la recrue qui a fait ses classes (ses matchs joués, `simGP`).
 */
export function effetCarte(p, canal) {
  const c = p && p._carte;
  if (!c || canal !== 'finition' || !c.recrue || (p.simGP || 0) <= RECRUE_PROGRESSE.apres) return 1;
  return RECRUE_PROGRESSE.finition;
}

/* Ce qu'une carte fait sur la glace, en mots : l'écran l'affiche UNE fois. Rien pour une carte de base. */
export function traitsDeCarte(carte, gardien = false) {
  const out = [];
  const r = carte && carte.rar;
  if (ICO_VARIANTE[r]) {
    const [a, b] = VARIANTE_PALIERS[r], n = VARIANTE_PALIERS_G[r];
    // « Palier » est un mot du code : à l'écran, le badge monte au suivant (Bronze → Argent → Or → Platine).
    const mot = gardien ? (n > 1 ? `Son badge monte de ${n} : Bronze → ${['', '', 'Or', 'Platine'][n]}.` : 'Son badge monte au suivant : Bronze → Argent.')
      : a && b ? 'Ses deux badges montent au suivant.' : a ? 'Son badge monte au suivant : Bronze → Argent → Or → Platine.' : 'Son second badge monte au suivant.';
    if (mot) out.push({ ico: ICO_VARIANTE[r], nom: NOM_VARIANTE[r], mot });
  }
  if (carte && carte.recrue) out.push({ ico: RECRUE_PROGRESSE.ico, nom: RECRUE_PROGRESSE.nom, mot: RECRUE_PROGRESSE.mot });
  return out;
}
