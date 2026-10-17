/*
 * LES GALONS (V9, tranche 7 — docs/refonte-v9.md § 6.8). JP : *ce que ta run a fait devient ce que ta run est*. Ce
 * qu'un joueur a fait CHEZ TOI, dans une saison de la run, lu dans le journal de ton club (ses matchs joués, leurs
 * feuilles) : le 40e but, la 50e passe, la 30e victoire d'un gardien, le 5e gros match gagné avec un point, les 40
 * points d'une recrue. Chacun se grave avec son match et son adversaire (« 40e but, au 71e match, contre Boston »).
 *
 * CE QU'IL DONNE, par les canaux qui existent :
 *   - pour le reste de la run, son badge monte d'un palier par galon, `GALONS_MAX` au plus (une décision de report,
 *     `galons`, que le moteur lit comme la carte d'entraînement : js/sim.js `badgesDe`) ;
 *   - sa carte en garde une copie de plus (la carte monte par ses exploits, pas seulement par ses doublons :
 *     js/cartable.js `graverLaSaison`).
 * Pur : le journal et les gros matchs du club, sans hasard. Partagé par le navigateur et les juges.
 */

export const ICO_GALON = '🏵';
export const GALONS_MAX = 2;
export const GALONS = {
  buts: { nom: 'Le marqueur', seuil: 40, unite: 'but' },
  passes: { nom: 'Le passeur', seuil: 50, unite: 'passe' },
  victoires: { nom: 'Le mur', seuil: 30, unite: 'victoire', gardien: true },
  // Ses gros matchs gagnés AVEC un point, pas ses soirs habillé ni ses points : une équipe qui gagne ses duels ne galonne
  // pas tout son alignement, et une raclée de 10 à 0 contre un rival faible n'en donne pas cinq d'un coup (tranche 8).
  grandsSoirs: { nom: 'Les grands soirs', seuil: 5, unite: 'gros match gagné avec un point' },
  recrue: { nom: 'La recrue de l\'année', seuil: 40, unite: 'point', recrue: true },
};

const ordinal = n => `${n}${n === 1 ? 'er' : 'e'}`;
/* Le galon en mots : « 40e but, au 71e match, contre Boston ». */
export const texteDuGalon = g => `${ordinal(g.n)} ${GALONS[g.cle].unite}, au ${ordinal(g.match)} match, contre ${g.adv}`;

/*
 * LES GALONS D'UNE SAISON, dans l'ordre où ils tombent. `you` : ton club (son `journal`, ses `minisBoss`) ;
 * `joueurs` : ceux qui peuvent en gagner (tes joueurs à la fin de la saison) ; `cle(p)` : sa clé de carte.
 * Rend [{ cle: le galon, joueur: sa clé, nom, n, match, adv }] ; `parcourir` compte aussi ses gros matchs gagnés habillé.
 */
export const galonsDeLaSaison = (you, joueurs = [], cle = p => p.id) => parcourir(you, joueurs, cle).out;
/* Ses gros matchs gagnés habillé, par clé : ce que son histoire chez toi garde (`gros`). */
export const grosGagnesDe = (you, joueurs = [], cle = p => p.id) => parcourir(you, joueurs, cle).habille;
function parcourir(you, joueurs, cle) {
  const miens = new Set(joueurs);
  const compte = new Map(), habille = new Map(), out = [];
  const gros = new Set(((you && you.minisBoss) || []).filter(mb => mb.gagne).map(mb => `${mb.jour}|${mb.adv && mb.adv.name}`));
  const ajouter = (p, galon, e, n = 1) => {
    if (!miens.has(p)) return;
    const k = `${cle(p)}|${galon}`, avant = compte.get(k) || 0;
    compte.set(k, avant + n);
    const G = GALONS[galon];
    if (avant < G.seuil && avant + n >= G.seuil) out.push({ cle: galon, joueur: cle(p), nom: p.n, n: G.seuil, match: e.n, adv: (e.adv && e.adv.name) || '?' });
  };
  for (const e of (you && you.journal) || []) {
    const f = e.feuille;
    if (!f) continue;
    const cote = (f.alignes && (f.alignes.A || []).some(p => miens.has(p))) ? 'A' : 'B';
    const grosGagne = Number.isFinite(e.jour) && gros.has(`${e.jour}|${e.adv && e.adv.name}`);
    const auPointage = new Set();
    for (const b of f.buts || []) {
      if (b.cote !== cote) continue;
      for (const p of [b.marqueur, ...(b.passeurs || [])].filter(Boolean)) {
        ajouter(p, p === b.marqueur ? 'buts' : 'passes', e);
        if (p.rk) ajouter(p, 'recrue', e);
        auPointage.add(p);
      }
    }
    if (grosGagne) for (const p of auPointage) ajouter(p, 'grandsSoirs', e);
    if (e.win && e.gardien) ajouter(e.gardien, 'victoires', e);
    if (grosGagne) for (const p of (f.alignes && f.alignes[cote]) || []) if (miens.has(p)) habille.set(cle(p), (habille.get(cle(p)) || 0) + 1);
  }
  return { out, habille };
}
