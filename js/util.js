/*
 * LES PETITS OUTILS PARTAGÉS (1.0, jalon 3). Chacun existait en deux à six
 * copies identiques, une par module ; ils vivent ici une fois. Un module les
 * importe sous le nom qu'il employait déjà (`ordF as ordP`, `estD as isD`),
 * donc aucun appel n'a changé. Aucune dépendance, aucun DOM : Node et le
 * navigateur les lisent pareil.
 *
 * Ce qui n'est PAS ici exprès : les outils qui se ressemblent sans faire la
 * même chose (`nomCourt` en quatre variantes, `mmss`, `motFit`, `pct`, les
 * `lire`/`ecrire` de localStorage à clé fixe ou libre) — les fondre
 * changerait un affichage.
 */

/** Le texte d'une valeur, sûr à poser dans du HTML. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Un défenseur, quelle que soit la façon dont la saison écrit son poste. */
export const estD = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');

/** « 1er », « 2e » ; au féminin « 1re », « 2e » (une passe, une période). */
export const ord = n => (n === 1 ? '1er' : `${n}e`);
export const ordF = n => (n === 1 ? '1re' : `${n}e`);

/** La première lettre en capitale. */
export const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Le nom d'un joueur, ou rien. */
export const nom = p => (p && p.n) || '';

/** La virgule décimale ; le signe devant un nombre positif. */
export const virgule = x => String(x).replace('.', ',');
export const signe = n => (n > 0 ? `+${n}` : `${n}`);

/** Un nombre gardé entre deux bornes. */
export const borne = (x, min, max) => Math.max(min, Math.min(max, x));

/** Un pourcentage d'arrêts à la façon d'une fiche : « ,912 ». */
export const pct3 = x => x.toFixed(3).replace(/^0/, '');

/** De l'argent : « $9.3M » (le plafond, la barre du haut) ; « 9,3 M$ » (la boutique, l'inventaire). */
export const money = n => {
  const m = n / 1e6;
  const s = Math.abs(m) >= 10 ? m.toFixed(1) : m.toFixed(2);
  return (n < 0 ? '−$' : '$') + s.replace('-', '').replace(/\.?0+$/, '') + 'M';
};
export const millions = v => `${(v / 1e6).toFixed(1).replace('.', ',')} M$`;

/** Un nombre de 0 à 1 tiré de mots : la même entrée, le même nombre (le hasard pur des packs, des variantes, du deck). */
export function hache(...parts) {
  let h = 2166136261 >>> 0;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
