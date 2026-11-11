/*
 * LIRE UN DEVIS (docs/gabarits/devis.md) : la partie sous un titre, et ses noms en `code`. Partagé par
 * scripts/check_refonte.mjs (ce qui part est parti) et scripts/check_neuf.mjs (le neuf ne s'appuie pas sur ce qui part).
 */

/** Le code sans ses commentaires : un nom qui ne survit que dans un commentaire est parti. */
export const sansCommentaires = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** La partie d'un devis dont le titre `## ` commence par ce mot, ses lignes. */
export function partie(devis, titre) {
  const lignes = devis.split('\n');
  const debut = lignes.findIndex(l => new RegExp(`^##\\s+(\\d+[a-z]?\\.\\s*)?${titre}`, 'i').test(l));
  if (debut < 0) return null;
  const corps = [];
  for (let i = debut + 1; i < lignes.length && !/^##\s/.test(lignes[i]); i++) corps.push(lignes[i]);
  return corps;
}

/** Les noms en `code` d'une partie, une fois chacun. */
export const codes = lignes => [...new Set((lignes || []).join('\n').match(/`[^`\n]+`/g) || [])].map(c => c.slice(1, -1).trim());

/** Le motif d'un nom entier dans du code : ni lettre, ni chiffre, ni tiret collé. */
export const motifDe = nom => new RegExp(`(?<![\\w$-])${nom.replace(/^\./, '').replace(/\(\)$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$-])`);
