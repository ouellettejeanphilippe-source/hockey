/**
 * LA RARETÉ JOUE (S78).
 *
 * JP : *faudrait que la rareté et cie impacte aussi la performance, ou ajoute
 * des traits, rien de game breaker, mais quand même* ; au choix proposé :
 * « les deux, en plus petit ».
 *
 * LA RARETÉ D'UN JOUEUR ne lit que son SALAIRE dans sa saison (le rang de son
 * salaire, `rareteDeSalaire`, js/cartes.js) — jamais une cote. Le contrôleur
 * la pose sur chaque joueur quand sa saison se charge (`p._rar`, js/game.js,
 * `getShard`) ; un joueur sans rareté connue (un script de mesure qui ne la
 * pose pas) n'a simplement aucun de ces effets.
 *
 * DEUX ÉTAGES, petits l'un et l'autre :
 *   - UN TRAIT PAR RARETÉ, chacun DIFFÉRENT — jamais strictement meilleur :
 *     la commune ne se fatigue pas, la peu commune joue partout, la rare se
 *     réveille les grands soirs, la légendaire est une vedette ;
 *   - UN PETIT BONUS DE PRÉCISION qui monte avec la rareté (0 à +1,5 %).
 * Et la RECRUE (un contrat d'entrée, `p.elc`) progresse : précision +1 % à
 * partir de son 42e match de la saison.
 *
 * TOUT LE MONDE Y A DROIT, adversaires compris : c'est une règle du hockey
 * du jeu, pas un cadeau au joueur. Les effets sont pesés pour ne rien casser :
 * une légendaire rend au plus +2,5 % de précision, une commune 5 % de fatigue
 * de moins (voir CLAUDE.md, S78).
 */

export const TRAITS_RARETE = {
  commune: { ico: '🔨', nom: 'Travaillant', mot: 'Il ne lâche jamais : fatigue −5 %.', energie: 0.95 },
  peu: { ico: '🔄', nom: 'Polyvalent', mot: 'Il joue partout : pénalité hors position −25 %.', horsPosition: 0.75 },
  rare: { ico: '🎯', nom: 'Clutch', mot: 'Les grands soirs : précision +1,5 % en gros match et en séries.', clutch: 1.015 },
  legendaire: { ico: '🌟', nom: 'Vedette', mot: 'Précision +1 %, tous les soirs.', finition: 1.01 },
};
/* Le petit bonus de précision, toujours, selon la rareté. */
export const BONUS_RARETE = { commune: 1, peu: 1.005, rare: 1.01, legendaire: 1.015 };
export const RECRUE_PROGRESSE = { ico: '🐣', nom: 'La recrue progresse', mot: 'Contrat d\'entrée : précision +1 % à partir de son 42e match.', apres: 41, finition: 1.01 };

export const rareteDe = p => (p && TRAITS_RARETE[p._rar] ? p._rar : null);

/*
 * LA PRÉCISION D'UN TIREUR selon sa carte : le bonus de rareté, le trait
 * (Vedette toujours, Clutch les grands soirs), la recrue qui a fait ses
 * classes. `grand` : un gros match ou un match de séries. `matchs` : ses
 * matchs joués cette saison.
 */
export function finitionDeCarte(p, { grand = false, matchs = 0 } = {}) {
  const r = rareteDe(p);
  let f = r ? BONUS_RARETE[r] : 1;
  if (r === 'legendaire') f *= TRAITS_RARETE.legendaire.finition;
  if (r === 'rare' && grand) f *= TRAITS_RARETE.rare.clutch;
  if (p && p.elc && matchs > RECRUE_PROGRESSE.apres) f *= RECRUE_PROGRESSE.finition;
  return f;
}
/* La fatigue d'un Travaillant. */
export const energieDeCarte = p => (rareteDe(p) === 'commune' ? TRAITS_RARETE.commune.energie : 1);
/* La pénalité hors position d'un Polyvalent. */
export const horsPositionDeCarte = p => (rareteDe(p) === 'peu' ? TRAITS_RARETE.peu.horsPosition : 1);

/* Ce qu'une carte fait sur la glace, en mots : l'écran l'affiche UNE fois (la fiche, la carte). */
export function traitsDeCarte(p) {
  const r = rareteDe(p);
  const out = [];
  if (r) out.push({ ...TRAITS_RARETE[r], bonus: BONUS_RARETE[r] });
  if (p && p.elc) out.push({ ...RECRUE_PROGRESSE });
  return out;
}
