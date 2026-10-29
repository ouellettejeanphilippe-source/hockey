/**
 * LES COACHS (v2 ; V21, docs/refonte-v21.md) — les personnages d'une run.
 *
 * JP, 29 oct. 2026 : *coach-personnage à la Hades*. Un coach est choisi au départ d'une run (le prestige en ouvre
 * plus, `VOIES`) et la fait au complet : son niveau, son arbre de trois pouvoirs, ses talents et les bienfaits de
 * ses adjoints vivent dans js/pouvoirs.js. Ici, son identité : son totem (`ico`, une icône, un coach), son surnom,
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
/* Les huit voies d'une run, dans l'ordre où le prestige les ouvre (js/rogue.js `coachsOuverts`). */
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
