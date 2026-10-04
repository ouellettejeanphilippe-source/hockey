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
/* Les vraies couleurs d'un club (js/logos.js `getTeamBand`) en variables CSS : un but les porte partout (`.but-eq`). */
export const varsEquipe = b => `--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}`;
export const signe = n => (n > 0 ? `+${n}` : `${n}`);

/**
 * Le +/- d'un joueur, PAR MATCH (« +0,9 »).
 *
 * Le total de saison d'un défenseur des années 1970 (+70, +87) a le même
 * gabarit que ses points. Posé à côté, on dirait que la colonne a copié les
 * points. Par match, +0,9 n'est plus le même chiffre — et c'est encore son
 * vrai différentiel.
 */
export const pmMatch = (pm, gp) => {
  if (!gp) return '—';
  const v = Math.round((pm / gp) * 10) / 10;
  if (!v) return '0,0';
  return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',');
};

/** Un nombre gardé entre deux bornes. */
export const borne = (x, min, max) => Math.max(min, Math.min(max, x));

/**
 * Un pourcentage d'arrêts à la façon d'une fiche québécoise : « ,912 » (et
 * « 1,000 » pour un blanchissage parfait). Une seule forme dans tout le jeu
 * (1.0, gel des chaînes) : on lisait aussi « .912 » et « 91,2 % ».
 */
export const pct3 = x => (Number.isFinite(x) ? x.toFixed(3).replace(/^0\./, ',').replace('.', ',') : '—');

/*
 * DE L'ARGENT, À LA QUÉBÉCOISE : « 9,3 M$ », « 0,78 M$ », « −1,2 M$ » (1.0,
 * gel des chaînes ; la barre du haut écrivait « $9.3M » et la boutique
 * « 9,3 M$ »). Deux décimales sous 10 M$, une au-delà, sans zéro de trop.
 * L'espace avant « M$ » est insécable : le symbole ne passe jamais seul à la
 * ligne. Une seule fonction pour tout le jeu : la boutique écrivait aussi
 * « 82,0 M$ » quand la barre disait « 82 M$ ».
 */
const ESPACE_INSECABLE = '\u00a0';
export const money = n => {
  const m = Math.abs(n) / 1e6;
  let s = m >= 10 ? m.toFixed(1) : m.toFixed(2);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return (n < 0 ? '−' : '') + s.replace('.', ',') + ESPACE_INSECABLE + 'M$';
};

/** Un nombre de 0 à 1 tiré de mots : la même entrée, le même nombre (le hasard pur des packs, des variantes, du deck). */
export function hache(...parts) {
  let h = 2166136261 >>> 0;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Une icône en présentation texte (sans l'emoji en couleur) : elle se teinte de la couleur de son palier. */
export const glyphe = ico => String(ico ?? '').replace(/\uFE0F/g, '\uFE0E');
