/*
 * LES VRAIS COACHS (V21 ; JP : *les coachs et assistants comme l'alignement, avec des coachs ; des cartes de vrais coachs
 * par saison*). Ton entraîneur est une carte : un vrai coach, une saison, son club (data/coachs.json, construit par
 * scripts/coachs.mjs depuis les records de la LNH). Sa philosophie — un des huit coachs de js/coachs.js, et ses trois
 * pouvoirs (js/pouvoirs.js) — se lit dans les vraies stats de son club cette saison-là ; son rang dans cette lecture fait
 * sa MAÎTRISE, une force de plus sur ses pouvoirs (`MAITRISE`). Pur : l'écran et les robots tirent les mêmes cartes.
 */
import { hache } from './util.js';

let DONNEES = null;
/* data/coachs.json, chargé une fois, au choix du coach (le Rogue seulement). */
export async function chargerCoachs() {
  if (!DONNEES) DONNEES = await fetch('data/coachs.json').then(r => r.json());
  return DONNEES;
}
/* Le rang qui fait la maîtrise : premier ou deuxième de la ligue, puis dans les cinq premiers. */
export const MAITRISE = [[2, 1.2], [5, 1.1]];
export const maitriseDu = rang => (MAITRISE.find(([r]) => rang <= r) || [0, 1])[1];
/* Ce que sa philosophie lit dans son club, en mots : « 1er aux tirs pour ». */
const LECTURE = { essaim: 'aux tirs pour', tortue: 'aux tirs contre (le moins)', rapaces: 'au % de tir', rhinos: 'aux minutes de pénalité',
  choeur: 'à la discipline', souffle: 'à la santé du vestiaire', profondeur: 'à la profondeur', etoiles: 'au poids de ses vedettes' };
export const motDuRang = (cle, rang) => `${rang}${rang === 1 ? 'er' : 'e'} ${LECTURE[cle] || ''}`.trim();

/* Une carte de coach : { id, n, saison, tag, cle, rang, maitrise, fiche: { gp, v, d, n }, coupe, jack }. */
export function carteDuCoach(donnees, saison, tag) {
  const x = donnees && donnees[saison] && donnees[saison][tag];
  if (!x) return null;
  const [n, cle, rang, gp, v, d, nulles, coupe, jack] = x;
  return { id: `${saison}_${tag}`, n, saison, tag, cle, rang, maitrise: maitriseDu(rang), fiche: { gp, v, d, n: nulles }, coupe: !!coupe, jack: !!jack };
}
/*
 * LE LOTO DE L'ENTRAÎNEUR : trois vraies cartes, de trois philosophies que le prestige ouvre (`ouverts`), tirées de la
 * graine — la même graine, les mêmes trois. Comme le classeur des joueurs, il tire d'abord dans ton cartable
 * (`cartable` : id → { r }, js/cartable.js `coachsDuCartable`), les moins jouées d'abord, `DU_CARTABLE` au plus ; le
 * reste, des cartes neuves (`neuf`). Une carte prise entre au cartable.
 */
export const DU_CARTABLE = 2;
export function lotoDesCoachs(donnees, ouverts, graine, n = 3, cartable = {}) {
  const cartes = [];
  for (const [saison, clubs] of Object.entries(donnees || {})) for (const tag of Object.keys(clubs)) if (ouverts.includes(clubs[tag][1])) cartes.push([saison, tag]);
  const triees = cartes.sort((a, b) => hache(String(graine), 'coach', a.join()) - hache(String(graine), 'coach', b.join()));
  const id = ([saison, tag]) => `${saison}_${tag}`;
  const siennes = triees.filter(x => cartable[id(x)]).sort((a, b) => (cartable[id(a)].r || 0) - (cartable[id(b)].r || 0));
  const out = [];
  const prendre = (liste, max, neuf) => {
    for (const [saison, tag] of liste) {
      if (out.length >= max) return;
      const c = carteDuCoach(donnees, saison, tag);
      if (!out.some(x => x.cle === c.cle)) out.push({ ...c, neuf });
    }
  };
  prendre(siennes, Math.min(DU_CARTABLE, n - 1), false);
  prendre(triees.filter(x => !cartable[id(x)]), n, true);
  return out;
}
