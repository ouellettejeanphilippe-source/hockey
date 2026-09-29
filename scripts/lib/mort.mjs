/*
 * LE CODE MORT, MESURÉ (1.0, jalon 3). La bibliothèque de
 * scripts/check_mort.mjs : elle lit les sources du jeu SANS LEURS
 * COMMENTAIRES — un nom cité dans un commentaire n'est pas un appel — et
 * compte, pour chaque déclaration, chaque `export` et chaque classe CSS, où il
 * sert encore.
 *
 * Le décompte est CONSERVATEUR : un nom compte comme utilisé dès qu'il paraît
 * ailleurs dans du code ou dans une chaîne, même comme propriété (`ctx.nom`).
 * Le prix : un mort qui porte le nom d'une propriété vivante passe entre les
 * mailles. Le gain : ce script ne réclame JAMAIS la tête d'un vivant.
 */
import fs from 'node:fs';
import path from 'node:path';

const MOTS_AVANT_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);

/**
 * Le code sans ses commentaires. Les chaînes ('…', "…", `…` et leurs
 * `${…}` imbriqués) et les regex littérales restent telles quelles : un `//`
 * dans une adresse ou un `/\/\//` n'ouvre pas un commentaire.
 */
export function sansCommentaires(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const pile = [];          // profondeur d'accolades de chaque `${` ouvert dans un gabarit
  let dernier = '';         // le dernier caractère significatif émis (hors blancs)
  let dernierMot = '';      // le dernier mot émis (pour `return /x/`)
  const regexPermise = () => !dernier || '(,=:[!&|?{};+-*%<>~^'.includes(dernier) || MOTS_AVANT_REGEX.has(dernierMot);
  const emettre = s => { out += s; const t = s.trim(); if (t) { dernier = t[t.length - 1]; const m = t.match(/[A-Za-z_$][\w$]*$/); dernierMot = m && /[\w$]$/.test(t) ? m[0] : ''; } };
  const gabarit = () => {
    // On est juste après un ` (ou juste après la } qui ferme un ${…}).
    let s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { s += c; i++; emettre(s); return; }
      if (c === '$' && src[i + 1] === '{') { s += '${'; i += 2; emettre(s); pile.push(0); return; }
      s += c; i++;
    }
    emettre(s);
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const f = src.indexOf('*/', i + 2); const bloc = src.slice(i, f < 0 ? n : f + 2); out += bloc.replace(/[^\n]/g, ' '); i = f < 0 ? n : f + 2; continue; }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      emettre(src.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '`') { out += '`'; i++; dernier = '`'; gabarit(); continue; }
    if (c === '{' && pile.length) { pile[pile.length - 1]++; emettre(c); i++; continue; }
    if (c === '}' && pile.length) {
      if (pile[pile.length - 1] === 0) { pile.pop(); out += '}'; i++; gabarit(); continue; }
      pile[pile.length - 1]--; emettre(c); i++; continue;
    }
    if (c === '/' && regexPermise()) {
      let j = i + 1, classe = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') classe = true;
        else if (src[j] === ']') classe = false;
        else if (src[j] === '/' && !classe) break;
        j++;
      }
      j++;
      while (j < n && /[a-z]/i.test(src[j])) j++;
      emettre(src.slice(i, j)); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; emettre(src.slice(i, j)); i = j; continue; }
    if (/\s/.test(c)) { out += c; i++; continue; }
    emettre(c); i++;
  }
  return out;
}

/** Toutes les sources qui peuvent appeler le jeu : js/, data/*.js, scripts/ (et lib/), index.html, sw.js. */
export function lireSources(root) {
  const src = {};
  const ajouter = f => { src[f] = fs.readFileSync(path.join(root, f), 'utf8'); };
  for (const d of ['js', 'data', 'scripts', 'scripts/lib']) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (/\.(m?js)$/.test(f)) ajouter(`${d}/${f}`);
  }
  ajouter('index.html');
  ajouter('sw.js');
  const code = {};
  for (const [f, s] of Object.entries(src)) code[f] = f.endsWith('.html') ? s.replace(/<!--[\s\S]*?-->/g, '') : sansCommentaires(s);
  return { src, code };
}

const echapper = s => s.replace(/[$]/g, '\\$');
export const occurrences = (texte, nom) => (texte.match(new RegExp(`(?<![\\w$])${echapper(nom)}(?![\\w$])`, 'g')) || []).length;
/* Une classe CSS : bornée par autre chose qu'une lettre ou un tiret — `album-id${…}` la nomme, `album-id-x` non. */
export const occurrencesClasse = (texte, nom) => (texte.match(new RegExp(`(?<![\\w-])${echapper(nom)}(?![\\w-])`, 'g')) || []).length;

