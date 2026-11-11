/*
 * LES VOIX DU JEU, ET LES FILS DE LA SAISON (V22, docs/refonte-v22.md). Le fichier portait la banque d'événements de la
 * vie d'un DG-coach (courriels, dilemmes, points de presse) : elle est partie, sans être reprise (JP : *les événements,
 * c'est encore à chier : supprime la banque, pas le système*). Il reste :
 *
 *   EXPEDITEURS     qui écrit dans la boîte : une seule distribution de voix
 *   joueurDuFait    le joueur qu'un fait vise, lu dans les feuilles déjà jouées
 *   VOIX_DES_FILS   les fils de la saison, dits par quelqu'un (la une, la boîte)
 *
 * V25 C1 : le choix qu'un fil fort ouvrait (`CHOIX_DES_FILS`, V9) est parti ; les histoires de js/histoires.js lisent les
 * mêmes faits (le duo, la recrue, la disette) et passent par la porte de js/greffes.js.
 *
 * Tout est PUR : le même contexte et la même graine redonnent le même tirage, sans `hasard()`.
 */



/**
 * QUI ÉCRIT : l'icône et le nom que la boîte affiche (`m.de`). Une seule distribution pour toute la boîte
 * (V3, JP : *les messages sont des trucs du proprio, coach, joueurs, partisans, analystes*) : les courriels,
 * les choix forcés (js/saison.js) et les fils de la saison (`messageDuFil`) parlent par ces voix-là.
 */
export const EXPEDITEURS = {
  pr: { ico: '🏢', nom: 'Le proprio' },
  en: { ico: '🧑‍🏫', nom: 'L\'entraîneur' },
  an: { ico: '📺', nom: 'L\'analyste à la télé' },
  pt: { ico: '📣', nom: 'Les partisans' },
  ca: { ico: '🎖', nom: 'Le capitaine' },
  fi: { ico: '🧾', nom: 'Le directeur des finances' },
  ad: { ico: '🎯', nom: 'Ton adjoint' },
  ag: { ico: '🤝', nom: 'Un agent de joueur' },
  ph: { ico: '🩺', nom: 'Le physio' },
  eq: { ico: '🧦', nom: 'Le préposé à l\'équipement' },
  co: { ico: '📢', nom: 'Le service des communications' },
  li: { ico: '🪪', nom: 'La ligue' },
  pa: { ico: '🧣', nom: 'Un partisan fidèle' },
  ma: { ico: '🗳', nom: 'Le maire' },
  // Les voix d'À faire (Jalon M) : elles vivaient à part dans js/saison.js (`DE`) ; une seule distribution.
  me: { ico: '🩺', nom: 'Le médecin' },
  dg: { ico: '📋', nom: 'Le DG' },
  dp: { ico: '🔎', nom: 'Le dépisteur' },
};

/*
 * LE JOUEUR DU FAIT (V11, tranche 5 — docs/refonte-v11.md). JP : *l'interview vise un joueur quand le fait vient de
 * lui*. La question vise celui dont le fait vient, lu dans les feuilles qu'elle raconte (`feuilles` : [{ f, cote }],
 * dans l'ordre) : le gardien qui a reçu les tirs du dernier soir, le meilleur pointeur, celui qui a pris le plus de
 * punitions — parmi `habilles` (un Set). Personne dans les feuilles : null, et la question garde sa cible d'avant
 * (js/faits.js `faitsDe` le lit pour les histoires). Rend { p, fait }, le fait en vrais chiffres. Pur.
 */
export function joueurDuFait(sorte, feuilles, habilles) {
  const compter = (liste, f) => { const n = new Map(); for (const x of liste) { const p = f(x); if (p && habilles.has(p)) n.set(p, (n.get(p) || 0) + 1); } return [...n].sort((a, b) => b[1] - a[1])[0] || null; };
  if (sorte === 'gardien') {
    const der = feuilles[feuilles.length - 1];
    const g = der && compter((der.f.lancers || []).filter(l => l.cote !== der.cote), l => l.gardien);
    if (!g) return null;
    const buts = (der.f.buts || []).filter(b => b.cote !== der.cote && b.gardien === g[0]).length;
    return { p: g[0], fait: `${g[0].n} : ${buts} but${buts > 1 ? 's' : ''} sur ${g[1]} tirs ce soir-là` };
  }
  if (sorte === 'vedette') {
    const v = compter(feuilles.flatMap(({ f, cote }) => (f.buts || []).filter(b => b.cote === cote).flatMap(b => [b.marqueur, ...(b.passeurs || [])])), p => (p && p.p !== 'G' ? p : null));
    return v ? { p: v[0], fait: `${v[0].n} : ${v[1]} point${v[1] > 1 ? 's' : ''} en ${feuilles.length} matchs` } : null;
  }
  if (sorte === 'dur') {
    const d = compter(feuilles.flatMap(({ f, cote }) => (f.punitions || []).filter(x => x.cote === cote)), x => x.joueur);
    return d ? { p: d[0], fait: `${d[0].n} : ${d[1]} punition${d[1] > 1 ? 's' : ''} en ${feuilles.length} matchs` } : null;
  }
  return null;
}
