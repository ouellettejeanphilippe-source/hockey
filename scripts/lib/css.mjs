/*
 * Un lecteur de feuille de style minimal (scripts/check_css.mjs) : les règles
 * avec leur contexte (la chaîne des @media / @container / @supports qui les
 * portent), sans dépendance. Les commentaires et les chaînes sont respectés.
 */
export function regles(src) {
  let i = 0;
  const n = src.length;
  const out = [];
  const chaine = q => { i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; };
  function bloc(ctx) {
    while (i < n) {
      if (/\s/.test(src[i])) { i++; continue; }
      if (src.startsWith('/*', i)) { i = src.indexOf('*/', i + 2) + 2; continue; }
      if (src[i] === '}') { i++; return; }
      const debut = i;
      let par = 0;
      while (i < n) {
        const c = src[i];
        if (c === '"' || c === "'") { chaine(c); continue; }
        if (src.startsWith('/*', i)) { i = src.indexOf('*/', i + 2) + 2; continue; }
        if (c === '(' || c === '[') par++;
        else if (c === ')' || c === ']') par--;
        else if (par === 0 && (c === '{' || c === ';' || c === '}')) break;
        i++;
      }
      const tete = src.slice(debut, i).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
      if (src[i] !== '{') { if (src[i] === ';') i++; continue; }
      i++;
      if (/^@(media|supports|container|layer)\b/.test(tete)) { bloc([...ctx, tete]); continue; }
      const corps = i;
      let prof = 1;
      while (i < n && prof) {
        const c = src[i];
        if (c === '"' || c === "'") { chaine(c); continue; }
        if (src.startsWith('/*', i)) { i = src.indexOf('*/', i + 2) + 2; continue; }
        if (c === '{') prof++; else if (c === '}') prof--;
        i++;
      }
      if (!tete.startsWith('@')) out.push({ selecteur: tete.replace(/\s*([,>+~])\s*/g, '$1'), contexte: ctx.join(' > '), corps: src.slice(corps, i - 1), ligne: src.slice(0, debut).split('\n').length });
    }
  }
  bloc([]);
  return out;
}