/** Les déclarations du haut d'un fichier : fonctions, classes, const/let simples. */
export function declarations(code) {
  const out = [];
  const lignes = code.split('\n');
  lignes.forEach((l, k) => {
    let m = l.match(/^(export\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/);
    if (!m) m = l.match(/^(export\s+)?class\s+([A-Za-z_$][\w$]*)/);
    if (!m) m = l.match(/^(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (m) out.push({ nom: m[2], exporte: !!m[1], ligne: k + 1 });
    // `export const a = 1, b = 2` et `const A = x, B = y` : les suivants sur la même ligne.
    const multi = l.match(/^(export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=.*?,\s*([A-Za-z_$][\w$]*)\s*=/);
    if (multi && !/[({[]/.test(l.slice(0, l.indexOf(multi[2])).replace(/^[^=]*=/, ''))) out.push({ nom: multi[2], exporte: !!multi[1], ligne: k + 1 });
  });
  // `export { a, b as c }` en bas de fichier
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}\s*;?\s*$/gm)) {
    for (const p of m[1].split(',')) { const nom = p.trim().split(/\s+as\s+/)[0].trim(); if (nom) { const d = out.find(x => x.nom === nom); if (d) d.exporte = true; } }
  }
  return out;
}

/**
 * Qui importe quoi. Un nom est « importé » d'un module quand un AUTRE fichier
 * nomme ce module (import statique, `import()` dynamique) et que le nom y
 * paraît. Large exprès : une déstructuration d'un `await import(…)` compte.
 */
export function importeDeHors(code, fichier, nom) {
  const base = path.basename(fichier);
  const qui = [];
  for (const [g, c] of Object.entries(code)) {
    if (g === fichier) continue;
    if (!c.includes(base)) continue;
    const reImport = new RegExp(`(?:from\\s*|import\\s*\\(\\s*)['"\`][^'"\`]*${base.replace('.', '\\.')}['"\`]`);
    if (!reImport.test(c)) continue;
    // `import * as C from './x.js'` : le module entier est lu (check_commentaire passe en revue chaque liste exportée).
    const reEspace = new RegExp(`import\\s*\\*\\s*as\\s+[A-Za-z_$][\\w$]*\\s*from\\s*['"][^'"]*${base.replace('.', '\\.')}['"]`);
    if (reEspace.test(c) || occurrences(c, nom)) qui.push(g);
  }
  return qui;
}

/** Les noms importés par un fichier et qu'il n'emploie jamais (import statique `{ a, b as c }` et par défaut). */
export function importsInutiles(code) {
  const out = [];
  for (const m of code.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]\s*;?/gm)) {
    const tete = m[1];
    const noms = [];
    const accolades = tete.match(/\{([\s\S]*)\}/);
    if (accolades) for (const p of accolades[1].split(',')) { const n = p.trim().split(/\s+as\s+/).pop().trim(); if (n) noms.push(n); }
    const defaut = tete.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim().split(/\s+/).filter(x => x && x !== '*' && x !== 'as');
    noms.push(...defaut.filter(x => !/^\*/.test(x)));
    const ns = tete.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (ns) noms.push(ns[1]);
    for (const n of noms) if (occurrences(code, n) <= 1) out.push(n);
  }
  return out;
}

/** Les classes CSS déclarées dans une feuille (les sélecteurs seulement, pas les url() ni les valeurs). */
export function classesCss(css) {
  const sansCom = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const noms = new Set();
  // Les sélecteurs : ce qui précède chaque `{` hors des blocs de déclarations.
  let tampon = '';
  for (const c of sansCom) {
    if (c === '{') {
      // Un @media / @keyframes ne déclare aucune classe ; une étape d'animation non plus.
      const t = tampon.trim();
      if (!t.startsWith('@') && !/^(from|to|[\d.]+%)/.test(t)) for (const m of t.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) noms.add(m[1]);
      tampon = '';
      continue;
    }
    if (c === '}' || c === ';') { tampon = ''; continue; }
    tampon += c;
  }
  return noms;
}

/**
 * Les préfixes de classes fabriqués par le code : `tc-${…}`, 'niv-' + x, et
 * les racines SANS tiret (`lz${niveau}` fait lz1…lz4). Une racine sans tiret
 * sert aussi aux suffixes conditionnels (`btn${on ? ' on' : ''}`) : la compter
 * comme préfixe protège quelques morts, jamais ne condamne un vivant.
 */
export function prefixesDynamiques(code) {
  const pref = new Set();
  // Seul le jeu fabrique des classes : les scripts de test fabriquent des clés (`b${jour}`), pas du DOM.
  for (const [f, c] of Object.entries(code)) {
    if (!(f.startsWith('js/') || f === 'index.html')) continue;
    for (const m of c.matchAll(/(?:^|[\s"'`])(-?[A-Za-z_][\w-]+)\$\{/g)) pref.add(m[1]);
    for (const m of c.matchAll(/['"](-?[A-Za-z_][\w-]+)['"]\s*\+\s*[A-Za-z_$(]/g)) pref.add(m[1]);
  }
  return pref;
}
