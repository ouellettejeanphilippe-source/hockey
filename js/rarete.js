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

/*
 * LES CINQ ÉDITIONS (oct. 2026). JP : *j'aime pas le classement par couleur, je préfère des niveaux avec cosmétique
 * différents* ; *Holo devrait être plus haut que or* ; *un système d'upgrade à la Marvel Snap si tu pognes pas la
 * holo*. La carte d'un joueur a une ÉDITION, de 1 à 5, et chaque édition AJOUTE quelque chose qu'on voit (style.css,
 * « LES ÉDITIONS ») et quelque chose qui joue (`VARIANTE_PALIERS`) :
 *   1 Base        la carte nue
 *   2 Cadre       un cadre de métal brossé           second badge +1
 *   3 Hors-cadre  la tête sort de la photo           premier badge +1
 *   4 Or          la feuille d'or, numérotée /99     le second badge rend plein, une case de plus au verso
 *   5 Holo        l'arc-en-ciel qui suit la main     les deux badges +2
 * Les clés restent celles des sauvegardes : `rare` (l'ancienne holo) devient l'Or, qui joue pareil ; `legendaire`
 * (l'ancien or) devient la Holo, qui joue pareil ; `hors` est neuve. Rien à migrer : une carte garde sa force, elle
 * change de nom et de finition. « Niveau » est au joueur (Soutien → Phénomène) ; à sa carte, on dit « édition ».
 */
export const EDITIONS = ['commune', 'peu', 'hors', 'rare', 'legendaire'];
export const numeroEdition = r => Math.max(0, EDITIONS.indexOf(r)) + 1;
/* Les cotes d'une carte ordinaire, en moyenne sur toutes les statures (le robot de mesure s'en sert) : V5, une holo
 * est RARE (1,7 %) et forte — mesuré : à 6 % et 2 %, le robot du Rogue gagnait la Coupe dans 25 % des runs. Le
 * Hors-cadre se prend dans le Cadre : la moyenne bouge peu. */
export const COTES_VARIANTES = { commune: 82, peu: 13, hors: 3, rare: 1.6, legendaire: 0.4 };
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
  { commune: 87, peu: 10.5, hors: 2, rare: 0.4, legendaire: 0.1 },
  { commune: 80, peu: 14.5, hors: 3.5, rare: 1.6, legendaire: 0.4 },
  { commune: 70, peu: 18, hors: 6, rare: 5, legendaire: 1 },
  { commune: 55, peu: 22, hors: 8, rare: 11, legendaire: 4 },
  { commune: 40, peu: 22, hors: 10, rare: 20, legendaire: 8 },
];
export function statureDe(p, niveau) {
  if (!p) return 0;
  const age = p.bd && p.s ? ageAtSeason(p.bd, p.s) : null;
  const marques = (p.rk ? 1 : 0) + (age != null && age >= VETERAN ? 1 : 0) + (getTraits(p).some(t => t.cle === 'MENEUR') ? 1 : 0);
  return Math.max(0, Math.min(COTES_PAR_STATURE.length - 1, Math.max(0, niveau ?? 0) + marques));
}
export const NOM_VARIANTE = { commune: 'Base', peu: 'Cadre', hors: 'Hors-cadre', rare: 'Or', legendaire: 'Holo' };
/* Les paliers qu'une édition ajoute : [premier badge, second badge] d'un patineur ; un nombre pour un gardien. */
/*
 * V5 — UNE HOLO, C'EST SPÉCIAL (JP : *tomber sur un holo doit être vraiment spécial*). Depuis oct. 2026, l'Or (`rare`)
 * monte ses DEUX badges d'un métal et son second badge rend PLEIN au lieu de la moitié (`VARIANTE_PLEINE`, lu par
 * js/sim.js) : même un double Platine (Makar, Fox) y gagne. La Holo (`legendaire`) les monte de deux métaux. Plus
 * rares en moyenne, et surtout chez les vedettes (`COTES_PAR_STATURE`).
 */
export const VARIANTE_PALIERS = { commune: [0, 0], peu: [0, 1], hors: [1, 1], rare: [1, 1], legendaire: [2, 2] };
export const VARIANTE_PLEINE = { rare: true, legendaire: true };
/* Un gardien n'a qu'un badge : le Cadre le monte d'un, le Hors-cadre de deux, la Holo de trois ; l'Or lui donne sa case. */
export const VARIANTE_PALIERS_G = { commune: 0, peu: 1, hors: 2, rare: 2, legendaire: 3 };
/* Ce que chaque édition fait sur la glace, en mots (la fiche l'écrit une fois ; « palier » est un mot du code). */
const MOT_EDITION = {
  peu: 'Son second badge monte au suivant.',
  hors: 'Ses deux badges montent au suivant.',
  rare: 'Ses deux badges montent au suivant, et le second rend plein. Une case de plus au verso.',
  legendaire: 'Ses deux badges montent de deux, et le second rend plein. Une case de plus au verso.',
};
const MOT_EDITION_G = n => (n > 1 ? `Son badge monte de ${n} : Bronze → ${['', '', 'Or', 'Platine'][n]}.` : 'Son badge monte au suivant : Bronze → Argent.');
const RECRUE_PROGRESSE = { ico: '🐣', nom: 'Le jeune progresse', mot: 'Contrat d\'entrée : précision +1 % à partir de son 42e match.', apres: 41, finition: 1.01 };

/* La variante tirée selon des cotes (en %), de la graine et de la clé du joueur. */
export function varianteTiree(cotes, ...parts) {
  let r = hache('variante', ...parts) * 100;
  for (const k of EDITIONS) { r -= cotes[k] || 0; if (r < 0) return k; }
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
  if (MOT_EDITION[r]) {
    const mot = gardien ? `${MOT_EDITION_G(VARIANTE_PALIERS_G[r])}${VARIANTE_PLEINE[r] ? ' Une case de plus au verso.' : ''}` : MOT_EDITION[r];
    out.push({ ico: `Éd. ${numeroEdition(r)}`, nom: NOM_VARIANTE[r], mot });
  }
  if (carte && carte.recrue) out.push({ ico: RECRUE_PROGRESSE.ico, nom: RECRUE_PROGRESSE.nom, mot: RECRUE_PROGRESSE.mot });
  return out;
}
