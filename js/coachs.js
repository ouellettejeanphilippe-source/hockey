/**
 * LES COACHS (v2 ; V21, docs/refonte-v21.md) — les personnages d'une run.
 *
 * JP, 29 oct. 2026 : *coach-personnage à la Hades*. Un coach est choisi au départ d'une run (le prestige en ouvre
 * plus, `VOIES`) et la fait au complet : sa pièce de départ et le banc de cinq vivent dans js/pieces.js (V27,
 * tranche 5). Ici, son identité : son totem (`ico`, une icône, un coach), son surnom,
 * `de` pour les phrases (« les joueurs du Frelon »), sa philosophie en une ligne, et ses `familles` (ce qu'un
 * adversaire lit pour choisir son intention au duel, `coachPaie`, js/sim.js).
 *
 * LA COULEUR D'UN JOUEUR (v2). Un joueur est de la couleur du coach de son MEILLEUR RÔLE, s'il le maîtrise (« bon »
 * et plus, `ROLE_BON`) : lu dans ses vraies stats, jamais dans une cote. Elle oriente le pack du coach et le
 * dépisteur (js/packs.js) ; elle ne joue plus au moteur (V21 : la confiance et ses paliers sont partis).
 */
export const COACHS = {
  essaim: { ico: '🐝', nom: 'Le Frelon', de: 'du Frelon', mot: 'Tirer de partout, tout le temps.', familles: { paie: ['tir', 'robustesse'], coute: 'jeu' } },
  rapaces: { ico: '🦅', nom: 'L\'Aigle', de: 'de l\'Aigle', mot: 'Chaque lancer doit rentrer.', familles: { paie: ['tir', 'jeu'], coute: 'defense' } },
  tortue: { ico: '🐢', nom: 'La Tortue', de: 'de la Tortue', mot: 'Fermer la porte, gagner 2-1.', familles: { paie: ['defense'], coute: 'tir' } },
  rhinos: { ico: '🦏', nom: 'Le Rhino', de: 'du Rhino', mot: 'Cogner et tenir, jusqu\'en avril.', familles: { paie: ['robustesse'], coute: 'jeu' } },
  souffle: { ico: '🫁', nom: 'Le Doc', de: 'du Doc', mot: 'Des jambes fraîches et personne à l\'infirmerie.', familles: { paie: ['robustesse'], coute: 'tir' } },
  choeur: { ico: '😇', nom: 'L\'Abbé', de: 'de l\'Abbé', mot: 'Jamais au cachot ; eux, souvent.', familles: { paie: ['jeu'], coute: 'robustesse' } },
  profondeur: { ico: '🪜', nom: 'Le Contremaître', de: 'du Contremaître', mot: 'Quatre trios qui jouent, pas trois.', familles: { paie: ['defense'], coute: 'jeu' } },
  etoiles: { ico: '🌠', nom: 'Le Showman', de: 'du Showman', mot: 'Les vedettes sur la glace, toute la soirée.', familles: { paie: ['jeu'], coute: 'defense' } },
};
/*
 * LA RÈGLE DU COACH (V23, docs/refonte-v23.md § D ; JP, 2 nov. : *every coach should change how you play*). Chaque
 * philosophie paie, en jetons, le soir où ton club joue SON hockey : une ligne, lue dans la feuille jouée (comme les
 * victoires), jamais d'avance, et rien au moteur. Facile : une phrase. Dur : bâtir l'effectif qui la tient, sans perdre
 * les matchs pour elle. Les seuils sont pris pour qu'un club qui joue ce style la touche à peu près un soir sur quatre
 * (mesuré sur les clubs témoins : 35 tirs 22 %, 24 tirs contre 30 %, 13 % au tir 30 %, 28 mises en échec 25 %, deux
 * punitions 18 %, le but gagnant en 3e 14 %, quatre buteurs 25 %, trois points d'un joueur 23 %) ; les plus rares
 * paient 3. `lit(s)` : `s`, les chiffres de ton club ce soir-là (`chiffresDuSoirDe`, js/rogue.js).
 */
export const REGLES_DU_COACH = {
  essaim: { jetons: 2, dit: '35 tirs ou plus', lit: s => s.tirs >= 35 },
  tortue: { jetons: 2, dit: '24 tirs contre ou moins', lit: s => s.tirsContre <= 24 },
  rapaces: { jetons: 2, dit: '13 % au tir ou mieux', lit: s => s.tirs > 0 && s.buts / s.tirs >= 0.13 },
  rhinos: { jetons: 2, dit: '28 mises en échec ou plus', lit: s => s.coups >= 28 },
  choeur: { jetons: 3, dit: 'deux punitions ou moins', lit: s => s.punitions <= 2 },
  souffle: { jetons: 3, dit: 'le but gagnant en 3e ou en prolongation', lit: s => s.butGagnantTard },
  profondeur: { jetons: 2, dit: 'quatre buteurs ou plus', lit: s => s.buteurs >= 4 },
  etoiles: { jetons: 2, dit: 'un joueur à trois points ou plus', lit: s => s.pointsMax >= 3 },
};
/* Les huit voies d'une run : les trois premières ouvertes au départ, les cinq autres en médailles (js/rogue.js `voiesOuvertes`). */
export const VOIES = ['tortue', 'essaim', 'rhinos', 'rapaces', 'souffle', 'choeur', 'profondeur', 'etoiles'];

const ROLE_BON = 55;
export const COACH_DU_ROLE = {
  F: { sniper: 'rapaces', passeur: 'etoiles', deuxsens: 'tortue', power: 'essaim', checker: 'profondeur', energie: 'souffle', bagarreur: 'rhinos' },
  D: { defensif: 'tortue', offensif: 'essaim', manieur: 'choeur', physique: 'rhinos', deuxsens: 'tortue' },
};
/* Le coach de ces rôles (`profilsDe`, js/sim.js) pour un avant ('F') ou un défenseur ('D'), ou null. */
export function coachDesRoles(roles, groupe) {
  if (!roles || !COACH_DU_ROLE[groupe]) return null;
  const [role, score] = Object.entries(roles).filter(([k]) => COACH_DU_ROLE[groupe][k]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
  return role && score >= ROLE_BON ? COACH_DU_ROLE[groupe][role] : null;
}
