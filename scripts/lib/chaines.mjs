/*
 * LES CHAÎNES D'UN MODULE, SANS SES COMMENTAIRES (1.0). Un petit lecteur à
 * états — code, commentaire, chaîne, gabarit et ses ${…}, expression
 * régulière — partagé par scripts/check_clarte.mjs (les mots de l'écran) et
 * par le gel des chaînes (J5). Une expression régulière commence après un
 * caractère qui ne peut pas finir une valeur : assez pour ce dépôt, qui n'a ni
 * JSX ni division ambiguë.
 *
 *   chainesDe(src)             → ['texte', …]
 *   chainesDe(src, { lignes }) → [{ s: 'texte', ligne: 12 }, …]
 */
export function chainesDe(src, { lignes = false } = {}) {
  const out = [];
  let i = 0, dernier = '';
  const pile = [];   // les gabarits ouverts dont on lit un ${…}
  // La ligne d'un index, calculée à la demande (les sauts de ligne comptés une fois).
  const debuts = [0];
  if (lignes) for (let k = 0; k < src.length; k++) if (src[k] === '\n') debuts.push(k + 1);
  const ligneDe = idx => { let a = 0, b = debuts.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (debuts[m] <= idx) a = m; else b = m - 1; } return a + 1; };
  const pousser = (s, idx) => out.push(lignes ? { s, ligne: ligneDe(idx) } : s);
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { s += src[j + 1]; j += 2; } else s += src[j++]; }
      pousser(s, i); i = j + 1; dernier = 'v'; continue;
    }
    if (c === '`' || (c === '}' && pile.length && pile[pile.length - 1] === 0)) {
      if (c === '}') pile.pop();
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) { if (src[j] === '\\') { s += src[j + 1]; j += 2; } else s += src[j++]; }
      pousser(s, i);
      if (src[j] === '$') { pile.push(0); i = j + 2; dernier = '('; } else { i = j + 1; dernier = 'v'; }
      continue;
    }
    if (c === '{' && pile.length) pile[pile.length - 1]++;
    if (c === '}' && pile.length) pile[pile.length - 1]--;
    if (c === '/' && (dernier === '' || '(,=:[!&|?{};+-*%<>~^'.includes(dernier))) {
      let j = i + 1, classe = false;
      while (j < src.length && (classe || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') classe = true; else if (src[j] === ']') classe = false; j++; }
      i = j + 1; while (/[a-z]/i.test(src[i] || '')) i++; dernier = 'v'; continue;
    }
    if (!/\s/.test(c)) dernier = /[\w$)\]]/.test(c) ? 'v' : c;
    i++;
  }
  return out;
}
